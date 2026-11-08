/* =========================================================================
   PORTO DAS GAIVOTAS (S-117/S-175 refeito na rodada 15: S-208 a S-218)
   Cidade de mercadores no litoral, com um cais de pedra reto (a água é igual
   dos dois lados), passeio calçado, mercado de peixe, casas do litoral, docas
   de madeira com botes, um quebra-mar de pedras que leva ao farol na boca do
   porto e o navio mercante "Gaivota Dourada" atracado: dá para subir pela
   prancha, andar no convés e descer pela escotilha até o porão (sala longe do
   mundo, com NPCs). Duas casas têm porta para dentro (taverna e armazém naval).

   Regra de posição dos NPCs (S-217, vale para todas as cidades novas):
   todo NPC fica junto de alguma coisa que explique estar ali (balcão, banca,
   porta, prancha, leme, bote em conserto, mesa) — de costas para a parede ou
   para o objeto e de frente para onde as pessoas chegam; nunca solto no meio
   do nada, nunca olhando para uma parede.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { vlight } from './lights3d.js';
import { heightAt, PORT, SEA, HARBOR, harborXZ, seaDist } from './world3d.js';
import { Kit, M, rngOf, makeBanner, flame, gable, put, DECKS, archBlocks } from './cities3d.js';
import { INTERIORS, buildRoomShell, makePortal } from './interiors3d.js';

const PM = {};
const plain = (key, color, o = {}) => PM[key] || (PM[key] = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1, side: o.side || THREE.FrontSide, vertexColors: !!o.vc, transparent: !!o.transparent, opacity: o.opacity ?? 1 }));
const Q = HARBOR.quay, LAND = HARBOR.land;
const YAW_SEA = Math.atan2(HARBOR.ux, HARBOR.uz), YAW_T = Math.atan2(HARBOR.uz, -HARBOR.ux); // de frente para o mar · ao longo do cais (+t)
const at = (s, t) => harborXZ(s, t);
const gY = (x, z) => heightAt(x, z);

// tablado/rampa (onde dá para andar fora do terreno): retângulo com início em (s,t), indo `len` metros na direção yaw
function deck(x, z, yaw, len, w, y, y1) { DECKS.push({ x, z, yaw, len, w, y, y1: y1 ?? y }); }
// parede invisível de colisão (caixa girada)
function wall(ctx, x, z, rot, hx, hz) { ctx.colliders.push({ x, z, r: Math.max(hx, hz), box: true, hx, hz, rot, name: 'porto' }); }
// parede ao longo do eixo t (cais), de t0 a t1, na distância s
function wallT(ctx, s, t0, t1, th = 0.18) { const c = at(s, (t0 + t1) / 2); wall(ctx, c.x, c.z, YAW_T, th, Math.abs(t1 - t0) / 2); }
// parede ao longo do eixo s (mar adentro), de s0 a s1, na posição lateral t
function wallS(ctx, t, s0, s1, th = 0.18) { const c = at((s0 + s1) / 2, t); wall(ctx, c.x, c.z, YAW_SEA, th, Math.abs(s1 - s0) / 2); }

/* ---------------- peças ---------------- */
// cabeço de amarração de ferro fundido (cogumelo baixo), às vezes com corda enrolada
function bollard(K, x, y, z, rope) {
  K.add(new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.18, 0.06], [0.13, 0.12], [0.11, 0.38], [0.17, 0.46], [0.19, 0.52], [0.14, 0.58], [0, 0.6]].map(([a, b]) => new THREE.Vector2(a, b)), 18), M.iron(), x, y, z);
  if (rope) for (let k = 0; k < 3; k++) K.add(new THREE.TorusGeometry(0.17 + k * 0.012, 0.035, 6, 18), M.rope(), x, y + 0.2 + k * 0.07, z, 0, Math.PI / 2);
}
// peixe de verdade: corpo afinado, cauda bifurcada, barbatanas, olho; cor por vértice (costas escuras, barriga prateada)
const FISH = [{ back: '#4a5e6e', belly: '#e8eef2', len: 0.42 }, { back: '#b8562e', belly: '#f2d2b8', len: 0.36 }, { back: '#5a6a3a', belly: '#d8dcc0', len: 0.5 }, { back: '#7a8ea0', belly: '#f4f6f8', len: 0.3 }];
function fishGeo(kind) {
  const F = FISH[kind % FISH.length], L = F.len, parts = [];
  const body = new THREE.SphereGeometry(1, 18, 10); const P = body.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (z + 1) / 2, taper = 0.25 + 0.75 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.92); P.setXYZ(i, x * 0.07 * L * 2.2 * taper, y * 0.12 * L * 2 * taper, z * L / 2); }
  parts.push(body);
  const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.lineTo(-0.11, -0.13); tail.quadraticCurveTo(-0.06, 0, -0.11, 0.13); tail.closePath();
  const tg = new THREE.ShapeGeometry(tail); tg.scale(L * 2.2, L * 2.2, 1); tg.rotateY(Math.PI / 2); tg.translate(0, 0, -L / 2 + 0.01); parts.push(tg);
  const dor = new THREE.Shape(); dor.moveTo(0, 0); dor.lineTo(0.08, 0.06); dor.lineTo(0.16, 0); dor.closePath(); const dg = new THREE.ShapeGeometry(dor); dg.scale(L * 1.6, L * 1.6, 1); dg.rotateY(-Math.PI / 2); dg.translate(0, 0.11 * L, -0.02); parts.push(dg);
  const cb = new THREE.Color(F.back), cl = new THREE.Color(F.belly), c = new THREE.Color();
  const geos = parts.map(g => { const gg = g.index ? g.toNonIndexed() : g; const PP = gg.attributes.position, col = new Float32Array(PP.count * 3); for (let i = 0; i < PP.count; i++) { const k = THREE.MathUtils.clamp(0.5 + PP.getY(i) / (0.24 * L), 0, 1); c.copy(cl).lerp(cb, k * k); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (gg.attributes.uv) gg.deleteAttribute('uv'); return gg; });
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.018 * L * 2.4, 8, 6).toNonIndexed(); e.translate(s * 0.06 * L, 0.03 * L, L * 0.36); const col = new Float32Array(e.attributes.position.count * 3).fill(0.04); e.setAttribute('color', new THREE.BufferAttribute(col, 3)); e.deleteAttribute('uv'); geos.push(e); }
  return mergeGeometries(geos);
}
const FISHM = () => plain('fishVC', '#ffffff', { vc: true, metal: 0.45, rough: 0.32, side: THREE.DoubleSide });
// gelo picado na bancada
function iceBed(K, w, d, x, y, z, r) {
  K.box(w, 0.06, d, plain('iceSlab', '#d6ecf2', { rough: 0.25 }), x, y, z);
  for (let k = 0; k < Math.round(w * d * 26); k++) K.add(new THREE.DodecahedronGeometry(0.035 + r() * 0.03, 0), plain('iceChip', '#eef8fb', { rough: 0.15, metal: 0.1 }), x + (r() - 0.5) * w * 0.95, y + 0.04, z + (r() - 0.5) * d * 0.9, r() * 6, r() * 6);
}
// barraca do mercado de peixe: bancada inclinada com gelo e peixes arrumados, caixas de peixe, balança, toldo listrado e peixes pendurados
function fishStall(seed) {
  const K = new Kit(), r = rngOf(seed), wd = M.wood(), dk = M.darkWood(), stripe = r() < 0.5 ? '#2e5ea0' : '#b8322a';
  K.box(2.8, 0.85, 1.2, wd, 0, 0.425, 0); K.box(3.0, 0.08, 1.4, dk, 0, 0.88, 0);
  iceBed(K, 2.6, 1.0, 0, 0.95, 0.05, r);
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) { const kind = (row + seed) % 4; K.add(fishGeo(kind), FISHM(), -1.05 + k * 0.42 + (row % 2) * 0.12, 1.03, -0.3 + row * 0.32, Math.PI / 2 + (r() - 0.5) * 0.25, 0, Math.PI / 2); }
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.6, 0.6]) K.box(0.1, 2.5, 0.1, dk, sx, 1.25, sz);
  for (let k = 0; k < 6; k++) K.box(0.5, 0.05, 1.8, plain('awnF' + (k % 2 ? stripe : 'w'), k % 2 ? stripe : '#f2ead6', { rough: 0.9, side: THREE.DoubleSide }), -1.25 + k * 0.5, 2.55, 0.15, 0, -0.2);
  K.cyl(0.02, 0.02, 2.8, dk, 0, 2.3, -0.55, 6, 0, 0, Math.PI / 2); // varal dos peixes pendurados
  for (let k = 0; k < 4; k++) { const x = -1.0 + k * 0.65; K.cyl(0.006, 0.006, 0.25, M.rope(), x, 2.17, -0.55, 4); K.add(fishGeo(k + 1), FISHM(), x, 1.82, -0.55, 0, Math.PI / 2, 0); }
  // caixas de peixe no chão e balança
  for (let k = 0; k < 2; k++) { const bx = -1.9 + k * 3.8; K.box(0.7, 0.32, 0.5, wd, bx, 0.16, 0.9); iceBed(K, 0.6, 0.4, bx, 0.33, 0.9, r); for (let j = 0; j < 3; j++) K.add(fishGeo(j + k), FISHM(), bx - 0.18 + j * 0.18, 0.4, 0.9, 0.2 * j, 0, Math.PI / 2); }
  K.cyl(0.02, 0.02, 0.5, M.iron(), 1.1, 1.18, 0.35, 6); K.add(new THREE.CylinderGeometry(0.16, 0.12, 0.05, 16), M.steel(), 1.1, 1.45, 0.35);
  return K;
}
// casa do litoral: base de pedra, paredes caiadas ou de tábuas pintadas, enxaimel, beiral, chaminé, janelas com moldura,
// floreira e venezianas, porta com batente e degrau, alpendre com corrimão; às vezes um anexo em L
const HOUSE_PAINT = ['#3e6a8a', '#8a3a2e', '#3e7a5a', '#c8a03a', '#5a4a7a'];
function coastHouse(seed, w, d, door = true) {
  const K = new Kit(), r = rngOf(seed), h = 3.3 + r() * 0.6, wd = M.darkWood(), pl = M.plaster(), paint = plain('paint' + seed % 5, HOUSE_PAINT[seed % 5], { rough: 0.8 });
  const tile = r() < 0.6, roof = tile ? M.clay() : M.thatch();
  for (let k = 0; k < Math.ceil(w / 0.9); k++) K.box(0.9, 1.0, d + 0.5, M.greyStone(), -w / 2 + 0.45 + k * 0.9, -0.15, 0, (r() - 0.5) * 0.04); // base de pedras
  K.box(w, h, d, pl, 0, 0.3 + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.26, h + 0.05, 0.26, wd, sx * (w / 2 - 0.02), 0.3 + h / 2, sz * (d / 2 - 0.02)); // cantos
  for (const sz of [-1, 1]) { K.box(w + 0.1, 0.2, 0.22, wd, 0, 0.3 + h, sz * d / 2); K.box(w, 0.16, 0.2, wd, 0, 0.3 + h * 0.48, sz * d / 2); }
  for (const sx of [-1, 1]) K.box(0.2, 0.16, d, wd, sx * w / 2, 0.3 + h * 0.48, 0);
  const rh = 2.0 + r() * 0.6; gable(K, w + 0.15, d + 0.15, rh, roof, 0, 0.3 + h, 0, 0, tile ? 0.55 : 0.75);
  K.box(0.22, 0.22, d + 1.6, wd, 0, 0.3 + h + rh + 0.05, 0); // cumeeira
  for (const sz of [-1, 1]) K.box(w + 1.2, 0.12, 0.18, wd, 0, 0.3 + h - 0.05, sz * (d / 2 + 0.55)); // beiral
  // chaminé de pedra
  const cx = (r() < 0.5 ? -1 : 1) * w * 0.28; K.box(0.75, rh + 1.4, 0.75, M.greyStone(), cx, 0.3 + h + (rh + 1.4) / 2 - 0.4, -d * 0.18); K.box(0.9, 0.18, 0.9, M.greyStone(), cx, 0.3 + h + rh + 0.6, -d * 0.18);
  // fachada (frente = +z): porta com batente e degrau, janelas com moldura, venezianas pintadas e floreira
  const dx = -w * 0.22;
  if (door) { K.box(1.15, 2.15, 0.12, M.wood(), dx, 1.4, d / 2 + 0.06); K.box(1.45, 0.16, 0.2, wd, dx, 2.55, d / 2 + 0.08); for (const s of [-1, 1]) K.box(0.14, 2.3, 0.18, wd, dx + s * 0.66, 1.45, d / 2 + 0.08); K.box(1.5, 0.18, 0.6, M.greyStone(), dx, 0.38, d / 2 + 0.35); K.add(new THREE.TorusGeometry(0.06, 0.012, 6, 12), M.iron(), dx + 0.38, 1.4, d / 2 + 0.14); }
  const winX = [w * 0.22]; if (w > 7) winX.push(w * 0.22 + 1.6);
  for (const wx of winX) for (const wy of [1.9, h > 3.6 ? 3.0 : null].filter(Boolean)) {
    K.box(0.95, 0.85, 0.06, M.glass(), wx, wy, d / 2 + 0.04); K.box(1.15, 0.12, 0.16, wd, wx, wy + 0.48, d / 2 + 0.07); K.box(1.2, 0.1, 0.3, wd, wx, wy - 0.48, d / 2 + 0.12);
    for (const s of [-1, 1]) K.box(0.46, 0.9, 0.05, paint, wx + s * 0.72, wy, d / 2 + 0.1, 0, 0, 0);
    if (wy < 2.5) { K.box(1.0, 0.22, 0.25, wd, wx, wy - 0.62, d / 2 + 0.22); for (let k = 0; k < 6; k++) K.add(new THREE.SphereGeometry(0.07, 8, 6), plain('flw' + (k % 3), ['#e05a7a', '#f2d24a', '#f2f2f2'][k % 3], { rough: 0.9 }), wx - 0.4 + k * 0.16, wy - 0.46, d / 2 + 0.24); }
  }
  // alpendre com corrimão (lado da porta)
  if (door && r() < 0.6) { const pw = 2.6; K.box(pw, 0.12, 1.5, M.wood(), dx, 0.42, d / 2 + 0.75); for (const s of [-1, 1]) { K.box(0.14, 2.4, 0.14, wd, dx + s * pw / 2, 1.6, d / 2 + 1.45); } K.box(pw + 0.3, 0.1, 1.9, roof === M.clay() ? M.clay() : M.wood(), dx, 2.85, d / 2 + 0.8, 0, -0.25); K.box(0.08, 0.08, 1.4, wd, dx + pw / 2, 1.1, d / 2 + 0.75); }
  // anexo em L (casas maiores)
  const box = [[0, 0, w / 2 + 0.2, d / 2 + 0.2]];
  if (w > 7.2 && r() < 0.55) { const aw = 3.2, ad = 3.6, ah = 2.6, ax = w / 2 + aw / 2 - 0.1, az = -d / 2 + ad / 2; box.push([ax, az, aw / 2 + 0.15, ad / 2 + 0.15]); K.box(aw, ah, ad, pl, ax, 0.3 + ah / 2, az); K.box(aw + 0.3, 0.8, ad + 0.3, M.greyStone(), ax, -0.1, az); gable(K, ad, aw, 1.3, roof, ax, 0.3 + ah, az, Math.PI / 2, 0.4); }
  return { K, box };
}
// palmeira: tronco afinado em anéis, folhas de verdade (nervura + folíolos caídos), cocos em cacho
function palmTree(seed) {
  const K = new Kit(), r = rngOf(seed), H = 6.5 + r() * 4, lean = 0.6 + r() * 1.8, dir = r() * 6.28, bark = M.bark();
  const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(Math.cos(dir) * Math.pow(t, 1.7) * lean * 2, t * H, Math.sin(dir) * Math.pow(t, 1.7) * lean * 2)); }
  const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 30, 0.2, 10), P = tube.attributes.position;
  for (let i = 0; i < P.count; i++) { const v = Math.floor(i / 11) / 30, c = curve.getPoint(Math.min(1, v)); const k = (1.35 - v * 0.55) * (1 + 0.08 * Math.sin(v * 140)); P.setXYZ(i, c.x + (P.getX(i) - c.x) * k, P.getY(i), c.z + (P.getZ(i) - c.z) * k); } // afina e marca os anéis
  tube.computeVertexNormals(); K.add(tube, bark);
  const top = curve.getPoint(1), leafA = plain('palmLeafA', '#3f7a2c', { rough: 0.75, side: THREE.DoubleSide }), leafB = plain('palmLeafB', '#5e9a3a', { rough: 0.75, side: THREE.DoubleSide }), rib = plain('palmRib', '#7a6a3a', { rough: 0.9 });
  const nF = 11 + Math.floor(r() * 4);
  for (let f = 0; f < nF; f++) {
    const az = f / nF * Math.PI * 2 + r() * 0.3, len = 3.2 + r() * 1.4, up = 0.45 - r() * 0.5, geos = [], ribPts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12, d = t * len; ribPts.push(new THREE.Vector3(Math.cos(az) * d, top.y + Math.sin(up) * d - Math.pow(t, 2) * len * 0.55, Math.sin(az) * d).add(new THREE.Vector3(top.x, 0, top.z))); }
    const rc = new THREE.CatmullRomCurve3(ribPts); K.add(new THREE.TubeGeometry(rc, 12, 0.025, 4), rib);
    for (let k = 1; k < 20; k++) { const t = k / 20, p = rc.getPoint(t), tg = rc.getTangent(t), side = new THREE.Vector3(-tg.z, 0, tg.x).normalize(), ll = (0.65 + 0.35 * Math.sin(t * Math.PI)) * (0.55 - t * 0.2) * 1.4;
      for (const s of [-1, 1]) { const tip = p.clone().add(side.clone().multiplyScalar(s * ll)).add(new THREE.Vector3(0, -ll * 0.55, 0)).add(tg.clone().multiplyScalar(0.12)); const g = new THREE.BufferGeometry(), a = p.clone().add(tg.clone().multiplyScalar(-0.04)), b = p.clone().add(tg.clone().multiplyScalar(0.05));
        g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, tip.x, tip.y, tip.z], 3)); g.computeVertexNormals(); geos.push(g); } }
    K.add(mergeGeometries(geos), f % 2 ? leafA : leafB);
  }
  for (let k = 0; k < 5; k++) K.add(new THREE.SphereGeometry(0.15, 10, 8), plain('coconut', '#5a3a1e', { rough: 0.8 }), top.x + Math.cos(k * 1.3) * 0.22, top.y - 0.3 - (k % 2) * 0.12, top.z + Math.sin(k * 1.3) * 0.22);
  return K;
}
// bote a remo: casco de tábuas com BANCOS e PISO acima da linha d'água (a água nunca aparece dentro)
function rowboat(len = 5, seed = 1) {
  const K = new Kit(), r = rngOf(seed), W = len * 0.21, H = 0.62, SEG = 16, RS = 9, wd = M.wood(), dk = M.darkWood(), paint = plain('boatPaint' + seed % 3, ['#2e5e8a', '#8a3a2e', '#e8e2d2'][seed % 3], { rough: 0.7 });
  const pos = [], idx = [];
  for (let i = 0; i <= SEG; i++) { const t = i / SEG, z = (t - 0.5) * len, wk = Math.pow(Math.sin(t * Math.PI), 0.6), hk = 1 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.3; for (let j = 0; j <= RS; j++) { const a = j / RS * Math.PI; pos.push(Math.cos(a) * W * wk, H * hk - Math.sin(a) * H * (0.5 + wk * 0.5), z); } }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setIndex(idx); hull.computeVertexNormals();
  const hm = hull.clone(); K.add(hm, paint); const inner = hull.clone(); inner.scale(0.93, 0.95, 0.96); inner.translate(0, 0.03, 0); { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } inner.computeVertexNormals(); } K.add(inner, wd);
  for (let k = -4; k <= 4; k++) K.box(W * 1.5 * Math.pow(Math.cos(k / 5 * Math.PI / 2), 0.6), 0.04, 0.42, dk, 0, 0.12, k * len * 0.1); // piso (tábuas) acima da água
  for (let k = -1; k <= 1; k++) K.box(W * 1.75, 0.07, 0.28, wd, 0, H * 0.72, k * len * 0.24); // bancos
  K.add(new THREE.TorusGeometry(1, 0.035, 6, 32), dk, 0, H * 1.02, 0, 0, Math.PI / 2, 0, W, len * 0.5, 1); // borda
  for (const s of [-1, 1]) K.cyl(0.03, 0.03, len * 0.62, wd, s * W * 0.45, H * 0.85, 0.1, 6, s * 0.12, Math.PI / 2 - 0.05);
  return K;
}

