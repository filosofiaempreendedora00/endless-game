/* =========================================================================
   MASCOTES 3D — feitos em código, um visual por estágio de evolução.
   makePet(species, stage) devolve { obj, root, animate(t, {speed, turn}, dt), attack(), height }.
   Rodada 14 (S-142 a S-146):
   - Pelagem em "cascas" (shell fur): várias camadas da própria pele com fios recortados por ruído —
     o pelo nasce da pele, é macio e contínuo, nada de mechas coladas.
   - Andar de verdade: cada pata tem fase de apoio (fica PLANTADA no chão, varrendo para trás na mesma
     velocidade do corpo) e fase de passo (levanta e vai à frente). Passo, trote e galope trocam pela
     velocidade, como os humanos importados (sem deslizar).
   - Raposa: rosto novo expressivo (pálpebras, piscar, boca que abre/ofega), patas com dedos e almofada,
     fogo de partículas (não desenho) e caudas com física própria que nunca se atravessam.
   - Bolha: corpo de água molenga (estica ao acelerar, achata ao pousar, treme), anda pulando,
     rosto com expressões (pisca, sorri, abre a boca, fecha os olhos de alegria), nadadeiras de água.
   - Tatu: casco fechado (não dá para ver dentro); o visual de musgo/cristais virou o estágio 2 e o
     estágio 3 é uma armadura de cristal pronta e simétrica.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';
import { sdfSkinnedGeometry, sdfRig, SDF_NOISE_GLSL } from './mounts3d.js'; // S-330: raposa no mesmo método do lobo (malha contínua com esqueleto)

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const glow = (color, intensity = 1.2, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra });
const VC = (r = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, ...extra });
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
const smooth = (cur, to, dt, k) => cur + (to - cur) * (1 - Math.exp(-dt * k));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const strike = k => k < 0 || k > 1 ? 0 : k < 0.3 ? -Math.sin(k / 0.3 * Math.PI / 2) * 0.3 : Math.sin((k - 0.3) / 0.7 * Math.PI);
const shadows = o => o.traverse(c => { if (c.isMesh && !c.userData.noShadow) c.castShadow = true; });
let SEED = 1; const rnd = () => (SEED = SEED * 16807 % 2147483647) / 2147483647;

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
function taper(points, r0, r1, seg = 16, radial = 12, rf = null) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const u = i / seg, r = rf ? rf(u) : r0 + (r1 - r0) * u, c = curve.getPointAt(u); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r); } }
  g.computeVertexNormals(); return g;
}
const capSphere = (r, x, y, z) => { const g = new THREE.SphereGeometry(r, 14, 10); g.translate(x, y, z); return g; };
const strip = g => { const x = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k); return x; };
// junta mantendo os vértices soldados (normais lisas) quando possível
const weld = g => { const x = mergeVertices(g, 1e-5); x.computeVertexNormals(); return x; };
const merged = (geos, m) => new THREE.Mesh(mergeGeometries(geos.map(strip)), m);
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = null) => { if (s) g.scale(...s); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };

/* ---------- pelagem em cascas (shell fur) ----------
   Camada k de n: a pele empurrada ao longo da normal (e penteada na direção "comb");
   o fragmento só sobrevive onde há um fio (célula de ruído 3D na posição ORIGINAL da pele),
   e o fio afina para a ponta → pelo macio que nasce da pele, sem mechas soltas. */
