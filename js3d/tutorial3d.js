/* =========================================================================
   P-018 · PRIMEIROS PASSOS — tutorial guiado do jogador novo (Vila de Alvorada)
   Estilo MMO: nada de tela cheia de texto. Ao nascer, uma câmera passa pela vila
   (pulável); depois um balão discreto no alto da tela mostra UMA dica por vez e
   some quando o jogador faz a ação. Uma setinha dourada aponta para quem importa
   (Ancião Teodoro, boneco de treino, Bento).
   - Só personagens criados a partir de agora: createCharacter marca p.tutorial.
     Saves antigos (sem o campo) = já concluído — o Vidro nunca vê.
   - A "missão de boas-vindas" é a própria mq1 (Teodoro → Bento), integrada, não
     duplicada; ao concluí-la o tutorial fecha com um presentinho.
   - No computador do mestre (localhost) o tutorial não começa sozinho: pergunta antes.
   - Esc → Configurações → "Refazer os primeiros passos".
   ========================================================================= */

const STEPS = [
  { id: 'mover', title: 'Andar', text: 'Use <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> para andar pela vila.' },
  { id: 'camera', title: 'Olhar em volta', text: 'Segure o <b>botão direito</b> do mouse e arraste para girar a câmera. A <b>rodinha</b> aproxima.' },
  { id: 'teodoro', title: 'O Ancião', text: 'Fale com o <b>Ancião Teodoro</b> — o do <b class="tut-q">!</b> dourado. Clique nele.', target: 'teodoro' },
  { id: 'mapa', title: 'O mapa', text: 'Aperte <kbd>G</kbd> para abrir o mapa. O que você precisa encontrar fica marcado nele.' },
  { id: 'mochila', title: 'Sua mochila', text: 'Aperte <kbd>I</kbd> para ver a mochila e <kbd>E</kbd> para os equipamentos.' },
  { id: 'boneco', title: 'Treino', text: 'Segure o <b>botão esquerdo</b> em cima de um <b>boneco de treino</b>: você corre até ele e golpeia enquanto segurar.', target: 'boneco' },
  { id: 'atalho', title: 'Atalhos', text: 'As teclas <kbd>1</kbd> a <kbd>9</kbd> usam a barra de atalhos. Aperte <kbd>1</kbd> para comer uma maçã.' },
  { id: 'missoes', title: 'Missões', text: 'Aperte <kbd>J</kbd> para ver suas missões e o que falta em cada uma.' },
  { id: 'mascote', title: 'Seu mascote', text: 'Seu mascote te segue e luta ao seu lado. Ele tem vida e cansa: se desmaiar, descansa e volta.', ok: true },
  { id: 'bento', title: 'Boas-vindas', text: 'Agora leve o recado do Teodoro ao <b>Bento</b>, o mercador da praça.', target: 'bento' },
];

let C = null, box = null, arrow = null, intro = null, last = { x: 0, z: 0, yaw: 0 }, moved = 0, turned = 0, base = {}, okClicked = false, asked = false;

export function initTutorial(ctx) { C = ctx; }
const st = () => C && C.S.p && C.S.p.tutorial;
export function tutorialActive() { const t = st(); return !!(t && !t.done); }

// começa (ou pergunta, no computador do mestre) logo que o jogador entra no mundo
export function startTutorial() {
  const t = st(); if (!t || t.done) return;
  if (C.isAdmin() && !t.ok && !asked) { asked = true; return askAdmin(); }
  t.ok = true;
  if (t.step === undefined) t.step = -1;
  if (t.step < 0) runIntro(); else showStep();
}
export function restartTutorial() { // Esc → Configurações
  if (!C || !C.S.p) return; C.S.p.tutorial = { step: 0, ok: true }; asked = true; resetCounters(); showStep(); C.log('📘 Primeiros passos reiniciados.', 'sys');
}

function askAdmin() {
  const d = document.createElement('div'); d.className = 'tut-box tut-ask';
  d.innerHTML = `<div class="tut-h">📘 Primeiros passos</div><div class="tut-t">Personagem novo! Quer fazer o tutorial de boas-vindas da vila?</div><div class="tut-b"><button class="btn gold" data-a="sim">Fazer o tutorial</button><button class="btn" data-a="nao">Pular</button></div>`;
  document.body.appendChild(d);
  d.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; d.remove(); if (a === 'sim') { st().ok = true; startTutorial(); } else finish(true); };
}

/* ---------- câmera de apresentação (3–5 s, pulável) ---------- */
function runIntro() {
  const S = C.S, V = C.VILLAGE, P = S.pos;
  intro = { t: 0, dur: 4.6, a0: Math.atan2(P.x - V.x, P.z - V.z) + 1.2 };
  const sk = document.createElement('div'); sk.className = 'tut-intro';
  sk.innerHTML = `<div class="tut-intro-t">Vila de Alvorada</div><div class="tut-intro-s">onde toda jornada começa</div><button class="btn" id="tut-skip-intro">Pular ▸</button>`;
  document.body.appendChild(sk); intro.el = sk;
  const end = () => { if (!intro) return; intro.el.remove(); intro = null; removeEventListener('keydown', key, true); st().step = 0; resetCounters(); showStep(); C.save3d(); };
  const key = e => { if (intro) { e.stopPropagation(); end(); } };
  sk.querySelector('#tut-skip-intro').onclick = end; addEventListener('keydown', key, true); intro.end = end;
}
// chamada no draw depois da câmera normal: durante a apresentação a câmera passeia em volta da praça
export function tutorialCamera(camera, dt) {
  if (!intro) return false;
  const V = C.VILLAGE, P = C.S.pos; intro.t += dt; const k = Math.min(1, intro.t / intro.dur), e = k * k * (3 - 2 * k);
  const a = intro.a0 - e * 1.6, r = 34 - e * 26, h = 16 - e * 12.5;
  const cx = V.x + (P.x - V.x) * e, cz = V.z + (P.z - V.z) * e;
  camera.position.set(cx + Math.sin(a) * r, C.groundAt(cx, cz) + h, cz + Math.cos(a) * r);
  camera.lookAt(cx, C.groundAt(cx, cz) + 1.2 + (1 - e) * 2, cz);
  if (intro.t >= intro.dur) intro.end();
  return true;
}

