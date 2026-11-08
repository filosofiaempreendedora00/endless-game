/* =========================================================================
   MONTARIAS — feitas em código. Corcel Lanudo: um bicho de montaria robusto,
   meio cavalo, meio carneiro, com lã fofa e chifres enrolados.
   makeMount(kind) devolve { obj, animate(t, {speed, turn}, dt), saddleY }.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';

export const MOUNTS = {
  lanudo: { name: 'Corcel Lanudo', desc: 'Lã creme, calmo e confiável.', wool: '#efe3c8', skin: '#8a6a4a', horn: '#d8c9a8', mane: '#c9b48a', blanket: '#b8403a' },
  noturno: { name: 'Corcel da Noite', desc: 'Lã escura com crina que brilha em azul.', wool: '#3a3848', skin: '#22202a', horn: '#9aa6c8', mane: '#5ab0ff', blanket: '#2f4f9a', glow: true },
  real: { name: 'Corcel Real', premium: true, price: 900, rarity: 'epica', desc: 'Lã branca como nuvem e crina dourada que brilha.', wool: '#f6f2ea', skin: '#c9b48a', horn: '#ffd76a', mane: '#ffd76a', blanket: '#6a2a8a', glow: true },
  estelar: { name: 'Corcel Estelar', premium: true, price: 1800, rarity: 'lendaria', desc: 'Lã azul-noite e crina de luz violeta: deixa o céu com inveja.', wool: '#20264a', skin: '#141830', horn: '#cfd8ff', mane: '#b47aff', blanket: '#2a3a8a', glow: true },
  ruivo: { name: 'Corcel Ruivo', desc: 'Pelagem cor de canela, cheio de energia.', wool: '#c9733a', skin: '#6a3a22', horn: '#efd9a8', mane: '#8a3a1a', blanket: '#3f7a3a' },
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
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 12), COAT); ear.position.set(s * 0.09, 0.2, -0.05); ear.rotation.set(-0.2, 0, -s * 0.2); head.add(ear);
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
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.1, 14), DARK); hoof.position.y = -0.49; knee.add(hoof);
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
  for (const zz of [-0.4, 0.36]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.012, 6, 28, Math.PI * 0.84), trim); t.rotation.z = Math.PI / 2 - Math.PI * 0.42 + Math.PI; t.rotation.y = 0; t.position.set(0, 1.12, zz); body.add(t); }
  const seat = new THREE.Mesh(taper([V(0, 0, -0.3), V(0, -0.04, -0.05), V(0, -0.02, 0.15), V(0, 0.06, 0.28)], 0.2, 0.13, 12, 14), LEATHER); seat.scale.set(1.15, 0.45, 1); seat.position.set(0, 1.52, 0); body.add(seat);
  body.add(blob(0.08, 1, 1.3, 0.8, LEATHER, 0, 1.6, 0.3, 12));
  body.add(blob(0.13, 1.4, 0.7, 0.6, LEATHER, 0, 1.56, -0.28, 12));
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.04), LEATHER); strap.position.set(s * 0.38, 1.25, 0.04); strap.rotation.z = s * 0.12; body.add(strap);
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14), METAL); st.position.set(s * 0.42, 0.98, 0.04); body.add(st);
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
