/* =========================================================================
   MUNDO 3D — terreno contínuo (mundo aberto), regiões, estradas e cenário.
   1 unidade = 1 metro. Norte = -Z, Leste = +X.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export const HALF = 450; // o mundo vai de -450 a +450 nos dois eixos (S-076: 9× maior que o vale original)
export const PLAY_LIMIT = 425; // até onde o jogador consegue ir (depois disso, montanhas)

export const ZONES = [
  { id: 'vila', name: 'Vila de Alvorada', lvl: 'Cidade', x: -70, z: 20, r: 30, music: 'vila', grass: '#7cb35a', safe: true },
  { id: 'campos', name: 'Campos de Verdelume', lvl: 'Nv. 1–12', x: 0, z: 28, r: 45, music: 'campo', grass: '#74ad4c' },
  { id: 'floresta', name: 'Bosque Sussurrante', lvl: 'Nv. 12–24', x: 82, z: 8, r: 45, music: 'floresta', grass: '#3f6d36' },
  { id: 'ruinas', name: 'Ruínas de Kael', lvl: 'Nv. 24–40', x: 0, z: -85, r: 42, music: 'ruinas', grass: '#6f7560' },
  // além da serra (S-076) — inspiração: Shadow of the Colossus (vastidão, gigantes de pedra) e WoW (regiões, cidades, grifos)
  { id: 'colinas', name: 'Colinas de Âmbar', lvl: 'Nv. 15–25', x: 200, z: 16, r: 58, music: 'campo', grass: '#93ad4c' },
  { id: 'pedraclara', name: 'Cidadela de Pedraclara', lvl: 'Cidade', x: 305, z: -14, r: 36, music: 'cidade', grass: '#7fab58', safe: true },
  { id: 'dunas', name: 'Dunas de Sal-Rubro', lvl: 'Nv. 22–32', x: 10, z: 292, r: 96, music: 'dunas', grass: '#d6b679' },
  { id: 'geada', name: 'Vale da Geada', lvl: 'Nv. 30–42', x: -300, z: 22, r: 96, music: 'geada', grass: '#dfe8ee' },
  { id: 'colossos', name: 'Planície dos Colossos', lvl: 'Nv. 40–55', x: 0, z: -300, r: 118, music: 'colossos', grass: '#a9b15c' },
];
export const CITY2 = { x: 305, z: -14 }; // Pedraclara
export const FROZEN = { x: -330, z: 75, r: 24 }; // lago congelado do Vale da Geada
export const TEMPLE = { x: 0, z: -392 }; // Santuário Silente (entrada das Catacumbas)
export const CAMPS = { geada: { x: -248, z: 30 }, dunas: { x: -4, z: 228 }, colossos: { x: 0, z: -212 } }; // acampamentos com mestre-grifo
export const VILLAGE = { x: -70, z: 20 };
export const LAKE = { x: 18, z: 52, r: 14, level: -0.9 };
export const ROADS = [
  [[-70, 20], [-45, 23], [-20, 26], [0, 28]],
  [[0, 28], [30, 22], [55, 14], [82, 8]],
  [[0, 28], [4, 0], [2, -30], [0, -62]],
  // estradas novas atravessam a serra por passagens (cânions)
  [[0, -62], [-3, -112], [2, -160], [0, -212], [-4, -270], [2, -330], [0, -372]], // norte: ruínas → acampamento → calçada antiga até o Santuário
  [[82, 8], [130, 12], [175, 22], [230, 10], [270, -10], [305, -14]],               // leste: bosque → colinas → Pedraclara
  [[0, 28], [-16, 66], [-12, 120], [-2, 175], [-4, 228], [12, 300]],                 // sul: campos → dunas
  [[-70, 20], [-112, 24], [-165, 30], [-210, 34], [-248, 30], [-310, 26]],           // oeste: vila → vale da geada
];

/* ---------- ruído ---------- */
function hash(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { return vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 5, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3 + 9) * 0.1; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
export function roadDist(x, z) {
  let d = 1e9;
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) d = Math.min(d, segDist(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
  return d;
}

/* ---------- montanhas na borda do mundo (fazem parte do terreno) ---------- */
const edgeDist = (x, z) => Math.pow(Math.pow(Math.abs(x), 6) + Math.pow(Math.abs(z), 6), 1 / 6); // quadrado de cantos arredondados
const ridged = (x, z) => 1 - Math.abs(vnoise(x, z) * 2 - 1);
// S-103: o Santuário fica num nicho escavado na montanha — paredões dos lados e atrás, abertura para a planície.
// templeNiche = 1 no chão do pátio, 0 na rocha; templeCliff = paredão em volta do nicho.
export function templeNiche(x, z) {
  const dx = Math.abs(x - TEMPLE.x), dz = z - TEMPLE.z;
  const w = 15.2 + Math.max(0, dz) * 0.5 + (vnoise(x * 0.12 + 3, z * 0.12) - 0.5) * 3;
  return 1 - smooth(-0.5, 5, Math.max(dx - w, -8.2 - dz));
}
export function templeCliff(x, z) {
  const d = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (d > 75) return 0;
  return (1 - templeNiche(x, z)) * (1 - smooth(36, 75, d + Math.max(0, z - TEMPLE.z) * 0.6));
}
export function mountainMask(x, z) {
  const e = edgeDist(x, z) + (vnoise(x * 0.03, z * 0.03) - 0.5) * 18;
  const inner = smooth(104, 128, e) * (1 - smooth(158, 192, e)); // serra que cerca o vale de Alvorada
  const corner = smooth(208, 262, Math.min(Math.abs(x), Math.abs(z)) + (vnoise(x * 0.02 + 5, z * 0.02) - 0.5) * 34); // maciços entre as regiões novas
  const outer = smooth(HALF - 58, HALF - 14, e); // borda do mundo
  const pass = inner > 0.01 || corner > 0.01 ? 1 - smooth(10, 26, roadDist(x, z)) : 0; // as estradas abrem passagens na serra
  const tn = Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 80 ? templeNiche(x, z) : 0; // pátio do Santuário escavado na montanha
  return Math.max(Math.max(inner, corner) * (1 - pass), outer * (1 - tn), tn < 1 ? templeCliff(x, z) : 0);
}
export function mountainH(x, z) {
  const m = mountainMask(x, z); if (m <= 0) return 0;
  const r = ridged(x * 0.022, z * 0.022) * 0.5 + ridged(x * 0.05 + 7, z * 0.05) * 0.28 + ridged(x * 0.13, z * 0.13 + 4) * 0.14 + vnoise(x * 0.3, z * 0.3) * 0.08; // cristas, picos e rochas
  const big = 0.45 + vnoise(x * 0.011 + 3, z * 0.011) * 0.9; // picos altos e vales mais baixos ao longo da cordilheira
  let h = Math.pow(m, 1.7) * (12 + r * 58) * big;
  const tc = templeCliff(x, z); if (tc > 0) h = Math.max(h, Math.pow(tc, 0.8) * (30 + r * 22)); // paredões altos em volta do Santuário
  return h;
}

/* ---------- altura do terreno ---------- */
/* ---------- lago com margem irregular (não é um círculo perfeito) ---------- */
export function lakeShape(x, z) { const a = Math.atan2(z - LAKE.z, x - LAKE.x); return 1 + 0.16 * Math.sin(3 * a + 1.1) + 0.09 * Math.sin(5 * a + 2.4) + 0.05 * Math.sin(8 * a + 0.3); }
// distância até o centro "corrigida" pela forma da margem: comparar com LAKE.r
export function lakeDist(x, z) { return Math.hypot(x - LAKE.x, z - LAKE.z) / lakeShape(x, z); }
const zw = (id, x, z) => { const zn = ZONE_BY[id]; return 1 - smooth(zn.r * 0.55, zn.r * 1.3, Math.hypot(x - zn.x, z - zn.z)); };
export function heightAt(x, z) {
  let h = (fbm(x * 0.032, z * 0.032) - 0.45) * 8;
  if (Math.abs(x) > 140 || Math.abs(z) > 140) { // relevo próprio de cada região nova
    const wC = zw('colossos', x, z), wD = zw('dunas', x, z), wG = zw('geada', x, z), wH = zw('colinas', x, z);
    h *= 1 - wC * 0.7; // planície vasta e calma
    if (wC > 0) h += wC * (fbm(x * 0.006, z * 0.006) - 0.45) * 9; // ondulações largas
    if (wD > 0) { const dune = Math.pow(Math.sin(x * 0.045 + Math.sin(z * 0.018) * 2.6 + fbm(x * 0.01, z * 0.01) * 3) * 0.5 + 0.5, 2.2); h += wD * (dune * 5.5 + (fbm(x * 0.02, z * 0.02) - 0.4) * 5); }
    if (wG > 0) h += wG * (fbm(x * 0.013 + 7, z * 0.013) - 0.42) * 15; // morros nevados
    if (wH > 0) h += wH * (fbm(x * 0.022 + 3, z * 0.022) - 0.4) * 11; // colinas
    const dc = Math.hypot(x - CITY2.x, z - CITY2.z); if (dc < 50) h *= smooth(26, 50, dc); // cidade plana
    for (const c of Object.values(CAMPS)) { const d = Math.hypot(x - c.x, z - c.z); if (d < 20) h *= smooth(8, 20, d); }
    const df = Math.hypot(x - FROZEN.x, z - FROZEN.z) / FROZEN.r; if (df < 1.5) h = h * smooth(0.95, 1.5, df) + -0.3 * (1 - smooth(0.95, 1.5, df)); // lago congelado plano
  }
  h *= smooth(16, 34, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)); // vila plana
  h *= 0.3 + 0.7 * smooth(2.5, 8, roadDist(x, z)); // estradas suaves
  const dl = lakeDist(x, z);
  if (dl < LAKE.r + 6) { const k = smooth(LAKE.r + 6, LAKE.r - 4, dl); h = h * (1 - k) + (LAKE.level - 1.3 - 1.5 * smooth(LAKE.r - 3, LAKE.r * 0.25, dl) + (vnoise(x * 0.4, z * 0.4) - 0.5) * 0.4) * k; } // fundo mais fundo no meio
  h += mountainH(x, z); // montanhas na borda
  const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (dt < 80) { const f = templeNiche(x, z) * (1 - smooth(40, 78, dt)); h = h * (1 - f) + 2 * f; } // pátio do Santuário
  return h;
}

/* ---------- região (zona) em um ponto ---------- */
const ZONE_BY = Object.fromEntries(ZONES.map(z => [z.id, z]));
// peso de cada região num ponto (somam 1): transições suaves entre biomas (S-095)
export function biome(x, z) {
  let tw = 0; const w = {};
  for (const zn of ZONES) { const d = Math.max(1, Math.hypot(x - zn.x, z - zn.z) / zn.r), v = 1 / (d * d * d * d); w[zn.id] = v; tw += v; }
  for (const k in w) w[k] /= tw; return w;
}
export function zoneAt(x, z) {
  let best = ZONES[1], bd = 1e9;
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < bd) { bd = d; best = zn; } }
  return best;
}
export function zoneWeight(id, x, z) {
  const zn = ZONE_BY[id];
  return 1 - smooth(zn.r * 0.6, zn.r * 1.4, Math.hypot(x - zn.x, z - zn.z));
}

