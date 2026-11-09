/* =========================================================================
   S-258: Vharnyr, o Inverno que Anda — dragão refeito (espírito dos grandes dragões de
   fantasia nórdica: corpo de réptil pesado, asas que SÃO os braços, andar de quatro apoiado
   nos pulsos das asas, coroa de chifres, escamas de verdade). Design próprio.
   - corpo inteiro numa malha lisa com pele presa a ossos (surface nets, como Kharzûl e os felinos)
   - escamas no material (células de Voronoi com relevo), placas transversais na barriga, geada no dorso
   - asas: úmero + antebraço na malha; 4 dedos longos com articulação e membrana de couro entre eles,
     recalculada a cada quadro (dobra rente ao corpo quando anda e abre inteira no rugido/sopro)
   ========================================================================= */
import * as THREE from 'three';
import { sdfSkinnedGeometry, sdfRig, SDF_NOISE_GLSL } from './mounts3d.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rngOf = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
// tubo que afina, com cor por vértice (base → ponta)
function hornTube(pts, r0, r1, c0, c1, seg = 18, rad = 10, ridge = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i <= seg; i++) { const u = i / seg, cp = curve.getPointAt(u), r = (r0 + (r1 - r0) * u) * (1 + (ridge ? Math.pow(Math.max(0, Math.sin(u * 60)), 4) * ridge * (1 - u) : 0)); c.copy(a).lerp(b, Math.pow(u, 1.4));
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; P.setXYZ(k, cp.x + N.getX(k) * r, cp.y + N.getY(k) * r, cp.z + N.getZ(k) * r); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

/* ---------------- esqueleto e corpo ---------------- */
const DB = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 0.5, -0.18]], chest: ['hips', [0, 0.56, 0.2]],
  n1: ['chest', [0, 0.62, 0.36]], n2: ['n1', [0, 0.72, 0.47]], n3: ['n2', [0, 0.83, 0.55]], head: ['n3', [0, 0.92, 0.6]], jaw: ['head', [0, 0.895, 0.635]],
  t1: ['hips', [0, 0.49, -0.4]], t2: ['t1', [0, 0.45, -0.62]], t3: ['t2', [0, 0.4, -0.84]], t4: ['t3', [0, 0.35, -1.04]], t5: ['t4', [0, 0.31, -1.22]],
};
for (const s of [-1, 1]) Object.assign(DB, {
  ['th' + s]: ['hips', [s * 0.13, 0.47, -0.2]], ['kn' + s]: ['th' + s, [s * 0.17, 0.29, -0.07]], ['an' + s]: ['kn' + s, [s * 0.165, 0.13, -0.26]], ['ft' + s]: ['an' + s, [s * 0.165, 0.035, -0.2]],
  ['up' + s]: ['chest', [s * 0.14, 0.6, 0.22]], ['el' + s]: ['up' + s, [s * 0.2, 0.36, 0.16]], ['wr' + s]: ['el' + s, [s * 0.205, 0.06, 0.3]],
});
let _geo = null;
function dragonGeo() {
  if (_geo) return _geo;
  const P = [], C = (a, b, r0, r1, bone, k = 0.03) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.04) => P.push({ c, r, bone, k });
  // tronco pesado: quadril, barriga funda, peito largo e quilha
  E([0, 0.5, -0.17], [0.15, 0.13, 0.2], 'hips', 0.07);
  E([0, 0.52, 0.03], [0.165, 0.145, 0.17], 'chest', 0.07);
  E([0, 0.575, 0.2], [0.15, 0.15, 0.14], 'chest', 0.06);
  E([0, 0.48, 0.15], [0.1, 0.075, 0.12], 'chest', 0.05);
  E([0, 0.62, -0.02], [0.09, 0.06, 0.2], 'chest', 0.05); // dorso arqueado
  for (const s of [-1, 1]) {
    E([s * 0.12, 0.61, 0.22], [0.075, 0.085, 0.09], 'up' + s, 0.045);   // ombro
    E([s * 0.125, 0.45, -0.19], [0.08, 0.115, 0.115], 'th' + s, 0.05);  // coxa
    // braço da asa: úmero grosso, antebraço, pulso que pisa no chão e o polegar com garra
    C([s * 0.14, 0.6, 0.22], [s * 0.2, 0.36, 0.16], 0.058, 0.04, 'up' + s, 0.03);
    E([s * 0.17, 0.5, 0.2], [0.04, 0.07, 0.045], 'up' + s, 0.03);
    C([s * 0.2, 0.36, 0.16], [s * 0.205, 0.075, 0.3], 0.038, 0.027, 'el' + s, 0.025);
    E([s * 0.205, 0.055, 0.31], [0.036, 0.03, 0.042], 'wr' + s, 0.02);
    C([s * 0.205, 0.05, 0.335], [s * 0.2, 0.022, 0.385], 0.015, 0.008, 'wr' + s, 0.01);
    // pata de trás: coxa forte para a frente, canela para trás, jarrete e pé de três dedos
    C([s * 0.13, 0.47, -0.2], [s * 0.17, 0.29, -0.07], 0.078, 0.052, 'th' + s, 0.04);
    E([s * 0.17, 0.29, -0.065], [0.045, 0.045, 0.045], 'kn' + s, 0.02);
    C([s * 0.17, 0.29, -0.07], [s * 0.165, 0.13, -0.26], 0.045, 0.028, 'kn' + s, 0.03);
    E([s * 0.168, 0.24, -0.15], [0.035, 0.06, 0.04], 'kn' + s, 0.025);
    C([s * 0.165, 0.13, -0.26], [s * 0.165, 0.04, -0.2], 0.03, 0.026, 'an' + s, 0.02);
    E([s * 0.165, 0.03, -0.16], [0.042, 0.022, 0.06], 'ft' + s, 0.02);
    for (const dx of [-0.032, 0, 0.032]) C([s * 0.165 + dx * 0.4, 0.03, -0.13], [s * 0.165 + dx, 0.016, -0.075], 0.015, 0.01, 'ft' + s, 0.01);
    // cabeça: arcadas sobre os olhos e maçãs
    E([s * 0.034, 0.968, 0.655], [0.026, 0.016, 0.045], 'head', 0.015);
    E([s * 0.045, 0.918, 0.64], [0.026, 0.03, 0.045], 'head', 0.02);
  }
  // pescoço longo e grosso na base
  C([0, 0.6, 0.3], [0, 0.72, 0.47], 0.09, 0.07, 'n1', 0.04);
  C([0, 0.72, 0.47], [0, 0.83, 0.55], 0.07, 0.058, 'n2', 0.03);
  C([0, 0.83, 0.55], [0, 0.92, 0.6], 0.058, 0.05, 'n3', 0.03);
  // crânio, focinho comprido e mandíbula
  E([0, 0.935, 0.62], [0.058, 0.05, 0.07], 'head', 0.03);
  C([0, 0.935, 0.66], [0, 0.908, 0.805], 0.044, 0.024, 'head', 0.025);
  E([0, 0.915, 0.8], [0.025, 0.017, 0.022], 'head', 0.012);
  C([0, 0.885, 0.635], [0, 0.878, 0.785], 0.034, 0.016, 'jaw', 0.02);
  // cauda longa afinando
  C([0, 0.5, -0.33], [0, 0.45, -0.62], 0.105, 0.077, 't1', 0.04);
  C([0, 0.45, -0.62], [0, 0.4, -0.84], 0.077, 0.056, 't2', 0.03);
  C([0, 0.4, -0.84], [0, 0.35, -1.04], 0.056, 0.039, 't3', 0.025);
  C([0, 0.35, -1.04], [0, 0.31, -1.22], 0.039, 0.025, 't4', 0.02);
  C([0, 0.31, -1.22], [0, 0.28, -1.42], 0.025, 0.007, 't5', 0.015);
  return (_geo = sdfSkinnedGeometry(P, DB, [-0.3, -0.02, -1.46], [0.6, 1.06, 2.32], 0.0115));
}

