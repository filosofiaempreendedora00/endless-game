/* =========================================================================
   MARCOS DO MUNDO NOVO (S-076) — tudo feito em código, com formas orgânicas:
   colossos de pedra gastos pelo tempo (Planície dos Colossos), cabeça caída,
   monólitos, arcos, o Santuário Silente, cactos das dunas e fogueira de acampamento.
   Pedra com cor por vértice: musgo nas faces viradas para cima, rachaduras escuras.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';
const vlightAt = (c, i, d, x, y, z) => { const L = vlight(c, i, d); L.position.set(x, y, z); return L; }; // luz virtual já posicionada

const rngOf = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
/* S-161/S-162: pedra de verdade em tudo que é esculpido (colossos, ruínas, santuário, monólitos).
   No shader, a partir da posição no mundo: relevo de erosão em 3 escalas (lascas, picotado do cinzel,
   granulado), rachaduras finas, escorridos de chuva, sujeira nas reentrâncias e manchas de líquen.
   Não custa geometria nenhuma — só alguns cálculos por pixel. */
const STONE_GLSL = `
  varying vec3 vSWP; varying vec3 vSWN;
  float sH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float sN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sH(i), sH(i + vec3(1,0,0)), f.x), mix(sH(i + vec3(0,1,0)), sH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(sH(i + vec3(0,0,1)), sH(i + vec3(1,0,1)), f.x), mix(sH(i + vec3(0,1,1)), sH(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float sF(vec3 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * sN(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  float stoneH(vec3 p, out float crack, out float cav){
    float big = sF(p * 0.35), mid = sF(p * 1.6 + 3.0), fine = sN(p * 9.0) * 0.5 + sN(p * 23.0) * 0.25;
    float c = abs(sN(p * vec3(0.55, 0.8, 0.55) + 9.0) * 2.0 - 1.0); crack = 1.0 - smoothstep(0.0, 0.045, c) * 1.0; crack *= smoothstep(0.45, 0.6, sN(p * 0.2 + 2.0));
    cav = smoothstep(0.62, 0.25, big * 0.6 + mid * 0.4);
    return big * 1.2 + mid * 0.55 + fine * 0.12 - crack * 0.45;
  }`;
stoneMat.onBeforeCompile = sh => {
  sh.vertexShader = 'varying vec3 vSWP; varying vec3 vSWN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
    vSWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSWN = normalize(mat3(modelMatrix) * objectNormal);`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + STONE_GLSL + '\n')
    .replace('#include <color_fragment>', `#include <color_fragment>
      { float crk, cav; float hh = stoneH(vSWP, crk, cav); float g = sN(vSWP * 3.1) * 0.5 + sN(vSWP * 11.0) * 0.5;
        vec3 col = diffuseColor.rgb * (0.86 + g * 0.26);
        col *= 1.0 - cav * 0.32;                                             // sujeira nas reentrâncias
        col = mix(col, col * 0.42, crk * 0.85);                               // rachaduras escuras
        float streak = sN(vec3(vSWP.x * 2.2, vSWP.y * 0.12, vSWP.z * 2.2)) * (1.0 - abs(vSWN.y)); col *= 1.0 - smoothstep(0.55, 0.85, streak) * 0.22; // escorridos de chuva
        float lich = smoothstep(0.78, 0.84, sN(vSWP * 1.9 + 41.0)) * smoothstep(0.3, 0.7, sN(vSWP * 0.3));
        col = mix(col, mix(vec3(0.78, 0.74, 0.52), vec3(0.62, 0.66, 0.38), sN(vSWP * 7.0)), lich * 0.55); // líquen
        diffuseColor.rgb = col; }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float crk, cav; float hh = stoneH(vSWP, crk, cav) * 0.16;
        vec3 sp = -vViewPosition, dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(hh), hy = dFdy(hh);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        vec3 gr = sign(det) * (hx * r1 + hy * r2); normal = normalize(abs(det) * normal - gr); }`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor - sN(vSWP * 4.0) * 0.12, 0.6, 1.0);`);
};
stoneMat.customProgramCacheKey = () => 'aethra-stone';

// pedra irregular: icosaedro subdividido, deformado por ruído (erosão), com cor de pedra e musgo
function rock(rng, rx, ry, rz, amt = 0.12) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3)), P = g.attributes.position, ph = rng() * 10;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const n = Math.sin(x * 3.1 + ph) * Math.cos(z * 2.7 + ph) * 0.6 + Math.sin(y * 4.3 + ph * 2) * 0.4 + Math.sin((x + y) * 9 + ph) * 0.15;
    const k = 1 + n * amt; P.setXYZ(i, x * rx * k, y * ry * k, z * rz * k);
  }
  g.computeVertexNormals(); return g;
}
// lasca de rocha talhada: faces planas cortadas (como rocha de encosta), quinas gastas
function chunk(rng, rx, ry, rz, cuts = 11) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3)), P = g.attributes.position, ph = rng() * 10, planes = [];
  for (let k = 0; k < cuts; k++) { const a = rng() * Math.PI * 2, y = k < 2 ? (k ? 1 : -1) * (0.7 + rng() * 0.3) : (rng() - 0.5) * 0.6; const n = V3(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)).normalize(); planes.push([n, 0.42 + rng() * 0.28]); }
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    for (const [n, d] of planes) { const t = v.dot(n); if (t > d) v.addScaledVector(n, -(t - d) * 0.92); }
    const w = 1 + (Math.sin(v.x * 5 + ph) * Math.cos(v.y * 7 + ph) * Math.sin(v.z * 6)) * 0.03 + Math.sin(v.y * 22 + ph) * 0.008; // estratos
    P.setXYZ(i, v.x * rx * w, v.y * ry * w, v.z * rz * w);
  }
  g.computeVertexNormals(); return g;
}
// coluna gasta: cilindro com caneluras e borda irregular
function column(rng, r, h, broken = 0) {
  const g = new THREE.CylinderGeometry(r * 0.92, r, h, 18, 8), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), fl = 1 - Math.abs(Math.sin(a * 8)) * 0.05, wob = 1 + (Math.sin(y * 3 + a * 2) * 0.03);
    let yy = y; if (broken && y > h / 2 - 0.01) yy = y - (Math.sin(a * 3 + rng() * 6) * 0.5 + 0.5) * broken;
    P.setXYZ(i, x * fl * wob, yy, z * fl * wob);
  }
  g.translate(0, h / 2, 0); g.computeVertexNormals(); return g;
}
// pinta: pedra clara/escura conforme ruído + musgo nas faces de cima
function paint(g, base = '#9a958a', moss = '#5f7a3c', mossAmt = 0.6, seed = 1) {
  const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), c = new THREE.Color(), b = new THREE.Color(base), m = new THREE.Color(moss), dark = new THREE.Color('#5c5850');
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = N.getY(i);
    const n = Math.sin(x * 0.7 + seed) * Math.cos(z * 0.9) * 0.5 + 0.5, crack = Math.sin(x * 2.3 + y * 1.7 + z * 2.9 + seed) > 0.93 ? 1 : 0;
    c.copy(b).offsetHSL(0, 0, (n - 0.5) * 0.12).lerp(dark, crack * 0.6 + Math.max(0, -ny) * 0.25);
    if (ny > 0.35) c.lerp(m, Math.min(1, (ny - 0.35) * 1.8) * mossAmt * (0.6 + n * 0.6));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const strip = g => { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k); return x; };
const put = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
const mesh = (parts, mat = stoneMat) => { const m = new THREE.Mesh(mergeGeometries(parts.map(strip)), mat); m.castShadow = true; m.receiveShadow = true; return m; };

