/* =========================================================================
   MUNDO 3D — terreno contínuo (mundo aberto), regiões, estradas e cenário.
   1 unidade = 1 metro. Norte = -Z, Leste = +X.
   ========================================================================= */
import * as THREE from 'three';

export const HALF = 150; // o mundo vai de -150 a +150 nos dois eixos
export const PLAY_LIMIT = 128; // até onde o jogador consegue ir (depois disso, montanhas)

export const ZONES = [
  { id: 'vila', name: 'Vila de Alvorada', lvl: 'Cidade', x: -70, z: 20, r: 30, music: 'vila', grass: '#7cb35a', safe: true },
  { id: 'campos', name: 'Campos de Verdelume', lvl: 'Nv. 1–12', x: 0, z: 28, r: 45, music: 'campo', grass: '#74ad4c' },
  { id: 'floresta', name: 'Bosque Sussurrante', lvl: 'Nv. 12–24', x: 82, z: 8, r: 45, music: 'floresta', grass: '#3f6d36' },
  { id: 'ruinas', name: 'Ruínas de Kael', lvl: 'Nv. 24–40', x: 0, z: -85, r: 42, music: 'ruinas', grass: '#6f7560' },
];
export const VILLAGE = { x: -70, z: 20 };
export const LAKE = { x: 18, z: 52, r: 14, level: -0.9 };
export const ROADS = [
  [[-70, 20], [-45, 23], [-20, 26], [0, 28]],
  [[0, 28], [30, 22], [55, 14], [82, 8]],
  [[0, 28], [4, 0], [2, -30], [0, -62]],
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

/* ---------- altura do terreno ---------- */
export function heightAt(x, z) {
  let h = (fbm(x * 0.032, z * 0.032) - 0.45) * 8;
  h *= smooth(16, 34, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)); // vila plana
  h *= 0.3 + 0.7 * smooth(2.5, 8, roadDist(x, z)); // estradas suaves
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r + 6) { const k = smooth(LAKE.r + 6, LAKE.r - 4, dl); h = h * (1 - k) + (LAKE.level - 1.6) * k; }
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += Math.pow(Math.max(0, e - 118) / 22, 2) * 22; // montanhas na borda
  return h;
}

/* ---------- região (zona) em um ponto ---------- */
export function zoneAt(x, z) {
  let best = ZONES[1], bd = 1e9;
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < bd) { bd = d; best = zn; } }
  return best;
}
export function zoneWeight(id, x, z) {
  const zn = ZONES.find(q => q.id === id);
  return 1 - smooth(zn.r * 0.6, zn.r * 1.4, Math.hypot(x - zn.x, z - zn.z));
}

/* ---------- malha do terreno (low-poly, cores por vértice) ---------- */
export function groundColor(x, z, h) {
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
  const rd = roadDist(x, z);
  if (rd < 3.2) c.lerp(new THREE.Color('#b08c5a'), smooth(3.2, 1.6, rd));
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (dv < 13) c.lerp(new THREE.Color('#c2b9a6'), smooth(13, 10, dv)); // praça de pedra
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r + 2.5) c.lerp(new THREE.Color('#d8c48a'), smooth(LAKE.r + 2.5, LAKE.r, dl)); // areia
  if (h > 6) c.lerp(new THREE.Color('#8a8c86'), smooth(6, 14, h)); // rocha
  if (h > 22) c.lerp(new THREE.Color('#f2f4f7'), smooth(22, 30, h)); // neve
  return c;
}

export function buildTerrain() {
  const SEG = 150;
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = groundColor(x, z, h);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater() {
  const geo = new THREE.CircleGeometry(LAKE.r + 1.5, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#3a86c8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(LAKE.x, LAKE.level, LAKE.z);
  return m;
}

// céu com gradiente (cúpula)
export function buildSky(top = '#4f9be8', horizon = '#cfe7ff') {
  const geo = new THREE.SphereGeometry(480, 32, 16);
  const ct = new THREE.Color(top), ch = new THREE.Color(horizon);
  const cols = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / 480); const c = ch.clone().lerp(ct, Math.pow(k, 0.6)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

// tufos de grama e flores (instanciados: milhares por pouco custo)
export function buildGrass(rng) {
  const group = new THREE.Group();
  const tuftGeo = new THREE.ConeGeometry(0.07, 0.45, 3); tuftGeo.translate(0, 0.2, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: '#5e9a3e', roughness: 1, flatShading: true }), 5000);
  const flowerGeo = new THREE.IcosahedronGeometry(0.09, 0); flowerGeo.translate(0, 0.25, 0);
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), 900);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const FLOWER = ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff'].map(c => new THREE.Color(c));
  let nt = 0, nf = 0;
  for (let tries = 0; tries < 20000 && (nt < tufts.count || nf < flowers.count); tries++) {
    const x = (rng() * 2 - 1) * 120, z = (rng() * 2 - 1) * 120;
    if (roadDist(x, z) < 3 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 13) continue;
    if (zoneWeight('ruinas', x, z) > 0.6) continue;
    const y = heightAt(x, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
    if (nf < flowers.count && rng() < 0.18 && zoneWeight('floresta', x, z) < 0.5) {
      s.setScalar(0.8 + rng() * 0.6); m.compose(v.set(x, y, z), q, s); flowers.setMatrixAt(nf, m); flowers.setColorAt(nf, FLOWER[Math.floor(rng() * 4)]); nf++;
    } else if (nt < tufts.count) {
      s.set(1, 0.7 + rng() * 0.8, 1); m.compose(v.set(x, y, z), q, s); tufts.setMatrixAt(nt, m); nt++;
    }
  }
  tufts.count = nt; flowers.count = nf;
  group.add(tufts, flowers);
  return group;
}
