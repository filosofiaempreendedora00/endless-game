/* =========================================================================
   VILA EM CÓDIGO (rodada 13): peças da vila feitas à mão, no lugar dos modelos
   prontos que ficavam "de brinquedo":
   - makeSmithy()      ferraria de tamanho certo (S-125): forja com coifa e chaminé,
                       bigorna no toco, fole, barril de têmpera, bancada e ferramentas
   - makeWell()        poço de pedra com telhadinho, sarilho, corda e balde (S-129)
   - makeBucket()      balde de aduelas de madeira com aros e alça de ferro (S-129)
   - makeClothFlag(c)  bandeira de pano que tremula ao vento, mastro de madeira (S-131)
   - retextureKayKit(MODELS)  pedra e madeira com relevo nos prédios prontos (S-132)
   Tudo liso (sem facetas), sem luz de verdade (as cópias de place() não levam vlight).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';

const rngOf = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
// relógio global para os shaders (vento da bandeira, fumaça): lido pelo three a cada uso do material
const TIME = {}; Object.defineProperty(TIME, 'value', { get: () => performance.now() / 1000 });

/* ---------- texturas pintadas em canvas ---------- */
const texCache = {};
function canvasTex(key, w, h, draw, repeat) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (repeat) t.repeat.set(...repeat);
  return (texCache[key] = t);
}
// veios de madeira (ao longo do eixo V), com nós e variação de tom
function woodGrain(g, W, H, base = [92, 58, 32], seed = 3, planks = 0) {
  const r = rngOf(seed);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, W, H);
  const pw = planks ? W / planks : W;
  for (let p = 0; p < (planks || 1); p++) { // cada tábua com seu tom
    const k = 0.85 + r() * 0.3; g.fillStyle = `rgba(${base.map(v => Math.min(255, v * k)).join(',')},1)`; g.fillRect(p * pw, 0, pw, H);
  }
  for (let i = 0; i < 70; i++) { // veios ondulados
    const x0 = r() * W, amp = 2 + r() * 5, fr = 0.01 + r() * 0.03, ph = r() * 6, dark = r() < 0.6;
    g.strokeStyle = dark ? `rgba(40,22,10,${0.12 + r() * 0.2})` : `rgba(255,220,170,${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath(); for (let y = 0; y <= H; y += 4) { const x = x0 + Math.sin(y * fr + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }
  for (let i = 0; i < 3; i++) { // nós
    const x = r() * W, y = r() * H, rr = 3 + r() * 5; for (let k = 4; k > 0; k--) { g.strokeStyle = `rgba(45,25,12,${0.25})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rr * k * 0.5, rr * k * 1.3, 0, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(40,20,10,0.6)'; g.beginPath(); g.ellipse(x, y, rr * 0.5, rr, 0, 0, 7); g.fill();
  }
  if (planks) for (let p = 1; p < planks; p++) { g.fillStyle = 'rgba(25,14,6,0.85)'; g.fillRect(p * pw - 1.5, 0, 3, H); } // frestas entre tábuas
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 1, 2 + r() * 6); } // poros
}
const woodTex = (seed = 3, base, planks = 0) => canvasTex(`wood${seed}|${base}|${planks}`, 256, 256, (g, W, H) => woodGrain(g, W, H, base, seed, planks));
// telhas de madeira sobrepostas (fileiras com sombra embaixo)
const shingleTex = () => canvasTex('shingle', 256, 256, (g, W, H) => {
  const r = rngOf(9); g.fillStyle = '#3a2418'; g.fillRect(0, 0, W, H);
  const rows = 8, rh = H / rows;
  for (let y = 0; y < rows; y++) { let x = (y % 2) * -14; while (x < W) { const w = 20 + r() * 18, k = 0.75 + r() * 0.4; g.fillStyle = `rgb(${110 * k},${66 * k},${44 * k})`; g.fillRect(x + 1, y * rh, w - 2, rh - 2); const gr = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,230,200,0.08)'); g.fillStyle = gr; g.fillRect(x + 1, y * rh, w - 2, rh - 2); for (let k2 = 0; k2 < 6; k2++) { g.fillStyle = 'rgba(30,15,8,0.25)'; g.fillRect(x + 2 + r() * (w - 4), y * rh + 2, 1, rh - 6); } x += w; } }
});
// tecido da bandeira: trama, barra dourada e brasão (sol nascendo sobre colinas / torre)
function flagTex(kind) {
  return canvasTex('flag' + kind, 256, 160, (g, W, H) => {
    const base = kind === 'red' ? ['#7e1a16', '#a8302a'] : ['#173a72', '#2a5aa6'];
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, base[1]); gr.addColorStop(1, base[0]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + (y % 4 ? 0.02 : 0)})`; g.fillRect(0, y, W, 1); } // trama
    for (let x = 0; x < W; x += 2) { g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(x, 0, 1, H); }
    g.strokeStyle = '#d9b45a'; g.lineWidth = 5; g.strokeRect(14, 8, W - 22, H - 16); // barra
    g.fillStyle = '#c99a3a'; g.fillRect(0, 0, 14, H); // bainha do mastro
    g.save(); g.translate(W / 2 + 6, H / 2 + 6); g.fillStyle = '#efc65e'; g.strokeStyle = '#6a4a18'; g.lineWidth = 2;
    if (kind === 'red') { // torre com ameias
      g.beginPath(); g.moveTo(-18, 34); g.lineTo(-14, -18); g.lineTo(-20, -18); g.lineTo(-20, -32); g.lineTo(-12, -32); g.lineTo(-12, -26); g.lineTo(-4, -26); g.lineTo(-4, -32); g.lineTo(4, -32); g.lineTo(4, -26); g.lineTo(12, -26); g.lineTo(12, -32); g.lineTo(20, -32); g.lineTo(20, -18); g.lineTo(14, -18); g.lineTo(18, 34); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#5a1410'; g.beginPath(); g.moveTo(-6, 34); g.lineTo(-6, 18); g.arc(0, 18, 6, Math.PI, 0); g.lineTo(6, 34); g.fill();
    } else { // sol nascendo sobre as colinas (Alvorada)
      for (let k = 0; k < 11; k++) { const a = Math.PI + k / 10 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * 22, 6 + Math.sin(a) * 22); g.lineTo(Math.cos(a - 0.08) * 40, 6 + Math.sin(a - 0.08) * 40); g.lineTo(Math.cos(a + 0.08) * 40, 6 + Math.sin(a + 0.08) * 40); g.fill(); }
      g.beginPath(); g.arc(0, 6, 20, Math.PI, 0); g.fill(); g.stroke();
      g.fillStyle = '#2f7a3a'; g.beginPath(); g.moveTo(-48, 34); g.quadraticCurveTo(-24, 0, 4, 22); g.quadraticCurveTo(26, 4, 48, 34); g.closePath(); g.fill();
    }
    g.restore();
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } // desgaste
  });
}

/* ---------- utilidades ---------- */
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const IRON = std('#3a3634', { metalness: 0.75, roughness: 0.45 });
const IRON_DARK = std('#26221f', { metalness: 0.7, roughness: 0.55 });
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const M = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; return m; };
// junta as malhas estáticas por material (poucas chamadas de desenho)
export function bakeGroup(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), groups = new Map(), drop = [];
  obj.traverse(o => {
    if (!o.isMesh || o.userData.keep || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + '|' + (g.attributes.color ? 'c' : '') + '|' + o.castShadow;
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    groups.get(key).geos.push(g); drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  for (const { mat, cast, geos } of groups.values()) {
    if (geos.some(g => g.attributes.color) && geos.some(g => !g.attributes.color)) for (const g of geos) if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = cast; m.receiveShadow = true; obj.add(m);
  }
  return obj;
}
// pedra arredondada (bloco com quinas gastas) com cor por vértice
const STONE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
function stone(rng, w, h, d, base = '#8f8a80', moss = 0) {
  const g = mergeVertices(new THREE.BoxGeometry(w, h, d, 3, 2, 2)), P = g.attributes.position, rr = Math.min(w, h, d) * 0.28;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const ex = Math.max(0, Math.abs(x) - (w / 2 - rr)), ey = Math.max(0, Math.abs(y) - (h / 2 - rr)), ez = Math.max(0, Math.abs(z) - (d / 2 - rr)), e = Math.hypot(ex, ey, ez);
    if (e > 0) { const k = rr / e; x -= Math.sign(x) * ex * (1 - k); y -= Math.sign(y) * ey * (1 - k); z -= Math.sign(z) * ez * (1 - k); }
    const j = (rng() - 0.5) * Math.min(w, h, d) * 0.08; P.setXYZ(i, x + j, y + j * 0.5, z + j);
  }
  g.computeVertexNormals();
  const c = new THREE.Color(base).offsetHSL((rng() - 0.5) * 0.02, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.12), N = g.attributes.normal, col = new Float32Array(P.count * 3), t = new THREE.Color(), mc = new THREE.Color('#5b7a36'), dk = new THREE.Color('#4a463f');
  for (let i = 0; i < P.count; i++) { t.copy(c).offsetHSL(0, 0, (rng() - 0.5) * 0.04); if (moss && N.getY(i) > 0.5 && rng() < moss) t.lerp(mc, 0.6); if (N.getY(i) < -0.3) t.lerp(dk, 0.4); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// anel de pedras (poço): fiadas de blocos curvos desencontrados
function stoneRing(rng, rIn, rOut, h, rows, base, moss, yFrom = 0) {
  const parts = [], rowH = h / rows, rm = (rIn + rOut) / 2, depth = rOut - rIn;
  for (let row = 0; row < rows; row++) {
    const n = Math.max(6, Math.round(Math.PI * 2 * rm / (0.42 + rng() * 0.12))), off = row % 2 ? Math.PI / n : 0;
    for (let k = 0; k < n; k++) {
      const a = off + k / n * Math.PI * 2, arc = Math.PI * 2 * rm / n;
      const g = stone(rng, arc * 0.96, rowH * (0.9 + rng() * 0.08), depth * (0.9 + rng() * 0.15), base, row === rows - 1 ? moss : moss * 0.3);
      g.rotateY(-a + Math.PI / 2); g.translate(Math.cos(a) * rm, yFrom + rowH * (row + 0.5), Math.sin(a) * rm); parts.push(g.toNonIndexed());
    }
  }
  return parts;
}

/* =========================================================================
   BALDE (S-129): aduelas de madeira, dois aros de ferro, orelhas e alça
   ========================================================================= */
const BUCKET_WOOD = () => new THREE.MeshStandardMaterial({ map: canvasTex('bucketwood', 256, 128, (g, W, H) => { woodGrain(g, W, H, [120, 78, 42], 11, 12); }), roughness: 0.8 });
let _bucketWood = null;
export function makeBucket(withWater = true) {
  const g = new THREE.Group(), wood = _bucketWood || (_bucketWood = BUCKET_WOOD());
  // casca com espessura: sobe por fora, passa pela borda e desce por dentro até o fundo
  const body = M(lathe([[0.0, 0.012], [0.15, 0.0], [0.155, 0.012], [0.172, 0.16], [0.19, 0.32], [0.192, 0.33], [0.178, 0.33], [0.162, 0.17], [0.143, 0.035], [0.0, 0.035]], 36), wood);
  g.add(body);
  for (const [y, r] of [[0.065, 0.161], [0.255, 0.187]]) { const h = M(new THREE.TorusGeometry(r, 0.011, 8, 40), IRON, 0, y, 0, Math.PI / 2); h.scale.z = 1.6; g.add(h); }
  for (const s of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.03, 0.07, 0.03), IRON_DARK, s * 0.19, 0.3, 0)); // orelhas
  const handle = M(new THREE.TorusGeometry(0.19, 0.007, 8, 32, Math.PI), IRON, 0, 0.31, 0); handle.rotation.set(0, 0, 0); handle.rotation.x = -0.35; g.add(handle);
  if (withWater) { const w = M(new THREE.CircleGeometry(0.168, 28), new THREE.MeshStandardMaterial({ color: '#2b4a52', roughness: 0.05, metalness: 0.2 }), 0, 0.27, 0, -Math.PI / 2); w.castShadow = false; g.add(w); }
  g.userData.radius = 0.22;
  return g;
}

/* =========================================================================
   POÇO (S-129): anel de pedra em fiadas, calçada em volta, água escura,
   dois esteios com mãos-francesas, telhadinho de tabuinhas, sarilho com
   manivela, corda enrolada e balde pendurado
   ========================================================================= */
export function makeWell(seed = 21) {
  const rng = rngOf(seed), g = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ map: woodTex(5, [96, 62, 36]), roughness: 0.82 });
  const roofM = new THREE.MeshStandardMaterial({ map: shingleTex(), roughness: 0.9 }); roofM.map.repeat.set(2, 1.5);
  // anel (com saia abaixo do chão para encostas) e capa de pedras chatas
  const parts = [...stoneRing(rng, 0.78, 1.05, 1.6, 6, '#8e897e', 0.25, -0.75)];
  { const n = 16; for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * Math.PI * 2, gg = stone(rng, 0.44, 0.12, 0.38, '#9a958a', 0.2); gg.rotateY(-a + Math.PI / 2); gg.translate(Math.cos(a) * 0.92, 0.9, Math.sin(a) * 0.92); parts.push(gg.toNonIndexed()); } }
  // calçada de lajes em volta
  for (let ring = 0; ring < 2; ring++) { const rr = 1.35 + ring * 0.45, n = 12 + ring * 5; for (let k = 0; k < n; k++) { const a = (k + rng() * 0.3) / n * Math.PI * 2, gg = stone(rng, 0.5 + rng() * 0.1, 0.1, 0.4, '#8a857a', 0.15); gg.rotateY(-a + Math.PI / 2 + (rng() - 0.5) * 0.2); gg.translate(Math.cos(a) * rr, 0.02, Math.sin(a) * rr); parts.push(gg.toNonIndexed()); } }
  g.add(M(mergeGeometries(parts), STONE_MAT));
  // dentro: parede escura e água com reflexo
  const inner = M(new THREE.CylinderGeometry(0.78, 0.78, 1.3, 32, 1, true), std('#1e1c1a', { side: THREE.BackSide, roughness: 1 }), 0, 0.2, 0); g.add(inner);
  const water = M(new THREE.CircleGeometry(0.78, 32), new THREE.MeshStandardMaterial({ color: '#163038', roughness: 0.04, metalness: 0.4 }), 0, 0.15, 0, -Math.PI / 2); water.castShadow = false; g.add(water);
  // esteios e travessas
  const beam = (w, h, d, x, y, z, rx = 0, rz = 0) => g.add(M(new THREE.BoxGeometry(w, h, d, 1, 4, 1), timber, x, y, z, rx, 0, rz));
  for (const s of [-1, 1]) {
    beam(0.16, 2.35, 0.16, s * 1.0, 1.0, 0);
    beam(0.08, 0.6, 0.08, s * 0.82, 1.92, 0, 0, s * 0.75); // mão-francesa
    g.add(M(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 16), IRON_DARK, s * 1.0, 1.55, 0, 0, 0, Math.PI / 2)); // mancal
  }
  beam(2.4, 0.14, 0.16, 0, 2.2, 0); // cumeeira
  // telhadinho de duas águas com tabuinhas
  for (const s of [-1, 1]) { const r = M(new THREE.BoxGeometry(2.7, 0.06, 1.05, 4, 1, 4), roofM, 0, 2.03, s * 0.42, s * 0.62); g.add(r); }
  // sarilho: tora com corda enrolada e manivela
  const drum = M(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 18), timber, 0, 1.55, 0, 0, 0, Math.PI / 2); g.add(drum);
  for (let k = 0; k < 9; k++) g.add(M(new THREE.TorusGeometry(0.1, 0.014, 6, 20), std('#b8a27a', { roughness: 1 }), -0.25 + k * 0.03, 1.55, 0, 0, Math.PI / 2, 0));
  const crank = new THREE.Group(); crank.position.set(1.12, 1.55, 0); g.add(crank);
  crank.add(M(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 10), IRON, 0.08, 0, 0, 0, 0, Math.PI / 2));
  crank.add(M(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10), IRON, 0.18, -0.13, 0));
  crank.add(M(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), timber, 0.26, -0.28, 0, 0, 0, Math.PI / 2));
  // corda descendo até o balde pendurado
  g.add(M(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 6), std('#b8a27a', { roughness: 1 }), -0.05, 1.3, 0));
  const hb = makeBucket(false); hb.position.set(-0.05, 0.75, 0); g.add(hb);
  // um balde cheio na beira
  const b2 = makeBucket(true); b2.position.set(0.85, 0, 1.05); b2.rotation.y = 0.6; g.add(b2);
  g.userData.radius = 1.15;
  return bakeGroup(g);
}

/* =========================================================================
   BANDEIRA DE PANO (S-131): mastro torneado de madeira com ponteira de latão,
   base de pedra e pano que tremula (ondas no vertex shader, presas no mastro)
   ========================================================================= */
const flagMats = {};
function flagMaterial(kind) {
  if (flagMats[kind]) return flagMats[kind];
  const m = new THREE.MeshStandardMaterial({ map: flagTex(kind), side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = TIME;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        float fx = max(position.x, 0.0) / 1.5;            // 0 no mastro, 1 na ponta
        float ph = modelMatrix[3][0] * 0.37 + modelMatrix[3][2] * 0.53;
        float w1 = sin(position.x * 3.2 - uT * 4.2 + ph), w2 = sin(position.x * 6.1 + position.y * 2.0 - uT * 6.8 + ph * 1.7);
        float amp = fx * (0.22 + 0.07 * sin(uT * 0.7 + ph)) + 0.02;
        float dz = (w1 * 0.8 + w2 * 0.25) * amp;
        float dzdx = (cos(position.x * 3.2 - uT * 4.2 + ph) * 3.2 * 0.8 + cos(position.x * 6.1 + position.y * 2.0 - uT * 6.8 + ph * 1.7) * 6.1 * 0.25) * amp;
        vec3 objectNormal = normalize(vec3(-dzdx, 0.0, 1.0));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
        transformed.z += dz;
        transformed.y -= fx * fx * 0.06 * (1.0 + w1 * 0.3);   // a ponta cai um pouco
        transformed.x -= abs(dz) * 0.15;`);
  };
  m.customProgramCacheKey = () => 'clothflag';
  return (flagMats[kind] = m);
}
export function makeClothFlag(kind = 'blue', h = 4.4) {
  const g = new THREE.Group(), pole = new THREE.MeshStandardMaterial({ map: woodTex(7, [104, 70, 42]), roughness: 0.75 });
  pole.map.repeat.set(1, 4);
  g.add(M(lathe([[0.001, 0], [0.075, 0], [0.07, 0.25], [0.06, 0.3], [0.055, h * 0.6], [0.045, h], [0.001, h]], 18), pole));
  g.add(M(new THREE.SphereGeometry(0.075, 18, 12), std('#c9a04a', { metalness: 0.8, roughness: 0.3 }), 0, h + 0.05, 0));
  g.add(M(new THREE.ConeGeometry(0.035, 0.22, 14), std('#c9a04a', { metalness: 0.8, roughness: 0.3 }), 0, h + 0.2, 0));
  // base: pedras em volta do pé
  { const rng = rngOf(kind === 'red' ? 31 : 37), parts = []; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, s = stone(rng, 0.22, 0.16, 0.2, '#8a857a', 0.3); s.rotateY(-a); s.translate(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2); parts.push(s.toNonIndexed()); } g.add(M(mergeGeometries(parts), STONE_MAT)); }
  // argolas que prendem o pano
  for (const y of [h - 0.12, h - 0.9]) g.add(M(new THREE.TorusGeometry(0.06, 0.01, 6, 16), IRON, 0, y, 0, Math.PI / 2));
  const cloth = new THREE.PlaneGeometry(1.5, 0.95, 30, 14); cloth.translate(0.75 + 0.05, 0, 0);
  const f = M(cloth, flagMaterial(kind), 0, h - 0.52, 0); f.userData.keep = true; f.frustumCulled = false; g.add(f);
  g.userData.radius = 0.3;
  return g;
}

