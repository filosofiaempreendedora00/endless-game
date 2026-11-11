/* =========================================================================
   CLIMA POR REGIÃO (P-007)
   - Vale da Geada: neve caindo (flocos de tamanhos variados, deriva e vento leve)
   - Dunas de Sal-Rubro: grãos de areia rasantes em rajadas + véus de poeira translúcidos
   - Ruínas dos Colossos: névoa baixa em camadas, lenta, rente ao chão (não esconde os gigantes)
   Tudo acompanha a câmera (caixa que "dá a volta"), entra/sai suave pelo peso da região
   (zoneWeight) e some dentro de salas. Custo: no máximo 5 chamadas de desenho, só onde há clima.
   ========================================================================= */
import * as THREE from 'three';
import { heightAt, zoneWeight, HALF } from './world3d.js';

let W = null; // estado do clima

function softDot(size = 64, core = 0.35) { // floco/grão: disco suave
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), r = size / 2;
  const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(core, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function wispTex(seed, w = 256, h = 96) { // véu de névoa/poeira: várias bolhas suaves, bordas que somem (nada de retângulo)
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 70; k++) { const px = w * (0.12 + r() * 0.76), py = h * (0.3 + r() * 0.4), rr = 10 + r() * 34, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  const m = x.createLinearGradient(0, 0, w, 0); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.22, 'rgba(0,0,0,0)'); m.addColorStop(0.78, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = m; x.fillRect(0, 0, w, h);
  const m2 = x.createLinearGradient(0, 0, 0, h); m2.addColorStop(0, 'rgba(0,0,0,1)'); m2.addColorStop(0.35, 'rgba(0,0,0,0)'); m2.addColorStop(0.7, 'rgba(0,0,0,0)'); m2.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = m2; x.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// partículas numa caixa em volta da câmera
function particleLayer(n, box, size, color, tex, opacity) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * box[0]; pos[i * 3 + 1] = Math.random() * box[1]; pos[i * 3 + 2] = (Math.random() - 0.5) * box[2]; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const m = new THREE.PointsMaterial({ size, map: tex, color, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, alphaTest: 0.01 });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.visible = false; p.renderOrder = 5;
  return { p, pos, seed, n, box, base: opacity, off: new THREE.Vector3() };
}
// véus (névoa/poeira): quadros instanciados virados para a câmera, uma chamada de desenho
function veilLayer(n, tex, color, w, h) {
  const geo = new THREE.PlaneGeometry(1, 1), mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.visible = false; im.renderOrder = 4;
  const items = []; for (let i = 0; i < n; i++) items.push({ x: 0, z: 0, y: 0, w: w * (0.7 + Math.random() * 0.6), h: h * (0.7 + Math.random() * 0.6), ph: Math.random() * 6.28, sp: 0.5 + Math.random(), set: false });
  return { im, mat, items, n };
}

export function initWeather(scene) {
  const dot = softDot(64, 0.3), grain = softDot(32, 0.15);
  W = {
    snowFar: particleLayer(2200, [90, 34, 90], 0.2, '#ffffff', dot, 1),
    snowNear: particleLayer(320, [22, 12, 22], 0.1, '#ffffff', dot, 0.9), // flocos miúdos bem perto da câmera (sem "bolas")
    sand: particleLayer(1600, [60, 3.2, 60], 0.12, '#ecd0a0', grain, 0.95),
    dust: veilLayer(7, wispTex(7), '#d8b27c', 34, 9),
    mist: veilLayer(12, wispTex(19), '#cfd2cf', 46, 7),
    wSnow: 0, wSand: 0, wMist: 0, t: 0,
  };
  for (const k of ['snowFar', 'snowNear', 'sand']) scene.add(W[k].p);
  scene.add(W.dust.im, W.mist.im);
  return W;
}

// P-020: a luz do dia/noite tinge neve, areia, poeira e névoa (à noite não ficam brilhando no escuro)
export function setWeatherLight(c) {
  if (!W) return;
  for (const m of [W.snowFar.p.material, W.snowNear.p.material, W.sand.p.material, W.dust.mat, W.mist.mat]) { if (!m.userData.dnBase) m.userData.dnBase = m.color.clone(); m.color.copy(m.userData.dnBase).multiply(c); }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();
// move uma camada de partículas: "dá a volta" na caixa em volta da câmera para nunca acabar
function stepParticles(L, cam, dt, vel, fn) {
  const { pos, seed, n, box } = L, cx = cam.position.x, cz = cam.position.z, hx = box[0] / 2, hz = box[2] / 2;
  for (let i = 0; i < n; i++) {
    const k = i * 3; let x = pos[k] + vel.x * dt, y = pos[k + 1] + vel.y * dt, z = pos[k + 2] + vel.z * dt;
    if (fn) { const d = fn(i, seed[i]); x += d[0] * dt; y += d[1] * dt; z += d[2] * dt; }
    let rx = x - cx, rz = z - cz; if (rx > hx) x -= box[0]; else if (rx < -hx) x += box[0]; if (rz > hz) z -= box[2]; else if (rz < -hz) z += box[2];
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
  }
  L.p.geometry.attributes.position.needsUpdate = true;
}

export function updateWeather(dt, x, z, inside, cam) {
  if (!W) return;
  dt = Math.min(dt, 0.1); W.t += dt; const t = W.t;
  const out = inside || x > HALF + 100;
  const tSnow = out ? 0 : zoneWeight('geada', x, z), tSand = out ? 0 : zoneWeight('dunas', x, z), tMist = out ? 0 : zoneWeight('colossos', x, z);
  const k = Math.min(1, dt * (out ? 6 : 0.8)); // entra e sai devagar; ao entrar numa sala some na hora
  W.wSnow += (tSnow - W.wSnow) * k; W.wSand += (tSand - W.wSand) * k; W.wMist += (tMist - W.wMist) * k;

  // ---------- neve ----------
  for (const L of [W.snowFar, W.snowNear]) {
    const on = W.wSnow > 0.02; L.p.visible = on; if (!on) continue;
    L.p.material.opacity = L.base * Math.min(1, W.wSnow * 1.2);
    const wind = 0.6 + Math.sin(t * 0.13) * 0.5, top = cam.position.y + L.box[1] * 0.6, bot = cam.position.y - L.box[1] * 0.4;
    stepParticles(L, cam, dt, _v.set(wind, -1.1, 0.25), (i, s) => [Math.sin(t * (0.6 + s) + s * 40) * 0.45, -s * 0.7, Math.cos(t * (0.5 + s) + s * 20) * 0.35]); // deriva de cada floco
    const pos = L.pos; for (let i = 0; i < L.n; i++) { const kk = i * 3 + 1; if (pos[kk] < bot) pos[kk] += L.box[1]; else if (pos[kk] > top) pos[kk] -= L.box[1]; }
  }
  // ---------- areia ----------
  { const L = W.sand, on = W.wSand > 0.02; L.p.visible = on;
    if (on) {
      const gust = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.55) * Math.sin(t * 0.23 + 1), 2); // rajadas
      L.p.material.opacity = L.base * Math.min(1, W.wSand * 1.3) * (0.35 + gust * 0.65);
      stepParticles(L, cam, dt, _v.set(9 * gust + 2, 0, 3 * gust + 1), (i, s) => [s * 3, Math.sin(t * 3 + s * 30) * 0.6, 0]);
      const pos = L.pos, ccx = cam.position.x, ccz = cam.position.z; for (let i = 0; i < L.n; i++) { const k3 = i * 3; if (Math.abs(pos[k3] - ccx) < 2.5 && Math.abs(pos[k3 + 2] - ccz) < 2.5) pos[k3] += 5; const g = heightAt(pos[k3], pos[k3 + 2]); /* nenhum grão colado na câmera (viraria um borrão) */ if (pos[k3 + 1] < g + 0.05 || pos[k3 + 1] > g + 3.2) pos[k3 + 1] = g + 0.05 + L.seed[i] * L.seed[i] * 2.6; } // rentes ao chão
    }
  }
  // ---------- véus (poeira nas dunas, névoa nos colossos) ----------
  const veil = (V, w, opacity, drift, low, ring) => {
    const on = w > 0.02; V.im.visible = on; if (!on) return;
    V.mat.opacity = opacity * Math.min(1, w * 1.2);
    _q.copy(cam.quaternion); _e.setFromQuaternion(_q, 'YXZ'); _e.x = 0; _e.z = 0; _q.setFromEuler(_e); // só gira em volta do eixo vertical (camadas deitadas no horizonte)
    const cx = cam.position.x, cz = cam.position.z;
    V.items.forEach((it, i) => {
      if (!it.set || Math.hypot(it.x - cx, it.z - cz) > ring[1] * 1.15) { const a = Math.random() * 6.28, r = ring[0] + Math.random() * (ring[1] - ring[0]); it.x = cx + Math.cos(a) * r; it.z = cz + Math.sin(a) * r; it.set = true; }
      it.x += drift.x * it.sp * dt; it.z += drift.z * it.sp * dt;
      it.y = heightAt(it.x, it.z) + low + Math.sin(t * 0.2 + it.ph) * 0.4;
      _s.set(it.w * (1 + Math.sin(t * 0.1 + it.ph) * 0.08), it.h, 1); _m.compose(_v.set(it.x, it.y, it.z), _q, _s); V.im.setMatrixAt(i, _m);
    });
    V.im.instanceMatrix.needsUpdate = true;
  };
  veil(W.dust, W.wSand, 0.75, { x: 6, z: 2 }, 2.4, [12, 55]);
  veil(W.mist, W.wMist, 0.42, { x: 0.7, z: 0.3 }, 1.6, [10, 75]);
}