/* ---------- malha do terreno (low-poly, cores por vértice) ---------- */
export function groundColor(x, z, h, slopeIn) {
  const c = new THREE.Color();
  // mistura das cores de grama das regiões (peso pelo inverso da distância)
  let tw = 0; const acc = new THREE.Color(0, 0, 0);
  for (const zn of ZONES) {
    const d = Math.max(1, Math.hypot(x - zn.x, z - zn.z) / zn.r);
    const w = 1 / Math.pow(d, 4); tw += w;
    const g = new THREE.Color(zn.grass); acc.r += g.r * w; acc.g += g.g * w; acc.b += g.b * w;
  }
  c.setRGB(acc.r / tw, acc.g / tw, acc.b / tw);
  const n = (fbm(x * 0.15, z * 0.15) - 0.5) * 0.12;
  c.offsetHSL(0, 0, n);
  const far = Math.abs(x) > 140 || Math.abs(z) > 140;
  if (far) { // chão das regiões novas
    const bw = biome(x, z), wD = bw.dunas, wG = bw.geada, wC = bw.colossos;
    if (wD > 0.08) { const rip = Math.sin(x * 0.9 + Math.sin(z * 0.3) * 3) * 0.5 + 0.5, dune = Math.sin(x * 0.045 + Math.sin(z * 0.018) * 2.6) * 0.5 + 0.5; c.lerp(new THREE.Color('#e8c98c').offsetHSL(0.005, 0.05, rip * 0.06 - 0.04 + (dune - 0.5) * 0.08), smooth(0.12, 0.5, wD)); } // areia bem marcada, com marolas e sombra das dunas
    if (wG > 0.08) { const patch = vnoise(x * 0.07, z * 0.07), cover = smooth(0.12, 0.55, wG); c.lerp(new THREE.Color('#f3f6f9').offsetHSL(0.55, 0.05, (patch - 0.5) * 0.06), cover * (patch > 0.6 - cover * 0.45 ? 1 : 0.35)); } // neve que vai cobrindo a grama aos poucos
    if (wC > 0.2) c.offsetHSL(0.01, 0.04, (vnoise(x * 0.03, z * 0.03) - 0.5) * 0.08); // capim dourado ondulando em manchas
    const df = Math.hypot(x - FROZEN.x, z - FROZEN.z) / FROZEN.r * (1 + (vnoise(x * 0.2, z * 0.2) - 0.5) * 0.15);
    if (df < 1.05) c.lerp(new THREE.Color('#bfe2f0').offsetHSL(0, 0, (vnoise(x * 0.5, z * 0.5) - 0.5) * 0.08), smooth(1.05, 0.95, df)); // gelo
    const dc = Math.hypot(x - CITY2.x, z - CITY2.z); if (dc < 26) c.lerp(new THREE.Color('#bdb5a3').offsetHSL(0, 0, ((Math.floor(x / 2.5) + Math.floor(z / 2.5)) & 1) * 0.03), smooth(26, 22, dc)); // praça de Pedraclara
    const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (dt < 34) c.lerp(new THREE.Color('#9e998d').offsetHSL(0, 0, ((Math.floor(x / 3) + Math.floor(z / 3)) & 1) * 0.035), smooth(34, 26, dt) * smooth(0.6, 0.95, templeNiche(x, z))); // pátio do Santuário
  }
  const rd = roadDist(x, z);
  if (rd < 3.2) { const stone = far && zw('colossos', x, z) > 0.3; c.lerp(new THREE.Color(stone ? '#a7a092' : '#b08c5a').offsetHSL(0, 0, stone ? ((Math.floor(x / 2) + Math.floor(z / 2.6)) & 1) * 0.04 : 0), smooth(3.2, 1.6, rd)); } // calçada antiga nos Colossos
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (dv < 13) c.lerp(new THREE.Color('#c2b9a6'), smooth(13, 10, dv)); // praça de pedra
  const dl = lakeDist(x, z);
  if (dl < LAKE.r + 2.5) c.lerp(new THREE.Color('#c9b98a'), smooth(LAKE.r + 2.5, LAKE.r, dl) * (0.75 + vnoise(x * 0.5, z * 0.5) * 0.25)); // areia
  if (dl < LAKE.r - 0.5) c.lerp(new THREE.Color('#6d6a4a'), smooth(LAKE.r - 0.5, LAKE.r - 4, dl) * 0.7); // lodo no fundo
  const mm = mountainMask(x, z);
  if (mm > 0.02) { // encostas: grama → rocha → neve, conforme altura e inclinação
    const slope = slopeIn ?? Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
    const nn = vnoise(x * 0.2, z * 0.2);
    const rock = new THREE.Color('#9a958b').lerp(new THREE.Color('#7b766d'), nn).offsetHSL(0, 0, (vnoise(x * 0.6, z * 0.6) - 0.5) * 0.08);
    const kr = Math.min(1, smooth(7, 18, h + nn * 5) * 0.85 + smooth(0.6, 1.2, slope)) * mm;
    c.lerp(rock, kr);
    const ks = smooth(44, 54, h + (nn - 0.5) * 10) * (1 - smooth(0.9, 1.5, slope) * 0.8);
    if (ks > 0) c.lerp(new THREE.Color('#f2f5f8').offsetHSL(0, 0, (nn - 0.5) * 0.05), ks);
  }
  const wr = zoneWeight('ruinas', x, z);
  if (wr > 0.3) { // lajes de pedra antigas no chão das ruínas
    const cell = (Math.floor(x / 3) + Math.floor(z / 3)) & 1, crack = vnoise(x * 0.7, z * 0.7);
    const slab = new THREE.Color(cell ? '#8d8a80' : '#7f7c73').offsetHSL(0, 0, (crack - 0.5) * 0.08);
    c.lerp(slab, smooth(0.3, 0.8, wr) * (vnoise(x * 0.08, z * 0.08) > 0.35 ? 0.85 : 0.3));
  }
  if (h > 6 && (mm > 0.05 || edgeDist(x, z) < 150)) c.lerp(new THREE.Color('#8a8c86'), smooth(6, 14, h) * (mm > 0.05 ? 1 : 0.6)); // rocha (só serra e vale; morros das regiões novas continuam com grama/neve)
  if (h > 22) c.lerp(new THREE.Color('#f2f4f7'), smooth(22, 30, h)); // neve
  return c;
}

