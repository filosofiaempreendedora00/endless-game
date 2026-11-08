/* =========================================================================
   MONTARIAS — feitas em código. Corcel Lanudo: um bicho de montaria robusto,
   meio cavalo, meio carneiro, com lã fofa e chifres enrolados.
   makeMount(kind) devolve { obj, animate(t, {speed, turn}, dt), saddleY }.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export const MOUNTS = {
  // S-242: cavalos de verdade (coat = pelagem, points = canelas/"meias", muzzle = focinho). wool/horn ficam para as amostras da loja.
  lanudo: { name: 'Corcel Creme', desc: 'Pelagem creme e crina clara: calmo, forte e confiável.', coat: '#e6d8bc', points: '#8a7a64', muzzle: '#6a5a4a', wool: '#e6d8bc', skin: '#8a6a4a', horn: '#d8c9a8', mane: '#efe6d0', blanket: '#b8403a' },
  noturno: { name: 'Corcel da Noite', desc: 'Pelagem negra azulada com crina que brilha em azul.', coat: '#2a2a36', points: '#121218', muzzle: '#1a1a22', wool: '#2a2a36', skin: '#22202a', horn: '#9aa6c8', mane: '#5ab0ff', blanket: '#2f4f9a', glow: true },
  real: { name: 'Corcel Real', premium: true, price: 900, rarity: 'epica', desc: 'Branco tordilho como nuvem e crina dourada que brilha.', coat: '#f2f0ea', points: '#c8c4bc', muzzle: '#8a8078', dapple: true, socks: 0.3, wool: '#f2f0ea', skin: '#c9b48a', horn: '#ffd76a', mane: '#ffd76a', blanket: '#6a2a8a', glow: true },
  estelar: { name: 'Corcel Estelar', premium: true, price: 1800, rarity: 'lendaria', desc: 'Pelagem azul-noite e crina de luz violeta: deixa o céu com inveja.', coat: '#232a52', points: '#10142c', muzzle: '#141830', wool: '#232a52', skin: '#141830', horn: '#cfd8ff', mane: '#b47aff', blanket: '#2a3a8a', glow: true },
  ruivo: { name: 'Corcel Ruivo', desc: 'Alazão cor de canela, cheio de energia.', coat: '#b8642e', points: '#3a2014', muzzle: '#4a2a1a', wool: '#b8642e', skin: '#6a3a22', horn: '#efd9a8', mane: '#6a2a12', blanket: '#3f7a3a' },
  // S-136: grandes felinos (premium) — anatomia de felino de verdade, pelagem fina pintada (sem "espinhos")
  // S-243: no lugar do leopardo (mesmo id, para quem já comprou), um tigre siberiano
  leopardo: { name: 'Tigre Siberiano', premium: true, price: 1500, rarity: 'epica', cat: 'tigre', desc: 'Tigre enorme das neves do norte: laranja-queimado com listras negras, peito e rosto brancos e costeletas de pelo.', wool: '#d9772a', skin: '#17100b', horn: '#f7f1e6', mane: '#17100b', blanket: '#7a1f2a' },
  pantera_neve: { name: 'Pantera da Geada', premium: true, price: 1500, rarity: 'epica', cat: 'neve', desc: 'Pelagem cinza-gelo com rosetas de carvão e cauda longa e felpuda, nascida no Vale da Geada.', wool: '#d8d8d2', skin: '#3a3a40', horn: '#f4f4ee', mane: '#4a4a52', blanket: '#2a4a7a' },
  trotavento: { name: 'Trotavento', premium: true, price: 1200, rarity: 'rara', bird: 'trotavento', desc: 'Ave corredora das Dunas de Sal-Rubro: penas douradas, topete vermelho e pernas que não cansam. Não voa, mas ninguém a alcança.', wool: '#e8b648', skin: '#d98a3a', horn: '#f08a1e', mane: '#d8502a', blanket: '#2a5a7a' },
  leao: { name: 'Leão Solar', premium: true, price: 2400, rarity: 'lendaria', cat: 'leao', desc: 'Leão imponente de juba dourada que brilha ao sol: o rei das montarias.', wool: '#c99a5a', skin: '#3a2618', horn: '#ffd76a', mane: '#8a4a1e', blanket: '#5a2a8a', glow: true },
};
export const MOUNT_SPEED = 1.7; // multiplicador de velocidade montado

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// tubo afinando ao longo de uma curva (pescoço, rabo, mechas)
function taper(points, r0, r1, seg = 20, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const P = g.attributes.position, N = g.attributes.normal, frames = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, r = r0 + (r1 - r0) * u, c = curve.getPointAt(u);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; P.setXYZ(k, c.x + N.getX(k) * r, c.y + N.getY(k) * r, c.z + N.getZ(k) * r); }
  }
  g.computeVertexNormals(); return g;
}
const blob = (r, sx, sy, sz, m, x, y, z, seg = 18) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o; };

export function makeMount(kind = 'lanudo') {
  const D = MOUNTS[kind] || MOUNTS.lanudo;
  if (D.cat) return makeBigCat(D);
  if (D.bird) return makeRunnerBird(D);
  return makeHorse(D); // S-242: cavalo de verdade (o modelo antigo de "carneiro" fica em makeOldMount)
}
function makeOldMount(D) {
  const obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  const coatC = new THREE.Color(D.wool);
  const COAT = M(coatC, { roughness: 0.65 }), BELLY = M(coatC.clone().offsetHSL(0, -0.05, 0.06), { roughness: 0.7 });
  const WOOL = M(coatC.clone().offsetHSL(0, -0.05, 0.1), { roughness: 0.95 }), SKIN = M(D.skin, { roughness: 0.55 }), HORN = M(D.horn, { roughness: 0.4 });
  const MANE = D.glow ? new THREE.MeshStandardMaterial({ color: D.mane, emissive: D.mane, emissiveIntensity: 0.7, roughness: 0.5 }) : M(D.mane, { roughness: 0.75 });
  const LEATHER = M('#5a3a22', { roughness: 0.55 }), DARK = M('#2a1e16', { roughness: 0.5 }), METAL = M('#c9b07a', { roughness: 0.3, metalness: 0.6 });
  // tronco: peito, barril e garupa formam um corpo de cavalo
  body.add(blob(0.36, 1, 1.05, 1.55, COAT, 0, 1.12, 0, 24));
  body.add(blob(0.38, 1, 1.08, 1, COAT, 0, 1.12, 0.52));
  body.add(blob(0.4, 1.05, 1.05, 1, COAT, 0, 1.17, -0.5));
  body.add(blob(0.3, 1, 0.7, 1.6, BELLY, 0, 0.92, 0));
  // pescoço comprido e arqueado + gola de lã (a marca dos Corcéis Lanudos)
  const neck = new THREE.Group(); neck.position.set(0, 1.3, 0.72); body.add(neck);
  neck.add(new THREE.Mesh(taper([V(0, 0, -0.05), V(0, 0.28, 0.14), V(0, 0.58, 0.27), V(0, 0.78, 0.33)], 0.27, 0.15), COAT));
  const wool = new THREE.IcosahedronGeometry(0.11, 2);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const t = new THREE.Mesh(wool, WOOL); t.position.set(Math.cos(a) * 0.2, 0.1 + Math.sin(a) * 0.1, Math.sin(a) * 0.08 + 0.04); t.scale.setScalar(0.7 + (i % 3) * 0.12); neck.add(t); }
  // cabeça alongada com focinho, narinas, olhos, orelhas e chifrinhos
  const head = new THREE.Group(); head.position.set(0, 0.8, 0.36); neck.add(head);
  head.add(blob(0.17, 1, 1.05, 1.25, COAT, 0, 0.02, 0));
  const muzzle = new THREE.Mesh(taper([V(0, 0, 0.05), V(0, -0.1, 0.25), V(0, -0.2, 0.42)], 0.15, 0.11, 10, 14), COAT); head.add(muzzle);
  head.add(blob(0.12, 1.05, 0.85, 0.9, SKIN, 0, -0.21, 0.43));
  for (const s of [-1, 1]) {
    head.add(blob(0.022, 1.2, 1, 0.6, DARK, s * 0.055, -0.19, 0.53, 8));
    head.add(blob(0.042, 1, 1.15, 0.6, DARK, s * 0.13, 0.05, 0.1, 12));
    head.add(blob(0.013, 1, 1, 0.6, M('#ffffff', { roughness: 0.2 }), s * 0.145, 0.07, 0.125, 6));
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 14), COAT); ear.position.set(s * 0.09, 0.2, -0.05); ear.rotation.set(-0.2, 0, -s * 0.2); head.add(ear);
    const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10, a = u * Math.PI * 1.3; pts.push(V(s * (0.12 + Math.sin(a) * 0.09), 0.15 + Math.cos(a) * 0.09 - u * 0.03, -0.08 - u * 0.08)); }
    head.add(new THREE.Mesh(taper(pts, 0.035, 0.012, 14, 8), HORN));
  }
  // crina em mechas ao longo do pescoço + topete
  const maneParts = [];
  for (let i = 0; i < 8; i++) { const u = i / 7, y = 0.05 + u * 0.78, z = -0.08 + u * 0.4; const m = new THREE.Mesh(taper([V(0, 0, 0), V(0.04, -0.08, -0.1), V(0.07, -0.2, -0.12)], 0.06, 0.012, 8, 8), MANE); m.position.set(0, y + 0.06, z - 0.08); neck.add(m); maneParts.push(m); }
  const forelock = new THREE.Mesh(taper([V(0, 0, 0), V(0, -0.05, 0.08), V(0, -0.14, 0.12)], 0.05, 0.012, 8, 8), MANE); forelock.position.set(0, 0.2, 0.02); head.add(forelock);
  // patas: coxa, joelho, canela, tufo de lã e casco
  const legs = [[-0.2, 0.55, true], [0.2, 0.55, true], [-0.21, -0.55, false], [0.21, -0.55, false]].map(([x, z, front]) => {
    const pv = new THREE.Group(); pv.position.set(x, 1.0, z); body.add(pv);
    pv.add(new THREE.Mesh(taper([V(0, 0.1, 0), V(0, -0.2, front ? 0.02 : -0.04), V(0, -0.46, 0)], front ? 0.14 : 0.16, 0.08, 10, 12), COAT));
    const knee = new THREE.Group(); knee.position.y = -0.46; pv.add(knee);
    knee.add(new THREE.Mesh(taper([V(0, 0, 0), V(0, -0.22, 0), V(0, -0.4, 0.01)], 0.065, 0.05, 8, 10), COAT));
    const tuft = blob(0.085, 1.1, 0.8, 1.1, WOOL, 0, -0.38, 0.01, 12); knee.add(tuft);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.1, 16), DARK); hoof.position.y = -0.49; knee.add(hoof);
    return { pv, knee, front, side: x > 0 ? 1 : -1 };
  });
  // rabo esvoaçante em mechas
  const tail = new THREE.Group(); tail.position.set(0, 1.3, -0.9); body.add(tail);
  for (let i = 0; i < 5; i++) { const sx = (i - 2) * 0.03; tail.add(new THREE.Mesh(taper([V(0, 0, 0), V(sx, -0.15, -0.15), V(sx * 2, -0.45, -0.22), V(sx * 3, -0.75, -0.18)], 0.07 - i * 0.004, 0.015, 14, 8), MANE)); }
  // sela, manta caída nos lados, estribos
  const blanketC = new THREE.Color(D.blanket);
  const blanket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.78, 28, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshStandardMaterial({ color: blanketC, roughness: 0.8, side: THREE.DoubleSide }));
  blanket.rotation.x = Math.PI / 2; blanket.rotation.y = Math.PI; blanket.scale.set(1, 1, 1); blanket.position.set(0, 1.12, -0.02); body.add(blanket);
  const trim = new THREE.MeshStandardMaterial({ color: '#e8c35a', roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  for (const zz of [-0.4, 0.36]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.012, 10, 28, Math.PI * 0.84), trim); t.rotation.z = Math.PI / 2 - Math.PI * 0.42 + Math.PI; t.rotation.y = 0; t.position.set(0, 1.12, zz); body.add(t); }
  const seat = new THREE.Mesh(taper([V(0, 0, -0.3), V(0, -0.04, -0.05), V(0, -0.02, 0.15), V(0, 0.06, 0.28)], 0.2, 0.13, 12, 14), LEATHER); seat.scale.set(1.15, 0.45, 1); seat.position.set(0, 1.52, 0); body.add(seat);
  body.add(blob(0.08, 1, 1.3, 0.8, LEATHER, 0, 1.6, 0.3, 12));
  body.add(blob(0.13, 1.4, 0.7, 0.6, LEATHER, 0, 1.56, -0.28, 12));
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.04), LEATHER); strap.position.set(s * 0.38, 1.25, 0.04); strap.rotation.z = s * 0.12; body.add(strap);
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 10, 28), METAL); st.position.set(s * 0.42, 0.98, 0.04); body.add(st);
  }
  let light = null;
  if (D.glow) { light = vlight(D.mane, 0.8, 4); light.position.set(0, 1.9, 0.6); obj.add(light); }
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  let ph = 0, gait = 0, look = 0, air = 0, pitch = 0;
  return {
    obj, saddleY: 1.52, name: D.name,
    animate(t, m, dt) {
      const s = m.speed;
      gait += (Math.min(1, s * 1.3) - gait) * (1 - Math.exp(-dt * 6));
      air += ((m.air ? 1 : 0) - air) * (1 - Math.exp(-dt * 10));
      ph += dt * (2 + s * 9);
      legs.forEach(({ pv, knee, front, side }) => {
        const p = ph + (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0); // trote: diagonais juntas
        // no salto: dianteiras dobradas sob o peito, traseiras esticadas para trás
        pv.rotation.x = Math.sin(p) * 0.5 * gait * (1 - air) + (front ? -0.95 : 0.75) * air;
        knee.rotation.x = (front ? 1 : -1) * Math.max(0, Math.cos(p)) * 0.9 * gait * (1 - air) + (front ? 1.9 : -0.25) * air;
      });
      body.position.y = Math.abs(Math.sin(ph)) * 0.06 * gait * (1 - air) + Math.sin(t * 1.6) * 0.008 * (1 - gait);
      pitch += ((m.air ? (m.vy > 0 ? 0.16 : -0.14) : 0) - pitch) * (1 - Math.exp(-dt * 7)); // sobe de nariz e desce de nariz
      body.rotation.x = Math.sin(ph * 2) * 0.025 * gait + pitch;
      body.rotation.z = -m.turn * 0.05 * gait;
      look += ((gait > 0.2 ? -m.turn * 0.12 : Math.sin(t * 0.45) * 0.3) - look) * (1 - Math.exp(-dt * 4));
      neck.rotation.y = look; neck.rotation.x = Math.sin(ph * 2) * 0.05 * gait + (1 - gait) * Math.sin(t * 0.7) * 0.04 + air * 0.15;
      head.rotation.x = -Math.sin(ph * 2) * 0.04 * gait;
      maneParts.forEach((mp, i) => { mp.rotation.z = Math.sin(t * 3 + i * 0.6) * 0.15 * (0.3 + gait); mp.rotation.x = 0.3 * gait; });
      tail.rotation.y = Math.sin(t * (1.5 + s * 4)) * 0.25; tail.rotation.x = 0.5 * gait + air * 0.6;
      if (light) light.intensity = 0.7 + Math.sin(t * 3) * 0.15;
    },
    get bodyY() { return body.position.y; },
  };
}

/* =========================================================================
   GRANDES FELINOS (S-136): Leopardo das Dunas, Pantera da Geada e Leão Solar.
   O corpo é UMA malha orgânica só: gerada de um campo de distância (cápsulas e elipsoides
   unidos suavemente, como argila) e transformada em superfície ("surface nets"). Nada de peças
   coladas: ombro, coxa, pescoço e cabeça se fundem como num animal de verdade.
   A malha tem esqueleto (pele presa aos ossos por proximidade), então as patas, o pescoço e a
   cabeça se mexem dobrando a pele. A pelagem é pintada no próprio material, em 3D: rosetas de
   leopardo, barriga e focinho claros e fios finos (nada de "espinhos").
   ========================================================================= */
