/* =========================================================================
   VIDA AMBIENTE (P-024) — pássaros, gaivotas, borboletas, vaga-lumes e peixes
   Pedido do Roberto: "bem sutis, pequenos, não podem dar lag e não podem se
   parecer com os monstros". Por isso:
   - tudo é minúsculo e distante, sem olhos nem rosto, sem placa, sem colisão,
     não é alvo e não aparece no Bestiário;
   - cada tipo é UMA chamada de desenho (InstancedMesh / Points) com um pool
     pequeno reciclado só perto da câmera; nada de PointLight;
   - some dentro de salas, masmorras e da Arena (x > HALF + 100 ou inside);
   - opção "Vida ambiente" nas Configurações (localStorage 'aethra_fauna').
   ========================================================================= */
import * as THREE from 'three';
import { heightAt, biome, HALF, LAKE, lakeDist, SEA, seaDist, PORT } from './world3d.js';
import { gameMinutes } from './routines3d.js';

let F = null, enabled = true;
try { enabled = localStorage.getItem('aethra_fauna') !== '0'; } catch (e) { }
export function faunaEnabled() { return enabled; }
export function setFaunaEnabled(v) { enabled = !!v; try { localStorage.setItem('aethra_fauna', enabled ? '1' : '0'); } catch (e) { } if (F && !enabled) hideAll(); }

