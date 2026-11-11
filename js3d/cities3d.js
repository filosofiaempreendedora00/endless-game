/* =========================================================================
   CIDADES DAS RAÇAS (S-117) — feitas em código, com texturas de verdade:
   • Pedrafunda (anões): bacia entre os picos mais altos, pedra escura, forjas,
     machados, estandartes vermelhos e o Mestre Brakar (refino, S-124).
   • Aelindra (elfos): vale de floresta antiga, árvores gigantes com plataformas,
     pavilhões de pedra branca com tetos em folha, lanternas e a Fonte da Lua.
   • Porto das Gaivotas (humanos do litoral): praia, cais, barcos, farol.
   Tudo é juntado por material (poucas chamadas de desenho) e some de longe.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';
import { heightAt, PORT, DWARF, ELF, SEA, seaDist, FROZEN, HALF } from './world3d.js';

export const rngOf = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* ---------------- texturas (canvas + relevo), em metros ---------------- */
const TEX = {};
function canvasPair(W, H, draw) {
  const c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = b.width = W; c.height = b.height = H;
  const g = c.getContext('2d'), gb = b.getContext('2d'); draw(g, gb, W, H);
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  for (const t of [map, bump]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}
// blocos de pedra (cantaria): fileiras de alturas e larguras variadas, cantos arredondados, argamassa funda
function stoneTex({ base = [34, 8, 46], mortar = '#3c3832', rows = [36, 52], wide = [50, 120], seed = 3, veins = 0, moss = 0 }) {
  return canvasPair(512, 512, (g, gb, W, H) => {
    const r = rngOf(seed); g.fillStyle = mortar; g.fillRect(0, 0, W, H); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
    let y = 0, row = 0;
    while (y < H) {
      const h = Math.min(H - y, rows[0] + r() * (rows[1] - rows[0])); let x = row % 2 ? -r() * 60 : -r() * 20;
      while (x < W) {
        const w = wide[0] + r() * (wide[1] - wide[0]), l = base[2] * (0.86 + r() * 0.26);
        const draw = ox => {
          g.fillStyle = `hsl(${base[0] + (r() - 0.5) * 8}, ${base[1] * (0.7 + r() * 0.6)}%, ${l}%)`; g.beginPath(); g.roundRect(x + ox + 2, y + 2, w - 4, h - 4, 6); g.fill();
          const gr = gb.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#a0a0a0'); gr.addColorStop(0.5, '#dadada'); gr.addColorStop(1, '#8a8a8a'); gb.fillStyle = gr; gb.beginPath(); gb.roundRect(x + ox + 3, y + 3, w - 6, h - 6, 7); gb.fill();
        };
        draw(0); if (x + w > W) draw(-W); if (x < 0) draw(W);
        for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '15,12,10'},${r() * 0.07})`; g.fillRect(x + 4 + r() * (w - 8), y + 4 + r() * (h - 8), 2 + r() * 8, 1 + r() * 4); }
        if (veins && r() < veins) { g.strokeStyle = 'rgba(120,120,130,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + r() * w, y + 3); g.bezierCurveTo(x + r() * w, y + h * 0.4, x + r() * w, y + h * 0.6, x + r() * w, y + h - 3); g.stroke(); }
        if (r() < 0.18) { g.strokeStyle = 'rgba(20,18,15,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + r() * w, y + 4); g.lineTo(x + r() * w, y + h - 4); g.stroke(); }
        x += w;
      }
      y += h; row++;
    }
    if (moss) { for (let k = 0; k < 220 * moss; k++) { g.fillStyle = `rgba(70,95,45,${0.1 + r() * 0.2})`; g.beginPath(); g.arc(r() * W, H - Math.pow(r(), 2) * H * 0.5, 2 + r() * 9, 0, 7); g.fill(); } }
    const d = g.createLinearGradient(0, 0, 0, H); d.addColorStop(0, 'rgba(0,0,0,0)'); d.addColorStop(1, 'rgba(30,22,15,0.18)'); g.fillStyle = d; g.fillRect(0, 0, W, H);
  });
}
// tábuas de madeira com veios e pregos
function woodTex({ base = [28, 38, 30], seed = 5, vertical = true }) {
  return canvasPair(256, 512, (g, gb, W, H) => {
    const r = rngOf(seed), n = 4;
    for (let i = 0; i < n; i++) {
      const x = i * W / n, l = base[2] * (0.85 + r() * 0.3);
      g.fillStyle = `hsl(${base[0] + (r() - 0.5) * 6}, ${base[1]}%, ${l}%)`; g.fillRect(x, 0, W / n, H);
      for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(${r() < 0.6 ? '30,18,8' : '255,230,200'},${0.08 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.4; const xx = x + 3 + r() * (W / n - 6); g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + (r() - 0.5) * 8, H * 0.3, xx + (r() - 0.5) * 8, H * 0.7, xx + (r() - 0.5) * 6, H); g.stroke(); }
      if (r() < 0.6) { g.fillStyle = 'rgba(40,24,10,0.5)'; g.beginPath(); g.ellipse(x + W / n / 2 + (r() - 0.5) * 20, r() * H, 4 + r() * 4, 8 + r() * 8, 0, 0, 7); g.fill(); } // nó
      g.fillStyle = 'rgba(20,12,6,0.85)'; g.fillRect(x, 0, 2, H);
      gb.fillStyle = '#c8c8c8'; gb.fillRect(x + 2, 0, W / n - 3, H); gb.fillStyle = '#202020'; gb.fillRect(x, 0, 2, H);
      for (const yy of [H * 0.12, H * 0.88]) { g.fillStyle = '#2a2622'; g.beginPath(); g.arc(x + W / n / 2, yy, 2.5, 0, 7); g.fill(); }
    }
  });
}
// telhas sobrepostas (ardósia, barro, cobre)
function roofTex({ base = [12, 45, 38], seed = 9, round = true }) {
  return canvasPair(512, 512, (g, gb, W, H) => {
    const r = rngOf(seed), th = 40, tw = 48; g.fillStyle = '#1e1a18'; g.fillRect(0, 0, W, H); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
    for (let row = 0; row * th < H + th; row++) {
      const y = row * th, off = row % 2 ? tw / 2 : 0;
      for (let x = -tw; x < W + tw; x += tw) {
        const l = base[2] * (0.8 + r() * 0.35);
        g.fillStyle = `hsl(${base[0] + (r() - 0.5) * 10}, ${base[1] * (0.8 + r() * 0.3)}%, ${l}%)`; g.beginPath();
        if (round) { g.moveTo(x + off + 2, y); g.lineTo(x + off + tw - 2, y); g.lineTo(x + off + tw - 2, y + th * 0.75); g.quadraticCurveTo(x + off + tw / 2, y + th * 1.25, x + off + 2, y + th * 0.75); }
        else g.rect(x + off + 2, y, tw - 4, th * 1.05);
        g.fill();
        const gr = gb.createLinearGradient(0, y, 0, y + th); gr.addColorStop(0, '#606060'); gr.addColorStop(1, '#e0e0e0'); gb.fillStyle = gr; gb.fillRect(x + off + 2, y, tw - 4, th);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + off + 2, y, tw - 4, 4);
      }
    }
  });
}
// palha
function thatchTex(seed = 4) {
  return canvasPair(256, 256, (g, gb, W, H) => {
    const r = rngOf(seed); g.fillStyle = '#8a7340'; g.fillRect(0, 0, W, H); gb.fillStyle = '#606060'; gb.fillRect(0, 0, W, H);
    for (let k = 0; k < 2600; k++) { const x = r() * W, y = r() * H, l = 8 + r() * 22; g.strokeStyle = `hsl(${40 + r() * 10}, ${40 + r() * 20}%, ${28 + r() * 30}%)`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + l); g.stroke(); gb.strokeStyle = r() < 0.5 ? '#ffffff' : '#303030'; gb.beginPath(); gb.moveTo(x, y); gb.lineTo(x, y + l); gb.stroke(); }
    for (let y = 0; y < H; y += 32) { g.fillStyle = 'rgba(30,20,8,0.35)'; g.fillRect(0, y, W, 3); }
  });
}
// reboco caiado (casas do porto)
function plasterTex(seed = 2, base = '#ece4d2') {
  return canvasPair(256, 256, (g, gb, W, H) => {
    const r = rngOf(seed); g.fillStyle = base; g.fillRect(0, 0, W, H); gb.fillStyle = '#909090'; gb.fillRect(0, 0, W, H);
    for (let k = 0; k < 900; k++) { const x = r() * W, y = r() * H, s = 2 + r() * 10; g.fillStyle = `rgba(${r() < 0.5 ? '120,100,80' : '255,255,250'},${r() * 0.06})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); gb.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.1)`; gb.fillRect(x, y, s, s); }
    const d = g.createLinearGradient(0, 0, 0, H); d.addColorStop(0.7, 'rgba(0,0,0,0)'); d.addColorStop(1, 'rgba(90,70,40,0.25)'); g.fillStyle = d; g.fillRect(0, 0, W, H);
  });
}
// material com textura repetida a cada `tile` metros (o mapeamento é feito na geometria, em metros)
const MATS = {};
function texMat(key, make, tile, opts = {}) {
  if (MATS[key]) return MATS[key];
  const t = TEX[key] || (TEX[key] = make());
  const m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: opts.bump ?? 2, roughness: opts.rough ?? 0.92, metalness: opts.metal ?? 0, color: opts.color || '#ffffff', side: opts.side || THREE.FrontSide });
  m.userData.tile = tile; return (MATS[key] = m);
}
const plain = (key, color, o = {}) => MATS[key] || (MATS[key] = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side || THREE.FrontSide, depthWrite: o.depthWrite ?? true }));
export const M = {
  dwarfStone: () => texMat('dwarfStone', () => stoneTex({ base: [28, 7, 30], mortar: '#1e1b18', rows: [44, 66], wide: [70, 150], seed: 11 }), 4.5),
  dwarfCarve: () => texMat('dwarfCarve', () => stoneTex({ base: [30, 9, 38], mortar: '#2a2622', rows: [60, 90], wide: [120, 220], seed: 13 }), 6),
  slate: () => texMat('slate', () => roofTex({ base: [215, 10, 26], seed: 7, round: false }), 3),
  copper: () => texMat('copper', () => roofTex({ base: [165, 30, 36], seed: 8 }), 3, { metal: 0.3, rough: 0.6 }),
  marble: () => texMat('marble', () => stoneTex({ base: [40, 14, 88], mortar: '#b8b2a4', rows: [70, 100], wide: [140, 240], seed: 21, veins: 0.5 }), 5, { bump: 0.8, rough: 0.55 }),
  elfWood: () => texMat('elfWood', () => woodTex({ base: [32, 30, 46], seed: 23 }), 2.2),
  leafRoof: () => texMat('leafRoof', () => roofTex({ base: [150, 18, 42], seed: 25 }), 1.6, { metal: 0.2, rough: 0.55 }),
  bark: () => texMat('bark', () => woodTex({ base: [25, 22, 26], seed: 27 }), 3, { bump: 3 }),
  wood: () => texMat('wood', () => woodTex({ base: [28, 38, 30], seed: 5 }), 2),
  darkWood: () => texMat('darkWood', () => woodTex({ base: [22, 32, 18], seed: 6 }), 2),
  plaster: () => texMat('plaster', () => plasterTex(2), 3, { bump: 0.6 }),
  thatch: () => texMat('thatch', () => thatchTex(4), 2.5, { bump: 2.5 }),
  clay: () => texMat('clay', () => roofTex({ base: [14, 55, 40], seed: 9 }), 3),
  greyStone: () => texMat('greyStone', () => stoneTex({ base: [38, 6, 52], mortar: '#4a453e', seed: 31, moss: 0.6 }), 4),
  sandStone: () => texMat('sandStone', () => stoneTex({ base: [38, 22, 62], mortar: '#6e6250', seed: 33 }), 4),
  iron: () => plain('iron', '#2e2b29', { metal: 0.85, rough: 0.45 }),
  steel: () => plain('steel', '#a9adb3', { metal: 0.9, rough: 0.3 }),
  gold: () => plain('gold', '#c9a24a', { metal: 0.9, rough: 0.3 }),
  silver: () => plain('silver', '#dfe4ea', { metal: 0.85, rough: 0.25 }),
  ember: () => plain('ember', '#ff8a2a', { emissive: '#ff6a10', ei: 2.2 }),
  rune: () => plain('rune', '#ffcf7a', { emissive: '#ff9a2a', ei: 1.6 }),
  moonGlow: () => plain('moonGlow', '#dff4ff', { emissive: '#9fd8ff', ei: 1.8 }),
  glass: () => plain('glass', '#ffe8b8', { emissive: '#ffc878', ei: 0.9, rough: 0.2 }),
  leaf: () => MATS.leaf || (MATS.leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })),
  rope: () => plain('rope', '#b39a6a', { rough: 1 }),
};

/* ---------------- montador: junta peças por material ---------------- */
function worldUV(g, tile) {
  const P = g.attributes.position, uv = new Float32Array(P.count * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)); const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) { const p = [a, b, c][k]; let u, v; if (ay >= ax && ay >= az) { u = p.x; v = p.z; } else if (ax >= az) { u = p.z; v = p.y; } else { u = p.x; v = p.y; } uv[(i + k) * 2] = u / tile; uv[(i + k) * 2 + 1] = v / tile; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export class Kit {
  constructor() { this.parts = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz)); g.applyMatrix4(_m);
    if (mat.userData.tile) worldUV(g, mat.userData.tile);
    const key = mat.uuid + (g.attributes.color ? 'c' : '');
    if (!this.parts.has(key)) this.parts.set(key, { mat, geos: [] });
    this.parts.get(key).geos.push(g); return this;
  }
  box(w, h, d, mat, x, y, z, ry = 0, rx = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, rx, rz); }
  cyl(rt, rb, h, mat, x, y, z, seg = 20, ry = 0, rx = 0, rz = 0, open = false) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, x, y, z, ry, rx, rz); }
  build(shadow = true) {
    const g = new THREE.Group();
    for (const { mat, geos } of this.parts.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = shadow && !mat.transparent && !mat.emissive?.getHex?.(); m.receiveShadow = true; g.add(m);
    }
    return g;
  }
}
// telhado de duas águas (prisma), centrado na base
function gable(K, w, d, h, mat, x, y, z, ry = 0, over = 0.4) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 - over, -0.1); sh.lineTo(w / 2 + over, -0.1); sh.lineTo(0, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: d + over * 2, bevelEnabled: false }); g.translate(0, 0, -(d + over * 2) / 2);
  K.add(g, mat, x, y, z, ry);
}
// arco de pedra (meia-volta) feito de aduelas
function archBlocks(K, span, thick, depth, mat, x, y, z, ry = 0, n = 13) {
  const R = span / 2 + thick / 2;
  for (let i = 0; i < n; i++) { const a = Math.PI * (i + 0.5) / n, bx = Math.cos(a) * R, by = Math.sin(a) * R; const g = new THREE.BoxGeometry(thick * 0.98, Math.PI * R / n * 0.94, depth); const t = new THREE.Matrix4().makeRotationZ(a).setPosition(bx, by, 0); g.applyMatrix4(t); K.add(g, mat, x, y, z, ry); }
}
// machado de duas lâminas
function axeGeo(len = 1.6, bladeW = 0.5) {
  const parts = [];
  const h = new THREE.CylinderGeometry(0.03, 0.035, len, 10); h.translate(0, len / 2, 0); parts.push(h);
  const bl = new THREE.Shape(); bl.moveTo(0, -0.05); bl.quadraticCurveTo(bladeW * 0.6, -0.12, bladeW, -bladeW * 0.55); bl.quadraticCurveTo(bladeW * 0.8, 0, bladeW, bladeW * 0.55); bl.quadraticCurveTo(bladeW * 0.6, 0.12, 0, 0.05); bl.closePath();
  for (const s of [1, -1]) { const g = new THREE.ExtrudeGeometry(bl, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 }); g.translate(0, 0, -0.015); if (s < 0) g.rotateY(Math.PI); g.translate(0, len - 0.25, 0); parts.push(g); }
  return parts;
}
// estandarte de tecido com brasão pintado, balançando ao vento
const clothT = { value: 0 };
function bannerTex(kind) {
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const pal = { anao: ['#7a1a14', '#a8281e', '#e2b04a'], elfo: ['#1e4a34', '#2e6e4a', '#e8eef2'], porto: ['#1e3e6e', '#2e5ea0', '#f2f2ea'], castelo: ['#3e1e5a', '#5a2e82', '#e6c46a'], vigilia: ['#0c0c0e', '#1c1c20', '#e8ecf0'], guilda: ['#6a4a10', '#a8781e', '#fff2c8'] }[kind];
  const gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, pal[0]); gr.addColorStop(0.5, pal[1]); gr.addColorStop(1, pal[0]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * W, Math.random() * H, 1, 3); }
  x.strokeStyle = pal[2]; x.lineWidth = 5; x.strokeRect(8, 8, W - 16, H - 28);
  x.save(); x.translate(W / 2, 110); x.fillStyle = pal[2]; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
  if (kind === 'anao') { x.fillRect(-6, -40, 12, 70); x.beginPath(); x.moveTo(-6, -36); x.quadraticCurveTo(-40, -42, -34, -8); x.quadraticCurveTo(-26, -20, -6, -18); x.fill(); x.beginPath(); x.moveTo(6, -36); x.quadraticCurveTo(40, -42, 34, -8); x.quadraticCurveTo(26, -20, 6, -18); x.fill(); x.fillRect(-24, 34, 48, 10); x.fillRect(-16, 26, 32, 10); } // machado sobre a bigorna
  else if (kind === 'elfo') { x.beginPath(); x.arc(0, -10, 30, 0.6, Math.PI * 2 - 0.6); x.arc(14, -10, 24, Math.PI * 2 - 0.7, 0.7, true); x.fill(); x.beginPath(); x.moveTo(0, 50); x.quadraticCurveTo(-26, 26, 0, 6); x.quadraticCurveTo(26, 26, 0, 50); x.fill(); } // lua e folha
  else if (kind === 'vigilia') { // asa de corvo branca sobre o negro, com uma estrela (a vigília que não dorme)
    for (let k = 0; k < 7; k++) { x.save(); x.rotate(-0.9 + k * 0.17); x.beginPath(); x.moveTo(0, 30); x.quadraticCurveTo(-8, -10, -4, -52 + k * 2); x.quadraticCurveTo(6, -10, 6, 30); x.closePath(); x.fill(); x.restore(); }
    x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 4 : 11; x.lineTo(Math.cos(a) * r + 26, Math.sin(a) * r - 46); } x.fill(); }
  else if (kind === 'guilda') { // balança de mercador e uma moeda
    x.fillRect(-2, -44, 4, 70); x.fillRect(-36, -36, 72, 4); x.fillRect(-14, 24, 28, 6);
    for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(sd * 34, -32); x.lineTo(sd * 44, -2); x.lineTo(sd * 24, -2); x.closePath(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.stroke(); x.beginPath(); x.arc(sd * 34, -2, 12, 0, Math.PI); x.fill(); }
    x.beginPath(); x.arc(0, 50, 14, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.35)'; x.font = 'bold 16px serif'; x.textAlign = 'center'; x.fillText('Z', 0, 56); }
  else if (kind === 'porto') { x.lineWidth = 7; x.strokeStyle = pal[2]; x.beginPath(); x.moveTo(0, -40); x.lineTo(0, 40); x.moveTo(-22, -26); x.lineTo(22, -26); x.stroke(); x.beginPath(); x.arc(0, 18, 28, 0.2, Math.PI - 0.2); x.stroke(); x.beginPath(); x.arc(0, -46, 8, 0, 7); x.stroke(); } // âncora
  else { x.fillRect(-26, -10, 52, 46); for (const t of [-26, -9, 8]) x.fillRect(t, -24, 18, 16); x.fillRect(-10, -50, 20, 40); x.fillStyle = pal[0]; x.beginPath(); x.arc(0, 26, 10, Math.PI, 0); x.fillRect(-10, 26, 20, 12); x.fill(); } // torre
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const bannerMats = {};
function bannerMat(kind) {
  if (bannerMats[kind]) return bannerMats[kind];
  const m = new THREE.MeshStandardMaterial({ map: bannerTex(kind), side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = sh => { sh.uniforms.uT = clothT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float hang = clamp(-position.y / 2.0, 0.0, 1.0); vec4 wp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    transformed.z += sin(uT * 2.3 + position.y * 2.4 + wp.x * 0.3) * 0.12 * hang + sin(uT * 3.7 + position.x * 5.0) * 0.03 * hang;
    transformed.x += sin(uT * 1.7 + wp.z * 0.2) * 0.05 * hang;`); };
  return (bannerMats[kind] = m);
}
function makeBanner(kind, w = 1.1, h = 2.4) {
  const g = new THREE.Group(), pl = new THREE.PlaneGeometry(w, h, 8, 16); pl.translate(0, -h / 2, 0);
  const P = pl.attributes.position; for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i); if (py < -h + 0.32) P.setY(i, -h + Math.abs(px) / (w / 2) * 0.32); }
  pl.computeVertexNormals(); const cl = new THREE.Mesh(pl, bannerMat(kind)); cl.castShadow = true; g.add(cl);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w + 0.25, 10), M.iron()); rod.rotation.z = Math.PI / 2; g.add(rod);
  return g;
}
// chama animada (camadas aditivas) — o update fica no roomAnims
function flame(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const layer = (r, h, c, o, y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.set(1, h, 1); m.position.y = y; g.add(m); return m; };
  layer(0.2, 2.2, '#ff4a12', 0.45, 0.2); layer(0.14, 2.1, '#ff9a30', 0.7, 0.17); layer(0.07, 1.9, '#fff0b0', 0.95, 0.1);
  g.scale.setScalar(scale); g.userData.update = t => { g.scale.set(scale * (1 + Math.sin(t * 17 + seed) * 0.08), scale * (0.88 + Math.sin(t * 11 + seed) * 0.12 + Math.sin(t * 23 + seed * 2) * 0.06), scale); g.rotation.z = Math.sin(t * 7 + seed) * 0.06; };
  return g;
}
function brazier(ctx, x, y, z, light = false, seed = 0) {
  const K = new Kit(); K.add(new THREE.LatheGeometry([[0.02, 0], [0.18, 0], [0.12, 0.1], [0.08, 0.95], [0.25, 1.0], [0.48, 1.25], [0.5, 1.35], [0.44, 1.32], [0.02, 1.1]].map(([a, b]) => new THREE.Vector2(a, b)), 20), M.iron());
  for (let k = 0; k < 6; k++) K.add(new THREE.DodecahedronGeometry(0.1, 0), M.ember(), Math.cos(k) * 0.22, 1.32, Math.sin(k) * 0.22);
  const g = K.build(); g.position.set(x, y, z); ctx.scene.add(g);
  const f = flame(1.4, seed); f.position.y = 1.3; g.add(f); ctx.roomAnims.push(f);
  if (light) { const L = vlight('#ffa050', 4, 14, 1.6); L.position.set(x, y + 2, z); ctx.scene.add(L); }
  ctx.colliders.push({ x, z, r: 0.5 }); return g;
}
const gY = (x, z) => heightAt(x, z);
// coloca um conjunto montado no mundo: cena, câmera (oclusores), Q (placed), colisão em caixa
const CULL = []; // tudo o que as cidades colocam: some de longe (o cullScenery do main3d não mexe nos "big")
function put(ctx, K, asset, x, z, ry = 0, { y, box, big = true, occ = true } = {}) {
  const g = K.build(); g.position.set(x, y ?? gY(x, z), z); g.rotation.y = ry; ctx.scene.add(g); CULL.push(g);
  g.userData.asset = asset; g.userData.big = big; ctx.placed.push(g); if (occ) ctx.occluders.push(g);
  if (box) for (const [lx, lz, hx, hz] of box) { const cs = Math.cos(ry), sn = Math.sin(ry); ctx.colliders.push({ x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs, r: Math.max(hx, hz), box: true, hx, hz, rot: ry, name: asset }); }
  return g;
}

