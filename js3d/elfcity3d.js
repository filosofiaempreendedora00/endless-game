/* =========================================================================
   AELINDRA, A CIDADE NA ÁRVORE-MÃE (2026-11-12: "muito mais élfica")
   Uma cidade que mora DENTRO da floresta, não numa clareira:
   • Sylvaren, a Árvore-Mãe (S-390: "árvore da vida"): tronco de 12 m de diâmetro com luz viva na casca e filamentos que brilham;
     uma rampa em espiral sobe em volta dele até o Terraço das Folhas (12 m)
     e o Mirante do Conselho (24 m). Tudo isso é chão de verdade (levels3d).
   • Três árvores-irmãs com plataformas e casas na copa, ligadas ao terraço
     por pontes suspensas.
   • No chão: a Fonte da Lua, casas de teto em folha, o mercado sob velas de
     seda, pedras-lua com runas, o Portal das Raízes e um bosque denso, com
     arbustos, cogumelos que brilham e vaga-lumes.
   Referências de espírito (nunca de conteúdo): vila na árvore do RO, os
   salões nas árvores dos filmes de elfos, as cidades-árvore do WoW.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { heightAt, ELF } from './world3d.js';
import { Kit, M, rngOf, makeBanner, CULL } from './cities3d.js';
import { addLevel, levelWall } from './levels3d.js';
import { leafAtlas, card, cardGeo, rndDir } from './trees3d.js';

const C = ELF;
const TAU = Math.PI * 2;
const mats = {};
const P = (k, color, o = {}) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1, side: o.side || THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 }));

/* ---------------- materiais ---------------- */
// S-390: casca lisa e viva (nada de riscos): manchas suaves, sulcos largos em relevo (bump) e musgo — a mesma para as irmãs e o bosque
let _barkTex = null;
function barkTextures() {
  if (_barkTex) return _barkTex;
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngOf(4441);
  const wrap = (fn) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); };
  g.fillStyle = '#b7b0a1'; g.fillRect(0, 0, N, N);
  g.filter = 'blur(10px)';
  for (let k = 0; k < 160; k++) { const x = r() * N, y = r() * N, rr = 30 + r() * 90, l = r() < 0.5; wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, l ? 'rgba(232,228,214,0.35)' : 'rgba(120,112,98,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); }); }
  g.filter = 'blur(4px)';
  for (let k = 0; k < 26; k++) { const x0 = r() * N, w = 6 + r() * 14, A = 6 + r() * 10, ph = r() * TAU; g.fillStyle = `rgba(96,88,76,${0.18 + r() * 0.12})`; // sulcos largos e macios, que emendam
    wrap((ox, oy) => { g.beginPath(); for (let y = 0; y <= N; y += 16) { const x = x0 + ox + A * Math.sin(y / N * TAU + ph); y ? g.lineTo(x - w / 2, y + oy) : g.moveTo(x - w / 2, y + oy); } for (let y = N; y >= 0; y -= 16) g.lineTo(x0 + ox + A * Math.sin(y / N * TAU + ph) + w / 2, y + oy); g.closePath(); g.fill(); }); }
  g.filter = 'blur(6px)';
  for (let k = 0; k < 30; k++) { const x = r() * N, y = r() * N; wrap((ox, oy) => { g.fillStyle = `rgba(104,138,84,${0.16 + r() * 0.12})`; g.beginPath(); g.ellipse(x + ox, y + oy, 14 + r() * 30, 8 + r() * 18, 0, 0, TAU); g.fill(); }); } // musgo
  g.filter = 'none';
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; map.repeat.set(5, 6);
  return (_barkTex = { map });
}
let _bark = null, _barkTube = null;
function silverBark() { if (_bark) return _bark; const { map } = barkTextures(); return (_bark = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 4, roughness: 0.82 })); }
function barkTube() { // raízes e galhos: U corre ao longo do tubo, então a textura gira 90°
  if (_barkTube) return _barkTube; const t = barkTextures().map.clone(); t.needsUpdate = true; t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(2, 4);
  return (_barkTube = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 4, roughness: 0.82 }));
}
// S-390: a Árvore-Mãe é uma "árvore da vida": trilhas de pontinhos de luz (bioluminescência) que correm pela casca e pulsam devagar,
// calculadas no shader pela posição no mundo (sem riscos desenhados e sem repetição de textura)
const GLOW_T = { value: 0 };
function glowBark(base) {
  const m = base.clone();
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = GLOW_T;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vGW; uniform float uT;
float gh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float gn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y), mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 p = vGW; // nada de linhas: manchas de "sardas" de luz (pontinhos redondos agrupados), como um bicho bioluminescente
  float cluster = smoothstep(0.42, 0.66, gn(p * vec3(0.32, 0.11, 0.32) + vec3(3.1, 0.0, 7.7)));
  vec3 q = p * 2.2, ci = floor(q), cp = ci + 0.25 + 0.5 * vec3(gh(ci), gh(ci + 7.3), gh(ci + 3.1)); float rad = 0.1 + 0.16 * gh(ci + 1.7); // um ponto redondo por célula (nunca cortado pela borda)
  float spot = step(0.3, gh(ci + 5.5)) * smoothstep(rad, rad * 0.35, length(q - cp));
  float pulse = 0.7 + 0.3 * sin(uT * 1.1 + gn(p * 0.5) * 6.28);
  vec3 col = mix(vec3(0.16, 0.85, 0.78), vec3(0.62, 0.42, 0.95), gn(p * 0.09));
  totalEmissiveRadiance += col * cluster * spot * pulse * 1.4; }`);
  };
  m.customProgramCacheKey = () => 'aethraGlowBark' + (base === _barkTube ? 't' : 'l');
  return m;
}
let _glowL = null, _glowR = null;
const motherBark = () => _glowL || (_glowL = glowBark(silverBark()));
const motherRoot = () => _glowR || (_glowR = glowBark(barkTube()));
// filamentos de luz pendurados (como um salgueiro que brilha): fitas finas cruzadas, do verde-água (em cima) ao violeta (na ponta), balançando com o vento
function glowStrands(list, seed) { // list = [[x, yTop, z, len]]
  const rng = rngOf(seed), pos = [], col = [], hang = [], ph = [], idx = [], top = new THREE.Color('#3aa890'), tip = new THREE.Color('#b47ae0'), c = new THREE.Color();
  for (const [x, y, z, len] of list) { const w = 0.07 + rng() * 0.05, seg = 24, p0 = rng() * TAU, ca = rng() * TAU, cr = 0.5 + rng() * 1.0, beads = 4 + Math.floor(rng() * 4);
    for (const rot of [0, Math.PI / 2]) { const dx = Math.cos(rot), dz = Math.sin(rot), base = pos.length / 3;
      for (let i = 0; i <= seg; i++) { const t = i / seg, yy = y - t * len, bend = Math.sin(t * Math.PI * 0.5) * cr; // cai em curva, não reta
        const bead = Math.pow(Math.abs(Math.sin(t * Math.PI * beads)), 6), ww = w * (0.45 + 1.6 * bead) * (1 - t * 0.35); // contas de luz ao longo do filamento
        c.copy(top).lerp(tip, Math.pow(t, 1.2)).multiplyScalar(0.45 + bead * 0.9 + t * 0.35);
        for (const s of [-1, 1]) { pos.push(x + Math.cos(ca) * bend + s * dx * ww, yy, z + Math.sin(ca) * bend + s * dz * ww); col.push(c.r, c.g, c.b); hang.push(t); ph.push(p0); } }
      for (let i = 0; i < seg; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hang, 1)); g.setAttribute('aP', new THREE.Float32BufferAttribute(ph, 1)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.uT = GLOW_T; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH; attribute float aP; uniform float uT;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat k = aH * aH; transformed.x += (sin(uT * 0.8 + aP) * 0.45 + sin(uT * 1.9 + aP * 2.0) * 0.08) * k; transformed.z += cos(uT * 0.6 + aP * 1.3) * 0.38 * k;'); };
  m.customProgramCacheKey = () => 'aethraStrands';
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
}

let _leaf = null;
function leafMat() { // as folhas desenhadas dos carvalhos, aqui em verde-prata com pontas douradas (cor por vértice)
  if (_leaf) return _leaf;
  const map = leafAtlas('leaf'), m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.74, emissive: new THREE.Color('#101c0a') });
  return (_leaf = { m, dm: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 }) });
}
let _silk = null;
function silkMat() { // seda do mercado: verde-água com bordado dourado de folhas
  if (_silk) return _silk;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#e8f2ea'); gr.addColorStop(1, '#9cc8b4'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(200,162,74,0.85)'; g.lineWidth = 3; g.strokeRect(8, 8, 240, 240);
  for (let k = 0; k < 6; k++) { const x = 40 + k * 36, y = 128 + Math.sin(k) * 30; g.fillStyle = 'rgba(200,162,74,0.7)'; g.beginPath(); g.ellipse(x, y, 7, 16, k * 0.6, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_silk = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.6 }));
}
let _rune = null;
function runeMat() { // pedra-lua: mármore com runas que brilham
  if (_rune) return _rune;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'), r = rngOf(2025);
  g.fillStyle = '#d8d6d0'; g.fillRect(0, 0, 128, 256); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(120,120,128,${r() * 0.12})`; g.fillRect(r() * 128, r() * 256, 3, 3); }
  const e = document.createElement('canvas'); e.width = 128; e.height = 256; const ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 256);
  for (const G of [g, ge]) { G.strokeStyle = G === g ? '#5aa8c8' : '#9fe6ff'; G.lineWidth = 3; for (let k = 0; k < 7; k++) { const y = 40 + k * 26; G.beginPath(); G.moveTo(50, y); G.lineTo(64, y - 10); G.lineTo(78, y); if (k % 2) { G.moveTo(64, y - 10); G.lineTo(64, y + 10); } else { G.moveTo(54, y + 8); G.lineTo(74, y + 8); } G.stroke(); } }
  const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e); t.colorSpace = te.colorSpace = THREE.SRGBColorSpace;
  return (_rune = new THREE.MeshStandardMaterial({ map: t, emissiveMap: te, emissive: '#ffffff', emissiveIntensity: 1.1, roughness: 0.5 }));
}
const glowSprite = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(200,255,190,0.8)'); gr.addColorStop(1, 'rgba(120,255,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); return t; }; })();

