/* =========================================================================
   LOBO (S-248): referência de qualidade para os monstros.
   - Corpo: UMA malha orgânica contínua (campo de distância + pele presa a ossos), nada de "bolas" coladas.
     Peito fundo e estreito, cintura recolhida, garupa, colar de pelo no pescoço, bochechas largas,
     focinho longo, orelhas em ponta, patas digitígradas (anda na ponta dos dedos) com almofadas e garras,
     cauda grossa e caída.
   - Pelagem: cor pintada no material (sela escura no dorso, barriga/garganta/máscara claras, ponta da cauda
     preta, pelos mesclados) + camadas de pelo de verdade (shells) que seguem o esqueleto, mais longas no
     colar, bochechas, cauda e "calças" das coxas, curtas no focinho e nas patas.
   - Movimento: passo (lateral), trote (diagonais) e galope (rotativo) escolhidos pela VELOCIDADE real;
     a fase das patas avança pela distância percorrida (pé de apoio parado no chão, sem deslizar);
     pernas por IK de 2 ossos + pata (o pé de apoio fica no chão); coluna flexiona no galope, quadril
     balança no passo, cabeça estabilizada, cauda e orelhas com atraso; mordida com bote.
   - S-396 (rosto e patas refeitos): malha em várias resoluções (`multiResGeometry`: cabeça e patas numa grade
     fina, emendada sob a juba e o pelo da perna), peças que ESCAVAM (`sub`: órbitas, fenda da boca, sulcos entre
     os dedos) e elipsoides girados (`m`: orelhas, dedos). Olho amendoado e inclinado (`wolfEyeGeo`/`eyeRimGeo`,
     assentado pela normal do rosto em `eyeFrame`), boca que abre de verdade (pele abaixo do lábio presa à
     mandíbula; fechada = `JAW0`), pata = uma massa só com quatro dedos e garras na ponta (`TOE_LAYOUT`).
   ========================================================================= */
import * as THREE from 'three';
import { sdfRig, SDF_NOISE_GLSL } from './mounts3d.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

// ---------- campo de distância (cópia mínima, para achar a superfície ao encaixar olhos e nariz) ----------
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function sdCaps(px, py, pz, P) { const [ax, ay, az] = P.a, [bx, by, bz] = P.b, bax = bx - ax, bay = by - ay, baz = bz - az, pax = px - ax, pay = py - ay, paz = pz - az; const t = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz))); return len3(pax - bax * t, pay - bay * t, paz - baz * t) - (P.r0 + (P.r1 - P.r0) * t); }
function sdEll(px, py, pz, P) {
  const [cx, cy, cz] = P.c, [rx, ry, rz] = P.r; let x = px - cx, y = py - cy, z = pz - cz;
  if (P.m) { const m = P.m, a = x, b = y, c = z; x = m[0] * a + m[3] * b + m[6] * c; y = m[1] * a + m[4] * b + m[7] * c; z = m[2] * a + m[5] * b + m[8] * c; } // S-396: elipsoide girado (orelhas, dedos)
  const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
const sdPrim = (x, y, z, P) => (P.a ? sdCaps(x, y, z, P) : sdEll(x, y, z, P));
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
const smax = (a, b, k) => -smin(-a, -b, k);
// S-396: peças com `sub` ESCAVAM (vãos entre os dedos, vinco do lábio) — aplicadas depois de todas as somas
const field = (parts, x, y, z) => { let d = 0.25; for (const P of parts) if (!P.sub) d = smin(d, sdPrim(x, y, z, P), P.k); for (const P of parts) if (P.sub) d = smax(d, -sdPrim(x, y, z, P), P.k); return d; };
function surface(parts, o, dir) { const l = len3(...dir), d = dir.map(v => v / l); let t = 0; for (; t < 0.4; t += 0.0008) if (field(parts, o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) > 0) break; return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; }
function gradient(parts, p) { const e = 0.0015, f = (x, y, z) => field(parts, x, y, z), g = [f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)], l = len3(...g) || 1; return g.map(v => v / l); }
// matriz (inversa) de um giro Euler YXZ, para `m` dos elipsoides girados
const _m4 = new THREE.Matrix4(), _m3 = new THREE.Matrix3();
const rotInv = (x, y, z) => _m3.setFromMatrix4(_m4.makeRotationFromEuler(new THREE.Euler(x, y, z, 'YXZ')).invert()).elements.slice();
const rotVec = (v, x, y, z) => new THREE.Vector3(...v).applyEuler(new THREE.Euler(x, y, z, 'YXZ')).toArray();

/* S-396: malha com pele em VÁRIAS resoluções. O corpo usa a grade grossa (leve); a cabeça e as patas têm uma grade
   fina própria (rosto com arco da sobrancelha, vinco do lábio, dedos com sulcos). As duas se sobrepõem numa faixa
   escondida (sob a juba do pescoço / pelo da perna): a grossa afunda 1,5 mm ali e some por baixo da fina. */
function sdfMesh(parts, BONES, org, size, H) {
  const [X0, Y0, Z0] = org, NX = Math.ceil(size[0] / H) + 1, NY = Math.ceil(size[1] / H) + 1, NZ = Math.ceil(size[2] / H) + 1;
  const F = new Float32Array(NX * NY * NZ).fill(0.25), id = (i, j, k) => (k * NY + j) * NX + i;
  const box = P => { const pad = P.k + 0.03; if (P.a) return [[0, 1, 2].map(q => Math.min(P.a[q], P.b[q]) - Math.max(P.r0, P.r1) - pad), [0, 1, 2].map(q => Math.max(P.a[q], P.b[q]) + Math.max(P.r0, P.r1) + pad)]; const R = P.m ? Math.max(...P.r) : 0; return [P.c.map((c, q) => c - (R || P.r[q]) - pad), P.c.map((c, q) => c + (R || P.r[q]) + pad)]; };
  for (const pass of [0, 1]) for (const P of parts) {
    if (!!P.sub !== !!pass) continue;
    const [lo, hi] = box(P);
    const i0 = Math.max(0, Math.floor((lo[0] - X0) / H)), i1 = Math.min(NX - 1, Math.ceil((hi[0] - X0) / H)), j0 = Math.max(0, Math.floor((lo[1] - Y0) / H)), j1 = Math.min(NY - 1, Math.ceil((hi[1] - Y0) / H)), k0 = Math.max(0, Math.floor((lo[2] - Z0) / H)), k1 = Math.min(NZ - 1, Math.ceil((hi[2] - Z0) / H));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const n = id(i, j, k), d = sdPrim(X0 + i * H, Y0 + j * H, Z0 + k * H, P); F[n] = pass ? smax(F[n], -d, P.k) : smin(F[n], d, P.k); }
  }
  const vIdx = new Int32Array(NX * NY * NZ).fill(-1), pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    let sx = 0, sy = 0, sz = 0, n = 0, neg = 0;
    for (let c = 0; c < 8; c++) if (F[id(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))] < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    for (const [a, b] of E) {
      const ai = i + (a & 1), aj = j + ((a >> 1) & 1), ak = k + (a >> 2), bi = i + (b & 1), bj = j + ((b >> 1) & 1), bk = k + (b >> 2);
      const fa = F[id(ai, aj, ak)], fb = F[id(bi, bj, bk)]; if ((fa < 0) === (fb < 0)) continue;
      const t = fa / (fa - fb); sx += ai + (bi - ai) * t; sy += aj + (bj - aj) * t; sz += ak + (bk - ak) * t; n++;
    }
    vIdx[id(i, j, k)] = pos.length / 3; pos.push(X0 + sx / n * H, Y0 + sy / n * H, Z0 + sz / n * H);
  }
  const idx = [];
  for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
    const f0 = F[id(i, j, k)] < 0;
    if ((F[id(i + 1, j, k)] < 0) !== f0) { const a = vIdx[id(i, j - 1, k - 1)], b = vIdx[id(i, j, k - 1)], c = vIdx[id(i, j, k)], d = vIdx[id(i, j - 1, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c); }
    if ((F[id(i, j + 1, k)] < 0) !== f0) { const a = vIdx[id(i - 1, j, k - 1)], b = vIdx[id(i, j, k - 1)], c = vIdx[id(i, j, k)], d = vIdx[id(i - 1, j, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, c, b, a, d, c) : idx.push(a, b, c, a, c, d); }
    if ((F[id(i, j, k + 1)] < 0) !== f0) { const a = vIdx[id(i - 1, j - 1, k)], b = vIdx[id(i, j - 1, k)], c = vIdx[id(i, j, k)], d = vIdx[id(i - 1, j, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c); }
  }
  const nv = pos.length / 3, nrm = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) { const g = gradient(parts, [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]); nrm[v * 3] = g[0]; nrm[v * 3 + 1] = g[1]; nrm[v * 3 + 2] = g[2]; }
  const names = Object.keys(BONES), bi = new Uint16Array(nv * 4), bw = new Float32Array(nv * 4), solid = parts.filter(P => !P.sub);
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], acc = {};
    let dmin = 1e9; const ds = solid.map(P => { const d = sdPrim(x, y, z, P); if (d < dmin) dmin = d; return d; });
    solid.forEach((P, q) => { const w = Math.exp(-(ds[q] - dmin) / 0.025); acc[P.bone] = (acc[P.bone] || 0) + w; });
    const top = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, t) => a + t[1], 0);
    top.forEach(([b, w], q) => { bi[v * 4 + q] = names.indexOf(b); bw[v * 4 + q] = w / sum; });
  }
  return { pos, nrm, idx, bi, bw };
}
function multiResGeometry(parts, BONES, org, size, H, fine) {
  const inBox = (x, y, z, B, m) => x > B.lo[0] + m && x < B.hi[0] - m && y > B.lo[1] + m && y < B.hi[1] - m && z > B.lo[2] + m && z < B.hi[2] - m;
  const depthIn = (x, y, z, B) => Math.min(x - B.lo[0], B.hi[0] - x, y - B.lo[1], B.hi[1] - y, z - B.lo[2], B.hi[2] - z);
  const out = { pos: [], nrm: [], idx: [], bi: [], bw: [] };
  const add = (M, keepTri, inset) => {
    const base = out.pos.length / 3;
    for (let v = 0; v < M.pos.length / 3; v++) {
      let x = M.pos[v * 3], y = M.pos[v * 3 + 1], z = M.pos[v * 3 + 2]; const n = [M.nrm[v * 3], M.nrm[v * 3 + 1], M.nrm[v * 3 + 2]];
      if (inset) { let d = 0; for (const B of fine) d = Math.max(d, depthIn(x, y, z, B)); const k = 0.0015 * Math.min(1, Math.max(0, d / 0.004)); x -= n[0] * k; y -= n[1] * k; z -= n[2] * k; }
      out.pos.push(x, y, z); out.nrm.push(...n);
      for (let q = 0; q < 4; q++) { out.bi.push(M.bi[v * 4 + q]); out.bw.push(M.bw[v * 4 + q]); }
    }
    for (let t = 0; t < M.idx.length; t += 3) { const a = M.idx[t], b = M.idx[t + 1], c = M.idx[t + 2]; if (keepTri(a, b, c, M.pos)) out.idx.push(base + a, base + b, base + c); }
  };
  const P3 = (pos, i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  // grossa: some só bem dentro das caixas finas (faixa de 1,6 cm em que as duas existem)
  add(sdfMesh(parts, BONES, org, size, H), (a, b, c, pos) => !fine.some(B => [a, b, c].every(i => inBox(...P3(pos, i), B, 0.016))), true);
  for (const B of fine) {
    const sub = parts.filter(P => { const lo = P.a ? P.a.map((v, q) => Math.min(v, P.b[q]) - Math.max(P.r0, P.r1) - P.k) : P.c.map((v, q) => v - Math.max(...P.r) - P.k), hi = P.a ? P.a.map((v, q) => Math.max(v, P.b[q]) + Math.max(P.r0, P.r1) + P.k) : P.c.map((v, q) => v + Math.max(...P.r) + P.k); return [0, 1, 2].every(q => hi[q] > B.lo[q] - 0.04 && lo[q] < B.hi[q] + 0.04); });
    add(sdfMesh(sub, BONES, B.lo, B.hi.map((v, q) => v - B.lo[q]), B.H), () => true, false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.bi, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.bw, 4));
  g.setIndex(out.idx); g.computeBoundingSphere();
  return g;
}

// ---------- esqueleto (metros, frente = +z, chão = 0; lobo cinzento adulto: ~0,8 m na cernelha) ----------
const WB = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 0.68, -0.32]], chest: ['hips', [0, 0.7, 0.18]], neck: ['chest', [0, 0.76, 0.36]], head: ['neck', [0, 0.9, 0.6]], jaw: ['head', [0, 0.856, 0.67]],
  t1: ['hips', [0, 0.665, -0.56]], t2: ['t1', [0, 0.575, -0.655]], t3: ['t2', [0, 0.455, -0.705]], t4: ['t3', [0, 0.335, -0.72]],
};
for (const s of [-1, 1]) Object.assign(WB, {
  ['ear' + s]: ['head', [s * 0.056, 0.982, 0.6]],
  ['up' + s]: ['chest', [s * 0.1, 0.62, 0.27]], ['fo' + s]: ['up' + s, [s * 0.095, 0.415, 0.205]], ['pa' + s]: ['fo' + s, [s * 0.09, 0.13, 0.262]],
  ['th' + s]: ['hips', [s * 0.105, 0.635, -0.42]], ['sh' + s]: ['th' + s, [s * 0.105, 0.44, -0.3]], ['mt' + s]: ['sh' + s, [s * 0.1, 0.2, -0.505]],
});
const FOOT = { f: [0.03, 0.305], h: [0.03, -0.448] }; // ponto de apoio da pata (y, z) em repouso