const CAT = {
  leopardo: { base: '#d6a052', belly: '#f2e4c8', spot: '#24170e', inner: '#b0702a', spots: 1, eye: '#e2a52a', nose: '#7a443a' },
  tigre: { base: '#d9772a', belly: '#f7f1e6', spot: '#17100b', inner: '#d9772a', spots: 2, eye: '#e8b43a', nose: '#c88a7a', tail: 1.15 },
  neve: { base: '#c9c8c2', belly: '#f1f0ea', spot: '#34343a', inner: '#9a9a96', spots: 1, eye: '#a8d2dc', nose: '#5a4a50', tail: 1.45, freq: 6.2 },
  leao: { base: '#c99656', belly: '#ead6ac', spot: null, inner: '#c99656', spots: 0, eye: '#d8982a', nose: '#5a3a30', mane: '#7a3e18', mane2: '#b06a2a' },
};
// ---- campo de distância ----
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function sdCaps(px, py, pz, P) { // cápsula com raio variando de r0 a r1
  const [ax, ay, az] = P.a, [bx, by, bz] = P.b, bax = bx - ax, bay = by - ay, baz = bz - az, pax = px - ax, pay = py - ay, paz = pz - az;
  const t = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return len3(pax - bax * t, pay - bay * t, paz - baz * t) - (P.r0 + (P.r1 - P.r0) * t);
}
function sdEll(px, py, pz, P) {
  const [cx, cy, cz] = P.c, [rx, ry, rz] = P.r, x = px - cx, y = py - cy, z = pz - cz;
  const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
const sdPrim = (x, y, z, P) => (P.a ? sdCaps(x, y, z, P) : sdEll(x, y, z, P));
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
// partes do felino (metros, frente = +z). b = osso dono da parte
function catParts(kind) {
  const P = [], C = (a, b, r0, r1, bone, k = 0.07) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.07) => P.push({ c, r, bone, k });
  // tronco
  E([0, 0.99, -0.7], [0.27, 0.27, 0.27], 'hips');
  C([0, 1.0, -0.66], [0, 1.0, -0.15], 0.25, 0.225, 'hips');
  C([0, 1.0, -0.15], [0, 0.97, 0.38], 0.225, 0.27, 'chest');
  E([0, 0.9, 0.32], [0.24, 0.3, 0.3], 'chest');
  E([0, 0.83, -0.08], [0.2, 0.17, 0.32], 'hips', 0.12); // barriga
  // pescoço e cabeça
  C([0, 1.0, 0.5], [0, 1.16, 0.8], 0.21, 0.155, 'neck');
  E([0, 1.04, 0.62], [0.2, 0.22, 0.2], 'neck'); // papada/peito do pescoço
  E([0, 1.24, 0.96], [0.165, 0.145, 0.17], 'head', 0.06);
  E([0, 1.165, 1.1], [0.115, 0.09, 0.105], 'head', 0.05); // focinho
  E([0, 1.12, 1.07], [0.07, 0.045, 0.07], 'head', 0.04);  // queixo
  for (const s of [-1, 1]) {
    E([s * 0.11, 1.17, 0.96], [0.09, 0.08, 0.09], 'head', 0.05); // bochecha
    E([s * 0.105, 1.375, 0.9], [0.06, 0.066, 0.026], 'head', 0.03); // orelha
    E([s * 0.04, 1.16, 1.175], [0.05, 0.042, 0.045], 'head', 0.03); // almofada dos bigodes
    // pata da frente (S-243): escápula inclinada, cotovelo marcado para trás, antebraço musculoso que afina até o punho,
    // punho (carpo), mão levemente inclinada para a frente e pata larga com dedos e almofadas
    const th = kind === 'tigre' ? 1.12 : 1; // tigre: patas mais grossas e pesadas
    E([s * 0.15, 0.98, 0.43], [0.085 * th, 0.21, 0.15], 'up' + s, 0.08);
    C([s * 0.16, 0.9, 0.44], [s * 0.155, 0.63, 0.32], 0.125 * th, 0.095 * th, 'up' + s, 0.07);   // braço desce para trás até o cotovelo
    E([s * 0.155, 0.62, 0.28], [0.06 * th, 0.07, 0.07], 'up' + s, 0.05);                          // ponta do cotovelo
    C([s * 0.155, 0.62, 0.34], [s * 0.15, 0.2, 0.41], 0.092 * th, 0.058 * th, 'fo' + s, 0.05);     // antebraço (grosso em cima, afina)
    E([s * 0.15, 0.48, 0.37], [0.07 * th, 0.12, 0.075 * th], 'fo' + s, 0.06);                      // músculo do antebraço
    E([s * 0.15, 0.17, 0.42], [0.06 * th, 0.05, 0.06 * th], 'pa' + s, 0.03);                       // punho
    C([s * 0.15, 0.16, 0.42], [s * 0.15, 0.07, 0.47], 0.055 * th, 0.06 * th, 'pa' + s, 0.03);      // mão (inclinada para a frente)
    E([s * 0.15, 0.05, 0.49], [0.085 * th, 0.048, 0.1 * th], 'pa' + s, 0.04);                      // pata larga
    for (let q = 0; q < 4; q++) E([s * 0.15 + (q - 1.5) * 0.034 * th, 0.035, 0.56 * 1 + (Math.abs(q - 1.5) < 1 ? 0.012 : 0)], [0.026 * th, 0.028, 0.032], 'pa' + s, 0.015); // dedos
    // pata de trás: coxa grande, joelho para a frente, perna para trás até o jarrete (calcanhar alto e marcado), metatarso quase vertical, pé com dedos
    E([s * 0.14, 0.92, -0.62], [0.12 * th, 0.25, 0.22], 'th' + s, 0.08);
    C([s * 0.15, 0.94, -0.58], [s * 0.155, 0.62, -0.4], 0.14 * th, 0.09 * th, 'th' + s, 0.07);      // coxa até o joelho (para a frente)
    C([s * 0.155, 0.62, -0.42], [s * 0.15, 0.32, -0.72], 0.09 * th, 0.055 * th, 'sh' + s, 0.05);    // perna para trás
    E([s * 0.15, 0.5, -0.56], [0.065 * th, 0.11, 0.08 * th], 'sh' + s, 0.06);                       // panturrilha
    E([s * 0.15, 0.31, -0.76], [0.045 * th, 0.05, 0.05], 'mt' + s, 0.03);                            // calcanhar (jarrete)
    C([s * 0.15, 0.3, -0.72], [s * 0.15, 0.08, -0.66], 0.05 * th, 0.05 * th, 'mt' + s, 0.03);
    E([s * 0.15, 0.05, -0.6], [0.075 * th, 0.045, 0.095 * th], 'mt' + s, 0.04);
    for (let q = 0; q < 4; q++) E([s * 0.15 + (q - 1.5) * 0.03 * th, 0.033, -0.53 + (Math.abs(q - 1.5) < 1 ? 0.01 : 0)], [0.023 * th, 0.025, 0.028], 'mt' + s, 0.015);
    if (kind === 'tigre') E([s * 0.15, 1.13, 0.93], [0.075, 0.095, 0.085], 'head', 0.05); // costeletas (gola de pelo do tigre)
  }
  if (kind === 'leao') { // juba: volume atrás do rosto, com a borda em tufos irregulares (fofa, sem "dreads")
    E([0, 1.2, 0.72], [0.29, 0.33, 0.2], 'neck', 0.1);
    E([0, 1.0, 0.66], [0.25, 0.28, 0.2], 'neck', 0.1);
    let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let q = 0; q < 16; q++) { const a = q / 16 * Math.PI * 2, r = 0.27 + rnd() * 0.05; if (Math.sin(a) < -0.75) continue; E([Math.cos(a) * r, 1.18 + Math.sin(a) * r * 1.1, 0.78 - rnd() * 0.08], [0.08 + rnd() * 0.04, 0.09 + rnd() * 0.05, 0.12], q % 2 ? 'neck' : 'head', 0.06); }
    E([0, 0.86, 0.72], [0.17, 0.16, 0.16], 'neck', 0.08); // juba do peito
  }
  return P;
}
// ossos (posição de repouso) e a hierarquia
const CAT_BONES = { root: [null, [0, 0, 0]], hips: ['root', [0, 1.0, -0.55]], chest: ['hips', [0, 0.98, 0.25]], neck: ['chest', [0, 1.02, 0.55]], head: ['neck', [0, 1.18, 0.86]] };
for (const s of [-1, 1]) Object.assign(CAT_BONES, {
  ['up' + s]: ['chest', [s * 0.16, 0.95, 0.42]], ['fo' + s]: ['up' + s, [s * 0.15, 0.6, 0.36]], ['pa' + s]: ['fo' + s, [s * 0.15, 0.13, 0.42]],
  ['th' + s]: ['hips', [s * 0.15, 0.95, -0.6]], ['sh' + s]: ['th' + s, [s * 0.15, 0.58, -0.44]], ['mt' + s]: ['sh' + s, [s * 0.15, 0.3, -0.72]],
});
// superfície: "surface nets" (um vértice por célula que cruza a superfície, quads entre células vizinhas)
const catGeoCache = {};
function catGeometry(kind) {
  if (catGeoCache[kind]) return catGeoCache[kind];
  return (catGeoCache[kind] = sdfSkinnedGeometry(catParts(kind), CAT_BONES, [-0.5, -0.02, -1.02], [1.0, 1.72, 2.32], 0.022));
}
/* Gera uma malha orgânica (com pele presa a ossos) a partir de partes de um campo de distância
   (cápsulas {a,b,r0,r1,bone,k} e elipsoides {c,r,bone,k}) unidas suavemente: "surface nets".
   Usado pelos felinos, pelo Trotavento e pelos bichos do deserto (critters). bones = { nome: [pai, [x,y,z]] } */
