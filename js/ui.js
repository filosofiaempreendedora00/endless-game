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
    $('btn-sound').onclick = () => toggleSound();
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
  },

  markDirty() { this.dirty = true; },
  log(text, cls = 'sys') {
    const l = $('log');
    const d = document.createElement('div'); d.className = cls; d.textContent = text;
    l.appendChild(d);
    while (l.children.length > 100) l.removeChild(l.firstChild);
    l.scrollTop = l.scrollHeight;
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
    const pos = { char: [280, 70, 470], inv: [innerWidth - 390, 70, 330], equip: [innerWidth - 740, 70, 320], skills: [300, 70, 420], tree: [Math.max(10, innerWidth / 2 - 420), 60, Math.min(840, innerWidth - 20)], help: [innerWidth / 2 - 260, 80, 520], shop: [innerWidth / 2 - 330, 90, 620], dialog: [innerWidth / 2 - 230, innerHeight - 330], sugestoes: [Math.max(10, innerWidth / 2 - 290), 70, Math.min(580, innerWidth - 20)], admin: [Math.max(10, innerWidth / 2 - 320), 50, Math.min(640, innerWidth - 20)] };
    const titles = { char: 'Personagem', inv: 'Inventário', equip: 'Equipamento', skills: 'Habilidades', tree: 'Árvore de Classes', help: 'Como Jogar', shop: 'Loja do Bento', dialog: 'Conversa', sugestoes: 'Minhas Sugestões', admin: '👑 Painel do Mestre' };
    const [x, y, w] = pos[id];
    this.makeWin(id, titles[id], x, y, w);
    this['render_' + id]();
  },
  close(id) {
    const w = this.wins[id]; if (!w) return;
    w.remove(); delete this.wins[id];
    if (id === 'inv') { this.invSel = null; this.cardMode = null; }
    this.hideTip();
  },
  toggle(id) { if (this.wins[id]) this.close(id); else this.open(id); },
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
      case 'dlg': { const opt = this.dlg && this.dlg.options[+ds.i]; if (opt) opt.fn(); break; }
    }
  },

  /* ---------- Personagem ---------- */
  render_char() {
    const p = G.player, d = p.d;
    const rows = STAT_KEYS.map(s => {
      const bonus = d[s] - p.stats[s];
      const cost = statCost(p.stats[s]);
      return `<div class="stat-row" data-tip="stat:${s}"><span class="n">${STAT_INFO[s].n}</span><span class="v">${p.stats[s]}</span><span class="b">${bonus ? '+' + bonus : ''}</span>
        <button class="btn small" data-act="stat" data-s="${s}" ${p.statPoints < cost || p.stats[s] >= 99 ? 'disabled' : ''}>+</button><span class="c">${cost}</span></div>`;
    }).join('');
    const w = WEAPON_TYPES[d.wtype];
    this.body('char').innerHTML = `
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
        for (const s of EQUIP_TYPES) { const e = p.equip[s]; if (e && ITEMS[e.id].type === ct && e.cards.includes(null)) targets.push(`<button class="btn" data-act="cardins" data-slot="${s}">${ITEMS[e.id].icon} ${ITEMS[e.id].name} (equipado)</button>`); }
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
  render_equip() {
    const p = G.player;
    this.body('equip').innerHTML = EQUIP_TYPES.map(s => {
      const e = p.equip[s];
      if (!e) return `<div class="eq-row"><div class="cell empty"></div><div class="info"><div class="slotname">${SLOT_NAMES[s]}</div><span class="muted">— vazio —</span></div></div>`;
      const it = ITEMS[e.id];
      const cs = (e.cards || []).map(c => c ? `<span class="card-slot full" data-tip="item:${c}">🃏 ${ITEMS[c].name.replace('Carta ', '')}</span>` : '<span class="card-slot">vazio</span>').join('');
      return `<div class="eq-row"><div class="cell" data-tip="equip:${s}">${it.icon}</div>
        <div class="info"><div class="slotname">${SLOT_NAMES[s]}</div><b>${it.name}${it.slots ? ` [${it.slots}]` : ''}</b><div class="card-slots">${cs}</div></div>
        <button class="btn small" data-act="unequip" data-slot="${s}">Tirar</button></div>`;
    }).join('') + '<div class="muted" style="font-size:11px">Cartas: abra o Inventário (I), selecione uma carta e insira em um equipamento com espaço [ ].</div>';
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
    this.body('skills').innerHTML = `<div style="margin-bottom:8px">Pontos de habilidade: <b class="gold">${p.skillPoints}</b> <span class="muted" style="font-size:11px">(1 por Nv. de Classe)</span></div>${groups}
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
    const cols = CLASSES.aprendiz.next.map(c1 => `<div class="tcol"><div class="tline ${path.includes(c1) ? 'on' : ''}"></div>${node(c1)}<div class="tline ${path.includes(c1) ? 'on' : ''}"></div>
        <div class="tsplit">${CLASSES[c1].next.map(c2 => `<div class="tcol">${node(c2)}<div class="tline"></div><div class="tnode future"><div class="ti">❔</div><div class="tn">3ª Classe</div><div class="tr">em breve</div></div></div>`).join('')}</div></div>`).join('');
    const sel = this.treeSel || p.cls, c = CLASSES[sel];
    const skl = c.skills.map(id => `<span class="tag" data-tip="skill:${id}" style="font-size:12px;padding:2px 6px">${SKILLS[id].icon} ${SKILLS[id].name}</span>`).join(' ');
    const ws = c.weapons.map(w => WEAPON_TYPES[w].name).join(', ');
    this.body('tree').innerHTML = `<div class="tree">${node('aprendiz')}<div class="tline on"></div><div class="tbar"></div><div class="trow">${cols}</div></div>
      <div class="tinfo"><b class="gold" style="font-size:14px">${c.icon} ${c.name}</b> <span class="muted">— ${c.tier === 0 ? 'Classe inicial' : c.tier + 'ª classe'}</span>
        <div style="margin:4px 0 6px">${c.desc}</div><div class="muted" style="font-size:11px;margin-bottom:4px">Armas: ${ws} • HP ×${c.hpMod} • SP ×${c.spMod}</div>${skl}</div>`;
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
      <b>C</b> Personagem • <b>I</b> Inventário • <b>E</b> Equipamento • <b>K</b> Habilidades • <b>T</b> Árvore de Classes • <b>N</b> Som • <b>Esc</b> fecha<br><br>
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
    const buy = SHOP_ITEMS.map(id => { const it = ITEMS[id]; return `<div class="shop-item" data-act="buy" data-id="${id}" data-tip="item:${id}"><span class="ic">${it.icon}</span><span class="nm">${it.name}</span><span class="pr">${it.price} z</span></div>`; }).join('');
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
  showTitle(chars = []) {
    const o = $('overlay');
    let hair = HAIR_COLORS[0], skin = SKIN_COLORS[0], style = 0;
    chars = chars.filter(c => c && c.name && CLASSES[c.cls]);
    const label = c => `${esc(c.name)} — Nv. ${c.baseLv} ${CLASSES[c.cls].name}`;
    const contHtml = chars.length ? `
        <button class="btn gold t-cont" data-i="0" style="width:100%;padding:10px;font-size:15px;margin-bottom:6px">▶ Continuar como ${label(chars[0])}</button>
        ${chars.slice(1).map((c, i) => `<button class="btn t-cont" data-i="${i + 1}" style="width:100%;margin-bottom:4px">${label(c)}</button>`).join('')}
        <div class="muted" style="text-align:center;margin:6px 0">— ou crie um novo personagem —</div>` : '';
    o.innerHTML = `<div class="title-box"><h1>${GAME_TITLE}</h1><div class="sub">UM RPG DE CLASSES, CARTAS E AVENTURA</div>
      <div class="card">
        ${contHtml}
        <canvas id="preview" width="120" height="110"></canvas>
        <label>Nome</label><input type="text" id="t-name" maxlength="16" placeholder="Seu nome de aventureiro">
        <label>Cor do cabelo</label><div class="swatches" id="t-hair">${HAIR_COLORS.map((c, i) => `<div class="sw ${i ? '' : 'on'}" style="background:${c}" data-c="${c}"></div>`).join('')}</div>
        <label>Tom de pele</label><div class="swatches" id="t-skin">${SKIN_COLORS.map((c, i) => `<div class="sw ${i ? '' : 'on'}" style="background:${c}" data-c="${c}"></div>`).join('')}</div>
        <label>Penteado</label><div class="swatches" id="t-style">${[0, 1, 2].map(i => `<div class="sw ${i ? '' : 'on'}" style="background:#555;display:grid;place-items:center;font-size:11px" data-c="${i}">${i + 1}</div>`).join('')}</div>
        <div class="row"><button class="btn ${chars.length ? '' : 'gold'}" id="t-new">${chars.length ? 'Criar novo personagem' : 'Começar aventura'}</button></div>
      </div><div class="ver">v${GAME_VERSION} • clique para ativar o som</div></div>`;
    o.classList.add('show');
    const prev = $('preview'), pc = prev.getContext('2d');
    let raf;
    const draw = () => {
      pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, 120, 110);
      pc.setTransform(2, 0, 0, 2, 60, 100);
      drawHumanoid(pc, 0, 0, { dir: 1, body: CLASSES.aprendiz.color, accent: CLASSES.aprendiz.accent, hair, skin, hairStyle: style, weapon: 'adaga' }, performance.now() / 1000);
      raf = requestAnimationFrame(draw);
    };
    draw();
    const pick = (id, cb) => $(id).querySelectorAll('.sw').forEach(s => s.onclick = () => { $(id).querySelectorAll('.sw').forEach(x => x.classList.remove('on')); s.classList.add('on'); cb(s.dataset.c); Sound.init(); });
    pick('t-hair', c => hair = c); pick('t-skin', c => skin = c); pick('t-style', c => style = +c);
    o.onclick = () => Sound.init();
    $('t-new').onclick = () => {
      const name = $('t-name').value.trim() || 'Aventureiro';
      const same = chars.find(c => c.slug === saveSlug(name));
      if (same && !confirm(`Já existe um personagem chamado ${same.name}. Criar outro com o mesmo nome substitui o antigo. Continuar?`)) return;
      cancelAnimationFrame(raf); Sound.init(); startNewGame(name, { hair, skin, hairStyle: style });
    };
    o.querySelectorAll('.t-cont').forEach(b => b.onclick = async () => {
      Sound.init();
      try { const s = await loadCharacter(chars[+b.dataset.i]); cancelAnimationFrame(raf); continueGame(s); }
      catch (e) { alert('Não consegui carregar esse personagem: ' + e.message); }
    });
    setTimeout(() => $('t-name') && $('t-name').focus(), 50);
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
