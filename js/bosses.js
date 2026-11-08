'use strict';
/* =========================================================================
   CHEFES GRANDES (S-138) — dados extras de MONSTERS, carregado depois de data.js (só no 3D).
   Originais: inspirados apenas na *sensação* dos chefes favoritos de MMORPGs e do Skyrim.
   Visual em js3d/critters.js (formas demonking, goatmage, frostdragon, lichqueen).
   ========================================================================= */
Object.assign(ITEMS, {
  // materiais (troféus)
  brasa_do_soberano: { name: 'Brasa do Soberano', type: 'etc', icon: '🔥', price: 4200, desc: 'Ainda queima. Dizem que é um pedaço do coração de Kharzûl.' },
  chifre_negro: { name: 'Chifre Negro', type: 'etc', icon: '🦴', price: 3800, desc: 'Lasca do chifre de Maldoran. Sussurra em uma língua esquecida.' },
  escama_invernal: { name: 'Escama Invernal', type: 'etc', icon: '❄️', price: 4600, desc: 'Escama de Vharnyr. Nunca derrete, nem no fogo.' },
  lagrima_sepulcral: { name: 'Lágrima Sepulcral', type: 'etc', icon: '💠', price: 4000, desc: 'Uma alma cristalizada da Rainha Sem Túmulo.' },
  // equipamentos raros
  cutelo_de_obsidiana: { name: 'Cutelo de Obsidiana', type: 'arma', wtype: 'espada', icon: '🗡️', price: 48000, atk: 210, slots: 1, lv: 60, bonuses: { str: 5, dmgVs: { vento: 15 } }, desc: 'O fio ainda brilha como magma. Arma do Soberano das Areias Rubras.' },
  cajado_chifre_negro: { name: 'Cajado do Chifre Negro', type: 'arma', wtype: 'cajado', icon: '🪄', price: 46000, atk: 40, matk: 185, slots: 1, lv: 55, bonuses: { int: 6, matkPct: 8 }, desc: 'Velas que nunca apagam e um anel de runas que gira sozinho.' },
  arco_do_inverno: { name: 'Arco do Inverno Eterno', type: 'arma', wtype: 'arco', icon: '🏹', price: 52000, atk: 190, slots: 1, lv: 65, bonuses: { dex: 6, crit: 6, dmgVs: { fogo: 15 } }, desc: 'Feito de um osso da asa de Vharnyr. A corda é de gelo vivo.' },
  coroa_sepulcral: { name: 'Coroa Sepulcral', type: 'cabeca', icon: '👑', price: 40000, def: 6, mdef: 8, slots: 1, lv: 55, bonuses: { int: 4, matkPct: 6, resist: { sombra: 20 } }, desc: 'Coroa de ossos e gemas da Rainha Sem Túmulo.' },
});
Object.assign(MONSTERS, {
  kharzul: {
    name: 'Kharzûl, Soberano das Areias Rubras', lv: 70, hp: 160000, atk: [420, 560], def: 85, mdef: 50, exp: 240000, jexp: 180000, element: 'fogo', shape: 'demonking', color: '#3b2723',
    size: 7, speed: 55, aggressive: true, aggroRange: 14, range: 1.8, boss: true, respawn: 1800000, special: 'slam', race: 'Demônio', icon: '👹',
    drops: [['brasa_do_soberano', 1], ['cutelo_de_obsidiana', 0.12], ['pocao_azul', 1], ['anel_de_forca', 0.4]],
    card: { equip: 'arma', bonuses: { atkPct: 10, dmgVs: { vento: 20 }, str: 3 } }, cardRate: 0.03,
  },
  maldoran: {
    name: 'Maldoran, o Chifre Negro', lv: 60, hp: 110000, atk: [300, 420], def: 50, mdef: 90, exp: 150000, jexp: 115000, element: 'sombra', shape: 'goatmage', color: '#2a1838',
    size: 5.5, speed: 50, aggressive: true, aggroRange: 13, range: 6, boss: true, respawn: 1500000, race: 'Demônio', icon: '🐐',
    drops: [['chifre_negro', 1], ['cajado_chifre_negro', 0.12], ['essencia_sombria', 1], ['pocao_azul', 1]],
    card: { equip: 'armadura', bonuses: { int: 4, matkPct: 10, resist: { sombra: 15 } } }, cardRate: 0.03,
  },
  vharnyr: {
    name: 'Vharnyr, o Inverno que Anda', lv: 78, hp: 220000, atk: [480, 640], def: 95, mdef: 70, exp: 320000, jexp: 240000, element: 'agua', shape: 'frostdragon', color: '#5f86a8',
    size: 8, speed: 60, aggressive: true, aggroRange: 16, range: 4, boss: true, respawn: 2400000, special: 'slam', race: 'Dragão', icon: '🐉',
    drops: [['escama_invernal', 1], ['arco_do_inverno', 0.1], ['pocao_azul', 1], ['pocao_vermelha', 1]],
    card: { equip: 'escudo', bonuses: { resist: { agua: 30, fogo: 15 }, hpPct: 10 } }, cardRate: 0.03,
  },
  selvara: {
    name: 'Selvara, a Rainha Sem Túmulo', lv: 65, hp: 130000, atk: [340, 470], def: 45, mdef: 110, exp: 190000, jexp: 145000, element: 'sombra', shape: 'lichqueen', color: '#123a3a',
    size: 5, speed: 50, aggressive: true, aggroRange: 14, range: 7, flee: 60, boss: true, respawn: 1800000, race: 'Morto-vivo', icon: '💀',
    drops: [['lagrima_sepulcral', 1], ['coroa_sepulcral', 0.12], ['ectoplasma', 1], ['pocao_azul', 1]],
    card: { equip: 'capa', bonuses: { resist: { sombra: 25 }, int: 3, spPct: 10 } }, cardRate: 0.03,
  },
});
// mesmos valores padrão que data.js aplica aos outros monstros, e as cartas
for (const id of ['kharzul', 'maldoran', 'vharnyr', 'selvara']) {
  const m = MONSTERS[id];
  m.id = id;
  m.hit = m.hit ?? Math.round(m.lv * 1.5 + 18);
  m.flee = m.flee ?? Math.round(m.lv * 1.2 + 4);
  m.mdef = m.mdef ?? Math.floor(m.def / 2);
  m.aggroRange = m.aggroRange ?? 6;
  m.aspd = m.aspd ?? 1800;
  m.range = m.range ?? 1.2;
  if (m.card) ITEMS['carta_' + id] = { name: 'Carta ' + m.name.split(',')[0], type: 'carta', icon: '🃏', price: 20, equip: m.card.equip, bonuses: m.card.bonuses, monster: id, desc: `Encaixe em: ${SLOT_NAMES[m.card.equip]}. Uma vez inserida, não pode ser removida.` };
}
// ícones pintados (S-122), id dos itens novos e material de refino dos chefes (S-124)
const BOSS_ICONS = {
  brasa_do_soberano: ['ember', {}], chifre_negro: ['horn', {}], escama_invernal: ['crystal', { c: '#7ab8e8', c2: '#e8f8ff' }], lagrima_sepulcral: ['orb', { c: '#1a8a8a', c2: '#9affe8' }],
  cutelo_de_obsidiana: ['sword', { blade: '#3a3040', grip: '#2a1a12', guard: '#d8602a', len: 1.05 }], cajado_chifre_negro: ['staff', { wood: '#2a2030', gem: '#c05aff', ornate: true }],
  arco_do_inverno: ['bow', { wood: '#cfe8ff', glow: '#7ac8ff', big: true, tips: '#e8f8ff' }], coroa_sepulcral: ['tiara', { gem: '#3affd8' }],
};
for (const id in BOSS_ICONS) if (ITEMS[id]) ITEMS[id].iconRecipe = BOSS_ICONS[id];
for (const id in ITEMS) ITEMS[id].id = id;
for (const id of ['kharzul', 'maldoran', 'vharnyr', 'selvara']) MONSTERS[id].drops.push(['ferrolume', 0.5], ['pedra_egide', 0.6]);

