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
/* S-397/S-400: passo EXATO de mola criticamente amortecida (forma fechada). A integração de Euler usada antes só é estável se
   dt·2√k < 1: com k = 420–700 isso exige mais de ~50 FPS — a 30 FPS (ou num engasgo no PvP) a mola explodia e jogava a mão da
   corda para trás da cabeça. Esta forma é estável para QUALQUER dt e chega no alvo sem passar do ponto. */
function cdStep(x, v, target, k, dt) { const w = Math.sqrt(k), y = x - target, e = Math.exp(-w * dt), t = (v + w * y) * dt; return [target + (y + t) * e, (v - w * t) * e]; }
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
/* S-359/S-369: medidas do rosto de cada personagem, no espaço do osso da cabeça (+x esquerda, +y cima, +z frente), feitas uma vez a
   partir dos vértices da cabeça/barba (vale para humano, elfo e anão, com ou sem barba): escala do rosto, ponto da âncora (canto da
   boca/queixo, lado direito) e um mapa (y, z) → x mais à direita da superfície, para a mão nunca entrar no rosto. */
const FB = { y0: -0.12, z0: -0.16, n: 30, st: 0.015 };
function faceOf(r, hd) {
  if (r.userData._face && r.userData._face.hd === hd) return r.userData._face;
  r.updateMatrixWorld(true);
  const grid = new Float32Array(FB.n * FB.n).fill(-9), v = new THREE.Vector3(), mn = [9, 9, 9], mx = [-9, -9, -9], bmn = [9, 9, 9], bmx = [-9, -9, -9]; let front = 0;
  r.traverse(o => {
    // a barba (malha "Hair_Beard") ENTRA no volume: antes caía no filtro de cabelo e o braço do anão atravessava a barba sem ser visto
    const beard = /beard|barba/i.test(o.name);
    if (!o.isSkinnedMesh || !o.visible || !o.skeleton || (!beard && /hair|cabelo|brow|eye|olho|hat|helm/i.test(o.name))) return;
    const hi = o.skeleton.bones.indexOf(hd), SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight; if (hi < 0 || !SI) return;
    const core = !beard, lo = core ? mn : bmn, hi3 = core ? mx : bmx;
    for (let i = 0; i < SI.count; i++) {
      let w = 0; for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === hi) w += SW.getComponent(i, k); if (w < 0.5) continue;
      o.getVertexPosition(i, v); o.localToWorld(v); hd.worldToLocal(v);
      if (core && w > 0.9 && Math.abs(v.x) < 0.03 && v.z > front) front = v.z;
      if (v.y > -0.06 || !core) { const a = [v.x, v.y, v.z]; for (let k = 0; k < 3; k++) { if (a[k] < lo[k]) lo[k] = a[k]; if (a[k] > hi3[k]) hi3[k] = a[k]; } } // S-379: volume da cabeça (crânio + rosto) e, à parte, o da barba
      const iy = Math.floor((v.y - FB.y0) / FB.st), iz = Math.floor((v.z - FB.z0) / FB.st); if (iy < 0 || iz < 0 || iy >= FB.n || iz >= FB.n) continue;
      const j = iy * FB.n + iz; grid[j] = Math.max(grid[j], -v.x); // guarda o quanto a superfície vai para a DIREITA (−x)
    }
  });
  // S-379: raio do pescoço MEDIDO (vértices presos ao osso do pescoço, distância ao eixo pescoço→cabeça; mediana)
  const nkB = r.getObjectByName('neck_01'), nds = [];
  if (nkB) { const A0 = nkB.getWorldPosition(new THREE.Vector3()), A1 = hd.getWorldPosition(new THREE.Vector3()), ab = A1.clone().sub(A0), L2 = Math.max(1e-6, ab.lengthSq());
    r.traverse(o => { if (!o.isSkinnedMesh || !o.visible || !o.skeleton) return; const ni = o.skeleton.bones.indexOf(nkB), SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight; if (ni < 0 || !SI) return;
      for (let i = 0; i < SI.count; i += 2) { let w = 0; for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === ni) w += SW.getComponent(i, k); if (w < 0.6) continue;
        o.getVertexPosition(i, v); o.localToWorld(v); const t = Math.max(0, Math.min(1, v.clone().sub(A0).dot(ab) / L2)); nds.push(v.distanceTo(A0.clone().addScaledVector(ab, t))); } }); }
  nds.sort((a, b) => a - b);
  const s = Math.max(0.85, Math.min(1.5, (front || 0.129) / 0.129)), dw = !!r.userData.dwarf;
  // âncora: corda no canto direito da boca/queixo, rente à pele (anão: a barba cobre o queixo — a corda passa por fora dela)
  const F = { hd, s, grid, ax: (dw ? 0.06 : 0.032) * s, ay: (dw ? 0.045 : 0.04) * s, az: (dw ? 0.115 : 0.112) * s };
  // S-379: elipsoide da cabeça (espaço do osso) — o braço que puxa a corda nunca pode entrar nele
  F.nr = nds.length > 10 ? Math.max(0.035, Math.min(0.09, nds[(nds.length * 0.5) | 0] * 1.05)) : (dw ? 0.06 : 0.05);
  F.ec = mx[0] > mn[0] ? new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2) : new THREE.Vector3(0, 0.1, 0.02);
  F.eh = mx[0] > mn[0] ? new THREE.Vector3((mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2, (mx[2] - mn[2]) / 2) : new THREE.Vector3(0.09, 0.11, 0.11);
  // barba: elipsoide próprio (um pouco folgado, para cobrir as "quinas" do queixo e das costeletas que o elipsoide inscrito na caixa perde)
  if (bmx[0] > bmn[0]) { F.bc = new THREE.Vector3((bmn[0] + bmx[0]) / 2, (bmn[1] + bmx[1]) / 2, (bmn[2] + bmx[2]) / 2); F.bh = new THREE.Vector3((bmx[0] - bmn[0]) / 2 * 1.08, (bmx[1] - bmn[1]) / 2 * 1.05, (bmx[2] - bmn[2]) / 2 * 1.08); }
  return (r.userData._face = F);
}
function faceMinX(F, y, z) { // x (espaço da cabeça) da superfície do lado direito perto de (y, z); 9 = sem rosto ali
  const iy = Math.floor((y - FB.y0) / FB.st), iz = Math.floor((z - FB.z0) / FB.st); let m = -9;
  for (let a = iy - 1; a <= iy + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) { if (a < 0 || b < 0 || a >= FB.n || b >= FB.n) continue; m = Math.max(m, F.grid[a * FB.n + b]); }
  return m <= -8.9 ? 9 : -m;
}
// mão direita orientada: dedos (do punho ao nó do dedo médio) para `fing`, palma para `palm` (mistura w)
function orientHand(r, hr, fing, palm, w) {
  if (w <= 0.001) return;
  const L = hr.userData._hb || (hr.userData._hb = (() => { const m = r.getObjectByName('middle_01_r'), t = r.getObjectByName('thumb_01_r'); if (!m || !t) return null;
    const f = m.position.clone().normalize(), th = t.position.clone(); th.sub(f.clone().multiplyScalar(th.dot(f))).normalize(); const n = new THREE.Vector3().crossVectors(f, th).negate().normalize(); // mão direita: palma = −(dedos × polegar)
    return new THREE.Matrix4().makeBasis(f, n, new THREE.Vector3().crossVectors(f, n)); })());
  if (!L) return;
  const f = fing.clone().normalize(), n = palm.clone().sub(f.clone().multiplyScalar(palm.dot(f))).normalize();
  const Wm = new THREE.Matrix4().makeBasis(f, n, new THREE.Vector3().crossVectors(f, n));
  const qW = new THREE.Quaternion().setFromRotationMatrix(Wm.multiply(L.clone().transpose()));
  hr.getWorldQuaternion(_q2); _q2.slerp(qW, w); setWorldQuat(hr, _q2.clone());
}
/* S-379: o braço que puxa a corda nunca entra na cabeça, no pescoço nem no peito. O cotovelo pode estar em qualquer ponto de um
   círculo (ombro e punho fixos): testa vários pontos desse círculo e fica com o mais perto do cotovelo "ideal" (alto e para trás)
   que deixe o braço inteiro por fora do elipsoide medido da cabeça (com a barba), do pescoço e do peito. Se nenhum serve (cabeça
   girada demais, rosto grande), o punho se afasta do rosto até o braço caber. Vale em TODOS os quadros da puxada. */
