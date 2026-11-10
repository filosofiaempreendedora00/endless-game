/* =========================================================================
   VOO DE NOCTÍVAGO DE VERDADE (P-006)
   Em vez de sumir e aparecer no destino, o personagem monta no Pégaso,
   decola, sobrevoa o mundo numa rota curva por cima do relevo (desvia dos
   picos) e pousa no destino. A câmera vai atrás e acima, com leve balanço e
   inclinação nas curvas. Sem controle do jogador: Esc (ou "Pular") chega logo.

   startFlight(ctx, to)  → cria o voo e o guarda em ctx.S.flight
     ctx: { scene, S, fadeTo, Sound, onLand(yaw) }   to: { x, z, name }
   O main3d chama S.flight.update(dt) no lugar de updatePlayer e
   S.flight.cam(camera, dt) depois de posicionar a câmera normal.
   ========================================================================= */
import * as THREE from 'three';
import { heightAt, HALF } from './world3d.js';
import { makePegasus } from './mounts3d.js';
import { riderPose } from './ride3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
// maior altura do terreno num círculo (para passar por cima dos picos com folga)
function hMax(x, z, r = 32) {
  let h = heightAt(x, z);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; for (const rr of [r * 0.5, r]) h = Math.max(h, heightAt(clamp(x + Math.cos(a) * rr, -HALF, HALF), clamp(z + Math.sin(a) * rr, -HALF, HALF))); }
  return h;
}
// rota: decolagem curta, cruzeiro curvo bem acima do relevo, pouso suave
export function planRoute(x0, z0, x1, z1) {
  const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1), dx = x1 - x0, dz = z1 - z0, D = Math.max(1, Math.hypot(dx, dz));
  const ux = dx / D, uz = dz / D, nx = -uz, nz = ux, side = ((Math.floor(x0 * 7 + z1 * 3) & 1) ? 1 : -1), bend = Math.min(90, D * 0.12) * side;
  const N = Math.max(3, Math.round(D / 55)), mid = [];
  for (let i = 1; i < N; i++) {
    const s = i / N, lat = Math.sin(s * Math.PI) * bend + Math.sin(s * Math.PI * 3) * bend * 0.18;
    const x = clamp(x0 + dx * s + nx * lat, -HALF + 8, HALF - 8), z = clamp(z0 + dz * s + nz * lat, -HALF + 8, HALF - 8);
    mid.push({ x, z, h: hMax(x, z) });
  }
  const cruise = Math.max(y0, y1) + 48; // alto o bastante para ver as regiões, baixo o bastante para o horizonte continuar no lugar
  let alt = mid.map(p => Math.max(cruise, p.h + 34));
  for (let pass = 0; pass < 3; pass++) alt = alt.map((a, i) => Math.max(mid[i].h + 30, (alt[i - 1] ?? a) * 0.25 + a * 0.5 + (alt[i + 1] ?? a) * 0.25)); // suaviza sem raspar os picos
  // decolagem e pouso íngremes (sobe quase reto antes de seguir — não raspa torres, cercas nem casas do pouso)
  const pts = [new THREE.Vector3(x0, y0 + 0.05, z0), new THREE.Vector3(x0 + ux * 4, y0 + 10, z0 + uz * 4), new THREE.Vector3(x0 + ux * 20, Math.max(y0 + 32, hMax(x0 + ux * 20, z0 + uz * 20, 14) + 18), z0 + uz * 20)];
  mid.forEach((p, i) => pts.push(new THREE.Vector3(p.x, alt[i], p.z)));
  pts.push(new THREE.Vector3(x1 - ux * 22, Math.max(y1 + 30, hMax(x1 - ux * 22, z1 - uz * 22, 14) + 18), z1 - uz * 22), new THREE.Vector3(x1 - ux * 5, y1 + 9, z1 - uz * 5), new THREE.Vector3(x1, y1 + 0.05, z1));
  let curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  // garante: no meio do voo, nunca a menos de 18 m do chão (levanta o ponto de controle mais perto e refaz)
  for (let it = 0; it < 6; it++) {
    let worst = 0, wu = 0;
    for (let k = 1; k < 240; k++) { const u = k / 240; if (u < 0.08 || u > 0.92) continue; const q = curve.getPointAt(u), need = heightAt(q.x, q.z) + 18 - q.y; if (need > worst) { worst = need; wu = u; } }
    if (worst <= 0) break;
    const q = curve.getPointAt(wu); let bi = 3, bd = 1e9; for (let i = 3; i < pts.length - 3; i++) { const d = Math.hypot(pts[i].x - q.x, pts[i].z - q.z); if (d < bd) { bd = d; bi = i; } }
    pts[bi].y += worst + 6; curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  }
  return curve;
}