/* =========================================================================
   BICHOS DAS DUNAS DE SAL-RUBRO (S-167, S-169) — visual em js3d/critters.js
   (formas cactus, saltlizard, scorpion, ant, runnerbird). Originais, só inspirados na sensação
   dos monstros clássicos de deserto.
   ========================================================================= */
Object.assign(ITEMS, {
  flor_de_mandacaru: { name: 'Flor de Mandacaru', type: 'etc', icon: '🌸', price: 180, desc: 'Flor rosada que só abre à noite. Os alquimistas pagam bem por ela.', iconRecipe: ['flowers', {}] },
  escama_de_sal: { name: 'Escama de Sal', type: 'etc', icon: '🧂', price: 260, desc: 'Escama coberta de cristais de sal do Lagarto-de-Sal.', iconRecipe: ['crystal', { c: '#e8dcc8', c2: '#ffffff' }] },
  ferrao_rubro: { name: 'Ferrão Rubro', type: 'etc', icon: '🦂', price: 240, desc: 'Ainda pinga um veneno esverdeado. Cuidado ao guardar.', iconRecipe: ['stinger', {}] },
  mandibula_ceifadora: { name: 'Mandíbula Ceifadora', type: 'etc', icon: '🐜', price: 200, desc: 'Curva como uma foice e dura como ferro.', iconRecipe: ['fang', {}] },
  pena_dourada: { name: 'Pena Dourada', type: 'etc', icon: '🪶', price: 300, desc: 'Pena macia do Trotavento. Dizem que dá sorte nas viagens.', iconRecipe: ['leaf', { c: '#e8b648' }] },
});
Object.assign(MONSTERS, {
  mandacaru: {
    name: 'Mandacaru Andarilho', lv: 29, hp: 1500, atk: [58, 76], def: 22, exp: 610, jexp: 460, element: 'terra', shape: 'cactus', color: '#5f9a3e',
    size: 1, speed: 45, aggressive: false, race: 'Planta', icon: '🌵',
    drops: [['flor_de_mandacaru', 0.45], ['broto_umido', 0.3], ['pocao_vermelha', 0.1], ['frutinha_azul', 0.15]],
    card: { equip: 'escudo', bonuses: { def: 4, resist: { vento: 10 } } },
  },
  escorpiao_rubro: {
    name: 'Escorpião-Rubro', lv: 32, hp: 1750, atk: [70, 92], def: 30, exp: 720, jexp: 540, element: 'fogo', shape: 'scorpion', color: '#8a2a1a',
    size: 1.25, speed: 62, aggressive: true, aggroRange: 6, race: 'Inseto', icon: '🦂',
    drops: [['ferrao_rubro', 0.45], ['brasa_viva', 0.2], ['pocao_vermelha', 0.12], ['adaga_afiada', 0.01]],
    card: { equip: 'arma', bonuses: { atk: 10, dmgVs: { terra: 10 } } },
  },
  formiga_ceifadora: {
    name: 'Formiga Ceifadora', lv: 27, hp: 1200, atk: [55, 72], def: 26, exp: 540, jexp: 400, element: 'terra', shape: 'ant', color: '#6a2414',
    size: 1.35, speed: 70, aggressive: true, aggroRange: 5, race: 'Inseto', icon: '🐜',
    drops: [['mandibula_ceifadora', 0.45], ['fragmento_ferro', 0.15], ['pocao_vermelha', 0.1]],
    card: { equip: 'botas', bonuses: { agi: 2, flee: 5 } },
  },
  lagarto_sal: {
    name: 'Lagarto-de-Sal', lv: 36, hp: 2300, atk: [82, 108], def: 34, exp: 960, jexp: 720, element: 'terra', shape: 'saltlizard', color: '#c9a06a',
    size: 1.25, speed: 58, aggressive: true, aggroRange: 6, race: 'Fera', icon: '🦎',
    drops: [['escama_de_sal', 0.45], ['carne_assada', 0.3], ['pocao_azul', 0.05], ['colete_couro', 0.02]],
    card: { equip: 'armadura', bonuses: { def: 5, resist: { fogo: 10 } } },
  },
  trotavento_selvagem: {
    name: 'Trotavento Selvagem', lv: 34, hp: 2000, atk: [76, 98], def: 24, exp: 840, jexp: 630, element: 'vento', shape: 'runnerbird', color: '#c9a066',
    size: 0.85, speed: 85, aggressive: false, race: 'Fera', icon: '🐦', flee: 70,
    drops: [['pena_dourada', 0.5], ['carne_assada', 0.35], ['faixa_de_penas', 0.02]],
    card: { equip: 'capa', bonuses: { agi: 3, aspdPct: 3 } },
  },
});
for (const id of ['mandacaru', 'escorpiao_rubro', 'formiga_ceifadora', 'lagarto_sal', 'trotavento_selvagem']) {
  const m = MONSTERS[id];
  m.id = id;
  m.hit = m.hit ?? Math.round(m.lv * 1.5 + 18);
  m.flee = m.flee ?? Math.round(m.lv * 1.2 + 4);
  m.mdef = m.mdef ?? Math.floor(m.def / 2);
  m.aggroRange = m.aggroRange ?? 6;
  m.aspd = m.aspd ?? 1500;
  m.range = m.range ?? 1.2;
  m.drops.push(['ferrolume', 0.025], ['pedra_egide', 0.03]);
  if (m.card) ITEMS['carta_' + id] = { name: 'Carta ' + m.name, type: 'carta', icon: '🃏', price: 20, equip: m.card.equip, bonuses: m.card.bonuses, monster: id, desc: `Encaixe em: ${SLOT_NAMES[m.card.equip]}. Uma vez inserida, não pode ser removida.` };
}
for (const id in ITEMS) ITEMS[id].id = id;