/* ---------- Colosso ajoelhado (≈ 20 m): o gigante de pedra que dorme na planície ---------- */
export function makeColossus(seed = 3) {
  const rng = rngOf(seed), S = [];
  const R = (rx, ry, rz, x, y, z, a = [0, 0, 0], amt = 0.1) => S.push(paint(put(rock(rng, rx, ry, rz, amt), x, y, z, ...a), '#9d978b', '#5d7a3a', 0.7, seed));
  R(4.2, 2.8, 3.2, 0, 3.2, -1.5, [0.1, 0, 0]);            // quadril
  R(1.9, 5.2, 1.9, -2.4, 2.8, 2.8, [1.25, 0, 0.05]);      // coxa direita (ajoelhado)
  R(1.6, 3.6, 1.6, -2.5, 1.4, 6.2, [0.15, 0, 0]);         // canela (no chão)
  R(1.9, 4.8, 1.9, 2.6, 2.6, -3.6, [0.2, 0, -0.05]);      // perna esquerda dobrada atrás
  R(4.6, 6.2, 3.4, 0, 9.4, -0.2, [-0.18, 0, 0]);          // tronco curvado para a frente
  R(3.4, 1.6, 2.6, 0, 13.6, 0.9, [-0.25, 0, 0]);          // ombros
  R(1.7, 1.3, 1.6, 0, 15.2, 2.2, [-0.3, 0, 0], 0.06);     // pescoço
  R(2.3, 2.7, 2.4, 0, 17.4, 3.4, [-0.45, 0, 0], 0.07);    // cabeça baixa (olhando o chão)
  R(1.5, 4.8, 1.5, -4.6, 10.4, 2.0, [0.5, 0, 0.35]);      // braço direito apoiado no joelho
  R(1.3, 3.8, 1.3, -3.6, 5.8, 5.2, [-0.3, 0, 0.2]);       // antebraço
  R(1.4, 2.8, 1.4, 4.8, 12.0, 0.2, [0, 0, -0.6]);         // braço esquerdo quebrado (toco)
  // armadura de pedra esculpida: placas do peito, ombreiras, cinto, crista do elmo e dedos
  for (const sx of [-1, 1]) { R(2.2, 2.6, 1.0, sx * 2.1, 10.6, 2.9, [-0.25, sx * 0.25, sx * 0.1], 0.06); R(1.9, 1.3, 1.9, sx * 3.6, 13.6, 0.6, [0, 0, sx * -0.5], 0.08); }
  R(4.4, 0.8, 3.4, 0, 6.2, -0.4, [0.05, 0, 0], 0.05); for (let k = 0; k < 5; k++) R(0.45, 0.9, 0.3, -2.4 + k * 1.2, 5.5, 2.9, [0.2, 0, 0], 0.08); // cinto com placas
  R(0.5, 1.6, 2.4, 0, 19.6, 2.6, [-0.45, 0, 0], 0.08); // crista do elmo
  for (let k = 0; k < 4; k++) R(0.38, 0.9, 0.38, -3.9 + k * 0.5, 3.6, 7.0 + (k % 2) * 0.2, [0.4, 0, 0], 0.06); // dedos sobre o joelho
  for (let k = 0; k < 7; k++) R(0.6 + rng() * 0.9, 0.4 + rng() * 0.6, 0.6 + rng() * 0.9, 6 + rng() * 6, 0.3, -4 + rng() * 9, [rng(), rng(), rng()], 0.2); // pedaços do braço no chão
  const body = mesh(S);
  // rosto: duas fendas de olhos que brilham fraquinho (algo ainda vive ali dentro)
  const g = new THREE.Group(); g.add(body);
  const eyeM = new THREE.MeshStandardMaterial({ color: '#cfe8ff', emissive: '#7fc4ff', emissiveIntensity: 1.6 });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10), eyeM); e.scale.set(1.3, 0.35, 0.5); e.position.set(sx * 0.95, 17.6, 5.55); e.rotation.x = -0.45; g.add(e); }
  // espada gigante cravada ao lado
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 0.35, 1, 6, 1), new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: 0.6, metalness: 0.4 }));
  { const P = blade.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > 5.9) P.setX(i, P.getX(i) * 0.15); if (P.getY(i) < -5.9) P.setX(i, P.getX(i) * 1.05); } blade.geometry.computeVertexNormals(); }
  blade.position.set(7.5, 5, -2); blade.rotation.set(0.08, 0.4, 0.14); blade.castShadow = true; g.add(blade);
  const guard = mesh([paint(put(rock(rng, 2.6, 0.45, 0.55, 0.05), 0, 0, 0), '#6f6a60', '#6a7a40', 0.3)]); guard.position.set(7.9, 11.2, -1.95); guard.rotation.set(0.08, 0.4, 0.14); g.add(guard);
  return g;
}
/* ---------- Cabeça de gigante caída, meio enterrada ---------- */
export function makeGiantHead(seed = 7) {
  const rng = rngOf(seed), S = [];
  S.push(paint(put(rock(rng, 4.2, 4.8, 4.4, 0.08), 0, 1.6, 0, 0, 0, 0.5), '#a39d90', '#5a7a38', 0.85, seed));
  S.push(paint(put(rock(rng, 1.2, 2.2, 1.1, 0.05), 3.6, 2.4, 1.2, 0, 0.3, 0.5), '#a39d90', '#5a7a38', 0.7, seed)); // nariz
  S.push(paint(put(rock(rng, 2.6, 1.0, 2.0, 0.12), 2.2, 4.8, 0, 0, 0, 0.4), '#9a948a', '#5a7a38', 0.9, seed));  // sobrancelha pesada
  const g = new THREE.Group(); g.add(mesh(S));
  const holeM = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 1 });
  for (const sz of [-1.5, 1.5]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12), holeM); h.scale.set(0.5, 1, 1); h.position.set(3.7, 3.6, sz); g.add(h); } // órbitas vazias
  return g;
}
/* ---------- Monólito gasto com runas que brilham ---------- */
export function makeMonolith(seed = 11, h = 7) {
  const rng = rngOf(seed);
  const g = new THREE.BoxGeometry(1.8, h, 1.1, 4, 14, 3), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (y + h / 2) / h; const k = 1 - t * 0.18 + Math.sin(y * 1.3 + seed) * 0.03; P.setXYZ(i, x * k + Math.sin(y * 0.4) * 0.12, y + (t > 0.98 ? (Math.sin(x * 4 + seed) * 0.4 - 0.2) : 0), z * k); }
  g.translate(0, h / 2 - 0.6, 0); g.computeVertexNormals();
  const out = new THREE.Group(); out.add(mesh([paint(g, '#8f8a80', '#5d7a3a', 0.5, seed)]));
  const runeM = new THREE.MeshStandardMaterial({ color: '#bfe6ff', emissive: '#6fbaff', emissiveIntensity: 1.3 });
  for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24, Math.PI * (1 + rng() * 0.8)), runeM); r.position.set((rng() - 0.5) * 0.6, 1.4 + k * 1.2, 0.56); r.rotation.z = rng() * 6; out.add(r); }
  return out;
}
/* ---------- Arco antigo ---------- */
export function makeArch(seed = 5) {
  const rng = rngOf(seed), S = [];
  for (const sx of [-4.5, 4.5]) S.push(paint(column(rng, 0.9, 8.5), '#a29c8f', '#5d7a3a', 0.4, seed).translate(sx, 0, 0));
  const top = new THREE.TorusGeometry(4.5, 0.9, 12, 32, Math.PI); top.translate(0, 8.4, 0); { const P = top.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + Math.sin(P.getX(i) * 2.1) * 0.08); top.computeVertexNormals(); }
  S.push(paint(top, '#a29c8f', '#5d7a3a', 0.8, seed));
  return mesh(S);
}
/* ---------- Santuário Silente (fachada na montanha, escadaria, colunas e a porta das Catacumbas) ---------- */
export function makeTemple(seed = 13) {
  const rng = rngOf(seed), S = [], g = new THREE.Group();
  for (let k = 0; k < 8; k++) { const st = new THREE.BoxGeometry(30 - k * 1.2, 0.45, 3.2, 8, 1, 2); st.translate(0, 0.22 + k * 0.45, 9 - k * 1.5); S.push(paint(st, '#aaa497', '#6a7a40', 0.25, seed)); } // escadaria
  const plat = new THREE.BoxGeometry(26, 3.6, 12, 8, 2, 4); plat.translate(0, 1.8, -3); S.push(paint(plat, '#a19b8e', '#6a7a40', 0.3, seed));
  for (let k = 0; k < 6; k++) { const x = -11 + k * 4.4, broken = k === 1 || k === 4 ? 2 + rng() * 2 : 0; S.push(paint(column(rng, 0.85, 11 - broken), '#b0aa9c', '#5d7a3a', 0.35, seed).translate(x, 3.6, 1.2)); }
  const lintel = new THREE.BoxGeometry(27, 1.6, 2.6, 12, 2, 2); lintel.translate(0, 15.4, 1.2); { const P = lintel.attributes.position; for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) + 5) < 3 && P.getY(i) > 15) P.setY(i, P.getY(i) - 1.2); lintel.computeVertexNormals(); } // um pedaço caído
  S.push(paint(lintel, '#a8a294', '#5d7a3a', 0.5, seed));
  const wall = new THREE.BoxGeometry(26, 16, 2, 10, 6, 1); wall.translate(0, 9.6, -8.4); S.push(paint(wall, '#8f8a80', '#5d7a3a', 0.3, seed)); // fundo (encostado na montanha)
  const doorFrame = new THREE.TorusGeometry(3.4, 0.6, 10, 28, Math.PI); doorFrame.translate(0, 8.6, -7.3); S.push(paint(doorFrame, '#c2bba9', '#5d7a3a', 0.2, seed));
  for (const sx of [-3.4, 3.4]) { const jamb = new THREE.BoxGeometry(1.2, 5, 1.2); jamb.translate(sx, 6.1, -7.3); S.push(paint(jamb, '#c2bba9', '#5d7a3a', 0.2, seed)); }
  // S-103: a fachada sai de dentro da rocha — paredões dos lados, uma laje de pedra por cima (beiral) e blocos caídos na base
  const rk = (c, sz, rot, amt = 0.14, col = '#8c877d') => S.push(paint(put(amt > 0.2 ? chunk(rng, ...sz) : rock(rng, ...sz, amt), ...c, ...rot), col, '#5d7a3a', 0.45, seed + S.length));
  // massa de rocha = vários blocos angulosos sobrepostos (nada de "travesseiro" liso)
  const crag = (c, sz, n, amt = 0.3) => { for (let k = 0; k < n; k++) { const f = 0.55 + rng() * 0.25; rk([c[0] + (rng() - 0.5) * sz[0] * 0.4, c[1] + (k / Math.max(1, n - 1) - 0.5) * sz[1] * 0.55, c[2] + (rng() - 0.5) * sz[2] * 0.3], [sz[0] * f * 0.62, sz[1] * f * 0.5, sz[2] * f * 0.6], [(rng() - 0.5) * 0.2, rng() * 3, (rng() - 0.5) * 0.2], amt, rng() < 0.5 ? '#8c877d' : '#7f7a71'); } };
  for (const sx of [-1, 1]) {
    crag([sx * 17.2, 10, -3.5], [9, 22, 14], 4); rk([sx * 15.4, 7, -6.5], [3.8, 8.5, 4.5], [0, 0.3, 0], 0.3); rk([sx * 16.5, 2.8, 1.5], [3.6, 3.4, 3.6], [0, 1, 0], 0.3);            // paredão lateral colado na fachada
    crag([sx * 21, 22, -8], [12, 12, 12], 2);               // ombro da montanha
    crag([sx * 16, 2.4, 6], [6, 4, 6], 3, 0.25);            // pedras que rolaram ao pé da escada
    crag([sx * 21, 1.6, 11], [6, 3, 6], 2, 0.25);
    rk([sx * 14.2, 12.8, -1.2], [1.8, 6.5, 2.6], [0, 0, sx * 0.12], 0.2); // aresta de rocha cobrindo a junta
  }
  for (let k = 0; k < 4; k++) rk([-13.5 + k * 9 + (rng() - 0.5) * 2, 19.4 + rng() * 1.2, -1.4 + (rng() - 0.5) * 1.5], [6.5 + rng() * 1.5, 2.8 + rng() * 0.8, 5.6], [(rng() - 0.5) * 0.15, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.15], 0.3);              // beiral de rocha acima do lintel
  crag([0, 26, -9.5], [40, 12, 8], 4);                      // montanha logo atrás
  g.add(mesh(S));
  const dark = new THREE.Mesh(new THREE.CircleGeometry(3.3, 28, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#07060a' })); dark.position.set(0, 8.6, -7.35); g.add(dark);
  const darkB = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5), new THREE.MeshBasicMaterial({ color: '#07060a' })); darkB.position.set(0, 6.1, -7.35); g.add(darkB);
  // braseiros nas laterais da escada
  for (const sx of [-13, 13]) { const b = brazier(); b.position.set(sx, 3.6, 2.6); g.add(b); }
  g.userData.cols = [[-16.5, 1.5, 3.6], [16.5, 1.5, 3.6], [-16, 6, 3.4], [16, 6, 3.4], [-21, 11, 3.4], [21, 11, 3.4]]; // rochas no pé da fachada
  return g;
}
function brazier() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 0.6, 18), new THREE.MeshStandardMaterial({ color: '#4a3a2a', metalness: 0.6, roughness: 0.4 })); bowl.position.y = 1.4; g.add(bowl);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.2, 12), bowl.material); leg.position.y = 0.6; g.add(leg);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 14), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85 })); flame.position.y = 2.2; g.add(flame);
  g.add(vlightAt('#ffa040', 2.2, 14, 0, 2.4, 0));
  g.userData.update = t => { flame.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 11 + 1) * 0.15, 1); };
  return g;
}
/* ---------- Cacto (saguaro) com gomos ---------- */
export function cactusGeometry(seed) {
  const rng = rngOf(seed), parts = [];
  const trunk = (pts, r) => { const curve = new THREE.CatmullRomCurve3(pts), tg = new THREE.TubeGeometry(curve, 16, 1, 16, false), P = tg.attributes.position, N = tg.attributes.normal;
    for (let i = 0; i <= 16; i++) { const u = i / 16, c = curve.getPointAt(u), rr = r * (1 - u * 0.15) * (u > 0.92 ? Math.sqrt(Math.max(0.05, (1 - u) / 0.08)) : 1); for (let j = 0; j <= 16; j++) { const k = i * 17 + j, rib = 1 + Math.cos(j / 16 * Math.PI * 2 * 8) * 0.06; P.setXYZ(k, c.x + N.getX(k) * rr * rib, c.y + N.getY(k) * rr * rib, c.z + N.getZ(k) * rr * rib); } }
    tg.computeVertexNormals(); return tg; };
  const H = 2.6 + rng() * 1.8;
  parts.push(trunk([V3(0, -0.4, 0), V3(0, H * 0.5, 0), V3(0.05, H, 0)], 0.28));
  const arms = 1 + Math.floor(rng() * 2);
  for (let k = 0; k < arms; k++) { const s = k ? -1 : 1, y0 = H * (0.35 + rng() * 0.2), a = rng() * 0.6; parts.push(trunk([V3(0, y0, 0), V3(s * 0.55 * Math.cos(a), y0 + 0.1, 0.55 * Math.sin(a)), V3(s * 0.7 * Math.cos(a), y0 + 0.6, 0.7 * Math.sin(a)), V3(s * 0.72 * Math.cos(a), y0 + 1.2 + rng() * 0.5, 0.72 * Math.sin(a))], 0.17)); }
  const g = mergeGeometries(parts.map(p => { const x = p.toNonIndexed(); x.deleteAttribute('uv'); return x; }));
  const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(), a = new THREE.Color('#3f6b32'), b = new THREE.Color('#5f8a44');
  for (let i = 0; i < P.count; i++) { c.copy(a).lerp(b, Math.sin(P.getY(i) * 3 + P.getX(i) * 7) * 0.5 + 0.5); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { geo: g, radius: 0.35, height: H };
}
/* ---------- Fogueira de acampamento ---------- */
export function makeCampfire() {
  const g = new THREE.Group(), rng = rngOf(21);
  const logM = new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.9 });
  for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 12), logM); l.rotation.set(Math.PI / 2 - 0.35, k * Math.PI / 2, 0); l.position.set(Math.cos(k * Math.PI / 2) * 0.25, 0.2, Math.sin(k * Math.PI / 2) * 0.25); g.add(l); }
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, s = new THREE.Mesh(rock(rng, 0.16, 0.12, 0.14, 0.15), new THREE.MeshStandardMaterial({ color: '#8a857c', roughness: 1 })); s.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62); g.add(s); }
  const fl = [0, 1, 2].map(k => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - k * 0.05, 0.8 - k * 0.15, 14), new THREE.MeshBasicMaterial({ color: ['#ff8a2a', '#ffb347', '#ffe08a'][k], transparent: true, opacity: 0.85 })); f.position.y = 0.45; g.add(f); return f; });
  g.add(vlightAt('#ff9a40', 2.4, 12, 0, 0.8, 0));
  g.userData.update = t => fl.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 10 + k) * 0.1, 1 + Math.sin(t * 13 + k * 2) * 0.2, 1); f.rotation.y = t * (k + 1); });
  return g;
}
/* ---------- Pouso do Noctívago (S-177): poste de madeira lavrada com braço e mão-francesa,
   estandarte de pano bordado (cavalo alado em prata sobre vinho) balançando ao vento,
   cocho d'água, fardos de feno e o próprio Noctívago esperando ao lado ---------- */
function roostBannerTex() {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#3a0c14'); gr.addColorStop(0.5, '#6a1a24'); gr.addColorStop(1, '#3a0c14'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 3000; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,200'},${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 1, 2 + Math.random() * 3); } // trama do tecido
  x.strokeStyle = '#c9a24a'; x.lineWidth = 8; x.strokeRect(14, 14, W - 28, H - 70); x.strokeStyle = 'rgba(201,162,74,0.5)'; x.lineWidth = 2; x.strokeRect(26, 26, W - 52, H - 94);
  // cavalo alado empinado, em prata (silhueta bordada)
  x.save(); x.translate(W / 2, 240); x.fillStyle = '#dfe4ea'; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-30, 70); x.lineTo(-22, 20); x.bezierCurveTo(-30, 0, -24, -30, 0, -38); x.bezierCurveTo(10, -60, 18, -84, 36, -96); x.lineTo(54, -90); x.lineTo(40, -76); x.bezierCurveTo(30, -60, 34, -40, 26, -20); x.bezierCurveTo(30, 0, 30, 20, 18, 30); x.lineTo(30, 78); x.lineTo(20, 80); x.lineTo(6, 36); x.lineTo(-6, 40); x.lineTo(-14, 80); x.lineTo(-24, 80); x.closePath(); x.fill(); x.stroke();
  for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(0, -30); x.bezierCurveTo(sd * 40, -80, sd * 90, -90, sd * 104, -60); x.lineTo(sd * 84, -52); x.lineTo(sd * 96, -36); x.lineTo(sd * 72, -32); x.lineTo(sd * 80, -14); x.lineTo(sd * 54, -14); x.bezierCurveTo(sd * 30, -10, sd * 12, -14, 0, -10); x.closePath(); x.fill(); x.stroke(); }
  x.restore();
  x.fillStyle = '#e8d49a'; x.font = 'bold 22px serif'; x.textAlign = 'center'; x.fillText('POUSO', W / 2, 400); x.font = 'italic 16px serif'; x.fillText('dos Noctívagos', W / 2, 424);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let _roostTex = null;
export function makeRoost() {
  const g = new THREE.Group(), rng = rngOf(91);
  const wood = new THREE.MeshStandardMaterial({ color: '#5e3f26', roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: '#3e2a1a', roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: '#2c2a28', metalness: 0.75, roughness: 0.45 });
  // poste de seção quadrada com quinas chanfradas e veios (ruído nos vértices), sobre base de pedras
  const beam = (w, h, d) => { const b = new THREE.BoxGeometry(w, h, d, 2, Math.max(2, Math.round(h * 4)), 2), P = b.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) * (1 + Math.sin(y * 7 + P.getZ(i) * 30) * 0.03)); P.setZ(i, P.getZ(i) * (1 + Math.sin(y * 5 + P.getX(i) * 30) * 0.03)); } b.computeVertexNormals(); return b; };
  const post = new THREE.Mesh(beam(0.24, 4.4, 0.24), wood); post.position.y = 2.2; g.add(post);
  const arm = new THREE.Mesh(beam(0.18, 1.7, 0.18), wood); arm.rotation.z = Math.PI / 2; arm.position.set(0.7, 4.05, 0); g.add(arm);
  const brace = new THREE.Mesh(beam(0.12, 0.95, 0.12), dark); brace.rotation.z = Math.PI / 4; brace.position.set(0.35, 3.62, 0); g.add(brace);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 4), dark); cap.rotation.y = Math.PI / 4; cap.position.y = 4.52; g.add(cap);
  for (const y of [0.9, 3.3]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.06, 0.27), iron); band.position.y = y; g.add(band); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 18), iron); ring.position.set(0, 1.2, 0.15); g.add(ring); // argola de amarrar
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, st = new THREE.Mesh(rock(rng, 0.16, 0.11, 0.14, 0.15), new THREE.MeshStandardMaterial({ color: '#7e7a70', roughness: 1 })); st.position.set(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3); g.add(st); }
  // estandarte pendurado no braço por argolas, com bico embaixo; balança ao vento
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 8), iron); rod.rotation.z = Math.PI / 2; rod.position.set(0.85, 3.86, 0); g.add(rod);
  const BW = 0.95, BH = 1.9, pl = new THREE.PlaneGeometry(BW, BH, 10, 18); pl.translate(0, -BH / 2, 0);
  { const P = pl.attributes.position; for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i); if (py < -BH + 0.3) P.setY(i, -BH + Math.abs(px) / (BW / 2) * 0.3); } }
  const flag = new THREE.Mesh(pl, new THREE.MeshStandardMaterial({ map: _roostTex || (_roostTex = roostBannerTex()), side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(0.85, 3.84, 0); flag.castShadow = true; g.add(flag);
  for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), iron); r.position.set(0.85 - BW / 2 + 0.1 + k * (BW - 0.2) / 3, 3.86, 0); g.add(r); }
  const P = flag.geometry.attributes.position, base = P.array.slice();
  // cocho d'água e fardos de feno
  const trough = new THREE.Group(); trough.position.set(-0.9, 0, 1.3); trough.rotation.y = 0.3; g.add(trough);
  for (const [w, h, d, x, y, z] of [[1.6, 0.06, 0.5, 0, 0.12, 0], [1.6, 0.4, 0.06, 0, 0.32, 0.25], [1.6, 0.4, 0.06, 0, 0.32, -0.25], [0.06, 0.4, 0.5, 0.8, 0.32, 0], [0.06, 0.4, 0.5, -0.8, 0.32, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); trough.add(m); }
  const water = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.44), new THREE.MeshStandardMaterial({ color: '#2e4a5a', roughness: 0.05, metalness: 0.3 })); water.position.y = 0.42; trough.add(water);
  const hayM = new THREE.MeshStandardMaterial({ color: '#c9a85a', roughness: 1 });
  for (const [x, z, r] of [[1.0, 1.4, 0.2], [1.2, 0.8, -0.3]]) { const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.55, 3, 2, 2), hayM); const HP = h2.geometry.attributes.position; for (let i = 0; i < HP.count; i++) HP.setXYZ(i, HP.getX(i) + (Math.random() - 0.5) * 0.04, HP.getY(i) + (Math.random() - 0.5) * 0.04, HP.getZ(i) + (Math.random() - 0.5) * 0.04); h2.geometry.computeVertexNormals(); h2.position.set(x, 0.22, z); h2.rotation.y = r; g.add(h2); for (const bz of [-0.15, 0.15]) { const tie = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 16), dark); tie.scale.set(1, 0.85, 1); tie.position.set(x, 0.22, z + bz); tie.rotation.set(0, r + Math.PI / 2, 0); g.add(tie); } }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // o Noctívago, esperando o próximo voo
  const noc = makeNoctivago(7); noc.obj.position.set(1.0, 0, -2.6); noc.obj.rotation.y = -0.5; g.add(noc.obj);
  g.userData.update = t => {
    for (let i = 0; i < P.count; i++) { const hang = Math.min(1, -base[i * 3 + 1] / BH); P.setZ(i, base[i * 3 + 2] + Math.sin(t * 2.4 + base[i * 3 + 1] * 2.5 + base[i * 3] * 1.5) * 0.09 * hang + Math.sin(t * 3.9 + base[i * 3] * 6) * 0.02 * hang); }
    P.needsUpdate = true; flag.geometry.computeVertexNormals(); noc.update(t);
  };
  g.userData.cols = [[0, 0, 0.35], [1.0, -2.6, 1.1], [1.3, -1.9, 0.8], [0.6, -3.4, 0.8], [-0.9, 1.3, 0.8]];
  return g;
}

