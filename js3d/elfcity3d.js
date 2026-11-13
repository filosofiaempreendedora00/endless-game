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
import { realFlame } from './flame3d.js';
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
const BRIDGES = [ // árvores-irmãs (local), raio do tronco e raio da plataforma (2026-11-13: plataformas de 13 m, bairros da Cidade das Copas)
  { id: 'oeste', x: -29, z: -19, tr: 3.3, R: 13 },
  { id: 'leste', x: 29, z: -16, tr: 3.3, R: 13 },
  { id: 'sudeste', x: 25, z: 18, tr: 3.1, R: 13 },
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

/* =========================================================================
   CIDADE DAS COPAS (2026-11-13, pedido do Roberto: "lá em cima ser de fato uma cidade",
   com casas de verdade onde se entra e NPCs úteis e da história, não casinhas soltas depois das pontes).
   Cada árvore-irmã virou um bairro: plataforma larga (13 m), casas-oca de dois andares com porta
   que leva a uma sala (interior em x ≥ 2400, chão y = 0), uma praça própria e placa com o ofício.
   ========================================================================= */
const PLAT_R = 13, POD_R = 3.3, POD_D = 9; // raio da plataforma, da casa-oca e distância da casa ao tronco
const DISTRICTS = {
  oeste: { name: 'Galeria das Folhas', plaza: 'mercado', houses: [{ id: 'aeli_emporio', name: 'Empório da Copa', sign: 'frasco', side: 1 }, { id: 'aeli_seda', name: 'Casa da Seda', sign: 'fio', side: -1 }] },
  leste: { name: 'Posto das Sentinelas', plaza: 'treino', houses: [{ id: 'aeli_arsenal', name: 'Arsenal das Sentinelas', sign: 'arco', side: 1 }] },
  sudeste: { name: 'Bairro do Saber', plaza: 'jardim', houses: [{ id: 'aeli_estalagem', name: 'Estalagem Folha-de-Prata', sign: 'cama', side: 1 }, { id: 'aeli_biblioteca', name: 'Biblioteca das Copas', sign: 'livro', side: -1 }] },
};
// placa pendurada: madeira clara com o símbolo do ofício pintado em dourado e o nome embaixo
const _signs = {};
function signMat(kind, title) {
  if (_signs[kind]) return _signs[kind];
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#d9c9a4'); gr.addColorStop(1, '#b8a47c'); g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = 'rgba(90,70,40,0.25)'; for (let y = 8; y < 192; y += 11) { g.beginPath(); g.moveTo(0, y + Math.sin(y) * 2); g.bezierCurveTo(80, y + 3, 170, y - 3, 256, y + 1); g.stroke(); }
  g.strokeStyle = '#8a6a2a'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 180);
  g.strokeStyle = '#c99a2e'; g.fillStyle = '#c99a2e'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.save(); g.translate(128, 72);
  if (kind === 'frasco') { g.beginPath(); g.moveTo(-10, -40); g.lineTo(-10, -12); g.quadraticCurveTo(-36, 0, -34, 22); g.quadraticCurveTo(-30, 44, 0, 44); g.quadraticCurveTo(30, 44, 34, 22); g.quadraticCurveTo(36, 0, 10, -12); g.lineTo(10, -40); g.closePath(); g.stroke(); g.globalAlpha = 0.55; g.beginPath(); g.moveTo(-32, 16); g.quadraticCurveTo(0, 6, 32, 16); g.quadraticCurveTo(30, 42, 0, 42); g.quadraticCurveTo(-30, 42, -32, 16); g.fill(); }
  else if (kind === 'fio') { g.beginPath(); g.ellipse(0, 6, 26, 34, 0, 0, Math.PI * 2); g.stroke(); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-24, 6 + k * 11); g.quadraticCurveTo(0, k * 11 - 4, 24, 6 + k * 11); g.stroke(); } g.beginPath(); g.moveTo(26, 30); g.quadraticCurveTo(50, 40, 44, 54); g.stroke(); }
  else if (kind === 'arco') { g.beginPath(); g.moveTo(-6, -44); g.quadraticCurveTo(40, 0, -6, 44); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -44); g.lineTo(-6, 44); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(-40, 0); g.lineTo(44, 0); g.stroke(); g.beginPath(); g.moveTo(44, 0); g.lineTo(32, -8); g.lineTo(32, 8); g.closePath(); g.fill(); }
  else if (kind === 'cama') { g.beginPath(); g.moveTo(-46, 30); g.lineTo(-46, -20); g.moveTo(46, 30); g.lineTo(46, 4); g.moveTo(-46, 8); g.lineTo(46, 8); g.stroke(); g.beginPath(); g.ellipse(-26, -2, 13, 8, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(30, -38); g.arc(24, -30, 12, -0.4, 4.2); g.stroke(); }
  else if (kind === 'livro') { g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(-26, -36, -48, -26); g.lineTo(-48, 34); g.quadraticCurveTo(-26, 24, 0, 34); g.quadraticCurveTo(26, 24, 48, 34); g.lineTo(48, -26); g.quadraticCurveTo(26, -36, 0, -26); g.lineTo(0, 34); g.stroke(); }
  g.restore(); g.fillStyle = '#5a3a14'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillText(title, 128, 168, 236);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (_signs[kind] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, emissive: '#3a2a10', emissiveIntensity: 0.25, side: THREE.DoubleSide }));
}
// casa-oca de dois andares (porta para +z local): parede de tábuas claras com montantes, cinta dourada, sobrado mais estreito
// com janelas redondas, teto em pétalas duplas, alpendre em folha sobre a porta, placa do ofício e floreiras
function canopyPod(seed, sign, title) {
  const K = new Kit(), r = rngOf(seed), wd = M.elfWood(), R = POD_R, H1 = 3.3, H2 = 1.5, R2 = R * 0.84;
  const wall = P('podWall', '#e2d6b8', { rough: 0.8 });
  K.add(new THREE.CylinderGeometry(R, R * 1.03, H1, 40, 1), wall, 0, H1 / 2, 0);
  for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue; K.cyl(0.08, 0.09, H1, wd, Math.cos(a) * (R + 0.04), H1 / 2, Math.sin(a) * (R + 0.04), 8); }
  K.add(new THREE.TorusGeometry(R + 0.07, 0.07, 8, 64), M.gold(), 0, H1, 0, 0, Math.PI / 2);
  K.add(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.22, 48), wd, 0, H1 + 0.1, 0); // assoalho do sobrado (beiral)
  K.add(new THREE.CylinderGeometry(R2, R2 * 1.02, H2, 36, 1), wall, 0, H1 + 0.2 + H2 / 2, 0);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.5; const x = Math.cos(a) * (R2 + 0.03), z = Math.sin(a) * (R2 + 0.03); K.add(new THREE.CircleGeometry(0.32, 20), P('elfWin', '#fff4d8', { emissive: '#ffd9a0', ei: 0.9 }), x, H1 + 0.95, z, Math.atan2(Math.cos(a), Math.sin(a))); K.add(new THREE.TorusGeometry(0.34, 0.04, 6, 24), wd, x * 1.004, H1 + 0.95, z * 1.004, Math.atan2(Math.cos(a), Math.sin(a))); }
  // teto: duas camadas de pétalas (a de baixo larga, a de cima mais fechada) e o pináculo
  const petals = (rad, h, y0, rot, mat) => { const prof = []; for (let k = 0; k <= 24; k++) { const t = k / 24; prof.push(new THREE.Vector2(rad * (1 - Math.pow(t, 0.75)) + 0.05, t * h + Math.pow(1 - t, 6) * 0.45)); }
    const g = new THREE.LatheGeometry(prof, 56), Pp = g.attributes.position; for (let i = 0; i < Pp.count; i++) { const px = Pp.getX(i), py = Pp.getY(i), pz = Pp.getZ(i), a = Math.atan2(pz, px) + rot, pet = 1 + 0.13 * Math.cos(a * 9) * Math.max(0, 1 - py / (h * 0.55)); Pp.setXYZ(i, px * pet, py + 0.28 * Math.max(0, Math.cos(a * 9)) * Math.max(0, 1 - py / 0.8), pz * pet); }
    g.computeVertexNormals(); K.add(g, mat, 0, y0, 0); };
  petals(R + 1.25, 2.0, H1 + 0.05, 0, roofDouble()); petals(R2 + 0.9, 3.0, H1 + 0.2 + H2 - 0.1, 0.17, roofDouble());
  K.add(new THREE.ConeGeometry(0.08, 1.8, 10), M.gold(), 0, H1 + H2 + 3.9, 0); K.add(new THREE.SphereGeometry(0.17, 14, 10), M.moonGlow(), 0, H1 + H2 + 3.15, 0);
  // porta em ogiva (+z) com arco dourado, degrau, alpendre e lanterninhas
  { const sh = new THREE.Shape(); sh.moveTo(-0.7, 0); sh.lineTo(0.7, 0); sh.lineTo(0.7, 1.8); sh.quadraticCurveTo(0.7, 2.55, 0, 2.8); sh.quadraticCurveTo(-0.7, 2.55, -0.7, 1.8); sh.closePath();
    K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }), P('podDoor', '#6a4a2a', { rough: 0.7 }), 0, 0.02, R - 0.02);
    K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.82, 0], [-0.82, 1.85], [0, 2.95], [0.82, 1.85], [0.82, 0]].map(([u, y]) => new THREE.Vector3(u, 0.02 + y, R + 0.12))), 30, 0.06, 6), M.gold());
    K.add(new THREE.SphereGeometry(0.05, 10, 8), M.gold(), 0.45, 1.2, R + 0.14);
    { const g = new THREE.PlaneGeometry(2.2, 1.2, 18, 8).rotateX(-Math.PI / 2), Pp = g.attributes.position; // alpendre: uma folha curva sobre a porta, caindo para a frente
      for (let i = 0; i < Pp.count; i++) { const u = Pp.getX(i) / 1.1, v = Pp.getZ(i) / 0.6; Pp.setY(i, -u * u * 0.3 - (v + 1) * 0.22 + 0.06 * Math.cos(u * Math.PI * 3) * Math.max(0, v)); Pp.setX(i, Pp.getX(i) * (1 - 0.25 * Math.max(0, v))); }
      g.computeVertexNormals(); K.add(g, roofDouble(), 0, 3.15, R + 0.55); K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.16, R - 0.05), new THREE.Vector3(0, 3.0, R + 0.6), new THREE.Vector3(0, 2.72, R + 1.15)]), 12, 0.035, 6), M.gold()); }
    for (const s of [-1, 1]) { K.cyl(0.03, 0.035, 2.2, M.silver(), s * 1.25, 1.1, R + 0.45, 8); K.add(new THREE.SphereGeometry(0.13, 12, 8), M.moonGlow(), s * 1.25, 2.3, R + 0.45); K.add(new THREE.ConeGeometry(0.17, 0.16, 12, 1, true), M.silver(), s * 1.25, 2.42, R + 0.45); }
    // floreiras com flores-lua dos dois lados da porta
    for (const s of [-1, 1]) { K.box(0.9, 0.4, 0.45, wd, s * 1.9, 0.2, R + 0.15, -s * 0.35); for (let k = 0; k < 7; k++) { const fx = s * 1.9 + (r() - 0.5) * 0.7, fz = R + 0.15 + (r() - 0.5) * 0.25; K.cyl(0.012, 0.012, 0.35, P('stem', '#4a7a3a'), fx, 0.55, fz, 4); K.add(new THREE.SphereGeometry(0.06, 8, 6), k % 2 ? M.moonGlow() : P('flowerP', '#f0c8e8', { emissive: '#c878c0', ei: 0.4 }), fx, 0.74, fz); } } }
  // janelas em ogiva no térreo
  for (const a of [0.55, -0.55, Math.PI - 0.4, Math.PI + 0.4, Math.PI / 2 + Math.PI, Math.PI]) { const ang = Math.PI / 2 + a; elfWindow(K, Math.cos(ang) * (R + 0.05), 1.0, Math.sin(ang) * (R + 0.05), Math.atan2(Math.cos(ang), Math.sin(ang)), 0.62, 1.2); }
  // placa: braço de prata saindo da parede ao lado da porta, tábua pendurada por correntes
  { const a = Math.PI / 2 - 0.98, bx = Math.cos(a) * (R + 0.05), bz = Math.sin(a) * (R + 0.05), ux = Math.cos(a), uz = Math.sin(a); // braço radial; a placa fica "de lado" (as duas faces à vista)
    K.add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), M.silver(), bx + ux * 0.5, 2.62, bz + uz * 0.5, Math.atan2(ux, uz), Math.PI / 2);
    for (const s of [0.4, 1.0]) K.cyl(0.008, 0.008, 0.28, M.silver(), bx + ux * s, 2.47, bz + uz * s, 4);
    K.box(0.82, 0.62, 0.05, signMat(sign, title), bx + ux * 0.7, 2.02, bz + uz * 0.7, -a); }
  return K;
}
// pavilhão aberto (posto de vigia): quatro colunas de prata, banco circular e teto de pétalas — sem porta
function lookout(seed) {
  const K = new Kit(), wd = M.elfWood();
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; K.cyl(0.12, 0.14, 3.2, M.silver(), Math.cos(a) * 2.2, 1.6, Math.sin(a) * 2.2, 10); }
  const prof = []; for (let k = 0; k <= 20; k++) { const t = k / 20; prof.push(new THREE.Vector2(3.4 * (1 - Math.pow(t, 0.75)) + 0.05, t * 2.6 + Math.pow(1 - t, 6) * 0.4)); }
  K.add(new THREE.LatheGeometry(prof, 40), roofDouble(), 0, 3.15, 0); K.add(new THREE.SphereGeometry(0.16, 12, 8), M.moonGlow(), 0, 5.5, 0);
  K.add(new THREE.TorusGeometry(1.6, 0.22, 8, 40, Math.PI * 1.4), wd, 0, 0.45, 0, 0.8, Math.PI / 2);
  K.add(new THREE.CylinderGeometry(0.5, 0.6, 0.9, 16), M.marble(), 0, 0.45, 0); K.add(new THREE.SphereGeometry(0.42, 20, 14), P('scry', '#cfefff', { emissive: '#6ab8ff', ei: 0.8, rough: 0.1, transparent: true, opacity: 0.85 }), 0, 1.25, 0); // pedra de vidência das sentinelas
  return K;
}
// alvos de treino (disco de palha trançada com anéis pintados, num cavalete)
function targetStand(K, x, y, z, ry) {
  const wd = M.elfWood(); for (const s of [-1, 1]) K.cyl(0.05, 0.06, 1.7, wd, x + Math.cos(ry) * s * 0.45, y + 0.85, z - Math.sin(ry) * s * 0.45, 8, 0, 0.12 * s);
  K.add(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 32), P('straw', '#c8a868', { rough: 1 }), x, y + 1.35, z, ry, Math.PI / 2);
  [[0.5, '#e8e2d2'], [0.36, '#2f6e73'], [0.22, '#e8e2d2'], [0.1, '#b8302a']].forEach(([rr, c], i) => K.add(new THREE.CircleGeometry(rr, 28), P('tgt' + i, c, { rough: 0.9 }), x + Math.sin(ry) * (0.1 + i * 0.002), y + 1.35, z + Math.cos(ry) * (0.1 + i * 0.002), ry));
}
// banca de seda ao ar livre (mesma linguagem do Mercado das Folhas)
function silkStall(K, x, y, z, ry, goods) {
  const wd = M.elfWood(), cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  { const [a, b] = at(0, 0); K.box(2.4, 0.9, 0.85, wd, a, y + 0.45, b, ry); K.box(2.5, 0.06, 0.95, P('counterTop', '#e8e2d2', { rough: 0.5 }), a, y + 0.93, b, ry); }
  for (const s of [-1, 1]) { const [a, b] = at(s * 1.15, -0.4); K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(sn * 0.6, 2.8, cs * 0.6)]), 12, 0.05, 6), M.silver(), a, y, b); }
  { const g = new THREE.PlaneGeometry(3.0, 1.9, 24, 10).rotateX(-Math.PI / 2), Pp = g.attributes.position; for (let i = 0; i < Pp.count; i++) { const u = Pp.getX(i) / 1.5, v = Pp.getZ(i) / 0.95; let yy = -(1 - u * u) * 0.2 - (v + 1) * 0.28; if (v > 0.85) yy -= 0.12 * (0.5 + 0.5 * Math.cos(u * Math.PI * 5)); Pp.setY(i, yy); } g.computeVertexNormals(); const [a, b] = at(0, 0); K.add(g, silkMat(), a, y + 2.85, b, ry); }
  for (let k = 0; k < 8; k++) { const [a, b] = at(-0.9 + (k % 4) * 0.6, -0.15 + Math.floor(k / 4) * 0.35); K.add(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 14), P('bolt' + (k % 4), goods[k % goods.length], { rough: 0.7 }), a, y + 1.08, b, ry + Math.PI / 2, 0, Math.PI / 2); }
}