const uTime = { value: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const rnd = (a, b) => a + Math.random() * (b - a);

// asas que batem no vértice: a altura de cada vértice da asa oscila com |x| (o corpo, no centro, fica parado)
function flapMaterial(base, side = THREE.DoubleSide) {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', side, ...base });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aFlap; attribute float aPh; attribute float aFreq;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n float wing = abs(position.x); transformed.y += wing * aFlap * sin(uTime * aFreq + aPh);');
  };
  return m;
}
function flapAttrs(geo, n) {
  for (const [k, v] of [['aFlap', 0], ['aPh', 0], ['aFreq', 10]]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(v), 1); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); }
}
// pássaro: silhueta pequena (corpo afilado + duas asas), sem cabeça grande nem olhos — envergadura ~0,32 m
function birdGeo() {
  const v = [
    // corpo (losango fino ao longo de z)
    0, 0.012, 0.09, -0.016, 0, 0, 0.016, 0, 0,
    0, 0.012, 0.09, 0.016, 0, 0, 0, -0.01, 0,
    0, 0.012, 0.09, 0, -0.01, 0, -0.016, 0, 0,
    -0.016, 0, 0, 0, 0.008, -0.11, 0.016, 0, 0,
    0.016, 0, 0, 0, 0.008, -0.11, 0, -0.01, 0,
    0, -0.01, 0, 0, 0.008, -0.11, -0.016, 0, 0,
    // asas (ponta mais para trás, como silhueta de andorinha)
    -0.014, 0.004, 0.035, -0.16, 0.0, -0.035, -0.014, 0.004, -0.03,
    0.014, 0.004, 0.035, 0.014, 0.004, -0.03, 0.16, 0.0, -0.035,
    // cauda curta
    -0.012, 0.006, -0.1, 0, 0.006, -0.16, 0.012, 0.006, -0.1,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
// borboleta: duas asas arredondadas (leque), sem corpo marcado — 6–7 cm
function butterflyGeo() {
  const v = [], fan = (s) => { const n = 7; for (let i = 0; i < n; i++) { const a0 = -1.1 + (i / n) * 2.2, a1 = -1.1 + ((i + 1) / n) * 2.2, r0 = 0.03 + 0.008 * Math.cos(a0 * 2), r1 = 0.03 + 0.008 * Math.cos(a1 * 2); v.push(0, 0, 0, s * Math.cos(a0) * r0, 0, Math.sin(a0) * r0, s * Math.cos(a1) * r1, 0, Math.sin(a1) * r1); } };
  fan(1); fan(-1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
// peixinho (só aparece pulando, de longe): fuso prateado de 18 cm
function fishGeo() { const g = new THREE.SphereGeometry(0.05, 8, 6); g.scale(0.55, 0.7, 1.9); return g; }
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const NB = 30, NBF = 16, NFF = 70, NR = 6, NFI = 2;
export function initFauna(scene) {
  // pássaros e gaivotas (mesma malha; gaivota = branca e maior, plana mais)
  const bg = birdGeo(); flapAttrs(bg, NB);
  const birds = new THREE.InstancedMesh(bg, flapMaterial({}), NB); birds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NB * 3), 3);
  // borboletas
  const fg = butterflyGeo(); flapAttrs(fg, NBF);
  const bflies = new THREE.InstancedMesh(fg, flapMaterial({ emissive: '#222018' }), NBF); bflies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NBF * 3), 3);
  // vaga-lumes: pontinhos aditivos que piscam (um shader, um draw)
  const pg = new THREE.BufferGeometry(), pp = new Float32Array(NFF * 3), pa = new Float32Array(NFF);
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3).setUsage(THREE.DynamicDrawUsage)); pg.setAttribute('aA', new THREE.BufferAttribute(pa, 1).setUsage(THREE.DynamicDrawUsage));
  const pm = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, uScale: { value: 260 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aA; varying float vA; uniform float uScale; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(uScale * 0.12 / max(0.5, -mv.z), 1.5, 14.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.82,1.0,0.42) * t.a * vA, 1.0); }',
  });
  const flies = new THREE.Points(pg, pm); flies.frustumCulled = false;
  // anéis na água e peixinho saltando
  const rg = new THREE.RingGeometry(0.86, 1, 28); rg.rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }), NR);
  rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NR * 3), 3);
  const fish = new THREE.InstancedMesh(fishGeo(), new THREE.MeshStandardMaterial({ color: '#9aa6ae', metalness: 0.6, roughness: 0.35 }), NFI);
  for (const o of [birds, bflies, rings, fish]) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; o.count = 0; scene.add(o); }
  scene.add(flies); flies.visible = false;
  F = { birds, bflies, flies, rings, fish, flocks: [], bf: [], ff: [], rg: [], fi: [], t: 0, ringT: 1, flyK: 0, dayK: 1, budget: 0 };
  for (let i = 0; i < NBF; i++) F.bf.push({ on: false });
  for (let i = 0; i < NFF; i++) F.ff.push({ on: false });
  for (let i = 0; i < NR; i++) F.rg.push({ on: false });
  for (let i = 0; i < NFI; i++) F.fi.push({ on: false });
  return F;
}
function hideAll() { if (!F) return; F.birds.count = 0; F.bflies.count = 0; F.rings.count = 0; F.fish.count = 0; F.flies.visible = false; F.flocks.length = 0; for (const a of [F.bf, F.ff, F.rg, F.fi]) for (const o of a) o.on = false; }

// onde cada coisa pode existir
const outside = (x, z) => Math.abs(x) < HALF && Math.abs(z) < HALF;
function greenK(x, z) { const b = biome(x, z); return 1 - Math.min(1, (b.geada || 0) * 1.6 + (b.dunas || 0) * 1.6 + (b.colossos || 0) * 0.9); }
const nearPort = (x, z) => Math.hypot(x - PORT.x, z - PORT.z) < 130 || seaDist(x, z) < 30;

