/* =========================================================================
   VISUAL DAS CLASSES — mesma cabeça/cabelo do personagem em todas as classes;
   cada classe muda roupa (modelo do corpo + cores), armas, acessórios e efeitos.
   As 2ª classes (evoluções) ganham brilho, auras e peças extras.
   ========================================================================= */
import * as THREE from 'three';

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
  guerreiro: { outfit: 'Knight', show: ['1H_Sword', 'Round_Shield', 'Knight_Cape'], tint: { body: '#9aa2b0', legs: '#5a4a3a', cape: '#b8332a' }, style: '1h', extras: ['belt'] },
  cavaleiro_runico: { outfit: 'Knight', show: ['2H_Sword', 'Knight_Helmet', 'Knight_Cape'], tint: { body: '#3a4258', legs: '#262c3c', cape: '#7a1020', helmet: '#3a4258' }, glow: { '2H_Sword': '#4ad0ff' }, style: '2h', extras: ['pauldrons', 'runes'] },
  guardiao_sagrado: { outfit: 'Knight', show: ['1H_Sword', 'Badge_Shield', 'Knight_Cape'], tint: { body: '#fff6dc', legs: '#e8c860', cape: '#ffffff' }, glow: { '1H_Sword': '#ffd76a', 'Badge_Shield': '#ffcf4a' }, style: '1h', extras: ['halo', 'holyWings', 'tabard'] },
  mago: { outfit: 'Mage', show: ['2H_Staff', 'Mage_Cape'], tint: { body: '#3a5ad8', legs: '#2a3470', cape: '#1e2a78' }, style: 'cast' },
  arquimago: { outfit: 'Mage', show: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'], scale: { Mage_Hat: 0.72 }, tint: { body: '#4a2a7a', legs: '#2a1446', cape: '#24103c', hat: '#3a1a5a' }, glow: { '2H_Staff': '#c07aff' }, style: 'cast', extras: ['arcaneRings', 'starMotes'] },
  sabio_elemental: { outfit: 'Mage', show: ['1H_Wand', 'Spellbook_open', 'Mage_Cape'], tint: { body: '#2f7a6a', legs: '#1f4a40', cape: '#c9a24a' }, glow: { '1H_Wand': '#7affd0', 'Spellbook_open': '#7affd0' }, style: 'cast', extras: ['circlet', 'elementOrbs'] },
  arqueiro: { outfit: 'Rogue', show: ['2H_Crossbow', 'Rogue_Cape'], tint: { body: '#4f8a45', legs: '#5a4430', cape: '#2f5a2a' }, style: 'ranged', extras: ['quiver'] },
  cacador: { outfit: 'Barbarian', show: ['Barbarian_Cape'], borrow: [['Rogue', '2H_Crossbow']], tint: { body: '#8a6a3a', legs: '#5a4028', cape: '#4a3020' }, style: 'ranged', extras: ['quiver', 'featherBand', 'falcon'] },
  menestrel: { outfit: 'Rogue', show: ['1H_Crossbow', 'Rogue_Cape'], tint: { body: '#8a2a5a', legs: '#3a2a5a', cape: '#d8a03a' }, style: 'ranged', extras: ['lute', 'bardHat', 'musicNotes'] },
  ladino: { outfit: 'Rogue', show: ['Knife', 'Knife_Offhand', 'Rogue_Cape'], tint: { body: '#4a4a55', legs: '#33333c', cape: '#2a2a33' }, style: 'dual', extras: ['bandana', 'scarf'] },
  lamina_sombria: { outfit: 'Rogue', show: ['Knife', 'Knife_Offhand', 'Rogue_Cape'], tint: { body: '#221a2e', legs: '#18121f', cape: '#2a1440' }, glow: { Knife: '#b06aff', Knife_Offhand: '#b06aff' }, style: 'dual', extras: ['shadowHood', 'shoulderSpikes', 'shadowWisps'] },
  saqueador: { outfit: 'Barbarian', show: ['1H_Axe', '1H_Axe_Offhand', 'Barbarian_Cape'], tint: { body: '#7a5a3a', legs: '#4a3a2a', cape: '#a8842a' }, style: 'dual', extras: ['tricorn', 'lootBag', 'goldCoins'] },
};

