/* =========================================================================
   MASCOTES 3D — feitos em código, um visual por estágio de evolução.
   makePet(species, stage) devolve { obj, root, animate(t, {speed, turn}, dt), attack(), height }.
   Rodada S-110/S-111/S-112: corpos esculpidos numa peça só (vértices deformados, sombreado liso),
   pelagem em mechas finas, cor por vértice. attack() toca um golpe curto dentro de animate():
     raposa → bote com mordida (como o lobo), tatu → empina e bate o casco no chão, bolha → pulso de cura.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const glow = (color, intensity = 1.2, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra });
const VC = (r = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, ...extra });
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
const smooth = (cur, to, dt, k) => cur + (to - cur) * (1 - Math.exp(-dt * k));
// golpe: curva 0→1→0 (preparo para trás, bote e volta)
const strike = k => k < 0 || k > 1 ? 0 : k < 0.3 ? -Math.sin(k / 0.3 * Math.PI / 2) * 0.3 : Math.sin((k - 0.3) / 0.7 * Math.PI);
const shadows = o => o.traverse(c => { if (c.isMesh && !c.userData.noShadow) c.castShadow = true; });
let SEED = 1; const rnd = () => (SEED = SEED * 16807 % 2147483647) / 2147483647;

// esfera sem costura (vértices soldados) deformada por fn(v, nx, ny, nz) → peça orgânica única
function sculpt(w, h, fn) {
  let g = new THREE.SphereGeometry(1, w, h); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)); const nx = v.x, ny = v.y, nz = v.z; fn(v, nx, ny, nz); P.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function vcolor(g, fn) {
  const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i), N ? N.getY(i) : 0, i); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
// tubo que afina ao longo de uma curva; raio pode ser função de u (0..1)
function taper(points, r0, r1, seg = 16, radial = 12, rf = null) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const u = i / seg, r = rf ? rf(u) : r0 + (r1 - r0) * u, c = curve.getPointAt(u); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r); } }
  // fecha as pontas com uma "tampa" arredondada (sem buraco)
  g.computeVertexNormals(); return g;
}
const capSphere = (r, x, y, z) => { const g = new THREE.SphereGeometry(r, 14, 10); g.translate(x, y, z); return g; };
const strip = g => { const x = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k); return x; };
const merged = (geos, m) => new THREE.Mesh(mergeGeometries(geos.map(strip)), m);
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = null) => { if (s) g.scale(...s); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };

// mecha de pelo fina, curva e achatada (deita sobre o corpo — nada de espinho)
const FUR_GEO = (() => { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.0055, 0.026, 0.0025); g.translate(0, 0.023, 0); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setZ(i, P.getZ(i) - y * y * 6); P.setX(i, P.getX(i) * (1 - y * 6)); } g.computeVertexNormals(); return g; })();
const STRAND = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide });
// spots: { n, c:[x,y,z], r:[rx,ry,rz], len, back (direção ±z para onde a mecha deita), yMin, col, tones, zMin, zMax }
function furPatch(parent, matl, spots) {
  const total = spots.reduce((a, s) => a + s.n, 0), inst = new THREE.InstancedMesh(FUR_GEO, matl, total), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0), c = new THREE.Color();
  let k = 0;
  for (const s of spots) for (let i = 0; i < s.n; i++) {
    let nx, ny, nz, tries = 0;
    do { nx = rnd() * 2 - 1; ny = rnd() * 2 - 1; nz = rnd() * 2 - 1; tries++; } while (tries < 200 && (nx * nx + ny * ny + nz * nz > 1 || nx * nx + ny * ny + nz * nz < 0.05 || (s.yMin !== undefined && ny / Math.hypot(nx, ny, nz) < s.yMin) || (s.zMin !== undefined && nz / Math.hypot(nx, ny, nz) < s.zMin) || (s.zMax !== undefined && nz / Math.hypot(nx, ny, nz) > s.zMax)));
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const px = s.c[0] + nx * s.r[0], py = s.c[1] + ny * s.r[1], pz = s.c[2] + nz * s.r[2];
    const nrm = V3(nx / s.r[0], ny / s.r[1], nz / s.r[2]).normalize();
    let along = (s.dir ? V3(...s.dir) : V3(0, -0.15, -Math.sign(s.back || 1))).projectOnPlane(nrm); if (along.lengthSq() < 1e-4) along = V3(0, -1, 0).projectOnPlane(nrm); along.normalize();
    const dir = along.add(nrm.clone().multiplyScalar(s.lift ?? 0.15)).normalize();
    q.setFromUnitVectors(up, dir); q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, Math.atan2(nrm.x, nrm.z)));
    const sc = s.len * (0.7 + rnd() * 0.6);
    m.compose(V3(px - nrm.x * 0.004, py - nrm.y * 0.004, pz - nrm.z * 0.004), q, V3((s.w || 1) * (1 + rnd() * 0.5), sc, 1)); inst.setMatrixAt(k, m);
    const tones = s.tones || [s.col];
    c.set(s.col).lerp(new THREE.Color(tones[Math.floor(rnd() * tones.length)]), rnd() * 0.7); inst.setColorAt(k, c); k++;
  }
  inst.castShadow = false; inst.receiveShadow = false; inst.userData.noShadow = true; parent.add(inst); return inst;
}
// pelagem plantada na superfície REAL de uma geometria (sorteio por área de triângulo, normal interpolada)
// layers: { n, len, dir, lift, col, tones, color(c,x,y,z) opcional (cor da pele embaixo), filter(x,y,z) opcional }
function furOnGeo(parent, matl, geo, layers) {
  const P = geo.attributes.position, N = geo.attributes.normal, idx = geo.index, tri = idx ? idx.count / 3 : P.count / 3;
  const vi = (t, k) => idx ? idx.getX(t * 3 + k) : t * 3 + k, A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  const cum = new Float32Array(tri); let tot = 0;
  for (let t = 0; t < tri; t++) { A.fromBufferAttribute(P, vi(t, 0)); B.fromBufferAttribute(P, vi(t, 1)); Cc.fromBufferAttribute(P, vi(t, 2)); tot += B.sub(A).cross(Cc.sub(A)).length() / 2; cum[t] = tot; }
  const total = layers.reduce((a, s) => a + s.n, 0), inst = new THREE.InstancedMesh(FUR_GEO, matl, total), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0), c = new THREE.Color(), c2 = new THREE.Color();
  const pos = new THREE.Vector3(), nrm = new THREE.Vector3(), n0 = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  let k = 0;
  for (const s of layers) for (let i = 0; i < s.n; i++) {
    let tries = 0;
    do {
      const r = rnd() * tot; let lo = 0, hi = tri - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v;
      A.fromBufferAttribute(P, vi(lo, 0)); B.fromBufferAttribute(P, vi(lo, 1)); Cc.fromBufferAttribute(P, vi(lo, 2));
      pos.set(0, 0, 0).addScaledVector(A, w).addScaledVector(B, u).addScaledVector(Cc, v);
      n0.fromBufferAttribute(N, vi(lo, 0)); n1.fromBufferAttribute(N, vi(lo, 1)); n2.fromBufferAttribute(N, vi(lo, 2));
      nrm.set(0, 0, 0).addScaledVector(n0, w).addScaledVector(n1, u).addScaledVector(n2, v).normalize();
    } while (s.filter && !s.filter(pos.x, pos.y, pos.z, nrm.y) && ++tries < 60);
    let along = V3(...(s.dir || [0, -0.15, -1])).projectOnPlane(nrm); if (along.lengthSq() < 1e-4) along = V3(0, -1, 0).projectOnPlane(nrm); along.normalize();
    const dir = along.add(nrm.clone().multiplyScalar(s.lift ?? 0.12)).normalize();
    q.setFromUnitVectors(up, dir); q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, (rnd() - 0.5) * 0.6));
    const sc = s.len * (0.7 + rnd() * 0.6);
    m.compose(pos.clone().addScaledVector(nrm, -0.002), q, V3((s.w || 1) * (0.8 + rnd() * 0.5), sc, 1)); inst.setMatrixAt(k, m);
    if (s.color) { s.color(c2, pos.x, pos.y, pos.z); c.copy(c2); } else c.set(s.col);
    const tones = s.tones || [s.col]; c.lerp(c2.set(tones[Math.floor(rnd() * tones.length)]), rnd() * 0.45); inst.setColorAt(k, c); k++;
  }
  inst.castShadow = false; inst.receiveShadow = false; inst.userData.noShadow = true; parent.add(inst); return inst;
}
// chama: lágrima torcida (várias "línguas" de fogo usam a mesma)
function flameGeo(h = 1, twist = 1) {
  return sculpt(18, 14, (v, x, y, z) => {
    const t = (y + 1) / 2; // 0 base → 1 ponta
    const r = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.8) * (1 - t * 0.75);
    const a = t * t * 2.2 * twist;
    const X = x * r, Z = z * r;
    v.set(X * Math.cos(a) - Z * Math.sin(a) + Math.sin(t * 5) * 0.12 * t, t * 2.4 * h, X * Math.sin(a) + Z * Math.cos(a) - t * t * 0.35);
  });
}
const FLAME_IN = () => new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const FLAME_OUT = (c = '#ff7a1a') => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
// faíscas que sobem (pontinhos brilhantes que somem)
function embers(parent, n, color, spread, y0, rise) {
  const g = new THREE.SphereGeometry(0.008, 6, 4), m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const inst = new THREE.InstancedMesh(g, m, n); inst.userData.noShadow = true; inst.frustumCulled = false; parent.add(inst);
  const ps = Array.from({ length: n }, (_, i) => ({ off: i / n + rnd() * 0.3, x: (rnd() - 0.5) * spread, z: (rnd() - 0.5) * spread, sw: rnd() * 6 }));
  const M = new THREE.Matrix4();
  return t => { ps.forEach((p, i) => { const k = fract(t * 0.6 + p.off); M.makeScale(1 - k, 1 - k, 1 - k).setPosition(p.x + Math.sin(t * 3 + p.sw) * 0.02, y0 + k * rise, p.z + Math.cos(t * 2 + p.sw) * 0.02); inst.setMatrixAt(i, M); }); inst.instanceMatrix.needsUpdate = true; };
}

/* =========================================================================
   Faísca → Labareda → Solaris (raposa de fogo) — S-112
   Corpo, cabeça e patas esculpidos; pelagem "plantada" na superfície real (furOnGeo),
   rabo volumoso que termina em chama de verdade (línguas tremulando + brasas).
   ========================================================================= */
