/* =========================================================================
   CASTELO DE VALCINZA (S-118) — fortaleza gigante nos Campos de Valcinza.
   Por fora: muralha com ameias, torres redondas, portaria com grade, pátio e
   uma torre de menagem enorme. A porta da torre leva ao interior (sala longe
   do mundo, x = 1750): vestíbulo, salão do trono, biblioteca, capela, arsenal,
   quarto real, quarto de hóspedes e cozinha — com móveis feitos em código.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { heightAt, CASTLE, ZONES, seaDist, mountainMask, groundColor, lakeDist, LAKE } from './world3d.js';
import { Kit, M, rngOf, makeBanner, flame, brazier, axeGeo, archBlocks, gable, stoneTex, woodTex, CULL } from './cities3d.js';

const plainM = {};
const P = (key, color, o = {}) => plainM[key] || (plainM[key] = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1, side: o.side || THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 }));
// pedra clara do castelo (blocos grandes), lajes do piso e tábuas
let _ct = null;
function castleMats() {
  if (_ct) return _ct;
  const mk = (t, tile, o = {}) => { const m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: o.bump ?? 2, roughness: o.rough ?? 0.92, color: o.color || '#ffffff' }); m.userData.tile = tile; return m; };
  _ct = {
    wall: mk(stoneTex({ base: [36, 10, 58], mortar: '#5a544a', rows: [46, 64], wide: [80, 170], seed: 41, moss: 0.4 }), 5),
    inner: mk(stoneTex({ base: [34, 12, 62], mortar: '#6a6252', rows: [50, 66], wide: [90, 180], seed: 43 }), 5, { bump: 1.4 }),
    floor: mk(stoneTex({ base: [30, 8, 46], mortar: '#2e2a26', rows: [110, 140], wide: [110, 160], seed: 45 }), 4, { bump: 1.2, rough: 0.8 }),
    planks: mk(woodTex({ base: [26, 40, 30], seed: 47 }), 2.4, { bump: 1.2 }),
    beam: mk(woodTex({ base: [22, 34, 18], seed: 49 }), 2),
  };
  return _ct;
}
const cloth = (key, color) => P('cl_' + key, color, { rough: 0.95 });
// tapete com borda dourada (textura em canvas)
const rugMats = {};
function rugMat(base, edge) {
  const k = base + edge; if (rugMats[k]) return rugMats[k];
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256); g.strokeStyle = edge; g.lineWidth = 8; g.strokeRect(10, 10, 108, 236); g.lineWidth = 2; g.strokeRect(22, 22, 84, 212);
  for (let y = 40; y < 230; y += 34) { g.beginPath(); g.moveTo(64, y); g.lineTo(84, y + 14); g.lineTo(64, y + 28); g.lineTo(44, y + 14); g.closePath(); g.stroke(); }
  for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 128, Math.random() * 256, 1, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (rugMats[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
}
// vitral colorido (capela)
let stainedM = null;
function stainedGlass() {
  if (stainedM) return stainedM;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'), cols = ['#c2362a', '#2a5ab8', '#e6b23a', '#3a9a5a', '#8a3ab8'];
  g.fillStyle = '#1a1410'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 22) for (let x = 0; x < 128; x += 22) { g.fillStyle = cols[(x / 22 + y / 22 * 2) % 5 | 0]; g.globalAlpha = 0.75 + Math.random() * 0.25; g.fillRect(x + 2, y + 2, 18, 18); }
  g.globalAlpha = 1; g.fillStyle = '#f2e6b0'; g.beginPath(); g.arc(64, 80, 30, 0, 7); g.fill(); g.fillStyle = '#e6b23a'; for (let k = 0; k < 12; k++) { g.save(); g.translate(64, 80); g.rotate(k / 12 * Math.PI * 2); g.fillRect(-3, 30, 6, 18); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (stainedM = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.3 }));
}


/* ---------------- chama realista (S-182/S-190): sprites aditivos em camadas + brasas subindo ---------------- */
let _flameTex = null, _emberTex = null;
function flameTex() {
  if (_flameTex) return _flameTex;
  const mk = (stops, shape) => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    // gota de fogo: base larga e arredondada, ponta fina e ondulada
    g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(44 + shape, 40, 58, 78, 52, 100); g.bezierCurveTo(46, 122, 18, 122, 12, 100); g.bezierCurveTo(6, 78, 20 - shape, 40, 32, 4); g.closePath();
    const gr = g.createRadialGradient(32, 96, 2, 32, 80, 70); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.filter = 'blur(3px)'; g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  _flameTex = [mk([[0, 'rgba(255,255,235,1)'], [0.25, 'rgba(255,230,140,0.95)'], [0.6, 'rgba(255,170,60,0.5)'], [1, 'rgba(255,120,20,0)']], 4),
    mk([[0, 'rgba(255,200,90,0.95)'], [0.4, 'rgba(255,120,30,0.75)'], [0.8, 'rgba(200,50,10,0.3)'], [1, 'rgba(120,20,0,0)']], -6),
    mk([[0, 'rgba(255,140,40,0.7)'], [0.5, 'rgba(210,60,15,0.45)'], [1, 'rgba(90,15,0,0)']], 8)];
  return _flameTex;
}
function emberTex() { if (_emberTex) return _emberTex; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.3, 'rgba(255,150,40,0.8)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); _emberTex = new THREE.CanvasTexture(c); return _emberTex; }
const flameMats = {};
function fMat(i) { return flameMats[i] || (flameMats[i] = new THREE.SpriteMaterial({ map: flameTex()[i], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); }
let _emberM = null;
// chama viva: 'size' = altura em metros; brasas opcionais. Devolve um Group com userData.update(t)
export function realFlame(size = 0.5, seed = 0, embers = true) {
  const g = new THREE.Group(), tongues = [];
  const layers = [[2, 1.0, 0.95, 0], [1, 0.82, 0.8, 0.02], [1, 0.62, 0.62, -0.03], [0, 0.48, 0.42, 0.01], [0, 0.32, 0.3, 0]];
  layers.forEach(([m, h, w, ox], i) => { const sp = new THREE.Sprite(fMat(m)); sp.center.set(0.5, 0.08); sp.position.set(ox * size, 0, (i % 2 ? 0.02 : -0.02) * size); sp.scale.set(w * size * 0.55, h * size, 1); sp.renderOrder = 20 + i; g.add(sp); tongues.push({ sp, h, w, ph: seed * 1.7 + i * 2.3 }); });
  const emb = [];
  if (embers) { _emberM = _emberM || new THREE.SpriteMaterial({ map: emberTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let k = 0; k < 6; k++) { const e = new THREE.Sprite(_emberM); e.scale.setScalar(0.035 * Math.max(0.6, size)); g.add(e); emb.push({ e, off: k / 6 + seed * 0.13, dx: Math.sin(k * 2.4 + seed) * 0.12, dz: Math.cos(k * 1.9 + seed) * 0.12 }); } }
  g.userData.update = t => {
    for (const q of tongues) { const f = 1 + Math.sin(t * 13 + q.ph) * 0.09 + Math.sin(t * 23.7 + q.ph * 2) * 0.06 + Math.sin(t * 5.3 + q.ph) * 0.05; q.sp.scale.set(q.w * size * 0.55 * (1.06 - (f - 1) * 0.6), q.h * size * f, 1); q.sp.material.rotation = Math.sin(t * 3.1 + q.ph) * 0.08; q.sp.position.x = Math.sin(t * 7 + q.ph) * 0.03 * size; }
    for (const b of emb) { const k = (t * 0.55 + b.off) % 1; b.e.position.set(b.dx * size * (1 + k) + Math.sin(t * 4 + b.off * 9) * 0.05 * size, k * size * 2.2, b.dz * size * (1 + k)); b.e.material.opacity = 1; b.e.scale.setScalar(0.04 * Math.max(0.6, size) * (1 - k)); }
  };
  return g;
}
// lenha em brasa (toras cruzadas com ponta incandescente) para lareiras e braseiros
function logsGlow(K, x, y, z, s = 1, ry = 0) {
  const wd = M.darkWood(), coal = P('coal', '#2a120a', { emissive: '#ff5a10', ei: 0.9, rough: 0.9 });
  for (let k = 0; k < 4; k++) { const a = ry + k * Math.PI / 4 + 0.3; K.add(new THREE.CylinderGeometry(0.07 * s, 0.08 * s, 0.85 * s, 10), wd, x, y + 0.08 * s + (k > 1 ? 0.1 * s : 0), z, a, Math.PI / 2, 0); }
  for (let k = 0; k < 9; k++) K.add(new THREE.DodecahedronGeometry(0.06 * s, 0), coal, x + Math.sin(k * 2.1) * 0.25 * s, y + 0.03, z + Math.cos(k * 1.7) * 0.2 * s, k);
}

/* ---------------- tapete melhor (S-183): lã com medalhões, faixas, desgaste e franjas ---------------- */
const rug2 = {};
function rugMat2(base, edge, accent = '#1e2a4a') {
  const k = base + edge + accent; if (rug2[k]) return rug2[k];
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 1024);
  // faixas da borda
  g.fillStyle = edge; g.fillRect(0, 0, 256, 22); g.fillRect(0, 1002, 256, 22); g.fillRect(0, 0, 22, 1024); g.fillRect(234, 0, 22, 1024);
  g.fillStyle = accent; g.fillRect(26, 26, 204, 10); g.fillRect(26, 988, 204, 10); g.fillRect(26, 26, 10, 972); g.fillRect(220, 26, 10, 972);
  // gregas na borda
  g.strokeStyle = base; g.lineWidth = 3; for (let y = 4; y < 1020; y += 16) { g.strokeRect(5, y, 10, 10); g.strokeRect(241, y, 10, 10); }
  // campo: arabescos e medalhões
  g.strokeStyle = edge; g.lineWidth = 3; g.globalAlpha = 0.55;
  for (let y = 70; y < 1000; y += 46) for (let x = 60; x < 220; x += 46) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x - 18, y); g.lineTo(x, y - 18); g.lineTo(x + 18, y); g.lineTo(x, y + 18); g.closePath(); g.stroke(); }
  g.globalAlpha = 1;
  for (const y of [180, 512, 844]) { g.save(); g.translate(128, y); g.fillStyle = accent; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 46 : 70; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.3); } g.closePath(); g.fill(); g.strokeStyle = edge; g.lineWidth = 5; g.stroke(); g.fillStyle = edge; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill(); g.fillStyle = base; g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); g.restore(); }
  // trama e desgaste (mais no meio, onde se pisa)
  for (let k = 0; k < 9000; k++) { const x = Math.random() * 256, y = Math.random() * 1024; g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,220'},${Math.random() * 0.06})`; g.fillRect(x, y, 1, 2); }
  const wear = g.createLinearGradient(0, 0, 256, 0); wear.addColorStop(0, 'rgba(0,0,0,0)'); wear.addColorStop(0.5, 'rgba(255,230,200,0.07)'); wear.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = wear; g.fillRect(0, 0, 256, 1024);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (rug2[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.97 }));
}
// tapete com espessura e franjas nas pontas (w = largura, L = comprimento, ao longo de z)
function rug(K, w, L, x, z, base, edge, accent, ry = 0) {
  const g = new THREE.BoxGeometry(w, 0.025, L); const uv = g.attributes.uv, P2 = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, P2.getX(i) / w + 0.5, P2.getZ(i) / L + 0.5);
  K.add(g, rugMat2(base, edge, accent), x, 0.035, z, ry);
  const cs = Math.cos(ry), sn = Math.sin(ry), fr = P('fringe', '#e8dcb8', { rough: 1 });
  for (const sz of [-1, 1]) for (let i = 0; i < Math.floor(w / 0.06); i++) { const lx = -w / 2 + 0.03 + i * 0.06, lz = sz * (L / 2 + 0.06); K.add(new THREE.BoxGeometry(0.012, 0.006, 0.12), fr, x + lx * cs + lz * sn, 0.03, z - lx * sn + lz * cs, ry + Math.sin(i * 7) * 0.15); }
}
// placa de bronze/madeira com texto (lore)
function plaqueTex(title, lines) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3a2414'); gr.addColorStop(1, '#22140a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#c9a24a'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 236); g.lineWidth = 2; g.strokeRect(22, 22, 468, 212);
  g.fillStyle = '#ffd98a'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.fillText(title, 256, 66);
  g.fillStyle = '#ead9b0'; g.font = 'italic 21px Georgia, serif'; lines.forEach((l, i) => g.fillText(l, 256, 112 + i * 30));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.2 });
}

