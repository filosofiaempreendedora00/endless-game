/* =========================================================================
   GRUPO (party) ONLINE — P-026
   O servidor (server.py, /api/party/*) guarda os grupos: líder, até 6 membros,
   convites que expiram em 30 s, chat de grupo e sussurro. Aqui fica a parte
   do jogador:
   - quadro do grupo embaixo do seu retrato (nome, classe, níveis, vida e SP,
     quem está longe, em outra sala ou desconectado; coroa no líder);
   - convite na tela (Aceitar / Recusar) e menu ao clicar com o botão DIREITO
     (clique rápido, sem arrastar) em outro jogador: Convidar, Sussurrar, Seguir;
   - comandos no chat: /convidar nome · /g mensagem · /s nome mensagem ·
     /sairgrupo · /expulsar nome · /lider nome · /expgrupo igual|matou;
   - EXP dividida ao derrotar um monstro com o grupo por perto (regra
     partyShare em js/rules.js; o servidor confere ritmo e limites — na fase 3
     do online a recompensa passa a ser calculada pelo próprio servidor);
   - membros no minimapa e no mapa grande (bolinhas verdes).
   ========================================================================= */
let C = null;
const P = { party: null, invite: null, inviteEl: null, lastSeq: null, follow: null, menu: null, frame: null, mx: 0, my: 0, rdown: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CROWN = '<svg class="pt-crown" viewBox="0 0 16 12" width="14" height="11" aria-label="Líder"><path d="M1 10 L2 3 L5.5 6.5 L8 1 L10.5 6.5 L14 3 L15 10 Z" fill="#ffd76a" stroke="#6a4a10" stroke-width="1"/></svg>';

export function initParty(ctx) {
  if (C) { C = { ...C, ...ctx }; return; }
  C = ctx;
  C.net.onNetView(onView);
  // comandos de grupo no chat (antes dos comandos de teste do mestre)
  const prev = C.H3.chatCmd;
  C.H3.chatCmd = (cmd, args, raw) => (partyCmd(cmd, args, raw) || (prev ? prev(cmd, args, raw) : false));
  C.H3.partyKill = partyKill;
  C.H3.partyDots = partyDots;
  // menu no clique direito rápido sobre outro jogador (o direito arrastando continua girando a câmera)
  const cv = C.renderer.domElement;
  cv.addEventListener('mousedown', e => { if (e.button === 2) { P.rdown = true; P.mx = e.clientX; P.my = e.clientY; } else closeMenu(); });
  addEventListener('mouseup', e => {
    if (e.button !== 2 || !P.rdown) return; P.rdown = false;
    if (Math.hypot(e.clientX - P.mx, e.clientY - P.my) > 5) return;
    const R = pickPlayer(e.clientX, e.clientY); if (R) openMenu(R, e.clientX, e.clientY);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

async function post(act, body = {}) {
  const id = C.net.netId(); if (!id) { C.log('Você ainda não está conectado ao mundo online.', 'warn'); return null; }
  try {
    const r = await fetch('/api/party/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const j = await r.json(); if (j && j.msg) C.log(j.msg, j.ok ? 'sys' : 'warn'); return j;
  } catch (e) { C.log('Não deu para falar com o servidor agora.', 'warn'); return null; }
}

/* ---------- resposta do servidor (a cada ~200 ms) ---------- */
function onView(j) {
  P.party = j.party || null;
  // mensagens de grupo, sussurro e avisos do sistema (na primeira resposta só marca onde está)
  if (P.lastSeq === null) P.lastSeq = j.seq || 0;
  else for (const m of j.chat || []) {
    if (!m.ch || m.seq <= P.lastSeq) continue; P.lastSeq = Math.max(P.lastSeq, m.seq);
    if (m.ch === 'sys') C.log('👥 ' + m.text, 'party');
    else if (m.ch === 'g') C.log(`[Grupo] ${m.name}: ${m.text}`, 'party');
    else if (m.ch === 'w') C.log(m.id === C.net.netId() ? `[Para ${m.toName}] ${m.text}` : `[De ${m.name}] ${m.text}`, 'whisper');
  }
  P.lastSeq = Math.max(P.lastSeq, j.seq || 0);
  showInvite(j.invite || null);
  for (const c of j.credits || []) { // parte da EXP que um membro ganhou perto de você
    C.gainExp(c.exp || 0, c.jexp || 0); if (c.zeny) { C.S.p.zeny += c.zeny; }
    C.log(`👥 +${c.exp} EXP de grupo (${c.from}${c.mon ? ' derrotou ' + c.mon : ''})`, 'party');
  }
  renderFrame();
}

/* ---------- quadro do grupo ---------- */
function renderFrame() {
  const host = document.getElementById('status'); if (!host) return;
  if (!P.party) { if (P.frame) { P.frame.remove(); P.frame = null; } return; }
  if (!P.frame) {
    P.frame = document.createElement('div'); P.frame.id = 'party-frame';
    host.appendChild(P.frame);
    P.frame.addEventListener('click', e => {
      const b = e.target.closest('[data-pa]'); if (b) { e.stopPropagation(); return partyBtn(b.dataset.pa, b.dataset.who); }
      const row = e.target.closest('.pt-row'); if (row) { e.stopPropagation(); rowMenu(row.dataset.id, e.clientX, e.clientY); }
    });
  }
  const pt = P.party, room = C.S.arena ? 'arena' : C.S.interior ? C.S.interior.id : null;
  const rows = pt.members.map(m => {
    const cls = C.CLASSES[m.cls] || {}, hp = m.maxHp ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0, sp = m.maxSp ? Math.max(0, Math.min(1, m.sp / m.maxSp)) : 0;
    const where = !m.online ? 'desconectado' : (m.room || null) !== room ? 'em outra área' : m.dist > 60 ? `longe · ${Math.round(m.dist)} m` : m.dead ? 'caído' : '';
    return `<div class="pt-row${m.me ? ' me' : ''}${m.online ? '' : ' off'}" data-id="${esc(m.id)}" title="${m.me ? 'Você' : 'Clique para opções'}">
      <span class="pt-face" style="background:${esc(cls.color || '#556')}">${esc((cls.name || '?').slice(0, 1))}</span>
      <div class="pt-mid"><div class="pt-name">${m.leader ? CROWN : ''}<b>${esc(m.name)}</b><span>${esc(cls.name || '')}${m.baseLv ? ' · ' + m.baseLv + '/' + (m.jobLv || 1) : ''}</span></div>
      <div class="pt-bar hp"><i style="width:${(hp * 100).toFixed(0)}%"></i></div><div class="pt-bar sp"><i style="width:${(sp * 100).toFixed(0)}%"></i></div>
      ${where ? `<div class="pt-where">${esc(where)}</div>` : ''}</div></div>`;
  }).join('');
  const mode = pt.mode === 'igual' ? 'EXP igual' : 'EXP de quem matou';
  P.frame.innerHTML = `<div class="pt-head"><span>Grupo (${pt.members.length}/6)</span>${pt.leaderMe
    ? `<button data-pa="mode" title="Como a EXP é dividida (só o líder muda)">${mode}</button>` : `<em>${mode}</em>`}<button data-pa="leave" title="Sair do grupo">Sair</button></div>${rows}`;
}

function partyBtn(a, who) {
  closeMenu();
  if (a === 'mode') post('mode', { mode: P.party && P.party.mode === 'igual' ? 'quem_matou' : 'igual' });
  else if (a === 'leave') post('leave');
  else if (a === 'kick') post('kick', { target: who });
  else if (a === 'lead') post('lead', { target: who });
  else if (a === 'invite') post('invite', { target: who });
  else if (a === 'whisper') whisperTo(who);
  else if (a === 'follow') follow(who);
}

function rowMenu(id, x, y) {
  const m = P.party && P.party.members.find(r => r.id === id); if (!m) return;
  if (m.me) return openMenuAt(x, y, m.name, [['leave', 'Sair do grupo', '']]);
  const items = [['whisper', 'Sussurrar', m.name]];
  if (m.online) items.push(['follow', 'Seguir', m.id]);
  if (P.party.leaderMe) items.push(['lead', 'Passar a liderança', m.name], ['kick', 'Remover do grupo', m.name]);
  openMenuAt(x, y, m.name, items);
}

/* ---------- clique direito em outro jogador ---------- */
const _ray = { r: null, v: null };
function pickPlayer(cx, cy) {
  const THREE = C.THREE; if (!_ray.r) { _ray.r = new THREE.Raycaster(); _ray.v = new THREE.Vector2(); }
  const rect = C.renderer.domElement.getBoundingClientRect();
  _ray.v.set((cx - rect.left) / rect.width * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1); _ray.r.setFromCamera(_ray.v, C.camera);
  let best = null, bd = 1e9;
  for (const [id, R] of C.net.netOthers()) {
    if (!R.root.visible) continue;
    const hit = _ray.r.intersectObject(R.root, true)[0];
    if (hit && hit.distance < bd) { bd = hit.distance; best = { id, R }; }
    else if (!hit) { // corpo fino: aceita um clique perto do centro do personagem também
      const c = R.ch.obj.position.clone(); c.y += 1; const d = _ray.r.ray.distanceToPoint(c);
      if (d < 0.55) { const dd = c.distanceTo(_ray.r.ray.origin); if (dd < bd) { bd = dd; best = { id, R }; } }
    }
  }
  return best;
}
function openMenu(hit, x, y) {
  const name = hit.R.info && hit.R.info.name, inParty = P.party && P.party.members.some(m => m.id === hit.id);
  const items = [];
  if (!inParty) items.push(['invite', 'Convidar para o grupo', hit.id]);
  items.push(['whisper', 'Sussurrar', name], ['follow', 'Seguir', hit.id]);
  openMenuAt(x, y, name, items);
}
function openMenuAt(x, y, title, items) {
  closeMenu();
  const el = document.createElement('div'); el.id = 'pt-menu';
  el.innerHTML = `<div class="pm-title">${esc(title)}</div>` + items.map(([a, t, w]) => `<button data-pa="${a}" data-who="${esc(w)}">${esc(t)}</button>`).join('');
  el.style.left = Math.min(x, innerWidth - 190) + 'px'; el.style.top = Math.min(y, innerHeight - 40 - items.length * 30) + 'px';
  el.addEventListener('click', e => { const b = e.target.closest('[data-pa]'); if (b) partyBtn(b.dataset.pa, b.dataset.who); });
  el.addEventListener('mousedown', e => e.stopPropagation());
  document.body.appendChild(el); P.menu = el;
  setTimeout(() => addEventListener('mousedown', closeMenu, { once: true }), 0);
}
function closeMenu() { if (P.menu) { P.menu.remove(); P.menu = null; } }

function whisperTo(name) {
  const inp = document.getElementById('chatinput'); if (!inp || !name) return;
  if (document.getElementById('chat') && document.getElementById('chat').classList.contains('min')) document.getElementById('chat-min')?.click();
  inp.value = `/s ${name} `; inp.focus();
}

/* ---------- seguir outro jogador ---------- */
function follow(id) {
  const R = C.net.netOthers().get(id); if (!R) { C.log('Essa pessoa não está por perto.', 'warn'); return; }
  P.follow = id; C.log(`Seguindo ${R.info.name}. (Ande com WASD para parar.)`, 'sys');
}
export function updateParty() {
  const S = C && C.S; if (!S) return;
  if (!P.follow) { S.followTo = null; return; }
  const R = C.net.netOthers().get(P.follow);
  if (!R || !R.root.visible || S.followStop) { P.follow = null; S.followTo = null; S.followStop = false; C.log('Você parou de seguir.', 'sys'); return; }
  const q = R.ch.obj.position; S.followTo = { x: q.x, z: q.z };
}

/* ---------- convite ---------- */
function showInvite(inv) {
  if (!inv) { if (P.inviteEl) { P.inviteEl.remove(); P.inviteEl = null; } P.invite = null; return; }
  P.invite = inv;
  if (!P.inviteEl) {
    const el = P.inviteEl = document.createElement('div'); el.id = 'pt-invite'; el.className = 'panel';
    el.addEventListener('click', e => { const b = e.target.closest('[data-iv]'); if (!b) return; post(b.dataset.iv); el.remove(); P.inviteEl = null; });
    document.body.appendChild(el);
  }
  P.inviteEl.innerHTML = `<b>${esc(inv.from)}</b> convidou você para o grupo${inv.size > 1 ? ` (${inv.size} membros)` : ''}.
    <div class="iv-btns"><button data-iv="accept">Aceitar</button><button data-iv="decline">Recusar</button></div><div class="iv-time">${Math.max(0, Math.ceil(inv.left))} s</div>`;
}

/* ---------- chat: comandos ---------- */
function partyCmd(cmd, args, raw) {
  const rest = raw.replace(/^\/\S+\s*/, '');
  switch (cmd) {
    case 'convidar': case 'c': if (!args[0]) C.log('Use: /convidar nome', 'warn'); else post('invite', { target: rest.trim() }); return true;
    case 'g': case 'grupo': if (!rest.trim()) { C.log(P.party ? `Grupo: ${P.party.members.map(m => m.name).join(', ')}` : 'Você não está num grupo. Clique com o botão direito em outro jogador para convidar.', 'sys'); return true; }
      if (!P.party) { C.log('Você não está num grupo.', 'warn'); return true; } post('chat', { ch: 'g', text: rest.trim() }); return true;
    case 's': case 'sussurrar': { const to = args[0], text = rest.slice((to || '').length).trim(); if (!to || !text) C.log('Use: /s nome mensagem', 'warn'); else post('chat', { ch: 'w', to, text }); return true; }
    case 'sairgrupo': post('leave'); return true;
    case 'expulsar': if (args[0]) post('kick', { target: rest.trim() }); return true;
    case 'lider': if (args[0]) post('lead', { target: rest.trim() }); return true;
    case 'expgrupo': post('mode', { mode: /^ig/.test(args[0] || '') ? 'igual' : 'quem_matou' }); return true;
  }
  return false;
}

/* ---------- EXP dividida ---------- */
// chamado ao derrotar um monstro; true = o grupo cuidou da recompensa (o main3d não dá a EXP cheia)
function partyKill(m, d) {
  const pt = P.party; if (!pt || pt.mode !== 'igual') return false;
  const room = C.S.arena ? 'arena' : C.S.interior ? C.S.interior.id : null;
  const near = pt.members.filter(x => !x.me && x.online && !x.dead && (x.room || null) === room && x.dist != null && x.dist <= 60).length;
  if (!near) return false;
  const exp = d.exp || 0, jexp = d.jexp || 0;
  post('share', { exp, jexp, zeny: d.zeny || 0, mon: d.name || m.type }).then(j => {
    const mine = j && j.ok && j.mine ? j.mine : { exp, jexp, zeny: 0 }; // sem resposta: fica com tudo
    C.gainExp(mine.exp, mine.jexp); if (mine.zeny) C.S.p.zeny += mine.zeny;
    if (j && j.shared) C.log(`👥 EXP dividida com ${j.shared} do grupo (${mine.exp} para você, bônus de grupo incluído).`, 'party');
  });
  return true;
}
// previsão da parte de cada um (mesma conta do servidor, para mostrar na interface)
export const partyPreview = (total, n, mode) => (typeof partyShare === 'function' ? partyShare(total, n, mode) : total);

/* ---------- minimapa e mapa grande ---------- */
function partyDots() {
  if (!P.party) return [];
  const room = C.S.arena ? 'arena' : C.S.interior ? C.S.interior.id : null;
  return P.party.members.filter(m => !m.me && m.online && m.x != null && (m.room || null) === room).map(m => ({ x: m.x, z: m.z, name: m.name, leader: m.leader }));
}
