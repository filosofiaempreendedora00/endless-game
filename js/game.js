'use strict';
/* =========================================================================
   JOGO — estado, jogador, combate, monstros, progressão, entrada e loop.
   ========================================================================= */

const G = {
  state: 'title', time: 0, map: null, mapId: null, mapToken: 0,
  player: null, monsters: [], npcs: [], drops: [], projectiles: [], effects: [], floaters: [], timers: [],
  cam: { x: 0, y: 0, zoom: 1.8 }, mouse: { sx: 0, sy: 0, wx: 0, wy: 0, down: false, holdMove: false }, nextHoldPath: 0,
  hover: null, targeting: null, uid: 1, lastSave: 0, maps: {},
};
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  canvas.width = VW * DPR; canvas.height = VH * DPR; canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
}
addEventListener('resize', resize); resize();

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const later = (sec, fn) => G.timers.push({ at: G.time + sec, fn, token: G.mapToken });

/* ================= Progressão ================= */
function lineage(cls) { const a = []; let c = cls; while (c) { a.unshift(c); c = CLASSES[c].parent; } return a; }
function maxJobLv(p) { return CONFIG.MAX_JOB_LV[CLASSES[p.cls].tier]; }
function baseExpNext(lv) { return Math.floor(15 * lv * lv + 20 * lv + 10); }
function jobExpNext(lv, tier) { return Math.floor((10 * lv * lv + 20 * lv + 10) * [0.15, 0.45, 0.8][tier]); }
function statCost(v) { return Math.floor((v - 1) / 10) + 2; }
function canChangeClass(p) {
  const c = CLASSES[p.cls];
  if (!c.next.length) return false;
  return p.jobLv >= (c.tier === 0 ? CONFIG.JOB_CHANGE_1 : CONFIG.JOB_CHANGE_2);
}

function newPlayer(name, look) {
  const p = {
    name, look, cls: 'aprendiz', baseLv: 1, jobLv: 1, baseExp: 0, jobExp: 0,
    stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, statPoints: CONFIG.STAT_START_POINTS, skillPoints: 0, skills: {},
    zeny: 150, inventory: [], equip: { arma: null, cabeca: null, armadura: null, acessorio: null }, hotbar: Array(9).fill(null),
    hp: 1, sp: 1,
  };
  initRuntime(p);
  addItem(p, 'adaga_simples', 1); addItem(p, 'tunica_algodao', 1);
  addItem(p, 'maca', 10); addItem(p, 'pocao_vermelha', 3); addItem(p, 'pergaminho_retorno', 1);
  equipItem(p.inventory.find(e => e.id === 'adaga_simples'), p, true);
  equipItem(p.inventory.find(e => e.id === 'tunica_algodao'), p, true);
  p.hotbar[0] = { kind: 'item', id: 'maca' };
  p.hotbar[1] = { kind: 'item', id: 'pocao_vermelha' };
  recalc(p); p.hp = p.d.maxHp; p.sp = p.d.maxSp;
  return p;
}
function initRuntime(p) {
  Object.assign(p, {
    x: 0, y: 0, path: null, finalPt: null, action: null, casting: null, nextAttack: 0, dir: 1, walkT: 0, moving: false, sitting: false,
    dead: false, buffs: {}, cds: {}, atkT: -9, regenHp: 0, regenSp: 0, d: {}, repathT: 0, say: null,
  });
}
const SAVE_FIELDS = ['name', 'look', 'cls', 'baseLv', 'jobLv', 'baseExp', 'jobExp', 'stats', 'statPoints', 'skillPoints', 'skills', 'zeny', 'inventory', 'equip', 'hotbar', 'hp', 'sp'];
function saveGame() {
  if (!G.player || G.state === 'title') return;
  const s = {}; for (const k of SAVE_FIELDS) s[k] = G.player[k];
  s.mapId = G.mapId; s.x = G.player.x; s.y = G.player.y; s.uid = G.uid; s.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* armazenamento indisponível */ }
  syncSave(s);
  G.lastSave = G.time;
}
/* Saves também vão para a pasta saves/ do projeto (via server.py), para não
   dependerem da porta nem do navegador. O localStorage continua como reserva. */
const HAS_SERVER = location.protocol.startsWith('http');
function saveSlug(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'sem_nome'; }
function saveSummary(s, local) { return { slug: saveSlug(s.name), name: s.name, cls: s.cls, baseLv: s.baseLv, jobLv: s.jobLv, savedAt: s.savedAt || 0, local }; }
function syncSave(s) {
  if (!HAS_SERVER) return;
  try { fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s), keepalive: true }).catch(() => { }); } catch (e) { }
}
async function listCharacters() {
  const local = loadSave();
  let list = [];
  if (HAS_SERVER) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch('/api/saves', { signal: ctl.signal }); clearTimeout(tm);
      if (r.ok) list = await r.json();
    } catch (e) { /* servidor sem suporte a saves: usa só o navegador */ }
  }
  if (local) {
    const srv = list.find(x => x.slug === saveSlug(local.name));
    if (!srv || (srv.savedAt || 0) < (local.savedAt || 0)) {
      // personagem que só existia neste navegador/porta vai para o projeto
      let apagado = false;
      if (HAS_SERVER) {
        try {
          const r = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) });
          apagado = r.ok && (await r.json()).apagado === true;
        } catch (e) { }
      }
      if (apagado) localStorage.removeItem(SAVE_KEY); // foi apagado de propósito: esquece a cópia local
      else list = list.filter(x => x.slug !== saveSlug(local.name)).concat([saveSummary(local, true)]);
    }
  }
  return list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
async function loadCharacter(entry) {
  const local = loadSave();
  if (local && saveSlug(local.name) === entry.slug && (local.savedAt || 0) >= (entry.savedAt || 0)) return local;
  const r = await fetch('/api/save/' + entry.slug);
  if (!r.ok) throw new Error('personagem não encontrado');
  return r.json();
}
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.name && CLASSES[s.cls] ? s : null; } catch (e) { return null; } }

/* ================= Inventário ================= */
const isEquipType = id => EQUIP_TYPES.includes(ITEMS[id].type);
function addItem(p, id, qty = 1) {
  if (!ITEMS[id]) return false;
  if (isEquipType(id)) {
    for (let i = 0; i < qty; i++) p.inventory.push({ uid: G.uid++, id, qty: 1, cards: Array(ITEMS[id].slots || 0).fill(null) });
  } else {
    const e = p.inventory.find(x => x.id === id);
    if (e) e.qty += qty; else p.inventory.push({ uid: G.uid++, id, qty });
  }
  return true;
}
function removeItem(p, entry, qty = 1) {
  entry.qty -= qty;
  if (entry.qty <= 0) { const i = p.inventory.indexOf(entry); if (i >= 0) p.inventory.splice(i, 1); }
}
const countItem = (p, id) => p.inventory.filter(e => e.id === id).reduce((s, e) => s + e.qty, 0);
const invByUid = uid => uid == null ? null : G.player.inventory.find(e => e.uid === uid) || null;
const sellPrice = id => Math.max(1, Math.floor((ITEMS[id].price || 2) / 2));

function equipItem(entry, p = G.player, silent = false) {
  const it = ITEMS[entry.id];
  if (!EQUIP_TYPES.includes(it.type)) return;
  if (it.type === 'arma' && !CLASSES[p.cls].weapons.includes(it.wtype)) { if (!silent) { UI.log(`${CLASSES[p.cls].name} não pode usar ${WEAPON_TYPES[it.wtype].name}.`, 'warn'); Sound.play('error'); } return; }
  if (it.lv && p.baseLv < it.lv) { if (!silent) { UI.log(`Requer nível ${it.lv}.`, 'warn'); Sound.play('error'); } return; }
  const slot = it.type;
  const old = p.equip[slot];
  const i = p.inventory.indexOf(entry); if (i >= 0) p.inventory.splice(i, 1);
  if (old) p.inventory.push(old);
  p.equip[slot] = entry;
  if (!silent) { UI.log(`Equipou ${it.name}.`, 'item'); Sound.play('click'); recalc(p); UI.markDirty(); if (UI.invSel === entry.uid) UI.invSel = null; }
}
function unequip(slot) {
  const p = G.player, e = p.equip[slot]; if (!e) return;
  p.equip[slot] = null; p.inventory.push(e);
  recalc(p); UI.markDirty();
}
function insertCard(card, target) {
  const p = G.player;
  const i = target.cards.indexOf(null);
  if (i < 0 || ITEMS[card.id].equip !== ITEMS[target.id].type) return;
  target.cards[i] = card.id;
  removeItem(p, card, 1);
  recalc(p); Sound.play('card'); UI.log(`✨ ${ITEMS[card.id].name} inserida em ${ITEMS[target.id].name}!`, 'card');
  saveGame(); UI.markDirty();
}
function useItem(entry) {
  const p = G.player; if (p.dead) return;
  if (G.paused) { UI.log('O jogo está pausado (P para continuar).', 'warn'); return; }
  const it = ITEMS[entry.id]; if (it.type !== 'consumivel') return;
  const u = it.use;
  if (u.warp) { removeItem(p, entry); UI.markDirty(); Sound.play('portal'); const [sx, sy] = MAPS[u.warp].spawn; changeMap(u.warp, sx, sy); return; }
  if (u.hp) { const v = Math.min(u.hp, p.d.maxHp - p.hp); p.hp += v; floater(p, '+' + u.hp, '#5fe08a'); }
  if (u.sp) { p.sp = Math.min(p.d.maxSp, p.sp + u.sp); floater(p, '+' + u.sp + ' SP', '#7ab0ff', -10); }
  removeItem(p, entry); Sound.play('heal'); UI.markDirty();
}
function buyItem(id, qty) {
  const p = G.player, cost = ITEMS[id].price * qty;
  if (p.zeny < cost) { UI.log('Zeny insuficiente.', 'warn'); Sound.play('error'); return; }
  p.zeny -= cost; addItem(p, id, qty); Sound.play('coin');
  UI.log(`Comprou ${ITEMS[id].name}${qty > 1 ? ' x' + qty : ''} por ${cost} z.`, 'item'); UI.markDirty();
}
function sellItem(entry, qty) {
  const p = G.player; qty = Math.min(qty, entry.qty);
  const v = sellPrice(entry.id) * qty;
  p.zeny += v; removeItem(p, entry, qty); Sound.play('coin');
  UI.log(`Vendeu ${ITEMS[entry.id].name}${qty > 1 ? ' x' + qty : ''} por ${v} z.`, 'item');
  p.hotbar.forEach((h, i) => { if (h && h.kind === 'item' && !countItem(p, h.id) && h.id === entry.id) { /* mantém atalho esmaecido */ } });
  UI.markDirty();
}

