/* =========================================================================
   MASCOTES 3D — feitos em código, um visual por estágio de evolução.
   makePet(species, stage) devolve { root, animate(t, {speed, turn}, dt) }.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...extra });
const glow = (color, intensity = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
const BLACK = mat('#1e1a2a', { roughness: 0.3 }), WHITE = mat('#ffffff', { roughness: 0.3 });
function eyes(parent, y, z, spread, r) {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), BLACK); e.position.set(s * spread, y, z); parent.add(e);
    const g = new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 6, 6), WHITE); g.position.set(s * spread + r * 0.3, y + r * 0.35, z + r * 0.8); parent.add(g);
  }
}
const shadows = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; } });

/* Todas as animações recebem (t, m, dt) onde m = { speed: 0..1.5 (velocidade relativa),
   turn: velocidade de giro (rad/s) }. A fase do passo acumula com a velocidade, então
   o andar acelera/desacelera suavemente em vez de "ligar e desligar". */
const smooth = (cur, to, dt, k) => cur + (to - cur) * (1 - Math.exp(-dt * k));

/* ---------- Faísca → Labareda → Solaris (raposa de fogo) ---------- */
function fireFox(stage) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = ['#ff8a3d', '#ff6a2a', '#ffb43a'][stage], belly = '#ffe9c8';
  const sm = (c, e = {}) => mat(c, { flatShading: false, ...e });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 12), sm(fur)); torso.rotation.x = Math.PI / 2; torso.scale.set(1, 1, 0.9); torso.position.y = 0.36; body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), sm(belly)); chest.position.set(0, 0.36, 0.2); chest.scale.set(0.9, 1, 0.7); body.add(chest);
  const neck = new THREE.Group(); neck.position.set(0, 0.46, 0.24); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.14, 0.06); neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), sm(fur)); skull.scale.set(1, 0.9, 1); head.add(skull);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 10), sm(belly)); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.05, 0.2); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), BLACK); nose.position.set(0, -0.045, 0.32); head.add(nose);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.11, 0.13, -0.03); ear.rotation.z = -s * 0.25; head.add(ear);
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 6), sm(fur)); e.position.y = 0.1; ear.add(e);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), sm('#3a2a2a')); tip.position.y = 0.19; ear.add(tip);
    ears.push(ear);
  }
  eyes(head, 0.03, 0.15, 0.085, 0.04);
  if (stage >= 1) { // juba de brasas
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 5), glow('#ffcf4a', 0.8)); sp.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.07, -0.02); sp.rotation.z = a - Math.PI / 2; neck.add(sp); }
  }
  // rabos em 3 segmentos que "atrasam" (efeito chicote)
  const tails = [], nT = stage + 1;
  for (let i = 0; i < nT; i++) {
    const base = new THREE.Group(); base.position.set((i - (nT - 1) / 2) * 0.09, 0.42, -0.3); base.rotation.x = -0.7 - (i % 2) * 0.15; body.add(base);
    const segs = []; let parent = base;
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group(); g.position.z = k ? -0.13 : 0; parent.add(g);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075 - k * 0.012, 10, 8), sm(fur)); m.scale.set(1, 1, 1.6); m.position.z = -0.06; g.add(m);
      segs.push(g); parent = g;
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 8), glow(stage === 2 ? '#fff07a' : '#ff9a2a', 1.6)); flame.position.set(0, 0.05, -0.17); flame.rotation.x = -1.2; parent.add(flame);
    tails.push({ segs, flame, phase: i * 0.9 });
  }
  const legs = [[-0.1, 0.17], [0.1, 0.17], [-0.1, -0.15], [0.1, -0.15]].map(([x, z]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.26, z);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8), sm(fur)); up.position.y = -0.07; pv.add(up);
    const paw = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), sm('#3a2a2a')); paw.position.y = -0.19; pv.add(paw);
    body.add(pv); return pv;
  });
  let light = null;
  if (stage === 2) { // asas solares
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), glow('#ffd84a', 0.9)); w.position.set(s * 0.25, 0.55, -0.05); w.rotation.z = s * 1.1; body.add(w); }
    light = vlight('#ffb04a', 1.2, 5); light.position.y = 0.8; root.add(light);
  }
  shadows(root);
  let ph = 0, look = 0;
  return { root, animate(t, m, dt) {
    const s = m.speed, gait = Math.min(1, s * 1.6);
    ph += dt * (4 + s * 10);
    legs.forEach((lg, i) => { lg.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.5 : 0)) * 0.75 * gait; });
    body.position.y = Math.abs(Math.sin(ph)) * 0.05 * gait + Math.sin(t * 2.5) * 0.012 * (1 - gait);
    body.rotation.x = Math.sin(ph * 2) * 0.05 * gait - s * 0.06; // corre inclinada pra frente
    look = smooth(look, gait > 0.2 ? -m.turn * 0.12 : Math.sin(t * 0.7) * 0.3, dt, 5);
    neck.rotation.y = look; neck.rotation.x = Math.sin(ph * 2) * 0.06 * gait;
    ears.forEach((e, i) => { e.rotation.x = -0.35 * gait + Math.sin(t * 3 + i) * 0.05; });
    tails.forEach(({ segs, flame, phase }) => {
      segs.forEach((g, k) => { g.rotation.y = Math.sin(t * (2.5 + s * 5) - k * 0.7 + phase) * (0.18 + k * 0.08) + m.turn * 0.06 * (k + 1); g.rotation.x = 0.15 * gait * (k ? 1 : 0); });
      flame.scale.setScalar(1 + Math.sin(t * 18 + phase * 2) * 0.15);
    });
    if (light) light.intensity = 1.1 + Math.sin(t * 10) * 0.2;
  } };
}

