'use strict';
/* =========================================================================
   MUNDO — geração procedural (determinística) dos mapas + pathfinding A*.
   ========================================================================= */

const TILE = CONFIG.TILE;
const TT = { GRASS: 0, DIRT: 1, STONE: 2, WATER: 3, DARK: 4, RUIN: 5 };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

class GameMap {
  constructor(id) {
    const def = MAPS[id];
    this.id = id; this.def = def; this.w = def.w; this.h = def.h;
    this.tiles = new Uint8Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
    this.decor = [];
    this.objects = [];
    const rng = mulberry32(hashStr(id) * 7 + 13);
    if (def.kind === 'town') genTown(this, rng); else genWild(this, rng);
    this.computeReach();
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  i(x, y) { return y * this.w + x; }
  get(x, y) { return this.inb(x, y) ? this.tiles[this.i(x, y)] : -1; }
  set(x, y, t) { if (this.inb(x, y)) this.tiles[this.i(x, y)] = t; }
  isSolid(x, y) { return !this.inb(x, y) || this.solid[this.i(x, y)] === 1; }
  addObj(type, tx, ty, opts = {}) {
    if (!this.inb(tx, ty) || this.solid[this.i(tx, ty)]) return;
    this.solid[this.i(tx, ty)] = 1;
    this.objects.push(Object.assign({ type, x: tx * TILE + TILE / 2, y: tx === undefined ? 0 : ty * TILE + TILE - 4, tx, ty }, opts));
  }
  computeReach() {
    const [sx, sy] = this.def.spawn;
    this.reach = new Uint8Array(this.w * this.h);
    this.reachList = [];
    const q = [[sx, sy]];
    this.reach[this.i(sx, sy)] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      this.reachList.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inb(nx, ny) || this.isSolid(nx, ny) || this.reach[this.i(nx, ny)]) continue;
        this.reach[this.i(nx, ny)] = 1; q.push([nx, ny]);
      }
    }
  }
  randomReachable() { return this.reachList[Math.floor(Math.random() * this.reachList.length)]; }
}

/* ---------------- Mapas selvagens ---------------- */
function carveRoad(m, rng, x0, y0, x1, y1, tile, reserved, thin) {
  let x = x0, y = y0, guard = 0;
  const brush = (bx, by) => {
    const r = thin ? 0 : 1;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = bx + dx, ny = by + dy;
      if (!m.inb(nx, ny)) continue;
      m.set(nx, ny, tile); reserved[m.i(nx, ny)] = 1;
    }
  };
  while ((x !== x1 || y !== y1) && guard++ < 3000) {
    brush(x, y);
    const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
    if (dx && (!dy || rng() < 0.5)) x += dx; else if (dy) y += dy;
    if (rng() < 0.12) { // pequenas curvas
      if (dx && !dy) { const ny = y + (rng() < 0.5 ? -1 : 1); if (ny > 2 && ny < m.h - 3) y = ny; }
      else if (dy && !dx) { const nx = x + (rng() < 0.5 ? -1 : 1); if (nx > 2 && nx < m.w - 3) x = nx; }
    }
  }
  brush(x1, y1);
}