/* ================= Atributos derivados ================= */
function addBonus(t, b) {
  if (!b) return;
  for (const k in b) {
    const v = b[k];
    if (v && typeof v === 'object') { t[k] = t[k] || {}; for (const e in v) t[k][e] = (t[k][e] || 0) + v[e]; }
    else t[k] = (t[k] || 0) + v;
  }
}
function recalc(p) {
  const b = {};
  for (const s of EQUIP_TYPES) {
    const e = p.equip[s]; if (!e) continue;
    const it = ITEMS[e.id];
    addBonus(b, { atk: it.atk || 0, matk: it.matk || 0, def: it.def || 0, mdef: it.mdef || 0 });
    addBonus(b, it.bonuses);
    for (const c of e.cards || []) if (c) addBonus(b, ITEMS[c].bonuses);
  }
  for (const id in p.skills) { const sk = SKILLS[id]; if (sk && sk.type === 'passive' && p.skills[id] > 0) addBonus(b, sk.bonuses(p.skills[id])); }
  for (const id in p.buffs) addBonus(b, p.buffs[id].bonuses);
  const d = {};
  for (const s of STAT_KEYS) d[s] = p.stats[s] + (b[s] || 0);
  const c = CLASSES[p.cls], lv = p.baseLv;
  d.maxHp = Math.floor(((40 + lv * 10 * c.hpMod + lv * lv * 0.22 * c.hpMod) * (1 + d.vit * 0.01) + (b.hp || 0)) * (1 + (b.hpPct || 0) / 100));
  d.maxSp = Math.floor(((12 + lv * 2.5 * c.spMod + lv * lv * 0.04 * c.spMod) * (1 + d.int * 0.01) + (b.sp || 0)) * (1 + (b.spPct || 0) / 100));
  const w = p.equip.arma ? ITEMS[p.equip.arma.id] : null;
  const wt = w ? w.wtype : 'mao';
  const ranged = wt === 'arco';
  const main = ranged ? d.dex : d.str, sec = ranged ? d.str : d.dex;
  d.atk = Math.floor((main + Math.pow(Math.floor(main / 10), 2) + Math.floor(sec / 5) + Math.floor(d.luk / 5) + (b.atk || 0)) * (1 + (b.atkPct || 0) / 100));
  d.matk = Math.floor((d.int * 1.5 + Math.pow(Math.floor(d.int / 7), 2) + (b.matk || 0)) * (1 + (b.matkPct || 0) / 100));
  d.def = (b.def || 0) + Math.floor(d.vit / 2);
  d.mdef = (b.mdef || 0) + Math.floor(d.int / 3);
  d.hit = lv + d.dex + (b.hit || 0);
  d.flee = lv + d.agi + (b.flee || 0);
  d.crit = Math.round((1 + d.luk * 0.3 + (b.crit || 0)) * 10) / 10;
  const wm = WEAPON_TYPES[wt];
  d.aspd = Math.max(260, (1500 - d.agi * 9 - d.dex * 2.5) * wm.delay * (1 - Math.min(60, b.aspdPct || 0) / 100));
  d.range = (wm.range + (ranged ? (b.range || 0) : 0)) * TILE;
  d.ranged = ranged; d.wtype = wt;
  d.speed = 125 * (1 + (b.moveSpeedPct || 0) / 100);
  d.castMult = Math.max(0.2, 1 - d.dex / 150);
  d.lifesteal = b.lifesteal || 0; d.doubleAttack = b.doubleAttack || 0; d.falcon = b.falcon || 0;
  d.dmgVs = b.dmgVs || {}; d.resist = b.resist || {};
  d.hpRegen = b.hpRegen || 0; d.spRegen = b.spRegen || 0; d.expPct = b.expPct || 0;
  p.d = d;
  p.hp = Math.min(p.hp, d.maxHp); p.sp = Math.min(p.sp, d.maxSp);
}

function addStat(s) {
  const p = G.player, cost = statCost(p.stats[s]);
  if (p.statPoints < cost || p.stats[s] >= 99) return;
  p.statPoints -= cost; p.stats[s]++; recalc(p); UI.markDirty();
}
function learnSkill(id) {
  const p = G.player, sk = SKILLS[id], lv = p.skills[id] || 0;
  if (p.skillPoints <= 0 || lv >= sk.maxLv) return;
  if (!lineage(p.cls).some(c => CLASSES[c].skills.includes(id))) return;
  p.skills[id] = lv + 1; p.skillPoints--;
  if (lv === 0 && sk.type === 'active') assignHotbar('skill', id, true);
  recalc(p); UI.markDirty();
}
function assignHotbar(kind, id, silent) {
  const p = G.player;
  if (p.hotbar.some(h => h && h.kind === kind && h.id === id)) { if (!silent) UI.log('Já está na barra de atalhos.', 'sys'); return; }
  const i = p.hotbar.findIndex(h => !h);
  if (i < 0) { if (!silent) UI.log('Barra de atalhos cheia — clique com o botão direito num atalho para limpar.', 'warn'); return; }
  p.hotbar[i] = { kind, id };
  if (!silent) UI.log(`Atalho ${i + 1}: ${(kind === 'skill' ? SKILLS : ITEMS)[id].name}`, 'sys');
  UI.markDirty();
}
function useHotbar(i) {
  const p = G.player, h = p.hotbar[i];
  if (!h || G.state !== 'play' || G.paused) return;
  if (h.kind === 'skill') trySkill(h.id);
  else { const e = p.inventory.find(x => x.id === h.id); if (e) useItem(e); else UI.log(`Sem ${ITEMS[h.id].name}.`, 'warn'); }
}

function gainExp(base, job) {
  const p = G.player;
  const mult = CONFIG.EXP_RATE * (1 + p.d.expPct / 100);
  base = Math.floor(base * mult); job = Math.floor(job * mult);
  let leveled = false, jleveled = false;
  if (p.baseLv < CONFIG.MAX_BASE_LV) {
    p.baseExp += base;
    while (p.baseLv < CONFIG.MAX_BASE_LV && p.baseExp >= baseExpNext(p.baseLv)) {
      p.baseExp -= baseExpNext(p.baseLv); p.baseLv++; p.statPoints += Math.floor(p.baseLv / 5) + 3; leveled = true;
    }
  }
  const mj = maxJobLv(p), tier = CLASSES[p.cls].tier;
  if (p.jobLv < mj) {
    p.jobExp += job;
    while (p.jobLv < mj && p.jobExp >= jobExpNext(p.jobLv, tier)) { p.jobExp -= jobExpNext(p.jobLv, tier); p.jobLv++; p.skillPoints++; jleveled = true; }
    if (p.jobLv >= mj) p.jobExp = 0;
  }
  recalc(p);
  if (leveled) {
    p.hp = p.d.maxHp; p.sp = p.d.maxSp;
    fx('levelup', p.x, p.y, 1.6, { text: 'Nível ' + p.baseLv + '!' });
    Sound.play('levelup'); UI.log(`⭐ Nível de Base ${p.baseLv}! Você ganhou pontos de atributo (C).`, 'lvl');
  }
  if (jleveled) {
    if (!leveled) { fx('levelup', p.x, p.y, 1.6, { text: 'Classe Nv. ' + p.jobLv }); Sound.play('levelup'); }
    UI.log(`✦ Nível de Classe ${p.jobLv}! +1 ponto de habilidade (K).`, 'lvl');
    if (canChangeClass(p)) UI.log(`🌟 Você já pode evoluir de classe! Volte à vila e fale com a Mestra Ivra.`, 'card');
  }
  if (leveled || jleveled) saveGame();
  UI.markDirty();
}

function changeClass(cls) {
  const p = G.player;
  p.cls = cls; p.jobLv = 1; p.jobExp = 0;
  for (const [id, q] of CLASSES[cls].gift || []) addItem(p, id, q);
  recalc(p); p.hp = p.d.maxHp; p.sp = p.d.maxSp;
  fx('levelup', p.x, p.y, 2.2, { text: CLASSES[cls].name + '!' });
  Sound.play('levelup');
  UI.banner(`${CLASSES[cls].icon} ${CLASSES[cls].name}`, 'NOVA CLASSE');
  UI.log(`🌟 Você agora é ${CLASSES[cls].name}! Presente da Mestra Ivra adicionado ao inventário.`, 'card');
  saveGame(); UI.markDirty();
}

/* ================= Mapas ================= */
function getMap(id) { return G.maps[id] || (G.maps[id] = new GameMap(id)); }
function changeMap(id, tx, ty) {
  const p = G.player;
  G.mapToken++;
  G.mapId = id; G.map = getMap(id);
  G.monsters = []; G.drops = []; G.projectiles = []; G.effects = []; G.floaters = [];
  G.timers = G.timers.filter(t => t.token === undefined || t.token === G.mapToken);
  G.targeting = null;
  p.x = tx * TILE + TILE / 2; p.y = ty * TILE + TILE / 2;
  p.path = null; p.action = null; p.casting = null; p.sitting = false;
  G.cam.x = p.x; G.cam.y = p.y;
  G.npcs = (G.map.def.npcs || []).map(n => Object.assign({}, n, { x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2 }));
  for (const s of G.map.def.spawns || []) for (let i = 0; i < s.count; i++) spawnMonster(s.type);
  document.getElementById('mapname').innerHTML = `${G.map.def.name} <small>${G.map.def.lvl}</small>`;
  UI.banner(G.map.def.name, G.map.def.lvl);
  Sound.playSong(G.map.def.music);
  if (G.monsters.some(m => m.def.boss)) UI.log('Uma presença ancestral faz o chão tremer...', 'warn');
  saveGame();
}
function checkPortals() {
  const p = G.player;
  for (const pt of G.map.def.portals) {
    const px = pt.x * TILE + TILE / 2, py = pt.y * TILE + TILE / 2;
    if (Math.hypot(p.x - px, p.y - py) < TILE * 0.8) { Sound.play('portal'); changeMap(pt.to, pt.tx, pt.ty); return; }
  }
}