/* =========================== PEDRAFUNDA (anões) =========================== */
// casa de anão: paredes grossas de pedra escura, base mais larga, telhado baixo de ardósia, porta redonda, chaminé com brasa
function dwarfHouse(seed, w = 8, d = 7) {
  const K = new Kit(), r = rngOf(seed), st = M.dwarfStone(), h = 3.6 + r() * 1.2;
  K.box(w + 0.8, 1.2, d + 0.8, st, 0, -0.4, 0); // embasamento (afunda no chão)
  K.box(w, h, d, st, 0, 0.2 + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.9, h + 0.4, 0.9, M.dwarfCarve(), sx * (w / 2), 0.2 + h / 2, sz * (d / 2)); // cunhais
  K.box(w + 0.3, 0.35, d + 0.3, M.dwarfCarve(), 0, h + 0.3, 0); // cornija
  gable(K, w + 0.4, d + 0.4, 1.9 + r() * 0.6, M.slate(), 0, h + 0.45, 0, 0, 0.5);
  // porta arredondada de madeira com ferragens, emoldurada por pedra lavrada
  K.add(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 24, 1, false, -Math.PI / 2, Math.PI), M.darkWood(), 0, 2.0, d / 2 + 0.06, 0, Math.PI / 2, 0); K.box(2.0, 2.0, 0.25, M.darkWood(), 0, 1.0, d / 2 + 0.06);
  for (const yy of [0.6, 1.5]) K.box(2.0, 0.08, 0.3, M.iron(), 0, yy, d / 2 + 0.1);
  K.add(new THREE.TorusGeometry(1.2, 0.2, 10, 24, Math.PI), M.dwarfCarve(), 0, 2.0, d / 2 + 0.05);
  for (const sx of [-1, 1]) K.box(0.4, 2.0, 0.45, M.dwarfCarve(), sx * 1.2, 1.0, d / 2 + 0.05);
  // janelas com luz quente
  for (const sx of [-1, 1]) { K.box(0.9, 0.9, 0.1, M.glass(), sx * (w / 2 - 1.6), 2.4, d / 2 + 0.03); K.box(1.2, 0.18, 0.3, M.dwarfCarve(), sx * (w / 2 - 1.6), 1.85, d / 2 + 0.08); K.box(0.08, 0.9, 0.12, M.iron(), sx * (w / 2 - 1.6), 2.4, d / 2 + 0.08); }
  K.box(1.2, 3.2, 1.2, st, w / 2 - 1.4, h + 1.6, -d / 4); K.box(1.4, 0.3, 1.4, M.dwarfCarve(), w / 2 - 1.4, h + 3.2, -d / 4); K.box(0.7, 0.1, 0.7, M.ember(), w / 2 - 1.4, h + 3.36, -d / 4);
  return { K, box: [[0, 0, w / 2 + 0.4, d / 2 + 0.4]] };
}
// estátua de guerreiro anão (pedra lavrada): corpo atarracado, elmo com chifres, barba trançada, machado apoiado no chão
function dwarfStatue(seed = 1) {
  const K = new Kit(), st = M.dwarfCarve(), r = rngOf(seed);
  K.box(4.6, 1.6, 4.6, M.dwarfStone(), 0, 0.8, 0); K.box(4.0, 0.4, 4.0, st, 0, 1.8, 0);
  K.add(new THREE.LatheGeometry([[0.01, 0], [1.5, 0], [1.6, 1.2], [1.8, 2.6], [2.0, 3.8], [1.9, 4.8], [1.4, 5.5], [0.8, 5.8], [0.01, 5.9]].map(([a, b]) => new THREE.Vector2(a, b)), 28), st, 0, 2.0, 0); // tronco largo com saia de malha
  for (const sx of [-1, 1]) { K.cyl(0.55, 0.65, 2.2, st, sx * 0.8, 2.6, 0.3, 16); K.add(new THREE.SphereGeometry(0.85, 20, 14), st, sx * 2.1, 7.4, 0, 0, 0, 0, 1, 0.8, 1); K.cyl(0.45, 0.5, 2.6, st, sx * 2.3, 6.0, 0.5, 14, 0, 0.35, sx * 0.2); } // pernas, ombreiras, braços
  K.add(new THREE.SphereGeometry(1.15, 24, 18), st, 0, 8.7, 0.2); // cabeça
  K.add(new THREE.SphereGeometry(1.3, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), st, 0, 9.0, 0.1); // elmo
  K.box(2.7, 0.3, 2.7, st, 0, 8.95, 0.1, 0.785);
  for (const sx of [-1, 1]) { const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 1.1, 9.4, 0), new THREE.Vector3(sx * 1.9, 9.9, 0.1), new THREE.Vector3(sx * 2.2, 10.9, -0.2), new THREE.Vector3(sx * 2.0, 11.6, -0.5)]), 16, 0.22, 10); K.add(c, st); } // chifres
  // barba longa trançada em três tranças
  K.add(new THREE.ConeGeometry(1.0, 2.6, 20), st, 0, 6.9, 1.05, 0, Math.PI, 0); for (const sx of [-0.45, 0, 0.45]) for (let k = 0; k < 4; k++) K.add(new THREE.SphereGeometry(0.22 - k * 0.03, 12, 10), st, sx, 5.6 - k * 0.42, 1.3 + k * 0.05);
  K.box(0.7, 0.3, 0.25, st, 0, 8.5, 1.25); // bigode
  for (const sx of [-0.4, 0.4]) K.add(new THREE.SphereGeometry(0.16, 12, 10), M.rune(), sx, 8.85, 1.18); // olhos de runa
  // machado enorme apoiado à frente, com as mãos no cabo
  for (const g of axeGeo(7.5, 1.9)) K.add(g, st, 0, 1.9, 2.3, 0, 0, 0, 1, 1, 6);
  for (const sx of [-1, 1]) K.add(new THREE.SphereGeometry(0.5, 16, 12), st, sx * 0.55, 8.2, 2.2);
  for (let k = 0; k < 7; k++) K.box(0.08, 0.5, 0.06, M.rune(), -1.2 + k * 0.4, 0.95, 2.32, 0, 0, (k % 3 - 1) * 0.45); // runas gravadas na base
  return K;
}
// a ferraria do Mestre Brakar: galpão aberto com forja acesa, bigornas, barril de têmpera, fole e armas
function smithy(ctx, x, z, ry) {
  const K = new Kit(), st = M.dwarfStone(), wd = M.darkWood();
  K.box(14, 0.5, 10, M.dwarfCarve(), 0, 0.0, 0); // piso de laje
  K.box(14, 5.4, 1.0, st, 0, 2.7, -4.5); K.box(1.0, 5.4, 10, st, -6.5, 2.7, 0); // paredes do fundo e do lado
  for (const px of [-1.5, 3.5, 6.5]) K.box(0.7, 5.0, 0.7, wd, px, 2.5, 4.4); // colunas de madeira na frente
  K.box(14.6, 0.5, 0.6, wd, 0, 5.2, 4.4);
  { const sh = new THREE.Shape(); sh.moveTo(-0.2, 0); sh.lineTo(10.8, 0); sh.lineTo(10.8, 0.3); sh.lineTo(0, 2.6); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 15, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(7.5, 5.4, -5.4); K.add(g, M.slate()); } // telhado de uma água
  // forja: lareira de pedra com boca em arco, carvão em brasa e coifa
  K.box(4.2, 1.3, 2.6, M.dwarfCarve(), -3.6, 0.65, -2.9); K.box(3.2, 0.25, 1.8, M.ember(), -3.6, 1.32, -2.7);
  K.box(4.6, 0.5, 3.0, st, -3.6, 3.4, -3.0); K.add(new THREE.CylinderGeometry(0.9, 2.1, 1.6, 4, 1), st, -3.6, 4.4, -3.1, Math.PI / 4); K.box(1.4, 3.0, 1.4, st, -3.6, 6.3, -3.4);
  // bigornas
  const anvil = (ax, az, rot) => { K.box(0.6, 0.6, 0.6, wd, ax, 0.55, az, rot); K.box(0.42, 0.25, 0.32, M.iron(), ax, 0.95, az, rot); K.box(0.95, 0.24, 0.36, M.iron(), ax, 1.18, az, rot); K.add(new THREE.ConeGeometry(0.17, 0.5, 16), M.iron(), ax + Math.cos(rot) * 0.68, 1.18, az - Math.sin(rot) * 0.68, rot, 0, -Math.PI / 2); };
  anvil(0.4, -0.6, 0.2); anvil(-1.2, 1.4, -0.4);
  K.add(new THREE.CylinderGeometry(0.55, 0.5, 0.9, 20, 1, true), wd, 1.8, 0.45, -2.6); K.cyl(0.5, 0.5, 0.05, plain('water', '#2a4a5a', { rough: 0.1 }), 1.8, 0.82, -2.6, 20); // barril de têmpera
  for (const yy of [0.15, 0.75]) K.add(new THREE.TorusGeometry(0.54, 0.03, 8, 24), M.iron(), 1.8, yy, -2.6, 0, Math.PI / 2);
  // fole de couro
  K.add(new THREE.SphereGeometry(0.7, 18, 12), plain('leather', '#5a3a22', { rough: 0.8 }), -5.6, 1.1, -1.4, 0, 0, 0, 1, 0.45, 1.4);
  // suporte de armas: machados e martelos
  // suporte de armas na parede lateral (a parede do fundo, à direita, fica livre para o quadro do refino)
  K.box(0.3, 0.15, 3.6, wd, -5.85, 2.6, 2.0); K.box(0.3, 0.15, 3.6, wd, -5.85, 1.2, 2.0);
  for (let k = 0; k < 4; k++) for (const g of axeGeo(1.7, 0.35 + (k % 2) * 0.1)) K.add(g, k % 2 ? M.steel() : M.iron(), -5.7, 0.75, 0.7 + k * 0.85, Math.PI / 2, 0, 0.08);
  K.box(3.6, 2.6, 0.12, M.darkWood(), 4.2, 2.4, -3.92); K.box(3.8, 0.14, 0.18, M.iron(), 4.2, 3.75, -3.88); K.box(3.8, 0.14, 0.18, M.iron(), 4.2, 1.05, -3.88); // moldura do quadro do refino
  // quadro de refino (parede lateral leste do galpão fica livre: o refino em si é colocado pelo main3d)
  const g = put(ctx, K, 'ferraria_anao', x, z, ry, { box: [[0, -4.5, 7, 0.5], [-6.5, 0, 0.5, 5], [-3.6, -2.9, 2.2, 1.4], [1.8, -2.6, 0.6, 0.6]] });
  const f = flame(2.2, 3); f.position.set(-3.6, 1.35, -2.7); g.add(f); ctx.roomAnims.push(f);
  const L = vlight('#ff8a3a', 6, 16, 1.6); L.position.set(-3.6, 2.2, -1.8); g.add(L);
  return g;
}
/* S-178: Pedrafunda reconstruída como uma cidade-fortaleza antiga (no espírito das cidades muradas dos épicos gregos, mas anã):
   muralha circular de pedra com talude e torres, portão monumental com portas de bronze, rua principal até a ágora
   (praça com a forja de lava, pórtico de colunas e a ferraria do Brakar), cidade baixa em anéis de casas e, ao norte,
   a acrópole em dois terraços: templo da Forja, santuário dos Ancestrais e o Salão do Rei-Sob-a-Pedra no alto.
   Terraços e escadarias são "pisos" (DECKS): dá para subir andando. */
