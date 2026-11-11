/* =========================================================================
   VISUAL DAS CLASSES — mesma cabeça/cabelo do personagem em todas as classes;
   cada classe muda roupa (modelo do corpo + cores), armas, acessórios e efeitos.
   As 2ª classes (evoluções) ganham brilho, auras e peças extras.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';
import { humanIdlePose } from './humans3d.js';

export const HEADS = { Knight: 'Knight_Head', Mage: 'Mage_Head', Barbarian: 'Barbarian_Head', Rogue: 'Rogue_Head', Rogue_Hooded: 'Rogue_Head_Hooded' };
export const ACCESSORIES = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Mage_Hat', 'Mage_Cape'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Barbarian_Cape'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'],
  Rogue_Hooded: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'],
};

/* Cada classe: outfit (corpo), show (acessórios do próprio modelo), borrow (peças de outros modelos),
   tint (cores da roupa), glow (peças que brilham), extras (peças feitas em código), scale (tamanhos). */
export const CLASS_LOOKS = {
  aprendiz: { outfit: 'Rogue', show: [], borrow: [['Knight', '1H_Sword']], tint: { body: '#b89a6a', legs: '#6a5038' }, style: '1h', extras: ['belt'] },
  guerreiro: { outfit: 'Knight', show: ['1H_Sword'], armor: 'leve', tint: { body: '#9aa2b0', legs: '#5a4a3a', cape: '#b8332a' }, style: '1h', extras: ['belt'] },
  cavaleiro_runico: { outfit: 'Knight', show: ['2H_Sword'], armor: 'placas', tint: { body: '#3a4258', legs: '#262c3c', cape: '#7a1020' }, glow: { '2H_Sword': '#4ad0ff' }, style: '2h', extras: ['runes'] },
  guardiao_sagrado: { outfit: 'Knight', show: ['1H_Sword'], armor: 'paladino', tint: { body: '#fff6dc', legs: '#8a7a5a' }, glow: { '1H_Sword': '#ffd76a' }, style: '1h' }, // S-204: armadura de placas de verdade, tabardo e capa de pano com física (sem asas de fada)
  mago: { outfit: 'Mage', show: [], staff: { wood: '#5a3a22', gem: '#8ab8ff' }, tint: { body: '#3a5ad8', legs: '#2a3470', cape: '#1e2a78' }, style: 'cast' },
  arquimago: { outfit: 'Mage', show: [], staff: { wood: '#3a2a3e', gem: '#c07aff' }, tint: { body: '#4a2a7a', legs: '#2a1446', cape: '#24103c' }, glow: { '2H_Staff': '#c07aff' }, style: 'cast', extras: ['arcaneEnergy'] }, // S-220: sem os anéis · S-315: energia arcana em filetes (no lugar das bolinhas)
  sabio_elemental: { outfit: 'Mage', show: ['Mage_Cape'], book: true, tint: { body: '#2f7a6a', legs: '#1f4a40', cape: '#c9a24a' }, style: 'cast', extras: ['elementOrbs'] }, // S-314: livro de verdade na mão (sem varinha/livro do pacote) · S-313: orbes elementais
  arqueiro: { outfit: 'Rogue', show: [], bow: { wood: '#7a4a22' }, tint: { body: '#4f8a45', legs: '#5a4430', cape: '#2f5a2a' }, style: 'ranged', extras: ['quiver'] },
  cacador: { outfit: 'Barbarian', show: [], bow: { wood: '#4a2c14', tip: '#d8c8a0', h: 1.4 }, tint: { body: '#8a6a3a', legs: '#5a4028', cape: '#4a3020' }, style: 'ranged', extras: ['quiver', 'falcon'] },
  menestrel: { outfit: 'Rogue', show: [], bow: { wood: '#8a3a2a', h: 1.1 }, tint: { body: '#8a2a5a', legs: '#3a2a5a', cape: '#d8a03a' }, style: 'ranged', extras: ['lute'] }, // S-108: as notas só aparecem com a Canção de Batalha ativa (songAura em main3d)
  ladino: { outfit: 'Rogue', show: [], dagger: {}, tint: { body: '#3e4a34', legs: '#2e2a26', cape: '#2a2a33' }, style: 'dual', extras: ['thiefGear'] }, // S-201/S-202: gatuno com UMA adaga
  lamina_sombria: { outfit: 'Rogue', show: [], dagger: { glow: '#b06aff' }, katar: {}, tint: { body: '#221a2e', legs: '#18121f', cape: '#2a1440' }, style: 'dual', extras: ['shoulderSpikes', 'shadowWisps'] },
  saqueador: { outfit: 'Barbarian', show: ['1H_Axe'], tint: { body: '#7a5a3a', legs: '#4a3a2a', cape: '#a8842a' }, style: 'dual', extras: ['lootBag', 'goldCoins'] },
};

// esqueleto realista (Quaternius) tem outros nomes de osso: traduz os nomes antigos
const HUMAN_BONE = { head: 'Head', chest: 'spine_03', hips: 'pelvis', 'handslot.r': 'hand_r', handslotr: 'hand_r', 'handslot.l': 'hand_l', handslotl: 'hand_l' };
const bone = (root, n) => (root.userData.human && HUMAN_BONE[n] ? root.getObjectByName(HUMAN_BONE[n]) : null) || root.getObjectByName(n.replace(/\./g, '')) || root.getObjectByName(n);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: false, ...extra });
const glowMat = (color, k = 1.4, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3, ...extra });
let _glowSpr = null; // brilho redondo e macio (sem borda) para auras e centelhas
function glowSpriteTex() { if (_glowSpr) return _glowSpr; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); _glowSpr = new THREE.CanvasTexture(c); return _glowSpr; }

// grupo preso a um osso, onde 1 unidade = 1 metro (desfaz a escala do personagem)
// medidas do corpo (m): cabeça de 0,95 a 1,80 (largura ~0,84); tronco ~0,62 de largura; peito em 0,73
const PART_SCALE = { head: 1.65, chest: 1.3, hips: 1.4 };
// no corpo realista, as peças feitas para o corpo antigo (cabeção) são reduzidas e deslocadas para caber
const HUMAN_PART = { head: { k: 0.29, y: 0.085, z: 0.012 }, chest: { k: 0.62, y: -0.02, z: 0 }, hips: { k: 0.62, y: 0, z: 0 } };
function socket(root, boneName) {
  const b = bone(root, boneName) || root;
  root.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); b.getWorldScale(ws);
  const g = new THREE.Group();
  if (root.userData.human) { // osso em metros: desfaz a rotação do osso (o enfeite fica "em pé" no corpo) e aplica a proporção
    const H = HUMAN_PART[boneName] || { k: 0.62, y: 0, z: 0 };
    const inner = new THREE.Group(); b.add(g); g.add(inner);
    const wq = new THREE.Quaternion(); b.getWorldQuaternion(wq); const rq = new THREE.Quaternion(); root.getWorldQuaternion(rq);
    g.quaternion.copy(wq.invert().multiply(rq)); g.scale.setScalar(1 / ws.x);
    inner.position.set(0, H.y, H.z); inner.scale.setScalar(H.k); return inner;
  }
  g.scale.setScalar((PART_SCALE[boneName] || 1) / ws.x);
  b.add(g); return g;
}
// recolore a peça mantendo os detalhes da textura (troca a cor, não só escurece)
function tintMesh(o, hex, k = 0.88) {
  const col = new THREE.Color(hex);
  o.traverse(m => {
    if (!m.isMesh) return;
    const mat = m.material.clone();
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTint = { value: col }; sh.uniforms.uMix = { value: k };
      sh.fragmentShader = 'uniform vec3 uTint; uniform float uMix;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.35 + lum * 1.35), uMix);`);
    };
    mat.customProgramCacheKey = () => 'tint' + hex + k;
    m.material = mat;
  });
}
function glowMesh(o, hex) {
  o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(hex); m.material.emissiveIntensity = 0.9; } });
}

/* ---------- peças feitas em código (em metros) ---------- */
const EXTRAS = {
  belt(root) { const g = socket(root, 'hips'); const b = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 28), std('#5a3a22')); b.rotation.x = Math.PI / 2; b.position.y = 0.1; b.scale.set(1, 1.15, 1); g.add(b); const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), std('#d8b04a', { metalness: 0.7 })); buckle.position.set(0, 0.1, 0.22); g.add(buckle); },
  pauldrons(root) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.24, 0.1, 0); socket(root, 'chest').add(g);
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), std('#4a5266', { metalness: 0.7, roughness: 0.35 })); plate.position.y = 0.04; plate.scale.set(1.1, 0.8, 1.1); g.add(plate);
      for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 14), std('#c8ccd6', { metalness: 0.8 })); sp.position.set((i - 1) * 0.07, 0.15, 0); g.add(sp); }
    }
  },
  runes(root, fx) {
    const g = new THREE.Group(); g.position.y = 0.9; root.parent.add(g);
    const rs = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), glowMat('#4ad0ff', 2)); g.add(r); rs.push(r); }
    fx.push(t => rs.forEach((r, i) => { const a = t * 1.6 + i * 2.09; r.position.set(Math.cos(a) * 0.65, Math.sin(t * 2 + i) * 0.15, Math.sin(a) * 0.65); r.rotation.y = t * 3; }));
  },
  halo(root, fx) {
    const g = socket(root, 'head');
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 28), glowMat('#ffe680', 2.2)); h.rotation.x = Math.PI / 2; h.position.y = 0.6; g.add(h);
    fx.push(t => { h.position.y = 0.6 + Math.sin(t * 2) * 0.015; h.rotation.z = t * 0.6; });
  },
  holyWings(root, fx) {
    const g = socket(root, 'chest'); const wings = [];
    for (const s of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(0.35 * s, 0.45, 0.62 * s, 0.32); shape.quadraticCurveTo(0.42 * s, 0.05, 0.55 * s, -0.12); shape.quadraticCurveTo(0.25 * s, -0.05, 0, 0);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#fff4c8', emissive: '#ffe08a', emissiveIntensity: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      w.position.set(0.05 * s, 0.15, -0.27); g.add(w); wings.push([w, s]);
    }
    fx.push(t => wings.forEach(([w, s]) => { w.rotation.y = s * (0.35 + Math.sin(t * 2) * 0.12); }));
  },
  tabard(root) { const g = socket(root, 'chest'); const tb = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.42), std('#f6f2e8', { side: THREE.DoubleSide })); tb.position.set(0, -0.12, 0.235); g.add(tb); const cross = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.01), glowMat('#ffcf4a', 0.6)); cross.position.set(0, -0.08, 0.24); g.add(cross); const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.01), glowMat('#ffcf4a', 0.6)); cross2.position.set(0, -0.04, 0.24); g.add(cross2); },
  arcaneRings(root, fx) {
    const g = new THREE.Group(); g.position.y = 0.95; root.parent.add(g);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 10, 48), glowMat('#c07aff', 2.2)), r2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 10, 48), glowMat('#7a9aff', 2));
    g.add(r1, r2); fx.push(t => { r1.rotation.set(Math.PI / 2 + Math.sin(t) * 0.3, t * 0.8, 0); r2.rotation.set(Math.PI / 2 - Math.sin(t * 1.3) * 0.4, -t * 1.1, 0.4); });
  },
  starMotes(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const ms = [];
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 20, 14), glowMat('#e0c8ff', 2.5)); g.add(m); ms.push(m); }
    fx.push(t => ms.forEach((m, i) => { const k = (t * 0.35 + i / 8) % 1, a = i * 2.4 + t; m.position.set(Math.cos(a) * 0.45, 0.2 + k * 1.8, Math.sin(a) * 0.45); m.scale.setScalar(1 - k); }));
  },
  circlet(root) { const g = socket(root, 'head'); const c = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 10, 28), std('#d8b04a', { metalness: 0.8, roughness: 0.3 })); c.rotation.x = Math.PI / 2; c.position.y = 0.38; c.scale.set(1, 1.1, 1); g.add(c); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), glowMat('#7affd0', 1.8)); gem.position.set(0, 0.38, 0.25); g.add(gem); },
  // S-313: quatro orbes pequenos e bem acabados, cada um com o princípio do seu elemento, numa órbita lenta e levemente inclinada
  elementOrbs(root, fx) {
    const g = new THREE.Group(); g.position.y = 1.32; root.parent.add(g); const orbs = [];
    const halo = (c, s, o = 0.55) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(s); return sp; };
    // água: gotícula líquida e brilhante que ondula
    { const o = new THREE.Group(), d = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 18), new THREE.MeshStandardMaterial({ color: '#3d8fe8', emissive: '#1f5fb8', emissiveIntensity: 0.6, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.88 }));
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(-0.009, 0.011, 0.018); o.add(d, hl, halo('#5ab0ff', 0.11, 0.5));
      o.userData.tick = t => d.scale.set(1 + Math.sin(t * 5.3) * 0.06, 1 - Math.sin(t * 5.3) * 0.05, 1 + Math.cos(t * 4.1) * 0.05); orbs.push(o); }
    // fogo: chaminha viva (núcleo claro, línguas de fogo que tremulam e sobem)
    { const o = new THREE.Group(), core = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff0c0' })); o.add(core, halo('#ff6a20', 0.12, 0.6));
      const ls = []; for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 12, 1, true), new THREE.MeshBasicMaterial({ color: k % 2 ? '#ff5a1a' : '#ffa030', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); l.position.y = 0.014; o.add(l); ls.push(l); }
      o.userData.tick = t => ls.forEach((l, k) => { const f = 0.75 + 0.35 * Math.abs(Math.sin(t * (9 + k * 2.3) + k)); l.scale.set(1 - k * 0.15, f * (1 - k * 0.12), 1 - k * 0.15); l.rotation.set(Math.sin(t * 7 + k) * 0.25, k * 1.6, Math.cos(t * 6 + k) * 0.25); }); orbs.push(o); }
    // terra: pedrinha lapidada âmbar com veio verde (cristal liso, sem facetas duras)
    { const o = new THREE.Group(), geo = new THREE.IcosahedronGeometry(0.024, 2); const P = geo.attributes.position; for (let k = 0; k < P.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(P, k), n = 1 + 0.18 * Math.sin(v.x * 140) * Math.cos(v.y * 120) + 0.25 * Math.max(0, v.y / 0.024); P.setXYZ(k, v.x * n, v.y * n * 1.25, v.z * n); } geo.computeVertexNormals();
      const s = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#c08a3a', emissive: '#6a4a10', emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.15 })); const moss = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.9 })); moss.position.set(0.012, -0.012, 0.01); moss.scale.set(1.4, 0.6, 1.2);
      o.add(s, moss, halo('#e0b060', 0.09, 0.35)); o.userData.tick = t => { s.rotation.set(t * 0.6, t * 0.9, 0); }; orbs.push(o); }
    // vento: espiral de ar translúcida (filetes que giram)
    { const o = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#d8f8ea', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), sp = [];
      for (let k = 0; k < 3; k++) { const pts = []; for (let j = 0; j <= 20; j++) { const u = j / 20, a = u * Math.PI * 3 + k * 2.1, r = 0.006 + u * 0.022; pts.push(new THREE.Vector3(Math.cos(a) * r, (u - 0.5) * 0.04, Math.sin(a) * r)); } const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0022, 5, false), mat); o.add(m); sp.push(m); }
      o.add(halo('#c8ffe8', 0.1, 0.3)); o.userData.tick = t => sp.forEach((m, k) => { m.rotation.y = t * (3.5 + k * 0.7); }); orbs.push(o); }
    orbs.forEach(o => g.add(o));
    fx.push(t => orbs.forEach((o, i) => { const a = t * 0.7 + i * Math.PI / 2, r = 0.36; o.position.set(Math.cos(a) * r, 0.18 + Math.sin(a * 2 + i) * 0.035 + Math.sin(a) * 0.06, Math.sin(a) * r); o.userData.tick(t); }));
  },
  // S-315: energia arcana do Arquimago (no espírito do mago de Skyrim): filetes luminosos em espiral em volta da pedra do cajado,
  // centelhas suaves que sobem e a mão livre acesa — mais forte ao conjurar
  arcaneEnergy(root, fx) {
    const mk = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const fil = [], head = new THREE.Group();
    const attach = () => { const staff = root.userData.items && root.userData.items['2H_Staff']; if (!staff) return; head.position.y = staff.userData.gripY / 0.58 + 0.075; staff.add(head); }; // o cajado é montado depois dos efeitos
    for (let k = 0; k < 3; k++) { const pts = []; for (let j = 0; j <= 30; j++) { const u = j / 30, a = u * Math.PI * 4 + k * 2.09, r = 0.035 + Math.sin(u * Math.PI) * 0.045; pts.push(new THREE.Vector3(Math.cos(a) * r, (u - 0.5) * 0.22, Math.sin(a) * r)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0028, 5, false), mk(k === 1 ? '#9fd0ff' : '#c89aff', 0.75)); head.add(m); fil.push(m); }
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: '#b08aff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); aura.scale.setScalar(0.22); head.add(aura);
    // mão livre (esquerda): brilho e centelhas que sobem e somem
    const hl = bone(root, 'hand_l'), handG = new THREE.Group(); if (hl) hl.add(handG); handG.position.set(0, 0.07, 0.02);
    const hglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: '#a88aff', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); hglow.scale.setScalar(0.16); handG.add(hglow);
    const sparks = []; for (let k = 0; k < 10; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: k % 3 ? '#cfb2ff' : '#9fd0ff', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.025); (k < 5 ? head : handG).add(s); sparks.push(s); }
    let cast = 0;
    fx.push(t => {
      if (!head.parent) attach();
      const an = (root.userData.anim && root.userData.anim.name) || '', want = /Spell|Shoot|Cast/.test(an) || performance.now() - (root.userData.ovT || -1e9) < 600 ? 1 : 0.25;
      cast += (want - cast) * 0.08;
      fil.forEach((m, k) => { m.rotation.y = t * (1.6 + k * 0.5) * (k % 2 ? -1 : 1); m.material.opacity = 0.35 + 0.35 * cast + 0.1 * Math.sin(t * 3 + k); });
      aura.material.opacity = 0.3 + 0.35 * cast + 0.08 * Math.sin(t * 2.3); hglow.material.opacity = 0.12 + 0.6 * cast; hglow.scale.setScalar(0.12 + 0.08 * cast + 0.02 * Math.sin(t * 6));
      sparks.forEach((s, k) => { const u = (t * 0.45 + k * 0.137) % 1, a = k * 2.4 + t * 1.3, r = 0.03 + u * 0.05; s.position.set(Math.cos(a) * r, u * 0.22, Math.sin(a) * r); s.material.opacity = Math.sin(u * Math.PI) * (0.35 + 0.5 * cast); });
    });
  },
  quiver(root) {
    const g = socket(root, 'chest');
    const q = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.42, 16), std('#6b4426')); q.position.set(0.1, 0.05, -0.3); q.rotation.z = -0.45; g.add(q);
    for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 16), std('#d8c8a0')); a.position.set(0.16 + (i - 1.5) * 0.02, 0.3, -0.3 + (i % 2) * 0.02); a.rotation.z = -0.45; g.add(a); const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 14), std('#e04848')); f.position.set(0.2 + (i - 1.5) * 0.02, 0.4, -0.3 + (i % 2) * 0.02); f.rotation.z = -0.45; g.add(f); }
  },
  featherBand(root) { const g = socket(root, 'head'); const b = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 10, 28), std('#5a3a22')); b.rotation.x = Math.PI / 2; b.position.y = 0.36; b.scale.set(1, 1.1, 1); g.add(b); const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), std('#e8e0c8')); f.scale.set(0.35, 2.4, 0.9); f.position.set(-0.2, 0.55, -0.1); f.rotation.z = 0.5; g.add(f); const f2 = f.clone(); f2.material = std('#7a4a2a'); f2.position.set(-0.24, 0.5, -0.06); f2.rotation.z = 0.8; g.add(f2); },
  falcon(root, fx) {
    const g = socket(root, 'chest'); const bird = new THREE.Group(); bird.position.set(0.4, 0.13, -0.03); bird.scale.setScalar(1.35); g.add(bird);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), std('#7a5a3a')); body.scale.set(0.9, 1.1, 1.4); bird.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), std('#e8d8b8')); chest.position.set(0, 0.02, 0.05); bird.add(chest);
    const head = new THREE.Group(); head.position.set(0, 0.1, 0.05); bird.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), std('#5a4030')));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 14), std('#f0c040')); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.01, 0.06); head.add(beak);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 14), std('#111')); e.position.set(s * 0.028, 0.012, 0.035); head.add(e); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.12), std('#5a4030')); tail.position.set(0, -0.04, -0.12); tail.rotation.x = 0.4; bird.add(tail);
    fx.push(t => { head.rotation.y = Math.sin(t * 0.9) * 0.8 * (Math.sin(t * 0.3) > 0 ? 1 : 0.2); });
  },
  humanCape(root, fx, color) { // capa de tecido nas costas (corpo realista)
    const g = socket(root, 'chest'), cg = new THREE.PlaneGeometry(1, 1.0, 8, 14), P = cg.attributes.position;
    for (let k = 0; k < P.count; k++) { // trapézio: estreita nos ombros, larga e ondulada embaixo, curvada nas costas
      const x = P.getX(k), y = P.getY(k), u = (0.575 - y) / 1.15, w = 0.32 + u * 0.18, X = x * w;
      P.setXYZ(k, X, y + (u > 0.95 ? Math.sin(x * 14) * 0.025 : 0), -X * X * 1.1 - u * u * 0.08 + Math.sin(x * 10 + u * 4) * 0.012 * u);
    }
    cg.translate(0, -0.575, 0); cg.computeVertexNormals();
    const cape = new THREE.Mesh(cg, std(color, { side: THREE.DoubleSide, roughness: 0.9 })); cape.position.set(0, 0.2, -0.16); cape.rotation.x = 0.1; cape.castShadow = true;
    const h = new THREE.Group(); h.scale.setScalar(1 / 0.62); g.add(h); h.add(cape);
    fx.push(tt => { cape.rotation.x = 0.08 + Math.sin(tt * 1.6) * 0.04; });
  },
  lute(root) {
    // alaúde de verdade: caixa em forma de pera (costas abauladas, tampo reto), roseta, escala com trastes, cravelhal dobrado para trás e cordas
    const g = socket(root, 'chest'); const l = new THREE.Group(); l.position.set(-0.02, 0.05, -0.36); l.rotation.set(0.12, 0, 0.62); l.scale.setScalar(1.95); g.add(l); // S-206: alaúde do tamanho de verdade (~0,85 m) nas costas
    const R = t => 0.155 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.55) * (1 - 0.42 * t); // raio ao longo da caixa (largo embaixo, afina para o braço)
    const Y0 = -0.19, LEN = 0.36, prof = [];
    for (let k = 0; k <= 24; k++) { const t = k / 24; prof.push(new THREE.Vector2(Math.max(0.001, R(t)), Y0 + t * LEN)); }
    const bowl = new THREE.LatheGeometry(prof, 40);
    const P = bowl.attributes.position;
    for (let k = 0; k < P.count; k++) { let z = P.getZ(k) * 0.55; if (z < -0.012) z = -0.012 + (z + 0.012) * 0.05; P.setZ(k, z); } // costas fundas, frente quase plana
    bowl.computeVertexNormals();
    const wood = std('#8a4a22', { roughness: 0.45 }), top = std('#e2bf86', { roughness: 0.6 }), dark = std('#2a160a'), ebony = std('#1e140e', { roughness: 0.35 });
    const body = new THREE.Mesh(bowl, wood); l.add(body);
    const shape = new THREE.Shape(); shape.moveTo(0, Y0);
    for (let k = 0; k <= 24; k++) { const t = k / 24; shape.lineTo(R(t) * 0.995, Y0 + t * LEN); }
    for (let k = 24; k >= 0; k--) { const t = k / 24; shape.lineTo(-R(t) * 0.995, Y0 + t * LEN); }
    const board = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), top); board.position.z = -0.0135; board.rotation.y = Math.PI; board.scale.x = -1; l.add(board);
    const ros = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.04, 32), std('#5a3216')); ros.position.set(0, 0.03, -0.0145); ros.rotation.y = Math.PI; l.add(ros);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.026, 32), dark); hole.position.set(0, 0.03, -0.0142); hole.rotation.y = Math.PI; l.add(hole);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.01), ebony); bridge.position.set(0, -0.12, -0.018); l.add(bridge);
    // braço arredondado + escala de ébano com trastes
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.27, 16, 1, false, 0, Math.PI), wood); neck.rotation.y = Math.PI / 2; neck.position.set(0, 0.29, -0.012); neck.scale.set(1, 1, 0.7); l.add(neck);
    const fret = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.27, 0.006), ebony); fret.position.set(0, 0.29, -0.016); l.add(fret);
    for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.003, 0.004), std('#c9c2b0', { metalness: 0.6, roughness: 0.3 })); f.position.set(0, 0.405 - k * 0.026 * (1 - k * 0.04), -0.0195); l.add(f); }
    // cravelhal dobrado para trás com cravelhas
    const pb = new THREE.Group(); pb.position.set(0, 0.425, -0.01); pb.rotation.x = 1.05; l.add(pb);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.022), wood); box.position.y = 0.06; pb.add(box);
    for (let k = 0; k < 4; k++) for (const s2 of [-1, 1]) { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.05, 10), ebony); peg.rotation.z = Math.PI / 2; peg.position.set(s2 * 0.03, 0.02 + k * 0.028, 0); pb.add(peg); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), ebony); knob.position.set(s2 * 0.056, 0.02 + k * 0.028, 0); pb.add(knob); }
    // cordas (cintilam levemente)
    const sm = new THREE.MeshStandardMaterial({ color: '#efe6d0', metalness: 0.5, roughness: 0.3 });
    for (let k = 0; k < 6; k++) { const x = (k - 2.5) * 0.0065, st = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.55, 5), sm); st.position.set(x, 0.155, -0.022); l.add(st); }
  },
  bardHat(root) { const g = socket(root, 'head'); const hat = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), std('#5a1a4a')); hat.scale.set(1.05, 0.35, 1.05); hat.position.set(0.04, 0.5, -0.02); hat.rotation.z = -0.25; g.add(hat); const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 10, 28), std('#d8a03a')); band.rotation.x = Math.PI / 2; band.position.set(0.02, 0.44, -0.02); g.add(band); const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), std('#ff5a8a')); f.scale.set(0.35, 3.2, 0.8); f.position.set(-0.18, 0.66, -0.1); f.rotation.z = 0.6; g.add(f); },
  musicNotes(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const ns = [];
    for (let i = 0; i < 3; i++) { const n = new THREE.Group(); const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 14), glowMat('#ffb3d9', 1.5)); h.scale.set(1.3, 1, 0.6); const st = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.01), glowMat('#ffb3d9', 1.5)); st.position.set(0.035, 0.05, 0); n.add(h, st); g.add(n); ns.push(n); }
    fx.push(t => ns.forEach((n, i) => { const k = (t * 0.4 + i / 3) % 1; n.position.set(Math.sin(t + i * 2) * 0.4, 1.1 + k * 1.1, Math.cos(t + i * 2) * 0.4); n.scale.setScalar(Math.sin(k * Math.PI)); }));
  },
  // S-201: equipamento de gatuno — colete de couro justo, braçadeiras, lenço no rosto e faixa na cabeça, bolsinhas no cinto
  thiefGear(root) {
    if (!root.userData.human) return;
    root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
    const leather = armorMat('#3a2a1e', 'couro'), cloth = armorMat('#5a2a22', 'tecido'), dark = armorMat('#24201c', 'couro');
    ARMOR_PIECES.cuirass(root, leather, { off: 0.016 });
    for (const s of ['l', 'r']) ARMOR_PIECES.limb(root, dark, 'lowerarm_' + s, 'hand_' + s, 0.2, 0.95, 'bracer' + s);
    void cloth;
    // S-296: nada na cabeça (sem máscara nem faixa) — visual de cabeça só com item equipado
    const pv = bonePos(root, 'pelvis');
    for (const [dx, dz] of [[0.13, 0.08], [-0.15, 0.05], [0.16, -0.06]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), dark); b.scale.set(1, 1.1, 0.7); b.position.set(pv.x + dx, pv.y + 0.07, pv.z + dz); pinToBone(root, 'pelvis', b); }
  },
  bandana(root) { const g = socket(root, 'head'); const b = new THREE.Mesh(new THREE.SphereGeometry(0.265, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.3), std('#2a2a33')); b.position.y = 0.26; b.scale.set(1.02, 0.95, 1.05); g.add(b); for (const s of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.015), std('#2a2a33')); tail.position.set(s * 0.04, 0.24, -0.27); tail.rotation.set(0.3, 0, s * 0.35); g.add(tail); } },
  scarf(root) { const g = socket(root, 'chest'); const s = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 10, 28), std('#4a3a5a')); s.rotation.x = Math.PI / 2; s.position.y = 0.2; g.add(s); },
  shadowHood(root) {
    const g = socket(root, 'head');
    // casca de esfera com a abertura virada para a frente (+Z), deixando o rosto à mostra
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 14, Math.PI * 0.86, Math.PI * 1.28, 0, Math.PI * 0.66), std('#1a1424', { side: THREE.DoubleSide }));
    hood.position.set(0, 0.26, -0.02); hood.scale.set(1.08, 1.12, 1.1); g.add(hood);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 14), std('#1a1424')); tip.position.set(0, 0.42, -0.24); tip.rotation.x = -1.0; g.add(tip);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 10, 28, Math.PI), glowMat('#9a5aff', 1.4)); trim.position.set(0, 0.2, 0.17); trim.rotation.set(-0.35, 0, 0); g.add(trim);
  },
  mask(root) { const g = socket(root, 'head'); const m = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 14, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.22), std('#120c18', { side: THREE.DoubleSide })); m.position.y = 0.2; g.add(m); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 14), glowMat("#c08aff", 2.5)); e.position.set(s * 0.08, 0.27, 0.23); g.add(e); } },
  shoulderSpikes(root) {
    for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.24, 0.1, 0); socket(root, 'chest').add(g); for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2 - i * 0.04, 14), glowMat('#6a2aaa', 0.7)); sp.position.set(0, 0.12, (i - 1) * 0.06); sp.rotation.z = -s * (0.3 + i * 0.25); g.add(sp); } }
  },
  shadowWisps(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const ws = [];
    for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshStandardMaterial({ color: '#2a0a4a', emissive: '#6a2aaa', emissiveIntensity: 0.8, transparent: true, opacity: 0.55, depthWrite: false })); g.add(w); ws.push(w); }
    fx.push(t => ws.forEach((w, i) => { const k = (t * 0.5 + i / 7) % 1, a = i * 2.1 + t * 0.7; w.position.set(Math.cos(a) * 0.4, 0.1 + k * 1.4, Math.sin(a) * 0.4); w.scale.setScalar(1.2 - k); w.material.opacity = 0.55 * (1 - k); }));
  },
  tricorn(root) {
    const g = socket(root, 'head'); const hat = new THREE.Group(); hat.position.y = 0.5; g.add(hat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.16, 16), std('#2a1e14')); crown.position.y = 0.06; hat.add(crown);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.03), std('#2a1e14')); brim.position.set(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2); brim.rotation.y = -a + Math.PI / 2; brim.rotation.x = -0.35; hat.add(brim); const trim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.035), std('#d8b04a', { metalness: 0.7 })); trim.position.set(Math.cos(a) * 0.205, 0.1, Math.sin(a) * 0.205); trim.rotation.y = -a + Math.PI / 2; trim.rotation.x = -0.35; hat.add(trim); }
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 14), std('#f2ecd8')); skull.position.set(0, 0.06, 0.2); hat.add(skull);
  },
  strawHat(root) { const g = socket(root, 'head'); const h = new THREE.Group(); h.position.y = 0.44; g.add(h); const straw = std('#d9b866', { roughness: 1 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.025, 28), straw); h.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 20), straw); crown.position.y = 0.1; h.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.05, 20, 1, true), std('#b8332a')); band.position.y = 0.04; h.add(band); },
  flowerCrown(root) { const g = socket(root, 'head'); const ring = new THREE.Group(); ring.position.y = 0.4; g.add(ring);
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 10, 30), std('#4f8a34')); vine.rotation.x = Math.PI / 2; ring.add(vine);
    const cols = ['#ff8ab8', '#ffffff', '#ffd84a', '#b48cff', '#ff9a4a'];
    for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, f = new THREE.Group(); f.position.set(Math.cos(a) * 0.26, 0.02, Math.sin(a) * 0.26); ring.add(f);
      for (let k = 0; k < 5; k++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(0.028, 20, 14), std(cols[i % cols.length])); pt.scale.set(1, 0.4, 0.6); const b = k / 5 * Math.PI * 2; pt.position.set(Math.cos(b) * 0.03, 0.01, Math.sin(b) * 0.03); f.add(pt); }
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), std('#f2c43a')); c.position.y = 0.02; f.add(c); } },
  lootBag(root) { const g = socket(root, 'chest'); const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), std('#8a6a3a')); b.position.set(-0.08, -0.05, -0.33); b.scale.set(1, 1.1, 0.8); g.add(b); const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 10, 28), std('#d8b04a')); tie.position.set(-0.08, 0.12, -0.33); tie.rotation.x = Math.PI / 2; g.add(tie); },
  goldCoins(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const cs = [];
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), glowMat('#ffd84a', 0.6, { metalness: 0.9 })); c.rotation.x = Math.PI / 2; g.add(c); cs.push(c); }
    fx.push(t => cs.forEach((c, i) => { const a = t * 1.4 + i * Math.PI / 2; c.position.set(Math.cos(a) * 0.5, 0.75 + Math.sin(t * 3 + i) * 0.1, Math.sin(a) * 0.5); c.rotation.y = t * 4; }));
  },
};

