'use strict';
/* =========================================================================
   ÁUDIO — trilhas originais geradas em tempo real (Web Audio), sem arquivos.
   Cada música: acordes por compasso + melodia em notas ("-" sustenta, "." pausa).
   ========================================================================= */

const SONGS = {
  vila: { // valsa tranquila em Dó maior
    bpm: 100, stepsPerBar: 6, style: 'waltz', lead: 'triangle', leadVol: 0.5,
    chords: 'C G F C F G Am G C G F C Dm C G C',
    melody: `E5 - G5 - C6 - | B5 - A5 - G5 - | A5 - - G5 F5 - | E5 - - - - . |
             F5 - A5 - C6 - | B5 - G5 - D5 - | E5 - F5 - G5 - | G5 - - - - . |
             E5 - G5 - C6 - | D6 - C6 - B5 - | A5 - C6 - F6 - | E6 - - D6 C6 - |
             A5 - - G5 F5 - | E5 - G5 - C6 - | D5 - E5 - B4 - | C5 - - - - . |`,
  },
  campo: { // marcha aventureira em Sol maior
    bpm: 128, stepsPerBar: 8, style: 'march', lead: 'square', leadVol: 0.22,
    chords: 'G D Em C G D C D G C D G Em C D G',
    melody: `G4 - B4 - D5 - B4 - | A4 - F#4 - D5 - A4 - | B4 - G4 - E5 - D5 - | C5 - B4 - A4 - - - |
             G4 - B4 - D5 - G5 - | F#5 - E5 - D5 - A4 - | E5 - D5 - C5 - B4 - | A4 - - - - - . . |
             D5 - D5 E5 D5 - B4 - | C5 - C5 D5 C5 - A4 - | B4 - A4 - F#4 - A4 - | G4 - - - B4 - D5 - |
             E5 - - D5 E5 - G5 - | E5 - D5 - C5 - E5 - | D5 - - - F#5 - A5 - | G5 - - - - - . . |`,
  },
  floresta: { // misteriosa em Lá menor
    bpm: 92, stepsPerBar: 6, style: 'mystic', lead: 'sine', leadVol: 0.55,
    chords: 'Am F C G Am F E E Dm Am F E Am F E Am',
    melody: `A4 - C5 - E5 - | F5 - - E5 C5 - | G5 - - E5 C5 - | D5 - - B4 G4 - |
             A4 - C5 - E5 - | F5 - A5 - G5 F5 | E5 - - B4 - G#4 | E4 - - - - . |
             D5 - F5 - A5 - | C5 - E5 - A5 - | C5 - - A4 F4 - | G#4 - B4 - E5 - |
             A5 - - G5 E5 - | F5 - - E5 C5 - | D5 - E5 - B4 - | A4 - - - - . |`,
  },
  ruinas: { // sombria em Ré menor
    bpm: 72, stepsPerBar: 8, style: 'dark', lead: 'sine', leadVol: 0.55,
    chords: 'Dm Bb Gm A Dm Bb C A',
    melody: `D5 - - - F5 - E5 - | D5 - - - A#4 - - - | G4 - A#4 - D5 - C5 - | C#5 - - - A4 - - - |
             D5 - - - A5 - G5 - | F5 - - - D5 - F5 - | E5 - - - C5 - G5 - | A4 - - - - - . . |`,
  },
};