const FUR_MATS = new Map();
function furMat(o) {
  const comb = V3(...(o.comb || [0, -0.3, -1])).normalize();
  const key = [o.len, o.den, comb.x.toFixed(2), comb.y.toFixed(2), comb.z.toFixed(2), o.tip || 0].join('|');
  if (FUR_MATS.has(key)) return FUR_MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uLen = { value: o.len }; sh.uniforms.uDen = { value: o.den * 0.6 }; // fios um pouco mais grossos: macios de perto, sem chiado de longe sh.uniforms.uComb = { value: comb }; sh.uniforms.uTip = { value: o.tip || 0 };
    sh.vertexShader = 'attribute float aF; attribute float aL; uniform float uLen; uniform vec3 uComb; varying vec3 vFurP; varying vec3 vFurN; varying float vF;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vF = aF; vFurP = position; vFurN = normal; transformed += (normal * uLen * aF + uComb * uLen * aF * aF * 1.1) * aL;');
    sh.fragmentShader = 'uniform float uDen; uniform float uTip; varying vec3 vFurP; varying vec3 vFurN; varying float vF;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { // fios: pontos num plano 2D escolhido pela normal (sem anéis), com centro sorteado em cada célula
        vec3 an = abs(normalize(vFurN)); vec2 q; float ax;
        if (an.x > an.y && an.x > an.z) { q = vFurP.yz; ax = 1.0; } else if (an.y > an.z) { q = vFurP.zx; ax = 2.0; } else { q = vFurP.xy; ax = 3.0; }
        q = q * uDen + vec2(0.37, 0.71) * ax;
        vec2 c = floor(q);
        float h = fract(sin(dot(c, vec2(12.9898, 78.233)) + ax * 3.7) * 43758.5453);
        float h2 = fract(h * 91.7), h3 = fract(h * 57.3);
        vec2 fr = fract(q) - vec2(0.5 + (h2 - 0.5) * 0.4, 0.5 + (h3 - 0.5) * 0.4);
        float th = (1.0 - vF * (0.7 + 0.25 * h2)) * (0.52 + 0.18 * h);
        if (length(fr) > th) discard;
        diffuseColor.rgb *= mix(0.84, 1.0 + uTip, vF) * (0.95 + 0.1 * h); } // S-266: sem o "Bombril" (fios menos escuros por dentro e sem pontilhado forte)`);
  };
  m.customProgramCacheKey = () => 'furShellC';
  FUR_MATS.set(key, m); return m;
}
// todas as n cascas numa geometria só (1 chamada de desenho por peça): atributo aF = k/n
function furShells(parent, geo, o) {
  const n = o.n || 7, src = geo.index ? geo : mergeVertices(geo), P = src.attributes.position, N = src.attributes.normal, C = src.attributes.color, I = src.index, vc = P.count;
  const pos = new Float32Array(vc * 3 * n), nor = new Float32Array(vc * 3 * n), col = new Float32Array(vc * 3 * n), af = new Float32Array(vc * n), al = new Float32Array(vc * n), idx = new (vc * n > 65535 ? Uint32Array : Uint16Array)(I.count * n);
  const lf = new Float32Array(vc); for (let i = 0; i < vc; i++) lf[i] = o.lenFn ? o.lenFn(P.getX(i), P.getY(i), P.getZ(i)) : 1;
  for (let k = 0; k < n; k++) {
    al.set(lf, k * vc);
    pos.set(P.array, k * vc * 3); nor.set(N.array, k * vc * 3); if (C) col.set(C.array, k * vc * 3); af.fill((k + 1) / n, k * vc, (k + 1) * vc);
    for (let i = 0; i < I.count; i++) idx[k * I.count + i] = I.getX(i) + k * vc;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aF', new THREE.BufferAttribute(af, 1)); g.setAttribute('aL', new THREE.BufferAttribute(al, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.Mesh(g, furMat(o)); m.castShadow = false; m.receiveShadow = true; m.userData.noShadow = true; parent.add(m);
  return [m];
}

/* ---------- fogo de partículas ----------
   Pontos com brilho suave que nascem na base, sobem, se curvam e somem: núcleo branco-amarelo,
   corpo laranja e ponta vermelho-escura — parece chama de verdade, não um desenho. */
const FIRE_VS = `attribute float size; attribute vec4 pcol; varying vec4 vC; uniform float uScale;
void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FIRE_FS = `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.0, r); a = a * sqrt(a) * vC.a; gl_FragColor = vec4(vC.rgb * (1.0 + 0.6 * a), clamp(a * 1.6, 0.0, 1.0)); }`;
function makeFire(n, o = {}) {
  const { r0 = 0.02, rise = 0.32, life = 0.5, size = 0.06, hot = false, ring = 0, core = false, pal = null } = o;
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), siz = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('pcol', new THREE.BufferAttribute(col, 4)); g.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, vertexShader: FIRE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.noShadow = true; pts.renderOrder = 5;
  const P = Array.from({ length: n }, (_, i) => ({ age: i / n * life, life: life * (0.7 + rnd() * 0.6), x: 0, y: 0, z: 0, sx: 0, sz: 0, ph: rnd() * 6 }));
  const spawn = p => { const a = rnd() * 6.283, rr = ring ? ring * (0.85 + rnd() * 0.3) : Math.sqrt(rnd()) * r0; p.x = Math.cos(a) * rr; p.z = Math.sin(a) * rr; p.y = (rnd() - 0.3) * r0 * 0.6; p.sx = (rnd() - 0.5) * 0.06; p.sz = (rnd() - 0.5) * 0.06; p.age = 0; p.life = life * (0.7 + rnd() * 0.6); p.ph = rnd() * 6; };
  P.forEach(spawn); P.forEach((p, i) => { p.age = i / n * p.life; });
  const ws = new THREE.Vector3(), c = new THREE.Color();
  const cHot = new THREE.Color(pal ? pal[0] : hot ? '#fffbe8' : '#fff1b0'), cMid = new THREE.Color(pal ? pal[1] : hot ? '#ffc23a' : '#ff8a1e'), cOut = new THREE.Color(pal ? pal[2] : hot ? '#ff6a10' : '#c0300a');
  return { obj: pts, update(t, dt, drift = 0, gain = 1) {
    pts.getWorldScale(ws); m.uniforms.uScale.value = 620 * ws.y;
    for (let i = 0; i < n; i++) {
      const p = P[i]; p.age += dt; if (p.age > p.life) spawn(p);
      const k = p.age / p.life, up = rise * k * (0.8 + 0.4 * Math.sin(p.ph));
      const wob = Math.sin(t * 9 + p.ph + k * 5) * 0.012 * k;
      pos[i * 3] = p.x * (1 - k * 0.7) + p.sx * k + wob; pos[i * 3 + 1] = p.y + up; pos[i * 3 + 2] = p.z * (1 - k * 0.7) + p.sz * k - drift * k * k;
      if (k < 0.3) c.copy(cHot).lerp(cMid, k / 0.3); else c.copy(cMid).lerp(cOut, (k - 0.3) / 0.7);
      const a = Math.min(1, k * 8) * Math.pow(1 - k, 1.2) * gain * 0.55;
      col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = a;
      siz[i] = size * (0.75 + k * 0.6) * (1 - k * 0.6) * (0.8 + 0.4 * Math.sin(p.ph * 3));
    }
    g.attributes.position.needsUpdate = g.attributes.pcol.needsUpdate = g.attributes.size.needsUpdate = true;
  } };
}

/* ---------- ciclo de passada (vale para todos os mascotes) ----------
   p ∈ [0,1): apoio (pata no chão, varre de +1 → −1 linear = mesma velocidade do corpo) e passo
   (levanta e volta à frente). A amplitude é calculada para a pata não escorregar no chão. */
function legCycle(p, duty) {
  if (p < duty) return { sw: 1 - 2 * (p / duty), lift: 0, stance: true };
  const u = (p - duty) / (1 - duty); return { sw: -Math.cos(u * Math.PI), lift: Math.sin(u * Math.PI), stance: false };
}
// marcha: devolve fases por pata (ordem: FE, FD, TE, TD), duty, frequência e amplitude
const GAITS = {
  walk: { off: [0.5, 0.0, 0.25, 0.75], duty: 0.66 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], duty: 0.5 },
  gallop: { off: [0.55, 0.62, 0.0, 0.08], duty: 0.38 },
};
function makeGait(legLen, opt = {}) {
  const st = { cyc: 0, off: [...GAITS.walk.off], duty: 0.66, A: 0, v: 0, gallop: 0 };
  const Amax = opt.Amax || 0.62, fMin = opt.fMin || 1.2;
  return {
    st,
    step(vLocal, dt) {
      st.v = smooth(st.v, vLocal, dt, 6);
      const v = st.v, g = v < legLen * 3.2 ? GAITS.walk : v < legLen * 9 ? GAITS.trot : GAITS.gallop;
      st.gallop = smooth(st.gallop, g === GAITS.gallop ? 1 : 0, dt, 4);
      st.duty = smooth(st.duty, g.duty, dt, 5);
      for (let i = 0; i < 4; i++) { let d = g.off[i] - st.off[i]; d -= Math.round(d); st.off[i] += d * (1 - Math.exp(-dt * 5)); }
      // frequência: o mínimo que mantém a amplitude abaixo de Amax; amplitude: a que casa a pata com o chão
      const f = Math.max(fMin, v * st.duty / (2 * legLen * Amax));
      st.A = v > 0.02 ? clamp(v * st.duty / (2 * legLen * f), 0, Amax) : smooth(st.A, 0, dt, 8);
      if (v > 0.02) st.cyc += f * dt; else st.cyc += dt * 0.0;
      return st;
    },
    leg(i) { return legCycle(fract(st.cyc + st.off[i]), st.duty); },
  };
}
// velocidade "de verdade" do mascote: main3d passa speed = v / vMax (vMax ≈ 7,5 m/s)
const PET_VMAX = 7.5;

/* =========================================================================
   S-330: RAPOSA REALISTA (Faísca → Labareda → Solaris), no método do lobo (wolf3d.js)
   - Corpo: UMA malha contínua (campo de distância + pele presa a ossos): patas finas e longas,
     digitígradas, punho e jarrete marcados, almofadas e dedos; focinho fino e comprido; bochechas.
   - Pelagem: cor pintada no material (ferrugem com dorso mais escuro e mesclado, barriga/garganta/
     metade de baixo do rosto brancas, meias pretas, lábios e "lágrima" pretos) + camadas de pelo presas
     ao esqueleto (colar e bochechas longos, focinho e patas curtos).
   - Orelhas de verdade: grandes, finas, em concha, costas pretas e pelo claro por dentro; viram sozinhas.
   - Rosto: olhos amendoados âmbar com pupila vertical, pálpebras, bigodes; expressões (calma, curiosa,
     alerta, feliz). Cauda(s) à parte, volumosas, ponta branca, com física e o fogo do estágio na ponta.
   - Andar: passo/trote/galope pela velocidade real, patas por IK (a pata de apoio fica no chão).
   ========================================================================= */
const fxLen = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function fxCaps(px, py, pz, P) { const [ax, ay, az] = P.a, [bx, by, bz] = P.b, bax = bx - ax, bay = by - ay, baz = bz - az, pax = px - ax, pay = py - ay, paz = pz - az; const t = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz))); return fxLen(pax - bax * t, pay - bay * t, paz - baz * t) - (P.r0 + (P.r1 - P.r0) * t); }
function fxEll(px, py, pz, P) { const [cx, cy, cz] = P.c, [rx, ry, rz] = P.r, x = px - cx, y = py - cy, z = pz - cz; const k0 = fxLen(x / rx, y / ry, z / rz), k1 = fxLen(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); }
const fxPrim = (x, y, z, P) => (P.a ? fxCaps(x, y, z, P) : fxEll(x, y, z, P));
function fxSmin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
const fxField = (parts, x, y, z) => { let d = 0.25; for (const P of parts) d = fxSmin(d, fxPrim(x, y, z, P), P.k); return d; };
function fxSurface(parts, o, dir) { const l = fxLen(...dir), d = dir.map(v => v / l); let t = 0; for (; t < 0.3; t += 0.001) if (fxField(parts, o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) > 0) break; return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; }
// esqueleto (metros, frente = +z, chão = 0; raposa-vermelha ~0,4 m na cernelha)
const FB = { root: [null, [0, 0, 0]], hips: ['root', [0, 0.408, -0.192]], chest: ['hips', [0, 0.42, 0.108]], neck: ['chest', [0, 0.456, 0.216]], head: ['neck', [0, 0.54, 0.36]], jaw: ['head', [0, 0.5136, 0.402]], tail: ['hips', [0, 0.4, -0.31]] };
for (const s of [-1, 1]) Object.assign(FB, {
  ['ear' + s]: ['head', [s * 0.03, 0.585, 0.362]],
  ['up' + s]: ['chest', [s * 0.058, 0.372, 0.162]], ['fo' + s]: ['up' + s, [s * 0.055, 0.249, 0.123]], ['pa' + s]: ['fo' + s, [s * 0.052, 0.078, 0.157]],
  ['th' + s]: ['hips', [s * 0.06, 0.381, -0.252]], ['sh' + s]: ['th' + s, [s * 0.06, 0.264, -0.18]], ['mt' + s]: ['sh' + s, [s * 0.057, 0.12, -0.303]],
});
const FX_FOOT = { f: [0.018, 0.183], h: [0.018, -0.2688] };
function foxParts() {
  const P = [], C = (a, b, r0, r1, bone, k = 0.035) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.035) => P.push({ c, r, bone, k });
  // tronco esguio: peito fundo e estreito, cernelha, cintura fina, garupa
  E([0, 0.362, 0.126], [0.06, 0.105, 0.105], 'chest', 0.045);
  C([0, 0.405, 0.15], [0, 0.411, -0.03], 0.08, 0.074, 'chest', 0.045);
  E([0, 0.452, 0.112], [0.056, 0.044, 0.09], 'chest', 0.045);
  C([0, 0.411, -0.03], [0, 0.412, -0.18], 0.07, 0.066, 'hips', 0.045);
  E([0, 0.37, -0.08], [0.048, 0.036, 0.1], 'hips', 0.055);
  E([0, 0.4, -0.24], [0.064, 0.07, 0.085], 'hips', 0.045);
  // pescoço fino com colar de pelo e peito
  C([0, 0.432, 0.18], [0, 0.516, 0.33], 0.054, 0.038, 'neck', 0.045);
  E([0, 0.468, 0.236], [0.066, 0.08, 0.078], 'neck', 0.055);
  E([0, 0.39, 0.21], [0.048, 0.062, 0.048], 'chest', 0.045);
  // cabeça: crânio redondo, testa, focinho fino e comprido, ponta do nariz, mandíbula (osso próprio)
  E([0, 0.553, 0.37], [0.05, 0.045, 0.055], 'head', 0.028);
  E([0, 0.566, 0.404], [0.03, 0.024, 0.032], 'head', 0.022);
  C([0, 0.541, 0.41], [0, 0.527, 0.508], 0.026, 0.0135, 'head', 0.026);
  E([0, 0.534, 0.452], [0.024, 0.024, 0.044], 'head', 0.028);
  E([0, 0.528, 0.515], [0.011, 0.0095, 0.009], 'head', 0.012);
  C([0, 0.512, 0.39], [0, 0.512, 0.5], 0.02, 0.0095, 'jaw', 0.009);
  for (const s of [-1, 1]) {
    E([s * 0.04, 0.527, 0.358], [0.036, 0.037, 0.04], 'head', 0.03); // bochechas de pelo
    // pata da frente: escápula, braço até o cotovelo, antebraço fino, punho, metacarpo, pata e dedos
    E([s * 0.058, 0.372, 0.156], [0.028, 0.07, 0.052], 'up' + s, 0.04);
    C([s * 0.058, 0.348, 0.162], [s * 0.055, 0.252, 0.126], 0.03, 0.02, 'up' + s, 0.03);
    E([s * 0.055, 0.245, 0.115], [0.016, 0.019, 0.018], 'up' + s, 0.018);
    C([s * 0.055, 0.249, 0.132], [s * 0.052, 0.084, 0.157], 0.017, 0.0105, 'fo' + s, 0.024);
    E([s * 0.054, 0.2, 0.139], [0.016, 0.04, 0.018], 'fo' + s, 0.03);
    E([s * 0.052, 0.078, 0.157], [0.0125, 0.015, 0.0135], 'pa' + s, 0.014);
    C([s * 0.052, 0.078, 0.157], [s * 0.052, 0.026, 0.175], 0.0105, 0.0125, 'pa' + s, 0.014);
    E([s * 0.052, 0.017, 0.184], [0.018, 0.0135, 0.025], 'pa' + s, 0.018);
    for (let q = 0; q < 4; q++) E([s * 0.052 + (q - 1.5) * 0.0098, 0.012, 0.203 + (Math.abs(q - 1.5) < 1 ? 0.005 : 0)], [0.0072, 0.0085, 0.0095], 'pa' + s, 0.007);
    // pata de trás: coxa, joelho à frente, perna fina até o jarrete alto, metatarso, pata e dedos
    E([s * 0.06, 0.36, -0.252], [0.04, 0.085, 0.07], 'th' + s, 0.045);
    C([s * 0.06, 0.372, -0.252], [s * 0.06, 0.264, -0.18], 0.05, 0.026, 'th' + s, 0.035);
    C([s * 0.058, 0.264, -0.186], [s * 0.057, 0.12, -0.303], 0.022, 0.0115, 'sh' + s, 0.024);
    E([s * 0.058, 0.222, -0.228], [0.019, 0.042, 0.024], 'sh' + s, 0.03);
    E([s * 0.057, 0.12, -0.313], [0.011, 0.016, 0.015], 'mt' + s, 0.012);
    C([s * 0.057, 0.12, -0.303], [s * 0.057, 0.026, -0.275], 0.012, 0.012, 'mt' + s, 0.014);
    E([s * 0.057, 0.017, -0.267], [0.017, 0.0135, 0.024], 'mt' + s, 0.018);
    for (let q = 0; q < 4; q++) E([s * 0.057 + (q - 1.5) * 0.0095, 0.012, -0.247 + (Math.abs(q - 1.5) < 1 ? 0.005 : 0)], [0.0068, 0.008, 0.009], 'mt' + s, 0.007);
  }
  C([0, 0.405, -0.25], [0, 0.402, -0.31], 0.03, 0.022, 'hips', 0.03); // raiz da cauda (a cauda é uma malha à parte)
  return P;
}
// cauda: cadeia de 5 ossos, volumosa no meio, afinando na ponta (malha própria, uma por cauda)
const TB = { t0: [null, [0, 0, 0]], t1: ['t0', [0, -0.004, -0.075]], t2: ['t1', [0, -0.014, -0.16]], t3: ['t2', [0, -0.032, -0.245]], t4: ['t3', [0, -0.056, -0.325]] };
function tailParts() {
  const P = [], C = (a, b, r0, r1, bone, k = 0.03) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.03) => P.push({ c, r, bone, k });
  C([0, 0, 0.012], [0, -0.004, -0.075], 0.017, 0.026, 't0'); C([0, -0.004, -0.075], [0, -0.014, -0.16], 0.026, 0.037, 't1');
  C([0, -0.014, -0.16], [0, -0.032, -0.245], 0.037, 0.042, 't2'); C([0, -0.032, -0.245], [0, -0.056, -0.325], 0.042, 0.035, 't3'); C([0, -0.056, -0.325], [0, -0.074, -0.4], 0.035, 0.012, 't4', 0.025);
  E([0, -0.03, -0.22], [0.04, 0.037, 0.1], 't2', 0.04);
  return P;
}
let FOXG = null, TAILG = null, FOX_EYE = null, FOX_NOSE = null;
function foxGeo() {
  if (FOXG) return FOXG;
  const P = foxParts();
  FOXG = sdfSkinnedGeometry(P, FB, [-0.16, -0.012, -0.36], [0.32, 0.66, 0.92], 0.0085);
  FOX_EYE = fxSurface(P, [0, 0.556, 0.385], [0.6, 0.12, 0.79]);
  FOX_NOSE = fxSurface(P, [0, 0.531, 0.48], [0, 0, 1]);
  TAILG = sdfSkinnedGeometry(tailParts(), TB, [-0.07, -0.13, -0.43], [0.14, 0.18, 0.47], 0.0072);
  return FOXG;
}
// pelagem pintada (espaço de repouso: o desenho fica preso ao corpo) + comprimento do pelo por região
const FOX_GLSL = `
uniform vec3 uBase, uDark, uLight, uSock, uGold, uEye; uniform float uGoldK;
float fHead(vec3 p){ return smoothstep(0.31, 0.35, p.z) * smoothstep(0.47, 0.5, p.y); }
vec3 fCoat(vec3 p, vec3 n){
  float hd = fHead(p), g = vn(p * vec3(160.0, 160.0, 70.0));
  vec3 col = uBase;
  col = mix(col, uDark * (0.7 + 0.6 * g), smoothstep(0.0, 0.7, n.y) * smoothstep(0.4, 0.46, p.y) * (1.0 - hd) * 0.55); // dorso mais escuro e mesclado
  float wh = smoothstep(-0.5, -0.85, n.y) * smoothstep(0.38, 0.35, p.y) * (1.0 - hd);                                       // barriga (só por baixo)
  wh = max(wh, smoothstep(0.045, 0.02, abs(p.x)) * smoothstep(0.17, 0.24, p.z) * smoothstep(0.5, 0.43, p.y) * (1.0 - hd)); // garganta e peito
  wh = max(wh, hd * smoothstep(0.532, 0.522, p.y + (0.36 - p.z) * 0.02));                                                 // metade de baixo do rosto
  wh = max(wh, hd * smoothstep(0.03, 0.045, abs(p.x)) * smoothstep(0.55, 0.53, p.y) * smoothstep(0.43, 0.38, p.z));       // bochechas
  col = mix(col, uLight, clamp(wh, 0.0, 1.0));
  float sock = smoothstep(0.21, 0.13, p.y) * (1.0 - hd);
  sock = max(sock, smoothstep(0.27, 0.19, p.y) * smoothstep(0.0, 0.6, n.z) * step(0.05, p.z));                            // frente da pata dianteira, mais alta
  col = mix(col, uSock, sock);                                                                                            // meias pretas
  vec3 q = vec3(abs(p.x), p.y, p.z), a = uEye + vec3(-0.004, -0.005, 0.006), b = vec3(0.0135, 0.519, 0.468), ab = b - a;
  float t = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  col = mix(col, uSock, hd * smoothstep(0.0055, 0.002, length(q - a - ab * t)) * 0.75);                                   // "lágrima" escura do olho à boca
  col = mix(col, uSock, hd * (1.0 - smoothstep(0.002, 0.0055, abs(p.y - 0.5145))) * smoothstep(0.42, 0.45, p.z) * smoothstep(0.005, 0.011, abs(p.x))); // lábios pretos
  col = mix(col, vec3(0.03), hd * smoothstep(0.513, 0.52, p.z) * step(0.522, p.y));                                       // nariz
  col = mix(col, vec3(0.04), hd * (1.0 - smoothstep(0.008, 0.014, length(q - uEye))));                                     // contorno dos olhos
  col = mix(col, uGold, uGoldK * hd * smoothstep(0.012, 0.004, abs(p.x)) * smoothstep(0.555, 0.575, p.y) * smoothstep(0.43, 0.38, p.z)); // risca dourada (Solaris)
  col = mix(col, vec3(0.05, 0.04, 0.04), smoothstep(0.012, 0.004, p.y));                                                  // almofadas
  col = mix(col, col * vec3(0.86, 0.8, 0.78), hd * smoothstep(0.4, 0.46, p.z) * step(0.522, p.y) * (1.0 - wh));             // dorso do focinho um tom mais queimado
  float fine = vn(vec3(p.x * 900.0, p.y * 900.0, p.z * 260.0));                                                             // pelo curto e fino (focinho, patas, testa)
  return col * (0.9 + 0.2 * g) * (0.9 + 0.2 * fine);
}
float fFurLen(vec3 p){
  float hd = fHead(p), L = 0.009;
  L = mix(L, 0.024, smoothstep(0.16, 0.22, p.z) * (1.0 - smoothstep(0.31, 0.35, p.z)) * smoothstep(0.38, 0.44, p.y));     // colar
  L = mix(L, 0.02, hd * smoothstep(0.03, 0.045, abs(p.x)) * smoothstep(0.55, 0.52, p.y) * (1.0 - smoothstep(0.4, 0.44, p.z))); // bochechas
  L = mix(L, 0.016, smoothstep(-0.2, -0.26, p.z) * smoothstep(0.25, 0.32, p.y) * (1.0 - smoothstep(0.4, 0.43, p.y)));     // "calças" das coxas
  L = mix(L, 0.014, smoothstep(0.36, 0.33, p.y) * (1.0 - hd) * step(0.2, p.y));                                           // barriga
  L *= mix(0.22, 1.0, smoothstep(0.14, 0.24, p.y));                                                                       // patas: pelo curto
  L *= 1.0 - 0.85 * hd * smoothstep(0.41, 0.45, p.z);                                                                     // focinho curto
  L *= 1.0 - 0.75 * hd * smoothstep(0.55, 0.575, p.y);                                                                    // alto da cabeça: pelo bem curto
  L *= 1.0 - 0.35 * hd;                                                                                                   // rosto todo mais curto e liso
  L *= smoothstep(0.01, 0.02, length(vec3(abs(p.x), p.y, p.z) - uEye));                                                  // nada sobre os olhos
  return L;
}
vec3 tCoat(vec3 p, vec3 n){
  float g = vn(p * vec3(120.0, 120.0, 60.0)), tip = smoothstep(-0.33, -0.37, p.z);
  vec3 col = mix(uBase, uDark * (0.6 + 0.8 * g), smoothstep(0.0, 0.8, n.y) * 0.5);
  col = mix(col, uBase * 1.12, smoothstep(0.0, -0.7, n.y) * 0.4);
  col = mix(col, uDark * 0.5, smoothstep(-0.29, -0.33, p.z) * (1.0 - tip) * 0.35);                                       // pelos de ponta preta antes da ponta branca
  col = mix(col, uLight, tip);
  return col * (0.88 + 0.24 * g);
}
float tFurLen(vec3 p){ return max(0.006, 0.034 * smoothstep(0.01, -0.07, p.z) * (1.0 - 0.6 * smoothstep(-0.38, -0.43, p.z))); }`;
const FOX_MATS = {};
function foxMats(stage) {
  if (FOX_MATS[stage]) return FOX_MATS[stage];
  const base = new THREE.Color(['#c9581f', '#bf4a17', '#d06a1c'][stage]);
  const U = { uBase: base, uDark: base.clone().lerp(new THREE.Color('#3a1206'), 0.62), uLight: new THREE.Color('#f4ece0'), uSock: new THREE.Color('#1c1311'), uGold: new THREE.Color('#ffcf5a') };
  const mk = (kind, f) => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: f ? 1 : 0.92 }), COAT = kind === 'body' ? 'fCoat' : 'tCoat', LEN = kind === 'body' ? 'fFurLen' : 'tFurLen', comb = kind === 'body' ? 'vec3(0.0, -0.5, -0.86)' : 'vec3(0.0, -0.15, -1.0)';
    m.onBeforeCompile = sh => {
      for (const k in U) sh.uniforms[k] = { value: U[k] }; sh.uniforms.uGoldK = { value: stage === 2 ? 0.8 : 0 }; sh.uniforms.uEye = { value: new THREE.Vector3(...FOX_EYE) };
      if (!f) {
        sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
        sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON;\n' + SDF_NOISE_GLSL + FOX_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= ${COAT}(vOP, normalize(vON));`);
      } else {
        sh.uniforms.uF = { value: f };
        sh.vertexShader = 'varying vec3 vOP; varying vec3 vON; uniform float uF;\n' + SDF_NOISE_GLSL + FOX_GLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vOP = position; vON = normal; float h = ${LEN}(position) * uF;
          transformed += normal * h + ${comb} * h * uF * 0.9;`);
        sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform float uF;\n' + SDF_NOISE_GLSL + FOX_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float L = ${LEN}(vOP);
          { // fios finos e redondos que afinam até a ponta (num plano escolhido pela normal: sem quadrados nem anéis)
            vec3 an = abs(normalize(vON)); vec2 qq; float ax;
            if (an.x > an.y && an.x > an.z) { qq = vOP.yz; ax = 1.0; } else if (an.y > an.z) { qq = vOP.zx; ax = 2.0; } else { qq = vOP.xy; ax = 3.0; }
            qq = qq * 430.0 + vec2(0.37, 0.71) * ax; vec2 cc = floor(qq);
            float hh = fract(sin(dot(cc, vec2(12.9898, 78.233)) + ax * 3.7) * 43758.5453);
            vec2 fr = fract(qq) - 0.5 - (vec2(fract(hh * 91.7), fract(hh * 57.3)) - 0.5) * 0.45;
            float th = (1.0 - uF * (0.78 + 0.18 * hh)) * (0.5 + 0.2 * hh);
            if (L < 0.002 || length(fr) > th) discard;
            diffuseColor.rgb *= ${COAT}(vOP, normalize(vON)) * mix(0.72, 1.08, uF) * (0.94 + 0.12 * hh);
          }`);
      }
    };
    m.customProgramCacheKey = () => 'fox-' + kind + '-' + f + '-' + stage;
    return m;
  };
  const NL = 7, shellsOf = kind => Array.from({ length: NL }, (_, i) => mk(kind, (i + 1) / NL));
  return (FOX_MATS[stage] = { body: mk('body', 0), tail: mk('tail', 0), bodyShells: shellsOf('body'), tailShells: shellsOf('tail') });
}
// orelha: lâmina fina em concha (frente creme com pelos, bordas ferrugem, costas e ponta pretas), duas faces + borda
let EAR_G = null;
function foxEarGeo() {
  if (EAR_G) return EAR_G;
  const NU = 16, NV = 10, Hh = 0.08, W = 0.052, cream = new THREE.Color('#efe3cf'), rust = new THREE.Color('#b8501c'), black = new THREE.Color('#17100d');
  const wid = u => W * Math.pow(1 - u, 0.85) * (1 + 0.2 * Math.sin(Math.PI * u)) + 0.0015;
  const cup = (u, v) => -0.017 * (1 - v * v) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.06)), 0.65) - 0.004 * u * u;
  const lay = k => { const pos = [], col = [], c = new THREE.Color();
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = j / NV * 2 - 1, w = wid(u) * (k ? 1.05 : 1);
      pos.push(v * w / 2, u * Hh * (k ? 1.01 : 1), cup(u, v) - (k ? 0.0032 + 0.0015 * (1 - u) : 0));
      if (!k) c.copy(cream).lerp(rust, ss(0.55, 0.95, Math.abs(v))).lerp(rust, ss(0.18, 0.0, u) * 0.7).lerp(black, ss(0.8, 0.95, u) * 0.85);
      else c.copy(rust).lerp(black, ss(0.2, 0.4, u));
      col.push(c.r, c.g, c.b);
    }
    return { pos, col }; };
  const F = lay(0), B = lay(1), n = (NU + 1) * (NV + 1), id = (i, j) => i * (NV + 1) + j, fIdx = [], all = [];
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1); fIdx.push(a, d, c, a, c, b); all.push(a, d, c, a, c, b, a + n, c + n, d + n, a + n, b + n, c + n); }
  for (let i = 0; i < NU; i++) { const f0 = id(i, 0), f1 = id(i + 1, 0); all.push(f0, f1, f0 + n, f1, f1 + n, f0 + n); const g0 = id(i, NV), g1 = id(i + 1, NV); all.push(g0, g0 + n, g1, g1, g0 + n, g1 + n); }
  const front = new THREE.BufferGeometry(); front.setAttribute('position', new THREE.Float32BufferAttribute(F.pos, 3)); front.setAttribute('color', new THREE.Float32BufferAttribute(F.col, 3)); front.setIndex(fIdx); front.computeVertexNormals();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...F.pos, ...B.pos], 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute([...F.col, ...B.col], 3)); geo.setIndex(all); geo.computeVertexNormals();
  return (EAR_G = { geo, front });
}
const FX_GAITS = {
  walk: { off: [0.25, 0.75, 0.0, 0.5], duty: 0.62, cyc: 0.37, lift: 0.042 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], duty: 0.44, cyc: 0.63, lift: 0.06 },
  gallop: { off: [0.52, 0.42, 0.0, 0.12], duty: 0.3, cyc: 1.2, lift: 0.085 },
};
const fxAng = (dz, dy) => Math.atan2(dz, -dy);
const _fxv = new THREE.Vector3(), _fxq = new THREE.Quaternion(), _fxq2 = new THREE.Quaternion(), _fxe = new THREE.Euler();
function realFox(stage, scale) {
  SEED = 4242 + stage * 17;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const geo = foxGeo(), M = foxMats(stage);
  const rig = sdfRig(geo, FB, M.body), { at, bones } = rig, R = n => bones[n].rotation; body.add(rig.mesh);
  const shellsOf = (g, mats, mesh, par) => mats.map(m => { const s = new THREE.SkinnedMesh(g, m); s.bind(mesh.skeleton, mesh.bindMatrix); s.frustumCulled = false; s.castShadow = false; s.receiveShadow = true; s.userData.noShadow = true; par.add(s); return s; });
  const allShells = shellsOf(geo, M.bodyShells, rig.mesh, body);
  bones.head.scale.setScalar(stage === 0 ? 1.24 : 1.14); // raposa tem cabeça grande para o corpo (filhote ainda mais)
  // olhos amendoados âmbar com pupila vertical, brilho e pálpebra
  const IRIS = new THREE.MeshStandardMaterial({ color: stage === 2 ? '#f2b232' : '#e09a2a', emissive: '#8a4a10', emissiveIntensity: 0.18, roughness: 0.06 }), DARK = new THREE.MeshStandardMaterial({ color: '#0b0808', roughness: 0.3 });
  const LID = new THREE.MeshStandardMaterial({ color: new THREE.Color(['#8a3a14', '#7a2c0e', '#8e4410'][stage]), roughness: 0.95 });
  const lids = [], eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.rotation.set(-0.1, s * 0.5, s * -0.32); at('head', eg, s * FOX_EYE[0], FOX_EYE[1], FOX_EYE[2] - 0.004);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0088, 20, 14), IRIS); ir.scale.set(1.35, 0.78, 0.42); eg.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 12, 10), DARK); pu.scale.set(0.32, 0.95, 0.42); pu.position.z = 0.0036; eg.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.003, 0.003, 0.0048); eg.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0118, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), LID); lid.scale.set(1.28, 0.05, 0.62); lid.position.y = 0.0008; eg.add(lid); lids.push(lid); eyes.push(eg);
  }
  // nariz úmido com narinas
  { const ng = new THREE.SphereGeometry(0.0108, 22, 16); ng.scale(1.25, 0.82, 0.78); const P = ng.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k); if (z > 0.004 && y < 0.002 && Math.abs(Math.abs(x) - 0.0048) < 0.003) P.setZ(k, z - 0.0026); } ng.computeVertexNormals();
    at('head', new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ color: '#0e0a0a', roughness: 0.16 })), 0, FOX_NOSE[1] + 0.001, FOX_NOSE[2] - 0.005); }
  // boca: fundo escuro, língua (aparece ofegando/feliz) e presinhas
  const TOOTH = new THREE.MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.35 });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), new THREE.MeshStandardMaterial({ color: '#2a0d0d', roughness: 0.7 })); mouth.scale.set(0.014, 0.005, 0.04); at('head', mouth, 0, 0.5165, 0.462);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), new THREE.MeshStandardMaterial({ color: '#c8586a', roughness: 0.45 })); tongue.scale.set(0.0105, 0.0035, 0.032); at('jaw', tongue, 0, 0.5145, 0.476);
  for (const s of [-1, 1]) { const up = new THREE.Mesh(new THREE.ConeGeometry(0.0024, 0.01, 8), TOOTH); up.rotation.x = Math.PI; at('head', up, s * 0.0105, 0.5125, 0.496); const lo = new THREE.Mesh(new THREE.ConeGeometry(0.002, 0.008, 8), TOOTH); at('jaw', lo, s * 0.0088, 0.5165, 0.488); }
  // bigodes (fios finos e escuros, caindo levemente para trás)
  { const pts = []; for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const ox = s * 0.0165, oy = 0.5215 - (k % 3) * 0.0022, oz = 0.468 + Math.floor(k / 3) * 0.012, L = 0.046 + (k % 2) * 0.012, dx = s * (0.85 + (k % 3) * 0.05), dy = -0.08 - (k % 3) * 0.1, dz = -0.25 + Math.floor(k / 3) * 0.3, dl = Math.hypot(dx, dy, dz);
      const mx = ox + dx / dl * L * 0.5, my = oy + dy / dl * L * 0.5, mz = oz + dz / dl * L * 0.5; pts.push(ox, oy, oz, mx, my, mz, mx, my, mz, ox + dx / dl * L, oy + dy / dl * L - 0.006, oz + dz / dl * L); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const wl = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#1a1412', transparent: true, opacity: 0.7 })); wl.userData.noShadow = true; at('head', wl, 0, 0, 0); }
  // orelhas de verdade (concha fina, pelos claros por dentro), presas ao osso de cada orelha
  const EAR = foxEarGeo(), EARM = VC(0.88);
  const ears = [-1, 1].map(s => {
    const eg = new THREE.Group(), inner = new THREE.Group(); eg.add(inner); inner.rotation.set(-0.12, s * 0.35, -s * 0.22);
    inner.add(new THREE.Mesh(EAR.geo, EARM));
    furShells(inner, EAR.front, { len: 0.0075, den: 1100, comb: [0, 1, 0.5], n: 6, tip: 0.35, lenFn: (x, y) => ss(0.02, 0.0, Math.abs(x)) * ss(0.075, 0.04, y) });
    at('ear' + s, eg, s * 0.03, 0.585, 0.362); return { eg, inner, s };
  });
  // caudas: Faísca 1, Labareda 2, Solaris 3 — cada uma com seu esqueleto, pelagem longa e o fogo na ponta
  const tails = [], nT = stage + 1, spreadMax = nT === 1 ? 0 : nT === 2 ? 0.38 : 0.72;
  for (let i = 0; i < nT; i++) {
    const rest = nT === 1 ? 0 : (i / (nT - 1) - 0.5) * 2 * spreadMax, thin = nT === 3 ? 0.78 : nT === 2 ? 0.88 : 1;
    const tr = sdfRig(TAILG, TB, M.tail), tg = new THREE.Group(); tg.add(tr.mesh); tg.scale.setScalar(thin); tg.rotation.y = rest;
    allShells.push(...shellsOf(TAILG, M.tailShells, tr.mesh, tg));
    at('tail', tg, 0, 0.4 + (nT === 3 && i === 1 ? 0.01 : 0), -0.31);
    const fl = new THREE.Group(); tr.at('t4', fl, 0, -0.08, -0.41);
    // S-266: o fogo da cauda cresce com a evolução — pequeno, médio e grande
    const FS = [{ n: 50, r0: 0.02, rise: 0.12, size: 0.12, life: 0.45 }, { n: 75, r0: 0.026, rise: 0.24, size: 0.15, life: 0.6 }, { n: 95, r0: 0.032, rise: 0.36, size: 0.17, life: 0.7 }][stage];
    const fire = makeFire(FS.n, { r0: FS.r0 * thin, rise: FS.rise, life: FS.life, size: FS.size, hot: stage === 2, core: true }); fl.add(fire.obj);
    tails.push({ tg, tr, fl, fire, rest, yb: 0, vb: 0, ym: 0, vm: 0, pb: -0.3, vpb: 0, ph: i * 1.9 });
  }
  const neckFire = stage >= 1 ? makeFire(stage === 2 ? 30 : 18, { ring: 0.05, r0: 0.018, rise: 0.08, life: 0.45, size: 0.026, hot: stage === 2 }) : null;
  if (neckFire) at('neck', neckFire.obj, 0, 0.5, 0.25);
  const earFires = stage === 2 ? ears.map(e => { const f = makeFire(10, { r0: 0.005, rise: 0.05, life: 0.35, size: 0.02, hot: true }); f.obj.position.y = 0.082; e.inner.add(f.obj); return f; }) : [];
  let light = null; if (stage >= 1) { light = vlight(stage === 2 ? '#ffb04a' : '#ff8a3a', stage === 2 ? 1.3 : 0.75, 4); light.position.set(0, 0.6, -0.35); root.add(light); }
  shadows(root);
  let shellsOn = true;
  rig.mesh.onBeforeRender = (r, sc, cam) => { const on = cam.position.distanceTo(rig.mesh.getWorldPosition(_fxv)) < 26; if (on !== shellsOn) { shellsOn = on; allShells.forEach(s => (s.visible = on)); } }; // longe: só a malha pintada

  // pernas: IK de 2 ossos + pata (plano sagital)
  const BP = n => FB[n][1];
  const legs = [['f', -1], ['f', 1], ['h', -1], ['h', 1]].map(([k, s], i) => {
    const [a, b, c] = k === 'f' ? ['up' + s, 'fo' + s, 'pa' + s] : ['th' + s, 'sh' + s, 'mt' + s];
    const A = BP(a), B = BP(b), Cc = BP(c), F = FX_FOOT[k];
    return { i, k, s, a, b, c, l1: Math.hypot(B[1] - A[1], B[2] - A[2]), l2: Math.hypot(Cc[1] - B[1], Cc[2] - B[2]), l3: Math.hypot(F[0] - Cc[1], F[1] - Cc[2]), r1: fxAng(B[2] - A[2], B[1] - A[1]), r2: fxAng(Cc[2] - B[2], Cc[1] - B[1]), r3: fxAng(F[1] - Cc[2], F[0] - Cc[1]), fz: F[1], bend: k === 'f' ? -1 : 1 };
  });
  const rotYZ = (y, z, a) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  function pivot(leg) {
    const bp = body.rotation.x, hp = FB.hips[1], [hy, hz] = rotYZ(hp[1], hp[2], bp);
    let y = body.position.y + hy, z = body.position.z + hz, acc = bp + R('hips').x;
    if (leg.k === 'f') { const cp = FB.chest[1], [dy, dz] = rotYZ(cp[1] - hp[1], cp[2] - hp[2], acc); y += dy; z += dz; acc += R('chest').x; const up = BP(leg.a), [ey, ez] = rotYZ(up[1] - cp[1], up[2] - cp[2], acc); return [y + ey, z + ez, acc]; }
    const th = BP(leg.a), [ey, ez] = rotYZ(th[1] - hp[1], th[2] - hp[2], acc); return [y + ey, z + ez, acc];
  }
  function solveLeg(leg, fy, fz, th3) {
    const [py, pz, acc] = pivot(leg);
    const ay = fy + leg.l3 * Math.cos(th3), az = fz - leg.l3 * Math.sin(th3);
    let dy = ay - py, dz = az - pz, d = Math.hypot(dy, dz); const dmax = leg.l1 + leg.l2 - 0.0015, dmin = Math.abs(leg.l1 - leg.l2) + 0.006;
    if (d > dmax) { dy *= dmax / d; dz *= dmax / d; d = dmax; } else if (d < dmin) { dy *= dmin / d; dz *= dmin / d; d = dmin; }
    const ad = fxAng(dz, dy), al = Math.acos(Math.max(-1, Math.min(1, (leg.l1 * leg.l1 + d * d - leg.l2 * leg.l2) / (2 * leg.l1 * d))));
    const t1 = ad + leg.bend * al, ky = py - leg.l1 * Math.cos(t1), kz = pz + leg.l1 * Math.sin(t1), t2 = fxAng(pz + dz - kz, py + dy - ky);
    const a1 = leg.r1 - acc - t1, a2 = leg.r2 - acc - a1 - t2, a3 = leg.r3 - acc - a1 - a2 - th3;
    R(leg.a).x = a1; R(leg.b).x = a2; R(leg.c).x = a3;
  }
  // estado
  const W = { walk: 1, trot: 0, gallop: 0 }, wp = new THREE.Vector3(), prev = new THREE.Vector3();
  let has = false, spd = 0, ph = 0, mv = 0, yawRate = 0, lt = 0, at0 = -9, sniff = 0, look = 0, blinkAt = 1.5, earTw = [0, 0], earSw = [0, 0], earSwT = [0, 0], pant = 0, prevTurn = 0;
  let expr = 'calma', exprT = 2, tiltDir = 1; const X = { curiosa: 0, alerta: 0, feliz: 0 };
  return { root, attack() { at0 = lt; }, animate(t, m = {}, dt = 1 / 60) {
    lt = t; dt = Math.min(0.1, Math.max(0, dt));
    // velocidade medida pelo deslocamento de verdade (o passo casa com o chão); prévia parada = parada
    root.getWorldPosition(wp); const sc = root.getWorldScale(_fxv).x || 1;
    if (has && dt > 0) { const d = Math.hypot(wp.x - prev.x, wp.z - prev.z) / sc, v = d > 1.2 ? 0 : d / dt; spd += (v - spd) * Math.min(1, dt * 7); }
    prev.copy(wp); has = true;
    yawRate += ((m.turn || 0) - yawRate) * Math.min(1, dt * 5);
    const v = spd < 0.12 ? 0 : spd;
    const cur = W.gallop > W.trot && W.gallop > W.walk ? 'gallop' : W.trot > W.walk ? 'trot' : 'walk';
    const tgt = cur === 'walk' ? (v > 0.95 ? (v > 2.4 ? 'gallop' : 'trot') : 'walk') : cur === 'trot' ? (v < 0.65 ? 'walk' : v > 2.4 ? 'gallop' : 'trot') : (v < 2.05 ? (v < 0.65 ? 'walk' : 'trot') : 'gallop');
    for (const k in W) W[k] += ((k === tgt ? 1 : 0) - W[k]) * Math.min(1, dt * 4);
    mv += ((v > 0.05 ? 1 : 0) - mv) * Math.min(1, dt * 6);
    const g = f => W.walk * FX_GAITS.walk[f] + W.trot * FX_GAITS.trot[f] + W.gallop * FX_GAITS.gallop[f], sum = W.walk + W.trot + W.gallop || 1;
    const cyc = g('cyc') / sum, duty = g('duty') / sum, liftH = g('lift') / sum, gal = W.gallop / sum, trot = W.trot / sum, run = clamp((trot + gal) * mv, 0, 1);
    ph = (ph + v * dt / cyc) % 1; const P2 = ph * Math.PI * 2;
    // ataque: agacha e dá o bote com mordida
    const bk = (t - at0) / 0.55, bite = bk > 0 && bk < 1;
    const crouch = bite ? (bk < 0.3 ? ss(0, 0.3, bk) : 1 - ss(0.3, 0.45, bk)) : 0, lunge = bite ? (bk < 0.3 ? 0 : bk < 0.45 ? ss(0.3, 0.45, bk) : 1 - ss(0.55, 1, bk)) : 0;
    const open = bite ? (bk < 0.25 ? ss(0.05, 0.25, bk) * 0.3 : bk < 0.42 ? 0.3 + ss(0.25, 0.4, bk) * 0.5 : 0.8 * (1 - ss(0.42, 0.5, bk))) : 0;
    // expressões: feliz andando; alerta logo depois de lutar; parada alterna calma/curiosa/alerta
    if (mv > 0.5) expr = 'feliz'; else if (t - at0 < 3) expr = 'alerta'; else { exprT -= dt; if (exprT < 0 || expr === 'feliz') { const r = rnd(); expr = r < 0.4 ? 'calma' : r < 0.78 ? 'curiosa' : 'alerta'; exprT = 3 + rnd() * 4; tiltDir = rnd() < 0.5 ? -1 : 1; } }
    for (const k in X) X[k] += ((expr === k ? 1 : 0) - X[k]) * Math.min(1, dt * 3);
    // corpo: sobe e desce com a passada, balança no passo, arqueia no galope
    const bob = (W.walk * Math.cos(P2 * 2) * 0.005 + W.trot * Math.cos(P2 * 2) * 0.01 + W.gallop * (Math.sin(P2) * 0.027)) * mv / sum;
    body.position.y = bob - crouch * 0.042 - lunge * 0.012 + Math.sin(t * 1.9) * 0.0018 * (1 - mv);
    body.position.z = -crouch * 0.036 + lunge * 0.18;
    body.rotation.x = W.gallop * Math.cos(P2) * 0.07 * mv / sum + crouch * 0.05 - lunge * 0.04;
    body.rotation.z = Math.max(-0.12, Math.min(0.12, -yawRate * 0.04 * mv));
    R('hips').x = gal * Math.sin(P2) * 0.12 * mv; R('chest').x = -gal * Math.sin(P2) * 0.14 * mv;
    R('hips').y = W.walk * Math.sin(P2) * 0.06 * mv / sum; R('hips').z = W.walk * Math.sin(P2) * 0.04 * mv / sum + trot * Math.sin(P2 * 2) * 0.02 * mv;
    R('chest').y = -R('hips').y * 0.8 + yawRate * 0.04; R('chest').z = -R('hips').z * 0.6;
    bones.chest.scale.setScalar(1 + Math.sin(t * (2.4 + pant * 6)) * (0.008 + pant * 0.008)); // respiração
    // pernas: apoio (pata parada no chão) e balanço (sobe dobrando e vai à frente)
    for (const leg of legs) {
      const off = (W.walk * FX_GAITS.walk.off[leg.i] + W.trot * FX_GAITS.trot.off[leg.i] + W.gallop * FX_GAITS.gallop.off[leg.i]) / sum, u = (ph + off) % 1, Sd = cyc * duty * mv;
      let fz = leg.fz, fy = FX_FOOT[leg.k][0], th3 = leg.r3;
      if (u < duty) { const s = u / duty; fz += Sd * (0.5 - s); th3 -= (leg.k === 'f' ? 0.35 : 0.3) * ss(0.6, 1, s) * mv; }
      else { const s = (u - duty) / (1 - duty), e = 0.5 - 0.5 * Math.cos(Math.PI * s); fz += Sd * (e - 0.5); fy += Math.sin(Math.PI * s) * liftH * mv * (leg.k === 'f' ? 1 : 0.85); th3 -= (leg.k === 'f' ? 1.35 : 0.55) * Math.sin(Math.PI * Math.min(1, s * 1.25)) * mv; }
      if (bite) fz += leg.k === 'f' ? lunge * 0.07 - crouch * 0.018 : lunge * 0.025;
      solveLeg(leg, fy, fz, th3);
    }
    // cabeça estabilizada; fareja e olha em volta parada; inclina curiosa
    const sniffWant = mv < 0.1 && !bite && expr === 'calma' && Math.sin(t * 0.41 + 1.3) > 0.55 ? 1 : 0; sniff += (sniffWant - sniff) * Math.min(1, dt * 2);
    const lookWant = mv < 0.1 && !bite ? Math.sin(t * 0.33) * 0.5 + Math.sin(t * 0.87) * 0.15 : yawRate * 0.15; look += (lookWant - look) * Math.min(1, dt * 3);
    const comp = body.rotation.x + R('hips').x + R('chest').x;
    const bt = Math.max(crouch, lunge); // no bote a cabeça vai à frente e para baixo, rente ao alvo (nunca para o céu)
    R('neck').x = -comp - 0.26 * (1 - mv * 0.6) * (1 - bt) + (trot * 0.16 + gal * 0.1) * mv + W.walk * Math.sin(P2 * 2 + 0.6) * 0.035 * mv / sum + sniff * 0.7 + crouch * 0.3 + lunge * 0.32 - X.alerta * 0.08 * (1 - bt);
    R('neck').y = look * 0.55 * (1 - sniff * 0.5) * (1 - bt); R('head').y = look * 0.4 * (1 - bt) + sniff * Math.sin(t * 2.6) * 0.15;
    R('head').x = -sniff * 0.2 + lunge * 0.12 + crouch * 0.12 + Math.sin(t * 9) * 0.02 * sniff - X.curiosa * 0.06 * (1 - bt);
    R('head').z = (bite && bk > 0.42 && bk < 0.62 ? Math.sin((bk - 0.42) * 70) * 0.16 : 0) + X.curiosa * tiltDir * 0.32; // inclina a cabeça, curiosa
    pant += (((trot + gal) * mv > 0.5 ? 1 : 0) - pant) * Math.min(1, dt * 0.8);
    const happyMouth = X.feliz * 0.12;
    R('jaw').x = open * 1.0 + Math.max(pant * (0.24 + Math.sin(t * 10) * 0.05), happyMouth);
    tongue.visible = pant > 0.15 || happyMouth > 0.06 || open > 0.2; tongue.scale.z = 0.032 + pant * 0.012;
    // orelhas: em concha, viram sozinhas (cada uma para um lado), à frente curiosa/alerta, deitam no bote, para trás felizes
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1, e = ears[k];
      earTw[k] = Math.max(0, earTw[k] - dt * 4); if (rnd() < dt * 0.3) earTw[k] = 1;
      earSwT[k] -= dt; if (earSwT[k] < 0) { earSwT[k] = 1 + rnd() * 3; earSw[k] = (rnd() - 0.4) * 0.9; }
      const swv = mv < 0.1 && !bite ? earSw[k] : 0;
      R('ear' + s).x = -(gal * 0.6 * mv + Math.max(crouch, lunge) * 0.9) + X.alerta * 0.12 + X.curiosa * 0.1 - X.feliz * 0.22 + earTw[k] * 0.22;
      R('ear' + s).z = s * (-earTw[k] * 0.25 - (gal * mv + crouch) * 0.2 - X.feliz * 0.25);
      R('ear' + s).y = R('ear' + s).y + ((s * (swv - X.curiosa * 0.25) + look * 0.3) - R('ear' + s).y) * Math.min(1, dt * 6);
      void e;
    }
    // piscar; feliz aperta os olhos; alerta arregala
    let bl = 0; if (t > blinkAt) { const q = (t - blinkAt) / 0.12; bl = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) blinkAt = t + 2.2 + rnd() * 3.5; }
    for (const l of lids) l.scale.y = Math.max(0.05, bl * 0.78, X.feliz * 0.32 + Math.max(crouch, lunge) * 0.3 - X.alerta * 0.04);
    IRIS.emissiveIntensity = 0.18 + Math.max(crouch, lunge) * 0.6 + X.alerta * 0.1;
    // caudas: mola + amortecimento; caídas paradas, esticadas correndo, nunca se cruzam
    const turnAcc = ((m.turn || 0) - prevTurn) / Math.max(dt, 1e-3); prevTurn = m.turn || 0;
    for (const T2 of tails) {
      const wag = Math.sin(t * (1.6 + run * 3) + T2.ph) * (0.16 - run * 0.08) + X.feliz * Math.sin(t * 6 + T2.ph) * 0.12 * (1 - run);
      T2.vb += ((wag - yawRate * 0.12 - T2.yb) * 60 - T2.vb * 9 - turnAcc * 0.004) * dt; T2.yb += T2.vb * dt;
      const tm = Math.sin(t * (1.6 + run * 3) + T2.ph - 0.9) * 0.25 + T2.vb * -0.08;
      T2.vm += ((tm - T2.ym) * 45 - T2.vm * 7) * dt; T2.ym += T2.vm * dt;
      const tp = -0.38 + 0.32 * run + crouch * 0.25 + lunge * 0.3 + X.alerta * 0.1 + Math.sin(P2 * 2) * 0.04 * run;
      T2.vpb += ((tp - T2.pb) * 50 - T2.vpb * 8) * dt; T2.pb += T2.vpb * dt;
    }
    for (let i = 1; i < tails.length; i++) { const A0 = tails[i - 1], A1 = tails[i], minB = 0.55, minM = 0.5;
      const db = (A1.rest + A1.yb) - (A0.rest + A0.yb); if (db < minB) { const d = (minB - db) / 2; A0.yb -= d; A1.yb += d; A0.vb = Math.min(A0.vb, 0); A1.vb = Math.max(A1.vb, 0); }
      const dm = (A1.rest + A1.yb + A1.ym) - (A0.rest + A0.yb + A0.ym); if (dm < minM) { const d = (minM - dm) / 2; A0.ym -= d; A1.ym += d; } }
    root.getWorldQuaternion(_fxq2);
    for (const T2 of tails) {
      const B = T2.tr.bones; B.t0.rotation.set(T2.pb, T2.yb, 0);
      B.t1.rotation.set(0.05 * run, T2.ym * 0.35, 0); B.t2.rotation.set(0.06 * run - 0.04 * (1 - run), T2.ym * 0.3, 0); B.t3.rotation.set(0.06 * run, T2.ym * 0.25 + Math.sin(t * 2.2 + T2.ph) * 0.05, 0); B.t4.rotation.set(0.04 * run, T2.ym * 0.2 + Math.sin(t * 2.2 + T2.ph - 0.6) * 0.07, 0);
      T2.fl.parent.updateWorldMatrix(true, false); T2.fl.parent.getWorldQuaternion(_fxq); T2.fl.quaternion.copy(_fxq.invert().multiply(_fxq2)); // a chama sempre sobe
      T2.fire.update(t, dt, v * 0.05 * scale, 1);
    }
    if (neckFire) neckFire.update(t, dt, v * 0.02, 1);
    earFires.forEach(f => f.update(t, dt, 0, 1));
    if (light) light.intensity = (stage === 2 ? 1.3 : 0.75) + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.08;
  } };
}