export function sdfSkinnedGeometry(parts, BONES, org, size, H) {
  const [X0, Y0, Z0] = org, NX = Math.ceil(size[0] / H) + 1, NY = Math.ceil(size[1] / H) + 1, NZ = Math.ceil(size[2] / H) + 1;
  const F = new Float32Array(NX * NY * NZ).fill(0.25), id = (i, j, k) => (k * NY + j) * NX + i;
  const field = (x, y, z) => { let d = 0.25; for (const P of parts) d = smin(d, sdPrim(x, y, z, P), P.k); return d; };
  for (const P of parts) {
    const pad = P.k + 0.05, lo = P.a ? [0, 1, 2].map(q => Math.min(P.a[q], P.b[q]) - Math.max(P.r0, P.r1) - pad) : P.c.map((c, q) => c - P.r[q] - pad), hi = P.a ? [0, 1, 2].map(q => Math.max(P.a[q], P.b[q]) + Math.max(P.r0, P.r1) + pad) : P.c.map((c, q) => c + P.r[q] + pad);
    const i0 = Math.max(0, Math.floor((lo[0] - X0) / H)), i1 = Math.min(NX - 1, Math.ceil((hi[0] - X0) / H)), j0 = Math.max(0, Math.floor((lo[1] - Y0) / H)), j1 = Math.min(NY - 1, Math.ceil((hi[1] - Y0) / H)), k0 = Math.max(0, Math.floor((lo[2] - Z0) / H)), k1 = Math.min(NZ - 1, Math.ceil((hi[2] - Z0) / H));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const n = id(i, j, k); F[n] = smin(F[n], sdPrim(X0 + i * H, Y0 + j * H, Z0 + k * H, P), P.k); }
  }
  const vIdx = new Int32Array(NX * NY * NZ).fill(-1), pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    let sx = 0, sy = 0, sz = 0, n = 0, neg = 0;
    for (let c = 0; c < 8; c++) if (F[id(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))] < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    for (const [a, b] of E) {
      const ai = i + (a & 1), aj = j + ((a >> 1) & 1), ak = k + (a >> 2), bi = i + (b & 1), bj = j + ((b >> 1) & 1), bk = k + (b >> 2);
      const fa = F[id(ai, aj, ak)], fb = F[id(bi, bj, bk)]; if ((fa < 0) === (fb < 0)) continue;
      const t = fa / (fa - fb); sx += ai + (bi - ai) * t; sy += aj + (bj - aj) * t; sz += ak + (bk - ak) * t; n++;
    }
    vIdx[id(i, j, k)] = pos.length / 3; pos.push(X0 + sx / n * H, Y0 + sy / n * H, Z0 + sz / n * H);
  }
  const idx = [];
  for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
    const f0 = F[id(i, j, k)] < 0;
    if ((F[id(i + 1, j, k)] < 0) !== f0) { const a = vIdx[id(i, j - 1, k - 1)], b = vIdx[id(i, j, k - 1)], c = vIdx[id(i, j, k)], d = vIdx[id(i, j - 1, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c); }
    if ((F[id(i, j + 1, k)] < 0) !== f0) { const a = vIdx[id(i - 1, j, k - 1)], b = vIdx[id(i, j, k - 1)], c = vIdx[id(i, j, k)], d = vIdx[id(i - 1, j, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, c, b, a, d, c) : idx.push(a, b, c, a, c, d); }
    if ((F[id(i, j, k + 1)] < 0) !== f0) { const a = vIdx[id(i - 1, j - 1, k)], b = vIdx[id(i, j - 1, k)], c = vIdx[id(i, j, k)], d = vIdx[id(i - 1, j, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c); }
  }
  const nv = pos.length / 3, nrm = new Float32Array(nv * 3), e = H * 0.5;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const gx = field(x + e, y, z) - field(x - e, y, z), gy = field(x, y + e, z) - field(x, y - e, z), gz = field(x, y, z + e) - field(x, y, z - e), l = len3(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l; nrm[v * 3 + 1] = gy / l; nrm[v * 3 + 2] = gz / l;
  }
  const names = Object.keys(BONES), bi = new Uint16Array(nv * 4), bw = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], acc = {};
    let dmin = 1e9; const ds = parts.map(P => { const d = sdPrim(x, y, z, P); if (d < dmin) dmin = d; return d; });
    parts.forEach((P, q) => { const w = Math.exp(-(ds[q] - dmin) / 0.025); acc[P.bone] = (acc[P.bone] || 0) + w; });
    const top = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, t) => a + t[1], 0);
    top.forEach(([b, w], q) => { bi[v * 4 + q] = names.indexOf(b); bw[v * 4 + q] = w / sum; });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bi, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bw, 4));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
// monta o esqueleto e a malha com pele; at(osso, malha, x,y,z) prende uma peça a um osso na posição do mundo de repouso
export function sdfRig(geo, BONES, material) {
  const bones = {}; for (const n of Object.keys(BONES)) { const b = new THREE.Bone(); b.name = 'r_' + n; bones[n] = b; }
  for (const [n, [par, p]] of Object.entries(BONES)) { const pp = par ? BONES[par][1] : [0, 0, 0]; bones[n].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); if (par) bones[par].add(bones[n]); }
  const root = Object.keys(BONES).find(n => !BONES[n][0]), skel = new THREE.Skeleton(Object.keys(BONES).map(n => bones[n]));
  const mesh = new THREE.SkinnedMesh(geo, material); mesh.add(bones[root]); mesh.bind(skel); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const at = (bn, o, x, y, z) => { const p = BONES[bn][1]; o.position.set(x - p[0], y - p[1], z - p[2]); bones[bn].add(o); o.traverse(c => { if (c.isMesh) c.castShadow = true; }); return o; };
  return { mesh, bones, at, R: n => bones[n].rotation };
}
// pelagem pintada no material (em 3D, presa ao corpo): rosetas, barriga clara, fios finos
const NOISE_GLSL = `
vec3 h3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float n=0.0;
  return mix(mix(mix(h3(i).x,h3(i+vec3(1,0,0)).x,f.x),mix(h3(i+vec3(0,1,0)).x,h3(i+vec3(1,1,0)).x,f.x),f.y), mix(mix(h3(i+vec3(0,0,1)).x,h3(i+vec3(1,0,1)).x,f.x),mix(h3(i+vec3(0,1,1)).x,h3(i+vec3(1,1,1)).x,f.x),f.y), f.z); }
vec2 worley(vec3 p){ vec3 i=floor(p), f=fract(p); float d1=8.0, d2=8.0;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec3 o=vec3(x,y,z); vec3 r=o+h3(i+o)*0.85-f; float d=dot(r,r); if(d<d1){d2=d1;d1=d;} else if(d<d2){d2=d;} }
  return vec2(sqrt(d1), sqrt(d2)); }`;