// escamas: células com relevo, dorso escuro, barriga em placas claras, geada por cima
function scaleMat(base) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.08 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uB = { value: new THREE.Color(base) };
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform vec3 uB;\n' + SDF_NOISE_GLSL + `
float dScale(vec3 p, vec3 n){ float belly = smoothstep(-0.25, -0.6, n.y);
  vec2 w = worley(p * vec3(92.0, 92.0, 70.0)); float sc = smoothstep(0.02, 0.32, w.y - w.x);
  float pl = smoothstep(0.0, 0.18, abs(fract(p.z * 34.0) - 0.5) * 2.0);           // placas da barriga
  return mix(sc, pl, belly); }
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 p = vOP; vec3 n = normalize(vON);
        float belly = smoothstep(-0.25, -0.6, n.y), back = smoothstep(0.3, 0.9, n.y);
        float h = dScale(p, n);
        vec3 col = uB * (0.85 + 0.3 * vn(p * 6.0));
        col = mix(col, vec3(0.16, 0.24, 0.33), back * 0.55);                              // dorso escuro
        col = mix(col, vec3(0.78, 0.84, 0.86), belly * 0.85);                             // barriga pálida
        col *= 0.55 + 0.5 * h;                                                            // fendas entre escamas
        float frost = smoothstep(0.55, 0.75, vn(p * 9.0)) * smoothstep(0.45, 0.95, n.y);
        col = mix(col, vec3(0.93, 0.97, 1.0), frost * 0.75);                               // geada assentada no dorso
        diffuseColor.rgb = col;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hh = dScale(vOP, normalize(vON)) * 0.0011; vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1); vec2 dh = vec2(dFdx(hh), dFdy(hh));
          vec3 gr = sign(det) * (dh.x * r1 + dh.y * r2); normal = normalize(abs(det) * normal - gr); }`);
  };
  m.customProgramCacheKey = () => 'dragon-scales';
  return m;
}
// membrana de couro com veias (textura no uv de cada painel: u = do pulso para fora, v = de um dedo ao outro)
let _veinTex = null;
function veinTex() {
  if (_veinTex) return _veinTex;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'), r = rngOf(17);
  const g = x.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#3e5872'); g.addColorStop(0.15, '#6f8fa8'); g.addColorStop(0.5, '#93b0c4'); g.addColorStop(0.85, '#6f8fa8'); g.addColorStop(1, '#3e5872'); x.fillStyle = g; x.fillRect(0, 0, W, W);
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '20,30,45' : '220,235,245'},${r() * 0.06})`; x.fillRect(r() * W, r() * W, 2 + r() * 6, 1 + r() * 3); }
  x.lineCap = 'round';
  const vein = (x0, y0, dir, len, w) => { let px = x0, py = y0, a = dir; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < len; s += 6) { a += (r() - 0.5) * 0.35; px += Math.cos(a) * 6; py += Math.sin(a) * 6; x.lineTo(px, py); if (w > 1.2 && r() < 0.08) { x.stroke(); vein(px, py, a + (r() < 0.5 ? 0.7 : -0.7), len * 0.4, w * 0.6); x.beginPath(); x.moveTo(px, py); } } x.lineWidth = w; x.stroke(); };
  x.strokeStyle = 'rgba(40,58,78,0.55)';
  for (let k = 0; k < 9; k++) { vein(r() * W * 0.9, 4, Math.PI / 2 + (r() - 0.5) * 0.6, W * 0.55, 2.2); vein(r() * W * 0.9, W - 4, -Math.PI / 2 + (r() - 0.5) * 0.6, W * 0.55, 2.2); }
  _veinTex = new THREE.CanvasTexture(c); _veinTex.colorSpace = THREE.SRGBColorSpace; return _veinTex;
}