// textura de detalhe (manchas e pontinhos), repetida pelo chão para tirar a cara de "chapado"
function detailTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = 0.86 + vnoise(x * 0.05, y * 0.05) * 0.1 + vnoise(x * 0.3, y * 0.3) * 0.06 + (Math.random() - 0.5) * 0.05;
    const k = (y * S + x) * 4, v = Math.max(0, Math.min(255, n * 255));
    img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(70, 70); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
// O terreno é dividido em blocos de 90 m. Todos começam com pouca resolução (rápido de montar);
// os blocos perto do jogador ganham resolução alta aos poucos (um pedacinho por quadro, sem travar).
// Cada bloco tem uma "saia" de 2 m para baixo nas bordas: não aparecem frestas entre resoluções diferentes.
const TILE = 90, NT = Math.round(HALF * 2 / TILE), LO = 24, HI = 64, HI_R = 150, LO_R = 240;
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const tiles = [];
function* tileBuilder(t, seg) {
  const step = TILE / seg, n = seg + 3, x0 = t.x0 - step, z0 = t.z0 - step; // grade com uma borda extra (saia + normais certas)
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) { for (let i = 0; i < n; i++) H[j * n + i] = heightAt(x0 + i * step, z0 + j * step); if (seg === HI && (j & 3) === 3) yield; }
  const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), v = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i, x = x0 + i * step, z = z0 + j * step, h = H[k];
      const hl = H[j * n + Math.max(0, i - 1)], hr = H[j * n + Math.min(n - 1, i + 1)], hu = H[Math.max(0, j - 1) * n + i], hd = H[Math.min(n - 1, j + 1) * n + i];
      v.set(hl - hr, 2 * step, hu - hd).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z;
      const slope = Math.hypot(hr - hl, hd - hu) / (2 * step);
      const c = groundColor(x, z, h, slope); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      const cx = Math.min(t.x0 + TILE, Math.max(t.x0, x)), cz = Math.min(t.z0 + TILE, Math.max(t.z0, z));
      pos[k * 3] = cx; pos[k * 3 + 1] = edge ? h - 2 : h; pos[k * 3 + 2] = cz;
      uv[k * 2] = cx / 300; uv[k * 2 + 1] = cz / 300; // mesma densidade da textura de antes
    }
    if (seg === HI && (j & 3) === 3) yield;
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const runNow = gen => { let r; do r = gen.next(); while (!r.done); return r.value; };
export function buildTerrain() {
  terrainMat.map = detailTexture();
  const group = new THREE.Group();
  for (let tj = 0; tj < NT; tj++) for (let ti = 0; ti < NT; ti++) {
    const t = { x0: -HALF + ti * TILE, z0: -HALF + tj * TILE, cx: -HALF + (ti + 0.5) * TILE, cz: -HALF + (tj + 0.5) * TILE, hi: null, job: null };
    t.lo = runNow(tileBuilder(t, LO));
    t.mesh = new THREE.Mesh(t.lo, terrainMat); t.mesh.receiveShadow = true; group.add(t.mesh); tiles.push(t);
  }
  return group;
}
// chamada a cada quadro: troca a resolução dos blocos conforme a distância (orçamento de ~3 ms)
export function updateTerrain(x, z, budgetMs = 3) {
  const t0 = performance.now();
  let best = null, bd = 1e9;
  for (const t of tiles) {
    const d = Math.hypot(t.cx - x, t.cz - z);
    if (t.hi && d > LO_R && t.mesh.geometry === t.hi) { t.mesh.geometry = t.lo; t.hi.dispose(); t.hi = null; }
    if (!t.hi && d < HI_R && d < bd) { bd = d; best = t; }
  }
  if (!best) return;
  if (!best.job) best.job = tileBuilder(best, HI);
  while (performance.now() - t0 < budgetMs) {
    const r = best.job.next();
    if (r.done) { best.hi = r.value; best.job = null; best.mesh.geometry = best.hi; return; }
  }
}
// constrói na hora a resolução alta em volta de um ponto (início do jogo / teleporte)
export function terrainNear(x, z, r = 100) { for (const t of tiles) if (!t.hi && Math.hypot(t.cx - x, t.cz - z) < r) { t.hi = runNow(tileBuilder(t, HI)); t.job = null; t.mesh.geometry = t.hi; } }