// pega um acessório de outro modelo (ex.: besta do Ladino) e prende no mesmo osso
// tamanho real de cada peça emprestada no corpo realista (maior medida, em metros)
// S-128/S-130: encaixe das peças KayKit (feitas para o boneco cabeçudo) no corpo realista.
// y = altura da base da peça acima do osso da cabeça; k = tamanho extra.
const HEAD_FIT = { Knight_Helmet: { y: -0.075, z: 0.018 }, Mage_Hat: { y: 0.13, z: -0.01 }, Barbarian_Hat: { y: 0.025, z: -0.027 } }; // S-263: o gorro de urso desce e abraça a cabeça (antes ficava empoleirado no topo)
// tamanho real (maior medida, em metros) e "afinamento" das armas: as do KayKit são largas e grossas demais para mãos de verdade
const ITEM_LEN = { '1H_Sword': 0.88, '2H_Sword': 1.3, '1H_Axe': 0.68, '2H_Axe': 1.15, '1H_Axe_Offhand': 0.68, Knife: 0.34, Knife_Offhand: 0.34, '2H_Staff': 1.48, '1H_Wand': 0.42, '1H_Crossbow': 0.6, '2H_Crossbow': 0.85, Spellbook: 0.26, Spellbook_open: 0.36, Mug: 0.16, Throwable: 0.2,
  Round_Shield: 0.56, Rectangle_Shield: 0.62, Badge_Shield: 0.6, Spike_Shield: 0.58, Barbarian_Round_Shield: 0.58, '1H_Sword_Offhand': 0.88, Knight_Helmet: 0.315, Mage_Hat: 0.38, Barbarian_Hat: 0.378 };
const ITEM_THIN = { '1H_Sword': 0.5, '2H_Sword': 0.55, '1H_Sword_Offhand': 0.5, Knife: 0.65, Knife_Offhand: 0.65, '1H_Axe': 0.72, '2H_Axe': 0.72, '1H_Axe_Offhand': 0.72, '1H_Wand': 0.7 };
const _v = () => new THREE.Vector3();
const CROSSBOW_FLIP = 1; // (testado) qual ponta da besta vai para a frente
// S-128/S-130: debaixo de chapéu/elmo o cabelo não pode empurrar a peça para cima (ela ficava "flutuando"):
// o cabelo curto some sob a peça; o comprido continua aparecendo por baixo (as pontas saem pela nuca)
/* S-307: rosto convidativo para os NPCs. A cabeça base (Quaternius) tem pálpebra pesada, sobrancelha baixa e boca caída —
   parecia "carrancuda". Sem morphs na malha, a expressão é esculpida nos vértices (pose de repouso): sobe e desfranze as
   sobrancelhas (o meio sobe mais), abre um pouco a pálpebra de cima e ergue de leve os cantos da boca e as maçãs.
   Pontos de referência medidos na própria malha (olhos), então vale para homem, mulher e anão. Cache por geometria de origem. */
const _softCache = new Map();
export function softenFace(root, o = {}) {
  let head = null, eyes = null; const brows = [];
  root.traverse(m => { if (!m.isSkinnedMesh) return; if (/^Super[Hh]ero_/.test(m.name)) head = m; else if (m.name === 'Eyes') eyes = m; else if (/^Eyebrows/.test(m.name)) brows.push(m); });
  if (!head || !eyes) return;
  eyes.geometry.computeBoundingBox(); const eb = eyes.geometry.boundingBox, ey = (eb.min.y + eb.max.y) / 2, er = (eb.max.z - eb.min.z) / 2, xe = eb.max.x - er, eyeZ = eb.max.z;
  const female = /Female/.test(head.name), my = ey - (female ? 0.072 : 0.079), K = o.k ?? 1;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const sculpt = (mesh, fn) => {
    const key = mesh.geometry.uuid + ':' + K; let g = _softCache.get(key);
    if (!g) { g = mesh.geometry.clone(); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), d = fn(x, y, z); if (d) P.setXYZ(i, x + d[0] * K, y + d[1] * K, z + d[2] * K); } P.needsUpdate = true; g.computeBoundingSphere(); _softCache.set(key, g); _softCache.set(g.uuid + ':' + K, g); }
    mesh.geometry = g;
  };
  sculpt(head, (x, y, z) => {
    if (z < 0.02 || y < my - 0.04 || y > ey + 0.06 || Math.abs(x) > 0.08) return null;
    let dx = 0, dy = 0, dz = 0;
    // testa/sobrancelha: sobe (o meio mais — desfranze)
    const wb = sm(ey + 0.004, ey + 0.02, y) * (1 - sm(ey + 0.03, ey + 0.05, y)) * (1 - sm(0.05, 0.075, Math.abs(x)));
    dy += wb * (0.0026 + 0.0022 * (1 - sm(0, 0.03, Math.abs(x))));
    // pálpebra de cima: abre um pouco (olhar mais vivo, menos "sonolento/bravo")
    for (const s of [-1, 1]) { const r = Math.hypot((x - s * xe) / 0.021, (y - (ey + 0.007)) / 0.0095); if (r < 1 && z > eyeZ - 0.03) { const w = (1 - r * r) ** 2; dy += 0.0017 * w; } }
    // cantos da boca para cima e um tiquinho para trás/fora (sorriso leve, sem careta)
    for (const s of [-1, 1]) { const r = Math.hypot((x - s * 0.022) / 0.015, (y - my) / 0.011); if (r < 1 && z > 0.05) { const w = (1 - r * r) ** 2; dy += 0.0021 * w; dz -= 0.0009 * w; dx += s * 0.0007 * w; } }
    // maçãs do rosto sobem de leve (acompanha o sorriso)
    for (const s of [-1, 1]) { const r = Math.hypot((x - s * 0.036) / 0.02, (y - (my + 0.032)) / 0.016); if (r < 1 && z > 0.04) dy += 0.0011 * (1 - r * r) ** 2; }
    return dy || dx || dz ? [dx, dy, dz] : null;
  });
  for (const b of brows) sculpt(b, (x, y, z) => [0, 0.0032 + 0.0028 * (1 - sm(0, 0.032, Math.abs(x))), 0.0004]); // sobrancelhas relaxadas, sem "V" no meio
}
/* S-306: cabelo aparecendo sob o véu (risca no meio e duas mechas emoldurando a testa), feito em código sobre a cabeça */
function veilFringe(root) {
  // usa o próprio cabelo da personagem, "encolhido" para caber sob o véu: tudo que sairia do véu é puxado para perto da cabeça
  // (o véu fica 2,6 cm fora da cabeça), então só aparece o cabelo da testa e das têmporas — nada atravessa o tecido
  let hair = null, head = null; root.traverse(m => { if (!m.isSkinnedMesh) return; if (!hair && /^Hair_/.test(m.name) && !/Beard/.test(m.name)) hair = m; if (/^Super[Hh]ero_/.test(m.name)) head = m; });
  if (!hair || !head) return;
  const pts = sampleBody(root, ['Head'], /SuperHero/i); if (!pts.length) return;
  const bb = new THREE.Box3(); for (const q of pts) bb.expandByPoint(q);
  const top = bb.max.y, c = new THREE.Vector3((bb.min.x + bb.max.x) / 2, top - 0.095, (bb.min.z + bb.max.z) / 2);
  let R = 0; for (const q of pts) if (q.y > c.y - 0.02) R = Math.max(R, q.distanceTo(c)); R += 0.009;
  const g = hair.geometry.clone(), P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.set(P.getX(i), P.getY(i), P.getZ(i));
    if (v.y < c.y - 0.05) v.y = c.y - 0.05 + (v.y - (c.y - 0.05)) * 0.08; // mechas compridas sobem para dentro do véu
    const d = v.clone().sub(c), L = d.length(); if (L > R) v.copy(c).add(d.multiplyScalar(R / L));
    P.setXYZ(i, v.x, v.y, v.z);
  }
  P.needsUpdate = true; g.computeBoundingSphere();
  hair.geometry = g; hair.visible = true;
}
export function hairUnderHat(root, tight = false) {
  root.traverse(o => { if (o.isSkinnedMesh && /^Hair_/.test(o.name) && !/Beard/.test(o.name) && (tight || !/Long/.test(o.name))) o.visible = false; });
}
// prende "holder" ao osso b de modo que, na pose parada, ele fique com a orientação/posição pedidas (no espaço do personagem)
function fitToBone(root, b, holder, quatInRoot, posInRoot) {
  const rq = root.getWorldQuaternion(new THREE.Quaternion()), bq = b.getWorldQuaternion(new THREE.Quaternion());
  holder.quaternion.copy(bq.invert().multiply(rq.multiply(quatInRoot)));
  const wp = posInRoot.clone(); root.localToWorld(wp); holder.position.copy(b.worldToLocal(wp));
}
const rootPos = (root, o) => root.worldToLocal(o.getWorldPosition(_v()));
// S-304: onde fica o cabo dentro do punho fechado (espaço do personagem, pose parada): C = centro do punho (meio das falanges dobradas, puxado
// para a palma), A = eixo do cabo (do mindinho para o indicador, um pouco para a frente), E = direção do fio (do pulso para o punho, perpendicular a A)
// ponto do cabo segurado pela mão, no espaço da peça KayKit (y = comprimento; o pomo fica no y negativo)
const GRIP_Y = { '1H_Sword': -0.17, '1H_Sword_Offhand': -0.17, '2H_Sword': -0.16, '1H_Axe': -0.12, '1H_Axe_Offhand': -0.12, '2H_Axe': -0.2, Knife: -0.1, Knife_Offhand: -0.1, '1H_Wand': -0.12 };
function fistFrame(root, s) {
  const hand = bone(root, 'hand_' + s), fb = ['index', 'middle', 'ring', 'pinky'].map(n => bone(root, n + '_02_' + s)).filter(Boolean), i1 = bone(root, 'index_01_' + s), p1 = bone(root, 'pinky_01_' + s);
  if (!hand || fb.length < 4 || !i1 || !p1) return null;
  root.updateMatrixWorld(true);
  const wrist = rootPos(root, hand), C = fb.reduce((a, b) => a.add(rootPos(root, b)), new THREE.Vector3()).multiplyScalar(0.25).lerp(wrist, 0.22);
  const A = rootPos(root, i1).sub(rootPos(root, p1)).normalize().lerp(new THREE.Vector3(0, 0, 1), 0.2).normalize();
  const E = C.clone().sub(wrist); E.sub(A.clone().multiplyScalar(E.dot(A))).normalize();
  return { C, A, E };
}
// caneca de madeira de verdade (aduelas, aros de ferro e alça), em pé na mão
function tankard() {
  const g = new THREE.Group(), wood = std('#7a5232', { roughness: 0.8 }), iron = std('#3a3632', { metalness: 0.7, roughness: 0.45 }), beer = std('#d89a2a', { roughness: 0.3 }), foam = std('#f4ecd8', { roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.047, 0.12, 20, 1, true), wood); body.position.y = 0.06; g.add(body);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, st = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.118, 0.004), std('#5e3e24')); st.position.set(Math.cos(a) * 0.046, 0.06, Math.sin(a) * 0.046); g.add(st); } // frestas das aduelas
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.008, 20), wood); bottom.position.y = 0.004; g.add(bottom);
  for (const y of [0.02, 0.1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0465 - (y > 0.05 ? 0.002 : 0), 0.004, 8, 28), iron); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.006, 20), beer); top.position.y = 0.108; g.add(top);
  const fo = new THREE.Mesh(new THREE.SphereGeometry(0.042, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), foam); fo.scale.y = 0.35; fo.position.y = 0.112; g.add(fo);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 18, Math.PI * 1.2), wood); handle.rotation.z = -Math.PI * 0.6; handle.position.set(0.05, 0.062, 0); g.add(handle);
  return g;
}
// pega a peça pronta (arma, escudo, elmo) e prende no osso certo do corpo realista, no tamanho real
export function humanBorrow(root, MODELS, model, itemName, extraScale = 1) {
  const src = MODELS[model] && MODELS[model].scene.getObjectByName(itemName); if (!src && itemName !== 'Mug') return null;
  const slot = src && src.parent ? src.parent.name : 'handslot.r', isHead = /hat|helmet/i.test(itemName), b = bone(root, isHead ? 'head' : slot) || root;
  const left = /\.l$|l$/.test(slot) && !isHead, isShield = /Shield/.test(itemName) && !/Sword/.test(itemName);
  if (isShield) return strapShield(root, codeShield(/Badge/.test(itemName) ? 'cavaleiro' : 'madeira')); // S-195: escudos do pacote eram toscos — agora feitos em código, presos ao antebraço
  if (!isHead) humanIdlePose(root); // encaixa na pose parada (não na pose em T do arquivo)
  root.updateMatrixWorld(true);
  const holder = new THREE.Group(); b.add(holder);
  if (itemName === 'Mug') { // caneca em pé na palma
    const c = tankard(); holder.add(c);
    const kn = bone(root, /_l$|\.l$|l$/.test(slot) ? 'middle_01_l' : 'middle_01_r'), at = kn ? rootPos(root, kn) : rootPos(root, b).add(new THREE.Vector3(0, -0.08, 0));
    fitToBone(root, b, holder, new THREE.Quaternion(), at.add(new THREE.Vector3(0, -0.055, 0.035))); // o corpo da caneca dentro da mão fechada
    root.userData.items = root.userData.items || {}; root.userData.items[itemName] = c; return c;
  }
  const c = src.clone(true); c.visible = true; c.position.set(0, 0, 0); c.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(c), size = box.getSize(new THREE.Vector3()), len = Math.max(size.x, size.y, size.z) || 1;
  const k = (ITEM_LEN[itemName] || 0.6) / len * extraScale;
  holder.add(c);
  const ws = new THREE.Vector3(); b.getWorldScale(ws);
  const headK = isHead ? (b.scale.x || 1) : 1; // S-263: cabeça maior (anão) = chapéu/elmo maior junto
  holder.scale.setScalar(k * headK / ws.x);
  const thin = ITEM_THIN[itemName]; if (thin) { const ax = size.x === len ? 'x' : size.y === len ? 'y' : 'z'; for (const a of ['x', 'y', 'z']) if (a !== ax) c.scale[a] *= thin; } // lâmina mais fina e estreita
  if (isHead) { // chapéu/elmo: em pé sobre a cabeça
    // (o eixo "y" do osso da cabeça não é o "para cima" do corpo: a altura é medida no espaço do personagem)
    humanIdlePose(root);
    const fit = HEAD_FIT[itemName] || { y: 0.16 }, hp = rootPos(root, b);
    fitToBone(root, b, holder, new THREE.Quaternion(), hp.add(new THREE.Vector3(0, fit.y * headK, (fit.z ?? 0) * headK)));
    const ctr = box.getCenter(new THREE.Vector3()); c.position.set(-ctr.x, -box.min.y, -ctr.z);
    hairUnderHat(root);
  } else if (isShield) { // escudo preso no antebraço, de face para fora e um pouco para a frente (como se segura de verdade)
    const fore = bone(root, left ? 'lowerarm_l' : 'lowerarm_r') || b; fore.add(holder); holder.scale.setScalar(k / fore.getWorldScale(_v()).x);
    const elbow = rootPos(root, fore), wrist = rootPos(root, b), side = Math.sign(wrist.x || 1);
    const n = new THREE.Vector3(side, 0, 0.45).normalize(), up = wrist.clone().sub(elbow).multiplyScalar(-1).normalize(); up.sub(n.clone().multiplyScalar(up.dot(n))).normalize();
    const xA = new THREE.Vector3().crossVectors(up, n), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, up, n));
    // a face do escudo (eixo mais fino da peça) vira para fora
    const thinAx = size.z <= size.x && size.z <= size.y ? null : size.x <= size.y ? new THREE.Euler(0, Math.PI / 2, 0) : new THREE.Euler(Math.PI / 2, 0, 0);
    if (thinAx) q.multiply(new THREE.Quaternion().setFromEuler(thinAx));
    fitToBone(root, fore, holder, q, elbow.clone().lerp(wrist, 0.55).add(n.clone().multiplyScalar(0.06)));
    const ctr = box.getCenter(new THREE.Vector3()); c.position.set(-ctr.x, -ctr.y, -box.min.z);
  } else if (/Crossbow/.test(itemName)) { // besta segurada pela coronha, apontando para a frente e para baixo (descansando)
    const keys = ['x', 'y', 'z'].sort((a, b) => size[b] - size[a]), unit = a => new THREE.Vector3(a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0);
    const L = unit(keys[0]), W = unit(keys[1]);
    const dir = new THREE.Vector3(0, -0.55, 1).normalize().multiplyScalar(CROSSBOW_FLIP), side = new THREE.Vector3(1, 0, 0);
    const from = new THREE.Matrix4().makeBasis(L, W, new THREE.Vector3().crossVectors(L, W)), to = new THREE.Matrix4().makeBasis(dir, side, new THREE.Vector3().crossVectors(dir, side));
    const q = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
    const kn = bone(root, left ? 'middle_01_l' : 'middle_01_r'), at = kn ? rootPos(root, kn) : rootPos(root, b);
    fitToBone(root, b, holder, q, at);
    const ctr = box.getCenter(new THREE.Vector3()), cv = ctr.clone(); cv[keys[0]] = box.min[keys[0]] + len * (CROSSBOW_FLIP > 0 ? 0.3 : 0.7); c.position.copy(cv.multiplyScalar(-1)); // mão na coronha (terço de trás)
  } else if (/Staff/.test(itemName)) { // cajado em pé na mão fechada (pose parada), a ponta de cima mais longa
    const ax = size.x === len ? new THREE.Vector3(1, 0, 0) : size.y === len ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(ax, new THREE.Vector3(0, 1, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.08));
    const kn = bone(root, left ? 'middle_01_l' : 'middle_01_r'), at = kn ? rootPos(root, kn).lerp(rootPos(root, b), 0.35) : rootPos(root, b);
    fitToBone(root, b, holder, q, at.add(new THREE.Vector3(0, 0, 0.012)));
    // a ponta mais "pesada" (cabeça do cajado) fica para cima: o cabo é segurado a ~38% do comprimento
    const ctr = box.getCenter(new THREE.Vector3()), cv = ctr.clone(), key = size.x === len ? 'x' : size.y === len ? 'y' : 'z';
    const gripF = Math.max(0.3, Math.min(0.62, (at.y - 0.06) / (ITEM_LEN[itemName] || 1.5))); // S-220: o pé do cajado quase no chão, a mão no cabo
    cv[key] = box.min[key] + len * gripF; c.position.copy(cv.multiplyScalar(-1));
  } else { // S-304: arma DENTRO do punho fechado — o cabo atravessa a mão do mindinho ao indicador, centrado na palma, lâmina saindo pelo lado do polegar
    const F = fistFrame(root, left ? 'l' : 'r');
    if (F) {
      const qc = c.quaternion, X = new THREE.Vector3(1, 0, 0).applyQuaternion(qc), Y = new THREE.Vector3(0, 1, 0).applyQuaternion(qc), Z = new THREE.Vector3(0, 0, 1).applyQuaternion(qc);
      const to = new THREE.Matrix4().makeBasis(F.E, F.A, new THREE.Vector3().crossVectors(F.E, F.A)), from = new THREE.Matrix4().makeBasis(X, Y, Z);
      const qh = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
      const g = new THREE.Vector3(0, GRIP_Y[itemName] ?? -0.12, 0).multiply(c.scale).applyQuaternion(qc); c.position.copy(g.multiplyScalar(-1)); // o ponto do cabo que a mão segura fica no centro do punho
      fitToBone(root, b, holder, qh, F.C);
    } else { holder.rotation.set(0, 0, 0); holder.position.set(left ? -0.015 : 0.015, 0.085, 0.02); }
  }
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items[itemName] = c;
  return c;
}
function borrow(root, MODELS, model, itemName) {
  if (root.userData.human) return humanBorrow(root, MODELS, model, itemName);
  const src = MODELS[model] && MODELS[model].scene.getObjectByName(itemName);
  if (!src) return;
  const target = bone(root, src.parent.name) || root;
  const c = src.clone(true); c.visible = true; target.add(c);
}
// troca a cabeça do modelo de roupa pela cabeça do personagem (mesmo rosto/cabelo em toda classe)
function swapHead(root, MODELS, outfit, headModel) {
  if (outfit === headModel || !HEADS[headModel]) return;
  const own = root.getObjectByName(HEADS[outfit]);
  const src = MODELS[headModel].scene.getObjectByName(HEADS[headModel]);
  if (!own || !src || !src.isSkinnedMesh) return;
  const bones = src.skeleton.bones.map(b => root.getObjectByName(b.name));
  if (bones.some(b => !b)) return;
  const m = new THREE.SkinnedMesh(src.geometry, src.material);
  m.name = 'PlayerHead'; m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
  m.castShadow = true; m.frustumCulled = false;
  own.parent.add(m);
  m.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
  own.visible = false;
}

/* Corpo realista (S-093): pinta a roupa com as cores da classe, põe as armas/acessórios das mãos e os enfeites.
   Devolve { style, update(t) } como dress(). */
