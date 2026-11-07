/* =========================================================================
   LUZES VIRTUAIS — no three.js cada PointLight entra no cálculo de TODOS os
   pixels de TODOS os objetos (mesmo longe). Com ~20 luzes o jogo ficava 8×
   mais lento. Aqui cada fonte de luz é só um marcador (vlight) e o jogo usa
   um pequeno "pool" de luzes reais, levadas a cada quadro para as fontes
   mais próximas de você. De perto fica igual; o custo fica fixo e baixo.
   ========================================================================= */
import * as THREE from 'three';

export const VLIGHTS = new Set();
// mesmo jeito de usar que new THREE.PointLight(cor, intensidade, alcance, decaimento)
export function vlight(color, intensity = 1, distance = 5, decay = 2) {
  const o = new THREE.Object3D();
  o.isVLight = true; o.color = new THREE.Color(color); o.intensity = intensity; o.distance = distance; o.decay = decay;
  VLIGHTS.add(o);
  return o;
}
const inScene = (o, scene) => { let p = o; while (p) { if (p === scene) return true; if (!p.visible) return false; p = p.parent; } return false; };

export function makeLightPool(scene, n = 3) {
  const pool = Array.from({ length: n }, () => { const l = new THREE.PointLight('#ffffff', 0, 1, 2); l.layers.enable(1); scene.add(l); return l; });
  const tmp = new THREE.Vector3(), cand = [];
  return function update(focus) {
    cand.length = 0;
    for (const o of VLIGHTS) {
      if (!o.parent) { if (o.userData.dead) VLIGHTS.delete(o); continue; }
      if (!inScene(o, scene)) continue;
      o.getWorldPosition(tmp);
      const d = tmp.distanceTo(focus);
      if (d > o.distance + 18) continue;
      cand.push({ o, d: d / Math.max(0.3, Math.sqrt(o.intensity)), x: tmp.x, y: tmp.y, z: tmp.z });
    }
    cand.sort((a, b) => a.d - b.d);
    pool.forEach((l, i) => {
      const c = cand[i];
      if (!c) { l.intensity = 0; return; }
      l.position.set(c.x, c.y, c.z); l.color.copy(c.o.color); l.intensity = c.o.intensity; l.distance = c.o.distance; l.decay = c.o.decay;
    });
  };
}
