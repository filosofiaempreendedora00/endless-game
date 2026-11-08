/* =========================================================================
   MONSTROS FOFOS 3D feitos em código (enquanto não há modelos próprios).
   Cada função devolve { root, animate(t, moving, dt) }. Altura ~1 m * size.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';

// sombreado suave (nada de facetas quadradas)
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: false, ...extra });
const BLACK = mat('#1e1a2a', { roughness: 0.4 });
const FACE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2 });
const WHITE = mat('#ffffff', { roughness: 0.4 });

function eyes(parent, y, z, spread, r = 0.07) {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), BLACK);
    e.position.set(s * spread, y, z); parent.add(e);
    const g = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 20, 14), WHITE);
    g.position.set(s * spread + r * 0.3, y + r * 0.35, z + r * 0.8); parent.add(g);
  }
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// tubo que afina ao longo de uma curva (pescoço, rabo, orelhas, patas)
function taper(points, r0, r1, seg = 16, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i <= seg; i++) { const u = i / seg, r = r0 + (r1 - r0) * u, c = curve.getPointAt(u); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r); } }
  g.computeVertexNormals(); return g;
}
const blob = (r, sx, sy, sz, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o; };
// golpe: curva 0→1→0 em ~0,45 s (preparo, bote e volta)
const strike = k => k < 0 || k > 1 ? 0 : k < 0.35 ? -Math.sin(k / 0.35 * Math.PI / 2) * 0.35 : Math.sin((k - 0.35) / 0.65 * Math.PI);
const shadowAll = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

/* ---------- Gotinha (S-074, S-137): gota d'água viva — expressiva, translúcida e original ----------
   Corpo em forma de gota com a crista virada para trás e base derretida que escorre. Por dentro só um
   brilho suave (sem bolinhas/formas geométricas). Rosto vivo: olhos com íris, pálpebras que piscam,
   sobrancelhas de água que mudam com o humor e boca que fala, sorri e abre no ataque.
   Andando, deixa um rastro molhado no chão que vai sumindo. */
function dropGeometry() {
  const g = new THREE.SphereGeometry(0.5, 40, 30), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const v = (y + 0.5); // 0 embaixo → 1 em cima
    const pinch = 1 - Math.pow(Math.max(0, v - 0.45) / 0.55, 1.6) * 0.92; // afina para cima (gota)
    const skirt = 1 + Math.pow(Math.max(0, 0.32 - v) / 0.32, 2) * 0.55;  // base derretida mais larga
    x *= pinch * skirt; z *= pinch * skirt;
    y = y * 1.15 + 0.05;
    const tip = Math.pow(Math.max(0, v - 0.55) / 0.45, 2.2); // ponta curva para trás (crista)
    z -= tip * 0.32; y -= tip * 0.06;
    if (v < 0.08) y = Math.max(y, -0.53 + (0.08 - v) * 0.02); // fundo achatado no chão
    P.setXYZ(i, x, y, z);
  }
  g.translate(0, 0.53, 0); g.computeVertexNormals(); return g;
}
const DROP_GEO = dropGeometry();
// ponto da superfície da gota na frente (maior z perto de x,y): onde encaixar olhos e boca
function dropFront(x, y) { const P = DROP_GEO.attributes.position; let best = 0; for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - x) < 0.035 && Math.abs(P.getY(i) - y) < 0.035) best = Math.max(best, P.getZ(i)); return best; }
const GOTA_VARIANTS = {
  agua: { core: '#bff6ff', glow: 0.9 },
  fogo: { core: '#ffe08a', glow: 1.6, extra: 'embers' },
  terra: { core: '#e7ffb0', glow: 0.7, extra: 'sprout' },
  gelo: { core: '#ffffff', glow: 1.1, extra: 'crystals' },
  sombra: { core: '#d9a6ff', glow: 1.8, extra: 'wisps' },
  rei: { core: '#fff2b8', glow: 1.5, extra: 'royal' }, // Gosmão: rei das gotas
};
let TRAIL_TEX = null;
function trailTex() {
  if (TRAIL_TEX) return TRAIL_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, r = 26 + Math.sin(a * 3) * 3 + Math.sin(a * 5 + 1) * 2; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill();
  return (TRAIL_TEX = new THREE.CanvasTexture(c));
}
export function slime(color, boss, variant = 'agua') {
  const V = GOTA_VARIANTS[variant] || GOTA_VARIANTS.agua, base = new THREE.Color(color);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skinM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.8, clearcoat: 1, clearcoatRoughness: 0.06, emissive: V.core, emissiveIntensity: 0.05 * V.glow, depthWrite: false });
  const shell = new THREE.Mesh(DROP_GEO, skinM); shell.renderOrder = 2; body.add(shell);
  // por dentro: só um brilho difuso da cor do núcleo (volume, não forma)
  const innerM = new THREE.MeshBasicMaterial({ color: V.core, transparent: true, opacity: Math.min(0.32, 0.16 * V.glow), blending: THREE.AdditiveBlending, depthWrite: false });
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), innerM); inner.position.set(0, 0.3, -0.04); inner.renderOrder = 1; inner.visible = false; body.add(inner); // brilho interno: só um leve calor na cor da pele (emissive) — sem formas
  // nadadeiras laterais (pele fina, mexem como bracinhos)
  const finG = new THREE.SphereGeometry(0.13, 22, 14); finG.scale(1, 0.55, 0.18);
  const fins = [1, -1].map(sx => { const f = new THREE.Group(); f.position.set(sx * 0.36, 0.28, 0.04); const m = new THREE.Mesh(finG, skinM); m.position.x = sx * 0.09; m.rotation.z = sx * -0.5; f.add(m); body.add(f); return f; });
  // ---------- rosto ----------
  const deep = base.clone().lerp(new THREE.Color('#0b1430'), 0.72), lidC = base.clone().lerp(new THREE.Color('#ffffff'), 0.18);
  const scleraM = new THREE.MeshStandardMaterial({ color: '#f7fbff', roughness: 0.25 });
  const irisM = new THREE.MeshStandardMaterial({ color: base.clone().offsetHSL(0.02, 0.15, -0.12), roughness: 0.2, emissive: base, emissiveIntensity: 0.12 });
  const pupilM = new THREE.MeshStandardMaterial({ color: '#08101e', roughness: 0.1 });
  const lidM = new THREE.MeshPhysicalMaterial({ color: lidC, roughness: 0.15, clearcoat: 1 });
  const darkM = new THREE.MeshStandardMaterial({ color: deep, roughness: 0.4 });
  const mouthM = new THREE.MeshStandardMaterial({ color: '#3a1022', roughness: 0.6 });
  const face = new THREE.Group(); body.add(face);
  const eyes = [-1, 1].map(sx => {
    const ex = sx * 0.125, ey = 0.47, ez = dropFront(ex, ey) - 0.035;
    const g = new THREE.Group(); g.position.set(ex, ey, ez); g.rotation.y = sx * 0.28; face.add(g);
    const scl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 28, 20), scleraM); scl.scale.set(0.95, 1.1, 0.75); g.add(scl);
    const look = new THREE.Group(); g.add(look);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.043, 24, 16), irisM); iris.scale.set(1, 1.08, 0.42); iris.position.z = 0.04; look.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 18, 12), pupilM); pupil.scale.set(1, 1.1, 0.4); pupil.position.z = 0.054; look.add(pupil);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.014, 0.018, 0.062); look.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl2.position.set(-0.012, -0.012, 0.06); look.add(hl2);
    // pálpebras de cima e de baixo (cascas da cor da pele, um pouco mais opacas)
    const lidG = new THREE.SphereGeometry(0.075, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const up = new THREE.Mesh(lidG, lidM); up.scale.set(0.97, 1.12, 0.8); g.add(up);
    const lo = new THREE.Mesh(lidG, lidM); lo.scale.set(0.97, -1.12, 0.8); g.add(lo);
    // sobrancelha de água (curva)
    const brow = new THREE.Mesh(taper([V3(-0.045, 0, 0), V3(0, 0.012, 0.01), V3(0.045, 0, 0)], 0.011, 0.007, 12, 8), darkM);
    const bg = new THREE.Group(); bg.position.set(ex, ey + 0.1, ez + 0.035); bg.rotation.y = sx * 0.28; bg.add(brow); face.add(bg);
    return { g, look, up, lo, bg, sx };
  });
  // boca: interior escuro que abre/fecha + lábio em arco (sorriso) — nada de língua de fora
  const my = 0.33, mz = dropFront(0, my) - 0.012;
  const mouth = new THREE.Group(); mouth.position.set(0, my, mz); face.add(mouth);
  const inside = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), mouthM); inside.scale.set(1.25, 0.2, 0.35); mouth.add(inside);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 24, Math.PI * 0.9), darkM); lip.rotation.z = Math.PI + Math.PI * 0.05; lip.position.y = 0.012; mouth.add(lip);
  // bochechinhas brilhando de leve
  for (const sx of [-1, 1]) { const ck = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), new THREE.MeshBasicMaterial({ color: base.clone().lerp(new THREE.Color('#ff9ac0'), 0.6), transparent: true, opacity: 0.22, depthWrite: false })); ck.scale.set(1.2, 0.6, 0.3); ck.position.set(sx * 0.19, 0.36, dropFront(sx * 0.2, 0.37) - 0.005); ck.rotation.y = sx * 0.45; face.add(ck); }
  // ---------- detalhe de cada variante ----------
  const fxs = [];
  if (V.extra === 'embers') for (let k = 0; k < 5; k++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' })); e.userData.ph = k / 5; body.add(e); fxs.push(t => { const q = (t * 0.6 + e.userData.ph) % 1; e.position.set(Math.sin(k * 2.3 + t) * 0.12, 0.85 + q * 0.5, -0.2 + Math.cos(k * 1.7) * 0.08); e.scale.setScalar(1 - q); }); }
  if (V.extra === 'sprout') { const stem = new THREE.Mesh(taper([V3(0, 0, 0), V3(0.02, 0.1, 0.02), V3(0.05, 0.18, 0)], 0.012, 0.007, 10, 8), mat('#4f8a2e')); stem.position.set(0, 0.86, -0.26); body.add(stem); for (const sx of [-1, 1]) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 12), mat('#6fbf3a', { roughness: 0.6 })); lf.scale.set(1, 0.25, 0.55); lf.position.set(0.05 + sx * 0.05, 1.04, -0.26); lf.rotation.z = sx * 0.6; body.add(lf); fxs.push(t => { lf.rotation.x = Math.sin(t * 2 + sx) * 0.2; }); } }
  if (V.extra === 'crystals') for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(taper([V3(0, 0, 0), V3(0, 0.06 + k * 0.012, 0), V3(0, 0.1 + k * 0.016, 0)], 0.028, 0.004, 8, 10), new THREE.MeshPhysicalMaterial({ color: '#e8fbff', roughness: 0.05, transparent: true, opacity: 0.85, emissive: '#bfefff', emissiveIntensity: 0.4, clearcoat: 1 })); const a = -0.9 + k * 0.6; c.position.set(Math.sin(a) * 0.2, 0.7 + (k % 2) * 0.06, -0.14 + Math.cos(a) * 0.05); c.rotation.z = -Math.sin(a) * 0.7; body.add(c); }
  if (V.extra === 'wisps') for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshBasicMaterial({ color: '#7a3ad0', transparent: true, opacity: 0.5, depthWrite: false })); body.add(w); fxs.push(t => { const q = (t * 0.45 + k / 4) % 1, a = k * 1.6 + t; w.position.set(Math.cos(a) * 0.32, 0.15 + q * 0.9, Math.sin(a) * 0.32); w.material.opacity = 0.5 * (1 - q); w.scale.setScalar(1.2 - q * 0.6); }); }
  if (V.extra === 'royal') { // gotinhas em órbita e gotejando (o rei das gotas)
    const orbM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1 });
    for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(DROP_GEO, orbM); d.scale.setScalar(0.16); body.add(d); fxs.push(t => { const a = t * 1.2 + k * Math.PI / 2; d.position.set(Math.cos(a) * 0.62, 0.35 + Math.sin(t * 2 + k) * 0.12, Math.sin(a) * 0.62); d.rotation.y = -a; }); }
    const drips = new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, transparent: true, opacity: 0.7 });
    for (let k = 0; k < 6; k++) { const dr = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), drips); dr.scale.y = 1.8; body.add(dr); const a = k / 6 * Math.PI * 2; fxs.push(t => { const q = (t * 0.5 + k / 6) % 1; dr.position.set(Math.cos(a) * 0.4 * (1 + q * 0.2), 0.55 - q * 0.5, Math.sin(a) * 0.4 * (1 + q * 0.2)); dr.scale.setScalar(1 - q * 0.6); }); }
  }
  if (boss) { // coroa de coral (Gosmão): pontas orgânicas, não um cone
    const cm = mat('#ffcf5a', { metalness: 0.5, roughness: 0.3 });
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const sp = new THREE.Mesh(taper([V3(0, 0, 0), V3(Math.cos(a) * 0.04, 0.09, Math.sin(a) * 0.04), V3(Math.cos(a) * 0.05, 0.16, Math.sin(a) * 0.05)], 0.03, 0.008, 10, 8), cm); sp.position.set(Math.cos(a) * 0.1, 0.78, -0.16 + Math.sin(a) * 0.1); body.add(sp); }
  }
  shadowAll(root); inner.castShadow = false;
  // ---------- rastro molhado que vai sumindo ----------
  const trailM = new THREE.MeshBasicMaterial({ map: trailTex(), color: base.clone().lerp(new THREE.Color('#ffffff'), 0.15), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const trail = []; let trailT = 0, trailI = 0; const wp = new THREE.Vector3(), ws = new THREE.Vector3();
  const dropTrail = () => {
    const scene = root.parent && root.parent.parent; if (!scene) return;
    let d = trail[trailI % 10]; if (!d) { d = { m: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), trailM.clone()), life: 0 }; d.m.rotation.x = -Math.PI / 2; d.m.renderOrder = 1; trail.push(d); }
    trailI++; root.getWorldPosition(wp); root.getWorldScale(ws);
    d.m.position.set(wp.x + (Math.random() - 0.5) * 0.05 * ws.x, wp.y + 0.02, wp.z + (Math.random() - 0.5) * 0.05 * ws.x); d.m.scale.setScalar(ws.x * (0.62 + Math.random() * 0.18)); d.m.rotation.z = Math.random() * 6.3;
    if (d.m.parent !== scene) scene.add(d.m); d.life = 1;
  };
  // ---------- humor e animação ----------
  let lt = 0, at = -9, hitT = -9, blinkAt = 1 + Math.random() * 3, lookT = 0, lookX = 0, lookY = 0, talkT = 2 + Math.random() * 4, mood = 0;
  const api = { root, attack() { at = lt; }, hit() { hitT = lt; }, animate(t, moving, dt = 1 / 60) {
    dt = Math.min(0.1, Math.max(0, dt)); lt = t;
    const f = moving ? 5.5 : 2.2, a = moving ? 0.06 : 0.035, k = Math.sin(t * f), sk = strike((t - at) / 0.5);
    // desliza: ondula de baixo para cima (sem quicar), estica e espirra para frente no golpe
    body.scale.set(1 + k * a - sk * 0.12, 1 - k * a * 0.8 + sk * 0.12, 1 + k * a + sk * 0.38);
    body.rotation.x = (moving ? 0.08 : 0) + sk * 0.25 + Math.sin(t * f * 0.5) * 0.03;
    body.position.z = sk * 0.32;
    for (const [n, fn] of fins.entries()) fn.rotation.z = (n ? -1 : 1) * (Math.sin(t * (moving ? 8 : 3) + n) * 0.35 + 0.1 + sk * 0.6);
    inner.scale.set(0.66 + Math.sin(t * 2.2) * 0.03, 0.6 + Math.sin(t * 2.2 + 1) * 0.03, 0.62); innerM.opacity = Math.min(0.32, 0.16 * V.glow) * (0.85 + Math.sin(t * 3) * 0.15 + sk * 0.6);
    // humor: 1 = bravo (logo depois de atacar), 0 = tranquilo
    const angry = t - at < 2.5 ? 1 : 0; mood += (angry - mood) * Math.min(1, dt * 6);
    const ouch = t - hitT < 0.35;
    // piscar (às vezes duas vezes) e olhar em volta
    let blink = 0; if (t > blinkAt) { const q = (t - blinkAt) / 0.16; blink = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) blinkAt = t + 1.8 + Math.random() * 3.5; }
    if (t > lookT) { lookT = t + 0.8 + Math.random() * 2; lookX = (Math.random() - 0.5) * 0.7; lookY = (Math.random() - 0.5) * 0.35; }
    const lx = moving || angry ? 0 : lookX, ly = moving || angry ? -0.05 : lookY;
    const openU = ouch ? 1 : Math.max(blink, 0.12 + mood * 0.42), openL = ouch ? 1 : Math.max(blink * 0.8, 0.05 + mood * 0.25); // 0 = aberto, 1 = fechado
    for (const e of eyes) {
      e.look.rotation.y += (lx - e.look.rotation.y) * Math.min(1, dt * 8); e.look.rotation.x += (-ly - e.look.rotation.x) * Math.min(1, dt * 8);
      e.up.rotation.x = -1.35 + openU * 1.45; e.lo.rotation.x = 1.35 - openL * 1.3;
      e.bg.rotation.z = e.sx * (-0.05 - mood * 0.45) + (ouch ? e.sx * 0.3 : 0); e.bg.position.y = 0.57 - mood * 0.025 + Math.sin(t * 1.1) * 0.004 * (1 - mood);
      e.g.scale.setScalar(1 + (moving ? 0 : Math.sin(t * 0.9 + e.sx) * 0.02));
    }
    // boca: fala ("blub, blub") de vez em quando, abre no ataque, aperta ao apanhar, sorri tranquila
    let open = 0.18 + Math.max(0, Math.sin(t * f)) * (moving ? 0.25 : 0);
    if (!moving && t > talkT) { const q = t - talkT; if (q < 1.1) open = 0.2 + Math.abs(Math.sin(q * 13)) * 0.6 * Math.sin(q / 1.1 * Math.PI); else talkT = t + 3 + Math.random() * 5; }
    open = Math.max(open, sk > 0 ? sk * 1.3 : 0, mood * 0.55); if (ouch) open = 0.9;
    inside.scale.set(1.25 - open * 0.35 + (ouch ? 0.3 : 0), 0.15 + open * 0.95, 0.35);
    lip.visible = open < 0.45 && !ouch; lip.scale.set(1, 1 - mood * 1.6, 1); // bravo: o sorriso vira careta
    for (const fx of fxs) fx(t);
    // rastro
    if (moving) { trailT -= dt; if (trailT <= 0) { trailT = 0.32; dropTrail(); } }
    for (const d of trail) { if (d.life <= 0) continue; d.life -= dt / 3.2; d.m.material.opacity = Math.max(0, d.life) * 0.42; d.m.scale.multiplyScalar(1 + dt * 0.04); if (d.life <= 0 && d.m.parent) d.m.parent.remove(d.m); }
  } };
  return api;
}

