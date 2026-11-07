/* =========================================================================
   INTERIORES — salas dentro das casas (entra-se pelo portal na porta).
   Cada sala fica longe do mapa (x ≥ 600), com chão em y = 0.
   Aqui ficam a "casca" da sala (chão, paredes, vigas, janelas) e móveis
   feitos em código; os NPCs e as caixas/barris são colocados no main3d.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';

export const INTERIORS = {
  estabulo: { name: 'Estábulo do Tomé', x: 600, z: 0, w: 16, d: 13, h: 5.2, wall: '#b39570', floor: '#8a6a44', beam: '#5a3d24' },
  taverna: { name: 'Taverna Caneca Alegre', x: 660, z: 0, w: 15, d: 12, h: 4.8, wall: '#c9b48e', floor: '#6e4e30', beam: '#4a3220' },
};

const mat = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...e });
const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };

// tábuas do chão com tons variados
function planks(w, d, color) {
  const g = new THREE.Group(), base = new THREE.Color(color);
  const n = Math.ceil(w / 0.5);
  for (let i = 0; i < n; i++) {
    const c = base.clone().offsetHSL(0, 0, ((i * 37) % 7 - 3) * 0.015);
    const p = box(0.49, 0.1, d, mat(c), -w / 2 + 0.25 + i * 0.5, -0.05, 0); p.castShadow = false; g.add(p);
  }
  return g;
}

// sala: chão, 4 paredes finas (a câmera bate nelas), vigas, teto e janelas com luz do dia
export function buildRoomShell(def) {
  const { w, d, h } = def, g = new THREE.Group(), walls = [];
  g.add(planks(w, d, def.floor));
  const WM = mat(def.wall), BM = mat(def.beam);
  const wallN = box(w, h, 0.3, WM, 0, h / 2, -d / 2), wallW = box(0.3, h, d, WM, -w / 2, h / 2, 0), wallE = box(0.3, h, d, WM, w / 2, h / 2, 0);
  // parede sul com o vão da porta no meio
  const dw = 2.4, side = (w - dw) / 2;
  const wallS1 = box(side, h, 0.3, WM, -w / 2 + side / 2, h / 2, d / 2), wallS2 = box(side, h, 0.3, WM, w / 2 - side / 2, h / 2, d / 2), lintel = box(dw, h - 2.8, 0.3, WM, 0, 2.8 + (h - 2.8) / 2, d / 2);
  for (const m of [wallN, wallW, wallE, wallS1, wallS2, lintel]) { g.add(m); walls.push(m); }
  // rodapé e vigas de madeira (enxaimel)
  for (const [x, z, ww, dd] of [[0, -d / 2 + 0.17, w, 0.06], [-w / 2 + 0.17, 0, 0.06, d], [w / 2 - 0.17, 0, 0.06, d]]) g.add(box(ww, 0.35, dd, BM, x, 0.17, z));
  for (let i = 0; i <= 4; i++) { const x = -w / 2 + 0.2 + i * (w - 0.4) / 4; g.add(box(0.25, h, 0.12, BM, x, h / 2, -d / 2 + 0.2)); }
  for (let i = 0; i <= 3; i++) { const z = -d / 2 + 0.2 + i * (d - 0.4) / 3; g.add(box(0.12, h, 0.25, BM, -w / 2 + 0.2, h / 2, z)); g.add(box(0.12, h, 0.25, BM, w / 2 - 0.2, h / 2, z)); }
  // teto e vigas do teto
  const ceil = box(w, 0.2, d, mat('#4e3826'), 0, h + 0.1, 0); g.add(ceil); walls.push(ceil);
  for (let i = 0; i < 5; i++) g.add(box(0.28, 0.32, d, BM, -w / 2 + (i + 0.5) * w / 5, h - 0.16, 0));
  // janelas (vidro iluminado) nas paredes leste e oeste
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ff', emissive: '#bfe0ff', emissiveIntensity: 0.9, roughness: 0.2 });
  for (const sx of [-1, 1]) for (const z of [-d / 4, d / 4]) {
    const win = box(0.08, 1.3, 1.1, glass, sx * (w / 2 - 0.17), 2.4, z); win.castShadow = false; g.add(win);
    g.add(box(0.12, 0.1, 1.3, BM, sx * (w / 2 - 0.2), 3.1, z)); g.add(box(0.12, 0.1, 1.3, BM, sx * (w / 2 - 0.2), 1.7, z)); g.add(box(0.12, 1.3, 0.08, BM, sx * (w / 2 - 0.2), 2.4, z));
    if (z > 0) { const sunbeam = vlight('#fff2d8', 6, 9, 1.6); sunbeam.position.set(sx * (w / 2 - 1.2), 2.6, 0); g.add(sunbeam); } // uma luz por janela-par
  }
  // batente da porta e um tapete na entrada
  g.add(box(0.25, 2.9, 0.4, BM, -dw / 2 - 0.12, 1.45, d / 2)); g.add(box(0.25, 2.9, 0.4, BM, dw / 2 + 0.12, 1.45, d / 2)); g.add(box(dw + 0.5, 0.25, 0.4, BM, 0, 2.9, d / 2));
  const rug = box(2.6, 0.03, 1.8, mat('#8a2f2a'), 0, 0.02, d / 2 - 1.6); rug.castShadow = false; g.add(rug);
  // fora da porta: claridade (dá a sensação de dia lá fora)
  const out = new THREE.Mesh(new THREE.PlaneGeometry(dw, 2.8), new THREE.MeshBasicMaterial({ color: '#e9f4ff' })); out.position.set(0, 1.4, d / 2 + 0.2); out.rotation.y = Math.PI; g.add(out);
  const amb = vlight('#ffe2b8', 10, Math.max(w, d) * 1.2, 1.4); amb.position.set(0, h - 0.6, 0); g.add(amb);
  g.position.set(def.x, 0, def.z);
  return { group: g, walls };
}

/* ---------- móveis ---------- */
export function table(len = 2.2) {
  const g = new THREE.Group(), W = mat('#7a5232');
  g.add(box(len, 0.12, 1.0, W, 0, 0.85, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.12, 0.85, 0.12, W, sx * (len / 2 - 0.15), 0.42, sz * 0.38));
  // canecas e pão
  const mug = mat('#c9a15a'), foam = mat('#fff8e8');
  for (let i = 0; i < 3; i++) { const x = -len / 3 + i * len / 3; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), mug); m.position.set(x, 1.0, (i % 2 ? 0.2 : -0.2)); g.add(m); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 10), foam); f.position.set(x, 1.09, (i % 2 ? 0.2 : -0.2)); g.add(f); }
  const bread = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat('#c98a3a')); bread.scale.set(1.4, 0.6, 1); bread.position.set(0.1, 0.97, 0); g.add(bread);
  return g;
}
export function bench(len = 2.2) {
  const g = new THREE.Group(), W = mat('#6a4628');
  g.add(box(len, 0.1, 0.4, W, 0, 0.48, 0));
  for (const sx of [-1, 1]) g.add(box(0.1, 0.48, 0.34, W, sx * (len / 2 - 0.15), 0.24, 0));
  return g;
}
export function counter(len = 5) {
  const g = new THREE.Group(), W = mat('#5e3e24'), T = mat('#8a6040');
  g.add(box(len, 1.1, 0.8, W, 0, 0.55, 0)); g.add(box(len + 0.2, 0.1, 1.0, T, 0, 1.15, 0));
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), mat(['#3a7a3a', '#7a2a2a', '#c9a15a', '#3a4a8a'][i], { roughness: 0.3 })); b.position.set(-len / 2 + 0.6 + i * 0.35, 1.35, 0); g.add(b); }
  return g;
}
export function fireplace() {
  const g = new THREE.Group(), S = mat('#7d776d', { flatShading: true }), D = mat('#2a221c');
  g.add(box(2.6, 2.2, 0.9, S, 0, 1.1, 0)); g.add(box(1.5, 1.1, 0.5, D, 0, 0.6, 0.25)); g.add(box(1.4, 3.0, 0.7, S, 0, 3.0, -0.1));
  const fire = new THREE.Group(); fire.position.set(0, 0.25, 0.35); g.add(fire);
  const fm = new THREE.MeshStandardMaterial({ color: '#ff9a3a', emissive: '#ff7a1a', emissiveIntensity: 2, roughness: 0.4 });
  const flames = []; for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), fm); f.position.set((i - 2) * 0.13, 0.22, (i % 2) * 0.08); fire.add(f); flames.push(f); }
  const light = vlight('#ff9a4a', 8, 9, 1.5); light.position.set(0, 0.8, 0.9); g.add(light);
  g.userData.update = t => { flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 1.7) * 0.25; f.scale.x = 1 + Math.sin(t * 7 + i) * 0.1; }); light.intensity = 7 + Math.sin(t * 11) * 1.2 + Math.sin(t * 17) * 0.6; };
  return g;
}
export function hayBale() {
  const g = new THREE.Group(), H = mat('#d8b85a'), B = mat('#a88a3a');
  g.add(box(1.2, 0.6, 0.7, H, 0, 0.3, 0));
  for (const x of [-0.35, 0.35]) g.add(box(0.05, 0.62, 0.72, B, x, 0.3, 0));
  return g;
}
export function stall(w = 3.2, d = 3) { // baia de madeira (cercadinho)
  const g = new THREE.Group(), W = mat('#6e4e30');
  for (const z of [-d / 2, d / 2]) { g.add(box(0.14, 1.3, 0.14, W, -w / 2, 0.65, z)); g.add(box(0.14, 1.3, 0.14, W, w / 2, 0.65, z)); }
  for (const y of [0.5, 1.1]) { g.add(box(0.08, 0.12, d, W, -w / 2, y, 0)); g.add(box(0.08, 0.12, d, W, w / 2, y, 0)); }
  const straw = box(w, 0.05, d, mat('#cfae5a'), 0, 0.03, 0); straw.castShadow = false; g.add(straw);
  return g;
}
export function lantern() {
  const g = new THREE.Group();
  g.add(box(0.04, 0.8, 0.04, mat('#2a2a2a'), 0, 0.4, 0));
  const glassM = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb84a', emissiveIntensity: 1.6 });
  const l = box(0.2, 0.26, 0.2, glassM, 0, -0.1, 0); l.castShadow = false; g.add(l);
  const pl = vlight('#ffc070', 3, 6, 1.6); pl.position.y = -0.2; g.add(pl);
  return g;
}