// braseiro de ferro forjado com lenha em brasa e chama de verdade (S-182)
function castleBrazier(ctx, x, y, z, light = false, seed = 0, s0 = 1) {
  const K = new Kit(), ir = M.iron();
  K.add(lathe([[0.02, 0], [0.26, 0], [0.22, 0.06], [0.09, 0.14], [0.06, 0.95], [0.1, 1.0], [0.3, 1.08], [0.52, 1.28], [0.55, 1.36], [0.5, 1.34], [0.04, 1.14]].map(([a, b]) => [a * s0, b * s0]), 24), ir);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; K.add(new THREE.CylinderGeometry(0.025 * s0, 0.02 * s0, 0.9 * s0, 6), ir, Math.cos(a) * 0.2 * s0, 0.55 * s0, Math.sin(a) * 0.2 * s0, -a, 0, 0.25); } // pés de ferro
  logsGlow(K, 0, 1.18 * s0, 0, 0.7 * s0);
  const g = K.build(); g.position.set(x, y, z); ctx.scene.add(g);
  const f = realFlame(1.2 * s0, seed); f.position.y = 1.25 * s0; g.add(f); ctx.roomAnims.push(f);
  if (light) { const L = vlight('#ffa050', 4, 14, 1.6); L.position.set(x, y + 2, z); ctx.scene.add(L); }
  ctx.colliders.push({ x, z, r: 0.55 * s0 }); return g;
}

/* ---------------- por fora ---------------- */
const HW = 42, WALL_H = 14, WT = 3.4; // meia-largura da muralha, altura, espessura
function crenels(K, mat, x0, z0, x1, z1, y, t) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), n = Math.floor(len / 2.2);
  for (let k = 0; k < n; k++) { const f = (k + 0.5) / n; K.box(t, 1.5, 1.3, mat, x0 + (x1 - x0) * f, y + 0.75, z0 + (z1 - z0) * f, ry); }
}
function roundTower(K, R, H, mats, x, z, roof = true) {
  K.cyl(R, R * 1.12, H, mats.wall, x, H / 2 - 1, z, 32); K.cyl(R + 0.7, R + 0.7, 1.2, mats.inner, x, H - 0.4, z, 32);
  const n = Math.round(R * 2.2); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; K.box(1.2, 1.5, 0.9, mats.inner, x + Math.cos(a) * (R + 0.35), H + 0.95, z + Math.sin(a) * (R + 0.35), -a + Math.PI / 2); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; for (const y of [H * 0.4, H * 0.7]) K.box(0.5, 1.6, 0.4, P('slit', '#141210'), x + Math.cos(a) * (R * 1.05), y, z + Math.sin(a) * (R * 1.05), -a + Math.PI / 2); } // seteiras
  if (roof) { K.cyl(R + 0.2, R + 0.2, 3.0, mats.wall, x, H + 2.2, z, 32); K.add(new THREE.ConeGeometry(R + 1.4, R * 2.4, 32), M.slate(), x, H + 3.7 + R * 1.2, z); K.cyl(0.06, 0.06, 3, M.iron(), x, H + 3.7 + R * 2.4 + 1.2, z, 6); }
}
function buildCastleOutside(ctx) {
  const mats = castleMats(), C = CASTLE, roadEnd = { x: -280, z: 270 }, ry = Math.atan2(roadEnd.x - C.x, roadEnd.z - C.z); // a frente olha para a estrada
  const y0 = heightAt(C.x, C.z) - 0.6, K = new Kit(), cs = Math.cos(ry), sn = Math.sin(ry), W = (lx, lz) => ({ x: C.x + lx * cs + lz * sn, z: C.z - lx * sn + lz * cs });
  // muralha (quatro lados; a frente tem o vão da portaria)
  const side = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(x1 - x0, z1 - z0); K.add(new THREE.BoxGeometry(WT, WALL_H + 2, len), mats.wall, (x0 + x1) / 2, WALL_H / 2 - 1, (z0 + z1) / 2, r); K.add(new THREE.BoxGeometry(WT + 0.6, 0.6, len), mats.inner, (x0 + x1) / 2, WALL_H - 0.2, (z0 + z1) / 2, r); const ox = Math.cos(r) * WT * 0.42, oz = -Math.sin(r) * WT * 0.42; crenels(K, mats.inner, x0 + ox, z0 + oz, x1 + ox, z1 + oz, WALL_H, 0.9); };
  side(-HW, -HW, -HW, HW); side(HW, -HW, HW, HW); side(-HW, -HW, HW, -HW); side(-HW, HW, -6, HW); side(6, HW, HW, HW);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roundTower(K, 6, 24, mats, sx * HW, sz * HW);
  // portaria: duas torres, arco, grade levantada e o caminho de pedra
  for (const sx of [-1, 1]) roundTower(K, 4.6, 19, mats, sx * 8.2, HW + 1.2);
  K.box(12, 6, WT + 2, mats.wall, 0, WALL_H + 0.5, HW); archBlocks(K, 7.4, 1.4, WT + 2.2, mats.inner, 0, 8.6, HW, 0, 15);
  for (const sx of [-1, 1]) K.box(1.2, 8.6, WT + 2.2, mats.inner, sx * 4.3, 4.3 - 1, HW);
  for (let k = 0; k < 8; k++) K.box(0.16, 3.4, 0.16, M.iron(), -3.2 + k * 0.92, 10.6, HW + 1.4); K.box(7.2, 0.16, 0.16, M.iron(), 0, 9.1, HW + 1.4);
  // torre de menagem: corpo enorme com contrafortes, janelas em arco, quatro torreões e a torre alta
  const kz = -10, KW = 19, KD = 14, KH = 30;
  K.box(KW * 2, KH, KD * 2, mats.wall, 0, KH / 2 - 1, kz);
  for (const sx of [-1, 1]) for (let k = -1; k <= 1; k++) K.box(1.6, KH * 0.7, 2.2, mats.inner, sx * KW + sx * 0.8 + k * 0, KH * 0.35 - 1, kz + k * 9);
  crenels(K, mats.inner, -KW, kz + KD + 0.3, KW, kz + KD + 0.3, KH - 1, 0.9); crenels(K, mats.inner, -KW, kz - KD - 0.3, KW, kz - KD - 0.3, KH - 1, 0.9);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roundTower(K, 3.4, KH + 6, mats, sx * KW, kz + sz * KD);
  roundTower(K, 6.5, 48, mats, 0, kz - 4);
  for (let k = -3; k <= 3; k++) for (const y of [12, 21]) { if (k === 0 && y === 12) continue; const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0.9, 2.4); sh.absarc(0, 2.4, 0.9, 0, Math.PI, false); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }), M.glass(), k * 5, y, kz + KD + 0.02); K.add(new THREE.TorusGeometry(1.0, 0.18, 8, 16, Math.PI), mats.inner, k * 5, y + 2.4, kz + KD + 0.15); }
  // portal da torre: grande arco com porta dupla de madeira cravejada
  K.box(9, 0.3, 3.2, mats.inner, 0, 0.72, kz + KD + 1.6); K.box(9.6, 0.15, 3.8, mats.wall, 0, 0.62, kz + KD + 1.9); // S-181: só um degrau baixo — o portal fica à vista, na frente da porta
  K.box(5.4, 7, 0.4, M.darkWood(), 0, 4.3, kz + KD + 0.1); archBlocks(K, 6.2, 1.2, 1.4, mats.inner, 0, 7.6, kz + KD + 0.3, 0, 13); for (const sx of [-1, 1]) K.box(1.1, 7.6, 1.4, mats.inner, sx * 3.7, 3.4, kz + KD + 0.3);
  for (let y = 1.2; y < 7; y += 1.1) for (let x = -2.2; x <= 2.2; x += 1.1) K.add(new THREE.SphereGeometry(0.09, 8, 6), M.iron(), x, y, kz + KD + 0.35);
  // pátio: chão de pedra e construções encostadas na muralha (estábulo, ferraria, poço)
  // S-179: pátio todo calçado, acompanhando o terreno (nada de grama furando a pedra)
  const groundLocal = (lx, lz) => { const p = W(lx, lz); return heightAt(p.x, p.z) - y0; };
  const terrainPlane = (x0, z0, x1, z1, step, lift) => { const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step), g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2), P2 = g.attributes.position;
    for (let i = 0; i < P2.count; i++) { const lx = P2.getX(i) + (x0 + x1) / 2, lz = P2.getZ(i) + (z0 + z1) / 2; P2.setY(i, groundLocal(lx, lz) + lift); } g.computeVertexNormals(); return g; };
  K.add(terrainPlane(-HW + WT / 2, -HW + WT / 2, HW - WT / 2, HW - WT / 2, 2, 0.04), mats.floor, 0, 0, 0);
  K.add(terrainPlane(-6, HW - WT, 6, HW + 7.5, 1.5, 0.05), mats.floor, 0, 0, 0); // passagem sob a portaria até a ponte
  // S-191: construções do pátio = casas de verdade encostadas na muralha (térreo de pedra, andar de enxaimel, telhado de ardósia,
  // porta, janelas com caixilho, chaminé) — no lugar do caixote com telhado e sem o poço/chafariz (S-180)
  for (const sx of [-1, 1]) { const bx = sx * (HW - 9), bz = 22, fx = -sx; // a frente olha para o centro do pátio
    K.box(7, 3.2, 14, mats.wall, bx, 2.2, bz); K.box(7.2, 0.25, 14.2, M.darkWood(), bx, 3.9, bz);
    K.box(7, 2.8, 14, M.plaster(), bx, 5.4, bz);
    for (let k = -3; k <= 3; k++) K.box(0.22, 2.8, 0.22, M.darkWood(), bx + fx * 3.52, 5.4, bz + k * 2.2); // montantes
    for (let k = -3; k < 3; k++) K.box(0.18, 2.9, 0.18, M.darkWood(), bx + fx * 3.53, 5.4, bz + k * 2.2 + 1.1, 0, (k % 2 ? 0.75 : -0.75)); // escoras em X
    K.box(0.24, 0.22, 14.2, M.darkWood(), bx + fx * 3.53, 6.8, bz); K.box(0.24, 0.22, 14.2, M.darkWood(), bx + fx * 3.53, 4.05, bz);
    gable(K, 14.4, 7.4, 3.2, M.slate(), bx, 6.8, bz, Math.PI / 2, 0.5);
    K.box(1.1, 3.4, 1.1, mats.wall, bx - fx * 1.6, 8.6, bz - 4.5); K.box(1.3, 0.25, 1.3, mats.inner, bx - fx * 1.6, 10.35, bz - 4.5);
    // porta em arco com ferragens e degrau
    K.box(0.15, 2.4, 1.5, M.darkWood(), bx + fx * 3.56, 1.8, bz); for (const y of [1.2, 2.4]) K.box(0.05, 0.08, 1.4, M.iron(), bx + fx * 3.65, y, bz); archBlocks(K, 1.6, 0.35, 0.6, mats.inner, bx + fx * 3.55, 3.0, bz, Math.PI / 2, 7);
    K.box(1.2, 0.25, 2.0, mats.inner, bx + fx * 4.1, 0.72, bz);
    for (const dz of [-4.5, 4.5]) { K.box(0.12, 1.1, 1.0, P('winDark', '#1a1612', { rough: 0.4 }), bx + fx * 3.56, 2.3, bz + dz); K.box(0.16, 0.1, 1.2, M.darkWood(), bx + fx * 3.6, 2.9, bz + dz); K.box(0.16, 0.1, 1.2, M.darkWood(), bx + fx * 3.6, 1.7, bz + dz); K.box(0.16, 1.2, 0.08, M.darkWood(), bx + fx * 3.6, 2.3, bz + dz); }
    for (const dz of [-3.3, 3.3]) { K.box(0.1, 0.9, 0.8, M.glass(), bx + fx * 3.55, 5.5, bz + dz); K.box(0.14, 0.08, 1.0, M.darkWood(), bx + fx * 3.6, 6.0, bz + dz); }
  }
  // S-180: fosso com água em volta da muralha, margens de pedra e ponte de pedra até a portaria
  { const r0 = HW + 7, r1 = HW + 13, water = P('moatW', '#2e4a52', { rough: 0.08, metal: 0.3, transparent: true, opacity: 0.92 });
    let wl = -1e9; for (let t = -r1; t <= r1; t += 3) for (const [lx, lz] of [[t, -r0], [t, -r1], [t, r0], [t, r1], [-r0, t], [-r1, t], [r0, t], [r1, t]]) wl = Math.max(wl, groundLocal(lx, lz));
    wl += 0.06; // espelho d'água plano, um pouco acima do ponto mais alto da margem
    const band = (x0, z0, x1, z1) => K.add(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)).rotateX(-Math.PI / 2), water, (x0 + x1) / 2, wl, (z0 + z1) / 2);
    band(-r1, -r1, r1, -r0); band(-r1, r0, -4.5, r1); band(4.5, r0, r1, r1); band(-r1, -r0, -r0, r0); band(r0, -r0, r1, r0);
    // margens (meio-fio de pedra dos dois lados)
    const curb = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(x1 - x0, z1 - z0); K.add(new THREE.BoxGeometry(0.8, 2.0, len), mats.inner, (x0 + x1) / 2, wl - 0.55, (z0 + z1) / 2, r); }; // meio-fio sai 45 cm da água
    for (const rr of [r0, r1]) { curb(-rr, -rr, rr, -rr); curb(-rr, -rr, -rr, rr); curb(rr, -rr, rr, rr); curb(-rr, rr, -4.6, rr); curb(4.6, rr, rr, rr); }
    // ponte: tabuleiro de pedra em arco baixo, guarda-corpo com pilaretes
    K.add(terrainPlane(-4, r0 - 1, 4, r1 + 1, 1, 0.12), mats.floor, 0, 0, 0); K.box(8.4, 0.6, r1 - r0 + 2, mats.inner, 0, wl - 0.2, (r0 + r1) / 2); // tabuleiro da ponte (piso no nível do chão)
    for (const sx of [-1, 1]) { K.box(0.5, 0.9, r1 - r0 + 2, mats.inner, sx * 4.25, wl + 0.5, (r0 + r1) / 2); for (const zz of [r0 - 1, r1 + 1]) K.box(0.8, 1.6, 0.8, mats.wall, sx * 4.25, wl + 0.6, zz); }
    // colisão: margem de fora inteira (menos a ponte) — o fosso protege o castelo
    const ring = []; for (let t = -r1; t <= r1; t += 1.6) { ring.push([t, -r1], [-r1, t], [r1, t]); if (Math.abs(t) > 4.6) ring.push([t, r1]); }
    ctx._moatCols = ring;
  }
  const g = K.build(); g.position.set(C.x, y0, C.z); g.rotation.y = ry; ctx.scene.add(g);
  g.userData.asset = 'castelo_valcinza'; g.userData.big = true; g.userData.far = 520; ctx.placed.push(g); ctx.occluders.push(g); CULL.push(g); // visível de bem longe
  // colisões (caixas giradas junto com o castelo)
  const box = (lx, lz, hx, hz) => { const p = W(lx, lz); ctx.colliders.push({ x: p.x, z: p.z, r: Math.max(hx, hz), box: true, hx, hz, rot: ry, name: 'castelo_valcinza' }); };
  box(-HW, 0, WT / 2, HW); box(HW, 0, WT / 2, HW); box(0, -HW, HW, WT / 2); box(-(HW + 6) / 2, HW, (HW - 6) / 2, WT / 2 + 0.6); box((HW + 6) / 2, HW, (HW - 6) / 2, WT / 2 + 0.6);
  box(0, kz, KW + 1, KD + 0.5);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = W(sx * HW, sz * HW); ctx.colliders.push({ x: p.x, z: p.z, r: 6.6 }); }
  for (const sx of [-1, 1]) { const p = W(sx * 8.2, HW + 1.2); ctx.colliders.push({ x: p.x, z: p.z, r: 5.0 }); }
  for (const sx of [-1, 1]) box(sx * (HW - 9), 22, 3.6, 7.2);
  for (const [lx, lz] of ctx._moatCols || []) { const p = W(lx, lz); ctx.colliders.push({ x: p.x, z: p.z, r: 1.0, name: 'fosso' }); }
  for (const sx of [-1, 1]) { const zz = HW + 10; for (const z2 of [HW + 6, zz, HW + 14]) { const p = W(sx * 4.7, z2); ctx.colliders.push({ x: p.x, z: p.z, r: 0.6 }); } } // guarda-corpo da ponte
  // estandartes na torre e na portaria
  for (const [lx, ly, lz, w, h] of [[-9, 26, kz + KD + 0.4, 2.4, 9], [9, 26, kz + KD + 0.4, 2.4, 9], [-8.2, 17, HW + 6.2, 2.0, 7], [8.2, 17, HW + 6.2, 2.0, 7]]) { const b = makeBanner('castelo', w, h); const p = W(lx, lz); b.position.set(p.x, y0 + ly, p.z); b.rotation.y = ry; ctx.scene.add(b); }
  for (const sx of [-1, 1]) { const p = W(sx * 5.8, kz + KD + 3.2); castleBrazier(ctx, p.x, y0 + 0.62, p.z, sx > 0, sx); }
  const door = W(0, kz + KD + 4.6), out = W(0, kz + KD + 8.5); // portal no pátio, logo à frente da porta (S-181)
  return { ry, door, out, y0, W };
}