const HUMAN_SKIP_EXTRAS = new Set(['belt']);
export const CLASS_OUTFIT = { aprendiz: 'campones', guerreiro: 'patrulheiro', cavaleiro_runico: 'patrulheiro', guardiao_sagrado: 'patrulheiro', mago: 'campones', arquimago: 'campones', sabio_elemental: 'campones', arqueiro: 'patrulheiro', cacador: 'patrulheiro', menestrel: 'campones', ladino: 'patrulheiro', lamina_sombria: 'patrulheiro', saqueador: 'campones' };
export function dressHuman(ch, cls, MODELS, opts = {}) {
  const L = CLASS_LOOKS[cls] || CLASS_LOOKS.aprendiz, root = ch.root, fx = [];
  root.userData.human = true; root.userData.anim = ch.anim; // os efeitos de classe sabem o que o corpo está fazendo (ex.: conjurando)
  if (ch.anim && ch.anim.overlay && !ch.anim._ovWrap) { const ov = ch.anim.overlay.bind(ch.anim); ch.anim.overlay = (...a) => { root.userData.ovT = performance.now(); return ov(...a); }; ch.anim._ovWrap = true; }
  const t = L.tint || {}, mix = (m, hex, k) => { m.material = m.material.clone(); m.material.color = new THREE.Color('#ffffff').lerp(new THREE.Color(hex), k); };
  root.traverse(o => {
    if (!o.isSkinnedMesh || !/_(Body|Legs|Arms|Feet|Acc|Head_Hood)/.test(o.name)) return;
    if (/Body|Head_Hood/.test(o.name) && t.body) mix(o, t.body, 0.55);
    else if (/Legs/.test(o.name) && t.legs) mix(o, t.legs, 0.45);
  });
  // tudo que a classe segura ou veste (arma, escudo, livro...)
  const items = [...(L.show || []).filter(n => !/_Cape$|_Hat$|_Helmet$/.test(n)).map(n => [L.outfit, n]), ...(L.borrow || [])];
  for (const [model, item] of items) { const src = Object.keys(MODELS).find(k => MODELS[k] && MODELS[k].scene && MODELS[k].scene.getObjectByName(item)); humanBorrow(root, MODELS, MODELS[model] && MODELS[model].scene.getObjectByName(item) ? model : src, item); }
  for (const [name, c] of Object.entries(L.glow || {})) { const o = root.userData.items && root.userData.items[name]; if (o) o.traverse(m => m.isMesh && glowMesh(m, c)); }
  for (const e of L.extras || []) if (EXTRAS[e] && !HUMAN_SKIP_EXTRAS.has(e)) EXTRAS[e](root, fx); // a roupa realista já tem cinto, aljava etc. de verdade
  // round 15: armadura sob medida, arco e adaga de verdade; escudo SÓ se estiver equipado (S-202: vale para todas as classes)
  if (L.armor) applyArmor(root, L.armor, fx);
  if (L.bow) holdBow(root, codeBow(L.bow));
  // katar: o Executor usa o par de katares (opts.wtype permite trocar pela adaga quando a arma equipada não for katar)
  if (L.katar && (!opts.wtype || opts.wtype === 'katar')) holdKatars(root, { ...L.katar, ...katarLook(opts.weaponId) });
  else if (L.dagger) holdDagger(root, codeDagger(L.dagger));
  if (L.staff) holdStaff(root, codeStaff(L.staff), fx, ch); // S-315: cajado dentro do punho, braço dobrado fora dos golpes
  if (L.book) holdBook(root, codeBook(), fx); // S-314: livro do Sábio segurado pela lombada na mão esquerda
  if (opts.offhand) strapShield(root, codeShield(SHIELD_KIND[opts.offhand] || (/paladino|guardiao/.test(cls) ? 'cavaleiro' : 'madeira')));
  // S-147: sem a capa chapada nas costas (não combina com o corpo realista) — vale para todas as classes
  return { style: L.style, update: tt => fx.forEach(f => f(tt)) };
}
/* Veste o personagem: devolve { style, update(t) } */
export function dress(ch, cls, MODELS, headModel = 'Knight') {
  const L = CLASS_LOOKS[cls] || CLASS_LOOKS.aprendiz, root = ch.root, fx = [];
  swapHead(root, MODELS, L.outfit, headModel);
  for (const [model, item] of L.borrow || []) borrow(root, MODELS, model, item);
  for (const [name, s] of Object.entries(L.scale || {})) { const o = root.getObjectByName(name); if (o) o.scale.multiplyScalar(s); }
  const t = L.tint || {};
  root.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const n = o.name;
    if (t.body && /_Body$/.test(n)) tintMesh(o, t.body);
    else if (t.legs && /_Leg(Left|Right)$/.test(n)) tintMesh(o, t.legs);
    else if (t.cape && /_Cape$/.test(n)) tintMesh(o, t.cape);
    else if (t.hat && /_Hat$/.test(n)) tintMesh(o, t.hat);
    else if (t.helmet && /_Helmet$/.test(n)) tintMesh(o, t.helmet, 0.7);
  });
  for (const [name, c] of Object.entries(L.glow || {})) { const o = root.getObjectByName(name); if (o) glowMesh(o, c); }
  for (const e of L.extras || []) if (EXTRAS[e]) EXTRAS[e](root, fx);
  return { style: L.style, update: tt => fx.forEach(f => f(tt)) };
}

/* ---------- rostos mais simpáticos ----------
   As cabeças do pacote vêm com sobrancelhas franzidas (cara de bravo) e nariz grande.
   Aqui, uma única vez ao carregar, nivelamos e erguemos as sobrancelhas e diminuímos o nariz.
   As peças do rosto são "ilhas" separadas da malha: nariz (no centro), olhos e sobrancelhas (pares). */
export function friendlyFaces(MODELS) {
  const done = new Set();
  for (const model of Object.keys(HEADS)) {
    const head = MODELS[model] && MODELS[model].scene.getObjectByName(HEADS[model]);
    if (!head || !head.geometry || done.has(head.geometry)) continue;
    done.add(head.geometry);
    const g = head.geometry, P = g.attributes.position, idx = g.index ? g.index.array : null, n = P.count;
    const par = new Int32Array(n).map((_, i) => i);
    const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const un = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
    if (idx) for (let i = 0; i < idx.length; i += 3) { un(idx[i], idx[i + 1]); un(idx[i + 1], idx[i + 2]); }
    const seen = new Map();
    for (let i = 0; i < n; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); if (seen.has(k)) un(i, seen.get(k)); else seen.set(k, i); }
    const groups = {};
    for (let i = 0; i < n; i++) (groups[f(i)] = groups[f(i)] || []).push(i);
    const comps = Object.values(groups).map(vs => {
      const b = { vs, x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
      for (const i of vs) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); }
      b.cx = (b.x0 + b.x1) / 2; b.cy = (b.y0 + b.y1) / 2; return b;
    }).sort((a, b) => b.vs.length - a.vs.length);
    const face = comps.slice(1).filter(c => c.z1 > 0.2 && c.vs.length < 200); // peças pequenas na frente
    const nose = face.filter(c => Math.abs(c.cx) < 0.03).sort((a, b) => b.z1 - a.z1)[0];
    const right = face.filter(c => c.cx > 0.05).sort((a, b) => a.cy - b.cy); // de baixo para cima: olho, sobrancelha
    if (nose) for (const i of nose.vs) { // nariz menor e menos pontudo
      const cz = nose.z0, cyn = nose.cy;
      P.setXYZ(i, P.getX(i) * 0.8, cyn + (P.getY(i) - cyn) * 0.75, cz + (P.getZ(i) - cz) * 0.7);
    }
    if (right.length >= 2) {
      const eyeY = right[0].cy;
      for (const brow of face.filter(c => Math.abs(c.cx) > 0.05 && c.cy > eyeY + 0.03)) {
        // inclinação atual (regressão de y por x) → deixa reta e sobe um pouco
        let sx = 0, sy = 0, sxx = 0, sxy = 0; const m = brow.vs.length;
        for (const i of brow.vs) { const x = P.getX(i), y = P.getY(i); sx += x; sy += y; sxx += x * x; sxy += x * y; }
        const slope = (m * sxy - sx * sy) / Math.max(1e-6, m * sxx - sx * sx), mx = sx / m;
        for (const i of brow.vs) { const x = P.getX(i); P.setY(i, P.getY(i) - slope * (x - mx) * 1.25 + 0.025); }
      }
    }
    P.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
    // olhos mais humanos: esclera branca, íris menor e um brilho (tudo dentro da malha da cabeça)
    if (right.length >= 1) {
      const eyeY = right[0].cy, eyes = face.filter(c => Math.abs(c.cx) > 0.05 && Math.abs(c.cy - eyeY) < 0.03);
      const white = paletteUV(head, c => c[0] > 232 && c[1] > 232 && c[2] > 228);
      if (white && eyes.length) {
        const extra = [];
        for (const e of eyes) {
          const cx = e.cx, cy = e.cy, rx = (e.x1 - e.x0) / 2, ry = (e.y1 - e.y0) / 2, zf = e.z1;
          const ir = Math.min(rx, ry) * 0.72; for (const i of e.vs) P.setXYZ(i, cx + (P.getX(i) - cx) * ir / rx, cy + (P.getY(i) - cy) * ir / ry - ry * 0.04, P.getZ(i) + 0.004); // íris redonda
          const sc = new THREE.SphereGeometry(1, 20, 14); sc.scale(rx * 1.02, ry * 0.92, Math.min(rx, ry) * 0.55); sc.translate(cx, cy, zf - Math.min(rx, ry) * 0.5); extra.push(sc);
          const hl = new THREE.SphereGeometry(1, 20, 14); hl.scale(rx * 0.17, rx * 0.17, rx * 0.1); hl.translate(cx + rx * 0.22, cy + ry * 0.12, zf + 0.02); extra.push(hl);
        }
        const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, i0 = eyes[0].vs[0];
        const parts = extra.map(x => {
          const n = x.attributes.position.count;
          x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2).map((_, k) => k % 2 ? white[1] : white[0]), 2));
          const a = new (si.array.constructor)(n * 4), b = new Float32Array(n * 4);
          for (let v = 0; v < n; v++) for (let k = 0; k < 4; k++) { a[v * 4 + k] = si.getComponent(i0, k); b[v * 4 + k] = sw.getComponent(i0, k); }
          x.setAttribute('skinIndex', new THREE.BufferAttribute(a, 4)); x.setAttribute('skinWeight', new THREE.BufferAttribute(b, 4));
          return x;
        });
        P.needsUpdate = true;
        const merged = mergeGeometries([g, ...parts]);
        if (merged) { merged.computeBoundingSphere(); head.geometry = merged; }
      }
    }
  }
}
// acha na textura (paleta de cores) um pixel que passe no teste e devolve o UV dele
function paletteUV(mesh, test) {
  try {
    const img = mesh.material.map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    for (let py = 2; py < c.height; py += 4) for (let px = 2; px < c.width; px += 4) { const k = (py * c.width + px) * 4; if (test([d[k], d[k + 1], d[k + 2]])) return [(px + 0.5) / c.width, mesh.material.map.flipY ? 1 - (py + 0.5) / c.height : (py + 0.5) / c.height]; }
  } catch (e) { }
  return null;
}

/* ---------- raças (por enquanto só visual) ---------- */
export const RACES = {
  humano: { name: 'Humano', icon: '🧑', desc: 'Versáteis e determinados. Se adaptam a qualquer caminho.', hint: 'Equilibrado' },
  elfo: { name: 'Elfo', icon: '🧝', desc: 'Ágeis e ligados à magia da floresta. Orelhas pontudas, porte esguio.', hint: 'Ágil e místico' },
  anao: { name: 'Anão', icon: '🧔', desc: 'Robustos e teimosos como rocha. Mais baixos, fortes e barbudos.', hint: 'Resistente' },
};
function visibleHead(root) { let h = null; root.traverse(o => { if (o.isSkinnedMesh && o.visible && (o.name === 'PlayerHead' || /_Head(_Hooded)?$/.test(o.name))) h = o; }); return h; }
function islands(g) {
  const P = g.attributes.position, idx = g.index ? g.index.array : null, n = P.count, par = new Int32Array(n).map((_, i) => i);
  const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const un = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
  if (idx) for (let i = 0; i < idx.length; i += 3) { un(idx[i], idx[i + 1]); un(idx[i + 1], idx[i + 2]); }
  const seen = new Map();
  for (let i = 0; i < n; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); if (seen.has(k)) un(i, seen.get(k)); else seen.set(k, i); }
  const gr = {}; for (let i = 0; i < n; i++) (gr[f(i)] = gr[f(i)] || []).push(i);
  return Object.values(gr).map(vs => { const b = { vs, x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 }; for (const i of vs) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); } b.cx = (b.x0 + b.x1) / 2; b.cy = (b.y0 + b.y1) / 2; return b; });
}
function hairColor(head) { // cor das sobrancelhas na textura
  try {
    const g = head.geometry, U = g.attributes.uv, img = head.material.map.image;
    const brow = islands(g).filter(c => c.cx > 0.05 && c.z1 > 0.2 && c.vs.length < 200).sort((a, b) => b.cy - a.cy)[0];
    const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d');
    const i = brow.vs[0], u = U.getX(i), v = U.getY(i);
    x.drawImage(img, Math.floor(u * img.width), Math.floor((head.material.map.flipY ? 1 - v : v) * img.height), 1, 1, 0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255).convertSRGBToLinear();
  } catch (e) { return new THREE.Color('#7a5a3a'); }
}
export function applyRace(ch, race) {
  if (!race || race === 'humano') return;
  const head = visibleHead(ch.root); if (!head) return;
  if (race === 'elfo') {
    const g = head.geometry.clone(), P = g.attributes.position;
    for (const ear of islands(g).filter(c => Math.abs(c.cx) > 0.3 && c.z1 < 0.25 && c.vs.length < 200)) {
      const s = Math.sign(ear.cx);
      for (const i of ear.vs) { const t = Math.max(0, (P.getY(i) - ear.y0) / (ear.y1 - ear.y0)); P.setXYZ(i, P.getX(i) + s * t * t * 0.18, P.getY(i) + t * t * 0.32, P.getZ(i) - t * t * 0.1); }
    }
    P.needsUpdate = true; g.computeVertexNormals(); head.geometry = g;
    ch.obj.scale.set(0.96, 1.05, 0.96);
  } else if (race === 'anao') {
    ch.obj.scale.set(1.1, 0.86, 1.1);
    // barba: malha presa ao mesmo esqueleto da cabeça (peso total no osso da cabeça)
    const hg = head.geometry, si = hg.attributes.skinIndex, sw = hg.attributes.skinWeight;
    const parts = [];
    const bl = new THREE.SphereGeometry(0.3, 20, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65); bl.scale(1.25, 1.1, 0.75); bl.translate(0, 1.32, 0.24); parts.push(bl);
    const tip = new THREE.ConeGeometry(0.2, 0.32, 14); tip.rotateX(Math.PI); tip.translate(0, 1.02, 0.36); parts.push(tip);
    for (const s of [-1, 1]) { const m = new THREE.CapsuleGeometry(0.06, 0.16, 4, 8); m.rotateZ(s * 1.2); m.translate(s * 0.12, 1.42, 0.46); parts.push(m); } // bigode
    const geo = new THREE.BufferGeometry();
    const merged = parts.map(p => p.index ? p.toNonIndexed() : p);
    const pos = [], nor = [];
    for (const p of merged) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const nv = pos.length / 3, sIdx = new Uint16Array(nv * 4), sW = new Float32Array(nv * 4);
    let hb = 0, best = -1; for (let k = 0; k < 4; k++) if (sw.getComponent(0, k) > best) { best = sw.getComponent(0, k); hb = si.getComponent(0, k); }
    for (let v = 0; v < nv; v++) { sIdx[v * 4] = hb; sW[v * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4));
    geo.computeVertexNormals();
    const beard = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color: ch.root.userData.hairColor ? new THREE.Color(ch.root.userData.hairColor) : hairColor(head).multiplyScalar(0.85), roughness: 0.9, flatShading: false }));
    beard.name = 'RaceBeard'; beard.position.copy(head.position); beard.quaternion.copy(head.quaternion); beard.scale.copy(head.scale);
    beard.castShadow = true; beard.frustumCulled = false; head.parent.add(beard); beard.bind(head.skeleton, head.bindMatrix);
  }
}

/* ---------- skins (só visual, compradas com Auroras ✦) ---------- */
export const RARITY = {
  comum: { name: 'Comum', color: '#b8c4d0' }, rara: { name: 'Rara', color: '#5aa8ff' },
  epica: { name: 'Épica', color: '#b47aff' }, lendaria: { name: 'Lendária', color: '#ffb84a' },
};
export const SKINS = {
  campones: { name: 'Traje do Campo', rarity: 'comum', price: 150, desc: 'Tons de terra e linho, para quem gosta do simples.', tint: { body: '#a8865a', legs: '#6a5236', cape: '#8a6a44', hat: '#c9a46a' } },
  marinho: { name: 'Uniforme Marinho', rarity: 'comum', price: 150, desc: 'Azul e branco, como os guardas do porto.', tint: { body: '#2f5a9a', legs: '#e8e8ee', cape: '#1f3a6a', hat: '#2f5a9a' } },
  floral: { name: 'Primavera Florida', rarity: 'rara', price: 350, desc: 'Verde-folha e rosa-pétala, bordado com flores.', tint: { body: '#4f9a4a', legs: '#2f6a3a', cape: '#ff8ab8', hat: '#ff9ac8' } },
  glacial: { name: 'Coração Glacial', rarity: 'rara', price: 350, desc: 'Azul-gelo e branco, como o inverno do Vale da Geada.', tint: { body: '#9fd8ff', legs: '#3a6a9a', cape: '#cfefff', hat: '#9fd8ff', helmet: '#cfefff' } },
  sombrio: { name: 'Manto do Eclipse', rarity: 'epica', price: 750, desc: 'Negro e roxo profundo, para quem caminha nas sombras.', tint: { body: '#2a2238', legs: '#1a1624', cape: '#5a2a8a', hat: '#2a2238', helmet: '#3a2a5a' } },
  brasa: { name: 'Coração de Brasa', rarity: 'epica', price: 750, desc: 'Vermelho-fogo e couro escuro, cor de brasa.', tint: { body: '#a8301e', legs: '#3a1a14', cape: '#ff6a2a', hat: '#a8301e', helmet: '#5a2a1a' } },
  real: { name: 'Majestade Dourada', rarity: 'lendaria', price: 1500, desc: 'Branco e ouro, digno de uma corte real.', tint: { body: '#f2ead8', legs: '#c9a14a', cape: '#ffd76a', hat: '#ffd76a', helmet: '#ffe9a8' } },
  estelar: { name: 'Viajante Estelar', rarity: 'lendaria', price: 1500, desc: 'Azul-noite profundo, como o céu de inverno.', tint: { body: '#1a2050', legs: '#10142e', cape: '#3a3aa8', hat: '#1a2050', helmet: '#2a3070' } },
};
export function applySkin(ch, id) {
  const S = SKINS[id]; if (!S) return null;
  const t = S.tint, root = ch.root;
  root.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const n = o.name;
    if (t.body && /_Body$/.test(n)) tintMesh(o, t.body);
    else if (t.legs && /_Leg(Left|Right)$/.test(n)) tintMesh(o, t.legs);
    else if (t.cape && /_Cape$/.test(n)) tintMesh(o, t.cape);
    else if (t.hat && /_Hat$/.test(n)) tintMesh(o, t.hat);
    else if (t.helmet && /_Helmet$/.test(n)) tintMesh(o, t.helmet, 0.7);
  });
  return null; // S-241: skin é só roupa (cores e brilho do tecido) — sem auréola nem partículas
  // (código antigo da aura mantido abaixo, não é mais usado)
  // aura: partículas ao redor do personagem (presas no objeto, não no osso)
  const g = new THREE.Group(); ch.obj.add(g);
  const c = new THREE.Color(S.aura.color), N = S.aura.kind === 'luz' ? 10 : 14;
  const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = S.aura.kind === 'flocos' || S.aura.kind === 'estrelas' ? new THREE.OctahedronGeometry(0.05, 0) : S.aura.kind === 'petalas' ? new THREE.SphereGeometry(0.045, 20, 14) : new THREE.SphereGeometry(0.04, 20, 14);
  const ps = []; for (let i = 0; i < N; i++) { const p = new THREE.Mesh(geo, m); g.add(p); ps.push({ p, o: i / N }); }
  let halo = null; if (S.aura.kind === 'luz') { halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 10, 28), m); halo.rotation.x = Math.PI / 2; halo.position.y = 2.05; g.add(halo); }
  if (S.aura.light) { const l = vlight(c, 1.2, 4); l.position.y = 1.2; g.add(l); }
  const k = S.aura.kind;
  return t => ps.forEach(({ p, o }) => {
    const ph = (t * (k === 'fumaça' ? 0.35 : 0.5) + o) % 1, a = o * Math.PI * 2 + t * (k === 'estrelas' ? 0.9 : 1.6);
    if (k === 'petalas' || k === 'flocos') p.position.set(Math.cos(a) * 0.7, 2.2 - ph * 2.2, Math.sin(a) * 0.7);
    else if (k === 'fumaça') p.position.set(Math.cos(a) * (0.35 + ph * 0.3), ph * 0.8, Math.sin(a) * (0.35 + ph * 0.3));
    else if (k === 'faíscas') p.position.set(Math.cos(a) * 0.45, ph * 2, Math.sin(a) * 0.45);
    else if (k === 'estrelas') p.position.set(Math.cos(a) * 0.85, 1.0 + Math.sin(a * 2 + t) * 0.4, Math.sin(a) * 0.85);
    else p.position.set(Math.cos(a) * 0.55, 0.3 + ph * 1.8, Math.sin(a) * 0.55);
    p.scale.setScalar(k === 'fumaça' ? 1.6 - ph : 1 - ph * 0.6);
    if (halo) halo.rotation.z = t;
  });
}

/* =========================================================================
   CABELOS PERSONALIZÁVEIS — cabeça careca (Barbarian) + corte feito em código.
   A cor do cabelo também pinta sobrancelhas e barba (no shader). O corte
   nasce da própria forma do crânio, então encaixa certinho.
   look = { race, hair: { style, color }, beard: true|false }
   ========================================================================= */
export const HAIR_STYLES = {
  curto: { name: 'Curto', icon: '✂️' },
  topete: { name: 'Topete', icon: '🌊' },
  espetado: { name: 'Espetado', icon: '⚡' },
  moicano: { name: 'Moicano', icon: '🦔' },
  franja: { name: 'Franja', icon: '💇' },
  rabo: { name: 'Rabo de cavalo', icon: '🎀' },
  coque: { name: 'Coque', icon: '🍙' },
  longo: { name: 'Longo', icon: '🌾' },
  careca: { name: 'Careca', icon: '🥚' },
  raspado: { name: 'Raspado', icon: '🪒' },
};
export const HAIR_COLORS = {
  preto: { name: 'Preto', hex: '#1d1814' }, castanho_escuro: { name: 'Castanho-escuro', hex: '#3d2617' }, castanho: { name: 'Castanho', hex: '#6e4426' },
  ruivo: { name: 'Ruivo', hex: '#a63c1a' }, acobreado: { name: 'Acobreado', hex: '#c06a30' }, loiro: { name: 'Loiro', hex: '#d8b468' },
  platinado: { name: 'Platinado', hex: '#ece2c6' }, grisalho: { name: 'Grisalho', hex: '#9b968f' }, branco: { name: 'Branco', hex: '#f3f1ec' },
  azul: { name: 'Azul', hex: '#2f63c4' }, rosa: { name: 'Rosa', hex: '#e27aa9' }, verde: { name: 'Verde', hex: '#3f8c4c' }, roxo: { name: 'Roxo', hex: '#6c3fae' },
};
export const DEFAULT_LOOK = { race: 'humano', hair: { style: 'curto', color: 'castanho' }, beard: false, face: 'sereno' };

/* ---------- rostos (S-073): 5 rostos humanos feitos em 3D sobre a cabeça lisa ----------
   Cada rosto combina olhos (tamanho, inclinação, pálpebra, cor da íris), sobrancelhas,
   nariz de verdade (dorso, ponta, asas e narinas), lábios e o formato do queixo. */
export const FACE_TYPES = {
  sereno: { name: 'Sereno', icon: '😌', desc: 'Olhar calmo, nariz reto, sorriso leve',
    eye: { w: 1, h: 0.92, tilt: 0.04, lid: 0.37, iris: '#4e6e3a' }, brow: { arch: 0.022, th: 0.015, tilt: 0.004 }, nose: { len: 1, proj: 1, tip: 1, wid: 1, up: 0, bump: 0 }, mouth: { w: 1, smile: 0.011, smirk: 0, lip: 1 }, jaw: 0.42 },
  valente: { name: 'Valente', icon: '😤', desc: 'Olhar firme, nariz marcado, queixo quadrado',
    eye: { w: 0.96, h: 0.8, tilt: -0.02, lid: 0.39, iris: '#5a4330' }, brow: { arch: 0.008, th: 0.022, tilt: 0.026, low: -0.012 }, nose: { len: 1.1, proj: 1.2, tip: 0.95, wid: 1.05, up: -0.2, bump: 1 }, mouth: { w: 0.96, smile: 0.002, smirk: 0, lip: 0.9 }, jaw: 0.455 },
  alegre: { name: 'Alegre', icon: '😄', desc: 'Olhos grandes, nariz arrebitado, sorrisão',
    eye: { w: 1.06, h: 1.1, tilt: 0.02, lid: 0.27, iris: '#3c6cb4' }, brow: { arch: 0.034, th: 0.015, tilt: 0, low: 0.016 }, nose: { len: 0.84, proj: 0.86, tip: 1.15, wid: 1, up: 0.7, bump: 0 }, mouth: { w: 1.16, smile: 0.03, smirk: 0, lip: 1.1 }, jaw: 0.43 },
  astuto: { name: 'Astuto', icon: '😏', desc: 'Olhos puxados, nariz fino, meio sorriso',
    eye: { w: 1.06, h: 0.78, tilt: 0.13, lid: 0.37, iris: '#6f8f2c' }, brow: { arch: 0.02, th: 0.014, tilt: 0.034 }, nose: { len: 1.15, proj: 1.06, tip: 0.8, wid: 0.84, up: 0, bump: 0.4 }, mouth: { w: 0.9, smile: 0.006, smirk: 0.016, lip: 0.85 }, jaw: 0.4 },
  gentil: { name: 'Gentil', icon: '🙂', desc: 'Olhar doce, nariz largo, rosto suave',
    eye: { w: 1, h: 0.96, tilt: -0.1, lid: 0.34, iris: '#7a4a28' }, brow: { arch: 0.018, th: 0.013, tilt: -0.016, low: 0.006 }, nose: { len: 0.95, proj: 0.9, tip: 1.22, wid: 1.25, up: 0.2, bump: 0 }, mouth: { w: 0.96, smile: 0.017, smirk: 0, lip: 1.15 }, jaw: 0.435 },
};
// cabeças antigas (antes do criador) viram o visual equivalente com o rosto novo
const OLD_HEAD_LOOK = { Knight: { style: 'espetado', color: 'loiro' }, Mage: { style: 'curto', color: 'castanho_escuro' }, Barbarian: { style: 'careca', color: 'grisalho', beard: true }, Rogue: { style: 'longo', color: 'ruivo' }, Rogue_Hooded: { style: 'curto', color: 'preto' } };
// limpa e completa um "look" (saves antigos, cor de cabelo que virou letras, rosto ausente)
export function normalizeLook(look) {
  look = look || {};
  const out = { race: RACES[look.race] ? look.race : 'humano', beard: !!look.beard, face: FACE_TYPES[look.face] ? look.face : 'sereno', sex: look.sex === 'f' ? 'f' : 'm', skin: look.skin === 'escura' ? 'escura' : 'clara' };
  const h = look.hair && typeof look.hair === 'object' ? look.hair : null;
  if (h && (HAIR_STYLES[h.style] || HAIR_COLORS[h.color])) out.hair = { style: HAIR_STYLES[h.style] ? h.style : 'curto', color: HAIR_COLORS[h.color] ? h.color : 'castanho' };
  else { const o = OLD_HEAD_LOOK[look.head] || DEFAULT_LOOK.hair; out.hair = { style: o.style, color: o.color }; if (o.beard) out.beard = true; }
  return out;
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function taperGeo(points, r0, r1, seg = 14, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const u = i / seg, r = r0 + (r1 - r0) * u, c = curve.getPointAt(u); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r); } }
  g.computeVertexNormals(); return g;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// classifica (uma vez por geometria) quais vértices são "pelos" (barba/sobrancelha, em tons de cinza na textura)
