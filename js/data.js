'use strict';
/* =========================================================================
   DADOS DO JOGO — tudo que define o "conteúdo" mora aqui.
   Para criar classes, habilidades, itens, monstros ou mapas novos,
   normalmente basta editar este arquivo.
   ========================================================================= */

const GAME_TITLE = 'Crônicas de Aethra';
const GAME_VERSION = '0.2.0 (mundo 3D)';
const SAVE_KEY = 'aethra_save_v1';

const CONFIG = {
  TILE: 32,
  EXP_RATE: 3,            // "taxa" de experiência (estilo servidor). 1 = lento e clássico.
  DROP_RATE: 1,
  CARD_DROP_RATE: 0.012,  // chance base de carta em monstros comuns (1,2%)
  JOB_CHANGE_1: 10,       // Nv. de Classe necessário para a 1ª classe
  JOB_CHANGE_2: 30,       // Nv. de Classe necessário para a 2ª classe
  MAX_BASE_LV: 99,
  MAX_JOB_LV: [10, 50, 50],
  STAT_START_POINTS: 48,
  RESPAWN_MIN: 8, RESPAWN_MAX: 15, // segundos
  DROP_LIFETIME: 90,
};

const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
const STAT_INFO = {
  str: { n: 'FOR', full: 'Força', d: 'Aumenta o ATQ corpo a corpo.' },
  agi: { n: 'AGI', full: 'Agilidade', d: 'Aumenta a velocidade de ataque e a Esquiva.' },
  vit: { n: 'VIT', full: 'Vitalidade', d: 'Aumenta HP máximo, DEF e regeneração de HP.' },
  int: { n: 'INT', full: 'Inteligência', d: 'Aumenta ATQ mágico, SP máximo e DEF mágica.' },
  dex: { n: 'DES', full: 'Destreza', d: 'Aumenta Precisão, ATQ à distância e reduz conjuração.' },
  luk: { n: 'SOR', full: 'Sorte', d: 'Aumenta a chance de crítico e um pouco de ATQ.' },
};

/* ---------------- Elementos ---------------- */
const ELEMENTS = {
  neutro: { name: 'Neutro', color: '#d9d9d9' },
  fogo: { name: 'Fogo', color: '#ff6a3d' },
  agua: { name: 'Água', color: '#4aa3ff' },
  terra: { name: 'Terra', color: '#c49a55' },
  vento: { name: 'Vento', color: '#a6ec7c' },
  sombra: { name: 'Sombra', color: '#a77bff' },
  sagrado: { name: 'Sagrado', color: '#ffe680' },
};
// atacante -> elemento contra o qual é forte
const ELEMENT_STRONG = { agua: 'fogo', fogo: 'terra', terra: 'vento', vento: 'agua', sagrado: 'sombra', sombra: 'sagrado' };
function elementMult(atk, def) {
  if (!atk || !def || atk === 'neutro' || def === 'neutro') return 1;
  if (ELEMENT_STRONG[atk] === def) return 1.5;
  if (ELEMENT_STRONG[def] === atk) return 0.6;
  if (atk === def) return 0.5;
  return 1;
}

/* ---------------- Armas ---------------- */
const WEAPON_TYPES = {
  mao: { name: 'Desarmado', range: 1.4, delay: 0.9 },
  adaga: { name: 'Adaga', range: 1.5, delay: 0.85 },
  espada: { name: 'Espada', range: 1.6, delay: 1.0 },
  lanca: { name: 'Lança', range: 2.3, delay: 1.1 },
  cajado: { name: 'Cajado', range: 4.5, delay: 1.15, magic: true }, // dispara um projétil arcano (alcance menor que o arco)
  arco: { name: 'Arco', range: 6, delay: 1.05 },
  garra: { name: 'Garras', range: 1.4, delay: 0.75 },
  instrumento: { name: 'Instrumento', range: 5, delay: 0.95, sonic: true, ranged: true }, // S-324: Bardo — dedilha e a onda sonora sai do instrumento (usa DES, como o arco)
  katar: { name: 'Katar', range: 1.4, delay: 0.7 }, // punhal de soco em par (Executor): golpes curtos e muito rápidos
  besta: { name: 'Besta', range: 5.5, delay: 1.3, ranged: true }, // S-325: Caçador — virote pesado: mira no ombro, disparo com recuo e recarga
};
// tipos de equipamento (o que cada item é)
const SLOT_NAMES = { cabeca: 'Cabeça (topo)', rosto: 'Cabeça (meio)', boca: 'Cabeça (baixo)', armadura: 'Armadura', arma: 'Arma', escudo: 'Escudo', capa: 'Capa', botas: 'Botas', acessorio: 'Acessório' };
const EQUIP_TYPES = Object.keys(SLOT_NAMES);
// espaços do personagem (dois acessórios). Saves antigos sem os espaços novos continuam valendo.
const EQUIP_SLOTS = [...EQUIP_TYPES, 'acessorio2'];
const slotType = s => (s === 'acessorio2' ? 'acessorio' : s);
const SLOT_LABELS = { ...SLOT_NAMES, acessorio: 'Acessório 1', acessorio2: 'Acessório 2' };
const TWO_HANDED = ['arco', 'katar', 'instrumento', 'besta']; // armas de duas mãos não deixam usar escudo

/* ---------------- Classes (carreira em Y) ---------------- */
const CLASSES = {
  aprendiz: {
    name: 'Aprendiz', tier: 0, parent: null, icon: '🌱', color: '#b89a6a', accent: '#e8d7b0',
    hpMod: 1.0, spMod: 1.0, weapons: ['adaga'], skills: ['primeiros_socorros', 'treino_basico'],
    next: ['guerreiro', 'mago', 'arqueiro', 'ladino'],
    desc: 'Todo aventureiro começa aqui. Aprende o básico da sobrevivência antes de escolher um caminho.',
  },
  guerreiro: {
    name: 'Guerreiro', tier: 1, parent: 'aprendiz', icon: '⚔️', color: '#b8433a', accent: '#e0b04a', hat: 'bandana',
    hpMod: 1.7, spMod: 0.8, weapons: ['adaga', 'espada', 'lanca'], skills: ['golpe_poderoso', 'impacto_sismico', 'vigor'],
    next: ['cavaleiro_runico', 'guardiao_sagrado'], gift: [['espada_curta', 1], ['pocao_vermelha', 5]],
    desc: 'Linha de frente. Muito HP, dano físico corpo a corpo e golpes em área.',
  },
  mago: {
    name: 'Mago', tier: 1, parent: 'aprendiz', icon: '🔮', color: '#4a4fb8', accent: '#9fd0ff', hat: 'wizard', robe: true,
    hpMod: 0.8, spMod: 1.9, weapons: ['adaga', 'cajado'], skills: ['seta_de_fogo', 'lanca_de_gelo', 'faisca', 'barreira_arcana', 'meditacao'],
    next: ['arquimago', 'sabio_elemental'], gift: [['cajado_de_salgueiro', 1], ['frutinha_azul', 8]],
    desc: 'Domina os elementos. Dano mágico alto à distância, mas frágil. Explore as fraquezas elementais.',
  },
  arqueiro: {
    name: 'Arqueiro', tier: 1, parent: 'aprendiz', icon: '🏹', color: '#3f8a45', accent: '#c8e07a', hat: 'feather',
    hpMod: 1.1, spMod: 1.1, weapons: ['adaga', 'arco'], skills: ['disparo_duplo', 'chuva_de_flechas', 'olho_de_aguia'],
    next: ['cacador', 'menestrel'], gift: [['arco_curto', 1], ['pocao_vermelha', 5]],
    desc: 'Ataca de longe com precisão. Usa DES como atributo principal de dano.',
  },
  ladino: {
    name: 'Ladino', tier: 1, parent: 'aprendiz', icon: '🗡️', color: '#4a4a55', accent: '#c070e0', hat: 'hood',
    hpMod: 1.25, spMod: 0.9, weapons: ['adaga', 'espada', 'garra'], skills: ['lamina_envenenada', 'golpe_duplo', 'esquiva'],
    next: ['lamina_sombria', 'saqueador'], gift: [['adaga_simples', 1], ['pocao_vermelha', 8]],
    desc: 'Rápido e evasivo. Ataques duplos, veneno e muita esquiva.',
  },
  cavaleiro_runico: {
    name: 'Cavaleiro', tier: 2, parent: 'guerreiro', icon: '⚜️', color: '#8e2f2f', accent: '#ffcf5a', hat: 'helm', cape: true,
    hpMod: 2.1, spMod: 0.9, skills: ['lamina_runica', 'furia_de_batalha', 'montaria_de_guerra'], next: [], gift: [['espada_longa', 1]],
    desc: 'Guerreiro que grava runas na lâmina. Dano físico devastador em um único alvo.',
  },
  guardiao_sagrado: {
    name: 'Paladino', tier: 2, parent: 'guerreiro', icon: '🛡️', color: '#d8d2c0', accent: '#e8c040', hat: 'helm', cape: true,
    hpMod: 2.2, spMod: 1.1, skills: ['julgamento', 'escudo_sagrado', 'montaria_de_guerra'], next: [], gift: [['elmo_de_ferro', 1]],
    desc: 'Paladino da luz: armadura branca e dourada, escudo abençoado e asas de luz. Resistente ao extremo, com dano Sagrado em área — perfeito contra Sombra.',
  },
  arquimago: {
    name: 'Arquimago', tier: 2, parent: 'mago', icon: '☄️', color: '#5b2a8a', accent: '#ff9a3d', hat: 'wizard', robe: true, cape: true,
    hpMod: 0.9, spMod: 2.4, skills: ['bola_de_fogo', 'meteoro', 'nevasca', 'tempestade'], next: [], gift: [['cajado_arcano', 1]],
    desc: 'Mestre da destruição em área. Conjurações longas, efeitos colossais.',
  },
  sabio_elemental: {
    name: 'Sábio Elemental', tier: 2, parent: 'mago', icon: '📖', color: '#2f6b6b', accent: '#9be3c8', hat: 'wizard', robe: true,
    hpMod: 1.0, spMod: 2.2, skills: ['pilar_de_terra', 'runa_de_fogo', 'cura_maior'], next: [], gift: [['manto_arcano', 1]],
    desc: 'Estudioso equilibrado: magia de Terra que atordoa e cura poderosa. Sobrevive sozinho.',
  },
  cacador: {
    name: 'Caçador', tier: 2, parent: 'arqueiro', icon: '🦅', color: '#5a6b2f', accent: '#e0c070', hat: 'feather', cape: true,
    hpMod: 1.3, spMod: 1.2, weapons: ['adaga', 'arco', 'besta'], skills: ['flecha_explosiva', 'falcao'], next: [], gift: [['arco_composto', 1]],
    desc: 'Rastreador das matas com arco ou besta e um lobo gigante como fiel escudeiro, que caça junto com você.',
  },
  menestrel: {
    name: 'Bardo', tier: 2, parent: 'arqueiro', icon: '🎵', color: '#2f4f8e', accent: '#ffb3d9', hat: 'feather',
    hpMod: 1.3, spMod: 1.4, weapons: ['adaga', 'arco', 'instrumento'], skills: ['cancao_de_batalha', 'nota_dissonante'], next: [], gift: [['alaude_de_viajante', 1], ['brinco_sabio', 1]], // S-324: arco OU instrumento, como no RO
    desc: 'Bardo errante com alaúde e chapéu de pena. Canções que fortalecem e notas que atordoam inimigos ao redor.',
  },
  lamina_sombria: {
    name: 'Executor', tier: 2, parent: 'ladino', icon: '🌑', color: '#2a2233', accent: '#9a6bff', hat: 'hood', cape: true,
    hpMod: 1.5, spMod: 1.0, weapons: ['adaga', 'espada', 'garra', 'katar'], skills: ['golpe_sombrio', 'danca_das_laminas'], next: [], gift: [['katar_de_ferro', 1]],
    desc: 'Assassino das sombras. Críticos garantidos e uma dança de lâminas mortal.',
  },
  saqueador: {
    name: 'Gatuno-Mestre', tier: 2, parent: 'ladino', icon: '💰', color: '#6b4a2f', accent: '#c8302a', hat: 'hood', // S-321: era "Arruaceiro" (o id saqueador continua)
    hpMod: 1.5, spMod: 1.0, skills: ['roubar', 'golpe_traicoeiro'], next: [], gift: [['espada_curta', 1], ['adaga_afiada', 1]],
    desc: 'Mercenário das estradas: sabre numa mão e adaga na outra, capuz caído nas costas. Rouba dos monstros e golpeia com traição baseada em Agilidade.',
  },
};
// classes de 2º nível herdam as armas do pai
for (const id in CLASSES) { const c = CLASSES[id]; if (!c.weapons) c.weapons = CLASSES[c.parent].weapons; }

