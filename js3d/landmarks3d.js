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