// cordilheira distante no horizonte (silhueta azulada com neve, como no fundo de um vale)
export function buildDistantMountains() {
  const SEGA = 300, ROWS = 7, R0 = 470, R1 = 740, pos = [], col = [], idx = [];
  const rockC = new THREE.Color('#56606e'), farC = new THREE.Color('#8ea3ba'), snowC = new THREE.Color('#e6edf4'), hazeC = new THREE.Color('#c4d8ec');
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= SEGA; i++) {
    const a = i / SEGA * Math.PI * 2, k = j / ROWS, r = R0 + (R1 - R0) * k;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const peak = ridged(a * 3.1, k * 2 + 3) * 0.6 + ridged(a * 7.3 + 2, k * 3) * 0.3 + vnoise(a * 17, k * 4) * 0.1;
    const h = (j === 0 || j === ROWS ? 0 : 1) * (45 + peak * 120) * Math.sin(k * Math.PI) - 4;
    pos.push(x, h, z);
    const c = rockC.clone().lerp(farC, 0.6 + k * 0.3).lerp(hazeC, 0.35 + k * 0.25); // névoa azulada da distância
    if (h > 105 + vnoise(a * 9, k) * 25) c.lerp(snowC, 0.75);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEGA; i++) { const a = j * (SEGA + 1) + i, b = a + SEGA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, fog: false, side: THREE.DoubleSide }));
  m.renderOrder = -1;
  return m;
}

