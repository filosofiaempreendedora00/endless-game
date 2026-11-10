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
  E([0, 0.92, 0.615], [0.09, 0.082, 0.1], 'head', 0.05);
  E([0, 0.945, 0.675], [0.054, 0.044, 0.055], 'head', 0.04);
  C([0, 0.903, 0.69], [0, 0.887, 0.85], 0.057, 0.039, 'head', 0.045); // focinho forte e comprido
  E([0, 0.893, 0.76], [0.052, 0.047, 0.075], 'head', 0.05);
  E([0, 0.886, 0.862], [0.026, 0.02, 0.016], 'head', 0.02);
  C([0, 0.857, 0.655], [0, 0.856, 0.84], 0.042, 0.026, 'jaw', 0.014);
  for (const s of [-1, 1]) {
    E([s * 0.064, 0.88, 0.6], [0.058, 0.068, 0.068], 'head', 0.05); // bochecha de pelo
    C([s * 0.044, 0.985, 0.617], [s * 0.06, 1.075, 0.602], 0.035, 0.006, 'ear' + s, 0.022); // orelha em ponta
    // pata da frente: escápula, braço até o cotovelo (para trás), antebraço, punho, metacarpo quase vertical, pata e dedos
    E([s * 0.1, 0.62, 0.26], [0.058, 0.13, 0.1], 'up' + s, 0.07);
    C([s * 0.1, 0.58, 0.27], [s * 0.095, 0.42, 0.21], 0.064, 0.045, 'up' + s, 0.05);
    E([s * 0.095, 0.408, 0.19], [0.03, 0.035, 0.034], 'up' + s, 0.03);
    C([s * 0.095, 0.415, 0.22], [s * 0.09, 0.14, 0.262], 0.041, 0.025, 'fo' + s, 0.04);
    E([s * 0.093, 0.33, 0.232], [0.039, 0.08, 0.041], 'fo' + s, 0.05);
    E([s * 0.09, 0.13, 0.262], [0.027, 0.031, 0.029], 'pa' + s, 0.024);
    C([s * 0.09, 0.13, 0.262], [s * 0.09, 0.044, 0.292], 0.023, 0.027, 'pa' + s, 0.024);
    E([s * 0.09, 0.028, 0.307], [0.037, 0.026, 0.049], 'pa' + s, 0.03);
    for (let q = 0; q < 4; q++) E([s * 0.09 + (q - 1.5) * 0.019, 0.02, 0.343 + (Math.abs(q - 1.5) < 1 ? 0.008 : 0)], [0.014, 0.016, 0.018], 'pa' + s, 0.012);
    // pata de trás: coxa larga, joelho para a frente, perna para trás até o jarrete alto, metatarso, pata e dedos
    E([s * 0.1, 0.6, -0.42], [0.074, 0.15, 0.13], 'th' + s, 0.08);
    C([s * 0.105, 0.62, -0.42], [s * 0.105, 0.44, -0.3], 0.094, 0.05, 'th' + s, 0.06);
    C([s * 0.1, 0.44, -0.31], [s * 0.1, 0.2, -0.505], 0.049, 0.025, 'sh' + s, 0.04);
    E([s * 0.1, 0.37, -0.38], [0.041, 0.08, 0.05], 'sh' + s, 0.05);
    E([s * 0.1, 0.2, -0.522], [0.021, 0.03, 0.028], 'mt' + s, 0.02);
    C([s * 0.1, 0.2, -0.505], [s * 0.1, 0.044, -0.458], 0.025, 0.025, 'mt' + s, 0.024);
    E([s * 0.1, 0.028, -0.445], [0.035, 0.026, 0.047], 'mt' + s, 0.03);
    for (let q = 0; q < 4; q++) E([s * 0.1 + (q - 1.5) * 0.018, 0.02, -0.41 + (Math.abs(q - 1.5) < 1 ? 0.008 : 0)], [0.013, 0.015, 0.017], 'mt' + s, 0.012);
  }
  // cauda grossa, caída e afinando na ponta
  C([0, 0.67, -0.54], [0, 0.575, -0.655], 0.042, 0.055, 't1', 0.05);
  C([0, 0.575, -0.655], [0, 0.455, -0.705], 0.058, 0.066, 't2', 0.04);
  C([0, 0.455, -0.705], [0, 0.335, -0.72], 0.066, 0.054, 't3', 0.04);
  C([0, 0.335, -0.72], [0, 0.245, -0.71], 0.05, 0.016, 't4', 0.03);
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

