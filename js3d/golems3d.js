/* =========================================================================
   CONSTRUCTOS (P-001): Espantalho Errante, Golem de Musgo e Guardião Ancestral
   No padrão do lobo (wolf3d.js): corpo contínuo (campo de distância + pele em ossos)
   ou peças de pedra irregulares encaixadas — nunca "bolas" coladas —, materiais com
   textura pintada no shader e movimento guiado pela DISTÂNCIA andada (sem deslizar).
   Interface de critter: { root, attack(), hit(dir), animate(t, moving, dt), die(k, dt) }.
   ========================================================================= */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { sdfSkinnedGeometry, sdfRig, SDF_NOISE_GLSL } from './mounts3d.js';

/* ---------- utilidades ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rngOf = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function vnoise3(x, y, z) { // ruído de valor 3D suave (para deformar pedras)
  const h = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h(i, j, k), h(i + 1, j, k), u), L(h(i, j + 1, k), h(i + 1, j + 1, k), u), v), L(L(h(i, j, k + 1), h(i + 1, j, k + 1), u), L(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v), w);
}
// pedra irregular: esfera bem subdividida, achatada em faces largas (lascas) e com ruído — sombreamento liso
function rockGeo(seed, rx, ry, rz, rough = 0.18) {
  const g = new THREE.SphereGeometry(1, 40, 28), P = g.attributes.position, r = rngOf(seed), o = [r() * 50, r() * 50, r() * 50];
  const planes = Array.from({ length: 7 }, () => { const n = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); return { n, d: 0.72 + r() * 0.2 }; });
  for (let i = 0; i < P.count; i++) {
    const v = V(P.getX(i), P.getY(i), P.getZ(i));
    for (const pl of planes) { const s = v.dot(pl.n); if (s > pl.d) v.addScaledVector(pl.n, (pl.d - s) * 0.85); } // faces lascadas
    const n = vnoise3(v.x * 2.2 + o[0], v.y * 2.2 + o[1], v.z * 2.2 + o[2]) * 0.7 + vnoise3(v.x * 6 + o[1], v.y * 6 + o[2], v.z * 6 + o[0]) * 0.3;
    v.multiplyScalar(1 + (n - 0.5) * rough);
    P.setXYZ(i, v.x * rx, v.y * ry, v.z * rz);
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); const m = mergeVertices(g); m.computeVertexNormals(); return m;
}
// material com cor pintada no espaço do objeto (glsl define `col` a partir de p, n) + emissivo opcional (`emi`)
function paintMat(key, glsl, extra = {}, uniforms = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, ...extra });
  m.onBeforeCompile = sh => {
    for (const [k, v] of Object.entries(uniforms)) sh.uniforms[k] = v;
    const decl = Object.keys(uniforms).map(k => `uniform float ${k};`).join(' ');
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; ' + decl + '\n' + SDF_NOISE_GLSL + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>\n vec3 p = vOP; vec3 n = normalize(vON); vec3 col = vec3(1.0); vec3 emi = vec3(0.0);\n ${glsl}\n diffuseColor.rgb *= col;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += emi;');
  };
  m.customProgramCacheKey = () => 'cn-' + key;
  return m;
}
const fibers = (n, len, rad, spread, color, seed) => { // tufos de palha / capim: fios finos fundidos numa malha só
  const r = rngOf(seed), gs = [];
  for (let k = 0; k < n; k++) { const l = len * (0.6 + r() * 0.6), c = new THREE.CylinderGeometry(rad * 0.4, rad, l, 4, 1); c.translate(0, l / 2, 0); c.rotateX((r() - 0.5) * spread); c.rotateZ((r() - 0.5) * spread); c.rotateY(r() * 6.28); gs.push(c); }
  const g = mergeGeos(gs); return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
};
function mergeGeos(list) { // junta geometrias simples (posição + normal)
  let n = 0; for (const g of list) n += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3); let o = 0;
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); return g;
}
const shadowAll = root => root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
// andar guiado pela distância: mede o deslocamento do root no mundo
function strideMeter(root) { const last = new THREE.Vector3(), cur = new THREE.Vector3(); let init = false, spd = 0; return dt => { root.getWorldPosition(cur); if (!init) { last.copy(cur); init = true; } const d = Math.hypot(cur.x - last.x, cur.z - last.z); last.copy(cur); const s = scale(root); spd += ((dt > 0 ? d / dt : 0) - spd) * Math.min(1, dt * 8); return { d: d / s, spd: spd / s }; }; }
const scale = o => { const v = new THREE.Vector3(); o.getWorldScale(v); return v.x || 1; };

/* =========================================================================
   ESPANTALHO ERRANTE — roupa de pano remendada, cabeça de saco costurada com rosto
   pintado, palha saindo das mangas/barras/gola, chapéu mole e forcado. Anda aos
   trancos, como marionete; ataque: ergue o forcado e espeta.
   ========================================================================= */