/* ---------------- Habilidades ----------------
   type: 'active' | 'passive'
   target: 'self' | 'enemy' | 'ground' | 'selfAoe'
   effect.kind: 'damage' | 'heal' | 'buff' | 'steal'
------------------------------------------------- */
const SKILLS = {
  // Aprendiz
  primeiros_socorros: {
    name: 'Primeiros Socorros', icon: '🩹', type: 'active', target: 'self', maxLv: 1, sp: () => 3, cd: 1000, fx: 'heal',
    effect: { kind: 'heal', amount: (lv, p) => 12 + p.baseLv * 2 }, desc: lv => 'Recupera um pouco de HP.',
  },
  treino_basico: {
    name: 'Treino Básico', icon: '📘', type: 'passive', maxLv: 8,
    bonuses: lv => ({ atk: lv * 2, hpPct: lv }), desc: lv => `+${lv * 2} ATQ e +${lv}% HP máx.`,
  },
  // Guerreiro
  golpe_poderoso: {
    name: 'Golpe Poderoso', icon: '💥', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: lv => 6 + lv, cd: 400, fx: 'slash',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 1.3 + lv * 0.3, hitBonus: lv => lv * 5 },
    desc: lv => `Golpe com ${Math.round((1.3 + lv * 0.3) * 100)}% de dano e +${lv * 5} de precisão.`,
  },
  impacto_sismico: {
    name: 'Impacto Sísmico', icon: '🌋', type: 'active', target: 'selfAoe', maxLv: 10, sp: lv => 10 + lv, cd: 2000, fx: 'quake',
    effect: { kind: 'damage', dmg: 'phys', element: 'terra', mult: lv => 1.2 + lv * 0.15, radius: 2.5, status: { type: 'stun', chance: lv => 0.05 + lv * 0.02, dur: 2000 } },
    desc: lv => `Golpeia o chão: ${Math.round((1.2 + lv * 0.15) * 100)}% de dano de Terra ao redor, ${5 + lv * 2}% de atordoar.`,
  },
  vigor: {
    name: 'Vigor', icon: '❤️‍🔥', type: 'passive', maxLv: 10,
    bonuses: lv => ({ hpPct: lv * 2, hpRegen: lv * 3 }), desc: lv => `+${lv * 2}% HP máx e +${lv * 3} de regeneração de HP.`,
  },
  // Mago
  seta_de_fogo: {
    name: 'Rajada de Fogo', icon: '🔥', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 10 + lv * 2, cast: lv => 500 + lv * 60, cd: 600, fx: 'bolt',
    effect: { kind: 'damage', dmg: 'magic', element: 'fogo', mult: lv => 1.4 + lv * 0.3, hits: () => 1 },
    desc: lv => `Uma bola de fogo certeira: ${Math.round((1.4 + lv * 0.3) * 100)}% ATQM de Fogo.`,
  },
  lanca_de_gelo: {
    name: 'Estilhaço de Gelo', icon: '❄️', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 10 + lv, cast: () => 700, cd: 1000, fx: 'bolt',
    effect: { kind: 'damage', dmg: 'magic', element: 'agua', mult: lv => 1 + lv * 0.25, status: { type: 'freeze', chance: lv => 0.25 + lv * 0.04, dur: 3000 } },
    desc: lv => `${Math.round((1 + lv * 0.25) * 100)}% ATQM de Água, ${25 + lv * 4}% de congelar.`,
  },
  faisca: {
    name: 'Relâmpago', icon: '⚡', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 12 + lv, cast: () => 300, cd: 900, fx: 'lightning',
    effect: { kind: 'damage', dmg: 'magic', element: 'vento', mult: lv => 0.7 + lv * 0.15, hits: lv => 2 + Math.floor(lv / 3) },
    desc: lv => `Conjuração rápida: ${2 + Math.floor(lv / 3)} raios seguidos, ${Math.round((0.7 + lv * 0.15) * 100)}% ATQM de Vento cada.`,
  },
  barreira_arcana: {
    name: 'Barreira Arcana', icon: '🔮', type: 'active', target: 'self', maxLv: 5, sp: lv => 20 + lv * 4, cast: () => 300, cd: 2000, fx: 'aura', fxColor: '#8fb8ff',
    effect: { kind: 'buff', dur: 40000, bonuses: lv => ({ mdef: lv * 6, def: lv * 4 }) },
    desc: lv => `Escudo mágico por 40 s: +${lv * 6} DEF Mágica e +${lv * 4} DEF.`,
  },
  meditacao: {
    name: 'Meditação', icon: '🧘', type: 'passive', maxLv: 10,
    bonuses: lv => ({ spRegen: lv * 2, matkPct: lv * 2, spPct: lv }), desc: lv => `+${lv * 2}% ATQM, +${lv}% SP máx, +${lv * 2} regen. de SP.`,
  },
  // Arqueiro
  disparo_duplo: {
    name: 'Disparo Duplo', icon: '🎯', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: () => 12, cd: 300, fx: 'arrow',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 0.9 + lv * 0.1, hits: () => 2 },
    desc: lv => `Duas flechas com ${Math.round((0.9 + lv * 0.1) * 100)}% de dano cada.`,
  },
  chuva_de_flechas: {
    name: 'Chuva de Flechas', icon: '🌧️', type: 'active', target: 'ground', maxLv: 10, range: 9, sp: lv => 15 + lv, cd: 1200, fx: 'arrowrain',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 0.8 + lv * 0.2, hits: () => 3, radius: 2 },
    desc: lv => `3 ondas de flechas numa área, ${Math.round((0.8 + lv * 0.2) * 100)}% de dano cada.`,
  },
  olho_de_aguia: {
    name: 'Olho de Águia', icon: '🦉', type: 'passive', maxLv: 10,
    bonuses: lv => ({ dex: lv, hit: lv, range: Math.floor(lv / 2) }), desc: lv => `+${lv} DES, +${lv} Precisão, +${Math.floor(lv / 2)} de alcance com arcos.`,
  },
  // Ladino
  lamina_envenenada: {
    name: 'Lâmina Envenenada', icon: '🧪', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: () => 12, cd: 500, fx: 'poison',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 1 + lv * 0.15, status: { type: 'poison', chance: lv => 0.2 + lv * 0.05, dur: 8000 } },
    desc: lv => `${Math.round((1 + lv * 0.15) * 100)}% de dano e ${20 + lv * 5}% de envenenar.`,
  },
  golpe_duplo: {
    name: 'Golpe Duplo', icon: '✌️', type: 'passive', maxLv: 10,
    bonuses: lv => ({ doubleAttack: lv * 5 }), desc: lv => `${lv * 5}% de chance de atacar duas vezes.`,
  },
  esquiva: {
    name: 'Esquiva', icon: '💨', type: 'passive', maxLv: 10,
    bonuses: lv => ({ flee: lv * 3, moveSpeedPct: lv }), desc: lv => `+${lv * 3} Esquiva e +${lv}% de velocidade de movimento.`,
  },
  // Cavaleiro Rúnico
  // S-203: Cavaleiro e Paladino montam o Trotavento de guerra (ave corredora) — dá para lutar montado; montaria comum fica bloqueada enquanto isso
  montaria_de_guerra: {
    name: 'Montaria de Guerra', icon: '🐦', type: 'active', target: 'self', maxLv: 1, sp: () => 20, cd: 3000, fx: 'aura', fxColor: '#ffcf5a',
    effect: { kind: 'warmount' }, desc: () => 'Chama (ou dispensa) o seu Trotavento de guerra: luta montado, anda 25% mais rápido e não cai da sela ao atacar. Enquanto montado nele, a montaria comum (M) fica bloqueada.',
  },
  lamina_runica: {
    name: 'Lâmina Rúnica', icon: '🗡️', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: lv => 18 + lv * 2, cd: 800, fx: 'runic',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 2 + lv * 0.4, ignoreDef: 0.5 },
    desc: lv => `${Math.round((2 + lv * 0.4) * 100)}% de dano, ignora 50% da DEF.`,
  },
  furia_de_batalha: {
    name: 'Fúria de Batalha', icon: '😤', type: 'active', target: 'self', maxLv: 5, sp: () => 30, cd: 1000, fx: 'aura', fxColor: '#ff5a3d',
    effect: { kind: 'buff', dur: 60000, bonuses: lv => ({ atkPct: lv * 5, aspdPct: lv * 4 }) },
    desc: lv => `Por 60s: +${lv * 5}% ATQ e +${lv * 4}% vel. de ataque.`,
  },
  // Paladino (id interno: guardiao_sagrado)
  julgamento: {
    name: 'Julgamento', icon: '🌟', type: 'active', target: 'selfAoe', maxLv: 10, sp: () => 25, cd: 1500, fx: 'holy',
    effect: { kind: 'damage', dmg: 'phys', element: 'sagrado', mult: lv => 1.5 + lv * 0.3, radius: 3 },
    desc: lv => `Luz sagrada ao redor: ${Math.round((1.5 + lv * 0.3) * 100)}% de dano Sagrado.`,
  },
  escudo_sagrado: {
    name: 'Escudo Sagrado', icon: '🛡️', type: 'active', target: 'self', maxLv: 5, sp: () => 30, cd: 1000, fx: 'aura', fxColor: '#ffe680',
    effect: { kind: 'buff', dur: 90000, bonuses: lv => ({ def: lv * 8, mdef: lv * 5, hpRegen: lv * 5 }) },
    desc: lv => `Por 90s: +${lv * 8} DEF, +${lv * 5} DEFM, +${lv * 5} regen. de HP.`,
  },
  // Arquimago
  meteoro: {
    name: 'Chuva de Meteoros', icon: '☄️', type: 'active', target: 'ground', maxLv: 10, range: 9, sp: lv => 40 + lv * 5, cast: () => 2600, cd: 2500, fx: 'meteor',
    effect: { kind: 'damage', dmg: 'magic', element: 'fogo', mult: lv => 1.5 + lv * 0.4, hits: () => 3, radius: 2.5 },
    desc: lv => `3 meteoros numa área: ${Math.round((1.5 + lv * 0.4) * 100)}% ATQM de Fogo cada.`,
  },
  bola_de_fogo: {
    name: 'Bola de Fogo', icon: '💥', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 30 + lv * 3, cast: () => 1400, cd: 1500, fx: 'bolt',
    effect: { kind: 'damage', dmg: 'magic', element: 'fogo', mult: lv => 2 + lv * 0.45, hits: () => 1, splash: 2 },
    desc: lv => `Explode no alvo e ao redor: ${Math.round((2 + lv * 0.45) * 100)}% ATQM de Fogo em área.`,
  },
  nevasca: {
    name: 'Nevasca', icon: '🌨️', type: 'active', target: 'ground', maxLv: 10, range: 9, sp: lv => 38 + lv * 4, cast: () => 2000, cd: 3000, fx: 'storm',
    effect: { kind: 'damage', dmg: 'magic', element: 'agua', mult: lv => 0.55 + lv * 0.15, hits: () => 6, radius: 3.5, status: { type: 'freeze', chance: lv => 0.08 + lv * 0.02, dur: 2500 } },
    desc: lv => `6 rajadas de gelo numa área grande: ${Math.round((0.55 + lv * 0.15) * 100)}% ATQM de Água cada, chance de congelar.`,
  },
  tempestade: {
    name: 'Tempestade de Raios', icon: '🌩️', type: 'active', target: 'ground', maxLv: 10, range: 9, sp: lv => 35 + lv * 4, cast: () => 2200, cd: 2500, fx: 'storm',
    effect: { kind: 'damage', dmg: 'magic', element: 'vento', mult: lv => 0.6 + lv * 0.2, hits: () => 5, radius: 3 },
    desc: lv => `5 descargas numa área: ${Math.round((0.6 + lv * 0.2) * 100)}% ATQM de Vento cada.`,
  },
  // Sábio Elemental
  pilar_de_terra: {
    name: 'Pilar de Terra', icon: '🪨', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 20 + lv * 2, cast: () => 1000, cd: 1000, fx: 'pillar',
    effect: { kind: 'damage', dmg: 'magic', element: 'terra', mult: lv => 2.2 + lv * 0.5, status: { type: 'stun', chance: () => 0.3, dur: 2000 } },
    desc: lv => `${Math.round((2.2 + lv * 0.5) * 100)}% ATQM de Terra, 30% de atordoar.`,
  },
  runa_de_fogo: {
    name: 'Runa de Fogo', icon: '🔶', type: 'active', target: 'ground', maxLv: 10, range: 9, sp: lv => 25 + lv * 3, cast: () => 800, cd: 2000, fx: 'meteor',
    effect: { kind: 'damage', dmg: 'magic', element: 'fogo', mult: lv => 3 + lv * 0.6, hits: () => 1, radius: 2 },
    desc: lv => `Grava uma runa no chão que explode: ${Math.round((3 + lv * 0.6) * 100)}% ATQM de Fogo na área.`,
  },
  cura_maior: {
    name: 'Cura Maior', icon: '💚', type: 'active', target: 'self', maxLv: 10, sp: lv => 15 + lv * 3, cast: () => 500, cd: 1500, fx: 'heal',
    effect: { kind: 'heal', amount: (lv, p) => Math.floor((p.baseLv + p.d.int) * lv * 1.5 + p.d.matk * 0.5) },
    desc: lv => `Cura baseada em Nível, INT e ATQM (nível ${lv}).`,
  },
  // Caçador
  flecha_explosiva: {
    name: 'Flecha Explosiva', icon: '🎆', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: lv => 18 + lv, cd: 900, fx: 'firearrow',
    effect: { kind: 'damage', dmg: 'phys', element: 'fogo', mult: lv => 1.8 + lv * 0.3, splash: 1.8 },
    desc: lv => `Explode no alvo: ${Math.round((1.8 + lv * 0.3) * 100)}% de dano de Fogo em área pequena.`,
  },
  falcao: {
    name: 'Falcão Companheiro', icon: '🦅', type: 'passive', maxLv: 5,
    bonuses: lv => ({ falcon: lv }), desc: lv => `Chance de ${lv * 4}% + SOR/3 do falcão atacar junto (dano por DES).`,
  },
  // Bardo (id interno: menestrel)
  cancao_de_batalha: {
    name: 'Canção de Batalha', icon: '🎶', type: 'active', target: 'self', maxLv: 5, sp: () => 35, cd: 1000, fx: 'aura', fxColor: '#ffb3d9',
    effect: { kind: 'buff', dur: 120000, bonuses: lv => ({ atkPct: lv * 4, matkPct: lv * 4, aspdPct: lv * 3 }) },
    desc: lv => `Por 120s: +${lv * 4}% ATQ/ATQM e +${lv * 3}% vel. de ataque.`,
  },
  nota_dissonante: {
    name: 'Nota Dissonante', icon: '🎺', type: 'active', target: 'selfAoe', maxLv: 10, sp: () => 25, cd: 2000, fx: 'sound',
    effect: { kind: 'damage', dmg: 'magic', element: 'vento', mult: lv => 1 + lv * 0.3, radius: 3.5, status: { type: 'stun', chance: () => 0.25, dur: 1800 } },
    desc: lv => `Onda sonora ao redor: ${Math.round((1 + lv * 0.3) * 100)}% ATQM, 25% de atordoar.`,
  },
  // Lâmina Sombria
  golpe_sombrio: {
    name: 'Golpe Sombrio', icon: '🌘', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: lv => 20 + lv * 2, cd: 1000, fx: 'shadow',
    effect: { kind: 'damage', dmg: 'phys', element: 'sombra', mult: lv => 2.5 + lv * 0.5, autoCrit: true },
    desc: lv => `Crítico garantido de Sombra: ${Math.round((2.5 + lv * 0.5) * 100)}% de dano.`,
  },
  danca_das_laminas: {
    name: 'Dança das Lâminas', icon: '🌀', type: 'active', target: 'selfAoe', maxLv: 10, sp: () => 25, cd: 1500, fx: 'blades',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 0.7 + lv * 0.15, hits: () => 3, radius: 2 },
    desc: lv => `Gira causando 3 golpes de ${Math.round((0.7 + lv * 0.15) * 100)}% em quem estiver perto.`,
  },
  // Saqueador
  roubar: {
    name: 'Roubar', icon: '🫳', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: () => 10, cd: 500, fx: 'steal',
    effect: { kind: 'steal', chance: lv => 0.1 + lv * 0.05 }, desc: lv => `${10 + lv * 5}% (+DES) de chance de roubar um item (1x por monstro).`,
  },
  golpe_traicoeiro: {
    name: 'Golpe Traiçoeiro', icon: '🔪', type: 'active', target: 'enemy', maxLv: 10, range: 'weapon', sp: lv => 15 + lv, cd: 600, fx: 'slash',
    effect: { kind: 'damage', dmg: 'phys', mult: lv => 1.5 + lv * 0.35, flat: (lv, p) => p.d.agi * lv },
    desc: lv => `${Math.round((1.5 + lv * 0.35) * 100)}% de dano + AGI×${lv}.`,
  },
};

