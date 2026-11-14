/* =========================================================================
   PRIMEIRA PESSOA DE VERDADE (P-032, etapas 1 e 2)
   Os braços da 1ª pessoa são os do PRÓPRIO herói: uma segunda cópia do corpo realista
   (mesma raça, pele, roupa da classe, luvas e a arma de verdade na mão), presa à câmera,
   da qual só os braços aparecem. As mãos vão para o lugar certo da tela por IK de dois ossos
   (ombro → cotovelo → punho), o punho gira para a arma ficar bem apresentada e os dedos
   fecham no cabo (ou ficam abertos e vivos, para quem conjura).
   Etapa 2: golpes por quadros-chave e em combo para cada arma, arco puxando a corda com a flecha,
   besta com coice e recarga, magia acesa entre os dedos, instrumento do Bardo e escudo que levanta ao apanhar.
   Tudo é calculado a cada quadro a partir da pose de repouso: nada acumula.
   ========================================================================= */
import * as THREE from 'three';
import { stringFx } from './bow3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const smooth = k => k * k * (3 - 2 * k);
const clamp01 = k => Math.max(0, Math.min(1, k));

/* Poses paradas por tipo, no espaço da câmera (x direita, y cima, olhar = -z), em metros:
   r/l = punho direito/esquerdo · rd/ld = para onde aponta a arma (eixo y da peça) · rf/lf = nós dos dedos · rp/lp = normal da palma
   ro/lo = mão aberta (0 = fechada no cabo) · hold = o que a mão esquerda faz */
const POSES = {
  swing:  { r: [0.16, -0.15, -0.44], rd: [-0.12, 0.78, -0.62], rf: [-0.25, 0.15, -1], l: [-0.19, -0.17, -0.42], lf: [0.2, 0.1, -1], lp: [0.5, -1, 0], lo: 0.35 },
  shield: { r: [0.16, -0.15, -0.44], rd: [-0.12, 0.78, -0.62], rf: [-0.25, 0.15, -1], l: [-0.17, -0.27, -0.38], hold: 'shield' },
  heavy:  { r: [0.12, -0.16, -0.42], rd: [-0.3, 0.85, -0.45], rf: [-0.3, 0.1, -1], hold: 'grip2', grip2: -0.12 },
  spear:  { r: [0.15, -0.19, -0.34], rd: [-0.18, 0.22, -1], rf: [-0.3, 1, 0.1], hold: 'grip2', grip2: 0.34 },
  dagger: { r: [0.16, -0.13, -0.42], rd: [0.15, 0.55, -0.85], rf: [-0.2, 0.2, -1], l: [-0.16, -0.14, -0.42], lf: [0.15, 0.25, -1], lp: [0.4, -1, 0], lo: 1 },
  katar:  { r: [0.15, -0.15, -0.42], rd: [-0.12, 0.15, -1], rp: [-1, -0.3, 0], l: [-0.15, -0.15, -0.42], ld: [0.12, 0.15, -1], lp: [1, -0.3, 0], hold: 'katar' },
  fist:   { r: [0.16, -0.13, -0.42], rf: [-0.15, 0.25, -1], rp: [-0.4, -1, 0], ro: 1, l: [-0.16, -0.14, -0.42], lf: [0.15, 0.25, -1], lp: [0.4, -1, 0], lo: 1 },
  bow:    { r: [0.17, -0.18, -0.40], rf: [-0.2, 0.1, -1], rp: [-0.6, -1, 0], ro: 0.55, l: [-0.13, -0.13, -0.50], ld: [0.42, 1, -0.1], lf: [0.25, 0, -1], hold: 'bow' },
  xbow:   { r: [0.13, -0.17, -0.40], rd: [-0.03, 0.04, -1], rf: [0, 1, 0], hold: 'xbow' },
  magic:  { r: [0.23, -0.15, -0.50], rf: [-0.1, 0.35, -1], rp: [-0.35, 0.8, 0], ro: 0.25, l: [-0.24, -0.16, -0.50], lf: [0.25, 0.25, -1], lp: [0.35, 0.8, 0], lo: 0.3 },
  staff:  { r: [0.21, -0.17, -0.50], rd: [-0.05, 0.98, -0.15], rf: [-0.3, 0.1, -1], l: [-0.24, -0.17, -0.50], lf: [0.25, 0.25, -1], lp: [0.35, 0.8, 0], lo: 0.3 },
  lute:   { hold: 'inst', ro: 0.35, lo: 0.6 },
  flute:  { hold: 'inst', ro: 0.45, lo: 0.45 },
};
/* Golpes: quadros-chave (t de 0 a 1); o que um quadro não diz vem da pose parada. Cada arma tem um combo que alterna. */
const SW_A = [ // espada: diagonal de cima à direita para baixo à esquerda
  { t: 0.28, r: [0.27, 0.03, -0.34], rd: [0.55, 0.7, 0.45], rf: [0.3, 0.6, -1] },
  { t: 0.42, r: [0.14, -0.04, -0.50], rd: [-0.15, 0.55, -0.82], rf: [-0.3, 0.3, -1] },
  { t: 0.56, r: [-0.08, -0.17, -0.52], rd: [-0.85, -0.12, -0.5], rf: [-0.7, -0.1, -1], l: [-0.24, -0.21, -0.38] },
  { t: 0.72, r: [-0.11, -0.19, -0.48], rd: [-0.8, -0.3, -0.45], rf: [-0.6, -0.2, -1] }];