function fireFox(stage) {
  SEED = 4242 + stage * 17;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const coat = ['#d9682a', '#d0521a', '#e2781e'][stage], coatDark = ['#a8481a', '#982e10', '#b04e10'][stage], cream = '#f3e8d6', sock = '#2a1c18';
  const C = { coat: new THREE.Color(coat), dark: new THREE.Color(coatDark), cream: new THREE.Color(cream), sock: new THREE.Color(sock) };
  const SKIN = VC(0.88), FUR = STRAND();
  const tones = [coatDark, '#e8843a', coat];
  // ---- tronco: peito fundo, cintura fina, garupa ----
  const torsoG = sculpt(56, 40, (v, x, y, z) => {
    const front = ss(-0.2, 0.9, z), back = ss(0.2, -0.9, z);
    let X = x * 0.115 * (1 + 0.12 * front - 0.12 * ss(-0.5, 0.2, z) * (1 - ss(-0.9, -0.5, z))), Y = y * 0.12 * (1 + 0.16 * front), Z = z * 0.27;
    if (y < 0) Y *= 1 + 0.35 * front - 0.35 * ss(-0.1, -0.7, z) * (1 - back * 0.4); // peito desce, barriga recolhe
    Y += 0.02 * front * (y > 0 ? 1 : 0);
    v.set(X, Y + 0.4, Z);
  });
  const torsoCol = (c, x, y, z) => { c.copy(C.coat); if (y > 0.47) c.lerp(C.dark, 0.2); if (y < 0.37 && z > 0.05) c.lerp(C.cream, ss(0.37, 0.31, y)); if (y < 0.33) c.lerp(C.cream, 0.55); };
  vcolor(torsoG, torsoCol);
  body.add(new THREE.Mesh(torsoG, SKIN));
  furOnGeo(body, FUR, torsoG, [
    { n: 900, len: 0.8, dir: [0, -0.1, -1], lift: 0.06, col: coat, tones, color: torsoCol, filter: (x, y, z) => y > 0.33 || z < 0.05 },
    { n: 420, len: 0.65, dir: [0, -1, 0.15], lift: 0.06, col: cream, tones: ['#ffffff', '#eadcc6'], filter: (x, y, z) => y <= 0.4 && z > 0.05 },
  ]);
  // ---- pescoço + cabeça ----
  const neck = new THREE.Group(); neck.position.set(0, 0.47, 0.2); body.add(neck);
  const neckG = sculpt(28, 20, (v, x, y, z) => { const u = (y + 1) / 2; v.set(x * (0.078 - u * 0.012), (y * 0.11) + 0.04 + z * 0.0, z * (0.072 - u * 0.01) + u * 0.08 - 0.03); });
  const neckCol = (c, x, y, z) => { c.copy(C.coat); if (z > 0.015) c.lerp(C.cream, ss(0.015, 0.05, z)); };
  vcolor(neckG, neckCol);
  neck.add(new THREE.Mesh(neckG, SKIN));
  furOnGeo(neck, FUR, neckG, [{ n: 520, len: 0.95, dir: [0, -0.6, -1], lift: 0.12, col: coat, tones, color: neckCol }]);
  const head = new THREE.Group(); head.position.set(0, 0.15, 0.1); neck.add(head);
  head.scale.setScalar(stage === 0 ? 1.12 : 1);
  // crânio em cunha + focinho fino e longo (peça única)
  const hg = sculpt(72, 54, (v, x, y, z) => {
    const t = ss(0.1, 1, z); // 0 crânio → 1 ponta do focinho
    let X = x * 0.08 * (1 - 0.68 * t), Y = y * 0.072 * (1 - 0.6 * t), Z = z * 0.08 + Math.pow(Math.max(0, z - 0.1) / 0.9, 1.25) * 0.135;
    Y += -0.026 * t; if (y > 0) Y -= 0.007 * Math.exp(-Math.pow((z - 0.3) / 0.15, 2)); // "degrau" da testa
    if (y < 0.3 && z < 0.4 && z > -0.6) X *= 1 + 0.18 * (1 - Math.abs(z + 0.1)) * (1 - Math.max(0, y)); // bochechas
    if (y > 0.4) Y *= 0.93;
    v.set(X, Y, Z);
  });
  const headCol = (c, x, y, z) => {
    c.copy(C.coat); if (y > 0.02 && Math.abs(x) < 0.03) c.lerp(C.dark, 0.2);
    if ((y < -0.006 + (z - 0.05) * 0.08 && z > -0.02) || (y < 0.0 && z > -0.07 && Math.abs(x) > 0.04)) c.lerp(C.cream, 0.92);
    if (z > 0.17) c.lerp(C.sock, ss(0.17, 0.2, z) * 0.6);
  };
  vcolor(hg, headCol);
  head.add(new THREE.Mesh(hg, SKIN));
  furOnGeo(head, FUR, hg, [
    { n: 260, len: 0.55, dir: [0, -0.3, -1], lift: 0.08, col: coat, tones, color: headCol, filter: (x, y, z) => z < 0.06 },
    { n: 140, len: 0.95, dir: [0, -0.5, -1], lift: 0.35, col: cream, tones: ['#fff'], color: headCol, filter: (x, y, z) => z < 0.05 && z > -0.06 && y < 0 && Math.abs(x) > 0.045 }, // bochechas em leque
  ]);
  const noseG = new THREE.SphereGeometry(0.0135, 18, 12); noseG.scale(1.25, 0.85, 0.9);
  head.add(merged([at(noseG, 0, -0.027, 0.212)], mat('#151012', { roughness: 0.25 })));
  // maxilar que abre na mordida
  const jaw = new THREE.Group(); jaw.position.set(0, -0.034, 0.06); head.add(jaw);
  const jawG = sculpt(24, 16, (v, x, y, z) => { const u = (z + 1) / 2; v.set(x * 0.026 * (1 - u * 0.55), y * 0.013 * (1 - u * 0.4), z * 0.07 + 0.05); }); vcolor(jawG, c => c.copy(C.cream));
  jaw.add(new THREE.Mesh(jawG, SKIN));
  jaw.add(merged([at(new THREE.SphereGeometry(0.02, 12, 8), 0, 0.012, 0.07, 0, 0, 0, [1, 0.35, 2.4])], mat('#6a2a2a', { roughness: 0.6 })));
  // olhos amendoados âmbar com pupila em fenda, contorno escuro e brilho
  // olho numa peça só (contorno, íris, pupila e brilho por cor de vértice)
  const EYE_M = VC(0.12), part = (g, col) => vcolor(g, c => c.set(col));
  for (const sx of [-1, 1]) {
    const eg = mergeGeometries([
      part(at(new THREE.SphereGeometry(0.0175, 20, 14), 0, 0, -0.002, 0, 0, 0, [1.45, 1.0, 0.6]), '#1a1210'),
      part(at(new THREE.SphereGeometry(0.0155, 20, 14), 0, 0, 0.0015, 0, 0, 0, [1.35, 0.9, 0.55]), '#f0a830'),
      part(at(new THREE.SphereGeometry(0.0155, 12, 10), 0, 0, 0.0035, 0, 0, 0, [0.22, 0.62, 0.55]), '#0b0806'),
      part(at(new THREE.SphereGeometry(0.003, 8, 6), 0.006, 0.004, 0.0105), '#ffffff')].map(strip));
    const e = new THREE.Mesh(eg, EYE_M); e.position.set(sx * 0.042, 0.014, 0.068); e.rotation.set(0, sx * 0.5, -sx * 0.22); head.add(e);
  }
  // orelhas altas, em concha, ponta preta e por dentro peludas
  const earShape = new THREE.Shape(); earShape.moveTo(-0.042, 0); earShape.quadraticCurveTo(-0.04, 0.08, -0.004, 0.135); earShape.quadraticCurveTo(0, 0.142, 0.004, 0.135); earShape.quadraticCurveTo(0.04, 0.08, 0.042, 0); earShape.quadraticCurveTo(0, -0.01, -0.042, 0);
  let earOut = new THREE.ExtrudeGeometry(earShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3, curveSegments: 12 });
  { const P = earOut.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); P.setZ(k, P.getZ(k) - x * x * 9 * (1 - y * 4)); } }
  earOut = mergeVertices((earOut.deleteAttribute('uv'), earOut.deleteAttribute('normal'), earOut)); earOut.computeVertexNormals();
  vcolor(earOut, (c, x, y) => { c.copy(C.coat).lerp(C.sock, ss(0.07, 0.1, y)); });
  const inShape = new THREE.Shape(); inShape.moveTo(-0.026, 0.01); inShape.quadraticCurveTo(-0.022, 0.06, 0, 0.1); inShape.quadraticCurveTo(0.022, 0.06, 0.026, 0.01); inShape.quadraticCurveTo(0, 0.004, -0.026, 0.01);
  const earIn = new THREE.ShapeGeometry(inShape, 10); { const P = earIn.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); P.setZ(k, 0.016 - x * x * 9 * (1 - y * 4) + 0.002); } earIn.computeVertexNormals(); }
  vcolor(earIn, (c, x, y) => c.set('#3a2620').lerp(C.cream, ss(0.075, 0.01, y) * 0.85));
  const earG = mergeGeometries([strip(earOut), strip(earIn)]);
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.043, 0.048, -0.03); e.rotation.set(-0.2, sx * 0.28, -sx * 0.32); head.add(e);
    e.add(new THREE.Mesh(earG, SKIN));
    furOnGeo(e, FUR, earIn, [{ n: 34, len: 0.75, w: 0.6, dir: [0, 1, 0.6], lift: 0.5, col: cream, tones: ['#fff', '#d8c8b4'], filter: (x, y) => y < 0.055 }]);
    if (stage >= 1) { const f = new THREE.Mesh(flameGeo(1, 0.5), FLAME_OUT(stage === 2 ? '#ffb020' : '#ff6a12')); f.scale.setScalar(stage === 2 ? 0.016 : 0.011); f.position.y = 0.128; f.userData.noShadow = true; e.add(f); e.userData.flame = f; }
    return e;
  });
  if (stage === 2) { // marca solar na testa
    const mk = new THREE.Mesh(flameGeo(0.8, 0), glow('#ffd23a', 1.6)); mk.scale.set(0.011, 0.011, 0.004); mk.rotation.x = -1.25; mk.position.set(0, 0.058, 0.03); head.add(mk);
  }
  // ---- juba de brasas (Labareda e Solaris): pelos do pescoço com ponta incandescente ----
  let mane = null;
  if (stage >= 1) {
    const EMBER = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff4a08', emissiveIntensity: stage === 2 ? 0.9 : 0.55, roughness: 0.8, side: THREE.DoubleSide });
    mane = furOnGeo(neck, EMBER, neckG, [{ n: stage === 2 ? 320 : 200, len: stage === 2 ? 1.5 : 1.2, dir: [0, -0.2, -1], lift: 0.25, col: '#ff8a2a', tones: ['#ffd04a', '#ff5a10', '#c8300a'], filter: (x, y, z) => z < 0.02 }]);
  }
  // ---- patas finas: ombro/coxa esculpidos, canela fina e meia escura, pata digitígrada ----
  const PAW = (px, py, pz) => { const toes = [at(new THREE.SphereGeometry(0.019, 14, 10), px, py + 0.006, pz + 0.01, 0, 0, 0, [1.1, 0.55, 1.4])]; for (let k = 0; k < 4; k++) toes.push(at(new THREE.SphereGeometry(0.008, 10, 8), px + (k - 1.5) * 0.009, py + 0.003, pz + 0.028 - Math.abs(k - 1.5) * 0.004, 0, 0, 0, [1, 0.8, 1.3])); return toes.map(g => vcolor(strip(g), c => c.copy(C.sock))); };
  const legs = [[-0.062, 0.17, true], [0.062, 0.17, true], [-0.066, -0.19, false], [0.066, -0.19, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.42, z); body.add(pv);
    const sx = Math.sign(x);
    // ombro/coxa: gota esculpida que nasce dentro do tronco
    const thigh = sculpt(28, 20, (v, xx, y, zz) => { const u = (1 - y) / 2; const r = front ? 0.04 * (1 - u * 0.55) : 0.058 * (1 - u * 0.6); v.set(xx * r * 0.85, y * (front ? 0.11 : 0.1) - (front ? 0.08 : 0.06), zz * r + (front ? 0 : -u * 0.06)); });
    const legCol = (c, xx, y) => c.copy(C.coat).lerp(C.dark, ss(-0.05, -0.15, y) * 0.4);
    vcolor(thigh, legCol); pv.add(new THREE.Mesh(thigh, SKIN));
    furOnGeo(pv, FUR, thigh, [{ n: 150, len: 0.7, dir: [0, -1, -0.2], lift: 0.06, col: coat, tones, color: legCol, filter: (xx, y) => y > -0.15 }]);
    const knee = new THREE.Group(); knee.position.set(0, front ? -0.17 : -0.15, front ? 0 : -0.06); pv.add(knee);
    const shin = front ? taper([V3(0, 0.03, 0), V3(0, -0.1, 0.006), V3(0, -0.22, 0.01)], 0.02, 0.012, 12, 12) : taper([V3(0, 0.03, -0.005), V3(0, -0.1, 0.03), V3(0, -0.2, 0.06)], 0.022, 0.012, 12, 12);
    vcolor(shin, (c, xx, y) => c.copy(C.coat).lerp(C.sock, ss(0.01, -0.06, y)));
    const cap = vcolor(strip(capSphere(front ? 0.02 : 0.022, 0, 0.03, front ? 0 : -0.005)), c => c.copy(C.coat));
    knee.add(new THREE.Mesh(mergeGeometries([strip(shin), cap, ...PAW(0, front ? -0.235 : -0.21, front ? 0.012 : 0.062)]), SKIN));
    return { pv, knee, front, x };
  });
  // ---- rabo(s) volumoso(s) que termina(m) em chama ----
  const tails = [], nT = stage + 1;
  for (let i = 0; i < nT; i++) {
    const spread = nT === 1 ? 0 : (i / (nT - 1) - 0.5) * (nT === 2 ? 0.7 : 1.0);
    const base = new THREE.Group(); base.position.set(0, 0.45, -0.24); base.rotation.y = spread; body.add(base);
    const mid = new THREE.Group(); mid.position.set(0, -0.07, -0.13); base.add(mid);
    const tg1 = sculpt(24, 18, (v, x, y, z) => { const u = (1 - z) / 2; const r = 0.032 + 0.03 * u; v.set(x * r, y * r - u * 0.08 + 0.01, z * 0.085 - 0.07); });
    const tg2 = sculpt(28, 20, (v, x, y, z) => { const u = (1 - z) / 2; const r = 0.068 * Math.sin(Math.PI * (0.25 + u * 0.75)) + 0.008; v.set(x * r, y * r + u * u * 0.05, z * 0.12 - 0.1); });
    const tailCol = (c, x, y, z) => c.copy(C.coat).lerp(new THREE.Color('#ffb040'), ss(-0.13, -0.21, z));
    vcolor(tg1, tailCol); vcolor(tg2, tailCol);
    base.add(new THREE.Mesh(tg1, SKIN)); mid.add(new THREE.Mesh(tg2, SKIN));
    furOnGeo(base, FUR, tg1, [{ n: 240, len: 1.05, dir: [0, 0, -1], lift: 0.25, col: coat, tones }]);
    furOnGeo(mid, FUR, tg2, [{ n: 520, len: 1.3, dir: [0, 0, -1], lift: 0.3, col: coat, tones: [...tones, '#ffb040'], color: tailCol }]);
    // chama da ponta: 4 línguas que tremulam (fora mais escura, dentro clara) + núcleo
    const fl = new THREE.Group(); fl.position.set(0, 0.05, -0.215); fl.rotation.x = -0.45; mid.add(fl);
    const s0 = 0.046 + stage * 0.008, tongues = [];
    for (let k = 0; k < 2; k++) { const o = new THREE.Mesh(flameGeo(0.9 + k * 0.12, k % 2 ? -1 : 1), new THREE.MeshBasicMaterial({ color: stage === 2 ? ['#ffb020', '#ff8a10', '#ffc840', '#ff9a20'][k] : ['#ff5a0a', '#ff7a14', '#e8400a', '#ff6a10'][k], transparent: true, opacity: 0.88, depthWrite: false })); o.scale.setScalar(s0 * (1 - k * 0.1)); o.rotation.y = k * 2.4; o.position.set(Math.sin(k * 2.4) * 0.008, 0, Math.cos(k * 2.4) * 0.008); o.renderOrder = 2; fl.add(o); tongues.push({ m: o, s: s0 * (1 - k * 0.1), ph: k * 1.7 + i }); }
    const core = new THREE.Mesh(flameGeo(0.75, 0.6), new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9, depthWrite: false })); core.scale.setScalar(s0 * 0.55); core.position.y = 0.003; core.renderOrder = 3; fl.add(core); tongues.push({ m: core, s: s0 * 0.55, ph: 0.5 });
    fl.traverse(o => { o.userData.noShadow = true; });
    tails.push({ base, mid, fl, tongues, phase: i * 1.3, spread });
  }
  const emberFx = embers(root, 6 + stage * 6, stage === 2 ? '#ffe070' : '#ffa040', 0.25, 0.45, 0.6);
  let light = null; if (stage >= 1) { light = vlight(stage === 2 ? '#ffb04a' : '#ff8a3a', stage === 2 ? 1.3 : 0.7, 4); light.position.set(0, 0.6, -0.35); root.add(light); }
  shadows(root);
  let ph = 0, look = 0, atk = -9, T = 0;
  return { root, attack() { atk = T; }, animate(t, m, dt) {
    T = t; const s = m.speed, gait = Math.min(1, s * 1.6), a = strike((t - atk) / 0.55), A = Math.max(0, a);
    ph += dt * (5 + s * 9);
    // trote: pares diagonais; o joelho dobra quando a pata volta
    legs.forEach(({ pv, knee, front, x }) => { const diag = (front ? (x < 0 ? 0 : Math.PI) : (x < 0 ? Math.PI : 0)), sw = Math.sin(ph + diag); pv.rotation.x = sw * 0.55 * gait + (front ? -A * 0.9 : A * 0.5); knee.rotation.x = (front ? Math.max(0, -Math.cos(ph + diag)) * 0.9 : -Math.max(0, Math.cos(ph + diag)) * 0.7) * gait + (front ? A * 0.4 : -A * 0.3); });
    body.position.y = Math.abs(Math.sin(ph)) * 0.022 * gait + Math.sin(t * 2.2) * 0.003 * (1 - gait) - Math.min(0, a) * 0.08 + A * 0.05;
    body.position.z = A * 0.22; // bote para a frente
    body.rotation.x = Math.sin(ph * 2) * 0.03 * gait - s * 0.04 + Math.min(0, a) * -0.25 + A * 0.18;
    look = smooth(look, gait > 0.2 ? -m.turn * 0.12 : Math.sin(t * 0.6) * 0.35 + Math.sin(t * 1.7) * 0.08, dt, 4);
    neck.rotation.y = look * (1 - A); neck.rotation.x = Math.sin(ph * 2) * 0.05 * gait + A * 0.45 + Math.sin(t * 1.1) * 0.03 * (1 - gait);
    head.rotation.z = Math.sin(t * 0.9) * 0.08 * (1 - gait); // inclina a cabeça, curiosa
    jaw.rotation.x = A * 0.65;
    ears.forEach((e, i) => { e.rotation.x = -0.2 - 0.35 * gait - A * 0.4 + Math.sin(t * 2.3 + i * 2) * 0.04 + (Math.sin(t * 0.37 + i) > 0.97 ? 0.25 : 0); if (e.userData.flame) e.userData.flame.scale.y = (stage === 2 ? 0.016 : 0.011) * (1 + Math.sin(t * 17 + i) * 0.25); });
    tails.forEach(({ base, mid, fl, tongues, phase, spread }) => {
      base.rotation.y = spread + Math.sin(t * (2 + s * 4) + phase) * 0.22 + m.turn * 0.08; base.rotation.x = -0.15 + 0.25 * gait - A * 0.3;
      mid.rotation.y = Math.sin(t * (2 + s * 4) - 0.8 + phase) * 0.35; mid.rotation.x = 0.1 * gait;
      fl.rotation.z = Math.sin(t * 3 + phase) * 0.2; fl.rotation.x = -0.45 - mid.rotation.x - base.rotation.x; // a chama sempre sobe
      tongues.forEach(({ m: f, s: sc, ph: p }, k) => { const fk = 1 + Math.sin(t * (13 + k * 3) + p) * 0.14 + Math.sin(t * 29 + p * 2) * 0.07; f.scale.set(sc * (1 - (fk - 1) * 0.5), sc * fk * (1 + gait * 0.25), sc); f.rotation.y = k * 2.4 + Math.sin(t * 5 + p) * 0.4; });
    });
    if (mane) mane.material.emissiveIntensity = (stage === 2 ? 0.9 : 0.55) + Math.sin(t * 6) * 0.12;
    emberFx(t);
    if (light) light.intensity = (stage === 2 ? 1.3 : 0.7) + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.08;
  } };
}