const _e = new THREE.Vector3(), _e2 = new THREE.Vector3(), _mH = new THREE.Matrix4(), CLEAR_MIN = 0.007; // folga mínima aceita (m)
function segPt(p, a, b, open, out) { const ab = _e2.copy(b).sub(a), t0 = p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()); if (open && t0 > 1) return 9; const t = Math.max(0, Math.min(1, t0)), c = a.clone().addScaledVector(ab, t); if (out) out.copy(p).sub(c); return p.distanceTo(c); } // open: acima do fim do segmento não conta (o peito não tem "tampa" subindo até o queixo)
function bodyOf(r, F, hd) { // volumes do quadro: cabeça (elipsoide no espaço do osso), pescoço e peito (cápsulas)
  const g = n => r.getObjectByName(n), nk = g('neck_01'), s2 = g('spine_02'), s3 = g('spine_03'), dw = !!r.userData.dwarf;
  hd.updateWorldMatrix(true, false); _mH.copy(hd.matrixWorld).invert();
  const sh = g('upperarm_r'), c0 = s2 ? s2.getWorldPosition(new THREE.Vector3()) : null, c1 = s3 ? s3.getWorldPosition(new THREE.Vector3()) : null;
  const dSh = sh && c0 ? segPt(sh.getWorldPosition(new THREE.Vector3()), c0, c1) : 0.2; // o peito nunca é mais largo que a junta do ombro
  return { inv: _mH.clone(), mw: hd.matrixWorld.clone(), F, nk0: nk ? nk.getWorldPosition(new THREE.Vector3()) : null, nk1: hd.getWorldPosition(new THREE.Vector3()), nkR: F.nr,
    ch0: c0, ch1: c1, chR: Math.min(dw ? 0.15 : 0.105, dSh * 0.7), armR: dw ? 0.055 : 0.046 };
}
function ellDist(q, c, h, out) { const x = q.x - c.x, y = q.y - c.y, z = q.z - c.z, L = Math.hypot(x / h.x, y / h.y, z / h.z); if (out) out.set(x / (h.x * h.x), y / (h.y * h.y), z / (h.z * h.z)); return (L - 1) * Math.hypot(x, y, z) / Math.max(L, 1e-6); }
const _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3(), _gn = new THREE.Vector3(), _gc = new THREE.Vector3();
function headDist(Bd, p, out) { // crânio ∪ barba; out = direção "para fora" (mundo)
  const q = _e.copy(p).applyMatrix4(Bd.inv); let d = ellDist(q, Bd.F.ec, Bd.F.eh, _g1), g = _g1;
  if (Bd.F.bc) { const d2 = ellDist(q, Bd.F.bc, Bd.F.bh, _g2); if (d2 < d) { d = d2; g = _g2; } }
  if (out) out.copy(g).transformDirection(Bd.mw); return d;
}
function armClear(Bd, S, E, T) { // menor folga (m) do braço (ombro→cotovelo→punho) até cabeça/pescoço/peito; < 0 = atravessa. Bd.n = para onde sair
  let m = 9; const P = new THREE.Vector3(); Bd.n = Bd.n || new THREE.Vector3();
  const test = (p, chest, lb) => { const dh = headDist(Bd, p, _g1.set(0, 0, 0)), hn = _gn.copy(_g1), dn = Bd.nk0 ? segPt(p, Bd.nk0, Bd.nk1, false, _gc) - Bd.nkR + Bd.armR * 0.6 : 9, /* o antebraço pode roçar o pescoço/gola (como no arqueiro de verdade) */ nn = _gc.clone(), dc = chest && Bd.ch0 ? segPt(p, Bd.ch0, Bd.ch1, true, _gc) - Bd.chR : 9, d = Math.min(dh, dn, dc) - Bd.armR;
    if (d < m) { m = d; const w = d + Bd.armR === dh ? 0 : d + Bd.armR === dn ? 1 : 2; Bd.lbl = ['cabeça ', 'pescoço ', 'peito '][w] + lb; Bd.n.copy(w === 0 ? hn : w === 1 ? nn : _gc).normalize(); } };
  for (const t of [0.45, 0.7, 1]) test(P.copy(S).lerp(E, t), t > 0.9, 'braço'); // braço: cabeça/pescoço; o cotovelo também fora do peito
  for (const t of [0.2, 0.4, 0.6]) test(P.copy(E).lerp(T, t), true, 'antebraço'); // o fim do antebraço (punho) encosta no rosto de propósito: a mão é tratada à parte
  return m;
}
function elbowSafe(sr, er, hr, T, pole, Bd, prev = 0) { // devolve o polo (ponto do cotovelo) com folga, a folga obtida e o ângulo escolhido
  const S = sr.getWorldPosition(new THREE.Vector3()), Eb = er.getWorldPosition(new THREE.Vector3()), l1 = S.distanceTo(Eb), l2 = Eb.distanceTo(hr.getWorldPosition(new THREE.Vector3()));
  const d = Math.min(l1 + l2 - 1e-3, Math.max(0.05, S.distanceTo(T))), u = T.clone().sub(S).normalize();
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), Cc = S.clone().addScaledVector(u, l1 * cosA), rr = l1 * Math.sqrt(1 - cosA * cosA);
  const e1 = pole.clone().sub(S); e1.addScaledVector(u, -e1.dot(u)); if (e1.lengthSq() < 1e-8) return { pole, clear: 9, th: 0, n: new THREE.Vector3(), reach: l1 + l2 }; e1.normalize(); const e2 = new THREE.Vector3().crossVectors(u, e1);
  const Tc = S.clone().addScaledVector(u, d);
  let best = null;
  for (let i = 0; i <= 12; i++) { // até 90° do cotovelo ideal: o cotovelo nunca vai para a frente do peito
    const th = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12, E = Cc.clone().addScaledVector(e1, rr * Math.cos(th)).addScaledVector(e2, rr * Math.sin(th));
    const c = armClear(Bd, S, E, Tc), sc = Math.abs(th) * 0.05 + Math.abs(th - prev) * 0.04 + Math.max(0, 0.014 - c) * 25; // perto do ideal e do ângulo do quadro anterior (sem tremer)
    if (!best || sc < best.sc) best = { sc, E, clear: c, th, lbl: Bd.lbl, n: Bd.n.clone() };
    if (i === 0 && c >= 0.014) break; // o cotovelo ideal já está livre
  }
  return { pole: best.E, clear: best.clear, th: best.th, lbl: best.lbl, n: best.n, reach: l1 + l2 };
}
function contactPt(r) { // onde a corda engancha: entre a 2ª e a 3ª falange do indicador e do médio
  const b = ['index_02_r', 'index_03_r', 'middle_02_r', 'middle_03_r'].map(n => r.getObjectByName(n)); if (b.some(x => !x)) return null;
  const p = b.map(x => x.getWorldPosition(new THREE.Vector3())); return p[0].add(p[1]).add(p[2]).add(p[3]).multiplyScalar(0.25);
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
  const spring = (key, target, k) => { if (me[key] === undefined) { me[key] = target; me[key + 'V'] = 0; } const [x, v] = cdStep(me[key], me[key + 'V'], target, k, bdt); me[key] = x; me[key + 'V'] = v; return x; }; // S-397/S-400: mola exata (estável em qualquer FPS)
  const Aeff = Math.max(0, Math.min(1, spring('_bpA', o.aim, o.aim > (me._bpA ?? 0) ? 220 : 26))); // S-354: ergue o arco bem rápido (antes, a puxada acontecia com o arco ainda subindo e a mão ficava no peito) // entra na mira rápido, sai macio
  const Weff = Math.max(0, Math.min(1, spring('_bpW', o.w < (me._bpW ?? 0) && Aeff > 0.18 ? (me._bpW ?? 1) : o.w, o.w > (me._bpW ?? 0) ? 70 : 18))); // só solta o braço depois de baixar a mira
  r.userData.bowState(Weff > 0.02 ? 'hand' : 'back');
  const nock = me._nockObj || (me._nockObj = (() => { const a = ctx.makeArrow(); a.visible = false; ctx.scene.add(a); return a; })());
  if (Weff < 0.02) { nock.visible = false; stringFx(bow, null, false); me._hpL = null; return; }
  const g = n => r.getObjectByName(n), sl = g('upperarm_l'), el = g('lowerarm_l'), hl = g('hand_l'), sr = g('upperarm_r'), er = g('lowerarm_r'), hr = g('hand_r'), hd = g('Head'), nk = g('neck_01'), s3 = g('spine_03');
  if (!sl || !el || !hl || !sr || !er || !hr || !hd) return;
  gripHand(r, 'l', 'punho'); // P-013: mão do arco fechada em volta da empunhadura (encosta no cabo registrado)
  gripHand(r, 'r', 'corda'); // P-013: dedos da corda em gancho
  const W = Weff, A = Aeff, spin = o.spine || 0, tw = (o.twist || 0) + spin, fwd = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw)), right = new THREE.Vector3(-Math.cos(o.yaw), 0, Math.sin(o.yaw));
  r.updateWorldMatrix(true, true);
  // S-397/S-400 (como no Skyrim): andando e mirando, as pernas seguem o passo e só o TRONCO fica de lado para o alvo (giro dividido
  // na coluna) — antes, andando, o arqueiro puxava a corda de frente e o braço cruzava a cara
  if (Math.abs(spin) > 1e-3) { for (const nm of ['spine_01', 'spine_02', 'spine_03']) yawBone(r.getObjectByName(nm), spin * W / 3); r.updateWorldMatrix(true, true); }
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
  // S-359/S-369: a âncora agora sai do ROSTO medido (no espaço do osso da cabeça, que já olha para o alvo): os dedos da corda
  // ficam no canto da boca/queixo, do lado direito — antes a âncora ficava 7 cm abaixo e 9 cm ao lado do osso (no pescoço) e a
  // trava anti-cabeça empurrava a mão para longe: o braço ficava aberto ao lado e a mão parecia sumir
  const dwarf = !!r.userData.dwarf, F = faceOf(r, hd);
  hd.updateWorldMatrix(true, false);
  const anchor = hd.localToWorld(new THREE.Vector3(-F.ax, F.ay, F.az));
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
  for (const c of ['x', 'y', 'z']) { const [x, v] = cdStep(me._hpL[c], me._hpV[c], want[c], k, bdt); me._hpL[c] = x; me._hpV[c] = v; } // S-397/S-400: mola exata — a de Euler explodia com o jogo abaixo de ~50 FPS (a mão voava 80 cm para trás/para cima da cabeça depois de cada tiro)
  const pull = SP.localToWorld(me._hpL.clone());
  const holding = o.draw > 0.04 && sinceRel > 0.14; // dedos na corda (fora da janela da soltura)
  let adir = restPt.clone().sub(holding ? pull : strRest).normalize();
  // S-359/S-369: a MÃO inteira é posta pelos dedos. A mão direita fica "de aperto de mão": palma voltada para o rosto, dedos para o
  // arco (um pouco para baixo), dorso para fora; o punho é corrigido até o ponto de contato dos dedos (entre a 2ª e a 3ª falange do
  // indicador e do médio, onde a corda engancha) cair em cima do ponto da corda; e a mão nunca entra no rosto/barba (mapa medido).
  const poleR = shR.clone().add(UP.clone().multiplyScalar(-0.45 + 0.8 * A)).add(fwd.clone().multiplyScalar(-0.2 - 0.5 * A)).add(rightA.clone().multiplyScalar(0.3)); // cotovelo alto e para trás mirando
  const fingW = adir.clone().add(UP.clone().multiplyScalar(-0.12)).normalize(), palmW = rightA.clone().negate(); palmW.sub(fingW.clone().multiplyScalar(palmW.dot(fingW))).normalize();
  const wristT = pull.clone().addScaledVector(fingW, -0.075).addScaledVector(palmW, -0.02);
  const hx = new THREE.Vector3(1, 0, 0).transformDirection(hd.matrixWorld); // "esquerda" da cabeça no mundo
  const q0 = [sr, er, hr].map(b => b.quaternion.clone()), reset = () => { [sr, er, hr].forEach((b, i) => b.quaternion.copy(q0[i])); sr.updateWorldMatrix(false, true); }; // cada passada parte da mesma pose (o peso W não se acumula)
  const Bd = bodyOf(r, F, hd), Sp = sr.getWorldPosition(new THREE.Vector3()); let clear = 9;
  const solve = () => { // S-379: braço por IK com o cotovelo num ponto livre (nada de antebraço/cotovelo dentro da cabeça)
    // se nenhum cotovelo cabe (braço curto e manga larga do anão, barba), o punho sai do que está sendo atravessado — na direção
    // "para fora" do ponto mais fundo (cabeça/barba, pescoço ou peito) —, aos poucos; fica a melhor passada (nunca piora)
    const wt = wristT.clone(), wp = () => [sr, er, hr].map(b => b.getWorldPosition(new THREE.Vector3())); let best = null, worse = 0;
    for (let k = 0; k < 16; k++) {
      reset(); const te = hr.getWorldPosition(new THREE.Vector3()).lerp(wt, W), sv = elbowSafe(sr, er, hr, te, poleR, Bd, me._elbTh || 0); // te: onde o punho fica DE VERDADE com o peso W (na entrada/saída da pose o braço também é conferido)
      ik2(sr, er, hr, te, sv.pole, 1); const c = armClear(Bd, ...wp()), n = Bd.n.clone(); // a folga REAL depois do IK (o IK erra 2–3 cm em relação à previsão)
      if (!best || c > best.c + 1e-4) { best = { sv, te, c }; worse = 0; } else if (++worse >= 6) break;
      if (c >= CLEAR_MIN) break;
      if (k === 0) { const dS = wt.distanceTo(Sp); if (dS > sv.reach * 0.98) { wt.sub(Sp).multiplyScalar(sv.reach * 0.98 / dS).add(Sp); continue; } } // alvo além do alcance: primeiro traz para onde o braço chega
      n.y = Math.min(n.y, 0.1); if (n.lengthSq() < 1e-6) n.copy(rightA); n.normalize(); // S-397/S-400: sair da cabeça para o LADO/trás, nunca para cima (a mão subia por cima da cabeça)
      wt.addScaledVector(n, Math.min(0.04, CLEAR_MIN + 0.004 - c)); if (wt.y > anchor.y + 0.07) wt.y = anchor.y + 0.07;
      const dS = wt.distanceTo(Sp); if (dS > sv.reach * 0.98) wt.sub(Sp).multiplyScalar(sv.reach * 0.98 / dS).add(Sp); // além do alcance não adianta
    }
    reset(); ik2(sr, er, hr, best.te, best.sv.pole, 1); clear = best.c; me._elbTh = best.sv.th;
    orientHand(r, hr, fingW, palmW, W);
  };
  for (let it = 0; it < 3; it++) {
    solve();
    const C = contactPt(r); if (!C) break;
    // corrige só o erro da MÃO (dedos × corda): punho = corda − (dedos − punho); o afastamento do corpo é refeito na próxima passada
    wristT.lerp(pull.clone().sub(C).add(hr.getWorldPosition(new THREE.Vector3())), W);
    // nada de mão dentro do rosto: o centro da mão (entre o punho e os dedos) fica à direita da superfície medida da cabeça
    const hc = hd.worldToLocal(hr.getWorldPosition(new THREE.Vector3()).lerp(C, 0.5)), lim = faceMinX(F, hc.y, hc.z) - (dwarf ? 0.04 : 0.032);
    if (hc.x > lim) wristT.addScaledVector(hx, (lim - hc.x) * W);
  }
  solve(); clear = armClear(Bd, sr.getWorldPosition(new THREE.Vector3()), er.getWorldPosition(new THREE.Vector3()), hr.getWorldPosition(new THREE.Vector3())); me._bowClear = clear; me._bowHit = Bd.lbl; if (W > 0.9 && A > 0.9) { if (clear < (me._bowClearMin ?? 9)) me._bowHitMin = Bd.lbl; me._bowClearMin = Math.min(me._bowClearMin ?? 9, clear); } // folga final do braço (testes)
  const fingers = contactPt(r) || pull; // onde os dedos estão DE VERDADE: a corda e a flecha saem daqui
  me._bowGap = o.draw > 0.75 ? fingers.distanceTo(anchor) : null; // testes: dedos × âncora no rosto
  const nockPt = holding ? fingers : strRest; adir = restPt.clone().sub(nockPt); const alen = adir.length(); adir.normalize();
  stringFx(bow, holding ? fingers : null, W > 0.3 && holding);
  me._nockOn = !!o.nock; nock.visible = !!o.nock && W > 0.55 && alen > 0.05;
  if (nock.visible) { nock.position.copy(nockPt).add(adir.clone().multiplyScalar(0.37)); nock.lookAt(nock.position.clone().add(adir)); }
}
/* S-379: PERNAS DE ARQUEIRO — mirando parado, os pés ficam plantados de lado para o alvo: o esquerdo à frente, na linha da flecha
   (ponta virada um pouco para o alvo), o direito atrás, atravessado. Os pés NÃO giram junto com a mira: enquanto a mira muda pouco
   só o tronco acompanha; quando passa de ~30° (ou o corpo saiu do lugar) o arqueiro dá um passo de ajuste — primeiro o pé da frente,
   depois o de trás, com o pé saindo do chão — e a base volta a ficar de lado para a nova mira. Só mexe nas pernas (coxa, canela e
   pé, por IK), depois do giro final do corpo: o tronco, os braços e a flecha não mudam.
   o = { k: peso (0 = pernas da animação), yaw: direção do alvo, dt } */
