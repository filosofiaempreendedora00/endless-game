/* =========================================================================
   MASCOTES 3D — feitos em código, um visual por estágio de evolução.
   makePet(species, stage) devolve { root, animate(t, moving, dt), attack() }.
   ========================================================================= */
import * as THREE from 'three';

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

/* ---------- Faísca → Labareda → Solaris (raposa de fogo) ---------- */
function fireFox(stage) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = ['#ff8a3d', '#ff6a2a', '#ffb43a'][stage], belly = '#ffe9c8';
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(fur)); torso.scale.set(0.85, 0.8, 1.25); torso.position.y = 0.36; body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(belly)); chest.position.set(0, 0.36, 0.17); chest.scale.set(0.9, 0.9, 0.7); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.28); body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(fur)));
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8), mat(belly)); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.05, 0.22); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), BLACK); nose.position.set(0, -0.04, 0.33); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 4), mat(fur)); ear.position.set(s * 0.12, 0.2, -0.02); ear.rotation.z = -s * 0.25; head.add(ear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), mat('#3a2a2a')); tip.position.set(s * 0.145, 0.3, -0.02); tip.rotation.z = -s * 0.25; head.add(tip);
  }
  eyes(head, 0.03, 0.17, 0.09, 0.045);
  if (stage >= 1) { // juba de brasas
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), glow('#ffcf4a', 0.8)); sp.position.set(Math.cos(a) * 0.17, 0.48 + Math.sin(a) * 0.08, 0.12); sp.rotation.z = a - Math.PI / 2; body.add(sp); }
  }
  // rabos com chama na ponta (1, 2 ou 3)
  const tails = [];
  const nT = stage + 1;
  for (let i = 0; i < nT; i++) {
    const t = new THREE.Group(); t.position.set((i - (nT - 1) / 2) * 0.1, 0.42, -0.32); body.add(t);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), mat(fur)); seg.rotation.x = -0.9; seg.position.set(0, 0.1, -0.12); t.add(seg);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), glow(stage === 2 ? '#fff07a' : '#ff9a2a', 1.6)); flame.position.set(0, 0.32, -0.25); t.add(flame);
    tails.push({ t, flame, phase: i });
  }
  const legs = [[-0.12, 0.18], [0.12, 0.18], [-0.12, -0.16], [0.12, -0.16]].map(([x, z]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.24, z);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 6), mat('#3a2a2a')); l.position.y = -0.12; pv.add(l); body.add(pv); return pv;
  });
  let light = null;
  if (stage === 2) { // asas solares
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), glow('#ffd84a', 0.9)); w.position.set(s * 0.27, 0.55, -0.05); w.rotation.z = s * 1.1; body.add(w); }
    light = new THREE.PointLight('#ffb04a', 1.2, 5); light.position.y = 0.8; root.add(light);
  }
  shadows(root);
  return { root, animate(t, moving) {
    const f = moving ? 14 : 0;
    legs.forEach((lg, i) => { lg.rotation.x = moving ? Math.sin(t * f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7 : 0; });
    body.position.y = moving ? Math.abs(Math.sin(t * f)) * 0.06 : Math.sin(t * 2.5) * 0.015;
    tails.forEach(({ t: tg, flame, phase }) => { tg.rotation.y = Math.sin(t * (moving ? 10 : 3) + phase) * 0.35; flame.scale.setScalar(1 + Math.sin(t * 18 + phase * 2) * 0.15); });
    head.rotation.y = moving ? 0 : Math.sin(t * 0.7) * 0.25;
    if (light) light.intensity = 1.1 + Math.sin(t * 10) * 0.2;
  } };
}