/* ================= Monstros ================= */
function spawnMonster(type) {
  const def = MONSTERS[type], m = G.map, p = G.player;
  let tile = null;
  for (let k = 0; k < 40; k++) {
    const t = m.randomReachable();
    const wx = t[0] * TILE + TILE / 2, wy = t[1] * TILE + TILE / 2;
    const nearPortal = m.def.portals.some(pt => Math.abs(pt.x - t[0]) + Math.abs(pt.y - t[1]) < 7);
    if (nearPortal) continue;
    if (p && Math.hypot(wx - p.x, wy - p.y) < 8 * TILE) continue;
    tile = t; break;
  }
  if (!tile) tile = m.randomReachable();
  const mon = {
    uid: G.uid++, type, def, x: tile[0] * TILE + TILE / 2, y: tile[1] * TILE + TILE / 2, hp: def.hp, maxHp: def.hp,
    dir: Math.random() < 0.5 ? 1 : -1, path: null, finalPt: null, target: null, nextThink: G.time + rand(0, 3), nextAttack: 0, nextSpecial: G.time + 6,
    status: {}, walkT: Math.random() * 10, hitT: -9, dead: false, moving: false, repathT: 0, atkAnim: 0, stolen: false,
  };
  G.monsters.push(mon);
  return mon;
}
function monsterAlive(m) { return m && !m.dead && G.monsters.includes(m); }

function updateMonster(m, dt) {
  if (m.dead) return;
  const p = G.player;
  m.atkAnim = Math.max(0, m.atkAnim - dt * 4);
  const st = m.status;
  if (st.poison && st.poison.until > G.time && G.time >= st.poison.next) {
    st.poison.next = G.time + 1;
    const dmg = Math.max(1, Math.floor(st.poison.dmg));
    m.hp -= dmg; floater(m, dmg, '#9be36a');
    if (m.hp <= 0) { killMonster(m); return; }
  }
  if (st.freeze > G.time || st.stun > G.time) { m.moving = false; return; }
  const d = m.def;
  const dp = Math.hypot(p.x - m.x, p.y - m.y);
  if (m.target && (p.dead || dp > 16 * TILE)) { m.target = null; m.path = null; }
  if (!m.target && d.aggressive && !p.dead && dp < d.aggroRange * TILE) m.target = p;
  if (m.target) {
    const range = d.range * TILE + 4 * d.size;
    if (dp <= range) {
      m.path = null; m.moving = false;
      if (Math.abs(p.x - m.x) > 2) m.dir = p.x > m.x ? 1 : -1;
      if (G.time >= m.nextAttack) { m.nextAttack = G.time + d.aspd / 1000; monsterAttack(m); }
    } else {
      if (!m.path || G.time >= m.repathT) {
        m.repathT = G.time + 0.5;
        m.path = findPath(G.map, Math.floor(m.x / TILE), Math.floor(m.y / TILE), Math.floor(p.x / TILE), Math.floor(p.y / TILE), 1500);
        if (m.path && m.path.length) m.path.pop(); // não entra no tile do jogador
      }
      moveEntity(m, d.speed * 1.15, dt);
      if (!m.path || !m.path.length) { m.path = null; if (dp > range) { const a = Math.atan2(p.y - m.y, p.x - m.x); const nx = m.x + Math.cos(a) * d.speed * dt, ny = m.y + Math.sin(a) * d.speed * dt; if (!G.map.isSolid(Math.floor(nx / TILE), Math.floor(ny / TILE))) { m.x = nx; m.y = ny; m.moving = true; m.walkT += dt; } } }
    }
    if (d.special === 'slam' && G.time >= m.nextSpecial && dp < 6 * TILE) {
      m.nextSpecial = G.time + 9;
      const r = 3.2 * TILE, cx = m.x, cy = m.y;
      fx('telegraph', cx, cy, 1.1, { r });
      UI.log(`${d.name} prepara um golpe devastador!`, 'warn');
      later(1.1, () => {
        if (!monsterAlive(m)) return;
        fx('quake', cx, cy, 0.7, { r }); Sound.play('slam');
        if (!p.dead && Math.hypot(p.x - cx, p.y - cy) < r) damagePlayer(m, Math.round(rand(d.atk[0], d.atk[1]) * 1.6), true);
      });
    }
  } else {
    if (G.time >= m.nextThink) {
      m.nextThink = G.time + rand(2, 6);
      if (Math.random() < 0.6) {
        const tx = Math.floor(m.x / TILE) + randInt(-4, 4), ty = Math.floor(m.y / TILE) + randInt(-4, 4);
        if (!G.map.isSolid(tx, ty)) m.path = findPath(G.map, Math.floor(m.x / TILE), Math.floor(m.y / TILE), tx, ty, 400);
      }
    }
    moveEntity(m, d.speed * 0.5, dt);
  }
}

function monsterAttack(m) {
  const p = G.player, d = m.def;
  m.atkAnim = 1;
  if (d.range > 2) {
    G.projectiles.push({ x: m.x, y: m.y, tx: p.x, ty: p.y, target: p, speed: 300, kind: 'bolt', color: ELEMENTS[d.element].color, onHit: () => monsterHit(m) });
  } else monsterHit(m);
}
function monsterHit(m) {
  const p = G.player, d = m.def;
  if (p.dead) return;
  const chance = clamp(80 + d.hit - p.d.flee, 5, 95);
  if (Math.random() * 100 >= chance) { floater(p, 'Esquivou', '#cfe8ff'); Sound.play('miss'); return; }
  damagePlayer(m, randInt(d.atk[0], d.atk[1]));
}
function damagePlayer(m, raw, ignoreDef) {
  const p = G.player;
  if (G.god) { floater(p, 'Imune', '#ffd76a'); return; }
  let dmg = ignoreDef ? raw : raw * 100 / (100 + p.d.def);
  dmg *= 1 - Math.min(80, p.d.resist[m.def.element] || 0) / 100;
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg; p.sitting = false;
  floater(p, dmg, '#ff5a5a');
  fx('hitspark', p.x, p.y, 0.25, { color: '#ff8080' });
  Sound.play('hurt');
  if (p.hp <= 0) { p.hp = 0; playerDie(); }
}

function killMonster(m) {
  const p = G.player, d = m.def;
  m.dead = true; m.deathT = G.time; m.hp = 0;
  Sound.play('mdie');
  gainExp(d.exp, d.jexp);
  for (const [id, rate] of d.drops) if (Math.random() < rate * CONFIG.DROP_RATE) dropItem(id, m.x, m.y);
  const cr = d.cardRate ?? CONFIG.CARD_DROP_RATE;
  if (Math.random() < cr) {
    dropItem('carta_' + m.type, m.x, m.y, true);
    Sound.play('card');
    UI.banner('✨ Uma carta caiu! ✨', ITEMS['carta_' + m.type].name.toUpperCase(), 3000);
    UI.log(`✨ ${ITEMS['carta_' + m.type].name} caiu no chão! Pegue-a!`, 'card');
  }
  if (d.boss) { UI.banner(`${d.name} foi derrotado!`, `${p.name} triunfou`, 3500); UI.log(`🏆 ${p.name} derrotou ${d.name}!`, 'card'); }
  if (p.action && p.action.m === m) p.action = null;
  later(0.6, () => { const i = G.monsters.indexOf(m); if (i >= 0) G.monsters.splice(i, 1); });
  const respawn = d.respawn ? d.respawn / 1000 : rand(CONFIG.RESPAWN_MIN, CONFIG.RESPAWN_MAX);
  later(respawn, () => spawnMonster(m.type));
}
function dropItem(id, x, y, isCard = false) {
  G.drops.push({ uid: G.uid++, id, qty: 1, x: x + rand(-16, 16), y: y + rand(-10, 10), t: G.time, isCard });
}
function pickup(d) {
  const p = G.player;
  const i = G.drops.indexOf(d); if (i < 0) return;
  G.drops.splice(i, 1);
  addItem(p, d.id, d.qty);
  Sound.play(d.isCard ? 'card' : 'pickup');
  UI.log(`Você obteve ${ITEMS[d.id].icon} ${ITEMS[d.id].name}${d.qty > 1 ? ' x' + d.qty : ''}.`, d.isCard ? 'card' : 'item');
  if (d.isCard) saveGame();
  UI.markDirty();
}

/* ================= Combate do jogador ================= */
function rollPhys(p, m, mult, element, o = {}) {
  const crit = o.autoCrit || Math.random() * 100 < p.d.crit;
  if (!crit) {
    const hc = clamp(80 + p.d.hit + (o.hitBonus || 0) - m.def.flee, 5, 100);
    if (Math.random() * 100 >= hc) return { miss: true };
  }
  let dmg = (crit ? p.d.atk * 1.1 : p.d.atk * rand(0.85, 1.15)) * mult + (o.flat || 0);
  dmg *= elementMult(element || 'neutro', m.def.element) * (1 + (p.d.dmgVs[m.def.element] || 0) / 100);
  if (crit) dmg *= 1.4; else dmg *= 100 / (100 + m.def.def * (1 - (o.ignoreDef || 0)));
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}
function rollMagic(p, m, mult, element) {
  let dmg = p.d.matk * rand(0.9, 1.1) * mult * elementMult(element || 'neutro', m.def.element) * (1 + (p.d.dmgVs[m.def.element] || 0) / 100);
  dmg *= 100 / (100 + m.def.mdef);
  return { dmg: Math.max(1, Math.round(dmg)) };
}
function damageMonster(m, res, elem) {
  if (!monsterAlive(m)) return;
  const p = G.player;
  if (res.miss) { floater(m, 'Errou', '#cfd6e0'); Sound.play('miss'); m.target = p; return; }
  m.hp -= res.dmg; m.hitT = G.time; m.target = p;
  const em = elem ? elementMult(elem, m.def.element) : 1;
  floater(m, res.dmg, res.crit ? '#ffe36a' : em > 1 ? '#ffb070' : '#ffffff', 0, res.crit);
  fx('hitspark', m.x, m.y - monsterHeight(m) * 0.2, 0.25, { color: elem && elem !== 'neutro' ? ELEMENTS[elem].color : '#fff' });
  Sound.play(res.crit ? 'crit' : 'hit');
  if (p.d.lifesteal) { const h = Math.floor(res.dmg * p.d.lifesteal / 100); if (h > 0) { p.hp = Math.min(p.d.maxHp, p.hp + h); } }
  if (m.hp <= 0) killMonster(m);
}
function playerAttack(p, m) {
  p.atkT = G.time;
  const hit = () => {
    if (!monsterAlive(m)) return;
    damageMonster(m, rollPhys(p, m, 1, 'neutro'));
    if (p.d.doubleAttack && Math.random() * 100 < p.d.doubleAttack && !p.d.ranged) later(0.12, () => { if (monsterAlive(m)) damageMonster(m, rollPhys(p, m, 1, 'neutro')); });
    if (p.d.falcon && Math.random() * 100 < p.d.falcon * 4 + p.d.luk / 3) {
      fx('falcon', m.x, m.y, 0.45);
      later(0.4, () => { if (monsterAlive(m)) damageMonster(m, { dmg: Math.round((p.d.dex * 2 + p.d.falcon * 25) * rand(0.9, 1.1)) }); });
    }
  };
  if (p.d.ranged) { Sound.play('bow'); G.projectiles.push({ x: p.x, y: p.y, tx: m.x, ty: m.y, target: m, speed: 620, kind: 'arrow', onHit: hit }); }
  else { Sound.play('swing'); later(0.08, hit); }
}