function catMaterial(kind, skinned, plain = false) {
  const C = CAT[kind], m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uBase: { value: new THREE.Color(C.base) }, uBelly: { value: new THREE.Color(C.belly) }, uSpot: { value: new THREE.Color(C.spot || C.base) }, uInner: { value: new THREE.Color(C.inner) }, uMane: { value: new THREE.Color(C.mane || C.base) }, uMane2: { value: new THREE.Color(C.mane2 || C.base) }, uSpots: { value: plain ? 0 : C.spots }, uFreq: { value: C.freq || 8.5 }, uLion: { value: C.mane ? 1 : 0 } });
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform vec3 uBase, uBelly, uSpot, uInner, uMane, uMane2; uniform float uSpots, uLion, uFreq;\n' + NOISE_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 p = vOP; vec3 n = normalize(vON);
      // barriga, garganta, parte de dentro das patas e focinho mais claros
      float belly = smoothstep(-0.05, -0.6, n.y) * (1.0 - smoothstep(1.15, 1.3, p.y));
      belly = max(belly, smoothstep(0.08, 0.02, abs(p.x)) * smoothstep(1.0, 1.13, p.z) * smoothstep(1.2, 1.12, p.y)); // focinho e queixo
      belly = max(belly, smoothstep(0.09, 0.15, abs(p.x)) * smoothstep(0.17, 0.12, abs(p.x)) * smoothstep(0.75, 0.3, p.y) * smoothstep(0.2, 0.9, -n.x * sign(p.x)) * 0.8);
      vec3 col = mix(uBase * (0.9 + 0.12 * smoothstep(0.3, 1.0, n.y)), uBelly, clamp(belly, 0.0, 1.0));
      col *= 0.93 + 0.1 * vn(p * vec3(70.0, 70.0, 22.0)); // fios de pelo
      if (uSpots > 1.5) { // tigre: listras verticais tortas que afinam para a barriga, rosto branco com marcas
        float face = smoothstep(0.86, 0.95, p.z);
        float warp = vn(p * 5.0) * 0.6 + vn(p * 13.0) * 0.18;
        float band = abs(fract(p.z * 8.5 + warp + abs(p.x) * 1.6 + vn(p * 3.0) * 0.5) - 0.5); // listras ao longo do corpo
        float thick = mix(0.085, 0.02, smoothstep(0.85, 0.55, p.y)) * (0.6 + vn(p * vec3(2.0, 6.0, 2.0)) * 0.8) * (1.0 - belly);
        float stripe = 1.0 - smoothstep(thick, thick + 0.04, band);
        stripe *= smoothstep(0.35, 0.55, vn(vec3(p.z * 3.0, p.y * 9.0, p.x * 9.0)) + 0.35); // listras partidas, não perfeitas
        float legs = 1.0 - smoothstep(0.4, 0.55, p.y); float lb = abs(fract(p.y * 9.0 + vn(p * 7.0) * 0.5) - 0.5); stripe = max(stripe * (1.0 - legs), legs * (1.0 - smoothstep(0.06, 0.1, lb)) * smoothstep(0.1, 0.45, p.y) * 0.8);
        float fw = face * (smoothstep(0.06, 0.02, abs(p.x) - 0.06) * smoothstep(1.3, 1.18, p.y) + smoothstep(0.1, 0.16, abs(p.x)) * smoothstep(1.25, 1.12, p.y)); // bochechas e focinho brancos
        col = mix(col, uBelly, clamp(fw, 0.0, 1.0));
        float fstripe = face * (1.0 - smoothstep(0.03, 0.05, abs(fract(p.y * 18.0 + abs(p.x) * 6.0 + vn(p * 9.0) * 0.4) - 0.5))) * smoothstep(1.2, 1.32, p.y); // listras da testa
        col = mix(col, uSpot, clamp(stripe * (1.0 - face) + fstripe * 0.8, 0.0, 1.0) * 0.92);
        col = mix(col, uBelly * 0.98, smoothstep(0.035, 0.0, abs(p.y - 1.27) + abs(abs(p.x) - 0.07) * 1.5) * face * 0.9); // mancha branca sobre os olhos
      } else if (uSpots > 0.5) {
        bool small = p.z > 0.82 || p.y < 0.55; // cabeça e patas: pintas pequenas e cheias
        if (small) { vec2 w = worley(p * 22.0); float s = 1.0 - smoothstep(0.2, 0.28, w.x); col = mix(col, uSpot, s * 0.9 * (1.0 - belly * 0.4)); }
        else {
          vec3 q = p + vec3(vn(p * 6.0), vn(p * 6.0 + 7.3), vn(p * 6.0 + 3.1)) * 0.065; // rosetas tortas, cada uma diferente
          vec2 w = worley(q * uFreq); float ring = smoothstep(0.17, 0.24, w.x) * (1.0 - smoothstep(0.44, 0.54, w.x));
          // a roseta é um anel quebrado de manchinhas (pétalas), com miolo mais escuro que a pelagem
          float blobs = 1.0 - smoothstep(0.3, 0.42, worley(p * uFreq * 2.1 + 3.7).x);
          float core = 1.0 - smoothstep(0.2, 0.3, w.x);
          col = mix(col, uInner, core * 0.6 * (1.0 - belly));
          col = mix(col, uSpot, ring * blobs * 0.95 * (1.0 - belly * 0.6));
        }
      }
      if (uLion > 0.5) { // juba: do pescoço até a nuca, com mechas
        float mz = smoothstep(0.4, 0.58, p.z) * (1.0 - smoothstep(0.88, 0.97, p.z)) * smoothstep(0.66, 0.8, p.y);
        float lock = vn(vec3(p.x * 34.0, p.y * 7.0, p.z * 34.0)) * 0.7 + vn(p * 90.0) * 0.3; // mechas compridas
        col = mix(col, mix(uMane, uMane2, lock), clamp(mz * 1.2, 0.0, 1.0));
      }
      diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => 'cat-' + kind + (skinned ? '-s' : '') + (plain ? '-p' : '');
  return m;
}
function makeBigCat(D) {
  const kind = D.cat, C = CAT[kind], obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  // esqueleto
  const bones = {}; for (const [n, [par, p]] of Object.entries(CAT_BONES)) { const b = new THREE.Bone(); b.name = 'cat_' + n; bones[n] = b; }
  for (const [n, [par, p]] of Object.entries(CAT_BONES)) { const pp = par ? CAT_BONES[par][1] : [0, 0, 0]; bones[n].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); if (par) bones[par].add(bones[n]); }
  const list = Object.keys(CAT_BONES).map(n => bones[n]), skel = new THREE.Skeleton(list);
  const skin = new THREE.SkinnedMesh(catGeometry(kind), catMaterial(kind, true));
  skin.add(bones.root); skin.bind(skel); skin.castShadow = skin.receiveShadow = true; skin.frustumCulled = false; body.add(skin);
  const at = (bn, mesh, x, y, z) => { const p = CAT_BONES[bn][1]; mesh.position.set(x - p[0], y - p[1], z - p[2]); bones[bn].add(mesh); mesh.castShadow = true; return mesh; };
  const DARK = new THREE.MeshStandardMaterial({ color: '#16110d', roughness: 0.4 });
  // olhos amendoados (íris âmbar, pupila, brilho) e nariz
  const EYE = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.08, emissive: C.eye, emissiveIntensity: 0.1 });
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.rotation.set(-0.1, s * 0.5, 0); at('head', eg, s * 0.066, 1.278, 1.112);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), EYE); iris.scale.set(1, 0.68, 0.45); eg.add(iris);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), DARK); pu.scale.set(0.6, 1.4, 0.4); pu.position.z = 0.008; eg.add(pu);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 28), DARK); rim.scale.set(1, 0.7, 1); eg.add(rim);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.007, 0.006, 0.012); eg.add(hl);
    const tear = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.05, 4, 8), DARK); tear.rotation.set(0.3, 0, s * 0.35); at('head', tear, s * 0.058, 1.235, 1.13); // risco da lágrima
    const inEar = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), new THREE.MeshStandardMaterial({ color: C.belly, roughness: 0.9 })); inEar.scale.set(1, 1.1, 0.25); at('head', inEar, s * 0.105, 1.365, 0.925);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 18, 12), new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.35 })); nose.scale.set(1.15, 0.55, 0.6); nose.rotation.x = 0.35; at('head', nose, 0, 1.205, 1.2); // focinho em triângulo
  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.03, 4, 8), DARK); at('head', lip, 0, 1.17, 1.198);
  const WH = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.4 }), wg = [];
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const y = 1.15 - k * 0.011; wg.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(s * 0.06, y, 1.19), V(s * 0.17, y - 0.008 + k * 0.004, 1.16), V(s * 0.27, y - 0.03, 1.09)]), 8, 0.0013, 4, false)); }
  const wh = new THREE.Mesh(mergeGeometries(wg), WH); wh.position.set(0, -1.18, -0.86); bones.head.add(wh);
  // cauda: segmentos lisos que nascem da garupa
  const tail = [], fl = C.tail || 1, TMAT = catMaterial(kind, false, true), t0 = new THREE.Group(); at('hips', t0, 0, 1.06, -0.95);
  let tp = t0; const POSE = [-0.5, -0.28, -0.14, -0.05, 0.03, 0.09, 0.16, 0.24, 0.3];
  for (let k = 0; k < 9; k++) {
    const g = new THREE.Group(); g.position.z = k ? -0.115 : 0; tp.add(g);
    const r0 = (0.052 - k * 0.0028) * fl, geo = new THREE.CapsuleGeometry(r0, 0.115, 6, 16); geo.rotateX(Math.PI / 2); geo.translate(0, 0, -0.0575);
    const seg = new THREE.Mesh(geo, TMAT); seg.castShadow = true; g.add(seg); tail.push(g); tp = g;
  }
  const tip = new THREE.Mesh(new THREE.SphereGeometry(kind === 'leao' ? 0.065 : 0.045 * fl, 16, 12), kind === 'leao' ? new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.95 }) : DARK); tip.scale.set(1, 1, 1.5); tip.position.z = -0.14; tp.add(tip);
  // sela, manta e estribos (presos ao tronco)
  const LEATHER = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.55 }), METAL = new THREE.MeshStandardMaterial({ color: '#c9b07a', roughness: 0.3, metalness: 0.6 });
  const saddle = new THREE.Group(); at('hips', saddle, 0, 0, 0);
  const blanket = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.6, 28, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshStandardMaterial({ color: D.blanket, roughness: 0.8, side: THREE.DoubleSide }));
  blanket.rotation.x = Math.PI / 2; blanket.rotation.y = Math.PI; blanket.position.set(0, 1.0, -0.12); saddle.add(blanket);
  for (const zz of [-0.42, 0.18]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.009, 8, 28, Math.PI * 0.84), METAL); t.rotation.z = Math.PI / 2 - Math.PI * 0.42 + Math.PI; t.position.set(0, 1.0, zz); saddle.add(t); }
  const seat = new THREE.Mesh(taper([V(0, 0, -0.26), V(0, -0.035, -0.04), V(0, -0.02, 0.14), V(0, 0.05, 0.24)], 0.18, 0.12, 12, 14), LEATHER); seat.scale.set(1.1, 0.42, 1); seat.position.set(0, 1.28, -0.12); saddle.add(seat);
  saddle.add(blob(0.07, 1, 1.3, 0.8, LEATHER, 0, 1.35, 0.14, 12));
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 8, 22), METAL); st.position.set(s * 0.29, 0.76, -0.1); saddle.add(st); const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.42, 0.035), LEATHER); strap.position.set(s * 0.275, 0.99, -0.1); strap.rotation.z = s * 0.1; saddle.add(strap); }
  saddle.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const seatA = new THREE.Object3D(); at('hips', seatA, 0, 1.33, -0.1); // S-242: onde o cavaleiro senta
  if (kind === 'tigre') { const ringM = new THREE.MeshStandardMaterial({ color: '#17100b', roughness: 0.8 }); tail.forEach((g, k) => { if (k < 2) return; const r = new THREE.Mesh(new THREE.TorusGeometry((0.052 - k * 0.0028) * fl * 0.98, 0.012, 6, 18), ringM); r.position.z = -0.06; g.add(r); }); } // anéis pretos na cauda
  let light = null;
  if (D.glow) { light = vlight('#ffcf6a', 0.7, 4); light.position.set(0, 1.8, 0.8); obj.add(light); }
  let ph = 0, gait = 0, run = 0, look = 0, air = 0, pitch = 0;
  const R = n => bones[n].rotation;
  return {
    obj, saddleY: 1.28, name: D.name, seat: { anchor: seatA, half: 0.27, stirrup: 0.5, reach: 0.32, footZ: -0.02 },
    animate(t, m, dt) {
      const s = m.speed;
      gait += (Math.min(1, s * 1.3) - gait) * (1 - Math.exp(-dt * 6));
      run += ((s > 0.9 ? 1 : 0) - run) * (1 - Math.exp(-dt * 4)); // rápido: galope (pares juntos)
      air += ((m.air ? 1 : 0) - air) * (1 - Math.exp(-dt * 10));
      ph += dt * (2.2 + s * 8);
      for (const sd of [-1, 1]) for (const front of [true, false]) {
        const walkOff = (front ? 0 : 0.5) + (sd > 0 ? 0.25 : 0.75), runOff = (front ? 0 : 0.42) + (sd > 0 ? 0.06 : 0);
        const p = ph + Math.PI * 2 * (walkOff * (1 - run) + runOff * run), sw = Math.sin(p), lift = Math.max(0, Math.cos(p)), g = gait * (1 - air);
        const amp = 0.4 + run * 0.35;
        if (front) { R('up' + sd).x = sw * amp * g - 1.0 * air; R('fo' + sd).x = lift * (0.7 + run * 0.5) * g + 1.2 * air; R('pa' + sd).x = -lift * 0.4 * g; }
        else { R('th' + sd).x = sw * amp * g + 0.8 * air; R('sh' + sd).x = lift * (0.6 + run * 0.4) * g - 0.3 * air; R('mt' + sd).x = -lift * 0.5 * g; }
      }
      body.position.y = Math.abs(Math.sin(ph)) * (0.02 + run * 0.05) * gait * (1 - air) + Math.sin(t * 1.4) * 0.006 * (1 - gait); // respira parado
      pitch += ((m.air ? (m.vy > 0 ? 0.18 : -0.15) : 0) - pitch) * (1 - Math.exp(-dt * 7));
      body.rotation.x = pitch; R('chest').x = Math.sin(ph * 2) * (0.015 + run * 0.06) * gait; R('hips').x = -Math.sin(ph * 2) * 0.02 * run * gait; // a coluna flexiona no galope
      body.rotation.z = -m.turn * 0.05 * gait;
      look += ((gait > 0.2 ? -m.turn * 0.14 : Math.sin(t * 0.4) * 0.35) - look) * (1 - Math.exp(-dt * 4));
      R('neck').y = look * 0.5; R('head').y = look * 0.5; R('neck').x = Math.sin(ph * 2) * 0.03 * gait + (1 - gait) * Math.sin(t * 0.6) * 0.03 + 0.06 * run + air * -0.1;
      tail.forEach((g, k) => { g.rotation.y = Math.sin(t * (1.2 + s * 2.5) - k * 0.45) * (0.05 + k * 0.02) - m.turn * 0.04 * k; g.rotation.x = POSE[k] * (1 - gait * 0.5) + (k < 2 ? 0.22 : 0) * gait; });
      if (light) light.intensity = 0.6 + Math.sin(t * 2.5) * 0.12;
    },
    get bodyY() { return body.position.y; },
  };
}

export { NOISE_GLSL as SDF_NOISE_GLSL };

/* =========================================================================
   TROTAVENTO (S-167): grande ave corredora das dunas — não voa, corre. Original:
   corpo fofo de penas douradas, pescoço longo, bico curvo laranja, topete de plumas,
   asinhas de penas compridas, leque de cauda e pernas fortes com escamas e três dedos.
   Uma malha orgânica só (campo de distância + pele com ossos); penas pintadas no material.
   Serve como montaria (com sela) e como bicho selvagem nas Dunas (sem sela).
   ========================================================================= */