/* ---------- alvenaria: blocos de pedra irregulares, quinas arredondadas, cor variada e musgo ----------
   Usada na lareira da taverna (S-080) e nos muros das ruínas (S-092). */
function stoneBlock(rng, w, h, d) {
  const g = mergeVertices(new THREE.BoxGeometry(w, h, d, 3, 2, 2)), P = g.attributes.position, r = Math.min(w, h, d) * 0.22;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    // arredonda as quinas: puxa para dentro quem está perto de duas faces ao mesmo tempo
    const ex = Math.max(0, Math.abs(x) - (w / 2 - r)), ey = Math.max(0, Math.abs(y) - (h / 2 - r)), ez = Math.max(0, Math.abs(z) - (d / 2 - r));
    const e = Math.hypot(ex, ey, ez); if (e > 0) { const k = r / e; x -= Math.sign(x) * ex * (1 - k); y -= Math.sign(y) * ey * (1 - k); z -= Math.sign(z) * ez * (1 - k); }
    const j = (rng() - 0.5) * 0.025; P.setXYZ(i, x + j, y + j, z + j);
  }
  g.computeVertexNormals(); return g;
}
export function masonry(opts) {
  const { w, h, d = 0.5, seed = 1, base = '#8a857b', moss = 0, hole = null, broken = 0, rowH = 0.32 } = opts;
  const rng = rngOf(seed), parts = [], baseC = new THREE.Color(base), dark = new THREE.Color('#4f4b45'), mossC = new THREE.Color('#5b7a36');
  let y = 0, row = 0;
  while (y < h - 0.05) {
    const bh = Math.min(rowH * (0.85 + rng() * 0.3), h - y);
    let x = -w / 2 + (row % 2 ? -rng() * 0.3 : 0);
    const topCut = broken ? h - broken * (0.5 + 0.5 * Math.sin(row * 1.7 + seed)) : h; // borda de cima quebrada
    while (x < w / 2 - 0.05) {
      const bw = Math.min(0.45 + rng() * 0.5, w / 2 - x);
      const cx = x + bw / 2, cy = y + bh / 2;
      x += bw;
      if (cx < -w / 2 || bw < 0.12) continue;
      if (hole && Math.abs(cx - hole.x) < hole.w / 2 && cy < hole.h && (cy < hole.h - hole.w / 2 || Math.hypot(cx - hole.x, cy - (hole.h - hole.w / 2)) < hole.w / 2)) continue; // vão (lareira)
      if (y + bh > topCut + rng() * 0.6) continue;
      const g = stoneBlock(rng, bw - 0.03, bh - 0.03, d * (0.92 + rng() * 0.12)); g.translate(cx, cy, (rng() - 0.5) * 0.04);
      const c = baseC.clone().offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.14), N = g.attributes.normal, Pp = g.attributes.position, col = new Float32Array(Pp.count * 3), t = new THREE.Color();
      for (let i = 0; i < Pp.count; i++) { t.copy(c); if (moss && N.getY(i) > 0.4 && rng() < moss) t.lerp(mossC, 0.7); if (Pp.getY(i) < 0.15) t.lerp(dark, 0.3); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g.toNonIndexed());
    }
    y += bh; row++;
  }
  // argamassa escura atrás dos blocos
  const back = new THREE.BoxGeometry(w * 0.99, Math.max(0.1, (broken ? h - broken : h) * 0.98), d * 0.7); back.translate(0, (broken ? h - broken : h) * 0.49, -0.02);
  if (!hole) { const n = back.attributes.position.count, col = new Float32Array(n * 3).fill(0.25); back.setAttribute('color', new THREE.BufferAttribute(col, 3)); back.deleteAttribute('uv'); parts.push(back.toNonIndexed()); }
  const m = new THREE.Mesh(mergeGeometries(parts.map(p => { if (p.attributes.uv) p.deleteAttribute('uv'); return p; })), stoneMat); m.castShadow = m.receiveShadow = true;
  return m;
}
/* ---------- muro de ruína (S-092): pedra de verdade, com musgo e topo quebrado ---------- */
export function makeRuinWall(seed = 1, len = 7, h = 3.4) {
  const g = new THREE.Group(), rng = rngOf(seed);
  const wall = masonry({ w: len, h, d: 0.9, seed, base: '#8d887d', moss: 0.35, broken: 1.4, rowH: 0.42 }); wall.position.y = -0.25; g.add(wall);
  // pedras caídas ao pé do muro
  for (let k = 0; k < 4; k++) { const s = mesh([paint(rock(rng, 0.25 + rng() * 0.2, 0.18 + rng() * 0.12, 0.22 + rng() * 0.15, 0.15), '#8d887d', '#5b7a36', 0.4, seed + k)]); s.position.set((rng() - 0.5) * len, 0.08, 0.7 + rng() * 0.5); s.rotation.set(rng(), rng(), rng()); g.add(s); }
  return g;
}
/* ---------- carrinho de mão (S-082): caçamba de tábuas, cabos curvos e roda com raios ---------- */
export function makeWheelbarrow() {
  // S-134: refeito para que tudo se encaixe — os cabos nascem no eixo da roda, a caçamba assenta sobre os cabos
  // (inclinada junto com eles) e os pés descem dos cabos até o chão. Frente (roda) = +Z.
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: '#4a4a4e', roughness: 0.45, metalness: 0.7 });
  const R = 0.22, WY = R + 0.03, WZ = 0.72, HX = 0.2; // raio da roda, altura e posição do eixo, meia-distância dos cabos no eixo
  const handle = sx => new THREE.CatmullRomCurve3([V3(sx * HX, WY, WZ + 0.04), V3(sx * (HX + 0.03), WY + 0.1, 0.35), V3(sx * (HX + 0.07), WY + 0.21, -0.3), V3(sx * (HX + 0.1), WY + 0.37, -0.95)]);
  const at = (c, z) => { let best = c.getPoint(0), bd = 9; for (let k = 0; k <= 60; k++) { const p = c.getPoint(k / 60), d = Math.abs(p.z - z); if (d < bd) { bd = d; best = p; } } return best; };
  for (const sx of [-1, 1]) {
    const c = handle(sx), t = new THREE.Mesh(new THREE.TubeGeometry(c, 32, 0.035, 12), dark); g.add(t);
    // pegador alinhado com a ponta do cabo
    const end = c.getPoint(1), dir = c.getTangent(1), grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 4, 12), wood);
    grip.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); grip.position.copy(end).addScaledVector(dir, 0.04); g.add(grip);
    // pé: do cabo até o chão, com sapata
    const top = at(c, -0.38), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, top.y + 0.02, 12), dark); leg.position.set(top.x, (top.y + 0.02) / 2 - 0.01, top.z); g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.09), iron); foot.position.set(top.x, 0.015, top.z); g.add(foot);
  }
  { const a = at(handle(-1), -0.38), b = at(handle(1), -0.38), br = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, b.x - a.x, 10), dark); br.rotation.z = Math.PI / 2; br.position.set(0, a.y * 0.45, a.z); g.add(br); } // travessa entre os pés
  // caçamba: grupo inclinado como os cabos, apoiado em cima deles
  const p0 = at(handle(1), 0.3), p1 = at(handle(1), -0.25), pitch = Math.atan2(p0.y - p1.y, p0.z - p1.z);
  const bin = new THREE.Group(); bin.position.set(0, (p0.y + p1.y) / 2 + 0.035 + 0.02, (p0.z + p1.z) / 2); bin.rotation.x = -pitch; g.add(bin);
  const plank = (w, h, d, x, y, z, rx = 0, rz = 0, m = wood) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 1, 1), m); b.position.set(x, y, z); b.rotation.set(rx, 0, rz); bin.add(b); };
  for (let k = 0; k < 4; k++) plank(0.6, 0.035, 0.18, 0, 0.018, -0.27 + k * 0.18, 0, 0, k % 2 ? wood : dark); // fundo
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) plank(0.035, 0.15, 0.78 + k * 0.08, sx * (0.3 + 0.05 + k * 0.045), 0.1 + k * 0.145, 0, 0, -sx * 0.32); // laterais abertas
  for (const sz of [-1, 1]) for (let k = 0; k < 2; k++) plank(0.66 + k * 0.1, 0.15, 0.035, 0, 0.1 + k * 0.145, sz * (0.36 + 0.05 + k * 0.045), sz * 0.32, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.05), iron); st.position.set(sx * 0.4, 0.17, sz * 0.43); st.rotation.set(sz * 0.32, 0, -sx * 0.32); bin.add(st); } // cantoneiras de ferro
  // roda com aro de ferro, cubo e raios, no eixo entre os cabos
  const wheel = new THREE.Group(); wheel.position.set(0, WY, WZ); g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 10, 36), iron); rim.rotation.y = Math.PI / 2; wheel.add(rim);
  const tread = new THREE.Mesh(new THREE.TorusGeometry(R - 0.025, 0.028, 10, 36), wood); tread.rotation.y = Math.PI / 2; wheel.add(tread);
  for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, (R - 0.03) * 2, 8), wood); sp.rotation.x = k / 8 * Math.PI; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 14), iron); hub.rotation.z = Math.PI / 2; wheel.add(hub);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, HX * 2 + 0.1, 10), iron); axle.rotation.z = Math.PI / 2; wheel.add(axle);
  for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), iron); cap.rotation.z = Math.PI / 2; cap.position.x = sx * (HX + 0.05); wheel.add(cap); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* =========================================================================
   COLOSSOS (S-102): gigantes esculpidos na pedra, cada um com pose, armadura e arma próprias.
   Inspiração de sensação (não de visual): a vastidão silenciosa de Shadow of the Colossus e a
   brutalidade dos titãs de God of War. Tudo numa malha de pedra (cor por vértice: musgo em cima,
   sujeira embaixo, rachaduras) + uma malha de runas que brilham fraquinho.
   Cada função devolve um Group com userData.cols = [[x, z, raio], ...] (colisão no chão, local).
   ========================================================================= */
const UPV = new THREE.Vector3(0, 1, 0);
const runeMat = new THREE.MeshStandardMaterial({ color: '#7fa8c8', emissive: '#5aa8f0', emissiveIntensity: 0.9, roughness: 0.6 });
const eyeMat = new THREE.MeshStandardMaterial({ color: '#e6f4ff', emissive: '#8fd0ff', emissiveIntensity: 2.2 });
// membro esculpido de a até b: tronco de cone com músculo (barriga no meio), desgaste e leve achatamento
function limb(rng, a, b, r0, r1, o = {}) {
  const A = V3(...a), B = V3(...b), d = B.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(1, 1, L, 24, Math.max(6, Math.round(L / 0.6)), true), P = g.attributes.position, ph = rng() * 10, bulge = o.bulge ?? 0.12, amt = o.amt ?? 0.035, fx = o.fx ?? 1;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (y + L / 2) / L, r = r0 + (r1 - r0) * t;
    const m = 1 + Math.sin(t * Math.PI) * bulge + Math.sin(t * Math.PI * 2 + ph) * bulge * 0.25;
    const n = 1 + (Math.sin(x * 3 + y * 1.3 + ph) * Math.cos(z * 2.6 + ph) * 0.5 + Math.sin(y * 4.1 + ph) * 0.25) * amt;
    P.setXYZ(i, x * r * m * n * fx, y, z * r * m * n);
  }
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  g.computeVertexNormals(); return g;
}
// placa de armadura: bloco de quinas gastas, curvado como uma couraça
function plate(rng, w, h, d, pos, rot = [0, 0, 0], curve = 0.22) {
  const g = mergeVertices(new THREE.BoxGeometry(w, h, d, 10, 8, 2).deleteAttribute('uv').deleteAttribute('normal')), P = g.attributes.position, r = Math.min(w, h, d) * 0.4;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const ex = Math.max(0, Math.abs(x) - (w / 2 - r)), ey = Math.max(0, Math.abs(y) - (h / 2 - r)), ez = Math.max(0, Math.abs(z) - (d / 2 - r));
    const e = Math.hypot(ex, ey, ez); if (e > 0) { const k = r / e; x -= Math.sign(x) * ex * (1 - k); y -= Math.sign(y) * ey * (1 - k); z -= Math.sign(z) * ez * (1 - k); }
    z -= (Math.pow(x / (w / 2), 2) * w * 0.5 + Math.pow(y / (h / 2), 2) * h * 0.18) * curve; // curvatura
    const j = Math.sin(x * 2.3 + y * 1.7) * Math.cos(y * 2.1) * 0.03 * Math.min(w, h);
    P.setXYZ(i, x, y, z + j);
  }
  g.computeVertexNormals(); return put(g, pos[0], pos[1], pos[2], rot[0], rot[1], rot[2]);
}
// ponta afiada (chifre, espigão, garra) que curva ao longo de vários pontos
function horn(rng, pts, r0, r1 = 0.02) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), N = 20, tg = new THREE.TubeGeometry(curve, N, 1, 16, false), P = tg.attributes.position, Nn = tg.attributes.normal;
  for (let i = 0; i <= N; i++) { const u = i / N, c = curve.getPointAt(u), rr = r0 + (r1 - r0) * Math.pow(u, 0.8); for (let j = 0; j <= 16; j++) { const k = i * 17 + j, ring = 1 + (Math.sin(u * 40) > 0.6 ? 0.06 : 0); P.setXYZ(k, c.x + Nn.getX(k) * rr * ring, c.y + Nn.getY(k) * rr * ring, c.z + Nn.getZ(k) * rr * ring); } }
  tg.deleteAttribute('uv'); tg.computeVertexNormals(); return tg;
}
// lâmina de espada: larga, com fio afinando nas bordas e ponta
function blade(W, L, T = 0.6, broken = 0) {
  const bl = new THREE.BoxGeometry(W, L, T, 8, 24, 2), Pb = bl.attributes.position;
  for (let i = 0; i < Pb.count; i++) { const y = Pb.getY(i), t = (y + L / 2) / L, x = Pb.getX(i), z = Pb.getZ(i); const taper = t < 0.1 ? t / 0.1 : 1; let yy = y; if (broken && t > 0.98) yy -= (Math.sin(x * 5) * 0.5 + 0.5) * broken; Pb.setXYZ(i, x * (0.8 + 0.2 * t) * Math.max(0.04, taper), yy, z * (1 - Math.pow(Math.abs(x) / (W / 2), 2) * 0.8) * Math.max(0.2, taper)); }
  bl.deleteAttribute('uv'); bl.computeVertexNormals(); return bl;
}
const blob = (rng, c, s, rot = [0, 0, 0], amt = 0.06) => put(rock(rng, s[0], s[1], s[2], amt), c[0], c[1], c[2], rot[0], rot[1], rot[2]);
// faixa de runa: glifos gravados (haste + galhos em diagonal), um embaixo do outro
function runeLine(rng, pos, len, rot = [0, 0, 0], w = 0.14) {
  const parts = [], gh = Math.max(0.6, w * 6), bar = (l, a, x, y) => { const b = new THREE.BoxGeometry(w, l, 0.08); b.rotateZ(a); b.translate(x, y, 0); parts.push(b); };
  for (let y = -len / 2 + gh / 2; y < len / 2 - gh / 2; y += gh * 1.35) {
    bar(gh, 0, 0, y); // haste
    const kind = Math.floor(rng() * 5), d = gh * 0.42;
    if (kind === 0) { bar(d, 0.8, d * 0.28, y + gh * 0.25); bar(d, -0.8, d * 0.28, y); }
    else if (kind === 1) { bar(d * 1.2, 0.7, -d * 0.3, y + gh * 0.2); bar(d * 1.2, -0.7, d * 0.3, y + gh * 0.2); }
    else if (kind === 2) { bar(d, -0.75, d * 0.3, y + gh * 0.3); bar(d, 0.75, d * 0.3, y - gh * 0.05); bar(d, -0.75, -d * 0.3, y - gh * 0.2); }
    else if (kind === 3) { bar(d * 1.4, 0.6, 0, y); }
    else { bar(d, 0.8, -d * 0.28, y + gh * 0.3); bar(d, -0.8, d * 0.28, y + gh * 0.3); bar(d * 0.9, Math.PI / 2, 0, y - gh * 0.3); }
  }
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; })); return put(g, pos[0], pos[1], pos[2], rot[0], rot[1], rot[2]);
}
function runeRing(R, pos, rot = [0, 0, 0], n = 16) {
  const parts = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, b = new THREE.BoxGeometry(0.16, R * 0.32 * (k % 3 ? 0.6 : 1), 0.08); b.rotateZ(a + (k % 2 ? 0.3 : -0.3)); b.translate(Math.cos(a) * R, Math.sin(a) * R, 0); parts.push(b); }
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; })); return put(g, pos[0], pos[1], pos[2], rot[0], rot[1], rot[2]);
}
// junta as peças: pedra pintada (1 malha) + runas (1 malha)
function colossusMesh(stoneParts, runeParts, eyes = []) {
  const g = new THREE.Group();
  g.add(mesh(stoneParts));
  if (runeParts.length) { const r = new THREE.Mesh(mergeGeometries(runeParts.map(p => { const x = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); if (!x.attributes.normal) x.computeVertexNormals(); return x; })), runeMat); g.add(r); }
  for (const [x, y, z, sx, sy, sz, rx = 0, ry = 0] of eyes) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), eyeMat); e.scale.set(sx, sy, sz); e.position.set(x, y, z); e.rotation.set(rx, ry, 0); g.add(e); }
  return g;
}
// destroços aos pés: lascas de armadura e pedras quebradas
function rubble(rng, S, n, cx, cz, spread, base, scale = 1) {
  for (let k = 0; k < n; k++) {
    const x = cx + (rng() - 0.5) * spread, z = cz + (rng() - 0.5) * spread, s = (0.5 + rng() * 1.3) * scale;
    S.push(paint(rng() < 0.5 ? blob(rng, [x, s * 0.25, z], [s, s * 0.6, s * 0.9], [rng(), rng() * 3, rng()], 0.2) : plate(rng, s * 2, s * 1.4, s * 0.45, [x, s * 0.3, z], [-1.3 + rng() * 0.5, rng() * 3, rng() - 0.5]), base, '#5b7a36', 0.8, k));
  }
}