/* ================= Habilidades ================= */
function skillRange(sk) { return sk.range === 'weapon' ? G.player.d.range : (sk.range || 0) * TILE; }
function trySkill(id) {
  const p = G.player; if (p.dead) return;
  const sk = SKILLS[id], lv = p.skills[id] || 0;
  if (!lv) { UI.log('Você ainda não aprendeu essa habilidade.', 'warn'); return; }
  if (sk.type === 'passive') { UI.log(`${sk.name} é passiva — já está ativa.`, 'sys'); return; }
  if (p.casting) return;
  if (p.cds[id] > G.time && !G.god) { UI.log('Habilidade em recarga.', 'warn'); return; }
  if (p.sp < sk.sp(lv) && !G.god) { UI.log('SP insuficiente.', 'warn'); Sound.play('error'); return; }
  p.sitting = false;
  if (sk.target === 'enemy') {
    const hm = G.hover && G.hover.kind === 'monster' ? G.hover.ref : null;
    const tm = p.action && p.action.m && monsterAlive(p.action.m) ? p.action.m : null;
    const m = hm || tm;
    if (m) queueSkill(id, lv, { m });
    else { G.targeting = { id, lv }; UI.log(`${sk.name}: clique em um monstro (botão direito cancela).`, 'sys'); }
  } else if (sk.target === 'ground') {
    G.targeting = { id, lv, ground: true }; UI.log(`${sk.name}: clique no chão (botão direito cancela).`, 'sys');
  } else queueSkill(id, lv, {});
}
function queueSkill(id, lv, t) {
  const p = G.player;
  const wasAttacking = p.action && p.action.type === 'attack' && p.action.m === t.m;
  p.action = { type: 'skill', id, lv, m: t.m, pt: t.pt, resume: wasAttacking };
  G.targeting = null;
}
function startCast(a) {
  const p = G.player, sk = SKILLS[a.id];
  if (p.sp < sk.sp(a.lv) && !G.god) { UI.log('SP insuficiente.', 'warn'); p.action = null; return; }
  const ct = G.god ? 0 : (sk.cast ? sk.cast(a.lv) : 0) * p.d.castMult / 1000;
  p.action = a.resume && a.m ? { type: 'attack', m: a.m } : null;
  if (ct > 0.05) { p.casting = { ...a, start: G.time, end: G.time + ct }; p.path = null; if (sk.effect.dmg === 'magic') Sound.play('magic'); }
  else executeSkill(a);
}
function executeSkill(a) {
  const p = G.player, sk = SKILLS[a.id], lv = a.lv, eff = sk.effect;
  if (sk.target === 'enemy' && !monsterAlive(a.m)) return;
  if (!G.god) { p.sp -= sk.sp(lv); p.cds[a.id] = G.time + (sk.cd || 0) / 1000; }
  p.atkT = G.time;
  if (a.m && Math.abs(a.m.x - p.x) > 2) p.dir = a.m.x > p.x ? 1 : -1;
  if (a.pt && Math.abs(a.pt.x - p.x) > 2) p.dir = a.pt.x > p.x ? 1 : -1;
  if (eff.kind === 'heal') {
    const v = eff.amount(lv, p);
    p.hp = Math.min(p.d.maxHp, p.hp + v);
    floater(p, '+' + v, '#5fe08a'); fx('heal', p.x, p.y, 1, { color: '#7dff9a' }); Sound.play('heal');
  } else if (eff.kind === 'buff') {
    p.buffs[a.id] = { until: G.time + eff.dur / 1000, bonuses: eff.bonuses(lv) };
    recalc(p); fx('aura', p.x, p.y, 1.2, { color: sk.fxColor }); Sound.play('buff');
    UI.log(`${sk.name} ativada!`, 'sys');
  } else if (eff.kind === 'steal') {
    const m = a.m;
    fx('slash', m.x, m.y, 0.3, { color: '#ffd84a' });
    if (m.stolen) { floater(m, 'Nada', '#cfd6e0'); }
    else if (Math.random() < eff.chance(lv) + (p.d.dex - m.def.lv) / 300) {
      const pool = m.def.drops; const [id] = pool[Math.floor(Math.random() * pool.length)];
      m.stolen = true; addItem(p, id, 1); Sound.play('coin');
      floater(m, 'Roubou!', '#ffd84a'); UI.log(`Você roubou ${ITEMS[id].icon} ${ITEMS[id].name}!`, 'item'); UI.markDirty();
    } else { floater(m, 'Falhou', '#cfd6e0'); Sound.play('miss'); }
    m.target = p;
  } else if (eff.kind === 'damage') {
    doDamageSkill(a, sk, lv, eff);
  }
  UI.markDirty();
}
function doDamageSkill(a, sk, lv, eff) {
  const p = G.player;
  const hits = eff.hits ? eff.hits(lv) : 1;
  const mult = eff.mult(lv);
  const el = eff.element || 'neutro';
  const center = sk.target === 'selfAoe' ? { x: p.x, y: p.y } : sk.target === 'ground' ? a.pt : a.m;
  const col = ELEMENTS[el].color;
  const targetsAt = (cx, cy, r) => G.monsters.filter(m => !m.dead && Math.hypot(m.x - cx, m.y - cy) <= r);
  const hitOne = m => {
    if (!monsterAlive(m)) return;
    const res = eff.dmg === 'magic' ? rollMagic(p, m, mult, el) : rollPhys(p, m, mult, el, { hitBonus: eff.hitBonus ? eff.hitBonus(lv) : 0, ignoreDef: eff.ignoreDef, autoCrit: eff.autoCrit, flat: eff.flat ? eff.flat(lv, p) : 0 });
    damageMonster(m, res, el);
    if (eff.status && monsterAlive(m) && !res.miss && Math.random() < eff.status.chance(lv)) {
      const s = eff.status;
      if (s.type === 'poison') m.status.poison = { until: G.time + s.dur / 1000, dmg: Math.max(2, p.d.atk * 0.15), next: G.time + 1 };
      else m.status[s.type] = G.time + (m.def.boss ? s.dur / 3000 : s.dur / 1000);
      floater(m, { freeze: 'Congelado!', stun: 'Atordoado!', poison: 'Envenenado!' }[s.type], '#9fe3ff', -14);
    }
  };
  const wave = (delay, targets) => later(delay, () => targets().forEach(hitOne));
  const R = (eff.radius || 0) * TILE;
  switch (sk.fx) {
    case 'bolt': case 'arrow': case 'firearrow': {
      const kind = sk.fx === 'bolt' ? 'bolt' : sk.fx;
      Sound.play(sk.fx === 'bolt' ? (el === 'fogo' ? 'fire' : el === 'agua' ? 'ice' : 'magic') : 'bow');
      for (let i = 0; i < hits; i++) later(i * 0.13, () => {
        if (!monsterAlive(a.m)) return;
        G.projectiles.push({ x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), tx: a.m.x, ty: a.m.y, target: a.m, speed: 560, kind, color: col, onHit: () => {
          if (eff.splash) { fx('ring', a.m.x, a.m.y, 0.4, { r: eff.splash * TILE, color: col }); Sound.play('fire'); targetsAt(a.m.x, a.m.y, eff.splash * TILE).forEach(hitOne); }
          else hitOne(a.m);
        } });
      });
      break;
    }
    case 'lightning': Sound.play('zap'); for (let i = 0; i < hits; i++) later(i * 0.16, () => { if (monsterAlive(a.m)) { fx('lightning', a.m.x, a.m.y, 0.25, { color: col, seed: Math.random() }); hitOne(a.m); } }); break;
    case 'pillar': Sound.play('quake'); fx('pillar', a.m.x, a.m.y, 0.8); later(0.15, () => hitOne(a.m)); break;
    case 'meteor':
      for (let i = 0; i < hits; i++) {
        const ox = center.x + rand(-R * 0.4, R * 0.4), oy = center.y + rand(-R * 0.3, R * 0.3);
        later(i * 0.35, () => fx('meteor', ox, oy, 0.8, { r: R }));
        later(i * 0.35 + 0.5, () => { Sound.play('fire'); targetsAt(ox, oy, R).forEach(hitOne); });
      }
      break;
    case 'storm':
      for (let i = 0; i < hits; i++) later(i * 0.2, () => { const ox = center.x + rand(-R * 0.6, R * 0.6), oy = center.y + rand(-R * 0.4, R * 0.4); fx('lightning', ox, oy, 0.25, { color: col, seed: Math.random() }); Sound.play('zap'); targetsAt(center.x, center.y, R).forEach(hitOne); });
      fx('ring', center.x, center.y, 1.1, { r: R, color: col });
      break;
    case 'arrowrain':
      fx('arrowrain', center.x, center.y, 1.1, { r: R, seed: Math.random() }); Sound.play('bow');
      for (let i = 0; i < hits; i++) wave(0.25 + i * 0.3, () => targetsAt(center.x, center.y, R));
      break;
    case 'quake': Sound.play('quake'); fx('quake', p.x, p.y, 0.6, { r: R }); wave(0.1, () => targetsAt(p.x, p.y, R)); break;
    case 'holy': Sound.play('holy'); fx('holy', p.x, p.y, 0.8, { r: R }); wave(0.15, () => targetsAt(p.x, p.y, R)); break;
    case 'sound': Sound.play('zap'); fx('sound', p.x, p.y, 0.8, { r: R, color: '#ffb3d9' }); wave(0.15, () => targetsAt(p.x, p.y, R)); break;
    case 'blades': Sound.play('swing'); fx('blades', p.x, p.y, 0.6, { r: R }); for (let i = 0; i < hits; i++) wave(0.1 + i * 0.15, () => targetsAt(p.x, p.y, R)); break;
    default: { // slash / runic / shadow / poison
      const color = { runic: '#ffcf5a', shadow: '#a77bff', poison: '#9be36a' }[sk.fx] || '#ffffff';
      Sound.play('swing');
      fx('slash', a.m.x, a.m.y, 0.3, { color });
      for (let i = 0; i < hits; i++) later(0.06 + i * 0.12, () => hitOne(a.m));
    }
  }
}

