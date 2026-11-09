/* =========================================================================
   CATACUMBAS DO SANTUÁRIO (S-159, S-160) — masmorra em 4 andares (floors).
   Cada andar é um labirinto de corredores de pedra (grade 8×8 de células de 8 m),
   com câmaras abertas, tochas de parede com chama de verdade, ossadas, teias,
   sarcófagos e escadas que descem. Quanto mais fundo, mais perigoso; no 4º andar
   fica o salão da Sentinela Silente.
   Os andares são INTERIORS separados (catacumbas, catacumbas2…4) em x = 1500,
   um atrás do outro em z. Tudo de um andar fica num grupo (só o andar atual aparece).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';

export const CELL = 8, GRID = 8, WALL_T = 1.3, WALL_H = 6;
export const FLOOR_IDS = ['catacumbas', 'catacumbas2', 'catacumbas3', 'catacumbas4'];
export const FLOOR_NAMES = ['1º andar — Ossuário', '2º andar — Galerias dos Esquecidos', '3º andar — Criptas Profundas', '4º andar — Salão da Sentinela'];
// monstros por andar (alguns se repetem; os mais fortes ficam embaixo) — formato do SPAWNS do main3d
export const DUNGEON_SPAWNS = [
  ['catacumbas', 'esqueleto_vigia', 7], ['catacumbas', 'gotinha_sombria', 4],
  ['catacumbas2', 'esqueleto_vigia', 5], ['catacumbas2', 'espectro', 4], ['catacumbas2', 'gotinha_sombria', 3],
  ['catacumbas3', 'espectro', 5], ['catacumbas3', 'cavaleiro_caido', 4], ['catacumbas3', 'esqueleto_vigia', 3],
  ['catacumbas4', 'cavaleiro_caido', 5], ['catacumbas4', 'espectro', 4], ['catacumbas4', 'sentinela_silente', 1],
];

const rngOf = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const FLOORS = []; // { id, n, I, cells, walls:{e:[][], s:[][]}, entry, down, up, boss, group }

/* ---------- texturas (canvas, geradas uma vez) ---------- */
let TEX = null;
function makeTex() {
  if (TEX) return TEX;
  const canvasPair = (W, H, draw) => { const c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = b.width = W; c.height = b.height = H; draw(c.getContext('2d'), b.getContext('2d'), W, H); return [c, b]; };
  let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // parede: blocos de pedra irregulares, argamassa funda, manchas de umidade e fuligem
  const [wc, wb] = canvasPair(512, 512, (g, gb, W, H) => {
    g.fillStyle = '#2a2622'; g.fillRect(0, 0, W, H); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
    let y = 0, row = 0;
    while (y < H) {
      const h = 40 + rnd() * 26; let x = row % 2 ? -rnd() * 60 : 0;
      while (x < W) {
        const w = 60 + rnd() * 80, l = 30 + rnd() * 12, hue = 28 + rnd() * 14;
        for (const off of [0, -W]) {
          g.fillStyle = `hsl(${hue}, ${5 + rnd() * 7}%, ${l}%)`; g.beginPath(); g.roundRect(x + off + 3, y + 3, w - 6, h - 6, 7); g.fill();
          const gr = gb.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(0.45, '#e0e0e0'); gr.addColorStop(1, '#707070'); gb.fillStyle = gr; gb.beginPath(); gb.roundRect(x + off + 4, y + 4, w - 8, h - 8, 8); gb.fill();
        }
        for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,245,230' : '10,8,6'},${rnd() * 0.09})`; g.fillRect(x + 4 + rnd() * (w - 10), y + 4 + rnd() * (h - 10), 2 + rnd() * 9, 1 + rnd() * 4); }
        if (rnd() < 0.3) { g.strokeStyle = 'rgba(15,12,10,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + rnd() * w, y + 4); g.lineTo(x + rnd() * w, y + h * 0.6); g.lineTo(x + rnd() * w, y + h - 4); g.stroke(); }
        x += w;
      }
      y += h; row++;
    }
    // escorrido de umidade e fuligem (de cima para baixo)
    for (let k = 0; k < 14; k++) { const x = rnd() * W, gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(8,10,6,0.35)'); gr.addColorStop(1, 'rgba(8,10,6,0)'); g.fillStyle = gr; g.fillRect(x, 0, 6 + rnd() * 18, H * (0.3 + rnd() * 0.6)); }
    const moss = g.createLinearGradient(0, H * 0.75, 0, H); moss.addColorStop(0, 'rgba(40,52,30,0)'); moss.addColorStop(1, 'rgba(40,52,30,0.35)'); g.fillStyle = moss; g.fillRect(0, 0, W, H);
  });
  // chão: lajes grandes, gastas no meio, com terra nas juntas
  const [fc, fb] = canvasPair(512, 512, (g, gb, W, H) => {
    g.fillStyle = '#1e1b18'; g.fillRect(0, 0, W, H); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * 128 + (r % 2) * 64, y = r * 128, l = 24 + rnd() * 10;
      for (const off of [0, -W]) {
        g.fillStyle = `hsl(${30 + rnd() * 10}, ${6 + rnd() * 6}%, ${l}%)`; g.beginPath(); g.roundRect(x + off + 4, y + 4, 120, 120, 10); g.fill();
        gb.fillStyle = '#c8c8c8'; gb.beginPath(); gb.roundRect(x + off + 6, y + 6, 116, 116, 12); gb.fill();
      }
      for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,240,220' : '0,0,0'},${rnd() * 0.08})`; g.fillRect(x + 6 + rnd() * 110, y + 6 + rnd() * 110, 2 + rnd() * 10, 1 + rnd() * 5); }
      if (rnd() < 0.35) { g.strokeStyle = 'rgba(10,8,6,0.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10 + rnd() * 100, y + 8); g.lineTo(x + 30 + rnd() * 60, y + 60); g.lineTo(x + 10 + rnd() * 100, y + 120); g.stroke(); gb.strokeStyle = '#303030'; gb.lineWidth = 3; gb.stroke(); }
    }
  });
  const mk = (c, rep, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  // teia
  const web = document.createElement('canvas'); web.width = web.height = 256; { const g = web.getContext('2d'); g.strokeStyle = 'rgba(230,230,225,0.55)'; g.lineWidth = 1.2; for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 256, Math.sin(a) * 256); g.stroke(); } for (let r = 20; r < 250; r += 18 + r * 0.08) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2, rr = r * (0.92 + Math.sin(k * 2.1 + r) * 0.06); k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); } }
  TEX = { wall: mk(wc, 1, true), wallB: mk(wb), floor: mk(fc, 1, true), floorB: mk(fb), web: mk(web, 1, true) };
  return TEX;
}

