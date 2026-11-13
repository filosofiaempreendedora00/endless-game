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
   ========================================================================= */
import * as THREE from 'three';
import { sdfSkinnedGeometry, sdfRig, SDF_NOISE_GLSL } from './mounts3d.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

// ---------- campo de distância (cópia mínima, para achar a superfície ao encaixar olhos e nariz) ----------
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function sdCaps(px, py, pz, P) { const [ax, ay, az] = P.a, [bx, by, bz] = P.b, bax = bx - ax, bay = by - ay, baz = bz - az, pax = px - ax, pay = py - ay, paz = pz - az; const t = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz))); return len3(pax - bax * t, pay - bay * t, paz - baz * t) - (P.r0 + (P.r1 - P.r0) * t); }
function sdEll(px, py, pz, P) { const [cx, cy, cz] = P.c, [rx, ry, rz] = P.r, x = px - cx, y = py - cy, z = pz - cz; const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); }
const sdPrim = (x, y, z, P) => (P.a ? sdCaps(x, y, z, P) : sdEll(x, y, z, P));
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
const field = (parts, x, y, z) => { let d = 0.25; for (const P of parts) d = smin(d, sdPrim(x, y, z, P), P.k); return d; };
function surface(parts, o, dir) { const l = len3(...dir), d = dir.map(v => v / l); let t = 0; for (; t < 0.4; t += 0.0015) if (field(parts, o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) > 0) break; return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; }

// ---------- esqueleto (metros, frente = +z, chão = 0; lobo cinzento adulto: ~0,8 m na cernelha) ----------
const WB = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 0.68, -0.32]], chest: ['hips', [0, 0.7, 0.18]], neck: ['chest', [0, 0.76, 0.36]], head: ['neck', [0, 0.9, 0.6]], jaw: ['head', [0, 0.856, 0.67]],
  t1: ['hips', [0, 0.665, -0.56]], t2: ['t1', [0, 0.575, -0.655]], t3: ['t2', [0, 0.455, -0.705]], t4: ['t3', [0, 0.335, -0.72]],
};
for (const s of [-1, 1]) Object.assign(WB, {
  ['ear' + s]: ['head', [s * 0.046, 0.985, 0.615]],
  ['up' + s]: ['chest', [s * 0.1, 0.62, 0.27]], ['fo' + s]: ['up' + s, [s * 0.095, 0.415, 0.205]], ['pa' + s]: ['fo' + s, [s * 0.09, 0.13, 0.262]],
  ['th' + s]: ['hips', [s * 0.105, 0.635, -0.42]], ['sh' + s]: ['th' + s, [s * 0.105, 0.44, -0.3]], ['mt' + s]: ['sh' + s, [s * 0.1, 0.2, -0.505]],
});
const FOOT = { f: [0.03, 0.305], h: [0.03, -0.448] }; // ponto de apoio da pata (y, z) em repouso

