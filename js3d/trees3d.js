/* =========================================================================
   ÁRVORES feitas em código — carvalhos de copa volumosa e pinheiros com
   camadas recortadas. Cada variação é uma geometria única (uma chamada de
   desenho por árvore), com cores por vértice (escuro embaixo, claro em cima).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

function rngOf(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function colorize(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(tmp, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// deforma a malha com "ondulações" para não parecer uma bola perfeita
function lumpy(geo, rng, amt) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  const f1 = 2 + rng() * 2, f2 = 3 + rng() * 3, ph = rng() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * f1 + ph) * Math.cos(v.z * f2 + ph) + Math.sin(v.y * f2 * 0.7 + ph * 2) * 0.5;
    v.multiplyScalar(1 + n * amt + (rng() - 0.5) * amt * 0.6);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
const toNonIndexed = g => (g.index ? g.toNonIndexed() : g);
function trunkGeo(rng, h, r0, r1, barkA, barkB) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 8, 4); g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setX(i, p.getX(i) + Math.sin(y * 3 + 1) * 0.08 * y); } // leve curva
  g.computeVertexNormals();
  const a = new THREE.Color(barkA), b = new THREE.Color(barkB);
  return colorize(toNonIndexed(g), (c, x, y, z) => c.copy(a).lerp(b, Math.min(1, y / h) * 0.6 + (Math.sin(x * 20 + z * 13) * 0.5 + 0.5) * 0.25));
}

/* ---------- Carvalho / árvore de folhas ---------- */
export function oakGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const h = 2.6 + rng() * 1.2, R = 1.9 + rng() * 0.9;
  const parts = [trunkGeo(rng, h + 0.6, 0.32, 0.2, '#5a3d26', '#7a5536')];
  // galhos
  for (let i = 0; i < 3; i++) {
    const br = new THREE.CylinderGeometry(0.06, 0.12, 1.3, 6); br.translate(0, 0.65, 0);
    br.rotateZ(0.8 + rng() * 0.3); br.rotateY(i * 2.1 + rng()); br.translate(0, h * (0.65 + rng() * 0.2), 0);
    parts.push(colorize(toNonIndexed(br), c => c.set('#5f4229')));
  }
  // copa: várias "nuvens" de folhas deformadas
  const leafDark = new THREE.Color(opts.dark ? '#24502a' : '#356e2c'), leafLight = new THREE.Color(opts.dark ? '#4f8a3e' : '#8cc860');
  const n = 6 + Math.floor(rng() * 4), cy = h + R * 0.55;
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = i === 0 ? 0 : R * (0.35 + rng() * 0.45), rr = R * (i === 0 ? 0.85 : 0.5 + rng() * 0.35);
    const blob = lumpy(new THREE.IcosahedronGeometry(rr, 2), rng, 0.13);
    blob.scale(1, 0.82, 1);
    blob.translate(Math.cos(a) * d, cy + (rng() - 0.3) * R * 0.5 - (i === 0 ? 0 : d * 0.15), Math.sin(a) * d);
    parts.push(colorize(toNonIndexed(blob), (c, x, y, z) => {
      const k = Math.min(1, Math.max(0, (y - (cy - R)) / (R * 2))); // escuro embaixo, claro em cima
      c.copy(leafDark).lerp(leafLight, k * 0.85 + (Math.sin(x * 7 + z * 5) * 0.5 + 0.5) * 0.15);
    }));
  }
  const g = mergeGeometries(parts); g.computeVertexNormals();
  return { geo: g, radius: 0.55, height: cy + R };
}

/* ---------- Pinheiro com camadas recortadas ---------- */
export function pineGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const H = 6 + rng() * 3, base = 1.8 + rng() * 0.6;
  const parts = [trunkGeo(rng, H * 0.35, 0.26, 0.16, '#4a3020', '#6a4630')];
  const dark = new THREE.Color(opts.dark ? '#16361f' : '#1f4a2a'), light = new THREE.Color(opts.dark ? '#2f6a3c' : '#4a8a4a');
  const layers = 5 + Math.floor(rng() * 2);
  for (let i = 0; i < layers; i++) {
    const k = i / layers, r = base * (1 - k * 0.78), y0 = H * 0.22 + k * H * 0.68, hh = H * 0.32 * (1 - k * 0.35);
    const cone = new THREE.ConeGeometry(r, hh, 12, 2, true);
    const p = cone.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
      if (y < -hh / 2 + 0.01) { // borda de baixo: recortada e caída (galhos pesados)
        const ang = Math.atan2(z, x), jag = 1 + (Math.sin(ang * 12 + i) > 0 ? 0.12 : -0.08) + (rng() - 0.5) * 0.1;
        p.setXYZ(j, x * jag, y - 0.18 - rng() * 0.15, z * jag);
      }
    }
    cone.computeVertexNormals();
    cone.rotateY(rng() * Math.PI); cone.translate(0, y0 + hh / 2, 0);
    parts.push(colorize(toNonIndexed(cone), (c, x, y, z) => {
      const local = (y - y0) / hh; // ponta de cada camada mais clara
      c.copy(dark).lerp(light, Math.max(0, Math.min(1, local * 0.9 + (Math.sin(x * 9 + z * 7) * 0.5 + 0.5) * 0.2)));
    }));
  }
  const g = mergeGeometries(parts); g.computeVertexNormals();
  return { geo: g, radius: 0.45, height: H };
}

// gera variações prontas para clonar: { nome: { scene, radius } }
export function makeTreeTemplates() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: false });
  const out = {};
  const add = (name, { geo, radius, height }) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    const scene = new THREE.Group(); scene.add(m);
    out[name] = { scene, radius, height };
  };
  for (let i = 0; i < 5; i++) add('oak_' + i, oakGeometry(100 + i * 17));
  for (let i = 0; i < 3; i++) add('oakdark_' + i, oakGeometry(300 + i * 23, { dark: true }));
  for (let i = 0; i < 5; i++) add('pine_' + i, pineGeometry(500 + i * 31));
  for (let i = 0; i < 4; i++) add('pinedark_' + i, pineGeometry(700 + i * 29, { dark: true }));
  return out;
}