// água com ondas, brilho do sol, cor rasa perto da margem, espuma na beira e reflexo do céu
export function buildWater() {
  const R = LAKE.r * 1.3 + 3, seg = 110;
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, depth = new Float32Array(p.count);
  const mask = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = LAKE.x + p.getX(i), z = LAKE.z + p.getZ(i);
    depth[i] = LAKE.level - heightAt(x, z);
    mask[i] = 1 - smooth(LAKE.r - 0.5, LAKE.r + 1.2, lakeDist(x, z)); // só existe água dentro do lago (nada de poças em buracos fora dele)
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1)); geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
  const mat = new THREE.MeshStandardMaterial({ color: '#2a6f9e', roughness: 0.18, metalness: 0.0, transparent: true, depthWrite: false });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'attribute float aDepth;\nattribute float aMask;\nvarying float vDepth;\nvarying float vMask;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vDepth = aDepth; vMask = aMask;
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nvarying float vDepth;\nvarying float vMask;\nvarying vec3 vWPos;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vDepth < -0.05 || vMask < 0.02) discard;
        float dk = smoothstep(0.0, 1.8, vDepth);
        diffuseColor.rgb = mix(vec3(0.20, 0.45, 0.42), vec3(0.04, 0.20, 0.34), dk);
        diffuseColor.a = mix(0.45, 0.93, smoothstep(0.0, 1.0, vDepth));
        float fo = smoothstep(0.12, 0.0, vDepth + 0.04 * sin(uTime * 1.7 + vWPos.x * 1.9 + vWPos.z * 1.4));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.92, 0.9), fo * 0.55);
        diffuseColor.a = max(diffuseColor.a, fo * 0.8);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float t = uTime; vec2 q = vWPos.xz;
          float a1 = q.x * 1.3 + t * 1.6, a2 = q.x * 2.9 + q.y * 1.7 + t * 2.3, a3 = q.x * 5.3 - q.y * 4.1 - t * 3.1, a4 = q.y * 1.1 - t * 1.3;
          float dx = 0.13 * cos(a1) + 0.17 * cos(a2) + 0.18 * cos(a3);
          float dz = 0.09 * cos(a4) + 0.10 * cos(a2) - 0.14 * cos(a3);
          vec3 wn = normalize(vec3(-dx * 0.35, 1.0, -dz * 0.35));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz); }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.52, 0.70, 0.86), fr * 0.4);
          gl_FragColor.a = mix(gl_FragColor.a, 1.0, fr * 0.5) * smoothstep(0.02, 0.6, vMask); }`);
  };
  const m = new THREE.Mesh(geo, mat);
  m.position.set(LAKE.x, LAKE.level, LAKE.z); m.receiveShadow = true; m.renderOrder = 2;
  return m;
}
// juncos e taboas na margem
export function buildReeds(rng) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 0.9 + i * 0.25, st = new THREE.CylinderGeometry(0.012, 0.02, h, 4); st.translate((i - 1.5) * 0.08, h / 2, (i % 2) * 0.07);
    st.rotateZ((i - 1.5) * 0.08); parts.push([st, '#5d7f3a']);
    if (i % 2 === 0) { const hd = new THREE.CapsuleGeometry(0.035, 0.16, 2, 6); hd.translate((i - 1.5) * 0.08 + (i - 1.5) * 0.08 * h, h + 0.05, (i % 2) * 0.07); parts.push([hd, '#6b4428']); }
  }
  for (let i = 0; i < 5; i++) { const lf = new THREE.PlaneGeometry(0.05, 0.8 + i * 0.12); lf.translate(0, 0.4 + i * 0.06, 0); lf.rotateZ((i - 2) * 0.25); lf.rotateY(i * 1.3); parts.push([lf, '#7a9a48']); }
  const geos = parts.map(([g, col]) => { const ng = g.index ? g.toNonIndexed() : g, c = new THREE.Color(col), n = ng.attributes.position.count, arr = new Float32Array(n * 3); for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; } ng.setAttribute('color', new THREE.BufferAttribute(arr, 3)); ng.deleteAttribute('uv'); if (ng.attributes.normal) ng.deleteAttribute('normal'); return ng; });
  const merged = mergeGeometries(geos); merged.computeVertexNormals();
  const inst = new THREE.InstancedMesh(merged, windMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 80);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; tries < 6000 && n < inst.count; tries++) {
    const a = rng() * Math.PI * 2, rr = LAKE.r * lakeShape(LAKE.x + Math.cos(a), LAKE.z + Math.sin(a)) * (0.95 + rng() * 0.12);
    const x = LAKE.x + Math.cos(a) * rr, z = LAKE.z + Math.sin(a) * rr;
    if (Math.sin(a * 3 + 0.7) < 0.2 || rng() < 0.3) continue; // em moitas, não um anel contínuo
    q.setFromAxisAngle(up, rng() * 6.28); const k = 0.55 + rng() * 0.4; s.set(k, k * (0.8 + rng() * 0.4), k);
    m.compose(v.set(x, Math.max(heightAt(x, z), LAKE.level - 0.5), z), q, s); inst.setMatrixAt(n++, m);
  }
  inst.count = n; inst.castShadow = true;
  return inst;
}
// vitórias-régias (estilo Victoria amazonica): folha redonda e lisa com a borda levantada, nervuras e uma fendinha na borda
export function lilyPadGeometry(seed, r) {
  let a = seed; const rng = () => ((a = (a * 16807 + 11) % 2147483647) / 2147483647);
  const RS = 72, RINGS = 10, pos = [], col = [], idx = [];
  const leaf = new THREE.Color('#4f8f34'), vein = new THREE.Color('#7fb45a'), dark = new THREE.Color('#3a6f28'), rimOut = new THREE.Color('#8a3446'), rimIn = new THREE.Color('#5d9a3e');
  const gap = 0.08 + rng() * 0.05, gapAt = rng() * Math.PI * 2; // fenda estreita só na borda
  const rimH = r * (0.09 + rng() * 0.03);
  const prof = [];
  for (let k = 0; k <= RINGS; k++) prof.push([r * k / RINGS * 0.97, 0.02 + (k / RINGS) * (k / RINGS) * 0.03, 'top']);
  prof.push([r * 0.985, rimH * 0.55, 'rimIn'], [r * 1.0, rimH, 'lip'], [r * 1.025, rimH * 0.6, 'rimOut'], [r * 1.02, 0.0, 'rimOut']);
  for (let k = 0; k < prof.length; k++) for (let j = 0; j <= RS; j++) {
    const ang = j / RS * Math.PI * 2, [rr, yy, part] = prof[k];
    const da = Math.abs(((ang - gapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI), inGap = da < gap / 2;
    const y = part === 'top' ? yy + Math.sin(ang * 5 + rr * 3) * 0.004 : inGap ? Math.min(yy, 0.03) : yy;
    pos.push(Math.cos(ang) * rr, y, Math.sin(ang) * rr);
    const c = new THREE.Color();
    if (part === 'top') { const v = Math.pow(Math.abs(Math.cos(ang * 14)), 18) * Math.min(1, rr / (r * 0.3)); c.copy(leaf).lerp(dark, 0.25 * (1 - rr / r)).lerp(vein, v * 0.75); c.offsetHSL(0, 0, (rng() - 0.5) * 0.03); }
    else c.copy(part === 'rimOut' ? rimOut : part === 'lip' ? rimOut.clone().lerp(rimIn, 0.4) : rimIn);
    col.push(c.r, c.g, c.b);
  }
  for (let k = 0; k < prof.length - 1; k++) for (let j = 0; j < RS; j++) { const p0 = k * (RS + 1) + j, p1 = p0 + RS + 1; idx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1); } // virado para cima
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g = g.toNonIndexed(); g.computeVertexNormals();
  const parts = [g];
  if (rng() < 0.4) { // flor grande branco-rosada em camadas
    const fx = (rng() - 0.5) * r * 0.6, fz = (rng() - 0.5) * r * 0.6;
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 9; i++) {
      const pt = new THREE.SphereGeometry(0.09 - layer * 0.015, 8, 6); pt.scale(0.55, 0.25, 1.6); pt.translate(0, 0, 0.12 - layer * 0.02); pt.rotateX(-0.35 - layer * 0.35); pt.rotateY(i / 9 * Math.PI * 2 + layer * 0.35); pt.translate(fx, 0.09 + layer * 0.04, fz);
      const ng = pt.toNonIndexed(), n = ng.attributes.position.count, cc = new THREE.Color(layer === 2 ? '#ffd2e2' : layer ? '#fff4f8' : '#ffffff'), arr = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) { arr[v * 3] = cc.r; arr[v * 3 + 1] = cc.g; arr[v * 3 + 2] = cc.b; }
      ng.setAttribute('color', new THREE.BufferAttribute(arr, 3)); ng.deleteAttribute('uv'); parts.push(ng);
    }
    const cen = new THREE.SphereGeometry(0.05, 8, 6).toNonIndexed(); cen.translate(fx, 0.2, fz); const n = cen.attributes.position.count, arr = new Float32Array(n * 3); for (let v = 0; v < n; v++) { arr[v * 3] = 1; arr[v * 3 + 1] = 0.82; arr[v * 3 + 2] = 0.25; } cen.setAttribute('color', new THREE.BufferAttribute(arr, 3)); cen.deleteAttribute('uv'); parts.push(cen);
  }
  return mergeGeometries(parts);
}
// céu com gradiente (cúpula)
export function buildSky(top = '#4f9be8', horizon = '#cfe7ff') {
  const geo = new THREE.SphereGeometry(880, 32, 16);
  const ct = new THREE.Color(top), ch = new THREE.Color(horizon);
  const cols = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / 880); const c = ch.clone().lerp(ct, Math.pow(k, 0.6)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

// grama de verdade: tufos de lâminas curvas que balançam com o vento + flores + pedregulhos
const windUniform = { value: 0 };
export function updateNature(time) { windUniform.value = time; }
// tufos baixos e finos (3 formatos diferentes para não parecerem carimbos iguais)
function tuftGeometry(rng, variant = 0) {
  const pos = [], col = [], idx = [];
  const base = new THREE.Color('#4f8a36'), tip = new THREE.Color(['#a8d470', '#b8dc7c', '#9cc868'][variant % 3]);
  const blades = 7 + variant * 3;
  for (let b = 0; b < blades; b++) {
    const ang = rng() * Math.PI * 2, lean = 0.03 + rng() * 0.12, h = 0.09 + rng() * (0.12 + variant * 0.04), w = 0.016 + rng() * 0.012;
    const spread = 0.04 + variant * 0.05, dx = Math.cos(ang), dz = Math.sin(ang), rr = rng() * spread, ox = Math.cos(ang + 1.3) * rr, oz = Math.sin(ang + 1.3) * rr;
    const seg = 2, start = pos.length / 3; // 2 segmentos bastam para lâminas tão curtas
    for (let s = 0; s <= seg; s++) {
      const k = s / seg, y = h * k, bend = lean * k * k, ww = w * (1 - k * 0.9);
      const cx = ox + dx * bend, cz = oz + dz * bend;
      pos.push(cx - dz * ww, y, cz + dx * ww, cx + dz * ww, y, cz - dx * ww);
      const c = base.clone().lerp(tip, k);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let s = 0; s < seg; s++) { const i = start + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function windMaterial(opts) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sway = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.25) * 0.5 + sin(uWind * 3.1 + ip.x * 0.9) * 0.2;
      transformed.x += sway * 0.09 * transformed.y * transformed.y * 6.0;
      transformed.z += sway * 0.05 * transformed.y * transformed.y * 6.0;`);
  };
  return m;
}
function flowerGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.3, 4); stem.translate(0, 0.15, 0); parts.push([stem, '#4f8a35']);
  for (let i = 0; i < 5; i++) { const pt = new THREE.SphereGeometry(0.035, 6, 4); pt.scale(1, 0.35, 0.6); const a = i / 5 * Math.PI * 2; pt.translate(Math.cos(a) * 0.04, 0.31, Math.sin(a) * 0.04); parts.push([pt, '#ffffff']); }
  const c = new THREE.SphereGeometry(0.022, 6, 4); c.translate(0, 0.32, 0); parts.push([c, '#ffd23a']);
  // junta tudo numa geometria só, com cor por vértice (a cor das pétalas vem da instância)
  const pos = [], col = [], idx = []; let off = 0;
  for (const [g, hex] of parts) {
    const gi = g.index ? g : g.toIndexed?.() || g; const pa = gi.attributes.position, cc = new THREE.Color(hex);
    for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); col.push(cc.r, cc.g, cc.b); }
    for (let i = 0; i < gi.index.count; i++) idx.push(gi.index.getX(i) + off);
    off += pa.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const grassChunks = [];
