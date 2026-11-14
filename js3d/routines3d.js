/* =========================================================================
   ROTINAS DOS NPCs (P-017): o vilarejo vivo, no espírito do Skyrim.

   RELÓGIO DO JOGO: 1 segundo real = 1 minuto do jogo, ou seja, um dia leva 24 min.
   A hora sai do relógio do computador (Date.now), não do quadro do jogo. Por isso todos
   os jogadores, online ou não, veem a mesma hora, sem o servidor precisar sincronizar nada.

   DETERMINÍSTICO: onde cada NPC deveria estar é calculado só a partir da hora e do id
   dele (agenda, pausas sorteadas por "hash" da hora, conversas marcadas, patrulha ao
   longo da rota pela hora). Dois jogadores veem o mesmo NPC no mesmo lugar sem trocar
   nenhuma mensagem. Só o caminho até o ponto é simulado no cliente, e só perto do jogador.
   Longe, o NPC "pula" para onde a agenda manda.

   COMO ESTENDER:
   - um NPC novo ganha uma entrada em ROUTINES (pelo id), com o posto de trabalho
     (dx,dz relativos ao centro da região), os pontos de pausa e o que faz à noite;
   - uma conversa nova é uma linha em TALKS.
   NPCs de serviço (loja, cura, classes, missão, voo, arena) nunca somem; à noite ficam
   num ponto de vigília perto do posto, para o jogador sempre achá-los.
   ========================================================================= */

const DAY_MIN = 1440;
export function gameMinutes() { const o = globalThis.__aethraClock; if (o != null) return ((Math.floor(o) % DAY_MIN) + DAY_MIN) % DAY_MIN; return Math.floor(Date.now() / 1000) % DAY_MIN; } // 0..1439 · P-020: o mestre pode fixar a hora (só na tela dele)
export function gameClock() { const m = gameMinutes(), h = Math.floor(m / 60), mm = m % 60; return { h, m: mm, total: m, label: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, night: h >= 21 || h < 5 }; }
const hash = (s, n) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); x = Math.imul(x ^ n, 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };

// ---------- dados ----------
// post: [dx, dz, yaw?(rad, undefined = virado para o centro)], anim do trabalho; spots: pausas (perto do posto)
// night: 'casa' (vai para uma porta e some até 5h) | 'vigilia' (fica num ponto perto do posto) | 'patrulha'
// lunch: 'taverna' (entra na taverna 12–13h) | 'poco' | null
export const ROUTINES = {
  // ---------- Vila de Alvorada (relativo a VILLAGE) ----------
  teodoro: { region: 'vila', post: [-1, -11], work: 'Idle', spots: [[2.2, -9], [-3.5, -8.5], [1.4, 1.6]], night: 'vigilia', nightAt: [-2.4, -10.2], lunch: 'poco', service: true },
  ivra: { region: 'vila', post: [-8, -6], work: 'Idle', spots: [[-6, -3.2], [-10.5, -8.5], [-4.2, -6.8]], night: 'vigilia', nightAt: [-8.6, -4.8], service: true },
  bento: { region: 'vila', post: [9, -7], work: 'Idle', spots: [[6.8, -5], [11, -4.4], [1.6, -1.6]], night: 'vigilia', nightAt: [7.6, -6], lunch: 'poco', service: true },
  clara: { region: 'vila', post: [-7, 7], work: 'Idle', spots: [[-4.6, 5], [-9.2, 9.2], [-1.6, 1.6]], night: 'vigilia', nightAt: [-6.2, 8.4], service: true },
  bravo: { region: 'vila', post: [13, -9], work: 'Idle', spots: [[10.4, -11], [14.6, -5.6]], night: 'vigilia', nightAt: [12, -8], lunch: 'taverna', service: true },
  flora: { region: 'vila', post: null, work: 'PickUp', workAlt: 'Idle', spots: [[1.6, -1.6], [3.4, -3]], night: 'casa', home: 2, lunch: 'poco', service: true },
  dario: { region: 'vila', post: [0, -18.4, Math.PI], work: 'Interact', spots: [[1.7, -1.4], [-2.8, -14.6]], night: 'casa', home: 0, lunch: 'taverna' },
  marta: { region: 'vila', post: [4.2, 9.5], work: 'PickUp', workAlt: 'Idle', spots: [[2.5, 2.1], /* caça-bugs: o ponto antigo (1,7; 1,5) era em cima do balde do poço */ [-1.6, 1.8], [6.8, -3.8], [-5.4, 4.4]], night: 'casa', home: 1, lunch: 'poco' },
  tobias: { region: 'vila', post: [15, 2], patrol: [[15, 2], [11.5, 11.5], [2, 15.5], [-9.6, 12.2], [-15.5, 1], [-13, -9.6], [-2.5, -15.5], [10.6, -13.4], [15.5, -5.5]], night: 'patrulha', rest: [2, 4], service: true },
  // ---------- Cidadela de Pedraclara (relativo a CITY2) ----------
  isis: { region: 'pedraclara', post: [5, -4], work: 'Idle', spots: [[2.5, -1.8], [8, -2.4], [6.2, -7]], night: 'vigilia', nightAt: [4, -3.2], service: true },
  mirela: { region: 'pedraclara', post: [-6, -7], work: 'Idle', spots: [[-3.2, -4.6], [-8.6, -4.2], [-1.6, 1.8]], night: 'vigilia', nightAt: [-5, -6], service: true },
  bastiao: { region: 'pedraclara', post: [-34, 3], patrol: [[-34, 3], [-33, -4], [-26, -5.5], [-26, 6], [-33, 7.5]], night: 'patrulha', rest: [3, 5], service: true },
};
// conversas marcadas: [hora de início (h.fração), duração em minutos de jogo, ponto (dx,dz), a, b]
export const TALKS = [
  [9.25, 14, [5.5, -9.5], 'bento', 'bravo'],
  [10.5, 12, [-4, 4.5], 'clara', 'marta'],
  [15.0, 14, [2.6, 3.6], 'flora', 'marta'],
  [16.25, 12, [-5, -9], 'teodoro', 'ivra'],
  [19.5, 18, [6, -2.5], 'bento', 'dario'],
  [11.0, 12, [3.5, -2.5], 'isis', 'mirela'],
];