/* ---------------- pássaros: bandos esparsos, longe; às vezes pousam no chão e levantam voo ---------------- */
function newFlock(cx, cz) {
  for (let tries = 0; tries < 6; tries++) {
    const a = Math.random() * 6.28, r = rnd(45, 110), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!outside(x, z)) continue;
    const gull = nearPort(x, z), gk = greenK(x, z); if (!gull && gk < 0.25 && Math.random() < 0.8) continue; // quase nada na neve/deserto
    const n = gull ? 3 + (Math.random() * 3 | 0) : 4 + (Math.random() * 5 | 0), m = [];
    for (let i = 0; i < n; i++) m.push({ ox: rnd(-3.5, 3.5), oz: rnd(-3.5, 3.5), oy: rnd(-1.2, 1.2), ph: Math.random() * 6.28, x: 0, y: 0, z: 0, gy: 0, hop: Math.random() * 3 });
    return { x, z, y: heightAt(x, z) + rnd(22, 38), head: Math.random() * 6.28, turn: rnd(-0.25, 0.25), sp: gull ? rnd(5, 7) : rnd(6.5, 9), alt: rnd(22, 38), gull, m, mode: 'fly', modeT: rnd(14, 28), land: null };
  }
  return null;
}
function stepBirds(dt, cam, P) {
  const L = F.flocks, cx = cam.position.x, cz = cam.position.z, want = F.dayK > 0.4 ? (nearPort(cx, cz) ? 4 : 3) : 0;
  while (L.length < want) { const f = newFlock(cx, cz); if (!f) break; L.push(f); }
  if (L.length > want && L[0].mode === 'fly') L.shift();
  let k = 0;
  for (let fi = L.length - 1; fi >= 0; fi--) {
    const f = L[fi];
    if (Math.hypot(f.x - cx, f.z - cz) > 170 || (F.dayK < 0.25 && f.mode === 'fly')) { L.splice(fi, 1); continue; }
    f.modeT -= dt;
    if (f.mode === 'fly') {
      f.turn += rnd(-0.15, 0.15) * dt; f.turn = Math.max(-0.35, Math.min(0.35, f.turn)); f.head += f.turn * dt;
      f.x += Math.sin(f.head) * f.sp * dt; f.z += Math.cos(f.head) * f.sp * dt;
      if (!outside(f.x, f.z)) f.head += Math.PI * dt; // dá meia-volta na borda do mundo
      // relevo à frente: serra alta = sobe antes e, se for muito alta, desvia (nunca atravessa montanha)
      const ahead = Math.max(heightAt(f.x + Math.sin(f.head) * 12, f.z + Math.cos(f.head) * 12), heightAt(f.x + Math.sin(f.head) * 25, f.z + Math.cos(f.head) * 25));
      if (ahead > f.y - 6) f.turn += (f.turn >= 0 ? 1 : -1) * 0.9 * dt;
      const gy = Math.max(heightAt(f.x, f.z), ahead) + f.alt; f.y += (gy - f.y) * Math.min(1, dt * (f.y < gy - f.alt * 0.5 ? 2.5 : 0.6));
      // às vezes pousa num gramado aberto, a uma distância em que o jogador vê sem que vire "monstro"
      if (f.modeT < 0 && !f.gull) { const d = Math.hypot(f.x - cx, f.z - cz); f.modeT = rnd(16, 30); if (d > 25 && d < 80 && greenK(f.x, f.z) > 0.6 && lakeDist(f.x, f.z) > LAKE.r + 3 && Math.random() < 0.55) { f.mode = 'down'; f.land = { x: f.x + Math.sin(f.head) * 10, z: f.z + Math.cos(f.head) * 10 }; } }
    } else if (f.mode === 'down') {
      const dx = f.land.x - f.x, dz = f.land.z - f.z, d = Math.hypot(dx, dz); f.head = Math.atan2(dx, dz);
      f.x += dx / Math.max(d, 0.001) * Math.min(d, 5 * dt); f.z += dz / Math.max(d, 0.001) * Math.min(d, 5 * dt);
      const gy = heightAt(f.x, f.z); f.y += (gy - f.y) * Math.min(1, dt * 1.4);
      if (d < 0.6 && f.y - gy < 0.4) { f.mode = 'ground'; f.modeT = rnd(14, 30); }
    } else if (f.mode === 'ground') {
      if (P && Math.hypot(P.x - f.x, P.z - f.z) < 13) f.modeT = 0; // o jogador chegou perto: levantam voo
      if (f.modeT <= 0) { f.mode = 'up'; f.modeT = 2.5; f.head = P ? Math.atan2(f.x - P.x, f.z - P.z) : f.head; }
    } else if (f.mode === 'up') {
      f.x += Math.sin(f.head) * 7 * dt; f.z += Math.cos(f.head) * 7 * dt; f.y += 6 * dt;
      if (f.modeT <= 0) { f.mode = 'fly'; f.modeT = rnd(20, 34); }
    }
    for (const b of f.m) {
      if (k >= NB) break;
      const grounded = f.mode === 'ground', s = f.gull ? 1.9 : 1;
      if (grounded) { // no chão: espalhados, saltinhos e bicadas, asas fechadas
        b.hop -= dt; if (b.hop < 0) { b.hop = rnd(0.8, 3); b.ox += rnd(-0.25, 0.25); b.oz += rnd(-0.25, 0.25); }
        const x = f.x + b.ox * 0.7, z = f.z + b.oz * 0.7, y = heightAt(x, z) + 0.03 + Math.max(0, Math.sin((b.hop) * 8)) * 0.03;
        _e.set(Math.sin(F.t * 3 + b.ph) > 0.7 ? 0.5 : 0, f.head + b.ph, 0); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
        F.birds.geometry.attributes.aFlap.array[k] = 0;
      } else {
        const bob = Math.sin(F.t * 1.3 + b.ph) * 0.6, x = f.x + b.ox, z = f.z + b.oz, y = f.y + b.oy + bob;
        _e.set(f.mode === 'up' ? -0.5 : 0, f.head, -f.turn * 1.4); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
        const glide = f.gull ? (Math.sin(F.t * 0.4 + b.ph) > 0.2 ? 0.08 : 0.55) : (Math.sin(F.t * 0.7 + b.ph) > 0.6 ? 0.1 : 0.7); // planam de vez em quando
        F.birds.geometry.attributes.aFlap.array[k] = glide;
      }
      F.birds.geometry.attributes.aPh.array[k] = b.ph; F.birds.geometry.attributes.aFreq.array[k] = f.gull ? 7 : 15;
      F.birds.setMatrixAt(k, _m); F.birds.setColorAt(k, _c.set(f.gull ? '#e8ecee' : '#4b4640'));
      k++;
    }
  }
  F.birds.count = k;
  if (k) { F.birds.instanceMatrix.needsUpdate = true; F.birds.instanceColor.needsUpdate = true; for (const a of ['aFlap', 'aPh', 'aFreq']) F.birds.geometry.attributes[a].needsUpdate = true; }
}