/* ---------- 1. Sentinela de Pé (≈ 35 m): elmo com crista, escudo redondo nas costas, as duas mãos no pomo de uma espada cravada no chão ---------- */
export function makeSentinel(seed = 41) {
  const rng = rngOf(seed), S = [], R = [], base = '#b2ab9d', armor = '#97918a', moss = '#5d7a3a';
  const P = (g, c = base, m = 0.55) => S.push(paint(g, c, moss, m, seed));
  for (const sx of [-1, 1]) {
    // pernas firmes, afastadas
    P(blob(rng, [sx * 4.3, 0.9, 1.4], [1.7, 1.0, 2.8]), armor);                                  // pé (sapato de placas)
    P(plate(rng, 3.0, 1.2, 3.8, [sx * 4.3, 1.5, 1.8], [-0.25, 0, 0], 0.3), armor);                // biqueira
    P(limb(rng, [sx * 4.3, 1.4, 0.4], [sx * 3.7, 9.2, 0.2], 1.35, 1.75, { bulge: 0.16 }));        // canela
    P(plate(rng, 2.6, 6.2, 0.7, [sx * 4.0, 5.4, 1.75], [-0.04, sx * 0.05, 0], 0.5), armor);        // grevas
    P(blob(rng, [sx * 3.7, 9.4, 0.5], [2.0, 1.9, 2.0]));                                          // joelho
    P(plate(rng, 2.6, 2.4, 0.8, [sx * 3.7, 9.6, 2.3], [0.15, 0, 0], 0.6), armor);                 // joelheira
    P(limb(rng, [sx * 3.7, 9.4, 0.3], [sx * 2.9, 16.4, 0], 1.85, 2.35, { bulge: 0.12 }));          // coxa
  }
  P(blob(rng, [0, 16.9, 0], [4.7, 2.7, 3.3]));                                                     // quadril
  for (let k = 0; k < 9; k++) { const a = -2.2 + k * 0.55, x = Math.sin(a) * 4.6, z = Math.cos(a) * 3.5; P(plate(rng, 2.4, 4.8, 0.5, [x, 14.8, z], [-0.18, a, 0], 0.3), armor); } // saiote de placas
  P(blob(rng, [0, 18.2, 0.1], [5.0, 1.0, 3.7], [0, 0, 0], 0.03), '#7d786e');                        // cinturão
  P(plate(rng, 2.6, 2.2, 0.8, [0, 18.2, 3.75], [0, 0, 0], 0.3), armor); R.push(runeRing(0.75, [0, 18.2, 4.2])); // fivela com runa
  P(blob(rng, [0, 20.6, 0.2], [3.9, 3.0, 2.9]));                                                   // abdome
  for (let k = 0; k < 3; k++) P(plate(rng, 6.6 - k * 0.3, 1.2, 0.6, [0, 19.4 + k * 1.15, 2.7 + k * 0.12], [-0.1, 0, 0], 0.45), armor); // lâminas da barriga
  P(blob(rng, [0, 24.4, 0.2], [5.6, 3.9, 3.5]));                                                   // peito
  for (const sx of [-1, 1]) P(plate(rng, 4.6, 5.4, 0.8, [sx * 2.35, 24.6, 3.15], [-0.12, sx * 0.38, 0], 0.4), armor); // couraça
  P(plate(rng, 0.9, 5.8, 0.9, [0, 24.6, 3.75], [-0.12, 0, 0], 0.1), '#9a9488'); R.push(runeLine(rng, [0, 24.4, 4.25], 4.6, [-0.12, 0, 0]));   // quilha central com inscrição
  // escudo redondo pendurado nas costas
  { const sh = new THREE.CylinderGeometry(5.2, 5.2, 0.9, 48, 1); const Pp = sh.attributes.position; for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i), z = Pp.getZ(i), y = Pp.getY(i); Pp.setY(i, y + (y > 0 ? (1 - (x * x + z * z) / 27) * 0.9 : 0)); } sh.deleteAttribute('uv'); sh.computeVertexNormals(); P(put(sh, 0, 23.4, -4.2, -Math.PI / 2 + 0.1, Math.PI, 0), '#8a8479', 0.4);
    P(put(new THREE.TorusGeometry(5.1, 0.35, 10, 48).deleteAttribute('uv'), 0, 23.4, -4.4, 0.1, 0, 0), '#77726a', 0.3);
    P(blob(rng, [0, 23.5, -5.6], [1.3, 1.3, 0.9], [0, 0, 0], 0.03), '#77726a'); R.push(runeRing(3.4, [0, 23.4, -5.45], [0.1, 0, 0], 22)); }
  for (const sx of [-1, 1]) { // ombros com ombreiras em camadas
    P(blob(rng, [sx * 5.6, 26.8, 0.1], [2.4, 2.2, 2.4]));
    for (let k = 0; k < 3; k++) P(plate(rng, 4.6 - k * 0.5, 2.0, 4.4 - k * 0.3, [sx * (6.3 + k * 0.35), 27.9 - k * 1.25, 0.1], [0, 0, sx * (-0.5 - k * 0.12)], 0.35), armor);
    // braços: cotovelos abertos, as duas mãos repousam uma sobre a outra no pomo da espada
    P(limb(rng, [sx * 5.9, 26.4, 0.2], [sx * 7.0, 21.2, 1.4], 1.65, 1.4));          // braço
    P(blob(rng, [sx * 7.0, 21.2, 1.4], [1.55, 1.55, 1.55]));                         // cotovelo
    P(limb(rng, [sx * 7.0, 21.2, 1.4], [sx * 1.5, 18.9, 5.9], 1.4, 1.05));           // antebraço
    P(plate(rng, 2.5, 3.8, 0.6, [sx * 4.4, 20.4, 4.0], [0.35, sx * -0.7, sx * 1.2], 0.5), armor); // braçadeira
    P(put(new THREE.TorusGeometry(1.15, 0.22, 8, 24).deleteAttribute('uv'), sx * 2.3, 19.2, 5.3, 0.4, sx * -0.95, 0), armor, 0.2); // punho da manopla
  }
  P(blob(rng, [0, 19.2, 6.5], [1.7, 1.15, 1.5]), armor);                                // mão de baixo
  P(blob(rng, [0.2, 20.3, 6.4], [1.6, 1.1, 1.45], [0, 0.3, 0]), armor);                  // mão de cima
  for (let f = 0; f < 4; f++) P(limb(rng, [-1.3 + f * 0.85, 19.5, 7.4], [-1.2 + f * 0.82, 18.2, 7.6], 0.34, 0.28, { bulge: 0.05 }), armor); // dedos sobre o pomo
  // espada cravada: lâmina larga com runas no sulco, guarda curva, cabo e pomo
  { const L = 17.2, bl = new THREE.BoxGeometry(3.2, L, 0.6, 8, 24, 2), Pb = bl.attributes.position; for (let i = 0; i < Pb.count; i++) { const y = Pb.getY(i), t = (y + L / 2) / L, x = Pb.getX(i), z = Pb.getZ(i); const taper = t < 0.1 ? t / 0.1 : 1; Pb.setXYZ(i, x * (0.8 + 0.2 * t) * Math.max(0.04, taper), y, z * (1 - Math.pow(Math.abs(x) / 1.6, 2) * 0.8) * Math.max(0.2, taper)); }
    bl.deleteAttribute('uv'); bl.computeVertexNormals(); P(put(bl, 0, L / 2 - 1.4, 6.7), '#99958d', 0.15); R.push(runeLine(rng, [0, 7.4, 7.02], 11, [0, 0, 0], 0.16)); }
  S.push(paint(horn(rng, [[-3.6, 16.6, 6.7], [-1.8, 15.6, 6.7], [0, 15.4, 6.7], [1.8, 15.6, 6.7], [3.6, 16.6, 6.7]], 0.62, 0.5), '#858077', moss, 0.3, seed)); // guarda
  P(limb(rng, [0, 15.6, 6.7], [0, 18.4, 6.7], 0.5, 0.5), '#6f6a62'); P(blob(rng, [0, 18.6, 6.7], [0.9, 0.7, 0.9]), '#7d786e');
  // pescoço e elmo (cabeça levemente baixa, olhando quem chega)
  P(limb(rng, [0, 27.6, 0.2], [0, 29.4, 0.9], 1.7, 1.5));
  P(blob(rng, [0, 31.3, 1.1], [2.35, 2.75, 2.55], [0.25, 0, 0], 0.03), armor);                     // elmo
  P(plate(rng, 4.0, 3.4, 0.9, [0, 30.7, 3.35], [0.25, 0, 0], 0.55), armor);                       // viseira
  P(plate(rng, 4.4, 0.7, 1.1, [0, 31.7, 3.45], [0.25, 0, 0], 0.4), '#7a756c');                    // aba sobre a fenda dos olhos
  for (const sx of [-1, 1]) P(plate(rng, 1.4, 3.6, 2.6, [sx * 2.1, 30.1, 2.0], [0.25, sx * 0.4, 0], 0.3), armor); // jugulares
  P(plate(rng, 0.6, 2.8, 5.6, [0, 34.1, 0.3], [0.25, 0, 0], 0.25), armor);                        // crista
  for (const sx of [-1, 1]) S.push(paint(horn(rng, [[sx * 1.9, 32.2, 0.9], [sx * 4.2, 33.0, 0.2], [sx * 5.8, 35.2, -1.2], [sx * 6.2, 38.4, -2.6], [sx * 5.4, 40.6, -3.4]], 0.85, 0.06), '#8a8479', moss, 0.3, seed)); // chifres para trás
  rubble(rng, S, 10, 0, 3, 22, armor, 1.1);
  const g = colossusMesh(S, R, [[-0.9, 31.15, 3.55, 0.55, 0.16, 0.2, 0.25], [0.9, 31.15, 3.55, 0.55, 0.16, 0.2, 0.25]]);
  g.userData.cols = [[-4.2, 1, 2.6], [4.2, 1, 2.6], [0, 6.7, 1.6], [0, -1.5, 3]];
  return g;
}