// material das paredes (também usado pela casca externa em interiors3d)
let WALL_MAT = null;
export function dungeonWallMat() { if (!WALL_MAT) { const T = makeTex(); WALL_MAT = new THREE.MeshStandardMaterial({ map: T.wall, bumpMap: T.wallB, bumpScale: 3, roughness: 0.95, color: '#c8c0b4' }); } return WALL_MAT; }
export { boxM as dungeonBox };

/* ---------- caixa com UV em metros (textura não estica) ---------- */
function boxM(w, h, d, x, y, z, k = 1 / 2.6) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  // ordem das faces: +x, -x, +y, -y, +z, -z (4 vértices cada)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] * k + (x + z) * k * 0.37, uv.getY(i) * dims[f][1] * k + (f === 2 || f === 3 ? 0 : y * k)); }
  g.translate(x, y, z); return g;
}
const strip = g => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };

/* ---------- labirinto ---------- */
function makeMaze(seed, n) {
  const rng = rngOf(seed);
  // e[r][c] = parede a leste da célula; s[r][c] = parede ao sul
  const e = [...Array(GRID)].map(() => Array(GRID).fill(true)), s = [...Array(GRID)].map(() => Array(GRID).fill(true)), seen = [...Array(GRID)].map(() => Array(GRID).fill(false));
  const open = (r, c, r2, c2) => { if (r2 === r) e[r][Math.min(c, c2)] = false; else s[Math.min(r, r2)][c] = false; };
  // 4º andar: as 3 fileiras do norte viram o salão do chefe (aberto, com colunas)
  const bossRows = n === 4 ? 3 : 0;
  for (let r = 0; r < bossRows; r++) for (let c = 0; c < GRID; c++) { seen[r][c] = true; if (c < GRID - 1) e[r][c] = false; if (r < bossRows - 1) s[r][c] = false; }
  const stack = [[GRID - 1, 3]]; seen[GRID - 1][3] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < GRID && b < GRID && !seen[a][b]);
    if (!nb.length) { stack.pop(); continue; }
    const [a, b] = nb[Math.floor(rng() * nb.length)]; open(r, c, a, b); seen[a][b] = true; stack.push([a, b]);
  }
  // laços extras (labirinto com caminhos alternativos, como o de morcegos de Morroc)
  for (let k = 0; k < 9; k++) { const r = bossRows + Math.floor(rng() * (GRID - bossRows)), c = Math.floor(rng() * (GRID - 1)); e[r][c] = false; const r2 = bossRows + Math.floor(rng() * (GRID - bossRows - 1)), c2 = Math.floor(rng() * GRID); s[r2][c2] = false; }
  // 2 câmaras (2×2 abertas)
  const rooms = [];
  for (let k = 0; k < 2; k++) { const r = bossRows + 1 + Math.floor(rng() * (GRID - bossRows - 3)), c = Math.floor(rng() * (GRID - 1)); e[r][c] = e[r + 1][c] = false; s[r][c] = s[r][c + 1] = false; rooms.push([r, c]); }
  // entrada: as duas células do meio ao sul ficam ligadas (a porta/escada fica entre elas)
  e[GRID - 1][3] = false;
  if (bossRows) { s[bossRows - 1][3] = false; s[bossRows - 1][4] = false; } // portal do salão
  return { e, s, rooms, bossRows };
}
// célula mais distante da entrada (para a escada que desce)
function farthest(maze) {
  const dist = [...Array(GRID)].map(() => Array(GRID).fill(-1)), q = [[GRID - 1, 3]]; dist[GRID - 1][3] = 0; let best = [GRID - 1, 3];
  while (q.length) {
    const [r, c] = q.shift();
    const moves = [[r, c + 1, c < GRID - 1 && !maze.e[r][c]], [r, c - 1, c > 0 && !maze.e[r][c - 1]], [r + 1, c, r < GRID - 1 && !maze.s[r][c]], [r - 1, c, r > 0 && !maze.s[r - 1][c]]];
    for (const [a, b, ok] of moves) if (ok && dist[a][b] < 0) { dist[a][b] = dist[r][c] + 1; q.push([a, b]); }
  }
  // S-303: a escada que desce fica num canto do labirinto — de preferência um beco sem saída encostado na borda, longe da entrada (nunca no meio de um corredor)
  let maxD = 0; for (let r = 0; r < GRID - 2; r++) for (let c = 0; c < GRID; c++) maxD = Math.max(maxD, dist[r][c]);
  let bestScore = -1e9;
  for (let r = maze.bossRows || 0; r < GRID - 2; r++) for (let c = 0; c < GRID; c++) {
    const d = dist[r][c]; if (d < maxD * 0.55) continue;
    const opens = (c < GRID - 1 && !maze.e[r][c]) + (c > 0 && !maze.e[r][c - 1]) + (r < GRID - 1 && !maze.s[r][c]) + (r > 0 && !maze.s[r - 1][c]);
    const edge = (r === (maze.bossRows || 0) || c === 0 || c === GRID - 1) ? 1 : 0, corner = (c === 0 || c === GRID - 1) && r === (maze.bossRows || 0) ? 1 : 0;
    const inRoom = (maze.rooms || []).some(([rr, cc]) => r >= rr && r <= rr + 1 && c >= cc && c <= cc + 1);
    const score = d + (opens === 1 ? 8 : 0) + edge * 6 + corner * 3 - (inRoom ? 10 : 0);
    if (score > bestScore) { bestScore = score; best = [r, c]; }
  }
  return { best, dist };
}