const kindCache = new WeakMap(), imgCache = new WeakMap();
function imgData(img) { if (imgCache.has(img)) return imgCache.get(img); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; imgCache.set(img, d); return d; }
function hairKinds(head) {
  const g = head.geometry; if (kindCache.has(g)) return kindCache.get(g);
  const P = g.attributes.position, U = g.attributes.uv, n = P.count, kind = new Float32Array(n);
  try {
    const img = head.material.map.image, c = { width: img.width, height: img.height }, D = imgData(img), flip = head.material.map.flipY;
    for (let i = 0; i < n; i++) {
      const px = Math.min(c.width - 1, Math.floor(U.getX(i) * c.width)), py = Math.min(c.height - 1, Math.floor((flip ? 1 - U.getY(i) : U.getY(i)) * c.height)), k = (py * c.width + px) * 4;
      const r = D[k], gg = D[k + 1], b = D[k + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (mx - mn < 45 && mx > 80 && mx < 200) { // tons de cinza = pelos
        const y = P.getY(i), x = Math.abs(P.getX(i)), z = P.getZ(i);
        kind[i] = y >= 1.69 && z > 0.22 && x < 0.37 ? 1 : 2; // 1 = sobrancelha; 2 = barba, bigode e costeletas
      }
    }
  } catch (e) { }
  kindCache.set(g, kind); return kind;
}

// pinta pelos com a cor do cabelo; sem barba, a barba vira pele e "afunda" no rosto
function customHeadMaterial(head, hairHex, beard, jaw = 0.43) {
  const g = head.geometry.clone(), P = g.attributes.position, kind = hairKinds(head), aK = new Float32Array(P.count);
  // tira os olhos, sobrancelhas e o nariz antigos (peças soltas na frente): o rosto 3D novo entra no lugar
  const comps = islands(g).sort((a, b) => b.vs.length - a.vs.length);
  const isNoseBase = c => Math.abs(c.cx) < 0.03 && c.cy > 1.44 && c.cy < 1.66 && c.vs.length < 120; // o nariz antigo tapa um buraco no crânio: fica, achatado, como base
  for (const c of comps.slice(1)) {
    if (!(c.z1 > 0.3 && Math.abs(c.cx) < 0.36 && c.cy > 1.44 && c.cy < 1.9)) continue;
    if (isNoseBase(c)) { for (const i of c.vs) { const ax = Math.abs(P.getX(i)); P.setZ(i, Math.min(P.getZ(i), 0.449 - sstep(0.02, 0.06, ax) * 0.02)); } continue; } // bordas um pouco para dentro (sem riscos ao lado do nariz)
    for (const i of c.vs) P.setXYZ(i, c.cx * 0.5, c.cy, 0);
  }
  for (let i = 0; i < P.count; i++) {
    aK[i] = kind[i];
    if (kind[i] === 2 && !beard) { // achata a barba na forma do queixo (jaw = largura do queixo do rosto escolhido)
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), cy = 1.6, rx = jaw, ry = 0.43, rz = 0.44;
      const d = Math.sqrt((x / rx) ** 2 + ((y - cy) / ry) ** 2 + (z / rz) ** 2) || 1;
      if (d > 1) P.setXYZ(i, x / d, cy + (y - cy) / d, z / d);
      aK[i] = 3;
    }
  }
  g.setAttribute('aKind', new THREE.BufferAttribute(aK, 1)); g.computeVertexNormals();
  if (!beard) { // normais lisas na região da barba achatada (sem "sombra de barba")
    const N = g.attributes.normal, n = new THREE.Vector3();
    // um só "campo" de luz para a metade de baixo do rosto (queixo + bochechas): a forma da cabeça inteira.
    // Assim a luz passa do rosto para o queixo sem vinco, sem faixa escura e sem facetas.
    const own = new THREE.Vector3(), main = new Set(comps[0].vs);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (!main.has(i) || z < 0.1 || y > 1.78 || kind[i] === 1) continue;
      const w = aK[i] === 3 ? 1 : sstep(1.78, 1.5, y);
      if (w <= 0) continue;
      n.set(x / (0.47 * 0.47), (y - 1.66) / (0.56 * 0.56), z / (0.47 * 0.47)).normalize();
      own.set(N.getX(i), N.getY(i), N.getZ(i)); own.lerp(n, w).normalize(); N.setXYZ(i, own.x, own.y, own.z);
    }
    N.needsUpdate = true;
  }
  kindCache.set(g, kind); head.geometry = g;
  const skinC = skinColor(head, comps[0]);
  head.userData.skin = skinC;
  const m = head.material.clone(), hair = new THREE.Color(hairHex);
  m.onBeforeCompile = sh => {
    sh.uniforms.uHair = { value: hair }; sh.uniforms.uSkin = { value: skinC };
    sh.vertexShader = 'attribute float aKind;\nvarying float vKind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vKind = aKind;');
    sh.fragmentShader = 'uniform vec3 uHair;\nuniform vec3 uSkin;\nvarying float vKind;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (vKind > 0.5 && vKind < 2.5) { float l = dot(diffuseColor.rgb, vec3(0.333)); diffuseColor.rgb = uHair * (0.55 + l * 0.9); }
      else if (vKind > 2.5) { diffuseColor.rgb = uSkin; }`); // a mesma pele da testa (sem faixa escura onde era a barba)
  };
  m.customProgramCacheKey = () => 'hairhead';
  head.material = m;
}

// cor da pele na textura (pixel da testa), em espaço linear
function skinColor(head, main) {
  try {
    const g = head.geometry, P = g.attributes.position, U = g.attributes.uv, img = head.material.map.image, D = imgData(img), flip = head.material.map.flipY;
    let best = -1, bd = 1e9; for (const i of main.vs) { const d = Math.hypot(P.getX(i), P.getY(i) - 1.86, P.getZ(i) - 0.45); if (d < bd) { bd = d; best = i; } }
    const px = Math.min(img.width - 1, Math.floor(U.getX(best) * img.width)), py = Math.min(img.height - 1, Math.floor((flip ? 1 - U.getY(best) : U.getY(best)) * img.height)), k = (py * img.width + px) * 4;
    return new THREE.Color().setRGB(D[k] / 255, D[k + 1] / 255, D[k + 2] / 255, THREE.SRGBColorSpace);
  } catch (e) { return new THREE.Color().setRGB(0.871, 0.527, 0.352); }
}
// casca de cabelo: copia os triângulos do couro cabeludo e afasta pela normal
function capGeometry(head, opt) {
  const src = head.geometry, P = src.attributes.position, N = src.attributes.normal, idx = src.index.array;
  const keep = v => {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const front = sstep(0.05, 0.38, z), line = opt.back + (opt.front - opt.back) * front;
    if (y < line) return false;
    if (Math.abs(x) > 0.36 && y < 1.7 && z > -0.12 && !opt.coverEars) return false; // deixa as orelhas de fora
    if (opt.strip && Math.abs(x) > opt.strip) return false;
    if (opt.maxY && y > opt.maxY) return false;
    return true;
  };
  const kind = hairKinds(head), pos = [], nor = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (kind[a] || kind[b] || kind[c]) continue;
    if (!(keep(a) && keep(b) && keep(c))) continue;
    for (const v of [a, b, c]) { const th = opt.th * (1 + Math.max(0, P.getY(v) - 1.95) * 0.6); pos.push(P.getX(v) + N.getX(v) * th, P.getY(v) + N.getY(v) * th, P.getZ(v) + N.getZ(v) * th); nor.push(N.getX(v), N.getY(v), N.getZ(v)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
const nonIdx = g => { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; };
function hairGeometry(head, style, hat) {
  if (style === 'careca') return null;
  const parts = [];
  const cap = o => parts.push(capGeometry(head, { th: 0.035, front: 1.87, back: 1.5, ...o, maxY: hat ? 1.97 : undefined }));
  const add = g => { if (!hat) parts.push(nonIdx(g)); };
  if (style === 'curto') cap({});
  else if (style === 'topete') { cap({}); const q = taperGeo([V3(0, 2.02, 0.36), V3(0, 2.24, 0.3), V3(0, 2.3, 0.08), V3(0, 2.22, -0.12)], 0.15, 0.06, 16, 12); q.scale(1.7, 1, 1); add(q); }
  else if (style === 'espetado') {
    cap({ th: 0.045 });
    const pts = [[0, 2.2, 0], [0.18, 2.16, 0.1], [-0.18, 2.16, 0.1], [0.2, 2.14, -0.16], [-0.2, 2.14, -0.16], [0, 2.14, 0.28], [0.32, 2.02, 0.2], [-0.32, 2.02, 0.2], [0.35, 2.0, -0.1], [-0.35, 2.0, -0.1], [0, 2.08, -0.34], [0.14, 2.12, 0.3], [-0.14, 2.12, 0.3]];
    for (const [x, y, z] of pts) { const dir = V3(x, y - 1.7, z).normalize(), c = new THREE.ConeGeometry(0.075, 0.2, 14); c.translate(0, 0.1, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir)); c.translate(x, y - 0.03, z); add(c); }
  }
  else if (style === 'moicano') {
    cap({ th: 0.03, strip: 0.13, back: 1.55, front: 1.9 });
    for (let i = 0; i < 8; i++) { const u = i / 7, z = 0.32 - u * 0.75, y = 2.18 - Math.pow(Math.abs(z + 0.02) / 0.45, 2) * 0.32, dir = V3(0, 1, z * 1.6).normalize(); const c = new THREE.ConeGeometry(0.1, 0.34 - Math.abs(u - 0.4) * 0.16, 8); c.scale(0.5, 1, 1.25); c.translate(0, 0.15, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir)); c.translate(0, y, z); add(c); }
  }
  else if (style === 'franja') cap({ th: 0.05, front: 1.77, back: 1.32, coverEars: true });
  else if (style === 'rabo') { cap({}); const t = taperGeo([V3(0, 1.98, -0.46), V3(0, 1.92, -0.6), V3(0, 1.62, -0.66), V3(0, 1.28, -0.58)], 0.1, 0.035, 16, 10); parts.push(nonIdx(t)); const b = new THREE.TorusGeometry(0.075, 0.025, 10, 28); b.translate(0, 1.96, -0.52); parts.push(nonIdx(b)); }
  else if (style === 'coque') { cap({}); const s = new THREE.SphereGeometry(0.17, 20, 14); s.translate(0, 2.2, -0.3); add(s); const b = new THREE.TorusGeometry(0.11, 0.025, 10, 28); b.rotateX(1.1); b.translate(0, 2.1, -0.36); add(b); }
  else if (style === 'longo') {
    cap({ th: 0.045, back: 1.12, coverEars: true });
    const back = taperGeo([V3(0, 1.55, -0.44), V3(0, 1.2, -0.46), V3(0, 0.98, -0.38)], 0.16, 0.1, 12, 12); back.scale(2.4, 1, 0.8); parts.push(nonIdx(back));
    for (const sx of [-1, 1]) parts.push(nonIdx(taperGeo([V3(sx * 0.44, 1.78, 0.12), V3(sx * 0.47, 1.4, 0.1), V3(sx * 0.4, 1.05, 0.06)], 0.08, 0.05, 12, 10)));
  }
  if (!parts.length) return null;
  return mergeGeometries(parts);
}
// tubo com raio variável ao longo da curva (lábios, sobrancelhas, cílios)
function tubeR(points, rFn, seg = 20, radial = 10, flat = 1) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const u = i / seg, r = rFn(u), c = curve.getPointAt(u); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r * flat); } }
  // tampa as pontas com meias-esferas
  const caps = [0, 1].map(u => { const sp = new THREE.SphereGeometry(rFn(u), 10, 8), c = curve.getPointAt(u); sp.scale(1, 1, flat); sp.translate(c.x, c.y, c.z); return nonIdx(sp); });
  g.computeVertexNormals(); return mergeGeometries([nonIdx(g), ...caps]);
}
// elipsoide (girado em Z) já posicionado
function ell(rx, ry, rz, x, y, z, rotZ = 0, seg = [22, 16], theta = [0, Math.PI]) {
  const g = new THREE.SphereGeometry(1, seg[0], seg[1], 0, Math.PI * 2, theta[0], theta[1]); g.scale(rx, ry, rz); if (rotZ) g.rotateZ(rotZ); g.translate(x, y, z); return nonIdx(g);
}
// superfície da frente do crânio (raio vindo da frente): para assentar cada peça do rosto na pele
function skullSurface(head) {
  const g = head.geometry, P = g.attributes.position, comps = islands(g).sort((a, b) => b.vs.length - a.vs.length), main = new Set(comps[0].vs), idx = g.index.array, keep = [];
  for (const c of comps) if (Math.abs(c.cx) < 0.03 && c.cy > 1.44 && c.cy < 1.66 && c.vs.length < 120 && c.z1 > 0.3) for (const i of c.vs) main.add(i); // base do nariz (tapa o buraco)
  for (let t = 0; t < idx.length; t += 3) if (main.has(idx[t]) && main.has(idx[t + 1]) && main.has(idx[t + 2])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', P); sg.setIndex(keep);
  const mesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1);
  return (x, y) => { rc.set(o.set(x, y, 2), d); const h = rc.intersectObject(mesh)[0]; return h ? h.point.z : 0.4; };
}
const SKIN_LIN = new THREE.Color().setRGB(0.871, 0.527, 0.352); // mesma pele da textura (espaço linear)
const faceMats = {};
const fmat = (key, make) => faceMats[key] || (faceMats[key] = make());
// monta o rosto escolhido na cabeça (tudo preso ao osso da cabeça, anima junto)
function applyFace(head, faceId, hairHex, beard) {
  const F = FACE_TYPES[faceId] || FACE_TYPES.sereno, E = F.eye, B = F.brow, N = F.nose, M = F.mouth;
  const surf = skullSurface(head), SK = head.userData.skin || SKIN_LIN, skinKey = SK.getHexString();
  const skin = [], lidSkin = [], white = [], iris = [], dark = [], lips = [], brows = [], shine = [];
  // olhos: montados na origem e depois virados para acompanhar a curva do rosto
  const ey = 1.605, ex = 0.195;
  for (const sx of [1, -1]) {
    const cx = sx * ex, sz = surf(cx, ey), slope = (surf(cx + 0.03, ey) - surf(cx - 0.03, ey)) / 0.06, yaw = Math.atan2(-slope, 1);
    const tilt = sx * E.tilt, rx = 0.066 * E.w, ry = 0.052 * E.h, rz = 0.038, cz = sz - 0.006;
    const put = (arr, g) => { g.rotateZ(tilt); g.rotateY(yaw); g.translate(cx, ey, cz); arr.push(g); };
    put(white, ell(rx, ry, rz, 0, 0, 0, 0, [28, 20]));
    const ir = Math.min(0.031, ry * 0.74), iz = rz * 0.9, ix = -sx * 0.003;
    put(iris, ell(ir, ir, 0.009, ix, -0.002, iz, 0, [24, 12]));
    put(dark, ell(ir * 0.46, ir * 0.46, 0.005, ix, -0.002, iz + 0.006, 0, [20, 10]));
    put(shine, ell(ir * 0.22, ir * 0.22, 0.004, ix + ir * 0.34, ir * 0.36, iz + 0.01, 0, [12, 8]));
    // pálpebra de cima (pele) cobrindo o topo do olho, e a linha dos cílios na borda
    const lid = Math.PI * E.lid, lrx = rx * 1.08, lry = ry * 1.1, lrz = rz * 1.16;
    put(lidSkin, ell(lrx, lry, lrz, 0, 0, 0, 0, [28, 14], [0, lid]));
    const lash = [];
    for (let k = 0; k <= 12; k++) { const ph = 0.1 * Math.PI + k / 12 * 0.8 * Math.PI, st = Math.sin(lid); lash.push(new THREE.Vector3(-Math.cos(ph) * st * lrx, Math.cos(lid) * lry, Math.sin(ph) * st * lrz)); }
    put(dark, tubeR(lash, u => 0.0028 + 0.0032 * (sx > 0 ? u : 1 - u), 16, 6));
    // sobrancelha: arco por cima do olho, no tom do cabelo, assentada na pele
    const bp = [], by = ey + 0.105 + (B.low || 0);
    for (let k = 0; k <= 8; k++) { const u = k / 8, x = sx * (0.085 + u * 0.215), y = by + B.arch * Math.sin(Math.PI * Math.min(1, u * 1.15)) + B.tilt * u; bp.push(new THREE.Vector3(x, y, surf(x, y) + 0.006)); }
    brows.push(tubeR(bp, u => B.th * (1.05 - u * 0.55), 16, 8, 0.55));
  }
  // nariz esculpido numa peça só: dorso estreito entre os olhos que desce e se alarga até a ponta, com asas e narinas
  const ty = 1.462 + N.up * 0.012 - (N.len - 1) * 0.05, pr = N.proj, w = N.wid, top = 1.592, len = top - ty;
  const ng = new THREE.SphereGeometry(1, 36, 28), NP = ng.attributes.position;
  for (let k = 0; k < NP.count; k++) {
    const x = NP.getX(k), y = NP.getY(k), z = NP.getZ(k), p = (1 - y) / 2; // p: 0 no topo (entre os olhos) → 1 na ponta
    const Y = top - p * len - (p > 0.85 ? (p - 0.85) * len * 0.35 : 0);
    const tipBall = Math.exp(-Math.pow((p - 0.86) / 0.12, 2)), wing = Math.exp(-Math.pow((p - 0.9) / 0.1, 2)) * Math.pow(Math.abs(x), 1.5);
    const halfW = (0.011 + 0.015 * Math.pow(p, 1.6) + 0.008 * tipBall * N.tip + 0.014 * wing) * w;
    const out = (0.014 + 0.036 * Math.pow(p, 1.15) + 0.01 * tipBall * N.tip + 0.008 * N.bump * Math.exp(-Math.pow((p - 0.45) / 0.15, 2))) * pr;
    const Z = Math.max(surf(x * halfW, Y), 0.448) - 0.01 + (z > 0 ? z * (out + 0.01) : z * 0.006);
    NP.setXYZ(k, x * halfW, Y + (p > 0.92 ? -(1 - Math.abs(z)) * 0.004 : 0), Z);
  }
  ng.computeVertexNormals(); skin.push(nonIdx(ng));
  for (const sx of [1, -1]) dark.push(ell(0.0072 * w, 0.004, 0.009, sx * 0.0135 * w, ty - 0.005, 0.455 + 0.022 * pr, sx * 0.45, [14, 8]));
  // boca: lábio de cima (curva do sorriso), linha da boca e lábio de baixo
  if (!beard) {
    const my = 1.372, mw = 0.068 * M.w, up = [], ln = [], lo = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12 * 2 - 1, x = u * mw, y = my + M.smile * u * u + M.smirk * Math.max(0, u) * u - 0.003 * (1 - u * u);
      up.push(new THREE.Vector3(x, y + 0.0065, surf(x, y) + 0.004)); ln.push(new THREE.Vector3(x * 0.98, y, surf(x, y) + 0.006));
      const xl = x * 0.78, yl = y - 0.011 - 0.003 * (1 - u * u) + M.smile * u * u * 0.3; lo.push(new THREE.Vector3(xl, yl, surf(xl, yl) + 0.004));
    }
    lips.push(tubeR(up, u => 0.0035 + 0.005 * M.lip * Math.sin(Math.PI * u), 22, 8, 0.7));
    dark.push(tubeR(ln, u => 0.0016 + 0.001 * Math.sin(Math.PI * u), 22, 6, 0.6));
    lips.push(tubeR(lo, u => 0.003 + 0.0075 * M.lip * Math.sin(Math.PI * u), 22, 8, 0.75));
  }
  // tudo numa malha só (cores por vértice): 1 chamada de desenho por rosto em vez de 8
  const parts = [], paintAll = (arr, hex) => { const c = hex instanceof THREE.Color ? hex : new THREE.Color(hex); for (const g of arr) { const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); } };
  paintAll(skin, SK); paintAll(lidSkin, SK.clone().multiplyScalar(0.9)); paintAll(white, '#f3efe6'); paintAll(iris, E.iris); paintAll(dark, '#1c120d'); paintAll(shine, '#ffffff'); paintAll(lips, '#b5655b'); paintAll(brows, new THREE.Color(hairHex).multiplyScalar(0.82));
  bindToHead(head, mergeGeometries(parts), faceMat, 'Face');
}
const faceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
function bindToHead(head, geo, mat, name) {
  const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const hs = head.geometry.attributes.skinIndex, hw = head.geometry.attributes.skinWeight;
  for (let v = 0; v < n; v++) for (let k = 0; k < 4; k++) { si[v * 4 + k] = hs.getComponent(0, k); sw[v * 4 + k] = hw.getComponent(0, k); }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const m = new THREE.SkinnedMesh(geo, mat); m.name = name;
  m.position.copy(head.position); m.quaternion.copy(head.quaternion); m.scale.copy(head.scale);
  m.castShadow = true; m.frustumCulled = false; head.parent.add(m); m.bind(head.skeleton, head.bindMatrix);
  return m;
}
const hairMatCache = {};
// aplica cabelo + cores na cabeça visível do personagem (depois de dress())
export function applyHair(ch, look, hat = false) {
  if (!look || !look.hair) return;
  const head = visibleHead(ch.root); if (!head) return;
  const col = (HAIR_COLORS[look.hair.color] || HAIR_COLORS.castanho).hex;
  ch.root.userData.hairColor = col;
  const face = FACE_TYPES[look.face] ? look.face : 'sereno';
  customHeadMaterial(head, col, !!look.beard, FACE_TYPES[face].jaw);
  applyFace(head, face, col, !!look.beard);
  let geo = hairGeometry(head, look.hair.style, hat); if (!geo) return;
  geo.deleteAttribute('normal'); geo = mergeVertices(geo, 1e-3); geo.computeVertexNormals(); // normais lisas: nada de cabelo "quadriculado"
  const mat = hairMatCache[col] || (hairMatCache[col] = new THREE.MeshStandardMaterial({ color: col, roughness: 0.72, metalness: 0.02 }));
  bindToHead(head, geo, mat, 'PlayerHair');
}
// NPC com o rosto 3D novo: troca a cabeça do modelo pela cabeça lisa e aplica rosto/cabelo/raça
export function npcHead(ch, MODELS, outfitModel, look, hat = false) {
  swapHead(ch.root, MODELS, outfitModel, 'Barbarian');
  const L = normalizeLook(look);
  applyHair(ch, L, hat); applyRace(ch, L.race);
}
// a classe usa chapéu/elmo/capuz? (cabelo só nas laterais e atrás)
export function classHasHat(cls) { return false; } // (antigo) nenhuma classe tem chapéu fixo agora
function classHasHatOld(cls) { const L = CLASS_LOOKS[cls]; return !!(L && (L.show || []).some(n => /_Hat$|_Helmet$|Hood/.test(n))) || (L && (L.extras || []).some(e => /hood|Hat|tricorn|bandana/i.test(e))); }

/* ---------- CHAPÉUS: só como equipamento (topo da cabeça) — nenhuma classe tem chapéu fixo ---------- */
// covers = esconde o topo do cabelo (o corte fica só nas laterais e atrás)
export const HATS = {
  bandana: { extra: 'bandana', covers: true, tight: true, dy: -0.07 },
  chapeu_de_palha: { extra: 'strawHat', covers: true, dy: -0.13 },
  coroa_de_flores: { extra: 'flowerCrown', covers: false, dy: -0.09 },
  elmo_de_ferro: { borrow: ['Knight', 'Knight_Helmet'], covers: true },
  chapeu_de_mago: { borrow: ['Mage', 'Mage_Hat'], scale: 0.8, covers: true },
  chapeu_de_bardo: { extra: 'bardHat', covers: true, dy: -0.12 },
  tricornio: { extra: 'tricorn', covers: true, dy: -0.15 },
  capuz_sombrio: { extra: 'shadowHood', covers: true, tight: true, dy: -0.1 },
  tiara_arcana: { extra: 'circlet', covers: false, dy: -0.07 },
  faixa_de_penas: { extra: 'featherBand', covers: false, dy: -0.08 },
};
export function hatCovers(hatId) { return !!(HATS[hatId] && HATS[hatId].covers); }
export function applyHat(ch, hatId, MODELS, customHead = true) {
  const H = HATS[hatId]; if (!H) return null;
  const fx = [];
  const hb = bone(ch.root, 'head'), before = hb ? new Set(hb.children) : null;
  if (H.extra && EXTRAS[H.extra]) EXTRAS[H.extra](ch.root, fx);
  if (hb && H.dy) for (const c of hb.children) if (!before.has(c)) { if (ch.root.userData.human) { const inner = c.children[0]; if (inner) inner.position.y += H.dy * inner.scale.y; } else c.position.y += H.dy * c.scale.y * (customHead ? 1 : 0.4); } // (em unidades do soquete) assenta o chapéu na cabeça (a cabeça nova é mais baixa)
  if (H.borrow) { const [model, item] = H.borrow; borrow(ch.root, MODELS, model, item); if (H.scale) { const o = ch.root.getObjectByName(item); if (o) o.scale.multiplyScalar(H.scale); } }
  if (ch.root.userData.human && H.covers) hairUnderHat(ch.root, !!H.tight);
  return fx.length ? t => fx.forEach(f => f(t)) : null;
}

/* =========================================================================
   ROUND 15 (S-193 a S-220): armaduras feitas sob medida para o corpo realista.
   "Encolhe-e-veste": amostramos os vértices da roupa na pose parada, medimos o corpo em
   fatias ao longo de um eixo (tronco, braço, perna, cabeça) e geramos uma casca com espessura
   logo por fora — então a peça encaixa no corpo de verdade (nada de frankenstein) e fica presa
   ao osso certo, acompanhando as animações.
   ========================================================================= */
const WRAP_CACHE = new Map();
const domBones = (mesh) => { const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = mesh.skeleton.bones.map(b => b.name), out = new Array(g.attributes.position.count);
  for (let v = 0; v < out.length; v++) { let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > best) { best = w; bi = si.getComponent(v, k); } } out[v] = names[bi]; } return out; };
// pontos (no espaço do personagem, pose parada) das malhas cujo osso dominante está em "bones"
function sampleBody(root, bones, meshRe = null) {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), pts = [], p = new THREE.Vector3(), set = new Set(bones);
  root.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible || /Hair_|Eyebrows|Beard/.test(o.name) || (meshRe && !meshRe.test(o.name))) return;
    const db = o.userData._dom || (o.userData._dom = domBones(o)), n = o.geometry.attributes.position.count, step = n > 6000 ? 2 : 1;
    for (let v = 0; v < n; v += step) if (set.has(db[v])) { o.getVertexPosition(v, p); p.applyMatrix4(o.matrixWorld).applyMatrix4(inv); pts.push(p.clone()); }
  });
  return pts;
}
const bonePos = (root, n) => { const b = bone(root, n) || root.getObjectByName(n); return b ? rootPos(root, b) : null; };
/* casca com espessura em volta de um eixo A→B. opts: t0,t1 (fração do eixo), bins, sec (setores), off (folga), th (espessura),
   front (direção de referência), arc [a0,a1] (só parte da volta, em rad; 0 = frente), ridge (quinas/lâminas), flare(t)→extra raio */
function wrapShell(pts, A, B, o) {
  const L = B.clone().sub(A), len = L.length(), u = L.normalize(), bins = o.bins || 14, sec = o.sec || 28;
  const e1 = (o.front || new THREE.Vector3(0, 0, 1)).clone(); e1.sub(u.clone().multiplyScalar(e1.dot(u))).normalize(); const e2 = new THREE.Vector3().crossVectors(u, e1);
  const R = Array.from({ length: bins + 1 }, () => new Array(sec).fill(0)), C = Array.from({ length: bins + 1 }, () => [0, 0, 0]), lo = Array.from({ length: bins + 1 }, () => [1e9, 1e9, -1e9, -1e9]);
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1, binOf = t => Math.round((t - t0) / (t1 - t0) * bins);
  const proj = []; for (const p of pts) { const d = p.clone().sub(A), t = d.dot(u) / len; const i = binOf(t); if (i < 0 || i > bins) continue; const x = d.dot(e1), y = d.dot(e2); proj.push([i, x, y]); const b = lo[i]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  for (let i = 0; i <= bins; i++) { const b = lo[i]; C[i] = b[0] < 1e8 ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : null; }
  for (let i = 0; i <= bins; i++) if (!C[i]) { let a = i, c = i; while (a >= 0 && !C[a]) a--; while (c <= bins && !C[c]) c++; C[i] = (a >= 0 ? C[a] : null) || (c <= bins ? C[c] : [0, 0]); }
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < bins; i++) C[i] = [(C[i - 1][0] + C[i][0] * 2 + C[i + 1][0]) / 4, (C[i - 1][1] + C[i][1] * 2 + C[i + 1][1]) / 4];
  for (const [i, x, y] of proj) { const dx = x - C[i][0], dy = y - C[i][1], a = Math.atan2(dy, dx), j = ((Math.round(a / (Math.PI * 2) * sec) % sec) + sec) % sec, r = Math.hypot(dx, dy); if (r > R[i][j]) R[i][j] = r; }
  // preenche buracos (circular em j, linear em i) e suaviza
  for (let i = 0; i <= bins; i++) { const row = R[i]; if (row.every(r => !r)) continue; for (let j = 0; j < sec; j++) if (!row[j]) { let a = 1; while (!row[(j - a + sec) % sec] && a < sec) a++; let c = 1; while (!row[(j + c) % sec] && c < sec) c++; row[j] = (row[(j - a + sec) % sec] * c + row[(j + c) % sec] * a) / (a + c); } }
  for (let i = 0; i <= bins; i++) if (R[i].every(r => !r)) { let a = i, c = i; while (a >= 0 && R[a].every(r => !r)) a--; while (c <= bins && R[c].every(r => !r)) c++; R[i] = (a >= 0 ? R[a] : R[c]).slice(); }
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) { const N = R.map(r => r.slice()); for (let i = 0; i <= bins; i++) for (let j = 0; j < sec; j++) { const n = [R[i][j] * 4, R[i][(j + 1) % sec], R[i][(j - 1 + sec) % sec], R[Math.max(0, i - 1)][j], R[Math.min(bins, i + 1)][j]]; N[i][j] = Math.max(R[i][j], (n[0] + n[1] + n[2] + n[3] + n[4]) / 8); } for (let i = 0; i <= bins; i++) R[i] = N[i]; }
  // geometria: superfície de fora + de dentro + bordas
  const arc = o.arc || [-Math.PI, Math.PI], ns = Math.max(4, Math.round(sec * (arc[1] - arc[0]) / (Math.PI * 2))), closed = !o.arc;
  const off = o.off ?? 0.02, th = o.th ?? 0.012, pos = [], uv = [], idx = [];
  const radAt = (i, a) => { const f = ((a / (Math.PI * 2)) * sec % sec + sec) % sec, j0 = Math.floor(f), j1 = (j0 + 1) % sec, w = f - j0; return R[i][j0] * (1 - w) + R[i][j1] * w; };
  const P = (i, k, extra) => { const t = t0 + (t1 - t0) * i / bins, a = arc[0] + (arc[1] - arc[0]) * k / ns, r = radAt(i, a) + off + extra + (o.flare ? o.flare(i / bins, a) : 0) + (o.ridge ? o.ridge(i / bins, a) : 0);
    const c = C[i], x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; return A.clone().add(u.clone().multiplyScalar(t * len)).add(e1.clone().multiplyScalar(x)).add(e2.clone().multiplyScalar(y)); };
  const cols = closed ? ns : ns + 1, layer = (extra, flip) => { const base = pos.length / 3; for (let i = 0; i <= bins; i++) for (let k = 0; k < cols; k++) { const q = P(i, k, extra); pos.push(q.x, q.y, q.z); uv.push(k / ns * (o.uvRep || 2), i / bins); }
    for (let i = 0; i < bins; i++) for (let k = 0; k < (closed ? ns : ns); k++) { const a = base + i * cols + k, b = base + i * cols + (k + 1) % cols, c = a + cols, d = b + cols; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); } return base; };
  const outer = layer(th, false), inner = layer(0, true);
  const edge = (i) => { for (let k = 0; k < (closed ? ns : ns); k++) { const k2 = (k + 1) % cols, a = outer + i * cols + k, b = outer + i * cols + k2, c = inner + i * cols + k, d = inner + i * cols + k2; if (i === 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); } };
  edge(0); edge(bins);
  if (!closed) for (let i = 0; i < bins; i++) for (const k of [0, ns]) { const a = outer + i * cols + k, b = outer + (i + 1) * cols + k, c = inner + i * cols + k, d = inner + (i + 1) * cols + k; if (k === 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.userData = { R, C, A: A.clone(), u: u.clone(), e1: e1.clone(), e2: e2.clone(), len, t0, t1, bins, sec };
  return g;
}
// prende uma malha (geometria no espaço do personagem, pose parada) ao osso, para acompanhar a animação
function pinToBone(root, boneName, mesh) {
  const b = bone(root, boneName) || root.getObjectByName(boneName) || root; humanIdlePose(root);
  // a matriz do suporte desfaz EXATAMENTE a do osso na pose parada (inclusive a escala desigual dos ossos de anão — S-289):
  // a peça, feita no espaço do personagem, fica onde foi moldada e depois acompanha o osso
  const holder = new THREE.Group(); b.add(holder); root.updateMatrixWorld(true);
  holder.matrixAutoUpdate = false; holder.matrix.copy(b.matrixWorld).invert().multiply(root.matrixWorld); holder.userData.unsq = true;
  holder.add(mesh); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; return mesh;
}
/* saia de tecido que acompanha as pernas (auditoria): a saia fica presa à pélvis e, a cada quadro, cada anel do pano
   abre por onde as coxas, joelhos e pés passam (sem nunca deixar a perna atravessar). O pano estica como uma tenda
   entre a perna da frente e o resto da saia e cai reto a partir do joelho, com pregas e barra irregular.
   o: { top, bot, r0, r1 (raio na cintura e quanto abre até a barra), arc:[a0,len], pleats, pleatAmp, sz (achatamento), seed, hemRows } */
const SK_ROWS = 22;
function gownGeo(root, o) {
  const pv = bonePos(root, 'pelvis'), top = o.top, bot = o.bot ?? 0.03, ROWS = SK_ROWS, SEG = o.seg || 64, a0 = o.arc ? o.arc[0] : 0, al = o.arc ? o.arc[1] : Math.PI * 2, closed = !o.arc;
  const pos = [], uv = [], cols = closed ? SEG : SEG + 1, sz = o.sz ?? 0.84, cx = pv.x, cz = pv.z + 0.01, rb = [], yb = [], ang = [];
  for (let i = 0; i <= ROWS; i++) {
    const t = i / ROWS;
    for (let j = 0; j < cols; j++) {
      const a = a0 + j / SEG * al;
      const pl = (Math.sin(a * (o.pleats || 13) + (o.seed || 0)) * 0.6 + Math.sin(a * (o.pleats || 13) * 0.5 + 1.7) * 0.4) * (o.pleatAmp ?? 0.05) * Math.min(1, t * 1.5); // pregas: fundas embaixo
      const r = (o.r0 + t * t * o.r1 + Math.sin(t * 3) * 0.01) * (1 + pl);
      const y = top - t * (top - bot) + (t > 0.9 ? (Math.sin(a * 5 + 0.7) * 0.012 + Math.sin(a * 11 + 2.1) * 0.006) * (t - 0.9) * 10 : 0); // barra irregular
      pos.push(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r * sz); uv.push(j / SEG * 3, t * 2); rb.push(r); yb.push(y); ang.push(a);
    }
  }
  const main = [], hem = [], hr = o.hemRows || 0;
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < SEG; j++) { const j2 = closed ? (j + 1) % SEG : j + 1, A = i * cols + j, B = i * cols + j2, C = (i + 1) * cols + j, D = (i + 1) * cols + j2; (i >= ROWS - hr ? hem : main).push(A, C, B, B, C, D); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex([...main, ...hem]);
  if (hr) { g.addGroup(0, main.length, 0); g.addGroup(main.length, hem.length, 1); }
  g.computeVertexNormals();
  g.userData.skirt = { rows: ROWS + 1, cols, cx, cz, sz, rb, yb, ang, dA: al / SEG, closed };
  return g;
}
const _skW = new THREE.Vector3(), _skInv = new THREE.Matrix4();
function clothSkirt(root, geo, mat, margin = 0.03) {
  const mesh = pinToBone(root, 'pelvis', new THREE.Mesh(geo, mat));
  const legs = ['l', 'r'].map(s => ['thigh_' + s, 'calf_' + s, 'foot_' + s, 'ball_' + s].map(n => bone(root, n) || root.getObjectByName(n)).filter(Boolean));
  if (legs.some(l => l.length < 3)) return mesh;
  const RAD = [0.125, 0.075, 0.06, 0.05], K = geo.userData.skirt, P = geo.attributes.position, N = K.rows * K.cols, rr = new Float32Array(N), need = new Float32Array(K.cols);
  const lp = legs.map(l => l.map(() => new THREE.Vector3()));
  let lastFrame = -1;
  mesh.onBeforeRender = (renderer) => {
    const f = renderer.info.render.frame; if (f === lastFrame) return; lastFrame = f;
    _skInv.copy(mesh.matrixWorld).invert();
    legs.forEach((l, li) => l.forEach((b, k) => lp[li][k].copy(b.getWorldPosition(_skW)).applyMatrix4(_skInv)));
    for (let i = 0; i < K.rows; i++) {
      const y = K.yb[i * K.cols];
      need.fill(0);
      for (const L of lp) for (let k = 0; k < L.length - 1; k++) {
        const A = L[k], B = L[k + 1]; if ((y - A.y) * (y - B.y) > 0) continue; const u = Math.abs(B.y - A.y) < 1e-4 ? 0.5 : (y - A.y) / (B.y - A.y);
        const ox = A.x + (B.x - A.x) * u - K.cx, oz = (A.z + (B.z - A.z) * u - K.cz) / K.sz, R = RAD[k] + (RAD[k + 1] - RAD[k]) * u, c2 = ox * ox + oz * oz;
        for (let j = 0; j < K.cols; j++) { const a = K.ang[i * K.cols + j], dc = Math.sin(a) * ox + Math.cos(a) * oz, disc = R * R - c2 + dc * dc; if (disc > 0) { const t = dc + Math.sqrt(disc) + margin; if (t > need[j]) need[j] = t; } }
      }
      for (let j = 0; j < K.cols; j++) { // o pano estica em volta da perna (tenda) em vez de fazer um bico
        const v = i * K.cols + j; let r = K.rb[v];
        for (let d = -10; d <= 10; d++) { let jj = j + d; if (K.closed) jj = (jj + K.cols) % K.cols; else if (jj < 0 || jj >= K.cols) continue; const nd = need[jj]; if (nd > 0) { const e = nd - Math.abs(d) * K.dA * nd * 0.55; if (e > r) r = e; } }
        if (i > 0) { const up = (i - 1) * K.cols + j, ex = rr[up] - K.rb[up]; if (K.rb[v] + ex * 0.985 > r) r = K.rb[v] + ex * 0.985; } // do joelho para baixo o pano cai reto
        rr[v] = r;
        const ex = r - K.rb[v], a = K.ang[v];
        P.setXYZ(v, K.cx + Math.sin(a) * r, K.yb[v] + ex * 0.22 * (i / (K.rows - 1)), K.cz + Math.cos(a) * r * K.sz); // a barra sobe um pouco quando o pano abre
      }
    }
    P.needsUpdate = true; geo.computeVertexNormals();
  };
  return mesh;
}
// texturas de metal (riscos, desgaste) e de couro, geradas uma vez
const _tex = {};
function metalTex(kind = 'aco') {
  if (_tex[kind]) return _tex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  if (kind === 'malha') { // cota de malha: fileiras de anéis entrelaçados (S-289/S-291)
    x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 32; row++) for (let col = 0; col < 33; col++) { const cx = col * 8 + (row % 2) * 4, cy = row * 8; const g = x.createLinearGradient(cx - 4, cy - 4, cx + 4, cy + 4); g.addColorStop(0, '#f0f0f0'); g.addColorStop(0.5, '#a8a8a8'); g.addColorStop(1, '#5a5a5a'); x.strokeStyle = g; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, 4.2, 3.4, 0, 0, 7); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(3, 3); return (_tex[kind] = t);
  }
  if (kind === 'couro') { x.fillStyle = '#d6d6d6'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 2600; k++) { x.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.05)`; x.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3); } for (let k = 0; k < 40; k++) { x.strokeStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); const y = r() * 256; x.moveTo(0, y); x.bezierCurveTo(80, y + r() * 10, 170, y - r() * 10, 256, y); x.stroke(); } }
  else { x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 500; k++) { x.strokeStyle = `rgba(${r() < 0.6 ? 0 : 255},${r() < 0.6 ? 0 : 255},${r() < 0.6 ? 0 : 255},${0.04 + r() * 0.08})`; x.lineWidth = 0.5 + r(); x.beginPath(); const a = r() * 256, b = r() * 256, ang = r() * 6.28, l = 4 + r() * 26; x.moveTo(a, b); x.lineTo(a + Math.cos(ang) * l, b + Math.sin(ang) * l); x.stroke(); } const gr = x.createRadialGradient(128, 128, 20, 128, 128, 180); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.15)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_tex[kind] = t);
}
const armorMat = (color, kind = 'aco') => kind === 'malha' ? new THREE.MeshStandardMaterial({ color, map: metalTex('malha'), bumpMap: metalTex('malha'), bumpScale: 1.2, roughness: 0.55, metalness: 0.55 })
  : kind === 'couro' ? new THREE.MeshStandardMaterial({ color, map: metalTex('couro'), roughness: 0.78, metalness: 0.05 })
  : kind === 'tecido' ? new THREE.MeshStandardMaterial({ color, map: metalTex('couro'), roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  : new THREE.MeshStandardMaterial({ color, map: metalTex('aco'), roughness: kind === 'ouro' ? 0.32 : 0.42, metalness: kind === 'ouro' ? 0.6 : 0.4 });
// geometria cacheada por (sexo, roupa, peça)
function wrapCached(root, key, make) { const k = (root.userData.sex || 'm') + (root.userData.dwarf ? 'd' : '') + '|' + (root.userData.outfitKey || '') + '|' + key; /* anão tem medidas próprias */ if (!WRAP_CACHE.has(k)) WRAP_CACHE.set(k, make()); return WRAP_CACHE.get(k); }
function outfitKey(root) { let n = ''; root.traverse(o => { if (!n && o.isSkinnedMesh && /_(Body|Legs)/.test(o.name)) n = o.name.split('_').slice(0, 2).join('_'); }); return n; }

/* peças: cada uma devolve a malha já presa ao osso */
const ARMOR_PIECES = {
  // couraça do tronco (peito + costas), com quilha no meio e lâminas embaixo
  cuirass(root, mat, opt = {}) {
    const g = wrapCached(root, 'cuirass' + (opt.long ? 'L' : ''), () => {
      const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], /_Body/), top = bonePos(root, 'neck_01'), bot = bonePos(root, 'spine_01');
      const A = new THREE.Vector3(top.x, bot.y - (opt.long ? 0.08 : 0.0), top.z), B = new THREE.Vector3(top.x, top.y - 0.035, top.z);
      return wrapShell(pts, A, B, { bins: 16, sec: 36, off: opt.off ?? 0.022, th: 0.014, smooth: 4, uvRep: 3,
        ridge: (t, a) => Math.max(0, Math.cos(a)) ** 8 * 0.012 * (1 - t * 0.5) + (t < 0.32 ? (Math.floor(t * 12) % 2) * 0.006 : 0) }); // quilha frontal e lâminas da barriga
    });
    return pinToBone(root, 'spine_02', new THREE.Mesh(g, mat));
  },
  // faixas da cintura (fralda) presas à pélvis
  fauld(root, mat) {
    const g = wrapCached(root, 'fauld', () => {
      const pts = sampleBody(root, ['pelvis', 'thigh_l', 'thigh_r'], /_(Body|Legs)/), pv = bonePos(root, 'pelvis'), sp = bonePos(root, 'spine_01');
      return wrapShell(pts, new THREE.Vector3(pv.x, pv.y - 0.12, pv.z), new THREE.Vector3(pv.x, sp.y + 0.02, pv.z), { bins: 8, sec: 32, off: 0.026, th: 0.01, smooth: 4, flare: t => (1 - t) * 0.03, ridge: t => (Math.floor(t * 4) % 2) * 0.007 });
    });
    return pinToBone(root, 'pelvis', new THREE.Mesh(g, mat));
  },
  // braçadeira / grevas: casca em volta do antebraço ou da canela
  limb(root, mat, boneName, childName, t0, t1, key) {
    const g = wrapCached(root, key, () => { const pts = sampleBody(root, [boneName]), A = bonePos(root, boneName), B = bonePos(root, childName); return wrapShell(pts, A, B, { t0, t1, bins: 8, sec: 20, off: 0.008, th: 0.01, smooth: 3, flare: t => (t > 0.85 ? (t - 0.85) * 0.12 : 0) }); });
    return pinToBone(root, boneName, new THREE.Mesh(g, mat));
  },
  /* ombreira (S-289/S-297, no espírito das placas de Skyrim/WoW): casca moldada no próprio ombro — cobre o alto do braço e
     a junta, abre em sino embaixo e tem três lâminas sobrepostas. Acompanha o osso, nada de disco flutuando. */
  pauldron(root, mat, side, size = 1) {
    const g = wrapCached(root, 'pauldS' + side + size, () => {
      const pts = sampleBody(root, ['upperarm_' + side], /_(Body|Arms)/), A = bonePos(root, 'upperarm_' + side), B = bonePos(root, 'lowerarm_' + side);
      const c = A.x > 0 ? -Math.PI / 2 : Math.PI / 2; // lado de fora do braço (o lado de dentro, colado no tronco, fica aberto)
      return wrapShell(pts, A, B, { t0: -0.1, t1: 0.42, bins: 12, sec: 30, off: 0.02 * size, th: 0.012, smooth: 5, arc: [c - 1.75, c + 1.75],
        flare: (t, a) => (t < 0.12 ? (0.12 - t) * 0.06 : 0) + Math.max(0, t - 0.75) * 0.06, ridge: t => (t > 0.3 ? (Math.floor((t - 0.3) * 4.5) % 2) * 0.006 : 0) });
    });
    return pinToBone(root, 'upperarm_' + side, new THREE.Mesh(g, mat));
  },
  // cotoveleira / joelheira: concha pequena sobre a junta
  joint(root, mat, boneName, at = 0, out = new THREE.Vector3(0, 0, -1), r = 0.055) {
    humanIdlePose(root); const p = bonePos(root, boneName), geo = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), m = new THREE.Mesh(geo, mat);
    m.position.copy(p).add(out.clone().multiplyScalar(r * (0.35 + at))); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out.clone().normalize()); m.scale.set(1, 0.7, 1);
    return pinToBone(root, boneName, m);
  },
  pauldronOld(root, mat, side, size = 1) {
    humanIdlePose(root);
    const sh = bonePos(root, 'upperarm_' + side), el = bonePos(root, 'lowerarm_' + side), g = new THREE.Group();
    const armDir = el.clone().sub(sh).normalize(), out = new THREE.Vector3(Math.sign(sh.x) || 1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0).multiplyScalar(0.8).add(out.clone().multiplyScalar(0.6)).normalize();
    // duas lâminas lisas: a de cima cobre o ombro, a de baixo desce um pouco pelo braço (sobrepostas, sem pontas)
    for (let k = 0; k < 2; k++) {
      const r = (0.105 - k * 0.012) * size, geo = new THREE.SphereGeometry(r, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.47);
      const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < r * 0.12) P.setY(i, y - (r * 0.12 - y) * 0.6); } geo.computeVertexNormals(); // borda levemente virada para fora
      const cap = new THREE.Mesh(geo, mat); cap.scale.set(1.0, 0.5, 1.18);
      cap.position.copy(sh).add(up.clone().multiplyScalar(0.012 - k * 0.045)).add(armDir.clone().multiplyScalar(k * 0.05)).add(out.clone().multiplyScalar(0.01));
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().lerp(out, k * 0.25).normalize()); g.add(cap);
    }
    return pinToBone(root, 'upperarm_' + side, g);
  },
  // gola (protege o pescoço)
  gorget(root, mat) {
    const nk = bonePos(root, 'neck_01'), g = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.105, 0.07, 28, 1, true), mat); g.material = mat.clone(); g.material.side = THREE.DoubleSide; g.position.copy(nk).add(new THREE.Vector3(0, -0.03, 0.005)); return pinToBone(root, 'spine_03', g);
  },
};
// tabardo de tecido (frente e costas) por cima da couraça, com emblema pintado
function tabardTex(base, trim, emblem) {
  const key = 'tab' + base + trim + emblem; if (_tex[key]) return _tex[key];
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 256); for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * 128, Math.random() * 256, 1, 3); }
  x.strokeStyle = trim; x.lineWidth = 7; x.strokeRect(6, -10, 116, 260);
  x.save(); x.translate(64, 96); x.fillStyle = trim; x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.5;
  if (emblem === 'sol') { for (let k = 0; k < 12; k++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(-4, -14); x.lineTo(0, -30); x.lineTo(4, -14); x.fill(); } x.beginPath(); x.arc(0, 0, 13, 0, 7); x.fill(); x.stroke(); }
  else if (emblem === 'torre') { x.fillRect(-14, -18, 28, 40); for (const k of [-14, -4, 6]) x.fillRect(k, -26, 8, 9); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(-4, 6, 8, 16); }
  else if (emblem === 'cruz') { x.fillRect(-5, -26, 10, 52); x.fillRect(-18, -12, 36, 10); }
  else if (emblem === 'espadas') { for (const s of [-1, 1]) { x.save(); x.rotate(s * 0.62); x.fillRect(-3, -34, 6, 50); x.fillRect(-11, 12, 22, 5); x.fillRect(-2.5, 17, 5, 12); x.beginPath(); x.arc(0, 32, 4, 0, 7); x.fill(); x.restore(); } } // espadas cruzadas (casa do Cavaleiro)
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (_tex[key] = t);
}
function tabard(root, base, trim, emblem, len = 0.52, back = true) { // tabardo justo por cima da couraça (frente e costas), descendo até as coxas
  const mat = new THREE.MeshStandardMaterial({ map: tabardTex(base, trim, emblem), roughness: 0.92, side: THREE.DoubleSide });
  for (const [a0, a1, key] of [[-0.62, 0.62, 'tabF'], [Math.PI - 0.62, Math.PI + 0.62, 'tabB']].slice(0, back ? 2 : 1)) {
    const g = wrapCached(root, key, () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis', 'thigh_l', 'thigh_r'], /_(Body|Legs)/), nk = bonePos(root, 'neck_01'), pv = bonePos(root, 'pelvis');
      return wrapShell(pts, new THREE.Vector3(nk.x, pv.y - len * 0.55, nk.z), new THREE.Vector3(nk.x, nk.y - 0.05, nk.z), { bins: 18, sec: 40, off: 0.042, th: 0.004, smooth: 5, arc: [a0, a1], uvRep: 1, flare: t => (t < 0.35 ? (0.35 - t) * 0.12 : 0) }); });
    pinToBone(root, 'spine_02', new THREE.Mesh(g, mat));
  }
}
/* capa de pano com física (S-204): grade de partículas presa nos ombros, gravidade, vento leve,
   inércia quando o personagem anda e colisão com as costas/pernas — nada de retângulo duro */
