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

export function mushroom(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.45, 16), mat('#efe4d0'));
  stem.position.y = 0.23; body.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
  cap.scale.y = 0.75; cap.position.y = 0.42; body.add(cap);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), WHITE);
    s.position.set(Math.cos(a) * 0.27, 0.62, Math.sin(a) * 0.27); body.add(s);
  }
  eyes(body, 0.28, 0.2, 0.08, 0.05);
  shadowAll(root);
  let lt = 0, at = -9;
  return { root, attack() { at = lt; }, animate(t, moving) {
    lt = t; const sk = strike((t - at) / 0.5);
    body.position.y = (moving ? Math.abs(Math.sin(t * 8)) * 0.18 : 0) + Math.max(0, sk) * 0.2;
    body.rotation.z = Math.sin(t * 2) * 0.05; body.rotation.x = sk * 0.6; // cabeçada com o chapéu
  } };
}

// coelho com proporções reais: anca grande, patas traseiras longas, orelhas compridas, olhos nas laterais
export function rabbit(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const base = new THREE.Color(color), FUR = mat(base, { roughness: 0.9 }), LIGHT = mat(base.clone().offsetHSL(0, -0.05, 0.08), { roughness: 0.9 }), DARKF = mat(base.clone().offsetHSL(0, 0, -0.12), { roughness: 0.9 });
  const PINK = mat('#e8a0a8', { roughness: 0.6 }), EYE = mat('#1a1210', { roughness: 0.15 });
  body.add(blob(0.24, 1, 0.92, 1.05, FUR, 0, 0.25, -0.1, 20));      // anca
  body.add(blob(0.17, 0.95, 1, 1, FUR, 0, 0.24, 0.13, 18));          // peito
  body.add(blob(0.15, 0.9, 0.6, 1.4, LIGHT, 0, 0.14, 0.02, 16));     // barriga
  for (const sx of [-1, 1]) body.add(blob(0.12, 0.6, 1, 1.25, FUR, sx * 0.17, 0.2, -0.12, 14)); // coxas
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.25); body.add(head);
  head.add(blob(0.12, 0.95, 0.95, 1.15, FUR, 0, 0, 0, 18));
  head.add(blob(0.07, 1.1, 0.8, 0.9, LIGHT, 0, -0.05, 0.1, 14));   // focinho
  const nose = blob(0.018, 1.3, 1, 0.8, PINK, 0, -0.03, 0.165, 8); head.add(nose);
  for (const sx of [-1, 1]) {
    head.add(blob(0.028, 0.6, 1.1, 1, EYE, sx * 0.095, 0.025, 0.05, 12));            // olho na lateral
    head.add(blob(0.008, 1, 1, 1, mat('#ffffff', { roughness: 0.1 }), sx * 0.108, 0.035, 0.065, 6));
    for (let w = 0; w < 3; w++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.002, 0.13, 16), mat('#f4efe6')); wh.rotation.z = Math.PI / 2 + (w - 1) * 0.15; wh.rotation.y = sx * 0.3; wh.position.set(sx * 0.07, -0.04, 0.12); head.add(wh); }
  }
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.045, 0.09, -0.02); head.add(e);
    const outer = new THREE.Mesh(taper([V3(0, 0, 0), V3(sx * 0.02, 0.14, -0.03), V3(sx * 0.03, 0.27, -0.07)], 0.032, 0.012, 10, 10), FUR); outer.scale.set(1, 1, 0.55); e.add(outer);
    const inner = new THREE.Mesh(taper([V3(0, 0.02, 0.012), V3(sx * 0.02, 0.14, -0.015), V3(sx * 0.028, 0.24, -0.05)], 0.02, 0.006, 10, 8), PINK); inner.scale.set(1, 1, 0.4); e.add(inner);
    return e;
  });
  // o chifre (Coelho-Chifre): pequeno e espiralado na testa
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 14, 4), mat('#e8d9a8', { roughness: 0.4 })); horn.position.set(0, 0.1, 0.07); horn.rotation.x = 0.5; head.add(horn);
  const fronts = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * 0.07, 0.18, 0.2); body.add(g); g.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.09, 0.01), V3(0, -0.17, 0.03)], 0.03, 0.022, 6, 8), FUR)); g.add(blob(0.028, 1, 0.6, 1.4, LIGHT, 0, -0.17, 0.04, 8)); return g; });
  const hinds = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * 0.15, 0.12, -0.1); body.add(g); g.add(blob(0.05, 0.75, 0.6, 2.3, FUR, 0, -0.08, 0.06, 10)); return g; });
  const tail = blob(0.06, 1, 1, 1, mat('#fbf8f2', { roughness: 1 }), 0, 0.3, -0.33, 10); body.add(tail);
  shadowAll(root);
  let lt = 0, at = -9, ph = 0;
  return { root, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; ph += dt * (moving ? 9 : 0);
    const hop = moving ? Math.max(0, Math.sin(ph)) : 0, sk = strike((t - at) / 0.45);
    body.position.y = hop * 0.22 + Math.max(0, sk) * 0.12;
    body.rotation.x = moving ? -Math.cos(ph) * 0.18 : sk * 0.35;               // inclina no salto / cabeçada
    body.position.z = sk * 0.18;
    hinds.forEach(h => { h.rotation.x = moving ? Math.max(0, -Math.cos(ph)) * 0.9 : 0; });
    fronts.forEach(f => { f.rotation.x = moving ? Math.cos(ph) * 0.6 : 0; });
    ears.forEach((e, i) => { e.rotation.x = -0.15 - hop * 0.4 + Math.sin(t * 1.3 + i * 2) * 0.05 * (moving ? 0 : 1); e.rotation.z = (i ? -1 : 1) * (0.05 + Math.max(0, Math.sin(t * 0.7 + i * 3) - 0.92) * 3); });
    nose.scale.y = 1 + Math.max(0, Math.sin(t * 9)) * 0.25 * (moving ? 0 : 1); // fuça o ar
    head.rotation.y = moving ? 0 : Math.sin(t * 0.6) * 0.3;
  } };
}