/* ---------------- Itens ---------------- */
const ITEMS = {
  // Consumíveis
  maca: { name: 'Maçã', type: 'consumivel', icon: '🍎', price: 15, use: { hp: 30 }, desc: 'Uma maçã fresca e crocante.' },
  pocao_vermelha: { name: 'Poção Vermelha', type: 'consumivel', icon: '🧪', price: 50, use: { hp: 90 }, desc: 'Poção básica de cura.' },
  laranja: { name: 'Laranja', type: 'consumivel', icon: '🍊', price: 25, use: { hp: 25, sp: 8 }, desc: 'Docinha e cheia de suco.' },
  pera: { name: 'Pera', type: 'consumivel', icon: '🍐', price: 30, use: { hp: 55 }, desc: 'Macia e perfumada.' },
  uvas: { name: 'Cacho de Uvas', type: 'consumivel', icon: '🍇', price: 45, use: { sp: 18 }, desc: 'Uma por uma, recupera o fôlego.' },
  banana: { name: 'Banana', type: 'consumivel', icon: '🍌', price: 35, use: { hp: 70 }, desc: 'Energia rápida para a caçada.' },
  melancia: { name: 'Fatia de Melancia', type: 'consumivel', icon: '🍉', price: 80, use: { hp: 120, sp: 15 }, desc: 'Refrescante! Cura bastante.' },
  carne_assada: { name: 'Carne Assada', type: 'consumivel', icon: '🍖', price: 220, use: { hp: 260 }, desc: 'Sustância de aventureiro.' },
  frutinha_azul: { name: 'Frutinha Azul', type: 'consumivel', icon: '🫐', price: 60, use: { sp: 20 }, desc: 'Azedinha. Clareia a mente.' },
  pocao_azul: { name: 'Poção Azul', type: 'consumivel', icon: '💧', price: 320, use: { sp: 70 }, desc: 'Restaura energia espiritual.' },
  mel: { name: 'Mel Silvestre', type: 'consumivel', icon: '🍯', price: 150, use: { hp: 80, sp: 20 }, desc: 'Doce e revigorante.' },
  pergaminho_retorno: { name: 'Pergaminho de Retorno', type: 'consumivel', icon: '📜', price: 120, use: { warp: 'vila' }, desc: 'Leva você de volta à Vila de Alvorada.' },

  // Armas
  adaga_simples: { name: 'Adaga Simples', type: 'arma', wtype: 'adaga', icon: '🗡️', price: 60, atk: 14, slots: 2, lv: 1 },
  adaga_afiada: { name: 'Adaga Afiada', type: 'arma', wtype: 'adaga', icon: '🗡️', price: 900, atk: 38, slots: 1, lv: 12, bonuses: { crit: 3 } },
  espada_curta: { name: 'Espada Curta', type: 'arma', wtype: 'espada', icon: '⚔️', price: 300, atk: 30, slots: 2, lv: 1 },
  espada_longa: { name: 'Espada Longa', type: 'arma', wtype: 'espada', icon: '⚔️', price: 2200, atk: 70, slots: 1, lv: 15, wlen: 1.24 }, // S-362: wlen = comprimento visual da lâmina (1 = espada padrão de uma mão)
  lamina_de_musgo: { name: 'Lâmina de Musgo', type: 'arma', wtype: 'espada', icon: '🌿', price: 9000, atk: 110, slots: 2, lv: 25, bonuses: { vit: 3, hpRegen: 10 }, desc: 'Viva. Cresce musgo em sua guarda.' },
  lanca_de_ferro: { name: 'Lança de Ferro', type: 'arma', wtype: 'lanca', icon: '🔱', price: 1500, atk: 58, slots: 1, lv: 8 },
  cajado_de_salgueiro: { name: 'Cajado de Salgueiro', type: 'arma', wtype: 'cajado', icon: '🪄', price: 300, atk: 10, matk: 25, slots: 2, lv: 1 },
  cajado_arcano: { name: 'Cajado Arcano', type: 'arma', wtype: 'cajado', icon: '🪄', price: 3500, atk: 20, matk: 70, slots: 1, lv: 20, bonuses: { int: 3 } },
  arco_curto: { name: 'Arco Curto', type: 'arma', wtype: 'arco', icon: '🏹', price: 350, atk: 25, slots: 2, lv: 1 },
  arco_composto: { name: 'Arco Composto', type: 'arma', wtype: 'arco', icon: '🏹', price: 2400, atk: 58, slots: 1, lv: 15 },
  besta_de_caca: { name: 'Besta de Caça', type: 'arma', wtype: 'besta', icon: '🏹', price: 2800, atk: 66, slots: 1, lv: 15, bonuses: { hit: 4 }, desc: 'Coronha de freixo e arco de aço: um virote pesado, mirado no ombro.' },
  besta_de_cerco: { name: 'Besta de Cerco Leve', type: 'arma', wtype: 'besta', icon: '🏹', price: 11000, atk: 112, slots: 1, lv: 30, bonuses: { hit: 8, crit: 4 }, desc: 'Arco de aço temperado com estribo e manivela: atravessa couraças.' },
  arco_lunar: { name: 'Arco Lunar', type: 'arma', wtype: 'arco', icon: '🌙', price: 9000, atk: 95, slots: 1, lv: 28, bonuses: { dex: 3, crit: 5 }, desc: 'Brilha fracamente sob a lua.' },
  katar_de_ferro: { name: 'Katar de Ferro', type: 'arma', wtype: 'katar', icon: '🗡️', price: 2400, atk: 60, slots: 2, lv: 12, bonuses: { crit: 4 }, desc: 'Par de punhais de soco: a mão fecha na travessa e a lâmina continua o braço. Só o Executor sabe usá-las.' },
  katar_rubra: { name: 'Katar Rubra', type: 'arma', wtype: 'katar', icon: '🗡️', price: 7800, atk: 92, slots: 1, lv: 25, bonuses: { crit: 8, aspdPct: 5 }, desc: 'Katares de aço claro com guarnição de ouro e uma pedra rubra. Golpes ainda mais rápidos.' },
  // S-324: instrumentos do Bardo (arma de duas mãos; o ataque é uma onda sonora; nas canções ele toca de verdade)
  alaude_de_viajante: { name: 'Alaúde de Viajante', type: 'arma', wtype: 'instrumento', instrument: 'alaude', icon: '🪕', price: 2200, atk: 38, slots: 2, lv: 12, bonuses: { matk: 8, dex: 1 }, desc: 'Alaúde de bojo arredondado e tampo de abeto, gasto de tanta estrada. Toca canções de batalha e solta ondas de som que ferem.' },
  bandolim_rubro: { name: 'Bandolim Rubro', type: 'arma', wtype: 'instrumento', instrument: 'bandolim', icon: '🪕', price: 7600, atk: 70, slots: 1, lv: 25, bonuses: { matk: 18, aspdPct: 5 }, desc: 'Bandolim de madeira avermelhada com marchetaria dourada. Notas mais rápidas e brilhantes.' },
  flauta_de_prata: { name: 'Flauta de Prata', type: 'arma', wtype: 'instrumento', instrument: 'flauta', icon: '🎶', price: 9800, atk: 64, slots: 1, lv: 30, bonuses: { matk: 25, sp: 40 }, desc: 'Flauta transversal de prata lavrada. Sopros longos e claros que atravessam o campo de batalha.' },
  katar_do_eclipse: { name: 'Katar do Eclipse', type: 'arma', wtype: 'katar', icon: '🗡️', price: 24000, atk: 130, slots: 1, lv: 40, bonuses: { crit: 12, aspdPct: 8, atkPct: 5 }, desc: 'Lâminas que bebem a luz. Rara: dizem que só aparecem nas mãos de quem já caçou nas Criptas Profundas.' },
  garras_gemeas: { name: 'Garras Gêmeas', type: 'arma', wtype: 'garra', icon: '🐾', price: 2000, atk: 52, slots: 1, lv: 12, bonuses: { crit: 6 } },

  // Armaduras
  tunica_algodao: { name: 'Túnica de Algodão', type: 'armadura', icon: '👕', price: 60, def: 3, slots: 1, lv: 1 },
  colete_couro: { name: 'Colete de Couro', type: 'armadura', icon: '🦺', price: 600, def: 9, slots: 1, lv: 8 },
  cota_de_malha: { name: 'Cota de Malha', type: 'armadura', icon: '🥋', price: 2600, def: 20, slots: 1, lv: 20 },
  manto_arcano: { name: 'Manto Arcano', type: 'armadura', icon: '🧥', price: 1800, def: 6, mdef: 10, slots: 1, lv: 12, bonuses: { int: 2, spPct: 5 } },

  // Cabeça
  bandana: { name: 'Bandana', type: 'cabeca', icon: '🎀', price: 120, def: 1, slots: 1, lv: 1 },
  chapeu_de_palha: { name: 'Chapéu de Palha', type: 'cabeca', icon: '👒', price: 400, def: 2, slots: 0, lv: 1, bonuses: { vit: 1, luk: 1 } },
  coroa_de_flores: { name: 'Coroa de Flores', type: 'cabeca', icon: '💐', price: 1200, def: 1, slots: 0, lv: 1, bonuses: { luk: 3, spRegen: 3 }, desc: 'Rara! Cheira a primavera.' },
  elmo_de_ferro: { name: 'Elmo de Ferro', type: 'cabeca', icon: '⛑️', price: 2000, def: 6, slots: 1, lv: 18 },
  chapeu_de_mago: { name: 'Chapéu de Mago', type: 'cabeca', icon: '🎩', price: 900, mdef: 3, slots: 1, lv: 5, bonuses: { int: 2 }, desc: 'Pontudo e cheio de estrelinhas bordadas.' },
  chapeu_de_bardo: { name: 'Chapéu de Bardo', type: 'cabeca', icon: '🪶', price: 800, def: 1, slots: 1, lv: 5, bonuses: { dex: 1, luk: 1 }, desc: 'Com uma pena de faisão.' },
  tricornio: { name: 'Tricórnio', type: 'cabeca', icon: '🏴‍☠️', price: 1100, def: 2, slots: 1, lv: 8, bonuses: { luk: 2 }, desc: 'Chapéu de três pontas, de quem gosta de um bom saque.' },
  capuz_sombrio: { name: 'Capuz Sombrio', type: 'cabeca', icon: '🥷', price: 1300, def: 2, slots: 1, lv: 10, bonuses: { agi: 2 }, desc: 'Esconde o rosto nas sombras.' },
  tiara_arcana: { name: 'Tiara Arcana', type: 'cabeca', icon: '👑', price: 1500, mdef: 4, slots: 0, lv: 12, bonuses: { int: 1, spRegen: 2 } },
  faixa_de_penas: { name: 'Faixa de Penas', type: 'cabeca', icon: '🪶', price: 600, def: 1, slots: 0, lv: 3, bonuses: { dex: 1 } },
  gorro_de_la: { name: 'Gorro de Lã', type: 'cabeca', icon: '🧶', price: 450, def: 1, slots: 0, lv: 1, bonuses: { vit: 1 }, desc: 'Tricotado à mão; segura o frio das serras.' },
  chapeu_de_viajante: { name: 'Chapéu de Viajante', type: 'cabeca', icon: '🤠', price: 950, def: 2, slots: 1, lv: 6, bonuses: { agi: 1, vit: 1 }, desc: 'Feltro surrado de quem já cruzou o vale inteiro.' },
  coroa_de_bronze: { name: 'Coroa de Bronze', type: 'cabeca', icon: '👑', price: 2400, def: 2, mdef: 2, slots: 1, lv: 15, bonuses: { str: 1, int: 1, luk: 2 }, desc: 'Antiga, de um reino que ninguém lembra o nome.' },

  // Cabeça (meio e baixo)
  oculos_redondos: { name: 'Óculos Redondos', type: 'rosto', icon: '👓', price: 500, mdef: 2, slots: 0, lv: 5, bonuses: { int: 1 } },
  mascara_folha: { name: 'Máscara de Folha', type: 'rosto', icon: '🍃', price: 350, def: 1, slots: 0, lv: 1, bonuses: { dex: 1 } },
  folha_hortela: { name: 'Folha de Hortelã', type: 'boca', icon: '🌿', price: 300, slots: 0, lv: 1, bonuses: { spRegen: 2 }, desc: 'Mastigar dá um fôlego novo.' },
  bigode_postico: { name: 'Bigode Postiço', type: 'boca', icon: '🥸', price: 250, slots: 0, lv: 1, bonuses: { luk: 2 }, desc: 'Ninguém vai te reconhecer.' },
  monoculo: { name: 'Monóculo', type: 'rosto', icon: '🧐', price: 700, mdef: 1, slots: 0, lv: 5, bonuses: { dex: 1, int: 1 }, desc: 'Lente de cristal presa por uma correntinha dourada.' },
  venda_de_pirata: { name: 'Venda de Corsário', type: 'rosto', icon: '🏴', price: 550, def: 1, slots: 0, lv: 4, bonuses: { str: 1, crit: 2 }, desc: 'Um olho a menos, um ar de perigo a mais.' },
  mascara_de_baile: { name: 'Máscara de Baile', type: 'rosto', icon: '🎭', price: 1600, mdef: 2, slots: 1, lv: 12, bonuses: { agi: 1, luk: 2 }, desc: 'Veludo escuro com fios dourados e uma pluma.' },
  cachimbo: { name: 'Cachimbo de Raiz', type: 'boca', icon: '🪵', price: 650, slots: 0, lv: 5, bonuses: { int: 1, spRegen: 1 }, desc: 'Fumaça calma para pensar melhor.' },
  lenco_de_bandoleiro: { name: 'Lenço de Bandoleiro', type: 'boca', icon: '🧣', price: 800, def: 1, slots: 0, lv: 7, bonuses: { agi: 1, flee: 3 }, desc: 'Cobre nariz e boca; poeira e testemunhas ficam de fora.' },
  talo_de_trigo: { name: 'Talo de Trigo', type: 'boca', icon: '🌾', price: 120, slots: 0, lv: 1, bonuses: { hpRegen: 1 }, desc: 'Coisa de quem não tem pressa.' },

  // Escudos
  escudo_madeira: { name: 'Escudo de Madeira', type: 'escudo', icon: '🛡️', price: 150, def: 3, slots: 1, lv: 1 },
  broquel_ferro: { name: 'Broquel de Ferro', type: 'escudo', icon: '🔰', price: 1400, def: 8, slots: 1, lv: 12 },

  // Capas
  capa_viagem: { name: 'Capa de Viagem', type: 'capa', icon: '🧣', price: 100, def: 1, mdef: 1, slots: 1, lv: 1 },
  manto_penas: { name: 'Manto de Penas', type: 'capa', icon: '🪶', price: 1300, def: 3, slots: 1, lv: 10, bonuses: { agi: 2 } },

  // Botas
  sandalias_corda: { name: 'Sandálias de Corda', type: 'botas', icon: '🩴', price: 80, def: 1, slots: 1, lv: 1 },
  botas_couro: { name: 'Botas de Couro', type: 'botas', icon: '👢', price: 700, def: 3, slots: 1, lv: 8, bonuses: { agi: 1 } },

  // Acessórios
  luvas_couro: { name: 'Luvas de Couro', type: 'acessorio', icon: '🧤', price: 800, slots: 1, lv: 5, bonuses: { dex: 2 } },
  anel_de_forca: { name: 'Anel de Força', type: 'acessorio', icon: '💍', price: 1500, slots: 1, lv: 10, bonuses: { str: 2 } },
  brinco_sabio: { name: 'Brinco do Sábio', type: 'acessorio', icon: '📿', price: 1500, slots: 1, lv: 10, bonuses: { int: 2 } },

  // Etc (para vender)
  gosma: { name: 'Gosma', type: 'etc', icon: '🫧', price: 6, desc: 'Pegajosa. Algum alquimista deve querer.' },
  esporo: { name: 'Esporo', type: 'etc', icon: '🍄', price: 12 },
  chifre: { name: 'Chifre Pequeno', type: 'etc', icon: '📯', price: 26 },
  ferrao: { name: 'Ferrão', type: 'etc', icon: '🪡', price: 36 },
  geleia_real: { name: 'Geleia Real', type: 'etc', icon: '🍮', price: 600 },
  pelugem: { name: 'Pelugem Cinzenta', type: 'etc', icon: '🧶', price: 60 },
  palha: { name: 'Feixe de Palha', type: 'etc', icon: '🌾', price: 70 },
  asa_morcego: { name: 'Asa de Morcego', type: 'etc', icon: '🦇', price: 90 },
  presa_alfa: { name: 'Presa do Alfa', type: 'etc', icon: '🐺', price: 900 },
  osso: { name: 'Osso Antigo', type: 'etc', icon: '🦴', price: 120 },
  pedra_musgo: { name: 'Pedra com Musgo', type: 'etc', icon: '🪨', price: 180 },
  ectoplasma: { name: 'Ectoplasma', type: 'etc', icon: '👻', price: 200 },
  fragmento_ferro: { name: 'Fragmento de Ferro', type: 'etc', icon: '⚙️', price: 260 },
  brasa_viva: { name: 'Brasa Viva', type: 'etc', icon: '🔥', price: 140, desc: 'Ainda quente. Tirada do núcleo de uma Brasinha.' },
  broto_umido: { name: 'Broto Úmido', type: 'etc', icon: '🌱', price: 55, desc: 'Brota de novo se plantado na lama.' },
  cristal_de_geada: { name: 'Cristal de Geada', type: 'etc', icon: '❄️', price: 260, desc: 'Nunca derrete, nem no sol do meio-dia.' },
  essencia_sombria: { name: 'Essência Sombria', type: 'etc', icon: '🟣', price: 340, desc: 'Sussurra quando ninguém está olhando.' },
  casca_ancestral: { name: 'Casca Ancestral', type: 'etc', icon: '🪵', price: 5000, desc: 'Prova de que você derrotou o Guardião.' },
};

