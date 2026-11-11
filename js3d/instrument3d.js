/* S-324: tocar instrumento (Bardo) — pose por cima da animação, como o arco em bow3d.js.
   - fora de combate o instrumento fica nas costas/no cinto (holdInstrument em looks3d: root.userData.instrument.state('back'|'play'));
   - em guarda/tocando ele vem para a frente: alaúde apoiado na barriga, mão esquerda no braço (dedos nos trastes), mão direita
     dedilhando na boca do instrumento; flauta na boca, as duas mãos nos furos;
   - "play" (0..1) é a intensidade: 0,15 = pronto para tocar, 1 = tocando (dedilhado rápido, corpo e cabeça no ritmo).
   instrumentPose(me, o): me = { root, ... }, o = { w: 0 nas costas → 1 nas mãos, play: 0..1, t: tempo } */
import * as THREE from 'three';
import { gripHand } from './looks3d.js';

const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function setWorldQuat(b, wq) { b.parent.updateWorldMatrix(true, false); b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq)); b.updateWorldMatrix(false, true); }
function rotBoneTo(b, from, to) { _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize()); b.getWorldQuaternion(_q2); _q2.premultiply(_q); setWorldQuat(b, _q2.clone()); }
function turnBone(b, axis, ang) { if (!b || Math.abs(ang) < 1e-4) return; b.getWorldQuaternion(_q2); _q.setFromAxisAngle(axis, ang); _q2.premultiply(_q); setWorldQuat(b, _q2.clone()); }
function ik2(a, b, c, T, pole, w) { // IK de 2 ossos (ombro → cotovelo → punho), cotovelo para o polo
  if (w <= 0) return;
  a.getWorldPosition(_a); b.getWorldPosition(_b); c.getWorldPosition(_c);
  const tgt = _c.clone().lerp(T, w), l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c), d = Math.min(l1 + l2 - 1e-3, Math.max(0.05, _a.distanceTo(tgt)));
  const u = tgt.clone().sub(_a).normalize(), pw = pole.clone().sub(_a); pw.sub(u.clone().multiplyScalar(pw.dot(u))).normalize();
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), B2 = _a.clone().add(u.clone().multiplyScalar(l1 * cosA)).add(pw.multiplyScalar(l1 * Math.sqrt(1 - cosA * cosA)));
  rotBoneTo(a, _b.clone().sub(_a), B2.clone().sub(_a));
  b.getWorldPosition(_b); c.getWorldPosition(_c); rotBoneTo(b, _c.clone().sub(_b), tgt.clone().sub(_b));
}
// aponta os dedos (eixo +Y do osso da mão) para uma direção, aos poucos
function aimHand(h, dir, k) { if (k <= 0) return; h.updateWorldMatrix(true, false); const hy = new THREE.Vector3(0, 1, 0).transformDirection(h.matrixWorld); rotBoneTo(h, hy, hy.clone().lerp(dir.clone().normalize(), k).normalize()); }