// ---------- estado ----------
let C = null; const reg = new Map(); let clockEl = null, lastClock = '';
const WALK = 1.25, NEAR_STOP = 4.4, NEAR_GO = 6.2;

export function initRoutines(ctx) { C = ctx; }

function regionCenter(r) { return r === 'pedraclara' ? C.CITY2 : C.VILLAGE; }
function homesOf(center) { // portas das casas da vila (casa_da_vila: porta no local (−0,22·w, d/2+0,9))
  const out = [];
  for (const o of C.placed) { if (!o.userData || o.userData.asset !== 'casa_da_vila') continue; const dx = o.position.x - center.x, dz = o.position.z - center.z; if (Math.hypot(dx, dz) > 32) continue;
    const r = o.rotation.y, cs = Math.cos(r), sn = Math.sin(r), lx = -1.67, lz = 4.3; out.push({ x: o.position.x + lx * cs + lz * sn, z: o.position.z - lx * sn + lz * cs, yaw: r }); }
  out.sort((a, b) => Math.atan2(a.z - center.z, a.x - center.x) - Math.atan2(b.z - center.z, b.x - center.x));
  return out;
}
function tavernDoor() { const p = (C.portals || []).find(q => q.to === 'taverna'); return p ? { x: p.out.x, z: p.out.z, door: { x: p.x, z: p.z } } : null; }

function register(n) {
  const R = ROUTINES[n.id]; if (!R) return;
  const c = regionCenter(R.region); if (!c) return;
  // a colisão fixa que foi criada no ponto inicial sai: o NPC anda (o jogador é empurrado com cuidado, abaixo)
  const i = C.colliders.findIndex(q => !q.box && Math.abs(q.x - n.x) < 0.01 && Math.abs(q.z - n.z) < 0.01 && q.r <= 0.61); if (i >= 0) C.colliders.splice(i, 1);
  const post = R.post ? { x: c.x + R.post[0], z: c.z + R.post[1], yaw: R.post[2] } : { x: n.x, z: n.z, yaw: n.obj.rotation.y };
  if (post.yaw === undefined) post.yaw = Math.atan2(c.x - post.x, c.z - post.z);
  const homes = homesOf(c), home = R.night === 'casa' ? (homes[(R.home || 0) % Math.max(1, homes.length)] || null) : null;
  reg.set(n, { R, c, post, home, st: 'idle', hidden: false, act: null, stuck: 0, lastD: 1e9, attend: false });
  n.x = post.x; n.z = post.z; n.obj.position.set(post.x, C.groundAt(post.x, post.z), post.z); n.obj.rotation.y = post.yaw;
}