/* ---------- Fungolino: cogumelo vivo ----------
   Chapéu com borda ondulada e irregular, verrugas de tamanhos variados, lamelas por baixo, pé fibroso
   com anel (saia) e raízes, rosto embutido no pé. Pula com "achata e estica" e solta esporos. */
const vcolor = (g, fn) => { const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(); for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
const VC = (r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, ...extra });
export function mushroom(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 7 + Math.floor(Math.random() * 999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const capC = new THREE.Color(color), dark = capC.clone().offsetHSL(0, 0.05, -0.18), rimC = capC.clone().offsetHSL(0.02, -0.1, 0.12);
  // pé: fibroso, mais largo embaixo, com raízes
  const stemG = new THREE.LatheGeometry([[0.001, 0], [0.24, 0], [0.27, 0.04], [0.24, 0.1], [0.2, 0.22], [0.18, 0.36], [0.16, 0.46], [0.001, 0.46]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  { const P = stemG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), a = Math.atan2(z, x), f = 1 + Math.sin(a * 14 + y * 6) * 0.025 + Math.sin(a * 5) * 0.02; P.setXYZ(k, x * f, y, z * f); } stemG.computeVertexNormals(); }
  vcolor(stemG, (c, x, y, z) => c.set('#efe6d2').offsetHSL(0, 0, (Math.sin(Math.atan2(z, x) * 14) * 0.5 + 0.5) * -0.05 - (y < 0.06 ? 0.12 : 0)));
  const stem = new THREE.Mesh(stemG, VC(0.85)); body.add(stem);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rng(); const r = new THREE.Mesh(taper([V3(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2), V3(Math.cos(a) * 0.32, 0.01, Math.sin(a) * 0.32), V3(Math.cos(a) * 0.38, -0.03, Math.sin(a) * 0.38)], 0.04, 0.022, 10, 10), mat('#d8cdb4', { roughness: 0.9 })); body.add(r); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), r.material); tip.position.set(Math.cos(a) * 0.38, -0.03, Math.sin(a) * 0.38); body.add(tip); } // raízes grossas e arredondadas
  // anel (saia) do pé
  const skirtG = new THREE.CylinderGeometry(0.2, 0.25, 0.08, 28, 1, true); { const P = skirtG.attributes.position; for (let k = 0; k < P.count; k++) { const a = Math.atan2(P.getZ(k), P.getX(k)); if (P.getY(k) < 0) { P.setX(k, P.getX(k) * (1 + Math.sin(a * 9) * 0.06)); P.setZ(k, P.getZ(k) * (1 + Math.sin(a * 9) * 0.06)); } } skirtG.computeVertexNormals(); }
  const skirt = new THREE.Mesh(skirtG, mat('#f4ecda', { roughness: 0.8, side: THREE.DoubleSide })); skirt.position.y = 0.4; body.add(skirt);
  // chapéu: lathe com borda ondulada, centro mais escuro
  const cap = new THREE.Group(); cap.position.y = 0.44; body.add(cap);
  const prof = []; for (let k = 0; k <= 16; k++) { const u = k / 16, ang = u * Math.PI * 0.5; prof.push(new THREE.Vector2(Math.max(0.001, Math.sin(ang) * 0.46 + u * u * 0.04), Math.cos(ang) * 0.3 + 0.02)); }
  prof.push(new THREE.Vector2(0.48, -0.02), new THREE.Vector2(0.4, -0.04)); // borda que dobra para dentro
  const capG = new THREE.LatheGeometry(prof.reverse(), 48);
  { const P = capG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), a = Math.atan2(z, x), r = Math.hypot(x, z), edge = Math.max(0, r - 0.3) / 0.18; P.setY(k, y + Math.sin(a * 7 + 1) * 0.035 * edge + Math.sin(a * 3) * 0.02 * edge); const f = 1 + Math.sin(a * 5) * 0.03 * edge; P.setX(k, x * f); P.setZ(k, z * f); } capG.computeVertexNormals(); }
  vcolor(capG, (c, x, y, z) => { const r = Math.hypot(x, z); c.copy(dark).lerp(capC, Math.min(1, r / 0.3)).lerp(rimC, Math.max(0, (r - 0.36) / 0.12)).offsetHSL(0, 0, (Math.sin(x * 23 + z * 17) * 0.5 + 0.5) * 0.04); });
  cap.add(new THREE.Mesh(capG, VC(0.55)));
  // lamelas por baixo (finas, saindo do pé até a borda)
  const gills = []; for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, gl = new THREE.PlaneGeometry(0.28, 0.07); gl.translate(0.27, -0.035, 0); gl.rotateY(-a); gills.push(gl); }
  const gillM = new THREE.Mesh(mergeGeometries(gills), mat('#e9d8b8', { roughness: 0.9, side: THREE.DoubleSide })); gillM.position.y = 0.0; cap.add(gillM);
  // verrugas brancas de tamanhos variados (espiral dourada, sem anel perfeito)
  const warts = [];
  for (let k = 0; k < 14; k++) { const u = (k + 0.5) / 14, a = k * 2.399 + rng() * 0.4, r = Math.sqrt(u) * 0.38, y = Math.cos(Math.asin(Math.min(1, r / 0.47))) * 0.3 + 0.02;
    const w = new THREE.SphereGeometry(0.025 + rng() * 0.035, 14, 10); w.scale(1, 0.45, 1); { const P = w.attributes.position; for (let q = 0; q < P.count; q++) P.setY(q, P.getY(q) + Math.sin(P.getX(q) * 90) * 0.003); } w.lookAt(V3(Math.cos(a) * r, y, Math.sin(a) * r)); w.translate(Math.cos(a) * r, y - 0.005, Math.sin(a) * r); warts.push(w); }
  cap.add(new THREE.Mesh(mergeGeometries(warts.map(w => { w.deleteAttribute('uv'); return w; })), mat('#fbf6ea', { roughness: 0.85 })));
  // rosto no pé: olhos brilhantes com pálpebra e boquinha
  const face = new THREE.Group(); face.position.set(0, 0.27, 0.17); body.add(face);
  for (const sx of [-1, 1]) {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), mat('#1a1210', { roughness: 0.1 })); ew.scale.set(0.85, 1.1, 0.5); ew.position.set(sx * 0.07, 0.02, 0.01); face.add(ew);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), WHITE); hl.position.set(sx * 0.07 + 0.012, 0.04, 0.03); face.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), mat('#e6dcc6', { roughness: 0.8 })); lid.scale.set(0.9, 1.1, 0.6); lid.position.set(sx * 0.07, 0.022, 0.012); face.add(lid);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 18, Math.PI), mat('#5a3a2a')); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.045, 0.02); face.add(mouth);
  // esporos (nuvem que sai do chapéu ao pular/atacar)
  const sporeM = new THREE.MeshBasicMaterial({ color: capC.clone().lerp(new THREE.Color('#fff4d0'), 0.6), transparent: true, opacity: 0.6, depthWrite: false });
  const spores = []; for (let k = 0; k < 14; k++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.02 + rng() * 0.015, 8, 6), sporeM); sp.visible = false; root.add(sp); spores.push({ sp, v: V3(), life: 0 }); }
  const puff = (n, y) => { let c = 0; for (const p of spores) { if (p.life > 0 || c >= n) continue; c++; p.life = 0.8 + Math.random() * 0.6; p.sp.visible = true; const a = Math.random() * 6.28; p.sp.position.set(Math.cos(a) * 0.3, y, Math.sin(a) * 0.3); p.v.set(Math.cos(a) * 0.4, 0.3 + Math.random() * 0.4, Math.sin(a) * 0.4); } };
  bakeChildren(body);
  shadowAll(root);
  let lt = 0, at = -9, ph = 0, wasUp = false;
  return { root, attack() { at = lt; puff(8, 0.7); }, animate(t, moving, dt = 1 / 60) {
    dt = Math.min(0.05, Math.max(0.001, t - lt)); lt = t; const sk = strike((t - at) / 0.5);
    ph += dt * (moving ? 7.5 : 0);
    const hop = moving ? Math.max(0, Math.sin(ph)) : 0, land = moving ? Math.max(0, -Math.sin(ph)) : 0;
    body.position.y = hop * 0.2 + Math.max(0, sk) * 0.2;
    body.scale.set(1 + land * 0.12 - hop * 0.05, 1 - land * 0.18 + hop * 0.08 + Math.sin(t * 2.2) * 0.015 * (moving ? 0 : 1), 1 + land * 0.12 - hop * 0.05); // achata ao cair, estica ao subir
    cap.rotation.z = Math.sin(t * 2) * 0.05 + Math.sin(ph) * 0.06; cap.rotation.x = sk * 0.6 - land * 0.05;
    cap.position.y = 0.44 - land * 0.02;
    body.rotation.x = sk * 0.25;
    const up = hop > 0.5; if (wasUp && !up && moving) puff(2, 0.1); wasUp = up; // pousa e levanta um pouco de esporo
    for (const p of spores) { if (p.life <= 0) continue; p.life -= dt; p.sp.position.addScaledVector(p.v, dt); p.v.multiplyScalar(0.97); p.sp.material.opacity = 0.6; p.sp.scale.setScalar(1 + (1.4 - p.life) * 1.5); if (p.life <= 0) p.sp.visible = false; }
  } };
}

/* ---------- Coelho-Chifre: coelho de verdade, com pelagem, olhos brilhantes e chifre torcido ---------- */
/* ---------- Coelho-Chifre (S-139): coelho de verdade, de pelo fofo ----------
   Corpo numa peça lisa só (garupa, peito e pescoço juntos), pelo macio feito em camadas ("cascas")
   que dão a fofura sem espetar, patas traseiras compridas presas na coxa e dianteiras saindo do peito. */
