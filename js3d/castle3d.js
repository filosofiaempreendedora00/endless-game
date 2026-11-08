/* =========================================================================
   CASTELO DE VALCINZA (S-118) — fortaleza gigante nos Campos de Valcinza.
   Por fora: muralha com ameias, torres redondas, portaria com grade, pátio e
   uma torre de menagem enorme. A porta da torre leva ao interior (sala longe
   do mundo, x = 1750): vestíbulo, salão do trono, biblioteca, capela, arsenal,
   quarto real, quarto de hóspedes e cozinha — com móveis feitos em código.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { heightAt, CASTLE } from './world3d.js';
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
  K.box(9, 1.2, 6, mats.inner, 0, 0.0, kz + KD + 3); for (let k = 0; k < 4; k++) K.box(9 - k * 0.6, 0.35, 1.0, mats.inner, 0, 0.6 + k * 0.35, kz + KD + 5.5 - k * 0.9);
  K.box(5.4, 7, 0.4, M.darkWood(), 0, 4.3, kz + KD + 0.1); archBlocks(K, 6.2, 1.2, 1.4, mats.inner, 0, 7.6, kz + KD + 0.3, 0, 13); for (const sx of [-1, 1]) K.box(1.1, 7.6, 1.4, mats.inner, sx * 3.7, 3.4, kz + KD + 0.3);
  for (let y = 1.2; y < 7; y += 1.1) for (let x = -2.2; x <= 2.2; x += 1.1) K.add(new THREE.SphereGeometry(0.09, 8, 6), M.iron(), x, y, kz + KD + 0.35);
  // pátio: chão de pedra e construções encostadas na muralha (estábulo, ferraria, poço)
  K.add(new THREE.PlaneGeometry(HW * 2 - WT, HW * 2 - WT).rotateX(-Math.PI / 2), mats.floor, 0, 0.62, 0);
  for (const sx of [-1, 1]) { K.box(14, 5, 7, mats.wall, sx * (HW - 9), 2.5, 22); gable(K, 14, 7, 3, M.slate(), sx * (HW - 9), 5, 22, Math.PI / 2 * 0 , 0.4); }
  K.cyl(1.6, 1.8, 1.0, mats.inner, -14, 1.1, 8, 24); K.cyl(1.25, 1.25, 0.1, P('wellW', '#2a4050', { rough: 0.1 }), -14, 1.55, 8, 24);
  for (const sx of [-1, 1]) K.box(0.25, 3, 0.25, M.darkWood(), -14 + sx * 1.5, 2.5, 8); K.box(3.4, 0.25, 0.25, M.darkWood(), -14, 4.0, 8); gable(K, 3.4, 2.4, 1.0, M.slate(), -14, 4.1, 8, Math.PI / 2, 0.2);
  const g = K.build(); g.position.set(C.x, y0, C.z); g.rotation.y = ry; ctx.scene.add(g);
  g.userData.asset = 'castelo_valcinza'; g.userData.big = true; g.userData.far = 520; ctx.placed.push(g); ctx.occluders.push(g); CULL.push(g); // visível de bem longe
  // colisões (caixas giradas junto com o castelo)
  const box = (lx, lz, hx, hz) => { const p = W(lx, lz); ctx.colliders.push({ x: p.x, z: p.z, r: Math.max(hx, hz), box: true, hx, hz, rot: ry, name: 'castelo_valcinza' }); };
  box(-HW, 0, WT / 2, HW); box(HW, 0, WT / 2, HW); box(0, -HW, HW, WT / 2); box(-(HW + 6) / 2, HW, (HW - 6) / 2, WT / 2 + 0.6); box((HW + 6) / 2, HW, (HW - 6) / 2, WT / 2 + 0.6);
  box(0, kz, KW + 1, KD + 0.5);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = W(sx * HW, sz * HW); ctx.colliders.push({ x: p.x, z: p.z, r: 6.6 }); }
  for (const sx of [-1, 1]) { const p = W(sx * 8.2, HW + 1.2); ctx.colliders.push({ x: p.x, z: p.z, r: 5.0 }); }
  for (const sx of [-1, 1]) box(sx * (HW - 9), 22, 7, 3.6); { const p = W(-14, 8); ctx.colliders.push({ x: p.x, z: p.z, r: 1.9 }); }
  // estandartes na torre e na portaria
  for (const [lx, ly, lz, w, h] of [[-9, 26, kz + KD + 0.4, 2.4, 9], [9, 26, kz + KD + 0.4, 2.4, 9], [-8.2, 17, HW + 6.2, 2.0, 7], [8.2, 17, HW + 6.2, 2.0, 7]]) { const b = makeBanner('castelo', w, h); const p = W(lx, lz); b.position.set(p.x, y0 + ly, p.z); b.rotation.y = ry; ctx.scene.add(b); }
  for (const sx of [-1, 1]) { const p = W(sx * 5.5, kz + KD + 4.5); brazier(ctx, p.x, y0 + 0.6, p.z, sx > 0, sx); }
  const door = W(0, kz + KD + 2.2), out = W(0, kz + KD + 7);
  return { ry, door, out, y0, W };
}

/* ---------------- por dentro (sala longe do mundo) ---------------- */
export const CASTLE_I = { name: 'Castelo de Valcinza', x: 1750, z: 0, w: 76, d: 96, h: 13, wall: '#9a9282', floor: '#6a6052', beam: '#3a2a1e', region: 'Campos de Valcinza', music: 'cidade', castle: true };
// paredes internas: [x0, z0, x1, z1, portas: [[pos ao longo da parede, largura]]]
function wallWithDoors(K, cols, mats, x0, z0, x1, z1, doors, H, I) {
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
function bookshelf(K, w, x, z, ry, seed) {
  const r = rngOf(seed), cs = Math.cos(ry), sn = Math.sin(ry), H = 3.6, wd = M.darkWood(), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
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
function armorStand(K, x, z, ry) {
  const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz, y) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs], st = M.steel();
  K.box(0.7, 0.12, 0.7, M.darkWood(), ...at(0, 0, 0.06), ry); K.cyl(0.04, 0.04, 1.3, M.darkWood(), ...at(0, 0, 0.75), 8);
  K.add(new THREE.LatheGeometry([[0.01, 0], [0.3, 0.05], [0.36, 0.35], [0.32, 0.6], [0.2, 0.7], [0.01, 0.72]].map(([a, b]) => new THREE.Vector2(a, b)), 24), st, ...at(0, 0, 1.0), ry);
  for (const sx of [-1, 1]) K.add(new THREE.SphereGeometry(0.17, 14, 10), st, ...at(sx * 0.38, 0, 1.62), ry, 0, 0, 1, 0.7, 1);
  K.add(new THREE.SphereGeometry(0.19, 16, 12), st, ...at(0, 0, 1.95), ry); K.box(0.22, 0.03, 0.05, P('visor', '#111111'), ...at(0, 0.18, 1.96), ry);
  K.add(new THREE.ConeGeometry(0.06, 0.3, 8), cloth('plume', '#8a2a2a'), ...at(0, 0, 2.25), ry);
  for (const sx of [-1, 1]) K.cyl(0.08, 0.1, 0.8, st, ...at(sx * 0.15, 0, 0.55), 10);
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
function buildCastleInside(ctx) {
  const I = CASTLE_I, mats = castleMats(), K = new Kit(), cols = [], H = I.h, hw = I.w / 2, hd = I.d / 2, r = rngOf(808);
  // piso: lajes no salão e corredores, tábuas nos quartos e na biblioteca
  K.add(new THREE.PlaneGeometry(I.w, I.d).rotateX(-Math.PI / 2), mats.floor, 0, 0.0, 0);
  for (const [x0, z0, x1, z1] of [[-hw, -hd, -12, -14], [12, -hd, hw, 2]]) K.add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mats.planks, (x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  // paredes externas com janelas em arco (luz do dia) e o vão da porta no sul
  const ext = [[-hw, -hd, hw, -hd, []], [-hw, -hd, -hw, hd, []], [hw, -hd, hw, hd, []], [-hw, hd, hw, hd, [[hw, 4]]]];
  for (const [x0, z0, x1, z1, d] of ext) wallWithDoors(K, cols, mats, x0, z0, x1, z1, d, H, I);
  for (const sx of [-1, 1]) for (let z = -hd + 8; z < hd - 4; z += 10) { const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0.9, 3); sh.absarc(0, 3, 0.9, 0, Math.PI, false); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }), P('dayGlass', '#e8f2ff', { emissive: '#cfe4ff', ei: 1.1, rough: 0.2 }), sx * (hw - 0.5), 3.2, z, sx * -Math.PI / 2); }
  // divisões: salão do trono no meio (x −12..12), alas oeste e leste
  wallWithDoors(K, cols, mats, -12, -hd, -12, hd, [[16, 3.4], [48, 3.4], [80, 3.4]], H, I);   // oeste: biblioteca, capela, arsenal
  wallWithDoors(K, cols, mats, 12, -hd, 12, hd, [[14, 3.4], [38, 3.4], [76, 3.4]], H, I);     // leste: quarto real, hóspedes, cozinha
  wallWithDoors(K, cols, mats, -hw, -14, -12, -14, [], H, I); wallWithDoors(K, cols, mats, -hw, 18, -12, 18, [], H, I);
  wallWithDoors(K, cols, mats, 12, -20, hw, -20, [], H, I); wallWithDoors(K, cols, mats, 12, 2, hw, 2, [], H, I);
  wallWithDoors(K, cols, mats, -12, 30, 12, 30, [[12, 6]], H, I); // vestíbulo → salão (arco largo)
  // teto com vigas
  K.box(I.w, 0.4, I.d, mats.beam, 0, H + 0.2, 0); for (let z = -hd + 3; z < hd; z += 6) K.box(I.w, 0.5, 0.45, mats.beam, 0, H - 0.25, z);
  // ---------- vestíbulo (z 30..48) ----------
  for (const sx of [-1, 1]) { armorStand(K, sx * 9, 36, sx * -Math.PI / 2); armorStand(K, sx * 9, 42, sx * -Math.PI / 2); }
  K.box(4, 0.03, 14, rugMat('#6a1e26', '#d8b04a'), 0, 0.03, 39);
  chandelier(K, 0, 7.5, 39, 1.6);
  // ---------- salão do trono (z −46..30) ----------
  for (const sx of [-1, 1]) for (let z = -38; z <= 22; z += 10) { K.box(1.6, 0.6, 1.6, mats.inner, sx * 7, 0.3, z); K.cyl(0.6, 0.66, H - 1.4, mats.inner, sx * 7, (H - 1.4) / 2 + 0.6, z, 20); K.box(1.7, 0.8, 1.7, mats.inner, sx * 7, H - 0.4, z); cols.push({ x: I.x + sx * 7, z: I.z + z, r: 0.85 }); }
  K.box(4.6, 0.03, 68, rugMat('#7a1a22', '#e0b84a'), 0, 0.03, -10);
  for (let k = 0; k < 3; k++) K.box(14 - k * 2, 0.4, 5 - k * 1.2, mats.inner, 0, 0.2 + k * 0.4, -42.5 + k * 0.3); // estrado do trono
  throne(K, 0, -43.2, 1.2);
  for (const sx of [-1, 1]) { K.box(0.1, 6, 3.2, cloth('tapestry' + sx, sx > 0 ? '#3e1e5a' : '#5a1e2e'), sx * 11.5, 6, -40); K.box(0.12, 0.2, 3.4, M.gold(), sx * 11.45, 9.1, -40); }
  for (const z of [-30, -10, 10]) chandelier(K, 0, 8.5, z, 2.0);
  for (const sx of [-1, 1]) { table(K, 1.6, 12, sx * 3.5, 4); for (const sd of [-1, 1]) bench(K, 12, sx * 3.5 + sd * 1.15, 4, Math.PI / 2); for (let k = 0; k < 6; k++) { K.add(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 18), M.silver(), sx * 3.5, 0.9, -1 + k * 2); candle(K, sx * 3.5, 0.88, -0.2 + k * 2); } }
  // ---------- biblioteca (oeste, z −46..−14) ----------
  for (let k = 0; k < 4; k++) { bookshelf(K, 5, -hw + 0.6, -42 + k * 7, Math.PI / 2, 10 + k); cols.push({ x: I.x - hw + 0.9, z: I.z - 42 + k * 7, r: 0.6, box: true, hx: 0.4, hz: 2.5, rot: 0 }); }
  for (let k = 0; k < 2; k++) { bookshelf(K, 6, -30 + k * 8, -hd + 0.6, 0, 20 + k); }
  for (const [x, z] of [[-24, -34], [-24, -24]]) { table(K, 3, 1.4, x, z, 0, M.darkWood()); chair(K, x - 0.8, z + 1.1, Math.PI); chair(K, x + 0.8, z - 1.1, 0); candle(K, x + 1.1, 0.88, z); K.box(0.45, 0.08, 0.32, P('openBook', '#efe2c4', { rough: 0.8 }), x - 0.4, 0.92, z, 0.3); cols.push({ x: I.x + x, z: I.z + z, r: 1.4 }); }
  K.add(new THREE.SphereGeometry(0.45, 24, 16), P('globe', '#5a8aa0', { rough: 0.6 }), -16, 1.5, -40); K.add(new THREE.TorusGeometry(0.52, 0.03, 8, 32), M.gold(), -16, 1.5, -40, 0.3); K.cyl(0.05, 0.25, 1.05, M.darkWood(), -16, 0.52, -40, 12);
  chandelier(K, -25, 8, -30, 1.4);
  // ---------- capela (oeste, z −14..18) ----------
  for (let row = 0; row < 5; row++) for (const sx of [-1, 1]) { const z = -2 + row * 3.2, x = -25 + sx * 3.2; K.box(4.4, 0.1, 0.5, M.darkWood(), x, 0.5, z); K.box(4.4, 0.8, 0.08, M.darkWood(), x, 0.9, z + 0.26); for (const e of [-1, 1]) K.box(0.08, 0.95, 0.6, M.darkWood(), x + e * 2.15, 0.48, z); cols.push({ x: I.x + x, z: I.z + z, r: 0.1, box: true, hx: 2.2, hz: 0.35, rot: 0 }); }
  K.box(4, 1.1, 1.4, mats.inner, -25, 0.55, -10.5); K.box(4.2, 0.06, 1.6, cloth('altarCloth', '#efe6d4'), -25, 1.12, -10.5); K.box(0.8, 0.06, 1.62, cloth('altarRunner', '#7a1a22'), -25, 1.13, -10.5);
  for (let k = 0; k < 5; k++) candle(K, -26.6 + k * 0.8, 1.15, -10.8, 0.3 + (k % 2) * 0.15);
  K.add(new THREE.BoxGeometry(0.2, 2.2, 0.2), M.gold(), -25, 2.6, -11.0); K.add(new THREE.BoxGeometry(1.2, 0.2, 0.2), M.gold(), -25, 3.1, -11.0);
  { const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(1.6, 0); sh.lineTo(1.6, 4); sh.absarc(0, 4, 1.6, 0, Math.PI, false); sh.closePath(); const g = new THREE.ShapeGeometry(sh, 16); const uv = g.attributes.uv, Pp = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (Pp.getX(i) + 1.6) / 3.2, Pp.getY(i) / 5.6); K.add(g, stainedGlass(), -25, 4.2, -13.5); }
  cols.push({ x: I.x - 25, z: I.z - 10.5, r: 0.1, box: true, hx: 2.1, hz: 0.8, rot: 0 });
  // ---------- arsenal (oeste, z 18..48) ----------
  for (let k = 0; k < 4; k++) armorStand(K, -34 + k * 3, 21, 0);
  for (let k = 0; k < 3; k++) { const z = 28 + k * 6; K.box(0.3, 0.15, 4.4, M.darkWood(), -hw + 0.5, 2.6, z); K.box(0.3, 0.15, 4.4, M.darkWood(), -hw + 0.5, 1.0, z); for (let j = 0; j < 5; j++) K.add(swordGeo(), M.steel(), -hw + 0.6, 1.3, z - 1.8 + j * 0.9, Math.PI / 2, 0, 0, 1.4, 1.4, 1.4); }
  for (let k = 0; k < 4; k++) { K.add(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 28), k % 2 ? P('shieldRed', '#7a1a22', { rough: 0.6 }) : P('shieldBlue', '#1e3e6e', { rough: 0.6 }), -14 + 0.5, 3.4, 22 + k * 6, 0, 0, Math.PI / 2); K.add(new THREE.TorusGeometry(0.6, 0.05, 8, 28), M.iron(), -14 + 0.46, 3.4, 22 + k * 6, Math.PI / 2); }
  for (let k = 0; k < 3; k++) for (const g of axeGeo(1.8, 0.45)) K.add(g, M.steel(), -24 + k * 1.2, 0, 46.6, 0, 0.12, 0);
  table(K, 3.2, 1.6, -26, 34); for (let k = 0; k < 3; k++) K.add(swordGeo(), M.steel(), -27 + k * 0.9, 0.9, 34, 0, -Math.PI / 2, 0, 1.3, 1.3, 1.3); cols.push({ x: I.x - 26, z: I.z + 34, r: 1.5 });
  chandelier(K, -25, 8, 34, 1.4);
  // ---------- quarto real (leste, z −46..−20) ----------
  bed(K, 30, -40, 0, 2.6, true); cols.push({ x: I.x + 30, z: I.z - 40, r: 0.1, box: true, hx: 1.5, hz: 1.4, rot: 0 });
  K.box(5, 0.03, 4, rugMat('#3e1e5a', '#d8b04a'), 28, 0.03, -33);
  const fpR = fireplace(K, 14.2, -30, Math.PI / 2, mats); cols.push({ x: I.x + 14.9, z: I.z - 30, r: 1.9 });
  K.box(2.2, 2.6, 0.8, M.darkWood(), 20, 1.3, -45.4); K.box(0.06, 2.2, 0.02, M.gold(), 20, 1.3, -44.98); cols.push({ x: I.x + 20, z: I.z - 45.4, r: 1.1 }); // guarda-roupa
  K.box(1.4, 0.6, 0.7, M.darkWood(), 30, 0.3, -37.4); K.box(1.42, 0.08, 0.72, M.gold(), 30, 0.62, -37.4); // baú ao pé da cama
  table(K, 1.4, 0.8, 35, -26); chair(K, 35, -25, Math.PI); K.box(0.9, 1.2, 0.05, P('mirror', '#cfe0e8', { metal: 0.9, rough: 0.05 }), 35, 1.8, -26.5); chandelier(K, 28, 8, -33, 1.2);
  // ---------- quarto de hóspedes (leste, z −20..2) ----------
  bed(K, 20, -16, 0, 1.6); bed(K, 30, -16, 0, 1.6); K.box(1.2, 0.6, 0.6, M.darkWood(), 25, 0.3, -18.2);
  cols.push({ x: I.x + 20, z: I.z - 16, r: 0.1, box: true, hx: 1, hz: 1.3, rot: 0 }, { x: I.x + 30, z: I.z - 16, r: 0.1, box: true, hx: 1, hz: 1.3, rot: 0 });
  table(K, 2, 1.2, 25, -5); chair(K, 24.2, -4, Math.PI); chair(K, 25.8, -6, 0); candle(K, 25, 0.88, -5); K.box(4, 0.03, 3, rugMat('#2a4a6a', '#c8b07a'), 25, 0.03, -9);
  // ---------- cozinha (leste, z 2..48) ----------
  const fpK = fireplace(K, hw - 0.7, 20, -Math.PI / 2, mats); cols.push({ x: I.x + hw - 1.4, z: I.z + 20, r: 1.9 });
  K.add(new THREE.SphereGeometry(0.55, 20, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron(), hw - 1.7, 1.2, 20); K.box(0.04, 1.2, 0.04, M.iron(), hw - 1.7, 1.9, 20); // caldeirão
  table(K, 8, 1.6, 24, 14); for (const sd of [-1, 1]) bench(K, 8, 24, 14 + sd * 1.1); cols.push({ x: I.x + 24, z: I.z + 14, r: 0.1, box: true, hx: 4, hz: 0.9, rot: 0 });
  for (let k = 0; k < 7; k++) { const x = 21 + k * 1.0; if (k % 3 === 0) K.add(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), P('bread', '#c08a4a', { rough: 0.9 }), x, 0.88, 14, 0, 0, 0, 1.4, 0.8, 1); else if (k % 3 === 1) K.add(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6), P('cheese', '#e8c25a', { rough: 0.7 }), x, 0.97, 14.2); else for (let f = 0; f < 4; f++) K.add(new THREE.SphereGeometry(0.07, 10, 8), P('apple', '#b8322a', { rough: 0.5 }), x + (f % 2) * 0.12, 0.95, 13.8 + (f > 1 ? 0.12 : 0)); }
  for (let k = 0; k < 5; k++) { K.box(0.3, 0.05, 2.5, M.darkWood(), hw - 0.5, 1.8 + k * 0 + (k > 2 ? 1 : 0), 34 + (k % 3) * 3); }
  for (let k = 0; k < 6; k++) K.add(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 14), P('pot', '#8a5a3a', { rough: 0.8 }), hw - 0.5, 2.0, 33 + k * 0.9);
  for (let k = 0; k < 4; k++) { K.add(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 20), M.iron(), 18 + k * 1.2, 2.8, 47.6, 0, Math.PI / 2); K.box(0.05, 0.5, 0.05, M.iron(), 18 + k * 1.2, 3.25, 47.6); } // panelas penduradas
  // ---------- detalhes: tapetes, arandelas com tocha, estandartes e mantimentos ----------
  K.box(10, 0.03, 7, rugMat('#2a3e5a', '#c8a85a'), -25, 0.04, -29); K.box(2.2, 0.03, 16, rugMat('#6a1e26', '#d8b04a'), -25, 0.04, 4);
  K.box(6, 0.03, 4, rugMat('#5a3a1e', '#c8a85a'), -26, 0.04, 34);
  const sconces = [];
  const sconce = (x, z, ry, y = 3.4) => { const cs = Math.cos(ry), sn = Math.sin(ry), at = (lz, yy) => [x + lz * sn, yy, z + lz * cs]; K.box(0.3, 0.45, 0.06, M.iron(), ...at(0, y), ry); K.add(new THREE.TorusGeometry(0.22, 0.03, 6, 12, Math.PI / 2), M.iron(), ...at(0.2, y - 0.1), ry + Math.PI / 2, 0, Math.PI); K.cyl(0.06, 0.045, 0.1, M.iron(), ...at(0.4, y + 0.1), 10); K.cyl(0.035, 0.03, 0.45, M.darkWood(), ...at(0.4, y + 0.3), 8); sconces.push(at(0.42, y + 0.55)); };
  for (let z = -35; z <= 25; z += 10) { sconce(-11.5, z, Math.PI / 2); sconce(11.5, z, -Math.PI / 2); }
  for (const [x, z, a] of [[-37.5, -26, Math.PI / 2], [-37.5, -2, Math.PI / 2], [-37.5, 8, Math.PI / 2], [-37.5, 30, Math.PI / 2], [37.5, -30, -Math.PI / 2], [37.5, -10, -Math.PI / 2], [37.5, 40, -Math.PI / 2], [-6, 47.5, Math.PI], [6, 47.5, Math.PI]]) sconce(x, z, a);
  for (const sx of [-1, 1]) for (let z = -33; z <= 17; z += 10) { const b = makeBanner('castelo', 1.3, 3.6); b.position.set(I.x + sx * 6.25, 8.6, I.z + z); b.rotation.y = -sx * Math.PI / 2; ctx.scene.add(b); }
  for (const [x, z] of [[33, 44], [34.5, 44], [33.6, 42.6], [35, 34], [20, 46], [-36, 46], [-34.6, 46]]) ctx.place('barrel', I.x + x, I.z + z, { y: 0, rot: x });
  for (const [x, z] of [[30, 46], [28.6, 46.4], [36, 26]]) ctx.place('sack', I.x + x, I.z + z, { y: 0, rot: z });
  for (const [x, z] of [[-35, 40], [-33, 41], [16, 44]]) ctx.place('crate_A', I.x + x, I.z + z, { y: 0, rot: 0.3 });
  table(K, 3, 1.2, 30, 36); for (let k = 0; k < 3; k++) K.add(new THREE.SphereGeometry(0.25, 14, 10), P('cabbage', '#7aa04a', { rough: 0.8 }), 29 + k, 1.05, 36); K.add(new THREE.BoxGeometry(0.6, 0.06, 0.4), M.darkWood(), 31.4, 0.91, 36.2); // bancada com legumes e tábua de cortar
  // ---------- luzes (virtuais) e chamas ----------
  const g = K.build(); g.position.set(I.x, 0, I.z); ctx.scene.add(g);
  g.userData.asset = 'interior_castelo'; g.userData.big = true; ctx.placed.push(g); // big: o cullScenery não esconde (ele mede a distância pela porta lá fora)
  // paredes do interior bloqueiam a câmera: uma malha só com elas não dá; usamos as colisões como caixas finas também para a câmera
  const occ = new THREE.Group(); occ.visible = false; const om = new THREE.MeshBasicMaterial();
  for (const c of cols) { if (!c.hx) continue; const b = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, H, c.hz * 2), om); b.position.set(c.x, H / 2, c.z); b.rotation.y = c.ry || 0; occ.add(b); }
  ctx.scene.add(occ); occ.updateMatrixWorld(true); for (const b of [...occ.children]) { b.visible = false; ctx.scene.attach(b); ctx.occluders.push(b); } // invisíveis: só o raio da câmera bate nelas
  for (const c of cols) ctx.colliders.push(c.hx ? { x: c.x, z: c.z, r: Math.max(c.hx, c.hz), box: true, hx: c.hx, hz: c.hz, rot: c.ry || 0, name: 'castelo' } : c.box ? { ...c, name: 'castelo' } : { x: c.x, z: c.z, r: c.r, name: 'castelo' });
  const lights = [[0, 39, '#ffd9a0'], [0, -30, '#ffd9a0'], [0, -10, '#ffd9a0'], [0, 10, '#ffd9a0'], [-25, -30, '#ffe2b0'], [-25, 0, '#ffe8c8'], [-25, 34, '#ffd9a0'], [28, -33, '#ffd0a0'], [25, -9, '#ffd9a0'], [24, 20, '#ffb070']];
  for (const [x, z, c] of lights) { const L = vlight(c, 6, 18, 1.4); L.position.set(I.x + x, 7, I.z + z); ctx.scene.add(L); }
  for (const p of [fpR, fpK]) { const f = flame(2.0, p[0]); f.position.set(I.x + p[0], 0.4, I.z + p[2]); ctx.scene.add(f); ctx.roomAnims.push(f); }
  sconces.forEach(([x, y, z], i) => { const f = flame(0.45, i * 1.7); f.position.set(I.x + x, y, I.z + z); ctx.scene.add(f); ctx.roomAnims.push(f); });
  // NPCs do castelo (humanos)
  const N = (n, x, z, yaw, anim) => ctx.roomNpc(n, I.x + x, I.z + z, yaw, anim);
  const king = N({ id: 'aldemar', name: 'Rei Aldemar', title: 'Senhor de Valcinza', model: 'Knight', show: ['Knight_Cape'], look: { race: 'humano', face: 'sereno', hair: { style: 'curto', color: 'grisalho' }, beard: true },
    lines: 'Seja bem-vindo a Valcinza, aventureiro. Este castelo resistiu a três cercos e a um dragão — o salão ainda tem as marcas de fogo, se olhar com atenção.\nMeus guardas falam bem de você. Aethra precisa de gente corajosa: há algo despertando nas Catacumbas do Santuário.' }, 0, -42.95, 0, 'Sit_Chair_Idle');
  king.obj.position.y = 1.5; // sentado no trono, em cima do estrado
  N({ id: 'isolda', name: 'Rainha Isolda', title: 'Senhora de Valcinza', model: 'Mage', show: ['Mage_Cape'], look: { race: 'humano', sex: 'f', face: 'gentil', hair: { style: 'coque', color: 'loiro' } },
    lines: 'Os elfos de Aelindra mandaram o tapete do salão como presente de paz. Os anões mandaram... um machado. Cada povo com o seu jeito.' }, 3.4, -40.5, -0.4);
  for (const sx of [-1, 1]) N({ id: 'guarda_c' + (sx > 0 ? 'l' : 'o'), name: sx > 0 ? 'Sir Bertran' : 'Dama Clarisse', title: 'Guarda Real', model: 'Knight', show: ['2H_Sword', 'Knight_Helmet', 'Knight_Cape'], hat: true, look: { race: 'humano', sex: sx > 0 ? 'm' : 'f', face: 'valente', hair: { style: 'curto', color: 'castanho' } },
    lines: 'Mantenha a postura diante do rei.' }, sx * 5, -36, 0);
  N({ id: 'porteiro', name: 'Gervásio', title: 'Mordomo do Castelo', model: 'Mage', look: { race: 'humano', face: 'gentil', hair: { style: 'careca', color: 'branco' }, beard: true },
    lines: 'Bem-vindo! À esquerda ficam a biblioteca, a capela e o arsenal; à direita, os aposentos reais, o quarto de hóspedes e a cozinha. O salão do trono é logo em frente.\nNão corra nos corredores, por favor: o piso foi encerado hoje.' }, 3, 40, Math.PI);
  N({ id: 'elwen', name: 'Elwen', title: 'Bibliotecária (elfa)', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], look: { race: 'elfo', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
    lines: 'Silêncio, por favor. Esta biblioteca guarda os mapas antigos de Aethra — inclusive dos tempos em que o mar chegava até as dunas.' }, -20, -30, -Math.PI / 2);
  N({ id: 'padre_lauro', name: 'Frei Lauro', title: 'Capelão', model: 'Mage', heals: true, look: { race: 'humano', face: 'gentil', hair: { style: 'raspado', color: 'grisalho' } } }, -25, -8.5, Math.PI);
  N({ id: 'dagna', name: 'Dagna', title: 'Armeira (anã)', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', sex: 'f', face: 'valente', hair: { style: 'coque', color: 'ruivo' } },
    lines: 'Vim de Pedrafunda cuidar das armas do rei. Aço humano é bom... para humanos. Se quer refino de verdade, procure o Mestre Brakar.' }, -30, 36, Math.PI / 2);
  N({ id: 'berta', name: 'Berta', title: 'Cozinheira', model: 'Barbarian', show: ['Mug'], look: { race: 'humano', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'castanho' } },
    lines: 'Ensopado de javali com pão quentinho! Se o rei não comer tudo, sobra para os guardas — e para você, se ajudar a descascar batatas.' }, 30, 18, -Math.PI / 2);
  // saída (portal dourado junto à porta)
  const ex = ctx.makePortal('#ffd27a'); ex.position.set(I.x, 0, I.z + hd - 0.9); ctx.scene.add(ex); ctx.portals.push({ kind: 'exit', from: 'castelo', x: I.x, z: I.z + hd - 0.9, mesh: ex });
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