const BIRD_COL = {
  // S-225: plumagem branca e laranja (nada de galinha): costas e pescoço laranja, peito, barriga e asas brancas com pontas laranja
  trotavento: { base: '#f0962e', back: '#d86a18', belly: '#fff8ee', wing: '#fffaf2', tip: '#f08a2a', crest: '#f27a14', beak: '#f2c25a', leg: '#e6b866', eye: '#4a2a12' },
  selvagem: { base: '#e0a050', back: '#b8722a', belly: '#f8efe0', wing: '#f6ecdc', tip: '#c87a32', crest: '#d8742a', beak: '#e8b450', leg: '#cfa060', eye: '#2a1608' },
};
const BIRD_BONES = { root: [null, [0, 0, 0]], hips: ['root', [0, 1.12, -0.15]], chest: ['hips', [0, 1.18, 0.25]], neck1: ['chest', [0, 1.33, 0.44]], neck2: ['neck1', [0, 1.6, 0.52]], head: ['neck2', [0, 1.88, 0.58]], tail: ['hips', [0, 1.24, -0.55]] };
for (const s of [-1, 1]) Object.assign(BIRD_BONES, {
  // S-244: perna de ave de verdade — coxa escondida no corpo, joelho sob a barriga, "tornozelo" dobrado para trás
  ['wi' + s]: ['chest', [s * 0.3, 1.3, 0.18]], ['th' + s]: ['hips', [s * 0.16, 1.0, -0.02]], ['sh' + s]: ['th' + s, [s * 0.17, 0.86, 0.06]],
  ['ta' + s]: ['sh' + s, [s * 0.17, 0.5, -0.14]], ['ft' + s]: ['ta' + s, [s * 0.17, 0.06, 0.04]],
});
function birdParts() {
  const P = [], C = (a, b, r0, r1, bone, k = 0.06) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.07) => P.push({ c, r, bone, k });
  E([0, 1.12, -0.06], [0.33, 0.27, 0.5], 'hips', 0.1);      // corpo mais baixo e liso (sem corcova)
  E([0, 1.17, 0.24], [0.3, 0.3, 0.28], 'chest', 0.1);
  E([0, 1.04, 0.12], [0.26, 0.23, 0.3], 'chest', 0.1); // peito estufado
  E([0, 1.17, -0.5], [0.22, 0.17, 0.22], 'tail', 0.1);
  C([0, 1.28, 0.42], [0, 1.6, 0.52], 0.19, 0.13, 'neck1', 0.09);
  E([0, 1.36, 0.46], [0.2, 0.2, 0.17], 'neck1', 0.09); // gola fofa na base do pescoço
  C([0, 1.6, 0.52], [0, 1.86, 0.57], 0.13, 0.11, 'neck2', 0.07);
  E([0, 1.94, 0.6], [0.135, 0.135, 0.155], 'head', 0.05);
  E([0, 2.0, 0.55], [0.08, 0.055, 0.1], 'head', 0.04);
  for (const s of [-1, 1]) E([s * 0.058, 1.895, 0.63], [0.07, 0.068, 0.08], 'head', 0.04); // bochechas
  C([0, 1.93, 0.69], [0, 1.905, 0.84], 0.062, 0.03, 'head', 0.025); // bico (de cima), curvo na ponta
  C([0, 1.905, 0.84], [0, 1.865, 0.895], 0.03, 0.01, 'head', 0.015);
  C([0, 1.885, 0.68], [0, 1.858, 0.83], 0.045, 0.012, 'head', 0.02);  // bico (de baixo)
  for (const s of [-1, 1]) {
    E([s * 0.29, 1.24, 0.02], [0.06, 0.17, 0.3], 'wi' + s, 0.06);
    E([s * 0.16, 0.95, 0.0], [0.12, 0.16, 0.15], 'th' + s, 0.08);                    // coxa emplumada, presa ao corpo
    C([s * 0.17, 0.88, 0.05], [s * 0.17, 0.52, -0.14], 0.07, 0.038, 'sh' + s, 0.05);   // "coxinha" (tibiotarso) descendo para trás
    E([s * 0.17, 0.51, -0.14], [0.035, 0.038, 0.04], 'ta' + s, 0.02);                 // tornozelo (o "joelho" invertido)
    C([s * 0.17, 0.5, -0.14], [s * 0.17, 0.08, 0.03], 0.028, 0.026, 'ta' + s, 0.02);   // tarso fino e escamoso, para a frente
    E([s * 0.17, 0.06, 0.04], [0.04, 0.03, 0.05], 'ft' + s, 0.03);
    C([s * 0.17, 0.05, 0.05], [s * 0.17, 0.025, 0.25], 0.024, 0.01, 'ft' + s, 0.015);
    C([s * 0.17, 0.05, 0.05], [s * 0.17 + 0.085, 0.025, 0.2], 0.021, 0.009, 'ft' + s, 0.015);
    C([s * 0.17, 0.05, 0.05], [s * 0.17 - 0.085, 0.025, 0.2], 0.021, 0.009, 'ft' + s, 0.015);
    C([s * 0.17, 0.055, 0.02], [s * 0.17, 0.025, -0.08], 0.018, 0.009, 'ft' + s, 0.015);
  }
  return P;
}
let birdGeo = null;
function birdMaterial(C) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  m.onBeforeCompile = sh => {
    const u = {}; for (const k of ['base', 'back', 'belly', 'wing', 'crest', 'beak', 'leg']) u['u' + k] = { value: new THREE.Color(C[k]) };
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform vec3 ubase, uback, ubelly, uwing, ucrest, ubeak, uleg;\n' + NOISE_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 p = vOP; vec3 n = normalize(vON);
      // penas: base dourada, costas mais escuras, peito e barriga claros
      vec3 col = mix(ubase, uback, smoothstep(0.2, 0.9, n.y) * smoothstep(1.05, 1.35, p.y) * (1.0 - smoothstep(1.55, 1.7, p.y)));
      col = mix(col, ubelly, smoothstep(0.1, -0.7, n.y) * smoothstep(0.55, 0.95, p.y) + smoothstep(0.55, 0.95, n.z) * smoothstep(0.85, 1.3, p.y) * smoothstep(0.2, 0.45, p.z) * 0.6);
      col = mix(col, uwing, smoothstep(0.27, 0.36, abs(p.x)) * smoothstep(1.0, 1.15, p.y) * (1.0 - smoothstep(1.45, 1.55, p.y)) * 0.45 * smoothstep(-0.3, -0.6, p.z + 0.0 * n.x));
      // escamas de pena (ponta de cada pena mais clara) + fios finos
      vec2 w = worley(p * vec3(26.0, 34.0, 26.0) + vn(p * 5.0) * 0.6); col *= 0.92 + 0.1 * smoothstep(0.05, 0.6, w.x);
      col *= 0.92 + 0.12 * vn(p * vec3(90.0, 30.0, 90.0));
      // bico laranja (ponta mais escura) e pernas com escamas
      float beak = smoothstep(0.72, 0.75, p.z) * smoothstep(1.8, 1.83, p.y);
      col = mix(col, mix(ubeak, ubeak * 0.55, smoothstep(0.78, 0.9, p.z)), beak);
      float leg = (1.0 - smoothstep(0.62, 0.7, p.y)) * smoothstep(0.08, 0.12, abs(p.x));
      vec2 sc = worley(p * 60.0); col = mix(col, uleg * (0.75 + 0.35 * smoothstep(0.1, 0.5, sc.x)), leg);
      diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => 'bird-' + C.base;
  return m;
}
// pena: folha lisa com nervura (cor por vértice: base → ponta)
function featherGeo(len, wid, c0, c1) {
  const g = new THREE.SphereGeometry(1, 16, 10); g.scale(wid, 0.12 * wid, len / 2); g.translate(0, 0, len / 2);
  const P = g.attributes.position, col = new Float32Array(P.count * 3), a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { const t = P.getZ(i) / len; P.setY(i, P.getY(i) + Math.sin(t * Math.PI) * 0.15 * wid - t * t * 0.25 * len * 0.3); c.copy(a).lerp(b, Math.pow(t, 1.5)); if (Math.abs(P.getX(i)) < wid * 0.08) c.multiplyScalar(0.8); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// S-225: pena "de verdade" leve (lâmina curva com ráquis, ponta arredondada) para cobrir o corpo em camadas
let _plumeGeo = null;
function plumeGeo() {
  if (_plumeGeo) return _plumeGeo;
  const g = new THREE.PlaneGeometry(1, 1, 2, 6); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2); // comprimento em +z, largura em x, plana (normal +y)
  const P = g.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), w = Math.sin(Math.min(1, z * 1.15) * Math.PI * 0.62 + 0.35) * (1 - Math.pow(z, 6) * 0.6); P.setX(i, x * w); P.setY(i, Math.sin(z * Math.PI) * 0.06 - Math.abs(x) * 0.12 * w); const c = 0.72 + z * 0.3 - (Math.abs(x) < 0.05 ? 0.12 : 0); col.set([c, c, c], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return (_plumeGeo = g);
}
// cobre cada osso do corpo de penas sobrepostas, deitadas para trás e para baixo, com a cor da região (instanciadas: leve)
function featherCoat(birdGeoRef, bones, at, C, plan) {
  const P = birdGeoRef.attributes.position, N = birdGeoRef.attributes.normal, SI = birdGeoRef.attributes.skinIndex, SW = birdGeoRef.attributes.skinWeight, names = Object.keys(BIRD_BONES);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
  const col = new THREE.Color(), up = new THREE.Vector3(), dir = new THREE.Vector3(), nrm = new THREE.Vector3(), xa = new THREE.Vector3(), m = new THREE.Matrix4(), flow = new THREE.Vector3();
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (const [bn, count, len, wid, flowV] of plan) {
    const bi = names.indexOf(bn), cand = [];
    for (let v = 0; v < P.count; v++) if (SI.getX(v) === bi && SW.getX(v) > 0.55) cand.push(v);
    if (!cand.length) continue;
    const im = new THREE.InstancedMesh(plumeGeo(), mat, count); im.castShadow = true; im.receiveShadow = true;
    for (let i = 0; i < count; i++) {
      const v = cand[Math.floor(rnd() * cand.length)], x = P.getX(v), y = P.getY(v), z = P.getZ(v);
      nrm.set(N.getX(v), N.getY(v), N.getZ(v)).normalize();
      flow.set(...flowV).normalize(); dir.copy(flow).addScaledVector(nrm, -flow.dot(nrm)); if (dir.lengthSq() < 1e-4) dir.set(0, -1, 0).addScaledVector(nrm, nrm.y); dir.normalize();
      dir.addScaledVector(nrm, 0.22).normalize(); // levanta um pouquinho a ponta (pena "fofa", não colada)
      xa.crossVectors(nrm, dir).normalize(); up.crossVectors(dir, xa).normalize();
      const L = len * (0.75 + rnd() * 0.5), Wd = wid * (0.8 + rnd() * 0.4);
      m.makeBasis(xa.multiplyScalar(Wd), up.multiplyScalar(L * 0.6), dir.clone().multiplyScalar(L)); m.setPosition(x - nrm.x * L * 0.15, y - nrm.y * L * 0.15, z - nrm.z * L * 0.15);
      im.setMatrixAt(i, m);
      // cor da região: costas/pescoço laranja, peito e barriga brancos, asas brancas com pontas laranja
      const belly = Math.max(0, Math.min(1, (-nrm.y - 0.15) * 2.0)) * (y < 1.25 ? 1 : 0.3) + Math.max(0, Math.min(1, (nrm.z - 0.45) * 3)) * (y > 0.9 && y < 1.5 ? 1 : 0); // peito e barriga brancos (transição suave)
      col.set(C.base).lerp(new THREE.Color(C.back), Math.max(0, nrm.y) * 0.6 * (bn === 'neck1' || bn === 'neck2' ? 0.4 : 1)).lerp(new THREE.Color(C.belly), Math.min(1, belly));
      if (bn.startsWith('wi')) col.set(C.base).lerp(new THREE.Color(C.back), 0.3); // coberteiras da asa: laranja (as primárias brancas ficam por cima)
      if (bn.startsWith('th')) col.set(C.base).lerp(new THREE.Color(C.belly), Math.max(0, -nrm.y) * 0.8 + 0.15); // calça de penas
      col.offsetHSL(0, 0, (rnd() - 0.5) * 0.035); im.setColorAt(i, col);
    }
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; at(bn, im, 0, 0, 0);
  }
}
export function makeRunnerBird(D = MOUNTS.trotavento, opts = {}) {
  const C = BIRD_COL[D.bird] || BIRD_COL.trotavento, obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  if (!birdGeo) birdGeo = sdfSkinnedGeometry(birdParts(), BIRD_BONES, [-0.52, -0.02, -0.86], [1.04, 2.16, 1.88], 0.024);
  const rig = sdfRig(birdGeo, BIRD_BONES, birdMaterial(C)), { at, R, bones } = rig; body.add(rig.mesh);
  const FM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  // plumagem em camadas por todo o corpo (direção do "fluxo" das penas: para trás e para baixo)
  featherCoat(birdGeo, bones, at, C, [
    ['hips', 260, 0.11, 0.06, [0, -0.35, -1]], ['chest', 260, 0.13, 0.07, [0, -0.8, -0.4]], ['tail', 90, 0.14, 0.065, [0, -0.2, -1]],
    ['neck1', 150, 0.075, 0.045, [0, -1, -0.25]], ['neck2', 120, 0.06, 0.038, [0, -1, -0.2]],
    ['th-1', 110, 0.09, 0.055, [0, -1, -0.15]], ['th1', 110, 0.09, 0.055, [0, -1, -0.15]], ['wi-1', 90, 0.11, 0.055, [0, -0.25, -1]], ['wi1', 90, 0.11, 0.055, [0, -0.25, -1]],
  ]);
  // olhos grandes e expressivos (íris escura com brilho, pálpebra que pisca)
  const lids = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.rotation.set(-0.05, s * 0.62, 0); at('head', eg, s * 0.108, 1.96, 0.68);
    eg.add(new THREE.Mesh(new THREE.SphereGeometry(0.034, 22, 16), new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.3 }))).scale.set(1, 1.08, 0.5);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.027, 22, 16), new THREE.MeshStandardMaterial({ color: '#7a4a1a', roughness: 0.15 })); iris.scale.set(1, 1.08, 0.45); iris.position.z = 0.012; eg.add(iris);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.016, 18, 12), new THREE.MeshStandardMaterial({ color: '#120804', roughness: 0.1 })); pu.scale.set(1, 1.1, 0.4); pu.position.z = 0.019; eg.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.009, 0.011, 0.026); eg.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.037, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.base, roughness: 0.8 })); lid.scale.set(1, 1.08, 0.58); lid.rotation.x = -1.25; eg.add(lid); lids.push(lid);
    const brow = new THREE.Mesh(taper([V(-0.035, -0.006, 0), V(0, 0.008, 0.006), V(0.035, -0.006, 0)], 0.008, 0.006, 10, 8), new THREE.MeshStandardMaterial({ color: C.back, roughness: 0.8 })); brow.position.set(0, 0.05, 0.004); eg.add(brow);
  }
  // topete de plumas (o "charme" do bicho) e leque da cauda
  const crest = [];
  for (let k = 0; k < 7; k++) { const a = (k - 3) / 3; const f = new THREE.Mesh(featherGeo(0.24 + (1 - Math.abs(a)) * 0.16, 0.03, C.crest, C.back), FM); const g = new THREE.Group(); g.rotation.set(-2.75 + Math.abs(a) * 0.2, a * 0.35, 0); g.add(f); at('head', g, a * 0.03, 2.02, 0.55); crest.push(g); } // topete de plumas longas varrido para trás (nada de crista de galo)
  const fan = [];
  for (let k = 0; k < 17; k++) { const a = (k - 8) / 8; const f = new THREE.Mesh(featherGeo(0.62 - Math.abs(a) * 0.16, 0.06, C.belly, k % 2 ? C.tip : C.wing), FM); const g = new THREE.Group(); g.rotation.set(-2.55 + Math.abs(a) * 0.3, a * 0.8, a * 0.3); g.add(f); at('tail', g, a * 0.1, 1.24 + (1 - Math.abs(a)) * 0.03, -0.62); fan.push(g); } // S-244: leque de cauda cheio e longo
  for (let k = 0; k < 9; k++) { const a = (k - 4) / 4; const f = new THREE.Mesh(featherGeo(0.34 - Math.abs(a) * 0.06, 0.05, C.base, C.tip), FM); const g = new THREE.Group(); g.rotation.set(-2.75 + Math.abs(a) * 0.15, a * 0.5, 0); g.add(f); at('tail', g, a * 0.07, 1.3, -0.55); } // coberteiras da cauda (camada de cima)
  for (const s of [-1, 1]) for (let k = 0; k < 8; k++) { const f = new THREE.Mesh(featherGeo(0.26 + k * 0.025, 0.05, C.wing, k % 2 ? C.tip : C.wing), FM); const g = new THREE.Group(); g.rotation.set(-2.75 + k * 0.05, s * (0.05 + k * 0.012), s * (0.12 + k * 0.02)); g.add(f); at('wi' + s, g, s * (0.345 - k * 0.006), 1.3 - k * 0.028, 0.05 - k * 0.035); } // asinha toda de penas: primárias brancas com pontas laranja
  // sela (só na montaria)
  if (opts.saddle !== false) {
    const LEATHER = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.55 }), METAL = new THREE.MeshStandardMaterial({ color: '#c9b07a', roughness: 0.3, metalness: 0.6 });
    const saddle = new THREE.Group(); at('hips', saddle, 0, 0, 0);
    const blanket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.56, 28, 1, true, -Math.PI * 0.4, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: D.blanket || '#3a6a8a', roughness: 0.8, side: THREE.DoubleSide }));
    blanket.rotation.x = Math.PI / 2; blanket.rotation.y = Math.PI; blanket.position.set(0, 1.1, 0.02); saddle.add(blanket);
    const seat = new THREE.Mesh(taper([V(0, 0, -0.24), V(0, -0.03, -0.04), V(0, -0.02, 0.12), V(0, 0.05, 0.22)], 0.17, 0.11, 12, 14), LEATHER); seat.scale.set(1.1, 0.42, 1); seat.position.set(0, 1.42, 0.02); saddle.add(seat);
    saddle.add(blob(0.065, 1, 1.3, 0.8, LEATHER, 0, 1.49, 0.24, 12));
    for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 8, 22), METAL); st.position.set(s * 0.37, 0.92, 0.04); saddle.add(st); const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.46, 0.035), LEATHER); strap.position.set(s * 0.355, 1.16, 0.04); strap.rotation.z = s * 0.08; saddle.add(strap); }
    saddle.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  const seatA = new THREE.Object3D(); at('hips', seatA, 0, 1.45, 0.02); // S-242: onde o cavaleiro senta
  let ph = 0, gait = 0, run = 0, air = 0, look = 0, pitch = 0, blinkAt = 2, kickT = -9, lt = 0, peck = 0;
  const api = {
    obj, saddleY: 1.45, name: D.name, seat: { anchor: seatA, half: 0.34, stirrup: 0.52, reach: 0.33, footZ: 0.02 },
    attack() { kickT = lt; },
    animate(t, m, dt) {
      lt = t; const s = m.speed;
      gait += (Math.min(1, s * 1.4) - gait) * (1 - Math.exp(-dt * 6));
      run += ((s > 0.9 ? 1 : 0) - run) * (1 - Math.exp(-dt * 4));
      air += ((m.air ? 1 : 0) - air) * (1 - Math.exp(-dt * 10));
      ph += dt * (2.6 + s * 8.5);
      const kk = (t - kickT) / 0.55, kick = kk > 0 && kk < 1 ? Math.sin(kk * Math.PI) : 0, wind = kk > 0 && kk < 0.35 ? Math.sin(kk / 0.35 * Math.PI) : 0;
      for (const sd of [-1, 1]) {
        const p = ph + (sd > 0 ? Math.PI : 0), sw = Math.sin(p), lift = Math.max(0, Math.cos(p)), g = gait * (1 - air), amp = 0.42 + run * 0.35;
        const kicker = sd > 0 ? kick : 0; // chute com a pata direita (golpe do bicho selvagem)
        R('th' + sd).x = -sw * amp * g - 0.55 * air - kicker * 1.1 + (sd > 0 ? wind * 0.4 : 0);
        R('sh' + sd).x = lift * (0.5 + run * 0.3) * g + 0.9 * air + kicker * 0.4;  // joelho
        R('ta' + sd).x = -lift * (0.9 + run * 0.5) * g - 1.4 * air - kicker * 0.6; // o tornozelo dobra ao levantar
        R('ft' + sd).x = lift * 0.9 * g + 0.8 * air - kicker * 0.5; // dedos se fecham no ar
      }
      body.position.y = Math.abs(Math.sin(ph)) * (0.03 + run * 0.06) * gait * (1 - air) + Math.sin(t * 1.5) * 0.008 * (1 - gait);
      pitch += ((m.air ? (m.vy > 0 ? 0.15 : -0.12) : 0.12 * run * gait) - pitch) * (1 - Math.exp(-dt * 6));
      body.rotation.x = pitch; body.rotation.z = -m.turn * 0.06 * gait + Math.sin(ph) * 0.025 * gait;
      // cabeça: balança como a de uma ave andando (vai e volta), parada olha em volta e às vezes cisca
      look += ((gait > 0.2 ? -m.turn * 0.15 : Math.sin(t * 0.5) * 0.5) - look) * (1 - Math.exp(-dt * 4));
      peck += ((!m.speed && Math.sin(t * 0.37 + 1.1) > 0.8 ? 1 : 0) - peck) * (1 - Math.exp(-dt * 3));
      R('neck1').x = Math.sin(ph * 2) * 0.1 * gait - 0.15 * run * gait + peck * 0.55 + wind * 0.25; R('neck1').y = look * 0.4;
      R('neck2').x = -Math.sin(ph * 2) * 0.08 * gait + peck * 0.45 + (1 - gait) * Math.sin(t * 0.8) * 0.04; R('neck2').y = look * 0.3;
      R('head').x = -Math.sin(ph * 2) * 0.06 * gait - peck * 0.4 + Math.sin(t * 9) * 0.03 * peck; R('head').y = look * 0.3;
      for (const sd of [-1, 1]) { R('wi' + sd).z = sd * (Math.sin(ph * 2) * 0.08 * gait + run * 0.25 * gait + air * 0.6 + Math.max(0, Math.sin(t * 0.7 + sd)) * 0.05); R('wi' + sd).x = -air * 0.3; }
      R('tail').x = -0.1 + Math.sin(ph * 2) * 0.06 * gait + run * 0.2; R('tail').y = Math.sin(t * 2.2) * 0.08 + m.turn * 0.06;
      fan.forEach((g, k) => { g.rotation.y += ((k - 8) / 8 * (0.8 + Math.sin(t * 1.3) * 0.05) - g.rotation.y) * 0.2; });
      crest.forEach((g, k) => { g.rotation.x = -2.75 + Math.abs(k - 3) / 3 * 0.2 - gait * 0.2 + Math.sin(t * 3 + k) * 0.04; });
      let bl = 0; if (t > blinkAt) { const q = (t - blinkAt) / 0.14; bl = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) blinkAt = t + 2 + Math.random() * 3; }
      for (const l of lids) l.rotation.x = -1.6 + bl * 1.55; // olhos bem abertos (curiosos), piscam
    },
    get bodyY() { return body.position.y; },
  };
  return api;
}