/* ---------------- borboletas: de dia, na grama, perto da câmera ---------------- */
const BF_COLORS = ['#f4f0e2', '#f2d24a', '#e8913a', '#9cc4e8', '#f0e6b0'];
function stepButterflies(dt, cam) {
  const cx = cam.position.x, cz = cam.position.z, here = greenK(cx, cz), want = F.dayK > 0.6 && here > 0.55 ? Math.round(NBF * Math.min(1, (here - 0.55) * 3) * F.dayK) : 0;
  let k = 0, active = 0;
  for (const b of F.bf) {
    if (b.on && (Math.hypot(b.x - cx, b.z - cz) > 30 || active >= want)) b.on = false;
    if (!b.on && active < want && F.budget-- > 0) { const a = Math.random() * 6.28, r = rnd(6, 22); b.x = cx + Math.cos(a) * r; b.z = cz + Math.sin(a) * r; if (greenK(b.x, b.z) < 0.55 || lakeDist(b.x, b.z) < LAKE.r) continue; b.on = true; b.h = rnd(0.35, 1.4); b.dir = Math.random() * 6.28; b.ph = Math.random() * 6.28; b.col = BF_COLORS[Math.random() * BF_COLORS.length | 0]; b.sz = rnd(0.85, 1.25); }
    if (!b.on) continue; active++;
    b.dir += Math.sin(F.t * 0.9 + b.ph) * 1.6 * dt; const sp = 0.55;
    b.x += Math.sin(b.dir) * sp * dt; b.z += Math.cos(b.dir) * sp * dt;
    const y = heightAt(b.x, b.z) + b.h + Math.sin(F.t * 3.1 + b.ph) * 0.12;
    _e.set(0, b.dir, Math.sin(F.t * 2 + b.ph) * 0.2); _q.setFromEuler(_e); _m.compose(_p.set(b.x, y, b.z), _q, _s.set(b.sz, b.sz, b.sz));
    const g = F.bflies.geometry.attributes; g.aFlap.array[k] = 1.1; g.aPh.array[k] = b.ph; g.aFreq.array[k] = 16;
    F.bflies.setMatrixAt(k, _m); F.bflies.setColorAt(k, _c.set(b.col)); k++;
  }
  F.bflies.count = k;
  if (k) { F.bflies.instanceMatrix.needsUpdate = true; F.bflies.instanceColor.needsUpdate = true; for (const a of ['aFlap', 'aPh', 'aFreq']) F.bflies.geometry.attributes[a].needsUpdate = true; }
}