/* ---------------- Monstros ----------------
   Cada monstro tem UMA carta. A carta é gerada automaticamente como item.
------------------------------------------------- */
const MONSTERS = {
  // Gotinhas: gotas d'água vivas (corpo de gota com crista, núcleo brilhante, nadadeiras). Cada elemento tem a sua.
  gotinha: {
    name: 'Orvalhinho', lv: 1, hp: 45, atk: [5, 9], def: 0, exp: 7, jexp: 6, element: 'agua', shape: 'blob', variant: 'agua', color: '#5ec8ff', size: 0.75, speed: 45,
    drops: [['gosma', 0.7], ['maca', 0.25], ['pocao_vermelha', 0.04], ['adaga_simples', 0.015]],
    card: { equip: 'armadura', bonuses: { vit: 1, hp: 80 } },
  },
  musguinho: {
    name: 'Musguinho', lv: 9, hp: 260, atk: [16, 24], def: 6, exp: 62, jexp: 46, element: 'terra', shape: 'blob', variant: 'terra', color: '#79b85a', size: 0.8, speed: 42,
    drops: [['broto_umido', 0.6], ['gosma', 0.5], ['frutinha_azul', 0.15], ['pocao_vermelha', 0.06]],
    card: { equip: 'botas', bonuses: { vit: 2, def: 2 } },
  },
  brasinha: {
    name: 'Brasinha', lv: 26, hp: 1300, atk: [52, 70], def: 14, exp: 520, jexp: 390, element: 'fogo', shape: 'blob', variant: 'fogo', color: '#ff7a36', size: 0.85, speed: 55, aggressive: true, aggroRange: 5,
    drops: [['brasa_viva', 0.5], ['gosma', 0.4], ['pocao_vermelha', 0.12], ['pocao_azul', 0.03]],
    card: { equip: 'arma', bonuses: { atk: 8, str: 1 } },
  },
  geadinha: {
    name: 'Geadinha', lv: 34, hp: 2100, atk: [64, 86], def: 20, exp: 900, jexp: 680, element: 'agua', shape: 'blob', variant: 'gelo', color: '#cfeeff', size: 0.85, speed: 48,
    drops: [['cristal_de_geada', 0.45], ['gosma', 0.4], ['pocao_azul', 0.06]],
    card: { equip: 'escudo', bonuses: { mdef: 6, hp: 200 } },
  },
  gotinha_sombria: {
    name: 'Orvalhinho Sombrio', lv: 40, hp: 3000, atk: [80, 104], def: 24, exp: 1400, jexp: 1050, element: 'sombra', shape: 'blob', variant: 'sombra', color: '#6a3aa8', size: 0.9, speed: 60, aggressive: true, aggroRange: 6,
    drops: [['essencia_sombria', 0.4], ['ectoplasma', 0.25], ['pocao_azul', 0.08]],
    card: { equip: 'acessorio', bonuses: { int: 3, sp: 60 } },
  },
  fungolino: {
    name: 'Fungolino', lv: 3, hp: 80, atk: [8, 13], def: 3, exp: 14, jexp: 10, element: 'terra', shape: 'mushroom', color: '#d8574b', size: 0.8, speed: 40,
    drops: [['esporo', 0.6], ['maca', 0.2], ['frutinha_azul', 0.12], ['coroa_de_flores', 0.008]],
    card: { equip: 'cabeca', bonuses: { int: 2, sp: 20 } },
  },
  coelho_chifre: {
    name: 'Coelho-Chifre', lv: 5, hp: 120, atk: [12, 18], def: 5, exp: 24, jexp: 18, element: 'neutro', shape: 'rabbit', color: '#efe4d0', size: 0.8, speed: 70,
    drops: [['chifre', 0.5], ['carne_assada', 0.05], ['bandana', 0.02]],
    card: { equip: 'botas', bonuses: { agi: 2, flee: 5 } },
  },
  abelha_rubra: {
    name: 'Abelha Rubra', lv: 8, hp: 170, atk: [16, 24], def: 6, exp: 42, jexp: 32, element: 'vento', shape: 'bee', color: '#ff5a3c', size: 0.7, speed: 80, aggroRange: 4,
    drops: [['ferrao', 0.5], ['mel', 0.15], ['luvas_couro', 0.01]],
    card: { equip: 'arma', bonuses: { dmgVs: { agua: 20 }, dex: 1 } },
  },
  boneco_treino: { // boneco de treino da vila (S-090): não ataca, não anda e nunca morre
    name: 'Boneco de Treino', lv: 1, hp: 999999, atk: [0, 0], def: 0, mdef: 0, exp: 0, jexp: 0, element: 'neutro', shape: 'dummy', color: '#c9a15a', size: 1, speed: 0, dummy: true, flee: 0, race: 'Treino', icon: '🎯',
    drops: [],
  },
  sentinela_silente: {
    name: 'Sentinela Silente', lv: 55, hp: 42000, atk: [190, 250], def: 60, mdef: 40, exp: 65000, jexp: 48000, element: 'sombra', shape: 'knight', color: '#5a5a7a', size: 1.6, speed: 60, aggressive: true, aggroRange: 9, boss: true, respawn: 600000,
    drops: [['essencia_sombria', 1], ['fragmento_ferro', 0.8], ['anel_de_forca', 0.25], ['pocao_azul', 0.6]],
    card: { equip: 'armadura', bonuses: { vit: 4, def: 6, hp: 400 } }, cardRate: 0.05,
  },
  gosmao: {
    name: 'Gosmão', lv: 12, hp: 1100, atk: [30, 45], def: 8, exp: 420, jexp: 300, element: 'agua', shape: 'blob', variant: 'rei', color: '#3a8fe0', size: 2, speed: 35, mini: true, respawn: 90000,
    drops: [['geleia_real', 1], ['pocao_vermelha', 0.5], ['anel_de_forca', 0.08], ['espada_curta', 0.1]],
    card: { equip: 'arma', bonuses: { str: 2, atk: 12 } }, cardRate: 0.08,
  },
  lobo_cinzento: {
    name: 'Lobo Cinzento', lv: 12, hp: 400, atk: [30, 42], def: 12, exp: 120, jexp: 90, element: 'terra', shape: 'wolf', color: '#8a8f99', size: 1, speed: 95, aggressive: true, aggroRange: 6,
    drops: [['pelugem', 0.5], ['carne_assada', 0.1], ['colete_couro', 0.02], ['lenco_de_bandoleiro', 0.012]],
    card: { equip: 'arma', bonuses: { crit: 8, atk: 5 } },
  },
  espantalho: {
    name: 'Espantalho Errante', lv: 15, hp: 560, atk: [36, 50], def: 18, exp: 170, jexp: 130, element: 'terra', shape: 'scarecrow', color: '#c9a15a', size: 1, speed: 50,
    drops: [['palha', 0.6], ['chapeu_de_palha', 0.03], ['talo_de_trigo', 0.05], ['maca', 0.3]],
    card: { equip: 'capa', bonuses: { resist: { terra: 25 }, def: 3 } },
  },
  morcego_cripta: {
    name: 'Morcego de Cripta', lv: 18, hp: 500, atk: [40, 56], def: 8, exp: 220, jexp: 165, element: 'sombra', shape: 'bat', color: '#5a3d7a', size: 0.8, speed: 110, aggressive: true, aggroRange: 7, flee: 45,
    drops: [['asa_morcego', 0.5], ['pocao_vermelha', 0.12], ['pocao_azul', 0.03]],
    card: { equip: 'arma', bonuses: { lifesteal: 3 } },
  },
  lobo_alfa: {
    name: 'Lobo Alfa', lv: 22, hp: 4200, atk: [60, 85], def: 20, exp: 1600, jexp: 1200, element: 'terra', shape: 'wolf', color: '#4b4f5c', size: 1.6, speed: 100, aggressive: true, mini: true, respawn: 120000,
    drops: [['presa_alfa', 1], ['carne_assada', 0.6], ['garras_gemeas', 0.1], ['adaga_afiada', 0.1]],
    card: { equip: 'acessorio', bonuses: { atkPct: 5, aspdPct: 5 } }, cardRate: 0.08,
  },
  esqueleto_vigia: {
    name: 'Esqueleto Vigia', lv: 24, hp: 950, atk: [60, 82], def: 25, exp: 400, jexp: 300, element: 'sombra', shape: 'skeleton', color: '#e6e2d3', size: 1, speed: 60, aggressive: true,
    drops: [['osso', 0.6], ['elmo_de_ferro', 0.02], ['venda_de_pirata', 0.015], ['espada_longa', 0.015]],
    card: { equip: 'escudo', bonuses: { resist: { sombra: 30 }, vit: 2 } },
  },
  golem_musgo: {
    name: 'Golem de Musgo', lv: 28, hp: 2000, atk: [85, 115], def: 50, mdef: 5, exp: 650, jexp: 480, element: 'terra', shape: 'golem', color: '#6f7f5a', size: 1.4, speed: 35,
    drops: [['pedra_musgo', 0.6], ['lamina_de_musgo', 0.008], ['cota_de_malha', 0.015]],
    card: { equip: 'armadura', bonuses: { def: 8, hpPct: 8 } },
  },
  espectro: {
    name: 'Espectro Pálido', lv: 31, hp: 1300, atk: [90, 120], def: 10, mdef: 40, exp: 780, jexp: 590, element: 'sombra', shape: 'ghost', color: '#a8c8ff', size: 1, speed: 70, aggressive: true, range: 5, flee: 70,
    drops: [['ectoplasma', 0.5], ['pocao_azul', 0.1], ['mascara_de_baile', 0.008], ['arco_lunar', 0.008], ['cajado_arcano', 0.01], ['katar_do_eclipse', 0.004]],
    card: { equip: 'cabeca', bonuses: { int: 3, matkPct: 6 } },
  },
  cavaleiro_caido: {
    name: 'Cavaleiro Caído', lv: 34, hp: 2600, atk: [110, 150], def: 45, exp: 1050, jexp: 780, element: 'sombra', shape: 'knight', color: '#3c3f4a', size: 1.15, speed: 65, aggressive: true,
    drops: [['fragmento_ferro', 0.5], ['cota_de_malha', 0.03], ['coroa_de_bronze', 0.006], ['espada_longa', 0.03], ['katar_rubra', 0.012]],
    card: { equip: 'arma', bonuses: { str: 3, atk: 15 } },
  },
  guardiao_ancestral: {
    name: 'Guardião Ancestral', lv: 40, hp: 30000, atk: [180, 260], def: 60, mdef: 30, exp: 15000, jexp: 11000, element: 'terra', shape: 'treant', color: '#4d6b3a', size: 2.4, speed: 40, aggressive: true, boss: true, respawn: 300000, special: 'slam',
    drops: [['casca_ancestral', 1], ['lamina_de_musgo', 0.25], ['arco_lunar', 0.2], ['cajado_arcano', 0.2], ['carne_assada', 1]],
    card: { equip: 'armadura', bonuses: { hpPct: 20, hpRegen: 30 } }, cardRate: 0.25,
  },
};
// valores padrão + geração automática das cartas
// raça e ícone de cada monstro (Bestiário)
const MONSTER_RACES = { blob: 'Amorfo', mushroom: 'Planta', rabbit: 'Fera', bee: 'Inseto', wolf: 'Fera', scarecrow: 'Constructo', bat: 'Fera', skeleton: 'Morto-vivo', golem: 'Constructo', ghost: 'Morto-vivo', knight: 'Morto-vivo', treant: 'Planta' };
const MONSTER_ICONS = { blob: '💧', mushroom: '🍄', rabbit: '🐇', bee: '🐝', wolf: '🐺', scarecrow: '🎃', bat: '🦇', skeleton: '💀', golem: '🗿', ghost: '👻', knight: '⚔️', treant: '🌳' };
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  m.id = id;
  m.race = m.race ?? MONSTER_RACES[m.shape] ?? 'Desconhecida';
  m.icon = m.icon ?? MONSTER_ICONS[m.shape] ?? '👾';
  m.hit = m.hit ?? Math.round(m.lv * 1.5 + 18);
  m.flee = m.flee ?? Math.round(m.lv * 1.2 + 4);
  m.mdef = m.mdef ?? Math.floor(m.def / 2);
  m.aggroRange = m.aggroRange ?? 6;
  m.size = m.size ?? 1;
  m.aspd = m.aspd ?? 1500;
  m.range = m.range ?? 1.2;
  if (m.card) {
    ITEMS['carta_' + id] = {
      name: 'Carta ' + m.name, type: 'carta', icon: '🃏', price: 20, equip: m.card.equip, bonuses: m.card.bonuses, monster: id,
      desc: `Encaixe em: ${SLOT_NAMES[m.card.equip]}. Uma vez inserida, não pode ser removida.`,
    };
  }
}

