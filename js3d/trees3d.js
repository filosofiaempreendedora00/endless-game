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
  // S-150: tronco com casca sulcada e base que se alarga em raízes (como árvore de verdade saindo da terra)
  const g = new THREE.CylinderGeometry(r1, r0 * 1.15, h + 0.9, 14, 8); g.translate(0, (h + 0.9) / 2 - 0.9, 0); // continua 90 cm para dentro da terra (não flutua em encostas)
  const p = g.attributes.position, ph = rng() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), yy = Math.max(0, y) / h, ang = Math.atan2(z, x);
    const flare = 1 + Math.max(0, 0.6 - y) * 0.9 * (0.6 + 0.4 * Math.abs(Math.sin(ang * 2.5 + ph))); // raízes na base
    const groove = 1 + Math.sin(ang * 9 + y * 1.5 + ph) * 0.035; // sulcos da casca
    p.setXYZ(i, x * flare * groove + Math.sin(yy * 3 + 1 + ph) * 0.1 * yy, y, z * flare * groove + Math.cos(yy * 2.3 + ph) * 0.06 * yy);
  }
  g.computeVertexNormals();
  const a = new THREE.Color(barkA), b = new THREE.Color(barkB);
  return colorize(toNonIndexed(g), (c, x, y, z) => c.copy(a).lerp(b, Math.min(1, Math.max(0, y) / h) * 0.5 + (Math.sin(Math.atan2(z, x) * 9 + y * 1.5) * 0.5 + 0.5) * 0.35).multiplyScalar(y < 0.3 ? 0.85 : 1));
}
// folhagem: blob com "cachos" de folha (ruído de alta frequência) em vez de bola lisa
function foliageBlob(rng, rr, detail = 4) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(rr, detail)), p = g.attributes.position, v = new THREE.Vector3(), ph = rng() * 20;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const big = Math.sin(n.x * 2.3 + ph) * Math.cos(n.z * 2.1 + ph) * 0.12 + Math.sin(n.y * 3.1 + ph * 1.3) * 0.06;
    const leafy = Math.sin(n.x * 11 + ph) * Math.sin(n.y * 13 + ph * 0.7) * Math.sin(n.z * 12 - ph) * 0.07; // cachos de folhas
    v.multiplyScalar(1 + big + leafy); if (v.y < -rr * 0.45) v.y = -rr * 0.45 + (v.y + rr * 0.45) * 0.4; // fundo achatado
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

/* ---------- Carvalho / árvore de folhas ---------- */
export function oakGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const h = 3.4 + rng() * 1.6, R = 2.3 + rng() * 1.1; // carvalhos maiores (proporção com os personagens)
  const parts = [trunkGeo(rng, h + 0.6, 0.42, 0.22, '#4f3523', '#7a5638')];
  // galhos principais que sobem até dentro da copa (cada um sustenta um cacho de folhas)
  const n = 6 + Math.floor(rng() * 4), cy = h + R * 0.55, tips = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rng() * 0.6, d = i === 0 ? 0 : R * (0.4 + rng() * 0.45), y = cy + (rng() - 0.3) * R * 0.5 - (i === 0 ? 0 : d * 0.15);
    tips.push([a, d, y]);
    if (i === 0) continue;
    const from = new THREE.Vector3(0, h * (0.62 + rng() * 0.15), 0), to = new THREE.Vector3(Math.cos(a) * d * 0.8, y - R * 0.25, Math.sin(a) * d * 0.8);
    const len = from.distanceTo(to);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); const br2 = new THREE.CylinderGeometry(0.05, 0.13, len, 7, 3); br2.translate(0, len / 2, 0); br2.applyQuaternion(q); br2.translate(from.x, from.y, from.z);
    parts.push(colorize(toNonIndexed(br2), (c, x, y2, z) => c.set('#5a3e28').offsetHSL(0, 0, (Math.sin(x * 9 + z * 7) * 0.5) * 0.05)));
  }
  // copa: cachos de folhas, cada um com um tom levemente diferente (luz do sol por cima, sombra por dentro)
  const leafDark = new THREE.Color(opts.dark ? '#1f4524' : '#2f6329'), leafLight = new THREE.Color(opts.dark ? '#4c853b' : '#86c25a');
  tips.forEach(([a, d, y], i) => {
    const rr = R * (i === 0 ? 0.82 : 0.48 + rng() * 0.32);
    const blob = foliageBlob(rng, rr, 4); blob.scale(1, 0.8, 1);
    blob.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    const hue = (rng() - 0.5) * 0.03, lum = (rng() - 0.5) * 0.06;
    parts.push(colorize(toNonIndexed(blob), (c, x, y2, z) => {
      const k = Math.min(1, Math.max(0, (y2 - (cy - R)) / (R * 2))); // escuro embaixo, claro em cima
      const inner = Math.min(1, Math.hypot(x, z) / (R * 1.2)); // miolo da copa mais escuro
      c.copy(leafDark).lerp(leafLight, k * 0.75 * (0.6 + inner * 0.4) + (Math.sin(x * 9 + z * 7 + y2 * 5) * 0.5 + 0.5) * 0.18).offsetHSL(hue, 0, lum);
    }));
  });
  const g = mergeGeometries(parts); // mantém as normais suaves de cada parte
  return { geo: g, radius: 0.55, height: cy + R };
}