let FUR_TEX = null;
function furTex() { // pontinhos de pelo: cada camada mostra menos fios → pelo macio e afinando nas pontas
  if (FUR_TEX) return FUR_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256);
  let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 256 * 256; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 0; }
  for (let k = 0; k < 22000; k++) { const x = Math.floor(r() * 256), y = Math.floor(r() * 256), a = 40 + Math.floor(r() * 215), sh = 255; const i = (y * 256 + x) * 4; img.data[i + 3] = Math.max(img.data[i + 3], a); img.data[i] = img.data[i + 1] = img.data[i + 2] = sh; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10);
  return (FUR_TEX = t);
}
// junta várias peças (com cor por vértice e UV) numa malha lisa
function furBody(parts) { const idx = parts.every(g => g.index); return mergeGeometries(parts.map(g => { const x = idx ? g : (g.index ? g.toNonIndexed() : g); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) x.deleteAttribute(k); return x; })); }
function shellFur(parent, geo, layers = 5, len = 0.022, repeat = 6) {
  const tex = furTex(), N = geo.attributes.normal, P0 = geo.attributes.position;
  for (let i = 1; i <= layers; i++) {
    const g = geo.clone(), P = g.attributes.position, h = len * i / layers;
    for (let k = 0; k < P.count; k++) P.setXYZ(k, P0.getX(k) + N.getX(k) * h, P0.getY(k) + N.getY(k) * h - h * h * 4, P0.getZ(k) + N.getZ(k) * h); // ponta do pelo cai um pouco (gravidade)
    const m = new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(1.08, 1.07, 1.05), vertexColors: true, roughness: 1, alphaTest: 0.1 + 0.75 * i / layers, alphaToCoverage: true, side: THREE.FrontSide });
    m.map = tex.clone(); m.map.repeat.set(repeat * 1.6, repeat * 1.6); m.map.needsUpdate = true;
    const sh = new THREE.Mesh(g, m); sh.castShadow = false; sh.receiveShadow = false; sh.userData.fur = true; parent.add(sh);
  }
}
const paintV = (g, fn) => { const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(); for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
const ell = (r, sx, sy, sz, x, y, z, rx = 0, seg = 22) => { const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)); g.scale(sx, sy, sz); if (rx) g.rotateX(rx); g.translate(x, y, z); return g; };
export function rabbit(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const base = new THREE.Color(color), back = base.clone().offsetHSL(0.01, 0.06, -0.14), belly = base.clone().lerp(new THREE.Color('#fbf6ec'), 0.7);
  // pelagem: mais escura no dorso, clara na barriga, com leve "agouti" (variação)
  const coat = (c, x, y, z, yBelly, yBack) => { const k = Math.min(1, Math.max(0, (y - yBelly) / (yBack - yBelly))); c.copy(belly).lerp(base, Math.min(1, k * 1.6)).lerp(back, Math.max(0, k - 0.55) * 1.8); const n = Math.sin(x * 23 + z * 9) * Math.sin(z * 19 + y * 14) * 0.025; c.offsetHSL(0, 0, n); };
  const VCM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  // tronco (garupa redonda + peito + pescoço) numa peça
  const trunk = furBody([ell(0.2, 1, 0.92, 1.18, 0, 0.25, -0.07), ell(0.145, 1, 1.04, 1, 0, 0.255, 0.12), ell(0.1, 1, 1.1, 1, 0, 0.34, 0.19), ell(0.13, 1.05, 0.7, 1.4, 0, 0.16, 0.02)].map(g => paintV(g, (c, x, y, z) => coat(c, x, y, z, 0.1, 0.42))));
  body.add(new THREE.Mesh(trunk, VCM)); shellFur(body, trunk, 4, 0.024, 7);
  // cabeça
  const head = new THREE.Group(); head.position.set(0, 0.43, 0.25); body.add(head);
  const skullG = furBody([ell(0.105, 0.98, 0.92, 1.12, 0, 0, 0), ell(0.05, 0.92, 0.8, 1, -0.038, -0.05, 0.085), ell(0.05, 0.92, 0.8, 1, 0.038, -0.05, 0.085), ell(0.042, 1.15, 0.72, 0.9, 0, -0.078, 0.06), ell(0.07, 1, 0.9, 0.9, 0, 0.0, -0.06)].map(g => paintV(g, (c, x, y, z) => coat(c, x, y, z, -0.08, 0.08))));
  head.add(new THREE.Mesh(skullG, VCM)); shellFur(head, skullG, 3, 0.014, 8);
  const PINK = mat('#d9939b', { roughness: 0.55 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), PINK); nose.scale.set(1.5, 0.9, 0.8); nose.position.set(0, -0.022, 0.148); head.add(nose);
  // olhos grandes nas laterais, escuros e brilhantes, com pálpebra
  const EYE = new THREE.MeshPhysicalMaterial({ color: '#1a0f0a', roughness: 0.05, clearcoat: 1 });
  const eyesL = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(sx * 0.082, 0.022, 0.045); eg.rotation.y = sx * 1.05; head.add(eg);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 22, 16), EYE); eye.scale.set(1, 1.12, 0.75); eg.add(eye);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 8, 24), mat(back.clone().offsetHSL(0, 0, -0.1), { roughness: 0.8 })); rim.scale.set(1, 1.12, 1); rim.position.z = 0.006; eg.add(rim);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.008, 0.01, 0.022); eg.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(base, { roughness: 0.9 })); lid.scale.set(1, 1.15, 0.85); lid.rotation.x = -1.4; eg.add(lid); eyesL.push(lid);
    for (let w = 0; w < 4; w++) { const wh = new THREE.Mesh(taper([V3(0, 0, 0), V3(sx * 0.06, 0.003 * (w - 1.5), 0.02), V3(sx * 0.13, -0.012 + 0.008 * (w - 1.5), 0.005)], 0.0016, 0.0005, 8, 4), mat('#f4efe6')); wh.position.set(sx * 0.035, -0.05, 0.125); head.add(wh); } // bigodes finos
  }
  // orelhas compridas: pelo por fora, rosado por dentro, mexem independentes
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.042, 0.075, -0.035); head.add(e);
    const og = taper([V3(0, 0, 0), V3(sx * 0.018, 0.12, -0.03), V3(sx * 0.03, 0.24, -0.07), V3(sx * 0.03, 0.29, -0.09)], 0.036, 0.012, 16, 14); og.scale(1, 1, 0.46);
    paintV(og, (c, x, y) => { c.copy(base).lerp(back, Math.min(1, y / 0.3) * 0.8); });
    e.add(new THREE.Mesh(og, VCM));
    const inner = new THREE.Mesh(taper([V3(0, 0.025, 0.012), V3(sx * 0.018, 0.13, -0.012), V3(sx * 0.026, 0.24, -0.05)], 0.023, 0.007, 14, 10), PINK); inner.scale.set(1, 1, 0.32); e.add(inner);
    return e;
  });
  // chifre torcido (espiral de verdade) saindo da testa
  const hornG = new THREE.ConeGeometry(0.026, 0.16, 18, 14); { const P = hornG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k) + 0.08, z = P.getZ(k), a = y * 30, c = Math.cos(a), s2 = Math.sin(a), ring = 1 + Math.sin(Math.atan2(z, x) * 2 + a) * 0.16; P.setXYZ(k, (x * c - z * s2) * ring, y - 0.08, (x * s2 + z * c) * ring); } hornG.computeVertexNormals(); }
  vcolor(hornG, (c, x, y) => c.set('#efe3c2').lerp(new THREE.Color('#a8956a'), Math.max(0, (0.08 - y) / 0.16) * 0.5));
  const horn = new THREE.Mesh(hornG, VC(0.35)); horn.position.set(0, 0.1, 0.06); horn.rotation.x = 0.55; head.add(horn);
  // patas: traseiras = coxa grande + jarrete + pé comprido apoiado no chão (tudo preso na coxa)
  const hinds = [-1, 1].map(sx => {
    const g = new THREE.Group(); g.position.set(sx * 0.115, 0.22, -0.11); body.add(g);
    const thigh = paintV(ell(0.105, 0.55, 1.22, 1.15, sx * 0.012, -0.045, 0.0), (c, x, y, z) => coat(c, x, y + 0.22, z, 0.1, 0.42));
    const hock = paintV(taper([V3(0, -0.1, -0.05), V3(0, -0.15, -0.065), V3(0, -0.185, -0.05)], 0.042, 0.03, 10, 12), (c, x, y, z) => coat(c, x, y + 0.22, z, 0.0, 0.4));
    const foot = paintV(ell(0.034, 0.95, 0.62, 3.0, 0, -0.197, 0.025), c => c.copy(base).lerp(back, 0.15));
    const leg = furBody([thigh, hock, foot]); g.add(new THREE.Mesh(leg, VCM)); shellFur(g, leg, 3, 0.016, 6);
    return g;
  });
  const fronts = [-1, 1].map(sx => {
    const g = new THREE.Group(); g.position.set(sx * 0.07, 0.19, 0.17); body.add(g);
    const arm = paintV(taper([V3(0, 0.05, -0.01), V3(0, -0.07, 0.012), V3(0, -0.165, 0.02)], 0.032, 0.022, 10, 12), (c, x, y, z) => coat(c, x, y + 0.19, z, 0.0, 0.45));
    const paw = paintV(ell(0.026, 1, 0.55, 1.5, 0, -0.172, 0.038), c => c.copy(base).lerp(belly, 0.55));
    const leg = furBody([arm, paw]); g.add(new THREE.Mesh(leg, VCM)); shellFur(g, leg, 2, 0.01, 5);
    return g;
  });
  // rabo: pompom branco bem fofo
  const tail = new THREE.Group(); tail.position.set(0, 0.29, -0.3); body.add(tail);
  const tg = paintV(ell(0.05, 1, 1, 0.9, 0, 0, 0), c => c.set('#fbf8f2')); tail.add(new THREE.Mesh(tg, VCM)); shellFur(tail, tg, 5, 0.028, 4);
  shadowAll(root); root.traverse(o => { if (o.userData.fur) { o.castShadow = false; o.receiveShadow = false; } });
  let lt = 0, at = -9, ph = 0, blinkAt = 2;
  return { root, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; ph += dt * (moving ? 9 : 0);
    const hop = moving ? Math.max(0, Math.sin(ph)) : 0, sk = strike((t - at) / 0.45);
    body.position.y = hop * 0.2 + Math.max(0, sk) * 0.12;
    body.rotation.x = moving ? -Math.cos(ph) * 0.16 : sk * 0.35;
    body.position.z = sk * 0.18;
    body.scale.set(1, 1 + Math.sin(t * 3.2) * 0.012 * (moving ? 0 : 1), 1); // respira
    hinds.forEach(h => { h.rotation.x = moving ? Math.max(0, -Math.cos(ph)) * 0.75 : 0; });
    fronts.forEach(f => { f.rotation.x = moving ? Math.cos(ph) * 0.55 : sk * -0.6; });
    ears.forEach((e, i) => { e.rotation.x = -0.12 - hop * 0.45 + Math.sin(t * 1.3 + i * 2) * 0.05 * (moving ? 0 : 1); e.rotation.z = (i ? -1 : 1) * (0.06 + Math.max(0, Math.sin(t * 0.7 + i * 3) - 0.9) * 2.5); });
    nose.scale.y = 0.9 + Math.max(0, Math.sin(t * 9)) * 0.22 * (moving ? 0 : 1);
    head.rotation.y = moving ? 0 : Math.sin(t * 0.6) * 0.3; head.rotation.x = moving ? 0 : Math.sin(t * 0.37) * 0.08;
    let bl = 0; if (t > blinkAt) { const q = (t - blinkAt) / 0.18; bl = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) blinkAt = t + 2 + Math.random() * 4; }
    for (const l of eyesL) l.rotation.x = -1.4 + bl * 1.45;
    tail.rotation.x = Math.sin(t * 5) * 0.1 * (moving ? 1 : 0.3);
  } };
}

/* ---------- Abelha Rubra: tórax e cabeça peludos, olhos compostos, asas com nervuras, patas articuladas ---------- */
let WING_TEX = null;
function wingTex() {
  if (WING_TEX) return WING_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.fillStyle = 'rgba(230,240,255,0.35)'; g.beginPath(); g.ellipse(64, 64, 62, 62, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(60,50,40,0.85)'; g.lineWidth = 2.2;
  for (const [x1, y1, x2, y2] of [[4, 64, 124, 58], [10, 64, 110, 30], [10, 64, 112, 92], [40, 62, 70, 20], [40, 62, 74, 108], [70, 60, 98, 18], [70, 60, 100, 104]]) { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 6, x2, y2); g.stroke(); }
  g.lineWidth = 1; g.strokeStyle = 'rgba(60,50,40,0.5)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(30 + k * 12, 30 + (k % 2) * 6); g.lineTo(36 + k * 12, 96 - (k % 3) * 4); g.stroke(); }
  WING_TEX = new THREE.CanvasTexture(c); WING_TEX.colorSpace = THREE.SRGBColorSpace; return WING_TEX;
}
export function bee(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 5 + Math.floor(Math.random() * 999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const base = new THREE.Color(color);
  const C = mat(base, { roughness: 0.55 }), BLK = mat('#1a1416', { roughness: 0.45 }), FUZZ = mat(base.clone().offsetHSL(0.04, -0.15, 0.18), { roughness: 1 });
  const STRAND = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide });
  body.add(blob(0.15, 1, 0.95, 1, FUZZ, 0, 0, 0.02, 20));
  furPatch(body, STRAND, [{ n: 260, c: [0, 0, 0.02], r: [0.15, 0.143, 0.15], len: 0.45, back: 0.3 }], rng, base.clone().offsetHSL(0.04, -0.1, 0.12), [new THREE.Color('#2a1a14'), base.clone().offsetHSL(0.06, 0, 0.2)]);
  const abd = new THREE.Group(); abd.position.set(0, -0.02, -0.12); body.add(abd);
  for (let i = 0; i < 5; i++) { const seg = blob(0.165 - Math.abs(i - 1.5) * 0.026, 1, 0.95, 0.42, i % 2 ? BLK : C, 0, -i * 0.012, -i * 0.075, 22); abd.add(seg); }
  bakeChildren(abd);
  furPatch(abd, STRAND, [0, 1, 2, 3, 4].map(i => ({ n: 34, c: [0, -i * 0.012, -i * 0.075], r: [0.165 - Math.abs(i - 1.5) * 0.026, (0.165 - Math.abs(i - 1.5) * 0.026) * 0.95, 0.07], len: 0.3, back: 0.6, yMin: -0.3 })), rng, base, [new THREE.Color('#1a1416'), base.clone()]);
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.13, 14), mat('#2a1e18', { roughness: 0.3, metalness: 0.3 })); sting.rotation.x = -Math.PI / 2; sting.position.set(0, -0.06, -0.42); abd.add(sting);
  const head = new THREE.Group(); head.position.set(0, 0.03, 0.2); body.add(head);
  head.add(blob(0.095, 1.15, 1, 0.85, BLK, 0, 0, 0, 18));
  furPatch(head, STRAND, [{ n: 70, c: [0, 0.02, -0.02], r: [0.1, 0.09, 0.07], len: 0.3, back: -0.3, yMin: -0.2 }], rng, new THREE.Color('#2a1e18'), [new THREE.Color('#4a3a2a')]);
  // olhos compostos: superfície com facetas finas (cor por vértice em favo) e brilho
  for (const sx of [-1, 1]) {
    const eg = new THREE.SphereGeometry(0.062, 28, 20); eg.scale(0.75, 1.15, 0.9);
    vcolor(eg, (c, x, y, z) => c.set('#3a1e3a').offsetHSL(0, 0, ((Math.sin(x * 260) + Math.sin(y * 240 + x * 130) + Math.sin(z * 250)) > 1.2 ? 0.08 : -0.03)));
    const e = new THREE.Mesh(eg, VC(0.12, { metalness: 0.35 })); e.position.set(sx * 0.082, 0.02, 0.03); head.add(e);
    const ant = new THREE.Mesh(taper([V3(sx * 0.03, 0.07, 0.05), V3(sx * 0.05, 0.14, 0.09), V3(sx * 0.06, 0.17, 0.14), V3(sx * 0.1, 0.2, 0.2)], 0.008, 0.005, 14, 6), BLK); head.add(ant); // antena dobrada (cotovelo)
    const mand = new THREE.Mesh(taper([V3(sx * 0.03, -0.06, 0.06), V3(sx * 0.02, -0.08, 0.09), V3(0, -0.085, 0.1)], 0.01, 0.004, 8, 6), mat('#3a2418')); head.add(mand);
  }
  // 6 patas com 3 segmentos e pelinhos
  const legs = []; for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { const z0 = 0.06 - i * 0.07; const l = new THREE.Mesh(taper([V3(sx * 0.07, -0.08, z0), V3(sx * 0.15, -0.12, z0 - 0.01), V3(sx * 0.17, -0.2, z0 - 0.03), V3(sx * 0.16, -0.28, z0 - 0.05 - i * 0.02), V3(sx * 0.17, -0.31, z0 - 0.02 - i * 0.02)], 0.014, 0.005, 16, 6), BLK); body.add(l); legs.push(l); }
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex(), transparent: true, side: THREE.DoubleSide, roughness: 0.1, metalness: 0.2, depthWrite: false });
  const wings = []; for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.07, 0.13, 0.04 - k * 0.07); body.add(w);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(k ? 0.24 : 0.34, k ? 0.11 : 0.15), wingMat); m.rotation.x = -Math.PI / 2; m.position.x = sx * (k ? 0.11 : 0.16); if (sx < 0) m.scale.x = -1; w.add(m); wings.push({ w, sx });
  }
  body.position.y = 1.1;
  shadowAll(root);
  let lt = 0, at = -9;
  return { root, flying: true, attack() { at = lt; }, animate(t) {
    lt = t; const sk = strike((t - at) / 0.45);
    body.position.y = 1.1 + Math.sin(t * 4) * 0.1 + Math.sin(t * 9.7) * 0.02 - Math.max(0, sk) * 0.4;
    body.position.z = sk * 0.45; body.rotation.x = -sk * 0.9 + Math.sin(t * 3.1) * 0.05; body.rotation.z = Math.sin(t * 2.3) * 0.06;
    abd.rotation.x = 0.15 + Math.sin(t * 6) * 0.06 + Math.max(0, sk) * 0.6;
    wings.forEach(({ w, sx }) => { w.rotation.z = sx * Math.sin(t * 55) * 0.7; });
    legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 3 + i) * 0.08; });
  } };
}

