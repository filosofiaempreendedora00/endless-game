/* =========================================================================
   MONSTROS FOFOS 3D feitos em código (enquanto não há modelos próprios).
   Cada função devolve { root, animate(t, moving, dt) }. Altura ~1 m * size.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

// sombreado suave (nada de facetas quadradas)
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: false, ...extra });
const BLACK = mat('#1e1a2a', { roughness: 0.4 });
const FACE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2 });
const WHITE = mat('#ffffff', { roughness: 0.4 });

function eyes(parent, y, z, spread, r = 0.07) {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), BLACK);
    e.position.set(s * spread, y, z); parent.add(e);
    const g = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 20, 14), WHITE);
    g.position.set(s * spread + r * 0.3, y + r * 0.35, z + r * 0.8); parent.add(g);
  }
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// tubo que afina ao longo de uma curva (pescoço, rabo, orelhas, patas)
function taper(points, r0, r1, seg = 16, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const u = i / seg, r = r0 + (r1 - r0) * u, c = curve.getPointAt(u); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r); } }
  g.computeVertexNormals(); return g;
}
const blob = (r, sx, sy, sz, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o; };
// golpe: curva 0→1→0 em ~0,45 s (preparo, bote e volta)
const strike = k => k < 0 || k > 1 ? 0 : k < 0.35 ? -Math.sin(k / 0.35 * Math.PI / 2) * 0.35 : Math.sin((k - 0.35) / 0.65 * Math.PI);
const shadowAll = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

/* ---------- Gotinha (S-074): gota d'água viva — nada de "bola que pula" ----------
   Corpo em forma de gota com a ponta virada para trás como uma crista, base derretida que
   escorre pelo chão em ondinhas, núcleo brilhante com bolhas subindo e duas nadadeiras.
   Desliza (não quica). Variantes por elemento ganham um detalhe próprio. */
function dropGeometry() {
  const g = new THREE.SphereGeometry(0.5, 40, 30), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const v = (y + 0.5); // 0 embaixo → 1 em cima
    const pinch = 1 - Math.pow(Math.max(0, v - 0.45) / 0.55, 1.6) * 0.92; // afina para cima (gota)
    const skirt = 1 + Math.pow(Math.max(0, 0.32 - v) / 0.32, 2) * 0.55;  // base derretida mais larga
    x *= pinch * skirt; z *= pinch * skirt;
    y = y * 1.15 + 0.05;
    const tip = Math.pow(Math.max(0, v - 0.55) / 0.45, 2.2); // ponta curva para trás (crista)
    z -= tip * 0.32; y -= tip * 0.06;
    if (v < 0.08) y = Math.max(y, -0.53 + (0.08 - v) * 0.02); // fundo achatado no chão
    P.setXYZ(i, x, y, z);
  }
  g.translate(0, 0.53, 0); g.computeVertexNormals(); return g;
}
const GOTA_VARIANTS = {
  agua: { core: '#bff6ff', glow: 0.9 },
  fogo: { core: '#ffe08a', glow: 1.6, extra: 'embers' },
  terra: { core: '#e7ffb0', glow: 0.7, extra: 'sprout' },
  gelo: { core: '#ffffff', glow: 1.1, extra: 'crystals' },
  sombra: { core: '#d9a6ff', glow: 1.8, extra: 'wisps' },
  rei: { core: '#fff2b8', glow: 1.5, extra: 'royal' }, // Gosmão: rei das gotas
};
export function slime(color, boss, variant = 'agua') {
  const V = GOTA_VARIANTS[variant] || GOTA_VARIANTS.agua;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skinM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, transmission: 0, transparent: true, opacity: 0.78, clearcoat: 1, clearcoatRoughness: 0.08, emissive: color, emissiveIntensity: 0.08, depthWrite: false });
  const shell = new THREE.Mesh(dropGeometry(), skinM); shell.renderOrder = 2; body.add(shell);
  // núcleo brilhante e bolhas dentro (veem-se através da pele)
  const coreM = new THREE.MeshStandardMaterial({ color: V.core, emissive: V.core, emissiveIntensity: V.glow, roughness: 0.3 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), coreM); core.position.set(0, 0.36, -0.02); body.add(core);
  const bubM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, roughness: 0.1 });
  const bubbles = []; for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (k % 3) * 0.01, 14, 10), bubM); b.userData.ph = k / 4; body.add(b); bubbles.push(b); }
  // nadadeiras laterais (pele fina, mexem como se nadasse no ar)
  const finG = new THREE.SphereGeometry(0.13, 22, 14); finG.scale(1, 0.55, 0.18);
  const fins = [1, -1].map(sx => { const f = new THREE.Group(); f.position.set(sx * 0.36, 0.3, 0.02); const m = new THREE.Mesh(finG, skinM); m.position.x = sx * 0.09; m.rotation.z = sx * -0.5; f.add(m); body.add(f); return f; });
  // olhos grandes e brilhantes na frente e a boquinha: tudo numa malha só (cores por vértice)
  const fp = [], piece = (g, hex, sx, sy, sz, x, y, z, rz = 0) => { g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z); const n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3); for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); fp.push(g.index ? g.toNonIndexed() : g); };
  for (const sx of [-1, 1]) {
    piece(new THREE.SphereGeometry(0.07, 24, 18), '#fbfbff', 0.9, 1.1, 0.7, sx * 0.12, 0.45, 0.34);
    piece(new THREE.SphereGeometry(0.045, 20, 14), '#1a2236', 0.9, 1.15, 0.5, sx * 0.115, 0.44, 0.39);
    piece(new THREE.SphereGeometry(0.015, 12, 8), '#ffffff', 1, 1, 1, sx * 0.115 + 0.018, 0.47, 0.415);
  }
  piece(new THREE.TorusGeometry(0.035, 0.008, 8, 20, Math.PI), '#1a2236', 1, 1, 1, 0, 0.34, 0.385, Math.PI);
  body.add(new THREE.Mesh(mergeGeometries(fp), FACE_MAT));
  // ondinhas da base escorrendo no chão
  const ringM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false });
  const ripples = [0, 1].map(k => { const r = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.5, 40), ringM.clone()); r.rotation.x = -Math.PI / 2; r.position.y = 0.012; r.userData.ph = k * 0.5; root.add(r); return r; });
  // detalhe de cada variante
  const fxs = [];
  if (V.extra === 'embers') for (let k = 0; k < 5; k++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' })); e.userData.ph = k / 5; body.add(e); fxs.push(t => { const q = (t * 0.6 + e.userData.ph) % 1; e.position.set(Math.sin(k * 2.3 + t) * 0.12, 0.85 + q * 0.5, -0.2 + Math.cos(k * 1.7) * 0.08); e.scale.setScalar(1 - q); }); }
  if (V.extra === 'sprout') { const stem = new THREE.Mesh(taper([V3(0, 0, 0), V3(0.02, 0.1, 0.02), V3(0.05, 0.18, 0)], 0.012, 0.007, 10, 8), mat('#4f8a2e')); stem.position.set(0, 0.86, -0.26); body.add(stem); for (const sx of [-1, 1]) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 12), mat('#6fbf3a', { roughness: 0.6 })); lf.scale.set(1, 0.25, 0.55); lf.position.set(0.05 + sx * 0.05, 1.04, -0.26); lf.rotation.z = sx * 0.6; body.add(lf); fxs.push(t => { lf.rotation.x = Math.sin(t * 2 + sx) * 0.2; }); } }
  if (V.extra === 'crystals') for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 + k * 0.012, 0), new THREE.MeshPhysicalMaterial({ color: '#e8fbff', roughness: 0.05, transparent: true, opacity: 0.85, emissive: '#bfefff', emissiveIntensity: 0.4 })); c.scale.set(0.6, 1.6, 0.6); const a = -0.9 + k * 0.6; c.position.set(Math.sin(a) * 0.2, 0.72 + (k % 2) * 0.06, -0.12 + Math.cos(a) * 0.05); c.rotation.z = -Math.sin(a) * 0.7; body.add(c); }
  if (V.extra === 'wisps') for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshBasicMaterial({ color: '#7a3ad0', transparent: true, opacity: 0.5, depthWrite: false })); body.add(w); fxs.push(t => { const q = (t * 0.45 + k / 4) % 1, a = k * 1.6 + t; w.position.set(Math.cos(a) * 0.32, 0.15 + q * 0.9, Math.sin(a) * 0.32); w.material.opacity = 0.5 * (1 - q); w.scale.setScalar(1.2 - q * 0.6); }); }
  if (V.extra === 'royal') { // três núcleos em triângulo e gotinhas em órbita (nada de bolinha que pula)
    for (let k = 0; k < 2; k++) { const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), coreM); c2.position.set((k ? 1 : -1) * 0.13, 0.26, 0.04); body.add(c2); fxs.push(t => c2.scale.setScalar(1 + Math.sin(t * 3 + k * 2) * 0.12)); }
    const orbM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1 });
    for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(dropGeometry(), orbM); d.scale.setScalar(0.16); body.add(d); fxs.push(t => { const a = t * 1.2 + k * Math.PI / 2; d.position.set(Math.cos(a) * 0.62, 0.35 + Math.sin(t * 2 + k) * 0.12, Math.sin(a) * 0.62); d.rotation.y = -a; }); }
    const drips = new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, transparent: true, opacity: 0.7 });
    for (let k = 0; k < 6; k++) { const dr = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), drips); dr.scale.y = 1.8; body.add(dr); const a = k / 6 * Math.PI * 2; fxs.push(t => { const q = (t * 0.5 + k / 6) % 1; dr.position.set(Math.cos(a) * 0.4 * (1 + q * 0.2), 0.55 - q * 0.5, Math.sin(a) * 0.4 * (1 + q * 0.2)); dr.scale.setScalar(1 - q * 0.6); }); }
  }
  if (boss) { // coroa de coral (Gosmão): pontas orgânicas, não um cone
    const cm = mat('#ffcf5a', { metalness: 0.5, roughness: 0.3 });
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const sp = new THREE.Mesh(taper([V3(0, 0, 0), V3(Math.cos(a) * 0.04, 0.09, Math.sin(a) * 0.04), V3(Math.cos(a) * 0.05, 0.16, Math.sin(a) * 0.05)], 0.03, 0.008, 10, 8), cm); sp.position.set(Math.cos(a) * 0.1, 0.78, -0.16 + Math.sin(a) * 0.1); body.add(sp); }
  }
  shadowAll(root); shell.castShadow = true; for (const r of ripples) r.castShadow = false;
  let lt = 0, at = -9;
  return { root, attack() { at = lt; }, animate(t, moving) {
    lt = t; const f = moving ? 5.5 : 2.2, a = moving ? 0.06 : 0.035;
    const k = Math.sin(t * f), sk = strike((t - at) / 0.5);
    // desliza: ondula de baixo para cima (sem quicar), estica e espirra para frente no golpe
    body.scale.set(1 + k * a - sk * 0.12, 1 - k * a * 0.8 + sk * 0.12, 1 + k * a + sk * 0.38);
    body.rotation.x = (moving ? 0.08 : 0) + sk * 0.25 + Math.sin(t * f * 0.5) * 0.03;
    body.position.z = sk * 0.32;
    for (const [n, fn] of fins.entries()) fn.rotation.z = (n ? -1 : 1) * (Math.sin(t * (moving ? 8 : 3) + n) * 0.35 + 0.1);
    for (const b of bubbles) { const q = (t * 0.25 + b.userData.ph) % 1; b.position.set(Math.sin(b.userData.ph * 20 + t) * 0.12, 0.12 + q * 0.5, Math.cos(b.userData.ph * 13) * 0.1); b.scale.setScalar(Math.sin(q * Math.PI)); }
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.08); core.position.y = 0.36 + Math.sin(t * 1.3) * 0.02;
    for (const r of ripples) { const q = (t * (moving ? 0.9 : 0.45) + r.userData.ph) % 1; r.scale.setScalar(0.85 + q * 0.7); r.material.opacity = 0.35 * (1 - q); }
    for (const fx of fxs) fx(t);
  } };
}

