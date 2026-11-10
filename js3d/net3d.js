/* =========================================================================
   ONLINE — FASE 1 (presença no mundo + chat entre jogadores)
   O servidor (server.py) só repassa: cada cliente manda onde está e o que faz
   a cada ~200 ms (/api/world/sync) e recebe os outros jogadores por perto
   (mesma sala, ou até 150 m). Os outros aparecem com o mesmo visual (raça,
   classe, chapéu, arma, montaria), andam suavizados (interpolação ~220 ms
   atrás do tempo real, nada de "teleportar aos saltos"), tocam a animação
   certa e têm placa com nome e classe. Não são alvo de ataque fora da Arena
   e não colidem (ninguém fica preso em ninguém).

   Também fica aqui a CHAVE DO JOGADOR: um token aleatório guardado no
   navegador e mandado em toda chamada /api/ (cabeçalho X-Aethra-Token). O
   servidor usa o hash dele como "dono" dos saves: de fora, cada um só vê e
   grava os próprios personagens (o Vidro nunca pode ser sobrescrito).
   ========================================================================= */
const TOKEN_KEY = 'aethra_token';
export function playerToken() {
  let t = null;
  try { t = localStorage.getItem(TOKEN_KEY); } catch (e) { }
  if (!t || !/^[A-Za-z0-9_-]{16,128}$/.test(t)) {
    const a = new Uint8Array(24); (self.crypto || window.crypto).getRandomValues(a);
    t = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { }
  }
  return t;
}
// toda chamada /api/ do próprio jogo leva a chave (vale para salvar, listar, apagar, sugestões...)
(function patchFetch() {
  if (window.__aethraFetch) return; window.__aethraFetch = true;
  const tok = playerToken(), orig = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.startsWith('/api/') || url.startsWith(location.origin + '/api/')) {
        const h = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers || {});
        init = { ...init, headers: { ...h, 'X-Aethra-Token': tok } };
      }
    } catch (e) { }
    return orig(input, init);
  };
})();

const SYNC_EVERY = 0.2, DELAY = 0.22, FAR = 140;
const ATTACK_RE = /Attack|Punch|Shoot|Spell|Chop|Slice|Stab|Swing/;
let C = null;            // contexto vindo do main3d
const N = { id: null, since: -1, busy: false, last: -9, others: new Map(), failed: 0 };

export function initNet(ctx) {
  const again = !!C; C = ctx; _p = new ctx.THREE.Vector3();
  N.id = null; if (again) return; // já ligado (outro personagem na mesma aba)
  // o chat normal (sem "/") também vai para os outros jogadores
  const prevSay = C.H3.say;
  C.H3.say = txt => { if (prevSay) prevSay(txt); sendChat(txt); };
  addEventListener('pagehide', leave);
}

function myId() {
  const p = C.S.p; if (!p) return null;
  if (!N.id || !N.id.startsWith((p.charId || p.name) + '-')) N.id = (p.charId || p.name) + '-' + Math.random().toString(36).slice(2, 8);
  return N.id;
}

function myState() {
  const S = C.S, p = S.p, me = S.me, sp = S.vel ? Math.hypot(S.vel.x, S.vel.z) : 0;
  return {
    id: myId(), since: Math.max(0, N.since), name: p.name, cls: p.cls, look: p.look, baseLv: p.baseLv,
    hat: C.hatOf(p), wpn: C.wpnOf(p), off: C.offOf(p), skin: p.cosmetics && p.cosmetics.skin || null,
    riding: S.riding && p.mount ? p.mount.kind : null,
    x: +S.pos.x.toFixed(2), y: +(S.pos.y || 0).toFixed(2), z: +S.pos.z.toFixed(2), yaw: +(me ? me.obj.rotation.y : S.pos.yaw).toFixed(3),
    anim: me && me.anim ? me.anim.name : 'Idle', moving: sp > 0.3, speed: +sp.toFixed(2), sit: !!S.sitting, dead: !!p.dead,
    room: S.arena ? 'arena' : S.interior ? S.interior.id : null, hp: p.hp, maxHp: p.d ? p.d.maxHp : p.hp,
    atk: (S.atkN || 0) + (S.katN || 0), clip: me && me.anim ? me.anim.name : null,
  };
}