function genWild(m, rng) {
  const th = m.def.theme, W = m.w, H = m.h;
  const base = th === 'forest' ? TT.DARK : th === 'ruins' ? TT.RUIN : TT.GRASS;
  const road = th === 'ruins' ? TT.STONE : TT.DIRT;
  m.tiles.fill(base);
  const reserved = new Uint8Array(W * H);
  const [cx, cy] = m.def.spawn;
  for (const p of m.def.portals) carveRoad(m, rng, p.x, p.y, cx, cy, road, reserved, false);
  for (let k = 0; k < 4; k++) carveRoad(m, rng, cx, cy, 5 + Math.floor(rng() * (W - 10)), 5 + Math.floor(rng() * (H - 10)), road, reserved, true);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) reserved[m.i(cx + dx, cy + dy)] = 1;

  const nearPortal = (x, y, r) => m.def.portals.some(p => Math.abs(p.x - x) <= r && Math.abs(p.y - y) <= r);

  // lagos
  if (th !== 'ruins') {
    const n = th === 'forest' ? 3 : 5;
    for (let k = 0; k < n; k++) {
      const px = 6 + Math.floor(rng() * (W - 12)), py = 6 + Math.floor(rng() * (H - 12));
      const rx = 2 + rng() * 2.5, ry = 1.5 + rng() * 1.8;
      for (let y = Math.floor(py - ry - 1); y <= py + ry + 1; y++) for (let x = Math.floor(px - rx - 1); x <= px + rx + 1; x++) {
        if (!m.inb(x, y) || reserved[m.i(x, y)] || nearPortal(x, y, 4)) continue;
        const v = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2;
        if (v <= 1 + rng() * 0.25) { m.set(x, y, TT.WATER); m.solid[m.i(x, y)] = 1; }
      }
    }
  }
  // borda
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < 2 && !reserved[m.i(x, y)]) placeWildObj(m, rng, th, x, y, true);
  }
  // espalhar obstáculos
  const dens = th === 'forest' ? 0.13 : th === 'ruins' ? 0.075 : 0.055;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (reserved[m.i(x, y)] || m.solid[m.i(x, y)] || nearPortal(x, y, 4)) continue;
    if (rng() < dens) placeWildObj(m, rng, th, x, y, false);
  }
  // decoração (não sólida)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (m.solid[m.i(x, y)]) continue;
    const t = m.get(x, y);
    if (t === TT.WATER) continue;
    const r = rng();
    if (th === 'meadow' && t === TT.GRASS && r < 0.09) m.decor.push({ x, y, type: 'flower', c: ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff'][Math.floor(rng() * 4)], ox: rng(), oy: rng() });
    else if (th === 'forest' && r < 0.06) m.decor.push({ x, y, type: rng() < 0.5 ? 'fern' : 'shroom', ox: rng(), oy: rng() });
    else if (th === 'ruins' && r < 0.08) m.decor.push({ x, y, type: rng() < 0.6 ? 'rubble' : 'bones', ox: rng(), oy: rng() });
    else if (r < 0.04) m.decor.push({ x, y, type: 'tuft', ox: rng(), oy: rng() });
  }
}

function placeWildObj(m, rng, th, x, y, border) {
  const r = rng(), v = rng();
  if (th === 'meadow') {
    if (r < 0.62) m.addObj('tree', x, y, { v }); else if (r < 0.85) m.addObj('bush', x, y, { v }); else m.addObj('rock', x, y, { v });
  } else if (th === 'forest') {
    if (r < 0.55) m.addObj('pine', x, y, { v }); else if (r < 0.8) m.addObj('tree', x, y, { v, dark: true }); else if (r < 0.92) m.addObj('rock', x, y, { v, mossy: true }); else m.addObj('bush', x, y, { v, dark: true });
  } else {
    if (border) m.addObj(r < 0.7 ? 'wall' : 'pillar', x, y, { v });
    else if (r < 0.35) m.addObj('pillar', x, y, { v }); else if (r < 0.55) m.addObj('deadtree', x, y, { v }); else if (r < 0.8) m.addObj('rock', x, y, { v, mossy: true }); else m.addObj('wall', x, y, { v });
  }
}