/* ---------- Fungolino: cogumelo vivo ----------
   Chapéu com borda ondulada e irregular, verrugas de tamanhos variados, lamelas por baixo, pé fibroso
   com anel (saia) e raízes, rosto embutido no pé. Pula com "achata e estica" e solta esporos. */
const vcolor = (g, fn) => { const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(); for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
const VC = (r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, ...extra });
export function mushroom(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 7 + Math.floor(Math.random() * 999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const capC = new THREE.Color(color), dark = capC.clone().offsetHSL(0, 0.05, -0.18), rimC = capC.clone().offsetHSL(0.02, -0.1, 0.12);
  // pé: fibroso, mais largo embaixo, com raízes
  const stemG = new THREE.LatheGeometry([[0.001, 0], [0.24, 0], [0.27, 0.04], [0.24, 0.1], [0.2, 0.22], [0.18, 0.36], [0.16, 0.46], [0.001, 0.46]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  { const P = stemG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), a = Math.atan2(z, x), f = 1 + Math.sin(a * 14 + y * 6) * 0.025 + Math.sin(a * 5) * 0.02; P.setXYZ(k, x * f, y, z * f); } stemG.computeVertexNormals(); }
  vcolor(stemG, (c, x, y, z) => c.set('#efe6d2').offsetHSL(0, 0, (Math.sin(Math.atan2(z, x) * 14) * 0.5 + 0.5) * -0.05 - (y < 0.06 ? 0.12 : 0)));
  const stem = new THREE.Mesh(stemG, VC(0.85)); body.add(stem);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rng(); const r = new THREE.Mesh(taper([V3(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2), V3(Math.cos(a) * 0.32, 0.01, Math.sin(a) * 0.32), V3(Math.cos(a) * 0.38, -0.03, Math.sin(a) * 0.38)], 0.04, 0.022, 10, 10), mat('#d8cdb4', { roughness: 0.9 })); body.add(r); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), r.material); tip.position.set(Math.cos(a) * 0.38, -0.03, Math.sin(a) * 0.38); body.add(tip); } // raízes grossas e arredondadas
  // anel (saia) do pé
  const skirtG = new THREE.CylinderGeometry(0.2, 0.25, 0.08, 28, 1, true); { const P = skirtG.attributes.position; for (let k = 0; k < P.count; k++) { const a = Math.atan2(P.getZ(k), P.getX(k)); if (P.getY(k) < 0) { P.setX(k, P.getX(k) * (1 + Math.sin(a * 9) * 0.06)); P.setZ(k, P.getZ(k) * (1 + Math.sin(a * 9) * 0.06)); } } skirtG.computeVertexNormals(); }
  const skirt = new THREE.Mesh(skirtG, mat('#f4ecda', { roughness: 0.8, side: THREE.DoubleSide })); skirt.position.y = 0.4; body.add(skirt);
  // chapéu: lathe com borda ondulada, centro mais escuro
  const cap = new THREE.Group(); cap.position.y = 0.44; body.add(cap);
  const prof = []; for (let k = 0; k <= 16; k++) { const u = k / 16, ang = u * Math.PI * 0.5; prof.push(new THREE.Vector2(Math.max(0.001, Math.sin(ang) * 0.46 + u * u * 0.04), Math.cos(ang) * 0.3 + 0.02)); }
  prof.push(new THREE.Vector2(0.48, -0.02), new THREE.Vector2(0.4, -0.04)); // borda que dobra para dentro
  const capG = new THREE.LatheGeometry(prof.reverse(), 48);
  { const P = capG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), a = Math.atan2(z, x), r = Math.hypot(x, z), edge = Math.max(0, r - 0.3) / 0.18; P.setY(k, y + Math.sin(a * 7 + 1) * 0.035 * edge + Math.sin(a * 3) * 0.02 * edge); const f = 1 + Math.sin(a * 5) * 0.03 * edge; P.setX(k, x * f); P.setZ(k, z * f); } capG.computeVertexNormals(); }
  vcolor(capG, (c, x, y, z) => { const r = Math.hypot(x, z); c.copy(dark).lerp(capC, Math.min(1, r / 0.3)).lerp(rimC, Math.max(0, (r - 0.36) / 0.12)).offsetHSL(0, 0, (Math.sin(x * 23 + z * 17) * 0.5 + 0.5) * 0.04); });
  cap.add(new THREE.Mesh(capG, VC(0.55)));
  // lamelas por baixo (finas, saindo do pé até a borda)
  const gills = []; for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, gl = new THREE.PlaneGeometry(0.28, 0.07); gl.translate(0.27, -0.035, 0); gl.rotateY(-a); gills.push(gl); }
  const gillM = new THREE.Mesh(mergeGeometries(gills), mat('#e9d8b8', { roughness: 0.9, side: THREE.DoubleSide })); gillM.position.y = 0.0; cap.add(gillM);
  // verrugas brancas de tamanhos variados (espiral dourada, sem anel perfeito)
  const warts = [];
  for (let k = 0; k < 14; k++) { const u = (k + 0.5) / 14, a = k * 2.399 + rng() * 0.4, r = Math.sqrt(u) * 0.38, y = Math.cos(Math.asin(Math.min(1, r / 0.47))) * 0.3 + 0.02;
    const w = new THREE.SphereGeometry(0.025 + rng() * 0.035, 14, 10); w.scale(1, 0.45, 1); { const P = w.attributes.position; for (let q = 0; q < P.count; q++) P.setY(q, P.getY(q) + Math.sin(P.getX(q) * 90) * 0.003); } w.lookAt(V3(Math.cos(a) * r, y, Math.sin(a) * r)); w.translate(Math.cos(a) * r, y - 0.005, Math.sin(a) * r); warts.push(w); }
  cap.add(new THREE.Mesh(mergeGeometries(warts.map(w => { w.deleteAttribute('uv'); return w; })), mat('#fbf6ea', { roughness: 0.85 })));
  // rosto no pé: olhos brilhantes com pálpebra e boquinha
  const face = new THREE.Group(); face.position.set(0, 0.27, 0.17); body.add(face);
  for (const sx of [-1, 1]) {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), mat('#1a1210', { roughness: 0.1 })); ew.scale.set(0.85, 1.1, 0.5); ew.position.set(sx * 0.07, 0.02, 0.01); face.add(ew);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), WHITE); hl.position.set(sx * 0.07 + 0.012, 0.04, 0.03); face.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), mat('#e6dcc6', { roughness: 0.8 })); lid.scale.set(0.9, 1.1, 0.6); lid.position.set(sx * 0.07, 0.022, 0.012); face.add(lid);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 18, Math.PI), mat('#5a3a2a')); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.045, 0.02); face.add(mouth);
  // esporos (nuvem que sai do chapéu ao pular/atacar)
  const sporeM = new THREE.MeshBasicMaterial({ color: capC.clone().lerp(new THREE.Color('#fff4d0'), 0.6), transparent: true, opacity: 0.6, depthWrite: false });
  const spores = []; for (let k = 0; k < 14; k++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.02 + rng() * 0.015, 8, 6), sporeM); sp.visible = false; root.add(sp); spores.push({ sp, v: V3(), life: 0 }); }
  const puff = (n, y) => { let c = 0; for (const p of spores) { if (p.life > 0 || c >= n) continue; c++; p.life = 0.8 + Math.random() * 0.6; p.sp.visible = true; const a = Math.random() * 6.28; p.sp.position.set(Math.cos(a) * 0.3, y, Math.sin(a) * 0.3); p.v.set(Math.cos(a) * 0.4, 0.3 + Math.random() * 0.4, Math.sin(a) * 0.4); } };
  bakeChildren(body);
  shadowAll(root);
  let lt = 0, at = -9, ph = 0, wasUp = false;
  return { root, attack() { at = lt; puff(8, 0.7); }, animate(t, moving, dt = 1 / 60) {
    dt = Math.min(0.05, Math.max(0.001, t - lt)); lt = t; const sk = strike((t - at) / 0.5);
    ph += dt * (moving ? 7.5 : 0);
    const hop = moving ? Math.max(0, Math.sin(ph)) : 0, land = moving ? Math.max(0, -Math.sin(ph)) : 0;
    body.position.y = hop * 0.2 + Math.max(0, sk) * 0.2;
    body.scale.set(1 + land * 0.12 - hop * 0.05, 1 - land * 0.18 + hop * 0.08 + Math.sin(t * 2.2) * 0.015 * (moving ? 0 : 1), 1 + land * 0.12 - hop * 0.05); // achata ao cair, estica ao subir
    cap.rotation.z = Math.sin(t * 2) * 0.05 + Math.sin(ph) * 0.06; cap.rotation.x = sk * 0.6 - land * 0.05;
    cap.position.y = 0.44 - land * 0.02;
    body.rotation.x = sk * 0.25;
    const up = hop > 0.5; if (wasUp && !up && moving) puff(2, 0.1); wasUp = up; // pousa e levanta um pouco de esporo
    for (const p of spores) { if (p.life <= 0) continue; p.life -= dt; p.sp.position.addScaledVector(p.v, dt); p.v.multiplyScalar(0.97); p.sp.material.opacity = 0.6; p.sp.scale.setScalar(1 + (1.4 - p.life) * 1.5); if (p.life <= 0) p.sp.visible = false; }
  } };
}