/* ---------- Bolhinha → Maré → Aquária (salamandra d'água, estilo axolote) ---------- */
function waterSprite(stage) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = ['#8fd8ff', '#5ab8ff', '#3f8fff'][stage], gill = ['#ff9ac8', '#ff7ab8', '#c27aff'][stage];
  const SK = mat(skin, { flatShading: false, roughness: 0.25, metalness: 0.05 }), BELLY = mat('#e6f6ff', { flatShading: false, roughness: 0.35 });
  const GILL = mat(gill, { flatShading: false, roughness: 0.4, emissive: gill, emissiveIntensity: 0.15 });
  // coluna: cadeia de segmentos, cada um gira um pouco atrás do anterior → ondulação de nado
  const spine = []; let parent = body;
  const radii = [0.17, 0.165, 0.15, 0.12, 0.09, 0.065, 0.045];
  const start = new THREE.Group(); start.position.set(0, 0.3, 0.12); body.add(start); parent = start;
  radii.forEach((r, i) => {
    const g = new THREE.Group(); g.position.z = i ? -0.13 : 0; parent.add(g);
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), SK); seg.scale.set(1.05, 0.78, 1.25); g.add(seg);
    if (i < 3) { const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 12, 8), BELLY); b.scale.set(1, 0.5, 1.2); b.position.y = -r * 0.42; g.add(b); }
    if (i >= 2) { // barbatana dorsal/caudal translúcida
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), mat('#cdefff', { flatShading: false, transparent: true, opacity: 0.6, roughness: 0.2 }));
      fin.scale.set(0.12, 0.6 + (i - 2) * 0.35, 1.1); fin.position.y = r * 0.6 + 0.03; g.add(fin);
    }
    spine.push(g); parent = g;
  });
  // cabeça larga e achatada, sorriso de axolote
  const head = new THREE.Group(); head.position.set(0, 0.06, 0.2); start.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), SK); skull.scale.set(1.3, 0.8, 1); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), BELLY); jaw.scale.set(1.3, 0.45, 0.9); jaw.position.set(0, -0.07, 0.03); head.add(jaw);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 16, Math.PI * 0.8), BLACK); smile.rotation.set(0.25, 0, Math.PI + Math.PI * 0.1); smile.position.set(0, -0.025, 0.185); head.add(smile);
  eyes(head, 0.045, 0.14, 0.13, 0.04);
  for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#ffb0d0', { flatShading: false })); ch.scale.set(1, 0.6, 0.4); ch.position.set(s * 0.17, -0.02, 0.13); head.add(ch); }
  // brânquias: 3 ramos de cada lado com franjas
  const gills = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); g.position.set(s * 0.21, 0.07 - k * 0.06, -0.05); g.rotation.set(0, s * 0.3, s * (0.9 - k * 0.45)); head.add(g);
    const stalk = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.13 + stage * 0.03, 4, 6), GILL); stalk.position.y = 0.08; g.add(stalk);
    for (let j = 0; j < 4; j++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), GILL); fr.scale.set(0.6, 1.6, 0.6); fr.position.set(s * 0.02, 0.04 + j * 0.035, 0); fr.rotation.z = s * 0.6; g.add(fr); }
    gills.push({ g, s, k, rz: g.rotation.z });
  }
  // 4 perninhas
  const legs = [[0, 1], [0, -1], [2, 1], [2, -1]].map(([seg, s]) => {
    const pv = new THREE.Group(); pv.position.set(s * 0.15, -0.04, 0); spine[seg].add(pv);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.1, 4, 6), SK); l.position.set(s * 0.04, -0.06, 0.02); l.rotation.z = s * 0.7; pv.add(l);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), SK); foot.scale.set(1.2, 0.4, 1.3); foot.position.set(s * 0.09, -0.11, 0.04); pv.add(foot);
    return { pv, s, front: seg === 0 };
  });
  if (stage >= 1) { // manchinhas brilhantes nas costas
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), glow('#bff6ff', 0.6)); d.position.set((i % 2 ? 1 : -1) * 0.06, 0.1, 0); spine[i % 4 + 1].add(d); }
  }
  if (stage === 2) { // coroa de cristal
    for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), glow('#9ff0ff', 0.9)); c.position.set(Math.sin(a) * 0.14, 0.16 + Math.cos(a) * 0.03, -0.02); c.scale.y = 2; head.add(c); }
  }
  const bubbles = [], nb = [2, 3, 5][stage];
  const BM = new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.45, roughness: 0.05 });
  for (let i = 0; i < nb; i++) { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 3) * 0.012, 10, 8), BM); root.add(bb); bubbles.push({ bb, off: i * 1.37 }); }
  shadows(root);
  let ph = 0, swim = 0, look = 0;
  return { root, animate(t, m, dt) {
    const s = m.speed;
    swim = smooth(swim, Math.min(1, s * 1.5), dt, 4);
    ph += dt * (2.2 + s * 9);
    // flutua baixinho; nadando, abaixa e estica o corpo
    body.position.y = 0.1 + Math.sin(t * 2.2) * 0.04 * (1 - swim) + Math.sin(ph * 2) * 0.015 * swim;
    body.rotation.z = -m.turn * 0.1 * swim + Math.sin(t * 1.7) * 0.03; // inclina nas curvas
    body.rotation.x = -0.05 * swim;
    // onda que corre da cabeça até a cauda, mais forte na ponta
    spine.forEach((g, i) => { const amp = (0.08 + i * 0.05) * (0.35 + swim * 0.9); g.rotation.y = Math.sin(ph - i * 0.85) * amp + m.turn * 0.05 * i; g.rotation.x = Math.sin(ph * 0.5 - i * 0.6) * 0.04; });
    look = smooth(look, swim > 0.3 ? -Math.sin(ph) * 0.12 - m.turn * 0.08 : Math.sin(t * 0.6) * 0.35, dt, 4);
    head.rotation.y = look; head.rotation.x = Math.sin(t * 1.3) * 0.06;
    gills.forEach(({ g, s: sd, k, rz }) => { g.rotation.z = rz + sd * (Math.sin(t * 3 + k) * 0.12 + swim * 0.35); }); // brânquias deitam pra trás ao nadar
    legs.forEach(({ pv, s: sd, front }) => { pv.rotation.x = Math.sin(ph + (front ? 0 : Math.PI) + (sd > 0 ? 0 : Math.PI)) * 0.6 * (1 - swim * 0.6); pv.rotation.z = sd * swim * 0.6; }); // nadando, recolhe as patas
    bubbles.forEach(({ bb, off }) => { const k = ((t * 0.35 + off) % 1); bb.position.set(Math.sin(off * 5) * 0.2, 0.35 + k * 0.7, 0.25 + Math.cos(off * 3) * 0.1 - k * swim * 0.4); bb.scale.setScalar(k < 0.85 ? 0.6 + k * 0.6 : (1 - k) * 6); });
  } };
}