function clothCape(root, fx, color, opt = {}) {
  const W = opt.w || 0.5, H = opt.h || 1.05, NX = 9, NY = 13, mat = new THREE.MeshStandardMaterial({ color, map: metalTex('couro'), roughness: 0.95, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(1, 1, NX - 1, NY - 1), mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  root.add(mesh);
  const sp3 = bone(root, 'spine_03'), pelv = bone(root, 'pelvis'), clL = bone(root, 'upperarm_l'), clR = bone(root, 'upperarm_r'), thL = bone(root, 'thigh_l'), thR = bone(root, 'thigh_r'), caL = bone(root, 'calf_l'), caR = bone(root, 'calf_r');
  const N = NX * NY, p = new Float32Array(N * 3), q = new Float32Array(N * 3); let rest = (W / (NX - 1)); const restY = H / (NY - 1);
  let inited = false, last = performance.now();
  const wp = (b, v = new THREE.Vector3()) => b.getWorldPosition(v), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), fwd = new THREE.Vector3(), rightV = new THREE.Vector3();
  const pins = () => { // pontos de fixação: linha atrás dos ombros (no espaço do mundo)
    root.updateMatrixWorld(true); const a = wp(clL), b = wp(clR), s = wp(sp3), pv = wp(pelv); fwd.copy(s).sub(pv); const upv = fwd.clone().normalize(); rightV.copy(a).sub(b).normalize(); const back = new THREE.Vector3().crossVectors(rightV, upv).normalize().multiplyScalar(-1);
    // centrado na coluna (não nos braços, que se mexem na pose parada), na altura dos ombros
    const mid = s.clone(); mid.y = (a.y + b.y) / 2 + 0.02; const half = a.distanceTo(b) * 0.42;
    const out = []; for (let i = 0; i < NX; i++) { const t = i / (NX - 1); out.push(mid.clone().add(rightV.clone().multiplyScalar((t - 0.5) * 2 * half)).add(back.clone().multiplyScalar(0.12 - Math.abs(t - 0.5) * 0.05))); }
    return { out, back, upv };
  };
  const step = () => {
    const now = performance.now(); let dt = Math.min(0.033, (now - last) / 1000); last = now; if (dt <= 0) dt = 0.016;
    const { out, back, upv } = pins();
    // S-297: teleporte, montaria, renascer ou quadro perdido → o pano não fica para trás esticado (recomeça pendurado nos ombros)
    if (inited) { const mid = out[NX >> 1], k0 = (NX >> 1) * 3, kb = ((NY - 1) * NX + (NX >> 1)) * 3; if (Math.hypot(mid.x - p[k0], mid.y - p[k0 + 1], mid.z - p[k0 + 2]) > 0.6 || Math.hypot(mid.x - p[kb], mid.y - p[kb + 1], mid.z - p[kb + 2]) > H * 1.6) inited = false; }
    if (!inited) { rest = out[0].distanceTo(out[NX - 1]) / (NX - 1) * 1.08; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = (j * NX + i) * 3, b0 = out[i]; p[k] = b0.x + back.x * 0.02 * j; p[k + 1] = b0.y - j * restY; p[k + 2] = b0.z + back.z * 0.02 * j; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; } inited = true; }
    const g = -9.8 * dt * dt, wind = Math.sin(now / 900) * 0.0004;
    for (let n = 0; n < N; n++) { const k = n * 3; if (n < NX) continue; const vx = (p[k] - q[k]) * 0.985, vy = (p[k + 1] - q[k + 1]) * 0.985, vz = (p[k + 2] - q[k + 2]) * 0.985; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; p[k] += vx + back.x * wind; p[k + 1] += vy + g; p[k + 2] += vz + back.z * wind; }
    for (let i = 0; i < NX; i++) { const k = i * 3; p[k] = out[i].x; p[k + 1] = out[i].y; p[k + 2] = out[i].z; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; }
    // corpo: cápsulas (tronco e coxas) que empurram o pano para fora
    const caps = [[wp(sp3), wp(pelv, tmp2.clone()), 0.2], [wp(thL), wp(caL), 0.11], [wp(thR), wp(caR), 0.11]];
    const link = (a, b, rl) => { const ka = a * 3, kb = b * 3, dx = p[kb] - p[ka], dy = p[kb + 1] - p[ka + 1], dz = p[kb + 2] - p[ka + 2], d = Math.hypot(dx, dy, dz) || 1e-6, df = (d - rl) / d * 0.5, pa = a < NX ? 0 : 1, pb = b < NX ? 0 : 1, s = pa + pb; if (!s) return; p[ka] += dx * df * (pa / s) * 2; p[ka + 1] += dy * df * (pa / s) * 2; p[ka + 2] += dz * df * (pa / s) * 2; p[kb] -= dx * df * (pb / s) * 2; p[kb + 1] -= dy * df * (pb / s) * 2; p[kb + 2] -= dz * df * (pb / s) * 2; };
    for (let it = 0; it < 5; it++) {
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const n = j * NX + i; if (i < NX - 1) link(n, n + 1, rest); if (j < NY - 1) link(n, n + NX, restY); if (i < NX - 1 && j < NY - 1) link(n, n + NX + 1, Math.hypot(rest, restY)); }
      for (let n = NX; n < N; n++) { const k = n * 3; tmp.set(p[k], p[k + 1], p[k + 2]);
        for (const [a, b, r] of caps) { const ab = tmp2.copy(b).sub(a), t = Math.max(0, Math.min(1, tmp.clone().sub(a).dot(ab) / ab.lengthSq())), c = a.clone().add(ab.multiplyScalar(t)), d = tmp.clone().sub(c), dl = d.length(); if (dl < r) { d.multiplyScalar((r - dl) / (dl || 1)); tmp.add(d); } }
        p[k] = tmp.x; p[k + 1] = tmp.y; p[k + 2] = tmp.z; }
    }
    // escreve na malha (vértices no espaço do mundo; a malha anula a transformação do pai)
    const P = geo.attributes.position; for (let n = 0; n < N; n++) P.setXYZ(n, p[n * 3], p[n * 3 + 1], p[n * 3 + 2]);
    P.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    mesh.matrix.copy(root.matrixWorld).invert(); mesh.matrixWorldNeedsUpdate = true;
  };
  // a PlaneGeometry vem com a linha de cima primeiro (y = +0.5): a ordem casa com j = 0 em cima
  fx.push(() => step());
  return mesh;
}
/* escudos feitos em código (S-195): redondo de madeira com aro e umbo de ferro, broquel de aço, escudo de cavaleiro */
export function codeShield(kind = 'madeira') {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#8a5a32', map: metalTex('couro'), roughness: 0.8 }), iron = armorMat('#7a7f88'), strap = armorMat('#4a3220', 'couro');
  if (kind === 'broquel') {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 36, 14, 0, Math.PI * 2, 0, Math.PI * 0.32), armorMat('#b8bec8')); d.scale.z = 0.6; d.rotation.x = Math.PI / 2; g.add(d);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.012, 10, 48), iron); g.add(rim);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), armorMat('#d8c070', 'ouro')); boss.rotation.x = Math.PI / 2; boss.position.z = 0.075; g.add(boss);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), iron); rv.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.02); g.add(rv); }
    g.userData.r = 0.18; return g;
  }
  if (kind === 'cavaleiro') { // escudo de cavaleiro (heater) com borda dourada e sol
    const sh = new THREE.Shape(); sh.moveTo(-0.25, 0.3); sh.lineTo(0.25, 0.3); sh.bezierCurveTo(0.26, 0.0, 0.18, -0.24, 0, -0.38); sh.bezierCurveTo(-0.18, -0.24, -0.26, 0.0, -0.25, 0.3);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 3, curveSegments: 24 }); const P = geo.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, P.getZ(k) - P.getX(k) ** 2 * 0.5); geo.computeVertexNormals();
    const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tabardTex('#f4efe2', '#c9a24a', 'sol'), roughness: 0.6, metalness: 0.2 })); g.add(face);
    const rimG = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: false, curveSegments: 24 }); const rimM = new THREE.Mesh(rimG, armorMat('#d8b45a', 'ouro')); rimM.scale.set(1.04, 1.04, 1); rimM.position.z = -0.012; const RP = rimG.attributes.position; for (let k = 0; k < RP.count; k++) RP.setZ(k, RP.getZ(k) - RP.getX(k) ** 2 * 0.5); rimG.computeVertexNormals(); g.add(rimM);
    face.position.z = 0.006; g.userData.r = 0.3; return g;
  }
  // redondo de madeira (tábuas, aro de ferro, umbo)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 48, 1), wood); disc.rotation.x = Math.PI / 2; g.add(disc);
  for (let k = -3; k <= 3; k++) { const gr = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.56 * Math.sqrt(1 - (k / 3.6) ** 2), 0.003), new THREE.MeshStandardMaterial({ color: '#4a2e18' })); gr.position.set(k * 0.075, 0, 0.0135); g.add(gr); }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.016, 10, 56), iron); g.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), iron); boss.rotation.x = Math.PI / 2; boss.position.z = 0.012; boss.scale.z = 0.8; g.add(boss);
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rv = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), iron); rv.position.set(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.016); g.add(rv); }
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.012), strap); st.position.z = -0.02; g.add(st);
  g.userData.r = 0.29; return g;
}
// prende o escudo no antebraço esquerdo, de face para fora, encostado no braço (S-195: não flutua)
function strapShield(root, shield) {
  humanIdlePose(root);
  const fore = bone(root, 'lowerarm_l'), hand = bone(root, 'hand_l'), el = rootPos(root, fore), wr = rootPos(root, hand), side = Math.sign(wr.x || 1);
  const n = new THREE.Vector3(side, 0, 0.35).normalize(), up = wr.clone().sub(el).multiplyScalar(-1).normalize(); up.sub(n.clone().multiplyScalar(up.dot(n))).normalize();
  const xA = new THREE.Vector3().crossVectors(up, n), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, up, n));
  const holder = new THREE.Group(); fore.add(holder); fitToBone(root, fore, holder, q, el.clone().lerp(wr, 0.5).add(n.clone().multiplyScalar(0.045)));
  holder.add(shield); shield.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items.shield = shield; return shield;
}
const SHIELD_KIND = { escudo_madeira: 'madeira', broquel_ferro: 'broquel' };
/* arco de verdade (S-200): recurvo de madeira laminada, empunhadura de couro, corda; na mão esquerda, em pé */
export function codeBow(opt = {}) {
  const g = new THREE.Group(), H = opt.h || 1.25, wood = new THREE.MeshStandardMaterial({ color: opt.wood || '#6b3f1c', map: metalTex('couro'), roughness: 0.55 }), tip = new THREE.MeshStandardMaterial({ color: opt.tip || '#e8dcc0', roughness: 0.5 });
  const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24 * 2 - 1, y = t * H / 2, a = Math.abs(t); pts.push(new THREE.Vector3(0, y, -0.11 * (1 - a * a) + (a > 0.82 ? (a - 0.82) * 0.55 : 0))); } // curva + pontas recurvas para a frente
  const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 64, 1, 10, false), P = tube.attributes.position;
  for (let k = 0; k < P.count; k++) { const i = Math.floor(k / 11), t = i / 64, a = Math.abs(t * 2 - 1), c = curve.getPointAt(t), r = 0.014 + 0.013 * (1 - a) ** 1.5; const v = new THREE.Vector3(P.getX(k), P.getY(k), P.getZ(k)).sub(c); v.x *= 1.35; P.setXYZ(k, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r * 0.75); }
  tube.computeVertexNormals(); g.add(new THREE.Mesh(tube, wood));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 16), new THREE.MeshStandardMaterial({ color: '#3a2216', map: metalTex('couro'), roughness: 0.9 })); grip.position.z = -0.11; g.add(grip);
  for (const s of [-1, 1]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), tip); n.position.copy(pts[s > 0 ? 24 : 0]); g.add(n); }
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, H * 0.985, 6), new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.6 })); str.position.z = pts[24].z - 0.002; g.add(str);
  if (opt.glow) g.traverse(o => { if (o.isMesh && o !== str) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(opt.glow); o.material.emissiveIntensity = 0.5; } });
  g.userData.gripZ = -0.11; return g;
}
/* S-312: arco no estilo Skyrim/WoW — fora de combate vai NAS COSTAS (atravessado, da ponta no ombro direito ao quadril esquerdo, corda
   encostada nas costas); em combate vai para a MÃO ESQUERDA com a empunhadura DENTRO do punho fechado (cabo do mindinho ao indicador),
   ventre do arco para o alvo e corda para o arqueiro. root.userData.bowState('back' | 'hand') troca o lugar. */