function dwarfTemple() { // templo da Forja: estilóbata em degraus, colunata, frontões e telhado de bronze; porta acesa
  const K = new Kit(), cv = M.dwarfCarve(), st = M.dwarfStone(), W = 14, D = 14;
  for (let k = 0; k < 3; k++) K.box(W + 3 - k * 1.0, 0.45, D + 3 - k * 1.0, cv, 0, 0.22 + k * 0.45, 0);
  const y0 = 1.35, H = 7.5;
  for (let i = 0; i < 6; i++) for (const z of [-D / 2 + 0.6, D / 2 - 0.6]) { const x = -W / 2 + 0.6 + i * (W - 1.2) / 5; K.box(1.3, 0.4, 1.3, cv, x, y0 + 0.2, z); K.cyl(0.5, 0.58, H, cv, x, y0 + 0.4 + H / 2, z, 16); K.box(1.4, 0.45, 1.4, cv, x, y0 + 0.62 + H, z); }
  for (let i = 1; i < 5; i++) for (const x of [-W / 2 + 0.6, W / 2 - 0.6]) { const z = -D / 2 + 0.6 + i * (D - 1.2) / 5; K.box(1.3, 0.4, 1.3, cv, x, y0 + 0.2, z); K.cyl(0.5, 0.58, H, cv, x, y0 + 0.4 + H / 2, z, 16); K.box(1.4, 0.45, 1.4, cv, x, y0 + 0.62 + H, z); }
  K.box(W - 4, H, D - 5, st, 0, y0 + H / 2, -1); // cela
  K.box(W + 0.6, 1.4, D + 0.6, cv, 0, y0 + H + 1.5, 0); // entablamento
  for (let k = 0; k < 18; k++) K.box(0.5, 0.5, 0.12, M.rune(), -W / 2 + 0.8 + k * 0.75, y0 + H + 1.5, D / 2 + 0.32); // friso de runas
  gable(K, W + 0.6, D + 0.6, 3.2, M.copper(), 0, y0 + H + 2.2, 0, Math.PI / 2, 0.4);
  K.box(3.0, 4.6, 0.3, M.darkWood(), 0, y0 + 2.3, D / 2 - 3.4); K.box(2.2, 3.6, 0.1, M.ember(), 0, y0 + 1.9, D / 2 - 3.3);
  return K;
}
function dwarfTholos() { // santuário dos Ancestrais: círculo de colunas com cúpula de bronze e uma estátua de antepassado
  const K = new Kit(), cv = M.dwarfCarve();
  for (let k = 0; k < 3; k++) K.cyl(7.5 - k * 0.6, 7.5 - k * 0.6, 0.45, cv, 0, 0.22 + k * 0.45, 0, 40);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; K.cyl(0.42, 0.5, 6, cv, Math.cos(a) * 5.6, 1.35 + 3, Math.sin(a) * 5.6, 14); K.box(1.1, 0.4, 1.1, cv, Math.cos(a) * 5.6, 7.55, Math.sin(a) * 5.6, -a); }
  K.cyl(6.4, 6.4, 1.0, cv, 0, 8.2, 0, 40, 0, 0, 0, true); K.cyl(6.3, 6.3, 0.2, cv, 0, 7.75, 0, 40);
  K.add(new THREE.SphereGeometry(6.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.copper(), 0, 8.6, 0, 0, 0, 0, 1, 0.55, 1);
  const s = dwarfStatue(77); for (const { mat, geos } of s.parts.values()) for (const g of geos) { const c = g.clone(); c.scale(0.36, 0.36, 0.36); c.translate(0, 1.35, 0); K.add(c, mat); }
  return K;
}
function terrace(K, w, d, h, mat, cap) { // plataforma de pedra com talude, cornija e friso
  K.box(w + 0.8, h - 0.4, d + 0.8, mat, 0, (h - 0.4) / 2, 0); K.box(w + 1.4, 0.5, d + 1.4, mat, 0, 0.25, 0); K.box(w + 1.2, 0.4, d + 1.2, cap, 0, h - 0.2, 0); // o topo fica exatamente na altura do piso (h)
  for (let k = 0; k < Math.floor(w / 3); k++) { const xx = -w / 2 + 1.5 + k * 3; K.box(0.07, 0.55, 0.06, M.rune(), xx, h - 0.75, d / 2 + 0.43, 0, 0, (k % 3 - 1) * 0.35); K.box(0.32, 0.06, 0.06, M.rune(), xx + 0.05, h - 0.62 - (k % 2) * 0.18, d / 2 + 0.43); } // runas gravadas (traços finos), não janelas
}
function stairs(K, w, run, rise, mat, steps) { // escadaria (anda em +z para baixo): degraus de pedra com corrimões
  for (let k = 0; k < steps; k++) { const y = rise * (1 - (k + 1) / steps), z = run * (k + 0.5) / steps; K.box(w, rise / steps + y, run / steps + 0.02, mat, 0, (rise / steps + y) / 2, z); }
  for (const sx of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(run, 0); sh.lineTo(0, rise + 0.9); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(sx > 0 ? w / 2 + 0.9 : -w / 2, 0, 0); K.add(g, mat); } // muretas laterais
}
function buildDwarfCity(ctx) {
  const C = DWARF, r = rngOf(707), st = M.dwarfStone(), cv = M.dwarfCarve(), base = gY(C.x, C.z);
  const at = (dx, dz) => [C.x + dx, C.z + dz];
  // ---------- muralha circular com talude, ameias e torres; o portão fica ao sul (estrada) ----------
  const RW = 58, HW = 13, gate = Math.PI / 2;
  { const K = new Kit(), N = 84;
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * Math.PI * 2; let da = Math.abs(((a - gate + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < 0.21) continue; // vão do portão
      const x = Math.cos(a) * RW, z = Math.sin(a) * RW, ry = -a - Math.PI / 2, seg = Math.PI * 2 * RW / N + 0.15, y = gY(C.x + x, C.z + z) - base;
      K.box(seg, HW, 4.2, st, x, y + HW / 2 - 0.5, z, ry); K.box(seg, 3.4, 6.2, st, x + Math.cos(a) * 0.9, y + 1.0, z + Math.sin(a) * 0.9, ry); // muro e talude na base (lado de fora)
      K.box(seg, 0.5, 4.8, cv, x, y + HW - 0.2, z, ry);
      const ox = Math.cos(a) * 1.9, oz = Math.sin(a) * 1.9; if (i % 2 === 0) K.box(seg * 0.55, 1.5, 0.9, cv, x + ox, y + HW + 0.7, z + oz, ry); // ameias
      ctx.colliders.push({ x: C.x + x, z: C.z + z, r: 2.7, name: 'muralha_pedrafunda' });
    }
    for (let t = 0; t < 10; t++) { // torres redondas e atarracadas
      const a = gate + (t + 0.5) / 10 * Math.PI * 2; let da = Math.abs(((a - gate + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < 0.45) continue;
      const x = Math.cos(a) * (RW + 0.5), z = Math.sin(a) * (RW + 0.5), y = gY(C.x + x, C.z + z) - base;
      K.cyl(5.2, 5.8, HW + 6, st, x, y + (HW + 6) / 2 - 0.5, z, 24); K.cyl(5.9, 5.9, 0.7, cv, x, y + HW + 5.6, z, 24);
      for (let m = 0; m < 12; m++) { const b = m / 12 * Math.PI * 2; if (m % 2) K.box(1.6, 1.5, 0.9, cv, x + Math.cos(b) * 5.5, y + HW + 6.6, z + Math.sin(b) * 5.5, -b + Math.PI / 2); }
      for (let m = 0; m < 3; m++) { const b = a + Math.PI + (m - 1) * 0.5; K.box(0.35, 1.6, 0.2, M.glass(), x + Math.cos(b) * 5.3, y + HW + 1 + m * 0.2, z + Math.sin(b) * 5.3, -b + Math.PI / 2); } // seteiras acesas
      ctx.colliders.push({ x: C.x + x, z: C.z + z, r: 6, name: 'torre_pedrafunda' });
    }
    put(ctx, K, 'muralha_pedrafunda', C.x, C.z, 0, { y: base, occ: false });
  }
  // ---------- portão monumental (torres quadradas, arco de aduelas, portas de bronze abertas) ----------
  { const K = new Kit();
    for (const sx of [-1, 1]) { K.box(9, 22, 13, st, sx * 9.5, 11, 0); K.box(10, 1.2, 14, cv, sx * 9.5, 22.4, 0); for (let k = -1; k <= 1; k++) K.box(1.8, 1.6, 1.6, cv, sx * 9.5 + k * 3, 23.8, 6.2); K.box(9.6, 4, 13.6, st, sx * 9.5 + sx * 0.3, 2, 0);
      for (let k = 0; k < 6; k++) { const yy = 10 + k * 0.8; K.box(0.8 - (k % 2) * 0.35, 0.1, 0.08, M.rune(), sx * 9.5, yy, 6.55); K.box(0.1, 0.5, 0.08, M.rune(), sx * 9.5 + (k % 2 ? 0.25 : -0.3), yy + 0.3, 6.55, 0, 0, (k % 3 - 1) * 0.5); }
      // portas de bronze escancaradas, encostadas na passagem
      K.box(0.4, 9.4, 4.6, M.copper(), sx * 4.3, 4.7, -3.6); for (let k = 0; k < 4; k++) K.box(0.5, 0.3, 4.7, M.iron(), sx * 4.25, 1.4 + k * 2.4, -3.6);
    }
    K.box(10.6, 7, 13, st, 0, 18.5, 0); K.box(11.6, 1.2, 14, cv, 0, 22.4, 0); archBlocks(K, 9, 1.4, 13.2, cv, 0, 10, 0, 0, 17);
    for (const sx of [-1, 1]) K.box(1.2, 10, 13.2, cv, sx * 5.1, 5, 0);
    K.add(new THREE.SphereGeometry(1.1, 20, 14), cv, 0, 15.4, 6.7, 0, 0, 0, 1, 1, 0.5); // pedra-chave com cabeça de carneiro
    for (const sx of [-1, 1]) K.add(new THREE.TorusGeometry(0.7, 0.25, 10, 20, Math.PI * 1.3), cv, sx * 0.9, 15.7, 7.1, 0, 0, sx * 1.2);
    const [gx, gz] = at(0, RW); put(ctx, K, 'portao_pedrafunda', gx, gz, 0, { y: base, box: [[-9.5, 0, 4.5, 6.5], [9.5, 0, 4.5, 6.5]] });
    for (const sx of [-1, 1]) { const b = makeBanner('anao', 2.6, 8); b.position.set(gx + sx * 9.5, base + 19, gz + 6.7); ctx.scene.add(b); }
  }
  // ---------- rua principal (lajes) do portão até a ágora, com estátuas de guardiões e braseiros ----------
  { const K = new Kit(); for (let z = 30; z < RW - 4; z += 1.6) for (let x = -3.6; x < 3.6; x += 1.8) K.box(1.74 + r() * 0.05, 0.12, 1.54, cv, x + 0.9 + ((z / 1.6) % 2 ? 0.45 : 0), 0.06, z + 0.8, 0, 0, (r() - 0.5) * 0.02);
    const [x, z] = at(0, 0); put(ctx, K, 'rua_pedrafunda', x, z, 0, { y: base, occ: false }); }
  for (const sx of [-1, 1]) { const s = dwarfStatue(5 + sx); const [x, z] = at(sx * 10.5, 44); put(ctx, s, 'estatua_anao', x, z, sx > 0 ? -Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3, { y: base, box: [[0, 0, 2.3, 2.3]] }); }
  for (const z of [34, 50]) for (const sx of [-1, 1]) { const [x, zz] = at(sx * 5.2, z); brazier(ctx, x, base, zz, z === 50, sx * z); }
  // ---------- ágora: forja de lava no meio, pórtico (estoa) a oeste, ferraria do Brakar a leste ----------
  const AG = { x: 0, z: 16 };
  { const K = new Kit(); K.cyl(4.4, 4.8, 0.9, cv, 0, 0.3, 0, 32); K.cyl(3.6, 3.6, 0.1, M.ember(), 0, 0.72, 0, 32); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.box(0.8, 2.2, 0.8, cv, Math.cos(a) * 4.6, 1.1, Math.sin(a) * 4.6, -a); }
    const [x, z] = at(AG.x, AG.z); const g = put(ctx, K, 'forja_da_praca', x, z, 0, { y: base, box: [[0, 0, 4.8, 4.8]] }); const L = vlight('#ff7a2a', 6, 18, 1.5); L.position.set(0, 2, 0); g.add(L); const f = flame(3.2, 9); f.position.y = 0.7; g.add(f); ctx.roomAnims.push(f); }
  { const K = new Kit(), L = 26, D = 7; // estoa: muro do fundo, colunata e telhado de bronze, com bancos de pedra
    K.box(0.9, 6, L, st, -D / 2, 3, 0); K.box(D + 0.4, 0.4, L + 0.4, cv, 0, 0.2, 0);
    for (let i = 0; i < 10; i++) { const z = -L / 2 + 0.8 + i * (L - 1.6) / 9; K.cyl(0.38, 0.45, 5.4, cv, D / 2 - 0.5, 3.1, z, 14); K.box(1, 0.35, 1, cv, D / 2 - 0.5, 5.9, z); }
    K.box(D + 1, 0.8, L + 1, cv, 0, 6.4, 0); { const sh = new THREE.Shape(); sh.moveTo(-D / 2 - 0.6, 0); sh.lineTo(D / 2 + 0.6, 0); sh.lineTo(-D / 2 - 0.6, 1.8); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: L + 1.2, bevelEnabled: false }); g.translate(0, 6.8, -(L + 1.2) / 2); K.add(g, M.copper()); }
    for (let k = 0; k < 3; k++) K.box(0.8, 0.5, 3.2, cv, -D / 2 + 1.0, 0.65, -8 + k * 8);
    const [x, z] = at(-19, AG.z); put(ctx, K, 'estoa_pedrafunda', x, z, 0, { y: base, box: [[-D / 2, 0, 0.6, L / 2], [D / 2 - 0.5, -L / 2 + 0.8, 0.5, 0.5], [D / 2 - 0.5, L / 2 - 0.8, 0.5, 0.5]] }); }
  const SM = { x: C.x + 21, z: C.z + AG.z, ry: -Math.PI / 2 };
  smithy(ctx, SM.x, SM.z, SM.ry);
  const smw = (lx, lz) => [SM.x + lx * Math.cos(SM.ry) + lz * Math.sin(SM.ry), SM.z - lx * Math.sin(SM.ry) + lz * Math.cos(SM.ry)];
  { const K = new Kit(), wd = M.darkWood(); K.box(5, 0.9, 1.6, wd, 0, 0.45, 0); K.box(5.4, 0.12, 2.0, wd, 0, 0.95, 0); for (const sx of [-2.4, 2.4]) K.box(0.18, 2.6, 0.18, wd, sx, 1.3, -0.8); K.box(5.2, 0.1, 2.2, plain('canvasRed', '#8a2a1e', { rough: 0.9 }), 0, 2.6, -0.2, 0, -0.25);
    for (let k = 0; k < 5; k++) for (const g of axeGeo(1.1, 0.3)) K.add(g, k % 2 ? M.steel() : M.iron(), -2 + k, 1.0, 0.3, 0.3, Math.PI / 2 - 0.15, 0);
    for (let k = 0; k < 3; k++) K.add(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24), M.iron(), -1.5 + k * 1.5, 1.6, -0.75, 0, Math.PI / 2 - 0.2, 0);
    const [x, z] = at(-10.5, AG.z + 9); put(ctx, K, 'banca_de_armas', x, z, Math.PI / 2, { y: base, box: [[0, 0, 2.6, 1]] }); }
  for (const [dx, dz] of [[-8, 4], [8, 4], [-8, 28], [8, 28]]) { const [x, z] = at(dx, dz); brazier(ctx, x, base, z, dx < 0 && dz < 10, dx + dz); }
  // ---------- acrópole: dois terraços, escadarias, templo, santuário e o Salão do Rei ----------
  const T1 = { w: 50, z0: -10, z1: -46, h: 3.2 }, T2 = { w: 34, z0: -27, z1: -49, h: 6.6 };
  { const K = new Kit(); const d1 = T1.z0 - T1.z1, d2 = T2.z0 - T2.z1;
    const k1 = new Kit(); terrace(k1, T1.w, d1, T1.h, st, cv); for (const { mat, geos } of k1.parts.values()) for (const g of geos) K.add(g.clone().translate(0, 0, (T1.z0 + T1.z1) / 2), mat);
    const k2 = new Kit(); terrace(k2, T2.w, d2, T2.h, st, cv); for (const { mat, geos } of k2.parts.values()) for (const g of geos) K.add(g.clone().translate(0, 0, (T2.z0 + T2.z1) / 2), mat);
    const s1 = new Kit(); stairs(s1, 12, 8, T1.h, cv, 10); for (const { mat, geos } of s1.parts.values()) for (const g of geos) K.add(g.clone().translate(0, 0, T1.z0), mat);
    const s2 = new Kit(); stairs(s2, 10, 8, T2.h - T1.h, cv, 10); for (const { mat, geos } of s2.parts.values()) for (const g of geos) K.add(g.clone().translate(0, T1.h, T2.z0), mat);
    const [x, z] = at(0, 0); put(ctx, K, 'acropole_pedrafunda', x, z, 0, { y: base, occ: false });
    // pisos para andar em cima (rampa = escada) e bordas que não deixam cair
    DECKS.unshift({ x: C.x, z: C.z + T2.z0, yaw: 0, w: 10, len: 8, y: base + T2.h, y1: base + T1.h, tag: 'pedrafunda' }, { x: C.x, z: C.z + T1.z0, yaw: 0, w: 12, len: 8, y: base + T1.h, y1: base, tag: 'pedrafunda' },
      { x: C.x, z: C.z + T2.z1, yaw: 0, w: T2.w, len: T2.z0 - T2.z1, y: base + T2.h, tag: 'pedrafunda' }, { x: C.x, z: C.z + T1.z1, yaw: 0, w: T1.w, len: T1.z0 - T1.z1, y: base + T1.h, tag: 'pedrafunda' });
    const edge = (x0, x1, zz) => { const cx = (x0 + x1) / 2, hx = (x1 - x0) / 2; ctx.colliders.push({ x: C.x + cx, z: C.z + zz, r: Math.max(hx, 0.6), box: true, hx, hz: 0.6, rot: 0, name: 'acropole_pedrafunda' }); };
    const side = (xx, z0, z1) => { const cz = (z0 + z1) / 2, hz = Math.abs(z1 - z0) / 2; ctx.colliders.push({ x: C.x + xx, z: C.z + cz, r: Math.max(hz, 0.6), box: true, hx: 0.6, hz, rot: 0, name: 'acropole_pedrafunda' }); };
    edge(-T1.w / 2, -6.4, T1.z0); edge(6.4, T1.w / 2, T1.z0); side(-T1.w / 2, T1.z0, T1.z1); side(T1.w / 2, T1.z0, T1.z1); edge(-T1.w / 2, T1.w / 2, T1.z1);
    edge(-T2.w / 2, -5.4, T2.z0); edge(5.4, T2.w / 2, T2.z0); side(-T2.w / 2, T2.z0, T2.z1); side(T2.w / 2, T2.z0, T2.z1);
    for (const sx of [-1, 1]) { side(sx * 6.4, T1.z0, T1.z0 + 8); side(sx * 5.4, T2.z0, T2.z0 + 8); } // corrimãos das escadas
  }
  { const [x, z] = at(15.5, -18); put(ctx, dwarfTemple(), 'templo_da_forja', x, z, 0, { y: base + T1.h, box: [[0, 0, 7.6, 7.6]] }); const L = vlight('#ff8a3a', 3, 10, 1.6); L.position.set(x, base + T1.h + 3, z + 5); ctx.scene.add(L); }
  { const [x, z] = at(-15.5, -19); put(ctx, dwarfTholos(), 'santuario_ancestrais', x, z, 0, { y: base + T1.h }); for (let i = 0; i < 12; i++) { if (i === 3) continue; const a = i / 12 * Math.PI * 2; ctx.colliders.push({ x: x + Math.cos(a) * 5.6, z: z + Math.sin(a) * 5.6, r: 0.6 }); } ctx.colliders.push({ x, z, r: 1.6 }); }
  // Salão do Rei-Sob-a-Pedra no terraço de cima (fachada de colunas e frontão)
  { const K = new Kit();
    K.box(30, 3, 10, st, 0, 1.5, 0); for (let k = 0; k < 5; k++) K.box(26 - k * 1.6, 0.5, 2, cv, 0, 0.25 + k * 0.5, 6 - k * 0.6);
    for (let k = 0; k < 6; k++) { const x = -11 + k * 4.4; K.box(2.2, 1.0, 2.2, cv, x, 3.5, 2); K.cyl(0.85, 0.95, 12, cv, x, 10, 2, 16); K.box(2.4, 1.1, 2.4, cv, x, 16.6, 2); }
    K.box(28, 2.2, 4, cv, 0, 18.3, 2); { const sh = new THREE.Shape(); sh.moveTo(-14, 0); sh.lineTo(14, 0); sh.lineTo(0, 6); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }); g.translate(0, 19.4, 0.5); K.add(g, st); }
    K.box(26, 20, 10, st, 0, 10, -5); K.box(7, 9, 0.6, M.darkWood(), 0, 7.5, -0.1); archBlocks(K, 7, 1.0, 1.2, cv, 0, 12, 0, 0, 11);
    for (let k = 0; k < 7; k++) K.box(0.35, 0.35, 0.1, M.rune(), -3 + k, 10.2, 0.25);
    for (let k = 0; k < 11; k++) K.box(0.12, 0.8, 0.1, M.rune(), -3 + k * 0.6, 21.8, 3.55, 0, 0, (k % 3 - 1) * 0.4);
    gable(K, 26, 10, 4, M.copper(), 0, 20, -5, 0, 0.4);
    const [x, z] = at(0, -38.5); put(ctx, K, 'salao_anao', x, z, 0, { y: base + T2.h - 0.2, box: [[0, -4, 13.5, 5.5]] });
    for (const sx of [-1, 1]) { const b = makeBanner('anao', 2.4, 8); b.position.set(x + sx * 6.6, base + T2.h + 15.5, z + 3.6); ctx.scene.add(b); }
    for (const sx of [-1, 1]) brazier(ctx, x + sx * 9, base + T2.h, z + 9, sx > 0, sx * 7);
  }
  // ---------- cidade baixa: casas de pedra em anéis, de frente para a ágora; a taverna "Bigorna Bêbada" a leste ----------
  const HOUSES = [[355, 34], [10, 34], [350, 47], [5, 47], [20, 48], [58, 37], [70, 48], [50, 49], [114, 38], [124, 49], [107, 49], [170, 34], [185, 34], [160, 47], [175, 47], [190, 48], [200, 36]];
  const houseAt = {};
  HOUSES.forEach(([deg, rr], i) => { const a = deg * Math.PI / 180, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr, ry = Math.atan2(C.x + AG.x - x, C.z + AG.z - z), w = 7 + r() * 2, d = 6 + r() * 1.5, { K, box } = dwarfHouse(40 + i, w, d); put(ctx, K, i === 1 ? 'taverna_anao' : 'casa_anao', x, z, ry, { y: base, box }); houseAt[deg + '|' + rr] = { x, z, ry, d }; });
  // taverna: mesas e bancos do lado de fora, barris encostados
  const tav = houseAt['10|34'], front = (h, k, side = 0) => [h.x + Math.sin(h.ry) * (h.d / 2 + k) + Math.cos(h.ry) * side, h.z + Math.cos(h.ry) * (h.d / 2 + k) - Math.sin(h.ry) * side];
  { const K = new Kit(), wd = M.darkWood(); for (const side of [-2.8, 2.8]) { K.box(2.2, 0.12, 1.0, wd, side, 0.85, 3.2); for (const sx of [-0.9, 0.9]) K.box(0.12, 0.85, 0.12, wd, side + sx, 0.42, 3.2); for (const bz of [2.4, 4.0]) K.box(2.0, 0.1, 0.4, wd, side, 0.48, bz); } K.add(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 14), plain('mugWood', '#7a5230', { rough: 0.7 }), -2.4, 1.03, 3.2);
    put(ctx, K, 'mesas_da_taverna', tav.x + Math.sin(tav.ry) * (tav.d / 2), tav.z + Math.cos(tav.ry) * (tav.d / 2), tav.ry, { y: base, box: [[-2.8, 3.2, 1.2, 0.6], [2.8, 3.2, 1.2, 0.6]], occ: false }); }
  for (const s of [-4.6, 4.6]) { const [x, z] = front(tav, 0.6, s); ctx.place('barrel', x, z, { rf: 0.6 }); }
  // carroça de minério e pilha de pedra-fagulha para a mineira (cidade baixa, noroeste)
  const MINE = at(-31, -30);
  { const K = new Kit(), wd = M.darkWood(); K.box(2.4, 0.9, 1.4, wd, 0, 0.9, 0); for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) K.add(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 18), M.iron(), sx * 0.85, 0.42, sz, 0, 0, Math.PI / 2);
    for (let k = 0; k < 14; k++) K.add(new THREE.DodecahedronGeometry(0.22 + r() * 0.12, 0), k % 4 ? M.dwarfStone() : M.ember(), (r() - 0.5) * 1.8, 1.45 + r() * 0.3, (r() - 0.5) * 1.0, r() * 3);
    for (let k = 0; k < 22; k++) K.add(new THREE.DodecahedronGeometry(0.3 + r() * 0.25, 0), k % 5 ? M.dwarfStone() : M.ember(), 2.6 + (r() - 0.5) * 2.4, 0.2 + r() * 0.5, (r() - 0.5) * 2.2, r() * 3);
    put(ctx, K, 'carroca_de_minerio', MINE[0], MINE[1], 0.4, { y: base, box: [[0, 0, 1.3, 0.8], [2.6, 0, 1.3, 1.2]] }); }
  // NPCs: anões em lugares que fazem sentido (de costas para paredes, perto do que fazem, nunca olhando o nada)
  const npcList = [];
  const W = (n, x, z, yaw, y) => { const npc = ctx.worldNpc(n, x, z, yaw); if (npc && y !== undefined) { npc.obj.position.y = y; } npcList.push(npc); return npc; };
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const brakar = { id: 'brakar', name: 'Mestre Brakar', title: 'Refinador de Pedrafunda', model: 'Barbarian', show: ['1H_Axe'], refine: true, look: { race: 'anao', face: 'valente', hair: { style: 'careca', color: 'ruivo' }, beard: true },
    hello: 'Hmpf! Mais um que quer ver o aço cantar. Traga a arma ou a armadura, o minério e o zeny, e eu esquento a forja.' };
  { const [x, z] = smw(1.5, -1.3); W(brakar, x, z, SM.ry); } // ao lado da bigorna, de frente para a ágora
  { const [x, z] = smw(-3.6, -0.9); W({ id: 'nim', name: 'Nim', title: 'Aprendiz de Ferreiro', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', face: 'alegre', hair: { style: 'raspado', color: 'castanho' } },
    lines: 'O Mestre Brakar diz que eu ainda não sei segurar o martelo. Mas já sei atiçar a forja!' }, x, z, SM.ry + Math.PI); } // atiçando a forja
  { const [gx, gz] = at(0, RW); W({ id: 'thorga', name: 'Thorga', title: 'Guardiã do Portão', model: 'Knight', show: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'], hat: true, look: { race: 'anao', sex: 'f', face: 'valente', hair: { style: 'coque', color: 'ruivo' } },
    lines: 'Alto lá! Ah, é só um viajante. Bem-vindo a Pedrafunda, a cidade sob os picos.\nAqui todo anão nasce com um machado na mão. Se quer equipamento de verdade, fale com o Mestre Brakar na ferraria da ágora.' }, gx + 6.4, gz + 7.6, 0);
    W({ id: 'torvald', name: 'Torvald', title: 'Veterano da Guarda', model: 'Knight', show: ['2H_Axe', 'Knight_Helmet'], hat: true, look: { race: 'anao', face: 'valente', hair: { style: 'curto', color: 'grisalho' }, beard: true },
      lines: 'Quarenta invernos de guarda nesse portão. Já vi troll, dragão de gelo e até humano educado.' }, gx - 6.4, gz + 7.6, 0); } // de costas para as torres do portão, olhando a estrada
  { const [x, z] = at(6.6, RW - 7.4); W({ id: 'grum', name: 'Grum', title: 'Soldado de Pedrafunda', model: 'Knight', show: ['1H_Sword', 'Rectangle_Shield', 'Knight_Helmet'], hat: true, look: { race: 'anao', face: 'valente', hair: { style: 'raspado', color: 'preto' }, beard: true },
    lines: 'Três turnos de guarda e ainda nenhum troll. Que tédio.' }, x, z, Math.PI); } // de costas para o portão, vigiando a rua
  { const [x, z] = at(-10.5, AG.z + 7.4); W({ id: 'bofur', name: 'Bárdin', title: 'Mercador de Machados', model: 'Barbarian', show: ['2H_Axe', 'Barbarian_Cape'], shopList: 'geral', shopTitle: '🪓 Machados de Pedrafunda', look: { race: 'anao', face: 'alegre', hair: { style: 'curto', color: 'castanho_escuro' }, beard: true },
    hello: 'Machado bom é machado anão! Olhe à vontade, mas cuidado com o fio.' }, x - 1.6, z + 1.6, Math.PI / 2); } // atrás da banca
  { const [x, z] = at(-21.6, AG.z - 6); W({ id: 'korvin', name: 'Korvin', title: 'Joalheiro das Profundezas', model: 'Barbarian', look: { race: 'anao', face: 'astuto', hair: { style: 'longo', color: 'preto' }, beard: true },
    lines: 'Rubis do coração da montanha, lapidados à luz da forja. Quer ver? Olhe, mas não toque.' }, x, z, Math.PI / 2); } // sob a estoa, de costas para o muro
  { const [x, z] = at(-21.6, AG.z + 2); W({ id: 'brunna', name: 'Brunna', title: 'Mestre-Cervejeira', model: 'Barbarian', show: ['Mug'], look: { race: 'anao', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'ruivo' } },
    lines: 'A cevada vem das colinas, o cogumelo vem das cavernas e o segredo vem da minha avó.' }, x, z, Math.PI / 2); }
  { const [x, z] = front(tav, 1.0, 0); W({ id: 'helga', name: 'Helga', title: 'Taverneira da Bigorna Bêbada', model: 'Barbarian', show: ['Mug'], look: { race: 'anao', sex: 'f', face: 'alegre', hair: { style: 'longo', color: 'loiro' } },
    lines: 'Cerveja de cogumelo das cavernas, a melhor do mundo! Quem diz o contrário nunca provou.\nO Brakar? Já quebrou mais espada do que consertou — mas as que aguentam ficam lendárias.' }, x, z, tav.ry); } // na porta da taverna
  { W({ id: 'oldra', name: 'Oldra', title: 'Mineira', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', sex: 'f', face: 'astuto', hair: { style: 'curto', color: 'castanho' } },
    lines: 'O minério que o Brakar usa sai das galerias lá do fundo. Brilha no escuro, sabia? A gente chama de "pedra-fagulha".' }, MINE[0] + 1.2, MINE[1] + 2.4, face(MINE[0] + 1.2, MINE[1] + 2.4, MINE[0] + 1.2, MINE[1])); } // ao lado da carroça
  { const [x, z] = at(0, -30.6); W({ id: 'durgan', name: 'Rei Dúrgan', title: 'Senhor de Pedrafunda', model: 'Knight', show: ['2H_Sword', 'Knight_Cape'], look: { race: 'anao', face: 'sereno', hair: { style: 'longo', color: 'grisalho' }, beard: true },
    lines: 'Meu povo cava a montanha há mil invernos. Os picos à nossa volta são os mais altos de Aethra: nada passa por eles sem a nossa permissão.\nDizem que lá no sul, nos Campos de Valcinza, os humanos ergueram um castelo enorme... Pedra mole, pedra de planície.' }, x, z, 0, base + T2.h); } // diante da escadaria do Salão, de costas para ele
  for (const sx of [-1, 1]) { const [x, z] = at(sx * 4.4, -31.4); W({ id: 'guarda_rei_' + (sx > 0 ? 'l' : 'o'), name: 'Guarda Real', title: 'Escudo do Rei', model: 'Knight', show: ['2H_Axe', 'Knight_Helmet'], hat: true, look: { race: 'anao', face: 'valente', hair: { style: 'curto', color: sx > 0 ? 'preto' : 'ruivo' }, beard: true },
    lines: 'Nenhum passo além sem a palavra do Rei.' }, x, z, 0, base + T2.h); }
  { const [x, z] = at(-15.5, -16); W({ id: 'gudrun', name: 'Gudrun', title: 'Anciã do Clã', model: 'Mage', look: { race: 'anao', sex: 'f', face: 'sabio', hair: { style: 'longo', color: 'branco' } },
    lines: 'Nossos avós ergueram estes muros quando o mundo ainda era jovem. Cada runa no santuário conta uma história.' }, x, z, 0, base + T1.h + 1.35); } // diante da estátua do ancestral
  { const [x, z] = at(15.5, -11.4); W({ id: 'sacerdote_forja', name: 'Irmão Hulda', title: 'Sacerdote da Forja', model: 'Mage', look: { race: 'anao', face: 'sereno', hair: { style: 'careca', color: 'grisalho' }, beard: true },
    lines: 'No templo guardamos a primeira brasa, acesa pelo Pai-Martelo. Enquanto ela queimar, Pedrafunda não cai.' }, x, z, 0, base + T1.h + 1.35); } // na escadaria do templo, de costas para a porta
  { const [x, z] = at(4.8, AG.z + 4.8); W({ id: 'lian_vis', name: 'Lian', title: 'Viajante humano', model: 'Rogue', look: { race: 'humano', face: 'gentil', hair: { style: 'curto', color: 'castanho' } },
    lines: 'Subi a estrada da Geada só para ver as forjas. Valeu cada passo — e cada calo.' }, x, z, face(x, z, C.x + AG.x, C.z + AG.z)); } // admirando a forja de lava
  // quadro do refino: parede do fundo do galpão (por dentro), virada para a ágora
  const cs = Math.cos(SM.ry), sn = Math.sin(SM.ry), lx = 4.2, lz = -3.84;
  return { refineBoard: { x: SM.x + lx * cs + lz * sn, y: gY(SM.x, SM.z) + 2.4, z: SM.z - lx * sn + lz * cs, yaw: SM.ry, w: 3.3, h: 2.3 } };
}