// ---------- o que a agenda manda agora (só depende da hora e do id) ----------
function rel(c, d) { return { x: c.x + d[0], z: c.z + d[1] }; }
function patrolPoint(c, pts, t) { // ponto ao longo da rota fechada, avançando 1,1 m/s pela hora real
  const P = pts.map(p => rel(c, p)); let L = 0; const seg = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b.x - a.x, b.z - a.z); seg.push([a, b, l]); L += l; }
  let s = (t * 1.1) % L; for (const [a, b, l] of seg) { if (s <= l) { const k = s / l; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(b.x - a.x, b.z - a.z), moving: true }; } s -= l; }
  return { x: P[0].x, z: P[0].z, yaw: 0 };
}
function plan(n, E) {
  const R = E.R, c = E.c, clk = gameClock(), h = clk.h + clk.m / 60, t = Date.now() / 1000;
  // conversas marcadas têm prioridade
  for (const [h0, dur, sp, a, b] of TALKS) {
    if (n.id !== a && n.id !== b) continue; const m0 = Math.round(h0 * 60), now = clk.total; if (now < m0 || now >= m0 + dur) continue;
    const pa = rel(c, sp), side = n.id === a ? -1 : 1, x = pa.x + side * 0.72, z = pa.z;
    return { x, z, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2, anim: (Math.floor(now / 2) + (side > 0 ? 1 : 0)) % 3 === 0 ? 'Interact' : 'Idle_Talking_Loop', why: 'conversando' };
  }
  const night = h >= 21.5 || h < 5;
  if (R.patrol) {
    if (R.rest && h >= R.rest[0] && h < R.rest[1]) return { x: E.post.x, z: E.post.z, yaw: E.post.yaw, anim: 'Idle', why: 'de guarda no posto' };
    const p = patrolPoint(c, R.patrol, t); return { x: p.x, z: p.z, yaw: p.yaw, anim: 'Idle', patrol: true, why: 'patrulhando' };
  }
  if (night) {
    if (R.night === 'casa' && E.home) return { x: E.home.x, z: E.home.z, yaw: E.home.yaw + Math.PI, hide: true, why: 'em casa' };
    const at = R.nightAt ? rel(c, R.nightAt) : E.post; return { x: at.x, z: at.z, yaw: Math.atan2(c.x - at.x, c.z - at.z), anim: 'Idle', why: 'de vigília' };
  }
  if (h >= 12 && h < 13 && R.lunch) {
    if (R.lunch === 'taverna') { const d = tavernDoor(); if (d) return { x: d.door.x, z: d.door.z, yaw: 0, hide: true, why: 'almoçando na taverna' }; }
    const w = rel(c, [1.7, 1.2]); return { x: w.x + hash(n.id, 1) * 0.8, z: w.z - hash(n.id, 2) * 0.8, yaw: Math.atan2(c.x - w.x, c.z - w.z), anim: 'Interact', why: 'no poço' };
  }
  // trabalho com pausas: em cada hora, uma janela de ~12 min sorteada pelo id
  const hr = clk.h, mm = clk.m, start = Math.floor(hash(n.id, hr) * 40);
  if (R.spots && R.spots.length && mm >= start && mm < start + 12 && hash(n.id, hr + 100) < 0.75) {
    const sp = R.spots[Math.floor(hash(n.id, hr + 200) * R.spots.length)], q = rel(c, sp);
    return { x: q.x, z: q.z, yaw: Math.atan2(c.x - q.x, c.z - q.z), anim: hash(n.id, hr + 300) < 0.5 ? 'Idle' : 'Interact', why: 'de passagem' };
  }
  const alt = R.workAlt && Math.floor(t / 7 + hash(n.id, 9) * 7) % 3 === 0;
  return { x: E.post.x, z: E.post.z, yaw: E.post.yaw, anim: alt ? R.workAlt : (R.work || 'Idle'), why: 'trabalhando' };
}

// ---------- simulação ----------
function setHidden(n, E, on) { E.hidden = on; n.rtHidden = on; if (on) n.obj.visible = false; }
function play(n, name, o) { if (n.anim.name !== name) n.anim.play(name, o || { fade: 0.35 }); }
export function routineNow(n) { const E = reg.get(n); return E && E.act ? E.act.why : null; }