/* ---------- Pedrinho → Rochedo → Monolito (tatu de pedra) ---------- */
function rockArmadillo(stage) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const stone = ['#9a8a74', '#8a7a64', '#7a7468'][stage];
  const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), mat(stone)); shell.scale.set(1, 0.75, 1.2); shell.position.y = 0.36; body.add(shell);
  for (let i = 0; i < 5; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 12, Math.PI), mat('#6a5a48')); band.rotation.y = Math.PI / 2; band.position.set(0, 0.36, -0.2 + i * 0.1); band.scale.set(1, 0.8, 1); body.add(band); }
  const head = new THREE.Group(); head.position.set(0, 0.32, 0.38); body.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('#c9b08a', { flatShading: false })); hm.scale.set(0.9, 0.85, 1.1); head.add(hm);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat('#c9b08a')); ear.position.set(s * 0.1, 0.12, -0.03); ear.scale.set(0.6, 1.2, 0.5); head.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), mat('#5a4a3a')); nose.position.set(0, -0.02, 0.17); head.add(nose);
  eyes(head, 0.04, 0.12, 0.07, 0.035);
  const legs = [[-0.18, 0.2], [0.18, 0.2], [-0.18, -0.2], [0.18, -0.2]].map(([x, z]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.18, z);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6), mat('#c9b08a')); l.position.y = -0.09; pv.add(l); body.add(pv); return pv;
  });
  const tailG = new THREE.Group(); tailG.position.set(0, 0.3, -0.4); body.add(tailG);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), mat(stone)); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, -0.03, -0.12); tailG.add(tail);
  let crystal = null;
  if (stage >= 1) { // cristais no casco
    const n = stage === 1 ? 3 : 5;
    for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 + stage * 0.02, 0), glow(stage === 2 ? '#7affd0' : '#9ad0ff', 0.7)); c.position.set((i - (n - 1) / 2) * 0.12, 0.62, (i % 2 ? -0.1 : 0.05)); c.scale.y = 2; body.add(c); }
  }
  if (stage === 2) {
    crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glow('#7affd0', 1.4)); crystal.position.set(0, 0.95, 0); body.add(crystal);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat('#5f9a45')); moss.scale.set(1.6, 0.35, 1.6); moss.position.set(0.08, 0.6, -0.12); body.add(moss);
  }
  shadows(root);
  let ph = 0, look = 0;
  return { root, animate(t, m, dt) {
    const s = m.speed, gait = Math.min(1, s * 1.6);
    ph += dt * (3 + s * 9);
    legs.forEach((lg, i) => { lg.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.55 * gait; });
    body.position.y = Math.abs(Math.sin(ph)) * 0.03 * gait;
    body.rotation.z = Math.sin(ph) * 0.05 * gait - m.turn * 0.05; // gingado pesado
    look = smooth(look, gait > 0.2 ? -m.turn * 0.1 : Math.sin(t * 0.8) * 0.3, dt, 4);
    head.rotation.y = look; head.rotation.x = Math.sin(ph * 2) * 0.05 * gait;
    tailG.rotation.y = Math.sin(t * (2 + s * 4)) * 0.3 + m.turn * 0.1;
    if (crystal) { crystal.rotation.y = t * 1.5; crystal.position.y = 0.95 + Math.sin(t * 2) * 0.05; }
  } };
}

// tamanho de cada estágio (o mascote cresce ao evoluir)
const STAGE_SCALE = [0.75, 1.0, 1.3];
export function makePet(species, stage) {
  const m = species === 'agua' ? waterSprite(stage) : species === 'terra' ? rockArmadillo(stage) : fireFox(stage);
  m.root.scale.setScalar(STAGE_SCALE[stage]);
  const obj = new THREE.Group(); obj.add(m.root);
  return { obj, ...m, height: 0.8 * STAGE_SCALE[stage] };
}
