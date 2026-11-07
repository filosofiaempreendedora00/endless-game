'use strict';
/* =========================================================================
   DADOS DO JOGO — tudo que define o "conteúdo" mora aqui.
   Para criar classes, habilidades, itens, monstros ou mapas novos,
   normalmente basta editar este arquivo.
   ========================================================================= */

const GAME_TITLE = 'Crônicas de Aethra';
const GAME_VERSION = '0.1.0 (MVP)';
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
  cajado: { name: 'Cajado', range: 1.5, delay: 1.15 },
  arco: { name: 'Arco', range: 6, delay: 1.05 },
  garra: { name: 'Garras', range: 1.4, delay: 0.75 },
};
const SLOT_NAMES = { arma: 'Arma', cabeca: 'Cabeça', armadura: 'Armadura', acessorio: 'Acessório' };
const EQUIP_TYPES = Object.keys(SLOT_NAMES);

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
    hpMod: 0.8, spMod: 1.9, weapons: ['adaga', 'cajado'], skills: ['seta_de_fogo', 'lanca_de_gelo', 'faisca', 'meditacao'],
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
    name: 'Cavaleiro Rúnico', tier: 2, parent: 'guerreiro', icon: '⚜️', color: '#8e2f2f', accent: '#ffcf5a', hat: 'helm', cape: true,
    hpMod: 2.1, spMod: 0.9, skills: ['lamina_runica', 'furia_de_batalha'], next: [], gift: [['espada_longa', 1]],
    desc: 'Guerreiro que grava runas na lâmina. Dano físico devastador em um único alvo.',
  },
  guardiao_sagrado: {
    name: 'Guardião Sagrado', tier: 2, parent: 'guerreiro', icon: '✨', color: '#d8d2c0', accent: '#e8c040', hat: 'helm', cape: true,
    hpMod: 2.2, spMod: 1.1, skills: ['julgamento', 'escudo_sagrado'], next: [], gift: [['elmo_de_ferro', 1]],
    desc: 'Protetor abençoado. Resistente ao extremo, com dano Sagrado em área — perfeito contra Sombra.',
  },
  arquimago: {
    name: 'Arquimago', tier: 2, parent: 'mago', icon: '☄️', color: '#5b2a8a', accent: '#ff9a3d', hat: 'wizard', robe: true, cape: true,
    hpMod: 0.9, spMod: 2.4, skills: ['meteoro', 'tempestade'], next: [], gift: [['cajado_arcano', 1]],
    desc: 'Mestre da destruição em área. Conjurações longas, efeitos colossais.',
  },
  sabio_elemental: {
    name: 'Sábio Elemental', tier: 2, parent: 'mago', icon: '📖', color: '#2f6b6b', accent: '#9be3c8', hat: 'wizard', robe: true,
    hpMod: 1.0, spMod: 2.2, skills: ['pilar_de_terra', 'cura_maior'], next: [], gift: [['manto_arcano', 1]],
    desc: 'Estudioso equilibrado: magia de Terra que atordoa e cura poderosa. Sobrevive sozinho.',
  },
  cacador: {
    name: 'Caçador', tier: 2, parent: 'arqueiro', icon: '🦅', color: '#5a6b2f', accent: '#e0c070', hat: 'feather', cape: true,
    hpMod: 1.3, spMod: 1.2, skills: ['flecha_explosiva', 'falcao'], next: [], gift: [['arco_composto', 1]],
    desc: 'Rastreador com um falcão companheiro que ataca junto com você.',
  },
  menestrel: {
    name: 'Menestrel', tier: 2, parent: 'arqueiro', icon: '🎵', color: '#2f4f8e', accent: '#ffb3d9', hat: 'feather',
    hpMod: 1.3, spMod: 1.4, skills: ['cancao_de_batalha', 'nota_dissonante'], next: [], gift: [['brinco_sabio', 1]],
    desc: 'Artista de guerra. Canções que fortalecem e notas que atordoam inimigos ao redor.',
  },
  lamina_sombria: {
    name: 'Lâmina Sombria', tier: 2, parent: 'ladino', icon: '🌑', color: '#2a2233', accent: '#9a6bff', hat: 'hood', cape: true,
    hpMod: 1.5, spMod: 1.0, skills: ['golpe_sombrio', 'danca_das_laminas'], next: [], gift: [['garras_gemeas', 1]],
    desc: 'Assassino das sombras. Críticos garantidos e uma dança de lâminas mortal.',
  },
  saqueador: {
    name: 'Saqueador', tier: 2, parent: 'ladino', icon: '💰', color: '#6b4a2f', accent: '#ffd84a', hat: 'hood',
    hpMod: 1.5, spMod: 1.0, skills: ['roubar', 'golpe_traicoeiro'], next: [], gift: [['adaga_afiada', 1]],
    desc: 'Oportunista. Rouba itens dos monstros e golpeia com traição baseada em Agilidade.',
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
    name: 'Seta de Fogo', icon: '🔥', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 10 + lv * 2, cast: lv => 400 + lv * 250, cd: 500, fx: 'bolt',
    effect: { kind: 'damage', dmg: 'magic', element: 'fogo', mult: () => 1, hits: lv => lv },
    desc: lv => `${lv} seta(s) de fogo, 100% ATQM cada.`,
  },
  lanca_de_gelo: {
    name: 'Lança de Gelo', icon: '❄️', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 10 + lv, cast: () => 700, cd: 1000, fx: 'bolt',
    effect: { kind: 'damage', dmg: 'magic', element: 'agua', mult: lv => 1 + lv * 0.25, status: { type: 'freeze', chance: lv => 0.25 + lv * 0.04, dur: 3000 } },
    desc: lv => `${Math.round((1 + lv * 0.25) * 100)}% ATQM de Água, ${25 + lv * 4}% de congelar.`,
  },
  faisca: {
    name: 'Faísca Elétrica', icon: '⚡', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 12 + lv, cast: lv => 500 + lv * 150, cd: 600, fx: 'lightning',
    effect: { kind: 'damage', dmg: 'magic', element: 'vento', mult: lv => 0.8 + lv * 0.2, hits: lv => Math.ceil(lv / 2) + 1 },
    desc: lv => `${Math.ceil(lv / 2) + 1} raios de Vento com ${Math.round((0.8 + lv * 0.2) * 100)}% ATQM.`,
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
  // Guardião Sagrado
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
  tempestade: {
    name: 'Tempestade', icon: '🌩️', type: 'active', target: 'ground', maxLv: 10, range: 9, sp: lv => 35 + lv * 4, cast: () => 2200, cd: 2500, fx: 'storm',
    effect: { kind: 'damage', dmg: 'magic', element: 'vento', mult: lv => 0.6 + lv * 0.2, hits: () => 5, radius: 3 },
    desc: lv => `5 descargas numa área: ${Math.round((0.6 + lv * 0.2) * 100)}% ATQM de Vento cada.`,
  },
  // Sábio Elemental
  pilar_de_terra: {
    name: 'Pilar de Terra', icon: '🪨', type: 'active', target: 'enemy', maxLv: 10, range: 9, sp: lv => 20 + lv * 2, cast: () => 1000, cd: 1000, fx: 'pillar',
    effect: { kind: 'damage', dmg: 'magic', element: 'terra', mult: lv => 2.2 + lv * 0.5, status: { type: 'stun', chance: () => 0.3, dur: 2000 } },
    desc: lv => `${Math.round((2.2 + lv * 0.5) * 100)}% ATQM de Terra, 30% de atordoar.`,
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
  // Menestrel
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
  carne_assada: { name: 'Carne Assada', type: 'consumivel', icon: '🍖', price: 220, use: { hp: 260 }, desc: 'Sustância de aventureiro.' },
  frutinha_azul: { name: 'Frutinha Azul', type: 'consumivel', icon: '🫐', price: 60, use: { sp: 20 }, desc: 'Azedinha. Clareia a mente.' },
  pocao_azul: { name: 'Poção Azul', type: 'consumivel', icon: '💧', price: 320, use: { sp: 70 }, desc: 'Restaura energia espiritual.' },
  mel: { name: 'Mel Silvestre', type: 'consumivel', icon: '🍯', price: 150, use: { hp: 80, sp: 20 }, desc: 'Doce e revigorante.' },
  pergaminho_retorno: { name: 'Pergaminho de Retorno', type: 'consumivel', icon: '📜', price: 120, use: { warp: 'vila' }, desc: 'Leva você de volta à Vila de Alvorada.' },

  // Armas
  adaga_simples: { name: 'Adaga Simples', type: 'arma', wtype: 'adaga', icon: '🗡️', price: 60, atk: 14, slots: 2, lv: 1 },
  adaga_afiada: { name: 'Adaga Afiada', type: 'arma', wtype: 'adaga', icon: '🗡️', price: 900, atk: 38, slots: 1, lv: 12, bonuses: { crit: 3 } },
  espada_curta: { name: 'Espada Curta', type: 'arma', wtype: 'espada', icon: '⚔️', price: 300, atk: 30, slots: 2, lv: 1 },
  espada_longa: { name: 'Espada Longa', type: 'arma', wtype: 'espada', icon: '⚔️', price: 2200, atk: 70, slots: 1, lv: 15 },
  lamina_de_musgo: { name: 'Lâmina de Musgo', type: 'arma', wtype: 'espada', icon: '🌿', price: 9000, atk: 110, slots: 2, lv: 25, bonuses: { vit: 3, hpRegen: 10 }, desc: 'Viva. Cresce musgo em sua guarda.' },
  lanca_de_ferro: { name: 'Lança de Ferro', type: 'arma', wtype: 'lanca', icon: '🔱', price: 1500, atk: 58, slots: 1, lv: 8 },
  cajado_de_salgueiro: { name: 'Cajado de Salgueiro', type: 'arma', wtype: 'cajado', icon: '🪄', price: 300, atk: 10, matk: 25, slots: 2, lv: 1 },
  cajado_arcano: { name: 'Cajado Arcano', type: 'arma', wtype: 'cajado', icon: '🪄', price: 3500, atk: 20, matk: 70, slots: 1, lv: 20, bonuses: { int: 3 } },
  arco_curto: { name: 'Arco Curto', type: 'arma', wtype: 'arco', icon: '🏹', price: 350, atk: 25, slots: 2, lv: 1 },
  arco_composto: { name: 'Arco Composto', type: 'arma', wtype: 'arco', icon: '🏹', price: 2400, atk: 58, slots: 1, lv: 15 },
  arco_lunar: { name: 'Arco Lunar', type: 'arma', wtype: 'arco', icon: '🌙', price: 9000, atk: 95, slots: 1, lv: 28, bonuses: { dex: 3, crit: 5 }, desc: 'Brilha fracamente sob a lua.' },
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
  casca_ancestral: { name: 'Casca Ancestral', type: 'etc', icon: '🪵', price: 5000, desc: 'Prova de que você derrotou o Guardião.' },
};

/* ---------------- Monstros ----------------
   Cada monstro tem UMA carta. A carta é gerada automaticamente como item.
------------------------------------------------- */
const MONSTERS = {
  gotinha: {
    name: 'Gotinha', lv: 1, hp: 45, atk: [5, 9], def: 0, exp: 7, jexp: 6, element: 'agua', shape: 'blob', color: '#5ec8ff', size: 0.75, speed: 45,
    drops: [['gosma', 0.7], ['maca', 0.25], ['pocao_vermelha', 0.04], ['adaga_simples', 0.015]],
    card: { equip: 'armadura', bonuses: { vit: 1, hp: 80 } },
  },
  fungolino: {
    name: 'Fungolino', lv: 3, hp: 80, atk: [8, 13], def: 3, exp: 14, jexp: 10, element: 'terra', shape: 'mushroom', color: '#d8574b', size: 0.8, speed: 40,
    drops: [['esporo', 0.6], ['maca', 0.2], ['frutinha_azul', 0.12], ['coroa_de_flores', 0.008]],
    card: { equip: 'cabeca', bonuses: { int: 2, sp: 20 } },
  },
  coelho_chifre: {
    name: 'Coelho-Chifre', lv: 5, hp: 120, atk: [12, 18], def: 5, exp: 24, jexp: 18, element: 'neutro', shape: 'rabbit', color: '#efe4d0', size: 0.8, speed: 70,
    drops: [['chifre', 0.5], ['carne_assada', 0.05], ['bandana', 0.02]],
    card: { equip: 'acessorio', bonuses: { agi: 2, flee: 5 } },
  },
  abelha_rubra: {
    name: 'Abelha Rubra', lv: 8, hp: 170, atk: [16, 24], def: 6, exp: 42, jexp: 32, element: 'vento', shape: 'bee', color: '#ff5a3c', size: 0.7, speed: 80, aggroRange: 4,
    drops: [['ferrao', 0.5], ['mel', 0.15], ['luvas_couro', 0.01]],
    card: { equip: 'arma', bonuses: { dmgVs: { agua: 20 }, dex: 1 } },
  },
  gosmao: {
    name: 'Gosmão', lv: 12, hp: 1100, atk: [30, 45], def: 8, exp: 420, jexp: 300, element: 'agua', shape: 'blob', color: '#3a8fe0', size: 2, speed: 35, mini: true, respawn: 90000,
    drops: [['geleia_real', 1], ['pocao_vermelha', 0.5], ['anel_de_forca', 0.08], ['espada_curta', 0.1]],
    card: { equip: 'arma', bonuses: { str: 2, atk: 12 } }, cardRate: 0.08,
  },
  lobo_cinzento: {
    name: 'Lobo Cinzento', lv: 12, hp: 400, atk: [30, 42], def: 12, exp: 120, jexp: 90, element: 'terra', shape: 'wolf', color: '#8a8f99', size: 1, speed: 95, aggressive: true, aggroRange: 6,
    drops: [['pelugem', 0.5], ['carne_assada', 0.1], ['colete_couro', 0.02]],
    card: { equip: 'arma', bonuses: { crit: 8, atk: 5 } },
  },
  espantalho: {
    name: 'Espantalho Errante', lv: 15, hp: 560, atk: [36, 50], def: 18, exp: 170, jexp: 130, element: 'terra', shape: 'scarecrow', color: '#c9a15a', size: 1, speed: 50,
    drops: [['palha', 0.6], ['chapeu_de_palha', 0.03], ['maca', 0.3]],
    card: { equip: 'armadura', bonuses: { resist: { terra: 25 }, def: 3 } },
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
    drops: [['osso', 0.6], ['elmo_de_ferro', 0.02], ['espada_longa', 0.015]],
    card: { equip: 'armadura', bonuses: { resist: { sombra: 30 }, vit: 2 } },
  },
  golem_musgo: {
    name: 'Golem de Musgo', lv: 28, hp: 2000, atk: [85, 115], def: 50, mdef: 5, exp: 650, jexp: 480, element: 'terra', shape: 'golem', color: '#6f7f5a', size: 1.4, speed: 35,
    drops: [['pedra_musgo', 0.6], ['lamina_de_musgo', 0.008], ['cota_de_malha', 0.015]],
    card: { equip: 'armadura', bonuses: { def: 8, hpPct: 8 } },
  },
  espectro: {
    name: 'Espectro Pálido', lv: 31, hp: 1300, atk: [90, 120], def: 10, mdef: 40, exp: 780, jexp: 590, element: 'sombra', shape: 'ghost', color: '#a8c8ff', size: 1, speed: 70, aggressive: true, range: 5, flee: 70,
    drops: [['ectoplasma', 0.5], ['pocao_azul', 0.1], ['arco_lunar', 0.008], ['cajado_arcano', 0.01]],
    card: { equip: 'cabeca', bonuses: { int: 3, matkPct: 6 } },
  },
  cavaleiro_caido: {
    name: 'Cavaleiro Caído', lv: 34, hp: 2600, atk: [110, 150], def: 45, exp: 1050, jexp: 780, element: 'sombra', shape: 'knight', color: '#3c3f4a', size: 1.15, speed: 65, aggressive: true,
    drops: [['fragmento_ferro', 0.5], ['cota_de_malha', 0.03], ['espada_longa', 0.03]],
    card: { equip: 'arma', bonuses: { str: 3, atk: 15 } },
  },
  guardiao_ancestral: {
    name: 'Guardião Ancestral', lv: 40, hp: 30000, atk: [180, 260], def: 60, mdef: 30, exp: 15000, jexp: 11000, element: 'terra', shape: 'treant', color: '#4d6b3a', size: 2.4, speed: 40, aggressive: true, boss: true, respawn: 300000, special: 'slam',
    drops: [['casca_ancestral', 1], ['lamina_de_musgo', 0.25], ['arco_lunar', 0.2], ['cajado_arcano', 0.2], ['carne_assada', 1]],
    card: { equip: 'armadura', bonuses: { hpPct: 20, hpRegen: 30 } }, cardRate: 0.25,
  },
};
// valores padrão + geração automática das cartas
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  m.id = id;
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

/* ---------------- Loja ---------------- */
const SHOP_ITEMS = ['maca', 'pocao_vermelha', 'frutinha_azul', 'pocao_azul', 'pergaminho_retorno',
  'adaga_simples', 'espada_curta', 'lanca_de_ferro', 'cajado_de_salgueiro', 'arco_curto',
  'tunica_algodao', 'colete_couro', 'bandana', 'luvas_couro'];

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
for (const id in ITEMS) ITEMS[id].id = id;