/* ---------------- asa: dedos + membrana recalculada a cada quadro ---------------- */
const NU = 9, NV = 7;
function makeWing(s, body, boneMat, memMat) {
  const L1 = [0.22, 0.21, 0.19, 0.16], L2 = [0.38, 0.45, 0.41, 0.32]; // asas grandes (envergadura de verdade)
  const cyl = new THREE.CylinderGeometry(0.55, 1, 1, 10, 1); const sph = new THREE.SphereGeometry(1, 12, 8);
  const fingers = L1.map(() => { const a = new THREE.Mesh(cyl, boneMat), b = new THREE.Mesh(cyl, boneMat), kn = new THREE.Mesh(sph, boneMat), cl = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.035, 8), new THREE.MeshStandardMaterial({ color: '#1c242c', roughness: 0.35 })); body.add(a, b, kn, cl); return { a, b, kn, cl }; });
  // painéis: entre dedos vizinhos, o último até o flanco, e a pele da frente (ombro-cotovelo-pulso)
  const panels = 6, perP = (NU + 1) * (NV + 1), pos = new Float32Array(panels * perP * 3), uv = new Float32Array(panels * perP * 2), idx = [];
  for (let q = 0; q < panels; q++) for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const v = q * perP + i * (NV + 1) + j; uv[v * 2] = j / NV; uv[v * 2 + 1] = i / NU;
    if (i < NU && j < NV) { const a = v, b = v + 1, c = v + NV + 1, d = v + NV + 2; idx.push(a, c, b, b, c, d); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mem = new THREE.Mesh(geo, memMat); mem.frustumCulled = false; mem.castShadow = true; mem.receiveShadow = true; body.add(mem);
  const tmp = V3(0, 0, 0), up = V3(0, 1, 0), q0 = new THREE.Quaternion();
  const seg = (m, a, b, r) => { tmp.subVectors(b, a); const l = tmp.length(); m.position.copy(a).addScaledVector(tmp, 0.5); m.quaternion.setFromUnitVectors(up, tmp.multiplyScalar(1 / (l || 1))); m.scale.set(r, l, r); };
  const along = (ray, u) => { const n = ray.length - 1, f = Math.min(n - 1e-6, u * n), k = Math.floor(f); return V3(0, 0, 0).lerpVectors(ray[k], ray[k + 1], f - k); };
  const fill = (q, A, B, scal, sag, t) => {
    const nA = V3(0, 0, 0).subVectors(A[A.length - 1], A[0]), nB = V3(0, 0, 0).subVectors(B[B.length - 1], B[0]), nrm = V3(0, 0, 0).crossVectors(nA, nB).normalize();
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const v = j / NV, um = 1 - scal * Math.sin(Math.PI * v), u = i / NU * um, p = along(A, u).lerp(along(B, u), v);
      p.addScaledVector(nrm, -sag * Math.sin(Math.PI * v) * Math.sin(Math.PI * i / NU) * (1 + Math.sin(t * 7 + i * 0.6 + q) * 0.15));
      const k = (q * perP + i * (NV + 1) + j) * 3; pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    }
  };
  return {
    update(W, E, S, F, spread, t) { // pontos no espaço do corpo: pulso, cotovelo, ombro, flanco
      const arm = V3(0, 0, 0).subVectors(E, W).normalize(), rays = [];
      fingers.forEach((f, k) => {
        const fold1 = V3(s * 0.04, 0.0, -0.75).addScaledVector(arm, 1.0).add(V3(0, 0.1 - k * 0.07, 0)).normalize();
        const fold2 = V3(s * (0.1 + k * 0.03), 0.42 - k * 0.12, -1).normalize();
        const ang = [1.0, 0.45, -0.05, -0.5][k], open1 = V3(s * Math.cos(ang), Math.sin(ang), -0.12 - k * 0.12).normalize(), open2 = V3(s * Math.cos(ang - 0.25), Math.sin(ang - 0.25), -0.25 - k * 0.15).normalize();
        const d1 = fold1.lerp(open1, spread).normalize(), d2 = fold2.lerp(open2, spread).normalize();
        const K = W.clone().addScaledVector(d1, L1[k]), T = K.clone().addScaledVector(d2, L2[k]);
        seg(f.a, W, K, 0.012 - k * 0.0015); seg(f.b, K, T, 0.009 - k * 0.0012); f.kn.position.copy(K); f.kn.scale.setScalar(0.012 - k * 0.0012);
        f.cl.position.copy(T).addScaledVector(d2, 0.01); f.cl.quaternion.setFromUnitVectors(up, d2);
        rays.push([W, K, T]);
      });
      fill(0, rays[0], rays[1], 0.3, 0.025 * spread + 0.004, t); fill(1, rays[1], rays[2], 0.3, 0.025 * spread + 0.004, t); fill(2, rays[2], rays[3], 0.28, 0.022 * spread + 0.004, t);
      fill(3, rays[3], [W, E.clone().lerp(F, 0.25), F], 0.22, 0.02 * spread + 0.004, t);
      fill(4, [E, S], [E, W], 0.18, 0.006, t); fill(5, [E, S], [E, S], 0, 0, t); // pele da frente (o 6º painel fica vazio, colapsado)
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    },
  };
}