const SW_B = [ // espada: revés, da esquerda para a direita
  { t: 0.28, r: [-0.05, -0.02, -0.38], rd: [-0.75, 0.6, 0.15], rf: [-0.6, 0.3, -1] },
  { t: 0.44, r: [0.10, -0.10, -0.55], rd: [-0.1, 0.4, -0.9], rf: [0, 0.2, -1] },
  { t: 0.58, r: [0.30, -0.18, -0.46], rd: [0.9, -0.1, -0.4], rf: [0.6, 0, -1] },
  { t: 0.74, r: [0.30, -0.22, -0.42], rd: [0.8, -0.35, -0.3] }];
const SW_C = [ // espada: estocada
  { t: 0.30, r: [0.17, -0.12, -0.30], rd: [0.05, 0.3, -1], rf: [-0.2, 1, 0] },
  { t: 0.50, r: [0.06, -0.08, -0.64], rd: [-0.02, 0.15, -1], rf: [-0.2, 1, 0] },
  { t: 0.70, r: [0.07, -0.09, -0.60], rd: [-0.02, 0.2, -1], rf: [-0.2, 1, 0] }];
const CLIPS = {
  swing: [SW_A, SW_B, SW_C], shield: [SW_A, SW_B, SW_C],
  heavy: [[ // montante: golpe de cima para baixo
    { t: 0.35, r: [0.15, 0.0, -0.34], rd: [0.35, 0.6, 0.72], rf: [0.2, 1, 0.2] },
    { t: 0.50, r: [0.06, -0.04, -0.48], rd: [0, 0.7, -0.7], rf: [0, 0.4, -1] },
    { t: 0.64, r: [0.0, -0.22, -0.52], rd: [0, -0.4, -0.92], rf: [0, -0.5, -1] },
    { t: 0.78, r: [0.0, -0.23, -0.50], rd: [0, -0.45, -0.9], rf: [0, -0.5, -1] }], [ // montante: varrida horizontal
    { t: 0.35, r: [0.30, -0.05, -0.30], rd: [0.8, 0.45, 0.4], rf: [0.5, 0.3, -1] },
    { t: 0.50, r: [0.12, -0.12, -0.52], rd: [0, 0.35, -0.95], rf: [-0.2, 0.3, -1] },
    { t: 0.65, r: [-0.22, -0.16, -0.44], rd: [-0.95, 0.05, -0.3], rf: [-0.8, 0, -1] },
    { t: 0.80, r: [-0.22, -0.18, -0.42], rd: [-0.9, -0.1, -0.2], rf: [-0.8, 0, -1] }]],
  spear: [[{ t: 0.30, r: [0.17, -0.17, -0.20] }, { t: 0.50, r: [0.10, -0.12, -0.58] }, { t: 0.70, r: [0.11, -0.13, -0.54] }],
          [{ t: 0.30, r: [0.18, -0.14, -0.22], rd: [-0.1, 0.35, -1] }, { t: 0.50, r: [0.09, -0.06, -0.58], rd: [-0.15, 0.3, -1] }, { t: 0.70, r: [0.1, -0.08, -0.54] }]],
  dagger: [[{ t: 0.25, r: [0.19, -0.12, -0.32], rd: [0.2, 0.6, -0.8] }, { t: 0.45, r: [0.07, -0.07, -0.62], rd: [0, 0.2, -1], rf: [-0.1, 1, 0] }, { t: 0.65, r: [0.08, -0.08, -0.58], rd: [0, 0.2, -1], rf: [-0.1, 1, 0] }],
           [{ t: 0.30, r: [0.26, 0.0, -0.36], rd: [0.4, 0.8, 0.2], rf: [0.2, 0.6, -1] }, { t: 0.55, r: [-0.05, -0.2, -0.5], rd: [-0.8, -0.4, -0.4], rf: [-0.6, -0.2, -1] }]],
  katar: [[{ t: 0.20, r: [0.17, -0.14, -0.34] }, { t: 0.45, r: [0.05, -0.08, -0.66], rd: [-0.03, 0.08, -1] }, { t: 0.65, r: [0.06, -0.09, -0.6] }],
          [{ t: 0.20, l: [-0.17, -0.14, -0.34] }, { t: 0.45, l: [-0.05, -0.08, -0.66], ld: [0.03, 0.08, -1] }, { t: 0.65, l: [-0.06, -0.09, -0.6] }]],
  fist: [[{ t: 0.20, r: [0.17, -0.14, -0.34] }, { t: 0.45, r: [0.05, -0.07, -0.64], rf: [-0.1, 0.1, -1] }, { t: 0.65, r: [0.06, -0.08, -0.6] }],
         [{ t: 0.20, l: [-0.17, -0.14, -0.34] }, { t: 0.45, l: [-0.05, -0.07, -0.64], lf: [0.1, 0.1, -1] }, { t: 0.65, l: [-0.06, -0.08, -0.6] }],
         [{ t: 0.30, r: [0.25, -0.10, -0.36], rf: [-0.3, 0.2, -1] }, { t: 0.55, r: [-0.04, -0.06, -0.50], rf: [-1, 0.2, -0.4], rp: [0, -1, 0.3] }, { t: 0.72, r: [-0.05, -0.08, -0.48] }]],
  staff: [[{ t: 0.35, r: [0.18, -0.06, -0.40], rd: [0.1, 0.95, 0.2] },
           { t: 0.55, r: [0.12, -0.08, -0.62], rd: [-0.05, 0.75, -0.65], l: [-0.16, -0.10, -0.60], lf: [0.1, 0.5, -1], lp: [0.3, 0.2, -1], lo: 0.05 },
           { t: 0.75, r: [0.14, -0.10, -0.58], l: [-0.18, -0.12, -0.56] }]],
  magic: [[{ t: 0.35, r: [0.20, -0.10, -0.40], rp: [-0.3, 0.6, -0.3] }, { t: 0.55, r: [0.12, -0.07, -0.64], rf: [-0.1, 0.6, -1], rp: [-0.2, 0.2, -1], ro: 0.05 }, { t: 0.8, r: [0.14, -0.09, -0.6] }],
          [{ t: 0.35, l: [-0.20, -0.10, -0.40], lp: [0.3, 0.6, -0.3] }, { t: 0.55, l: [-0.12, -0.07, -0.64], lf: [0.1, 0.6, -1], lp: [0.2, 0.2, -1], lo: 0.05 }, { t: 0.8, l: [-0.14, -0.09, -0.6] }]],
  spell: [[{ t: 0.35, r: [0.08, -0.12, -0.40], l: [-0.08, -0.12, -0.40], rp: [-1, 0.3, 0], lp: [1, 0.3, 0], ro: 0.35, lo: 0.35 },
           { t: 0.60, r: [0.12, -0.06, -0.62], l: [-0.12, -0.06, -0.62], rf: [-0.1, 0.6, -1], lf: [0.1, 0.6, -1], rp: [-0.2, 0.2, -1], lp: [0.2, 0.2, -1], ro: 0.05, lo: 0.05 },
           { t: 0.85, r: [0.14, -0.08, -0.58], l: [-0.14, -0.08, -0.58] }]],
};
const DIRS = new Set(['rd', 'rf', 'rp', 'ld', 'lf', 'lp']);
function sample(idle, keys, s) { // valor de cada campo no instante s do golpe (suave entre os quadros)
  const out = {};
  for (const f of ['r', 'rd', 'rf', 'rp', 'ro', 'l', 'ld', 'lf', 'lp', 'lo']) {
    const pts = [{ t: 0, v: idle[f] }]; for (const k of keys) if (k[f] !== undefined) pts.push({ t: k.t, v: k[f] }); pts.push({ t: 1, v: idle[f] });
    let a = pts[0], b = pts[pts.length - 1]; for (let i = 0; i < pts.length - 1; i++) if (s >= pts[i].t && s <= pts[i + 1].t) { a = pts[i]; b = pts[i + 1]; break; }
    const w = smooth(clamp01((s - a.t) / Math.max(1e-4, b.t - a.t))), va = a.v ?? b.v, vb = b.v ?? a.v;
    if (va === undefined) continue;
    if (typeof va === 'number') { out[f] = va + (vb - va) * w; continue; }
    const v = V(va[0] + (vb[0] - va[0]) * w, va[1] + (vb[1] - va[1]) * w, va[2] + (vb[2] - va[2]) * w); out[f] = DIRS.has(f) ? v.normalize() : v;
  }
  return out;
}
const toV = a => a && (a.isVector3 ? a.clone() : V(a[0], a[1], a[2]));

