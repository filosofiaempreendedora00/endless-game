/* =========================================================================
   DIA E NOITE (P-020) — segue o relógio do jogo (routines3d: 1 s real = 1 min,
   dia de 24 min; a hora vem do relógio do computador, então todos os jogadores
   online veem o mesmo céu sem sincronizar nada).

   - céu em degradê que muda (madrugada, amanhecer, dia, pôr do sol, noite)
     com ESTRELAS que cintilam, LUA com fase (muda a cada dia de jogo) e sol;
   - a luz direcional segue o sol de dia e a lua à noite (sombras longas no fim
     da tarde), luz de hemisfério, exposição e névoa acompanham;
   - à noite janelas, tochas, lampiões e braseiros ACENDEM (emissivo + vlight do
     pool — nunca PointLight direto); de dia ficam discretos;
   - nuvens e clima (neve, areia, névoa) tingidos pela luz;
   - dentro de salas, arena e masmorras nada muda (luz própria);
   - custo baixo: o céu e os materiais atualizam algumas vezes por segundo,
     sem recompilar shaders (só cor/intensidade mudam).
   ========================================================================= */
import * as THREE from 'three';
import { VLIGHTS } from './lights3d.js';
import { gameMinutes } from './routines3d.js';

// quadros-chave por hora: céu (topo/horizonte), tinta da névoa, luz principal, hemisfério, exposição e "noite" (0 = dia, 1 = noite: acende as luzes)
const K = (h, top, hor, fog, sunC, sunI, hs, hg, hi, exp, night, cloud) => ({ h, top: new THREE.Color(top), hor: new THREE.Color(hor), fog: new THREE.Color(fog), sunC: new THREE.Color(sunC), sunI, hs: new THREE.Color(hs), hg: new THREE.Color(hg), hi, exp, night, cloud: new THREE.Color(cloud) });
const NIGHT = ['#060a1a', '#18213e', '#59647e', '#9db4ee', 0.45, '#5b6b9a', '#1b2230', 0.62, 1.0, 1, '#4a5470'];
const DAY = ['#4f9be8', '#cfe7ff', '#cfe7ff', '#fff1d0', 2.4, '#d8ecff', '#5a6b3a', 1.1, 1.05, 0, '#ffffff'];
const KEYS = [
  K(0, ...NIGHT),
  K(4.4, ...NIGHT),
  K(5.4, '#26305e', '#d68a74', '#a88a8c', '#ffb28a', 0.9, '#8f98c4', '#3e3a38', 0.72, 1.0, 0.65, '#c89a98'), // amanhecer rosado
  K(6.5, '#4a7fd0', '#f4c896', '#e6d2bc', '#ffd6a0', 1.7, '#c4d4f2', '#55593a', 0.95, 1.04, 0.25, '#ffe2c8'), // manhã dourada
  K(8.5, ...DAY),
  K(16.3, ...DAY),
  K(17.6, '#4a78c8', '#ffd0a0', '#f2d6b8', '#ffcf94', 2.0, '#e2d8cc', '#5c5a3a', 1.0, 1.05, 0.15, '#ffe6cc'),
  K(18.6, '#33427e', '#ff9a5a', '#e4a888', '#ff9a62', 1.35, '#c8a8b4', '#4a3e36', 0.86, 1.03, 0.45, '#ffb48a'), // pôr do sol laranja
  K(19.6, '#1c1f4a', '#a0547a', '#7a6286', '#c87a8a', 0.7, '#7a74a6', '#2a2630', 0.7, 1.0, 0.85, '#8a6a8a'), // crepúsculo roxo
  K(20.6, ...NIGHT),
  K(24, ...NIGHT),
];
const FOG_DAY = new THREE.Color('#cfe7ff');

let C = null; // contexto: scene, renderer, hemi, sun, sky, getClouds, setWeatherLight
const st = { t: 0, acc: 9, cur: null, nightK: 0, sunDir: new THREE.Vector3(0.45, 0.85, 0.3), skyCols: null, lightK: 1, inside: false, lastInside: null };
const cur = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sunC: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), cloud: new THREE.Color(), sunI: 2.4, hi: 1.1, exp: 1.05, night: 0 };

