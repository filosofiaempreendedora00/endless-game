/* =========================================================================
   CHEFES COM MECÂNICAS (P-022) — fases por vida, ataques avisados no chão (dá para desviar),
   ondas de lacaios, enraivecer perto do fim, golpe especial, barra de chefe, música de luta e baú.

   Tudo guiado por dados (BOSS_SCRIPT por id de monstro). Determinístico, pensando no online (P-028):
   - a fase sai só da % de vida;
   - a ordem dos ataques sai de um gerador com semente (id do chefe + quantos ataques ele já fez),
     então um servidor pode reproduzir exatamente o mesmo roteiro.

   Ganchos no main3d: initBossFight(ctx) · bossTick(m, dt) no updateMonster · updateBossFights(dt) no laço ·
   bossOnDeath(m) no killMonster · bossActive() para a música da região não atropelar a de luta.
   ========================================================================= */
import * as THREE from 'three';
import { addShake } from './strikes3d.js';

/* tipos de aviso no chão:
   circle {r, at:'self'|'target'} · donut {r0, r1} · cone {len, half} · line {len, w, charge?} · rain {n, r, spread}
   wind = segundos do aviso enchendo; mul = multiplicador do golpe médio do chefe; cd = espera até o próximo */
// os roteiros ficam nos dados (js/bosses.js, var BOSS_SCRIPT) — o mesmo arquivo serve a um servidor no futuro (P-028)
export const BOSS_SCRIPT = globalThis.BOSS_SCRIPT || {};
const REWARD = { // baú do chefe: zeny por nível + o troféu garantido + uma segunda chance no item raro
  zenyPerLv: 120,
};

let C = null, barEl = null, bossSongOn = false, lastActiveT = -99;
const tele = [];   // avisos no chão ativos
const chests = []; // baús esperando o jogador

export function initBossFight(ctx) {
  C = ctx;
  barEl = document.createElement('div'); barEl.id = 'boss-bar'; barEl.className = 'hidden';
  barEl.innerHTML = '<div class="bb-name"></div><div class="bb-track"><div class="bb-fill"></div><div class="bb-mark" style="left:70%"></div><div class="bb-mark" style="left:35%"></div></div><div class="bb-phase"></div>';
  document.body.appendChild(barEl);
}

/* gerador com semente: o mesmo chefe faz sempre a mesma sequência (bom para o servidor reproduzir) */
function seeded(m) { let h = 2166136261; for (const ch of m.type) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); h ^= (m.bf.casts * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; }

function phaseOf(m, S) { const r = m.hp / m.maxHp; let ph = 0; for (const th of S.phases) if (r <= th) ph++; return Math.min(ph, S.attacks.length - 1); }

export function bossActive() { return C && C.S.time - lastActiveT < 3; }

function state(m) { return m.bf || (m.bf = { phase: 0, casts: 0, next: C.S.time + 2.5, enraged: false, addsDone: false, line0: false }); }

export function bossTick(m, dt) {
  const SCR = BOSS_SCRIPT[m.type]; if (!SCR || !C) return;
  const S = C.S, t = S.time, P0 = S.pos, st = state(m);
  if (!m.aggro) { if (st.phase || st.enraged || st.casts) resetBoss(m); return; }
  const dp = Math.hypot(P0.x - m.x, P0.z - m.z); if (dp > 55) return;
  lastActiveT = t; m._bossSeen = t;
  if (!st.line0) { st.line0 = true; say(m, SCR.lines[0], SCR.color); }
  // fase pela vida
  const ph = phaseOf(m, SCR);
  if (ph > st.phase) {
    st.phase = ph; say(m, SCR.lines[Math.min(ph, SCR.lines.length - 1)], SCR.color); roar(m);
    if (SCR.adds && ph === SCR.adds.phase && !st.addsDone) { st.addsDone = true; summonAdds(m, SCR.adds); }
    st.next = Math.min(st.next, t + 1.2);
  }
  // enraivecer
  if (!st.enraged && m.hp / m.maxHp <= SCR.enrage) { st.enraged = true; m.speedMul = 1.35; m.aspdMul = 0.7; say(m, 'ENFURECIDO!', '#ff5040'); roar(m); addShake(0.12); }
  // próximo ataque avisado
  if (t >= st.next && t >= m.lockAnim && dp < 30) {
    const list = SCR.attacks[st.phase], a = list[Math.floor(seeded(m) * list.length)];
    st.casts++; castAttack(m, SCR, a);
    st.next = t + a.wind + a.cd * (st.enraged ? 0.7 : 1);
  }
}

