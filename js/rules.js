'use strict';
/* =========================================================================
   REGRAS COMPARTILHADAS — usadas pelo jogo 2D (js/game.js) e pelo 3D (js3d/).
   Atributos, níveis, EXP, inventário e fórmulas de dano. Sem desenho aqui.
   ========================================================================= */

// ids únicos de itens: usa o contador do jogo 2D (G.uid) quando existir
let RULES_UID = 1;
function nextUid() { return (typeof G !== 'undefined' && G && G.uid !== undefined) ? G.uid++ : RULES_UID++; }

const rand = (a, b) => a + Math.random() * (b - a);

const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

function saveSlug(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'sem_nome'; }

function saveSummary(s, local) { return { slug: saveSlug(s.name), name: s.name, cls: s.cls, baseLv: s.baseLv, jobLv: s.jobLv, savedAt: s.savedAt || 0, local }; }

function newCharId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.name && CLASSES[s.cls] ? s : null; } catch (e) { return null; } }

const isEquipType = id => EQUIP_TYPES.includes(ITEMS[id].type);

function addItem(p, id, qty = 1) {
  if (!ITEMS[id]) return false;
  if (isEquipType(id)) {
    for (let i = 0; i < qty; i++) p.inventory.push({ uid: nextUid(), id, qty: 1, cards: Array(ITEMS[id].slots || 0).fill(null) });
  } else {
    const e = p.inventory.find(x => x.id === id);
    if (e) e.qty += qty; else p.inventory.push({ uid: nextUid(), id, qty });
  }
  return true;
}

function removeItem(p, entry, qty = 1) {
  entry.qty -= qty;
  if (entry.qty <= 0) { const i = p.inventory.indexOf(entry); if (i >= 0) p.inventory.splice(i, 1); }
}

const countItem = (p, id) => p.inventory.filter(e => e.id === id).reduce((s, e) => s + e.qty, 0);

const sellPrice = id => Math.max(1, Math.floor((ITEMS[id].price || 2) / 2));

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
  for (const s of EQUIP_SLOTS) {
    const e = p.equip[s]; if (!e) continue;
    const it = ITEMS[e.id];
    addBonus(b, { atk: it.atk || 0, matk: it.matk || 0, def: it.def || 0, mdef: it.mdef || 0 });
    if (e.refine) addBonus(b, refineBonus(it, e.refine)); // S-124: refino
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
  const ranged = wt === 'arco' || !!(WEAPON_TYPES[wt] && WEAPON_TYPES[wt].ranged); // S-325: besta também é à distância (usa DES)
  const main = ranged ? d.dex : d.str, sec = ranged ? d.str : d.dex;
  d.atk = Math.floor((main + Math.pow(Math.floor(main / 10), 2) + Math.floor(sec / 5) + Math.floor(d.luk / 5) + (b.atk || 0)) * (1 + (b.atkPct || 0) / 100));
  d.matk = Math.floor((d.int * 1.5 + Math.pow(Math.floor(d.int / 7), 2) + (b.matk || 0)) * (1 + (b.matkPct || 0) / 100));
  d.def = (b.def || 0) + Math.floor(d.vit / 2);
  d.mdef = (b.mdef || 0) + Math.floor(d.int / 3);
  d.hit = lv + d.dex + (b.hit || 0);
  d.flee = lv + d.agi + (b.flee || 0);
  d.crit = Math.round((1 + d.luk * 0.3 + (b.crit || 0)) * 10) / 10;
  const wm = WEAPON_TYPES[wt];
  d.aspd = Math.max(260, (1200 - d.agi * 8 - d.dex * 2.2) * wm.delay /* S-293: golpes um pouco mais seguidos mesmo com pouca agilidade (era 1500) */ * (1 - Math.min(60, b.aspdPct || 0) / 100));
  d.rangeTiles = wm.range + (ranged ? (b.range || 0) : 0);
  d.range = d.rangeTiles * CONFIG.TILE;
  d.magicAuto = !!wm.magic; // cajado: ataque básico é um projétil mágico (usa ATQM)
  d.sonic = !!wm.sonic; // S-324: instrumento do Bardo — onda sonora à distância (usa DES como o arco)
  d.ranged = ranged || d.magicAuto || d.sonic; d.wtype = wt;
  d.speed = 125 * (1 + (b.moveSpeedPct || 0) / 100);
  d.castMult = Math.max(0.2, 1 - d.dex / 150);
  d.lifesteal = b.lifesteal || 0; d.doubleAttack = b.doubleAttack || 0; d.falcon = b.falcon || 0;
  d.dmgVs = b.dmgVs || {}; d.resist = b.resist || {};
  d.hpRegen = b.hpRegen || 0; d.spRegen = b.spRegen || 0; d.expPct = b.expPct || 0;
  p.d = d;
  p.hp = Math.min(p.hp, d.maxHp); p.sp = Math.min(p.sp, d.maxSp);
}

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

