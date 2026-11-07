'use strict';
/* =========================================================================
   SUGESTÕES (tecla Q) — marque qualquer coisa do jogo e escreva o que mudar.
   Cada sugestão vai para feedback/sugestoes.json (via server.py) com um print
   e a indicação de onde aquilo vive no código, para o Claude aplicar depois.
   Sem servidor, ficam guardadas no navegador e são enviadas quando houver.
   ========================================================================= */

const FB_KIND = {
  monstro: 'Monstro', npc: 'NPC', item_no_chao: 'Item no chão', jogador: 'Seu personagem', portal: 'Portal',
  cenario: 'Cenário', terreno: 'Terreno', area: 'Área do mapa', interface: 'Interface', mascote: 'Mascote',
};
const FB_CATS = ['🎨 Visual', '⚔️ Jogabilidade', '⚖️ Balanceamento', '🐞 Bug', '🎵 Som', '✨ Ideia nova'];
const OBJ_NAMES = { tree: 'Árvore', pine: 'Pinheiro', bush: 'Arbusto', rock: 'Pedra', pillar: 'Pilar em ruínas', wall: 'Muro em ruínas', deadtree: 'Árvore morta', house: 'Casa', fountain: 'Fonte', lamp: 'Poste de luz', crate: 'Caixote' };
const OBJ_BOX = { tree: [18, 46], pine: [15, 52], bush: [13, 18], rock: [13, 16], pillar: [13, 50], wall: [16, 38], deadtree: [12, 36], house: [92, 150], fountain: [36, 50], lamp: [8, 48], crate: [13, 24] };
const TILE_NAMES = { [TT.GRASS]: 'Grama', [TT.DIRT]: 'Caminho de terra', [TT.STONE]: 'Piso de pedra', [TT.WATER]: 'Água', [TT.DARK]: 'Grama da floresta', [TT.RUIN]: 'Piso de ruínas' };
const FB_QUEUE_KEY = 'aethra_fb_queue';