/* brilho da magia entre os dedos: núcleo, halo e faíscas girando (cor da classe; na cor do elemento ao conjurar) */
let _haloTex = null;
function haloTex() { if (_haloTex) return _haloTex; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_haloTex = new THREE.CanvasTexture(c)); }
function makeGlow(color, size = 1) {
  const g = new THREE.Group(), col = new THREE.Color(color);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.014 * size, 16, 12), new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.55), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: col, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(0.11 * size);
  const sparks = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0035 * size, 6, 4), core.material.clone()); g.add(m); sparks.push({ m, a: i * 1.047, r: 0.026 + (i % 3) * 0.008, h: (i % 2 ? 1 : -1) * 0.01, sp: 2.2 + (i % 3) * 0.7 }); }
  g.add(core, halo); g.traverse(o => { if (o.isMesh || o.isSprite) { o.renderOrder = 12; o.frustumCulled = false; } });
  g.userData = { col, base: col.clone(), size, set(c) { col.set(c); core.material.color.copy(col).lerp(new THREE.Color('#ffffff'), 0.55); halo.material.color.copy(col); sparks.forEach(s => s.m.material.color.copy(core.material.color)); },
    tick(t, flare) { const p = 1 + Math.sin(t * 5.3) * 0.08 + flare * 0.9; core.scale.setScalar(p); halo.scale.setScalar(0.11 * size * (1 + Math.sin(t * 3.1) * 0.12 + flare * 1.6)); halo.material.opacity = 0.65 + flare * 0.35;
      sparks.forEach(s => { const a = s.a + t * s.sp; s.m.position.set(Math.cos(a) * s.r * (1 + flare), s.h + Math.sin(t * 3 + s.a) * 0.008, Math.sin(a) * s.r * (1 + flare)); }); } };
  return g;
}

