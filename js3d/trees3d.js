/* =========================================================================
   ÁRVORES feitas em código — carvalhos de copa volumosa e pinheiros com
   camadas recortadas. Cada variação é uma geometria única (uma chamada de
   desenho por árvore), com cores por vértice (escuro embaixo, claro em cima).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';

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
  const g = new THREE.CylinderGeometry(r1, r0 * 1.15, h + 0.9, 10, 5); g.translate(0, (h + 0.9) / 2 - 0.9, 0); // continua 90 cm para dentro da terra (não flutua em encostas)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setX(i, p.getX(i) + Math.sin(y * 3 + 1) * 0.08 * y); } // leve curva
  g.computeVertexNormals();
  const a = new THREE.Color(barkA), b = new THREE.Color(barkB);
  return colorize(toNonIndexed(g), (c, x, y, z) => c.copy(a).lerp(b, Math.min(1, y / h) * 0.6 + (Math.sin(x * 20 + z * 13) * 0.5 + 0.5) * 0.25));
}

/* ---------- Carvalho / árvore de folhas ---------- */
export function oakGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const h = 3.4 + rng() * 1.6, R = 2.3 + rng() * 1.1; // carvalhos maiores (proporção com os personagens)
  const parts = [trunkGeo(rng, h + 0.6, 0.4, 0.24, '#5a3d26', '#7a5536')];
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
    const blob = lumpy(mergeVertices(new THREE.IcosahedronGeometry(rr, 3)), rng, 0.13);
    blob.scale(1, 0.82, 1);
    blob.translate(Math.cos(a) * d, cy + (rng() - 0.3) * R * 0.5 - (i === 0 ? 0 : d * 0.15), Math.sin(a) * d);
    parts.push(colorize(toNonIndexed(blob), (c, x, y, z) => {
      const k = Math.min(1, Math.max(0, (y - (cy - R)) / (R * 2))); // escuro embaixo, claro em cima
      c.copy(leafDark).lerp(leafLight, k * 0.85 + (Math.sin(x * 7 + z * 5) * 0.5 + 0.5) * 0.15);
    }));
  }
  const g = mergeGeometries(parts); // mantém as normais suaves de cada parte
  return { geo: g, radius: 0.55, height: cy + R };
}

/* ---------- Pinheiro com camadas recortadas ---------- */
export function pineGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const H = 7.5 + rng() * 4, base = 2.1 + rng() * 0.7;
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

/* ---------- Toco com raízes (enterrado no chão, não flutua em encostas) ---------- */
export function stumpGeometry(seed) {
  const rng = rngOf(seed);
  const h = 0.45 + rng() * 0.45, r = 0.32 + rng() * 0.18;
  const parts = [];
  const g = new THREE.CylinderGeometry(r * 0.92, r * 1.15, h + 0.6, 10, 3); g.translate(0, (h + 0.6) / 2 - 0.6, 0); // 60 cm abaixo do chão
  const p = g.attributes.position; // topo serrado inclinado e irregular
  for (let i = 0; i < p.count; i++) { if (p.getY(i) > h - 0.05) p.setY(i, h + p.getX(i) * 0.12 + (rng() - 0.5) * 0.06); }
  g.computeVertexNormals();
  const barkA = new THREE.Color('#4e3522'), barkB = new THREE.Color('#6d4c33'), wood = new THREE.Color('#c9a674'), ring = new THREE.Color('#a8824f');
  parts.push(colorize(toNonIndexed(g), (c, x, y, z) => {
    if (y > h - 0.12 && Math.hypot(x, z) < r * 0.85) { const d = Math.hypot(x, z) / r; c.copy(wood).lerp(ring, (Math.sin(d * 22) * 0.5 + 0.5) * 0.6); } // anéis da madeira
    else c.copy(barkA).lerp(barkB, (Math.sin(x * 18 + z * 11 + y * 4) * 0.5 + 0.5) * 0.7);
  }));
  // raízes saindo e entrando no chão
  const nr = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < nr; i++) {
    const a = i / nr * Math.PI * 2 + rng() * 0.5, len = 0.5 + rng() * 0.4;
    const root = new THREE.CylinderGeometry(0.04, 0.13, len, 6); root.translate(0, len / 2, 0);
    root.rotateZ(-(1.15 + rng() * 0.25)); root.rotateY(-a); root.translate(Math.cos(a) * r * 0.6, 0.12, Math.sin(a) * r * 0.6);
    parts.push(colorize(toNonIndexed(root), (c, x, y, z) => c.copy(barkA).lerp(barkB, (Math.sin(x * 15 + z * 9) * 0.5 + 0.5) * 0.5)));
  }
  if (rng() < 0.6) { // musgo / cogumelinhos
    const moss = new THREE.SphereGeometry(r * 0.5, 8, 6); moss.scale(1, 0.25, 1); moss.translate((rng() - 0.5) * r, h * (0.3 + rng() * 0.3), r * 0.9);
    parts.push(colorize(toNonIndexed(moss), c => c.set('#5f8f3c')));
  }
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  return { geo, radius: r + 0.1, height: h };
}
/* ---------- Tronco caído (meio enterrado) ---------- */
export function logGeometry(seed) {
  const rng = rngOf(seed);
  const L = 2.2 + rng() * 1.6, r = 0.22 + rng() * 0.12;
  const g = new THREE.CylinderGeometry(r, r * 1.12, L, 10, 6); g.rotateZ(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + Math.sin(x * 1.3) * 0.05); } // levemente torto
  g.computeVertexNormals(); g.translate(0, r * 0.55, 0); // ~45% enterrado
  const barkA = new THREE.Color('#4a3322'), barkB = new THREE.Color('#6a4a32'), wood = new THREE.Color('#bf9a68');
  const parts = [colorize(toNonIndexed(g), (c, x, y, z) => {
    if (Math.abs(x) > L / 2 - 0.02) c.copy(wood).lerp(new THREE.Color('#9a7848'), (Math.sin(Math.hypot(y - r * 0.55, z) * 40) * 0.5 + 0.5) * 0.6);
    else c.copy(barkA).lerp(barkB, (Math.sin(x * 9 + z * 20) * 0.5 + 0.5) * 0.6).lerp(new THREE.Color('#5a8a3a'), y > r * 1.2 ? 0.35 : 0); // musgo em cima
  })];
  const br = new THREE.CylinderGeometry(0.03, 0.07, 0.6, 5); br.translate(0, 0.3, 0); br.rotateZ(-0.6); br.translate(L * 0.15, r * 1.3, 0.05);
  parts.push(colorize(toNonIndexed(br), c => c.copy(barkB)));
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  return { geo, radius: r + 0.2, height: r * 1.6, collider: 'log', length: L };
}