/* ================= Jogador: atualização ================= */
function moveEntity(e, speed, dt) {
  if (!e.path || !e.path.length) { e.path = null; e.moving = false; return; }
  const [tx, ty] = e.path[0];
  let gx = tx * TILE + TILE / 2, gy = ty * TILE + TILE / 2;
  if (e.path.length === 1 && e.finalPt) { gx = e.finalPt.x; gy = e.finalPt.y; }
  const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy), step = speed * dt;
  const ox = e.x, oy = e.y;
  if (d <= step) { e.x = gx; e.y = gy; e.path.shift(); if (!e.path.length) { e.path = null; e.finalPt = null; } }
  else { e.x += dx / d * step; e.y += dy / d * step; }
  // nunca entrar num tile sólido cortando um canto: volta ao centro do tile atual e segue de lá
  if (G.map.isSolid(Math.floor(e.x / TILE), Math.floor(e.y / TILE))) {
    e.x = Math.floor(ox / TILE) * TILE + TILE / 2; e.y = Math.floor(oy / TILE) * TILE + TILE / 2;
    if (G.map.isSolid(Math.floor(e.x / TILE), Math.floor(e.y / TILE))) unstick(e);
  }
  if (Math.abs(dx) > 0.5) e.dir = dx > 0 ? 1 : -1;
  e.moving = true; e.walkT += dt;
}
// movimento livre (teclado) com colisão por eixo: desliza encostado nas paredes
function stepFree(e, dx, dy) {
  const solidAt = (x, y) => G.map.isSolid(Math.floor(x / TILE), Math.floor(y / TILE));
  const box = r => (x, y) => solidAt(x - r, y - r / 2) || solidAt(x + r, y - r / 2) || solidAt(x - r, y + r / 2) || solidAt(x + r, y + r / 2);
  // se já está encostado demais numa parede (ex.: clicou na beirada), usa só o ponto central
  const blocked = box(box(7)(e.x, e.y) ? 0 : 7);
  if (dx && !blocked(e.x + dx, e.y)) e.x += dx;
  if (dy && !blocked(e.x, e.y + dy)) e.y += dy;
}

// coloca a entidade no tile alcançável mais próximo (salva-vidas contra ficar preso)
function unstick(e) {
  const m = G.map, cx = Math.floor(e.x / TILE), cy = Math.floor(e.y / TILE);
  if (m.inb(cx, cy) && !m.isSolid(cx, cy) && m.reach[m.i(cx, cy)]) return false;
  for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (m.inb(nx, ny) && !m.isSolid(nx, ny) && m.reach[m.i(nx, ny)]) { e.x = nx * TILE + TILE / 2; e.y = ny * TILE + TILE / 2; e.path = null; return true; }
  }
  const [sx, sy] = m.def.spawn; e.x = sx * TILE + TILE / 2; e.y = sy * TILE + TILE / 2; e.path = null;
  return true;
}
function setPathTo(e, x, y, fine) {
  const sx = Math.floor(e.x / TILE), sy = Math.floor(e.y / TILE), tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const path = findPath(G.map, sx, sy, tx, ty);
  if (!path) return false;
  e.path = path.length ? path : (fine ? [[tx, ty]] : null);
  e.finalPt = fine && !G.map.isSolid(tx, ty) ? { x, y } : null;
  return true;
}
function moveTo(x, y) {
  const p = G.player;
  if (p.dead) return;
  p.action = null; p.sitting = false;
  if (p.casting) { p.casting = null; UI.log('Conjuração cancelada.', 'warn'); }
  setPathTo(p, x, y, true);
}

function updatePlayer(dt) {
  const p = G.player; if (p.dead) return;
  // buffs
  let ch = false;
  for (const id in p.buffs) if (p.buffs[id].until <= G.time) { delete p.buffs[id]; ch = true; UI.log(`${SKILLS[id].name} terminou.`, 'sys'); }
  if (ch) { recalc(p); UI.markDirty(); }
  // regeneração
  p.regenHp += dt; p.regenSp += dt;
  const hpI = p.sitting ? 3 : 6, spI = p.sitting ? 4 : 8;
  if (p.regenHp >= hpI) { p.regenHp = 0; if (p.hp < p.d.maxHp) p.hp = Math.min(p.d.maxHp, p.hp + Math.max(1, Math.floor(p.d.maxHp / 60 + p.d.vit / 4)) + p.d.hpRegen); }
  if (p.regenSp >= spI) { p.regenSp = 0; if (p.sp < p.d.maxSp) p.sp = Math.min(p.d.maxSp, p.sp + Math.max(1, Math.floor(p.d.maxSp / 50 + p.d.int / 5)) + p.d.spRegen); }
  if (G.god) { p.hp = p.d.maxHp; p.sp = p.d.maxSp; }
  // movimento pelo teclado (WASD / setas)
  const kd = keyDir();
  if (kd) {
    if (p.casting) { p.casting = null; UI.log('Conjuração cancelada.', 'warn'); }
    p.action = null; p.path = null; p.finalPt = null; p.sitting = false;
    const step = p.d.speed * (G.god ? 1.8 : 1) * dt;
    stepFree(p, kd.x * step, kd.y * step);
    p.moving = true; p.walkT += dt;
    if (kd.x) p.dir = kd.x > 0 ? 1 : -1;
    checkPortals();
    return;
  }
  // conjuração
  if (p.casting) {
    p.moving = false;
    if (G.time >= p.casting.end) { const c = p.casting; p.casting = null; executeSkill(c); }
    return;
  }
  // segurar mouse para andar
  if (G.mouse.down && G.mouse.holdMove && G.time >= G.nextHoldPath && !G.targeting) { G.nextHoldPath = G.time + 0.2; setPathTo(p, G.mouse.wx, G.mouse.wy, true); }
  // ações
  const a = p.action;
  if (a) {
    let tx, ty, range, valid = true;
    if (a.type === 'attack') { if (!monsterAlive(a.m)) valid = false; else { tx = a.m.x; ty = a.m.y; range = p.d.range; } }
    else if (a.type === 'skill') {
      const sk = SKILLS[a.id];
      if (sk.target === 'enemy') { if (!monsterAlive(a.m)) valid = false; else { tx = a.m.x; ty = a.m.y; range = skillRange(sk); } }
      else if (sk.target === 'ground') { tx = a.pt.x; ty = a.pt.y; range = skillRange(sk); }
      else { tx = p.x; ty = p.y; range = 1; }
    } else if (a.type === 'talk') { tx = a.npc.x; ty = a.npc.y; range = TILE * 1.8; }
    else if (a.type === 'pick') { if (!G.drops.includes(a.drop)) valid = false; else { tx = a.drop.x; ty = a.drop.y; range = TILE * 0.9; } }
    if (!valid) p.action = null;
    else {
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d > range) {
        if (!p.path || G.time >= p.repathT) { p.repathT = G.time + 0.3; setPathTo(p, tx, ty, a.type === 'pick'); }
      } else {
        p.path = null; p.moving = false;
        if (Math.abs(tx - p.x) > 2) p.dir = tx > p.x ? 1 : -1;
        if (a.type === 'attack') { if (G.time >= p.nextAttack) { p.nextAttack = G.time + p.d.aspd / 1000; playerAttack(p, a.m); } }
        else if (a.type === 'skill') startCast(a);
        else if (a.type === 'talk') { p.action = null; talkTo(a.npc); }
        else if (a.type === 'pick') { p.action = null; pickup(a.drop); }
      }
    }
  }
  moveEntity(p, p.d.speed * (G.god ? 1.8 : 1), dt);
  if (p.moving) p.sitting = false;
  checkPortals();
}

function playerDie() {
  const p = G.player;
  p.dead = true; p.action = null; p.path = null; p.casting = null; p.sitting = false;
  G.state = 'dead';
  for (const m of G.monsters) m.target = null;
  const loss = Math.floor(baseExpNext(p.baseLv) * 0.01);
  p.baseExp = Math.max(0, p.baseExp - loss);
  Sound.play('death');
  UI.log('Você foi derrotado...', 'warn');
  setTimeout(() => UI.showDeath(loss), 900);
}
function respawn() {
  const p = G.player;
  p.dead = false; p.hp = Math.max(1, Math.floor(p.d.maxHp * 0.5)); p.sp = Math.floor(p.d.maxSp * 0.5);
  G.state = 'play'; UI.hideOverlay();
  const [sx, sy] = MAPS.vila.spawn;
  changeMap('vila', sx, sy);
}

/* ================= NPCs ================= */
function talkTo(npc) {
  const p = G.player;
  const bye = { label: 'Até logo.', fn: () => UI.close('dialog') };
  if (npc.role === 'loja') {
    UI.dialog(npc, 'Bem-vindo, bem-vindo! Poções fresquinhas, armas para toda classe... e compro qualquer tralha que você trouxer dos campos!', [
      { label: '🛒 Ver mercadorias', gold: true, fn: () => { UI.close('dialog'); UI.open('shop'); } }, bye]);
  } else if (npc.role === 'cura') {
    p.hp = p.d.maxHp; p.sp = p.d.maxSp; Sound.play('heal'); fx('heal', p.x, p.y, 1.2, { color: '#7dff9a' });
    UI.dialog(npc, 'Que a luz te guarde, viajante. Suas feridas estão curadas.\nVolte sempre que precisar — aqui a cura é por conta da casa.', [bye]);
  } else if (npc.role === 'guia') {
    const tips = [
      'Os Campos de Verdelume ficam a leste. Gotinhas e Fungolinos são inofensivos... mas cuidado com as Abelhas Rubras!',
      'Cada monstro guarda uma <b>carta</b> rara. Equipamentos com espaços [ ] podem recebê-las. Carta inserida não sai mais — escolha bem!',
      'Elementos importam: Água vence Fogo, Fogo vence Terra, Terra vence Vento, Vento vence Água. Sagrado e Sombra se anulam.',
      'Dizem que um Gosmão gigante vaga pelos campos, e que um Lobo Alfa lidera as matilhas do Bosque Sussurrante.',
      'Ao norte do Bosque ficam as Ruínas de Kael. Lá dorme o Guardião Ancestral. Só vá com nível 35+... ou com muita coragem.',
      'Aperte X para sentar e recuperar HP e SP mais rápido. Um aventureiro esperto descansa entre as lutas.',
    ];
    npc.tip = ((npc.tip ?? -1) + 1) % tips.length;
    UI.dialog(npc, tips[npc.tip], [{ label: 'Mais alguma dica?', fn: () => talkTo(npc) }, bye]);
  } else if (npc.role === 'classe') {
    classDialog(npc);
  }
}
function classDialog(npc) {
  const p = G.player, c = CLASSES[p.cls];
  const bye = { label: 'Até logo.', fn: () => UI.close('dialog') };
  const treeOpt = { label: '🌳 Ver a Árvore de Classes', fn: () => { UI.close('dialog'); UI.open('tree'); } };
  if (!c.next.length) {
    UI.dialog(npc, `Você trilhou seu caminho até o fim, ${c.name}. Por enquanto...\nDizem que existe um terceiro despertar, mas nem eu sei como alcançá-lo. Ainda.`, [treeOpt, bye]);
    return;
  }
  const need = c.tier === 0 ? CONFIG.JOB_CHANGE_1 : CONFIG.JOB_CHANGE_2;
  if (p.jobLv < need) {
    const txt = c.tier === 0
      ? `Olá, jovem ${p.name}. Todo aventureiro começa como Aprendiz.\nQuando chegar ao <b>Nível de Classe ${need}</b> (você está no ${p.jobLv}), volte aqui e escolha seu caminho: <b>Guerreiro, Mago, Arqueiro ou Ladino</b>.`
      : `Você evolui bem como ${c.name}. Ao atingir o <b>Nível de Classe ${need}</b> (você está no ${p.jobLv}), o caminho se dividirá em dois:\n<b>${c.next.map(n => CLASSES[n].name).join('</b> ou <b>')}</b>.`;
    UI.dialog(npc, txt, [treeOpt, bye]);
    return;
  }
  const opts = c.next.map(n => ({ label: `${CLASSES[n].icon} Tornar-me ${CLASSES[n].name}`, gold: true, fn: () => confirmClass(npc, n) }));
  UI.dialog(npc, c.tier === 0 ? 'Chegou a hora, aventureiro. Que caminho você escolhe?\n<span class="muted">Escolha com calma — não há volta.</span>' : `Seu treino como ${c.name} está completo. Duas estradas se abrem diante de você:`, [...opts, treeOpt, bye]);
}
function confirmClass(npc, cls) {
  const c = CLASSES[cls];
  const skl = c.skills.map(id => `${SKILLS[id].icon} ${SKILLS[id].name}`).join(', ');
  UI.dialog(npc, `<b>${c.icon} ${c.name}</b>\n${c.desc}\n<span class="muted">Habilidades: ${skl}\nArmas: ${c.weapons.map(w => WEAPON_TYPES[w].name).join(', ')}</span>\n\nTem certeza? Essa escolha é para sempre.`, [
    { label: `✔ Sim, quero ser ${c.name}!`, gold: true, fn: () => { UI.close('dialog'); changeClass(cls); } },
    { label: '← Voltar', fn: () => classDialog(npc) }]);
}