/* ---------- portal (redemoinho de luz na porta) ---------- */
export function makePortal(color = '#7fd4ff') {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; g.add(disc);
  const ringM = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings = [0.95, 0.65, 0.38].map((r, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 40), ringM); m.rotation.x = -Math.PI / 2; m.position.y = 0.06 + i * 0.02; g.add(m); return m; });
  // coluna de luz suave
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 2.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 1.3; g.add(beam);
  // faíscas em espiral
  const sparkM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = []; for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), sparkM); g.add(s); sparks.push({ s, o: i / 18 }); }
  const light = vlight(c, 2.5, 5, 1.6); light.position.y = 1; g.add(light);
  g.userData.update = t => {
    rings.forEach((r, i) => { r.rotation.z = t * (1.2 + i * 0.7) * (i % 2 ? -1 : 1); r.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.05); });
    disc.material.opacity = 0.28 + Math.sin(t * 3) * 0.08; beam.material.opacity = 0.12 + Math.sin(t * 2.2) * 0.05;
    sparks.forEach(({ s, o }) => { const k = (t * 0.45 + o) % 1, a = o * Math.PI * 2 * 3 + t * 2.5; s.position.set(Math.cos(a) * (0.85 - k * 0.5), k * 2.6, Math.sin(a) * (0.85 - k * 0.5)); s.scale.setScalar(1 - k * 0.7); });
  };
  return g;
}