function resetBoss(m) { // desistiu da luta (voltou para casa): limpa tudo
  m.bf = null; m.speedMul = 1; m.aspdMul = 1;
  for (let i = tele.length - 1; i >= 0; i--) if (tele[i].m === m) { disposeTele(tele[i]); tele.splice(i, 1); }
}

function say(m, text, color) { if (!text) return; C.floatAt(m.obj.position, text, color || '#ffd76a', (m.height || 3) + 1.2, true); C.log(`${m.def.name}: “${text}”`, 'warn'); }
function roar(m) { const sx = C.MON_SFX[m.def.shape]; if (sx && (sx.pre || sx.idle)) C.Sound.play(sx.pre || (Array.isArray(sx.idle) ? sx.idle[0] : sx.idle)); }

function summonAdds(m, A) {
  if (!MONSTERS[A.type]) return;
  for (let k = 0; k < A.n; k++) {
    const a = (k / A.n) * Math.PI * 2 + m.yaw, R = 4.5 + (m.radius || 1);
    const x = m.x + Math.sin(a) * R, z = m.z + Math.cos(a) * R, pt = C.resolve(x, z, 0.6);
    C.spawnMonster(m.zoneId, A.type, { x: pt.x, z: pt.z });
    const add = C.S.monsters[C.S.monsters.length - 1]; if (add) { add.summoned = true; add.boss = m.uid; add.aggro = true; add.calmUntil = 0; }
  }
  C.log(`${m.def.name} chama reforços!`, 'warn');
}