/* ================= Efeitos e textos ================= */
function fx(type, x, y, dur, extra = {}) { G.effects.push(Object.assign({ type, x, y, t0: G.time, dur, seed: Math.random() * 6 }, extra)); }
function floater(e, text, color, oy = 0, big = false) {
  const stack = G.floaters.filter(f => f.ref === e && G.time - f.t0 < 0.3).length;
  G.floaters.push({ ref: e, text: String(text), x: e.x + rand(-6, 6), y: e.y - 30 + oy - stack * 10, t0: G.time, color, big });
}

/* ================= Chat e comandos ================= */
function handleChat(v) {
  const p = G.player;
  if (!v.startsWith('/')) { p.say = { text: v, until: G.time + 5 }; UI.log(`${p.name}: ${v}`, 'me'); return; }
  const [cmd, ...args] = v.slice(1).split(/\s+/);
  const n = parseInt(args[0]);
  const dev = t => UI.log('[dev] ' + t, 'dev');
  switch (cmd.toLowerCase()) {
    case 'ajuda': UI.log('Comandos: /onde • /destravar (se ficar preso) • /salvar • /resetar • Teste (dev): /taxa N, /nivel N, /classe N, /zeny N, /item id [qtd], /cura, /ir mapa, /carta monstro', 'sys'); break;
    case 'onde': UI.log(`${G.map.def.name} (${Math.floor(p.x / TILE)}, ${Math.floor(p.y / TILE)})`, 'sys'); break;
    case 'salvar': saveGame(); UI.log('Jogo salvo.', 'sys'); break;
    case 'resetar': if (confirm(`Apagar ${p.name} e recomeçar do zero?\n(Uma cópia fica em saves/lixeira, caso mude de ideia.)`)) {
      removeEventListener('beforeunload', saveGame); G.state = 'title';
      localStorage.removeItem(SAVE_KEY);
      const go = () => location.reload();
      if (HAS_SERVER) fetch('/api/save/' + saveSlug(p.name), { method: 'DELETE' }).finally(go); else go();
    } break;
    case 'taxa': if (n > 0) { CONFIG.EXP_RATE = n; dev(`Taxa de EXP agora é ${n}x (até recarregar a página).`); } break;
    case 'nivel': if (n > 0) { while (p.baseLv < Math.min(n, CONFIG.MAX_BASE_LV)) { p.baseLv++; p.statPoints += Math.floor(p.baseLv / 5) + 3; } recalc(p); p.hp = p.d.maxHp; dev(`Nível de Base ${p.baseLv}.`); UI.markDirty(); } break;
    case 'classe': if (n > 0) { while (p.jobLv < Math.min(n, maxJobLv(p))) { p.jobLv++; p.skillPoints++; } dev(`Nível de Classe ${p.jobLv}.`); UI.markDirty(); } break;
    case 'zeny': if (n > 0) { p.zeny += n; dev(`+${n} z.`); UI.markDirty(); } break;
    case 'item': if (ITEMS[args[0]]) { addItem(p, args[0], parseInt(args[1]) || 1); dev(`Item ${ITEMS[args[0]].name} criado.`); UI.markDirty(); } else dev('Item não existe. Ids: ' + Object.keys(ITEMS).slice(0, 12).join(', ') + '...'); break;
    case 'carta': if (ITEMS['carta_' + args[0]]) { addItem(p, 'carta_' + args[0], 1); dev('Carta criada.'); UI.markDirty(); } else dev('Monstros: ' + Object.keys(MONSTERS).join(', ')); break;
    case 'destravar': if (!unstick(p)) { const [sx, sy] = G.map.def.spawn; p.x = sx * TILE + TILE / 2; p.y = sy * TILE + TILE / 2; p.path = null; } UI.log('Você foi levado a um lugar seguro.', 'sys'); break;
    case 'cura': p.hp = p.d.maxHp; p.sp = p.d.maxSp; dev('Curado.'); break;
    case 'ir': if (MAPS[args[0]]) { const [sx, sy] = MAPS[args[0]].spawn; changeMap(args[0], sx, sy); } else dev('Mapas: ' + Object.keys(MAPS).join(', ')); break;
    default: UI.log('Comando desconhecido. Digite /ajuda.', 'warn');
  }
}
/* ================= Modo Mestre (God Mode + teleporte) =================
   Só existe "na conta de administrador": por enquanto, isso significa o jogo
   rodando no seu próprio computador (localhost / arquivo local). */
function isAdmin() {
  return location.protocol === 'file:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
}
function toggleGod(force) {
  const p = G.player; if (!p) return;
  G.god = force === undefined ? !G.god : !!force;
  if (G.god) {
    if (p.dead) { p.dead = false; G.state = 'play'; UI.hideOverlay(); }
    p.hp = p.d.maxHp; p.sp = p.d.maxSp;
    fx('levelup', p.x, p.y, 1.4, { text: 'GOD MODE' }); Sound.play('holy');
    UI.log('⚡ God Mode ATIVADO: imortal, SP infinito, sem recarga, mais rápido. Botão direito no mapa = teleporte. ⌘+Z abre o Painel do Mestre.', 'card');
  } else { Sound.play('click'); UI.log('God Mode desativado.', 'sys'); }
  for (const m of G.monsters) if (G.god) m.target = null;
  UI.markDirty();
}
// teleporte instantâneo para (tx,ty) do mapa; px/py opcionais para posição exata
function godTeleport(mapId, tx, ty, px, py) {
  const p = G.player; if (!p || !MAPS[mapId]) return;
  const m = getMap(mapId);
  tx = clamp(tx, 0, m.w - 1); ty = clamp(ty, 0, m.h - 1);
  if (mapId !== G.mapId) changeMap(mapId, tx, ty);
  else { p.x = tx * TILE + TILE / 2; p.y = ty * TILE + TILE / 2; }
  if (px !== undefined && !m.isSolid(tx, ty)) { p.x = px; p.y = py; }
  unstick(p);
  p.path = null; p.action = null; p.casting = null; p.sitting = false;
  G.cam.x = p.x; G.cam.y = p.y;
  fx('aura', p.x, p.y, 0.8, { color: '#ffd76a' }); fx('ring', p.x, p.y, 0.5, { r: 40, color: '#9fe3ff' });
  Sound.play('portal');
}

/* ================= Pausa ================= */
function setPaused(on) {
  if (on && G.state !== 'play' && G.state !== 'dead') return;
  G.paused = on;
  G.mouse.down = false; G.mouse.holdMove = false;
  if (Sound.music) Sound.music.gain.setTargetAtTime(on ? 0.05 : 0.16, Sound.ctx.currentTime, 0.2);
  updatePauseBar();
}
function togglePause() { if (FB.picking || FB.box) return; setPaused(!G.paused); }
function updatePauseBar() {
  const b = document.getElementById('pausebar');
  if (!G.paused) { b.classList.remove('show'); return; }
  b.innerHTML = FB.picking
    ? '💡 <b>Modo sugestão</b> — clique em algo ou arraste para marcar uma área · <b>Esc</b> cancela'
    : FB.box ? '💡 <b>Escrevendo sugestão</b> — o jogo está pausado'
      : '⏸ <b>Jogo pausado</b> — <b>P</b> continua · <b>Q</b> faz uma sugestão';
  b.classList.add('show');
}

function toggleSound() {
  Sound.init(); Sound.setEnabled(!Sound.enabled);
  document.getElementById('btn-sound').firstChild.textContent = Sound.enabled ? '🔊' : '🔇';
  try { localStorage.setItem('aethra_sound', Sound.enabled ? '1' : '0'); } catch (e) { }
  if (Sound.enabled && G.map) { Sound.songId = null; Sound.playSong(G.map.def.music); }
}

