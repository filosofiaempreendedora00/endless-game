'use strict';
/* =========================================================================
   RENDERIZAÇÃO — todo o visual é desenhado com código (sem imagens).
   Quando houver arte própria (sprites), é aqui que ela entra.
   ========================================================================= */

const PAL = {
  [TT.GRASS]: ['#6fae4f', '#74b354', '#69a74a', '#78b858'],
  [TT.DARK]: ['#3e6a3a', '#43703e', '#3a6436', '#466f3f'],
  [TT.DIRT]: ['#b38d5d', '#ad8656', '#b89363'],
  [TT.STONE]: ['#bdb5a5', '#c4bcac', '#b7af9f'],
  [TT.WATER]: ['#3b7dc2', '#3a7abf'],
  [TT.RUIN]: ['#6f6c66', '#76736c', '#6a6761', '#73706a'],
};
const MINI_COL = { [TT.GRASS]: '#5f9a45', [TT.DARK]: '#355c32', [TT.DIRT]: '#a5824f', [TT.STONE]: '#b3ab9b', [TT.WATER]: '#3b7dc2', [TT.RUIN]: '#5e5b56' };

const groundCache = {};
function getGround(m) {
  if (groundCache[m.id]) return groundCache[m.id];
  const c = document.createElement('canvas');
  c.width = m.w * TILE; c.height = m.h * TILE;
  const g = c.getContext('2d');
  const rng = mulberry32(hashStr(m.id) + 999);
  const T = TILE;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = m.get(x, y), pal = PAL[t];
    g.fillStyle = pal[Math.floor(rng() * pal.length)];
    g.fillRect(x * T, y * T, T, T);
  }
  // caminhos de terra com bordas orgânicas
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.get(x, y) !== TT.DIRT) continue;
    g.fillStyle = PAL[TT.DIRT][Math.floor(rng() * 3)];
    g.beginPath(); g.arc(x * T + T / 2 + (rng() - 0.5) * 6, y * T + T / 2 + (rng() - 0.5) * 6, T * 0.78, 0, Math.PI * 2); g.fill();
  }
  // detalhes
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = m.get(x, y), px = x * T, py = y * T;
    if (t === TT.GRASS || t === TT.DARK) {
      for (let k = 0; k < 5; k++) {
        const bx = px + rng() * T, by = py + rng() * T;
        g.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
        g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (rng() - 0.5) * 2, by - 3 - rng() * 2); g.stroke();
      }
    } else if (t === TT.DIRT) {
      for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(70,45,20,0.18)'; g.fillRect(px + rng() * T, py + rng() * T, 2, 2); }
    } else if (t === TT.STONE) {
      g.strokeStyle = 'rgba(60,50,40,0.18)'; g.lineWidth = 1;
      for (let r = 0; r < 2; r++) {
        g.beginPath(); g.moveTo(px, py + r * T / 2 + 0.5); g.lineTo(px + T, py + r * T / 2 + 0.5); g.stroke();
        const xx = px + ((r + y) % 2 ? T / 4 : (3 * T) / 4);
        g.beginPath(); g.moveTo(xx, py + r * T / 2); g.lineTo(xx, py + r * T / 2 + T / 2); g.stroke();
      }
      if (rng() < 0.15) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px + 3, py + 3, T / 2 - 6, T / 2 - 6); }
    } else if (t === TT.RUIN) {
      if (rng() < 0.35) { g.strokeStyle = 'rgba(20,20,20,0.3)'; g.beginPath(); let cx = px + rng() * T, cy = py + rng() * T; g.moveTo(cx, cy); for (let k = 0; k < 3; k++) { cx += (rng() - 0.5) * 14; cy += (rng() - 0.5) * 14; g.lineTo(cx, cy); } g.stroke(); }
      if (rng() < 0.22) { g.fillStyle = 'rgba(90,140,60,0.28)'; g.beginPath(); g.ellipse(px + rng() * T, py + rng() * T, 4 + rng() * 8, 3 + rng() * 5, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
    } else if (t === TT.WATER) {
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.2;
      for (let k = 0; k < 2; k++) { const wx = px + rng() * T, wy = py + rng() * T; g.beginPath(); g.arc(wx, wy, 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      // margens
      const sides = [[0, -1, px, py, T, 4], [0, 1, px, py + T - 4, T, 4], [-1, 0, px, py, 4, T], [1, 0, px + T - 4, py, 4, T]];
      for (const [dx, dy, rx, ry, rw, rh] of sides) {
        const n = m.get(x + dx, y + dy);
        if (n !== TT.WATER && n !== -1) { g.fillStyle = '#d8c48a'; g.fillRect(rx, ry, rw, rh); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(rx + (dx === 1 ? -2 : dx === -1 ? 4 : 0), ry + (dy === 1 ? -2 : dy === -1 ? 4 : 0), dx ? 2 : rw, dy ? 2 : rh); }
      }
    }
  }
  // decoração
  for (const d of m.decor) {
    const px = d.x * T + 4 + d.ox * (T - 8), py = d.y * T + 4 + d.oy * (T - 8);
    if (d.type === 'flower') {
      g.fillStyle = d.c; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.arc(px + Math.cos(a) * 2, py + Math.sin(a) * 2, 1.7, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(px, py, 1.2, 0, Math.PI * 2); g.fill();
    } else if (d.type === 'tuft' || d.type === 'fern') {
      g.strokeStyle = d.type === 'fern' ? '#2d5a2a' : 'rgba(30,70,25,0.6)'; g.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + k * 2.5, py - 6 + Math.abs(k)); g.stroke(); }
    } else if (d.type === 'shroom') {
      g.fillStyle = '#e8dcc8'; g.fillRect(px - 1, py - 3, 2, 4); g.fillStyle = '#c0504a'; g.beginPath(); g.arc(px, py - 3, 3, Math.PI, 0); g.fill();
    } else if (d.type === 'rubble') {
      g.fillStyle = '#5b5852'; for (let k = 0; k < 3; k++) g.fillRect(px + (k - 1) * 4, py + (k % 2) * 2, 3, 2);
    } else if (d.type === 'bones') {
      g.strokeStyle = '#d8d2c0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px + 4, py - 2); g.moveTo(px - 2, py - 3); g.lineTo(px + 1, py + 2); g.stroke();
    }
  }
  groundCache[m.id] = c;
  return c;
}

const miniCache = {};
function getMini(m) {
  if (miniCache[m.id]) return miniCache[m.id];
  const c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
  const g = c.getContext('2d');
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    g.fillStyle = m.solid[m.i(x, y)] && m.get(x, y) !== TT.WATER ? (m.def.theme === 'ruins' ? '#3a3834' : '#2a4a22') : MINI_COL[m.get(x, y)];
    g.fillRect(x, y, 1, 1);
  }
  for (const o of m.objects) if (o.type === 'house') { g.fillStyle = o.roof; g.fillRect(o.tx, o.ty, o.w, o.h); }
  miniCache[m.id] = c;
  return c;
}