/* ---------- 2. Rei Sentado (≈ 32 m com o trono): barba trançada, coroa de espigões, mão no braço do trono e machado de duas lâminas ---------- */
export function makeSeatedKing(seed = 53) {
  const rng = rngOf(seed), S = [], R = [], base = '#a49d8f', armor = '#8c867b', moss = '#5d7a3a', throneC = '#8f8a80';
  const P = (g, c = base, m = 0.55) => S.push(paint(g, c, moss, m, seed));
  // trono: base em degraus, assento, encosto alto com três torres, braços
  P(plate(rng, 18, 3.2, 15, [0, 1.6, -0.8], [0, 0, 0], 0.02), throneC, 0.8); P(plate(rng, 16, 3.4, 12, [0, 4.6, -1.4], [0, 0, 0], 0.02), throneC, 0.7);
  P(plate(rng, 16, 22, 2.8, [0, 17, -7.6], [0, 0, 0], 0.08), throneC, 0.5);
  for (const sx of [-1, 0, 1]) { const h = sx ? 5 : 7.5, y0 = 27.6; P(plate(rng, sx ? 2.6 : 3.4, h, 3.2, [sx * 6.4, y0 + h / 2, -7.6], [0, 0, 0], 0.05), throneC, 0.6); S.push(paint(horn(rng, [[sx * 6.4, y0 + h - 0.2, -7.6], [sx * 6.5, y0 + h + 2.2, -7.6], [sx * 6.6, y0 + h + 4.2, -7.5]], sx ? 1.1 : 1.5, 0.06), throneC, moss, 0.3, seed)); }
  P(put(new THREE.TorusGeometry(5.2, 0.8, 10, 32, Math.PI).deleteAttribute('uv'), 0, 22.4, -6.0, 0, 0, 0), '#7f7a70', 0.3); R.push(runeRing(3.6, [0, 22.4, -6.05], [0, 0, 0], 20)); // arco esculpido atrás da cabeça
  for (const sx of [-1, 1]) { P(plate(rng, 2.6, 4.2, 12, [sx * 8.4, 8.4, -1.6], [0, 0, 0], 0.05), throneC, 0.7); P(blob(rng, [sx * 8.4, 10.5, 4.6], [1.6, 1.6, 1.6], [0, 0, 0], 0.08), throneC); }
  R.push(runeLine(rng, [0, 17, -6.1], 16, [0, 0, 0], 0.22)); for (const sx of [-1, 1]) R.push(runeLine(rng, [sx * 4.2, 15, -6.1], 10, [0, 0, 0], 0.16));
  // pernas sentadas
  for (const sx of [-1, 1]) {
    P(limb(rng, [sx * 2.9, 8.8, -1.6], [sx * 3.3, 9.1, 6.4], 2.5, 2.0, { bulge: 0.15 }));     // coxa
    P(plate(rng, 4.0, 5.0, 0.7, [sx * 3.1, 10.8, 3.0], [-Math.PI / 2 + 0.1, 0, 0], 0.45), armor); // coxote
    P(blob(rng, [sx * 3.3, 8.9, 6.8], [2.0, 2.0, 2.0]));                                     // joelho
    P(plate(rng, 2.6, 2.4, 0.8, [sx * 3.3, 9.1, 8.6], [0.2, 0, 0], 0.6), armor);
    P(limb(rng, [sx * 3.3, 8.6, 7.0], [sx * 3.5, 1.3, 7.8], 1.85, 1.4, { bulge: 0.16 }));     // canela
    P(plate(rng, 2.4, 5.6, 0.6, [sx * 3.4, 4.6, 9.15], [-0.05, 0, 0], 0.5), armor);
    P(blob(rng, [sx * 3.5, 0.9, 9.0], [1.7, 1.0, 2.6]), armor);                               // pé
  }
  P(blob(rng, [0, 8.8, -1.8], [4.6, 2.6, 3.6]));                                              // quadril
  for (let k = 0; k < 5; k++) P(plate(rng, 1.8, 4.2, 0.45, [-3.2 + k * 1.6, 9.2, 2.2 + Math.abs(k - 2) * -0.25], [-1.2, 0, 0], 0.25), '#7f7a70', 0.7); // saiote caído sobre as coxas
  P(blob(rng, [0, 12.4, -1.9], [3.9, 3.0, 2.9]));                                             // abdome
  P(blob(rng, [0, 16.4, -2.2], [5.4, 3.7, 3.4]));                                             // peito
  for (const sx of [-1, 1]) P(plate(rng, 4.4, 4.8, 0.8, [sx * 2.3, 16.2, 0.95], [-0.05, sx * 0.4, 0], 0.4), armor);
  P(blob(rng, [0, 10.6, -1.8], [4.9, 0.9, 3.6], [0, 0, 0], 0.03), '#77726a');                  // cinturão
  P(plate(rng, 3.0, 2.4, 0.8, [0, 10.6, 1.8], [0, 0, 0], 0.3), armor); R.push(runeRing(0.8, [0, 10.6, 2.25]));
  // barba longa trançada (cai sobre o peito)
  P(blob(rng, [0, 19.6, 0.4], [2.1, 2.2, 1.4], [0.2, 0, 0], 0.1), '#8f897d', 0.2);
  for (const sx of [-1, 0, 1]) { P(limb(rng, [sx * 0.9, 19.0, 1.0], [sx * 0.7, 13.6, 1.9], 0.75, 0.45, { bulge: 0.1, amt: 0.12 }), '#8f897d', 0.2); for (let k = 0; k < 3; k++) P(put(new THREE.TorusGeometry(0.62 - k * 0.06, 0.16, 8, 20).deleteAttribute('uv'), sx * (0.85 - k * 0.05), 17.8 - k * 1.5, 1.25 + k * 0.25, Math.PI / 2 + 0.15, 0, 0), '#6f6a60', 0.1); }
  // cabeça e coroa
  P(limb(rng, [0, 19.3, -2.0], [0, 21.0, -1.2], 1.6, 1.45));
  P(blob(rng, [0, 22.7, -0.9], [2.15, 2.5, 2.3], [0.1, 0, 0], 0.04));
  P(blob(rng, [0, 23.3, 1.0], [2.0, 0.55, 0.8], [0.1, 0, 0], 0.06));                          // sobrancelha pesada
  P(blob(rng, [0, 22.2, 1.35], [0.5, 1.0, 0.7], [0.3, 0, 0], 0.04));                          // nariz
  P(blob(rng, [0, 21.0, 0.9], [1.7, 0.6, 1.0], [0.1, 0, 0], 0.12), '#8f897d', 0.2);            // bigode
  P(put(new THREE.TorusGeometry(2.25, 0.42, 10, 40).deleteAttribute('uv'), 0, 24.2, -0.9, Math.PI / 2 + 0.1, 0, 0), '#8a8479', 0.4); // aro da coroa
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, x = Math.sin(a) * 2.25, z = -0.9 + Math.cos(a) * 2.25, h = k % 2 ? 1.6 : 2.6; S.push(paint(horn(rng, [[x, 24.2, z], [x * 1.12, 24.2 + h * 0.6, z + Math.cos(a) * 0.2], [x * 1.2, 24.2 + h, z + Math.cos(a) * 0.3]], 0.42, 0.05), '#8a8479', moss, 0.3, seed)); }
  // braço direito apoiado no braço do trono
  P(blob(rng, [5.5, 19.0, -2.2], [2.3, 2.1, 2.3]));
  for (let k = 0; k < 3; k++) P(plate(rng, 4.4 - k * 0.5, 1.9, 4.2, [6.1 + k * 0.3, 20.0 - k * 1.2, -2.2], [0, 0, -0.5 - k * 0.12], 0.35), armor);
  P(limb(rng, [5.7, 18.6, -2.1], [7.6, 11.6, -2.0], 1.6, 1.35)); P(blob(rng, [7.6, 11.4, -1.9], [1.5, 1.5, 1.5]));
  P(limb(rng, [7.6, 11.4, -1.9], [7.9, 11.0, 4.3], 1.35, 1.0)); P(plate(rng, 2.4, 3.8, 0.6, [7.8, 12.4, 1.2], [-Math.PI / 2, 0, 0], 0.5), armor);
  P(blob(rng, [8.0, 11.2, 5.4], [1.4, 1.0, 1.7]), armor); for (let f = 0; f < 4; f++) P(limb(rng, [7.4 + f * 0.4, 11.0, 6.3], [7.3 + f * 0.42, 9.9, 7.0], 0.3, 0.25, { bulge: 0.05 }), armor); // dedos sobre a borda
  // braço esquerdo segura o machado em pé, ao lado do trono
  P(blob(rng, [-5.5, 19.0, -2.2], [2.3, 2.1, 2.3]));
  for (let k = 0; k < 3; k++) P(plate(rng, 4.4 - k * 0.5, 1.9, 4.2, [-6.1 - k * 0.3, 20.0 - k * 1.2, -2.2], [0, 0, 0.5 + k * 0.12], 0.35), armor);
  P(limb(rng, [-5.7, 18.6, -2.1], [-8.9, 13.6, 0.2], 1.6, 1.35)); P(blob(rng, [-8.9, 13.6, 0.2], [1.5, 1.5, 1.5]));
  P(limb(rng, [-8.9, 13.6, 0.2], [-10.6, 15.6, 3.6], 1.35, 1.05)); P(blob(rng, [-10.9, 15.7, 4.0], [1.4, 1.7, 1.4]), armor);
  // machado de duas lâminas (haste cravada no chão)
  P(limb(rng, [-11.0, -0.5, 4.2], [-11.0, 27.2, 4.0], 0.55, 0.5, { bulge: 0.02 }), '#6f6a62', 0.3);
  for (const y of [5, 9, 13, 17.5]) P(put(new THREE.TorusGeometry(0.62, 0.14, 8, 20).deleteAttribute('uv'), -11.0, y, 4.15, Math.PI / 2, 0, 0), '#77726a', 0.1);
  { const sh = new THREE.Shape(); sh.moveTo(0.3, -2.4); sh.quadraticCurveTo(3.4, -3.4, 5.6, -5.6); sh.quadraticCurveTo(4.2, 0, 5.6, 5.6); sh.quadraticCurveTo(3.4, 3.4, 0.3, 2.4); sh.lineTo(0.3, -2.4);
    for (const sx of [-1, 1]) { const ax = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 3, curveSegments: 20 }); ax.deleteAttribute('uv'); ax.translate(0, 0, -0.25); if (sx < 0) ax.rotateY(Math.PI); P(put(ax, -11.0, 23.6, 4.1, 0, Math.PI / 2, 0), '#8b8780', 0.1); R.push(runeRing(1.2, [-11.0 + 0, 23.6, 4.1 + sx * 3.3], [0, Math.PI / 2, 0], 10)); } }
  P(blob(rng, [-11.0, 27.6, 4.0], [0.9, 1.2, 0.9]), '#77726a');
  rubble(rng, S, 9, 0, 6, 26, throneC, 1.1);
  const g = colossusMesh(S, R, [[-0.75, 22.6, 1.45, 0.42, 0.14, 0.18], [0.75, 22.6, 1.45, 0.42, 0.14, 0.18]]);
  g.userData.cols = [[0, -0.8, 9], [-11, 4.1, 0.9], [-3.5, 9, 1.6], [3.5, 9, 1.6]];
  return g;
}

/* ---------- 3. Fera de Pedra (≈ 34 m de comprimento): agachada, cabeça baixa, chifres enormes e placas ao longo da espinha ---------- */
export function makeStoneBeast(seed = 67) {
  const rng = rngOf(seed), S = [], R = [], base = '#9c968a', armor = '#857f74', moss = '#5d7a3a';
  const P = (g, c = base, m = 0.65) => S.push(paint(g, c, moss, m, seed));
  P(blob(rng, [0, 9.2, -0.5], [6.2, 5.6, 9.2], [0, 0, 0], 0.08));   // corpo
  P(blob(rng, [0, 8.6, -7.6], [5.6, 5.2, 5.0], [0, 0, 0], 0.08));   // anca
  P(blob(rng, [0, 9.8, 6.6], [5.4, 5.8, 4.6], [0.2, 0, 0], 0.08));   // peito
  for (let k = 0; k < 11; k++) { const z = -11 + k * 2.1, y = 14.2 + Math.sin((k / 10) * Math.PI) * 1.4; P(plate(rng, 6.4 - Math.abs(k - 5) * 0.3, 0.8, 3.0, [0, y, z], [-0.25, 0, 0], 0.9), armor); if (k % 2 === 0) S.push(paint(horn(rng, [[0, y + 0.3, z], [0, y + 2.2, z - 0.8], [0, y + 3.4, z - 2.0]], 0.6, 0.05), armor, moss, 0.2, seed)); }
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) P(plate(rng, 4.2, 3.6, 0.7, [sx * 5.7, 9.6, -6 + k * 3.8], [0, sx * Math.PI / 2, sx * 0.25], 0.25), armor); // placas dos flancos
  for (const sx of [-1, 1]) {
    // patas da frente, dobradas, garras no chão
    P(limb(rng, [sx * 4.4, 8.8, 7.0], [sx * 5.1, 3.6, 9.4], 2.3, 1.9, { bulge: 0.18 })); P(blob(rng, [sx * 5.1, 3.6, 9.4], [1.9, 1.9, 1.9]));
    P(limb(rng, [sx * 5.1, 3.6, 9.4], [sx * 4.9, 1.3, 12.6], 1.8, 1.5)); P(blob(rng, [sx * 4.9, 1.0, 13.4], [2.1, 1.1, 2.4]));
    for (let f = 0; f < 4; f++) S.push(paint(horn(rng, [[sx * 4.9 + (f - 1.5) * 0.9, 1.1, 14.6], [sx * 4.9 + (f - 1.5) * 1.0, 0.7, 15.8], [sx * 4.9 + (f - 1.5) * 1.05, -0.1, 16.4]], 0.42, 0.04), '#77726a', moss, 0.1, seed));
    // patas de trás dobradas (sentada)
    P(limb(rng, [sx * 4.7, 7.4, -7.4], [sx * 5.5, 3.0, -2.6], 2.6, 2.0, { bulge: 0.2 })); P(blob(rng, [sx * 5.5, 3.0, -2.6], [2.0, 2.0, 2.0]));
    P(limb(rng, [sx * 5.5, 3.0, -2.6], [sx * 5.0, 1.3, -9.8], 1.7, 1.4)); P(blob(rng, [sx * 4.9, 0.9, -5.2], [1.9, 0.9, 2.2]));
  }
  // pescoço com juba de placas, cabeça baixa
  P(limb(rng, [0, 11.4, 8.0], [0, 10.4, 12.8], 3.3, 2.6, { bulge: 0.08 }));
  for (let k = 0; k < 10; k++) { const a = -1.6 + k * 0.36; P(plate(rng, 2.0, 3.6, 0.5, [Math.sin(a) * 3.8, 11.6 + Math.cos(a) * 2.6, 10.6], [0.6, 0, -a], 0.3), armor, 0.4); } // juba
  P(blob(rng, [0, 9.2, 15.2], [3.0, 2.7, 4.0], [0.2, 0, 0], 0.05));   // crânio alongado
  P(blob(rng, [0, 7.0, 18.4], [2.1, 1.7, 2.6], [0.35, 0, 0], 0.05));   // focinho
  P(blob(rng, [0, 5.4, 17.0], [1.9, 0.8, 2.6], [0.45, 0, 0], 0.06));   // mandíbula entreaberta
  P(plate(rng, 2.8, 7.6, 0.9, [0, 10.2, 17.5], [-1.05, 0, 0], 0.6), armor); R.push(runeLine(rng, [0, 10.6, 17.75], 4.6, [-1.05, 0, 0], 0.16)); // máscara de pedra sobre a cara
  for (const sx of [-1, 1]) { P(plate(rng, 2.2, 3.6, 0.6, [sx * 2.4, 8.4, 16.4], [0.2, sx * 0.9, 0], 0.5), armor); P(blob(rng, [sx * 2.0, 10.75, 17.4], [1.2, 0.5, 1.2], [0, sx * 0.5, sx * -0.35], 0.06)); } // bochechas e sobrancelhas
  for (const sx of [-1, 1]) {
    for (const k of [0, 1]) S.push(paint(horn(rng, [[sx * (0.8 + k * 0.7), 6.2, 19.4 - k * 1.1], [sx * (0.85 + k * 0.7), 5.2, 19.6 - k * 1.1], [sx * (0.9 + k * 0.7), 4.5, 19.5 - k * 1.1]], 0.3, 0.03), '#c9c2b0', moss, 0, seed)); // presas
    S.push(paint(horn(rng, [[sx * 2.4, 11.2, 14.4], [sx * 5.2, 12.4, 13.4], [sx * 7.2, 14.8, 15.0], [sx * 7.0, 17.4, 17.6], [sx * 5.8, 18.6, 19.2]], 1.15, 0.08), '#8a8479', moss, 0.25, seed)); // chifres
    P(blob(rng, [sx * 2.9, 12.0, 13.0], [1.1, 1.6, 0.6], [0, 0, sx * 0.4]));   // orelha
  }
  // cauda pesada deitada no chão, terminando em maça de espigões
  { const pts = [[0, 7.5, -11.6], [2.0, 4.2, -15.5], [5.0, 1.6, -18.0], [9.0, 1.0, -17.4], [11.5, 1.1, -14.2]]; S.push(paint(horn(rng, pts, 1.9, 0.9), base, moss, 0.7, seed)); P(blob(rng, [11.8, 1.2, -13.6], [1.6, 1.5, 1.6])); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; S.push(paint(horn(rng, [[11.8, 1.2, -13.6], [11.8 + Math.cos(a) * 1.6, 1.2 + Math.sin(a) * 1.4, -13.2], [11.8 + Math.cos(a) * 2.6, 1.2 + Math.sin(a) * 2.2, -13.0]], 0.45, 0.04), '#77726a', moss, 0.1, seed)); } }
  for (const sx of [-1, 1]) R.push(runeLine(rng, [sx * 6.4, 9.6, 0], 6, [0, sx * Math.PI / 2, Math.PI / 2], 0.2));
  rubble(rng, S, 8, 0, 4, 30, armor, 1.2);
  const g = colossusMesh(S, R, [[-1.95, 10.05, 17.95, 0.5, 0.2, 0.3, 0.1, -0.5], [1.95, 10.05, 17.95, 0.5, 0.2, 0.3, 0.1, 0.5]]);
  g.userData.cols = [[0, 0, 6.5], [0, -8, 5.5], [0, 8, 5], [0, 15, 3.2], [-4.9, 13.4, 2], [4.9, 13.4, 2], [8, -17, 2]];
  return g;
}