/* =========================================================================
   Bolhinha → Maré → Aquária (bolha d'água curandeira) — S-111
   ========================================================================= */
const RIM_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
 p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
 vec4 mv = modelViewMatrix * p; vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const RIM_FS = `uniform vec3 uCol; uniform float uPow; uniform float uAmt; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uCol * f * uAmt, f * uAmt); }`;
const rimMat = (col, pow = 2.5, amt = 1) => new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) }, uPow: { value: pow }, uAmt: { value: amt } }, vertexShader: RIM_VS, fragmentShader: RIM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const bubbleMat = (tint = '#d8f4ff', op = 0.22) => new THREE.MeshPhysicalMaterial({ color: tint, transparent: true, opacity: op, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 1, iridescenceIOR: 1.25, iridescenceThicknessRange: [180, 520], specularIntensity: 1, depthWrite: false });
// gota: ponta para cima
const dropGeo = (r = 1) => sculpt(20, 16, (v, x, y, z) => { const t = (y + 1) / 2, k = t > 0.5 ? Math.pow(1 - (t - 0.5) * 2, 0.9) * 0.9 + 0.1 * (1 - (t - 0.5) * 2) : 1; v.set(x * r * (t > 0.5 ? k : 1), (y + (t > 0.5 ? (t - 0.5) * 1.3 : 0)) * r, z * r * (t > 0.5 ? k : 1)); });
function waterSprite(stage) {
  SEED = 777 + stage * 31;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const R = 0.2, cy = 0.46, tint = ['#d6f6ff', '#c4ecff', '#bfe4ff'][stage], rimC = ['#7fe8ff', '#5fd2ff', '#7ab8ff'][stage];
  const bub = new THREE.Group(); bub.position.y = cy; body.add(bub);
  // pele da bolha: vidro fino iridescente + borda que brilha (fresnel)
  const shellG = new THREE.SphereGeometry(R, 48, 36);
  const shell = new THREE.Mesh(shellG, bubbleMat(tint, 0.2)); shell.renderOrder = 3; shell.userData.noShadow = true; bub.add(shell);
  const rim = new THREE.Mesh(shellG, rimMat(rimC, 2.2, 0.95)); rim.scale.setScalar(1.005); rim.renderOrder = 4; rim.userData.noShadow = true; bub.add(rim);
  // água dentro, balançando (metade de baixo)
  const waterG = sculpt(36, 24, (v, x, y, z) => { const yy = Math.min(y, 0.05 + Math.sin(x * 3) * 0.04); v.set(x * R * 0.9, yy * R * 0.9, z * R * 0.9); });
  const water = new THREE.Mesh(waterG, new THREE.MeshStandardMaterial({ color: '#3ab8e8', emissive: '#1a7ab0', emissiveIntensity: 0.35, transparent: true, opacity: 0.38, roughness: 0.15, depthWrite: false }));
  water.renderOrder = 1; water.userData.noShadow = true; bub.add(water);
  // núcleo de cura: brilho verde-água com a runa (folha + cruz) girando dentro
  const core = new THREE.Group(); core.position.set(0, 0.075, 0.02); bub.add(core); // coração de cura na "testa", acima da água
  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), new THREE.MeshBasicMaterial({ color: '#3affa0', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreGlow.renderOrder = 2; core.add(coreGlow);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 18), rimMat('#7affc8', 1.4, 0.55)); halo.renderOrder = 2; core.add(halo);
  const RUNE = new THREE.MeshBasicMaterial({ color: '#7dffb8' });
  const crossBar = (w, h) => { const sh = new THREE.Shape(), r = Math.min(w, h) / 2; sh.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2); sh.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI); sh.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5); sh.absarc(w / 2 - r, -h / 2 + r, r, Math.PI * 1.5, Math.PI * 2); return sh; };
  const ex = { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 10 };
  const rune = new THREE.Group(); core.add(rune);
  const crossG = mergeGeometries([new THREE.ExtrudeGeometry(crossBar(0.03, 0.095), ex), new THREE.ExtrudeGeometry(crossBar(0.095, 0.03), ex)].map(strip)); crossG.translate(0, 0, 0.01);
  rune.add(new THREE.Mesh(crossG, RUNE));
  // folhinha de cura atrás da cruz
  const leaf = new THREE.Shape(); leaf.moveTo(0, -0.06); leaf.quadraticCurveTo(0.05, -0.01, 0, 0.06); leaf.quadraticCurveTo(-0.05, -0.01, 0, -0.06);
  const leafG = new THREE.ExtrudeGeometry(leaf, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 2, curveSegments: 12 });
  { const lg = mergeGeometries([0.78, -0.78].map(a => strip(leafG.clone().scale(0.9, 0.9, 0.9).rotateZ(a).translate(0, 0, -0.012)))); rune.add(new THREE.Mesh(lg, glow('#3ae890', 0.9, { transparent: true, opacity: 0.85 }))); }
  // rostinho: olhos grandes e serenos, pálpebra de cima, bochechas e um sorriso pequeno (na pele da bolha)
  const face = new THREE.Group(); bub.add(face);
  const EYE = mat('#0f2a44', { roughness: 0.08, metalness: 0.1 }), LID = mat('#7fd0ee', { roughness: 0.25, transparent: true, opacity: 0.85 }), GL = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const a = sx * 0.33, b = 0.12, px = Math.sin(a) * Math.cos(b) * R, py = Math.sin(b) * R, pz = Math.cos(a) * Math.cos(b) * R;
    const e = new THREE.Group(); e.position.set(px, py, pz); e.lookAt(px * 2, py * 2, pz * 2); face.add(e);
    e.add(merged([at(new THREE.SphereGeometry(0.03, 24, 18), 0, 0, -0.006, 0, 0, 0, [0.82, 1.05, 0.42])], EYE));
    e.add(merged([at(new THREE.SphereGeometry(0.0095, 10, 8), sx * -0.007, 0.012, 0.007), at(new THREE.SphereGeometry(0.0045, 8, 6), sx * 0.008, -0.011, 0.008)], GL));
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.033, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), LID); lid.scale.set(0.86, 1.0, 0.5); lid.rotation.x = -0.25; lid.position.z = -0.004; lid.userData.noShadow = true; e.add(lid);
    eyes.push({ e, lid });
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), new THREE.MeshBasicMaterial({ color: '#ff9ac0', transparent: true, opacity: 0.35, depthWrite: false })); const ca = sx * 0.52, cb = -0.03;
    ch.position.set(Math.sin(ca) * Math.cos(cb) * R * 0.99, Math.sin(cb) * R, Math.cos(ca) * Math.cos(cb) * R * 0.99); ch.lookAt(ch.position.clone().multiplyScalar(2)); ch.scale.set(1.3, 0.7, 0.2); face.add(ch);
  }
  { const sm = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 8, 20, Math.PI * 0.75), mat('#0f2a44', { roughness: 0.3 })); const b = -0.1; sm.position.set(0, Math.sin(b) * R, Math.cos(b) * R + 0.001); sm.rotation.set(-b, 0, Math.PI + Math.PI * 0.125); face.add(sm); }
  // nadadeiras de água (braços) e, nos estágios seguintes, véus maiores
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.quadraticCurveTo(0.05, 0.035, 0.11, 0.0); finShape.quadraticCurveTo(0.075, -0.02, 0.095, -0.05); finShape.quadraticCurveTo(0.04, -0.03, 0, 0);
  const finG = new THREE.ExtrudeGeometry(finShape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 14 });
  const FIN = new THREE.MeshPhysicalMaterial({ color: '#9fe6ff', transparent: true, opacity: 0.5, roughness: 0.05, clearcoat: 1, emissive: '#2a8ac0', emissiveIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const fins = [-1, 1].map(sx => { const f = new THREE.Group(); f.position.set(sx * R * 0.92, -0.03, 0.02); bub.add(f); const m = new THREE.Mesh(finG, FIN); m.scale.set(sx * (1 + stage * 0.35), 1 + stage * 0.3, 1); m.renderOrder = 5; m.userData.noShadow = true; f.add(m); return { f, sx }; });
  // véu/onda em volta (Maré) e coroa d'água com gema (Aquária)
  let wave = null, crown = null;
  if (stage >= 1) {
    const wg = new THREE.TorusGeometry(R * 1.22, 0.011 + stage * 0.003, 12, 96).rotateX(Math.PI / 2), WP = wg.attributes.position; for (let k = 0; k < WP.count; k++) { const a = Math.atan2(WP.getZ(k), WP.getX(k)); WP.setY(k, WP.getY(k) + Math.sin(a * 3) * 0.025); } wg.computeVertexNormals();
    wave = new THREE.Mesh(wg, new THREE.MeshPhysicalMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, emissive: '#3ab0e0', emissiveIntensity: 0.5, depthWrite: false }));
    wave.position.y = -0.09; wave.renderOrder = 5; wave.userData.noShadow = true; bub.add(wave);
  }
  if (stage === 2) {
    crown = new THREE.Group(); crown.position.y = R * 0.92; bub.add(crown);
    const CR = new THREE.MeshPhysicalMaterial({ color: '#bff0ff', transparent: true, opacity: 0.7, roughness: 0.03, clearcoat: 1, emissive: '#3ab0ff', emissiveIntensity: 0.5, depthWrite: false });
    const drops = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, h = k % 2 ? 0.024 : 0.034; drops.push(strip(dropGeo(1).scale(0.014, h, 0.014).rotateX(Math.cos(a) * 0.35).rotateZ(-Math.sin(a) * 0.35).translate(Math.sin(a) * 0.07, 0.01, Math.cos(a) * 0.07))); }
    const cm = new THREE.Mesh(mergeGeometries(drops), CR); cm.renderOrder = 6; crown.add(cm); crown.userData.drops = cm;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), glow('#7affd0', 1.4)); gem.scale.y = 1.6; gem.position.set(0, 0.04, 0.0); crown.add(gem); crown.userData.gem = gem;
  }
  // bolhinhas em órbita (halo) — mais a cada estágio
  const nOrb = [4, 6, 9][stage], ORB = bubbleMat('#e6fbff', 0.1), ORBR = rimMat('#bff6ff', 1.8, 1.1), orbs = [];
  const og = new THREE.SphereGeometry(1, 20, 14), orbA = new THREE.InstancedMesh(og, ORB, nOrb), orbB = new THREE.InstancedMesh(og, ORBR, nOrb);
  orbA.renderOrder = orbB.renderOrder = 6; orbA.frustumCulled = orbB.frustumCulled = false; body.add(orbA, orbB);
  for (let i = 0; i < nOrb; i++) orbs.push({ r: 0.018 + rnd() * 0.02 + (i % 3 === 0 && stage ? 0.012 : 0), off: i / nOrb * Math.PI * 2, rad: 0.28 + rnd() * 0.06, h: rnd() * 0.12, sp: 0.6 + rnd() * 0.4 });
  const OM = new THREE.Matrix4();
  // gotas de cura que pingam de vez em quando
  const drips = [], DR = glow('#7affc8', 1.1, { transparent: true, opacity: 0.9 }), dg2 = dropGeo(1);
  for (let i = 0; i < 2 + stage; i++) { const d = new THREE.Mesh(dg2, DR); d.scale.set(0.011, 0.016, 0.011); d.rotation.x = Math.PI; d.userData.noShadow = true; body.add(d); drips.push({ d, off: i / (2 + stage), x: (rnd() - 0.5) * 0.12, z: (rnd() - 0.5) * 0.1 }); }
  // anel do pulso de cura (attack)
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: '#8affd0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pulse.rotation.x = Math.PI / 2; pulse.userData.noShadow = true; body.add(pulse);
  // sombra suave no chão (a bolha é transparente: a sombra real ficaria escura demais)
  const blobShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: '#06202a', transparent: true, opacity: 0.25, depthWrite: false })); blobShadow.rotation.x = -Math.PI / 2; blobShadow.position.y = 0.01; root.add(blobShadow);
  const light = vlight('#7affd8', 0.5 + stage * 0.35, 3.5); light.position.y = cy; root.add(light);
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  let atk = -9, T = 0, blink = 2, sw = 0;
  return { root, attack() { atk = T; }, animate(t, m, dt) {
    T = t; const s = m.speed; sw = smooth(sw, Math.min(1, s * 1.5), dt, 4);
    const k = (t - atk) / 0.7, P = k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
    // flutua e respira; ao andar, inclina e estica um pouco
    bub.position.y = cy + Math.sin(t * 2) * 0.03 + P * 0.04;
    const wob = Math.sin(t * 3.1) * 0.025, sq = P * 0.12;
    bub.scale.set(1 + wob + sq, 1 - wob * 0.8 - sq * 0.6 + sw * 0.04, 1 + wob * 0.6 + sq - sw * 0.03);
    bub.rotation.x = -0.15 * sw; bub.rotation.z = -m.turn * 0.06 * sw + Math.sin(t * 1.3) * 0.04;
    face.rotation.y = smooth(face.rotation.y, sw > 0.3 ? -m.turn * 0.08 : Math.sin(t * 0.5) * 0.25, dt, 3);
    water.rotation.z = Math.sin(t * 2.4) * 0.12 + m.turn * 0.05; water.rotation.x = -sw * 0.25 + Math.sin(t * 1.9) * 0.06;
    rune.rotation.y = Math.sin(t * 0.9) * 0.45; rune.position.y = Math.sin(t * 2.6) * 0.006;
    coreGlow.scale.setScalar(1 + Math.sin(t * 3.2) * 0.12 + P * 0.8); halo.material.uniforms.uAmt.value = 0.5 + Math.sin(t * 3.2) * 0.15 + P;
    rim.material.uniforms.uAmt.value = 0.9 + P * 0.8;
    // piscar (pálpebra desce)
    blink -= dt; const bl = blink < 0.12 ? Math.sin(Math.max(0, blink) / 0.12 * Math.PI) : 0; if (blink < 0) blink = 2.5 + rnd() * 3;
    eyes.forEach(({ e, lid }) => { lid.rotation.x = -0.25 + bl * 1.0 + P * 0.4; e.scale.y = 1 - bl * 0.3; });
    fins.forEach(({ f, sx }) => { f.rotation.z = sx * (Math.sin(t * (3 + s * 5)) * 0.35 + 0.15 - P * 0.6); f.rotation.y = sx * (0.3 + sw * 0.5); });
    if (wave) { wave.rotation.y = t * 0.8; wave.position.y = -0.09 + Math.sin(t * 2.2) * 0.012; }
    if (crown) { crown.rotation.y = -t * 0.5; crown.userData.gem.rotation.y = t * 2; crown.userData.drops.scale.y = 1 + Math.sin(t * 4) * 0.08; }
    orbs.forEach((o, i) => { const a = o.off + t * o.sp, sc = o.r * (1 + Math.sin(t * 3 + o.off) * 0.1); OM.makeScale(sc, sc, sc).setPosition(Math.sin(a) * o.rad, cy + o.h + Math.sin(t * 1.7 + o.off * 3) * 0.05 - 0.05, Math.cos(a) * o.rad); orbA.setMatrixAt(i, OM); OM.makeScale(sc * 1.02, sc * 1.02, sc * 1.02).setPosition(Math.sin(a) * o.rad, cy + o.h + Math.sin(t * 1.7 + o.off * 3) * 0.05 - 0.05, Math.cos(a) * o.rad); orbB.setMatrixAt(i, OM); }); orbA.instanceMatrix.needsUpdate = orbB.instanceMatrix.needsUpdate = true;
    drips.forEach(d => { const q = fract(t * 0.35 + d.off); d.d.visible = q < 0.6; d.d.position.set(d.x, cy - R * 0.85 - q * q * 0.9 + (bub.position.y - cy), d.z); d.d.scale.setScalar(1); d.d.scale.set(0.011 * (1 - q * 0.6), 0.016 * (1 - q * 0.5), 0.011 * (1 - q * 0.6)); });
    pulse.material.opacity = k >= 0 && k < 1 ? (1 - k) * 0.7 : 0; const pr = 0.15 + Math.max(0, k) * 0.6; pulse.scale.set(pr, pr, 0.6); pulse.position.y = 0.06 + Math.max(0, k) * 0.1;
    blobShadow.scale.setScalar(1 - (bub.position.y - cy) * 2);
  } };
}

