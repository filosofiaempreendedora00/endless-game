/* =========================================================================
   MONTARIAS — feitas em código. Corcel Lanudo: um bicho de montaria robusto,
   meio cavalo, meio carneiro, com lã fofa e chifres enrolados.
   makeMount(kind) devolve { obj, animate(t, {speed, turn}, dt), saddleY }.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export const MOUNTS = {
  lanudo: { name: 'Corcel Lanudo', desc: 'Lã creme, calmo e confiável.', wool: '#efe3c8', skin: '#8a6a4a', horn: '#d8c9a8', mane: '#c9b48a', blanket: '#b8403a' },
  noturno: { name: 'Corcel da Noite', desc: 'Lã escura com crina que brilha em azul.', wool: '#3a3848', skin: '#22202a', horn: '#9aa6c8', mane: '#5ab0ff', blanket: '#2f4f9a', glow: true },
  real: { name: 'Corcel Real', premium: true, price: 900, rarity: 'epica', desc: 'Lã branca como nuvem e crina dourada que brilha.', wool: '#f6f2ea', skin: '#c9b48a', horn: '#ffd76a', mane: '#ffd76a', blanket: '#6a2a8a', glow: true },
  estelar: { name: 'Corcel Estelar', premium: true, price: 1800, rarity: 'lendaria', desc: 'Lã azul-noite e crina de luz violeta: deixa o céu com inveja.', wool: '#20264a', skin: '#141830', horn: '#cfd8ff', mane: '#b47aff', blanket: '#2a3a8a', glow: true },
  ruivo: { name: 'Corcel Ruivo', desc: 'Pelagem cor de canela, cheio de energia.', wool: '#c9733a', skin: '#6a3a22', horn: '#efd9a8', mane: '#8a3a1a', blanket: '#3f7a3a' },
  // S-136: grandes felinos (premium) — anatomia de felino de verdade, pelagem fina pintada (sem "espinhos")
  leopardo: { name: 'Leopardo das Dunas', premium: true, price: 1500, rarity: 'epica', cat: 'leopardo', desc: 'Felino dourado com rosetas escuras: silencioso, ágil e elegante.', wool: '#d9a85a', skin: '#2a1e16', horn: '#f3e2c0', mane: '#3a2614', blanket: '#7a1f2a' },
  pantera_neve: { name: 'Pantera da Geada', premium: true, price: 1500, rarity: 'epica', cat: 'neve', desc: 'Pelagem cinza-gelo com rosetas de carvão e cauda longa e felpuda, nascida no Vale da Geada.', wool: '#d8d8d2', skin: '#3a3a40', horn: '#f4f4ee', mane: '#4a4a52', blanket: '#2a4a7a' },
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
    // pata da frente: escápula, braço, antebraço, mão
    E([s * 0.15, 0.97, 0.42], [0.08, 0.2, 0.14], 'up' + s, 0.08);
    C([s * 0.16, 0.9, 0.43], [s * 0.15, 0.6, 0.36], 0.13, 0.09, 'up' + s);
    C([s * 0.15, 0.6, 0.36], [s * 0.15, 0.13, 0.42], 0.088, 0.066, 'fo' + s, 0.05);
    E([s * 0.15, 0.055, 0.46], [0.082, 0.052, 0.105], 'pa' + s, 0.05);
    // pata de trás: coxa, perna, metatarso, pé
    E([s * 0.14, 0.9, -0.62], [0.11, 0.24, 0.2], 'th' + s, 0.08);
    C([s * 0.15, 0.92, -0.6], [s * 0.15, 0.58, -0.44], 0.13, 0.085, 'th' + s);
    C([s * 0.15, 0.58, -0.44], [s * 0.15, 0.3, -0.72], 0.085, 0.06, 'sh' + s, 0.05);
    C([s * 0.15, 0.3, -0.72], [s * 0.15, 0.08, -0.64], 0.055, 0.05, 'mt' + s, 0.04);
    E([s * 0.15, 0.05, -0.58], [0.07, 0.045, 0.095], 'mt' + s, 0.04);
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
  const parts = catParts(kind), H = 0.022, X0 = -0.5, Y0 = -0.02, Z0 = -1.02, NX = Math.ceil(1.0 / H) + 1, NY = Math.ceil(1.72 / H) + 1, NZ = Math.ceil(2.32 / H) + 1;
  const F = new Float32Array(NX * NY * NZ).fill(0.25), id = (i, j, k) => (k * NY + j) * NX + i;
  const field = (x, y, z) => { let d = 0.25; for (const P of parts) d = smin(d, sdPrim(x, y, z, P), P.k); return d; };
  // cada parte só é calculada dentro da sua caixa (o resto do volume fica "fora"): rápido
  for (const P of parts) {
    const pad = P.k + 0.05, lo = P.a ? [0, 1, 2].map(q => Math.min(P.a[q], P.b[q]) - Math.max(P.r0, P.r1) - pad) : P.c.map((c, q) => c - P.r[q] - pad), hi = P.a ? [0, 1, 2].map(q => Math.max(P.a[q], P.b[q]) + Math.max(P.r0, P.r1) + pad) : P.c.map((c, q) => c + P.r[q] + pad);
    const i0 = Math.max(0, Math.floor((lo[0] - X0) / H)), i1 = Math.min(NX - 1, Math.ceil((hi[0] - X0) / H)), j0 = Math.max(0, Math.floor((lo[1] - Y0) / H)), j1 = Math.min(NY - 1, Math.ceil((hi[1] - Y0) / H)), k0 = Math.max(0, Math.floor((lo[2] - Z0) / H)), k1 = Math.min(NZ - 1, Math.ceil((hi[2] - Z0) / H));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const n = id(i, j, k); F[n] = smin(F[n], sdPrim(X0 + i * H, Y0 + j * H, Z0 + k * H, P), P.k); }
  }
  const vIdx = new Int32Array(NX * NY * NZ).fill(-1), pos = [];
  for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    let sx = 0, sy = 0, sz = 0, n = 0, neg = 0;
    for (let c = 0; c < 8; c++) if (F[id(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))] < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
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
    // aresta em x: quads com as células (j-1..j, k-1..k)
    if ((F[id(i + 1, j, k)] < 0) !== f0) { const a = vIdx[id(i, j - 1, k - 1)], b = vIdx[id(i, j, k - 1)], c = vIdx[id(i, j, k)], d = vIdx[id(i, j - 1, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c); }
    if ((F[id(i, j + 1, k)] < 0) !== f0) { const a = vIdx[id(i - 1, j, k - 1)], b = vIdx[id(i, j, k - 1)], c = vIdx[id(i, j, k)], d = vIdx[id(i - 1, j, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, c, b, a, d, c) : idx.push(a, b, c, a, c, d); }
    if ((F[id(i, j, k + 1)] < 0) !== f0) { const a = vIdx[id(i - 1, j - 1, k)], b = vIdx[id(i, j - 1, k)], c = vIdx[id(i, j, k)], d = vIdx[id(i - 1, j, k)]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) f0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c); }
  }
  const nv = pos.length / 3, nrm = new Float32Array(nv * 3), e = H * 0.5;
  // normais pelo gradiente do campo (lisas, sem facetas)
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = field(x + e, y, z) - field(x - e, y, z), gy = field(x, y + e, z) - field(x, y - e, z), gz = field(x, y, z + e) - field(x, y, z - e); const l = len3(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l; nrm[v * 3 + 1] = gy / l; nrm[v * 3 + 2] = gz / l;
  }
  // pele: cada vértice segue os ossos das partes mais próximas (até 4), com transição suave nas juntas
  const names = Object.keys(CAT_BONES), bi = new Uint16Array(nv * 4), bw = new Float32Array(nv * 4);
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
  return (catGeoCache[kind] = g);
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
      if (uSpots > 0.5) {
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
  let light = null;
  if (D.glow) { light = vlight('#ffcf6a', 0.7, 4); light.position.set(0, 1.8, 0.8); obj.add(light); }
  let ph = 0, gait = 0, run = 0, look = 0, air = 0, pitch = 0;
  const R = n => bones[n].rotation;
  return {
    obj, saddleY: 1.28, name: D.name,
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