/* ---------------- vaga-lumes: só à noite, em lugares verdes ou perto da água ---------------- */
function stepFireflies(dt, cam) {
  const cx = cam.position.x, cz = cam.position.z, night = 1 - F.dayK, here = Math.max(greenK(cx, cz), lakeDist(cx, cz) < LAKE.r + 25 ? 1 : 0);
  const want = night > 0.4 && here > 0.5 ? Math.round(NFF * Math.min(1, (night - 0.4) * 2.5)) : 0;
  F.flies.visible = want > 0 || F.ff.some(o => o.on); if (!F.flies.visible) return;
  const pos = F.flies.geometry.attributes.position.array, al = F.flies.geometry.attributes.aA.array; let active = 0;
  F.ff.forEach((o, i) => {
    if (o.on && (Math.hypot(o.x - cx, o.z - cz) > 32 || active >= want)) { o.fade = Math.max(0, (o.fade || 0) - dt * 2); if (o.fade <= 0) o.on = false; }
    if (!o.on && active < want && F.budget-- > 0) { const a = Math.random() * 6.28, r = rnd(4, 28); o.x = cx + Math.cos(a) * r; o.z = cz + Math.sin(a) * r; if (greenK(o.x, o.z) < 0.5) { o.on = false; } else { o.on = true; o.h = rnd(0.3, 2.2); o.ph = Math.random() * 6.28; o.fr = rnd(0.6, 1.6); o.fade = 0; o.vx = rnd(-0.2, 0.2); o.vz = rnd(-0.2, 0.2); o.gy = heightAt(o.x, o.z); o.gt = Math.random(); } }
    if (!o.on) { al[i] = 0; return; }
    active++; o.fade = Math.min(1, o.fade + dt * 0.7);
    o.x += (o.vx + Math.sin(F.t * 0.5 + o.ph) * 0.15) * dt; o.z += (o.vz + Math.cos(F.t * 0.43 + o.ph) * 0.15) * dt;
    o.gt -= dt; if (o.gt < 0) { o.gt = 1; o.gy = heightAt(o.x, o.z); } // altura do chão revista 1×/s (barato)
    pos[i * 3] = o.x; pos[i * 3 + 1] = o.gy + o.h + Math.sin(F.t * 0.8 + o.ph) * 0.25; pos[i * 3 + 2] = o.z;
    const blink = Math.max(0, Math.sin(F.t * o.fr + o.ph)); al[i] = o.fade * blink * blink * 0.95; // acende e apaga devagar
  });
  F.flies.geometry.attributes.position.needsUpdate = true; F.flies.geometry.attributes.aA.needsUpdate = true;
}