/* ---------- peças ---------- */
function torchParts(geoIron, geoWood) {
  // suporte de ferro (placa + braço + cálice) e cabo de madeira com pano — relativo à parede (z+ = para fora)
  geoIron.push(strip(boxM(0.26, 0.4, 0.06, 0, 0, 0.03)));
  { const a = new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8); a.rotateX(Math.PI / 2 - 0.5); a.translate(0, 0.05, 0.17); geoIron.push(strip(a)); }
  { const c = new THREE.CylinderGeometry(0.09, 0.055, 0.12, 14, 1, true); c.translate(0, 0.16, 0.33); geoIron.push(strip(c)); }
  { const h = new THREE.CylinderGeometry(0.04, 0.032, 0.6, 10); h.rotateX(0.15); h.translate(0, 0.32, 0.34); geoWood.push(strip(h)); }
  { const w = new THREE.CylinderGeometry(0.058, 0.05, 0.14, 12); w.translate(0, 0.6, 0.38); geoWood.push(strip(w)); }
}
function bonePile(rng, geo) {
  for (let k = 0; k < 7; k++) { const b = new THREE.CapsuleGeometry(0.035, 0.3 + rng() * 0.2, 3, 6); b.rotateZ(Math.PI / 2); b.rotateY(rng() * 6); b.translate((rng() - 0.5) * 0.7, 0.05 + k * 0.012, (rng() - 0.5) * 0.7); geo.push(strip(b)); }
  for (let k = 0; k < 2; k++) { const s = new THREE.SphereGeometry(0.11, 12, 9); s.scale(1, 0.95, 1.15); const x = (rng() - 0.5) * 0.5, z = (rng() - 0.5) * 0.5; s.translate(x, 0.1, z); geo.push(strip(s)); const j = new THREE.BoxGeometry(0.1, 0.05, 0.09); j.translate(x, 0.03, z + 0.09); geo.push(strip(j)); } // caveiras
}
function sarcophagus(x, z, rot, geo) {
  const parts = [boxM(1.25, 0.85, 2.5, 0, 0.425, 0), boxM(1.45, 0.2, 2.7, 0, 0.95, 0), boxM(1.0, 0.18, 2.1, 0, 1.14, 0), boxM(1.4, 0.15, 0.2, 0, 0.75, 1.2)];
  const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  for (const p of parts) { p.applyMatrix4(m); geo.push(strip(p)); }
}
function brokenPillar(rng, x, z, geo) {
  const h = 1 + rng() * 3.5, c = new THREE.CylinderGeometry(0.55, 0.65, h, 16, 3); const P = c.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > h / 2 - 0.01) P.setY(i, P.getY(i) - rng() * 0.5); c.translate(x, h / 2, z); geo.push(strip(c));
  geo.push(strip(boxM(1.5, 0.35, 1.5, x, 0.17, z)));
  for (let k = 0; k < 3; k++) { const r = new THREE.DodecahedronGeometry(0.2 + rng() * 0.25, 0); r.translate(x + (rng() - 0.5) * 2.2, 0.15, z + (rng() - 0.5) * 2.2); geo.push(strip(r)); }
}