// dedos da pata (do lado -x para o +x): os dois do meio mais à frente, os de fora um pouco abertos
const TOE_LAYOUT = (x0, z0, k) => [-0.029, -0.0102, 0.0102, 0.029].map((o, q) => { const mid = q === 1 || q === 2, yaw = o * 4.5; return { x: x0 + o * k, z: z0 + (mid ? 0.037 : 0.027) * k, yaw, len: 0.019 * k }; });
function wolfParts() {
  const P = [], C = (a, b, r0, r1, bone, k = 0.06) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.06) => P.push({ c, r, bone, k });
  /* S-396: pata de lobo = UMA massa compacta (nada de contas soltas): almofada do metacarpo, quatro dedos arqueados
     bem juntos (os dois do meio mais à frente), sulcos rasos entre eles e a frente "mordida" onde saem as garras. */
  const paw = (x0, z0, bone, k, s) => {
    E([x0, 0.03, z0], [0.036 * k, 0.03 * k, 0.04 * k], bone, 0.022);
    const toes = TOE_LAYOUT(x0, z0, k);
    for (const t of toes) P.push({ c: [t.x, 0.0172 * k, t.z], r: [0.0118 * k, 0.0155 * k, t.len], m: rotInv(0.1, t.yaw, 0), bone, k: 0.011 });
    for (let q = 0; q < 3; q++) { const a = toes[q], b = toes[q + 1]; P.push({ c: [(a.x + b.x) / 2, 0.03 * k, (a.z + b.z) / 2 + 0.01 * k], r: [0.0026 * k, 0.012 * k, 0.017 * k], m: rotInv(0, (a.yaw + b.yaw) / 2, 0), bone, k: 0.006, sub: true }); }
    if (k === 1) E([x0 - s * 0.026, 0.074, z0 - 0.008], [0.008, 0.012, 0.01], bone, 0.012); // "polegar" (ergô) alto, do lado de dentro
  };
  // tronco: peito fundo e estreito (quilha), costelas, cernelha, lombo mais fino, barriga recolhida, garupa
  E([0, 0.6, 0.21], [0.12, 0.2, 0.19], 'chest', 0.08);
  C([0, 0.675, 0.26], [0, 0.685, -0.05], 0.155, 0.145, 'chest', 0.08);
  E([0, 0.755, 0.19], [0.11, 0.085, 0.16], 'chest', 0.08);
  C([0, 0.685, -0.05], [0, 0.69, -0.3], 0.138, 0.12, 'hips', 0.08);
  E([0, 0.615, -0.13], [0.095, 0.07, 0.17], 'hips', 0.1);
  E([0, 0.665, -0.41], [0.118, 0.128, 0.15], 'hips', 0.08);
  // pescoço com colar de pelo e peito
  C([0, 0.72, 0.3], [0, 0.86, 0.55], 0.118, 0.082, 'neck', 0.08);
  E([0, 0.79, 0.4], [0.135, 0.155, 0.14], 'neck', 0.1);
  E([0, 0.65, 0.355], [0.095, 0.12, 0.085], 'chest', 0.08);
  /* cabeça (S-396, refeita a partir do crânio de um lobo de verdade): caixa craniana larga e baixa, testa que desce
     num "stop" curto entre os olhos, focinho ALTO e quadrado na base (lados quase retos, lábio de cima caindo sobre a
     mandíbula) que afina pouco até um nariz grande e rombudo; maçãs do rosto largas na altura dos olhos e, atrás
     delas, o leque de pelo das bochechas; mandíbula forte; orelhas largas na base, afastadas, viradas para a frente. */
  E([0, 0.93, 0.598], [0.077, 0.07, 0.097], 'head', 0.05);                 // caixa craniana
  E([0, 0.954, 0.664], [0.052, 0.04, 0.056], 'head', 0.04);                // testa (desce até o stop)
  E([0, 0.988, 0.6], [0.022, 0.016, 0.07], 'head', 0.04);                  // crista do crânio (dá o perfil do alto da cabeça)
  E([0, 0.9, 0.736], [0.05, 0.052, 0.062], 'head', 0.045);                 // base do focinho, alta
  E([0, 0.899, 0.8], [0.041, 0.043, 0.062], 'head', 0.04);                 // meio do focinho
  E([0, 0.902, 0.856], [0.032, 0.031, 0.034], 'head', 0.03);               // ponta do focinho (rombuda, nada de bico)
  C([0, 0.934, 0.71], [0, 0.926, 0.855], 0.018, 0.016, 'head', 0.03);      // dorso do focinho reto
  C([0, 0.848, 0.655], [0, 0.858, 0.846], 0.035, 0.021, 'jaw', 0.03);      // mandíbula
  E([0, 0.852, 0.826], [0.021, 0.013, 0.028], 'jaw', 0.02);                // queixo
  P.push({ c: [0, 0.866, 0.862], r: [0.12, 0.0049, 0.15], m: rotInv(-0.057, 0, 0), bone: 'jaw', k: 0.003, sub: true }); // fenda da boca: lábios de cima e de baixo separados (a boca abre de verdade, sem "bolsa" de pele)
  for (const s of [-1, 1]) {
    E([s * 0.027, 0.876, 0.792], [0.021, 0.025, 0.074], 'head', 0.03);    // lábio de cima: lados retos do focinho, caindo sobre a mandíbula
    E([s * 0.066, 0.914, 0.648], [0.04, 0.037, 0.05], 'head', 0.04);      // maçã do rosto (arco zigomático), larga na altura dos olhos
    E([s * 0.054, 0.868, 0.622], [0.04, 0.05, 0.056], 'head', 0.05);      // músculo da mandíbula
    E([s * 0.082, 0.874, 0.572], [0.042, 0.07, 0.046], 'head', 0.06);     // leque de pelo das bochechas ("ruff")
    E([s * 0.042, 0.966, 0.69], [0.023, 0.0095, 0.018], 'head', 0.022);  // arco da sobrancelha (olhar intenso)
    { // orelha: três lâminas achatadas (largas na base, ponta arredondada), viradas para a frente e um pouco para fora
      const yw = s * 0.42, pt = -0.14, rl = -s * 0.22, b = [s * 0.056, 0.982, 0.6];
      [[0.018, 0.04, 0.03, 0.017], [0.05, 0.028, 0.03, 0.013], [0.084, 0.011, 0.028, 0.008]].forEach(([h, rx, ry, rz]) => {
        const o = rotVec([0, h, 0], pt, yw, rl); P.push({ c: [b[0] + o[0], b[1] + o[1], b[2] + o[2]], r: [rx, ry, rz], m: rotInv(pt, yw, rl), bone: 'ear' + s, k: 0.02 });
      });
    }
    // pata da frente: escápula, braço até o cotovelo (para trás), antebraço, punho, metacarpo quase vertical, pata e dedos
    E([s * 0.1, 0.62, 0.26], [0.058, 0.13, 0.1], 'up' + s, 0.07);
    C([s * 0.1, 0.58, 0.27], [s * 0.095, 0.42, 0.21], 0.064, 0.045, 'up' + s, 0.05);
    E([s * 0.095, 0.408, 0.19], [0.03, 0.035, 0.034], 'up' + s, 0.03);
    C([s * 0.095, 0.415, 0.22], [s * 0.09, 0.14, 0.262], 0.041, 0.025, 'fo' + s, 0.04);
    E([s * 0.093, 0.33, 0.232], [0.039, 0.08, 0.041], 'fo' + s, 0.05);
    E([s * 0.09, 0.13, 0.262], [0.027, 0.031, 0.029], 'pa' + s, 0.024);
    C([s * 0.09, 0.13, 0.262], [s * 0.09, 0.044, 0.292], 0.023, 0.027, 'pa' + s, 0.024);
    paw(s * 0.09, 0.288, 'pa' + s, 1, s);
    // pata de trás: coxa larga, joelho para a frente, perna para trás até o jarrete alto, metatarso, pata e dedos
    E([s * 0.1, 0.6, -0.42], [0.074, 0.15, 0.13], 'th' + s, 0.08);
    C([s * 0.105, 0.62, -0.42], [s * 0.105, 0.44, -0.3], 0.094, 0.05, 'th' + s, 0.06);
    C([s * 0.1, 0.44, -0.31], [s * 0.1, 0.2, -0.505], 0.049, 0.025, 'sh' + s, 0.04);
    E([s * 0.088, 0.53, -0.29], [0.052, 0.075, 0.075], 'th' + s, 0.09); // S-381: prega do flanco liga o joelho à barriga (o joelho não fica uma "bola" solta)
    E([s * 0.1, 0.37, -0.38], [0.041, 0.08, 0.05], 'sh' + s, 0.05);
    E([s * 0.1, 0.2, -0.522], [0.021, 0.03, 0.028], 'mt' + s, 0.02);
    C([s * 0.1, 0.2, -0.505], [s * 0.1, 0.044, -0.458], 0.025, 0.025, 'mt' + s, 0.024);
    paw(s * 0.1, -0.462, 'mt' + s, 0.92, s);
  }
  // cauda grossa, caída e afinando na ponta
  // S-381: cauda de volume CHEIO (o "pincel" de pelo é a própria malha; as camadas só fazem a franja curta por cima)
  C([0, 0.67, -0.54], [0, 0.575, -0.655], 0.05, 0.07, 't1', 0.06);
  C([0, 0.575, -0.655], [0, 0.455, -0.705], 0.074, 0.088, 't2', 0.05);
  C([0, 0.455, -0.705], [0, 0.335, -0.72], 0.088, 0.074, 't3', 0.05);
  C([0, 0.335, -0.72], [0, 0.215, -0.703], 0.07, 0.016, 't4', 0.05); // afina até a ponta (sem "bola" no fim)
  return P;
}
let PARTS = null, GEO = null, EYE = null, EYE_N = null, NOSE = null;
function wolfGeo() {
  if (GEO) return GEO;
  PARTS = wolfParts();
  const fine = [{ lo: [-0.17, 0.77, 0.552], hi: [0.17, 1.13, 0.925], H: 0.0053 }]; // S-396: cabeça em grade fina (emenda dentro da juba)
  for (const s of [-1, 1]) { fine.push({ lo: [s * 0.09 - 0.062, -0.012, 0.215], hi: [s * 0.09 + 0.062, 0.086, 0.375], H: 0.0056 }); fine.push({ lo: [s * 0.1 - 0.06, -0.012, -0.535], hi: [s * 0.1 + 0.06, 0.086, -0.395], H: 0.0056 }); }
  EYE = surface(PARTS, [0.012, 0.945, 0.672], [0.62, 0.02, 0.78]); // superfície onde vai o olho direito (+x)
  EYE_N = gradient(PARTS, EYE);
  NOSE = surface(PARTS, [0, 0.905, 0.82], [0, 0, 1]);
  for (const s of [-1, 1]) { // S-396: órbita rasa em amêndoa onde o olho assenta (sem ela a curva do rosto engolia o olho e só a pupila aparecia)
    const F = eyeFrame(s), m = _m3.setFromMatrix4(_m4.makeRotationFromQuaternion(F.q).invert()).elements.slice();
    PARTS.push({ c: [F.p.x + F.N.x * 0.0032, F.p.y + F.N.y * 0.0032, F.p.z + F.N.z * 0.0032], r: [EYE_A * 1.08, EYE_B * 1.15, 0.0078], m, bone: 'head', k: 0.005, sub: true });
  }
  GEO = multiResGeometry(PARTS, WB, [-0.26, -0.02, -0.86], [0.52, 1.14, 1.86], 0.0135, fine);
  { // S-396: tudo abaixo da linha da boca vai com a mandíbula (antes o lábio e o focinho, que se sobrepõem a ela, seguravam a pele e a boca "abria por dentro")
    const P = GEO.attributes.position, SI = GEO.attributes.skinIndex, SW = GEO.attributes.skinWeight, J = Object.keys(WB).indexOf('jaw'), H = Object.keys(WB).indexOf('head');
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let v = 0; v < P.count; v++) {
      const y = P.getY(v), z = P.getZ(v), lip = 0.858 + 0.008 * ss(0.74, 0.86, z), j = ss(lip + 0.0005, lip - 0.003, y) * ss(0.63, 0.7, z) * ss(0.78, 0.81, y);
      if (j <= 0) continue;
      const ix = [SI.getX(v), SI.getY(v), SI.getZ(v), SI.getW(v)], w = [SW.getX(v), SW.getY(v), SW.getZ(v), SW.getW(v)].map(q => q * (1 - j));
      let q = ix.indexOf(J); if (q < 0) { q = w.indexOf(Math.min(...w)); ix[q] = J; w[q] = 0; } w[q] += j;
      const sum = w.reduce((a, b) => a + b, 0); SI.setXYZW(v, ...ix); SW.setXYZW(v, ...w.map(q => q / sum));
    }
    void H;
  }
  return GEO;
}