export function makeFirstPerson(ch, { kind = 'swing', items = {}, glow = null, makeArrow = null } = {}) {
  const root = ch.obj; root.name = 'fp_view';
  const B = {}; ch.root.traverse(o => { if (o.isBone) B[o.name] = o; });
  // fora de cena só os braços: cabeça, cabelo, pernas e tronco somem (a câmera está dentro da cabeça)
  // arco: na 1ª pessoa ele está sempre na mão esquerda (fora dela vai nas costas)
  if (ch.root.userData.bowState) ch.root.userData.bowState('hand');
  if (ch.root.userData.xbowState) ch.root.userData.xbowState('hand'); // besta: sempre na mão direita
  // instrumento do Bardo: sai do corpo e fica num suporte próprio na frente da câmera (as mãos vão aos pontos de tocar dele)
  const instI = ch.root.userData.instrument, instHolder = new THREE.Group(); root.add(instHolder);
  if (instI && (kind === 'lute' || kind === 'flute')) { instHolder.add(instI.obj); instI.obj.position.set(0, 0, 0); instI.obj.quaternion.identity(); instI.obj.traverse(o => { if (o.userData && o.userData.strap) o.userData.strap.visible = false; }); }
  // do corpo só ficam os BRAÇOS: em cada malha com esqueleto guardamos só os triângulos que se movem com ombro→dedos
  // (vale para qualquer roupa: no corpo feminino braços e pernas vêm numa malha só, e a pele das mãos fica no corpo base)
  const ARM = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/;
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = false; o.frustumCulled = false; o.renderOrder = 10;
    if (o.isSkinnedMesh) {
      if (/Hair|Eyebrow|Eyes|Beard/i.test(o.name)) { o.visible = false; return; }
      const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones; if (!si || !sw) { o.visible = false; return; }
      const armW = new Float32Array(si.count); for (let v = 0; v < si.count; v++) { let w = 0; for (let k = 0; k < 4; k++) { const b = bones[si.getComponent(v, k)]; if (b && ARM.test(b.name)) w += sw.getComponent(v, k); } armW[v] = w; }
      const src = g.index ? g.index.array : Array.from({ length: si.count }, (_, i) => i), keep = [];
      for (let t = 0; t < src.length; t += 3) { const a0 = src[t], a1 = src[t + 1], a2 = src[t + 2]; if (armW[a0] > 0.5 && armW[a1] > 0.5 && armW[a2] > 0.5) keep.push(a0, a1, a2); }
      if (!keep.length) { o.visible = false; return; }
      const ng = g.clone(); ng.setIndex(keep); o.geometry = ng; // cópia: a geometria original é compartilhada com os outros personagens
    } else { // peças presas a ossos (ombreira, capa, chapéu): só as dos braços e o que está nas mãos
      let p = o.parent; while (p && !p.isBone) p = p.parent; if (p && !ARM.test(p.name)) o.visible = false; // sem osso = suporte da 1ª pessoa (instrumento)
    }
  });
  // tronco e pescoço encolhem dentro do peito: só ficam os braços a partir do ombro (mangas e luvas da roupa)
  const hideBones = ['neck_01', 'Head', 'thigh_l', 'thigh_r'];
  // a base é a pose de LIGAÇÃO do esqueleto (o makeHero já vem na pose parada, com o tronco torcido: os ombros saíam tortos)
  { let sk = null; ch.root.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o.skeleton; }); if (sk) sk.pose(); }
  // pose de repouso guardada (tudo volta a ela a cada quadro)
  const rest = new Map(); for (const b of Object.values(B)) rest.set(b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() });
  const resetPose = () => { for (const [b, r] of rest) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); } for (const n of hideBones) if (B[n]) B[n].scale.setScalar(0.001); };

  // olhos do herói ficam na câmera: medimos a cabeça e o ombro na pose de repouso, já virado para -z
  root.rotation.set(0, Math.PI, 0); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  resetPose(); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), loc = b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  // os OMBROS ficam onde estariam num corpo de verdade: 21 cm abaixo dos olhos e 6 cm atrás deles
  const sh = loc(B.upperarm_l).add(loc(B.upperarm_r)).multiplyScalar(0.5).applyAxisAngle(V(0, 1, 0), Math.PI);
  const base = V(-sh.x, -0.21 - sh.y, 0.06 - sh.z); root.position.copy(base);

  // eixos de cada mão no espaço do osso: "fwd" = punho → nós dos dedos, "palm" = normal da palma, "rad" = lado do polegar
  const handAxes = side => { const h = B['hand_' + side], m = B['middle_01_' + side], t = B['thumb_01_' + side], ix = B['index_01_' + side], pk = B['pinky_01_' + side];
    const fwd = m.position.clone().normalize(), rad = ix.position.clone().sub(pk.position).normalize(); rad.sub(fwd.clone().multiplyScalar(rad.dot(fwd))).normalize();
    let palm = new THREE.Vector3().crossVectors(fwd, rad).normalize(); if (palm.dot(t.position) < 0) palm.negate(); if (side === 'l') palm.negate(); // pelo polegar acerta a mão direita; na esquerda (espelhada) o polegar fica de lado e engana — conferido fechando o punho
    return { fwd, rad, palm }; };
  const AX = { r: handAxes('r'), l: handAxes('l') };
  // eixo de curvatura dos dedos (no espaço de cada falange, medido no repouso): dobra a ponta do dedo para a palma
  const curlAxis = new Map();
  const prep = side => { root.updateMatrixWorld(true); const hq = B['hand_' + side].getWorldQuaternion(new THREE.Quaternion()); const ax = AX[side];
    const palmW = ax.palm.clone().applyQuaternion(hq), fwdW = ax.fwd.clone().applyQuaternion(hq), axisW = new THREE.Vector3().crossVectors(fwdW, palmW).normalize(); // gira fwd → palma
    for (const f of [...FINGERS, 'thumb']) for (let k = 1; k <= 3; k++) { const b = B[`${f}_0${k}_${side}`]; if (!b) continue; const bq = b.getWorldQuaternion(new THREE.Quaternion()).invert();
      let a = axisW.clone(); if (f === 'thumb') a = palmW.clone().add(fwdW.clone().multiplyScalar(0.4)).normalize().cross(axisW).normalize().negate().lerp(axisW, 0.5).normalize(); curlAxis.set(b, a.applyQuaternion(bq).normalize()); } };
  prep('r'); prep('l');

  // eixo da arma no espaço da mão (a lâmina/cabo corre no eixo y da peça)
  const weapons = { r: [], l: [] }; for (const [name, it] of Object.entries(items)) { let p = it.parent, side = null; while (p) { if (p === B.hand_r) { side = 'r'; break; } if (p === B.hand_l) { side = 'l'; break; } p = p.parent; } if (side) weapons[side].push({ name, it }); }
  const weaponAxis = side => { const w = weapons[side][0]; if (!w) return null; root.updateMatrixWorld(true); const hq = B['hand_' + side].getWorldQuaternion(new THREE.Quaternion()).invert(); return V(0, 1, 0).applyQuaternion(w.it.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(hq).normalize(); };
  const WAX = { r: weaponAxis('r'), l: weaponAxis('l') };
  // escudo: preso no ANTEBRAÇO; a frente dele é o eixo mais fino da peça (medido no espaço do antebraço)
  let shieldN = null; const shield = items.shield; if (shield) { root.updateMatrixWorld(true); const bb = new THREE.Box3(), mi = new THREE.Matrix4().copy(B.lowerarm_l.matrixWorld).invert();
    shield.updateMatrixWorld(true); shield.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(mi, o.matrixWorld))); } });
    const sz = bb.getSize(new THREE.Vector3()), c0 = bb.getCenter(new THREE.Vector3()), n = sz.x < sz.y && sz.x < sz.z ? V(1, 0, 0) : sz.y < sz.z ? V(0, 1, 0) : V(0, 0, 1);
    const axis = B.hand_l.position.clone().normalize(); if (c0.clone().sub(axis.clone().multiplyScalar(c0.dot(axis))).dot(n) < 0) n.negate(); shieldN = n; } // aponta para o lado de fora (onde está a face)
  const twistBone = (bone, localN, wantW) => { // gira o osso em volta do próprio eixo para a normal localN olhar o mais perto possível de wantW
    const child = bone.children.find(c => c.isBone); if (!child) return; const bw = bone.getWorldQuaternion(new THREE.Quaternion()), ax = wp(child).sub(wp(bone)).normalize();
    const n = localN.clone().applyQuaternion(bw), a = n.sub(ax.clone().multiplyScalar(n.dot(ax))).normalize(), b = wantW.clone().sub(ax.clone().multiplyScalar(wantW.dot(ax))).normalize();
    let ang = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))); if (new THREE.Vector3().crossVectors(a, b).dot(ax) < 0) ang = -ang;
    const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion()); bone.quaternion.copy(pw.invert().multiply(new THREE.Quaternion().setFromAxisAngle(ax, ang).multiply(bw))); bone.updateMatrixWorld(true); };

  // ----- IK de dois ossos em espaço de mundo -----
  const wp = b => b.getWorldPosition(new THREE.Vector3());
  const aimBone = (bone, from, to) => { // gira o osso (no mundo) para que a direção atual from→filho vire from→to
    const child = bone.children.find(c => c.isBone); if (!child) return; const cur = wp(child).sub(from).normalize(), want = to.clone().sub(from).normalize();
    _q.setFromUnitVectors(cur, want); const bw = bone.getWorldQuaternion(new THREE.Quaternion()), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); bone.updateMatrixWorld(true); };
  const solveArm = (side, target, pole) => {
    const ua = B['upperarm_' + side], la = B['lowerarm_' + side], hd = B['hand_' + side];
    const S0 = wp(ua), E0 = wp(la), W0 = wp(hd), a = S0.distanceTo(E0), b = E0.distanceTo(W0);
    const d = Math.min(target.distanceTo(S0), (a + b) * 0.999), dir = target.clone().sub(S0).normalize();
    const T = S0.clone().addScaledVector(dir, d), x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const pv = pole.clone().sub(S0); pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
    const E = S0.clone().addScaledVector(dir, x).addScaledVector(pv, h);
    aimBone(ua, S0, E); aimBone(la, wp(la), T);
  };
  const orientHand = (side, axisLocal, wantAxis, secLocal, wantSec) => { // gira a mão no mundo: axisLocal → wantAxis e (o mais perto possível) secLocal → wantSec
    const hd = B['hand_' + side];
    const A = wantAxis.clone().normalize(), Fw = wantSec.clone().sub(A.clone().multiplyScalar(wantSec.dot(A))).normalize(), Cw = new THREE.Vector3().crossVectors(A, Fw);
    const a = axisLocal.clone().normalize(), f = secLocal.clone().sub(a.clone().multiplyScalar(secLocal.dot(a))).normalize(), c = new THREE.Vector3().crossVectors(a, f);
    const Mw = new THREE.Matrix4().makeBasis(A, Fw, Cw), Ml = new THREE.Matrix4().makeBasis(a, f, c), Q = new THREE.Quaternion().setFromRotationMatrix(Mw.multiply(Ml.transpose()));
    const pw = hd.parent.getWorldQuaternion(new THREE.Quaternion()); hd.quaternion.copy(pw.invert().multiply(Q)); hd.updateMatrixWorld(true);
    // torção dividida com o antebraço (sem "embrulho de bala" no punho)
  };
  const SG = { r: 1, l: 1 };
  const curl = (side, amt, thumb = amt, spread = 0) => { amt *= SG[side]; thumb *= SG[side];
    FINGERS.forEach((f, i) => { for (let k = 1; k <= 3; k++) { const b = B[`${f}_0${k}_${side}`]; if (!b) continue; const ang = amt * (k === 1 ? 1.25 : k === 2 ? 1.55 : 1.0) * (1 + i * 0.06);
      b.quaternion.multiply(_q2.setFromAxisAngle(curlAxis.get(b), ang)); } });
    for (let k = 1; k <= 3; k++) { const b = B[`thumb_0${k}_${side}`]; if (b) b.quaternion.multiply(_q2.setFromAxisAngle(curlAxis.get(b), thumb * (k === 1 ? 0.5 : 0.9))); }
  };

  // besta: pontos de apoio no espaço da própria peça
  const xbow = items.xbow || null;
  // arco: flecha encaixada enquanto puxa a corda
  const bow = items.bow || null, arrow = bow && makeArrow ? makeArrow() : null;
  if (arrow) { arrow.visible = false; arrow.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 10; o.castShadow = false; } }); root.add(arrow); }
  const strZ = (() => { let z = 0; if (bow) bow.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop < 0.003) z = o.position.z; }); return z; })();
  // magia: brilho entre os dedos (mão direita; a esquerda também para quem conjura sem cajado)
  const palmLocal = side => AX[side].fwd.clone().multiplyScalar(0.075).add(AX[side].palm.clone().multiplyScalar(0.045));
  const glows = {}; if (glow && (kind === 'magic' || kind === 'staff')) for (const sd of kind === 'magic' ? ['r', 'l'] : ['l']) { const g = makeGlow(glow, sd === 'r' ? 1.5 : 1.25); g.position.copy(palmLocal(sd)); B['hand_' + sd].add(g); glows[sd] = g; }
  const camToRoot = (P, Q) => { // ponto/rotação no espaço da câmera → espaço do suporte (root está girado 180° e deslocado)
    const p = V(-(P.x - root.position.x), P.y - root.position.y, -(P.z - root.position.z)); const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI).multiply(Q); return { p, q }; };
  const basisQ = (Y, Z) => { const y = Y.clone().normalize(), z = Z.clone().sub(y.clone().multiplyScalar(Z.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };

  let T = 0, atk = -9, atkDur = 0.45, clip = null, combo = -1, lastEnd = -9, cast = -9, castCol = null, flare = 0, breathe = 0, blockT = 0;
  const api = {
    root, kind, B, SG, glows,
    // golpe normal: escolhe o próximo do combo (se emendar logo depois do anterior) e dura conforme a velocidade de ataque
    attack(k, delay = 0.6) {
      const list = CLIPS[kind]; atk = T; atkDur = kind === 'bow' ? Math.max(0.45, Math.min(1.1, delay * 0.95)) : kind === 'xbow' ? Math.max(0.5, Math.min(1.2, delay * 0.95)) : Math.max(0.3, Math.min(0.6, delay * 0.9));
      if (list) { combo = T - lastEnd < 0.9 ? (combo + 1) % list.length : 0; clip = list[combo]; } else clip = null;
      lastEnd = T + atkDur;
    },
    // habilidade: quem conjura junta as mãos e empurra a magia (na cor do elemento); quem luta faz o próximo golpe do combo
    cast(type, color, delay = 0.6) {
      if (color) { castCol = color; for (const g of Object.values(glows)) g.userData.set(color); }
      if (type === 'spell' && (kind === 'magic' || kind === 'staff' || kind === 'fist' || kind === 'lute' || kind === 'flute')) { cast = T; atk = T; atkDur = 0.6; clip = kind === 'staff' ? CLIPS.staff[0] : CLIPS.spell[0]; lastEnd = T + 0.6; }
      else api.attack(null, delay);
    },
    update(dt, { cam, speed = 0, sprint = false, hurt = 9 }) {
      T += dt; breathe += dt;
      resetPose();
      // balanço: respiração parada, passada ao andar, mais forte correndo
      const w = Math.min(1, speed / 3.2), bobX = Math.cos(T * 4.6) * 0.011 * w, bobY = -Math.abs(Math.sin(T * 4.6)) * 0.014 * w + Math.sin(breathe * 1.5) * 0.004;
      root.position.set(base.x + bobX, base.y + bobY - (sprint ? 0.03 : 0), base.z + (sprint ? 0.02 : 0));
      root.updateMatrixWorld(true);
      const toW = v => v.clone().applyMatrix4(cam.matrixWorld), dirW = v => v.clone().normalize().transformDirection(cam.matrixWorld);
      const P0 = POSES[kind] || POSES.swing, s = (T - atk) / atkDur, on = s >= 0 && s < 1;
      // pose deste quadro = parada (com um leve respirar das mãos) + golpe em andamento
      const idle = { ...P0 }; const sway = V(Math.sin(T * 1.3) * 0.004, Math.sin(T * 1.5 + 1) * 0.005, 0);
      if (idle.r) idle.r = toV(idle.r).add(sway).toArray(); if (idle.l) idle.l = toV(idle.l).add(sway.clone().multiplyScalar(-1)).toArray();
      const S = on && clip ? sample(idle, clip, s) : sample(idle, [], 0);
      let rPos = S.r || V(0.16, -0.15, -0.44), lPos = S.l || V(-0.19, -0.17, -0.42);
      const hold = P0.hold;
      // escudo: levanta para o centro quando apanha (0,6 s)
      if (hold === 'shield') { blockT = hurt < 0.15 ? 1 : Math.max(0, blockT - dt * 2.2); if (blockT > 0) lPos = lPos.clone().lerp(V(-0.07, -0.15, -0.36), smooth(Math.min(1, blockT * 1.4))); }

      // ---------- arco: alcança a corda, puxa até o rosto com a flecha, solta ----------
      let bowPull = null, bowDraw = 0, ro = S.ro, lo = S.lo;
      if (kind === 'bow') {
        const d = on ? (s < 0.18 ? smooth(s / 0.18) * 0.25 : s < 0.72 ? 0.25 + 0.75 * smooth((s - 0.18) / 0.54) : s < 0.78 ? 1 : 0) : 0; bowDraw = d;
        const up = on ? (s < 0.85 ? smooth(Math.min(1, s / 0.25)) : 1 - smooth((s - 0.85) / 0.15)) : 0; // o arco sobe para a mira enquanto puxa
        lPos = lPos.clone().lerp(V(-0.025, -0.05, -0.56), up); S.ld = S.ld.clone().lerp(V(0.14, 1, 0.02), up).normalize(); S.lf = S.lf.clone().lerp(V(0.1, 0, -1), up).normalize();
      }
      // ---------- golpe da mão direita / esquerda ----------
      const rHas = !!(WAX.r && S.rd);
      if (kind === 'lute' || kind === 'flute') { // instrumento num lugar fixo na frente da câmera; as mãos nos pontos de tocar
        const L = kind === 'lute', at = L ? V(0.08, -0.21, -0.42) : V(0.0, -0.15, -0.30), Y = L ? V(-0.88, 0.32, -0.34) : V(1, 0.04, -0.4), Z = L ? V(-0.1, -0.8, -0.6) : V(0, 1, 0.35); // alaúde: o tampo (cordas e boca) virado para quem toca
        const strum = on ? Math.sin(s * Math.PI * 4) * (1 - s) : 0; const { p, q } = camToRoot(at.clone().add(V(0, 0.01 * strum, 0)), basisQ(Y, Z)); instHolder.position.copy(p); instHolder.quaternion.copy(q); instHolder.updateMatrixWorld(true);
        const hs = instI && instI.obj.userData.inst && instI.obj.userData.inst.hands;
        const inv = cam.matrixWorld.clone().invert(), hr = hs ? instI.obj.localToWorld(hs.r.clone()).applyMatrix4(inv) : V(0.1, -0.25, -0.35), hl = hs ? instI.obj.localToWorld(hs.l.clone()).applyMatrix4(inv) : V(-0.15, -0.2, -0.4);
        rPos = hr.add(L ? V(0.02, 0.03 + strum * 0.05, 0.02) : V(0.01, -0.02, 0.02)); lPos = hl.add(L ? V(0, -0.02, 0.02) : V(-0.01, -0.02, 0.02));
        S.rf = L ? V(-0.5, -0.7, -0.5) : V(-0.2, 0.2, -1); S.rp = L ? V(-0.2, 0.1, 1) : V(-0.3, 1, 0.2); S.lf = L ? V(0.2, 0.9, -0.3) : V(0.2, 0.2, -1); S.lp = L ? V(0.6, -0.3, 0.4) : V(0.3, 1, 0.2);
        ro = (L ? 0.35 : 0.5) + (on ? Math.sin(s * 30) * 0.15 : 0); lo = (L ? 0.65 : 0.5) + (on ? Math.sin(s * 23 + 1) * 0.2 : Math.sin(T * 2) * 0.04);
      }
      if (kind === 'xbow') { // coice no tiro e recarga (abaixa e arma de novo)
        const kick = on ? (s < 0.08 ? s / 0.08 : 1 - smooth(Math.min(1, (s - 0.08) / 0.25))) : 0, rel = on ? (s > 0.35 && s < 0.95 ? Math.sin((s - 0.35) / 0.6 * Math.PI) : 0) : 0;
        rPos = rPos.clone().add(V(0, 0.025 * kick - 0.07 * rel, 0.06 * kick + 0.04 * rel)); S.rd = S.rd.clone().lerp(V(0, 0.35, -1), kick * 0.6).lerp(V(0.25, -0.5, -1), rel * 0.6).normalize();
        if (xbow && xbow.userData.setCocked) xbow.userData.setCocked(!on || s > 0.8);
      }
      solveArm('r', toW(rPos), toW(rPos.clone().add(V(0.35, -0.4, 0.15))));
      if (xbow) { const qx = new THREE.Quaternion(), hq = B.hand_r.getWorldQuaternion(new THREE.Quaternion()).invert(); xbow.getWorldQuaternion(qx); const zL = V(0, 0, 1).applyQuaternion(qx).applyQuaternion(hq), yL = V(0, 1, 0).applyQuaternion(qx).applyQuaternion(hq); orientHand('r', zL, dirW(S.rd), yL, dirW(V(0, 1, 0.05))); }
      else if (rHas) orientHand('r', WAX.r, dirW(S.rd), S.rp && !S.rf ? AX.r.palm : AX.r.fwd, dirW(S.rp && !S.rf ? S.rp : S.rf));
      else orientHand('r', AX.r.fwd, dirW(S.rf || V(-0.2, 0.2, -1)), AX.r.palm, dirW(S.rp || V(-0.4, -1, 0)));
      root.updateMatrixWorld(true);
      // mão esquerda: no cabo (duas mãos), no escudo, no arco, na besta, livre…
      if (hold === 'grip2' && WAX.r) { const wd = V(0, 1, 0).applyQuaternion(weapons.r[0].it.getWorldQuaternion(new THREE.Quaternion())).normalize(); const rW = wp(B.hand_r); lPos = rW.addScaledVector(wd, P0.grip2).applyMatrix4(cam.matrixWorld.clone().invert()); }
      if (hold === 'xbow' && xbow) { const fz = xbow.userData.foreZ ?? 0.12; lPos = xbow.localToWorld(V(0, -0.035, fz)).applyMatrix4(cam.matrixWorld.clone().invert()).add(V(-0.015, -0.02, 0)); }
      solveArm('l', toW(lPos), toW(lPos.clone().add(hold === 'shield' ? V(-0.6, -0.25, 0.1) : V(-0.35, -0.4, 0.15))));
      if (hold === 'shield' && shieldN) twistBone(B.lowerarm_l, shieldN, dirW(V(0.1 + blockT * 0.1, 0.05, -1))); // a face do escudo para a frente
      if (hold === 'grip2' && WAX.r) { const wd = V(0, 1, 0).applyQuaternion(weapons.r[0].it.getWorldQuaternion(new THREE.Quaternion())).normalize(), kn = AX.r.fwd.clone().applyQuaternion(B.hand_r.getWorldQuaternion(new THREE.Quaternion())); orientHand('l', AX.l.rad, wd, AX.l.fwd, kn); } // as duas mãos no mesmo cabo: polegares para a lâmina, nós dos dedos para o mesmo lado
      else if (hold === 'xbow') orientHand('l', AX.l.fwd, dirW(V(0.2, 0.15, -1)), AX.l.palm, dirW(V(0.2, 1, 0)));
      else if (WAX.l && S.ld) orientHand('l', WAX.l, dirW(S.ld), S.lp && !S.lf ? AX.l.palm : AX.l.fwd, dirW(S.lp && !S.lf ? S.lp : S.lf));
      else orientHand('l', AX.l.fwd, dirW(S.lf || V(0.2, 0.1, -1)), AX.l.palm, dirW(S.lp || V(0.5, -1, 0)));
      // arco: a mão direita vai à corda e puxa até o rosto; a corda segue os dedos e a flecha fica encaixada
      if (kind === 'bow' && bow) {
        bow.updateWorldMatrix(true, true); const inv = cam.matrixWorld.clone().invert(), strC = bow.localToWorld(V(0, 0, strZ)).applyMatrix4(inv), anchor = V(0.035, -0.075, -0.17);
        const pullC = bowDraw > 0 ? strC.clone().lerp(anchor, Math.max(0, (bowDraw - 0.25) / 0.75)) : null;
        if (pullC) { const tgt = pullC.clone().add(V(0.025, -0.035, 0.07)); const r0 = rPos.clone(), k0 = Math.min(1, bowDraw / 0.25); solveArm('r', toW(r0.lerp(tgt, k0)), toW(tgt.clone().add(V(0.3, -0.15, 0.3)))); orientHand('r', AX.r.fwd, dirW(V(-0.55, 0.05, -1)), AX.r.palm, dirW(V(-0.9, -0.2, 0.3))); ro = 0.55; }
        else if (on && s >= 0.78) { const f = smooth(Math.min(1, (s - 0.78) / 0.07)) * (1 - smooth(Math.max(0, (s - 0.86) / 0.14))); const tgt = rPos.clone().lerp(V(0.08, -0.04, -0.07), f); solveArm('r', toW(tgt), toW(tgt.clone().add(V(0.35, -0.3, 0.15)))); orientHand('r', AX.r.fwd, dirW(V(-0.3, 0.3, -1)), AX.r.palm, dirW(V(-0.6, -0.6, 0.3))); ro = 0.15; }
      }
      // dedos: fechados no cabo / punho cerrado / abertos e vivos para a magia
      const live = Math.sin(T * 1.7) * 0.05;
      curl('r', ro !== undefined ? ro + live : 0.95, ro !== undefined ? Math.min(0.5, ro * 0.6) : 0.8);
      curl('l', lo !== undefined ? lo - live : hold ? 0.95 : 0.45, lo !== undefined ? Math.min(0.5, lo * 0.6) : 0.7);
      ch.root.updateMatrixWorld(true);
      // corda e flecha depois que os dedos fecharam
      if (kind === 'bow' && bow) {
        const pulling = bowDraw > 0.2, cp = pulling ? ['index_02_r', 'index_03_r', 'middle_02_r', 'middle_03_r'].reduce((a, n) => a.add(wp(B[n])), V(0, 0, 0)).multiplyScalar(0.25) : null;
        stringFx(bow, cp || V(), !!cp);
        if (arrow) { arrow.visible = on && bowDraw > 0.3 && s < 0.78 && !!cp; if (arrow.visible) { const tail = cp, grip = bow.localToWorld(V(0, 0.03, (bow.userData.gripZ || -0.11) - 0.02)), dir = grip.clone().sub(tail).normalize(), mid = tail.clone().addScaledVector(dir, 0.37);
          root.updateMatrixWorld(true); arrow.position.copy(root.worldToLocal(mid)); const qw = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir); arrow.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qw)); } }
      }
      // brilho da magia: pulsa, explode no golpe/conjuração e volta à cor da classe
      flare = Math.max(0, flare - dt * 3); if (on && s > 0.45 && s < 0.6 && (kind === 'magic' || kind === 'staff')) flare = 1;
      if (castCol && T - cast > 1.6) { castCol = null; for (const g of Object.values(glows)) g.userData.set(g.userData.base); }
      for (const g of Object.values(glows)) g.userData.tick(T, flare);
    },
  };
  resetPose();
  return api;
}
