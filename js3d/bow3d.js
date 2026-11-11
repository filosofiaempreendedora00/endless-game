/* S-312: arco no estilo Skyrim/WoW, para o jogador e os manequins da galeria.
   - fora de combate o arco vai nas costas (holdBow em looks3d: root.userData.bowState('back' | 'hand'));
   - em guarda fica na mão esquerda, baixo e quase em pé, com a flecha encaixada e a mão direita na corda;
   - atirando, o arqueiro fica DE LADO para o alvo (o twist é aplicado no obj por quem chama), braço esquerdo estendido na
     altura do ombro, mão direita puxa a corda até o canto da boca com o cotovelo alto e para trás; a corda acompanha a mão.
   bowPose(me, o, ctx): me = { root, ... }, o = { w: peso da pose de combate, aim: 0 guarda → 1 mirando, draw: 0 corda solta → 1 na
   âncora, yaw: direção do alvo, twist: giro de lado já aplicado no corpo, nock: flecha visível }, ctx = { scene, makeArrow } */
import * as THREE from 'three';
import { handGrip } from './looks3d.js';

const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function setWorldQuat(b, wq) { b.parent.updateWorldMatrix(true, false); b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq)); b.updateWorldMatrix(false, true); }
function rotBoneTo(b, from, to) { _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize()); b.getWorldQuaternion(_q2); _q2.premultiply(_q); setWorldQuat(b, _q2.clone()); }
function yawBone(b, ang) { if (!b || Math.abs(ang) < 1e-3) return; b.getWorldQuaternion(_q2); _q.setFromAxisAngle(UP, ang); _q2.premultiply(_q); setWorldQuat(b, _q2.clone()); }
function ik2(a, b, c, T, pole, w) { // IK de 2 ossos (ombro → cotovelo → punho) com o cotovelo apontando para o polo
  if (w <= 0) return;
  a.getWorldPosition(_a); b.getWorldPosition(_b); c.getWorldPosition(_c);
  const tgt = _c.clone().lerp(T, w), l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c), d = Math.min(l1 + l2 - 1e-3, Math.max(0.05, _a.distanceTo(tgt)));
  const u = tgt.clone().sub(_a).normalize(), pw = pole.clone().sub(_a); pw.sub(u.clone().multiplyScalar(pw.dot(u))).normalize();
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), B2 = _a.clone().add(u.clone().multiplyScalar(l1 * cosA)).add(pw.multiplyScalar(l1 * Math.sqrt(1 - cosA * cosA)));
  rotBoneTo(a, _b.clone().sub(_a), B2.clone().sub(_a));
  b.getWorldPosition(_b); c.getWorldPosition(_c); rotBoneTo(b, _c.clone().sub(_b), tgt.clone().sub(_b));
}
// corda: some a corda reta e desenha as duas metades das pontas do arco até os dedos que puxam
function stringFx(bow, pull, on) {
  const str = bow.userData.strMesh || (bow.userData.strMesh = (() => { let m = null; bow.traverse(o => { if (!m && o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop < 0.003) m = o; }); return m; })());
  if (!str) return;
  let fx = bow.userData.strFx;
  if (!fx) { const mk = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6), str.material); m.frustumCulled = false; m.visible = false; bow.add(m); return m; }; fx = bow.userData.strFx = [mk(), mk()]; }
  if (!on) { str.visible = true; fx[0].visible = fx[1].visible = false; return; }
  bow.updateWorldMatrix(true, false); const lp = bow.worldToLocal(pull.clone()), H = str.geometry.parameters.height / 2, zt = str.position.z;
  fx.forEach((m, k) => { const tip = new THREE.Vector3(0, k ? H : -H, zt), d = lp.clone().sub(tip), L = d.length(); m.position.copy(tip).add(lp).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(1, L, 1); m.visible = true; });
  str.visible = false;
}
export function bowPose(me, o, ctx) {
  const r = me.root, bow = r.userData.items && r.userData.items.bow; if (!bow || !r.userData.bowState) return;
  r.userData.bowState(o.w > 0.02 ? 'hand' : 'back');
  const nock = me._nockObj || (me._nockObj = (() => { const a = ctx.makeArrow(); a.visible = false; ctx.scene.add(a); return a; })());
  if (o.w < 0.02) { nock.visible = false; stringFx(bow, null, false); return; }
  const g = n => r.getObjectByName(n), sl = g('upperarm_l'), el = g('lowerarm_l'), hl = g('hand_l'), sr = g('upperarm_r'), er = g('lowerarm_r'), hr = g('hand_r'), hd = g('Head'), nk = g('neck_01'), s3 = g('spine_03');
  if (!sl || !el || !hl || !sr || !er || !hr || !hd) return;
  (me._gripL || (me._gripL = handGrip(r, 'l', 1)))(); // mão do arco fechada em volta da empunhadura
  (me._gripR || (me._gripR = handGrip(r, 'r', 0.55)))(); // dedos da corda em gancho
  const W = o.w, A = o.aim, tw = o.twist || 0, fwd = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw)), right = new THREE.Vector3(-Math.cos(o.yaw), 0, Math.sin(o.yaw));
  r.updateWorldMatrix(true, true);
  // corpo de lado (twist no obj): o peito volta um pouco e a cabeça olha para o alvo
  yawBone(s3, -tw * 0.3 * W); yawBone(nk, -tw * 0.3 * W); yawBone(hd, -tw * 0.4 * W);
  const shL = sl.getWorldPosition(new THREE.Vector3()), shR = sr.getWorldPosition(new THREE.Vector3()), head = hd.getWorldPosition(new THREE.Vector3());
  // braço do arco: em guarda baixo e à frente; mirando estendido para o alvo na altura do ombro
  const guardT = shL.clone().add(fwd.clone().multiplyScalar(0.34)).add(UP.clone().multiplyScalar(-0.36)).add(right.clone().multiplyScalar(0.12));
  const aimT = shL.clone().add(fwd.clone().multiplyScalar(0.7)).add(UP.clone().multiplyScalar(0.03));
  ik2(sl, el, hl, guardT.lerp(aimT, A), shL.clone().add(UP.clone().multiplyScalar(-0.5)).add(right.clone().multiplyScalar(-0.3 - 0.25 * A)).add(fwd.clone().multiplyScalar(-0.1)), W);
  { // gira o punho para o arco ficar quase em pé (inclinado para a frente na guarda), corda voltada para o arqueiro
    bow.updateWorldMatrix(true, false); const bu = new THREE.Vector3(0, 1, 0).transformDirection(bow.matrixWorld);
    const wantG = UP.clone().add(fwd.clone().multiplyScalar(0.32)).add(right.clone().multiplyScalar(0.12)).normalize(), wantA = UP.clone().add(right.clone().multiplyScalar(0.14)).normalize();
    rotBoneTo(hl, bu, bu.clone().lerp(wantG.lerp(wantA, A), W).normalize());
    bow.updateWorldMatrix(true, false); const bz = new THREE.Vector3(0, 0, 1).transformDirection(bow.matrixWorld), by = new THREE.Vector3(0, 1, 0).transformDirection(bow.matrixWorld);
    const zw = fwd.clone().negate(); zw.sub(by.clone().multiplyScalar(zw.dot(by))); // corda para o arqueiro, ventre (e a flecha) para o alvo
    if (zw.lengthSq() > 1e-4) { zw.normalize(); const ang = Math.atan2(new THREE.Vector3().crossVectors(bz, zw).dot(by), bz.dot(zw)); hl.getWorldQuaternion(_q2); _q.setFromAxisAngle(by, ang * W); _q2.premultiply(_q); setWorldQuat(hl, _q2.clone()); }
  }
  bow.updateWorldMatrix(true, false);
  const grip = new THREE.Vector3(0, 0, bow.userData.gripZ ?? -0.11).applyMatrix4(bow.matrixWorld), bz = new THREE.Vector3(0, 0, 1).transformDirection(bow.matrixWorld);
  const rest = grip.clone().add(bz.clone().multiplyScalar(0.11)); // centro da corda solta
  const anchor = head.clone().add(UP.clone().multiplyScalar(-0.085)).add(fwd.clone().multiplyScalar(0.06)).add(right.clone().multiplyScalar(0.03)); // canto da boca
  const pull = rest.clone().lerp(anchor, Math.max(0, Math.min(1, o.draw)) * (0.2 + 0.8 * A)); // em guarda só encosta na corda
  const adir = grip.clone().sub(pull); const alen = adir.length(); adir.normalize();
  const handT = pull.clone().add(adir.clone().multiplyScalar(-0.07)).add(UP.clone().multiplyScalar(-0.015)); // o punho fica logo atrás dos dedos que puxam
  const poleR = shR.clone().add(UP.clone().multiplyScalar(-0.45 + 0.8 * A)).add(fwd.clone().multiplyScalar(-0.2 - 0.5 * A)).add(right.clone().multiplyScalar(0.3)); // cotovelo alto e para trás mirando
  ik2(sr, er, hr, handT, poleR, W);
  { hr.updateWorldMatrix(true, false); const hy = new THREE.Vector3(0, 1, 0).transformDirection(hr.matrixWorld); rotBoneTo(hr, hy, hy.clone().lerp(adir, 0.6 * W).normalize()); } // dedos na direção da flecha
  stringFx(bow, pull, W > 0.3 && o.draw > 0.04);
  nock.visible = !!o.nock && W > 0.55 && alen > 0.05;
  if (nock.visible) { nock.position.copy(pull).add(adir.clone().multiplyScalar(0.37)); nock.lookAt(nock.position.clone().add(adir)); }
}
// atraso entre a puxada e a soltura, seguindo a velocidade de ataque (ASPD alto = puxa e solta rápido)
export const bowRelease = aspdMs => Math.max(0.09, Math.min(0.25, aspdMs / 1000 * 0.55));
// curva da corda ao longo de um tiro: puxa até a âncora, solta de uma vez, re-encaixa a próxima flecha
export function bowDraw(since, rel, shooting) { if (!shooting) return 0.1; if (since < rel) return 0.35 + 0.65 * (since / rel); if (since < rel + 0.1) return 0.02; return Math.min(0.55, 0.02 + (since - rel - 0.1) * 3); }