/* ---------------- Mapas ---------------- */
const MAPS = {
  vila: {
    name: 'Vila de Alvorada', lvl: 'Cidade', kind: 'town', w: 40, h: 30, music: 'vila', spawn: [20, 18],
    portals: [{ x: 39, y: 15, to: 'campos', tx: 2, ty: 24 }],
    npcs: [
      { id: 'ivra', name: 'Mestra Ivra', title: 'Mentora de Classes', role: 'classe', x: 16, y: 11, look: { body: '#6b3fa0', accent: '#ffd84a', hair: '#e8e8e8', skin: '#f1c9a5', hat: 'wizard', robe: true } },
      { id: 'bento', name: 'Bento', title: 'Mercador', role: 'loja', x: 25, y: 12, look: { body: '#8a5a2b', accent: '#e0c070', hair: '#3b2a1f', skin: '#e0b088', hat: 'straw' } },
      { id: 'clara', name: 'Irmã Clara', title: 'Curandeira', role: 'cura', x: 15, y: 18, look: { body: '#f2efe6', accent: '#6ab0ff', hair: '#c9a227', skin: '#f6d2b6', hat: 'hood', robe: true } },
      { id: 'tobias', name: 'Guarda Tobias', title: 'Guia da Vila', role: 'guia', x: 28, y: 16, look: { body: '#3b5b8f', accent: '#c0c6d0', hair: '#5a3b22', skin: '#d9a77c', hat: 'helm' } },
    ],
  },
  campos: {
    name: 'Campos de Verdelume', lvl: 'Nv. 1–12', kind: 'field', theme: 'meadow', w: 64, h: 48, music: 'campo', spawn: [32, 24],
    portals: [{ x: 0, y: 24, to: 'vila', tx: 37, ty: 15 }, { x: 63, y: 24, to: 'floresta', tx: 2, ty: 24 }],
    spawns: [{ type: 'gotinha', count: 16 }, { type: 'fungolino', count: 12 }, { type: 'coelho_chifre', count: 10 }, { type: 'abelha_rubra', count: 5 }, { type: 'gosmao', count: 1 }],
  },
  floresta: {
    name: 'Bosque Sussurrante', lvl: 'Nv. 12–24', kind: 'field', theme: 'forest', w: 64, h: 48, music: 'floresta', spawn: [32, 24], ambient: 'rgba(10,30,20,0.25)',
    portals: [{ x: 0, y: 24, to: 'campos', tx: 61, ty: 24 }, { x: 32, y: 0, to: 'ruinas', tx: 28, ty: 41 }],
    spawns: [{ type: 'lobo_cinzento', count: 10 }, { type: 'espantalho', count: 10 }, { type: 'morcego_cripta', count: 8 }, { type: 'abelha_rubra', count: 4 }, { type: 'lobo_alfa', count: 1 }],
  },
  ruinas: {
    name: 'Ruínas de Kael', lvl: 'Nv. 24–40', kind: 'field', theme: 'ruins', w: 56, h: 44, music: 'ruinas', spawn: [28, 22], ambient: 'rgba(25,10,45,0.35)',
    portals: [{ x: 28, y: 43, to: 'floresta', tx: 32, ty: 2 }],
    spawns: [{ type: 'esqueleto_vigia', count: 10 }, { type: 'golem_musgo', count: 6 }, { type: 'espectro', count: 7 }, { type: 'cavaleiro_caido', count: 6 }, { type: 'guardiao_ancestral', count: 1 }],
  },
};