/* =========================== AELINDRA (elfos) =========================== */
// árvore anciã: tronco com raízes que abraçam o chão e copa enorme de folhagem em camadas
function ancientTree(seed, H = 36) {
  const K = new Kit(), r = rngOf(seed), bark = M.bark();
  const prof = []; for (let k = 0; k <= 16; k++) { const t = k / 16; prof.push(new THREE.Vector2(2.2 * (1 - t * 0.55) + Math.pow(1 - t, 8) * 3.2, t * H)); }
  const trunk = new THREE.LatheGeometry(prof, 28); { const P = trunk.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 5 + y * 0.12) * 0.08 + Math.sin(a * 11 + y * 0.3) * 0.03; P.setXYZ(i, x * k + Math.sin(y * 0.08) * 0.6, y, z * k); } trunk.computeVertexNormals(); }
  K.add(trunk, bark);
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + r(); const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 1.5, 2.6, Math.sin(a) * 1.5), new THREE.Vector3(Math.cos(a) * 3.6, 0.9, Math.sin(a) * 3.6), new THREE.Vector3(Math.cos(a) * 5.8, -0.3, Math.sin(a) * 5.8)]), 12, 0.55 - r() * 0.15, 10); K.add(c, bark); } // raízes
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + r() * 0.5, y0 = H * (0.55 + r() * 0.3); const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 1, y0, Math.sin(a) * 1), new THREE.Vector3(Math.cos(a) * 5, y0 + 3, Math.sin(a) * 5), new THREE.Vector3(Math.cos(a) * 9, y0 + 4 + r() * 3, Math.sin(a) * 9)]), 12, 0.5, 8); K.add(c, bark); } // galhos
  // copa: blobs de folhagem com cor por vértice (luz por cima, sombra por baixo)
  const leafC = [new THREE.Color('#2f6a2c'), new THREE.Color('#4f8f3a'), new THREE.Color('#7fb04a')];
  for (let k = 0; k < 13; k++) {
    const a = r() * Math.PI * 2, rr = r() * 9, y = H * 0.72 + r() * H * 0.32, s = 5 + r() * 4;
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 4)), P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(); // vértices unidos: folhagem lisa, sem facetas
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), yy = P.getY(i), z = P.getZ(i), n = 1 + Math.sin(x * 4 + k) * 0.12 + Math.sin(z * 5 + yy * 3) * 0.1; P.setXYZ(i, x * n, yy * n * 0.7, z * n); c.copy(leafC[0]).lerp(leafC[1], (yy + 1) / 2).lerp(leafC[2], Math.max(0, yy) * 0.5 * (0.6 + r() * 0.4)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); /* auditoria: as bolotas lisas saíram; a copa agora é de folhas de verdade (main3d põe a folhagem nova por cima do tronco) */
  }
  return K;
}
// plataforma de madeira em volta de um tronco, com guarda-corpo curvo e escada em espiral
function treeDeck(K, R, y, r0) {
  const wd = M.elfWood();
  K.add(new THREE.RingGeometry(r0, R, 40, 1).rotateX(-Math.PI / 2), wd, 0, y + 0.01, 0); K.add(new THREE.CylinderGeometry(R, R, 0.3, 40, 1, true), wd, 0, y - 0.15, 0);
  K.add(new THREE.RingGeometry(r0, R, 40, 1).rotateX(Math.PI / 2), wd, 0, y - 0.3, 0);
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; K.cyl(0.05, 0.05, 1.0, M.silver(), Math.cos(a) * (R - 0.15), y + 0.5, Math.sin(a) * (R - 0.15), 8); }
  K.add(new THREE.TorusGeometry(R - 0.15, 0.06, 8, 64), M.elfWood(), 0, y + 1.0, 0, 0, Math.PI / 2);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * r0, y - 3, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * (R * 0.7), y - 1.2, Math.sin(a) * (R * 0.7)), new THREE.Vector3(Math.cos(a) * (R - 0.3), y - 0.3, Math.sin(a) * (R - 0.3))]), 10, 0.14, 8); K.add(c, wd); } // mãos-francesas curvas
}
function spiralStair(K, rIn, y0, y1, turns = 1.2) {
  const n = Math.round((y1 - y0) / 0.32), wd = M.elfWood();
  for (let k = 0; k < n; k++) { const t = k / n, a = t * turns * Math.PI * 2, y = y0 + t * (y1 - y0); K.box(1.5, 0.12, 0.6, wd, Math.cos(a) * (rIn + 0.8), y, Math.sin(a) * (rIn + 0.8), -a); if (k % 3 === 0) K.cyl(0.03, 0.03, 1.0, M.silver(), Math.cos(a) * (rIn + 1.5), y + 0.5, Math.sin(a) * (rIn + 1.5), 6); }
}
// pavilhão élfico: piso redondo de mármore, colunas finas, teto em forma de folha/gota com ponta e friso dourado
function elfPavilion(seed, R = 4, H = 5) {
  const K = new Kit(), mb = M.marble();
  K.cyl(R + 0.6, R + 0.9, 0.7, mb, 0, 0.1, 0, 36); K.cyl(R + 0.2, R + 0.4, 0.3, mb, 0, 0.6, 0, 36);
  const n = 8; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R; K.cyl(0.22, 0.28, H, mb, x, 0.75 + H / 2, z, 14); K.add(new THREE.TorusGeometry(0.3, 0.07, 8, 16), M.gold(), x, 0.75 + H, z, 0, Math.PI / 2); }
  const prof = []; for (let k = 0; k <= 30; k++) { const t = k / 30; prof.push(new THREE.Vector2((R + 1.2) * (1 - Math.pow(t, 0.6)) + 0.06, t * H * 0.95 + Math.pow(1 - t, 6) * 0.7)); }
  K.add(new THREE.LatheGeometry(prof, 48), M.leafRoof(), 0, 0.75 + H, 0); K.add(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * 0.99, v.y - 0.06)).reverse(), 48), M.elfWood(), 0, 0.75 + H, 0);
  K.add(new THREE.TorusGeometry(R + 0.85, 0.09, 8, 48), M.gold(), 0, 0.85 + H, 0, 0, Math.PI / 2);
  K.add(new THREE.ConeGeometry(0.12, 2.2, 12), M.gold(), 0, 0.75 + H * 1.85, 0); K.add(new THREE.SphereGeometry(0.25, 16, 12), M.moonGlow(), 0, 0.75 + H * 1.85 + 1.2, 0);
  return K;
}
// casa élfica: torre redonda de pedra branca, janelas em ogiva com luz, teto alto em folha e uma varanda curva
function elfHouse(seed) {
  const K = new Kit(), r = rngOf(seed), mb = M.marble(), R = 3.2 + r() * 0.8, H = 6 + r() * 3;
  K.cyl(R + 0.4, R + 0.6, 0.8, mb, 0, 0.0, 0, 32); K.cyl(R, R * 1.05, H, mb, 0, 0.4 + H / 2, 0, 32);
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; for (const yy of [2.2, 5.2]) { if (yy > H - 0.5) continue; const sh = new THREE.Shape(); sh.moveTo(-0.45, 0); sh.lineTo(0.45, 0); sh.lineTo(0.45, 1.0); sh.quadraticCurveTo(0.45, 1.5, 0, 1.75); sh.quadraticCurveTo(-0.45, 1.5, -0.45, 1.0); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); K.add(g, M.moonGlow(), Math.cos(a) * (R + 0.02), yy, Math.sin(a) * (R + 0.02), -a + Math.PI / 2); } }
  { const sh = new THREE.Shape(); sh.moveTo(-0.8, 0); sh.lineTo(0.8, 0); sh.lineTo(0.8, 1.8); sh.quadraticCurveTo(0.8, 2.6, 0, 3.0); sh.quadraticCurveTo(-0.8, 2.6, -0.8, 1.8); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), M.elfWood(), 0, 0.4, R + 0.02); } // porta em ogiva
  K.add(new THREE.TorusGeometry(R + 0.05, 0.08, 8, 48), M.gold(), 0, 0.4 + H, 0, 0, Math.PI / 2);
  // teto em folha: beiral que se curva para fora e para cima, corpo côncavo e ponta fina (como um broto se abrindo)
  const prof = [], RH = H * 1.05; for (let k = 0; k <= 30; k++) { const t = k / 30, rr = (R + 1.6) * (1 - Math.pow(t, 0.55)) + 0.08, lift = Math.pow(1 - t, 6) * 0.9; prof.push(new THREE.Vector2(rr, t * RH + lift - 0.6 * Math.pow(Math.max(0, 0.12 - t) / 0.12, 2))); }
  K.add(new THREE.LatheGeometry(prof, 48), M.leafRoof(), 0, 0.4 + H, 0); K.add(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * 0.99, v.y - 0.06)).reverse(), 48), M.elfWood(), 0, 0.4 + H, 0);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(prof.filter((_, i) => i % 3 === 0).map(v => new THREE.Vector3(Math.cos(a) * (v.x + 0.03), v.y, Math.sin(a) * (v.x + 0.03)))), 24, 0.05, 6); K.add(c, M.gold(), 0, 0.4 + H, 0); } // nervuras douradas
  K.add(new THREE.ConeGeometry(0.08, 2.4, 10), M.gold(), 0, 0.4 + H + RH + 1.0, 0); K.add(new THREE.SphereGeometry(0.16, 12, 10), M.moonGlow(), 0, 0.4 + H + RH + 0.2, 0);
  // varanda curva
  K.add(new THREE.CylinderGeometry(R + 1.3, R + 1.3, 0.25, 36, 1, false, 0, Math.PI * 0.7), M.elfWood(), 0, 0.4 + H * 0.62, 0, 0.6);
  K.add(new THREE.TorusGeometry(R + 1.25, 0.05, 8, 36, Math.PI * 0.7), M.silver(), 0, 0.4 + H * 0.62 + 0.9, 0, 0.6 + Math.PI / 2, Math.PI / 2);
  return { K, box: [[0, 0, R + 0.5, R + 0.5]] };
}
// lanterna élfica: haste curva de prata com uma esfera de luz pendurada
function elfLantern(K, x, y, z, ry) {
  const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(0.3, 3.2, 0), new THREE.Vector3(0.9, 3.3, 0)]), 16, 0.05, 8);
  K.add(c, M.silver(), x, y, z, ry); K.add(new THREE.SphereGeometry(0.2, 16, 12), M.moonGlow(), x + Math.cos(ry) * 0.9, y + 2.95, z - Math.sin(ry) * 0.9);
  K.add(new THREE.ConeGeometry(0.24, 0.25, 16, 1, true), M.silver(), x + Math.cos(ry) * 0.9, y + 3.2, z - Math.sin(ry) * 0.9);
}
function buildElfCity(ctx) {
  const C = ELF, r = rngOf(909);
  // árvores anciãs em volta da clareira, duas com plataformas ligadas por uma ponte
  const trees = [[-30, -18, 37], [26, -26, 40], [36, 14, 33], [-34, 20, 35], [-6, -40, 42]];
  trees.forEach(([dx, dz, H], i) => {
    const K = ancientTree(100 + i, H);
    if (i < 2) { treeDeck(K, 6.2, 12, 2.0); spiralStair(K, 2.3, 0.2, 12, 1.4); treeDeck(K, 4.6, 21, 1.7); }
    put(ctx, K, 'arvore_ancia', C.x + dx, C.z + dz, r() * 6, { box: [[0, 0, 2.6, 2.6]] });
  });
  { // ponte suspensa curva entre as duas plataformas (12 m de altura)
    const K = new Kit(), a = trees[0], b = trees[1], ax = a[0], az = a[1], bx = b[0], bz = b[1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const n = Math.floor((len - 12) / 0.5); for (let k = 0; k <= n; k++) { const t = k / n, s = 6 + t * (len - 12), sag = Math.sin(t * Math.PI) * 1.2; K.box(1.8, 0.12, 0.42, M.elfWood(), Math.sin(ry) * s, 12 - sag, Math.cos(ry) * s, ry); if (k % 2 === 0) for (const sd of [-1, 1]) K.cyl(0.03, 0.03, 1.0, M.silver(), Math.sin(ry) * s + Math.cos(ry) * sd * 0.85, 12.5 - sag, Math.cos(ry) * s - Math.sin(ry) * sd * 0.85, 6); }
    for (const sd of [-1, 1]) { const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, s = 6 + t * (len - 12); pts.push(new THREE.Vector3(Math.sin(ry) * s + Math.cos(ry) * sd * 0.85, 13 - Math.sin(t * Math.PI) * 1.2, Math.cos(ry) * s - Math.sin(ry) * sd * 0.85)); } K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 6), M.rope()); }
    put(ctx, K, 'ponte_elfica', C.x + ax, C.z + az, 0, { y: gY(C.x + ax, C.z + az), occ: false });
  }
  // casas e pavilhões em volta da Fonte da Lua
  const houses = [[210, 24], [250, 27], [300, 25], [340, 26], [20, 26], [160, 25]];
  houses.forEach(([deg, rr], i) => { const a = deg * Math.PI / 180, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr, { K, box } = elfHouse(60 + i); put(ctx, K, 'casa_elfica', x, z, Math.atan2(C.x - x, C.z - z), { box }); });
  for (const [dx, dz, R] of [[-14, 6, 3.6], [14, -8, 4.2]]) put(ctx, elfPavilion(7, R, 4.6), 'pavilhao_elfico', C.x + dx, C.z + dz, 0, { box: [[0, 0, R * 0.3, R * 0.3]] });
  // Fonte da Lua: bacia de mármore, água luminosa e um cristal que gira devagar
  { const K = new Kit(), mb = M.marble(); K.add(new THREE.LatheGeometry([[0.01, 0], [5.2, 0], [5.4, 0.7], [5.0, 0.9], [4.8, 0.4], [0.01, 0.4]].map(([a, b]) => new THREE.Vector2(a, b)), 48), mb);
    K.cyl(4.8, 4.8, 0.05, plain('moonWater', '#7fd8ff', { emissive: '#4ab8ff', ei: 0.7, rough: 0.05, transparent: true, opacity: 0.85 }), 0, 0.66, 0, 48);
    K.add(new THREE.LatheGeometry([[0.01, 0], [1.1, 0], [0.5, 0.5], [0.35, 2.4], [0.9, 2.8], [0.01, 2.9]].map(([a, b]) => new THREE.Vector2(a, b)), 24), mb);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.785; elfLantern(K, Math.cos(a) * 7, 0, Math.sin(a) * 7, -a); }
    const g = put(ctx, K, 'fonte_da_lua', C.x, C.z, 0, { box: [[0, 0, 5.2, 5.2]] });
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), plain('crystal', '#d8f4ff', { emissive: '#8fd8ff', ei: 1.6, rough: 0.1, transparent: true, opacity: 0.9 })); cr.scale.y = 1.8; cr.position.y = 4.4; g.add(cr);
    cr.userData.update = t => { cr.rotation.y = t * 0.4; cr.position.y = 4.4 + Math.sin(t * 1.2) * 0.25; }; ctx.roomAnims.push(cr);
    const L = vlight('#9fd8ff', 5, 18, 1.5); L.position.set(0, 3, 0); g.add(L); }
  // portal de entrada: dois troncos brancos que se curvam formando uma folha, na estrada (sul)
  { const K = new Kit(); for (const sx of [-1, 1]) { const c = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 4.5, 0, 0), new THREE.Vector3(sx * 4.8, 5, 0), new THREE.Vector3(sx * 3.2, 9.5, 0), new THREE.Vector3(0, 11.5, 0)]), 24, 0.45, 12); K.add(c, M.marble()); }
    K.add(new THREE.SphereGeometry(0.32, 20, 14), M.moonGlow(), 0, 11.4, 0); for (const sx of [-1, 1]) elfLantern(K, sx * 6.5, 0, 0, sx > 0 ? Math.PI : 0);
    put(ctx, K, 'portal_elfico', C.x, C.z + 42, 0, { box: [[-4.6, 0, 0.6, 0.6], [4.6, 0, 0.6, 0.6]] }); }
  // lanternas pela clareira e árvores comuns (bosque em volta)
  { const K = new Kit(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.2, rr = 15 + (k % 2) * 4; elfLantern(K, Math.cos(a) * rr, gY(C.x + Math.cos(a) * rr, C.z + Math.sin(a) * rr) - gY(C.x, C.z), Math.sin(a) * rr, -a); } put(ctx, K, 'lanterna_elfica', C.x, C.z, 0, { occ: false }); }
  for (const [dx, dz] of [[10, 12], [-12, -14]]) { const L = vlight('#bfe6ff', 3, 14, 1.6); L.position.set(C.x + dx, gY(C.x + dx, C.z + dz) + 3, C.z + dz); ctx.scene.add(L); }
  for (let k = 0; k < 46; k++) { const a = r() * Math.PI * 2, rr = 46 + r() * 30, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr; if (Math.abs(x - C.x) < 8 && z > C.z) continue; if (Math.hypot(heightAt(x + 1.2, z) - heightAt(x - 1.2, z), heightAt(x, z + 1.2) - heightAt(x, z - 1.2)) / 2.4 > 0.84) continue; /* P-003: nada de árvore na parede íngreme (> 40°) da bacia */ ctx.place((r() < 0.6 ? 'oakdark_' : 'pinedark_') + Math.floor(r() * 3), x, z, { scale: 1.1 + r() * 0.6 }); }
  for (const sx of [-1, 1]) { const b = makeBanner('elfo', 1.2, 3.4); b.position.set(C.x + sx * 6.5, gY(C.x, C.z + 42) + 6.5, C.z + 42.4); ctx.scene.add(b); }
  // NPCs: elfos (quase todos)
  const W = (n, dx, dz, yaw) => ctx.worldNpc(n, C.x + dx, C.z + dz, yaw);
  const npcs = [
    [{ id: 'aerin', name: 'Aerin', title: 'Sentinela de Aelindra', model: 'Rogue_Hooded', show: ['2H_Crossbow', 'Rogue_Cape'], look: { race: 'elfo', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
      lines: 'Passos pesados de humano... Seja bem-vindo a Aelindra, viajante, mas pise de leve: estas árvores já eram velhas quando o primeiro rei humano nasceu.' }, 3, 38, Math.PI],
    [{ id: 'lyssandra', name: 'Lyssandra', title: 'Guardiã da Fonte da Lua', model: 'Mage', show: ['2H_Staff', 'Mage_Cape'], heals: true, look: { race: 'elfo', sex: 'f', face: 'gentil', hair: { style: 'longo', color: 'loiro' } } }, 0, 7.5, Math.PI],
    [{ id: 'thalion', name: 'Thalion', title: 'Ancião de Aelindra', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], look: { race: 'elfo', face: 'sereno', hair: { style: 'longo', color: 'branco' } },
      lines: 'A Fonte da Lua guarda a memória da floresta. Quando a lua cheia toca a água, ela canta — poucos humanos já ouviram.\nAo sul, depois de Pedraclara e das colinas, o mar beija a terra no Porto das Gaivotas.' }, -14, 3, Math.PI / 2],
    [{ id: 'faelar', name: 'Faëlar', title: 'Mercador de Arcos', model: 'Rogue', show: ['1H_Crossbow', 'Rogue_Cape'], shopList: 'geral', shopTitle: '🏹 Arcos de Aelindra', look: { race: 'elfo', face: 'astuto', hair: { style: 'coque', color: 'castanho' } },
      hello: 'Madeira de árvore-mãe, corda de seda de aranha-da-lua. Nada atira mais longe.' }, 13, -4, -Math.PI / 2],
    [{ id: 'nimriel', name: 'Nimriel', title: 'Tecelã', model: 'Mage', show: ['Mage_Cape'], look: { race: 'elfo', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'ruivo' } },
      lines: 'Os estandartes da cidade são tecidos com fios de folha prateada. Dizem que mudam de cor no outono.' }, -20, -10, 0.5],
    [{ id: 'eldin', name: 'Eldin', title: 'Aprendiz de Druida', model: 'Rogue_Hooded', show: ['1H_Wand'], look: { race: 'elfo', face: 'gentil', hair: { style: 'curto', color: 'loiro' } },
      lines: 'Suba a escada em volta da árvore-mãe! Lá de cima dá para ver o mar ao sul, num dia limpo.' }, -22, -16, 1.4],
    [{ id: 'borin_vis', name: 'Borin', title: 'Anão perdido', model: 'Barbarian', look: { race: 'anao', face: 'astuto', hair: { style: 'careca', color: 'ruivo' }, beard: true },
      lines: 'Árvores, árvores e mais árvores. Onde é que se arranja uma cerveja decente por aqui?!' }, 18, 16, -2.3],
  ];
  for (const [n, dx, dz, yaw] of npcs) W(n, dx, dz, yaw);
}