/* =========================================================================
   Pedrinho → Rochedo → Monolito (tatu de pedra) — S-110
   Carapaça numa peça só: escudo do ombro e da garupa com escamas (hexágonos), cintas
   móveis no meio que se sobrepõem, sulcos escuros, bordas gastas; pele de couro com rugas.
   ========================================================================= */
function crystalCluster(n, h, rng) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const hh = h * (0.5 + rng() * 0.6), r = h * 0.12 * (0.7 + rng() * 0.5), g = new THREE.CylinderGeometry(r, r * 1.1, hh, 6, 1);
    const tip = new THREE.ConeGeometry(r, hh * 0.35, 6); tip.translate(0, hh / 2 + hh * 0.175, 0);
    const c = mergeGeometries([strip(g), strip(tip)]); c.translate(0, hh / 2, 0);
    c.rotateZ((rng() - 0.5) * 0.9); c.rotateX((rng() - 0.5) * 0.9); c.translate((rng() - 0.5) * h * 0.25, 0, (rng() - 0.5) * h * 0.25);
    parts.push(c);
  }
  return mergeGeometries(parts);
}
function rockGeo(rx, ry, rz, seed) {
  return sculpt(14, 10, (v, x, y, z) => { const n = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed) * 0.5 + Math.sin(y * 4.3 + seed * 2) * 0.3; const k = 1 + n * 0.18; v.set(x * rx * k, Math.max(y, -0.3) * ry * k, z * rz * k); });
}
function rockArmadillo(stage) {
  SEED = 99 + stage * 7;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const shellBase = new THREE.Color(['#b8a07a', '#8e8270', '#7d786c'][stage]), shellDark = new THREE.Color(['#5a4632', '#3e3830', '#34322e'][stage]), shellLight = new THREE.Color(['#e0cca0', '#b8ae98', '#a8a294'][stage]);
  const skinC = new THREE.Color(['#c9a48a', '#b39280', '#a58a78'][stage]), skinDark = new THREE.Color('#6a4e40'), moss = new THREE.Color('#5d8a3a'), mossL = new THREE.Color('#8ab04a');
  const SHELL = VC(0.78), SKIN = VC(0.9);
  const L = 0.32, W = 0.195, H = 0.18, cy = 0.2;
  // ---- carapaça ----
  // carapaça em peças de verdade: escudo do ombro, 8 cintas móveis sobrepostas (telhas) e escudo da garupa.
  // Cada peça é uma grade densa sobre o elipsoide (sem serrilhado), com relevo e cor tirados do mesmo desenho.
  const AMAX = 2.15;
  function shellPiece(z0, z1, segZ, segA, pat) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let i = 0; i <= segZ; i++) for (let j = 0; j <= segA; j++) {
      const t = i / segZ, z = z0 + (z1 - z0) * t, a = -AMAX + 2 * AMAX * j / segA, rho = Math.sqrt(Math.max(0, 1 - z * z));
      const nx = rho * Math.sin(a), ny = rho * Math.cos(a), p = pat(t, a, z);
      let r = p.r; if (ny < -0.25) r *= 1 + (-0.25 - ny) * 0.2;
      pos.push(nx * W * r, ny * H * r * (1 + 0.06 * ss(-0.3, 0.3, z)) + cy + 0.04, z * L * r + 0.01);
      const hv = hash(p.id, 7);
      c.copy(shellBase).offsetHSL((hv - 0.5) * 0.015, (hv - 0.5) * 0.05, (hv - 0.5) * 0.09);
      c.lerp(shellLight, ss(0.4, 1, p.edge) * 0.45 * ss(-0.3, 0.8, ny));
      c.lerp(shellDark, (1 - ss(0, 0.5, p.edge)) * 0.8);
      if (ny < -0.1) c.lerp(shellDark, 0.2);
      if (stage === 2 && ny > 0.3) { const mn = Math.sin(nx * 23 + 1) * Math.cos(z * 19) * 0.5 + 0.5; c.lerp(hv > 0.5 ? moss : mossL, ss(0.3, 0.75, ny) * (0.45 + mn * 0.45) * (0.55 + 0.45 * ss(0.2, 0.8, p.edge))); }
      if (stage === 1 && ny > 0.4 && hv > 0.8) c.lerp(new THREE.Color('#7a8458'), 0.45); // líquen
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < segZ; i++) for (let j = 0; j < segA; j++) { const a = i * (segA + 1) + j, b = a + segA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const shellParts = [];
  // escudos: escamas arredondadas em fileiras desencontradas (domo em cada uma)
  const scutes = (rowsPerUnit, cols, off) => (t, a, z) => {
    const row = Math.abs(z) * rowsPerUnit, fr = fract(row), cc = (a / (2 * Math.PI)) * cols + (Math.floor(row) % 2) * 0.5, fc = fract(cc);
    const e = Math.max(0, 1 - Math.hypot((fc - 0.5) * 1.0, (fr - 0.5) * 1.05) * 2.1), edge = Math.min(1, e / 0.4);
    return { r: 1 + 0.022 * Math.sqrt(edge) - 0.01, edge, id: Math.floor(row) * 57 + Math.floor(cc) + off };
  };
  shellParts.push(shellPiece(0.3, 0.94, 70, 200, scutes(16, 22, 999)));   // escudo do ombro
  shellParts.push(shellPiece(-0.95, -0.32, 70, 200, scutes(16, 22, 0)));  // escudo da garupa
  const NB = 8;
  for (let b = 0; b < NB; b++) { // cintas: cada uma sobe para trás e cobre a de trás (como telhas)
    const zf = 0.32 - b * (0.64 / NB) + 0.012, zb = zf - 0.64 / NB - 0.022;
    shellParts.push(shellPiece(zf, zb, 16, 200, (t, a) => {
      const cc = (a / (2 * Math.PI)) * 26, fc = fract(cc), gv = Math.min(fc, 1 - fc);
      const lip = ss(0.82, 1, t);
      const edge = Math.min(1, gv / 0.1) * (1 - lip * 0.7) * ss(0, 0.15, t);
      return { r: 1.005 + 0.03 * t - 0.03 * lip * lip - 0.006 * (1 - ss(0, 0.12, gv)), edge, id: b * 31 + Math.floor(cc) };
    }));
  }
  const shellG = mergeGeometries(shellParts);
  const SHELLD = VC(0.75, { side: THREE.DoubleSide });
  body.add(new THREE.Mesh(shellG, SHELLD));
  // barriga de couro por baixo
  const bellyG = sculpt(40, 28, (v, x, y, z) => { const w = 1 + 0.03 * Math.sin(z * 30); v.set(x * W * 0.88 * w, y * H * 0.62 + cy - 0.02, z * L * 0.92); });
  vcolor(bellyG, (c, x, y, z) => { c.copy(skinC).lerp(skinDark, (Math.sin(z * 90) * 0.5 + 0.5) * 0.15); });
  body.add(new THREE.Mesh(bellyG, SKIN));
  // ---- cabeça: alongada, escudo de escamas em cima, couro enrugado embaixo, focinho de porquinho ----
  const neck = new THREE.Group(); neck.position.set(0, cy + 0.02, L * 0.88); body.add(neck);
  const neckG = taper([V3(0, 0, -0.05), V3(0, 0.005, 0.02), V3(0, 0.01, 0.06)], 0.075, 0.06, 12, 18);
  { const P = neckG.attributes.position; for (let k = 0; k < P.count; k++) { const z = P.getZ(k), s = 1 + Math.sin(z * 140) * 0.06; P.setX(k, P.getX(k) * s); P.setY(k, (P.getY(k) - 0.005) * s + 0.005); } neckG.computeVertexNormals(); } // rugas
  vcolor(neckG, (c, x, y, z) => c.copy(skinC).lerp(skinDark, (Math.sin(z * 140) * 0.5 + 0.5) * 0.35));
  neck.add(new THREE.Mesh(neckG, SKIN));
  const head = new THREE.Group(); head.position.set(0, 0.015, 0.06); neck.add(head);
  const headG = sculpt(56, 40, (v, x, y, z) => {
    const t = ss(-0.2, 1, z);
    let X = x * 0.07 * (1 - 0.55 * t), Y = y * 0.06 * (1 - 0.5 * t), Z = z * 0.06 + Math.max(0, z) * 0.1;
    Y -= 0.02 * t;
    if (y > 0.15) { const cu = Z * 32, ca = X * 32 + (Math.floor(cu) % 2) * 0.5, e = Math.min(fract(cu), 1 - fract(cu), fract(ca), 1 - fract(ca)); Y += 0.003 * ss(0, 0.25, e); } // escudo da cabeça
    else { Y += Math.sin(Z * 160) * 0.001 * (1 - t); }
    v.set(X, Y, Z);
  });
  vcolor(headG, (c, x, y, z, ny) => {
    if (ny > 0.25 && y > -0.008) { const cu = z * 32, ca = x * 32 + (Math.floor(cu) % 2) * 0.5, e = Math.min(fract(cu), 1 - fract(cu), fract(ca), 1 - fract(ca)); c.copy(shellBase).offsetHSL(0, 0, (hash(Math.floor(cu), Math.floor(ca)) - 0.5) * 0.12).lerp(shellDark, (1 - ss(0, 0.2, e)) * 0.7); }
    else c.copy(skinC).lerp(skinDark, (Math.sin(z * 200) * 0.5 + 0.5) * 0.2);
    if (z > 0.14) c.lerp(new THREE.Color('#8a5a50'), ss(0.14, 0.16, z));
  });
  head.add(new THREE.Mesh(headG, SKIN));
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.014, 18, 12), mat('#5a3a34', { roughness: 0.45 })); snout.scale.set(1.15, 0.85, 0.45); snout.position.set(0, -0.022, 0.158); head.add(snout);
  head.add(merged([-1, 1].map(sx => at(new THREE.SphereGeometry(0.0032, 8, 6), sx * 0.0055, -0.022, 0.164)), mat('#1a0e0c')));
  // olhinhos de conta, com pálpebra de couro
  const EYE = mat('#0c0806', { roughness: 0.05 }), GL = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const lidG = vcolor(new THREE.TorusGeometry(0.0115, 0.0035, 8, 20, Math.PI), c => c.copy(skinC).lerp(skinDark, 0.3));
  for (const sx of [-1, 1]) {
    head.add(merged([at(new THREE.SphereGeometry(0.011, 16, 12), sx * 0.045, 0.012, 0.035)], EYE));
    head.add(merged([at(new THREE.SphereGeometry(0.0025, 8, 6), sx * 0.049, 0.016, 0.044)], GL));
    const lid = new THREE.Mesh(lidG, SKIN); lid.position.set(sx * 0.045, 0.013, 0.035); lid.rotation.set(-0.3, sx * 0.9, 0); head.add(lid);
  }
  // orelhas pequenas de couro, em concha
  const earG = sculpt(18, 14, (v, x, y, z) => { v.set(x * 0.015, (y + 1) * 0.026, z * 0.006 - x * x * 0.012); }); vcolor(earG, (c, x, y, z) => c.copy(skinC).lerp(skinDark, 0.35).lerp(new THREE.Color('#5a4038'), z > 0.002 ? 0.35 : 0));
  const ears = [-1, 1].map(sx => { const e = new THREE.Mesh(earG, SKIN); e.position.set(sx * 0.04, 0.04, -0.02); e.rotation.set(-0.35, sx * 0.5, -sx * 0.3); head.add(e); return e; });
  if (stage === 2) { // chifres de pedra para trás
    const hornG = mergeGeometries([-1, 1].map(sx => strip(taper([V3(sx * 0.03, 0.05, 0.0), V3(sx * 0.045, 0.075, -0.05), V3(sx * 0.05, 0.08, -0.11)], 0.016, 0.003, 10, 10))));
    vcolor(hornG, (c, x, y, z) => c.copy(shellBase).lerp(shellDark, ss(0, -0.1, z) * 0.6));
    head.add(new THREE.Mesh(hornG, SHELL));
  }
  // ---- patas curtas e escamadas, garras longas nas dianteiras ----
  const CLAW = mat('#2a221c', { roughness: 0.35 });
  const legs = [[-0.13, 0.17, true], [0.13, 0.17, true], [-0.14, -0.17, false], [0.14, -0.17, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, cy - 0.02, z); body.add(pv); const sx = Math.sign(x);
    // perna curta e grossa, escamada em anéis, que nasce por dentro da carapaça
    const lg = sculpt(24, 20, (v, xx, y, zz) => { const u = (1 - y) / 2, rr = (front ? 0.04 : 0.047) * (1 - u * 0.3) * (1 + (fract(u * 7) > 0.75 ? 0.06 : 0)); v.set(xx * rr + sx * u * 0.012, y * 0.1 - 0.07, zz * rr * 1.05 + (front ? u * 0.008 : -u * 0.01)); });
    vcolor(lg, (c, xx, y) => { const u = (0.03 - y) / 0.2; c.copy(skinC).lerp(shellBase, 0.45).lerp(shellDark, fract(u * 7) > 0.75 ? 0.35 : 0); });
    pv.add(new THREE.Mesh(lg, SKIN));
    const foot = sculpt(16, 12, (v, xx, y, zz) => v.set(xx * 0.034, Math.max(y, -0.4) * 0.017, zz * 0.038 + Math.max(0, zz) * 0.01)); vcolor(foot, c => c.copy(skinC).lerp(shellDark, 0.35));
    const fm = new THREE.Mesh(foot, SKIN); fm.position.set(sx * 0.012, -0.163, 0.012); pv.add(fm);
    const nC = front ? 3 : 4, cl = [];
    for (let k = 0; k < nC; k++) { const xx = (k - (nC - 1) / 2) * (front ? 0.017 : 0.013); cl.push(taper([V3(xx, 0, 0), V3(xx, -0.004, front ? 0.022 : 0.012), V3(xx, -0.014, front ? 0.036 : 0.019)], front ? 0.0065 : 0.005, 0.0008, 8, 8)); }
    const cm = merged(cl, CLAW); cm.position.set(sx * 0.012, -0.165, 0.042); pv.add(cm);
    return { pv, front, x };
  });
  // ---- rabo de anéis ----
  const tailG = new THREE.Group(); tailG.position.set(0, cy + 0.0, -L * 0.92); body.add(tailG);
  const tg = taper([V3(0, 0, 0), V3(0, -0.04, -0.08), V3(0, -0.1, -0.15), V3(0, -0.15, -0.2)], 0.045, 0.008, 22, 14);
  { const P = tg.attributes.position; const g0 = new THREE.Vector3(); for (let k = 0; k < P.count; k++) { const z = P.getZ(k), y = P.getY(k), s = 1 + (fract(Math.hypot(z, y) * 55) > 0.7 ? 0.08 : 0); g0.set(P.getX(k), y, z); P.setX(k, P.getX(k) * s); } tg.computeVertexNormals(); }
  vcolor(tg, (c, x, y, z) => { const f = fract(Math.hypot(z, y) * 55); c.copy(shellBase).lerp(shellDark, f > 0.7 ? 0.45 : 0).offsetHSL(0, 0, (Math.floor(Math.hypot(z, y) * 55) % 2) * 0.04); });
  tailG.add(new THREE.Mesh(tg, SHELL));
  // ---- evolução: cristais crescendo entre as placas (Rochedo); mini-paisagem com musgo, pedras e cristal grande (Monolito) ----
  let spire = null, spireLight = null;
  const rngS = (() => { let s = 31 + stage; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
  const CRY = new THREE.MeshPhysicalMaterial({ color: stage === 2 ? '#8affd8' : '#9ad0ff', emissive: stage === 2 ? '#2ad0a0' : '#3a8aff', emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.0, clearcoat: 1, transparent: true, opacity: 0.88, flatShading: true });
  const onShell = (u, a) => { const rho = Math.sqrt(1 - u * u), z = u * L * 1.02, ca = Math.cos(a) * rho, sa = Math.sin(a) * rho; return { p: V3(sa * W * 1.02, cy + 0.04 + ca * H * 1.02, z + 0.01), n: V3(sa / W, ca / H, u / L).normalize() }; };
  if (stage >= 1) {
    const spots = stage === 1 ? [[0.0, -0.35, 0.07], [-0.15, 0.45, 0.06], [0.2, 0.15, 0.055], [-0.3, -0.25, 0.05]] : [[0.25, -0.5, 0.07], [-0.4, 0.5, 0.06], [0.45, 0.6, 0.05], [-0.15, -0.65, 0.055]];
    const cg = [];
    for (const [u, a, h] of spots) { const { p, n } = onShell(u, a); const g = crystalCluster(4, h, rngS); const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n); g.applyQuaternion(q); g.translate(p.x - n.x * 0.01, p.y - n.y * 0.01, p.z); cg.push(g); }
    body.add(new THREE.Mesh(mergeGeometries(cg), CRY));
  }
  if (stage === 2) {
    // pedras pequenas e musgo em tufos sobre o casco
    const rk = [];
    for (let k = 0; k < 7; k++) { const u = (rngS() - 0.5) * 1.3, a = (rngS() - 0.5) * 1.6, { p, n } = onShell(u, a), g = rockGeo(0.02 + rngS() * 0.02, 0.014 + rngS() * 0.012, 0.02 + rngS() * 0.02, k * 3.1); vcolor(g, (c, x, y) => c.copy(shellBase).offsetHSL(0, 0, (rngS() - 0.5) * 0.1).lerp(moss, y > 0.005 ? 0.4 : 0)); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)); g.translate(p.x, p.y - 0.005, p.z); rk.push(g); }
    body.add(merged(rk, SHELL));
    const MOSS = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide });
    furOnGeo(body, MOSS, shellG, [{ n: 800, len: 0.38, w: 1.2, dir: [0, 1, 0], lift: 0.8, col: '#5d8a3a', tones: ['#7aa848', '#4a7030', '#9ab858'], filter: (x, y, z, ny) => ny > 0.55 }]);
    // grama e florzinhas
    const bl = [], FL = [];
    for (let k = 0; k < 22; k++) { const u = (rngS() - 0.5) * 1.5, a = (rngS() - 0.5) * 1.4, { p, n } = onShell(u, a), h = 0.025 + rngS() * 0.03, g = new THREE.ConeGeometry(0.003, h, 4); g.translate(0, h / 2, 0); g.rotateZ((rngS() - 0.5) * 0.6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)); g.translate(p.x, p.y - 0.003, p.z); bl.push(g); if (k % 5 === 0) FL.push(at(new THREE.SphereGeometry(0.006, 8, 6), p.x + n.x * h * 0.9, p.y + n.y * h * 0.9, p.z)); }
    body.add(merged(bl, mat('#6a9a3a', { roughness: 0.9 }))); body.add(merged(FL, mat('#f4e27a', { emissive: '#a08a20', emissiveIntensity: 0.2 })));
    // pináculo de cristal no alto das costas
    spire = new THREE.Mesh(crystalCluster(6, 0.15, rngS), CRY); spire.position.set(0, cy + 0.04 + H - 0.01, -0.03); body.add(spire);
    spireLight = vlight('#7affd0', 0.9, 4); spireLight.position.set(0, cy + 0.35, 0); root.add(spireLight);
  }
  // poeira da pancada (attack)
  const dust = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 8, 40), new THREE.MeshBasicMaterial({ color: '#b8a888', transparent: true, opacity: 0, depthWrite: false })); dust.rotation.x = Math.PI / 2; dust.userData.noShadow = true; root.add(dust);
  shadows(root);
  let ph = 0, look = 0, atk = -9, T = 0;
  return { root, attack() { atk = T; }, animate(t, m, dt) {
    T = t; const s = m.speed, gait = Math.min(1, s * 1.6), k = (t - atk) / 0.8;
    // pancada: empina (0–0,45), bate o casco no chão (0,45–0,55) e acomoda
    const rear = k >= 0 && k < 1 ? (k < 0.45 ? Math.sin(k / 0.45 * Math.PI / 2) : k < 0.55 ? 1 - (k - 0.45) / 0.1 * 1.15 : -0.15 * (1 - (k - 0.55) / 0.45)) : 0;
    ph += dt * (4 + s * 10);
    legs.forEach(({ pv, front, x }) => { const diag = (front ? (x < 0 ? 0 : Math.PI) : (x < 0 ? Math.PI : 0)); pv.rotation.x = Math.sin(ph + diag) * 0.55 * gait + (front ? -Math.max(0, rear) * 0.9 : Math.max(0, rear) * 0.3); });
    body.position.y = Math.abs(Math.sin(ph)) * 0.015 * gait + Math.max(0, rear) * 0.1 + Math.min(0, rear) * 0.06 + Math.sin(t * 1.6) * 0.003;
    body.rotation.x = -Math.max(0, rear) * 0.55 - Math.min(0, rear) * 0.1;
    body.rotation.z = Math.sin(ph) * 0.04 * gait - m.turn * 0.04;
    look = smooth(look, gait > 0.2 ? -m.turn * 0.1 : Math.sin(t * 0.5) * 0.3, dt, 3);
    neck.rotation.y = look; neck.rotation.x = Math.sin(ph * 2) * 0.04 * gait + Math.sin(t * 0.9) * 0.05 * (1 - gait) + Math.max(0, rear) * 0.3;
    head.rotation.x = Math.sin(t * 7) * 0.02 * (1 - gait); // fareja
    ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * 0.3 + Math.sin(t * 2 + i) * 0.06; });
    tailG.rotation.y = Math.sin(t * (1.5 + s * 4)) * 0.2 + m.turn * 0.1; tailG.rotation.x = Math.max(0, rear) * 0.4;
    const dk = (k - 0.5) / 0.5; dust.material.opacity = dk > 0 && dk < 1 ? (1 - dk) * 0.5 : 0; const dr = 0.2 + Math.max(0, dk) * 0.7; dust.scale.set(dr, dr, 0.25 + Math.max(0, dk) * 0.2); dust.position.set(0, 0.02, 0.25);
    if (spire) { spireLight.intensity = 0.9 + Math.sin(t * 2) * 0.2 + (dk > 0 && dk < 1 ? (1 - dk) * 2 : 0); }
  } };
}

// tamanho de cada estágio (o mascote cresce ao evoluir)
const STAGE_SCALE = [0.8, 1.05, 1.35];
export function makePet(species, stage) {
  const m = species === 'agua' ? waterSprite(stage) : species === 'terra' ? rockArmadillo(stage) : fireFox(stage);
  m.root.scale.setScalar(STAGE_SCALE[stage]);
  const obj = new THREE.Group(); obj.add(m.root);
  return { obj, ...m, height: 0.8 * STAGE_SCALE[stage] };
}
