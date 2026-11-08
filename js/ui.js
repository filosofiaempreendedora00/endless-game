'use strict';
/* =========================================================================
   INTERFACE — HUD, janelas, loja, diálogos, árvore de classes, tooltips.
   ========================================================================= */

const HAIR_COLORS = ['#3b2a1f', '#c9a227', '#b8442c', '#2e3b8f', '#e8e8e8', '#6b3fa0', '#2f7d4f', '#f08cb3'];
const SKIN_COLORS = ['#f6d2b6', '#e8b896', '#c98e66', '#8d5a3b'];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  wins: {}, z: 60, dirty: false, invTab: 'all', invSel: null, cardMode: null, treeSel: null, dlg: null,

  init() {
    document.querySelectorAll('#menubar [data-win]').forEach(b => b.onclick = () => { Sound.play('click'); this.toggle(b.dataset.win); });
    if ($('btn-sound')) $('btn-sound').onclick = () => toggleSound();
    // hotbar
    const hb = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'hslot'; s.dataset.i = i;
      s.innerHTML = `<span class="key">${i + 1}</span><span class="ic"></span><span class="qty"></span><div class="cd"></div>`;
      s.onclick = () => useHotbar(i);
      s.oncontextmenu = e => { e.preventDefault(); G.player.hotbar[i] = null; this.markDirty(); };
      hb.appendChild(s);
    }
    // tooltips
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-tip]');
      if (!el) { this.hideTip(); return; }
      const html = this.tipHtml(el.dataset.tip);
      if (!html) { this.hideTip(); return; }
      const tip = $('tooltip'); tip.innerHTML = html; tip.style.display = 'block';
    });
    document.addEventListener('mousemove', e => {
      const tip = $('tooltip');
      if (tip.style.display !== 'block') return;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 16, y = e.clientY + 14;
      if (x + w > innerWidth - 6) x = e.clientX - w - 12;
      if (y + h > innerHeight - 6) y = innerHeight - h - 6;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    // chat
    // chat minimizável (lembra a escolha)
    $('chat-min').onclick = e => { e.stopPropagation(); this.setChatMin(!this.chatMin); };
    $('chat').addEventListener('click', () => { if (this.chatMin) this.setChatMin(false); });
    try { this.setChatMin(localStorage.getItem('aethra_chat_min') === '1'); } catch (e) { }
    const ci = $('chatinput');
    ci.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = ci.value.trim(); ci.value = '';
        if (v) handleChat(v);
        ci.blur(); e.stopPropagation();
      } else if (e.key === 'Escape') { ci.blur(); }
      e.stopPropagation();
    });
    $('st-alert').onclick = e => { const w = e.target.dataset.win; if (w) this.open(w); };
    if ($('st-pet')) $('st-pet').onclick = () => { this.treeTab = 'pets'; if (this.wins.tree) this.render_tree(); else this.open('tree'); };
  },

  markDirty() { this.dirty = true; },
  chatMin: false, unread: 0,
  setChatMin(on) {
    this.chatMin = on;
    $('chat').classList.toggle('min', on);
    $('chat-min').textContent = on ? '▲' : '—';
    $('chat-min').title = on ? 'Abrir o chat' : 'Minimizar o chat';
    if (!on) { this.unread = 0; $('chat-unread').textContent = ''; $('log').scrollTop = $('log').scrollHeight; }
    try { localStorage.setItem('aethra_chat_min', on ? '1' : '0'); } catch (e) { }
  },
  log(text, cls = 'sys') {
    const l = $('log');
    const d = document.createElement('div'); d.className = cls; d.textContent = text;
    l.appendChild(d);
    while (l.children.length > 100) l.removeChild(l.firstChild);
    l.scrollTop = l.scrollHeight;
    if (this.chatMin && cls !== 'dev') { this.unread++; $('chat-unread').textContent = `(${this.unread})`; }
  },
  hideTip() { $('tooltip').style.display = 'none'; },

  banner(title, sub, dur = 2600) {
    const b = $('banner');
    b.innerHTML = `<div class="b1">${esc(title)}</div><div class="b2">${esc(sub || '')}</div>`;
    b.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), dur);
  },

  /* ---------- HUD por frame ---------- */
  updateHud() {
    const p = G.player; if (!p) return;
    const d = p.d;
    $('st-name').textContent = p.name;
    $('st-class').textContent = CLASSES[p.cls].icon + ' ' + CLASSES[p.cls].name;
    $('st-blv').textContent = p.baseLv; $('st-jlv').textContent = p.jobLv;
    $('bar-hp').style.width = (p.hp / d.maxHp * 100) + '%'; $('txt-hp').textContent = `HP ${p.hp} / ${d.maxHp}`;
    $('bar-sp').style.width = (p.sp / d.maxSp * 100) + '%'; $('txt-sp').textContent = `SP ${p.sp} / ${d.maxSp}`;
    const bn = baseExpNext(p.baseLv), jn = jobExpNext(p.jobLv, CLASSES[p.cls].tier);
    const bp = p.baseLv >= CONFIG.MAX_BASE_LV ? 100 : p.baseExp / bn * 100;
    const jp = p.jobLv >= maxJobLv(p) ? 100 : p.jobExp / jn * 100;
    $('bar-bxp').style.width = bp + '%'; $('txt-bxp').textContent = `EXP Base ${bp.toFixed(1)}%`;
    $('bar-jxp').style.width = jp + '%'; $('txt-jxp').textContent = `EXP Classe ${jp.toFixed(1)}%`;
    $('st-zeny').textContent = p.zeny.toLocaleString('pt-BR');
    $('st-god').classList.toggle('hidden', !G.god);
    // cooldowns da hotbar
    const slots = $('hotbar').children;
    for (let i = 0; i < 9; i++) {
      const h = p.hotbar[i]; const cdEl = slots[i].querySelector('.cd');
      if (h && h.kind === 'skill' && p.cds[h.id] > G.time) {
        const sk = SKILLS[h.id]; cdEl.style.height = Math.min(100, (p.cds[h.id] - G.time) / (sk.cd / 1000) * 100) + '%';
      } else cdEl.style.height = '0';
    }
  },

  refreshHud() {
    const p = G.player;
    const slots = $('hotbar').children;
    for (let i = 0; i < 9; i++) {
      const h = p.hotbar[i], s = slots[i];
      let ic = '', qty = '', tip = '';
      if (h && h.kind === 'skill' && SKILLS[h.id]) { ic = SKILLS[h.id].icon; qty = p.skills[h.id] ? 'Nv' + p.skills[h.id] : ''; tip = 'skill:' + h.id; }
      else if (h && h.kind === 'item' && ITEMS[h.id]) { ic = ITEMS[h.id].icon; qty = countItem(p, h.id); tip = 'item:' + h.id; if (!qty) s.style.opacity = 0.4; }
      s.style.opacity = h && h.kind === 'item' && !countItem(p, h.id) ? 0.4 : 1;
      s.querySelector('.ic').textContent = ic;
      s.querySelector('.qty').textContent = qty;
      if (tip) s.dataset.tip = tip; else delete s.dataset.tip;
    }
    // alertas
    const al = [];
    if (p.statPoints > 0) al.push(`<div data-win="char">▲ ${p.statPoints} pontos de atributo (C)</div>`);
    if (p.skillPoints > 0) al.push(`<div data-win="skills">▲ ${p.skillPoints} pontos de habilidade (K)</div>`);
    if (canChangeClass(p)) al.push(`<div data-win="tree">★ Você pode mudar de classe! Fale com a Mestra Ivra na vila.</div>`);
    $('st-alert').innerHTML = al.join('');
    // buffs
    $('buffs').innerHTML = Object.keys(p.buffs).map(id => `<div class="buff" data-tip="skill:${id}">${SKILLS[id].icon}<small>${Math.ceil(p.buffs[id].until - G.time)}s</small></div>`).join('');
  },

  refreshOpen() {
    this.dirty = false;
    this.refreshHud();
    for (const id in this.wins) if (this.wins[id] && this['render_' + id]) this['render_' + id]();
  },

  /* ---------- Janelas ---------- */
  makeWin(id, title, x, y, width) {
    let w = this.wins[id];
    if (w) { w.style.zIndex = ++this.z; return w; }
    w = document.createElement('div');
    w.className = 'win'; w.id = 'win-' + id;
    w.style.left = x + 'px'; w.style.top = y + 'px'; if (width) w.style.width = width + 'px';
    w.style.zIndex = ++this.z;
    w.innerHTML = `<div class="win-head"><span class="t">${title}</span><span class="x">✕</span></div><div class="win-body"></div>`;
    w.querySelector('.x').onclick = () => this.close(id);
    w.addEventListener('mousedown', () => { w.style.zIndex = ++this.z; });
    const head = w.querySelector('.win-head');
    head.addEventListener('mousedown', e => {
      if (e.target.classList.contains('x')) return;
      const ox = e.clientX - w.offsetLeft, oy = e.clientY - w.offsetTop;
      const mv = ev => { w.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - ox)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - oy)) + 'px'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
    w.querySelector('.win-body').addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a) { Sound.play('click'); this.act(a.dataset.act, a.dataset, e); }
    });
    $('windows').appendChild(w);
    this.wins[id] = w;
    return w;
  },
  body(id) { return this.wins[id].querySelector('.win-body'); },
  open(id) {
    if (id === 'equip') { this.charTab = 'equip'; id = 'char'; } else if (id === 'char' && !this.charTab) this.charTab = 'stats';
    if (id === 'char' && this.wins.char) { this.render_char(); return; }
    const pos = { char: [Math.max(10, innerWidth / 2 - 300), 60, Math.min(600, innerWidth - 20)], inv: [innerWidth - 390, 70, 330], equip: [Math.max(10, innerWidth - 980), 70, Math.min(560, innerWidth - 20)], skills: [300, 70, 420], tree: [Math.max(10, innerWidth / 2 - 330), 60, Math.min(660, innerWidth - 20)], bestiario: [Math.max(10, innerWidth / 2 - 380), 60, Math.min(760, innerWidth - 20)], loja: [Math.max(10, innerWidth / 2 - 390), 60, Math.min(780, innerWidth - 20)], mapa: [Math.max(10, innerWidth / 2 - 360), 40, Math.min(720, innerWidth - 20)], help: [innerWidth / 2 - 260, 80, 520], shop: [innerWidth / 2 - 330, 90, 620], dialog: [innerWidth / 2 - 230, innerHeight - 330], sugestoes: [Math.max(10, innerWidth / 2 - 290), 70, Math.min(580, innerWidth - 20)], admin: [Math.max(10, innerWidth / 2 - 320), 50, Math.min(640, innerWidth - 20)] };
    const titles = { mapa: '🗺️ Mapa de Aethra', char: 'Personagem', inv: 'Inventário', equip: 'Equipamento', skills: 'Habilidades', tree: 'Árvore de Classes', bestiario: '📖 Bestiário', loja: '✦ Loja de Auroras', help: 'Como Jogar', shop: this.shopTitle || 'Loja do Bento', dialog: 'Conversa', sugestoes: '💡 Sugestões', admin: '👑 Painel do Mestre' };
    const [x, y, w] = pos[id];
    this.makeWin(id, titles[id], x, y, w);
    this['render_' + id]();
  },
  close(id) {
    const w = this.wins[id]; if (!w) return;
    w.remove(); delete this.wins[id];
    if (id === 'inv') { this.invSel = null; this.cardMode = null; }
    if (id === 'tree') this.treeTab = null; // ao reabrir, volta para a árvore do personagem
    this.hideTip();
  },
  toggle(id) {
    if (id === 'equip' || id === 'char') { const t = id === 'equip' ? 'equip' : 'stats'; if (this.wins.char && this.charTab === t) this.close('char'); else { this.charTab = t; if (this.wins.char) this.render_char(); else this.open(id); } return; }
    if (this.wins[id]) this.close(id); else this.open(id);
  },
  closeAll() { let any = false; for (const id in this.wins) { this.close(id); any = true; } return any; },

  act(a, ds, e) {
    const p = G.player;
    switch (a) {
      case 'stat': addStat(ds.s); break;
      case 'skillup': learnSkill(ds.id); break;
      case 'hot-skill': assignHotbar('skill', ds.id); break;
      case 'hot-item': assignHotbar('item', ds.id); break;
      case 'tab': this.invTab = ds.t; this.invSel = null; this.cardMode = null; this.render_inv(); break;
      case 'sel': this.invSel = +ds.uid; this.cardMode = null; this.render_inv(); break;
      case 'use': { const en = invByUid(+ds.uid); if (en) useItem(en); break; }
      case 'equip': { const en = invByUid(+ds.uid); if (en) equipItem(en); break; }
      case 'unequip': unequip(ds.slot); break;
      case 'cardmode': this.cardMode = +ds.uid; this.render_inv(); break;
      case 'cardins': {
        const card = invByUid(this.cardMode);
        const target = ds.slot ? p.equip[ds.slot] : invByUid(+ds.uid);
        if (card && target) {
          if (confirm(`Inserir ${ITEMS[card.id].name} em ${ITEMS[target.id].name}?\nAtenção: cartas não podem ser removidas depois.`)) insertCard(card, target);
        }
        this.cardMode = null; this.markDirty(); break;
      }
      case 'cancelcard': this.cardMode = null; this.render_inv(); break;
      case 'discard': {
        const en = invByUid(+ds.uid);
        if (en && confirm(`Descartar ${ITEMS[en.id].name}${en.qty > 1 ? ' x' + en.qty : ''}? Isso não pode ser desfeito.`)) { removeItem(p, en, en.qty); this.invSel = null; this.markDirty(); }
        break;
      }
      case 'buy': buyItem(ds.id, e.shiftKey ? 10 : 1); break;
      case 'sell': { const en = invByUid(+ds.uid); if (en) sellItem(en, e.shiftKey ? en.qty : 1); break; }
      case 'treesel': this.treeSel = ds.c; this.render_tree(); break;
      case 'treetab': this.treeTab = ds.t; this.render_tree(); break;
      case 'chartab': this.charTab = ds.t; this.render_char(); break;
      case 'skilltab': this.skillTab = ds.t; this.render_skills(); break;
      case 'petset': if (typeof H3 !== 'undefined' && H3.setPet) { H3.setPet(ds.k, +ds.st); this.render_tree(); } break;
      case 'bestsel': this.bestSel = ds.id; this.render_bestiario(); break;
      case 'dlg': { const opt = this.dlg && this.dlg.options[+ds.i]; if (opt) opt.fn(); break; }
    }
  },

  /* ---------- Personagem ---------- */
  // Personagem: uma janela só, com abas Equipamento / Atributos
  render_char() {
    const tab = this.charTab || 'equip';
    const tabs = `<div class="tabs"><div class="tab ${tab === 'equip' ? 'on' : ''}" data-act="chartab" data-t="equip">🛡️ Equipamento</div><div class="tab ${tab === 'stats' ? 'on' : ''}" data-act="chartab" data-t="stats">📊 Atributos${G.player.statPoints > 0 ? ` <span class="gold">(${G.player.statPoints})</span>` : ''}</div></div>`;
    this.body('char').innerHTML = tabs + (tab === 'equip' ? this.equipHtml() : this.statsHtml());
    const mid = this.body('char').querySelector('.eq-mid'), img = mid && mid.querySelector('img');
    if (img && typeof H3 !== 'undefined' && H3.portrait) { // arraste para girar o personagem
      img.draggable = false; mid.style.cursor = 'grab';
      mid.onmousedown = e => {
        e.preventDefault(); let x0 = e.clientX, t = 0; mid.style.cursor = 'grabbing';
        const mv = ev => { const now = performance.now(); this.eqYaw = (this.eqYaw ?? 0.42) + (ev.clientX - x0) * 0.012; x0 = ev.clientX; if (now - t > 33) { t = now; img.src = H3.portrait(this.eqYaw); } };
        const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); mid.style.cursor = 'grab'; img.src = H3.portrait(this.eqYaw); };
        addEventListener('mousemove', mv); addEventListener('mouseup', up);
      };
    }
  },
  render_equip() { this.render_char(); },
  statsHtml() {
    const p = G.player, d = p.d;
    const rows = STAT_KEYS.map(s => {
      const bonus = d[s] - p.stats[s];
      const cost = statCost(p.stats[s]);
      return `<div class="stat-row" data-tip="stat:${s}"><span class="n">${STAT_INFO[s].n}</span><span class="v">${p.stats[s]}</span><span class="b">${bonus ? '+' + bonus : ''}</span>
        <button class="btn small" data-act="stat" data-s="${s}" ${p.statPoints < cost || p.stats[s] >= 99 ? 'disabled' : ''}>+</button><span class="c">${cost}</span></div>`;
    }).join('');
    const w = WEAPON_TYPES[d.wtype];
    return `
      <div class="stat-grid">
        <div>${rows}
          <div style="margin-top:8px">Pontos: <b class="gold">${p.statPoints}</b> <span class="muted" style="font-size:11px">(custo à direita)</span></div>
        </div>
        <div class="derived">
          <div><span>ATQ</span><b>${d.atk}</b></div>
          <div><span>ATQM</span><b>${d.matk}</b></div>
          <div><span>DEF</span><b>${d.def}</b></div>
          <div><span>DEFM</span><b>${d.mdef}</b></div>
          <div><span>Precisão</span><b>${d.hit}</b></div>
          <div><span>Esquiva</span><b>${d.flee}</b></div>
          <div><span>Crítico</span><b>${d.crit}%</b></div>
          <div><span>Ataques/s</span><b>${(1000 / d.aspd).toFixed(2)}</b></div>
          <div><span>Arma</span><b>${w.name}</b></div>
        </div>
      </div>
      <div class="muted" style="margin-top:8px;font-size:11px">Dica: passe o mouse nos atributos para ver o que fazem.</div>`;
  },

  /* ---------- Inventário ---------- */
  render_inv() {
    const p = G.player;
    const tabs = [['all', 'Tudo'], ['consumivel', 'Usáveis'], ['equip', 'Equip.'], ['carta', 'Cartas'], ['etc', 'Etc']];
    const filt = en => {
      const t = ITEMS[en.id].type;
      if (this.invTab === 'all') return true;
      if (this.invTab === 'equip') return EQUIP_TYPES.includes(t);
      return t === this.invTab;
    };
    const list = p.inventory.filter(filt);
    let cells = list.map(en => {
      const it = ITEMS[en.id];
      const slots = EQUIP_TYPES.includes(it.type) && it.slots ? `<span class="slots">[${en.cards.filter(Boolean).length}/${it.slots}]</span>` : '';
      return `<div class="cell ${this.invSel === en.uid ? 'sel' : ''}" data-act="sel" data-uid="${en.uid}" data-tip="inv:${en.uid}">${it.icon}${slots}${en.qty > 1 ? `<span class="qty">${en.qty}</span>` : ''}</div>`;
    });
    const pad = Math.max(0, 24 - cells.length);
    for (let i = 0; i < pad; i++) cells.push('<div class="cell empty"></div>');
    let detail = '<span class="muted">Clique em um item para ver ações. Duplo-clique usa/equipa.</span>';
    const sel = invByUid(this.invSel);
    if (this.cardMode) {
      const card = invByUid(this.cardMode);
      if (card) {
        const ct = ITEMS[card.id].equip;
        const targets = [];
        for (const s of EQUIP_SLOTS) { const e = p.equip[s]; if (e && ITEMS[e.id].type === ct && e.cards.includes(null)) targets.push(`<button class="btn" data-act="cardins" data-slot="${s}">${ITEMS[e.id].icon} ${ITEMS[e.id].name} (equipado)</button>`); }
        for (const e of p.inventory) if (ITEMS[e.id].type === ct && e.cards && e.cards.includes(null)) targets.push(`<button class="btn" data-act="cardins" data-uid="${e.uid}">${ITEMS[e.id].icon} ${ITEMS[e.id].name}</button>`);
        detail = `<b>${ITEMS[card.id].name}</b><div class="muted">Escolha um(a) ${SLOT_NAMES[ct]} com espaço livre:</div>
          <div class="actions">${targets.join('') || '<span class="tt-warn" style="color:#ff8a8a">Nenhum equipamento compatível com espaço livre.</span>'}<button class="btn" data-act="cancelcard">Cancelar</button></div>`;
      }
    } else if (sel) {
      const it = ITEMS[sel.id];
      const acts = [];
      if (it.type === 'consumivel') { acts.push(`<button class="btn gold" data-act="use" data-uid="${sel.uid}">Usar</button>`); acts.push(`<button class="btn" data-act="hot-item" data-id="${sel.id}">→ Atalho</button>`); }
      if (EQUIP_TYPES.includes(it.type)) acts.push(`<button class="btn gold" data-act="equip" data-uid="${sel.uid}">Equipar</button>`);
      if (it.type === 'carta') acts.push(`<button class="btn gold" data-act="cardmode" data-uid="${sel.uid}">Inserir em equipamento</button>`);
      acts.push(`<button class="btn" data-act="discard" data-uid="${sel.uid}">Descartar</button>`);
      detail = this.itemHtml(it, sel) + `<div class="actions">${acts.join('')}</div>`;
    }
    this.body('inv').innerHTML = `<div class="tabs">${tabs.map(([k, n]) => `<div class="tab ${this.invTab === k ? 'on' : ''}" data-act="tab" data-t="${k}">${n}</div>`).join('')}</div>
      <div class="grid">${cells.join('')}</div><div class="detail">${detail}</div>
      <div style="margin-top:6px" class="gold">💰 ${p.zeny.toLocaleString('pt-BR')} z</div>`;
    this.body('inv').querySelectorAll('.cell[data-uid]').forEach(c => c.ondblclick = () => {
      const en = invByUid(+c.dataset.uid); if (!en) return;
      const t = ITEMS[en.id].type;
      if (t === 'consumivel') useItem(en); else if (EQUIP_TYPES.includes(t)) equipItem(en);
    });
  },

  /* ---------- Equipamento ---------- */
  // janela no estilo clássico: personagem de frente no meio e os espaços dos dois lados
  equipHtml() {
    const p = G.player;
    const L = ['cabeca', 'armadura', 'arma', 'capa', 'acessorio'], R = ['rosto', 'boca', 'escudo', 'botas', 'acessorio2'];
    const cell = (s, side) => {
      const e = p.equip[s], it = e && ITEMS[e.id];
      const cards = e && it.slots ? `<div class="eq-cards">${(e.cards || []).map(c => c ? `<span class="eq-card full" data-tip="item:${c}">🃏</span>` : '<span class="eq-card"></span>').join('')}</div>` : '';
      return `<div class="eq-slot ${side} ${e ? 'full' : ''}" ${e ? `data-tip="equip:${s}" data-act="unequip" data-slot="${s}" title="Clique para tirar"` : ''}>
        <div class="eq-ic">${e ? it.icon : ''}</div><div class="eq-tx"><div class="eq-name">${e ? esc(it.name) + (it.slots ? ` [${it.slots}]` : '') : '<span class="muted">—</span>'}</div><div class="eq-lab">${SLOT_LABELS[s]}</div>${cards}</div></div>`;
    };
    const pic = typeof H3 !== 'undefined' && H3.portrait ? H3.portrait(this.eqYaw ?? 0.42) : null;
    const d = p.d || {};
    return `<div class="eqro">
        <div class="eq-col">${L.map(s => cell(s, 'l')).join('')}</div>
        <div class="eq-mid">${pic ? `<img src="${pic}" alt="">` : `<div class="eq-ph">${CLASSES[p.cls].icon}</div>`}<div class="eq-who"><b>${esc(p.name)}</b><span>${CLASSES[p.cls].name}</span></div></div>
        <div class="eq-col">${R.map(s => cell(s, 'r')).join('')}</div>
      </div>
      <div class="eq-sum"><span>ATQ <b>${d.atk ?? '-'}</b></span><span>ATQ M <b>${d.matk ?? '-'}</b></span><span>DEF <b>${d.def ?? '-'}</b></span><span>DEF M <b>${d.mdef ?? '-'}</b></span></div>
      <div class="muted" style="font-size:11px;margin-top:6px">Clique num equipamento para tirá-lo · arraste o personagem para girá-lo. Cartas: no Inventário (I), selecione uma carta e insira num item com espaço [ ].</div>`;
  },

  /* ---------- Habilidades ---------- */
  render_skills() {
    const p = G.player;
    const groups = lineage(p.cls).map(cid => {
      const c = CLASSES[cid];
      const items = c.skills.map(id => {
        const sk = SKILLS[id], lv = p.skills[id] || 0;
        const can = p.skillPoints > 0 && lv < sk.maxLv;
        const info = lv ? sk.desc(lv) : sk.desc(1);
        const next = lv && lv < sk.maxLv ? `<div class="ds">Próx.: ${sk.desc(lv + 1)}</div>` : '';
        const spTxt = sk.type === 'active' ? `<span class="tag">SP ${sk.sp(Math.max(1, lv))}</span>` : '<span class="tag">Passiva</span>';
        return `<div class="sk ${lv ? '' : 'locked'}"><div class="ic">${sk.icon}</div>
          <div class="info"><div class="nm">${sk.name} <span class="gold">${lv}/${sk.maxLv}</span>${spTxt}</div><div class="ds">${info}</div>${next}</div>
          ${sk.type === 'active' && lv ? `<button class="btn small" data-act="hot-skill" data-id="${id}" title="Colocar na barra de atalhos">→ Atalho</button>` : ''}
          <button class="btn small gold" data-act="skillup" data-id="${id}" ${can ? '' : 'disabled'}>+</button></div>`;
      }).join('');
      return `<div class="sk-group"><h4>${c.icon} ${c.name}</h4>${items}</div>`;
    }).join('');
    const stab = this.skillTab || 'char', pet = p.pet;
    const stabs = `<div class="tabs"><div class="tab ${stab === 'char' ? 'on' : ''}" data-act="skilltab" data-t="char">🧍 Personagem</div><div class="tab ${stab === 'pet' ? 'on' : ''}" data-act="skilltab" data-t="pet">🐾 Mascote</div></div>`;
    if (stab === 'pet') {
      if (!pet || typeof PETS === 'undefined') { this.body('skills').innerHTML = stabs + '<div class="muted">Você ainda não tem um mascote.</div>'; return; }
      const sp = PETS[pet.species], st = petStage(pet);
      const pg = sp.stages.map((sg, i) => `<div class="sk-group"><h4>${sg.icon} ${sg.name} <span class="muted" style="font-size:11px">${i ? 'evolui no Nv. ' + PET_EVOLVE[i] : 'estágio inicial'}${i === st ? ' · <span class="gold">atual</span>' : ''}</span></h4>${(sp.skills || []).filter(k => k.stage === i).map(k =>
        `<div class="sk ${i <= st ? '' : 'locked'}"><div class="ic">${k.icon}</div><div class="info"><div class="nm">${k.name} <span class="tag">${i <= st ? 'Automática' : '🔒 Nv. ' + PET_EVOLVE[i]}</span></div><div class="ds">${k.desc}</div></div></div>`).join('')}</div>`).join('');
      this.body('skills').innerHTML = stabs + `<div style="margin-bottom:8px">${petInfo(pet).icon} <b>${petInfo(pet).name}</b> · Nv. ${pet.lv} <span class="muted" style="font-size:11px">(${sp.roleIcon} ${sp.roleName} — as habilidades do mascote são automáticas e melhoram quando ele evolui)</span></div>${pg}`;
      return;
    }
    this.body('skills').innerHTML = stabs + `<div style="margin-bottom:8px">Pontos de habilidade: <b class="gold">${p.skillPoints}</b> <span class="muted" style="font-size:11px">(1 por Nv. de Classe)</span></div>${groups}
      <div class="muted" style="font-size:11px">Use as teclas 1–9 para ativar atalhos. Clique com o botão direito num atalho para limpá-lo.</div>`;
  },

  /* ---------- Árvore de classes ---------- */
  render_tree() {
    const p = G.player;
    const path = lineage(p.cls);
    const node = (cid, extra = '') => {
      const c = CLASSES[cid];
      const req = c.tier === 0 ? 'Início' : c.tier === 1 ? `Aprendiz Nv.Classe ${CONFIG.JOB_CHANGE_1}` : `${CLASSES[c.parent].name} Nv.Classe ${CONFIG.JOB_CHANGE_2}`;
      return `<div class="tnode ${path.includes(cid) ? 'path' : ''} ${p.cls === cid ? 'cur' : ''} ${extra}" data-act="treesel" data-c="${cid}"><div class="ti">${c.icon}</div><div class="tn">${c.name}</div><div class="tr">${req}</div></div>`;
    };
    // 4 ramos em grade 2×2 (cabe na janela sem rolar para os lados)
    const cols = CLASSES.aprendiz.next.map(c1 => `<div class="tbranch ${path.includes(c1) ? 'on' : ''}">${node(c1)}<div class="tline ${path.includes(c1) ? 'on' : ''}"></div>
        <div class="tsplit">${CLASSES[c1].next.map(c2 => node(c2)).join('')}</div><div class="tfuture">❔ 3ª classe — em breve</div></div>`).join('');
    const sel = this.treeSel || p.cls, c = CLASSES[sel];
    const skl = c.skills.map(id => `<span class="tag" data-tip="skill:${id}" style="font-size:12px;padding:2px 6px">${SKILLS[id].icon} ${SKILLS[id].name}</span>`).join(' ');
    const ws = c.weapons.map(w => WEAPON_TYPES[w].name).join(', ');
    // evolução dos mascotes (abaixo das classes)
    const pet = p.pet;
    const godPick = typeof isAdmin === 'function' && isAdmin() && G.god;
    const petHtml = typeof PETS === 'undefined' ? '' : `<div class="pet-evo"><h4>🐾 Evolução dos Mascotes</h4>${godPick ? '<div class="gold" style="font-size:11px;margin:-4px 0 8px">⚡ God Mode: clique em qualquer mascote/estágio para trocar na hora.</div>' : ''}<div class="muted" style="margin:-4px 0 8px;font-size:11px">Cada mascote evolui sozinho ao subir de nível, ganhando um novo visual e poderes mais fortes.</div>${Object.keys(PETS).map(k => {
      const sp = PETS[k], mine = pet && pet.species === k, st = mine ? petStage(pet) : -1;
      return `<div class="pet-line ${mine ? 'mine' : ''}"><div class="pet-role">${sp.roleIcon} ${sp.roleName}${mine ? ' <span class="gold">• seu mascote</span>' : ''}</div><div class="pet-chain">${sp.stages.map((s, i) =>
        `<div class="pet-st ${mine && i === st ? 'cur' : ''} ${mine && i <= st ? 'got' : ''} ${godPick ? 'pick' : ''}" ${godPick ? `data-act="petset" data-k="${k}" data-st="${i}"` : ''} title="${s.desc.replace(/"/g, '&quot;')}"><div class="pi">${s.icon}</div><div class="pn">${s.name}</div><div class="pr">${i ? 'Nv. ' + PET_EVOLVE[i] : 'Início'}</div></div>${i < sp.stages.length - 1 ? '<div class="parrow">→</div>' : ''}`).join('')}</div></div>`;
    }).join('')}${pet ? `<div class="muted" style="margin-top:6px">Seu ${petInfo(pet).name} está no <b>Nv. ${pet.lv}</b> (EXP ${pet.lv >= PET_MAX_LV ? 'máxima' : Math.floor(pet.exp / petExpNext(pet.lv) * 100) + '%'}). O mascote ganha EXP junto com você.</div>` : '<div class="muted">Você ainda não tem um mascote.</div>'}</div>`;
    const tab = this.treeTab || 'classes';
    const tabs = `<div class="tabs ttabs"><div class="tab ${tab === 'classes' ? 'on' : ''}" data-act="treetab" data-t="classes">🧍 Personagem</div><div class="tab ${tab === 'pets' ? 'on' : ''}" data-act="treetab" data-t="pets">🐾 Mascotes</div></div>`;
    if (tab === 'pets') { this.body('tree').innerHTML = tabs + petHtml; return; }
    this.body('tree').innerHTML = `${tabs}<div class="tree">${node('aprendiz')}<div class="tline on"></div><div class="tgrid">${cols}</div></div>
      <div class="tinfo"><b class="gold" style="font-size:14px">${c.icon} ${c.name}</b> <span class="muted">— ${c.tier === 0 ? 'Classe inicial' : c.tier + 'ª classe'}</span>
        <div style="margin:4px 0 6px">${c.desc}</div><div class="muted" style="font-size:11px;margin-bottom:4px">Armas: ${ws} • HP ×${c.hpMod} • SP ×${c.spMod}</div>${skl}</div>`;
  },

  /* ---------- Bestiário (wiki dos monstros) ---------- */
  render_bestiario() {
    const ids = Object.keys(MONSTERS).sort((a, b) => MONSTERS[a].lv - MONSTERS[b].lv);
    const sel = MONSTERS[this.bestSel] ? this.bestSel : ids[0], m = MONSTERS[sel];
    const where = (typeof H3 !== 'undefined' && H3.spawnInfo) ? H3.spawnInfo() : Object.fromEntries(ids.map(id => [id, Object.values(MAPS).filter(mp => (mp.spawns || []).some(sp => sp.type === id)).map(mp => mp.name)]));
    const q = (this.bestQ || '').toLowerCase();
    const list = ids.filter(id => !q || MONSTERS[id].name.toLowerCase().includes(q) || MONSTERS[id].race.toLowerCase().includes(q) || ELEMENTS[MONSTERS[id].element].name.toLowerCase().includes(q)).map(id => {
      const x = MONSTERS[id], tag = x.boss ? '<span class="bs-tag boss">Chefe</span>' : x.mini ? '<span class="bs-tag mini">Mini</span>' : '';
      const th = typeof H3 !== 'undefined' && H3.monsterThumb ? H3.monsterThumb(id) : null;
      return `<div class="bs-item ${id === sel ? 'on' : ''}" data-act="bestsel" data-id="${id}"><span class="bs-ic">${th ? `<img src="${th}" alt="">` : x.icon}</span><span class="bs-nm">${esc(x.name)}${tag}</span><span class="bs-lv">Nv. ${x.lv}</span></div>`;
    }).join('') || '<div class="muted" style="padding:8px">Nada encontrado.</div>';
    const weak = Object.keys(ELEMENT_STRONG).filter(e => ELEMENT_STRONG[e] === m.element).map(e => `<span style="color:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`).join(', ') || '—';
    const strongVs = ELEMENT_STRONG[m.element] ? `<span style="color:${ELEMENTS[ELEMENT_STRONG[m.element]].color}">${ELEMENTS[ELEMENT_STRONG[m.element]].name}</span>` : '—';
    const size = m.size >= 1.5 ? 'Grande' : m.size <= 0.8 ? 'Pequeno' : 'Médio';
    const traits = [m.aggressive ? '😠 Agressivo (ataca ao ver você)' : '🙂 Passivo (só revida)', m.range > 2 ? '🏹 Ataca à distância' : '🗡️ Corpo a corpo', m.special === 'slam' ? '💥 Golpe no chão que atinge em área' : null, m.flee >= 40 ? '💨 Difícil de acertar' : null, m.boss ? '👑 Chefe — volta a cada ' + Math.round((m.respawn || 0) / 60000) + ' min' : m.mini ? '⭐ Mini-chefe — volta a cada ' + Math.round((m.respawn || 0) / 60000) + ' min' : null].filter(Boolean);
    const drops = (m.drops || []).map(([id, ch]) => `<div class="bs-drop" data-tip="item:${id}"><span>${ITEMS[id].icon} ${esc(ITEMS[id].name)}</span><b>${(ch * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</b></div>`).join('');
    const card = ITEMS['carta_' + sel];
    const cardRate = ((m.cardRate ?? CONFIG.CARD_DROP_RATE ?? 0.01) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    const zones = (where[sel] || []);
    const stat = (k, v) => `<div class="bs-stat"><span>${k}</span><b>${v}</b></div>`;
    this.body('bestiario').innerHTML = `<div class="bs">
      <div class="bs-left"><input class="bs-search" id="bs-q" placeholder="🔍 Buscar nome, raça ou elemento" value="${esc(this.bestQ || '')}"><div class="bs-list">${list}</div></div>
      <div class="bs-right">
        <div class="bs-head"><div class="bs-big">${typeof H3 !== 'undefined' && H3.monsterLive ? '<canvas id="bs-live" width="200" height="200"></canvas>' : m.icon}</div><div><div class="bs-name">${esc(m.name)}</div><div class="muted">Nível ${m.lv} · ${m.race} · ${size} · <span style="color:${ELEMENTS[m.element].color}">${ELEMENTS[m.element].name}</span></div></div></div>
        <div class="bs-stats">${stat('HP', m.hp.toLocaleString('pt-BR'))}${stat('Ataque', m.atk[0] + '–' + m.atk[1])}${stat('Defesa', m.def)}${stat('Def. Mágica', m.mdef)}${stat('Precisão', m.hit)}${stat('Esquiva', m.flee)}${stat('EXP Base', m.exp.toLocaleString('pt-BR'))}${stat('EXP Classe', m.jexp.toLocaleString('pt-BR'))}</div>
        <h4>Elemento</h4><div class="bs-p">Leva <b>+50%</b> de dano de: ${weak} · causa +50% em: ${strongVs}</div>
        <h4>Comportamento</h4><div class="bs-p">${traits.join('<br>')}</div>
        <h4>Onde encontrar</h4><div class="bs-p">${zones.length ? zones.join(', ') : '<span class="muted">Ainda não aparece no mundo.</span>'}</div>
        <h4>Drops</h4><div class="bs-drops">${drops || '<span class="muted">Nenhum.</span>'}${card ? `<div class="bs-drop card" data-tip="item:${card.id}"><span>🃏 ${esc(card.name)}</span><b>${cardRate}%</b></div>` : ''}</div>
        ${card ? `<h4>Carta</h4><div class="bs-p">Encaixe em: <b>${SLOT_NAMES[card.equip]}</b><br>${fmtBonuses(card.bonuses).join(' · ')}</div>` : ''}
      </div></div>`;
    if (this._bsStop) this._bsStop();
    if ($('bs-live')) this._bsStop = H3.monsterLive(sel, $('bs-live'));
    const inp = $('bs-q');
    inp.oninput = () => { this.bestQ = inp.value; const pos = inp.selectionStart; this.render_bestiario(); const n = $('bs-q'); n.focus(); n.setSelectionRange(pos, pos); };
  },

  /* ---------- Ajuda ---------- */
  render_help() {
    this.body('help').innerHTML = `<div style="line-height:1.6">
      <b class="gold">Movimento e combate</b><br>
      • <b>W A S D</b> (ou as setas) para andar, ou <b>clique no chão</b> (segure para continuar andando).<br>
      • <b>Clique num monstro</b> para atacar automaticamente.<br>
      • <b>Clique em itens no chão</b> para pegar (ou aperte <b>F</b>).<br>
      • <b>1–9</b>: atalhos de habilidades/itens. Habilidades de alvo pedem um clique no monstro/área.<br>
      • <b>X</b>: sentar (regenera HP/SP 2× mais rápido). <b>Roda do mouse</b>: zoom.<br><br>
      <b class="gold">Janelas</b><br>
      <b>C</b> Personagem • <b>I</b> Inventário • <b>E</b> Equipamento • <b>K</b> Habilidades • <b>T</b> Árvore de Classes • <b>N</b> Som • <b>Esc</b> fecha janelas / abre o menu (voltar ao menu principal)<br><br>
      <b class="gold">Pausa e sugestões</b><br>
      • <b>P</b>: pausa/continua o jogo.<br>
      • <b>Q</b>: modo sugestão — clique em qualquer coisa (monstro, NPC, árvore, chão, interface...) ou arraste para marcar uma área, e escreva o que quer mudar. O Claude lê depois.<br>
      • <b>L</b>: lista das suas sugestões e o que já foi feito.<br><br>
      <b class="gold">Modo Mestre (só no seu computador)</b><br>
      • <b>Z</b>: God Mode — imortal, SP infinito, sem recarga, mais rápido; <b>botão direito</b> no mapa teleporta.<br>
      • <b>⌘ Cmd + Z</b> (Ctrl+Z no Windows): Painel do Mestre — teleporte para qualquer ponto de qualquer mapa e atalhos.<br><br>
      <b class="gold">Progressão</b><br>
      • Monstros dão <b>EXP de Base</b> (atributos) e <b>EXP de Classe</b> (habilidades).<br>
      • No <b>Nv. de Classe ${CONFIG.JOB_CHANGE_1}</b>, fale com a <b>Mestra Ivra</b> e escolha sua 1ª classe. No <b>Nv. ${CONFIG.JOB_CHANGE_2}</b> da 1ª classe, escolha entre dois caminhos (carreira em Y).<br>
      • Cada monstro tem uma <b>carta</b> rara. Insira-a em equipamentos com espaços <b>[ ]</b> para ganhar poderes únicos.<br>
      • <b>Elementos importam</b>: Água > Fogo > Terra > Vento > Água; Sagrado ⇄ Sombra.<br><br>
      <b class="gold">Mapas</b><br>
      Vila de Alvorada → (leste) Campos de Verdelume → (leste) Bosque Sussurrante → (norte) Ruínas de Kael.<br>
      <span class="muted">O jogo salva automaticamente no navegador.</span></div>`;
  },

  /* ---------- Loja ---------- */
  render_shop() {
    const p = G.player;
    const buy = (this.shopList || SHOP_ITEMS).map(id => { const it = ITEMS[id]; return `<div class="shop-item" data-act="buy" data-id="${id}" data-tip="item:${id}"><span class="ic">${it.icon}</span><span class="nm">${it.name}</span><span class="pr">${it.price} z</span></div>`; }).join('');
    const sell = p.inventory.map(en => { const it = ITEMS[en.id]; return `<div class="shop-item" data-act="sell" data-uid="${en.uid}" data-tip="inv:${en.uid}"><span class="ic">${it.icon}</span><span class="nm">${it.name}${en.qty > 1 ? ' x' + en.qty : ''}</span><span class="pr">${sellPrice(en.id)} z</span></div>`; }).join('') || '<span class="muted">Nada para vender.</span>';
    this.body('shop').innerHTML = `<div class="shop"><div><h4>Comprar</h4><div class="shop-list">${buy}</div></div><div><h4>Vender</h4><div class="shop-list">${sell}</div></div></div>
      <div style="margin-top:8px;display:flex;justify-content:space-between"><span class="muted" style="font-size:11px">Clique = 1 • Shift+Clique = 10 (comprar) / tudo (vender)</span><b class="gold">💰 ${p.zeny.toLocaleString('pt-BR')} z</b></div>`;
  },

  /* ---------- Diálogo ---------- */
  dialog(npc, text, options) {
    this.dlg = { npc, text, options };
    this.open('dialog');
  },
  render_dialog() {
    const d = this.dlg; if (!d) return;
    this.body('dialog').innerHTML = `<div class="dlg-name">${esc(d.npc.name)}</div><div class="dlg-title">${esc(d.npc.title || '')}</div>
      <div class="dlg-text">${d.text}</div><div class="dlg-opts">${d.options.map((o, i) => `<button class="btn ${o.gold ? 'gold' : ''}" data-act="dlg" data-i="${i}">${o.label}</button>`).join('')}</div>`;
  },

  /* ---------- Tooltips ---------- */
  itemHtml(it, en) {
    const lines = [];
    const typeName = it.type === 'arma' ? `Arma • ${WEAPON_TYPES[it.wtype].name}` : SLOT_NAMES[it.type] || { consumivel: 'Consumível', etc: 'Material', carta: 'Carta' }[it.type];
    if (it.atk) lines.push(`ATQ ${it.atk}`);
    if (it.matk) lines.push(`ATQM ${it.matk}`);
    if (it.def) lines.push(`DEF ${it.def}`);
    if (it.mdef) lines.push(`DEFM ${it.mdef}`);
    if (it.use) { if (it.use.hp) lines.push(`Recupera ${it.use.hp} HP`); if (it.use.sp) lines.push(`Recupera ${it.use.sp} SP`); }
    const bon = fmtBonuses(it.bonuses).map(b => `<div class="tt-b">${b}</div>`).join('');
    let cards = '';
    if (en && en.cards && en.cards.length) cards = '<div>Espaços: ' + en.cards.map(c => c ? `<span class="gold">🃏 ${ITEMS[c].name}</span>` : '[ ]').join(' ') + '</div>' + en.cards.filter(Boolean).map(c => fmtBonuses(ITEMS[c].bonuses).map(b => `<div class="tt-b">↳ ${b}</div>`).join('')).join('');
    else if (it.slots !== undefined && EQUIP_TYPES.includes(it.type)) cards = `<div>Espaços para carta: ${it.slots}</div>`;
    let req = '';
    if (it.type === 'arma') {
      const users = Object.keys(CLASSES).filter(c => CLASSES[c].tier <= 1 && CLASSES[c].weapons.includes(it.wtype)).map(c => CLASSES[c].name);
      const ok = G.player && CLASSES[G.player.cls].weapons.includes(it.wtype);
      req += `<div class="${ok ? 'muted' : 'tt-warn'}">Classes: ${users.join(', ')} (e evoluções)</div>`;
    }
    if (it.lv > 1) req += `<div class="${G.player && G.player.baseLv >= it.lv ? 'muted' : 'tt-warn'}">Nível necessário: ${it.lv}</div>`;
    const cardInfo = it.type === 'carta' ? `<div class="muted">Monstro: ${MONSTERS[it.monster].name}</div>` : '';
    return `<div class="tt-name">${it.icon} ${esc(it.name)}${it.slots ? ` [${it.slots}]` : ''}</div><div class="tt-type">${typeName}</div>
      ${lines.map(l => `<div>${l}</div>`).join('')}${bon}${cards}${cardInfo}${req}${it.desc ? `<div class="tt-d">${esc(it.desc)}</div>` : ''}
      <div class="muted" style="margin-top:4px;font-size:11px">Venda: ${sellPrice(it.id)} z</div>`;
  },
  tipHtml(key) {
    const [kind, ref] = key.split(':');
    const p = G.player;
    if (kind === 'inv') { const en = invByUid(+ref); return en ? this.itemHtml(ITEMS[en.id], en) : null; }
    if (kind === 'equip') { const en = p.equip[ref]; return en ? this.itemHtml(ITEMS[en.id], en) : null; }
    if (kind === 'item') return ITEMS[ref] ? this.itemHtml(ITEMS[ref]) : null;
    if (kind === 'stat') return `<div class="tt-name">${STAT_INFO[ref].full} (${STAT_INFO[ref].n})</div><div>${STAT_INFO[ref].d}</div><div class="muted">Custo para aumentar: ${statCost(p.stats[ref])} pontos</div>`;
    if (kind === 'skill') {
      const sk = SKILLS[ref]; if (!sk) return null;
      const lv = (p && p.skills[ref]) || 1;
      const tgt = { self: 'Em si', enemy: 'Alvo inimigo', ground: 'Área no chão', selfAoe: 'Área ao redor' }[sk.target] || 'Passiva';
      const el = sk.effect && sk.effect.element ? ` • ${ELEMENTS[sk.effect.element].name}` : '';
      return `<div class="tt-name">${sk.icon} ${sk.name} <span class="muted">Nv ${lv}</span></div><div class="tt-type">${sk.type === 'passive' ? 'Passiva' : tgt}${el}</div><div>${sk.desc(lv)}</div>
        ${sk.type === 'active' ? `<div class="muted">SP: ${sk.sp(lv)}${sk.cast ? ` • Conjuração: ${(sk.cast(lv) / 1000).toFixed(1)}s` : ''}</div>` : ''}`;
    }
    return null;
  },

  /* ---------- Tela título / morte ---------- */
  /* ---------- Tela inicial: escolher personagem ---------- */
  showTitle(chars = []) {
    const o = $('overlay');
    this.stopPreview();
    chars = chars.filter(c => c && c.name && CLASSES[c.cls]);
    this.titleChars = chars;
    if (!chars.length) { this.showCreate(); return; }
    const label = c => `<b>${esc(c.name)}</b> <span class="muted">— Nv. ${c.baseLv} ${CLASSES[c.cls].icon} ${CLASSES[c.cls].name}</span>`;
    o.innerHTML = `<div class="title-box"><h1>${GAME_TITLE}</h1><div class="sub">VERSÃO CLÁSSICA 2D</div>
      <div class="card">
        <label style="margin-top:0">Seus personagens</label>
        ${chars.map((c, i) => `<button class="btn ${i ? '' : 'gold'} t-cont" data-i="${i}" style="width:100%;padding:9px;font-size:14px;margin-bottom:5px;text-align:left">▶ ${label(c)}</button>`).join('')}
        <div class="row"><button class="btn" id="t-create">＋ Criar novo personagem</button></div>
        <div class="row" style="margin-top:8px"><a class="btn gold" href="index.html" style="text-align:center;text-decoration:none">🌍 Ir para o mundo aberto 3D</a></div>
      </div><div class="ver">v${GAME_VERSION} • clique para ativar o som</div></div>`;
    o.classList.add('show');
    o.onclick = () => Sound.init();
    $('t-create').onclick = () => { Sound.init(); Sound.play('click'); this.showCreate(); };
    o.querySelectorAll('.t-cont').forEach(b => b.onclick = async () => {
      Sound.init();
      try { const s = await loadCharacter(chars[+b.dataset.i]); continueGame(s); }
      catch (e) { alert('Não consegui carregar esse personagem: ' + e.message); }
    });
  },

  /* ---------- Tela de criação de personagem ---------- */
  showCreate() {
    const o = $('overlay'), chars = this.titleChars || [];
    let hair = HAIR_COLORS[0], skin = SKIN_COLORS[0], style = 0;
    o.innerHTML = `<div class="title-box"><h1>${GAME_TITLE}</h1><div class="sub">CRIAR NOVO PERSONAGEM</div>
      <div class="card">
        <canvas id="preview" width="120" height="110"></canvas>
        <label>Nome <span style="color:#ff8a8a">*</span></label><input type="text" id="t-name" maxlength="16" placeholder="Como seu aventureiro vai se chamar?">
        <div id="t-err" style="color:#ff8a8a;font-size:12px;min-height:16px;margin-top:3px"></div>
        <label>Cor do cabelo</label><div class="swatches" id="t-hair">${HAIR_COLORS.map((c, i) => `<div class="sw ${i ? '' : 'on'}" style="background:${c}" data-c="${c}"></div>`).join('')}</div>
        <label>Tom de pele</label><div class="swatches" id="t-skin">${SKIN_COLORS.map((c, i) => `<div class="sw ${i ? '' : 'on'}" style="background:${c}" data-c="${c}"></div>`).join('')}</div>
        <label>Penteado</label><div class="swatches" id="t-style">${[0, 1, 2].map(i => `<div class="sw ${i ? '' : 'on'}" style="background:#555;display:grid;place-items:center;font-size:11px" data-c="${i}">${i + 1}</div>`).join('')}</div>
        <div class="row">${chars.length ? '<button class="btn" id="t-back">← Voltar</button>' : ''}<button class="btn gold" id="t-new">Criar personagem</button></div>
      </div><div class="ver">v${GAME_VERSION} • clique para ativar o som</div></div>`;
    o.classList.add('show');
    const pc = $('preview').getContext('2d');
    const draw = () => {
      pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, 120, 110);
      pc.setTransform(2, 0, 0, 2, 60, 100);
      drawHumanoid(pc, 0, 0, { dir: 1, body: CLASSES.aprendiz.color, accent: CLASSES.aprendiz.accent, hair, skin, hairStyle: style, weapon: 'adaga' }, performance.now() / 1000);
      this._raf = requestAnimationFrame(draw);
    };
    this.stopPreview(); draw();
    const pick = (id, cb) => $(id).querySelectorAll('.sw').forEach(s => s.onclick = () => { $(id).querySelectorAll('.sw').forEach(x => x.classList.remove('on')); s.classList.add('on'); cb(s.dataset.c); Sound.init(); });
    pick('t-hair', c => hair = c); pick('t-skin', c => skin = c); pick('t-style', c => style = +c);
    o.onclick = () => Sound.init();
    const nameEl = $('t-name'), err = $('t-err');
    const create = () => {
      const name = nameEl.value.trim();
      if (name.length < 2) { err.textContent = 'Dê um nome ao seu personagem (pelo menos 2 letras).'; nameEl.focus(); Sound.play('error'); return; }
      const same = chars.find(c => c.slug === saveSlug(name));
      if (same) { err.textContent = `Você já tem um personagem chamado ${same.name}. Escolha outro nome.`; nameEl.focus(); Sound.play('error'); return; }
      this.stopPreview(); Sound.init(); startNewGame(name, { hair, skin, hairStyle: style });
    };
    $('t-new').onclick = create;
    nameEl.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') create(); err.textContent = ''; });
    if ($('t-back')) $('t-back').onclick = () => { Sound.play('click'); this.showTitle(chars); };
    setTimeout(() => nameEl.focus(), 50);
  },
  stopPreview() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; },

  /* ---------- Menu do jogo (Esc) ---------- */
  menuOpen: false,
  showGameMenu() {
    if (this.menuOpen) return;
    this.menuOpen = true;
    this.menuWasPaused = G.paused;
    setPaused(true);
    const o = $('overlay');
    o.innerHTML = `<div class="death-box" style="border-color:var(--border);min-width:300px"><h2 style="color:var(--gold)">Menu</h2>
      <div class="muted" style="margin-bottom:14px">${esc(G.player.name)} — Nv. ${G.player.baseLv} ${CLASSES[G.player.cls].name}</div>
      <div class="menu-btns">
        <button class="btn gold" id="m-cont">▶ Continuar <span class="muted">(Esc)</span></button>
        <button class="btn" id="m-help">❔ Como jogar</button>
        <button class="btn" id="m-opts">⚙️ Configurações</button>
        <button class="btn" id="m-title">🏠 Voltar ao menu principal</button>
        ${typeof H3 !== 'undefined' ? '' : '<button class="btn" id="m-3d">🌍 Ir para o mundo 3D</button>'}
      </div><div class="muted" style="margin-top:12px;font-size:11px">O jogo salva automaticamente.</div></div>`;
    o.onclick = null;
    o.classList.add('show');
    $('m-cont').onclick = () => this.closeGameMenu();
    $('m-help').onclick = () => { this.closeGameMenu(); this.open('help'); };
    $('m-opts').onclick = () => this.showSettings();
    $('m-title').onclick = () => { this.menuOpen = false; returnToTitle(); };
    if ($('m-3d')) $('m-3d').onclick = () => { saveGame(); location.href = 'index.html'; };
  },
  // tela de configurações (dentro do menu Esc)
  showSettings() {
    const o = $('overlay'), pct = v => Math.round(v * 100);
    o.innerHTML = `<div class="death-box" style="border-color:var(--border);min-width:320px;text-align:left"><h2 style="color:var(--gold);text-align:center">⚙️ Configurações</h2>
      <div class="opt-row"><span>Som</span><button class="btn" id="o-sound">${Sound.enabled ? '🔊 Ligado' : '🔇 Desligado'}</button></div>
      <div class="opt-row"><span>Música</span><input type="range" id="o-music" min="0" max="100" value="${pct(Sound.musicVol)}"><b id="o-music-v">${pct(Sound.musicVol)}%</b></div>
      <div class="opt-row"><span>Efeitos</span><input type="range" id="o-sfx" min="0" max="100" value="${pct(Sound.sfxVol)}"><b id="o-sfx-v">${pct(Sound.sfxVol)}%</b></div>
      <div class="muted" style="font-size:11px;margin:6px 0 12px">Atalho: <b>N</b> liga/desliga o som.</div>
      <div class="menu-btns"><button class="btn gold" id="o-back">◀ Voltar</button></div></div>`;
    $('o-sound').onclick = () => { toggleSound(); $('o-sound').textContent = Sound.enabled ? '🔊 Ligado' : '🔇 Desligado'; try { localStorage.setItem('aethra_sound', Sound.enabled ? '1' : '0'); } catch (e) { } };
    $('o-music').oninput = e => { Sound.init(); Sound.setVolumes(e.target.value / 100, null); $('o-music-v').textContent = e.target.value + '%'; };
    $('o-sfx').oninput = e => { Sound.init(); Sound.setVolumes(null, e.target.value / 100); $('o-sfx-v').textContent = e.target.value + '%'; };
    $('o-sfx').onchange = () => Sound.play('click');
    $('o-back').onclick = () => { const was = this.menuWasPaused; this.menuOpen = false; this.showGameMenu(); this.menuWasPaused = was; };
  },
  closeGameMenu() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.hideOverlay();
    setPaused(this.menuWasPaused);
  },
  showDeath(loss) {
    const o = $('overlay');
    o.innerHTML = `<div class="death-box"><h2>Você foi derrotado</h2><div class="muted">Perdeu ${loss} de EXP de Base.</div><br><button class="btn gold" id="d-ok" style="padding:8px 18px">Voltar à Vila de Alvorada</button></div>`;
    o.onclick = null;
    o.classList.add('show');
    $('d-ok').onclick = () => respawn();
  },
  hideOverlay() { $('overlay').classList.remove('show'); $('overlay').innerHTML = ''; },
};