// referencial do olho do lado s: assentado na superfície (normal do rosto), virado um pouco para a frente, canto de fora mais alto
function eyeFrame(s) {
  const N = new THREE.Vector3(s * EYE_N[0], EYE_N[1], EYE_N[2] + 0.35).normalize(), X = new THREE.Vector3(0, 1, 0).cross(N).normalize(), Y = N.clone().cross(X);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, N)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * 0.3));
  return { N, q, p: new THREE.Vector3(s * EYE[0], EYE[1], EYE[2]) };
}
// ---------- peças finas (S-370): olho, nariz, dedos e garras — geometria montada uma vez e reaproveitada ----------
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/* S-396: olho de lobo AMENDOADO — cúpula baixa com o contorno em amêndoa (canto de dentro em ponta, puxado para o
   focinho; canto de fora mais alto), íris âmbar que enche a abertura (cortada em cima e embaixo pelas pálpebras, como
   no lobo de verdade), pupila redonda e quase nada de branco. `s` = lado (o canto de dentro fica em -s·x). */
const EYE_A = 0.0168, EYE_B = 0.0091, EYE_D = 0.0062;
const almond = (u, s) => { // meia-altura da abertura em u ∈ [-1, 1] (u = x / EYE_A)
  const inner = u * s < 0, a = Math.abs(u); if (a >= 1) return 0;
  return EYE_B * Math.pow(1 - Math.pow(a, inner ? 1.25 : 1.9), inner ? 0.95 : 0.62) * (1 + (inner ? -0.08 : 0.04) * a);
};
const EYE_GEOS = {};
function wolfEyeGeo(s) {
  if (EYE_GEOS[s]) return EYE_GEOS[s];
  const NU = 48, NV = 14, pos = [], col = [], idx = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const r = j / NV, a = i / NU * Math.PI * 2, x = Math.cos(a) * r * EYE_A, y = r * Math.sign(Math.sin(a)) * almond(Math.cos(a) * 0.9999, s);
    pos.push(x, y, EYE_D * Math.sqrt(Math.max(0, 1 - r * r)) * (0.75 + 0.25 * (1 - r)));
    const rho = Math.hypot(x, y), ang = Math.atan2(y, x), fib = 0.86 + 0.14 * Math.sin(ang * 23 + Math.sin(ang * 7) * 2) * Math.sin(ang * 11 + 1.3) + 0.08 * Math.sin(ang * 37);
    let c = rho < 0.0043 ? [0.02, 0.018, 0.015] : rho < 0.005 ? lerpC([0.02, 0.018, 0.015], [0.42, 0.2, 0.03], (rho - 0.0043) / 0.0007)
      : rho < 0.0075 ? lerpC([0.48, 0.24, 0.035], [0.8, 0.5, 0.1], (rho - 0.005) / 0.0025) : rho < 0.0098 ? lerpC([0.8, 0.5, 0.1], [0.5, 0.27, 0.05], (rho - 0.0075) / 0.0023)
      : rho < 0.011 ? lerpC([0.5, 0.27, 0.05], [0.08, 0.05, 0.025], (rho - 0.0098) / 0.0012) : [0.16, 0.11, 0.07];
    if (rho >= 0.0047 && rho < 0.0102) c = c.map(v => v * fib);
    c = c.map(v => v * (0.55 + 0.45 * Math.min(1, (1 - r) * 4))); // sombra da pálpebra na borda
    col.push(...c);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return (EYE_GEOS[s] = g);
}
function eyeRimGeo(s, upper) { // contorno escuro do olho (o "delineado" do lobo); upper = dobra da pálpebra de cima, mais grossa
  const pts = [], N = 64;
  for (let i = 0; i <= N; i++) { const a = upper ? Math.PI * i / N : i / N * Math.PI * 2, u = Math.cos(a); const h = almond(u * 0.999, s); pts.push(new THREE.Vector3(u * EYE_A * (upper ? 1.06 : 1.05), Math.sign(Math.sin(a)) * h * 1.08 + (upper ? 0.0018 : 0), upper ? 0.0034 : 0.0024)); }
  const curve = new THREE.CatmullRomCurve3(pts, !upper), g = new THREE.TubeGeometry(curve, upper ? 48 : 96, upper ? 0.0026 : 0.0019, 8, !upper);
  if (upper) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const u = P.getX(i) / EYE_A, k = Math.max(0, 1 - Math.abs(u)); P.setXYZ(i, P.getX(i), P.getY(i), P.getZ(i) * (0.4 + 0.6 * k)); } g.computeVertexNormals(); }
  return g;
}
let NOSE_GEO = null;
function wolfNoseGeo() {
  if (NOSE_GEO) return NOSE_GEO;
  const g = new THREE.SphereGeometry(1, 40, 28), P = g.attributes.position, col = [];
  const G = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i), dark = 0;
    if (z > 0) {
      z *= 0.78;                                                                        // frente achatada (couro do nariz, não bola)
      let dent = 0;
      for (const sx of [-1, 1]) {
        const nos = G(x, y, sx * 0.42, -0.12, 0.2, 0.24), slit = G(x, y, sx * 0.72, -0.42, 0.12, 0.1);
        dent += 0.42 * nos + 0.25 * slit; dark = Math.max(dark, nos, slit * 0.8);         // narinas em vírgula: buraco + fenda para o lado
      }
      dent += 0.16 * Math.exp(-((x / 0.07) ** 2)) * Math.max(0, Math.min(1, -y * 2.5)); // sulco do meio, embaixo
      z -= dent * z;
    }
    x *= 1 + 0.16 * y;                                                                  // mais largo em cima
    P.setXYZ(i, x * 0.0232, y * 0.0148, z * 0.0145); // S-396: nariz grande de lobo
    const v = 1 - dark * 0.75;
    col.push(0.03 * v + 0.004, 0.024 * v + 0.004, 0.023 * v + 0.004);
  }
  g.computeVertexNormals(); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return (NOSE_GEO = g);
}
function clawGeo(len, r0, bend) { // garra curva: sai para a frente e desce, achatada dos lados, afinando até a ponta
  const N = 7, RS = 8, R = len / bend, pos = [], col = [], idx = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N, a = bend * t, cy = -R * (1 - Math.cos(a)), cz = R * Math.sin(a), r = r0 * Math.pow(1 - t, 0.8) + 0.00015;
    const ny = Math.cos(a), nz = Math.sin(a), c = lerpC([0.05, 0.045, 0.042], [0.24, 0.22, 0.2], t * t);
    for (let k = 0; k < RS; k++) { const u = k / RS * Math.PI * 2, cu = Math.cos(u) * r * 0.72, su = Math.sin(u) * r; pos.push(cu, cy + ny * su, cz + nz * su); col.push(...c); }
  }
  for (let j = 0; j < N; j++) for (let k = 0; k < RS; k++) { const a = j * RS + k, b = j * RS + (k + 1) % RS, c = a + RS, d = b + RS; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const CLAWS = {};
function clawsGeo(k, s) { // S-396: garras escuras e rombudas saindo da ponta de cada dedo da escultura (em coordenadas do corpo em repouso)
  const key = k + s; if (CLAWS[key]) return CLAWS[key];
  const out = [], m = new THREE.Matrix4(), e = new THREE.Euler(), sc = k === 'f' ? 1 : 0.92;
  const toes = k === 'f' ? TOE_LAYOUT(s * 0.09, 0.288, 1) : TOE_LAYOUT(s * 0.1, -0.462, 0.92);
  toes.forEach((t, q) => {
    const mid = q === 1 || q === 2, f = t.len * 0.9;
    m.compose(new THREE.Vector3(t.x + Math.sin(t.yaw) * f, 0.0135 * sc, t.z + Math.cos(t.yaw) * f), new THREE.Quaternion().setFromEuler(e.set(0.3, t.yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    out.push(clawGeo((mid ? 0.021 : 0.018) * sc, 0.0046 * sc, 1.1).applyMatrix4(m));
  });
  if (k === 'f') { m.compose(new THREE.Vector3(s * 0.064, 0.066, 0.283), new THREE.Quaternion().setFromEuler(e.set(1.2, -s * 0.4, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)); out.push(clawGeo(0.009, 0.0028, 1.1).applyMatrix4(m)); }
  return (CLAWS[key] = mergeGeometries(out));
}

// ---------- pelagem pintada (espaço do osso em repouso: o desenho fica preso ao corpo) ----------
const COAT_GLSL = `
uniform vec3 uBase, uLight, uDark, uTan, uEye, uNose;
float wHead(vec3 p){ return smoothstep(0.55, 0.6, p.z) * smoothstep(0.78, 0.82, p.y); }
float wRuff(vec3 p){ return smoothstep(0.52, 0.56, p.z) * smoothstep(0.056, 0.085, abs(p.x)) * (1.0 - smoothstep(0.64, 0.69, p.z)) * smoothstep(0.95, 0.91, p.y) * smoothstep(0.78, 0.82, p.y); }
float wEar(vec3 p){ return wHead(p) * smoothstep(0.975, 0.995, p.y) * smoothstep(0.03, 0.045, abs(p.x)); }
// direção em que o pelo deita: para trás e para baixo no corpo, para baixo nas pernas e na cauda, para trás no rosto
vec3 wComb(vec3 p){
  vec3 c = vec3(0.0, -0.55, -0.85);
  c = mix(c, vec3(0.0, -1.0, -0.15), smoothstep(0.5, 0.36, p.y) * step(abs(p.z + 0.08), 0.6));
  c = mix(c, vec3(0.0, -0.85, -0.5), smoothstep(-0.56, -0.62, p.z) * (1.0 - step(0.7, p.y)));
  c = mix(c, vec3(0.0, 0.15, -1.0), wHead(p));
  c = mix(c, vec3(sign(p.x) * 0.8, -0.35, -0.5), wRuff(p));                                   // S-396: leque das bochechas abre para os lados
  return normalize(c);
}
vec3 wCoat(vec3 p, vec3 n){
  float hd = wHead(p);
  float soft = vn(p * 18.0);                                                                                           // S-370: bordas das manchas irregulares (nada de contorno "desenhado")
  float la = smoothstep(-0.15, -0.65, n.y) * (1.0 - step(0.78, p.y));                                                  // barriga e de baixo
  la = max(la, smoothstep(0.1, 0.04, abs(p.x)) * smoothstep(0.26, 0.34, p.z) * smoothstep(0.84, 0.74, p.y) * (1.0 - step(0.62, p.z))); // garganta e peito
  la = max(la, hd * smoothstep(0.872, 0.852, p.y));                                                                     // queixo e mandíbula
  // S-396: máscara clara do lobo — lados do focinho, lábio de cima e bochechas ABAIXO da linha dos olhos (em cima fica escuro)
  float eyeLine = 0.93 - 0.012 * smoothstep(0.72, 0.84, p.z) + (soft - 0.5) * 0.012;
  la = max(la, hd * smoothstep(0.016, 0.036, abs(p.x)) * smoothstep(eyeLine, eyeLine - 0.022, p.y) * smoothstep(0.6, 0.66, p.z) * 0.92);
  la = max(la, wRuff(p) * (0.45 + 0.35 * smoothstep(0.9, 0.86, p.y)));                                                  // leque das bochechas claro embaixo, mesclado em cima
  la = max(la, hd * (1.0 - smoothstep(0.007, 0.016, length(vec3(abs(p.x) - 0.04, p.y - 0.969, p.z - 0.69)))) * 0.75); // "sobrancelhas" claras sobre os olhos
  la = max(la, smoothstep(0.5, 0.3, p.y) * 0.7);                                                                       // patas claras
  la = max(la, smoothstep(0.2, 0.9, -n.x * sign(p.x)) * smoothstep(0.62, 0.45, p.y) * 0.8);                             // lado de dentro das pernas
  vec3 col = mix(uBase, uTan, smoothstep(0.5, 0.75, vn(p * 4.0)) * 0.6 * smoothstep(0.8, 0.55, p.y)); // tons ocre nos flancos e nas pernas
  col = mix(col, uLight, clamp(la, 0.0, 1.0));
  vec3 gq = p * 120.0; vec3 cb = wComb(p); gq -= cb * dot(gq, cb) * 0.85;
  float griz = vn(gq) * 0.75 + vn(p * 23.0) * 0.25;                                                                  // S-381: pontas escuras em MECHAS (esticadas no sentido do pelo), não pontinhos
  float saddle = smoothstep(-0.25, 0.45, n.y) * smoothstep(0.6, 0.72, p.y) * smoothstep(0.5, 0.34, p.z + (soft - 0.5) * 0.06) * smoothstep(-0.63, -0.52, p.z); // sela escura mesclada no dorso (S-381: bordas macias, sem linha reta)
  saddle = max(saddle, smoothstep(0.4, 0.9, n.y) * smoothstep(0.72, 0.8, p.y) * smoothstep(0.64, 0.52, p.z) * 0.85);  // nuca
  col = mix(col, uDark * (0.6 + 1.2 * griz), saddle * 0.9);                                                            // pelos de ponta preta mesclados
  float bridge = hd * smoothstep(0.03 + (soft - 0.5) * 0.012, 0.008, abs(p.x)) * smoothstep(0.905, 0.93, p.y) * smoothstep(0.68, 0.73, p.z) * (1.0 - smoothstep(0.85, 0.875, p.z));
  col = mix(col, mix(uTan, uDark, 0.5) * (0.8 + 0.35 * griz), bridge * 0.85);                                          // dorso do focinho ocre-escuro
  float crown = hd * smoothstep(0.935, 0.965, p.y + (soft - 0.5) * 0.012) * (1.0 - smoothstep(0.69, 0.73, p.z)) * (1.0 - wEar(p));
  crown = max(crown, hd * smoothstep(0.03, 0.012, abs(p.x)) * smoothstep(0.66, 0.7, p.z) * (1.0 - smoothstep(0.72, 0.745, p.z)) * smoothstep(0.92, 0.95, p.y)); // a testa escura desce entre os olhos
  col = mix(col, uDark * (0.95 + 1.1 * griz), crown * 0.7);                                                           // S-396: testa e alto da cabeça escuros, mesclados
  { // orelhas: costas ocre-acinzentadas com borda e ponta escuras, por dentro clara e peluda
    float er = wEar(p), front = smoothstep(0.05, 0.45, dot(n, normalize(vec3(sign(p.x) * 0.38, 0.12, 0.92))));
    col = mix(col, mix(uTan, uDark, 0.35) * (0.85 + 0.3 * griz), er * (1.0 - front) * 0.8);
    col = mix(col, uDark * 0.7, er * smoothstep(1.035, 1.07, p.y) * 0.85);
    col = mix(col, uLight * 0.92, er * front * smoothstep(1.075, 1.04, p.y));
  }
  float tl = smoothstep(-0.555, -0.6, p.z) * (1.0 - smoothstep(0.66, 0.72, p.y));
  col = mix(col, uDark * (0.7 + 1.2 * griz), tl * smoothstep(-0.2, 0.7, n.y) * 0.6);                                   // cauda: em cima escura, mesclada
  col = mix(col, uDark * (0.7 + 0.6 * griz), tl * smoothstep(0.32, 0.24, p.y + (soft - 0.5) * 0.03) * 0.85);              // ponta escura, mesclada (S-381: não um "pompom" preto)
  // S-370: focinho de lobo — couro do nariz só na ponta (a peça 3D faz o resto), lábio escuro fino só perto do canto da boca
  col = mix(col, vec3(0.06, 0.05, 0.05), hd * (1.0 - smoothstep(0.016, 0.03, length((p - uNose) * vec3(0.95, 1.2, 0.7)))) * 0.9);
  { // S-396: lábio preto na borda do lábio de cima (o vinco da boca) até o canto, sob o olho
    float lipY = 0.858 + 0.008 * smoothstep(0.74, 0.86, p.z);
    float dl = p.y - lipY; dl = dl > 0.0 ? dl : -dl * (0.85 - 0.3 * smoothstep(0.78, 0.86, p.z)); // a borda escura desce mais no lábio de baixo (na frente)
    float lip = (1.0 - smoothstep(0.006, 0.011, dl)) * smoothstep(0.705, 0.725, p.z) * (1.0 - smoothstep(0.885, 0.9, p.z));
    col = mix(col, vec3(0.055, 0.045, 0.04), hd * lip * 0.9);                                                       // lábio preto em volta da boca toda (na frente também: sem "linha branca" de sorriso)
    float inner = (1.0 - smoothstep(0.006, 0.012, abs(p.y - lipY))) * smoothstep(0.72, 0.74, p.z) * (1.0 - smoothstep(0.83, 0.85, p.z)) * (1.0 - smoothstep(0.02, 0.032, abs(p.x))) * smoothstep(0.5, 0.8, abs(n.y));
    col = mix(col, vec3(0.2, 0.075, 0.075), hd * inner);                                                               // céu da boca e gengiva (só aparecem com a boca aberta)
  }
  { // contorno escuro em volta do olho (sombra do delineado no pelo) e a "lágrima" escura descendo para o focinho
    vec3 q = vec3(abs(p.x), p.y, p.z) - uEye;
    col = mix(col, uDark * 0.55, hd * (1.0 - smoothstep(0.016, 0.026, length(q * vec3(1.0, 1.5, 1.0)))) * 0.7);
    vec3 a0 = uEye + vec3(-0.012, -0.004, 0.008), a1 = a0 + vec3(-0.006, -0.03, 0.03); vec3 pa = vec3(abs(p.x), p.y, p.z) - a0, ba = a1 - a0;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0), tear = 1.0 - smoothstep(0.002, 0.005 + 0.004 * h, length(pa - ba * h));
    col = mix(col, uDark * 0.5, hd * tear * (1.0 - h * 0.8) * 0.7);
  }
  col = mix(col, col * vec3(1.06, 0.97, 0.85), smoothstep(0.36, 0.14, p.y));                                           // patas um pouco ocre
  col = mix(col, col * vec3(0.84, 0.79, 0.72), smoothstep(0.07, 0.015, p.y) * (0.6 + 0.4 * soft));                      // pata: creme sujo de terra, não "meia" branca
  col = mix(col, vec3(0.07, 0.06, 0.055), smoothstep(0.009, 0.003, p.y) * smoothstep(-0.2, -0.6, n.y));               // almofadas (só por baixo)
  return col * (0.9 + 0.2 * griz);
}
// comprimento do pelo (em metros, no lobo comum). legs: 0 = corpo, 1 = perna/rosto (pelo curto e assentado mesmo no lobo gigante)
float wLegs(vec3 p){ return max(smoothstep(0.42, 0.3, p.y) * step(abs(p.z + 0.08), 0.6), wHead(p) * smoothstep(0.68, 0.74, p.z)); }
float wFurLen0(vec3 p){
  float L = 0.017;
  float hd = wHead(p);
  L = mix(L, 0.044, smoothstep(0.26, 0.36, p.z) * (1.0 - smoothstep(0.56, 0.63, p.z)) * smoothstep(0.56, 0.7, p.y));   // colar do pescoço (juba)
  L = mix(L, 0.022, hd * (1.0 - smoothstep(0.67, 0.72, p.z)) * smoothstep(0.86, 0.9, p.y));                       // crânio e testa com pelo de verdade (o focinho fica curto)
  L = mix(L, 0.032, wRuff(p));                                                                                          // S-396: leque de pelo das bochechas, abrindo para os lados
  L = mix(L, 0.026, smoothstep(-0.55, -0.6, p.z) * (1.0 - step(0.69, p.y)));                                             // cauda (o volume já está na malha)
  L = mix(L, 0.028, smoothstep(-0.44, -0.5, p.z) * smoothstep(0.38, 0.48, p.y) * (1.0 - smoothstep(0.66, 0.7, p.y)));    // "calças" das coxas
  L = mix(L, 0.022, smoothstep(0.6, 0.5, p.y) * (1.0 - wLegs(p)));                                                      // barriga
  L = mix(L, 0.0065, smoothstep(0.42, 0.3, p.y) * step(abs(p.z + 0.08), 0.6));                                           // pernas: pelo curto e assentado
  L = mix(0.009, L, smoothstep(0.04, 0.11, p.y));                                                                      // pata: pelo curto e assentado por cima dos dedos
  L *= smoothstep(0.003, 0.012, p.y);                                                                                   // nada de pelo embaixo (almofadas no chão)
  L *= 1.0 - 0.7 * hd * smoothstep(0.7, 0.76, p.z);                                                                      // focinho: curto e aveludado
  L = mix(L, 0.007, wEar(p));                                                                                           // orelhas: pelo curto (a cor faz o "peludo por dentro")
  L *= 1.0 - hd * smoothstep(0.7, 0.72, p.z) * (1.0 - smoothstep(0.006, 0.016, abs(p.y - (0.858 + 0.008 * smoothstep(0.74, 0.86, p.z))))); // sem pelo no vinco da boca
  L *= smoothstep(0.02, 0.036, length(vec3(abs(p.x), p.y, p.z) - uEye));                                                 // nada de pelo sobre os olhos
  L *= 1.0 - hd * (1.0 - smoothstep(0.03, 0.05, length(p - uNose)));                                                   // nem sobre o nariz
  return L;
}
float wFurLen(vec3 p){ return wFurLen0(p) * (0.8 + 0.4 * vn(p * 21.0)); }                                               // tufos: comprimento irregular (S-381: menos variação = sem fios soltos)
// S-381: mecha em relevo na pele (normal perturbada): ruído esticado no sentido do pelo, para a base já parecer pelagem
float wFurH(vec3 p, vec3 comb){ vec3 q = p * 230.0; q -= comb * dot(q, comb) * 0.82; return vn(q) * 0.65 + vn(q * 2.3 + 7.1) * 0.35; }
`;
/* S-332: fio de pelo redondo que afina até a ponta, projetado em TRÊS planos misturados pela normal (sem emendas
   onde o eixo dominante troca — era o que soltava "pedacinhos" na cauda) e com borda suave (fwidth) para a
   transparência por cobertura (alphaToCoverage + MSAA): nada de quadradinhos nem silhueta em degraus. */
export const FUR_STRAND_GLSL = `
float furHash(vec2 c, float s){ return fract(sin(dot(c, vec2(12.9898, 78.233)) + s * 3.7) * 43758.5453); }
float furPlane(vec2 q, float f, float s){
  vec2 c = floor(q); float h = furHash(c, s);
  vec2 fr = fract(q) - 0.5 - (vec2(fract(h * 91.7), fract(h * 57.3)) - 0.5) * 0.5;
  float d = length(fr), th = (1.0 - f * (0.74 + 0.2 * h)) * (0.5 + 0.2 * h), aa = max(fwidth(d) * 1.2, 0.03);
  return 1.0 - smoothstep(th - aa, th + aa, d);
}
float furCover(vec3 p, vec3 n, float den, float f){
  vec3 w = pow(abs(normalize(n)), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return furPlane(p.yz * den + vec2(0.37, 0.71), f, 1.0) * w.x + furPlane(p.zx * den + vec2(0.74, 0.42), f, 2.0) * w.y + furPlane(p.xy * den + vec2(0.11, 0.93), f, 3.0) * w.z;
}`;
/* S-332/S-370: fio de pelo projetado em TRÊS planos misturados pela normal, com borda suave (fwidth) para a
   transparência por cobertura (alphaToCoverage + MSAA). S-370: o fio agora é uma MECHA alongada na direção em que o
   pelo deita (antes era um pontinho redondo — de lado as camadas viravam "pixels"), cada fio tem o seu comprimento
   (pontas irregulares) e os fios se juntam em tufos. Devolve (cobertura, sorteio do fio) para variar a cor fio a fio. */
const WOLF_STRAND_GLSL = `
float wfHash(vec2 c, float s){ return fract(sin(dot(c, vec2(12.9898, 78.233)) + s * 3.7) * 43758.5453); }
vec2 wfPlane(vec2 q, vec2 cd, float f, float s){
  float k = length(cd); vec2 d1 = k > 0.2 ? cd / k : vec2(1.0, 0.0);
  vec2 d2 = vec2(-d1.y, d1.x);
  q += vec2(sin(q.y * 0.21 + s * 1.7) + sin(q.y * 0.07 + q.x * 0.05), sin(q.x * 0.17 + s * 2.3) + sin(q.x * 0.06 - q.y * 0.04)) * 0.7; // mechas levemente onduladas (nada de riscos paralelos)
  float st = mix(1.0, 3.0, smoothstep(0.2, 0.7, k));                                // S-381: mechas mais compridas (de perto não viram "escamas")                                // mecha deitada = alongada no sentido do pelo
  vec2 u = vec2(dot(q, d1) / st, dot(q, d2)); u.y += floor(u.x) * 0.5;               // fileiras desencontradas (sem grade)
  vec2 c = floor(u); float h = wfHash(c, s), len = 0.72 + 0.28 * fract(h * 13.7);
  if (f > len) return vec2(0.0, h);
  vec2 fr = fract(u) - 0.5 - (vec2(fract(h * 91.7), fract(h * 57.3)) - 0.5) * 0.6;
  fr.x -= f * 0.35 * (k > 0.2 ? 1.0 : 0.0);                                          // a ponta tomba para o sentido do pelo
  float dd = length(fr), th = (1.0 - f / len * 0.6) * (0.6 + 0.16 * h), aa = max(fwidth(dd) * 1.2, 0.03); // S-381: mechas grossas que se tocam
  return vec2(1.0 - smoothstep(th - aa, th + aa, dd), h);
}
vec2 wfCover(vec3 p, vec3 n, vec3 comb, float den, float f){
  vec3 w = pow(abs(normalize(n)), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  vec2 r = vec2(0.0);                                                                // só os planos que contam (economia: quase sempre 1 ou 2)
  if (w.x > 0.03) r += wfPlane(p.yz * den + vec2(0.37, 0.71), comb.yz, f, 1.0) * w.x;
  if (w.y > 0.03) r += wfPlane(p.zx * den + vec2(0.74, 0.42), comb.zx, f, 2.0) * w.y;
  if (w.z > 0.03) r += wfPlane(p.xy * den + vec2(0.11, 0.93), comb.xy, f, 3.0) * w.z;
  return r;
}`;
const MATS = {};
// S-370: a chave do programa leva uma assinatura do código do shader (mudou o shader = programa novo; antes uma chave fixa reaproveitava o programa antigo)
const SIG = (() => { let h = 0; const t = COAT_GLSL + WOLF_STRAND_GLSL; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); })();
function coatUniforms(sh, C) { Object.assign(sh.uniforms, { uBase: { value: C.base }, uLight: { value: C.light }, uDark: { value: C.dark }, uTan: { value: C.tan }, uEye: { value: new THREE.Vector3(...EYE) }, uNose: { value: new THREE.Vector3(...NOSE) } }); }
function wolfMats(color, fur = 1) { // fur: multiplicador do comprimento do pelo (lobo gigante do Caçador = pelagem bem mais longa)
  const KEY = color + '|' + fur; if (MATS[KEY]) return MATS[KEY];
  const base = new THREE.Color(color), C = { base, light: base.clone().lerp(new THREE.Color('#efe6d4'), 0.72), dark: base.clone().multiplyScalar(0.22), tan: base.clone().lerp(new THREE.Color('#b8925e'), 0.55) };
  const K = `float wK(vec3 p){ return mix(${fur.toFixed(3)}, ${Math.min(fur, 1.1).toFixed(3)}, max(wLegs(p), wHead(p) * 0.3)); }\n`; // S-396: cabeça com pelo de LOBO (o pelo longo do gigante deixava a cara redonda de foca); a juba do pescoço continua longa
 // pelo longo no corpo; pernas e rosto continuam de lobo
  /* S-381: pelagem SÓLIDA. Antes: 8–10 camadas finas e semitransparentes com fios em pontinhos — de lado e na cauda viravam
     fatias e "pedacinhos soltos" com vão entre eles, com cara de holograma. Agora: (1) a malha da pele é INFLADA por metade do
     comprimento do pelo (o volume — juba, bochechas, cauda, calças — é corpo opaco de verdade) e tem mechas em relevo (normal
     perturbada) e o tom escuro da raiz; (2) só a metade de fora do pelo é feita por camadas: poucas, coladas umas nas outras, a
     de dentro inteira (subpelo sem vãos), mechas grossas que se tocam, corte por alphaTest (nada de transparência nem brilho),
     cor escurecendo para a raiz; (3) o penteado desloca pouco as camadas (antes elas escorregavam para fora da ponta da cauda). */
  const INFL = 0.5;
  const body = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  body.onBeforeCompile = sh => {
    coatUniforms(sh, C);
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + SDF_NOISE_GLSL + COAT_GLSL + K + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vOP = position; vON = normal; transformed += normal * wFurLen0(position) * wK(position) * ${INFL.toFixed(2)};`);
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON;\n' + SDF_NOISE_GLSL + COAT_GLSL + K + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float Lb = wFurLen0(vOP) * wK(vOP), fh = wFurH(vOP, wComb(vOP)), fk = smoothstep(0.004, 0.02, Lb);
        diffuseColor.rgb *= wCoat(vOP, normalize(vON)) * mix(1.0, 0.74 + 0.3 * fh, fk);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (fk > 0.01) { vec2 dH = vec2(dFdx(fh), dFdy(fh)); vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); vec3 R1 = cross(dpy, normal), R2 = cross(normal, dpx); float det = dot(dpx, R1);
          normal = normalize(abs(det) * normal - sign(det) * (dH.x * R1 + dH.y * R2) * 0.002 * fk); }`);
  };
  body.customProgramCacheKey = () => 'wolf-body-' + SIG + '-' + fur;
  const shells = [];
  const NL = fur > 1.3 ? 11 : 6, CB = fur > 1.3 ? 0.18 : 0.35, RD = fur > 1.3 ? 0.74 : 0.6; // S-384: lobo gigante (pelo longo) — mais camadas, menos escorregão do penteado e raiz menos escura: a juba de perto não forma mais "fileiras de escamas"
  for (let i = 1; i <= NL; i++) {
    const f = i / NL, m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    m.onBeforeCompile = sh => {
      coatUniforms(sh, C); sh.uniforms.uF = { value: f };
      sh.vertexShader = 'varying vec3 vOP; varying vec3 vON; uniform float uF;\n' + SDF_NOISE_GLSL + COAT_GLSL + K + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vOP = position; vON = normal; float L0 = wFurLen0(position) * wK(position), h = L0 * ${INFL.toFixed(2)} + (wFurLen(position) * wK(position) - L0 * ${INFL.toFixed(2)}) * uF;
        transformed += normal * max(h, 0.0) + wComb(position) * L0 * uF * uF * ${CB.toFixed(2)};`);
      sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform float uF;\n' + SDF_NOISE_GLSL + COAT_GLSL + K + WOLF_STRAND_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float L = wFurLen(vOP) * wK(vOP);
        if (L < 0.004) discard;
        float den = mix(240.0, ${fur > 1.3 ? '175.0' : '120.0'}, smoothstep(0.02, 0.07, L));                                // mechas grossas (pelo longo = mechas mais largas)
        vec2 fc = wfCover(vOP, vON, wComb(vOP), den, uF);
        float a = max(fc.x, 1.0 - smoothstep(0.3, 0.55, uF));                                    // metade de dentro: subpelo inteiro, sem vão até a pele
        float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        a *= mix(1.0, smoothstep(0.0, 0.2, ndv), uF * 0.3);                                      // silhueta: só a ponta das mechas afina
        if (a < 0.5) discard;                                                                    // corte seco (sem transparência = sem cara de holograma)
        diffuseColor.rgb *= wCoat(vOP, normalize(vON)) * mix(${RD.toFixed(2)}, 1.0, uF) * (0.95 + 0.1 * fc.y); // raiz mais escura (oclusão), ponta na cor da pelagem`);
    };
    m.customProgramCacheKey = () => 'wolf-shell-' + SIG + '-' + i + '-' + NL + '-' + fur;
    shells.push(m);
  }
  return (MATS[KEY] = { body, shells });
}

// ---------- marcha: fase de cada pata [frente esq., frente dir., trás esq., trás dir.] ----------
const GAITS = {
  walk: { off: [0.25, 0.75, 0.0, 0.5], duty: 0.62, cyc: 0.62, A: 0.3, lift: 0.07 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], duty: 0.44, cyc: 1.05, A: 0.4, lift: 0.1 },
  gallop: { off: [0.52, 0.42, 0.0, 0.12], duty: 0.3, cyc: 2.0, A: 0.6, lift: 0.14 },
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const JAW0 = -0.065; // S-396: boca fechada = mandíbula um pouco acima da fenda (os lábios se encostam; sem "sorriso" aberto)
const angOf = (dz, dy) => Math.atan2(dz, -dy); // ângulo a partir de "para baixo" (positivo = para a frente)

export function realWolf(color = '#8a8f99', opts = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const geo = wolfGeo(), M = wolfMats(color, opts.fur || 1);
  const rig = sdfRig(geo, WB, M.body), { at, bones } = rig, R = n => bones[n].rotation; body.add(rig.mesh);
  const shells = M.shells.map(m => { const s = new THREE.SkinnedMesh(geo, m); s.bind(rig.mesh.skeleton, rig.mesh.bindMatrix); s.frustumCulled = false; s.castShadow = false; s.receiveShadow = true; body.add(s); return s; });
  let lod = 0;
  rig.mesh.onBeforeRender = (r, sc, cam) => { // perto: todas as camadas de pelo; a meia distância, uma sim outra não (S-370: o pelo ficou mais denso de perto sem pesar de longe); longe: só a malha pintada
    const d = cam.position.distanceTo(rig.mesh.getWorldPosition(_v)), want = d < 11 ? 0 : d < 28 ? 1 : 2;
    if (want !== lod) { lod = want; shells.forEach((s, i) => s.visible = lod === 0 || (lod === 1 && (i & 1) === 1)); }
  };

  // S-370: olhos vivos — íris âmbar com fibras e aro escuro, pupila redonda, córnea molhada (brilho de verdade da luz) e pálpebra
  const IRIS = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, emissive: '#6a3a08', emissiveIntensity: 0.15, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 });
  const LID = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.42), roughness: 0.95 });
  const RIM = new THREE.MeshStandardMaterial({ color: '#16120f', roughness: 0.6 });
  const lids = [];
  for (const s of [-1, 1]) { // S-396: olho assentado na superfície (orientado pela normal do rosto), virado um pouco para a frente, canto de fora mais alto
    const F = eyeFrame(s), eg = new THREE.Group(); eg.quaternion.copy(F.q);
    at('head', eg, F.p.x - F.N.x * 0.0042, F.p.y - F.N.y * 0.0042, F.p.z - F.N.z * 0.0042);
    eg.add(new THREE.Mesh(wolfEyeGeo(s), IRIS), new THREE.Mesh(eyeRimGeo(s, false), RIM), new THREE.Mesh(eyeRimGeo(s, true), RIM));
    const lg = wolfEyeGeo(s).clone(); lg.deleteAttribute('color'); lg.scale(1.06, 1.1, 1.25); lg.translate(0, -EYE_B * 1.1, 0.0006);
    const piv = new THREE.Group(); piv.position.y = EYE_B * 1.1; eg.add(piv); const lid = new THREE.Mesh(lg, LID); piv.add(lid); lid.scale.y = 0.01; lid.visible = false; lids.push(lid);
  }
  // S-370: nariz de lobo — couro escuro e úmido, mais largo em cima, narinas em vírgula abertas para os lados e o sulco do meio
  { const nm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.28 });
    const n = at('head', new THREE.Mesh(wolfNoseGeo(), nm), 0, NOSE[1] + 0.003, NOSE[2] - 0.008); n.rotation.x = 0.12; }
  // boca: fundo escuro, língua, dentes (presas em cima e embaixo)
  const TOOTH = new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.35 }), inMouth = []; // S-370: boca, língua e dentes só aparecem com a boca aberta (fechada, a borda deles vazava pela emenda e "desenhava" a boca)
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#2a0d0d', roughness: 0.7 })); mouth.scale.set(0.03, 0.016, 0.085); at('head', mouth, 0, 0.862, 0.76); inMouth.push(mouth);
  const mouthLo = new THREE.Mesh(mouth.geometry, mouth.material); mouthLo.scale.set(0.026, 0.012, 0.08); at('jaw', mouthLo, 0, 0.852, 0.76); inMouth.push(mouthLo);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#c0566a', roughness: 0.45 })); tongue.scale.set(0.02, 0.006, 0.06); at('jaw', tongue, 0, 0.864, 0.79); inMouth.push(tongue);
  for (const s of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.0048, 0.026, 10), TOOTH); up.rotation.x = Math.PI; at('head', up, s * 0.022, 0.86, 0.835); inMouth.push(up);
    const lo = new THREE.Mesh(new THREE.ConeGeometry(0.0042, 0.02, 10), TOOTH); at('jaw', lo, s * 0.019, 0.879, 0.818); inMouth.push(lo);
    for (let k = 0; k < 3; k++) { const pm = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.01, 6), TOOTH); pm.rotation.x = Math.PI; at('head', pm, s * 0.027, 0.864, 0.8 - k * 0.022); inMouth.push(pm); }
  }
  for (let k = 0; k < 4; k++) { const inc = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.008, 0.003), TOOTH); at('head', inc, (k - 1.5) * 0.0062, 0.864, 0.855 - Math.abs(k - 1.5) * 0.003); inMouth.push(inc); }
  // garras (S-396: os dedos agora fazem parte da própria malha da pata; aqui só as garras)
  const CLAW = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.38 });
  for (const s of [-1, 1]) for (const k of ['f', 'h']) at((k === 'f' ? 'pa' : 'mt') + s, new THREE.Mesh(clawsGeo(k, s), CLAW), 0, 0, 0);
  root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.castShadow = true; });

  // pernas: geometria de repouso para a IK (plano sagital y,z)
  const P = n => WB[n][1];
  const legs = [['f', -1], ['f', 1], ['h', -1], ['h', 1]].map(([k, s], i) => {
    const [a, b, c] = k === 'f' ? ['up' + s, 'fo' + s, 'pa' + s] : ['th' + s, 'sh' + s, 'mt' + s];
    const A = P(a), B = P(b), Cc = P(c), F = FOOT[k];
    const l1 = Math.hypot(B[1] - A[1], B[2] - A[2]), l2 = Math.hypot(Cc[1] - B[1], Cc[2] - B[2]), l3 = Math.hypot(F[0] - Cc[1], F[1] - Cc[2]);
    return { i, k, s, a, b, c, l1, l2, l3, r1: angOf(B[2] - A[2], B[1] - A[1]), r2: angOf(Cc[2] - B[2], Cc[1] - B[1]), r3: angOf(F[1] - Cc[2], F[0] - Cc[1]), fz: F[1], bend: k === 'f' ? -1 : 1 };
  });
  // posição (y,z) do pivô de cada perna no espaço do "root", com a postura atual do corpo e da coluna
  const rotYZ = (y, z, a) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  function pivot(leg) {
    const bp = body.rotation.x, hp = WB.hips[1], [hy, hz] = rotYZ(hp[1], hp[2], bp);
    let y = body.position.y + hy, z = body.position.z + hz, acc = bp + R('hips').x;
    if (leg.k === 'f') { const cp = WB.chest[1], [dy, dz] = rotYZ(cp[1] - hp[1], cp[2] - hp[2], acc); y += dy; z += dz; acc += R('chest').x; const up = P(leg.a), [ey, ez] = rotYZ(up[1] - cp[1], up[2] - cp[2], acc); return [y + ey, z + ez, acc]; }
    const th = P(leg.a), [ey, ez] = rotYZ(th[1] - hp[1], th[2] - hp[2], acc); return [y + ey, z + ez, acc];
  }
  // IK: pata no alvo (y,z) com a inclinação th3 do último segmento
  function solveLeg(leg, fy, fz, th3) {
    const [py, pz, acc] = pivot(leg);
    const ay = fy + leg.l3 * Math.cos(th3), az = fz - leg.l3 * Math.sin(th3); // punho/jarrete
    let dy = ay - py, dz = az - pz, d = Math.hypot(dy, dz); const dmax = leg.l1 + leg.l2 - 0.002, dmin = Math.abs(leg.l1 - leg.l2) + 0.01;
    if (d > dmax) { dy *= dmax / d; dz *= dmax / d; d = dmax; } else if (d < dmin) { dy *= dmin / d; dz *= dmin / d; d = dmin; }
    const ad = angOf(dz, dy), al = Math.acos(Math.max(-1, Math.min(1, (leg.l1 * leg.l1 + d * d - leg.l2 * leg.l2) / (2 * leg.l1 * d))));
    const t1 = ad + leg.bend * al, ky = py - leg.l1 * Math.cos(t1), kz = pz + leg.l1 * Math.sin(t1), t2 = angOf(pz + dz - kz, py + dy - ky);
    const a1 = leg.r1 - acc - t1, a2 = leg.r2 - acc - a1 - t2, a3 = leg.r3 - acc - a1 - a2 - th3;
    R(leg.a).x = a1; R(leg.b).x = a2; R(leg.c).x = a3;
  }

  // estado
  const W = { walk: 0, trot: 0, gallop: 0 }, wp = new THREE.Vector3(), prev = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  let slope = 0, lift0 = 0, has = false, spd = 0, ph = 0, mv = 0, yaw0 = 0, yawRate = 0, lt = 0, at0 = -9, hitT = -9, hitDir = 1, sniff = 0, look = 0, blinkAt = 2, earTw = [0, 0], tailLag = 0, pant = 0;
  const eyeMat = IRIS; R('jaw').x = JAW0; let mouthShown = false; for (const o of inMouth) o.visible = false; // S-396: com a fenda da boca, dentes e língua começam escondidos (antes só sumiam no 1º quadro animado)
  const api = {
    root, eyeMat,
    attack() { at0 = lt; },
    hit(dir = 1) { hitT = lt; hitDir = dir; },
    animate(t, moving, dt = 1 / 60) {
      lt = t; dt = Math.min(0.1, Math.max(0, dt));
      // velocidade e giro medidos pelo deslocamento de verdade (o passo casa com o chão)
      root.getWorldPosition(wp); root.getWorldQuaternion(_q); _e.setFromQuaternion(_q, 'YXZ'); const yaw = _e.y, sc = root.getWorldScale(_v).x || 1;
      if (has && dt > 0) { const d = Math.hypot(wp.x - prev.x, wp.z - prev.z) / sc; const v = d > 1.5 * sc ? 0 : d / dt; spd += (v - spd) * Math.min(1, dt * 7); let dy = yaw - yaw0; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; yawRate += (dy / dt - yawRate) * Math.min(1, dt * 5); }
      prev.copy(wp); yaw0 = yaw; has = true;
      const inWorld = (() => { const A = globalThis.__world || globalThis.__api; if (!A || !A.scene) return false; let top = root; while (top.parent) top = top.parent; return top === A.scene; })();
      let v = spd; if (moving && v < 0.15 && !inWorld) v = 1.0; if (!moving && v < 0.25) v = 0; // prévia (Bestiário) anda sem sair do lugar; no mundo, bloqueado = parado (S-310)
      // S-310: troca de marcha com folga (histerese) — perto do limite ela não fica alternando passo/trote/galope
      const cur = W.gallop > W.trot && W.gallop > W.walk ? 'gallop' : W.trot > W.walk ? 'trot' : 'walk';
      const tg = cur === 'walk' ? (v > 1.6 ? (v > 4.1 ? 'gallop' : 'trot') : 'walk') : cur === 'trot' ? (v < 1.1 ? 'walk' : v > 4.1 ? 'gallop' : 'trot') : (v < 3.5 ? (v < 1.1 ? 'walk' : 'trot') : 'gallop');
      for (const k in W) W[k] += ((k === tg ? 1 : 0) - W[k]) * Math.min(1, dt * 4);
      mv += ((v > 0.05 ? 1 : 0) - mv) * Math.min(1, dt * 6);
      const g = (f) => W.walk * GAITS.walk[f] + W.trot * GAITS.trot[f] + W.gallop * GAITS.gallop[f], sum = W.walk + W.trot + W.gallop || 1;
      const cyc = g('cyc') / sum, duty = g('duty') / sum, liftH = g('lift') / sum, gal = W.gallop / sum, trot = W.trot / sum;
      ph = (ph + v * dt / cyc) % 1; const P2 = ph * Math.PI * 2;
      // ataque (mordida com bote) e susto ao apanhar
      const bk = (t - at0) / 0.6, bite = bk > 0 && bk < 1;
      const crouch = bite ? (bk < 0.3 ? ss(0, 0.3, bk) : 1 - ss(0.3, 0.45, bk)) : 0, lunge = bite ? (bk < 0.3 ? 0 : bk < 0.45 ? ss(0.3, 0.45, bk) : 1 - ss(0.55, 1, bk)) : 0;
      const open = bite ? (bk < 0.25 ? ss(0.05, 0.25, bk) * 0.3 : bk < 0.42 ? 0.3 + ss(0.25, 0.4, bk) * 0.5 : 0.8 * (1 - ss(0.42, 0.5, bk))) : 0;
      const hk = (t - hitT) / 0.4, flinch = hk > 0 && hk < 1 ? Math.sin(hk * Math.PI) * (1 - hk) : 0;
      // chão irregular: cada pata procura a altura do terreno e o corpo inclina na encosta (só no mundo, não nas prévias)
      let gfn = null; { const A = globalThis.__world || globalThis.__api; if (A && A.groundAt && A.scene) { let top = root; while (top.parent) top = top.parent; if (top === A.scene) gfn = A.groundAt; } }
      const gdy = (x, z) => { if (!gfn) return 0; root.localToWorld(_g.set(x, 0, z)); return Math.max(-0.3, Math.min(0.3, (gfn(_g.x, _g.z) - wp.y) / sc)); };
      const dyF = (gdy(-0.09, FOOT.f[1]) + gdy(0.09, FOOT.f[1])) / 2, dyH = (gdy(-0.1, FOOT.h[1]) + gdy(0.1, FOOT.h[1])) / 2;
      slope += (Math.max(-0.35, Math.min(0.35, -(dyF - dyH) / 0.75)) - slope) * Math.min(1, dt * 8); lift0 += ((dyF + dyH) / 2 * 0.6 - lift0) * Math.min(1, dt * 8);
      // corpo: sobe e desce com as patas, balança no passo, arqueia no galope; agacha e dá o bote no ataque
      const bob = (W.walk * Math.cos(P2 * 2) * 0.008 + W.trot * Math.cos(P2 * 2) * 0.016 + W.gallop * (Math.sin(P2) * 0.045)) * mv / sum;
      body.position.y = lift0 + bob - crouch * 0.07 - lunge * 0.02 + Math.sin(t * 1.6) * 0.003 * (1 - mv);
      body.position.z = -crouch * 0.06 + lunge * 0.3 - flinch * 0.08;
      body.rotation.x = slope + W.gallop * Math.cos(P2) * 0.07 * mv / sum + crouch * 0.05 - lunge * 0.04;
      body.rotation.z = Math.max(-0.12, Math.min(0.12, -yawRate * 0.05 * mv)) + flinch * hitDir * 0.12;
      R('hips').x = gal * Math.sin(P2) * 0.12 * mv; R('chest').x = -gal * Math.sin(P2) * 0.14 * mv;
      R('hips').y = W.walk * Math.sin(P2) * 0.06 * mv / sum; R('hips').z = W.walk * Math.sin(P2) * 0.04 * mv / sum + trot * Math.sin(P2 * 2) * 0.02 * mv;
      R('chest').y = -R('hips').y * 0.8 + yawRate * 0.05; R('chest').z = -R('hips').z * 0.6;
      bones.chest.scale.setScalar(1 + Math.sin(t * (2.2 + pant * 6)) * (0.008 + pant * 0.008)); // respiração
      // pernas: apoio (pata parada no chão, indo para trás) e balanço (pata sobe dobrando e vai para a frente)
      for (const leg of legs) {
        const off = (W.walk * GAITS.walk.off[leg.i] + W.trot * GAITS.trot.off[leg.i] + W.gallop * GAITS.gallop.off[leg.i]) / sum, u = (ph + off) % 1, S = cyc * duty * mv;
        let fz = leg.fz, fy = FOOT[leg.k][0], th3 = leg.r3, lift = 0;
        if (u < duty) { const s = u / duty; fz += S * (0.5 - s); th3 -= (leg.k === 'f' ? 0.35 : 0.3) * ss(0.6, 1, s) * mv; } // fim do apoio: o calcanhar levanta
        else { const s = (u - duty) / (1 - duty), e = 0.5 - 0.5 * Math.cos(Math.PI * s); fz += S * (e - 0.5); lift = Math.sin(Math.PI * s); fy += lift * liftH * mv * (0.6 + 0.4 * (leg.k === 'f' ? 1 : 0.8)); th3 -= (leg.k === 'f' ? 1.35 : 0.55) * Math.sin(Math.PI * Math.min(1, s * 1.25)) * mv; }
        fy += gdy(leg.s * 0.095, fz);
        if (bite) { if (leg.k === 'f') fz += lunge * 0.12 - crouch * 0.03; else fz += lunge * 0.04; } // no bote as da frente avançam um pouco, as de trás empurram
        solveLeg(leg, fy, fz, th3);
      }
      // cabeça estabilizada: compensa a inclinação do corpo e da coluna; baixa no trote/galope; fareja parado
      const sniffWant = mv < 0.1 && !bite && Math.sin(t * 0.37 + 1.3) > 0.6 ? 1 : 0; sniff += (sniffWant - sniff) * Math.min(1, dt * 2);
      const lookWant = mv < 0.1 && !bite ? Math.sin(t * 0.31) * 0.5 + Math.sin(t * 0.83) * 0.15 : yawRate * 0.18; look += (lookWant - look) * Math.min(1, dt * 3);
      const comp = body.rotation.x + R('hips').x + R('chest').x;
      R('neck').x = -comp + (trot * 0.22 + gal * 0.12) * mv + W.walk * Math.sin(P2 * 2 + 0.6) * 0.035 * mv / sum + sniff * 0.75 + crouch * 0.25 + lunge * 0.15 - flinch * 0.3;
      R('neck').y = look * 0.55 * (1 - sniff * 0.5); R('head').y = look * 0.4 + sniff * Math.sin(t * 2.6) * 0.15;
      R('head').x = -sniff * 0.2 - lunge * 0.25 + crouch * 0.1 + Math.sin(t * 9) * 0.02 * sniff;
      R('head').z = bite && bk > 0.42 && bk < 0.62 ? Math.sin((bk - 0.42) * 70) * 0.18 : 0; // sacode ao morder
      pant += (((trot + gal) * mv > 0.5 ? 1 : 0) - pant) * Math.min(1, dt * 0.8);
      R('jaw').x = JAW0 + open * 1.1 + pant * (0.26 + Math.sin(t * 9) * 0.04) + (1 - mv) * Math.max(0, Math.sin(t * 0.7)) * 0.03;
      { const show = R('jaw').x > JAW0 + 0.09; if (show !== mouthShown) { mouthShown = show; for (const o of inMouth) o.visible = show; } }
      tongue.scale.z = 0.06 + pant * 0.025;
      // orelhas: em pé e atentas; deitam no galope e no bote; mexem sozinhas
      for (let k = 0; k < 2; k++) { const s = k ? 1 : -1; earTw[k] = Math.max(0, earTw[k] - dt * 4); if (Math.random() < dt * 0.25) earTw[k] = 1; R('ear' + s).x = -(gal * 0.7 * mv + Math.max(crouch, lunge) * 0.9 + flinch * 0.8) + earTw[k] * 0.25; R('ear' + s).z = s * (-earTw[k] * 0.3 - (gal * mv + crouch) * 0.25); R('ear' + s).y = s * look * 0.25; }
      // cauda: caída e balançando com o passo; sobe na corrida e no bote; atrasa nas curvas
      tailLag += (-yawRate * 0.25 - tailLag) * Math.min(1, dt * 3);
      ['t1', 't2', 't3', 't4'].forEach((n, k) => {
        R(n).x = (k === 0 ? (gal * 0.75 + trot * 0.3) * mv + crouch * 0.4 + lunge * 0.5 - flinch * 0.5 : 0) + (k ? -(gal * 0.12 * mv) : 0) + (1 - mv) * (k === 0 ? -0.05 : 0.02);
        R(n).y = Math.sin(t * (1.1 + mv * 1.5) + P2 * W.walk - k * 0.7) * (0.05 + k * 0.035) * (0.5 + 0.5 * mv) + tailLag * (0.3 + k * 0.25);
      });
      // piscar
      let bl = 0; if (t > blinkAt) { const q = (t - blinkAt) / 0.13; bl = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) blinkAt = t + 2.5 + Math.random() * 3.5; }
      for (const l of lids) { l.scale.y = Math.max(bl, Math.max(crouch, lunge) * 0.25, 0.01); l.visible = l.scale.y > 0.04; } // aberta = escondida (antes a borda cortava o olho)
      IRIS.emissiveIntensity = 0.15 + Math.max(crouch, lunge) * 0.6;
    },
  };
  return api;
}
const _v = new THREE.Vector3(), _g = new THREE.Vector3();