// abelha com tórax peludo, abdômen listrado, olhos compostos, antenas, 6 patas e 4 asas translúcidas
export function bee(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const C = mat(color, { roughness: 0.75 }), BLK = mat('#1a1416', { roughness: 0.6 }), FUZZ = mat(new THREE.Color(color).offsetHSL(0, -0.1, 0.15), { roughness: 1 });
  body.add(blob(0.16, 1, 0.95, 1, FUZZ, 0, 0, 0.02, 18));            // tórax
  const abd = new THREE.Group(); abd.position.set(0, -0.02, -0.12); body.add(abd);
  for (let i = 0; i < 5; i++) abd.add(blob(0.17 - Math.abs(i - 1.5) * 0.025, 1, 0.95, 0.42, i % 2 ? BLK : C, 0, -i * 0.012, -i * 0.075, 16));
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 14), BLK); sting.rotation.x = -Math.PI / 2; sting.position.set(0, -0.06, -0.42); abd.add(sting);
  const head = new THREE.Group(); head.position.set(0, 0.03, 0.2); body.add(head);
  head.add(blob(0.1, 1.15, 1, 0.85, BLK, 0, 0, 0, 14));
  for (const sx of [-1, 1]) {
    head.add(blob(0.06, 0.75, 1.15, 0.9, mat('#2a1a3a', { roughness: 0.15, metalness: 0.3 }), sx * 0.085, 0.02, 0.03, 14));
    head.add(new THREE.Mesh(taper([V3(sx * 0.03, 0.07, 0.05), V3(sx * 0.07, 0.17, 0.12), V3(sx * 0.1, 0.2, 0.2)], 0.01, 0.006, 8, 5), BLK));
  }
  const legs = []; for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { const l = new THREE.Mesh(taper([V3(sx * 0.08, -0.08, 0.06 - i * 0.07), V3(sx * 0.16, -0.14, 0.04 - i * 0.07), V3(sx * 0.17, -0.26, 0.02 - i * 0.08)], 0.012, 0.007, 8, 5), BLK); body.add(l); legs.push(l); }
  const wingMat = new THREE.MeshStandardMaterial({ color: '#eef4ff', transparent: true, opacity: 0.42, side: THREE.DoubleSide, roughness: 0.1, depthWrite: false });
  const wings = []; for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.08, 0.13, 0.04 - k * 0.07); body.add(w);
    const m = new THREE.Mesh(new THREE.CircleGeometry(k ? 0.12 : 0.17, 20), wingMat); m.scale.set(1, 0.42, 1); m.rotation.x = -Math.PI / 2; m.position.x = sx * (k ? 0.11 : 0.16); w.add(m); wings.push({ w, sx });
  }
  body.position.y = 1.1;
  shadowAll(root);
  let lt = 0, at = -9;
  return { root, flying: true, attack() { at = lt; }, animate(t) {
    lt = t; const sk = strike((t - at) / 0.45);
    body.position.y = 1.1 + Math.sin(t * 4) * 0.1 - Math.max(0, sk) * 0.4;
    body.position.z = sk * 0.45; body.rotation.x = -sk * 0.9;              // mergulha e ferroa
    abd.rotation.x = 0.15 + Math.sin(t * 6) * 0.06 + Math.max(0, sk) * 0.6;
    wings.forEach(({ w, sx }) => { w.rotation.z = sx * Math.sin(t * 55) * 0.7; });
  } };
}

