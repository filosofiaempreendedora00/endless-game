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
  g.add(mesh(S));
  const dark = new THREE.Mesh(new THREE.CircleGeometry(3.3, 28, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#07060a' })); dark.position.set(0, 8.6, -7.35); g.add(dark);
  const darkB = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5), new THREE.MeshBasicMaterial({ color: '#07060a' })); darkB.position.set(0, 6.1, -7.35); g.add(darkB);
  // braseiros nas laterais da escada
  for (const sx of [-13, 13]) { const b = brazier(); b.position.set(sx, 3.6, 2.6); g.add(b); }
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
/* ---------- Poleiro do grifo (placa com o emblema) ---------- */
export function makeRoost() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.2, 14), wood); post.position.y = 2.1; g.add(post);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 12), wood); bar.rotation.z = Math.PI / 2; bar.position.y = 3.6; g.add(bar);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#2a3a6a'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#ffd76a'; c.lineWidth = 6; c.strokeRect(4, 4, 120, 120);
  c.font = '70px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🦅', 64, 70);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6, 6, 6), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(0, 2.7, 0.06); g.add(flag);
  const P = flag.geometry.attributes.position, base = P.array.slice();
  g.userData.update = t => { for (let i = 0; i < P.count; i++) P.setZ(i, base[i * 3 + 2] + Math.sin(t * 3 + base[i * 3] * 3 + base[i * 3 + 1]) * 0.05); P.needsUpdate = true; };
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
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: '#4a4a4e', roughness: 0.45, metalness: 0.7 });
  const plank = (w, h, d, x, y, z, rx = 0, rz = 0, m = wood) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 1, 1), m); b.position.set(x, y, z); b.rotation.set(rx, 0, rz); b.castShadow = b.receiveShadow = true; g.add(b); };
  // caçamba (laterais inclinadas, tábuas com frestas)
  for (let k = 0; k < 4; k++) plank(0.62, 0.035, 0.17, 0, 0.42, -0.26 + k * 0.175, 0, 0, k % 2 ? wood : dark);
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) plank(0.04, 0.16, 0.72, sx * 0.36, 0.52 + k * 0.17, 0, 0, sx * -0.35);
  for (const sz of [-1, 1]) for (let k = 0; k < 2; k++) plank(0.7, 0.16, 0.04, 0, 0.52 + k * 0.17, sz * 0.38, sz * 0.3, 0);
  // cabos curvos que viram pegadores
  for (const sx of [-1, 1]) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.22, 0.3, 0.62), new THREE.Vector3(sx * 0.26, 0.38, 0.1), new THREE.Vector3(sx * 0.3, 0.52, -0.55), new THREE.Vector3(sx * 0.32, 0.66, -0.95)]); const t = new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.035, 10), dark); t.castShadow = true; g.add(t); const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 12), wood); grip.position.set(sx * 0.32, 0.67, -0.92); grip.rotation.x = 1.3; g.add(grip); }
  // pés de apoio
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 10), dark); l.position.set(sx * 0.26, 0.2, -0.45); g.add(l); }
  // roda com aro de ferro, cubo e raios
  const wheel = new THREE.Group(); wheel.position.set(0, 0.24, 0.72); g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 10, 32), iron); rim.rotation.y = Math.PI / 2; wheel.add(rim);
  const tread = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 32), wood); tread.rotation.y = Math.PI / 2; wheel.add(tread);
  for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), wood); sp.rotation.x = k / 8 * Math.PI; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 14), iron); hub.rotation.z = Math.PI / 2; wheel.add(hub);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), iron); axle.rotation.z = Math.PI / 2; wheel.add(axle);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