let _roof2 = null; const roofDouble = () => _roof2 || (_roof2 = (() => { const m = M.leafRoof().clone(); m.side = THREE.DoubleSide; return m; })()); // teto visto de baixo também

/* ---------------- árvores ---------------- */
// copa: cachos de cartões de folhas em volta de cada ponta de galho
function canopyGeo(seed, clusters, cardSize = 3, center = new THREE.Vector3(), perCluster = false) {
  const rng = rngOf(seed), out = { pos: [], nor: [], uv: [], col: [], idx: [] }, tmp = new THREE.Color();
  for (const [x, y, z, rr] of clusters) {
    const n = Math.round(10 + rr * rr * 1.5);
    for (let k = 0; k < n; k++) {
      const dir = rndDir(rng), along = Math.pow(rng(), 0.55);
      const px = x + dir.x * rr * along * 0.9, py = y + dir.y * rr * along * 0.6, pz = z + dir.z * rr * along * 0.9;
      const cen = perCluster ? new THREE.Vector3(x, y, z) : center, sz = cardSize * (0.75 + rng() * 0.6), o2 = new THREE.Vector3(px - cen.x, (py - cen.y) * 0.6, pz - cen.z).normalize();
      const dc = o2.add(rndDir(rng).multiplyScalar(0.6)).normalize(), up = new THREE.Vector3(rng() - 0.5, 1, rng() - 0.5).normalize(); if (Math.abs(dc.dot(up)) > 0.95) up.set(1, 0, 0);
      const gold = py > y && rng() < 0.28 ? 0.45 + rng() * 0.55 : 0, silver = rng() * 0.25;
      card(out, { cx: px - dc.x * sz * 0.5, cy: py - dc.y * sz * 0.5, cz: pz - dc.z * sz * 0.5, w: sz, h: sz, dir: dc, up, uvq: Math.floor(rng() * 4), droop: sz * 0.12, center: cen,
        shade: (X, Y, Z) => { const inner = Math.min(1, Math.hypot(X - x, (Y - y) * 1.3, Z - z) / rr), top = Math.min(1, Math.max(0, (Y - (y - rr)) / (2 * rr))); const v = 0.55 + inner * 0.34 + top * 0.26;
          return tmp.setRGB(v * (0.9 + gold * 0.8 + silver * 0.3), v * (1.0 + gold * 0.22 + silver * 0.25), v * (0.9 - gold * 0.5 + silver * 0.4)); } });
    }
  }
  return cardGeo(out);
}
function leafMesh(geo) { const L = leafMat(), m = new THREE.Mesh(geo, L.m); m.customDepthMaterial = L.dm; m.castShadow = true; m.receiveShadow = true; return m; }
// tubo que afina de r0 até r1 (raiz, galho, tronco do portal) — nada de "cano" de grossura igual
function taperTube(curve, segs, r0, r1, radial = 12) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), Pp = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) { const t = i / segs; curve.getPointAt(t, c); const rr = r0 + (r1 - r0) * Math.pow(t, 0.8);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(Pp, k).sub(c).multiplyScalar(rr).add(c); Pp.setXYZ(k, v.x, v.y, v.z); } }
  g.computeVertexNormals(); return g;
}
// galho: afina de "from" até "to", subindo em curva
function branch(K, from, to, r0, r1, mat) {
  const mid = from.clone().lerp(to, 0.5); mid.y += from.distanceTo(to) * 0.12;
  K.add(taperTube(new THREE.CatmullRomCurve3([from, mid, to]), 20, r0, r1, 12), mat === silverBark() ? barkTube() : mat === motherBark() ? motherRoot() : mat);
}
// árvore gigante de casca prateada (as irmãs e as do bosque): tronco liso com sulcos, galhos e copa de folhas
function giantTree(seed, H, R0, crownR) {
  const K = new Kit(), r = rngOf(seed), bark = silverBark();
  const prof = []; for (let k = 0; k <= 24; k++) { const t = k / 24, y = t * H - 1; prof.push(new THREE.Vector2(Math.max(0.35, R0 * (1 - t * 0.7)) + Math.pow(1 - t, 10) * R0 * 0.6, y)); }
  const tr = new THREE.LatheGeometry(prof, 28), Pp = tr.attributes.position;
  for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i), y = Pp.getY(i), z = Pp.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 7 + y * 0.08) * 0.04; Pp.setXYZ(i, x * k, y, z * k); }
  tr.computeVertexNormals(); K.add(tr, bark);
  const roots = []; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + r(); roots.push(a); branch(K, new THREE.Vector3(Math.cos(a) * R0 * 0.8, 1.6, Math.sin(a) * R0 * 0.8), new THREE.Vector3(Math.cos(a) * (R0 + 2.6), -0.5, Math.sin(a) * (R0 + 2.6)), R0 * 0.32, R0 * 0.18, bark); } // raízes
  const clusters = [[0, H + crownR * 0.1, 0, crownR * 0.75]], nb = 6;
  for (let k = 0; k < nb; k++) { const a = k / nb * TAU + r() * 0.5, d = crownR * (0.7 + r() * 0.35), y0 = H * (0.55 + r() * 0.2), ty = H * 0.78 + r() * crownR * 0.5;
    branch(K, new THREE.Vector3(0, y0, 0), new THREE.Vector3(Math.cos(a) * d, ty, Math.sin(a) * d), R0 * 0.38, R0 * 0.14, bark);
    clusters.push([Math.cos(a) * d, ty + 1, Math.sin(a) * d, crownR * (0.5 + r() * 0.2)]); }
  return { trunk: K.build(), leaves: leafMesh(canopyGeo(seed * 7 + 1, clusters, crownR * 0.42, new THREE.Vector3(0, H * 0.85, 0))), roots, R0 };
}

/* ---------------- a Árvore-Mãe e o caminho em espiral ---------------- */
const MT = { x: 0, z: -6 };                 // posição (local) da Árvore-Mãe
const TR = 6.4, RW = 2.4, RC = TR + RW / 2;  // raio do tronco (colisão), largura e raio central da rampa
const A0 = Math.PI / 2, DA = Math.PI / 6;   // começa ao sul do tronco, 30° por trecho
const D1 = 12.05, D2 = 24.05;               // Terraço das Folhas e Mirante do Conselho (acima do pé da árvore)
const R1 = 13.6, R2 = 12;                   // raio de fora do terraço e do mirante
const LAND = new Set([16, 17, 34, 35]);
const ROOT_DEG = [240, 300, 330, 358], DOOR_DEG = 270; // raízes só onde a rampa já está alta; porta entre duas raízes     // trechos planos (patamares que abrem para os terraços)
const SEGS = 36;
const HOUSES = [[-37, 4], [-27, 35], [40, 2], [13, -40], [-15, -40]];
function rampProfile() { const ys = [0.05]; for (let k = 0; k < SEGS; k++) ys.push(ys[k] + (LAND.has(k) ? 0 : 0.75)); return ys; }
const BRIDGES = [ // árvores-irmãs (local), raio do tronco e raio da plataforma
  { id: 'oeste', x: -29, z: -19, tr: 3.3, R: 8, house: 'Casa da Tecelã' },
  { id: 'leste', x: 29, z: -16, tr: 3.3, R: 8, house: 'Posto das Sentinelas' },
  { id: 'sudeste', x: 25, z: 18, tr: 3.1, R: 7.6, house: 'Casa do Bardo' },
];