/* ---------- Coelho-Chifre: coelho de verdade, com pelagem, olhos brilhantes e chifre torcido ---------- */
export function rabbit(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 11 + Math.floor(Math.random() * 999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const base = new THREE.Color(color), FUR = mat(base, { roughness: 0.9 }), LIGHT = mat(base.clone().offsetHSL(0, -0.05, 0.08), { roughness: 0.9 });
  const PINK = mat('#e2a0a6', { roughness: 0.6 }), EYE = mat('#170d0a', { roughness: 0.05, metalness: 0.1 });
  const STRAND = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide });
  const tones = [base.clone().offsetHSL(0.01, 0.05, -0.12), base.clone().offsetHSL(0, -0.05, 0.08), base.clone().offsetHSL(0.03, 0.1, -0.05)];
  const softTones = [base.clone().offsetHSL(0, 0, -0.04), base.clone().offsetHSL(0, 0, 0.04)]; // pelo curto e macio, quase da cor do corpo
  body.add(blob(0.23, 1, 0.92, 1.05, FUR, 0, 0.25, -0.1, 22));
  body.add(blob(0.165, 0.95, 1, 1, FUR, 0, 0.24, 0.13, 20));
  body.add(blob(0.14, 0.9, 0.6, 1.4, LIGHT, 0, 0.14, 0.02, 18));
  for (const sx of [-1, 1]) body.add(blob(0.12, 0.6, 1, 1.25, FUR, sx * 0.165, 0.2, -0.12, 16));
  bakeChildren(body);
  furPatch(body, STRAND, [{ n: 320, c: [0, 0.27, -0.08], r: [0.22, 0.2, 0.3], len: 0.32, back: 1, yMin: -0.25 }, { n: 110, c: [0, 0.26, 0.14], r: [0.16, 0.16, 0.15], len: 0.3, back: 0.6, yMin: -0.5 }], rng, base, softTones);
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.25); body.add(head);
  const skull = new THREE.Group(); head.add(skull);
  skull.add(blob(0.118, 0.95, 0.92, 1.15, FUR, 0, 0, 0, 20));
  for (const sx of [-1, 1]) skull.add(blob(0.05, 0.9, 0.8, 1, LIGHT, sx * 0.04, -0.055, 0.1, 14)); // bochechas do focinho (o "Y" do coelho)
  skull.add(blob(0.04, 1.2, 0.7, 0.9, LIGHT, 0, -0.085, 0.07, 12));
  bakeChildren(skull);
  furPatch(head, STRAND, [{ n: 110, c: [0, 0.01, -0.01], r: [0.115, 0.11, 0.13], len: 0.24, back: 0.8, yMin: -0.6 }], rng, base, softTones);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), PINK); nose.scale.set(1.4, 0.9, 0.8); nose.position.set(0, -0.025, 0.155); head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), EYE); eye.scale.set(0.6, 1.1, 1); eye.position.set(sx * 0.093, 0.025, 0.05); head.add(eye);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.006, 8, 24), mat(base.clone().offsetHSL(0, 0, -0.2))); rim.rotation.y = sx * Math.PI / 2; rim.scale.set(1.1, 1, 1); rim.position.set(sx * 0.095, 0.025, 0.05); head.add(rim);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), WHITE); hl.position.set(sx * 0.108, 0.04, 0.065); head.add(hl);
    for (let w = 0; w < 4; w++) { const wh = new THREE.Mesh(taper([V3(0, 0, 0), V3(sx * 0.06, 0.003 * (w - 1.5), 0.02), V3(sx * 0.13, -0.01 + 0.008 * (w - 1.5), 0.01)], 0.0022, 0.0008, 8, 5), mat('#f8f4ec')); wh.position.set(sx * 0.035, -0.05, 0.13); head.add(wh); } // bigodes curvos
  }
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.045, 0.09, -0.02); head.add(e);
    const outer = new THREE.Mesh(taper([V3(0, 0, 0), V3(sx * 0.02, 0.14, -0.03), V3(sx * 0.03, 0.27, -0.07), V3(sx * 0.032, 0.3, -0.085)], 0.034, 0.008, 14, 14), FUR); outer.scale.set(1, 1, 0.5); e.add(outer);
    const inner = new THREE.Mesh(taper([V3(0, 0.02, 0.013), V3(sx * 0.02, 0.14, -0.012), V3(sx * 0.028, 0.25, -0.05)], 0.022, 0.006, 14, 10), PINK); inner.scale.set(1, 1, 0.35); e.add(inner);
    const vein = new THREE.Mesh(taper([V3(0, 0.04, 0.02), V3(sx * 0.018, 0.13, -0.004), V3(sx * 0.025, 0.21, -0.04)], 0.003, 0.0015, 10, 5), mat('#c97a84')); e.add(vein); // veia
    return e;
  });
  // chifre torcido (espiral de verdade)
  const hornG = new THREE.ConeGeometry(0.03, 0.17, 16, 12); { const P = hornG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k) + 0.085, z = P.getZ(k), a = y * 30, c = Math.cos(a), s2 = Math.sin(a), ring = 1 + Math.sin(Math.atan2(z, x) * 2 + a) * 0.18; P.setXYZ(k, (x * c - z * s2) * ring, y - 0.085, (x * s2 + z * c) * ring); } hornG.computeVertexNormals(); }
  vcolor(hornG, (c, x, y) => c.set('#efe3c2').lerp(new THREE.Color('#a8956a'), Math.max(0, (0.085 - y) / 0.17) * 0.5));
  const horn = new THREE.Mesh(hornG, VC(0.35)); horn.position.set(0, 0.11, 0.07); horn.rotation.x = 0.5; head.add(horn);
  const fronts = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * 0.07, 0.18, 0.2); body.add(g); g.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.09, 0.01), V3(0, -0.17, 0.03)], 0.03, 0.022, 10, 12), FUR)); const f = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), LIGHT); f.scale.set(1, 0.55, 1.5); f.position.set(0, -0.172, 0.045); g.add(f); return g; });
  const hinds = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * 0.15, 0.12, -0.1); body.add(g); const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), LIGHT); foot.scale.set(0.72, 0.5, 2.6); foot.position.set(0, -0.09, 0.08); g.add(foot); return g; }); // pé traseiro comprido
  const tail = new THREE.Group(); tail.position.set(0, 0.3, -0.33); body.add(tail);
  furPatch(tail, STRAND, [{ n: 60, c: [0, 0, 0], r: [0.05, 0.05, 0.05], len: 0.55, back: -0.3 }], rng, new THREE.Color('#fbf8f2'), [new THREE.Color('#ffffff'), new THREE.Color('#e8e2d6')]);
  tail.add(blob(0.045, 1, 1, 1, mat('#fbf8f2', { roughness: 1 }), 0, 0, 0, 12));
  shadowAll(root);
  let lt = 0, at = -9, ph = 0;
  return { root, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; ph += dt * (moving ? 9 : 0);
    const hop = moving ? Math.max(0, Math.sin(ph)) : 0, sk = strike((t - at) / 0.45);
    body.position.y = hop * 0.22 + Math.max(0, sk) * 0.12;
    body.rotation.x = moving ? -Math.cos(ph) * 0.18 : sk * 0.35;
    body.position.z = sk * 0.18;
    body.scale.set(1, 1 + Math.sin(t * 3.2) * 0.015 * (moving ? 0 : 1), 1); // respira
    hinds.forEach(h => { h.rotation.x = moving ? Math.max(0, -Math.cos(ph)) * 0.9 : 0; });
    fronts.forEach(f => { f.rotation.x = moving ? Math.cos(ph) * 0.6 : 0; });
    ears.forEach((e, i) => { e.rotation.x = -0.15 - hop * 0.4 + Math.sin(t * 1.3 + i * 2) * 0.05 * (moving ? 0 : 1); e.rotation.z = (i ? -1 : 1) * (0.05 + Math.max(0, Math.sin(t * 0.7 + i * 3) - 0.92) * 3); });
    nose.scale.y = 0.9 + Math.max(0, Math.sin(t * 9)) * 0.25 * (moving ? 0 : 1);
    head.rotation.y = moving ? 0 : Math.sin(t * 0.6) * 0.3;
    tail.rotation.x = Math.sin(t * 5) * 0.1 * (moving ? 1 : 0.3);
  } };
}