// lobo realista: costas escuras, peito profundo, focinho comprido com mandíbula, rabo felpudo
// junta as peças fixas (filhos diretos do grupo) por material: menos chamadas de desenho
function bakeChildren(g) {
  const by = new Map();
  for (const o of [...g.children]) {
    if (!o.isMesh || o.isInstancedMesh) continue;
    o.updateMatrix(); const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') geo.deleteAttribute(k);
    (by.get(o.material) || by.set(o.material, []).get(o.material)).push(geo); g.remove(o);
  }
  for (const [m, geos] of by) g.add(new THREE.Mesh(mergeGeometries(geos), m));
}
// pelagem: tufos finos e curvos espalhados sobre elipsoides, deitados para trás (um InstancedMesh por grupo)
// mecha de pelo: folha larga, curta e achatada, que se deita sobre o corpo (nada de espinho)
const FUR_GEO = (() => { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.017, 0.05, 0.006); g.translate(0, 0.045, 0); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setZ(i, P.getZ(i) - y * y * 3.5); P.setX(i, P.getX(i) * (1 - y * 4)); } g.computeVertexNormals(); return g; })();
function furPatch(parent, mat, spots, rng, base, tones) {
  const total = spots.reduce((a, s) => a + s.n, 0), inst = new THREE.InstancedMesh(FUR_GEO, mat, total), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0), c = new THREE.Color();
  let k = 0;
  for (const s of spots) for (let i = 0; i < s.n; i++) {
    // ponto na superfície do elipsoide (só na faixa pedida)
    let nx, ny, nz; do { nx = rng() * 2 - 1; ny = rng() * 2 - 1; nz = rng() * 2 - 1; } while (nx * nx + ny * ny + nz * nz > 1 || (s.yMin !== undefined && ny < s.yMin));
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const px = s.c[0] + nx * s.r[0], py = s.c[1] + ny * s.r[1], pz = s.c[2] + nz * s.r[2];
    const nrm = V3(nx / s.r[0], ny / s.r[1], nz / s.r[2]).normalize(), along = V3(0, -0.1, -Math.sign(s.back || 1)).projectOnPlane(nrm).normalize();
    const dir = along.multiplyScalar(1).add(nrm.clone().multiplyScalar(0.28)).normalize(); // quase tangente: deita sobre o corpo, apontando para trás
    q.setFromUnitVectors(up, dir); const spin = new THREE.Quaternion().setFromAxisAngle(dir, Math.atan2(nrm.x, nrm.z)); q.premultiply(spin);
    const px2 = px - nrm.x * 0.01, py2 = py - nrm.y * 0.01, pz2 = pz - nrm.z * 0.01;
    const sc = s.len * (0.7 + rng() * 0.6);
    m.compose(V3(px2, py2, pz2), q, V3(1 + rng() * 0.5, sc, 1)); inst.setMatrixAt(k, m);
    c.copy(base).lerp(tones[Math.floor(rng() * tones.length)], rng() * 0.6); inst.setColorAt(k, c); k++;
  }
  inst.castShadow = false; inst.receiveShadow = false; parent.add(inst); return inst;
}
// pata com almofada, 4 dedos e unhas
function pawGeo(mat, clawMat) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), mat); pad.scale.set(1, 0.5, 1.35); pad.position.z = 0.02; g.add(pad);
  for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.024, toe = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat); toe.scale.set(1, 0.8, 1.2); toe.position.set(x, -0.005, 0.075 - Math.abs(k - 1.5) * 0.012); g.add(toe); const cl = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 8), clawMat); cl.rotation.x = Math.PI / 2 + 0.4; cl.position.set(x, -0.01, 0.097 - Math.abs(k - 1.5) * 0.012); g.add(cl); }
  return g;
}
export function wolf(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let sd = 1 + Math.floor(Math.random() * 9999); const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const base = new THREE.Color(color);
  const FUR = mat(base, { roughness: 0.92 }), BACK = mat(base.clone().offsetHSL(0, 0, -0.14), { roughness: 0.95 }), LIGHT = mat(base.clone().offsetHSL(0, -0.08, 0.16), { roughness: 0.92 });
  const NOSE = mat('#141012', { roughness: 0.3 }), MOUTH = mat('#5a2a2a', { roughness: 0.6 }), TOOTH = mat('#f2ede0', { roughness: 0.4 }), INNER = mat(base.clone().lerp(new THREE.Color('#c99a8a'), 0.45), { roughness: 0.8 }), CLAW = mat('#2a2420', { roughness: 0.4 });
  const STRAND = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide });
  const tones = [base.clone().offsetHSL(0, 0, -0.18), base.clone().offsetHSL(0, -0.05, 0.12), base.clone().offsetHSL(0.02, 0.05, -0.05)];
  // volume do corpo (por baixo da pelagem)
  body.add(blob(0.2, 1, 1.05, 1.9, FUR, 0, 0.66, -0.04, 20));
  body.add(blob(0.24, 1, 1.18, 1, FUR, 0, 0.66, 0.3, 18));
  body.add(blob(0.2, 1, 0.95, 1.05, FUR, 0, 0.69, -0.36, 16));
  body.add(blob(0.18, 0.95, 0.6, 2.0, BACK, 0, 0.78, -0.04, 16));
  body.add(blob(0.16, 0.85, 0.6, 1.8, LIGHT, 0, 0.53, 0.06, 14));
  bakeChildren(body);
  // pelagem: costas, flancos, juba do pescoço e peito
  furPatch(body, STRAND, [
    { n: 306, c: [0, 0.7, -0.04], r: [0.2, 0.21, 0.38], len: 0.75, back: 1.2, yMin: -0.2 },
    { n: 126, c: [0, 0.7, -0.36], r: [0.2, 0.19, 0.21], len: 0.7, back: 1.0, yMin: -0.1 },
    { n: 216, c: [0, 0.74, 0.34], r: [0.25, 0.27, 0.22], len: 1.15, back: 0.8, yMin: -0.6 }, // juba
  ], rng, base, tones);
  const neck = new THREE.Group(); neck.position.set(0, 0.78, 0.4); body.add(neck);
  neck.add(new THREE.Mesh(taper([V3(0, -0.04, -0.06), V3(0, 0.08, 0.08), V3(0, 0.14, 0.17)], 0.15, 0.12, 8, 12), FUR));
  furPatch(neck, STRAND, [{ n: 108, c: [0, 0.06, 0.06], r: [0.15, 0.14, 0.12], len: 1.0, back: 1.3 }], rng, base, tones);
  const head = new THREE.Group(); head.position.set(0, 0.16, 0.2); head.scale.setScalar(1.18); neck.add(head);
  // cabeça esculpida numa peça só (S-097): crânio em cunha, "stop" na testa, focinho afinando, bochechas largas e máscara clara
  const hg = new THREE.SphereGeometry(1, 56, 40), HP = hg.attributes.position, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let k = 0; k < HP.count; k++) {
    let x = HP.getX(k), y = HP.getY(k), z = HP.getZ(k);
    const t = sm(0.15, 1, z); // 0 = crânio, 1 = ponta do focinho
    let X = x * 0.125 * (1 - 0.5 * t), Y = y * 0.11 * (1 - 0.42 * t), Z = z * 0.12 + Math.pow(Math.max(0, z - 0.15) / 0.85, 1.3) * 0.2;
    Y += -0.04 * t + (y > 0 ? -0.012 * Math.exp(-Math.pow((z - 0.35) / 0.15, 2)) : 0); // focinho mais baixo e o "degrau" da testa
    if (y < 0.2 && z < 0.45 && z > -0.5) X *= 1 + 0.18 * (1 - Math.abs(z)) * (1 - Math.max(0, y)); // bochechas
    if (y > 0.5) Y *= 0.92; // topo achatado
    if (y < -0.3 && z > 0.2) Y += 0.01 * t; // queixo do focinho mais reto
    HP.setXYZ(k, X, Y, Z);
  }
  hg.computeVertexNormals();
  vcolor(hg, (c, x, y, z) => { const muzzleUnder = y < -0.02 && z > 0.05, mask = (z > 0.02 && z < 0.1 && y > 0.02 && Math.abs(x) > 0.035) ? 1 : 0;
    c.copy(base); if (y > 0.04 && Math.abs(x) < 0.05) c.offsetHSL(0, 0, -0.14); // listra escura no alto do focinho/testa
    if (muzzleUnder || mask) c.lerp(LIGHT.color, 0.85); if (z > 0.3) c.lerp(new THREE.Color('#2a2224'), sm(0.3, 0.33, z) * 0.8); });
  const skull = new THREE.Mesh(hg, VC(0.9)); head.add(skull);
  const noseG = new THREE.SphereGeometry(0.017, 20, 14); noseG.scale(1.3, 0.85, 0.9); { const P = noseG.attributes.position; for (let k = 0; k < P.count; k++) if (P.getY(k) < -0.005 && Math.abs(P.getX(k)) < 0.012) P.setZ(k, P.getZ(k) - 0.006); noseG.computeVertexNormals(); } // narinas
  const nose = new THREE.Mesh(noseG, mat('#141012', { roughness: 0.25 })); nose.position.set(0, -0.03, 0.312); head.add(nose);
  // bochechas de pelo varrendo para trás (no lugar das "bolas")
  furPatch(head, STRAND, [{ n: 126, c: [0, -0.02, 0.0], r: [0.13, 0.11, 0.12], len: 0.75, back: 1.6, yMin: -0.7 }], rng, base, tones);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.075, 0.08); head.add(jaw);
  jaw.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.01, 0.12), V3(0, -0.005, 0.2)], 0.048, 0.028, 12, 20), LIGHT));
  jaw.add(blob(0.028, 1, 0.4, 2.2, MOUTH, 0, 0.022, 0.12, 10));
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.032, 14), TOOTH); f.rotation.x = Math.PI; f.position.set(sx * 0.024, -0.068, 0.27); head.add(f); }
  for (const sx of [-1, 1]) {
    head.add(blob(0.021, 1.5, 0.75, 0.6, mat('#e8b04a', { emissive: '#c07010', emissiveIntensity: 0.25, roughness: 0.15 }), sx * 0.068, 0.035, 0.12, 12));
    head.add(blob(0.009, 1, 1.25, 0.6, NOSE, sx * 0.07, 0.035, 0.133, 8));
  }
  // orelhas grossas (com espessura e borda arredondada), triangulares e levemente em concha, de dentro mais claro e peludo
  const earShape = new THREE.Shape(); earShape.moveTo(-0.055, 0); earShape.quadraticCurveTo(-0.05, 0.1, -0.006, 0.17); earShape.quadraticCurveTo(0, 0.18, 0.006, 0.17); earShape.quadraticCurveTo(0.05, 0.1, 0.055, 0); earShape.quadraticCurveTo(0, -0.012, -0.055, 0);
  const earOutG = new THREE.ExtrudeGeometry(earShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 12 });
  { const P = earOutG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); P.setZ(k, P.getZ(k) - x * x * 6 * (1 - y * 3)); } earOutG.computeVertexNormals(); } // concha
  const inShape = new THREE.Shape(); inShape.moveTo(-0.034, 0.012); inShape.quadraticCurveTo(-0.03, 0.08, 0, 0.135); inShape.quadraticCurveTo(0.03, 0.08, 0.034, 0.012); inShape.quadraticCurveTo(0, 0.004, -0.034, 0.012);
  const earInG = new THREE.ShapeGeometry(inShape, 10); { const P = earInG.attributes.position; for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); P.setZ(k, 0.024 - x * x * 6 * (1 - y * 3) + 0.003); } earInG.computeVertexNormals(); }
  const EAR_OUT = mat(base.clone().offsetHSL(0, 0, -0.14), { roughness: 0.95 }), EAR_IN = mat(INNER.color, { roughness: 0.9, side: THREE.DoubleSide });
  const ears = [-1, 1].map(sx => {
    const e = new THREE.Group(); e.position.set(sx * 0.07, 0.075, -0.035); e.rotation.set(-0.25, sx * 0.35, -sx * 0.25); head.add(e);
    e.add(new THREE.Mesh(earOutG, EAR_OUT)); e.add(new THREE.Mesh(earInG, EAR_IN));
    furPatch(e, STRAND, [{ n: 26, c: [0, 0.04, 0.02], r: [0.03, 0.04, 0.01], len: 0.3, back: -0.2 }], rng, LIGHT.color.clone(), [LIGHT.color.clone(), base.clone()]); // pelinhos de dentro
    return e;
  });
  // rabo peludo
  const tail = new THREE.Group(); tail.position.set(0, 0.76, -0.52); body.add(tail);
  const tailCurve = [V3(0, 0, 0), V3(0, -0.05, -0.18), V3(0, -0.2, -0.32), V3(0, -0.36, -0.38)];
  tail.add(new THREE.Mesh(taper(tailCurve, 0.06, 0.085, 16, 12), FUR));
  furPatch(tail, STRAND, [{ n: 81, c: [0, -0.08, -0.22], r: [0.09, 0.12, 0.13], len: 1.1, back: -0.4 }, { n: 72, c: [0, -0.3, -0.36], r: [0.09, 0.1, 0.08], len: 1.0, back: -0.2 }], rng, base, tones);
  tail.add(blob(0.07, 1, 1.5, 1, BACK, 0, -0.4, -0.39, 14));
  const legs = [[-0.12, 0.3, true], [0.12, 0.3, true], [-0.13, -0.36, false], [0.13, -0.36, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.62, z); body.add(pv);
    pv.add(new THREE.Mesh(taper([V3(0, 0.08, 0), V3(0, -0.12, front ? 0.01 : -0.05), V3(0, -0.28, front ? 0 : -0.07)], front ? 0.075 : 0.09, 0.042, 10, 12), FUR));
    const knee = new THREE.Group(); knee.position.set(0, -0.28, front ? 0 : -0.07); pv.add(knee);
    knee.add(new THREE.Mesh(taper([V3(0, 0, 0), V3(0, -0.15, front ? 0.01 : 0.05), V3(0, -0.28, front ? 0.02 : 0.07)], 0.04, 0.03, 10, 10), LIGHT));
    const paw = pawGeo(LIGHT, CLAW); paw.position.set(0, -0.3, front ? 0.03 : 0.08); knee.add(paw);
    return { pv, knee, paw, front };
  });
  shadowAll(root);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#e8b04a' }); // (compatível: brilha quando bravo)
  let ph = 0, gait = 0, lt = 0, at = -9, sniff = 0;
  return { root, eyeMat, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; gait += ((moving ? 1 : 0) - gait) * Math.min(1, dt * 6);
    ph += dt * (2 + gait * 10);
    const sk = strike((t - at) / 0.5);
    legs.forEach(({ pv, knee, paw, front }, i) => { const p = ph + (i % 2 ? Math.PI : 0) + (front ? 0 : Math.PI * 0.5); pv.rotation.x = Math.sin(p) * 0.55 * gait - (front ? sk * 0.5 : -sk * 0.3); knee.rotation.x = (front ? -1 : 1) * Math.max(0, Math.cos(p)) * 0.7 * gait; paw.rotation.x = Math.max(0, -Math.sin(p)) * 0.6 * gait - pv.rotation.x * 0.5; }); // a pata dobra ao levantar
    const breath = Math.sin(t * (moving ? 6 : 2.2)) * 0.02;
    body.scale.set(1 + breath, 1 + breath * 0.5, 1);
    body.position.y = Math.abs(Math.sin(ph)) * 0.04 * gait + Math.max(0, sk) * 0.08;
    body.position.z = sk * 0.3; body.rotation.x = Math.sin(ph * 2) * 0.03 * gait - sk * 0.12;
    // parado: de vez em quando abaixa a cabeça e fareja o chão
    const sniffWant = !moving && Math.sin(t * 0.45 + 1.3) > 0.55 ? 1 : 0; sniff += (sniffWant - sniff) * Math.min(1, dt * 2.5);
    neck.rotation.x = Math.sin(ph * 2) * 0.06 * gait + Math.sin(t * 0.8) * 0.03 * (1 - gait) + sk * 0.35 + sniff * 0.55;
    neck.rotation.y = Math.sin(t * 0.5) * 0.25 * (1 - gait) * (1 - sniff) * (sk ? 0 : 1) + sniff * Math.sin(t * 3) * 0.12;
    head.rotation.x = -sniff * 0.15 + Math.sin(t * 11) * 0.02 * sniff;
    jaw.rotation.x = Math.max(0, sk) * 0.75 + (moving ? 0.1 : 0) + Math.max(0, Math.sin(t * 1.3)) * 0.04 * (1 - gait);
    ears.forEach((e, i) => { const tw = Math.max(0, Math.sin(t * 0.9 + i * 2.1) - 0.93) * 6; e.rotation.x = -0.15 - 0.35 * gait - Math.max(0, sk) * 0.5 + tw * 0.4; e.rotation.z = (i ? -1 : 1) * 0.22 + tw * (i ? -0.2 : 0.2); }); // orelhas mexem sozinhas
    tail.rotation.y = Math.sin(t * (2.5 + gait * 6)) * (0.3 + gait * 0.1); tail.rotation.x = 0.35 * gait - 0.05 + Math.max(0, sk) * 0.35 + Math.sin(ph) * 0.06 * gait;
  } };
}