function holdBow(root, bow) {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const hand = bone(root, 'hand_l'), sp = bone(root, 'spine_03') || bone(root, 'spine_02'), F = fistFrame(root, 'l');
  const basis = (Y, Z) => { const y = Y.clone().normalize(), z = Z.clone().sub(y.clone().multiplyScalar(Z.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
  const inHand = new THREE.Group(); hand.add(inHand);
  if (F) fitToBone(root, hand, inHand, basis(F.A, F.E.clone().multiplyScalar(-1)), F.C); // eixo do arco = eixo do cabo no punho; ventre para fora dos nós dos dedos
  else { const kn = bone(root, 'middle_01_l'), at = kn ? rootPos(root, kn).lerp(rootPos(root, hand), 0.4) : rootPos(root, hand); fitToBone(root, hand, inHand, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, -Math.PI / 2 + 0.2, 0.05)), at); }
  const onBack = new THREE.Group(); (sp || root).add(onBack);
  if (sp) { const c = rootPos(root, sp), shR = bone(root, 'upperarm_r'), shL = bone(root, 'upperarm_l'), w = shR && shL ? rootPos(root, shL).distanceTo(rootPos(root, shR)) : 0.34;
    fitToBone(root, sp, onBack, basis(new THREE.Vector3(-0.55, 1, 0), new THREE.Vector3(0, 0, 1)), c.add(new THREE.Vector3(0.0, -0.06, -0.25 - w * 0.03))); } // corda encostada nas costas (a corda fica 11 cm à frente da empunhadura), ventre para fora
  bow.position.z = -bow.userData.gripZ; bow.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items.bow = bow;
  root.userData.bowState = s => { const tgt = s === 'hand' ? inHand : onBack; if (bow.parent !== tgt) { tgt.add(bow); root.userData.bowAt = s; } };
  root.userData.bowState('back');
  return bow;
}
/* cajado de verdade (S-220): madeira retorcida de ~1,5 m, garras de madeira segurando um cristal no topo (sem anéis) */
export function codeStaff(opt = {}) {
  const g = new THREE.Group(), H = opt.h || 1.5, wood = new THREE.MeshStandardMaterial({ color: opt.wood || '#5a3a22', map: metalTex('couro'), roughness: 0.75 });
  const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(Math.sin(t * 9) * 0.008, t * H, Math.cos(t * 7) * 0.008)); }
  const shaft = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 1, 10, false), P = shaft.attributes.position;
  for (let k = 0; k < P.count; k++) { const i = Math.floor(k / 11), t = i / 48, c = new THREE.CatmullRomCurve3(pts).getPointAt(t), r = 0.016 + 0.006 * Math.sin(t * 40) * 0.3 + (t > 0.9 ? (t - 0.9) * 0.12 : 0) - t * 0.003; const v = new THREE.Vector3(P.getX(k), P.getY(k), P.getZ(k)).sub(c); P.setXYZ(k, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
  shaft.computeVertexNormals(); g.add(new THREE.Mesh(shaft, wood));
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2, cl = []; for (let j = 0; j <= 6; j++) { const t = j / 6; cl.push(new THREE.Vector3(Math.cos(a) * (0.02 + Math.sin(t * Math.PI) * 0.045), H - 0.02 + t * 0.15, Math.sin(a) * (0.02 + Math.sin(t * Math.PI) * 0.045))); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cl), 12, 0.007, 6, false), wood)); }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 2), new THREE.MeshStandardMaterial({ color: opt.gem || '#8ab8ff', emissive: opt.gem || '#8ab8ff', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })); gem.scale.y = 1.35; gem.position.y = H + 0.075; g.add(gem);
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#3a2216', map: metalTex('couro'), roughness: 0.9 })); wrap.position.y = H * 0.58; g.add(wrap);
  g.userData.gripY = H * 0.58; return g;
}
/* S-315: cajado DENTRO do punho fechado. Com o braço pendurado, o "furo" do punho fica na horizontal — por isso, fora dos golpes,
   o braço do cajado dobra (cinemática inversa de 2 ossos): cotovelo para trás, antebraço à frente, punho na altura do quadril e
   o cajado em pé, com o pé quase no chão. Ao conjurar/golpear o braço volta para a animação (o cajado acompanha a mão). */
const STAFF_FREE = /Sword_Attack|Melee|Punch|Hit_|Death|Jump|Sit|Interact|PickUp|Roll/; // a magia sai da mão livre: o cajado segue em pé na outra
const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikC = new THREE.Vector3(), _ikD = new THREE.Vector3(), _ikQ = new THREE.Quaternion(), _ikQ2 = new THREE.Quaternion(), _ikM = new THREE.Matrix4(), _ikM2 = new THREE.Matrix4();
function setWorldQuat(b, qw) { b.parent.getWorldQuaternion(_ikQ2).invert(); b.quaternion.copy(_ikQ2.multiply(qw)); b.updateMatrixWorld(true); }
function holdStaff(root, staff, fx, ch, side = 'r') {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const ua = bone(root, 'upperarm_' + side), la = bone(root, 'lowerarm_' + side), hand = bone(root, 'hand_' + side), F = fistFrame(root, side);
  if (!ua || !la || !hand || !F) return staff;
  const L1 = ua.getWorldPosition(_v()).distanceTo(la.getWorldPosition(_v())), L2 = la.getWorldPosition(_v()).distanceTo(hand.getWorldPosition(_v()));
  // a mira do braço (espaço do personagem): punho à frente do quadril, um pouco para fora
  const S0 = rootPos(root, ua), sx = side === 'r' ? -1 : 1, tgt = new THREE.Vector3(S0.x + sx * 0.06, S0.y - L1 * 0.97, S0.z + L2 * 0.82);
  // o punho medido no espaço do osso da mão (fixo): eixo do cabo (A), direção dos dedos (E) e centro (C)
  const hq = hand.getWorldQuaternion(new THREE.Quaternion()).invert(), rq = root.getWorldQuaternion(new THREE.Quaternion());
  const aH = F.A.clone().applyQuaternion(rq).applyQuaternion(hq).normalize(), eH = F.E.clone().applyQuaternion(rq).applyQuaternion(hq).normalize();
  const cH = hand.worldToLocal(root.localToWorld(F.C.clone().add(F.E.clone().multiplyScalar(-0.026)))); // o cabo no meio do punho (não rente aos nós dos dedos)
  const grip = Math.max(0.5, Math.min(staff.userData.gripY + 0.25, tgt.y - 0.03)); // pé do cajado rente ao chão (anão tem a mão mais baixa)
  const holder = new THREE.Group(); hand.add(holder);
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aH); holder.position.copy(cH);
  staff.position.y = -grip; holder.add(staff); staff.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items['2H_Staff'] = staff;
  const curl = handGrip(root, side, 1);
  let w = 0, last = null;
  if (fx) fx.push(tt => {
    const now = performance.now(), dt = last === null || !(tt > last) ? 0.016 : Math.min(0.1, tt - last); last = tt;
    const an = ch && ch.anim ? ch.anim.name || '' : 'Idle'; void now;
    w += ((STAFF_FREE.test(an) ? 0 : 1) - w) * Math.min(1, dt * 9);
    if (w > 0.01) {
      root.updateMatrixWorld(true);
      const S = ua.getWorldPosition(_ikA), E = la.getWorldPosition(_ikB), T = root.localToWorld(_ikC.copy(tgt));
      const d = Math.min(S.distanceTo(T), (L1 + L2) * 0.999), dir = _ikD.copy(T).sub(S).normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const pole = new THREE.Vector3(sx * 0.35, -0.1, -1).applyQuaternion(root.getWorldQuaternion(_ikQ)); pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const E2 = S.clone().add(dir.clone().multiplyScalar(a)).add(pole.multiplyScalar(h));
      _ikQ.setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()); _ikQ.slerp(new THREE.Quaternion(), 1 - w);
      setWorldQuat(ua, _ikQ.multiply(ua.getWorldQuaternion(_ikQ2.identity()).clone()));
      const E3 = la.getWorldPosition(_v()), H = hand.getWorldPosition(_v());
      _ikQ.setFromUnitVectors(H.sub(E3).normalize(), T.clone().sub(E3).normalize()); _ikQ.slerp(new THREE.Quaternion(), 1 - w);
      setWorldQuat(la, _ikQ.multiply(la.getWorldQuaternion(_ikQ2.identity()).clone()));
      // a mão: eixo do punho em pé (leve inclinação para a frente), dedos apontando para a frente/fora
      const rqw = root.getWorldQuaternion(new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0.1).normalize().applyQuaternion(rqw);
      const fore = T.clone().sub(E3).normalize(); fore.sub(up.clone().multiplyScalar(fore.dot(up))).normalize();
      _ikM.makeBasis(up, fore, new THREE.Vector3().crossVectors(up, fore)); _ikM2.makeBasis(aH, eH, new THREE.Vector3().crossVectors(aH, eH));
      const want = new THREE.Quaternion().setFromRotationMatrix(_ikM.multiply(_ikM2.invert())), cur = hand.getWorldQuaternion(new THREE.Quaternion());
      setWorldQuat(hand, cur.slerp(want, w));
    }
    curl();
  });
  return staff;
}
/* S-314: livro do Sábio (como o sábio do RO) — tomo fechado de capa de couro com cantoneiras e fecho de latão, gravado com os
   quatro elementos; segurado pela LOMBADA dentro da mão esquerda fechada (dedos numa capa, polegar na outra), pendendo junto da coxa */
let _bookTex = null;
function bookCoverTex() {
  if (_bookTex) return _bookTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 360; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 360); g.addColorStop(0, '#2f5a4a'); g.addColorStop(1, '#1d3a30'); x.fillStyle = g; x.fillRect(0, 0, 256, 360);
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; x.fillRect(Math.random() * 256, Math.random() * 360, 2, 2); }
  x.strokeStyle = '#c9a24a'; x.lineWidth = 6; x.strokeRect(16, 16, 224, 328); x.lineWidth = 2; x.strokeRect(28, 28, 200, 304);
  const els = [['#ff7a3d', 0], ['#4aa8ff', 1], ['#c9a24a', 2], ['#cfeedd', 3]]; // fogo, água, terra, vento em losango
  x.save(); x.translate(128, 180);
  for (const [col, i] of els) { const a = i * Math.PI / 2 - Math.PI / 2; x.fillStyle = col; x.beginPath(); x.arc(Math.cos(a) * 44, Math.sin(a) * 44, 13, 0, 7); x.fill(); x.strokeStyle = '#e8c870'; x.lineWidth = 2; x.stroke(); }
  x.strokeStyle = '#e8c870'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 44, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, 16, 0, 7); x.stroke(); x.restore();
  _bookTex = new THREE.CanvasTexture(c); _bookTex.colorSpace = THREE.SRGBColorSpace; _bookTex.anisotropy = 4; return _bookTex;
}
export function codeBook() { // y = lombada (comprimento), x = largura (sai da lombada), z = espessura; a lombada fica em x = 0
  const g = new THREE.Group(), W = 0.16, Hh = 0.23, T = 0.045, cover = new THREE.MeshStandardMaterial({ map: bookCoverTex(), roughness: 0.8 }), leather = new THREE.MeshStandardMaterial({ color: '#21402f', map: metalTex('couro'), roughness: 0.85 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.35 }), pages = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.95 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W - 0.008, Hh - 0.012, T - 0.012), pages); block.position.set(W / 2 + 0.002, 0, 0); g.add(block);
  for (const s of [-1, 1]) { const cv = new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, Hh, 0.006), s > 0 ? cover : leather); cv.position.set(W / 2, 0, s * (T / 2 - 0.003)); g.add(cv); }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(T / 2, T / 2, Hh, 16, 1, false, Math.PI / 2, Math.PI), leather); spine.position.set(0, 0, 0); spine.rotation.y = Math.PI; g.add(spine);
  for (const y of [-0.07, 0, 0.07]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(T / 2 + 0.0025, T / 2 + 0.0025, 0.007, 16, 1, false, Math.PI / 2, Math.PI), leather); r.rotation.y = Math.PI; r.position.set(0, y, 0); g.add(r); } // nervuras da lombada (rentes, de couro)
  for (const [cx, cy] of [[W, Hh / 2], [W, -Hh / 2]]) for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.004), brass); k.position.set(cx - 0.011, cy - Math.sign(cy) * 0.011, s * (T / 2 + 0.001)); g.add(k); } // cantoneiras
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, T + 0.01), brass); clasp.position.set(W + 0.006, 0, 0); g.add(clasp);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function holdBook(root, book, fx, side = 'l') {
  humanIdlePose(root); const hand = bone(root, 'hand_' + side), F = fistFrame(root, side); if (!hand || !F) return book;
  // lombada ao longo do "furo" do punho (A), o livro saindo pela frente dos dedos (E), a espessura na direção da palma
  const A = F.A.clone(), E = F.E.clone().sub(A.clone().multiplyScalar(F.E.dot(A))).normalize(), N = new THREE.Vector3().crossVectors(E, A).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(E, A, N));
  const holder = new THREE.Group(); hand.add(holder); fitToBone(root, hand, holder, q, F.C.clone().add(E.clone().multiplyScalar(-0.012)));
  holder.add(book); root.userData.items = root.userData.items || {}; root.userData.items.Spellbook = book;
  const curl = handGrip(root, side, 0.8); if (fx) fx.push(() => curl());
  return book;
}
/* adaga de verdade (S-202): uma só, na mão direita */
export function codeDagger(opt = {}) {
  const g = new THREE.Group(), steel = armorMat(opt.glow ? '#3a2a5a' : '#c8ced8'), dark = new THREE.MeshStandardMaterial({ color: '#2a1c14', map: metalTex('couro'), roughness: 0.9 }), brass = armorMat('#b89a4a', 'ouro');
  const sh = new THREE.Shape(); sh.moveTo(-0.018, 0); sh.lineTo(0.018, 0); sh.quadraticCurveTo(0.02, 0.14, 0, 0.24); sh.quadraticCurveTo(-0.02, 0.14, -0.018, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.004, bevelSegments: 2 }), steel); blade.position.z = -0.0015; g.add(blade);
  if (opt.glow) blade.material = glowMat(opt.glow, 0.8, { metalness: 0.6 });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.016), brass); g.add(guard);
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.095, 12), dark); hd.position.y = -0.052; g.add(hd);
  const pm = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), brass); pm.position.y = -0.104; g.add(pm);
  return g;
}
function holdDagger(root, dagger) {
  humanIdlePose(root); const hand = bone(root, 'hand_r'), kn = bone(root, 'middle_01_r'), at = kn ? rootPos(root, kn).lerp(rootPos(root, hand), 0.35) : rootPos(root, hand);
  const holder = new THREE.Group(); hand.add(holder);
  let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.25, 0, 0)); // lâmina para a frente, um pouco para cima (pegada firme, não "garra")
  // S-292: o cabo passa POR DENTRO do punho fechado (centro dos dedos dobrados), atravessado do mindinho para o indicador — não colado nos nós dos dedos
  const fb = ['index_02_r', 'middle_02_r', 'ring_02_r', 'pinky_02_r'].map(n => bone(root, n)).filter(Boolean), i1 = bone(root, 'index_01_r'), p1 = bone(root, 'pinky_01_r');
  if (fb.length === 4 && i1 && p1) {
    const C = fb.reduce((s, b) => s.add(rootPos(root, b)), new THREE.Vector3()).multiplyScalar(0.25).lerp(rootPos(root, hand), 0.18), A = rootPos(root, i1).sub(rootPos(root, p1)).normalize();
    A.lerp(new THREE.Vector3(0, 0, 1), 0.25).normalize(); // um pouco para a frente
    q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A);
    fitToBone(root, hand, holder, q, C.add(A.clone().multiplyScalar(0.052 * 1.3)));
  } else fitToBone(root, hand, holder, q, at.add(new THREE.Vector3(-0.005, -0.012, 0.01)));
  dagger.scale.setScalar(1.3); holder.add(dagger); dagger.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items.Knife = dagger; return dagger;
}
/* ---------------- KATAR (punhal de soco) do Executor ----------------
   Peça em espaço próprio: x = atravessado no punho (mindinho → indicador), y = para a frente (pulso → punho → ponta),
   z = espessura (normal da palma). Origem = centro da travessa que a mão fecha.
   Punho em H: travessa de couro dentro da mão, duas barras laterais que correm por fora do pulso sobre o antebraço,
   placa frontal logo à frente dos nós dos dedos e lâmina larga triangular de dois gumes com nervura central. */
const _katarCache = {};
function katarBladeGeo(len, w0, th) {
  const L = 28, M = 12, pos = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= L; i++) {
      const t = i / L, half = w0 / 2 * Math.pow(1 - t, 0.8) * (1 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.6))), thick = th * (1 - 0.55 * t);
      for (let j = 0; j <= M; j++) { const u = j / M * 2 - 1; pos.push(u * half, t * len, side * thick * Math.pow(1 - Math.abs(u), 0.85)); }
    }
    for (let i = 0; i < L; i++) for (let j = 0; j < M; j++) { const a = base + i * (M + 1) + j, b = a + M + 1; if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export function codeKatar(opt = {}) {
  const key = JSON.stringify(opt), g = new THREE.Group();
  const steel = _katarCache['s' + key] || (_katarCache['s' + key] = opt.glow ? glowMat(opt.glow, 0.55, { metalness: 0.7, roughness: 0.28, color: opt.steel || '#3a2a5a' }) : new THREE.MeshStandardMaterial({ color: opt.steel || '#eef2f7', map: metalTex('aco'), roughness: 0.3, metalness: 0.5, emissive: '#2a3038', emissiveIntensity: 0.35 }));
  const frame = _katarCache['f' + key] || (_katarCache['f' + key] = opt.gold ? armorMat('#c9a24a', 'ouro') : new THREE.MeshStandardMaterial({ color: opt.frame || '#9aa0aa', map: metalTex('aco'), roughness: 0.4, metalness: 0.5 }));
  const leather = _katarCache.lea || (_katarCache.lea = new THREE.MeshStandardMaterial({ color: '#3a2216', map: metalTex('couro'), roughness: 0.85 }));
  const len = opt.len || 0.34, W = 0.112, bx = W / 2; // barras por fora da mão
  // lâmina
  const blade = new THREE.Mesh(katarBladeGeo(len, opt.width || 0.072, 0.0065), steel); blade.position.y = 0.072; g.add(blade);
  // fio da nervura (linha clara) e reforço da base
  const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0024, len * 0.62, 6), steel); rib.position.y = 0.072 + len * 0.31; for (const s of [1, -1]) { const r2 = rib.clone(); r2.position.z = s * 0.0062; g.add(r2); }
  const ric = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.07, 6, 16), frame); ric.rotation.z = Math.PI / 2; ric.scale.set(1, 1, 1.6); ric.position.y = 0.072; g.add(ric); // reforço onde a lâmina nasce
  // placa frontal (liga as barras e segura a lâmina), arredondada
  const plate = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, W - 0.018, 6, 18), frame); plate.rotation.z = Math.PI / 2; plate.scale.set(1, 1, 1.35); plate.position.y = 0.06; g.add(plate);
  // barras laterais (achatadas, correm por fora do pulso sobre o antebraço, terminam arredondadas e um pouco abertas)
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.2, 6, 14), frame); bar.scale.set(1, 1, 2.4); bar.position.set(s * bx, -0.045, 0); bar.rotation.z = s * 0.06; g.add(bar);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), frame); knob.position.set(s * (bx + 0.008), -0.152, 0); g.add(knob);
  }
  // travessa (a mão fecha aqui): cilindro com tiras de couro
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, W - 0.004, 18), leather); grip.rotation.z = Math.PI / 2; g.add(grip);
  for (let k = -3; k <= 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0118, 0.0016, 6, 18), leather); ring.rotation.y = Math.PI / 2; ring.position.x = k * 0.012; g.add(ring); }
  if (opt.second !== false) { const g2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, W - 0.004, 12), frame); g2.rotation.z = Math.PI / 2; g2.position.y = -0.085; g.add(g2); } // 2ª travessa, sobre o pulso
  if (opt.gem) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.009, 2), glowMat(opt.gem, 1.1)); gem.position.set(0, 0.06, 0.013); g.add(gem); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
const KATAR_LOOKS = { katar_de_ferro: {}, katar_rubra: { gold: true, gem: '#ff4a3a', steel: '#e2e6ec' }, katar_do_eclipse: { glow: '#9a5aff', gold: true, gem: '#c8a0ff', len: 0.38 } };
export const katarLook = id => KATAR_LOOKS[id] || {};
// o par: uma katar em cada mão, a travessa no centro do punho fechado, lâmina continuando o antebraço para a frente
export function holdKatars(root, opt = {}) {
  humanIdlePose(root); const out = {};
  for (const s of ['r', 'l']) {
    const hand = bone(root, 'hand_' + s), f = fistFrame(root, s); if (!hand || !f) continue;
    const fore = bone(root, 'lowerarm_' + s), fp = fore ? rootPos(root, fore) : null, wrist = rootPos(root, hand);
    // "para a frente" = do pulso para o punho, mas puxado para a linha do antebraço (katar é a continuação do braço)
    const E = f.E.clone(); if (fp) E.lerp(wrist.clone().sub(fp).normalize(), 0.45).normalize();
    const A = f.A.clone().sub(E.clone().multiplyScalar(f.A.dot(E))).normalize(), N = new THREE.Vector3().crossVectors(A, E).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(A, E, N));
    const holder = new THREE.Group(); hand.add(holder); fitToBone(root, hand, holder, q, f.C.clone());
    const k = codeKatar(opt); holder.add(k); out[s] = k;
  }
  root.userData.items = root.userData.items || {}; root.userData.items.Katar_R = out.r; root.userData.items.Katar_L = out.l;
  root.userData.katar = out; return out;
}
// o jogador tem katar equipada?
export function hasKatar(p) { const w = p && p.equip && p.equip.arma; const it = w && typeof ITEMS !== 'undefined' && ITEMS[w.id]; return !!(it && it.wtype === 'katar'); }
/* =====================================================================================================
   ARMADURAS REFEITAS (S-317/S-318) — referência Skyrim (Ferro/Couro, Aço, Imperial), WoW e Assassin's Creed.
   • Metal de verdade: reflete um céu próprio (mapa de ambiente), com riscos, desgaste nas bordas e rebites —
     nada de "latão" chapado. • Peças em LÂMINAS sobrepostas (fralda, ombreiras, gola, placa da barriga),
     moldadas no corpo (wrapShell) e presas ao osso que as move. • Couro com fivelas e cota de malha nas juntas.
   Guerreiro = couro batido + malha + ferro simples · Cavaleiro = aço azulado de guerra, rebites, ombreiras
   assimétricas, tabardo vermelho da casa · Paladino = aço polido claro com filetes de ouro, sol no peito, capa.
   ===================================================================================================== */
