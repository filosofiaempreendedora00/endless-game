/* =========================================================================
   MONSTROS FOFOS 3D feitos em código (enquanto não há modelos próprios).
   Cada função devolve { root, animate(t, moving, dt) }. Altura ~1 m * size.
   ========================================================================= */
import * as THREE from 'three';

// sombreado suave (nada de facetas quadradas)
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: false, ...extra });
const BLACK = mat('#1e1a2a', { roughness: 0.4 });
const WHITE = mat('#ffffff', { roughness: 0.4 });

function eyes(parent, y, z, spread, r = 0.07) {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), BLACK);
    e.position.set(s * spread, y, z); parent.add(e);
    const g = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 6, 6), WHITE);
    g.position.set(s * spread + r * 0.3, y + r * 0.35, z + r * 0.8); parent.add(g);
  }
}
const shadowAll = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

export function slime(color, boss) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(color, { roughness: 0.25, transparent: true, opacity: 0.92 }));
  m.scale.set(1, 0.8, 1); m.position.y = 0.4; body.add(m);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  shine.position.set(-0.18, 0.62, 0.25); body.add(shine);
  eyes(body, 0.5, 0.42, 0.14);
  if (boss) { // coroinha de geleia
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.25, 5), mat('#ffd84a', { metalness: 0.6, roughness: 0.3 }));
    crown.position.y = 0.86; body.add(crown);
  }
  shadowAll(root);
  return { root, animate(t, moving) {
    const f = moving ? 9 : 3.5, a = moving ? 0.16 : 0.07;
    const k = Math.sin(t * f);
    body.scale.set(1 + k * a, 1 - k * a, 1 + k * a);
    body.position.y = moving ? Math.max(0, Math.sin(t * f * 0.5)) * 0.25 : 0;
  } };
}

export function mushroom(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.45, 10), mat('#efe4d0'));
  stem.position.y = 0.23; body.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
  cap.scale.y = 0.75; cap.position.y = 0.42; body.add(cap);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), WHITE);
    s.position.set(Math.cos(a) * 0.27, 0.62, Math.sin(a) * 0.27); body.add(s);
  }
  eyes(body, 0.28, 0.2, 0.08, 0.05);
  shadowAll(root);
  return { root, animate(t, moving) {
    body.position.y = moving ? Math.abs(Math.sin(t * 8)) * 0.18 : 0;
    body.rotation.z = Math.sin(t * 2) * 0.05;
  } };
}

export function rabbit(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(color)); b.scale.set(0.9, 0.8, 1.15); b.position.y = 0.3; body.add(b);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(color)); head.position.set(0, 0.52, 0.28); body.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 4, 8), mat(color)); ear.position.set(s * 0.08, 0.82, 0.22); ear.rotation.z = s * 0.15; body.add(ear);
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 4, 6), mat('#ffb3c4')); inner.position.set(s * 0.08, 0.82, 0.25); inner.rotation.z = s * 0.15; body.add(inner);
  }
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), mat('#e8c860')); horn.position.set(0, 0.7, 0.4); horn.rotation.x = 0.6; body.add(horn);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), WHITE); tail.position.set(0, 0.32, -0.33); body.add(tail);
  eyes(body, 0.56, 0.44, 0.09, 0.04);
  shadowAll(root);
  return { root, animate(t, moving) { body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.3 : 0; } };
}

export function bee(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(color)); b.scale.set(0.9, 0.85, 1.2); body.add(b);
  for (const z of [-0.08, 0.08]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 16), BLACK); s.position.z = z; body.add(s); }
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), BLACK); sting.position.z = -0.37; sting.rotation.x = -Math.PI / 2; body.add(sting);
  eyes(body, 0.08, 0.3, 0.1, 0.05);
  const wingMat = new THREE.MeshStandardMaterial({ color: '#e6f0ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const wings = [-1, 1].map(s => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), wingMat); w.position.set(s * 0.18, 0.22, 0); w.rotation.y = s * 0.4; body.add(w); return w; });
  body.position.y = 1.1;
  shadowAll(root);
  return { root, animate(t) {
    body.position.y = 1.1 + Math.sin(t * 4) * 0.12;
    wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 40) * 0.6 * (i ? 1 : -1); });
  } };
}