/* ---------------- Mascotes (companheiros que evoluem) ----------------
   role: 'ataque' | 'suporte' | 'guardiao'. Evoluem nos níveis de PET_EVOLVE.
------------------------------------------------- */
const PET_EVOLVE = [1, 10, 25];
const PET_MAX_LV = 40;
const PETS = {
  fogo: {
    role: 'ataque', roleName: 'Ataque', roleIcon: '⚔️', element: 'fogo', color: '#ff7a3a',
    desc: 'Corre até os inimigos e ataca de perto, com botes e mordidas como um lobo. Para quem quer derrotar monstros mais rápido.',
    skills: [
      { stage: 0, name: 'Mordida', icon: '🦷', desc: 'Ataque padrão: salta no seu alvo e morde a cada ~1,6 s (gasta stamina).' },
      { stage: 1, name: 'Cuspe de Brasa', icon: '🔥', desc: 'Habilidade nova: a cada ~8 s cospe uma bola de fogo no alvo. Morde mais rápido e corre 20% mais.' },
      { stage: 2, name: 'Explosão Solar', icon: '☀️', desc: 'O cuspe de fogo explode e atinge os inimigos ao redor do alvo (metade do dano).' },
    ],
    stages: [
      { name: 'Faísca', icon: '🦊', desc: 'Raposinha curiosa com a ponta do rabo em chamas.' },
      { name: 'Labareda', icon: '🔥', desc: 'Dois rabos flamejantes e uma juba de brasas. Aprende a cuspir fogo.' },
      { name: 'Solaris', icon: '☀️', desc: 'Raposa solar de três caudas. Suas chamas explodem em área.' },
    ],
  },
  agua: {
    role: 'suporte', roleName: 'Suporte', roleIcon: '💚', element: 'agua', color: '#4ab0ff',
    desc: 'Cuida de você: cura quando você se machuca e de tempos em tempos te dá um escudo de água (mais DEF e regeneração).',
    skills: [
      { stage: 0, name: 'Gota Curativa', icon: '💧', desc: 'Quando seu HP cai abaixo de 90%, cura você a cada 6 s.' },
      { stage: 0, name: 'Bênção da Maré', icon: '🌊', desc: 'Em combate, a cada 30 s: +DEF e regeneração de HP por 20 s.' },
      { stage: 1, name: 'Maré Cheia', icon: '🫧', desc: 'Curas maiores e uma Bênção 50% mais forte.' },
      { stage: 2, name: 'Coroa de Cristal', icon: '💠', desc: 'A Bênção da Maré dobra de força.' },
    ],
    stages: [
      { name: 'Bolhinha', icon: '🫧', desc: 'Criaturinha de água que solta bolhas quando está feliz.' },
      { name: 'Maré', icon: '🌊', desc: 'Nadadeiras maiores e três bolhas mágicas orbitando. Cura mais.' },
      { name: 'Aquária', icon: '💠', desc: 'Guardiã das águas com coroa de cristal. Bênçãos mais fortes.' },
    ],
  },
  terra: {
    role: 'guardiao', roleName: 'Guardião', roleIcon: '🛡️', element: 'terra', color: '#b08a5a',
    desc: 'Protege você: enquanto estiver por perto, você recebe menos dano, e ele atordoa seu alvo com pancadas de pedra.',
    skills: [
      { stage: 0, name: 'Pancada Sísmica', icon: '🪨', desc: 'Vai até seu alvo e bate no chão a cada 6 s, atordoando-o por 1 s.' },
      { stage: 1, name: 'Casco de Cristal', icon: '💎', desc: 'O atordoamento dura 1,5 s e o mascote corre 20% mais.' },
      { stage: 2, name: 'Terremoto', icon: '🗿', desc: 'O atordoamento dura 2 s.' },
    ],
    stages: [
      { name: 'Pedrinho', icon: '🪨', desc: 'Tatuzinho de pedra que adora rolar.' },
      { name: 'Rochedo', icon: '⛰️', desc: 'Casco com cristais. Protege ainda mais.' },
      { name: 'Monolito', icon: '🗿', desc: 'Colosso de pedra com cristal brilhante. Atordoa por mais tempo.' },
    ],
  },
};