/* ---------- avisos no chão: malha que acompanha o terreno, enchendo até explodir ---------- */
const VERT = `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FRAG = `uniform float uP; uniform vec3 uC; uniform float uFlash; varying float vT;
void main(){ float base = 0.16; float fill = step(vT, uP) * 0.32; float edge = smoothstep(0.92, 0.985, vT) * 0.75; float front = smoothstep(0.035, 0.0, abs(vT - uP)) * 0.55 * step(0.02, uP);
 float a = base + fill + edge + front + uFlash * 0.6; gl_FragColor = vec4(mix(uC, vec3(1.0,0.95,0.8), uFlash*0.6 + front*0.3), clamp(a, 0.0, 0.95)); }`;
function makeTeleMat(color) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uP: { value: 0 }, uC: { value: new THREE.Color(color) }, uFlash: { value: 0 } }, polygonOffset: true, polygonOffsetFactor: -4 });
}
// grade polar (círculo, anel e cone): aT = raio normalizado (o aviso enche do centro para fora)
function polarGeo(cx, cz, r0, r1, a0, a1, segA, segR) {
  const pos = [], tt = [], idx = [], g = C.groundAt;
  for (let i = 0; i <= segR; i++) for (let j = 0; j <= segA; j++) {
    const r = r0 + (r1 - r0) * i / segR, a = a0 + (a1 - a0) * j / segA, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    pos.push(x, g(x, z) + 0.08, z); tt.push(r1 > 0 ? (r - r0) / Math.max(0.001, r1 - r0) : 0);
  }
  for (let i = 0; i < segR; i++) for (let j = 0; j < segA; j++) { const A = i * (segA + 1) + j, B = A + segA + 1; idx.push(A, B, A + 1, A + 1, B, B + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1)); geo.setIndex(idx); return geo;
}
function lineGeo(x0, z0, yaw, len, w) { // aT = distância ao longo da linha
  const pos = [], tt = [], idx = [], g = C.groundAt, sl = Math.max(6, Math.ceil(len / 0.8)), sw = 4, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  for (let i = 0; i <= sl; i++) for (let j = 0; j <= sw; j++) {
    const l = len * i / sl, o = (j / sw - 0.5) * w, x = x0 + fx * l + rx * o, z = z0 + fz * l + rz * o;
    pos.push(x, g(x, z) + 0.08, z); tt.push(i / sl);
  }
  for (let i = 0; i < sl; i++) for (let j = 0; j < sw; j++) { const A = i * (sw + 1) + j, B = A + sw + 1; idx.push(A, B, A + 1, A + 1, B, B + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1)); geo.setIndex(idx); return geo;
}
function addTele(m, shape, color, wind, onBoom) {
  let geo;
  if (shape.kind === 'circle') geo = polarGeo(shape.x, shape.z, 0, shape.r, 0, Math.PI * 2, 48, 8);
  else if (shape.kind === 'donut') geo = polarGeo(shape.x, shape.z, shape.r0, shape.r1, 0, Math.PI * 2, 56, 6);
  else if (shape.kind === 'cone') geo = polarGeo(shape.x, shape.z, 0, shape.len, shape.yaw - shape.half, shape.yaw + shape.half, 24, 10);
  else geo = lineGeo(shape.x, shape.z, shape.yaw, shape.len, shape.w);
  const mesh = new THREE.Mesh(geo, makeTeleMat(color)); mesh.renderOrder = 3; mesh.frustumCulled = false; C.scene.add(mesh);
  const T = { m, shape, mesh, t0: C.S.time, wind, onBoom, boomed: false }; tele.push(T); return T;
}
function disposeTele(T) { C.scene.remove(T.mesh); T.mesh.geometry.dispose(); T.mesh.material.dispose(); }
function inside(shape, x, z) {
  const dx = x - shape.x, dz = z - shape.z, d = Math.hypot(dx, dz);
  if (shape.kind === 'circle') return d <= shape.r;
  if (shape.kind === 'donut') return d >= shape.r0 && d <= shape.r1;
  if (shape.kind === 'cone') { if (d > shape.len) return false; let a = Math.atan2(dx, dz) - shape.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) <= shape.half; }
  const fx = Math.sin(shape.yaw), fz = Math.cos(shape.yaw), l = dx * fx + dz * fz, o = Math.abs(dx * Math.cos(shape.yaw) - dz * Math.sin(shape.yaw)); return l >= 0 && l <= shape.len && o <= shape.w / 2;
}

function castAttack(m, SCR, a) {
  const S = C.S, t = S.time, P0 = S.pos, yaw = Math.atan2(P0.x - m.x, P0.z - m.z);
  m.yaw = yaw; m.obj.rotation.y = yaw;
  m.lockAnim = t + a.wind + 0.35; m.nextAttack = Math.max(m.nextAttack, t + a.wind + 0.8); // parado conjurando, sem golpe normal no meio
  C.floatAt(m.obj.position, a.name, SCR.color, (m.height || 3) + 0.6);
  const avg = (m.def.atk[0] + m.def.atk[1]) / 2, raw = avg * a.mul;
  const shapes = [];
  if (a.kind === 'rain') {
    for (let k = 0; k < a.n; k++) { const u = (k === 0 ? 0 : seededK(m, k)), ang = u * Math.PI * 2 + k, rr = k === 0 ? 0 : 1.5 + seededK(m, k + 17) * a.spread; shapes.push({ kind: 'circle', x: P0.x + Math.sin(ang) * rr, z: P0.z + Math.cos(ang) * rr, r: a.r }); }
  } else if (a.kind === 'circle') shapes.push({ kind: 'circle', x: a.at === 'target' ? P0.x : m.x, z: a.at === 'target' ? P0.z : m.z, r: a.r });
  else if (a.kind === 'donut') shapes.push({ kind: 'donut', x: m.x, z: m.z, r0: a.r0, r1: a.r1 });
  else if (a.kind === 'cone') shapes.push({ kind: 'cone', x: m.x, z: m.z, yaw, len: a.len, half: a.half });
  else shapes.push({ kind: 'line', x: m.x, z: m.z, yaw, len: a.len, w: a.w });
  shapes.forEach((sh, k) => addTele(m, sh, SCR.color, a.wind + (a.kind === 'rain' ? k * 0.12 : 0), () => boom(m, a, sh, raw)));
  // animação de "preparo": o bicho se agacha/ergue; o golpe sai na explosão
  if (m.vis && m.vis.anim && a.anim) C.later(Math.max(0, a.wind - 0.45), () => { if (!m.dead) C.monAnim(m, a.anim, { once: true, restart: true }); });
}
function seededK(m, k) { const st = m.bf; const keep = st.casts; st.casts = keep * 31 + k; const v = seeded(m); st.casts = keep; return v; }

function boom(m, a, sh, raw) {
  if (m.dead) return;
  const S = C.S;
  if (a.charge) { const L = Math.max(0, sh.len - (m.radius || 1)), ex = sh.x + Math.sin(sh.yaw) * L, ez = sh.z + Math.cos(sh.yaw) * L, p = C.resolve(ex, ez, m.radius || 1); m.x = p.x; m.z = p.z; }
  if (a.leap) { const p = C.resolve(sh.x, sh.z, m.radius || 1); m.x = p.x; m.z = p.z; }
  if (m.vis && m.vis.critter && m.vis.critter.attack) m.vis.critter.attack();
  if (a.sfx) C.Sound.play(a.sfx);
  addShake(a.mul >= 1.8 ? 0.16 : 0.09);
  burst(sh, BOSS_SCRIPT[m.type].color);
  if (!S.p.dead && inside(sh, S.pos.x, S.pos.z)) C.hurtPlayer(m, Math.round(raw * (0.92 + seededK(m, 3) * 0.16)));
  const pe = S.pet; if (pe && !pe.down && inside(sh, pe.x, pe.z)) C.petHurt(m, Math.round(raw * 0.6));
  const comp = C.companion && C.companion(); if (comp && comp.hurt && inside(sh, comp.x, comp.z)) comp.hurt(Math.round(raw * 0.6));
}

// explosão: anel de poeira/brasas subindo (pontos baratos, somem em ~0,8 s)
const bursts = [];
function burst(sh, color) {
  const n = sh.kind === 'line' ? 40 : sh.kind === 'cone' ? 36 : 44, pos = new Float32Array(n * 3), vel = [], g = C.groundAt;
  for (let k = 0; k < n; k++) {
    let x, z;
    if (sh.kind === 'line') { const l = Math.random() * sh.len, o = (Math.random() - 0.5) * sh.w; x = sh.x + Math.sin(sh.yaw) * l + Math.cos(sh.yaw) * o; z = sh.z + Math.cos(sh.yaw) * l - Math.sin(sh.yaw) * o; }
    else if (sh.kind === 'cone') { const r = Math.sqrt(Math.random()) * sh.len, a = sh.yaw + (Math.random() * 2 - 1) * sh.half; x = sh.x + Math.sin(a) * r; z = sh.z + Math.cos(a) * r; }
    else { const r0 = sh.kind === 'donut' ? sh.r0 : 0, r1 = sh.kind === 'donut' ? sh.r1 : sh.r, r = r0 + Math.sqrt(Math.random()) * (r1 - r0), a = Math.random() * Math.PI * 2; x = sh.x + Math.sin(a) * r; z = sh.z + Math.cos(a) * r; }
    pos[k * 3] = x; pos[k * 3 + 1] = g(x, z) + 0.2; pos[k * 3 + 2] = z; vel.push([(Math.random() - 0.5) * 1.2, 2 + Math.random() * 3.5, (Math.random() - 0.5) * 1.2]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; C.scene.add(pts); bursts.push({ pts, vel, t: 0 });
}

/* ---------- laço por quadro: avisos, explosões, baús, barra e música ---------- */
export function updateBossFights(dt) {
  if (!C) return;
  const S = C.S, t = S.time;
  for (let i = tele.length - 1; i >= 0; i--) {
    const T = tele[i], k = (t - T.t0) / T.wind;
    if (T.m.dead) { disposeTele(T); tele.splice(i, 1); continue; }
    T.mesh.material.uniforms.uP.value = Math.min(1, Math.max(0, k));
    if (!T.boomed && k >= 1) { T.boomed = true; T.tb = t; T.onBoom(); }
    if (T.boomed) { const f = (t - T.tb) / 0.3; T.mesh.material.uniforms.uFlash.value = Math.max(0, 1 - f); if (f >= 1) { disposeTele(T); tele.splice(i, 1); } }
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const B = bursts[i]; B.t += dt; const a = B.pts.geometry.attributes.position;
    for (let k = 0; k < B.vel.length; k++) { const v = B.vel[k]; v[1] -= 6 * dt; a.array[k * 3] += v[0] * dt; a.array[k * 3 + 1] += v[1] * dt; a.array[k * 3 + 2] += v[2] * dt; }
    a.needsUpdate = true; B.pts.material.opacity = Math.max(0, 0.9 * (1 - B.t / 0.8));
    if (B.t > 0.8) { C.scene.remove(B.pts); B.pts.geometry.dispose(); B.pts.material.dispose(); bursts.splice(i, 1); }
  }
  updateChests(dt);
  // barra do chefe: o chefe em luta mais perto
  let best = null, bd = 1e9;
  for (const m of S.monsters) { if (m.dead || !BOSS_SCRIPT[m.type] || !m.aggro || t - (m._bossSeen || -9) > 1) continue; const d = Math.hypot(m.x - S.pos.x, m.z - S.pos.z); if (d < bd) { bd = d; best = m; } }
  if (best) {
    const SCR = BOSS_SCRIPT[best.type], st = best.bf || {}, r = Math.max(0, best.hp / best.maxHp);
    barEl.classList.remove('hidden');
    barEl.querySelector('.bb-name').textContent = best.def.name;
    barEl.querySelector('.bb-fill').style.width = (r * 100).toFixed(1) + '%';
    barEl.querySelector('.bb-fill').style.background = st.enraged ? 'linear-gradient(90deg,#8a1010,#ff4030)' : `linear-gradient(90deg,#5a1a10,${SCR.color})`;
    const marks = barEl.querySelectorAll('.bb-mark'); marks.forEach((mk, i) => { const th = SCR.phases[i]; mk.style.display = th ? '' : 'none'; if (th) mk.style.left = (th * 100) + '%'; });
    barEl.querySelector('.bb-phase').textContent = `${Math.ceil(r * 100)}% · Fase ${(st.phase || 0) + 1}${st.enraged ? ' · ENFURECIDO' : ''}`;
  } else if (!barEl.classList.contains('hidden')) barEl.classList.add('hidden');
  // música de chefe: entra na luta, volta à da região depois
  const act = bossActive();
  if (act && !bossSongOn && C.Sound.ctx) { bossSongOn = true; C.Sound.playSong('chefe'); }
  else if (!act && bossSongOn) { bossSongOn = false; C.restoreMusic(); }
}