const SC = { root: [null, [0, 0, 0]], hips: ['root', [0, 1.0, 0]], chest: ['hips', [0, 1.32, 0]], neck: ['chest', [0, 1.5, 0]], head: ['neck', [0, 1.6, 0.02]] };
for (const s of [-1, 1]) Object.assign(SC, { ['sh' + s]: ['chest', [s * 0.2, 1.45, 0]], ['el' + s]: ['sh' + s, [s * 0.44, 1.36, 0.03]], ['wr' + s]: ['el' + s, [s * 0.63, 1.24, 0.07]], ['th' + s]: ['hips', [s * 0.1, 0.97, 0]], ['kn' + s]: ['th' + s, [s * 0.11, 0.53, 0.02]], ['an' + s]: ['kn' + s, [s * 0.11, 0.1, 0]] });
let scGeo = null;
function scarecrowGeo() {
  if (scGeo) return scGeo;
  const P = [], C = (a, b, r0, r1, bone, k = 0.05) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.05) => P.push({ c, r, bone, k });
  E([0, 0.97, 0], [0.19, 0.13, 0.13], 'hips', 0.06);                         // quadril da calça
  C([0, 1.02, 0.01], [0, 1.4, 0], 0.16, 0.19, 'chest', 0.07);                 // camisa (tronco recheado de palha, meio torto)
  E([0, 1.16, 0.05], [0.17, 0.14, 0.12], 'hips', 0.06);                       // barriga murcha
  C([0, 1.44, 0], [0, 1.57, 0.01], 0.05, 0.045, 'neck', 0.03);               // pescoço amarrado
  E([0, 1.69, 0.02], [0.145, 0.17, 0.14], 'head', 0.04);                      // saco da cabeça
  E([0.03, 1.62, 0.07], [0.09, 0.07, 0.07], 'head', 0.05);                    // bochecha caída (saco irregular)
  E([0, 1.85, -0.01], [0.05, 0.055, 0.05], 'head', 0.03);                     // nó do saco
  for (const s of [-1, 1]) {
    E([s * 0.2, 1.43, 0], [0.09, 0.08, 0.09], 'sh' + s, 0.05);
    C([s * 0.2, 1.44, 0], [s * 0.44, 1.36, 0.03], 0.07, 0.062, 'sh' + s, 0.04); // manga larga
    C([s * 0.44, 1.36, 0.03], [s * 0.6, 1.26, 0.06], 0.062, 0.068, 'el' + s, 0.04); // manga até o punho (boca larga)
    C([s * 0.1, 0.95, 0], [s * 0.11, 0.53, 0.02], 0.085, 0.075, 'th' + s, 0.05); // calça larga
    C([s * 0.11, 0.53, 0.02], [s * 0.11, 0.14, 0.0], 0.075, 0.08, 'kn' + s, 0.04); // perna da calça (boca larga)
    E([s * 0.11, 0.05, 0.06], [0.06, 0.05, 0.12], 'an' + s, 0.03);              // botina velha
  }
  return (scGeo = sdfSkinnedGeometry(P, SC, [-0.75, -0.02, -0.3], [1.5, 1.95, 0.6], 0.016));
}
function scarecrowMat(color) {
  const c = new THREE.Color(color);
  return paintMat('scarecrow', `
    float burlap = smoothstep(1.53, 1.58, p.y) * (1.0 - step(1.86, p.y) * 0.0);
    // trama do pano (grade fina) e manchas
    float weave = 0.88 + 0.12 * (step(0.5, fract(p.x * 120.0 + vn(p * 40.0) * 0.4)) * 0.5 + step(0.5, fract(p.y * 120.0 + vn(p * 41.0) * 0.4)) * 0.5);
    vec3 sack = vec3(0.72, 0.6, 0.42) * (0.85 + 0.25 * vn(p * 8.0));
    // camisa xadrez desbotada com remendos
    float cx = step(0.5, fract(p.x * 9.0 + 0.25)), cy = step(0.5, fract(p.y * 9.0)), plaid = (cx + cy) * 0.5;
    vec3 shirt = mix(vec3(0.55, 0.22, 0.17), vec3(0.32, 0.18, 0.14), plaid) * (0.85 + 0.2 * vn(p * 6.0));
    vec3 pants = vec3(0.24, 0.27, 0.36) * (0.8 + 0.3 * vn(p * 5.0));
    float isPants = 1.0 - smoothstep(0.98, 1.04, p.y); float isBoot = 1.0 - smoothstep(0.1, 0.13, p.y);
    vec3 cloth = mix(shirt, pants, isPants);
    vec3 cell = floor(p * vec3(7.0, 6.0, 7.0)); float patchN = fract(sin(dot(cell, vec3(12.9, 78.2, 37.7))) * 43758.5);
    vec3 fp = fract(p * vec3(7.0, 6.0, 7.0)); float inPatch = step(0.82, patchN) * step(0.12, fp.x) * step(fp.x, 0.88) * step(0.12, fp.y) * step(fp.y, 0.88);
    vec3 patchC = mix(vec3(0.62, 0.52, 0.3), vec3(0.3, 0.38, 0.25), step(0.91, patchN));
    float stitch = inPatch * (1.0 - step(0.16, fp.x) * step(fp.x, 0.84) * step(0.16, fp.y) * step(fp.y, 0.84)) * step(0.5, fract((fp.x + fp.y) * 18.0));
    cloth = mix(cloth, patchC, inPatch * 0.9); cloth = mix(cloth, vec3(0.85, 0.8, 0.6), stitch);
    col = mix(cloth, sack, burlap) * weave;
    col = mix(col, vec3(0.16, 0.11, 0.07) * (0.8 + 0.3 * vn(p * 9.0)), isBoot);
    // rosto pintado no saco: olhos em losango e boca costurada
    float front = smoothstep(0.02, 0.09, p.z) * burlap;
    vec2 q = vec2(abs(p.x) - 0.055, p.y - 1.715); float eye = 1.0 - smoothstep(0.022, 0.028, abs(q.x) + abs(q.y) * 0.8);
    float my = p.y - (1.635 + 0.025 * cos(p.x * 22.0)); float mouth = (1.0 - smoothstep(0.004, 0.007, abs(my))) * step(abs(p.x), 0.075);
    float stitchX = (1.0 - smoothstep(0.003, 0.006, abs(fract(p.x * 32.0) - 0.5) * 0.031 - abs(my) * 0.25)) * step(abs(my), 0.018) * step(abs(p.x), 0.075);
    col = mix(col, vec3(0.06, 0.04, 0.03), clamp(max(eye, max(mouth, stitchX)) * front, 0.0, 1.0));
    col *= mix(vec3(1.0), vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * 1.25, 0.15);`, { roughness: 0.95 });
}
function pitchfork() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 0.85 }), iron = new THREE.MeshStandardMaterial({ color: '#3d3a36', roughness: 0.55, metalness: 0.7 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.55, 12), wood); shaft.position.y = 0.2; g.add(shaft);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.07, 12), iron); cap.position.y = 0.99; g.add(cap);
  const bar = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.09, 1.04, 0), V(0, 1.02, 0), V(0.09, 1.04, 0)]), 10, 0.009, 8), iron); g.add(bar);
  for (const x of [-0.09, 0, 0.09]) { const tine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, 1.03, 0), V(x * 1.05, 1.18, 0.01), V(x * 1.1, 1.33, 0.03)]), 12, 0.007, 8), iron); g.add(tine); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.04, 8), iron); tip.position.set(x * 1.1, 1.35, 0.03); g.add(tip); }
  return g;
}
export function scarecrow(color = '#c9a15a') {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const rig = sdfRig(scarecrowGeo(), SC, scarecrowMat(color)), { at, bones } = rig, R = n => bones[n].rotation; body.add(rig.mesh);
  const straw = '#d9b85a';
  at('neck', fibers(26, 0.1, 0.006, 1.8, straw, 3), 0, 1.5, 0);                         // palha na gola
  for (const s of [-1, 1]) {
    const cuff = fibers(16, 0.11, 0.005, 1.1, straw, 5 + s); cuff.rotation.z = s * Math.PI / 2 * 0.85; at('wr' + s, cuff, s * 0.62, 1.25, 0.06); // palha saindo da manga
    const leg = fibers(14, 0.09, 0.005, 1.0, straw, 9 + s); leg.rotation.x = Math.PI; at('an' + s, leg, s * 0.11, 0.16, 0);                      // palha na barra
  }
  at('hips', fibers(20, 0.07, 0.005, 2.4, straw, 13), 0, 1.04, 0.05);                  // palha na cintura
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.016, 8, 32), new THREE.MeshStandardMaterial({ color: '#8a7344', roughness: 1 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1.05, 0.75, 1); at('hips', belt, 0, 1.06, 0.01);
  // chapéu mole de feltro (aba torta, copa amassada)
  const felt = new THREE.MeshStandardMaterial({ color: '#4e3a26', roughness: 0.95, side: THREE.DoubleSide }), hat = new THREE.Group();
  const brim = new THREE.CylinderGeometry(0.27, 0.27, 0.012, 40, 1), BP = brim.attributes.position; for (let i = 0; i < BP.count; i++) { const x = BP.getX(i), z = BP.getZ(i), r = Math.hypot(x, z); BP.setY(i, BP.getY(i) - Math.pow(Math.max(0, r - 0.12), 2) * (1.6 + Math.sin(Math.atan2(z, x) * 2) * 1.2)); } brim.computeVertexNormals();
  hat.add(new THREE.Mesh(brim, felt)); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.17, 28, 3), felt); crown.position.y = 0.08; crown.rotation.z = 0.12; hat.add(crown);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.012, 6, 28), new THREE.MeshStandardMaterial({ color: '#7a2a20', roughness: 0.9 })); band.rotation.x = Math.PI / 2; band.position.y = 0.02; hat.add(band);
  hat.rotation.set(-0.12, 0.3, 0.14); at('head', hat, 0, 1.83, 0.0);
  const fork = pitchfork(); fork.rotation.set(0.15, 0, -0.08); at('wr-1', fork, -0.63, 1.24, 0.07);
  shadowAll(root);
  const meter = strideMeter(root); let ph = 0, at0 = -9, lt = 0, hitT = -9, hitD = 1, lean = 0;
  const jerk = x => Math.sign(x) * Math.pow(Math.abs(x), 0.45); // movimento aos trancos (marionete)
  return { root, attack() { at0 = lt; }, hit(d) { hitT = lt; hitD = d || 1; },
    animate(t, moving, dt = 1 / 60) {
      lt = t; const m = meter(dt), w = Math.min(1, m.spd / 0.9); ph += m.d / 0.62 * Math.PI; // fase pela distância (passada de 0,62 m)
      const s = Math.sin(ph), c = Math.cos(ph), stepJ = jerk(s) * w;
      for (const sd of [-1, 1]) { const ss = sd === -1 ? stepJ : -stepJ, lift = Math.max(0, sd === -1 ? -c : c) * w; R('th' + sd).x = -ss * 0.42; R('kn' + sd).x = lift * 0.75; R('an' + sd).x = -lift * 0.25; }
      body.position.y = -Math.abs(jerk(c)) * 0.035 * w + Math.sin(t * 1.4) * 0.006; lean += ((moving ? 0.12 : 0.03) - lean) * Math.min(1, dt * 4);
      R('chest').x = lean; R('chest').z = Math.sin(ph * 0.5) * 0.06 * w + Math.sin(t * 0.9) * 0.03;
      // cabeça mole, caindo para um lado e dando trancos
      R('head').z = 0.22 + Math.sin(t * 0.7) * 0.06 + jerk(Math.sin(ph)) * 0.05 * w; R('head').x = 0.1 + Math.sin(t * 1.1) * 0.05; R('head').y = Math.sin(t * 0.37) * 0.3;
      // braços abertos, balançando soltos
      for (const sd of [-1, 1]) { R('sh' + sd).z = sd * (-0.25 + Math.sin(t * 1.3 + sd) * 0.05); R('sh' + sd).y = -sd * jerk(s) * 0.2 * w; R('el' + sd).z = sd * -(0.15 + Math.sin(t * 1.7 + sd) * 0.06); }
      // ataque: ergue o forcado (mão direita = -1) e espeta para a frente
      const k = (t - at0) / 0.85; if (k >= 0 && k < 1) { const up = k < 0.45 ? Math.sin(k / 0.45 * Math.PI / 2) : 1 - jerk((k - 0.45) / 0.55); const thrust = k > 0.45 ? Math.sin((k - 0.45) / 0.55 * Math.PI) : 0;
        R('sh-1').z = 0.25 - up * 0.9; R('sh-1').y = 0.9 * up + thrust * 0.4; R('el-1').z = up * 0.8 - thrust * 0.6; R('chest').x = lean - up * 0.15 + thrust * 0.35; R('chest').y = -up * 0.25 + thrust * 0.2; }
      const hk = (t - hitT) / 0.35; if (hk >= 0 && hk < 1) { const e = Math.sin(hk * Math.PI); R('chest').x -= e * 0.3; R('chest').z += e * 0.15 * hitD; R('head').x -= e * 0.4; }
    },
    die(k) { // desmonta: os joelhos cedem, ele tomba de costas e o chapéu cai; depois afunda devagar
      const f = Math.min(1, k / 0.9), e = 1 - Math.pow(1 - f, 3);
      R('kn-1').x = R('kn1').x = e * 1.4; R('th-1').x = R('th1').x = -e * 0.9; body.position.y = -e * 0.45; body.rotation.x = -e * 1.25; R('head').z = 0.4 + e * 0.4;
      for (const sd of [-1, 1]) { R('sh' + sd).z = sd * (-0.25 - e * 0.6); R('el' + sd).z = -sd * e * 0.4; }
      hat.position.y = 1.83 - SC.head[1][1] + e * 0.05; hat.rotation.x = -0.12 - e * 1.1; if (k > 2.4) root.position.y = -(k - 2.4) * 0.3;
      return true;
    } };
}