// grama em blocos de 50 m gerados conforme o jogador chega perto (o mundo é grande demais para gerar tudo de uma vez)
const GCH = 50, GN = Math.round(HALF * 2 / GCH);
let grassRoot = null, grassMat = null, flowerMat = null, tuftGeos = null, flowerGeo = null, rubbleGeo = null, rubbleMat = null;
const grassMade = new Map();
const PETAL = ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff', '#ff9a4a', '#7ad0ff'].map(c => new THREE.Color(c));
const C_FOREST = new THREE.Color('#7fa07a'), C_RUINS = new THREE.Color('#c8b98a'), C_GOLD = new THREE.Color('#e2d48e'), C_FROST = new THREE.Color('#dfe9ef'), C_DRY = new THREE.Color('#d8c48a');
function grassChunk(ci, cj) {
  let sd = (ci * 7919 + cj * 104729 + 99) % 2147483647 || 1;
  const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const x0 = -HALF + ci * GCH, z0 = -HALF + cj * GCH, cx = x0 + GCH / 2, cz = z0 + GCH / 2;
  const valley = Math.abs(cx) < 130 && Math.abs(cz) < 130;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  const tuft = [[], [], []], flw = [], rub = [];
  const tries = GCH * GCH * 0.75;
  for (let k = 0; k < tries; k++) {
    const x = x0 + rng() * GCH, z = z0 + rng() * GCH;
    if (Math.abs(x) > PLAY_LIMIT || Math.abs(z) > PLAY_LIMIT) continue;
    if (lakeDist(x, z) < LAKE.r + 1.5 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 12 || Math.hypot(x - CITY2.x, z - CITY2.z) < 27 || Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 31) continue;
    if (Math.hypot(x - FROZEN.x, z - FROZEN.z) < FROZEN.r * 1.05) continue;
    if (mountainMask(x, z) > 0.35) continue;
    const y = heightAt(x, z);
    if (valley && y > 7) continue;
    const ruins = valley ? zoneWeight('ruinas', x, z) : 0, forest = valley ? zoneWeight('floresta', x, z) : 0;
    const bw = biome(x, z), wD = bw.dunas, wG = bw.geada, wC = bw.colossos;
    q.setFromAxisAngle(up, rng() * 6.28);
    // densidade de planta pela mistura de regiões: deserto quase nada, neve pouco, planície dos colossos capim alto (transição gradual)
    const dens = 1 - wD * 0.985 - wG * 0.8 + wC * 0.15;
    if (rng() > dens) { if (wD > 0.5 && rng() < 0.02) { sc.set(0.4 + rng(), 0.3 + rng() * 0.4, 0.4 + rng()); m.compose(v.set(x, y + 0.02, z), q, sc); rub.push(m.clone()); } continue; }
    if (ruins > 0.55) {
      if (rng() < 0.5) { sc.set(0.6 + rng() * 1.4, 0.4 + rng() * 0.6, 0.6 + rng() * 1.4); m.compose(v.set(x, y + 0.03, z), q, sc); rub.push(m.clone()); continue; }
      if (rng() < 0.75) continue;
    }
    if (roadDist(x, z) < 2.2) continue; // estradas limpas
    if (rng() < 0.035 && forest < 0.5 && ruins < 0.3 && wG < 0.3 && wD < 0.3) {
      sc.setScalar(0.5 + rng() * 0.45); m.compose(v.set(x, y, z), q, sc); flw.push([m.clone(), PETAL[Math.floor(rng() * PETAL.length)]]);
    } else if (rng() < 0.75) {
      const tall = 1 + wC * 0.7; // capim alto na Planície dos Colossos
      const kk = 0.8 + rng() * 0.6; sc.set(kk, kk * (0.7 + rng() * 0.6) * tall, kk); m.compose(v.set(x, y - 0.01, z), q, sc);
      tint.setRGB(1, 1, 1).lerp(C_FOREST, forest * 0.6).lerp(C_RUINS, ruins * 0.8).lerp(C_GOLD, wC * 0.55).lerp(C_FROST, wG * 0.8).lerp(C_DRY, wD).multiplyScalar(0.85 + rng() * 0.3);
      tuft[Math.floor(rng() * 3)].push([m.clone(), tint.clone()]);
    }
  }
  const g = new THREE.Group(); g.userData.cx = cx; g.userData.cz = cz;
  tuft.forEach((arr, vi) => { if (!arr.length) return; const mesh = new THREE.InstancedMesh(tuftGeos[vi], grassMat, arr.length); mesh.receiveShadow = true; arr.forEach(([mm, cc], i) => { mesh.setMatrixAt(i, mm); mesh.setColorAt(i, cc); }); mesh.computeBoundingSphere(); g.add(mesh); });
  if (flw.length) { const f = new THREE.InstancedMesh(flowerGeo, flowerMat, flw.length); flw.forEach(([mm, cc], i) => { f.setMatrixAt(i, mm); f.setColorAt(i, cc); }); f.computeBoundingSphere(); g.add(f); }
  if (rub.length) { const r = new THREE.InstancedMesh(rubbleGeo, rubbleMat, rub.length); rub.forEach((mm, i) => r.setMatrixAt(i, mm)); r.castShadow = r.receiveShadow = true; r.computeBoundingSphere(); g.add(r); }
  return g;
}
// visibilidade (e geração/descarte) dos blocos de grama perto do jogador
export function cullGrass(x, z, force = false) {
  if (!grassRoot) return;
  let made = 0;
  const ci0 = Math.floor((x + HALF) / GCH), cj0 = Math.floor((z + HALF) / GCH);
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
    const ci = ci0 + di, cj = cj0 + dj; if (ci < 0 || cj < 0 || ci >= GN || cj >= GN) continue;
    const key = ci * 1000 + cj; if (grassMade.has(key) || (made && !force)) continue;
    const ccx = -HALF + (ci + 0.5) * GCH, ccz = -HALF + (cj + 0.5) * GCH;
    if (Math.hypot(ccx - x, ccz - z) > 140) continue;
    const g = grassChunk(ci, cj); grassMade.set(key, g); grassRoot.add(g); grassChunks.push(g); made++; // no máximo 1 bloco novo por quadro
  }
  for (const [key, g] of grassMade) {
    const d = Math.hypot(g.userData.cx - x, g.userData.cz - z);
    g.visible = d < 131;
    if (d > 280) { grassRoot.remove(g); g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); grassMade.delete(key); grassChunks.splice(grassChunks.indexOf(g), 1); } // longe demais: libera a memória
  }
}
export function buildGrass(rng) {
  grassRoot = new THREE.Group();
  grassMat = windMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  flowerMat = windMaterial({ vertexColors: true, roughness: 0.7 });
  tuftGeos = [0, 1, 2].map(v => tuftGeometry(rng, v)); flowerGeo = flowerGeometry();
  rubbleGeo = new THREE.DodecahedronGeometry(0.18, 2); rubbleMat = new THREE.MeshStandardMaterial({ color: '#8a877e', roughness: 1 });
  return grassRoot;
}