function motherTree(K, leafParts, r, strands) {
  const bark = motherBark(), H = 60;
  const Rt = y => y < 27 ? 5.75 - y * 0.004 : Math.max(0.5, 5.65 - (y - 27) * 0.165);
  const prof = []; for (let k = 0; k <= 60; k++) { const y = k / 60 * H - 1; prof.push(new THREE.Vector2(Rt(Math.max(0, y)), y)); }
  const tr = new THREE.LatheGeometry(prof, 72), Pp = tr.attributes.position;
  // sulcos fundos e torcidos (tronco "canelado" de árvore milenar) — o raio nunca passa de 6,35 m onde a rampa encosta;
  // a base se alarga em contrafortes só no lado em que a rampa já está alta (de 240° a 390°)
  const flareK = a => { const deg = ((a * 180 / Math.PI) % 360 + 360) % 360, d = (deg - 240 + 360) % 360, door = Math.abs(deg - DOOR_DEG); return d < 150 ? Math.sin(d / 150 * Math.PI) * Math.min(1, Math.max(0, (door - 12) / 14)) : 0; }; // e nada na frente da porta
  for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i), y = Pp.getY(i), z = Pp.getZ(i), a = Math.atan2(z, x), tw = a + y * 0.012;
    let k = 1 + 0.1 * Math.sin(tw * 9) + 0.03 * Math.sin(tw * 23 + y * 0.2);
    const fl = y < 3.2 ? flareK(a) * Math.pow(1 - Math.max(0, y) / 3.2, 2) * (2.6 + 1.2 * Math.max(0, Math.sin(tw * 9))) : 0;
    const R = Math.hypot(x, z) || 1, nr = Math.min(y < 27 ? 6.35 : 99, R * k) + fl; Pp.setXYZ(i, x / R * nr, y, z / R * nr); }
  tr.computeVertexNormals(); K.add(tr, bark);
  // raízes enormes, só do lado em que a rampa já está alta (não atrapalham a subida nem a chegada)
  const roots = [];
  for (const deg of ROOT_DEG) { const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const pts = [[5.4, 2.4], [8.5, 1.8], [11.5, 0.7], [14.5, -0.4], [16, -1.0]].map(([d, y]) => new THREE.Vector3(ca * d, y, sa * d));
    K.add(taperTube(new THREE.CatmullRomCurve3(pts), 30, 1.35, 0.25, 14), motherRoot()); roots.push(a);
    for (const s of [-0.18, 0.18]) { const a2 = a + s, p2 = [[5.6, 1.2], [8, 0.5], [10.5, -0.5]].map(([d, y]) => new THREE.Vector3(Math.cos(a2) * d, y, Math.sin(a2) * d)); K.add(taperTube(new THREE.CatmullRomCurve3(p2), 16, 0.7, 0.15, 10), motherRoot()); } }
  // porta da Árvore-Mãe (ao norte, entre as raízes): arco de luz e folhas de madeira entalhada
  { const a = DOOR_DEG * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ry = Math.atan2(ca, sa);
    const sh = new THREE.Shape(); sh.moveTo(-1.2, 0); sh.lineTo(1.2, 0); sh.lineTo(1.2, 2.4); sh.quadraticCurveTo(1.2, 3.6, 0, 4.2); sh.quadraticCurveTo(-1.2, 3.6, -1.2, 2.4); sh.closePath();
    K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), M.elfWood(), ca * 6.02, 0, sa * 6.02, ry);
    K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-1.35, 0], [-1.35, 2.5], [-0.8, 3.7], [0, 4.4], [0.8, 3.7], [1.35, 2.5], [1.35, 0]].map(([u, y]) => new THREE.Vector3(ca * 6.12 + Math.cos(ry) * u, y, sa * 6.12 - Math.sin(ry) * u))), 40, 0.09, 8), M.moonGlow());
    for (const s of [-1, 1]) K.add(new THREE.SphereGeometry(0.12, 12, 8), M.gold(), ca * 6.16 + Math.cos(ry) * s * 0.35, 1.6, sa * 6.16 - Math.sin(ry) * s * 0.35); }
  // galhos e copa (começa a 30 m: o mirante a 24 m fica sob a copa)
  const clusters = [[0, 56, 0, 10]], nb = 8;
  for (let k = 0; k < nb; k++) { const a = k / nb * TAU + 0.3 + r() * 0.3, d = 18 + r() * 7, y0 = 30 + r() * 6, ty = 40 + r() * 8;
    branch(K, new THREE.Vector3(Math.cos(a) * 3.5, y0, Math.sin(a) * 3.5), new THREE.Vector3(Math.cos(a) * d, ty, Math.sin(a) * d), 1.5, 0.45, bark);
    clusters.push([Math.cos(a) * d, ty + 1.5, Math.sin(a) * d, 8 + r() * 2], [Math.cos(a) * d * 0.55, ty + 4, Math.sin(a) * d * 0.55, 7]); }
  leafParts.push(canopyGeo(777, clusters, 3.6, new THREE.Vector3(0, 46, 0)));
  // S-390: cortinas de filamentos de luz pendendo da copa (nunca descem sobre os terraços nem sobre as pontes)
  for (const [x, y, z, rr] of clusters) for (let k = 0; k < 16; k++) { const a = r() * TAU, d = Math.sqrt(r()) * rr * 0.9, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, top = y - rr * 0.3 - r() * 1.5, rad = Math.hypot(px, pz);
    const minB = rad < 15 ? 27.5 : 15.5, len = Math.min(3 + r() * 7, top - minB); if (len > 1.5) strands.push([px, top, pz, len]); }
  // flores-lua penduradas sob a copa
  for (let k = 0; k < 28; k++) { const a = r() * TAU, d = 10 + r() * 14, y = 31 + r() * 6, len = 1.5 + r() * 3;
    K.cyl(0.015, 0.015, len, M.rope(), Math.cos(a) * d, y + len / 2, Math.sin(a) * d, 4); K.add(new THREE.SphereGeometry(0.22, 12, 8), M.moonGlow(), Math.cos(a) * d, y, Math.sin(a) * d, 0, 0, 0, 1, 1.4, 1); }
  return roots;
}
// rampa em espiral (trechos retos tangentes ao tronco), com tábuas, guarda-corpo do lado de fora e mãos-francesas
function rampSegment(k, ys) { const a = A0 + k * DA, b = a + DA, p0 = [Math.cos(a) * RC, Math.sin(a) * RC], p1 = [Math.cos(b) * RC, Math.sin(b) * RC], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), t = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
  return { a, b, p0, p1, L, t, n: [t[1], -t[0]], y0: ys[k], y1: ys[k + 1] }; } // n = normal para FORA (o giro é anti-horário em x/z)
function buildRamp(K, ys) {
  const wd = M.elfWood(), out = [];
  for (let k = 0; k < SEGS; k++) {
    const s = rampSegment(k, ys), ry = Math.atan2(s.t[0], s.t[1]), pitch = Math.atan2(s.y1 - s.y0, s.L), ext = 0.35;
    // normal para fora: confere o sinal (aponta para longe do tronco)
    const mx = (s.p0[0] + s.p1[0]) / 2, mz = (s.p0[1] + s.p1[1]) / 2; if (s.n[0] * mx + s.n[1] * mz < 0) { s.n[0] *= -1; s.n[1] *= -1; }
    const np = Math.round((s.L + ext * 2) / 0.32);
    for (let j = 0; j < np; j++) { const f = (j + 0.5) / np, along = -ext + f * (s.L + ext * 2), x = s.p0[0] + s.t[0] * along, z = s.p0[1] + s.t[1] * along, y = s.y0 + (s.y1 - s.y0) * along / s.L;
      K.box(RW, 0.09, 0.3, wd, x, y - 0.045, z, ry, -pitch); }
    K.box(0.16, 0.22, s.L + ext * 2, wd, mx + s.n[0] * (RW / 2 - 0.08), (s.y0 + s.y1) / 2 - 0.2, mz + s.n[1] * (RW / 2 - 0.08), ry, -pitch); // longarina de fora
    if (!LAND.has(k)) { // guarda-corpo: postes de prata e corrimão de madeira
      for (const f of [0.1, 0.55]) { const x = s.p0[0] + s.t[0] * s.L * f + s.n[0] * (RW / 2 - 0.08), z = s.p0[1] + s.t[1] * s.L * f + s.n[1] * (RW / 2 - 0.08), y = s.y0 + (s.y1 - s.y0) * f; K.cyl(0.035, 0.04, 1.05, M.silver(), x, y + 0.52, z, 8); }
      K.box(0.1, 0.08, s.L + 0.1, wd, mx + s.n[0] * (RW / 2 - 0.08), (s.y0 + s.y1) / 2 + 1.05, mz + s.n[1] * (RW / 2 - 0.08), ry, -pitch); }
    if (k % 2 === 1 && s.y0 > 1.5) { const a = (s.a + s.b) / 2, y = (s.y0 + s.y1) / 2; K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 6.0, y - 1.8, Math.sin(a) * 6.0), new THREE.Vector3(Math.cos(a) * 7.2, y - 0.8, Math.sin(a) * 7.2), new THREE.Vector3(Math.cos(a) * 8.4, y - 0.2, Math.sin(a) * 8.4)]), 10, 0.1, 6), wd); } // mão-francesa curva
    if (k % 3 === 0 && s.y0 > 2) { const x = mx + s.n[0] * (RW / 2 + 0.05), z = mz + s.n[1] * (RW / 2 + 0.05), y = (s.y0 + s.y1) / 2; K.add(new THREE.SphereGeometry(0.16, 12, 8), M.moonGlow(), x, y + 0.6, z); K.add(new THREE.ConeGeometry(0.19, 0.18, 12, 1, true), M.silver(), x, y + 0.82, z); } // lanterninhas
    out.push(s);
  }
  return out;
}
// plataforma redonda (anel) em volta de um tronco: tábuas radiais, borda, guarda-corpo com vãos (pontes/rampa) e mísulas
function ringDeck(K, r0, R, y, gaps, opts = {}) {
  const wd = M.elfWood(), N = Math.max(24, Math.round(R * 6));
  const inGap = a => gaps.some(([g, w]) => { let d = Math.abs(((a - g) % TAU + TAU) % TAU); d = Math.min(d, TAU - d); return d < w; });
  for (let k = 0; k < N; k++) { const a = k / N * TAU, a2 = (k + 1) / N * TAU, am = (a + a2) / 2;
    if (opts.skip && opts.skip(am)) continue;
    const ri = opts.inner && opts.inner(am) ? opts.inner(am) : r0, len = R - ri, w = 2 * R * Math.sin(Math.PI / N) + 0.04;
    const g = new THREE.BoxGeometry(w, 0.14, len); K.add(g, wd, Math.cos(am) * (ri + len / 2), y - 0.07, Math.sin(am) * (ri + len / 2), Math.atan2(Math.cos(am), Math.sin(am)));
    if (!inGap(am) && !opts.noRail) { K.cyl(0.04, 0.045, 1.05, M.silver(), Math.cos(a) * (R - 0.12), y + 0.52, Math.sin(a) * (R - 0.12), 8);
      K.box(0.1, 0.08, 2 * (R - 0.12) * Math.sin(Math.PI / N) + 0.06, wd, Math.cos(am) * (R - 0.12), y + 1.05, Math.sin(am) * (R - 0.12), Math.atan2(-Math.sin(am), Math.cos(am))); } }
  K.add(new THREE.CylinderGeometry(R, R, 0.36, 64, 1, true), wd, 0, y - 0.25, 0); // borda
  K.add(new THREE.TorusGeometry(R + 0.02, 0.05, 6, 80), M.gold(), 0, y - 0.07, 0, 0, Math.PI / 2);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * (r0 - 0.4), y - 3.2, Math.sin(a) * (r0 - 0.4)), new THREE.Vector3(Math.cos(a) * (r0 + (R - r0) * 0.5), y - 1.2, Math.sin(a) * (r0 + (R - r0) * 0.5)), new THREE.Vector3(Math.cos(a) * (R - 0.3), y - 0.3, Math.sin(a) * (R - 0.3))]), 12, 0.16, 8), wd); }
}
// chão de verdade e colisões do anel (em coordenadas do mundo)
function ringLevels(cx, cz, r0, R, Y, gaps, colliders, opts = {}) {
  const N = Math.max(24, Math.round(R * 4));
  const inGap = a => gaps.some(([g, w]) => { let d = Math.abs(((a - g) % TAU + TAU) % TAU); d = Math.min(d, TAU - d); return d < w; });
  for (let k = 0; k < N; k++) { const am = (k + 0.5) / N * TAU; if (opts.skip && opts.skip(am)) continue; const ri = opts.inner && opts.inner(am) ? opts.inner(am) : r0;
    addLevel({ x: cx + Math.cos(am) * (ri - 0.1), z: cz + Math.sin(am) * (ri - 0.1), yaw: Math.atan2(Math.cos(am), Math.sin(am)), w: 2 * (R + 0.15) * Math.sin(Math.PI / N) + 0.25, len: R - ri + 0.2, y0: Y }); }
  const NR = Math.round(R * 5);
  for (let k = 0; k < NR; k++) { const am = (k + 0.5) / NR * TAU; if (inGap(am)) continue; const c = 2 * R * Math.sin(Math.PI / NR) + 0.1;
    levelWall(colliders, cx + Math.cos(am) * (R + 0.05), cz + Math.sin(am) * (R + 0.05), c / 2, 0.12, Math.atan2(Math.cos(am), Math.sin(am)), Y - 0.6, Y + 3.2, 'guarda-corpo'); } // hx = ao longo da borda, hz = espessura (radial)
}