/* =========================================================================
   GOLEM DE MUSGO — rochas lascadas encaixadas (tronco, ombros, braços longos de punhos
   enormes, pernas curtas e grossas), musgo nas faces de cima, liquens, capim e flores
   brotando, olhos âmbar no fundo de uma fenda. Passos pesados (o corpo afunda e as
   pedras tremem); ataque: arma o braço e esmaga com o punho de pedra.
   ========================================================================= */
let golemMatC = null;
function golemMat() {
  return golemMatC || (golemMatC = paintMat('golem', `
    float up = smoothstep(0.15, 0.75, n.y + (vn(p * 3.0) - 0.5) * 0.6);
    vec3 stone = mix(vec3(0.42, 0.41, 0.38), vec3(0.55, 0.53, 0.48), vn(p * 4.0)) * (0.8 + 0.25 * vn(p * 22.0));
    float crack = 1.0 - smoothstep(0.0, 0.025, abs(vn(p * 6.0) - 0.5)); stone *= 1.0 - crack * 0.45;
    vec3 moss = mix(vec3(0.2, 0.33, 0.12), vec3(0.36, 0.48, 0.18), vn(p * 14.0)) * (0.75 + 0.35 * vn(p * 60.0));
    col = mix(stone, moss, up * smoothstep(0.35, 0.6, vn(p * 2.5 + 3.0) + up * 0.4));
    vec2 lw = worley(p * 9.0); float lichen = (1.0 - smoothstep(0.08, 0.16, lw.x)) * step(0.62, vn(p * 3.0 + 9.0)) * (1.0 - up);
    col = mix(col, mix(vec3(0.75, 0.72, 0.45), vec3(0.8, 0.52, 0.2), vn(p * 5.0)), lichen * 0.8);`, { roughness: 0.92 }));
}
function flowersOn(parent, pts, seed) { // flores miúdas (5 pétalas) e capim brotando do musgo
  const r = rngOf(seed), cols = ['#f2e6a0', '#d9a0d8', '#ffffff', '#f2b45a'];
  for (const [x, y, z] of pts) {
    const f = new THREE.Group(); f.position.set(x, y, z); parent.add(f);
    const grass = fibers(10, 0.09, 0.004, 0.9, '#5a7a2a', Math.floor(r() * 999)); f.add(grass);
    for (let k = 0; k < 3; k++) { const fl = new THREE.Group(); fl.position.set((r() - 0.5) * 0.06, 0.06 + r() * 0.04, (r() - 0.5) * 0.06); const pm = new THREE.MeshStandardMaterial({ color: cols[Math.floor(r() * cols.length)], roughness: 0.6, side: THREE.DoubleSide });
      for (let q = 0; q < 5; q++) { const pe = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), pm); pe.scale.set(1, 1.7, 1); pe.position.set(Math.cos(q * 1.257) * 0.012, 0, Math.sin(q * 1.257) * 0.012); pe.rotation.set(-Math.PI / 2 + 0.4, 0, q * 1.257 - Math.PI / 2); fl.add(pe); }
      const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: '#e0a020' })); fl.add(ctr); f.add(fl); }
  }
}
export function mossGolem() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const M = golemMat(), J = {}, seg = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent ? J[parent] : body).add(g); J[name] = g; return g; };
  const rock = (parent, seed, r, pos, rot = [0, 0, 0]) => { const m = new THREE.Mesh(rockGeo(seed, ...r), M); m.position.set(...pos); m.rotation.set(...rot); m.userData.rock = Math.min(...r); J[parent].add(m); return m; };
  // esqueleto (pivôs) em metros; frente = +z
  seg('hips', null, 0, 0.78, 0); seg('chest', 'hips', 0, 0.36, 0); seg('head', 'chest', 0, 0.44, 0.16);
  for (const s of [-1, 1]) { seg('sh' + s, 'chest', s * 0.42, 0.2, 0); seg('el' + s, 'sh' + s, s * 0.14, -0.36, 0.04); seg('wr' + s, 'el' + s, s * 0.04, -0.34, 0.05); seg('th' + s, 'hips', s * 0.21, -0.05, 0); seg('kn' + s, 'th' + s, s * 0.02, -0.33, 0.03); seg('an' + s, 'kn' + s, 0, -0.33, -0.02); }
  rock('hips', 11, [0.3, 0.2, 0.24], [0, 0.02, 0]);                                   // bacia
  rock('chest', 21, [0.42, 0.36, 0.32], [0, 0.18, 0], [0.1, 0.3, 0]);                 // tronco (pedra grande)
  rock('chest', 23, [0.26, 0.2, 0.22], [0.12, 0.42, -0.08], [0.4, 0, 0.3]);           // ombreira de pedra por cima
  rock('chest', 25, [0.22, 0.17, 0.2], [-0.18, 0.4, -0.04], [-0.3, 0.6, 0]);
  rock('chest', 27, [0.24, 0.22, 0.18], [0, 0.05, 0.2], [0.2, 0, 0]);                  // peito
  const head = rock('head', 31, [0.17, 0.14, 0.16], [0, 0.02, 0.02]); rock('head', 33, [0.19, 0.07, 0.13], [0, 0.1, 0.06], [0.2, 0, 0]); // cabeça + sobrancelha de pedra
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffb84a', emissive: '#ff9a20', emissiveIntensity: 2.2 })); e.position.set(s * 0.06, 0.03, 0.135); J.head.add(e); }
  for (const s of [-1, 1]) {
    rock('sh' + s, 41 + s, [0.2, 0.18, 0.2], [s * 0.04, -0.02, 0]);
    rock('sh' + s, 43 + s, [0.13, 0.22, 0.13], [s * 0.08, -0.2, 0.02], [0, 0, s * 0.2]);   // braço
    rock('el' + s, 45 + s, [0.15, 0.24, 0.15], [s * 0.02, -0.17, 0.02]);                     // antebraço grosso
    rock('wr' + s, 47 + s, [0.17, 0.15, 0.18], [0, -0.08, 0.03]);                            // punho enorme
    rock('th' + s, 51 + s, [0.15, 0.2, 0.15], [0, -0.16, 0]);                                // coxa
    rock('kn' + s, 53 + s, [0.13, 0.19, 0.14], [0, -0.17, 0]);                               // canela
    rock('an' + s, 55 + s, [0.15, 0.07, 0.21], [0, -0.005, 0.05]);                            // pé chato de laje
  }
  // musgo pendurado, capim e flores nas faces de cima
  flowersOn(J.chest, [[0.15, 0.6, -0.05], [-0.2, 0.55, 0.02], [0.02, 0.5, -0.15], [0.3, 0.45, 0.05]], 71);
  flowersOn(J.head, [[0.04, 0.16, 0.02]], 73); for (const s of [-1, 1]) flowersOn(J['sh' + s], [[s * 0.05, 0.14, 0]], 75 + s);
  const vineM = new THREE.MeshStandardMaterial({ color: '#4a6a24', roughness: 0.9 });
  for (const [par, x, y, z, len] of [['chest', 0.25, 0.3, 0.18, 0.4], ['chest', -0.2, 0.2, 0.22, 0.3], ['sh1', 0.12, -0.1, 0.1, 0.35], ['sh-1', -0.1, -0.15, 0.12, 0.28]]) {
    const pts = [V(x, y, z)]; for (let k = 1; k <= 5; k++) pts.push(V(x + Math.sin(k * 1.7) * 0.02, y - len * k / 5, z + 0.02 + Math.sin(k) * 0.01));
    J[par].add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 6), vineM));
  }
  shadowAll(root);
  const meter = strideMeter(root); let ph = 0, at0 = -9, lt = 0, hitT = -9, hitD = 1, stomp = 0;
  const R = n => J[n].rotation;
  const api = { root, stomps: 0, attack() { at0 = lt; }, hit(d) { hitT = lt; hitD = d || 1; },
    animate(t, moving, dt = 1 / 60) {
      lt = t; const m = meter(dt), w = Math.min(1, m.spd / 0.7), prev = ph; ph += m.d / 0.95 * Math.PI; // passada longa e pesada
      if (Math.floor(prev / Math.PI) !== Math.floor(ph / Math.PI) && w > 0.3) { stomp = 1; api.stomps++; }
      stomp = Math.max(0, stomp - dt * 5);
      const s = Math.sin(ph), c = Math.cos(ph);
      for (const sd of [-1, 1]) { const ss = sd === -1 ? s : -s, lift = Math.max(0, sd === -1 ? -c : c) * w; R('th' + sd).x = -ss * 0.38 * w - lift * 0.15; R('kn' + sd).x = lift * 0.55; R('an' + sd).x = -R('th' + sd).x - R('kn' + sd).x; }
      body.position.y = -Math.abs(c) * 0.06 * w - stomp * 0.04 + Math.sin(t * 0.8) * 0.008; // afunda a cada passo
      body.rotation.z = s * 0.06 * w; R('chest').y = s * 0.12 * w; R('chest').x = 0.12 + Math.sin(t * 0.8) * 0.02 + stomp * 0.03;
      R('head').y = Math.sin(t * 0.4) * 0.25; R('head').x = -0.05 + stomp * 0.05;
      for (const sd of [-1, 1]) { R('sh' + sd).x = (sd === -1 ? -s : s) * 0.35 * w + Math.sin(t * 0.9 + sd) * 0.03; R('sh' + sd).z = sd * 0.08; R('el' + sd).x = -0.25 - Math.max(0, (sd === -1 ? -s : s)) * 0.25 * w; }
      // ataque: arma o braço direito (-1) para trás e esmaga para a frente e para baixo
      const k = (t - at0) / 1.1; if (k >= 0 && k < 1) { const wind = k < 0.45 ? Math.sin(k / 0.45 * Math.PI / 2) : 1 - Math.min(1, (k - 0.45) / 0.15), smash = k > 0.45 ? Math.min(1, (k - 0.45) / 0.15) * (1 - Math.max(0, (k - 0.75) / 0.25)) : 0;
        R('sh-1').x = wind * 1.2 - smash * 1.7; R('el-1').x = -0.3 - wind * 0.6 + smash * 0.2; R('chest').y = wind * 0.45 - smash * 0.35; R('chest').x = 0.12 - wind * 0.1 + smash * 0.35; body.position.y -= smash * 0.06; }
      const hk = (t - hitT) / 0.4; if (hk >= 0 && hk < 1) { const e = Math.sin(hk * Math.PI); R('chest').x -= e * 0.15; R('chest').z = e * 0.1 * hitD; }
    },
    die(k, dt = 1 / 60) { // desmorona: as pedras se soltam, caem e rolam; depois afundam
      if (!api.parts) { api.parts = []; root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), r = rngOf(7);
        body.traverse(o => { if (!o.isMesh || !o.userData.rock) return; /* só as pedras caem */ const mw = o.matrixWorld.clone(); api.parts.push({ o, m: new THREE.Matrix4().multiplyMatrices(inv, mw), v: V((r() - 0.5) * 1.2, 0.6 + r() * 0.8, (r() - 0.5) * 1.2), w: V((r() - 0.5) * 4, (r() - 0.5) * 4, (r() - 0.5) * 4) }); });
        for (const P of api.parts) { P.o.parent.remove(P.o); root.add(P.o); P.m.decompose(P.o.position, P.o.quaternion, P.o.scale); }
        body.visible = false; } // olhos, flores e cipós somem com o corpo; só as pedras caem
      for (const P of api.parts) { const o = P.o; P.v.y -= 9.8 * dt; o.position.addScaledVector(P.v, dt); const floor = o.userData.rock * 0.75; /* a pedra pousa no chão */ if (o.position.y < floor) { o.position.y = floor; P.v.y *= -0.25; P.v.x *= 0.6; P.v.z *= 0.6; P.w.multiplyScalar(0.6); } o.rotation.x += P.w.x * dt; o.rotation.z += P.w.z * dt; }
      if (k > 2.6) root.position.y = -(k - 2.6) * 0.35;
      return true;
    } };
  return api;
}