const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function noteToMidi(n) {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) return null;
  return NOTE_IDX[m[1]] + (parseInt(m[2]) + 1) * 12;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function chordNotes(name) {
  const m = /^([A-G][#b]?)(m?)$/.exec(name);
  const root = NOTE_IDX[m[1]];
  const third = m[2] ? 3 : 4;
  return { root, tones: [root, root + third, root + 7] };
}

function buildSong(def) {
  const spb = def.stepsPerBar;
  const chords = def.chords.split(/\s+/).filter(Boolean).map(chordNotes);
  const length = chords.length * spb;
  const ev = []; // {step, midi, len, inst}
  // melodia
  const toks = def.melody.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  let cur = null;
  toks.forEach((t, i) => {
    if (t === '-') { if (cur) cur.len++; }
    else if (t === '.') { cur = null; }
    else { cur = { step: i, midi: noteToMidi(t), len: 1, inst: 'lead' }; ev.push(cur); }
  });
  // acompanhamento
  chords.forEach((c, bar) => {
    const s0 = bar * spb;
    const bass = c.root + 36 + (c.root > 4 ? 0 : 12); // oitava 2/3
    const tone = k => c.tones[k % 3] + 60 + (k >= 3 ? 12 : 0);
    if (def.style === 'waltz') {
      ev.push({ step: s0, midi: bass, len: 2, inst: 'bass' });
      for (const s of [2, 4]) for (let k = 0; k < 3; k++) ev.push({ step: s0 + s, midi: tone(k), len: 1.2, inst: 'pad' });
    } else if (def.style === 'march') {
      [0, 2, 4, 6].forEach((s, j) => ev.push({ step: s0 + s, midi: bass + (j % 2 ? 7 : 0), len: 1, inst: 'bass' }));
      [1, 3, 5, 7].forEach((s, j) => ev.push({ step: s0 + s, midi: tone([0, 1, 2, 1][j]), len: 0.8, inst: 'arp' }));
      ev.push({ step: s0, inst: 'kick' }); ev.push({ step: s0 + 4, inst: 'kick' });
      for (const s of [2, 6]) ev.push({ step: s0 + s, inst: 'hat' });
    } else if (def.style === 'mystic') {
      ev.push({ step: s0, midi: bass, len: spb, inst: 'bass' });
      [0, 1, 2, 3, 2, 1].forEach((k, j) => ev.push({ step: s0 + j, midi: tone(k), len: 1, inst: 'arp' }));
    } else { // dark
      ev.push({ step: s0, midi: bass - 12, len: spb, inst: 'bass' });
      for (let k = 0; k < 3; k++) ev.push({ step: s0, midi: tone(k) - 12, len: spb, inst: 'pad' });
      ev.push({ step: s0 + 4, midi: tone(2) + 12, len: 2, inst: 'bell' });
    }
  });
  const byStep = Array.from({ length }, () => []);
  for (const e of ev) if (e.step < length) byStep[e.step].push(e);
  return { def, length, byStep, stepDur: 60 / def.bpm / 2 };
}

const Sound = {
  ctx: null, master: null, music: null, sfx: null, enabled: true,
  song: null, songId: null, step: 0, nextTime: 0, noiseBuf: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.16;
    this.sfx = c.createGain(); this.sfx.gain.value = 0.32; this.sfx.connect(this.master);
    // eco suave na música
    const delay = c.createDelay(); delay.delayTime.value = 0.27;
    const fb = c.createGain(); fb.gain.value = 0.22;
    const wet = c.createGain(); wet.gain.value = 0.35;
    this.music.connect(this.master); this.music.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);
    const len = c.sampleRate * 1;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.tick(), 40);
    // aba escondida = silêncio (evita duas abas do jogo tocando ao mesmo tempo)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  },
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  },
  // troca de música com transição: a antiga baixa e é cortada; nunca tocam duas juntas
  playSong(id) {
    if (!this.ctx || this.songId === id || !SONGS[id]) return;
    const c = this.ctx, now = c.currentTime;
    if (this.bus) {
      const old = this.bus;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 0.6);
      setTimeout(() => { try { old.disconnect(); } catch (e) { } }, 900);
    }
    this.bus = c.createGain();
    this.bus.gain.setValueAtTime(0, now);
    this.bus.gain.linearRampToValueAtTime(1, now + 0.8);
    this.bus.connect(this.music);
    this.songId = id; this.song = buildSong(SONGS[id]); this.step = 0;
    this.nextTime = now + 0.5;
  },
  tick() {
    if (!this.song || !this.ctx) return;
    const s = this.song;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      for (const e of s.byStep[this.step]) this.playEvent(e, this.nextTime, s);
      this.nextTime += s.stepDur;
      this.step = (this.step + 1) % s.length;
    }
  },
  playEvent(e, t, s) {
    const dur = (e.len || 1) * s.stepDur;
    const d = s.def, bus = this.bus;
    switch (e.inst) {
      case 'lead': this.tone(mtof(e.midi), t, dur * 0.95, d.lead, d.leadVol, bus); break;
      case 'bass': this.tone(mtof(e.midi), t, dur * 0.9, d.style === 'march' ? 'triangle' : 'sine', 0.55, bus); break;
      case 'pad': this.tone(mtof(e.midi), t, dur, 'sine', d.style === 'dark' ? 0.09 : 0.12, bus, 0.05); break;
      case 'arp': this.tone(mtof(e.midi), t, dur, 'triangle', 0.13, bus); break;
      case 'bell': this.tone(mtof(e.midi), t, dur, 'sine', 0.12, bus, 0.005, true); break;
      case 'kick': this.kick(t, bus); break;
      case 'hat': this.noise(t, 0.04, 0.06, 7000, 'highpass', bus); break;
    }
  },
  tone(freq, t, dur, type, vol, dest, attack = 0.01, bell = false) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    if (bell) g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    else { g.gain.setTargetAtTime(vol * 0.6, t + attack, dur * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, 0.05); }
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.8);
  },
  sweep(f0, f1, t, dur, type, vol, dest = this.sfx) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(t, dur, vol, freq, ftype, dest = this.sfx) {
    const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  },
  kick(t, dest = this.music) { this.sweep(140, 45, t, 0.18, 'sine', 0.7, dest); },
  arp(notes, t, gap, type, vol) { notes.forEach((n, i) => this.tone(mtof(noteToMidi(n)), t + i * gap, gap * 1.6, type, vol, this.sfx)); },

  play(name) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'hit': this.noise(t, 0.07, 0.6, 1400, 'bandpass'); this.sweep(180, 60, t, 0.09, 'sine', 0.5); break;
      case 'crit': this.noise(t, 0.1, 0.8, 1800, 'bandpass'); this.sweep(900, 1800, t, 0.12, 'square', 0.15); break;
      case 'miss': this.noise(t, 0.12, 0.25, 3000, 'highpass'); break;
      case 'swing': this.noise(t, 0.08, 0.2, 2500, 'highpass'); break;
      case 'bow': this.sweep(600, 200, t, 0.1, 'triangle', 0.25); break;
      case 'magic': this.sweep(300, 1400, t, 0.3, 'sine', 0.35); this.sweep(450, 2000, t + 0.05, 0.25, 'triangle', 0.12); break;
      case 'fire': this.noise(t, 0.35, 0.5, 600, 'lowpass'); this.sweep(200, 90, t, 0.3, 'sawtooth', 0.12); break;
      case 'ice': this.sweep(2400, 900, t, 0.25, 'triangle', 0.25); this.noise(t, 0.15, 0.2, 5000, 'highpass'); break;
      case 'zap': this.noise(t, 0.2, 0.5, 4000, 'bandpass'); this.sweep(1600, 300, t, 0.2, 'square', 0.12); break;
      case 'quake': this.noise(t, 0.5, 0.8, 200, 'lowpass'); this.sweep(90, 35, t, 0.5, 'sine', 0.8); break;
      case 'holy': this.arp(['C6', 'E6', 'G6', 'C7'], t, 0.05, 'sine', 0.2); break;
      case 'heal': this.arp(['C6', 'E6', 'G6'], t, 0.07, 'sine', 0.25); break;
      case 'buff': this.arp(['G5', 'B5', 'D6', 'G6'], t, 0.06, 'triangle', 0.2); break;
      case 'levelup': this.arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], t, 0.08, 'triangle', 0.3); break;
      case 'card': this.arp(['G6', 'B6', 'D7', 'G7', 'D7', 'G7'], t, 0.07, 'sine', 0.25); this.arp(['G5', 'D6', 'G6'], t + 0.05, 0.14, 'triangle', 0.18); break;
      case 'pickup': this.sweep(880, 1320, t, 0.08, 'square', 0.12); break;
      case 'coin': this.tone(1320, t, 0.06, 'square', 0.12, this.sfx); this.tone(1760, t + 0.07, 0.12, 'square', 0.12, this.sfx); break;
      case 'mdie': this.sweep(420, 70, t, 0.35, 'square', 0.12); break;
      case 'hurt': this.sweep(220, 80, t, 0.12, 'sawtooth', 0.2); break;
      case 'death': this.arp(['E5', 'C5', 'A4', 'E4'], t, 0.22, 'triangle', 0.3); break;
      case 'portal': this.sweep(200, 1200, t, 0.5, 'sine', 0.3); this.noise(t, 0.5, 0.2, 1200, 'bandpass'); break;
      case 'click': this.tone(1800, t, 0.02, 'square', 0.06, this.sfx); break;
      case 'error': this.tone(220, t, 0.08, 'square', 0.1, this.sfx); this.tone(180, t + 0.09, 0.1, 'square', 0.1, this.sfx); break;
      case 'slam': this.noise(t, 0.6, 1, 150, 'lowpass'); this.sweep(70, 30, t, 0.6, 'sine', 1); break;
    }
  },
};
