/* =========================================================================
   POSTURA DE MONTARIA (S-242) — vale para TODAS as montarias.
   Depois da animação do quadro (Sitting_Idle como base), o cavaleiro é
   encaixado na sela da montaria e as pernas e braços são resolvidos por IK
   de 2 ossos no espaço do mundo (independe de como os ossos estão orientados):
   - quadril sentado na sela (segue o balanço e a inclinação do bicho);
   - coxas abertas abraçando o lombo, joelhos dobrados, pés nos estribos
     (pontas para a frente, calcanhar um pouco para baixo);
   - mãos à frente do arção, segurando as rédeas, cotovelos soltos ao lado do corpo;
   - tronco levemente inclinado para a frente.
   A montaria informa a sela por mount.seat = { anchor: Object3D na sela, half: meia-largura
   do lombo onde passam as pernas, stirrup: queda até o estribo (m), reach: mãos à frente (m) }.
   ========================================================================= */
import * as THREE from 'three';

const _v = [...Array(12)].map(() => new THREE.Vector3()), _q = [...Array(6)].map(() => new THREE.Quaternion()), _m = new THREE.Matrix4();
function findBones(root) {
  const B = {}; root.traverse(o => { if (o.isBone && !B[o.name]) B[o.name] = o; }); return B;
}
// a animação nem sempre reescreve todos os ossos a cada quadro: guardamos o valor de antes do ajuste e,
// se no quadro seguinte o osso ainda estiver com o nosso ajuste, voltamos ao original (senão o ajuste acumula)
let _log = null;
function remember(bone) { if (_log && !_log.has(bone)) _log.set(bone, { pre: bone.quaternion.clone(), post: null }); }
// gira o osso (no espaço do mundo) para que o ponto "from" (do filho) passe a apontar para "to"
function aim(bone, from, to) {
  remember(bone);
  const p = bone.getWorldPosition(_v[0]), a = _v[1].subVectors(from, p), b = _v[2].subVectors(to, p);
  if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return;
  const qd = _q[0].setFromUnitVectors(a.normalize(), b.normalize());
  const wq = bone.getWorldQuaternion(_q[1]), nq = _q[2].multiplyQuaternions(qd, wq);
  const pq = bone.parent ? bone.parent.getWorldQuaternion(_q[3]) : _q[3].identity();
  bone.quaternion.copy(pq.invert().multiply(nq)); bone.updateMatrixWorld(true);
}
// IK de 2 ossos: a (raiz) → b (meio) → c (ponta) até "target", com o meio puxado para "pole"
function ik2(a, b, c, target, pole) {
  const pa = a.getWorldPosition(_v[3]).clone(), pb = b.getWorldPosition(_v[4]).clone(), pc = c.getWorldPosition(_v[5]).clone();
  const l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc), t = target.clone(), d = t.clone().sub(pa); let dist = d.length();
  const maxR = (l1 + l2) * 0.995, minR = Math.abs(l1 - l2) * 1.05 + 1e-3;
  if (dist > maxR) { d.setLength(maxR); t.copy(pa).add(d); dist = maxR; } else if (dist < minR) { d.setLength(minR); t.copy(pa).add(d); dist = minR; }
  const dir = d.clone().normalize(), cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), along = l1 * cosA, up = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const pl = pole.clone().sub(pa); pl.addScaledVector(dir, -pl.dot(dir)); if (pl.lengthSq() < 1e-8) pl.set(0, 1, 0); pl.normalize();
  const knee = pa.clone().addScaledVector(dir, along).addScaledVector(pl, up);
  aim(a, b.getWorldPosition(_v[6]).clone(), knee);
  aim(b, c.getWorldPosition(_v[7]).clone(), t);
}
// rotação extra de um osso em torno de um eixo do mundo
function twist(bone, axisW, ang) {
  remember(bone);
  const qd = _q[0].setFromAxisAngle(axisW, ang), wq = bone.getWorldQuaternion(_q[1]), nq = _q[2].multiplyQuaternions(qd, wq);
  const pq = bone.parent ? bone.parent.getWorldQuaternion(_q[3]) : _q[3].identity(); bone.quaternion.copy(pq.invert().multiply(nq)); bone.updateMatrixWorld(true);
}
/**
 * riderPose(rider, mount, opts?)
 * rider: { obj, root } do personagem (makeHero / makeHuman) — chame DEPOIS de rider.anim.update(dt) (com 'Sit_Chair_Idle' tocando).
 * mount: o objeto de makeMount (precisa de mount.seat; se não tiver, usa saddleY).
 * Move rider.obj para a sela (posição + rotação do lombo) e ajusta pernas, braços e tronco.
 */