// vento suave e contínuo durante o voo (ruído filtrado que respira)
function windSound(Sound) {
  try {
    const c = Sound.ctx; if (!c || !Sound.noiseBuf || !Sound.enabled) return null;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Sound.noiseBuf; src.loop = true; f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.value = 520; f2.type = 'lowpass'; f2.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.16, c.currentTime + 1.6);
    src.connect(f); f.connect(f2); f2.connect(g); g.connect(Sound.sfx); src.start();
    return {
      set(k, speed) { const t = c.currentTime; f.frequency.setTargetAtTime(380 + speed * 22 + Math.sin(t * 0.7) * 90, t, 0.3); g.gain.setTargetAtTime(0.06 + 0.12 * k + Math.max(0, Math.sin(t * 0.45)) * 0.05, t, 0.4); },
      stop() { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.8); src.stop(t + 0.9); },
    };
  } catch (e) { return null; }
}

export function startFlight(ctx, to) {
  const { scene, S, Sound } = ctx, P = S.pos, me = S.me;
  if (S.flight) return S.flight;
  const curve = planRoute(P.x, P.z, to.x, to.z), L = curve.getLength(), T = clamp(L / 26 + 5, 15, 35);
  const R = makePegasus(); R.obj.rotation.order = 'YXZ'; scene.add(R.obj);
  me.obj.rotation.order = 'YXZ'; me.anim.play('Sit_Chair_Idle', { fade: 0.25 });
  const camPos = ctx.camera ? ctx.camera.position.clone() : new THREE.Vector3(P.x, P.y + 4, P.z), camLook = new THREE.Vector3(P.x, P.y + 1.5, P.z);
  let t = 0, lastYaw = null, bank = 0, turn = 0, done = false, skipping = false;
  const wind = windSound(Sound);
  // aviso na tela com o botão de pular
  const ui = document.createElement('div'); ui.id = 'flight-ui';
  ui.innerHTML = `<span>🦇 Voando para <b>${to.name || 'o destino'}</b></span><button id="flight-skip">Pular ⏭ <small>(Esc)</small></button>`;
  Object.assign(ui.style, { position: 'fixed', left: '50%', top: '14px', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 14px', borderRadius: '12px', background: 'rgba(14,12,24,0.78)', border: '1px solid rgba(255,215,106,0.35)', color: '#f2ead8', fontSize: '14px', boxShadow: '0 6px 20px rgba(0,0,0,0.45)' });
  document.body.appendChild(ui);
  const btn = ui.querySelector('#flight-skip'); Object.assign(btn.style, { background: 'rgba(255,215,106,0.15)', color: '#ffd76a', border: '1px solid rgba(255,215,106,0.5)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' });
  const cur = new THREE.Vector3(), tan = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), seat = new THREE.Vector3();

  function finish() {
    if (done) return; done = true;
    const endYaw = lastYaw ?? P.yaw;
    scene.remove(R.obj); me.obj.rotation.order = 'XYZ'; me.obj.rotation.set(0, endYaw, 0); me.anim.play('Idle', { fade: 0.2 });
    ui.remove(); if (wind) wind.stop(); if (S.distantMtn) S.distantMtn.visible = true;
    S.flight = null; S.vel = { x: 0, z: 0 };
    if (ctx.onLand) ctx.onLand(endYaw);
  }
  const F = {
    to, T, curve,
    get progress() { return t / T; },
    update(dt) {
      if (done) return;
      t = Math.min(T, t + dt); const k = t / T;
      const u = clamp(k - Math.sin(k * Math.PI * 2) / (Math.PI * 2), 0, 1); // arranca e pousa devagar, rápido no meio
      curve.getPointAt(u, cur); curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), tan);
      const hor = Math.hypot(tan.x, tan.z), yaw = hor > 0.05 ? Math.atan2(tan.x, tan.z) : (lastYaw ?? P.yaw);
      const yawRate = lastYaw === null ? 0 : angDiff(yaw, lastYaw) / Math.max(dt, 1e-3); lastYaw = yaw;
      turn += (clamp(yawRate, -1.5, 1.5) - turn) * (1 - Math.exp(-dt * 3));
      bank += (clamp(-turn * 0.42, -0.45, 0.45) - bank) * (1 - Math.exp(-dt * 3));
      const speed = L / T * (1 - Math.cos(k * Math.PI * 2)), climb = Math.asin(clamp(tan.y, -1, 1)), air = k > 0.012 && k < 0.988;
      // Pégaso: posição, rumo, inclinação nas curvas e nariz para cima/baixo na subida/descida
      R.obj.position.copy(cur); R.obj.rotation.set(-climb * 0.55, yaw, bank);
      R.animate(S.time, { speed: air ? 1 : 0.6, turn: clamp(turn, -4, 4), air, vy: tan.y * speed }, dt);
      if (R.flap && air && Math.random() < dt * 0.15) R.flap(S.time);
      // cavaleiro sentado no dorso (acompanha a inclinação do corpo do Pégaso)
      R.obj.updateMatrixWorld(true);
      seat.set(0, R.saddleY + (R.bodyY || 0) - 0.52, 0).applyQuaternion(R.obj.quaternion).add(R.obj.position);
      me.obj.position.copy(seat); me.obj.quaternion.copy(R.obj.quaternion);
      me.anim.update(dt); me.obj.updateMatrixWorld(true);
      try { riderPose(me, R, { t: S.time, gait: 0.5 }); } catch (e) { }
      if (me.lookFx) me.lookFx(S.time);
      // o "jogador" está onde o Pégaso está: terreno, cenário, névoa e minimapa seguem o voo
      Object.assign(P, { x: cur.x, z: cur.z, y: cur.y, vy: 0, ground: false, yaw });
      if (wind) wind.set(Math.sin(k * Math.PI), speed);
      { // câmera: segue a cada passo do jogo (não depende de quantos quadros são desenhados) — atrás e acima, com leve balanço
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const far = 9 + 6 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (k < 0.9 ? 1 : (1 - k) * 10); // afasta ao decolar, aproxima ao pousar
        const sway = Math.sin(S.time * 0.55) * 1.0;
        q.set(cur.x - fx * far + fz * sway, cur.y + 2.6 + far * 0.24, cur.z - fz * far - fx * sway);
        q.y = Math.max(q.y, heightAt(q.x, q.z) + (k < 0.14 || k > 0.86 ? 10 : 3)); // na decolagem/pouso fica acima das copas das árvores e dos telhados
        camPos.lerp(q, 1 - Math.exp(-dt * (k < 0.06 ? 2.5 : 6))); camLook.lerp(new THREE.Vector3(cur.x + fx * 6, cur.y + 1.6, cur.z + fz * 6), 1 - Math.exp(-dt * 8));
        // a cordilheira do horizonte é uma fita além da borda do mapa feita para ser vista do chão: lá de cima ela parecia flutuar
        if (S.distantMtn) S.distantMtn.visible = camPos.y - heightAt(camPos.x, camPos.z) < 32;
      }
      if (t >= T) finish();
    },
    cam(camera) {
      if (done) return;
      camera.position.copy(camPos); camera.up.copy(up); camera.lookAt(camLook); camera.rotateZ(bank * 0.3);
    },
    skip() { if (done || skipping) return; skipping = true; (ctx.fadeTo || (fn => fn()))(() => finish()); },
  };
  btn.onclick = () => F.skip();
  S.flight = F;
  return F;
}