// buff dado pelo mascote de água (aparece nos ícones de buff)
SKILLS.bencao_mare = { name: 'Bênção da Maré', icon: '🌊', type: 'passive', maxLv: 1, bonuses: () => ({}), desc: () => 'Escudo de água do seu mascote: mais DEF e regeneração de HP por 20s.' };

/* ---------------- Loja ---------------- */
const FRUIT_SHOP = ['maca', 'laranja', 'pera', 'banana', 'uvas', 'melancia', 'frutinha_azul'];
const SHOP_ITEMS = ['maca', 'pocao_vermelha', 'frutinha_azul', 'pocao_azul', 'pergaminho_retorno',
  'adaga_simples', 'espada_curta', 'lanca_de_ferro', 'cajado_de_salgueiro', 'arco_curto', 'katar_de_ferro', 'alaude_de_viajante', 'besta_de_caca',
  'tunica_algodao', 'colete_couro', 'bandana', 'chapeu_de_palha', 'chapeu_de_mago', 'chapeu_de_bardo', 'tricornio', 'capuz_sombrio', 'faixa_de_penas', 'gorro_de_la', 'chapeu_de_viajante', 'mascara_folha', 'oculos_redondos', 'monoculo', 'folha_hortela', 'cachimbo', 'talo_de_trigo', 'escudo_madeira', 'capa_viagem', 'sandalias_corda', 'botas_couro', 'luvas_couro'];

