'use strict';
/* =========================================================================
   MISSÕES (S-126) — inspiradas no WoW: NPCs com "!" (missão disponível) e "?"
   (pronta para entregar), uma história principal que leva você de NPC em NPC
   e missões secundárias. A EXP é um empurrãozinho (≈ 8–20% de um nível):
   o grosso continua vindo de caçar monstros.
   Estado no save: p.quests = { active: { id: { n: [contagens] } }, done: [ids] }
   Objetivos: kill (monstro, qtd) · collect (item, qtd — entregue no fim) · talk (npc)
   ========================================================================= */
const QUESTS = {
  // ---------- História principal: "A Sombra sobre Alvorada" ----------
  mq1: { main: true, name: 'Um rosto novo em Alvorada', giver: 'teodoro', turnIn: 'bento', lv: 1,
    text: 'Então você é o novo aventureiro de quem falaram! Bem-vindo a Alvorada. Antes de mais nada, vá até o <b>Bento</b>, o mercador da praça. Ninguém sai por aquele portão sem as coisas certas na mochila.',
    done: 'Ah, foi o velho Teodoro quem mandou? Ele sempre manda os novatos para cá. Bom, deixa eu ver o que você precisa...',
    obj: [{ talk: 'bento' }], reward: { expPct: 0.5, items: [['maca', 3]], zeny: 50 } },
  mq2: { main: true, name: 'Gosma para o Bento', giver: 'bento', turnIn: 'bento', lv: 1, requires: 'mq1',
    text: 'Faço poções com a gosma das <b>Orvalhinhos</b> dos Campos de Verdelume. Traga <b>6 Gosmas</b> e eu te pago em poções. Bom treino, também!',
    done: 'Gosma de primeira! Tome, poções fresquinhas. E olha: a Dona Rosa, da taverna, anda falando de lobos na estrada.',
    obj: [{ collect: 'gosma', n: 6 }], reward: { expPct: 0.35, items: [['pocao_vermelha', 5]] } },
  mq3: { main: true, name: 'Notícias da taverna', giver: 'bento', turnIn: 'rosa', lv: 3, requires: 'mq2',
    text: 'Vá até a <b>Dona Rosa</b>, na taverna. Quem ouve as conversas dos viajantes sabe de tudo que acontece no vale.',
    done: 'Bento te mandou? Que bom. Senta, que a história não é bonita: os lobos da floresta estão vindo até a estrada.',
    obj: [{ talk: 'rosa' }], reward: { expPct: 0.15, zeny: 80 } },
  mq4: { main: true, name: 'Lobos na estrada', giver: 'rosa', turnIn: 'rosa', lv: 8, requires: 'mq3',
    text: 'Os caçadores dizem que algo assustou os lobos e eles desceram para a estrada da Floresta. Derrote <b>6 Lobos Cinzentos</b> antes que machuquem um viajante.',
    done: 'Você fez o que os guardas não conseguiram. Mas lobos não fogem à toa... Conte isso ao Ancião Teodoro.',
    obj: [{ kill: 'lobo_cinzento', n: 6 }], reward: { expPct: 0.18, zeny: 300, items: [['carne_assada', 4]] } },
  mq5: { main: true, name: 'O conselho do Ancião', giver: 'rosa', turnIn: 'teodoro', lv: 8, requires: 'mq4',
    text: 'Volte ao <b>Ancião Teodoro</b>, na praça. Ele precisa saber dos lobos.',
    done: 'Lobos fugindo para a estrada... Era o que eu temia. Algo antigo acordou nas Ruínas de Kael.',
    obj: [{ talk: 'teodoro' }], reward: { expPct: 0.1 } },
  mq6: { main: true, name: 'A mentora', giver: 'teodoro', turnIn: 'ivra', lv: 8, requires: 'mq5',
    text: 'Antes de ir às Ruínas você precisa ficar mais forte. Procure a <b>Mestra Ivra</b>: ela treina os aventureiros desta vila e vai te mostrar o caminho da sua classe.',
    done: 'Teodoro te mandou? Ele confia em você, então eu também. Treine nos campos e volte quando quiser trocar de classe. E leve isto.',
    obj: [{ talk: 'ivra' }], reward: { expPct: 0.15, items: [['pocao_azul', 3]] } },
  mq7: { main: true, name: 'Ossos que não descansam', giver: 'ivra', turnIn: 'teodoro', lv: 18, requires: 'mq6',
    text: 'Nas <b>Ruínas de Kael</b> os mortos voltaram a andar. Derrote <b>8 Esqueletos Vigias</b> e traga <b>5 Ossos</b> para o Ancião Teodoro estudar.',
    done: 'Estes ossos têm marcas de runas... das mesmas runas dos colossos de pedra do norte. Isso é mais sério do que eu pensava.',
    obj: [{ kill: 'esqueleto_vigia', n: 8 }, { collect: 'osso', n: 5 }], reward: { expPct: 0.15, zeny: 1200, items: [['elmo_de_ferro', 1]] } },
  mq8: { main: true, name: 'A caravana de Pedraclara', giver: 'teodoro', turnIn: 'bastiao', lv: 22, requires: 'mq7',
    text: 'Vá até <b>Pedraclara</b>, a cidade de pedra além das colinas, e fale com <b>Bastião</b>, o guarda do portão. Ele vigia o caminho para a Planície dos Colossos.',
    done: 'Um enviado de Alvorada! Teodoro escreveu dizendo que você viria. Temos problemas na planície.',
    obj: [{ talk: 'bastiao' }], reward: { expPct: 0.12, zeny: 500 } },
  mq9: { main: true, name: 'Os colossos despertam', giver: 'bastiao', turnIn: 'bastiao', lv: 30, requires: 'mq8',
    text: 'Os Cavaleiros Caídos marcham entre os colossos como se guardassem algo. Derrote <b>6 Cavaleiros Caídos</b> e traga <b>4 Essências Sombrias</b> das Orvalhinhos Sombrios.',
    done: 'Essas essências vêm de baixo da terra... das Catacumbas do Santuário Silente. É de lá que vem a sombra.',
    obj: [{ kill: 'cavaleiro_caido', n: 6 }, { collect: 'essencia_sombria', n: 4 }], reward: { expPct: 0.15, zeny: 3000, items: [['pocao_vermelha', 10]] } },
  mq10: { main: true, name: 'O silêncio das Catacumbas', giver: 'bastiao', turnIn: 'teodoro', lv: 45, requires: 'mq9',
    text: 'No fundo das <b>Catacumbas</b> vigia a <b>Sentinela Silente</b>. Derrote-a e leve a notícia ao Ancião Teodoro. Vá preparado, e não vá sozinho se puder evitar.',
    done: 'A Sentinela caiu! Alvorada inteira vai contar essa história por anos. Mas as runas... elas apontam para ainda mais longe. Descanse, herói. A próxima jornada vai chegar.',
    obj: [{ kill: 'sentinela_silente', n: 1 }], reward: { expPct: 0.2, zeny: 15000, items: [['anel_de_forca', 1]] } },
  // ---------- Secundárias ----------
  sq_flora: { name: 'Frutinhas do bosque', giver: 'flora', turnIn: 'flora', lv: 3,
    text: 'Minha barraca está sem frutinhas azuis! Os <b>Fungolinos</b> e os <b>Musguinhos</b> vivem escondendo elas. Me traz <b>6 Frutinhas Azuis</b>?',
    done: 'Que lindeza! Tome, umas frutas da casa e um trocado.', obj: [{ collect: 'frutinha_azul', n: 6 }], reward: { expPct: 0.12, zeny: 150, items: [['uvas', 3], ['banana', 3]] } },
  sq_tobias: { name: 'Coelhos atrevidos', giver: 'tobias', turnIn: 'tobias', lv: 4,
    text: 'Os <b>Coelhos-Chifre</b> estão furando as cercas das hortas. Derrote <b>8</b> deles nos campos, por favor.',
    done: 'As hortas agradecem. Aqui, um chapéu para o sol dos campos.', obj: [{ kill: 'coelho_chifre', n: 8 }], reward: { expPct: 0.12, zeny: 120, items: [['chapeu_de_palha', 1]] } },
  sq_clara: { name: 'Remédio de esporo', giver: 'clara', turnIn: 'clara', lv: 3,
    text: 'Os esporos dos <b>Fungolinos</b> viram um ótimo remédio quando fervidos. Traga <b>5 Esporos</b> e eu preparo umas poções para você.',
    done: 'Perfeito, ainda estão frescos. Leve estas.', obj: [{ collect: 'esporo', n: 5 }], reward: { expPct: 0.1, items: [['pocao_vermelha', 4], ['pocao_azul', 2]] } },
  sq_tome: { name: 'Mel para os cavalos', giver: 'tome', turnIn: 'tome', lv: 7,
    text: 'Os cavalos adoram um pouco de mel no feno. As <b>Abelhas Rubras</b> guardam o melhor mel do vale. Me traz <b>4 Méis</b>?',
    done: 'Olha só a alegria deles! Obrigado, amigo.', obj: [{ collect: 'mel', n: 4 }], reward: { expPct: 0.12, zeny: 400 } },
  sq_gui: { name: 'O lobo das histórias', giver: 'gui', turnIn: 'gui', lv: 20,
    text: 'Conto há trinta anos a história do <b>Lobo Alfa</b> da floresta. Dizem que ele voltou. Prove que é verdade: derrote-o e traga a <b>Presa do Alfa</b>.',
    done: 'Ha! Então era verdade! Agora tenho um final novo para a minha história, e você está nele.', obj: [{ kill: 'lobo_alfa', n: 1 }, { collect: 'presa_alfa', n: 1 }], reward: { expPct: 0.14, zeny: 1500 } },
};
const QUEST_GIVERS_NPC = { // NPC novo da história principal (S-126) — colocado na praça da vila pelo main3d
  teodoro: { id: 'teodoro', name: 'Ancião Teodoro', title: 'Guardião de Alvorada', model: 'Mage', show: ['Mage_Cape'], look: { race: 'humano', face: 'sabio', hair: { style: 'curto', color: 'grisalho' }, beard: true } },
};