/* ---------- Boneco de treino (S-090): espírito de ginásio grego ----------
   Mastro de madeira, corpo de palha amarrado com tiras de couro, elmo de bronze com crista vermelha,
   escudo redondo de bronze com um sol pintado, espada de madeira e base de pedra com friso grego.
   Balança numa mola quando apanha e solta palha. Nunca morre. */
export function dummy() {
  const root = new THREE.Group(), sway = new THREE.Group(); root.add(sway);
  const wood = mat('#7a5232', { roughness: 0.85 }), straw = mat('#d9b866', { roughness: 1 }), leather = mat('#6a3a1e', { roughness: 0.7 });
  const bronze = mat('#c08a3a', { metalness: 0.75, roughness: 0.32 }), red = mat('#b3262a', { roughness: 0.8 }), stone = mat('#b9b2a2', { roughness: 0.9 });
  // base de pedra com friso grego (meandro pintado numa textura)
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const g = cv.getContext('2d'); g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, 256, 32); g.strokeStyle = '#6a4a2a'; g.lineWidth = 3;
  g.beginPath(); for (let x = 0; x < 256; x += 32) { g.moveTo(x + 4, 26); g.lineTo(x + 4, 6); g.lineTo(x + 24, 6); g.lineTo(x + 24, 20); g.lineTo(x + 12, 20); g.lineTo(x + 12, 13); g.lineTo(x + 18, 13); g.moveTo(x + 4, 26); g.lineTo(x + 36, 26); } g.stroke();
  const ftex = new THREE.CanvasTexture(cv); ftex.colorSpace = THREE.SRGBColorSpace; ftex.wrapS = THREE.RepeatWrapping; ftex.repeat.set(3, 1);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.28, 32), [new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.9 }), stone, stone]); base.position.y = 0.14; root.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.08, 32), stone); step.position.y = 0.04; root.add(step);
  // mastro e corpo (a parte de cima balança)
  sway.position.y = 0.28;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 14), wood); pole.position.y = 0.9; sway.add(pole);
  const torsoG = new THREE.SphereGeometry(0.27, 28, 20), TP = torsoG.attributes.position;
  for (let k = 0; k < TP.count; k++) { const x = TP.getX(k), y = TP.getY(k), z = TP.getZ(k), a = Math.atan2(z, x); const ridge = 1 + Math.sin(a * 22 + y * 30) * 0.025; TP.setXYZ(k, x * ridge * (1 + (y < 0 ? y * 0.3 : 0)), y * 1.5, z * ridge * 0.8); }
  torsoG.computeVertexNormals();
  const torso = new THREE.Mesh(torsoG, straw); torso.position.y = 1.25; sway.add(torso);
  for (const y of [1.0, 1.25, 1.5]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.255 - Math.abs(y - 1.25) * 0.2, 0.02, 8, 32), leather); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.8, 1); band.position.y = y; sway.add(band); }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 32), leather); strap.rotation.set(0.2, 0, 0.8); strap.scale.set(1, 1.45, 0.8); strap.position.y = 1.25; sway.add(strap);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 12), wood); arm.rotation.z = Math.PI / 2; arm.position.y = 1.42; sway.add(arm);
  for (const sx of [-1, 1]) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 12, 1, true), straw); tuft.rotation.z = sx * Math.PI / 2; tuft.position.set(sx * 0.5, 1.42, 0); sway.add(tuft); }
  // cabeça de palha + elmo de bronze com crista
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), straw); head.position.y = 1.78; sway.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.175, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze); helm.position.y = 1.8; sway.add(helm);
  for (const sx of [-1, 1]) { const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12, 0, Math.PI, 0, Math.PI * 0.6), bronze); cheek.scale.set(0.45, 1.2, 1); cheek.rotation.set(Math.PI, sx * Math.PI / 2, 0); cheek.position.set(sx * 0.13, 1.74, 0.05); sway.add(cheek); }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), bronze); nose.position.set(0, 1.74, 0.17); sway.add(nose);
  const crest = new THREE.Group(); crest.position.y = 1.95; sway.add(crest);
  const cHold = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.24), bronze); cHold.position.y = 0.02; crest.add(cHold);
  for (let k = 0; k < 14; k++) { const u = k / 13, plume = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 8), red); plume.position.set(0, 0.12 - Math.abs(u - 0.5) * 0.08, -0.16 + u * 0.32); plume.rotation.x = (u - 0.5) * 1.5 - 0.2; crest.add(plume); }
  // escudo de bronze com sol pintado
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d'); sg.fillStyle = '#c08a3a'; sg.fillRect(0, 0, 128, 128);
  sg.fillStyle = '#7a1e1a'; sg.beginPath(); sg.arc(64, 64, 26, 0, 7); sg.fill(); sg.strokeStyle = '#7a1e1a'; sg.lineWidth = 6; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; sg.beginPath(); sg.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); sg.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); sg.stroke(); }
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const shieldG = new THREE.SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.22); shieldG.rotateX(Math.PI / 2);
  const shield = new THREE.Mesh(shieldG, new THREE.MeshStandardMaterial({ map: stex, metalness: 0.6, roughness: 0.35 })); shield.position.set(-0.44, 1.3, 0.12); shield.rotation.y = -0.5; sway.add(shield);
  // espada de madeira
  const sword = new THREE.Group(); sword.position.set(0.48, 1.35, 0.1); sword.rotation.set(0.3, 0, -0.35); sway.add(sword);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.02), mat('#a0763f')); blade.position.y = 0.32; sword.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.04), wood); sword.add(guard);
  shadowAll(root);
  // palha que voa quando apanha
  const bits = []; for (let k = 0; k < 10; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.012), straw); b.visible = false; root.add(b); bits.push({ b, v: V3(), life: 0 }); }
  let vel = 0, ang = 0, lt = 0, last = 0;
  return { root, hit(dir = 1) { vel += 2.6 * dir; for (const p of bits) { p.life = 0.6 + Math.random() * 0.4; p.b.visible = true; p.b.position.set((Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 0.4, 0.2); p.v.set((Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.2) * 2); } },
    animate(t) {
      const dt = Math.min(0.05, Math.max(0, t - lt)); lt = t;
      vel += (-ang * 38 - vel * 3.2) * dt; ang += vel * dt; // mola amortecida
      sway.rotation.x = ang * 0.35; sway.rotation.z = Math.sin(ang * 0.7) * 0.15; crest.rotation.x = -ang * 0.4;
      for (const p of bits) { if (p.life <= 0) continue; p.life -= dt; p.v.y -= 6 * dt; p.b.position.addScaledVector(p.v, dt); p.b.rotation.x += dt * 8; if (p.life <= 0 || p.b.position.y < 0) p.b.visible = false; }
    } };
}

/* =========================================================================
   CHEFES GRANDES (S-138) — originais, inspirados só na *sensação* dos chefes mais queridos de MMORPGs
   e do Skyrim: um rei-demônio das dunas, um bruxo-bode das sombras, um dragão do inverno e uma rainha
   morta-viva. Altura de referência ≈ 1 (o tamanho do monstro em data multiplica). Peças fixas de cada
   parte animada são juntadas numa malha só (cor por vértice) para pesar pouco.
   ========================================================================= */
const rngOf = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
// esfera orgânica: deformada por ruído suave (músculo, pedra, couro) — sem facetas
function organic(r, sx, sy, sz, amt = 0.06, seed = 1, seg = 26) {
  let g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) / r, y = P.getY(i) / r, z = P.getZ(i) / r;
    const n = Math.sin(x * 4.7 + seed) * Math.cos(y * 4.1 + seed * 2.3) * 0.5 + Math.sin(z * 5.9 + y * 2.7 + seed) * 0.32 + Math.sin((x + z) * 10.3 + seed * 3) * 0.12;
    const k = 1 + n * amt; P.setXYZ(i, x * r * sx * k, y * r * sy * k, z * r * sz * k);
  }
  g.computeVertexNormals(); return g;
}
const tube = (pts, r0, r1, seg = 18, rad = 12) => { const g = taper(pts, r0, r1, seg, rad); g.deleteAttribute('uv'); return g; };
const TR = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; };
// pinta por vértice: cor base + função (c, x, y, z, ny)
function paintG(g, fn) { const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), c = new THREE.Color(); for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i), N.getY(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; }
const flat = hex => { const c0 = new THREE.Color(hex); return g => paintG(g, c => c.copy(c0)); };
// junta tudo numa malha com cor por vértice
function fuse(parts, m) { const idx = parts.every(g => g.index), geos = parts.map(g => { const x = idx ? g : (g.index ? g.toNonIndexed() : g); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k); return x; }); const me = new THREE.Mesh(mergeGeometries(geos), m); me.castShadow = true; me.receiveShadow = true; return me; }
const VCB = (r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, ...extra });
const GLOWM = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const ADD = (c, o = 0.8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
// chifre com anéis em relevo, seguindo um caminho (pts com x para fora; sx espelha o lado)
function hornGeo(sx, pts, r0, seed = 1) {
  const P3 = pts.map(([x, y, z]) => V3(sx * x, y, z)), SEG = 48, RAD = 14, g = tube(P3, r0, r0 * 0.08, SEG, RAD), P = g.attributes.position, curve = new THREE.CatmullRomCurve3(P3);
  for (let i = 0; i < P.count; i++) { const u = Math.floor(i / (RAD + 1)) / SEG, c = curve.getPointAt(Math.min(1, u)), d = V3(P.getX(i) - c.x, P.getY(i) - c.y, P.getZ(i) - c.z), k = 1 + Math.pow(Math.max(0, Math.sin(u * 70 + seed)), 3) * 0.12 * (1 - u * 0.7); P.setXYZ(i, c.x + d.x * k, c.y + d.y * k, c.z + d.z * k); }
  g.computeVertexNormals(); return g;
}
const hornPaint = (dark, light, len) => (c, x, y, z) => c.set(dark).lerp(new THREE.Color(light), Math.min(1, Math.hypot(x, y, z) / len));
// asa de membrana: ossos + pele entre os "dedos" com bordas recortadas (rasgos)
function wingGeo(sx, span, h, torn = 0.2, seed = 3) {
  const rng = rngOf(seed), sh = new THREE.Shape(); const fingers = [[span * 0.55, h * 0.95], [span, h * 0.55], [span * 0.92, -h * 0.05], [span * 0.62, -h * 0.4]];
  sh.moveTo(0, 0); sh.lineTo(span * 0.18, h * 0.42); sh.lineTo(...fingers[0]);
  for (let k = 0; k < fingers.length - 1; k++) { const [x0, y0] = fingers[k], [x1, y1] = fingers[k + 1], mx = (x0 + x1) / 2 - span * 0.1, my = (y0 + y1) / 2 - h * 0.06; const tx = mx + (rng() - 0.5) * span * torn * 0.3, ty = my + (rng() - 0.5) * h * torn * 0.3; sh.quadraticCurveTo(tx, ty, x1, y1); }
  sh.quadraticCurveTo(span * 0.25, -h * 0.35, 0, -h * 0.05); sh.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(sh, 10), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setXYZ(i, sx * x, y, -Math.sin(x / span * Math.PI) * span * 0.12 - Math.abs(y) * 0.08); } // membrana em concha
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const bones = [tube([V3(0, 0, 0), V3(sx * span * 0.12, h * 0.3, -span * 0.03), V3(sx * span * 0.18, h * 0.42, -span * 0.04)], span * 0.03, span * 0.022, 10, 8)];
  for (const [fx, fy] of fingers) bones.push(tube([V3(sx * span * 0.18, h * 0.42, -span * 0.04), V3(sx * (span * 0.18 + fx) / 2, (h * 0.42 + fy) / 2 + h * 0.06, -Math.sin(0.5 * Math.PI) * span * 0.1), V3(sx * fx, fy, -Math.sin(fx / span * Math.PI) * span * 0.12)], span * 0.018, span * 0.004, 12, 6));
  return { membrane: g, bones };
}
// chama viva: línguas de fogo aditivas que tremem (para coroas, braseiros, bocas)
function flameTongues(parent, n, r, h, cols, seed = 1) {
  const rng = rngOf(seed), list = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + rng(), rr = r * (0.4 + rng() * 0.6), hh = h * (0.6 + rng() * 0.6);
    const g = tube([V3(0, 0, 0), V3((rng() - 0.5) * r * 0.4, hh * 0.5, (rng() - 0.5) * r * 0.4), V3((rng() - 0.5) * r * 0.6, hh, (rng() - 0.5) * r * 0.6)], r * 0.32, 0.0005, 10, 8);
    const m = new THREE.Mesh(g, ADD(cols[k % cols.length], 0.75)); m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); m.userData.ph = rng() * 6; parent.add(m); list.push(m);
  }
  return t => list.forEach((m, i) => { m.scale.set(1 + Math.sin(t * 13 + m.userData.ph) * 0.15, 0.8 + Math.sin(t * 9 + m.userData.ph * 2) * 0.25 + Math.sin(t * 21 + i) * 0.08, 1); m.rotation.y = Math.sin(t * 3 + m.userData.ph) * 0.4; });
}
// aura de partículas que sobem (brasas, flocos, almas)
function risingMotes(parent, n, radius, height, color, size = 0.012, seed = 5) {
  const rng = rngOf(seed), ms = [], mat2 = ADD(color, 0.9);
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(size * (0.6 + rng() * 0.8), 8, 6), mat2); m.userData = { a: rng() * 6.28, r: radius * (0.3 + rng() * 0.7), ph: rng(), sp: 0.15 + rng() * 0.2 }; parent.add(m); ms.push(m); }
  return t => ms.forEach(m => { const u = m.userData, q = (t * u.sp + u.ph) % 1; m.position.set(Math.cos(u.a + t * 0.3) * u.r, q * height, Math.sin(u.a + t * 0.3) * u.r); m.scale.setScalar(Math.sin(q * Math.PI) + 0.1); });
}
// marcha bípede genérica (pernas giram no quadril; joelho dobra; corpo balança)
const walkPhase = (st, moving, dt, speed) => { st.ph += dt * (moving ? speed : 0); st.w += ((moving ? 1 : 0) - st.w) * Math.min(1, dt * 5); return st; };

/* ---------- 1. Kharzûl, Soberano das Areias Rubras (rei-demônio das dunas, fogo) ----------
   Gigante de basalto com veias de magma, chifres que varrem para trás e voltam à frente, asas
   rasgadas de couro, coroa de fogo vivo e um cutelo de obsidiana com fio incandescente. */