/* ---------------- casas, mercado, fonte, portal ---------------- */
// teto em folha: uma folha dobrada na nervura, pontas viradas para cima, beiral que se curva (nada de chapéu de bruxa)
function leafRoof(K, L, W, H, y, mat) {
  const nu = 36, nv = 16, pos = [], idx = [];
  for (let i = 0; i <= nu; i++) { const u = i / nu * 2 - 1, half = W * Math.pow(Math.max(0, 1 - u * u), 0.75), ridge = H * (1 - 0.18 * u * u) + 0.9 * Math.pow(Math.abs(u), 5);
    for (let j = 0; j <= nv; j++) { const v = j / nv * 2 - 1, av = Math.abs(v); pos.push(v * half, y + ridge - H * 0.85 * Math.pow(av, 1.25) + 0.35 * Math.pow(av, 7) * (1 - Math.abs(u) * 0.5), u * L); } }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  K.add(g, mat);
  const rp = []; for (let i = 0; i <= 24; i++) { const u = i / 24 * 2 - 1; rp.push(new THREE.Vector3(0, y + H * (1 - 0.18 * u * u) + 0.9 * Math.pow(Math.abs(u), 5) + 0.04, u * L * 1.01)); }
  K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 48, 0.07, 6), M.gold()); // nervura dourada
  for (const s of [-1, 1]) { const ep = []; for (let i = 0; i <= 24; i++) { const u = i / 24 * 2 - 1, half = W * Math.pow(Math.max(0, 1 - u * u), 0.75), ridge = H * (1 - 0.18 * u * u) + 0.9 * Math.pow(Math.abs(u), 5); ep.push(new THREE.Vector3(s * half, y + ridge - H * 0.85 + 0.35 * (1 - Math.abs(u) * 0.5) + 0.03, u * L)); } K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ep), 48, 0.05, 6), M.gold()); }
}
// janela em ogiva acesa
function elfWindow(K, x, y, z, ry, w = 0.8, h = 1.6) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h * 0.6); sh.quadraticCurveTo(w / 2, h * 0.9, 0, h); sh.quadraticCurveTo(-w / 2, h * 0.9, -w / 2, h * 0.6); sh.closePath();
  K.add(new THREE.ShapeGeometry(sh, 8), P('elfWin', '#fff4d8', { emissive: '#ffd9a0', ei: 0.9 }), x, y, z, ry);
}
// casa-folha (chão): corpo oval de mármore e madeira clara, janelas em ogiva, porta em arco e o teto em folha
function leafHouse(seed) {
  const K = new Kit(), r = rngOf(seed), mb = M.marble(), wd = M.elfWood(), Lh = 4.6 + r() * 1.2, Wh = 3.2 + r() * 0.6, Hw = 3.4;
  const body = new THREE.CylinderGeometry(1, 1.04, Hw, 40, 1); body.scale(Wh, 1, Lh); K.add(body, mb, 0, Hw / 2, 0);
  const plinth = new THREE.CylinderGeometry(1, 1, 0.5, 40); plinth.scale(Wh + 0.3, 1, Lh + 0.3); K.add(plinth, mb, 0, 0.1, 0);
  const band = new THREE.CylinderGeometry(1, 1, 0.3, 40, 1, true); band.scale(Wh + 0.04, 1, Lh + 0.04); K.add(band, wd, 0, Hw - 0.2, 0);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; K.cyl(0.09, 0.11, Hw, wd, Math.cos(a) * (Wh + 0.04), Hw / 2, Math.sin(a) * (Lh + 0.04), 8); } // montantes de madeira
  for (const [a, w] of [[0.5, 0.8], [-0.5, 0.8], [Math.PI - 0.5, 0.8], [Math.PI + 0.5, 0.8], [Math.PI / 2 + 0.6, 0.7], [-Math.PI / 2 - 0.6, 0.7]]) { const x = Math.sin(a) * (Wh + 0.06), z = Math.cos(a) * (Lh + 0.06); elfWindow(K, x, 1.1, z, Math.atan2(Math.sin(a) / Wh, Math.cos(a) / Lh), w); }
  { const sh = new THREE.Shape(); sh.moveTo(-0.75, 0); sh.lineTo(0.75, 0); sh.lineTo(0.75, 1.7); sh.quadraticCurveTo(0.75, 2.5, 0, 2.8); sh.quadraticCurveTo(-0.75, 2.5, -0.75, 1.7); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }), wd, Wh * 0.98, 0.35, 0, Math.PI / 2);
    K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.85, 0], [-0.85, 1.8], [0, 2.95], [0.85, 1.8], [0.85, 0]].map(([u, y]) => new THREE.Vector3(Wh + 0.12, 0.35 + y, -u))), 30, 0.06, 6), M.gold()); }
  leafRoof(K, Lh + 1.4, Wh + 1.6, 3.4, Hw - 1.45, roofDouble()); // o teto assenta na parede (a beira desce além dela, como beiral)
  for (const s of [-1, 1]) K.add(new THREE.SphereGeometry(0.15, 12, 8), M.moonGlow(), 0, Hw - 1.45 + 3.4 * 0.82 + 0.9 + 0.2, s * (Lh + 1.4)); // gotas de luz nas pontas
  return { K, box: [[0, 0, Wh + 0.2, Lh * 0.82]] };
}
// casa na copa: oca redonda de tábuas claras com teto de pétalas (flor que se abre), porta em arco e janelinhas
function treeHut(K, x, y, z, R, face, seed) {
  const r = rngOf(seed), wd = M.elfWood(), H = 2.7;
  K.add(new THREE.CylinderGeometry(R, R * 1.05, H, 32, 1), P('hutWall', '#d8ccb0', { rough: 0.8 }), x, y + H / 2, z);
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; K.cyl(0.07, 0.08, H, wd, x + Math.cos(a) * (R + 0.03), y + H / 2, z + Math.sin(a) * (R + 0.03), 6); }
  const prof = []; for (let k = 0; k <= 24; k++) { const t = k / 24; prof.push(new THREE.Vector2((R + 1.1) * (1 - Math.pow(t, 0.7)) + 0.05, t * 3.2 + Math.pow(1 - t, 6) * 0.5)); }
  const roof = new THREE.LatheGeometry(prof, 48), Pp = roof.attributes.position;
  for (let i = 0; i < Pp.count; i++) { const px = Pp.getX(i), py = Pp.getY(i), pz = Pp.getZ(i), a = Math.atan2(pz, px), petal = 1 + 0.12 * Math.cos(a * 8) * Math.max(0, 1 - py / 1.6); Pp.setXYZ(i, px * petal, py + 0.25 * Math.max(0, Math.cos(a * 8)) * Math.max(0, 1 - py / 0.8), pz * petal); }
  roof.computeVertexNormals(); K.add(roof, M.leafRoof(), x, y + H, z); K.add(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * 0.97, v.y - 0.08)).reverse(), 48), wd, x, y + H, z);
  K.add(new THREE.ConeGeometry(0.07, 1.6, 10), M.gold(), x, y + H + 3.9, z); K.add(new THREE.SphereGeometry(0.15, 12, 8), M.moonGlow(), x, y + H + 3.2, z);
  const ca = Math.cos(face), sa = Math.sin(face), ry = Math.atan2(ca, sa);
  const sh = new THREE.Shape(); sh.moveTo(-0.55, 0); sh.lineTo(0.55, 0); sh.lineTo(0.55, 1.4); sh.quadraticCurveTo(0.55, 2.0, 0, 2.2); sh.quadraticCurveTo(-0.55, 2.0, -0.55, 1.4); sh.closePath();
  K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), wd, x + ca * (R + 0.02), y, z + sa * (R + 0.02), ry);
  for (const s of [-1, 1]) { const a = face + s * 0.9; elfWindow(K, x + Math.cos(a) * (R + 0.05), y + 1.0, z + Math.sin(a) * (R + 0.05), Math.atan2(Math.cos(a), Math.sin(a)), 0.5, 0.9); }
  r();
}
// lanterna élfica (poste curvo de prata com globo de luz)
function lantern(K, x, y, z, ry, h = 3.2) {
  K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.75, 0), new THREE.Vector3(0.3, h, 0), new THREE.Vector3(0.85, h * 1.02, 0)]), 16, 0.05, 8), M.silver(), x, y, z, ry);
  const lx = x + Math.cos(ry) * 0.85, lz = z - Math.sin(ry) * 0.85; K.add(new THREE.SphereGeometry(0.2, 16, 12), M.moonGlow(), lx, y + h * 0.92, lz); K.add(new THREE.ConeGeometry(0.25, 0.24, 16, 1, true), M.silver(), lx, y + h * 1.0, lz);
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 0.24, 0.04, Math.sin(a) * 0.24), new THREE.Vector3(Math.cos(a) * 0.12, -0.25, Math.sin(a) * 0.12), new THREE.Vector3(0, -0.32, 0)]), 6, 0.012, 4), M.silver(), lx, y + h * 0.98, lz); }
}
// cogumelos que brilham (azul) em tufos
function glowShrooms(K, x, y, z, n, r) {
  const cap = P('shroomCap', '#9ad8ff', { emissive: '#3aa8ff', ei: 0.9, rough: 0.4 }), stem = P('shroomStem', '#e8e4d8', { rough: 0.8 });
  for (let k = 0; k < n; k++) { const a = r() * TAU, d = r() * 0.8, s = 0.5 + r() * 0.9, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    K.cyl(0.03 * s, 0.045 * s, 0.22 * s, stem, px, y + 0.11 * s, pz, 8); K.add(new THREE.SphereGeometry(0.11 * s, 14, 8, 0, TAU, 0, Math.PI / 2), cap, px, y + 0.2 * s, pz, 0, 0, 0, 1, 0.55, 1); }
}

