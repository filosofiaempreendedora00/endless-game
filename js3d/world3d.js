/* =========================================================================
   MUNDO 3D — terreno contínuo (mundo aberto), regiões, estradas e cenário.
   1 unidade = 1 metro. Norte = -Z, Leste = +X.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

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

/* ---------- montanhas na borda do mundo (fazem parte do terreno) ---------- */
const edgeDist = (x, z) => Math.pow(Math.pow(Math.abs(x), 6) + Math.pow(Math.abs(z), 6), 1 / 6); // quadrado de cantos arredondados
const ridged = (x, z) => 1 - Math.abs(vnoise(x, z) * 2 - 1);
export function mountainMask(x, z) { return smooth(104, 146, edgeDist(x, z) + (vnoise(x * 0.03, z * 0.03) - 0.5) * 18); }
export function mountainH(x, z) {
  const m = mountainMask(x, z); if (m <= 0) return 0;
  const r = ridged(x * 0.022, z * 0.022) * 0.5 + ridged(x * 0.05 + 7, z * 0.05) * 0.28 + ridged(x * 0.13, z * 0.13 + 4) * 0.14 + vnoise(x * 0.3, z * 0.3) * 0.08; // cristas, picos e rochas
  const big = 0.45 + vnoise(x * 0.011 + 3, z * 0.011) * 0.9; // picos altos e vales mais baixos ao longo da cordilheira
  return Math.pow(m, 1.7) * (12 + r * 58) * big;
}