/* ---------- vitória: banner, baú com recompensa ---------- */
export function bossOnDeath(m) {
  const SCR = BOSS_SCRIPT[m.type]; if (!SCR || !C) return;
  for (let i = tele.length - 1; i >= 0; i--) if (tele[i].m === m) { disposeTele(tele[i]); tele.splice(i, 1); }
  C.banner(SCR.mini ? 'Vitória!' : '⚔ CHEFE DERROTADO ⚔', m.def.name.toUpperCase());
  C.Sound.play('levelup');
  for (const a of C.S.monsters) if (a.boss === m.uid && !a.dead) { // lacaios se desfazem com o chefe (sem EXP nem saque)
    a.dead = true; a.hp = 0; a.deathT = C.S.time; a.deathStyle = 'raro'; a.deathSide = 1;
    if (C.S.target === a) { C.S.target = null; C.S.autoAttack = false; }
  }
  if (!SCR.mini || Math.random() < 0.5) spawnChest(m);
  lastActiveT = -99;
}
function chestMesh() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.8 }), iron = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), wood); base.position.y = 0.28; g.add(base);
  for (const x of [-0.42, 0, 0.42]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.57, 0.72), iron); b.position.set(x, 0.28, 0); g.add(b); }
  const lid = new THREE.Group(); lid.position.set(0, 0.55, -0.35); g.add(lid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 20, 1, false, 0, Math.PI), wood); top.rotation.z = Math.PI / 2; top.position.set(0, 0, 0.35); lid.add(top);
  for (const x of [-0.42, 0, 0.42]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.07, 20, 1, false, 0, Math.PI), iron); b.rotation.z = Math.PI / 2; b.position.set(x, 0, 0.35); lid.add(b); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), iron); lock.position.set(0, 0.45, 0.37); g.add(lock);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.lid = lid; return g;
}
function spawnChest(m) {
  const obj = chestMesh(), x = m.x + 1.6, z = m.z + 1.2; obj.position.set(x, C.groundAt(x, z), z); obj.rotation.y = m.yaw + Math.PI; C.scene.add(obj);
  chests.push({ obj, x, z, m, def: m.def, type: m.type, t0: C.S.time, open: false });
}
function updateChests(dt) {
  const S = C.S;
  for (let i = chests.length - 1; i >= 0; i--) {
    const ch = chests[i], d = Math.hypot(S.pos.x - ch.x, S.pos.z - ch.z);
    if (!ch.open && d < 2.4 && !S.p.dead) { ch.open = true; ch.tOpen = S.time; giveChest(ch); }
    if (ch.open) { const k = Math.min(1, (S.time - ch.tOpen) / 0.6); ch.obj.userData.lid.rotation.x = -k * 1.9; if (S.time - ch.tOpen > 6) { C.scene.remove(ch.obj); chests.splice(i, 1); } }
    else if (S.time - ch.t0 > 300) { C.scene.remove(ch.obj); chests.splice(i, 1); } // 5 min esperando
  }
}
function giveChest(ch) {
  const p = C.S.p, d = ch.def, z = Math.round((d.lv || 10) * REWARD.zenyPerLv);
  C.grantZeny(p, z);
  const drops = d.drops || [];
  if (drops[0]) C.addItem(p, drops[0][0], 1); // troféu garantido
  const rare = drops.filter(e => e[1] < 0.5).sort((a, b) => a[1] - b[1])[0]; // segunda chance no item mais raro
  if (rare && Math.random() < rare[1] * 1.5) { C.addItem(p, rare[0], 1); C.log(`✨ O baú guardava ${ITEMS[rare[0]].name}!`, 'card'); }
  C.Sound.play('coin');
  C.banner('Baú do chefe', `+${z} zeny${drops[0] ? ' · ' + ITEMS[drops[0][0]].name : ''}`);
  C.log(`Você abriu o baú de ${d.name}: +${z} zeny${drops[0] ? ', ' + ITEMS[drops[0][0]].name : ''}.`, 'item');
  C.touch();
}