/* S-325: BESTA do Caçador — segurada com as DUAS mãos: a direita no cabo de pistola (a besta está presa a ela), a esquerda apoiando a
   coronha por baixo. Em guarda fica na altura do quadril apontando para a frente e para baixo; mirando, a coronha vai ao ombro direito e
   o rosto encosta no trilho; o disparo dá um coice para trás/cima; a recarga baixa a besta e a mão esquerda puxa a corda até a noz.
   o = { w, aim, recoil: 0..1, reload: 0..1, yaw, twist, cocked } */
export function crossbowPose(me, o) {
  const r = me.root, xb = r.userData.items && r.userData.items.xbow; if (!xb || !r.userData.xbowState) return;
  r.userData.xbowState(o.w > 0.02 ? 'hand' : 'back');
  if (xb.userData.setCocked) xb.userData.setCocked(o.cocked !== false);
  if (o.w < 0.02) return;
  const g = n => r.getObjectByName(n), sl = g('upperarm_l'), el = g('lowerarm_l'), hl = g('hand_l'), sr = g('upperarm_r'), er = g('lowerarm_r'), hr = g('hand_r'), hd = g('Head'), nk = g('neck_01'), s3 = g('spine_03');
  if (!sl || !el || !hl || !sr || !er || !hr || !hd) return;
  (me._gripR || (me._gripR = handGrip(r, 'r', 1)))(); (me._gripL || (me._gripL = handGrip(r, 'l', 0.7)))();
  const W = o.w, A = Math.max(0, o.aim - (o.reload || 0) * 0.85), tw = o.twist || 0, rc = o.recoil || 0, rl = o.reload || 0;
  const fwd = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw)), right = new THREE.Vector3(-Math.cos(o.yaw), 0, Math.sin(o.yaw));
  r.updateWorldMatrix(true, true);
  yawBone(s3, -tw * 0.45 * W); yawBone(nk, -tw * 0.25 * W); yawBone(hd, -tw * 0.3 * W);
  const shR = sr.getWorldPosition(new THREE.Vector3()), shL = sl.getWorldPosition(new THREE.Vector3()), head = hd.getWorldPosition(new THREE.Vector3());
  // mão direita (cabo): guarda na altura do quadril à frente; mirando, logo abaixo da bochecha com a coronha no ombro; coice para trás/cima
  const guardT = shR.clone().add(fwd.clone().multiplyScalar(0.26)).add(UP.clone().multiplyScalar(-0.42)).add(right.clone().multiplyScalar(-0.05));
  const aimT = head.clone().add(UP.clone().multiplyScalar(-0.17)).add(right.clone().multiplyScalar(0.06)).add(fwd.clone().multiplyScalar(0.12));
  const T = guardT.lerp(aimT, A).add(fwd.clone().multiplyScalar(-0.06 * rc)).add(UP.clone().multiplyScalar(0.03 * rc));
  ik2(sr, er, hr, T, shR.clone().add(UP.clone().multiplyScalar(-0.5)).add(right.clone().multiplyScalar(0.35)).add(fwd.clone().multiplyScalar(-0.15)), W);
  // gira o punho para a besta apontar para o alvo (guarda: inclinada para baixo; coice: o bico sobe), trilho para cima
  const dirG = fwd.clone().add(UP.clone().multiplyScalar(-0.45)).normalize(), dirA = fwd.clone().add(UP.clone().multiplyScalar(0.02 + 0.22 * rc)).normalize();
  const want = dirG.lerp(dirA, A).add(UP.clone().multiplyScalar(-0.6 * rl)).normalize();
  xb.updateWorldMatrix(true, false); const xz = new THREE.Vector3(0, 0, 1).transformDirection(xb.matrixWorld);
  rotBoneTo(hr, xz, xz.clone().lerp(want, W).normalize());
  xb.updateWorldMatrix(true, false); { const xy = new THREE.Vector3(0, 1, 0).transformDirection(xb.matrixWorld), xz2 = new THREE.Vector3(0, 0, 1).transformDirection(xb.matrixWorld);
    const upW = UP.clone().sub(xz2.clone().multiplyScalar(UP.dot(xz2))); if (upW.lengthSq() > 1e-4) { upW.normalize(); const ang = Math.atan2(new THREE.Vector3().crossVectors(xy, upW).dot(xz2), xy.dot(upW)); hr.getWorldQuaternion(_q2); _q.setFromAxisAngle(xz2, ang * W); _q2.premultiply(_q); setWorldQuat(hr, _q2.clone()); } }
  // mão esquerda: por baixo da coronha (na guarda e mirando); na recarga vai até a noz puxar a corda
  xb.updateWorldMatrix(true, false);
  const fore = new THREE.Vector3(0, -0.035, xb.userData.foreZ ?? 0.2).applyMatrix4(xb.matrixWorld), nut = new THREE.Vector3(0, 0.05, 0.05 + 0.25 * (1 - Math.abs(rl * 2 - 1))).applyMatrix4(xb.matrixWorld);
  const LT = fore.lerp(nut, Math.sin(Math.min(1, rl) * Math.PI));
  ik2(sl, el, hl, LT, shL.clone().add(UP.clone().multiplyScalar(-0.55)).add(right.clone().multiplyScalar(-0.25)).add(fwd.clone().multiplyScalar(0.05)), W);
  { hl.updateWorldMatrix(true, false); const hy = new THREE.Vector3(0, 1, 0).transformDirection(hl.matrixWorld), xzN = new THREE.Vector3(0, 0, 1).transformDirection(xb.matrixWorld); rotBoneTo(hl, hy, hy.clone().lerp(xzN, 0.5 * W).normalize()); } // dedos ao longo da coronha
  // cabeça encosta no trilho mirando
  if (A > 0.05 && nk) { hd.updateWorldMatrix(true, false); }
}
// tempos de um disparo de besta (segundos depois do clique): mira → solta (coice) → recarga; acompanham a velocidade de ataque
export function crossbowTimes(aspdMs) { const d = aspdMs / 1000; return { rel: Math.max(0.08, Math.min(0.2, d * 0.22)), kick: 0.14, reload: Math.max(0.25, Math.min(0.9, d * 0.55)) }; }
export function crossbowCycle(since, T, shooting) {
  if (!shooting || since > T.rel + T.kick + T.reload + 0.05) return { recoil: 0, reload: 0, cocked: true };
  if (since < T.rel) return { recoil: 0, reload: 0, cocked: true };
  const a = since - T.rel; if (a < T.kick) return { recoil: Math.sin(a / T.kick * Math.PI) , reload: 0, cocked: false };
  const b = (a - T.kick) / T.reload; return { recoil: 0, reload: Math.min(1, b), cocked: b > 0.82 };
}