// lobo realista: costas escuras, peito profundo, focinho comprido com mandíbula, rabo felpudo
export function wolf(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const base = new THREE.Color(color);
  const FUR = mat(base, { roughness: 0.92 }), BACK = mat(base.clone().offsetHSL(0, 0, -0.14), { roughness: 0.95 }), LIGHT = mat(base.clone().offsetHSL(0, -0.08, 0.16), { roughness: 0.92 });
  const NOSE = mat('#141012', { roughness: 0.3 }), MOUTH = mat('#5a2a2a', { roughness: 0.6 }), TOOTH = mat('#f2ede0', { roughness: 0.4 });
  body.add(blob(0.2, 1, 1.05, 1.9, FUR, 0, 0.66, -0.04, 20));           // tronco
  body.add(blob(0.25, 1, 1.2, 1, FUR, 0, 0.66, 0.3, 18));               // peito profundo
  body.add(blob(0.2, 1, 0.95, 1.05, FUR, 0, 0.69, -0.36, 16));          // anca
  body.add(blob(0.18, 0.95, 0.6, 2.0, BACK, 0, 0.78, -0.04, 16));       // pelo mais escuro nas costas
  body.add(blob(0.16, 0.85, 0.6, 1.8, LIGHT, 0, 0.53, 0.06, 14));       // barriga clara
  const tuft = new THREE.IcosahedronGeometry(0.1, 2);                     // juba no pescoço
  for (let i = 0; i < 10; i++) { const a = (i / 9 - 0.5) * 2.8; const t = new THREE.Mesh(tuft, i % 3 ? FUR : LIGHT); t.position.set(Math.sin(a) * 0.19, 0.78 + Math.cos(a) * 0.1, 0.42 - Math.abs(Math.sin(a)) * 0.08); t.scale.set(1, 1.35, 0.75); body.add(t); }
  const neck = new THREE.Group(); neck.position.set(0, 0.78, 0.4); body.add(neck);
  neck.add(new THREE.Mesh(taper([V3(0, -0.04, -0.06), V3(0, 0.08, 0.08), V3(0, 0.14, 0.17)], 0.15, 0.12, 8, 12), FUR));
  const head = new THREE.Group(); head.position.set(0, 0.16, 0.2); head.scale.setScalar(1.18); neck.add(head);
  head.add(blob(0.14, 1, 0.9, 1.1, FUR, 0, 0, 0, 18));
  for (const sx of [-1, 1]) head.add(blob(0.075, 0.9, 0.8, 1.2, LIGHT, sx * 0.09, -0.05, 0.03, 12)); // bochechas de pelo
  head.add(new THREE.Mesh(taper([V3(0, -0.02, 0.08), V3(0, -0.04, 0.2), V3(0, -0.055, 0.31)], 0.075, 0.042, 10, 12), FUR)); // focinho
  head.add(blob(0.024, 1.4, 1, 1, NOSE, 0, -0.04, 0.33, 10));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.08); head.add(jaw);
  jaw.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.01, 0.12), V3(0, -0.005, 0.21)], 0.05, 0.03, 8, 10), LIGHT));
  jaw.add(blob(0.03, 1, 0.4, 2.2, MOUTH, 0, 0.025, 0.12, 8));
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.035, 14), TOOTH); f.rotation.x = Math.PI; f.position.set(sx * 0.025, -0.075, 0.27); head.add(f); }
  for (const sx of [-1, 1]) {
    head.add(blob(0.022, 1.5, 0.75, 0.6, mat('#e8b04a', { emissive: '#c07010', emissiveIntensity: 0.25, roughness: 0.2 }), sx * 0.07, 0.035, 0.12, 10));
    head.add(blob(0.01, 1, 1.2, 0.6, NOSE, sx * 0.072, 0.035, 0.133, 6));
  }
  const ears = [-1, 1].map(sx => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.19, 14), BACK); e.scale.set(1, 1, 0.5); e.position.set(sx * 0.08, 0.14, -0.04); e.rotation.set(-0.15, 0, -sx * 0.2); head.add(e); return e; });
  const tail = new THREE.Group(); tail.position.set(0, 0.76, -0.52); body.add(tail);
  tail.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.05, -0.18), V3(0, -0.2, -0.32), V3(0, -0.36, -0.38)], 0.065, 0.1, 16, 12), FUR));
  tail.add(blob(0.09, 1, 1.7, 1, BACK, 0, -0.4, -0.39, 12));
  const legs = [[-0.12, 0.3, true], [0.12, 0.3, true], [-0.13, -0.36, false], [0.13, -0.36, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.62, z); body.add(pv);
    pv.add(new THREE.Mesh(taper([V3(0, 0.06, 0), V3(0, -0.12, front ? 0.01 : -0.05), V3(0, -0.28, front ? 0 : -0.07)], front ? 0.07 : 0.085, 0.045, 8, 10), front ? FUR : FUR));
    const knee = new THREE.Group(); knee.position.set(0, -0.28, front ? 0 : -0.07); pv.add(knee);
    knee.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.15, front ? 0.01 : 0.05), V3(0, -0.3, front ? 0.02 : 0.07)], 0.042, 0.032, 8, 8), LIGHT));
    knee.add(blob(0.045, 1, 0.55, 1.4, LIGHT, 0, -0.31, front ? 0.05 : 0.1, 10));
    return { pv, knee, front };
  });
  shadowAll(root);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#e8b04a' }); // (compatível: brilha quando bravo)
  let ph = 0, gait = 0, lt = 0, at = -9;
  return { root, eyeMat, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; gait += ((moving ? 1 : 0) - gait) * Math.min(1, dt * 6);
    ph += dt * (2 + gait * 10);
    const sk = strike((t - at) / 0.5);
    legs.forEach(({ pv, knee, front }, i) => { const p = ph + (i % 2 ? Math.PI : 0) + (front ? 0 : Math.PI * 0.5); pv.rotation.x = Math.sin(p) * 0.55 * gait - (front ? sk * 0.5 : -sk * 0.3); knee.rotation.x = (front ? -1 : 1) * Math.max(0, Math.cos(p)) * 0.7 * gait; });
    body.position.y = Math.abs(Math.sin(ph)) * 0.04 * gait + Math.sin(t * 2) * 0.006 * (1 - gait) + Math.max(0, sk) * 0.08;
    body.position.z = sk * 0.3; body.rotation.x = Math.sin(ph * 2) * 0.03 * gait - sk * 0.12; // bote para frente
    neck.rotation.x = Math.sin(ph * 2) * 0.05 * gait + Math.sin(t * 0.8) * 0.04 * (1 - gait) + sk * 0.35;
    neck.rotation.y = Math.sin(t * 0.5) * 0.25 * (1 - gait) * (sk ? 0 : 1);
    jaw.rotation.x = Math.max(0, sk) * 0.7 + (moving ? 0.08 : 0);              // abre a boca na mordida
    ears.forEach((e, i) => { e.rotation.x = -0.15 - 0.3 * gait - Math.max(0, sk) * 0.4 + Math.sin(t * 2.3 + i) * 0.03; });
    tail.rotation.y = Math.sin(t * (2.5 + gait * 6)) * 0.3; tail.rotation.x = 0.3 * gait - 0.05 + Math.max(0, sk) * 0.3;
  } };
}

export function makeCritter(shape, color, boss, variant) {
  switch (shape) {
    case 'blob': return slime(color, boss, variant);
    case 'mushroom': return mushroom(color);
    case 'rabbit': return rabbit(color);
    case 'bee': return bee(color);
    case 'wolf': return wolf(color);
    default: return slime(color);
  }
}