/* ---------- Abelha Rubra: tórax e cabeça peludos, olhos compostos, asas com nervuras, patas articuladas ---------- */
let WING_TEX = null;
function wingTex() {
  if (WING_TEX) return WING_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.fillStyle = 'rgba(230,240,255,0.35)'; g.beginPath(); g.ellipse(64, 64, 62, 62, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(60,50,40,0.85)'; g.lineWidth = 2.2;
  for (const [x1, y1, x2, y2] of [[4, 64, 124, 58], [10, 64, 110, 30], [10, 64, 112, 92], [40, 62, 70, 20], [40, 62, 74, 108], [70, 60, 98, 18], [70, 60, 100, 104]]) { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 6, x2, y2); g.stroke(); }
  g.lineWidth = 1; g.strokeStyle = 'rgba(60,50,40,0.5)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(30 + k * 12, 30 + (k % 2) * 6); g.lineTo(36 + k * 12, 96 - (k % 3) * 4); g.stroke(); }
  WING_TEX = new THREE.CanvasTexture(c); WING_TEX.colorSpace = THREE.SRGBColorSpace; return WING_TEX;
}
export function bee(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 5 + Math.floor(Math.random() * 999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const base = new THREE.Color(color);
  const C = mat(base, { roughness: 0.55 }), BLK = mat('#1a1416', { roughness: 0.45 }), FUZZ = mat(base.clone().offsetHSL(0.04, -0.15, 0.18), { roughness: 1 });
  const STRAND = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide });
  body.add(blob(0.15, 1, 0.95, 1, FUZZ, 0, 0, 0.02, 20));
  furPatch(body, STRAND, [{ n: 260, c: [0, 0, 0.02], r: [0.15, 0.143, 0.15], len: 0.45, back: 0.3 }], rng, base.clone().offsetHSL(0.04, -0.1, 0.12), [new THREE.Color('#2a1a14'), base.clone().offsetHSL(0.06, 0, 0.2)]);
  const abd = new THREE.Group(); abd.position.set(0, -0.02, -0.12); body.add(abd);
  for (let i = 0; i < 5; i++) { const seg = blob(0.165 - Math.abs(i - 1.5) * 0.026, 1, 0.95, 0.42, i % 2 ? BLK : C, 0, -i * 0.012, -i * 0.075, 22); abd.add(seg); }
  bakeChildren(abd);
  furPatch(abd, STRAND, [0, 1, 2, 3, 4].map(i => ({ n: 34, c: [0, -i * 0.012, -i * 0.075], r: [0.165 - Math.abs(i - 1.5) * 0.026, (0.165 - Math.abs(i - 1.5) * 0.026) * 0.95, 0.07], len: 0.3, back: 0.6, yMin: -0.3 })), rng, base, [new THREE.Color('#1a1416'), base.clone()]);
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.13, 14), mat('#2a1e18', { roughness: 0.3, metalness: 0.3 })); sting.rotation.x = -Math.PI / 2; sting.position.set(0, -0.06, -0.42); abd.add(sting);
  const head = new THREE.Group(); head.position.set(0, 0.03, 0.2); body.add(head);
  head.add(blob(0.095, 1.15, 1, 0.85, BLK, 0, 0, 0, 18));
  furPatch(head, STRAND, [{ n: 70, c: [0, 0.02, -0.02], r: [0.1, 0.09, 0.07], len: 0.3, back: -0.3, yMin: -0.2 }], rng, new THREE.Color('#2a1e18'), [new THREE.Color('#4a3a2a')]);
  // olhos compostos: superfície com facetas finas (cor por vértice em favo) e brilho
  for (const sx of [-1, 1]) {
    const eg = new THREE.SphereGeometry(0.062, 28, 20); eg.scale(0.75, 1.15, 0.9);
    vcolor(eg, (c, x, y, z) => c.set('#3a1e3a').offsetHSL(0, 0, ((Math.sin(x * 260) + Math.sin(y * 240 + x * 130) + Math.sin(z * 250)) > 1.2 ? 0.08 : -0.03)));
    const e = new THREE.Mesh(eg, VC(0.12, { metalness: 0.35 })); e.position.set(sx * 0.082, 0.02, 0.03); head.add(e);
    const ant = new THREE.Mesh(taper([V3(sx * 0.03, 0.07, 0.05), V3(sx * 0.05, 0.14, 0.09), V3(sx * 0.06, 0.17, 0.14), V3(sx * 0.1, 0.2, 0.2)], 0.008, 0.005, 14, 6), BLK); head.add(ant); // antena dobrada (cotovelo)
    const mand = new THREE.Mesh(taper([V3(sx * 0.03, -0.06, 0.06), V3(sx * 0.02, -0.08, 0.09), V3(0, -0.085, 0.1)], 0.01, 0.004, 8, 6), mat('#3a2418')); head.add(mand);
  }
  // 6 patas com 3 segmentos e pelinhos
  const legs = []; for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { const z0 = 0.06 - i * 0.07; const l = new THREE.Mesh(taper([V3(sx * 0.07, -0.08, z0), V3(sx * 0.15, -0.12, z0 - 0.01), V3(sx * 0.17, -0.2, z0 - 0.03), V3(sx * 0.16, -0.28, z0 - 0.05 - i * 0.02), V3(sx * 0.17, -0.31, z0 - 0.02 - i * 0.02)], 0.014, 0.005, 16, 6), BLK); body.add(l); legs.push(l); }
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex(), transparent: true, side: THREE.DoubleSide, roughness: 0.1, metalness: 0.2, depthWrite: false });
  const wings = []; for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.07, 0.13, 0.04 - k * 0.07); body.add(w);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(k ? 0.24 : 0.34, k ? 0.11 : 0.15), wingMat); m.rotation.x = -Math.PI / 2; m.position.x = sx * (k ? 0.11 : 0.16); if (sx < 0) m.scale.x = -1; w.add(m); wings.push({ w, sx });
  }
  body.position.y = 1.1;
  shadowAll(root);
  let lt = 0, at = -9;
  return { root, flying: true, attack() { at = lt; }, animate(t) {
    lt = t; const sk = strike((t - at) / 0.45);
    body.position.y = 1.1 + Math.sin(t * 4) * 0.1 + Math.sin(t * 9.7) * 0.02 - Math.max(0, sk) * 0.4;
    body.position.z = sk * 0.45; body.rotation.x = -sk * 0.9 + Math.sin(t * 3.1) * 0.05; body.rotation.z = Math.sin(t * 2.3) * 0.06;
    abd.rotation.x = 0.15 + Math.sin(t * 6) * 0.06 + Math.max(0, sk) * 0.6;
    wings.forEach(({ w, sx }) => { w.rotation.z = sx * Math.sin(t * 55) * 0.7; });
    legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 3 + i) * 0.08; });
  } };
}