/* ---------- Bolhinha → Maré → Aquária (criatura de água) ---------- */
function waterSprite(stage) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = ['#7ad0ff', '#4ab0ff', '#3a8cff'][stage];
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), mat(skin, { roughness: 0.2, transparent: true, opacity: 0.92 })); b.scale.set(1, 0.92, 1.05); b.position.y = 0.32; body.add(b);
  const bellyM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#e8f8ff', { roughness: 0.3 })); bellyM.position.set(0, 0.27, 0.12); bellyM.scale.set(1, 1, 0.6); body.add(bellyM);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })); shine.position.set(-0.12, 0.5, 0.18); body.add(shine);
  eyes(body, 0.4, 0.26, 0.1, 0.055);
  const fins = [-1, 1].map(s => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(skin)); f.scale.set(0.4, 0.25, 1); f.position.set(s * 0.3, 0.26, 0.02); body.add(f); return f; });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), mat(skin)); tail.rotation.x = -Math.PI / 2 - 0.3; tail.position.set(0, 0.28, -0.32); body.add(tail);
  const tailFin = new THREE.Mesh(new THREE.SphereGeometry(0.12 + stage * 0.04, 8, 6), mat(skin)); tailFin.scale.set(1.4, 0.3, 0.6); tailFin.position.set(0, 0.33, -0.48); body.add(tailFin);
  if (stage >= 1) { const crest = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), mat('#bfe8ff')); crest.position.set(0, 0.64, 0); body.add(crest); }
  const bubbles = [];
  const nb = [1, 3, 5][stage];
  for (let i = 0; i < nb; i++) { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#bfeaff', transparent: true, opacity: 0.55, roughness: 0.1 })); root.add(bb); bubbles.push(bb); }
  if (stage === 2) { // coroa de cristal
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glow('#9ff0ff', 0.9)); c.position.set(Math.cos(a) * 0.12, 0.68, Math.sin(a) * 0.12); c.scale.y = 1.8; body.add(c); }
  }
  shadows(root);
  return { root, animate(t, moving) {
    body.position.y = 0.12 + Math.sin(t * 3) * 0.06; // flutua
    body.rotation.z = Math.sin(t * 2) * 0.06;
    fins.forEach((f, i) => { f.rotation.z = Math.sin(t * (moving ? 12 : 4)) * 0.5 * (i ? 1 : -1); });
    tailFin.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.4;
    bubbles.forEach((bb, i) => { const a = t * 1.5 + i / bubbles.length * Math.PI * 2; bb.position.set(Math.cos(a) * 0.45, 0.6 + Math.sin(t * 2 + i) * 0.12, Math.sin(a) * 0.45); });
  } };
}

/* ---------- Pedrinho → Rochedo → Monolito (tatu de pedra) ---------- */
function rockArmadillo(stage) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const stone = ['#9a8a74', '#8a7a64', '#7a7468'][stage];
  const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), mat(stone)); shell.scale.set(1, 0.75, 1.2); shell.position.y = 0.36; body.add(shell);
  for (let i = 0; i < 5; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 12, Math.PI), mat('#6a5a48')); band.rotation.y = Math.PI / 2; band.position.set(0, 0.36, -0.2 + i * 0.1); band.scale.set(1, 0.8, 1); body.add(band); }
  const head = new THREE.Group(); head.position.set(0, 0.32, 0.38); body.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('#c9b08a')); hm.scale.set(0.9, 0.85, 1.1); head.add(hm);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat('#c9b08a')); ear.position.set(s * 0.1, 0.12, -0.03); ear.scale.set(0.6, 1.2, 0.5); head.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), mat('#5a4a3a')); nose.position.set(0, -0.02, 0.17); head.add(nose);
  eyes(head, 0.04, 0.12, 0.07, 0.035);
  const legs = [[-0.18, 0.2], [0.18, 0.2], [-0.18, -0.2], [0.18, -0.2]].map(([x, z]) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.18, z);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6), mat('#c9b08a')); l.position.y = -0.09; pv.add(l); body.add(pv); return pv;
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), mat(stone)); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.28, -0.48); body.add(tail);
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
  return { root, animate(t, moving) {
    legs.forEach((lg, i) => { lg.rotation.x = moving ? Math.sin(t * 10 + (i % 2 ? Math.PI : 0)) * 0.5 : 0; });
    body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.03 : 0;
    head.rotation.y = moving ? 0 : Math.sin(t * 0.8) * 0.3;
    tail.rotation.y = Math.sin(t * 3) * 0.3;
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