/* =========================================================================
   (antigo) Faísca → Labareda → Solaris (raposa de fogo) — S-112, S-143, S-144 — substituída por realFox (S-330)
   ========================================================================= */
function fireFox(stage, scale) {
  SEED = 4242 + stage * 17;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const coat = ['#d4622a', '#c94e1a', '#dc7420'][stage], coatDark = ['#9a4018', '#8a2c10', '#a8480e'][stage], cream = '#f4ebdc', sock = '#2b1d18';
  const C = { coat: new THREE.Color(coat), dark: new THREE.Color(coatDark), cream: new THREE.Color(cream), sock: new THREE.Color(sock), gold: new THREE.Color('#ffcf5a') };
  const SKIN = VC(0.92);
  const HIP = 0.42;
  // ---- tronco ----
  const torsoG = sculpt(52, 38, (v, x, y, z) => {
    const front = ss(-0.2, 0.9, z), back = ss(0.2, -0.9, z);
    let X = x * 0.108 * (1 + 0.1 * front - 0.12 * ss(-0.5, 0.2, z) * (1 - ss(-0.9, -0.5, z))), Y = y * 0.112 * (1 + 0.14 * front), Z = z * 0.26;
    if (y < 0) Y *= 1 + 0.32 * front - 0.32 * ss(-0.1, -0.7, z) * (1 - back * 0.4);
    Y += 0.018 * front * (y > 0 ? 1 : 0);
    v.set(X, Y + HIP - 0.02, Z);
  });
  const torsoCol = (c, x, y, z) => { c.copy(C.coat); if (y > HIP + 0.05) c.lerp(C.dark, 0.25); if (y < HIP - 0.06 && z > 0.05) c.lerp(C.cream, ss(HIP - 0.06, HIP - 0.11, y)); if (y < HIP - 0.09) c.lerp(C.cream, 0.5); };
  vcolor(torsoG, torsoCol); body.add(new THREE.Mesh(torsoG, SKIN));
  furShells(body, torsoG, { len: 0.02, den: 420, comb: [0, -0.15, -1], n: 10, tip: 0.18 });
  // ---- pescoço e peito (colar de pelo creme) ----
  const neck = new THREE.Group(); neck.position.set(0, HIP + 0.05, 0.2); body.add(neck);
  const neckG = sculpt(28, 20, (v, x, y, z) => { const u = (y + 1) / 2; v.set(x * (0.076 - u * 0.014), y * 0.11 + 0.04, z * (0.074 - u * 0.012) + u * 0.08 - 0.03); });
  const neckCol = (c, x, y, z) => { c.copy(C.coat); if (z > 0.01) c.lerp(C.cream, ss(0.01, 0.05, z)); if (stage === 2 && z < -0.02) c.lerp(C.gold, 0.25); };
  vcolor(neckG, neckCol); neck.add(new THREE.Mesh(neckG, SKIN));
  furShells(neck, neckG, { len: 0.03, den: 400, comb: [0, -0.7, -0.6], n: 10, tip: 0.2 });
  // ---- cabeça: crânio largo, bochechas, focinho afilado com ponta arredondada (nada de cone) ----
  const head = new THREE.Group(); head.position.set(0, 0.15, 0.1); neck.add(head);
  head.scale.setScalar(stage === 0 ? 1.12 : 1);
  const hg = sculpt(72, 54, (v, x, y, z) => {
    const t = ss(0.05, 0.95, z);
    const tipRound = 1 - 0.35 * ss(0.85, 1, z);
    let X = x * 0.084 * (1 - 0.56 * t) * tipRound, Y = y * 0.072 * (1 - 0.5 * t) * tipRound, Z = z * 0.075 + Math.pow(Math.max(0, z - 0.05) / 0.95, 1.2) * 0.088;
    Y += -0.022 * t;
    if (y > 0) Y -= 0.006 * Math.exp(-Math.pow((z - 0.3) / 0.15, 2)); // degrau da testa
    if (y < 0.35 && z < 0.35 && z > -0.6) X *= 1 + 0.2 * (1 - Math.abs(z + 0.12)) * (1 - Math.max(0, y)); // bochechas cheias
    if (y > 0.45) Y *= 0.94;
    v.set(X, Y, Z);
  });
  const headCol = (c, x, y, z) => {
    c.copy(C.coat); if (y > 0.02) c.lerp(stage === 2 ? C.gold : C.dark, ss(0.035, 0.0, Math.abs(x)) * ss(0.0, 0.045, y) * (stage === 2 ? 0.6 : 0.25)); // risca da testa (dourada na Solaris), suave
    if ((y < -0.004 + (z - 0.05) * 0.09 && z > -0.02) || (y < 0.004 && z > -0.08 && Math.abs(x) > 0.045)) c.lerp(C.cream, 0.92); // focinho de baixo e bochechas claras
    if (z > 0.145) c.lerp(C.sock, ss(0.145, 0.165, z) * 0.55);
    if (Math.abs(x) > 0.03 && Math.abs(x) < 0.06 && y > -0.004 && y < 0.02 && z > 0.07 && z < 0.12) c.lerp(new THREE.Color('#3a1e14'), 0.4); // risquinho escuro do olho ao focinho
  };
  vcolor(hg, headCol); head.add(new THREE.Mesh(hg, SKIN));
  furShells(head, hg, { len: 0.008, den: 600, comb: [0, -0.1, -1], n: 6, tip: 0.12 });
  // tufos das bochechas (pelo mais longo e macio, abrindo para trás)
  const ruffG = mergeGeometries([-1, 1].map(sx => strip(at(sculpt(18, 14, (v, x, y, z) => v.set(x * 0.035, y * 0.03, z * 0.04)), sx * 0.062, -0.018, -0.012, 0, sx * 0.5, sx * 0.3))));
  const ruff = weld(ruffG); vcolor(ruff, (c, x, y) => c.copy(C.cream).lerp(C.coat, ss(-0.01, 0.01, y) * 0.5)); head.add(new THREE.Mesh(ruff, SKIN));
  furShells(head, ruff, { len: 0.022, den: 450, comb: [0, -0.5, -1], n: 8, tip: 0.25 });
  const noseG = new THREE.SphereGeometry(0.014, 18, 12); noseG.scale(1.3, 0.85, 0.95);
  head.add(merged([at(noseG, 0, -0.021, 0.172)], mat('#141012', { roughness: 0.22 })));
  // maxilar + língua (abre na mordida e ofega correndo)
  const jaw = new THREE.Group(); jaw.position.set(0, -0.032, 0.06); head.add(jaw);
  const jawG = sculpt(24, 16, (v, x, y, z) => { const u = (z + 1) / 2; v.set(x * 0.03 * (1 - u * 0.5), y * 0.013 * (1 - u * 0.35), z * 0.054 + 0.042); }); vcolor(jawG, c => c.copy(C.cream));
  jaw.add(new THREE.Mesh(jawG, SKIN));
  const mouthIn = merged([at(new THREE.SphereGeometry(0.02, 12, 8), 0, 0.011, 0.07, 0, 0, 0, [1, 0.3, 2.3])], mat('#5a1e22', { roughness: 0.6 })); jaw.add(mouthIn);
  const tongue = new THREE.Mesh(sculpt(14, 10, (v, x, y, z) => v.set(x * 0.013, y * 0.0035, z * 0.03)), mat('#d0606a', { roughness: 0.4 })); tongue.position.set(0, 0.012, 0.085); jaw.add(tongue);
  // olhos amendoados com pálpebras que piscam e estreitam (expressão)
  const EYE_M = VC(0.1), part = (g, col) => vcolor(g, c => c.set(col));
  const lidMat = SKIN, eyes = [];
  for (const sx of [-1, 1]) {
    const eg = mergeGeometries([
      part(at(new THREE.SphereGeometry(0.0175, 20, 14), 0, 0, -0.002, 0, 0, 0, [1.45, 1.0, 0.6]), '#1a1210'),
      part(at(new THREE.SphereGeometry(0.0155, 20, 14), 0, 0, 0.0015, 0, 0, 0, [1.35, 0.9, 0.55]), '#e8a032'),
      part(at(new THREE.SphereGeometry(0.0155, 12, 10), 0, 0, 0.0035, 0, 0, 0, [0.24, 0.66, 0.55]), '#0b0806'),
      part(at(new THREE.SphereGeometry(0.003, 8, 6), 0.006, 0.004, 0.0105), '#ffffff')].map(strip));
    const e = new THREE.Group(); e.position.set(sx * 0.041, 0.014, 0.066); e.rotation.set(0, sx * 0.5, -sx * 0.22); head.add(e);
    e.add(new THREE.Mesh(eg, EYE_M));
    // pálpebras de cima e de baixo (casquinhas da cor do pelo) — giram para piscar/estreitar
    const upG = vcolor(at(new THREE.SphereGeometry(0.0205, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, 0, -0.004, 0, 0, 0, [1.5, 1.05, 0.75]), c => c.copy(C.coat).lerp(C.sock, 0.25));
    const loG = vcolor(at(new THREE.SphereGeometry(0.0205, 20, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0, 0, -0.004, 0, 0, 0, [1.5, 1.05, 0.75]), c => c.copy(C.cream).lerp(C.coat, 0.3));
    const up = new THREE.Mesh(upG, lidMat), lo = new THREE.Mesh(loG, lidMat); e.add(up, lo);
    eyes.push({ e, up, lo, sx });
  }
  // orelhas altas em concha, pontas pretas, por dentro claras
  const earShape = new THREE.Shape(); earShape.moveTo(-0.042, 0); earShape.quadraticCurveTo(-0.04, 0.08, -0.004, 0.135); earShape.quadraticCurveTo(0, 0.142, 0.004, 0.135); earShape.quadraticCurveTo(0.04, 0.08, 0.042, 0); earShape.quadraticCurveTo(0, -0.01, -0.042, 0);
  let earOut = new THREE.ExtrudeGeometry(earShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3, curveSegments: 12 });
  { const P = earOut.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); P.setZ(k, P.getZ(k) - x * x * 9 * (1 - y * 4)); } }
  earOut = mergeVertices((earOut.deleteAttribute('uv'), earOut.deleteAttribute('normal'), earOut)); earOut.computeVertexNormals();
  vcolor(earOut, (c, x, y, z) => { c.copy(C.coat).lerp(C.sock, ss(0.075, 0.105, y)); if (z > 0.01) c.lerp(new THREE.Color('#efe2cf'), ss(0.08, 0.01, y) * 0.8); });
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.043, 0.046, -0.03); e.rotation.set(-0.2, sx * 0.28, -sx * 0.32); head.add(e);
    e.add(new THREE.Mesh(earOut, SKIN));
    return e;
  });
  // ---- patas: ombro/coxa com pelo, canela fina com "meia", pata com almofada e dedos ----
  const legs = [[-0.058, 0.17, true], [0.058, 0.17, true], [-0.062, -0.19, false], [0.062, -0.19, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, HIP, z); body.add(pv);
    const thigh = sculpt(26, 18, (v, xx, y, zz) => { const u = (1 - y) / 2; const r = front ? 0.038 * (1 - u * 0.5) : 0.054 * (1 - u * 0.58); v.set(xx * r * 0.85, y * (front ? 0.11 : 0.1) - (front ? 0.08 : 0.06), zz * r + (front ? 0 : -u * 0.05)); });
    const legCol = (c, xx, y) => c.copy(C.coat).lerp(C.dark, ss(-0.05, -0.15, y) * 0.45);
    vcolor(thigh, legCol); pv.add(new THREE.Mesh(thigh, SKIN));
    furShells(pv, thigh, { len: 0.014, den: 450, comb: [0, -1, -0.2], n: 7, tip: 0.15 });
    const knee = new THREE.Group(); knee.position.set(0, front ? -0.17 : -0.15, front ? 0 : -0.055); pv.add(knee);
    const shinPts = front ? [V3(0, 0.03, 0), V3(0, -0.1, 0.004), V3(0, -0.205, 0.008)] : [V3(0, 0.03, -0.004), V3(0, -0.1, 0.026), V3(0, -0.18, 0.052)];
    const shin = taper(shinPts, front ? 0.023 : 0.026, 0.016, 12, 14);
    vcolor(shin, (c, xx, y) => c.copy(C.coat).lerp(C.dark, ss(0.0, -0.08, y) * 0.5).lerp(C.sock, ss(-0.1, -0.16, y)));
    const cap = vcolor(strip(capSphere(front ? 0.02 : 0.022, 0, 0.03, front ? 0 : -0.004)), c => c.copy(C.coat));
    // pata: almofada oval + 4 dedos redondos à frente + "tornozelo" que liga na canela
    const py = front ? -0.214 : -0.188, pz = front ? 0.014 : 0.06;
    const pawParts = [at(new THREE.SphereGeometry(0.02, 16, 12), 0, py + 0.006, pz + 0.006, 0, 0, 0, [1.05, 0.6, 1.25]), at(new THREE.SphereGeometry(0.014, 12, 10), 0, py + 0.018, pz - 0.004)];
    for (let k = 0; k < 4; k++) pawParts.push(at(new THREE.SphereGeometry(0.0085, 12, 10), (k - 1.5) * 0.0095, py + 0.0025, pz + 0.026 - Math.abs(k - 1.5) * 0.004, 0, 0, 0, [1, 0.75, 1.25]));
    const paw = pawParts.map(g => vcolor(strip(g), c => c.copy(C.sock)));
    const shinM = weld(mergeGeometries([strip(shin), cap]));
    knee.add(new THREE.Mesh(shinM, SKIN), new THREE.Mesh(mergeGeometries(paw), SKIN));
    furShells(knee, shinM, { len: 0.008, den: 550, comb: [0, -1, 0], n: 5 });
    return { pv, knee, front, x, idx: front ? (x < 0 ? 0 : 1) : (x < 0 ? 2 : 3) };
  });
  // ---- caudas com física própria (nunca se atravessam) e fogo de partículas na ponta ----
  const tails = [], nT = stage + 1, spreadMax = nT === 1 ? 0 : nT === 2 ? 0.38 : 0.72;
  for (let i = 0; i < nT; i++) {
    const rest = nT === 1 ? 0 : (i / (nT - 1) - 0.5) * 2 * spreadMax, thin = nT === 3 ? 0.74 : nT === 2 ? 0.86 : 1;
    const base = new THREE.Group(); base.position.set(Math.sin(rest) * 0.08, HIP + 0.03 + (nT === 3 && i === 1 ? 0.015 : 0), -0.23); body.add(base);
    const mid = new THREE.Group(); mid.position.set(0, -0.06, -0.125); base.add(mid);
    const tg1 = sculpt(22, 16, (v, x, y, z) => { const u = (1 - z) / 2; const r = (0.03 + 0.024 * u) * thin; v.set(x * r, y * r - u * 0.07 + 0.01, z * 0.08 - 0.065); });
    const tg2 = sculpt(26, 20, (v, x, y, z) => { const u = (1 - z) / 2; const r = (0.06 * Math.sin(Math.PI * (0.22 + u * 0.7)) + 0.012) * thin; v.set(x * r, y * r + u * u * 0.045, z * 0.115 - 0.1); });
    const tailCol = (c, x, y, z) => c.copy(C.coat).lerp(new THREE.Color(stage === 2 ? '#ffd27a' : '#ffb040'), ss(-0.12, -0.2, z) * 0.8);
    vcolor(tg1, tailCol); vcolor(tg2, tailCol);
    base.add(new THREE.Mesh(tg1, SKIN)); mid.add(new THREE.Mesh(tg2, SKIN));
    furShells(base, tg1, { len: 0.016, den: 560, comb: [0, -0.2, -1], n: 9, tip: 0.2, lenFn: (x, y, z) => ss(-0.02, -0.06, z) * 0.8 + 0.2 });
    furShells(mid, tg2, { len: 0.03, den: 560, comb: [0, 0.1, -1], n: 12, tip: 0.3, lenFn: (x, y, z) => 1 - ss(-0.15, -0.21, z) * 0.85 }); // fios encurtam na ponta (sem "dente-de-leão")
    const fl = new THREE.Group(); fl.position.set(0, 0.04, -0.2); mid.add(fl);
    // S-266: o fogo da cauda cresce com a evolução — Faísca chama pequena, Labareda média, Solaris grande
    const FS = [{ n: 50, r0: 0.02, rise: 0.12, size: 0.12, life: 0.45 }, { n: 75, r0: 0.026, rise: 0.24, size: 0.15, life: 0.6 }, { n: 95, r0: 0.032, rise: 0.36, size: 0.17, life: 0.7 }][stage];
    const fire = makeFire(FS.n, { r0: FS.r0 * thin, rise: FS.rise, life: FS.life, size: FS.size, hot: stage === 2, core: true });
    fl.add(fire.obj);
    tails.push({ base, mid, fl, fire, rest, yb: rest, vb: 0, ym: 0, vm: 0, pb: 0, vpb: 0, ph: i * 1.9 });
  }
  // brasas na juba (Labareda/Solaris) e na ponta das orelhas (Solaris)
  const neckFire = stage >= 1 ? makeFire(stage === 2 ? 30 : 18, { ring: 0.06, r0: 0.02, rise: 0.09, life: 0.45, size: 0.028, hot: stage === 2 }) : null;
  if (neckFire) { neckFire.obj.position.set(0, 0.08, -0.01); neck.add(neckFire.obj); }
  const earFires = stage === 2 ? ears.map(e => { const f = makeFire(10, { r0: 0.006, rise: 0.06, life: 0.35, size: 0.022, hot: true }); f.obj.position.y = 0.13; e.add(f.obj); return f; }) : [];
  let light = null; if (stage >= 1) { light = vlight(stage === 2 ? '#ffb04a' : '#ff8a3a', stage === 2 ? 1.3 : 0.75, 4); light.position.set(0, 0.6, -0.35); root.add(light); }
  shadows(root);
  const gait = makeGait(0.4, { Amax: 0.6, fMin: 1.4 });
  let look = 0, atk = -9, T = 0, blink = 1.5, mood = 0, pant = 0, prevTurn = 0;
  return { root, attack() { atk = T; }, animate(t, m, dt) {
    T = t; const v = m.speed * PET_VMAX / scale, a = strike((t - atk) / 0.55), A = Math.max(0, a);
    const st = gait.step(v, dt), moving = st.v > 0.05, run = clamp(st.v / 4, 0, 1);
    // patas: quadril varre (pata plantada), joelho dobra no passo
    let lowest = 0;
    for (const L of legs) {
      const c = gait.leg(L.idx), hip = -c.sw * st.A;
      L.pv.rotation.x = hip + (L.front ? -A * 0.9 : A * 0.5);
      const flex = c.lift * (0.35 + st.A * 0.8) + (c.stance ? 0.05 : 0);
      L.knee.rotation.x = (L.front ? flex : -flex) + (L.front ? A * 0.4 : -A * 0.3) - hip * (L.front ? 0.0 : 0.35);
      lowest = Math.max(lowest, (1 - Math.cos(hip)) * 0.38);
    }
    // corpo: abaixa o que a pata "encurta" ao girar (pés no chão), sobe e desce com a passada
    const bob = moving ? Math.cos(st.cyc * Math.PI * 4) * 0.008 * Math.min(1, st.A * 2) : 0;
    body.position.y = -lowest * 0.75 + bob + Math.sin(t * 2.2) * 0.002 * (1 - run) - Math.min(0, a) * 0.08 + A * 0.05;
    body.position.z = A * 0.22;
    body.rotation.x = Math.sin(st.cyc * Math.PI * 2) * 0.07 * st.gallop - run * 0.04 + Math.min(0, a) * -0.25 + A * 0.18; // galope: coluna ondula
    body.rotation.z = -m.turn * 0.04 * run;
    look = smooth(look, moving ? -m.turn * 0.12 : Math.sin(t * 0.6) * 0.35 + Math.sin(t * 1.7) * 0.08, dt, 4);
    neck.rotation.y = look * (1 - A); neck.rotation.x = Math.cos(st.cyc * Math.PI * 4) * 0.04 * run + A * 0.45 + Math.sin(t * 1.1) * 0.03 * (1 - run);
    head.rotation.z = Math.sin(t * 0.9) * 0.1 * (1 - run);
    // expressão: ofega correndo (boca aberta + língua), morde no ataque, pisca, estreita os olhos ao atacar
    pant = smooth(pant, run > 0.55 ? 1 : 0, dt, 2);
    jaw.rotation.x = A * 0.7 + pant * (0.22 + Math.sin(t * 14) * 0.05);
    tongue.visible = pant > 0.2 || A > 0.3; tongue.position.z = 0.085 + pant * 0.012;
    blink -= dt; const bl = blink < 0.13 ? Math.sin(Math.max(0, blink) / 0.13 * Math.PI) : 0; if (blink < 0) blink = 2 + rnd() * 3.5;
    mood = smooth(mood, A > 0 ? 1 : 0, dt, 10);
    for (const E of eyes) { E.up.rotation.x = -0.15 + bl * 1.25 + mood * 0.55; E.lo.rotation.x = 0.15 - bl * 0.3 - mood * 0.2; }
    ears.forEach((e, i) => { e.rotation.x = -0.2 - 0.35 * run - A * 0.45 + Math.sin(t * 2.3 + i * 2) * 0.04 + (Math.sin(t * 0.37 + i) > 0.97 ? 0.25 : 0); });
    // caudas: mola + amortecimento, reagem à curva e à corrida; separação mínima entre elas
    const turnAcc = (m.turn - prevTurn) / Math.max(dt, 1e-3); prevTurn = m.turn;
    for (const T2 of tails) {
      const wag = Math.sin(t * (2 + run * 3) + T2.ph) * (0.18 - run * 0.08);
      const tb = T2.rest + wag + m.turn * 0.1;
      T2.vb += ((tb - T2.yb) * 60 - T2.vb * 9 - turnAcc * 0.004) * dt; T2.yb += T2.vb * dt;
      const tm = Math.sin(t * (2 + run * 3) + T2.ph - 0.9) * 0.3 + T2.vb * -0.08;
      T2.vm += ((tm - T2.ym) * 45 - T2.vm * 7) * dt; T2.ym += T2.vm * dt;
      const tp = -0.12 + 0.3 * run - A * 0.3 + Math.sin(st.cyc * Math.PI * 4) * 0.05 * run;
      T2.vpb += ((tp - T2.pb) * 50 - T2.vpb * 8) * dt; T2.pb += T2.vpb * dt;
    }
    for (let i = 1; i < tails.length; i++) { // nunca se cruzam: empurra os vizinhos até a distância mínima
      const A0 = tails[i - 1], A1 = tails[i], minB = 0.55, minM = 0.5;
      const db = A1.yb - A0.yb; if (db < minB) { const d = (minB - db) / 2; A0.yb -= d; A1.yb += d; A0.vb = Math.min(A0.vb, 0); A1.vb = Math.max(A1.vb, 0); }
      const dm = (A1.yb + A1.ym) - (A0.yb + A0.ym); if (dm < minM) { const d = (minM - dm) / 2; A0.ym -= d; A1.ym += d; }
    }
    for (const T2 of tails) {
      T2.base.rotation.set(T2.pb, T2.yb, 0); T2.mid.rotation.set(0.08 * run, T2.ym, 0);
      T2.fl.rotation.x = -(T2.pb + 0.08 * run) - body.rotation.x; T2.fl.rotation.y = -(T2.yb + T2.ym); // a chama sempre sobe
      T2.fire.update(t, dt, st.v * 0.05 * scale, 1);
    }
    if (neckFire) neckFire.update(t, dt, st.v * 0.02, 1);
    earFires.forEach(f => f.update(t, dt, 0, 1));
    if (light) light.intensity = (stage === 2 ? 1.3 : 0.75) + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.08;
  } };
}

