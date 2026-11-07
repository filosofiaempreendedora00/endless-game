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
  const wr = zoneWeight('ruinas', x, z);
  if (wr > 0.3) { // lajes de pedra antigas no chão das ruínas
    const cell = (Math.floor(x / 3) + Math.floor(z / 3)) & 1, crack = vnoise(x * 0.7, z * 0.7);
    const slab = new THREE.Color(cell ? '#8d8a80' : '#7f7c73').offsetHSL(0, 0, (crack - 0.5) * 0.08);
    c.lerp(slab, smooth(0.3, 0.8, wr) * (vnoise(x * 0.08, z * 0.08) > 0.35 ? 0.85 : 0.3));
  }
  if (h > 6) c.lerp(new THREE.Color('#8a8c86'), smooth(6, 14, h)); // rocha
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
export function buildTerrain() {
  const SEG = 220;
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
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: detailTexture() });
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

// grama de verdade: tufos de lâminas curvas que balançam com o vento + flores + pedregulhos
const windUniform = { value: 0 };
export function updateNature(time) { windUniform.value = time; }
function tuftGeometry(rng) {
  const pos = [], col = [], idx = [];
  const base = new THREE.Color('#5a9a3c'), tip = new THREE.Color('#cdee90');
  const blades = 5;
  for (let b = 0; b < blades; b++) {
    const ang = b / blades * Math.PI * 2 + rng() * 0.6, lean = 0.12 + rng() * 0.2, h = 0.3 + rng() * 0.3, w = 0.045 + rng() * 0.025;
    const dx = Math.cos(ang), dz = Math.sin(ang), ox = dx * 0.09, oz = dz * 0.09;
    const seg = 3, start = pos.length / 3;
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
export function buildGrass(rng) {
  const group = new THREE.Group();
  const tufts = new THREE.InstancedMesh(tuftGeometry(rng), windMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), 22000);
  const flowers = new THREE.InstancedMesh(flowerGeometry(), windMaterial({ vertexColors: true, roughness: 0.7 }), 1400);
  const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: '#8a877e', roughness: 1, flatShading: true }), 700);
  tufts.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const PETAL = ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff', '#ff9a4a', '#7ad0ff'].map(c => new THREE.Color(c));
  const tint = new THREE.Color();
  let nt = 0, nf = 0, nr = 0;
  for (let tries = 0; tries < 140000 && (nt < tufts.count || nf < flowers.count || nr < rubble.count); tries++) {
    const x = (rng() * 2 - 1) * 122, z = (rng() * 2 - 1) * 122;
    const rd = roadDist(x, z);
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1.5 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 12) continue;
    const y = heightAt(x, z);
    if (y > 7) continue;
    const ruins = zoneWeight('ruinas', x, z), forest = zoneWeight('floresta', x, z);
    q.setFromAxisAngle(up, rng() * 6.28);
    if (ruins > 0.55) { // ruínas: pedregulhos e pouca grama seca
      if (nr < rubble.count && rng() < 0.5) { s.set(0.6 + rng() * 1.4, 0.4 + rng() * 0.6, 0.6 + rng() * 1.4); m.compose(v.set(x, y + 0.03, z), q, s); rubble.setMatrixAt(nr++, m); continue; }
      if (rng() < 0.75) continue;
    }
    if (rd < 2.2) continue; // estradas limpas
    if (nf < flowers.count && rng() < 0.09 && forest < 0.5 && ruins < 0.3) {
      s.setScalar(0.8 + rng() * 0.7); m.compose(v.set(x, y, z), q, s); flowers.setMatrixAt(nf, m); flowers.setColorAt(nf, PETAL[Math.floor(rng() * PETAL.length)]); nf++;
    } else if (nt < tufts.count) {
      const k = 1.0 + rng() * 0.9; s.set(k, k * (0.75 + rng() * 0.5), k); m.compose(v.set(x, y - 0.02, z), q, s); tufts.setMatrixAt(nt, m);
      // tom da grama acompanha a região (bosque mais escuro, ruínas mais seco)
      tint.setRGB(1, 1, 1).lerp(new THREE.Color('#7fa07a'), forest * 0.6).lerp(new THREE.Color('#c8b98a'), ruins * 0.8).multiplyScalar(0.85 + rng() * 0.3);
      tufts.setColorAt(nt, tint); nt++;
    }
  }
  tufts.count = nt; flowers.count = nf; rubble.count = nr;
  rubble.castShadow = true; rubble.receiveShadow = true;
  group.add(tufts, flowers, rubble);
  return group;
}