export function frostDragon(color = '#5f86a8') {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const SK = scaleMat(color), rig = sdfRig(dragonGeo(), DB, SK), { at, R, bones } = rig; body.add(rig.mesh);
  const HORN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 });
  const BONEM = new THREE.MeshStandardMaterial({ color: '#2e4256', roughness: 0.6 });
  const MEM = new THREE.MeshStandardMaterial({ map: veinTex(), side: THREE.DoubleSide, roughness: 0.75, color: '#c8dcea', emissive: '#1a2a3a', emissiveIntensity: 0.25 });
  const IVORY = new THREE.MeshStandardMaterial({ color: '#efe9d8', roughness: 0.35 });
  const put = (bone, g, mat, x, y, z) => { const m = new THREE.Mesh(g, mat); at(bone, m, x, y, z); return m; };
  // coroa de chifres: dois grandes para trás, dois menores por baixo, espinhos no alto e franja na bochecha
  for (const s of [-1, 1]) {
    put('head', hornTube([[0, 0, 0], [s * 0.02, 0.03, -0.07], [s * 0.035, 0.05, -0.15], [s * 0.04, 0.045, -0.24], [s * 0.035, 0.07, -0.29]], 0.019, 0.002, '#37414a', '#e6e2d4', 22, 10, 0.12), HORN, s * 0.032, 0.965, 0.6);
    put('head', hornTube([[0, 0, 0], [s * 0.035, -0.005, -0.05], [s * 0.06, 0.0, -0.11], [s * 0.07, 0.02, -0.16]], 0.011, 0.0015, '#37414a', '#e6e2d4', 16, 8), HORN, s * 0.048, 0.94, 0.585);
    for (let k = 0; k < 3; k++) put('head', hornTube([[0, 0, 0], [s * (0.02 + k * 0.004), -0.008, -0.03], [s * (0.035 + k * 0.006), -0.02, -0.055]], 0.006, 0.001, '#3a4650', '#d8dcd4', 8, 6), HORN, s * 0.055, 0.915 - k * 0.012, 0.635 - k * 0.012);
    for (let k = 0; k < 3; k++) put('jaw', hornTube([[0, 0, 0], [s * 0.012, -0.012, -0.015], [s * 0.02, -0.028, -0.03]], 0.005, 0.001, '#3a4650', '#d8dcd4', 8, 6), HORN, s * 0.02, 0.862, 0.7 - k * 0.025);
    // dentes: fileira de cima (no focinho) e de baixo (na mandíbula)
    for (let k = 0; k < 7; k++) { const z = 0.79 - k * 0.019, w = 0.016 + k * 0.0035, tl = 0.014 - Math.abs(k - 1) * 0.0012;
      const up = new THREE.Mesh(new THREE.ConeGeometry(0.0042, tl, 6), IVORY); up.rotation.x = Math.PI; at('head', up, s * w, 0.889, z);
      const lo = new THREE.Mesh(new THREE.ConeGeometry(0.0038, tl * 0.85, 6), IVORY); at('jaw', lo, s * (w - 0.002), 0.888, z - 0.008); }
    // olhos azuis de gelo, fundos sob a arcada
    const sock = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), new THREE.MeshBasicMaterial({ color: '#0c1622' })); sock.scale.set(1.5, 0.75, 0.7); at('head', sock, s * 0.047, 0.948, 0.672);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 8), new THREE.MeshBasicMaterial({ color: '#8ff2ff' })); eye.scale.set(1.5, 0.6, 0.6); eye.rotation.y = s * 0.5; at('head', eye, s * 0.05, 0.948, 0.674);
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 6), new THREE.MeshBasicMaterial({ color: '#0a0f14' })); nos.scale.set(1.6, 0.6, 1); at('head', nos, s * 0.012, 0.922, 0.808);
  }
  // espinhos do dorso: do alto da cabeça até a ponta da cauda
  const spine = [['n3', 0, 0.88, 0.555, 0.03], ['n2', 0, 0.79, 0.49, 0.036], ['n1', 0, 0.69, 0.4, 0.042], ['chest', 0, 0.72, 0.2, 0.05], ['chest', 0, 0.7, 0.05, 0.055], ['hips', 0, 0.66, -0.1, 0.05], ['hips', 0, 0.63, -0.25, 0.045],
    ['t1', 0, 0.58, -0.45, 0.04], ['t2', 0, 0.51, -0.66, 0.034], ['t3', 0, 0.45, -0.87, 0.028], ['t4', 0, 0.39, -1.07, 0.022], ['t5', 0, 0.335, -1.25, 0.016]];
  for (const [b, x, y, z, h] of spine) put(b, hornTube([[0, -0.01, 0.01], [0, h * 0.6, -h * 0.25], [0, h, -h * 0.75]], h * 0.32, 0.001, '#2a3a48', '#e6f0f6', 10, 8), HORN, x, y, z);
  // leque de ossos na ponta da cauda
  for (const s of [-1, 0, 1]) put('t5', hornTube([[0, 0, 0], [s * 0.03, 0.01, -0.05], [s * 0.06, 0.0, -0.1]], 0.01, 0.001, '#2a3a48', '#e6f0f6', 10, 6), HORN, 0, 0.28, -1.4);
  // garras dos pés
  const CLAW = new THREE.MeshStandardMaterial({ color: '#1a2026', roughness: 0.3 });
  for (const s of [-1, 1]) for (const dx of [-0.032, 0, 0.032]) { const c = new THREE.Mesh(hornTube([[0, 0, 0], [0, -0.004, 0.02], [0, -0.018, 0.032]], 0.008, 0.001, '#1a2026', '#9aa4ac', 8, 6), HORN); at('ft' + s, c, s * 0.165 + dx, 0.018, -0.07); }
  for (const s of [-1, 1]) { const c = new THREE.Mesh(hornTube([[0, 0, 0], [0, -0.01, 0.02], [0, -0.025, 0.028]], 0.009, 0.001, '#1a2026', '#9aa4ac', 8, 6), HORN); at('wr' + s, c, s * 0.2, 0.025, 0.38); }
  void CLAW;
  // asas
  const wings = [-1, 1].map(s => makeWing(s, body, BONEM, MEM));
  bones.head.scale.setScalar(1.3); // cabeça maior e mais pesada (com chifres e dentes)
  // sopro de gelo (sai da boca)
  const breath = new THREE.Group(); at('jaw', breath, 0, 0.9, 0.8);
  const puffs = Array.from({ length: 16 }, (_, k) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: k % 2 ? '#bfefff' : '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); breath.add(p); return p; });
  // flocos de neve em volta
  const snow = new THREE.Group(); body.add(snow); const r = rngOf(8), flakes = Array.from({ length: 22 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0.8 })); m.userData = { a: r() * 6.28, r: 0.25 + r() * 0.6, ph: r(), sp: 0.12 + r() * 0.15 }; snow.add(m); return m; });
  root.traverse(o => { if (o.isMesh && !(o.material && o.material.blending === THREE.AdditiveBlending)) { o.castShadow = true; o.receiveShadow = true; } });
  puffs.forEach(p => p.castShadow = false); flakes.forEach(f => f.castShadow = false);

  const inv = new THREE.Matrix4(), wp = (b, off) => { const v = V3(0, 0, 0); bones[b].getWorldPosition(v); v.applyMatrix4(inv); if (off) v.add(off); return v; };
  let lt = 0, at0 = -9, ph = 0, w = 0, spread = 0;
  return { root, attack() { at0 = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; ph += dt * (moving ? 3.2 : 0); w += ((moving ? 1 : 0) - w) * Math.min(1, dt * 4);
    const k = (t - at0) / 1.8, act = k >= 0 && k < 1;
    // rugido/sopro: empina e abre as asas (0–0,35), estica o pescoço e sopra (0,35–0,8), volta
    let rear = 0, pull = 0, thrust = 0, open = 0;
    if (act) { if (k < 0.35) { const e = Math.sin(k / 0.35 * Math.PI / 2); rear = e; pull = e; open = e; } else if (k < 0.8) { const e = (k - 0.35) / 0.45; rear = 1 - e * 0.6; pull = 1 - Math.min(1, e * 3); thrust = Math.min(1, e * 3); open = 1; } else { const e = (k - 0.8) / 0.2; rear = 0.4 * (1 - e); thrust = 1 - e; open = 1 - e; } }
    spread += (Math.max(open, 0.06 + Math.sin(t * 0.7) * 0.03) - spread) * Math.min(1, dt * 6);
    // marcha de quatro: diagonal (pata de trás esquerda com o pulso direito)
    const legs = s => ({ h: ph + (s > 0 ? Math.PI : 0), f: ph + (s > 0 ? 0 : Math.PI) + 0.6 });
    for (const s of [-1, 1]) {
      const { h, f } = legs(s), sh = Math.sin(h), lh = Math.max(0, Math.cos(h)) * w, sf = Math.sin(f), lf = Math.max(0, Math.cos(f)) * w;
      R('th' + s).x = -sh * 0.38 * w + rear * 0.35; R('kn' + s).x = lh * 0.55 - rear * 0.15; R('an' + s).x = -lh * 0.5 - rear * 0.2; R('ft' + s).x = lh * 0.35;
      R('up' + s).x = sf * 0.32 * w * (1 - spread) - 0.35 * spread; R('up' + s).z = s * (1.9 * spread); R('el' + s).x = -lf * 0.55 * (1 - spread); R('el' + s).z = s * -0.35 * spread; R('wr' + s).x = lf * 0.6 * (1 - spread);
    }
    R('hips').x = -rear * 0.32; R('hips').z = Math.sin(ph) * 0.025 * w; R('chest').x = rear * 0.05; R('chest').y = Math.sin(ph) * 0.05 * w;
    body.position.y = Math.abs(Math.cos(ph)) * 0.012 * w + rear * 0.02;
    bones.chest.scale.set(1 + Math.sin(t * 1.1) * 0.02, 1 + Math.sin(t * 1.1) * 0.012, 1); // respira
    // pescoço em S: recua e depois estica para soprar
    const look = Math.sin(t * 0.45) * 0.25 * (1 - w) * (act ? 0 : 1);
    R('n1').x = 0.42 - pull * 0.25 + thrust * 0.15 + Math.sin(t * 0.9) * 0.03; R('n2').x = 0.12 - pull * 0.2 - thrust * 0.05; R('n3').x = -0.32 - pull * 0.2 + thrust * 0.1; // pescoço em S, para a frente (não de girafa)
    R('n1').y = look * 0.4; R('n2').y = look * 0.4 + Math.sin(t * 0.6 + 1) * 0.04; R('n3').y = look * 0.4;
    R('head').x = -0.12 - pull * 0.3 + thrust * 0.2; R('jaw').x = 0.06 + Math.max(0, Math.sin(t * 0.8)) * 0.04 + pull * 0.5 + thrust * 0.4;
    // cauda pesada, ondulando com atraso
    ['t1', 't2', 't3', 't4', 't5'].forEach((b, i) => { R(b).y = Math.sin(t * 1.2 - i * 0.7) * (0.06 + i * 0.03) * (1 + w * 0.6); R(b).x = (i === 0 ? 0.05 : 0.02) - rear * (i === 0 ? 0.15 : 0); });
    // asas (pontos no espaço do corpo, depois do esqueleto posado)
    body.updateMatrixWorld(true); inv.copy(body.matrixWorld).invert();
    wings.forEach((wg, i) => { const s = i ? 1 : -1; wg.update(wp('wr' + s, V3(0, 0.03, 0.02)), wp('el' + s), wp('up' + s, V3(s * 0.02, 0.05, 0.02)), wp('th' + s, V3(0, 0.06, 0.06)), spread, t); });
    // sopro
    puffs.forEach((p, i) => { const q = (t - at0) * 1.2 - 0.75 - i * 0.04, on = q > 0 && q < 1.0; p.material.opacity = on ? Math.max(0, 0.5 * (1 - q)) : 0; const d = Math.max(0, q) * 0.9; p.position.set(Math.sin(i * 2.7) * d * 0.25, -d * 0.35 + Math.cos(i * 1.9) * d * 0.12, d); p.scale.setScalar(0.35 + d * 2.6); });
    flakes.forEach(m => { const u = m.userData, q = (t * u.sp + u.ph) % 1; m.position.set(Math.cos(u.a + t * 0.2) * u.r, 1.1 - q * 1.1, Math.sin(u.a + t * 0.2) * u.r - 0.2); });
  } };
}