let _aEnv = null;
function armorEnv() {
  if (_aEnv) return _aEnv;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#f2f6fb'); g.addColorStop(0.4, '#b4c2d2'); g.addColorStop(0.5, '#8c877e'); g.addColorStop(0.6, '#5a5046'); g.addColorStop(1, '#221d18');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 8; k++) { const cx = r() * 512, cy = 30 + r() * 70, rad = 25 + r() * 55, h = x.createRadialGradient(cx, cy, 0, cx, cy, rad); h.addColorStop(0, 'rgba(255,255,250,0.75)'); h.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = h; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return (_aEnv = t);
}
// chapa de metal: escovado fino, manchas de uso, riscos, bordas escurecidas e (opcional) fileiras de rebites
function plateTex(rivets) {
  const key = 'plate' + (rivets ? 'R' : ''); if (_tex[key]) return _tex[key];
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'); let s = 23; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, W, W);
  for (let k = 0; k < 2200; k++) { const y = r() * W, a = 0.02 + r() * 0.05; x.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; x.lineWidth = 0.6; x.beginPath(); x.moveTo(r() * W, y); x.lineTo(r() * W, y + (r() - 0.5) * 2); x.stroke(); } // escovado
  for (let k = 0; k < 60; k++) { const cx = r() * W, cy = r() * W, rad = 10 + r() * 60, h = x.createRadialGradient(cx, cy, 0, cx, cy, rad); h.addColorStop(0, `rgba(40,34,28,${0.05 + r() * 0.08})`); h.addColorStop(1, 'rgba(40,34,28,0)'); x.fillStyle = h; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); } // manchas
  for (let k = 0; k < 140; k++) { x.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '20,20,20'},${0.12 + r() * 0.18})`; x.lineWidth = 0.6 + r() * 0.8; x.beginPath(); const a = r() * W, b = r() * W, ang = r() * 6.28, l = 5 + r() * 30; x.moveTo(a, b); x.lineTo(a + Math.cos(ang) * l, b + Math.sin(ang) * l); x.stroke(); } // riscos
  const e = x.createLinearGradient(0, 0, 0, W); e.addColorStop(0, 'rgba(30,26,22,0.28)'); e.addColorStop(0.08, 'rgba(30,26,22,0)'); e.addColorStop(0.92, 'rgba(30,26,22,0)'); e.addColorStop(1, 'rgba(30,26,22,0.3)'); x.fillStyle = e; x.fillRect(0, 0, W, W); // bordas gastas
  if (rivets) for (const v of [0.06, 0.94]) for (let u = 12; u < W; u += 42) { const g = x.createRadialGradient(u - 2, v * W - 2, 0, u, v * W, 7); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9a9a9a'); g.addColorStop(1, 'rgba(20,20,20,0.9)'); x.fillStyle = g; x.beginPath(); x.arc(u, v * W, 6, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_tex[key] = t);
}
function plateRough() {
  if (_tex.plateRough) return _tex.plateRough;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'); let s = 31; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, W, W);
  for (let k = 0; k < 90; k++) { const cx = r() * W, cy = r() * W, rad = 6 + r() * 34, v = r() < 0.5 ? 200 : 60, h = x.createRadialGradient(cx, cy, 0, cx, cy, rad); h.addColorStop(0, `rgba(${v},${v},${v},0.35)`); h.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = h; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (_tex.plateRough = t);
}
const _am = {};
const AM = {
  steel: (color, o = {}) => _am['s' + color + JSON.stringify(o)] || (_am['s' + color + JSON.stringify(o)] = new THREE.MeshStandardMaterial({ color, map: plateTex(!!o.rivets), roughnessMap: plateRough(), metalness: o.metal ?? 0.9, roughness: o.rough ?? 0.42, envMap: armorEnv(), envMapIntensity: o.env ?? 1.0 })),
  gold: (color = '#c9a24a') => _am['g' + color] || (_am['g' + color] = new THREE.MeshStandardMaterial({ color, map: plateTex(false), roughnessMap: plateRough(), metalness: 0.95, roughness: 0.3, envMap: armorEnv(), envMapIntensity: 1.25 })),
  leather: (color) => _am['l' + color] || (_am['l' + color] = new THREE.MeshStandardMaterial({ color, map: metalTex('couro'), bumpMap: metalTex('couro'), bumpScale: 0.6, roughness: 0.68, metalness: 0.02, envMap: armorEnv(), envMapIntensity: 0.25 })),
  mail: (color) => _am['m' + color] || (_am['m' + color] = new THREE.MeshStandardMaterial({ color, map: metalTex('malha'), bumpMap: metalTex('malha'), bumpScale: 1.4, roughness: 0.48, metalness: 0.8, envMap: armorEnv(), envMapIntensity: 0.7 })),
};
// casca moldada num trecho de osso(s); opt.front define a "frente" (para eixos horizontais, como o pé)
function shellOn(root, key, bones, meshRe, A, B, o, mat, pin) {
  const g = wrapCached(root, key, () => wrapShell(sampleBody(root, bones, meshRe), A, B, { bins: 8, sec: 32, smooth: 4, ...o }));
  return pinToBone(root, pin, new THREE.Mesh(g, mat));
}
// LÂMINAS sobrepostas: n faixas de t0 a t1 ao longo de A→B, cada uma levemente mais para dentro que a anterior (a de cima cobre a de baixo)
function lames(root, key, bones, meshRe, A, B, t0, t1, n, o, mat, pin, matLast) {
  for (let k = 0; k < n; k++) {
    const a = t0 + (t1 - t0) * k / n, b = t0 + (t1 - t0) * (k + 1.22) / n;
    shellOn(root, key + 'L' + k, bones, meshRe, A, B, { ...o, t0: a, t1: b, bins: 3, off: (o.off ?? 0.022) - k * (o.step ?? 0.004), th: o.th ?? 0.008, ridge: (t) => (t > 0.82 ? (t - 0.82) * 0.03 : 0) }, k === n - 1 && matLast ? matLast : mat, pin);
  }
}
const AV3 = (p, dx = 0, dy = 0, dz = 0) => new THREE.Vector3(p.x + dx, p.y + dy, p.z + dz);
// PEITORAL anatômico (frente e costas) com quilha central e placa da barriga em lâminas
function breastplate(root, mat, o = {}) {
  const sp1 = bonePos(root, 'spine_01'), nk = bonePos(root, 'neck_01'), A = AV3(sp1, 0, -0.02, 0), B = AV3(nk, 0, -0.035, 0), body = ['spine_01', 'spine_02', 'spine_03'];
  shellOn(root, 'bp' + (o.k || ''), body, /_Body/, A, B, { t0: 0.34, t1: 1, bins: 14, sec: 40, off: o.off ?? 0.026, th: 0.013, smooth: 5, uvRep: 2,
    ridge: (t, a) => Math.max(0, Math.cos(a)) ** 6 * 0.018 * Math.min(1, t * 1.4) + (t > 0.9 ? (t - 0.9) * 0.08 : 0), flare: (t, a) => Math.max(0, Math.cos(a)) * Math.sin(Math.min(1, t) * Math.PI) * 0.012 }, mat, 'spine_02');
  lames(root, 'plack' + (o.k || ''), body, /_Body/, A, B, 0.0, 0.36, 3, { sec: 40, off: (o.off ?? 0.026) + 0.006, arc: o.backOpen ? [-1.7, 1.7] : undefined }, mat, 'spine_02');
}
// FRALDA (saia de lâminas) na cintura + TASSETS que acompanham as coxas
function fauldTassets(root, mat, o = {}) {
  const pv = bonePos(root, 'pelvis'), sp = bonePos(root, 'spine_01');
  lames(root, 'fauld' + (o.k || ''), ['pelvis', 'thigh_l', 'thigh_r'], /_(Body|Legs)/, AV3(pv, 0, sp.y - pv.y + 0.02, 0), AV3(pv, 0, -0.16, 0), 0, 0.5, o.n || 3, { sec: 36, off: 0.03, step: -0.005, flare: (t) => t * 0.02 }, mat, 'pelvis', o.trim);
  if (o.tassets) for (const s of ['l', 'r']) {
    const th = bonePos(root, 'thigh_' + s), ca = bonePos(root, 'calf_' + s);
    lames(root, 'tas' + s + (o.k || ''), ['thigh_' + s], /_Legs/, th, ca, 0.02, 0.42, 3, { sec: 24, off: 0.03, step: -0.004, arc: [-1.25, 1.25] }, mat, 'thigh_' + s, o.trim);
  }
}
// OMBREIRA: cúpula moldada no ombro + lâminas descendo pelo braço (size > 1 = maior, como a do braço do escudo)
function pauldronSet(root, mat, side, o = {}) {
  const ua = bonePos(root, 'upperarm_' + side), la = bonePos(root, 'lowerarm_' + side), c = ua.x > 0 ? -Math.PI / 2 : Math.PI / 2, size = o.size || 1, w = 1.75 + (size - 1) * 0.6;
  shellOn(root, 'pdome' + side + size + (o.k || ''), ['upperarm_' + side], /_(Body|Arms)/, ua, la, { t0: -0.08, t1: 0.16, bins: 6, sec: 32, off: 0.024 * size, th: 0.012, arc: [c - w, c + w],
    ridge: (t, a) => (t < 0.1 ? (0.1 - t) * 0.03 : 0) + Math.max(0, Math.cos(a - c)) ** 10 * 0.008, flare: (t) => Math.max(0, t - 0.6) * 0.04 * size }, mat, 'upperarm_' + side);
  lames(root, 'plame' + side + size + (o.k || ''), ['upperarm_' + side], /_(Body|Arms)/, ua, la, 0.12, 0.12 + 0.11 * (o.n || 3), o.n || 3, { sec: 28, off: 0.026 * size, step: 0.004, arc: [c - w + 0.15, c + w - 0.15], flare: (t) => t * 0.02 * size }, mat, 'upperarm_' + side, o.trim);
}
// BRAÇO: rerebraço, cotoveleira com asa, avambraço e manopla (punho largo + dorso da mão)
function armSet(root, mat, side, o = {}) {
  const ua = bonePos(root, 'upperarm_' + side), la = bonePos(root, 'lowerarm_' + side), hd = bonePos(root, 'hand_' + side), mk = bonePos(root, 'middle_01_' + side);
  if (!o.noRere) shellOn(root, 'nrere' + side, ['upperarm_' + side], /_(Body|Arms)/, ua, la, { t0: 0.48, t1: 0.92, off: 0.012, th: 0.009 }, mat, 'upperarm_' + side);
  shellOn(root, 'vamb' + side, ['lowerarm_' + side], /_(Body|Arms)/, la, hd, { t0: 0.18, t1: 0.86, off: 0.01, th: 0.009, flare: (t) => (t > 0.8 ? (t - 0.8) * 0.12 : 0) }, o.vamb || mat, 'lowerarm_' + side);
  if (!o.noCouter) { const m = ARMOR_PIECES.joint(root, o.trim || mat, 'lowerarm_' + side, 0.15, new THREE.Vector3(0, 0.15, -1), 0.05); m.scale.set(1.25, 0.65, 1.1); }
  if (o.gauntlet && mk) shellOn(root, 'gaunt' + side, ['hand_' + side], /_(Arms|Body)/, hd, mk, { t0: -0.05, t1: 0.95, bins: 6, sec: 24, off: 0.006, th: 0.007, smooth: 3 }, o.gauntlet, 'hand_' + side);
}
// PERNA: coxote, joelheira com asa, greva e escarpe sobre o pé
function legSet(root, mat, side, o = {}) {
  const th = bonePos(root, 'thigh_' + side), ca = bonePos(root, 'calf_' + side), ft = bonePos(root, 'foot_' + side), bl = bonePos(root, 'ball_' + side);
  if (o.cuisse !== false) shellOn(root, 'cuis' + side, ['thigh_' + side], /_Legs/, th, ca, { t0: 0.14, t1: 0.86, off: 0.016, th: 0.01, arc: o.cuisseArc }, mat, 'thigh_' + side);
  if (o.poleyn !== false) { const m = ARMOR_PIECES.joint(root, o.trim || mat, 'calf_' + side, 0.25, new THREE.Vector3(0, 0.1, 1), 0.066); m.scale.set(1.2, 0.75, 1.0); }
  shellOn(root, 'grev' + side, ['calf_' + side], /_(Legs|Feet)/, ca, ft, { t0: 0.1, t1: 0.9, off: 0.014, th: 0.01, flare: (t) => (t > 0.85 ? (t - 0.85) * 0.1 : 0) }, o.greave || mat, 'calf_' + side);
  if (o.sabaton && bl) shellOn(root, 'sab' + side, ['foot_' + side, 'ball_' + side], /_(Feet|Legs)/, ft, bl, { t0: -0.1, t1: 1.05, bins: 6, sec: 24, off: 0.008, th: 0.008, front: new THREE.Vector3(0, 1, 0), arc: [-1.9, 1.9] }, o.sabaton, 'foot_' + side);
}
// GOLA em duas lâminas (gorjal), cinto de couro com fivela, faixa/talabarte
function gorgetSet(root, mat, o = {}) {
  const s3 = bonePos(root, 'spine_03'), nk = bonePos(root, 'neck_01');
  lames(root, 'gorg' + (o.k || ''), ['neck_01', 'spine_03'], /_(Body|Head)/i, AV3(nk, 0, 0.07, 0), AV3(s3, 0, -0.02, 0), 0.0, 0.62, 2, { sec: 36, off: 0.02, step: -0.006, flare: (t) => t * 0.05 }, mat, 'spine_03', o.trim);
}
function beltSet(root, leather, buckleMat) {
  const pv = bonePos(root, 'pelvis');
  shellOn(root, 'belt', ['pelvis', 'spine_01'], /_(Body|Legs)/, AV3(pv, 0, 0.05, 0), AV3(pv, 0, 0.14, 0), { bins: 3, sec: 40, off: 0.04, th: 0.012, smooth: 5 }, leather, 'pelvis');
  const bk = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.014), buckleMat); const inner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.032, 0.016), leather);
  let fz = -1e9; for (const q of sampleBody(root, ['pelvis'], /_Body/)) if (Math.abs(q.y - pv.y - 0.095) < 0.03 && Math.abs(q.x - pv.x) < 0.05) fz = Math.max(fz, q.z);
  for (const m of [bk, inner]) { m.position.set(pv.x, pv.y + 0.095, (fz > -1e8 ? fz : pv.z + 0.13) + 0.06); pinToBone(root, 'pelvis', m); }
}
// abas de tecido da casa (frente e costas), presas no cinto e acompanhando as pernas
function surcoatFlaps(root, base, trim, emblem, len = 0.36) {
  const pv = bonePos(root, 'pelvis'), knee = bonePos(root, 'calf_l'), tex = tabardTex(base, trim, emblem), cloth = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, side: THREE.DoubleSide }), hem = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  for (const a0 of [-0.5, Math.PI - 0.5]) clothSkirt(root, gownGeo(root, { top: pv.y + 0.07, bot: Math.max(knee.y - 0.02, pv.y - len), r0: 0.205, r1: 0.05, arc: [a0, 1.0], seg: 16, pleats: 5, pleatAmp: 0.012, sz: 0.88, seed: a0, hemRows: 1 }), [cloth, hem], 0.04);
}
// emblema em relevo no peito (sol dourado do Paladino, leão da casa do Cavaleiro)
function chestEmblem(root, mat, kind = 'sol', size = 0.11) {
  const s2 = bonePos(root, 'spine_03'); let fz = -1e9; for (const q of sampleBody(root, ['spine_03', 'spine_02'], /_Body/)) if (Math.abs(q.y - s2.y) < 0.05 && Math.abs(q.x - s2.x) < 0.05) fz = Math.max(fz, q.z);
  const sh = new THREE.Shape(), R = size / 2;
  if (kind === 'sol') { for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rr = k % 2 ? R * 0.62 : R; k ? sh.lineTo(Math.sin(a) * rr, Math.cos(a) * rr) : sh.moveTo(0, rr); } sh.closePath(); }
  else { sh.moveTo(0, R); sh.lineTo(R * 0.85, R * 0.55); sh.lineTo(R * 0.7, -R * 0.5); sh.lineTo(0, -R); sh.lineTo(-R * 0.7, -R * 0.5); sh.lineTo(-R * 0.85, R * 0.55); sh.closePath(); } // escudete
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
  const m = new THREE.Mesh(g, mat); m.position.set(s2.x, s2.y + 0.01, (fz > -1e8 ? fz : s2.z + 0.13) + 0.046); pinToBone(root, 'spine_02', m);
  if (kind === 'sol') { const c = new THREE.Mesh(new THREE.SphereGeometry(R * 0.38, 20, 12), mat); c.scale.set(1, 1, 0.45); c.position.copy(m.position).add(new THREE.Vector3(0, 0, 0.012)); pinToBone(root, 'spine_02', c); }
}
// por baixo das placas: cota de malha no tronco/braços e calça escura (sem a camisa verde da roupa base)
function underLayer(root, top, legs) {
  root.traverse(o => { if (!o.isSkinnedMesh || !/_(Arms|Legs|Body)/.test(o.name)) return; o.material = o.material.clone();
    if (/_Legs/.test(o.name)) { o.material.color = new THREE.Color(legs); o.material.map = metalTex('couro'); o.material.metalness = 0.05; o.material.roughness = 0.8; }
    else { o.material.color = new THREE.Color(top); o.material.map = metalTex('malha'); o.material.bumpMap = metalTex('malha'); o.material.bumpScale = 1.2; o.material.metalness = 0.75; o.material.roughness = 0.5; o.material.envMap = armorEnv(); o.material.envMapIntensity = 0.6; } });
}
const ARMOR_BUILD = {
  // Guerreiro: couro batido sobre cota de malha, peitoral de ferro rebitado, uma ombreira de ferro (braço do escudo) e outra de couro
  leve(root) {
    const iron = AM.steel('#9a9ea4', { rivets: true, metal: 0.82, rough: 0.55 }), leather = AM.leather('#6a4a30'), dark = AM.leather('#3e2a1c'), brass = AM.gold('#a8884a');
    underLayer(root, '#8a8e94', '#4a3a2a');
    breastplate(root, iron, { k: 'w', backOpen: true });
    fauldTassets(root, leather, { k: 'w', n: 2, tassets: true });
    pauldronSet(root, iron, 'l', { size: 1.05, n: 2, k: 'w' }); pauldronSet(root, leather, 'r', { size: 0.9, n: 2, k: 'wr' });
    for (const s of ['l', 'r']) { armSet(root, leather, s, { noRere: true, noCouter: true }); legSet(root, leather, s, { cuisse: false, poleyn: false, greave: dark }); }
    beltSet(root, dark, brass);
  },
  // Cavaleiro: placas de aço azulado de guerra (rebites, malha nas juntas), ombreira grande no braço esquerdo, tabardo vermelho da casa
  placas(root) {
    const steel = AM.steel('#7f8ea2', { rivets: true, metal: 0.92, rough: 0.36 }), dark = AM.steel('#5a6676', { metal: 0.9, rough: 0.45 }), leather = AM.leather('#3a2618'), brass = AM.gold('#b08a48');
    underLayer(root, '#6e747c', '#2a2622');
    breastplate(root, steel, { k: 'k' }); gorgetSet(root, dark, { k: 'k' });
    fauldTassets(root, dark, { k: 'k', n: 3, tassets: true });
    pauldronSet(root, steel, 'l', { size: 1.25, n: 4, k: 'k' }); pauldronSet(root, steel, 'r', { size: 0.95, n: 2, k: 'k' });
    for (const s of ['l', 'r']) { armSet(root, steel, s, { gauntlet: dark }); legSet(root, steel, s, { sabaton: dark }); }
    beltSet(root, leather, brass); surcoatFlaps(root, '#6a1a1e', '#c9a24a', 'espadas', 0.4); chestEmblem(root, brass, 'escudete', 0.1);
  },
  // Paladino: aço polido claro com filetes de ouro, gola dourada, sol no peito, abas brancas com sol e capa de pano
  paladino(root, fx) {
    const steel = AM.steel('#d6dade', { metal: 0.93, rough: 0.26, env: 1.15 }), gold = AM.gold('#d4ac52'), leather = AM.leather('#5a3a22');
    underLayer(root, '#9aa0a8', '#4a4640');
    breastplate(root, steel, { k: 'p' }); gorgetSet(root, steel, { k: 'p', trim: gold });
    fauldTassets(root, steel, { k: 'p', n: 3, tassets: true, trim: gold });
    for (const s of ['l', 'r']) { pauldronSet(root, steel, s, { size: 1.12, n: 3, k: 'p', trim: gold }); armSet(root, steel, s, { gauntlet: steel, trim: gold }); legSet(root, steel, s, { sabaton: steel, trim: gold }); }
    beltSet(root, leather, gold); chestEmblem(root, gold, 'sol', 0.12); surcoatFlaps(root, '#f4efe2', '#c9a24a', 'sol', 0.42);
    clothCape(root, fx, '#ece4d2');
  },
};
/* conjuntos de armadura por classe/papel */
const ARMOR_SETS = {
  // guerreiro (S-195): armadura simples — gibão de couro com couraça de aço no peito, ombreiras e braçadeiras de couro
  leve: { cuirass: ['#8d939c', 'aco'], fauld: ['#5a3a22', 'couro'], pauldron: ['#7d838c', 'aco', 0.85], bracer: ['#5a3a22', 'couro'] },
  // cavaleiro: placas escuras completas
  placas: { cuirass: ['#4a5266', 'aco'], fauld: ['#3e4558', 'aco'], pauldron: ['#4a5266', 'aco', 1.0], bracer: ['#4a5266', 'aco'], greave: ['#4a5266', 'aco'], gorget: ['#3e4558', 'aco'], plate: ['#4a5266', 'aco'], under: '#2e3038' },
  // paladino (S-204/S-297): armadura de placas completa (ombreiras moldadas, braços, cotoveleiras, coxotes, joelheiras, grevas), aço claro
  // com filetes dourados, cota de malha por baixo, tabardo branco com sol e capa de pano que não estica nem fica para trás
  paladino: { cuirass: ['#d9d6cc', 'aco'], fauld: ['#c9c4b4', 'aco'], pauldron: ['#dcd8cc', 'aco', 1.05], bracer: ['#d9d6cc', 'aco'], greave: ['#d9d6cc', 'aco'], gorget: ['#d8b45a', 'ouro'], tabard: ['#f6f2e6', '#c9a24a', 'sol'], cape: '#f2ece0', plate: ['#d9d6cc', 'aco'], trim: ['#d8b45a', 'ouro'], under: '#5a5c62' },
  // guarda da vila (S-197): cota de malha, tabardo azul com torre, ombreiras
  guarda: { cuirass: ['#9aa0aa', 'aco'], fauld: ['#5a3a22', 'couro'], pauldron: ['#8a9099', 'aco', 1.0], bracer: ['#5a3a22', 'couro'], greave: ['#8a9099', 'aco'], tabard: ['#2f5aa8', '#e8c860', 'torre'] },
};
export function applyArmor(root, setId, fx = []) {
  if (ARMOR_BUILD[setId] && root.userData.human) { root.userData.outfitKey = root.userData.outfitKey || outfitKey(root); ARMOR_BUILD[setId](root, fx); return; } // S-317/S-318: armaduras refeitas
  const S = ARMOR_SETS[setId]; if (!S || !root.userData.human) return;
  root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
  const M = ([c, k]) => armorMat(c, k);
  if (S.cuirass) ARMOR_PIECES.cuirass(root, M(S.cuirass));
  if (S.fauld) ARMOR_PIECES.fauld(root, M(S.fauld));
  if (S.gorget) ARMOR_PIECES.gorget(root, M(S.gorget));
  if (S.pauldron) for (const s of ['l', 'r']) ARMOR_PIECES.pauldron(root, M(S.pauldron), s, S.pauldron[2] || 1);
  if (S.bracer) for (const s of ['l', 'r']) ARMOR_PIECES.limb(root, M(S.bracer), 'lowerarm_' + s, 'hand_' + s, 0.3, 0.92, 'bracer' + s);
  if (S.greave) for (const s of ['l', 'r']) ARMOR_PIECES.limb(root, M(S.greave), 'calf_' + s, 'foot_' + s, 0.12, 0.8, 'greave' + s);
  if (S.under) root.traverse(o => { if (o.isSkinnedMesh && /_(Arms|Legs|Body)/.test(o.name)) { o.material = o.material.clone(); o.material.color = new THREE.Color(S.under); o.material.map = metalTex('malha'); o.material.metalness = 0.4; o.material.roughness = 0.6; } }); // por baixo das placas: cota de malha, não a camisa verde
  if (S.plate) { // braços e pernas cobertos (rerebraço, cotoveleira, coxote, joelheira)
    const P = M(S.plate), T = S.trim ? M(S.trim) : P;
    for (const s of ['l', 'r']) {
      ARMOR_PIECES.limb(root, P, 'upperarm_' + s, 'lowerarm_' + s, 0.32, 0.95, 'rere' + s);
      ARMOR_PIECES.joint(root, T, 'lowerarm_' + s, 0.1, new THREE.Vector3(0, 0.15, -1), 0.05);
      ARMOR_PIECES.limb(root, P, 'thigh_' + s, 'calf_' + s, 0.1, 0.86, 'cuisse' + s);
      ARMOR_PIECES.joint(root, T, 'calf_' + s, 0.2, new THREE.Vector3(0, 0.1, 1), 0.062);
    }
  }
  if (S.tabard) tabard(root, ...S.tabard, 0.52, !S.cape);
  if (S.cape) clothCape(root, fx, S.cape);
}
/* papéis de NPC (S-193 freira/sacerdotisa, S-197 guarda) — o main3d chama dressNpcRole(ch, n.id, MODELS) */
const NPC_ROLE = { clara: 'sacerdotisa', mirela: 'sacerdotisa', tobias: 'guarda', bastiao: 'guarda', ivra: 'mentora', bento: 'mercador' };
export function dressNpcRole(ch, npcId, MODELS) {
  const role = NPC_ROLE[npcId], root = ch.root; if (!role || !root.userData.human) return null;
  const fx = [];
  if (role === 'guarda') guardKit(root, fx);
  else if (role === 'sacerdotisa') habit(root);
  else if (role === 'mentora') mentorGown(root, fx);
  else if (role === 'mercador') merchantHat(root);
  return fx.length ? t => fx.forEach(f => f(t)) : null;
}
/* mão fechada no cabo (S-291): a cada quadro, depois da animação, dobra as falanges e o polegar em volta do cabo */
const _gq = new THREE.Quaternion(), _gAx = new THREE.Vector3();
export function handGrip(root, side = 'r', k = 1) {
  const list = [];
  for (const f of ['index', 'middle', 'ring', 'pinky']) ['01', '02', '03'].forEach((j, i) => { const b = root.getObjectByName(`${f}_${j}_${side}`); if (b) list.push([b, [0.75, 0.95, 0.7][i] * k, 'x']); }); // (testado) eixo x local dobra as falanges para dentro da palma
  ['02', '03'].forEach((j, i) => { const b = root.getObjectByName(`thumb_${j}_${side}`); if (b) list.push([b, [0.35, 0.4][i] * k, 'x']); });
  return () => { for (const [b, a, ax] of list) { _gAx.set(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0); b.quaternion.multiply(_gq.setFromAxisAngle(_gAx, side === 'r' ? a : a)); } };
}
/* S-289/S-291: guarda da cidade no espírito dos guardas de Skyrim/WoW — cota de malha longa (anéis de verdade) por baixo,
   tabardo de pano azul com a torre (no peito e caindo até os joelhos, acompanhando as pernas), cinto de couro com fivela,
   ombreiras moldadas no ombro, braçadeiras de couro, grevas, elmo aberto com protetor de nariz e a mão FECHADA no cabo. */
function guardKit(root, fx) {
  root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
  dropBorrowed(root, /Knight_Helmet|Knight_Cape/);
  const mail = armorMat('#8a8e96', 'malha'), steel = armorMat('#a2a9b3', 'aco'), leather = armorMat('#4a3020', 'couro');
  const blue = new THREE.MeshStandardMaterial({ color: '#2a4f96', map: metalTex('couro'), roughness: 0.95, side: THREE.DoubleSide }), gold = new THREE.MeshStandardMaterial({ color: '#d8b84e', map: metalTex('couro'), roughness: 0.8, side: THREE.DoubleSide });
  root.traverse(o => { if (o.isSkinnedMesh && /_(Body|Legs|Arms)/.test(o.name)) { o.material = o.material.clone(); o.material.color = new THREE.Color(/_Legs/.test(o.name) ? '#3a3226' : '#6a6e76'); if (!/_Legs/.test(o.name)) { o.material.map = metalTex('malha'); o.material.metalness = 0.45; o.material.roughness = 0.55; } } });
  const pv = bonePos(root, 'pelvis'), knee = bonePos(root, 'calf_l');
  ARMOR_PIECES.cuirass(root, mail, { long: true, off: 0.014 });
  clothSkirt(root, gownGeo(root, { top: pv.y + 0.05, bot: knee.y + 0.02, r0: 0.17, r1: 0.06, pleats: 22, pleatAmp: 0.015, sz: 0.84, seed: 2.2 }), mail, 0.02); // fralda de malha até os joelhos
  // tabardo: no peito (com a torre) e duas abas, frente e costas, que acompanham as pernas
  const tex = tabardTex('#2a4f96', '#d8b84e', 'torre'), tmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide });
  for (const [a0, a1, key] of [[-0.6, 0.6, 'gTabF'], [Math.PI - 0.6, Math.PI + 0.6, 'gTabB']]) {
    const g = wrapCached(root, key, () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], /_Body/), nk = bonePos(root, 'neck_01');
      return wrapShell(pts, new THREE.Vector3(nk.x, pv.y + 0.02, nk.z), new THREE.Vector3(nk.x, nk.y - 0.05, nk.z), { bins: 14, sec: 40, off: 0.036, th: 0.004, smooth: 5, arc: [a0, a1], uvRep: 1 }); });
    pinToBone(root, 'spine_02', new THREE.Mesh(g, tmat));
  }
  for (const a0 of [-0.52, Math.PI - 0.52]) clothSkirt(root, gownGeo(root, { top: pv.y + 0.06, bot: knee.y - 0.04, r0: 0.2, r1: 0.05, arc: [a0, 1.04], seg: 18, pleats: 7, pleatAmp: 0.02, sz: 0.86, seed: a0, hemRows: 1 }), [blue, gold], 0.035);
  // cinto de couro com fivela por cima do tabardo
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 8, 48), leather); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.8, 0.55); belt.position.set(pv.x, pv.y + 0.11, pv.z + 0.01); pinToBone(root, 'pelvis', belt);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.012), armorMat('#c8a24a', 'ouro')); bk.position.set(pv.x, pv.y + 0.11, pv.z + 0.155); pinToBone(root, 'pelvis', bk);
  for (const s of ['l', 'r']) { ARMOR_PIECES.pauldron(root, steel, s, 1); ARMOR_PIECES.limb(root, leather, 'lowerarm_' + s, 'hand_' + s, 0.25, 0.92, 'bracer' + s); ARMOR_PIECES.limb(root, steel, 'calf_' + s, 'foot_' + s, 0.12, 0.78, 'greave' + s); }
  // elmo aberto (calota + aba na testa + protetor de nariz), moldado na cabeça — o rosto fica à mostra
  const hd = bonePos(root, 'Head'), headPts = sampleBody(root, ['Head'], /SuperHero/i); let top = -1e9; for (const q of headPts) top = Math.max(top, q.y);
  const helm = wrapShell(headPts, new THREE.Vector3(hd.x, top - 0.13, hd.z), new THREE.Vector3(hd.x, top + 0.004, hd.z), { bins: 8, sec: 36, off: 0.016, th: 0.01, smooth: 3, ridge: (t, a) => (t < 0.14 ? 0.008 : 0) + Math.max(0, Math.cos(a)) ** 12 * 0.006 });
  pinToBone(root, 'Head', new THREE.Mesh(helm, steel));
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel); capTop.position.set(hd.x, top + 0.008, hd.z); capTop.scale.set(1.6, 0.5, 1.9); pinToBone(root, 'Head', capTop);
  let fz = -1e9; for (const q of headPts) if (q.y > top - 0.16 && q.y < top - 0.09) fz = Math.max(fz, q.z);
  const nasal = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.008), steel); nasal.position.set(hd.x, top - 0.165, fz + 0.022); nasal.rotation.x = -0.12; pinToBone(root, 'Head', nasal);
  hairUnderHat(root, true);
  // espada de guarda feita em código (lâmina com sulco, guarda reta, cabo de couro e pomo), com o cabo POR DENTRO do punho fechado
  dropBorrowed(root, /^1H_Sword$/);
  const sw = new THREE.Group(), bladeM = armorMat('#c4cad3'), brass = armorMat('#8a7448', 'ouro'), grip = new THREE.MeshStandardMaterial({ color: '#3a2216', map: metalTex('couro'), roughness: 0.9 });
  const bs = new THREE.Shape(); bs.moveTo(-0.022, 0); bs.lineTo(0.022, 0); bs.lineTo(0.018, 0.62); bs.lineTo(0, 0.7); bs.lineTo(-0.018, 0.62); bs.closePath();
  const bl = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }), bladeM); bl.position.set(0, 0.02, -0.001); sw.add(bl);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.45, 0.0075), armorMat('#8a9099')); fuller.position.y = 0.27; sw.add(fuller);
  const cg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.016, 0.022), brass); cg.position.y = 0.012; sw.add(cg);
  for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), brass); tip.position.set(s * 0.08, 0.012, 0); sw.add(tip); }
  const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.015, 0.11, 12), grip); gr.position.y = -0.055; sw.add(gr);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), brass); pom.position.y = -0.12; pom.scale.set(1, 0.8, 0.7); sw.add(pom);
  humanIdlePose(root);
  const hand = bone(root, 'hand_r'), fb = ['index_02_r', 'middle_02_r', 'ring_02_r', 'pinky_02_r'].map(n => bone(root, n)).filter(Boolean), i1 = bone(root, 'index_01_r'), p1 = bone(root, 'pinky_01_r');
  if (hand && fb.length === 4 && i1 && p1) {
    const C = fb.reduce((s, b) => s.add(rootPos(root, b)), new THREE.Vector3()).multiplyScalar(0.25).lerp(rootPos(root, hand), 0.3);
    const A = rootPos(root, i1).sub(rootPos(root, p1)).normalize().lerp(new THREE.Vector3(0, -1, 0.3).normalize(), 0.55).normalize(); // a lâmina sai do lado do polegar, apontando para baixo e um pouco à frente (descansando, não ameaçando quem chega)
    const holder = new THREE.Group(); hand.add(holder); fitToBone(root, hand, holder, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A), C.add(A.clone().multiplyScalar(0.055)));
    holder.add(sw); sw.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    root.userData.items = root.userData.items || {}; root.userData.items['1H_Sword'] = sw;
  }
  fx.push(handGrip(root, 'r'));
}
// tira itens emprestados do KayKit que não combinam (cajado gigante, chapéu de bruxa, capa chapada, chapéu de urso)
function dropBorrowed(root, re) { const kill = []; root.traverse(o => { if (o !== root && re.test(o.name || '')) kill.push(o); }); for (const o of kill) if (o.parent) o.parent.remove(o); }
/* S-231: Mestra Ivra — mentora de classes com visual único (no espírito das NPCs de troca de classe do RO):
   vestido longo marfim e azul-petróleo com barra dourada, corpete justo, estola bordada sobre os ombros,
   diadema com gema na testa e um grimório de classes que flutua girando devagar ao lado dela, com runas. */
function mentorGown(root, fx) {
  root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
  dropBorrowed(root, /2H_Staff|Mage_Hat|Mage_Cape|Spellbook/);
  const ivory = new THREE.MeshStandardMaterial({ color: '#efe6d2', map: metalTex('couro'), roughness: 0.85, side: THREE.DoubleSide });
  const teal = new THREE.MeshStandardMaterial({ color: '#1f5a66', map: metalTex('couro'), roughness: 0.8, side: THREE.DoubleSide });
  const gold = armorMat('#d8b45a', 'ouro');
  root.traverse(o => { if (o.isSkinnedMesh && /_Acc/.test(o.name)) o.visible = false; if (o.isSkinnedMesh && /_(Body|Legs|Arms)/.test(o.name)) { o.material = o.material.clone(); o.material.color = /_Arms/.test(o.name) ? new THREE.Color('#f4ead6') : new THREE.Color('#ffffff').lerp(new THREE.Color('#1f5a66'), 0.7); } }); // mangas claras (marfim), não escuras
  // saia longa em dois tecidos que acompanha as pernas: forro azul-petróleo e sobressaia marfim aberta na frente, com pregas e barra dourada
  const pv = bonePos(root, 'pelvis'), top = pv.y + 0.08;
  clothSkirt(root, gownGeo(root, { top, r0: 0.19, r1: 0.2, pleats: 13, pleatAmp: 0.05, sz: 0.84, seed: 0.3 }), teal, 0.03);
  clothSkirt(root, gownGeo(root, { top: top + 0.005, r0: 0.2, r1: 0.22, arc: [Math.PI * 0.12, Math.PI * 1.76], seg: 56, pleats: 15, pleatAmp: 0.045, sz: 0.86, seed: 1.1, hemRows: 1 }), [ivory, gold], 0.05); // aberta na frente (mostra o azul)
  // corpete justo marfim, cinto dourado com fivela
  const bod = wrapCached(root, 'mentorTop', () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], /_Body/), nk = bonePos(root, 'neck_01'), sp = bonePos(root, 'spine_01'); return wrapShell(pts, new THREE.Vector3(nk.x, sp.y - 0.08, nk.z), new THREE.Vector3(nk.x, nk.y - 0.03, nk.z), { bins: 12, sec: 32, off: 0.012, th: 0.006, smooth: 4 }); });
  pinToBone(root, 'spine_02', new THREE.Mesh(bod, ivory));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.011, 8, 40), gold); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.78, 1); belt.position.set(pv.x, pv.y + 0.17, pv.z + 0.005); pinToBone(root, 'pelvis', belt);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 1), new THREE.MeshStandardMaterial({ color: '#5ad8e8', emissive: '#2a9ab0', emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.15 }));
  const buckle = gem.clone(); buckle.position.set(pv.x, pv.y + 0.17, pv.z + 0.12); pinToBone(root, 'pelvis', buckle);
  // estola: duas faixas azul-petróleo com bordado dourado descendo dos ombros pela frente
  const nk = bonePos(root, 'neck_01');
  for (const sx of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.72, 2, 14), teal); { const P = st.geometry.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, -Math.abs(P.getX(k)) * 0.3); st.geometry.translate(0, -0.36, 0); st.geometry.computeVertexNormals(); }
    st.position.set(nk.x + sx * 0.075, nk.y - 0.02, nk.z + 0.13); st.rotation.set(0.12, 0, sx * 0.06); pinToBone(root, 'spine_03', st);
    for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 16), gold); d.position.set(nk.x + sx * 0.075, nk.y - 0.14 - k * 0.15, nk.z + 0.15 + k * 0.008); pinToBone(root, 'spine_03', d); }
  }
  // gola alta marfim com borda dourada atrás do pescoço
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.1, 32, 1, true, Math.PI * 0.35, Math.PI * 1.3), ivory); col.position.set(nk.x, nk.y + 0.02, nk.z - 0.01); pinToBone(root, 'spine_03', col);
  // diadema com gema na testa
  const hd = bonePos(root, 'Head'), headPts = sampleBody(root, ['Head'], /SuperHero/i);
  let top2 = -1e9; for (const q of headPts) top2 = Math.max(top2, q.y);
  const circ = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.007, 8, 48), gold); circ.rotation.x = Math.PI / 2 - 0.3; circ.scale.set(1, 1.12, 1); circ.position.set(hd.x, top2 - 0.075, hd.z + 0.01); pinToBone(root, 'Head', circ);
  const fg = gem.clone(); fg.scale.set(0.5, 0.75, 0.4); fg.position.set(hd.x, top2 - 0.088, hd.z + 0.122); pinToBone(root, 'Head', fg);
  // grimório das classes flutuando ao lado (capa de couro azul, cantos dourados, páginas claras, runas girando)
  /* S-271: grimório ABERTO e de pé, virado para quem chega (capa de couro por fora, páginas com texto e iluminuras por dentro,
     fitas marcadoras), e letras douradas/azuis que se soltam das páginas e sobem girando devagar até sumir — fica óbvio que é
     um livro mágico. Coordenadas do livro: lombada em y, páginas abertas para os lados (x), face escrita para +z (frente dela). */
  const book = new THREE.Group(), cov = new THREE.MeshStandardMaterial({ color: '#173c48', map: metalTex('couro'), roughness: 0.6 });
  const pageTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 176; const x = c.getContext('2d'); x.fillStyle = '#f3ead2'; x.fillRect(0, 0, 128, 176);
    const gr = x.createRadialGradient(64, 88, 40, 64, 88, 110); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,90,40,0.25)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 176);
    x.fillStyle = '#9a2a1e'; x.font = 'bold 26px Georgia, serif'; x.fillText('A', 12, 36); x.fillStyle = '#3a2a1a';
    for (let l = 0; l < 13; l++) { const y = 22 + l * 11, x0 = l < 2 ? 36 : 12; let xx = x0; while (xx < 114) { const w = 4 + Math.random() * 14; x.fillRect(xx, y, Math.min(w, 116 - xx), 2); xx += w + 4; } }
    x.strokeStyle = '#c9a24a'; x.lineWidth = 2; x.strokeRect(6, 6, 116, 164); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pages = new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: 0.9 }), face = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.85, emissive: '#3a3020', emissiveIntensity: 0.25 });
  for (const sx of [-1, 1]) {
    const half = new THREE.Group(); half.rotation.y = sx * 0.32; book.add(half); // as duas metades abertas em V raso
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.008), cov); c.position.set(sx * 0.077, 0, -0.012); half.add(c);
    const pg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.016), pages); pg.position.set(sx * 0.072, 0, 0); half.add(pg);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.134, 0.19), face); f.position.set(sx * 0.072, 0, 0.0085); half.add(f);
    for (const sy of [-1, 1]) { const cn = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.012), gold); cn.position.set(sx * 0.14, sy * 0.095, -0.012); half.add(cn); }
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.21, 10), cov); spine.position.z = -0.014; book.add(spine);
  for (const [c, dx] of [['#9a2a1e', -0.01], ['#c9a24a', 0.012]]) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.09, 0.002), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide })); rib.position.set(dx, -0.14, 0.006); book.add(rib); }
  // letras que saem das páginas
  const GLY = 'AΩΣΦΨΛΞ✦ᚠᚱᚦᛟᛉ', letters = [];
  for (let k = 0; k < 9; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.shadowColor = k % 2 ? '#8af0ff' : '#ffd77a'; x.shadowBlur = 14; x.fillStyle = k % 2 ? '#dff8ff' : '#fff1c8'; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(GLY[k % GLY.length], 32, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.06); book.add(s); letters.push(s);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.z = 0.03; book.add(glow);
  const holder = new THREE.Group(); holder.position.set(hd.x + 0.5, hd.y - 0.28, hd.z + 0.3); holder.rotation.y = -0.35; holder.scale.setScalar(1.3); holder.add(book); root.add(holder);
  fx.push(t => {
    book.position.y = Math.sin(t * 1.4) * 0.025; book.rotation.set(-0.35 + Math.sin(t * 0.7) * 0.04, Math.sin(t * 0.5) * 0.12, Math.sin(t * 0.9) * 0.03);
    letters.forEach((s, i) => { const k = (t * 0.32 + i / letters.length) % 1, side = i % 2 ? 1 : -1; s.position.set(side * (0.04 + Math.sin(k * 5 + i) * 0.03) + Math.sin(t + i) * 0.01, -0.02 + k * 0.32, 0.03 + k * 0.12); s.material.opacity = Math.min(1, k * 5) * (1 - k * 0.8); s.scale.setScalar(0.075 + k * 0.045); s.material.rotation = Math.sin(t * 1.3 + i) * 0.4; });
    glow.material.opacity = 0.1 + Math.sin(t * 2) * 0.04;
  });
}
/* S-239: Bento — no lugar do "chapéu de urso" do KayKit, um chapéu de mercador de feltro: copa amassada, aba larga
   levemente caída, faixa de couro com fivela e uma pena — assentado na cabeça de verdade */
function merchantHat(root) {
  dropBorrowed(root, /Barbarian_Hat/);
  const hd = bonePos(root, 'Head'), headPts = sampleBody(root, ['Head'], /SuperHero/i);
  let top = -1e9, cx = 0, cz = 0, n = 0; for (const q of headPts) { top = Math.max(top, q.y); } for (const q of headPts) if (q.y > top - 0.08) { cx += q.x; cz += q.z; n++; } cx /= n || 1; cz /= n || 1;
  const felt = new THREE.MeshStandardMaterial({ color: '#6a4a2e', map: metalTex('couro'), roughness: 0.95, side: THREE.DoubleSide });
  const hat = new THREE.Group();
  const crown = new THREE.LatheGeometry([[0.0, 0.13], [0.06, 0.128], [0.1, 0.11], [0.112, 0.07], [0.115, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  { const P = crown.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), z = P.getZ(k), y = P.getY(k); if (y > 0.115) P.setY(k, y - Math.max(0, 0.03 - Math.abs(x) * 0.5)); P.setZ(k, z * 1.12); } crown.computeVertexNormals(); } // vinco no topo, copa oval
  hat.add(new THREE.Mesh(crown, felt));
  const brim = new THREE.RingGeometry(0.1, 0.22, 48, 3); { const P = brim.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), r = Math.hypot(x, y), a = Math.atan2(y, x); P.setXYZ(k, x, y * 1.1, -(r - 0.1) * 0.25 * (0.6 + 0.4 * Math.cos(a * 2))); } brim.rotateX(-Math.PI / 2); brim.computeVertexNormals(); }
  hat.add(new THREE.Mesh(brim, felt));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.117, 0.03, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#2e1c10', roughness: 0.7 })); band.position.y = 0.025; band.scale.z = 1.12; hat.add(band);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.006), armorMat('#c8a24a', 'ouro')); bk.position.set(0, 0.025, 0.131); hat.add(bk);
  const feather = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: '#c8402a', roughness: 0.8 })); feather.scale.set(0.35, 3.2, 0.9); feather.position.set(0.1, 0.09, -0.04); feather.rotation.z = -0.7; hat.add(feather);
  hat.position.set(cx, top - 0.045, cz + 0.005); hat.rotation.x = -0.06;
  hat.traverse(o => { if (o.isMesh) o.castShadow = true; });
  pinToBone(root, 'Head', hat);
  hairUnderHat(root, true);
}
/* S-270: sacerdotisa da Capela do Sol (Irmã Clara, Irmã Mirela) — túnica longa marfim que acompanha as pernas, com barra dourada;
   estola vinho bordada caindo pela frente; manto curto azul-noite sobre os ombros; véu macio de tecido que cobre a cabeça e cai
   nas costas (o rosto livre, sem touca dura); cordão dourado na cintura com o livro de orações PENDURADO (nada de livro flutuando
   na mão) e o medalhão do sol no peito. */
function habit(root) {
  root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
  dropBorrowed(root, /Spellbook|Mage_Cape|Mage_Hat/);
  const T = (c, r = 0.92) => new THREE.MeshStandardMaterial({ color: c, map: metalTex('couro'), roughness: r, side: THREE.DoubleSide });
  const ivory = T('#f1ead8'), wine = T('#6e1f2e', 0.85), night = T('#1f2a4a', 0.9), gold = armorMat('#d8b45a', 'ouro'), goldC = T('#d8b45a', 0.7);
  root.traverse(o => { if (o.isSkinnedMesh && /_(Body|Legs|Arms)/.test(o.name)) { o.material = o.material.clone(); o.material.color = new THREE.Color(/_Arms/.test(o.name) ? '#efe6d2' : '#e8e0cc'); } if (o.isSkinnedMesh && /_Acc/.test(o.name)) o.visible = false; }); // sem a bolsinha de couro da roupa de camponês (furava a túnica atrás)
  const pv = bonePos(root, 'pelvis'), nk = bonePos(root, 'neck_01');
  clothSkirt(root, gownGeo(root, { top: pv.y + 0.08, r0: 0.16, r1: 0.15, pleats: 14, pleatAmp: 0.05, sz: 0.82, seed: 0.8, hemRows: 1 }), [ivory, goldC], 0.03);
  const top = wrapCached(root, 'robeTop', () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], /_Body/), sp = bonePos(root, 'spine_01'); return wrapShell(pts, new THREE.Vector3(nk.x, sp.y - 0.08, nk.z), new THREE.Vector3(nk.x, nk.y - 0.02, nk.z), { bins: 12, sec: 32, off: 0.012, th: 0.006, smooth: 4 }); });
  pinToBone(root, 'spine_02', new THREE.Mesh(top, ivory));
  // manto curto (capelete) sobre os ombros e a parte de cima do peito/costas
  const cap = wrapCached(root, 'priestCape', () => { const pts = sampleBody(root, ['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'neck_01'], /_(Body|Arms)/); return wrapShell(pts, new THREE.Vector3(nk.x, nk.y - 0.3, nk.z), new THREE.Vector3(nk.x, nk.y + 0.01, nk.z), { bins: 10, sec: 40, off: 0.03, th: 0.006, smooth: 5, flare: t => (t < 0.4 ? (0.4 - t) * 0.08 : 0) }); });
  pinToBone(root, 'spine_03', new THREE.Mesh(cap, night));
  // estola vinho: duas faixas na frente, do pescoço até abaixo dos joelhos, presas por cima do manto (acompanham o corpo)
  for (const a0 of [-0.42, 0.18]) clothSkirt(root, gownGeo(root, { top: pv.y + 0.13, bot: 0.42, r0: 0.175, r1: 0.16, arc: [a0, 0.24], seg: 6, pleats: 3, pleatAmp: 0.01, sz: 0.84, seed: a0, hemRows: 1 }), [wine, goldC], 0.04);
  for (const sx of [-1, 1]) { const g = wrapCached(root, 'stole' + sx, () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], /_Body/); const a = sx < 0 ? -0.42 : 0.18; return wrapShell(pts, new THREE.Vector3(nk.x, pv.y + 0.05, nk.z), new THREE.Vector3(nk.x, nk.y - 0.24, nk.z), { bins: 10, sec: 60, off: 0.048, th: 0.005, smooth: 4, arc: [a, a + 0.24], uvRep: 1 }); }); pinToBone(root, 'spine_02', new THREE.Mesh(g, wine)); }
  // véu: tecido macio por cima da cabeça, caindo atrás até os ombros (rosto livre) + diadema fino
  const hd = bonePos(root, 'Head'), headPts = sampleBody(root, ['Head', 'neck_01'], /SuperHero/i); let ht = -1e9; for (const q of headPts) ht = Math.max(ht, q.y);
  const veil = wrapShell(headPts, new THREE.Vector3(hd.x, ht - 0.36, hd.z - 0.012), new THREE.Vector3(hd.x, ht + 0.005, hd.z - 0.012), { bins: 16, sec: 40, off: 0.026, th: 0.006, smooth: 4, arc: [0.95, Math.PI * 2 - 0.95], flare: t => (t < 0.45 ? (0.45 - t) * 0.22 : 0) + (t > 0.9 ? (t - 0.9) * 0.1 : 0) });
  pinToBone(root, 'Head', new THREE.Mesh(veil, ivory));
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), ivory); crown.position.set(hd.x, ht - 0.005, hd.z - 0.015); crown.scale.set(1.45, 0.45, 1.6); pinToBone(root, 'Head', crown);
  const circ = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.005, 8, 48), gold); circ.rotation.x = Math.PI / 2 - 0.28; circ.scale.set(1, 1.12, 1); circ.position.set(hd.x, ht - 0.07, hd.z + 0.01); pinToBone(root, 'Head', circ);
  hairUnderHat(root, true);
  veilFringe(root); // S-306: nada de careca — o cabelo aparece sob o véu
  // cordão dourado na cintura com borla, livro de orações pendurado no quadril e medalhão do sol no peito
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.009, 8, 48), gold); cord.rotation.x = Math.PI / 2; cord.scale.set(1, 0.8, 1); cord.position.set(pv.x, pv.y + 0.1, pv.z + 0.01); pinToBone(root, 'pelvis', cord);
  const sideX = pv.x + 0.17, book = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.11), T('#5a2a1a', 0.7)); book.add(cover);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.14, 0.1), T('#efe6cc', 0.95)); pages.position.z = 0.006; book.add(pages);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.02, 0.03), gold); clasp.position.z = 0.05; book.add(clasp);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 6), gold); chain.position.set(0, 0.11, 0); book.add(chain);
  book.position.set(sideX, pv.y - 0.06, pv.z + 0.03); book.rotation.set(0, 0, 0.08); pinToBone(root, 'pelvis', book);
  const sun = new THREE.Group(), disc = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 24), gold); disc.rotation.x = Math.PI / 2; sun.add(disc);
  for (let k = 0; k < 12; k++) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 4), gold); const a = k / 12 * Math.PI * 2; r.position.set(Math.cos(a) * 0.036, Math.sin(a) * 0.036, 0); r.rotation.z = a - Math.PI / 2; sun.add(r); }
  sun.position.set(nk.x, nk.y - 0.17, nk.z + 0.19); pinToBone(root, 'spine_03', sun);
}
function habitOld(root) {
  root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
  const robe = new THREE.MeshStandardMaterial({ color: '#2a2630', map: metalTex('couro'), roughness: 0.95, side: THREE.DoubleSide }), white = new THREE.MeshStandardMaterial({ color: '#f2efe8', map: metalTex('couro'), roughness: 0.9, side: THREE.DoubleSide });
  root.traverse(o => { if (o.isSkinnedMesh && /_(Body|Legs|Arms)/.test(o.name)) { o.material = o.material.clone(); o.material.color = new THREE.Color('#ffffff').lerp(new THREE.Color('#2a2630'), 0.8); } });
  // túnica do peito até os pés, com pregas, que acompanha as pernas ao andar
  const pv = bonePos(root, 'pelvis');
  clothSkirt(root, gownGeo(root, { top: pv.y + 0.08, r0: 0.16, r1: 0.13, pleats: 11, pleatAmp: 0.06, sz: 0.82, seed: 0.8 }), robe, 0.03);
  // corpo: couraça de pano (mesma técnica da armadura) por cima da blusa
  const top = wrapCached(root, 'robeTop', () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis'], /_Body/), nk = bonePos(root, 'neck_01'), sp = bonePos(root, 'spine_01'); return wrapShell(pts, new THREE.Vector3(nk.x, sp.y - 0.08, nk.z), new THREE.Vector3(nk.x, nk.y - 0.02, nk.z), { bins: 12, sec: 32, off: 0.012, th: 0.006, smooth: 4 }); });
  pinToBone(root, 'spine_02', new THREE.Mesh(top, robe));
  // escapulário branco na frente
  const nk = bonePos(root, 'neck_01'), sc = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.95, 2, 12), white); { const P = sc.geometry.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, -Math.abs(P.getX(k)) * 0.4); sc.geometry.translate(0, -0.475, 0); sc.geometry.computeVertexNormals(); }
  sc.position.set(nk.x, nk.y - 0.08, nk.z + 0.155); sc.rotation.x = 0.06; pinToBone(root, 'spine_02', sc);
  // véu: casca em volta da cabeça (deixa o rosto livre) que desce sobre os ombros + touca branca em volta do rosto
  const hd = bonePos(root, 'Head'), headPts = sampleBody(root, ['Head', 'neck_01'], /SuperHero/i);
  const veilG = wrapShell(headPts, new THREE.Vector3(hd.x, hd.y - 0.2, hd.z - 0.01), new THREE.Vector3(hd.x, hd.y + 0.24, hd.z - 0.01), { bins: 14, sec: 32, off: 0.035, th: 0.008, smooth: 3, arc: [-Math.PI + 0.95, Math.PI - 0.95].map(a => a + Math.PI), flare: (t) => (t < 0.35 ? (0.35 - t) * 0.25 : 0) });
  pinToBone(root, 'Head', new THREE.Mesh(veilG, robe));
  // touca branca: por baixo do véu, aparece como moldura em volta do rosto; e uma faixa cobrindo testa e alto da cabeça
  const coif = wrapShell(headPts, new THREE.Vector3(hd.x, hd.y - 0.17, hd.z - 0.005), new THREE.Vector3(hd.x, hd.y + 0.24, hd.z - 0.005), { bins: 14, sec: 32, off: 0.02, th: 0.006, smooth: 3, arc: [0.72, Math.PI * 2 - 0.72] });
  pinToBone(root, 'Head', new THREE.Mesh(coif, white));
  const cap = wrapShell(headPts, new THREE.Vector3(hd.x, hd.y + 0.1, hd.z - 0.005), new THREE.Vector3(hd.x, hd.y + 0.26, hd.z - 0.005), { bins: 6, sec: 32, off: 0.022, th: 0.006, smooth: 3 });
  pinToBone(root, 'Head', new THREE.Mesh(cap, white));
  hairUnderHat(root, true);
  // cordão na cintura e cruz no peito
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.01, 8, 40), new THREE.MeshStandardMaterial({ color: '#d8c8a0', roughness: 0.9 })); cord.rotation.x = Math.PI / 2; cord.scale.set(1, 0.8, 1); cord.position.set(pv.x, pv.y + 0.1, pv.z + 0.01); pinToBone(root, 'pelvis', cord);
  const gold = armorMat('#d8b45a', 'ouro'), cx = new THREE.Group(); const v = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.075, 0.008), gold), h2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.008), gold); h2.position.y = 0.014; cx.add(v, h2);
  cx.position.set(nk.x, nk.y - 0.2, nk.z + 0.175); pinToBone(root, 'spine_03', cx);
}
