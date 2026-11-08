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
import { heightAt, PORT, DWARF, ELF, SEA, seaDist } from './world3d.js';

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
function buildDwarfCity(ctx) {
  const C = DWARF, r = rngOf(707), st = M.dwarfStone();
  // portão: duas torres atarracadas sobre a estrada (sul) e as estátuas dos guardiões
  { const K = new Kit(), cv = M.dwarfCarve();
    for (const sx of [-1, 1]) { K.box(7, 14, 8, st, sx * 9, 7, 0); K.box(8, 1.2, 9, cv, sx * 9, 14.4, 0); for (let k = -1; k <= 1; k++) K.box(1.6, 1.4, 1.6, cv, sx * 9 + k * 2.6, 15.6, 3.6); for (let k = 0; k < 5; k++) { const yy = 7.6 + k * 0.62; K.box(0.7 - (k % 2) * 0.3, 0.09, 0.08, M.rune(), sx * 9, yy, 4.04); K.box(0.09, 0.42, 0.08, M.rune(), sx * 9 + (k % 2 ? 0.2 : -0.25), yy + 0.25, 4.04, 0, 0, (k % 3 - 1) * 0.5); } }
    K.box(11, 4, 8, st, 0, 12, 0); K.box(12, 1.0, 9, cv, 0, 14.4, 0);
    archBlocks(K, 11, 1.2, 8.4, cv, 0, 6, 0, 0, 15);
    for (const sx of [-1, 1]) K.box(1.0, 6.0, 8.4, cv, sx * 5.4, 3.0, 0);
    for (let k = 0; k < 9; k++) K.box(0.18, 3.2, 0.18, M.iron(), -4 + k, 10.0, 3.4); // grade do portão (levantada)
    put(ctx, K, 'portao_pedrafunda', C.x - 2, C.z + 44, 0.08, { box: [[-9, 0, 3.5, 4], [9, 0, 3.5, 4]] });
    for (const sx of [-1, 1]) { const s = dwarfStatue(5 + sx); put(ctx, s, 'estatua_anao', C.x - 2 + sx * 17, C.z + 47, sx * 0.25, { box: [[0, 0, 2.3, 2.3]] }); }
    for (const sx of [-1, 1]) { const b = makeBanner('anao', 2.2, 6); b.position.set(C.x - 2 + sx * 9 + Math.sin(0.08) * 4.1, gY(C.x, C.z + 44) + 13, C.z + 44 + 4.15); b.rotation.y = 0.08; ctx.scene.add(b); }
  }
  // Salão do Rei-Sob-a-Pedra: fachada esculpida no paredão norte (colunas, frontão, porta de runas)
  { const K = new Kit(), cv = M.dwarfCarve();
    K.box(34, 3, 10, st, 0, 1.5, 0); for (let k = 0; k < 6; k++) K.box(30 - k * 1.6, 0.5, 2, cv, 0, 0.25 + k * 0.5, 6 + k * -0.6); // escadaria
    for (let k = 0; k < 6; k++) { const x = -12.5 + k * 5; K.box(2.4, 1.0, 2.4, cv, x, 3.5, 2); K.cyl(0.95, 1.05, 14, cv, x, 11, 2, 16); K.box(2.6, 1.2, 2.6, cv, x, 18.6, 2); }
    K.box(32, 2.4, 4, cv, 0, 20.4, 2); { const sh = new THREE.Shape(); sh.moveTo(-16, 0); sh.lineTo(16, 0); sh.lineTo(0, 7); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }); g.translate(0, 21.6, 0.5); K.add(g, st); }
    K.box(30, 22, 3, st, 0, 11, -2.5); K.box(7, 9, 0.6, M.darkWood(), 0, 7.5, -0.9); archBlocks(K, 7, 1.0, 1.2, cv, 0, 12, -0.8, 0, 11);
    for (let k = 0; k < 7; k++) K.box(0.35, 0.35, 0.1, M.rune(), -3 + k, 10.2, -0.55); // runas na porta
    for (let k = 0; k < 11; k++) K.box(0.12, 0.8, 0.1, M.rune(), -3 + k * 0.6, 24.2, 3.55, 0, 0, (k % 3 - 1) * 0.4); // inscrição gravada no frontão
    put(ctx, K, 'salao_anao', C.x + 2, C.z - 30, 0, { box: [[0, -1, 17, 4]] });
    for (const sx of [-1, 1]) { const b = makeBanner('anao', 2.4, 9); b.position.set(C.x + 2 + sx * 5, gY(C.x, C.z - 30) + 18.5, C.z - 30 + 3.5); ctx.scene.add(b); }
  }
  // casas em anel, viradas para a praça
  const ring = [[200, 25], [228, 26], [312, 25], [338, 26], [160, 24], [20, 24], [-20, 27]];
  ring.forEach(([deg, rr], i) => { const a = deg * Math.PI / 180, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr, { K, box } = dwarfHouse(40 + i, 7 + r() * 2, 6 + r() * 2); put(ctx, K, 'casa_anao', x, z, Math.atan2(C.x - x, C.z - z), { box }); });
  // moradas escavadas no paredão: fachadas lavradas com porta, janelas acesas e escada de pedra
  [160, 182, 204, 226, 248, 296, 318, 340, 2, 24].forEach((deg, k) => {
    const a = deg * Math.PI / 180, rr = 37.5 + (k % 2) * 1.2, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr, yb = gY(C.x + Math.cos(a) * 33, C.z + Math.sin(a) * 33); // no pé do paredão (o fundo entra na rocha)
    const K = new Kit(), cv = M.dwarfCarve(), lvl = k % 3 === 0 ? 6 : 0;
    K.box(9, 12 + lvl, 4, st, 0, (12 + lvl) / 2 - 1, -1.6); for (const sx of [-1, 1]) K.box(1.1, 10 + lvl, 1.1, cv, sx * 3.6, (10 + lvl) / 2 - 1, 0.6);
    K.box(8.6, 1.0, 1.4, cv, 0, 9 + lvl, 0.5); { const sh = new THREE.Shape(); sh.moveTo(-4.4, 0); sh.lineTo(4.4, 0); sh.lineTo(0, 2.2); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }), cv, 0, 9.5 + lvl, -0.2); }
    K.box(2.2, 3.2, 0.3, M.darkWood(), 0, 1.6 + lvl, 0.45); archBlocks(K, 2.2, 0.5, 0.7, cv, 0, 3.2 + lvl, 0.45, 0, 9);
    for (const sx of [-1, 1]) { K.box(0.8, 1.1, 0.12, M.glass(), sx * 2.2, 5.2 + lvl, 0.42); K.box(1.1, 0.2, 0.5, cv, sx * 2.2, 4.55 + lvl, 0.5); }
    if (lvl) { K.box(9, lvl, 2.2, st, 0, lvl / 2 - 0.2, 1.5); K.box(9.2, 0.3, 2.4, cv, 0, lvl - 0.05, 1.5); for (let s2 = 0; s2 < 12; s2++) K.box(0.55, 0.5 * (s2 + 1), 1.6, cv, -10.3 + s2 * 0.5, 0.25 * (s2 + 1) - 0.2, 1.7); } // sacada e escada lateral até a porta do alto
    put(ctx, K, 'morada_anao', x, z, Math.atan2(C.x - x, C.z - z), { y: yb, box: [[0, -1.6, 4.5, 2]] });
  });
  // ferraria do Brakar (lado leste da praça, frente para o oeste)
  const SM = { x: C.x + 20, z: C.z + 8, ry: -Math.PI / 2 };
  smithy(ctx, SM.x, SM.z, SM.ry);
  // praça: braseiros, banca de armas, barris e o poço de lava (fonte quente)
  { const K = new Kit(), cv = M.dwarfCarve(); K.cyl(4.4, 4.8, 0.9, cv, 0, 0.3, 0, 32); K.cyl(3.6, 3.6, 0.1, M.ember(), 0, 0.72, 0, 32); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.box(0.8, 2.2, 0.8, cv, Math.cos(a) * 4.6, 1.1, Math.sin(a) * 4.6, -a); }
    const g = put(ctx, K, 'forja_da_praca', C.x, C.z + 4, 0, { box: [[0, 0, 4.8, 4.8]] }); const L = vlight('#ff7a2a', 6, 18, 1.5); L.position.set(0, 2, 0); g.add(L); const f = flame(3.2, 9); f.position.y = 0.7; g.add(f); ctx.roomAnims.push(f); }
  for (const [dx, dz] of [[-10, 14], [8, 16], [-14, -8], [12, -12], [-6, 34], [4, 34]]) brazier(ctx, C.x + dx, gY(C.x + dx, C.z + dz), C.z + dz, (dx === -10 || dx === 12), dx);
  { const K = new Kit(), wd = M.darkWood(); K.box(5, 0.9, 1.6, wd, 0, 0.45, 0); K.box(5.4, 0.12, 2.0, wd, 0, 0.95, 0); for (const sx of [-2.4, 2.4]) K.box(0.18, 2.6, 0.18, wd, sx, 1.3, -0.8); K.box(5.2, 0.1, 2.2, plain('canvasRed', '#8a2a1e', { rough: 0.9 }), 0, 2.6, -0.2, 0, -0.25);
    for (let k = 0; k < 5; k++) for (const g of axeGeo(1.1, 0.3)) K.add(g, k % 2 ? M.steel() : M.iron(), -2 + k, 1.0, 0.3, 0.3, Math.PI / 2 - 0.15, 0);
    for (let k = 0; k < 3; k++) K.add(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24), M.iron(), -1.5 + k * 1.5, 1.6, -0.75, 0, Math.PI / 2 - 0.2, 0); // escudos redondos
    put(ctx, K, 'banca_de_armas', C.x - 14, C.z + 2, Math.PI / 2, { box: [[0, 0, 2.6, 1]] }); }
  for (let k = 0; k < 10; k++) { const a = r() * Math.PI * 2, rr = 12 + r() * 16; ctx.place(r() < 0.5 ? 'barrel' : 'crate_A', C.x + Math.cos(a) * rr, C.z + Math.sin(a) * rr, { rf: 0.6 }); }
  // NPCs: anões (quase todos)
  const W = (n, dx, dz, yaw) => ctx.worldNpc(n, C.x + dx, C.z + dz, yaw);
  const brakar = { id: 'brakar', name: 'Mestre Brakar', title: 'Refinador de Pedrafunda', model: 'Barbarian', show: ['1H_Axe'], refine: true, look: { race: 'anao', face: 'valente', hair: { style: 'careca', color: 'ruivo' }, beard: true },
    hello: 'Hmpf! Mais um que quer ver o aço cantar. Traga a arma ou a armadura, o minério e o zeny, e eu esquento a forja.' };
  const npcs = [
    [brakar, 18.2, 8.5, -Math.PI / 2],
    [{ id: 'thorga', name: 'Thorga', title: 'Guardiã do Portão', model: 'Knight', show: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'], hat: true, look: { race: 'anao', sex: 'f', face: 'valente', hair: { style: 'coque', color: 'ruivo' } },
      lines: 'Alto lá! Ah, é só um viajante. Bem-vindo a Pedrafunda, a cidade sob os picos.\nAqui todo anão nasce com um machado na mão. Se quer equipamento de verdade, fale com o Mestre Brakar na ferraria.' }, -6, 38, Math.PI],
    [{ id: 'durgan', name: 'Rei Dúrgan', title: 'Senhor de Pedrafunda', model: 'Knight', show: ['2H_Sword', 'Knight_Cape'], look: { race: 'anao', face: 'sereno', hair: { style: 'longo', color: 'grisalho' }, beard: true },
      lines: 'Meu povo cava a montanha há mil invernos. Os picos à nossa volta são os mais altos de Aethra: nada passa por eles sem a nossa permissão.\nDizem que lá no sul, nos Campos de Valcinza, os humanos ergueram um castelo enorme... Pedra mole, pedra de planície.' }, 2, -22, 0],
    [{ id: 'bofur', name: 'Bárdin', title: 'Mercador de Machados', model: 'Barbarian', show: ['2H_Axe', 'Barbarian_Cape'], shopList: 'geral', shopTitle: '🪓 Machados de Pedrafunda', look: { race: 'anao', face: 'alegre', hair: { style: 'curto', color: 'castanho_escuro' }, beard: true },
      hello: 'Machado bom é machado anão! Olhe à vontade, mas cuidado com o fio.' }, -12, 2, Math.PI / 2],
    [{ id: 'helga', name: 'Helga', title: 'Taverneira da Bigorna Bêbada', model: 'Barbarian', show: ['Mug'], look: { race: 'anao', sex: 'f', face: 'alegre', hair: { style: 'longo', color: 'loiro' } },
      lines: 'Cerveja de cogumelo das cavernas, a melhor do mundo! Quem diz o contrário nunca provou.\nO Brakar? Já quebrou mais espada do que consertou — mas as que aguentam ficam lendárias.' }, -18, -12, 0.6],
    [{ id: 'grum', name: 'Grum', title: 'Soldado de Pedrafunda', model: 'Knight', show: ['1H_Sword', 'Rectangle_Shield', 'Knight_Helmet'], hat: true, look: { race: 'anao', face: 'valente', hair: { style: 'raspado', color: 'preto' }, beard: true },
      lines: 'Três turnos de guarda e ainda nenhum troll. Que tédio.' }, 6, 30, Math.PI],
    [{ id: 'oldra', name: 'Oldra', title: 'Mineira', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', sex: 'f', face: 'astuto', hair: { style: 'curto', color: 'castanho' } },
      lines: 'O minério que o Brakar usa sai das galerias lá do fundo. Brilha no escuro, sabia? A gente chama de "pedra-fagulha".' }, 14, -14, -0.8],
    [{ id: 'lian_vis', name: 'Lian', title: 'Viajante humano', model: 'Rogue', look: { race: 'humano', face: 'gentil', hair: { style: 'curto', color: 'castanho' } },
      lines: 'Subi a estrada da Geada só para ver as forjas. Valeu cada passo — e cada calo.' }, -4, 18, 2.4],
    // S-163: mais gente de Pedrafunda pelas ruas
    [{ id: 'korvin', name: 'Korvin', title: 'Joalheiro das Profundezas', model: 'Barbarian', look: { race: 'anao', face: 'astuto', hair: { style: 'longo', color: 'preto' }, beard: true },
      lines: 'Rubis do coração da montanha, lapidados à luz da forja. Quer ver? Olhe, mas não toque.' }, -20, 6, 1.2],
    [{ id: 'brunna', name: 'Brunna', title: 'Mestre-Cervejeira', model: 'Barbarian', show: ['Mug'], look: { race: 'anao', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'ruivo' } },
      lines: 'A cevada vem das colinas, o cogumelo vem das cavernas e o segredo vem da minha avó.' }, -22, -6, 0.9],
    [{ id: 'torvald', name: 'Torvald', title: 'Veterano da Guarda', model: 'Knight', show: ['2H_Axe', 'Knight_Helmet'], hat: true, look: { race: 'anao', face: 'valente', hair: { style: 'curto', color: 'grisalho' }, beard: true },
      lines: 'Quarenta invernos de guarda nesse portão. Já vi troll, dragão de gelo e até humano educado.' }, 10, 38, Math.PI],
    [{ id: 'nim', name: 'Nim', title: 'Aprendiz de Ferreiro', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', face: 'alegre', hair: { style: 'raspado', color: 'castanho' } },
      lines: 'O Mestre Brakar diz que eu ainda não sei segurar o martelo. Mas já sei carregar o carvão!' }, 14, 4, -1.4],
    [{ id: 'gudrun', name: 'Gudrun', title: 'Anciã do Clã', model: 'Mage', look: { race: 'anao', sex: 'f', face: 'sabio', hair: { style: 'longo', color: 'branco' } },
      lines: 'Nossos avós cavaram estas casas na rocha quando o mundo ainda era jovem. Cada runa nas portas conta uma história.' }, -2, -12, 0],
  ];
  for (const [n, dx, dz, yaw] of npcs) W(n, dx, dz, yaw);
  // quadro do refino: parede leste do galpão (por dentro), virada para o oeste — onde o main3d pendura a tabela
  const cs = Math.cos(SM.ry), sn = Math.sin(SM.ry), lx = 4.2, lz = -3.84; // moldura de madeira na parede do fundo, à direita da forja
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
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); K.add(g, M.leaf(), Math.cos(a) * rr, y, Math.sin(a) * rr, 0, 0, 0, s, s, s);
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
  for (let k = 0; k < 46; k++) { const a = r() * Math.PI * 2, rr = 46 + r() * 30, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr; if (Math.abs(x - C.x) < 8 && z > C.z) continue; ctx.place((r() < 0.6 ? 'oakdark_' : 'pinedark_') + Math.floor(r() * 3), x, z, { scale: 1.1 + r() * 0.6 }); }
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