const _l = new THREE.Vector3(), _lq = new THREE.Quaternion();
const angD = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const smooth = u => u * u * (3 - 2 * u);
export function archerLegs(me, o) {
  const r = me.root, SP = me.obj || r.parent || r, dt = Math.min(0.1, o.dt || 1 / 30);
  if (!(o.k > 0.01)) { me._stance = null; return; }
  const L = me._legB || (me._legB = ['thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'].map(n => r.getObjectByName(n))); if (L.some(b => !b)) return;
  SP.updateWorldMatrix(true, true);
  const base = SP.getWorldPosition(new THREE.Vector3()), bf = new THREE.Vector3(0, 0, 1).transformDirection(SP.matrixWorld), bodyYaw = Math.atan2(bf.x, bf.z);
  const leg = me._legLen || (me._legLen = L[0].getWorldPosition(_l).distanceTo(L[1].getWorldPosition(new THREE.Vector3())) + L[1].getWorldPosition(new THREE.Vector3()).distanceTo(L[2].getWorldPosition(new THREE.Vector3())));
  const sc = leg / 0.86; // anão ~0,6 da perna humana
  let st = me._stance;
  if (!st) st = me._stance = { yaw: o.yaw, x: base.x, z: base.z, from: null, u: 1 };
  if (st.u >= 1 && (Math.abs(angD(o.yaw, st.yaw)) > 0.52 || Math.hypot(base.x - st.x, base.z - st.z) > 0.16 * sc)) { st.from = { yaw: st.yaw, x: st.x, z: st.z }; st.yaw = o.yaw; st.x = base.x; st.z = base.z; st.u = 0; }
  if (st.u < 1) st.u = Math.min(1, st.u + dt / 0.36);
  const feetOf = (S, i) => { // pé i (0 esquerdo, 1 direito) da base S: posição no chão (x, z) e para onde a ponta aponta
    const f = new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw)), rt = new THREE.Vector3(-Math.cos(S.yaw), 0, Math.sin(S.yaw)), hs = 0.21 * sc; // ~largura dos ombros
    const p = new THREE.Vector3(S.x, 0, S.z).addScaledVector(f, i ? -hs : hs).addScaledVector(rt, i ? 0.035 * sc : -0.01 * sc);
    return { p, toe: i ? S.yaw - Math.PI / 2 - 0.12 : S.yaw - 0.62 };
  };
  for (let i = 0; i < 2; i++) {
    const [th, ca, ft] = L.slice(i * 3, i * 3 + 3);
    const cur = ft.getWorldPosition(new THREE.Vector3()), cq = ft.getWorldQuaternion(new THREE.Quaternion());
    let F = feetOf(st, i), lift = 0;
    if (st.u < 1 && st.from) { // passo: o pé da frente primeiro, o de trás logo depois
      const uf = Math.max(0, Math.min(1, (st.u - (i ? 0.38 : 0)) / 0.62)), A = feetOf(st.from, i), e = smooth(uf);
      F = { p: A.p.lerp(F.p, e), toe: A.toe + angD(F.toe, A.toe) * e }; lift = Math.sin(Math.PI * uf) * 0.07 * sc;
    }
    const T = cur.clone().lerp(new THREE.Vector3(F.p.x, cur.y + lift, F.p.z), o.k); T.y = cur.y + lift * o.k;
    const H = th.getWorldPosition(new THREE.Vector3()), v = H.y - T.y, maxH = Math.sqrt(Math.max(0.0001, (0.985 * leg) ** 2 - v * v)), hz = new THREE.Vector3(T.x - H.x, 0, T.z - H.z);
    if (hz.length() > maxH) { hz.setLength(maxH); T.x = H.x + hz.x; T.z = H.z + hz.z; } // sem esticar a perna além do joelho
    const toe = bodyYaw + angD(F.toe, bodyYaw) * o.k, td = new THREE.Vector3(Math.sin(toe), 0, Math.cos(toe));
    ik2(th, ca, ft, T, H.clone().addScaledVector(td, leg).add(new THREE.Vector3(0, -0.3 * leg, 0)), 1);
    _lq.setFromAxisAngle(UP, angD(toe, bodyYaw)); setWorldQuat(ft, cq.premultiply(_lq)); // o pé gira em volta da vertical (a sola continua no chão)
  }
}
/* S-397/S-400: ARCO DOS OUTROS JOGADORES (Arena e mundo aberto). Antes eles tocavam o clipe de "atirar com pistola" com o arco nas
   costas. Agora cada jogador manda o estado do arco (b = [guarda, mira, puxada, flecha encaixada]) e quem vê monta a MESMA pose do
   arqueiro local: de lado parado, só o tronco de lado andando, mão da corda no rosto. Chame DEPOIS de atualizar a animação.
   Devolve true se o personagem é arqueiro (quem chama não deve tocar o clipe de tiro). */
