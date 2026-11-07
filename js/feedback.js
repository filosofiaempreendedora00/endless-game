'use strict';
/* =========================================================================
   SUGESTÕES (tecla Q) — marque qualquer coisa do jogo e escreva o que mudar.
   Cada sugestão vai para feedback/sugestoes.json (via server.py) com um print
   e a indicação de onde aquilo vive no código, para o Claude aplicar depois.
   Sem servidor, ficam guardadas no navegador e são enviadas quando houver.
   ========================================================================= */

const FB_KIND = {
  monstro: 'Monstro', npc: 'NPC', item_no_chao: 'Item no chão', jogador: 'Seu personagem', portal: 'Portal',
  cenario: 'Cenário', terreno: 'Terreno', area: 'Área do mapa', interface: 'Interface',
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
    this.picking = false; this.drag = null; this.hoverPick = null;
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
    if (this.drag) { this.drag.ex = e.clientX; this.drag.ey = e.clientY; this.drag.ewx = w.x; this.drag.ewy = w.y; }
    this.hoverPick = e.target === canvas ? this.pickAt(w.x, w.y) : null;
  },
  onUp(e) {
    if (!this.picking || !this.drag) return;
    const d = this.drag; this.drag = null;
    let target, shot;
    if (Math.hypot(d.ex - d.sx, d.ey - d.sy) > 12) {
      target = this.pickArea(d.wx, d.wy, d.ewx, d.ewy);
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
    this.openBox({
      kind: 'interface', id: region, name: region + (txt ? ` — "${txt}"` : ''),
      codigo: 'js/ui.js (janelas/HUD), style.css (aparência), index.html (estrutura)',
      details: { elemento: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''), tooltip: tip ? tip.dataset.tip : undefined },
    }, e.clientX, e.clientY, null);
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
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  },

  /* ---------- caixa de texto ---------- */
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
        <textarea id="fb-text" rows="4" placeholder="O que você quer mudar aqui?\nEx.: não gostei do visual desse monstro, deixe-o mais fofo."></textarea>
        <div class="fb-cats">${FB_CATS.map(c => `<span class="fb-cat" data-c="${c}">${c}</span>`).join('')}</div>
      </div>
      <div class="fb-actions"><span class="muted">Ctrl+Enter envia · Esc cancela</span><span><button class="btn" id="fb-cancel">Cancelar</button> <button class="btn gold" id="fb-send">Enviar sugestão</button></span></div>`;
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
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') this.cancel();
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.submit(ta.value, cat);
    });
    b.querySelector('#fb-cancel').onclick = () => this.cancel();
    b.querySelector('#fb-send').onclick = () => this.submit(ta.value, cat);
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
  closeBox() { if (this.box) { this.box.remove(); this.box = null; } this.cur = null; },

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
    if (this.drag && Math.hypot(this.drag.ex - this.drag.sx, this.drag.ey - this.drag.sy) > 12) {
      const d = this.drag;
      c.strokeStyle = '#ffd76a'; c.lineWidth = 1.5; c.setLineDash([6, 4]);
      c.strokeRect(Math.min(d.wx, d.ewx), Math.min(d.wy, d.ewy), Math.abs(d.ewx - d.wx), Math.abs(d.ewy - d.wy));
      c.setLineDash([]); c.fillStyle = 'rgba(255,215,106,0.12)';
      c.fillRect(Math.min(d.wx, d.ewx), Math.min(d.wy, d.ewy), Math.abs(d.ewx - d.wx), Math.abs(d.ewy - d.wy));
      return;
    }
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