/* ---------------- o navio "Gaivota Dourada" (dá para subir) ---------------- */
const SHIP = { len: 30, beam: 7.6, deck: 2.3, keel: -2.6 };
function planHW(zn) { return zn >= 0 ? Math.pow(Math.max(0, 1 - Math.pow(zn, 2.4)), 0.62) : 1 - 0.26 * Math.pow(-zn, 3); } // planta do casco (proa fina, popa larga)
function sheer(zn) { return zn > 0 ? Math.pow(zn, 2.2) * 1.4 : Math.pow(-zn, 2) * 0.9; }
const SEC = [[-2.6, 0.08], [-2.2, 0.42], [-1.5, 0.68], [-0.8, 0.84], [0.0, 0.93], [0.25, 0.95]], SEC2 = [[0.25, 0.95], [0.9, 0.985], [1.6, 1.0], [2.3, 0.995], [2.8, 0.975], [3.3, 0.955]];
const lift = (y, sh) => y > SHIP.deck + 0.01 ? sh * Math.min(1, (y - SHIP.deck) / 1.0) : 0; // o convés é reto; só a amurada sobe na proa e na popa
function hullSurface(rows, len, beam, top) {
  const S = 28, R = rows.length, pos = [], idx = [], cols = R * 2 - 1;
  for (let i = 0; i <= S; i++) {
    const zn = i / S * 2 - 1, z = zn * len / 2, hw = beam / 2 * planHW(zn), sh = sheer(zn);
    const col = [];
    for (let j = R - 1; j >= 0; j--) col.push([-hw * rows[j][1], rows[j][0] + lift(rows[j][0], sh)]);
    for (let j = 1; j < R; j++) col.push([hw * rows[j][1], rows[j][0] + lift(rows[j][0], sh)]);
    for (const [x, y] of col) pos.push(x, y, z);
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function shipKit() {
  const K = new Kit(), { len, beam, deck: Dk } = SHIP, wd = M.wood(), dk = M.darkWood(), tar = plain('hullTar', '#2a221c', { rough: 0.85 }), paintB = plain('hullBand', '#c8a24a', { rough: 0.6, metal: 0.2 }), canvas = plain('canvasF', '#e8dfc8', { rough: 0.95 });
  K.add(hullSurface(SEC, len, beam, false), tar); K.add(hullSurface(SEC2, len, beam, true), dk);
  // faixa dourada na altura do convés e linha d'água
  for (let i = 0; i < 28; i++) { const z0 = (i / 28 * 2 - 1) * len / 2, z1 = ((i + 1) / 28 * 2 - 1) * len / 2, zm = (z0 + z1) / 2, zn = zm / (len / 2), hw = beam / 2 * planHW(zn) * 1.0, dy = sheer(zn) * (1.7 / 3.3);
    for (const s of [-1, 1]) { const hw0 = beam / 2 * planHW(z0 / (len / 2)), hw1 = beam / 2 * planHW(z1 / (len / 2)), ang = Math.atan2((hw1 - hw0) * s, z1 - z0); K.box(0.06, 0.18, Math.hypot(z1 - z0, hw1 - hw0) + 0.02, paintB, s * (hw + 0.02), 1.7, zm, ang); } }
  // costado interno (amurada) e corrimão: só acima do convés
  const inner = hullSurface([[Dk, 0.955], [2.8, 0.94], [3.25, 0.925]], len, beam - 0.3, true); { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } inner.computeVertexNormals(); } K.add(inner, wd);
  // espelho da popa (fecha o casco atrás) com janelas iluminadas
  { const zs = -len / 2, hw = beam / 2 * planHW(-1), sh = new THREE.Shape(); sh.moveTo(-hw * 0.08, -2.6); for (const [y, f] of [...SEC, ...SEC2.slice(1)]) sh.lineTo(-hw * f, y + lift(y, sheer(-1))); for (const [y, f] of [...SEC, ...SEC2.slice(1)].reverse()) sh.lineTo(hw * f, y + lift(y, sheer(-1))); sh.closePath();
    const tg = new THREE.ShapeGeometry(sh); tg.rotateY(Math.PI); K.add(tg, dk, 0, 0, zs - 0.01); for (let k = -1; k <= 1; k++) K.box(0.8, 0.7, 0.08, M.glass(), k * 1.5, 3.4, zs - 0.06); K.box(beam * 0.78, 0.2, 0.14, paintB, 0, 3.0, zs - 0.06); }
  // convés de tábuas
  { const sh = new THREE.Shape(), N = 24; for (let i = 0; i <= N; i++) { const zn = -1 + i / N * 1.94; sh.lineTo(-(beam / 2 * planHW(zn) * 0.94 - 0.12), -zn * len / 2); } for (let i = N; i >= 0; i--) { const zn = -1 + i / N * 1.94; sh.lineTo(beam / 2 * planHW(zn) * 0.94 - 0.12, -zn * len / 2); }
    const dg = new THREE.ShapeGeometry(sh); dg.rotateX(-Math.PI / 2); dg.computeVertexNormals(); K.add(dg, plain('deckPl', '#a07a4a', { rough: 0.85 }), 0, Dk, 0);
    for (let x = -beam / 2 + 0.5; x < beam / 2 - 0.4; x += 0.32) K.box(0.012, 0.012, len * 0.9, plain('deckSeam', '#4a3420'), x, Dk + 0.006, -len * 0.04); } // juntas das tábuas
  // castelo de popa (cabine do capitão) com porta, janelas e telhado com balaustrada
  const cab = { z0: -len / 2 + 1.5, z1: -len / 2 + 6.5 }, cw = beam - 1.9, ch = 2.4, cz = (cab.z0 + cab.z1) / 2;
  K.box(cw, ch, cab.z1 - cab.z0, dk, 0, Dk + ch / 2, cz); K.box(cw + 0.4, 0.16, cab.z1 - cab.z0 + 0.4, wd, 0, Dk + ch + 0.08, cz);
  K.box(1.0, 1.9, 0.08, M.wood(), 0, Dk + 0.95, cab.z1 + 0.04); K.box(1.25, 0.14, 0.12, paintB, 0, Dk + 1.98, cab.z1 + 0.06); for (const s of [-1, 1]) K.box(0.6, 0.55, 0.06, M.glass(), s * 1.6, Dk + 1.4, cab.z1 + 0.04);
  for (let k = 0; k < 9; k++) { const x = -cw / 2 + k * cw / 8; K.cyl(0.04, 0.04, 0.55, wd, x, Dk + ch + 0.42, cab.z1 + 0.1, 6); } K.box(cw + 0.2, 0.08, 0.1, wd, 0, Dk + ch + 0.72, cab.z1 + 0.1);
  // leme (timão) diante da cabine
  { const wz = cab.z1 + 1.1; K.box(0.3, 1.0, 0.3, dk, 0, Dk + 0.5, wz); K.add(new THREE.TorusGeometry(0.55, 0.05, 8, 24), M.wood(), 0, Dk + 1.35, wz + 0.2); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.cyl(0.03, 0.03, 1.4, M.wood(), Math.cos(a) * 0.01, Dk + 1.35, wz + 0.22, 6, 0, 0, a); } K.cyl(0.08, 0.08, 0.2, paintB, 0, Dk + 1.35, wz + 0.25, 10, 0, Math.PI / 2); }
  // escotilha do porão (grade com borda) — o portal fica em cima dela
  const hatchZ = -1; K.box(1.9, 0.22, 2.3, dk, 0, Dk + 0.11, hatchZ); for (let k = 0; k < 6; k++) K.box(1.7, 0.05, 0.08, plain('grate', '#3a2a1a'), 0, Dk + 0.24, hatchZ - 1.0 + k * 0.4); for (let k = 0; k < 5; k++) K.box(0.08, 0.05, 2.1, plain('grate', '#3a2a1a'), -0.8 + k * 0.4, Dk + 0.24, hatchZ);
  // mastros, vergas com velas recolhidas, cesto de gávea, enxárcias até a borda
  const masts = [[-5.0, 15], [3.5, 21], [10.0, 17]];
  for (const [mz, mh] of masts) {
    K.cyl(0.17, 0.24, mh, wd, 0, Dk + mh / 2, mz, 12);
    for (const [yy, ww] of [[0.42, 0.62], [0.7, 0.46], [0.9, 0.3]]) { const y = Dk + mh * yy, sw = beam * 1.25 * ww; K.cyl(0.08, 0.08, sw, wd, 0, y, mz, 8, 0, 0, Math.PI / 2); K.add(new THREE.CapsuleGeometry(0.2, sw * 0.85, 4, 10), canvas, 0, y - 0.18, mz + 0.05, 0, 0, Math.PI / 2); } // vela enrolada na verga
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const zz = mz - 0.9 + k * 0.6, zn = zz / (len / 2), bx = s * (beam / 2 * planHW(zn) - 0.1), top = new THREE.Vector3(0, Dk + mh * 0.86, mz), bot = new THREE.Vector3(bx, Dk + 1.1 + sheer(zn) * 0.5, zz), dir = top.clone().sub(bot), L = dir.length(), mid = top.clone().add(bot).multiplyScalar(0.5);
      const g = new THREE.CylinderGeometry(0.018, 0.018, L, 4); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())); K.add(g, M.rope(), mid.x, mid.y, mid.z); }
  }
  { const mz = 3.5, y = Dk + 21 * 0.62; K.add(new THREE.CylinderGeometry(0.75, 0.6, 0.6, 14, 1, true), dk, 0, y, mz); K.add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 14), wd, 0, y - 0.3, mz); }
  // gurupés e estai até o mastro de proa
  K.cyl(0.13, 0.16, 8, wd, 0, Dk + 1.8 + 1.4, len / 2 + 1.8, 10, 0, Math.PI / 2 - 0.3);
  { const a = new THREE.Vector3(0, Dk + 4.6, len / 2 + 5.4), b = new THREE.Vector3(0, Dk + 17 * 0.9, 10), d = b.clone().sub(a), L = d.length(), g = new THREE.CylinderGeometry(0.02, 0.02, L, 4); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); const m = a.clone().add(b).multiplyScalar(0.5); K.add(g, M.rope(), m.x, m.y, m.z); }
  // canhões (enfeite) apontando pelas portinholas, barris, caixas, rolos de corda, cabrestante
  for (const s of [-1, 1]) for (const zz of [-7.8, 6.8]) { const zn = zz / (len / 2), hw = beam / 2 * planHW(zn) - 0.75; K.box(0.7, 0.35, 1.0, dk, s * hw, Dk + 0.25, zz); K.cyl(0.12, 0.15, 1.5, M.iron(), s * (hw + 0.45), Dk + 0.55, zz, 10, 0, 0, s * Math.PI / 2); K.box(0.06, 0.6, 0.7, tar, s * (beam / 2 * planHW(zn) + 0.02), 1.5, zz); }
  K.cyl(0.35, 0.45, 0.9, dk, 0, Dk + 0.45, 7.8, 12); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; K.cyl(0.04, 0.04, 1.2, M.wood(), Math.cos(a) * 0.4, Dk + 0.8, 7.8 + Math.sin(a) * 0.4, 5, a, 0, Math.PI / 2); }
  for (const [x, z] of [[-2.4, -6.6], [-2.4, -5.8], [2.3, 1.2]]) K.add(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 14), M.wood(), x, Dk + 0.47, z);
  for (const [x, z, ry] of [[2.3, -6.4, 0.2], [2.4, -5.4, -0.3], [-2.2, 1.4, 0.1]]) K.box(0.8, 0.7, 0.8, M.wood(), x, Dk + 0.35, z, ry);
  for (const [x, z] of [[-2.6, 5.0], [2.6, 9.0]]) for (let k = 0; k < 4; k++) K.add(new THREE.TorusGeometry(0.28 - k * 0.04, 0.04, 6, 18), M.rope(), x, Dk + 0.05 + k * 0.08, z, 0, Math.PI / 2);
  // figura de proa (gaivota dourada de asas abertas)
  { const fz = len / 2 + 0.5, fy = Dk + 1.6; K.add(new THREE.SphereGeometry(0.35, 12, 10), paintB, 0, fy, fz, 0, 0, 0, 0.8, 0.8, 1.4); for (const s of [-1, 1]) { const w = new THREE.Shape(); w.moveTo(0, 0); w.quadraticCurveTo(0.9, 0.5, 1.6, 0.15); w.quadraticCurveTo(0.9, 0.1, 0, -0.2); const g = new THREE.ExtrudeGeometry(w, { depth: 0.05, bevelEnabled: false }); g.scale(s, 1, 1); K.add(g, paintB, s * 0.2, fy, fz - 0.3, 0, 0, s * 0.2); } }
  return K;
}
// lanternas e bandeira (animadas, ficam fora do Kit)
function shipExtras(g) {
  const { len, deck: Dk } = SHIP;
  for (const s of [-1, 1]) { const lz = -len / 2 - 0.2; const L = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 8), M.glass()); L.position.set(s * 1.9, Dk + 3.6, lz); g.add(L); }
  const lt = vlight('#ffcf80', 3, 12, 1.6); lt.position.set(0, Dk + 3.4, -SHIP.len / 2); g.add(lt);
  const b = makeBanner('porto', 0.9, 2.0); b.position.set(0, Dk + 15 + 0.2, -5.0); b.rotation.y = Math.PI / 2; g.add(b);
}