// ---------- pelagem pintada (espaço do osso em repouso: o desenho fica preso ao corpo) ----------
const COAT_GLSL = `
uniform vec3 uBase, uLight, uDark, uTan, uEye;
float wHead(vec3 p){ return smoothstep(0.55, 0.6, p.z) * smoothstep(0.78, 0.82, p.y); }
vec3 wCoat(vec3 p, vec3 n){
  float hd = wHead(p);
  float la = smoothstep(-0.15, -0.65, n.y) * (1.0 - step(0.78, p.y));                                                  // barriga e de baixo
  la = max(la, smoothstep(0.1, 0.04, abs(p.x)) * smoothstep(0.26, 0.34, p.z) * smoothstep(0.84, 0.74, p.y) * (1.0 - step(0.62, p.z))); // garganta e peito
  la = max(la, hd * smoothstep(0.9, 0.866, p.y));                                                                      // queixo e mandíbula
  la = max(la, hd * smoothstep(0.035, 0.06, abs(p.x)) * smoothstep(0.925, 0.885, p.y) * smoothstep(0.63, 0.69, p.z));   // máscara clara nas bochechas e laterais do focinho
  la = max(la, hd * (1.0 - smoothstep(0.009, 0.016, length(vec3(abs(p.x) - 0.036, p.y - 0.957, p.z - 0.712)))) * 0.85); // pintas claras sobre os olhos
  la = max(la, smoothstep(0.5, 0.3, p.y) * 0.7 * (1.0 - smoothstep(-0.58, -0.62, -p.z) * 0.0));                       // patas claras
  la = max(la, smoothstep(0.2, 0.9, -n.x * sign(p.x)) * smoothstep(0.62, 0.45, p.y) * 0.8);                             // lado de dentro das pernas
  vec3 col = mix(uBase, uTan, smoothstep(0.5, 0.75, vn(p * 4.0)) * 0.6 * smoothstep(0.8, 0.55, p.y)); // tons ocre nos flancos e nas pernas
  col = mix(col, uLight, clamp(la, 0.0, 1.0));
  float griz = vn(p * vec3(150.0, 150.0, 60.0));
  float saddle = smoothstep(-0.25, 0.45, n.y) * smoothstep(0.6, 0.72, p.y) * step(p.z, 0.42) * step(-0.57, p.z);     // sela escura mesclada no dorso
  saddle = max(saddle, smoothstep(0.4, 0.9, n.y) * smoothstep(0.72, 0.8, p.y) * step(p.z, 0.58) * 0.85);              // nuca
  col = mix(col, uDark * (0.45 + 1.9 * griz * griz), saddle * 0.95);                                                   // pelos de ponta preta mesclados
  col = mix(col, uDark, hd * smoothstep(0.022, 0.008, abs(p.x)) * smoothstep(0.893, 0.912, p.y) * smoothstep(0.69, 0.76, p.z) * 0.55); // listra escura no alto do focinho
  float ear = hd * smoothstep(0.985, 1.0, p.y);
  col = mix(col, uDark * 0.8, ear * (smoothstep(1.03, 1.07, p.y) + smoothstep(0.0, -0.6, n.z) * 0.6) * 0.9);         // orelhas: costas e pontas escuras
  float tl = smoothstep(-0.555, -0.6, p.z) * (1.0 - step(0.7, p.y));
  col = mix(col, uDark * 1.15, tl * smoothstep(-0.2, 0.7, n.y) * 0.6);                                                 // cauda: em cima escura
  col = mix(col, uDark * 0.55, tl * smoothstep(0.31, 0.27, p.y));                                                      // ponta preta
  col = mix(col, vec3(0.035), hd * smoothstep(0.86, 0.872, p.z) * step(0.866, p.y));                                   // nariz
  col = mix(col, vec3(0.05), hd * (1.0 - smoothstep(0.003, 0.009, abs(p.y - 0.869))) * smoothstep(0.69, 0.73, p.z) * smoothstep(0.02, 0.03, abs(p.x)) ); // lábios pretos
  col = mix(col, vec3(0.05), hd * (1.0 - smoothstep(0.012, 0.022, length(vec3(abs(p.x), p.y, p.z) - uEye))));        // contorno escuro dos olhos
  col = mix(col, col * vec3(1.06, 0.97, 0.85), smoothstep(0.36, 0.14, p.y));                                           // patas um pouco ocre
  col = mix(col, vec3(0.06, 0.05, 0.05), smoothstep(0.022, 0.008, p.y));                                               // almofadas e garras
  return col * (0.88 + 0.24 * griz);
}
float wFurLen(vec3 p){
  float L = 0.017;
  float hd = wHead(p);
  L = mix(L, 0.042, smoothstep(0.27, 0.36, p.z) * (1.0 - smoothstep(0.56, 0.62, p.z)) * smoothstep(0.58, 0.7, p.y));   // colar do pescoço
  L = mix(L, 0.036, hd * smoothstep(0.045, 0.07, abs(p.x)) * smoothstep(0.92, 0.88, p.y) * (1.0 - smoothstep(0.64, 0.7, p.z))); // bochechas
  L = mix(L, 0.048, smoothstep(-0.55, -0.6, p.z) * (1.0 - step(0.69, p.y)));                                             // cauda
  L = mix(L, 0.03, smoothstep(-0.44, -0.5, p.z) * smoothstep(0.38, 0.48, p.y) * (1.0 - smoothstep(0.66, 0.7, p.y)));     // "calças" das coxas
  L = mix(L, 0.025, smoothstep(0.62, 0.55, p.y) * smoothstep(-0.3, -0.7, 0.0));                                          // barriga
  L *= mix(0.25, 1.0, smoothstep(0.18, 0.34, p.y));                                                                       // patas: pelo curto
  L *= 1.0 - 0.85 * hd * smoothstep(0.69, 0.75, p.z);                                                                     // focinho: curto
  L *= 1.0 - 0.75 * hd * smoothstep(0.98, 1.0, p.y);                                                                      // orelhas
  L *= smoothstep(0.016, 0.034, length(vec3(abs(p.x), p.y, p.z) - uEye));                                                // nada de pelo sobre os olhos
  return L;
}`;
const MATS = {};
function coatUniforms(sh, C) { Object.assign(sh.uniforms, { uBase: { value: C.base }, uLight: { value: C.light }, uDark: { value: C.dark }, uTan: { value: C.tan }, uEye: { value: new THREE.Vector3(...EYE) } }); }
function wolfMats(color) {
  if (MATS[color]) return MATS[color];
  const base = new THREE.Color(color), C = { base, light: base.clone().lerp(new THREE.Color('#efe6d4'), 0.72), dark: base.clone().multiplyScalar(0.22), tan: base.clone().lerp(new THREE.Color('#b8925e'), 0.55) };
  const body = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  body.onBeforeCompile = sh => {
    coatUniforms(sh, C);
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON;\n' + SDF_NOISE_GLSL + COAT_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= wCoat(vOP, normalize(vON));');
  };
  body.customProgramCacheKey = () => 'wolf-body';
  // camadas de pelo: a mesma malha empurrada pela normal (antes da pele/ossos), fios penteados para trás e para baixo
  const shells = [];
  const NL = 7;
  for (let i = 1; i <= NL; i++) {
    const f = i / NL, m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    m.onBeforeCompile = sh => {
      coatUniforms(sh, C); sh.uniforms.uF = { value: f };
      sh.vertexShader = 'varying vec3 vOP; varying vec3 vON; uniform float uF;\n' + SDF_NOISE_GLSL + COAT_GLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vOP = position; vON = normal; float h = wFurLen(position) * uF;
        transformed += normal * h + vec3(0.0, -0.55, -0.85) * h * uF * 0.9;`);
      sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform float uF;\n' + SDF_NOISE_GLSL + COAT_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float L = wFurLen(vOP);
        float r = h3(floor(vOP * vec3(210.0, 210.0, 170.0))).x * 0.75 + vn(vOP * 45.0) * 0.25;
        if (L < 0.0025 || r < uF * 0.92 + 0.04) discard;
        diffuseColor.rgb *= wCoat(vOP, normalize(vON)) * mix(0.62, 1.08, uF);`);
    };
    m.customProgramCacheKey = () => 'wolf-shell-' + i;
    shells.push(m);
  }
  return (MATS[color] = { body, shells });
}