/* ---------- 4. Titã Caído (≈ 24 m de braço): meio enterrado de costas, um braço erguido para o céu, a mão aberta ---------- */
export function makeFallenTitan(seed = 79) {
  const rng = rngOf(seed), S = [], R = [], base = '#a39d90', armor = '#8b857a', moss = '#5a7a36';
  const P = (g, c = base, m = 0.95) => S.push(paint(g, c, moss, m, seed));
  P(blob(rng, [0, 0.4, 0], [6.4, 4.4, 5.4], [0, 0, 0], 0.08));                  // peito (metade enterrada)
  for (let k = 0; k < 4; k++) P(plate(rng, 9.5 - k * 0.6, 1.6, 0.8, [-2 + k * 2.4, 3.6 - k * 0.3, 0], [-Math.PI / 2, 0, Math.PI / 2], 0.6), armor); // couraça para cima
  R.push(runeLine(rng, [0.5, 4.6, 0], 7, [-Math.PI / 2, 0, Math.PI / 2], 0.2));
  P(blob(rng, [8.6, 0.0, 0.4], [4.6, 3.0, 4.2], [0, 0, 0], 0.08));              // quadril
  P(limb(rng, [10.5, 0.6, -2.2], [15.4, 3.6, -3.4], 2.4, 2.0)); P(blob(rng, [15.6, 3.7, -3.4], [2.2, 2.2, 2.2])); P(plate(rng, 2.6, 2.4, 0.8, [15.9, 5.2, -3.4], [-Math.PI / 2 + 0.3, 0, 0], 0.6), armor); // joelho dobrado saindo da terra
  P(limb(rng, [15.6, 3.7, -3.4], [20.4, 0.0, -3.0], 1.9, 1.5));
  P(limb(rng, [10.6, 0.2, 2.6], [20.0, -0.4, 3.6], 2.3, 1.7)); P(blob(rng, [21.4, 1.0, 3.8], [1.4, 2.4, 1.9], [0, 0, -0.3]), armor); // perna esticada, pé apontando para cima
  // cabeça virada de lado, elmo com crista no chão
  P(limb(rng, [-5.2, 0.6, 0], [-7.6, 0.8, 0.4], 1.8, 1.6));
  P(blob(rng, [-9.6, 1.2, 0.6], [2.6, 2.8, 3.0], [0, 0, 0.3], 0.04), armor);
  P(plate(rng, 3.8, 3.2, 0.8, [-9.8, 1.8, 3.2], [0.1, 0.2, 0.3], 0.55), armor);
  P(plate(rng, 0.6, 2.6, 5.4, [-12.0, 1.8, 0.4], [0, 0, 1.5], 0.25), armor);
  // braço esquerdo largado no chão, quebrado
  P(limb(rng, [-1.8, 0.8, -4.6], [-1.0, 0.4, -11.6], 1.8, 1.5)); P(blob(rng, [-0.8, 0.6, -12.2], [1.7, 1.4, 1.7])); rubble(rng, S, 6, -1, -15, 6, armor, 0.9);
  // braço direito erguido: ombro → cotovelo → mão aberta lá no alto
  P(blob(rng, [-1.6, 2.4, 5.0], [2.4, 2.4, 2.4]));
  for (let k = 0; k < 3; k++) P(plate(rng, 4.4 - k * 0.5, 1.8, 4.0, [-1.6, 3.4 + k * 0.4, 5.6 + k * 0.9], [1.2 + k * 0.15, 0, 0], 0.35), armor);
  P(limb(rng, [-1.6, 2.4, 5.2], [-0.6, 11.6, 7.8], 1.8, 1.5)); P(blob(rng, [-0.6, 11.6, 7.8], [1.6, 1.6, 1.6]));
  P(limb(rng, [-0.6, 11.6, 7.8], [0.4, 19.6, 6.6], 1.5, 1.15)); P(plate(rng, 2.6, 4.6, 0.6, [-0.1, 15.6, 8.6], [0.1, 0, 0], 0.5), armor); R.push(runeLine(rng, [-0.1, 15.6, 8.95], 3.4, [0.1, 0, 0], 0.16));
  P(blob(rng, [0.6, 21.2, 6.5], [1.9, 2.1, 0.95], [0.1, 0.2, 0], 0.05));      // palma
  for (let f = 0; f < 4; f++) { const x = -0.5 + f * 0.72, sp = (f - 1.5) * 0.18; P(limb(rng, [x, 22.8, 6.5], [x + sp * 2.4, 25.4 - Math.abs(f - 1.5) * 0.4, 6.3], 0.38, 0.33, { bulge: 0.05 })); P(blob(rng, [x + sp * 2.4, 25.4 - Math.abs(f - 1.5) * 0.4, 6.3], [0.36, 0.36, 0.36])); P(blob(rng, [x + sp * 3.0, 26.5 - Math.abs(f - 1.5) * 0.5, 7.0], [0.3, 0.3, 0.3])); P(limb(rng, [x + sp * 2.4, 25.4 - Math.abs(f - 1.5) * 0.4, 6.3], [x + sp * 3.0, 26.5 - Math.abs(f - 1.5) * 0.5, 7.0], 0.33, 0.29, { bulge: 0.04 })); P(limb(rng, [x + sp * 3.0, 26.5 - Math.abs(f - 1.5) * 0.5, 7.0], [x + sp * 3.2, 26.9 - Math.abs(f - 1.5) * 0.5, 8.0], 0.29, 0.22, { bulge: 0.03 })); } // dedos curvos, como quem tenta agarrar o céu
  P(limb(rng, [-0.8, 21.0, 6.8], [-2.4, 22.6, 7.2], 0.45, 0.36)); // polegar
  // espada partida caída ao lado
  { P(put(blade(2.6, 12, 0.6, 1.2), 6, 0.35, 9.5, Math.PI / 2, 0.4, 0), '#8d8a84', 0.4); P(limb(rng, [3.2, 0.5, 4.2], [8.6, 0.5, 2.0], 0.5, 0.5), '#7d786e', 0.4); }
  rubble(rng, S, 12, 4, 0, 34, base, 1.0);
  const g = colossusMesh(S, R, [[-9.8, 1.4, 0.2, 0.5, 0.18, 0.14, 0.1, 0.2]]);
  g.userData.cols = [[0, 0, 6], [8.6, 0.4, 4.2], [-9.6, 0.6, 3], [15.5, -3.4, 2.4], [-0.8, 7, 2], [16, 3.5, 2]];
  return g;
}

/* ---------- 5. Guerreiro Sem Cabeça (≈ 27 m): manto de pedra rasgado, lança partida na mão; a cabeça caiu a seus pés ---------- */
export function makeHeadless(seed = 97) {
  const rng = rngOf(seed), S = [], R = [], base = '#9f998c', armor = '#88827a', moss = '#5d7a3a';
  const P = (g, c = base, m = 0.6) => S.push(paint(g, c, moss, m, seed));
  const leg = (sx, fz) => {
    P(blob(rng, [sx * 3.6, 0.8, fz + 1.2], [1.5, 0.9, 2.5]), armor);
    P(limb(rng, [sx * 3.6, 1.2, fz], [sx * 3.2, 8.0, fz * 0.6], 1.2, 1.55, { bulge: 0.16 })); P(plate(rng, 2.3, 5.4, 0.6, [sx * 3.4, 4.7, fz * 0.8 + 1.5], [-0.05 + fz * 0.03, 0, 0], 0.5), armor);
    P(blob(rng, [sx * 3.2, 8.2, fz * 0.6 + 0.3], [1.75, 1.7, 1.75]));
    P(limb(rng, [sx * 3.2, 8.2, fz * 0.6], [sx * 2.5, 14.3, 0], 1.75, 2.3, { bulge: 0.14 }));
  };
  leg(-1, 2.2); leg(1, -1.4);
  P(blob(rng, [0, 14.8, 0], [4.2, 2.4, 2.9]));
  for (let k = 0; k < 7; k++) { const a = -1.7 + k * 0.57; P(plate(rng, 2.2, 4.4, 0.45, [Math.sin(a) * 4.0, 13.0, Math.cos(a) * 3.0], [-0.15, a, 0], 0.3), armor); }
  P(blob(rng, [0, 18.0, 0.1], [3.5, 2.8, 2.6]));
  P(blob(rng, [0, 21.4, 0.1], [5.0, 3.4, 3.1]));
  for (const sx of [-1, 1]) P(plate(rng, 4.0, 4.8, 0.7, [sx * 2.1, 21.4, 2.75], [-0.1, sx * 0.38, 0], 0.4), armor);
  for (let k = 0; k < 4; k++) P(plate(rng, 5.8 - k * 0.2, 1.0, 0.5, [0, 16.8 + k * 1.0, 2.4 + k * 0.1], [-0.08, 0, 0], 0.4), armor);
  // pescoço partido: a pedra quebrada mostra um brilho por dentro
  P(limb(rng, [0, 23.8, 0.1], [0, 25.2, 0.2], 1.55, 1.4, { amt: 0.12 }));
  P(blob(rng, [0, 25.3, 0.2], [1.5, 0.45, 1.4], [0, 0, 0], 0.35), '#6c675e', 0.2);
  R.push(blob(rng, [0, 25.45, 0.2], [0.9, 0.18, 0.8], [0, 0, 0], 0.2));
  for (const sx of [-1, 1]) { P(blob(rng, [sx * 5.0, 23.6, 0.1], [2.1, 2.0, 2.1])); for (let k = 0; k < 2; k++) P(plate(rng, 4.0 - k * 0.5, 1.8, 3.8, [sx * (5.6 + k * 0.3), 24.6 - k * 1.2, 0.1], [0, 0, sx * (-0.5 - k * 0.15)], 0.35), armor); }
  // manto de pedra caindo das costas até o chão, com dobras e barra rasgada
  { const W = 11, H = 23.5, cl = new THREE.BoxGeometry(W, H, 0.7, 30, 30, 1), Pc = cl.attributes.position;
    for (let i = 0; i < Pc.count; i++) { const x = Pc.getX(i), y = Pc.getY(i), z = Pc.getZ(i), t = (H / 2 - y) / H; // t: 0 em cima, 1 embaixo
      const fold = Math.sin(x * 1.25 + t * 1.5) * (0.25 + t * 0.9), flare = 1 + t * 0.45, torn = t > 0.88 ? Math.max(0, Math.sin(x * 3.1 + 1) * 0.5 + Math.sin(x * 7.3) * 0.3) * 2.6 : 0;
      Pc.setXYZ(i, x * flare, y + torn, z - fold - t * t * 4.2 - (1 - Math.pow(x / (W / 2), 2)) * 0.6); }
    cl.deleteAttribute('uv'); cl.computeVertexNormals(); P(put(cl, 0, 24.6 - H / 2 + 0.1, -3.2), '#958f83', 0.5); }
  // braço direito segura a lança partida, em pé
  P(limb(rng, [5.2, 23.2, 0.2], [6.9, 17.4, 1.4], 1.5, 1.3)); P(blob(rng, [6.9, 17.4, 1.4], [1.4, 1.4, 1.4]));
  P(limb(rng, [6.9, 17.4, 1.4], [7.4, 13.4, 3.6], 1.3, 1.0)); P(plate(rng, 2.2, 3.4, 0.55, [7.6, 15.4, 2.9], [-0.5, 0, 0.1], 0.5), armor);
  P(blob(rng, [7.6, 13.0, 4.0], [1.3, 1.6, 1.3]), armor);
  P(limb(rng, [7.6, -0.5, 4.2], [7.7, 21.5, 4.0], 0.5, 0.45, { bulge: 0.02 }), '#6f6a62', 0.3);
  P(blob(rng, [7.7, 21.7, 4.0], [0.55, 0.6, 0.55], [0.4, 0, 0.6], 0.4), '#6f6a62', 0.2); // ponta lascada
  { const head = new THREE.ConeGeometry(1.1, 4.4, 4, 4); head.deleteAttribute('uv'); P(put(head, -6.5, 0.45, 9.6, Math.PI / 2, 0.8, 0), '#8d8a84', 0.4); P(limb(rng, [-5.4, 0.4, 7.9], [-3.6, 0.4, 5.5], 0.48, 0.45), '#6f6a62', 0.5); } // ponta da lança caída
  // braço esquerdo partido no cotovelo; o antebraço está no chão
  P(limb(rng, [-5.2, 23.2, 0.2], [-6.3, 18.0, -0.3], 1.5, 1.35)); P(blob(rng, [-6.3, 17.8, -0.3], [1.35, 0.9, 1.35], [0, 0, 0], 0.35), '#6c675e', 0.3);
  P(limb(rng, [-9.0, 0.9, -5.0], [-11.6, 0.9, -1.4], 1.3, 1.0)); P(blob(rng, [-12.0, 0.9, -0.8], [1.3, 1.0, 1.6]), armor);
  // a cabeça caída de lado, olhando para quem chega (os olhos ainda brilham)
  const hx = -5.6, hz = 9.0;
  P(blob(rng, [hx, 2.1, hz], [2.3, 2.6, 2.4], [0, 0.6, 1.35], 0.04), armor);
  P(plate(rng, 3.8, 3.0, 0.8, [hx - 0.4, 2.4, hz + 2.0], [0.2, 0.6, 1.35], 0.55), armor);
  S.push(paint(horn(rng, [[hx + 0.6, 3.6, hz - 0.8], [hx + 1.6, 5.6, hz - 1.6], [hx + 1.0, 7.4, hz - 3.0]], 0.7, 0.08), armor, moss, 0.3, seed));
  rubble(rng, S, 9, 0, 3, 24, armor, 1.0);
  const g = colossusMesh(S, R, [[hx - 0.2, 2.9, hz + 2.45, 0.45, 0.15, 0.18, 0.2, 0.6], [hx - 0.75, 1.75, hz + 2.2, 0.45, 0.15, 0.18, 0.2, 0.6]]);
  g.userData.cols = [[-3.6, 2.2, 2.2], [3.6, -1.4, 2.2], [0, -4.5, 3.5], [7.6, 4.1, 0.9], [hx, hz, 2.8], [-10.5, -3, 1.6]];
  return g;
}

/* ---------- névoa baixa (clima de mistério): planos macios que sempre olham para a câmera e derivam devagar ---------- */
let mistTex = null;
export function makeMist(heightAt, cx, cz, radius, count = 26, seed = 5, color = '#d8dde0') {
  if (!mistTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); mistTex = new THREE.CanvasTexture(cv); }
  const rng = rngOf(seed), g = new THREE.Group(), items = [];
  const m = new THREE.MeshBasicMaterial({ map: mistTex, color, transparent: true, opacity: 0.16, depthWrite: false, fog: true });
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let k = 0; k < count; k++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = 26 + rng() * 30;
    const p = new THREE.Mesh(geo, m); p.scale.set(s, s * 0.32, 1); p.position.set(x, heightAt(x, z) + s * 0.08, z); p.renderOrder = 2; p.frustumCulled = true;
    p.onBeforeRender = (r2, sc, cam) => { p.quaternion.copy(cam.quaternion); };
    g.add(p); items.push({ p, x, z, ph: rng() * 6, sp: 0.5 + rng() });
  }
  g.userData.update = t => { for (const it of items) { it.p.position.x = it.x + Math.sin(t * 0.03 * it.sp + it.ph) * 9; it.p.position.z = it.z + Math.cos(t * 0.025 * it.sp + it.ph) * 7; } };
  return g;
}

/* =========================================================================
   RUÍNAS DOS COLOSSOS (S-161): a planície era uma cidade antiga. Calçada de lajes
   rachadas, colunatas quebradas, tambores de coluna caídos, muros desabados,
   pedestais vazios e montes de escombros — terra arrasada em volta dos gigantes.
   buildRuins(ctx) coloca tudo em grupos (um por região) com poucas malhas.
   ctx: { scene, placed, colliders, occluders, heightAt, roadDist }
   ========================================================================= */