/* ---------------- interiores (salas longe do mundo, x = 1900) ---------------- */
function roomPortalExit(ctx, id, I) { const ex = makePortal('#ffd27a'); ex.position.set(I.x, 0, I.z + I.d / 2 - 0.9); ctx.scene.add(ex); ctx.portals.push({ kind: 'exit', from: id, x: I.x, z: I.z + I.d / 2 - 0.9, mesh: ex }); }
// porão do navio: cavernas curvas, piso de tábuas, vigas baixas, redes de dormir, carga, mesa de mapas, fogão de bordo
function buildHold(ctx) {
  const I = { name: 'Porão da Gaivota Dourada', x: 1900, z: 0, w: 7.6, d: 24, h: 3.0, region: 'Porto das Gaivotas', music: 'cidade' };
  INTERIORS.porao_gaivota = I;
  const K = new Kit(), wd = M.wood(), dk = M.darkWood(), r = rngOf(1909), hw = I.w / 2, hd = I.d / 2;
  K.box(I.w + 0.6, 0.15, I.d, plain('holdFloor', '#7a5634', { rough: 0.9 }), 0, -0.075, 0); for (let x = -hw + 0.3; x < hw; x += 0.3) K.box(0.012, 0.01, I.d, plain('deckSeam', '#4a3420'), x, 0.005, 0);
  // costado curvo dos dois lados + teto
  for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.7, 1.4, 0.35, 3.2); sh.lineTo(0.15, 3.2); sh.quadraticCurveTo(0.5, 1.4, -0.15, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: I.d, bevelEnabled: false }); g.translate(0, 0, -hd); g.scale(s, 1, 1); K.add(g, plain('holdHull', '#5a3e26', { rough: 0.9, side: THREE.DoubleSide }), s * hw, 0, 0);
    for (let z = -hd + 1; z < hd; z += 1.6) { const rib = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * hw, 0, z), new THREE.Vector3(s * (hw + 0.6), 1.4, z), new THREE.Vector3(s * (hw + 0.3), 3.1, z)), 10, 0.1, 6); K.add(rib, dk); } }
  K.box(I.w + 1.4, 0.2, I.d, plain('holdCeil', '#4a3220'), 0, I.h + 0.1, 0); for (let z = -hd + 0.8; z < hd; z += 1.6) K.box(I.w + 1.2, 0.26, 0.22, dk, 0, I.h - 0.12, z);
  K.box(I.w + 1.2, I.h, 0.3, plain('holdHull', '#5a3e26'), 0, I.h / 2, -hd - 0.15); K.box(I.w + 1.2, I.h, 0.3, plain('holdHull', '#5a3e26'), 0, I.h / 2, hd + 0.15);
  // escada que sobe para o convés (junto à saída)
  for (let k = 0; k < 8; k++) K.box(1.1, 0.06, 0.25, wd, 0, 0.3 + k * 0.34, hd - 0.4 - k * 0.12); for (const s of [-1, 1]) K.box(0.08, 3.0, 0.08, dk, s * 0.6, 1.5, hd - 0.85, 0, -0.35);
  // carga: barris deitados, caixas amarradas com corda, sacos, redes
  for (let k = 0; k < 8; k++) { const z = -hd + 1.5 + (k % 4) * 0.95, x = -hw + 0.9 + Math.floor(k / 4) * 0.95; K.add(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 14), wd, x, 0.45 + (k > 5 ? 0.85 : 0), z, 0, 0, Math.PI / 2); K.add(new THREE.TorusGeometry(0.43, 0.025, 6, 20), M.iron(), x - 0.3, 0.45 + (k > 5 ? 0.85 : 0), z, Math.PI / 2, 0, 0); }
  for (let k = 0; k < 6; k++) { const z = -hd + 1.4 + (k % 3) * 1.0, y = 0.4 + Math.floor(k / 3) * 0.8; K.box(0.8, 0.8, 0.8, M.wood(), hw - 0.9, y, z, r() * 0.2); K.box(0.82, 0.04, 0.05, M.rope(), hw - 0.9, y, z); }
  for (let k = 0; k < 5; k++) K.add(new THREE.SphereGeometry(0.32, 10, 8), plain('sackH', '#b8a072', { rough: 1 }), hw - 0.7 - (k % 2) * 0.5, 0.25, -hd + 5 + k * 0.45, 0, 0, 0, 1, 0.75, 1);
  // redes de dormir: pano curvado preso por cordas em ganchos nas vigas
  for (let k = 0; k < 3; k++) { const z = -1.5 + k * 1.7, L = 2.4, g = new THREE.PlaneGeometry(L, 0.75, 14, 3), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), sag = 0.55 * (1 - Math.pow(2 * x / L, 2)); P.setXYZ(i, x, -sag + Math.abs(y) * 0.25 * (1 - Math.pow(2 * x / L, 2)), y * (0.7 + 0.3 * Math.pow(2 * x / L, 2))); }
    g.computeVertexNormals(); K.add(g, plain('hammock', '#d8ccae', { rough: 1, side: THREE.DoubleSide }), -hw + 0.4 + L / 2 + 0.3, 2.15, z);
    for (const sx of [-1, 1]) { const x0 = -hw + 0.7 + L / 2 + sx * (L / 2 + 0.25); K.cyl(0.012, 0.012, 0.75, M.rope(), x0, 2.5, z, 4, 0, 0, sx * 0.5); } }
  // mesa de mapas com velas e mapa aberto
  { const tz = 5.5; K.box(2.2, 0.08, 1.2, wd, 0.8, 0.95, tz); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.08, 0.95, 0.08, dk, 0.8 + sx * 1.0, 0.47, tz + sz * 0.5); K.box(1.4, 0.01, 0.9, plain('mapPaper', '#e6d6a8', { rough: 1 }), 0.8, 1.0, tz, 0.15); K.cyl(0.04, 0.04, 0.2, plain('candle', '#f2ead6'), 1.7, 1.09, tz - 0.3, 8); K.box(0.6, 0.45, 0.6, wd, 0.8, 0.22, tz + 1.0); }
  // fogão de bordo (ferro) com panela
  { const fz = -hd + 7.5; K.box(1.0, 0.9, 0.8, M.iron(), hw - 0.9, 0.45, fz); K.cyl(0.1, 0.1, 2.1, M.iron(), hw - 0.9, 1.95, fz - 0.2, 8); K.cyl(0.32, 0.28, 0.35, M.iron(), hw - 0.9, 1.08, fz, 12); }
  const g = K.build(); g.position.set(I.x, 0, I.z); ctx.scene.add(g); ctx.occluders.push(g);
  for (const [lx, lz] of [[0, -6], [0, 4]]) { const L = vlight('#ffc070', 3.8, 12, 1.4); L.position.set(I.x + lx, 2.5, I.z + lz); ctx.scene.add(L); }
  for (const [lx, lz] of [[-1.5, -6], [1.5, 4]]) { const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.32, 8), M.glass()); lan.position.set(I.x + lx, 2.5, I.z + lz); ctx.scene.add(lan); const f = flame(0.25, lx); f.position.set(I.x + lx, 2.42, I.z + lz); ctx.scene.add(f); ctx.roomAnims.push(f); }
  { const f = flame(0.5, 3); f.position.set(I.x + hw - 0.9, 0.95, I.z - hd + 7.5); ctx.scene.add(f); ctx.roomAnims.push(f); }
  for (const c of [[-hw + 1.4, -hd + 3, 1.3], [hw - 0.9, -hd + 2.4, 1.3], [0.8, 5.5, 1.2]]) ctx.colliders.push({ x: I.x + c[0], z: I.z + c[1], r: c[2], name: 'porao' });
  const N = (n, x, z, yaw, anim) => ctx.roomNpc(n, I.x + x, I.z + z, yaw, anim);
  // NPCs do porão, cada um no seu canto: a mestra de carga junto das caixas, o cozinheiro no fogão, a navegadora na mesa de mapas
  N({ id: 'odete_p', name: 'Odete', title: 'Mestra de Carga', model: 'Barbarian', shopList: 'geral', shopTitle: '⚓ Porão da Gaivota Dourada', look: { race: 'humano', sex: 'f', face: 'valente', hair: { style: 'coque', color: 'ruivo' } },
    hello: 'Tudo que entra e sai deste porão passa pelos meus olhos. Quer comprar alguma coisa de além-mar? Ou vender o que trouxe da estrada?' }, hw - 2.0, -hd + 4.2, -Math.PI / 2);
  N({ id: 'boris_p', name: 'Bóris', title: 'Cozinheiro de Bordo', model: 'Barbarian', show: ['Mug'], heals: true, look: { race: 'humano', face: 'alegre', hair: { style: 'careca', color: 'castanho' }, beard: true } }, hw - 2.0, -hd + 7.5, -Math.PI / 2);
  N({ id: 'ilka_p', name: 'Ilka', title: 'Navegadora', model: 'Mage', look: { race: 'elfo', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
    lines: 'Estas cartas mostram a costa de Aethra até o fim do sal. Além disso... só névoa e lendas.\nDizem que há uma ilha onde as gaivotas fazem ninho em ossos de dragão. Um dia a Gaivota Dourada vai até lá.' }, 0.8, 4.4, 0);
  roomPortalExit(ctx, 'porao_gaivota', I);
  return I;
}
// interior de casa do porto (usa a casca padrão das salas: tábuas, paredes, vigas, janelas, porta ao sul)
function buildHouseRoom(ctx, id, I, furnish) {
  INTERIORS[id] = I;
  const { group, walls } = buildRoomShell(I); ctx.scene.add(group); group.updateMatrixWorld(true);
  for (const w of walls) { ctx.scene.attach(w); ctx.occluders.push(w); }
  const K = new Kit(); furnish(K, I); const g = K.build(); g.position.set(I.x, 0, I.z); ctx.scene.add(g);
  const L = vlight('#ffd9a0', 3.2, 14, 1.4); L.position.set(I.x, I.h - 0.6, I.z); ctx.scene.add(L);
  roomPortalExit(ctx, id, I);
}
function furnishTavern(K, I) { // Taverna do Marujo: balcão, barris de rum, mesas com canecas, rede e âncora na parede, lareira
  const wd = M.wood(), dk = M.darkWood(), hw = I.w / 2, hd = I.d / 2;
  K.box(4.6, 1.05, 0.7, dk, -hw + 3.0, 0.52, -hd + 2.2); K.box(4.8, 0.08, 0.9, wd, -hw + 3.0, 1.08, -hd + 2.2);
  for (let k = 0; k < 3; k++) { K.add(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 14), wd, -hw + 1.2 + k * 0.95, 1.7, -hd + 0.6, 0, 0, Math.PI / 2); K.cyl(0.03, 0.03, 0.12, M.iron(), -hw + 1.2 + k * 0.95, 1.55, -hd + 1.1, 6, 0, Math.PI / 2); }
  for (const [x, z] of [[1.5, -1], [1.5, 2.5], [-2.2, 2.3]]) { K.cyl(0.65, 0.65, 0.07, wd, x, 0.78, z, 16); K.cyl(0.08, 0.12, 0.75, dk, x, 0.38, z, 8); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; K.cyl(0.2, 0.2, 0.06, wd, x + Math.cos(a) * 1.0, 0.48, z + Math.sin(a) * 1.0, 10); K.cyl(0.05, 0.05, 0.45, dk, x + Math.cos(a) * 1.0, 0.23, z + Math.sin(a) * 1.0, 6); } K.cyl(0.07, 0.06, 0.16, plain('mugT', '#c8d8c8', { rough: 0.2, transparent: true, opacity: 0.8 }), x + 0.2, 0.9, z, 10); }
  // âncora pendurada na parede do fundo e rede de pesca
  K.box(0.12, 1.6, 0.12, M.iron(), 1.6, 2.6, -hd + 0.2); K.box(0.9, 0.1, 0.1, M.iron(), 1.6, 3.2, -hd + 0.2); K.add(new THREE.TorusGeometry(0.6, 0.07, 8, 20, Math.PI), M.iron(), 1.6, 2.0, -hd + 0.2, 0, 0, Math.PI);
  const net = new THREE.PlaneGeometry(3.4, 1.6, 10, 4), P = net.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 1.6) * 0.1); K.add(net, plain('netW', '#6a5a3a', { rough: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }), hw - 0.15, 2.6, 0, -Math.PI / 2);
}
function furnishShop(K, I) { // Armazém Naval do Rufino: prateleiras com cordas, lanternas, remos, barris e um balcão
  const wd = M.wood(), dk = M.darkWood(), hw = I.w / 2, hd = I.d / 2;
  K.box(3.6, 1.0, 0.7, dk, 0, 0.5, -hd + 2.4); K.box(3.8, 0.08, 0.9, wd, 0, 1.04, -hd + 2.4);
  for (const s of [-1, 1]) { K.box(0.4, 2.6, 3.4, dk, s * (hw - 0.3), 1.3, -0.5); for (let k = 0; k < 4; k++) K.box(0.45, 0.06, 3.4, wd, s * (hw - 0.3), 0.4 + k * 0.6, -0.5); for (let k = 0; k < 6; k++) K.add(new THREE.TorusGeometry(0.16, 0.05, 6, 14), M.rope(), s * (hw - 0.35), 0.62 + (k % 3) * 0.6, -1.6 + Math.floor(k / 3) * 1.4, 0, Math.PI / 2); }
  for (let k = 0; k < 4; k++) K.cyl(0.04, 0.04, 2.6, wd, -hw + 0.8 + k * 0.25, 1.3, hd - 1.2, 6, 0, 0.12); // remos encostados
  for (let k = 0; k < 3; k++) K.add(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 14), wd, hw - 1.0 - k * 0.85, 0.45, hd - 1.2);
}