export function demonKing(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const rng = rngOf(41), SK = VCB(0.75), BONE = VCB(0.45), WING = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  const basalt = (c, x, y, z, ny) => { const n = Math.sin(x * 61 + y * 23) * Math.cos(z * 47 - y * 31); c.set('#4a322b').lerp(new THREE.Color('#1a100e'), 0.3 + 0.3 * Math.sin(y * 13 + x * 9)).lerp(new THREE.Color('#7a5444'), Math.max(0, ny) * 0.4).lerp(new THREE.Color('#ff5a1a'), Math.max(0, n - 0.86) * 5.5); };
  const S = g => paintG(g, basalt), magma = ADD('#ff7a22', 0.95), magma2 = GLOWM('#ffb347');
  // quadril, abdômen e peito em V (músculo)
  const torso = new THREE.Group(); torso.position.y = 0.46; body.add(torso);
  const tParts = [S(TR(organic(0.11, 1.15, 0.8, 0.85, 0.07, 2), 0, 0, 0)), S(TR(organic(0.1, 1.05, 1.0, 0.85, 0.06, 3), 0, 0.09, 0.01)), S(TR(organic(0.16, 1.35, 0.85, 0.82, 0.05, 4), 0, 0.2, 0.0)),
    S(TR(organic(0.08, 1, 0.75, 0.6, 0.05, 5), -0.07, 0.21, 0.08)), S(TR(organic(0.08, 1, 0.75, 0.6, 0.05, 6), 0.07, 0.21, 0.08)), S(TR(organic(0.07, 0.9, 1.1, 0.8, 0.05, 7), 0, 0.31, 0.02))];
  for (let k = 0; k < 5; k++) tParts.push(paintG(TR(tube([V3(0, 0, 0), V3(0, 0.04, -0.02), V3(0, 0.09, 0.02)], 0.022 - k * 0.002, 0.004), 0, 0.24 + k * 0.012, -0.12 - k * 0.012, -0.6 - k * 0.15), c => c.set('#2a1b18'))); // espinhos curtos nas costas
  torso.add(fuse(tParts, SK));
  // veias de magma pelo corpo
  for (let k = 0; k < 7; k++) { const a = rng() * 6.28, y0 = 0.02 + rng() * 0.25; const v = new THREE.Mesh(tube([V3(Math.cos(a) * 0.13, y0, Math.sin(a) * 0.1 + 0.02), V3(Math.cos(a + 0.4) * 0.15, y0 + 0.05, Math.sin(a + 0.4) * 0.11 + 0.02), V3(Math.cos(a + 0.7) * 0.12, y0 + 0.11, Math.sin(a + 0.7) * 0.09 + 0.02)], 0.004, 0.002, 10, 5), magma); torso.add(v); }
  // coração de magma no peito (aparece por uma fenda)
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.022, 18, 12), ADD('#ff6a1a', 0.85)); heart.scale.set(0.7, 1.6, 0.4); heart.position.set(-0.005, 0.205, 0.118); torso.add(heart);
  const fissure = new THREE.Mesh(tube([V3(-0.02, 0.15, 0.125), V3(0.01, 0.2, 0.13), V3(-0.01, 0.26, 0.122)], 0.012, 0.004, 10, 6), magma); torso.add(fissure);
  // cinturão de couro e tanga de tecido rasgado
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 10, 36), new THREE.MeshStandardMaterial({ color: '#3a2216', roughness: 0.8 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1.12, 0.9, 1); belt.position.y = 0.0; torso.add(belt);
  const skirtG = new THREE.CylinderGeometry(0.12, 0.17, 0.22, 36, 6, true), SP = skirtG.attributes.position; for (let i = 0; i < SP.count; i++) { const x = SP.getX(i), y = SP.getY(i), z = SP.getZ(i), a = Math.atan2(z, x); if (y < -0.1) SP.setY(i, y - Math.max(0, Math.sin(a * 7)) * 0.05 - Math.abs(Math.sin(a * 3)) * 0.03); SP.setX(i, x * (1 + Math.sin(a * 9 + y * 20) * 0.04)); } skirtG.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtG, new THREE.MeshStandardMaterial({ color: '#5a1a14', roughness: 0.9, side: THREE.DoubleSide })); skirt.position.y = -0.1; torso.add(skirt);
  // cabeça: crânio alongado, sobrancelha pesada, mandíbula com presas, olhos de brasa
  torso.add(fuse([S(TR(organic(0.06, 1.1, 1.0, 0.95, 0.06, 8), 0, 0.37, 0.03))], SK)); // pescoço grosso
  const head = new THREE.Group(); head.position.set(0, 0.45, 0.06); torso.add(head);
  head.add(fuse([S(organic(0.068, 0.95, 1.05, 1.15, 0.06, 9)), S(TR(organic(0.045, 1.25, 0.55, 0.9, 0.05, 10), 0, 0.02, 0.04)), S(TR(organic(0.04, 1.1, 0.6, 1.1, 0.05, 11), 0, -0.04, 0.04)),
    ...[-1, 1].map(sx => paintG(TR(tube([V3(0, 0, 0), V3(0, -0.012, 0.004), V3(0, -0.022, 0.0)], 0.006, 0.001, 6, 6), sx * 0.022, -0.055, 0.075), c => c.set('#efe0c0'))),
    ...[-1, 1].map(sx => paintG(TR(tube([V3(0, 0, 0), V3(sx * 0.02, 0.0, 0.02), V3(sx * 0.03, -0.01, 0.035)], 0.012, 0.003, 8, 6), sx * 0.04, -0.04, 0.03), c => c.set('#2a1a16')))], SK));
  for (const sx of [-1, 1]) { const sock = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: '#120604' })); sock.scale.set(1.4, 0.7, 0.5); sock.position.set(sx * 0.028, 0.014, 0.07); sock.rotation.z = sx * 0.35; head.add(sock); const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), GLOWM('#ffd23a')); e.scale.set(1.5, 0.55, 0.6); e.position.set(sx * 0.028, 0.014, 0.077); e.rotation.z = sx * 0.35; head.add(e); const halo = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), ADD('#ff8a1a', 0.35)); halo.scale.set(1.6, 0.8, 0.5); halo.position.copy(e.position); head.add(halo); }
  const mouthGlow = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), magma); mouthGlow.scale.set(1.6, 0.5, 0.4); mouthGlow.position.set(0, -0.035, 0.072); head.add(mouthGlow);
  const DH = [[0.03, 0, 0], [0.09, 0.05, -0.02], [0.16, 0.09, -0.07], [0.21, 0.09, -0.15], [0.23, 0.14, -0.22], [0.21, 0.23, -0.2], [0.18, 0.28, -0.13]]; // sobem, varrem para trás e voltam à frente
  head.add(fuse([-1, 1].map(sx => TR(paintG(hornGeo(sx, DH, 0.026, 2 + sx), hornPaint('#1c1412', '#a89478', 0.36)), 0, 0.035, -0.01)), BONE));
  // coroa de fogo
  const crown = new THREE.Group(); crown.position.set(0, 0.065, -0.01); head.add(crown); const crownFx = flameTongues(crown, 9, 0.05, 0.1, ['#ff5a0a', '#ff8a1a', '#c8300a'], 3); crown.children.forEach(m => m.material.opacity = 0.55);
  // braços com ombreiras de pedra e garras
  const arm = sx => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.2, 0.26, 0); torso.add(sh);
    sh.add(fuse([S(organic(0.075, 1.1, 0.8, 1, 0.12, 20 + sx)), S(TR(organic(0.055, 0.85, 1.45, 0.85, 0.05, 22 + sx), sx * 0.03, -0.08, 0)), ...[0, 1, 2].map(k => paintG(TR(tube([V3(0, 0, 0), V3(sx * 0.02, 0.03, 0), V3(sx * 0.03, 0.06, -0.01)], 0.016, 0.002, 8, 6), sx * (0.03 + k * 0.025), 0.04, -0.02 + k * 0.02), c => c.set('#1a1210')))], SK));
    const el = new THREE.Group(); el.position.set(sx * 0.035, -0.16, 0.0); sh.add(el);
    el.add(fuse([S(TR(organic(0.045, 0.85, 1.6, 0.85, 0.05, 24 + sx), 0, -0.07, 0.02)), S(TR(organic(0.035, 1.1, 0.8, 1.2, 0.05, 26 + sx), 0, -0.15, 0.03)), ...[0, 1, 2, 3].map(k => paintG(TR(tube([V3(0, 0, 0), V3(0, -0.02, 0.012), V3(0, -0.035, 0.0)], 0.007, 0.001, 8, 6), (k - 1.5) * 0.014, -0.17, 0.05), c => c.set('#e8d8b8')))], SK));
    return { sh, el };
  };
  const R = arm(-1), L = arm(1);
  // cutelo de obsidiana com fio incandescente (na mão direita)
  const blade = new THREE.Group(); blade.position.set(0, -0.16, 0.04); R.el.add(blade);
  const bs = new THREE.Shape(); bs.moveTo(-0.012, 0); bs.lineTo(0.012, 0); bs.lineTo(0.05, 0.12); bs.quadraticCurveTo(0.075, 0.32, 0.03, 0.5); bs.lineTo(-0.01, 0.46); bs.quadraticCurveTo(0.0, 0.25, -0.03, 0.1); bs.lineTo(-0.012, 0);
  const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }); bg.translate(0, 0.06, -0.006);
  const bm = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: '#141018', metalness: 0.6, roughness: 0.2, emissive: '#3a0a00', emissiveIntensity: 0.6 })); bm.castShadow = true; blade.add(bm);
  const edge = new THREE.Mesh(tube([V3(0.05, 0.18, 0), V3(0.074, 0.38, 0), V3(0.03, 0.56, 0)], 0.004, 0.002, 14, 5), magma); blade.add(edge);
  blade.add(fuse([paintG(TR(new THREE.CylinderGeometry(0.01, 0.012, 0.09, 10), 0, 0.0, 0), c => c.set('#2a1a10')), paintG(TR(organic(0.022, 2.2, 0.4, 0.8, 0.1, 31), 0, 0.055, 0), c => c.set('#4a3a2a'))], SK));
  blade.scale.setScalar(1.7); blade.rotation.set(Math.PI / 2 - 0.3, Math.PI / 2, 0); // lâmina de pé, fio para baixo, apontando à frente
  // pernas grossas com cascos (dobradas para trás, digitígradas)
  const leg = sx => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.085, 0.45, -0.01); body.add(hip);
    hip.add(fuse([S(TR(organic(0.075, 1.0, 1.7, 1.05, 0.05, 40 + sx), 0, -0.1, 0.02))], SK));
    const knee = new THREE.Group(); knee.position.set(0, -0.2, 0.04); hip.add(knee);
    knee.add(fuse([S(TR(organic(0.055, 0.95, 1.7, 1.0, 0.05, 42 + sx), 0, -0.07, -0.04, 0.35)), S(TR(organic(0.042, 0.95, 1.3, 0.95, 0.05, 44 + sx), 0, -0.17, -0.07, -0.3)), paintG(TR(organic(0.05, 1.15, 0.6, 1.35, 0.04, 46 + sx), 0, -0.228, -0.04), c => c.set('#120c0a'))], SK));
    return { hip, knee };
  };
  const LL = leg(-1), LR = leg(1);
  // asas rasgadas
  const wings = [-1, 1].map(sx => { const w = new THREE.Group(); w.position.set(sx * 0.07, 0.27, -0.09); torso.add(w); const wg = wingGeo(sx, 0.55, 0.42, 0.5, 7 + sx); w.add(fuse([paintG(wg.membrane, (c, x, y) => c.set('#3a1410').lerp(new THREE.Color('#7a2a18'), Math.max(0, 0.3 - y) * 1.2))], WING)); w.add(fuse(wg.bones.map(S), SK)); w.rotation.set(0.25, sx * -0.55, 0); return w; });
  const motes = new THREE.Group(); body.add(motes); const moteFx = risingMotes(motes, 16, 0.32, 0.95, '#ff8a2a', 0.006, 9);
  shadowAll(root); for (const m of [mouthGlow, heart, fissure, edge]) m.castShadow = false;
  const st = { ph: 0, w: 0 }; let lt = 0, at = -9;
  return { root, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; walkPhase(st, moving, dt, 3.2); const s = Math.sin(st.ph), w = st.w, k = (t - at) / 1.1;
    // golpe em três tempos: ergue o cutelo acima da cabeça, desce com tudo, volta
    let swing = -0.2, lean = 0, rise = 0;
    if (k >= 0 && k < 1) { if (k < 0.5) { const e = Math.sin(k / 0.5 * Math.PI / 2); swing = -0.2 - 2.6 * e; lean = -0.15 * e; rise = e; } else if (k < 0.72) { const e = (k - 0.5) / 0.22; swing = -2.8 + 2.5 * e * e; lean = -0.15 + 0.45 * e; rise = 1 - e; } else { const e = (k - 0.72) / 0.28; swing = -0.3 + 0.1 * e; lean = 0.3 * (1 - e); } }
    LL.hip.rotation.x = s * 0.45 * w; LR.hip.rotation.x = -s * 0.45 * w; LL.knee.rotation.x = Math.max(0, -s) * 0.6 * w; LR.knee.rotation.x = Math.max(0, s) * 0.6 * w;
    body.position.y = Math.abs(Math.cos(st.ph)) * 0.012 * w - Math.max(0, lean) * 0.05;
    torso.rotation.y = s * 0.08 * w - rise * 0.2; torso.rotation.x = 0.06 + Math.sin(t * 1.4) * 0.015 + lean;
    torso.scale.set(1 + Math.sin(t * 1.4) * 0.012, 1, 1 + Math.sin(t * 1.4) * 0.015); // respira
    R.sh.rotation.x = swing - s * 0.35 * w * (k >= 0 && k < 1 ? 0 : 1); R.sh.rotation.z = -0.15; R.el.rotation.x = -0.5 - rise * 0.4;
    L.sh.rotation.x = s * 0.35 * w - 0.1 - rise * 0.5; L.sh.rotation.z = 0.2 + Math.sin(t * 1.4) * 0.03 + rise * 0.4; L.el.rotation.x = -0.6;
    head.rotation.y = Math.sin(t * 0.5) * 0.25 * (1 - w) * (1 - rise); head.rotation.x = Math.sin(t * 0.8) * 0.05 - rise * 0.15 + Math.max(0, lean) * 0.4;
    wings.forEach((wg, i) => { const sx = i ? 1 : -1; wg.rotation.y = sx * (-0.55 + Math.sin(t * 1.2) * 0.12 + rise * 0.55); wg.rotation.x = 0.25 + Math.sin(t * 1.2 + 1) * 0.05; });
    heart.scale.setScalar(1 + Math.sin(t * 4) * 0.15); mouthGlow.material.opacity = 0.6 + Math.sin(t * 6) * 0.25;
    crownFx(t); moteFx(t); skirt.rotation.y = Math.sin(t * 1.3) * 0.05;
  } };
}

/* ---------- 2. Maldoran, o Chifre Negro (bruxo-bode das sombras) ----------
   Feiticeiro curvado de cabeça de bode, chifres longos e torcidos, barba, manto roxo com bordas de
   ouro velho e pelagem nos ombros; cajado com cabeça de carneiro e velas; um selo de runas gira no chão. */