/* ---------------- Mascotes ---------------- */
function petStage(pet) { let s = 0; for (let i = 0; i < PET_EVOLVE.length; i++) if (pet.lv >= PET_EVOLVE[i]) s = i; return s; }
function petInfo(pet) { const sp = PETS[pet.species], st = petStage(pet); return { ...sp.stages[st], stage: st, species: sp }; }
function petExpNext(lv) { return Math.floor(18 * lv * lv + 30 * lv + 20); }
function newPet(species) { return { species, lv: 1, exp: 0 }; }
// dá EXP ao mascote; devolve { up: níveis ganhos, evolved: novo estágio ou null }
function petGainExp(pet, amount) {
  if (!pet || pet.lv >= PET_MAX_LV) return { up: 0, evolved: null };
  const before = petStage(pet); let up = 0;
  pet.exp += Math.max(1, Math.floor(amount));
  while (pet.lv < PET_MAX_LV && pet.exp >= petExpNext(pet.lv)) { pet.exp -= petExpNext(pet.lv); pet.lv++; up++; }
  if (pet.lv >= PET_MAX_LV) pet.exp = 0;
  const after = petStage(pet);
  return { up, evolved: after > before ? after : null };
}
// força do mascote (usada nos ataques, curas e proteção)
// S-114: o mascote tem vida (HP) e, em vez de SP, stamina: correr e atacar cansam; descansando, recupera.
const PET_HP_MOD = { ataque: 1, suporte: 0.85, guardiao: 1.6 };
function petPower(pet) { const st = petStage(pet); return { atk: Math.round((8 + pet.lv * 3.2) * (1 + st * 0.6)), heal: 0.05 + st * 0.03, guard: 8 + st * 6, speedMult: 1 + st * 0.2, maxHp: Math.round((70 + pet.lv * 16) * (1 + st * 0.5) * (PET_HP_MOD[PETS[pet.species].role] || 1)), maxSta: 100 + st * 25, def: 5 + pet.lv + st * 10 }; }

/* ---------------- Refino (S-124) ----------------
   Armas usam Ferrolume e ganham ATQ (cajados também ATQM); armaduras, escudos, chapéus, capas e botas usam
   Pedra-Égide e ganham DEF. Até o nível seguro (+4) nunca quebra; daí em diante cada tentativa pode quebrar o item. */
const REFINE_MAX = 10, REFINE_SAFE = 4;
const REFINE_CHANCE = [1, 1, 1, 1, 0.8, 0.65, 0.5, 0.35, 0.22, 0.12]; // chance de passar de +n para +n+1
const REFINE_TYPES = ['arma', 'armadura', 'escudo', 'cabeca', 'capa', 'botas'];
function canRefine(it) { return it && REFINE_TYPES.includes(it.type); }
function refineMat(it) { return it.type === 'arma' ? 'ferrolume' : 'pedra_egide'; }
function refineCost(it, lv) { return Math.round((it.type === 'arma' ? 250 : 200) * (lv + 1) * (1 + (it.lv || 1) / 40)); }
function refineBonus(it, lv) { if (!lv) return {}; if (it.type === 'arma') return it.wtype === 'cajado' ? { atk: lv * 3, matk: lv * 5 } : { atk: lv * 6 }; return { def: lv * (it.type === 'armadura' ? 2 : 1), mdef: it.type === 'armadura' ? Math.floor(lv / 2) : 0 }; }
function refineName(en) { const it = ITEMS[en.id]; return (en.refine ? '+' + en.refine + ' ' : '') + it.name; }
// tenta refinar: devolve { ok, broke, msg }
function tryRefine(p, en) {
  const it = ITEMS[en.id], lv = en.refine || 0;
  if (!canRefine(it)) return { ok: false, msg: 'Esse item não pode ser refinado.' };
  if (lv >= REFINE_MAX) return { ok: false, msg: 'Já está no máximo (+10).' };
  const mat = refineMat(it), cost = refineCost(it, lv), have = p.inventory.find(x => x.id === mat);
  if (!have) return { ok: false, msg: `Falta ${ITEMS[mat].name}.` };
  if (p.zeny < cost) return { ok: false, msg: `Falta zeny (${cost} z).` };
  p.zeny -= cost; removeItem(p, have, 1);
  if (Math.random() < REFINE_CHANCE[lv]) { en.refine = lv + 1; recalc(p); return { ok: true, msg: `Sucesso! ${refineName(en)}` }; }
  // falhou acima do seguro: o item quebra (some, junto com as cartas)
  for (const s of EQUIP_SLOTS) if (p.equip[s] === en) p.equip[s] = null;
  const i = p.inventory.indexOf(en); if (i >= 0) p.inventory.splice(i, 1);
  recalc(p); return { ok: false, broke: true, msg: `O refino falhou e ${it.name} se partiu...` };
}