/* ================= Entrada ================= */
function screenToWorld(sx, sy) { return { x: (sx - VW / 2) / G.cam.zoom + G.cam.x, y: (sy - VH / 2) / G.cam.zoom + G.cam.y }; }
function computeHover() {
  const { wx, wy } = G.mouse;
  let best = null, bd = 1e9;
  for (const m of G.monsters) {
    if (m.dead) continue;
    const h = monsterHeight(m);
    const dx = wx - m.x, dy = wy - (m.y - h / 2);
    const r = Math.max(16, 14 * m.def.size + 6);
    const d = Math.hypot(dx, dy * (r / Math.max(r, h / 2 + 4)));
    if (d < r && d < bd) { bd = d; best = { kind: 'monster', ref: m }; }
  }
  for (const n of G.npcs) { const d = Math.hypot(wx - n.x, wy - (n.y - 18)); if (d < 20 && d < bd) { bd = d; best = { kind: 'npc', ref: n }; } }
  for (const dr of G.drops) { const d = Math.hypot(wx - dr.x, wy - (dr.y - 8)); if (d < 14 && d < bd) { bd = d; best = { kind: 'drop', ref: dr }; } }
  G.hover = best;
  canvas.style.cursor = (G.targeting || FB.picking) ? 'crosshair' : best ? (best.kind === 'monster' ? 'crosshair' : 'pointer') : 'default';
}
canvas.addEventListener('mousemove', e => {
  G.mouse.sx = e.clientX; G.mouse.sy = e.clientY;
  const w = screenToWorld(e.clientX, e.clientY); G.mouse.wx = w.x; G.mouse.wy = w.y;
});
canvas.addEventListener('mousedown', e => {
  if (G.state !== 'play' || G.paused || FB.picking) return;
  document.activeElement && document.activeElement.blur();
  const p = G.player;
  if (e.button === 2) {
    if (G.targeting) { G.targeting = null; UI.log('Cancelado.', 'sys'); }
    else if (G.god) godTeleport(G.mapId, Math.floor(G.mouse.wx / TILE), Math.floor(G.mouse.wy / TILE), G.mouse.wx, G.mouse.wy);
    return;
  }
  if (e.button !== 0) return;
  computeHover();
  const h = G.hover;
  if (G.targeting) {
    const t = G.targeting;
    if (t.ground) queueSkill(t.id, t.lv, { pt: { x: G.mouse.wx, y: G.mouse.wy } });
    else if (h && h.kind === 'monster') queueSkill(t.id, t.lv, { m: h.ref });
    else { G.targeting = null; UI.log('Nenhum alvo selecionado.', 'warn'); }
    return;
  }
  p.sitting = false;
  if (p.casting) return;
  if (h && h.kind === 'monster') { p.action = { type: 'attack', m: h.ref }; }
  else if (h && h.kind === 'npc') { p.action = { type: 'talk', npc: h.ref }; }
  else if (h && h.kind === 'drop') { p.action = { type: 'pick', drop: h.ref }; }
  else {
    moveTo(G.mouse.wx, G.mouse.wy);
    fx('click', G.mouse.wx, G.mouse.wy, 0.4);
    G.mouse.down = true; G.mouse.holdMove = true; G.nextHoldPath = G.time + 0.25;
  }
});
addEventListener('mouseup', () => { G.mouse.down = false; G.mouse.holdMove = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); G.cam.zoom = clamp(G.cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 1, 3); }, { passive: false });

/* teclas de movimento (WASD + setas) */
const MOVE_KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
G.moveKeys = {};
function keyDir() {
  const m = G.moveKeys;
  const x = (m.right ? 1 : 0) - (m.left ? 1 : 0), y = (m.down ? 1 : 0) - (m.up ? 1 : 0);
  if (!x && !y) return null;
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}
addEventListener('keyup', e => { const d = MOVE_KEYS[e.key.toLowerCase()]; if (d) G.moveKeys[d] = false; });
addEventListener('blur', () => { G.moveKeys = {}; });

addEventListener('keydown', e => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (G.state !== 'play') return;
  const k = e.key.toLowerCase();
  if (UI.menuOpen) { if (k === 'escape') UI.closeGameMenu(); return; }
  // ⌘/Ctrl + Z: Painel do Mestre
  if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (isAdmin()) UI.toggle('admin'); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (MOVE_KEYS[k]) { e.preventDefault(); if (!FB.picking && !FB.box) G.moveKeys[MOVE_KEYS[k]] = true; return; }
  if (k === 'p') { togglePause(); return; }
  if (k === 'q') { FB.start(); return; }
  if (k === 'l') { UI.toggle('sugestoes'); return; }
  if (FB.picking || FB.box) { if (k === 'escape') FB.cancel(); return; }
  if (k === 'z') { if (isAdmin()) toggleGod(); return; }
  if (G.paused && ((k >= '1' && k <= '9') || k === 'x' || k === 'f')) return;
  if (k >= '1' && k <= '9') { useHotbar(+k - 1); return; }
  switch (k) {
    case 'enter': document.getElementById('chatinput').focus(); e.preventDefault(); break;
    case 'escape': // cancela mira > fecha janelas > abre o menu do jogo
      if (G.targeting) G.targeting = null;
      else if (!UI.closeAll()) UI.showGameMenu();
      break;
    case 'c': UI.toggle('char'); break;
    case 'i': UI.toggle('inv'); break;
    case 'e': UI.toggle('equip'); break;
    case 'k': UI.toggle('skills'); break;
    case 't': UI.toggle('tree'); break;
    case 'h': UI.toggle('help'); break;
    case 'n': toggleSound(); break;
    case 'x': { const p = G.player; if (!p.dead && !p.casting) { p.sitting = !p.sitting; p.path = null; p.action = null; } break; }
    case 'f': {
      const p = G.player; let best = null, bd = 3 * TILE;
      for (const d of G.drops) { const dd = Math.hypot(d.x - p.x, d.y - p.y); if (dd < bd) { bd = dd; best = d; } }
      if (best) p.action = { type: 'pick', drop: best };
      break;
    }
  }
});