/* =========================================================================
   FERRARIA (S-125): oficina de tamanho humano (≈ 6,6 × 5 m), aberta na frente.
   Base de pedra, parede do fundo em alvenaria, telhado de tabuinhas sobre esteios,
   forja de pedra com brasas, coifa e chaminé, fole de couro, bigorna num toco,
   barril de têmpera, bancada com ferramentas, suporte de armas e rebolo.
   Frente da oficina = +Z (place() vira para a praça).
   ========================================================================= */
const smokeMat = () => {
  const m = new THREE.PointsMaterial({ color: '#cfcac2', size: 1.4, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true,
    map: canvasTex('puff', 64, 64, (g, W, H) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }) });
  m.map.colorSpace = THREE.NoColorSpace;
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = TIME;
    sh.vertexShader = 'uniform float uT;\nvarying float vLife;\n' + sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
      float life = fract(uT * 0.18 + position.x * 7.31);
      transformed = vec3(sin(position.x * 40.0 + uT * 0.5) * 0.25 * life + life * 0.6, life * 4.0, cos(position.x * 31.0) * 0.25 * life);
      vLife = life;`).replace('gl_PointSize = size;', 'gl_PointSize = size * (0.6 + vLife * 2.2);');
    sh.fragmentShader = 'varying float vLife;\n' + sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.a *= smoothstep(0.0, 0.12, vLife) * (1.0 - vLife);\n#include <premultiplied_alpha_fragment>');
  };
  m.customProgramCacheKey = () => 'forgesmoke';
  return m;
};
export function makeSmithy(seed = 41) {
  const rng = rngOf(seed), g = new THREE.Group();
  const W = 6.6, D = 5.0, H = 3.0; // largura, fundo, pé-direito
  const timber = new THREE.MeshStandardMaterial({ map: woodTex(13, [92, 60, 36]), roughness: 0.82 });
  const planks = new THREE.MeshStandardMaterial({ map: woodTex(17, [110, 74, 44], 6), roughness: 0.85 }); planks.map.repeat.set(2, 1);
  const roofM = new THREE.MeshStandardMaterial({ map: shingleTex(), roughness: 0.9 }); roofM.map.repeat.set(4, 2);
  const S = []; // pedras (uma malha só)
  // base de lajes com saia que desce para o terreno
  for (let ix = 0; ix < 9; ix++) for (let iz = 0; iz < 7; iz++) { const s = stone(rng, W / 9 * 0.97, 0.3, D / 7 * 0.97, '#8c877c', 0.05); s.translate(-W / 2 + (ix + 0.5) * W / 9, 0.12, -D / 2 + (iz + 0.5) * D / 7); S.push(s.toNonIndexed()); }
  { const sk = new THREE.BoxGeometry(W, 1.0, D); sk.translate(0, -0.45, 0); const n = sk.attributes.position.count; sk.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.42), 3)); S.push(sk.toNonIndexed()); }
  // parede do fundo em alvenaria (pedras desencontradas)
  { let y = 0.27, row = 0; while (y < H) { const bh = 0.28 + rng() * 0.08; let x = -W / 2 + (row % 2 ? -0.2 : 0); while (x < W / 2 - 0.05) { const bw = Math.min(0.45 + rng() * 0.4, W / 2 - x); if (bw > 0.12) { const s = stone(rng, bw - 0.03, bh - 0.03, 0.42, '#86817a', 0.08); s.translate(x + bw / 2, y + bh / 2, -D / 2 + 0.21); S.push(s.toNonIndexed()); } x += bw; } y += bh; row++; } }
  // forja (canto esquerdo do fundo): bloco de pedra com boca, brasas, coifa e chaminé
  const FX = -W / 2 + 1.25, FZ = -D / 2 + 0.95;
  { let y = 0.27, row = 0; while (y < 1.05) { const bh = 0.26; for (const [w, d, ox, oz] of [[1.9, 0.38, 0, 0.62], [0.38, 1.3, -0.76, 0], [0.38, 1.3, 0.76, 0]]) { const s = stone(rng, w - 0.03, bh - 0.02, d, '#7f7a72', 0); s.translate(FX + ox, y + bh / 2, FZ + oz); S.push(s.toNonIndexed()); } y += bh; row++; } }
  { const top = stone(rng, 2.0, 0.14, 1.6, '#76716a', 0); top.translate(FX, 1.12, FZ); S.push(top.toNonIndexed()); }
  // coifa (tronco de pirâmide) e chaminé de pedra até acima do telhado
  { const hood = new THREE.CylinderGeometry(0.45, 1.05, 1.2, 4, 3); hood.rotateY(Math.PI / 4); hood.translate(FX, 2.05, FZ - 0.05); const n = hood.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = 0.5 + rng() * 0.06; c[i * 3] = v; c[i * 3 + 1] = v * 0.97; c[i * 3 + 2] = v * 0.92; } hood.setAttribute('color', new THREE.BufferAttribute(c, 3)); S.push(hood.toNonIndexed()); }
  { let y = 2.6, row = 0; while (y < 5.6) { const bh = 0.3; for (const [w, d, ox, oz] of [[0.75, 0.18, 0, 0.3], [0.75, 0.18, 0, -0.3], [0.18, 0.45, 0.3, 0], [0.18, 0.45, -0.3, 0]]) { const s = stone(rng, w, bh - 0.02, d, '#7a756d', 0); s.translate(FX + ox + (row % 2 ? 0.02 : 0), y + bh / 2, FZ - 0.05 + oz); S.push(s.toNonIndexed()); } y += bh; row++; } const cap = stone(rng, 0.95, 0.12, 0.95, '#6f6a63', 0); cap.translate(FX, 5.66, FZ - 0.05); S.push(cap.toNonIndexed()); }
  g.add(M(mergeGeometries(S), STONE_MAT));
  // brasas e boca da forja (brilho)
  const coals = new THREE.Group(); coals.position.set(FX, 1.2, FZ - 0.05); g.add(coals);
  { const cg = []; for (let k = 0; k < 26; k++) { const s = new THREE.IcosahedronGeometry(0.05 + rng() * 0.05, 1); s.translate((rng() - 0.5) * 1.1, rng() * 0.08, (rng() - 0.5) * 0.7); cg.push(s); } const cm = M(mergeGeometries(cg), new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff5a10', emissiveIntensity: 1.8, roughness: 0.9 })); coals.add(cm); }
  { const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.12; glow.userData.keep = true; coals.add(glow); }
  // fumaça saindo da chaminé
  { const n = 14, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos[i * 3] = i / n + rng() * 0.05; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(geo, smokeMat()); pts.position.set(FX, 5.75, FZ - 0.05); pts.frustumCulled = false; g.add(pts); }
  // fole de couro ao lado da forja
  { const fb = new THREE.Group(); fb.position.set(FX + 1.35, 0.95, FZ - 0.1); fb.rotation.y = -0.5; g.add(fb);
    fb.add(M(new THREE.BoxGeometry(0.62, 0.04, 0.42), timber, 0, 0.14, 0, 0, 0, -0.18)); fb.add(M(new THREE.BoxGeometry(0.62, 0.04, 0.42), timber, 0, -0.08, 0));
    const lea = M(new THREE.SphereGeometry(0.28, 20, 12), std('#4a3020', { roughness: 0.7 }), 0.02, 0.03, 0); lea.scale.set(1.05, 0.32, 0.72); fb.add(lea);
    fb.add(M(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 10), IRON, -0.48, 0.02, 0, 0, 0, Math.PI / 2));
    fb.add(M(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 10), timber, 0.1, -0.5, 0)); }
  // esteios da frente e do meio, vigas e telhado de duas águas (cumeeira ao longo de X)
  const post = (x, z, h = H) => g.add(M(new THREE.BoxGeometry(0.2, h, 0.2, 1, 4, 1), timber, x, 0.27 + h / 2, z));
  for (const x of [-W / 2 + 0.15, 0, W / 2 - 0.15]) post(x, D / 2 - 0.15);
  post(W / 2 - 0.15, -D / 2 + 0.5);
  g.add(M(new THREE.BoxGeometry(W + 0.2, 0.22, 0.24, 6, 1, 1), timber, 0, H + 0.38, D / 2 - 0.15)); // viga da frente
  g.add(M(new THREE.BoxGeometry(0.22, 0.22, D, 1, 1, 6), timber, W / 2 - 0.15, H + 0.38, 0));
  g.add(M(new THREE.BoxGeometry(0.22, 0.22, D, 1, 1, 6), timber, -W / 2 + 0.15, H + 0.38, 0));
  for (const s of [-1, 1]) { const r = M(new THREE.BoxGeometry(W + 0.9, 0.08, D / 2 + 0.7, 6, 1, 4), roofM, 0, H + 1.05, s * (D / 4 + 0.15), s * 0.5, 0, 0); g.add(r); }
  { const ridge = M(new THREE.CylinderGeometry(0.11, 0.11, W + 1.0, 14), timber, 0, H + 1.72, 0, 0, 0, Math.PI / 2); g.add(ridge); }
  // empenas de tábuas (triângulos) nas laterais
  for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-D / 2, 0); sh.lineTo(D / 2, 0); sh.lineTo(0, 1.35); sh.closePath(); const gg = new THREE.ShapeGeometry(sh); const P = gg.attributes.position, uv = gg.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / D + 0.5, P.getY(i) / 1.35); const m = M(gg, new THREE.MeshStandardMaterial({ map: planks.map, side: THREE.DoubleSide, roughness: 0.85 }), s * (W / 2 - 0.05), H + 0.45, 0, 0, Math.PI / 2, 0); g.add(m); }
  // parede lateral esquerda de tábuas (meia altura, com o fundo da forja)
  g.add(M(new THREE.BoxGeometry(0.1, H, D - 0.4, 1, 1, 1), planks, -W / 2 + 0.1, 0.27 + H / 2, 0.2));
  // bigorna num toco
  { const stump = M(lathe([[0.001, 0], [0.32, 0], [0.3, 0.05], [0.27, 0.55], [0.28, 0.6], [0.001, 0.6]], 20), new THREE.MeshStandardMaterial({ map: woodTex(19, [80, 54, 34]), roughness: 0.9 }), 0.6, 0.27, 0.6); g.add(stump);
    const ring = M(new THREE.CircleGeometry(0.27, 24), std('#a07a4a'), 0.6, 0.875, 0.6, -Math.PI / 2); g.add(ring);
    const sh = new THREE.Shape(); sh.moveTo(-0.32, 0); sh.lineTo(0.26, 0); sh.lineTo(0.26, 0.05); sh.lineTo(0.14, 0.09); sh.lineTo(0.1, 0.2); sh.lineTo(0.22, 0.24); sh.lineTo(0.24, 0.31); sh.lineTo(-0.2, 0.31); sh.quadraticCurveTo(-0.42, 0.3, -0.56, 0.27); sh.quadraticCurveTo(-0.36, 0.22, -0.18, 0.2); sh.lineTo(-0.14, 0.09); sh.lineTo(-0.32, 0.05); sh.closePath();
    const an = M(new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3, curveSegments: 12 }), std('#2c2a2a', { metalness: 0.85, roughness: 0.35 }), 0.62, 0.875, 0.51, 0, -0.3, 0); g.add(an);
    const ham = new THREE.Group(); ham.position.set(0.7, 1.21, 0.72); ham.rotation.set(0, 0.9, 0); g.add(ham);
    ham.add(M(new THREE.CylinderGeometry(0.016, 0.02, 0.38, 10), timber, 0.16, 0, 0, 0, 0, Math.PI / 2)); ham.add(M(new THREE.BoxGeometry(0.07, 0.07, 0.13), IRON, -0.04, 0.02, 0)); }
  // barril de têmpera com água
  { const bw = new THREE.MeshStandardMaterial({ map: canvasTex('barrelwood', 256, 128, (gg, Wd, Hh) => woodGrain(gg, Wd, Hh, [104, 68, 38], 23, 14)), roughness: 0.85 });
    const bar = M(lathe([[0.001, 0], [0.3, 0], [0.34, 0.2], [0.36, 0.4], [0.34, 0.6], [0.31, 0.72], [0.28, 0.72], [0.31, 0.6], [0.32, 0.4], [0.3, 0.2], [0.27, 0.06], [0.001, 0.06]], 30), bw, FX + 1.4, 0.27, FZ + 1.25); g.add(bar);
    for (const [y, r] of [[0.12, 0.325], [0.6, 0.345]]) { const h = M(new THREE.TorusGeometry(r, 0.012, 6, 36), IRON_DARK, FX + 1.4, 0.27 + y, FZ + 1.25, Math.PI / 2); h.scale.z = 1.8; g.add(h); }
    const w = M(new THREE.CircleGeometry(0.3, 28), new THREE.MeshStandardMaterial({ color: '#25363a', roughness: 0.05, metalness: 0.3 }), FX + 1.4, 0.27 + 0.62, FZ + 1.25, -Math.PI / 2); g.add(w);
    const tong = M(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8), IRON, FX + 1.52, 0.27 + 0.7, FZ + 1.2, 0, 0, 0.5); g.add(tong); }
  // bancada no fundo direito com ferramentas e ferraduras na parede
  { const BX = W / 2 - 1.5, BZ = -D / 2 + 0.75;
    g.add(M(new THREE.BoxGeometry(2.0, 0.09, 0.7, 4, 1, 2), planks, BX, 1.12, BZ));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(M(new THREE.BoxGeometry(0.09, 0.85, 0.09), timber, BX + sx * 0.9, 0.69, BZ + sz * 0.28));
    g.add(M(new THREE.BoxGeometry(1.9, 0.05, 0.6), planks, BX, 0.45, BZ)); // prateleira de baixo
    for (let k = 0; k < 3; k++) { const hs = M(new THREE.TorusGeometry(0.08, 0.016, 8, 20, Math.PI * 1.5), IRON, BX - 0.6 + k * 0.25, 1.9, -D / 2 + 0.45, 0, 0, Math.PI * 0.75); g.add(hs); } // ferraduras penduradas
    for (let k = 0; k < 3; k++) { const t = new THREE.Group(); t.position.set(BX + 0.25 + k * 0.28, 1.75, -D / 2 + 0.46); g.add(t); t.add(M(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), timber, 0, -0.1, 0)); t.add(M(new THREE.BoxGeometry(k === 1 ? 0.05 : 0.14, 0.06, 0.06), IRON, 0, 0.16, 0)); } // martelos e cinzel
    const ingots = []; for (let k = 0; k < 4; k++) { const ig = new THREE.BoxGeometry(0.18, 0.05, 0.08); ig.translate(BX - 0.5 + (k % 2) * 0.2, 1.19 + Math.floor(k / 2) * 0.05, BZ + 0.1 + (k % 2) * 0.02); ingots.push(ig); } g.add(M(mergeGeometries(ingots), std('#8a8a90', { metalness: 0.85, roughness: 0.35 }))); }
  // suporte com duas espadas e um machado prontos, na frente à direita
  { const RX = W / 2 - 0.55, RZ = 0.6, rack = new THREE.Group(); rack.position.set(RX, 0.27, RZ); rack.rotation.y = -Math.PI / 2; g.add(rack);
    for (const sx of [-1, 1]) rack.add(M(new THREE.BoxGeometry(0.07, 1.2, 0.07), timber, sx * 0.55, 0.6, 0));
    rack.add(M(new THREE.BoxGeometry(1.2, 0.06, 0.08), timber, 0, 1.1, 0)); rack.add(M(new THREE.BoxGeometry(1.2, 0.06, 0.2), timber, 0, 0.15, 0));
    for (let k = 0; k < 2; k++) { const sw = new THREE.Group(); sw.position.set(-0.3 + k * 0.3, 0.2, 0); sw.rotation.z = 0.04 * (k ? 1 : -1); rack.add(sw); sw.add(M(new THREE.BoxGeometry(0.05, 0.75, 0.012), std('#b8bcc2', { metalness: 0.9, roughness: 0.25 }), 0, 0.42, 0)); sw.add(M(new THREE.BoxGeometry(0.2, 0.03, 0.04), std('#8a6a3a', { metalness: 0.7, roughness: 0.4 }), 0, 0.8, 0)); sw.add(M(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), std('#3a2418'), 0, 0.9, 0)); }
    const ax = new THREE.Group(); ax.position.set(0.35, 0.2, 0); rack.add(ax); ax.add(M(new THREE.CylinderGeometry(0.02, 0.022, 0.9, 10), timber, 0, 0.45, 0));
    const bl = new THREE.Shape(); bl.moveTo(0, 0); bl.quadraticCurveTo(0.2, -0.05, 0.24, -0.16); bl.lineTo(0.24, 0.16); bl.quadraticCurveTo(0.2, 0.05, 0, 0.06); bl.closePath(); ax.add(M(new THREE.ExtrudeGeometry(bl, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1 }), std('#9aa0a6', { metalness: 0.9, roughness: 0.3 }), 0.01, 0.78, -0.01)); }
  // rebolo (pedra de amolar) na frente à esquerda
  { const gx = -W / 2 + 0.9, gz = D / 2 - 0.9, gs = new THREE.Group(); gs.position.set(gx, 0.27, gz); gs.rotation.y = 0.3; g.add(gs);
    for (const s of [-1, 1]) gs.add(M(new THREE.BoxGeometry(0.06, 0.75, 0.06), timber, s * 0.16, 0.37, 0));
    const wheel = M(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 30), STONE_MAT, 0, 0.72, 0, 0, 0, Math.PI / 2); { const n = wheel.geometry.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = 0.62; c[i * 3 + 1] = 0.58; c[i * 3 + 2] = 0.5; } wheel.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); } gs.add(wheel);
    gs.add(M(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), IRON, 0, 0.72, 0, 0, 0, Math.PI / 2)); gs.add(M(new THREE.BoxGeometry(0.03, 0.18, 0.03), IRON, 0.26, 0.64, 0)); }
  // placa pendurada na viga da frente: bigorna pintada
  { const sign = new THREE.Group(); sign.position.set(W / 2 - 1.0, H + 0.05, D / 2 + 0.05); g.add(sign);
    const st = canvasTex('smithsign', 256, 128, (gg, Wd, Hh) => { woodGrain(gg, Wd, Hh, [120, 82, 48], 29); gg.strokeStyle = '#3a2210'; gg.lineWidth = 6; gg.strokeRect(6, 6, Wd - 12, Hh - 12); gg.fillStyle = '#2a2624'; gg.beginPath(); gg.moveTo(60, 50); gg.lineTo(190, 50); gg.lineTo(200, 40); gg.lineTo(210, 50); gg.lineTo(170, 60); gg.lineTo(160, 80); gg.lineTo(180, 96); gg.lineTo(80, 96); gg.lineTo(100, 80); gg.lineTo(90, 62); gg.quadraticCurveTo(50, 60, 40, 46); gg.closePath(); gg.fill(); });
    sign.add(M(new THREE.BoxGeometry(0.95, 0.48, 0.04), new THREE.MeshStandardMaterial({ map: st, roughness: 0.85 }), 0, -0.45, 0));
    for (const s of [-1, 1]) sign.add(M(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), IRON, s * 0.38, -0.1, 0)); }
  g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.radius = 3.0;
  return bakeGroup(g);
}

/* =========================================================================
   S-132: pedra e madeira com relevo nos modelos prontos (KayKit).
   Todos usam a mesma textura-paleta; o shader olha a cor de cada pixel:
   cinza → pedra aparelhada (blocos irregulares, argamassa funda, granulado),
   marrom → veio de madeira, branco → reboco com manchas. Tudo em coordenada
   de mundo (escala real) e com relevo calculado na hora (sem texturas extras).
   ========================================================================= */
const KK_CHUNK_V = `
  varying vec3 vAeWP; varying vec3 vAeWN;`;
const KK_CHUNK_F = `
  varying vec3 vAeWP; varying vec3 vAeWN;
  float aeH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float aeN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(aeH(i), aeH(i + vec2(1, 0)), f.x), mix(aeH(i + vec2(0, 1)), aeH(i + vec2(1, 1)), f.x), f.y); }
  float aeF(vec2 p){ return aeN(p) * 0.5 + aeN(p * 2.1) * 0.25 + aeN(p * 4.3) * 0.125; }
  // pedra aparelhada: fiadas de altura variável, juntas desencontradas, bordas gastas
  float aeStone(vec2 p, out float id){
    float row = floor(p.y / 0.36); float rh = aeH(vec2(row, 7.0));
    float y = fract(p.y / 0.36);
    float x = p.x / (0.55 + rh * 0.25) + row * 0.5 + rh * 3.0;
    float col = floor(x); float fx = fract(x);
    id = aeH(vec2(col, row));
    float e = min(min(fx, 1.0 - fx) * (0.55 + rh * 0.25), min(y, 1.0 - y) * 0.36);
    float n = aeF(p * 3.0 + id * 9.0);
    return smoothstep(0.0, 0.035 + n * 0.03, e - 0.012) * (0.85 + aeF(p * 9.0 + id) * 0.15);
  }`;
function patchKayKit(mat) {
  if (mat.userData.aePatched) return; mat.userData.aePatched = true;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + KK_CHUNK_V)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vAeWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vAeWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + KK_CHUNK_F)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 aeC = diffuseColor.rgb; float aeMx = max(aeC.r, max(aeC.g, aeC.b)), aeMn = min(aeC.r, min(aeC.g, aeC.b));
        float aeSat = aeMx > 0.001 ? (aeMx - aeMn) / aeMx : 0.0, aeLum = dot(aeC, vec3(0.299, 0.587, 0.114));
        vec3 aeAN = abs(vAeWN);
        vec2 aeUV = aeAN.y > 0.7 ? vAeWP.xz : vec2(aeAN.x > aeAN.z ? vAeWP.z : vAeWP.x, vAeWP.y);
        float aeHt = 0.0;
        float isStone = step(aeSat, 0.32) * step(0.04, aeLum) * step(aeLum, 0.5); // cinza (o cinza do KayKit é azulado: saturação ~0,22)
        float isWood = step(0.33, aeSat) * step(aeC.b, aeC.g) * step(aeC.g, aeC.r) * step(aeLum, 0.55) * step(aeC.r - aeC.b, 0.6);
        float isPlaster = step(aeSat, 0.32) * step(0.5, aeLum);
        if (isStone > 0.5) {
          float id; float s = aeStone(aeUV, id);
          float grain = aeN(aeUV * 38.0) * 0.6 + aeN(aeUV * 90.0) * 0.4;           // granulado da pedra
          aeHt = s + grain * 0.12;
          float tone = 0.72 + id * 0.42 + (aeF(aeUV * 1.3 + id * 5.0) - 0.5) * 0.25;  // cada bloco com seu tom
          diffuseColor.rgb *= mix(0.32, 1.0, s) * tone * (0.9 + grain * 0.13);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.0, 0.88), smoothstep(0.55, 1.0, id)); // blocos mais quentes
          float up = smoothstep(0.55, 0.9, vAeWN.y), mossN = aeF(aeUV * 1.7 + 11.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.22, 0.08), up * smoothstep(0.45, 0.75, mossN) * 0.6);  // musgo em cima
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.66, 0.6), smoothstep(0.55, 0.85, aeF(aeUV * 0.6 + 4.0)) * 0.5); // manchas de chuva
        } else if (isWood > 0.5) {
          vec2 q = aeAN.y > 0.7 ? aeUV : vec2(aeUV.x * 1.0, aeUV.y * 0.12);
          float gr = aeF(vec2(q.x * 9.0, q.y * 2.0)) ; float lines = sin((q.x + gr * 0.35) * 70.0) * 0.5 + 0.5;
          aeHt = lines * 0.35 + gr * 0.4;
          diffuseColor.rgb *= 0.78 + lines * 0.16 + gr * 0.18;
        } else if (isPlaster > 0.5) {
          float n = aeF(aeUV * 2.5); aeHt = n * 0.4;
          diffuseColor.rgb *= 0.9 + n * 0.12;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.88, 0.8), smoothstep(0.6, 0.9, aeF(aeUV * 0.7 + 3.0)) * 0.6);
        } else {
          float n = aeF(aeUV * 5.0); aeHt = n * 0.25; diffuseColor.rgb *= 0.92 + n * 0.12;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition);
          vec3 R1 = cross(sY, normal), R2 = cross(normal, sX); float det = dot(sX, R1);
          float k = isStone > 0.5 ? 0.035 : 0.01;
          vec3 grad = sign(det) * (dFdx(aeHt) * R1 + dFdy(aeHt) * R2) * k;
          normal = normalize(abs(det) * normal - grad / max(abs(det), 1e-6) * abs(det));
        }`);
  };
  mat.customProgramCacheKey = () => 'aethra-kaykit-v1';
  mat.needsUpdate = true;
}
export function retextureKayKit(MODELS) {
  let n = 0;
  for (const v of Object.values(MODELS)) {
    if (!v || !v.scene || v.native) continue;
    v.scene.traverse(o => { if (!o.isMesh || o.isSkinnedMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.name === 'hexagons_medieval' && !m.userData.aePatched) { patchKayKit(m); n++; } });
  }
  return n;
}