/* ---------------- montagem do porto ---------------- */
export function buildPortCity(ctx) {
  const r = rngOf(515), q = Q;
  const H = (s, t, y) => { const p = at(s, t); return { x: p.x, z: p.z, y: y ?? gY(p.x, p.z) }; };
  // 1) cais de pedra: paredão com pedra-de-coroamento, de t = -70 a +70, e os retornos nas pontas
  { const K = new Kit(), st = M.greyStone(), cap = plain('quayCap', '#b5ad9c', { rough: 0.85 }), half = HARBOR.half - 2;
    const c = H(q - 0.6, 0, 0); K.box(1.3, 5.4, half * 2, st, 0, LAND - 2.7, 0); K.box(1.5, 0.22, half * 2 + 0.2, cap, 0.1, LAND + 0.04, 0);
    for (let t = -half + 4; t < half - 2; t += 13) { K.box(0.25, 0.25, 0.6, M.iron(), -0.62, LAND - 0.6, t); K.add(new THREE.TorusGeometry(0.18, 0.04, 6, 14), M.iron(), -0.7, LAND - 0.85, t); } // argolas no paredão (lado do mar)
    for (const t of [-half, half]) K.box(16, 5.4, 1.3, st, 7.4, LAND - 2.7, t); // retornos para terra
    const g = K.build(); g.position.set(c.x, 0, c.z); g.rotation.y = YAW_T; ctx.scene.add(g); g.userData.asset = 'cais_de_pedra'; g.userData.big = true; ctx.placed.push(g); }
  // cabeços de amarração ao longo da borda
  { const K = new Kit(); for (let t = -64; t <= 64; t += 8) { const lt = t; bollard(K, 0, 0, lt, ((t + 64) / 8) % 3 === 1); } const c = H(q - 0.8, 0, LAND); put(ctx, K, 'cabeco', c.x, c.z, YAW_T, { y: LAND, occ: false }); }
  // 2) o navio atracado ao lado do cais
  const sc = q + 5.2, tc = 9, shipYaw = YAW_T;
  { const c = H(sc, tc, SEA.level), g = put(ctx, shipKit(), 'navio', c.x, c.z, shipYaw, { y: SEA.level, occ: false }); shipExtras(g); g.userData.far = 520; }
  const DY = SEA.level + SHIP.deck; // altura do convés
  const deckT0 = tc - SHIP.len / 2 + 1.5, deckLen = 7 - (-SHIP.len / 2 + 1.5), deckW = SHIP.beam - 1.5; // o convés andável vai da popa até antes da proa afinar
  { const p = H(sc, deckT0, 0); deck(p.x, p.z, YAW_T, deckLen, deckW, DY); }
  // prancha de embarque: sobe do cais até o alto da amurada e desce em degraus para o convés
  const gangT = tc + 5.2;
  const RAIL = DY + 1.02;
  { const sA = q - 2.6, lenA = 4.2, sB = sA + lenA, lenB = 1.5, pA = H(sA, gangT, 0), pB = H(sB, gangT, 0);
    deck(pA.x, pA.z, YAW_SEA, lenA, 1.4, LAND + 0.02, RAIL); deck(pB.x, pB.z, YAW_SEA, lenB, 1.4, RAIL, DY + 0.02);
    const K = new Kit(), rise = RAIL - LAND, L = Math.hypot(lenA, rise), ang = Math.atan2(rise, lenA);
    K.box(1.3, 0.08, L, M.wood(), 0, rise / 2 + 0.02, lenA / 2, 0, -ang); for (let k = 0; k < 10; k++) K.box(1.3, 0.04, 0.05, M.darkWood(), 0, 0.09 + (k + 0.5) / 10 * rise, (k + 0.5) / 10 * lenA, 0, -ang);
    for (let k = 0; k < 3; k++) K.box(1.2, 0.08, 0.5, M.wood(), 0, rise - (k + 1) * (RAIL - DY) / 3.2, lenA + 0.25 + k * 0.42); // degraus para dentro do navio
    for (const s of [-1, 1]) { K.cyl(0.04, 0.05, 1.2, M.darkWood(), s * 0.75, 0.6, 0.2, 6); K.cyl(0.04, 0.05, 1.2, M.darkWood(), s * 0.75, rise + 0.6, lenA - 0.2, 6); const g2 = new THREE.CylinderGeometry(0.015, 0.015, L, 4); g2.rotateX(Math.PI / 2); g2.rotateX(-ang); K.add(g2, M.rope(), s * 0.75, rise / 2 + 1.0, lenA / 2); }
    put(ctx, K, 'prancha', pA.x, pA.z, YAW_SEA, { y: LAND, occ: false }); }
  // colisões do navio: amuradas dos dois lados (com a abertura da prancha), proa, popa, cabine e mastros
  { const sIn = sc - deckW / 2 - 0.15, sOut = sc + deckW / 2 + 0.15, t1 = deckT0 + deckLen;
    wallT(ctx, sIn, deckT0, gangT - 0.85); wallT(ctx, sIn, gangT + 0.85, t1); wallT(ctx, sOut, deckT0, t1);
    wallS(ctx, deckT0 - 0.1, sIn, sOut); wallS(ctx, t1 + 0.1, sIn, sOut);
    { const c = at(sc, tc - SHIP.len / 2 + 4); wall(ctx, c.x, c.z, YAW_T, (SHIP.beam - 1.9) / 2, 2.5); } // cabine
    for (const mz of [-5.0, 3.5, 10.0]) { const c = at(sc, tc + mz); ctx.colliders.push({ x: c.x, z: c.z, r: 0.45, name: 'mastro' }); }
    { const c = at(sc, tc + 7.8); ctx.colliders.push({ x: c.x, z: c.z, r: 0.55, name: 'cabrestante' }); } }
  // escotilha → porão (portal em cima da grade)
  const hold = buildHold(ctx);
  { const h = at(sc, tc - 1); ctx.addDoorPortal('porao_gaivota', h.x, h.z, YAW_T + Math.PI); const pt = ctx.portals[ctx.portals.length - 1]; pt.mesh.position.y = DY + 0.26; pt.out.y = DY; }
  // 3) docas de madeira (estacas rentes ao piso — nada de pinos para fora) com botes amarrados dos lados
  const PIERS = [-36, 46];
  for (const pt of PIERS) {
    const len = 22, w = 3.0, K = new Kit(), wd = M.wood(), y = LAND + 0.04;
    for (let z = 0; z < len; z += 0.42) K.box(w, 0.1, 0.38, wd, 0, 0, z + 0.21, 0, 0, Math.sin(z * 7) * 0.01);
    for (let z = 1.2; z < len; z += 3) for (const sx of [-1, 1]) K.cyl(0.17, 0.19, 6, M.darkWood(), sx * (w / 2 - 0.1), -3.07, z, 10);
    for (const sx of [-1, 1]) K.box(0.2, 0.22, len, M.darkWood(), sx * (w / 2 - 0.08), -0.15, len / 2);
    for (let z = 4; z < len; z += 7) for (const sx of [-1, 1]) bollard(K, sx * (w / 2 - 0.35), 0.05, z, z % 2 === 0);
    for (let z = 2; z < len; z += 4) for (const sx of [-1, 1]) K.cyl(0.05, 0.06, 0.95, M.darkWood(), sx * (w / 2 - 0.05), 0.5, z, 6); // postes do corrimão de corda
    for (const sx of [-1, 1]) { const g = new THREE.CylinderGeometry(0.02, 0.02, len - 2, 4); g.rotateX(Math.PI / 2); K.add(g, M.rope(), sx * (w / 2 - 0.05), 0.85, len / 2 + 0.6); }
    const p = H(q - 0.3, pt, 0); put(ctx, K, 'cais', p.x, p.z, YAW_SEA, { y, occ: false }); deck(p.x, p.z, YAW_SEA, len, w, y);
    wallS(ctx, pt - w / 2 - 0.12, q, q + len); wallS(ctx, pt + w / 2 + 0.12, q, q + len); { const e = at(q - 0.3 + len + 0.1, pt); wall(ctx, e.x, e.z, YAW_SEA, w / 2 + 0.3, 0.15); }
    for (const [ds, st, seed] of [[8, -1, 1], [16, 1, 2], [12, 1, 3]]) { if (pt > 0 && seed === 3) continue; const bp = H(q + ds, pt + st * 3.1, 0), bk = rowboat(4.6 + seed * 0.4, seed + (pt > 0 ? 3 : 0)), g = put(ctx, bk, 'barco', bp.x, bp.z, YAW_SEA + (seed - 2) * 0.08, { y: SEA.level - 0.12, occ: false });
      g.userData.update = t => { g.position.y = SEA.level - 0.12 + Math.sin(t * 1.1 + bp.x) * 0.05; g.rotation.z = Math.sin(t * 0.9 + bp.z) * 0.03; }; ctx.roomAnims.push(g); }
  }
  // borda do cais: ninguém cai na água (aberturas na prancha e nas docas)
  { const gaps = [[gangT - 0.85, gangT + 0.85], ...PIERS.map(t => [t - 1.6, t + 1.6]), [56, 64]]; let t0 = -HARBOR.half + 2;
    for (const [a, b] of gaps.sort((x, y) => x[0] - y[0])) { if (a > t0) wallT(ctx, q + 0.3, t0, a); t0 = b; } wallT(ctx, q + 0.3, t0, HARBOR.half - 2); }
  // 4) quebra-mar de pedras até o farol na boca do porto
  { const bt = 60, s0 = q - 0.5, s1 = q + 30, K = new Kit(), st = M.greyStone(), rock = plain('brkRock', '#7c776c', { rough: 0.95 }), yTop = LAND + 0.03, rr = rngOf(606);
    for (let s = s0; s < s1 + 8; s += 1.6) for (const sx of [-1, 1]) { const g = new THREE.IcosahedronGeometry(1, 1); const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) * (1 + (rr() - 0.5) * 0.3), P.getY(i) * (1 + (rr() - 0.5) * 0.3), P.getZ(i) * (1 + (rr() - 0.5) * 0.3)); g.computeVertexNormals(); K.add(g, rock, sx * (2.2 + rr() * 0.6), yTop - 1.2 - rr() * 0.8, s - s0, rr() * 6, rr() * 6, 0, 1.5 + rr() * 0.6, 1.3 + rr() * 0.5, 1.4 + rr() * 0.5); }
    K.box(3.4, 3.6, s1 - s0, st, 0, yTop - 1.8, (s1 - s0) / 2); K.box(3.6, 0.15, s1 - s0, plain('brkTop', '#a59d8c', { rough: 0.9 }), 0, yTop - 0.07, (s1 - s0) / 2);
    // plataforma redonda do farol
    K.add(new THREE.CylinderGeometry(5.6, 6.4, 4.2, 28), st, 0, yTop - 2.1, s1 - s0 + 5.5); K.add(new THREE.CylinderGeometry(5.7, 5.7, 0.16, 28), plain('brkTop', '#a59d8c'), 0, yTop - 0.06, s1 - s0 + 5.5);
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; if (Math.abs(a - Math.PI * 1.5) < 0.4) continue; K.cyl(0.07, 0.07, 0.95, M.iron(), Math.cos(a) * 5.4, yTop + 0.47, s1 - s0 + 5.5 + Math.sin(a) * 5.4, 6); }
    const p = H(s0, bt, 0); put(ctx, K, 'quebra_mar', p.x, p.z, YAW_SEA, { y: 0, occ: false });
    deck(p.x, p.z, YAW_SEA, s1 - s0 + 1, 3.2, yTop); { const pc = H(s1 + 0.5, bt, 0); deck(pc.x, pc.z, YAW_SEA, 10.5, 10.4, yTop); }
    wallS(ctx, bt - 1.75, s0 + 1, s1 + 1); wallS(ctx, bt + 1.75, s0 + 1, s1 + 1);
    { const ctr = at(s1 + 5.5, bt); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = Math.sin(a), z = Math.cos(a); if (z < -0.85) continue; const pp = at(s1 + 5.5 + z * 5.7, bt + x * 5.7); ctx.colliders.push({ x: pp.x, z: pp.z, r: 1.15, name: 'porto' }); } }
    const lc = H(s1 + 5.5, bt, 0), lh = put(ctx, lighthouseKit(), 'farol', lc.x, lc.z, YAW_SEA + Math.PI, { y: yTop - 0.05, occ: true }); ctx.colliders.push({ x: lc.x, z: lc.z, r: 3.4, name: 'farol' });
    const L = vlight('#ffd27a', 6, 30, 1.4); L.position.set(0, 21, 0); lh.add(L); lh.userData.far = 700;
    const lena = ctx.worldNpc({ id: 'lena', name: 'Lena', title: 'Faroleira', model: 'Mage', look: { race: 'humano', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'loiro' } },
      lines: 'Toda noite subo os 120 degraus do farol para acender a lanterna. Nenhum barco se perde enquanto eu estiver aqui.\nDaqui de cima dá para ver a Gaivota Dourada inteira. E, em dia claro, as velas dos barcos de pesca lá longe.' }, at(s1 + 1.8, bt).x, at(s1 + 1.8, bt).z, YAW_SEA + Math.PI);
    lena.obj.position.y = yTop; }
  // 5) mercado de peixe no passeio: 4 bancas juntinhas, de frente para o passeio
  const fishT = [-24, -20.6, -17.2, -13.8];
  fishT.forEach((t, i) => { const p = H(q - 9, t); put(ctx, fishStall(40 + i), 'banca_de_peixe', p.x, p.z, YAW_SEA, { box: [[0, 0, 1.45, 0.75]] }); });
  // 6) casas do litoral: fileira de frente para o mar (abertura no meio para a praça) e uma segunda fileira atrás
  const houses = [];
  const ROW1 = [[-58, 7.4], [-49, 8], [-40, 7], [-31, 8.2], [31, 8.2], [40, 7], [49, 8], [58, 7.4]], ROW2 = [[-31, 7], [-22, 6.5], [22, 6.5], [31, 7]];
  ROW1.forEach(([t, w], i) => houses.push({ s: 6.5 + (i % 2) * 0.8, t, w, d: 6.4, seed: 80 + i }));
  ROW2.forEach(([t, w], i) => houses.push({ s: -9 + (i % 2), t, w, d: 6.2, seed: 120 + i }));
  for (const h of houses) { const p = H(h.s, h.t), { K, box } = coastHouse(h.seed, h.w, h.d); h.g = put(ctx, K, 'casa_do_porto', p.x, p.z, YAW_SEA + (r() - 0.5) * 0.06, { box }); }
  // duas casas com porta para dentro: a taverna e o armazém naval
  const doorOf = h => { const dxl = -h.w * 0.22, s = h.s + h.d / 2 + 1.25; return at(s, h.t + dxl); };
  { const h = houses[3], d = doorOf(h); buildHouseRoom(ctx, 'taverna_marujo', { name: 'Taverna do Marujo', x: 1900, z: 60, w: 12, d: 10, h: 4.2, wall: '#d8cbb0', floor: '#7a5634', beam: '#4a3220', region: 'Porto das Gaivotas' }, furnishTavern); ctx.addDoorPortal('taverna_marujo', d.x, d.z, YAW_SEA);
    ctx.roomNpc({ id: 'gaspar_p', name: 'Gaspar', title: 'Taverneiro do Marujo', model: 'Barbarian', show: ['Mug'], heals: true, look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'grisalho' }, beard: true } }, 1900 - 6 + 3.0, 60 - 5 + 1.4, 0);
    ctx.roomNpc({ id: 'lia_p', name: 'Lia', title: 'Cantora do Porto', model: 'Mage', look: { race: 'humano', sex: 'f', face: 'gentil', hair: { style: 'longo', color: 'ruivo' } },
      lines: 'Quer ouvir a canção da Gaivota Dourada? Ela conta de um navio que voltou do fim do mundo com o porão cheio de estrelas...' }, 1900 + 4.2, 60 - 3.6, -Math.PI * 0.75); }
  { const h = houses[4], d = doorOf(h); buildHouseRoom(ctx, 'armazem_naval', { name: 'Armazém Naval do Rufino', x: 1900, z: 100, w: 10, d: 9, h: 3.8, wall: '#c9b48e', floor: '#6e4e30', beam: '#4a3220', region: 'Porto das Gaivotas' }, furnishShop); ctx.addDoorPortal('armazem_naval', d.x, d.z, YAW_SEA);
    ctx.roomNpc({ id: 'rufino_p', name: 'Rufino', title: 'Armazém Naval', model: 'Rogue', shopList: 'geral', shopTitle: '⚓ Armazém Naval do Rufino', look: { race: 'humano', face: 'astuto', hair: { style: 'curto', color: 'castanho' }, beard: true },
      hello: 'Corda, lona, lanterna, poção para enjoo... e compro qualquer coisa que você tenha achado na praia!' }, 1900, 100 - 4.5 + 1.2, 0); }
  // 7) praça com âncora monumental e mastros com estandartes na entrada do passeio
  { const K = new Kit(), p = H(0, 0); K.add(new THREE.CylinderGeometry(2.4, 2.8, 0.6, 24), M.greyStone(), 0, 0.3, 0); K.box(0.35, 3.2, 0.35, M.iron(), 0, 2.2, 0); K.box(2.2, 0.3, 0.3, M.iron(), 0, 3.4, 0); K.add(new THREE.TorusGeometry(1.2, 0.16, 10, 28, Math.PI), M.iron(), 0, 1.6, 0, 0, 0, Math.PI); for (const s of [-1, 1]) K.add(new THREE.ConeGeometry(0.28, 0.6, 10), M.iron(), s * 1.25, 1.75, 0, 0, 0, s * 0.6); K.add(new THREE.TorusGeometry(0.35, 0.08, 8, 16), M.iron(), 0, 3.95, 0);
    put(ctx, K, 'ancora_da_praca', p.x, p.z, YAW_SEA, { box: [[0, 0, 2.5, 2.5]] }); }
  for (const t of [-8, 8]) { const p = H(q - 14.5, t), K = new Kit(); K.cyl(0.1, 0.13, 7, M.darkWood(), 0, 3.5, 0, 10); K.add(new THREE.SphereGeometry(0.16, 10, 8), M.gold(), 0, 7.05, 0); put(ctx, K, 'mastro', p.x, p.z, 0, { box: [[0, 0, 0.2, 0.2]], occ: false }); const b = makeBanner('porto', 1.0, 2.6); b.position.set(p.x, gY(p.x, p.z) + 6.6, p.z); b.rotation.y = YAW_SEA + Math.PI / 2; ctx.scene.add(b); }
  // 8) estaleiro na ponta oeste: bote em cavaletes sendo consertado, tábuas e baldes de piche
  { const p = H(q - 9, -63), K = new Kit(); for (const z of [-1.2, 1.2]) { K.box(0.12, 0.8, 1.4, M.darkWood(), 0, 0.4, z, 0, 0.25); K.box(0.12, 0.8, 1.4, M.darkWood(), 0, 0.4, z, 0, -0.25); K.box(1.6, 0.12, 0.14, M.darkWood(), 0, 0.8, z); }
    const bk = rowboat(5.2, 7); for (const { mat, geos } of bk.parts.values()) for (const g of geos) { const gg = g.clone(); gg.rotateX(Math.PI); gg.translate(0, 1.55, 0); K.add(gg, mat); } // bote de cabeça para baixo
    for (let k = 0; k < 5; k++) K.box(0.25, 0.06, 3.2, M.wood(), 2.2 + k * 0.27, 0.05 + (k % 2) * 0.07, 0); K.cyl(0.25, 0.22, 0.4, M.iron(), -1.6, 0.2, 1.4, 10);
    put(ctx, K, 'estaleiro', p.x, p.z, YAW_SEA + Math.PI / 2, { box: [[0, 0, 1.2, 2.8]] });
    const n = H(q - 9, -60.4); ctx.worldNpc({ id: 'tonho', name: 'Tonho', title: 'Construtor de Barcos', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'humano', face: 'gentil', hair: { style: 'raspado', color: 'ruivo' }, beard: true },
      lines: 'Esse bote aqui bateu nas pedras do quebra-mar. Mais dois dias de piche e ele volta para a água.\nMadeira boa vem de Aelindra, mas os elfos não gostam que a gente corte as árvores deles.' }, n.x, n.z, YAW_SEA + Math.PI / 2); }
  // 9) guindastes de carga ao lado do navio e pilhas de carga junto deles (não espalhadas)
  for (const t of [-8.5, 26.5]) { const p = H(q - 2.6, t), K = new Kit(), wd = M.darkWood(); K.box(0.6, 7, 0.6, wd, 0, 3.5, 0); K.box(0.45, 0.45, 6, wd, 0, 6.8, 2.2, 0, 0.35); K.box(0.3, 3.4, 0.3, wd, 0, 5, 1.4, 0, -0.6); K.add(new THREE.CylinderGeometry(0.02, 0.02, 4, 6), M.rope(), 0, 4.6, 4.8); K.box(1.0, 0.8, 1.0, M.wood(), 0, 2.2, 4.8);
    put(ctx, K, 'guindaste_do_cais', p.x, p.z, YAW_SEA, { box: [[0, 0, 0.5, 0.5]], occ: false });
    for (let k = 0; k < 4; k++) { const cp = at(q - 5.2 - (k % 2) * 1.0, t + (t < 0 ? -1.6 : 1.6) + Math.floor(k / 2) * (t < 0 ? -1.1 : 1.1)); ctx.place(['crate_A', 'crate_B', 'barrel', 'crate_A'][k], cp.x, cp.z, { rf: 0.6 }); } }
  // 10) mesa da capitania (registro dos navios) junto da prancha
  { const p = H(q - 3.4, gangT - 3.2), K = new Kit(); K.box(1.5, 0.9, 0.7, M.darkWood(), 0, 0.45, 0); K.box(1.6, 0.06, 0.8, M.wood(), 0, 0.92, 0); K.box(0.5, 0.04, 0.35, plain('ledger', '#e6d6a8', { rough: 1 }), -0.2, 0.96, 0.05, 0.1); K.cyl(0.1, 0.12, 0.28, M.glass(), 0.5, 1.08, 0, 8);
    put(ctx, K, 'mesa_da_capitania', p.x, p.z, YAW_SEA, { box: [[0, 0, 0.8, 0.4]], occ: false }); }
  // 11) coqueiros: nas praias das pontas, atrás do passeio e em volta da praça (sem cair em cima de casa)
  { const spots = [], tries = rngOf(777); const blocked = (s, t) => houses.some(h => Math.abs(s - h.s) < h.d / 2 + 2.2 && Math.abs(t - h.t) < h.w / 2 + 2.2) || (Math.abs(t - 60) < 4 && s > q - 2) || (s > q - 12 && s < q + 1 && Math.abs(t) < 66);
    for (let k = 0; k < 400 && spots.length < 36; k++) { const zone = k % 3, s = zone === 0 ? q - 4 - tries() * 22 : zone === 1 ? -4 + tries() * 22 : q - 24 + tries() * 10, t = zone === 0 ? (tries() < 0.5 ? -1 : 1) * (74 + tries() * 40) : zone === 1 ? (tries() < 0.5 ? -1 : 1) * (14 + tries() * 50) : (tries() - 0.5) * 30;
      if (blocked(s, t) || spots.some(([a, b]) => Math.hypot(a - s, b - t) < 5)) continue; const p = at(s, t); if (seaDist(p.x, p.z) < 2) continue; spots.push([s, t]); }
    spots.forEach(([s, t], i) => { const p = H(s, t); put(ctx, palmTree(300 + i), 'palmeira', p.x, p.z, 0, { box: [[0, 0, 0.3, 0.3]], occ: false }); }); }
  // 12) NPCs do porto, cada um no seu lugar (S-217)
  const W = (n, s, t, yaw, y) => { const p = H(s, t), npc = ctx.worldNpc(n, p.x, p.z, yaw); if (y !== undefined) npc.obj.position.y = y; return npc; };
  W({ id: 'marinha', name: 'Capitã Marinha', title: 'Mestre do Porto', model: 'Knight', show: ['1H_Sword'], look: { race: 'humano', sex: 'f', face: 'valente', hair: { style: 'longo', color: 'castanho_escuro' }, skin: 'escura' },
    lines: 'Bem-vindo ao Porto das Gaivotas! Todo navio que atraca aqui passa pelo meu livro de registro.\nA Gaivota Dourada está aberta para visitas: suba pela prancha e desça pela escotilha para conhecer o porão.' }, q - 4.4, gangT - 3.2, YAW_SEA);
  W({ id: 'iara', name: 'Iara', title: 'Peixeira', model: 'Rogue', show: ['Knife'], shopList: 'geral', shopTitle: '🐟 Mercado do Porto', look: { race: 'humano', sex: 'f', face: 'alegre', hair: { style: 'coque', color: 'preto' }, skin: 'escura' },
    hello: 'Peixe fresquinho do dia, no gelo! Pescada, robalo, sardinha... e compro o que você trouxer da estrada!' }, q - 10.4, fishT[1], YAW_SEA);
  W({ id: 'joca', name: 'Joca', title: 'Pescador', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'grisalho' }, beard: true },
    lines: 'Hoje o mar tá generoso! Peguei um peixe-lua deste tamanho... tá bom, deste tamanho.' }, q - 10.4, fishT[3], YAW_SEA);
  W({ id: 'nilo', name: 'Nilo', title: 'Marujo da Gaivota Dourada', model: 'Rogue', show: ['Knife_Offhand'], look: { race: 'humano', face: 'astuto', hair: { style: 'careca', color: 'preto' }, skin: 'escura' },
    lines: 'Já vi uma serpente do mar maior que este navio! Ninguém acredita em mim...' }, sc + 2.0, tc + 5.6, YAW_T + Math.PI, DY);
  W({ id: 'baltazar', name: 'Capitão Baltazar', title: 'Capitão da Gaivota Dourada', model: 'Knight', show: ['1H_Sword'], look: { race: 'humano', face: 'valente', hair: { style: 'longo', color: 'ruivo' }, beard: true },
    lines: 'Bem-vindo a bordo da Gaivota Dourada! Ela volta do oriente a cada lua cheia, com o porão cheio.\nDesça pela escotilha: a Odete cuida da carga, o Bóris do caldeirão e a Ilka das cartas de navegação.' }, sc, tc - SHIP.len / 2 + 7.0, YAW_T, DY);
  W({ id: 'tico_p', name: 'Tico', title: 'Grumete', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'loiro' } },
    lines: 'Eu esfrego o convés toda manhã! Um dia ainda vou ser capitão.' }, sc - 1.6, tc - 3.5, YAW_T + Math.PI / 2, DY);
  return { yawSea: YAW_SEA, ship: { s: sc, t: tc }, hold };
}
// farol listrado de pedra (base larga, galeria de ferro, lanterna de vidro iluminada, cúpula de cobre, porta)
function lighthouseKit() {
  const K = new Kit(), H = 18;
  K.add(new THREE.CylinderGeometry(3.0, 3.6, 1.2, 28), M.greyStone(), 0, 0.6, 0);
  for (let k = 0; k < 6; k++) { const y0 = 1.2 + k * H / 6, t0 = k / 6, t1 = (k + 1) / 6; K.add(new THREE.CylinderGeometry(2.5 - t1 * 0.9, 2.5 - t0 * 0.9, H / 6, 28), k % 2 ? plain('lhRed', '#a8322a', { rough: 0.7 }) : M.plaster(), 0, y0 + H / 12, 0); }
  for (let k = 0; k < 3; k++) K.box(0.5, 0.8, 0.08, M.glass(), 0, 5 + k * 5, -(2.3 - (5 + k * 5) / H * 0.85)); // janelinhas da escada
  K.cyl(2.1, 1.9, 0.4, M.iron(), 0, H + 1.4, 0, 28); K.add(new THREE.TorusGeometry(2.0, 0.05, 6, 32), M.iron(), 0, H + 2.4, 0, 0, Math.PI / 2);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; K.cyl(0.04, 0.04, 1.0, M.iron(), Math.cos(a) * 2.0, H + 2.0, Math.sin(a) * 2.0, 6); }
  K.cyl(1.05, 1.05, 2.2, plain('lhGlass', '#fff3c8', { emissive: '#ffd27a', ei: 1.8, rough: 0.1 }), 0, H + 2.7, 0, 20);
  K.add(new THREE.ConeGeometry(1.45, 1.8, 20), M.copper(), 0, H + 4.7, 0);
  K.box(1.1, 2.0, 0.2, M.wood(), 0, 2.2, 2.42); K.box(1.4, 0.18, 0.3, M.greyStone(), 0, 3.3, 2.45);
  return K;
}

