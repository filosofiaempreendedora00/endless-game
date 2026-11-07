/* =========================================================================
   MONTARIAS — feitas em código. Corcel Lanudo: um bicho de montaria robusto,
   meio cavalo, meio carneiro, com lã fofa e chifres enrolados.
   makeMount(kind) devolve { obj, animate(t, {speed, turn}, dt), saddleY }.
   ========================================================================= */
import * as THREE from 'three';

export const MOUNTS = {
  lanudo: { name: 'Corcel Lanudo', desc: 'Lã creme, calmo e confiável.', wool: '#efe3c8', skin: '#8a6a4a', horn: '#d8c9a8', mane: '#c9b48a', blanket: '#b8403a' },
  noturno: { name: 'Corcel da Noite', desc: 'Lã escura com crina que brilha em azul.', wool: '#3a3848', skin: '#22202a', horn: '#9aa6c8', mane: '#5ab0ff', blanket: '#2f4f9a', glow: true },
  real: { name: 'Corcel Real', premium: true, price: 900, rarity: 'epica', desc: 'Lã branca como nuvem e crina dourada que brilha.', wool: '#f6f2ea', skin: '#c9b48a', horn: '#ffd76a', mane: '#ffd76a', blanket: '#6a2a8a', glow: true },
  estelar: { name: 'Corcel Estelar', premium: true, price: 1800, rarity: 'lendaria', desc: 'Lã azul-noite e crina de luz violeta: deixa o céu com inveja.', wool: '#20264a', skin: '#141830', horn: '#cfd8ff', mane: '#b47aff', blanket: '#2a3a8a', glow: true },
  ruivo: { name: 'Corcel Ruivo', desc: 'Pelagem cor de canela, cheio de energia.', wool: '#c9733a', skin: '#6a3a22', horn: '#efd9a8', mane: '#8a3a1a', blanket: '#3f7a3a' },
};
export const MOUNT_SPEED = 1.7; // multiplicador de velocidade montado

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export function makeMount(kind = 'lanudo') {
  const D = MOUNTS[kind] || MOUNTS.lanudo;
  const obj = new THREE.Group(), body = new THREE.Group(); obj.add(body);
  const WOOL = M(D.wool), SKIN = M(D.skin), HORN = M(D.horn, { roughness: 0.5 });
  const MANE = D.glow ? new THREE.MeshStandardMaterial({ color: D.mane, emissive: D.mane, emissiveIntensity: 0.9, roughness: 0.5 }) : M(D.mane);
  // tronco de lã (vários tufos)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 6, 12), WOOL); torso.rotation.x = Math.PI / 2; torso.position.y = 1.0; body.add(torso);
  const tufts = new THREE.IcosahedronGeometry(0.2, 1);
  for (let i = 0; i < 16; i++) { const a = i * 2.4, k = (i % 8) / 7; const t = new THREE.Mesh(tufts, WOOL); t.position.set(Math.cos(a) * 0.34, 1.0 + Math.sin(a) * 0.3, -0.5 + k * 1.0); t.scale.setScalar(0.8 + (i % 3) * 0.15); body.add(t); }
  // manta e sela
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.75), M(D.blanket)); blanket.position.set(0, 1.42, -0.02); body.add(blanket);
  for (const s of [-1, 1]) { const flap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.7), M(D.blanket)); flap.position.set(s * 0.5, 1.25, -0.02); body.add(flap); }
  const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 12), M('#5a3a22', { roughness: 0.6 })); saddle.scale.z = 1.3; saddle.position.set(0, 1.5, 0); body.add(saddle);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8), M('#4a2e1a')); horn.position.set(0, 1.62, 0.3); body.add(horn);
  // pescoço e cabeça
  const neck = new THREE.Group(); neck.position.set(0, 1.25, 0.62); body.add(neck);
  const nk = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), WOOL); nk.rotation.x = -0.6; nk.position.set(0, 0.25, 0.12); neck.add(nk);
  const head = new THREE.Group(); head.position.set(0, 0.6, 0.32); neck.add(head);
  const skull = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 4, 10), SKIN); skull.rotation.x = Math.PI / 2 - 0.35; skull.position.z = 0.12; head.add(skull);
  const fluff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), WOOL); fluff.position.set(0, 0.14, -0.02); head.add(fluff);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M('#1a1410', { roughness: 0.3 })); eye.position.set(s * 0.13, 0.07, 0.16); head.add(eye);
    // chifre enrolado (espiral)
    const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14, a = u * Math.PI * 1.6; pts.push(new THREE.Vector3(s * (0.12 + Math.sin(a) * 0.14 * (1 - u * 0.4)), 0.15 + Math.cos(a) * 0.14 * (1 - u * 0.4) - u * 0.05, -0.05 - u * 0.12)); }
    const hn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 6), HORN); head.add(hn);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), SKIN); ear.scale.set(1.6, 0.5, 0.8); ear.position.set(s * 0.2, 0.04, 0.02); head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M(D.skin, { roughness: 0.5 })); nose.scale.set(1, 0.8, 0.9); nose.position.set(0, -0.06, 0.3); head.add(nose);
  // crina
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 5), MANE); c.position.set(0, 0.42 - i * 0.1, 0.04 - i * 0.07); c.rotation.x = -0.9; neck.add(c); }
  // patas com cascos (pivô no ombro/quadril)
  const legs = [[-0.24, 0.42], [0.24, 0.42], [-0.24, -0.42], [0.24, -0.42]].map(([x, z], i) => {
    const pv = new THREE.Group(); pv.position.set(x, 0.85, z); body.add(pv);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), WOOL); up.position.y = -0.2; pv.add(up);
    const knee = new THREE.Group(); knee.position.y = -0.42; pv.add(knee);
    const low = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.28, 4, 8), SKIN); low.position.y = -0.17; knee.add(low);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 8), M('#2a2018', { roughness: 0.5 })); hoof.position.y = -0.38; knee.add(hoof);
    return { pv, knee, front: i < 2, side: x > 0 ? 1 : -1 };
  });
  // rabo
  const tail = new THREE.Group(); tail.position.set(0, 1.08, -0.8); body.add(tail);
  const tl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), MANE); tl.scale.set(0.8, 1.2, 1); tl.position.set(0, -0.1, -0.08); tail.add(tl);
  let light = null;
  if (D.glow) { light = new THREE.PointLight(D.mane, 0.8, 4); light.position.set(0, 1.9, 0.6); obj.add(light); }
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  let ph = 0, gait = 0, look = 0;
  return {
    obj, saddleY: 1.52, name: D.name,
    animate(t, m, dt) {
      const s = m.speed;
      gait += (Math.min(1, s * 1.3) - gait) * (1 - Math.exp(-dt * 6));
      ph += dt * (2 + s * 9);
      // trote: patas diagonais juntas, joelho dobra na volta
      legs.forEach(({ pv, knee, front, side }) => {
        const p = ph + (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0); // diagonais juntas (dianteira esq. + traseira dir.)
        pv.rotation.x = Math.sin(p) * 0.55 * gait;
        knee.rotation.x = -Math.max(0, Math.cos(p)) * 0.9 * gait; // dobra o joelho quando a pata volta à frente
      });
      body.position.y = Math.abs(Math.sin(ph)) * 0.07 * gait + Math.sin(t * 1.6) * 0.008 * (1 - gait);
      body.rotation.x = Math.sin(ph * 2) * 0.03 * gait;
      body.rotation.z = -m.turn * 0.05 * gait;
      look += ((gait > 0.2 ? -m.turn * 0.12 : Math.sin(t * 0.5) * 0.25) - look) * (1 - Math.exp(-dt * 4));
      neck.rotation.y = look; neck.rotation.x = Math.sin(ph * 2) * 0.06 * gait - 0.05 * gait;
      head.rotation.x = Math.sin(t * 1.1) * 0.04;
      tail.rotation.y = Math.sin(t * (2 + s * 4)) * 0.3; tail.rotation.x = 0.4 * gait;
      if (light) light.intensity = 0.7 + Math.sin(t * 3) * 0.15;
    },
    get bodyY() { return body.position.y; },
  };
}