// lobo com formas orgânicas: tronco em cápsula, juba de pelo, focinho afinado, patas com articulação e rabo felpudo
export function wolf(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const base = new THREE.Color(color), c = mat(base), dark = mat(base.clone().offsetHSL(0, 0, -0.1)), light = mat(base.clone().offsetHSL(0, -0.05, 0.14));
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 8, 16), c); torso.rotation.x = Math.PI / 2; torso.scale.set(1, 1.05, 1); torso.position.set(0, 0.64, -0.02); body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), c); chest.scale.set(0.95, 1.05, 0.9); chest.position.set(0, 0.7, 0.3); body.add(chest);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), light); belly.scale.set(0.9, 0.7, 1.6); belly.position.set(0, 0.56, 0.18); body.add(belly);
  // juba (tufos de pelo no pescoço)
  const tuft = new THREE.IcosahedronGeometry(0.11, 2);
  for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.6; const t = new THREE.Mesh(tuft, i % 2 ? c : light); t.position.set(Math.sin(a) * 0.2, 0.82 + Math.cos(a) * 0.1, 0.36 - Math.abs(Math.sin(a)) * 0.06); t.scale.set(1, 1.3, 0.8); body.add(t); }
  const neck = new THREE.Group(); neck.position.set(0, 0.86, 0.42); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.08, 0.14); neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), c); skull.scale.set(1, 0.92, 1.05); head.add(skull);
  for (const s of [-1, 1]) { const ck = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), light); ck.scale.set(1, 0.8, 1.2); ck.position.set(s * 0.1, -0.06, 0.06); head.add(ck); }
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.1, 0.26, 14), light); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.05, 0.22); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), BLACK); nose.scale.set(1.3, 0.9, 1); nose.position.set(0, -0.02, 0.35); head.add(nose);
  const ears = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.17, 12), dark); e.position.set(s * 0.1, 0.15, -0.02); e.rotation.z = -s * 0.25; head.add(e); return e; });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb020', emissiveIntensity: 0.5, roughness: 0.3 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), eyeMat); e.scale.set(1.4, 0.8, 0.6); e.position.set(s * 0.075, 0.03, 0.15); e.rotation.z = s * 0.25; head.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), BLACK); p.position.set(s * 0.075, 0.03, 0.168); head.add(p); }
  // rabo curvo e felpudo
  const tail = new THREE.Group(); tail.position.set(0, 0.74, -0.42); body.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.06, -0.18), new THREE.Vector3(0, -0.18, -0.34), new THREE.Vector3(0, -0.34, -0.42)]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 14, 0.07, 10); const tp = tailGeo.attributes.position; // afina na ponta
  tail.add(new THREE.Mesh(tailGeo, c));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), light); tip.scale.set(1, 1.5, 1); tip.position.set(0, -0.36, -0.43); tail.add(tip);
  // patas: coxa + canela + pata
  const legs = [[-0.12, 0.3, true], [0.12, 0.3, true], [-0.12, -0.3, false], [0.12, -0.3, false]].map(([x, z, front]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.6, z); body.add(pivot);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(front ? 0.065 : 0.08, 0.2, 6, 10), c); up.position.y = -0.14; pivot.add(up);
    const knee = new THREE.Group(); knee.position.y = -0.28; pivot.add(knee);
    const low = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 10), dark); low.position.y = -0.12; knee.add(low);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), dark); paw.scale.set(1, 0.6, 1.3); paw.position.set(0, -0.27, 0.03); knee.add(paw);
    return { pivot, knee, front };
  });
  shadowAll(root);
  let ph = 0, gait = 0;
  return { root, eyeMat, animate(t, moving, dt = 1 / 60) {
    gait += ((moving ? 1 : 0) - gait) * Math.min(1, dt * 6);
    ph += dt * (2 + gait * 10);
    legs.forEach(({ pivot, knee, front }, i) => { const p = ph + (i % 2 ? Math.PI : 0) + (front ? 0 : Math.PI * 0.5); pivot.rotation.x = Math.sin(p) * 0.6 * gait; knee.rotation.x = (front ? -1 : 1) * Math.max(0, Math.cos(p)) * 0.7 * gait; });
    body.position.y = Math.abs(Math.sin(ph)) * 0.045 * gait + Math.sin(t * 2) * 0.008 * (1 - gait);
    body.rotation.x = Math.sin(ph * 2) * 0.03 * gait;
    neck.rotation.x = Math.sin(ph * 2) * 0.05 * gait + Math.sin(t * 0.8) * 0.04 * (1 - gait);
    neck.rotation.y = Math.sin(t * 0.5) * 0.25 * (1 - gait);
    ears.forEach((e, i) => { e.rotation.x = -0.25 * gait + Math.sin(t * 2.3 + i) * 0.04; });
    tail.rotation.y = Math.sin(t * (2.5 + gait * 6)) * 0.35; tail.rotation.x = 0.35 * gait - 0.1;
  } };
}

export function makeCritter(shape, color, boss) {
  switch (shape) {
    case 'blob': return slime(color, boss);
    case 'mushroom': return mushroom(color);
    case 'rabbit': return rabbit(color);
    case 'bee': return bee(color);
    case 'wolf': return wolf(color);
    default: return slime(color);
  }
}