/* ---------------- montagem ---------------- */
export function buildAelindra(ctx) {
  const r = rngOf(9091), W = (dx, dz) => [C.x + dx, C.z + dz], gY = (dx, dz) => heightAt(C.x + dx, C.z + dz);
  const add = (obj, asset, x, z, y, { occ = true, far } = {}) => { obj.position.set(x, y, z); ctx.scene.add(obj); CULL.push(obj); obj.userData.asset = asset; obj.userData.big = true; if (far) obj.userData.far = far; ctx.placed.push(obj); if (occ) ctx.occluders.push(obj); return obj; };
  const col = (dx, dz, rr, o = {}) => ctx.colliders.push({ x: C.x + dx, z: C.z + dz, r: rr, ...o });
  const col0 = ctx.colliders.length; // no fim, as faixas de altura viram "acima do terreno" (é assim que o resolve do main3d compara fora das salas)

  /* ===== Árvore-Mãe, rampa e terraços ===== */
  const [mx, mz] = W(MT.x, MT.z), Y0 = gY(MT.x, MT.z), ys = rampProfile();
  { const K = new Kit(), leaf = [];
    const strands = [], roots = motherTree(K, leaf, r, strands);
    add(K.build(), 'arvore_mae', mx, mz, Y0, { far: 900 });
    const lg = new THREE.Group(); for (const L of leaf) lg.add(leafMesh(L)); add(lg, 'arvore_mae', mx, mz, Y0, { occ: false, far: 900 }); // a copa não bloqueia a câmera
    add(glowStrands(strands, 99), 'arvore_mae', mx, mz, Y0, { occ: false, far: 900 });
    const clock = new THREE.Object3D(); clock.userData.update = t => { GLOW_T.value = t; }; ctx.roomAnims.push(clock); // pulso da luz e balanço dos filamentos
    col(MT.x, MT.z, TR, { name: 'arvore_mae' });
    for (const a of roots) for (const d of [9, 11.5, 14]) col(MT.x + Math.cos(a) * d, MT.z + Math.sin(a) * d, 1.1, { name: 'raiz', y0: -50, y1: Y0 + 3.0 }); // só no chão: no terraço lá em cima não bloqueia
    for (let deg = 252; deg <= 375; deg += 12) { if (Math.abs(deg - DOOR_DEG) < 22) continue; const a = deg * Math.PI / 180; col(MT.x + Math.cos(a) * 7.4, MT.z + Math.sin(a) * 7.4, 1.25, { name: 'arvore_mae', y0: -50, y1: Y0 + 3.0 }); } } // contrafortes da base (só no chão: quem está na rampa passa por cima)
  { // rampa + terraço (12 m) + mirante (24 m): madeira separada da árvore (não bloqueia a câmera)
    const K = new Kit(), segs = buildRamp(K, ys);
    const bridgeAng = BRIDGES.map(b => Math.atan2(b.z - MT.z, b.x - MT.x));
    const inArc = (a, [s, e]) => { const t = ((a - s) % TAU + TAU) % TAU; return t < ((e - s) % TAU + TAU) % TAU; };
    ringDeck(K, RC + RW / 2 + 0.05, R1, D1, bridgeAng.map(a => [a, 0.13]));
    // mirante: anel de fora inteiro + faixa de dentro só onde a rampa embaixo está a mais de 3 m
    const innerTop = a => inArc(a, [A0, A0 + Math.PI]) ? TR - 0.05 : null;
    ringDeck(K, RC + RW / 2 + 0.05, R2, D2, [], { inner: innerTop });
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.3; if (bridgeAng.some(b => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.3)) continue; lantern(K, Math.cos(a) * (R1 - 0.3), D1, Math.sin(a) * (R1 - 0.3), -a + Math.PI, 2.4); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; lantern(K, Math.cos(a) * (R2 - 0.3), D2, Math.sin(a) * (R2 - 0.3), -a + Math.PI, 2.4); }
    // bancos do conselho no mirante (arco de madeira) e a mesa de pedra com o mapa estelar
    for (let k = 0; k < 5; k++) { const a = A0 + 0.35 + k * 0.42; K.box(1.8, 0.1, 0.5, M.elfWood(), Math.cos(a) * 10.6, D2 + 0.46, Math.sin(a) * 10.6, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2); for (const s of [-0.7, 0.7]) K.box(0.1, 0.45, 0.45, M.elfWood(), Math.cos(a) * 10.6 + Math.cos(a + Math.PI / 2) * s, D2 + 0.22, Math.sin(a) * 10.6 + Math.sin(a + Math.PI / 2) * s, Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2); }
    add(K.build(), 'terracos_arvore_mae', mx, mz, Y0, { occ: false, far: 600 });
    // chão de verdade da rampa
    for (const s of segs) { const slope = (s.y1 - s.y0) / s.L, ext = 0.35;
      addLevel({ x: mx + s.p0[0] - s.t[0] * ext, z: mz + s.p0[1] - s.t[1] * ext, yaw: Math.atan2(s.t[0], s.t[1]), w: RW + 0.2, len: s.L + ext * 2, y0: Y0 + s.y0 - slope * ext, y1: Y0 + s.y1 + slope * ext }); }
    // guarda-corpo da rampa (do lado de fora; nos patamares fica aberto para os terraços)
    segs.forEach((s, k) => { if (LAND.has(k)) return; const mxl = (s.p0[0] + s.p1[0]) / 2 + s.n[0] * (RW / 2 + 0.12), mzl = (s.p0[1] + s.p1[1]) / 2 + s.n[1] * (RW / 2 + 0.12), lo = Math.min(s.y0, s.y1), hi = Math.max(s.y0, s.y1);
      let y0 = lo < 2.2 ? -1 : lo - 1.6, y1 = hi + 2.6; if (Math.abs(lo - D1) < 3.2 || Math.abs(hi - D1) < 3.2) { y0 = Math.min(y0, D1 - 0.6); y1 = Math.max(y1, D1 + 3.2); } if (Math.abs(hi - D2) < 3.2) y1 = Math.max(y1, D2 + 3.2);
      levelWall(ctx.colliders, mx + mxl, mz + mzl, 0.12, s.L / 2 + 0.25, Math.atan2(s.t[0], s.t[1]), Y0 + y0, Y0 + y1, 'guarda-corpo'); });
    // terraço e mirante: chão e guarda-corpo de fora
    ringLevels(mx, mz, RC + RW / 2 + 0.05, R1, Y0 + D1, bridgeAng.map(a => [a, 0.1]), ctx.colliders);
    ringLevels(mx, mz, RC + RW / 2 + 0.05, R2, Y0 + D2, [], ctx.colliders, { inner: innerTop });
    // borda do vão da escada no mirante (de A0+180° até a chegada da rampa): parede radial na ponta da faixa de dentro
    { const a = A0 + Math.PI; levelWall(ctx.colliders, mx + Math.cos(a) * (TR + RW / 2), mz + Math.sin(a) * (TR + RW / 2), 0.12, RW / 2 + 0.1, Math.atan2(Math.cos(a), Math.sin(a)), Y0 + D2 - 0.6, Y0 + D2 + 3.2, 'guarda-corpo'); }
    ctx.elfLevels = { Y0, D1, D2, mx, mz };
  }

  /* ===== árvores-irmãs com plataforma, casa na copa e ponte ===== */
  for (const [i, B] of BRIDGES.entries()) {
    const [bx, bz] = W(B.x, B.z), By = gY(B.x, B.z), Yd = Y0 + D1 - By; // a plataforma fica na MESMA altura do terraço da Mãe
    const tree = giantTree(300 + i, 36, B.tr, 11); add(tree.trunk, 'arvore_irma', bx, bz, By, { far: 800 }); add(tree.leaves, 'arvore_irma', bx, bz, By, { occ: false, far: 800 }); col(B.x, B.z, B.tr + 0.1, { name: 'arvore_irma' });
    for (const a of tree.roots) col(B.x + Math.cos(a) * (B.tr + 1.4), B.z + Math.sin(a) * (B.tr + 1.4), 0.7, { name: 'raiz', y0: -50, y1: By + 2.5 });
    const toMother = Math.atan2(MT.z - B.z, MT.x - B.x);
    const K = new Kit(); ringDeck(K, B.tr + 0.1, B.R, Yd, [[toMother, 0.2]]);
    const hutA = toMother + Math.PI, hutD = (B.tr + B.R) / 2 + 0.2, hutR = 1.9;
    treeHut(K, Math.cos(hutA) * hutD, Yd, Math.sin(hutA) * hutD, hutR, hutA + Math.PI / 2, 40 + i); // a porta olha ao longo da plataforma (dá para chegar nela)
    for (const s of [-1, 1]) { const a = toMother + s * 1.0; lantern(K, Math.cos(a) * (B.R - 0.3), Yd, Math.sin(a) * (B.R - 0.3), -a + Math.PI, 2.3); }
    add(K.build(), 'plataforma_elfica', bx, bz, By, { occ: false, far: 600 });
    ringLevels(bx, bz, B.tr + 0.1, B.R, Y0 + D1, [[toMother, 0.17]], ctx.colliders);
    ctx.colliders.push({ x: bx + Math.cos(hutA) * hutD, z: bz + Math.sin(hutA) * hutD, r: hutR + 0.15, y0: Y0 + D1 - 0.6, y1: Y0 + D1 + 5, name: B.house });
    // ponte suspensa (tábuas retas no nível do terraço, cordas com barriga e postes nas pontas)
    { const ux = Math.cos(toMother + Math.PI), uz = Math.sin(toMother + Math.PI); // da Mãe para a irmã
      const sx = MT.x + ux * (R1 - 0.3), sz = MT.z + uz * (R1 - 0.3), ex = B.x - ux * (B.R - 0.3), ez = B.z - uz * (B.R - 0.3), len = Math.hypot(ex - sx, ez - sz), ry = Math.atan2(ux, uz);
      const KB = new Kit(), wd = M.elfWood(), n = Math.round(len / 0.34);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; KB.box(2.0, 0.08, 0.28, wd, ux * t * len, -0.04, uz * t * len, ry); }
      for (const sd of [-1, 1]) { const ox = Math.cos(ry) * sd * 1.0, oz = -Math.sin(ry) * sd * 1.0;
        KB.box(0.12, 0.16, len, wd, ux * len / 2 + ox, -0.14, uz * len / 2 + oz, ry);
        for (const t of [0, 1]) KB.cyl(0.07, 0.08, 1.5, wd, ux * t * len + ox, 0.7, uz * t * len + oz, 8);
        for (const hgt of [1.05, 0.55]) { const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(ux * t * len + ox, hgt + 0.35 - Math.sin(t * Math.PI) * 0.35, uz * t * len + oz)); } KB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.035, 6), M.rope()); }
        for (let k = 1; k < 8; k++) { const t = k / 8, hh = 1.4 - Math.sin(t * Math.PI) * 0.35; KB.cyl(0.012, 0.012, hh, M.rope(), ux * t * len + ox, hh / 2, uz * t * len + oz, 4); } }
      const [wx, wz] = W(sx, sz); add(KB.build(), 'ponte_elfica', wx, wz, Y0 + D1, { occ: false, far: 500 });
      addLevel({ x: wx - ux * 0.3, z: wz - uz * 0.3, yaw: ry, w: 2.1, len: len + 0.6, y0: Y0 + D1 });
      for (const sd of [-1, 1]) { const ox = Math.cos(ry) * sd * 1.12, oz = -Math.sin(ry) * sd * 1.12; levelWall(ctx.colliders, wx + ux * len / 2 + ox, wz + uz * len / 2 + oz, 0.1, len / 2 + 0.1, ry, Y0 + D1 - 0.6, Y0 + D1 + 3.2, 'guarda-corpo'); } }
  }

  /* ===== chão da cidade ===== */
  // Fonte da Lua: bacia de mármore lavrada, água luminosa, coluna com a lua crescente segurando o cristal
  const FW = { x: 0, z: 18 };
  { const K = new Kit(), mb = M.marble(), y = 0;
    K.add(new THREE.LatheGeometry([[0.01, 0], [4.6, 0], [4.8, 0.55], [4.55, 0.8], [4.3, 0.5], [0.01, 0.4]].map(([a, b]) => new THREE.Vector2(a, b)), 64), mb);
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; K.add(new THREE.SphereGeometry(0.2, 12, 8), mb, Math.cos(a) * 4.7, y + 0.78, Math.sin(a) * 4.7, 0, 0, 0, 1.6, 0.6, 1.6); }
    K.cyl(4.3, 4.3, 0.05, P('moonWater', '#7fd8ff', { emissive: '#4ab8ff', ei: 0.65, rough: 0.05, transparent: true, opacity: 0.85 }), 0, 0.62, 0, 64);
    K.add(new THREE.LatheGeometry([[0.01, 0], [1.0, 0], [0.55, 0.4], [0.32, 2.6], [0.6, 2.9], [0.01, 3.0]].map(([a, b]) => new THREE.Vector2(a, b)), 32), mb);
    K.add(new THREE.TorusGeometry(1.1, 0.14, 12, 40, Math.PI * 1.3), M.silver(), 0, 4.2, 0, 0, 0, Math.PI * 0.85);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.785; lantern(K, Math.cos(a) * 6.6, 0, Math.sin(a) * 6.6, -a); col(FW.x + Math.cos(a) * 6.6, FW.z + Math.sin(a) * 6.6, 0.2, { name: 'lanterna' }); }
    // calçamento claro em volta (segue o terreno)
    const pv = new THREE.CircleGeometry(8.8, 48).rotateX(-Math.PI / 2), Pp = pv.attributes.position, by = gY(FW.x, FW.z);
    for (let i = 0; i < Pp.count; i++) Pp.setY(i, gY(FW.x + Pp.getX(i), FW.z + Pp.getZ(i)) - by + 0.03);
    K.add(pv, M.marble());
    const [fx, fz] = W(FW.x, FW.z), g = add(K.build(), 'fonte_da_lua', fx, fz, by);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), P('crystal', '#d8f4ff', { emissive: '#8fd8ff', ei: 1.6, rough: 0.1, transparent: true, opacity: 0.9 })); cr.scale.y = 1.8; cr.position.y = 4.3; g.add(cr);
    cr.userData.update = t => { cr.rotation.y = t * 0.4; cr.position.y = 4.3 + Math.sin(t * 1.2) * 0.2; }; ctx.roomAnims.push(cr);
    const L = vlight('#9fd8ff', 5, 18, 1.5); L.position.set(0, 3, 0); g.add(L);
    col(FW.x, FW.z, 4.9, { name: 'fonte_da_lua' }); }
  // caminho de pedra clara: portal → fonte → pé da rampa (contorna a fonte pelo leste)
  { const K = new Kit(), mb = M.marble(), path = [[0, 46], [0, 36], [0, 28], [5.5, 12], [6.5, 6], [3.5, 2.6]];
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z))), by = gY(0, 0); // S-389: o grupo fica no centro da cidade (as pedras estão em coordenadas da cidade)
    for (let k = 0; k <= 70; k++) { const p = curve.getPoint(k / 70); if (Math.hypot(p.x - FW.x, p.z - FW.z) < 8.6) continue; const s = 0.7 + r() * 0.5;
      K.add(new THREE.CylinderGeometry(s, s * 1.05, 0.12, 9), mb, p.x + (r() - 0.5) * 1.6, gY(p.x, p.z) - by + 0.02, p.z + (r() - 0.5) * 0.6, r() * 3); }
    const [px, pz] = W(0, 0); add(K.build(), 'calcada_elfica', px, pz, by, { occ: false }); }
  // Portal das Raízes: dois troncos prateados que nascem das raízes e se entrelaçam numa ogiva, com folhas e lanternas
  { const K = new Kit(), bark = silverBark(), gz = 44, by = gY(0, gz);
    for (const sx of [-1, 1]) { branch(K, new THREE.Vector3(sx * 4.6, -0.6, 0), new THREE.Vector3(sx * 4.2, 7.5, 0), 0.75, 0.5, bark);
      const pts = [[sx * 4.2, 7.0], [sx * 3.4, 10.0], [sx * 1.4, 11.8], [-sx * 0.6, 12.3], [-sx * 1.6, 11.6]].map(([x, y]) => new THREE.Vector3(x, y, sx * 0.25));
      K.add(taperTube(new THREE.CatmullRomCurve3(pts), 30, 0.5, 0.18, 12), barkTube());
      for (let k = 0; k < 3; k++) { const a = sx * (0.6 + k * 0.7); branch(K, new THREE.Vector3(sx * 4.6, 0.6, 0), new THREE.Vector3(sx * (4.6 + Math.cos(a) * 2.2), -0.5, Math.sin(a) * 2.2), 0.4, 0.2, bark); } // raízes
      lantern(K, sx * 3.3, 0, 1.2, sx > 0 ? Math.PI : 0, 3.4); col(sx * 3.3, gz + 1.2, 0.2, { name: 'lanterna' }); }
    const gate = new THREE.Group(); gate.add(K.build());
    gate.add(leafMesh(canopyGeo(515, [[-2.5, 12, 0, 2.6], [2.5, 12, 0, 2.6], [0, 13.2, 0, 2.4], [-4.3, 9, 0, 1.8], [4.3, 9, 0, 1.8]], 1.6, new THREE.Vector3(0, 11, 0))));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), M.moonGlow()); orb.position.set(0, 10.6, 0); gate.add(orb);
    const [gx, gz2] = W(0, gz); add(gate, 'portal_elfico', gx, gz2, by, { far: 500 });
    for (const sx of [-1, 1]) col(sx * 4.6, gz, 0.9, { name: 'portal_elfico' });
    for (const sx of [-1, 1]) { const b = makeBanner('elfo', 1.1, 3.0); b.position.set(gx + sx * 4.2, by + 7.2, gz2 + 0.75); ctx.scene.add(b); } }
  // pedras-lua com runas ao longo do caminho
  { const K = new Kit(), by = gY(0, 0); // S-388: antes o grupo ia para z+33 e as pedras apareciam longe da colisão
    for (const [x, z, h] of [[-3.6, 40, 2.6], [3.6, 40, 2.4], [-3.4, 33, 2.2], [3.4, 33, 2.5], [-3.2, 27, 2.0], [3.2, 27, 2.1]]) {
      const g = new THREE.CylinderGeometry(0.32, 0.45, h, 12, 4); const Pp = g.attributes.position; for (let i = 0; i < Pp.count; i++) { const y = Pp.getY(i); if (y > h / 2 - 0.01) Pp.setY(i, y + 0.25 * (1 - Math.abs(Pp.getX(i)) / 0.32)); } g.computeVertexNormals();
      K.add(g, runeMat(), x, gY(x, z) - by + h / 2 - 0.1, z, x > 0 ? -Math.PI / 2 : Math.PI / 2); col(x, z, 0.5, { name: 'pedra_lua' }); }
    const [px, pz] = W(0, 0); add(K.build(), 'pedra_lua', px, pz, by, { occ: false }); }
  // casas-folha no chão
  for (const [i, [dx, dz]] of HOUSES.entries()) {
    const { K, box } = leafHouse(70 + i), ry = Math.atan2(-dx, -dz) - Math.PI / 2; // a porta (no +x da casa) olha para a Árvore-Mãe
    const [hx, hz] = W(dx, dz), g = add(K.build(), 'casa_folha', hx, hz, gY(dx, dz) - 0.15); g.rotation.y = ry;
    for (const [lx, lz, bx2, bz2] of box) { const cs = Math.cos(ry), sn = Math.sin(ry); ctx.colliders.push({ x: hx + lx * cs + lz * sn, z: hz - lx * sn + lz * cs, r: Math.max(bx2, bz2), box: true, hx: bx2, hz: bz2, rot: ry, name: 'casa_folha' }); } }
  // Mercado das Folhas: velas de seda presas em hastes curvas, bancas com frutas, flechas e frascos
  const MK = { x: -18, z: 21 };
  { const K = new Kit(), wd = M.elfWood(), by = gY(MK.x, MK.z);
    const stalls = [[-3.4, -1.4, 0.4], [3.2, -1.8, -0.4], [0, 3.2, Math.PI]];
    for (const [sx, sz, ry] of stalls) { const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [sx + lx * cs + lz * sn, sz - lx * sn + lz * cs];
      K.box(2.6, 0.9, 0.9, wd, ...[at(0, 0)].map(([x, z]) => [x, 0.45, z])[0], ry); K.box(2.7, 0.06, 1.0, P('counterTop', '#e8e2d2', { rough: 0.5 }), ...[at(0, 0)].map(([x, z]) => [x, 0.93, z])[0], ry);
      for (const s of [-1, 1]) { const [x, z] = at(s * 1.25, -0.4); K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(Math.sin(ry) * 0.6, 2.9, Math.cos(ry) * 0.6)]), 12, 0.05, 6), M.silver(), x, 0, z); }
      { const g = new THREE.PlaneGeometry(3.2, 2.0, 24, 10).rotateX(-Math.PI / 2), Pp = g.attributes.position; // toldo de seda: barriga entre as hastes, caindo para a frente, barra em ondas
        for (let i = 0; i < Pp.count; i++) { const u = Pp.getX(i) / 1.6, v = Pp.getZ(i) / 1.0; let y = -(1 - u * u) * 0.22 - (v + 1) * 0.3; if (v > 0.85) y -= 0.12 * (0.5 + 0.5 * Math.cos(u * Math.PI * 5)); Pp.setY(i, y); }
        g.computeVertexNormals(); const [x, z] = at(0, 0.0); K.add(g, silkMat(), x, 2.95, z, ry); }
      const goods = [['#c8302a', '#e8a02a', '#7aa83a'], ['#6a8ac8', '#9ae0c8', '#c89ae0'], ['#c8a24a', '#8a6a3a', '#e8e2d2']][stalls.indexOf(stalls.find(q => q[0] === sx))];
      for (let k = 0; k < 9; k++) { const [x, z] = at(-1.0 + (k % 5) * 0.5, -0.2 + Math.floor(k / 5) * 0.35); K.add(new THREE.SphereGeometry(0.1, 12, 8), P('good' + goods[k % 3], goods[k % 3], { rough: 0.4 }), x, 1.03, z, 0, 0, 0, 1, k % 2 ? 1.4 : 1, 1); } }
    lantern(K, 0, 0, -0.5, 0.3, 3.4); col(MK.x, MK.z - 0.5, 0.2, { name: 'lanterna' });
    const [px, pz] = W(MK.x, MK.z); add(K.build(), 'mercado_elfico', px, pz, by, { occ: false });
    for (const [sx, sz, ry] of stalls) col(MK.x + sx, MK.z + sz, 0.1, { box: true, hx: 1.35, hz: 0.5, rot: ry, name: 'banca' }); }
  // lanternas pela cidade
  { const K = new Kit(), by = gY(0, 0);
    for (const [x, z] of [[-10, 8], [10, 8], [-16, -4], [16, -4], [-20, 12], [20, 12], [-30, 18], [32, 26], [-34, -6], [-6, 30], [8, 32], [0, -26], [-22, -30], [22, -30]]) { lantern(K, x, gY(x, z) - by, z, Math.atan2(-x, -z) + Math.PI / 2); col(x, z, 0.2, { name: 'lanterna' }); }
    const [px, pz] = W(0, 0); add(K.build(), 'lanterna_elfica', px, pz, by, { occ: false }); }
  for (const [dx, dz] of [[0, 2.6], [-24, 16], [24, -6]]) { const L = vlight('#bfe6ff', 3, 14, 1.6); L.position.set(C.x + dx, gY(dx, dz) + 3, C.z + dz); ctx.scene.add(L); }

  /* ===== o bosque: árvores gigantes em volta, mata densa nas encostas, arbustos e cogumelos ===== */
  const clearOf = (x, z, d) => Math.hypot(x - MT.x, z - MT.z) > 17 + d && BRIDGES.every(b => Math.hypot(x - b.x, z - b.z) > b.R + 2 + d) && Math.hypot(x - FW.x, z - FW.z) > 10 + d && !(Math.abs(x) < 7 && z > 22) && Math.hypot(x - MK.x, z - MK.z) > 7 + d && HOUSES.every(([hx, hz]) => Math.hypot(x - hx, z - hz) > 7 + d);
  const slopeOk = (x, z) => Math.hypot(heightAt(C.x + x + 1.2, C.z + z) - heightAt(C.x + x - 1.2, C.z + z), heightAt(C.x + x, C.z + z + 1.2) - heightAt(C.x + x, C.z + z - 1.2)) / 2.4 < 0.7;
  const giants = [];
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + r() * 0.2, d = 44 + r() * 10, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < 9 && z > 30) continue; if (!slopeOk(x, z) || !clearOf(x, z, 1)) continue; giants.push([x, z]);
    const t = giantTree(500 + k, 22 + r() * 10, 1.4 + r() * 0.6, 7 + r() * 2), [wx, wz] = W(x, z), gy = gY(x, z) - 0.2; add(t.trunk, 'arvore_gigante', wx, wz, gy, { far: 700 }); add(t.leaves, 'arvore_gigante', wx, wz, gy, { occ: false, far: 700 }); col(x, z, t.R0 + 0.2, { name: 'arvore_gigante' });
    for (const a of t.roots) col(x + Math.cos(a) * (t.R0 + 1.4), z + Math.sin(a) * (t.R0 + 1.4), 0.6, { name: 'raiz' }); }
  const kinds = ['oakdark_0', 'oakdark_1', 'oakdark_2', 'oak_2', 'oak_4', 'pinedark_0', 'pinedark_2'];
  let planted = 0;
  for (let k = 0; k < 220 && planted < 90; k++) { const a = r() * TAU, d = 36 + Math.pow(r(), 0.7) * 44, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < 8 && z > 26) continue; if (!slopeOk(x, z) || !clearOf(x, z, 2) || giants.some(([gx, gz]) => Math.hypot(gx - x, gz - z) < 6)) continue;
    const [wx, wz] = W(x, z); ctx.place(kinds[Math.floor(r() * kinds.length)], wx, wz, { scale: 1.3 + r() * 0.9 }); planted++; }
  for (let k = 0; k < 10; k++) { const a = r() * TAU, d = 24 + r() * 14, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!clearOf(x, z, 3) || !slopeOk(x, z)) continue; const [wx, wz] = W(x, z); ctx.place(r() < 0.5 ? 'oak_1' : 'oak_3', wx, wz, { scale: 1.1 + r() * 0.5 }); } // algumas árvores dentro da cidade
  { // arbustos (cachos de folhas no chão) e cogumelos luminosos perto das raízes e troncos
    const K = new Kit(), by = gY(0, 0), bushes = [];
    for (let k = 0; k < 70; k++) { const a = r() * TAU, d = 12 + r() * 48, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!clearOf(x, z, 0) || !slopeOk(x, z) || Math.abs(x) < 4 && z > 0) continue; bushes.push([x, gY(x, z) - by + 0.35, z, 0.6 + r() * 0.5]); }
    for (const a of ROOT_DEG) { const ar = a * Math.PI / 180; for (const d of [8, 12]) glowShrooms(K, MT.x + Math.cos(ar) * d + 1.2, gY(MT.x + Math.cos(ar) * d, MT.z + Math.sin(ar) * d) - by, MT.z + Math.sin(ar) * d, 6, r); }
    for (const B of BRIDGES) glowShrooms(K, B.x + B.tr + 0.6, gY(B.x + B.tr, B.z) - by, B.z, 7, r);
    for (const [x, z] of giants) glowShrooms(K, x + 2, gY(x + 2, z) - by, z + 0.5, 5, r);
    const g = K.build(); g.add(leafMesh(canopyGeo(4242, bushes, 0.8, new THREE.Vector3(), true)));
    const [px, pz] = W(0, 0); add(g, 'mata_elfica', px, pz, by, { occ: false }); }
  { // vaga-lumes: pontinhos de luz que flutuam devagar pela cidade (mais visíveis no fim da tarde e à noite)
    const N = 240, pos = new Float32Array(N * 3), base = [];
    for (let k = 0; k < N; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 50, x = Math.cos(a) * d, z = Math.sin(a) * d, y = gY(x, z) - Y0 + 0.6 + Math.pow(r(), 2) * 20; base.push([x, y, z, r() * 10, 0.4 + r() * 0.8]); pos.set([x, y, z], k * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowSprite(), size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#d8ffb0' }));
    pts.position.set(C.x, Y0, C.z); pts.frustumCulled = false; ctx.scene.add(pts);
    pts.userData.update = t => { const cam = ctx.camera; if (!cam || Math.abs(cam.position.x - C.x) > 120 || Math.abs(cam.position.z - C.z) > 120) { pts.visible = false; return; } pts.visible = true;
      for (let k = 0; k < N; k++) { const [x, y, z, ph, sp] = base[k]; pos[k * 3] = x + Math.sin(t * 0.3 * sp + ph) * 1.6; pos[k * 3 + 1] = y + Math.sin(t * 0.5 * sp + ph * 2) * 0.6; pos[k * 3 + 2] = z + Math.cos(t * 0.27 * sp + ph) * 1.6; }
      geo.attributes.position.needsUpdate = true; pts.material.opacity = 0.55 + Math.sin(t * 2.1) * 0.15; };
    ctx.roomAnims.push(pts); }

  /* ===== os elfos ===== */
  const Wn = (n, dx, dz, yaw, y) => { const npc = ctx.worldNpc(n, C.x + dx, C.z + dz, yaw); if (y !== undefined) { npc.obj.position.y = y; npc.deckY = y; const c = ctx.colliders[ctx.colliders.length - 1]; if (c && c.x === C.x + dx && c.z === C.z + dz) { c.y0 = y - 0.6; c.y1 = y + 2.6; } } return npc; };
  const onRing = (cx, cz, rr, deg) => [cx + Math.cos(deg * Math.PI / 180) * rr, cz + Math.sin(deg * Math.PI / 180) * rr];
  const elf = (sex, face, style, color) => ({ race: 'elfo', sex, face, hair: { style, color } });
  const T1 = Y0 + D1, T2 = Y0 + D2;
  const list = [
    // portal e caminho
    [{ id: 'aerin', name: 'Aerin', title: 'Sentinela de Aelindra', model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'], look: elf('f', 'sereno', 'longo', 'platinado'),
      lines: 'Passos pesados de humano... Seja bem-vindo a Aelindra, viajante, mas pise de leve: estas árvores já eram velhas quando o primeiro rei humano nasceu.\nSuba pela rampa em volta de Sylvaren, a Árvore-Mãe. Lá de cima se vê a floresta inteira.' }, 3.4, 47, Math.PI],
    [{ id: 'thandril', name: 'Thandril', title: 'Guarda do Portal das Raízes', model: 'Knight', show: ['1H_Sword', 'Knight_Cape'], look: elf('m', 'valente', 'longo', 'castanho'),
      lines: 'O Portal das Raízes só se abre para quem chega em paz. As árvores sabem a diferença.' }, -3.4, 47, Math.PI],
    // fonte e praça
    [{ id: 'lyssandra', name: 'Lyssandra', title: 'Guardiã da Fonte da Lua', model: 'Mage', show: ['2H_Staff', 'Mage_Cape'], heals: true, look: elf('f', 'gentil', 'longo', 'loiro') }, 0, 25.5, Math.PI],
    [{ id: 'calen', name: 'Calen', title: 'Bardo de Aelindra', model: 'Rogue', show: ['Rogue_Cape'], look: elf('m', 'alegre', 'longo', 'ruivo'),
      lines: 'Quer ouvir a Canção das Mil Folhas? Ela tem tantos versos quanto Sylvaren tem folhas... volte amanhã, e depois de amanhã, e no próximo século.' }, 7.5, 21, -1.6],
    [{ id: 'ithiel', name: 'Ithiel', title: 'Escultora de Pedras-Lua', model: 'Mage', look: elf('f', 'sereno', 'coque', 'platinado'),
      lines: 'Cada pedra-lua do caminho guarda o nome de um elfo que plantou uma árvore aqui. As runas acendem quando a lua passa por cima.' }, -5.5, 30, 1.2],
    // mercado
    [{ id: 'faelar', name: 'Faëlar', title: 'Mercador de Arcos', model: 'Rogue', show: ['1H_Crossbow', 'Rogue_Cape'], shopList: 'geral', shopTitle: '🏹 Arcos de Aelindra', look: elf('m', 'astuto', 'coque', 'castanho'),
      hello: 'Madeira de árvore-mãe, corda de seda de aranha-da-lua. Nada atira mais longe.' }, MK.x - 3.4, MK.z - 0.3, 0.4 + Math.PI],
    [{ id: 'myrael', name: 'Myrael', title: 'Vendedora de Frutos da Floresta', model: 'Rogue', shopList: 'geral', shopTitle: '🍇 Frutos de Aelindra', look: elf('f', 'alegre', 'longo', 'castanho'),
      hello: 'Amoras-de-prata, maçãs-da-lua e mel de flor noturna. Prove, humano — ninguém volta igual.' }, MK.x + 3.2, MK.z - 0.7, -0.4 + Math.PI],
    [{ id: 'vaelis', name: 'Vaelis', title: 'Alquimista das Folhas', model: 'Mage', show: ['Mage_Cape'], look: elf('m', 'sereno', 'curto', 'platinado'),
      lines: 'Orvalho colhido antes do amanhecer, pétala de flor-lua, uma gota da Fonte. É assim que se faz uma poção que não amarga.' }, MK.x, MK.z + 2.2, 0],
    // chão perto da Árvore-Mãe
    [{ id: 'eldin', name: 'Eldin', title: 'Aprendiz de Druida', model: 'Rogue_Hooded', show: ['1H_Wand'], look: elf('m', 'gentil', 'curto', 'loiro'),
      lines: 'A rampa começa aqui, ao sul de Sylvaren. Suba devagar e encoste a mão na casca: dá para sentir a árvore respirar.' }, 6.5, 3.6, -1.9],
    [{ id: 'naerith', name: 'Naerith', title: 'Druida da Porta das Raízes', model: 'Mage', show: ['2H_Staff'], look: elf('f', 'sereno', 'longo', 'branco'),
      lines: 'Esta porta leva ao coração da Árvore-Mãe. Ela ainda está dormindo — um dia, quando estiver pronto, ela mesma vai te chamar.' }, MT.x + Math.cos((DOOR_DEG - 9) * Math.PI / 180) * 8.6, MT.z + Math.sin((DOOR_DEG - 9) * Math.PI / 180) * 8.6, Math.PI],
    [{ id: 'nimriel', name: 'Nimriel', title: 'Tecelã', model: 'Mage', show: ['Mage_Cape'], look: elf('f', 'alegre', 'coque', 'ruivo'),
      lines: 'Os estandartes da cidade são tecidos com fios de folha prateada. Dizem que mudam de cor no outono.' }, -31, 10, 0.5],
    [{ id: 'borin_vis', name: 'Borin', title: 'Anão perdido', model: 'Barbarian', look: { race: 'anao', face: 'astuto', hair: { style: 'careca', color: 'ruivo' }, beard: true },
      lines: 'Árvores, árvores e mais árvores. E agora inventaram de morar EM CIMA delas! Onde é que se arranja uma cerveja decente por aqui?!' }, 14, 30, -2.3],
  ];
  for (const [n, dx, dz, yaw] of list) Wn(n, dx, dz, yaw);
  // no alto: terraço (12 m), mirante (24 m) e plataformas das irmãs
  { const [x1, z1] = onRing(MT.x, MT.z, 12.7, 40); Wn({ id: 'caelith', name: 'Caelith', title: 'Vigia do Terraço das Folhas', model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'], look: elf('m', 'valente', 'longo', 'platinado'),
      lines: 'Daqui eu vejo cada folha que cai. E cada humano que tropeça na rampa — não se preocupe, foram só três hoje.' }, x1, z1, Math.atan2(Math.cos(40 * Math.PI / 180), Math.sin(40 * Math.PI / 180)), T1);
    const [x2, z2] = onRing(MT.x, MT.z, 12.6, 150); Wn({ id: 'faewyn', name: 'Faewyn', title: 'Curandeira das Folhas', model: 'Mage', show: ['Mage_Cape'], heals: true, look: elf('f', 'gentil', 'longo', 'loiro') }, x2, z2, Math.atan2(-Math.cos(150 * Math.PI / 180), -Math.sin(150 * Math.PI / 180)), T1);
    const [x3, z3] = onRing(MT.x, MT.z, 9.8, 120); Wn({ id: 'thalion', name: 'Thalion', title: 'Ancião do Conselho', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], look: elf('m', 'sereno', 'longo', 'branco'),
      lines: 'Bem-vindo ao Mirante do Conselho. Sylvaren já era velha quando a primeira pedra de Valcinza foi assentada.\nAo sul, depois de Pedraclara e das colinas, o mar beija a terra no Porto das Gaivotas.' }, x3, z3, Math.atan2(-Math.cos(120 * Math.PI / 180), -Math.sin(120 * Math.PI / 180)), T2);
    const [x4, z4] = onRing(MT.x, MT.z, 10.4, 200); Wn({ id: 'ilyria', name: 'Ilyria', title: 'Astrônoma', model: 'Mage', show: ['Spellbook_open'], look: elf('f', 'sereno', 'coque', 'preto'),
      lines: 'À noite, a copa se abre o bastante para ver a Coroa do Caçador. Volte depois do pôr do sol e eu te mostro.' }, x4, z4, Math.atan2(Math.cos(200 * Math.PI / 180), Math.sin(200 * Math.PI / 180)), T2); }
  for (const [i, B] of BRIDGES.entries()) { const toM = Math.atan2(MT.z - B.z, MT.x - B.x), a = toM + 0.6, x = B.x + Math.cos(a) * (B.R - 1.6), z = B.z + Math.sin(a) * (B.R - 1.6);
    const n = [{ id: 'elwyn', name: 'Elwyn', title: 'Tecelã das Copas', model: 'Mage', look: elf('f', 'alegre', 'longo', 'platinado'), lines: 'Teço velas para o mercado aqui em cima: o vento da copa seca a seda num instante.' },
      { id: 'sylvar', name: 'Sylvar', title: 'Capitão das Sentinelas', model: 'Knight', show: ['1H_Sword', 'Knight_Cape'], look: elf('m', 'valente', 'longo', 'preto'), lines: 'Nenhuma fera cruza o bosque sem que as sentinelas saibam. Se for caçar ao sul, cuidado com os lobos das colinas.' },
      { id: 'aelar', name: 'Aelar', title: 'Menestrel', model: 'Rogue', show: ['Rogue_Cape'], look: elf('m', 'alegre', 'curto', 'loiro'), lines: 'A melhor acústica de Aethra é aqui, entre três árvores. Escute: até a ponte balança no compasso.' }][i];
    Wn(n, x, z, Math.atan2(MT.x - x, MT.z - z), T1); }
  for (let i = col0; i < ctx.colliders.length; i++) { const c = ctx.colliders[i]; if (c.y0 === undefined || c._rel) continue; const g = heightAt(c.x, c.z); c.y0 -= g; c.y1 -= g; c._rel = true; }
}