/* ---------------- bairro dos mercadores (S-175): guilda, armazéns e a rua das bancas ---------------- */
function warehouse(seed) {
  const K = new Kit(), r = rngOf(seed), w = 12 + r() * 4, d = 9, h = 6.5, st = M.greyStone(), wd = M.darkWood();
  K.box(w + 0.6, 1, d + 0.6, st, 0, 0, 0); K.box(w, h, d, st, 0, 0.5 + h / 2, 0); for (const sx of [-1, 1]) K.box(0.6, h, 0.6, M.wood(), sx * w / 2, 0.5 + h / 2, d / 2);
  gable(K, w + 0.4, d + 0.4, 3.2, M.clay(), 0, 0.5 + h, 0, 0, 0.5);
  K.box(4.2, 4.6, 0.25, wd, 0, 2.8, d / 2 + 0.05); for (let k = -1; k <= 1; k++) K.box(4.2, 0.18, 0.3, M.iron(), 0, 1.6 + (k + 1) * 1.4, d / 2 + 0.1); // portão de carga
  K.box(1.6, 0.25, 0.4, wd, 0, h + 0.2, d / 2 + 0.6); K.box(0.25, 0.25, 2.2, wd, 0, h + 0.4, d / 2 + 1.2); // viga do guincho
  K.add(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), M.rope(), 0, h - 1, d / 2 + 2.2);
  for (let k = 0; k < 6; k++) K.box(1.0, 1.0, 1.0, M.wood(), (k % 3 - 1) * 1.1 + 3.5, 0.5 + Math.floor(k / 3) * 1.0, d / 2 + 1.4, r() * 0.2); // caixas empilhadas
  for (let k = 0; k < 3; k++) K.add(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), M.wood(), -3.8 + k * 0.9, 0.5, d / 2 + 1.3);
  K.box(3.0, 0.7, 0.12, plain('whSign', '#2a1e14'), -3.5, h - 0.4, d / 2 + 0.07);
  return { K, box: [[0, 0, w / 2 + 0.3, d / 2 + 0.3]] };
}
function guildHall() {
  const K = new Kit(), st = M.sandStone(), mar = M.marble(), wd = M.darkWood();
  K.box(22, 1.2, 16, M.greyStone(), 0, 0.2, 0); for (let k = 0; k < 4; k++) K.box(12 - k * 0.6, 0.35, 1.2, mar, 0, 0.18 + k * 0.35, 8.6 + 2.6 - k * 0.6); // escadaria
  K.box(20, 9, 14, st, 0, 5.2, 0); K.box(21, 0.8, 15, mar, 0, 9.9, 0);
  for (let k = 0; k < 6; k++) { const x = -7.5 + k * 3; K.cyl(0.55, 0.62, 8.6, mar, x, 5.0, 7.6, 16); K.box(1.5, 0.5, 1.5, mar, x, 9.4, 7.6); K.box(1.5, 0.5, 1.5, mar, x, 0.95, 7.6); } // pórtico de colunas
  { const sh = new THREE.Shape(); sh.moveTo(-10.5, 0); sh.lineTo(10.5, 0); sh.lineTo(0, 3.4); sh.closePath(); K.add(new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false }), mar, 0, 10.3, 6.6); } // frontão
  K.add(new THREE.CylinderGeometry(6.4, 6.4, 3, 32), st, 0, 11.8, -1); K.add(new THREE.SphereGeometry(6.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.copper(), 0, 13.3, -1); // cúpula de cobre
  K.cyl(0.6, 0.8, 2.2, M.gold(), 0, 20.6, -1, 12); K.add(new THREE.SphereGeometry(0.7, 16, 12), M.gold(), 0, 22.1, -1);
  K.box(3.4, 5.4, 0.3, wd, 0, 3.6, 7.05); archBlocks(K, 3.4, 0.6, 0.8, mar, 0, 6.3, 7.0, 0, 11);
  for (const sx of [-1, 1]) for (const yy of [3.5, 7]) K.box(1.6, 2.4, 0.15, M.glass(), sx * 6.5, yy, 7.02);
  return K;
}
function marketStall(seed, kind) {
  const K = new Kit(), r = rngOf(seed), wd = M.wood(), cols = ['#b8322a', '#2e6aa8', '#d8a020', '#3a8a4a', '#8a3aa0', '#e07a2a'], awn = plain('awn' + kind, cols[kind % cols.length], { rough: 0.9, side: THREE.DoubleSide }), awn2 = plain('awnW', '#f2ead6', { rough: 0.9, side: THREE.DoubleSide });
  K.box(3.4, 0.95, 1.6, wd, 0, 0.48, 0); K.box(3.7, 0.1, 1.9, M.darkWood(), 0, 0.98, 0);
  for (const sx of [-1.65, 1.65]) for (const sz of [-0.8, 0.8]) K.box(0.12, 2.8, 0.12, M.darkWood(), sx, 1.4, sz);
  for (let k = 0; k < 6; k++) K.box(0.62, 0.06, 2.4, k % 2 ? awn : awn2, -1.55 + k * 0.62, 2.85, 0.15, 0, -0.22); // toldo listrado
  for (let k = 0; k < 6; k++) K.add(new THREE.PlaneGeometry(0.62, 0.3), k % 2 ? awn : awn2, -1.55 + k * 0.62, 2.48, 1.32, 0, 0, 0); // franja
  if (kind % 4 === 0) for (let k = 0; k < 5; k++) K.add(new THREE.CylinderGeometry(0.22, 0.26, 0.25, 14), plain('spice' + k, ['#c8501a', '#e0b030', '#7a3a1a', '#3a6a2a', '#a0281e'][k], { rough: 1 }), -1.3 + k * 0.65, 1.16, 0.1); // especiarias em tigelas
  else if (kind % 4 === 1) for (let k = 0; k < 4; k++) K.add(new THREE.CylinderGeometry(0.18, 0.42, 0.9, 14, 1), plain('rug' + k, ['#8a2a1e', '#2a4a8a', '#c89a2a', '#4a2a6a'][k], { rough: 1 }), -1.2 + k * 0.8, 1.45, -0.3, 0, Math.PI / 2, 0.2); // tapetes enrolados
  else if (kind % 4 === 2) for (let k = 0; k < 6; k++) K.add(new THREE.LatheGeometry([[0.01, 0], [0.16, 0.02], [0.22, 0.18], [0.12, 0.36], [0.09, 0.44], [0.12, 0.48]].map(([a, b]) => new THREE.Vector2(a, b)), 14), plain('pot', '#b8673a', { rough: 0.8 }), -1.4 + k * 0.55, 1.03, (k % 2) * 0.3 - 0.15); // cerâmica
  else for (let k = 0; k < 5; k++) K.box(0.6, 0.12 + (k % 3) * 0.05, 0.9, plain('cloth' + k, cols[(k + 2) % cols.length], { rough: 1 }), -1.3 + k * 0.65, 1.1, 0); // tecidos dobrados
  return K;
}
export function buildMerchants(ctx) {
  // s < 0 = para dentro da cidade (atrás das casas); t = ao longo da orla
  const H = (s, t) => { const p = at(s, t); return { x: p.x, z: p.z }; };
  { const p = H(-64, 0); put(ctx, guildHall(), 'guilda_dos_mercadores', p.x, p.z, YAW_SEA, { box: [[0, 0, 11, 8]] });
    for (const sx of [-1, 1]) { const b = makeBanner('guilda', 1.6, 5); const q = H(-64 + 8.1, sx * 5.5); b.position.set(q.x, gY(p.x, p.z) + 9.3, q.z); b.rotation.y = YAW_SEA; ctx.scene.add(b); } }
  // armazéns na orla, com o portão de carga virado para o cais
  [[-46, -4], [46, -4], [-56, -18], [56, -18]].forEach(([t, s], i) => { const p = H(s, t), { K, box } = warehouse(300 + i); put(ctx, K, 'armazem', p.x, p.z, YAW_SEA + (t < 0 ? 0.12 : -0.12), { box }); });
  // rua das bancas: duas fileiras de frente uma para a outra, com a rua no meio (s ≈ -43)
  for (let k = 0; k < 10; k++) { const t = -22 + (k % 5) * 11, s = k < 5 ? -48 : -38, p = H(s, t); put(ctx, marketStall(500 + k, k), 'banca_do_mercado', p.x, p.z, YAW_SEA + (k < 5 ? 0 : Math.PI), { box: [[0, 0, 1.8, 0.9]] }); }
  // mercadores: cada um atrás da sua banca, de frente para a rua; o mestre da guilda no alto da escadaria
  const W = (n, s, t, yaw) => { const p = H(s, t); ctx.worldNpc(n, p.x, p.z, yaw); };
  W({ id: 'aurelio', name: 'Aurélio Vasconde', title: 'Mestre da Guilda dos Mercadores', model: 'Mage', show: ['Mage_Cape'], look: { race: 'humano', face: 'sabio', hair: { style: 'curto', color: 'grisalho' }, beard: true },
    lines: 'Todo navio que entra no Porto das Gaivotas paga à Guilda — e todo mercador honesto ganha com isso.\nQuer vender em grande? Traga drops raros: os compradores de além-mar pagam bem por presas, cristais e escamas.' }, -64 + 9.3, 1.6, YAW_SEA);
  W({ id: 'fabio', name: 'Fábio', title: 'Cambista da Guilda', model: 'Rogue', look: { race: 'humano', face: 'astuto', hair: { style: 'curto', color: 'castanho_escuro' } },
    lines: 'Zeny, ouro de além-mar, pedras preciosas... eu troco tudo. Com uma pequena taxa, é claro.' }, -64 + 9.3, -2.2, YAW_SEA);
  W({ id: 'zaira', name: 'Zaíra', title: 'Mercadora de Especiarias', model: 'Rogue', shopList: 'geral', shopTitle: '🌶️ Especiarias de Zaíra', look: { race: 'humano', sex: 'f', face: 'astuto', hair: { style: 'longo', color: 'preto' }, skin: 'escura' },
    hello: 'Pimenta-de-fogo das dunas, sal rosado, canela do outro lado do mar! Cheire, cheire...' }, -49.3, -22, YAW_SEA);
  W({ id: 'tadeu', name: 'Tadeu', title: 'Vendedor de Tapetes', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'careca', color: 'castanho' }, beard: true },
    lines: 'Este aqui foi tecido por noventa dias! Para você, um preço de amigo. Para o meu amigo, um preço de irmão.' }, -49.3, -11, YAW_SEA);
  W({ id: 'cora', name: 'Cora', title: 'Oleira', model: 'Barbarian', show: ['Mug'], look: { race: 'humano', sex: 'f', face: 'gentil', hair: { style: 'coque', color: 'castanho' } },
    lines: 'Barro do rio, fogo do forno e paciência. Cada jarro tem o meu polegar marcado no fundo.' }, -49.3, 0, YAW_SEA);
  W({ id: 'selene', name: 'Selene', title: 'Mercadora de Tecidos', model: 'Mage', look: { race: 'elfo', sex: 'f', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
    lines: 'Seda élfica de Aelindra e lã das montanhas dos anões. No porto, todas as raças fazem negócio.' }, -36.7, 11, YAW_SEA + Math.PI);
  W({ id: 'fenn_vis', name: 'Fenn', title: 'Elfo comerciante de sal', model: 'Rogue_Hooded', look: { race: 'elfo', face: 'sereno', hair: { style: 'longo', color: 'platinado' } },
    lines: 'O sal daqui é o mais puro de Aethra. Levo para Aelindra, onde vira tinta para os estandartes.' }, -36.7, -11, YAW_SEA + Math.PI);
  W({ id: 'dolf', name: 'Dolf', title: 'Estivador', model: 'Barbarian', show: ['1H_Axe'], look: { race: 'anao', face: 'alegre', hair: { style: 'raspado', color: 'preto' }, beard: true },
    lines: 'Caixa pra cá, barril pra lá. Anão no porto? Ora, alguém tem que carregar o peso!' }, HARBOR.quay - 4.0, 24.4, YAW_SEA + Math.PI / 2);
}