const RUIN_STONE = '#a29b8d', RUIN_DARK = '#8a8478', RUIN_MOSS = '#5d6e3a';
function slab(rng, w, d, t) { // laje irregular, cantos gastos
  const g = stoneBlock(rng, w, t, d); return g;
}
// bloco de pedra lavrada, pintado (cor por vértice)
function carved(rng, w, h, d, base = RUIN_STONE, moss = 0.35) { return paint(stoneBlock(rng, w, h, d), base, RUIN_MOSS, moss, Math.floor(rng() * 99)); }
// coluna com base, fuste (em tambores) e capitel; broken = parte de cima quebrada
function ruinColumn(rng, parts, x, y, z, r, h, broken, fallen) {
  parts.push(paint(put(stoneBlock(rng, r * 2.9, r * 0.9, r * 2.9), x, y + r * 0.35, z, 0, rng() * 0.1), RUIN_DARK, RUIN_MOSS, 0.5, 3));       // plinto
  parts.push(paint(put(new THREE.CylinderGeometry(r * 1.15, r * 1.3, r * 0.5, 22).deleteAttribute('uv'), x, y + r * 0.95, z), RUIN_STONE, RUIN_MOSS, 0.5, 4)); // toro da base
  const drums = Math.max(1, Math.round(h / (r * 2.2))), dh = h / drums;
  for (let k = 0; k < drums; k++) {
    const last = k === drums - 1, g = column(rng, r, dh * 0.995, last && broken ? Math.min(dh * 0.8, broken) : 0);
    parts.push(paint(put(g, x, y + r * 1.2 + k * dh, z, 0, rng() * 6, 0), k % 2 ? RUIN_STONE : '#9c9588', RUIN_MOSS, 0.4, 5 + k));
  }
  if (!broken) { parts.push(paint(put(stoneBlock(rng, r * 2.6, r * 0.7, r * 2.6), x, y + r * 1.2 + h + r * 0.35, z), RUIN_STONE, RUIN_MOSS, 0.6, 7)); }
  // tambores caídos ao lado (a parte que desabou)
  for (let k = 0; k < fallen; k++) {
    const a = rng() * Math.PI * 2, d = r * (2.2 + k * 2.3 + rng()), L = r * 2 * (0.8 + rng() * 0.5), g = column(rng, r * 0.98, L, rng() < 0.5 ? r * 0.6 : 0);
    g.translate(0, -L / 2, 0); g.rotateZ(Math.PI / 2 + (rng() - 0.5) * 0.2); g.rotateY(a + Math.PI / 2 + (rng() - 0.5) * 0.8);
    parts.push(paint(put(g, x + Math.cos(a) * d, y + r * 0.82, z + Math.sin(a) * d), '#9a9385', RUIN_MOSS, 0.6, 9 + k));
  }
}
// muro desabado: fileiras de blocos grandes com topo em degraus quebrados e blocos caídos na frente
function ruinWall(rng, parts, x, y, z, ry, len, h, heightAt) {
  const cs = Math.cos(ry), sn = Math.sin(ry); let yy = 0, row = 0;
  const top = u => h * (0.25 + 0.75 * Math.abs(Math.sin(u * 1.3 + rng() * 0.2)) * (0.6 + 0.4 * Math.sin(u * 0.4 + 1)));
  while (yy < h) {
    const bh = 0.55 + rng() * 0.25; let u = -len / 2 + (row % 2 ? 0.45 : 0);
    while (u < len / 2) {
      const bw = Math.min(0.9 + rng() * 0.8, len / 2 - u); if (bw < 0.3) break;
      const cu = u + bw / 2; u += bw;
      if (yy + bh > top(cu) || rng() < 0.05) continue; // borda quebrada e um ou outro bloco faltando
      const wx = x + cu * cs, wz = z - cu * sn, gy = heightAt ? heightAt(wx, wz) - y : 0;
      const g = stoneBlock(rng, bw - 0.05, bh - 0.04, 0.9 * (0.9 + rng() * 0.2)); g.rotateY(ry + (rng() - 0.5) * 0.04); g.translate(wx - x, gy + yy + bh / 2 - 0.2, wz - z);
      parts.push(paint(g, rng() < 0.3 ? RUIN_DARK : RUIN_STONE, RUIN_MOSS, 0.45, row * 7 + Math.floor(cu)));
    }
    yy += bh; row++;
  }
  for (let k = 0; k < Math.round(len * 0.9); k++) { // blocos caídos na frente e atrás
    const u = (rng() - 0.5) * len, side = (rng() < 0.6 ? 1 : -1) * (0.9 + rng() * 2.4), wx = x + u * cs + side * sn, wz = z - u * sn + side * cs, s = 0.4 + rng() * 0.5;
    const g = stoneBlock(rng, s * 1.6, s, s * 1.1); g.rotateX(rng() * 0.6); g.rotateY(rng() * 6); g.rotateZ(rng() * 0.6);
    g.translate(wx - x, (heightAt ? heightAt(wx, wz) - y : 0) + s * 0.35, wz - z); parts.push(paint(g, RUIN_STONE, RUIN_MOSS, 0.5, k));
  }
}
// monte de escombros: lascas, blocos lavrados e pedaços de estátua
function debrisPile(rng, parts, x, y, z, R, n, heightAt, x0, z0) {
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, d = Math.pow(rng(), 0.7) * R, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, s = (0.25 + rng() * 0.7) * (1.2 - d / R * 0.6);
    const gy = heightAt ? heightAt(px, pz) - y : 0, kind = rng();
    let g;
    if (kind < 0.45) g = chunk(rng, s * 1.3, s * 0.7, s);
    else if (kind < 0.8) g = stoneBlock(rng, s * 1.8, s * 0.9, s * 1.2);
    else g = column(rng, s * 0.6, s * 2.2, s * 0.6);
    g.rotateX((rng() - 0.5) * 1.2); g.rotateY(rng() * 6.28); g.rotateZ((rng() - 0.5) * 1.2);
    g.translate(px - x0, gy + (y - (heightAt ? heightAt(x0, z0) : 0)) + s * 0.3 - (1 - d / R) * 0.0, pz - z0);
    parts.push(paint(g, rng() < 0.4 ? RUIN_DARK : RUIN_STONE, RUIN_MOSS, 0.5, k));
  }
}
export function buildRuins(ctx) {
  const { scene, placed, colliders, occluders, heightAt, roadDist } = ctx, rng = rngOf(1717), groups = [];
  // obstáculos (estátuas, monólitos, arcos, cabeça, acampamento, santuário)
  const avoid = [[-50, -310, 15], [78, -340, 17], [-78, -352, 18], [100, -275, 22], [-96, -246, 14], [46, -252, 9], [0, -262, 7], [0, -338, 7], [0, -212, 16], [0, -392, 34]];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.2; avoid.push([Math.cos(a) * 24, -300 + Math.sin(a) * 24, 3]); }
  for (let k = 0; k < 6; k++) avoid.push([(k % 2 ? 1 : -1) * (40 + k * 17), -230 - k * 26, 3]);
  const free = (x, z, r) => avoid.every(([ax, az, ar]) => Math.hypot(x - ax, z - az) > ar + r);
  const cluster = (cx, cz, fill, asset = 'ruinas') => {
    const y0 = heightAt(cx, cz), parts = [], cols = []; fill(parts, y0, cols);
    if (!parts.length) return;
    const m = mesh(parts), g = new THREE.Group(); g.add(m); g.position.set(cx, y0, cz); scene.add(g);
    g.userData.asset = asset; placed.push(g); groups.push(g);
    for (const c of cols) colliders.push({ x: c[0], z: c[1], r: c[2], name: asset });
  };
  // 1) calçada antiga: lajes rachadas e soltas ao longo da estrada até o Santuário (com falhas onde a terra tomou conta)
  for (let z0 = -228; z0 > -372; z0 -= 18) cluster(0, z0 - 9, (parts, y0) => {
    for (let z = z0; z > z0 - 18; z -= 1.25) for (let x = -5.6; x <= 5.6; x += 1.4) {
      const px = x + (rng() - 0.5) * 0.15, pz = z + (rng() - 0.5) * 0.15; if (rng() < 0.16 + Math.abs(x) * 0.05) continue; // falhas e bordas comidas
      const w = 1.3 + (rng() - 0.5) * 0.2, d = 1.15 + (rng() - 0.5) * 0.2, t = 0.18;
      const g = slab(rng, w, d, t); g.rotateY((rng() - 0.5) * 0.12); g.rotateX((rng() - 0.5) * 0.06); g.rotateZ((rng() - 0.5) * 0.06);
      g.translate(px, heightAt(px, pz) - y0 + 0.02 + (rng() < 0.12 ? 0.08 : 0), pz - (z0 - 9)); parts.push(paint(g, rng() < 0.3 ? '#8f897c' : '#a7a092', RUIN_MOSS, 0.25, Math.floor(rng() * 50)));
    }
  }, 'calcada_antiga');
  // 2) colunatas quebradas dos dois lados da calçada
  for (let z = -240; z > -382; z -= 13) for (const sx of [-1, 1]) {
    const x = sx * (9.5 + rng() * 0.6); if (!free(x, z, 2.5)) continue;
    const intact = rng() < 0.18, h = intact ? 9 : 2.5 + rng() * 6;
    cluster(x, z, (parts, y0, cols) => { ruinColumn(rng, parts, 0, 0, 0, 0.75, h, intact ? 0 : 0.6 + rng() * 0.9, intact ? 0 : 1 + Math.floor(rng() * 3)); cols.push([x, z, 1.1]); }, 'coluna_quebrada');
  }
  // 3) muros desabados de casas e templos antigos, espalhados pela planície
  const walls = [[-30, -268, 0.3, 11, 3.6], [-36, -276, 1.85, 7, 2.6], [32, -298, -0.4, 13, 4.2], [26, -306, 1.2, 6, 2.2], [-120, -300, 0.9, 14, 4.6], [-112, -308, 2.4, 9, 3], [128, -318, -0.2, 12, 3.8], [60, -372, 0.6, 15, 5], [-40, -372, -0.7, 10, 3.4], [-140, -262, 1.4, 9, 3], [140, -250, 0.1, 10, 3.2], [-64, -214, 0.5, 8, 2.6], [70, -222, -0.9, 9, 2.8], [-150, -346, 0.4, 12, 4]];
  for (const [x, z, ry, len, h] of walls) { if (!free(x, z, len / 2)) continue; cluster(x, z, (parts, y0, cols) => { ruinWall(rng, parts, 0, 0, 0, ry, len, h, (wx, wz) => heightAt(x + wx, z + wz) - y0); const cs = Math.cos(ry), sn = Math.sin(ry); for (let u = -len / 2 + 1; u <= len / 2 - 1; u += 2) cols.push([x + u * cs, z - u * sn, 1.1]); }, 'muro_desabado'); }
  // 4) colunas gigantes tombadas (o que sobrou de um templo enorme)
  for (const [x, z, ry] of [[-22, -330, 0.4], [40, -330, -1.1], [-110, -330, 2.2], [118, -300, 0.7]]) { if (!free(x, z, 7)) continue;
    cluster(x, z, (parts, y0, cols) => { const R = 1.5, cs = Math.cos(ry), sn = Math.sin(ry); let u = -8;
      for (let k = 0; k < 4; k++) { const L = 3.2 + rng() * 1.2, g = column(rng, R, L, k === 3 ? 1.2 : 0); g.translate(0, -L / 2, 0); g.rotateZ(Math.PI / 2); g.rotateY(ry + (rng() - 0.5) * 0.25); const px = u * cs + (rng() - 0.5) * 0.6, pz = -u * sn; g.translate(px, heightAt(x + px, z + pz) - y0 + R * 0.85, pz); parts.push(paint(g, k % 2 ? RUIN_STONE : '#9c9588', RUIN_MOSS, 0.55, k)); cols.push([x + px, z + pz, R + 0.3]); u += L + 0.4 + rng() * 1.2; }
      const cap = stoneBlock(rng, R * 2.8, R * 0.9, R * 2.8); cap.rotateZ(0.4); cap.translate(u * cs + 1, heightAt(x + u * cs, z - u * sn) - y0 + R * 0.6, -u * sn); parts.push(paint(cap, RUIN_STONE, RUIN_MOSS, 0.6, 77)); }, 'coluna_tombada'); }
  // 5) pedestais vazios (a estátua caiu ou foi levada) e montes de escombros
  for (const [x, z] of [[-60, -280], [60, -290], [-20, -360], [24, -246], [-130, -282], [132, -350], [90, -380], [-90, -386]]) { if (!free(x, z, 4)) continue;
    cluster(x, z, (parts, y0, cols) => { parts.push(carved(rng, 4.2, 1.4, 4.2, RUIN_DARK)); parts[parts.length - 1].translate(0, 0.4, 0); parts.push(carved(rng, 3.4, 1.2, 3.4)); parts[parts.length - 1].translate(0.1, 1.5, -0.1);
      for (const sx of [-1, 1]) { const f = chunk(rng, 0.7, 1.2, 0.8); f.translate(sx * 0.8, 2.6, 0); parts.push(paint(f, RUIN_STONE, RUIN_MOSS, 0.3, 5)); } // só os pés da estátua
      debrisPile(rng, parts, x, y0, z, 5.5, 26, heightAt, x, z); cols.push([x, z, 2.4]); }, 'pedestal_vazio'); }
  for (let k = 0; k < 18; k++) { const a = rng() * Math.PI * 2, d = 30 + rng() * 85, x = Math.cos(a) * d * 1.3, z = -300 + Math.sin(a) * d; if (!free(x, z, 5) || (roadDist && roadDist(x, z) < 4)) continue;
    cluster(x, z, (parts, y0) => debrisPile(rng, parts, x, y0, z, 3.5 + rng() * 3.5, 22 + Math.floor(rng() * 18), heightAt, x, z), 'escombros'); }
  return groups;
}

/* =========================================================================
   NOCTÍVAGO (S-177): a montaria dos voos — criatura original, um cavalo alado da noite.
   Corpo de cavalo esguio e ossudo (costelas marcadas, cabeça longa de crânio
   anguloso), olhos claros sem pupila, crina esfiapada, cauda longa com tufo e
   ASAS DE COURO com ossos de dedos e membrana que se recalcula a cada quadro
   (dobradas no repouso; de vez em quando ele as abre e bate).
   makeNoctivago() → { obj, update(t) }
   ========================================================================= */
// tubo ao longo de pontos, com seção elíptica controlada (rx, ry em função de t) e "cima" fixo
function sweep(pts, rad, segs = 40, radial = 20, up = V3(0, 1, 0), disp = null) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), pos = [], idx = [], T = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t); curve.getTangentAt(t, T);
    side.crossVectors(T, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); upv.crossVectors(side, T).normalize();
    const [rx, ry, oy = 0] = rad(t);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); let k = 1; if (disp) k = disp(t, a);
      pos.push(c.x + side.x * ca * rx * k + upv.x * (sa * ry * k + oy), c.y + side.y * ca * rx * k + upv.y * (sa * ry * k + oy), c.z + side.z * ca * rx * k + upv.z * (sa * ry * k + oy));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// pinta por altura/curvatura: costas um pouco mais claras, ventre e articulações mais escuros