/* ---------- altura do terreno ---------- */
/* ---------- lago com margem irregular (não é um círculo perfeito) ---------- */
export function lakeShape(x, z) { const a = Math.atan2(z - LAKE.z, x - LAKE.x); return 1 + 0.16 * Math.sin(3 * a + 1.1) + 0.09 * Math.sin(5 * a + 2.4) + 0.05 * Math.sin(8 * a + 0.3); }
// distância até o centro "corrigida" pela forma da margem: comparar com LAKE.r
export function lakeDist(x, z) { return Math.hypot(x - LAKE.x, z - LAKE.z) / lakeShape(x, z); }
export function heightAt(x, z) {
  let h = (fbm(x * 0.032, z * 0.032) - 0.45) * 8;
  h *= smooth(16, 34, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)); // vila plana
  h *= 0.3 + 0.7 * smooth(2.5, 8, roadDist(x, z)); // estradas suaves
  const dl = lakeDist(x, z);
  if (dl < LAKE.r + 6) { const k = smooth(LAKE.r + 6, LAKE.r - 4, dl); h = h * (1 - k) + (LAKE.level - 1.3 - 1.5 * smooth(LAKE.r - 3, LAKE.r * 0.25, dl) + (vnoise(x * 0.4, z * 0.4) - 0.5) * 0.4) * k; } // fundo mais fundo no meio
  h += mountainH(x, z); // montanhas na borda
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
  const dl = lakeDist(x, z);
  if (dl < LAKE.r + 2.5) c.lerp(new THREE.Color('#c9b98a'), smooth(LAKE.r + 2.5, LAKE.r, dl) * (0.75 + vnoise(x * 0.5, z * 0.5) * 0.25)); // areia
  if (dl < LAKE.r - 0.5) c.lerp(new THREE.Color('#6d6a4a'), smooth(LAKE.r - 0.5, LAKE.r - 4, dl) * 0.7); // lodo no fundo
  const mm = mountainMask(x, z);
  if (mm > 0.02) { // encostas: grama → rocha → neve, conforme altura e inclinação
    const dx = heightAt(x + 1, z) - heightAt(x - 1, z), dz = heightAt(x, z + 1) - heightAt(x, z - 1), slope = Math.hypot(dx, dz) / 2;
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

// cordilheira distante no horizonte (silhueta azulada com neve, como no fundo de um vale)
export function buildDistantMountains() {
  const SEGA = 240, ROWS = 7, R0 = 175, R1 = 330, pos = [], col = [], idx = [];
  const rockC = new THREE.Color('#56606e'), farC = new THREE.Color('#8ea3ba'), snowC = new THREE.Color('#e6edf4');
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= SEGA; i++) {
    const a = i / SEGA * Math.PI * 2, k = j / ROWS, r = R0 + (R1 - R0) * k;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const peak = ridged(a * 3.1, k * 2 + 3) * 0.6 + ridged(a * 7.3 + 2, k * 3) * 0.3 + vnoise(a * 17, k * 4) * 0.1;
    const h = (j === 0 || j === ROWS ? 0 : 1) * (40 + peak * 95) * Math.sin(k * Math.PI) - 4;
    pos.push(x, h, z);
    const c = rockC.clone().lerp(farC, 0.35 + k * 0.4);
    if (h > 92 + vnoise(a * 9, k) * 22) c.lerp(snowC, 0.8);
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
// esconde os blocos de grama longe da câmera (a mais de ~95 m os tufos nem aparecem)
export function cullGrass(x, z) { for (const g of grassChunks) g.visible = Math.hypot(g.userData.cx - x, g.userData.cz - z) < 95 + 36; }
export function buildGrass(rng) {
  const group = new THREE.Group();
  const grassMat = windMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  // grama dividida em blocos de 50 m: o que está longe (tufos minúsculos) não é desenhado
  const CH = 50, NC = 6, tuftGeos = [0, 1, 2].map(v => tuftGeometry(rng, v));
  const buckets = Array.from({ length: NC * NC * 3 }, () => []);
  const tufts = { count: 33000 };
  const flowers = new THREE.InstancedMesh(flowerGeometry(), windMaterial({ vertexColors: true, roughness: 0.7 }), 1400);
  const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: '#8a877e', roughness: 1, flatShading: true }), 700);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const PETAL = ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff', '#ff9a4a', '#7ad0ff'].map(c => new THREE.Color(c));
  const tint = new THREE.Color();
  let nt = 0, nf = 0, nr = 0;
  for (let tries = 0; tries < 220000 && (nt < tufts.count || nf < flowers.count || nr < rubble.count); tries++) {
    const x = (rng() * 2 - 1) * 122, z = (rng() * 2 - 1) * 122;
    const rd = roadDist(x, z);
    if (lakeDist(x, z) < LAKE.r + 1.5 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 12) continue;
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
      s.setScalar(0.5 + rng() * 0.45); m.compose(v.set(x, y, z), q, s); flowers.setMatrixAt(nf, m); flowers.setColorAt(nf, PETAL[Math.floor(rng() * PETAL.length)]); nf++;
    } else if (nt < tufts.count) {
      const vi = Math.floor(rng() * 3), cx = Math.min(NC - 1, Math.floor((x + 150) / CH)), cz = Math.min(NC - 1, Math.floor((z + 150) / CH));
      const k = 0.8 + rng() * 0.6; s.set(k, k * (0.7 + rng() * 0.6), k); m.compose(v.set(x, y - 0.01, z), q, s);
      // tom da grama acompanha a região (bosque mais escuro, ruínas mais seco)
      tint.setRGB(1, 1, 1).lerp(new THREE.Color('#7fa07a'), forest * 0.6).lerp(new THREE.Color('#c8b98a'), ruins * 0.8).multiplyScalar(0.85 + rng() * 0.3);
      buckets[(cz * NC + cx) * 3 + vi].push(m.clone(), tint.clone()); nt++;
    }
  }
  grassChunks.length = 0;
  buckets.forEach((b, i) => {
    const n = b.length / 2; if (!n) return;
    const mesh = new THREE.InstancedMesh(tuftGeos[i % 3], grassMat, n); mesh.receiveShadow = true;
    for (let j = 0; j < n; j++) { mesh.setMatrixAt(j, b[j * 2]); mesh.setColorAt(j, b[j * 2 + 1]); }
    mesh.computeBoundingSphere(); // permite o descarte do que está fora da tela
    const c = Math.floor(i / 3); mesh.userData.cx = -150 + (c % NC + 0.5) * CH; mesh.userData.cz = -150 + (Math.floor(c / NC) + 0.5) * CH;
    grassChunks.push(mesh); group.add(mesh);
  });
  flowers.count = nf; rubble.count = nr;
  rubble.castShadow = true; rubble.receiveShadow = true;
  group.add(flowers, rubble);
  return group;
}