// lobo realista: costas escuras, peito profundo, focinho comprido com mandíbula, rabo felpudo
// junta as peças fixas (filhos diretos do grupo) por material: menos chamadas de desenho
function bakeChildren(g) {
  const by = new Map();
  for (const o of [...g.children]) {
    if (!o.isMesh || o.isInstancedMesh) continue;
    o.updateMatrix(); const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') geo.deleteAttribute(k);
    (by.get(o.material) || by.set(o.material, []).get(o.material)).push(geo); g.remove(o);
  }
  for (const [m, geos] of by) g.add(new THREE.Mesh(mergeGeometries(geos), m));
}
// pelagem: tufos finos e curvos espalhados sobre elipsoides, deitados para trás (um InstancedMesh por grupo)
// mecha de pelo: folha larga, curta e achatada, que se deita sobre o corpo (nada de espinho)
const FUR_GEO = (() => { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.017, 0.05, 0.006); g.translate(0, 0.045, 0); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setZ(i, P.getZ(i) - y * y * 3.5); P.setX(i, P.getX(i) * (1 - y * 4)); } g.computeVertexNormals(); return g; })();
function furPatch(parent, mat, spots, rng, base, tones) {
  const total = spots.reduce((a, s) => a + s.n, 0), inst = new THREE.InstancedMesh(FUR_GEO, mat, total), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0), c = new THREE.Color();
  let k = 0;
  for (const s of spots) for (let i = 0; i < s.n; i++) {
    // ponto na superfície do elipsoide (só na faixa pedida)
    let nx, ny, nz; do { nx = rng() * 2 - 1; ny = rng() * 2 - 1; nz = rng() * 2 - 1; } while (nx * nx + ny * ny + nz * nz > 1 || (s.yMin !== undefined && ny < s.yMin));
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const px = s.c[0] + nx * s.r[0], py = s.c[1] + ny * s.r[1], pz = s.c[2] + nz * s.r[2];
    const nrm = V3(nx / s.r[0], ny / s.r[1], nz / s.r[2]).normalize(), along = V3(0, -0.1, -Math.sign(s.back || 1)).projectOnPlane(nrm).normalize();
    const dir = along.multiplyScalar(1).add(nrm.clone().multiplyScalar(0.28)).normalize(); // quase tangente: deita sobre o corpo, apontando para trás
    q.setFromUnitVectors(up, dir); const spin = new THREE.Quaternion().setFromAxisAngle(dir, Math.atan2(nrm.x, nrm.z)); q.premultiply(spin);
    const px2 = px - nrm.x * 0.01, py2 = py - nrm.y * 0.01, pz2 = pz - nrm.z * 0.01;
    const sc = s.len * (0.7 + rng() * 0.6);
    m.compose(V3(px2, py2, pz2), q, V3(1 + rng() * 0.5, sc, 1)); inst.setMatrixAt(k, m);
    c.copy(base).lerp(tones[Math.floor(rng() * tones.length)], rng() * 0.6); inst.setColorAt(k, c); k++;
  }
  inst.castShadow = false; inst.receiveShadow = false; parent.add(inst); return inst;
}
// pata com almofada, 4 dedos e unhas
function pawGeo(mat, clawMat) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), mat); pad.scale.set(1, 0.5, 1.35); pad.position.z = 0.02; g.add(pad);
  for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.024, toe = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat); toe.scale.set(1, 0.8, 1.2); toe.position.set(x, -0.005, 0.075 - Math.abs(k - 1.5) * 0.012); g.add(toe); const cl = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 8), clawMat); cl.rotation.x = Math.PI / 2 + 0.4; cl.position.set(x, -0.01, 0.097 - Math.abs(k - 1.5) * 0.012); g.add(cl); }
  return g;
}
export function wolf(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 1 + Math.floor(Math.random() * 9999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const base = new THREE.Color(color);
  const FUR = mat(base, { roughness: 0.92 }), BACK = mat(base.clone().offsetHSL(0, 0, -0.14), { roughness: 0.95 }), LIGHT = mat(base.clone().offsetHSL(0, -0.08, 0.16), { roughness: 0.92 });
  const NOSE = mat('#141012', { roughness: 0.3 }), MOUTH = mat('#5a2a2a', { roughness: 0.6 }), TOOTH = mat('#f2ede0', { roughness: 0.4 }), INNER = mat(base.clone().lerp(new THREE.Color('#c99a8a'), 0.45), { roughness: 0.8 }), CLAW = mat('#2a2420', { roughness: 0.4 });
  const STRAND = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide });
  const tones = [base.clone().offsetHSL(0, 0, -0.18), base.clone().offsetHSL(0, -0.05, 0.12), base.clone().offsetHSL(0.02, 0.05, -0.05)];
  // volume do corpo (por baixo da pelagem)
  body.add(blob(0.2, 1, 1.05, 1.9, FUR, 0, 0.66, -0.04, 20));
  body.add(blob(0.24, 1, 1.18, 1, FUR, 0, 0.66, 0.3, 18));
  body.add(blob(0.2, 1, 0.95, 1.05, FUR, 0, 0.69, -0.36, 16));
  body.add(blob(0.18, 0.95, 0.6, 2.0, BACK, 0, 0.78, -0.04, 16));
  body.add(blob(0.16, 0.85, 0.6, 1.8, LIGHT, 0, 0.53, 0.06, 14));
  bakeChildren(body);
  // pelagem: costas, flancos, juba do pescoço e peito
  furPatch(body, STRAND, [
    { n: 306, c: [0, 0.7, -0.04], r: [0.2, 0.21, 0.38], len: 0.75, back: 1.2, yMin: -0.2 },
    { n: 126, c: [0, 0.7, -0.36], r: [0.2, 0.19, 0.21], len: 0.7, back: 1.0, yMin: -0.1 },
    { n: 216, c: [0, 0.74, 0.34], r: [0.25, 0.27, 0.22], len: 1.15, back: 0.8, yMin: -0.6 }, // juba
  ], rng, base, tones);
  const neck = new THREE.Group(); neck.position.set(0, 0.78, 0.4); body.add(neck);
  neck.add(new THREE.Mesh(taper([V3(0, -0.04, -0.06), V3(0, 0.08, 0.08), V3(0, 0.14, 0.17)], 0.15, 0.12, 8, 12), FUR));
  furPatch(neck, STRAND, [{ n: 108, c: [0, 0.06, 0.06], r: [0.15, 0.14, 0.12], len: 1.0, back: 1.3 }], rng, base, tones);
  const head = new THREE.Group(); head.position.set(0, 0.16, 0.2); head.scale.setScalar(1.18); neck.add(head);
  const skull = new THREE.Group(); head.add(skull);
  skull.add(blob(0.13, 1, 0.88, 1.12, FUR, 0, 0, 0, 20));
  skull.add(blob(0.06, 1.15, 0.7, 1.1, LIGHT, 0, -0.045, 0.06, 14)); // queixo/garganta claros
  skull.add(new THREE.Mesh(taper([V3(0, -0.015, 0.08), V3(0, -0.035, 0.2), V3(0, -0.05, 0.31)], 0.07, 0.038, 18, 24), FUR)); // focinho
  skull.add(new THREE.Mesh(taper([V3(0, 0.02, 0.06), V3(0, -0.005, 0.2), V3(0, -0.025, 0.3)], 0.032, 0.02, 16, 20), BACK)); // ponte do focinho mais escura
  skull.add(blob(0.022, 1.35, 0.9, 1, NOSE, 0, -0.035, 0.33, 12));
  for (const sx of [-1, 1]) skull.add(blob(0.04, 1.3, 0.55, 0.7, LIGHT, sx * 0.075, 0.06, 0.08, 10)); // sobrancelhas claras (máscara de lobo)
  bakeChildren(skull);
  // bochechas de pelo varrendo para trás (no lugar das "bolas")
  furPatch(head, STRAND, [{ n: 126, c: [0, -0.02, 0.0], r: [0.13, 0.11, 0.12], len: 0.75, back: 1.6, yMin: -0.7 }], rng, base, tones);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.075, 0.08); head.add(jaw);
  jaw.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.01, 0.12), V3(0, -0.005, 0.2)], 0.048, 0.028, 12, 20), LIGHT));
  jaw.add(blob(0.028, 1, 0.4, 2.2, MOUTH, 0, 0.022, 0.12, 10));
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.032, 14), TOOTH); f.rotation.x = Math.PI; f.position.set(sx * 0.024, -0.068, 0.27); head.add(f); }
  for (const sx of [-1, 1]) {
    head.add(blob(0.021, 1.5, 0.75, 0.6, mat('#e8b04a', { emissive: '#c07010', emissiveIntensity: 0.25, roughness: 0.15 }), sx * 0.068, 0.035, 0.12, 12));
    head.add(blob(0.009, 1, 1.25, 0.6, NOSE, sx * 0.07, 0.035, 0.133, 8));
  }
  // orelhas em concha: fora escura, dentro clara, com tufo
  const earG = new THREE.ConeGeometry(0.06, 0.17, 18, 4, true, -Math.PI * 0.62, Math.PI * 1.24); earG.translate(0, 0.085, 0);
  const earIn = new THREE.ConeGeometry(0.045, 0.13, 14, 3, true, -Math.PI * 0.55, Math.PI * 1.1); earIn.translate(0, 0.07, 0.008);
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.075, 0.08, -0.03); e.rotation.set(-0.15, sx * 0.25, -sx * 0.22); head.add(e);
    const out = new THREE.Mesh(earG, mat(base.clone().offsetHSL(0, 0, -0.14), { roughness: 0.95, side: THREE.DoubleSide })); out.scale.z = 0.55; e.add(out);
    const inn = new THREE.Mesh(earIn, mat(INNER.color, { roughness: 0.85, side: THREE.DoubleSide })); inn.scale.z = 0.5; inn.rotation.y = Math.PI; e.add(inn);
    return e;
  });
  // rabo peludo
  const tail = new THREE.Group(); tail.position.set(0, 0.76, -0.52); body.add(tail);
  const tailCurve = [V3(0, 0, 0), V3(0, -0.05, -0.18), V3(0, -0.2, -0.32), V3(0, -0.36, -0.38)];
  tail.add(new THREE.Mesh(taper(tailCurve, 0.06, 0.085, 16, 12), FUR));
  furPatch(tail, STRAND, [{ n: 81, c: [0, -0.08, -0.22], r: [0.09, 0.12, 0.13], len: 1.1, back: -0.4 }, { n: 72, c: [0, -0.3, -0.36], r: [0.09, 0.1, 0.08], len: 1.0, back: -0.2 }], rng, base, tones);
  tail.add(blob(0.07, 1, 1.5, 1, BACK, 0, -0.4, -0.39, 14));
  const legs = [[-0.12, 0.3, true], [0.12, 0.3, true], [-0.13, -0.36, false], [0.13, -0.36, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.62, z); body.add(pv);
    pv.add(new THREE.Mesh(taper([V3(0, 0.08, 0), V3(0, -0.12, front ? 0.01 : -0.05), V3(0, -0.28, front ? 0 : -0.07)], front ? 0.075 : 0.09, 0.042, 10, 12), FUR));
    const knee = new THREE.Group(); knee.position.set(0, -0.28, front ? 0 : -0.07); pv.add(knee);
    knee.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.15, front ? 0.01 : 0.05), V3(0, -0.28, front ? 0.02 : 0.07)], 0.04, 0.03, 10, 10), LIGHT));
    const paw = pawGeo(LIGHT, CLAW); paw.position.set(0, -0.3, front ? 0.03 : 0.08); knee.add(paw);
    return { pv, knee, paw, front };
  });
  shadowAll(root);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#e8b04a' }); // (compatível: brilha quando bravo)
  let ph = 0, gait = 0, lt = 0, at = -9, sniff = 0;
  return { root, eyeMat, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; gait += ((moving ? 1 : 0) - gait) * Math.min(1, dt * 6);
    ph += dt * (2 + gait * 10);
    const sk = strike((t - at) / 0.5);
    legs.forEach(({ pv, knee, paw, front }, i) => { const p = ph + (i % 2 ? Math.PI : 0) + (front ? 0 : Math.PI * 0.5); pv.rotation.x = Math.sin(p) * 0.55 * gait - (front ? sk * 0.5 : -sk * 0.3); knee.rotation.x = (front ? -1 : 1) * Math.max(0, Math.cos(p)) * 0.7 * gait; paw.rotation.x = Math.max(0, -Math.sin(p)) * 0.6 * gait - pv.rotation.x * 0.5; }); // a pata dobra ao levantar
    const breath = Math.sin(t * (moving ? 6 : 2.2)) * 0.02;
    body.scale.set(1 + breath, 1 + breath * 0.5, 1);
    body.position.y = Math.abs(Math.sin(ph)) * 0.04 * gait + Math.max(0, sk) * 0.08;
    body.position.z = sk * 0.3; body.rotation.x = Math.sin(ph * 2) * 0.03 * gait - sk * 0.12;
    // parado: de vez em quando abaixa a cabeça e fareja o chão
    const sniffWant = !moving && Math.sin(t * 0.45 + 1.3) > 0.55 ? 1 : 0; sniff += (sniffWant - sniff) * Math.min(1, dt * 2.5);
    neck.rotation.x = Math.sin(ph * 2) * 0.06 * gait + Math.sin(t * 0.8) * 0.03 * (1 - gait) + sk * 0.35 + sniff * 0.55;
    neck.rotation.y = Math.sin(t * 0.5) * 0.25 * (1 - gait) * (1 - sniff) * (sk ? 0 : 1) + sniff * Math.sin(t * 3) * 0.12;
    head.rotation.x = -sniff * 0.15 + Math.sin(t * 11) * 0.02 * sniff;
    jaw.rotation.x = Math.max(0, sk) * 0.75 + (moving ? 0.1 : 0) + Math.max(0, Math.sin(t * 1.3)) * 0.04 * (1 - gait);
    ears.forEach((e, i) => { const tw = Math.max(0, Math.sin(t * 0.9 + i * 2.1) - 0.93) * 6; e.rotation.x = -0.15 - 0.35 * gait - Math.max(0, sk) * 0.5 + tw * 0.4; e.rotation.z = (i ? -1 : 1) * 0.22 + tw * (i ? -0.2 : 0.2); }); // orelhas mexem sozinhas
    tail.rotation.y = Math.sin(t * (2.5 + gait * 6)) * (0.3 + gait * 0.1); tail.rotation.x = 0.35 * gait - 0.05 + Math.max(0, sk) * 0.35 + Math.sin(ph) * 0.06 * gait;
  } };
}