/* ---------- salas das casas das copas ---------- */
// casca élfica: piso de tábuas claras com rosácea, lambris de madeira com pilastras de prata, janelas em ogiva acesas,
// abóbada de nervuras curvas, o tronco da árvore atravessando a sala ao fundo, porta ao sul (z+) e o portal de saída
function elfRoom(ctx, id, def) {
  const I = { region: 'Aelindra', wall: '#d8c9a6', floor: '#b39a72', beam: '#8a6a44', h: 5.2, ...def }; ctx.INTERIORS[id] = I;
  const K = new Kit(), walls = new Kit(), ceil = new Kit(), wd = M.elfWood(), hw = I.w / 2, hd = I.d / 2, H = I.h, T = 0.4, wb = [];
  K.box(I.w, 0.2, I.d, wd, 0, -0.1, 0);
  { const rug = P('elfRug', '#2f4a3e', { rough: 1 }); K.add(new THREE.CircleGeometry(2.6, 48), rug, 0, 0.012, 0.6, 0, -Math.PI / 2); // tapete tecido verde-musgo com anéis dourados e folhas
    for (const [a, b] of [[2.45, 2.62], [1.55, 1.63], [0.5, 0.58]]) K.add(new THREE.RingGeometry(a, b, 48), M.gold(), 0, 0.015, 0.6, 0, -Math.PI / 2);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; K.add(new THREE.CircleGeometry(0.28, 12), P('rugLeaf', '#8ab89a', { rough: 1 }), Math.cos(a) * 2.05, 0.016, 0.6 + Math.sin(a) * 2.05, 0, -Math.PI / 2, 0, 1, 0.45, 1); } }
  const panel = P('elfPanel', '#d8c9a6', { rough: 0.75 }), HW = H + 1.3; // paredes mais altas que a abóbada (antes o céu aparecia por cima delas)
  const WALL = (w, d, x, z) => { walls.box(w, HW, d, panel, x, HW / 2, z); wb.push([x, z, w / 2, d / 2]); };
  WALL(I.w + T * 2, T, 0, -hd - T / 2); WALL(T, I.d, -hw - T / 2, 0); WALL(T, I.d, hw + T / 2, 0);
  WALL(hw - 1.3, T, -hw / 2 - 0.65, hd + T / 2); WALL(hw - 1.3, T, hw / 2 + 0.65, hd + T / 2); walls.box(2.6, HW - 3.0, T, panel, 0, 3.0 + (HW - 3.0) / 2, hd + T / 2);
  { // a porta de dentro, fechada: duas folhas de tábuas com ferragens de prata e o arco dourado (o vão não mostra mais o vazio lá fora)
    const dw = P('podDoor', '#6a4a2a', { rough: 0.7 }); for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) K.box(0.42, 2.98, 0.08, dw, s * (0.22 + k * 0.43), 1.49, hd + 0.06); for (const y of [0.6, 2.3]) K.box(1.2, 0.07, 0.03, M.silver(), s * 0.65, y, hd + 0.01); K.add(new THREE.TorusGeometry(0.07, 0.012, 6, 16), M.silver(), s * 0.18, 1.3, hd); }
    K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-1.35, 0], [-1.35, 3.0], [1.35, 3.0], [1.35, 0]].map(([u, y]) => new THREE.Vector3(u, y, hd - 0.02))), 24, 0.07, 6), M.gold()); }
  // lambril baixo de madeira, pilastras de prata e janelas acesas nas paredes de lado
  for (const [sx, len] of [[-1, I.d], [1, I.d]]) { K.box(0.06, 1.1, len, wd, sx * (hw - 0.03), 0.55, 0); for (let z = -hd + 1.5; z < hd - 0.5; z += 2.6) { K.box(0.14, H, 0.22, M.silver(), sx * (hw - 0.07), H / 2, z); } for (let z = -hd + 2.8; z < hd - 1.5; z += 2.6) { elfWindow(K, sx * (hw - 0.02), 1.4, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0.9, 1.9); K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.5, 0], [-0.5, 1.15], [-0.35, 1.6], [0, 1.98], [0.35, 1.6], [0.5, 1.15], [0.5, 0]].map(([u, y]) => new THREE.Vector3(sx * (hw - 0.05), 1.4 + y, z + u))), 30, 0.05, 6), wd); K.box(0.22, 0.06, 1.15, wd, sx * (hw - 0.1), 1.37, z); } }
  K.box(I.w, 1.1, 0.06, wd, 0, 0.55, -hd + 0.03); for (let x = -hw + 1.5; x < hw - 0.5; x += 2.6) K.box(0.22, H, 0.14, M.silver(), x, H / 2, -hd + 0.07);
  // abóbada: nervuras em arco de madeira de lado a lado, o forro claro por cima
  for (let z = -hd + 1.2; z < hd; z += 2.4) { const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, a = Math.PI * t; pts.push(new THREE.Vector3(-Math.cos(a) * hw, H - 0.6 + Math.sin(a) * 1.4, 0)); } ceil.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.12, 6), wd, 0, 0, z); }
  { const g = new THREE.PlaneGeometry(I.w, I.d + 0.8, 16, 4), Pp = g.attributes.position; for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i); Pp.setZ(i, (Math.cos(Math.asin(Math.max(-1, Math.min(1, x / hw)))) * 1.4)); } g.rotateX(-Math.PI / 2); g.computeVertexNormals(); ceil.add(g, P('elfCeil', '#e8dcc0', { rough: 0.85, side: THREE.DoubleSide }), 0, H - 0.6, 0); }
  // o tronco da árvore atravessa a sala no fundo (meio embutido na parede), com cogumelos que brilham na base
  K.add(new THREE.CylinderGeometry(1.25, 1.5, H + 1.6, 28), silverBark(), 0, H / 2, -hd + 0.4); glowShrooms(K, 1.0, 0, -hd + 1.2, 6, rngOf(id.length * 7));
  const g = K.build(); g.position.set(I.x, 0, I.z); ctx.scene.add(g);
  const wg = walls.build(); wg.position.set(I.x, 0, I.z); ctx.scene.add(wg); ctx.occluders.push(wg);
  const cg = ceil.build(); cg.position.set(I.x, 0, I.z); ctx.scene.add(cg);
  for (const [lx, lz, hx, hz] of wb) ctx.colliders.push({ x: I.x + lx, z: I.z + lz, r: Math.max(hx, hz), box: true, hx, hz, rot: 0, name: id });
  ctx.colliders.push({ x: I.x, z: I.z - hd + 0.4, r: 1.45, name: 'tronco' });
  for (const [lx, lz, c, it] of [[0, -hd + 3, '#ffe2b0', 6], [0, hd - 3, '#cfe8ff', 5]]) { const L = vlight(c, it, Math.max(I.w, I.d) + 4, 1.3); L.position.set(I.x + lx, H - 1.4, I.z + lz); ctx.scene.add(L); }
  const ex = ctx.makePortal('#9fd8ff'); ex.position.set(I.x, 0, I.z + hd - 0.9); ctx.scene.add(ex); ctx.portals.push({ kind: 'exit', from: id, x: I.x, z: I.z + hd - 0.9, mesh: ex });
  const box = (lx, lz, hx, hz) => ctx.colliders.push({ x: I.x + lx, z: I.z + lz, r: Math.max(hx, hz), box: true, hx, hz, rot: 0, name: id });
  const N = (n, x, z, yaw, anim) => ctx.roomNpc(n, I.x + x, I.z + z, yaw, anim);
  return { I, K: new Kit(), hw, hd, H, box, N, done: Kf => { const gg = Kf.build(); gg.position.set(I.x, 0, I.z); ctx.scene.add(gg); return gg; } };
}
// móveis élficos reutilizáveis (em coordenadas da sala)
function shelfWall(K, x, z, ry, w, rows, fill, r) { // estante encostada: laterais, prateleiras e o que for posto em cada uma (fill)
  const wd = M.elfWood(), cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  for (const s of [-1, 1]) { const [a, b] = at(s * w / 2, 0); K.box(0.08, rows * 0.55 + 0.3, 0.42, wd, a, (rows * 0.55 + 0.3) / 2, b, ry); }
  for (let k = 0; k <= rows; k++) { const [a, b] = at(0, 0); K.box(w, 0.05, 0.42, wd, a, 0.15 + k * 0.55, b, ry); if (k < rows) for (let j = 0; j < Math.floor(w / 0.32); j++) { const [px, pz] = at(-w / 2 + 0.2 + j * 0.32, 0.02); fill(K, px, 0.18 + k * 0.55, pz, ry, r, j, k); } }
}
const BOOK_C = ['#6a2a2a', '#2a4a6a', '#3a5a2a', '#6a5a2a', '#4a2a5a', '#2a5a5a', '#7a4a2a'];
const fillBooks = (K, x, y, z, ry, r) => { for (let i = 0; i < 3; i++) { const h = 0.28 + r() * 0.12; K.box(0.07, h, 0.26, P('book' + (i + Math.floor(r() * 7)) % 7, BOOK_C[(i + Math.floor(r() * 7)) % 7], { rough: 0.8 }), x + Math.cos(ry) * (i * 0.08 - 0.08), y + h / 2, z - Math.sin(ry) * (i * 0.08 - 0.08), ry, 0, (r() - 0.5) * 0.08); } };
const POT_C = [['#c8302a', '#ff5a3a'], ['#2a6ac8', '#5aa8ff'], ['#3aa86a', '#6aff9a'], ['#c8a02a', '#ffd86a']];
const fillPotions = (K, x, y, z, ry, r, j) => { const [c, e] = POT_C[(j + Math.floor(r() * 4)) % 4]; K.add(new THREE.SphereGeometry(0.09, 14, 10), P('pot' + c, c, { emissive: e, ei: 0.45, rough: 0.15, transparent: true, opacity: 0.88 }), x, y + 0.1, z); K.cyl(0.025, 0.03, 0.09, P('glassN', '#dfeff0', { rough: 0.1, transparent: true, opacity: 0.6 }), x, y + 0.22, z, 8); K.cyl(0.03, 0.03, 0.03, P('cork', '#8a6a4a'), x, y + 0.28, z, 8); };
function curvedCounter(K, x, z, w, ry) { // balcão em arco (a curva olha para +z), madeira com tampo de mármore
  const wd = M.elfWood(); K.add(new THREE.CylinderGeometry(w, w, 1.0, 32, 1, true, -0.7, 1.4), P('counterDS', '#c8b088', { rough: 0.7, side: THREE.DoubleSide }), x, 0.5, z, ry);
  const sh = new THREE.Shape(), a0 = -0.7 - Math.PI / 2, a1 = 0.7 - Math.PI / 2; sh.absarc(0, 0, w + 0.08, a0, a1, false); sh.absarc(0, 0, w - 0.4, a1, a0, true);
  K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 24 }), M.marble(), x, 1.06, z, ry, -Math.PI / 2);
}
function table(K, x, z, rr, ry = 0) { const wd = M.elfWood(); K.add(new THREE.CylinderGeometry(rr, rr, 0.07, 28), wd, x, 0.78, z); K.add(new THREE.CylinderGeometry(0.1, 0.3, 0.76, 14), wd, x, 0.38, z); K.add(new THREE.TorusGeometry(rr, 0.02, 6, 32), M.gold(), x, 0.81, z, 0, Math.PI / 2); }
function stool(K, x, z) { const wd = M.elfWood(); K.add(new THREE.CylinderGeometry(0.24, 0.22, 0.06, 18), wd, x, 0.48, z); for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; K.cyl(0.025, 0.03, 0.48, wd, x + Math.cos(a) * 0.15, 0.24, z + Math.sin(a) * 0.15, 6, 0, Math.sin(a) * 0.15, -Math.cos(a) * 0.15); } }
function goblet(K, x, y, z) { K.add(new THREE.LatheGeometry([[0.001, 0], [0.05, 0], [0.012, 0.02], [0.01, 0.1], [0.045, 0.13], [0.05, 0.2], [0.046, 0.2], [0.04, 0.14], [0.001, 0.12]].map(([a, b]) => new THREE.Vector2(a, b)), 16), M.silver(), x, y, z); }
function candle(K, x, y, z) { K.cyl(0.03, 0.03, 0.16, P('candle', '#efe6cf', { rough: 0.6 }), x, y + 0.08, z, 8); K.add(new THREE.SphereGeometry(0.025, 8, 6), P('cflame', '#ffd88a', { emissive: '#ffb050', ei: 2 }), x, y + 0.19, z, 0, 0, 0, 1, 1.8, 1); }
function bed(K, x, z, ry) { const wd = M.elfWood(), cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  { const [a, b] = at(0, 0); K.box(1.1, 0.4, 2.1, wd, a, 0.2, b, ry); K.box(1.0, 0.18, 2.0, P('linenE', '#f0ead8', { rough: 0.95 }), a, 0.49, b, ry); }
  { const [a, b] = at(0, 0.35); K.box(1.04, 0.1, 1.3, silkMat(), a, 0.6, b, ry); } { const [a, b] = at(0, -0.75); K.add(new THREE.CapsuleGeometry(0.15, 0.5, 4, 10), P('linenE', '#f0ead8'), a, 0.66, b, ry, 0, Math.PI / 2); }
  { const [a, b] = at(0, -1.05); const sh = new THREE.Shape(); sh.moveTo(-0.55, 0); sh.lineTo(0.55, 0); sh.lineTo(0.55, 0.8); sh.quadraticCurveTo(0.55, 1.25, 0, 1.4); sh.quadraticCurveTo(-0.55, 1.25, -0.55, 0.8); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), wd, a, 0, b, ry); } }