export function instrumentPose(me, o) {
  const r = me.root, I = r.userData.instrument; if (!I) return;
  const W = Math.max(0, Math.min(1, o.w || 0)), P = Math.max(0, Math.min(1, o.play || 0)), t = o.t || 0;
  I.state(W > 0.04 ? 'play' : 'back'); if (W <= 0.04) return;
  const g = n => r.getObjectByName(n), sl = g('upperarm_l'), el = g('lowerarm_l'), hl = g('hand_l'), sr = g('upperarm_r'), er = g('lowerarm_r'), hr = g('hand_r'), hd = g('Head'), nk = g('neck_01'), s3 = g('spine_03'), s2 = g('spine_02');
  if (!sl || !el || !hl || !sr || !er || !hr) return;
  r.updateWorldMatrix(true, true);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(r.matrixWorld).setY(0).normalize(), left = new THREE.Vector3(1, 0, 0).transformDirection(r.matrixWorld).setY(0).normalize();
  { const shL = sl.getWorldPosition(new THREE.Vector3()), shR = sr.getWorldPosition(new THREE.Vector3()); if (shL.clone().sub(shR).dot(left) < 0) left.negate(); }
  // balanço no ritmo: o tronco gira e inclina de leve, a cabeça acompanha (mais forte tocando)
  const beat = Math.sin(t * 4.2), sway = Math.sin(t * 2.1);
  turnBone(s2, UP, sway * 0.035 * P * W); turnBone(s3, fwd, sway * 0.03 * P * W);
  if (I.kind !== 'flauta') { turnBone(nk, left, (0.06 + beat * 0.035 * P) * W); turnBone(hd, UP, sway * 0.05 * P * W); } // olha para as cordas e balança
  else turnBone(hd, fwd, sway * 0.04 * P * W);
  r.updateWorldMatrix(true, true); I.obj.updateWorldMatrix(true, false);
  const H = I.obj.userData.inst.hands, wl = H.l.clone(), wr = H.r.clone();
  const ax = new THREE.Vector3(1, 0, 0).transformDirection(I.obj.matrixWorld), ay = new THREE.Vector3(0, 1, 0).transformDirection(I.obj.matrixWorld), az = new THREE.Vector3(0, 0, 1).transformDirection(I.obj.matrixWorld);
  const shL = sl.getWorldPosition(new THREE.Vector3()), shR = sr.getWorldPosition(new THREE.Vector3());
  if (I.kind === 'flauta') {
    const pl = I.obj.localToWorld(wl), pr = I.obj.localToWorld(wr);
    const finger = (Math.sin(t * 11) > 0.3 ? 0.006 : 0) * P; // dedos sobem e descem nos furos
    ik2(sl, el, hl, pl.clone().add(az.clone().multiplyScalar(-0.035 - finger)).add(ay.clone().multiplyScalar(-0.03)), shL.clone().add(UP.clone().multiplyScalar(-0.45)).add(left.clone().multiplyScalar(0.25)), W);
    ik2(sr, er, hr, pr.clone().add(az.clone().multiplyScalar(-0.035 - finger)).add(ay.clone().multiplyScalar(-0.03)), shR.clone().add(UP.clone().multiplyScalar(-0.45)).add(left.clone().multiplyScalar(-0.25)), W);
    aimHand(hl, az.clone().negate().add(ay.clone().multiplyScalar(0.4)), 0.6 * W); aimHand(hr, az.clone().negate().add(ay.clone().multiplyScalar(0.4)), 0.6 * W);
    gripHand(r, 'l', 'flauta'); gripHand(r, 'r', 'flauta'); // P-013
    return;
  }
  // alaúde/bandolim: mão esquerda por baixo do braço do instrumento (dedos sobem para os trastes), cotovelo baixo e para fora
  // ponto do braço do instrumento ao alcance do braço esquerdo (anão tem braço curto): desce do cravelhal em direção ao bojo até caber
  const reach = (sl.getWorldPosition(_a).distanceTo(el.getWorldPosition(_b)) + _b.distanceTo(hl.getWorldPosition(_c))) * 0.9;
  let neck = I.obj.localToWorld(wl.clone()); for (let k = 0; k < 14 && neck.distanceTo(shL) > reach; k++) { wl.y -= 0.02; neck = I.obj.localToWorld(wl.clone()); }
  const fret = (Math.sin(t * 3.1) > 0 ? 0.02 : -0.01) * P; // a mão muda de posição no braço de vez em quando
  // (eixos do instrumento: +Y = braço, +X = borda de cima do bojo, −Z = tampo/cordas para fora)
  ik2(sl, el, hl, neck.clone().add(ay.clone().multiplyScalar(fret - 0.05)).add(az.clone().multiplyScalar(0.03)).add(ax.clone().multiplyScalar(-0.06)), shL.clone().add(UP.clone().multiplyScalar(-0.55)).add(left.clone().multiplyScalar(0.3)).add(fwd.clone().multiplyScalar(-0.05)), W);
  aimHand(hl, ax.clone().add(az.clone().multiplyScalar(-0.4)), 0.75 * W); // dedos sobem por trás do braço até os trastes
  // mão direita: o antebraço apoia na borda de cima do bojo e os dedos descem sobre a boca, dedilhando (vai e volta através das cordas)
  const strum = Math.sin(t * (6 + 10 * P)) * (0.01 + 0.028 * P), body = I.obj.localToWorld(wr);
  ik2(sr, er, hr, body.clone().add(ax.clone().multiplyScalar(0.1 + strum)).add(ay.clone().multiplyScalar(-0.02)).add(az.clone().multiplyScalar(-0.06)), shR.clone().add(UP.clone().multiplyScalar(-0.15)).add(left.clone().multiplyScalar(-0.35)).add(fwd.clone().multiplyScalar(-0.25)), W);
  aimHand(hr, ax.clone().negate().add(az.clone().multiplyScalar(0.25)), 0.7 * W);
  gripHand(r, 'l', 'alaude'); gripHand(r, 'r', 'dedilhar'); // P-013
}