export function goatMage(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const SK = VCB(0.85), CLOTH = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), BONE = VCB(0.45);
  const fur = (c, x, y, z, ny) => { c.set('#3a3034').lerp(new THREE.Color('#6a5e58'), 0.35 + Math.sin(x * 50 + y * 70) * 0.2 + Math.max(0, ny) * 0.35); };
  const F = g => paintG(g, fur);
  // manto (longo, aberto embaixo, com barra irregular e dobras)
  const robeG = new THREE.CylinderGeometry(0.12, 0.27, 0.62, 48, 12, true), RP = robeG.attributes.position;
  for (let i = 0; i < RP.count; i++) { const x = RP.getX(i), y = RP.getY(i), z = RP.getZ(i), a = Math.atan2(z, x), v = (0.31 - y) / 0.62; const fold = 1 + Math.sin(a * 11 + y * 4) * 0.05 * v; let yy = y; if (v > 0.95) yy -= Math.max(0, Math.sin(a * 5 + 1)) * 0.035 + Math.abs(Math.sin(a * 13)) * 0.012; RP.setXYZ(i, x * fold, yy, z * fold * (1 - Math.max(0, Math.sin(a)) * 0.08)); }
  robeG.translate(0, 0.32, 0); robeG.computeVertexNormals();
  paintG(robeG, (c, x, y, z) => { const a = Math.atan2(z, x); c.set('#4a2862').lerp(new THREE.Color('#1c0e28'), 0.3 + Math.sin(a * 11) * 0.28); if (y < 0.035) c.lerp(new THREE.Color('#c8a24a'), 0.85); if (Math.abs(Math.sin(a * 4 + 1.57)) > 0.985 && z > 0) c.lerp(new THREE.Color('#c8a24a'), 0.8); }); // barra e faixas douradas
  const robe = fuse([robeG], CLOTH); body.add(robe);
  const torso = new THREE.Group(); torso.position.set(0, 0.6, -0.02); torso.rotation.x = 0.32; body.add(torso); // curvado para frente
  torso.add(fuse([paintG(organic(0.13, 1.05, 1.1, 0.85, 0.05, 2), (c, x, y, z) => c.set('#4a2862').lerp(new THREE.Color('#1c0e28'), 0.3 + Math.sin(x * 30) * 0.2)),
    F(TR(organic(0.12, 1.4, 0.5, 1.05, 0.09, 3), 0, 0.1, -0.01)), // pelagem dos ombros
    paintG(TR(new THREE.TorusGeometry(0.1, 0.01, 8, 30, Math.PI), 0, 0.03, 0.1, 0, 0, Math.PI), c => c.set('#b8923a')) // gola dourada
  ], SK));
  // cabeça de bode: focinho comprido, orelhas caídas, barba, olhos horizontais violeta
  const head = new THREE.Group(); head.position.set(0, 0.19, 0.1); head.scale.setScalar(1.45); torso.add(head);
  head.add(fuse([F(organic(0.055, 0.95, 1, 1.1, 0.06, 5)), paintG(TR(organic(0.04, 0.85, 0.8, 1.6, 0.05, 6), 0, -0.02, 0.06, 0.35), (c, x, y, z) => c.set('#8a7e72').lerp(new THREE.Color('#4a4040'), Math.max(0, y + 0.02) * 12)), paintG(TR(organic(0.014, 1.3, 0.7, 0.8, 0.05, 7), 0, -0.04, 0.122), c => c.set('#2a2224')),
    ...[-1, 1].map(sx => F(TR(organic(0.022, 0.6, 1.6, 0.4, 0.08, 8 + sx), sx * 0.06, -0.01, -0.005, 0, 0, sx * -1.1))),
    paintG(tube([V3(0, -0.06, 0.08), V3(0, -0.11, 0.075), V3(0.005, -0.16, 0.06)], 0.022, 0.003, 14, 10), c => c.set('#9a928a'))], SK));
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), GLOWM('#c27aff')); e.scale.set(2, 0.55, 0.6); e.position.set(sx * 0.03, 0.012, 0.055); e.rotation.y = sx * 0.4; head.add(e); }
  const GH = [[0.025, 0, 0], [0.04, 0.07, -0.03], [0.065, 0.15, -0.08], [0.09, 0.22, -0.15], [0.105, 0.26, -0.24], [0.1, 0.27, -0.3]]; // longos, subindo e varrendo para trás
  head.add(fuse([-1, 1].map(sx => TR(paintG(hornGeo(sx, GH, 0.019, 4 + sx), hornPaint('#1a1614', '#8a7a62', 0.42)), 0, 0.035, -0.01)), BONE));
  // braços magros nas mangas largas, mãos com garras
  const arm = sx => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.165, 0.06, 0.02); torso.add(sh);
    const sleeve = new THREE.CylinderGeometry(0.03, 0.065, 0.24, 24, 4, true); sleeve.translate(0, -0.12, 0);
    sh.add(fuse([paintG(sleeve, (c, x, y) => { c.set('#4a2862'); if (y < -0.225) c.set('#c8a24a'); }), paintG(TR(organic(0.022, 1, 1.2, 1, 0.08, 12 + sx), 0, -0.25, 0.01), c => c.set('#3a3440')), ...[0, 1, 2].map(k => paintG(TR(tube([V3(0, 0, 0), V3(0, -0.025, 0.01), V3(0, -0.045, 0)], 0.005, 0.001, 8, 5), (k - 1) * 0.012, -0.265, 0.02), c => c.set('#d8c8a8')))], CLOTH));
    return sh;
  };
  const RA = arm(-1), LA = arm(1);
  // cajado: madeira retorcida, crânio de carneiro, velas acesas e um anel de runas flutuando
  const staff = new THREE.Group(); staff.position.set(0, -0.26, 0.02); RA.add(staff);
  staff.add(fuse([paintG(tube([V3(0, -0.28, 0), V3(0.01, -0.1, 0.005), V3(-0.008, 0.1, 0), V3(0.005, 0.32, -0.005)], 0.011, 0.008, 30, 8), c => c.set('#3a2a1e')), paintG(TR(organic(0.035, 1, 0.9, 1.2, 0.08, 15), 0, 0.36, 0), c => c.set('#d8ccb0')),
    ...[-1, 1].map(sx => paintG(TR(hornGeo(sx, [[0.02, 0, 0], [0.05, 0.02, -0.02], [0.065, -0.01, -0.045], [0.055, -0.04, -0.03], [0.05, -0.03, 0.0]], 0.01, 6 + sx), 0, 0.375, 0), c => c.set('#bfae8a'))), // chifres de carneiro do crânio
    ...[[-0.03, 0.02], [0.03, -0.01], [0.0, 0.035]].map(([x, z], k) => paintG(TR(new THREE.CylinderGeometry(0.006, 0.007, 0.03 + k * 0.01, 10), x, 0.33 + k * 0.005, z), c => c.set('#e8dcc0')))], BONE));
  const flames = [[-0.03, 0.02, 0.03], [0.03, -0.01, 0.035], [0.0, 0.035, 0.04]].map(([x, z, h]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), ADD('#c890ff', 0.95)); f.scale.set(1, 2.4, 1); f.position.set(x, 0.33 + h / 2 + 0.012, z); staff.add(f); return f; });
  const runeRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.003, 6, 48), ADD('#a85aff', 0.9)); runeRing.position.y = 0.38; staff.add(runeRing);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 18, 12), GLOWM('#e0c0ff')); orb.position.y = 0.38; staff.add(orb);
  staff.rotation.x = -0.25;
  // selo de runas no chão (gira devagar)
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; { const g = sc.getContext('2d'); g.translate(128, 128); g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 3; for (const r of [118, 100, 60]) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); } g.beginPath(); for (let k = 0; k <= 5; k++) { const a = k * 4 * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * 98, Math.sin(a) * 98); } g.stroke(); g.font = 'bold 15px serif'; g.textAlign = 'center'; for (let k = 0; k < 16; k++) { g.save(); g.rotate(k / 16 * Math.PI * 2); g.fillText('ᚱᛟᚦᚨᛗᛞᛊᛇ'[k % 8], 0, -104); g.restore(); } }
  const sigil = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), color: '#9a4aff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); sigil.rotation.x = -Math.PI / 2; sigil.position.y = 0.006; root.add(sigil);
  const motes = new THREE.Group(); body.add(motes); const moteFx = risingMotes(motes, 14, 0.35, 0.9, '#8a3aff', 0.006, 4);
  shadowAll(root); sigil.castShadow = false;
  let lt = 0, at = -9;
  return { root, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; const k = (t - at) / 1.0, sk = k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI);
    body.position.y = Math.sin(t * 1.6) * 0.008 + (moving ? Math.abs(Math.sin(t * 4)) * 0.01 : 0);
    robe.rotation.y = Math.sin(t * 1.1) * 0.04; robe.scale.set(1 + Math.sin(t * 4) * 0.01 * (moving ? 1 : 0), 1, 1);
    torso.rotation.x = 0.32 - sk * 0.2 + Math.sin(t * 1.6) * 0.02; head.rotation.y = Math.sin(t * 0.6) * 0.3 * (1 - sk); head.rotation.x = -0.15 + sk * -0.25;
    RA.rotation.x = -0.95 - sk * 1.1; RA.rotation.z = -0.2; staff.rotation.x = 0.95 - 0.32 + sk * 0.6; // o cajado fica em pé na mão LA.rotation.x = -0.3 - sk * 0.9 + Math.sin(t * 2) * 0.05; LA.rotation.z = 0.35 + sk * 0.3;
    runeRing.rotation.x = t * 1.5; runeRing.rotation.y = t * 0.9; runeRing.scale.setScalar(1 + sk * 0.8); orb.scale.setScalar(1 + Math.sin(t * 5) * 0.15 + sk);
    flames.forEach((f, i) => f.scale.set(1, 2.2 + Math.sin(t * 17 + i * 2) * 0.5, 1));
    sigil.rotation.z = t * 0.25; sigil.material.opacity = 0.45 + Math.sin(t * 2) * 0.1 + sk * 0.4; sigil.scale.setScalar(1 + sk * 0.25);
    moteFx(t);
  } };
}

/* ---------- 3. Vharnyr, o Inverno que Anda (senhor dragão do gelo) ----------
   Dragão de quatro patas com pescoço longo, crista de cristais de gelo na espinha, chifres para trás,
   placas no ventre, asas de membrana azulada semiabertas e sopro de neve no ataque. */
export function frostDragon(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const SK = VCB(0.55, { metalness: 0.1 }), ICE = new THREE.MeshPhysicalMaterial({ color: '#d8f4ff', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.88, emissive: '#7ad0ff', emissiveIntensity: 0.35, clearcoat: 1 });
  const WING = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const scales = (c, x, y, z, ny) => { const n = Math.sin(x * 90 + z * 40) * Math.sin(y * 85 - z * 30); c.set('#7aa2c4').lerp(new THREE.Color('#e4f0f6'), Math.max(0, -ny) * 0.85).lerp(new THREE.Color('#34587a'), Math.max(0, ny) * 0.5).offsetHSL(0, 0, n * 0.05); };
  const S = g => paintG(g, scales);
  // tronco
  const trunk = new THREE.Group(); trunk.position.y = 0.42; body.add(trunk);
  trunk.add(fuse([S(organic(0.18, 1, 0.85, 1.6, 0.04, 2)), S(TR(organic(0.15, 1.05, 0.95, 0.9, 0.04, 3), 0, 0.03, 0.2))], SK));
  // crista de cristais de gelo pela espinha
  const crest = []; for (let k = 0; k < 9; k++) { const h = 0.06 + Math.sin(k / 8 * Math.PI) * 0.06; const g = tube([V3(0, 0, 0), V3(0, h * 0.6, -0.01), V3(0, h, -0.03)], 0.02, 0.001, 8, 6); crest.push(TR(g, 0, 0.15 - Math.abs(k - 4) * 0.004, -0.26 + k * 0.065)); }
  trunk.add(fuse(crest.map(flat('#e8f8ff')), ICE));
  // pescoço e cabeça (cadeia de segmentos que ondula)
  // pescoço: 4 trechos de tubo afinando, com "juntas" do mesmo raio (fica contínuo, sem contas)
  const neckSegs = []; let parent = trunk; const neckBase = new THREE.Group(); neckBase.position.set(0, 0.06, 0.27); neckBase.rotation.x = 0.85; trunk.add(neckBase); parent = neckBase;
  const NR = [0.085, 0.07, 0.06, 0.052, 0.046];
  for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.position.y = k ? 0.1 : 0; parent.add(g); g.add(fuse([S(tube([V3(0, 0, 0), V3(0, 0.05, 0.004), V3(0, 0.1, 0)], NR[k], NR[k + 1], 10, 18)), S(new THREE.SphereGeometry(NR[k + 1], 18, 12).translate(0, 0.1, 0)), paintG(TR(tube([V3(0, 0, 0), V3(0, 0.03, -0.006), V3(0, 0.05, -0.02)], 0.013, 0.001, 6, 5), 0, 0.05, -NR[k] + 0.006), c => c.set('#e8f8ff'))], SK)); neckSegs.push(g); parent = g; }
  parent = neckSegs[3]; const neckTip = new THREE.Group(); neckTip.position.y = 0.1; parent.add(neckTip); parent = neckTip;
  const head = new THREE.Group(); head.position.set(0, 0.02, 0.01); head.rotation.x = -0.2; parent.add(head);
  head.add(fuse([S(organic(0.068, 1.0, 0.82, 1.15, 0.05, 20)), S(tube([V3(0, 0.005, 0.03), V3(0, 0.0, 0.11), V3(0, -0.01, 0.19)], 0.052, 0.02, 14, 16).scale(1, 0.62, 1)), S(tube([V3(0, -0.045, 0.02), V3(0, -0.052, 0.1), V3(0, -0.05, 0.17)], 0.036, 0.014, 12, 14).scale(1, 0.55, 1)),
    ...[-1, 1].map(sx => S(TR(organic(0.022, 1.6, 0.6, 1.2, 0.08, 23 + sx), sx * 0.04, 0.035, 0.05, 0.2, sx * 0.3, 0))), S(tube([V3(0, 0.03, 0.06), V3(0, 0.025, 0.12), V3(0, 0.01, 0.18)], 0.008, 0.003, 10, 6)), // sobrancelhas ósseas e crista do focinho
    ...[-1, 1].map(sx => paintG(TR(hornGeo(sx, [[0.02, 0, 0], [0.035, 0.03, -0.05], [0.05, 0.05, -0.12], [0.06, 0.08, -0.2]], 0.017, 3 + sx), 0, 0.035, -0.03), hornPaint('#4a6a7a', '#e8f4fa', 0.22))),
    ...[-1, 1].map(sx => paintG(TR(hornGeo(sx, [[0.03, 0, 0], [0.06, 0.0, -0.04], [0.08, 0.01, -0.09]], 0.009, 9 + sx), 0, 0.0, -0.03), hornPaint('#4a6a7a', '#e8f4fa', 0.12))),
    ...[-1, 1].map(sx => paintG(TR(tube([V3(0, 0, 0), V3(sx * 0.04, 0.0, -0.04), V3(sx * 0.06, -0.01, -0.09)], 0.012, 0.001, 8, 6), sx * 0.05, -0.02, -0.02), c => c.set('#e8f8ff'))), // franjas da bochecha
    ...[0, 1, 2, 3].map(k => paintG(TR(tube([V3(0, 0, 0), V3(0, -0.01, 0.002), V3(0, -0.018, 0)], 0.004, 0.0005, 5, 5), (k - 1.5) * 0.016, -0.014, 0.14 - Math.abs(k - 1.5) * 0.012), c => c.set('#f4f8ff')))], SK)); // presas
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), GLOWM('#7affff')); e.scale.set(1.6, 0.7, 0.6); e.position.set(sx * 0.047, 0.018, 0.06); e.rotation.y = sx * 0.6; head.add(e); }
  const breath = new THREE.Group(); breath.position.set(0, -0.03, 0.22); head.add(breath);
  const puffs = Array.from({ length: 14 }, (_, k) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), ADD(k % 2 ? '#bfefff' : '#ffffff', 0)); breath.add(p); return p; });
  // rabo longo
  const tailSegs = []; parent = trunk; const tailBase = new THREE.Group(); tailBase.position.set(0, 0.0, -0.24); tailBase.rotation.x = 0.12; trunk.add(tailBase); parent = tailBase;
  const TRr = [0.11, 0.085, 0.065, 0.05, 0.037, 0.026, 0.017];
  for (let k = 0; k < 6; k++) { const g = new THREE.Group(); g.position.z = k ? -0.13 : 0; parent.add(g); g.add(fuse([S(tube([V3(0, 0, 0), V3(0, 0.003, -0.065), V3(0, 0, -0.13)], TRr[k], TRr[k + 1], 10, 18)), S(new THREE.SphereGeometry(TRr[k + 1], 18, 12).translate(0, 0, -0.13)), paintG(TR(tube([V3(0, 0, 0), V3(0, 0.03, -0.01), V3(0, 0.05, -0.035)], 0.016 - k * 0.002, 0.001, 6, 5), 0, TRr[k] - 0.006, -0.06), c => c.set('#e8f8ff'))], SK)); tailSegs.push(g); parent = g; }
  { const tip = new THREE.Group(); tip.position.z = -0.13; parent.add(tip); tip.add(fuse(Array.from({ length: 3 }, (_, k) => paintG(TR(tube([V3(0, 0, 0), V3((k - 1) * 0.02, 0.01, -0.04), V3((k - 1) * 0.04, 0.0, -0.08)], 0.012, 0.001, 8, 6), 0, 0, 0), c => c.set('#e8f8ff'))), ICE)); } // leque de cristais na ponta
  // patas com garras
  const legs = [[-1, 0.18], [1, 0.18], [-1, -0.2], [1, -0.2]].map(([sx, z], i) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.15, 0.02, z); trunk.add(hip);
    const fwd = i < 2 ? 1 : -1, kz = fwd > 0 ? 0.04 : -0.07;
    hip.add(fuse([S(TR(organic(0.085, 0.95, 1.25, 1.15, 0.04, 50 + i), 0, -0.05, 0)), S(tube([V3(0, -0.05, 0), V3(0, -0.15, kz * 0.6), V3(0, -0.24, kz)], 0.07, 0.045, 10, 16)),
      S(tube([V3(0, -0.24, kz), V3(0, -0.31, kz * 0.6), V3(0, -0.38, 0.02)], 0.045, 0.035, 10, 14)), S(new THREE.SphereGeometry(0.045, 14, 10).translate(0, -0.24, kz)),
      S(TR(organic(0.04, 1.3, 0.5, 1.5, 0.03, 58 + i), 0, -0.395, 0.04)),
      ...[0, 1, 2].map(k => paintG(TR(tube([V3(0, 0, 0), V3(0, -0.005, 0.03), V3(0, -0.025, 0.05)], 0.011, 0.001, 8, 6), (k - 1) * 0.026, -0.4, 0.08), c => c.set('#1a2230')))], SK));
    return hip;
  });
  // asas semiabertas
  const wings = [-1, 1].map(sx => { const w = new THREE.Group(); w.position.set(sx * 0.12, 0.12, 0.08); trunk.add(w); const wg = wingGeo(sx, 0.75, 0.5, 0.3, 12 + sx); w.add(fuse([paintG(wg.membrane, (c, x, y) => c.set('#7aa8cf').lerp(new THREE.Color('#d8f0ff'), Math.max(0, 0.25 - y) * 1.5))], WING)); w.add(fuse(wg.bones.map(S), SK)); w.rotation.set(0, sx * 0.45, sx * 0.5); return w; });
  const snow = new THREE.Group(); body.add(snow); const snowFx = risingMotes(snow, 22, 0.7, 1.1, '#e8f8ff', 0.007, 8);
  shadowAll(root); puffs.forEach(p => p.castShadow = false);
  let lt = 0, at = -9, ph = 0;
  return { root, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; ph += dt * (moving ? 4 : 0); const w = moving ? 1 : 0, k = (t - at) / 1.4, sk = k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI);
    legs.forEach((h, i) => { h.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.4 * w; });
    trunk.position.y = 0.42 + Math.sin(t * 1.2) * 0.006 + Math.abs(Math.sin(ph)) * 0.015 * w; trunk.rotation.z = Math.sin(ph) * 0.03 * w;
    trunk.scale.set(1 + Math.sin(t * 1.2) * 0.015, 1 + Math.sin(t * 1.2) * 0.01, 1);
    neckSegs.forEach((g, i) => { g.rotation.x = -0.13 + Math.sin(t * 0.9 - i * 0.5) * 0.04 - sk * 0.12 + (i === 0 ? sk * 0.25 : 0); g.rotation.y = Math.sin(t * 0.5 - i * 0.4) * 0.08 * (1 - sk); });
    head.rotation.x = -0.2 + sk * 0.35; // inclina para soprar
    tailSegs.forEach((g, i) => { g.rotation.y = Math.sin(t * 1.4 - i * 0.6) * (0.08 + i * 0.025) * (moving ? 1.5 : 1); g.rotation.x = i === 0 ? 0.1 : 0.03; });
    wings.forEach((wg, i) => { const sx = i ? 1 : -1; wg.rotation.y = sx * (0.45 + Math.sin(t * 1.1) * 0.08 - sk * 0.3); wg.rotation.z = sx * (0.5 + Math.sin(t * 1.1 + 1) * 0.1 + sk * 0.35); });
    // sopro de neve
    puffs.forEach((p, i) => { const q = ((t - at) * 1.2 - i * 0.05); const on = q > 0.15 && q < 1.3; p.material.opacity = on ? Math.max(0, 0.55 * (1 - (q - 0.15) / 1.15)) : 0; const d = Math.max(0, q - 0.15) * 0.8; p.position.set(Math.sin(i * 2.7) * d * 0.25, -d * 0.4 + Math.cos(i * 1.9) * d * 0.15, d); p.scale.setScalar(0.4 + d * 2.5); });
    snowFx(t);
  } };
}

