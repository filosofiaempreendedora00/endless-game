'use strict';
/* =========================================================================
   MISSÕES (S-126) — inspiradas no WoW: NPCs com "!" (missão disponível) e "?"
   (pronta para entregar), uma história principal que leva você de NPC em NPC
   e missões secundárias. A EXP é um empurrãozinho (≈ 8–20% de um nível):
   o grosso continua vindo de caçar monstros.
   Estado no save: p.quests = { active: { id: { n: [contagens] } }, done: [ids] }
   Objetivos: kill (monstro, qtd) · collect (item, qtd — entregue no fim) · talk (npc)
              · goto (lugar: x, z, r, label; mapX/mapZ = onde marcar no mapa se o lugar for uma sala) — P-008
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
  // ---------- P-008: "A Lenda dos Que Dormem de Pé" — leva do vale às Dunas, aos Colossos, ao Santuário e às Catacumbas ----------
  lc1: { name: 'A canção das pedras', giver: 'teodoro', turnIn: 'isis', lv: 18, requires: 'mq6', chain: 'Lenda dos Colossos',
    text: 'Quando eu era menino, as avós cantavam sobre os <b>Que Dormem de Pé</b>: gigantes de pedra que se ajoelharam para vigiar alguma coisa debaixo da terra. Quem ainda sabe a canção inteira é a <b>Ísis</b>, mercadora de <b>Pedraclara</b>. As caravanas dela cruzam as Dunas há anos.',
    done: 'Teodoro ainda lembra dessa canção? Então ele também sente: a areia anda inquieta. Sente-se, vou te contar o que as caravanas viram.',
    obj: [{ talk: 'isis' }], reward: { expPct: 0.1, zeny: 300 } },
  lc2: { name: 'Sal nas pegadas', giver: 'isis', turnIn: 'isis', lv: 22, requires: 'lc1', chain: 'Lenda dos Colossos',
    text: 'Minha última caravana voltou sem um dos guias. Acharam só as pegadas dele indo para o <b>coração das Dunas de Sal-Rubro</b>, e escorpiões por toda parte. Vá até lá, derrote <b>5 Escorpiões Rubros</b> e veja o que ele estava procurando.',
    done: 'Um caco de pedra polida... com a mesma runa que está esculpida no peito do Rei de Pedra, lá na planície. O guia achou um pedaço de um colosso no meio do deserto. Como ele veio parar aqui?',
    obj: [{ goto: 'dunas', x: 10, z: 292, r: 26, label: 'o coração das Dunas de Sal-Rubro' }, { kill: 'escorpiao_rubro', n: 5 }], reward: { expPct: 0.14, zeny: 900, items: [['pocao_vermelha', 6]] } },
  lc3: { name: 'O caco e a coroa', giver: 'isis', turnIn: 'bastiao', lv: 24, requires: 'lc2', chain: 'Lenda dos Colossos',
    text: 'Leve o caco até o <b>Rei de Pedra</b>, o colosso sentado no trono das <b>Ruínas dos Colossos</b>, e compare as runas. Depois conte ao <b>Bastião</b>, no portão de Pedraclara: ele cuida da estrada da planície.',
    done: 'O caco encaixou na coroa do Rei? Então alguém está QUEBRANDO os colossos e levando os pedaços para longe... Ninguém faz isso por acaso.',
    obj: [{ goto: 'rei', x: 78, z: -340, r: 16, label: 'o Rei de Pedra no trono' }], reward: { expPct: 0.12, zeny: 1200, items: [['ferrolume', 1]] } },
  lc4: { name: 'Onde os gigantes enterram os seus', giver: 'bastiao', turnIn: 'bastiao', lv: 28, requires: 'lc3', chain: 'Lenda dos Colossos',
    text: 'Os antigos diziam que, antes dos colossos, havia feras do tamanho de torres. A <b>grande ossada de presas</b>, perto da montanha, é o que sobrou de uma delas. As <b>Orvalhinhos Sombrios</b> se juntam lá como moscas. Vá até a ossada e derrote <b>6</b> delas.',
    done: 'Então as sombras se juntam onde a terra guarda mortos antigos... e o caminho de pedra que sai dali leva direto ao Santuário Silente. Está tudo ligado.',
    obj: [{ goto: 'ossada', x: -124, z: -378, r: 18, label: 'a grande ossada de presas' }, { kill: 'gotinha_sombria', n: 6 }], reward: { expPct: 0.14, zeny: 2500, items: [['pedra_egide', 1]] } },
  lc5: { name: 'A porta que não faz barulho', giver: 'bastiao', turnIn: 'teodoro', lv: 30, requires: 'lc4', chain: 'Lenda dos Colossos',
    text: 'No fim da calçada antiga, encravado na montanha, fica o <b>Santuário Silente</b>. Dizem que lá dentro nem os passos fazem barulho. Entre e desça ao <b>1º andar das Catacumbas</b>: é de lá que os colossos tentam nos proteger. Depois volte ao Ancião Teodoro e conte o que viu.',
    done: 'Você desceu às Catacumbas e voltou para contar... Então a canção estava certa: os Que Dormem de Pé não dormem. Eles VIGIAM. E alguém lá embaixo quer que eles caiam. Guarde estas coisas: você vai precisar.',
    obj: [{ goto: 'santuario', x: 0, z: -392, r: 16, label: 'o Santuário Silente' }, { goto: 'catacumbas', x: 1500, z: 0, r: 40, mapX: 0, mapZ: -392, label: 'o 1º andar das Catacumbas' }], reward: { expPct: 0.16, zeny: 4000, items: [['pocao_azul', 5], ['ferrolume', 1], ['pedra_egide', 1]] } },
  // ---------- Aelindra: "O sono de Sylvaren" (2026-11-13, Cidade das Copas) ----------
  ec1: { name: 'Um convite do Conselho', giver: 'thalion', turnIn: 'aranel', lv: 18, chain: 'O sono de Sylvaren',
    text: 'Você subiu até o Mirante sem tropeçar, então talvez sirva. Sylvaren anda sonhando mal, e quem lê os sonhos dela é a <b>Arquivista Aranel</b>. Atravesse a ponte para o <b>Bairro do Saber</b> (a árvore-irmã do sudeste) e procure a <b>Biblioteca das Copas</b>.',
    done: 'O Ancião Thalion mandou um humano? Os tempos mudaram mesmo... Sente-se. Os sonhos de Sylvaren andam cheios de raízes partidas.',
    obj: [{ talk: 'aranel' }], reward: { expPct: 0.1, zeny: 300 } },
  ec2: { name: 'Orvalho da Fonte', giver: 'aranel', turnIn: 'naerith', lv: 18, requires: 'ec1', chain: 'O sono de Sylvaren',
    text: 'Para entender um sonho, a gente pergunta à água que a árvore bebe. Desça até a <b>Fonte da Lua</b> e olhe o reflexo do cristal. Depois leve o que viu à <b>druida Naerith</b>, na porta das raízes, ao norte do tronco.',
    done: 'Você viu raízes rasgadas no reflexo? Então não é só um sonho. Alguma coisa está arrancando as raízes mais longas de Sylvaren, lá para o leste.',
    obj: [{ goto: 'fonte_da_lua', x: 286, z: -266, r: 7, label: 'a Fonte da Lua' }, { talk: 'naerith' }], reward: { expPct: 0.12, zeny: 600, items: [['frutinha_azul', 4]] } },
  ec3: { name: 'Raízes arrancadas', giver: 'naerith', turnIn: 'aranel', lv: 26, requires: 'ec2', chain: 'O sono de Sylvaren',
    text: 'As raízes de Sylvaren vão até a <b>Mata das Araras</b>, a leste. O capitão Sylvar diz que os <b>Golens de Musgo</b> as estão arrancando para comer a seiva. Derrote <b>3 Golens de Musgo</b> e traga <b>4 Pedras de Musgo</b> para a Arquivista ver de onde eles vieram.',
    done: 'Pedra de musgo com veios de seiva viva... Os golens não acordaram sozinhos: alguém os mandou. Vou registrar isto nas Crônicas das Folhas. Sylvaren já sonha mais tranquila, graças a você. Leve este manto: as penas são da copa, e o vento delas ainda vai te reconhecer.',
    obj: [{ kill: 'golem_musgo', n: 3 }, { collect: 'pedra_musgo', n: 4 }], reward: { expPct: 0.16, zeny: 2500, items: [['manto_penas', 1], ['pocao_azul', 4]] } },
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
function objText(o) { if (o.goto) return `Ir até ${o.label || o.goto}`; if (o.kill) return `Derrotar ${MONSTERS[o.kill] ? MONSTERS[o.kill].name : o.kill}`; if (o.collect) return `Coletar ${ITEMS[o.collect] ? ITEMS[o.collect].name : o.collect}`; return `Falar com ${QUEST_NPC_NAMES[o.talk] || o.talk}`; }
const QUEST_NPC_NAMES = { thalion: 'Ancião Thalion', aranel: 'Arquivista Aranel', naerith: 'Naerith', isis: 'Ísis', teodoro: 'Ancião Teodoro', bento: 'Bento', rosa: 'Dona Rosa', ivra: 'Mestra Ivra', bastiao: 'Bastião', flora: 'Dona Flora', tobias: 'Guarda Tobias', clara: 'Irmã Clara', tome: 'Tomé', gui: 'Velho Gui' };
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
// P-008: objetivo "ir até" — o main3d chama a cada meio segundo com a posição do jogador
function questOnMove(p, x, z) {
  const st = questState(p); let changed = false;
  for (const id in st.active) { const q = QUESTS[id]; if (!q) continue; q.obj.forEach((o, i) => {
    if (!o.goto || st.active[id].n[i]) return;
    if (Math.hypot(x - o.x, z - o.z) <= (o.r || 15)) { st.active[id].n[i] = 1; changed = true; UI.log(`📍 ${q.name}: lugar alcançado — ${o.label || o.goto}.`, 'sys'); if (questReady(p, id)) UI.log(`✅ ${q.name}: pronta! Volte para ${QUEST_NPC_NAMES[q.turnIn] || q.turnIn}.`, 'lvl'); }
  }); }
  if (changed) UI.markDirty();
  return changed;
}
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