/* ---------------- Utilidades de desenho ---------------- */
function ell(c, x, y, rx, ry, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function circ(c, x, y, r, fill) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function rrect(c, x, y, w, h, r, fill) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function shadow(c, rx, ry = rx * 0.38) { ell(c, 0, 0, rx, ry, 'rgba(0,0,0,0.25)'); }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function outlinedText(c, text, x, y, fill, size = 11, weight = 'bold') {
  c.font = `${weight} ${size}px Nunito, "Segoe UI", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineJoin = 'round';
  c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y);
}

/* ---------------- Objetos do cenário ---------------- */
function drawObject(c, o, t) {
  const x = o.x, y = o.y;
  c.save(); c.translate(x, y);
  switch (o.type) {
    case 'tree': {
      const s = 0.85 + o.v * 0.4;
      shadow(c, 15 * s, 5 * s);
      rrect(c, -3.5 * s, -16 * s, 7 * s, 16 * s, 2, '#6b4a2f');
      const col = o.dark ? ['#2c5a2b', '#356b33', '#467f40'] : ['#3d8a3a', '#49a044', '#6cc25a'];
      const sway = Math.sin(t * 1.2 + o.x * 0.05) * 1.2;
      circ(c, -9 * s + sway, -20 * s, 10 * s, col[0]);
      circ(c, 9 * s + sway, -20 * s, 10 * s, col[0]);
      circ(c, sway, -28 * s, 13 * s, col[1]);
      circ(c, -4 * s + sway, -32 * s, 6 * s, col[2]);
      if (!o.dark && o.v > 0.7) { circ(c, 6 * s + sway, -22 * s, 2, '#e04848'); circ(c, -6 * s + sway, -26 * s, 2, '#e04848'); }
      break;
    }
    case 'pine': {
      const s = 0.9 + o.v * 0.4;
      shadow(c, 12 * s, 4 * s);
      c.fillStyle = '#5a3d26'; c.fillRect(-3 * s, -10 * s, 6 * s, 10 * s);
      const layers = [['#1f4a2c', 14, -8, -24], ['#265634', 11.5, -18, -34], ['#2e6440', 8.5, -28, -44]];
      for (const [col, w, yb, yt] of layers) { c.fillStyle = col; c.beginPath(); c.moveTo(-w * s, yb * s); c.lineTo(w * s, yb * s); c.lineTo(0, yt * s); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(0, -44 * s); c.lineTo(-8 * s, -28 * s); c.lineTo(0, -30 * s); c.fill();
      break;
    }
    case 'bush': {
      const col = o.dark ? ['#2e5a2a', '#3a6d34'] : ['#4a9a40', '#5cb050'];
      shadow(c, 12, 4);
      circ(c, -6, -6, 7, col[0]); circ(c, 6, -6, 7, col[0]); circ(c, 0, -10, 8, col[1]);
      if (!o.dark && o.v > 0.6) { circ(c, -4, -9, 1.6, '#ff7aa8'); circ(c, 4, -12, 1.6, '#ffd84a'); }
      break;
    }
    case 'rock': {
      shadow(c, 13, 4);
      c.fillStyle = '#80838a'; c.beginPath(); c.moveTo(-12, 0); c.lineTo(-10, -10); c.lineTo(-2, -15); c.lineTo(8, -12); c.lineTo(12, -2); c.lineTo(10, 1); c.closePath(); c.fill();
      c.fillStyle = '#a4a7ad'; c.beginPath(); c.moveTo(-8, -9); c.lineTo(-2, -13); c.lineTo(6, -11); c.lineTo(0, -7); c.closePath(); c.fill();
      if (o.mossy) ell(c, -3, -12, 6, 3, 'rgba(90,150,60,0.7)');
      break;
    }
    case 'pillar': {
      const h = o.v < 0.4 ? 22 : 46;
      shadow(c, 13, 5);
      c.fillStyle = '#8f8a7e'; c.fillRect(-10, -h, 20, h);
      c.fillStyle = '#a9a497'; c.fillRect(-10, -h, 6, h);
      c.fillStyle = '#7a7569'; c.fillRect(-13, -4, 26, 5);
      if (o.v >= 0.4) { c.fillStyle = '#b5b0a3'; c.fillRect(-13, -h - 5, 26, 6); }
      else { c.fillStyle = '#8f8a7e'; c.beginPath(); c.moveTo(-10, -h); c.lineTo(-4, -h - 6); c.lineTo(3, -h - 2); c.lineTo(10, -h - 7); c.lineTo(10, -h); c.fill(); }
      ell(c, 4, -h * 0.4, 5, 7, 'rgba(90,150,60,0.45)');
      break;
    }
    case 'wall': {
      shadow(c, 17, 5);
      const h = 24 + o.v * 12;
      c.fillStyle = '#76716a'; c.fillRect(-16, -h, 32, h);
      c.fillStyle = '#8a857d'; c.fillRect(-16, -h, 32, 5);
      c.strokeStyle = 'rgba(30,25,20,0.35)'; c.lineWidth = 1;
      for (let r = 0; r * 8 < h; r++) { c.beginPath(); c.moveTo(-16, -r * 8); c.lineTo(16, -r * 8); c.stroke(); const off = r % 2 ? 0 : 8; for (let k = -16 + off; k < 16; k += 16) { c.beginPath(); c.moveTo(k, -r * 8); c.lineTo(k, -r * 8 - 8); c.stroke(); } }
      ell(c, -6, -h + 4, 8, 3, 'rgba(90,150,60,0.5)');
      break;
    }
    case 'deadtree': {
      shadow(c, 10, 3);
      c.strokeStyle = '#4e4036'; c.lineCap = 'round';
      c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(1, -26); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(1, -18); c.lineTo(-10, -30); c.moveTo(1, -24); c.lineTo(11, -34); c.moveTo(-6, -25); c.lineTo(-8, -36); c.stroke();
      break;
    }
    case 'house': {
      const W = o.w * TILE, H = o.h * TILE;
      ell(c, 0, 0, W / 2 + 6, 8, 'rgba(0,0,0,0.25)');
      const wallTop = -H - 10;
      c.fillStyle = '#e8d9b5'; c.fillRect(-W / 2, wallTop, W, H + 10);
      c.fillStyle = '#d4c39b'; c.fillRect(-W / 2, -12, W, 12);
      c.strokeStyle = '#8a6a44'; c.lineWidth = 3; c.strokeRect(-W / 2, wallTop, W, H + 10);
      c.fillStyle = '#7a5532'; for (const bx of [-W / 2 + 2, W / 2 - 6]) c.fillRect(bx, wallTop, 4, H + 10);
      // porta
      rrect(c, -9, -30, 18, 30, 4, '#6b4426'); circ(c, 5, -15, 1.6, '#ffd84a');
      // janelas
      for (const wx of [-W / 2 + 18, W / 2 - 34]) { c.fillStyle = '#5a3a20'; c.fillRect(wx - 2, -40, 20, 18); c.fillStyle = '#9fd6ff'; c.fillRect(wx, -38, 16, 14); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(wx + 2, -36, 5, 5); c.strokeStyle = '#5a3a20'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(wx + 8, -38); c.lineTo(wx + 8, -24); c.stroke(); }
      // telhado
      const roofY = wallTop + 4;
      c.fillStyle = o.roof; c.beginPath(); c.moveTo(-W / 2 - 12, roofY); c.lineTo(W / 2 + 12, roofY); c.lineTo(W / 2 - 14, roofY - 40); c.lineTo(-W / 2 + 14, roofY - 40); c.closePath(); c.fill();
      c.fillStyle = shade(o.roof, -35); c.fillRect(-W / 2 - 12, roofY - 4, W + 24, 6);
      c.strokeStyle = shade(o.roof, -25); c.lineWidth = 1;
      for (let k = 1; k < 4; k++) { const yy = roofY - k * 10; const inset = 12 - (26 * k / 4); c.beginPath(); c.moveTo(-W / 2 - inset + 2, yy); c.lineTo(W / 2 + inset - 2, yy); c.stroke(); }
      c.fillStyle = '#7a6a5a'; c.fillRect(W / 4, roofY - 52, 10, 18);
      break;
    }
    case 'fountain': {
      ell(c, 0, -6, 36, 14, 'rgba(0,0,0,0.2)');
      ell(c, 0, -12, 34, 16, '#9a958a'); ell(c, 0, -14, 30, 13, '#4a90d8');
      ell(c, 0, -14 + Math.sin(t * 2) * 0.5, 24, 9, 'rgba(255,255,255,0.15)');
      c.fillStyle = '#b8b2a5'; c.fillRect(-5, -44, 10, 30);
      ell(c, 0, -44, 12, 5, '#b8b2a5'); ell(c, 0, -45, 9, 3.5, '#4a90d8');
      for (let k = 0; k < 6; k++) { const a = (t * 3 + k) % 1; const ang = k / 6 * Math.PI * 2; circ(c, Math.cos(ang) * 12 * a, -46 + a * 32 - Math.sin(a * Math.PI) * 14, 1.6, 'rgba(200,230,255,0.85)'); }
      break;
    }
    case 'lamp': {
      shadow(c, 6, 2);
      c.fillStyle = '#3a3a44'; c.fillRect(-2, -38, 4, 38);
      c.fillStyle = '#2a2a33'; c.fillRect(-6, -46, 12, 10);
      const glow = 0.6 + Math.sin(t * 3 + o.x) * 0.1;
      circ(c, 0, -41, 4, `rgba(255,220,120,${glow})`);
      circ(c, 0, -41, 12, 'rgba(255,220,120,0.12)');
      break;
    }
    case 'crate': {
      shadow(c, 12, 4);
      c.fillStyle = '#a0703c'; c.fillRect(-12, -22, 24, 22);
      c.strokeStyle = '#6b4426'; c.lineWidth = 2; c.strokeRect(-12, -22, 24, 22); c.beginPath(); c.moveTo(-12, -22); c.lineTo(12, 0); c.moveTo(12, -22); c.lineTo(-12, 0); c.stroke();
      break;
    }
  }
  c.restore();
}

function drawPortal(c, p, t) {
  const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
  c.save(); c.translate(x, y);
  for (let k = 0; k < 3; k++) {
    c.strokeStyle = k === 1 ? 'rgba(180,120,255,0.8)' : 'rgba(100,220,255,0.8)';
    c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, 0, 18 - k * 4, 8 - k * 2, 0, t * (2 + k) + k, t * (2 + k) + k + Math.PI * 1.4); c.stroke();
  }
  ell(c, 0, 0, 12, 5, 'rgba(160,220,255,0.25)');
  for (let k = 0; k < 6; k++) {
    const a = ((t * 0.6 + k / 6) % 1);
    circ(c, Math.sin(k * 2.3 + t) * 10, -a * 34, 2 * (1 - a), `rgba(170,230,255,${1 - a})`);
  }
  c.restore();
}

/* ---------------- Humanoides (jogador / NPC) ---------------- */
function drawWeapon(c, w) {
  switch (w) {
    case 'adaga': c.fillStyle = '#d8dde6'; c.fillRect(-1, -12, 3, 9); c.fillStyle = '#6b4426'; c.fillRect(-1, -3, 3, 4); c.fillStyle = '#c9a227'; c.fillRect(-3, -4, 7, 2); break;
    case 'espada': c.fillStyle = '#e4e8ef'; c.fillRect(-1.5, -22, 4, 18); c.beginPath(); c.moveTo(-1.5, -22); c.lineTo(0.5, -26); c.lineTo(2.5, -22); c.fill(); c.fillStyle = '#c9a227'; c.fillRect(-5, -5, 11, 3); c.fillStyle = '#6b4426'; c.fillRect(-1, -2, 3, 5); break;
    case 'lanca': c.fillStyle = '#7a5532'; c.fillRect(-1, -30, 3, 38); c.fillStyle = '#d8dde6'; c.beginPath(); c.moveTo(-3, -30); c.lineTo(0.5, -40); c.lineTo(4, -30); c.fill(); break;
    case 'cajado': c.fillStyle = '#7a5532'; c.fillRect(-1.2, -26, 3, 32); circ(c, 0.3, -28, 4, '#7fd3ff'); circ(c, 0.3, -28, 7, 'rgba(127,211,255,0.25)'); break;
    case 'arco': c.strokeStyle = '#8a5a2b'; c.lineWidth = 2.5; c.beginPath(); c.arc(-4, -6, 13, -1.2, 1.2); c.stroke(); c.strokeStyle = '#eee'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-4 + Math.cos(-1.2) * 13, -6 + Math.sin(-1.2) * 13); c.lineTo(-4 + Math.cos(1.2) * 13, -6 + Math.sin(1.2) * 13); c.stroke(); break;
    case 'garra': c.fillStyle = '#d8dde6'; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(k * 3 - 1, -2); c.lineTo(k * 3.5, -12); c.lineTo(k * 3 + 1.5, -2); c.fill(); } break;
  }
}

function drawHat(c, hat, hair, accent) {
  switch (hat) {
    case 'wizard': c.fillStyle = accent ? shade(accent, -60) : '#3a3a8a'; c.beginPath(); c.moveTo(-12, -29); c.lineTo(12, -29); c.lineTo(-2, -50); c.closePath(); c.fill(); ell(c, 0, -29, 13, 3.5, shade(accent || '#5050aa', -40)); circ(c, -2, -50, 2, accent || '#ffd84a'); break;
    case 'helm': c.fillStyle = '#b8c0cc'; c.beginPath(); c.arc(0, -27, 9.5, Math.PI, 0); c.fill(); c.fillRect(-9.5, -28, 19, 4); c.fillStyle = '#8a929e'; c.fillRect(-1, -37, 2, 10); break;
    case 'hood': c.fillStyle = shade(accent || '#555', -30); c.beginPath(); c.arc(0, -26, 10, Math.PI * 0.95, Math.PI * 2.05); c.fill(); c.fillRect(-10, -27, 4, 10); break;
    case 'bandana': c.fillStyle = '#c0392b'; c.fillRect(-9, -31, 18, 4); c.beginPath(); c.moveTo(-9, -30); c.lineTo(-15, -27); c.lineTo(-13, -31); c.fill(); break;
    case 'feather': c.fillStyle = '#3f6b2a'; c.beginPath(); c.ellipse(0, -32, 10, 4, 0, Math.PI, 0); c.fill(); c.fillRect(-10, -33, 20, 2); c.strokeStyle = '#e04848'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, -33); c.quadraticCurveTo(-12, -44, -14, -40); c.stroke(); break;
    case 'straw': ell(c, 0, -31, 15, 4, '#e0c070'); c.fillStyle = '#d4b060'; c.beginPath(); c.ellipse(0, -33, 8, 6, 0, Math.PI, 0); c.fill(); c.fillStyle = '#c0392b'; c.fillRect(-8, -34, 16, 2); break;
  }
}

function drawHumanoid(c, x, y, o, t) {
  c.save(); c.translate(x, y);
  const s = o.scale || 1;
  shadow(c, 10 * s, 4 * s);
  c.scale(s * (o.dir < 0 ? -1 : 1), s);
  const bob = o.walk ? Math.abs(Math.sin(o.walkT * 11)) * 2 : Math.sin(t * 2 + (o.seed || 0)) * 0.6;
  c.translate(0, -bob + (o.sit ? 6 : 0));
  const lg = o.walk ? Math.sin(o.walkT * 11) * 3 : 0;
  // capa
  if (o.cape) { c.fillStyle = shade(o.accent, -40); c.beginPath(); c.moveTo(-6, -19); c.lineTo(6, -19); c.lineTo(9 - lg * 0.3, o.sit ? -6 : -2); c.lineTo(-11 - lg * 0.5, o.sit ? -6 : -1); c.closePath(); c.fill(); }
  // pernas
  c.fillStyle = '#3a3040';
  if (o.sit) { c.fillRect(-5, -8, 12, 4); c.fillRect(-4, -6, 12, 4); }
  else { c.fillRect(-5 + lg * 0.6, -8, 4, 8); c.fillRect(1 - lg * 0.6, -8, 4, 8); c.fillStyle = '#2a2025'; c.fillRect(-5 + lg * 0.6, -2, 5, 2); c.fillRect(1 - lg * 0.6, -2, 5, 2); }
  // braço de trás
  c.fillStyle = shade(o.body, -30); c.fillRect(-9, -18, 4, 9);
  // corpo
  if (o.robe) { c.fillStyle = o.body; c.beginPath(); c.moveTo(-7, -19); c.lineTo(7, -19); c.lineTo(9, o.sit ? -5 : -3); c.lineTo(-9, o.sit ? -5 : -3); c.closePath(); c.fill(); }
  rrect(c, -7, -20, 14, 13, 4, o.body);
  c.fillStyle = o.accent; c.fillRect(-7, -11, 14, 2.5);
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-5, -19, 3, 8);
  // cabeça
  circ(c, 0, -27, 8.5, o.skin);
  // cabelo
  c.fillStyle = o.hair;
  c.beginPath(); c.arc(0, -28, 9, Math.PI * 0.95, Math.PI * 2.05); c.fill();
  if (o.hairStyle === 1) { c.fillRect(-9.5, -29, 4, 13); }
  else if (o.hairStyle === 2) { circ(c, -9, -30, 4.5, o.hair); }
  else { c.beginPath(); c.moveTo(-9, -28); c.lineTo(-10, -20); c.lineTo(-5, -27); c.fill(); }
  c.beginPath(); c.moveTo(-2, -33); c.lineTo(7, -31); c.lineTo(8.5, -27); c.lineTo(3, -29); c.fill();
  // olhos
  if (o.eyes) { circ(c, 3, -26, 1.6, o.eyes); circ(c, 6.5, -26, 1.6, o.eyes); }
  else {
    const blink = (Math.sin(t * 0.9 + (o.seed || 0) * 3) > 0.985);
    c.fillStyle = '#1e1a2a';
    if (blink) { c.fillRect(2, -26, 2.6, 1); c.fillRect(5.6, -26, 2.6, 1); }
    else { c.fillRect(2.2, -27.5, 2.2, 3.2); c.fillRect(5.8, -27.5, 2.2, 3.2); c.fillStyle = '#fff'; c.fillRect(2.6, -27.3, 1, 1); c.fillRect(6.2, -27.3, 1, 1); }
    circ(c, 7.5, -23.5, 1.4, 'rgba(255,120,120,0.35)');
  }
  if (o.hat) drawHat(c, o.hat, o.hair, o.accent);
  // braço da frente + arma
  const sw = o.atk > 0 ? Math.sin(o.atk * Math.PI) : 0;
  c.save(); c.translate(5, -16);
  const isBow = o.weapon === 'arco';
  c.rotate(isBow ? 0.1 - sw * 0.2 : -0.5 + sw * 2.0);
  if (o.weapon) drawWeapon(c, o.weapon);
  c.fillStyle = o.skin; c.fillRect(-2, -1, 4, 6);
  c.restore();
  c.restore();
}

/* ---------------- Monstros ---------------- */
function drawMonster(c, m, t) {
  const d = m.def, s = d.size;
  c.save();
  c.translate(m.x, m.y);
  if (m.dead) { const k = Math.min(1, (G.time - m.deathT) / 0.6); c.globalAlpha = 1 - k; c.translate(0, -k * 6); }
  shadow(c, 12 * s, 4.5 * s);
  if (m.dir < 0) c.scale(-1, 1);
  c.scale(s, s);
  const ph = t * 6 + m.uid;
  const moving = m.moving;
  const frozen = m.status.freeze > G.time;
  const tt = frozen ? 0 : t;
  switch (d.shape) {
    case 'blob': {
      const sq = 1 + Math.sin(tt * (moving ? 10 : 4) + m.uid) * (moving ? 0.12 : 0.06);
      const hop = moving ? Math.abs(Math.sin(tt * 5 + m.uid)) * 4 : 0;
      c.translate(0, -hop);
      c.fillStyle = d.color; c.beginPath(); c.ellipse(0, -9 / sq, 13 * sq, 10 / sq, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(d.color, -40); c.beginPath(); c.ellipse(0, -2, 12 * sq, 3, 0, 0, Math.PI); c.fill();
      ell(c, -5, -14, 4, 2.5, 'rgba(255,255,255,0.6)');
      c.fillStyle = '#1e1a2a'; c.fillRect(2, -12, 2.2, 3.5); c.fillRect(7, -12, 2.2, 3.5);
      if (d.mini) { c.strokeStyle = '#1e1a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(1, -15); c.lineTo(5, -13.5); c.moveTo(10, -15); c.lineTo(6.5, -13.5); c.stroke(); }
      c.strokeStyle = '#1e1a2a'; c.lineWidth = 1; c.beginPath(); c.arc(5.5, -7.5, 2, 0.2, Math.PI - 0.2); c.stroke();
      break;
    }
    case 'mushroom': {
      const hop = moving ? Math.abs(Math.sin(tt * 7 + m.uid)) * 3 : 0;
      c.translate(0, -hop);
      rrect(c, -6, -12, 12, 12, 3, '#efe4d0');
      c.fillStyle = '#1e1a2a'; c.fillRect(0, -8, 2, 3); c.fillRect(4, -8, 2, 3);
      c.fillStyle = d.color; c.beginPath(); c.ellipse(0, -12, 14, 10, 0, Math.PI, 0); c.fill();
      c.fillStyle = shade(d.color, -40); c.fillRect(-14, -13, 28, 2);
      circ(c, -6, -17, 2.5, '#fff'); circ(c, 4, -19, 3, '#fff'); circ(c, 9, -14, 1.8, '#fff');
      break;
    }
    case 'rabbit': {
      const hop = moving ? Math.abs(Math.sin(tt * 8 + m.uid)) * 6 : 0;
      c.translate(0, -hop);
      ell(c, -1, -9, 11, 8, d.color);
      circ(c, -11, -10, 3, '#fff');
      circ(c, 8, -15, 6.5, d.color);
      c.fillStyle = d.color; c.beginPath(); c.ellipse(4, -26, 2.5, 8, -0.25, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(8, -27, 2.5, 8, 0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffb3c4'; c.beginPath(); c.ellipse(8, -27, 1, 5, 0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8c860'; c.beginPath(); c.moveTo(10, -20); c.lineTo(14, -27); c.lineTo(12.5, -19); c.fill();
      c.fillStyle = '#1e1a2a'; c.fillRect(10, -17, 2, 2.5);
      circ(c, 14, -14, 1, '#ff8aa0');
      break;
    }
    case 'bee': {
      const fy = -18 + Math.sin(tt * 5 + m.uid) * 3;
      c.translate(0, fy);
      const wing = Math.abs(Math.sin(tt * 40));
      c.fillStyle = 'rgba(230,240,255,0.7)'; c.beginPath(); c.ellipse(-3, -8, 5, 8 * wing + 1, -0.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(2, -8, 4, 7 * wing + 1, 0.3, 0, Math.PI * 2); c.fill();
      ell(c, 0, 0, 10, 7, d.color);
      c.fillStyle = '#1e1a2a'; c.fillRect(-5, -6, 3, 12); c.fillRect(0, -7, 3, 14);
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(-15, 1); c.lineTo(-10, 2.5); c.fill();
      circ(c, 8, -2, 2, '#1e1a2a'); circ(c, 8.5, -2.5, 0.7, '#fff');
      break;
    }
    case 'wolf': {
      const step = moving ? Math.sin(tt * 12 + m.uid) * 3 : 0;
      c.strokeStyle = shade(d.color, -40); c.lineWidth = 3.5; c.lineCap = 'round';
      for (const [lx, k] of [[-8, 1], [-4, -1], [5, 1], [9, -1]]) { c.beginPath(); c.moveTo(lx, -10); c.lineTo(lx + step * k, -1); c.stroke(); }
      c.fillStyle = shade(d.color, -20); c.beginPath(); c.moveTo(-13, -14); c.quadraticCurveTo(-24, -20 + step, -20, -26); c.quadraticCurveTo(-18, -18, -11, -12); c.fill();
      ell(c, 0, -14, 14, 7.5, d.color);
      ell(c, 2, -11, 9, 3.5, shade(d.color, 25));
      ell(c, 14, -20, 7, 6, d.color);
      ell(c, 20, -18, 5, 3, shade(d.color, 15));
      circ(c, 24, -19, 1.5, '#1e1a2a');
      c.fillStyle = shade(d.color, -30); c.beginPath(); c.moveTo(10, -24); c.lineTo(12, -32); c.lineTo(15, -25); c.fill(); c.beginPath(); c.moveTo(14, -25); c.lineTo(17, -31); c.lineTo(18, -23); c.fill();
      circ(c, 16, -21, 1.6, m.target ? '#ff4040' : '#ffd84a');
      break;
    }
    case 'scarecrow': {
      const hop = moving ? Math.abs(Math.sin(tt * 5 + m.uid)) * 5 : 0;
      c.translate(0, -hop);
      c.fillStyle = '#6b4a2f'; c.fillRect(-2, -30, 4, 30);
      c.fillRect(-16, -24, 32, 3);
      c.fillStyle = '#7a4a8a'; c.beginPath(); c.moveTo(-10, -26); c.lineTo(10, -26); c.lineTo(12, -10); c.lineTo(6, -12); c.lineTo(2, -8); c.lineTo(-3, -12); c.lineTo(-12, -10); c.closePath(); c.fill();
      c.strokeStyle = '#e0c070'; c.lineWidth = 1.5; for (const sx of [-16, 16]) for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(sx, -23); c.lineTo(sx + Math.sign(sx) * 4, -23 + k * 3); c.stroke(); }
      circ(c, 0, -33, 8, '#d8c39a');
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(1, -35); c.lineTo(4, -32); c.moveTo(4, -35); c.lineTo(1, -32); c.moveTo(5, -35); c.lineTo(8, -32); c.moveTo(8, -35); c.lineTo(5, -32); c.stroke();
      c.beginPath(); c.moveTo(-1, -29); for (let k = 0; k < 4; k++) c.lineTo(1 + k * 2, k % 2 ? -28 : -30); c.stroke();
      ell(c, 0, -40, 14, 3.5, '#c9a15a'); c.fillStyle = '#b8904a'; c.beginPath(); c.ellipse(0, -41, 7, 6, 0, Math.PI, 0); c.fill();
      break;
    }
    case 'bat': {
      const fy = -24 + Math.sin(tt * 6 + m.uid) * 4;
      c.translate(0, fy);
      const flap = Math.sin(tt * 22 + m.uid);
      c.fillStyle = shade(d.color, -20);
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0, -2); c.lineTo(sx * 18, -8 - flap * 8); c.lineTo(sx * 14, 0); c.lineTo(sx * 9, -1 - flap * 3); c.lineTo(sx * 5, 3); c.closePath(); c.fill(); }
      ell(c, 0, 0, 7, 7, d.color);
      c.fillStyle = d.color; c.beginPath(); c.moveTo(-5, -5); c.lineTo(-4, -12); c.lineTo(-1, -6); c.fill(); c.beginPath(); c.moveTo(5, -5); c.lineTo(4, -12); c.lineTo(1, -6); c.fill();
      circ(c, -2.5, -1, 1.5, '#ff4040'); circ(c, 2.5, -1, 1.5, '#ff4040');
      c.fillStyle = '#fff'; c.fillRect(-2, 3, 1.2, 2); c.fillRect(1, 3, 1.2, 2);
      break;
    }
    case 'skeleton': {
      const lg = moving ? Math.sin(tt * 10 + m.uid) * 3 : 0;
      c.strokeStyle = d.color; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-2, -12); c.lineTo(-3 + lg, 0); c.moveTo(2, -12); c.lineTo(3 - lg, 0); c.stroke();
      c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -12); c.stroke();
      c.lineWidth = 1.8; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-5, -22 + k * 3); c.quadraticCurveTo(0, -20 + k * 3, 5, -22 + k * 3); c.stroke(); }
      c.beginPath(); c.moveTo(-5, -22); c.lineTo(-8, -14); c.stroke();
      c.save(); c.translate(6, -21); c.rotate(-0.6 + (m.atkAnim || 0) * 1.8); c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(2, 7); c.stroke(); c.fillStyle = '#8a7a6a'; c.fillRect(1, 2, 3, -20); c.restore();
      circ(c, 1, -30, 7, d.color);
      c.fillStyle = '#1e1a2a'; circ(c, 3, -31, 2, '#1e1a2a'); circ(c, 7, -31, 1.7, '#1e1a2a');
      c.fillRect(2, -26, 6, 1.5);
      if (m.target) { circ(c, 3, -31, 0.8, '#ff6040'); circ(c, 7, -31, 0.8, '#ff6040'); }
      break;
    }
    case 'golem': {
      const lg = moving ? Math.sin(tt * 5 + m.uid) * 2 : 0;
      c.fillStyle = shade(d.color, -30); c.fillRect(-10, -9 + lg, 7, 9 - lg); c.fillRect(3, -9 - lg, 7, 9 + lg);
      rrect(c, -14, -32, 28, 25, 5, d.color);
      ell(c, -6, -30, 8, 3.5, '#5f9a45'); ell(c, 8, -16, 5, 3, '#5f9a45');
      const arm = (m.atkAnim || 0) * 8;
      rrect(c, -21, -29, 8, 18, 3, shade(d.color, -15)); rrect(c, 13, -29 - arm, 8, 18, 3, shade(d.color, -15));
      rrect(c, -6, -42, 14, 11, 3, shade(d.color, 10));
      circ(c, 1, -37, 1.8, '#ffe36a'); circ(c, 5, -37, 1.8, '#ffe36a');
      circ(c, 3, -37, 6, 'rgba(255,227,106,0.15)');
      break;
    }
    case 'ghost': {
      const fy = -10 + Math.sin(tt * 3 + m.uid) * 3;
      c.translate(0, fy);
      c.globalAlpha *= 0.82;
      c.fillStyle = d.color; c.beginPath(); c.moveTo(-11, -14); c.arc(0, -14, 11, Math.PI, 0);
      c.lineTo(11, 4); for (let k = 0; k < 4; k++) { const xx = 11 - (k + 1) * 5.5; c.quadraticCurveTo(xx + 2.75, 8 + Math.sin(tt * 6 + k) * 2, xx, 2); }
      c.closePath(); c.fill();
      c.globalAlpha /= 0.82;
      ell(c, 2, -16, 2, 3, '#1e1a3a'); ell(c, 7, -16, 2, 3, '#1e1a3a');
      ell(c, 4.5, -9, 2, 2.5, '#1e1a3a');
      break;
    }
    case 'knight': {
      c.scale(1 / s, 1 / s);
      drawHumanoid(c, 0, 0, { dir: 1, walk: moving, walkT: m.walkT, body: d.color, accent: '#7a1f1f', hair: '#222', skin: '#2a2a30', hat: 'helm', weapon: 'espada', cape: true, eyes: '#ff3b3b', scale: s, atk: m.atkAnim || 0, seed: m.uid }, t);
      break;
    }
    case 'treant': {
      const sway = Math.sin(tt * 1.5 + m.uid) * 2;
      c.fillStyle = '#4a3220';
      for (const [rx, k] of [[-10, -1], [10, 1], [0, 0]]) { c.beginPath(); c.moveTo(rx - 3, -6); c.lineTo(rx + k * 9, 1); c.lineTo(rx + 3, -6); c.fill(); }
      rrect(c, -11, -36, 22, 32, 6, '#5a3d26');
      c.strokeStyle = '#3d2a18'; c.lineWidth = 1.2; for (let k = -6; k <= 6; k += 4) { c.beginPath(); c.moveTo(k, -34); c.lineTo(k + 1, -8); c.stroke(); }
      const arm = (m.atkAnim || 0) * 10;
      c.strokeStyle = '#5a3d26'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, -26); c.lineTo(-20, -34 + sway + arm); c.moveTo(10, -26); c.lineTo(21, -36 - sway + arm); c.stroke();
      circ(c, -6, -42 + sway * 0.5, 13, '#2f5a2b'); circ(c, 8, -44 - sway * 0.5, 12, '#2f5a2b'); circ(c, 0, -52, 13, '#3d7036'); circ(c, -4, -56, 6, '#4f8a44');
      circ(c, -2, -26, 2.5, '#ffb84a'); circ(c, 5, -26, 2.5, '#ffb84a');
      circ(c, 1.5, -26, 9, 'rgba(255,184,74,0.15)');
      c.fillStyle = '#2a1a0a'; c.beginPath(); c.ellipse(1.5, -17, 4, 2.5 + (m.atkAnim || 0) * 2, 0, 0, Math.PI * 2); c.fill();
      break;
    }
  }
  c.restore();
  // efeitos de estado
  if (!m.dead) {
    const top = m.y - monsterHeight(m);
    if (frozen) { c.fillStyle = 'rgba(160,220,255,0.35)'; c.strokeStyle = 'rgba(220,245,255,0.9)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(m.x - 14 * s, top + 4, 28 * s, monsterHeight(m) - 2, 4); c.fill(); c.stroke(); }
    if (m.status.stun > G.time) for (let k = 0; k < 3; k++) { const a = t * 4 + k * 2.1; outlinedText(c, '★', m.x + Math.cos(a) * 10, top - 2 + Math.sin(a) * 3, '#ffe36a', 9); }
    if (m.status.poison && m.status.poison.until > G.time) circ(c, m.x + Math.sin(t * 3) * 8, top + 6 - ((t * 20) % 14), 2, 'rgba(140,220,90,0.8)');
    if (G.time - m.hitT < 0.1) { c.save(); c.globalAlpha = 0.5; ell(c, m.x, m.y - monsterHeight(m) / 2, 13 * s, monsterHeight(m) / 2, '#fff'); c.restore(); }
  }
}
function monsterHeight(m) {
  const base = { blob: 22, mushroom: 22, rabbit: 30, bee: 34, wolf: 30, scarecrow: 44, bat: 38, skeleton: 38, golem: 44, ghost: 30, knight: 38, treant: 64 }[m.def.shape] || 30;
  return base * m.def.size;
}

/* ---------------- Drops ---------------- */
function drawDrop(c, d, t) {
  const it = ITEMS[d.id];
  const bob = Math.sin(t * 3 + d.uid) * 1.5;
  const age = G.time - d.t;
  const pop = Math.min(1, age / 0.3);
  const jump = Math.sin(pop * Math.PI) * 14;
  c.save(); c.translate(d.x, d.y);
  ell(c, 0, 0, 7, 2.5, 'rgba(0,0,0,0.25)');
  if (d.isCard) {
    const g = 0.5 + Math.sin(t * 5) * 0.3;
    circ(c, 0, -8 - jump, 14, `rgba(255,215,90,${g * 0.35})`);
    for (let k = 0; k < 4; k++) { const a = t * 2 + k * Math.PI / 2; circ(c, Math.cos(a) * 12, -8 - jump + Math.sin(a) * 5, 1.5, '#fff6c0'); }
  }
  c.font = '15px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(it.icon, 0, -8 + bob - jump);
  c.restore();
}

/* ---------------- Efeitos ---------------- */
function drawEffect(c, e, t) {
  const k = (t - e.t0) / e.dur;
  if (k < 0) return;
  const col = e.color || '#fff';
  c.save(); c.translate(e.x, e.y);
  switch (e.type) {
    case 'slash': {
      c.strokeStyle = col; c.lineWidth = 3 * (1 - k); c.globalAlpha = 1 - k;
      c.beginPath(); c.arc(0, -16, 14 + k * 6, -2.4 + k, -0.4 + k); c.stroke();
      c.beginPath(); c.arc(0, -16, 9 + k * 6, -2.2 + k, -0.6 + k); c.stroke();
      break;
    }
    case 'hitspark': {
      c.globalAlpha = 1 - k;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + e.seed; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(a) * 4 * k, -14 + Math.sin(a) * 4 * k); c.lineTo(Math.cos(a) * (6 + 10 * k), -14 + Math.sin(a) * (6 + 10 * k)); c.stroke(); }
      break;
    }
    case 'ring': {
      c.globalAlpha = 1 - k; c.strokeStyle = col; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0, 0, e.r * k, e.r * k * 0.45, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = col; c.globalAlpha = (1 - k) * 0.2; c.fill();
      break;
    }
    case 'quake': {
      c.globalAlpha = 1 - k;
      c.strokeStyle = '#a07a40'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 0, e.r * k, e.r * k * 0.45, 0, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const rr = e.r * k * 0.9; rrect(c, Math.cos(a) * rr - 3, Math.sin(a) * rr * 0.45 - 6 - Math.sin(k * Math.PI) * 14, 6, 6, 1, '#8a6a3a'); }
      break;
    }
    case 'heal': {
      for (let i = 0; i < 8; i++) { const a = i * 0.8 + e.seed; const yy = -k * 40 - (i % 3) * 6; c.globalAlpha = 1 - k; outlinedText(c, '+', Math.cos(a) * 12, yy - 10, col, 12); }
      c.globalAlpha = (1 - k) * 0.4; ell(c, 0, 0, 18, 7, col);
      break;
    }
    case 'aura': {
      for (let i = 0; i < 3; i++) { const kk = (k + i / 3) % 1; c.globalAlpha = (1 - kk) * (1 - k * 0.5); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -kk * 34, 14, 5, 0, 0, Math.PI * 2); c.stroke(); }
      break;
    }
    case 'levelup': {
      c.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
      const g = c.createLinearGradient(0, -90, 0, 0); g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(1, 'rgba(255,230,120,0.55)');
      c.fillStyle = g; c.fillRect(-16, -90, 32, 90);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + t * 2; circ(c, Math.cos(a) * 18, -k * 60 - (i % 3) * 8 + Math.sin(a) * 6, 2, '#fff6c0'); }
      outlinedText(c, e.text, 0, -60 - k * 20, '#ffe36a', 15);
      break;
    }
    case 'lightning': {
      c.globalAlpha = 1 - k; c.strokeStyle = col; c.lineWidth = 3; c.shadowColor = col; c.shadowBlur = 12;
      c.beginPath(); let yy = -200, xx = 0; c.moveTo(xx, yy);
      const rng = mulberry32(e.seed * 1000 | 0);
      while (yy < -14) { yy += 18; xx = (rng() - 0.5) * 18; c.lineTo(xx, Math.min(yy, -14)); }
      c.stroke();
      break;
    }
    case 'meteor': {
      if (k < 0.6) { const kk = k / 0.6; const mx = -160 * (1 - kk), my = -260 * (1 - kk); circ(c, mx, my, 10, '#ff8a3d'); circ(c, mx, my, 16, 'rgba(255,120,40,0.35)'); for (let i = 1; i < 6; i++) circ(c, mx - i * 12 * 0.6, my - i * 20 * 0.6, 8 - i, `rgba(255,${120 + i * 20},60,${0.5 - i * 0.08})`); }
      else { const kk = (k - 0.6) / 0.4; c.globalAlpha = 1 - kk; ell(c, 0, 0, e.r * kk, e.r * kk * 0.45, 'rgba(255,120,40,0.5)'); circ(c, 0, -10, 20 * (1 - kk) + 6, '#ffd27a'); }
      break;
    }
    case 'arrowrain': {
      c.strokeStyle = '#e8e0c8'; c.lineWidth = 1.5;
      const rng = mulberry32(e.seed * 1000 | 0);
      for (let i = 0; i < 14; i++) { const ox = (rng() - 0.5) * e.r * 2, oy = (rng() - 0.5) * e.r * 0.9; const kk = (k * 2 + rng()) % 1; c.globalAlpha = 1 - k; c.beginPath(); c.moveTo(ox - 6 + kk * 6, oy - 60 + kk * 60); c.lineTo(ox + kk * 6, oy - 48 + kk * 60); c.stroke(); }
      c.globalAlpha = (1 - k) * 0.3; ell(c, 0, 0, e.r, e.r * 0.45, '#e8e0c8');
      break;
    }
    case 'pillar': {
      const h = Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 46 * (k > 0.7 ? (1 - k) / 0.3 : 1);
      c.fillStyle = '#8a6a3a'; c.beginPath(); c.moveTo(-12, 0); c.lineTo(-3, -h); c.lineTo(4, -h * 0.8); c.lineTo(12, 0); c.fill();
      c.fillStyle = '#a8844a'; c.beginPath(); c.moveTo(-12, 0); c.lineTo(-3, -h); c.lineTo(0, 0); c.fill();
      break;
    }
    case 'holy': {
      c.globalAlpha = 1 - k;
      const g = c.createLinearGradient(0, -160, 0, 0); g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(1, 'rgba(255,240,160,0.6)');
      c.fillStyle = g; c.fillRect(-e.r * 0.25, -160, e.r * 0.5, 160);
      c.strokeStyle = '#ffe680'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, e.r * (0.3 + k * 0.7), e.r * (0.3 + k * 0.7) * 0.45, 0, 0, Math.PI * 2); c.stroke();
      break;
    }
    case 'sound': {
      for (let i = 0; i < 3; i++) { const kk = Math.min(1, k * 1.5 - i * 0.2); if (kk <= 0) continue; c.globalAlpha = 1 - kk; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -10, e.r * kk, e.r * kk * 0.5, 0, 0, Math.PI * 2); c.stroke(); }
      outlinedText(c, '♪', Math.sin(k * 8) * 10, -30 - k * 20, col, 14);
      break;
    }
    case 'blades': {
      c.globalAlpha = 1 - k * 0.6; c.strokeStyle = '#d8dde6'; c.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) { const a = k * 14 + i * Math.PI / 2; c.beginPath(); c.moveTo(Math.cos(a) * 8, -12 + Math.sin(a) * 4); c.lineTo(Math.cos(a) * e.r, -12 + Math.sin(a) * e.r * 0.45); c.stroke(); }
      break;
    }
    case 'telegraph': {
      c.globalAlpha = 0.25 + k * 0.35; c.strokeStyle = '#ff3b3b'; c.lineWidth = 2;
      ell(c, 0, 0, e.r, e.r * 0.45, 'rgba(255,40,40,0.18)');
      c.beginPath(); c.ellipse(0, 0, e.r * k, e.r * k * 0.45, 0, 0, Math.PI * 2); c.stroke();
      break;
    }
    case 'click': {
      c.globalAlpha = 1 - k; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(0, 0, 4 + k * 10, (4 + k * 10) * 0.45, 0, 0, Math.PI * 2); c.stroke();
      break;
    }
    case 'falcon': {
      const kk = k; const fx = -120 + kk * 120, fy = -90 + Math.sin(kk * Math.PI) * 60 + kk * 70;
      c.fillStyle = '#7a5a3a'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - 12, fy - 6 - Math.sin(t * 30) * 5); c.lineTo(fx - 4, fy + 2); c.lineTo(fx - 12, fy + 8 + Math.sin(t * 30) * 5); c.closePath(); c.fill();
      circ(c, fx + 2, fy, 3, '#e8d8b8');
      break;
    }
    case 'text': {
      c.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
      outlinedText(c, e.text, 0, -k * 20, col, e.size || 13);
      break;
    }
  }
  c.restore();
}

function drawProjectile(c, p) {
  const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
  c.save(); c.translate(p.x, p.y - 16); c.rotate(ang);
  if (p.kind === 'arrow' || p.kind === 'firearrow') {
    c.strokeStyle = '#e8e0c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, 0); c.lineTo(4, 0); c.stroke();
    c.fillStyle = p.kind === 'firearrow' ? '#ff8a3d' : '#cfd6e0'; c.beginPath(); c.moveTo(7, 0); c.lineTo(2, -3); c.lineTo(2, 3); c.fill();
    if (p.kind === 'firearrow') circ(c, 4, 0, 5, 'rgba(255,140,60,0.4)');
  } else {
    const col = p.color || '#fff';
    for (let i = 4; i > 0; i--) circ(c, -i * 5, 0, 5 - i * 0.8, col + '55');
    circ(c, 0, 0, 7, col + '66'); circ(c, 0, 0, 4, col); circ(c, 1, -1, 1.6, '#fff');
  }
  c.restore();
}