/* =========================== PORTO DAS GAIVOTAS ===========================
   O porto (cais, navio, docas, farol, casas, mercado e bairro dos mercadores) fica em js3d/port3d.js (rodada 15).
   Aqui ficam só os tablados onde se anda fora do terreno (cais, prancha, convés, quebra-mar). */
// tablados onde dá para andar: o main3d usa deckAt no groundAt. y1 (opcional) = altura no fim (rampa)
const DECKS = [];
export function deckAt(x, z) {
  let best = null;
  for (const d of DECKS) { const dx = x - d.x, dz = z - d.z, cs = Math.cos(d.yaw), sn = Math.sin(d.yaw), lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) <= d.w / 2 && lz >= -0.3 && lz <= d.len) { const y = d.y1 === undefined || d.y1 === d.y ? d.y : d.y + (d.y1 - d.y) * Math.max(0, Math.min(1, lz / d.len)); if (best === null || y > best) best = y; } }
  return best;
}

/* =========================== A MURALHA GÉLIDA e a FORTALEZA DA VIGÍLIA NEGRA (S-165) ===========================
   No extremo oeste do Vale da Geada, uma muralha de gelo colossal (≈55 m) guarda o fim do mundo conhecido.
   Ao pé dela, a irmandade de mantos negros vive numa fortaleza de madeira e pedra sem muralhas próprias:
   torre do comandante, salão comunal, alojamentos, corvaria, arsenal com forja, estábulo, pátio de treino,
   escadaria em zigue-zague subindo o gelo e o elevador de gaiola puxado por um sarilho lá em cima.
   (Inspiração de sensação, com nomes, brasões e formas próprios.) */
export const FROST = { x: -380, z: 28, wallX: -405 };
function iceTex() {
  return canvasPair(512, 512, (g, gb, W, H) => {
    // S-261: gelo maciço — nada de listras: manchas grandes e suaves (gelo leitoso x gelo azul fundo), veios difusos e geada
    const r = rngOf(61); g.fillStyle = '#c4dcea'; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
    const blob = (ctx, x, y, rad, col) => { for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { const gg = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); } }; // emenda nas bordas (sem costura)
    for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * H, rad = 40 + r() * 140, deep = r() < 0.45; blob(g, x, y, rad, deep ? `rgba(70,128,170,${0.18 + r() * 0.2})` : `rgba(240,248,252,${0.2 + r() * 0.25})`); blob(gb, x, y, rad, deep ? `rgba(60,60,60,${0.2 + r() * 0.2})` : `rgba(200,200,200,${0.2 + r() * 0.2})`); }
    for (let k = 0; k < 900; k++) { const x = r() * W, y = r() * H, rad = 2 + r() * 10; blob(g, x, y, rad, `rgba(255,255,255,${r() * 0.18})`); blob(gb, x, y, rad, `rgba(${r() < 0.5 ? '230,230,230' : '40,40,40'},${r() * 0.25})`); } // bolhas presas e grão do gelo
    for (let k = 0; k < 2400; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); } // geada fina
  });
}
const FM = {
  ice: () => MATS.ice || (MATS.ice = (() => { const t = TEX.ice || (TEX.ice = iceTex()); for (const x of [t.map, t.bump]) x.repeat.set(1, 1); const m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, roughness: 0.5, metalness: 0.02, color: '#ffffff', vertexColors: true, emissive: '#16405f', emissiveIntensity: 0.28 }); m.userData.tile = 24; return m; })()),
  snow: () => plain('snow', '#f1f5f9', { rough: 0.9 }),
  icicle: () => plain('icicle', '#cfe6f4', { rough: 0.15, metal: 0.05, transparent: true, opacity: 0.85 }),
  blackWool: () => plain('blackWool', '#16151a', { rough: 1 }),
  fur: () => plain('furCloak', '#5c4a3a', { rough: 1 }),
  rawWood: () => texMat('rawWood', () => woodTex({ base: [26, 26, 26], seed: 71 }), 2.2, { bump: 3 }),
  darkStone: () => texMat('frostStone', () => stoneTex({ base: [210, 6, 34], mortar: '#1c1e22', rows: [40, 60], wide: [60, 140], seed: 73 }), 4),
};
/* S-229: o lago congelado do Vale da Geada ganha uma camada de gelo de verdade (rachaduras, bolhas presas, neve soprada nas bordas),
   lisa e sem o quadriculado que aparecia quando o desenho vinha só da cor do terreno */