function herbBundles(K, x0, x1, z, y, r) { for (let x = x0; x <= x1; x += 0.45) { const len = 0.25 + r() * 0.25; K.cyl(0.006, 0.006, 0.3, M.rope(), x, y - 0.15, z, 4); K.add(new THREE.ConeGeometry(0.08, len, 8), P('herb' + Math.floor(r() * 3), ['#5a7a3a', '#7a8a4a', '#8a6a7a'][Math.floor(r() * 3)], { rough: 1 }), x, y - 0.3 - len / 2, z, 0, Math.PI); } }
const elfLook = (sex, face, style, color) => ({ race: 'elfo', sex, face, hair: { style, color } });
// as cinco salas, cada uma com os móveis do seu ofício e a sua gente
function buildCanopyRooms(ctx) {
  const ROOMS = {};
  const look = elfLook, r = rngOf(4747);
  // ---------- Empório da Copa: poções, frutos e mel ----------
  { const R = elfRoom(ctx, 'aeli_emporio', { name: 'Empório da Copa', x: 2400, z: 0, w: 12, d: 10 }), { K, hw, hd, H, box, N } = R;
    curvedCounter(K, 0, -1.3, 1.8, 0); box(0, 0.25, 1.3, 0.4);
    for (const sx of [-1, 1]) { shelfWall(K, sx * 3.6, -hd + 0.3, 0, 3.0, 4, fillPotions, r); box(sx * 3.6, -hd + 0.3, 1.55, 0.25); }
    herbBundles(K, -4.2, 4.2, -0.4, H - 0.75, r); herbBundles(K, -4.2, 4.2, 1.8, H - 0.75, r);
    for (const [bx, bz, c] of [[-4.4, 2.8, '#c8302a'], [-3.4, 3.4, '#7aa83a'], [4.4, 2.8, '#e8a02a'], [3.6, 3.5, '#6a4a8a']]) { // cestos de frutos
      K.add(new THREE.CylinderGeometry(0.42, 0.32, 0.45, 18, 1, true), P('basket', '#a8844a', { rough: 1, side: THREE.DoubleSide }), bx, 0.23, bz); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, d = k ? 0.22 : 0; K.add(new THREE.SphereGeometry(0.1, 12, 8), P('fruit' + c, c, { rough: 0.45 }), bx + Math.cos(a) * d, 0.46 + (k ? 0 : 0.08), bz + Math.sin(a) * d); } box(bx, bz, 0.42, 0.42); }
    table(K, 3.4, 0.9, 0.7); stool(K, 2.5, 1.5); goblet(K, 3.3, 0.82, 0.8); goblet(K, 3.6, 0.82, 1.1); box(3.4, 0.9, 0.7, 0.7);
    for (let k = 0; k < 5; k++) K.add(new THREE.SphereGeometry(0.11, 12, 8), P('honey', '#e8a82a', { emissive: '#a86a10', ei: 0.3, rough: 0.2, transparent: true, opacity: 0.9 }), -1.0 + k * 0.5, 1.2, -0.5 + Math.abs(k - 2) * 0.12, 0, 0, 0, 1, 1.25, 1); // potes de mel no balcão
    R.done(K);
    N({ id: 'lithiel', name: 'Lithiel', title: 'Mercadora do Empório da Copa', model: 'Mage', look: look('f', 'alegre', 'coque', 'castanho'), shopList: ['pocao_vermelha', 'pocao_azul', 'frutinha_azul', 'mel', 'maca', 'uvas', 'pera', 'folha_hortela', 'pergaminho_retorno'], shopTitle: '🧪 Empório da Copa',
      hello: 'Poções de orvalho, mel de flor-lua e frutos que só nascem aqui em cima. Tudo colhido pela manhã, antes do sol secar a copa.' }, 0, -0.6, 0);
    N({ id: 'rhovan', name: 'Rhovan', title: 'Viajante de Valcinza', model: 'Rogue', look: { race: 'humano', face: 'astuto', hair: { style: 'curto', color: 'castanho' } },
      lines: 'Subi três vezes a rampa achando que era a última volta. Mas o mel daqui vale a caminhada, e a vista também.' }, -2.6, 2.0, 2.3); }
  // ---------- Casa da Seda: roupas e enfeites ----------
  { const R = elfRoom(ctx, 'aeli_seda', { name: 'Casa da Seda', x: 2430, z: 0, w: 12, d: 10 }), { K, hw, hd, H, box, N } = R, wd = M.elfWood();
    { const lx = -3.2, lz = -1.4; // tear: quatro esteios, travessas, centenas de fios e o pano já tecido descendo
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(0.12, 2.2, 0.12, wd, lx + sx * 1.0, 1.1, lz + sz * 0.45);
      for (const y of [0.55, 2.0]) for (const sz of [-1, 1]) K.box(2.1, 0.1, 0.1, wd, lx, y, lz + sz * 0.45);
      K.cyl(0.08, 0.08, 2.0, wd, lx, 0.85, lz + 0.45, 12, 0, 0, Math.PI / 2);
      for (let k = 0; k < 40; k++) K.box(0.008, 1.2, 0.008, P('thread' + (k % 3), ['#e8e2d2', '#9ae0c8', '#c9a24a'][k % 3], { rough: 0.9 }), lx - 0.9 + k * 0.046, 1.4, lz - 0.45 + (k % 2) * 0.02);
      K.add(new THREE.PlaneGeometry(1.8, 0.7), silkMat(), lx, 1.0, lz - 0.1, 0, -0.5); K.cyl(0.02, 0.02, 0.3, wd, lx + 0.5, 1.15, lz + 0.2, 6, 0, 0, Math.PI / 2); box(lx, lz, 1.1, 0.55); }
    const fillBolts = (K2, x, y, z, ry, rr, j) => K2.add(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 14), P('boltS' + (j % 5), ['#2f6e73', '#c8a24a', '#9ae0c8', '#7a3a5a', '#e8e2d2'][(j + Math.floor(rr() * 5)) % 5], { rough: 0.75 }), x, y + 0.12, z, ry, 0, Math.PI / 2);
    for (const sx of [-1, 1]) { shelfWall(K, sx * 3.6, -hd + 0.3, 0, 3.0, 4, fillBolts, r); box(sx * 3.6, -hd + 0.3, 1.55, 0.25); }
    for (const [mx, mz, rot] of [[3.0, -1.2, 0.3], [4.6, 0.4, -0.5]]) { // manequins com capas de seda
      K.cyl(0.04, 0.04, 1.2, M.silver(), mx, 0.6, mz, 8); K.add(new THREE.CylinderGeometry(0.28, 0.02, 0.06, 16), M.silver(), mx, 0.03, mz);
      K.add(new THREE.LatheGeometry([[0.001, 0], [0.2, 0], [0.24, 0.1], [0.19, 0.35], [0.23, 0.55], [0.17, 0.65], [0.06, 0.7], [0.001, 0.72]].map(([a, b]) => new THREE.Vector2(a, b)), 20), P('dummyLinen', '#e8dcc0', { rough: 0.9 }), mx, 1.2, mz);
      { const prof = []; for (let k = 0; k <= 14; k++) { const t = k / 14, y = 1.85 - t * 1.3; prof.push(new THREE.Vector2(0.2 + Math.pow(t, 1.6) * 0.32 + (t < 0.15 ? 0.04 : 0), y)); } // vestido de seda na forma (lathe), com pregas
        const g = new THREE.LatheGeometry(prof.reverse(), 40), Pp = g.attributes.position; for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i), y = Pp.getY(i), z = Pp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.sin(a * 11) * Math.max(0, 1.5 - y); Pp.setX(i, x * k); Pp.setZ(i, z * k); } g.computeVertexNormals();
        K.add(g, P('gown' + mx, mx < 4 ? '#2f6e73' : '#7a3a5a', { rough: 0.55, side: THREE.DoubleSide }), mx, 0, mz, rot); K.add(new THREE.TorusGeometry(0.21, 0.025, 6, 24), M.gold(), mx, 1.6, mz, 0, Math.PI / 2); }
      box(mx, mz, 0.45, 0.45); }
    K.box(2.4, 0.08, 0.9, wd, 1.0, 0.86, 2.0); for (const sx of [-1.1, 1.1]) for (const sz of [-0.38, 0.38]) K.box(0.08, 0.86, 0.08, wd, 1.0 + sx, 0.43, 2.0 + sz); // mesa com panos dobrados
    for (let k = 0; k < 4; k++) K.box(0.5, 0.06 + k * 0.01, 0.4, P('fold' + k, ['#2f6e73', '#c8a24a', '#e8e2d2', '#7a3a5a'][k], { rough: 0.8 }), 0.2 + k * 0.55, 0.93 + (k % 2) * 0.06, 2.0, 0.1 * k); box(1.0, 2.0, 1.25, 0.5);
    R.done(K);
    N({ id: 'elwyn', name: 'Elwyn', title: 'Tecelã das Copas', model: 'Mage', look: look('f', 'alegre', 'longo', 'platinado'), shopList: ['tunica_algodao', 'manto_arcano', 'capa_viagem', 'manto_penas', 'coroa_de_flores', 'mascara_folha', 'chapeu_de_viajante', 'sandalias_corda', 'botas_couro', 'luvas_couro'], shopTitle: '🧵 Casa da Seda',
      hello: 'Seda de aranha-da-lua e linho de folha prateada. O vento da copa seca o pano num instante, e o pano guarda o cheiro da árvore para sempre.' }, 1.0, 1.1, 0);
    N({ id: 'saelin', name: 'Saelin', title: 'Aprendiz de Tecelã', model: 'Rogue', look: look('f', 'gentil', 'curto', 'ruivo'),
      lines: 'Cada fio dourado deste tear é uma folha que caiu de Sylvaren. Se eu errar um ponto, a Elwyn percebe do outro lado da ponte.' }, -3.2, -0.3, Math.PI); }
  // ---------- Arsenal das Sentinelas: arcos e a história do capitão ----------
  { const R = elfRoom(ctx, 'aeli_arsenal', { name: 'Arsenal das Sentinelas', x: 2460, z: 0, w: 14, d: 11 }), { K, hw, hd, H, box, N } = R, wd = M.elfWood();
    const bowArc = (x, y, z, ry, len) => { const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12 * 2 - 1; pts.push(new THREE.Vector3(Math.sin(ry) * (0.12 * (1 - t * t)) , y + t * len / 2, Math.cos(ry) * (0.12 * (1 - t * t)))); }
      K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 6), P('bowWood', '#c8b088', { rough: 0.5 }), x, 0, z); K.cyl(0.004, 0.004, len, P('bowString', '#f0ead8'), x, y, z, 4); K.cyl(0.035, 0.035, 0.18, P('grip', '#5a3a22'), x + Math.sin(ry) * 0.12, y, z + Math.cos(ry) * 0.12, 8); };
    for (const sx of [-1, 1]) { const cx = sx * 3.8; K.box(3.0, 0.12, 0.3, wd, cx, 2.6, -hd + 0.2); K.box(3.0, 0.12, 0.3, wd, cx, 0.5, -hd + 0.2); for (let k = 0; k < 6; k++) bowArc(cx - 1.25 + k * 0.5, 1.55, -hd + 0.32, 0, 1.75); box(cx, -hd + 0.25, 1.55, 0.25); }
    for (const [qx, qz] of [[-5.6, 3.2], [5.6, 3.2]]) { K.add(new THREE.CylinderGeometry(0.4, 0.34, 0.9, 16), wd, qx, 0.45, qz); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, d = 0.22 * ((k % 3) / 2); K.cyl(0.008, 0.008, 1.0, P('shaft', '#d8c8a0'), qx + Math.cos(a) * d, 1.1, qz + Math.sin(a) * d, 4); K.add(new THREE.ConeGeometry(0.03, 0.09, 4), P('fletch', '#2f6e73', { rough: 0.9 }), qx + Math.cos(a) * d, 1.62, qz + Math.sin(a) * d); } box(qx, qz, 0.42, 0.42); }
    { const tx = 0.5, tz = 1.3; K.box(3.0, 0.09, 1.7, wd, tx, 0.9, tz); for (const sx of [-1.35, 1.35]) for (const sz of [-0.7, 0.7]) K.cyl(0.06, 0.07, 0.86, wd, tx + sx, 0.43, tz + sz, 8); // mesa do mapa da floresta
      K.box(2.6, 0.01, 1.4, P('mapLeaf', '#d8cfa8', { rough: 1 }), tx, 0.955, tz); for (const [mx, mz, c] of [[-0.8, -0.3, '#2f6e73'], [0.3, 0.2, '#b8302a'], [0.9, -0.4, '#b8302a'], [-0.2, 0.45, '#c9a24a']]) K.add(new THREE.ConeGeometry(0.05, 0.16, 8), P('pin' + c, c, { rough: 0.5 }), tx + mx, 1.04, tz + mz, 0, Math.PI);
      candle(K, tx - 1.2, 0.95, tz - 0.6); candle(K, tx + 1.2, 0.95, tz + 0.6); box(tx, tz, 1.55, 0.9); }
    K.box(2.6, 1.0, 0.7, wd, -4.2, 0.5, -1.6); K.box(2.7, 0.06, 0.8, M.marble(), -4.2, 1.03, -1.6); for (let k = 0; k < 3; k++) K.cyl(0.006, 0.006, 0.8, P('shaft', '#d8c8a0'), -3.6 + k * 0.1, 1.08, -1.6, 4, 0, 0, Math.PI / 2); box(-4.2, -1.6, 1.35, 0.4);
    targetStand(K, 5.6, 0, -1.6, -Math.PI / 2); box(5.6, -1.6, 0.4, 0.6);
    R.done(K);
    N({ id: 'anwen', name: 'Anwen', title: 'Mestra-Arqueira das Sentinelas', model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'], look: look('f', 'valente', 'longo', 'preto'),
      shopList: ['arco_curto', 'arco_composto', 'arco_lunar', 'besta_de_caca', 'besta_de_cerco', 'faixa_de_penas', 'capuz_sombrio', 'luvas_couro', 'capa_viagem'], shopTitle: '🏹 Arsenal das Sentinelas',
      hello: 'Cada arco daqui foi curvado devagar, por anos, num galho vivo. Escolha um que combine com a sua mão, e não o contrário.' }, -4.2, -2.4, 0);
    N({ id: 'sylvar', name: 'Sylvar', title: 'Capitão das Sentinelas', model: 'Knight', show: ['1H_Sword', 'Knight_Cape'], look: look('m', 'valente', 'longo', 'preto'),
      lines: 'Os alfinetes vermelhos são os lugares onde encontramos raízes arrancadas, todas a leste, na Mata das Araras.\nNão é lobo nem tempestade: são os Golens de Musgo. Alguma coisa os acordou com fome de raiz. Se a Arquivista te pedir ajuda, aceite.' }, 1.6, 0.0, Math.PI * 0.85);
    N({ id: 'iolan', name: 'Iolan', title: 'Sentinela de folga', model: 'Rogue_Hooded', show: ['Rogue_Cape'], look: look('m', 'alegre', 'curto', 'loiro'),
      lines: 'Três dias de vigia no Posto, um de folga aqui dentro. Eu passo a folga encordoando arcos. Pois é, a vida de sentinela é assim mesmo.' }, 4.6, 2.6, -2.2); }
  // ---------- Estalagem Folha-de-Prata: descanso, cura e música ----------
  { const R = elfRoom(ctx, 'aeli_estalagem', { name: 'Estalagem Folha-de-Prata', x: 2495, z: 0, w: 15, d: 12 }), { K, hw, hd, H, box, N } = R, wd = M.elfWood(), I = R.I;
    { const hx = hw - 0.55, hz = -0.6; K.box(0.9, 2.6, 2.6, M.marble(), hx, 1.3, hz); K.box(0.4, 1.3, 1.6, P('hearthDark', '#1a120c'), hx - 0.3, 0.75, hz); K.box(1.3, 0.25, 3.0, M.marble(), hx - 0.2, 2.7, hz); for (let k = 0; k < 4; k++) K.add(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), wd, hx - 0.35, 0.2, hz - 0.5 + k * 0.3, 0.3 * k, 0, Math.PI / 2); box(hx, hz, 0.5, 1.35);
      const f = realFlame(0.5, 7, true); f.position.set(I.x + hx - 0.35, 0.3, I.z + hz); ctx.scene.add(f); ctx.roomAnims.push(f); const L = vlight('#ffb060', 5, 10, 1.4); L.position.set(I.x + hx - 1.2, 1.4, I.z + hz); ctx.scene.add(L); }
    curvedCounter(K, -4.4, -3.8, 1.6, 0); box(-4.4, -2.4, 1.15, 0.4); shelfWall(K, -4.4, -hd + 0.3, 0, 2.8, 3, fillPotions, r); box(-4.4, -hd + 0.3, 1.45, 0.25);
    for (const [tx, tz, n] of [[1.4, -0.2, 3], [4.0, 2.6, 3], [-1.6, 3.0, 2]]) { table(K, tx, tz, 0.75); for (let k = 0; k < n; k++) { const a = k / n * TAU + 0.4; stool(K, tx + Math.cos(a) * 1.15, tz + Math.sin(a) * 1.15); goblet(K, tx + Math.cos(a) * 0.4, 0.82, tz + Math.sin(a) * 0.4); } candle(K, tx, 0.82, tz); box(tx, tz, 0.75, 0.75); }
    for (const bz of [1.2, 3.9]) { bed(K, -hw + 1.2, bz, Math.PI / 2); box(-hw + 1.2, bz, 1.1, 0.6); } // leitos dos viajantes encostados na parede oeste
    R.done(K);
    N({ id: 'maelis', name: 'Maelis', title: 'Estalajadeira da Folha-de-Prata', model: 'Mage', heals: true, look: look('f', 'gentil', 'coque', 'loiro') }, -4.4, -3.3, 0);
    N({ id: 'aelar', name: 'Aelar', title: 'Menestrel', model: 'Rogue', show: ['Rogue_Cape'], look: look('m', 'alegre', 'curto', 'loiro'),
      lines: 'A melhor acústica de Aethra é aqui, com a madeira viva em volta. Escute: até as taças respondem no compasso.\nTenho uma canção nova sobre os golens da Mata. Ainda falta o final, quem sabe você me arranja um.' }, 3.0, -2.6, -0.6);
    N({ id: 'bram', name: 'Bram', title: 'Mercador do Porto das Gaivotas', model: 'Barbarian', look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'ruivo' }, beard: true },
      lines: 'Vim vender sal e voltar com seda. Mas a Maelis serve um chá de flor-lua que me prendeu aqui por uma semana inteira.' }, 4.0 + 1.15 * Math.cos(0.4 + TAU / 3), 2.6 + 1.15 * Math.sin(0.4 + TAU / 3), Math.atan2(-Math.cos(0.4 + TAU / 3), -Math.sin(0.4 + TAU / 3)), 'Sit_Chair_Idle'); }
  // ---------- Biblioteca das Copas: a Arquivista e a história de Sylvaren ----------
  { const R = elfRoom(ctx, 'aeli_biblioteca', { name: 'Biblioteca das Copas', x: 2530, z: 0, w: 14, d: 12 }), { K, hw, hd, H, box, N } = R, wd = M.elfWood(), I = R.I;
    for (const sx of [-1, 1]) { shelfWall(K, sx * 3.9, -hd + 0.3, 0, 3.6, 6, fillBooks, r); box(sx * 3.9, -hd + 0.3, 1.85, 0.25); shelfWall(K, sx * (hw - 1.4), 1.6, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 3.0, 5, fillBooks, r); box(sx * (hw - 1.4), 1.6, 0.25, 1.55); }
    { const lx = -5.0, lz = -hd + 0.9; for (const s of [-0.25, 0.25]) K.box(0.06, 3.6, 0.06, wd, lx + s, 1.8, lz, 0, -0.18); for (let k = 0; k < 9; k++) K.box(0.5, 0.04, 0.05, wd, lx, 0.3 + k * 0.38, lz + 0.32 - k * 0.068); } // escada encostada na estante
    for (const sx of [-1, 1]) { const dx = sx * 2.9, dz = 3.0; K.box(1.8, 0.07, 0.9, wd, dx, 0.82, dz, sx * 0.1); for (const a of [-0.75, 0.75]) for (const b of [-0.35, 0.35]) K.box(0.07, 0.8, 0.07, wd, dx + a, 0.4, dz + b); // mesas de leitura com livro aberto e vela
      for (const s of [-1, 1]) K.add(new THREE.PlaneGeometry(0.32, 0.42), P('page', '#f2ead4', { rough: 1, side: THREE.DoubleSide }), dx + s * 0.16, 0.9, dz, 0, -Math.PI / 2, s * 0.12); candle(K, dx + 0.6, 0.86, dz - 0.25); stool(K, dx, dz + 0.85); box(dx, dz, 0.95, 0.5); }
    R.done(K);
    { // esfera armilar viva no meio da sala: anéis de prata girando em volta de uma estrela de luz
      const g = new THREE.Group(); g.position.set(I.x, 0, I.z - 1.4); ctx.scene.add(g); const KB = new Kit(); KB.add(new THREE.LatheGeometry([[0.001, 0], [0.55, 0], [0.5, 0.15], [0.18, 0.3], [0.14, 1.0], [0.3, 1.1], [0.001, 1.12]].map(([a, b]) => new THREE.Vector2(a, b)), 28), M.marble()); g.add(KB.build());
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), M.moonGlow()); star.position.y = 1.75; g.add(star);
      const rings = [0.55, 0.45, 0.36].map((rr, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.018, 8, 64), i === 1 ? M.gold() : M.silver()); m.position.y = 1.75; m.rotation.x = 0.6 * i + 0.4; g.add(m); return m; });
      g.userData.update = t => { rings.forEach((m, i) => { m.rotation.y = t * (0.25 + i * 0.12); m.rotation.z = Math.sin(t * 0.3 + i) * 0.3; }); star.scale.setScalar(1 + Math.sin(t * 2) * 0.08); }; ctx.roomAnims.push(g);
      const L = vlight('#bfe6ff', 3, 9, 1.5); L.position.set(I.x, 2.2, I.z - 1.4); ctx.scene.add(L); box(0, -1.4, 0.6, 0.6); }
    N({ id: 'aranel', name: 'Aranel', title: 'Arquivista das Copas', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], look: look('f', 'sereno', 'longo', 'branco'),
      lines: 'Cada livro desta sala foi escrito por alguém que ouviu Sylvaren sonhar. Eu guardo as Crônicas das Folhas há quatrocentos invernos.\nUltimamente os sonhos dela andam agitados. Isso nunca acontece sem motivo.' }, 1.7, -0.6, -0.3);
    N({ id: 'lorien', name: 'Lorien', title: 'Escriba', model: 'Mage', look: look('m', 'sereno', 'curto', 'castanho'),
      lines: 'Estou copiando a "Canção das Raízes" pela décima segunda vez. A tinta de casca de bétula some se a página pegar sol, então ninguém abre as janelas.' }, -2.9, 2.1, 0.2); }
  return ROOMS;
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

  /* ===== árvores-irmãs: bairros da Cidade das Copas (plataforma, casas-oca com sala, praça) e pontes ===== */
  const canopyDoors = [], plazaNpcs = [];
  for (const [i, B] of BRIDGES.entries()) {
    const [bx, bz] = W(B.x, B.z), By = gY(B.x, B.z), Yd = Y0 + D1 - By; // a plataforma fica na MESMA altura do terraço da Mãe
    const tree = giantTree(300 + i, 36, B.tr, 11); add(tree.trunk, 'arvore_irma', bx, bz, By, { far: 800 }); add(tree.leaves, 'arvore_irma', bx, bz, By, { occ: false, far: 800 }); col(B.x, B.z, B.tr + 0.1, { name: 'arvore_irma' });
    for (const a of tree.roots) col(B.x + Math.cos(a) * (B.tr + 1.4), B.z + Math.sin(a) * (B.tr + 1.4), 0.7, { name: 'raiz', y0: -50, y1: By + 2.5 });
    const toMother = Math.atan2(MT.z - B.z, MT.x - B.x);
    // 2026-11-13: cada irmã é um bairro da Cidade das Copas — plataforma larga, casas-oca onde se entra, praça própria
    const Dt = DISTRICTS[B.id], TD = Y0 + D1, K = new Kit(); ringDeck(K, B.tr * 0.55, B.R, Yd, [[toMother, 0.1]]); // as tábuas entram no tronco (lá em cima ele é mais fino que na base: antes sobrava um buraco em volta)
    const colD = (lx, lz, rr, name, o = {}) => ctx.colliders.push({ x: bx + lx, z: bz + lz, r: rr, y0: TD - 0.6, y1: TD + 3.2, name, ...o });
    for (const s of [-1, 1]) { const a = toMother + s * 0.7; lantern(K, Math.cos(a) * (B.R - 0.3), Yd, Math.sin(a) * (B.R - 0.3), -a + Math.PI, 2.3); colD(Math.cos(a) * (B.R - 0.3), Math.sin(a) * (B.R - 0.3), 0.2, 'lanterna'); }
    const pa = toMother + Math.PI, inward = a => Math.atan2(-Math.cos(a), -Math.sin(a)), onP = (a, d) => [Math.cos(a) * d, Math.sin(a) * d];
    if (Dt.plaza === 'mercado') for (const s of [-1, 1]) { const a = pa + s * 0.34, [lx, lz] = onP(a, 10.4); silkStall(K, lx, Yd, lz, inward(a), s > 0 ? ['#c8302a', '#e8a02a', '#7aa83a', '#6a4a8a'] : ['#2f6e73', '#9ae0c8', '#e8e2d2', '#c9a24a']); colD(lx, lz, 1.3, 'banca'); }
    if (Dt.plaza === 'treino') { for (const s of [-1, 0, 1]) { const a = pa + s * 0.32, [lx, lz] = onP(a, 11.6); targetStand(K, lx, Yd, lz, inward(a)); colD(lx, lz, 0.6, 'alvo'); }
      const la = toMother - 1.75, [lx, lz] = onP(la, POD_D), g = add(lookout(77).build(), 'posto_de_vigia', bx + lx, bz + lz, TD, { occ: false, far: 600 });
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; colD(lx + Math.cos(a) * 2.2, lz + Math.sin(a) * 2.2, 0.2, 'posto_de_vigia', { y1: TD + 6 }); } colD(lx, lz, 0.7, 'pedra_de_vidência'); }
    if (Dt.plaza === 'jardim') { for (const s of [-1, 1]) { const a = pa + s * 0.45, [lx, lz] = onP(a, 11.3); K.box(2.2, 0.5, 0.6, M.elfWood(), lx, Yd + 0.25, lz, inward(a)); for (let k = 0; k < 12; k++) { const u = (k / 11 - 0.5) * 1.9, fx = lx + Math.cos(inward(a)) * u, fz = lz - Math.sin(inward(a)) * u; K.cyl(0.012, 0.012, 0.45, P('stem', '#4a7a3a'), fx, Yd + 0.7, fz, 4); K.add(new THREE.SphereGeometry(0.07, 8, 6), k % 3 ? M.moonGlow() : P('flowerP', '#f0c8e8', { emissive: '#c878c0', ei: 0.4 }), fx, Yd + 0.95, fz); } colD(lx, lz, 1.15, 'canteiro');
        const [bx2, bz2] = onP(a, 9.0); K.box(1.8, 0.08, 0.5, M.elfWood(), bx2, Yd + 0.45, bz2, inward(a)); for (const u of [-0.7, 0.7]) K.box(0.08, 0.45, 0.45, M.elfWood(), bx2 + Math.cos(inward(a)) * u, Yd + 0.22, bz2 - Math.sin(inward(a)) * u, inward(a)); colD(bx2, bz2, 0.9, 'banco'); }
      const [fx, fz] = onP(pa, 10.8); K.add(new THREE.LatheGeometry([[0.01, 0], [1.0, 0], [1.05, 0.45], [0.92, 0.5], [0.85, 0.3], [0.01, 0.25]].map(([a, b]) => new THREE.Vector2(a, b)), 40), M.marble(), fx, Yd, fz); K.cyl(0.85, 0.85, 0.04, P('moonWater', '#7fd8ff', { emissive: '#4ab8ff', ei: 0.65, rough: 0.05, transparent: true, opacity: 0.85 }), fx, Yd + 0.4, fz, 40); glowShrooms(K, fx + 1.4, Yd, fz, 6, r); colD(fx, fz, 1.1, 'bacia_da_lua'); }
    add(K.build(), 'plataforma_elfica', bx, bz, By, { occ: false, far: 600 });
    ringLevels(bx, bz, B.tr + 0.1, B.R, TD, [[toMother, 0.085]], ctx.colliders);
    for (const [hi, h] of Dt.houses.entries()) { // casas-oca: a porta olha para a ponte (dá para chegar nela direto) e leva à sala da casa
      const phi = toMother + h.side * 1.75, cx = Math.cos(phi) * POD_D, cz = Math.sin(phi) * POD_D, tx = h.side * Math.sin(phi), tz = -h.side * Math.cos(phi), ry = Math.atan2(tx, tz);
      const g = add(canopyPod(60 + i * 3 + hi, h.sign, h.name).build(), 'casa_copa', bx + cx, bz + cz, TD, { far: 600 }); g.rotation.y = ry; g.userData.label = h.name;
      ctx.colliders.push({ x: bx + cx, z: bz + cz, r: POD_R + 0.15, y0: TD - 0.6, y1: TD + 9, name: h.name });
      canopyDoors.push({ id: h.id, x: bx + cx + tx * (POD_R + 0.12), z: bz + cz + tz * (POD_R + 0.12), yaw: ry, y: TD }); }
    plazaNpcs.push({ B, pa, plaza: Dt.plaza, toMother });
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

  // as salas das casas das copas (longe do mapa) e as portas no alto, que levam até elas e trazem de volta para a plataforma
  if (ctx.INTERIORS && ctx.addDoorPortal) { buildCanopyRooms(ctx); for (const d of canopyDoors) ctx.addDoorPortal(d.id, d.x, d.z, d.yaw, d.y); }

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
  // gente nas praças dos bairros das copas (quem cuida das casas está lá dentro, nas salas)
  for (const { B, pa, plaza } of plazaNpcs) {
    const at = (a, d) => [B.x + Math.cos(a) * d, B.z + Math.sin(a) * d], face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    if (plaza === 'mercado') { const [x, z] = at(pa + 0.34, 11.5), [tx, tz] = at(pa + 0.34, 8); Wn({ id: 'liriel', name: 'Liriel', title: 'Vendedora de Frutos das Copas', model: 'Rogue', look: elfLook('f', 'alegre', 'longo', 'ruivo'), shopList: ['maca', 'uvas', 'pera', 'banana', 'frutinha_azul', 'mel'], shopTitle: '🍇 Banca da Liriel',
      hello: 'Maçã-da-lua, uva de orvalho e mel que as abelhas buscam lá na copa da Mãe. Quem prova não desce mais a rampa com pressa.' }, x, z, face(x, z, tx, tz), T1); }
    if (plaza === 'treino') { const [x, z] = at(pa, 6.6), [tx, tz] = at(pa, 11.6); Wn({ id: 'iriel', name: 'Iriel', title: 'Sentinela em treino', model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'], look: elfLook('f', 'valente', 'coque', 'platinado'),
      lines: 'Cinco metros, olhos fechados, só pelo som do vento nas folhas. A Mestra Anwen diz que é assim que se acerta um golem no escuro.' }, x, z, face(x, z, tx, tz), T1); }
    if (plaza === 'jardim') { const [x, z] = at(pa - 0.75, 10.2), [tx, tz] = at(pa - 0.45, 11.3); Wn({ id: 'tharael', name: 'Tharael', title: 'Jardineiro das Copas', model: 'Rogue', look: elfLook('m', 'gentil', 'longo', 'castanho'),
      lines: 'Estas flores-lua só abrem a doze metros do chão. Lá embaixo falta o vento da copa, e elas ficam emburradas.' }, x, z, face(x, z, tx, tz), T1); }
  }
  for (let i = col0; i < ctx.colliders.length; i++) { const c = ctx.colliders[i]; if (c.y0 === undefined || c._rel) continue; const g = heightAt(c.x, c.z); c.y0 -= g; c.y1 -= g; c._rel = true; }
}