/* ---------------- água: anéis de vez em quando e, raramente, um peixinho saltando ---------------- */
function waterSpot(cx, cz) {
  if (Math.hypot(cx - LAKE.x, cz - LAKE.z) < LAKE.r + 60) { for (let t = 0; t < 5; t++) { const a = Math.random() * 6.28, r = Math.random() * LAKE.r * 0.8, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r; if (lakeDist(x, z) < LAKE.r - 1.2) return { x, z, y: LAKE.level + 0.03 }; } }
  if (seaDist(cx, cz) < 55) { for (let t = 0; t < 6; t++) { const a = Math.random() * 6.28, r = rnd(10, 45), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, d = seaDist(x, z); if (d < -4 && d > -60) return { x, z, y: SEA.level + 0.05 }; } }
  return null;
}
function stepWater(dt, cam) {
  const cx = cam.position.x, cz = cam.position.z;
  F.ringT -= dt;
  if (F.ringT < 0) { F.ringT = rnd(1.6, 4.5); const s = waterSpot(cx, cz); if (s) { const r = F.rg.find(o => !o.on); if (r) { Object.assign(r, s, { on: true, t: 0, dur: rnd(1.8, 2.6), max: rnd(0.9, 1.6) }); if (Math.random() < 0.3) { const f = F.fi.find(o => !o.on); if (f) Object.assign(f, s, { on: true, t: 0, head: Math.random() * 6.28 }); } } } }
  let k = 0;
  for (const r of F.rg) {
    if (!r.on) continue; r.t += dt; const u = r.t / r.dur; if (u >= 1) { r.on = false; continue; }
    const sc = 0.12 + u * r.max; _m.compose(_p.set(r.x, r.y, r.z), _q.identity(), _s.set(sc, 1, sc)); F.rings.setMatrixAt(k, _m); const b = (1 - u) * (1 - u); F.rings.setColorAt(k, _c.setRGB(b, b, b)); k++;
  }
  F.rings.count = k; if (k) { F.rings.instanceMatrix.needsUpdate = true; F.rings.instanceColor.needsUpdate = true; }
  let j = 0;
  for (const f of F.fi) {
    if (!f.on) continue; f.t += dt; const u = f.t / 0.65; if (u >= 1) { f.on = false; continue; }
    const x = f.x + Math.sin(f.head) * (u - 0.5) * 0.7, z = f.z + Math.cos(f.head) * (u - 0.5) * 0.7, y = f.y - 0.05 + Math.sin(u * Math.PI) * 0.55;
    _e.set(-(u - 0.5) * 2.2, f.head, 0); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)); F.fish.setMatrixAt(j++, _m);
  }
  F.fish.count = j; if (j) F.fish.instanceMatrix.needsUpdate = true;
}

/* ---------------- laço ---------------- */
export function updateFauna(dt, cam, P, inside) {
  if (!F) return;
  if (!enabled || inside || !cam || cam.position.x > HALF + 100) { if (F.birds.count || F.bflies.count || F.flies.visible || F.rings.count) hideAll(); return; }
  F.t += dt; uTime.value = F.t; F.budget = 3; // no máximo 3 "nascimentos" por quadro (nada de picos)
  const h = gameMinutes() / 60, day = h > 6 && h < 19 ? 1 : h > 5 && h <= 6 ? h - 5 : h >= 19 && h < 20 ? 20 - h : 0; F.dayK += (day - F.dayK) * Math.min(1, dt * 0.5);
  stepBirds(dt, cam, P); stepButterflies(dt, cam); stepFireflies(dt, cam); stepWater(dt, cam);
}
export function faunaStats() { return F ? { birds: F.birds.count, butterflies: F.bflies.count, fireflies: F.ff.filter(o => o.on).length, rings: F.rings.count, fish: F.fish.count, flocks: F.flocks.length, dayK: +F.dayK.toFixed(2) } : null; }