/* ---------- constrói os 4 andares ---------- */
export function buildCatacombs(ctx) {
  const { scene, colliders, occluders, roomAnims, INTERIORS } = ctx;
  const T = makeTex();
  const wallM = dungeonWallMat();
  const floorM = new THREE.MeshStandardMaterial({ map: T.floor, bumpMap: T.floorB, bumpScale: 2.5, roughness: 0.92, color: '#bdb4a6' });
  const ceilM = new THREE.MeshStandardMaterial({ map: T.wall, bumpMap: T.wallB, bumpScale: 2, roughness: 1, color: '#6a6258' });
  const boneM = new THREE.MeshStandardMaterial({ color: '#d8ccae', roughness: 0.85 }), ironM = new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.7, roughness: 0.55 }), woodM = new THREE.MeshStandardMaterial({ color: '#4a3120', roughness: 0.9 });
  const webM = new THREE.MeshBasicMaterial({ map: T.web, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const flameMats = [['#ff4a10', 0.42], ['#ff9a30', 0.7], ['#fff2b0', 0.95]].map(([c, o]) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flameGeo = [new THREE.SphereGeometry(0.17, 10, 8), new THREE.SphereGeometry(0.12, 10, 8), new THREE.SphereGeometry(0.065, 8, 6)];
  const parent = new THREE.Group(); parent.name = 'catacumbas'; scene.add(parent);

  FLOOR_IDS.forEach((id, i) => {
    const n = i + 1, I = INTERIORS[id], X = I.x, Z = I.z, H = I.h, half = GRID * CELL / 2, rng = rngOf(97 + n * 31);
    const maze = makeMaze(31 + n * 17, n), { best } = farthest(maze);
    const cx = c => X - half + (c + 0.5) * CELL, cz = r => Z - half + (r + 0.5) * CELL;
    const group = new THREE.Group(); group.name = id; parent.add(group);
    const wallGeo = [[], [], [], []], quad = (x, z) => (x > X ? 1 : 0) + (z > Z ? 2 : 0); // paredes em 4 quadrantes (a câmera testa só as próximas)
    const geoStone = [], geoBone = [], geoIron = [], geoWood = [], flames = [];
    const addWall = (x, z, w, d) => { wallGeo[quad(x, z)].push(strip(boxM(w, H, d, x, H / 2, z))); colliders.push({ x, z, r: Math.max(w, d) / 2, box: true, hx: w / 2, hz: d / 2, rot: 0, name: 'catacumba' }); };
    // paredes internas
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      if (c < GRID - 1 && maze.e[r][c]) addWall(X - half + (c + 1) * CELL, cz(r), WALL_T, CELL + WALL_T);
      if (r < GRID - 1 && maze.s[r][c]) addWall(cx(c), Z - half + (r + 1) * CELL, CELL + WALL_T, WALL_T);
    }
    // pilares nos cruzamentos (escondem as emendas e dão ritmo de cripta)
    for (let r = 1; r < GRID; r++) for (let c = 1; c < GRID; c++) { if (r <= maze.bossRows) continue; if (!(maze.e[r - 1][c - 1] || maze.e[r][c - 1] || maze.s[r - 1][c - 1] || maze.s[r - 1][c])) continue; const x = X - half + c * CELL, z = Z - half + r * CELL; wallGeo[quad(x, z)].push(strip(boxM(WALL_T + 0.5, H, WALL_T + 0.5, x, H / 2, z))); wallGeo[quad(x, z)].push(strip(boxM(WALL_T + 0.8, 0.5, WALL_T + 0.8, x, 0.25, z))); }
    // salão do chefe (4º andar): colunas grossas e o altar com runas
    if (maze.bossRows) {
      for (const c of [1, 3, 4, 6]) for (const r of [0.6, 2.2]) { const x = X - half + (c + 0.5) * CELL, z = Z - half + r * CELL; const col = new THREE.CylinderGeometry(0.9, 1.05, H, 20, 1); col.translate(x, H / 2, z); wallGeo[quad(x, z)].push(strip(col)); colliders.push({ x, z, r: 1.05 }); }
      geoStone.push(strip(boxM(10, 0.5, 5, X, 0.25, Z - half + 1.6)), strip(boxM(8, 0.5, 3.5, X, 0.75, Z - half + 1.2)));
      colliders.push({ x: X, z: Z - half + 1.4, r: 5, box: true, hx: 5, hz: 2.5, rot: 0 });
      // círculo de runas no chão do salão e dois braseiros grandes ao lado do estrado
      { const runeM = new THREE.MeshBasicMaterial({ color: '#8a5aff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
        for (const [r0, w] of [[6.2, 0.12], [5.4, 0.06], [3.2, 0.08]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r0 - w, r0, 96), runeM); ring.rotation.x = -Math.PI / 2; ring.position.set(X, 0.04, Z - half + 11); group.add(ring); }
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, rn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), runeM); rn.rotation.set(-Math.PI / 2, 0, a); rn.position.set(X + Math.cos(a) * 5.8, 0.045, Z - half + 11 + Math.sin(a) * 5.8); group.add(rn); }
        const L = vlight('#9a6aff', 3, 16); L.position.set(X, 1.2, Z - half + 11); group.add(L); }
      for (const sx of [-1, 1]) { const bx = X + sx * 6.5, bz = Z - half + 4.2; const bowl = new THREE.CylinderGeometry(0.75, 0.35, 0.55, 18, 1); bowl.translate(bx, 1.55, bz); geoIron.push(strip(bowl)); const leg = new THREE.CylinderGeometry(0.12, 0.25, 1.3, 10); leg.translate(bx, 0.65, bz); geoIron.push(strip(leg)); colliders.push({ x: bx, z: bz, r: 0.8 }); flames.push({ p: new THREE.Vector3(bx, 1.75, bz), seed: sx * 3, big: true }); const L = vlight('#ff8a3a', 4, 18); L.position.set(bx, 2.6, bz); group.add(L); }
    }
    // chão, teto
    const fl = new THREE.PlaneGeometry(GRID * CELL, GRID * CELL, 1, 1); fl.rotateX(-Math.PI / 2); { const uv = fl.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 16, uv.getY(k) * 16); } fl.translate(X, 0.02, Z);
    const floorMesh = new THREE.Mesh(fl, floorM); floorMesh.receiveShadow = true; group.add(floorMesh);
    for (let q = 0; q < 4; q++) { const cg = new THREE.PlaneGeometry(half, half); cg.rotateX(Math.PI / 2); { const uv = cg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 8, uv.getY(k) * 8); } cg.translate(X + (q % 2 ? half / 2 : -half / 2), H, Z + (q > 1 ? half / 2 : -half / 2)); const cm = new THREE.Mesh(cg, ceilM); cm.castShadow = true; group.add(cm); occluders.push(cm); }
    // arcos de pedra cruzando o teto a cada célula (sensação de cripta abobadada)
    for (let r = maze.bossRows; r < GRID; r++) for (let c = 0; c < GRID; c++) if (rng() < 0.45) geoStone.push(strip(boxM(c < GRID - 1 && !maze.e[r][c] ? CELL : CELL - WALL_T, 0.45, 0.6, cx(c), H - 0.22, cz(r))));
    // tochas nas paredes: em ~1/3 das paredes, viradas para o corredor
    const torchAt = (x, z, yaw) => {
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 2.5, z), gi = [], gw = []; torchParts(gi, gw);
      for (const g of gi) { g.applyMatrix4(m); geoIron.push(g); } for (const g of gw) { g.applyMatrix4(m); geoWood.push(g); }
      const p = new THREE.Vector3(0, 0.72, 0.39).applyMatrix4(m); flames.push({ p, seed: rng() * 10 });
      const L = vlight('#ff8a3a', 3.4, 14); L.position.set(p.x, p.y + 0.2, p.z); group.add(L);
    };
    for (let r = maze.bossRows; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      if (rng() > 0.42) continue;
      const opts = [];
      if (c < GRID - 1 && maze.e[r][c]) opts.push([X - half + (c + 1) * CELL - WALL_T / 2, cz(r) + (rng() - 0.5) * 3, -Math.PI / 2]);
      if (c > 0 && maze.e[r][c - 1]) opts.push([X - half + c * CELL + WALL_T / 2, cz(r) + (rng() - 0.5) * 3, Math.PI / 2]);
      if (r > maze.bossRows && maze.s[r - 1][c]) opts.push([cx(c) + (rng() - 0.5) * 3, Z - half + r * CELL + WALL_T / 2, 0]);
      if (c === 0) opts.push([X - half + 0.16, cz(r), Math.PI / 2]); if (c === GRID - 1) opts.push([X + half - 0.16, cz(r), -Math.PI / 2]);
      if (opts.length) torchAt(...opts[Math.floor(rng() * opts.length)]);
    }
    if (maze.bossRows) for (const s of [-1, 1]) for (const z of [Z - half + 4, Z - half + 14]) torchAt(X + s * (half - 0.16), z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    // decoração: ossadas, sarcófagos nas câmaras e becos, pilares quebrados, teias nos cantos
    for (let r = maze.bossRows; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      const walls = [c === GRID - 1 || maze.e[r][c], c === 0 || maze.e[r][c - 1], r === GRID - 1 || maze.s[r][c], r === 0 || maze.s[r - 1][c]].filter(Boolean).length;
      const x = cx(c), z = cz(r), isEntry = r === GRID - 1 && (c === 3 || c === 4), isDown = r === best[0] && c === best[1];
      if (isEntry || isDown) continue;
      if (walls >= 3 && rng() < 0.7) { sarcophagus(x + (rng() - 0.5) * 1.5, z + (rng() - 0.5) * 1.5, rng() < 0.5 ? 0 : Math.PI / 2, geoStone); colliders.push({ x, z, r: 1.4 }); }
      else if (rng() < 0.35) { const g = []; bonePile(rng, g); const m = new THREE.Matrix4().setPosition(x + (rng() - 0.5) * 4, 0, z + (rng() - 0.5) * 4); for (const q of g) { q.applyMatrix4(m); geoBone.push(q); } }
      else if (rng() < 0.12) { brokenPillar(rng, x + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2, geoStone); colliders.push({ x, z, r: 0.8 }); }
      if (rng() < 0.3) { const web = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), webM); const sx = rng() < 0.5 ? -1 : 1, sz = rng() < 0.5 ? -1 : 1; web.position.set(x + sx * (CELL / 2 - WALL_T / 2 - 0.05), H - 1.1, z + sz * (CELL / 2 - WALL_T / 2 - 0.6)); web.rotation.set(0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx * sz > 0 ? Math.PI : -Math.PI / 2); group.add(web); }
    }
    for (const [r, c] of maze.rooms) { const x = X - half + (c + 1) * CELL, z = Z - half + (r + 1) * CELL; sarcophagus(x - 2, z - 2, 0, geoStone); sarcophagus(x + 2, z + 2, 0, geoStone); colliders.push({ x: x - 2, z: z - 2, r: 1.4 }, { x: x + 2, z: z + 2, r: 1.4 }); }
    // entrada (sul): 1º andar = portão imponente para fora; outros = escada que sobe
    const ex = X, ez = Z + half;
    if (n === 1) {
      // portão imponente: pilastras largas com base e capitel, arco de aduelas com pedra-chave de caveira, vão escuro e portas de madeira e ferro abertas
      for (const sx of [-1, 1]) { geoStone.push(strip(boxM(2.0, 6, 1.8, ex + sx * 3.0, 3, ez - 0.6)), strip(boxM(2.5, 0.6, 2.2, ex + sx * 3.0, 0.3, ez - 0.7)), strip(boxM(2.4, 0.5, 2.1, ex + sx * 3.0, 5.4, ez - 0.7))); }
      for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10, r = 2.15; const v = boxM(0.62, 0.55, 1.9, 0, 0, 0); v.rotateZ(a - Math.PI / 2); v.translate(ex + Math.cos(a) * r, 3.4 + Math.sin(a) * r, ez - 0.6); geoStone.push(strip(v)); } // aduelas
      geoStone.push(strip(boxM(8, 0.7, 2.0, ex, 6.0, ez - 0.6)));
      { const dark = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 5.4), new THREE.MeshBasicMaterial({ color: '#020102' })); dark.position.set(ex, 2.7, ez - 0.1); dark.rotation.y = Math.PI; group.add(dark); }
      for (const sd of [-1, 1]) { const door = boxM(1.95, 4.6, 0.2, 0, 2.3, 0), m = new THREE.Matrix4().makeRotationY(sd * 1.2).setPosition(ex + sd * 1.95, 0, ez - 1.5); door.translate(-sd * 0.97, 0, 0); door.applyMatrix4(m); geoWood.push(strip(door)); for (const y of [0.7, 2.3, 3.9]) { const band = boxM(2.0, 0.14, 0.26, 0, y, 0); band.translate(-sd * 0.97, 0, 0); band.applyMatrix4(m); geoIron.push(strip(band)); } const ring = new THREE.TorusGeometry(0.16, 0.03, 8, 16); ring.translate(-sd * 1.6, 2.2, 0.14); ring.applyMatrix4(m); geoIron.push(strip(ring)); }
      { const sk = new THREE.SphereGeometry(0.42, 16, 12); sk.scale(1, 0.92, 0.8); sk.translate(ex, 5.65, ez - 1.6); geoBone.push(strip(sk)); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#9ad0ff' })); e.position.set(ex + sx * 0.15, 5.7, ez - 1.93); group.add(e); } }
      for (const sd of [-1, 1]) torchAt(ex + sd * 3.0, ez - 1.52, Math.PI);
    } else {
      for (let k = 0; k < 6; k++) geoStone.push(strip(boxM(3.2, 0.3 + k * 0.32, 0.62, ex, (0.3 + k * 0.32) / 2, ez - 0.6 - (5 - k) * 0.6))); // degraus subindo até a parede sul
      geoStone.push(strip(boxM(1.2, H, 1.2, ex - 2.2, H / 2, ez - 1.5)), strip(boxM(1.2, H, 1.2, ex + 2.2, H / 2, ez - 1.5)));
    }
    // escada que desce (ou nada no 4º): poço com degraus para baixo e um arco escuro
    const dx = cx(best[1]), dz = cz(best[0]);
    if (n < 4) {
      geoStone.push(strip(boxM(4.2, 0.4, 0.5, dx, 0.2, dz - 2.1)), strip(boxM(4.2, 0.4, 0.5, dx, 0.2, dz + 2.1)), strip(boxM(0.5, 0.4, 4.2, dx - 2.1, 0.2, dz)), strip(boxM(0.5, 0.4, 4.2, dx + 2.1, 0.2, dz)));
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ color: '#030203' })); pit.rotation.x = -Math.PI / 2; pit.position.set(dx, 0.035, dz); group.add(pit);
      for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8a7c66').multiplyScalar(1 - k * 0.19) })); st.rotation.x = -Math.PI / 2; st.position.set(dx, 0.04, dz + 1.5 - k * 0.62); group.add(st); } // bordas dos degraus sumindo no escuro
    }
    // chamas: 3 camadas em InstancedMesh (uma chamada por camada), tremulam sozinhas
    const inst = flameGeo.map((g, k) => { const im = new THREE.InstancedMesh(g, flameMats[k], flames.length); im.frustumCulled = false; group.add(im); return im; });
    const dummy = new THREE.Object3D();
    group.userData.update = t => {
      if (!group.visible) return;
      flames.forEach((f, j) => {
        const fl1 = Math.sin(t * 13 + f.seed) * 0.12 + Math.sin(t * 23 + f.seed * 2) * 0.07;
        for (let k = 0; k < 3; k++) { dummy.position.set(f.p.x + Math.sin(t * 7 + f.seed + k) * 0.012, f.p.y + (0.11 + k * -0.02 + fl1 * 0.05) * (f.big ? 3.2 : 1), f.p.z); const bs = f.big ? 3.2 : 1; dummy.scale.set((1 + fl1 * 0.3) * bs, (2.4 - k * 0.2) * (1 + fl1) * bs, (1 + fl1 * 0.3) * bs); dummy.rotation.set(0, 0, Math.sin(t * 5 + f.seed) * 0.1); dummy.updateMatrix(); inst[k].setMatrixAt(j, dummy.matrix); }
      });
      for (const im of inst) im.instanceMatrix.needsUpdate = true;
    };
    roomAnims.push(group);
    // malhas mescladas
    const add = (list, m, occ, cast = true) => { if (!list.length) return null; const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = cast; mesh.receiveShadow = true; group.add(mesh); if (occ) occluders.push(mesh); return mesh; };
    wallGeo.forEach((list, q) => { const m = add(list, wallM, true); if (m) { const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()); m.geometry.translate(-c.x, 0, -c.z); m.position.set(c.x, 0, c.z); } }); // posição no centro do quadrante (filtro de oclusão da câmera)
    add(geoStone, wallM, false); add(geoBone, boneM, false, false); add(geoIron, ironM, false, false); add(geoWood, woodM, false, false);
    // pontos de referência do andar
    const F = { id, n, I, maze, group, name: FLOOR_NAMES[i],
      entry: { x: ex, z: ez - 3, yaw: Math.PI }, // onde se chega descendo (perto da escada que sobe / do portão)
      up: n > 1 ? { x: ex, z: ez - 1.6 } : null,  // portal da escada que sobe (andares 2–4)
      down: n < 4 ? { x: dx, z: dz } : null,       // portal da escada que desce (andares 1–3)
      arriveUp: n < 4 ? { x: dx, z: dz + 3.2, yaw: 0 } : null, // onde se chega SUBINDO de volta a este andar
      boss: maze.bossRows ? { x: X, z: Z - half + 8 } : null };
    FLOORS.push(F);
  });
  return FLOORS;
}