export function riderPose(rider, mount, opts = {}) {
  if (!rider || !mount) return;
  const root = rider.root || rider.obj, B = rider._rb || (rider._rb = findBones(root));
  if (!B.pelvis || !B.thigh_l) return;
  if (rider._rlog) for (const [bone, r] of rider._rlog) if (r.post && bone.quaternion.equals(r.post)) bone.quaternion.copy(r.pre);
  _log = rider._rlog = new Map();
  const seat = mount.seat || {}, anchor = seat.anchor;
  // 1) quadril na sela: posição e rotação do lombo (o cavaleiro balança junto com o bicho)
  mount.obj.updateMatrixWorld(true);
  const sq = _q[4], sp = _v[8];
  if (anchor) { anchor.getWorldPosition(sp); anchor.getWorldQuaternion(sq); }
  else { sp.set(0, (mount.saddleY || 1.5) + (mount.bodyY || 0), 0); mount.obj.localToWorld(sp); mount.obj.getWorldQuaternion(sq); }
  const o = rider.obj; o.quaternion.copy(sq); if (o.parent) { o.parent.updateMatrixWorld(true); o.quaternion.premultiply(o.parent.getWorldQuaternion(_q[5]).invert()); }
  o.position.set(0, 0, 0); o.updateMatrixWorld(true);
  const pel = B.pelvis.getWorldPosition(_v[9]).clone(), ow = o.getWorldPosition(_v[10]).clone();
  const upW = new THREE.Vector3(0, 1, 0).applyQuaternion(sq), fwW = new THREE.Vector3(0, 0, 1).applyQuaternion(sq), rtW = new THREE.Vector3(-1, 0, 0).applyQuaternion(sq); // personagem olha para +z; "direita" dele é -x
  const want = sp.clone().addScaledVector(upW, opts.seatH ?? 0.1); // pelve um palmo acima do couro da sela
  const worldPos = ow.clone().add(want.sub(pel));
  if (o.parent) o.parent.worldToLocal(worldPos); o.position.copy(worldPos); o.updateMatrixWorld(true);
  // 2) tronco: levemente para a frente (postura de quem cavalga)
  if (B.spine_01) twist(B.spine_01, rtW, -(opts.lean ?? 0.14));
  if (B.Head) twist(B.Head, rtW, (opts.lean ?? 0.14) * 0.7); // o olhar continua no horizonte
  // 3) pernas: abraçam o lombo, joelho dobrado para a frente, pé no estribo
  const half = seat.half ?? 0.3, drop = seat.stirrup ?? 0.72;
  const hipC = B.pelvis.getWorldPosition(new THREE.Vector3());
  for (const [s, side] of [['l', 1], ['r', -1]]) { // _l fica à esquerda do personagem (+x no espaço dele)
    const th = B['thigh_' + s], ca = B['calf_' + s], ft = B['foot_' + s], ball = B['ball_' + s]; if (!th || !ca || !ft) continue;
    const sideW = rtW.clone().multiplyScalar(-side); // para fora deste lado
    const target = hipC.clone().addScaledVector(sideW, half + 0.07).addScaledVector(upW, -drop).addScaledVector(fwW, seat.footZ ?? 0.04);
    const pole = th.getWorldPosition(new THREE.Vector3()).addScaledVector(fwW, 1).addScaledVector(sideW, 0.55).addScaledVector(upW, -0.2);
    // começa pelo meio: coxa já aberta para fora, para o IK achar a solução "abraçando" o bicho
    ik2(th, ca, ft, target, pole);
    if (ball) { // pé: ponta para a frente e um pouco para fora, calcanhar mais baixo
      const fp = ft.getWorldPosition(new THREE.Vector3()), bp = ball.getWorldPosition(new THREE.Vector3()), L = fp.distanceTo(bp);
      aim(ft, bp, fp.clone().addScaledVector(fwW, L * 0.93).addScaledVector(sideW, L * 0.25).addScaledVector(upW, L * 0.12));
    }
  }
  // 4) braços: mãos juntas à frente do arção, segurando as rédeas (cotovelos soltos, para baixo e para trás)
  const chest = (B.spine_03 || B.spine_02).getWorldPosition(new THREE.Vector3());
  const reach = seat.reach ?? 0.36, t = opts.t ?? performance.now() / 1000, sway = Math.sin(t * 2.1) * 0.012 * (opts.gait ?? 0);
  for (const [s, side] of [['l', 1], ['r', -1]]) {
    const ua = B['upperarm_' + s], la = B['lowerarm_' + s], ha = B['hand_' + s]; if (!ua || !la || !ha) continue;
    const sideW = rtW.clone().multiplyScalar(-side);
    const target = chest.clone().addScaledVector(fwW, reach).addScaledVector(upW, -0.3 + sway).addScaledVector(sideW, 0.085);
    const pole = ua.getWorldPosition(new THREE.Vector3()).addScaledVector(sideW, 0.6).addScaledVector(upW, -0.8).addScaledVector(fwW, -0.5);
    ik2(ua, la, ha, target, pole);
    // punho: dorso da mão para fora/cima, como quem segura as rédeas
    const hp = ha.getWorldPosition(new THREE.Vector3()), mid = B['middle_01_' + s];
    if (mid) { const mp = mid.getWorldPosition(new THREE.Vector3()), L = hp.distanceTo(mp); aim(ha, mp, hp.clone().addScaledVector(fwW, L * 0.7).addScaledVector(sideW, -L * 0.5).addScaledVector(upW, -L * 0.35)); }
  }
  for (const [bone, r] of _log) r.post = bone.quaternion.clone();
  _log = null;
}
// quanto o personagem deve ficar acima do chão quando montado (para câmera/plaquinha), aproximado
export const RIDE_EYE = 2.3;