/* ---------------- Rótulos de bônus ---------------- */
const BONUS_LABELS = {
  str: { n: 'FOR' }, agi: { n: 'AGI' }, vit: { n: 'VIT' }, int: { n: 'INT' }, dex: { n: 'DES' }, luk: { n: 'SOR' },
  atk: { n: 'ATQ' }, matk: { n: 'ATQM' }, def: { n: 'DEF' }, mdef: { n: 'DEFM' },
  hp: { n: 'HP máx' }, hpPct: { n: 'HP máx', pct: true }, sp: { n: 'SP máx' }, spPct: { n: 'SP máx', pct: true },
  hit: { n: 'Precisão' }, flee: { n: 'Esquiva' }, crit: { n: 'Crítico' },
  aspdPct: { n: 'Vel. de ataque', pct: true }, atkPct: { n: 'ATQ', pct: true }, matkPct: { n: 'ATQM', pct: true },
  lifesteal: { n: 'Roubo de vida', pct: true }, hpRegen: { n: 'Regen. de HP' }, spRegen: { n: 'Regen. de SP' },
  moveSpeedPct: { n: 'Vel. de movimento', pct: true }, expPct: { n: 'EXP', pct: true },
  doubleAttack: { n: 'Chance de ataque duplo', pct: true }, range: { n: 'Alcance' },
};
function fmtBonuses(b) {
  const out = [];
  if (!b) return out;
  for (const k in b) {
    const v = b[k];
    if (k === 'dmgVs') { for (const e in v) out.push(`+${v[e]}% de dano contra ${ELEMENTS[e].name}`); }
    else if (k === 'resist') { for (const e in v) out.push(`-${v[e]}% de dano recebido de ${ELEMENTS[e].name}`); }
    else if (BONUS_LABELS[k]) { const L = BONUS_LABELS[k]; out.push(`${L.n} ${v > 0 ? '+' : ''}${v}${L.pct ? '%' : ''}`); }
  }
  return out;
}

// cada item conhece o próprio id
// materiais de refino (S-124)
ITEMS.ferrolume = { name: 'Ferrolume', type: 'etc', icon: '✦', price: 900, iconRecipe: ['refine', { c: '#5a6a8a', c2: '#ffb85a' }], desc: 'Minério que guarda o calor das forjas dos anões. Usado para refinar armas.' };
ITEMS.pedra_egide = { name: 'Pedra-Égide', type: 'etc', icon: '✦', price: 750, iconRecipe: ['refine', { c: '#4a7a7a', c2: '#9affe8' }], desc: 'Pedra azulada que endurece ao toque do martelo. Usada para refinar armaduras, escudos, chapéus, capas e botas.' };
for (const id in ITEMS) ITEMS[id].id = id;
// monstros a partir do Nv. 15 às vezes deixam cair material de refino (S-124)
for (const id in MONSTERS) { const m = MONSTERS[id]; if (m.lv >= 15 && !m.dummy && m.drops) { const r = Math.min(0.06, 0.006 + m.lv * 0.0006) * (m.boss ? 8 : m.mini ? 3 : 1); m.drops.push(['ferrolume', +r.toFixed(4)], ['pedra_egide', +(r * 1.2).toFixed(4)]); } }