/* =========================================================================
   Bolhinha → Maré → Aquária (bolha d'água curandeira) — S-111, S-142
   Corpo de água molenga: geleia com mola (estica ao acelerar, achata ao pousar, treme ao parar),
   anda pulando; rosto expressivo; nadadeiras de água com ondulação; sinal de cura na testa.
   ========================================================================= */
const RIM_VS = `uniform float uT; uniform float uW; varying vec3 vN; varying vec3 vV; void main(){ vec3 pp = position + normal * (sin(position.x * 38.0 + uT * 3.1) * sin(position.y * 31.0 + uT * 2.3) * uW); vec4 p = vec4(pp, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
 p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
 vec4 mv = modelViewMatrix * p; vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const RIM_FS = `uniform vec3 uCol; uniform float uPow; uniform float uAmt; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uCol * f * uAmt, f * uAmt); }`;
const rimMat = (col, pow = 2.5, amt = 1, uT = { value: 0 }, uW = { value: 0 }) => new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) }, uPow: { value: pow }, uAmt: { value: amt }, uT, uW }, vertexShader: RIM_VS, fragmentShader: RIM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
// água: vidro molhado com cor por vértice (mais clara em cima, azul fundo embaixo) e superfície que treme (vertex)
function waterMat(uT, uW, op = 0.55) {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, transparent: true, opacity: op, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.35, iridescenceIOR: 1.3, specularIntensity: 1, depthWrite: false });
  m.onBeforeCompile = sh => { sh.uniforms.uT = uT; sh.uniforms.uW = uW; sh.vertexShader = 'uniform float uT; uniform float uW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * (sin(position.x * 38.0 + uT * 3.1) * sin(position.y * 31.0 + uT * 2.3) * uW);'); };
  m.customProgramCacheKey = () => 'petWater'; return m;
}
const dropGeo = (r = 1) => sculpt(20, 16, (v, x, y, z) => { const t = (y + 1) / 2, k = t > 0.5 ? Math.pow(1 - (t - 0.5) * 2, 0.9) * 0.9 + 0.1 * (1 - (t - 0.5) * 2) : 1; v.set(x * r * (t > 0.5 ? k : 1), (y + (t > 0.5 ? (t - 0.5) * 1.3 : 0)) * r, z * r * (t > 0.5 ? k : 1)); });
/* ---- S-269: asas de fada (membrana translúcida com nervuras que brilham) e coroa de cura que muda a cada evolução ---- */
const WING_TEX = {};
function wingTex(kind) {
  if (WING_TEX[kind]) return WING_TEX[kind];
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const col = kind === 2 ? ['rgba(230,255,248,0.62)', 'rgba(150,240,255,0.32)', 'rgba(255,240,200,0.9)'] : ['rgba(220,252,255,0.55)', 'rgba(140,220,255,0.26)', 'rgba(230,255,255,0.85)'];
  const g = x.createRadialGradient(0, S, 0, 0, S, S * 1.35); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = col[2]; x.lineCap = 'round';
  for (let k = 0; k < 7; k++) { const a = -0.08 + k * 0.25; x.lineWidth = 3.2 - k * 0.25; x.beginPath(); x.moveTo(0, S); x.bezierCurveTo(S * 0.3 * Math.cos(a), S - S * 0.35 * Math.sin(a + 0.5), S * 0.7 * Math.cos(a), S - S * 0.75 * Math.sin(a + 0.15), S * 1.05 * Math.cos(a), S - S * 1.05 * Math.sin(a)); x.stroke(); }
  x.lineWidth = 1; x.globalAlpha = 0.55; for (let k = 0; k < 40; k++) { const r = 40 + Math.random() * 200, a0 = Math.random() * 1.5; x.beginPath(); x.arc(0, S, r, -a0 - 0.12, -a0); x.stroke(); } // nervurinhas cruzadas
  x.globalAlpha = 1; for (let k = 0; k < 26; k++) { x.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.random() * 0.5) + ')'; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 0, 7); x.fill(); } // brilho de pó de fada
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (WING_TEX[kind] = t);
}
function wingGeo(fore, len) { // asa como forma lisa (contorno curvo); UV normalizado no quadrado da textura (raiz no canto de baixo)
  const s = new THREE.Shape();
  if (fore) { s.moveTo(0, 0); s.bezierCurveTo(0.18, 0.32, 0.55, 0.95, 0.92, 1.0); s.bezierCurveTo(1.08, 1.0, 1.05, 0.8, 0.9, 0.62); s.bezierCurveTo(0.7, 0.34, 0.38, 0.1, 0, 0); }
  else { s.moveTo(0, 0); s.bezierCurveTo(0.35, 0.02, 0.78, -0.12, 0.82, -0.38); s.bezierCurveTo(0.84, -0.6, 0.6, -0.62, 0.42, -0.45); s.bezierCurveTo(0.25, -0.3, 0.08, -0.12, 0, 0); }
  const g = new THREE.ShapeGeometry(s, 18), P = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) { const X = P.getX(i), Y = P.getY(i); uv.setXY(i, Math.min(1, Math.abs(X)), fore ? Math.min(1, Y) : Math.min(1, -Y)); P.setXYZ(i, X * len, Y * len, Math.sin(X * 2.4) * len * 0.06); } // leve curva na membrana
  g.computeVertexNormals(); return g;
}
function healingCrown(stage, R) {
  const g = new THREE.Group(), LEAF = mat('#5ad08a', { roughness: 0.45, emissive: '#1a7a4a', emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const leafS = new THREE.Shape(); leafS.moveTo(0, 0); leafS.quadraticCurveTo(0.02, 0.025, 0, 0.06); leafS.quadraticCurveTo(-0.02, 0.025, 0, 0);
  const leafG = new THREE.ExtrudeGeometry(leafS, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 10 });
  const stem = new THREE.Mesh(taper([V3(0, -0.01, 0), V3(0.004, 0.02, 0), V3(-0.002, 0.04, 0.002)], 0.0035, 0.0022, 10, 8), mat('#4aa86a', { roughness: 0.6 })); g.add(stem);
  if (stage === 0) { // Bolhinha: brotinho de duas folhas
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(leafG, LEAF); l.position.set(0, 0.038, 0); l.rotation.set(0.2, sx > 0 ? 0 : Math.PI, -sx * 0.9); g.add(l); }
    return { g, petals: [] };
  }
  // Maré: botão de flor de cura (5 pétalas meio abertas) · Aquária: lótus aberta com 8 + 5 pétalas e centro luminoso
  const PET = new THREE.MeshPhysicalMaterial({ color: stage === 2 ? '#fff4fb' : '#ffe0ef', emissive: stage === 2 ? '#ff9ad0' : '#d86aa0', emissiveIntensity: stage === 2 ? 0.35 : 0.2, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide });
  const petG = sculpt(16, 12, (v, x, y, z) => { const u = (y + 1) / 2; v.set(x * 0.017 * Math.sin(Math.PI * Math.min(1, u * 1.1)), u * 0.05, z * 0.004 + x * x * 0.008 - u * u * 0.006); });
  const petals = [], rings = stage === 2 ? [[8, 0.95, 0.02], [5, 0.45, 0.01]] : [[5, 0.25, 0.0]];
  for (const [n, open, r0] of rings) for (let k = 0; k < n; k++) { const p = new THREE.Group(); p.position.set(0, 0.04, 0); p.rotation.y = k / n * Math.PI * 2 + (n === 5 && stage === 2 ? 0.3 : 0); const m = new THREE.Mesh(petG, PET); m.position.z = r0; m.rotation.x = open; p.add(m); g.add(p); petals.push({ m, open }); }
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(leafG, LEAF); l.position.set(0, 0.03, 0); l.rotation.set(0.3, sx > 0 ? 0.4 : Math.PI + 0.4, -sx * 1.2); l.scale.setScalar(1.1); g.add(l); }
  const core = new THREE.Mesh(new THREE.SphereGeometry(stage === 2 ? 0.013 : 0.009, 14, 10), glow(stage === 2 ? '#fff6b0' : '#ffe08a', stage === 2 ? 1.6 : 0.9)); core.position.y = 0.046; g.add(core);
  return { g, petals, core };
}
function waterSprite(stage, scale) {
  SEED = 777 + stage * 31;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const R = 0.2, cy = R * 0.98, uT = { value: 0 }, uW = { value: 0.002 };
  const top = new THREE.Color(['#bff0ff', '#a8e6ff', '#9ad8ff'][stage]), deep = new THREE.Color(['#2a9ad8', '#1f82d0', '#2a5ad0'][stage]), rimC = ['#9ff0ff', '#7fe0ff', '#9ac8ff'][stage];
  const jelly = new THREE.Group(); jelly.position.y = cy; body.add(jelly); // o grupo que estica/achata
  const bodyG = sculpt(56, 42, (v, x, y, z) => { const b = y < 0 ? 1 - 0.14 * y * y : 1; v.set(x * R * b, y * R * (y < 0 ? 0.9 : 1.02), z * R * b); });
  vcolor(bodyG, (c, x, y, z) => { c.copy(deep).lerp(top, ss(-R * 0.9, R * 0.8, y)); c.lerp(new THREE.Color('#ffffff'), ss(R * 0.6, R, y) * 0.25); });
  const skin = new THREE.Mesh(bodyG, waterMat(uT, uW, 0.6)); skin.renderOrder = 3; skin.userData.noShadow = true; jelly.add(skin);
  const rim = new THREE.Mesh(bodyG, rimMat(rimC, 2.1, 0.9, uT, uW)); rim.scale.setScalar(1.004); rim.renderOrder = 4; rim.userData.noShadow = true; jelly.add(rim);
  // brilho de luz na "pele" (reflexo da janela) — dá ar de líquido
  const spec = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
  spec.scale.set(1.5, 0.8, 0.3); spec.position.set(-R * 0.45, R * 0.62, R * 0.62); spec.lookAt(spec.position.clone().multiplyScalar(2)); spec.renderOrder = 6; jelly.add(spec);
  // ---- sinal de cura na testa: folhinha dupla + gota, verde-água luminoso, colado na pele ----
  const emb = new THREE.Group(); { const a = 0, b = 0.62; emb.position.set(Math.sin(a) * Math.cos(b) * R, Math.sin(b) * R, Math.cos(a) * Math.cos(b) * R); emb.lookAt(emb.position.clone().multiplyScalar(2)); } jelly.add(emb);
  const leaf = new THREE.Shape(); leaf.moveTo(0, -0.03); leaf.quadraticCurveTo(0.024, -0.004, 0, 0.03); leaf.quadraticCurveTo(-0.024, -0.004, 0, -0.03);
  const leafG = new THREE.ExtrudeGeometry(leaf, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 12 });
  const EMB = glow('#6affc0', 1.0, { transparent: true, opacity: 0.9 });
  emb.add(merged([leafG.clone().rotateZ(0.65).translate(0.008, 0.002, 0), leafG.clone().rotateZ(-0.65).translate(-0.008, 0.002, 0)], EMB));
  // ---- rosto expressivo ----
  const face = new THREE.Group(); jelly.add(face);
  const EYE = mat('#0d2440', { roughness: 0.06, metalness: 0.1 }), GL = new THREE.MeshBasicMaterial({ color: '#ffffff' }), LID = new THREE.MeshStandardMaterial({ color: '#8ad6f2', roughness: 0.2 });
  const HAPPY = new THREE.MeshBasicMaterial({ color: '#0d2440' });
  const onFace = (a, b, r = R) => { const g = new THREE.Group(); g.position.set(Math.sin(a) * Math.cos(b) * r, Math.sin(b) * r, Math.cos(a) * Math.cos(b) * r); g.lookAt(g.position.clone().multiplyScalar(2)); face.add(g); return g; };
  const eyes = [-1, 1].map(sx => {
    const e = onFace(sx * 0.34, 0.14);
    const ball = new THREE.Group(); e.add(ball);
    ball.add(merged([at(new THREE.SphereGeometry(0.03, 24, 18), 0, 0, -0.008, 0, 0, 0, [0.8, 1.05, 0.4])], EYE));
    // S-269: olho vivo — íris colorida com pupila (que se mexe olhando em volta), cílios de fada e sobrancelha que expressa
    const iris = new THREE.Group(); iris.position.z = 0.0042; ball.add(iris);
    const IR = new THREE.MeshBasicMaterial({ color: ['#2ab8c8', '#2aa8d8', '#7a6ae0'][stage] }), PU = new THREE.MeshBasicMaterial({ color: '#06121c' });
    const irD = new THREE.Mesh(new THREE.CircleGeometry(0.0165, 28), IR); irD.scale.set(0.85, 1.05, 1); iris.add(irD);
    const irIn = new THREE.Mesh(new THREE.RingGeometry(0.009, 0.0165, 28), new THREE.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: 0.35 })); irIn.scale.set(0.85, 1.05, 1); irIn.position.z = 0.0002; iris.add(irIn);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 20), PU); pu.position.z = 0.0004; pu.scale.set(0.85, 1.05, 1); iris.add(pu);
    const lashes = merged([0, 1, 2].map(k => taper([V3(sx * (0.008 + k * 0.007), 0.028 - k * 0.003, 0), V3(sx * (0.013 + k * 0.009), 0.036 - k * 0.002, 0.003), V3(sx * (0.018 + k * 0.011), 0.04 - k * 0.003, 0.002)], 0.0016, 0.0003, 6, 5)), new THREE.MeshBasicMaterial({ color: '#0d2440' })); e.add(lashes);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0024, 6, 16, Math.PI * 0.7), new THREE.MeshBasicMaterial({ color: '#2a6a8a' })); brow.position.set(0, 0.048, 0.002); brow.rotation.z = Math.PI * 0.15; e.add(brow);
    e.userData = { iris, brow };
    const hi = merged([at(new THREE.SphereGeometry(0.0095, 10, 8), sx * -0.007, 0.012, 0.006), at(new THREE.SphereGeometry(0.0045, 8, 6), sx * 0.008, -0.011, 0.007)], GL); ball.add(hi);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.034, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), LID); lid.scale.set(0.86, 1.05, 0.5); lid.position.z = -0.006; lid.userData.noShadow = true; e.add(lid);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0035, 8, 20, Math.PI), HAPPY); arc.position.set(0, -0.004, 0.004); arc.visible = false; e.add(arc); // olhinho fechado de alegria (^)
    return { e, ball, hi, lid, arc, sx, iris, brow, lashes };
  });
  const cheeks = [-1, 1].map(sx => { const c = onFace(sx * 0.55, -0.04, R * 0.995); const m = new THREE.Mesh(new THREE.CircleGeometry(0.02, 20), new THREE.MeshBasicMaterial({ color: '#ff9ac0', transparent: true, opacity: 0.35, depthWrite: false })); m.scale.set(1.3, 0.75, 1); c.add(m); return m; });
  const mouthG = onFace(0, -0.11, R * 1.002);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 8, 24, Math.PI * 0.8), mat('#0d2440', { roughness: 0.3 })); smile.rotation.z = Math.PI + Math.PI * 0.1; mouthG.add(smile);
  const open = new THREE.Group(); mouthG.add(open);
  open.add(new THREE.Mesh(new THREE.CircleGeometry(0.016, 24), new THREE.MeshBasicMaterial({ color: '#16304a' })));
  const tg = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), new THREE.MeshBasicMaterial({ color: '#ff8aa8' })); tg.position.set(0, -0.007, 0.0005); tg.scale.set(1.2, 0.6, 1); open.add(tg);
  // ---- nadadeiras de água (lisas, translúcidas, com borda clara) ----
  const finG = (() => { const g = sculpt(22, 16, (v, x, y, z) => { const u = (x + 1) / 2; const w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * 0.25); v.set(u * 0.12, y * 0.045 * w + Math.sin(u * 3.4) * 0.012 * u, z * 0.006 * w); }); return g; })();
  vcolor(finG, (c, x) => c.copy(top).lerp(new THREE.Color('#ffffff'), ss(0.06, 0.12, x) * 0.6));
  const FIN = waterMat(uT, { value: 0 }, 0.5); FIN.emissive = new THREE.Color('#5ac8f0'); FIN.emissiveIntensity = 0.45; // não fica cinza visto através do corpo
  const fins = [-1, 1].map(sx => { const f = new THREE.Group(); f.position.set(sx * R * 0.93, -0.02, 0.02); jelly.add(f); const m = new THREE.Mesh(finG, FIN); m.scale.set(sx * (1 + stage * 0.3), 1 + stage * 0.25, 1); m.rotation.z = sx * -0.25; m.renderOrder = 5; m.userData.noShadow = true; f.add(m); return { f, sx }; });
  // ---- S-269: fada da cura — asas (crescem e se multiplicam a cada evolução), coroa de cura e pó de fada ----
  const WING_M = new THREE.MeshStandardMaterial({ map: wingTex(stage === 2 ? 2 : 1), emissiveMap: wingTex(stage === 2 ? 2 : 1), emissive: new THREE.Color(stage === 2 ? '#bff0ff' : '#9ae8ff'), emissiveIntensity: 0.35 + stage * 0.25, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 });
  const wingSet = [[true, [0.13, 0.19, 0.27][stage]], ...(stage >= 1 ? [[false, [0, 0.13, 0.19][stage]]] : [])];
  const wings = [];
  for (const [fore, len] of wingSet) for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * R * 0.42, R * (fore ? 0.42 : 0.2), -R * 0.72); jelly.add(w);
    const m = new THREE.Mesh(wingGeo(fore, len), WING_M); m.scale.x = sx; m.renderOrder = 6; m.userData.noShadow = true; w.add(m);
    wings.push({ w, sx, fore });
  }
  const crown = healingCrown(stage, R); crown.g.position.set(0, R * 0.97, 0.01); crown.g.scale.setScalar([0.9, 1.05, 1.25][stage]); jelly.add(crown.g);
  const dust = makeFire([10, 20, 36][stage], { ring: R * 0.9, r0: 0.02, rise: 0.22, life: 1.4, size: 0.035 + stage * 0.006, pal: ['#ffffff', '#c8fff0', '#7ad8ff'] }); dust.obj.position.y = 0.04; body.add(dust.obj);
  // Maré: anel de água ondulado em volta; Aquária: auréola de água com uma pérola (nada pontudo)
  let wave = null, halo = null;
  if (stage >= 1) {
    const wg = new THREE.TorusGeometry(R * 1.22, 0.011 + stage * 0.003, 12, 96).rotateX(Math.PI / 2), WP = wg.attributes.position; for (let k = 0; k < WP.count; k++) { const a = Math.atan2(WP.getZ(k), WP.getX(k)); WP.setY(k, WP.getY(k) + Math.sin(a * 3) * 0.022); } wg.computeVertexNormals();
    wave = new THREE.Mesh(wg, new THREE.MeshPhysicalMaterial({ color: '#a8ecff', transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, emissive: '#3ab0e0', emissiveIntensity: 0.45, depthWrite: false }));
    wave.position.y = -0.06; wave.renderOrder = 5; wave.userData.noShadow = true; body.add(wave);
  }
  if (stage === 2) {
    halo = new THREE.Group(); body.add(halo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 14, 64), new THREE.MeshPhysicalMaterial({ color: '#c8f4ff', transparent: true, opacity: 0.7, roughness: 0.03, clearcoat: 1, emissive: '#4ac0ff', emissiveIntensity: 0.6, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; halo.add(ring);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 14), glow('#bfffe8', 1.2)); pearl.position.set(0, 0.0, 0.085); halo.add(pearl);
  }
  // bolhinhas em órbita e gotas de cura
  const nOrb = [3, 5, 7][stage], orbs = [], ORB = waterMat(uT, { value: 0 }, 0.3);
  const og = new THREE.SphereGeometry(1, 16, 12); vcolor(og, (c, x, y) => c.copy(top).lerp(new THREE.Color('#ffffff'), y > 0.5 ? 0.5 : 0));
  const orbM = new THREE.InstancedMesh(og, ORB, nOrb); orbM.frustumCulled = false; orbM.renderOrder = 6; body.add(orbM);
  for (let i = 0; i < nOrb; i++) orbs.push({ r: 0.016 + rnd() * 0.016, off: i / nOrb * Math.PI * 2, rad: 0.28 + rnd() * 0.05, h: rnd() * 0.1, sp: 0.5 + rnd() * 0.4 });
  const OM = new THREE.Matrix4();
  const drips = [], DR = glow('#7affc8', 1.1, { transparent: true, opacity: 0.9 }), dg2 = dropGeo(1);
  for (let i = 0; i < 2 + stage; i++) { const d = new THREE.Mesh(dg2, DR); d.rotation.x = Math.PI; d.userData.noShadow = true; body.add(d); drips.push({ d, off: i / (2 + stage), x: (rnd() - 0.5) * 0.12, z: (rnd() - 0.5) * 0.1 }); }
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: '#8affd0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pulse.rotation.x = Math.PI / 2; pulse.userData.noShadow = true; body.add(pulse);
  const blobShadow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ color: '#06202a', transparent: true, opacity: 0.28, depthWrite: false })); blobShadow.rotation.x = -Math.PI / 2; blobShadow.position.y = 0.006; root.add(blobShadow);
  const light = vlight('#7affd8', 0.45 + stage * 0.3, 3.5); light.position.y = cy; root.add(light);
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  // estado da geleia
  const J = { sy: 0, vy: 0, sz: 0, vz: 0, lx: 0, vlx: 0, prevV: 0, hop: 0, air: 0, land: 0 };
  let atk = -9, T = 0, blink = 2, expr = 'idle', exprT = 3, look = 0, lookY = 0, sacT = 1, sacX = 0, sacY = 0;
  return { root, attack() { atk = T; }, animate(t, m, dt) {
    T = t; uT.value = t; const v = m.speed * PET_VMAX / scale, k = (t - atk) / 0.7, P = k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
    // aceleração alimenta a mola de esticar/achatar (geleia)
    const acc = (v - J.prevV) / Math.max(dt, 1e-3); J.prevV = v;
    J.vz += (-J.sz * 140 - J.vz * 9 + clamp(acc, -40, 40) * 0.012) * dt; J.sz += J.vz * dt;
    J.vlx += (-J.lx * 120 - J.vlx * 8 + m.turn * v * 0.02) * dt; J.lx += J.vlx * dt;
    // pulos: com velocidade, quica no chão em ciclos (pouso achata, decolagem estica)
    let y = 0;
    if (v > 0.15) {
      const f = clamp(1.6 + v * 0.35, 1.6, 4.2); J.hop += f * dt; const u = fract(J.hop);
      const air = u < 0.72 ? Math.sin(u / 0.72 * Math.PI) : 0; y = air * (0.05 + Math.min(0.08, v * 0.012));
      if (u >= 0.72 && J.air > 0.02) J.vy -= 3.2; // impacto: comprime
      J.air = air;
    } else { J.air = 0; y = Math.sin(t * 2.1) * 0.006; }
    J.vy += (-J.sy * 160 - J.vy * 7) * dt + (v > 0.15 && J.air > 0.3 ? 0.9 * dt * 10 : 0) * 0.1; J.sy += J.vy * dt;
    // tremidinha quando para de repente
    uW.value = 0.0018 + Math.min(0.006, Math.abs(J.vz) * 0.004 + Math.abs(J.vy) * 0.002) + P * 0.003;
    const sY = 1 + J.sy - Math.abs(J.sz) * 0.4 - P * 0.08, sZ = 1 + J.sz + (J.air > 0.3 ? 0.06 : 0), sX = 1 / Math.sqrt(Math.max(0.5, sY * sZ));
    jelly.scale.set(sX + P * 0.06, sY, sZ);
    jelly.position.y = cy * sY + y; // base fica no chão quando achata
    jelly.rotation.z = J.lx * 0.6 - m.turn * 0.03; jelly.rotation.x = -J.sz * 0.6 - (v > 0.15 ? 0.08 : 0);
    // olhar e expressões
    exprT -= dt; if (exprT < 0) { const r = rnd(); expr = r < 0.55 ? 'idle' : r < 0.8 ? 'happy' : r < 0.92 ? 'oh' : 'curious'; exprT = 2 + rnd() * 3; }
    const e = P > 0 ? 'happy' : v > 2.5 ? 'focus' : expr;
    look = smooth(look, v > 0.15 ? -m.turn * 0.1 : Math.sin(t * 0.5) * 0.25 + (e === 'curious' ? 0.2 : 0), dt, 3); lookY = smooth(lookY, e === 'curious' ? 0.15 : 0, dt, 3);
    face.rotation.y = look; face.rotation.x = -lookY;
    blink -= dt; const bl = blink < 0.12 ? Math.sin(Math.max(0, blink) / 0.12 * Math.PI) : 0; if (blink < 0) blink = 2 + rnd() * 3;
    const happy = e === 'happy';
    for (const E of eyes) {
      E.ball.visible = !happy; E.lid.visible = !happy; E.arc.visible = happy;
      E.lid.rotation.x = -1.45 + bl * 1.45 + (e === 'focus' ? 0.45 : 0); // pálpebra sobe (aberto) / desce (pisca)
      E.ball.scale.set(1, e === 'oh' ? 1.12 : 1, 1); E.hi.position.x = look * -0.02;
      E.iris.position.x = sacX * 0.006; E.iris.position.y = sacY * 0.005; // olhar passeia (sacadas)
      E.brow.position.y = 0.048 + (e === 'curious' || e === 'oh' ? 0.007 : happy ? 0.004 : e === 'focus' ? -0.004 : 0) + Math.sin(t * 0.9) * 0.0012;
      E.brow.rotation.z = Math.PI * 0.15 + (e === 'focus' ? -E.sx * 0.25 : e === 'curious' ? E.sx * 0.15 : 0);
    }
    sacT -= dt; if (sacT < 0) { sacT = 0.6 + rnd() * 1.8; sacX = (rnd() - 0.5) * 2; sacY = (rnd() - 0.5) * 1.2; }
    face.rotation.z = Math.sin(t * 0.7) * 0.07 + (e === 'curious' ? 0.18 : 0); // inclina a cabeça (nada de rosto parado)
    smile.visible = e !== 'oh' && !(happy && P > 0); smile.scale.set(happy ? 1.35 : e === 'focus' ? 0.8 : 1, happy ? 1.2 : 1, 1);
    const op = happy && P > 0 ? 1 : e === 'oh' ? 0.8 : 0; open.visible = op > 0; open.scale.set(op ? 1 : 0.01, op ? (e === 'oh' ? 1.1 : 0.8) : 0.01, 1);
    cheeks.forEach(c => { c.material.opacity = happy ? 0.55 : 0.32; });
    // nadadeiras remam (onda), mais forte ao andar
    fins.forEach(({ f, sx }) => { f.rotation.z = sx * (Math.sin(t * (3 + v * 2)) * (0.25 + Math.min(0.3, v * 0.08)) + 0.12 - P * 0.5); f.rotation.y = sx * (0.25 + Math.min(0.5, v * 0.12)); });
    if (wave) { wave.rotation.y = t * 0.8; wave.position.y = jelly.position.y - 0.06 * sY + Math.sin(t * 2.2) * 0.01; }
    // asas de fada: batem rápido (zumbido) ao andar, devagar e abertas parada; abrem no ataque/cura
    const flapF = v > 0.15 ? 16 : 5, flapA = v > 0.15 ? 0.32 : 0.14;
    wings.forEach(({ w, sx, fore }) => { const f = Math.sin(t * flapF + (fore ? 0 : 0.6)); w.rotation.set(fore ? -0.15 : 0.2, sx * (0.32 + f * flapA - P * 0.3), sx * (fore ? -0.1 : 0.15)); });
    crown.petals.forEach(p => { p.m.rotation.x = p.open * (1 + Math.sin(t * 1.3) * 0.06) + P * 0.3; });
    if (crown.core) crown.core.material.emissiveIntensity = (stage === 2 ? 1.6 : 0.9) + Math.sin(t * 3) * 0.25 + P * 1.5;
    crown.g.rotation.z = Math.sin(t * 1.7) * 0.08 - J.lx * 0.5;
    dust.update(t, dt, v * 0.03, 1);
    if (halo) { halo.position.y = jelly.position.y + R * (stage === 2 ? 1.7 : 1.25) * sY + Math.sin(t * 1.8) * 0.01; halo.rotation.y = t * 0.6; halo.rotation.z = Math.sin(t * 1.1) * 0.08; }
    orbs.forEach((o, i) => { const a = o.off + t * o.sp, sc = o.r * (1 + Math.sin(t * 3 + o.off) * 0.1); OM.makeScale(sc, sc, sc).setPosition(Math.sin(a) * o.rad, cy + o.h + Math.sin(t * 1.7 + o.off * 3) * 0.04, Math.cos(a) * o.rad); orbM.setMatrixAt(i, OM); }); orbM.instanceMatrix.needsUpdate = true;
    drips.forEach(d => { const q = fract(t * 0.35 + d.off); d.d.visible = q < 0.6; d.d.position.set(d.x, jelly.position.y - R * 0.8 * sY - q * q * 0.5, d.z); d.d.scale.set(0.011 * (1 - q * 0.6), 0.016 * (1 - q * 0.5), 0.011 * (1 - q * 0.6)); });
    pulse.material.opacity = k >= 0 && k < 1 ? (1 - k) * 0.7 : 0; const pr = 0.15 + Math.max(0, k) * 0.6; pulse.scale.set(pr, pr, 0.6); pulse.position.y = 0.04 + Math.max(0, k) * 0.1;
    EMB.emissiveIntensity = 0.9 + Math.sin(t * 3) * 0.25 + P * 1.5;
    blobShadow.scale.setScalar(clamp(1 - y * 3, 0.6, 1) * sX);
  } };
}

/* =========================================================================
   Pedrinho → Rochedo → Monolito (tatu) — S-110, S-145
   Casco fechado (por baixo há o corpo inteiro: não se vê o "oco"); Rochedo = musgo, pedras e
   cristais crescendo; Monolito = armadura de cristal pronta, simétrica, com placas facetadas.
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
function rockArmadillo(stage, scale) {
  SEED = 99 + stage * 7;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // S-268: o Monolito continua o Rochedo (pedra esverdeada com cristais MAIORES), não vira um bicho azul de vidro
  const crystal = false, gem = stage === 2;
  const shellBase = new THREE.Color(['#a38e6e', '#8a8670', '#6f8064'][stage]), shellDark = new THREE.Color(['#4a3a2c', '#3e3a30', '#2c3a2a'][stage]), shellLight = new THREE.Color(['#cdb994', '#b8b098', '#aec8a0'][stage]);
  const skinC = new THREE.Color(['#a48c7c', '#a08676', '#9a8478'][stage]), skinDark = new THREE.Color('#5a4638'), /* S-304: pele cinza-amarronzada de tatu (não rosada) */ moss = new THREE.Color('#5d8a3a'), mossL = new THREE.Color('#8ab04a');
  const SHELL = crystal ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#1a7a9a', emissiveIntensity: 0.35, sheen: 0.4, sheenColor: new THREE.Color('#9affff') }) : VC(0.78);
  const SKIN = VC(0.9);
  // S-304: tatu de verdade — casco comprido em barril (não uma bola), baixo, cobrindo as patas; escudo da frente,
  // cintas no meio e escudo de trás com escamas chatas (não "bolinhas")
  const L = 0.3, W = 0.158, H = 0.13, cy = 0.106;
  const AMAX = 2.32; // o casco desce pelos lados até perto do chão (esconde a parte de cima das patas)
  const droop = u => -0.05 * ss(0.5, 1, Math.abs(u)); // escudos da frente e de trás descem sobre o pescoço e o quadril (como num tatu de verdade)
  const prof = u => { const p = u > 0 ? 2.25 : 2.7; return Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), p)), 1 / p); }; // perfil "barril": cheio no meio; a frente afina até o tamanho do pescoço
  const arch = u => 1 + 0.09 * ss(0.6, -0.5, u) - 0.05 * ss(0.5, 1, u); // dorso mais alto atrás, baixando para a cabeça
  function shellPiece(z0, z1, segZ, segA, pat) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let i = 0; i <= segZ; i++) for (let j = 0; j <= segA; j++) {
      const t = i / segZ, z = z0 + (z1 - z0) * t, a = -AMAX + 2 * AMAX * j / segA, rho = prof(z);
      const nx = rho * Math.sin(a), ny = rho * Math.cos(a), p = pat(t, a, z);
      let r = p.r; if (ny < -0.25) r *= 1 + (-0.25 - ny) * 0.12; // borda de baixo abre um pouco (saia do casco)
      pos.push(nx * W * r, ny * H * r * arch(z) + cy + 0.04 + droop(z), z * L * r + 0.01);
      const hv = hash(p.id, 7);
      c.copy(shellBase).offsetHSL((hv - 0.5) * (crystal ? 0.05 : 0.02), (hv - 0.5) * 0.06, (hv - 0.5) * 0.15); // cada placa com seu tom (nada de "parede de tijolo" igual)
      c.lerp(shellDark, ss(0.1, -0.6, ny) * 0.35); // mais escuro descendo pelos lados
      c.lerp(shellLight, ss(0.4, 1, p.edge) * (crystal ? 0.55 : 0.45) * ss(-0.3, 0.8, ny));
      if (crystal) c.lerp(new THREE.Color('#7af0ff'), (1 - ss(0, 0.35, p.edge)) * 0.85); // veios luminosos entre as placas
      else c.lerp(shellDark, (1 - ss(0, 0.16, p.edge)) * 0.55); // sulcos finos entre as placas (nada de "bolinhas" com contorno grosso)
      if (gem) c.lerp(new THREE.Color('#58d8a0'), (1 - ss(0, 0.22, p.edge)) * 0.45 * ss(-0.2, 0.6, ny)); // veios de cristal verde entre as placas
      if (ny < -0.1) c.lerp(shellDark, 0.2);
      if (stage >= 1 && ny > 0.45) { /* S-267: menos limo (só manchas no alto do casco) */ const mn = Math.sin(nx * 23 + 1) * Math.cos(z * 19) * 0.5 + 0.5; c.lerp(hv > 0.5 ? moss : mossL, ss(0.5, 0.85, ny) * ss(0.45, 0.8, mn) * 0.7 * (0.55 + 0.45 * ss(0.2, 0.8, p.edge))); }
      col.push(c.r, c.g, c.b);
    }
    const flip = z1 < z0; // cintas vão de trás para a frente: mantém as faces viradas para fora
    for (let i = 0; i < segZ; i++) for (let j = 0; j < segA; j++) { const a = i * (segA + 1) + j, b = a + segA + 1; if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const shellParts = [];
  const scutes = (rowsPerUnit, cols, off) => (t, a, z) => {
    const row = Math.abs(z) * rowsPerUnit, fr = fract(row), cc = (a / (2 * Math.PI)) * cols + (Math.floor(row) % 2) * 0.5, fc = fract(cc);
    // placas poligonais encaixadas (cantos levemente arredondados), sulco fino entre elas
    const dq = Math.pow(Math.pow(Math.abs(fc - 0.5) * 2, 4) + Math.pow(Math.abs(fr - 0.5) * 2, 4), 0.25), e = Math.max(0, 1 - dq), edge = Math.min(1, e / 0.22);
    // cristal: placas facetadas (pirâmide baixa) em vez de domo
    return { r: crystal ? 1 + 0.02 * Math.min(1, e * 1.8) - 0.008 : 1 + 0.004 * Math.min(1, edge * 1.5) - 0.002, edge, id: Math.floor(row) * 57 + Math.floor(cc) + off }; // placas quase chatas
  };
  shellParts.push(shellPiece(0.28, 0.985, 90, 240, scutes(crystal ? 11 : 26, crystal ? 16 : 40, 999))); // termina numa borda do tamanho do pescoço (a cabeça sai dali)
  shellParts.push(shellPiece(-0.985, -0.3, 90, 240, scutes(crystal ? 11 : 26, crystal ? 16 : 40, 0)));
  const NB = 8;
  for (let b = 0; b < NB; b++) {
    const zf = 0.3 - b * (0.6 / NB) + 0.02, zb = zf - 0.6 / NB - 0.03; // cintas sobrepostas (sem fresta)
    shellParts.push(shellPiece(zf, zb, 16, 220, (t, a) => {
      const cc = (a / (2 * Math.PI)) * (crystal ? 18 : 26), fc = fract(cc), gv = Math.min(fc, 1 - fc);
      const lip = ss(0.82, 1, t);
      const edge = Math.min(1, gv / 0.1) * (1 - lip * 0.7) * ss(0, 0.15, t);
      return { r: 1.005 + 0.03 * t - 0.03 * lip * lip - 0.006 * (1 - ss(0, 0.12, gv)) + b * 0.0005, edge, id: b * 31 + Math.floor(cc) };
    }));
  }
  const shellG = mergeGeometries(shellParts);
  body.add(new THREE.Mesh(shellG, SHELL));
  // corpo inteiro por dentro do casco (fecha qualquer fresta: não se vê o vazio) + barriga de couro
  const hullG = sculpt(40, 28, (v, x, y, z) => { const k = prof(z) / Math.max(0.05, Math.sqrt(Math.max(0, 1 - z * z))); v.set(x * W * 0.96 * Math.min(1.6, k), y * H * 0.96 * Math.min(1.6, k) * arch(z) + cy + 0.04 + droop(z), z * L * 0.95 + 0.01); });
  vcolor(hullG, (c, x, y, z) => c.copy(skinC).lerp(skinDark, 0.3 + (Math.sin(z * 260) * 0.5 + 0.5) * 0.2)); // pele enrugada (aparece só na boca do casco)
  body.add(new THREE.Mesh(hullG, SKIN));
  const bellyG = sculpt(40, 28, (v, x, y, z) => { const w = 1 + 0.03 * Math.sin(z * 30); v.set(x * W * 0.88 * w, Math.max(y, -0.92) * H * 0.62 + cy + 0.0, z * L * 0.9); });
  vcolor(bellyG, (c, x, y, z) => { c.copy(skinC).lerp(skinDark, (Math.sin(z * 90) * 0.5 + 0.5) * 0.15); });
  body.add(new THREE.Mesh(bellyG, SKIN));
  // aba do casco: borda grossa de verdade em volta (o casco tem espessura)
  { const pts = []; for (let k = 0; k <= 96; k++) { const z = -0.97 + 1.92 * k / 96, rho = prof(z), r = 1 + (-0.25 - Math.cos(AMAX)) * 0.12; pts.push(V3(Math.sin(AMAX) * rho * W * r * 1.005, Math.cos(AMAX) * rho * H * r * arch(z) + cy + 0.04 + droop(z), z * L * r + 0.01)); }
    const lipG = mergeGeometries([1, -1].map(sx => { const g = taper(pts.map(p => V3(p.x * sx, p.y, p.z)), 0.008, 0.008, 96, 8); return strip(vcolor(g, c => c.copy(crystal ? shellLight : shellDark).lerp(shellBase, 0.4))); }));
    body.add(new THREE.Mesh(lipG, SHELL)); }
  // ---- cabeça: focinho longo de tatu, escudo de escamas, orelhas grandes em pé ----
  // S-304: a cabeça sai de baixo da borda da frente do casco, baixa, e afina num focinho longo e fino (sem disco, sem "porquinho")
  const neck = new THREE.Group(); neck.position.set(0, cy - 0.012, L * 0.92); body.add(neck);
  const neckG = taper([V3(0, 0.006, -0.07), V3(0, 0.002, -0.015), V3(0, -0.002, 0.03)], 0.05, 0.04, 12, 18); // pescoço de pele enrugada que enche a boca do casco
  { const P = neckG.attributes.position; for (let k = 0; k < P.count; k++) { const z = P.getZ(k), s = 1 + Math.sin(z * 140) * 0.06; P.setX(k, P.getX(k) * s); P.setY(k, (P.getY(k) - 0.005) * s + 0.005); } neckG.computeVertexNormals(); }
  vcolor(neckG, (c, x, y, z) => c.copy(skinC).lerp(skinDark, (Math.sin(z * 140) * 0.5 + 0.5) * 0.35));
  neck.add(new THREE.Mesh(neckG, SKIN));
  const head = new THREE.Group(); head.position.set(0, 0.002, 0.028); head.rotation.x = 0.16; head.scale.setScalar(1.15); neck.add(head);
  const HW = t => 0.043 * (1 - 0.8 * ss(0.12, 1.0, t)) * (1 + 0.1 * Math.exp(-Math.pow((t - 0.16) / 0.12, 2))); // largura: crânio largo atrás, afina até a ponta
  const HH = t => 0.036 * (1 - 0.74 * ss(0.12, 1.0, t));
  const HZ = t => -0.034 + t * 0.158, HDROP = t => -0.02 * t * t; // comprimento e leve curva para baixo
  const shieldPat = (X, Z) => { const cu = Z * 210, ca = X * 210 + (Math.floor(cu) % 2) * 0.5, fu = fract(cu), fa = fract(ca); return Math.pow(Math.pow(Math.abs(fu - 0.5) * 2, 4) + Math.pow(Math.abs(fa - 0.5) * 2, 4), 0.25); }; // escudo cefálico (placas miúdas)
  const headG = sculpt(64, 40, (v, x, y, z) => {
    const t = (z + 1) / 2;
    let X = x * HW(t), Y = y * HH(t) * (y > 0 ? 0.86 : 1.0), Z = HZ(t);
    Y += HDROP(t);
    if (y > 0.25 && t < 0.62) Y += 0.0016 * ss(0.95, 0.6, shieldPat(X, Z)); // relevo das plaquinhas no alto da cabeça
    else Y += Math.sin(Z * 260) * 0.0005 * (1 - t); // pele do focinho com ruguinhas
    v.set(X, Y, Z);
  });
  vcolor(headG, (c, x, y, z, ny) => {
    const t = (z + 0.034) / 0.158;
    if (ny > 0.35 && t < 0.62) { const d = shieldPat(x, z); c.copy(shellBase).offsetHSL(0, 0, (hash(Math.floor(z * 210), Math.floor(x * 210)) - 0.5) * 0.08).lerp(shellDark, ss(0.7, 0.98, d) * 0.6).lerp(skinC, ss(0.5, 0.62, t)); }
    else c.copy(skinC).lerp(skinDark, 0.15 + (Math.sin(z * 260) * 0.5 + 0.5) * 0.12);
    if (t > 0.86) c.lerp(new THREE.Color('#7a5248'), ss(0.86, 0.97, t)); // ponta do focinho mais escura
  });
  head.add(new THREE.Mesh(headG, SKIN));
  // ponta do focinho: almofada úmida pequena com duas narinas (nada de "nariz de porco")
  const tipZ = HZ(1), tipY = HDROP(1);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 18, 12), mat('#4a302a', { roughness: 0.32 })); snout.scale.set(1.15, 0.85, 0.4); snout.position.set(0, tipY + 0.0005, tipZ - 0.0015); head.add(snout);
  head.add(merged([-1, 1].map(sx => at(new THREE.SphereGeometry(0.0019, 8, 6), sx * 0.0035, tipY + 0.001, tipZ + 0.0035)), mat('#120806')));
  // boca: risco fino embaixo do focinho
  head.add(merged([taper([V3(-0.012, -0.012, 0.035), V3(-0.006, tipY - 0.004, 0.09), V3(0, tipY - 0.005, tipZ - 0.006)], 0.0012, 0.001, 10, 5), taper([V3(0.012, -0.012, 0.035), V3(0.006, tipY - 0.004, 0.09), V3(0, tipY - 0.005, tipZ - 0.006)], 0.0012, 0.001, 10, 5)], mat('#3a2420', { roughness: 0.6 })));
  // olhos pequenos e brilhantes, encaixados na lateral do crânio, com pálpebra
  const EYE = mat('#0c0806', { roughness: 0.05 }), GL = new THREE.MeshBasicMaterial({ color: '#ffffff' }), eyes = [];
  for (const sx of [-1, 1]) {
    const te = 0.33, e = new THREE.Group(); e.position.set(sx * HW(te) * 0.86, HH(te) * 0.38 + HDROP(te), HZ(te)); e.rotation.y = sx * 1.0; head.add(e);
    e.add(merged([at(new THREE.SphereGeometry(0.0058, 16, 12), 0, 0, 0)], EYE), merged([at(new THREE.SphereGeometry(0.0015, 8, 6), 0.0016, 0.0022, 0.005)], GL));
    const lid = new THREE.Mesh(vcolor(new THREE.SphereGeometry(0.0068, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), c => c.copy(skinC).lerp(skinDark, 0.35)), SKIN); e.add(lid);
    eyes.push({ lid });
  }
  // orelhas em pé em forma de folha (couro fino, com dobra no meio), atrás dos olhos
  const earG = sculpt(22, 18, (v, x, y, z) => { const u = (y + 1) / 2, wdt = 0.0135 * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.08)) * (1 - u * 0.25); v.set(x * wdt, u * 0.042, z * 0.0022 - Math.abs(x) * wdt * 0.55 + 0.004 * Math.sin(u * Math.PI)); });
  vcolor(earG, (c, x, y, z) => c.copy(skinC).lerp(skinDark, 0.3).lerp(new THREE.Color('#7a5046'), z > 0.0005 ? 0.35 : 0));
  const ears = [-1, 1].map(sx => { const te = 0.2, e = new THREE.Mesh(earG, SKIN); e.position.set(sx * HW(te) * 0.62, HH(te) * 0.62 + HDROP(te), HZ(te)); e.rotation.set(-0.35, sx * 0.5, -sx * 0.32); head.add(e); return e; });
  if (stage >= 1) { // chifres (pedra no Rochedo, cristal no Monolito)
    const hornG = mergeGeometries([-1, 1].map(sx => strip(taper([V3(sx * 0.016, 0.026, -0.006), V3(sx * 0.026, 0.042, -0.036), V3(sx * 0.029, 0.047, -0.078)], 0.011, 0.0025, 10, 12))));
    vcolor(hornG, (c, x, y, z) => c.copy(shellBase).lerp(crystal ? shellLight : shellDark, ss(0, -0.1, z) * 0.6));
    head.add(new THREE.Mesh(hornG, SHELL));
  }
  // ---- patas: coxa escamada em anéis, pele enrugada, garras longas ----
  const CLAW = mat('#2a221c', { roughness: 0.35 });
  // S-304: patas curtas e grossas que saem de baixo da saia do casco (nada de pernas de palito); pele de escamas miúdas,
  // pé largo e chato; na frente 3 garras longas e curvas de cavar, atrás 5 garras curtas
  const LEG = 0.092; // do pivô (sob o casco) até o chão
  const legs = [[-0.098, 0.165, true], [0.098, 0.165, true], [-0.105, -0.165, false], [0.105, -0.165, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, LEG, z); body.add(pv); const sx = Math.sign(x);
    const R0 = front ? 0.036 : 0.043;
    const lp = front ? [V3(0, 0.03, 0), V3(sx * 0.008, -0.022, 0.004), V3(sx * 0.012, -0.058, 0.01), V3(sx * 0.013, -0.08, 0.014)]
                     : [V3(0, 0.03, 0.004), V3(sx * 0.008, -0.026, -0.012), V3(sx * 0.012, -0.062, -0.006), V3(sx * 0.013, -0.08, 0.0)];
    const legT = taper(lp, 0, 0, 30, 18, u => R0 * (1 - 0.32 * ss(0, 0.85, u) + 0.1 * Math.exp(-Math.pow((u - 0.2) / 0.14, 2))) * (1 + 0.018 * Math.sin(u * 47) + 0.012 * Math.sin(u * 83 + 1.3))); // dobras de pele irregulares (sem "sanfona")
    const topCap = vcolor(strip(capSphere(R0 * 0.98, 0, 0.03, front ? 0 : 0.004)), c => c.copy(skinC).lerp(skinDark, 0.35));
    // pé de tatu: comprido para a frente, mais largo nos dedos, sola chata (nada de "rodela")
    const fz = front ? 0.012 : -0.006, fl = front ? 0.026 : 0.036;
    const footG = sculpt(24, 14, (v, xx, y, zz) => { const toe = ss(-0.6, 1, zz); v.set(xx * (0.0135 + toe * 0.009), Math.max(y, -0.45) * 0.0115 * (1 - toe * 0.45), zz * fl); });
    footG.translate(sx * 0.013, -LEG + 0.005, fz + fl * 0.55);
    const scaleCol = (c, xx, y, zz) => { const sp = hash(Math.floor(y * 380), Math.floor((xx + zz) * 380)), band = 0.5 + 0.5 * Math.sin((0.03 - y) / 0.11 * 47); c.copy(skinC).lerp(skinDark, 0.2 + sp * 0.16 + (1 - band) * 0.08).lerp(shellBase, y > -0.035 ? 0.3 * sp : 0); }; // escamas miúdas e dobras escuras nas patas
    const lg = weld(mergeGeometries([strip(vcolor(legT, scaleCol)), topCap, strip(vcolor(footG, c => c.copy(skinC).lerp(skinDark, 0.4)))]));
    pv.add(new THREE.Mesh(lg, SKIN));
    const nC = front ? 3 : 5, cl = [];
    for (let k = 0; k < nC; k++) {
      const m = (k - (nC - 1) / 2), xx = m * (front ? 0.009 : 0.0072), lc = front ? (k === 1 ? 0.034 : 0.026) : 0.014 - Math.abs(m) * 0.002;
      cl.push(taper([V3(xx, 0.002, 0), V3(xx * 1.1, 0.0, lc * 0.55), V3(xx * 1.15, -0.0055, lc)], front ? 0.0042 : 0.0034, 0.0006, 10, 8));
    }
    const cm = merged(cl, CLAW); cm.position.set(sx * 0.013, -LEG + 0.004, fz + fl * 1.4); pv.add(cm);
    return { pv, front, x, idx: front ? (x < 0 ? 0 : 1) : (x < 0 ? 2 : 3) };
  });
  // ---- rabo: comprido, afinando até a ponta, com anéis de placas; sai da borda de trás do casco ----
  const tailA = new THREE.Group(); tailA.position.set(0, cy - 0.018, -L * 0.93); body.add(tailA);
  const tailB = new THREE.Group(); tailB.position.set(0, -0.058, -0.125); tailA.add(tailB);
  const ringed = (g, n) => { const P = g.attributes.position; for (let k = 0; k < P.count; k++) { const d = Math.hypot(P.getZ(k), P.getY(k)), s = 1 + (fract(d * n) > 0.72 ? 0.07 : 0); P.setX(k, P.getX(k) * s); } g.computeVertexNormals(); vcolor(g, (c, x, y, z) => { const f = fract(Math.hypot(z, y) * n); c.copy(shellBase).lerp(crystal ? shellLight : shellDark, f > 0.72 ? 0.45 : 0).offsetHSL(0, 0, (Math.floor(Math.hypot(z, y) * n) % 2) * 0.04); }); return g; };
  // S-268: rabo de tatu de verdade — longo, fino, anelado, caindo até quase encostar no chão (nada de cone espetado)
  tailA.add(new THREE.Mesh(ringed(taper([V3(0, 0.008, 0.045), V3(0, -0.028, -0.06), V3(0, -0.058, -0.125)], 0.036, 0.018, 18, 16), 70), SHELL));
  tailB.add(new THREE.Mesh(ringed(taper([V3(0, 0, 0.006), V3(0, -0.016, -0.09), V3(0, -0.02, -0.19)], 0.0185, 0.0035, 22, 12), 85), SHELL));
  // ---- evolução ----
  let spire = null, spireLight = null;
  const rngS = (() => { let s = 31 + stage; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
  const onShell = (u, a) => { const rho = prof(u), z = u * L * 1.02, ca = Math.cos(a) * rho, sa = Math.sin(a) * rho; return { p: V3(sa * W * 1.02, cy + 0.04 + ca * H * 1.02 * arch(u) + droop(u), z + 0.01), n: V3(sa / W, ca / H, u / L).normalize() }; };
  if (stage === 1) { // Rochedo: musgo, pedrinhas, grama, florzinhas e cristais nascendo
    const CRY = new THREE.MeshPhysicalMaterial({ color: '#8affd8', emissive: '#2ad0a0', emissiveIntensity: 0.5, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.9 });
    const cg = [];
    // S-267: mais cristais nascendo (um aglomerado maior no alto, vários médios em volta)
    for (const [u, a, h] of [[0.05, 0.05, 0.1], [0.25, -0.5, 0.075], [-0.4, 0.5, 0.07], [0.45, 0.6, 0.06], [-0.15, -0.65, 0.065], [-0.55, -0.2, 0.06], [0.55, -0.15, 0.055], [-0.3, 0.05, 0.08], [0.3, 0.3, 0.06]]) { const { p, n } = onShell(u, a); const g = crystalCluster(4, h, rngS); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)); g.translate(p.x - n.x * 0.01, p.y - n.y * 0.01, p.z); cg.push(g); }
    body.add(new THREE.Mesh(mergeGeometries(cg), CRY));
    const rk = [];
    for (let k = 0; k < 7; k++) { const u = (rngS() - 0.5) * 1.3, a = (rngS() - 0.5) * 1.6, { p, n } = onShell(u, a), g = rockGeo(0.02 + rngS() * 0.02, 0.014 + rngS() * 0.012, 0.02 + rngS() * 0.02, k * 3.1); vcolor(g, (c, x, y) => c.copy(shellBase).offsetHSL(0, 0, (rngS() - 0.5) * 0.1).lerp(moss, y > 0.005 ? 0.4 : 0)); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)); g.translate(p.x, p.y - 0.005, p.z); rk.push(g); }
    body.add(merged(rk, SKIN));
    const bl = [], FL = [];
    for (let k = 0; k < 10; k++) { const u = (rngS() - 0.5) * 1.5, a = (rngS() - 0.5) * 1.4, { p, n } = onShell(u, a), h = 0.025 + rngS() * 0.03, g = new THREE.ConeGeometry(0.003, h, 5); g.translate(0, h / 2, 0); g.rotateZ((rngS() - 0.5) * 0.6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)); g.translate(p.x, p.y - 0.003, p.z); bl.push(g); if (k % 5 === 0) FL.push(at(new THREE.SphereGeometry(0.006, 8, 6), p.x + n.x * h * 0.9, p.y + n.y * h * 0.9, p.z)); }
    body.add(merged(bl, mat('#6a9a3a', { roughness: 0.9 }))); body.add(merged(FL, mat('#f4e27a', { emissive: '#a08a20', emissiveIntensity: 0.2 })));
    // tapete de musgo só no alto do casco (triângulos virados para cima), com pelinho macio
    { const src = shellG, P = src.attributes.position, N = src.attributes.normal, I = src.index, keep = [];
      for (let t2 = 0; t2 < I.count; t2 += 3) { const a = I.getX(t2), b = I.getX(t2 + 1), c = I.getX(t2 + 2), px = P.getX(a), pz = P.getZ(a), patch = Math.sin(px * 31 + 2) * Math.cos(pz * 17) > 0.15; if (patch && N.getY(a) > 0.8 && N.getY(b) > 0.8 && N.getY(c) > 0.8) keep.push(a, b, c); } // S-267: só manchas de musgo no topo
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', P); mg.setAttribute('normal', N); mg.setIndex(keep);
      const mc = new Float32Array(P.count * 3), cc = new THREE.Color(); for (let i = 0; i < P.count; i++) { cc.copy(moss).lerp(mossL, hash(i, 3) * 0.6); mc[i * 3] = cc.r; mc[i * 3 + 1] = cc.g; mc[i * 3 + 2] = cc.b; }
      mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
      furShells(body, mg, { len: 0.01, den: 520, comb: [0, 1, 0], n: 6, tip: 0.15 }); }
  }
  if (stage === 2) { // S-268 Monolito: os cristais do Rochedo cresceram — uma "montanha" de cristais verdes nas costas (estilo carapaça-monte), pedras e musgo na base
    const CRY = new THREE.MeshPhysicalMaterial({ color: '#9affc8', emissive: '#22b07a', emissiveIntensity: 0.55, roughness: 0.07, clearcoat: 1, transparent: true, opacity: 0.93 });
    const CRYD = new THREE.MeshPhysicalMaterial({ color: '#5ad0a0', emissive: '#147a55', emissiveIntensity: 0.4, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.95 });
    const big = [], small = [];
    const prism = (r, h, tilt, rot) => { const g = new THREE.CylinderGeometry(r * 0.92, r, h, 6, 1); g.translate(0, h / 2, 0); const tip = new THREE.ConeGeometry(r * 0.92, h * 0.32, 6); tip.translate(0, h + h * 0.16, 0); const c = mergeGeometries([strip(g), strip(tip)]); c.rotateY(rot); c.rotateZ(tilt[0]); c.rotateX(tilt[1]); return c; };
    const place = (g, u, a, lift = 0) => { const { p, n } = onShell(u, a); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(n.x * 0.5, 1, n.z * 0.5).normalize())); g.translate(p.x, p.y - 0.012 + lift, p.z); return g; };
    // pico central: 7 prismas grandes abrindo em leque
    const core = [[0.03, 0.3, [0, 0]], [0.022, 0.22, [0.32, 0.1]], [0.022, 0.21, [-0.3, -0.08]], [0.02, 0.18, [0.1, 0.36]], [0.02, 0.19, [-0.12, -0.38]], [0.016, 0.14, [0.5, -0.25]], [0.016, 0.13, [-0.48, 0.28]]];
    core.forEach(([r, h, tl], i) => big.push(place(prism(r, h, tl, i * 0.7), 0.02, 0)));
    // dois picos menores (frente e trás) e uma fileira de cristais pela coluna, decrescendo até o rabo
    for (const [u, s] of [[0.48, 0.65], [-0.46, 0.75]]) [[0.022, 0.16, [0, 0]], [0.016, 0.12, [0.35, 0.1]], [0.016, 0.11, [-0.35, -0.1]], [0.012, 0.08, [0.1, -0.4]]].forEach(([r, h, tl], i) => big.push(place(prism(r * s / 0.7, h * s / 0.7, tl, i), u, 0)));
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const u = 0.6 - k * 0.28, h = 0.05 + 0.03 * Math.sin(k / 4 * Math.PI); small.push(place(prism(0.01, h, [sx * 0.45, 0], k), u, sx * 0.62)); }
    body.add(new THREE.Mesh(mergeGeometries(big), CRY), new THREE.Mesh(mergeGeometries(small), CRYD));
    // pedras na base dos cristais e manchas de musgo (continuação do Rochedo)
    const rk = []; for (let k = 0; k < 9; k++) { const u = (rngS() - 0.5) * 1.1, a = (rngS() - 0.5) * 1.2, { p, n } = onShell(u, a), g = rockGeo(0.024 + rngS() * 0.02, 0.016 + rngS() * 0.012, 0.024 + rngS() * 0.02, k * 2.3); vcolor(g, (c, x, y) => c.copy(shellBase).offsetHSL(0, 0, (rngS() - 0.5) * 0.1).lerp(moss, y > 0.006 ? 0.45 : 0)); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)); g.translate(p.x, p.y - 0.006, p.z); rk.push(g); }
    body.add(merged(rk, SKIN));
    { const src = shellG, P = src.attributes.position, N = src.attributes.normal, I = src.index, keep = [];
      for (let t2 = 0; t2 < I.count; t2 += 3) { const a = I.getX(t2), b = I.getX(t2 + 1), c = I.getX(t2 + 2), px = P.getX(a), pz = P.getZ(a), patch = Math.sin(px * 27 + 1) * Math.cos(pz * 15 + 0.5) > 0.25; if (patch && N.getY(a) > 0.72 && N.getY(b) > 0.72 && N.getY(c) > 0.72) keep.push(a, b, c); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', P); mg.setAttribute('normal', N); mg.setIndex(keep);
      const mc = new Float32Array(P.count * 3), cc = new THREE.Color(); for (let i = 0; i < P.count; i++) { cc.copy(moss).lerp(mossL, hash(i, 5) * 0.6); mc[i * 3] = cc.r; mc[i * 3 + 1] = cc.g; mc[i * 3 + 2] = cc.b; }
      mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
      furShells(body, mg, { len: 0.009, den: 520, comb: [0, 1, 0], n: 6, tip: 0.15 }); }
    // chifres e rabo com pontinhas de cristal (sem a "clava" esquisita)
    const tc = []; for (let k = 0; k < 4; k++) { const g = prism(0.006, 0.025 - k * 0.004, [0, -0.5], k); g.translate(0, -0.012 - k * 0.012, -0.03 - k * 0.025); tc.push(g); } tailA.add(new THREE.Mesh(mergeGeometries(tc), CRYD));
    spireLight = vlight('#7affc0', 0.8, 4); spireLight.position.set(0, cy + 0.45, 0); root.add(spireLight);
  }
  const dust = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 8, 40), new THREE.MeshBasicMaterial({ color: '#b8a888', transparent: true, opacity: 0, depthWrite: false })); dust.rotation.x = Math.PI / 2; dust.userData.noShadow = true; root.add(dust);
  shadows(root);
  const gait = makeGait(0.1, { Amax: 0.6, fMin: 2.2 }); // patas curtas: passos curtos e rápidos (sem deslizar)
  let look = 0, atk = -9, T = 0, blink = 2, sniff = 0, tvA = 0, tvB = 0, tA = 0, tB = 0;
  return { root, attack() { atk = T; }, animate(t, m, dt) {
    T = t; const v = m.speed * PET_VMAX / scale, k = (t - atk) / 0.8;
    const rear = k >= 0 && k < 1 ? (k < 0.45 ? Math.sin(k / 0.45 * Math.PI / 2) : k < 0.55 ? 1 - (k - 0.45) / 0.1 * 1.15 : -0.15 * (1 - (k - 0.55) / 0.45)) : 0;
    const st = gait.step(v, dt), moving = st.v > 0.05, run = clamp(st.v / 2.5, 0, 1);
    let lowest = 0;
    for (const Lg of legs) { const c = gait.leg(Lg.idx), hip = -c.sw * st.A; Lg.pv.rotation.x = hip + (Lg.front ? -Math.max(0, rear) * 0.9 : Math.max(0, rear) * 0.3); Lg.pv.rotation.z = (Lg.x < 0 ? 1 : -1) * c.lift * 0.12; lowest = Math.max(lowest, (1 - Math.cos(hip)) * LEG); }
    // gingado pesado: rola de um lado para o outro com as passadas
    const bob = moving ? Math.abs(Math.sin(st.cyc * Math.PI * 2)) * 0.006 : 0;
    body.position.y = -lowest * 0.8 + bob + Math.max(0, rear) * 0.1 + Math.min(0, rear) * 0.06 + Math.sin(t * 1.6) * 0.002;
    body.rotation.x = -Math.max(0, rear) * 0.55 - Math.min(0, rear) * 0.1;
    body.rotation.z = Math.sin(st.cyc * Math.PI * 2) * 0.045 * Math.min(1, st.A * 2) - m.turn * 0.04;
    look = smooth(look, moving ? -m.turn * 0.1 : Math.sin(t * 0.5) * 0.3, dt, 3);
    neck.rotation.y = look; neck.rotation.x = Math.cos(st.cyc * Math.PI * 4) * 0.03 * run + Math.sin(t * 0.9) * 0.05 * (1 - run) + Math.max(0, rear) * 0.3;
    sniff = smooth(sniff, moving ? 0 : 1, dt, 2);
    head.rotation.x = Math.sin(t * 9) * 0.025 * sniff * (Math.sin(t * 0.7) > 0 ? 1 : 0.2); head.rotation.z = Math.sin(t * 0.6) * 0.08 * sniff; // fareja e inclina a cabeça
    snout.scale.x = 1.2 + Math.sin(t * 18) * 0.08 * sniff;
    blink -= dt; const bl = blink < 0.12 ? Math.sin(Math.max(0, blink) / 0.12 * Math.PI) : 0; if (blink < 0) blink = 2.5 + rnd() * 3;
    eyes.forEach(E => { E.lid.rotation.x = -1.2 + bl * 1.3 + (rear > 0 ? 0.5 : 0); });
    ears.forEach((e, i) => { e.rotation.x = -0.25 - run * 0.4 + Math.sin(t * 2 + i) * 0.05 + (Math.sin(t * 0.45 + i * 2) > 0.96 ? 0.3 : 0); });
    // rabo com mola (balança e atrasa)
    const wag = Math.sin(t * (1.5 + run * 3)) * 0.18 + m.turn * 0.1;
    tvA += ((wag - tA) * 40 - tvA * 7) * dt; tA += tvA * dt; tvB += ((tA * 0.8 - tB) * 30 - tvB * 6) * dt; tB += tvB * dt;
    tailA.rotation.set(Math.max(0, rear) * 0.4 + run * 0.15, tA, 0); tailB.rotation.set(run * 0.1, tB, 0);
    const dk = (k - 0.5) / 0.5; dust.material.opacity = dk > 0 && dk < 1 ? (1 - dk) * 0.5 : 0; const dr = 0.2 + Math.max(0, dk) * 0.7; dust.scale.set(dr, dr, 0.25 + Math.max(0, dk) * 0.2); dust.position.set(0, 0.02, 0.25);
    if (spireLight) spireLight.intensity = 0.8 + Math.sin(t * 2) * 0.2 + (dk > 0 && dk < 1 ? (1 - dk) * 2 : 0);
  } };
}

// tamanho de cada estágio (o mascote cresce ao evoluir)
const STAGE_SCALE = [0.8, 1.05, 1.35];
const STAGE_SCALE_SP = { terra: [0.62, 0.86, 1.55] }; // S-268: tatu — o menor menor, o do meio um pouco maior, o Monolito ainda maior
export function makePet(species, stage) {
  const sc = (STAGE_SCALE_SP[species] || STAGE_SCALE)[stage];
  const m = species === 'agua' ? waterSprite(stage, sc) : species === 'terra' ? rockArmadillo(stage, sc) : realFox(stage, sc); // S-330: raposa realista (malha com esqueleto, como o lobo)
  m.root.scale.setScalar(sc);
  const obj = new THREE.Group(); obj.add(m.root);
  return { obj, ...m, height: 0.8 * sc };
}