function sample(hours) {
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) if (hours >= KEYS[i].h && hours <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const k0 = (hours - a.h) / Math.max(1e-3, b.h - a.h), k = k0 * k0 * (3 - 2 * k0); // suave
  for (const f of ['top', 'hor', 'fog', 'sunC', 'hs', 'hg', 'cloud']) cur[f].copy(a[f]).lerp(b[f], k);
  for (const f of ['sunI', 'hi', 'exp', 'night']) cur[f] = a[f] + (b[f] - a[f]) * k;
  return cur;
}

/* ---------- estrelas, lua e sol (filhos do céu, que acompanha a câmera) ---------- */
function makeStars() {
  const n = 1500, pos = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random(), v = Math.random() * 0.92 + 0.08, th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(th) * r * 840; pos[i * 3 + 1] = y * 840; pos[i * 3 + 2] = Math.sin(th) * r * 840;
    ph[i] = Math.random() * 6.28; sz[i] = Math.random() < 0.06 ? 2.6 + Math.random() * 1.4 : 1.1 + Math.random() * 1.3;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float ph; attribute float sz; uniform float uT; uniform float uPx; varying float vTw;
      void main(){ vTw = 0.55 + 0.45 * sin(uT * (1.3 + fract(ph * 7.1)) + ph * 9.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = sz * uPx; }`,
    fragmentShader: `uniform float uA; varying float vTw;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vec3(0.86, 0.9, 1.0), a * uA * vTw); }`,
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9; return p;
}
function moonTex(phase) { // fase 0..1 (0 = nova, 0.5 = cheia): disco com crateras suaves e sombra da fase
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = S * 0.36, cx = S / 2;
  const glow = x.createRadialGradient(cx, cx, R * 0.9, cx, cx, S / 2); glow.addColorStop(0, 'rgba(190,210,255,0.28)'); glow.addColorStop(1, 'rgba(190,210,255,0)'); x.fillStyle = glow; x.fillRect(0, 0, S, S);
  x.save(); x.beginPath(); x.arc(cx, cx, R, 0, 7); x.clip();
  const g = x.createRadialGradient(cx - R * 0.3, cx - R * 0.3, R * 0.1, cx, cx, R); g.addColorStop(0, '#f4f2ea'); g.addColorStop(1, '#c9cbd2'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 22; k++) { const a = r() * 6.28, d = r() * R * 0.85, rr = 4 + r() * 18; x.fillStyle = `rgba(120,124,140,${0.12 + r() * 0.16})`; x.beginPath(); x.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, rr, 0, 7); x.fill(); }
  // sombra da fase: um disco escuro que desliza sobre a lua (crescente → cheia → minguante); nunca some de todo (lua "nova" fica um fio)
  const f = Math.min(0.94, Math.max(0.12, (1 - Math.cos(phase * Math.PI * 2)) / 2)), side = phase < 0.5 ? -1 : 1;
  x.globalCompositeOperation = 'source-atop'; const sh = x.createRadialGradient(cx + side * R * 2 * f, cx, R * 0.8, cx + side * R * 2 * f, cx, R * 1.05);
  sh.addColorStop(0, 'rgba(16,20,38,0.92)'); sh.addColorStop(1, 'rgba(16,20,38,0)'); x.fillStyle = sh; x.beginPath(); x.arc(cx + side * R * 2 * f, cx, R * 1.05, 0, 7); x.fill();
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sunTex() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,252,236,1)'); g.addColorStop(0.18, 'rgba(255,240,200,0.95)'); g.addColorStop(0.4, 'rgba(255,214,150,0.28)'); g.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- luzes que acendem à noite ---------- */
const warm = c => c.r > 0.35 && c.r >= c.b * 1.25 && c.r + c.g > 0.8;
const MATS = new Map(); // material → intensidade original
const seenMesh = new WeakSet();
function scanLights() {
  const walk = o => {
    if (!o.visible && o !== C.scene) { /* objetos ocultos ainda entram (cidades culladas), só não andamos em personagens */ }
    const u = o.userData; if (u && (u.ref || u.human || u.pet || u.noDayNight)) return;
    for (const ch of o.children) { if (ch.userData && ch.userData.ref) return; }
    if (o.isMesh && !seenMesh.has(o)) {
      seenMesh.add(o);
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || MATS.has(m) || !m.emissive || m.blending === THREE.AdditiveBlending) continue;
        const ei = m.emissiveIntensity ?? 1; if (ei <= 0 || !warm(m.emissive)) continue;
        MATS.set(m, ei);
      }
    }
    for (const ch of o.children) walk(ch);
  };
  walk(C.scene);
}
function applyLights(nightK, neutral) {
  const k = neutral ? 1 : 0.22 + nightK * 1.05; // de dia discretas (22%), à noite acesas (até ~127%)
  for (const [m, base] of MATS) m.emissiveIntensity = base * k;
  const kv = neutral ? 1 : 0.35 + nightK * 0.95;
  for (const o of VLIGHTS) {
    if (o.userData.dnBase == null) { if (!warm(o.color)) { o.userData.dnBase = -1; continue; } o.userData.dnBase = o.intensity; }
    if (o.userData.dnBase < 0) continue;
    o.intensity = o.userData.dnBase * kv;
  }
}

/* ---------- API ---------- */
export function initDayNight(ctx) {
  C = ctx;
  const geo = C.sky.geometry; st.skyY = []; const P = geo.attributes.position; for (let i = 0; i < P.count; i++) st.skyY.push(P.getY(i) / 880);
  st.dir = []; for (let i = 0; i < P.count; i++) st.dir.push(new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)).normalize());
  st.stars = makeStars(); C.sky.add(st.stars);
  st.day = Math.floor(Date.now() / 1000 / 1440);
  st.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(((st.day % 8) + 0.5) / 8), transparent: true, depthWrite: false, fog: false })); st.moon.scale.setScalar(120); st.moon.renderOrder = -8; C.sky.add(st.moon);
  st.sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); st.sunS.scale.setScalar(150); st.sunS.renderOrder = -8; C.sky.add(st.sunS);
  st.inited = true;
}
export function dayNightHours() { return gameMinutes() / 60; }
export function isNight() { return st.nightK > 0.5; }
export function dayNightState() { return { hours: dayNightHours(), night: st.nightK, inside: st.inside }; }

// chamada a cada quadro (barato); o trabalho pesado roda poucas vezes por segundo
export function updateDayNight(dt, focus, inside) {
  if (!st.inited) return;
  st.t += dt; st.acc += dt; st.scanT = (st.scanT || 0) + dt;
  st.stars.material.uniforms.uT.value = st.t; st.stars.material.uniforms.uPx.value = Math.min(2, C.renderer.getPixelRatio()) * 1.2;
  st.inside = !!inside;
  if (st.scanT > (st.t < 90 ? 4 : 15) || st.lastInside !== st.inside) { st.scanT = 0; scanLights(); } // o mundo é montado aos poucos (P-010): procura luzes novas com frequência no começo, depois de vez em quando
  if (!st.inside) skyBodies(); // S-391: sol, lua e direção da luz andam a CADA QUADRO, com a hora fracionada (antes: pulinhos a cada minuto do jogo e a lua trocando de lado de uma vez às 18h54)
  if (st.acc < 0.2 && st.lastInside === st.inside) { placeSun(focus); return; }
  st.acc = 0; st.lastInside = st.inside;
  const h = dayNightHours(), s = sample(h);
  st.nightK = s.night;
  if (inside) { // salas, arena e masmorras: luz própria, sem céu de noite
    C.hemi.color.set('#d8ecff'); C.hemi.groundColor.set('#5a6b3a'); C.hemi.intensity = 1.1; C.sun.color.set('#fff1d0'); C.sun.intensity = 2.4; C.renderer.toneMappingExposure = 1.05;
    st.lightK = 1; applyLights(0, true); st.stars.material.uniforms.uA.value = 0; if (C.setWeatherLight) C.setWeatherLight(new THREE.Color(1, 1, 1));
    st.sunDir.set(0.45, 0.85, 0.3).normalize(); placeSun(focus); return;
  }
  C.hemi.color.copy(s.hs); C.hemi.groundColor.copy(s.hg); C.hemi.intensity = s.hi;
  C.sun.color.copy(s.sunC); C.sun.intensity = s.sunI; C.renderer.toneMappingExposure = s.exp;
  // céu: degradê + brilho quente perto do sol no amanhecer/pôr do sol
  const cols = C.sky.geometry.attributes.color, glowK = Math.max(0, 1 - Math.abs(h - 6.2) / 1.6) + Math.max(0, 1 - Math.abs(h - 18.7) / 1.6), glow = new THREE.Color('#ffb070'), tmp = new THREE.Color();
  for (let i = 0; i < cols.count; i++) {
    const k = Math.max(0, st.skyY[i]); tmp.copy(s.hor).lerp(s.top, Math.pow(k, 0.6));
    if (glowK > 0.01) { const d = Math.max(0, st.dir[i].dot(st.celest)); tmp.lerp(glow, Math.min(0.75, glowK * Math.pow(d, 6) * (1 - k * 0.7))); }
    cols.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  cols.needsUpdate = true;
  st.stars.material.uniforms.uA.value = Math.max(0, (s.night - 0.45) / 0.55);
  // nuvens e clima tingidos
  const cl = C.getClouds && C.getClouds(); if (cl) for (const L of cl) L.im.material.color.copy(s.cloud);
  st.lightK = 1 - s.night * 0.62;
  if (C.setWeatherLight) C.setWeatherLight(new THREE.Color(st.lightK, st.lightK, Math.min(1, st.lightK + s.night * 0.12)));
  applyLights(s.night, false);
  skyBodies();
  const today = Math.floor(Date.now() / 1000 / 1440); if (today !== st.day) { st.day = today; st.moon.material.map.dispose(); st.moon.material.map = moonTex(((today % 8) + 0.5) / 8); st.moon.material.needsUpdate = true; }
  placeSun(focus);
}
// hora com fração (o relógio do jogo anda 1 minuto por segundo real; a posição dos astros precisa ser contínua)
function hoursF() { const o = globalThis.__aethraClock, D = 1440, m = o != null ? ((o % D) + D) % D : (Date.now() / 1000) % D; return m / 60; }
const _sl = new THREE.Vector3(), _ml = new THREE.Vector3();
function skyBodies() {
  const h = hoursF(), sa = (h - 6) / 12 * Math.PI, ma = sa + Math.PI; // o sol nasce às 6h no leste; a lua fica do lado oposto (nasce às 18h)
  st.celest = st.celest || new THREE.Vector3(); st.celest.set(Math.cos(sa) * 0.95, Math.sin(sa), 0.32).normalize();
  const mDir = _ml.set(Math.cos(ma) * 0.95, Math.sin(ma), 0.32).normalize();
  // luz: do sol de dia, da lua de noite, passando de um para o outro devagar no crepúsculo (sem pulo de sombra)
  const dayK = Math.min(1, Math.max(0, (Math.sin(sa) + 0.1) / 0.18)), dk = dayK * dayK * (3 - 2 * dayK);
  _sl.set(Math.cos(sa) * 0.95, Math.max(0.16, Math.sin(sa)), 0.32).normalize();
  st.sunDir.set(Math.cos(ma) * 0.95, Math.max(0.16, Math.sin(ma)) * 0.85, 0.32).normalize().lerp(_sl, dk).normalize();
  const n = st.nightK || 0;
  st.sunS.position.copy(st.celest).multiplyScalar(800); st.sunS.visible = st.celest.y > -0.05; st.sunS.material.opacity = Math.min(1, (st.celest.y + 0.05) * 6) * (1 - n * 0.9);
  st.moon.position.copy(mDir).multiplyScalar(790); st.moon.visible = mDir.y > -0.05; st.moon.material.opacity = Math.max(0.12, n) * Math.min(1, (mDir.y + 0.05) * 6);
}
function placeSun(focus) { if (!focus) return; C.sun.position.set(focus.x + st.sunDir.x * 80, focus.y + st.sunDir.y * 80, focus.z + st.sunDir.z * 80); C.sun.target.position.set(focus.x, focus.y, focus.z); }
// névoa: a cor da região multiplicada pela tinta da hora (névoa azul-escura à noite, dourada no amanhecer)
export function tintFog(color) { if (!st.inited || st.inside) return; color.multiply(_fm.copy(cur.fog).multiply(_inv)); }
const _fm = new THREE.Color(), _inv = new THREE.Color(1 / FOG_DAY.r, 1 / FOG_DAY.g, 1 / FOG_DAY.b);