export function updateRoutines(dt) {
  if (!C) return; const S = C.S;
  for (const n of S.npcs) if (!reg.has(n) && ROUTINES[n.id] && n.obj) register(n);
  const P = S.pos;
  for (const [n, E] of reg) {
    const A = plan(n, E); E.act = A;
    const dPl = Math.hypot(n.x - P.x, n.z - P.z);
    // longe do jogador: pula para onde a agenda manda (sem andar, sem custo)
    if (dPl > 70) { n.x = A.x; n.z = A.z; n.obj.position.set(A.x, C.groundAt(A.x, A.z), A.z); n.obj.rotation.y = A.yaw || 0; setHidden(n, E, !!A.hide); continue; }
    // perto: se a agenda manda sumir e ele já está na porta, some; se manda voltar, reaparece na porta e anda
    if (E.hidden && !A.hide) setHidden(n, E, false);
    if (E.hidden) continue;
    // o jogador chegou perto: para, olha (npcNotice faz a cabeça) e espera ele sair
    if (dPl < NEAR_STOP) E.attend = true; else if (dPl > NEAR_GO) E.attend = false;
    if (E.attend) { if (E.walking) { E.walking = false; play(n, 'Idle'); } pushPlayer(n, P); continue; }
    const dx = A.x - n.x, dz = A.z - n.z, d = Math.hypot(dx, dz), arrive = A.patrol ? 0.35 : 0.25;
    if (d > arrive) {
      const sp = Math.min(WALK, d / Math.max(dt, 1e-3)), want = Math.atan2(dx, dz);
      n.obj.rotation.y = C.angLerp(n.obj.rotation.y, want, Math.min(1, dt * 5));
      const fwd = Math.cos(want - n.obj.rotation.y) > 0.5 ? 1 : 0.25; // vira antes de andar (nada de andar de lado)
      let nx = n.x + Math.sin(want) * sp * fwd * dt, nz = n.z + Math.cos(want) * sp * fwd * dt;
      const r = C.resolve(nx, nz, 0.4); nx = r.x; nz = r.z;
      const moved = Math.hypot(nx - n.x, nz - n.z); n.x = nx; n.z = nz; n.obj.position.set(nx, C.groundAt(nx, nz), nz);
      E.stuck = moved < sp * fwd * dt * 0.25 && fwd === 1 ? E.stuck + dt : 0;
      if (E.stuck > 2.5) { // preso num canto: dá um passo de lado; se continuar, chega de vez (fora da vista quase sempre)
        if (E.stuck > 5) { n.x = A.x; n.z = A.z; E.stuck = 0; } else { const s = hash(n.id, Math.floor(Date.now() / 2000)) < 0.5 ? 1 : -1; const r2 = C.resolve(n.x + Math.cos(want) * s * 0.06, n.z - Math.sin(want) * s * 0.06, 0.4); n.x = r2.x; n.z = r2.z; }
      }
      E.walking = true; n.anim.play('Walking_A', { fade: 0.25, speed: Math.max(0.55, sp * fwd / 1.3) }); // passos no ritmo do deslocamento (sem deslizar)
      if (A.hide && d < 0.9) { setHidden(n, E, true); E.walking = false; }
    } else {
      if (A.hide) { setHidden(n, E, true); continue; }
      E.walking = false;
      if (A.yaw !== undefined && !A.patrol) n.obj.rotation.y = C.angLerp(n.obj.rotation.y, A.yaw, Math.min(1, dt * 3));
      play(n, A.anim || 'Idle', { fade: 0.4 });
    }
    pushPlayer(n, P);
  }
  updateClockUI();
}
function pushPlayer(n, P) { // o jogador não atravessa quem está andando: empurrão macio
  const dx = P.x - n.x, dz = P.z - n.z, d = Math.hypot(dx, dz), min = 0.8; if (d < min && d > 1e-4) { const k = (min - d) * 0.5; P.x += dx / d * k; P.z += dz / d * k; }
}
function updateClockUI() {
  if (!clockEl) { const mm = document.getElementById('minimap'); if (!mm || !mm.parentElement) return; clockEl = document.createElement('div'); clockEl.id = 'game-clock'; clockEl.title = 'Hora em Aethra (um dia dura 24 minutos)';
    clockEl.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:-22px;font:600 12px/1 Cinzel,serif;color:#ffe6b0;background:rgba(14,12,24,.78);border:1px solid rgba(255,215,106,.35);border-radius:10px;padding:3px 9px;pointer-events:none;white-space:nowrap;z-index:5';
    if (getComputedStyle(mm.parentElement).position === 'static') mm.parentElement.style.position = 'relative'; mm.parentElement.appendChild(clockEl); }
  const k = gameClock(), txt = `${k.night ? '🌙' : k.h < 7 ? '🌅' : k.h >= 18 ? '🌇' : '☀️'} ${k.label}`; if (txt !== lastClock) { lastClock = txt; clockEl.textContent = txt; }
}