function wolfParts() {
  const P = [], C = (a, b, r0, r1, bone, k = 0.06) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.06) => P.push({ c, r, bone, k });
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
  // cabeça: crânio, testa ("stop"), focinho longo, ponta do nariz, bochechas largas, mandíbula (osso próprio), orelhas
  E([0, 0.92, 0.612], [0.087, 0.079, 0.103], 'head', 0.05); // S-396: crânio em cunha
  E([0, 0.948, 0.678], [0.05, 0.046, 0.056], 'head', 0.035); // testa com "stop" marcado
  C([0, 0.905, 0.69], [0, 0.889, 0.852], 0.058, 0.037, 'head', 0.045); // S-396: focinho forte e alto (sem ponta fina de roedor) // focinho forte e comprido, afinando para o nariz (S-370)
  E([0, 0.894, 0.762], [0.052, 0.052, 0.076], 'head', 0.05);
  E([0, 0.886, 0.862], [0.026, 0.02, 0.016], 'head', 0.02);
  C([0, 0.857, 0.655], [0, 0.856, 0.84], 0.042, 0.026, 'jaw', 0.034); // S-370: emenda macia com o focinho (antes um vinco escuro que "desenhava" a boca)
  E([0, 0.853, 0.775], [0.02, 0.013, 0.04], 'jaw', 0.02); // S-370: queixo com um pouco de volume
  for (const s of [-1, 1]) {
    E([s * 0.06, 0.884, 0.598], [0.053, 0.062, 0.065], 'head', 0.05); // bochecha (S-396: menos inchada)
    E([s * 0.034, 0.951, 0.688], [0.03, 0.015, 0.024], 'head', 0.03); // S-396: arco da sobrancelha sobre o olho (olhar intenso de lobo, não de roedor)
    C([s * 0.044, 0.985, 0.617], [s * 0.062, 1.095, 0.6], 0.038, 0.006, 'ear' + s, 0.022); // orelha em ponta, alta e atenta (S-396)
    // pata da frente: escápula, braço até o cotovelo (para trás), antebraço, punho, metacarpo quase vertical, pata e dedos
    E([s * 0.1, 0.62, 0.26], [0.058, 0.13, 0.1], 'up' + s, 0.07);
    C([s * 0.1, 0.58, 0.27], [s * 0.095, 0.42, 0.21], 0.064, 0.045, 'up' + s, 0.05);
    E([s * 0.095, 0.408, 0.19], [0.03, 0.035, 0.034], 'up' + s, 0.03);
    C([s * 0.095, 0.415, 0.22], [s * 0.09, 0.14, 0.262], 0.041, 0.025, 'fo' + s, 0.04);
    E([s * 0.093, 0.33, 0.232], [0.039, 0.08, 0.041], 'fo' + s, 0.05);
    E([s * 0.09, 0.13, 0.262], [0.027, 0.031, 0.029], 'pa' + s, 0.024);
    C([s * 0.09, 0.13, 0.262], [s * 0.09, 0.044, 0.292], 0.023, 0.027, 'pa' + s, 0.024);
    E([s * 0.09, 0.03, 0.296], [0.035, 0.026, 0.037], 'pa' + s, 0.03);
    // pata de trás: coxa larga, joelho para a frente, perna para trás até o jarrete alto, metatarso, pata e dedos
    E([s * 0.1, 0.6, -0.42], [0.074, 0.15, 0.13], 'th' + s, 0.08);
    C([s * 0.105, 0.62, -0.42], [s * 0.105, 0.44, -0.3], 0.094, 0.05, 'th' + s, 0.06);
    C([s * 0.1, 0.44, -0.31], [s * 0.1, 0.2, -0.505], 0.049, 0.025, 'sh' + s, 0.04);
    E([s * 0.088, 0.53, -0.29], [0.052, 0.075, 0.075], 'th' + s, 0.09); // S-381: prega do flanco liga o joelho à barriga (o joelho não fica uma "bola" solta)
    E([s * 0.1, 0.37, -0.38], [0.041, 0.08, 0.05], 'sh' + s, 0.05);
    E([s * 0.1, 0.2, -0.522], [0.021, 0.03, 0.028], 'mt' + s, 0.02);
    C([s * 0.1, 0.2, -0.505], [s * 0.1, 0.044, -0.458], 0.025, 0.025, 'mt' + s, 0.024);
    E([s * 0.1, 0.03, -0.456], [0.033, 0.026, 0.036], 'mt' + s, 0.03);
  }
  // cauda grossa, caída e afinando na ponta
  // S-381: cauda de volume CHEIO (o "pincel" de pelo é a própria malha; as camadas só fazem a franja curta por cima)
  C([0, 0.67, -0.54], [0, 0.575, -0.655], 0.05, 0.07, 't1', 0.06);
  C([0, 0.575, -0.655], [0, 0.455, -0.705], 0.074, 0.088, 't2', 0.05);
  C([0, 0.455, -0.705], [0, 0.335, -0.72], 0.088, 0.074, 't3', 0.05);
  C([0, 0.335, -0.72], [0, 0.215, -0.703], 0.07, 0.016, 't4', 0.05); // afina até a ponta (sem "bola" no fim)
  return P;
}
let PARTS = null, GEO = null, EYE = null, NOSE = null;
function wolfGeo() {
  if (GEO) return GEO;
  PARTS = wolfParts();
  GEO = sdfSkinnedGeometry(PARTS, WB, [-0.26, -0.02, -0.86], [0.52, 1.14, 1.86], 0.0135);
  EYE = surface(PARTS, [0.0, 0.935, 0.62], [0.55, 0.06, 0.83]); // superfície onde vai o olho direito (+x)
  NOSE = surface(PARTS, [0, 0.885, 0.8], [0, 0, 1]);
  return GEO;
}

