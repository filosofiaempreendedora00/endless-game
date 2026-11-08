/* =========================================================================
   INTERIORES — salas dentro das casas (entra-se pelo portal na porta).
   Cada sala fica longe do mapa (x ≥ 600), com chão em y = 0.
   Aqui ficam a "casca" da sala (chão, paredes, vigas, janelas) e móveis
   feitos em código; os NPCs e as caixas/barris são colocados no main3d.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { masonry } from './landmarks3d.js';

export const INTERIORS = {
  // salas ficam bem longe do mundo (x ≥ 1300; o mundo vai até 450 e as montanhas do horizonte até ~740)
  estabulo: { name: 'Estábulo do Tomé', x: 1300, z: 0, w: 16, d: 13, h: 5.2, wall: '#b39570', floor: '#8a6a44', beam: '#5a3d24' },
  taverna: { name: 'Taverna Caneca Alegre', x: 1360, z: 0, w: 15, d: 12, h: 4.8, wall: '#c9b48e', floor: '#6e4e30', beam: '#4a3220' },
  catacumbas: { name: 'Catacumbas do Santuário', x: 1500, z: 0, w: 64, d: 64, h: 6, wall: '#4f4a44', floor: '#3a3631', beam: '#2a2622', stone: true, dungeon: true, region: 'Santuário Silente', music: 'catacumbas' },
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
  if (def.stone) { // lajes de pedra (masmorra): uma malha só com cor por vértice
    const fg = new THREE.PlaneGeometry(w, d, Math.round(w / 2), Math.round(d / 2)); fg.rotateX(-Math.PI / 2); const P = fg.attributes.position, col = new Float32Array(P.count * 3), base = new THREE.Color(def.floor), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); c.copy(base).offsetHSL(0, 0, ((Math.floor(x / 2) * 7 + Math.floor(z / 2) * 13) % 5) * 0.012 - 0.024); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    fg.setAttribute('color', new THREE.BufferAttribute(col, 3)); const fm = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); fm.position.y = 0.01; fm.receiveShadow = true; g.add(fm);
  } else g.add(planks(w, d, def.floor));
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
// --- taverna (S-077 a S-081): móveis e comida com detalhe de verdade ---
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const MUG_GLASS = new THREE.MeshStandardMaterial({ color: '#e8f2f0', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
const MUG_BEER = new THREE.MeshStandardMaterial({ color: '#e0a020', roughness: 0.2, emissive: '#a05a00', emissiveIntensity: 0.35 });
// caneca de vidro clara com alça, cerveja dourada e colarinho de espuma
export function mug() {
  const g = new THREE.Group();
  const glass = MUG_GLASS, beer = MUG_BEER;
  const foam = new THREE.MeshStandardMaterial({ color: '#fff7e6', roughness: 0.9 });
  const body = new THREE.Mesh(lathe([[0.001, 0], [0.068, 0], [0.072, 0.01], [0.074, 0.17], [0.076, 0.19], [0.07, 0.19], [0.068, 0.012], [0.001, 0.012]], 28), glass); body.renderOrder = 3; g.add(body);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.064, 0.14, 24), beer); liquid.position.y = 0.083; g.add(liquid);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.069, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), foam); head.scale.y = 0.45; head.position.y = 0.152; g.add(head);
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), foam); drip.scale.set(1, 2.2, 0.6); drip.position.set(0.07, 0.165, 0.02); g.add(drip);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 24, Math.PI * 1.15), glass); handle.position.set(0.085, 0.1, 0); handle.rotation.z = -Math.PI * 0.57; g.add(handle); // alça para puxar
  return g;
}
// pão com cortes na casca, sobre uma tábua, e uma fatia de queijo
function breadBoard() {
  const g = new THREE.Group(), board = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 28), mat('#a0703f')); board.scale.z = 0.7; board.position.y = 0.012; g.add(board);
  const lg = new THREE.SphereGeometry(0.12, 32, 20), P = lg.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const cut = y > 0.04 ? Math.max(0, Math.cos(x * 52)) ** 8 * 0.012 : 0; P.setXYZ(i, x * 1.45, Math.max(-0.02, y * 0.62 - cut), z); }
  lg.computeVertexNormals();
  const col = new Float32Array(P.count * 3), a = new THREE.Color('#b06a28'), b = new THREE.Color('#e3b56c'), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { const x = P.getX(i); c.copy(a).lerp(b, Math.max(0, Math.cos(x / 1.45 * 52)) ** 8 * (P.getY(i) > 0.02 ? 1 : 0)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const loaf = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); loaf.position.y = 0.045; loaf.rotation.y = 0.3; g.add(loaf);
  const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20, 1, false, 0, Math.PI / 3), mat('#f0c64a', { roughness: 0.6 })); cheese.position.set(0.12, 0.05, 0.06); g.add(cheese);
  return g;
}
const turnedLeg = h => lathe([[0.001, 0], [0.065, 0], [0.065, 0.06], [0.045, 0.1], [0.04, h * 0.45], [0.058, h * 0.5], [0.04, h * 0.55], [0.042, h - 0.08], [0.06, h - 0.04], [0.06, h], [0.001, h]], 16);
export function table(len = 2.2) {
  const g = new THREE.Group(), W = mat('#7a5232'), W2 = mat('#6a4628');
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.32, 4, 1, 1), k === 1 ? W2 : W); p.position.set(0, 0.86, -0.34 + k * 0.34); g.add(p); } // tampo de 3 tábuas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(turnedLeg(0.82), W2); l.position.set(sx * (len / 2 - 0.18), 0, sz * 0.36); g.add(l); }
  for (const sx of [-1, 1]) g.add(box(0.06, 0.08, 0.72, W2, sx * (len / 2 - 0.18), 0.2, 0)); g.add(box(len - 0.36, 0.07, 0.06, W2, 0, 0.2, 0)); // travessas
  for (let i = 0; i < 3; i++) { const m = mug(); m.position.set(-len / 3 + i * len / 3 + (i - 1) * 0.08, 0.9, i % 2 ? 0.22 : -0.24); m.rotation.y = i * 2.1; g.add(m); }
  const bb = breadBoard(); bb.position.set(0.12, 0.9, 0.02); g.add(bb);
  const candle = new THREE.Group(); candle.position.set(-0.3, 0.9, 0.05); g.add(candle);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 16), mat('#efe6d0')); wax.position.y = 0.07; candle.add(wax);
  const wick = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 12), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); wick.position.y = 0.17; candle.add(wick);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function bench(len = 2.2) {
  const g = new THREE.Group(), W = mat('#6a4628'), W2 = mat('#5a3a20');
  for (let k = 0; k < 2; k++) g.add(box(len, 0.06, 0.19, k ? W : W2, 0, 0.47, -0.1 + k * 0.2));
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(turnedLeg(0.44), W2); l.position.set(sx * (len / 2 - 0.18), 0, 0); g.add(l); }
  g.add(box(len - 0.36, 0.05, 0.05, W2, 0, 0.15, 0));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// balcão mais baixo (dá para ver o rosto de quem atende), com painéis, tampo com borda e garrafas de verdade
export function counter(len = 5) {
  const g = new THREE.Group(), W = mat('#5e3e24'), T = mat('#8a6040'), P = mat('#6e4a2c');
  g.add(box(len, 0.88, 0.7, W, 0, 0.44, 0)); g.add(box(len + 0.2, 0.08, 0.9, T, 0, 0.92, 0));
  for (let k = 0; k < Math.floor(len / 0.9); k++) g.add(box(0.7, 0.55, 0.03, P, -len / 2 + 0.5 + k * 0.9, 0.46, 0.36)); // painéis da frente
  g.add(box(len, 0.06, 0.06, mat('#c9a15a', { metalness: 0.6, roughness: 0.35 }), 0, 0.12, 0.42)); // apoio de pé de latão
  const glassC = ['#2f6b3a', '#6a2a1e', '#c9a15a', '#2f3f6a', '#7a5a2a'];
  for (let i = 0; i < 5; i++) {
    const bt = new THREE.Mesh(lathe([[0.001, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.2], [0.03, 0.26], [0.018, 0.3], [0.018, 0.34], [0.001, 0.34]], 20), new THREE.MeshPhysicalMaterial({ color: glassC[i], roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1 }));
    bt.position.set(-len / 2 + 0.5 + i * 0.32, 0.96, -0.2); g.add(bt);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.04, 10), mat('#b08a5a')); cork.position.set(bt.position.x, 1.32, -0.2); g.add(cork);
  }
  for (let i = 0; i < 2; i++) { const m = mug(); m.position.set(len / 2 - 0.6 - i * 0.3, 0.96, 0.15); g.add(m); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// lareira de pedra (S-080): alvenaria irregular, arco, cornija de madeira, toras e chama em camadas com faíscas
export function fireplace() {
  const g = new THREE.Group();
  const front = masonry({ w: 2.6, h: 2.0, d: 0.9, seed: 31, base: '#8a847a', hole: { x: 0, w: 1.3, h: 1.15 }, rowH: 0.28 }); g.add(front);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 0.2), mat('#1e1712')); back.position.set(0, 0.57, -0.3); g.add(back);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.8), mat('#2a221c')); floor.position.set(0, 0.03, 0); g.add(floor);
  const chimney = masonry({ w: 1.5, h: 2.6, d: 0.7, seed: 37, base: '#857f75', rowH: 0.3 }); chimney.position.set(0, 2.0, -0.1); g.add(chimney);
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 0.5, 6, 1, 1), mat('#5a3a20')); mantel.position.set(0, 2.06, 0.1); g.add(mantel);
  for (const [x, c] of [[-0.9, '#efe6d0'], [0.95, '#efe6d0']]) { const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 14), mat(c)); cd.position.set(x, 2.23, 0.15); g.add(cd); }
  const jar = new THREE.Mesh(lathe([[0.001, 0], [0.08, 0], [0.11, 0.08], [0.09, 0.18], [0.05, 0.22], [0.06, 0.25], [0.001, 0.25]], 20), mat('#a85a3a', { roughness: 0.6 })); jar.position.set(0.4, 2.14, 0.12); g.add(jar);
  // toras com casca e brasas
  const logM = mat('#4a3220'), cutM = mat('#c9a674');
  for (const [x, z, ry, rz] of [[-0.15, 0.05, 0.3, 0.12], [0.18, 0.08, -0.4, -0.1], [0, -0.08, 1.4, 0.0]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.85, 14), logM); l.rotation.set(0, ry, Math.PI / 2 + rz); l.position.set(x, 0.14, z); g.add(l); }
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5a1a', transparent: true, opacity: 0.55 })); ember.scale.set(1.2, 0.25, 0.8); ember.position.set(0, 0.06, 0.02); g.add(ember);
  // chama: cones alongados em 3 camadas (vermelho, laranja, amarelo) que tremulam, e faíscas subindo
  const fire = new THREE.Group(); fire.position.set(0, 0.18, 0.02); g.add(fire);
  const layers = [['#ff4a12', 0.2, 0.75, 0.85], ['#ff8a2a', 0.15, 0.6, 0.9], ['#ffd27a', 0.09, 0.42, 0.95]];
  const flames = [];
  for (const [col, r, h, op] of layers) for (let k = 0; k < 4; k++) { const fg = new THREE.ConeGeometry(r, h, 16, 4, true); fg.translate(0, h / 2, 0); const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); f.position.set((k - 1.5) * 0.14, 0, (k % 2) * 0.06 - 0.03); f.userData.ph = k * 1.7 + r * 10; fire.add(f); flames.push(f); }
  const sparks = []; for (let k = 0; k < 10; k++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffcf6a' })); sp.userData.ph = k / 10; fire.add(sp); sparks.push(sp); }
  const light = vlight('#ff9a4a', 8, 9, 1.5); light.position.set(0, 0.8, 0.9); g.add(light);
  g.userData.update = t => {
    for (const f of flames) { const p = f.userData.ph; f.scale.set(1 + Math.sin(t * 7 + p) * 0.12, 0.8 + Math.sin(t * 9.3 + p * 1.3) * 0.22 + Math.sin(t * 15 + p) * 0.08, 1); f.rotation.z = Math.sin(t * 5 + p) * 0.08; }
    for (const sp of sparks) { const q = (t * 0.7 + sp.userData.ph) % 1; sp.position.set(Math.sin(sp.userData.ph * 40 + t * 2) * 0.25 * q, 0.2 + q * 1.0, Math.cos(sp.userData.ph * 30) * 0.1); sp.scale.setScalar(1 - q); }
    ember.material.opacity = 0.45 + Math.sin(t * 5) * 0.1;
    light.intensity = 7 + Math.sin(t * 11) * 1.2 + Math.sin(t * 17) * 0.6;
  };
  g.traverse(o => { if (o.isMesh && o.material.blending !== THREE.AdditiveBlending && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
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

/* ---------- portal: redemoinho de energia com ondas na base e partículas que sobem e evaporam ---------- */
export function makePortal(color = '#7fd4ff') {
  const g = new THREE.Group(), c = new THREE.Color(color), uT = { value: 0 };
  // redemoinho no chão (espiral animada no shader, borda que se desfaz)
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.05, 64), new THREE.ShaderMaterial({
    uniforms: { uT, uC: { value: c } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vUv;
      void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
        float arms = sin(a * 3.0 + r * 9.0 - uT * 3.2) * 0.5 + 0.5, wob = sin(a * 7.0 - r * 14.0 + uT * 2.1) * 0.5 + 0.5;
        float core = smoothstep(0.55, 0.0, r), edge = smoothstep(1.0, 0.55, r) * smoothstep(0.0, 0.25, r);
        float k = edge * (0.25 + arms * 0.55 + wob * 0.2) + core * 0.55;
        gl_FragColor = vec4(mix(uC, vec3(1.0), core * 0.6 + arms * 0.15) * k, k); }` }));
  swirl.rotation.x = -Math.PI / 2; swirl.position.y = 0.04; g.add(swirl);
  // ondas que nascem embaixo e se espalham
  const waves = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.05 + i * 0.005; g.add(m); return m; });
  // névoa de luz subindo (coluna que some no alto)
  const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 2.8, 32, 1, true), new THREE.ShaderMaterial({
    uniforms: { uT, uC: { value: c } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vUv;
      void main(){ float streak = sin(vUv.x * 40.0 + vUv.y * 6.0 - uT * 2.5) * 0.5 + 0.5; streak *= sin(vUv.x * 17.0 - uT * 1.3) * 0.5 + 0.5;
        float fade = pow(1.0 - vUv.y, 2.2) * smoothstep(0.0, 0.08, vUv.y); float a = fade * (0.1 + streak * 0.25);
        gl_FragColor = vec4(uC * a * 1.6, a); }` }));
  veil.position.y = 1.4; g.add(veil);
  // partículas fluidas: sobem em espiral, se afastam e evaporam
  const N = 90, seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seeds[i * 3] = Math.random(); seeds[i * 3 + 1] = Math.random(); seeds[i * 3 + 2] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const pts = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: { uT, uC: { value: c } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT; attribute vec3 aSeed; varying float vA;
      void main(){ float life = fract(uT * (0.18 + aSeed.y * 0.22) + aSeed.x);
        float ang = aSeed.z * 6.2832 + life * (2.5 + aSeed.y * 3.0) + uT * 0.3;
        float rad = 0.25 + aSeed.y * 0.7 + life * life * 0.55;
        vec3 p = vec3(cos(ang) * rad, life * (2.2 + aSeed.x * 1.4), sin(ang) * rad);
        p.x += sin(uT * 1.7 + aSeed.z * 9.0) * 0.08 * life;
        vA = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (9.0 + aSeed.x * 10.0) * (1.0 - life * 0.6) * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(mix(uC, vec3(1.0), 0.45) * a, a); }` }));
  pts.frustumCulled = false; g.add(pts);
  const light = vlight(c, 2.5, 5, 1.6); light.position.y = 1; g.add(light);
  g.userData.update = t => {
    uT.value = t;
    waves.forEach((w, i) => { const k = (t * 0.45 + i / 3) % 1; w.scale.setScalar(0.25 + k * 1.35); w.material.opacity = Math.sin(k * Math.PI) * 0.55 * (1 - k * 0.4); });
    light.intensity = 2.2 + Math.sin(t * 2.3) * 0.5;
  };
  return g;
}

/* ---------- alvo de treino redondo (palha com anéis coloridos, tripé de madeira) ---------- */
export function makeTarget() {
  const g = new THREE.Group(), W = mat('#7a5432'), WD = mat('#5e3e22');
  const leg = (x, z, rx, rz) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.75, 16), W); l.position.set(x, 0.85, z); l.rotation.set(rx, 0, rz); g.add(l); };
  leg(-0.42, 0.1, 0.05, 0.22); leg(0.42, 0.1, 0.05, -0.22); leg(0, -0.42, -0.35, 0);
  const face = new THREE.Group(); face.position.set(0, 1.15, 0.16); face.rotation.x = -0.12; g.add(face);
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 48, 1), mat('#d9b866', { roughness: 1 })); straw.rotation.x = Math.PI / 2; face.add(straw);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 10, 48), mat('#8a6a3a')); face.add(band);
  const rings = [[0.58, '#f4efe4'], [0.47, '#2a2a2e'], [0.36, '#2f6fd0'], [0.25, '#d63a2a'], [0.13, '#f2c43a']];
  rings.forEach(([r, c], i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 48), mat(c, { roughness: 0.75 })); d.rotation.x = Math.PI / 2; d.position.z = 0.1 + i * 0.004; face.add(d); });
  for (const [x, y, a] of [[0.12, 0.08, 0.2], [-0.2, -0.15, -0.3], [0.05, -0.3, 0.1]]) { // flechas cravadas
    const ar = new THREE.Group(); ar.position.set(x, y, 0.13); ar.rotation.set(a * 0.3, a, 0); face.add(ar);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 16), WD); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.25; ar.add(shaft);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), new THREE.MeshStandardMaterial({ color: '#e8e2d0', side: THREE.DoubleSide })); f.position.z = 0.47; f.rotation.set(Math.PI / 2, 0, k * 2.09); ar.add(f); }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ---------- barraca de frutas (feira da vila) ---------- */
export function makeFruitStand(seed = 7) {
  let a = seed; const rnd = () => ((a = (a * 16807 + 3) % 2147483647) / 2147483647);
  const g = new THREE.Group(), W = mat('#7a5432'), WL = mat('#9a6e42'), DARK = mat('#4e3420');
  // mesa comprida com toalha e caixotes inclinados
  g.add(box(3.6, 0.08, 1.1, WL, 0, 0.82, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.09, 0.82, 0.09, DARK, sx * 1.7, 0.41, sz * 0.46));
  const cloth = box(3.7, 0.3, 0.02, mat('#c8423a'), 0, 0.72, 0.56); g.add(cloth);
  for (let i = 0; i < 9; i++) g.add(box(0.2, 0.3, 0.025, mat('#f1e7d2'), -1.6 + i * 0.4, 0.72, 0.565));
  const S = (r, c, ws = 12, hs = 9) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat(c, { roughness: 0.45 })); return m; };
  const fruits = {
    maca: (x, y, z) => { const f = new THREE.Group(); const b = S(0.065, rnd() < 0.7 ? '#c92a26' : '#8fc23a'); b.scale.set(1, 0.92, 1); f.add(b); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.04, 16), DARK); st.position.y = 0.065; f.add(st); const lf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 14), mat('#4f8a34')); lf.scale.set(1.6, 0.25, 0.8); lf.position.set(0.02, 0.075, 0); f.add(lf); f.position.set(x, y, z); return f; },
    laranja: (x, y, z) => { const f = S(0.07, '#f08a1c'); f.material.roughness = 0.8; f.position.set(x, y, z); return f; },
    pera: (x, y, z) => { const f = new THREE.Group(), c = rnd() < 0.5 ? '#c9c64a' : '#9fbf45'; const lo = S(0.06, c); lo.scale.set(1, 0.95, 1); f.add(lo); const hi = S(0.038, c); hi.position.y = 0.065; f.add(hi); const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 0.05, 16), mat(c, { roughness: 0.45 })); nk.position.y = 0.035; f.add(nk); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.04, 16), DARK); st.position.y = 0.11; st.rotation.z = 0.3; f.add(st); f.position.set(x, y, z); f.rotation.z = (rnd() - 0.5) * 0.8; return f; },
    uva: (x, y, z) => { const f = new THREE.Group(); const c = rnd() < 0.6 ? '#5a2a6a' : '#9ac04a'; for (let i = 0; i < 18; i++) { const row = Math.floor(i / 5), ang = i * 2.3; const b = S(0.022, c, 8, 6); b.position.set(Math.cos(ang) * (0.05 - row * 0.012), -row * 0.03, Math.sin(ang) * (0.05 - row * 0.012)); f.add(b); } const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 16), mat('#6a5030')); st.position.y = 0.035; f.add(st); f.position.set(x, y + 0.05, z); f.rotation.x = 1.2; return f; },
    banana: (x, y, z) => { const f = new THREE.Group(); for (let i = 0; i < 5; i++) { const pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push(new THREE.Vector3(Math.sin(u * 1.4) * 0.12, Math.cos(u * 1.4) * 0.12 - 0.12, 0)); } const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 6), mat('#f2d23a', { roughness: 0.6 })); tube.rotation.y = (i - 2) * 0.22; tube.position.y = i * 0.004; f.add(tube); } f.position.set(x, y + 0.02, z); f.rotation.z = Math.PI / 2; return f; },
    melancia: (x, y, z) => { const f = S(0.17, '#2f6a2a', 16, 12); f.scale.set(1, 0.88, 1.25); f.position.set(x, y + 0.08, z); return f; },
  };
  // caixotes com frutas empilhadas
  const crates = [['maca', -1.35], ['laranja', -0.7], ['pera', -0.05], ['uva', 0.6], ['banana', 1.25]];
  for (const [kind, cx] of crates) {
    const c = new THREE.Group(); c.position.set(cx, 0.86, 0.02); c.rotation.x = -0.22; g.add(c);
    c.add(box(0.6, 0.05, 0.62, W, 0, 0.02, 0)); for (const sz of [-1, 1]) c.add(box(0.6, 0.14, 0.04, W, 0, 0.09, sz * 0.31)); for (const sx of [-1, 1]) c.add(box(0.04, 0.14, 0.62, W, sx * 0.3, 0.09, 0));
    const n = kind === 'uva' ? 5 : kind === 'banana' ? 3 : 14;
    for (let i = 0; i < n; i++) {
      const fx = (rnd() - 0.5) * 0.44, fz = (rnd() - 0.5) * 0.46, fy = 0.11 + (i > 9 ? 0.09 : 0) + rnd() * 0.03;
      const f = fruits[kind](fx, fy, fz); f.rotation.y = rnd() * 6.28; c.add(f);
    }
  }
  // melancias no chão, uma cortada ao meio
  for (const [x, z] of [[-1.9, 0.75], [-1.55, 0.95], [1.95, 0.8]]) g.add(fruits.melancia(x, 0.05, z));
  const half = new THREE.Group(); half.position.set(1.6, 0.17, 0.98); half.rotation.set(-1.25, 0.4, 0); g.add(half);
  const rind = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2f6a2a', { side: THREE.DoubleSide })); rind.scale.set(1, 0.9, 1); half.add(rind);
  const flesh = new THREE.Mesh(new THREE.CircleGeometry(0.155, 24), mat('#e8405a', { roughness: 0.7 })); flesh.rotation.x = Math.PI / 2; half.add(flesh);
  for (let i = 0; i < 10; i++) { const sd = new THREE.Mesh(new THREE.SphereGeometry(0.008, 20, 14), mat('#1a1414')); const an = rnd() * 6.28, rr = 0.04 + rnd() * 0.08; sd.position.set(Math.cos(an) * rr, -0.002, Math.sin(an) * rr); half.add(sd); }
  // placa
  const sign = box(0.9, 0.32, 0.04, mat('#e9dcc0'), 0, 1.55, -0.45); g.add(sign); g.add(box(0.05, 0.75, 0.05, DARK, -0.42, 1.2, -0.45)); g.add(box(0.05, 0.75, 0.05, DARK, 0.42, 1.2, -0.45));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
