'use strict';
/* =========================================================================
   PONTE 3D — faz a interface do 2D (js/ui.js, js/feedback.js, js/admin.js)
   funcionar no mundo 3D. Define os nomes globais que essas janelas esperam
   e repassa para o jogo 3D (js3d/main3d.js), que preenche o objeto H3.
   Carregar DEPOIS de data/audio/rules/actions e ANTES de ui/feedback/admin.
   ========================================================================= */

// estado compartilhado com as janelas (main3d mantém atualizado)
var G = { player: null, time: 0, paused: false, god: false, state: 'title', uid: 1, mapId: 'mundo3d', map: { def: { name: 'Mundo de Aethra' } }, monsters: [], npcs: [], drops: [] };
// nomes do mapa 2D que o módulo de sugestões consulta ao carregar
var TILE = CONFIG.TILE;
var TT = { GRASS: 0, DIRT: 1, STONE: 2, WATER: 3, DARK: 4, RUIN: 5 };
// ganchos preenchidos por main3d.js
var H3 = {};
var canvas = document.getElementById('game3d');
var VW = innerWidth, VH = innerHeight, DPR = Math.min(2, window.devicePixelRatio || 1);
addEventListener('resize', () => { VW = innerWidth; VH = innerHeight; });

// no 3D, as "coordenadas de mundo" das sugestões são as da tela (o 3D faz o raycast)
function screenToWorld(sx, sy) { return { x: sx, y: sy }; }
function monsterHeight() { return 2; }
function outlinedText() { }
function fx() { if (H3.levelFx) H3.levelFx(); }

function saveGame() { if (H3.save) H3.save(); }
function useItem(entry) { if (H3.useItem) H3.useItem(entry); }
function useHotbar(i) { if (H3.useSlot) H3.useSlot(i); }
function setPaused(on) { if (H3.setPaused) H3.setPaused(on); }
function updatePauseBar() {
  const b = document.getElementById('pausebar');
  const fb = typeof FB !== 'undefined' && (FB.picking || FB.box);
  if (!G.paused && !fb) { b.classList.remove('show'); return; }
  const world = FB.inWorld();
  b.innerHTML = FB.picking ? `💡 <b>Modo sugestão</b> — clique em ${world ? 'algo do mundo ou de uma janela' : 'qualquer coisa desta tela'} ou arraste para marcar uma área · <b>Esc</b> cancela`
    : FB.box ? '💡 <b>Escrevendo sugestão</b>' + (world ? ' — o jogo está pausado' : '')
      : '⏸ <b>Jogo pausado</b> — <b>P</b> continua · <b>Q</b> faz uma sugestão';
  b.classList.add('show');
}
function toggleSound() {
  Sound.init(); Sound.setEnabled(!Sound.enabled);
  const b = document.getElementById('btn-sound'); if (b) b.firstChild.textContent = Sound.enabled ? '🔊' : '🔇';
  try { localStorage.setItem('aethra_sound', Sound.enabled ? '1' : '0'); } catch (e) { }
  if (Sound.enabled && H3.zoneMusic) { Sound.songId = null; Sound.playSong(H3.zoneMusic()); }
}
function isAdmin() { return location.protocol === 'file:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname); }
function toggleGod(force) {
  G.god = force === undefined ? !G.god : !!force;
  const p = G.player;
  if (G.god && p) { p.hp = p.d.maxHp; p.sp = p.d.maxSp; Sound.play('holy'); UI.log('⚡ God Mode ATIVADO: imortal, SP infinito, sem recarga, mais rápido. ⌘+Z abre o Painel do Mestre.', 'card'); }
  else UI.log('God Mode desativado.', 'sys');
  UI.markDirty();
}

// comandos do chat (os mesmos do 2D que fazem sentido no 3D)
function handleChat(v) {
  const p = G.player; if (!p) return;
  if (!v.startsWith('/')) { UI.log(`${p.name}: ${v}`, 'me'); if (H3.say) H3.say(v); return; }
  const [cmd, ...args] = v.slice(1).split(/\s+/);
  const n = parseInt(args[0]);
  const dev = t => UI.log('[dev] ' + t, 'dev');
  switch (cmd.toLowerCase()) {
    case 'ajuda': UI.log('Comandos: /salvar • Teste (dev): /taxa N, /nivel N, /classe N, /zeny N, /item id [qtd], /cura, /carta monstro', 'sys'); break;
    case 'salvar': saveGame(); UI.log('Jogo salvo.', 'sys'); break;
    case 'taxa': if (n > 0) { CONFIG.EXP_RATE = n; dev(`Taxa de EXP ${n}x.`); } break;
    case 'nivel': if (n > 0) { while (p.baseLv < Math.min(n, CONFIG.MAX_BASE_LV)) { p.baseLv++; p.statPoints += Math.floor(p.baseLv / 5) + 3; } recalc(p); p.hp = p.d.maxHp; dev(`Nível de Base ${p.baseLv}.`); UI.markDirty(); } break;
    case 'classe': if (n > 0) { while (p.jobLv < Math.min(n, maxJobLv(p))) { p.jobLv++; p.skillPoints++; } dev(`Nível de Classe ${p.jobLv}.`); UI.markDirty(); } break;
    case 'zeny': if (n > 0) { p.zeny += n; dev(`+${n} z.`); UI.markDirty(); } break;
    case 'item': if (ITEMS[args[0]]) { addItem(p, args[0], parseInt(args[1]) || 1); dev(`Item ${ITEMS[args[0]].name} criado.`); UI.markDirty(); } break;
    case 'carta': if (ITEMS['carta_' + args[0]]) { addItem(p, 'carta_' + args[0], 1); dev('Carta criada.'); UI.markDirty(); } break;
    case 'cura': p.hp = p.d.maxHp; p.sp = p.d.maxSp; dev('Curado.'); break;
    default: UI.log('Comando desconhecido. Digite /ajuda.', 'warn');
  }
}
