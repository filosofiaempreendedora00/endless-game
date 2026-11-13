/* =========================================================================
   S-325: o LOBO GIGANTE do Caçador — fiel escudeiro, no espírito dos lobos gigantes das sagas de inverno.
   - É o lobo realista (wolf3d.js: corpo contínuo, pelagem em camadas, patas por IK, passo/trote/galope pela
     velocidade real) com ~1,2 m na cernelha, pelagem bem mais longa e cinza-prata, olhos âmbar.
   - Segue o caçador (fica do lado dele, um pouco atrás), corre quando ele corre, para quando ele para e olha em volta.
   - Em combate vai até o alvo do caçador, rosna, dá o bote e morde (dano físico pelo dono); volta quando a luta acaba.
   - Uiva de vez em quando (e ao começar uma luta), não atravessa nada (mesma colisão do mundo), acompanha o terreno.
   - Estado serializável (state()) para o online: outros jogadores podem desenhar o lobo pelo que vier na sincronização.
   O mascote continua existindo: o lobo é um companheiro da CLASSE (todo Caçador tem o seu).
   ========================================================================= */
import * as THREE from 'three';
import { realWolf } from './wolf3d.js';

export const DIREWOLF = { scale: 1.5, color: '#878b91', /* S-396: cinza mais fechado — a máscara clara do rosto e o contorno escuro dos olhos aparecem */ fur: 1.75, run: 7.2, reach: 1.25, biteEvery: 1.5, follow: [1.5, -1.1] };

export function makeDirewolf(color = DIREWOLF.color) {
  const w = realWolf(color, { fur: DIREWOLF.fur });
  w.root.scale.setScalar(DIREWOLF.scale);
  w.root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return w;
}

/* ctx = { scene, player(): {x,z,yaw,speed,inRoom}, target(): monstro|null, resolve(x,z,r)→{x,z}, groundAt(x,z),
           bite(m), sound(nome), visible(): bool } */