/* ---------- Boneco de treino (S-090): espírito de ginásio grego ----------
   Mastro de madeira, corpo de palha amarrado com tiras de couro, elmo de bronze com crista vermelha,
   escudo redondo de bronze com um sol pintado, espada de madeira e base de pedra com friso grego.
   Balança numa mola quando apanha e solta palha. Nunca morre. */
export function dummy() {
  const root = new THREE.Group(), sway = new THREE.Group(); root.add(sway);
  const wood = mat('#7a5232', { roughness: 0.85 }), straw = mat('#d9b866', { roughness: 1 }), leather = mat('#6a3a1e', { roughness: 0.7 });
  const bronze = mat('#c08a3a', { metalness: 0.75, roughness: 0.32 }), red = mat('#b3262a', { roughness: 0.8 }), stone = mat('#b9b2a2', { roughness: 0.9 });
  // base de pedra com friso grego (meandro pintado numa textura)
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const g = cv.getContext('2d'); g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, 256, 32); g.strokeStyle = '#6a4a2a'; g.lineWidth = 3;
  g.beginPath(); for (let x = 0; x < 256; x += 32) { g.moveTo(x + 4, 26); g.lineTo(x + 4, 6); g.lineTo(x + 24, 6); g.lineTo(x + 24, 20); g.lineTo(x + 12, 20); g.lineTo(x + 12, 13); g.lineTo(x + 18, 13); g.moveTo(x + 4, 26); g.lineTo(x + 36, 26); } g.stroke();
  const ftex = new THREE.CanvasTexture(cv); ftex.colorSpace = THREE.SRGBColorSpace; ftex.wrapS = THREE.RepeatWrapping; ftex.repeat.set(3, 1);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.28, 32), [new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.9 }), stone, stone]); base.position.y = 0.14; root.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.08, 32), stone); step.position.y = 0.04; root.add(step);
  // mastro e corpo (a parte de cima balança)
  sway.position.y = 0.28;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 14), wood); pole.position.y = 0.9; sway.add(pole);
  const torsoG = new THREE.SphereGeometry(0.27, 28, 20), TP = torsoG.attributes.position;
  for (let k = 0; k < TP.count; k++) { const x = TP.getX(k), y = TP.getY(k), z = TP.getZ(k), a = Math.atan2(z, x); const ridge = 1 + Math.sin(a * 22 + y * 30) * 0.025; TP.setXYZ(k, x * ridge * (1 + (y < 0 ? y * 0.3 : 0)), y * 1.5, z * ridge * 0.8); }
  torsoG.computeVertexNormals();
  const torso = new THREE.Mesh(torsoG, straw); torso.position.y = 1.25; sway.add(torso);
  for (const y of [1.0, 1.25, 1.5]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.255 - Math.abs(y - 1.25) * 0.2, 0.02, 8, 32), leather); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.8, 1); band.position.y = y; sway.add(band); }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 32), leather); strap.rotation.set(0.2, 0, 0.8); strap.scale.set(1, 1.45, 0.8); strap.position.y = 1.25; sway.add(strap);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 12), wood); arm.rotation.z = Math.PI / 2; arm.position.y = 1.42; sway.add(arm);
  for (const sx of [-1, 1]) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 12, 1, true), straw); tuft.rotation.z = sx * Math.PI / 2; tuft.position.set(sx * 0.5, 1.42, 0); sway.add(tuft); }
  // cabeça de palha + elmo de bronze com crista
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), straw); head.position.y = 1.78; sway.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.175, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze); helm.position.y = 1.8; sway.add(helm);
  for (const sx of [-1, 1]) { const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12, 0, Math.PI, 0, Math.PI * 0.6), bronze); cheek.scale.set(0.45, 1.2, 1); cheek.rotation.set(Math.PI, sx * Math.PI / 2, 0); cheek.position.set(sx * 0.13, 1.74, 0.05); sway.add(cheek); }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), bronze); nose.position.set(0, 1.74, 0.17); sway.add(nose);
  const crest = new THREE.Group(); crest.position.y = 1.95; sway.add(crest);
  const cHold = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.24), bronze); cHold.position.y = 0.02; crest.add(cHold);
  for (let k = 0; k < 14; k++) { const u = k / 13, plume = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 8), red); plume.position.set(0, 0.12 - Math.abs(u - 0.5) * 0.08, -0.16 + u * 0.32); plume.rotation.x = (u - 0.5) * 1.5 - 0.2; crest.add(plume); }
  // escudo de bronze com sol pintado
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d'); sg.fillStyle = '#c08a3a'; sg.fillRect(0, 0, 128, 128);
  sg.fillStyle = '#7a1e1a'; sg.beginPath(); sg.arc(64, 64, 26, 0, 7); sg.fill(); sg.strokeStyle = '#7a1e1a'; sg.lineWidth = 6; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; sg.beginPath(); sg.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); sg.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); sg.stroke(); }
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const shieldG = new THREE.SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.22); shieldG.rotateX(Math.PI / 2);
  const shield = new THREE.Mesh(shieldG, new THREE.MeshStandardMaterial({ map: stex, metalness: 0.6, roughness: 0.35 })); shield.position.set(-0.44, 1.3, 0.12); shield.rotation.y = -0.5; sway.add(shield);
  // espada de madeira
  const sword = new THREE.Group(); sword.position.set(0.48, 1.35, 0.1); sword.rotation.set(0.3, 0, -0.35); sway.add(sword);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.02), mat('#a0763f')); blade.position.y = 0.32; sword.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.04), wood); sword.add(guard);
  shadowAll(root);
  // palha que voa quando apanha
  const bits = []; for (let k = 0; k < 10; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.012), straw); b.visible = false; root.add(b); bits.push({ b, v: V3(), life: 0 }); }
  let vel = 0, ang = 0, lt = 0, last = 0;
  return { root, hit(dir = 1) { vel += 2.6 * dir; for (const p of bits) { p.life = 0.6 + Math.random() * 0.4; p.b.visible = true; p.b.position.set((Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 0.4, 0.2); p.v.set((Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.2) * 2); } },
    animate(t) {
      const dt = Math.min(0.05, Math.max(0, t - lt)); lt = t;
      vel += (-ang * 38 - vel * 3.2) * dt; ang += vel * dt; // mola amortecida
      sway.rotation.x = ang * 0.35; sway.rotation.z = Math.sin(ang * 0.7) * 0.15; crest.rotation.x = -ang * 0.4;
      for (const p of bits) { if (p.life <= 0) continue; p.life -= dt; p.v.y -= 6 * dt; p.b.position.addScaledVector(p.v, dt); p.b.rotation.x += dt * 8; if (p.life <= 0 || p.b.position.y < 0) p.b.visible = false; }
    } };
}

export function makeCritter(shape, color, boss, variant) {
  switch (shape) {
    case 'blob': return slime(color, boss, variant);
    case 'mushroom': return mushroom(color);
    case 'dummy': return dummy();
    case 'rabbit': return rabbit(color);
    case 'bee': return bee(color);
    case 'wolf': return wolf(color);
    default: return slime(color);
  }
}