// ---------- peças finas (S-370): olho, nariz, dedos e garras — geometria montada uma vez e reaproveitada ----------
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
let EYE_GEO = null;
function wolfEyeGeo() { // esfera com o polo para a frente (+z); cores por vértice: pupila, íris com fibras, aro escuro
  if (EYE_GEO) return EYE_GEO;
  const g = new THREE.SphereGeometry(0.0125, 36, 22); g.rotateX(Math.PI / 2);
  const P = g.attributes.position, col = [];
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.acos(Math.max(-1, Math.min(1, z / 0.0125))) / (Math.PI / 2), a = Math.atan2(y, x);
    const fib = 0.86 + 0.14 * Math.sin(a * 23 + Math.sin(a * 7) * 2) * Math.sin(a * 11 + 1.3) + 0.08 * Math.sin(a * 37);
    let c = r < 0.34 ? [0.03, 0.025, 0.02] : r < 0.4 ? lerpC([0.03, 0.025, 0.02], [0.55, 0.3, 0.07], (r - 0.34) / 0.06)
      : r < 0.62 ? lerpC([0.62, 0.36, 0.08], [0.86, 0.6, 0.2], (r - 0.4) / 0.22) : r < 0.84 ? lerpC([0.86, 0.6, 0.2], [0.66, 0.42, 0.12], (r - 0.62) / 0.22)
      : r < 1 ? lerpC([0.66, 0.42, 0.12], [0.14, 0.08, 0.03], (r - 0.84) / 0.16) : [0.1, 0.06, 0.03];
    if (r >= 0.38 && r < 0.95) c = c.map(v => v * fib);
    col.push(...c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return (EYE_GEO = g);
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
    P.setXYZ(i, x * 0.0178, y * 0.0112, z * 0.0118);
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
    const ny = Math.cos(a), nz = Math.sin(a), c = lerpC([0.11, 0.09, 0.08], [0.36, 0.32, 0.28], t * t);
    for (let k = 0; k < RS; k++) { const u = k / RS * Math.PI * 2, cu = Math.cos(u) * r * 0.72, su = Math.sin(u) * r; pos.push(cu, cy + ny * su, cz + nz * su); col.push(...c); }
  }
  for (let j = 0; j < N; j++) for (let k = 0; k < RS; k++) { const a = j * RS + k, b = j * RS + (k + 1) % RS, c = a + RS, d = b + RS; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function toeGeo(rx, ry, rz) { // dedo: gota ovalada, achatada embaixo (almofada) e com a ponta um pouco mais fina
  const g = new THREE.SphereGeometry(1, 14, 10), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y < 0) y *= 0.62; const k = 1 - 0.18 * Math.max(0, z); P.setXYZ(i, x * rx * k, y * ry, z * rz); }
  g.computeVertexNormals(); return g;
}
const PAWS = {};
function pawGeo(k, s) { // em coordenadas do corpo em repouso (presas ao osso da pata pelo `at(.., 0, 0, 0)`)
  const key = k + s; if (PAWS[key]) return PAWS[key];
  const toes = [], claws = [], m = new THREE.Matrix4(), e = new THREE.Euler();
  const x0 = s * (k === 'f' ? 0.09 : 0.1), zf = k === 'f' ? 0.336 : -0.418, sz = k === 'f' ? 1 : 0.94;
  const add = (x, y, z, rx, ry, rz, yaw, cl, pitch = 0.28) => {
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e.set(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    toes.push(toeGeo(rx, ry, rz).applyMatrix4(m));
    m.compose(new THREE.Vector3(x + Math.sin(yaw) * rz * 0.7, y + ry * 0.25, z + Math.cos(yaw) * rz * 0.7), new THREE.Quaternion().setFromEuler(e.set(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    claws.push(clawGeo(cl, 0.0038 * sz, 1.05).applyMatrix4(m));
  };
  for (let q = 0; q < 4; q++) {
    const mid = q === 1 || q === 2, ox = (q - 1.5) * 0.0168 * sz, yaw = ox * 3.2; // S-396: dedos juntos (formam a pata), não contas separadas
    add(x0 + ox, 0.013, zf + (mid ? 0.004 : -0.009) * sz, (mid ? 0.0086 : 0.008) * sz, (mid ? 0.0062 : 0.0058) * sz, (mid ? 0.019 : 0.017) * sz, yaw, (mid ? 0.02 : 0.018) * sz); // S-396: mais compridos e baixos
  }
  if (k === 'f') add(s * 0.064, 0.07, 0.282, 0.0068, 0.0085, 0.009, -s * 0.5, 0.009, 0.9); // "polegar" (ergô) alto, do lado de dentro
  return (PAWS[key] = { toes: mergeGeometries(toes), claws: mergeGeometries(claws) });
}

// ---------- pelagem pintada (espaço do osso em repouso: o desenho fica preso ao corpo) ----------
const COAT_GLSL = `
uniform vec3 uBase, uLight, uDark, uTan, uEye, uNose;
float wHead(vec3 p){ return smoothstep(0.55, 0.6, p.z) * smoothstep(0.78, 0.82, p.y); }
// direção em que o pelo deita: para trás e para baixo no corpo, para baixo nas pernas e na cauda, para trás no rosto
vec3 wComb(vec3 p){
  vec3 c = vec3(0.0, -0.55, -0.85);
  c = mix(c, vec3(0.0, -1.0, -0.15), smoothstep(0.5, 0.36, p.y) * step(abs(p.z + 0.08), 0.6));
  c = mix(c, vec3(0.0, -0.85, -0.5), smoothstep(-0.56, -0.62, p.z) * (1.0 - step(0.7, p.y)));
  c = mix(c, vec3(0.0, 0.15, -1.0), wHead(p));
  return normalize(c);
}
vec3 wCoat(vec3 p, vec3 n){
  float hd = wHead(p);
  float soft = vn(p * 18.0);                                                                                           // S-370: bordas das manchas irregulares (nada de contorno "desenhado")
  float la = smoothstep(-0.15, -0.65, n.y) * (1.0 - step(0.78, p.y));                                                  // barriga e de baixo
  la = max(la, smoothstep(0.1, 0.04, abs(p.x)) * smoothstep(0.26, 0.34, p.z) * smoothstep(0.84, 0.74, p.y) * (1.0 - step(0.62, p.z))); // garganta e peito
  la = max(la, hd * smoothstep(0.9, 0.862, p.y));                                                                      // queixo e mandíbula
  la = max(la, hd * smoothstep(0.03, 0.065, abs(p.x) + (soft - 0.5) * 0.02) * smoothstep(0.93, 0.875, p.y) * smoothstep(0.62, 0.7, p.z) * 0.85); // máscara clara nas bochechas e lados do focinho, de borda macia
  la = max(la, hd * (1.0 - smoothstep(0.008, 0.02, length(vec3(abs(p.x) - 0.036, p.y - 0.957, p.z - 0.712)))) * 0.6); // pintas claras sobre os olhos
  la = max(la, smoothstep(0.5, 0.3, p.y) * 0.7);                                                                       // patas claras
  la = max(la, smoothstep(0.2, 0.9, -n.x * sign(p.x)) * smoothstep(0.62, 0.45, p.y) * 0.8);                             // lado de dentro das pernas
  vec3 col = mix(uBase, uTan, smoothstep(0.5, 0.75, vn(p * 4.0)) * 0.6 * smoothstep(0.8, 0.55, p.y)); // tons ocre nos flancos e nas pernas
  col = mix(col, uLight, clamp(la, 0.0, 1.0));
  vec3 gq = p * 120.0; vec3 cb = wComb(p); gq -= cb * dot(gq, cb) * 0.85;
  float griz = vn(gq) * 0.75 + vn(p * 23.0) * 0.25;                                                                  // S-381: pontas escuras em MECHAS (esticadas no sentido do pelo), não pontinhos
  float saddle = smoothstep(-0.25, 0.45, n.y) * smoothstep(0.6, 0.72, p.y) * smoothstep(0.5, 0.34, p.z + (soft - 0.5) * 0.06) * smoothstep(-0.63, -0.52, p.z); // sela escura mesclada no dorso (S-381: bordas macias, sem linha reta)
  saddle = max(saddle, smoothstep(0.4, 0.9, n.y) * smoothstep(0.72, 0.8, p.y) * smoothstep(0.64, 0.52, p.z) * 0.85);  // nuca
  col = mix(col, uDark * (0.6 + 1.2 * griz), saddle * 0.9);                                                            // pelos de ponta preta mesclados
  float bridge = hd * smoothstep(0.034 + (soft - 0.5) * 0.012, 0.004, abs(p.x)) * smoothstep(0.882, 0.912, p.y) * smoothstep(0.64, 0.74, p.z) * (1.0 - smoothstep(0.835, 0.865, p.z));
  col = mix(col, mix(uBase, uDark, 0.3) * (0.78 + 0.3 * griz), bridge * 0.75);
  float crown = hd * smoothstep(0.925, 0.962, p.y + (soft - 0.5) * 0.01) * (1.0 - smoothstep(0.7, 0.745, p.z)); // S-396: testa e alto da cabeça escuros, como no lobo cinzento
  col = mix(col, uDark * (0.9 + 1.0 * griz), crown * 0.6);                                         // dorso do focinho ocre-acinzentado, de borda macia (não uma listra pintada)
  float ear = hd * smoothstep(0.985, 1.0, p.y);
  col = mix(col, uDark * 0.8, ear * (smoothstep(1.03, 1.07, p.y) + smoothstep(0.0, -0.6, n.z) * 0.6) * 0.9);         // orelhas: costas e pontas escuras
  float tl = smoothstep(-0.555, -0.6, p.z) * (1.0 - smoothstep(0.66, 0.72, p.y));
  col = mix(col, uDark * (0.7 + 1.2 * griz), tl * smoothstep(-0.2, 0.7, n.y) * 0.6);                                   // cauda: em cima escura, mesclada
  col = mix(col, uDark * (0.7 + 0.6 * griz), tl * smoothstep(0.32, 0.24, p.y + (soft - 0.5) * 0.03) * 0.85);              // ponta escura, mesclada (S-381: não um "pompom" preto)
  // S-370: focinho de lobo — couro do nariz só na ponta (a peça 3D faz o resto), lábio escuro fino só perto do canto da boca
  col = mix(col, vec3(0.06, 0.05, 0.05), hd * (1.0 - smoothstep(0.016, 0.03, length((p - uNose) * vec3(0.95, 1.2, 0.7)))) * 0.9);
  {
    float lipY = 0.866 - 0.005 * smoothstep(0.80, 0.72, p.z);
    float lip = (1.0 - smoothstep(0.0012, 0.0032, abs(p.y - lipY))) * smoothstep(0.70, 0.715, p.z) * (1.0 - smoothstep(0.74, 0.785, p.z)) * smoothstep(0.016, 0.026, abs(p.x));
    float corner = 1.0 - smoothstep(0.003, 0.008, length(vec2(p.y - 0.861, p.z - 0.71)));
    col = mix(col, vec3(0.09, 0.075, 0.07), hd * clamp(max(lip * 0.62, corner * 0.72), 0.0, 1.0));
  }
  { // olhos amendoados: contorno escuro fino, puxado para o canto de dentro, e a "lágrima" escura descendo para o focinho
    vec3 q = vec3(abs(p.x), p.y, p.z) - uEye; vec3 N = normalize(vec3(0.55, 0.06, 0.83)), T = normalize(vec3(0.83, 0.0, -0.55));
    float tq = dot(q, T), e = length(vec3(tq / (1.45 + 0.35 * step(tq, 0.0)), q.y / 0.75, dot(q, N)));
    col = mix(col, vec3(0.05), hd * (1.0 - smoothstep(0.0125, 0.0185, e)));
    vec3 a0 = uEye - T * 0.016 - vec3(0.0, 0.004, 0.0), a1 = a0 + vec3(-0.004, -0.02, 0.024); vec3 pa = vec3(abs(p.x), p.y, p.z) - a0, ba = a1 - a0;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0), tear = 1.0 - smoothstep(0.002, 0.006 + 0.004 * h, length(pa - ba * h));
    col = mix(col, uDark * 0.6, hd * tear * (1.0 - h) * 0.55);
  }
  col = mix(col, col * vec3(1.06, 0.97, 0.85), smoothstep(0.36, 0.14, p.y));                                           // patas um pouco ocre
  col = mix(col, col * vec3(0.66, 0.6, 0.52), smoothstep(0.07, 0.012, p.y) * (0.7 + 0.3 * soft));                      // dedos: tom de terra, não "meia" branca
  col = mix(col, vec3(0.07, 0.06, 0.055), smoothstep(0.012, 0.004, p.y));                                              // almofadas (só por baixo)
  return col * (0.9 + 0.2 * griz);
}
// comprimento do pelo (em metros, no lobo comum). legs: 0 = corpo, 1 = perna/rosto (pelo curto e assentado mesmo no lobo gigante)
float wLegs(vec3 p){ return max(smoothstep(0.42, 0.3, p.y) * step(abs(p.z + 0.08), 0.6), wHead(p) * smoothstep(0.68, 0.74, p.z)); }
float wFurLen0(vec3 p){
  float L = 0.017;
  float hd = wHead(p);
  L = mix(L, 0.044, smoothstep(0.26, 0.36, p.z) * (1.0 - smoothstep(0.56, 0.63, p.z)) * smoothstep(0.56, 0.7, p.y));   // colar do pescoço (juba)
  L = mix(L, 0.024, hd * (1.0 - smoothstep(0.66, 0.72, p.z)) * smoothstep(0.86, 0.9, p.y)); // S-396: crânio e testa com pelo de verdade (o focinho fica curto)
  L = mix(L, 0.03, hd * smoothstep(0.045, 0.07, abs(p.x)) * smoothstep(0.92, 0.88, p.y) * (1.0 - smoothstep(0.64, 0.7, p.z))); // bochechas (S-396: mais curtas, rosto de lobo e não de bola)
  L = mix(L, 0.026, smoothstep(-0.55, -0.6, p.z) * (1.0 - step(0.69, p.y)));                                             // cauda (o volume já está na malha)
  L = mix(L, 0.028, smoothstep(-0.44, -0.5, p.z) * smoothstep(0.38, 0.48, p.y) * (1.0 - smoothstep(0.66, 0.7, p.y)));    // "calças" das coxas
  L = mix(L, 0.022, smoothstep(0.6, 0.5, p.y) * (1.0 - wLegs(p)));                                                      // barriga
  L = mix(L, 0.0065, smoothstep(0.42, 0.3, p.y) * step(abs(p.z + 0.08), 0.6));                                           // pernas: pelo curto e assentado
  L = mix(0.012, L, smoothstep(0.035, 0.11, p.y));                                                                     // dedos: pelo curtinho por cima (S-396: sem as "bolotas" lisas), aparecem as garras
  L *= 1.0 - 0.62 * hd * smoothstep(0.69, 0.75, p.z);                                                                     // focinho: curto e aveludado
  L *= 1.0 - 0.75 * hd * smoothstep(0.98, 1.0, p.y);                                                                      // orelhas
  L *= 1.0 - hd * smoothstep(0.685, 0.715, p.z) * (1.0 - smoothstep(0.007, 0.018, abs(p.y - 0.865)));                  // S-370: sem pelo na emenda da boca (as camadas se cruzavam ali e desenhavam uma linha escura)
  L *= smoothstep(0.018, 0.036, length(vec3(abs(p.x), p.y, p.z) - uEye));                                                // nada de pelo sobre os olhos
  L *= 1.0 - hd * (1.0 - smoothstep(0.026, 0.05, length(p - uNose)));                                              // nem sobre o nariz
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
  const LID = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.5), roughness: 0.95 });
  const lids = [], eg0 = wolfEyeGeo();
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.rotation.set(-0.08, s * 0.62, s * -0.18); at('head', eg, s * EYE[0], EYE[1], EYE[2] - 0.006);
    const ir = new THREE.Mesh(eg0, IRIS); ir.scale.set(1.55, 0.92, 0.48); eg.add(ir); // S-396: olhos maiores e intensos (antes sumiam no pelo)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0192, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), LID); lid.scale.set(1.25, 0.05, 0.6); lid.position.y = 0.001; eg.add(lid); lids.push(lid);
  }
  // S-370: nariz de lobo — couro escuro e úmido, mais largo em cima, narinas em vírgula abertas para os lados e o sulco do meio
  { const nm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.28 });
    const n = at('head', new THREE.Mesh(wolfNoseGeo(), nm), 0, NOSE[1] + 0.002, NOSE[2] - 0.0075); n.rotation.x = 0.1; }
  // boca: fundo escuro, língua, dentes (presas em cima e embaixo)
  const TOOTH = new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.35 }), inMouth = []; // S-370: boca, língua e dentes só aparecem com a boca aberta (fechada, a borda deles vazava pela emenda e "desenhava" a boca)
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#2a0d0d', roughness: 0.7 })); mouth.scale.set(0.026, 0.01, 0.075); at('head', mouth, 0, 0.866, 0.765); inMouth.push(mouth);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#c0566a', roughness: 0.45 })); tongue.scale.set(0.02, 0.006, 0.06); at('jaw', tongue, 0, 0.864, 0.79); inMouth.push(tongue);
  for (const s of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.0048, 0.026, 10), TOOTH); up.rotation.x = Math.PI; at('head', up, s * 0.022, 0.86, 0.835); inMouth.push(up);
    const lo = new THREE.Mesh(new THREE.ConeGeometry(0.0042, 0.02, 10), TOOTH); at('jaw', lo, s * 0.018, 0.872, 0.812); inMouth.push(lo);
    for (let k = 0; k < 3; k++) { const pm = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.01, 6), TOOTH); pm.rotation.x = Math.PI; at('head', pm, s * 0.027, 0.864, 0.8 - k * 0.022); inMouth.push(pm); }
  }
  for (let k = 0; k < 4; k++) { const inc = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.008, 0.003), TOOTH); at('head', inc, (k - 1.5) * 0.0062, 0.864, 0.855 - Math.abs(k - 1.5) * 0.003); inMouth.push(inc); }
  // S-370: dedos de verdade (4 por pata + o "polegar" alto na pata da frente), com almofadas por baixo e garras curvas
  const CLAW = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.38 });
  for (const s of [-1, 1]) for (const k of ['f', 'h']) {
    const bn = (k === 'f' ? 'pa' : 'mt') + s, P = pawGeo(k, s);
    at(bn, new THREE.Mesh(P.toes, M.body), 0, 0, 0); at(bn, new THREE.Mesh(P.claws, CLAW), 0, 0, 0);
  }
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
  const eyeMat = IRIS; let mouthShown = true;
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
      R('jaw').x = open * 1.05 + pant * (0.2 + Math.sin(t * 9) * 0.04) + (1 - mv) * Math.max(0, Math.sin(t * 0.7)) * 0.03;
      { const show = R('jaw').x > 0.035; if (show !== mouthShown) { mouthShown = show; for (const o of inMouth) o.visible = show; } }
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
      for (const l of lids) { l.scale.y = Math.max(bl * 0.75, Math.max(crouch, lunge) * 0.3); l.visible = l.scale.y > 0.06; } // aberta = escondida (antes a borda cortava o olho)
      IRIS.emissiveIntensity = 0.15 + Math.max(crouch, lunge) * 0.6;
    },
  };
  return api;
}
const _v = new THREE.Vector3(), _g = new THREE.Vector3();