/* ================= Loop ================= */
function update(dt) {
  G.time += dt;
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const t = G.timers[i];
    if (t.at <= G.time) { G.timers.splice(i, 1); if (t.token === undefined || t.token === G.mapToken) t.fn(); }
  }
  updatePlayer(dt);
  for (const m of G.monsters) updateMonster(m, dt);
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    if (pr.target && (pr.target === G.player || monsterAlive(pr.target))) { pr.tx = pr.target.x; pr.ty = pr.target.y; }
    const dx = pr.tx - pr.x, dy = pr.ty - pr.y, d = Math.hypot(dx, dy), st = pr.speed * dt;
    if (d <= st + 4) { G.projectiles.splice(i, 1); pr.onHit && pr.onHit(); }
    else { pr.x += dx / d * st; pr.y += dy / d * st; }
  }
  G.effects = G.effects.filter(e => G.time - e.t0 < e.dur);
  G.floaters = G.floaters.filter(f => G.time - f.t0 < 1.1);
  G.drops = G.drops.filter(d => G.time - d.t < CONFIG.DROP_LIFETIME);
  const p = G.player;
  if (p.say && p.say.until < G.time) p.say = null;
  // câmera
  G.cam.x += (p.x - G.cam.x) * Math.min(1, dt * 8);
  G.cam.y += (p.y - G.cam.y) * Math.min(1, dt * 8);
  clampCam();
  computeHover();
  UI.updateHud();
  if (UI.dirty) UI.refreshOpen();
  if (G.time - G.lastSave > 30) saveGame();
}
function clampCam() {
  const hw = VW / 2 / G.cam.zoom, hh = VH / 2 / G.cam.zoom, mw = G.map.w * TILE, mh = G.map.h * TILE;
  G.cam.x = mw < hw * 2 ? mw / 2 : clamp(G.cam.x, hw, mw - hw);
  G.cam.y = mh < hh * 2 ? mh / 2 : clamp(G.cam.y, hh, mh - hh);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!G.map) return;
  const z = G.cam.zoom * DPR, t = G.time;
  ctx.setTransform(z, 0, 0, z, Math.round(VW * DPR / 2 - G.cam.x * z), Math.round(VH * DPR / 2 - G.cam.y * z));
  ctx.drawImage(getGround(G.map), 0, 0);
  const hw = VW / 2 / G.cam.zoom, hh = VH / 2 / G.cam.zoom;
  const vx0 = G.cam.x - hw - 80, vx1 = G.cam.x + hw + 80, vy0 = G.cam.y - hh - 40, vy1 = G.cam.y + hh + 120;
  const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  for (const pt of G.map.def.portals) drawPortal(ctx, pt, t);
  const p = G.player;
  // anel do alvo
  const tgt = p && p.action && p.action.m && monsterAlive(p.action.m) ? p.action.m : null;
  if (tgt) { ctx.strokeStyle = `rgba(255,80,80,${0.6 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y, 16 * tgt.def.size, 6 * tgt.def.size, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (G.hover && G.hover.kind === 'monster' && G.hover.ref !== tgt) { const m = G.hover.ref; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(m.x, m.y, 15 * m.def.size, 5.5 * m.def.size, 0, 0, Math.PI * 2); ctx.stroke(); }
  // ordenação por profundidade
  const list = [];
  for (const o of G.map.objects) if (inView(o.x, o.y - 40)) list.push([o.y, 0, o]);
  for (const d of G.drops) if (inView(d.x, d.y)) list.push([d.y - 2, 1, d]);
  for (const m of G.monsters) if (inView(m.x, m.y)) list.push([m.y, 2, m]);
  for (const n of G.npcs) if (inView(n.x, n.y)) list.push([n.y, 3, n]);
  if (p && G.state !== 'title') list.push([p.y, 4, p]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, kind, e] of list) {
    if (kind === 0) {
      // objeto na frente do personagem fica translúcido para ele nunca sumir
      const fade = p && G.state !== 'title' && occludes(e, p);
      if (fade) ctx.globalAlpha = 0.45;
      drawObject(ctx, e, t);
      ctx.globalAlpha = 1;
    }
    else if (kind === 1) drawDrop(ctx, e, t);
    else if (kind === 2) drawMonster(ctx, e, t);
    else if (kind === 3) drawHumanoid(ctx, e.x, e.y, Object.assign({ dir: e.x > G.cam.x + 200 ? -1 : 1, seed: e.x }, e.look), t);
    else drawPlayer(ctx, e, t);
  }
  for (const pr of G.projectiles) drawProjectile(ctx, pr);
  for (const e of G.effects) drawEffect(ctx, e, t);
  // nomes e barras
  for (const m of G.monsters) {
    if (m.dead || !inView(m.x, m.y)) continue;
    const h = monsterHeight(m);
    const hovered = G.hover && G.hover.ref === m;
    if (m.hp < m.maxHp || m === tgt || m.def.boss) {
      const w = m.def.boss ? 70 : 32, x0 = m.x - w / 2, y0 = m.y + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 5);
      ctx.fillStyle = m.def.boss ? '#ff4040' : '#e04848'; ctx.fillRect(x0, y0, w * Math.max(0, m.hp / m.maxHp), 3);
    }
    if (hovered || m.def.boss || m.def.mini) {
      const col = m.def.boss ? '#ff6a4a' : m.def.mini ? '#ffb84a' : '#ffffff';
      outlinedText(ctx, `${m.def.name}  Nv.${m.def.lv}`, m.x, m.y - h - 10, col, 10);
      if (hovered) outlinedText(ctx, ELEMENTS[m.def.element].name, m.x, m.y - h - 0, ELEMENTS[m.def.element].color, 9, 'normal');
    }
  }
  for (const n of G.npcs) {
    if (!inView(n.x, n.y)) continue;
    outlinedText(ctx, n.name, n.x, n.y + 12, '#ffe36a', 10);
    outlinedText(ctx, n.title, n.x, n.y + 23, '#d8d0e8', 8.5, 'normal');
    if (n.role === 'classe' && p && canChangeClass(p)) outlinedText(ctx, '!', n.x, n.y - 52 + Math.sin(t * 4) * 3, '#ffd84a', 18);
  }
  if (p && G.state !== 'title') drawPlayerOverlay(ctx, p, t);
  for (const f of G.floaters) {
    const k = (t - f.t0) / 1.1;
    const yy = f.y - Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 22 - k * 8;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    outlinedText(ctx, f.text, f.x, yy, f.color, f.big ? 18 : (isNaN(+f.text) ? 11 : 14), '800');
    ctx.globalAlpha = 1;
  }
  // mira de habilidade em área
  if (G.targeting && G.targeting.ground) {
    const sk = SKILLS[G.targeting.id], r = sk.effect.radius * TILE;
    const col = ELEMENTS[sk.effect.element || 'neutro'].color;
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(G.mouse.wx, G.mouse.wy, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.15; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
  }
  if (G.state !== 'title') FB.renderWorld(ctx, t);
  // ambiente
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.map.def.ambient) { ctx.fillStyle = G.map.def.ambient; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35, canvas.width / 2, canvas.height / 2, canvas.height * 0.9);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (G.state !== 'title') drawMinimap();
}
const OCCLUDE_BOX = { house: [96, 160], tree: [20, 48], pine: [16, 56], pillar: [14, 52], wall: [16, 38], deadtree: [12, 36], fountain: [36, 50] };
function occludes(o, p) {
  const b = OCCLUDE_BOX[o.type];
  if (!b || o.y <= p.y) return false;
  return Math.abs(p.x - o.x) < b[0] && p.y > o.y - b[1];
}
function drawPlayer(c, p, t) {
  const cls = CLASSES[p.cls];
  if (G.god) { // aura dourada do God Mode
    const pulse = 0.5 + Math.sin(t * 4) * 0.2;
    ell(c, p.x, p.y, 18, 7, `rgba(255,215,106,${pulse * 0.45})`);
    c.strokeStyle = `rgba(255,230,140,${pulse})`; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(p.x, p.y, 20, 8, 0, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 4; i++) { const k = (t * 0.8 + i / 4) % 1; circ(c, p.x + Math.sin(i * 2.4 + t) * 12, p.y - k * 40, 1.8 * (1 - k), `rgba(255,240,170,${1 - k})`); }
  }
  const atkK = clamp((G.time - p.atkT) / 0.25, 0, 1);
  drawHumanoid(c, p.x, p.y, {
    dir: p.dir, walk: p.moving, walkT: p.walkT, sit: p.sitting, body: cls.color, accent: cls.accent, hair: p.look.hair, skin: p.look.skin,
    hairStyle: p.look.hairStyle, hat: cls.hat, robe: cls.robe, cape: cls.cape, weapon: p.dead ? null : p.d.wtype === 'mao' ? null : p.d.wtype,
    atk: atkK < 1 ? atkK : 0, seed: 1,
  }, t);
  if (p.casting) {
    const k = (G.time - p.casting.start) / (p.casting.end - p.casting.start);
    const col = ELEMENTS[SKILLS[p.casting.id].effect.element || 'neutro'].color;
    c.strokeStyle = col; c.lineWidth = 1.5; c.globalAlpha = 0.7;
    c.beginPath(); c.ellipse(p.x, p.y, 20, 8, 0, t * 3, t * 3 + Math.PI * 2 * k); c.stroke(); c.globalAlpha = 1;
  }
}
function drawPlayerOverlay(c, p, t) {
  outlinedText(c, p.name, p.x, p.y + 22, '#ffffff', 10);
  const w = 34, x0 = p.x - w / 2, y0 = p.y + 7;
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x0 - 1, y0 - 1, w + 2, 7);
  c.fillStyle = '#48d860'; c.fillRect(x0, y0, w * p.hp / p.d.maxHp, 2.5);
  c.fillStyle = '#4a8cff'; c.fillRect(x0, y0 + 3, w * p.sp / p.d.maxSp, 2);
  if (p.casting) {
    const k = (G.time - p.casting.start) / (p.casting.end - p.casting.start);
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(p.x - 21, p.y - 52, 42, 6);
    c.fillStyle = '#7fd3ff'; c.fillRect(p.x - 20, p.y - 51, 40 * k, 4);
    outlinedText(c, SKILLS[p.casting.id].name, p.x, p.y - 60, '#cfe8ff', 9);
  }
  if (p.say) {
    c.font = '11px Nunito, sans-serif';
    const tw = Math.min(200, c.measureText(p.say.text).width) + 14, by = p.y - 62;
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.roundRect(p.x - tw / 2, by - 11, tw, 20, 8); c.fill();
    c.beginPath(); c.moveTo(p.x - 4, by + 9); c.lineTo(p.x + 4, by + 9); c.lineTo(p.x, by + 14); c.fill();
    c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.say.text, p.x, by, 200);
  }
  if (p.sitting) outlinedText(c, 'z', p.x + 10 + Math.sin(t * 2) * 2, p.y - 34 - ((t * 10) % 10), '#cfe8ff', 10);
}
const miniEl = document.getElementById('minimap'), mctx = miniEl.getContext('2d');
function drawMinimap() {
  const m = G.map, W = miniEl.width, H = miniEl.height;
  const s = Math.min(W / m.w, H / m.h), ox = (W - m.w * s) / 2, oy = (H - m.h * s) / 2;
  mctx.fillStyle = '#0b0d14'; mctx.fillRect(0, 0, W, H);
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(getMini(m), ox, oy, m.w * s, m.h * s);
  const dot = (x, y, col, r = 2) => { mctx.fillStyle = col; mctx.beginPath(); mctx.arc(ox + x / TILE * s, oy + y / TILE * s, r, 0, Math.PI * 2); mctx.fill(); };
  for (const pt of m.def.portals) dot(pt.x * TILE + 16, pt.y * TILE + 16, '#9fe3ff', 3);
  for (const mo of G.monsters) if (!mo.dead) dot(mo.x, mo.y, mo.def.boss ? '#ff3030' : mo.def.mini ? '#ffb84a' : mo.def.aggressive ? '#ff7a7a' : '#ffd0a0', mo.def.boss || mo.def.mini ? 3 : 1.5);
  for (const n of G.npcs) dot(n.x, n.y, '#ffe36a', 2.5);
  const p = G.player;
  dot(p.x, p.y, '#fff', 3); dot(p.x, p.y, '#3a8cff', 2);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if ((G.state === 'play' || G.state === 'dead') && !G.paused) update(dt);
  else if (G.paused) { computeHover(); UI.updateHud(); if (UI.dirty) UI.refreshOpen(); }
  else if (G.state === 'title' && G.map) {
    G.time += dt;
    G.cam.x = G.map.w * TILE / 2 + Math.sin(G.time * 0.08) * 220; G.cam.y = G.map.h * TILE / 2 + Math.cos(G.time * 0.06) * 80;
  }
  render();
  requestAnimationFrame(frame);
}

/* ================= Início ================= */
function enterGame() {
  G.state = 'play';
  UI.hideOverlay();
  document.getElementById('hud').classList.remove('hidden');
  try { if (localStorage.getItem('aethra_sound') === '0') { Sound.setEnabled(false); document.getElementById('btn-sound').firstChild.textContent = '🔇'; } } catch (e) { }
  UI.markDirty();
}
function startNewGame(name, look) {
  G.player = newPlayer(name, look);
  enterGame();
  const [sx, sy] = MAPS.vila.spawn;
  changeMap('vila', sx, sy);
  UI.log(`Bem-vindo(a) a ${GAME_TITLE}, ${name}!`, 'card');
  UI.log('Você tem 48 pontos de atributo para distribuir (C). Os campos ficam a leste da vila. Aperte H para ajuda e Esc para o menu.', 'sys');
}
// salva e volta para a tela inicial (lista de personagens)
function returnToTitle() {
  saveGame();
  UI.closeAll(); UI.hideOverlay(); UI.menuOpen = false;
  if (FB.picking || FB.box) FB.cancel();
  G.paused = false; updatePauseBar();
  G.god = false; G.moveKeys = {}; G.targeting = null;
  G.state = 'title'; G.player = null;
  document.getElementById('hud').classList.add('hidden');
  G.mapToken++;
  G.mapId = 'vila'; G.map = getMap('vila');
  G.monsters = []; G.drops = []; G.projectiles = []; G.effects = []; G.floaters = []; G.timers = [];
  G.npcs = (G.map.def.npcs || []).map(n => Object.assign({}, n, { x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2 }));
  Sound.playSong('vila');
  listCharacters().then(list => UI.showTitle(list));
}
function continueGame(s) {
  G.uid = Math.max(G.uid, s.uid || 1);
  const p = { name: s.name, look: s.look };
  initRuntime(p);
  for (const k of SAVE_FIELDS) if (s[k] !== undefined) p[k] = s[k];
  p.hotbar = (p.hotbar || []).concat(Array(9).fill(null)).slice(0, 9);
  G.player = p;
  recalc(p);
  enterGame();
  const mapId = MAPS[s.mapId] ? s.mapId : 'vila';
  const def = MAPS[mapId];
  let tx = Math.floor((s.x || 0) / TILE), ty = Math.floor((s.y || 0) / TILE);
  const gm = getMap(mapId);
  if (!gm.inb(tx, ty) || gm.isSolid(tx, ty) || !gm.reach[gm.i(tx, ty)]) [tx, ty] = def.spawn;
  changeMap(mapId, tx, ty);
  G.player.x = clamp(s.x, 0, gm.w * TILE); G.player.y = clamp(s.y, 0, gm.h * TILE);
  unstick(p);
  if (p.hp <= 0) p.hp = Math.floor(p.d.maxHp / 2);
  UI.log(`Bem-vindo(a) de volta, ${p.name}!`, 'card');
}

UI.init();
G.map = getMap('vila');
G.npcs = (G.map.def.npcs || []).map(n => Object.assign({}, n, { x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2 }));
listCharacters().then(list => UI.showTitle(list));
addEventListener('beforeunload', saveGame);
requestAnimationFrame(frame);