/* =========================================================================
   GUARDIÃO ANCESTRAL (chefe) — guerreiro de pedra talhada, imponente, com peças de
   bronze antigo esverdeado (elmo com crista, ombreiras, peitoral, braçadeiras, grevas),
   runas que brilham na pele de pedra, raízes e casca subindo pelas pernas e musgo.
   Espadão de bronze com runas e escudo redondo. Anda devagar e pesado; ataque:
   ergue o espadão e desce num golpe que racha o chão.
   ========================================================================= */
const GB = { root: [null, [0, 0, 0]], hips: ['root', [0, 0.86, 0]], chest: ['hips', [0, 1.18, 0]], neck: ['chest', [0, 1.38, 0.01]], head: ['neck', [0, 1.49, 0.03]] };
for (const s of [-1, 1]) Object.assign(GB, { ['sh' + s]: ['chest', [s * 0.24, 1.33, 0]], ['el' + s]: ['sh' + s, [s * 0.33, 1.08, 0.0]], ['wr' + s]: ['el' + s, [s * 0.37, 0.86, 0.06]], ['th' + s]: ['hips', [s * 0.11, 0.84, 0]], ['kn' + s]: ['th' + s, [s * 0.12, 0.47, 0.03]], ['an' + s]: ['kn' + s, [s * 0.12, 0.08, -0.01]] });
let gdGeo = null;
function guardianGeo() {
  if (gdGeo) return gdGeo;
  const P = [], C = (a, b, r0, r1, bone, k = 0.05) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.05) => P.push({ c, r, bone, k });
  E([0, 0.88, 0], [0.17, 0.12, 0.12], 'hips', 0.05);
  C([0, 0.94, 0], [0, 1.08, 0.01], 0.13, 0.14, 'hips', 0.06);                  // cintura
  E([0, 1.22, 0.02], [0.21, 0.15, 0.13], 'chest', 0.06);                       // peito largo
  E([0, 1.15, 0.07], [0.14, 0.09, 0.08], 'chest', 0.05);                       // abdômen
  for (const s of [-1, 1]) E([s * 0.08, 1.24, 0.08], [0.09, 0.07, 0.06], 'chest', 0.04); // peitorais
  C([0, 1.33, 0], [0, 1.45, 0.02], 0.065, 0.06, 'neck', 0.04);                 // pescoço grosso
  E([0, 1.53, 0.03], [0.085, 0.105, 0.1], 'head', 0.03);                       // cabeça (rosto talhado)
  E([0, 1.49, 0.1], [0.04, 0.03, 0.03], 'head', 0.02);                         // queixo/maxilar
  for (const s of [-1, 1]) {
    E([s * 0.24, 1.33, 0], [0.085, 0.08, 0.08], 'sh' + s, 0.05);             // deltoide
    C([s * 0.24, 1.32, 0], [s * 0.33, 1.08, 0], 0.07, 0.058, 'sh' + s, 0.04); // braço
    C([s * 0.33, 1.08, 0], [s * 0.37, 0.88, 0.05], 0.056, 0.045, 'el' + s, 0.035);
    E([s * 0.375, 0.84, 0.07], [0.045, 0.055, 0.05], 'wr' + s, 0.03);       // mão fechada
    C([s * 0.11, 0.86, 0], [s * 0.12, 0.47, 0.03], 0.09, 0.065, 'th' + s, 0.05); // coxa
    C([s * 0.12, 0.47, 0.03], [s * 0.12, 0.1, -0.01], 0.06, 0.045, 'kn' + s, 0.04);
    E([s * 0.12, 0.06, 0.05], [0.05, 0.045, 0.11], 'an' + s, 0.03);          // pé
  }
  return (gdGeo = sdfSkinnedGeometry(P, GB, [-0.5, -0.02, -0.25], [1.0, 1.7, 0.5], 0.013));
}
function guardianMat(guardRunes) {
  return paintMat('guardian', `
    vec3 stone = mix(vec3(0.46, 0.45, 0.41), vec3(0.6, 0.58, 0.52), vn(p * 7.0)) * (0.82 + 0.22 * vn(p * 40.0));
    float crack = 1.0 - smoothstep(0.0, 0.02, abs(vn(p * 9.0) - 0.5)); stone *= 1.0 - crack * 0.4;
    float up = smoothstep(0.35, 0.85, n.y + (vn(p * 5.0) - 0.5) * 0.5) * smoothstep(0.45, 0.65, vn(p * 3.0 + 2.0));
    col = mix(stone, mix(vec3(0.22, 0.34, 0.14), vec3(0.34, 0.46, 0.18), vn(p * 20.0)), up * 0.85);
    col = mix(col, vec3(0.3, 0.27, 0.22), (1.0 - smoothstep(0.25, 0.45, p.y)) * 0.4 * vn(p * 6.0)); // pés sujos de terra
    // runas entalhadas: traços curtos em faixas no peito, braços e coxas, brilhando
    float band = step(0.5, fract(p.y * 7.0)) * (1.0 - step(0.62, fract(p.y * 7.0)));
    vec2 g = fract(vec2(atan(p.x, p.z + 0.001) * 4.0, p.y * 14.0)); float glyph = step(0.55, vn(floor(vec3(atan(p.x, p.z + 0.001) * 4.0, p.y * 14.0, 1.0)) * 1.3));
    float stroke = (1.0 - smoothstep(0.06, 0.12, abs(g.x - 0.5))) + (1.0 - smoothstep(0.06, 0.12, abs(g.y - 0.5 - (g.x - 0.5) * glyph)));
    float rune = clamp(stroke, 0.0, 1.0) * band * glyph * step(0.6, p.y) * step(p.y, 1.42);
    col = mix(col, vec3(0.2, 0.25, 0.22), rune * 0.6);
    emi = vec3(0.25, 0.95, 0.75) * rune * uRune * (0.7 + 0.3 * sin(p.y * 30.0));`, { roughness: 0.9 }, guardRunes);
}
const bronzeMat = () => paintMat('bronze', `
  vec3 br = mix(vec3(0.55, 0.38, 0.18), vec3(0.72, 0.52, 0.26), vn(p * 30.0));
  float pat = smoothstep(0.45, 0.75, vn(p * 18.0) + (1.0 - n.y) * 0.15);  // pátina verde nas reentrâncias
  col = mix(br, vec3(0.25, 0.5, 0.42), pat * 0.75);`, { metalness: 0.75, roughness: 0.42, side: THREE.DoubleSide });