/* ---------------- Vila ---------------- */
function genTown(m, rng) {
  const W = m.w, H = m.h;
  m.tiles.fill(TT.GRASS);
  const reserved = new Uint8Array(W * H);
  const fillRect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { m.set(x, y, t); reserved[m.i(x, y)] = 1; } };
  fillRect(11, 9, 29, 21, TT.STONE);   // praça
  fillRect(29, 14, 39, 16, TT.STONE);  // estrada leste (saída)
  fillRect(19, 3, 21, 9, TT.STONE);    // rua norte
  fillRect(19, 21, 21, 26, TT.STONE);  // rua sul
  fillRect(5, 14, 11, 16, TT.STONE);   // rua oeste

  // fonte 2x2 no centro
  for (const [x, y] of [[19, 14], [20, 14], [19, 15], [20, 15]]) m.solid[m.i(x, y)] = 1;
  m.objects.push({ type: 'fountain', x: 20 * TILE, y: 16 * TILE, tx: 19, ty: 14 });

  // casas (5x3)
  const houses = [[3, 3, '#b5523b'], [10, 2, '#3b6fb5'], [24, 2, '#7a4fa0'], [31, 4, '#b5523b'], [3, 21, '#3b8a5a'], [11, 24, '#b5893b'], [30, 21, '#3b6fb5'], [24, 24, '#8a3b5a']];
  for (const [hx, hy, roof] of houses) {
    for (let y = hy; y < hy + 3; y++) for (let x = hx; x < hx + 5; x++) { m.solid[m.i(x, y)] = 1; reserved[m.i(x, y)] = 1; }
    for (let x = hx; x < hx + 5; x++) reserved[m.i(x, hy + 3)] = 1;
    m.set(hx + 2, hy + 3, TT.DIRT);
    m.objects.push({ type: 'house', x: (hx + 2.5) * TILE, y: (hy + 3) * TILE, tx: hx, ty: hy, w: 5, h: 3, roof });
  }
  // postes
  for (const [x, y] of [[11, 9], [29, 9], [11, 21], [29, 21]]) m.addObj('lamp', x, y);
  // bancos/caixotes
  m.addObj('crate', 26, 10); m.addObj('crate', 27, 10);
  // borda de árvores
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < 2 && !reserved[m.i(x, y)]) m.addObj('tree', x, y, { v: rng() });
  }
  // árvores esparsas
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (reserved[m.i(x, y)] || m.solid[m.i(x, y)]) continue;
    let nearSolid = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.solid[m.i(x + dx, y + dy)]) nearSolid = true;
    if (!nearSolid && rng() < 0.05) m.addObj('tree', x, y, { v: rng() });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (m.get(x, y) === TT.GRASS && !m.solid[m.i(x, y)] && rng() < 0.12)
      m.decor.push({ x, y, type: 'flower', c: ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff'][Math.floor(rng() * 4)], ox: rng(), oy: rng() });
  }
}

/* ---------------- Pathfinding (A*, 8 direções) ---------------- */
function findPath(m, sx, sy, tx, ty, maxIter = 4000) {
  if (!m.inb(tx, ty)) return null;
  if (m.isSolid(tx, ty)) {
    let best = null, bd = 1e9;
    for (let r = 1; r <= 3 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (m.isSolid(nx, ny)) continue;
      const d = dx * dx + dy * dy + ((nx - sx) ** 2 + (ny - sy) ** 2) * 0.01;
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    if (!best) return null;
    [tx, ty] = best;
  }
  if (sx === tx && sy === ty) return [];
  const W = m.w, N = W * m.h;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = []; // [f, idx]
  const push = (f, i) => {
    heap.push([f, i]); let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let s = k;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s;
      }
    }
    return top;
  };
  const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const si = m.i(sx, sy), ti = m.i(tx, ty);
  g[si] = 0; push(h(sx, sy), si);
  let iter = 0, found = false;
  while (heap.length && iter++ < maxIter) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === ti) { found = true; break; }
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (m.isSolid(nx, ny)) continue;
      if (dx && dy && (m.isSolid(cx + dx, cy) || m.isSolid(cx, cy + dy))) continue;
      const ni = m.i(nx, ny);
      if (closed[ni]) continue;
      const ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + h(nx, ny), ni); }
    }
  }
  if (!found) return null;
  const path = [];
  let c = ti;
  while (c !== si && c !== -1) { path.push([c % W, (c / W) | 0]); c = came[c]; }
  return path.reverse();
}