function hide(g, base = '#4c505e', light = '#7c8190', dark = '#272630') {
  const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), c = new THREE.Color(), b = new THREE.Color(base), l = new THREE.Color(light), d = new THREE.Color(dark);
  for (let i = 0; i < P.count; i++) { const ny = N.getY(i), n = Math.sin(P.getX(i) * 9 + P.getZ(i) * 7) * 0.5 + 0.5; c.copy(b).lerp(ny > 0 ? l : d, Math.abs(ny) * 0.6).offsetHSL(0, 0, (n - 0.5) * 0.03); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
export function makeNoctivago(seed = 3) {
  const rng = rngOf(seed), obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.0 });
  const hoofM = new THREE.MeshStandardMaterial({ color: '#141216', roughness: 0.35, metalness: 0.2 });
  const boneM = new THREE.MeshStandardMaterial({ color: '#2a2730', roughness: 0.45 });
  const membM = new THREE.MeshStandardMaterial({ color: '#2a1f2e', roughness: 0.65, side: THREE.DoubleSide, transparent: true, opacity: 0.93, emissive: '#1a0a22', emissiveIntensity: 0.35 });
  const eyeM = new THREE.MeshStandardMaterial({ color: '#eef6ff', emissive: '#bfe2ff', emissiveIntensity: 1.6, roughness: 0.2 });
  const add = (g, m = skin, parent = body) => { const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  // tronco: esguio, com costelas marcadas e ventre recolhido
  const torso = sweep([[0, 1.48, -1.02], [0, 1.58, -0.74], [0, 1.52, -0.2], [0, 1.6, 0.3], [0, 1.46, 0.8]], t => { const s = Math.sin(Math.PI * Math.min(1, t * 1.04)); return [0.15 + 0.17 * s, 0.2 + 0.27 * s, -0.1 * s]; }, 48, 24, V3(0, 1, 0),
    (t, a) => { const sideA = Math.abs(Math.cos(a)), below = Math.sin(a) < 0 ? 1 : 0; const ribs = t > 0.42 && t < 0.82 ? Math.max(0, Math.cos((t - 0.42) / 0.4 * Math.PI * 7)) : 0; return 1 + ribs * 0.05 * sideA - (t > 0.25 && t < 0.6 ? 0.1 * below * Math.sin((t - 0.25) / 0.35 * Math.PI) : 0); });
  add(hide(torso));
  // garupa e paleta (volumes de músculo seco)
  for (const sx of [-1, 1]) { const hip = new THREE.SphereGeometry(1, 20, 14); hip.scale(0.16, 0.24, 0.3); hip.translate(sx * 0.12, 1.5, -0.68); add(hide(hip)); const sh = new THREE.SphereGeometry(1, 20, 14); sh.scale(0.12, 0.26, 0.2); sh.rotateX(-0.3); sh.translate(sx * 0.14, 1.38, 0.55); add(hide(sh)); }
  // pescoço longo e arqueado
  const neckG = new THREE.Group(); neckG.position.set(0, 1.6, 0.62); body.add(neckG);
  add(hide(sweep([[0, -0.1, -0.08], [0, 0.22, 0.22], [0, 0.46, 0.44], [0, 0.62, 0.58]], t => [0.21 - t * 0.1, 0.33 - t * 0.17, 0.03], 28, 20, V3(0, 0, -1))), skin, neckG);
  { const vert = []; for (let k = 0; k < 8; k++) { const t = k / 7, g = new THREE.SphereGeometry(1, 10, 8); g.scale(0.03, 0.04, 0.035); g.translate(0, -0.02 + t * 0.6 + 0.16 - t * 0.02, -0.14 + t * 0.62); vert.push(g); } add(hide(mergeGeometries(vert)), boneM, neckG); }
  // cabeça: crânio longo e anguloso, órbitas fundas, maçãs do rosto ossudas, focinho estreito
  const headG = new THREE.Group(); headG.position.set(0, 0.66, 0.6); headG.rotation.x = 0.35; neckG.add(headG);
  { // perfil de cabeça de cavalo: ganacha larga atrás, chanfro reto e fino, focinho com narinas abertas
    const R = t => { const k = [[0, 0.07, 0.09, 0.02], [0.12, 0.115, 0.15, -0.05], [0.26, 0.105, 0.135, -0.07], [0.45, 0.078, 0.1, -0.03], [0.75, 0.068, 0.09, -0.01], [0.92, 0.074, 0.09, -0.015], [1, 0.03, 0.04, -0.02]];
      for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]), s2 = u * u * (3 - 2 * u); return [k[i - 1][1] + (k[i][1] - k[i - 1][1]) * s2, k[i - 1][2] + (k[i][2] - k[i - 1][2]) * s2, k[i - 1][3] + (k[i][3] - k[i - 1][3]) * s2]; } return [0.03, 0.04, 0]; };
    add(hide(sweep([[0, 0.05, -0.1], [0, 0.03, 0.1], [0, -0.06, 0.32], [0, -0.17, 0.54], [0, -0.22, 0.66]], R, 36, 22, V3(0, 1, 0),
      (t, a) => 1 + (Math.abs(Math.cos(a)) > 0.75 && t > 0.1 && t < 0.32 ? 0.1 : 0) - (Math.sin(a) > 0.55 && t > 0.08 && t < 0.2 ? 0.05 : 0) + (t > 0.86 && Math.abs(Math.cos(a)) > 0.6 ? 0.12 : 0))), skin, headG);
  }
  for (const sx of [-1, 1]) {
    const brow = new THREE.SphereGeometry(1, 14, 10); brow.scale(0.035, 0.03, 0.08); brow.rotateX(-0.6); brow.translate(sx * 0.095, 0.03, 0.11); add(hide(brow), skin, headG); // arco da órbita
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), eyeM); eye.scale.set(0.8, 1, 1.3); eye.position.set(sx * 0.1, 0.0, 0.1); eye.rotation.y = sx * 0.7; headG.add(eye);
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), hoofM); nos.scale.set(0.7, 1, 1.2); nos.position.set(sx * 0.045, -0.2, 0.655); nos.rotation.y = sx * 0.4; headG.add(nos);
    const ear = new THREE.Group(); ear.position.set(sx * 0.06, 0.11, -0.08); ear.rotation.set(-0.35, 0, sx * -0.35); headG.add(ear); ear.userData.sx = sx;
    const eg = new THREE.ConeGeometry(0.035, 0.16, 12, 3, true); eg.scale(1, 1, 0.5); eg.translate(0, 0.08, 0); add(hide(eg), skin, ear); (headG.userData.ears = headG.userData.ears || []).push(ear);
  }
  // espinha ossuda: vértebras salientes ao longo do dorso e do pescoço (o ar de criatura da noite)
  { const vert = []; const back = new THREE.CatmullRomCurve3([V3(0, 1.62, -0.95), V3(0, 1.7, -0.6), V3(0, 1.66, -0.1), V3(0, 1.74, 0.3)]);
    for (let k = 0; k < 14; k++) { const p = back.getPointAt(k / 13), g = new THREE.SphereGeometry(1, 10, 8); g.scale(0.035, 0.05 + (k % 2) * 0.01, 0.045); g.translate(p.x, p.y + 0.06, p.z); vert.push(g); }
    for (const sx of [-1, 1]) { const g = new THREE.SphereGeometry(1, 12, 10); g.scale(0.06, 0.06, 0.08); g.translate(sx * 0.21, 1.66, -0.72); vert.push(g); } // pontas do quadril
    add(hide(mergeGeometries(vert)), boneM); }
  // crina esfiapada (fios longos e escuros caindo do topo do pescoço)
  const maneM = new THREE.MeshStandardMaterial({ color: '#0e0d12', roughness: 0.8, side: THREE.DoubleSide });
  const mane = []; for (let k = 0; k < 16; k++) { const t = k / 15, L = 0.22 + rng() * 0.3, w = 0.035 + rng() * 0.02, g = new THREE.PlaneGeometry(w, L, 1, 5); g.translate(0, -L / 2, 0); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = -P.getY(i) / L; P.setX(i, P.getX(i) * (1 - v * 0.8)); P.setZ(i, Math.sin(v * 3 + k) * 0.03); } g.computeVertexNormals();
    const m = new THREE.Mesh(g, maneM); m.position.set((rng() - 0.5) * 0.03, 0.12 + t * 0.78, -0.12 + t * 0.5); m.rotation.set(-0.3 - t * 0.2, Math.PI / 2 + (k % 2 ? 0.3 : -0.3), 0.4 * (k % 2 ? 1 : -1)); neckG.add(m); mane.push(m); }
  // pernas: ossudas, com joelhos e boletos marcados; cascos escuros
  const legs = [];
  const leg = (sx, front) => {
    const g = new THREE.Group(); g.position.set(sx * 0.16, front ? 1.38 : 1.45, front ? 0.56 : -0.74); body.add(g);
    const pts = front ? [[0, 0, 0], [0.01, -0.36, -0.03], [0, -0.78, 0.0], [0, -1.16, 0.03], [0, -1.33, 0.07]] : [[0, 0, 0], [0.02, -0.42, 0.16], [0, -0.78, -0.18], [0, -1.18, -0.08], [0, -1.38, -0.02]];
    add(hide(sweep(pts, t => { const r = t < 0.45 ? (front ? 0.1 : 0.115) * (1 - t * 0.9) + 0.03 : 0.042 + (t > 0.9 ? 0.012 : 0); return [r * 0.9, r * 1.15]; }, 36, 14, V3(0, 0, 1), (t, a) => 1 + Math.exp(-Math.pow((t - 0.56) / 0.035, 2)) * 0.3 + Math.exp(-Math.pow((t - 0.86) / 0.03, 2)) * 0.35)), skin, g);
    const hoof = new THREE.CylinderGeometry(0.045, 0.065, 0.1, 16); hoof.translate(pts[4][0], pts[4][1] - 0.04, pts[4][2]); const hm = new THREE.Mesh(hoof, hoofM); hm.castShadow = true; g.add(hm);
    legs.push({ g, front, sx }); return g;
  };
  for (const sx of [-1, 1]) { leg(sx, true); leg(sx, false); }
  // cauda longa e fina, com tufo esfiapado
  const tailG = new THREE.Group(); tailG.position.set(0, 1.52, -1.0); body.add(tailG);
  add(hide(sweep([[0, 0, 0], [0, -0.15, -0.25], [0, -0.55, -0.4], [0, -0.95, -0.38]], t => [0.05 - t * 0.03, 0.05 - t * 0.03], 20, 10, V3(0, 0, 1))), skin, tailG);
  for (let k = 0; k < 9; k++) { const L = 0.35 + rng() * 0.3, g = new THREE.PlaneGeometry(0.05, L, 1, 4); g.translate(0, -L / 2, 0); const m = new THREE.Mesh(g, maneM); m.position.set(0, -0.92, -0.38); m.rotation.set((rng() - 0.5) * 0.4, rng() * 3, (rng() - 0.5) * 0.5); tailG.add(m); }
  // ASAS: ossos (úmero, antebraço, 4 dedos) posicionados a cada quadro a partir de direções (dobrada ↔ aberta) + membrana
  const wings = [], AX = V3(1, 0, 0);
  for (const sx of [-1, 1]) {
    const root = new THREE.Group(); root.position.set(sx * 0.18, 1.76, 0.24); body.add(root);
    const mk = (len, r0, r1) => { const g = new THREE.CylinderGeometry(r1, r0, len, 10); g.rotateZ(-Math.PI / 2); g.translate(len / 2, 0, 0); const m = new THREE.Mesh(g, boneM); m.castShadow = true; root.add(m); return m; };
    const hum = mk(0.6, 0.05, 0.034), fore = mk(0.8, 0.034, 0.022), FL = [1.05, 1.2, 1.0, 0.75], fingers = FL.map(L => ({ m: mk(L, 0.019, 0.007), L }));
    const elbK = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), boneM), wriK = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), boneM); root.add(elbK, wriK);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 8), hoofM); root.add(claw);
    const NS = 6, strips = 5, geo = new THREE.BufferGeometry(), pos = new Float32Array(strips * (NS + 1) * 3 * 3), idx = [];
    for (let s2 = 0; s2 < strips; s2++) for (let i = 0; i < NS; i++) for (let c = 0; c < 2; c++) { const b0 = (s2 * (NS + 1) + i) * 3 + c, b1 = (s2 * (NS + 1) + i + 1) * 3 + c; idx.push(b0, b1, b0 + 1, b1, b1 + 1, b0 + 1); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const memb = new THREE.Mesh(geo, membM); memb.castShadow = true; memb.frustumCulled = false; root.add(memb);
    wings.push({ sx, root, hum, fore, fingers, elbK, wriK, claw, memb, pos, NS, strips });
  }
  obj.scale.setScalar(1.22);
  // ---------- animação ----------
    let flapT = -99, nextFlap = 4 + rng() * 4;
  const D = (x, y, z) => V3(x, y, z).normalize(), mix = (a, b, k) => a.clone().lerp(b, k).normalize(), qd = new THREE.Quaternion();
  // direções (lado direito, sx = +1): dobrada = colada ao flanco apontando para trás; aberta = esticada para o lado
  const FOLD = { hum: D(0.35, 0.35, -1), fore: D(0.12, -0.05, 1), fing: [D(0.1, 0.05, -1), D(0.14, -0.1, -1), D(0.16, -0.25, -1), D(0.18, -0.4, -1)] };
  const OPEN = { hum: D(1, 0.35, 0.15), fore: D(1, 0.12, -0.25), fing: [D(1, 0.45, 0.25), D(1, 0.1, -0.25), D(0.75, -0.15, -0.7), D(0.35, -0.3, -1)] };
  const place = (m, from, dir, sx) => { m.position.copy(from); qd.setFromUnitVectors(AX, dir); m.quaternion.copy(qd); };
  const wingPose = (w, open, flap) => {
    const sx = w.sx, mir = v => V3(v.x * sx, v.y, v.z), rotF = v => v.clone().applyAxisAngle(V3(0, 0, 1), sx * flap); // bater: gira em torno do eixo do corpo
    const dh = rotF(mir(mix(FOLD.hum, OPEN.hum, open))), df = rotF(mir(mix(FOLD.fore, OPEN.fore, open)));
    const S0 = V3(0, 0, 0), E = dh.clone().multiplyScalar(0.6), W = E.clone().add(df.clone().multiplyScalar(0.8));
    place(w.hum, S0, dh); place(w.fore, E, df); w.elbK.position.copy(E); w.wriK.position.copy(W); w.claw.position.copy(W).add(V3(0, 0.05, 0.02)); w.claw.rotation.set(0.3, 0, -sx * 0.4);
    const tips = w.fingers.map((f, i) => { const d = rotF(mir(mix(FOLD.fing[i], OPEN.fing[i], open))); place(f.m, W, d); return W.clone().add(d.multiplyScalar(f.L)); });
    const flank = [V3(sx * 0.02, -0.12, -0.6), V3(sx * 0.02, -0.18, -1.05)];
    const edges = [tips[0], tips[1], tips[2], tips[3], flank[0], flank[1]], P = w.pos; let o = 0;
    for (let s2 = 0; s2 < w.strips; s2++) {
      const A = edges[s2], B = edges[s2 + 1], base = s2 < 4 ? W : E;
      for (let i = 0; i <= w.NS; i++) { const u = i / w.NS;
        for (let c = 0; c < 3; c++) { const v = c / 2, p = base.clone().lerp(A, u).lerp(base.clone().lerp(B, u), v); p.y -= Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.07 * open; P[o++] = p.x; P[o++] = p.y; P[o++] = p.z; } }
    }
    w.memb.geometry.attributes.position.needsUpdate = true; w.memb.geometry.computeVertexNormals();
  };
  const update = t => {
    // respiração e peso trocando de pata
    body.position.y = Math.sin(t * 1.4) * 0.008; body.rotation.z = Math.sin(t * 0.35) * 0.012;
    neckG.rotation.x = Math.sin(t * 0.7) * 0.06 - 0.03; neckG.rotation.y = Math.sin(t * 0.31) * 0.18;
    headG.rotation.x = 0.35 + Math.sin(t * 0.9 + 1) * 0.08; headG.rotation.y = Math.sin(t * 0.45) * 0.15;
    for (const e of headG.userData.ears) e.rotation.x = -0.35 + Math.max(0, Math.sin(t * 2.3 + e.userData.sx * 2)) * 0.25 * (Math.sin(t * 0.37) > 0.6 ? 1 : 0);
    tailG.rotation.y = Math.sin(t * 1.3) * 0.25; tailG.rotation.x = 0.1 + Math.sin(t * 0.8) * 0.06;
    mane.forEach((m, k) => { m.rotation.z = (k % 2 ? 1 : -1) * 0.4 + Math.sin(t * 2 + k) * 0.08; });
    legs.forEach(l => { if (!l.front && l.sx > 0) l.g.rotation.x = Math.max(0, Math.sin(t * 0.25)) * 0.12; }); // apoia uma pata de trás de vez em quando
    // de tempos em tempos: abre as asas, bate duas vezes e recolhe
    if (t > nextFlap) { flapT = t; nextFlap = t + 9 + rng() * 6; }
    const k = t - flapT; let open = 0, flap = 0;
    if (k >= 0 && k < 4.2) { open = k < 0.8 ? k / 0.8 : k > 3.4 ? (4.2 - k) / 0.8 : 1; open = open * open * (3 - 2 * open); if (k > 0.8 && k < 3.4) flap = Math.sin((k - 0.8) / 2.6 * Math.PI * 4) * 0.55 * Math.sin((k - 0.8) / 2.6 * Math.PI); }
    open = Math.min(1, open + 0.02 + Math.sin(t * 0.6) * 0.02);
    for (const w of wings) wingPose(w, Math.max(0, open), flap);
  };
  update(0);
  return { obj, update, pose: (open, flap = 0) => { for (const w of wings) wingPose(w, open, flap); } };
}