function guardianBlade(bm) {
  const g = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(-0.045, 0); sh.lineTo(-0.055, 0.5); sh.quadraticCurveTo(-0.06, 0.72, 0, 0.92); sh.quadraticCurveTo(0.06, 0.72, 0.055, 0.5); sh.lineTo(0.045, 0); sh.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.01, bevelSegments: 3, curveSegments: 16 }), bm); blade.position.set(0, 0.1, -0.006); g.add(blade);
  const runeM = new THREE.MeshStandardMaterial({ color: '#103a30', emissive: '#40ffc0', emissiveIntensity: 1.6 }); const rl = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.03), runeM); rl.position.set(0, 0.42, 0); g.add(rl);
  const guard = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.14, 0.12, 0), V(-0.07, 0.09, 0), V(0, 0.1, 0), V(0.07, 0.09, 0), V(0.14, 0.12, 0)]), 16, 0.016, 8), bm); g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.22, 12), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.9 })); grip.position.y = -0.02; g.add(grip);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), bm); pom.position.y = -0.15; g.add(pom);
  return g;
}
export function ancientGuardian(color = '#4d6b3a') {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const guardRunes = { uRune: { value: 1 } }; // runas por guardião
  const rig = sdfRig(guardianGeo(), GB, guardianMat(guardRunes)), { at, bones } = rig, R = n => bones[n].rotation; body.add(rig.mesh);
  const bm = bronzeMat();
  // elmo: calota + crista + protetores de bochecha
  const helm = new THREE.Group(), dome = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), bm); dome.scale.set(1, 1.08, 1.12); helm.add(dome);
  const crest = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.07, 0.11), V(0, 0.15, 0.04), V(0, 0.14, -0.08), V(0, 0.04, -0.16)]), 24, 0.022, 10), new THREE.MeshStandardMaterial({ color: '#7a2a1a', roughness: 0.9 })); crest.scale.set(0.7, 1, 1); helm.add(crest);
  for (const s of [-1, 1]) { const ck = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12, s > 0 ? -0.2 : Math.PI - 0.9, 1.1, Math.PI * 0.42, Math.PI * 0.3), bm); ck.scale.set(1, 1.3, 1.1); helm.add(ck); }
  at('head', helm, 0, 1.55, 0.02);
  for (const s of [-1, 1]) { // ombreiras, braçadeiras e grevas de bronze
    const pa = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), bm); pa.scale.set(1.05, 0.75, 1.0); pa.rotation.z = -s * 0.35; at('sh' + s, pa, s * 0.26, 1.36, 0);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.13, 20, 1, true), bm); br.rotation.z = s * 0.2; at('el' + s, br, s * 0.355, 0.95, 0.03);
    const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.2, 20, 1, true, -1.3, 2.6), bm); at('kn' + s, gr, s * 0.12, 0.27, 0.02);
  }
  const plate = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 18, -1.2, 2.4, 0.35, 1.25), bm); plate.scale.set(1.0, 0.95, 0.68); at('chest', plate, 0, 1.2, -0.02); // peitoral
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.95, side: THREE.DoubleSide })); at('hips', skirt, 0, 0.82, 0); // saiote de couro gasto
  // raízes e casca subindo pelas pernas, musgo
  const bark = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 });
  for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 8; k++) { const a = k * 1.1 * s, y = 0.04 + k * 0.09; pts.push(V(s * 0.12 + Math.cos(a) * 0.07, y, Math.sin(a) * 0.07)); } at(k2(s), new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 8), bark), 0, 0, 0); }
  function k2(s) { return 'kn' + s; }
  // espadão (mão direita = -1) e escudo redondo (mão esquerda = 1)
  const sword = guardianBlade(bm); sword.rotation.set(Math.PI / 2 - 0.25, 0, 0); at('wr-1', sword, -0.375, 0.84, 0.08);
  const shield = new THREE.Group(), disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 40), bm); disc.rotation.x = Math.PI / 2; shield.add(disc);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), bm); boss.rotation.x = Math.PI / 2; boss.position.z = 0.012; shield.add(boss);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 8, 48), new THREE.MeshStandardMaterial({ color: '#103a30', emissive: '#40ffc0', emissiveIntensity: 1.4 })); ring.position.z = 0.014; shield.add(ring);
  shield.rotation.y = Math.PI / 2 * 0.15; at('wr1', shield, 0.42, 0.88, 0.08);
  shadowAll(root);
  const meter = strideMeter(root); let ph = 0, at0 = -9, lt = 0, hitT = -9, hitD = 1;
  return { root, attack() { at0 = lt; }, hit(d) { hitT = lt; hitD = d || 1; },
    animate(t, moving, dt = 1 / 60) {
      lt = t; const m = meter(dt), w = Math.min(1, m.spd / 0.6); ph += m.d / 0.7 * Math.PI;
      const s = Math.sin(ph), c = Math.cos(ph);
      for (const sd of [-1, 1]) { const ss = sd === -1 ? s : -s, lift = Math.max(0, sd === -1 ? -c : c) * w; R('th' + sd).x = -ss * 0.42 * w - lift * 0.2; R('kn' + sd).x = lift * 0.7; R('an' + sd).x = -lift * 0.25; }
      body.position.y = -Math.abs(c) * 0.025 * w + Math.sin(t * 0.9) * 0.004; R('chest').y = s * 0.1 * w; R('chest').x = 0.05 + Math.sin(t * 0.9) * 0.015;
      R('head').y = Math.sin(t * 0.35) * 0.3; R('head').x = 0.05;
      R('sh-1').x = -0.15 + s * 0.2 * w; R('el-1').x = -0.55; R('sh1').x = -0.35 - s * 0.15 * w; R('el1').x = -1.0; R('sh1').z = 0.15;  // espada baixa à frente, escudo erguido
      guardRunes.uRune.value = 0.75 + Math.sin(t * 2.2) * 0.25;
      // golpe: ergue o espadão por cima da cabeça e desce com tudo
      const k = (t - at0) / 1.25; if (k >= 0 && k < 1) { // fases: ergue (0–0,5) · desce à frente (0,5–0,62) · segura no chão (–0,8) · volta à guarda
        const L = (a, b, e) => a + (b - a) * e, ease = e => e * e * (3 - 2 * e); let sh, el, cx, cy, drop = 0, glow;
        if (k < 0.5) { const e = ease(k / 0.5); sh = L(-0.15, -2.8, e); el = L(-0.55, -1.0, e); cx = L(0.05, -0.15, e); cy = L(0, -0.2, e); glow = 1 + e * 0.8; }
        else if (k < 0.62) { const e = (k - 0.5) / 0.12; sh = L(-2.8, -0.65, e); el = L(-1.0, -0.15, e); cx = L(-0.15, 0.5, e); cy = L(-0.2, 0.15, e); drop = e; glow = 1.8; }
        else if (k < 0.8) { sh = -0.65; el = -0.15; cx = 0.5; cy = 0.15; drop = 1; glow = 1.5; }
        else { const e = ease((k - 0.8) / 0.2); sh = L(-0.65, -0.15, e); el = L(-0.15, -0.55, e); cx = L(0.5, 0.05, e); cy = L(0.15, 0, e); drop = 1 - e; glow = L(1.5, 1, e); }
        R('sh-1').x = sh; R('el-1').x = el; R('chest').x = cx; R('chest').y = cy; body.position.y -= drop * 0.05; guardRunes.uRune.value = glow; }
      const hk = (t - hitT) / 0.4; if (hk >= 0 && hk < 1) { const e = Math.sin(hk * Math.PI); R('chest').x -= e * 0.12; R('chest').z = e * 0.08 * hitD; }
    },
    die(k) { // ajoelha, apoia na espada e tomba para a frente; as runas se apagam
      const f1 = Math.min(1, k / 0.8), e1 = 1 - Math.pow(1 - f1, 3), f2 = Math.max(0, Math.min(1, (k - 0.9) / 0.7)), e2 = f2 * f2;
      R('th-1').x = R('th1').x = -e1 * 1.2; R('kn-1').x = R('kn1').x = e1 * 2.0; body.position.y = -e1 * 0.38 + e2 * 0.5; body.rotation.x = e2 * 1.35; body.position.z = e2 * 0.35; // tomba deitado SOBRE o chão
      R('sh-1').x = -0.6 * e1; R('chest').x = 0.2 * e1; R('head').x = 0.4 * e1;
      guardRunes.uRune.value = Math.max(0, 1 - k / 1.5); if (k > 2.6) root.position.y = -(k - 2.6) * 0.35;
      return true;
    } };
}