/* ---------- Pinheiro com camadas de galhos caídos (e versão com neve, S-158) ---------- */
export function pineGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const H = 7.5 + rng() * 4, base = 2.1 + rng() * 0.7;
  const parts = [trunkGeo(rng, H * 0.4, 0.27, 0.12, '#47301f', '#6a4630')];
  const dark = new THREE.Color(opts.dark ? '#14321d' : '#1d4628'), light = new THREE.Color(opts.dark ? '#2c6339' : '#467f45');
  const snowA = new THREE.Color('#f4f8fb'), snowB = new THREE.Color('#d6e3ee');
  const layers = 7 + Math.floor(rng() * 3), ph = rng() * 10;
  for (let i = 0; i < layers; i++) {
    const k = i / layers, r = base * (1 - k * 0.82) * (0.92 + rng() * 0.16), y0 = H * 0.2 + k * H * 0.72, hh = H * 0.26 * (1 - k * 0.3);
    const cone = new THREE.ConeGeometry(r, hh, opts.snow ? 30 : 22, opts.snow ? 7 : 5, false);
    const p = cone.attributes.position, nr = 7 + Math.floor(rng() * 4), off = rng() * 6;
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j), t = (y + hh / 2) / hh, ang = Math.atan2(z, x), rad = Math.hypot(x, z);
      if (rad < 1e-4) continue;
      // galhos: o contorno tem "dedos" (pontas de galho) que caem nas extremidades — ruído suave, não serrilhado
      const fingers = Math.pow(Math.max(0, Math.sin(ang * nr + off)), 0.6) * 0.16 + Math.sin(ang * nr * 2.3 + off * 2) * 0.04;
      const ext = 1 + fingers * (1 - t), droop = (1 - t) * (1 - t) * (0.22 + fingers * 0.9);
      p.setXYZ(j, x * ext, y - droop * hh * 0.55, z * ext);
    }
    cone.rotateY(rng() * Math.PI); cone.translate(0, y0 + hh / 2, 0);
    const g2 = mergeVertices(cone.deleteAttribute('normal').deleteAttribute('uv')); g2.computeVertexNormals(); // vértices unidos = sombreado liso (nada de facetas)
    const N = g2.attributes.normal;
    colorize(g2, (c, x, y, z) => {
      const local = (y - y0) / hh;
      c.copy(dark).lerp(light, Math.max(0, Math.min(1, local * 0.8 + (Math.sin(x * 9 + z * 7 + i) * 0.5 + 0.5) * 0.22)));
    });
    if (opts.snow) { // S-158: neve assentada em cima de cada camada (parte de cima e de dentro); as pontas dos galhos que caem e o lado de baixo continuam verdes
      const col = g2.attributes.color, P = g2.attributes.position, sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      for (let j = 0; j < P.count; j++) {
        const x = P.getX(j), y = P.getY(j), z = P.getZ(j), up = N.getY(j), local = (y - y0) / hh;
        const patch = Math.sin(x * 3.1 + ph) * Math.cos(z * 2.9 + ph) * 0.5 + Math.sin(x * 7.3 - z * 6.1 + i) * 0.3 + 0.5;
        const cover = sm(0.18, 0.42, up) * sm(0.04, 0.3, local) * (0.45 + 0.55 * sm(0.2, 0.45, patch));
        if (cover <= 0) continue;
        const sc = snowA.clone().lerp(snowB, (1 - up) * 0.8 + (1 - patch) * 0.1);
        col.setXYZ(j, col.getX(j) + (sc.r - col.getX(j)) * cover, col.getY(j) + (sc.g - col.getY(j)) * cover, col.getZ(j) + (sc.b - col.getZ(j)) * cover);
        P.setY(j, y + cover * 0.08); // a neve tem volume (montinho fofo)
      }
      g2.computeVertexNormals();
    }
    parts.push(toNonIndexed(g2));
  }
  // ponta fina no topo
  const tip = new THREE.ConeGeometry(0.12, H * 0.12, 8); tip.translate(0, H * 0.95, 0);
  parts.push(colorize(toNonIndexed(tip), (c, x, y) => c.copy(opts.snow && y > H * 0.97 ? snowA : light)));
  const g = mergeGeometries(parts.map(q => { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; }));
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
  for (let i = 0; i < 4; i++) add('pinesnow_' + i, pineGeometry(800 + i * 37, { dark: i % 2 === 0, snow: true })); // S-158: pinheiros com neve (Vale da Geada)
  for (let i = 0; i < 3; i++) add('stump_' + i, stumpGeometry(900 + i * 13));
  for (let i = 0; i < 6; i++) add('stone_' + i, rockGeometry(1200 + i * 11, { size: i < 3 ? 0.8 : 1.3 }));
  for (let i = 0; i < 4; i++) add('stonedark_' + i, rockGeometry(1300 + i * 17, { size: 1.1, dark: true }));
  for (let i = 0; i < 2; i++) add('log_' + i, logGeometry(950 + i * 7));
  return out;
}