// ---------- marcha: fase de cada pata [frente esq., frente dir., trás esq., trás dir.] ----------
const GAITS = {
  walk: { off: [0.25, 0.75, 0.0, 0.5], duty: 0.62, cyc: 0.62, A: 0.3, lift: 0.07 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], duty: 0.44, cyc: 1.05, A: 0.4, lift: 0.1 },
  gallop: { off: [0.52, 0.42, 0.0, 0.12], duty: 0.3, cyc: 2.0, A: 0.6, lift: 0.14 },
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const angOf = (dz, dy) => Math.atan2(dz, -dy); // ângulo a partir de "para baixo" (positivo = para a frente)

export function realWolf(color = '#8a8f99') {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const geo = wolfGeo(), M = wolfMats(color);
  const rig = sdfRig(geo, WB, M.body), { at, bones } = rig, R = n => bones[n].rotation; body.add(rig.mesh);
  const shells = M.shells.map(m => { const s = new THREE.SkinnedMesh(geo, m); s.bind(rig.mesh.skeleton, rig.mesh.bindMatrix); s.frustumCulled = false; s.castShadow = false; s.receiveShadow = true; body.add(s); return s; });
  let shellsOn = true;
  rig.mesh.onBeforeRender = (r, sc, cam) => { const p = rig.mesh.getWorldPosition(_v); const on = cam.position.distanceTo(p) < 28; if (on !== shellsOn) { shellsOn = on; shells.forEach(s => s.visible = on); } }; // longe: só a malha pintada

  // olhos âmbar amendoados com contorno preto, pupila, brilho e pálpebra
  const IRIS = new THREE.MeshStandardMaterial({ color: '#d9a03a', emissive: '#8a5010', emissiveIntensity: 0.15, roughness: 0.08 }), DARK = new THREE.MeshStandardMaterial({ color: '#0d0a0a', roughness: 0.35 });
  const LID = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.6), roughness: 0.95 });
  const lids = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.rotation.set(-0.08, s * 0.62, s * -0.18); at('head', eg, s * EYE[0], EYE[1], EYE[2] - 0.006);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 20, 14), IRIS); ir.scale.set(1.3, 0.72, 0.4); eg.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 12, 10), DARK); pu.scale.set(1, 1, 0.4); pu.position.z = 0.0052; eg.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.004, 0.004, 0.0065); eg.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), LID); lid.scale.set(1.25, 0.05, 0.6); lid.position.y = 0.001; eg.add(lid); lids.push(lid);
  }
  // nariz úmido com narinas
  { const ng = new THREE.SphereGeometry(0.021, 22, 16); ng.scale(1.25, 0.82, 0.75); const P = ng.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k); if (z > 0.008 && y < 0.004 && Math.abs(Math.abs(x) - 0.009) < 0.006) P.setZ(k, z - 0.005); } ng.computeVertexNormals();
    at('head', new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ color: '#100c0c', roughness: 0.18 })), 0, NOSE[1] + 0.002, NOSE[2] - 0.01); }
  // boca: fundo escuro, língua, dentes (presas em cima e embaixo)
  const TOOTH = new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.35 });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#2a0d0d', roughness: 0.7 })); mouth.scale.set(0.026, 0.01, 0.075); at('head', mouth, 0, 0.866, 0.765);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#c0566a', roughness: 0.45 })); tongue.scale.set(0.02, 0.006, 0.06); at('jaw', tongue, 0, 0.864, 0.79);
  for (const s of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.0048, 0.026, 10), TOOTH); up.rotation.x = Math.PI; at('head', up, s * 0.022, 0.86, 0.835);
    const lo = new THREE.Mesh(new THREE.ConeGeometry(0.0042, 0.02, 10), TOOTH); at('jaw', lo, s * 0.018, 0.872, 0.812);
    for (let k = 0; k < 3; k++) { const pm = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.01, 6), TOOTH); pm.rotation.x = Math.PI; at('head', pm, s * 0.027, 0.864, 0.8 - k * 0.022); }
  }
  for (let k = 0; k < 4; k++) { const inc = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.008, 0.003), TOOTH); at('head', inc, (k - 1.5) * 0.0062, 0.864, 0.855 - Math.abs(k - 1.5) * 0.003); }
  // garras escuras nas pontas dos dedos
  const CLAW = new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: 0.4 });
  for (const s of [-1, 1]) for (let q = 0; q < 4; q++) {
    const cf = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.016, 6), CLAW); cf.rotation.x = Math.PI / 2 + 0.6; at('pa' + s, cf, s * 0.09 + (q - 1.5) * 0.019, 0.016, 0.36 + (Math.abs(q - 1.5) < 1 ? 0.008 : 0));
    const ch = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.015, 6), CLAW); ch.rotation.x = Math.PI / 2 + 0.6; at('mt' + s, ch, s * 0.1 + (q - 1.5) * 0.018, 0.016, -0.394 + (Math.abs(q - 1.5) < 1 ? 0.008 : 0));
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
  const eyeMat = IRIS;
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
      for (const l of lids) l.scale.y = Math.max(0.05, bl * 0.75, Math.max(crouch, lunge) * 0.3);
      IRIS.emissiveIntensity = 0.15 + Math.max(crouch, lunge) * 0.6;
    },
  };
  return api;
}
const _v = new THREE.Vector3(), _g = new THREE.Vector3();