/* =========================== PORTO DAS GAIVOTAS (litoral) =========================== */
// casa do porto: paredes caiadas com enxaimel de madeira escura, telhado de palha ou de barro, alpendre
function portHouse(seed) {
  const K = new Kit(), r = rngOf(seed), w = 6 + r() * 2.5, d = 5.5 + r() * 2, h = 3.2 + r() * 0.8, pl = M.plaster(), wd = M.darkWood(), thatch = r() < 0.5;
  K.box(w + 0.6, 0.9, d + 0.6, M.greyStone(), 0, -0.2, 0); K.box(w, h, d, pl, 0, 0.25 + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.28, h, 0.28, wd, sx * w / 2, 0.25 + h / 2, sz * d / 2);
  for (const sz of [-1, 1]) { K.box(w, 0.22, 0.25, wd, 0, 0.25 + h, sz * d / 2); K.box(w, 0.18, 0.25, wd, 0, 0.25 + h * 0.5, sz * d / 2); for (let k = -1; k <= 1; k += 2) K.box(0.18, h * 0.62, 0.22, wd, k * w / 4, 0.25 + h * 0.5, sz * d / 2, 0, 0, k * 0.6); }
  gable(K, w + 0.2, d + 0.2, 2.2 + r() * 0.5, thatch ? M.thatch() : M.clay(), 0, 0.25 + h, 0, 0, thatch ? 0.7 : 0.45);
  K.box(1.3, 2.2, 0.2, M.wood(), -w / 4, 1.35, d / 2 + 0.08); K.box(1.0, 0.9, 0.12, M.glass(), w / 4, 2.0, d / 2 + 0.05);
  for (const sx of [-1, 1]) K.box(0.5, 1.0, 0.08, plain('shutter', '#3e6a8a', { rough: 0.8 }), w / 4 + sx * 0.78, 2.0, d / 2 + 0.1, 0, 0, 0);
  K.box(w * 0.6, 0.12, 1.6, M.wood(), 0, 2.7, d / 2 + 0.8, 0, -0.2); for (const sx of [-1, 1]) K.box(0.16, 2.6, 0.16, wd, sx * w * 0.28, 1.4, d / 2 + 1.5); // alpendre
  return { K, box: [[0, 0, w / 2 + 0.3, d / 2 + 0.3]] };
}
// casco de barco (seções em U), com bancos e remos; veleiro maior com mastro e vela
function boat(len = 6, sail = false, seed = 1) {
  const K = new Kit(), r = rngOf(seed), wd = M.wood(), dark = M.darkWood(), W = len * 0.3, H = len * 0.16, SEG = 18, RS = 10;
  const pos = [], idx = [];
  for (let i = 0; i <= SEG; i++) { const t = i / SEG, z = (t - 0.5) * len, wk = Math.pow(Math.sin(t * Math.PI), 0.55), hk = 1 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.35;
    for (let j = 0; j <= RS; j++) { const a = j / RS * Math.PI; pos.push(Math.cos(a) * W * wk, H * hk - Math.sin(a) * H * (0.4 + wk * 0.6), z); } }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setIndex(idx); hull.computeVertexNormals();
  K.add(hull, wd); const inner = hull.clone(); inner.scale(0.94, 0.94, 0.97); inner.translate(0, 0.04, 0); { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } inner.computeVertexNormals(); } K.add(inner, dark);
  K.add(new THREE.TorusGeometry(1, 0.05, 6, 32), dark, 0, H * 1.02, 0, 0, Math.PI / 2, 0, W, len * 0.5, 1); // borda
  for (let k = -1; k <= 1; k++) K.box(W * 1.6, 0.08, 0.3, dark, 0, H * 0.55, k * len * 0.22);
  K.cyl(0.05, 0.05, len * 0.5, wd, W * 0.7, H * 0.9, 0.2, 8, 0.3, Math.PI / 2 - 0.3);
  if (sail) {
    K.cyl(0.09, 0.12, len * 1.15, wd, 0, H + len * 0.55, -len * 0.05, 10); K.cyl(0.06, 0.06, len * 0.55, wd, 0, H + len * 0.32, -len * 0.05, 8, 0, Math.PI / 2);
    const sl = new THREE.PlaneGeometry(len * 0.5, len * 0.75, 6, 8), P = sl.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin((P.getY(i) / (len * 0.75) + 0.5) * Math.PI) * 0.35); sl.computeVertexNormals();
    K.add(sl, plain('sail', '#efe6cf', { rough: 0.9, side: THREE.DoubleSide }), 0, H + len * 0.7, -len * 0.05 + 0.25, Math.PI / 2);
  }
  return K;
}
// palmeira: tronco curvo em anéis e folhas compridas penduradas
function palm(seed) {
  const K = new Kit(), r = rngOf(seed), H = 7 + r() * 4, lean = 0.8 + r() * 1.4, bark = M.bark();
  const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(Math.pow(t, 1.6) * lean * 2, t * H, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts); K.add(new THREE.TubeGeometry(curve, 24, 0.22, 10), bark);
  for (let k = 0; k < 12; k++) { const p = curve.getPoint(k / 12); K.add(new THREE.TorusGeometry(0.24, 0.05, 6, 14), bark, p.x, p.y, 0, 0, Math.PI / 2); }
  const top = curve.getPoint(1), leafM = plain('palmLeaf', '#4f8a34', { rough: 0.7, side: THREE.DoubleSide });
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + r(), len = 3.4 + r() * 1.2, g = new THREE.PlaneGeometry(len, 0.9, 12, 2), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) + len / 2, y = P.getY(i), w = Math.sin(x / len * Math.PI) * (0.4 + 0.6 * (1 - x / len)); P.setXYZ(i, x, -Math.pow(x / len, 2) * 2.0 + Math.abs(y) * 0.4, y * w); }
    g.computeVertexNormals(); K.add(g, leafM, top.x, top.y, 0, a, 0, 0.15);
  }
  for (let k = 0; k < 4; k++) K.add(new THREE.SphereGeometry(0.17, 12, 10), plain('coconut', '#5a3a1e'), top.x + Math.cos(k * 1.6) * 0.25, top.y - 0.25, Math.sin(k * 1.6) * 0.25);
  return K;
}
// farol listrado em pedra, lanterna de vidro com luz
function lighthouse() {
  const K = new Kit(), H = 18;
  K.add(new THREE.CylinderGeometry(3.2, 4.2, 2.0, 24), M.greyStone(), 0, 0.5, 0);
  for (let k = 0; k < 6; k++) { const y0 = 1.5 + k * H / 6, t0 = k / 6, t1 = (k + 1) / 6; K.add(new THREE.CylinderGeometry(2.6 - t1 * 1.0, 2.6 - t0 * 1.0, H / 6, 28), k % 2 ? plain('lhRed', '#a8322a', { rough: 0.7 }) : M.plaster(), 0, y0 + H / 12, 0); }
  K.cyl(2.2, 2.0, 0.4, M.iron(), 0, H + 1.7, 0, 28); K.add(new THREE.TorusGeometry(2.1, 0.05, 6, 32), M.iron(), 0, H + 2.7, 0, 0, Math.PI / 2);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; K.cyl(0.04, 0.04, 1.0, M.iron(), Math.cos(a) * 2.1, H + 2.3, Math.sin(a) * 2.1, 6); }
  K.cyl(1.1, 1.1, 2.2, plain('lhGlass', '#fff3c8', { emissive: '#ffd27a', ei: 1.8, rough: 0.1 }), 0, H + 3.0, 0, 20);
  K.add(new THREE.ConeGeometry(1.5, 1.8, 20), M.copper(), 0, H + 5.0, 0);
  K.box(1.2, 2.0, 0.2, M.wood(), 0, 2.0, 3.85);
  return K;
}
// tablados onde dá para andar (cais): o main3d usa deckAt no groundAt
const DECKS = [];
export function deckAt(x, z) {
  for (const d of DECKS) { const dx = x - d.x, dz = z - d.z, cs = Math.cos(d.yaw), sn = Math.sin(d.yaw), lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) <= d.w / 2 && lz >= -0.3 && lz <= d.len) return d.y; }
  return null;
}
// cais: tábuas sobre estacas, com cordas e cabeços de amarração
function pier(len = 34, w = 3.2) {
  const K = new Kit(), wd = M.wood();
  for (let z = 0; z < len; z += 0.42) K.box(w, 0.1, 0.38, wd, 0, 0, z + 0.21, 0, 0, (Math.sin(z * 7) * 0.012));
  for (let z = 1.5; z < len; z += 3) for (const sx of [-1, 1]) { K.cyl(0.16, 0.18, 4.2, M.darkWood(), sx * (w / 2 - 0.1), -1.6, z, 10); }
  for (let z = 4; z < len; z += 9) for (const sx of [-1, 1]) { K.cyl(0.13, 0.15, 0.6, M.iron(), sx * (w / 2 - 0.3), 0.3, z, 12); K.add(new THREE.TorusGeometry(0.17, 0.04, 6, 14), M.rope(), sx * (w / 2 - 0.3), 0.45, z, 0, Math.PI / 2); }
  return K;
}
function fishStand(seed) {
  const K = new Kit(), r = rngOf(seed), wd = M.wood();
  K.box(3.2, 0.9, 1.4, wd, 0, 0.45, 0); for (const sx of [-1.5, 1.5]) for (const sz of [-0.6, 0.6]) K.box(0.12, 2.6, 0.12, wd, sx, 1.3, sz);
  K.box(3.6, 0.08, 1.9, plain('awning', '#2e5ea0', { rough: 0.9 }), 0, 2.6, 0, 0, -0.18);
  for (let k = 0; k < 9; k++) { const g = new THREE.SphereGeometry(0.12, 12, 8); g.scale(0.5, 0.45, 2.0); K.add(g, plain('fish' + (k % 3), ['#9fb3c0', '#c98a5a', '#7a8e9a'][k % 3], { metal: 0.4, rough: 0.35 }), -1.2 + (k % 5) * 0.6, 0.98, -0.3 + Math.floor(k / 5) * 0.5, 0.2 * r()); K.add(new THREE.ConeGeometry(0.1, 0.18, 8), plain('fishT', '#6a7e8a'), -1.2 + (k % 5) * 0.6, 0.98, -0.3 + Math.floor(k / 5) * 0.5 - 0.45, 0, -Math.PI / 2); }
  K.box(3.0, 0.06, 1.2, plain('ice', '#dff2f8', { rough: 0.3 }), 0, 0.92, 0);
  return K;
}
function buildPortTown(ctx) {
  const C = PORT, r = rngOf(515), u = { x: SEA.x - C.x, z: SEA.z - C.z }, ul = Math.hypot(u.x, u.z); u.x /= ul; u.z /= ul; // u: direção do mar
  const yawSea = Math.atan2(u.x, u.z);
  // linha da praia na direção do mar
  let s0 = 0; while (seaDist(C.x + u.x * s0, C.z + u.z * s0) > 1.5 && s0 < 120) s0 += 0.5;
  const B = { x: C.x + u.x * s0, z: C.z + u.z * s0 };
  // três cais saindo da praia mar adentro, com barcos amarrados e um veleiro
  const side = { x: u.z, z: -u.x };
  [-16, 0, 16].forEach((o, i) => {
    const px = B.x + side.x * o - u.x * 4, pz = B.z + side.z * o - u.z * 4, len = i === 1 ? 44 : 30;
    put(ctx, pier(len, i === 1 ? 4 : 3), 'cais', px, pz, yawSea, { y: SEA.level + 1.1, occ: false }); DECKS.push({ x: px, z: pz, yaw: yawSea, len, w: i === 1 ? 4 : 3, y: SEA.level + 1.15 });
    for (let k = 0; k < 1 + i % 2; k++) { const bz = 10 + k * 11, sd = (k % 2 ? 1 : -1) * 3.6; const bx = px + u.x * bz + side.x * sd, bzz = pz + u.z * bz + side.z * sd; const bk = boat(5 + r() * 2, false, 30 + i * 3 + k); const g = put(ctx, bk, 'barco', bx, bzz, yawSea + (r() - 0.5) * 0.3, { y: SEA.level - 0.32, occ: false }); g.userData.update = t => { g.position.y = SEA.level - 0.32 + Math.sin(t * 1.1 + bx) * 0.07; g.rotation.z = Math.sin(t * 0.9 + bzz) * 0.04; }; ctx.roomAnims.push(g); }
  });
  { const px = B.x + u.x * 34 - side.x * 6, pz = B.z + u.z * 34 - side.z * 6; const g = put(ctx, boat(13, true, 77), 'veleiro', px, pz, yawSea + Math.PI / 2, { y: SEA.level - 0.6, occ: false }); g.userData.update = t => { g.position.y = SEA.level - 0.6 + Math.sin(t * 0.7) * 0.12; g.rotation.z = Math.sin(t * 0.6) * 0.05; g.rotation.x = Math.sin(t * 0.5 + 1) * 0.02; }; ctx.roomAnims.push(g); }
  // farol numa ponta de pedras ao lado do porto
  { const lx = B.x + side.x * 38 + u.x * 2, lz = B.z + side.z * 38 + u.z * 2; for (let k = 0; k < 8; k++) ctx.place('rock_' + 'ABCDE'[k % 5], lx + (r() - 0.5) * 9, lz + (r() - 0.5) * 9, { scale: 1.2 + r() * 1.2 });
    const g = put(ctx, lighthouse(), 'farol', lx, lz, yawSea, { y: Math.max(gY(lx, lz), SEA.level + 0.3), box: [[0, 0, 3.5, 3.5]] }); const L = vlight('#ffd27a', 6, 30, 1.4); L.position.set(0, 21, 0); g.add(L); }
  // casas viradas para a praça (atrás da praia)
  const back = { x: -u.x, z: -u.z };
  const spots = [[-22, 6], [-11, 12], [0, 15], [11, 12], [22, 6], [-26, -8], [26, -8], [-14, 26], [14, 26]];
  spots.forEach(([o, dd], i) => { const x = C.x + side.x * o + back.x * dd, z = C.z + side.z * o + back.z * dd, { K, box } = portHouse(80 + i); put(ctx, K, 'casa_do_porto', x, z, Math.atan2(C.x - x, C.z - z) * 0.4 + yawSea * 0.6, { box }); });
  // mercado de peixe e redes
  for (const [o, dd] of [[-8, -4], [8, -4], [0, -8]]) put(ctx, fishStand(o + 50), 'banca_de_peixe', C.x + side.x * o + back.x * dd, C.z + side.z * o + back.z * dd, yawSea + Math.PI, { box: [[0, 0, 1.6, 0.8]] });
  { const K = new Kit(); for (let k = 0; k < 3; k++) { K.cyl(0.08, 0.08, 2.4, M.darkWood(), k * 2.6, 1.2, 0, 8); } const net = new THREE.PlaneGeometry(5.2, 1.8, 12, 4), P = net.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 1.2) * 0.2 - Math.pow(Math.sin((P.getX(i) / 2.6) * Math.PI), 2) * 0.2); net.computeVertexNormals(); K.add(net, plain('net', '#6a5a3a', { rough: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }), 2.6, 1.4, 0);
    put(ctx, K, 'redes_de_pesca', C.x + side.x * -30 + back.x * -12, C.z + side.z * -30 + back.z * -12, yawSea + Math.PI / 2, { occ: false }); }
  for (let k = 0; k < 12; k++) { const o = (r() - 0.5) * 50, dd = -2 - r() * 10; ctx.place(['barrel', 'crate_A', 'crate_B', 'sack'][k % 4], C.x + side.x * o + back.x * dd, C.z + side.z * o + back.z * dd, { rf: 0.6 }); }
  for (let k = 0; k < 14; k++) { const o = (r() - 0.5) * 110, dd = -6 + (r() - 0.5) * 18, x = C.x + side.x * o + back.x * dd, z = C.z + side.z * o + back.z * dd; if (Math.abs(o) < 30 && dd < 4) continue; put(ctx, palm(200 + k), 'palmeira', x, z, r() * 6, { box: [[0, 0, 0.3, 0.3]], occ: false }); }
  for (const sx of [-1, 1]) { const b = makeBanner('porto', 1.0, 2.6); const x = C.x + side.x * sx * 4 + back.x * 18, z = C.z + side.z * sx * 4 + back.z * 18; const K = new Kit(); K.cyl(0.1, 0.12, 7, M.darkWood(), 0, 3.5, 0, 10); put(ctx, K, 'mastro', x, z, 0, { box: [[0, 0, 0.2, 0.2]], occ: false }); b.position.set(x, gY(x, z) + 6.6, z + 0.15); b.rotation.y = yawSea; ctx.scene.add(b); }
  // NPCs: humanos do litoral
  const P = (o, dd) => ({ x: C.x + side.x * o + back.x * dd, z: C.z + side.z * o + back.z * dd });
  const npcs = [
    [{ id: 'marinha', name: 'Capitã Marinha', title: 'Mestre do Porto', model: 'Knight', show: ['1H_Sword', 'Knight_Cape'], look: { race: 'humano', sex: 'f', face: 'valente', hair: { style: 'longo', color: 'castanho_escuro' }, skin: 'escura' },
      lines: 'Bem-vindo ao Porto das Gaivotas, o único pedaço de Aethra onde se sente cheiro de sal!\nOs barcos saem ao amanhecer. Um dia vamos navegar para além do horizonte — dizem que há ilhas lá fora.' }, 0, 2],
    [{ id: 'joca', name: 'Joca', title: 'Pescador', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'grisalho' }, beard: true },
      lines: 'Hoje o mar tá generoso! Peguei um peixe-lua deste tamanho... tá bom, deste tamanho.' }, -9, -6],
    [{ id: 'iara', name: 'Iara', title: 'Peixeira', model: 'Rogue', show: ['Knife'], shopList: 'geral', shopTitle: '🐟 Mercado do Porto', look: { race: 'humano', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'preto' }, skin: 'escura' },
      hello: 'Peixe fresquinho, sal, corda, isca... e compro o que você trouxer da estrada!' }, 8, -6],
    [{ id: 'tonho', name: 'Tonho', title: 'Construtor de Barcos', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'humano', face: 'gentil', hair: { style: 'raspado', color: 'ruivo' }, beard: true },
      lines: 'Madeira boa vem de Aelindra, mas os elfos não gostam que a gente corte as árvores deles. Então a gente compra das colinas mesmo.' }, -24, -2],
    [{ id: 'lena', name: 'Lena', title: 'Faroleira', model: 'Mage', show: ['Mage_Cape'], look: { race: 'humano', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'loiro' } },
      lines: 'Toda noite subo os 120 degraus do farol para acender a lanterna. Nenhum barco se perde enquanto eu estiver aqui.' }, 34, -2],
    [{ id: 'nilo', name: 'Nilo', title: 'Marujo', model: 'Rogue', show: ['Knife_Offhand'], look: { race: 'humano', face: 'astuto', hair: { style: 'careca', color: 'preto' }, skin: 'escura' },
      lines: 'Já vi uma serpente do mar maior que o veleiro da capitã! Ninguém acredita em mim...' }, 4, -14],
    [{ id: 'fenn_vis', name: 'Fenn', title: 'Elfo comerciante de sal', model: 'Rogue_Hooded', look: { race: 'elfo', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
      lines: 'O sal daqui é o mais puro de Aethra. Levo para Aelindra, onde vira tinta para os estandartes.' }, -14, 6],
  ];
  for (const [n, o, dd] of npcs) { const p = P(o, dd); ctx.worldNpc(n, p.x, p.z, yawSea + Math.PI + (r() - 0.5)); }
  return { beach: B, yawSea };
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
    const r = rngOf(61); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e8f4fb'); gr.addColorStop(1, '#a9cde2'); g.fillStyle = gr; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
    let y = 0; while (y < H) { const h = 6 + r() * 26, l = 78 + r() * 16; g.fillStyle = `hsla(${198 + r() * 12}, ${28 + r() * 25}%, ${l}%, 0.55)`; g.fillRect(0, y, W, h); gb.fillStyle = `rgb(${110 + r() * 60 | 0},${110 + r() * 60 | 0},${110 + r() * 60 | 0})`; gb.fillRect(0, y, W, h); g.fillStyle = 'rgba(70,110,140,0.25)'; g.fillRect(0, y + h - 1.5, W, 1.5); y += h; } // estratos (camadas de invernos)
    for (let k = 0; k < 140; k++) { const x0 = r() * W, y0 = r() * H, L = 20 + r() * 120; g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,100,130'},${0.15 + r() * 0.25})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + (r() - 0.5) * 30, y0 + L * 0.3, x0 + (r() - 0.5) * 30, y0 + L * 0.7, x0 + (r() - 0.5) * 20, y0 + L); g.stroke(); gb.strokeStyle = 'rgba(30,30,30,0.6)'; gb.lineWidth = 1.5; gb.stroke(); } // fendas e escorridos
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.35})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2); }
  });
}
const FM = {
  ice: () => MATS.ice || (MATS.ice = (() => { const t = TEX.ice || (TEX.ice = iceTex()); for (const x of [t.map, t.bump]) x.repeat.set(1, 1); const m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 4, roughness: 0.5, metalness: 0.02, color: '#ffffff', vertexColors: true, emissive: '#0c2438', emissiveIntensity: 0.25 }); m.userData.tile = 24; return m; })()),
  snow: () => plain('snow', '#f1f5f9', { rough: 0.9 }),
  icicle: () => plain('icicle', '#cfe6f4', { rough: 0.15, metal: 0.05, transparent: true, opacity: 0.85 }),
  blackWool: () => plain('blackWool', '#16151a', { rough: 1 }),
  fur: () => plain('furCloak', '#5c4a3a', { rough: 1 }),
  rawWood: () => texMat('rawWood', () => woodTex({ base: [26, 26, 26], seed: 71 }), 2.2, { bump: 3 }),
  darkStone: () => texMat('frostStone', () => stoneTex({ base: [210, 6, 34], mortar: '#1c1e22', rows: [40, 60], wide: [60, 140], seed: 73 }), 4),
};
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
  const SX = 150, SY = 40, pos = [], idx = [], uv = [], Hz = z => H * (0.6 + 0.4 * Math.min(1, Math.max(0, (len / 2 - Math.abs(z)) / 50)));
  const faceX = (y, z, hz) => { const v = (y + 6) / hz, band = y / 7.3, ledge = Math.pow(Math.max(0, Math.sin((band - Math.floor(band)) * Math.PI)), 6) * 0.9;
    const crev = -2.2 * Math.pow(Math.max(0, Math.sin(z * 0.19 + Math.sin(y * 0.05) * 0.6)), 28) - 1.4 * Math.pow(Math.max(0, Math.sin(z * 0.071 + 2)), 40);
    return -v * H * 0.12 + Math.sin(z * 0.045 + y * 0.03) * 1.1 + Math.sin(y * 1.3 + z * 0.05) * 0.18 + ledge + crev + Math.sin(z * 0.9 + y * 0.7) * 0.08; };
  for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
    const u = i / SX, v = j / SY, z = (u - 0.5) * len, hz = Hz(z), y = v * hz - 6;
    pos.push(faceX(y, z, hz), y + (v > 0.98 ? Math.sin(z * 0.43) * 0.8 : 0), z); uv.push(z / 30, y / 14);
  }
  for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) { const a = j * (SX + 1) + i, b = a + SX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // cor: gelo azul-acinzentado, fendas e reentrâncias azul profundo, beiradas e topo quase brancos
  const col = [], cA = new THREE.Color('#9fbfd4'), cDeep = new THREE.Color('#3f6f94'), cHi = new THREE.Color('#eef6fb'), tc = new THREE.Color();
  for (let k = 0; k < pos.length; k += 3) { const x = pos[k], y = pos[k + 1], z = pos[k + 2], hz = Hz(z), base = -((y + 6) / hz) * H * 0.12, d = x - base;
    tc.copy(cA).lerp(cDeep, Math.min(1, Math.max(0, -d - 0.4) * 0.45)).lerp(cHi, Math.min(1, Math.max(0, d - 0.3) * 0.5) * 0.8);
    tc.offsetHSL(0, 0, Math.sin(y * 2.1 + z * 0.13) * 0.025 + ((y + 6) / hz > 0.9 ? 0.08 : 0)); col.push(tc.r, tc.g, tc.b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const grp = new THREE.Group(), face = new THREE.Mesh(g, FM.ice()); face.receiveShadow = true; grp.add(face);
  // topo: faixa de neve com borda irregular, da beirada até o fundo
  const tp = [], ti = [];
  for (let i = 0; i <= SX; i++) { const z = (i / SX - 0.5) * len, hz = Hz(z), y = hz - 6, x0 = faceX(y, z, hz); tp.push(x0 + 0.6, y + 0.2 + Math.sin(z * 0.43) * 0.8, z, x0 - 3, y + 1.0 + Math.sin(z * 0.2) * 0.3, z, x0 - D, y + 0.6, z); }
  for (let i = 0; i < SX; i++) for (let c = 0; c < 2; c++) { const a = i * 3 + c, b = a + 3; ti.push(a, a + 1, b, b, a + 1, b + 1); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setIndex(ti); tg.computeVertexNormals(); const top = new THREE.Mesh(tg, FM.snow()); top.material.side = THREE.DoubleSide; grp.add(top);
  return grp;
}
// monta com coordenadas do mundo e coloca o grupo no centro dado (para a distância de desenho funcionar)
function putAbs(ctx, K, asset, cx, cz, opts = {}) { for (const { geos } of K.parts.values()) for (const g of geos) g.translate(-cx, 0, -cz); return put(ctx, K, asset, cx, cz, 0, { y: 0, ...opts }); }
function buildFrostHold(ctx) {
  const C = FROST, r = rngOf(4242), wd = FM.rawWood(), dk = M.darkWood(), st = FM.darkStone();
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
  { const K = new Kit(); K.box(12, 0.3, 6, wd, 0, 0, 0); for (const px of [-5.8, -2, 2, 5.8]) for (const pz of [-2.8, 2.8]) K.box(0.3, 3.2, 0.3, dk, px, 1.6, pz); snowRoof(K, 12.4, 6.6, 1.6, M.thatch(), 0, 3.2, 0, 0);
    for (let k = 0; k < 3; k++) K.box(0.12, 1.2, 5.4, dk, -4 + k * 4, 0.7, 0); for (let k = 0; k < 4; k++) K.box(1.1, 0.5, 0.6, plain('hay', '#c9a85a', { rough: 1 }), -5 + k * 3.2, 0.4, 2.2);
    put(ctx, K, 'estabulo_da_vigilia', C.x + 26, C.z + 12, Math.PI / 2, { box: [[0, 0, 6.2, 3.2]] }); }
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
  { const K = new Kit(); for (let k = 0; k < 26; k++) { const a = r() * Math.PI * 2, d = 6 + r() * 34, s2 = 0.8 + r() * 2.2, x = Math.cos(a) * d, z = Math.sin(a) * d; K.add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), FM.snow(), x, gY(C.x + x, C.z + z) - gY(C.x, C.z) - 0.15, z, r() * 3, 0, 0, s2 * 1.5, s2 * 0.35, s2); } put(ctx, K, 'neve', C.x, C.z, 0, { occ: false }); }
  for (let k = 0; k < 8; k++) ctx.place(['barrel', 'crate_A', 'crate_B', 'sack'][k % 4], C.x + 12 + (r() - 0.5) * 8, C.z - 12 + (r() - 0.5) * 6, { rf: 0.6 });
  for (const [dx, dz] of [[34, -6], [34, 10]]) { const K = new Kit(); K.cyl(0.12, 0.15, 8, dk, 0, 4, 0, 10); put(ctx, K, 'mastro', C.x + dx, C.z + dz, 0, { box: [[0, 0, 0.2, 0.2]], occ: false }); const b = makeBanner('vigilia', 1.3, 3.2); b.position.set(C.x + dx + 0.12, gY(C.x + dx, C.z + dz) + 7.6, C.z + dz); b.rotation.y = Math.PI / 2; ctx.scene.add(b); }
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

/* =========================== PORTO DAS GAIVOTAS: bairro dos mercadores (S-175) ===========================
   Cidade portuária de comércio (inspiração de sensação: o grande porto mercante dos MMOs clássicos):
   Guilda dos Mercadores com cúpula, armazéns de carga, guindastes no cais, um galeão mercante,
   a feira de toldos coloridos (tapetes, especiarias, cerâmica, tecidos) e mercadores por toda parte. */
function galleon(len = 24) {
  const K = boat(len, false, 99), wd = M.wood(), dk = M.darkWood(), H = len * 0.16, sail = plain('sail2', '#f2ead6', { rough: 0.9, side: THREE.DoubleSide, emissive: '#4a4438', ei: 0.35 });
  K.box(len * 0.34, 0.3, len * 0.26, wd, 0, H * 1.0, -len * 0.36); K.box(len * 0.3, 2.2, len * 0.22, dk, 0, H + 1.2, -len * 0.37); K.box(len * 0.34, 0.3, len * 0.26, wd, 0, H + 2.4, -len * 0.37); // castelo de popa
  for (let k = 0; k < 4; k++) K.box(0.7, 0.6, 0.1, M.glass(), -len * 0.12 + k * len * 0.08, H + 1.4, -len * 0.48 + 0.02);
  for (const [z, hgt, sw] of [[len * 0.2, len * 0.95, len * 0.4], [-len * 0.08, len * 1.1, len * 0.48], [-len * 0.3, len * 0.75, len * 0.32]]) {
    K.cyl(0.18, 0.24, hgt, wd, 0, H + hgt / 2, z, 12);
    for (const [yy, ww] of [[0.45, 1], [0.78, 0.75]]) { K.cyl(0.08, 0.08, sw * ww, wd, 0, H + hgt * yy, z, 8, 0, 0, Math.PI / 2);
      const sl = new THREE.PlaneGeometry(sw * ww * 0.95, hgt * 0.28, 8, 6), P = sl.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin((P.getY(i) / (hgt * 0.28) + 0.5) * Math.PI) * 0.6 + Math.cos(P.getX(i) / (sw * ww) * Math.PI) * 0.3); sl.computeVertexNormals(); K.add(sl, sail, 0, H + hgt * (yy - 0.15), z + 0.4, Math.PI / 2 * 0); }
  }
  K.cyl(0.12, 0.12, len * 0.45, wd, 0, H + 1.6, len * 0.62, 8, 0, Math.PI / 2 - 0.35); // gurupés
  return K;
}
function warehouse(seed) {
  const K = new Kit(), r = rngOf(seed), w = 12 + r() * 4, d = 9, h = 6.5, st = M.greyStone(), wd = M.darkWood();
  K.box(w + 0.6, 1, d + 0.6, st, 0, 0, 0); K.box(w, h, d, st, 0, 0.5 + h / 2, 0); for (const sx of [-1, 1]) K.box(0.6, h, 0.6, M.wood(), sx * w / 2, 0.5 + h / 2, d / 2);
  gable(K, w + 0.4, d + 0.4, 3.2, M.clay(), 0, 0.5 + h, 0, 0, 0.5);
  K.box(4.2, 4.6, 0.25, wd, 0, 2.8, d / 2 + 0.05); for (let k = -1; k <= 1; k++) K.box(4.2, 0.18, 0.3, M.iron(), 0, 1.6 + (k + 1) * 1.4, d / 2 + 0.1); // portão de carga
  K.box(1.6, 0.25, 0.4, wd, 0, h + 0.2, d / 2 + 0.6); K.box(0.25, 0.25, 2.2, wd, 0, h + 0.4, d / 2 + 1.2); // viga do guincho
  K.add(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), M.rope(), 0, h - 1, d / 2 + 2.2);
  for (let k = 0; k < 6; k++) K.box(1.0, 1.0, 1.0, M.wood(), (k % 3 - 1) * 1.1 + 3.5, 0.5 + Math.floor(k / 3) * 1.0, d / 2 + 1.4, r() * 0.2); // caixas empilhadas
  for (let k = 0; k < 3; k++) K.add(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), M.wood(), -3.8 + k * 0.9, 0.5, d / 2 + 1.3);
  K.box(3.0, 0.7, 0.12, plain('whSign', '#2a1e14'), -3.5, h - 0.4, d / 2 + 0.07);
  return { K, box: [[0, 0, w / 2 + 0.3, d / 2 + 0.3]] };
}
function guildHall() {
  const K = new Kit(), st = M.sandStone(), mar = M.marble(), wd = M.darkWood();
  K.box(22, 1.2, 16, M.greyStone(), 0, 0.2, 0); for (let k = 0; k < 4; k++) K.box(12 - k * 0.6, 0.35, 1.2, mar, 0, 0.18 + k * 0.35, 8.6 + 2.6 - k * 0.6); // escadaria
  K.box(20, 9, 14, st, 0, 5.2, 0); K.box(21, 0.8, 15, mar, 0, 9.9, 0);
  for (let k = 0; k < 6; k++) { const x = -7.5 + k * 3; K.cyl(0.55, 0.62, 8.6, mar, x, 5.0, 7.6, 16); K.box(1.5, 0.5, 1.5, mar, x, 9.4, 7.6); K.box(1.5, 0.5, 1.5, mar, x, 0.95, 7.6); } // pórtico de colunas
  { const sh = new THREE.Shape(); sh.moveTo(-10.5, 0); sh.lineTo(10.5, 0); sh.lineTo(0, 3.4); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false }), mar, 0, 10.3, 6.6); } // frontão
  K.add(new THREE.CylinderGeometry(6.4, 6.4, 3, 32), st, 0, 11.8, -1); K.add(new THREE.SphereGeometry(6.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.copper(), 0, 13.3, -1); // cúpula de cobre
  K.cyl(0.6, 0.8, 2.2, M.gold(), 0, 20.6, -1, 12); K.add(new THREE.SphereGeometry(0.7, 16, 12), M.gold(), 0, 22.1, -1);
  K.box(3.4, 5.4, 0.3, wd, 0, 3.6, 7.05); archBlocks(K, 3.4, 0.6, 0.8, mar, 0, 6.3, 7.0, 0, 11);
  for (const sx of [-1, 1]) for (const yy of [3.5, 7]) K.box(1.6, 2.4, 0.15, M.glass(), sx * 6.5, yy, 7.02);
  return K;
}
function marketStall(seed, kind) {
  const K = new Kit(), r = rngOf(seed), wd = M.wood(), cols = ['#b8322a', '#2e6aa8', '#d8a020', '#3a8a4a', '#8a3aa0', '#e07a2a'], awn = plain('awn' + kind, cols[kind % cols.length], { rough: 0.9, side: THREE.DoubleSide }), awn2 = plain('awnW', '#f2ead6', { rough: 0.9, side: THREE.DoubleSide });
  K.box(3.4, 0.95, 1.6, wd, 0, 0.48, 0); K.box(3.7, 0.1, 1.9, M.darkWood(), 0, 0.98, 0);
  for (const sx of [-1.65, 1.65]) for (const sz of [-0.8, 0.8]) K.box(0.12, 2.8, 0.12, M.darkWood(), sx, 1.4, sz);
  for (let k = 0; k < 6; k++) K.box(0.62, 0.06, 2.4, k % 2 ? awn : awn2, -1.55 + k * 0.62, 2.85, 0.15, 0, -0.22); // toldo listrado
  for (let k = 0; k < 6; k++) K.add(new THREE.PlaneGeometry(0.62, 0.3), k % 2 ? awn : awn2, -1.55 + k * 0.62, 2.48, 1.32, 0, 0, 0); // franja
  if (kind % 4 === 0) for (let k = 0; k < 5; k++) K.add(new THREE.CylinderGeometry(0.22, 0.26, 0.25, 14), plain('spice' + k, ['#c8501a', '#e0b030', '#7a3a1a', '#3a6a2a', '#a0281e'][k], { rough: 1 }), -1.3 + k * 0.65, 1.16, 0.1); // especiarias em tigelas
  else if (kind % 4 === 1) for (let k = 0; k < 4; k++) K.add(new THREE.CylinderGeometry(0.18, 0.42, 0.9, 14, 1), plain('rug' + k, ['#8a2a1e', '#2a4a8a', '#c89a2a', '#4a2a6a'][k], { rough: 1 }), -1.2 + k * 0.8, 1.45, -0.3, 0, Math.PI / 2, 0.2); // tapetes enrolados
  else if (kind % 4 === 2) for (let k = 0; k < 6; k++) K.add(new THREE.LatheGeometry([[0.01, 0], [0.16, 0.02], [0.22, 0.18], [0.12, 0.36], [0.09, 0.44], [0.12, 0.48]].map(([a, b]) => new THREE.Vector2(a, b)), 14), plain('pot', '#b8673a', { rough: 0.8 }), -1.4 + k * 0.55, 1.03, (k % 2) * 0.3 - 0.15); // cerâmica
  else for (let k = 0; k < 5; k++) K.box(0.6, 0.12 + (k % 3) * 0.05, 0.9, plain('cloth' + k, cols[(k + 2) % cols.length], { rough: 1 }), -1.3 + k * 0.65, 1.1, 0); // tecidos dobrados
  return K;
}
function buildMerchantQuarter(ctx, port) {
  const C = PORT, u = { x: SEA.x - C.x, z: SEA.z - C.z }, ul = Math.hypot(u.x, u.z); u.x /= ul; u.z /= ul;
  const side = { x: u.z, z: -u.x }, back = { x: -u.x, z: -u.z }, yawSea = port.yawSea, B = port.beach, r = rngOf(919);
  const at = (o, dd) => ({ x: C.x + side.x * o + back.x * dd, z: C.z + side.z * o + back.z * dd });
  // Guilda dos Mercadores, de frente para a praça (atrás das casas)
  { const p = at(0, 64); put(ctx, guildHall(), 'guilda_dos_mercadores', p.x, p.z, yawSea, { box: [[0, 0, 11, 8]] });
    for (const sx of [-1, 1]) { const b = makeBanner('guilda', 1.6, 5); const q = at(sx * 5.5, 64 - 8.1); b.position.set(q.x, gY(p.x, p.z) + 9.3, q.z); b.rotation.y = yawSea; ctx.scene.add(b); } }
  // armazéns de carga ao longo da orla
  [[-46, 4], [46, 4], [-56, 18], [56, 18]].forEach(([o, dd], i) => { const p = at(o, dd), { K, box } = warehouse(300 + i); put(ctx, K, 'armazem', p.x, p.z, yawSea + Math.PI + (o < 0 ? 0.25 : -0.25), { box }); });
  // feira de toldos coloridos (rua dos mercadores)
  for (let k = 0; k < 10; k++) { const o = -22 + (k % 5) * 11, dd = k < 5 ? 48 : 38, p = at(o, dd); put(ctx, marketStall(500 + k, k), 'banca_do_mercado', p.x, p.z, yawSea + (k < 5 ? 0 : Math.PI), { box: [[0, 0, 1.8, 0.9]] }); }
  // guindastes de carga no cais e o galeão mercante atracado no cais central
  for (const o of [-16, 16]) { const p = { x: B.x + side.x * o + u.x * 3, z: B.z + side.z * o + u.z * 3 }, K = new Kit(), wd = M.darkWood();
    K.box(0.6, 7, 0.6, wd, 0, 3.5, 0); K.box(0.45, 0.45, 6, wd, 0, 6.8, 2.2, 0, 0.35); K.box(0.3, 3.4, 0.3, wd, 0, 5, 1.4, 0, -0.6); K.add(new THREE.CylinderGeometry(0.02, 0.02, 4, 6), M.rope(), 0, 4.6, 4.8); K.box(1.0, 0.8, 1.0, M.wood(), 0, 2.2, 4.8);
    put(ctx, K, 'guindaste_do_cais', p.x, p.z, yawSea + (o < 0 ? 0.6 : -0.6), { box: [[0, 0, 0.5, 0.5]], occ: false }); }
  { const px = B.x + u.x * 26 + side.x * 11, pz = B.z + u.z * 26 + side.z * 11, g = put(ctx, galleon(26), 'galeao_mercante', px, pz, yawSea, { y: SEA.level - 2.3, occ: false, box: [[0, 0, 3.6, 12]] });
    g.userData.update = t => { g.position.y = SEA.level - 2.3 + Math.sin(t * 0.55) * 0.1; g.rotation.z = Math.sin(t * 0.4) * 0.02; }; ctx.roomAnims.push(g); }
  // pilhas de carga pela orla
  for (let k = 0; k < 16; k++) { const p = at((r() - 0.5) * 90, -1 - r() * 8); ctx.place(['crate_A', 'crate_B', 'barrel', 'sack'][k % 4], p.x, p.z, { rf: 0.6 }); }
  // mercadores
  const M2 = (n, o, dd, yaw) => { const p = at(o, dd); ctx.worldNpc(n, p.x, p.z, yaw); };
  const ys = yawSea;
  M2({ id: 'aurelio', name: 'Aurélio Vasconde', title: 'Mestre da Guilda dos Mercadores', model: 'Mage', show: ['Mage_Cape'], look: { race: 'humano', face: 'sabio', hair: { style: 'curto', color: 'grisalho' }, beard: true },
    lines: 'Todo navio que entra no Porto das Gaivotas paga à Guilda — e todo mercador honesto ganha com isso.\nQuer vender em grande? Traga drops raros: os compradores de além-mar pagam bem por presas, cristais e escamas.' }, 0, 54, ys);
  M2({ id: 'zaira', name: 'Zaíra', title: 'Mercadora de Especiarias', model: 'Rogue', shopList: 'geral', shopTitle: '🌶️ Especiarias de Zaíra', look: { race: 'humano', sex: 'f', face: 'astuto', hair: { style: 'longo', color: 'preto' }, skin: 'escura' },
    hello: 'Pimenta-de-fogo das dunas, sal rosado, canela do outro lado do mar! Cheire, cheire...' }, -22, 46, ys + Math.PI);
  M2({ id: 'tadeu', name: 'Tadeu', title: 'Vendedor de Tapetes', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'careca', color: 'castanho' }, beard: true },
    lines: 'Este aqui foi tecido por noventa dias! Para você, um preço de amigo. Para o meu amigo, um preço de irmão.' }, -11, 46, ys + Math.PI);
  M2({ id: 'cora', name: 'Cora', title: 'Oleira', model: 'Barbarian', show: ['Mug'], look: { race: 'humano', sex: 'f', face: 'gentil', hair: { style: 'coque', color: 'castanho' } },
    lines: 'Barro do rio, fogo do forno e paciência. Cada jarro tem o meu polegar marcado no fundo.' }, 0, 46, ys + Math.PI);
  M2({ id: 'baltazar', name: 'Capitão Baltazar', title: 'Capitão do Galeão Mercante', model: 'Knight', show: ['1H_Sword'], look: { race: 'humano', face: 'valente', hair: { style: 'longo', color: 'ruivo' }, beard: true },
    lines: 'O "Gaivota Dourada" volta do oriente a cada lua cheia, com o porão cheio. Um dia levo você junto — quando houver para onde ir.' }, 7, 6, ys);
  M2({ id: 'dolf', name: 'Dolf', title: 'Estivador', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', face: 'alegre', hair: { style: 'raspado', color: 'preto' }, beard: true },
    lines: 'Caixa pra cá, barril pra lá. Anão no porto? Ora, alguém tem que carregar o peso!' }, -30, 2, ys + 1);
  M2({ id: 'selene', name: 'Selene', title: 'Mercadora de Tecidos', model: 'Mage', look: { race: 'elfo', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
    lines: 'Seda élfica de Aelindra e lã das montanhas dos anões. No porto, todas as raças fazem negócio.' }, 22, 40, ys);
  M2({ id: 'fabio', name: 'Fábio', title: 'Cambista', model: 'Rogue', look: { race: 'humano', face: 'astuto', hair: { style: 'curto', color: 'castanho_escuro' } },
    lines: 'Zeny, ouro de além-mar, pedras preciosas... eu troco tudo. Com uma pequena taxa, é claro.' }, 11, 43, ys);
}

/* =========================== entrada =========================== */
// ctx: { scene, place, worldNpc, colliders, occluders, placed, roomAnims, camera }
export function buildCities(ctx) {
  let cullT = -9;
  const anim = { userData: { update: t => { clothT.value = t; if (t - cullT < 0.5) return; cullT = t; const c = ctx.camera.position; if (c.x > 550) return; for (const g of CULL) { const d = Math.hypot(g.position.x - c.x, g.position.z - c.z); g.visible = d < (g.userData.far || 380); } } } };
  ctx.roomAnims.push(anim); // vento nos estandartes e distância de desenho das cidades
  const dwarf = buildDwarfCity(ctx);
  buildElfCity(ctx);
  const port = buildPortTown(ctx);
  buildMerchantQuarter(ctx, port); // S-175: bairro dos mercadores (guilda, armazéns, feira, galeão)
  buildFrostHold(ctx);             // S-165: a Muralha Gélida e a Fortaleza da Vigília Negra
  return { refineBoard: dwarf.refineBoard, port };
}
export { makeBanner, flame, brazier, axeGeo, archBlocks, gable, put, stoneTex, woodTex, roofTex, CULL };
