'use strict';
/* =========================================================================
   AÇÕES DO PERSONAGEM — compartilhadas pelo 2D e pelo 3D.
   Equipar, cartas, loja, atributos, habilidades e atalhos. Cada jogo fornece
   G.player, UI, Sound e saveGame().
   ========================================================================= */

const invByUid = uid => uid == null ? null : G.player.inventory.find(e => e.uid === uid) || null;

function equipItem(entry, p = G.player, silent = false) {
  const it = ITEMS[entry.id];
  if (!EQUIP_TYPES.includes(it.type)) return;
  if (it.type === 'arma' && !CLASSES[p.cls].weapons.includes(it.wtype)) { if (!silent) { UI.log(`${CLASSES[p.cls].name} não pode usar ${WEAPON_TYPES[it.wtype].name}.`, 'warn'); Sound.play('error'); } return; }
  if (it.lv && p.baseLv < it.lv) { if (!silent) { UI.log(`Requer nível ${it.lv}.`, 'warn'); Sound.play('error'); } return; }
  let slot = it.type;
  if (slot === 'acessorio' && p.equip.acessorio && !p.equip.acessorio2) slot = 'acessorio2'; // dois acessórios
  const curW = p.equip.arma && ITEMS[p.equip.arma.id];
  if (slot === 'escudo' && curW && TWO_HANDED.includes(curW.wtype)) { if (!silent) { UI.log(`${WEAPON_TYPES[curW.wtype].name} usa as duas mãos — não dá para usar escudo junto.`, 'warn'); Sound.play('error'); } return; }
  if (slot === 'arma' && TWO_HANDED.includes(it.wtype) && p.equip.escudo) { p.inventory.push(p.equip.escudo); p.equip.escudo = null; if (!silent) UI.log('O escudo foi guardado (arma de duas mãos).', 'item'); }
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

// personagem novo (mesmo começo no 2D e no 3D): aprendiz com adaga, túnica e itens básicos
function createCharacter(name, look = {}, petSpecies = null) {
  const p = {
    name, look, cls: 'aprendiz', baseLv: 1, jobLv: 1, baseExp: 0, jobExp: 0,
    stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, statPoints: CONFIG.STAT_START_POINTS, skillPoints: 0, skills: {},
    zeny: 150, inventory: [], equip: Object.fromEntries(EQUIP_SLOTS.map(s => [s, null])), hotbar: Array(9).fill(null),
    hp: 1, sp: 1, charId: newCharId(), buffs: {}, cds: {}, pet: petSpecies ? newPet(petSpecies) : null,
  };
  addItem(p, 'adaga_simples', 1); addItem(p, 'tunica_algodao', 1);
  addItem(p, 'maca', 10); addItem(p, 'pocao_vermelha', 3); addItem(p, 'pergaminho_retorno', 1);
  equipItem(p.inventory.find(e => e.id === 'adaga_simples'), p, true);
  equipItem(p.inventory.find(e => e.id === 'tunica_algodao'), p, true);
  p.hotbar[0] = { kind: 'item', id: 'maca' };
  p.hotbar[1] = { kind: 'item', id: 'pocao_vermelha' };
  recalc(p); p.hp = p.d.maxHp; p.sp = p.d.maxSp;
  return p;
}
