/* =========================================================================
   PALIÇADA — muro de troncos feito em código (S-072).
   Troncos encostados (sem um entrar no outro), topo arredondado e serrado
   (nada de "lápis"), enterrados 60 cm no chão (nada flutua), duas travessas
   amarradas por dentro e postes mais grossos no portão.
   Tudo em InstancedMesh: centenas de troncos custam 3 chamadas de desenho.
   ========================================================================= */
import * as THREE from 'three';

const rngOf = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// tronco unitário (raio 1, altura 1): leve afunilamento, topo serrado com borda arredondada
function logGeometry() {
  const prof = [new THREE.Vector2(0.001, 0)];
  for (let k = 0; k <= 8; k++) { const t = k / 8; prof.push(new THREE.Vector2(1 - t * 0.08, t * 0.93)); }
  for (let k = 1; k <= 6; k++) { const a = k / 6 * Math.PI / 2; prof.push(new THREE.Vector2(0.92 * Math.cos(a) * 0.55 + 0.92 * 0.45 * (1 - k / 6), 0.93 + Math.sin(a) * 0.07)); }
  prof.push(new THREE.Vector2(0.001, 1));
  const g = new THREE.LatheGeometry(prof, 14);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const bark = new THREE.Color('#5b3f27'), barkL = new THREE.Color('#7a5838'), wood = new THREE.Color('#c9a672'), ring = new THREE.Color('#9c7848');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    if (y > 0.985) c.copy(wood).lerp(ring, (Math.sin(r * 30) * 0.5 + 0.5) * 0.7); // anéis da madeira no corte
    else c.copy(bark).lerp(barkL, (Math.sin(a * 9 + y * 3) * 0.5 + 0.5) * 0.55 + (Math.sin(a * 23 + y * 40) * 0.5 + 0.5) * 0.2); // casca com veios
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * pts: [{x,z}] ao longo do traçado (já em metros), em ordem.
 * heightAt: altura do chão. inside: {x,z} (lado de dentro, onde ficam as travessas).
 * Devolve { group, colliders: [{x,z,r,box,hx,hz,rot}], marks: [{x,z}] }.
 */
export function makePalisade(pts, heightAt, inside, opts = {}) {
  const rng = rngOf(opts.seed || 4242);
  const logs = [];
  // caminha pelo traçado colocando troncos encostados (distância = soma dos raios)
  let seg = 0, t = 0, prevR = 0;
  const segLen = i => Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  const advance = d => { while (seg < pts.length - 1) { const L = segLen(seg), left = L * (1 - t); if (d <= left) { t += d / L; return true; } d -= left; seg++; t = 0; } return false; };
  const at = () => { const a = pts[seg], b = pts[Math.min(seg + 1, pts.length - 1)]; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }; };
  const gateR = 0.27;
  for (let first = true; ; first = false) {
    const big = first; // poste do portão no começo
    const r = big ? gateR : 0.13 + rng() * 0.05;
    if (!first && !advance(prevR + r - 0.012)) break;
    logs.push({ ...at(), r, h: big ? 3.0 : 2.05 + rng() * 0.45 });
    prevR = r;
  }
  if (logs.length > 1) { const L = logs[logs.length - 1]; L.r = gateR; L.h = 3.0; } // poste do portão no fim
  const n = logs.length;
  const geo = logGeometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const posts = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
  const BURY = 0.6;
  logs.forEach((L, i) => {
    let gy = heightAt(L.x, L.z); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; gy = Math.min(gy, heightAt(L.x + Math.cos(a) * L.r, L.z + Math.sin(a) * L.r)); } // assenta no ponto mais baixo
    L.gy = gy;
    e.set((rng() - 0.5) * 0.04, rng() * Math.PI * 2, (rng() - 0.5) * 0.04); q.setFromEuler(e);
    ps.set(L.x, gy - BURY, L.z); sc.set(L.r, L.h + BURY, L.r);
    posts.setMatrixAt(i, m.compose(ps, q, sc));
    posts.setColorAt(i, c.setHSL(0.07 + (rng() - 0.5) * 0.02, 0.25 + rng() * 0.15, 0.82 + rng() * 0.3));
  });
  posts.castShadow = true; posts.receiveShadow = true;
  // travessas por dentro: vão de ~2,8 m em ~2,8 m, a 0,55 m e 1,6 m do chão, com amarração
  const bays = [];
  for (let i = 0; i < n - 1;) { let j = i + 1, d = 0; while (j < n - 1 && d < 2.8) { d += Math.hypot(logs[j].x - logs[j - 1].x, logs[j].z - logs[j - 1].z); j++; } bays.push([i, j]); i = j; }
  const railGeo = new THREE.CylinderGeometry(1, 1, 1, 12); railGeo.rotateZ(Math.PI / 2); // eixo no X
  const rails = new THREE.InstancedMesh(railGeo, new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.9 }), bays.length * 2);
  const ropeGeo = new THREE.TorusGeometry(1, 0.22, 8, 18);
  const ropes = new THREE.InstancedMesh(ropeGeo, new THREE.MeshStandardMaterial({ color: '#b39a6a', roughness: 1 }), bays.length * 4);
  let ri = 0, oi = 0;
  const colliders = [], marks = [];
  for (const [i, j] of bays) {
    const A = logs[i], B = logs[j];
    // lado de dentro: normal do vão apontando para "inside"
    let nx = -(B.z - A.z), nz = B.x - A.x; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2; if ((inside.x - mx) * nx + (inside.z - mz) * nz < 0) { nx = -nx; nz = -nz; }
    const len = Math.hypot(B.x - A.x, B.z - A.z) + 0.5, rot = Math.atan2(-(B.z - A.z), B.x - A.x);
    for (const hy of [0.55, 1.6]) {
      const off = 0.2, rr = 0.075 + rng() * 0.015;
      const y = (A.gy + B.gy) / 2 + hy;
      e.set(0, rot, (rng() - 0.5) * 0.03); q.setFromEuler(e);
      rails.setMatrixAt(ri++, m.compose(ps.set(mx + nx * off, y, mz + nz * off), q, sc.set(len, rr, rr)));
      for (const P of [A, B]) { // amarração de corda no tronco da ponta
        e.set(Math.PI / 2, 0, 0); q.setFromEuler(e);
        ropes.setMatrixAt(oi++, m.compose(ps.set(P.x, P.gy + hy, P.z), q, sc.set(P.r + 0.02, P.r + 0.02, 0.05)));
      }
    }
    // colisão: caixa girada do vão inteiro (nada de atravessar entre os troncos)
    const hx = (Math.hypot(B.x - A.x, B.z - A.z)) / 2 + 0.15, hz = 0.32;
    colliders.push({ x: mx, z: mz, r: Math.max(hx, hz), box: true, hx, hz, rot, name: 'palisade' });
    marks.push({ x: mx, z: mz });
  }
  rails.count = ri; ropes.count = oi;
  rails.castShadow = true; rails.receiveShadow = true;
  const group = new THREE.Group(); group.add(posts, rails, ropes);
  for (const o of [posts, rails, ropes]) { o.computeBoundingSphere(); o.frustumCulled = true; }
  return { group, colliders, marks };
}