function frozenLake(ctx) {
  const R = FROZEN.r * 1.08, c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), rr = rngOf(919);
  const gr = g.createRadialGradient(512, 512, 40, 512, 512, 512); gr.addColorStop(0, '#9fc9dd'); gr.addColorStop(0.6, '#b9dbea'); gr.addColorStop(0.88, '#dcedf5'); gr.addColorStop(1, 'rgba(240,246,250,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 60; k++) { const x = rr() * 1024, y = rr() * 1024, rad = 30 + rr() * 140, gg = g.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, `rgba(${rr() < 0.5 ? '120,170,200' : '230,242,248'},${0.12 + rr() * 0.12})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } // manchas: gelo escuro (fundo) e gelo leitoso
  const crack = (x, y, a, len, w, depth) => { g.strokeStyle = `rgba(245,250,255,${0.35 + rr() * 0.3})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < len; s += 8) { a += (rr() - 0.5) * 0.5; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); if (depth < 3 && rr() < 0.05) crack(x, y, a + (rr() < 0.5 ? 1 : -1) * (0.6 + rr()), len * 0.45, w * 0.6, depth + 1); } g.stroke(); };
  for (let k = 0; k < 14; k++) crack(512 + (rr() - 0.5) * 500, 512 + (rr() - 0.5) * 500, rr() * 6.28, 180 + rr() * 380, 1.4 + rr() * 1.4, 0); // rachaduras ramificadas
  for (let k = 0; k < 500; k++) { const x = 512 + (rr() - 0.5) * 860, y = 512 + (rr() - 0.5) * 860; g.fillStyle = `rgba(255,255,255,${0.25 + rr() * 0.4})`; g.beginPath(); g.arc(x, y, 0.8 + rr() * 2.6, 0, 7); g.fill(); } // bolhas presas no gelo
  for (let k = 0; k < 40; k++) { const a = rr() * 6.28, d = 380 + rr() * 110, x = 512 + Math.cos(a) * d, y = 512 + Math.sin(a) * d, rad = 40 + rr() * 90, gg = g.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, 'rgba(248,251,253,0.85)'); gg.addColorStop(1, 'rgba(248,251,253,0)'); g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } // neve soprada nas bordas
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.18, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(FROZEN.x, heightAt(FROZEN.x, FROZEN.z) + 0.03, FROZEN.z); m.receiveShadow = true; m.renderOrder = 1;
  m.userData.asset = 'lago_congelado'; m.userData.big = true; ctx.scene.add(m); ctx.placed.push(m); CULL.push(m);
}
// telhado de duas águas com neve por cima (uma segunda "capa" branca um pouco maior)
function snowRoof(K, w, d, h, mat, x, y, z, ry = 0) { gable(K, w, d, h, mat, x, y, z, ry, 0.5); gable(K, w + 0.25, d + 0.1, h + 0.12, FM.snow(), x, y + 0.14, z, ry, 0.42); }
function icicles(K, r, x0, x1, y, z, ry = 0, n = 12) { const cs = Math.cos(ry), sn = Math.sin(ry); for (let k = 0; k < n; k++) { const u = x0 + (x1 - x0) * (k + r() * 0.6) / n, L = 0.25 + r() * 0.7; K.add(new THREE.ConeGeometry(0.05 + r() * 0.04, L, 6), FM.icicle(), u * cs + z * sn, y - L / 2, -u * sn + z * cs, 0, Math.PI, 0); } }
// manto negro de lã com gola de pele (preso ao osso do peito dos personagens realistas)
export function furCloak(ch, opts = {}) {
  // preso ao corpo do personagem (grupo externo, que já tem a escala da raça), na altura dos ombros
  const host = ch.obj || ch.root; if (!host) return null;
  const g = new THREE.Group(); g.position.set(0, 1.32, 0); host.add(g);
  const cg = new THREE.PlaneGeometry(1, 1, 10, 16), P = cg.attributes.position, len = opts.len || 1.12;
  for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), u = 0.5 - y, w = 0.46 + u * 0.36, X = x * w; P.setXYZ(k, X, -u * len + (u > 0.95 ? Math.sin(x * 16) * 0.03 : 0), -X * X * 1.25 - u * u * 0.12 + Math.sin(x * 11 + u * 5) * 0.018 * u - 0.02); }
  cg.computeVertexNormals();
  const cape = new THREE.Mesh(cg, opts.mat || FM.blackWool()); cape.material.side = THREE.DoubleSide; cape.position.set(0, 0.16, -0.16); cape.rotation.x = 0.08; cape.castShadow = true; g.add(cape);
  // gola de pele: anel grosso e irregular sobre os ombros
  const fg = new THREE.TorusGeometry(0.18, 0.058, 10, 26), FP = fg.attributes.position;
  for (let k = 0; k < FP.count; k++) { const x = FP.getX(k), y = FP.getY(k), z = FP.getZ(k), n = 1 + Math.sin(x * 40 + y * 30) * 0.08 + Math.sin(Math.atan2(y, x) * 23) * 0.06; FP.setXYZ(k, x * 1.25 * n, y * n * 0.9, z * 1.05 * n); }
  fg.rotateX(Math.PI / 2); fg.computeVertexNormals(); const fur = new THREE.Mesh(fg, opts.fur || FM.fur()); fur.position.set(0, 0.07, -0.06); fur.rotation.x = 0.12; fur.castShadow = true; g.add(fur);
  return g;
}
function iceWall(len, H, D) {
  // face leste (virada para +x) bem subdividida: inclinação, camadas de inverno (beiradas), fendas verticais;
  // nas pontas a muralha baixa e entra nas montanhas. Topo com neve acompanhando a altura.
  // S-261/S-262: gelo maciço em BLOCOS (colunas de ~8 m partidas em lajes de alturas diferentes, como gelo que cedeu e se partiu),
  // sem as beiradas/listras horizontais de antes; quinas suavizadas, superfície lisa com leve ondulação
  const SX = 640, SY = 70, pos = [], idx = [], uv = [], blk = [], Hz = z => H * (0.6 + 0.4 * Math.min(1, Math.max(0, (len / 2 - Math.abs(z)) / 50)));
  const hsh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // cada laje é um plano levemente inclinado (face de fratura), com quina viva e um vinco escuro na junta
  const slab = (ci, ri, fy) => hsh(ci, ri) + (fy - 0.5) * (hsh(ci + 0.5, ri) - 0.5) * 0.8;
  const colOff = (ci, y) => { const ry = (y + hsh(ci, 7) * 14 + Math.sin(y * 0.2 + ci) * 0.8) / (9 + hsh(ci, 3) * 8), ri = Math.floor(ry), fy = ry - ri, o0 = slab(ci, ri, fy), o1 = slab(ci, ri + 1, fy - 1); return o0 + (o1 - o0) * sst(0.9, 1, fy); };
  const czOf = (y, z) => (z + 500 + Math.sin(z * 0.043) * 5 + Math.sin(y * 0.09 + z * 0.02) * 1.6 + Math.sin(y * 0.31 + z) * 0.35) / 7.5; // juntas verticais tortas e colunas de larguras diferentes (nada de grade)
  const blocks = (y, z) => { const cz = czOf(y, z), ci = Math.floor(cz), fz = cz - ci, a = colOff(ci, y) + (fz - 0.5) * (hsh(ci, 99) - 0.5) * 0.5, b = colOff(ci + 1, y) + (fz - 1.5) * (hsh(ci + 1, 99) - 0.5) * 0.5; return a + (b - a) * sst(0.9, 1, fz); };
  const seam = (y, z) => { const cz = czOf(y, z), ci = Math.floor(cz), fz = cz - ci, ry = (y + hsh(ci, 7) * 14) / (9 + hsh(ci, 3) * 8), fy = ry - Math.floor(ry); return Math.max(sst(0.86, 0.95, fz) * sst(1.0, 0.97, fz), sst(0.86, 0.95, fy) * sst(1.0, 0.97, fy) * 0.7); };
  const faceX = (y, z, hz) => -((y + 6) / hz) * H * 0.12 + (blocks(y, z) - 0.45) * 3.0 + Math.sin(z * 0.035 + y * 0.02) * 1.4 + Math.sin(y * 0.6 + z * 0.21) * 0.12 + Math.sin(z * 1.7 + y * 1.1) * 0.05;
  for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
    const u = i / SX, v = j / SY, z = (u - 0.5) * len, hz = Hz(z), y = v * hz - 6;
    pos.push(faceX(y, z, hz), y, z); uv.push(z / 55, y / 40); blk.push(blocks(y, z));
  }
  for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) { const a = j * (SX + 1) + i, b = a + SX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // cor: lajes salientes claras (gelo leitoso), recuadas em azul profundo, juntas entre blocos mais escuras; topo quase branco, pé acinzentado
  const col = [], cA = new THREE.Color('#9cc3dc'), cDeep = new THREE.Color('#2f6690'), cHi = new THREE.Color('#e6f2f9'), cFoot = new THREE.Color('#b9c6cf'), tc = new THREE.Color();
  for (let k = 0, n = 0; k < pos.length; k += 3, n++) { const y = pos[k + 1], z = pos[k + 2], hz = Hz(z), b = blk[n], v = (y + 6) / hz;
    tc.copy(cDeep).lerp(cA, sst(0.05, 0.55, b)).lerp(cHi, sst(0.6, 1, b) * 0.7);
    tc.lerp(cHi, sst(0.85, 1, v) * 0.6).lerp(cFoot, sst(0.12, 0, v) * 0.5);
    tc.lerp(cDeep, seam(y, z) * 0.55).offsetHSL(0, 0, (hsh(Math.floor((z + 500) / 7.5), 11) - 0.5) * 0.06); col.push(tc.r, tc.g, tc.b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const grp = new THREE.Group(), face = new THREE.Mesh(g, FM.ice()); face.receiveShadow = true; grp.add(face);
  // topo: faixa de neve com borda irregular, da beirada até o fundo
  const tp = [], ti = [];
  // S-262: a capa de neve nasce colada na face (sem aba sobrando por cima, cuja parte de baixo aparecia como uma linha verde-escura no contorno)
  for (let i = 0; i <= SX; i++) { const z = (i / SX - 0.5) * len, hz = Hz(z), y = hz - 6, x0 = faceX(y, z, hz), drift = 0.5 + hsh(Math.floor(z / 3), 5) * 0.9;
    tp.push(faceX(y - drift, z, hz) - 0.05, y - drift, z, x0 + 0.28, y - drift * 0.35, z, x0 + 0.12, y + 0.35, z, x0 - 3, y + 1.0 + Math.sin(z * 0.2) * 0.3, z, x0 - D, y + 0.6, z); }
  for (let i = 0; i < SX; i++) for (let c = 0; c < 4; c++) { const a = i * 5 + c, b = a + 5; ti.push(a, a + 1, b, b, a + 1, b + 1); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setIndex(ti); tg.computeVertexNormals();
  const top = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: '#f3f7fb', roughness: 0.85, emissive: '#a9bccd', emissiveIntensity: 0.2, side: THREE.DoubleSide })); top.receiveShadow = true; grp.add(top);
  return grp;
}
// monta com coordenadas do mundo e coloca o grupo no centro dado (para a distância de desenho funcionar)
/* ---------- S-274: Vigília Negra cercada e maior (espírito do Castelo Negro): muralha de pedra com ameias e passadiço,
   torres nos cantos, portão com torres na estrada, casas novas (algumas maiores, em L e de dois andares) e o Torreão,
   onde se entra e há salão, quarto do comandante, cozinha, dormitório e sala de mapas. ---------- */
function frostWallRun(ctx, pts, gaps, st, dk, wd) {
  const H = 6.2, T = 2.2, CH = 7;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(-uz, ux), n = Math.max(1, Math.round(L / CH));
    for (let k = 0; k < n; k++) {
      const a = k / n * L, b = (k + 1) / n * L, cx = x0 + ux * (a + b) / 2, cz = z0 + uz * (a + b) / 2;
      if (gaps.some(([gx, gz, gr]) => Math.hypot(cx - gx, cz - gz) < gr)) continue; // vão do portão
      const lc = b - a + 0.05; let lo = Infinity; for (const t of [a, (a + b) / 2, b]) lo = Math.min(lo, gY(x0 + ux * t, z0 + uz * t));
      const K = new Kit();
      K.box(lc, H + 3, T, st, 0, (H + 3) / 2 - 3, 0);                                   // corpo da muralha (fundação enterrada)
      K.box(lc, 0.35, T + 0.5, st, 0, H + 0.05, 0);                                     // cornija
      for (let m = 0; m < Math.floor(lc / 1.6); m++) { const mx = -lc / 2 + 0.55 + m * 1.6; K.box(0.95, 1.1, 0.5, st, mx, H + 0.75, -T / 2 - 0.05); K.box(0.95, 0.12, 0.6, FM.snow(), mx, H + 1.36, -T / 2 - 0.05); } // ameias (lado de fora)
      K.box(lc, 0.9, 0.35, st, 0, H + 0.6, T / 2 + 0.05);                               // parapeito de dentro
      K.box(lc, 0.12, T - 0.4, FM.snow(), 0, H + 0.28, 0);                              // neve no passadiço
      for (let m = 0; m < Math.floor(lc / 2.4); m++) { const mx = -lc / 2 + 1.2 + m * 2.4; K.box(0.22, 2.2, 0.22, dk, mx, H + 1.4, T / 2 + 0.3); } // postes do toldo do passadiço
      K.box(lc, 0.16, 1.6, wd, 0, H + 2.55, T / 2 - 0.2, 0, -0.18);                     // toldo de tábuas
      K.box(lc, 0.08, 1.7, FM.snow(), 0, H + 2.66, T / 2 - 0.2, 0, -0.18);
      for (let m = 0; m < 3; m++) K.add(new THREE.ConeGeometry(0.05 + m * 0.01, 0.35 + (m * 0.29) % 0.5, 6), FM.icicle(), -lc / 2 + 1 + m * lc / 3, H - 0.3, -T / 2 - 0.3, 0, Math.PI, 0);
      put(ctx, K, 'muralha_da_vigilia', cx, cz, ry, { y: lo - 0.2, box: [[0, 0, lc / 2, T / 2]] });
    }
  }
}
function frostTower(ctx, x, z, st, dk, h = 11, asset = 'torre_da_vigilia') {
  const K = new Kit(), s = 5.2; K.box(s, h + 3, s, st, 0, (h + 3) / 2 - 3, 0); K.box(s + 0.5, 0.4, s + 0.5, st, 0, h, 0);
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const k of [-1, 1]) K.box(ox ? 0.6 : 1.1, 1.1, oz ? 0.6 : 1.1, st, ox * (s / 2 + 0.05) + (oz ? k * 1.3 : 0), h + 0.75, oz * (s / 2 + 0.05) + (ox ? k * 1.3 : 0));
  for (const [ox, oz, ry] of [[1, 0, Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, 0], [0, -1, 0]]) K.box(0.35, 1.2, 0.08, M.glass(), ox * (s / 2 + 0.02), h * 0.6, oz * (s / 2 + 0.02), ry);
  K.add(new THREE.ConeGeometry(s * 0.82, 4.2, 4), M.slate(), 0, h + 2.4, 0, Math.PI / 4); K.add(new THREE.ConeGeometry(s * 0.84, 4.3, 4), FM.snow(), 0, h + 2.55, 0, Math.PI / 4, 0, 0, 0.98, 0.9, 0.98);
  const lo = Math.min(gY(x - 2.5, z - 2.5), gY(x + 2.5, z + 2.5), gY(x - 2.5, z + 2.5), gY(x + 2.5, z - 2.5));
  put(ctx, K, asset, x, z, 0, { y: lo - 0.2, box: [[0, 0, s / 2, s / 2]] });
}
function frostHouse(ctx, x, z, ry, w, d, h, st, dk, wd, r, opts = {}) { // casa da Vigília: base de pedra, paredes de toras escuras, telhado com neve; L e 2º andar nas maiores
  const K = new Kit();
  K.box(w + 0.6, 1.4, d + 0.6, st, 0, -0.2, 0); K.box(w, h, d, wd, 0, 0.5 + h / 2, 0);
  for (let k = 0; k < Math.floor(h / 0.45); k++) for (const sx of [-1, 1]) K.add(new THREE.CylinderGeometry(0.21, 0.21, d + 0.5, 8), dk, sx * (w / 2 + 0.02), 0.72 + k * 0.45, 0, 0, Math.PI / 2, 0); // pontas de tora nos cantos
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.36, h, 0.36, dk, sx * w / 2, 0.5 + h / 2, sz * d / 2);
  let top = 0.5 + h;
  if (opts.floors === 2) { K.box(w + 0.4, 0.3, d + 0.4, dk, 0, top + 0.15, 0); K.box(w + 0.4, h * 0.85, d + 0.4, st, 0, top + 0.3 + h * 0.425, 0); for (const sx of [-1, 1]) for (const sz of [-0.25, 0.25]) K.box(0.08, 0.9, 0.7, M.glass(), sx * (w / 2 + 0.22), top + 1.6, sz * d, 0); top += 0.3 + h * 0.85; }
  snowRoof(K, w + 0.5, d + 0.6, h * 0.8, M.slate(), 0, top, 0, 0);
  K.box(1.5, 2.4, 0.15, dk, 0, 1.7, d / 2 + 0.05); K.box(1.9, 0.25, 0.3, st, 0, 3.0, d / 2 + 0.1); K.box(2.2, 0.25, 1.0, st, 0, 0.55, d / 2 + 0.6); // porta, verga de pedra e degrau
  for (const y of [1.0, 2.2]) K.box(1.4, 0.07, 0.04, M.iron(), 0, y, d / 2 + 0.14);
  for (const sx of [-1, 1]) { K.box(0.75, 0.7, 0.08, M.glass(), sx * w * 0.3, 2.2, d / 2 + 0.03); K.box(0.95, 0.12, 0.25, dk, sx * w * 0.3, 1.8, d / 2 + 0.1); K.box(0.95, 0.12, 0.2, dk, sx * w * 0.3, 2.6, d / 2 + 0.1); for (const s2 of [-1, 1]) K.box(0.45, 0.8, 0.06, dk, sx * w * 0.3 + s2 * 0.62, 2.2, d / 2 + 0.12); }
  K.box(1.1, top + 2.2, 1.1, st, w / 2 - 0.9, (top + 2.2) / 2, -d / 4); K.box(1.3, 0.2, 1.3, st, w / 2 - 0.9, top + 2.25, -d / 4); // chaminé
  icicles(K, r, -w / 2, w / 2, top - 0.05, d / 2 + 0.55, 0, 10); icicles(K, r, -w / 2, w / 2, top - 0.05, -d / 2 - 0.55, 0, 10);
  const box = [[0, 0, w / 2 + 0.3, d / 2 + 0.3]];
  if (opts.wing) { const aw = opts.wing, ax = -w / 2 - aw / 2 + 0.2, az = -d / 2 + aw / 2; K.box(aw + 0.6, 1.4, aw + 0.6, st, ax, -0.2, az); K.box(aw, h * 0.85, aw, wd, ax, 0.5 + h * 0.425, az); snowRoof(K, aw + 0.4, aw + 0.4, h * 0.7, M.slate(), ax, 0.5 + h * 0.85, az, Math.PI / 2); box.push([ax, az, aw / 2 + 0.3, aw / 2 + 0.3]); }
  const lo = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => gY(x + a * w / 2, z + b * d / 2)));
  put(ctx, K, opts.asset || 'casa_da_vigilia', x, z, ry, { y: lo, box });
}
function frostKeep(ctx, x, z, ry, st, dk, wd, r) { // o Torreão: dois andares de pedra escura, torre redonda no canto, escadaria e porta em arco
  const K = new Kit(), W = 18, D = 13, h1 = 4.6, h2 = 3.8;
  K.box(W + 1, 1.8, D + 1, st, 0, -0.5, 0); K.box(W, h1 + h2, D, st, 0, 0.4 + (h1 + h2) / 2, 0); K.box(W + 0.5, 0.35, D + 0.5, st, 0, 0.4 + h1, 0);
  const top = 0.4 + h1 + h2; K.box(W + 0.6, 0.4, D + 0.6, st, 0, top, 0);
  snowRoof(K, D + 0.6, W + 0.6, 4.6, M.slate(), 0, top + 0.2, 0, Math.PI / 2);
  for (const sx of [-1, 1]) { K.box(1.4, 6.5, 1.4, st, sx * W * 0.32, top + 2.6, -D * 0.2); K.box(1.6, 0.25, 1.6, st, sx * W * 0.32, top + 5.9, -D * 0.2); } // chaminés
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.9, h1 + h2 + 0.6, 0.9, st, sx * (W / 2 + 0.1), 0.4 + (h1 + h2) / 2, sz * (D / 2 + 0.1)); // cunhais
  // janelas: térreo em arco estreito, andar de cima com luz quente
  for (const wx of [-6.5, -3.5, 3.5, 6.5]) { K.box(0.8, 1.6, 0.1, M.glass(), wx, 2.4, D / 2 + 0.03); archBlocks(K, 0.8, 0.25, 0.4, st, wx, 3.2, D / 2 + 0.05, 0, 7); K.box(1.1, 0.18, 0.45, st, wx, 1.55, D / 2 + 0.15); }
  for (const wx of [-7, -4.5, -1.5, 1.5, 4.5, 7]) { K.box(0.75, 1.2, 0.1, M.glass(), wx, 0.4 + h1 + 1.8, D / 2 + 0.03); K.box(1.0, 0.2, 0.4, st, wx, 0.4 + h1 + 2.55, D / 2 + 0.12); for (const s of [-1, 1]) K.box(0.42, 1.3, 0.07, dk, wx + s * 0.6, 0.4 + h1 + 1.8, D / 2 + 0.1); }
  for (const sx of [-1, 1]) for (const wz of [-3.5, 0, 3.5]) { K.box(0.1, 1.2, 0.75, M.glass(), sx * (W / 2 + 0.03), 0.4 + h1 + 1.8, wz); K.box(0.1, 1.5, 0.75, M.glass(), sx * (W / 2 + 0.03), 2.4, wz); }
  // porta em arco no meio da fachada, com escadaria e braseiros
  K.box(2.4, 3.2, 0.2, dk, 0, 2.0, D / 2 + 0.06); K.box(0.06, 3.2, 0.24, M.iron(), 0, 2.0, D / 2 + 0.08); for (const y of [1.0, 2.0, 3.0]) K.box(2.3, 0.08, 0.05, M.iron(), 0, y, D / 2 + 0.18);
  archBlocks(K, 2.4, 0.55, 0.9, st, 0, 3.6, D / 2 + 0.2, 0, 11); for (const s of [-1, 1]) K.box(0.55, 3.2, 0.9, st, s * 1.48, 2.0, D / 2 + 0.2);
  for (let k = 0; k < 3; k++) K.box(4.4 - k * 0.5, 0.3, 0.6, st, 0, 0.25 + k * 0.3, D / 2 + 0.4 + (2 - k) * 0.55);
  // torre redonda no canto da frente, com telhado cônico e neve
  const tx = W / 2 + 0.6, tz = D / 2 - 0.6, TR = 2.6, TH = top + 4;
  K.add(new THREE.CylinderGeometry(TR, TR + 0.3, TH + 1.5, 24), st, tx, (TH + 1.5) / 2 - 1.5, tz); K.add(new THREE.CylinderGeometry(TR + 0.4, TR + 0.4, 0.5, 24), st, tx, TH, tz);
  K.add(new THREE.ConeGeometry(TR + 0.6, 5, 24), M.slate(), tx, TH + 2.7, tz); K.add(new THREE.ConeGeometry(TR + 0.65, 4.2, 24), FM.snow(), tx, TH + 2.45, tz, 0, 0, 0, 1, 0.92, 1);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, yy = 3 + (k % 3) * 3.4; K.box(0.3, 1.1, 0.25, M.glass(), tx + Math.cos(a) * (TR + 0.12), yy, tz + Math.sin(a) * (TR + 0.12), -a + Math.PI / 2); }
  icicles(K, r, -W / 2, W / 2, top + 0.05, D / 2 + 0.75, 0, 18);
  const g = put(ctx, K, 'torreao_da_vigilia', x, z, ry, { y: Math.min(gY(x, z), gY(x + 8, z), gY(x - 8, z), gY(x, z + 8), gY(x, z - 8)), box: [[0, 0, W / 2 + 0.5, D / 2 + 0.5], [tx, tz, TR + 0.3, TR + 0.3], [-1.9, D / 2 + 1.2, 0.4, 0.9], [1.9, D / 2 + 1.2, 0.4, 0.9]] });
  for (const sx of [-1, 1]) { const b = makeBanner('vigilia', 1.4, 3.6); b.position.set(sx * 4.8, 0.4 + h1 + h2 - 0.4, D / 2 + 0.25); g.add(b); }
  const cs = Math.cos(ry), sn = Math.sin(ry), W2 = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  for (const s of [-1, 1]) { const [bx, bz] = W2(s * 3.0, D / 2 + 2.2); brazier(ctx, bx, gY(bx, bz), bz, s > 0, 7 + s); }
  return W2(0, D / 2 + 2.8);
}
function frostKeepInterior(ctx, st, dk, wd, r) {
  const I = { name: 'Torreão da Vigília', x: 2000, z: 0, w: 28, d: 22, h: 4.6, region: 'A Muralha Gélida', wall: '#3a3c42', floor: '#4a4a4e', beam: '#2a2420' };
  ctx.INTERIORS.torreao_vigilia = I;
  const K = new Kit(), hw = I.w / 2, hd = I.d / 2, H = I.h, T = 0.6, floorSt = FM.darkStone(), plank = M.wood(), fur = FM.fur(), wool = FM.blackWool();
  const occ = [];
  K.box(I.w, 0.2, I.d, floorSt, 0, -0.1, 0);
  for (const [x0, x1, z0, z1] of [[-hw, -6, -hd, 0], [6, hw, -hd, 0]]) for (let x = x0 + 0.25; x < x1; x += 0.5) K.box(0.48, 0.04, z1 - z0 - 0.4, x % 1 > 0.5 ? plank : dk, x, 0.02, (z0 + z1) / 2); // tábuas nos quartos
  // paredes de fora (a do sul tem o vão da porta)
  const walls = new Kit(), wb = [];
  const WALL = (w, d, x, z) => { walls.box(w, H, d, st, x, H / 2, z); wb.push([x, z, w / 2, d / 2]); };
  WALL(I.w + T * 2, T, 0, -hd - T / 2); WALL(T, I.d, -hw - T / 2, 0); WALL(T, I.d, hw + T / 2, 0);
  WALL(hw - 1.3, T, -hw / 2 - 0.65, hd + T / 2); WALL(hw - 1.3, T, hw / 2 + 0.65, hd + T / 2); walls.box(2.6, H - 3, T, st, 0, 3 + (H - 3) / 2, hd + T / 2);
  // paredes de dentro: salão no meio (x −6..6), alas oeste e leste divididas em dois cômodos cada; vãos de porta nas paredes do salão
  for (const sx of [-6, 6]) { WALL(0.5, 4.6, sx, -hd + 2.3); WALL(0.5, 9.2, sx, 0); WALL(0.5, 4.6, sx, hd - 2.3); for (const dz of [-5.5, 5.5]) walls.box(0.5, H - 2.8, 1.8, st, sx, 2.8 + (H - 2.8) / 2, dz); }
  for (const s of [-1, 1]) WALL(8, 0.5, s * (hw - 4), 0);
  // vigas e teto
  const ceil = new Kit(); ceil.box(I.w + 1.2, 0.3, I.d + 1.2, dk, 0, H + 0.15, 0); for (let x = -hw + 1.4; x < hw; x += 2.8) K.box(0.35, 0.4, I.d, dk, x, H - 0.2, 0);
  // ----- salão: lareira grande ao norte, mesa comprida, bancos, cadeira do comandante, estandartes, candelabro de ferro, peles no chão
  K.box(4.2, 3.4, 1.2, st, 0, 1.7, -hd + 0.6); K.box(4.6, 0.35, 1.5, st, 0, 3.0, -hd + 0.75); K.box(2.4, 1.6, 0.4, plain('hearthDark', '#120c08'), 0, 0.8, -hd + 1.0); for (let k = 0; k < 5; k++) K.add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), dk, -0.6 + k * 0.3, 0.25, -hd + 1.4, 0.4 * (k % 2 - 0.5), 0, Math.PI / 2);
  K.box(1.6, 5, 0.12, st, 0, 4.2, -hd + 0.6);
  K.box(1.6, 0.1, 9.5, wd, 0, 0.92, 1.0); for (const sz of [-3.4, 1, 5.4]) for (const sx of [-0.6, 0.6]) K.box(0.14, 0.9, 0.14, dk, sx, 0.45, sz); // mesa comprida
  for (const sx of [-1.35, 1.35]) { K.box(0.45, 0.08, 9.2, dk, sx, 0.5, 1.0); for (const sz of [-3, 1, 5]) K.box(0.4, 0.5, 0.1, dk, sx, 0.25, sz); }
  K.box(0.9, 0.1, 0.8, dk, 0, 0.6, -4.4); K.box(0.9, 1.6, 0.12, dk, 0, 1.4, -4.8); K.box(0.95, 0.12, 0.85, fur, 0, 0.68, -4.4); // cadeira do comandante (com pele)
  for (let k = 0; k < 6; k++) { const z = -2.5 + k * 1.6; K.add(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 10), dk, (k % 2 ? -0.4 : 0.4), 1.04, z); K.add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 14), M.iron(), (k % 2 ? 0.3 : -0.3), 0.985, z); } // canecas e pratos
  for (let k = 0; k < 3; k++) K.add(new THREE.SphereGeometry(0.13, 10, 8), plain('bread', '#b07a3a', { rough: 0.9 }), 0.1 * k - 0.1, 1.04, 2.2 + k * 0.2, 0, 0, 0, 1.3, 0.7, 1);
  K.add(new THREE.TorusGeometry(1.1, 0.05, 8, 32), M.iron(), 0, H - 1.0, 1.0, 0, Math.PI / 2); for (let k = 0; k < 4; k++) K.cyl(0.015, 0.015, 1.0, M.iron(), Math.cos(k * Math.PI / 2) * 0.8, H - 0.5, 1.0 + Math.sin(k * Math.PI / 2) * 0.8, 4, 0, Math.cos(k * 1.57) * 0.6, Math.sin(k * 1.57) * 0.6);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.cyl(0.04, 0.04, 0.2, plain('candle', '#efe6cf', { rough: 0.6 }), Math.cos(a) * 1.1, H - 0.88, 1.0 + Math.sin(a) * 1.1, 8); }
  K.add(new THREE.CircleGeometry(1.4, 24), fur, -3.2, 0.03, -6.5, 0, -Math.PI / 2, 0, 1.3, 1, 1); K.add(new THREE.CircleGeometry(1.2, 24), wool, 3.4, 0.03, 6.8, 0, -Math.PI / 2);
  for (const sx of [-1, 1]) { K.box(0.9, 1.6, 0.4, dk, sx * 4.8, 0.8, -hd + 0.3); for (let k = 0; k < 4; k++) K.box(0.05, 1.3, 0.05, M.steel(), sx * 4.8 - 0.3 + k * 0.2, 1.1, -hd + 0.55, 0, 0, 0.05); } // suportes de lanças
  // ----- quarto do comandante (noroeste): cama com pele, baú, escrivaninha com mapa e vela, armário
  { const cx = -10, cz = -5.5; K.box(2.2, 0.5, 2.8, dk, cx - 1.6, 0.25, cz - 2.4); K.box(2.0, 0.25, 2.5, plain('linen', '#d9d0bc'), cx - 1.6, 0.6, cz - 2.3); K.box(2.1, 0.12, 1.7, fur, cx - 1.6, 0.76, cz - 1.8); K.box(2.2, 1.2, 0.15, dk, cx - 1.6, 0.9, cz - 3.75); K.add(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12), plain('pillow', '#e8e2d2'), cx - 1.6, 0.78, cz - 3.3, 0, 0, Math.PI / 2, 1, 1, 0.45);
    K.box(1.2, 0.6, 0.6, dk, cx - 1.6, 0.3, cz - 0.5); K.box(1.25, 0.06, 0.65, M.iron(), cx - 1.6, 0.62, cz - 0.5);
    K.box(1.6, 0.08, 0.8, wd, cx + 2.4, 0.85, cz - 3.9); for (const sx of [-0.7, 0.7]) K.box(0.08, 0.85, 0.7, dk, cx + 2.4 + sx, 0.42, cz - 3.9); K.box(0.9, 0.01, 0.6, plain('mapPaper', '#e6d6a8', { rough: 1 }), cx + 2.3, 0.9, cz - 3.9, 0.2); K.cyl(0.04, 0.04, 0.18, plain('candle', '#efe6cf'), cx + 2.9, 0.98, cz - 3.7, 8);
    K.box(0.5, 0.06, 0.5, dk, cx + 2.4, 0.5, cz - 2.9); K.box(0.5, 0.7, 0.06, dk, cx + 2.4, 0.85, cz - 2.65);
    K.box(1.4, 2.4, 0.7, dk, cx + 3.0, 1.2, cz + 4.7); K.box(0.04, 2.0, 0.02, M.iron(), cx + 3.0, 1.2, cz + 4.34);
    K.add(new THREE.CircleGeometry(1.0, 20), plain('rugRed', '#5a1e1a', { rough: 1 }), cx, 0.05, cz + 1.0, 0, -Math.PI / 2, 0, 1.4, 1, 1); }
  // ----- cozinha (sudoeste): fogão de pedra com caldeirão, mesa, prateleiras com potes, carnes penduradas, barris e sacos
  { const cx = -10, cz = 5.5; K.box(2.6, 1.0, 1.4, st, cx - 2.2, 0.5, cz + 4.6); K.box(1.6, 0.4, 0.6, plain('hearthDark', '#120c08'), cx - 2.2, 0.9, cz + 4.0); K.add(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), M.iron(), cx - 2.2, 1.55, cz + 4.4); K.box(0.05, 1.3, 0.05, M.iron(), cx - 2.2, 2.4, cz + 4.4); K.add(new THREE.CircleGeometry(0.36, 16), plain('stew', '#7a5228', { rough: 0.4 }), cx - 2.2, 1.66, cz + 4.4, 0, -Math.PI / 2);
    K.box(2.4, 0.08, 1.1, wd, cx + 0.6, 0.9, cz); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.08, 0.9, 0.08, dk, cx + 0.6 + sx * 1.1, 0.45, cz + sz * 0.45);
    for (let k = 0; k < 4; k++) K.add(new THREE.SphereGeometry(0.14, 10, 8), plain(['veg1', 'veg2', 'bread', 'veg3'][k], ['#c8a040', '#8a3a2a', '#b07a3a', '#6a8a3a'][k], { rough: 0.8 }), cx + k * 0.35, 1.02, cz - 0.1, 0, 0, 0, 1.2, 0.8, 1);
    for (const sx of [-0.6, 1.8]) K.box(0.08, 1.9, 0.4, dk, cx + sx, 1.5, 0.5); // prateleiras encostadas na parede da cozinha
    for (let s = 0; s < 3; s++) { K.box(2.5, 0.06, 0.4, wd, cx + 0.6, 1.2 + s * 0.6, 0.5); for (let k = 0; k < 5; k++) K.add(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 10), plain('jar' + (k % 3), ['#8a5a3a', '#5a6a7a', '#a8885a'][k % 3], { rough: 0.6 }), cx - 0.3 + k * 0.45, 1.36 + s * 0.6, 0.5); }
    for (let k = 0; k < 3; k++) { K.cyl(0.01, 0.01, 0.5, M.rope(), cx + 2.5, H - 0.5, cz + 2 + k * 0.6, 4); K.add(new THREE.SphereGeometry(0.2, 10, 8), plain('ham', '#8a4a32', { rough: 0.7 }), cx + 2.5, H - 1.0, cz + 2 + k * 0.6, 0, 0, 0, 0.8, 1.4, 0.8); }
    for (let k = 0; k < 3; k++) K.add(new THREE.CylinderGeometry(0.4, 0.4, 0.95, 14), wd, cx + 3.0, 0.47, cz + 4.4 - k * 0.9); for (let k = 0; k < 3; k++) K.add(new THREE.SphereGeometry(0.35, 10, 8), plain('sackV', '#a89068', { rough: 1 }), cx - 3.2, 0.3, cz - 1.5 + k * 0.6, 0, 0, 0, 1, 0.8, 1); }
  // ----- dormitório (nordeste): beliches com mantos negros, baús ao pé, cabides com capas
  { const cx = 10, cz = -5.5;
    for (let b = 0; b < 3; b++) { const bx = cx - 2.9 + b * 2.2, bz = cz - 3.6; for (const lv of [0, 1]) { K.box(1.0, 0.12, 2.1, dk, bx, 0.45 + lv * 1.3, bz); K.box(0.95, 0.14, 2.0, wool, bx, 0.58 + lv * 1.3, bz + 0.05); K.box(0.9, 0.08, 0.5, plain('linen', '#d9d0bc'), bx, 0.68 + lv * 1.3, bz - 0.7); } for (const sx of [-0.5, 0.5]) for (const sz of [-1.0, 1.0]) K.box(0.08, 2.3, 0.08, dk, bx + sx, 1.15, bz + sz); K.box(0.8, 0.45, 0.45, dk, bx, 0.22, bz + 1.45); }
    for (let k = 0; k < 4; k++) { K.box(0.06, 0.06, 0.3, dk, cx + 3.85, 1.9, cz + 0.5 + k * 0.8); const g = new THREE.PlaneGeometry(0.6, 1.3, 1, 4), P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getY(i) * 3) * 0.04); K.add(g, wool, cx + 3.6, 1.2, cz + 0.5 + k * 0.8, -Math.PI / 2); } }
  // ----- sala de mapas e armaria (sudeste): mesa de mapas com velas, armadura no suporte, espadas na parede, estante de pergaminhos
  { const cx = 10, cz = 5.5; K.box(2.6, 0.1, 1.6, wd, cx, 0.95, cz); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.1, 0.95, 0.1, dk, cx + sx * 1.2, 0.47, cz + sz * 0.7); K.box(2.2, 0.01, 1.3, plain('mapPaper', '#e6d6a8', { rough: 1 }), cx, 1.01, cz); for (const [mx, mz] of [[-0.6, -0.3], [0.4, 0.2], [0.8, -0.4]]) K.cyl(0.05, 0.05, 0.03, M.iron(), cx + mx, 1.03, cz + mz, 8); K.cyl(0.04, 0.04, 0.2, plain('candle', '#efe6cf'), cx - 1.0, 1.1, cz + 0.5, 8);
    K.cyl(0.05, 0.05, 1.7, dk, cx + 3.2, 0.85, cz - 3.5, 8); K.box(0.6, 0.7, 0.35, M.steel(), cx + 3.2, 1.45, cz - 3.5); K.add(new THREE.SphereGeometry(0.18, 12, 10), M.steel(), cx + 3.2, 2.0, cz - 3.5); for (const s of [-1, 1]) K.add(new THREE.SphereGeometry(0.16, 10, 8), M.steel(), cx + 3.2 + s * 0.38, 1.72, cz - 3.5, 0, 0, 0, 1, 0.7, 1); // armadura
    for (let k = 0; k < 4; k++) { K.box(0.06, 1.1, 0.02, M.steel(), cx - 3.0 + k * 0.5, 2.25, hd - 0.34, 0, 0, 0.1); K.box(0.26, 0.05, 0.05, M.gold(), cx - 3.0 + k * 0.5, 1.68, hd - 0.36); }
    K.box(2.0, 2.4, 0.5, dk, cx - 1.6, 1.2, cz - 4.7); for (let s = 0; s < 4; s++) { K.box(1.9, 0.05, 0.45, wd, cx - 1.6, 0.4 + s * 0.55, cz - 4.65); for (let k = 0; k < 6; k++) K.add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), plain('scroll', '#e2d4b0', { rough: 0.9 }), cx - 2.3 + k * 0.28, 0.5 + s * 0.55, cz - 4.6, 0, 0, Math.PI / 2); } }
  const g = K.build(); g.position.set(I.x, 0, I.z); ctx.scene.add(g);
  const wg = walls.build(); wg.position.set(I.x, 0, I.z); ctx.scene.add(wg); ctx.occluders.push(wg);
  const cg = ceil.build(); cg.position.set(I.x, 0, I.z); ctx.scene.add(cg); ctx.occluders.push(cg);
  for (const [lx, lz, hx, hz] of wb) ctx.colliders.push({ x: I.x + lx, z: I.z + lz, r: Math.max(hx, hz), box: true, hx, hz, rot: 0, name: 'torreao' });
  for (const [lx, lz, hx, hz] of [[0, 1.0, 1.0, 4.9], [0, -hd + 0.8, 2.3, 0.9], [-11.6, -7.9, 1.2, 1.5], [-7.6, -9.4, 0.9, 0.5], [-12.2, 10.1, 1.4, 0.8], [-9.4, 5.5, 1.3, 0.6], [-9.4, 0.4, 1.3, 0.3], [-7, 9.7, 0.5, 1.4], [7.1, -9.1, 0.6, 1.1], [9.3, -9.1, 0.6, 1.1], [11.5, -9.1, 0.6, 1.1], [10, 5.5, 1.4, 0.9], [8.4, 0.8, 1.1, 0.35], [13.2, 2.0, 0.35, 0.35]])
    ctx.colliders.push({ x: I.x + lx, z: I.z + lz, r: Math.max(hx, hz), box: true, hx, hz, rot: 0, name: 'torreao' });
  // fogo da lareira e do fogão, luz quente nos cômodos (o pool de luzes leva as 3 reais para as mais próximas)
  for (const [lx, lz, s] of [[0, -hd + 1.3, 1.5], [-12.2, 9.9, 0.7]]) { const f = flame(s, lx); f.position.set(I.x + lx, lx ? 1.15 : 0.35, I.z + lz); ctx.scene.add(f); ctx.roomAnims.push(f); }
  for (const [lx, lz, c, i] of [[0, -hd + 2.5, '#ff9a48', 7], [0, 4, '#ffcf8a', 6.5], [-10, -5.5, '#ffc070', 5.5], [-10, 5.5, '#ffa858', 5.5], [10, -5.5, '#ffc070', 5], [10, 5.5, '#ffc878', 5.5]]) { const L = vlight(c, i, 13, 1.3); L.position.set(I.x + lx, H - 1.2, I.z + lz); ctx.scene.add(L); }
  // tochas de parede (suporte de ferro + chama) e estandartes negros no salão
  for (const [lx, lz, ry] of [[-5.7, -8, Math.PI / 2], [5.7, -8, -Math.PI / 2], [-5.7, 8.5, Math.PI / 2], [5.7, 8.5, -Math.PI / 2], [-13.7, -5.5, Math.PI / 2], [-13.7, 5.5, Math.PI / 2], [13.7, -3, -Math.PI / 2], [13.7, 8, -Math.PI / 2]]) {
    const T2 = new Kit(); T2.box(0.08, 0.08, 0.35, M.iron(), 0, 0, 0.17); T2.add(new THREE.CylinderGeometry(0.09, 0.05, 0.22, 10, 1, true), M.iron(), 0, 0.12, 0.36); T2.cyl(0.035, 0.035, 0.3, dk, 0, 0.18, 0.36, 6);
    const tg = T2.build(false); tg.position.set(I.x + lx, 2.3, I.z + lz); tg.rotation.y = ry; ctx.scene.add(tg);
    const f = flame(0.45, lx + lz); f.position.set(I.x + lx + Math.sin(ry) * 0.36, 2.62, I.z + lz + Math.cos(ry) * 0.36); ctx.scene.add(f); ctx.roomAnims.push(f);
  }
  for (const [lx, lz, ry] of [[-5.72, -1.5, Math.PI / 2], [5.72, -1.5, -Math.PI / 2], [-5.72, 3.5, Math.PI / 2], [5.72, 3.5, -Math.PI / 2]]) { const b = makeBanner('vigilia', 1.1, 2.6); b.position.set(I.x + lx, 3.9, I.z + lz); b.rotation.y = ry; ctx.scene.add(b); }
  const ex = ctx.makePortal('#ffd27a'); ex.position.set(I.x, 0, I.z + hd - 0.9); ctx.scene.add(ex); ctx.portals.push({ kind: 'exit', from: 'torreao_vigilia', x: I.x, z: I.z + hd - 0.9, mesh: ex });
  // gente da casa: cada um junto do seu lugar
  const N = (n, x, z, yaw, anim) => { const npc = ctx.roomNpc(n, I.x + x, I.z + z, yaw, anim); furCloak(npc, { len: 1.05 }); return npc; };
  N({ id: 'dunstan_v', name: 'Irmão Dunstan', title: 'Intendente do Torreão', model: 'Knight', look: { race: 'humano', face: 'sereno', hair: { style: 'curto', color: 'grisalho' }, beard: true },
    lines: 'Bem-vindo ao Torreão. Salão no meio, cozinha e o quarto do Comandante a oeste, dormitório e sala de mapas a leste.\nNão mexa nos mapas do Comandante. Da última vez que um recruta mexeu, passamos uma semana procurando a Torre Leste.' }, -2.2, -6.6, Math.PI / 2);
  N({ id: 'ulf_v', name: 'Ulf', title: 'Cozinheiro do Torreão', model: 'Barbarian', show: ['Mug'], heals: true, look: { race: 'anao', face: 'alegre', hair: { style: 'careca', color: 'ruivo' }, beard: true } }, -11.4, 8.4, Math.PI);
  N({ id: 'sera_v', name: 'Sera', title: 'Cartógrafa da Vigília', model: 'Mage', look: { race: 'humano', sex: 'f', face: 'sabio', hair: { style: 'coque', color: 'preto' } },
    lines: 'Cada patrulha volta com um rabisco novo para este mapa. Do outro lado do gelo, metade ainda é branco — e branco quer dizer "ninguém voltou para contar".' }, 11.9, 5.5, -Math.PI / 2);
  N({ id: 'tam_v', name: 'Tam', title: 'Recruta de folga', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'castanho' } },
    lines: 'Turno da noite na Muralha, folga de dia. Se eu dormir em pé aqui, por favor não conte pro Comandante.' }, 12.4, -2.4, -Math.PI / 2);
  return I;
}
function frostExpansion(ctx, C, r, wd, dk, st) {
  // muralha: do pé da Muralha de gelo, contornando a cidade; o lago congelado fica do lado de fora; portão a leste, na estrada
  const N = C.z - 44, E = -322, S1 = 72, Sx = -356, S2 = 48, X0 = C.wallX + 2;
  frostWallRun(ctx, [[X0, N], [E, N], [E, 20.8]], [], st, dk, wd); frostWallRun(ctx, [[E, 31.2], [E, S2], [Sx, S2], [Sx, S1], [X0, S1]], [], st, dk, wd);
  for (const [tx, tz] of [[E, N], [E, S2], [Sx, S2], [Sx, S1], [X0 + 2, N], [X0 + 2, S1]]) frostTower(ctx, tx, tz, st, dk);
  { // portão com duas torres, arco de pedra, folhas de madeira abertas e estandartes
    for (const s of [-1, 1]) frostTower(ctx, E, 26 + s * 5.2, st, dk, 12, 'portao_da_vigilia');
    const K = new Kit(); K.box(2.6, 2.4, 5.4, st, 0, 7.6, 0); archBlocks(K, 5.0, 0.6, 2.6, st, 0, 4.4, 0, Math.PI / 2, 13);
    for (let m = 0; m < 3; m++) K.box(0.6, 1.0, 0.9, st, -1.25, 9.3, -1.8 + m * 1.8); K.box(2.8, 0.15, 5.6, FM.snow(), 0, 8.85, 0);
    for (const s of [-1, 1]) { K.box(0.25, 4.4, 2.3, dk, -1.6, 2.2, s * 3.2, s * 1.2); for (const y of [0.8, 2.2, 3.6]) K.box(0.08, 0.14, 2.2, M.iron(), -1.75, y, s * 3.2, s * 1.2); }
    K.box(0.14, 0.14, 4.8, M.iron(), 0.3, 6.4, 0); for (let k = -2; k <= 2; k++) K.box(0.1, 1.6, 0.1, M.iron(), 0.3, 5.6, k * 1.0); // grade levadiça erguida
    const lo = Math.min(gY(E, 23), gY(E, 29)); const g = put(ctx, K, 'portao_da_vigilia', E, 26, 0, { y: lo - 0.2, occ: false });
    for (const s of [-1, 1]) { const b = makeBanner('vigilia', 1.3, 3.4); b.position.set(1.4, 7.3, s * 1.6); b.rotation.y = Math.PI / 2; g.add(b); }
    for (const s of [-1, 1]) brazier(ctx, E + 3.4, gY(E + 3.4, 26 + s * 3.2), 26 + s * 3.2, s > 0, 11 + s);
  }
  // casas novas: algumas maiores, em L ou de dois andares
  for (const [x, z, ry, w, d, h, o] of [[-344, 32, 0.04, 6.5, 10, 3.4, {}], [-331, 34, Math.PI / 2, 7, 9, 3.2, { floors: 2 }], [-354, -9, Math.PI, 6.5, 8, 3.2, { wing: 4.2 }], [-333, -10, Math.PI, 7, 6.5, 3.2, {}], [-372, 66, 0, 7, 7.5, 3.0, { floors: 2 }], [-388, 40, Math.PI / 2, 6, 7.5, 3.2, { wing: 3.8 }]])
    frostHouse(ctx, x, z, ry, w, d, h, st, dk, wd, r, o);
  // o Torreão (dá para entrar) e o seu interior
  const door = frostKeep(ctx, -332, 4, -Math.PI / 2, st, dk, wd, r);
  if (ctx.addDoorPortal && ctx.INTERIORS) { frostKeepInterior(ctx, st, dk, wd, r); ctx.addDoorPortal('torreao_vigilia', door[0], door[1], -Math.PI / 2); }
}
function putAbs(ctx, K, asset, cx, cz, opts = {}) { for (const { geos } of K.parts.values()) for (const g of geos) g.translate(-cx, 0, -cz); return put(ctx, K, asset, cx, cz, 0, { y: 0, ...opts }); }
function buildFrostHold(ctx) {
  const C = FROST, r = rngOf(4242), wd = FM.rawWood(), dk = M.darkWood(), st = FM.darkStone();
  frozenLake(ctx);
  // ---------- a Muralha ----------
  const H = 56, LEN = 500, wallZ = 2;
  { const w = iceWall(LEN, H, 22); w.position.set(C.wallX, gY(C.wallX + 4, wallZ) - 0.5, wallZ); ctx.scene.add(w); w.userData.asset = 'muralha_gelida'; w.userData.big = true; w.userData.far = 900; ctx.placed.push(w); ctx.occluders.push(w); CULL.push(w); ctx.extraPick && ctx.extraPick.push(w);
    for (let z = wallZ - LEN / 2; z <= wallZ + LEN / 2; z += 3) ctx.colliders.push({ x: C.wallX - 3, z, r: 4.5, name: 'muralha_gelida' }); }
  // ---------- escadaria em zigue-zague subindo o gelo ----------
  { const K = new Kit(), z0 = 52, flights = 8, rise = (H - 9) / flights, run = 16, xw = C.wallX + 3.2, yB = gY(C.wallX + 6, z0 + 8);
    for (let f = 0; f < flights; f++) {
      const dir = f % 2 ? -1 : 1, za = z0 + (dir > 0 ? 0 : run), y0 = yB + 0.4 + f * rise, xs = xw - (f * rise + 2) * 0.12 + 0.5; // acompanha a inclinação da face
      const L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
      K.box(2.4, 0.18, L, wd, xs + 1.2, y0 + rise / 2, za + dir * run / 2, 0, -dir * ang); // rampa de tábuas
      for (let k = 0; k < 16; k++) K.box(2.4, 0.06, 0.12, dk, xs + 1.2, y0 + (k + 0.5) / 16 * rise + 0.1, za + dir * (k + 0.5) / 16 * run, 0, -dir * ang); // degraus pregados
      K.box(0.1, 1.0, L, dk, xs + 2.35, y0 + rise / 2 + 0.6, za + dir * run / 2, 0, -dir * ang); // corrimão
      for (let k = 0; k <= 4; k++) { const yy = y0 + rise * k / 4, zz = za + dir * run * k / 4; K.box(0.22, yy + 1.2, 0.22, dk, xs + 2.35, (yy + 1.2) / 2 - 0.5, zz); K.box(1.9, 0.16, 0.16, dk, xs + 1.3, yy - 0.3, zz, 0, 0, 0.5); } // escoras cravadas no gelo
      K.box(2.8, 0.22, 2.8, wd, xs + 1.2, y0 + rise + 0.05, za + dir * run + dir * 1.2); // patamar
    }
    putAbs(ctx, K, 'escadaria_da_muralha', C.wallX + 4, z0 + 8, { occ: false }); }
  // ---------- elevador de gaiola + sarilho no topo ----------
  { const z = 12, xt = C.wallX - H * 0.12 + 1.5, top = gY(C.wallX, z) + H - 6.5, K = new Kit();
    K.box(7, 0.4, 7, wd, xt - 2, top + 0.2, z); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.4, 4.2, 0.4, dk, xt - 2 + sx * 3, top + 2.4, z + sz * 3); snowRoof(K, 7.4, 7.4, 2.2, M.slate(), xt - 2, top + 4.4, z, Math.PI / 2);
    K.box(8.5, 0.5, 0.5, dk, xt + 2, top + 3.8, z); K.add(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 20), dk, xt - 2, top + 2.2, z, 0, 0, Math.PI / 2); // braço do guindaste e roda do sarilho
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.box(0.1, 2.6, 0.12, dk, xt - 2, top + 2.2, z, 0, a, Math.PI / 2); }
    putAbs(ctx, K, 'sarilho', xt, z, { occ: false });
    const cage = new Kit(); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cage.box(0.12, 3, 0.12, dk, sx * 1.4, 1.5, sz * 1.4); cage.box(3, 0.15, 3, wd, 0, 0, 0); cage.box(3, 0.12, 3, dk, 0, 3, 0);
    for (let k = -1; k <= 1; k++) for (const sz of [-1, 1]) cage.box(2.8, 0.08, 0.06, M.iron(), 0, 1 + k * 0.6 + 0.6, sz * 1.4); cage.box(0.06, 2.6, 0.06, M.iron(), 0, 4.3, 0);
    const cg = put(ctx, cage, 'elevador_de_gaiola', xt + 5.8, z, 0, { y: gY(xt + 5.8, z), occ: false });
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), M.iron()); chain.position.set(xt + 5.8, 0, z); ctx.scene.add(chain);
    const y0 = gY(xt + 5.8, z) + 0.1, y1 = top - 3.5;
    const anim = { userData: { update: t => { const k = (Math.sin(t * 0.07) * 0.5 + 0.5); const yy = y0 + (y1 - y0) * k * k * (3 - 2 * k); cg.position.y = yy; const ch0 = yy + 3, ch1 = top + 3.8; chain.scale.y = ch1 - ch0; chain.position.y = (ch0 + ch1) / 2; } } }; ctx.roomAnims.push(anim); }
  // ---------- torre do comandante (pedra escura) ----------
  { const K = new Kit(), R = 5.2, TH = 20;
    K.add(new THREE.CylinderGeometry(R, R + 0.6, TH, 28, 1), st, 0, TH / 2 - 0.6, 0); K.add(new THREE.CylinderGeometry(R + 0.7, R + 0.7, 1.2, 28), st, 0, TH, 0);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; K.box(1.2, 1.4, 1.0, st, Math.cos(a) * (R + 0.4), TH + 1.3, Math.sin(a) * (R + 0.4), -a); } // ameias
    for (let k = 0; k < 9; k++) { const a = k * 2.3, yy = 4 + (k % 4) * 4; K.box(0.35, 1.3, 0.3, M.glass(), Math.cos(a) * (R + 0.15), yy, Math.sin(a) * (R + 0.15), -a); } // seteiras com luz
    K.box(2.2, 3.4, 0.5, dk, R + 0.2, 1.6, 0, Math.PI / 2); archBlocks(K, 2.2, 0.6, 1.0, st, R + 0.1, 3.3, 0, Math.PI / 2, 9);
    for (const sz of [-2, 2]) K.add(new THREE.ConeGeometry(0.06, 0.6, 6), FM.icicle(), R + 0.5, TH - 0.6, sz, 0, Math.PI, 0);
    const g = put(ctx, K, 'torre_do_comandante', C.x - 4, C.z - 22, Math.PI, { box: [[0, 0, R + 0.6, R + 0.6]] });
    for (const sz of [-1.6, 1.6]) { const b = makeBanner('vigilia', 1.5, 4.6); b.position.set(C.x - 4 - (R + 0.5), gY(C.x - 4, C.z - 22) + 14, C.z - 22 + sz); b.rotation.y = -Math.PI / 2; ctx.scene.add(b); }
    brazier(ctx, C.x - 4, gY(C.x - 4, C.z - 22) + TH + 0.7, C.z - 22, true, 5); }
  // ---------- salão comunal (madeira, telhado de neve) ----------
  const hall = (asset, x, z, ry, w, d, h, chimney) => { const K = new Kit();
    K.box(w + 0.6, 0.8, d + 0.6, st, 0, 0, 0); K.box(w, h, d, wd, 0, 0.4 + h / 2, 0);
    for (const sx of [-1, 1]) for (let k = -2; k <= 2; k++) K.box(0.3, h, 0.3, dk, sx * w / 2, 0.4 + h / 2, k * d / 4);
    snowRoof(K, w + 0.4, d + 0.6, h * 0.75, M.slate(), 0, 0.4 + h, 0, Math.PI / 2);
    K.box(1.8, 2.6, 0.2, dk, w / 2 + 0.02, 1.7, 0, Math.PI / 2); for (const sz of [-d / 3, d / 3]) { K.box(0.6, 0.55, 0.1, M.glass(), w / 2 + 0.02, 2.5, sz, Math.PI / 2); K.box(0.9, 0.12, 0.2, dk, w / 2 + 0.06, 2.2, sz, Math.PI / 2); K.box(0.08, 0.6, 0.16, dk, w / 2 + 0.07, 2.5, sz, Math.PI / 2); }
    if (chimney) { K.box(1.3, h + 3, 1.3, st, -w / 4, 0.4 + (h + 3) / 2, d / 2 - 1.2); }
    icicles(K, r, -d / 2, d / 2, 0.45 + h, w / 2 + 0.45, Math.PI / 2, 14); icicles(K, r, -d / 2, d / 2, 0.45 + h, -w / 2 - 0.45, Math.PI / 2, 14);
    return put(ctx, K, asset, x, z, ry, { box: [[0, 0, w / 2 + 0.4, d / 2 + 0.4]] }); };
  hall('salao_comunal', C.x + 8, C.z - 2, 0, 9, 22, 4.6, true);
  hall('alojamento', C.x - 6, C.z + 18, 0.08, 7, 16, 3.6, true);
  hall('alojamento', C.x + 10, C.z + 24, -0.1, 7, 14, 3.4, false);
  // ---------- corvaria: torre de pedra com pombal de madeira e corvos ----------
  { const K = new Kit(); K.add(new THREE.CylinderGeometry(2.6, 3.0, 11, 18), st, 0, 5.5, 0); K.add(new THREE.CylinderGeometry(3.4, 3.4, 2.6, 12), wd, 0, 12.3, 0); K.add(new THREE.ConeGeometry(3.9, 3.4, 12), M.slate(), 0, 15.3, 0); K.add(new THREE.ConeGeometry(4.0, 3.5, 12), FM.snow(), 0, 15.4, 0, 0.2);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.box(0.7, 0.7, 0.2, plain('cote', '#0a0a0c'), Math.cos(a) * 3.38, 12.3, Math.sin(a) * 3.38, -a + Math.PI / 2); K.box(1.2, 0.08, 0.3, dk, Math.cos(a) * 3.7, 11.9, Math.sin(a) * 3.7, -a + Math.PI / 2); }
    const crowM = plain('crow', '#0d0c10', { rough: 0.5 });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, x = Math.cos(a) * 3.8, z = Math.sin(a) * 3.8; K.add(new THREE.SphereGeometry(0.16, 10, 8), crowM, x, 12.12, z, 0, 0, 0, 0.8, 0.9, 1.4); K.add(new THREE.SphereGeometry(0.1, 10, 8), crowM, x + Math.cos(a) * 0.05, 12.32, z + Math.sin(a) * 0.05); K.add(new THREE.ConeGeometry(0.035, 0.14, 6), plain('beak', '#2a2a2a'), x + Math.cos(a) * 0.16, 12.3, z + Math.sin(a) * 0.16, -a + Math.PI / 2, Math.PI / 2, 0); }
    put(ctx, K, 'corvaria', C.x - 20, C.z - 2, 0, { box: [[0, 0, 3, 3]] }); }
  // ---------- arsenal com forja, estábulo, pátio de treino ----------
  { const K = new Kit(); K.box(10, 0.4, 7, st, 0, 0, 0); K.box(10, 4, 0.6, st, 0, 2, -3.2); for (const px of [-4.7, 0, 4.7]) K.box(0.4, 4, 0.4, dk, px, 2, 3.2); snowRoof(K, 10.4, 7.4, 1.8, M.slate(), 0, 4, 0, 0);
    K.box(2.4, 1.1, 1.6, st, -3, 0.55, -2.2); K.box(1.8, 0.1, 1.1, M.ember(), -3, 1.12, -2.1); K.box(0.8, 0.6, 0.5, M.iron(), 1, 0.9, -0.8); K.box(0.5, 0.6, 0.5, dk, 1, 0.3, -0.8);
    for (let k = 0; k < 5; k++) for (const gg of axeGeo(1.6, 0.3)) K.add(gg, M.steel(), 2.6 + k * 0.45, 0.6, -2.85, 0, 0, 0.05);
    const g = put(ctx, K, 'arsenal', C.x + 24, C.z - 18, -Math.PI / 2, { box: [[0, -3.2, 5, 0.5], [-3, -2.2, 1.2, 0.8]] }); const f = flame(1.6, 4); f.position.set(-3, 1.15, -2.1); g.add(f); ctx.roomAnims.push(f); }
  { // S-260: Estábulo da Vigília de verdade — fundo e laterais de tábuas, três baias com divisórias, portinhas, manjedouras e argolas (os cavalos e o feno entram no main3d: FROST.stable)
    const K = new Kit(), W = 12.6, D = 6.4, H = 3.2, bd = M.wood();
    K.box(W, 0.3, D, wd, 0, 0, 0); for (let k = 0; k < 14; k++) K.box(0.05, 0.02, D - 0.1, dk, -W / 2 + 0.45 + k * 0.9, 0.16, 0); // tábuas do piso
    for (let k = 0; k <= Math.floor(W / 0.36); k++) { const x = -W / 2 + 0.18 + k * 0.36; K.box(0.34, H, 0.1, k % 3 ? bd : wd, x, 0.15 + H / 2, -D / 2 + 0.06); } // fundo de tábuas verticais
    for (const y of [0.9, 2.3]) K.box(W, 0.16, 0.1, dk, 0, y, -D / 2 + 0.14);
    for (const sx of [-1, 1]) { for (let k = 0; k < Math.floor(D / 0.36); k++) K.box(0.1, H, 0.34, k % 2 ? bd : wd, sx * (W / 2 - 0.06), 0.15 + H / 2, -D / 2 + 0.18 + k * 0.36); K.box(0.1, 0.16, D, dk, sx * (W / 2 - 0.14), 1.6, 0); } // laterais
    for (const px of [-W / 2 + 0.15, -2.1, 2.1, W / 2 - 0.15]) { K.cyl(0.16, 0.18, H, dk, px, 0.15 + H / 2, D / 2 - 0.2, 10); K.box(0.6, 0.22, 0.22, dk, px, H - 0.05, D / 2 - 0.3); } // esteios da frente com mãos-francesas
    K.box(W, 0.3, 0.3, dk, 0, H + 0.05, D / 2 - 0.2); snowRoof(K, W + 0.4, D + 0.6, 1.7, M.thatch(), 0, H + 0.15, 0, 0);
    const stable = { ry: Math.PI / 2, slots: [] };
    for (let i = 0; i < 3; i++) {
      const cx = (i - 1) * 4.2;
      if (i > 0) { const px = cx - 2.1; for (let k = 0; k < 5; k++) K.box(0.07, 0.22, D - 1.0, k % 2 ? bd : wd, px, 0.3 + k * 0.27, -0.45); K.cyl(0.08, 0.09, 1.6, dk, px, 0.95, D / 2 - 1.0, 10); } // divisória de tábuas
      // manjedoura no fundo com feno, e cocho
      K.box(1.3, 0.07, 0.55, dk, cx - 0.6, 0.95, -D / 2 + 0.45); for (const sz of [-1, 1]) K.box(1.3, 0.3, 0.05, dk, cx - 0.6, 1.1, -D / 2 + 0.45 + sz * 0.25); K.add(new THREE.SphereGeometry(0.45, 12, 8), M.thatch(), cx - 0.6, 1.1, -D / 2 + 0.45, 0, 0, 0, 1.3, 0.3, 0.5);
      K.box(0.9, 0.4, 0.45, dk, cx + 0.9, 0.35, -D / 2 + 0.4); K.box(0.8, 0.02, 0.36, plain('troughW', '#5a7a86', { rough: 0.05, metal: 0.3 }), cx + 0.9, 0.53, -D / 2 + 0.4);
      // portinha de meia altura, entreaberta numa das baias
      const gw = 3.5, ga = i === 1 ? -0.4 : 0, hx = cx - 1.95, hz = D / 2 - 0.9;
      for (let k = 0; k < 4; k++) K.box(gw, 0.2, 0.05, bd, hx + Math.cos(ga) * gw / 2, 0.38 + k * 0.25, hz - Math.sin(ga) * gw / 2, ga);
      K.box(0.08, Math.hypot(gw - 0.15, 0.9), 0.05, dk, hx + Math.cos(ga) * gw / 2, 0.75, hz - Math.sin(ga) * gw / 2 + 0.04, ga, 0, Math.atan2(gw - 0.15, 0.9));
      for (const y of [0.45, 1.05]) K.box(0.22, 0.05, 0.03, M.iron(), hx + 0.11, y, hz + 0.05);
      // argola na divisória, perto da frente
      const rx = cx - 2.05, ry = 1.25, rz = D / 2 - 1.5; K.add(new THREE.TorusGeometry(0.06, 0.012, 8, 18), M.iron(), rx + 0.03, ry, rz, Math.PI / 2);
      stable.slots.push({ lx: cx - 0.55, lz: -0.55, ring: [rx + 0.05, ry - 0.05, rz] });
    }
    // lampião no esteio e neve acumulada na borda do piso
    K.box(0.05, 0.05, 0.4, M.iron(), -2.1, 2.5, D / 2 + 0.0); K.box(0.2, 0.3, 0.2, M.iron(), -2.1, 2.3, D / 2 + 0.2); K.box(0.13, 0.22, 0.13, M.glass(), -2.1, 2.3, D / 2 + 0.2);
    const sx0 = C.x + 26, sz0 = C.z + 12; Object.assign(stable, { x: sx0, z: sz0 }); FROST.stable = stable;
    put(ctx, K, 'estabulo_da_vigilia', sx0, sz0, Math.PI / 2, { box: [[0, -D / 2 + 0.1, W / 2, 0.2], [-W / 2 + 0.1, 0, 0.2, D / 2], [W / 2 - 0.1, 0, 0.2, D / 2], [-2.1, -0.45, 0.1, D / 2 - 0.5], [2.1, -0.45, 0.1, D / 2 - 0.5], [0, D / 2 - 0.9, W / 2, 0.08]] }); }
  { const K = new Kit(); // bonecos de palha e alvos de arco
    for (let k = 0; k < 4; k++) { const x = -6 + k * 4; K.cyl(0.1, 0.12, 2.0, dk, x, 1.0, 0, 8); K.box(1.2, 0.1, 0.1, dk, x, 1.5, 0); K.add(new THREE.SphereGeometry(0.28, 12, 10), plain('straw', '#c9a85a', { rough: 1 }), x, 1.95, 0); K.add(new THREE.CylinderGeometry(0.32, 0.36, 0.8, 12), plain('straw', '#c9a85a', { rough: 1 }), x, 1.3, 0); }
    for (let k = 0; k < 3; k++) { const x = -5 + k * 5; K.add(new THREE.CylinderGeometry(0.75, 0.75, 0.25, 24), plain('target', '#d8c8a0'), x, 1.2, -9, 0, Math.PI / 2, 0); K.add(new THREE.CylinderGeometry(0.45, 0.45, 0.27, 24), plain('targetR', '#8a2a1e'), x, 1.2, -9, 0, Math.PI / 2, 0); K.add(new THREE.CylinderGeometry(0.16, 0.16, 0.29, 16), plain('targetY', '#e0c050'), x, 1.2, -9, 0, Math.PI / 2, 0); for (const sx of [-0.5, 0.5]) K.box(0.1, 1.6, 0.1, dk, x + sx, 0.6, -9.2, 0, 0.3); }
    put(ctx, K, 'patio_de_treino', C.x + 6, C.z + 8, Math.PI / 2, { occ: false }); }
  // ---------- portão de ferro selado no pé da muralha (o túnel para o outro lado) ----------
  { const K = new Kit(), gx = C.wallX + 1.5; K.box(2, 9, 2, st, 0, 4.5, -4.5); K.box(2, 9, 2, st, 0, 4.5, 4.5); K.box(2.2, 2, 11, st, 0, 9, 0); K.box(0.4, 7.6, 7, plain('tunnel', '#08090c'), -0.7, 3.8, 0);
    for (let k = -3; k <= 3; k++) K.box(0.18, 7.4, 0.18, M.iron(), 0.6, 3.7, k * 1.0); for (let k = 0; k < 5; k++) K.box(0.18, 0.18, 7, M.iron(), 0.6, 1 + k * 1.5, 0);
    put(ctx, K, 'portao_da_muralha', gx, C.z - 38, 0, { box: [[0, 0, 1.4, 5.5]] }); }
  // ---------- braseiros, lenha, neve amontoada e estandartes negros ----------
  for (const [dx, dz, L] of [[2, -10, true], [16, 8, false], [-12, 6, true], [0, 30, false], [20, -26, false], [-16, -28, true], [30, 0, false]]) brazier(ctx, C.x + dx, gY(C.x + dx, C.z + dz), C.z + dz, L, dx);
  for (const [dx, dz] of [[14, -12], [-10, 30], [2, 40]]) { const K = new Kit(); for (let k = 0; k < 18; k++) K.add(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), wd, (k % 6) * 0.34 - 0.85, 0.16 + Math.floor(k / 6) * 0.3, 0, 0, Math.PI / 2, 0); K.add(new THREE.BoxGeometry(2.3, 0.15, 1.8), FM.snow(), 0, 1.0, 0); put(ctx, K, 'lenha', C.x + dx, C.z + dz, r() * 3, { box: [[0, 0, 1.2, 0.9]], occ: false }); }
  { // S-228: montes de neve assentados no ponto mais baixo do terreno sob eles (nada voando nas encostas), baixinhos e com borda que some no chão
    const K = new Kit(), y0 = gY(C.x, C.z);
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, d = 6 + r() * 34, s2 = 0.8 + r() * 1.8, x = Math.cos(a) * d, z = Math.sin(a) * d, ry = r() * 3;
      let lo = Infinity, hi = -Infinity; for (let q = 0; q < 9; q++) { const b = q / 8 * Math.PI * 2, rx = q === 8 ? 0 : Math.cos(b) * s2 * 1.5, rz = q === 8 ? 0 : Math.sin(b) * s2; const h = gY(C.x + x + rx, C.z + z + rz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo > s2 * 0.5) continue; // encosta forte demais: não põe monte ali
      K.add(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), FM.snow(), x, lo - y0 - 0.12, z, ry, 0, 0, s2 * 1.5, s2 * 0.22 + (hi - lo), s2);
    }
    put(ctx, K, 'neve', C.x, C.z, 0, { occ: false }); }
  for (let k = 0; k < 8; k++) ctx.place(['barrel', 'crate_A', 'crate_B', 'sack'][k % 4], C.x + 12 + (r() - 0.5) * 8, C.z - 12 + (r() - 0.5) * 6, { rf: 0.6 });
  for (const [dx, dz] of [[34, -6], [34, 10]]) { const K = new Kit(); K.cyl(0.12, 0.15, 8, dk, 0, 4, 0, 10); put(ctx, K, 'mastro', C.x + dx, C.z + dz, 0, { box: [[0, 0, 0.2, 0.2]], occ: false }); const b = makeBanner('vigilia', 1.3, 3.2); b.position.set(C.x + dx + 0.12, gY(C.x + dx, C.z + dz) + 7.6, C.z + dz); b.rotation.y = Math.PI / 2; ctx.scene.add(b); }
  frostExpansion(ctx, C, r, wd, dk, st); // S-274: muralha em volta, portão, casas novas e o Torreão com interior
  // ---------- a irmandade de mantos negros (NPCs com roupa de frio) ----------
  const W = (n, dx, dz, yaw) => { const npc = ctx.worldNpc(n, C.x + dx, C.z + dz, yaw); furCloak(npc, { len: n.cloakLen || 1.12 }); return npc; };
  const npcs = [
    [{ id: 'varek', name: 'Comandante Varek', title: 'Senhor-Comandante da Vigília Negra', model: 'Knight', show: ['2H_Sword'], look: { race: 'humano', face: 'valente', hair: { style: 'curto', color: 'grisalho' }, beard: true },
      lines: 'A Muralha está de pé há oito mil invernos, e nós com ela. Juramos vigiar o fim do mundo — e não sair do posto até a morte.\nAlém do gelo há coisas que não dormem. Se quiser ajudar, fale com o Primeiro Batedor Hask: ele precisa de olhos lá fora.' }, 10, -14, -Math.PI / 2],
    [{ id: 'hask', name: 'Hask', title: 'Primeiro Batedor', model: 'Rogue_Hooded', show: ['1H_Crossbow'], look: { race: 'humano', face: 'astuto', hair: { style: 'longo', color: 'preto' }, beard: true },
      lines: 'Subo aquela escada todo amanhecer. Lá de cima dá pra ver a tempestade chegando do oeste — e às vezes umas luzes azuis que não deviam estar lá.\nLobos de gelo andam rondando o vale. Fique atento.' }, 18, 30, Math.PI],
    [{ id: 'mornas', name: 'Intendente Mornas', title: 'Mestre das Provisões', model: 'Barbarian', show: ['Mug'], shopList: 'geral', shopTitle: '🧺 Provisões da Vigília', look: { race: 'anao', face: 'sereno', hair: { style: 'careca', color: 'ruivo' }, beard: true },
      hello: 'Carne salgada, lenha seca e poções que não congelam. Na Muralha, quem não se prepara não volta.' }, 4, -4, Math.PI / 2],
    [{ id: 'edran', name: 'Edran', title: 'Mestre dos Corvos', model: 'Mage', show: ['Spellbook_open'], look: { race: 'humano', face: 'sabio', hair: { style: 'careca', color: 'branco' }, beard: true },
      lines: 'Meus corvos levam as mensagens até Alvorada em dois dias. Mais rápido que qualquer cavalo — menos que um Noctívago, admito.' }, -16, -6, 0.3],
    [{ id: 'bram_v', name: 'Bram', title: 'Construtor da Muralha', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'humano', face: 'gentil', hair: { style: 'raspado', color: 'castanho' }, beard: true },
      lines: 'Cada inverno o gelo racha um pouco, e cada verão a gente remenda. A escada? Fui eu que reconstruí, tábua por tábua.' }, -18, 34, Math.PI / 2],
    [{ id: 'pip_v', name: 'Pip', title: 'Recruta', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'loiro' } }, cloakLen: 0.95,
      lines: 'Primeira semana de vigília. Meus dedos do pé já desistiram de mim. Mas o manto é quentinho!' }, 8, 10, -1.2],
    [{ id: 'ylva', name: 'Ylva', title: 'Cozinheira do Salão', model: 'Barbarian', show: ['Mug'], look: { race: 'humano', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'ruivo' } },
      lines: 'Ensopado de cevada, de novo. Ninguém reclama no terceiro dia de nevasca.' }, 14, -2, -Math.PI / 2],
  ];
  for (const [n, dx, dz, yaw] of npcs) W(n, dx, dz, yaw);
}

/* =========================== entrada =========================== */
// ctx: { scene, place, worldNpc, colliders, occluders, placed, roomAnims, camera }
export function buildCities(ctx) {
  let cullT = -9;
  const anim = { userData: { update: t => { clothT.value = t; if (t - cullT < 0.5) return; cullT = t; const c = ctx.camera.position; if (c.x > HALF + 100) return; /* nas salas (o mundo agora vai até 630) */ for (const g of CULL) { const d = Math.hypot(g.position.x - c.x, g.position.z - c.z); g.visible = d < (g.userData.far || 380); } } } };
  ctx.roomAnims.push(anim); // vento nos estandartes e distância de desenho das cidades
  const dwarf = buildDwarfCity(ctx);
  buildElfCity(ctx);
  // o Porto das Gaivotas é montado por buildPortCity/buildMerchants (js3d/port3d.js), chamados pelo main3d logo depois
  buildFrostHold(ctx);             // S-165: a Muralha Gélida e a Fortaleza da Vigília Negra
  return { refineBoard: dwarf.refineBoard };
}
export { makeBanner, flame, brazier, axeGeo, archBlocks, gable, put, stoneTex, woodTex, roofTex, CULL, DECKS };