const bone = (root, n) => root.getObjectByName(n.replace(/\./g, '')) || root.getObjectByName(n);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...extra });
const glowMat = (color, k = 1.4, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3, ...extra });

// grupo preso a um osso, onde 1 unidade = 1 metro (desfaz a escala do personagem)
// medidas do corpo (m): cabeça de 0,95 a 1,80 (largura ~0,84); tronco ~0,62 de largura; peito em 0,73
const PART_SCALE = { head: 1.65, chest: 1.3, hips: 1.4 };
function socket(root, boneName) {
  const b = bone(root, boneName) || root;
  root.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); b.getWorldScale(ws);
  const g = new THREE.Group(); g.scale.setScalar((PART_SCALE[boneName] || 1) / ws.x);
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
  belt(root) { const g = socket(root, 'hips'); const b = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 18), std('#5a3a22')); b.rotation.x = Math.PI / 2; b.position.y = 0.1; b.scale.set(1, 1.15, 1); g.add(b); const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), std('#d8b04a', { metalness: 0.7 })); buckle.position.set(0, 0.1, 0.22); g.add(buckle); },
  pauldrons(root) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.24, 0.1, 0); socket(root, 'chest').add(g);
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#4a5266', { metalness: 0.7, roughness: 0.35 })); plate.position.y = 0.04; plate.scale.set(1.1, 0.8, 1.1); g.add(plate);
      for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), std('#c8ccd6', { metalness: 0.8 })); sp.position.set((i - 1) * 0.07, 0.15, 0); g.add(sp); }
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
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 28), glowMat('#ffe680', 2.2)); h.rotation.x = Math.PI / 2; h.position.y = 0.6; g.add(h);
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
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 48), glowMat('#c07aff', 2.2)), r2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 6, 48), glowMat('#7a9aff', 2));
    g.add(r1, r2); fx.push(t => { r1.rotation.set(Math.PI / 2 + Math.sin(t) * 0.3, t * 0.8, 0); r2.rotation.set(Math.PI / 2 - Math.sin(t * 1.3) * 0.4, -t * 1.1, 0.4); });
  },
  starMotes(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const ms = [];
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), glowMat('#e0c8ff', 2.5)); g.add(m); ms.push(m); }
    fx.push(t => ms.forEach((m, i) => { const k = (t * 0.35 + i / 8) % 1, a = i * 2.4 + t; m.position.set(Math.cos(a) * 0.45, 0.2 + k * 1.8, Math.sin(a) * 0.45); m.scale.setScalar(1 - k); }));
  },
  circlet(root) { const g = socket(root, 'head'); const c = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 6, 28), std('#d8b04a', { metalness: 0.8, roughness: 0.3 })); c.rotation.x = Math.PI / 2; c.position.y = 0.38; c.scale.set(1, 1.1, 1); g.add(c); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), glowMat('#7affd0', 1.8)); gem.position.set(0, 0.38, 0.25); g.add(gem); },
  elementOrbs(root, fx) {
    const g = new THREE.Group(); g.position.y = 1.55; root.parent.add(g); const os = [];
    for (const c of ['#ff6a3d', '#4aa3ff', '#c49a55', '#a6ec7c']) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMat(c, 1.8)); g.add(o); os.push(o); }
    fx.push(t => os.forEach((o, i) => { const a = t * 1.2 + i * Math.PI / 2; o.position.set(Math.cos(a) * 0.5, Math.sin(t * 2 + i) * 0.08, Math.sin(a) * 0.5); }));
  },
  quiver(root) {
    const g = socket(root, 'chest');
    const q = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.42, 10), std('#6b4426')); q.position.set(0.1, 0.05, -0.3); q.rotation.z = -0.45; g.add(q);
    for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), std('#d8c8a0')); a.position.set(0.16 + (i - 1.5) * 0.02, 0.3, -0.3 + (i % 2) * 0.02); a.rotation.z = -0.45; g.add(a); const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 3), std('#e04848')); f.position.set(0.2 + (i - 1.5) * 0.02, 0.4, -0.3 + (i % 2) * 0.02); f.rotation.z = -0.45; g.add(f); }
  },
  featherBand(root) { const g = socket(root, 'head'); const b = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 24), std('#5a3a22')); b.rotation.x = Math.PI / 2; b.position.y = 0.36; b.scale.set(1, 1.1, 1); g.add(b); const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#e8e0c8')); f.scale.set(0.35, 2.4, 0.9); f.position.set(-0.2, 0.55, -0.1); f.rotation.z = 0.5; g.add(f); const f2 = f.clone(); f2.material = std('#7a4a2a'); f2.position.set(-0.24, 0.5, -0.06); f2.rotation.z = 0.8; g.add(f2); },
  falcon(root, fx) {
    const g = socket(root, 'chest'); const bird = new THREE.Group(); bird.position.set(0.4, 0.13, -0.03); bird.scale.setScalar(1.35); g.add(bird);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std('#7a5a3a')); body.scale.set(0.9, 1.1, 1.4); bird.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), std('#e8d8b8')); chest.position.set(0, 0.02, 0.05); bird.add(chest);
    const head = new THREE.Group(); head.position.set(0, 0.1, 0.05); bird.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std('#5a4030')));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 5), std('#f0c040')); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.01, 0.06); head.add(beak);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), std('#111')); e.position.set(s * 0.028, 0.012, 0.035); head.add(e); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.12), std('#5a4030')); tail.position.set(0, -0.04, -0.12); tail.rotation.x = 0.4; bird.add(tail);
    fx.push(t => { head.rotation.y = Math.sin(t * 0.9) * 0.8 * (Math.sin(t * 0.3) > 0 ? 1 : 0.2); });
  },
  lute(root) {
    const g = socket(root, 'chest'); const l = new THREE.Group(); l.position.set(-0.05, 0.02, -0.31); l.rotation.set(0.15, 0, 0.6); g.add(l);
    const bodyL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), std('#b8743a')); bodyL.scale.set(1, 1.25, 0.45); l.add(bodyL);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), std('#2a1408')); hole.position.set(0, 0.02, -0.07); hole.rotation.y = Math.PI; l.add(hole);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.03), std('#6b3a1a')); neck.position.y = 0.32; l.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), std('#4a2810')); head.position.y = 0.5; head.rotation.x = 0.4; l.add(head);
  },
  bardHat(root) { const g = socket(root, 'head'); const hat = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 8), std('#5a1a4a')); hat.scale.set(1.05, 0.35, 1.05); hat.position.set(0.04, 0.5, -0.02); hat.rotation.z = -0.25; g.add(hat); const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 20), std('#d8a03a')); band.rotation.x = Math.PI / 2; band.position.set(0.02, 0.44, -0.02); g.add(band); const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std('#ff5a8a')); f.scale.set(0.35, 3.2, 0.8); f.position.set(-0.18, 0.66, -0.1); f.rotation.z = 0.6; g.add(f); },
  musicNotes(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const ns = [];
    for (let i = 0; i < 3; i++) { const n = new THREE.Group(); const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glowMat('#ffb3d9', 1.5)); h.scale.set(1.3, 1, 0.6); const st = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.01), glowMat('#ffb3d9', 1.5)); st.position.set(0.035, 0.05, 0); n.add(h, st); g.add(n); ns.push(n); }
    fx.push(t => ns.forEach((n, i) => { const k = (t * 0.4 + i / 3) % 1; n.position.set(Math.sin(t + i * 2) * 0.4, 1.1 + k * 1.1, Math.cos(t + i * 2) * 0.4); n.scale.setScalar(Math.sin(k * Math.PI)); }));
  },
  bandana(root) { const g = socket(root, 'head'); const b = new THREE.Mesh(new THREE.SphereGeometry(0.265, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.3), std('#2a2a33')); b.position.y = 0.26; b.scale.set(1.02, 0.95, 1.05); g.add(b); for (const s of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.015), std('#2a2a33')); tail.position.set(s * 0.04, 0.24, -0.27); tail.rotation.set(0.3, 0, s * 0.35); g.add(tail); } },
  scarf(root) { const g = socket(root, 'chest'); const s = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 18), std('#4a3a5a')); s.rotation.x = Math.PI / 2; s.position.y = 0.2; g.add(s); },
  shadowHood(root) {
    const g = socket(root, 'head');
    // casca de esfera com a abertura virada para a frente (+Z), deixando o rosto à mostra
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 14, Math.PI * 0.86, Math.PI * 1.28, 0, Math.PI * 0.66), std('#1a1424', { side: THREE.DoubleSide }));
    hood.position.set(0, 0.26, -0.02); hood.scale.set(1.08, 1.12, 1.1); g.add(hood);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), std('#1a1424')); tip.position.set(0, 0.42, -0.24); tip.rotation.x = -1.0; g.add(tip);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 6, 24, Math.PI), glowMat('#9a5aff', 1.4)); trim.position.set(0, 0.2, 0.17); trim.rotation.set(-0.35, 0, 0); g.add(trim);
  },
  mask(root) { const g = socket(root, 'head'); const m = new THREE.Mesh(new THREE.SphereGeometry(0.255, 14, 8, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.22), std('#120c18', { side: THREE.DoubleSide })); m.position.y = 0.2; g.add(m); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), glowMat("#c08aff", 2.5)); e.position.set(s * 0.08, 0.27, 0.23); g.add(e); } },
  shoulderSpikes(root) {
    for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.24, 0.1, 0); socket(root, 'chest').add(g); for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2 - i * 0.04, 5), glowMat('#6a2aaa', 0.7)); sp.position.set(0, 0.12, (i - 1) * 0.06); sp.rotation.z = -s * (0.3 + i * 0.25); g.add(sp); } }
  },
  shadowWisps(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const ws = [];
    for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: '#2a0a4a', emissive: '#6a2aaa', emissiveIntensity: 0.8, transparent: true, opacity: 0.55, depthWrite: false })); g.add(w); ws.push(w); }
    fx.push(t => ws.forEach((w, i) => { const k = (t * 0.5 + i / 7) % 1, a = i * 2.1 + t * 0.7; w.position.set(Math.cos(a) * 0.4, 0.1 + k * 1.4, Math.sin(a) * 0.4); w.scale.setScalar(1.2 - k); w.material.opacity = 0.55 * (1 - k); }));
  },
  tricorn(root) {
    const g = socket(root, 'head'); const hat = new THREE.Group(); hat.position.y = 0.5; g.add(hat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.16, 12), std('#2a1e14')); crown.position.y = 0.06; hat.add(crown);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.03), std('#2a1e14')); brim.position.set(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2); brim.rotation.y = -a + Math.PI / 2; brim.rotation.x = -0.35; hat.add(brim); const trim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.035), std('#d8b04a', { metalness: 0.7 })); trim.position.set(Math.cos(a) * 0.205, 0.1, Math.sin(a) * 0.205); trim.rotation.y = -a + Math.PI / 2; trim.rotation.x = -0.35; hat.add(trim); }
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std('#f2ecd8')); skull.position.set(0, 0.06, 0.2); hat.add(skull);
  },
  lootBag(root) { const g = socket(root, 'chest'); const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), std('#8a6a3a')); b.position.set(-0.08, -0.05, -0.33); b.scale.set(1, 1.1, 0.8); g.add(b); const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), std('#d8b04a')); tie.position.set(-0.08, 0.12, -0.33); tie.rotation.x = Math.PI / 2; g.add(tie); },
  goldCoins(root, fx) {
    const g = new THREE.Group(); root.parent.add(g); const cs = [];
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), glowMat('#ffd84a', 0.6, { metalness: 0.9 })); c.rotation.x = Math.PI / 2; g.add(c); cs.push(c); }
    fx.push(t => cs.forEach((c, i) => { const a = t * 1.4 + i * Math.PI / 2; c.position.set(Math.cos(a) * 0.5, 0.75 + Math.sin(t * 3 + i) * 0.1, Math.sin(a) * 0.5); c.rotation.y = t * 4; }));
  },
};

// pega um acessório de outro modelo (ex.: besta do Ladino) e prende no mesmo osso
function borrow(root, MODELS, model, itemName) {
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