const FB = {
  picking: false, wasPaused: false, drag: null, hoverPick: null, box: null, cur: null, list: [], server: null,

  init() {
    canvas.addEventListener('mousedown', e => this.onDown(e));
    addEventListener('mousemove', e => this.onMove(e));
    addEventListener('mouseup', e => this.onUp(e));
    // cliques na interface (HUD/janelas) também podem ser marcados
    document.addEventListener('mousedown', e => this.onUiDown(e), true);
    document.addEventListener('click', e => { if (this.picking && this.isUi(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true);
    UI.render_sugestoes = () => this.renderList();
    addEventListener('resize', () => this.placeBox());
    this.refresh().then(() => this.flushQueue());
  },

  /* ---------- fluxo ---------- */
  start() {
    if (G.state !== 'play' && G.state !== 'dead') return;
    if (this.box) return;
    if (this.picking) { this.cancel(); return; }
    this.wasPaused = G.paused;
    this.picking = true;
    setPaused(true);
    document.body.classList.add('fb-picking');
    Sound.play('click');
  },
  cancel() {
    this.picking = false; this.drag = null; this.hoverPick = null; this.hideRect();
    this.closeBox();
    document.body.classList.remove('fb-picking');
    setPaused(this.wasPaused);
  },
  isUi(el) { return !!(el && el.closest && el.closest('#hud, #windows') && !el.closest('#fbbox')); },

  onDown(e) {
    if (!this.picking) return;
    if (e.button === 2) { this.cancel(); return; }
    if (e.button !== 0) return;
    const w = screenToWorld(e.clientX, e.clientY);
    this.drag = { sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY, wx: w.x, wy: w.y, ewx: w.x, ewy: w.y };
  },
  onMove(e) {
    if (!this.picking) return;
    const w = screenToWorld(e.clientX, e.clientY);
    if (this.drag) {
      this.drag.ex = e.clientX; this.drag.ey = e.clientY; this.drag.ewx = w.x; this.drag.ewy = w.y;
      this.showRect(this.drag);
      if (Math.hypot(this.drag.ex - this.drag.sx, this.drag.ey - this.drag.sy) > 12) { this.hoverPick = null; return; }
    }
    // destaque do que está sob o mouse (no máximo ~20x por segundo)
    const now = performance.now();
    if (now - (this._hoverT || 0) < 50) return;
    this._hoverT = now;
    this.hoverPick = e.target === canvas ? this.pickAt(w.x, w.y) : null;
  },
  // retângulo de seleção sobre a tela, com o tamanho escrito
  showRect(d) {
    let r = document.getElementById('fb-rect');
    if (!r) { r = document.createElement('div'); r.id = 'fb-rect'; r.innerHTML = '<span></span>'; document.body.appendChild(r); }
    const x = Math.min(d.sx, d.ex), y = Math.min(d.sy, d.ey), w = Math.abs(d.ex - d.sx), h = Math.abs(d.ey - d.sy);
    if (Math.hypot(w, h) <= 12) { r.style.display = 'none'; return; }
    Object.assign(r.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    r.firstChild.textContent = `Área selecionada · solte para escrever a sugestão`;
  },
  hideRect() { const r = document.getElementById('fb-rect'); if (r) r.style.display = 'none'; },
  onUp(e) {
    if (!this.picking || !this.drag) return;
    const d = this.drag; this.drag = null;
    this.hideRect();
    let target, shot;
    if (Math.hypot(d.ex - d.sx, d.ey - d.sy) > 12) {
      target = this.pickArea(d.wx, d.wy, d.ewx, d.ewy);
      // a área também pode cobrir partes da interface (que não aparecem no print)
      const ui = this.uiInRect(Math.min(d.sx, d.ex), Math.min(d.sy, d.ey), Math.max(d.sx, d.ex), Math.max(d.sy, d.ey));
      if (ui.length) {
        target.details.interface = ui;
        target.name += ` (sobre: ${ui.join(', ')})`;
        target.codigo += ' · interface: js/ui.js, style.css, index.html';
      }
      shot = this.capture(Math.min(d.sx, d.ex), Math.min(d.sy, d.ey), Math.abs(d.ex - d.sx), Math.abs(d.ey - d.sy));
    } else {
      target = this.pickAt(d.wx, d.wy);
      shot = this.capture(d.sx - 160, d.sy - 130, 320, 240);
    }
    this.openBox(target, d.ex, d.ey, shot);
  },
  onUiDown(e) {
    if (!this.picking || !this.isUi(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target;
    const win = el.closest('.win');
    const winTitle = win ? win.querySelector('.win-head .t').textContent : null;
    const region = el.closest('#status') ? 'Painel de status' : el.closest('#hotbar') ? 'Barra de atalhos' : el.closest('#minimap-wrap') ? 'Minimapa'
      : el.closest('#menubar') ? 'Menu lateral' : el.closest('#chat') ? 'Chat' : el.closest('#buffs') ? 'Ícones de buff' : winTitle ? 'Janela "' + winTitle + '"' : 'Interface';
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const tip = el.closest('[data-tip]');
    const box = (win || el.closest('#status, #hotbar, #minimap-wrap, #menubar, #chat, #buffs, #topbar') || el).getBoundingClientRect();
    const shot = box.width * box.height > VW * VH * 0.6 ? this.capture(e.clientX - 200, e.clientY - 150, 400, 300) : this.capture(box.left, box.top, box.width, box.height);
    this.openBox({
      kind: 'interface', id: region, name: region + (txt ? ` — "${txt}"` : ''),
      codigo: 'js/ui.js (janelas/HUD), style.css (aparência), index.html (estrutura)',
      details: { elemento: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''), tooltip: tip ? tip.dataset.tip : undefined },
    }, e.clientX, e.clientY, shot);
  },

  // partes da interface que se sobrepõem a um retângulo da tela
  uiInRect(x0, y0, x1, y1) {
    const parts = [['#status', 'Painel de status'], ['#hotbar', 'Barra de atalhos'], ['#buffs', 'Ícones de buff'], ['#minimap-wrap', 'Minimapa'], ['#menubar', 'Menu lateral'], ['#chat', 'Chat']];
    const out = [];
    const hit = el => { const r = el.getBoundingClientRect(); return r.width && r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0; };
    for (const [sel, name] of parts) { const el = document.querySelector(sel); if (el && el.offsetParent !== null && hit(el)) out.push(name); }
    document.querySelectorAll('#windows .win').forEach(w => { if (hit(w)) out.push('Janela "' + w.querySelector('.win-head .t').textContent + '"'); });
    return out;
  },

  /* ---------- o que está embaixo do clique ---------- */
  pickAt(wx, wy) {
    const p = G.player, map = G.map;
    const tile = [Math.floor(wx / TILE), Math.floor(wy / TILE)];
    let best = null, bd = 1e9;
    for (const m of G.monsters) {
      if (m.dead) continue;
      const h = monsterHeight(m), r = Math.max(16, 14 * m.def.size + 6);
      const d = Math.hypot(wx - m.x, (wy - (m.y - h / 2)) * (r / Math.max(r, h / 2 + 4)));
      if (d < r && d < bd) { bd = d; best = m; }
    }
    if (best) {
      const d = best.def;
      return {
        kind: 'monstro', id: best.type, name: d.name, x: best.x, y: best.y, ref: best, tile,
        codigo: `js/data.js → MONSTERS.${best.type} (status, drops, carta) · js/render.js → drawMonster, forma '${d.shape}' (visual)`,
        details: { nivel: d.lv, elemento: ELEMENTS[d.element].name, forma: d.shape, cor: d.color, tamanho: d.size, hp: `${Math.max(0, Math.round(best.hp))}/${best.maxHp}`, agressivo: !!d.aggressive, chefe: !!d.boss, miniChefe: !!d.mini },
      };
    }
    for (const n of G.npcs) if (Math.hypot(wx - n.x, wy - (n.y - 18)) < 20) {
      return { kind: 'npc', id: n.id, name: n.name, x: n.x, y: n.y, tile, codigo: `js/data.js → MAPS.${G.mapId}.npcs (id '${n.id}') · js/game.js → talkTo (falas) · js/render.js → drawHumanoid (visual)`, details: { titulo: n.title, funcao: n.role, visual: n.look } };
    }
    for (const dr of G.drops) if (Math.hypot(wx - dr.x, wy - (dr.y - 8)) < 14) {
      return { kind: 'item_no_chao', id: dr.id, name: ITEMS[dr.id].name, x: dr.x, y: dr.y, tile, codigo: `js/data.js → ITEMS.${dr.id}`, details: { tipo: ITEMS[dr.id].type, icone: ITEMS[dr.id].icon } };
    }
    if (p && Math.hypot(wx - p.x, wy - (p.y - 18)) < 18) {
      return { kind: 'jogador', id: p.cls, name: `${p.name} (${CLASSES[p.cls].name})`, x: p.x, y: p.y, tile, codigo: `js/data.js → CLASSES.${p.cls} (cores/chapéu) · js/render.js → drawHumanoid (corpo)`, details: { classe: CLASSES[p.cls].name, arma: WEAPON_TYPES[p.d.wtype].name } };
    }
    for (const pt of map.def.portals) {
      const px = pt.x * TILE + TILE / 2, py = pt.y * TILE + TILE / 2;
      if (Math.hypot(wx - px, wy - py) < 22) return { kind: 'portal', id: `${G.mapId}→${pt.to}`, name: `Portal para ${MAPS[pt.to].name}`, x: px, y: py, tile, codigo: `js/data.js → MAPS.${G.mapId}.portals · js/render.js → drawPortal`, details: { destino: pt.to } };
    }
    let obj = null;
    for (const o of map.objects) {
      const b = OBJ_BOX[o.type]; if (!b) continue;
      if (Math.abs(wx - o.x) < b[0] && wy < o.y + 6 && wy > o.y - b[1] && (!obj || o.y > obj.y)) obj = o;
    }
    if (obj) return { kind: 'cenario', id: obj.type, name: OBJ_NAMES[obj.type] || obj.type, x: obj.x, y: obj.y, tile: [obj.tx, obj.ty], codigo: `js/render.js → drawObject, case '${obj.type}' (visual) · js/world.js (onde é colocado)`, details: { tipo: obj.type } };
    const tt = map.get(tile[0], tile[1]);
    return { kind: 'terreno', id: Object.keys(TT).find(k => TT[k] === tt) || '?', name: TILE_NAMES[tt] || 'Fora do mapa', x: wx, y: wy, tile, codigo: 'js/render.js → getGround / PAL (cores do chão) · js/world.js (geração do mapa)', details: { tipo: tt } };
  },
  pickArea(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const inside = e => e.x >= ax && e.x <= bx && e.y >= ay && e.y <= by;
    const count = arr => arr.reduce((o, k) => (o[k] = (o[k] || 0) + 1, o), {});
    const mons = count(G.monsters.filter(m => !m.dead && inside(m)).map(m => m.def.name));
    const npcs = G.npcs.filter(inside).map(n => n.name);
    const objs = count(G.map.objects.filter(inside).map(o => OBJ_NAMES[o.type] || o.type));
    const t0 = [Math.floor(ax / TILE), Math.floor(ay / TILE)], t1 = [Math.floor(bx / TILE), Math.floor(by / TILE)];
    return {
      kind: 'area', id: `${t0.join(',')}-${t1.join(',')}`, name: `Área de ${t1[0] - t0[0] + 1}×${t1[1] - t0[1] + 1} tiles`, x: (ax + bx) / 2, y: (ay + by) / 2, tile: t0, rect: [ax, ay, bx, by],
      codigo: `js/world.js (geração de ${G.mapId}) · js/data.js → MAPS.${G.mapId}`,
      details: { tiles: { de: t0, ate: t1 }, monstros: mons, npcs, cenario: objs },
    };
  },

  /* ---------- print da região marcada ---------- */
  // print da região: o mundo (canvas) e, por cima, as janelas/HUD abertas na tela.
  // Devolve o print do mundo na hora; a interface é desenhada por cima logo depois (assíncrono).
  capture(x, y, w, h) {
    try {
      const pad = 24;
      x = Math.max(0, x - pad); y = Math.max(0, y - pad);
      w = Math.min(VW - x, w + pad * 2); h = Math.min(VH - y, h + pad * 2);
      if (w < 20 || h < 20) return null;
      const sc = Math.min(1, 640 / (w * DPR)) * DPR;
      const c = document.createElement('canvas');
      c.width = Math.round(w * sc); c.height = Math.round(h * sc);
      c.getContext('2d').drawImage(canvas, x * DPR, y * DPR, w * DPR, h * DPR, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      this.captureUi(c, x, y, w, h, url);
      return url;
    } catch (e) { return null; }
  },
  async captureUi(c, x, y, w, h, worldUrl) {
    try {
      const svg = this.uiSvg(x, y, w, h); if (!svg) return;
      const img = new Image();
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      if (this.cur && this.cur.shot === worldUrl) { // ainda é a mesma sugestão aberta
        this.cur.shot = url;
        const el = this.box && this.box.querySelector('.fb-shot'); if (el) el.src = url;
      }
    } catch (e) { /* sem interface no print (o mundo continua lá) */ }
  },
  // copia as partes visíveis da interface que cruzam o retângulo para um SVG (foreignObject)
  uiSvg(x, y, w, h) {
    const PROPS = ['display', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'margin', 'padding', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'background-color', 'background-image', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-shadow', 'text-overflow', 'text-decoration', 'white-space', 'word-break', 'overflow', 'opacity', 'box-shadow', 'flex-direction', 'flex-wrap', 'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'justify-content', 'gap', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'vertical-align', 'position', 'left', 'top', 'right', 'bottom', 'transform', 'z-index', 'visibility', 'list-style', 'object-fit', 'filter', 'outline'];
    const SEL = '#plates > *, #topbar, #minimap-wrap, #menubar, #chat, #mybars, #target3d, #windows .win, #overlay.show > *, #banner, #castbar3d';
    const hit = r => r.width && r.height && r.left < x + w && r.right > x && r.top < y + h && r.bottom > y;
    const tops = [...document.querySelectorAll(SEL)].filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed').filter(el => {
      const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.02 && hit(el.getBoundingClientRect());
    });
    if (!tops.length) return null;
    const copy = (src, top) => {
      if (src.nodeType === 3) return document.createTextNode(src.nodeValue);
      if (src.nodeType !== 1 || /^(SCRIPT|STYLE|AUDIO|VIDEO)$/.test(src.tagName)) return null;
      const cs = getComputedStyle(src); if (cs.display === 'none') return null;
      let out;
      if (src.tagName === 'CANVAS') { out = document.createElement('img'); try { out.src = src.toDataURL(); } catch (e) { } }
      else if (src.tagName === 'IMG') { out = document.createElement('span'); }
      else if (src.tagName === 'INPUT' || src.tagName === 'TEXTAREA') { out = document.createElement('div'); out.textContent = src.value || src.placeholder || ''; }
      else out = document.createElement(/^(svg|path|circle|rect|g|line|polyline|polygon|text)$/i.test(src.tagName) ? 'span' : src.tagName.toLowerCase());
      let st = '';
      for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v && !(p === 'background-image' && /url\(/.test(v))) st += `${p}:${v};`; }
      if (top) { const r = src.getBoundingClientRect(); st += `position:absolute;left:${r.left - x}px;top:${r.top - y}px;right:auto;bottom:auto;margin:0;transform:none;width:${r.width}px;height:${r.height}px;`; }
      out.setAttribute('style', st);
      if (src.tagName !== 'INPUT' && src.tagName !== 'TEXTAREA' && src.tagName !== 'CANVAS') for (const ch of src.childNodes) { const k = copy(ch, false); if (k) out.appendChild(k); }
      return out;
    };
    const root = document.createElement('div');
    root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    root.setAttribute('style', `position:relative;width:${w}px;height:${h}px;overflow:hidden;font-family:Nunito,sans-serif;`);
    for (const el of tops) { const k = copy(el, true); if (k) root.appendChild(k); }
    const html = new XMLSerializer().serializeToString(root);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${html}</foreignObject></svg>`;
  },

  openBox(target, sx, sy, shot) {
    this.picking = false;
    document.body.classList.remove('fb-picking');
    this.cur = { target, shot };
    const b = document.createElement('div');
    b.id = 'fbbox';
    const tl = target.tile ? ` · tile (${target.tile[0]}, ${target.tile[1]})` : '';
    // estrutura: cabeçalho + miolo rolável + botões sempre visíveis embaixo
    b.innerHTML = `<div class="fb-head">💡 Sugestão sobre <b>${FB_KIND[target.kind]}</b>: ${esc(target.name)}</div>
      <div class="fb-meta">${esc(G.map.def.name)}${tl}</div>
      <div class="fb-scroll">
        ${shot ? `<img class="fb-shot" src="${shot}" alt="">` : ''}
        <div class="fb-ta">
          <textarea id="fb-text" rows="4" placeholder="O que você quer mudar aqui? Escreva ou clique no 🎤 e fale.\nEx.: não gostei do visual desse monstro, deixe-o mais fofo."></textarea>
          <button class="fb-mic" id="fb-mic" title="Ditar por voz (clique para começar / parar)">🎤</button>
        </div>
        <div class="fb-voice" id="fb-voice"><canvas id="fb-wave" width="120" height="22"></canvas><span></span></div>
        <div class="fb-cats">${FB_CATS.map(c => `<span class="fb-cat" data-c="${c}">${c}</span>`).join('')}</div>
      </div>
      <div class="fb-actions"><span class="muted">Enter envia · Shift+Enter nova linha · Esc cancela</span><span><button class="btn" id="fb-cancel">Cancelar</button> <button class="btn gold" id="fb-send">Enviar sugestão</button></span></div>`;
    document.body.appendChild(b);
    this.box = b;
    this.anchor = { sx, sy };
    this.placeBox();
    const img = b.querySelector('.fb-shot');
    if (img && !img.complete) img.onload = () => this.placeBox(); // o print aumenta a caixa: reposiciona
    let cat = null;
    b.querySelectorAll('.fb-cat').forEach(el => el.onclick = () => {
      b.querySelectorAll('.fb-cat').forEach(x => x.classList.remove('on'));
      if (cat === el.dataset.c) cat = null; else { cat = el.dataset.c; el.classList.add('on'); }
    });
    const ta = b.querySelector('#fb-text');
    b.querySelector('#fb-mic').onclick = () => (this.voice.on ? this.stopVoice() : this.startVoice(ta));
    ta.addEventListener('input', e => { if (this.voice.on && e.isTrusted) this.voice.base = ta.value; }); // digitou junto com a voz
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') this.cancel();
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.stopVoice(); this.submit(ta.value, cat); } // Shift+Enter = nova linha
    });
    b.querySelector('#fb-cancel').onclick = () => this.cancel();
    b.querySelector('#fb-send').onclick = () => { this.stopVoice(); this.submit(ta.value, cat); };
    ta.focus();
    updatePauseBar();
  },
  // mantém a caixa inteira dentro da tela; clique na metade de baixo abre acima do ponto
  placeBox() {
    const b = this.box; if (!b || !this.anchor) return;
    const { sx, sy } = this.anchor, m = 8;
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let left = sx + 14;
    if (left + bw > VW - m) left = sx - bw - 14;
    left = Math.max(m, Math.min(VW - bw - m, left));
    let top = sy > VH / 2 ? sy - bh - 10 : sy - 40;
    top = Math.max(m, Math.min(VH - bh - m, top));
    b.style.left = left + 'px'; b.style.top = top + 'px';
  },
  closeBox() { this.stopVoice(); if (this.box) { this.box.remove(); this.box = null; } this.cur = null; },

  /* ---------- ditado por voz (🎤) ----------
     Usa o reconhecimento de voz do navegador em pt-BR (Chrome/Edge: Google;
     Safari: Apple). O texto aparece enquanto você fala. */
  voice: { on: false, rec: null, base: '', stream: null, raf: 0, actx: null },
  voiceMsg(text, cls = '') {
    const el = this.box && this.box.querySelector('#fb-voice'); if (!el) return;
    el.className = 'fb-voice' + (cls ? ' ' + cls : '') + (text ? ' show' : '');
    el.querySelector('span').textContent = text;
    this.placeBox(); // a mensagem muda a altura da caixa: mantém tudo (e o Enviar) dentro da tela
  },
  // pontuação falada e maiúsculas, para o texto sair parecido com um texto digitado
  polish(txt) {
    let s = ' ' + txt.trim() + ' ';
    const rules = [[/\s+ponto de interroga[cç][aã]o\b/gi, '?'], [/\s+ponto de exclama[cç][aã]o\b/gi, '!'], [/\s+ponto final\b/gi, '.'], [/\s+v[ií]rgula\b/gi, ','],
      [/\s+dois pontos\b/gi, ':'], [/\s+(nova linha|pr[oó]xima linha|novo par[aá]grafo)\b/gi, '\n'], [/\s+abre par[eê]nteses\b/gi, ' ('], [/\s+fecha par[eê]nteses\b/gi, ')']];
    for (const [re, rep] of rules) s = s.replace(re, rep);
    s = s.replace(/[ \t]+/g, ' ').replace(/ ([,.!?:)])/g, '$1').replace(/ ?\n ?/g, '\n').replace(/^[ \t]+|[ \t]+$/g, ''); // mantém a quebra de linha no fim
    // maiúscula só depois de ponto/quebra de linha; o começo do trecho quem decide é joinText
    return s.replace(/([.!?\n]\s*)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
  },
  joinText(base, add) {
    if (!add) return base;
    if (!base.trim()) return add.charAt(0).toUpperCase() + add.slice(1);
    const endSentence = /[.!?\n]\s*$/.test(base);
    const sep = /[\s\n]$/.test(base) || /^[,.!?:)]/.test(add) ? '' : ' ';
    return base + sep + (endSentence ? add.charAt(0).toUpperCase() + add.slice(1) : add);
  },
  startVoice(ta) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.voiceMsg('Este navegador não tem ditado por voz. Use o Chrome, o Edge ou o Safari.', 'err'); return; }
    const v = this.voice, mic = this.box.querySelector('#fb-mic');
    const rec = new SR();
    rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    v.rec = rec; v.on = true; v.base = ta.value;
    mic.classList.add('on'); mic.textContent = '⏹'; mic.title = 'Parar o ditado';
    this.voiceMsg('🔴 Ouvindo... fale normalmente. Diga "vírgula", "ponto final" ou "nova linha" para pontuar.', 'live');
    rec.onresult = e => {
      let fin = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; }
      if (fin) v.base = this.joinText(v.base, this.polish(fin));
      const tail = interim ? this.joinText(v.base, interim.trim()) : v.base;
      ta.value = tail; ta.scrollTop = ta.scrollHeight;
      ta.classList.toggle('interim', !!interim);
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.stopVoice(); this.voiceMsg('O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço e permita o microfone.', 'err'); }
      else if (e.error === 'network') { this.stopVoice(); this.voiceMsg('O ditado precisa de internet (o navegador transcreve online).', 'err'); }
      else if (e.error === 'audio-capture') { this.stopVoice(); this.voiceMsg('Nenhum microfone encontrado.', 'err'); }
    };
    // o navegador encerra sozinho depois de um silêncio: se ainda estamos ouvindo, recomeça
    rec.onend = () => { if (v.on && v.rec === rec) { try { rec.start(); } catch (err) { } } };
    try { rec.start(); } catch (err) { this.stopVoice(); this.voiceMsg('Não consegui iniciar o ditado.', 'err'); return; }
    this.startWave();
  },
  stopVoice() {
    const v = this.voice;
    if (!v.on && !v.rec) return;
    v.on = false;
    if (v.rec) { try { v.rec.stop(); } catch (err) { } v.rec = null; }
    this.stopWave();
    const mic = this.box && this.box.querySelector('#fb-mic');
    if (mic) { mic.classList.remove('on'); mic.textContent = '🎤'; mic.title = 'Ditar por voz (clique para começar / parar)'; }
    const ta = this.box && this.box.querySelector('#fb-text');
    if (ta) { ta.classList.remove('interim'); ta.focus(); }
    this.voiceMsg('');
  },
  // ondinha que reage à voz (como no app do Claude)
  async startWave() {
    const v = this.voice, cv = this.box && this.box.querySelector('#fb-wave'); if (!cv) return;
    try {
      v.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!v.on) { v.stream.getTracks().forEach(t => t.stop()); v.stream = null; return; }
      v.actx = new (window.AudioContext || window.webkitAudioContext)();
      const an = v.actx.createAnalyser(); an.fftSize = 256;
      v.actx.createMediaStreamSource(v.stream).connect(an);
      const data = new Uint8Array(an.frequencyBinCount), c = cv.getContext('2d'), N = 16;
      const draw = () => {
        if (!v.on) return;
        an.getByteFrequencyData(data);
        c.clearRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < N; i++) {
          const val = data[2 + i * 3] / 255, h = Math.max(2, val * cv.height);
          c.fillStyle = `rgba(255,${120 + val * 100},${110},${0.5 + val * 0.5})`;
          c.fillRect(i * (cv.width / N) + 1, (cv.height - h) / 2, cv.width / N - 3, h);
        }
        v.raf = requestAnimationFrame(draw);
      };
      draw();
    } catch (err) { /* sem onda: o ditado continua funcionando */ }
  },
  stopWave() {
    const v = this.voice;
    cancelAnimationFrame(v.raf);
    if (v.stream) { v.stream.getTracks().forEach(t => t.stop()); v.stream = null; }
    if (v.actx) { v.actx.close().catch(() => { }); v.actx = null; }
  },

  async submit(text, cat) {
    text = (text || '').trim();
    if (!text) { this.box.querySelector('#fb-text').focus(); Sound.play('error'); return; }
    const { target, shot } = this.cur;
    const p = G.player;
    const rec = {
      texto: text, categoria: cat || null, versao: GAME_VERSION,
      alvo: { tipo: target.kind, rotulo: FB_KIND[target.kind], id: target.id, nome: target.name, codigo: target.codigo, detalhes: target.details },
      mapa: { id: G.mapId, nome: G.map.def.name, tile: target.tile || null, pos: [Math.round(target.x || 0), Math.round(target.y || 0)] },
      jogador: { nome: p.name, classe: CLASSES[p.cls].name, nivelBase: p.baseLv, nivelClasse: p.jobLv, hp: `${p.hp}/${p.d.maxHp}`, sp: `${p.sp}/${p.d.maxSp}` },
      screenshot: shot || undefined,
    };
    this.cancel();
    const id = await this.send(rec);
    Sound.play('coin');
    if (id) UI.log(`💡 Sugestão ${id} salva! Quando quiser, peça ao Claude para aplicar suas sugestões.`, 'card');
    else UI.log('💡 Sugestão guardada no navegador (servidor não encontrado). Rode "python3 server.py" para enviá-la ao projeto.', 'warn');
    this.refresh();
  },
  async send(rec) {
    try {
      if (!location.protocol.startsWith('http')) throw new Error('sem servidor');
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      this.server = true;
      return j.id;
    } catch (e) {
      this.server = false;
      const q = this.queue();
      rec.idLocal = 'L-' + Date.now();
      q.push(rec);
      try { localStorage.setItem(FB_QUEUE_KEY, JSON.stringify(q)); }
      catch (err) { delete rec.screenshot; try { localStorage.setItem(FB_QUEUE_KEY, JSON.stringify(q)); } catch (e2) { } }
      return null;
    }
  },
  queue() { try { return JSON.parse(localStorage.getItem(FB_QUEUE_KEY)) || []; } catch (e) { return []; } },
  async refresh() {
    if (location.protocol.startsWith('http')) {
      try { const r = await fetch('/api/feedback'); if (!r.ok) throw 0; this.list = await r.json(); this.server = true; }
      catch (e) { this.server = false; }
    } else this.server = false;
    UI.markDirty();
  },
  async flushQueue() {
    const q = this.queue();
    if (!q.length || !this.server) return;
    let sent = 0;
    const rest = [];
    for (const rec of q) {
      try {
        const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
        if (!r.ok) throw 0; sent++;
      } catch (e) { rest.push(rec); }
    }
    try { localStorage.setItem(FB_QUEUE_KEY, JSON.stringify(rest)); } catch (e) { }
    if (sent) { UI.log(`💡 ${sent} sugestão(ões) guardada(s) no navegador foram enviadas ao projeto.`, 'sys'); this.refresh(); }
  },

  /* ---------- desenho no mapa ---------- */
  renderWorld(c, t) {
    // marcadores das sugestões pendentes deste mapa (visíveis com o jogo pausado)
    if (G.paused) {
      const pins = this.list.filter(s => s.status !== 'feito' && s.mapa && s.mapa.id === G.mapId)
        .concat(this.queue().filter(s => s.mapa && s.mapa.id === G.mapId));
      for (const s of pins) {
        const [x, y] = s.mapa.pos;
        c.save(); c.globalAlpha = 0.9;
        c.font = '14px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('💡', x, y - 46 + Math.sin(t * 3 + x) * 2);
        c.restore();
        outlinedText(c, s.id || 'na fila', x, y - 34, '#ffe36a', 8);
      }
    }
    if (!this.picking) return;
    if (this.drag && Math.hypot(this.drag.ex - this.drag.sx, this.drag.ey - this.drag.sy) > 12) return; // o retângulo é desenhado por cima da tela
    const h = this.hoverPick;
    if (!h) return;
    c.strokeStyle = `rgba(255,215,106,${0.7 + Math.sin(performance.now() / 150) * 0.3})`; c.lineWidth = 2;
    if (h.kind === 'terreno') c.strokeRect(h.tile[0] * TILE + 1, h.tile[1] * TILE + 1, TILE - 2, TILE - 2);
    else {
      const big = h.kind === 'cenario' ? (OBJ_BOX[h.id] || [20])[0] : h.ref ? 16 * h.ref.def.size : 16;
      c.beginPath(); c.ellipse(h.x, h.y, big + 4, (big + 4) * 0.4, 0, 0, Math.PI * 2); c.stroke();
    }
    outlinedText(c, `${FB_KIND[h.kind]}: ${h.name}`, h.x, h.y + 16, '#ffd76a', 10);
  },

  /* ---------- janela de lista (L) ---------- */
  renderList() {
    const q = this.queue().map(s => Object.assign({}, s, { id: 'na fila', status: 'na fila' }));
    const all = this.list.slice().reverse().concat(q);
    const pend = this.list.filter(s => s.status !== 'feito').length + q.length, done = this.list.filter(s => s.status === 'feito').length;
    const srv = this.server ? '<span style="color:#8ff0b0">● Conectado — salvas em <b>feedback/sugestoes.json</b></span>'
      : '<span style="color:#ff8a8a">● Sem servidor — novas sugestões ficam no navegador até você rodar <b>python3 server.py</b></span>';
    const rows = all.map(s => `<div class="fb-row ${s.status === 'feito' ? 'done' : ''}">
        <div><b class="gold">${esc(s.id)}</b> <span class="fb-badge ${s.status === 'feito' ? 'ok' : ''}">${esc(s.status)}</span>
        <span class="muted">${esc((s.alvo && s.alvo.rotulo) || '')}: ${esc((s.alvo && s.alvo.nome) || '')} · ${esc((s.mapa && s.mapa.nome) || '')}</span>${s.categoria ? ` <span class="tag">${esc(s.categoria)}</span>` : ''}</div>
        <div class="fb-txt">${esc(s.texto)}</div>
        ${s.resposta ? `<div class="fb-resp">🤖 ${esc(s.resposta)}</div>` : ''}</div>`).join('') || '<div class="muted">Nenhuma sugestão ainda. Aperte <b>Q</b> e clique em algo do jogo!</div>';
    UI.body('sugestoes').innerHTML = `<div style="margin-bottom:6px">${srv}</div>
      <div style="margin-bottom:8px"><b>${pend}</b> pendente(s) · <b>${done}</b> feita(s) · <span class="muted">P pausa · Q sugere · com o jogo pausado, 💡 marca onde cada sugestão foi feita</span></div>
      <div class="fb-list">${rows}</div>`;
  },
};
FB.init();