/* ---------- Pedra arredondada e irregular (com musgo em cima) ---------- */
export function rockGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const R = (opts.size || 1) * (0.6 + rng() * 0.7);
  const g = mergeVertices(new THREE.IcosahedronGeometry(R, 4)), p = g.attributes.position, v = new THREE.Vector3(); // vértices unidos = sombreado suave
  const sx = 1 + rng() * 0.6, sy = 0.45 + rng() * 0.35, sz = 0.8 + rng() * 0.5, ph = rng() * 10;
  // ruído suave em várias escalas + achatado embaixo (assenta no chão)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * 2.1 + ph) * Math.cos(v.z * 1.7 + ph) * 0.14 + Math.sin(v.x * 5.3 + v.y * 4.1 + ph * 2) * 0.05 + Math.sin(v.z * 9.1 - v.y * 7.3 + ph) * 0.02;
    v.multiplyScalar(R * (1 + n)); v.x *= sx; v.y *= sy; v.z *= sz;
    if (v.y < -R * sy * 0.35) v.y = -R * sy * 0.35 + (v.y + R * sy * 0.35) * 0.15;
    p.setXYZ(i, v.x, v.y + R * sy * 0.25, v.z);
  }
  g.computeVertexNormals();
  const N = g.attributes.normal;
  const stone = new THREE.Color(opts.dark ? '#6f6d66' : '#8f8b82'), stone2 = new THREE.Color(opts.dark ? '#5a5852' : '#7a766d'), moss = new THREE.Color(opts.dark ? '#4a6a34' : '#6a8f45');
  colorize(g, (c, x, y, z) => {
    c.copy(stone).lerp(stone2, Math.sin(x * 3.1 + z * 2.3 + y * 5) * 0.5 + 0.5);
  });
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i++) { const up = N.getY(i); if (up > 0.55 && opts.moss !== false) { const k = Math.min(1, (up - 0.55) * 2.5) * 0.85; col.setXYZ(i, col.getX(i) + (moss.r - col.getX(i)) * k, col.getY(i) + (moss.g - col.getY(i)) * k, col.getZ(i) + (moss.b - col.getZ(i)) * k); } }
  return { geo: g, radius: R * Math.max(sx, sz) * 0.85, height: R * sy * 1.6 };
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
  for (let i = 0; i < 3; i++) add('stump_' + i, stumpGeometry(900 + i * 13));
  for (let i = 0; i < 6; i++) add('stone_' + i, rockGeometry(1200 + i * 11, { size: i < 3 ? 0.8 : 1.3 }));
  for (let i = 0; i < 4; i++) add('stonedark_' + i, rockGeometry(1300 + i * 17, { size: 1.1, dark: true }));
  for (let i = 0; i < 2; i++) add('log_' + i, logGeometry(950 + i * 7));
  return out;
}
