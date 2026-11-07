'use strict';
/* =========================================================================
   PAINEL DO MESTRE (⌘/Ctrl + Z) — só na conta de administrador (veja isAdmin).
   Teleporte por mapa + atalhos de mestre. Novas ferramentas de admin entram aqui.
   ========================================================================= */

const ADMIN = {
  sel: null, hover: null, scale: 1, view: null,

  render() {
    const p = G.player; if (!p) return;
    if (!this.sel || !MAPS[this.sel]) this.sel = G.mapId;
    const def = MAPS[this.sel];
    const body = UI.body('admin');
    const pois = this.pois(this.sel).map((o, i) => `<button class="btn small" data-poi="${i}">${o.label}</button>`).join('');
    body.innerHTML = `
      <div class="adm-top">
        <button class="btn ${G.god ? 'gold' : ''}" id="adm-god">${G.god ? '⚡ God Mode: LIGADO' : '⚡ God Mode: desligado'}</button>
        <span class="muted">Atalho: <b>Z</b> · com God Mode, <b>botão direito</b> no mapa do jogo teleporta</span>
      </div>
      <h4 class="adm-h">🌍 Teleporte — escolha o mapa e clique onde quer aparecer</h4>
      <div class="tabs">${Object.keys(MAPS).map(id => `<div class="tab ${id === this.sel ? 'on' : ''}" data-map="${id}">${MAPS[id].name}</div>`).join('')}</div>
      <canvas id="adm-map"></canvas>
      <div id="adm-info" class="muted">${def.name} · ${def.lvl} — passe o mouse e clique para ir</div>
      <div class="adm-poi"><span class="muted">Ir direto para:</span> ${pois}</div>
      <h4 class="adm-h">🛠️ Atalhos de mestre</h4>
      <div class="adm-btns">
        <button class="btn small" data-cmd="cura">❤️ Curar tudo</button>
        <button class="btn small" data-cmd="lv1">⭐ +1 Nível Base</button>
        <button class="btn small" data-cmd="lv5">⭐ +5 Níveis Base</button>
        <button class="btn small" data-cmd="job1">✦ +1 Nível Classe</button>
        <button class="btn small" data-cmd="job10">✦ +10 Níveis Classe</button>
        <button class="btn small" data-cmd="zeny">💰 +10.000 z</button>
        <button class="btn small" data-cmd="rate">📈 EXP ${CONFIG.EXP_RATE}× (trocar)</button>
      </div>`;
    body.querySelector('#adm-god').onclick = () => toggleGod();
    body.querySelectorAll('[data-map]').forEach(el => el.onclick = () => { this.sel = el.dataset.map; this.render(); });
    const pl = this.pois(this.sel);
    body.querySelectorAll('[data-poi]').forEach(el => el.onclick = () => this.go(pl[+el.dataset.poi]));
    body.querySelectorAll('[data-cmd]').forEach(el => el.onclick = () => this.cmd(el.dataset.cmd));
    const cv = body.querySelector('#adm-map');
    cv.onmousemove = e => { this.hover = this.tileAt(e); this.draw(); this.info(); };
    cv.onmouseleave = () => { this.hover = null; this.draw(); this.info(); };
    cv.onclick = e => { const t = this.tileAt(e); if (t) this.go({ map: this.sel, tx: t[0], ty: t[1] }); };
    this.draw();
  },

  // pontos de interesse do mapa selecionado
  pois(id) {
    const def = MAPS[id], out = [{ label: '📍 Centro', map: id, tx: def.spawn[0], ty: def.spawn[1] }];
    for (const n of def.npcs || []) out.push({ label: `🧑 ${n.name}`, map: id, tx: n.x, ty: n.y + 1 });
    for (const pt of def.portals) out.push({ label: `🌀 Portal → ${MAPS[pt.to].name}`, map: id, tx: pt.x, ty: pt.y, portal: true });
    for (const s of def.spawns || []) {
      const md = MONSTERS[s.type];
      if (md.boss || md.mini) out.push({ label: `${md.boss ? '👑' : '💀'} Perto do ${md.name}`, map: id, monster: s.type });
    }
    return out;
  },

  go(o) {
    UI.close('admin');
    if (o.monster) { // entra no mapa e aparece ao lado do chefe
      if (G.mapId !== o.map) godTeleport(o.map, ...MAPS[o.map].spawn);
      const m = G.monsters.find(x => x.type === o.monster && !x.dead);
      if (!m) { UI.log('Esse chefe ainda não reapareceu.', 'warn'); return; }
      godTeleport(o.map, Math.floor(m.x / TILE) + 3, Math.floor(m.y / TILE));
      UI.log(`Teleportado para perto do ${m.def.name}.`, 'sys');
      return;
    }
    let { tx, ty } = o;
    if (o.portal) { // aparece ao lado do portal, não em cima (senão troca de mapa)
      const def = MAPS[o.map];
      tx += tx === 0 ? 2 : tx === def.w - 1 ? -2 : 0;
      ty += ty === 0 ? 2 : ty === def.h - 1 ? -2 : 0;
    }
    godTeleport(o.map, tx, ty);
    UI.log(`Teleportado: ${MAPS[o.map].name} (${tx}, ${ty}).`, 'sys');
  },

  cmd(c) {
    const p = G.player;
    if (c === 'cura') handleChat('/cura');
    else if (c === 'lv1') handleChat('/nivel ' + (p.baseLv + 1));
    else if (c === 'lv5') handleChat('/nivel ' + (p.baseLv + 5));
    else if (c === 'job1') handleChat('/classe ' + (p.jobLv + 1));
    else if (c === 'job10') handleChat('/classe ' + (p.jobLv + 10));
    else if (c === 'zeny') handleChat('/zeny 10000');
    else if (c === 'rate') { const r = [1, 3, 10, 50]; CONFIG.EXP_RATE = r[(r.indexOf(CONFIG.EXP_RATE) + 1) % r.length]; UI.log(`Taxa de EXP: ${CONFIG.EXP_RATE}×`, 'sys'); }
    saveGame(); UI.markDirty();
  },

  tileAt(e) {
    const v = this.view; if (!v) return null;
    const tx = Math.floor(e.offsetX / v.s / TILE), ty = Math.floor(e.offsetY / v.s / TILE);
    const m = getMap(this.sel);
    return m.inb(tx, ty) ? [tx, ty] : null;
  },

  info() {
    const el = document.getElementById('adm-info'); if (!el) return;
    const def = MAPS[this.sel];
    if (!this.hover) { el.innerHTML = `${def.name} · ${def.lvl} — passe o mouse e clique para ir`; return; }
    const [tx, ty] = this.hover, m = getMap(this.sel);
    const free = !m.isSolid(tx, ty) && m.reach[m.i(tx, ty)];
    const near = (def.npcs || []).find(n => Math.abs(n.x - tx) <= 1 && Math.abs(n.y - ty) <= 1);
    el.innerHTML = `Tile (${tx}, ${ty}) · ${free ? '<span style="color:#8ff0b0">livre</span>' : '<span style="color:#ffb070">bloqueado — você aparece no ponto livre mais próximo</span>'}${near ? ` · perto de <b>${esc(near.name)}</b>` : ''}`;
  },

  draw() {
    const cv = document.getElementById('adm-map'); if (!cv) return;
    const m = getMap(this.sel), def = m.def;
    const maxW = Math.min(600, cv.parentElement.clientWidth - 4), maxH = Math.max(200, Math.min(400, innerHeight * 0.42));
    const s = Math.min(maxW / (m.w * TILE), maxH / (m.h * TILE));
    const W = Math.round(m.w * TILE * s), H = Math.round(m.h * TILE * s), dpr = window.devicePixelRatio || 1;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    this.view = { s };
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.drawImage(getGround(m), 0, 0, W, H);
    c.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    const T = TILE;
    // cenário simplificado
    for (const o of m.objects) {
      if (o.type === 'house') { c.fillStyle = o.roof; c.fillRect(o.tx * T, (o.ty - 1) * T, o.w * T, (o.h + 1) * T); continue; }
      const col = { tree: '#2c5a2b', pine: '#1f4a2c', bush: '#3a7a34', rock: '#77797e', pillar: '#8f8a7e', wall: '#6a665f', deadtree: '#4e4036', fountain: '#4a90d8', lamp: '#3a3a44', crate: '#a0703c' }[o.type] || '#444';
      c.fillStyle = col; c.beginPath(); c.arc(o.tx * T + T / 2, o.ty * T + T / 2, T * (o.type === 'fountain' ? 1 : 0.48), 0, Math.PI * 2); c.fill();
    }
    const label = (txt, x, y, col) => { c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); outlinedText(c, txt, x * s, y * s, col, 10); c.restore(); };
    const dot = (x, y, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r / s, 0, Math.PI * 2); c.fill(); };
    for (const pt of def.portals) { const x = pt.x * T + T / 2, y = pt.y * T + T / 2; dot(x, y, '#9fe3ff', 6); label('🌀 ' + MAPS[pt.to].name, x, y - 14 / s, '#9fe3ff'); }
    for (const n of def.npcs || []) { const x = n.x * T + T / 2, y = n.y * T + T / 2; dot(x, y, '#ffe36a', 4); label(n.name, x, y - 12 / s, '#ffe36a'); }
    if (this.sel === G.mapId) {
      for (const mo of G.monsters) if (!mo.dead) dot(mo.x, mo.y, mo.def.boss ? '#ff3030' : mo.def.mini ? '#ffb84a' : '#ff8a8a', mo.def.boss || mo.def.mini ? 4.5 : 2);
      const p = G.player; dot(p.x, p.y, '#fff', 5); dot(p.x, p.y, '#3a8cff', 3.5); label('Você', p.x, p.y - 12 / s, '#cfe8ff');
    }
    if (this.hover) {
      const [tx, ty] = this.hover;
      c.strokeStyle = '#ffd76a'; c.lineWidth = 2 / s;
      c.strokeRect(tx * T, ty * T, T, T);
      c.beginPath(); c.arc(tx * T + T / 2, ty * T + T / 2, 10 / s, 0, Math.PI * 2); c.stroke();
    }
  },
};
UI.render_admin = () => ADMIN.render();
