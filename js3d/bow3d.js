/* S-312: arco no estilo Skyrim/WoW, para o jogador e os manequins da galeria.
   - fora de combate o arco vai nas costas (holdBow em looks3d: root.userData.bowState('back' | 'hand'));
   - em guarda fica na mão esquerda, baixo e quase em pé, com a flecha encaixada e a mão direita na corda;
   - atirando, o arqueiro fica DE LADO para o alvo (o twist é aplicado no obj por quem chama), braço esquerdo estendido na
     altura do ombro, mão direita puxa a corda até o canto da boca com o cotovelo alto e para trás; a corda acompanha a mão.
   bowPose(me, o, ctx): me = { root, ... }, o = { w: peso da pose de combate, aim: 0 guarda → 1 mirando, draw: 0 corda solta → 1 na
   âncora, yaw: direção do alvo, twist: giro de lado já aplicado no corpo, nock: flecha visível }, ctx = { scene, makeArrow } */
import * as THREE from 'three';
import { gripHand } from './looks3d.js';

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
  // S-333: relógio da pose (dt do jogo quando quem chama passa; senão o relógio real) e molas criticamente amortecidas:
  // começam devagar, aceleram e chegam sem tranco (a suavização exponencial antiga dava o "estalo" ao sair da mira)
  const bdt = o.dt != null ? Math.min(0.1, o.dt) : Math.min(0.1, Math.max(0, performance.now() / 1000 - (me._bt ?? performance.now() / 1000))); me._bt = performance.now() / 1000;
  const now = (me._clk = (me._clk ?? 0) + bdt);
  const spring = (key, target, k) => { if (me[key] === undefined) { me[key] = target; me[key + 'V'] = 0; } const v = me[key + 'V'] + ((target - me[key]) * k - 2 * Math.sqrt(k) * me[key + 'V']) * bdt; me[key + 'V'] = v; me[key] += v * bdt; return me[key]; };
  const Aeff = Math.max(0, Math.min(1, spring('_bpA', o.aim, o.aim > (me._bpA ?? 0) ? 220 : 26))); // S-354: ergue o arco bem rápido (antes, a puxada acontecia com o arco ainda subindo e a mão ficava no peito) // entra na mira rápido, sai macio
  const Weff = Math.max(0, Math.min(1, spring('_bpW', o.w < (me._bpW ?? 0) && Aeff > 0.18 ? (me._bpW ?? 1) : o.w, o.w > (me._bpW ?? 0) ? 70 : 18))); // só solta o braço depois de baixar a mira
  r.userData.bowState(Weff > 0.02 ? 'hand' : 'back');
  const nock = me._nockObj || (me._nockObj = (() => { const a = ctx.makeArrow(); a.visible = false; ctx.scene.add(a); return a; })());
  if (Weff < 0.02) { nock.visible = false; stringFx(bow, null, false); me._hpL = null; return; }
  const g = n => r.getObjectByName(n), sl = g('upperarm_l'), el = g('lowerarm_l'), hl = g('hand_l'), sr = g('upperarm_r'), er = g('lowerarm_r'), hr = g('hand_r'), hd = g('Head'), nk = g('neck_01'), s3 = g('spine_03');
  if (!sl || !el || !hl || !sr || !er || !hr || !hd) return;
  gripHand(r, 'l', 'punho'); // P-013: mão do arco fechada em volta da empunhadura (encosta no cabo registrado)
  gripHand(r, 'r', 'corda'); // P-013: dedos da corda em gancho
  const W = Weff, A = Aeff, tw = o.twist || 0, fwd = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw)), right = new THREE.Vector3(-Math.cos(o.yaw), 0, Math.sin(o.yaw));
  r.updateWorldMatrix(true, true);
  // corpo de lado (twist no obj): o peito volta um pouco e a cabeça olha para o alvo
  yawBone(s3, -tw * 0.3 * W); yawBone(nk, -tw * 0.3 * W); yawBone(hd, -tw * 0.4 * W);
  const shL = sl.getWorldPosition(new THREE.Vector3()), shR = sr.getWorldPosition(new THREE.Vector3()), head = hd.getWorldPosition(new THREE.Vector3());
  // braço do arco: em guarda baixo e à frente; mirando estendido para o alvo na altura do ombro
  const guardT = shL.clone().add(fwd.clone().multiplyScalar(0.34)).add(UP.clone().multiplyScalar(-0.36)).add(right.clone().multiplyScalar(0.12));
  // S-354: mirando, a mão do arco sobe um pouco e vem para a frente do peito (lado da bochecha que ancora): assim a linha da flecha
  // (e o caminho da mão que puxa) passa à frente e acima do ombro do arco, nunca por dentro dele (anão: ombros mais largos e baixos)
  const dwarfB = !!r.userData.dwarf, aimT = shL.clone().add(fwd.clone().multiplyScalar(dwarfB ? 0.6 : 0.66)).add(UP.clone().multiplyScalar(dwarfB ? 0.1 : 0.08)).add(right.clone().multiplyScalar(dwarfB ? 0.19 : 0.16));
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
  // S-333: o relógio próprio da pose (quem chama não passa dt) — a mão que puxa é suavizada aqui, para nada "estalar"
  const gz = bow.userData.gripZ ?? -0.11, sz = (bow.userData.strMesh && bow.userData.strMesh.position.z) ?? 0.097;
  const grip = new THREE.Vector3(0, 0, gz).applyMatrix4(bow.matrixWorld), bz = new THREE.Vector3(0, 0, 1).transformDirection(bow.matrixWorld), by = new THREE.Vector3(0, 1, 0).transformDirection(bow.matrixWorld);
  const rightA = new THREE.Vector3().crossVectors(fwd, UP).normalize(); // direita de quem mira (lado da bochecha que recebe a corda)
  // a âncora: canto da boca, do lado direito do rosto (a corda passa rente à bochecha, nunca por dentro da cabeça)
  const dwarf = !!r.userData.dwarf, faceSide = dwarf ? 0.115 : 0.09; // a bochecha fica a ~9 cm do eixo da cabeça (anão: cabeça e barba mais largas)
  const anchor = head.clone().add(UP.clone().multiplyScalar(dwarf ? -0.05 : -0.07)).add(fwd.clone().multiplyScalar(0.06)).add(rightA.clone().multiplyScalar(faceSide));
  // S-333: a flecha apoia EM CIMA do punho do arco (no indicador), não no meio da empunhadura: sobe o quanto for preciso para não
  // passar por dentro da mão nem do antebraço (o anão tem antebraço bem mais grosso)
  const elP = el.getWorldPosition(new THREE.Vector3()), hlP = hl.getWorldPosition(new THREE.Vector3()), armR = r.userData.dwarf ? 0.068 : 0.05;
  const segDist = (p0, p1, q0, q1) => { // menor distância entre dois segmentos
    const d1 = p1.clone().sub(p0), d2 = q1.clone().sub(q0), r0 = p0.clone().sub(q0), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r0), c = d1.dot(r0), b = d1.dot(d2), den = a * e - b * b;
    let s = den > 1e-8 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0, t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    return p0.clone().add(d1.multiplyScalar(s)).distanceTo(q0.clone().add(d2.multiplyScalar(t)));
  };
  const drawK0 = Math.max(0, Math.min(1, o.draw)) * (0.3 + 0.7 * A);
  let restUp = 0.055;
  for (let it = 0; it < 4; it++) { // confere a flecha encaixada na corda solta (guarda) E a flecha puxada: nenhuma passa pelo antebraço/pulso
    const R = grip.clone().add(by.clone().multiplyScalar(restUp)), Sx = R.clone().add(bz.clone().multiplyScalar(sz - gz)), T = Sx.clone().lerp(anchor, drawK0);
    const d = Math.min(segDist(R, Sx, elP, hlP), segDist(R, T, elP, hlP)), need = armR + 0.016; if (d >= need) break; restUp += need - d + 0.004; }
  restUp = Math.min(restUp, 0.16);
  const restPt = grip.clone().add(by.clone().multiplyScalar(restUp)); // onde a flecha encosta no arco
  const strRest = restPt.clone().add(bz.clone().multiplyScalar(sz - gz)); // ponto de encaixe na corda solta, na mesma altura
  const drawK = Math.max(0, Math.min(1, o.draw)) * (0.3 + 0.7 * A); // em guarda só encosta na corda
  const tgt = strRest.clone().lerp(anchor, drawK);
  // mão suavizada (no espaço do corpo): puxa firme, e na soltura faz o "follow-through" (segue um pouco para trás ao lado do rosto,
  // dedos abrindo) e só então volta devagar para encaixar a próxima flecha — nada de salto de meio metro num quadro
  const prev = me._lastDraw ?? o.draw; if (prev > 0.8 && o.draw < 0.12) me._relAt = now; // soltura = corda quase na âncora caindo a quase zero (voltar da meia-puxada para a guarda NÃO é soltura)
  me._lastDraw = o.draw; // S-354: esta linha estava dentro do comentário — a soltura nunca era detectada
  const sinceRel = now - (me._relAt ?? -9);
  // S-333: depois de soltar, a mão NÃO volta até o arco: fica ao lado do rosto e desce macio até a meia-puxada (nova flecha já encaixada)
  const reNock = sinceRel < 0.7 && A > 0.3, handDrawK = reNock ? Math.max(drawK, 0.8 * (0.3 + 0.7 * A)) : drawK; // S-354: a mão fica perto do rosto entre um tiro e outro (a meia-puxada antiga deixava o antebraço no peito)
  const SP = me.obj || r.parent || r; SP.updateWorldMatrix(true, false); // espaço do PERSONAGEM (a raiz do esqueleto é animada e "pula" ao trocar de animação)
  // S-354: a mão que puxa faz um leve arco PARA FORA do peito e para cima no meio do caminho (o caminho reto da corda até a bochecha
  // passava rente ao peito/ombro, e com roupa volumosa ou o anão o antebraço entrava no corpo)
  const bulge = Math.sin(Math.PI * Math.max(0, Math.min(1, handDrawK))) * W;
  const tgtL = SP.worldToLocal(strRest.clone().lerp(anchor, handDrawK).add(rightA.clone().multiplyScalar((dwarf ? 0.1 : 0.08) * bulge)).add(UP.clone().multiplyScalar(0.035 * bulge)));
  if (!me._hpL) { me._hpL = tgtL.clone(); me._hpV = new THREE.Vector3(); }
  let want = tgtL, k;
  if (sinceRel < 0.16) { const back = anchor.clone().sub(restPt).normalize(); want = SP.worldToLocal(anchor.clone().add(back.multiplyScalar(0.07)).add(rightA.clone().multiplyScalar(0.035)).add(UP.clone().multiplyScalar(0.01))); k = 700; }
  else k = !reNock && o.draw > (me._drawSm ?? 0) + 0.02 ? 420 : 55; // puxando: acompanha a corda; voltando para encaixar outra flecha: macio
  me._drawSm = o.draw;
  { const acc = want.clone().sub(me._hpL).multiplyScalar(k).sub(me._hpV.clone().multiplyScalar(2 * Math.sqrt(k))); me._hpV.add(acc.multiplyScalar(bdt)); me._hpL.add(me._hpV.clone().multiplyScalar(bdt)); }
  const pull = SP.localToWorld(me._hpL.clone());
  const holding = o.draw > 0.04 && sinceRel > 0.14; // dedos na corda (fora da janela da soltura)
  const nockPt = holding ? pull : strRest, adir = restPt.clone().sub(nockPt); const alen = adir.length(); adir.normalize();
  // punho atrás dos dedos MAS para fora do rosto (dorso da mão contra a mandíbula, não dentro dela)
  const handT = pull.clone().add(adir.clone().multiplyScalar(-0.045)).add(rightA.clone().multiplyScalar(0.035)).add(UP.clone().multiplyScalar(-0.02));
  const headC = head.clone().add(fwd.clone().multiplyScalar(0.03)); // centro da cabeça no plano (o osso fica na nuca)
  { const headR = (r.userData.dwarf ? 0.135 : 0.115) + 0.04, v = handT.clone().sub(headC); const wY = Math.max(0, Math.min(1, (v.y + 0.24) / 0.1)) * Math.max(0, Math.min(1, (0.38 - v.y) / 0.1)); v.y = 0; const dh = v.length(); if (dh < headR) handT.add(rightA.clone().multiplyScalar((headR - dh) * wY)); } // entra gradual (sem "estalo" quando a mão passa pela altura do queixo) // nunca entra na cabeça/barba
  const poleR = shR.clone().add(UP.clone().multiplyScalar(-0.45 + 0.8 * A)).add(fwd.clone().multiplyScalar(-0.2 - 0.5 * A)).add(rightA.clone().multiplyScalar(0.3)); // cotovelo alto e para trás mirando
  ik2(sr, er, hr, handT, poleR, W);
  { hr.updateWorldMatrix(true, false); const hy = new THREE.Vector3(0, 1, 0).transformDirection(hr.matrixWorld); rotBoneTo(hr, hy, hy.clone().lerp(adir, 0.6 * W).normalize()); } // dedos na direção da flecha
  stringFx(bow, holding ? pull : null, W > 0.3 && holding);
  nock.visible = !!o.nock && W > 0.55 && alen > 0.05;
  if (nock.visible) { nock.position.copy(nockPt).add(adir.clone().multiplyScalar(0.37)); nock.lookAt(nock.position.clone().add(adir)); }
}
// atraso entre a puxada e a soltura, seguindo a velocidade de ataque (ASPD alto = puxa e solta rápido)
export const bowRelease = aspdMs => Math.max(0.09, Math.min(0.25, aspdMs / 1000 * 0.55));
// curva da corda ao longo de um tiro: puxa até a âncora, solta de uma vez, re-encaixa a próxima flecha
export function bowDraw(since, rel, shooting) { if (!shooting) return 0.1; if (since < rel) return 0.35 + 0.65 * (since / rel); if (since < rel + 0.1) return 0.02; return Math.min(0.8, 0.02 + (since - rel - 0.1) * 4); }

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
  gripHand(r, 'r', 'punho'); gripHand(r, 'l', 'apoio'); // P-013: cabo da besta no punho direito; esquerda apoia
  const W = o.w, A = Math.max(0, o.aim - (o.reload || 0) * 0.85), tw = o.twist || 0, rc = o.recoil || 0, rl = o.reload || 0;
  const fwd = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw)), right = new THREE.Vector3(-Math.cos(o.yaw), 0, Math.sin(o.yaw));
  r.updateWorldMatrix(true, true);
  yawBone(s3, -tw * 0.45 * W); yawBone(nk, -tw * 0.25 * W); yawBone(hd, -tw * 0.3 * W);
  const shR = sr.getWorldPosition(new THREE.Vector3()), shL = sl.getWorldPosition(new THREE.Vector3()), head = hd.getWorldPosition(new THREE.Vector3());
  // mão direita (cabo): guarda na altura do quadril à frente; mirando, logo abaixo da bochecha com a coronha no ombro; coice para trás/cima
  const guardT = shR.clone().add(fwd.clone().multiplyScalar(0.26)).add(UP.clone().multiplyScalar(-0.42)).add(right.clone().multiplyScalar(-0.05));
  // S-355: mirando, a CORONHA encosta no "bolso" do ombro direito (um pouco para dentro da junta e à frente) e o trilho fica na altura
  // da bochecha, apontando para o alvo — a mão do cabo é posta a partir dessa coronha (antes a besta ficava no peito e a coronha
  // atravessava o tórax/braço, sobretudo no anão). Medidas no espaço da besta: coronha z ≈ −0,36, cabo da mão (0, −0,13, −0,15).
  const dirAim = fwd.clone().add(UP.clone().multiplyScalar(0.02)).normalize(), ctr = shL.clone().sub(shR); ctr.y = 0; ctr.normalize();
  const dwarfX = !!r.userData.dwarf, butt = shR.clone().add(fwd.clone().multiplyScalar(dwarfX ? 0.1 : 0.08)).add(UP.clone().multiplyScalar(dwarfX ? 0.03 : 0.015)).add(ctr.multiplyScalar(dwarfX ? 0.07 : 0.05));
  const upAim = UP.clone().sub(dirAim.clone().multiplyScalar(UP.dot(dirAim))).normalize();
  const aimT = butt.add(dirAim.clone().multiplyScalar(0.36 - 0.15)).add(upAim.multiplyScalar(-0.13 + 0.03));
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