/* ---------- passos ---------- */
function resetCounters() {
  const S = C.S, p = S.p; moved = 0; turned = 0; okClicked = false;
  last = { x: S.pos.x, z: S.pos.z, yaw: S.cam.yaw };
  base = { maca: C.countItem(p, 'maca'), dummy: dummyTotal() };
}
function dummyTotal() { let t = 0; for (const m of C.S.monsters) if (m.def && m.def.dummy) t += m.total || 0; return t; }
function questSt(id) { const q = C.questState(C.S.p); return q.done.includes(id) ? 'done' : q.active[id] ? 'active' : null; }

function showStep() {
  const t = st(); if (!t || t.done || t.step < 0) return hide();
  const s = STEPS[t.step]; if (!s) return finish(false);
  if (!box) {
    box = document.createElement('div'); box.className = 'tut-box'; box.id = 'tutorial';
    document.body.appendChild(box);
    box.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'pular') finish(true); else if (a === 'ok') okClicked = true; };
  }
  const dots = STEPS.map((_, i) => `<i class="${i < t.step ? 'on' : i === t.step ? 'cur' : ''}"></i>`).join('');
  box.innerHTML = `<div class="tut-h">📘 Primeiros passos · ${s.title}<button class="tut-x" data-a="pular" title="Pular o tutorial">Pular tutorial</button></div>
    <div class="tut-t">${s.text}</div>${s.ok ? '<div class="tut-b"><button class="btn gold" data-a="ok">Entendi</button></div>' : ''}<div class="tut-dots">${dots}</div>`;
  box.classList.remove('tut-pop'); void box.offsetWidth; box.classList.add('tut-pop');
}
function hide() { if (box) { box.remove(); box = null; } if (arrow) arrow.style.display = 'none'; }

function next() {
  const t = st(); t.step++; C.Sound && C.Sound.play && C.Sound.play('click'); resetCounters();
  if (t.step >= STEPS.length) return finish(false);
  showStep(); C.save3d();
}
function finish(skipped) {
  const t = st(); if (!t) return; t.done = true; t.step = STEPS.length; hide();
  if (skipped) { C.log('Tutorial pulado. Dá para refazer em Esc → Configurações.', 'sys'); C.save3d(); return; }
  const p = C.S.p; p.zeny = (p.zeny || 0) + 100; C.addItem(p, 'pocao_vermelha', 2);
  C.log('🎉 Primeiros passos concluídos! Presente da vila: 100 zeny e 2 Poções Vermelhas.', 'lvl');
  C.banner && C.banner('Primeiros passos concluídos', 'Alvorada te deseja boa jornada');
  C.Sound && C.Sound.play && C.Sound.play('levelup'); C.markDirty(); C.save3d();
}

// a cada quadro: confere se a ação do passo atual já foi feita e move a setinha
export function updateTutorial(dt) {
  const t = st(); if (!t || t.done || !t.ok || intro || t.step < 0) { if (arrow) arrow.style.display = 'none'; return; }
  const S = C.S, s = STEPS[t.step]; if (!s) return;
  if (!box) showStep();
  const dx = S.pos.x - last.x, dz = S.pos.z - last.z; moved += Math.hypot(dx, dz); last.x = S.pos.x; last.z = S.pos.z;
  let dy = S.cam.yaw - last.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; turned += Math.abs(dy); last.yaw = S.cam.yaw;
  const W = C.UI.wins;
  const doneNow = {
    mover: () => moved > 5,
    camera: () => turned > 1.2,
    teodoro: () => !!questSt('mq1'),
    mapa: () => !!W.mapa,
    mochila: () => !!(W.inv || W.char),
    boneco: () => dummyTotal() > base.dummy + 0.5, // pelo menos um golpe acertado no boneco
    atalho: () => C.countItem(S.p, 'maca') < base.maca || !C.countItem(S.p, 'maca'),
    missoes: () => !!W.quests,
    mascote: () => okClicked || !S.p.pet,
    bento: () => questSt('mq1') === 'done',
  }[s.id];
  if (doneNow && doneNow()) { next(); return; }
  // setinha dourada sobre o alvo do passo
  let tgt = null;
  if (s.target === 'teodoro' || s.target === 'bento') tgt = S.npcs.find(n => n.id === s.target);
  else if (s.target === 'boneco') { let bd = 1e9; for (const m of S.monsters) if (m.def && m.def.dummy && !m.dead) { const d = Math.hypot(m.x - S.pos.x, m.z - S.pos.z); if (d < bd) { bd = d; tgt = m; } } }
  if (!arrow) { arrow = document.createElement('div'); arrow.className = 'tut-arrow'; arrow.textContent = '▼'; document.body.appendChild(arrow); }
  if (tgt && tgt.obj && !S.interior) {
    const p = tgt.obj.position.clone(); p.y += (tgt.height || 1.9) + 0.9;
    const sc = C.toScreen(p);
    if (sc && sc.vis) { arrow.style.display = 'block'; arrow.style.left = sc.x + 'px'; arrow.style.top = sc.y + 'px'; } else arrow.style.display = 'none';
  } else arrow.style.display = 'none';
}