async function sync() {
  if (N.busy) return; N.busy = true;
  try {
    const r = await fetch('/api/world/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(myState()) });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json(); N.failed = 0;
    receive(j);
  } catch (e) { N.failed++; }
  N.busy = false;
}

function receive(j) {
  const now = performance.now() / 1000, seen = new Set();
  // chat: na primeira resposta só marca onde está (não despeja o histórico)
  if (N.since < 0) N.since = j.seq || 0;
  else for (const m of j.chat || []) { N.since = Math.max(N.since, m.seq); if (m.id === N.id) continue; C.log(`${m.name}: ${m.text}`, 'net'); const o = N.others.get(m.id); if (o) bubble(o, m.text); }
  N.since = Math.max(N.since, j.seq || 0);
  for (const o of j.players || []) {
    seen.add(o.id);
    let R = N.others.get(o.id);
    const key = JSON.stringify([o.cls, o.look, o.hat, o.wpn, o.off, o.skin, o.riding]);
    if (!R || R.key !== key) { const old = R; R = build(o, key); if (old) { R.snaps = old.snaps; R.atk = old.atk; drop(old); } N.others.set(o.id, R); }
    R.info = o; R.lastSeen = now;
    R.snaps.push({ t: now - (o.age || 0), x: o.x, y: o.y || 0, z: o.z, yaw: o.yaw });
    if (R.snaps.length > 12) R.snaps.shift();
    if (o.atk !== undefined && R.atk !== undefined && o.atk > R.atk && o.clip && ATTACK_RE.test(o.clip)) R.pendingAtk = o.clip; // golpe novo: toca mesmo que tenha acontecido entre dois envios
    R.atk = o.atk;
  }
  for (const [id, R] of N.others) if (!seen.has(id) && now - R.lastSeen > 1.5) { drop(R); N.others.delete(id); }
}

function build(o, key) {
  const pc = C.buildPreviewChar(o.look || {}, o.cls || 'aprendiz', o.skin ? { skin: o.skin } : null, o.hat || null, o.wpn || null);
  const ch = pc.ch, root = new C.THREE.Group(); root.add(ch.obj); C.scene.add(root);
  let mt = null;
  if (o.riding) { try { mt = C.makeMount(o.riding); root.add(mt.obj); } catch (e) { mt = null; } }
  const tag = document.createElement('div'); tag.className = 'net-name';
  const nm = document.createElement('b'); nm.textContent = o.name || 'Aventureiro';
  const cl = document.createElement('span'); cl.textContent = (C.CLASSES[o.cls] ? C.CLASSES[o.cls].name : '') + (o.baseLv ? ` · Nv. ${o.baseLv}` : '');
  tag.append(nm, cl); (document.getElementById('plates') || document.body).appendChild(tag);
  return { key, root, ch, fx: pc.fx, mt, tag, snaps: [], anim: null, lastSeen: 0, info: o, say: null };
}

function drop(R) { C.scene.remove(R.root); R.tag.remove(); if (R.say) R.say.el.remove(); }

function bubble(R, text) {
  if (R.say) R.say.el.remove();
  const el = document.createElement('div'); el.className = 'npc-say net-say'; el.textContent = text.length > 80 ? text.slice(0, 78) + '…' : text;
  (document.getElementById('plates') || document.body).appendChild(el); R.say = { el, t0: performance.now() / 1000 };
}

async function sendChat(text) {
  text = String(text || '').trim(); if (!text || text.startsWith('/') || !N.id) return;
  try { await fetch('/api/world/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: N.id, text }) }); } catch (e) { }
}

function leave() {
  if (!N.id) return;
  try { navigator.sendBeacon('/api/world/leave', JSON.stringify({ id: N.id })); } catch (e) { }
}

const _v = { x: 0, y: 0, z: 0 };
function sample(R, t) { // posição interpolada no tempo t (atrás do tempo real, para sair liso)
  const s = R.snaps; if (!s.length) return null;
  if (t <= s[0].t) return s[0];
  for (let i = s.length - 1; i > 0; i--) {
    const a = s[i - 1], b = s[i];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / Math.max(1e-3, b.t - a.t); let dy = b.yaw - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      _v.x = a.x + (b.x - a.x) * k; _v.y = a.y + (b.y - a.y) * k; _v.z = a.z + (b.z - a.z) * k; _v.yaw = a.yaw + dy * k; return _v;
    }
  }
  const L = s[s.length - 1]; return L; // sem dado novo: para no último ponto (não extrapola para dentro de paredes)
}

export function updateNet(dt) {
  if (!C || !C.S.started || !C.S.p) return;
  const S = C.S, now = performance.now() / 1000;
  if (S.time - N.last >= SYNC_EVERY) { N.last = S.time; sync(); }
  const myRoom = S.arena ? 'arena' : S.interior ? S.interior.id : null;
  for (const R of N.others.values()) {
    const o = R.info, same = (o.room || null) === myRoom && myRoom !== 'arena', q = sample(R, now - DELAY);
    const far = !q || Math.hypot(q.x - S.pos.x, q.z - S.pos.z) > FAR;
    R.root.visible = same && !far; R.tag.style.display = R.root.visible ? '' : 'none';
    if (!R.root.visible) { if (R.say) R.say.el.style.opacity = '0'; continue; }
    // posição e rotação
    if (R.mt) {
      R.mt.obj.position.set(q.x, q.y, q.z); R.mt.obj.rotation.y = q.yaw;
      R.mt.animate && R.mt.animate(S.time, { speed: Math.min(1.6, (o.speed || 0) / 6), turn: 0, air: false, vy: 0 }, dt);
      R.ch.obj.position.set(q.x, q.y + (R.mt.saddleY || 1.5) + (R.mt.bodyY || 0) - 0.52, q.z); R.ch.obj.rotation.y = q.yaw;
    } else { R.ch.obj.position.set(q.x, q.y, q.z); R.ch.obj.rotation.y = q.yaw; }
    // animação: golpe novo toca uma vez; o resto segue o estado mandado
    const a = R.ch.anim;
    if (R.pendingAtk) { a.play(R.pendingAtk, { once: true, restart: true, fade: 0.06, speed: 1.4 }); R.anim = R.pendingAtk; R.atkUntil = now + 0.45; R.pendingAtk = null; }
    else if (!(R.atkUntil > now)) {
      const want = R.mt ? 'Sit_Chair_Idle' : o.dead ? 'Death_A' : o.anim && !ATTACK_RE.test(o.anim) ? o.anim : o.moving ? 'Running_A' : 'Idle';
      if (R.anim !== want) { a.play(want, want === 'Death_A' ? { once: true, fade: 0.15 } : want === 'Walking_Backwards' ? { speed: -1.05, fade: 0.2 } : { fade: 0.2 }); R.anim = want; }
    }
    a.update(dt); if (R.fx) R.fx(S.time);
    if (R.mt && C.riderPose) C.riderPose(R.ch, R.mt, { t: S.time, gait: Math.min(1, (o.speed || 0) / 6) });
    // placa com nome e balão de fala
    _p.set(q.x, (R.mt ? q.y + 2.9 : q.y + 2.15), q.z); const sc = C.toScreen(_p);
    R.tag.style.transform = `translate(${sc.x}px, ${sc.y}px) translate(-50%, -100%)`; R.tag.style.opacity = sc.vis ? '1' : '0';
    if (R.say) { const age = now - R.say.t0; if (age > 5) { R.say.el.remove(); R.say = null; } else { _p.y += 0.45; const s2 = C.toScreen(_p); R.say.el.style.transform = `translate(${s2.x}px, ${s2.y}px) translate(-50%, -100%)`; R.say.el.style.opacity = s2.vis ? String(Math.min(1, age * 4, (5 - age) * 2)) : '0'; } }
  }
}
let _p = null;
export const netPlayers = () => N.others.size;