/* =========================================================================
   CAVALO DE VERDADE (S-242): corpo único e liso (campo de distância + pele com ossos),
   anatomia equina (cernelha, garupa redonda, peito fundo, pescoço arqueado, cabeça longa
   em cunha, joelho e jarrete marcados, canelas finas, boletos, cascos), pelagem pintada no
   material (tom do dorso, ventre, focinho e "meias" escuras), crina e cauda de fios.
   makeHorse(D, { wings }) — com asas de penas vira o Pégaso (Noctívago, S-230).
   ========================================================================= */
const HORSE_BONES = { root: [null, [0, 0, 0]], hips: ['root', [0, 1.18, -0.5]], chest: ['hips', [0, 1.2, 0.42]], neck: ['chest', [0, 1.36, 0.74]], head: ['neck', [0, 1.86, 1.08]], tail: ['hips', [0, 1.36, -0.88]] };
for (const s of [-1, 1]) Object.assign(HORSE_BONES, {
  ['up' + s]: ['chest', [s * 0.17, 1.1, 0.56]], ['fo' + s]: ['up' + s, [s * 0.17, 0.86, 0.5]], ['ca' + s]: ['fo' + s, [s * 0.165, 0.48, 0.52]], ['pa' + s]: ['ca' + s, [s * 0.165, 0.15, 0.53]],
  ['th' + s]: ['hips', [s * 0.19, 1.12, -0.5]], ['sh' + s]: ['th' + s, [s * 0.18, 0.86, -0.36]], ['mt' + s]: ['sh' + s, [s * 0.165, 0.55, -0.66]], ['pb' + s]: ['mt' + s, [s * 0.165, 0.16, -0.6]],
});
function horseParts() {
  const P = [], C = (a, b, r0, r1, bone, k = 0.07) => P.push({ a, b, r0, r1, bone, k }), E = (c, r, bone, k = 0.07) => P.push({ c, r, bone, k });
  // tronco: garupa redonda, barril, peito fundo e cernelha
  E([0, 1.2, -0.58], [0.3, 0.29, 0.33], 'hips', 0.12);
  C([0, 1.18, -0.5], [0, 1.15, 0.0], 0.3, 0.33, 'hips', 0.12);
  C([0, 1.15, 0.0], [0, 1.18, 0.48], 0.33, 0.3, 'chest', 0.12);
  E([0, 1.05, 0.52], [0.25, 0.32, 0.24], 'chest', 0.1);          // peito
  E([0, 1.4, 0.48], [0.11, 0.1, 0.22], 'chest', 0.1);            // cernelha
  E([0, 0.98, -0.02], [0.27, 0.2, 0.42], 'hips', 0.14);          // ventre
  // pescoço arqueado e cabeça longa em cunha
  C([0, 1.3, 0.62], [0, 1.62, 0.9], 0.24, 0.16, 'neck', 0.1);
  C([0, 1.62, 0.9], [0, 1.84, 1.04], 0.16, 0.12, 'neck', 0.08);
  E([0, 1.56, 0.78], [0.13, 0.26, 0.18], 'neck', 0.1);           // crista do pescoço
  E([0, 1.86, 1.1], [0.11, 0.12, 0.14], 'head', 0.05);           // crânio
  C([0, 1.82, 1.14], [0, 1.6, 1.42], 0.1, 0.062, 'head', 0.05); // chanfro até o focinho (afina)
  E([0, 1.575, 1.45], [0.066, 0.07, 0.078], 'head', 0.035);      // focinho macio, estreito
  E([0, 1.52, 1.4], [0.05, 0.035, 0.06], 'head', 0.03);           // beiço de baixo
  E([0, 1.72, 1.17], [0.1, 0.12, 0.11], 'head', 0.05);           // ganacha (bochecha)
  for (const s of [-1, 1]) {
    E([s * 0.075, 1.99, 1.06], [0.032, 0.085, 0.03], 'head', 0.02); // orelhas em pé
    // dianteira: escápula, braço, antebraço, joelho, canela, boleto, quartela e casco
    E([s * 0.16, 1.24, 0.52], [0.09, 0.22, 0.15], 'up' + s, 0.08);
    C([s * 0.17, 1.1, 0.56], [s * 0.17, 0.86, 0.5], 0.13, 0.1, 'up' + s, 0.07);
    C([s * 0.17, 0.86, 0.5], [s * 0.165, 0.5, 0.52], 0.085, 0.058, 'fo' + s, 0.05);
    E([s * 0.165, 0.49, 0.52], [0.06, 0.06, 0.06], 'ca' + s, 0.03);       // joelho
    C([s * 0.165, 0.48, 0.52], [s * 0.165, 0.17, 0.53], 0.045, 0.04, 'ca' + s, 0.03); // canela fina
    E([s * 0.165, 0.15, 0.54], [0.052, 0.05, 0.058], 'pa' + s, 0.03);     // boleto
    C([s * 0.165, 0.14, 0.55], [s * 0.165, 0.05, 0.6], 0.042, 0.05, 'pa' + s, 0.02);
    // traseira: coxa grande, soldra, gaskin, jarrete (ângulo marcado), canela, boleto e casco
    E([s * 0.18, 1.1, -0.55], [0.13, 0.27, 0.24], 'th' + s, 0.1);
    C([s * 0.19, 1.05, -0.5], [s * 0.18, 0.86, -0.36], 0.15, 0.11, 'th' + s, 0.08);
    C([s * 0.18, 0.86, -0.36], [s * 0.168, 0.56, -0.66], 0.1, 0.06, 'sh' + s, 0.06);
    E([s * 0.168, 0.56, -0.68], [0.05, 0.07, 0.07], 'mt' + s, 0.03);      // ponta do jarrete
    C([s * 0.165, 0.55, -0.66], [s * 0.165, 0.17, -0.6], 0.047, 0.041, 'mt' + s, 0.03);
    E([s * 0.165, 0.15, -0.59], [0.052, 0.05, 0.058], 'pb' + s, 0.03);
    C([s * 0.165, 0.14, -0.58], [s * 0.165, 0.05, -0.53], 0.042, 0.05, 'pb' + s, 0.02);
  }
  E([0, 1.33, -0.86], [0.07, 0.07, 0.08], 'tail', 0.06); // raiz da cauda
  return P;
}
let _horseGeo = null;
function horseGeometry() { return _horseGeo || (_horseGeo = sdfSkinnedGeometry(horseParts(), HORSE_BONES, [-0.48, -0.02, -1.0], [0.96, 2.16, 2.6], 0.022)); }
function horseMaterial(D) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.68, metalness: 0 });
  const coat = new THREE.Color(D.coat || D.wool), dark = new THREE.Color(D.points || D.skin), muzzle = new THREE.Color(D.muzzle || D.skin);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uCoat: { value: coat }, uDark: { value: dark }, uMuz: { value: muzzle }, uDapple: { value: D.dapple ? 1 : 0 }, uSocks: { value: D.socks ?? 1 } });
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform vec3 uCoat, uDark, uMuz; uniform float uDapple, uSocks;\n' + NOISE_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 p = vOP; vec3 n = normalize(vON);
      vec3 col = uCoat * (0.88 + 0.16 * smoothstep(-0.2, 0.9, n.y)); // dorso mais claro (brilho do pelo)
      col *= 0.95 + 0.08 * vn(p * vec3(40.0, 120.0, 40.0)); // pelo curto
      if (uDapple > 0.5) { vec2 w = worley(p * 7.0); col *= 0.9 + 0.18 * smoothstep(0.15, 0.45, w.x); } // tordilho
      float sock = (1.0 - smoothstep(0.3, 0.55, p.y)) * uSocks; col = mix(col, uDark, sock * 0.85); // "meias" escuras nas canelas
      float muz = smoothstep(1.38, 1.47, p.z) * smoothstep(1.75, 1.6, p.y); col = mix(col, uMuz, muz * 0.85); // focinho
      float hoof = 1.0 - smoothstep(0.07, 0.1, p.y); col = mix(col, vec3(0.09, 0.08, 0.07), hoof);
      diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => 'horse-' + coat.getHexString() + dark.getHexString() + (D.dapple ? 'd' : '');
  return m;
}
// mechas de crina/cauda: muitos fios afinando, juntos numa malha
function hairStrands(paths, mat) {
  const gs = [];
  for (const { pts, r0, r1 } of paths) gs.push(taper(pts, r0, r1, 10, 5));
  const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = true; return m;
}
// asa de penas (Pégaso): penas primárias longas, secundárias e coberteiras em camadas
function featherWing(side, C) {
  const g = new THREE.Group(), arm = new THREE.Group(), fore = new THREE.Group(), hand = new THREE.Group(); g.add(arm); arm.add(fore); fore.add(hand);
  fore.position.set(side * 0.55, 0, -0.05); hand.position.set(side * 0.55, 0, 0.05);
  const FM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
  const fg = (len, wid, c0, c1) => { const geo = featherGeo(len, wid, c0, c1); geo.rotateY(Math.PI); return geo; }; // pena apontando para trás (-z)
  const lay = (parent, n, x0, x1, len0, len1, wid, c0, c1, y, fan, droop) => { for (let k = 0; k < n; k++) { const u = n > 1 ? k / (n - 1) : 0, f = new THREE.Mesh(fg(len0 + (len1 - len0) * u, wid, c0, c1), FM); f.position.set(side * (x0 + (x1 - x0) * u), y, 0); f.rotation.set(droop, side * (fan * u), 0); f.castShadow = true; parent.add(f); } };
  // osso/couro da borda da asa
  const boneM = new THREE.MeshStandardMaterial({ color: C.coat, roughness: 0.6 });
  arm.add(new THREE.Mesh(taper([V(0, 0, 0), V(side * 0.3, 0.02, -0.02), V(side * 0.56, 0, -0.05)], 0.07, 0.05, 8, 10), boneM));
  fore.add(new THREE.Mesh(taper([V(0, 0, 0), V(side * 0.3, 0.01, 0.03), V(side * 0.56, 0, 0.05)], 0.05, 0.035, 8, 10), boneM));
  hand.add(new THREE.Mesh(taper([V(0, 0, 0), V(side * 0.25, 0, 0.0), V(side * 0.42, 0, -0.04)], 0.035, 0.015, 8, 8), boneM));
  lay(arm, 7, 0.05, 0.55, 0.32, 0.5, 0.07, C.wing, C.tip, -0.01, 0.0, 0.05);   // terciárias
  lay(fore, 9, 0.0, 0.55, 0.62, 0.72, 0.08, C.wing, C.tip, -0.01, -0.15, 0.02); // secundárias
  lay(hand, 10, 0.0, 0.42, 0.95, 0.75, 0.085, C.wing, C.tip, -0.01, -0.9, 0.0); // primárias (abrem em leque)
  lay(arm, 10, 0.05, 0.55, 0.18, 0.24, 0.06, C.coat, C.wing, 0.015, 0.0, 0.0);  // coberteiras (sobrepostas)
  lay(fore, 12, 0.0, 0.55, 0.22, 0.26, 0.06, C.coat, C.wing, 0.015, -0.1, 0.0);
  lay(hand, 8, 0.0, 0.4, 0.2, 0.16, 0.05, C.coat, C.wing, 0.015, -0.6, 0.0);
  return { g, arm, fore, hand };
}
export function makeHorse(D = MOUNTS.lanudo, opts = {}) {
  const obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  const rig = sdfRig(horseGeometry(), HORSE_BONES, horseMaterial(D)), { at, R, bones } = rig; body.add(rig.mesh);
  const DARK = new THREE.MeshStandardMaterial({ color: '#120e0c', roughness: 0.3 });
  const MANE = D.glow ? new THREE.MeshStandardMaterial({ color: D.mane, emissive: D.mane, emissiveIntensity: 0.45, roughness: 0.55 }) : new THREE.MeshStandardMaterial({ color: D.mane, roughness: 0.6 });
  // olhos grandes e escuros com brilho úmido, pálpebra, narinas, cílios
  const lids = [], COATP = new THREE.MeshStandardMaterial({ color: new THREE.Color(D.coat || D.wool).multiplyScalar(0.95), roughness: 0.55 });
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.rotation.set(0, s * 1.25, 0); at('head', eg, s * 0.112, 1.84, 1.1);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 22, 16), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.04, metalness: 0.15 })); ball.scale.set(1.3, 1, 0.55); eg.add(ball);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.03, 18, 12), new THREE.MeshStandardMaterial({ color: '#5a3418', roughness: 0.1 })); iris.scale.set(1.3, 0.9, 0.5); iris.position.z = 0.006; eg.add(iris);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.016, 0.013, 0.02); eg.add(hl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 28), DARK); rim.scale.set(1.3, 1, 1); eg.add(rim);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.044, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), COATP); lid.scale.set(1.3, 1, 0.62); lid.rotation.x = -1.35; eg.add(lid); lids.push(lid);
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), COATP); brow.scale.set(1.3, 0.5, 0.7); brow.position.set(0, 0.035, -0.012); eg.add(brow); // arcada sobre o olho
    const nos = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.035, 4, 10), DARK); nos.rotation.set(0.5, s * 0.5, s * 0.5); at('head', nos, s * 0.042, 1.6, 1.515); // narina em vírgula
  }
  // crina: fios descendo de um lado do pescoço + topete
  const manePaths = []; let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // linha da crista (topo do pescoço) da cernelha até a nuca; os fios caem para um lado, por fora do pescoço
  const crest = u => [1.5 + u * 0.47 - Math.sin(u * Math.PI) * -0.03, 0.56 + u * 0.48, 0.2 - u * 0.07]; // [y, z, meia-largura do pescoço]
  for (let i = 0; i < 80; i++) { const u = i / 79, [y, z, hw] = crest(u), L = 0.2 + rnd() * 0.14 - u * 0.06, sx = 1, j = (rnd() - 0.5) * 0.02;
    manePaths.push({ pts: [V(-0.01, y + 0.02, z + j), V(sx * hw * 0.6, y + 0.01, z - 0.03 + j), V(sx * (hw + 0.035), y - L * 0.45, z - 0.06 + j), V(sx * (hw + 0.045 + rnd() * 0.02), y - L, z - 0.05 + j)], r0: 0.028, r1: 0.005 }); }
  const mane = hairStrands(manePaths, MANE); mane.position.set(0, -HORSE_BONES.neck[1][1], -HORSE_BONES.neck[1][2]); bones.neck.add(mane);
  const fl = []; for (let i = 0; i < 9; i++) fl.push({ pts: [V((rnd() - 0.5) * 0.04, 1.97, 1.04), V((rnd() - 0.5) * 0.05, 1.95, 1.13), V((rnd() - 0.5) * 0.06, 1.86, 1.2)], r0: 0.016, r1: 0.004 });
  const forelock = hairStrands(fl, MANE); forelock.position.set(0, -HORSE_BONES.head[1][1], -HORSE_BONES.head[1][2]); bones.head.add(forelock);
  // cauda: dezenas de fios longos que caem e balançam (um grupo por segmento)
  const tailSegs = []; let tp = new THREE.Group(); at('tail', tp, 0, 1.33, -0.9);
  const tailRoot = tp;
  for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.position.set(0, k ? -0.14 : 0, k ? -0.07 : 0); tp.add(g); tailSegs.push(g); tp = g;
    const ps = []; for (let i = 0; i < 16; i++) { const ox = (rnd() - 0.5) * 0.09, oz = (rnd() - 0.5) * 0.05, L = 0.26 + rnd() * 0.12 + (k === 3 ? 0.25 : 0); ps.push({ pts: [V(ox * 0.5, 0, oz * 0.5), V(ox, -L * 0.5, -0.05 + oz), V(ox * 1.3, -L, -0.04 + oz)], r0: 0.02, r1: 0.004 }); }
    g.add(hairStrands(ps, MANE)); }
  // sela de couro com arção, manta com borda, cilha, estribos e rédeas
  const LEATHER = new THREE.MeshStandardMaterial({ color: '#5a3820', roughness: 0.5 }), METAL = new THREE.MeshStandardMaterial({ color: '#c9b07a', roughness: 0.3, metalness: 0.7 });
  const saddle = new THREE.Group(); at('chest', saddle, 0, 0, 0);
  const blanket = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.62, 32, 1, true, -Math.PI * 0.4, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: D.blanket, roughness: 0.85, side: THREE.DoubleSide }));
  blanket.rotation.x = Math.PI / 2; blanket.rotation.y = Math.PI; blanket.position.set(0, 1.19, 0.22); saddle.add(blanket);
  for (const zz of [-0.09, 0.53]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.348, 0.008, 6, 32, Math.PI * 0.8), METAL); t.rotation.z = Math.PI / 2 - Math.PI * 0.4 + Math.PI; t.position.set(0, 1.19, zz); saddle.add(t); }
  const seat = new THREE.Mesh(taper([V(0, 0.02, -0.2), V(0, -0.03, 0.0), V(0, -0.02, 0.16), V(0, 0.07, 0.27)], 0.19, 0.12, 14, 16), LEATHER); seat.scale.set(1.15, 0.4, 1); seat.position.set(0, 1.55, 0.2); saddle.add(seat);
  saddle.add(blob(0.05, 1, 1.5, 0.9, LEATHER, 0, 1.64, 0.47, 12)); // arção (cabeça da sela)
  saddle.add(blob(0.12, 1.5, 0.6, 0.55, LEATHER, 0, 1.6, -0.02, 12)); // patilha (traseira)
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.55, 0.035), LEATHER); strap.position.set(s * 0.3, 1.3, 0.28); strap.rotation.z = s * 0.1; saddle.add(strap);
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 22), METAL); st.position.set(s * 0.33, 1.0, 0.3); saddle.add(st);
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.11), METAL); tread.position.set(s * 0.33, 0.955, 0.3); saddle.add(tread);
    const girth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, 0.06), LEATHER); girth.position.set(s * 0.31, 1.02, 0.42); girth.rotation.z = s * -0.18; saddle.add(girth);
  }
  // cabeçada e rédeas
  const bridle = new THREE.Group(); at('head', bridle, 0, 0, 0);
  bridle.add(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.009, 6, 28), LEATHER)).position.set(0, 1.6, 1.38); bridle.children[0].rotation.y = Math.PI / 2; bridle.children[0].scale.set(1, 0.85, 1.05);
  for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.3, 0.02), LEATHER); ch.position.set(s * 0.095, 1.73, 1.25); ch.rotation.x = -0.75; bridle.add(ch); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 14), METAL); ring.position.set(s * 0.09, 1.58, 1.43); ring.rotation.y = Math.PI / 2; bridle.add(ring); }
  const reins = new THREE.Mesh(taper([V(-0.09, 1.58, 1.43), V(-0.12, 1.38, 1.15), V(0, 1.62, 0.78), V(0.12, 1.38, 1.15), V(0.09, 1.58, 1.43)], 0.007, 0.007, 30, 6), LEATHER); bridle.add(reins);
  // âncora da sela para o cavaleiro (S-242)
  const seatA = new THREE.Object3D(); at('chest', seatA, 0, 1.6, 0.18);
  // asas de penas (Pégaso)
  let wings = null;
  if (opts.wings) {
    const WC = { coat: D.coat || D.wool, wing: D.wing || '#f4f2ee', tip: D.tip || '#c9ccd6' };
    wings = [-1, 1].map(s => { const w = featherWing(s, WC); w.g.scale.setScalar(1.3); w.g.position.set(s * 0.2, 1.42, 0.5); bones.chest.add(w.g); w.g.position.sub(new THREE.Vector3(...HORSE_BONES.chest[1])); return { ...w, s }; });
  }
  rig.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  saddle.visible = opts.saddle !== false; bridle.visible = opts.saddle !== false;
  let light = null;
  if (D.glow) { light = vlight(D.mane, 0.8, 4); light.position.set(0, 1.9, 0.9); obj.add(light); }
  let ph = 0, gait = 0, run = 0, look = 0, air = 0, pitch = 0, blinkAt = 2, flapT = -99;
  return {
    obj, saddleY: 1.6, name: D.name, seat: { anchor: seatA, half: 0.33, stirrup: 0.56, reach: 0.38, footZ: -0.04 },
    flap(t) { flapT = t; },
    animate(t, m, dt) {
      const s = m.speed;
      gait += (Math.min(1, s * 1.3) - gait) * (1 - Math.exp(-dt * 6));
      run += ((s > 0.9 ? 1 : 0) - run) * (1 - Math.exp(-dt * 4));
      air += ((m.air ? 1 : 0) - air) * (1 - Math.exp(-dt * 10));
      ph += dt * (2.0 + s * 7.5);
      for (const sd of [-1, 1]) for (const front of [true, false]) {
        // passo/trote: diagonais juntas; galope: pares quase juntos com a frente adiantada
        const walkOff = (front ? 0 : 0.5) + (sd > 0 ? 0.5 : 0) + (front ? 0 : 0.25), runOff = (front ? 0.0 : 0.45) + (sd > 0 ? 0.08 : 0);
        const p = ph + Math.PI * 2 * (walkOff * (1 - run) + runOff * run), sw = Math.sin(p), lift = Math.max(0, Math.cos(p)), g = gait * (1 - air), amp = 0.34 + run * 0.3;
        if (front) { R('up' + sd).x = sw * amp * g - 0.9 * air; R('fo' + sd).x = -sw * 0.1 * g; R('ca' + sd).x = lift * (1.1 + run * 0.4) * g + 1.6 * air; R('pa' + sd).x = -lift * 0.5 * g - 0.3 * air; }
        else { R('th' + sd).x = sw * amp * g + 0.6 * air; R('sh' + sd).x = -lift * (0.4 + run * 0.3) * g - 0.3 * air; R('mt' + sd).x = lift * (0.7 + run * 0.3) * g + 0.5 * air; R('pb' + sd).x = -lift * 0.5 * g; }
      }
      body.position.y = Math.abs(Math.sin(ph)) * (0.03 + run * 0.06) * gait * (1 - air) + Math.sin(t * 1.3) * 0.006 * (1 - gait);
      pitch += ((m.air ? (m.vy > 0 ? 0.16 : -0.14) : 0) - pitch) * (1 - Math.exp(-dt * 7));
      body.rotation.x = pitch + Math.sin(ph * 2) * 0.02 * run * gait; body.rotation.z = -m.turn * 0.05 * gait;
      look += ((gait > 0.2 ? -m.turn * 0.12 : Math.sin(t * 0.4) * 0.3) - look) * (1 - Math.exp(-dt * 4));
      R('neck').y = look * 0.6; R('head').y = look * 0.4;
      R('neck').x = Math.sin(ph * 2) * (0.04 + run * 0.06) * gait + (1 - gait) * (Math.sin(t * 0.6) * 0.04 + 0.04) + air * 0.15;
      R('head').x = -Math.sin(ph * 2) * 0.05 * gait + (1 - gait) * Math.sin(t * 0.9 + 1) * 0.04;
      R('chest').x = Math.sin(ph * 2) * 0.03 * run * gait; R('hips').x = -Math.sin(ph * 2) * 0.025 * run * gait;
      mane.rotation.z = Math.sin(t * 3) * 0.04 * (0.3 + gait);
      tailSegs.forEach((g, k) => { g.rotation.x = (k === 0 ? 0.35 : 0.12) + gait * (0.25 + run * 0.3) * (k === 0 ? 1 : 0.4) + air * 0.4; g.rotation.y = Math.sin(t * (1.4 + s * 3) - k * 0.5) * (0.06 + k * 0.05) - m.turn * 0.05 * k; });
      let bl = 0; if (t > blinkAt) { const q = (t - blinkAt) / 0.16; bl = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) blinkAt = t + 2.5 + Math.random() * 4; }
      for (const l of lids) l.rotation.x = -1.75 + bl * 1.5;
      if (wings) { // asas dobradas junto ao corpo; abertas no ar / no salto e de vez em quando se esticam e batem
        const ft = t - flapT, open = Math.max(air, ft > 0 && ft < 3.2 ? Math.sin(Math.min(1, ft / 3.2) * Math.PI) : 0), beat = Math.sin(t * 7) * open;
        for (const w of wings) {
          const s2 = w.s; w.g.rotation.set(0.15 - open * 0.25, s2 * (1.25 - open * 1.1), s2 * (-0.25 + open * (0.75 + beat * 0.45)));
          w.fore.rotation.y = s2 * (-2.3 + open * 2.1); w.hand.rotation.y = s2 * (2.6 - open * 2.4); w.fore.rotation.z = s2 * beat * 0.25;
        }
      }
      if (light) light.intensity = 0.7 + Math.sin(t * 3) * 0.12;
    },
    get bodyY() { return body.position.y; },
  };
}

/* S-230: Pégaso (o Noctívago dos voos) — o mesmo cavalo de verdade, pelagem prata-azulada,
   crina e cauda claras e longas, e grandes asas de penas (nada de morcego). */
export const PEGASUS = { name: 'Noctívago', coat: '#c9cedb', points: '#9aa0b4', muzzle: '#6a6474', mane: '#f2f2fa', wing: '#fbfbff', tip: '#b9c2dc', blanket: '#5a2a3a', socks: 0.5 };
export function makePegasus(D = PEGASUS) { return makeHorse(D, { wings: true, saddle: false }); }
