/* =========================================================================
   MONSTROS FOFOS 3D feitos em código (enquanto não há modelos próprios).
   Cada função devolve { root, animate(t, moving, dt) }. Altura ~1 m * size.
   ========================================================================= */
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...extra });
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

export function wolf(color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const c = mat(color), dark = mat(new THREE.Color(color).offsetHSL(0, 0, -0.12));
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.95), c); torso.position.y = 0.62; body.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.36), c); head.position.set(0, 0.86, 0.6); body.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.24), dark); snout.position.set(0, 0.8, 0.84); body.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), BLACK); nose.position.set(0, 0.86, 0.97); body.add(nose);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), dark); ear.position.set(s * 0.11, 1.07, 0.55); body.add(ear); }
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffd84a' });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat); e.position.set(s * 0.09, 0.92, 0.79); body.add(e); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.45), dark); tail.position.set(0, 0.78, -0.62); tail.rotation.x = 0.6; body.add(tail);
  const legs = [[-0.14, 0.33], [0.14, 0.33], [-0.14, -0.33], [0.14, -0.33]].map(([x, z]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.48, z);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.48, 0.11), dark); l.position.y = -0.24; pivot.add(l); body.add(pivot); return pivot;
  });
  shadowAll(root);
  return { root, eyeMat, animate(t, moving) {
    const f = moving ? 12 : 0;
    legs.forEach((lg, i) => { lg.rotation.x = moving ? Math.sin(t * f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0; });
    body.position.y = moving ? Math.abs(Math.sin(t * f)) * 0.05 : Math.sin(t * 2) * 0.01;
    tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.4;
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
