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
  aprendiz: { outfit: 'Rogue', show: [], dagger: {}, tint: { body: '#a99572', legs: '#4f5a42' }, style: '1h', extras: ['belt'] }, // S-320: aprendiz começa com adaga (não espada); linho cru e calça verde-musgo, cores próprias do Aethra
  guerreiro: { outfit: 'Knight', show: ['1H_Sword'], itemScale: { '1H_Sword': 1.12 }, armor: 'leve', tint: { body: '#9aa2b0', legs: '#5a4a3a', cape: '#b8332a' }, style: '1h', extras: ['belt'] },
  cavaleiro_runico: { outfit: 'Knight', show: ['2H_Sword'], armor: 'placas', tint: { body: '#3a4258', legs: '#262c3c', cape: '#7a1020' }, glow: { '2H_Sword': '#4ad0ff' }, style: '2h', extras: [] }, // S-340: sem os cristais (runas) girando em volta
  guardiao_sagrado: { outfit: 'Knight', show: ['1H_Sword'], armor: 'paladino', tint: { body: '#fff6dc', legs: '#8a7a5a' }, glow: { '1H_Sword': '#ffd76a' }, style: '1h' }, // S-204: armadura de placas de verdade, tabardo e capa de pano com física (sem asas de fada)
  mago: { outfit: 'Mage', mage: 'mago', show: [], staff: { wood: '#5a3a22', gem: '#8ab8ff', crystal: 'mago', out: 0.03 }, tint: { body: '#6a4a32', legs: '#3e2e22', cape: '#3e4a26' }, style: 'cast' },
  arquimago: { outfit: 'Mage', mage: 'arquimago', show: [], staff: { wood: '#3a2a3e', gem: '#c07aff', crystal: 'arqui', thick: 1.45, h: 1.62, head: 1.3, prongs: 5, twist: 0.9, knots: true, out: 0.13, fwd: 0.06 }, tint: { body: '#4a2a7a', legs: '#2a1446', cape: '#24103c' }, glow: { '2H_Staff': '#c07aff' }, style: 'cast', extras: ['arcaneEnergy'] }, // S-220: sem os anéis · S-315: energia arcana em filetes (no lugar das bolinhas)
  sabio_elemental: { outfit: 'Mage', mage: 'sabio', show: ['Mage_Cape'], book: true, tint: { body: '#2f7a6a', legs: '#1f4a40', cape: '#c9a24a' }, style: 'cast', extras: ['elementOrbs'] }, // S-314: livro de verdade na mão (sem varinha/livro do pacote) · S-313: orbes elementais
  arqueiro: { outfit: 'Rogue', show: [], bow: { wood: '#7a4a22' }, tint: { body: '#4f8a45', legs: '#5a4430', cape: '#2f5a2a' }, style: 'ranged', extras: ['quiver'] },
  cacador: { outfit: 'Barbarian', show: [], bow: { wood: '#4a2c14', tip: '#d8c8a0', h: 1.4 }, tint: { body: '#6b5236', legs: '#43352a', cape: '#4a3020' }, style: 'ranged', extras: ['bowOut', 'quiver'], hunter: true }, // S-325: tons de terra; o falcão empoleirado saiu (o parceiro agora é o lobo gigante)
  menestrel: { outfit: 'Rogue', show: [], bow: { wood: '#8a3a2a', h: 1.1 }, instrument: true, tint: { body: '#5a1a28', legs: '#2a2232', cape: '#1f4a34' }, style: 'ranged', extras: ['bardGear'] }, // S-324: arco OU instrumento (pela arma equipada) e roupa de bardo de verdade // S-108: as notas só aparecem com a Canção de Batalha ativa (songAura em main3d)
  ladino: { outfit: 'Rogue', show: [], dagger: {}, tint: { body: '#3b3a30', legs: '#2c2620', cape: '#2a2a33' }, style: 'dual', rogue: 'gatuno' }, // S-323: gatuno (colete, lenço, bolsinhas, botas macias) com UMA adaga
  lamina_sombria: { outfit: 'Rogue', show: [], dagger: {}, dual: true, katar: {}, tint: { body: '#1d1b22', legs: '#15131a', cape: '#2a1440' }, style: 'dual', rogue: 'algoz' }, // S-322: sem orbes; katar OU duas adagas (pela arma equipada)
  saqueador: { outfit: 'Barbarian', show: [], sabre: {}, daggerL: true, tint: { body: '#4a3424', legs: '#2e2a24', cape: '#34342c' }, style: 'dual', rogue: 'salteador' }, // S-321: Salteador — sabre + adaga, capuz caído nas costas
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
  // S-334: por enquanto sem os 4 elementos (virão com as habilidades) — 4 gemas MÍSTICAS pequenas: cristais de formas diferentes
  // (nada de esfera lisa monocromática), iridescentes, com núcleo de luz e cor que passeia devagar (ametista → azul → verde-água)
  elementOrbs(root, fx) {
    const g = new THREE.Group(); g.position.y = 1.32; root.parent.add(g); const gems = [];
    const PAL = ['#9a6aff', '#5aa0ff', '#4fd8c0', '#c87aff'];
    const forms = [{ r: 0.02, h: 0.062, pr: 0.45, sharp: 0.6, wob: 0.08 }, { r: 0.022, h: 0.05, pr: 0.5, sharp: 0.8, wob: 0.16 }, { r: 0.016, h: 0.07, pr: 0.42, sharp: 0.5, wob: 0.06 }, { r: 0.021, h: 0.046, pr: 0.38, sharp: 0.9, wob: 0.2 }];
    forms.forEach((f, i) => { const o = new THREE.Group(), m = new THREE.Mesh(crystalGeo(f.r, f.h, { ...f, seed: i * 2 + 1 }), mysticMat(PAL[i], { ei: 0.6, op: 0.84 })); m.rotation.z = (i - 1.5) * 0.25;
      const core = glowSpr('#ffffff', f.r * 3.4, 0.45), glint = glowSpr('#ffffff', f.r * 1.1, 0); glint.position.set(f.r * 0.6, f.h * 0.25, f.r * 0.7);
      o.add(m, core, glint, glowSpr(PAL[i], 0.1, 0.28)); o.userData = { m, core, glint, i }; gems.push(o); g.add(o); });
    fx.push(t => gems.forEach((o, i) => { const a = t * 0.55 + i * Math.PI / 2, r = 0.36; o.position.set(Math.cos(a) * r, 0.18 + Math.sin(a * 2 + i) * 0.035 + Math.sin(a) * 0.06, Math.sin(a) * r);
      const { m, core, glint } = o.userData, c = paletteAt(PAL, t * 0.09 + i * 0.9);
      { const gt = root.userData.gemTint, left = gt ? gt.until - performance.now() : 0; if (left > 0) c.lerp(_mc2.set(GEM_EL[gt.el] || '#ffffff'), Math.min(1, left / 400) * 0.85); } // P-016: ao lançar, as gemas acendem na cor do elemento (água, fogo, terra, vento)
      m.material.color.copy(c); m.material.emissive.copy(c); m.material.emissiveIntensity = 0.5 + 0.18 * Math.sin(t * 1.9 + i);
      m.rotation.y = t * (0.5 + i * 0.12); core.material.color.copy(c).lerp(_mc2.set('#ffffff'), 0.5); core.material.opacity = 0.35 + 0.15 * Math.sin(t * 2.6 + i * 1.7);
      glint.material.opacity = Math.max(0, Math.sin(t * 1.3 + i * 2.2)) ** 8 * 0.9; })); // um brilho que passa de vez em quando
  },
  // S-315: energia arcana do Arquimago (no espírito do mago de Skyrim): filetes luminosos em espiral em volta da pedra do cajado,
  // centelhas suaves que sobem e a mão livre acesa — mais forte ao conjurar
  arcaneEnergy(root, fx) {
    const mk = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const fil = [], head = new THREE.Group();
    const attach = () => { const staff = root.userData.items && root.userData.items['2H_Staff']; if (!staff) return; head.position.y = staff.userData.headY ?? staff.userData.gripY / 0.58 + 0.075; head.scale.setScalar(1.25); staff.add(head); }; // o cajado é montado depois dos efeitos
    // S-356: no lugar dos fios sólidos ("lombriga"), três rastros de luz feitos de pontinhos suaves que giram e se apagam na cauda (cometas de névoa)
    for (let k = 0; k < 3; k++) { const tr = []; for (let j = 0; j < 18; j++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: k === 1 ? '#9fc8ff' : '#c4a0ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); head.add(s); tr.push(s); } fil.push(tr); }
    void mk;
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: '#b08aff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); aura.scale.setScalar(0.22); head.add(aura);
    // mão livre (esquerda): brilho e centelhas que sobem e somem
    const hl = bone(root, 'hand_l'), handG = new THREE.Group(); if (hl) hl.add(handG); handG.position.set(0, 0.07, 0.02);
    const hglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: '#a88aff', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); hglow.scale.setScalar(0.16); handG.add(hglow);
    const sparks = []; for (let k = 0; k < 10; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: k % 3 ? '#cfb2ff' : '#9fd0ff', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.025); (k < 5 ? head : handG).add(s); sparks.push(s); }
    // S-335: magia mais elaborada saindo do cajado — runas que orbitam devagar, fios de energia que se soltam e sobem em espiral, e um pulso de luz de tempos em tempos
    const runeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'round'; x.shadowColor = '#fff'; x.shadowBlur = 6;
      x.beginPath(); x.moveTo(32, 10); x.lineTo(32, 54); x.moveTo(32, 22); x.lineTo(48, 12); x.moveTo(32, 34); x.lineTo(16, 24); x.moveTo(32, 44); x.lineTo(46, 52); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const runes = []; for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeTex, color: k % 2 ? '#c9a8ff' : '#a8c8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, rotation: k * 1.3 })); s.scale.setScalar(0.035); head.add(s); runes.push(s); }
    const wisps = []; for (let k = 0; k < 12; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: k % 3 ? '#b896ff' : '#8fc4ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.018); head.add(s); wisps.push(s); }
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: '#c8a8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); head.add(pulse);
    let cast = 0;
    fx.push(t => {
      if (!head.parent) attach();
      runes.forEach((s, k) => { const a = t * 0.45 + k * Math.PI * 2 / runes.length; s.position.set(Math.cos(a) * 0.12, Math.sin(t * 1.1 + k) * 0.025, Math.sin(a) * 0.12); s.material.opacity = (0.25 + 0.45 * cast) * (0.6 + 0.4 * Math.sin(t * 1.7 + k * 1.9)); s.material.rotation = k * 1.3 + t * 0.2; });
      wisps.forEach((s, k) => { const u = (t * 0.32 + k / wisps.length) % 1, a = k * 0.52 + u * Math.PI * 3, r = 0.03 + u * 0.06; s.position.set(Math.cos(a) * r, 0.04 + u * 0.32, Math.sin(a) * r); s.scale.setScalar(0.022 * (1 - u * 0.6)); s.material.opacity = Math.sin(u * Math.PI) * (0.3 + 0.45 * cast); });
      { const u = (t / 2.6) % 1; pulse.scale.setScalar(0.06 + u * 0.32); pulse.material.opacity = (1 - u) ** 2 * (0.18 + 0.3 * cast); }
      const an = (root.userData.anim && root.userData.anim.name) || '', want = /Spell|Shoot|Cast/.test(an) || performance.now() - (root.userData.ovT || -1e9) < 600 ? 1 : 0.25;
      cast += (want - cast) * 0.08;
      fil.forEach((tr, k) => { const dir = k % 2 ? -1 : 1, sp = 1.5 + k * 0.35, tilt = (k - 1) * 0.5, base = 0.26 + 0.3 * cast;
        tr.forEach((s, j) => { const a = (t * sp - j * 0.11) * dir + k * 2.09, r = 0.06 + 0.012 * Math.sin(t * 0.7 + k), y = Math.sin(a * 0.5 + k) * 0.05 + Math.cos(a) * r * tilt, f = 1 - j / tr.length;
          s.position.set(Math.cos(a) * r, y, Math.sin(a) * r); s.scale.setScalar(0.034 * (0.35 + 0.65 * f)); s.material.opacity = base * f * f * (0.8 + 0.2 * Math.sin(t * 5 + j)); }); });
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
/* ===================== ROSTOS 2.0 (P-015) =====================
   A cabeça realista é a mesma malha para todos; aqui ela é esculpida por PARÂMETROS (formato do rosto, queixo, nariz,
   boca, olhos, inclinação dos olhos, sobrancelhas) — um campo de deslocamento aplicado à cabeça, às sobrancelhas e à barba
   (os três seguem juntos). Os pontos de referência (olhos, ponta do nariz, boca, queixo) são MEDIDOS na própria malha,
   então vale para homem, mulher e anão. Cada combinação é esculpida uma vez (cache por geometria + parâmetros).
   Expressões (sorriso, sério, surpreso, bravo) e o piscar são morphs relativos na mesma geometria; o "faceRig" anima. */
export const FACE_FEATS = { rosto: ['Fino', 'Largo'], nariz: ['Pequeno', 'Grande'], boca: ['Lábios finos', 'Lábios cheios'], olhos: ['Puxados', 'Grandes'], sobr: ['Baixas', 'Arqueadas'] };
const FACE_PRESET = { // tipos de rosto do criador → parâmetros (−1..1)
  sereno: { faceW: 0, chin: 0, nose: 0, lips: 0.1, eyes: 0, tilt: 0.1, brows: 0.15 },
  valente: { faceW: 0.65, chin: 0.5, nose: 0.45, lips: -0.25, eyes: -0.25, tilt: -0.15, brows: -0.35 },
  alegre: { faceW: -0.1, chin: -0.25, nose: -0.45, lips: 0.55, eyes: 0.55, tilt: 0.1, brows: 0.5 },
  astuto: { faceW: -0.5, chin: 0.3, nose: 0.25, lips: -0.2, eyes: -0.45, tilt: 0.75, brows: 0.25 },
  gentil: { faceW: 0.15, chin: -0.4, nose: -0.1, lips: 0.45, eyes: 0.3, tilt: -0.35, brows: 0.35 },
};
const FEAT_MAP = { rosto: 'faceW', nariz: 'nose', boca: 'lips', olhos: 'eyes', sobr: 'brows' };
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// rosto variado e bonito para um NPC sem rosto definido (sempre o mesmo para o mesmo id)
export function npcFaceLook(id, sex) {
  let h = hashStr(String(id)); const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h ^= h >>> 13; return (h % 10000) / 10000; };
  const ids = Object.keys(FACE_PRESET), face = ids[Math.floor(r() * ids.length)], feat = {};
  for (const k of Object.keys(FEAT_MAP)) feat[k] = Math.round((r() * 2 - 1) * 1.4); // −1..1 (às vezes 0): variação sem caricatura
  if (sex === 'f') { feat.rosto = Math.min(feat.rosto, 0); feat.nariz = Math.min(feat.nariz, 0); } // mulheres: rosto e nariz delicados
  return { face, feat };
}
function faceParams(look, opt = {}) {
  const P = { ...(FACE_PRESET[look.face] || FACE_PRESET.sereno) }, f = look.feat || {};
  for (const [k, p] of Object.entries(FEAT_MAP)) if (typeof f[k] === 'number') P[p] += Math.max(-2, Math.min(2, f[k])) * 0.45;
  if (look.sex === 'f') { P.faceW -= 0.35; P.chin -= 0.25; P.nose -= 0.35; P.lips += 0.35; P.eyes += 0.25; P.brows += 0.25; } // traços delicados
  else { P.faceW += 0.15; P.chin += 0.15; P.brows -= 0.1; }                                                                  // traços fortes
  P.faceW *= 1.3; P.nose *= 1.6; P.lips *= 1.6; P.eyes *= 1.4; P.brows *= 1.4; P.chin *= 1.3; // efeito visível nas barrinhas
  const k = look.race === 'anao' ? 0.6 : 1; // o anão já tem rosto esculpido (grosseiro): só nuances por cima
  for (const key of Object.keys(P)) P[key] = Math.max(-1.6, Math.min(1.6, P[key] * k));
  // S-351: elfo com feições próprias (não é um humano de orelha pontuda): rosto fino e oval, queixo afilado, olhos amendoados
  // puxados para cima, nariz fino e sobrancelhas altas e arqueadas — por cima do rosto escolhido no criador
  P.elf = look.race === 'elfo' ? 1 : 0;
  if (P.elf) { P.faceW = Math.min(P.faceW, 0.2) - 0.75; P.chin += 0.35; P.tilt = Math.max(P.tilt, 0) + 1.1; P.nose = Math.min(P.nose, 0.3) - 0.45; P.brows += 0.55; P.eyes = Math.max(P.eyes, -0.2) + 0.15; for (const key of Object.keys(P)) if (key !== 'elf') P[key] = Math.max(-1.7, Math.min(1.7, P[key])); }
  return P;
}
function faceLandmarks(head, eyes) {
  eyes.geometry.computeBoundingBox(); const eb = eyes.geometry.boundingBox, r = (eb.max.z - eb.min.z) / 2;
  const L = { ey: (eb.min.y + eb.max.y) / 2, r, xe: eb.max.x - r, zc: eb.max.z - r, eyeZ: eb.max.z };
  const P = head.geometry.attributes.position, idx = head.geometry.index ? head.geometry.index.array : null, used = idx ? new Set(idx) : null;
  const col = []; const n = P.count;
  for (let i = 0; i < n; i++) { if (used && !used.has(i)) continue; const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (Math.abs(x) < 0.007 && y < L.ey + 0.005 && y > L.ey - 0.14 && z > 0.02) col.push([y, z]); }
  let nose = [L.ey - 0.044, L.eyeZ + 0.03]; for (const [y, z] of col) if (y < L.ey - 0.02 && y > L.ey - 0.075 && z > nose[1] - 1e-6) nose = [y, z];
  // boca: dois lábios (máximos de z) abaixo do nariz com o vão (mínimo) entre eles
  const band = col.filter(([y]) => y < nose[0] - 0.008 && y > nose[0] - 0.06).sort((a, b) => b[0] - a[0]);
  let mouth = [nose[0] - 0.024, nose[1] - 0.02]; if (band.length > 6) { let up = band[0]; for (const p of band) if (p[0] > nose[0] - 0.03 && p[1] > up[1]) up = p; let slit = up; for (const p of band) if (p[0] < up[0] && p[0] > up[0] - 0.014 && p[1] < slit[1]) slit = p; mouth = slit; }
  let chin = [mouth[0] - 0.035, mouth[1] - 0.008]; for (const [y, z] of col) if (y < mouth[0] - 0.02 && y > mouth[0] - 0.06 && z > chin[1]) chin = [y, z];
  Object.assign(L, { noseY: nose[0], noseZ: nose[1], mouthY: mouth[0], mouthZ: mouth[1], chinY: chin[0], chinZ: chin[1] });
  return L;
}
const _g = u => Math.exp(-u * u), _sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// campo de forma (parâmetros) — deslocamento em metros no espaço de repouso da cabeça
function shapeField(L, P) {
  return (x, y, z) => {
    let dx = 0, dy = 0, dz = 0;
    if (P.elf) { // S-351: orelha élfica longa e pontuda (para cima e para trás), visível de longe; o lóbulo fica no lugar
      const ax = Math.abs(x), s = x < 0 ? -1 : 1, ez = L.eyeZ - 0.1;
      // S-358: só a ORELHA de verdade (o que sai além do crânio naquela altura) — antes a têmpora também subia e a pele furava o cabelo ("meio careca")
      const sk = L.skull ? (L.skull.get(Math.round(y * 200)) ?? 0.066) : 0.066;
      const w = _sm(sk + 0.002, sk + 0.009, ax) * _sm(L.ey - 0.06, L.ey - 0.045, y) * (1 - _sm(L.ey + 0.03, L.ey + 0.045, y)) * _g((z - ez) / 0.04);
      if (w > 0) { const t = Math.max(0, Math.min(1, (y - (L.ey - 0.022)) / 0.042)), tt = t * t * (1.4 - 0.4 * t), out = ax - 0.068;
        dy += w * tt * 0.062; dz -= w * tt * 0.04; dx += s * w * (tt * 0.026 + out * 0.35 * t); }
    }
    if (y < L.chinY - 0.03 || y > L.ey + 0.05 || z < -0.035) return dx || dy || dz ? [dx, dy, dz] : null;
    const ax = Math.abs(x), s = x < 0 ? -1 : 1, front = _sm(-0.03, 0.03, z);
    if (P.elf) { // maçãs do rosto altas e marcadas, bochecha mais funda embaixo
      dx += s * 0.0035 * _g((y - (L.ey - 0.018)) / 0.012) * _g((ax - 0.058) / 0.016) * front;
      dx -= s * 0.003 * _g((y - (L.mouthY + 0.012)) / 0.014) * _g((ax - 0.05) / 0.016) * front; }
    // rosto: maçãs e mandíbula (largo/quadrado ↔ fino/oval)
    dx += s * 0.0055 * P.faceW * _g((y - (L.ey - 0.03)) / 0.026) * _g((ax - 0.062) / 0.03) * front;
    const jaw = _g((y - (L.chinY + 0.012)) / 0.022) * _sm(0.012, 0.05, ax) * _sm(-0.04, 0.02, z) * (P.faceW < 0 ? _sm(L.chinY - 0.012, L.chinY + 0.004, y) : 1); // S-358: afinar o rosto não puxa o PESCOÇO para dentro da gola
    dx += s * 0.0075 * P.faceW * jaw;
    if (P.faceW > 0) dy -= 0.0028 * P.faceW * _g((y - (L.chinY + 0.012)) / 0.012) * _g((ax - 0.05) / 0.016) * front; // canto da mandíbula mais marcado
    else dy += 0.0025 * P.faceW * _g((y - L.chinY) / 0.014) * _g(ax / 0.022) * front;                                // queixo afinando (oval)
    // queixo à frente
    dz += 0.0035 * P.chin * _g((y - L.chinY) / 0.013) * _g(ax / 0.022) * front; dy -= 0.0015 * P.chin * _g((y - L.chinY) / 0.013) * _g(ax / 0.022) * front;
    // nariz: tamanho/projeção, ponta (arrebitada ↔ caída) e asas
    const wN = _g((y - (L.noseY + 0.012)) / 0.022) * _g(ax / 0.015) * _sm(L.noseZ - 0.034, L.noseZ - 0.018, z);
    dz += 0.0055 * P.nose * wN * Math.max(0, (z - (L.noseZ - 0.03)) / 0.03);
    dy -= 0.0028 * P.nose * _g((y - L.noseY) / 0.008) * _g(ax / 0.012) * _sm(L.noseZ - 0.02, L.noseZ - 0.008, z);
    dx += s * 0.0028 * P.nose * _g((y - (L.noseY - 0.008)) / 0.007) * _g((ax - 0.013) / 0.008) * _sm(L.noseZ - 0.04, L.noseZ - 0.02, z);
    // boca: lábios cheios (para fora e afastados do vão) e largura
    const lipZ = _sm(L.mouthZ - 0.016, L.mouthZ - 0.004, z), wU = _g((y - (L.mouthY + 0.005)) / 0.005) * _g(ax / 0.019) * lipZ, wL = _g((y - (L.mouthY - 0.0065)) / 0.006) * _g(ax / 0.019) * lipZ;
    dz += 0.0022 * P.lips * (wU + wL); dy += 0.0012 * P.lips * (wU - wL);
    dx += s * 0.0032 * P.lips * _g((y - L.mouthY) / 0.008) * _g((ax - 0.024) / 0.011) * lipZ;
    // olhos: abertura das pálpebras e inclinação (canto de fora sobe = "puxado")
    for (const e of [-1, 1]) {
      if (e !== s) continue;
      const nearEye = z > L.eyeZ - 0.028;
      const ru = Math.hypot((x - e * L.xe) / 0.021, (y - (L.ey + 0.008)) / 0.0085); if (ru < 1 && nearEye) dy += 0.0014 * P.eyes * (1 - ru * ru) ** 2;
      const rl = Math.hypot((x - e * L.xe) / 0.019, (y - (L.ey - 0.009)) / 0.0075); if (rl < 1 && nearEye) dy -= 0.0011 * P.eyes * (1 - rl * rl) ** 2;
      const t = P.tilt * _g((y - L.ey) / 0.012) * (nearEye ? 1 : 0); dy += t * (0.0019 * _g((ax - (L.xe + 0.018)) / 0.009) - 0.0007 * _g((ax - (L.xe - 0.016)) / 0.007));
    }
    // sobrancelhas: altura e arco
    const wB = _g((y - (L.ey + 0.02)) / 0.011) * _g((ax - L.xe) / 0.03) * front;
    dy += 0.0024 * P.brows * wB + 0.0011 * P.brows * _g((y - (L.ey + 0.02)) / 0.011) * _g((ax - (L.xe + 0.012)) / 0.01) * front;
    return dx || dy || dz ? [dx, dy, dz] : null;
  };
}
// expressões (morphs relativos): sorriso, sério, surpreso, bravo, piscar
const FACE_EXPR = ['sorriso', 'serio', 'surpreso', 'bravo', 'piscar'];
function exprField(L, name) {
  const lid = (x, y, z, s) => { // pálpebra de cima desce sobre o olho (e é empurrada para fora da superfície do olho)
    const ru = Math.hypot((x - s * L.xe) / 0.023, (y - (L.ey + 0.007)) / 0.016); if (ru >= 1 || z < L.zc - 0.004 || y < L.ey - 0.004) return null;
    const w = (1 - ru * ru) ** 1.5, drop = (0.0105 + 0.002 * (y - L.ey) / 0.01) * w, ny = y - drop;
    const ddx = x - s * L.xe, ddy = ny - L.ey, R = L.r + 0.0014; let dz = 0;
    if (ddx * ddx + ddy * ddy < R * R) { const zs = L.zc + Math.sqrt(R * R - ddx * ddx - ddy * ddy); if (z < zs) dz = zs - z; }
    return [0, -drop, dz];
  };
  return (x, y, z) => {
    if (y < L.chinY - 0.02 || y > L.ey + 0.05 || z < -0.01) return null;
    const ax = Math.abs(x), s = x < 0 ? -1 : 1, front = _sm(0.0, 0.04, z); let dx = 0, dy = 0, dz = 0;
    const corner = Math.max(0, 1 - Math.hypot((ax - 0.022) / 0.019, (y - L.mouthY) / 0.014) ** 2) ** 2 * front;
    const cheek = _g((ax - 0.036) / 0.018) * _g((y - (L.mouthY + 0.032)) / 0.014) * front;
    const browY = _g((y - (L.ey + 0.02)) / 0.012) * front, browIn = browY * _g((ax - 0.013) / 0.012), browAll = browY * _g((ax - L.xe) / 0.03);
    const upLid = Math.max(0, 1 - Math.hypot((ax - L.xe) / 0.021, (y - (L.ey + 0.008)) / 0.0085) ** 2) ** 2 * (z > L.eyeZ - 0.028 ? 1 : 0);
    const loLid = Math.max(0, 1 - Math.hypot((ax - L.xe) / 0.019, (y - (L.ey - 0.009)) / 0.0075) ** 2) ** 2 * (z > L.eyeZ - 0.028 ? 1 : 0);
    const lowerLip = _g((y - (L.mouthY - 0.008)) / 0.008) * _g(ax / 0.02) * front;
    if (name === 'sorriso') { dy += 0.0092 * corner + 0.0036 * cheek + 0.0016 * loLid; dx += s * 0.0032 * corner; dz -= 0.0024 * corner; dy -= 0.0008 * lowerLip; dz += 0.0009 * cheek; }
    else if (name === 'serio') { dy -= 0.0016 * browIn + 0.0007 * upLid + 0.0007 * corner; dx -= s * 0.0006 * browIn; }
    else if (name === 'surpreso') { dy += 0.0038 * browAll + 0.0017 * upLid - 0.0007 * loLid - 0.0018 * lowerLip; }
    else if (name === 'bravo') { dy -= 0.0032 * browIn + 0.0012 * upLid + 0.0016 * corner - 0.0009 * browY * _g((ax - (L.xe + 0.014)) / 0.01); dx -= s * 0.0016 * browIn; dx += s * 0.0006 * _g((y - (L.noseY - 0.008)) / 0.007) * _g((ax - 0.013) / 0.008) * front; }
    else if (name === 'piscar') { const d = lid(x, y, z, s); if (d) { dx += d[0]; dy += d[1]; dz += d[2]; } dy += 0.0018 * loLid; }
    return dx || dy || dz ? [dx, dy, dz] : null;
  };
}
const _faceCache = new Map();
function faceMeshes(root) { let head = null, eyes = null; const rest = []; root.traverse(m => { if (!m.isSkinnedMesh) return; if (/^Super[Hh]ero_/.test(m.name)) head = m; else if (m.name === 'Eyes') eyes = m; else if (/^Eyebrows|Hair_Beard/.test(m.name)) rest.push(m); }); return { head, eyes, rest }; }
/* aplica o rosto do "look" (face + feat; NPC sem rosto definido usa opt.seed) e liga as expressões; devolve o rig */
export function faceSculpt(root, look, opt = {}) {
  const { head, eyes, rest } = faceMeshes(root); if (!head || !eyes) return null;
  let lk = look || {};
  if (opt.seed) { const g = npcFaceLook(opt.seed, lk.sex); lk = { ...lk, face: opt.keepFace ? lk.face : g.face, feat: lk.feat || g.feat }; } // NPC: rosto variado e fixo por id
  const P = faceParams(lk), key = Object.values(P).map(v => v.toFixed(2)).join(',');
  const L0 = faceLandmarks(head, eyes);
  if (P.elf) { // largura do crânio por fatia de 5 mm, medida longe da orelha (frente da têmpora e nuca) — a orelha é o que passa disso
    const A = head.geometry.attributes.position, ez = L0.eyeZ - 0.1, sk = new Map();
    for (let i = 0; i < A.count; i++) { const y = A.getY(i); if (y < L0.ey - 0.07 || y > L0.ey + 0.06) continue; const z = A.getZ(i); if (Math.abs(z - ez) < 0.045 || z < ez - 0.09 || z > L0.eyeZ - 0.02) continue; const k = Math.round(y * 200), ax = Math.abs(A.getX(i)); if (!(sk.get(k) >= ax)) sk.set(k, ax); }
    for (const [k, v] of [...sk]) sk.set(k, Math.max(v, sk.get(k - 1) || 0, sk.get(k + 1) || 0)); L0.skull = sk; }
  const shape = shapeField(L0, P);
  const build = mesh => {
    const ck = mesh.geometry.uuid + '|' + key; let g = _faceCache.get(ck);
    if (!g) {
      g = mesh.geometry.clone(); const A = g.attributes.position;
      for (let i = 0; i < A.count; i++) { const x = A.getX(i), y = A.getY(i), z = A.getZ(i), d = shape(x, y, z); if (d) A.setXYZ(i, x + d[0], y + d[1], z + d[2]); }
      A.needsUpdate = true;
      // expressões como morphs relativos (mesmo campo para cabeça, sobrancelhas e barba: tudo se move junto)
      g.morphTargetsRelative = true; g.morphAttributes.position = [];
      for (const nm of FACE_EXPR) {
        const f = exprField(L0, nm), arr = new Float32Array(A.count * 3);
        for (let i = 0; i < A.count; i++) { const d = f(A.getX(i), A.getY(i), A.getZ(i)); if (d) { arr[i * 3] = d[0]; arr[i * 3 + 1] = d[1]; arr[i * 3 + 2] = d[2]; } }
        g.morphAttributes.position.push(new THREE.Float32BufferAttribute(arr, 3));
      }
      g.computeBoundingSphere(); _faceCache.set(ck, g);
    }
    mesh.geometry = g; mesh.updateMorphTargets();
  };
  build(head); for (const m of rest) build(m);
  // olhos com brilho úmido (material compartilhado: ajusta uma vez)
  if (eyes.material && !eyes.material.userData.wet) { eyes.material.roughness = 0.12; eyes.material.metalness = 0; eyes.material.userData.wet = true; eyes.material.needsUpdate = true; }
  const meshes = [head, ...rest].filter(m => m.morphTargetInfluences);
  const rig = {
    mood: opt.mood || 'sorriso', moodW: opt.moodW ?? 0.35, w: { sorriso: 0, serio: 0, surpreso: 0, bravo: 0 }, flash: null, flashT: 0, nextBlink: 1 + Math.random() * 3, blinkT: -1,
    set(m, w = 0.6) { this.mood = m; this.moodW = w; },
    express(m, dur = 2.5, w = 0.85) { this.flash = m; this.flashW = w; this.flashT = dur; },
    update(dt) {
      if (!(dt > 0)) dt = 1 / 60;
      if (this.flashT > 0) this.flashT -= dt;
      for (const k of Object.keys(this.w)) { const want = this.flashT > 0 && this.flash === k ? this.flashW : this.mood === k ? this.moodW : 0; this.w[k] += (want - this.w[k]) * Math.min(1, dt * 5); }
      this.nextBlink -= dt; if (this.nextBlink <= 0) { this.blinkT = 0; this.nextBlink = 2.2 + Math.random() * 4; if (Math.random() < 0.12) this.nextBlink = 0.25; } // às vezes pisca duas vezes
      let b = 0; if (this.blinkT >= 0) { this.blinkT += dt; const u = this.blinkT / 0.15; b = u < 0.45 ? u / 0.45 : u < 1 ? 1 - (u - 0.45) / 0.55 : 0; if (u >= 1) this.blinkT = -1; }
      const vals = [this.w.sorriso, this.w.serio, this.w.surpreso, this.w.bravo, b];
      for (const m of meshes) for (let i = 0; i < vals.length; i++) m.morphTargetInfluences[i] = vals[i];
    },
  };
  root.userData.face = rig;
  return rig;
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
      gripOn(root, left ? 'l' : 'r', /Axe/.test(itemName) ? 'machado' : /Knife/.test(itemName) ? 'adaga' : /Wand/.test(itemName) ? 'varinha' : 'espada', holder, { axis: Y.clone() }); // P-013: dedos fecham no cabo
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
export const CLASS_OUTFIT = { aprendiz: 'campones', guerreiro: 'patrulheiro', cavaleiro_runico: 'patrulheiro', guardiao_sagrado: 'patrulheiro', mago: 'campones', arquimago: 'campones', sabio_elemental: 'campones', arqueiro: 'patrulheiro', cacador: 'patrulheiro', menestrel: 'campones', ladino: 'campones', lamina_sombria: 'patrulheiro', saqueador: 'campones' };
/* S-358: a gola alta da roupa base (Patrulheiro) furava o pescoço (manchas escuras na pele). Mede o pescoço DE VERDADE (pele da cabeça,
   no espaço de amarração, em fatias de 1 cm e 24 setores) e empurra para fora os vértices da roupa que ficam dentro dele — só na faixa
   do pescoço. A geometria corrigida é guardada por par roupa+pele (é compartilhada entre os personagens iguais). */
const _collarCache = new Map();
function collarFit(root) {
  let head = null; const bodies = []; root.traverse(o => { if (!o.isSkinnedMesh) return; if (/^Super[Hh]ero_/.test(o.name)) head = o; else if (/_Body$/.test(o.name)) bodies.push(o); });
  if (!head || !bodies.length) return;
  for (const b of bodies) {
    const key = b.geometry.uuid + '|' + head.geometry.uuid; if (_collarCache.has(key)) { b.geometry = _collarCache.get(key); continue; }
    const H = head.geometry.attributes.position, SEC = 24, sl = new Map();
    const used = head.geometry.index ? new Set(head.geometry.index.array) : null; let yMax = -1e9; for (let i = 0; i < H.count; i++) if ((!used || used.has(i)) && Math.abs(H.getX(i)) < 0.3) yMax = Math.max(yMax, H.getY(i));
    for (let i = 0; i < H.count; i++) { if (used && !used.has(i)) continue; const x = H.getX(i), y = H.getY(i), z = H.getZ(i); if (Math.abs(x) > 0.11 || y > yMax - 0.17 || y < yMax - 0.32) continue; const k = Math.round(y * 100); let e = sl.get(k); if (!e) sl.set(k, e = { pts: [] }); e.pts.push([x, z]); }
    if (!sl.size) { _collarCache.set(key, b.geometry); continue; }
    for (const e of sl.values()) { let cx = 0, cz = 0; for (const [x, z] of e.pts) { cx += x; cz += z; } cx /= e.pts.length; cz /= e.pts.length; e.c = [cx, cz]; e.r = new Array(SEC).fill(0); for (const [x, z] of e.pts) { const a = Math.atan2(z - cz, x - cx), j = ((Math.round(a / (Math.PI * 2) * SEC) % SEC) + SEC) % SEC; e.r[j] = Math.max(e.r[j], Math.hypot(x - cx, z - cz)); } for (let j = 0; j < SEC; j++) if (!e.r[j]) e.r[j] = Math.max(e.r[(j + 1) % SEC], e.r[(j + SEC - 1) % SEC]); }
    const ks = [...sl.keys()].sort((a, b) => a - b), kMin = ks[0];
    const g = b.geometry.clone(), P = g.attributes.position; let moved = 0;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), k = Math.round(y * 100); if (k <= kMin) continue; const e = sl.get(k); if (!e || e.pts.length < 12) continue; const x = P.getX(i), z = P.getZ(i), dx = x - e.c[0], dz = z - e.c[1], d = Math.hypot(dx, dz); if (d > 0.14) continue;
      const a = Math.atan2(dz, dx), f = ((a / (Math.PI * 2)) * SEC % SEC + SEC) % SEC, j0 = Math.floor(f), w = f - j0, R = e.r[j0] * (1 - w) + e.r[(j0 + 1) % SEC] * w, want = R + 0.004;
      if (d < want && d > 1e-4) { P.setX(i, e.c[0] + dx / d * want); P.setZ(i, e.c[1] + dz / d * want); moved++; } }
    if (moved) { P.needsUpdate = true; g.computeVertexNormals(); } _collarCache.set(key, moved ? g : b.geometry); b.geometry = _collarCache.get(key);
  }
}
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
  try { collarFit(root); } catch (e) { console.warn('gola', e); } // S-358: a gola da roupa não fura o pescoço
  // tudo que a classe segura ou veste (arma, escudo, livro...)
  const items = [...(L.show || []).filter(n => !/_Cape$|_Hat$|_Helmet$/.test(n)).map(n => [L.outfit, n]), ...(L.borrow || [])];
  for (const [model, item] of items) { const src = Object.keys(MODELS).find(k => MODELS[k] && MODELS[k].scene && MODELS[k].scene.getObjectByName(item)); humanBorrow(root, MODELS, MODELS[model] && MODELS[model].scene.getObjectByName(item) ? model : src, item, (L.itemScale && L.itemScale[item]) || 1); } // S-328: espada do Guerreiro um pouco maior
  for (const [name, c] of Object.entries(L.glow || {})) { const o = root.userData.items && root.userData.items[name]; if (o) o.traverse(m => m.isMesh && glowMesh(m, c)); }
  for (const e of L.extras || []) if (EXTRAS[e] && !HUMAN_SKIP_EXTRAS.has(e)) EXTRAS[e](root, fx); // a roupa realista já tem cinto, aljava etc. de verdade
  // round 15: armadura sob medida, arco e adaga de verdade; escudo SÓ se estiver equipado (S-202: vale para todas as classes)
  if (L.armor) applyArmor(root, L.armor, fx);
  if (L.bow && opts.wtype === 'besta') holdCrossbow(root, codeCrossbow({ heavy: opts.weaponId === 'besta_de_cerco' })); // S-325: besta do Caçador
  else if (L.bow && !(L.instrument && opts.wtype === 'instrumento')) holdBow(root, codeBow(L.bow)); // S-324: Bardo com instrumento não carrega o arco
  if (L.instrument && opts.wtype === 'instrumento') holdInstrument(root, instrumentOf(opts.weaponId)); // S-324: alaúde/bandolim/flauta
  if (L.hunter) hunterGear(root); // S-325: manto de pele, capuz caído, faca de esfola, bolsa e tiras nas canelas
  // katar: o Executor usa o par de katares (opts.wtype permite trocar pela adaga quando a arma equipada não for katar)
  if (L.rogue && ROGUE_BUILD[L.rogue]) ROGUE_BUILD[L.rogue](root, fx); // S-321/S-322/S-323: roupas da linha do ladino
  if (L.mage && MAGE_BUILD[L.mage]) MAGE_BUILD[L.mage](root, fx); // S-382: vestes de mago (robe longo, mangas largas, bordados)
  if (!root.userData.armorSet) { let bd = false; root.traverse(m => { if (m.isSkinnedMesh && m.visible && /Beard/i.test(m.name)) bd = true; }); if (bd) try { seatBeard(root); } catch (e) { } } // S-380: sem armadura, a barba também repousa POR FORA da gola/manto/colete
  if (L.katar && (!opts.wtype || opts.wtype === 'katar')) holdKatars(root, { ...L.katar, ...katarLook(opts.weaponId) });
  else if (L.dagger) { holdDagger(root, codeDagger(L.dagger)); if (L.dual) holdDagger(root, codeDagger(L.dagger), 'l'); } // Executor sem katar = duas adagas (como no RO)
  if (L.sabre) holdDagger(root, codeSabre(L.sabre), 'r', 1.0);
  if (L.daggerL) holdDagger(root, codeDagger({}), 'l');
  if (L.staff) holdStaff(root, codeStaff(L.staff), fx, ch); // S-315: cajado dentro do punho, braço dobrado fora dos golpes
  if (L.book) holdBook(root, codeBook(), fx); // S-314: livro do Sábio segurado pela lombada na mão esquerda
  if (opts.offhand) strapShield(root, codeShield(SHIELD_KIND[opts.offhand] || (/paladino|guardiao/.test(cls) ? 'paladino' : 'madeira')));
  // S-147: sem a capa chapada nas costas (não combina com o corpo realista) — vale para todas as classes
  fx.push(() => fingerGrips(root)); // P-013: depois de tudo (IK do cajado etc.), os dedos fecham no que a mão segura
  if (!root.userData.armorSet) { try { seatBeard(root); } catch (e) { } } // verificador: barba (anão) repousa por cima do peito também sem armadura
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
  if (look.feat && typeof look.feat === 'object') { const f = {}; for (const k of Object.keys(FACE_FEATS)) { const v = +look.feat[k]; if (Number.isFinite(v) && v) f[k] = Math.max(-2, Math.min(2, Math.round(v))); } if (Object.keys(f).length) out.feat = f; } // P-015: ajustes do rosto (ausente = padrão)
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
/* P-019: a "chave" do equipamento de cabeça é 'topo|rosto|boca' (hatOf em main3d) — cada parte é opcional;
   uma chave antiga com só o id do chapéu continua valendo (vira o topo). */
const gearParts = key => { const s = String(key || '').split('|'); return { top: s[0] || null, face: s[1] || null, mouth: s[2] || null }; };
export function hatCovers(hatId) { const t = gearParts(hatId).top; return !!((HEAD_GEAR[t] && HEAD_GEAR[t].covers) || (HATS[t] && HATS[t].covers)); }
export function applyHat(ch, hatId, MODELS, customHead = true) {
  const G = gearParts(hatId);
  if (ch.root.userData.human) { // corpo realista: peças feitas em código e moldadas na cabeça real
    const fx = [];
    let cut = null; { const H0 = headInfo(ch.root), T0 = G.top && HEAD_GEAR[G.top]; if (H0) H0.covered = !!(T0 && T0.covers); }
    for (const id of [G.top, G.face, G.mouth]) if (id && HEAD_GEAR[id]) { try { const r = buildHeadGear(ch.root, id); if (r && r.fx) fx.push(r.fx); if (r && r.cut && id === G.top) cut = r.cut; } catch (e) { console.warn('acessório de cabeça', id, e); } }
    const T = G.top && HEAD_GEAR[G.top];
    if (T && T.covers) { if (T.tight || !cut) hairUnderHat(ch.root, !!T.tight); else try { squashHair(ch.root, cut); } catch (e) { console.warn('cabelo sob o chapéu', e); hairUnderHat(ch.root); } }
    if (fx.length || (G.top && HEAD_GEAR[G.top])) return fx.length ? t => fx.forEach(f => f(t)) : null;
  }
  return applyHatOld(ch, G.top, MODELS, customHead);
}
function applyHatOld(ch, hatId, MODELS, customHead = true) {
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
   P-019 — ACESSÓRIOS DE CABEÇA (topo, meio/olhos e baixo/boca, como no Ragnarok), feitos em código e
   MOLDADOS NA CABEÇA REAL de cada personagem: na pose parada medimos o crânio (com e sem cabelo), os olhos,
   o nariz, a boca, o queixo e as orelhas; cada peça é construída no espaço do personagem e presa ao osso da
   cabeça (pinToBone) — encaixa em humano, elfo e anão, homem e mulher, com qualquer rosto do criador.
   Para criar um acessório novo: uma entrada em HEAD_GEAR { slot, covers, tight, build(H, mk) } + o item em data.js.
   ========================================================================= */
const _hv = new THREE.Vector3();
const HG_SEC = 48;
function headInfo(root) {
  if (root.userData._headInfo) return root.userData._headInfo;
  humanIdlePose(root); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), head = [], hair = [], beard = [];
  let emn = null, emx = null;
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const isHead = o.name === 'PlayerHead' || /^SuperHero/i.test(o.name) || /_Head(_Hooded)?$/.test(o.name), isBeard = /Beard/.test(o.name), isHair = /^Hair_/.test(o.name) && !isBeard, isEye = /^Eyes/.test(o.name);
    if (!(isHead || isHair || isBeard || isEye) || (!o.visible && !isHair)) return;
    const g = o.geometry, n = g.attributes.position.count; let used = null; if (g.index) { used = new Uint8Array(n); const ix = g.index.array; for (let k = 0; k < ix.length; k++) used[ix[k]] = 1; }
    const db = isHead ? (o.userData._dom || (o.userData._dom = domBones(o))) : null, step = isHead ? 1 : 2;
    for (let v = 0; v < n; v += step) {
      if (used && !used[v]) continue; if (db && db[v] !== 'Head') continue;
      o.getVertexPosition(v, _hv); _hv.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (isEye) { emn = emn ? emn.min(_hv) : _hv.clone(); emx = emx ? emx.max(_hv) : _hv.clone(); }
      else (isHead ? head : isHair ? hair : beard).push(_hv.clone());
    }
  });
  if (!head.length) return null;
  const hb = new THREE.Box3().setFromPoints(head);
  const E = emn ? emn.clone().add(emx).multiplyScalar(0.5) : new THREE.Vector3((hb.min.x + hb.max.x) / 2, hb.min.y + (hb.max.y - hb.min.y) * 0.55, hb.max.z - 0.03);
  const eyeHalf = emn ? Math.max(0.02, (emx.x - emn.x) / 2 - 0.012) : 0.032, eyeZ = emn ? emx.z : hb.max.z - 0.02;
  // eixo do crânio (centro em x/z) na altura dos olhos para cima
  const sk = head.filter(p => p.y > E.y - 0.01 && p.y < E.y + 0.07), skb = new THREE.Box3().setFromPoints(sk.length ? sk : head);
  const cx = E.x, cz = (skb.min.z + skb.max.z) / 2;
  const top = hb.max.y, hairTop = hair.length ? Math.max(top, new THREE.Box3().setFromPoints(hair).max.y) : top;
  const y0 = E.y - 0.17, dy = 0.006, rows = Math.ceil((hairTop + 0.02 - y0) / dy) + 1;
  const table = pts => { const T = Array.from({ length: rows }, () => new Float32Array(HG_SEC)); for (const p of pts) { const i = Math.round((p.y - y0) / dy); if (i < 0 || i >= rows) continue; const a = Math.atan2(p.x - cx, p.z - cz), j = ((Math.round(a / (Math.PI * 2) * HG_SEC) % HG_SEC) + HG_SEC) % HG_SEC, r = Math.hypot(p.x - cx, p.z - cz); if (r > T[i][j]) T[i][j] = r; }
    for (let i = 0; i < rows; i++) { const row = T[i]; if (!row.some(r => r > 0)) continue; for (let j = 0; j < HG_SEC; j++) if (!row[j]) { let a = 1; while (!row[(j - a + HG_SEC) % HG_SEC] && a < HG_SEC) a++; let c = 1; while (!row[(j + c) % HG_SEC] && c < HG_SEC) c++; row[j] = (row[(j - a + HG_SEC) % HG_SEC] * c + row[(j + c) % HG_SEC] * a) / (a + c); } }
    let last = -1; for (let i = 0; i < rows; i++) if (T[i].some(r => r > 0)) last = i;
    for (let i = 0; i < rows; i++) if (!T[i].some(r => r > 0)) { let a = i; while (a >= 0 && !T[a].some(r => r > 0)) a--; if (a >= 0 && i < last) { let c = i; while (c < rows && !T[c].some(r => r > 0)) c++; for (let j = 0; j < HG_SEC; j++) T[i][j] = (T[a][j] + T[c][j]) / 2; } }
    // cada fatia vira uma curva suave (série de Fourier até a 5ª harmônica: some o calombo de orelha/vértice solto) e as fatias se suavizam na vertical
    for (let i = 0; i < rows; i++) { const r = T[i]; if (!r.some(v => v > 0)) continue; const c = [], d = []; for (let k = 0; k <= 5; k++) { let ck = 0, dk = 0; for (let j = 0; j < HG_SEC; j++) { const a = j / HG_SEC * Math.PI * 2; ck += r[j] * Math.cos(k * a); dk += r[j] * Math.sin(k * a); } c.push(ck / HG_SEC * (k ? 2 : 1)); d.push(dk / HG_SEC * (k ? 2 : 1)); }
      for (let j = 0; j < HG_SEC; j++) { const a = j / HG_SEC * Math.PI * 2; let v = 0; for (let k = 0; k <= 5; k++) v += c[k] * Math.cos(k * a) + d[k] * Math.sin(k * a); r[j] = Math.max(v, r[j] * 0.995); } }
    for (let pass = 0; pass < 2; pass++) { const C = T.map(r => r.slice()); for (let i = 1; i < last; i++) if (C[i - 1].some(v => v > 0) && C[i + 1].some(v => v > 0)) for (let j = 0; j < HG_SEC; j++) T[i][j] = Math.max(C[i][j] * 0.995, (C[i - 1][j] + C[i][j] * 2 + C[i + 1][j]) / 4); }
    return { T, last }; };
  const S = table(head), SH = table(hair.length ? head.concat(hair) : head), SB = table(beard.length ? head.concat(beard) : head);
  const rad = (tab, y, a) => { const f = (y - y0) / dy, i0 = Math.max(0, Math.min(tab.last, Math.floor(f))), i1 = Math.min(tab.last, i0 + 1), w = Math.max(0, Math.min(1, f - i0)), g = ((a / (Math.PI * 2)) * HG_SEC % HG_SEC + HG_SEC) % HG_SEC, j0 = Math.floor(g), j1 = (j0 + 1) % HG_SEC, wj = g - j0;
    const r = (i, j) => tab.T[i][j]; return (r(i0, j0) * (1 - wj) + r(i0, j1) * wj) * (1 - w) + (r(i1, j0) * (1 - wj) + r(i1, j1) * wj) * w; };
  // nariz, boca, queixo e orelhas
  let N = new THREE.Vector3(cx, E.y - 0.045, eyeZ + 0.02); for (const p of head) if (Math.abs(p.x - cx) < 0.012 && p.y < E.y - 0.012 && p.y > E.y - 0.085 && p.z > N.z) N = p.clone();
  let chinY = N.y - 0.075; for (const p of head) if (Math.abs(p.x - cx) < 0.025 && p.z > cz + 0.025 && p.y < chinY && p.y > N.y - 0.13) chinY = p.y;
  const mouthY = N.y - (N.y - chinY) * 0.42, frontZ = y => cz + rad(S, y, 0);
  const H = { root, cx, cz, E, eyeHalf, eyeZ, N, chinY, mouthY, mouthZ: frontZ(mouthY), top, hairTop, beard: beard.length > 0,
    R: (y, a) => rad(S, y, a), RH: (y, a) => rad(SH, y, a), RB: (y, a) => rad(SB, y, a),
    at: (y, a, r) => new THREE.Vector3(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r),
    earY: E.y - 0.012, earR: rad(S, E.y - 0.012, Math.PI / 2) };
  root.userData._headInfo = H; return H;
}
// superfície a partir de anéis (cada anel = mesma quantidade de pontos); fechada em volta, com tampa opcional no fim
function hgSweep(rings, o = {}) {
  const n = rings[0].length, closed = o.closed !== false, cols = closed ? n + 1 : n, pos = [], uv = [], idx = [];
  rings.forEach((ring, i) => { for (let j = 0; j < cols; j++) { const p = ring[j % n]; pos.push(p.x, p.y, p.z); uv.push(j / (cols - 1) * (o.uRep || 1), i / (rings.length - 1) * (o.vRep || 1)); } });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; if (o.flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  if (o.capEnd) { const ci = pos.length / 3; pos.push(o.capEnd.x, o.capEnd.y, o.capEnd.z); uv.push(0.5, o.vRep || 1); const base = (rings.length - 1) * cols; for (let j = 0; j < cols - 1; j++) o.flip ? idx.push(base + j, base + j + 1, ci) : idx.push(base + j, ci, base + j + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// anel em volta da cabeça na altura y(a) (pode inclinar), com folga; tab = 'R' (crânio), 'RH' (com cabelo) ou 'RB' (com barba)
const hgRing = (H, yOf, off, tab = 'R', n = HG_SEC, a0 = -Math.PI, a1 = Math.PI, closed = true) => { const out = []; for (let k = 0; k < (closed ? n : n + 1); k++) { const a = a0 + (a1 - a0) * k / n, y = typeof yOf === 'function' ? yOf(a) : yOf; out.push(H.at(y, a, H[tab](y, a) + (typeof off === 'function' ? off(a, y) : off))); } return out; };
// casca sobre o crânio: de y0(a) até o topo (fecha numa tampa), folga off e espessura th (camada de dentro + barra na borda)
function hgShell(H, y0, off, o = {}) {
  const tab = o.tab || 'R', topY = (tab === 'RH' ? H.hairTop : H.top), rows = o.rows || 14, th = o.th ?? 0;
  const mk = (extra) => { const rings = []; for (let i = 0; i < rows; i++) { const v = i / (rows - 1); rings.push(hgRing(H, a => { const b = y0(a); return b + (topY - 0.004 - b) * (1 - Math.pow(1 - v, 1.15)); }, (a, y) => off + extra + (o.bulge ? o.bulge(a, y, v) : 0), tab)); }
    return hgSweep(rings, { capEnd: new THREE.Vector3(H.cx, topY + off + extra + (o.capLift || 0), H.cz), uRep: o.uRep || 3, vRep: o.vRep || 1.5, flip: extra === th }); }; // camada de fora vira para fora; a de dentro, para dentro
  const geos = [mk(th)]; if (th > 0) geos.push(mk(0));
  return geos;
}
// cúpula lisa (elmo): base no anel y0(a), raio de cada direção = o maior do crânio dali para cima (cobre tudo, sem calombo),
// subindo como uma elipse até o topo; th = espessura (casca de dentro)
function hgDome(H, y0, off, th = 0) {
  const n = HG_SEC, rows = 18, base = [], yTop = H.top + off;
  for (let k = 0; k < n; k++) { const a = -Math.PI + 2 * Math.PI * k / n, yb = y0(a); let rb = 0; for (let y = yb; y < H.top - 0.02; y += 0.006) rb = Math.max(rb, H.R(y, a)); base.push({ a, yb, rb }); }
  for (let pass = 0; pass < 3; pass++) { const c = base.map(b => b.rb); base.forEach((b, k) => { b.rb = (c[(k + n - 1) % n] + 2 * c[k] + c[(k + 1) % n]) / 4; }); }
  const mk = (extra, flip) => { const rings = []; for (let i = 0; i < rows; i++) { const th0 = i / (rows - 1) * Math.PI / 2 * 0.985; rings.push(base.map(({ a, yb, rb }) => { const y = yb + (yTop + extra - yb) * Math.sin(th0), r = Math.max((rb + off + extra) * Math.cos(th0), Math.cos(th0) > 0.2 ? H.R(y, a) + off * 0.6 + extra : 0); return H.at(y, a, r); })); }
    return hgSweep(rings, { capEnd: new THREE.Vector3(H.cx, yTop + extra, H.cz), uRep: 3, flip }); };
  return th > 0 ? [mk(th, true), mk(0, false)] : [mk(0, true)];
}
// tubo afinado (raio r0 → r1) ao longo de uma curva
function taperTube(curve, r0, r1, seg = 24, radial = 8, closed = false) {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, closed), P = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const t = i / seg, r = r0 + (r1 - r0) * t, c = curve.getPointAt(Math.min(1, t)); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + nrm.getX(k) * r, c.y + nrm.getY(k) * r, c.z + nrm.getZ(k) * r); } }
  g.computeVertexNormals(); return g;
}
// aba (chapéu): coroa interna seguindo o anel da cabeça, abrindo w para fora; lift(a, t) levanta/abaixa a aba; espessura th
function hgBrim(H, y, off, w, lift, th = 0.006, tab = 'R') {
  const n = 64, ringsTop = [], ringsBot = [], seg = 6;
  for (let s = 0; s <= seg; s++) { const t = s / seg, top = [], bot = []; for (let k = 0; k < n; k++) { const a = -Math.PI + Math.PI * 2 * k / n, r = H[tab](y, a) + off + (typeof w === 'function' ? w(a) : w) * t, yy = y + lift(a, t); top.push(H.at(yy + th / 2, a, r)); bot.push(H.at(yy - th / 2, a, r)); } ringsTop.push(top); ringsBot.push(bot); }
  const edge = [ringsTop[seg], ringsBot[seg]];
  return [hgSweep(ringsTop, { uRep: 4 }), hgSweep(ringsBot, { flip: true, uRep: 4 }), hgSweep(edge, { uRep: 4 })];
}
// fita (tira plana) ao longo de uma curva, com largura w e normal "para fora" da cabeça
function hgRibbon(H, pts, w, closed = false) {
  const n = pts.length, top = [], bot = [];
  for (let i = 0; i < n; i++) { const p = pts[i], out = new THREE.Vector3(p.x - H.cx, 0, p.z - H.cz).normalize(); top.push(p.clone().add(new THREE.Vector3(0, w / 2, 0)).addScaledVector(out, 0.0015)); bot.push(p.clone().add(new THREE.Vector3(0, -w / 2, 0)).addScaledVector(out, 0.0015)); }
  return hgSweep([top, bot], { closed, uRep: 6 });
}
// pena de verdade: haste fina + duas lâminas de barbas (textura com transparência), curvada
function hgFeather(len, w, col, tip = '#f2efe6') {
  const N = 14, pts = []; for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(0, t * len, -Math.pow(t, 2) * len * 0.18)); }
  const spine = new THREE.CatmullRomCurve3(pts), g = new THREE.Group();
  g.add(new THREE.Mesh(taperTube(spine, 0.0022, 0.0006, 16, 5), std('#f4eee0', { roughness: 0.5 })));
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N, p = spine.getPointAt(t), hw = w * Math.pow(Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.95), 0.7) * (t < 0.12 ? t / 0.12 : 1); for (const s of [-1, 1]) { pos.push(p.x + s * hw, p.y - hw * 0.25, p.z - hw * 0.12); uv.push(s < 0 ? 0 : 1, t); } pos.push(p.x, p.y, p.z); uv.push(0.5, t); }
  for (let i = 0; i < N; i++) { const a = i * 3, b = a + 3; idx.push(a, b, a + 2, a + 2, b, b + 2, a + 2, b + 2, a + 1, a + 1, b + 2, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: featherTex(col, tip), alphaTest: 0.35, transparent: false, side: THREE.DoubleSide, roughness: 0.75 })));
  return g;
}
const _hgTex = {};
function featherTex(col, tip) {
  const k = col + tip; if (_hgTex[k]) return _hgTex[k];
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 256; y += 2) { const t = y / 256; x.strokeStyle = t > 0.82 ? tip : col; x.globalAlpha = 0.75 + r() * 0.25; x.lineWidth = 1.6; for (const side of [-1, 1]) { const len = 30 * (0.75 + r() * 0.3) - (r() < 0.06 ? 14 : 0); x.beginPath(); x.moveTo(32, 256 - y); x.quadraticCurveTo(32 + side * len * 0.6, 256 - y - 6, 32 + side * len, 256 - y - 12); x.stroke(); } }
  x.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (_hgTex[k] = t);
}
// texturas: palha trançada, tricô e folha (com transparência)
function strawTex() { if (_hgTex.straw) return _hgTex.straw; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#c9a85a'; x.fillRect(0, 0, 256, 256); for (let row = 0; row < 32; row++) for (let col = 0; col < 16; col++) { const y = row * 8, x0 = col * 16 + (row % 2) * 8, l = 120 + r() * 50; x.fillStyle = `rgb(${l + 70},${l + 45},${l - 20})`; x.beginPath(); x.ellipse(x0 + 8, y + 4, 7.5, 3.4, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(80,55,20,0.35)'; x.fillRect(x0, y + 7, 16, 1); }
  for (let k = 0; k < 300; k++) { x.strokeStyle = `rgba(250,230,170,${r() * 0.25})`; x.beginPath(); const a = r() * 256, b = r() * 256; x.moveTo(a, b); x.lineTo(a + 6 + r() * 8, b + (r() - 0.5) * 2); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_hgTex.straw = t); }
function knitTex() { if (_hgTex.knit) return _hgTex.knit; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 128, 128);
  for (let col = 0; col < 16; col++) for (let row = 0; row < 16; row++) { const cx = col * 8 + 4, cy = row * 8 + 4; const g = x.createLinearGradient(cx - 4, 0, cx + 4, 0); g.addColorStop(0, '#6a6a6a'); g.addColorStop(0.5, '#e6e6e6'); g.addColorStop(1, '#6a6a6a'); x.fillStyle = g; x.beginPath(); x.moveTo(cx - 3.5, cy - 4); x.quadraticCurveTo(cx, cy + 2, cx, cy + 4); x.quadraticCurveTo(cx, cy + 2, cx + 3.5, cy - 4); x.quadraticCurveTo(cx, cy - 1, cx - 3.5, cy - 4); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return (_hgTex.knit = t); }
function leafTex(kind) { if (_hgTex['leaf' + kind]) return _hgTex['leaf' + kind]; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const leaf = (cx, cy, len, wid, ang, c1, c2) => { x.save(); x.translate(cx, cy); x.rotate(ang); const g = x.createLinearGradient(0, -wid, 0, wid); g.addColorStop(0, c2); g.addColorStop(0.5, c1); g.addColorStop(1, c2); x.fillStyle = g; x.beginPath(); x.moveTo(-len / 2, 0); x.bezierCurveTo(-len / 4, -wid, len / 4, -wid, len / 2, 0); x.bezierCurveTo(len / 4, wid, -len / 4, wid, -len / 2, 0); x.fill();
    x.strokeStyle = 'rgba(220,240,180,0.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.stroke(); x.lineWidth = 1; for (let k = -4; k <= 4; k++) { if (!k) continue; const px = k * len / 10; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + len / 14, -wid * 0.7 * Math.sign(k) * 0 - wid * 0.6); x.moveTo(px, 0); x.lineTo(px + len / 14, wid * 0.6); x.stroke(); } x.restore(); };
  if (kind === 'mask') { leaf(72, 128, 160, 120, -0.22, '#4f8f34', '#2c5a1c'); leaf(184, 128, 160, 120, 0.22, '#4f8f34', '#2c5a1c'); leaf(128, 104, 70, 36, 0, '#5a9a3c', '#2c5a1c'); x.globalCompositeOperation = 'destination-out'; for (const ex of [80, 176]) { x.beginPath(); x.ellipse(ex, 134, 24, 15, 0, 0, 7); x.fill(); } }
  else leaf(128, 128, 220, 70, 0, '#5cb048', '#2f6a24');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (_hgTex['leaf' + kind] = t); }
function maskTex() { if (_hgTex.mask) return _hgTex.mask; const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#3a1640'); g.addColorStop(1, '#1e0a24'); x.fillStyle = g; x.beginPath(); x.moveTo(10, 70); x.bezierCurveTo(60, 0, 190, 10, 256, 52); x.bezierCurveTo(322, 10, 452, 0, 502, 70); x.bezierCurveTo(470, 140, 330, 150, 256, 110); x.bezierCurveTo(182, 150, 42, 140, 10, 70); x.fill();
  x.strokeStyle = '#d8b25a'; x.lineWidth = 6; x.stroke(); x.lineWidth = 2; for (let k = 0; k < 18; k++) { x.beginPath(); x.arc(60 + k * 22, 40 + Math.sin(k) * 6, 4, 0, 7); x.stroke(); }
  x.globalCompositeOperation = 'destination-out'; for (const ex of [168, 344]) { x.beginPath(); x.ellipse(ex, 82, 54, 30, ex < 256 ? 0.12 : -0.12, 0, 7); x.fill(); }
  x.globalCompositeOperation = 'source-over'; x.strokeStyle = '#e8c86a'; x.lineWidth = 4; for (const ex of [168, 344]) { x.beginPath(); x.ellipse(ex, 82, 56, 32, ex < 256 ? 0.12 : -0.12, 0, 7); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_hgTex.mask = t); }
function starCloth(base) { const k = 'star' + base; if (_hgTex[k]) return _hgTex[k]; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = base; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 2400; k++) { x.fillStyle = `rgba(255,255,255,${r() * 0.04})`; x.fillRect(r() * 256, r() * 256, 1, 2); }
  x.fillStyle = '#e6c46a'; for (let k = 0; k < 14; k++) { const cx = r() * 256, cy = r() * 256, R = 4 + r() * 4; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? R * 0.42 : R; x.lineTo(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr); } x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_hgTex[k] = t); }
const HGM = {
  cloth: (col, kind = 'linho', rough = 0.88) => new THREE.MeshStandardMaterial({ color: col, map: fabricTex(kind), roughness: rough, side: THREE.DoubleSide }),
  felt: (col) => new THREE.MeshStandardMaterial({ color: col, map: fabricTex('camurca'), roughness: 0.92, side: THREE.DoubleSide }),
  straw: () => new THREE.MeshStandardMaterial({ map: strawTex(), roughness: 0.9, side: THREE.DoubleSide }),
  knit: (col) => new THREE.MeshStandardMaterial({ color: col, map: knitTex(), bumpMap: knitTex(), bumpScale: 1.2, roughness: 0.95, side: THREE.DoubleSide }),
  wood: (col = '#5a3620') => new THREE.MeshStandardMaterial({ color: col, map: metalTex('couro'), roughness: 0.55, metalness: 0.02 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: '#dfeaf2', roughness: 0.04, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.28, envMap: armorEnv(), envMapIntensity: 1.2, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
  gem: (col) => new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.05, metalness: 0.1, clearcoat: 1, envMap: armorEnv(), envMapIntensity: 1.4 }),
};
// cabeça → peças: cada builder devolve [objetos (no espaço do personagem)] e, se quiser, uma animação (fx)
const HEAD_GEAR = {
  /* -------- TOPO -------- */
  bandana: { slot: 'top', covers: true, build(H) {
    const mat = HGM.cloth('#a32a24'), y0 = a => H.E.y + 0.042 - 0.075 * (1 - Math.cos(a)) / 2;
    const out = hgShell(H, y0, 0.009, { th: 0.002, rows: 12 }).map(g => new THREE.Mesh(g, mat));
    const kn = H.at(y0(Math.PI) + 0.012, Math.PI, H.R(y0(Math.PI), Math.PI) + 0.014), knot = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.008, 10, 20), mat); knot.position.copy(kn); knot.scale.set(1, 0.7, 0.9); out.push(knot);
    for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(kn.clone().add(new THREE.Vector3(s * (0.008 + t * 0.03), -t * 0.13, -0.012 - t * 0.03))); } const w = []; for (const p of pts) w.push(p); const top = w.map(p => p.clone().add(new THREE.Vector3(0.012, 0, 0))), bot = w.map(p => p.clone().add(new THREE.Vector3(-0.012, 0, 0))); out.push(new THREE.Mesh(hgSweep([top, bot], { closed: false }), mat)); }
    return { objs: out, cut: a => y0(a) + 0.004 }; } },
  chapeu_de_palha: { slot: 'top', covers: true, build(H) {
    const mat = HGM.straw(), yb = H.E.y + 0.058, out = [];
    out.push(...hgBrim(H, yb, 0.016, 0.15, (a, t) => -0.018 * t * t * (0.6 + 0.4 * Math.cos(a) ** 2) + 0.006 * t, 0.007).map(g => new THREE.Mesh(g, mat)));
    const rings = []; for (let i = 0; i <= 10; i++) { const v = i / 10, yy = yb + v * 0.105, sc = 1 - Math.pow(v, 3) * 0.55; rings.push(hgRing(H, yb, 0, 'R').map((p, j) => { const d = new THREE.Vector3(p.x - H.cx, 0, p.z - H.cz); return new THREE.Vector3(H.cx + d.x * sc * 1.06 + 0, yy, H.cz + d.z * sc * 1.06); })); }
    out.push(new THREE.Mesh(hgSweep(rings, { capEnd: new THREE.Vector3(H.cx, yb + 0.115, H.cz), uRep: 4 }), mat));
    const band = []; for (let k = 0; k < HG_SEC; k++) { const a = -Math.PI + 2 * Math.PI * k / HG_SEC, p = hgRing(H, yb, 0, 'R')[k]; const d = new THREE.Vector3(p.x - H.cx, 0, p.z - H.cz).multiplyScalar(1.072); band.push(new THREE.Vector3(H.cx + d.x, yb + 0.018, H.cz + d.z)); } out.push(new THREE.Mesh(hgRibbon(H, band, 0.026, true), HGM.cloth('#7a2a1e')));
    return { objs: out, cut: () => yb + 0.002 }; } },
  coroa_de_flores: { slot: 'top', covers: false, build(H) {
    const out = [], yOf = a => H.E.y + 0.07 + 0.03 * (1 - Math.cos(a)) / 2, vineMat = std('#4a6a2a', { roughness: 0.8 });
    for (const ph of [0, Math.PI]) { const pts = []; for (let k = 0; k < 64; k++) { const a = -Math.PI + 2 * Math.PI * k / 64; pts.push(H.at(yOf(a) + Math.sin(a * 9 + ph) * 0.004, a, H.RH(yOf(a), a) + 0.008 + Math.cos(a * 9 + ph) * 0.003)); } out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0035, 6, true), vineMat)); }
    const cols = ['#f2f0ea', '#f4c6d6', '#f6e27a', '#c9b2f0', '#f2f0ea', '#f7a8b8', '#f6e27a', '#f2f0ea', '#c9b2f0'];
    cols.forEach((col, i) => { const a = -1.9 + i * (3.8 / (cols.length - 1)), y = yOf(a), p = H.at(y + 0.004, a, H.RH(y, a) + 0.016), f = flowerMesh(0.017 + (i % 3) * 0.003, col); f.position.copy(p); f.lookAt(H.at(y + 0.06, a, H.RH(y, a) + 0.3)); out.push(f); });
    for (let i = 0; i < 8; i++) { const a = -2.2 + i * 0.62, y = yOf(a), p = H.at(y - 0.004, a, H.RH(y, a) + 0.012), lf = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.013), new THREE.MeshStandardMaterial({ map: leafTex('one'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 })); lf.position.copy(p); lf.lookAt(H.at(y, a, H.RH(y, a) + 0.3)); lf.rotateZ(0.6 * (i % 2 ? 1 : -1)); out.push(lf); }
    return { objs: out }; } },
  elmo_de_ferro: { slot: 'top', covers: true, build(H) {
    const mat = new THREE.MeshStandardMaterial({ color: '#7a8088', metalness: 0.85, roughness: 0.36, envMap: armorEnv(), envMapIntensity: 0.55 }), y0 = a => H.E.y + 0.026 - 0.11 * (1 - Math.cos(a)) / 2 - 0.02 * Math.pow(Math.abs(Math.sin(a)), 4);
    const out = hgDome(H, y0, 0.016, 0.008).map(g => new THREE.Mesh(g, mat));
    const brow = hgRing(H, a => y0(a) + 0.008, 0.026, 'R', 64); out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brow, true), 96, 0.0065, 8, true), mat));
    const crest = []; for (let k = 0; k <= 20; k++) { const t = k / 20, a = t < 0.5 ? 0 : Math.PI, f = t < 0.5 ? t * 2 : (1 - t) * 2, y = y0(a) + 0.02 + (H.top - y0(a) - 0.02) * Math.sin(f * Math.PI / 2); crest.push(H.at(y, a, H.R(y, a) + 0.027)); } crest.splice(10, 1, new THREE.Vector3(H.cx, H.top + 0.026, H.cz)); out.push(new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(crest), 0.006, 0.006, 40, 8), mat));
    const nas = []; for (let k = 0; k <= 6; k++) { const y = y0(0) + 0.01 - k * ((y0(0) + 0.01 - (H.N.y + 0.012)) / 6); nas.push(new THREE.Vector3(H.cx, y, H.cz + H.R(y, 0) + 0.02 - k * 0.0005)); } out.push(new THREE.Mesh(hgRibbon(H, nas.map(p => p), 0.001), mat)); { const g = new THREE.Group(); const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, (y0(0) - H.N.y), 0.006, 1, 6, 1), mat); strip.position.set(H.cx, (y0(0) + 0.01 + H.N.y + 0.012) / 2, H.cz + H.R(H.E.y, 0) + 0.024); g.add(strip); out.push(g); }
    for (let k = 0; k < 12; k++) { const a = -Math.PI + 2 * Math.PI * k / 12, y = y0(a) + 0.008, rv = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat); rv.position.copy(H.at(y, a, H.R(y, a) + 0.033)); rv.lookAt(H.at(y, a, 2)); rv.rotateX(Math.PI / 2); out.push(rv); }
    return { objs: out, cut: a => y0(a) + 0.006 }; } },
  chapeu_de_mago: { slot: 'top', covers: true, build(H) {
    const mat = new THREE.MeshStandardMaterial({ map: starCloth('#2a2468'), roughness: 0.85, side: THREE.DoubleSide }), yb = H.E.y + 0.055, out = [];
    out.push(...hgBrim(H, yb, 0.014, a => 0.09 + 0.012 * Math.sin(a * 5), (a, t) => -0.012 * t * t + 0.004 * Math.sin(a * 3) * t, 0.006).map(g => new THREE.Mesh(g, mat)));
    const base = hgRing(H, yb, 0.014, 'R'), rings = [], Hh = 0.4, sp = []; for (let i = 0; i <= 18; i++) { const v = i / 18; sp.push(new THREE.Vector3(H.cx, yb + v * Hh - Math.pow(v, 3) * 0.08, H.cz - Math.pow(v, 2) * 0.13)); }
    for (let i = 0; i <= 18; i++) { const v = i / 18, sc = Math.pow(1 - v, 1.25) * (1 + 0.04 * Math.sin(v * 9)), c = sp[i]; rings.push(base.map(p => new THREE.Vector3(c.x + (p.x - H.cx) * sc, c.y, c.z + (p.z - H.cz) * sc))); }
    out.push(new THREE.Mesh(hgSweep(rings, { capEnd: sp[18], uRep: 3, vRep: 2 }), mat));
    const band = base.map(p => { const d = new THREE.Vector3(p.x - H.cx, 0, p.z - H.cz).multiplyScalar(0.97); return new THREE.Vector3(H.cx + d.x, yb + 0.016, H.cz + d.z); }); out.push(new THREE.Mesh(hgRibbon(H, band, 0.022, true), AM.gold('#c9a24a')));
    return { objs: out, cut: () => yb + 0.002 }; } },
  chapeu_de_bardo: { slot: 'top', covers: true, build(H) {
    const mat = HGM.cloth('#5e1838', 'veludo', 0.8), yb = H.E.y + 0.06, out = [];
    out.push(...hgBrim(H, yb, 0.012, a => 0.05 + 0.025 * Math.max(0, Math.sin(a)), (a, t) => 0.05 * t * Math.max(0, -Math.sin(a)) - 0.008 * t * t, 0.006).map(g => new THREE.Mesh(g, mat)));
    const rings = []; for (let i = 0; i <= 10; i++) { const v = i / 10, sc = 1.08 + 0.12 * Math.sin(v * Math.PI * 0.9) - Math.pow(v, 4) * 0.7, yy = yb + v * 0.075, sh = new THREE.Vector3(0.025 * v, 0, -0.01 * v); rings.push(hgRing(H, yb, 0, 'R').map(p => new THREE.Vector3(H.cx + (p.x - H.cx) * sc + sh.x, yy, H.cz + (p.z - H.cz) * sc + sh.z))); }
    out.push(new THREE.Mesh(hgSweep(rings, { capEnd: new THREE.Vector3(H.cx + 0.025, yb + 0.08, H.cz - 0.01), uRep: 4 }), mat));
    const fp = new THREE.Group(), anchor = H.at(yb + 0.03, -1.9, H.R(yb, -1.9) + 0.03); fp.position.copy(anchor); const fe = hgFeather(0.26, 0.022, '#d8364e', '#f7efe2'); fe.rotation.set(-1.0, -0.4, 0.5); fp.add(fe); out.push(fp);
    return { objs: out, cut: () => yb + 0.002, fx: t => { fe.rotation.x = -1.0 + Math.sin(t * 1.7) * 0.05; fe.rotation.z = 0.5 + Math.sin(t * 2.3 + 1) * 0.04; } }; } },
  tricornio: { slot: 'top', covers: true, build(H) {
    const mat = HGM.felt('#221c1a'), yb = H.E.y + 0.056, out = [];
    const up = a => Math.pow(1 - (Math.cos(3 * a) + 1) / 2, 0.7), lift = (a, t) => 0.075 * up(a) * Math.pow(t, 1.15) + 0.004 * t, bw = a => 0.05 + 0.04 * Math.pow(Math.max(0, Math.cos(3 * a)), 2) - 0.012 * up(a);
    out.push(...hgBrim(H, yb, 0.012, bw, lift, 0.006).map(g => new THREE.Mesh(g, mat)));
    const rings = []; for (let i = 0; i <= 8; i++) { const v = i / 8, sc = 1.07 - Math.pow(v, 3) * 0.6, yy = yb + v * 0.07; rings.push(hgRing(H, yb, 0, 'R').map(p => new THREE.Vector3(H.cx + (p.x - H.cx) * sc, yy, H.cz + (p.z - H.cz) * sc))); } out.push(new THREE.Mesh(hgSweep(rings, { capEnd: new THREE.Vector3(H.cx, yb + 0.074, H.cz), uRep: 4 }), mat));
    const edge = []; for (let k = 0; k < 96; k++) { const a = -Math.PI + 2 * Math.PI * k / 96, r = H.R(yb, a) + 0.012 + bw(a); edge.push(H.at(yb + lift(a, 1), a, r)); } out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 160, 0.0035, 6, true), AM.gold('#c8a24a')));
    return { objs: out, cut: () => yb + 0.002 }; } },
  capuz_sombrio: { slot: 'top', covers: true, tight: true, build(H) {
    const mat = HGM.cloth('#262033', 'veludo', 0.92), out = [], yTop = H.E.y + 0.05;
    out.push(...hgShell(H, a => yTop - 0.04 * (1 - Math.cos(a)) / 2, 0.03, { th: 0.004, rows: 12, tab: 'RH', bulge: (a, y, v) => 0.012 * Math.max(0, -Math.cos(a)) * (1 - v) }).map(g => new THREE.Mesh(g, mat)));
    const rings = [], open = 1.0; for (let i = 0; i <= 10; i++) { const v = i / 10, y = yTop - v * 0.3, flare = v * v * 0.17; rings.push(hgRing(H, a => y - 0.04 * (1 - Math.cos(a)) / 2 * (1 - v), (a, yy) => 0.03 + flare + 0.012 * Math.max(0, -Math.cos(a)), 'RH', 40, open - (v > 0.6 ? (v - 0.6) * 1.6 : 0), Math.PI * 2 - open + (v > 0.6 ? (v - 0.6) * 1.6 : 0), false).map(p => (p.y < H.E.y - 0.18 ? p.setY(p.y) : p))); }
    out.push(new THREE.Mesh(hgSweep(rings, { closed: false, uRep: 3 }), mat));
    return { objs: out }; } },
  tiara_arcana: { slot: 'top', covers: false, build(H) {
    const silver = AM.steel('#dfe4ea'), out = [], yOf = a => H.E.y + 0.058 + 0.035 * (1 - Math.cos(a)) / 2;
    const pts = []; for (let k = 0; k < 64; k++) { const a = -Math.PI + 2 * Math.PI * k / 64; pts.push(H.at(yOf(a), a, H.RH(yOf(a), a) + 0.004)); } out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0028, 6, true), silver));
    for (const s of [-1, 1]) { const arc = []; for (let k = 0; k <= 10; k++) { const t = k / 10, a = s * (0.05 + t * 0.6), y = yOf(a) + 0.012 * Math.sin(t * Math.PI); arc.push(H.at(y, a, H.RH(y, a) + 0.006)); } out.push(new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(arc), 0.0025, 0.001, 20, 6), silver)); }
    const gp = H.at(yOf(0) + 0.008, 0, H.RH(yOf(0) + 0.008, 0) + 0.01), gem = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), HGM.gem('#9a6aff')); gem.scale.set(1, 1.35, 0.6); gem.position.copy(gp); out.push(gem);
    const set = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 8, 24), silver); set.position.copy(gp); set.scale.set(1, 1.35, 1); out.push(set);
    return { objs: out, fx: t => { gem.material.emissiveIntensity = 0.25 + Math.sin(t * 2) * 0.1; } }; } },
  faixa_de_penas: { slot: 'top', covers: false, build(H) {
    const out = [], yOf = a => H.E.y + 0.05 + 0.025 * (1 - Math.cos(a)) / 2, pts = []; for (let k = 0; k < 64; k++) { const a = -Math.PI + 2 * Math.PI * k / 64; pts.push(H.at(yOf(a), a, H.RH(yOf(a), a) + 0.006)); }
    out.push(new THREE.Mesh(hgRibbon(H, pts, 0.018, true), AM.leatherCloth('#6a4026')));
    const cols = [['#8a5a2a', '#f2e8d6'], ['#2a4a6a', '#f4f0e6'], ['#a83a2a', '#1a1a1a']]; const fs = [];
    cols.forEach(([c1, c2], i) => { const a = 1.9 + i * 0.22, y = yOf(a), g = new THREE.Group(); g.position.copy(H.at(y, a, H.RH(y, a) + 0.012)); const f = hgFeather(0.12 - i * 0.012, 0.012, c1, c2); f.rotation.set(-0.7 - i * 0.15, a + Math.PI, 0.25); g.add(f); out.push(g); fs.push(f); });
    return { objs: out, fx: t => fs.forEach((f, i) => { f.rotation.z = 0.25 + Math.sin(t * 2 + i) * 0.04; }) }; } },
  gorro_de_la: { slot: 'top', covers: true, build(H) {
    const mat = HGM.knit('#b8862a'), y0 = a => H.E.y + 0.035 - 0.05 * (1 - Math.cos(a)) / 2, out = [];
    out.push(...hgShell(H, y0, 0.012, { th: 0.004, rows: 14, bulge: (a, y, v) => 0.018 * Math.sin(v * Math.PI * 0.9) * (0.6 + 0.4 * Math.max(0, -Math.cos(a))), capLift: 0.02, uRep: 8, vRep: 4 }).map(g => new THREE.Mesh(g, mat)));
    const cuff = []; for (let i = 0; i <= 4; i++) { const v = i / 4; cuff.push(hgRing(H, a => y0(a) - 0.002 + v * 0.036, 0.021 + 0.003 * Math.sin(v * Math.PI), 'R')); } out.push(new THREE.Mesh(hgSweep(cuff, { uRep: 10, vRep: 1 }), HGM.knit('#9a6e20')));
    return { objs: out, cut: a => y0(a) + 0.004 }; } },
  chapeu_de_viajante: { slot: 'top', covers: true, build(H) {
    const mat = HGM.felt('#5a4230'), yb = H.E.y + 0.058, out = [];
    out.push(...hgBrim(H, yb, 0.015, 0.135, (a, t) => 0.03 * t * t * Math.pow(Math.abs(Math.sin(a)), 2) - 0.012 * t * t * Math.cos(a) ** 2, 0.006).map(g => new THREE.Mesh(g, mat)));
    const rings = []; for (let i = 0; i <= 10; i++) { const v = i / 10, sc = 1.06 - Math.pow(v, 4) * 0.25, yy = yb + v * 0.1; rings.push(hgRing(H, yb, 0, 'R').map((p, j) => { const a = -Math.PI + 2 * Math.PI * j / HG_SEC, dent = v > 0.75 ? -0.03 * (v - 0.75) * 4 * Math.pow(Math.cos(a), 2) * 0 : 0; return new THREE.Vector3(H.cx + (p.x - H.cx) * sc, yy + dent, H.cz + (p.z - H.cz) * sc); })); }
    const ctr = rings[10]; const pinch = rings.map((r, i) => r.map((p, j) => { const a = -Math.PI + 2 * Math.PI * j / HG_SEC, v = i / 10; return v > 0.7 ? p.clone().add(new THREE.Vector3(0, -(v - 0.7) * 0.06 * Math.abs(Math.cos(a)) + 0, 0)) : p; })); void ctr;
    out.push(new THREE.Mesh(hgSweep(pinch, { capEnd: new THREE.Vector3(H.cx, yb + 0.085, H.cz), uRep: 4 }), mat));
    const band = hgRing(H, yb, 0, 'R').map(p => { const d = new THREE.Vector3(p.x - H.cx, 0, p.z - H.cz).multiplyScalar(1.062); return new THREE.Vector3(H.cx + d.x, yb + 0.014, H.cz + d.z); }); out.push(new THREE.Mesh(hgRibbon(H, band, 0.02, true), AM.leatherCloth('#2a1a10')));
    return { objs: out, cut: () => yb + 0.002 }; } },
  coroa_de_bronze: { slot: 'top', covers: false, build(H) {
    const mat = AM.gold('#b07a3a'), out = [], yOf = a => H.E.y + 0.07 + 0.01 * (1 - Math.cos(a)) / 2;
    const base = []; for (let k = 0; k < 64; k++) { const a = -Math.PI + 2 * Math.PI * k / 64; base.push(H.at(yOf(a), a, H.RH(yOf(a), a) + 0.006)); } out.push(new THREE.Mesh(hgRibbon(H, base, 0.022, true), mat));
    const rimT = base.map(p => p.clone().add(new THREE.Vector3(0, 0.011, 0))), rimB = base.map(p => p.clone().add(new THREE.Vector3(0, -0.011, 0)));
    for (const r of [rimT, rimB]) out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r, true), 96, 0.0022, 6, true), mat));
    for (let k = 0; k < 9; k++) { const a = -Math.PI + 2 * Math.PI * k / 9 + Math.PI / 9, y = yOf(a) + 0.011, sh = new THREE.Shape(); sh.moveTo(-0.012, 0); sh.quadraticCurveTo(-0.004, 0.012, 0, 0.032); sh.quadraticCurveTo(0.004, 0.012, 0.012, 0); sh.lineTo(-0.012, 0); const sp = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 2, curveSegments: 8 }), mat); sp.position.copy(H.at(y, a, H.RH(y, a) + 0.006)); sp.lookAt(H.at(y, a, 2)); out.push(sp); }
    for (const a of [0, Math.PI / 2, -Math.PI / 2]) { const y = yOf(a), g = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 12), HGM.gem(a === 0 ? '#b8302a' : '#2a6ab8')); g.scale.set(1, 1, 0.6); g.position.copy(H.at(y, a, H.RH(y, a) + 0.012)); g.lookAt(H.at(y, a, 2)); out.push(g); }
    return { objs: out }; } },
  /* -------- MEIO (OLHOS) -------- */
  oculos_redondos: { slot: 'face', build(H) {
    const wire = AM.gold('#8a6a3a'), out = [], z = H.eyeZ + 0.016, rr = 0.021;
    const C = s => new THREE.Vector3(H.cx + s * H.eyeHalf, H.E.y, z);
    for (const s of [-1, 1]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0016, 8, 40), wire); rim.position.copy(C(s)); out.push(rim); const lens = new THREE.Mesh(new THREE.CircleGeometry(rr, 32), HGM.glass()); lens.position.copy(C(s)); out.push(lens);
      const ear = H.at(H.earY + 0.008, s * Math.PI / 2 * 1.02, H.R(H.earY, s * Math.PI / 2) + 0.004), side = C(s).add(new THREE.Vector3(s * rr, 0.004, 0)); const sideBack = H.at(H.E.y + 0.006, s * 1.05, H.R(H.E.y, s * 1.05) + 0.006); const behind = ear.clone().add(new THREE.Vector3(0, -0.02, -0.018));
      out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([side, sideBack, ear, behind]), 24, 0.0012, 6), wire)); }
    const br = [C(-1).add(new THREE.Vector3(rr * 0.85, 0.004, 0)), new THREE.Vector3(H.cx, H.E.y + 0.009, z + 0.004), C(1).add(new THREE.Vector3(-rr * 0.85, 0.004, 0))]; out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(br), 12, 0.0013, 6), wire));
    return { objs: out }; } },
  mascara_folha: { slot: 'face', build(H) {
    const mat = new THREE.MeshStandardMaterial({ map: leafTex('mask'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }), rings = [];
    for (let i = 0; i <= 8; i++) { const v = i / 8, y = H.E.y - 0.032 + v * 0.07; rings.push(hgRing(H, y, 0.009 + 0.004 * Math.sin(v * Math.PI), 'R', 24, -1.25, 1.25, false)); }
    return { objs: [new THREE.Mesh(hgSweep(rings, { closed: false }), mat)] }; } },
  monoculo: { slot: 'face', build(H) {
    const gold = AM.gold('#c9a24a'), out = [], s = 1, c = new THREE.Vector3(H.cx + s * H.eyeHalf, H.E.y - 0.002, H.eyeZ + 0.012), rr = 0.019;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0022, 10, 40), gold); rim.position.copy(c); out.push(rim); const lens = new THREE.Mesh(new THREE.CircleGeometry(rr, 32), HGM.glass()); lens.position.copy(c); out.push(lens);
    const ch = []; const a = c.clone().add(new THREE.Vector3(s * rr * 0.7, -rr * 0.7, 0)); for (let k = 0; k <= 10; k++) { const t = k / 10; ch.push(a.clone().add(new THREE.Vector3(s * (0.01 + t * 0.035), -t * 0.11 - Math.sin(t * Math.PI) * 0.012, -t * 0.05))); }
    out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ch), 30, 0.0009, 5), gold));
    return { objs: out }; } },
  venda_de_pirata: { slot: 'face', build(H) {
    const leather = AM.leatherCloth('#1c1612'), out = [], s = 1, aE = Math.atan2(s * H.eyeHalf, H.eyeZ - H.cz);
    const rows = []; for (let i = 0; i <= 6; i++) { const v = i / 6 * 2 - 1, y = H.E.y + v * 0.022, hw = Math.sqrt(Math.max(0, 1 - v * v)) * 0.26 + 0.02; rows.push(hgRing(H, y, 0.006 + 0.003 * (1 - v * v), 'R', 12, aE - hw, aE + hw, false)); }
    out.push(new THREE.Mesh(hgSweep(rows, { closed: false }), leather));
    const yOf = a => H.E.y + 0.012 + 0.05 * (1 - Math.cos(a - aE)) / 2 * (Math.cos(a) < 0 ? 1 : 0.6), st = [], tb = H.covered ? 'R' : 'RH'; for (let k = 0; k < 64; k++) { const a = -Math.PI + 2 * Math.PI * k / 64; st.push(H.at(yOf(a), a, H[tb](yOf(a), a) + 0.006)); }
    out.push(new THREE.Mesh(hgRibbon(H, st, 0.006, true), leather));
    return { objs: out }; } },
  mascara_de_baile: { slot: 'face', build(H) {
    const mat = new THREE.MeshStandardMaterial({ map: maskTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.1 }), rings = [];
    for (let i = 0; i <= 8; i++) { const v = i / 8, y = H.E.y - 0.036 + v * 0.074; rings.push(hgRing(H, y, 0.01 + 0.004 * Math.sin(v * Math.PI), 'R', 28, -1.35, 1.35, false)); }
    const out = [new THREE.Mesh(hgSweep(rings, { closed: false }), mat)]; const g = new THREE.Group(); g.position.copy(H.at(H.E.y + 0.03, 1.2, H.R(H.E.y, 1.2) + 0.012)); const f = hgFeather(0.11, 0.014, '#2a1438', '#d8b25a'); f.rotation.set(-0.3, 1.2, -0.5); g.add(f); out.push(g);
    return { objs: out }; } },
  /* -------- BAIXO (BOCA) -------- */
  folha_hortela: { slot: 'mouth', build(H) {
    const p = new THREE.Vector3(H.cx + 0.018, H.mouthY, H.mouthZ + 0.002), stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p.clone().add(new THREE.Vector3(-0.006, 0, -0.004)), p, p.clone().add(new THREE.Vector3(0.018, -0.006, 0.01))]), 8, 0.0012, 5), std('#5a7a3a'));
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.022), new THREE.MeshStandardMaterial({ map: leafTex('one'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 })); lf.position.copy(p).add(new THREE.Vector3(0.036, -0.012, 0.016)); lf.rotation.set(0.5, 0.6, -0.4);
    return { objs: [stem, lf] }; } },
  bigode_postico: { slot: 'mouth', build(H) {
    const mat = std('#2a1a12', { roughness: 0.9 }), out = [], y = H.N.y - (H.N.y - H.mouthY) * 0.55, z = H.cz + H.R(y, 0) + 0.004;
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, a = s * (0.04 + t * 0.62), rr = H.R(y, a) + 0.006 + Math.sin(t * Math.PI) * 0.004; const p = H.at(y - t * 0.012 + (t > 0.75 ? (t - 0.75) * 0.08 : 0) + (k - 3) * 0.0016, a, rr); pts.push(p); } out.push(new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(pts), 0.0042 - k * 0.0002, 0.0007, 18, 6), mat)); }
    void z; return { objs: out }; } },
  cachimbo: { slot: 'mouth', build(H) {
    const wood = HGM.wood('#4a2a16'), out = [], s = 1, m = new THREE.Vector3(H.cx + s * 0.016, H.mouthY - 0.002, H.mouthZ - 0.002);
    const stemPts = [m, m.clone().add(new THREE.Vector3(s * 0.03, -0.018, 0.04)), m.clone().add(new THREE.Vector3(s * 0.05, -0.05, 0.075))], stem = new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(stemPts), 0.0035, 0.0045, 16, 8), HGM.wood('#1a120c')); out.push(stem);
    const bowlPos = stemPts[2].clone().add(new THREE.Vector3(0, 0.012, 0.004)), prof = [[0.0, -0.02], [0.012, -0.019], [0.016, -0.01], [0.016, 0.012], [0.013, 0.014], [0.011, 0.0]]; const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 20), wood); bowl.position.copy(bowlPos); out.push(bowl);
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 16), glowMat('#ff7a2a', 1.2)); ember.rotation.x = -Math.PI / 2; ember.position.copy(bowlPos).add(new THREE.Vector3(0, 0.011, 0)); out.push(ember);
    const puffs = []; const smat = new THREE.SpriteMaterial({ map: glowSpriteTex(), color: '#cfcac2', transparent: true, opacity: 0, depthWrite: false });
    const sg = new THREE.Group(); sg.position.copy(ember.position); for (let k = 0; k < 4; k++) { const sp = new THREE.Sprite(smat.clone()); sp.scale.setScalar(0.02); sg.add(sp); puffs.push(sp); } out.push(sg);
    return { objs: out, fx: t => { ember.material.emissiveIntensity = 0.9 + Math.sin(t * 3) * 0.35; puffs.forEach((sp, k) => { const ph = (t * 0.35 + k / 4) % 1; sp.position.set(Math.sin(t + k) * 0.01 * ph, ph * 0.14, Math.cos(t * 0.7 + k) * 0.008 * ph); sp.scale.setScalar(0.014 + ph * 0.05); sp.material.opacity = 0.22 * Math.sin(ph * Math.PI); }); } }; } },
  lenco_de_bandoleiro: { slot: 'mouth', build(H) {
    const mat = HGM.cloth('#7a2420'), out = [], yT = H.N.y + 0.016, yB = H.chinY - 0.03, rows = [];
    for (let i = 0; i <= 10; i++) { const v = i / 10, y = yT - v * (yT - yB); rows.push(hgRing(H, a => y - (v > 0.6 ? (v - 0.6) * 0.09 * Math.max(0, Math.cos(a)) ** 2 : 0), (a, yy) => 0.009 + (H.beard ? 0.004 : 0) + v * 0.01 * Math.cos(a) ** 2, 'RB', 32, -1.75, 1.75, false)); }
    out.push(new THREE.Mesh(hgSweep(rows, { closed: false, uRep: 3 }), mat));
    const back = []; for (let k = 0; k <= 20; k++) { const a = 1.75 + (Math.PI * 2 - 3.5) * k / 20; back.push(H.at(yT - 0.006, a, H[H.covered ? 'R' : 'RH'](yT - 0.006, a) + 0.008)); } out.push(new THREE.Mesh(hgRibbon(H, back, 0.014), mat));
    const kn = H.at(yT - 0.006, Math.PI, H[H.covered ? 'R' : 'RH'](yT - 0.006, Math.PI) + 0.016), knot = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.006, 8, 18), mat); knot.position.copy(kn); knot.scale.set(1, 0.7, 0.9); out.push(knot);
    return { objs: out }; } },
  talo_de_trigo: { slot: 'mouth', build(H) {
    const out = [], m = new THREE.Vector3(H.cx - 0.015, H.mouthY, H.mouthZ - 0.001), end = m.clone().add(new THREE.Vector3(-0.05, 0.022, 0.085));
    out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([m, m.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.008, 0)), end]), 16, 0.0021, 6), std('#c8a85a', { roughness: 0.8 })));
    const dir = end.clone().sub(m).normalize(), gm = std('#d8b468', { roughness: 0.75 });
    for (let k = 0; k < 12; k++) { const t = k / 12, p = end.clone().addScaledVector(dir, t * 0.04), g = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), gm); g.scale.set(1, 1.7, 1); g.position.copy(p).add(new THREE.Vector3(0, (k % 2 ? 1 : -1) * 0.003, (k % 2 ? 1 : -1) * 0.002)); g.lookAt(p.clone().add(dir)); g.rotateX(Math.PI / 2 + (k % 2 ? 0.5 : -0.5)); out.push(g); }
    return { objs: out }; } },
};
function flowerMesh(r, col) {
  const g = new THREE.Group(), sh = new THREE.Shape(); for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, rr = r * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5))); i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const geo = new THREE.ShapeGeometry(sh, 6), P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), d = Math.hypot(x, y) / r; P.setZ(i, d * d * r * 0.35); } geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, std(col, { roughness: 0.6, side: THREE.DoubleSide }))); const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 12, 8), std('#e8b830', { roughness: 0.7 })); c.scale.z = 0.5; c.position.z = r * 0.05; g.add(c); return g;
}
// monta as peças de um acessório na cabeça medida e prende ao osso da cabeça
function buildHeadGear(root, id) {
  const D = HEAD_GEAR[id]; if (!D) return null; const H = headInfo(root); if (!H) return null;
  const res = D.build(H) || {}, objs = res.objs || [];
  for (const o of objs) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } }); pinToBone(root, 'head', o); o.userData.headGear = id; }
  return res;
}
/* o chapéu "recolhe" o cabelo: acima da linha cut(a) (no espaço do personagem), cada fio é puxado para dentro da copa
   (raio do crânio + folga, e nunca acima do topo da cabeça); abaixo dela o cabelo fica como está (nuca, franja comprida, rabo) */
function squashHair(root, cut) {
  const H = headInfo(root); if (!H) return; humanIdlePose(root); root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert(), p = new THREE.Vector3(), M = new THREE.Matrix4(), Mi = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isSkinnedMesh || !/^Hair_/.test(o.name) || /Beard/.test(o.name) || !o.visible) return;
    const bi = o.skeleton.bones.findIndex(b => b.name === 'Head'); if (bi < 0) return;
    const dom = domBones(o); o.geometry = o.geometry.clone(); const P = o.geometry.attributes.position;
    // mapa "posição do molde → posição no personagem" para fios presos só à cabeça (e a volta)
    M.copy(invRoot).multiply(o.matrixWorld).multiply(o.bindMatrixInverse).multiply(new THREE.Matrix4().multiplyMatrices(o.skeleton.bones[bi].matrixWorld, o.skeleton.boneInverses[bi])).multiply(o.bindMatrix); Mi.copy(M).invert();
    let moved = 0;
    for (let v = 0; v < P.count; v++) {
      if (dom[v] !== 'Head') continue; p.fromBufferAttribute(P, v).applyMatrix4(M);
      const a = Math.atan2(p.x - H.cx, p.z - H.cz), y0 = cut(a); if (p.y < y0) continue;
      const k = Math.min(1, (p.y - y0) / 0.012), y = Math.min(p.y, H.top - 0.004), rMax = Math.max(0.02, H.R(y, a)) + 0.003, r = Math.hypot(p.x - H.cx, p.z - H.cz);
      const rr = r > rMax ? r + (rMax - r) * k : r, yy = p.y + (y - p.y) * k;
      if (rr === r && yy === p.y) continue;
      p.set(H.cx + (p.x - H.cx) * (rr / (r || 1)), yy, H.cz + (p.z - H.cz) * (rr / (r || 1))).applyMatrix4(Mi); P.setXYZ(v, p.x, p.y, p.z); moved++;
    }
    if (moved) { P.needsUpdate = true; o.geometry.computeVertexNormals(); }
  });
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
    const acc = /Acc_|_Belt|Bracer|_Hood/.test(o.name); // marca pontos de acessórios (cinto/ombreira/braçadeira da roupa base) — quem molda placa pode ignorar
    for (let v = 0; v < n; v += step) if (set.has(db[v])) { o.getVertexPosition(v, p); p.applyMatrix4(o.matrixWorld).applyMatrix4(inv); const q = p.clone(); if (acc) q.acc = true; pts.push(q); }
  });
  return pts;
}
const bonePos = (root, n) => { const b = bone(root, n) || root.getObjectByName(n); return b ? rootPos(root, b) : null; };
/* casca com espessura em volta de um eixo A→B. opts: t0,t1 (fração do eixo), bins, sec (setores), off (folga), th (espessura),
   front (direção de referência), arc [a0,a1] (só parte da volta, em rad; 0 = frente), ridge (quinas/lâminas), flare(t)→extra raio */
// parábola por mínimos quadrados sobre valores igualmente espaçados (x de 0 a 1) — devolve f(x)
function quadFit(Y) {
  const n = Y.length - 1; let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, Y0 = 0, Y1 = 0, Y2 = 0;
  for (let i = 0; i <= n; i++) { const x = n ? i / n : 0, y = Y[i]; S0++; S1 += x; S2 += x * x; S3 += x * x * x; S4 += x ** 4; Y0 += y; Y1 += x * y; Y2 += x * x * y; }
  const D = (a, b, c, d, e, f, g, h, k) => a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g), M = D(S0, S1, S2, S1, S2, S3, S2, S3, S4);
  if (Math.abs(M) < 1e-12) { const m = Y0 / Math.max(1, S0); return () => m; }
  const c0 = D(Y0, S1, S2, Y1, S2, S3, Y2, S3, S4) / M, c1 = D(S0, Y0, S2, S1, Y1, S3, S2, Y2, S4) / M, c2 = D(S0, S1, Y0, S1, S2, Y1, S2, S3, Y2) / M;
  return x => c0 + c1 * x + c2 * x * x;
}
function wrapShell(pts, A, B, o) {
  const L = B.clone().sub(A), len = L.length(), u = L.normalize(), bins = o.bins || 14, sec = o.sec || 28;
  const e1 = (o.front || new THREE.Vector3(0, 0, 1)).clone(); e1.sub(u.clone().multiplyScalar(e1.dot(u))).normalize(); const e2 = new THREE.Vector3().crossVectors(u, e1);
  const R = Array.from({ length: bins + 1 }, () => new Array(sec).fill(0)), C = Array.from({ length: bins + 1 }, () => [0, 0, 0]), lo = Array.from({ length: bins + 1 }, () => [1e9, 1e9, -1e9, -1e9]);
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1, binOf = t => Math.round((t - t0) / (t1 - t0) * bins);
  const proj = []; for (const p of pts) { const d = p.clone().sub(A), t = d.dot(u) / len; const i = binOf(t); if (i < 0 || i > bins) continue; const x = d.dot(e1), y = d.dot(e2); proj.push([i, x, y]); const b = lo[i]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  for (let i = 0; i <= bins; i++) { const b = lo[i]; C[i] = b[0] < 1e8 ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : null; }
  for (let i = 0; i <= bins; i++) if (!C[i]) { let a = i, c = i; while (a >= 0 && !C[a]) a--; while (c <= bins && !C[c]) c++; C[i] = (a >= 0 ? C[a] : null) || (c <= bins ? C[c] : [0, 0]); }
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < bins; i++) C[i] = [(C[i - 1][0] + C[i][0] * 2 + C[i + 1][0]) / 4, (C[i - 1][1] + C[i][1] * 2 + C[i + 1][1]) / 4];
  if (o.vfit) { const fx = quadFit(C.map(c => c[0])), fy = quadFit(C.map(c => c[1])); for (let i = 0; i <= bins; i++) C[i] = [fx(i / bins), fy(i / bins)]; } // S-383: eixo da peça rígida também liso (o centro "dançando" fazia os rolos)
  for (const [i, x, y] of proj) { const dx = x - C[i][0], dy = y - C[i][1], a = Math.atan2(dy, dx), j = ((Math.round(a / (Math.PI * 2) * sec) % sec) + sec) % sec, r = Math.hypot(dx, dy); if (r > R[i][j]) R[i][j] = r; }
  // preenche buracos (circular em j, linear em i) e suaviza
  for (let i = 0; i <= bins; i++) { const row = R[i]; if (row.every(r => !r)) continue; for (let j = 0; j < sec; j++) if (!row[j]) { let a = 1; while (!row[(j - a + sec) % sec] && a < sec) a++; let c = 1; while (!row[(j + c) % sec] && c < sec) c++; row[j] = (row[(j - a + sec) % sec] * c + row[(j + c) % sec] * a) / (a + c); } }
  for (let i = 0; i <= bins; i++) if (R[i].every(r => !r)) { let a = i, c = i; while (a >= 0 && R[a].every(r => !r)) a--; while (c <= bins && R[c].every(r => !r)) c++; R[i] = (a >= 0 ? R[a] : c <= bins ? R[c] : new Array(sec).fill(0.06)).slice(); } // sem ponto nenhum: raio padrão (nunca quebra)
  const R0 = o.tight ? R.map(r => r.slice()) : null; // S-376/S-378: peça JUSTA — a suavização não "infla" a cintura (o piso é a medida crua do corpo, não a passada anterior): sem formato de trapézio
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) { const N = R.map(r => r.slice()); for (let i = 0; i <= bins; i++) for (let j = 0; j < sec; j++) { const n = [R[i][j] * 4, R[i][(j + 1) % sec], R[i][(j - 1 + sec) % sec], R[Math.max(0, i - 1)][j], R[Math.min(bins, i + 1)][j]]; N[i][j] = Math.max(R0 ? R0[i][j] : R[i][j], (n[0] + n[1] + n[2] + n[3] + n[4]) / 8); } for (let i = 0; i <= bins; i++) R[i] = N[i]; }
  if (o.straight) for (let j = 0; j < sec; j++) { // S-374: sem "cinturinha" — preenche o vale da cintura entre o quadril e o peito (peça rígida e reta)
    const up = [], dn = []; let m = 0; for (let i = 0; i <= bins; i++) up[i] = m = Math.max(m, R[i][j]); m = 0; for (let i = bins; i >= 0; i--) dn[i] = m = Math.max(m, R[i][j]);
    for (let i = 0; i <= bins; i++) R[i][j] = Math.max(R[i][j], Math.min(up[i], dn[i])); }
  if (o.vfit) for (let j = 0; j < sec; j++) { // S-383: placa RÍGIDA — o perfil vertical vira uma curva suave (parábola por mínimos quadrados) erguida até não tocar o corpo: some o "gomo" do gibão por baixo, nada de rolos empilhados
    const f = quadFit(R.map(r => r[j])); let up = 0; for (let i = 0; i <= bins; i++) up = Math.max(up, R[i][j] - f(i / bins)); for (let i = 0; i <= bins; i++) R[i][j] = f(i / bins) + up; }
  if (o.prof && o.prof.sec === sec) { // S-326: perfil COMUM (medido uma vez na peça inteira) — lâminas vizinhas coincidem e a sobreposição fica limpa, sem zigue-zague
    const P = o.prof; for (let i = 0; i <= bins; i++) { const t = t0 + (t1 - t0) * i / bins, f = Math.max(0, Math.min(P.bins, (t - P.t0) / (P.t1 - P.t0) * P.bins)), i0 = Math.floor(f), i1 = Math.min(P.bins, i0 + 1), w = f - i0;
      for (let j = 0; j < sec; j++) R[i][j] = P.R[i0][j] * (1 - w) + P.R[i1][j] * w; C[i] = [P.C[i0][0] * (1 - w) + P.C[i1][0] * w, P.C[i0][1] * (1 - w) + P.C[i1][1] * w]; } }
  // geometria: superfície de fora + de dentro + bordas
  const arc = o.arc || [-Math.PI, Math.PI], ns = Math.max(4, Math.round(sec * (arc[1] - arc[0]) / (Math.PI * 2))), closed = !o.arc;
  const off = o.off ?? 0.02, th = o.th ?? 0.012, pos = [], uv = [], idx = [];
  const radAt = (i, a) => { const f = ((a / (Math.PI * 2)) * sec % sec + sec) % sec, j0 = Math.floor(f), j1 = (j0 + 1) % sec, w = f - j0; return R[i][j0] * (1 - w) + R[i][j1] * w; };
  const P = (i, k, extra) => { const t = t0 + (t1 - t0) * i / bins, a = arc[0] + (arc[1] - arc[0]) * k / ns, r = radAt(i, a) + off + extra + (o.flare ? o.flare(i / bins, a) : 0) + (o.ridge ? o.ridge(i / bins, a) : 0);
    const c = C[i], x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; return A.clone().add(u.clone().multiplyScalar(t * len)).add(e1.clone().multiplyScalar(x)).add(e2.clone().multiplyScalar(y)); };
  const cols = closed ? ns : ns + 1, layer = (extra, flip) => { const base = pos.length / 3; for (let i = 0; i <= bins; i++) for (let k = 0; k < cols; k++) { const q = P(i, k, extra); pos.push(q.x, q.y, q.z); uv.push(k / ns * (o.uvRep || 2), i / bins); }
    for (let i = 0; i < bins; i++) for (let k = 0; k < (closed ? ns : ns); k++) { const a = base + i * cols + k, b = base + i * cols + (k + 1) % cols, c = a + cols, d = b + cols; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); } return base; };
  const outer = layer(th, false), inner = layer(0, true);
  // S-326: bordas com vértices PRÓPRIOS (normais da quina não se misturam com as da face) — acabamento limpo, sem "lascas" claras nas beiradas
  const dup = (v) => { pos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); uv.push(uv[v * 2], uv[v * 2 + 1]); return pos.length / 3 - 1; };
  const edge = (i) => { const O = [], I = []; for (let k = 0; k < cols; k++) { O.push(dup(outer + i * cols + k)); I.push(dup(inner + i * cols + k)); }
    for (let k = 0; k < ns; k++) { const k2 = (k + 1) % cols, a = O[k], b = O[k2], c = I[k], d = I[k2]; if (i === 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); } };
  edge(0); edge(bins);
  if (!closed) for (const k of [0, ns]) { const O = [], I = []; for (let i = 0; i <= bins; i++) { O.push(dup(outer + i * cols + k)); I.push(dup(inner + i * cols + k)); }
    for (let i = 0; i < bins; i++) { const a = O[i], b = O[i + 1], c = I[i], d = I[i + 1]; if (k === 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); } }
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
function clothSkirt(root, geo, mat, margin = 0.03, rad = null) { // rad: raios da perna [coxa, joelho, tornozelo, pé] — saia justa usa a medida real da coxa (S-375)
  const mesh = pinToBone(root, 'pelvis', new THREE.Mesh(geo, mat));
  const legs = ['l', 'r'].map(s => ['thigh_' + s, 'calf_' + s, 'foot_' + s, 'ball_' + s].map(n => bone(root, n) || root.getObjectByName(n)).filter(Boolean));
  if (legs.some(l => l.length < 3)) return mesh;
  const RAD = rad || [0.125, 0.075, 0.06, 0.05], K = geo.userData.skirt, P = geo.attributes.position, N = K.rows * K.cols, rr = new Float32Array(N), need = new Float32Array(K.cols);
  const rbuf = RAD.vtent ? { yy: new Float32Array(N), raise: new Float32Array(K.cols), rz: new Float32Array(K.cols) } : null;
  const lp = legs.map(l => l.map(() => new THREE.Vector3()));
  let lastFrame = -1;
  mesh.onBeforeRender = (renderer) => {
    const f = renderer.info.render.frame; if (f === lastFrame) return; lastFrame = f;
    _skInv.copy(mesh.matrixWorld).invert();
    legs.forEach((l, li) => l.forEach((b, k) => lp[li][k].copy(b.getWorldPosition(_skW)).applyMatrix4(_skInv)));
    if (RAD.vtent) { robeSolve(K, P, lp, RAD, margin, rr, need, N, rbuf); P.needsUpdate = true; geo.computeVertexNormals(); return; } // robe longo (magos): solver próprio
    for (let i = 0; i < K.rows; i++) {
      const y = K.yb[i * K.cols];
      need.fill(0);
      for (const L of lp) for (let k = 0; k < L.length - 1; k++) for (let s = 0; s <= (RAD.spheres || 0); s++) {
        const A = L[k], B = L[k + 1]; let u, R;
        if (RAD.spheres) { u = s / RAD.spheres; const R0 = RAD[k] + (RAD[k + 1] - RAD[k]) * u, dy = y - (A.y + (B.y - A.y) * u); if (dy * dy >= R0 * R0) continue; R = Math.sqrt(R0 * R0 - dy * dy); } // S-382 (robe longo): perna como fileira de esferas — a coxa erguida (quase horizontal) também empurra o pano
        else { if ((y - A.y) * (y - B.y) > 0) continue; u = Math.abs(B.y - A.y) < 1e-4 ? 0.5 : (y - A.y) / (B.y - A.y); R = RAD[k] + (RAD[k + 1] - RAD[k]) * u; }
        const ox = A.x + (B.x - A.x) * u - K.cx, oz = (A.z + (B.z - A.z) * u - K.cz) / K.sz, c2 = ox * ox + oz * oz;
        for (let j = 0; j < K.cols; j++) { const a = K.ang[i * K.cols + j], dc = Math.sin(a) * ox + Math.cos(a) * oz, disc = R * R - c2 + dc * dc; if (disc > 0) { const t = dc + Math.sqrt(disc) + margin; if (t > need[j]) need[j] = t; } }
      }
      for (let j = 0; j < K.cols; j++) { // o pano estica em volta da perna (tenda) em vez de fazer um bico
        const v = i * K.cols + j; let r = K.rb[v];
        for (let d = -10; d <= 10; d++) { let jj = j + d; if (K.closed) jj = (jj + K.cols) % K.cols; else if (jj < 0 || jj >= K.cols) continue; const nd = need[jj]; if (nd > 0) { const e = nd - Math.abs(d) * K.dA * nd * (RAD.tent || 0.55); if (e > r) r = e; } }
        if (i > 0) { const up = (i - 1) * K.cols + j, ex = rr[up] - K.rb[up], dk = RAD.drop || 0.985; if (K.rb[v] + ex * dk > r) r = K.rb[v] + ex * dk; } // do joelho para baixo o pano cai reto (robe longo: volta aos poucos e acompanha a canela — S-382)
        rr[v] = r;
        const ex = r - K.rb[v], a = K.ang[v];
        P.setXYZ(v, K.cx + Math.sin(a) * r, K.yb[v] + ex * 0.22 * (i / (K.rows - 1)), K.cz + Math.cos(a) * r * K.sz); // a barra sobe um pouco quando o pano abre
      }
    }
    P.needsUpdate = true; geo.computeVertexNormals();
  };
  return mesh;
}
/* S-383: robe longo dos magos ao correr/andar. O pano NÃO estica: (1) onde a perna passaria da folga do tecido (cap × raio de repouso),
   ela sai por baixo — a barra sobe só ali, pouco (raiseF do comprimento) e em arco suave; (2) o resto contorna a perna numa tenda estreita,
   cai do joelho para baixo e sobe em rampa acima do calcanhar. Nada de sino nem de perna atravessando o pano. */
function robeSolve(K, P, lp, RAD, margin, rr, need, N, B) {
  const rows = K.rows, cols = K.cols, S = RAD.spheres || 6, sp = [];
  for (const L of lp) for (let k = 0; k < L.length - 1; k++) for (let s = (k ? 1 : 0); s <= S; s++) { const A = L[k], C = L[k + 1], u = s / S; sp.push(A.x + (C.x - A.x) * u - K.cx, (A.z + (C.z - A.z) * u - K.cz) / K.sz, A.y + (C.y - A.y) * u, RAD[k] + (RAD[k + 1] - RAD[k]) * u); } // perna = fileira de esferas [x, z, y, raio]
  const needAt = (y, a) => { let n = 0; const sa = Math.sin(a), ca = Math.cos(a); for (let q = 0; q < sp.length; q += 4) { const dy = y - sp[q + 2], R0 = sp[q + 3]; if (dy * dy >= R0 * R0) continue; const ox = sp[q], oz = sp[q + 1], dc = sa * ox + ca * oz, disc = R0 * R0 - dy * dy - ox * ox - oz * oz + dc * dc; if (disc > 0) { const t = dc + Math.sqrt(disc) + margin; if (t > n) n = t; } } return n; };
  const wrap = j => K.closed ? (j + cols) % cols : j, top = K.yb[0], bot = K.yb[(rows - 1) * cols], H = top - bot, { yy, raise, rz } = B;
  for (let j = 0; j < cols; j++) { // 1) altura (contínua) em que a perna passaria da folga do pano → a barra sobe até logo acima dela
    raise[j] = 0; let pe = -1; const bk = RAD.capB == null ? 0 : Math.min(1, Math.max(0, -Math.cos(K.ang[j]) * 1.6 - 0.1)), cap = RAD.cap + ((RAD.capB ?? RAD.cap) - RAD.cap) * bk, rf = RAD.raiseF + ((RAD.raiseB ?? RAD.raiseF) - RAD.raiseF) * bk; // S-384 (anão): ATRÁS a folga é menor e a barra sobe mais — o calcanhar chutado para trás sai por baixo do robe em vez de abrir uma "tenda" de pano
    for (let i = 1; i < rows; i++) { const v = i * cols + j, e = needAt(K.yb[v], K.ang[v]) - K.rb[v] * (1 + cap);
      if (e > 0) { const t = pe < 0 ? -pe / (e - pe) : 0, y = K.yb[v - cols] + (K.yb[v] - K.yb[v - cols]) * t; raise[j] = Math.min(rf * H, Math.max(0, y - K.yb[(rows - 1) * cols + j] + 0.02)); break; }
      pe = e; } }
  for (let j = 0; j < cols; j++) { let m = 0; for (let d = -14; d <= 14; d++) { const jj = wrap(j + d); if (jj < 0 || jj >= cols) continue; const e = raise[jj] * (1 - Math.abs(d) * K.dA * RAD.hk); if (e > m) m = e; } rz[j] = m; } // arco: sobe no meio e desce dos lados
  for (let pass = 0; pass < 3; pass++) { raise.set(rz); for (let j = 0; j < cols; j++) { const l = K.closed ? wrap(j - 1) : Math.max(0, j - 1), r = K.closed ? wrap(j + 1) : Math.min(cols - 1, j + 1); rz[j] = (raise[l] + raise[j] * 2 + raise[r]) / 4; } } // sem dentes na barra
  for (let v = 0; v < N; v++) { const s = (H - rz[v % cols]) / H; yy[v] = top - (top - K.yb[v]) * s; } // o pano da coluna encurta por igual (não dobra nem faz degrau)
  for (let i = 0; i < rows; i++) { // 2) contorna a perna (tenda estreita) e cai do joelho para baixo
    for (let j = 0; j < cols; j++) need[j] = needAt(yy[i * cols + j], K.ang[i * cols + j]);
    for (let j = 0; j < cols; j++) {
      const v = i * cols + j; let r = K.rb[v];
      for (let d = -12; d <= 12; d++) { const jj = wrap(j + d); if (jj < 0 || jj >= cols) continue; const nd = need[jj]; if (nd > 0) { const e = nd - Math.abs(d) * K.dA * nd * RAD.tent; if (e > r) r = e; } }
      if (i > 0) { const up = v - cols, ex = rr[up] - K.rb[up]; if (K.rb[v] + ex * RAD.drop > r) r = K.rb[v] + ex * RAD.drop; }
      rr[v] = r; } }
  const s = RAD.vtent * Math.abs(K.yb[0] - K.yb[cols]); // 3) acima do calcanhar o pano sobe em rampa até o quadril (nada de "caixa")
  for (let i = rows - 2; i >= 1; i--) for (let j = 0; j < cols; j++) { const v = i * cols + j, dn = rr[v + cols] - K.rb[v + cols] - s; if (K.rb[v] + dn > rr[v]) rr[v] = K.rb[v] + dn; }
  for (let v = 0; v < N; v++) { const a = K.ang[v]; P.setXYZ(v, K.cx + Math.sin(a) * rr[v], yy[v], K.cz + Math.cos(a) * rr[v] * K.sz); }
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
const _capeTex = {};
function capeClothTex(color, trim, emblem) {
  const key = color + (trim || '') + (emblem || ''); if (_capeTex[key]) return _capeTex[key];
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'); let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = color; x.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 2) { x.fillStyle = `rgba(0,0,0,${0.025 + r() * 0.03})`; x.fillRect(0, y, 256, 1); } // trama horizontal
  for (let xx = 0; xx < 256; xx += 2) { x.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.025})`; x.fillRect(xx, 0, 1, 512); } // trama vertical
  for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`; x.fillRect(r() * 256, r() * 512, 1 + r() * 2, 1 + r() * 3); } // fios e nós da lã
  const gr = x.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 512);
  if (trim) { // S-383: BARRA limpa — debrum dourado até a beira do pano (antes sobrava uma tira de lã escurecida abaixo dele, que lia como "dobra suja"), pesponto no meio e um filete fino acima
    x.fillStyle = color; x.fillRect(0, 470, 256, 42); for (let y = 470; y < 512; y += 2) { x.fillStyle = `rgba(0,0,0,${0.025 + r() * 0.02})`; x.fillRect(0, y, 256, 1); } // sem o escurecido do degradê no fim
    x.fillStyle = trim; x.fillRect(0, 490, 256, 22); x.fillRect(0, 476, 256, 3); x.fillRect(0, 0, 9, 490); x.fillRect(247, 0, 9, 490);
    x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, 488, 256, 2); x.fillRect(0, 479, 256, 1); x.fillRect(9, 0, 2, 476); x.fillRect(245, 0, 2, 476);
    x.fillStyle = 'rgba(255,240,200,0.35)'; x.fillRect(0, 490, 256, 1); x.fillStyle = 'rgba(70,45,10,0.45)'; for (let k = 2; k < 256; k += 6) x.fillRect(k, 500, 3, 1); } // brilho do fio na dobra e pesponto
  if (emblem === 'sol') { // S-371: sol BORDADO tom sobre tom (fio creme-dourado, meio translúcido) no meio das costas — sutil, bem menos evidente que o do escudo
    const cx = 128, cy = 178; x.save(); x.translate(cx, cy); x.lineJoin = 'round';
    const ray = (k, R0, R1, w) => { const a = k / 24 * Math.PI * 2, s = Math.sin(a), c0 = Math.cos(a), px = c0, py = s; return [[s * R0 + px * w, -c0 * R0 + py * w], [s * R1, -c0 * R1], [s * R0 - px * w, -c0 * R0 - py * w]]; };
    const sun = () => { x.beginPath(); for (let k = 0; k < 24; k++) { const p = ray(k, 34, k % 2 ? 58 : 76, k % 2 ? 5 : 7); x.moveTo(p[0][0], p[0][1]); x.lineTo(p[1][0], p[1][1]); x.lineTo(p[2][0], p[2][1]); } };
    x.globalAlpha = 0.24; x.fillStyle = '#c9a85e'; sun(); x.fill(); x.beginPath(); x.arc(0, 0, 27, 0, 7); x.fill(); // corpo do bordado (tom sobre tom)
    x.globalAlpha = 0.4; x.strokeStyle = '#d9bf7c'; x.lineWidth = 1.6; x.setLineDash([3, 2]); sun(); x.stroke(); x.beginPath(); x.arc(0, 0, 27, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, 33, 0, 7); x.stroke(); // ponto atrás (pesponto) contornando
    x.setLineDash([]); x.globalAlpha = 0.18; x.strokeStyle = '#fff6dc'; x.lineWidth = 1; x.beginPath(); x.arc(-2, -2, 18, 3.4, 5.4); x.stroke(); // brilho do fio
    x.restore(); x.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_capeTex[key] = t);
}
// S-383: empurra um ponto (mundo) para fora da saia de pano (clothSkirt/gownGeo) na forma ATUAL dela — usado pela capa,
// que antes só via cápsulas e deixava a barra irregular da fralda de malha atravessar o pano (a "faixa escura" embaixo da capa)
const _poV = new THREE.Vector3();
function pushOutSkirt(sk, v, pad) {
  const K = sk.m.geometry.userData.skirt, P = sk.m.geometry.attributes.position, l = _poV.copy(v).applyMatrix4(sk.inv), top = K.yb[0], bot = K.yb[(K.rows - 1) * K.cols];
  if (l.y > top || l.y < bot - 0.04) return;
  const dx = l.x - K.cx, dz = (l.z - K.cz) / K.sz, rp = Math.hypot(dx, dz); if (rp < 1e-4) return;
  const a = Math.atan2(dx, dz), a0 = K.ang[0], span = K.dA * (K.closed ? K.cols : K.cols - 1);
  let u = (a - a0) % (Math.PI * 2); if (u < 0) u += Math.PI * 2; if (u > span) return; // fora do arco (saia aberta)
  const j = Math.min(K.cols - 1, Math.round(u / K.dA)) % K.cols, i = Math.max(0, Math.min(K.rows - 1, Math.round((top - l.y) / (top - bot) * (K.rows - 1))));
  let r = 0; for (let ii = Math.max(0, i - 1); ii <= Math.min(K.rows - 1, i + 1); ii++) { const q = ii * K.cols + j; r = Math.max(r, Math.hypot(P.getX(q) - K.cx, (P.getZ(q) - K.cz) / K.sz)); }
  if (rp >= r + pad) return;
  const f = (r + pad) / rp; l.x = K.cx + dx * f; l.z = K.cz + dz * f * K.sz; v.copy(l.applyMatrix4(sk.m.matrixWorld));
}
// S-402: a borda de cima da capa acompanha os ombros: o meio sobe junto da gola e as pontas avançam por cima das ombreiras
const CAPE_HALF = 0.62, CAPE_FLARE = 0.13; // S-402: a capa cobre os ombros (antes ia só de omoplata a omoplata: 30 cm, uma faixa) e abre em "A" até a barra
const CAPE_ARCH = t => 0.045 * (1 - Math.pow(2 * t - 1, 2)) + 0.03 * Math.pow(Math.abs(2 * t - 1), 3), CAPE_WRAP = t => 0.075 * Math.pow(Math.abs(2 * t - 1), 2.2);
// faixa de pano chata ao longo de uma curva (largura w), deitada sobre o que está embaixo (normal para cima/fora) — S-402
function clothRibbon(curve, w, n = 20) {
  const pos = [], uv = [], idx = [], up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) { const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t), side = new THREE.Vector3().crossVectors(tg, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize().multiplyScalar(w / 2);
    const bulge = Math.sin(Math.PI * t) * 0.006; pos.push(p.x - side.x, p.y - side.y + bulge, p.z - side.z, p.x + side.x, p.y + side.y + bulge, p.z + side.z); uv.push(0, t, 1, t); if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function clothCape(root, fx, color, opt = {}) {
  const W = opt.w || 0.5, H = opt.h || 1.05, NX = 11, NY = 15, mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: capeClothTex(color, opt.trim || (root.userData.armorSet === 'paladino' ? '#c9a24a' : null), opt.emblem), roughness: 0.93, side: THREE.DoubleSide }); // S-337: lã de verdade (trama, dobras de sombra e barra) — não mais o couro com cara de papelão
  const geo = new THREE.PlaneGeometry(1, 1, NX - 1, NY - 1), mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  root.add(mesh);
  const sp3 = bone(root, 'spine_03'), pelv = bone(root, 'pelvis'), clL = bone(root, 'upperarm_l'), clR = bone(root, 'upperarm_r'), thL = bone(root, 'thigh_l'), thR = bone(root, 'thigh_r'), caL = bone(root, 'calf_l'), caR = bone(root, 'calf_r');
  // S-337: o corpo de verdade (com a armadura por cima) empurra o pano — mede a profundidade das costas e a largura do tronco na pose parada (anão incluso)
  const armorPad = root.userData.armorSet ? 0.06 : 0.025, sp2b = bone(root, 'spine_02'), uaLb = bone(root, 'upperarm_l'), uaRb = bone(root, 'upperarm_r'), laLb = bone(root, 'lowerarm_l'), laRb = bone(root, 'lowerarm_r'), s1b = bone(root, 'spine_01');
  let backD = 0.16, sideR = 0.2; { const ax = bonePos(root, 'spine_02'), pv0 = bonePos(root, 'pelvis'), nk0 = bonePos(root, 'neck_01'); if (ax && pv0 && nk0) { for (const p0 of sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'], /_Body/)) { if (p0.acc || p0.y < pv0.y || p0.y > nk0.y) continue; if (Math.abs(p0.x - ax.x) < 0.12) backD = Math.max(backD, ax.z - p0.z); sideR = Math.max(sideR, Math.hypot(p0.x - ax.x, (p0.z - ax.z) * 0.6)); } } }
  let bodyR = backD + armorPad, pelvisR = bodyR; const pinOff = new Array(NX).fill(bodyR + 0.012);
  { // S-337: mede a SUPERFÍCIE DE TRÁS da armadura de verdade (raios contra as placas do tronco/quadril, na pose parada): a capa é presa logo atrás do aço e as cápsulas têm o tamanho real (abas do tabardo inclusas)
    const wp0 = b => b.getWorldPosition(new THREE.Vector3()), plates = []; root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o !== mesh && o.parent && o.parent.parent && /^(spine_0[123]|pelvis)$/.test(o.parent.parent.name)) plates.push(o); });
    if (plates.length) {
      root.updateMatrixWorld(true); const a = wp0(clL), b = wp0(clR), s = wp0(sp3), pv = wp0(pelv), upv = s.clone().sub(pv).normalize(), rv = a.clone().sub(b).normalize(), bk = new THREE.Vector3().crossVectors(rv, upv).normalize().multiplyScalar(-1), rc = new THREE.Raycaster();
      const backAt = (pt) => { rc.set(pt.clone().add(bk.clone().multiplyScalar(0.8)), bk.clone().negate()); rc.far = 0.8; const h = rc.intersectObjects(plates, false); return h.length ? 0.8 - h[0].distance : 0; };
      const r3 = backAt(s), r2 = backAt(wp0(sp2b || sp3)), r1 = backAt(wp0(s1b || pelv)), rp = Math.max(backAt(pv), backAt(pv.clone().sub(upv.clone().multiplyScalar(0.18))));
      bodyR = Math.max(bodyR, Math.max(r3, r2, r1) + 0.018); pelvisR = Math.max(bodyR, rp + 0.022);
      const mid = s.clone(); mid.y = (a.y + b.y) / 2 + 0.02; const half = a.distanceTo(b) * CAPE_HALF;
      for (let i = 0; i < NX; i++) { const t = i / (NX - 1), lat = rv.clone().multiplyScalar((t - 0.5) * 2 * half), base = mid.clone().add(lat); pinOff[i] = Math.max(bodyR + 0.012 - Math.abs(t - 0.5) * 0.05, backAt(base) + 0.014, backAt(base.clone().sub(upv.clone().multiplyScalar(0.05))) + 0.014); }
    }
  }
  if (opt.clasp) { // S-360: a capa fica PRESA de forma visível — rolo de pano franzido ao longo da borda de cima, assentado nas costas, e dois broches dourados nas pontas, sobre as ombreiras
    humanIdlePose(root); root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert(), W2 = v => v.applyMatrix4(inv);
    const a = clL.getWorldPosition(new THREE.Vector3()), b = clR.getWorldPosition(new THREE.Vector3()), s = sp3.getWorldPosition(new THREE.Vector3()), pv = pelv.getWorldPosition(new THREE.Vector3());
    const upv = s.clone().sub(pv).normalize(), rv = a.clone().sub(b).normalize(), bk = new THREE.Vector3().crossVectors(rv, upv).normalize().multiplyScalar(-1), mid = s.clone(); mid.y = (a.y + b.y) / 2 + 0.02; const half = a.distanceTo(b) * CAPE_HALF;
    const pts = []; for (let i = 0; i < NX; i++) { const t = i / (NX - 1); pts.push(W2(mid.clone().add(rv.clone().multiplyScalar((t - 0.5) * 2 * half)).add(bk.clone().multiplyScalar(pinOff[i] - CAPE_WRAP(t) - 0.004)).add(upv.clone().multiplyScalar(CAPE_ARCH(t))))); }
    const fr = W2(mid.clone().add(bk.clone().multiplyScalar(-1))).sub(W2(mid.clone())).normalize(); // "para a frente" no espaço do personagem
    const nkW = W2(bone(root, 'neck_01').getWorldPosition(new THREE.Vector3())), brooch = [a, b].map(sh => { const q = W2(sh.clone()).lerp(nkW, 0.42); q.y = nkW.y - 0.075; return q.addScaledVector(fr, 0.18); }); // na FRENTE, entre o pescoço e o ombro (por cima da couraça)
    const gold = AM.gold('#d4ac52'); // S-402: nada de "varão de cortina": a capa sai da curva dos ombros e é presa por dois broches na FRENTE dos ombros, ligados por uma corrente
    { const sm = new THREE.MeshStandardMaterial({ color: '#e8e2d4', map: capeClothTex(color, null), roughness: 0.95, side: THREE.DoubleSide }); // a capa passa POR CIMA do ombro e vem até o broche: alça de pano dobrado, larga e achatada
      [[pts[0], brooch[0]], [pts[NX - 1], brooch[1]]].forEach(([p0, p1]) => { const top = p0.clone().lerp(p1, 0.5); top.y = Math.max(p0.y, p1.y) + 0.06; const cv = new THREE.CatmullRomCurve3([p0.clone().addScaledVector(fr, -0.02), top, p1]);
        pinToBone(root, 'spine_03', new THREE.Mesh(clothRibbon(cv, 0.075, 20), sm)); }); }
    { const ch = new THREE.CatmullRomCurve3([brooch[0], brooch[0].clone().lerp(brooch[1], 0.5).addScaledVector(fr, 0.05).add(new THREE.Vector3(0, -0.07, 0)), brooch[1]]); pinToBone(root, 'spine_03', new THREE.Mesh(new THREE.TubeGeometry(ch, 32, 0.006, 8, false), gold)); } // corrente no peito ligando os broches
    for (const pt of brooch) { const g = new THREE.Group(), d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.012, 32), gold); d.rotation.x = Math.PI / 2; g.add(d);
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.014, 20, 12), gold); st.position.z = 0.008; st.scale.z = 0.6; g.add(st); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.004, 8, 32), gold); rg.position.z = 0.005; g.add(rg);
      g.position.copy(pt); g.lookAt(pt.clone().addScaledVector(fr, 1)); pinToBone(root, 'spine_03', g); } // o broche olha para a frente
  }
  const N = NX * NY, p = new Float32Array(N * 3), q = new Float32Array(N * 3); let rest = (W / (NX - 1)); const restY = H / (NY - 1);
  let inited = false, last = performance.now();
  let skirts = null; // S-383: saias de pano/malha que se mexem com as pernas (fralda do Paladino) — a capa passa POR FORA delas, não atravessa
  const wp = (b, v = new THREE.Vector3()) => b.getWorldPosition(v), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), fwd = new THREE.Vector3(), rightV = new THREE.Vector3();
  const pins = () => { // pontos de fixação: linha atrás dos ombros (no espaço do mundo)
    root.updateMatrixWorld(true); const a = wp(clL), b = wp(clR), s = wp(sp3), pv = wp(pelv); fwd.copy(s).sub(pv); const upv = fwd.clone().normalize(); rightV.copy(a).sub(b).normalize(); const back = new THREE.Vector3().crossVectors(rightV, upv).normalize().multiplyScalar(-1);
    // centrado na coluna (não nos braços, que se mexem na pose parada), na altura dos ombros
    const mid = s.clone(); mid.y = (a.y + b.y) / 2 + 0.02; const half = a.distanceTo(b) * CAPE_HALF;
    const out = []; for (let i = 0; i < NX; i++) { const t = i / (NX - 1); out.push(mid.clone().add(rightV.clone().multiplyScalar((t - 0.5) * 2 * half)).add(back.clone().multiplyScalar(pinOff[i] - CAPE_WRAP(t))).add(upv.clone().multiplyScalar(CAPE_ARCH(t)))); } // S-402: borda de cima em curva sobre os ombros (sobe junto da gola, as pontas passam por cima das ombreiras) // S-337: presa logo atrás do AÇO das costas (medido), não dentro da armadura
    return { out, back, upv };
  };
  let lastT = null;
  const step = (tt) => {
    const now = performance.now(); let dt = (now - last) / 1000; last = now;
    if (typeof tt === 'number' && isFinite(tt)) { if (lastT != null && tt > lastT) dt = tt - lastT; lastT = tt; } // S-384: passo pelo RELÓGIO DO JOGO (quadros simulados em sequência davam dt ≈ 0 → sem gravidade, a capa ficava dobrada)
    dt = Math.min(0.033, dt); if (dt <= 0) dt = 0.016;
    const { out, back, upv } = pins();
    // S-297: teleporte, montaria, renascer ou quadro perdido → o pano não fica para trás esticado (recomeça pendurado nos ombros)
    if (inited) { const mid = out[NX >> 1], k0 = (NX >> 1) * 3, kb = ((NY - 1) * NX + (NX >> 1)) * 3; if (Math.hypot(mid.x - p[k0], mid.y - p[k0 + 1], mid.z - p[k0 + 2]) > 0.6 || Math.hypot(mid.x - p[kb], mid.y - p[kb + 1], mid.z - p[kb + 2]) > H * 1.6) inited = false; }
    if (!inited) { rest = out[0].distanceTo(out[NX - 1]) / (NX - 1) * 1.08; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = (j * NX + i) * 3, b0 = out[i]; p[k] = b0.x + back.x * 0.02 * j; p[k + 1] = b0.y - j * restY; p[k + 2] = b0.z + back.z * 0.02 * j; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; } inited = true; }
    const g = -9.8 * dt * dt, wind = Math.sin(now / 900) * 0.0004;
    for (let n = 0; n < N; n++) { const k = n * 3; if (n < NX) continue; const vx = (p[k] - q[k]) * 0.985, vy = (p[k + 1] - q[k + 1]) * 0.985, vz = (p[k + 2] - q[k + 2]) * 0.985; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; p[k] += vx + back.x * wind; p[k + 1] += vy + g; p[k + 2] += vz + back.z * wind; }
    for (let i = 0; i < NX; i++) { const k = i * 3; p[k] = out[i].x; p[k + 1] = out[i].y; p[k + 2] = out[i].z; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; }
    // corpo: cápsulas (tronco e coxas) que empurram o pano para fora
    const knees = wp(caL).add(wp(caR)).multiplyScalar(0.5);
    if (!skirts) { skirts = []; root.traverse(o => { if (o.isMesh && o !== mesh && o.geometry && o.geometry.userData.skirt) skirts.push({ m: o, inv: new THREE.Matrix4() }); }); }
    for (const sk of skirts) sk.inv.copy(sk.m.matrixWorld).invert();
    const caps = [[wp(sp3), wp(pelv, tmp2.clone()), bodyR], [wp(sp3), wp(s1b || pelv), bodyR + 0.005], [wp(pelv), knees, pelvisR], [wp(thL), wp(caL), 0.11 + armorPad * 0.5], [wp(thR), wp(caR), 0.11 + armorPad * 0.5], // S-337: tronco e quadril medidos (com placas e abas do tabardo)
      [wp(sp2b || sp3), wp(uaLb), 0.07 + armorPad], [wp(sp2b || sp3), wp(uaRb), 0.07 + armorPad], [wp(uaLb), wp(laLb), 0.055 + armorPad], [wp(uaRb), wp(laRb), 0.055 + armorPad]]; // ombros e braços com as ombreiras
    const link = (a, b, rl) => { const ka = a * 3, kb = b * 3, dx = p[kb] - p[ka], dy = p[kb + 1] - p[ka + 1], dz = p[kb + 2] - p[ka + 2], d = Math.hypot(dx, dy, dz) || 1e-6, df = (d - rl) / d * 0.5, pa = a < NX ? 0 : 1, pb = b < NX ? 0 : 1, s = pa + pb; if (!s) return; p[ka] += dx * df * (pa / s) * 2; p[ka + 1] += dy * df * (pa / s) * 2; p[ka + 2] += dz * df * (pa / s) * 2; p[kb] -= dx * df * (pb / s) * 2; p[kb + 1] -= dy * df * (pb / s) * 2; p[kb + 2] -= dz * df * (pb / s) * 2; };
    for (let it = 0; it < 5; it++) {
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const n = j * NX + i, rj = rest * (1 + CAPE_FLARE * 2 / (rest * (NX - 1)) * j / (NY - 1)); if (i < NX - 1) link(n, n + 1, rj); if (j < NY - 1) link(n, n + NX, restY); if (i < NX - 1 && j < NY - 1) link(n, n + NX + 1, Math.hypot(rj, restY)); }
      for (let j = 1; j < NY; j++) for (let i = 0; i + 2 < NX; i += 1) { const n = j * NX + i, ka = n * 3, kb = (n + 2) * 3; if (Math.hypot(p[kb] - p[ka], p[kb + 1] - p[ka + 1], p[kb + 2] - p[ka + 2]) < rest * 1.7) link(n, n + 2, rest * 1.7); } // S-384: o pano resiste a DOBRAR na largura (só empurra quando fecha demais) — correndo, a capa não vira mais uma tira dobrada; ainda se curva nas costas
      for (let n = NX; n < N; n++) { const k = n * 3; tmp.set(p[k], p[k + 1], p[k + 2]);
        for (const [a, b, r] of caps) { const ab = tmp2.copy(b).sub(a), t = Math.max(0, Math.min(1, tmp.clone().sub(a).dot(ab) / ab.lengthSq())), c = a.clone().add(ab.multiplyScalar(t)), d = tmp.clone().sub(c), dl = d.length(); if (dl < r) { d.multiplyScalar((r - dl) / (dl || 1)); tmp.add(d); } }
        for (const sk of skirts) pushOutSkirt(sk, tmp, 0.022);
        { const i = n % NX, j = (n / NX) | 0, o = out[i], lat = (tmp.x - o.x) * rightV.x + (tmp.y - o.y) * rightV.y + (tmp.z - o.z) * rightV.z, lim = 0.035 + 0.009 * j, want = (i / (NX - 1) - 0.5) * 2 * CAPE_FLARE * j / (NY - 1), dl = lat - want; // S-384: a capa fica ATRÁS do corpo — não escorrega para o lado da perna nem gira de perfil ao correr · S-402: em volta da abertura em "A"
          if (Math.abs(dl) > lim) tmp.addScaledVector(rightV, (Math.sign(dl) * lim - dl)); }
        p[k] = tmp.x; p[k + 1] = tmp.y; p[k + 2] = tmp.z; }
    }
    // escreve na malha (vértices no espaço do mundo; a malha anula a transformação do pai)
    const P = geo.attributes.position; for (let n = 0; n < N; n++) P.setXYZ(n, p[n * 3], p[n * 3 + 1], p[n * 3 + 2]);
    P.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    mesh.matrix.copy(root.matrixWorld).invert(); mesh.matrixWorldNeedsUpdate = true;
  };
  // a PlaneGeometry vem com a linha de cima primeiro (y = +0.5): a ordem casa com j = 0 em cima
  fx.push(tt => step(tt));
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
  if (kind === 'paladino') { // S-326: escudo do Paladino — mesmo tamanho, muito mais detalhe: aço polido, borda forjada dourada com rebites, sol em camadas, umbo, forro de couro e alças atrás
    const heater = (s = 1) => { const sh = new THREE.Shape(); sh.moveTo(-0.25 * s, 0.3 * s); sh.quadraticCurveTo(0, 0.335 * s, 0.25 * s, 0.3 * s); sh.bezierCurveTo(0.26 * s, 0.0, 0.18 * s, -0.24 * s, 0, -0.38 * s); sh.bezierCurveTo(-0.18 * s, -0.24 * s, -0.26 * s, 0.0, -0.25 * s, 0.3 * s); return sh; };
    const bend = (geo, z0 = 0) => { const P = geo.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, P.getZ(k) + z0 - P.getX(k) ** 2 * 0.5 - P.getY(k) ** 2 * 0.12); geo.computeVertexNormals(); return geo; };
    const steel = AM.steel('#d9dde2', { metal: 0.93, rough: 0.24, env: 1.2 }), gold = AM.gold('#d4ac52'), lea = AM.leather('#4a2e1a');
    g.add(new THREE.Mesh(bend(new THREE.ExtrudeGeometry(heater(1), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 32 }), -0.02), steel)); // corpo
    const rim = heater(1.03); rim.holes.push(heater(0.9)); g.add(new THREE.Mesh(bend(new THREE.ExtrudeGeometry(rim, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3, curveSegments: 32 }), 0.008), gold)); // borda forjada
    { // S-357: acabamento da borda — um friso dourado arredondado que dá a volta na LATERAL do escudo (antes a beira do aço ficava crua, cortada) e cobre a junta com o forro
      const ep = heater(1.035).getSpacedPoints(96).slice(0, -1).map(p => new THREE.Vector3(p.x, p.y, -0.012 - p.x ** 2 * 0.5 - p.y ** 2 * 0.12));
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ep, true, 'centripetal'), 192, 0.016, 12, true); g.add(new THREE.Mesh(tg, gold)); }
    const inner = heater(0.86); inner.holes.push(heater(0.83)); g.add(new THREE.Mesh(bend(new THREE.ExtrudeGeometry(inner, { depth: 0.004, bevelEnabled: false, curveSegments: 32 }), 0.012), gold)); // filete interno
    const pts = heater(0.965).getSpacedPoints(30); for (let k = 0; k < pts.length - 1; k++) { const p = pts[k], rv = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 12, 8), steel); rv.scale.z = 0.6; rv.position.set(p.x, p.y, 0.022 - p.x ** 2 * 0.5 - p.y ** 2 * 0.12); g.add(rv); } // rebites
    const star = (R, r, n, d, z, mat) => { const s = new THREE.Shape(); for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? r : R; k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + 0.03) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr + 0.03); } s.closePath();
      g.add(new THREE.Mesh(bend(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }), z), mat)); };
    star(0.15, 0.07, 16, 0.004, 0.014, gold); star(0.1, 0.055, 8, 0.004, 0.02, steel); // sol em camadas: raios longos dourados, raios curtos de aço
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.064, 0.01, 40), gold); disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.03, 0.03); g.add(disc);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), steel); boss.rotation.x = Math.PI / 2; boss.scale.y = 0.55; boss.position.set(0, 0.03, 0.034); g.add(boss); // umbo
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.006, 10, 40), gold); ring.position.set(0, 0.03, 0.035); g.add(ring);
    const back = new THREE.Mesh(bend(new THREE.ExtrudeGeometry(heater(0.93), { depth: 0.004, bevelEnabled: false, curveSegments: 32 }), -0.0375), lea); g.add(back); // forro de couro (S-338: 4 mm atrás do aço — antes encostava e piscava)
    const lining = heater(0.93); for (const p of lining.getSpacedPoints(48).slice(0, -1)) { const st = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), gold); st.scale.z = 0.5; st.position.set(p.x, p.y, -0.0415 - p.x ** 2 * 0.5 - p.y ** 2 * 0.12); g.add(st); } // tachas que prendem o forro
    g.userData.r = 0.3; g.userData.back = 0.075; g.userData.straps = { mat: lea, metal: gold, plane: -0.042 }; return g; // S-338: as alças (enarmes) são feitas no strapShield, em volta do antebraço medido
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
  // S-326: a folga mede o braço DE VERDADE (anão é bem mais grosso, e a armadura soma por cima): nada do braço atravessa o escudo
  const mid = el.clone().lerp(wr, 0.5); let reach = 0.035;
  for (const p of sampleBody(root, ['lowerarm_l', 'hand_l'], /_(Body|Arms)|SuperHero/)) { const d = p.clone().sub(mid); if (Math.abs(d.dot(up)) < 0.2) reach = Math.max(reach, d.dot(n)); }
  const extra = root.userData.armorSet ? 0.03 : 0.012, gap = reach + extra + (shield.userData.back ?? 0.03) - 0.02;
  const G = Math.max(0.045, gap), holder = new THREE.Group(); fore.add(holder); fitToBone(root, fore, holder, q, mid.clone().add(n.clone().multiplyScalar(G)));
  holder.add(shield); shield.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  // S-338: ALÇAS de couro (enarmes) que dão a volta no antebraço DE VERDADE (medido, com a armadura), presas no forro por fivelas — nada de caixinhas soltas
  const ST = shield.userData.straps;
  if (ST) {
    let ra = 0.035; for (const p of sampleBody(root, ['lowerarm_l'], /_(Body|Arms)/)) { const d = p.clone().sub(el.clone().lerp(wr, 0.5)); if (Math.abs(d.dot(up)) < 0.08) ra = Math.max(ra, Math.hypot(d.dot(xA), d.dot(n))); }
    ra += root.userData.armorSet ? 0.03 : 0.008;
    const P = ST.plane ?? -0.04, cz = -G, th = 0.006, w = 0.03;
    for (const y of [0.06, -0.05]) {
      const pts = [new THREE.Vector3(-ra, y, P + 0.004), new THREE.Vector3(-ra, y, (P + cz) / 2)];
      for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * ra, y, cz + Math.sin(a) * ra)); }
      pts.push(new THREE.Vector3(ra, y, (P + cz) / 2), new THREE.Vector3(ra, y, P + 0.004));
      const curve = new THREE.CatmullRomCurve3(pts), N = 40, pos = [], idx = [], Y = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k <= N; k++) { const c = curve.getPointAt(k / N), t = curve.getTangentAt(k / N), nn = new THREE.Vector3().crossVectors(t, Y).normalize();
        for (const [sy, sn] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const v = c.clone().add(Y.clone().multiplyScalar(sy * w / 2)).add(nn.clone().multiplyScalar(sn * th / 2)); pos.push(v.x, v.y, v.z); } }
      for (let k = 0; k < N; k++) for (let f = 0; f < 4; f++) { const a = k * 4 + f, b = k * 4 + (f + 1) % 4, c2 = a + 4, d2 = b + 4; idx.push(a, c2, b, b, c2, d2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const strap = new THREE.Mesh(g, ST.mat); strap.castShadow = true; holder.add(strap);
      const bk = new THREE.Mesh(buckleGeo('quadrada'), ST.metal); bk.scale.setScalar(0.62); bk.position.set(ra + th, y, (P + cz) / 2); bk.rotation.y = Math.PI / 2; holder.add(bk); // fivela no lado de fora
      for (const sx of [-1, 1]) { const rv = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), ST.metal); rv.scale.z = 0.6; rv.position.set(sx * ra, y, P - 0.002); holder.add(rv); } // rebites que prendem a alça no forro
    }
  }
  root.userData.items = root.userData.items || {}; root.userData.items.shield = shield;
  gripOn(root, 'l', 'punho', shield, { r: 0 }); // P-013: mão do escudo fechada na alça de mão (enarme), sem cabo a encostar
  return shield;
}
const SHIELD_KIND = { escudo_madeira: 'madeira', broquel_ferro: 'broquel', escudo_sagrado: 'paladino' };
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
    fitToBone(root, sp, onBack, basis(new THREE.Vector3(-0.55, 1, 0), new THREE.Vector3(0, 0, 1)), c.add(new THREE.Vector3(0.0, -0.06, -0.25 - w * 0.03 - (root.userData.bowBackExtra || 0)))); } // corda encostada nas costas (bowBackExtra: por fora de capa/manto da classe, S-344) (a corda fica 11 cm à frente da empunhadura), ventre para fora
  bow.position.z = -bow.userData.gripZ; bow.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items.bow = bow;
  root.userData.bowState = s => { const tgt = s === 'hand' ? inHand : onBack; if (bow.parent !== tgt) { tgt.add(bow); root.userData.bowAt = s; } };
  if (F) gripOn(root, 'l', 'arco', inHand, { axis: new THREE.Vector3(0, 1, 0), active: () => root.userData.bowAt === 'hand' }); // P-013: empunhadura do arco dentro do punho esquerdo
  root.userData.bowState('back');
  return bow;
}
/* S-325: BESTA do Caçador (feita em código). Frente = +z, trilho por cima (+y). Coronha de freixo com cabo de pistola,
   arco de aço recurvado com estribo, corda de cânhamo, noz de travamento, gatilho com guarda-mato, reforços de ferro e o
   virote encaixado no trilho. userData: gripY/gripZ (cabo, dentro do punho direito), foreZ (onde a mão esquerda apoia),
   tipZ (boca do trilho, de onde sai o virote), setCocked(bool) (corda armada + virote visível / corda solta). */
export function codeCrossbow(opt = {}) {
  const g = new THREE.Group(), heavy = !!opt.heavy;
  const ash = new THREE.MeshStandardMaterial({ color: opt.wood || '#7a5532', map: woodGrainTex(), roughness: 0.62 }), dark = new THREE.MeshStandardMaterial({ color: '#3e2a1a', map: woodGrainTex(), roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: '#8f969d', metalness: 0.88, roughness: 0.34 }), iron = new THREE.MeshStandardMaterial({ color: '#3b3836', metalness: 0.75, roughness: 0.5 }), rope = new THREE.MeshStandardMaterial({ color: '#d8ccaa', roughness: 0.85 });
  const leather = new THREE.MeshStandardMaterial({ color: '#4a2e1c', map: metalTex('couro'), roughness: 0.9 });
  // coronha: perfil lateral (z = comprimento, y = altura) extrudado na largura, com chanfro — cabo de pistola descendo sob o trilho
  const s = new THREE.Shape();
  s.moveTo(-0.36, 0.0); s.lineTo(-0.36, -0.115); s.quadraticCurveTo(-0.30, -0.13, -0.2, -0.085); s.lineTo(-0.12, -0.06); // talão e coice
  s.lineTo(-0.085, -0.16); s.quadraticCurveTo(-0.07, -0.19, -0.035, -0.18); s.lineTo(-0.02, -0.05); // cabo de pistola
  s.lineTo(0.34, -0.03); s.quadraticCurveTo(0.39, -0.025, 0.4, 0.0); s.lineTo(0.4, 0.012); s.lineTo(-0.3, 0.02); s.quadraticCurveTo(-0.36, 0.02, -0.36, 0.0);
  const stock = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 3, curveSegments: 10 });
  stock.translate(0, 0, -0.018); stock.rotateY(-Math.PI / 2); g.add(new THREE.Mesh(stock, ash)); // extrusão em x → largura; perfil em (z, y)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.5), dark); rail.position.set(0, 0.022, 0.13); g.add(rail); // trilho escuro
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.48), iron); groove.position.set(0, 0.029, 0.13); g.add(groove);
  for (const z of [-0.2, 0.06, 0.3]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16), iron); band.scale.set(0.9, 1.2, 1); band.position.set(0, -0.005, z); g.add(band); } // braçadeiras de ferro
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.1, 12), leather); wrap.rotation.x = 0.18; wrap.position.set(0, -0.12, -0.055); g.add(wrap); // empunhadura de couro
  // gatilho (alavanca longa sob a coronha, como as bestas medievais) e guarda-mato
  const trig = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.012), iron); trig.rotation.x = 0.5; trig.position.set(0, -0.075, -0.005); g.add(trig);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 14, Math.PI), iron); guard.rotation.set(0, Math.PI / 2, Math.PI); guard.position.set(0, -0.06, 0.0); g.add(guard);
  // noz de travamento (rolete de osso) onde a corda engata
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 14), new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 0.5 })); nut.rotation.z = Math.PI / 2; nut.position.set(0, 0.03, 0.02); g.add(nut);
  // arco de aço (prod): curvado para trás nas pontas, mais grosso no meio
  const span = heavy ? 0.36 : 0.32, pz = 0.36, pts = [];
  for (let k = 0; k <= 20; k++) { const t = k / 20 * 2 - 1, a = Math.abs(t); pts.push(new THREE.Vector3(t * span, 0.012, pz - 0.05 * a * a - (a > 0.85 ? (a - 0.85) * 0.25 : 0))); }
  const pc = new THREE.CatmullRomCurve3(pts), prod = new THREE.TubeGeometry(pc, 48, 1, 10, false), PP = prod.attributes.position;
  for (let k = 0; k < PP.count; k++) { const i = Math.floor(k / 11), t = i / 48, a = Math.abs(t * 2 - 1), c = pc.getPointAt(t), v = new THREE.Vector3(PP.getX(k), PP.getY(k), PP.getZ(k)).sub(c), r = (heavy ? 0.013 : 0.011) * (1 - a * 0.45); v.y *= 1.6; PP.setXYZ(k, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
  prod.computeVertexNormals(); g.add(new THREE.Mesh(prod, steel));
  const lash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), rope); lash.position.set(0, 0.008, pz - 0.005); g.add(lash); // amarração do arco na coronha
  for (const sx of [-1, 1]) { const nock = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), iron); nock.position.copy(pts[sx > 0 ? 20 : 0]); g.add(nock); }
  // estribo (para firmar com o pé ao armar)
  const stir = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 20, Math.PI * 1.3), iron); stir.rotation.set(Math.PI / 2, 0, -Math.PI * 0.15 + Math.PI); stir.position.set(0, 0.0, 0.43); g.add(stir);
  // manivela de armar (só a pesada)
  if (heavy) { const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), iron); cr.rotation.z = Math.PI / 2; cr.position.set(0, -0.02, -0.26); g.add(cr); for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 8), dark); h.position.set(sx * 0.05, -0.04, -0.26); g.add(h); } }
  // corda: armada (em V até a noz) ou solta (reta entre as pontas)
  const strMat = new THREE.MeshStandardMaterial({ color: '#e8dfc8', roughness: 0.7 }), seg = (a, b) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, d.length(), 6), strMat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  const tipL = pts[0].clone(), tipR = pts[20].clone(), latch = new THREE.Vector3(0, 0.03, 0.035);
  const cocked = new THREE.Group(); cocked.add(seg(tipL, latch), seg(tipR, latch)); g.add(cocked);
  const loose = seg(tipL, tipR); g.add(loose);
  // virote: haste curta e grossa, ponta de aço piramidal, duas penas de couro
  const bolt = new THREE.Group(); bolt.position.set(0, 0.04, 0.2);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.34, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a6238', roughness: 0.7 })); bolt.add(sh);
  const hd = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.05, 4).rotateX(Math.PI / 2), steel); hd.position.z = 0.19; bolt.add(hd);
  for (const r of [0, Math.PI / 2]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.024, 0.07), leather); v.position.z = -0.135; v.rotation.z = r + Math.PI / 4; bolt.add(v); }
  g.add(bolt);
  g.userData.setCocked = on => { cocked.visible = on; loose.visible = !on; bolt.visible = on; };
  g.userData.setCocked(true);
  Object.assign(g.userData, { gripY: -0.12, gripZ: -0.055, foreZ: 0.2, tipZ: 0.42 });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
let _woodGrain = null;
function woodGrainTex() { // veios de freixo (claro, retos e finos)
  if (_woodGrain) return _woodGrain;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#c9a77c'; x.fillRect(0, 0, 64, 256);
  for (let k = 0; k < 46; k++) { x.strokeStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 25},${30 + Math.random() * 15},${0.12 + Math.random() * 0.22})`; x.lineWidth = 0.6 + Math.random() * 1.4; x.beginPath(); const x0 = Math.random() * 64; x.moveTo(x0, 0); for (let y = 0; y <= 256; y += 16) x.lineTo(x0 + Math.sin(y * 0.02 + k) * 2.5, y); x.stroke(); }
  _woodGrain = new THREE.CanvasTexture(c); _woodGrain.wrapS = _woodGrain.wrapT = THREE.RepeatWrapping; _woodGrain.colorSpace = THREE.SRGBColorSpace; return _woodGrain;
}
/* a besta fica NA MÃO DIREITA com o cabo de pistola DENTRO do punho (eixo do cabo = eixo mindinho→indicador, trilho para a frente
   da mão); fora de combate vai NAS COSTAS atravessada. root.userData.xbowState('back' | 'hand'). */
function holdCrossbow(root, xb) {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const hand = bone(root, 'hand_r'), sp = bone(root, 'spine_03') || bone(root, 'spine_02'), F = fistFrame(root, 'r');
  const basis = (Y, Z) => { const y = Y.clone().normalize(), z = Z.clone().sub(y.clone().multiplyScalar(Z.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
  const inHand = new THREE.Group(); hand.add(inHand);
  // o cabo de pistola desce inclinado: o eixo "para cima" da besta fica ~20° à frente do eixo do cabo
  if (F) { const up = F.A.clone().normalize(), fw = F.E.clone().normalize(); fitToBone(root, hand, inHand, basis(up.clone().lerp(fw, -0.2), fw), F.C); }
  else fitToBone(root, hand, inHand, new THREE.Quaternion(), rootPos(root, hand));
  const onBack = new THREE.Group(); (sp || root).add(onBack);
  if (sp) { const c = rootPos(root, sp); fitToBone(root, sp, onBack, basis(new THREE.Vector3(0.0, 0.25, -1), new THREE.Vector3(0.9, 0.2, 0)), c.add(new THREE.Vector3(0.02, 0.0, -0.2))); } // atravessada nas costas, arco para cima
  xb.position.set(0, -xb.userData.gripY, -xb.userData.gripZ);
  root.userData.items = root.userData.items || {}; root.userData.items.xbow = xb;
  root.userData.xbowState = st => { const tgt = st === 'hand' ? inHand : onBack; if (xb.parent !== tgt) { tgt.add(xb); root.userData.xbowAt = st; } };
  if (F) gripOn(root, 'r', 'besta', inHand, { axis: new THREE.Vector3(0, 1, 0.17), r: 0.017, active: () => root.userData.xbowAt === 'hand' }); // P-013: cabo de pistola no punho direito (o "para cima" da besta fica ~10° à frente do eixo do cabo)
  root.userData.xbowState('back');
  return xb;
}
/* S-325: roupa de CAÇADOR de verdade (mesma linhagem do Arqueiro, mas de rastreador das matas): manto curto de pele de lobo nos
   ombros, capuz de couro caído nas costas, faca de esfola na bainha do cinto, bolsa de caça e tiras de couro nas canelas. */
let _furTex = null;
function furTex() {
  if (_furTex) return _furTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#7d756b'; x.fillRect(0, 0, 128, 256);
  for (let k = 0; k < 1400; k++) { const px = Math.random() * 128, py = Math.random() * 256, l = 8 + Math.random() * 22, v = 70 + Math.random() * 120; x.strokeStyle = `rgba(${v + 12},${v + 4},${v - 8},${0.25 + Math.random() * 0.4})`; x.lineWidth = 0.8 + Math.random() * 1.3; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (Math.random() - 0.5) * 6, py + l * 0.5, px + (Math.random() - 0.5) * 4, py + l); x.stroke(); }
  _furTex = new THREE.CanvasTexture(c); _furTex.wrapS = _furTex.wrapT = THREE.RepeatWrapping; _furTex.colorSpace = THREE.SRGBColorSpace; return _furTex;
}
function hunterGear(root) {
  const fur = new THREE.MeshStandardMaterial({ color: '#b39477', map: furTex(), roughness: 1, side: THREE.DoubleSide }); // S-355: pele castanha quente (combina com o couro), não cinza
  const furTip = new THREE.MeshStandardMaterial({ color: '#d8d0c4', map: furTex(), alphaMap: furTex(), alphaTest: 0.45, transparent: false, roughness: 1, side: THREE.DoubleSide });
  const hide = new THREE.MeshStandardMaterial({ color: '#5a4430', map: metalTex('couro'), roughness: 0.92, side: THREE.DoubleSide });
  const leather = new THREE.MeshStandardMaterial({ color: '#3e2a1a', map: metalTex('couro'), roughness: 0.85 }), steel = new THREE.MeshStandardMaterial({ color: '#a7adb3', metalness: 0.85, roughness: 0.3 });
  // S-345: traje INTEIRO de caçador (nada do verde da roupa padrão): camisa e mangas de camurça, calça de couro curtido, botas macias;
  // por cima, gibão de couro com cordão na frente e túnica com abas até o meio da coxa, cinto largo e braçadeiras de arqueiro
  costumeBase(root, { body: { color: '#6a5238', tex: 'camurca' }, arms: { color: '#5e4832', tex: 'camurca' }, legs: { color: '#3e3226', tex: 'camurca' }, feet: { color: '#2e2218', tex: 'camurca', rough: 0.75 } });
  { const jerk = AM.leather('#4e3622'), dk = AM.leather('#2e2016'), brass = AM.gold('#8a7448');
    vestOn(root, 'hunterJerkin', jerk, { off: 0.016, low: -0.1 });
    { const s2 = bonePos(root, 'spine_02'); if (s2) for (let k = 0; k < 4; k++) { const y = s2.y + 0.13 - k * 0.075, z = bodySurf(root, ['spine_02', 'spine_03', 'spine_01'], s2.x, y, 1); if (z === null) continue; // cordão de couro cruzado fechando o gibão
      const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.05, 4, 8), dk); t.position.set(s2.x, y, z + 0.022); t.rotation.z = k % 2 ? 0.9 : -0.9; pinToBone(root, k < 2 ? 'spine_03' : 'spine_02', t); } }
    // S-369: abas da túnica JUSTAS ao quadril e fechadas em volta (fendas estreitas), começando por baixo do cinto — presas à roupa, nada de saia larga
    { const cm = AM.leatherCloth('#4a3420'), ch = AM.leatherCloth('#2e2016'), po = { len: 0.26, r1: 0.03, top: 0.075, pleats: 2, pleatAmp: 0.005 }; // frente/costas por dentro, lados por fora, sobrepostos nas fendas
      coatPanels(root, cm, ch, [[-0.62, 1.26], [2.5, 1.28]], { ...po, gap: 0.02 });
      coatPanels(root, cm, ch, [[0.58, 1.98], [3.72, 2.0]], { ...po, gap: 0.028, margin: 0.058 }); }
    beltSet(root, dk, brass, 'simples');
    for (const s of ['l', 'r']) { bracerOn(root, s === 'l' ? AM.leather('#3a2616') : dk, s); bootShaft(root, 'hunterBoot', s, AM.leather('#3a2a1c'), { cuff: 0.1, straps: true }); }
  }
  // manto de pele: casca grossa sobre ombros e alto do peito/costas, com franja irregular de pelo embaixo
  const sp3 = bonePos(root, 'spine_03'), nk = bonePos(root, 'neck_01');
  if (sp3 && nk) {
    const shoulders = ['spine_03', 'clavicle_l', 'clavicle_r', 'neck_01'];
    // S-355: no lugar das placas cinzas de pele: MANTO CURTO DE COURO (mesmo couro do traje) sobre os ombros e o alto das costas,
    // barra recortada em abas macias e debrum escuro, e uma GOLA DE PELE em rolo em volta do pescoço (pele castanha, nos tons do couro)
    void shoulders; void furTip;
    const mantle = wrapCached(root, 'hunterMantle2', () => { const pts = sampleBody(root, ['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'neck_01'], /_Body/).filter(p => !p.acc), A = new THREE.Vector3(nk.x, sp3.y - 0.12, nk.z), B = new THREE.Vector3(nk.x, nk.y - 0.03, nk.z);
      return wrapShell(pts, A, B, { bins: 12, sec: 48, off: 0.034, th: 0.008, smooth: 6, uvRep: 3, arc: [1.0, Math.PI * 2 - 1.0],
        flare: (t, a) => (1 - t) * (1 - t) * 0.03 + Math.max(0, Math.sin(a * 8)) * 0.004 * (1 - t), ridge: (t, a) => (t < 0.1 ? (0.1 - t) * 0.06 * (0.5 + 0.5 * Math.cos(a * 8)) : 0) }); });
    pinToBone(root, 'spine_03', new THREE.Mesh(mantle, AM.leatherCloth('#5a4028')));
    strapOnShell(root, mantle, AM.leatherCloth('#2e2016'), [0.02, 1.02], [0.02, Math.PI * 2 - 1.02], { extra: 0.034 + 0.008 + 0.03 + 0.003, w: 0.016, th: 0.005, n: 64, pin: 'spine_03' }); // debrum da barra
    { let bd = false; root.traverse(m => { if (m.isSkinnedMesh && m.visible && /Beard/i.test(m.name)) bd = true; }); // S-380: com barba, a gola de pele fica fina e baixa NA FRENTE (antes subia no queixo e entrava na barba)
      neckRoll(root, bd ? 'hunterFur2b' : 'hunterFur2', fur, { over: [[mantle, 0.042]], roll: 0.034, gap0: 0.012, y: bd ? -0.04 : -0.015, drop: bd ? 0.07 : 0.03, front: bd ? 0.3 : 0.8, wob: 0.14, crumple: 0.14 }); }
  }
  // faca de esfola na bainha (quadril direito) e bolsa de caça (quadril esquerdo)
  const pv = bonePos(root, 'pelvis'), th = bonePos(root, 'thigh_r'), tl = bonePos(root, 'thigh_l');
  if (pv && th && tl) {
    const knife = new THREE.Group();
    const sheath = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.009, 0.2, 10), leather); sheath.scale.set(1.6, 1, 0.7); sheath.position.y = -0.1; knife.add(sheath);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), steel); tip.position.y = -0.2; knife.add(tip);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#d9cdb0', roughness: 0.55 })); grip.position.y = 0.05; knife.add(grip); // cabo de chifre
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), steel); pom.position.y = 0.105; knife.add(pom);
    const gu = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.02), steel); knife.add(gu);
    const hsK = hipSize(root, pv.y + 0.04); knife.position.set(pv.x + (th.x > pv.x ? 1 : -1) * (hsK.rx + 0.066), pv.y + 0.02, pv.z + 0.03); /* S-369: por fora das abas justas */ knife.rotation.z = th.x > pv.x ? 0.25 : -0.25;
    pinToBone(root, 'pelvis', knife);
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), hide); pouch.scale.set(0.8, 1, 0.55); pouch.position.set(pv.x + (tl.x > pv.x ? 1 : -1) * (hsK.rx + 0.09), pv.y - 0.03, pv.z + 0.03); pinToBone(root, 'pelvis', pouch);
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), leather); flap.scale.set(0.82, 0.7, 0.6); flap.position.copy(pouch.position).add(new THREE.Vector3(0, 0.02, 0.005)); pinToBone(root, 'pelvis', flap);
  }
  // (S-345: as tiras soltas nas canelas viraram as botas altas de rastreio com tiras, acima)
  for (const s of []) { const cf = bonePos(root, 'calf_' + s), ft = bonePos(root, 'foot_' + s); if (!cf || !ft) continue;
    const g = wrapCached(root, 'hunterWrap' + s, () => wrapShell(sampleBody(root, ['calf_' + s]), cf, ft, { t0: 0.35, t1: 0.92, bins: 10, sec: 22, off: 0.006, th: 0.006, smooth: 3, uvRep: 3, ridge: (t, a) => (Math.sin((t * 6 + a / Math.PI) * Math.PI * 2) > 0.55 ? 0.006 : 0) }));
    pinToBone(root, 'calf_' + s, new THREE.Mesh(g, leather)); }
}
/* ===================== S-324: instrumentos do Bardo (sistema genérico: modelo + onde fica + pontos das mãos) =====================
   codeInstrument(kind) → Group com userData.inst = { kind, hands: { l, r } (pontos LOCAIS onde as mãos vão ao tocar) }.
   holdInstrument(root, kind) → guarda nas COSTAS pela alça (fora de combate) ou À FRENTE do corpo/na boca (tocando):
   root.userData.instrument = { kind, obj, state('back'|'play'), at }. A pose de tocar (braços por IK, dedilhar, balanço)
   fica em js3d/instrument3d.js (instrumentPose), como o arco em bow3d.js. Para um instrumento novo: um builder em INSTRUMENTS. */
const INSTR_ITEM = { alaude_de_viajante: 'alaude', bandolim_rubro: 'bandolim', flauta_de_prata: 'flauta' };
export const instrumentOf = weaponId => (typeof ITEMS !== 'undefined' && ITEMS[weaponId] && ITEMS[weaponId].instrument) || INSTR_ITEM[weaponId] || 'alaude';
function luteBody(l, pal, sc = 1) { // alaúde/bandolim: bojo em pera (costas fundas, tampo plano), roseta, escala com trastes, cravelhal dobrado e cordas
  const R = t => 0.155 * sc * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.55) * (1 - 0.42 * t), Y0 = -0.19 * sc, LEN = 0.36 * sc, prof = [];
  for (let k = 0; k <= 28; k++) { const t = k / 28; prof.push(new THREE.Vector2(Math.max(0.001, R(t)), Y0 + t * LEN)); }
  const bowl = new THREE.LatheGeometry(prof, 44), P = bowl.attributes.position;
  for (let k = 0; k < P.count; k++) { let z = P.getZ(k) * 0.55; if (z < -0.012) z = -0.012 + (z + 0.012) * 0.05; P.setZ(k, z); }
  bowl.computeVertexNormals();
  const wood = new THREE.MeshStandardMaterial({ color: pal.wood, map: metalTex('couro'), roughness: 0.42, metalness: 0.05 }), top = std(pal.top, { roughness: 0.62 }), dark = std('#20120a'), ebony = std('#1a120c', { roughness: 0.35 }), trim = std(pal.trim, { metalness: pal.gold ? 0.7 : 0.1, roughness: 0.35 });
  l.add(new THREE.Mesh(bowl, wood));
  const shape = new THREE.Shape(); shape.moveTo(0, Y0);
  for (let k = 0; k <= 28; k++) { const t = k / 28; shape.lineTo(R(t) * 0.995, Y0 + t * LEN); }
  for (let k = 28; k >= 0; k--) { const t = k / 28; shape.lineTo(-R(t) * 0.995, Y0 + t * LEN); }
  top.side = THREE.DoubleSide; const board = new THREE.Mesh(new THREE.ShapeGeometry(shape, 28), top); board.position.z = -0.0135; board.rotation.y = Math.PI; board.scale.x = -1; l.add(board);
  const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shape.getPoints(60).map(p => new THREE.Vector3(p.x, p.y, -0.0138)), true), 120, 0.0028, 5, true), trim); l.add(edge); // filete na borda do tampo
  // roseta entalhada: boca escura com treliça de madeira e um filete fino em volta (nada de anel largo)
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03 * sc, 40), new THREE.MeshStandardMaterial({ color: '#160c06', side: THREE.DoubleSide })); hole.position.set(0, 0.03 * sc, -0.0142); hole.rotation.y = Math.PI; l.add(hole);
  const ros = new THREE.Mesh(new THREE.TorusGeometry(0.032 * sc, 0.0018, 6, 48), trim); ros.position.set(0, 0.03 * sc, -0.0146); l.add(ros);
  for (let k = 0; k < 6; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.058 * sc, 0.002), wood); bar.position.set(0, 0.03 * sc, -0.0146); bar.rotation.z = k * Math.PI / 6; l.add(bar); }
  const star = new THREE.Mesh(new THREE.TorusGeometry(0.015 * sc, 0.0016, 6, 6), wood); star.position.set(0, 0.03 * sc, -0.0146); l.add(star);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.075 * sc, 0.012, 0.01), ebony); bridge.position.set(0, -0.12 * sc, -0.018); l.add(bridge);
  const nl = 0.27 * (0.75 + sc * 0.25), ny = Y0 + LEN + nl / 2 - 0.01;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, nl, 18, 1, false, 0, Math.PI), wood); neck.rotation.y = Math.PI / 2; neck.position.set(0, ny, -0.012); neck.scale.set(1, 1, 0.7); l.add(neck);
  const fret = new THREE.Mesh(new THREE.BoxGeometry(0.044, nl, 0.006), ebony); fret.position.set(0, ny, -0.016); l.add(fret);
  for (let k = 0; k < 8; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.003, 0.004), std('#c9c2b0', { metalness: 0.6, roughness: 0.3 })); f.position.set(0, ny + nl / 2 - 0.02 - k * nl / 9 * (1 - k * 0.035), -0.0195); l.add(f); }
  const pb = new THREE.Group(); pb.position.set(0, ny + nl / 2, -0.01); pb.rotation.x = 1.05; l.add(pb);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.022), wood); box.position.y = 0.06; pb.add(box);
  for (let k = 0; k < 4; k++) for (const s2 of [-1, 1]) { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.05, 10), ebony); peg.rotation.z = Math.PI / 2; peg.position.set(s2 * 0.03, 0.02 + k * 0.028, 0); pb.add(peg); }
  const sm = new THREE.MeshStandardMaterial({ color: '#efe6d0', metalness: 0.5, roughness: 0.3 }), sl = (ny + nl / 2) - (-0.12 * sc);
  for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, sl, 5), sm); st.position.set((k - 2.5) * 0.0065, -0.12 * sc + sl / 2, -0.022); l.add(st); }
  // alça de couro (do pé do bojo ao cravelhal), por trás
  const strap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, Y0 + 0.01, 0.03), new THREE.Vector3(0.12, Y0 + 0.2, 0.17), new THREE.Vector3(0.1, ny + 0.05, 0.16), new THREE.Vector3(0, ny + nl / 2 - 0.02, 0.02)]), 30, 0.008, 5, false), std('#4a2a16', { roughness: 0.8 }));
  strap.scale.set(1, 1, 0.5); l.add(strap); l.userData.strap = strap;
  return { neckY: ny + nl * 0.22, strumY: -0.06 * sc, Y0, top: ny + nl / 2 + 0.12 };
}
const INSTRUMENTS = {
  alaude: () => { const g = new THREE.Group(), l = new THREE.Group(); l.scale.setScalar(1.15); g.add(l); const m = luteBody(l, { wood: '#7a4422', top: '#d9b47a', trim: '#e8d8b0' }, 1); g.userData.inst = { kind: 'alaude', hands: { l: new THREE.Vector3(0, m.neckY, -0.01).multiplyScalar(1.15), r: new THREE.Vector3(0.0, m.strumY, -0.03).multiplyScalar(1.15) } }; return g; },
  bandolim: () => { const g = new THREE.Group(), l = new THREE.Group(); l.scale.setScalar(1.05); g.add(l); const m = luteBody(l, { wood: '#5a1e12', top: '#b04a30', trim: '#e2b84a', gold: true }, 0.86); g.userData.inst = { kind: 'bandolim', hands: { l: new THREE.Vector3(0, m.neckY, -0.01).multiplyScalar(1.05), r: new THREE.Vector3(0, m.strumY, -0.03).multiplyScalar(1.05) } }; return g; },
  flauta: () => { // flauta transversal de prata (~62 cm) ao longo de +Y, embocadura perto da ponta de cima, furos e chaves
    const g = new THREE.Group(), silver = std('#dfe4ea', { metalness: 0.9, roughness: 0.22 }), gold = std('#d8b45a', { metalness: 0.85, roughness: 0.3 }), dark = std('#12100e');
    const L = 0.62, body = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0095, L, 24, 1, true), silver); body.position.y = L / 2; g.add(body);
    for (const y of [0.0, L]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 24), gold); cap.position.y = y; g.add(cap); }
    for (const y of [0.14, 0.3, 0.46]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0108, 0.0016, 6, 24), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
    const emb = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), dark); emb.scale.set(1, 1.5, 0.4); emb.position.set(0, 0.06, 0.0095); g.add(emb);
    for (let k = 0; k < 6; k++) { const y = 0.24 + k * 0.045 + (k > 2 ? 0.03 : 0), key = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 16), silver); key.rotation.x = Math.PI / 2; key.position.set(0, y, 0.0108); g.add(key); }
    g.userData.inst = { kind: 'flauta', mouth: new THREE.Vector3(0, 0.06, 0.012), hands: { l: new THREE.Vector3(0, 0.27, 0), r: new THREE.Vector3(0, 0.43, 0) } }; return g;
  },
};
export function codeInstrument(kind) { const g = (INSTRUMENTS[kind] || INSTRUMENTS.alaude)(); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); return g; }
export function holdInstrument(root, kind) {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const obj = codeInstrument(kind), sp = bone(root, 'spine_03') || bone(root, 'spine_02'), hd = bone(root, 'Head') || sp, pv = bone(root, 'pelvis') || sp;
  const shL = rootPos(root, bone(root, 'upperarm_l')), shR = rootPos(root, bone(root, 'upperarm_r')), S3 = rootPos(root, sp), H = rootPos(root, hd), PV = rootPos(root, pv);
  const left = shL.clone().sub(shR).setY(0).normalize(), fwd = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0), w = shL.distanceTo(shR);
  const basis = (Y, Z) => { const y = Y.clone().normalize(), z = Z.clone().sub(y.clone().multiplyScalar(Z.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
  const onBack = new THREE.Group(), inPlay = new THREE.Group();
  if (kind === 'flauta') { // guardada no cinto, de lado; tocando, na boca e apontando para a direita do bardo
    pv.add(onBack); fitToBone(root, pv, onBack, basis(up.clone().add(left.clone().multiplyScalar(-0.45)).add(fwd.clone().multiplyScalar(0.15)), left.clone().negate()), PV.clone().add(left.clone().multiplyScalar(-w * 0.55)).add(new THREE.Vector3(0, -0.24, 0.02)));
    hd.add(inPlay); const dir = left.clone().negate().multiplyScalar(0.93).add(up.clone().multiplyScalar(-0.16)).add(fwd.clone().multiplyScalar(0.3)).normalize();
    const lips = H.clone().add(fwd.clone().multiplyScalar(0.105)).add(up.clone().multiplyScalar(-0.05)); fitToBone(root, hd, inPlay, basis(dir, up.clone().add(fwd.clone().multiplyScalar(0.6))), lips.clone().sub(dir.clone().multiplyScalar(0.06)));
  } else { // alaúde/bandolim: nas costas pela alça (braço sobre o ombro direito); tocando, apoiado na barriga com o braço para a esquerda
    sp.add(onBack); fitToBone(root, sp, onBack, basis(up.clone().add(left.clone().multiplyScalar(-0.55)), fwd), S3.clone().add(new THREE.Vector3(0, -0.12, 0)).add(fwd.clone().multiplyScalar(-0.2 - w * 0.05)));
    sp.add(inPlay); const Y = left.clone().multiplyScalar(0.86).add(up.clone().multiplyScalar(0.42)).add(fwd.clone().multiplyScalar(0.16));
    const front = sampleBody(root, ['spine_01', 'spine_02'], /_Body/).reduce((m, p) => Math.max(m, p.z), -9), at = S3.clone().add(up.clone().multiplyScalar(-0.2)).add(left.clone().multiplyScalar(-0.13));
    at.z = Math.max(at.z + 0.17, front + 0.115); // o bojo encosta na barriga de verdade (anão barrigudo inclusive), sem entrar no corpo
    fitToBone(root, sp, inPlay, basis(Y, fwd.clone().negate().add(up.clone().multiplyScalar(-0.15))), at); // bojo na barriga, à direita; o braço cruza o peito
  }
  root.userData.items = root.userData.items || {}; root.userData.items.instrument = obj;
  let strap = null; obj.traverse(o => { if (o.userData.strap) strap = o.userData.strap; });
  const I = { kind, obj, at: 'back', state(s) { const tgt = s === 'play' ? inPlay : onBack; if (obj.parent !== tgt) { tgt.add(obj); I.at = s; if (strap) strap.visible = s !== 'play'; } } }; // a alça só aparece com o instrumento nas costas
  root.userData.instrument = I; I.state('back');
  return I;
}
/* S-324: roupa de bardo (no espírito do Bardo/Menestrel do RO, dos bardos de RPG e de Skyrim): gibão vinho com cortes que mostram o forro
   creme e botões dourados, mangas bufantes cortadas, capa curta de veludo verde sobre o ombro esquerdo presa por broche, cinto de couro
   com bolsinhas. Nada de chapéu fixo (só se ele equipar). */
let _bardTex = null;
function bardSlashTex() { // tecido do gibão: vinho com cortes verticais mostrando o forro creme e costuras douradas
  if (_bardTex) return _bardTex; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#6a1a2a'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,220'},${Math.random() * 0.05})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  for (let k = 0; k < 8; k++) { const cx = 16 + k * 32; x.fillStyle = '#e8d8b4'; x.beginPath(); x.ellipse(cx, 128, 5, 70, 0, 0, 7); x.fill(); x.strokeStyle = '#3a0a14'; x.lineWidth = 2; x.stroke(); x.strokeStyle = 'rgba(216,180,90,0.9)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 9, 50); x.lineTo(cx - 9, 206); x.moveTo(cx + 9, 50); x.lineTo(cx + 9, 206); x.stroke(); }
  x.fillStyle = '#c9a24a'; x.fillRect(0, 0, 256, 10); x.fillRect(0, 246, 256, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_bardTex = t);
}
/* S-368: veludo verde da capa do Bardo com BORDADO dourado: uma lira estilizada (original: braços em voluta, travessa, cinco cordas,
   caixa de ressonância) dentro de um medalhão de folhinhas, e uma barra de ramos bordados junto à bainha.
   uc = posição (0..1, ao longo da capa) do centro das costas, onde vai o bordado. */
const _bardCape = {};
function bardCapeTex(uc = 0.5) {
  const key = uc.toFixed(2); if (_bardCape[key]) return _bardCape[key];
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#1e4c35'; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 140; k++) { const cx = r() * S, cy = r() * S, rr = 14 + r() * 50, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr), l = r() < 0.5; g.addColorStop(0, l ? `rgba(120,190,150,${0.05 + r() * 0.06})` : `rgba(0,20,10,${0.08 + r() * 0.08})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); } // pelo do veludo deitado em manchas
  for (let k = 0; k < S; k += 2) { x.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; x.fillRect(0, k, S, 1); }
  const gold = (draw, w = 6) => { x.lineCap = x.lineJoin = 'round'; x.strokeStyle = '#4a3410'; x.lineWidth = w + 4; draw(); x.stroke(); x.strokeStyle = '#c9a24a'; x.lineWidth = w; draw(); x.stroke(); x.strokeStyle = 'rgba(250,226,150,0.85)'; x.lineWidth = Math.max(1.2, w * 0.28); x.save(); x.translate(-1, -1); draw(); x.stroke(); x.restore(); };
  const leaf = (px, py, ang, L = 13) => { x.save(); x.translate(px, py); x.rotate(ang); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(L * 0.5, -L * 0.42, L, 0); x.quadraticCurveTo(L * 0.5, L * 0.42, 0, 0); x.fillStyle = '#4a3410'; x.fill(); x.scale(0.78, 0.7); x.fillStyle = '#c9a24a'; x.fill(); x.restore(); };
  // barra bordada: ramo ondulado com folhinhas, logo acima da bainha
  const hy = S - 34; gold(() => { x.beginPath(); for (let k = 0; k <= S; k += 4) { const yy = hy + Math.sin(k / S * Math.PI * 12) * 7; k ? x.lineTo(k, yy) : x.moveTo(k, yy); } }, 3);
  for (let k = 0; k < 24; k++) { const px = (k + 0.5) / 24 * S, yy = hy + Math.sin(px / S * Math.PI * 12) * 7; leaf(px, yy, (k % 2 ? 1 : -1) * 1.0 - Math.PI / 2, 12); }
  gold(() => { x.beginPath(); x.moveTo(0, S - 12); x.lineTo(S, S - 12); }, 2.5);
  // medalhão + lira no centro das costas
  const cx = uc * S, cy = S * 0.44, H = 150;
  x.save(); x.translate(cx, cy);
  for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2, px = Math.sin(a) * 96, py = -Math.cos(a) * 118; leaf(px, py, a + (k % 2 ? 0.5 : -0.5), 14); } // coroa de folhinhas
  gold(() => { x.beginPath(); x.ellipse(0, 0, 84, 106, 0, 0, Math.PI * 2); }, 2.5);
  const base = H * 0.42, topY = -H * 0.42;
  for (const s of [-1, 1]) gold(() => { x.beginPath(); x.moveTo(s * 20, base - 6); x.bezierCurveTo(s * 64, base - 30, s * 66, -10, s * 40, topY + 24); x.bezierCurveTo(s * 28, topY + 6, s * 40, topY - 12, s * 56, topY - 8); x.bezierCurveTo(s * 66, topY - 4, s * 62, topY + 10, s * 52, topY + 8); }, 7); // braços em voluta
  gold(() => { x.beginPath(); x.moveTo(-44, topY + 22); x.quadraticCurveTo(0, topY + 12, 44, topY + 22); }, 6); // travessa
  for (let k = 0; k < 5; k++) { const sx = (k - 2) * 8; gold(() => { x.beginPath(); x.moveTo(sx, base - 10); x.lineTo(sx * 1.15, topY + 20); }, 1.6); } // cordas
  x.beginPath(); x.ellipse(0, base - 2, 34, 13, 0, 0, Math.PI * 2); x.fillStyle = '#4a3410'; x.fill(); x.beginPath(); x.ellipse(0, base - 3, 30, 10, 0, 0, Math.PI * 2); x.fillStyle = '#c9a24a'; x.fill(); // caixa de ressonância
  x.beginPath(); x.ellipse(-4, base - 6, 18, 3, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(250,226,150,0.7)'; x.fill();
  for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 46, topY - 30, 4, 0, Math.PI * 2); x.fillStyle = '#c9a24a'; x.fill(); } // duas notas/pontos de ouro
  x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rr = k % 2 ? 4 : 10; x.lineTo(Math.sin(a) * rr, topY - 30 - Math.cos(a) * rr); } x.closePath(); x.fillStyle = '#e2c26a'; x.fill(); // estrelinha
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (_bardCape[key] = t);
}
// S-368: caimento da capa curta do Bardo: abre um pouco na bainha, dobras macias que nascem no ombro e se aprofundam até embaixo
const bardCapeFl = (t, a) => (1 - t) * 0.035 + t * t * 0.03 + Math.sin(a * 7 + t * 3) * 0.004 * (1 - t) + 0.019 * Math.pow(1 - t, 1.2) * Math.pow(Math.max(0, Math.sin(a * 7 + 0.8)), 1.3);
EXTRAS.bowOut = function (root) { root.userData.bowBackExtra = 0.05; }; // S-345: arco nas costas por fora do manto de pele do Caçador
EXTRAS.bardGear = function (root) {
  if (!root.userData.human) return;
  root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
  // S-344: traje INTEIRO — camisa de linho cru, mangas de veludo vinho até o punho (o braço todo vestido), meias-calças escuras e botas de camurça
  costumeBase(root, { body: { color: '#5a1826', tex: 'veludo', rough: 0.95 }, arms: { color: '#5a1826', tex: 'veludo', rough: 0.95 }, legs: { color: '#2b2433', tex: 'linho' }, feet: { color: '#3a2416', tex: 'camurca', rough: 0.72 } }); // S-353: forro do tronco em veludo vinho (o linho só aparece na gola e nos punhos — nada de "polo")
  root.userData.bowBackExtra = 0.06; // o arco nas costas fica por fora da capa curta (nada atravessando)
  const doublet = new THREE.MeshStandardMaterial({ map: bardSlashTex(), roughness: 0.85 }), velvet = new THREE.MeshStandardMaterial({ color: '#1f4a34', map: metalTex('couro'), roughness: 0.95, side: THREE.DoubleSide });
  const gold = std('#d8b45a', { metalness: 0.8, roughness: 0.3 }), leather = armorMat('#4a2a16', 'couro');
  // gibão justo no tronco (cortes verticais), com a barra um pouco abaixo da cintura
  // S-353: o gibão mede também as clavículas (antes a camisa da roupa base furava o peito de cima e parecia uma "polo" grudada)
  const gd = wrapCached(root, 'bardDoublet2', () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'pelvis', 'clavicle_l', 'clavicle_r'], /_Body/).filter(p => !p.acc), top = bonePos(root, 'neck_01'), bot = bonePos(root, 'pelvis');
    return wrapShell(pts, new THREE.Vector3(top.x, bot.y + 0.02, top.z), new THREE.Vector3(top.x, top.y - 0.045, top.z), { bins: 18, sec: 40, off: 0.014, th: 0.01, smooth: 6, uvRep: 3, flare: t => (t < 0.18 ? (0.18 - t) * 0.12 : 0) }); });
  pinToBone(root, 'spine_02', new THREE.Mesh(gd, doublet));
  { // S-353: camisa de LINHO saindo de dentro do gibão — gola alta franzida e o cordão de amarrar com ponteiras douradas
    const linenC = clothMat('#ece2cc', 0.9);
    neckScarf(root, 'bardCollar5', linenC, { high: 0.5, puff: 0.01, off: 0.016, low: 0.0, bones: ['neck_01'], re: /_Body|SuperHero/ });
    const tie = shellAt(gd, 0.985, 0, 0.014 + 0.01 + 0.006);
    for (const s of [-1, 1]) { const p0 = tie.p.clone().add(new THREE.Vector3(s * 0.006, 0.004, 0)), p1 = p0.clone().add(new THREE.Vector3(s * 0.012, -0.035, 0.008)), p2 = p0.clone().add(new THREE.Vector3(s * 0.02, -0.075, 0.004));
      pinToBone(root, 'spine_03', new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), 10, 0.0025, 6), linenC));
      const ag = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.002, 0.014, 8), gold); ag.position.copy(p2).add(new THREE.Vector3(s * 0.001, -0.006, 0)); ag.rotation.z = s * 0.25; pinToBone(root, 'spine_03', ag); }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), linenC); knot.position.copy(tie.p); pinToBone(root, 'spine_03', knot); }
  { const sp = bonePos(root, 'spine_02'), nk = bonePos(root, 'neck_01'), pv = bonePos(root, 'pelvis'); // botões dourados na frente
    const front = sampleBody(root, ['spine_02', 'spine_03'], /_Body/).reduce((m, p) => Math.max(m, p.z), 0);
    for (let k = 0; k < 6; k++) { const y = pv.y + 0.07 + k * (nk.y - pv.y - 0.14) / 5, b = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), gold); b.position.set(sp.x, y, front + 0.03 - Math.abs(k - 3) * 0.002); pinToBone(root, k > 2 ? 'spine_03' : 'spine_02', b); } }
  // mangas bufantes cortadas (sobem no ombro, afinam no cotovelo)
  for (const s of ['l', 'r']) {
    const g = wrapCached(root, 'bardSleeve' + s, () => { const pts = sampleBody(root, ['upperarm_' + s], /_(Body|Arms)/), A = bonePos(root, 'upperarm_' + s), B = bonePos(root, 'lowerarm_' + s);
      return wrapShell(pts, A, B, { t0: 0.02, t1: 0.82, bins: 10, sec: 22, off: 0.012, th: 0.008, smooth: 3, uvRep: 2, flare: t => Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.03, ridge: (t, a) => Math.max(0, Math.sin(a * 4)) * 0.006 * Math.sin(Math.PI * t) }); });
    pinToBone(root, 'upperarm_' + s, new THREE.Mesh(g, doublet));
  }
  // capa curta de veludo sobre o ombro esquerdo (meia-volta: do peito esquerdo às costas), com barra dourada e broche
  const left = bonePos(root, 'upperarm_l').x > bonePos(root, 'upperarm_r').x ? 1 : -1;
  const gc = wrapCached(root, 'bardCape4', () => { const pts = sampleBody(root, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'pelvis'], /_Body/).filter(p => !p.acc), top = bonePos(root, 'neck_01'), bot = bonePos(root, 'pelvis');
    // ângulo 0 = frente, +π/2 = lado +X; a capa vai do ombro esquerdo (um pouco à frente) até o meio das costas, caindo até a cintura
    const a0 = left > 0 ? Math.PI * 0.28 : -Math.PI * 1.22, A = new THREE.Vector3(top.x, bot.y + 0.04, top.z), B = new THREE.Vector3(top.x, top.y + 0.01, top.z);
    return wrapShell(pts, A, B, { t0: 0.0, t1: 1, bins: 18, sec: 72, arc: [a0, a0 + Math.PI * 0.94], off: 0.038, th: 0.007, smooth: 6, uvRep: 1, flare: bardCapeFl }); });
  // S-368: costas profissionais — veludo com brilho de pelo (sheen), dobras que nascem no ombro e se abrem até a bainha, e a lira bordada a ouro
  const capeVel = new THREE.MeshPhysicalMaterial({ map: bardCapeTex(left > 0 ? 0.6 : 0.4), roughness: 0.88, sheen: 1, sheenColor: new THREE.Color('#6fae88'), sheenRoughness: 0.45, side: THREE.DoubleSide }); void velvet;
  pinToBone(root, 'spine_03', new THREE.Mesh(gc, capeVel));
  { // S-353: acabamento da capa nas costas — barra e beiradas com galão dourado (a capa deixa de ser uma placa lisa)
    const a0 = left > 0 ? Math.PI * 0.28 : -Math.PI * 1.22, a1 = a0 + Math.PI * 0.94, galon = std('#c9a24a', { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
    const capeEx = (t, a) => 0.038 + 0.0035 + bardCapeFl(t, a) + 0.004;
    strapOnShell(root, gc, galon, [0.0, a0 + 0.02], [0.0, a1 - 0.02], { extra: capeEx, w: 0.016, th: 0.009, n: 48, pin: 'spine_03' });
    for (const a of [a0 + 0.012, a1 - 0.012]) strapOnShell(root, gc, galon, [0.0, a], [0.97, a], { extra: capeEx, w: 0.012, th: 0.008, n: 16, pin: 'spine_03' }); }
  { const sh = bonePos(root, 'clavicle_l') || bonePos(root, 'upperarm_l'), nk = bonePos(root, 'neck_01'), br = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), gold); br.position.set((sh.x + nk.x) / 2, nk.y - 0.08, sh.z + 0.1); pinToBone(root, 'spine_03', br);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), std('#2a8a5a', { metalness: 0.3, roughness: 0.15 })); gem.position.copy(br.position); gem.position.z += 0.006; pinToBone(root, 'spine_03', gem); }
  // cinto de couro com fivela e bolsinhas
  const gb = wrapCached(root, 'bardBelt', () => { const pts = sampleBody(root, ['pelvis', 'spine_01'], /_(Body|Legs)/), pv = bonePos(root, 'pelvis'); return wrapShell(pts, new THREE.Vector3(pv.x, pv.y - 0.02, pv.z), new THREE.Vector3(pv.x, pv.y + 0.12, pv.z), { t0: 0.35, t1: 0.7, bins: 3, sec: 32, off: 0.022, th: 0.012, smooth: 2, uvRep: 4 }); });
  pinToBone(root, 'pelvis', new THREE.Mesh(gb, leather));
  const pv = bonePos(root, 'pelvis');
  { const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 4), gold); buckle.rotation.z = Math.PI / 4; const fz = sampleBody(root, ['pelvis'], /_(Body|Legs)/).reduce((m, p) => Math.max(m, p.z), 0); buckle.position.set(pv.x, pv.y + 0.05, fz + 0.035); pinToBone(root, 'pelvis', buckle); }
  const hsB = hipSize(root, pv.y + 0.03), py = pv.y + 0.03; // verificador: bolsinhas presas ao cinto, por FORA do quadril medido (no anão as coxas entravam nelas ao correr)
  for (const [a, sc] of [[0.55, 1], [-0.62, 0.85]]) { /* S-368: sem a bolsinha de trás (nas costas parecia uma mancha) */ const dx = Math.sin(a) * (hsB.rx + 0.035 * sc), dz = Math.cos(a) * (hsB.rz + 0.035 * sc); const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 * sc, 16, 12), leather); b.scale.set(1, 1.15, 0.6); b.position.set(pv.x + dx, py - 0.02, pv.z + dz); b.rotation.y = a; pinToBone(root, 'pelvis', b);
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.052 * sc, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), std('#3a1e0e', { roughness: 0.8 })); flap.scale.set(1, 0.7, 0.66); flap.position.set(pv.x + dx, py + 0.012, pv.z + dz); flap.rotation.y = a; pinToBone(root, 'pelvis', flap); }
  // S-344: punhos de linho saindo da manga de veludo e botas altas de camurça com a boca dobrada — braços e pernas vestidos de verdade
  const linen = clothMat('#ece2cc', 0.9);
  for (const s of ['l', 'r']) {
    const la = bonePos(root, 'lowerarm_' + s), hd = bonePos(root, 'hand_' + s);
    if (la && hd) shellOn(root, 'bardCuff' + s, ['lowerarm_' + s], /_(Body|Arms)/, la, hd, { t0: 0.74, t1: 0.9, bins: 4, off: 0.012, th: 0.004, flare: t => t * 0.016, ridge: (t, a) => Math.max(0, Math.sin(a * 9)) * 0.004 * t }, linen, 'lowerarm_' + s);
    bootShaft(root, 'bardBoot', s, AM.leather('#3a2416'), { cuff: 0.22, t0: 0.08 });
  }
};
/* ===== S-382: VESTES DE MAGO — Mago (aprendiz) → Arquimago / Sábio Elemental =====
   No espírito dos magos de Skyrim, RO e WoW (sem copiar roupa nenhuma): robe LONGO de lã até perto dos pés que acompanha as pernas
   (gownGeo + clothSkirt, ajustado ao quadril/coxas medidos de cada raça e sexo — mgFit), corpo da túnica moldado no tronco, mangas
   largas em sino com punho, cinto/faixa cobrindo a emenda e bordados pintados em textura — frente E costas trabalhadas.
   Mago = aprendiz: lã azul-ardósia com debruns cru, capuz caído, cinto de couro com bolsa e porta-pergaminhos.
   Arquimago = promoção: túnica violeta + sobretúnica de veludo índigo aberta na frente, bordados a ouro (sigilo arcano nas costas),
   gola alta, ombreiras finas de prata e ouro, faixa larga com medalhão.
   Sábio Elemental = estudioso: lã terrosa com escapulário cor de areia (rosa dos quatro elementos nas costas, os quatro símbolos no
   peito), cordão dourado com borlas e franja dourada. */
const _mgTex = {};
function mgCanvas(key, W, H, paint, o = {}) {
  if (_mgTex[key]) return _mgTex[key];
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); let sd = 23; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  paint(x, W, H, r);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.flipY === false) t.flipY = false; if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]); if (o.offset) t.offset.set(o.offset[0], o.offset[1]);
  return (_mgTex[key] = t);
}
// lã (ou veludo): trama fina, fios soltos e manchas macias do pelo
function mgWool(x, W, H, r, base, o = {}) {
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2) { x.fillStyle = `rgba(0,0,0,${0.025 + r() * 0.03})`; x.fillRect(0, y, W, 1); }
  for (let xx = 0; xx < W; xx += 2) { x.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`; x.fillRect(xx, 0, 1, H); }
  for (let k = 0; k < W * H / 160; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.04})`; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 3); }
  if (o.velvet) for (let k = 0, n = Math.max(3, Math.round(W * H / 7000)); k < n; k++) { /* (proporcional à área: em textura pequena as manchas somavam e desbotavam o veludo) */ const cx = r() * W, cy = r() * H, rr = 20 + r() * 60, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, `rgba(255,255,255,${0.03 + r() * 0.04})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
}
// bordado: fio com contorno escuro e brilho (o mesmo traço do bordado da capa do Bardo); draw() começa o próprio caminho
function mgThread(x, draw, w, col = '#d4ac52', o = {}) {
  x.save(); x.lineCap = x.lineJoin = 'round';
  x.strokeStyle = o.dark || 'rgba(26,16,6,0.8)'; x.lineWidth = w + Math.max(2, w * 0.6); draw(); x.stroke();
  x.strokeStyle = col; x.lineWidth = w; draw(); x.stroke();
  x.strokeStyle = o.hi || 'rgba(255,244,205,0.5)'; x.lineWidth = Math.max(0.8, w * 0.3); x.translate(-w * 0.18, -w * 0.18); draw(); x.stroke(); x.restore();
}
const mgWrap = (W, fn) => { for (const dx of [-W, 0, W]) fn(dx); }; // desenho que atravessa a emenda da textura (costas = bordas)
// símbolos próprios dos quatro elementos, num medalhão de cor com aro de ouro
const MG_ELEM = { fogo: '#c4502a', agua: '#3a7ec4', terra: '#6a8436', ar: '#9ccfcf' };
function mgGlyph(x, cx, cy, s, kind, gold = '#d8b25a') {
  x.save(); x.translate(cx, cy);
  x.beginPath(); x.arc(0, 0, s, 0, Math.PI * 2); x.fillStyle = MG_ELEM[kind]; x.fill();
  const g = x.createRadialGradient(-s * 0.3, -s * 0.35, 0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); x.fillStyle = g; x.fill();
  mgThread(x, () => { x.beginPath(); x.arc(0, 0, s, 0, Math.PI * 2); }, s * 0.14, gold);
  const w = Math.max(1.4, s * 0.12);
  if (kind === 'fogo') mgThread(x, () => { x.beginPath(); x.moveTo(0, s * 0.6); x.bezierCurveTo(-s * 0.55, s * 0.5, -s * 0.5, -s * 0.05, -s * 0.1, -s * 0.62); x.bezierCurveTo(-s * 0.08, -s * 0.22, s * 0.12, -s * 0.16, s * 0.16, -s * 0.4); x.bezierCurveTo(s * 0.55, -s * 0.05, s * 0.5, s * 0.5, 0, s * 0.6); x.moveTo(0, s * 0.42); x.bezierCurveTo(-s * 0.18, s * 0.3, -s * 0.14, s * 0.06, 0, -s * 0.1); }, w, gold);
  else if (kind === 'agua') mgThread(x, () => { x.beginPath(); x.moveTo(0, -s * 0.64); x.bezierCurveTo(s * 0.2, -s * 0.3, s * 0.5, -s * 0.02, s * 0.44, s * 0.24); x.bezierCurveTo(s * 0.4, s * 0.56, -s * 0.4, s * 0.56, -s * 0.44, s * 0.24); x.bezierCurveTo(-s * 0.5, -s * 0.02, -s * 0.2, -s * 0.3, 0, -s * 0.64); x.moveTo(-s * 0.26, s * 0.2); x.quadraticCurveTo(-s * 0.13, s * 0.08, 0, s * 0.2); x.quadraticCurveTo(s * 0.13, s * 0.32, s * 0.26, s * 0.2); }, w, gold);
  else if (kind === 'terra') mgThread(x, () => { x.beginPath(); x.moveTo(-s * 0.6, s * 0.4); x.lineTo(-s * 0.18, -s * 0.36); x.lineTo(s * 0.04, -s * 0.02); x.lineTo(s * 0.24, -s * 0.48); x.lineTo(s * 0.6, s * 0.4); x.closePath(); x.moveTo(-s * 0.34, s * 0.4); x.lineTo(-s * 0.18, s * 0.12); }, w, gold);
  else mgThread(x, () => { x.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 3, rr = s * 0.06 + k / 40 * s * 0.4, px = Math.cos(a) * rr, py = Math.sin(a) * rr; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.quadraticCurveTo(-s * 0.2, -s * 0.62, s * 0.5, -s * 0.5); }, w, gold);
  x.restore();
}
// fileira de runas do Aethra (traços retos, losangos e anéis) — h = altura da runa
function mgRunes(x, x0, x1, y, h, r, col, vertical = false) {
  let p = vertical ? y : x0; const end = vertical ? x1 : x1;
  while (p < end - h * 0.6) { const k = Math.floor(r() * 5), a = vertical ? x0 : p, b = vertical ? p : y - h / 2, c = h;
    mgThread(x, () => { x.beginPath();
      if (k === 0) { x.moveTo(a + c * 0.3, b); x.lineTo(a + c * 0.3, b + c); x.moveTo(a + c * 0.3, b + c * 0.3); x.lineTo(a + c * 0.6, b + c * 0.05); }
      else if (k === 1) { x.moveTo(a + c * 0.3, b); x.lineTo(a + c * 0.58, b + c * 0.5); x.lineTo(a + c * 0.3, b + c); x.lineTo(a + c * 0.02, b + c * 0.5); x.closePath(); }
      else if (k === 2) { x.moveTo(a + c * 0.02, b + c); x.lineTo(a + c * 0.3, b); x.lineTo(a + c * 0.58, b + c); x.moveTo(a + c * 0.13, b + c * 0.62); x.lineTo(a + c * 0.47, b + c * 0.62); }
      else if (k === 3) { x.moveTo(a + c * 0.3, b); x.lineTo(a + c * 0.3, b + c); x.moveTo(a + c * 0.02, b + c * 0.25); x.lineTo(a + c * 0.58, b + c * 0.75); }
      else { x.arc(a + c * 0.3, b + c * 0.5, c * 0.26, 0, Math.PI * 2); x.moveTo(a + c * 0.3, b + c * 0.12); x.lineTo(a + c * 0.3, b + c * 0.88); } }, Math.max(1.4, h * 0.09), col);
    p += h * 0.95; }
}
// sigilo arcano do Arquimago: anel duplo com runas, estrela de oito pontas e gema no centro (desenho próprio)
function mgSigil(x, cx, cy, R, col, gem = '#8a52d8') {
  x.save(); x.translate(cx, cy);
  mgThread(x, () => { x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); }, R * 0.035, col);
  mgThread(x, () => { x.beginPath(); x.arc(0, 0, R * 0.8, 0, Math.PI * 2); }, R * 0.025, col);
  for (let k = 0; k < 16; k++) { x.save(); x.rotate(k / 16 * Math.PI * 2); const h = R * 0.1;
    mgThread(x, () => { x.beginPath(); if (k % 3 === 0) { x.moveTo(0, -R * 0.95); x.lineTo(0, -R * 0.85); x.moveTo(-h * 0.35, -R * 0.93); x.lineTo(h * 0.35, -R * 0.87); } else if (k % 3 === 1) { x.moveTo(-h * 0.35, -R * 0.86); x.lineTo(0, -R * 0.95); x.lineTo(h * 0.35, -R * 0.86); } else x.arc(0, -R * 0.9, h * 0.25, 0, Math.PI * 2); }, R * 0.02, col); x.restore(); }
  for (const rot of [0, Math.PI / 4]) mgThread(x, () => { x.beginPath(); for (let k = 0; k < 4; k++) { const a = rot + k / 4 * Math.PI * 2, px = Math.sin(a) * R * 0.74, py = -Math.cos(a) * R * 0.74; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); }, R * 0.028, col);
  mgThread(x, () => { x.beginPath(); x.arc(0, 0, R * 0.3, 0, Math.PI * 2); }, R * 0.028, col);
  const dia = () => { x.beginPath(); x.moveTo(0, -R * 0.2); x.lineTo(R * 0.12, 0); x.lineTo(0, R * 0.2); x.lineTo(-R * 0.12, 0); x.closePath(); };
  dia(); x.fillStyle = gem; x.fill(); mgThread(x, dia, R * 0.02, col);
  x.restore();
}
// rosa dos quatro elementos do Sábio: disco em quatro quartos, cruz de ouro e os quatro símbolos nos pontos cardeais
function mgCompass(x, cx, cy, R, gold = '#d8b25a') {
  x.save(); x.translate(cx, cy); const K = ['ar', 'fogo', 'terra', 'agua'];
  K.forEach((k, i) => { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R * 0.62, -Math.PI * 3 / 4 + i * Math.PI / 2, -Math.PI / 4 + i * Math.PI / 2); x.closePath(); x.fillStyle = MG_ELEM[k]; x.globalAlpha = 0.55; x.fill(); x.globalAlpha = 1; });
  mgThread(x, () => { x.beginPath(); x.arc(0, 0, R * 0.62, 0, Math.PI * 2); }, R * 0.035, gold);
  mgThread(x, () => { x.beginPath(); x.arc(0, 0, R * 0.98, 0, Math.PI * 2); }, R * 0.03, gold);
  mgThread(x, () => { x.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; x.moveTo(Math.sin(a) * R * 0.1, -Math.cos(a) * R * 0.1); x.lineTo(Math.sin(a) * R * 0.62, -Math.cos(a) * R * 0.62); } }, R * 0.03, gold);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; mgThread(x, () => { x.beginPath(); x.moveTo(Math.sin(a) * R * 0.66, -Math.cos(a) * R * 0.66); x.lineTo(Math.sin(a) * R * 0.94, -Math.cos(a) * R * 0.94); }, R * 0.025, gold); }
  K.forEach((k, i) => mgGlyph(x, Math.sin(i * Math.PI / 2) * R * 0.8, -Math.cos(i * Math.PI / 2) * R * 0.8, R * 0.2, k, gold));
  x.beginPath(); x.arc(0, 0, R * 0.12, 0, Math.PI * 2); x.fillStyle = '#e8d6a0'; x.fill(); mgThread(x, () => { x.beginPath(); x.arc(0, 0, R * 0.12, 0, Math.PI * 2); }, R * 0.025, gold);
  x.restore();
}
const mgMat = (map, o = {}) => o.sheen ? new THREE.MeshPhysicalMaterial({ map, roughness: o.rough ?? 0.86, metalness: 0, sheen: o.sheen, sheenColor: new THREE.Color(o.sheenColor || '#ffffff'), sheenRoughness: 0.5, side: o.side ?? THREE.FrontSide, alphaTest: o.alphaTest || 0, transparent: false })
  : new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.9, metalness: 0, side: o.side ?? THREE.FrontSide, alphaTest: o.alphaTest || 0 });
const mgPlain = (base, o = {}) => mgCanvas('plain' + base + (o.velvet ? 'v' : ''), 256, 256, (x, W, H, r) => mgWool(x, W, H, r, base, o));
// corpo da túnica moldado no tronco (da cintura ao pescoço). uvRep 1: frente no MEIO da textura, costas nas bordas (fechada);
// aberta (open): a textura vai de uma borda da abertura à outra, com as costas no meio
function mgTorso(root, key, mat, o = {}) {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const sp1 = bonePos(root, 'spine_01'), nk = bonePos(root, 'neck_01');
  return shellOn(root, key, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'pelvis'], /_Body/, AV3(sp1, 0, -0.07, 0), AV3(nk, 0, -0.035, 0),
    { t0: 0, t1: 1, bins: 16, sec: 48, off: o.off ?? 0.016, th: o.th ?? 0.007, smooth: 6, uvRep: 1, arc: o.open ? [o.open, Math.PI * 2 - o.open] : [-Math.PI, Math.PI] /* volta inteira com a emenda duplicada nas costas: o bordado não se espreme numa faixa */, flare: o.flare || ((t) => (t < 0.1 ? (0.1 - t) * 0.03 : 0)) }, mat, 'spine_02').geometry;
}
// ajusta a saia ao corpo MEDIDO (quadril, nádegas e coxas de cada raça/sexo): cada anel fica por fora do corpo com folga e nunca
// estreita para baixo (caimento em A). As pregas da gownGeo são preservadas (a medida vale para o raio-base de cada coluna).
function mgFit(root, geo, o) {
  const K = geo.userData.skirt, P = geo.attributes.position, SEC = 72, R = K.rows - 1;
  const pts = sampleBody(root, ['pelvis', 'spine_01', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'], /_(Body|Legs)/).filter(q => !q.acc);
  const bins = Array.from({ length: K.rows }, () => new Float32Array(SEC));
  for (const q of pts) { const dx = q.x - K.cx, dz = (q.z - K.cz) / K.sz, r = Math.hypot(dx, dz), j = ((Math.round(Math.atan2(dx, dz) / (Math.PI * 2) * SEC) % SEC) + SEC) % SEC;
    for (let i = 0; i < K.rows; i++) if (Math.abs(K.yb[i * K.cols] - q.y) < 0.035 && r > bins[i][j]) bins[i][j] = r; }
  const base = new Float32Array(K.rows * K.cols);
  for (let i = 0; i < K.rows; i++) {
    const t = i / R, b0 = o.r0 + t * t * o.r1 + Math.sin(t * 3) * 0.01, b = bins[i], d = new Float32Array(SEC);
    for (let j = 0; j < SEC; j++) { let m = 0; for (let k = -4; k <= 4; k++) m = Math.max(m, b[(j + k + SEC) % SEC] * (1 - Math.abs(k) * 0.015)); d[j] = m; }
    for (let c = 0; c < K.cols; c++) { const v = i * K.cols + c, a = K.ang[v], j = ((Math.round(a / (Math.PI * 2) * SEC) % SEC) + SEC) % SEC, pl = K.rb[v] / b0;
      let bb = Math.max(b0, d[j] ? (d[j] + o.margin) : 0); if (i > 0) bb = Math.max(bb, base[v - K.cols]); base[v] = bb;
      const r = bb * pl; K.rb[v] = r; P.setXYZ(v, K.cx + Math.sin(a) * r, K.yb[v], K.cz + Math.cos(a) * r * K.sz); } }
  geo.computeVertexNormals();
}
// saia longa (ou painel/aba) presa na cintura, que acompanha as pernas
function mgSkirt(root, mat, o = {}) {
  humanIdlePose(root); root.updateMatrixWorld(true);
  const pv = bonePos(root, 'pelvis'), hs = hipSize(root, pv.y + 0.1, 0.03), gap = o.gap ?? 0.03, sz = Math.min(1, Math.max(0.72, (hs.rz + gap) / (hs.rx + gap)));
  const r0 = hs.rx + gap, r1 = o.r1 ?? 0.08;
  // saia fechada = volta inteira com a emenda DUPLICADA na frente (u 0 e 1: o bordado não se espreme numa faixa); para o pano ela continua fechada
  const geo = gownGeo(root, { top: pv.y + (o.top ?? 0.1), bot: o.bot ?? 0.075, r0, r1, arc: o.arc || [0, Math.PI * 2], seg: o.seg ?? 64, pleats: o.pleats ?? 11, pleatAmp: o.pleatAmp ?? 0.03, sz, seed: o.seed ?? 0.4, hemRows: o.hem ? 1 : 0 });
  if (!o.arc) geo.userData.skirt.closed = true;
  mgFit(root, geo, { r0, r1, margin: o.fit ?? gap + 0.006 });
  return clothSkirt(root, geo, o.hem ? [mat, o.hem] : mat, o.margin ?? 0.035, mgLegRad(root));
}
// raios REAIS da perna (calça e bota da roupa base) no quadril, joelho/panturrilha, tornozelo e pé — o raio genérico (7,5 cm na
// panturrilha) deixava a perna furar o robe longo ao correr, principalmente no anão. Nunca menores que os genéricos.
function mgLegRad(root) {
  return wrapCached(root, 'mgLegRad', () => {
    const J = ['thigh_l', 'calf_l', 'foot_l', 'ball_l'].map(n => bonePos(root, n)); if (J.some(p => !p)) return null;
    const acc = [[], [], [], []];
    for (const q of sampleBody(root, ['thigh_l', 'calf_l', 'foot_l', 'ball_l'], /_(Legs|Feet)/)) { if (q.acc) continue;
      for (let k = 0; k < 3; k++) { const A = J[k], u = J[k + 1].clone().sub(A), L = u.length(); u.normalize(); const d = q.clone().sub(A), t = d.dot(u) / L; if (t < -0.05 || t > 1.05) continue; const r = d.addScaledVector(u, -t * L).length(); if (r > 0.22) continue;
        if (k === 0 && t > 0.15 && t < 0.45) acc[0].push(r);
        if ((k === 0 && t > 0.85) || (k === 1 && t < 0.6)) acc[1].push(r); // joelho e barriga da perna (a bota sobe até aqui)
        if ((k === 1 && t > 0.75) || (k === 2 && t < 0.2)) acc[2].push(r);
        if (k === 2 && t > 0.75) acc[3].push(r); } }
    const p95 = a => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.95)] : 0; };
    const out = [Math.max(0.125, p95(acc[0]) + 0.01), Math.max(0.075, p95(acc[1]) + 0.012), Math.max(0.06, p95(acc[2]) + 0.01), Math.max(0.05, p95(acc[3]) + 0.008)];
    out.spheres = 6; out.tent = 1.8; out.drop = 0.88; out.vtent = 1.4; out.cap = 0.5; out.raiseF = 0.22; out.hk = 1.4; if (root.userData.dwarf) { out.capB = 0; out.raiseB = 0.55; } return out; // robeSolve (S-383): perna em esferas; folga do pano limitada — a perna sai por baixo (barra sobe pouco, só ali) em vez de o robe virar sino // clothSkirt: perna em esferas (coxa erguida ao correr não fura o robe); pano mais rente a cada perna e que volta abaixo do joelho (nada de "caixa" ao correr)
  });
}
// mangas: de cima justa (por cima do ombro) e de baixo em SINO, mais funda atrás (cai para baixo quando o braço dobra), com punho
function mgSleeves(root, k, mat, cuff, o = {}) {
  for (const s of ['l', 'r']) {
    const ua = bonePos(root, 'upperarm_' + s), la = bonePos(root, 'lowerarm_' + s), hd = bonePos(root, 'hand_' + s); if (!ua || !la || !hd) continue;
    const puff = o.puff ?? 0.006;
    shellOn(root, k + 'U' + s, ['upperarm_' + s], /_(Body|Arms)/, ua, la, { t0: -0.1, t1: 1.04, bins: 12, sec: 30, off: 0.009, th: 0.006, smooth: 4, uvRep: 2, flare: t => Math.sin(Math.PI * Math.min(1, t * 1.1)) * puff + t * 0.006 }, mat, 'upperarm_' + s);
    const T0 = -0.06, T1 = o.len ?? 0.84, OFF = 0.026 + puff * 0.3, TH = 0.006;
    const fl = (t, a) => Math.pow(t, 1.5) * (o.bell ?? 0.035) + Math.max(0, -Math.cos(a)) * Math.pow(t, 1.3) * (o.drape ?? 0.045) + Math.sin(a * 5 + t * 2) * 0.003 * t;
    const g = shellOn(root, k + 'L' + s, ['lowerarm_' + s], /_(Body|Arms)/, la, hd, { t0: T0, t1: T1, bins: 12, sec: 40, off: OFF, th: TH, smooth: 4, uvRep: 2, flare: fl }, mat, 'lowerarm_' + s).geometry;
    if (cuff) { const tn = t => (t - T0) / (T1 - T0), tc = T1 - (o.cuffT ?? 0.06);
      strapOnShell(root, g, cuff, [tc, -Math.PI], [tc, Math.PI], { extra: (t, a) => OFF + TH + fl(tn(t), a) + 0.0015, w: o.cuffW ?? 0.03, th: 0.005, n: 56, pin: 'lowerarm_' + s }); }
  }
}
function mgBelt(root, key, mat, o = {}) {
  const pv = bonePos(root, 'pelvis');
  return shellOn(root, key, ['pelvis', 'spine_01'], /_(Body|Legs)/, AV3(pv, 0, o.y0 ?? 0.07, 0), AV3(pv, 0, o.y1 ?? 0.12, 0), { bins: 3, sec: 56, off: o.off ?? 0.056, th: o.th ?? 0.012, smooth: 6, uvRep: o.uvRep ?? 4 }, mat, 'pelvis').geometry;
}
// algo pendurado por fora da saia, na altura do cinto (bolsa, estojo): ângulo a (0 = frente), raio medido no quadril
function mgHang(root, obj, a, out, dy = 0) {
  const pv = bonePos(root, 'pelvis'), hs = hipSize(root, pv.y + 0.02, 0.06);
  obj.position.set(pv.x + Math.sin(a) * (hs.rx + out), pv.y + 0.06 + dy, pv.z + 0.01 + Math.cos(a) * (hs.rz + out)); obj.rotation.y = a; return pinToBone(root, 'pelvis', obj);
}
function mgPouch(root, leather, dark, a, w, h, out = 0.085) {
  const g = new THREE.Group(), b = new THREE.Mesh(roundedBox(w, h, 0.042, 0.012), leather); b.position.y = -h * 0.42; g.add(b);
  const flap = new THREE.Mesh(roundedBox(w * 1.05, h * 0.46, 0.012, 0.005), dark); flap.position.set(0, -h * 0.12, 0.022); flap.rotation.x = -0.08; g.add(flap);
  const stud = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8), AM.gold('#a8884a')); stud.scale.z = 0.6; stud.position.set(0, -h * 0.3, 0.03); g.add(stud);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 16, Math.PI), dark); loop.position.set(0, 0.0, 0.0); g.add(loop);
  return mgHang(root, g, a, out);
}
const MAGE_BUILD = {
  // ---------- MAGO (aprendiz): S-401 — lã castanha (o azul saiu), debruns de lã crua, estola verde-oliva bordada descendo pela frente, capuz caído, cinto com bolsa e porta-pergaminhos ----------
  mago(root) {
    root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
    const BLUE = '#6a4a32', CREAM = '#ddd0b0', STOLE = '#3e4a26'; // (o nome ficou; a cor agora é castanha)
    costumeBase(root, { body: { color: '#5e4230', tex: 'linho' }, arms: { color: '#5e4230', tex: 'linho' }, legs: { color: '#2e2a2a', tex: 'linho' }, feet: { color: '#3a2618', tex: 'camurca', rough: 0.75 } });
    const thread = (x, d, w) => mgThread(x, d, w, CREAM, { dark: 'rgba(30,18,8,0.7)', hi: 'rgba(255,255,240,0.45)' });
    const stole = (x, cx0, y0, y1, fringe) => { for (const s2 of [-1, 1]) { const cx = cx0 + s2 * 62; x.fillStyle = STOLE; x.fillRect(cx - 26, y0, 52, y1 - y0); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(cx - 26, y0, 4, y1 - y0); x.fillRect(cx + 22, y0, 4, y1 - y0); // estola: duas faixas de lã verde-oliva com bordado
      thread(x, () => { x.beginPath(); x.moveTo(cx - 19, y0); x.lineTo(cx - 19, y1); x.moveTo(cx + 19, y0); x.lineTo(cx + 19, y1); }, 1.8);
      for (let y = y0 + 30; y < y1 - 20; y += 64) thread(x, () => { x.beginPath(); x.moveTo(cx, y - 12); x.lineTo(cx + 9, y); x.lineTo(cx, y + 12); x.lineTo(cx - 9, y); x.closePath(); x.moveTo(cx - 9, y); x.lineTo(cx + 9, y); }, 1.6);
      if (fringe) { x.fillStyle = CREAM; for (let k = 0; k < 9; k++) x.fillRect(cx - 24 + k * 6, y1 - 2, 2.4, 14); } } };
    const star = (x, cx, cy, R) => { thread(x, () => { x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); }, 3); thread(x, () => { x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? R * 0.34 : (k % 4 ? R * 0.62 : R * 0.86); const px = cx + Math.sin(a) * rr, py = cy - Math.cos(a) * rr; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); }, 2.6); x.beginPath(); x.arc(cx, cy, R * 0.12, 0, Math.PI * 2); x.fillStyle = '#9fc4ff'; x.fill(); };
    const vestT = mgCanvas('mgVest2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, BLUE);
      x.fillStyle = CREAM; x.fillRect(W / 2 - 15, 0, 30, H); // carcela (frente) de lã crua com pesponto
      thread(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(W / 2 + s * 21, 0); x.lineTo(W / 2 + s * 21, H); } }, 2);
      for (let y = 40; y < H; y += 56) thread(x, () => { x.beginPath(); x.moveTo(W / 2, y - 8); x.lineTo(W / 2 + 7, y); x.lineTo(W / 2, y + 8); x.lineTo(W / 2 - 7, y); x.closePath(); }, 2);
      x.fillStyle = CREAM; x.fillRect(0, 0, W, 9); // debrum da gola
      stole(x, W / 2, 0, H, false);
      mgWrap(W, dx => { thread(x, () => { x.beginPath(); x.moveTo(dx, H * 0.78); x.lineTo(dx, H); }, 2); star(x, dx, H * 0.66, 56); }); // costas: costura do meio e a estrela do aprendiz
    });
    const skirtT = mgCanvas('mgSkirt2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, BLUE);
      mgWrap(W, dx => { x.fillStyle = CREAM; x.fillRect(dx - 15, 0, 30, H); thread(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(dx + s * 21, 0); x.lineTo(dx + s * 21, H); } }, 2); }); // carcela continua até a barra
      thread(x, () => { x.beginPath(); x.moveTo(0, H * 0.86); for (let k = 0; k <= 64; k++) x.lineTo(k / 64 * W, H * 0.86 + (k % 2 ? -9 : 9)); }, 2.2); // ziguezague acima da barra
      thread(x, () => { x.beginPath(); x.moveTo(0, H * 0.905); x.lineTo(W, H * 0.905); x.moveTo(0, H * 0.815); x.lineTo(W, H * 0.815); }, 1.8);
      thread(x, () => { x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H * 0.62); }, 1.8); star(x, W / 2, H * 0.7, 30); // costas: costura e estrela pequena
      mgWrap(W, dx => stole(x, dx, 0, H * 0.74, true)); // a estola desce pela frente e termina em franja acima da barra
    }, { flipY: false, repeat: [1 / 3, 0.5] });
    const robe = mgMat(vestT), skirtM = mgMat(skirtT, { side: THREE.DoubleSide }), plain = mgMat(mgPlain(BLUE), { side: THREE.DoubleSide }), cream = mgMat(mgPlain(CREAM), { side: THREE.DoubleSide });
    const vest = mgTorso(root, 'mgV', robe);
    mgSkirt(root, skirtM, { hem: cream, r1: 0.07, pleats: 9, pleatAmp: 0.028, seed: 0.7 });
    mgSleeves(root, 'mgSl', plain, cream, { bell: 0.03, drape: 0.04, cuffW: 0.032 });
    { // capuz caído de lã nas costas: a boca enrolada sobre os ombros e o capuz deitado, com debrum de lã crua e costura no meio (o mesmo capuz do Salteador, em lã)
      const hoodT = mgCanvas('mgHood', 256, 256, (x, W, H, r) => { mgWool(x, W, H, r, '#5e4230'); x.fillStyle = CREAM; x.fillRect(0, 0, 18, H); x.fillRect(W - 18, 0, 18, H);
        thread(x, () => { x.beginPath(); x.moveTo(24, 0); x.lineTo(24, H); x.moveTo(W - 24, 0); x.lineTo(W - 24, H); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); }, 1.6); }, { flipY: false, repeat: [0.5, 0.5] });
      neckRoll(root, 'hoodRoll5mgc', plain, { roll: 0.024, gap0: 0.012, front: 0.8, flat: 0.5, wide: 1.3, wob: 0.07, crumple: 0.14, drop: 0.045, clear: 0.016, over: [[vest, 0.023]] });
      hoodBag(root, mgMat(hoodT, { side: THREE.DoubleSide }), { k: 'mg', on: vest, onEx: 0.023, over: 0.014 }); }
    // cinto de couro com fivela de latão, bolsa de componentes e porta-pergaminhos
    const leather = AM.leather('#4a2e1a'), dark = AM.leather('#2e1c10'), brass = AM.gold('#a8884a');
    const bg = mgBelt(root, 'mgBelt', leather, { y0: 0.07, y1: 0.12, off: 0.058 });
    { const q = shellAt(bg, 0.5, 0, 0.058 + 0.012); strapBuckle(root, brass, q.p, q.n, new THREE.Vector3(1, 0, 0), 0.75, 'pelvis'); }
    const L = bonePos(root, 'upperarm_l').x > bonePos(root, 'upperarm_r').x ? 1 : -1;
    mgPouch(root, leather, dark, L * 0.95, 0.075, 0.08);
    { // porta-pergaminhos de couro com tampas de latão, pendurado atrás do quadril direito, e um pergaminho preso por fita
      const g = new THREE.Group(), tube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.25, 20), leather); g.add(tube);
      for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.03, 20), brass); cap.position.y = s * 0.125; g.add(cap); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), brass); knob.position.y = s * 0.145; g.add(knob); }
      for (const y of [-0.06, 0.06]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.003, 6, 24), dark); band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band); }
      g.rotation.z = -L * 0.5; const h = new THREE.Group(); h.add(g); g.position.set(0, -0.08, 0.03); mgHang(root, h, -L * 2.1, 0.06, -0.02); }
  },
  // ---------- ARQUIMAGO: túnica violeta + sobretúnica de veludo índigo bordada a ouro, gola alta, ombreiras finas, faixa com medalhão ----------
  arquimago(root) {
    root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
    const VIO = '#44206e', IND = '#141838', GOLD = '#d6ae55'; // túnica violeta por baixo, sobretúnica azul-meia-noite por cima (contraste de camadas)
    costumeBase(root, { body: { color: '#3a1e60', tex: 'veludo' }, arms: { color: '#4a2a74', tex: 'veludo' }, legs: { color: '#1c1428', tex: 'linho' }, feet: { color: '#24160e', tex: 'camurca', rough: 0.72 } });
    const gold = (x, d, w) => mgThread(x, d, w, GOLD);
    const rnd = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const vestT = mgCanvas('arqVest2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, VIO, { velvet: true });
      gold(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(W / 2 + s * 30, 0); x.lineTo(W / 2 + s * 30, H); } }, 3); mgRunes(x, W / 2 - 16, H - 10, 14, 28, rnd, GOLD, true); });
    const coatT = mgCanvas('arqCoat2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, IND, { velvet: true });
      for (const e of [0, W]) { const s = e ? -1 : 1; gold(x, () => { x.beginPath(); x.moveTo(e + s * 34, 0); x.lineTo(e + s * 34, H); }, 3); mgRunes(x, e + s * 50 - (s < 0 ? 26 : 0), H - 10, 16, 26, rnd, GOLD, true); } // bordas da abertura
      gold(x, () => { x.beginPath(); x.moveTo(0, 12); x.lineTo(W, 12); }, 3);
      mgSigil(x, W / 2, H * 0.44, 118, GOLD); // costas: o sigilo arcano entre as omoplatas
      gold(x, () => { x.beginPath(); x.moveTo(W / 2, H * 0.44 + 126); x.lineTo(W / 2, H); x.moveTo(W / 2 - 40, H * 0.9); x.lineTo(W / 2, H * 0.83); x.lineTo(W / 2 + 40, H * 0.9); }, 2.6); });
    const overT = mgCanvas('arqOver2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, IND, { velvet: true });
      for (const e of [0, W]) { const s = e ? -1 : 1; x.fillStyle = '#2a2058'; x.fillRect(e ? W - 46 : 0, 0, 46, H); gold(x, () => { x.beginPath(); x.moveTo(e + s * 44, 0); x.lineTo(e + s * 44, H); x.moveTo(e + s * 6, 0); x.lineTo(e + s * 6, H); }, 2.6); mgRunes(x, e + s * 25 - 12, H * 0.9, 10, 22, rnd, GOLD, true); }
      x.fillStyle = '#2a2058'; x.fillRect(0, H * 0.8, W, H * 0.12); gold(x, () => { x.beginPath(); x.moveTo(0, H * 0.8); x.lineTo(W, H * 0.8); x.moveTo(0, H * 0.915); x.lineTo(W, H * 0.915); }, 2.6); mgRunes(x, 0, W, H * 0.86, 28, rnd, GOLD);
      gold(x, () => { x.beginPath(); x.moveTo(W / 2 - 26, 0); x.lineTo(W / 2 - 26, H * 0.8); x.moveTo(W / 2 + 26, 0); x.lineTo(W / 2 + 26, H * 0.8); }, 2.4); // costas: faixa bordada do meio
      for (let y = 30; y < H * 0.76; y += 44) gold(x, () => { x.beginPath(); x.moveTo(W / 2, y - 14); x.lineTo(W / 2 + 12, y); x.lineTo(W / 2, y + 14); x.lineTo(W / 2 - 12, y); x.closePath(); }, 2.2);
    }, { flipY: false, repeat: [1 / 3, 0.5] });
    const underT = mgCanvas('arqUnder2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, VIO, { velvet: true });
      mgWrap(W, dx => { gold(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(dx + s * 46, 0); x.lineTo(dx + s * 46, H); } }, 2.6); });
      for (const dx of [0, W]) { let v = 11; mgRunes(x, dx - 8, H * 0.9, 16, 26, () => (v = (v * 16807) % 2147483647) / 2147483647, GOLD, true); } }); // a mesma fileira dos dois lados da emenda (frente)
    const sashT = mgCanvas('arqSash', 256, 64, (x, W, H, r) => { mgWool(x, W, H, r, '#2a1446', { velvet: true }); gold(x, () => { x.beginPath(); x.moveTo(0, 6); x.lineTo(W, 6); x.moveTo(0, H - 6); x.lineTo(W, H - 6); }, 3); for (let k = 0; k < 4; k++) gold(x, () => { x.beginPath(); const cx = 32 + k * 64; x.moveTo(cx - 10, H / 2); x.lineTo(cx, H / 2 - 12); x.lineTo(cx + 10, H / 2); x.lineTo(cx, H / 2 + 12); x.closePath(); }, 2); });
    const vel = (map, side, sc = '#8a7ad8', k = 0.7) => mgMat(map, { sheen: k, sheenColor: sc, rough: 0.82, side }), velB = (map, side) => vel(map, side, '#3a4a8a', 0.4); // veludo: brilho de pelo violeta na túnica e azulado na sobretúnica
    const goldM = AM.gold('#d4ac52'), goldC = mgMat(mgPlain('#c9a24a'), { side: THREE.DoubleSide, rough: 0.55 });
    mgTorso(root, 'arqV', vel(vestT));
    const OPEN = 0.34, coat = mgTorso(root, 'arqCoat', velB(coatT), { off: 0.032, th: 0.008, open: OPEN });
    for (const s of [1, -1]) strapOnShell(root, coat, goldM, [0.02, s * (OPEN + 0.012)], [0.99, s * (OPEN + 0.012)], { extra: 0.032 + 0.008 + 0.002, w: 0.012, th: 0.005, n: 24 }); // debrum de ouro nas bordas da abertura
    mgSkirt(root, vel(underT, THREE.DoubleSide), { hem: goldC, r1: 0.07, pleats: 10, pleatAmp: 0.026, seed: 0.3 });
    mgSkirt(root, velB(overT, THREE.DoubleSide), { arc: [0.48, Math.PI * 2 - 0.96], gap: 0.05, fit: 0.058, margin: 0.052, r1: 0.1, bot: 0.06, pleats: 9, pleatAmp: 0.03, seed: 1.3, hem: goldC });
    mgSleeves(root, 'arqSl', velB(mgPlain(IND, { velvet: true }), THREE.DoubleSide), goldM, { bell: 0.05, drape: 0.06, cuffW: 0.026, len: 0.86 });
    { // GOLA ALTA aberta na frente, subindo atrás da nuca e abrindo para fora, com debrum de ouro
      const nk = bonePos(root, 'neck_01'), hd = bonePos(root, 'Head') || AV3(nk, 0, 0.12, 0), A0 = 0.95, OFF = 0.03, TH = 0.008, T1 = 0.74, FL = Math.min(0.06, 0.28 * Math.max(0.08, hd.y + 0.08 - nk.y)), fl = (t, a) => t * t * FL * (0.45 + 0.55 * Math.max(0, -Math.cos(a))); // abertura proporcional à altura do pescoço (no anão, de pescoço curto, não vira "aba")
      // mede só o PESCOÇO (pontos perto do eixo): no anão, mandíbula/ombros entravam na medida e a gola virava uma "aba" de lado
      const cg = wrapCached(root, 'arqCollar5', () => wrapShell(sampleBody(root, ['neck_01', 'spine_03'], /_Body|SuperHero/).filter(p => !p.acc && Math.hypot(p.x - nk.x, p.z - nk.z) < 0.165), AV3(nk, 0, -0.05, 0), AV3(hd, 0, 0.03, 0), { t0: 0, t1: T1, bins: 10, sec: 48, arc: [A0, Math.PI * 2 - A0], off: OFF, th: TH, smooth: 9, uvRep: 3, flare: fl }));
      pinToBone(root, 'spine_03', new THREE.Mesh(cg, velB(mgPlain(IND, { velvet: true }))));
      strapOnShell(root, cg, goldM, [T1 - 0.02, A0 + 0.02], [T1 - 0.02, Math.PI * 2 - A0 - 0.02], { extra: (t, a) => OFF + TH + fl(1, a) + 0.0015, w: 0.012, th: 0.005, n: 40, pin: 'spine_03' }); }
    { // OMBREIRAS finas de prata com borda e filete de ouro e uma gema violeta (nada de placa pesada)
      const silver = AM.steel('#bdb8cc', { metal: 0.85, rough: 0.3, env: 1.1 });
      for (const s of ['l', 'r']) { const ua = bonePos(root, 'upperarm_' + s), la = bonePos(root, 'lowerarm_' + s), c = ua.x > 0 ? -Math.PI / 2 : Math.PI / 2, T0 = -0.08, T1 = 0.25, OFF = 0.042, TH = 0.008;
        const fl = t => Math.max(0, t - 0.55) * 0.03 - Math.max(0, 0.3 - t) * 0.05, tn = t => (t - T0) / (T1 - T0); // a borda de cima fecha sobre o ombro (cúpula), sem "aba" levantada
        const dome = shellOn(root, 'arqPd2' + s, ['upperarm_' + s], /_(Body|Arms)/, ua, la, { t0: T0, t1: T1, bins: 12, sec: 40, off: OFF, th: TH, smooth: 8, arc: [c - 1.75, c + 1.75], ridge: (t, a) => Math.max(0, Math.cos(a - c)) ** 12 * 0.008 * Math.sin(Math.min(1, t * 1.1) * Math.PI), flare: fl }, silver, 'upperarm_' + s).geometry;
        strapOnShell(root, dome, goldM, [T1 - 0.02, c - 1.7], [T1 - 0.02, c + 1.7], { extra: () => OFF + TH + fl(tn(T1 - 0.02)) + 0.001, w: 0.014, th: 0.006, n: 36, pin: 'upperarm_' + s });
        strapOnShell(root, dome, goldM, [T0 + 0.06, c], [T1 - 0.05, c], { extra: t => OFF + TH + fl(tn(t)) + 0.008 * Math.sin(Math.min(1, tn(t) * 1.1) * Math.PI) + 0.001, w: 0.006, th: 0.004, n: 16, pin: 'upperarm_' + s });
        const q = shellAt(dome, (T0 + T1) / 2 + 0.04, c, OFF + TH + fl(tn((T0 + T1) / 2 + 0.04)) + 0.008), gem = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), mysticMat('#9a5aff', { ei: 0.5, op: 0.95 })); gem.scale.z = 0.55; gem.position.copy(q.p); gem.lookAt(q.p.clone().add(q.n)); pinToBone(root, 'upperarm_' + s, gem); } }
    { // FAIXA larga de veludo na cintura com medalhão de ouro e gema arcana
      const sg = mgBelt(root, 'arqSash', mgMat(sashT, { rough: 0.72 }), { y0: 0.05, y1: 0.14, off: 0.074, th: 0.012, uvRep: 3 }), q = shellAt(sg, 0.55, 0, 0.074 + 0.012);
      const m = new THREE.Group(), disc = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.01, 40), goldM); disc.rotation.x = Math.PI / 2; m.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0045, 10, 40), goldM); ring.position.z = 0.005; m.add(ring);
      const gem = new THREE.Mesh(crystalGeo(0.016, 0.03, { pr: 0.45, sharp: 0.7, wob: 0.05, seed: 3 }), mysticMat('#a86aff', { ei: 0.55, op: 0.92 })); gem.rotation.x = Math.PI / 2; gem.scale.set(1, 1, 0.7); gem.position.z = 0.012; m.add(gem);
      m.position.copy(q.p); m.lookAt(q.p.clone().add(q.n)); pinToBone(root, 'pelvis', m); }
  },
  // ---------- SÁBIO ELEMENTAL: lã terrosa, escapulário cor de areia com os quatro elementos, cordão dourado com borlas ----------
  sabio(root) {
    root.userData.outfitKey = root.userData.outfitKey || outfitKey(root);
    const UMB = '#5a3b24', SAND = '#cdb487', GOLD = '#d4ac52', FW = 94, BW = 100; // meia-largura dos painéis da frente/costas (px)
    costumeBase(root, { body: { color: '#54371f', tex: 'linho' }, arms: { color: '#54371f', tex: 'linho' }, legs: { color: '#2e241a', tex: 'linho' }, feet: { color: '#3a2618', tex: 'camurca', rough: 0.75 } });
    const gold = (x, d, w) => mgThread(x, d, w, GOLD);
    const vestT = mgCanvas('sbVest2', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, UMB);
      const panel = (cx, hw) => { x.fillStyle = SAND; x.fillRect(cx - hw, 0, hw * 2, H); gold(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(cx + s * (hw - 7), 0); x.lineTo(cx + s * (hw - 7), H); } }, 2.6); };
      x.fillStyle = SAND; x.fillRect(0, 0, W, H * 0.13); gold(x, () => { x.beginPath(); x.moveTo(0, H * 0.13 - 6); x.lineTo(W, H * 0.13 - 6); }, 2.6); // pala sobre os ombros (liga frente e costas do escapulário)
      panel(W / 2, FW); mgWrap(W, dx => panel(dx, BW));
      x.fillStyle = SAND; x.fillRect(0, 0, W, H * 0.13 - 8);
      // frente: os quatro elementos em losango em volta de uma pequena gema de ouro
      const cx = W / 2, cy = H * 0.48, d = 52; gold(x, () => { x.beginPath(); x.moveTo(cx, cy - d); x.lineTo(cx + d, cy); x.lineTo(cx, cy + d); x.lineTo(cx - d, cy); x.closePath(); }, 2.2);
      mgGlyph(x, cx, cy - d, 26, 'ar', GOLD); mgGlyph(x, cx + d, cy, 26, 'fogo', GOLD); mgGlyph(x, cx, cy + d, 26, 'terra', GOLD); mgGlyph(x, cx - d, cy, 26, 'agua', GOLD);
      x.beginPath(); x.arc(cx, cy, 8, 0, Math.PI * 2); x.fillStyle = '#e8d6a0'; x.fill();
      gold(x, () => { x.beginPath(); x.moveTo(cx, H * 0.2); x.lineTo(cx, cy - d - 26); x.moveTo(cx, cy + d + 26); x.lineTo(cx, H); }, 2.2);
      mgWrap(W, dx => mgCompass(x, dx, H * 0.5, 84, GOLD)); // costas: a rosa dos quatro elementos
    });
    const skirtT = mgCanvas('sbSkirt3', 1024, 512, (x, W, H, r) => { mgWool(x, W, H, r, UMB);
      // abas do escapulário (frente e costas) TECIDAS na saia até o joelho, com bordas de ouro, ramo bordado e franja — acompanham as pernas sem nunca descolar
      const panel = (cx, hw) => { const yb = H * 0.56; x.fillStyle = SAND; x.fillRect(cx - hw, 0, hw * 2, yb); x.fillStyle = 'rgba(90,60,24,0.16)'; x.fillRect(cx - hw, 0, 5, yb); x.fillRect(cx + hw - 5, 0, 5, yb);
        gold(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(cx + s * (hw - 7), 0); x.lineTo(cx + s * (hw - 7), yb - 3); } x.moveTo(cx - hw + 4, yb - 3); x.lineTo(cx + hw - 4, yb - 3); x.moveTo(cx, 6); x.lineTo(cx, yb - 26); }, 2.6);
        for (let y = 30; y < yb - 40; y += 40) gold(x, () => { x.beginPath(); for (const s of [-1, 1]) { x.moveTo(cx, y + 8); x.quadraticCurveTo(cx + s * 22, y - 2, cx + s * 34, y - 16); } }, 2);
        for (let k = 0; k <= Math.floor((hw * 2 - 10) / 5); k++) { const px = cx - hw + 5 + k * 5, len = 14 + (k % 3) * 3; x.strokeStyle = 'rgba(40,24,8,0.7)'; x.lineWidth = 3; x.beginPath(); x.moveTo(px, yb); x.lineTo(px + 1, yb + len); x.stroke(); x.strokeStyle = k % 2 ? '#e2c26a' : '#c9a24a'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, yb); x.lineTo(px + 1, yb + len); x.stroke(); } };
      mgWrap(W, dx => panel(dx, 72)); panel(W / 2, 80);
      x.fillStyle = SAND; x.fillRect(0, H * 0.8, W, H * 0.11); gold(x, () => { x.beginPath(); x.moveTo(0, H * 0.8 + 3); x.lineTo(W, H * 0.8 + 3); x.moveTo(0, H * 0.91 - 3); x.lineTo(W, H * 0.91 - 3); }, 2.4);
      const K = ['fogo', 'agua', 'terra', 'ar']; for (let k = 0; k < 16; k++) mgGlyph(x, (k + 0.5) / 16 * W, H * 0.855, 14, K[k % 4], GOLD); // barra com os quatro elementos em sequência
    }, { flipY: false, repeat: [1 / 3, 0.5] });
    const wool = mgMat(vestT), skirtM = mgMat(skirtT, { side: THREE.DoubleSide }), umbP = mgMat(mgPlain(UMB), { side: THREE.DoubleSide }), sandP = mgMat(mgPlain(SAND), { side: THREE.DoubleSide }), goldM = AM.gold('#c9a24a');
    const vest = mgTorso(root, 'sbV', wool);
    mgSkirt(root, skirtM, { hem: mgMat(mgPlain('#b8913e'), { side: THREE.DoubleSide, rough: 0.6 }), r1: 0.075, pleats: 12, pleatAmp: 0.03, seed: 2.1 });
    // filetes de ouro em relevo nas bordas do escapulário (frente e costas), por cima da túnica
    const V = vest.userData, tY = y => Math.max(0.02, Math.min(0.98, (y - V.A.y) / (V.u.y * V.len))), pv = bonePos(root, 'pelvis'), ex = 0.016 + 0.007 + 0.0015;
    const aF = FW / 1024 * Math.PI * 2, aB = BW / 1024 * Math.PI * 2; // largura dos painéis em ângulo (mesma escala da textura)
    for (const a of [aF - 0.035, -(aF - 0.035), Math.PI - (aB - 0.035), Math.PI + (aB - 0.035)]) strapOnShell(root, vest, goldM, [tY(pv.y + 0.12), a], [0.86, a], { extra: ex, w: 0.007, th: 0.004, n: 20 });
    mgSleeves(root, 'sbSl', umbP, sandP, { bell: 0.04, drape: 0.045, cuffW: 0.05, cuffT: 0.09, len: 0.84 });
    neckRoll(root, 'sbRoll', sandP, { roll: 0.017, gap0: 0.012, front: 0.75, flat: 0.55, wide: 1.2, wob: 0.06, crumple: 0.1, drop: 0.035, clear: 0.014, over: [[vest, 0.023]] }); // gola enrolada de lã crua
    { // CORDÃO de ouro velho trançado, nó do lado esquerdo e dois cordões com borlas
      const cordT = mgCanvas('sbCord', 128, 32, (x, W, H) => { x.fillStyle = '#a8843a'; x.fillRect(0, 0, W, H); for (let k = -8; k < 24; k++) { x.strokeStyle = k % 2 ? '#e2c272' : '#6a4e1a'; x.lineWidth = 3; x.beginPath(); x.moveTo(k * 8, 0); x.lineTo(k * 8 + 16, H); x.stroke(); } });
      const cord = new THREE.MeshStandardMaterial({ map: cordT, roughness: 0.55, metalness: 0.25 });
      const cg = mgBelt(root, 'sbCord', cord, { y0: 0.085, y1: 0.12, off: 0.06, th: 0.016, uvRep: 12 });
      const L = bonePos(root, 'upperarm_l').x > bonePos(root, 'upperarm_r').x ? 1 : -1, ka = L * 0.55, q = shellAt(cg, 0.5, ka, 0.06 + 0.016);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), cord); knot.scale.set(1.2, 1, 0.8); knot.position.copy(q.p).addScaledVector(q.n, 0.008); pinToBone(root, 'pelvis', knot);
      for (const [dx, len] of [[-0.012, 0.2], [0.014, 0.26]]) { const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), q.n).normalize(), p0 = q.p.clone().addScaledVector(q.n, 0.012).addScaledVector(side, dx);
        const pts = [p0, p0.clone().add(new THREE.Vector3(0, -len * 0.5, 0)).addScaledVector(q.n, 0.02), p0.clone().add(new THREE.Vector3(0, -len, 0)).addScaledVector(q.n, 0.03)];
        pinToBone(root, 'pelvis', new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0055, 8), cord));
        const prof = []; for (let k = 0; k <= 10; k++) { const t = k / 10; prof.push(new THREE.Vector2(0.006 + Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) * 0.012 + t * 0.004, -t * 0.06)); }
        const tas = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), cord); tas.position.copy(pts[2]); pinToBone(root, 'pelvis', tas); } }
  },
};
/* S-334/S-335/S-336: cristais místicos — gema de pontas arredondadas (perfil girado com muitos segmentos: sem facetas duras),
   levemente irregular, brilho iridescente com núcleo de luz e cor que passeia devagar por uma paleta */
function crystalGeo(r, h, opt = {}) {
  const pr = opt.pr ?? 0.38, n = 18, pts = []; // pr: altura das "pontas" (fração da altura)
  for (let i = 0; i <= n; i++) { const u = i / n, y = (u - 0.5) * h; let rr;
    if (u < pr) rr = r * Math.sin((u / pr) * Math.PI / 2) ** (opt.sharp ?? 0.7); else if (u > 1 - pr * (opt.top ?? 1)) { const v = (1 - u) / (pr * (opt.top ?? 1)); rr = r * Math.sin(v * Math.PI / 2) ** (opt.sharp ?? 0.7); } else rr = r;
    pts.push(new THREE.Vector2(Math.max(0.0005, rr), y)); }
  const g = new THREE.LatheGeometry(pts, opt.seg ?? 28), P = g.attributes.position, sd = opt.seed ?? 1;
  for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), a = Math.atan2(z, x), w = 1 + (opt.wob ?? 0.1) * Math.sin(a * 3 + sd) * Math.cos(y / h * 5 + sd * 2) + (opt.wob ?? 0.1) * 0.6 * Math.sin(a * 5 - sd); P.setXYZ(k, x * w, y, z * w); }
  g.computeVertexNormals(); return g;
}
function mysticMat(c, o = {}) { return new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: o.ei ?? 0.45, roughness: o.rough ?? 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: o.irid ?? 0.9, iridescenceIOR: 1.55, envMap: armorEnv(), envMapIntensity: o.env ?? 1.4, transparent: true, opacity: o.op ?? 0.86 }); }
const _mc = new THREE.Color(), _mc2 = new THREE.Color();
const GEM_EL = { agua: '#4aa8ff', fogo: '#ff6a2a', terra: '#d8a24a', vento: '#a8ffe0' }; // P-016: cor das gemas do Sábio por elemento da habilidade
function paletteAt(pal, t) { const n = pal.length, f = ((t % n) + n) % n, i = Math.floor(f); return _mc.set(pal[i]).lerp(_mc2.set(pal[(i + 1) % n]), f - i); }
function glowSpr(c, s, o = 0.5) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTex(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(s); return sp; }
/* cajado de verdade (S-220): madeira retorcida de ~1,5 m, garras de madeira segurando um cristal no topo (sem anéis) */
export function codeStaff(opt = {}) {
  const g = new THREE.Group(), H = opt.h || 1.5, T = opt.thick || 1, S = opt.head || 1, wood = new THREE.MeshStandardMaterial({ color: opt.wood || '#5a3a22', map: metalTex('couro'), roughness: 0.75 });
  const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(Math.sin(t * 9) * 0.008 * T, t * H, Math.cos(t * 7) * 0.008 * T)); }
  const shaft = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 1, 12, false), P = shaft.attributes.position, sc = new THREE.CatmullRomCurve3(pts);
  for (let k = 0; k < P.count; k++) { const i = Math.floor(k / 13), t = i / 48, c = sc.getPointAt(t), r = (0.016 + 0.006 * Math.sin(t * 40) * 0.3 + (t > 0.9 ? (t - 0.9) * 0.12 * S : 0) - t * 0.003) * T + (opt.knots && Math.abs(((t * 7) % 1) - 0.5) < 0.04 ? 0.004 * T : 0); const v = new THREE.Vector3(P.getX(k), P.getY(k), P.getZ(k)).sub(c); P.setXYZ(k, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
  shaft.computeVertexNormals(); g.add(new THREE.Mesh(shaft, wood));
  const NP = opt.prongs || 4, hy = H + 0.075 * S; // garras que seguram o cristal (o Arquimago tem mais garras, maiores e torcidas)
  for (let k = 0; k < NP; k++) { const a = k / NP * Math.PI * 2, cl = []; for (let j = 0; j <= 8; j++) { const t = j / 8, tw = (opt.twist || 0) * t, rr = (0.02 + Math.sin(t * Math.PI) * 0.045) * S * (T > 1 ? 1.08 : 1); cl.push(new THREE.Vector3(Math.cos(a + tw) * rr, H - 0.02 + t * 0.15 * S, Math.sin(a + tw) * rr)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cl), 16, 0.007 * T, 8, false), wood)); }
  if (opt.crystal) { // S-336 (Mago) / S-335 (Arquimago): cristal de verdade, brilhante e iridescente, com núcleo de luz e cor que passeia devagar
    const C = STAFF_CRYSTAL[opt.crystal], head = new THREE.Group(); head.position.y = hy; g.add(head);
    const gem = new THREE.Mesh(crystalGeo(C.r * S, C.h * S, { pr: C.pr, sharp: C.sharp, wob: C.wob, seed: 3 }), mysticMat(C.pal[0], { ei: C.ei, op: C.op })); head.add(gem);
    const core = glowSpr(C.core, C.r * S * 3.2, C.coreO); head.add(core);
    const shards = []; for (let k = 0; k < (C.shards || 0); k++) { const m = new THREE.Mesh(crystalGeo(0.011 * S, 0.034 * S, { pr: 0.45, sharp: 0.6, wob: 0.15, seed: k + 5 }), mysticMat(C.pal[k % C.pal.length], { ei: 0.8, op: 0.9 })); head.add(m); shards.push(m); }
    g.userData.tick = t => {
      const c = paletteAt(C.pal, t * C.speed); gem.material.color.copy(c); gem.material.emissive.copy(c); gem.material.emissiveIntensity = C.ei + Math.sin(t * 2.1) * 0.12;
      gem.rotation.y = t * 0.35; core.material.opacity = C.coreO * (0.8 + 0.2 * Math.sin(t * 3.1)); core.material.color.copy(c).lerp(_mc2.set('#ffffff'), C.coreMix ?? 0.45);
      shards.forEach((m, k) => { const a = t * 0.8 + k * Math.PI * 2 / shards.length; m.position.set(Math.cos(a) * 0.085 * S, Math.sin(t * 1.6 + k * 2) * 0.03 * S, Math.sin(a) * 0.085 * S); m.rotation.set(t * (0.9 + k * 0.3), t * 1.3 + k, 0.3); m.material.emissive.copy(paletteAt(C.pal, t * C.speed + k * 0.7)); m.material.color.copy(m.material.emissive); });
    };
  } else { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 2), new THREE.MeshStandardMaterial({ color: opt.gem || '#8ab8ff', emissive: opt.gem || '#8ab8ff', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })); gem.scale.y = 1.35; gem.position.y = hy; g.add(gem); }
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.019 * T, 0.019 * T, 0.16, 16), new THREE.MeshStandardMaterial({ color: '#3a2216', map: metalTex('couro'), roughness: 0.9 })); wrap.position.y = H * 0.58; g.add(wrap);
  for (const dy of [-0.085, 0.085]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02 * T, 0.0035, 8, 24), new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.7, roughness: 0.35 })); ring.rotation.x = Math.PI / 2; ring.position.y = H * 0.58 + dy; g.add(ring); } // anéis de metal nas pontas da empunhadura
  g.userData.gripY = H * 0.58; g.userData.headY = hy; g.userData.out = opt.out || 0; g.userData.fwd = opt.fwd || 0; return g;
}
const STAFF_CRYSTAL = {
  // Mago: cristal claro e simples, azul-gelo que passeia para lilás e água — brilhante, mas modesto
  mago: { r: 0.03, h: 0.095, pr: 0.42, sharp: 0.75, wob: 0.06, ei: 0.32, op: 0.8, pal: ['#3aa8ff', '#5ad0ff', '#7a7cff', '#2fd8c0'], speed: 0.12, core: '#9fdcff', coreO: 0.22, coreMix: 0.15, shards: 0 },
  // Arquimago: cristal maior e mais pontudo, violeta-profundo ↔ azul arcano ↔ magenta, com núcleo forte e 3 lascas que orbitam
  arqui: { r: 0.046, h: 0.16, pr: 0.4, sharp: 0.55, wob: 0.1, ei: 0.7, op: 0.85, pal: ['#9a5cff', '#5a7cff', '#d06aff', '#7a4cff'], speed: 0.16, core: '#f2e6ff', coreO: 0.8, shards: 3 },
};
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
  const S0 = rootPos(root, ua), sx = side === 'r' ? -1 : 1, tgt = new THREE.Vector3(S0.x + sx * (0.06 + (staff.userData.out || 0)), S0.y - L1 * (0.97 - (staff.userData.out || 0) * 0.35), S0.z + L2 * (0.82 + (staff.userData.fwd || 0))); // S-335: o Arquimago segura o cajado mais afastado do corpo
  // o punho medido no espaço do osso da mão (fixo): eixo do cabo (A), direção dos dedos (E) e centro (C)
  const hq = hand.getWorldQuaternion(new THREE.Quaternion()).invert(), rq = root.getWorldQuaternion(new THREE.Quaternion());
  const aH = F.A.clone().applyQuaternion(rq).applyQuaternion(hq).normalize(), eH = F.E.clone().applyQuaternion(rq).applyQuaternion(hq).normalize();
  const cH = hand.worldToLocal(root.localToWorld(F.C.clone().add(F.E.clone().multiplyScalar(-0.026)))); // o cabo no meio do punho (não rente aos nós dos dedos)
  const grip = Math.max(0.5, Math.min(staff.userData.gripY + 0.25, tgt.y - 0.03)); // pé do cajado rente ao chão (anão tem a mão mais baixa)
  const holder = new THREE.Group(); hand.add(holder);
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aH); holder.position.copy(cH);
  staff.position.y = -grip; holder.add(staff); staff.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.userData.items = root.userData.items || {}; root.userData.items['2H_Staff'] = staff;
  gripOn(root, side, 'cajado', holder, { axis: new THREE.Vector3(0, 1, 0), r: staff.userData.gripR || GRIPS.cajado.r }); // P-013
  const curl = () => fingerGrip(root, side);
  let w = 0, last = null;
  if (fx) fx.push(tt => {
    const now = performance.now(), dt = last === null || !(tt > last) ? 0.016 : Math.min(0.1, tt - last); last = tt;
    const an = ch && ch.anim ? ch.anim.name || '' : 'Idle'; void now; if (staff.userData.tick) staff.userData.tick(tt);
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
    { // S-401: o cajado DESLIZA pela mão até o pé encostar no chão (antes ficava preso numa altura fixa e terminava no joelho)
      holder.updateWorldMatrix(true, false); const hp = holder.getWorldPosition(_sgA), ax = _sgB.set(0, 1, 0).transformDirection(holder.matrixWorld), base = (ch && ch.obj ? ch.obj : root).getWorldPosition(_sgC).y;
      if (ax.y > 0.35) { const L = staff.userData.headY || 1.5, g = Math.max(L * 0.3, Math.min(L * 0.85, (hp.y - base - 0.005) / ax.y)); staff.position.y += (-g - staff.position.y) * Math.min(1, dt * 14); }
    }
  });
  return staff;
}
const _sgA = new THREE.Vector3(), _sgB = new THREE.Vector3(), _sgC = new THREE.Vector3();
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
  gripOn(root, side, 'livro', holder, { point: E.clone().multiplyScalar(0.012).applyQuaternion(q.clone().invert()), axis: new THREE.Vector3(0, 1, 0) }); // P-013: lombada dentro da mão
  if (fx) fx.push(() => fingerGrip(root, side));
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
function holdDagger(root, dagger, side = 'r', scale = 1.3) { // S-322: também na mão esquerda (duas adagas do Executor, adaga do Salteador)
  humanIdlePose(root); const S = '_' + side, hand = bone(root, 'hand' + S), kn = bone(root, 'middle_01' + S), at = kn ? rootPos(root, kn).lerp(rootPos(root, hand), 0.35) : rootPos(root, hand);
  const holder = new THREE.Group(); hand.add(holder);
  let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.25, 0, 0)); // lâmina para a frente, um pouco para cima (pegada firme, não "garra")
  // S-292: o cabo passa POR DENTRO do punho fechado (centro dos dedos dobrados), atravessado do mindinho para o indicador — não colado nos nós dos dedos
  const fb = ['index_02', 'middle_02', 'ring_02', 'pinky_02'].map(n => bone(root, n + S)).filter(Boolean), i1 = bone(root, 'index_01' + S), p1 = bone(root, 'pinky_01' + S);
  if (fb.length === 4 && i1 && p1) {
    const C = fb.reduce((s, b) => s.add(rootPos(root, b)), new THREE.Vector3()).multiplyScalar(0.25).lerp(rootPos(root, hand), 0.18), A = rootPos(root, i1).sub(rootPos(root, p1)).normalize();
    A.lerp(new THREE.Vector3(0, 0, 1), 0.25).normalize(); // um pouco para a frente
    q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A);
    fitToBone(root, hand, holder, q, C.add(A.clone().multiplyScalar(0.052 * 1.3)));
  } else fitToBone(root, hand, holder, q, at.add(new THREE.Vector3(-0.005, -0.012, 0.01)));
  dagger.scale.setScalar(scale); holder.add(dagger); dagger.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  gripOn(root, side, scale < 1.2 ? 'espada' : 'adaga', holder, { point: new THREE.Vector3(0, -0.052 * 1.3, 0), axis: new THREE.Vector3(0, 1, 0) }); // P-013: o cabo passa pelo centro do punho (sabre usa a pegada de espada)
  root.userData.items = root.userData.items || {}; root.userData.items[side === 'r' ? 'Knife' : 'Knife_Offhand'] = dagger; return dagger;
}
/* S-321: sabre curto do Salteador — lâmina levemente curva de um gume com contrafio, guarda em S, cabo de couro trançado e pomo.
   Mesmo espaço da adaga (y = para a ponta, origem na guarda, cabo para baixo) para usar o mesmo encaixe no punho. */
export function codeSabre(opt = {}) {
  const g = new THREE.Group(), steel = armorMat(opt.steel || '#cfd4dc'), dark = new THREE.MeshStandardMaterial({ color: '#2a1a10', map: metalTex('couro'), roughness: 0.85 }), brass = armorMat('#a88a46', 'ouro'), L = opt.len || 0.6;
  const sh = new THREE.Shape(); sh.moveTo(-0.019, 0); sh.lineTo(0.017, 0);
  sh.quadraticCurveTo(0.03, L * 0.55, 0.012, L * 0.93); sh.quadraticCurveTo(0.004, L, -0.006, L * 0.985); // costas curvas até a ponta
  sh.quadraticCurveTo(0.0, L * 0.86, -0.004, L * 0.78); sh.quadraticCurveTo(-0.012, L * 0.5, -0.019, 0); // fio com contrafio perto da ponta
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0035, bevelSegments: 2, curveSegments: 10 }), steel); blade.position.z = -0.001; g.add(blade);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.006, L * 0.6, 0.0065), armorMat('#9aa0aa')); fuller.position.set(0.004, L * 0.36, 0); g.add(fuller);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0055, 8, 20, Math.PI), brass); guard.rotation.z = Math.PI / 2; guard.scale.set(1, 1.6, 1); g.add(guard); // guarda em S
  const qu = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), brass); qu.position.set(0.045, 0, 0); g.add(qu); const qu2 = qu.clone(); qu2.position.x = -0.045; g.add(qu2);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0115, 0.12, 12), dark); grip.position.y = -0.065; g.add(grip);
  for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0128, 0.0018, 6, 14), dark); r.rotation.x = Math.PI / 2; r.position.y = -0.012 - k * 0.019; g.add(r); } // couro trançado
  const pm = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), brass); pm.scale.set(1, 0.8, 1); pm.position.y = -0.13; g.add(pm);
  return g;
}
/* ------- LINHA DO LADINO (S-321/S-322/S-323): mesma família (mercenários do Skyrim + Assassin's Creed), cada evolução com personalidade -------
   Gatuno (ladino): colete de couro justo em camadas, lenço no pescoço, cinto com bolsinhas e faixas nos antebraços, botas macias de pano/couro.
   Executor (lamina_sombria, conceito do Algoz): couro quase preto, gola alta, ombreira discreta, abas carmim longas na cintura — imponente e silencioso.
   Salteador (saqueador): casaco de couro, capuz CAÍDO nas costas, capa curta, cintos cruzados no peito e faixa vermelha na cintura. */
const clothMat = (color, rough = 0.92) => _am['c' + color] || (_am['c' + color] = new THREE.MeshStandardMaterial({ color, map: metalTex('couro'), roughness: rough, metalness: 0, side: THREE.DoubleSide }));
function rogueRecolor(root, body, legs, feet) {
  root.traverse(o => { if (!o.isSkinnedMesh || !/_(Body|Legs|Feet)/.test(o.name)) return; const c = /_Legs/.test(o.name) ? legs : /_Feet/.test(o.name) ? feet : body; if (!c) return; o.material = o.material.clone(); o.material.color = new THREE.Color('#ffffff').lerp(new THREE.Color(c), 0.82); });
}
function roundedBox(w, h, d, r = 0.012) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r, bevelEnabled: true, bevelThickness: r / 2, bevelSize: r / 2, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -(d - r) / 2); return g; }
// ponto da superfície do corpo (frente: sign = 1, costas: -1) numa altura/lado, para assentar peças sem flutuar
function bodySurf(root, bones, x, y, sign = 1, tol = 0.035) { let best = null; for (const q of sampleBody(root, bones, /_Body/)) if (Math.abs(q.x - x) < tol && Math.abs(q.y - y) < tol && (best === null || q.z * sign > best * sign)) best = q.z; return best; }
function beltPouches(root, leather, list) { // bolsinhas presas no cinto: [x relativo, frente/costas, w, h]
  const pv = bonePos(root, 'pelvis'), y = pv.y + 0.07;
  for (const [dx, side, w, h] of list) { const z = bodySurf(root, ['pelvis', 'spine_01'], pv.x + dx, y, side) ?? pv.z + side * 0.12; const m = new THREE.Mesh(roundedBox(w, h, 0.045), leather); m.position.set(pv.x + dx, y - h * 0.25, z + side * 0.05); m.rotation.y = side < 0 ? Math.PI : 0; m.rotation.y += -dx * 1.6 * side; pinToBone(root, 'pelvis', m);
    const flap = new THREE.Mesh(roundedBox(w * 1.04, h * 0.42, 0.012, 0.005), leather); flap.position.copy(m.position).add(new THREE.Vector3(0, h * 0.28, side * 0.022)); flap.rotation.copy(m.rotation); pinToBone(root, 'pelvis', flap); }
}
function sheathOnBelt(root, leather, brass, dx, side = -1, tilt = 0.5) { // bainha de adaga atravessada atrás (ou na frente) do cinto
  const pv = bonePos(root, 'pelvis'), y = pv.y + 0.06, z = bodySurf(root, ['pelvis', 'spine_01'], pv.x + dx, y, side) ?? pv.z + side * 0.12;
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.009, 0.24, 10), leather); sh.scale.set(1.6, 1, 0.7); sh.position.set(pv.x + dx, y - 0.04, z + side * 0.04); sh.rotation.z = tilt; pinToBone(root, 'pelvis', sh);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 10), AM.leather('#241812')); hilt.position.copy(sh.position).add(new THREE.Vector3(Math.sin(tilt) * -0.16, Math.cos(tilt) * 0.16, 0)); hilt.rotation.z = tilt; pinToBone(root, 'pelvis', hilt);
  const pm = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), brass); pm.position.copy(hilt.position).add(new THREE.Vector3(Math.sin(tilt) * -0.05, Math.cos(tilt) * 0.05, 0)); pinToBone(root, 'pelvis', pm);
}
function chestStrap(root, mat, from, to, side = 1, r = 0.013, lift = 0.03) { // correia/cinto que cruza o peito (side 1) ou as costas (-1), assentada na superfície
  const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10, x = from[0] + (to[0] - from[0]) * t, y = from[1] + (to[1] - from[1]) * t, z = bodySurf(root, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'pelvis'], x, y, side, 0.04); if (z !== null) pts.push(new THREE.Vector3(x, y, z + side * lift)); }
  if (pts.length < 3) return; const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6);
  pinToBone(root, 'spine_02', new THREE.Mesh(g, mat));
}
function bracerOn(root, mat, s) { // braçadeira de couro justa no antebraço (sem o funil de manopla)
  const la = bonePos(root, 'lowerarm_' + s), hd = bonePos(root, 'hand_' + s);
  shellOn(root, 'brc' + s, ['lowerarm_' + s], /_(Body|Arms)/, la, hd, { t0: 0.3, t1: 0.88, bins: 6, off: 0.012, th: 0.008, ridge: (t) => (t < 0.08 || t > 0.92 ? 0.003 : 0) }, mat, 'lowerarm_' + s);
}
function sleeveOn(root, mat, s) { // manga de pano por cima da manga da roupa base (que tem cor própria e não dá para tingir sem tingir a mão)
  const ua = bonePos(root, 'upperarm_' + s), la = bonePos(root, 'lowerarm_' + s), hd = bonePos(root, 'hand_' + s);
  shellOn(root, 'slvU' + s, ['upperarm_' + s, 'clavicle_' + s], /_(Body|Arms)/, ua, la, { t0: -0.22, t1: 1.0, bins: 10, off: 0.008, th: 0.005 }, mat, 'upperarm_' + s);
  shellOn(root, 'slvL' + s, ['lowerarm_' + s], /_(Body|Arms)/, la, hd, { t0: -0.05, t1: 0.7, bins: 6, off: 0.005, th: 0.005 }, mat, 'lowerarm_' + s);
}
// colete/gibão de couro LISO moldado no tronco (sem lâminas — couro não é placa); open = aberto na frente mostrando a camisa
function vestOn(root, key, mat, o = {}) {
  const sp1 = bonePos(root, 'spine_01'), nk = bonePos(root, 'neck_01');
  // o.hips: a barra desce até o quadril (mede também a pélvis e a calça — S-367: cobre a fralda da camisa base, sem pedaços soltos abaixo do cinto)
  // o.tight: justo ao corpo (S-376/S-378) — a suavização não estufa a cintura; o.hipBones: quais ossos medem a barra (sem as coxas, a barra não abre em saia)
  const g = shellOn(root, key, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'].concat(o.hips ? (o.hipBones || ['pelvis', 'thigh_l', 'thigh_r']) : []), o.hips ? /_(Body|Legs)/ : /_Body/, AV3(sp1, 0, o.low ?? -0.07, 0), AV3(nk, 0, -0.035, 0),
    { t0: 0, t1: 1, bins: o.hips ? 18 : 14, sec: 44, off: o.off ?? 0.014, th: 0.007, smooth: o.smooth ?? 6, tight: !!o.tight, uvRep: 2, arc: o.open ? [o.open, Math.PI * 2 - o.open] : undefined, flare: o.flare || ((t) => (t < 0.12 ? (0.12 - t) * 0.05 : 0)) }, mat, 'spine_02');
  return g;
}
// lenço/gola JUSTO em volta do pescoço (não um disco no peito); tip = ponta do lenço caindo na frente (bandana do gatuno)
function neckScarf(root, key, mat, o = {}) {
  const nk = bonePos(root, 'neck_01'), hd = bonePos(root, 'Head') || AV3(nk, 0, 0.12, 0);
  shellOn(root, key, o.bones || ['neck_01', 'spine_03'], o.re || /_Body/, AV3(nk, 0, o.low ?? -0.06, 0), AV3(hd, 0, 0, 0), { t0: 0.05, t1: o.high ?? 0.55, bins: 5, sec: 32, off: o.off ?? 0.022, th: 0.016, smooth: 4, flare: (t) => (1 - t) * (o.puff ?? 0.035) }, mat, 'neck_01');
  if (o.tip) { const z = bodySurf(root, ['spine_03', 'neck_01'], nk.x, nk.y - 0.08, 1) ?? nk.z + 0.08; const sh = new THREE.Shape(); sh.moveTo(-0.07, 0); sh.quadraticCurveTo(0, 0.01, 0.07, 0); sh.quadraticCurveTo(0.02, -0.07, 0, -0.13); sh.quadraticCurveTo(-0.02, -0.07, -0.07, 0);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }), mat); m.position.set(nk.x, nk.y - 0.045, z + 0.018); m.rotation.x = -0.25; pinToBone(root, 'spine_03', m); }
}
/* ===== S-343/S-344/S-345: ROUPA COMPLETA (não "acessórios grudados por cima do boneco") =====
   costumeBase: a roupa base vira o FORRO do traje — a mesma malha (as dobras e pregas ficam, pela luminância do mapa original),
   mas com o tecido/couro e a cor do traje; cinto/ombreira/braçadeira da roupa base somem; as mãos continuam de pele.
   As peças principais (gibão, casaco, túnica, botas) vêm por cima, moldadas no corpo e presas aos ossos. */
const _fab = {};
function fabricTex(kind) {
  if (_fab[kind]) return _fab[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let s = 13; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, 256, 256);
  if (kind === 'linho' || kind === 'veludo') { // trama de fios (veludo: trama fechada + manchas macias de pelo deitado)
    for (let k = 0; k < 256; k += 2) { x.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.07})`; x.fillRect(0, k, 256, 1); x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.07})`; x.fillRect(k, 0, 1, 256); }
    if (kind === 'veludo') for (let k = 0; k < 70; k++) { const cx = r() * 256, cy = r() * 256, rr = 8 + r() * 26, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.06})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
  } else { // camurça/couro curtido: poros e manchas suaves
    for (let k = 0; k < 3200; k++) { const v = r() < 0.5 ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},0.05)`; x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
    for (let k = 0; k < 45; k++) { const cx = r() * 256, cy = r() * 256, rr = 10 + r() * 34, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, `rgba(0,0,0,${0.05 + r() * 0.06})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return (_fab[kind] = t);
}
function costumeBase(root, spec) {
  root.traverse(o => { if (o.isSkinnedMesh && /Acc_|_Bracer|_Belt|Pauldron/.test(o.name)) o.visible = false; });
  root.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible || !/_(Body|Arms|Legs|Feet)/.test(o.name) || /Acc_/.test(o.name)) return;
    const part = /_Arms/.test(o.name) ? 'arms' : /_Legs/.test(o.name) ? 'legs' : /_Feet/.test(o.name) ? 'feet' : 'body', sp = spec[part]; if (!sp) return;
    const hands = part === 'arms' && !!o.skeleton; if (hands) handMask(o);
    const m = o.material = o.material.clone(); m.roughness = sp.rough ?? 0.86; m.metalness = 0;
    if (!m.map) { m.color = new THREE.Color(sp.color); return; }
    m.color.set('#ffffff'); const tint = new THREE.Color(sp.color), det = fabricTex(sp.tex || 'linho'), rep = (sp.rep ?? 9).toFixed(1);
    m.onBeforeCompile = sh => {
      sh.uniforms.uTint = { value: tint }; sh.uniforms.uDet = { value: det };
      if (hands) sh.vertexShader = 'attribute float aHand;\nvarying float vHand;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHand = aHand;');
      sh.fragmentShader = 'uniform vec3 uTint;\nuniform sampler2D uDet;\n' + (hands ? 'varying float vHand;\n' : '') + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
{ float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); float dd = texture2D(uDet, vMapUv * ${rep}).g;
  vec3 cc = uTint * (0.55 + lum * 0.95) * (0.8 + dd * 0.32);
  ${hands ? 'diffuseColor.rgb = mix(cc, diffuseColor.rgb, vHand);' : 'diffuseColor.rgb = cc;'} }`);
    };
    m.customProgramCacheKey = () => 'cos' + part + sp.color + (sp.tex || '') + rep + (hands ? 'h' : '');
  });
}
// cano de bota macia: do joelho ao tornozelo, com dobra na boca (cuff) e, opcional, tiras cruzadas (botas de rastreio)
function bootShaft(root, key, s, mat, o = {}) {
  const kn = bonePos(root, 'calf_' + s), an = bonePos(root, 'foot_' + s); if (!kn || !an) return;
  shellOn(root, key + s, ['calf_' + s], /_(Legs|Feet)/, kn, an, { t0: o.t0 ?? 0.06, t1: 1.02, bins: 10, sec: 26, off: o.off ?? 0.012, th: 0.008, smooth: 4, uvRep: 2,
    flare: t => (t < 0.12 ? (0.12 - t) * (o.cuff ?? 0.16) : 0) + (t > 0.9 ? (t - 0.9) * 0.05 : 0), ridge: o.straps ? (t, a) => (t > 0.25 && t < 0.88 && Math.sin((t * 5 + a / Math.PI) * Math.PI * 2) > 0.72 ? 0.004 : 0) : undefined }, mat, 'calf_' + s);
}
// abas de casaco/túnica que seguem as pernas: painéis em volta do quadril (ângulo 0 = frente), com fendas entre eles
function coatPanels(root, mat, hem, panels, o = {}) {
  const pv = bonePos(root, 'pelvis'), knee = bonePos(root, 'calf_l'), hs = hipSize(root, pv.y + 0.04);
  const bot = o.toKnee ? knee.y + (o.kneeOff ?? 0.04) : Math.max(knee.y + 0.06, pv.y - (o.len ?? 0.3));
  const gap = o.gap ?? 0.05, sz = Math.min(1, Math.max(0.75, (hs.rz + gap) / (hs.rx + gap))); // S-366/S-369: o achatamento acompanha a folga pedida (justo de frente e de lado)
  const rad = o.legFit ? legRadii(root) : null; // S-375: abas justas — a perna empurra o pano pela medida REAL da coxa (não pelo raio genérico de 12,5 cm, que abria a saia)
  for (const [a0, al] of panels) clothSkirt(root, gownGeo(root, { top: pv.y + (o.top ?? 0.05), bot, r0: hs.rx + gap, r1: o.r1 ?? 0.06, arc: [a0, al], seg: 18, pleats: o.pleats ?? 3, pleatAmp: o.pleatAmp ?? 0.008, sz, seed: a0 + 3, hemRows: 1 }), hem ? [mat, hem] : mat, o.margin ?? 0.05, rad);
}
// raios da perna medidos no corpo (coxa no alto, joelho) — humano, elfo e anão
function legRadii(root) {
  return wrapCached(root, 'legRad', () => {
    const th = bonePos(root, 'thigh_l'), ca = bonePos(root, 'calf_l'); if (!th || !ca) return null;
    const u = ca.clone().sub(th), L = u.length(); u.normalize(); const top = [], knee = [];
    for (const q of sampleBody(root, ['thigh_l', 'calf_l'], /_(Legs|Body)/)) { if (q.acc) continue; const d = q.clone().sub(th), t = d.dot(u) / L, r = d.addScaledVector(u, -t * L).length(); if (t > 0.12 && t < 0.4) top.push(r); else if (t > 0.88 && t < 1.08) knee.push(r); }
    const p90 = a => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.9)] : null; };
    const rt = Math.min(0.125, Math.max(0.07, p90(top) ?? 0.09)), rk = Math.min(0.075, Math.max(0.05, p90(knee) ?? 0.06));
    return [rt, rk, 0.055, 0.045];
  });
}
// S-348/S-350: ponto (e normal) na superfície de uma casca feita por wrapShell — t ao longo do eixo da peça (t0..t1), a = ângulo (0 = frente).
// Serve para assentar correias, debruns e fechos EXATAMENTE sobre o colete/gibão (nem flutuando, nem atravessando)
function shellAt(g, t, a, extra = 0) {
  const U = g.userData, f = Math.max(0, Math.min(U.bins, (t - U.t0) / (U.t1 - U.t0) * U.bins)), i0 = Math.floor(f), i1 = Math.min(U.bins, i0 + 1), w = f - i0;
  const fj = ((a / (Math.PI * 2)) * U.sec % U.sec + U.sec) % U.sec, j0 = Math.floor(fj), j1 = (j0 + 1) % U.sec, wj = fj - j0;
  const rr = i => U.R[i][j0] * (1 - wj) + U.R[i][j1] * wj, r = rr(i0) * (1 - w) + rr(i1) * w + extra;
  const cx = U.C[i0][0] * (1 - w) + U.C[i1][0] * w, cy = U.C[i0][1] * (1 - w) + U.C[i1][1] * w, n = U.e1.clone().multiplyScalar(Math.cos(a)).add(U.e2.clone().multiplyScalar(Math.sin(a)));
  return { p: U.A.clone().add(U.u.clone().multiplyScalar(t * U.len)).add(U.e1.clone().multiplyScalar(cx)).add(U.e2.clone().multiplyScalar(cy)).addScaledVector(n, r), n };
}
// fita chata (correia, debrum) ao longo de pontos com a normal de fora de cada um — seção arredondada, nada de "vareta"
function ribbonGeo(pts, nrm, w, th = 0.006) {
  const pos = [], uv = [], idx = [], n = pts.length, s = new THREE.Vector3(), tg = new THREE.Vector3();
  for (let k = 0; k < n; k++) { tg.copy(pts[Math.min(n - 1, k + 1)]).sub(pts[Math.max(0, k - 1)]).normalize(); s.crossVectors(tg, nrm[k]).normalize().multiplyScalar(w / 2); const h = nrm[k].clone().multiplyScalar(th / 2);
    for (const [a, b, c] of [[1, 1, 0], [-1, 1, 0.25], [-1, -1, 0.5], [1, -1, 0.75]]) { const q = pts[k].clone().addScaledVector(s, a * (b > 0 ? 0.92 : 1)).addScaledVector(h, b); pos.push(q.x, q.y, q.z); uv.push(k / Math.max(1, n - 1) * 3, c); } }
  for (let k = 0; k < n - 1; k++) for (let f = 0; f < 4; f++) { const a = k * 4 + f, b = k * 4 + (f + 1) % 4; idx.push(a, a + 4, b, b, a + 4, b + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// correia/debrum assentado na casca g, de from [t, a] até to [t, a]
function strapOnShell(root, g, mat, from, to, o = {}) {
  const N = o.n || 18, pts = [], nrm = [];
  for (let k = 0; k <= N; k++) { const f = k / N, t = from[0] + (to[0] - from[0]) * f, a = from[1] + (to[1] - from[1]) * f, q = shellAt(g, t, a, typeof o.extra === 'function' ? o.extra(t, a) : (o.extra ?? 0.03)); pts.push(q.p); nrm.push(q.n); }
  const m = pinToBone(root, o.pin || 'spine_02', new THREE.Mesh(ribbonGeo(pts, nrm, o.w ?? 0.03, o.th ?? 0.006), mat)); m.userData.pts = pts; m.userData.nrm = nrm; return m;
}
// fivela pequena deitada sobre a correia (ponto p, normal n, direção da correia d)
function strapBuckle(root, mat, p, n, d, sc = 0.6, pin = 'spine_02') {
  const m = new THREE.Mesh(buckleGeo('simples'), mat); m.scale.setScalar(sc); const x = d.clone().normalize(), z = n.clone().normalize(), y = new THREE.Vector3().crossVectors(z, x).normalize(); x.crossVectors(y, z);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); m.position.copy(p).addScaledVector(z, 0.003); return pinToBone(root, pin, m);
}
/* S-348: capuz CAÍDO de pano de verdade — a boca do capuz vira um rolo mole em volta da base do pescoço e o "saco" do capuz
   deita nas costas como uma almofada de pano: contorno em U, volume no meio, dobras macias que descem para a ponta, borda arredondada
   (as duas camadas do pano se encontram na costura). Medido no corpo de cada raça (anão incluso) e preso à espinha. */
function fallenHood(root, mat, o = {}) {
  const nk = bonePos(root, 'neck_01'), hd = bonePos(root, 'Head') || AV3(nk, 0, 0.14, 0), s3 = bonePos(root, 'spine_03'), uaL = bonePos(root, 'upperarm_l'), uaR = bonePos(root, 'upperarm_r');
  if (!nk || !s3 || !uaL || !uaR) return;
  // 1) boca do capuz: rolo de pano frouxo e grosso em volta da base do pescoço (mais baixo na frente, mais cheio atrás), com pregas
  // S-375: a boca do capuz é uma DOBRA de pano deitada sobre os ombros (achatada, com pregas, mais baixa na frente) — não uma boia redonda em volta do pescoço
  neckRoll(root, 'hoodRoll5' + (o.k || '') + (o.on ? 'c' : ''), mat, { roll: 0.024, gap0: 0.012, front: 0.8, flat: 0.5, wide: 1.3, wob: 0.07, crumple: 0.14, drop: 0.045, clear: 0.016, over: o.on ? [[o.on, o.onEx ?? 0.03]] : [] });
  hoodBag(root, mat, o);
}
// rolo grosso e macio em volta da base do pescoço (boca de capuz caído, gola de pele): assenta no corpo medido em cada direção
function neckRoll(root, key, mat, o = {}) {
  const nk = bonePos(root, 'neck_01'); if (!nk) return null;
  const roll = wrapCached(root, key, () => {
    const pts = sampleBody(root, ['neck_01', 'spine_03', 'clavicle_l', 'clavicle_r'], /_Body|SuperHero/).filter(p => !p.acc), N = 56, M = 18, base = []; // o pescoço é da malha do corpo de pele
    // justo no PESCOÇO (raio medido só nos pontos do pescoço) e APOIADO no trapézio/peito: em cada direção o rolo desce até encostar no corpo, nunca afunda nem vira um aro largo
    const neck = sampleBody(root, ['neck_01'], /_Body|SuperHero/).filter(p => !p.acc), torso = sampleBody(root, ['spine_03', 'clavicle_l', 'clavicle_r'], /_Body|SuperHero/).filter(p => !p.acc && p.y < nk.y + 0.04), rOf = (a) => (o.roll ?? 0.026) * ((o.front ?? 0.62) + (1.12 - (o.front ?? 0.62)) * Math.max(0, -Math.cos(a))) * (1 + (o.wob ?? 0.1) * Math.sin(a * 7 + 0.4));
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a), r = rOf(a); let R0 = 0;
      for (const q of neck) { if (Math.abs(q.y - nk.y) > 0.035) continue; const vx = q.x - nk.x, vz = q.z - nk.z, d = vx * dx + vz * dz; if (Math.abs(vx * dz - vz * dx) < 0.02 && d > R0) R0 = d; }
      const rad = (R0 || 0.06) + (o.gap0 ?? 0.014) + r * 0.85; let top = -1e9;
      for (const q of torso) { const vx = q.x - nk.x, vz = q.z - nk.z, d = vx * dx + vz * dz; if (d > rad - r * 1.1 && d < rad + r * 1.1 && Math.abs(vx * dz - vz * dx) < 0.03 && q.y > top) top = q.y; }
      let R = rad, Y = Math.min(nk.y + 0.045, Math.max(nk.y + (o.y ?? -0.02) - Math.max(0, dz) * (o.drop ?? 0.03), top + (o.clear ?? 0.022) + r * 0.7));
      for (const [g, ex] of o.over || []) { const q = shellAt(g, g.userData.t1, a, ex), d = (q.p.x - nk.x) * dx + (q.p.z - nk.z) * dz; R = Math.min(rad + 0.03, Math.max(R, d - r * 0.9)); Y = Math.max(Y, q.p.y + r * 0.55); } // apoiado na borda de cima da peça de baixo (gola do casaco, manto), sem abrir num aro largo
      base.push([R, Y]); }
    for (let pass = 0; pass < 5; pass++) { const b2 = base.map(b => b.slice()); for (let k = 0; k < N; k++) for (const c of [0, 1]) b2[k][c] = (base[(k + N - 1) % N][c] + base[k][c] * 2 + base[(k + 1) % N][c]) / 4; for (let k = 0; k < N; k++) base[k] = b2[k]; }
    const pos = [], idx = [], uv = [];
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), r = rOf(a);
      const c = new THREE.Vector3(nk.x, base[k][1], nk.z).addScaledVector(n, base[k][0]);
      for (let j = 0; j < M; j++) { const th = j / M * Math.PI * 2, rr = r * (1 + (o.crumple ?? 0.08) * Math.sin(th * 3 + a * 9)), q = c.clone().addScaledVector(n, Math.cos(th) * rr * (o.wide ?? 1)).add(new THREE.Vector3(0, Math.sin(th) * rr * (o.flat ?? 0.78), 0)); pos.push(q.x, q.y, q.z); uv.push(k / N * 6, j / M); } } // o.flat/o.wide: dobra de pano deitada (achatada), não uma boia
    for (let k = 0; k < N; k++) for (let j = 0; j < M; j++) { const k2 = (k + 1) % N, j2 = (j + 1) % M, a = k * M + j, b = k2 * M + j, c = k * M + j2, d = k2 * M + j2; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo; });
  return pinToBone(root, 'spine_03', new THREE.Mesh(roll, mat));
}
// o saco do capuz deitado nas costas (do tamanho de uma cabeça: igual em todas as raças)
function hoodBag(root, mat, o = {}) {
  const nk = bonePos(root, 'neck_01'), s3 = bonePos(root, 'spine_03'), uaL = bonePos(root, 'upperarm_l'), uaR = bonePos(root, 'upperarm_r');
  const g = wrapCached(root, 'hoodBag4' + (o.k || '') + (o.on ? 'c' : ''), () => {
    const pts = sampleBody(root, ['spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'], /_Body/).filter(p => !p.acc && p.z < s3.z + 0.02);
    const zAt = (x, y) => { for (const tol of [0.022, 0.04, 0.07]) { let m = null; for (const q of pts) if (Math.abs(q.x - x) < tol && Math.abs(q.y - y) < tol && (m === null || q.z < m)) m = q.z; if (m !== null) return m; } return s3.z - 0.12; };
    // S-366: o capuz caído é PANO DEITADO, não uma bolsa: largo em cima (entre as omoplatas), achatado, afinando até a ponta do capuz,
    // com a costura do meio marcada e dobras macias em diagonal — e assentado POR CIMA do boldrié (nada atravessando)
    const W0 = Math.min(0.15, Math.abs(uaL.x - uaR.x) * 0.41), HH = o.len ?? 0.24, top = nk.y - 0.016, NU = 18, NV = 16, cx = nk.x, gap = o.gap ?? 0.046;
    const half = v => v < 0.16 ? W0 * (0.72 + 0.28 * Math.sin(v / 0.16 * Math.PI / 2)) : W0 * Math.pow(Math.max(0, 1 - (v - 0.16) / 0.84), 0.85) * (1 + 0.08 * Math.sin((v - 0.16) / 0.84 * Math.PI)); // nasce sob o rolo da gola e cai em triângulo até a ponta do capuz
    const Z = []; for (let i = 0; i <= NV; i++) { const v = i / NV, row = []; for (let j = 0; j <= NU; j++) row.push(zAt(cx + (j / NU * 2 - 1) * half(v), top - v * HH)); Z.push(row); }
    for (let pass = 0; pass < 4; pass++) { const N2 = Z.map(r => r.slice()); for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) { const nb = [Z[i][j], Z[Math.max(0, i - 1)][j], Z[Math.min(NV, i + 1)][j], Z[i][Math.max(0, j - 1)], Z[i][Math.min(NU, j + 1)]]; N2[i][j] = Math.min(Z[i][j], nb.reduce((s, x) => s + x, 0) / 5); } for (let i = 0; i <= NV; i++) Z[i] = N2[i]; }
    const pos = [], uv = [], idx = [], at = (i, j, outer) => { const v = i / NV, u = j / NU * 2 - 1, y = top - v * HH, x = cx + u * half(v), e = Math.max(0, 1 - u * u), au = Math.abs(u);
      const bulge = outer ? (0.003 + 0.015 * Math.pow(e, 0.6) * Math.sin(Math.PI * Math.min(1, 0.12 + v * 1.05))) * (1 - Math.pow(v, 6)) // pano achatado: fino sob a gola, um pouco de volume no meio
        - 0.0045 * Math.exp(-((u / 0.07) ** 2)) * Math.sin(Math.PI * Math.min(1, v * 1.05)) // costura do meio do capuz
        + 0.005 * Math.sin(Math.atan2(au * half(v) / W0, v + 0.3) * 9) * Math.min(1, v * 2.2) * Math.pow(e, 0.7) : 0; // dobras macias que se abrem da gola para a ponta
      if (o.on) { const U = o.on.userData, t = ((y - U.A.y) / U.u.y) / U.len, ax = U.A.clone().addScaledVector(U.u, t * U.len), rb = Math.max(0.08, shellAt(o.on, t, Math.PI, 0).p.distanceTo(ax)); // assentado no casaco (medida exata da peça de baixo)
        const q = shellAt(o.on, t, Math.PI + u * half(v) / rb, (o.onEx ?? 0.03) + (o.over ?? 0.012) + Math.max(0, bulge)); return [q.p.x, q.p.y, q.p.z]; }
      return [x, y, Z[i][j] - gap - bulge + v * v * 0.012]; };
    const W = NU + 1, base2 = (NV + 1) * W;
    for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) { const q = at(i, j, true); pos.push(...q); uv.push(j / NU * 2, i / NV * 2); }
    const inner = []; for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) { if (j === 0 || j === NU || i === NV) { inner.push(i * W + j); continue; } const q = at(i, j, false); pos.push(...q); uv.push(j / NU * 2, i / NV * 2); inner.push(pos.length / 3 - 1); }
    for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); const A2 = inner[a], B2 = inner[b], C2 = inner[c], D2 = inner[d]; idx.push(A2, C2, B2, B2, C2, D2); }
    // borda de cima (sob o rolo da gola): fecha as duas camadas
    for (let j = 0; j < NU; j++) { const a = j, b = j + 1, c = inner[j], d = inner[j + 1]; idx.push(a, c, b, b, c, d); }
    void base2; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  });
  pinToBone(root, 'spine_03', new THREE.Mesh(g, mat));
}
const ROGUE_BUILD = {
  gatuno(root) {
    rogueRecolor(root, '#3b3a30', '#2c2620', '#4a3a2a');
    const leather = AM.leather('#5a3a24'), dark = AM.leather('#2e2018'), scarf = clothMat('#7a2a22'), brass = AM.gold('#9a7a42');
    // S-350: colete de couro FECHADO na frente (o verde da camisa só nos braços), simétrico, cobrindo o ombro inteiro
    // S-367: o colete desce até o quadril (por baixo do cinto) — cobre a fralda da camisa base, que antes sobrava abaixo do cinto em pedaços,
    // e ganha barra com debrum de couro escuro (acabamento limpo, frente e costas)
    humanIdlePose(root); root.updateMatrixWorld(true); // medidas na pose parada (a mesma do cinto)
    const sp1G = bonePos(root, 'spine_01'), pvG = bonePos(root, 'pelvis'), nkG = bonePos(root, 'neck_01'), lowG = -(sp1G.y - pvG.y) - 0.015, flG = (t) => (t < 0.08 ? (0.08 - t) * 0.07 : 0);
    const VO = 0.007, vg = vestOn(root, 'vestG4', leather, { off: VO, low: lowG, hips: true, hipBones: ['pelvis'], tight: true, smooth: 4, flare: flG }).geometry, ex = VO + 0.007; // S-378: colado ao corpo (folga mínima, barra medida só na pélvis — sem abrir em saia sobre as coxas)
    const L0 = (nkG.y - 0.035) - (sp1G.y - 0.07), L1 = (nkG.y - 0.035) - (sp1G.y + lowG), tG = t => 1 - (1 - t) * L0 / L1; // mesmas alturas de antes para as tiras
    costumeBase(root, { body: { color: '#4a3222', tex: 'camurca' } }); // o tronco da roupa base (ombros inclusos) vira o forro de camurça do colete: nada de verde em cima dos ombros; os braços continuam verdes
    strapOnShell(root, vg, dark, [0.03, 0], [0.985, 0], { extra: (t) => ex + 0.001 + flG(t), w: 0.016, th: 0.005, n: 24 }); // costura/placa central do fecho
    strapOnShell(root, vg, dark, [0.022, -Math.PI], [0.022, Math.PI], { extra: ex + flG(0.022) + 0.002, w: 0.024, th: 0.006, n: 72 }); // debrum da barra
    for (const t of [0.74, 0.52, 0.3].map(tG)) { const st = strapOnShell(root, vg, dark, [t, -0.24], [t, 0.24], { extra: ex + 0.003, w: 0.022, th: 0.006, n: 10 }), P = st.userData.pts, N = st.userData.nrm; // três tiras com fivela fechando o colete
      strapBuckle(root, brass, P[5], N[5], P[6].clone().sub(P[4]), 0.5); }
    neckScarf(root, 'scarfG10', scarf, { high: 0.52, puff: 0.008, off: 0.022, low: 0.012, bones: ['neck_01'], re: /_Body|SuperHero/ });  // lenço justo no pescoço, simétrico (sem a ponta torta e sem aba nas costas)
    beltSet(root, dark, brass, 'simples', null, { off: 0.026 }); beltPouches(root, dark, [[0.11, 1, 0.07, 0.07], [-0.13, 1, 0.06, 0.06], [0.14, -1, 0.08, 0.075]]); // cinto justo sobre o colete colado
    sheathOnBelt(root, dark, brass, -0.05, -1, 1.2);                       // adaga reserva atravessada nas costas
    fallenHood(root, clothMat('#38322f', 0.95), { k: 'G', on: vg, onEx: ex, over: 0.01, len: 0.22 }); // S-377: todo ladino tem o capuz CAÍDO nas costas, junto à roupa (nunca na cabeça)
    for (const s of ['l', 'r']) bracerOn(root, dark, s);                   // faixas de couro nos antebraços
  },
  algoz(root, fx) {
    // S-349: traje inteiro (a roupa base vira o forro escuro: sem o verde no anão e sem as peças da roupa base furando o colete)
    costumeBase(root, { body: { color: '#1e1b22', tex: 'linho' }, arms: { color: '#1c1a21', tex: 'linho' }, legs: { color: '#16141a', tex: 'linho' }, feet: { color: '#1e1a1c', tex: 'camurca', rough: 0.72 } });
    const leather = AM.leather('#2a2228'), steel = AM.steel('#858d99', { metal: 0.86, rough: 0.34, env: 1.05 }), crimson = '#5a1824', brass = AM.gold('#8a7a5a'); // S-376: aço levemente mais escuro (menos prateado)
    const VO = 0.009, ve = vestOn(root, 'vestE3', leather, { off: VO, tight: true, smooth: 4 }).geometry, ex = VO + 0.007;   // couraça de couro escuro, lisa e JUSTA ao corpo (S-376: sem o formato de trapézio folgado)
    { const trim = AM.leatherCloth('#141116'); // acabamento: costura central e debrum na barra (frente e costas), em couro mais escuro
      strapOnShell(root, ve, trim, [0.03, 0], [0.97, 0], { extra: ex + 0.001, w: 0.012, th: 0.004, n: 20 });
      strapOnShell(root, ve, trim, [0.97, Math.PI], [0.03, Math.PI], { extra: ex + 0.001, w: 0.012, th: 0.004, n: 20 });
      strapOnShell(root, ve, trim, [0.035, -Math.PI], [0.035, Math.PI], { extra: ex + 0.004, w: 0.02, th: 0.006, n: 64 });
      // S-376: costas lapidadas — pala (canesu) de couro entre as omoplatas e costuras em V descendo até a cintura, com um losango carmim no alto das costas
      strapOnShell(root, ve, trim, [0.8, Math.PI - 1.15], [0.8, Math.PI + 1.15], { extra: ex + 0.002, w: 0.016, th: 0.005, n: 30 });
      for (const s of [1, -1]) strapOnShell(root, ve, trim, [0.8, Math.PI + s * 0.95], [0.16, Math.PI + s * 0.12], { extra: ex + 0.002, w: 0.012, th: 0.004, n: 20 });
      { const q = shellAt(ve, 0.66, Math.PI, ex + 0.004), sh = new THREE.Shape(); sh.moveTo(0, 0.05); sh.lineTo(0.032, 0); sh.lineTo(0, -0.05); sh.lineTo(-0.032, 0); sh.closePath();
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 2 }), clothMat(crimson)); m.position.copy(q.p); m.lookAt(q.p.clone().add(q.n)); pinToBone(root, 'spine_02', m); } }
    neckScarf(root, 'collarE', clothMat('#24202a'), { high: 0.75, puff: 0.02, off: 0.018 }); // gola alta de pano, justa
    { // S-349: OMBREIRA de aço claro, grande e limpa (lado de guarda): cúpula lisa com crista, duas lâminas por baixo e borda virada em aço mais escuro com rebites
      const s = 'l', ua = bonePos(root, 'upperarm_' + s), la = bonePos(root, 'lowerarm_' + s), c = ua.x > 0 ? -Math.PI / 2 : Math.PI / 2, dk = AM.gold('#8a6a32'), steel = AM.steel('#4e5560', { metal: 0.9, rough: 0.3, env: 1.1 }); // S-399: aço ENEGRECIDO com bordas de latão (antes: aço claro liso, "pedaço de alumínio")
      const fl = t => Math.max(0, t - 0.62) * 0.06 + (t < 0.12 ? (0.12 - t) * 0.04 : 0), T1 = 0.3; // uma peça só, sem lâminas soltas (no anão viravam "garras")
      const dome = shellOn(root, 'exDome3', ['upperarm_' + s], /_(Body|Arms)/, ua, la, { t0: -0.2, t1: T1, bins: 12, sec: 40, off: 0.042, th: 0.014, smooth: 8, arc: [c - 2.0, c + 2.0],
        ridge: (t, a) => Math.max(0, Math.cos(a - c)) ** 10 * 0.012 * Math.max(0, Math.sin(Math.min(1, t * 1.1) * Math.PI)), flare: fl }, steel, 'upperarm_' + s).geometry;
      const tn = a => (a + 0.2) / (T1 + 0.2); // t absoluto → t da casca (0..1)
      strapOnShell(root, dome, dk, [T1, c - 1.95], [T1, c + 1.95], { extra: () => 0.042 + 0.014 + fl(tn(T1)) + 0.002, w: 0.018, th: 0.01, n: 36, pin: 'upperarm_' + s }); // borda virada
      { // S-376: a ombreira SOBE pelo alto do ombro — placa de cima (espaldar) do meio da clavícula até a ponta do ombro, cobrindo a borda da cúpula
        const nk = bonePos(root, 'neck_01'), A = nk.clone().lerp(ua, 0.38).setY(ua.y + (nk.y - ua.y) * 0.3), B = ua.clone().add(ua.clone().sub(A).multiplyScalar(0.22)), u = B.clone().sub(A).normalize(), up = u.x > 0 ? -Math.PI / 2 : Math.PI / 2;
        const TT = 1.0, PO = 0.054, tf = t => t * t * 0.012 + (t < 0.1 ? (0.1 - t) * 0.05 : 0); // justa no alto do ombro; a ponta de fora entra por baixo da borda de cima da cúpula (lâmina sob lâmina)
        const top = shellOn(root, 'exTop5', ['clavicle_' + s, 'upperarm_' + s], /_(Body|Arms)/, A, B, { t0: 0.08, t1: TT, bins: 10, sec: 40, off: PO, th: 0.011, smooth: 6, tight: true, arc: [up - 1.25, up + 1.25],
          ridge: (t, a) => Math.max(0, Math.cos(a - up)) ** 12 * 0.005 * Math.sin(Math.min(1, t) * Math.PI), flare: tf }, steel, 'clavicle_' + s).geometry;
        strapOnShell(root, top, dk, [0.1, up - 1.2], [0.1, up + 1.2], { extra: () => PO + 0.011 + tf(0.03) + 0.001, w: 0.014, th: 0.007, n: 30, pin: 'clavicle_' + s }); } // borda virada do lado do pescoço
      for (const a of [c - 1.3, c - 0.45, c + 0.45, c + 1.3]) { const q = shellAt(dome, T1 - 0.035, a, 0.042 + 0.014 + fl(tn(T1 - 0.035)) + 0.002), r = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), dk); r.scale.set(1, 1, 0.6); r.position.copy(q.p); r.lookAt(q.p.clone().add(q.n)); pinToBone(root, 'upperarm_' + s, r); }
      { // S-399: brasão carmim esmaltado no meio da cúpula — lua crescente atravessada por uma adaga, com filete de latão (marca do Executor)
        const q = shellAt(dome, 0.55, c, 0.042 + 0.014 + 0.003), cr = new THREE.Shape(); cr.absarc(0, 0, 0.034, 0.5, Math.PI * 2 - 0.5, false); cr.absarc(0.014, 0, 0.026, Math.PI * 2 - 0.62, 0.62, true);
        const enamel = new THREE.MeshStandardMaterial({ color: '#7a1624', roughness: 0.28, metalness: 0.2 }), g = new THREE.Group();
        const m1 = new THREE.Mesh(new THREE.ExtrudeGeometry(cr, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 }), enamel); g.add(m1);
        const bl = new THREE.Shape(); bl.moveTo(0, 0.05); bl.lineTo(0.006, 0.012); bl.lineTo(0.016, 0.008); bl.lineTo(0.004, 0.0); bl.lineTo(0.004, -0.03); bl.lineTo(-0.004, -0.03); bl.lineTo(-0.004, 0.0); bl.lineTo(-0.016, 0.008); bl.lineTo(-0.006, 0.012); bl.closePath();
        const m2 = new THREE.Mesh(new THREE.ExtrudeGeometry(bl, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 }), dk); m2.position.z = 0.002; g.add(m2);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.003, 8, 40), dk); g.add(ring);
        g.position.copy(q.p); g.lookAt(q.p.clone().add(q.n)); pinToBone(root, 'upperarm_' + s, g); }
    }
    for (const s of ['l', 'r']) bracerOn(root, leather, s);
    beltSet(root, AM.leather('#1a1418'), brass, 'simples', null, { off: 0.044 }); // cinto justo sobre a couraça colada
    { const cL = bonePos(root, 'upperarm_l').x > bonePos(root, 'upperarm_r').x ? Math.PI / 2 : -Math.PI / 2; // S-376: o pano carmim só do lado ESQUERDO, em meia-volta lateral (da frente-lado às costas-lado), não na frente
      surcoatFlaps(root, crimson, '#2a1a1e', 'nenhum', 0.5, false, { arcs: [[cL - 1.2, 2.4]], gap: 0.034, studs: brass }); }
    void fx;
  },
  salteador(root, fx) {
    // S-343: traje inteiro (não acessórios sobre o boneco): camisa e mangas de linho escuro, calça e botas de camurça, por cima um CASACO LONGO de couro
    costumeBase(root, { body: { color: '#3a2c22', tex: 'camurca' }, arms: { color: '#2c2824', tex: 'linho' }, legs: { color: '#24201c', tex: 'linho' }, feet: { color: '#241a12', tex: 'camurca', rough: 0.72 } });
    const coat = AM.leather('#5e4028'), dark = AM.leather('#2e2018'), hood = clothMat('#4a4038', 0.95), sash = clothMat('#8a2420'), brass = AM.gold('#a8884a');
    const CO = 0.01, vs = vestOn(root, 'vestS2', coat, { off: CO, low: -0.12, open: 0.2, tight: true, smooth: 4 }).geometry;   // casaco de couro justo no tronco, fechado quase até a gola (S-375: colado, sem estufar a cintura)
    // abas do casaco até o joelho (frente aberta, fendas dos lados e atrás para montar e lutar) — acompanham as pernas
    // S-366: abas JUSTAS e presas na cintura — começam por baixo do cinto/faixa (nada de vão solto em cima), só a frente aberta e fendas estreitas
    { const cm = AM.leatherCloth('#5a3c26'), ch = AM.leatherCloth('#2a1c12'), po = { toKnee: true, kneeOff: 0.02, r1: 0.012, top: 0.062, pleats: 2, pleatAmp: 0.004, legFit: true }; // S-375: abas JUSTAS na cintura e no quadril (a perna empurra pela medida real da coxa) · as abas se SOBREPÕEM nas fendas (a de fora cobre a de dentro): sem buraco para o vazio
      coatPanels(root, cm, ch, [[0.22, 1.42], [3.08, 1.62]], { ...po, gap: 0.018, margin: 0.018 });
      coatPanels(root, cm, ch, [[1.58, 1.62], [4.64, 1.42]], { ...po, gap: 0.025, margin: 0.025 }); }
    { // S-366: ombreira de couro trabalhado (ombro esquerdo) moldada sobre o ombro DO CASACO — mede braço + clavícula, então cobre a costura em vez de afundar nela
      // uma peça só de couro moldado (sem lâminas soltas, que no anão viravam "garras"), com um friso gravado, borda virada escura e rebites
      const s = 'l', ua = bonePos(root, 'upperarm_' + s), la = bonePos(root, 'lowerarm_' + s), c = ua.x > 0 ? -Math.PI / 2 : Math.PI / 2, w = 1.45, lm = AM.leather('#4a3020'), T0 = -0.15, T1 = 0.27, OFF = 0.034, TH = 0.012;
      const fl = t => Math.max(0, t - 0.6) * 0.022 + (t < 0.35 ? (0.35 - t) * 0.08 : 0), tn = t => (t - T0) / (T1 - T0); // justa no braço; só a parte de cima sobe por cima da costura do ombro do casaco
      const dome = shellOn(root, 'salSpd3' + s, ['upperarm_' + s], /_(Body|Arms)/, ua, la, { t0: T0, t1: T1, bins: 12, sec: 40, off: OFF, th: TH, smooth: 8, arc: [c - w, c + w],
        ridge: (t, a) => Math.max(0, Math.cos(a - c)) ** 10 * 0.008 * Math.max(0, Math.sin(Math.min(1, t * 1.1) * Math.PI)) + 0.0035 * Math.exp(-(((t - 0.62) / 0.035) ** 2)), flare: fl }, lm, 'upperarm_' + s).geometry;
      strapOnShell(root, dome, AM.leatherCloth('#2a1c14'), [T1, c - w + 0.05], [T1, c + w - 0.05], { extra: () => OFF + TH + fl(1) + 0.001, w: 0.016, th: 0.008, n: 36, pin: 'upperarm_' + s }); // borda virada
      for (const a of [c - 1.25, c - 0.42, c + 0.42, c + 1.25]) { const q = shellAt(dome, T1 - 0.04, a, OFF + TH + fl(tn(T1 - 0.04)) + 0.001), r = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), AM.gold('#a8884a')); r.scale.set(1, 1, 0.6); r.position.copy(q.p); r.lookAt(q.p.clone().add(q.n)); pinToBone(root, 'upperarm_' + s, r); } }
    const pv = bonePos(root, 'pelvis');                                    // faixa vermelha na cintura (Assassin's Creed) por baixo do cinto
    // S-366: a faixa fica POR FORA do casaco e das abas e por dentro do cinto (antes dividia o mesmo lugar com o casaco e piscava/sumia)
    shellOn(root, 'sash4', ['pelvis', 'spine_01'], /_(Body|Legs)/, AV3(pv, 0, 0.03, 0), AV3(pv, 0, 0.19, 0), { bins: 5, sec: 40, off: 0.034, th: 0.008, smooth: 6 }, sash, 'pelvis'); // aparece um palmo acima do cinto
    beltSet(root, dark, brass, 'simples', null, { off: 0.046 }); // por fora da faixa
    fallenHood(root, hood, { k: 'S', on: vs, onEx: CO + 0.007, over: 0.014 }); // S-348/S-366: capuz CAÍDO de pano (rolo na gola + capuz achatado deitado nas costas, por cima do boldrié)
    { const L = bonePos(root, 'upperarm_l').x > bonePos(root, 'upperarm_r').x ? 1 : -1, ex = CO + 0.007 + 0.004, strapM = AM.leatherCloth('#2a1c14');
      // debrum de couro escuro nas duas bordas da abertura do casaco (acabamento, nada de corte cru)
      for (const s of [1, -1]) strapOnShell(root, vs, strapM, [0.02, s * 0.215], [0.99, s * 0.215], { extra: ex - 0.002, w: 0.014, th: 0.005, n: 20 });
      // UM boldrié largo do ombro esquerdo ao quadril direito (frente) e o mesmo pelas costas — no lugar do "X" de varetas
      const fr = strapOnShell(root, vs, strapM, [0.985, L * 0.6], [0.07, -L * 0.62], { extra: ex, w: 0.036, th: 0.007 });
      strapOnShell(root, vs, strapM, [0.985, Math.PI - L * 0.6], [0.07, Math.PI + L * 0.62], { extra: ex, w: 0.036, th: 0.007 });
      { const P = fr.userData.pts, N = fr.userData.nrm, k = 6; strapBuckle(root, brass, P[k], N[k], P[k + 1].clone().sub(P[k - 1]), 0.62); } }
    beltPouches(root, dark, [[0.13, 1, 0.065, 0.07], [-0.15, -1, 0.07, 0.07]]);
    for (const s of ['l', 'r']) { bracerOn(root, dark, s); bootShaft(root, 'salBoot', s, AM.leather('#2a1c12'), { cuff: 0.2 }); } // braçadeiras e botas altas de cano dobrado
    void fx; // sem capa: o capuz caído nas costas fica à mostra (Assassin's Creed / mercenários do Skyrim)
  },
};
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
    gripOn(root, s, 'katar', holder, { axis: new THREE.Vector3(1, 0, 0) }); // P-013: a travessa do H atravessa o punho (eixo x do suporte)
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
  // panos que caem (fralda de malha, barra de couro): dos dois lados
  mailCloth: (color) => _am['mc' + color] || (_am['mc' + color] = new THREE.MeshStandardMaterial({ color, map: metalTex('malha'), bumpMap: metalTex('malha'), bumpScale: 1.6, roughness: 0.5, metalness: 0.78, envMap: armorEnv(), envMapIntensity: 0.65, side: THREE.DoubleSide })),
  leatherCloth: (color) => _am['lc' + color] || (_am['lc' + color] = new THREE.MeshStandardMaterial({ color, map: metalTex('couro'), bumpMap: metalTex('couro'), bumpScale: 0.6, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide })),
};
// casca moldada num trecho de osso(s); opt.front define a "frente" (para eixos horizontais, como o pé)
// S-326: as placas se moldam ao CORPO, não aos acessórios da roupa base (cinto/ombreira/braçadeira do Patrulheiro) — eram eles que deixavam pontas e "lascas" nas lâminas
function shellOn(root, key, bones, meshRe, A, B, o, mat, pin) {
  const g = wrapCached(root, key, () => wrapShell(sampleBody(root, bones, meshRe).filter(p => !p.acc), A, B, { bins: 8, sec: 32, smooth: 4, ...o }));
  return pinToBone(root, pin, new THREE.Mesh(g, mat));
}
// LÂMINAS sobrepostas: n faixas de t0 a t1 ao longo de A→B, cada uma levemente mais para dentro que a anterior (a de cima cobre a de baixo)
function lames(root, key, bones, meshRe, A, B, t0, t1, n, o, mat, pin, matLast) {
  const sec = o.sec || 32, b1 = t0 + (t1 - t0) * (n - 1 + 1.22) / n;
  const prof = wrapCached(root, key + 'PROF', () => { const pts = sampleBody(root, bones, meshRe).filter(p => !p.acc); return { pts, g: wrapShell(pts, A, B, { ...o, sec, t0, t1: b1, bins: Math.max(6, n * 4), smooth: o.smooth ?? 6, off: 0, th: 0.001 }) }; });
  for (let k = 0; k < n; k++) {
    const a = t0 + (t1 - t0) * k / n, b = t0 + (t1 - t0) * (k + 1.22) / n, opt = { ...o, sec, t0: a, t1: b, bins: 4, prof: prof.g.userData, off: (o.off ?? 0.022) - k * (o.step ?? 0.004), th: o.th ?? 0.008, ridge: (t) => (t > 0.82 ? (t - 0.82) * 0.03 : 0) };
    const g = wrapCached(root, key + 'L' + k, () => wrapShell(prof.pts, A, B, opt));
    pinToBone(root, pin, new THREE.Mesh(g, k === n - 1 && matLast ? matLast : mat));
  }
}
const AV3 = (p, dx = 0, dy = 0, dz = 0) => new THREE.Vector3(p.x + dx, p.y + dy, p.z + dz);
// PEITORAL anatômico (frente e costas) com quilha central e placa da barriga em lâminas
function breastplate(root, mat, o = {}) {
  const sp1 = bonePos(root, 'spine_01'), nk = bonePos(root, 'neck_01'), A = AV3(sp1, 0, -0.02, 0), B = AV3(nk, 0, -0.035, 0), body = ['spine_01', 'spine_02', 'spine_03'];
  const t0 = o.bottomY !== undefined ? Math.max(0, Math.min(0.34, (o.bottomY - A.y) / (B.y - A.y))) : (o.t0 ?? 0.34); // bottomY: a borda de baixo fica escondida sob o cinto
  shellOn(root, 'bp' + (o.k || ''), body, /_Body/, A, B, { t0, t1: 0.93, bins: 14, sec: 40, off: o.off ?? 0.026, th: 0.013, smooth: o.smooth ?? 5, uvRep: 2, straight: o.straight, vfit: o.vfit,
    ridge: (t, a) => Math.max(0, Math.cos(a)) ** 6 * (o.flat ? 0.008 : 0.018) * Math.min(1, t * 1.4) + (t > 0.9 ? (t - 0.9) * 0.08 : 0), flare: (t, a) => o.flat ? 0 : Math.max(0, Math.cos(a)) * Math.sin(Math.min(1, t) * Math.PI) * 0.012 }, mat, 'spine_02'); // o.flat: peito sem a quilha alta (cabe por baixo do mantelete sem furar)
  if (!o.noPlack) lames(root, 'plack' + (o.k || ''), body, /_Body/, A, B, 0.0, 0.36, 3, { sec: 40, off: (o.off ?? 0.026) + 0.016, step: 0.002, arc: o.backOpen ? [-1.7, 1.7] : undefined, straight: o.straight }, o.plackMat || mat, 'spine_02', o.plackLast); // S-326: folga segura sobre o peitoral (nada se cruza)
}
// FRALDA (saia de lâminas) na cintura + TASSETS que acompanham as coxas
function fauldTassets(root, mat, o = {}) {
  const pv = bonePos(root, 'pelvis'), sp = bonePos(root, 'spine_01');
  if (o.long) { // S-340: Cavaleiro — uma faixa só na cintura e TASSETS LONGOS de aço escuro (duas placas grandes por coxa, até o meio da coxa), diferente da fralda curta do Paladino
    lames(root, 'fauldK1' + (o.k || ''), ['pelvis', 'spine_01'], /_(Body|Legs)/, AV3(pv, 0, 0.075, 0), AV3(pv, 0, -0.06, 0), 0, 0.42, 1, { sec: 40, off: 0.05, step: -0.006, smooth: 6, flare: (t) => t * 0.01 }, mat, 'pelvis', o.trim);
    for (const s of ['l', 'r']) { const th = bonePos(root, 'thigh_' + s), ca = bonePos(root, 'calf_' + s);
      lames(root, 'tasK' + s + (o.k || ''), ['thigh_' + s], /_Legs/, th, ca, -0.02, 0.56, 2, { sec: 26, off: 0.05, step: -0.005, smooth: 6, arc: [-1.15, 1.15], ridge: (t, a) => Math.max(0, Math.cos(a)) ** 8 * 0.006 }, mat, 'thigh_' + s, o.trim); }
    return;
  }
  if (o.short) { // S-326: fralda CURTA e limpa (da cintura ao alto do quadril), por cima da fralda de malha — não invade o resto da armadura
    lames(root, 'fauldS' + (o.k || ''), ['pelvis', 'spine_01'], /_(Body|Legs)/, AV3(pv, 0, 0.075, 0), AV3(pv, 0, -0.06, 0), 0, 0.72, o.n || 2, { sec: 40, off: 0.05, step: -0.006, smooth: 6, flare: (t) => t * 0.012 }, mat, 'pelvis', o.trim);
    if (o.tassets) for (const s of ['l', 'r']) { const th = bonePos(root, 'thigh_' + s), ca = bonePos(root, 'calf_' + s); // escarcelas presas à coxa, só de frente/lado
      lames(root, 'tasS' + s + (o.k || ''), ['thigh_' + s], /_Legs/, th, ca, 0.04, 0.3, 2, { sec: 24, off: 0.042, step: -0.004, smooth: 5, arc: [-1.05, 1.05] }, mat, 'thigh_' + s, o.trim); }
    return;
  }
  lames(root, 'fauld' + (o.k || ''), ['pelvis', 'thigh_l', 'thigh_r'], /_(Body|Legs)/, AV3(pv, 0, sp.y - pv.y + 0.02, 0), AV3(pv, 0, -0.16, 0), 0, 0.5, o.n || 3, { sec: 36, off: 0.03, step: -0.005, flare: (t) => t * 0.02 }, mat, 'pelvis', o.trim);
  if (o.tassets) for (const s of ['l', 'r']) {
    const th = bonePos(root, 'thigh_' + s), ca = bonePos(root, 'calf_' + s);
    lames(root, 'tas' + s + (o.k || ''), ['thigh_' + s], /_Legs/, th, ca, 0.02, 0.42, 3, { sec: 24, off: 0.03, step: -0.004, arc: [-1.25, 1.25] }, mat, 'thigh_' + s, o.trim);
  }
}
// medida do quadril na altura y (raio de lado e de frente, a partir da pélvis) — serve para humano, elfo e anão
function hipSize(root, y, band = 0.035) {
  const pv = bonePos(root, 'pelvis'); let rx = 0, rz = 0;
  for (const q of sampleBody(root, ['pelvis', 'thigh_l', 'thigh_r', 'spine_01'], /_(Body|Legs)/)) if (!q.acc && Math.abs(q.y - y) < band) { rx = Math.max(rx, Math.abs(q.x - pv.x)); rz = Math.max(rz, Math.abs(q.z - pv.z)); }
  return { rx: rx || 0.19, rz: rz || 0.15, pv };
}
// S-328/S-326: FRALDA DE MALHA (saia de cota de malha com barra de couro) que acompanha as pernas — no lugar das abas duras
function mailSkirt(root, mail, hem, o = {}) {
  const pv = bonePos(root, 'pelvis'), knee = bonePos(root, 'calf_l'), top = pv.y + (o.top ?? (root.userData.armorSet === 'leve' ? 0.06 : 0.0)), hs = hipSize(root, top); // sob placas: começa mais baixo, por baixo da fralda de aço
  const bot = Math.max(knee.y + (o.kneeGap ?? 0.1), pv.y - (o.len ?? 0.26));
  return clothSkirt(root, gownGeo(root, { top, bot, r0: hs.rx + (o.off ?? (root.userData.armorSet === 'leve' ? 0.03 : 0.018)), r1: o.flare ?? 0.06, seg: 56, arc: [Math.PI + 0.004, Math.PI * 2 - 0.008], pleats: 9, /* emenda atrás, não na frente */ pleatAmp: 0.012, sz: Math.min(1, Math.max(0.7, (hs.rz + 0.02) / (hs.rx + 0.02))), seed: 0.4, hemRows: 1 }), [mail, hem], 0.035);
}
// OMBREIRA: cúpula moldada no ombro + lâminas descendo pelo braço (size > 1 = maior, como a do braço do escudo)
function pauldronSet(root, mat, side, o = {}) {
  const ua = bonePos(root, 'upperarm_' + side), la = bonePos(root, 'lowerarm_' + side), c = ua.x > 0 ? -Math.PI / 2 : Math.PI / 2, size = o.size || 1, w = 1.75 + (size - 1) * 0.6, wl = w * (o.arcK || 1); // o.arcK < 1: só as LÂMINAS não dão a volta até o tronco (anão: braço grosso e colado — evita as pontas "em leque"); a cúpula continua inteira
  const dome = shellOn(root, 'pdome2' + side + size + (o.k || ''), ['upperarm_' + side], /_(Body|Arms)/, ua, la, { t0: -0.12, t1: 0.16, bins: 7, sec: 32, off: 0.046 * size, th: 0.012, arc: [c - w, c + w], // S-337: cúpula por FORA da placa dos ombros (cobre a borda dela — sem "degraus" no alto do ombro)
    ridge: (t, a) => (t < 0.1 ? (0.1 - t) * 0.03 : 0) + Math.max(0, Math.cos(a - c)) ** 10 * 0.008, flare: (t) => Math.max(0, t - 0.6) * 0.04 * size }, mat, 'upperarm_' + side);
  if (o.n !== 0) lames(root, 'plame2' + side + size + (o.k || ''), ['upperarm_' + side], /_(Body|Arms)/, ua, la, 0.12, 0.12 + 0.11 * (o.n || 3), o.n || 3, { sec: 28, off: 0.034 * size, step: 0.004, arc: [c - wl + 0.15, c + wl - 0.15], flare: (t) => t * 0.016 * size }, mat, 'upperarm_' + side, o.trim); // S-326: lâminas POR BAIXO da cúpula (antes 2 mm de folga = cruzavam em zigue-zague)
  if (o.cap) { // S-373: ESPALDAR preso à clavícula (fica no lugar quando o braço sobe no golpe) — cobre a junta entre o mantelete e a ombreira, sem malha à mostra
    const cl = bonePos(root, 'clavicle_' + side), up = ua.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (cl) shellOn(root, 'pcap' + side + size + (o.k || ''), ['clavicle_' + side, 'upperarm_' + side], /_(Body|Arms)/, cl, ua, { t0: 0.35, t1: 1.08, bins: 6, sec: 28, off: o.cap, th: 0.011, smooth: 5, arc: [up - 1.75, up + 1.75], flare: (t) => t * 0.01 }, mat, 'clavicle_' + side);
  }
  return dome;
}
// S-372: emblema em relevo sobre a OMBREIRA (sol do Paladino no ombro da espada, oposto ao escudo) — achatado na curva da cúpula, preso ao braço
function shoulderEmblem(root, dome, mat, side, size = 0.085) {
  if (!dome) return; const ua = bonePos(root, 'upperarm_' + side), la = bonePos(root, 'lowerarm_' + side), out = Math.sign(ua.x) || (side === 'l' ? 1 : -1);
  const tmp = new THREE.Mesh(dome.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), dir = new THREE.Vector3(out, 0.05, 0.24).normalize(), rc = new THREE.Raycaster();
  const aim = ua.clone().lerp(la, 0.03); rc.set(aim.clone().add(dir.clone().multiplyScalar(0.6)), dir.clone().negate()); rc.far = 0.6; const h = rc.intersectObject(tmp, false)[0]; if (!h) return;
  const n = h.face.normal.clone(); if (n.dot(dir) < 0) n.negate(); const R = Math.max(0.06, h.point.distanceTo(aim)), sh = new THREE.Shape(), Rs = size / 2;
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rr = k % 2 ? Rs * 0.6 : Rs; k ? sh.lineTo(Math.sin(a) * rr, Math.cos(a) * rr) : sh.moveTo(0, rr); } sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 }), P = g.attributes.position;
  for (let k = 0; k < P.count; k++) P.setZ(k, P.getZ(k) - (P.getX(k) ** 2 + P.getY(k) ** 2) / (2 * R)); g.computeVertexNormals(); // curva junto com a cúpula (nada flutuando nas pontas)
  const up = new THREE.Vector3(0, 1, 0); up.sub(n.clone().multiplyScalar(up.dot(n))).normalize(); const xA = new THREE.Vector3().crossVectors(up, n), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, up, n));
  const m = new THREE.Mesh(g, mat); m.quaternion.copy(q); m.position.copy(h.point).add(n.clone().multiplyScalar(0.0015)); pinToBone(root, 'upperarm_' + side, m);
  const c = new THREE.Mesh(new THREE.SphereGeometry(Rs * 0.36, 20, 12), mat); c.scale.set(1, 1, 0.42); c.quaternion.copy(q); c.position.copy(h.point).add(n.clone().multiplyScalar(0.007)); pinToBone(root, 'upperarm_' + side, c);
}
// BRAÇO: rerebraço, cotoveleira com asa, avambraço e manopla (punho largo + dorso da mão)
function armSet(root, mat, side, o = {}) {
  const ua = bonePos(root, 'upperarm_' + side), la = bonePos(root, 'lowerarm_' + side), hd = bonePos(root, 'hand_' + side), mk = bonePos(root, 'middle_01_' + side);
  if (!o.noRere) shellOn(root, 'nrere2' + side, ['upperarm_' + side], /_(Body|Arms)/, ua, la, { t0: 0.26, t1: 0.92, off: 0.014, th: 0.009 }, mat, 'upperarm_' + side); // S-338: rerebraço começa por baixo das lâminas da ombreira (sem vão de malha no braço)
  shellOn(root, 'vamb3' + side + (o.noFlare ? 'n' : ''), ['lowerarm_' + side], /_(Body|Arms)/, la, hd, { t0: 0.1, t1: o.gauntlet ? 0.97 : 0.86, off: 0.013, th: 0.009, flare: o.noFlare ? (t) => (t > 0.86 ? (t - 0.86) * 0.04 : 0) : (t) => (t < 0.12 ? (0.12 - t) * 0.08 : 0) + (t > 0.8 ? (t - 0.8) * 0.12 : 0) }, o.vamb || mat, 'lowerarm_' + side); // S-338: com manopla, o avambraço vai até o pulso (sem anel de malha no punho)
  if (!o.noCouter) jointCop(root, mat, o.trim, 'upperarm_' + side, 'lowerarm_' + side, side, new THREE.Vector3(0, 0, -1), { k: 'cou', meshRe: /_(Arms|Body)/, n: 2, up: 0.055, down: 0.055, off: 0.016, arc: [-1.3, 1.3], wingR: 0.04 });
  if (o.gauntlet && mk) shellOn(root, 'gaunt' + side, ['hand_' + side], /_(Arms|Body)/, hd, mk, { t0: -0.05, t1: 0.95, bins: 6, sec: 24, off: 0.006, th: 0.007, smooth: 3 }, o.gauntlet, 'hand_' + side);
}
// S-326: JOELHEIRA/COTOVELEIRA moldada (lâminas em volta da junta + asa lateral em leque) — no lugar da calota de esfera
function jointCop(root, mat, trim, upper, lower, side, front, o = {}) {
  const a = bonePos(root, upper), j = bonePos(root, lower), u = j.clone().sub(a).normalize(), A = j.clone().sub(u.clone().multiplyScalar(o.up ?? 0.075)), B = j.clone().add(u.clone().multiplyScalar(o.down ?? 0.075));
  lames(root, (o.k || 'jc') + side, [upper, lower], o.meshRe || /_(Legs|Arms|Body)/, A, B, 0.0, 1.0, o.n || 3, { sec: 28, off: o.off ?? 0.02, step: 0.003, front, arc: o.arc || [-1.5, 1.5], th: 0.009, ridge: (t, an) => Math.max(0, Math.cos(an)) ** (o.ridgeExp || 6) * 0.01 * (o.ridgeK || 1) * Math.sin(t * Math.PI) }, mat, lower, trim); // S-340: ridgeK > 1 = joelheira em ponta (Cavaleiro)
  if (o.wing !== false) { // asa lateral em leque, levemente côncava, de fora
    const sh = new THREE.Shape(), R = o.wingR ?? 0.05; sh.moveTo(0, R); sh.bezierCurveTo(R * 1.1, R * 0.9, R * 1.05, -R * 0.6, 0, -R); sh.bezierCurveTo(-R * 0.45, -R * 0.4, -R * 0.45, R * 0.4, 0, R);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 3, curveSegments: 14 }); const P = g.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, P.getZ(k) - (P.getX(k) ** 2 + P.getY(k) ** 2) * 2.2); g.computeVertexNormals();
    const outward = new THREE.Vector3(Math.sign(j.x || (side === 'l' ? 1 : -1)), 0, 0); let r = 0; for (const q of sampleBody(root, [lower], o.meshRe || /_(Legs|Arms|Body)/)) if (Math.abs(q.clone().sub(j).dot(u)) < 0.03) r = Math.max(r, q.clone().sub(j).dot(outward));
    const m = new THREE.Mesh(g, trim || mat); m.position.copy(j).add(outward.clone().multiplyScalar((r || 0.05) + 0.02)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward); pinToBone(root, lower, m);
  }
}
// S-327: pé de armadura — a bota inteira vira aço (escarpe) e ganha lâminas articuladas no peito do pé e biqueira
function sabatonSet(root, mat, side, trim) {
  root.traverse(o => { if (o.isSkinnedMesh && /_Feet/.test(o.name) && !o.userData.steelBoot) { o.material = mat; o.userData.steelBoot = true; } });
  const ft = bonePos(root, 'foot_' + side), bl = bonePos(root, 'ball_' + side), tip = bonePos(root, 'ball_leaf_' + side) || bl;
  if (!ft || !bl) return;
  lames(root, 'sabL' + side, ['foot_' + side, 'ball_' + side], /_(Feet|Legs)/, ft, tip, 0.12, 0.92, 4, { sec: 24, off: 0.006, step: 0.002, th: 0.006, front: new THREE.Vector3(0, 1, 0), arc: [-1.55, 1.55] }, mat, 'foot_' + side, trim);
}
// PERNA: coxote, joelheira com asa, greva e escarpe sobre o pé
function legSet(root, mat, side, o = {}) {
  const th = bonePos(root, 'thigh_' + side), ca = bonePos(root, 'calf_' + side), ft = bonePos(root, 'foot_' + side);
  if (o.cuisse !== false) shellOn(root, 'cuis' + side, ['thigh_' + side], /_Legs/, th, ca, { t0: 0.16, t1: 0.82, off: 0.016, th: 0.01, arc: o.cuisseArc || [-1.9, 1.9], ridge: (t, a) => Math.max(0, Math.cos(a)) ** 8 * 0.007 + (t > 0.94 ? (t - 0.94) * 0.12 : 0) }, mat, 'thigh_' + side);
  if (o.poleyn !== false) jointCop(root, mat, o.trim, 'thigh_' + side, 'calf_' + side, side, new THREE.Vector3(0, 0, 1), o.poleynPoint ? { k: 'polK', meshRe: /_Legs/, off: 0.022, wingR: 0.056, ridgeK: 3.2, ridgeExp: 14, arc: [-1.35, 1.35] } : { k: 'pol', meshRe: /_Legs/, off: 0.022, wingR: 0.048 });
  if (o.greaveFront) { // S-340: Cavaleiro — greva de COURO em volta da canela e uma PLACA FRONTAL de aço com quilha por cima (diferente da greva inteira do Paladino)
    shellOn(root, 'grevL' + side, ['calf_' + side], /_(Legs|Feet)/, ca, ft, { t0: 0.1, t1: 0.9, off: 0.012, th: 0.009, flare: (t) => (t > 0.85 ? (t - 0.85) * 0.08 : 0) }, o.greaveFront, 'calf_' + side);
    shellOn(root, 'grevF' + side, ['calf_' + side], /_(Legs|Feet)/, ca, ft, { t0: 0.08, t1: 0.9, off: 0.022, th: 0.01, arc: [-1.25, 1.25], ridge: (t, a) => Math.max(0, Math.cos(a)) ** 12 * 0.011 + (t < 0.05 ? (0.05 - t) * 0.15 : 0), flare: (t) => (t > 0.85 ? (t - 0.85) * 0.1 : 0) }, mat, 'calf_' + side);
  } else
  shellOn(root, 'grev' + side, ['calf_' + side], /_(Legs|Feet)/, ca, ft, { t0: 0.12, t1: 0.92, off: 0.014, th: 0.01, ridge: (t, a) => Math.max(0, Math.cos(a)) ** 10 * 0.008 + (t < 0.05 ? (0.05 - t) * 0.15 : 0), flare: (t) => (t > 0.85 ? (t - 0.85) * 0.1 : 0) }, o.greave || mat, 'calf_' + side);
  if (o.sabaton) sabatonSet(root, o.sabaton, side, o.trim);
}
// GOLA em duas lâminas (gorjal), cinto de couro com fivela, faixa/talabarte
function gorgetSet(root, mat, o = {}) {
  const s3 = bonePos(root, 'spine_03'), nk = bonePos(root, 'neck_01');
  // S-361/S-363: com barba, a gola não sobe na FRENTE (antes ficava um pedaço de placa entre o queixo e a barba) — só dos lados e atrás; a barba repousa direto no peitoral
  let bearded = false; root.traverse(m => { if (m.isSkinnedMesh && m.visible && /Beard/i.test(m.name)) bearded = true; });
  if (!o.noLames) lames(root, 'gorg' + (o.k || '') + (bearded ? 'b' : ''), ['neck_01'], /_(Body|Head)|SuperHero/i, AV3(nk, 0, Math.min(0.07, (nk.y - s3.y) * (root.userData.dwarf ? 0.95 : 0.45)), 0), AV3(s3, 0, -0.02, 0), 0.0, 0.6, 2, { sec: 36, off: 0.026, step: -0.006, flare: (t) => t * 0.018, arc: bearded ? [0.62, Math.PI * 2 - 0.62] : undefined }, mat, 'spine_03', o.trim); // S-373: abertura só do tamanho da barba (antes a malha do pescoço aparecia dos lados dela)
  // S-337/S-339: PLACA DOS OMBROS (mantelete) moldada nas clavículas e no alto do tronco — fecha o vão entre gola, peitoral e ombreiras (a malha não aparece mais em cima)
  if (o.mantle !== false) shellOn(root, 'mantle2' + (o.k || '') + (bearded ? 'b' : ''), ['spine_03', 'clavicle_l', 'clavicle_r'], /_Body/, AV3(s3, 0, -0.08, 0), AV3(nk, 0, 0.07, 0), { t0: 0.14, t1: bearded ? 0.74 : 0.9, bins: 12, sec: 44, off: o.mantleOff ?? 0.034, th: 0.012, smooth: o.mantleSmooth ?? 6, uvRep: 2, vfit: o.mantleFit,
    ridge: (t) => (t > 0.92 ? (t - 0.92) * 0.1 : 0), flare: (t) => (1 - t) * (o.mantleFlare ?? 0.012) }, mat, 'spine_03');
  if (o.mantle !== false && bearded) // S-373: com barba, o alto do mantelete continua dos LADOS e atrás (só a frente, sob a barba, fica aberta) — a malha não aparece mais no alto dos ombros do anão
    shellOn(root, 'mantle2top' + (o.k || ''), ['spine_03', 'clavicle_l', 'clavicle_r'], /_Body/, AV3(s3, 0, -0.08, 0), AV3(nk, 0, 0.07, 0), { t0: 0.68, t1: 0.9, bins: 5, sec: 44, off: (o.mantleOff ?? 0.034) + 0.003, th: 0.012, smooth: o.mantleSmooth ?? 6, uvRep: 2, arc: [0.3, Math.PI * 2 - 0.3],
      ridge: (t) => (t > 0.85 ? (t - 0.85) * 0.06 : 0), flare: (t) => (1 - t) * 0.004 }, mat, 'spine_03');
}
// S-326: fivelas diferentes por armadura — Paladino: oval dourada com sol gravado; Cavaleiro: quadrada de ferro escuro com pino de latão; Guerreiro: simples de latão
function buckleGeo(style) {
  const frame = new THREE.Shape(), hole = new THREE.Path();
  if (style === 'sol') { frame.absellipse(0, 0, 0.042, 0.034, 0, Math.PI * 2, false); hole.absellipse(0, 0, 0.028, 0.021, 0, Math.PI * 2, true); }
  else { const w = style === 'quadrada' ? 0.036 : 0.032, h = style === 'quadrada' ? 0.033 : 0.027, r = 0.006, iw = w - 0.009, ih = h - 0.009;
    const rr = (s, W, H, R, cw) => { s.moveTo(-W + R, -H); s.lineTo(W - R, -H); s.quadraticCurveTo(W, -H, W, -H + R); s.lineTo(W, H - R); s.quadraticCurveTo(W, H, W - R, H); s.lineTo(-W + R, H); s.quadraticCurveTo(-W, H, -W, H - R); s.lineTo(-W, -H + R); s.quadraticCurveTo(-W, -H, -W + R, -H); };
    rr(frame, w, h, r); rr(hole, iw, ih, r * 0.6); }
  frame.holes.push(hole);
  return new THREE.ExtrudeGeometry(frame, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 24 });
}
function beltSet(root, leather, buckleMat, style = 'simples', tongueMat, bo = {}) {
  const pv = bonePos(root, 'pelvis'), off = bo.off ?? 0.056; // bo.off: cinto mais justo sobre roupa colada (linha do ladino)
  const y0 = bo.y0 ?? 0.05, y1 = bo.y1 ?? 0.14, ym = (y0 + y1) / 2; // S-374: bo.y0/y1 = cinto mais largo (Guerreiro), bo.straight = reto, sem afinar a cintura
  shellOn(root, 'belt' + (bo.off ? 'o' + off : '') + (bo.k || ''), ['pelvis', 'spine_01'], /_(Body|Legs)/, AV3(pv, 0, y0, 0), AV3(pv, 0, y1, 0), { bins: 3, sec: 40, off, th: 0.012, smooth: 6, tight: !!bo.off, straight: !!bo.straight }, leather, 'pelvis'); // por fora da barriga e da fralda
  const tL = bonePos(root, 'thigh_l'), tR = bonePos(root, 'thigh_r'), cx = tL && tR ? (tL.x + tR.x) / 2 : pv.x; // S-399: fivela no MEIO do corpo (entre as coxas) — o osso da pélvis pende para o lado na pose parada
  let fz = -1e9; for (const q of sampleBody(root, ['pelvis', 'spine_01'], /_Body/)) if (Math.abs(q.y - pv.y - ym) < 0.03 && Math.abs(q.x - cx) < 0.05) fz = Math.max(fz, q.z);
  const z = (fz > -1e8 ? fz : pv.z + 0.13) + off + 0.002, y = pv.y + ym, parts = [new THREE.Mesh(buckleGeo(style), buckleMat)];
  const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, style === 'sol' ? 0.034 : 0.04, 4, 8), tongueMat || buckleMat); tongue.rotation.z = Math.PI / 2; tongue.position.z = 0.006; parts.push(tongue);
  if (style === 'sol') { // sol gravado: raios finos e disco central em relevo
    const disc = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 10), buckleMat); disc.scale.z = 0.45; disc.position.set(0, 0, 0.008); parts.push(disc);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, ray = new THREE.Mesh(new THREE.ConeGeometry(0.0022, 0.009, 6), buckleMat); ray.position.set(Math.cos(a) * 0.036, Math.sin(a) * 0.029, 0.004); ray.rotation.z = a - Math.PI / 2; parts.push(ray); }
  }
  for (const m of parts) { if (bo.buckle) { m.scale.multiplyScalar(bo.buckle); m.position.multiplyScalar(bo.buckle); } m.position.add(new THREE.Vector3(cx, y, z)); pinToBone(root, 'pelvis', m); }
}
// abas de tecido da casa (frente e costas), presas no cinto e acompanhando as pernas
function surcoatFlaps(root, base, trim, emblem, len = 0.36, back = true, fo = {}) {
  const pv = bonePos(root, 'pelvis'), knee = bonePos(root, 'calf_l'), tex = tabardTex(base, trim, emblem), cloth = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, side: THREE.DoubleSide }), hem = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  const hs = hipSize(root, pv.y + 0.06), r0 = hs.rx + (fo.gap ?? 0.075), sz = Math.min(1, Math.max(0.75, (hs.rz + 0.07) / r0)); // S-326: as abas ficam POR FORA da fralda e da malha (medido no corpo — anão incluso), nada atravessa
  const arcs = fo.arcs || (back ? [[-0.5, 1.0], [Math.PI - 0.5, 1.0]] : [[-0.5, 1.0]]), top = pv.y + 0.07;
  for (const [a0, al] of arcs) {
    const geo = gownGeo(root, { top, bot: Math.max(knee.y - 0.02, pv.y - len), r0, r1: 0.05, arc: [a0, al], seg: 16, pleats: 5, pleatAmp: 0.012, sz, seed: a0, hemRows: 1 });
    if (fo.arcs) { const U = geo.attributes.uv; for (let k = 0; k < U.count; k++) U.setXY(k, U.getX(k) / 3, 1 - U.getY(k) / 2); U.needsUpdate = true; } // S-373: o pano inteiro mostra o tabardo (borda, brasão) — antes a textura esticava a beira e virava uma faixa lisa
    clothSkirt(root, geo, [cloth, hem], 0.05);
    if (fo.studs) for (const f of [0.18, 0.5, 0.82]) { // S-373: rebites de latão prendendo o pano no cinto (nada "flutuando")
      const a = a0 + al * f, st = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 14, 10), fo.studs); st.scale.z = 0.55; st.position.set(pv.x + Math.sin(a) * (r0 + 0.008), top - 0.012, pv.z + 0.01 + Math.cos(a) * (r0 + 0.008) * sz); st.lookAt(st.position.clone().add(new THREE.Vector3(Math.sin(a), 0, Math.cos(a) * sz))); pinToBone(root, 'pelvis', st); }
  }
}
// emblema em relevo no peito (sol dourado do Paladino, leão da casa do Cavaleiro)
function chestEmblem(root, mat, kind = 'sol', size = 0.11, at = null) {
  const s2 = bonePos(root, 'spine_03').clone();
  if (at === 'peito_d') { // S-357: no alto do peito, perto do ombro do braço da espada (oposto ao escudo), como um brasão de peito
    const cr = bonePos(root, 'clavicle_r'), cl = bonePos(root, 'clavicle_l'), mid = cl && cr ? (cl.y + cr.y) / 2 : s2.y + 0.1;
    if (cr) { s2.x += (cr.x - s2.x) * 0.55; s2.y = s2.y + (mid - s2.y) * 0.55; } }
  let fz = -1e9; for (const q of sampleBody(root, ['spine_03', 'spine_02'], /_Body/)) if (Math.abs(q.y - s2.y) < 0.04 && Math.abs(q.x - s2.x) < 0.035) fz = Math.max(fz, q.z);
  const sh = new THREE.Shape(), R = size / 2;
  if (kind === 'sol') { for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rr = k % 2 ? R * 0.62 : R; k ? sh.lineTo(Math.sin(a) * rr, Math.cos(a) * rr) : sh.moveTo(0, rr); } sh.closePath(); }
  else { sh.moveTo(0, R); sh.lineTo(R * 0.85, R * 0.55); sh.lineTo(R * 0.7, -R * 0.5); sh.lineTo(0, -R); sh.lineTo(-R * 0.7, -R * 0.5); sh.lineTo(-R * 0.85, R * 0.55); sh.closePath(); } // escudete
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
  let ez = (fz > -1e8 ? fz : s2.z + 0.13) + 0.046;
  { // S-373: assenta na FRENTE da placa de verdade (a quilha do peitoral comia metade do escudete do Cavaleiro) — raio de frente contra as peças do tronco
    const rc = new THREE.Raycaster(new THREE.Vector3(s2.x, s2.y + 0.01, s2.z + 0.8), new THREE.Vector3(0, 0, -1), 0, 1.2), mats = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), list = [];
    root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.parent && o.parent.parent && /^spine_0[23]$/.test(o.parent.parent.name)) list.push(new THREE.Mesh(o.geometry, mats)); });
    for (const [dx, dy] of [[0, -R * 0.7], [0, 0], [0, R * 0.7], [-R * 0.7, 0], [R * 0.7, 0]]) { rc.ray.origin.set(s2.x + dx, s2.y + 0.01 + dy, s2.z + 0.8); const h = rc.intersectObjects(list, false)[0]; if (h) ez = Math.max(ez, h.point.z + 0.003); } }
  const m = new THREE.Mesh(g, mat); m.position.set(s2.x, s2.y + 0.01, ez); m.rotation.x = at ? -0.22 : 0; pinToBone(root, at ? 'spine_03' : 'spine_02', m);
  if (kind === 'sol') { const c = new THREE.Mesh(new THREE.SphereGeometry(R * 0.38, 20, 12), mat); c.scale.set(1, 1, 0.45); c.rotation.x = m.rotation.x; c.position.copy(m.position).add(new THREE.Vector3(0, 0, 0.012)); pinToBone(root, at ? 'spine_03' : 'spine_02', c); }
}
// por baixo das placas: cota de malha no tronco/braços e calça escura (sem a camisa verde da roupa base)
// S-328: máscara por vértice das MÃOS (peso nos ossos hand/dedos) — a malha não cobre as mãos: ali vira luva de couro
function handMask(o) {
  const g = o.geometry; if (g.attributes.aHand) return g.attributes.aHand;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = g.attributes.position.count, a = new Float32Array(n), B = o.skeleton.bones;
  for (let i = 0; i < n; i++) { let w = 0; for (let k = 0; k < 4; k++) { const b = B[si.getComponent(i, k)]; if (b && /^(hand|thumb|index|middle|ring|pinky)_/.test(b.name)) w += sw.getComponent(i, k); } a[i] = Math.min(1, Math.max(0, (w - 0.25) / 0.5)); }
  g.setAttribute('aHand', new THREE.BufferAttribute(a, 1)); return g.attributes.aHand;
}
function gloveOver(mat, glove = '#3a2618') {
  const gc = new THREE.Color(glove);
  mat.onBeforeCompile = sh => {
    sh.uniforms.uGlove = { value: gc };
    sh.vertexShader = 'attribute float aHand;\nvarying float vHand;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHand = aHand;');
    sh.fragmentShader = 'uniform vec3 uGlove;\nvarying float vHand;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ float lum = dot(diffuseColor.rgb, vec3(0.33)); diffuseColor.rgb = mix(diffuseColor.rgb, uGlove * (0.75 + lum * 0.5), vHand); }')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.03, vHand);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.72, vHand);');
  };
  mat.customProgramCacheKey = () => 'glove' + glove;
}
/* S-373: o PESCOÇO da camada de baixo (acima da gola de placas) vira gola acolchoada de couro, não cota de malha — no anão (pescoço curto,
   barba larga) as "bolinhas" da malha apareciam dos lados da barba. Máscara por vértice pelo peso nos ossos do pescoço/cabeça. */
function collarOver(o, mat, color) {
  const g = o.geometry; if (!g.attributes.aNeck) { const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = g.attributes.position.count, a = new Float32Array(n), B = o.skeleton.bones;
    for (let i = 0; i < n; i++) { let w = 0; for (let k = 0; k < 4; k++) { const b = B[si.getComponent(i, k)]; if (b && /^(neck_|head)/.test(b.name)) w += sw.getComponent(i, k); } a[i] = Math.min(1, Math.max(0, (w - 0.25) / 0.4)); }
    g.setAttribute('aNeck', new THREE.BufferAttribute(a, 1)); }
  const cc = new THREE.Color(color), prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uCollar = { value: cc };
    sh.vertexShader = 'attribute float aNeck;\nvarying float vNeck;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvNeck = aNeck;');
    sh.fragmentShader = 'uniform vec3 uCollar;\nvarying float vNeck;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ float lum = dot(diffuseColor.rgb, vec3(0.33)); diffuseColor.rgb = mix(diffuseColor.rgb, uCollar * (0.8 + lum * 0.4), vNeck); }')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, vNeck));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.03, vNeck);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.78, vNeck);');
  };
  mat.customProgramCacheKey = () => prevKey + 'collar' + color;
}
/* S-338/S-339: por baixo das placas a camada de pano/malha "encolhe" um pouco (empurrada para dentro pela normal já com a pele animada):
   quando o corpo dobra, a malha não fura a armadura rígida — ela só aparece nas juntas, por baixo, como deve ser. Mãos (luva) não encolhem. */
function shrinkUnder(mat, amt, handAware) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    if (handAware && !/attribute float aHand/.test(sh.vertexShader)) sh.vertexShader = 'attribute float aHand;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>\ntransformed -= normalize(objectNormal) * ${amt.toFixed(4)}${handAware ? ' * (1.0 - aHand)' : ''};`);
  };
  mat.customProgramCacheKey = () => prevKey + 'shr' + amt + (handAware ? 'h' : '');
}
// S-341: GIBÃO ACOLCHOADO (gambeson) — tecido grosso costurado em gomos verticais, com a trama e sombras dos pespontos (no lugar da malha exposta)
let _gamb = null;
function gambesonTex() {
  if (_gamb) return _gamb;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d');
  x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, W, W);
  for (let k = 0; k < 9000; k++) { const v = 170 + Math.random() * 70 | 0; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(Math.random() * W, Math.random() * W, 1 + Math.random() * 2, 1); } // trama do tecido
  const n = 8, w = W / n;
  for (let i = 0; i < n; i++) { // gomos: claro no meio, sombra junto às costuras
    const g = x.createLinearGradient(i * w, 0, (i + 1) * w, 0); g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.18, 'rgba(0,0,0,0.05)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(0.82, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    x.fillStyle = g; x.fillRect(i * w, 0, w, W);
    x.strokeStyle = 'rgba(40,30,20,0.55)'; x.setLineDash([3, 3]); x.lineWidth = 1; x.beginPath(); x.moveTo(i * w + 0.5, 0); x.lineTo(i * w + 0.5, W); x.stroke(); }
  x.setLineDash([3, 3]); for (let j = 1; j < 4; j++) { x.strokeStyle = 'rgba(40,30,20,0.35)'; x.beginPath(); x.moveTo(0, j * W / 4); x.lineTo(W, j * W / 4); x.stroke(); }
  _gamb = new THREE.CanvasTexture(c); _gamb.wrapS = _gamb.wrapT = THREE.RepeatWrapping; _gamb.colorSpace = THREE.SRGBColorSpace; return _gamb;
}
function underLayer(root, top, legs, glove = '#3a2618', shrink = { body: 0.014, arms: 0.012, legs: 0.008 }, kind = 'malha') {
  root.userData.underKind = kind; // o verificador não conta o gibão acolchoado (visível de propósito) como "malha aparecendo"
  root.traverse(o => { if (o.isSkinnedMesh && /Acc_|_Bracer/.test(o.name)) o.visible = false; }); // S-328: cinto/ombreira da roupa base sobram sob a armadura (abas atravessando a fralda) — a armadura tem os seus · S-338: a braçadeira de couro da roupa base também sai (aparecia entre as placas do antebraço)
  root.traverse(o => { if (!o.isSkinnedMesh || !/_(Arms|Legs|Body)/.test(o.name) || /Acc_/.test(o.name)) return;
    if (/_Arms/.test(o.name) && o.skeleton) { const hm = handMask(o).array; let s = 0; for (let i = 0; i < hm.length; i++) s += hm[i]; if (s / hm.length > 0.85) { o.material = o.material.clone(); o.material.color = new THREE.Color(glove); o.material.roughness = 0.72; o.material.metalness = 0.03; o.material.map = metalTex('couro'); return; } } // a mão em si: luva de couro inteira
    o.material = o.material.clone(); if (/_Arms/.test(o.name) && o.skeleton) gloveOver(o.material, glove);
    if (/_Body/.test(o.name) && o.skeleton && kind !== 'acolchoado') collarOver(o, o.material, glove); // S-373: pescoço = gola de couro (sem malha aparecendo ao lado da barba)
    if (/_Legs/.test(o.name)) { o.material.color = new THREE.Color(legs); o.material.map = metalTex('couro'); o.material.metalness = 0.05; o.material.roughness = 0.8; }
    else if (kind === 'acolchoado') { o.material.color = new THREE.Color(top); o.material.map = gambesonTex(); o.material.bumpMap = gambesonTex(); o.material.bumpScale = 2.2; o.material.metalness = 0.02; o.material.roughness = 0.9; o.material.envMap = null; } // S-341: gibão acolchoado (sem malha exposta)
    else { o.material.color = new THREE.Color(top); o.material.map = metalTex('malha'); o.material.bumpMap = metalTex('malha'); o.material.bumpScale = 1.2; o.material.metalness = 0.75; o.material.roughness = 0.5; o.material.envMap = armorEnv(); o.material.envMapIntensity = 0.6; }
    const amt = /_Legs/.test(o.name) ? shrink.legs : /_Arms/.test(o.name) ? shrink.arms : shrink.body; if (amt > 0) shrinkUnder(o.material, amt, /_Arms/.test(o.name) && !!o.skeleton); });
}
const ARMOR_BUILD = {
  // Guerreiro: couro batido sobre cota de malha, peitoral de ferro rebitado, uma ombreira de ferro (braço do escudo) e outra de couro
  // S-328: Guerreiro coerente (sem "Frankenstein"): gibão de malha, peitoral de ferro rebitado, uma ombreira de ferro e outra de couro (como ele gostou),
  // braçadeiras e luvas de COURO (nada de malha nas mãos), FRALDA DE MALHA com barra de couro no lugar das abas de "papelão", grevas de couro e botas
  // S-347: refeito no espírito do Espadachim (RO) e dos soldados de Skyrim/GoT — MENOS armadura que o Cavaleiro e o Paladino, tudo da mesma
  // família e moldado no corpo: couraça de COURO fervido (fosca, nada de "latão" de aço polido), mantelete de couro unindo gola e ombros,
  // UMA ombreira de ferro fosco no braço do escudo e outra de couro, fralda de malha curta com escarcelas de couro
  // S-374: refeito de novo — guerreiro ROBUSTO (Espadachim do RO / soldado de Skyrim): peitoral de AÇO ESCURECIDO fosco sobre o gibão, cintura RETA
  // (placas da barriga + cinto largo, nada de "cinturinha"), ombreiras iguais de aço escuro, braçadeiras de aço sobre mangas de couro, joelheiras de aço,
  // grevas de couro e TASSETS de placa no lugar da saia de malha. Ainda bem menos blindado que o Cavaleiro (sem manopla, coxote nem escarpe).
  leve(root) {
    const steel = AM.steel('#4f5256', { rivets: true, metal: 0.72, rough: 0.6, env: 0.55 }), edge = AM.steel('#5d6064', { metal: 0.75, rough: 0.5, env: 0.6 }), leather = AM.leather('#5a3d26'), dark = AM.leather('#33241a'), iron = AM.steel('#3c3b39', { metal: 0.8, rough: 0.5 });
    underLayer(root, '#5a4a3a', '#3a2c20', '#3a281a', { body: 0.006, arms: 0.006, legs: 0.006 }, 'acolchoado'); // gibão acolchoado (tecido grosso em gomos) por baixo
    const dw = !!root.userData.dwarf; // anão: pernas curtas e grossas — sem tassets (que viravam "anéis soltos" na coxa)
    // S-383: no anão o tronco é UMA couraça lisa do cinto ao peito (sem as lâminas da barriga, que no tronco largo/curto viravam "rolos empilhados"), bem suavizada
    breastplate(root, steel, { k: 'wl3', off: 0.02, straight: true, flat: true, ...(dw ? { bottomY: bonePos(root, 'pelvis').y + 0.12, noPlack: true, smooth: 8, vfit: true } : {}) });  // peitoral de aço escurecido (frente e costas) com placas da barriga, reto na cintura
    gorgetSet(root, steel, { k: 'wl3', noLames: true, mantleOff: 0.046, ...(dw ? { mantleOff: 0.072, mantleSmooth: 8, mantleFlare: 0.003, mantleFit: true } : {}) }); // mantelete de aço: cobre o alto do peito e os ombros (o peitoral não fica "tomara que caia") e liga às ombreiras
    fauldTassets(root, steel, { k: 'wl3', short: true, n: 1, trim: edge }); // fralda curta de placas sob o cinto (no lugar da saia) — uma lâmina só (anão incluso)
    if (!dw) for (const s of ['l', 'r']) { const th = bonePos(root, 'thigh_' + s), ca = bonePos(root, 'calf_' + s); // TASSETS de placa (3 lâminas) na frente/lado de cada coxa, até o meio da coxa
      lames(root, 'tasW' + s, ['thigh_' + s], /_Legs/, th, ca, 0.0, 0.46, 3, { sec: 26, off: 0.048, step: -0.004, smooth: 6, arc: [-1.2, 1.2], ridge: (t, a) => Math.max(0, Math.cos(a)) ** 8 * 0.005 }, steel, 'thigh_' + s, edge); }
    for (const s of ['l', 'r']) {
      pauldronSet(root, steel, s, dw ? { size: 1.24, n: 1, k: 'wl3d', trim: edge, arcK: 0.8, cap: 0.05 } : { size: 1.08, n: 2, k: 'wl3', trim: edge }); // ombreiras iguais de aço escuro (nenhuma clara demais) · S-384: no anão uma cúpula larga + espaldar e UMA lâmina só (as lâminas finas viravam frisos)
      armSet(root, leather, s, { noCouter: true, noFlare: true, vamb: steel }); // manga de couro + braçadeira de aço
      legSet(root, steel, s, { cuisse: false, poleyn: !dw, greave: dark, trim: edge }); // joelheira de aço (humano/elfo) + greva de couro
    }
    beltSet(root, dark, iron, 'quadrada', AM.gold('#8a7448'), { k: 'wl3', y0: 0.04, y1: 0.15, off: 0.062, straight: true, buckle: 1.35 }); // cinto LARGO e reto
  },
  // S-327: Cavaleiro de aço ENEGRECIDO fosco (mais escuro que o Paladino, sem azul e sem "latão"), bordas polidas, escarpe de placas no pé, abas vermelhas da casa
  placas(root) {
    const steel = AM.steel('#64625e', { rivets: true, metal: 0.88, rough: 0.44, env: 1.0 }), edge = AM.steel('#8c8a86', { metal: 0.92, rough: 0.3 }), leather = AM.leather('#3a2618'), iron = AM.steel('#3a3936', { metal: 0.85, rough: 0.45 }), brass = AM.gold('#a8844a');
    underLayer(root, '#5e6064', '#262422', '#2e2018');
    breastplate(root, steel, { k: 'k' }); gorgetSet(root, steel, { k: 'k' });
    mailSkirt(root, AM.leatherCloth('#2a1d15'), AM.leatherCloth('#18110c'), { len: 0.27 }); // S-340: saia de COURO reforçado (não malha como o Paladino)
    fauldTassets(root, steel, { k: 'k', trim: edge, long: true }); // S-340: tassets longos em duas placas grandes por coxa
    const dw = !!root.userData.dwarf; // S-373: anão — ombreiras mais robustas e fechadas (cúpula maior, lâminas sem abrir em leque), como no elfo
    pauldronSet(root, steel, 'l', { size: dw ? 1.3 : 1.25, n: dw ? 3 : 4, k: 'k', trim: edge, arcK: dw ? 0.8 : 1, cap: dw ? 0.05 : 0 }); pauldronSet(root, steel, 'r', { size: dw ? 1.15 : 0.95, n: 2, k: 'k', trim: edge, arcK: dw ? 0.8 : 1, cap: dw ? 0.05 : 0 });
    for (const s of ['l', 'r']) { armSet(root, steel, s, { gauntlet: steel, trim: edge }); legSet(root, steel, s, { sabaton: steel, trim: edge, poleynPoint: true, greaveFront: leather }); } // S-340: joelheira em ponta e greva de couro com placa frontal
    beltSet(root, leather, iron, 'quadrada', brass); chestEmblem(root, brass, 'escudete', 0.1);
    surcoatFlaps(root, '#6a1a1e', '#b8923e', 'espadas', 0.4, true, { arcs: [[0.86, 0.95], [-1.81, 0.95], [Math.PI - 0.42, 0.84]], studs: brass }); // S-373: abas da casa nas LATERAIS (quadris) e atrás, com o tabardo inteiro à mostra e rebites no cinto — a frente fica com as placas
  },
  // S-326: Paladino — mesma linha (prata + ouro, malha por dentro), acabamento refinado: fralda curta limpa sobre a fralda de malha, coxotes/joelheiras/grevas/escarpes de verdade
  paladino(root, fx) {
    const steel = AM.steel('#d6dade', { metal: 0.93, rough: 0.26, env: 1.15 }), gold = AM.gold('#d4ac52'), leather = AM.leather('#5a3a22');
    underLayer(root, '#9aa0a8', '#4a4640', '#4a3424');
    breastplate(root, steel, { k: 'p' }); gorgetSet(root, steel, { k: 'p', trim: gold });
    const goldHem = _am.palHem || (_am.palHem = Object.assign(AM.gold('#c9a24a').clone(), { side: THREE.DoubleSide }));
    mailSkirt(root, AM.mailCloth('#a0a6ae'), goldHem, { len: 0.26 }); // S-372: barra dourada na fralda de malha (acabamento, já que o pano da frente saiu)
    fauldTassets(root, steel, { k: 'p', n: 2, tassets: true, trim: gold, short: true });
    for (const s of ['l', 'r']) { const dome = pauldronSet(root, steel, s, { size: 1.12, n: 3, k: 'p', trim: gold, arcK: root.userData.dwarf ? 0.8 : 1, cap: root.userData.dwarf ? 0.05 : 0 }); if (s === 'r') shoulderEmblem(root, dome, gold, 'r', 0.115); armSet(root, steel, s, { gauntlet: steel, trim: gold }); legSet(root, steel, s, { sabaton: steel, trim: gold }); } // S-372: sol na OMBREIRA DIREITA (braço da espada, oposto ao escudo)
    beltSet(root, leather, gold, 'sol'); // S-372: sem o pano da frente (abas só no Cavaleiro) — a fralda de malha com barra dourada e as placas fecham a cintura
    clothCape(root, fx, '#ece4d2', { clasp: true, emblem: 'sol' }); // S-371: sol bordado tom sobre tom nas costas da capa
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
/* S-339: a BARBA repousa por cima da armadura. Na pose parada, cada vértice da barba que ficou dentro da gola/peitoral/mantelete
   é levado para a frente até 1 cm à frente da placa (raio a partir das costas, na mesma altura). A conta volta para o espaço de
   amarração da malha (pele animada), então a barba continua presa ao queixo e acompanha a cabeça; a geometria é copiada (só deste personagem). */
const _bR = new THREE.Raycaster();
function seatBeard(root) {
  const beards = []; root.traverse(o => { if (o.isSkinnedMesh && /Beard/i.test(o.name) && o.visible) beards.push(o); }); if (!beards.length) return;
  const ARM_RE = /^(spine_0[23]|neck_01|clavicle_[lr])$/; // S-398: as placas presas às CLAVÍCULAS (gola/espaldar que cruza a frente do pescoço) também contam — antes a barba ficava atrás delas, picotada entre as bordas
  const plates = []; root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.parent && o.parent.parent && ARM_RE.test(o.parent.parent.name)) plates.push(o); });
  humanIdlePose(root); root.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld).normalize(), v = new THREE.Vector3(), M = new THREE.Matrix4(), S = new THREE.Matrix4(), A3 = new THREE.Matrix3();
  /* verificador (P-012): sem armadura, a barba do anão entrava no peito da roupa. Grade de profundidade do peito (frente mais à frente
     por célula de 2 cm, no espaço do corpo) feita com a roupa/corpo animados + peças rígidas do tronco; vale com e sem armadura. */
  const rightW = new THREE.Vector3(1, 0, 0).transformDirection(root.matrixWorld).normalize(), upW = new THREE.Vector3(0, 1, 0).transformDirection(root.matrixWorld).normalize(), o0 = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
  const CELL = 0.02, grid = new Map(), key = (a, b) => Math.round(a / CELL) * 4096 + Math.round(b / CELL);
  const addPt = p => { const d = p.sub(o0), a = d.dot(rightW), b = d.dot(upW), f = d.dot(fwd), k = key(a, b); if (!(grid.get(k) >= f)) grid.set(k, f); };
  const nb = root.getObjectByName('neck_01'), neckH = nb ? nb.getWorldPosition(new THREE.Vector3()).sub(o0).dot(upW) + 0.01 : Infinity; // só peito e gola (o rosto fica de fora)
  const bz = new THREE.Box3(); for (const b of beards) { b.skeleton.update(); const P = b.geometry.attributes.position; for (let i = 0; i < P.count; i += 3) { b.getVertexPosition(i, v); b.localToWorld(v); bz.expandByPoint(v); } }
  bz.expandByScalar(0.04);
  root.traverse(o => {
    if (!o.isMesh || !o.visible || /Beard|Hair|Eyebrow|Eye|Head|Face/i.test(o.name) || !o.geometry || !o.geometry.attributes.position) return;
    const rigidTorso = !o.isSkinnedMesh && o.parent && o.parent.parent && ARM_RE.test(o.parent.parent.name);
    if (!o.isSkinnedMesh && !rigidTorso) return; if (o.isSkinnedMesh) o.skeleton.update();
    const P = o.geometry.attributes.position, step = Math.max(1, (P.count / 9000) | 0);
    for (let i = 0; i < P.count; i += step) { o.getVertexPosition(i, v); o.localToWorld(v); if (bz.containsPoint(v) && v.clone().sub(o0).dot(upW) < neckH) addPt(v.clone()); }
  });
  const frontAt = p => { const d = p.clone().sub(o0), a = d.dot(rightW), b = d.dot(upW); let best = -Infinity; for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const g = grid.get(key(a + da * CELL, b + db * CELL)); if (g !== undefined && g > best) best = g; } return best === -Infinity ? null : best; };
  const GAP = plates.length ? 0.016 : 0.011; // S-357: folga maior sobre a armadura — ao inclinar a cabeça nos golpes a barba não entra na placa
  for (const b of beards) {
    b.skeleton.update(); b.geometry = b.geometry.clone();
    const pos = b.geometry.attributes.position, si = b.geometry.attributes.skinIndex, sw = b.geometry.attributes.skinWeight, bm = b.skeleton.boneMatrices; let moved = 0;
    // S-398: 1ª passada mede o quanto cada ponto precisa sair; o empurrão é decidido por FAIXA DE ALTURA (e suavizado entre faixas), não ponto a
    // ponto — empurrar cada vértice o seu tanto deixava a barba picotada ("dentes" pretos sobre a gola). Assim ela sai inteira, como uma peça.
    const BAND = 0.012, needs = new Float32Array(pos.count), hts = new Float32Array(pos.count), band = new Map();
    for (let i = 0; i < pos.count; i++) {
      b.getVertexPosition(i, v); b.localToWorld(v);
      let need = -1;
      if (plates.length) { _bR.set(v.clone().sub(fwd.clone().multiplyScalar(0.4)), fwd); _bR.far = 0.6; const hits = _bR.intersectObjects(plates, false); if (hits.length) need = hits[hits.length - 1].point.clone().sub(v).dot(fwd) + GAP; }
      { const f = frontAt(v); if (f != null) need = Math.max(need, f - v.clone().sub(o0).dot(fwd) + GAP); }
      needs[i] = need; const h = v.clone().sub(o0).dot(upW); hts[i] = h; const k = Math.round(h / BAND); if (need > 0) band.set(k, Math.max(band.get(k) || 0, Math.min(need, plates.length ? 0.17 : 0.12)));
    }
    if (!band.size) continue;
    const ks = [...band.keys()], k0 = Math.min(...ks) - 3, k1 = Math.max(...ks) + 3, raw = [], sm = [];
    for (let k = k0; k <= k1; k++) raw.push(band.get(k) || 0);
    for (let j = 0; j < raw.length; j++) { let m = 0; for (let q = -2; q <= 2; q++) m = Math.max(m, raw[j + q] || 0); sm.push(m); } // cobre os vizinhos (nada de faixa sem empurrão no meio)
    const fin = sm.map((_, j) => ((sm[j - 1] ?? sm[j]) + sm[j] * 2 + (sm[j + 1] ?? sm[j])) / 4); // e suaviza a transição
    const needAt = h => { const x = h / BAND - k0, j = Math.floor(x), t = x - j; if (j < 0) return fin[0] || 0; if (j >= fin.length - 1) return fin[fin.length - 1] || 0; return fin[j] * (1 - t) + fin[j + 1] * t; };
    for (let i = 0; i < pos.count; i++) {
      const need = needAt(hts[i]); if (need <= 0.0005) continue;
      // matriz linear da pele neste vértice: meshWorld · bindInverse · Σ w·boneMatrix · bind
      S.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const e = M.fromArray(bm, si.getComponent(i, k) * 16).elements; for (let q = 0; q < 16; q++) S.elements[q] += e[q] * w; }
      M.copy(b.matrixWorld).multiply(b.bindMatrixInverse).multiply(S).multiply(b.bindMatrix); A3.setFromMatrix4(M); const det = A3.determinant(); if (Math.abs(det) < 1e-9) continue;
      const nd = need, d = fwd.clone().multiplyScalar(plates.length ? nd * 0.95 : nd).add(upW.clone().multiplyScalar(plates.length ? Math.min(0.025, nd * 0.2) : 0)).applyMatrix3(A3.invert()); // S-398: sai para a FRENTE (subir até 10 cm amassava a barba contra a boca e ela parecia quebrada) // S-357: com armadura, a ponta da barba também sobe um pouco
      pos.setXYZ(i, pos.getX(i) + d.x, pos.getY(i) + d.y, pos.getZ(i) + d.z); moved++;
    }
    if (moved) { pos.needsUpdate = true; b.geometry.computeVertexNormals(); b.userData.seated = moved; }
  }
}
export function applyArmor(root, setId, fx = []) {
  if (ARMOR_BUILD[setId] && root.userData.human) { root.userData.outfitKey = root.userData.outfitKey || outfitKey(root); root.userData.armorSet = setId; ARMOR_BUILD[setId](root, fx); try { seatBeard(root); } catch (e) { } return; } // S-317/S-318: armaduras refeitas · S-339: barba por cima da armadura
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
  const role = NPC_ROLE[npcId], root = ch.root; if (!root.userData.human) return null;
  if (!role) return root.userData.grips ? () => fingerGrips(root) : null; // P-013: NPC com arma emprestada também fecha a mão no cabo
  const fx = [];
  if (role === 'guarda') guardKit(root, fx);
  else if (role === 'sacerdotisa') habit(root);
  else if (role === 'mentora') mentorGown(root, fx);
  else if (role === 'mercador') merchantHat(root);
  if (root.userData.grips) fx.push(() => fingerGrips(root));
  return fx.length ? t => fx.forEach(f => f(t)) : null;
}
/* =========================================================================================================
   P-013: MÃOS DE VERDADE — sistema único de pegada (vale para jogador, NPCs, vitrine e galeria; humano/elfo/anão)
   • GRIPS[tipo] é DADO: r = raio do cabo (m); curl = dobra base das falanges 01/02/03 dos 4 dedos (rad, eixo x local
     — o mesmo sinal fecha as duas mãos); thumb = dobra das falanges 02/03 do polegar; over = polegar fecha POR CIMA dos
     dedos (true) ou fica AO LADO, ao longo do cabo (false). Tipos sem r (corda, apoio, alaúde...) só dobram (nada a encostar).
   • seatInHand(root, lado, obj, tipo, {point, axis, edge}) encaixa um objeto pelo PUNHO REAL (fistFrame: centro do punho
     fechado, eixo mindinho→indicador e direção pulso→dedos) e já registra a pegada.
   • gripOn(root, lado, tipo, obj, {point, axis, r, active}) só registra (para quem já tem encaixe próprio): point/axis são
     o ponto e o eixo do cabo no espaço de `obj`; active() diz se a mão está segurando agora (ex.: arco nas costas = não).
   • fingerGrip(root, lado) roda a cada quadro DEPOIS da animação (fx do dressHuman/dressNpcRole, ou gripHand em bow3d e
     instrument3d): fecha cada dedo falange a falange até ENCOSTAR no cilindro do cabo (busca binária da dobra — nada
     atravessa) e aplica no máximo uma vez por quadro por mão (o resto do jogo pode chamar sem medo).
   ARMA NOVA: 1) modele com o cabo num eixo conhecido; 2) use um tipo de GRIPS (ou acrescente um); 3) chame
   seatInHand(...) — ou o seu encaixe + gripOn(...). Dedos, mão esquerda/direita e anão vêm de graça.
   ========================================================================================================= */
export const GRIPS = {
  espada: { r: 0.016, curl: [0.85, 1.05, 0.8], thumb: [0.45, 0.5], over: true },
  machado: { r: 0.018, curl: [0.85, 1.05, 0.8], thumb: [0.45, 0.5], over: true },
  adaga: { r: 0.0135, curl: [0.9, 1.1, 0.85], thumb: [0.5, 0.5], over: true },
  katar: { r: 0.012, curl: [0.95, 1.15, 0.9], thumb: [0.55, 0.55], over: true },
  varinha: { r: 0.01, curl: [0.7, 0.95, 0.7], thumb: [0.3, 0.3], over: false },
  cajado: { r: 0.022, curl: [0.8, 1.0, 0.78], thumb: [0.35, 0.4], over: false },
  livro: { r: 0.018, curl: [0.6, 0.8, 0.6], thumb: [0.25, 0.3], over: false },
  arco: { r: 0.018, curl: [0.82, 1.0, 0.75], thumb: [0.42, 0.45], over: true },
  besta: { r: 0.019, curl: [0.82, 1.0, 0.75], thumb: [0.42, 0.45], over: true },
  escudo: { r: 0.014, curl: [0.85, 1.05, 0.8], thumb: [0.45, 0.5], over: true },
  punho: { curl: [0.75, 0.95, 0.7], thumb: [0.35, 0.4] },      // mão fechada sem objeto registrado (guarda, legado)
  corda: { curl: [0.42, 0.55, 0.42], thumb: [0.2, 0.22] },     // dedos em gancho na corda do arco
  apoio: { curl: [0.5, 0.7, 0.5], thumb: [0.3, 0.3] },         // mão de apoio (besta, guarda)
  alaude: { curl: [0.5, 0.7, 0.5], thumb: [0.35, 0.3] },       // mão no braço do instrumento
  dedilhar: { curl: [0.25, 0.35, 0.25], thumb: [0.2, 0.2] },   // mão que dedilha
  flauta: { curl: [0.3, 0.45, 0.35], thumb: [0.3, 0.3] },
};
const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky', 'thumb'];
let GRIP_SYSTEM = true; // false = comportamento antigo (só para comparar em teste)
export function setGripSystem(on) { GRIP_SYSTEM = !!on; }
export function gripOn(root, side, type, obj, o = {}) {
  const G = (root.userData.grips = root.userData.grips || { l: [], r: [] });
  G[side] = G[side].filter(g => g.obj !== obj);
  G[side].unshift({ type, obj, point: o.point ? o.point.clone() : new THREE.Vector3(), axis: (o.axis ? o.axis.clone() : new THREE.Vector3(0, 1, 0)).normalize(), r: o.r ?? (GRIPS[type] && GRIPS[type].r), active: o.active || null });
  return obj;
}
export function seatInHand(root, side, obj, type, o = {}) {
  humanIdlePose(root); const hand = bone(root, 'hand_' + side), F = fistFrame(root, side); if (!hand || !F) return null;
  const ax = (o.axis || new THREE.Vector3(0, 1, 0)).clone().normalize(), ed = (o.edge || new THREE.Vector3(0, 0, 1)).clone(); ed.sub(ax.clone().multiplyScalar(ed.dot(ax))).normalize();
  const from = new THREE.Matrix4().makeBasis(ax, ed, new THREE.Vector3().crossVectors(ax, ed)), to = new THREE.Matrix4().makeBasis(F.A, F.E, new THREE.Vector3().crossVectors(F.A, F.E));
  const holder = new THREE.Group(); hand.add(holder); fitToBone(root, hand, holder, new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert())), F.C);
  obj.position.copy((o.point || new THREE.Vector3()).clone().multiplyScalar(-1)); holder.add(obj);
  obj.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  gripOn(root, side, type, holder, { axis: ax, r: o.r });
  return holder;
}
function handChains(root, side) {
  const k = '_hc' + side; if (root.userData[k]) return root.userData[k];
  const out = [];
  for (const f of FINGER_NAMES) { const bs = ['01', '02', '03'].map(j => root.getObjectByName(`${f}_${j}_${side}`)); if (bs.every(Boolean)) out.push({ f, bs, q0: bs.map(() => new THREE.Quaternion()), s: 1, n: 0 }); }
  return (root.userData[k] = out);
}
const _fgSc = new THREE.Vector3(), _fgR = new THREE.Quaternion(), _fgX = new THREE.Vector3(1, 0, 0), _fgP = new THREE.Vector3(), _fgA = new THREE.Vector3(), _fgD = new THREE.Vector3(), _fgT = new THREE.Vector3(), _fgU = new THREE.Vector3(), _fgV = new THREE.Vector3();
function curlChain(c, ang, s) { for (let i = 0; i < 3; i++) c.bs[i].quaternion.copy(c.q0[i]).multiply(_fgR.setFromAxisAngle(_fgX, ang[i] * s)); c.bs[0].updateWorldMatrix(false, true); }
function chainPen(c, A0, d, r, sc = 1) { // quanto o dedo entra no cilindro do cabo (>0 = atravessa); sc = escala do mundo da mão (1ª pessoa encolhida)
  const p1 = _fgU.setFromMatrixPosition(c.bs[1].matrixWorld), p2 = _fgV.setFromMatrixPosition(c.bs[2].matrixWorld), seg = p2.distanceTo(p1), fr = Math.max(0.0055 * sc, seg * 0.26); // matrizes já atualizadas em curlChain (barato)
  _fgT.copy(p2).sub(p1).multiplyScalar(0.85).add(p2); // ponta do dedo
  let pen = -1;
  for (const P of [p1, p2, _fgT]) { _fgD.copy(P).sub(A0); _fgD.addScaledVector(d, -_fgD.dot(d)); pen = Math.max(pen, r + fr - _fgD.length()); }
  return pen;
}
// fecha os dedos de uma mão (uma vez por quadro). type força uma pegada sem objeto (legado/instrumento/corda)
export function fingerGrip(root, side, type) {
  if (!GRIP_SYSTEM) return;
  const chains = handChains(root, side); if (!chains.length) return;
  const mark = '_gm' + side, b0 = chains[0].bs[0];
  if (root.userData[mark] && b0.quaternion.equals(root.userData[mark])) return; // já fechada neste quadro (a animação não reescreveu)
  const reg = root.userData.grips && root.userData.grips[side] && root.userData.grips[side].find(g => !g.active || g.active());
  const G = GRIPS[reg ? reg.type : type]; if (!G) return;
  const hand = b0.parent; if (hand) hand.updateWorldMatrix(true, false);
  let A0 = null, d = null, r = 0;
  let sc = 1; if (reg && reg.r) { reg.obj.updateWorldMatrix(true, false); A0 = _fgP.copy(reg.point).applyMatrix4(reg.obj.matrixWorld); d = _fgA.copy(reg.axis).transformDirection(reg.obj.matrixWorld); sc = _fgSc.setFromMatrixScale(reg.obj.matrixWorld).x; r = reg.r * sc; } // raio na escala real (a 1ª pessoa usa o corpo encolhido)
  for (const c of chains) {
    for (let i = 0; i < 3; i++) c.q0[i].copy(c.bs[i].quaternion);
    const ang = c.f === 'thumb' ? [0, G.thumb[0] * (G.over === false ? 0.6 : 1), G.thumb[1] * (G.over === false ? 0.6 : 1)] : G.curl;
    if (!A0) { c.s = 1; curlChain(c, ang, 1); continue; }
    curlChain(c, ang, c.s);
    if (c.n++ % 3 === 0 || chainPen(c, A0, d, r, sc) > 0.0005 * sc) { // busca a dobra que ENCOSTA no cabo: a cada 3 quadros, ou na hora se a pose nova fez o dedo entrar
      let lo = -0.75, hi = 1.3; // pode ABRIR o dedo (negativo) quando a própria animação já o fecha por dentro do cabo
      curlChain(c, ang, hi); if (chainPen(c, A0, d, r, sc) <= 0) lo = hi;
      else for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; curlChain(c, ang, m); if (chainPen(c, A0, d, r, sc) > 0) hi = m; else lo = m; }
      c.s = lo; curlChain(c, ang, c.s);
    }
  }
  root.userData[mark] = (root.userData[mark] || new THREE.Quaternion()).copy(b0.quaternion);
}
export function fingerGrips(root) { if (!root.userData.grips) return; fingerGrip(root, 'r'); fingerGrip(root, 'l'); }
// atalho para quem controla a mão por conta própria (arco, besta, instrumento): fecha com a pegada registrada ou com o tipo dado
export function gripHand(root, side, type) { fingerGrip(root, side, type); }
// medição (teste): distância do eixo do cabo ao centro do punho e quanto os dedos entram no cabo, por mão registrada
export function gripReport(root) {
  const out = []; root.updateMatrixWorld(true);
  for (const side of ['r', 'l']) {
    const reg = root.userData.grips && root.userData.grips[side] && root.userData.grips[side].find(g => !g.active || g.active()); if (!reg || !reg.r) continue;
    const chains = handChains(root, side), fb = ['index', 'middle', 'ring', 'pinky'].map(n => root.getObjectByName(`${n}_02_${side}`)).filter(Boolean), hb = root.getObjectByName('hand_' + side); if (fb.length < 4 || !hb) continue;
    const C = fb.reduce((a, b) => a.add(b.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(0.25).lerp(hb.getWorldPosition(new THREE.Vector3()), 0.22);
    const A0 = reg.point.clone().applyMatrix4(reg.obj.matrixWorld), d = reg.axis.clone().transformDirection(reg.obj.matrixWorld), v = C.clone().sub(A0); v.addScaledVector(d, -v.dot(d));
    const sc = new THREE.Vector3().setFromMatrixScale(reg.obj.matrixWorld).x; let pen = -1; for (const c of chains) if (c.f !== 'thumb') pen = Math.max(pen, chainPen(c, A0, d, reg.r * sc, sc));
    out.push({ side, type: reg.type, eixo_cm: +(v.length() * 100 / sc).toFixed(1), penetra_mm: +(Math.max(0, pen) * 1000 / sc).toFixed(1) }); // medidas na escala do corpo
  }
  return out;
}
/* legado (S-291): handGrip(root, lado, k) — agora passa pelo sistema acima (pegada registrada, ou "punho" proporcional a k) */
const _gq = new THREE.Quaternion(), _gAx = new THREE.Vector3();
export function handGrip(root, side = 'r', k = 1) {
  if (GRIP_SYSTEM) return () => fingerGrip(root, side, k >= 0.95 ? 'punho' : k >= 0.6 ? 'apoio' : k >= 0.4 ? 'corda' : 'dedilhar');
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
    gripOn(root, 'r', 'espada', holder, { point: new THREE.Vector3(0, -0.055, 0), axis: new THREE.Vector3(0, 1, 0) }); // P-013
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