/* ---------- 4. Selvara, a Rainha Sem Túmulo (rainha morta-viva) ----------
   Flutua: vestido longo e esfarrapado que vira névoa, corpo de ossos à mostra, rosto de caveira com
   olhos de alma, coroa alta de ossos e gemas, cabelos de espírito e almas girando em volta das mãos. */
export function lichQueen(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const BONE = VCB(0.6), GOWN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const boneC = (c, x, y, z, ny) => { c.set('#d8ccb0').lerp(new THREE.Color('#8a7c62'), 0.25 + Math.sin(x * 80 + y * 60) * 0.15 - ny * 0.15); };
  const B = g => paintG(g, boneC);
  // vestido: longo, rasgado, que se desfaz em névoa embaixo
  const gownG = new THREE.CylinderGeometry(0.08, 0.26, 0.62, 54, 14, true), GP = gownG.attributes.position;
  for (let i = 0; i < GP.count; i++) { const x = GP.getX(i), y = GP.getY(i), z = GP.getZ(i), a = Math.atan2(z, x), v = (0.31 - y) / 0.62; let yy = y; if (v > 0.6) yy -= Math.max(0, Math.sin(a * 6 + 2)) * 0.1 * (v - 0.6) * 2.5 + Math.abs(Math.sin(a * 17)) * 0.03 * v; const f = 1 + Math.sin(a * 9 + y * 6) * 0.07 * v; GP.setXYZ(i, x * f, yy, z * f); }
  gownG.translate(0, 0.42, 0); gownG.computeVertexNormals();
  paintG(gownG, (c, x, y, z) => { c.set('#123a3a').lerp(new THREE.Color('#06141a'), 0.3 + Math.sin(Math.atan2(z, x) * 9) * 0.2).lerp(new THREE.Color('#5aa8a0'), Math.max(0, 0.25 - y) * 1.2); });
  const gown = fuse([gownG], GOWN); body.add(gown);
  const mist = new THREE.Group(); mist.position.y = 0.04; body.add(mist); // a barra do vestido vira névoa (manchas suaves, sem bolinhas)
  const mistM = new THREE.SpriteMaterial({ map: trailTex(), color: '#5adcc8', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const mistS = Array.from({ length: 10 }, (_, k) => { const sp = new THREE.Sprite(mistM); sp.userData = { a: k / 10 * Math.PI * 2, ph: k * 0.37 }; mist.add(sp); return sp; });
  const mistFx = t => mistS.forEach(sp => { const u = sp.userData, q = (t * 0.2 + u.ph) % 1; sp.position.set(Math.cos(u.a + t * 0.2) * 0.24, q * 0.25, Math.sin(u.a + t * 0.2) * 0.24); sp.scale.setScalar(0.18 + q * 0.2); });
  // torso de ossos: costelas, coluna, clavículas
  const torso = new THREE.Group(); torso.position.y = 0.74; body.add(torso);
  const ribs = []; for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) ribs.push(B(tube([V3(0, 0, -0.04), V3(sx * 0.055, -0.01, -0.01), V3(sx * 0.06, -0.025, 0.03), V3(sx * 0.02, -0.04, 0.055)], 0.007, 0.004, 12, 6).translate(0, -k * 0.022, 0)));
  torso.add(fuse([...ribs, B(tube([V3(0, -0.16, -0.045), V3(0, -0.05, -0.05), V3(0, 0.06, -0.035)], 0.012, 0.01, 14, 8)), B(TR(organic(0.022, 1, 0.8, 0.8, 0.05, 3), 0, -0.13, 0.03)), ...[-1, 1].map(sx => B(tube([V3(0, 0.02, 0.02), V3(sx * 0.05, 0.03, 0.0), V3(sx * 0.09, 0.025, -0.02)], 0.007, 0.006, 10, 6))),
    paintG(TR(new THREE.CylinderGeometry(0.06, 0.09, 0.12, 30, 3, true), 0, -0.13, -0.005), c => c.set('#0e2a2c'))], BONE)); // corpete
  const soul = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), GLOWM('#9affe8')); soul.position.set(0, -0.06, 0.0); torso.add(soul); // alma presa nas costelas
  // cabeça: caveira com maxilar, olhos de alma, coroa alta de ossos e gemas, cabelo de espírito
  const head = new THREE.Group(); head.position.set(0, 0.115, 0.0); head.scale.setScalar(1.35); torso.add(head);
  const SOCK = '#0a0c0c';
  head.add(fuse([B(TR(organic(0.05, 0.9, 1.0, 1.12, 0.03, 7), 0, 0.014, -0.012)), B(TR(organic(0.038, 1.08, 0.82, 0.72, 0.03, 8), 0, -0.012, 0.02)), // crânio e rosto
    ...[-1, 1].map(sx => B(TR(organic(0.014, 1.4, 0.7, 1.2, 0.05, 9 + sx), sx * 0.032, -0.016, 0.026))), // maçãs do rosto
    B(TR(organic(0.026, 1.15, 0.5, 0.9, 0.04, 12), 0, -0.05, 0.016)), // maxilar
    ...[-1, 1].map(sx => paintG(TR(new THREE.SphereGeometry(0.0135, 14, 10).scale(1.05, 0.9, 0.5), sx * 0.018, 0.0, 0.043, 0, sx * 0.25, sx * -0.2), c => c.set(SOCK))), // órbitas fundas
    paintG(TR(new THREE.ConeGeometry(0.007, 0.014, 3), 0, -0.02, 0.05, Math.PI + 0.3, 0, 0), c => c.set(SOCK)), // cavidade do nariz
    ...Array.from({ length: 8 }, (_, k) => paintG(TR(new THREE.CapsuleGeometry(0.0026, 0.006, 3, 6), (k - 3.5) * 0.0062, -0.035, 0.044 - Math.abs(k - 3.5) * 0.002), c => c.set('#efe6cc'))), // dentes
    ...Array.from({ length: 9 }, (_, k) => { const a = (k / 8 - 0.5) * 2.4; return paintG(TR(tube([V3(0, 0, 0), V3(0, 0.05 + (k % 2) * 0.03, -0.005), V3(0, 0.08 + (k % 2) * 0.05 + (k === 4 ? 0.05 : 0), -0.01)], 0.008, 0.0015, 8, 6), Math.sin(a) * 0.045, 0.045, Math.cos(a) * 0.035 - 0.005, 0, 0, -Math.sin(a) * 0.35), boneC); }),
    paintG(TR(new THREE.TorusGeometry(0.045, 0.006, 8, 30), 0, 0.045, -0.005, Math.PI / 2 - 0.15), c => c.set('#6a5a3a'))], BONE));
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), GLOWM('#c8fff4')); e.position.set(sx * 0.018, 0.0, 0.046); head.add(e); } // pontos de luz no fundo das órbitas
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.01, 2), GLOWM('#5affd0')); gem.position.set(0, 0.06, 0.035); head.add(gem);
  const hair = []; for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.6, g = tube([V3(0, 0, 0), V3(Math.sin(a) * 0.04, -0.1, -0.04), V3(Math.sin(a) * 0.06, -0.22, -0.07), V3(Math.sin(a) * 0.05, -0.33, -0.05)], 0.012, 0.002, 16, 6); const m = new THREE.Mesh(g, ADD('#7affe0', 0.35)); m.position.set(Math.sin(a) * 0.04, 0.03, -0.03 + Math.cos(a) * 0.01); head.add(m); hair.push(m); }
  // braços de osso com mangas rasgadas e almas nas mãos
  const arm = sx => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.09, 0.025, -0.02); torso.add(sh);
    const sleeve = new THREE.CylinderGeometry(0.02, 0.06, 0.18, 24, 4, true), SPp = sleeve.attributes.position; for (let i = 0; i < SPp.count; i++) { const a = Math.atan2(SPp.getZ(i), SPp.getX(i)); if (SPp.getY(i) < -0.08) SPp.setY(i, SPp.getY(i) - Math.max(0, Math.sin(a * 4)) * 0.05); } sleeve.computeVertexNormals(); sleeve.translate(0, -0.09, 0);
    sh.add(fuse([paintG(sleeve, c => c.set('#123a3a'))], GOWN));
    sh.add(fuse([B(tube([V3(0, 0, 0), V3(0, -0.1, 0.01), V3(0, -0.2, 0.03)], 0.008, 0.006, 10, 6)), B(tube([V3(0, -0.2, 0.03), V3(0, -0.27, 0.06), V3(0, -0.32, 0.08)], 0.006, 0.005, 10, 6)),
      ...[0, 1, 2, 3].map(k => B(TR(tube([V3(0, 0, 0), V3(0, -0.02, 0.01), V3(0, -0.035, 0.0)], 0.003, 0.002, 6, 4), (k - 1.5) * 0.01, -0.33, 0.085)))], BONE));
    const orbit = new THREE.Group(); orbit.position.set(0, -0.36, 0.1); sh.add(orbit);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), GLOWM('#b0fff0')); orbit.add(core); const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: trailTex(), color: '#5affd0', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(0.14); orbit.add(halo);
    const wisps = [0, 1, 2].map(k => { const w = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), ADD('#7affe0', 0.9)); orbit.add(w); return w; });
    return { sh, orbit, core, wisps };
  };
  const RA = arm(-1), LA = arm(1);
  // almas que giram em volta dela
  const souls = Array.from({ length: 6 }, (_, k) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), ADD('#8affe8', 0.6)); s.scale.set(1, 1.6, 1); body.add(s); return s; });
  shadowAll(root); hair.forEach(h => h.castShadow = false); souls.forEach(s => s.castShadow = false);
  let lt = 0, at = -9;
  return { root, flying: true, attack() { at = lt; }, animate(t, moving, dt = 1 / 60) {
    lt = t; const k = (t - at) / 1.0, sk = k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI);
    body.position.y = 0.08 + Math.sin(t * 1.3) * 0.025; body.rotation.x = moving ? 0.12 : 0;
    gown.rotation.y = Math.sin(t * 0.9) * 0.08; gown.scale.set(1 + Math.sin(t * 2.1) * 0.02, 1, 1 + Math.cos(t * 1.7) * 0.02);
    torso.rotation.x = -sk * 0.25; head.rotation.y = Math.sin(t * 0.45) * 0.35 * (1 - sk); head.rotation.x = Math.sin(t * 0.7) * 0.06 - sk * 0.15;
    RA.sh.rotation.x = -0.35 - sk * 1.4 + Math.sin(t * 1.3) * 0.08; RA.sh.rotation.z = -0.3 - sk * 0.3; LA.sh.rotation.x = -0.35 - sk * 1.4 + Math.sin(t * 1.3 + 1) * 0.08; LA.sh.rotation.z = 0.3 + sk * 0.3;
    for (const A of [RA, LA]) { A.core.scale.setScalar(1 + Math.sin(t * 6) * 0.2 + sk * 1.2); A.wisps.forEach((w, i) => { const a = t * 3 + i * 2.1; w.position.set(Math.cos(a) * 0.045, Math.sin(a * 1.3) * 0.02, Math.sin(a) * 0.045); }); }
    hair.forEach((h, i) => { h.rotation.x = 0.2 + Math.sin(t * 1.6 + i) * 0.12 + (moving ? 0.35 : 0); h.rotation.z = Math.sin(t * 1.1 + i * 0.7) * 0.1; });
    souls.forEach((s, i) => { const a = t * 0.7 + i / 6 * Math.PI * 2, r = 0.32 + Math.sin(t + i) * 0.04; s.position.set(Math.cos(a) * r, 0.35 + Math.sin(t * 1.5 + i * 1.7) * 0.2, Math.sin(a) * r); s.material.opacity = 0.35 + Math.sin(t * 2 + i) * 0.2; });
    soul.scale.setScalar(1 + Math.sin(t * 3) * 0.2); gem.rotation.y = t;
    mistFx(t);
  } };
}

export function makeCritter(shape, color, boss, variant) {
  switch (shape) {
    case 'blob': return slime(color, boss, variant);
    case 'mushroom': return mushroom(color);
    case 'dummy': return dummy();
    case 'rabbit': return rabbit(color);
    case 'bee': return bee(color);
    case 'wolf': return wolf(color);
    case 'demonking': return demonKing(color);
    case 'goatmage': return goatMage(color);
    case 'frostdragon': return frostDragon(color);
    case 'lichqueen': return lichQueen(color);
    default: return slime(color);
  }
}