/* ---------------- por dentro (sala longe do mundo) ---------------- */
export const CASTLE_I = { name: 'Castelo de Valcinza', x: 1750, z: 0, w: 76, d: 96, h: 13, wall: '#9a9282', floor: '#6a6052', beam: '#3a2a1e', region: 'Campos de Valcinza', music: 'cidade', castle: true };
// paredes internas: [x0, z0, x1, z1, portas: [[pos ao longo da parede, largura]]]
const CASTLE_WALLS = []; // para o mapa do interior (S-189)
function wallWithDoors(K, cols, mats, x0, z0, x1, z1, doors, H, I) {
  CASTLE_WALLS.push({ x0, z0, x1, z1, doors });
  const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, ry = Math.atan2(ux, uz), t = 0.9, dh = 4.4;
  const cuts = [0, ...doors.flatMap(([p, w]) => [p - w / 2, p + w / 2]), len];
  for (let k = 0; k < cuts.length; k += 2) { const a = cuts[k], b = cuts[k + 1]; if (b - a < 0.05) continue; const m = (a + b) / 2; K.box(t, H, b - a, mats.inner, x0 + ux * m, H / 2, z0 + uz * m, ry); cols.push({ x: I.x + x0 + ux * m, z: I.z + z0 + uz * m, hx: t / 2 + 0.05, hz: (b - a) / 2, ry }); }
  for (const [p, w] of doors) { K.box(t, H - dh, w, mats.inner, x0 + ux * p, dh + (H - dh) / 2, z0 + uz * p, ry); archBlocks(K, w, 0.5, t + 0.3, mats.wall, x0 + ux * p, dh - w / 2 * 0.15, z0 + uz * p, ry + Math.PI / 2, 9); for (const s of [-1, 1]) K.box(t + 0.3, dh, 0.45, mats.wall, x0 + ux * (p + s * w / 2), dh / 2, z0 + uz * (p + s * w / 2), ry); }
}
// móveis
function table(K, w, d, x, z, ry = 0, mat = M.darkWood()) { K.box(w, 0.12, d, mat, x, 0.82, z, ry); const cs = Math.cos(ry), sn = Math.sin(ry); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * (w / 2 - 0.15), lz = sz * (d / 2 - 0.15); K.add(new THREE.CylinderGeometry(0.07, 0.05, 0.8, 10), mat, x + lx * cs + lz * sn, 0.4, z - lx * sn + lz * cs); } }
function bench(K, w, x, z, ry = 0) { K.box(w, 0.08, 0.4, M.darkWood(), x, 0.48, z, ry); const cs = Math.cos(ry), sn = Math.sin(ry); for (const sx of [-1, 1]) K.box(0.08, 0.46, 0.36, M.darkWood(), x + sx * (w / 2 - 0.2) * cs, 0.23, z - sx * (w / 2 - 0.2) * sn, ry); }
function chair(K, x, z, ry = 0, mat = M.darkWood()) { K.box(0.5, 0.06, 0.5, mat, x, 0.48, z, ry); const cs = Math.cos(ry), sn = Math.sin(ry); for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) K.box(0.05, 0.48, 0.05, mat, x + lx * cs + lz * sn, 0.24, z - lx * sn + lz * cs, ry); K.box(0.5, 0.6, 0.05, mat, x - 0.23 * sn, 0.8, z - 0.23 * cs, ry); }
function candle(K, x, y, z, h = 0.25) { K.cyl(0.035, 0.04, h, P('wax', '#f2ead6', { rough: 0.6 }), x, y + h / 2, z, 10); K.add(new THREE.SphereGeometry(0.03, 8, 6), M.ember(), x, y + h + 0.04, z, 0, 0, 0, 1, 1.8, 1); }
function chandelier(K, x, y, z, R = 1.4) {
  K.add(new THREE.TorusGeometry(R, 0.06, 8, 40), M.iron(), x, y, z, 0, Math.PI / 2); K.add(new THREE.TorusGeometry(R * 0.5, 0.05, 8, 24), M.iron(), x, y + 0.3, z, 0, Math.PI / 2);
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; K.add(new THREE.CylinderGeometry(0.018, 0.018, R, 6), M.iron(), x + Math.cos(a) * R / 2, y + 0.3, z + Math.sin(a) * R / 2, -a, 0, Math.PI / 2); } // raios do aro
  K.cyl(0.03, 0.03, 6, M.iron(), x, y + 3.3, z, 6);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; candle(K, x + Math.cos(a) * R, y + 0.05, z + Math.sin(a) * R, 0.22); }
}
function bookshelf(K, w, x, z, ry, seed, y0 = 0) {
  const r = rngOf(seed), cs = Math.cos(ry), sn = Math.sin(ry), H = 3.6, wd = M.darkWood(), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const insertY = ([a, b], y) => [a, y + y0, b];
  K.box(w, H, 0.12, wd, ...insertY(at(0, -0.3), H / 2), ry); for (const sx of [-1, 1]) K.box(0.1, H, 0.65, wd, ...insertY(at(sx * w / 2, 0), H / 2), ry);
  const cols = ['#7a2a22', '#2a4a7a', '#3a6a3a', '#7a5a2a', '#4a2a5a', '#2a2a2a', '#8a7a4a'];
  for (let s = 0; s < 5; s++) { const y = 0.1 + s * 0.72; K.box(w, 0.06, 0.6, wd, ...insertY(at(0, 0), y), ry); let lx = -w / 2 + 0.12; while (lx < w / 2 - 0.15) { const bw = 0.06 + r() * 0.07, bh = 0.4 + r() * 0.22; if (r() < 0.08) { lx += 0.25; continue; } K.box(bw, bh, 0.42, P('book' + Math.floor(r() * 7), cols[Math.floor(r() * 7)], { rough: 0.8 }), ...insertY(at(lx + bw / 2, 0.02), y + 0.03 + bh / 2), ry, 0, (r() < 0.1 ? 0.25 : 0)); lx += bw + 0.01; } }
}
const insertY = ([x, z], y) => [x, y, z];
function bed(K, x, z, ry, w = 2.0, royal = false) {
  const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz, y) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs], wd = M.darkWood(), L = 2.4;
  K.box(w + 0.2, 0.5, L + 0.2, wd, ...at(0, 0, 0.35), ry); K.box(w, 0.35, L, P('mattress', '#efe6d4', { rough: 0.9 }), ...at(0, 0, 0.75), ry);
  K.box(w + 0.05, 0.12, L * 0.65, cloth(royal ? 'royalBlanket' : 'blanket', royal ? '#5a2e82' : '#7a3a2a'), ...at(0, 0.38, 0.95), ry);
  for (const sx of [-1, 1]) K.add(new THREE.SphereGeometry(0.3, 16, 10), P('pillow', '#f6f0e4', { rough: 0.9 }), ...at(sx * w * 0.24, -L / 2 + 0.35, 1.02), ry, 0, 0, 1.2, 0.4, 0.7);
  K.box(w + 0.3, 1.6, 0.15, wd, ...at(0, -L / 2 - 0.1, 1.0), ry);
  if (royal) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl(0.08, 0.1, 3.2, wd, ...at(sx * (w / 2 + 0.1), sz * (L / 2 + 0.05), 1.6), 10); K.box(w + 0.5, 0.1, L + 0.4, cloth('canopy', '#4a2470'), ...at(0, 0, 3.2), ry); for (const sx of [-1, 1]) K.box(0.05, 2.3, L + 0.3, cloth('curtain', '#5a2e82'), ...at(sx * (w / 2 + 0.2), 0, 2.05), ry); K.box(w + 0.6, 0.25, 0.1, M.gold(), ...at(0, -L / 2 - 0.25, 3.05), ry); }
}
function fireplace(K, x, z, ry, mats) {
  const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz, y) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
  K.box(3.6, 0.3, 1.4, mats.wall, ...at(0, 0.2, 0.15), ry); for (const sx of [-1, 1]) K.box(0.6, 1.8, 1.2, mats.wall, ...at(sx * 1.5, 0, 0.9), ry);
  K.box(3.8, 0.4, 1.4, mats.inner, ...at(0, 0, 2.0), ry); K.box(3.0, 3.0, 1.0, mats.wall, ...at(0, -0.1, 3.7), ry); K.box(2.4, 1.6, 0.1, P('soot', '#141210'), ...at(0, -0.5, 0.95), ry);
  for (let k = 0; k < 3; k++) K.cyl(0.12, 0.12, 1.1, M.darkWood(), ...at(-0.3 + k * 0.3, 0.1, 0.42), 10, ry + Math.PI / 2, Math.PI / 2);
  return at(0, 0.2, 0.55);
}
// armadura completa num suporte (S-184): couraça com placas, gorjal, ombreiras em lâminas, braçais,
// manoplas, saiote de placas sobre cota de malha, grevas, elmo fechado com viseira e penacho
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function armorStand(K, x, z, ry, plume = '#8a1a22') {
  const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz, y) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
  const st = P('armSteel', '#c4c8ce', { metal: 0.55, rough: 0.3 }), dk = P('armDark', '#6a6e76', { metal: 0.5, rough: 0.4 }), mail = P('armMail', '#7e8188', { metal: 0.45, rough: 0.55 }), leather = P('armLeather', '#4a2e1a', { rough: 0.8 }), brass = M.gold();
  // pedestal de pedra e haste de madeira (o "manequim")
  K.add(lathe([[0.01, 0], [0.42, 0], [0.42, 0.08], [0.36, 0.12], [0.34, 0.2], [0.01, 0.2]], 24), P('standStone', '#6a6458', { rough: 0.85 }), ...at(0, 0, 0), ry);
  K.cyl(0.035, 0.035, 1.0, M.darkWood(), ...at(0, 0, 0.7), 8);
  // grevas e escarpes
  for (const sx of [-1, 1]) { K.add(lathe([[0.06, 0], [0.075, 0.08], [0.07, 0.3], [0.08, 0.42], [0.072, 0.5]], 18), st, ...at(sx * 0.12, 0, 0.22), ry); K.add(new THREE.SphereGeometry(0.075, 14, 10), st, ...at(sx * 0.12, 0, 0.73), ry, 0, 0, 1, 0.8, 1.1); K.add(lathe([[0.07, 0], [0.085, 0.1], [0.08, 0.32]], 18), st, ...at(sx * 0.12, 0, 0.76), ry); K.box(0.11, 0.06, 0.24, dk, ...at(sx * 0.12, 0.05, 0.22), ry); }
  // cota de malha e saiote de lâminas (tassetes)
  K.add(lathe([[0.2, 0], [0.24, 0.15], [0.21, 0.32]], 24), mail, ...at(0, 0, 0.98), ry);
  for (let k = 0; k < 3; k++) K.add(lathe([[0.25 - k * 0.012, 0], [0.235 - k * 0.012, 0.09]], 24), st, ...at(0, 0, 1.06 + k * 0.075), ry);
  K.add(new THREE.TorusGeometry(0.22, 0.025, 8, 28), leather, ...at(0, 0, 1.32), ry, Math.PI / 2); K.box(0.07, 0.07, 0.03, brass, ...at(0, 0.22, 1.32), ry); // cinto e fivela
  // couraça (peito com quilha) e placas da barriga
  K.add(lathe([[0.2, 0], [0.23, 0.08], [0.25, 0.25], [0.27, 0.42], [0.25, 0.52], [0.16, 0.58], [0.07, 0.6]], 32), st, ...at(0, 0, 1.34), ry, 0, 0, 1, 1, 0.82);
  K.box(0.025, 0.42, 0.04, st, ...at(0, 0.215, 1.6), ry); // quilha
  for (let k = 0; k < 6; k++) { const a = -0.6 + k * 0.24; K.add(new THREE.SphereGeometry(0.012, 6, 4), brass, ...at(Math.sin(a) * 0.26, Math.cos(a) * 0.21, 1.4), ry); } // rebites
  // gorjal
  K.add(lathe([[0.15, 0], [0.11, 0.06], [0.09, 0.12]], 22), st, ...at(0, 0, 1.92), ry);
  // ombreiras em lâminas sobrepostas
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) K.add(new THREE.SphereGeometry(0.16 - k * 0.012, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), k % 2 ? dk : st, ...at(sx * (0.3 + k * 0.012), 0, 1.86 - k * 0.055), ry, 0, sx * (0.5 + k * 0.08), 1.0, 0.75, 1.1);
  // braçais, cotoveleiras e manoplas (braços pendendo ao lado)
  for (const sx of [-1, 1]) { K.add(lathe([[0.065, 0], [0.07, 0.25]], 16), st, ...at(sx * 0.33, 0, 1.52), ry, 0, sx * 0.08); K.add(new THREE.SphereGeometry(0.075, 14, 10), dk, ...at(sx * 0.34, 0.02, 1.48), ry);
    K.add(lathe([[0.055, 0], [0.065, 0.24]], 16), st, ...at(sx * 0.35, 0.03, 1.22), ry); K.add(new THREE.BoxGeometry(0.09, 0.14, 0.11), dk, ...at(sx * 0.35, 0.04, 1.13), ry); for (let f = 0; f < 4; f++) K.box(0.02, 0.07, 0.025, dk, ...at(sx * 0.35 + (f - 1.5) * 0.022, 0.08, 1.04), ry); }
  // elmo fechado (grande elmo) com viseira em fendas, respiros e penacho
  K.add(lathe([[0.01, 0.34], [0.09, 0.33], [0.15, 0.27], [0.165, 0.15], [0.16, 0.0], [0.13, -0.06]], 28), st, ...at(0, 0, 1.98), ry);
  K.box(0.2, 0.018, 0.02, P('visorSlit', '#0a0a0c'), ...at(0, 0.155, 2.17), ry); K.box(0.16, 0.012, 0.02, P('visorSlit', '#0a0a0c'), ...at(0, 0.157, 2.14), ry);
  for (let k = 0; k < 6; k++) K.add(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 6), P('visorSlit', '#0a0a0c'), ...at(0.05 + (k % 3) * 0.022, 0.15, 2.06 - Math.floor(k / 3) * 0.025), ry, Math.PI / 2);
  K.box(0.018, 0.3, 0.02, st, ...at(0, 0.162, 2.12), ry); // nervura central
  for (let k = 0; k < 9; k++) K.add(new THREE.ConeGeometry(0.03, 0.34, 8), cloth('plume' + plume, plume), ...at(0, -0.04 - k * 0.03, 2.44 - k * 0.012), ry, 0.9 + k * 0.06);
}
// espada lendária (S-185): lâmina com fio e sulco, guarda trabalhada, punho envolto e pomo com gema
function legendSword(K, x, y, z, ry, o) {
  const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz, yy) => [x + lx * cs + lz * sn, yy, z - lx * sn + lz * cs], L = o.len || 1.1, W = o.w || 0.05;
  const blade = new THREE.Shape(); blade.moveTo(0, L); blade.lineTo(W, L - (o.tip || 0.16)); blade.lineTo(W * (o.flare || 1), L * 0.35); blade.lineTo(W * 1.1, 0); blade.lineTo(-W * 1.1, 0); blade.lineTo(-W * (o.flare || 1), L * 0.35); blade.lineTo(-W, L - (o.tip || 0.16)); blade.closePath();
  K.add(new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.012, bevelSegments: 2 }), P('blade' + o.blade, o.blade, { metal: 0.5, rough: 0.22, emissive: o.glow || '#3a3a3e', ei: o.glow ? 0.5 : 0.35 }), ...at(0, 0, y), ry);
  K.box(0.012, L * 0.62, 0.03, P('fuller', '#55595f', { metal: 0.9, rough: 0.3 }), ...at(0, 0.005, y + L * 0.36), ry); // sulco
  const gold = P('hilt' + o.hilt, o.hilt, { metal: 0.55, rough: 0.3 });
  const gw = o.guard || 0.22; K.box(gw * 2, 0.04, 0.05, gold, ...at(0, 0, y - 0.02), ry); for (const sx of [-1, 1]) K.add(new THREE.SphereGeometry(0.03, 10, 8), gold, ...at(sx * gw, 0, y - 0.02), ry); if (o.wings) for (const sx of [-1, 1]) K.add(new THREE.ConeGeometry(0.025, 0.16, 8), gold, ...at(sx * (gw - 0.06), 0, y + 0.05), ry, 0, sx * -0.5);
  K.add(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 10), P('grip' + o.grip, o.grip, { rough: 0.8 }), ...at(0, 0, y - 0.17), ry); for (let k = 0; k < 6; k++) K.add(new THREE.TorusGeometry(0.023, 0.005, 6, 12), gold, ...at(0, 0, y - 0.06 - k * 0.04), ry, Math.PI / 2);
  K.add(new THREE.SphereGeometry(0.045, 14, 10), gold, ...at(0, 0, y - 0.33), ry, 0, 0, 1, 1, 0.8); if (o.gem) K.add(new THREE.OctahedronGeometry(0.03, 0), P('gem' + o.gem, o.gem, { emissive: o.gem, ei: 1.2, metal: 0.3, rough: 0.1 }), ...at(0, 0.035, y - 0.33), ry);
}
function swordGeo() { const s = new THREE.Shape(); s.moveTo(0, 1.0); s.lineTo(0.04, 0.88); s.lineTo(0.04, 0); s.lineTo(0.16, 0); s.lineTo(0.16, -0.05); s.lineTo(0.03, -0.05); s.lineTo(0.03, -0.28); s.lineTo(0.05, -0.32); s.lineTo(-0.05, -0.32); s.lineTo(-0.03, -0.28); s.lineTo(-0.03, -0.05); s.lineTo(-0.16, -0.05); s.lineTo(-0.16, 0); s.lineTo(-0.04, 0); s.lineTo(-0.04, 0.88); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 }); }
function throne(K, x, z, y) {
  const wd = M.darkWood(), gold = M.gold(), red = cloth('throneRed', '#7a1a22');
  K.box(1.6, 0.6, 1.4, wd, x, y + 0.3, z); K.box(1.4, 0.18, 1.2, red, x, y + 0.66, z + 0.05);
  K.box(1.6, 3.4, 0.25, wd, x, y + 2.0, z - 0.6); K.box(1.2, 2.6, 0.08, red, x, y + 2.0, z - 0.46);
  K.add(new THREE.CylinderGeometry(0.8, 0.8, 0.25, 24, 1, false, -Math.PI / 2, Math.PI), wd, x, y + 3.7, z - 0.6, 0, Math.PI / 2, 0);
  for (const sx of [-1, 1]) { K.box(0.22, 0.9, 1.4, wd, x + sx * 0.82, y + 1.0, z); K.add(new THREE.SphereGeometry(0.15, 12, 10), gold, x + sx * 0.82, y + 1.5, z + 0.62); K.cyl(0.1, 0.1, 4.2, gold, x + sx * 0.82, y + 2.1, z - 0.62, 12); K.add(new THREE.ConeGeometry(0.14, 0.4, 12), gold, x + sx * 0.82, y + 4.4, z - 0.62); }
  for (let k = 0; k < 5; k++) K.add(new THREE.ConeGeometry(0.09, 0.4, 8), gold, x - 0.5 + k * 0.25, y + 4.6 + (k === 2 ? 0.15 : 0), z - 0.6); // coroa no espaldar
}
/* ---------------- mapa de Aethra (globo e mesa de mapas da biblioteca, S-188) ---------------- */
let _aethraMap = null;
function aethraMapCanvas() { // vista de cima do mundo de verdade: mar, costa, montanhas, chão de cada região e as cidades
  if (_aethraMap) return _aethraMap;
  const N = 160, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N), col = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / (N - 1) * 2 - 1) * 450, z = (j / (N - 1) * 2 - 1) * 450, k = (j * N + i) * 4;
    if (seaDist(x, z) < 0) { const d = Math.min(1, -seaDist(x, z) / 60); col.setRGB(0.16 - d * 0.06, 0.32 - d * 0.1, 0.42 - d * 0.08); }
    else if (lakeDist(x, z) < LAKE.r) col.set('#3a6a80');
    else { const h = heightAt(x, z), mm = mountainMask(x, z); col.copy(groundColor(x, z, h, 0)); if (mm > 0.45) col.lerp(new THREE.Color(h > 30 ? '#eef0f2' : '#8a8274'), Math.min(1, (mm - 0.45) * 2.4)); }
    img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (_aethraMap = c);
}
function mapTableTex() { // pergaminho com o mapa, nomes das regiões e rosa dos ventos
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#d8c49a'; g.fillRect(0, 0, S, S); g.imageSmoothingEnabled = true; g.globalAlpha = 0.85; g.drawImage(aethraMapCanvas(), 60, 60, S - 120, S - 120); g.globalAlpha = 1;
  const v = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72); v.addColorStop(0, 'rgba(120,80,30,0)'); v.addColorStop(1, 'rgba(90,55,20,0.6)'); g.fillStyle = v; g.fillRect(0, 0, S, S);
  g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#2a1a0a';
  for (const zn of ZONES) { const px = 60 + (zn.x / 450 + 1) / 2 * (S - 120), py = 60 + (zn.z / 450 + 1) / 2 * (S - 120); g.fillText(zn.name, px, py); }
  g.strokeStyle = '#5a3a1a'; g.lineWidth = 6; g.strokeRect(30, 30, S - 60, S - 60);
  g.save(); g.translate(S - 110, 110); g.fillStyle = '#5a3a1a'; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -60); g.lineTo(10, 0); g.lineTo(-10, 0); g.fill(); } g.font = 'bold 26px Georgia'; g.fillText('N', 0, -68); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function globeTex() { // equirretangular: Aethra no meio, mar profundo e "terras não mapeadas" no resto, com meridianos dourados
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#1a3448'); sea.addColorStop(0.5, '#24506a'); sea.addColorStop(1, '#1a3448'); g.fillStyle = sea; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 1); } // ondulação do mar pintado
  // Aethra ocupa 100° de longitude e 80° de latitude no centro
  const pw = W * 100 / 360, ph = H * 80 / 180; g.drawImage(aethraMapCanvas(), W / 2 - pw / 2, H / 2 - ph / 2, pw, ph);
  g.strokeStyle = 'rgba(232,200,120,0.45)'; g.lineWidth = 1.2; for (let i = 0; i <= 24; i++) { g.beginPath(); g.moveTo(i / 24 * W, 0); g.lineTo(i / 24 * W, H); g.stroke(); } for (let j = 0; j <= 12; j++) { g.beginPath(); g.moveTo(0, j / 12 * H); g.lineTo(W, j / 12 * H); g.stroke(); }
  g.fillStyle = 'rgba(240,220,170,0.75)'; g.font = 'italic 20px Georgia'; g.textAlign = 'center'; g.fillText('Mar Sem Fim', W * 0.2, H * 0.6); g.fillText('Mar Sem Fim', W * 0.8, H * 0.4); g.font = 'bold 16px Georgia'; g.fillText('AETHRA', W / 2, H / 2 - ph / 2 - 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------------- mapa do interior para o minimapa (S-189) ---------------- */
const CASTLE_ROOMS = [['Salão do Trono', 0, -12], ['Vestíbulo', 0, 39], ['Biblioteca', -25, -31], ['Capela', -25, 2], ['Salão das Lâminas', -25, 33], ['Quarto Real', 25, -33], ['Hóspedes', 25, -9], ['Cozinha', 25, 25]];
// c: contexto 2D · W: largura do canvas (quadrado) · x, z: posição do jogador (coordenadas do mundo) · range: metros visíveis do centro à borda
// opts: { yaw (direção do jogador), whole (mostra o castelo inteiro, para o mapa grande) }
export function castleMap(c, W, x, z, range = 40, opts = {}) {
  const I = CASTLE_I, px = x - I.x, pz = z - I.z, whole = !!opts.whole, R = whole ? Math.max(I.w, I.d) / 2 + 4 : range;
  const cx = whole ? 0 : px, cz = whole ? 0 : pz, k = W / (2 * R), T = (lx, lz) => [W / 2 + (lx - cx) * k, W / 2 + (lz - cz) * k];
  c.save(); c.fillStyle = '#1a140e'; c.fillRect(0, 0, W, W);
  { const [a, b] = T(-I.w / 2, -I.d / 2); c.fillStyle = '#4a4034'; c.fillRect(a, b, I.w * k, I.d * k); }
  c.fillStyle = '#5a1a20'; { const [a, b] = T(-2.3, -44); c.fillRect(a, b, 4.6 * k, 68 * k); } // tapete do salão
  c.strokeStyle = '#d8c49a'; c.lineCap = 'round'; c.lineWidth = Math.max(2, 0.9 * k);
  for (const w of CASTLE_WALLS) { const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0), ux = (w.x1 - w.x0) / len, uz = (w.z1 - w.z0) / len, cuts = [0, ...w.doors.flatMap(([p, dw]) => [p - dw / 2, p + dw / 2]), len];
    for (let i = 0; i < cuts.length; i += 2) { const [a, b] = T(w.x0 + ux * cuts[i], w.z0 + uz * cuts[i]), [e, f] = T(w.x0 + ux * cuts[i + 1], w.z0 + uz * cuts[i + 1]); c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke(); } }
  c.fillStyle = '#f2e6c4'; c.font = `bold ${Math.max(9, Math.min(14, 2.2 * k))}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const [n, lx, lz] of CASTLE_ROOMS) { const [a, b] = T(lx, lz); if (a > -40 && a < W + 40 && b > -10 && b < W + 10) c.fillText(n, a, b); }
  { const [a, b] = T(0, I.d / 2 - 0.9); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(a, b, Math.max(3, 0.9 * k), 0, 7); c.fill(); } // saída
  const [qx, qy] = T(px, pz); c.translate(qx, qy); c.rotate(-(opts.yaw || 0) + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#1a3a8a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

function buildCastleInside(ctx) {
  const I = CASTLE_I, mats = castleMats(), K = new Kit(), cols = [], H = I.h, hw = I.w / 2, hd = I.d / 2, r = rngOf(808), flames = [];
  CASTLE_WALLS.length = 0;
  const FL = (x, y, z, size, seed) => flames.push([x, y, z, size, seed]);
  // piso: lajes no salão e corredores, tábuas nos quartos e na biblioteca
  K.add(new THREE.PlaneGeometry(I.w, I.d).rotateX(-Math.PI / 2), mats.floor, 0, 0.0, 0);
  for (const [x0, z0, x1, z1] of [[-hw, -hd, -12, -14], [12, -hd, hw, 2]]) K.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mats.planks, (x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  // paredes externas (sem as janelas de "luz do dia" chapadas) e o vão da porta no sul
  const ext = [[-hw, -hd, hw, -hd, []], [-hw, -hd, -hw, hd, []], [hw, -hd, hw, hd, []], [-hw, hd, hw, hd, [[hw, 4]]]];
  for (const [x0, z0, x1, z1, d] of ext) wallWithDoors(K, cols, mats, x0, z0, x1, z1, d, H, I);
  wallWithDoors(K, cols, mats, -12, -hd, -12, hd, [[16, 3.4], [48, 3.4], [80, 3.4]], H, I);   // oeste: biblioteca, capela, salão das lâminas
  wallWithDoors(K, cols, mats, 12, -hd, 12, hd, [[14, 3.4], [38, 3.4], [76, 3.4]], H, I);     // leste: quarto real, hóspedes, cozinha
  wallWithDoors(K, cols, mats, -hw, -14, -12, -14, [], H, I); wallWithDoors(K, cols, mats, -hw, 18, -12, 18, [], H, I);
  wallWithDoors(K, cols, mats, 12, -20, hw, -20, [], H, I); wallWithDoors(K, cols, mats, 12, 2, hw, 2, [], H, I);
  wallWithDoors(K, cols, mats, -12, 30, 12, 30, [[12, 6]], H, I); // vestíbulo → salão (arco largo)
  // rodapé de pedra escura em todas as paredes (acabamento) e teto de caixotões com vigas
  for (const w of CASTLE_WALLS) { const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0), ry = Math.atan2(w.x1 - w.x0, w.z1 - w.z0); for (const sd of [-1, 1]) { const ox = Math.cos(ry) * 0.5 * sd, oz = -Math.sin(ry) * 0.5 * sd; K.add(new THREE.BoxGeometry(0.12, 0.45, len), mats.wall, (w.x0 + w.x1) / 2 + ox, 0.22, (w.z0 + w.z1) / 2 + oz, ry); } }
  K.box(I.w, 0.4, I.d, mats.beam, 0, H + 0.2, 0); for (let z = -hd + 3; z < hd; z += 6) K.box(I.w, 0.55, 0.5, mats.beam, 0, H - 0.27, z); for (let x = -hw + 4; x < hw; x += 8) K.box(0.4, 0.4, I.d, mats.beam, x, H - 0.2, 0);

  // ===== SALÃO DO TRONO (z −46..30): nave alta de pilares agrupados, arcadas, janelas altas com feixes de luz =====
  for (const sx of [-1, 1]) for (let z = -38; z <= 22; z += 10) {
    K.add(lathe([[0, 0], [1.05, 0], [1.05, 0.3], [0.95, 0.42], [0.82, 0.5], [0, 0.5]], 24), mats.inner, sx * 7, 0, z); // base moldurada
    K.cyl(0.55, 0.6, H - 2.4, mats.inner, sx * 7, (H - 2.4) / 2 + 0.5, z, 24);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; K.cyl(0.2, 0.22, H - 2.4, mats.inner, sx * 7 + Math.cos(a) * 0.62, (H - 2.4) / 2 + 0.5, z + Math.sin(a) * 0.62, 12); } // colunelos
    K.add(lathe([[0, 0], [0.85, 0], [1.05, 0.35], [1.25, 0.6], [1.25, 0.85], [0, 0.85]], 24), mats.inner, sx * 7, H - 1.95, z); // capitel
    cols.push({ x: I.x + sx * 7, z: I.z + z, r: 1.05 });
  }
  for (const sx of [-1, 1]) for (let z = -33; z <= 17; z += 10) archBlocks(K, 8.6, 0.7, 1.0, mats.inner, sx * 7, H - 5.4, z, 0, 15); // arcos entre os pilares (ao longo da nave)
  // janelas altas em ogiva nas paredes da nave, com vitral claro e feixes de sol descendo
  for (const sx of [-1, 1]) for (let z = -33; z <= 17; z += 10) {
    const sh = new THREE.Shape(); sh.moveTo(-1.0, 0); sh.lineTo(1.0, 0); sh.lineTo(1.0, 2.6); sh.quadraticCurveTo(1.0, 3.8, 0, 4.4); sh.quadraticCurveTo(-1.0, 3.8, -1.0, 2.6); sh.closePath();
    K.add(new THREE.ShapeGeometry(sh, 8), P('highGlass', '#f4ead0', { emissive: '#ffe6b0', ei: 1.0, rough: 0.3 }), sx * 11.5, 7.6, z, sx * -Math.PI / 2);
    for (let k = 0; k < 3; k++) K.box(0.08, 0.06, 2.0, M.iron(), sx * 11.48, 8.6 + k * 1.1, z, 0); K.box(0.08, 4.0, 0.06, M.iron(), sx * 11.48, 9.6, z);
  }
  // estrado do trono: degraus largos com tapete descendo, colunas de fundo e rosácea
  const back = -hd + 2.6; // fundo do estrado (encostado na parede atrás do trono)
  for (let k = 0; k < 4; k++) { const zf = -36.6 - k * 0.75, w = 17 - k * 2.2; K.box(w, 0.32, zf - back, mats.inner, 0, 0.16 + k * 0.32, (zf + back) / 2); K.box(w + 0.1, 0.06, 0.12, mats.wall, 0, 0.3 + k * 0.32, zf); } // degraus largos (pisada de 75 cm)
  for (let k = 0; k < 4; k++) K.box(3.2, 0.025, 0.74, rugMat2('#7a1a22', '#d8b04a', '#3a0e12'), 0, 0.335 + k * 0.32, -36.97 - k * 0.75); // tapete subindo os degraus
  K.box(3.2, 0.025, 4.6, rugMat2('#7a1a22', '#d8b04a', '#3a0e12'), 0, 1.295, -41.6);
  throne(K, 0, -44.2, 1.28);
  { const sh = new THREE.Shape(); sh.absarc(0, 0, 2.6, 0, Math.PI * 2, false); const g = new THREE.ShapeGeometry(sh, 32); const uv = g.attributes.uv, Pp = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (Pp.getX(i) + 2.6) / 5.2, (Pp.getY(i) + 2.6) / 5.2 * 0.6); K.add(g, stainedGlass(), 0, 8.4, -hd + 0.5); K.add(new THREE.TorusGeometry(2.7, 0.22, 10, 48), mats.inner, 0, 8.4, -hd + 0.55); }
  for (const sx of [-1, 1]) { const b = makeBanner('castelo', 2.2, 7.5); b.position.set(I.x + sx * 5, 10.4, I.z - hd + 0.6); ctx.scene.add(b); }
  rug(K, 4.4, 62, 0, -5.4, '#7a1a22', '#d8b04a', '#3a0e12');
  for (const z of [-30, -10, 10]) chandelier(K, 0, 8.5, z, 2.2);
  for (const sx of [-1, 1]) { table(K, 1.6, 12, sx * 3.5, 4); for (const sd of [-1, 1]) bench(K, 12, sx * 3.5 + sd * 1.15, 4, Math.PI / 2); for (let k = 0; k < 6; k++) { K.add(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 18), M.silver(), sx * 3.5, 0.9, -1 + k * 2); K.add(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 10), M.silver(), sx * 3.5 + 0.3, 0.96, -1 + k * 2); } }
  // tochas de ferro nos pilares (do lado da nave)
  for (const sx of [-1, 1]) for (let z = -38; z <= 22; z += 10) { const tx = sx * 7 - sx * 1.0; K.box(0.08, 0.5, 0.25, M.iron(), sx * 7 - sx * 0.65, 3.4, z); K.add(new THREE.CylinderGeometry(0.1, 0.06, 0.24, 10), M.iron(), tx, 3.62, z); K.add(new THREE.CylinderGeometry(0.04, 0.035, 0.5, 8), M.darkWood(), tx, 3.4, z); FL(tx, 3.72, z, 0.5, z * 0.3 + sx); }
  // tapeçarias ao lado do trono
  for (const sx of [-1, 1]) { K.box(0.1, 6, 3.2, cloth('tapestry' + sx, sx > 0 ? '#3e1e5a' : '#5a1e2e'), sx * 11.5, 6, -40); K.box(0.12, 0.2, 3.4, M.gold(), sx * 11.45, 9.1, -40); }

  // ===== VESTÍBULO (z 30..48): armaduras completas ladeando a entrada =====
  for (const sx of [-1, 1]) for (const z of [34, 39, 44]) armorStand(K, sx * 9.5, z, sx * -Math.PI / 2, sx > 0 ? '#8a1a22' : '#1e3a6a');
  rug(K, 3.6, 14, 0, 39, '#6a1e26', '#d8b04a', '#2a0e10');
  chandelier(K, 0, 7.5, 39, 1.6);

  // ===== BIBLIOTECA (oeste, x −38..−12, z −48..−14): dois andares de estantes, mezanino com balaustrada, escadas, mesa de mapas e o globo =====
  for (let k = 0; k < 4; k++) { bookshelf(K, 6.2, -hw + 0.6, -43 + k * 6.6, Math.PI / 2, 10 + k); bookshelf(K, 6.2, -hw + 0.6, -43 + k * 6.6, Math.PI / 2, 30 + k, 4.2); }
  for (let k = 0; k < 3; k++) { bookshelf(K, 6.4, -33 + k * 6.6, -hd + 0.6, 0, 20 + k); bookshelf(K, 6.4, -33 + k * 6.6, -hd + 0.6, 0, 40 + k, 4.2); }
  cols.push({ x: I.x - hw + 0.9, z: I.z - 33, r: 0.1, box: true, hx: 0.45, hz: 13.5, rot: 0 }, { x: I.x - 26.5, z: I.z - hd + 0.9, r: 0.1, box: true, hx: 10.5, hz: 0.45, rot: 0 });
  // mezanino em L a 4 m: piso de tábuas, vigas, balaustrada torneada e mísulas
  const mz = 4.0, mzW = 2.4;
  K.box(mzW, 0.25, 34, mats.planks, -hw + 1.2 + mzW / 2 - 0.3, mz, -31); K.box(26, 0.25, mzW, mats.planks, -25, mz, -hd + 1.2 + mzW / 2 - 0.3);
  for (let z = -46; z <= -16; z += 0.5) { K.add(lathe([[0.05, 0], [0.07, 0.15], [0.04, 0.4], [0.07, 0.75], [0.05, 0.9]], 10), M.darkWood(), -hw + 3.2, mz + 0.12, z); }
  for (let x = -35; x <= -15.2; x += 0.5) { K.add(lathe([[0.05, 0], [0.07, 0.15], [0.04, 0.4], [0.07, 0.75], [0.05, 0.9]], 10), M.darkWood(), x, mz + 0.12, -hd + 3.2); }
  K.box(0.14, 0.1, 31, M.darkWood(), -hw + 3.2, mz + 1.07, -31); K.box(20, 0.1, 0.14, M.darkWood(), -25, mz + 1.07, -hd + 3.2);
  for (let z = -44; z <= -16; z += 4) { K.cyl(0.14, 0.16, mz, M.darkWood(), -hw + 3.1, mz / 2, z, 10); K.box(0.3, 0.3, 0.3, M.darkWood(), -hw + 3.1, mz - 0.2, z); }
  for (let x = -34; x <= -14; x += 4) K.cyl(0.14, 0.16, mz, M.darkWood(), x, mz / 2, -hd + 3.1, 10);
  // escada de madeira até o mezanino e escadas de correr nas estantes
  for (let k = 0; k < 14; k++) { K.box(1.3, 0.08, 0.34, M.darkWood(), -13.4, 0.285 * (k + 1), -36.6 - k * 0.31); K.box(1.3, 0.25, 0.04, M.darkWood(), -13.4, 0.285 * (k + 1) - 0.14, -36.45 - k * 0.31); } // degraus e espelhos
  for (const sx of [-1, 1]) { K.box(0.08, 0.35, 5.8, M.darkWood(), -13.4 + sx * 0.66, 2.0, -38.6, 0, 0.74); K.box(0.06, 0.06, 5.8, M.darkWood(), -13.4 + sx * 0.66, 2.95, -38.6, 0, 0.74); for (let k = 0; k < 5; k++) K.box(0.04, 0.9, 0.04, M.darkWood(), -13.4 + sx * 0.66, 0.85 + k * 0.82 + 0.45, -36.8 - k * 0.9); }
  K.box(3.6, 0.25, 3.5, mats.planks, -13.6, mz, -43.1); // patamar ligando a escada ao mezanino
  cols.push({ x: I.x - 13.4, z: I.z - 38.6, r: 0.1, box: true, hx: 0.75, hz: 2.4, rot: 0 });
  for (const [lx, lz, ry] of [[-hw + 1.4, -38, Math.PI / 2], [-hw + 1.4, -24, Math.PI / 2], [-28, -hd + 1.4, 0]]) { const cs = Math.cos(ry), sn = Math.sin(ry); for (const sd of [-0.25, 0.25]) K.box(0.05, 4.0, 0.05, M.darkWood(), lx + sd * cs, 2.0, lz - sd * sn, ry, 0, 0.12); for (let k = 0; k < 11; k++) K.box(0.5, 0.04, 0.04, M.darkWood(), lx + 0.2 * Math.sin(ry) * 0, 0.3 + k * 0.35, lz, ry); }
  // mesas de leitura com livros abertos, pilhas, tinteiros e velas
  for (const [x, z] of [[-24, -36], [-24, -27], [-30, -31.5]]) { table(K, 3, 1.4, x, z, 0, M.darkWood()); chair(K, x - 0.8, z + 1.1, Math.PI); chair(K, x + 0.8, z - 1.1, 0);
    K.box(0.5, 0.05, 0.36, P('openBook', '#efe2c4', { rough: 0.8 }), x - 0.4, 0.92, z, 0.3); K.box(0.04, 0.06, 0.36, P('bookSpine', '#5a2a1a'), x - 0.4, 0.93, z, 0.3);
    for (let k = 0; k < 4; k++) K.box(0.32, 0.07, 0.24, P('book' + k, ['#7a2a22', '#2a4a7a', '#3a6a3a', '#7a5a2a'][k], { rough: 0.8 }), x + 0.9, 0.92 + k * 0.07, z + 0.2, k * 0.2);
    K.cyl(0.05, 0.06, 0.07, P('ink', '#121218', { rough: 0.2 }), x + 0.3, 0.92, z - 0.4, 10); candle(K, x + 1.2, 0.88, z - 0.45); FL(x + 1.2, 1.17, z - 0.45, 0.09, x); cols.push({ x: I.x + x, z: I.z + z, r: 1.4 }); }
  // mesa de mapas com o mapa de Aethra
  table(K, 3.2, 2.2, -19, -40); { const mp = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: mapTableTex(), roughness: 0.9 })); mp.position.set(I.x - 19, 0.895, I.z - 40); ctx.scene.add(mp); } cols.push({ x: I.x - 19, z: I.z - 40, r: 1.8 });
  // o globo de Aethra num suporte de latão (anel meridiano e horizonte)
  { const gx = -16, gz = -30, gy = 1.45, br = M.gold(); K.add(lathe([[0, 0], [0.45, 0], [0.45, 0.06], [0.1, 0.16], [0.07, 0.9], [0.12, 0.95], [0, 0.95]], 20), M.darkWood(), gx, 0, gz);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; K.add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), M.darkWood(), gx + Math.cos(a) * 0.3, 0.35, gz + Math.sin(a) * 0.3, -a, 0, 0.5); }
    K.add(new THREE.TorusGeometry(0.66, 0.03, 8, 48), br, gx, gy, gz, 0, Math.PI / 2); K.add(new THREE.TorusGeometry(0.7, 0.025, 8, 48), br, gx, gy, gz, 0.4, 0, 0);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 32), new THREE.MeshStandardMaterial({ map: globeTex(), roughness: 0.45, metalness: 0.05 })); gl.position.set(I.x + gx, gy, I.z + gz); gl.rotation.set(0, Math.PI / 2 + 0.35, 0.41); gl.castShadow = true; ctx.scene.add(gl); gl.userData.update = t => { gl.rotation.y = t * 0.12; }; // gira devagar: Aethra passa na frente a cada volta ctx.roomAnims.push(gl);
    cols.push({ x: I.x + gx, z: I.z + gz, r: 0.75 }); }
  // púlpito com o grande livro e candelabros de pé
  K.box(0.7, 1.1, 0.5, M.darkWood(), -14.2, 0.55, -44, 0, 0.0); K.box(0.9, 0.06, 0.7, M.darkWood(), -14.2, 1.2, -44, 0, -0.35); K.box(0.8, 0.07, 0.55, P('bigBook', '#efe2c4', { rough: 0.8 }), -14.2, 1.26, -44, 0, -0.35);
  for (const [x, z] of [[-20, -18], [-34, -18], [-14.2, -46]]) { K.add(lathe([[0, 0], [0.25, 0], [0.08, 0.1], [0.04, 1.5], [0.14, 1.6], [0, 1.62]], 14), M.gold(), x, 0, z); for (const ox of [-0.12, 0, 0.12]) { candle(K, x + ox, 1.6, z, 0.2); FL(x + ox, 1.84, z, 0.08, x + ox); } }
  rug(K, 9, 12, -24, -31, '#2a3e5a', '#c8a85a', '#14203a');
  chandelier(K, -25, 8.6, -31, 1.8); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; FL(-25 + Math.cos(a) * 1.8, 8.6 + 0.3, -31 + Math.sin(a) * 1.8, 0.1, k); }

  // ===== CAPELA (oeste, z −14..18) =====
  for (let row = 0; row < 5; row++) for (const sx of [-1, 1]) { const z = -2 + row * 3.2, x = -25 + sx * 3.2; K.box(4.4, 0.1, 0.5, M.darkWood(), x, 0.5, z); K.box(4.4, 0.8, 0.08, M.darkWood(), x, 0.9, z + 0.26); for (const e of [-1, 1]) K.box(0.08, 0.95, 0.6, M.darkWood(), x + e * 2.15, 0.48, z); cols.push({ x: I.x + x, z: I.z + z, r: 0.1, box: true, hx: 2.2, hz: 0.35, rot: 0 }); }
  K.box(4, 1.1, 1.4, mats.inner, -25, 0.55, -10.5); K.box(4.2, 0.06, 1.6, cloth('altarCloth', '#efe6d4'), -25, 1.12, -10.5); K.box(0.8, 0.06, 1.62, cloth('altarRunner', '#7a1a22'), -25, 1.13, -10.5);
  for (let k = 0; k < 5; k++) { const h = 0.3 + (k % 2) * 0.15; candle(K, -26.6 + k * 0.8, 1.15, -10.8, h); FL(-26.6 + k * 0.8, 1.15 + h + 0.03, -10.8, 0.1, k); }
  K.add(new THREE.BoxGeometry(0.2, 2.2, 0.2), M.gold(), -25, 2.6, -11.0); K.add(new THREE.BoxGeometry(1.2, 0.2, 0.2), M.gold(), -25, 3.1, -11.0);
  { const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(1.6, 0); sh.lineTo(1.6, 4); sh.absarc(0, 4, 1.6, 0, Math.PI, false); sh.closePath(); const g = new THREE.ShapeGeometry(sh, 16); const uv = g.attributes.uv, Pp = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (Pp.getX(i) + 1.6) / 3.2, Pp.getY(i) / 5.6); K.add(g, stainedGlass(), -25, 4.2, -13.5); }
  cols.push({ x: I.x - 25, z: I.z - 10.5, r: 0.1, box: true, hx: 2.1, hz: 0.8, rot: 0 });
  rug(K, 2.2, 16, -25, 4, '#6a1e26', '#d8b04a', '#2a0e10');

  // ===== SALÃO DAS LÂMINAS LENDÁRIAS (oeste, z 18..48) — S-185: espadas de grandes guerreiros em vitrines, com placa de história =====
  const LEGENDS = [
    ['Aurora de Kael', ['Forjada no primeiro amanhecer do reino,', 'quando Kael ainda era uma cidade de luz.', 'Dizem que seu fio nunca escurece.'], { blade: '#e8eef6', hilt: '#d8b04a', grip: '#5a1a1a', gem: '#ffe08a', guard: 0.24, wings: true, glow: '#3a3020' }],
    ['Dente do Inverno', ['Arrancada da Muralha Gélida pelo', 'Comandante Varek, o Primeiro.', 'O gelo da lâmina não derrete.'], { blade: '#cfe6f6', hilt: '#9ab8c8', grip: '#1e2a3a', gem: '#9ae0ff', glow: '#16303a', flare: 1.25 }],
    ['Juramento de Valcinza', ['Empunhada pelo rei Aldren nos três', 'cercos a este castelo. Nenhum muro', 'caiu enquanto ela estava erguida.'], { blade: '#dfe4ea', hilt: '#c9a24a', grip: '#3a1a4a', gem: '#c07aff', guard: 0.28, len: 1.25 }],
    ['Lâmina Silente', ['Corta sem fazer som algum.', 'Os sábios contam que a própria', 'Sentinela temia o seu brilho.'], { blade: '#9aa2b0', hilt: '#2a2a30', grip: '#111116', gem: '#7affd0', glow: '#0a2a22', w: 0.04 }],
    ['Brasa Eterna', ['Temperada no fogo de Kharzûl,', 'o Soberano das Areias Rubras.', 'Ainda está morna ao toque.'], { blade: '#e0b090', hilt: '#8a3a1a', grip: '#2a1a12', gem: '#ff6a2a', glow: '#3a1004', flare: 1.15 }],
    ['Última Promessa', ['Partida ao meio na Batalha das Dunas.', 'Sua dona jurou voltar para buscá-la —', 'e voltou, trinta anos depois.'], { blade: '#c8ccd2', hilt: '#b8b8c0', grip: '#4a2a1a', gem: '#ffffff', len: 0.7, tip: 0.02 }],
  ];
  LEGENDS.forEach(([name, lore, o], i) => {
    const z = 21.5 + i * 4.3, wx = -hw + 0.45; // painel na parede oeste
    K.box(0.18, 3.4, 2.6, M.darkWood(), wx, 2.5, z); K.box(0.06, 3.0, 2.2, cloth('velvet', '#4a0e14'), wx + 0.1, 2.55, z); // moldura e veludo
    K.box(0.12, 0.12, 2.8, M.gold(), wx + 0.12, 4.25, z); K.box(0.12, 0.12, 2.8, M.gold(), wx + 0.12, 0.8, z);
    legendSword(K, wx + 0.16, 1.4, z, Math.PI / 2, o); // de pé, ponta para cima
    K.add(new THREE.ConeGeometry(0.16, 0.3, 14, 1, true), M.iron(), wx + 0.6, 4.45, z, 0, 0, 2.4); FL(wx + 0.75, 4.25, z, 0.12, i); // luminária
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), plaqueTex(name, lore)); pl.position.set(I.x + wx + 0.62, 0.55, I.z + z); pl.rotation.set(-0.5, Math.PI / 2, 0, 'YXZ'); ctx.scene.add(pl); pl.userData.asset = 'placa_lamina'; ctx.placed.push(pl);
    K.box(0.5, 0.75, 1.8, M.darkWood(), wx + 0.5, 0.375, z); // pedestal da placa
  });
  cols.push({ x: I.x - hw + 0.8, z: I.z + 32.25, r: 0.1, box: true, hx: 0.6, hz: 13, rot: 0 });
  // placa de entrada do salão e armaduras de honra
  { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), plaqueTex('Salão das Lâminas', ['Aqui repousam as espadas dos grandes', 'guerreiros de Aethra. Que nenhuma volte', 'a ser erguida em vão.'])); pl.position.set(I.x - 12.6, 5.6, I.z + 33); pl.rotation.y = -Math.PI / 2; ctx.scene.add(pl); }
  for (let k = 0; k < 4; k++) armorStand(K, -32 + k * 4.4, 46.4, Math.PI, k % 2 ? '#8a1a22' : '#1e3a6a');
  for (let k = 0; k < 4; k++) { K.add(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 28), k % 2 ? P('shieldRed', '#7a1a22', { rough: 0.6 }) : P('shieldBlue', '#1e3e6e', { rough: 0.6 }), -12.5, 3.4, 22 + k * 6, 0, 0, Math.PI / 2); K.add(new THREE.TorusGeometry(0.6, 0.05, 8, 28), M.iron(), -12.54, 3.4, 22 + k * 6, Math.PI / 2); }
  table(K, 3.2, 1.6, -24, 32); legendSword(K, -24.6, 0.95, 32, 0, { blade: '#c8ccd2', hilt: '#8a8a8a', grip: '#3a2a1a', len: 0.9 }); cols.push({ x: I.x - 24, z: I.z + 32, r: 1.5 });
  rug(K, 6, 22, -22, 33, '#3a1e14', '#c8a85a', '#1e0e08');
  chandelier(K, -25, 8, 34, 1.4);

  // ===== QUARTO REAL (leste, z −46..−20): lareira de verdade, poltronas, dossel, tapeçaria =====
  bed(K, 30, -40, 0, 2.6, true); cols.push({ x: I.x + 30, z: I.z - 40, r: 0.1, box: true, hx: 1.5, hz: 1.4, rot: 0 });
  rug(K, 5, 4, 28, -33, '#3e1e5a', '#d8b04a', '#1e0e30', Math.PI / 2);
  const fpR = fireplace(K, 14.2, -30, Math.PI / 2, mats); cols.push({ x: I.x + 14.9, z: I.z - 30, r: 1.9 });
  for (const dz of [-1.6, 1.6]) { const cx = 17.6, cz = -30 + dz; K.box(1.0, 0.45, 1.0, cloth('armchair', '#5a1e2e'), cx, 0.45, cz); K.box(1.0, 1.0, 0.2, cloth('armchair', '#5a1e2e'), cx + 0.45, 0.95, cz, Math.PI / 2); for (const s2 of [-1, 1]) K.box(0.9, 0.35, 0.16, cloth('armchair', '#5a1e2e'), cx, 0.8, cz + s2 * 0.45); cols.push({ x: I.x + cx, z: I.z + cz, r: 0.6 }); }
  K.box(0.8, 0.5, 0.8, M.darkWood(), 17.8, 0.25, -30); K.add(new THREE.CylinderGeometry(0.08, 0.06, 0.18, 10), M.silver(), 17.8, 0.6, -30);
  K.box(2.2, 2.6, 0.8, M.darkWood(), 20, 1.3, -45.4); K.box(0.06, 2.2, 0.02, M.gold(), 20, 1.3, -44.98); cols.push({ x: I.x + 20, z: I.z - 45.4, r: 1.1 }); // guarda-roupa
  K.box(1.4, 0.6, 0.7, M.darkWood(), 30, 0.3, -37.4); K.box(1.42, 0.08, 0.72, M.gold(), 30, 0.62, -37.4); // baú ao pé da cama
  table(K, 1.4, 0.8, 35, -26); chair(K, 35, -25, Math.PI); K.box(0.9, 1.2, 0.05, P('mirror', '#cfe0e8', { metal: 0.9, rough: 0.05 }), 35, 1.8, -26.5);
  K.box(0.1, 4, 5, cloth('tapR', '#2e1e4a'), hw - 0.55, 4.5, -33); K.box(0.12, 0.2, 5.2, M.gold(), hw - 0.5, 6.55, -33);
  for (const [x, z] of [[24, -45.6], [36.6, -40]]) { K.add(lathe([[0, 0], [0.22, 0], [0.07, 0.1], [0.04, 1.3], [0.12, 1.4], [0, 1.42]], 14), M.gold(), x, 0, z); candle(K, x, 1.4, z, 0.22); FL(x, 1.66, z, 0.1, x); }
  chandelier(K, 28, 8, -33, 1.2);
  // ===== QUARTO DE HÓSPEDES =====
  bed(K, 20, -16, 0, 1.6); bed(K, 30, -16, 0, 1.6); K.box(1.2, 0.6, 0.6, M.darkWood(), 25, 0.3, -18.2);
  cols.push({ x: I.x + 20, z: I.z - 16, r: 0.1, box: true, hx: 1, hz: 1.3, rot: 0 }, { x: I.x + 30, z: I.z - 16, r: 0.1, box: true, hx: 1, hz: 1.3, rot: 0 });
  table(K, 2, 1.2, 25, -5); chair(K, 24.2, -4, Math.PI); chair(K, 25.8, -6, 0); candle(K, 25, 0.88, -5); FL(25, 1.15, -5, 0.09, 5); rug(K, 3, 4, 25, -9, '#2a4a6a', '#c8b07a', '#14243a', Math.PI / 2);
  // ===== COZINHA =====
  const fpK = fireplace(K, hw - 0.7, 20, -Math.PI / 2, mats); cols.push({ x: I.x + hw - 1.4, z: I.z + 20, r: 1.9 });
  K.add(new THREE.SphereGeometry(0.55, 20, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron(), hw - 1.7, 1.2, 20); K.box(0.04, 1.2, 0.04, M.iron(), hw - 1.7, 1.9, 20); // caldeirão
  table(K, 8, 1.6, 24, 14); for (const sd of [-1, 1]) bench(K, 8, 24, 14 + sd * 1.1); cols.push({ x: I.x + 24, z: I.z + 14, r: 0.1, box: true, hx: 4, hz: 0.9, rot: 0 });
  for (let k = 0; k < 7; k++) { const x = 21 + k * 1.0; if (k % 3 === 0) K.add(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), P('bread', '#c08a4a', { rough: 0.9 }), x, 0.88, 14, 0, 0, 0, 1.4, 0.8, 1); else if (k % 3 === 1) K.add(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6), P('cheese', '#e8c25a', { rough: 0.7 }), x, 0.97, 14.2); else for (let f = 0; f < 4; f++) K.add(new THREE.SphereGeometry(0.07, 10, 8), P('apple', '#b8322a', { rough: 0.5 }), x + (f % 2) * 0.12, 0.95, 13.8 + (f > 1 ? 0.12 : 0)); }
  for (let k = 0; k < 6; k++) K.add(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 14), P('pot', '#8a5a3a', { rough: 0.8 }), hw - 0.5, 2.0, 33 + k * 0.9);
  for (let k = 0; k < 4; k++) { K.add(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 20), M.iron(), 18 + k * 1.2, 2.8, 47.6, 0, Math.PI / 2); K.box(0.05, 0.5, 0.05, M.iron(), 18 + k * 1.2, 3.25, 47.6); }
  table(K, 3, 1.2, 30, 36); for (let k = 0; k < 3; k++) K.add(new THREE.SphereGeometry(0.25, 14, 10), P('cabbage', '#7aa04a', { rough: 0.8 }), 29 + k, 1.05, 36); K.add(new THREE.BoxGeometry(0.6, 0.06, 0.4), M.darkWood(), 31.4, 0.91, 36.2);
  // ===== arandelas com tocha nas paredes dos corredores e salas =====
  const sconce = (x, z, ry, y = 3.4) => { const cs = Math.cos(ry), sn = Math.sin(ry), at = (lz, yy) => [x + lz * sn, yy, z + lz * cs]; K.box(0.3, 0.45, 0.06, M.iron(), ...at(0, y), ry); K.add(new THREE.TorusGeometry(0.22, 0.03, 6, 12, Math.PI / 2), M.iron(), ...at(0.2, y - 0.1), ry + Math.PI / 2, 0, Math.PI); K.cyl(0.07, 0.05, 0.14, M.iron(), ...at(0.4, y + 0.1), 10); K.cyl(0.035, 0.03, 0.45, M.darkWood(), ...at(0.4, y + 0.3), 8); for (let k = 0; k < 3; k++) K.add(new THREE.TorusGeometry(0.04, 0.012, 6, 10), P('rag', '#3a2a1a', { rough: 1 }), ...at(0.4, y + 0.45 + k * 0.035), 0, Math.PI / 2); const [fx, fy, fz] = at(0.42, y + 0.56); FL(fx, fy, fz, 0.42, x + z); };
  for (const [x, z, a] of [[-37.5, -2, Math.PI / 2], [-37.5, 8, Math.PI / 2], [37.5, -30, -Math.PI / 2], [37.5, -10, -Math.PI / 2], [37.5, 40, -Math.PI / 2], [-6, 47.5, Math.PI], [6, 47.5, Math.PI], [-11.5, 40, Math.PI / 2], [11.5, 40, -Math.PI / 2]]) sconce(x, z, a);
  for (const sx of [-1, 1]) for (let z = -33; z <= 17; z += 10) { const b = makeBanner('castelo', 1.3, 3.6); b.position.set(I.x + sx * 6.0, 8.0, I.z + z); b.rotation.y = -sx * Math.PI / 2; ctx.scene.add(b); }
  for (const [x, z] of [[33, 44], [34.5, 44], [33.6, 42.6], [35, 34], [20, 46]]) ctx.place('barrel', I.x + x, I.z + z, { y: 0, rot: x });
  for (const [x, z] of [[16, 44]]) ctx.place('crate_A', I.x + x, I.z + z, { y: 0, rot: 0.3 });
  // ---------- monta, luzes e chamas ----------
  const g = K.build(); g.position.set(I.x, 0, I.z); ctx.scene.add(g);
  g.userData.asset = 'interior_castelo'; g.userData.big = true; ctx.placed.push(g);
  // paredes bloqueiam a câmera: caixas que NÃO desenham nada (colorWrite/depthWrite desligados) — antes eram brancas e
  // apareciam quando o jogo mostrava o interior (S-183: "parede branca bugada")
  const om = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const c of cols) { if (!c.hx) continue; const b = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, H, c.hz * 2), om); b.position.set(c.x, H / 2, c.z); b.rotation.y = c.ry || 0; b.visible = false; b.userData.noRender = true; ctx.scene.add(b); ctx.occluders.push(b); }
  for (const c of cols) ctx.colliders.push(c.hx ? { x: c.x, z: c.z, r: Math.max(c.hx, c.hz), box: true, hx: c.hx, hz: c.hz, rot: c.ry || 0, name: 'castelo' } : c.box ? { ...c, name: 'castelo' } : { x: c.x, z: c.z, r: c.r, name: 'castelo' });
  const lights = [[0, 39, '#ffd9a0'], [0, -30, '#ffd9a0'], [0, -10, '#ffd9a0'], [0, 10, '#ffd9a0'], [-25, -30, '#ffe2b0'], [-25, 0, '#ffe8c8'], [-25, 34, '#ffd9a0'], [16, -30, '#ffb070'], [25, -9, '#ffd9a0'], [36, 20, '#ffb070']];
  for (const [x, z, c] of lights) { const L = vlight(c, 6, 18, 1.4); L.position.set(I.x + x, 7, I.z + z); ctx.scene.add(L); }
  for (const p of [fpR, fpK]) { const f = realFlame(1.15, p[0]); f.position.set(I.x + p[0], 0.55, I.z + p[2]); ctx.scene.add(f); ctx.roomAnims.push(f); }
  // chamas pequenas (tochas, velas, candelabros): todas num grupo só, atualizado de uma vez
  const fg = new THREE.Group(), fl = [];
  for (const [x, y, z, sz, sd] of flames) { const f = realFlame(sz, sd, sz > 0.2); f.position.set(I.x + x, y, I.z + z); fg.add(f); fl.push(f); }
  fg.userData.update = t => { for (const f of fl) f.userData.update(t); }; ctx.scene.add(fg); ctx.roomAnims.push(fg);
  // NPCs do castelo
  const N = (n, x, z, yaw, anim) => ctx.roomNpc(n, I.x + x, I.z + z, yaw, anim);
  const king = N({ id: 'aldemar', name: 'Rei Aldemar', title: 'Senhor de Valcinza', model: 'Knight', show: ['Knight_Cape'], look: { race: 'humano', face: 'valente', hair: { style: 'longo', color: 'grisalho' }, beard: true },
    lines: 'Seja bem-vindo a Valcinza, aventureiro. Este castelo resistiu a três cercos e a um dragão — o salão ainda tem as marcas de fogo, se olhar com atenção.\nMeus guardas falam bem de você. Aethra precisa de gente corajosa: há algo despertando nas Catacumbas do Santuário.' }, 0, -43.9, 0, 'Sit_Chair_Idle');
  king.obj.position.y = 1.55; royalRegalia(king, 'king'); // sentado no trono, com coroa, manto e cetro
  // S-187: a rainha fica em pé no estrado, ao lado do trono (antes estava "dentro" do degrau)
  const queen = N({ id: 'isolda', name: 'Rainha Isolda', title: 'Senhora de Valcinza', model: 'Mage', look: { race: 'humano', sex: 'f', face: 'gentil', hair: { style: 'coque', color: 'loiro' } },
    lines: 'Os elfos de Aelindra mandaram o tapete do salão como presente de paz. Os anões mandaram... um machado. Cada povo com o seu jeito.' }, 2.6, -42.4, -0.25);
  queen.obj.position.y = 1.28; royalRegalia(queen, 'queen');
  for (const sx of [-1, 1]) for (const z of [-36, -24]) N({ id: 'guarda_c' + (sx > 0 ? 'l' : 'o') + (z === -36 ? '' : '2'), name: sx > 0 ? (z === -36 ? 'Sir Bertran' : 'Sir Ulric') : (z === -36 ? 'Dama Clarisse' : 'Dama Brienna'), title: 'Guarda Real', model: 'Knight', show: ['2H_Sword', 'Knight_Helmet'], hat: true, look: { race: 'humano', sex: sx > 0 ? 'm' : 'f', face: 'valente', hair: { style: 'curto', color: 'castanho' } },
    lines: 'Mantenha a postura diante do rei.' }, sx * 4.6, z, 0);
  N({ id: 'porteiro', name: 'Gervásio', title: 'Mordomo do Castelo', model: 'Mage', look: { race: 'humano', face: 'gentil', hair: { style: 'careca', color: 'branco' }, beard: true },
    lines: 'Bem-vindo! À esquerda ficam a biblioteca, a capela e o Salão das Lâminas; à direita, os aposentos reais, o quarto de hóspedes e a cozinha. O salão do trono é logo em frente.\nNão corra nos corredores, por favor: o piso foi encerado hoje.' }, 3.2, 44.5, Math.PI);
  N({ id: 'elwen', name: 'Elwen', title: 'Bibliotecária (elfa)', model: 'Mage', show: ['Spellbook_open'], look: { race: 'elfo', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
    lines: 'Silêncio, por favor. Este globo mostra Aethra inteira — o mar do sudeste, as montanhas de Pedrafunda, os campos onde estamos agora. Além dele, só o Mar Sem Fim.' }, -17.4, -27.6, -2.2);
  N({ id: 'padre_lauro', name: 'Frei Lauro', title: 'Capelão', model: 'Mage', heals: true, look: { race: 'humano', face: 'gentil', hair: { style: 'raspado', color: 'grisalho' } } }, -25, -8.4, Math.PI);
  N({ id: 'dagna', name: 'Dagna', title: 'Guardiã das Lâminas (anã)', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', sex: 'f', face: 'valente', hair: { style: 'coque', color: 'ruivo' } },
    lines: 'Cada espada desta parede tem uma história — leia as placas. A Brasa Eterna ainda esquenta a minha mão quando eu limpo a vitrine.\nSe quer refino de verdade para a sua, procure o Mestre Brakar em Pedrafunda.' }, -33.2, 30.2, -Math.PI / 2);
  N({ id: 'berta', name: 'Berta', title: 'Cozinheira', model: 'Barbarian', look: { race: 'humano', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'castanho' } },
    lines: 'Ensopado de javali com pão quentinho! Se o rei não comer tudo, sobra para os guardas — e para você, se ajudar a descascar batatas.' }, 33.8, 20, -Math.PI / 2);
  // saída (portal dourado junto à porta)
  const ex = ctx.makePortal('#ffd27a'); ex.position.set(I.x, 0, I.z + hd - 0.9); ctx.scene.add(ex); ctx.portals.push({ kind: 'exit', from: 'castelo', x: I.x, z: I.z + hd - 0.9, mesh: ex });
}
// coroa, manto com gola de arminho e cetro (S-187: "muito mais cara de rei")
function royalRegalia(npc, kind) {
  const root = npc.obj; let head = null, chest = null, hand = null;
  root.traverse(o => { if (!o.isBone) return; if (!head && /^head$/i.test(o.name)) head = o; if (!chest && /^spine_03$/i.test(o.name)) chest = o; if (!hand && /^hand_r$/i.test(o.name)) hand = o; });
  if (!head) return;
  const gold = M.gold(), gem = c => P('rgem' + c, c, { emissive: c, ei: 0.6, metal: 0.3, rough: 0.15 });
  // encaixe: na pose atual, a peça fica alinhada com o corpo (não com o eixo torto do osso) e em metros de verdade;
  // depois ela segue o osso (balança junto com a cabeça/peito/mão)
  if (npc.anim && npc.anim.update) npc.anim.update(0.5);
  root.updateMatrixWorld(true);
  const rq = new THREE.Quaternion(); root.getWorldQuaternion(rq);
  const attach = (bone, obj, off = new THREE.Vector3()) => {
    const pos = bone.getWorldPosition(new THREE.Vector3()).add(off.clone().applyQuaternion(rq));
    const world = new THREE.Matrix4().compose(pos, rq, new THREE.Vector3(1, 1, 1)), local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(world);
    local.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj);
  };
  // coroa: anel com pontas e gemas
  { const cr = new THREE.Group(), R = kind === 'king' ? 0.105 : 0.092;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 0.05, 32, 1, true), gold); band.material.side = THREE.DoubleSide; cr.add(band);
    const n = kind === 'king' ? 8 : 6; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.016, kind === 'king' ? 0.075 : 0.05, 8), gold); sp.position.set(Math.cos(a) * R, 0.055, Math.sin(a) * R); cr.add(sp); const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), gold); b.position.set(Math.cos(a) * R, 0.095, Math.sin(a) * R); if (kind === 'king') cr.add(b); const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.011, 0), gem(k % 2 ? '#c0203a' : '#2a6ad8')); gm.position.set(Math.cos(a) * R * 1.02, 0.005, Math.sin(a) * R * 1.02); cr.add(gm); }
    attach(head, cr, new THREE.Vector3(0, 0.15, -0.005)); }
  if (kind === 'king' && chest) { // manto vermelho com gola de arminho (branco com pintinhas pretas)
    const m = new THREE.Group(), red = cloth('royalRed', '#7a0e1a'), erm = P('ermine', '#f2efe8', { rough: 0.95 }), dot = P('ermDot', '#111111');
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.46, 1.3, 28, 6, true, Math.PI / 2 + 0.25, Math.PI - 0.5), red); cape.material.side = THREE.DoubleSide; cape.position.set(0, -0.62, -0.03); m.add(cape); // só nas costas, caindo até o chão
    { const P2 = cape.geometry.attributes.position; for (let i = 0; i < P2.count; i++) { const y = P2.getY(i), x = P2.getX(i); P2.setZ(i, P2.getZ(i) + Math.sin(x * 18) * 0.012 * (0.65 - y)); } cape.geometry.computeVertexNormals(); } // pregas do tecido
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.045, 10, 28), erm); col.rotation.x = Math.PI / 2; col.scale.set(1.15, 0.9, 1); m.add(col);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, d = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), dot); d.position.set(Math.cos(a) * 0.155, 0.035, Math.sin(a) * 0.125); m.add(d); }
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 6, 24, Math.PI), gold); chain.position.set(0, -0.02, 0.08); chain.rotation.set(0.35, 0, Math.PI); m.add(chain); const med = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 16), gold); med.rotation.x = Math.PI / 2 - 0.3; med.position.set(0, -0.12, 0.13); m.add(med);
    attach(chest, m, new THREE.Vector3(0, 0.2, -0.01)); }
  if (kind === 'king' && hand) { const sc = new THREE.Group(); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.7, 10), gold); rod.position.y = 0.2; sc.add(rod); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), gem('#c0203a')); orb.position.y = 0.57; sc.add(orb); const cr = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 16), gold); cr.position.y = 0.57; sc.add(cr); attach(hand, sc, new THREE.Vector3(0, -0.15, 0.03)); }
}

// ctx: { scene, colliders, occluders, placed, roomAnims, roomNpc, worldNpc, INTERIORS, addDoorPortal, makePortal, portals }
export function buildCastle(ctx) {
  ctx.INTERIORS.castelo = CASTLE_I;
  const o = buildCastleOutside(ctx);
  buildCastleInside(ctx);
  ctx.addDoorPortal('castelo', o.door.x, o.door.z, o.ry);
  // guardas no portão e no pátio
  const gate = o.W(0, HW + 8), yard = o.W(9, 6);
  ctx.worldNpc({ id: 'sentinela_v', name: 'Sargento Odo', title: 'Guarda do Portão de Valcinza', model: 'Knight', show: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'], hat: true, look: { race: 'humano', face: 'valente', hair: { style: 'curto', color: 'preto' }, beard: true },
    lines: 'Alto! ...Ah, um aventureiro. Pode entrar: o Rei Aldemar recebe visitantes no salão do trono. A porta da torre fica no fim do pátio.' }, gate.x + 4, gate.z, o.ry);
  ctx.worldNpc({ id: 'cavalarica', name: 'Rosalind', title: 'Cavalariça', model: 'Rogue', look: { race: 'humano', sex: 'f', face: 'alegre', hair: { style: 'longo', color: 'ruivo' } },
    lines: 'Os cavalos do rei comem melhor que muito cavaleiro por aí!' }, yard.x, yard.z, o.ry + Math.PI);
  return o;
}