export function createCompanion(ctx) {
  const wolf = makeDirewolf(), obj = wolf.root; ctx.scene.add(obj);
  const pl = ctx.player();
  const S = { x: pl.x - 1.5, z: pl.z - 1.5, yaw: pl.yaw, vx: 0, vz: 0, mode: 'follow', biteT: -9, howlT: 6 + Math.random() * 20, growlT: -9, lastTarget: null, t: 0 };
  obj.position.set(S.x, ctx.groundAt(S.x, S.z), S.z); obj.rotation.y = S.yaw;
  const angTo = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
  function update(dt, t) {
    S.t = t; dt = Math.min(0.1, dt);
    const p = ctx.player(), vis = ctx.visible ? ctx.visible() : true; obj.visible = vis;
    // longe demais (teleporte, voo, entrou numa sala): reaparece ao lado do dono
    if (Math.hypot(p.x - S.x, p.z - S.z) > 35) { S.x = p.x - Math.sin(p.yaw) * 1.4 + Math.cos(p.yaw) * 1.4; S.z = p.z - Math.cos(p.yaw) * 1.4 - Math.sin(p.yaw) * 1.4; S.vx = S.vz = 0; }
    const m = ctx.target(), fighting = !!(m && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 22);
    if (fighting && S.lastTarget !== m) { S.lastTarget = m; if (t - S.growlT > 4) { ctx.sound('wolfGrowl'); S.growlT = t; } if (t > S.howlT - 4 && Math.random() < 0.35) { ctx.sound('wolfHowl'); S.howlT = t + 30 + Math.random() * 40; } }
    if (!fighting) S.lastTarget = null;
    let tx, tz, maxV, faceYaw = null;
    if (fighting) { // vai até o alvo e morde
      const d = Math.hypot(m.x - S.x, m.z - S.z), reach = (m.radius || 0.5) + DIREWOLF.reach;
      const ang = Math.atan2(S.x - m.x, S.z - m.z); tx = m.x + Math.sin(ang) * (reach - 0.15); tz = m.z + Math.cos(ang) * (reach - 0.15); maxV = DIREWOLF.run;
      faceYaw = Math.atan2(m.x - S.x, m.z - S.z);
      if (d <= reach + 0.25 && t - S.biteT > DIREWOLF.biteEvery) { S.biteT = t; wolf.attack(); ctx.sound('wolfGrowl'); const chomp = () => { if (!m.dead && Math.hypot(m.x - S.x, m.z - S.z) < reach + 0.6) { ctx.sound('wolfBite'); ctx.bite(m); } }; if (ctx.later) ctx.later(0.33, chomp); else setTimeout(chomp, 330); }
    } else { // segue o dono: ao lado e um pouco atrás; corre se ficar longe
      const [side, back] = DIREWOLF.follow, cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      tx = p.x + side * cs + back * sn; tz = p.z - side * sn + back * cs;
      const d = Math.hypot(tx - S.x, tz - S.z); maxV = d > 8 ? DIREWOLF.run : Math.max(1.4, Math.min(DIREWOLF.run, p.speed * 1.1 + d * 0.9));
      if (d < 0.6 && p.speed < 0.3) faceYaw = angTo(S.yaw, p.yaw, 1); // parado ao lado: olha para onde o dono olha
      // uivo de vez em quando, parado
      if (t > S.howlT && p.speed < 0.2 && Math.hypot(S.vx, S.vz) < 0.2) { ctx.sound('wolfHowl'); S.howlT = t + 45 + Math.random() * 60; }
    }
    // movimento com aceleração (sem deslizar: a marcha do lobo mede a velocidade real)
    const dx = tx - S.x, dz = tz - S.z, dist = Math.hypot(dx, dz), slow = dist < 0.35 ? 0 : Math.min(1, (dist - 0.35) / 1.2);
    const wvx = dist > 1e-3 ? dx / dist * maxV * slow : 0, wvz = dist > 1e-3 ? dz / dist * maxV * slow : 0, k = 1 - Math.exp(-dt * 5);
    S.vx += (wvx - S.vx) * k; S.vz += (wvz - S.vz) * k;
    const sp = Math.hypot(S.vx, S.vz);
    if (sp > 0.02) { const r = ctx.resolve(S.x + S.vx * dt, S.z + S.vz * dt, 0.75); const mvd = Math.hypot(r.x - S.x, r.z - S.z); S.x = r.x; S.z = r.z; if (mvd < sp * dt * 0.3) { S.vx *= 0.5; S.vz *= 0.5; } }
    const want = sp > 0.25 ? Math.atan2(S.vx, S.vz) : faceYaw ?? S.yaw;
    S.yaw = angTo(S.yaw, want, Math.min(1, dt * (sp > 3 ? 6 : 4)));
    obj.position.set(S.x, ctx.groundAt(S.x, S.z), S.z); obj.rotation.y = S.yaw;
    if (vis) wolf.animate(t, sp > 0.15, dt);
  }
  return {
    obj, wolf, update,
    state: () => ({ kind: 'direwolf', x: +S.x.toFixed(2), z: +S.z.toFixed(2), yaw: +S.yaw.toFixed(3), bite: S.biteT }), // para a sincronização online
    dispose() { ctx.scene.remove(obj); },
  };
}

/* lobo de OUTRO jogador (online): só desenha o que chega na sincronização, suavizando posição e giro */
export function remoteCompanion(scene) {
  const wolf = makeDirewolf(), obj = wolf.root; scene.add(obj); let has = false, lastBite = -9;
  const cur = { x: 0, z: 0, yaw: 0 }, tgt = { x: 0, z: 0, yaw: 0 };
  return {
    obj,
    set(st, groundAt) { if (!st) return; tgt.x = st.x; tgt.z = st.z; tgt.yaw = st.yaw; if (!has) { Object.assign(cur, tgt); has = true; } if (st.bite && st.bite !== lastBite) { lastBite = st.bite; wolf.attack(); } obj.userData.groundAt = groundAt; },
    update(dt, t) { if (!has) return; const k = 1 - Math.exp(-dt * 8); cur.x += (tgt.x - cur.x) * k; cur.z += (tgt.z - cur.z) * k; let d = tgt.yaw - cur.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cur.yaw += d * k;
      const g = obj.userData.groundAt; obj.position.set(cur.x, g ? g(cur.x, cur.z) : obj.position.y, cur.z); obj.rotation.y = cur.yaw; wolf.animate(t, Math.hypot(tgt.x - cur.x, tgt.z - cur.z) > 0.05, dt); },
    dispose() { scene.remove(obj); },
  };
}