export function remoteBow(ch, b, moving, yaw, dt, ctx) {
  if (!ch || !ch.root || !ch.root.userData.bowState || !(ch.root.userData.items && ch.root.userData.items.bow)) return false;
  const [w = 0, a = 0, d = 0.1, nk = 1] = Array.isArray(b) ? b : [];
  const sm = (k, v, rate) => (ch[k] = (ch[k] ?? v) + (v - (ch[k] ?? v)) * Math.min(1, dt * rate));
  const W = sm('_rW', +w || 0, 10), A = sm('_rA', +a || 0, 14), D = (+d || 0) < (ch._rD ?? 0) - 0.3 ? (ch._rD = +d || 0) : sm('_rD', +d || 0, 18); // a soltura é instantânea
  const tw = sm('_rTw', -1.1 * A * W * (moving ? 0 : 1), 7), sp = sm('_rSp', -1.1 * A * W * (moving ? 1 : 0), 7);
  ch.obj.rotation.y += tw;
  bowPose(ch, { w: W, aim: A, draw: D, yaw, twist: tw, spine: sp, nock: !!nk, dt }, ctx);
  archerLegs(ch, { k: A * W * (moving ? 0 : 1), yaw, dt });
  return true;
}
// estado do arco do jogador local para mandar aos outros
export const bowNetState = me => me && me.root && me.root.userData.bowState ? [+(me._aimW || 0).toFixed(2), +(me._aimA || 0).toFixed(2), +(me._draw ?? 0.1).toFixed(2), me._nockOn === false ? 0 : 1] : null;
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