function questState(p) { if (!p.quests || typeof p.quests !== 'object') p.quests = { active: {}, done: [] }; p.quests.active = p.quests.active || {}; p.quests.done = p.quests.done || []; return p.quests; }
function questProgress(p, id) { const q = QUESTS[id], st = questState(p).active[id]; if (!q || !st) return null; return q.obj.map((o, i) => { if (o.kill) return { o, have: Math.min(o.n, st.n[i] || 0), need: o.n }; if (o.collect) return { o, have: Math.min(o.n, countItem(p, o.collect)), need: o.n }; return { o, have: st.n[i] ? 1 : 0, need: 1 }; }); }
function questReady(p, id) { const pr = questProgress(p, id); return !!pr && pr.every(x => x.have >= x.need); }
function questAvailable(p, id) { const q = QUESTS[id], st = questState(p); return q && !st.active[id] && !st.done.includes(id) && (!q.requires || st.done.includes(q.requires)) && p.baseLv >= (q.lv || 1); }
function questSoon(p, id) { const q = QUESTS[id], st = questState(p); return q && !st.active[id] && !st.done.includes(id) && (!q.requires || st.done.includes(q.requires)) && p.baseLv < (q.lv || 1); }
// marcador em cima do NPC: '!' tem missão, '?' pronta, '…' em andamento (para entregar aqui), '' nada
function questMarker(p, npcId) {
  if (!p) return '';
  const st = questState(p);
  for (const id in st.active) { const q = QUESTS[id]; if (q && q.turnIn === npcId && (questReady(p, id) || questProgress(p, id).every(x => x.have >= x.need || x.o.talk === npcId))) return '?'; }
  for (const id in QUESTS) if (QUESTS[id].giver === npcId && questAvailable(p, id)) return '!';
  for (const id in st.active) { const q = QUESTS[id]; if (q && q.turnIn === npcId) return '…'; }
  return '';
}
function objText(o) { if (o.kill) return `Derrotar ${MONSTERS[o.kill] ? MONSTERS[o.kill].name : o.kill}`; if (o.collect) return `Coletar ${ITEMS[o.collect] ? ITEMS[o.collect].name : o.collect}`; return `Falar com ${QUEST_NPC_NAMES[o.talk] || o.talk}`; }
const QUEST_NPC_NAMES = { teodoro: 'Ancião Teodoro', bento: 'Bento', rosa: 'Dona Rosa', ivra: 'Mestra Ivra', bastiao: 'Bastião', flora: 'Dona Flora', tobias: 'Guarda Tobias', clara: 'Irmã Clara', tome: 'Tomé', gui: 'Velho Gui' };
function questRewardText(p, q) {
  const r = q.reward || {}, parts = [];
  const exp = questExp(q); if (exp) parts.push(`<b class="gold">${exp.toLocaleString('pt-BR')} EXP</b>`);
  if (r.zeny) parts.push(`💰 ${r.zeny.toLocaleString('pt-BR')} z`);
  for (const [id, n] of r.items || []) parts.push(`${typeof iconImg === 'function' ? iconImg(id, 'iicon sm') : ''}${ITEMS[id].name}${n > 1 ? ' ×' + n : ''}`);
  return parts.join(' · ');
}
function questExp(q) { const r = q.reward || {}; return r.expPct ? Math.max(5, Math.round(baseExpNext(Math.max(1, q.lv || 1)) * r.expPct)) : 0; }
// eventos do jogo
function questOnKill(p, monsterType) {
  const st = questState(p); let changed = false;
  for (const id in st.active) { const q = QUESTS[id]; if (!q) continue; q.obj.forEach((o, i) => { if (o.kill === monsterType && (st.active[id].n[i] || 0) < o.n) { st.active[id].n[i] = (st.active[id].n[i] || 0) + 1; changed = true; UI.log(`📜 ${q.name}: ${MONSTERS[monsterType].name} ${st.active[id].n[i]}/${o.n}`, 'sys'); if (questReady(p, id)) UI.log(`✅ ${q.name}: pronta! Volte para ${QUEST_NPC_NAMES[q.turnIn] || q.turnIn}.`, 'lvl'); } }); }
  return changed;
}
function questAccept(p, id) { const q = QUESTS[id]; questState(p).active[id] = { n: q.obj.map(() => 0) }; UI.log(`📜 Missão aceita: ${q.name}`, 'lvl'); questTalkTo(p, null); if (typeof Sound !== 'undefined') Sound.play('click'); UI.markDirty(); }
function questAbandon(p, id) { delete questState(p).active[id]; UI.log(`Missão abandonada: ${QUESTS[id].name}`, 'warn'); UI.markDirty(); }
// conversa com o NPC: marca objetivos "falar com"
function questTalkTo(p, npcId) {
  const st = questState(p);
  for (const id in st.active) QUESTS[id] && QUESTS[id].obj.forEach((o, i) => { if (o.talk && o.talk === npcId) st.active[id].n[i] = 1; });
}
function questComplete(p, id, giveExp) {
  const q = QUESTS[id], st = questState(p); if (!questReady(p, id)) return false;
  for (const o of q.obj) if (o.collect) { let need = o.n; for (const en of [...p.inventory]) { if (need <= 0) break; if (en.id !== o.collect) continue; const k = Math.min(need, en.qty); removeItem(p, en, k); need -= k; } }
  delete st.active[id]; st.done.push(id);
  const r = q.reward || {}; if (r.zeny) p.zeny += r.zeny; for (const [iid, n] of r.items || []) addItem(p, iid, n);
  UI.log(`✅ Missão concluída: ${q.name}`, 'lvl'); const exp = questExp(q); if (exp) giveExp(exp, Math.round(exp * 0.6));
  if (typeof Sound !== 'undefined') Sound.play('levelup'); UI.markDirty(); return true;
}
// opções de diálogo de missão para um NPC (o main3d mostra antes das falas normais)
function questDialog(p, npc, giveExp, fallback) {
  questTalkTo(p, npc.id);
  const st = questState(p), opts = [];
  for (const id in st.active) { const q = QUESTS[id]; if (q && q.turnIn === npc.id && questReady(p, id)) opts.push({ label: `✅ ${q.name}`, gold: true, fn: () => showQuest(p, npc, id, 'turnin', giveExp, fallback) }); }
  for (const id in QUESTS) if (QUESTS[id].giver === npc.id && questAvailable(p, id)) opts.push({ label: `${QUESTS[id].main ? '⭐' : '❗'} ${QUESTS[id].name}`, gold: true, fn: () => showQuest(p, npc, id, 'offer', giveExp, fallback) });
  for (const id in st.active) { const q = QUESTS[id]; if (q && q.turnIn === npc.id && !questReady(p, id)) opts.push({ label: `… ${q.name}`, fn: () => showQuest(p, npc, id, 'progress', giveExp, fallback) }); }
  return opts;
}
function showQuest(p, npc, id, mode, giveExp, fallback) {
  const q = QUESTS[id], objs = (mode === 'offer' ? q.obj.map(o => ({ o, have: 0, need: o.n || 1 })) : questProgress(p, id)).map(x => `<div class="q-obj ${x.have >= x.need ? 'ok' : ''}">${x.have >= x.need ? '✔' : '•'} ${objText(x.o)}${x.need > 1 ? ` <b>${x.have}/${x.need}</b>` : ''}</div>`).join('');
  const body = `<div class="q-title">${q.main ? '⭐ ' : ''}${q.name}</div><div class="q-text">${mode === 'turnin' ? q.done : q.text}</div><div class="q-sec">Objetivos</div>${objs}<div class="q-sec">Recompensa</div><div class="q-rew">${questRewardText(p, q)}</div>`;
  const back = { label: 'Voltar', fn: () => fallback() };
  if (mode === 'offer') UI.dialog(npc, body, [{ label: 'Aceitar missão', gold: true, fn: () => { questAccept(p, id); fallback(); } }, back]);
  else if (mode === 'turnin') UI.dialog(npc, body, [{ label: 'Concluir missão', gold: true, fn: () => { questComplete(p, id, giveExp); fallback(); } }, back]);
  else UI.dialog(npc, body + `<div class="muted" style="margin-top:6px">Ainda falta um pouco. Volte quando terminar.</div>`, [back]);
}