/* ---------- utilidades para o main3d ---------- */
export function floorAt(x, z) { for (const F of FLOORS) { const I = F.I; if (Math.abs(x - I.x) < I.w / 2 + 4 && Math.abs(z - I.z) < I.d / 2 + 4) return F; } return null; }
// mostra só o andar onde a câmera está (os outros ficam ocultos)
export function dungeonCull(x, z) { const cur = floorAt(x, z); for (const F of FLOORS) F.group.visible = F === cur; }
// ponto de nascimento num andar: célula aleatória longe da entrada e da escada; chefe no salão
export function dungeonSpawn(id, rng, boss) {
  const F = FLOORS.find(f => f.id === id); if (!F) return null;
  if (boss && F.boss) return { ...F.boss };
  const half = GRID * CELL / 2, X = F.I.x, Z = F.I.z;
  for (let k = 0; k < 60; k++) {
    const r = F.maze.bossRows + Math.floor(rng() * (GRID - F.maze.bossRows)), c = Math.floor(rng() * GRID);
    if (r >= GRID - 2 && c >= 2 && c <= 5) continue; // longe da entrada
    const x = X - half + (c + 0.5) * CELL + (rng() - 0.5) * 3, z = Z - half + (r + 0.5) * CELL + (rng() - 0.5) * 3;
    if (F.down && Math.hypot(x - F.down.x, z - F.down.z) < 4) continue;
    return { x, z };
  }
  return { x: X, z: Z };
}
// minimapa da masmorra: planta do andar atual centrada no jogador (W = lado do canvas, range = metros do centro à borda)
// opts.whole = mostra o andar inteiro (janela do mapa, tecla G), com você marcado e o nome do andar
export function dungeonMap(c, W, px, pz, range, opts = {}) {
  const F = floorAt(px, pz); if (!F) return false;
  const me = { x: px, z: pz }; if (opts.whole) { px = F.I.x; pz = F.I.z; range = GRID * CELL / 2 + 4; }
  const R = W / 2, k = R / range, half = GRID * CELL / 2, X = F.I.x, Z = F.I.z;
  const pt = (x, z) => [R + (x - px) * k, R + (z - pz) * k];
  c.fillStyle = '#0c0a0a'; c.fillRect(0, 0, W, W);
  const [x0, y0] = pt(X - half, Z - half); c.fillStyle = '#3a332c'; c.fillRect(x0, y0, half * 2 * k, half * 2 * k);
  c.strokeStyle = '#a89a80'; c.lineWidth = Math.max(2, WALL_T * k); c.lineCap = 'square'; c.beginPath();
  const line = (ax, az, bx, bz) => { const [a, b] = pt(ax, az), [d, e] = pt(bx, bz); c.moveTo(a, b); c.lineTo(d, e); };
  line(X - half, Z - half, X + half, Z - half); line(X - half, Z + half, X - CELL * 0.15, Z + half); line(X + CELL * 0.15, Z + half, X + half, Z + half); line(X - half, Z - half, X - half, Z + half); line(X + half, Z - half, X + half, Z + half);
  for (let r = 0; r < GRID; r++) for (let cc = 0; cc < GRID; cc++) {
    if (cc < GRID - 1 && F.maze.e[r][cc]) line(X - half + (cc + 1) * CELL, Z - half + r * CELL, X - half + (cc + 1) * CELL, Z - half + (r + 1) * CELL);
    if (r < GRID - 1 && F.maze.s[r][cc]) line(X - half + cc * CELL, Z - half + (r + 1) * CELL, X - half + (cc + 1) * CELL, Z - half + (r + 1) * CELL);
  }
  c.stroke();
  const icon = (p, txt, col) => { if (!p) return; const [x, y] = pt(p.x, p.z); c.fillStyle = col; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y); };
  // S-303: escadas/portais aparecem como portal (anel brilhante com redemoinho), não como triângulo
  const portalIcon = (p, col, glow) => { if (!p) return; const [x, y] = pt(p.x, p.z), r = Math.max(6, Math.min(11, CELL * k * 0.32));
    const g = c.createRadialGradient(x, y, 0, x, y, r * 1.9); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.9, 0, 7); c.fill();
    c.save(); c.translate(x, y); c.scale(1, 0.78); c.fillStyle = '#0a0612'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.strokeStyle = col; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
    c.lineWidth = 1.4; for (let k2 = 0; k2 < 3; k2++) { c.beginPath(); c.arc(0, 0, r * (0.32 + k2 * 0.2), k2 * 2.1, k2 * 2.1 + 3.6); c.stroke(); } // redemoinho
    c.restore(); };
  portalIcon(F.down, '#c9a2ff', 'rgba(160,110,255,0.55)'); portalIcon(F.up, '#9ae0ff', 'rgba(110,190,255,0.5)'); if (F.n === 1) icon({ x: X, z: Z + half - 1.2 }, '⌂', '#9ae0ff'); icon(F.boss, '☠', '#ff6a5a');
  if (opts.whole) {
    for (const m of opts.monsters || []) { const [x, y] = pt(m.x, m.z); c.fillStyle = m.boss ? '#ffb84a' : '#ff5a5a'; c.beginPath(); c.arc(x, y, m.boss ? 6 : 3.5, 0, 7); c.fill(); }
    const [x, y] = pt(me.x, me.z); c.save(); c.translate(x, y); c.rotate(-(opts.yaw || 0) + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#1a3a8a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(7.5, 8); c.lineTo(0, 4); c.lineTo(-7.5, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, 34); c.fillStyle = '#ffd77a'; c.font = 'bold 18px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Catacumbas do Santuário · ' + F.name, W / 2, 17);
  }
  return true;
}
