/* =========================================================================
   PRIMEIRA PESSOA DE VERDADE (P-032, etapa 1)
   Os braços da 1ª pessoa são os do PRÓPRIO herói: uma segunda cópia do corpo realista
   (mesma raça, pele, roupa da classe, luvas e a arma de verdade na mão), presa à câmera,
   da qual só os braços aparecem. As mãos vão para o lugar certo da tela por IK de dois ossos
   (ombro → cotovelo → punho), o punho gira para a arma ficar bem apresentada e os dedos
   fecham no cabo (ou ficam abertos e vivos, para quem conjura).
   Tudo é calculado a cada quadro a partir da pose de repouso: nada acumula.
   ========================================================================= */
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const smooth = k => k * k * (3 - 2 * k);

// poses de cada tipo de arma, em metros no espaço da câmera (x direita, y cima, z para trás; olhar = -z)
// mão: onde fica o punho · dir: para onde aponta a arma (eixo da lâmina/cabo) · fwd: para onde vão os nós dos dedos
const POSES = {
  // mão direita (r), eixo da arma (rDir), nós dos dedos (rFwd) e mão esquerda (l); ~15° abaixo do centro, como no Skyrim
  swing:   { r: V(0.16, -0.15, -0.44), rDir: V(-0.12, 0.78, -0.62), rFwd: V(-0.25, 0.15, -1), l: V(-0.19, -0.17, -0.42), lOpen: 0.35 },
  heavy:   { r: V(0.11, -0.15, -0.42), rDir: V(-0.30, 0.85, -0.45), rFwd: V(-0.3, 0.1, -1), l: V(0.03, -0.20, -0.40), lGrip: true },     // duas mãos no cabo
  dagger:  { r: V(0.16, -0.13, -0.42), rDir: V(0.15, 0.55, -0.85), rFwd: V(-0.2, 0.2, -1), l: V(-0.17, -0.15, -0.42), lFist: true },
  shield:  { r: V(0.16, -0.15, -0.44), rDir: V(-0.12, 0.78, -0.62), rFwd: V(-0.25, 0.15, -1), l: V(-0.17, -0.27, -0.38), lShield: true },
  bow:     { r: V(0.17, -0.18, -0.40), rDir: null, rFwd: V(-0.2, 0.1, -1), rPalm: V(-0.6, -1, 0), rOpen: 0.55, l: V(-0.13, -0.13, -0.50), lBow: true },
  magic:   { r: V(0.23, -0.15, -0.50), rDir: null, rFwd: V(-0.1, 0.35, -1), rPalm: V(-0.35, 0.8, 0), rOpen: 0.25, l: V(-0.24, -0.16, -0.50), lOpen: 0.3, lPalm: 'up' },
  staff:   { r: V(0.21, -0.17, -0.50), rDir: V(-0.05, 0.98, -0.15), rFwd: V(-0.3, 0.1, -1), l: V(-0.24, -0.17, -0.50), lOpen: 0.25, lPalm: 'up' },
  fist:    { r: V(0.16, -0.13, -0.42), rDir: null, rFwd: V(-0.15, 0.25, -1), rFist: true, l: V(-0.16, -0.14, -0.42), lFist: true },
};

export function makeFirstPerson(ch, { kind = 'swing', items = {} } = {}) {
  const root = ch.obj; root.name = 'fp_view';
  const B = {}; ch.root.traverse(o => { if (o.isBone) B[o.name] = o; });
  // fora de cena só os braços: cabeça, cabelo, pernas e tronco somem (a câmera está dentro da cabeça)
  // arco: na 1ª pessoa ele está sempre na mão esquerda (fora dela vai nas costas)
  if (ch.root.userData.bowState) ch.root.userData.bowState('hand');
  // do corpo só ficam os BRAÇOS: em cada malha com esqueleto guardamos só os triângulos que se movem com ombro→dedos
  // (vale para qualquer roupa: no corpo feminino braços e pernas vêm numa malha só, e a pele das mãos fica no corpo base)
  const ARM = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/;
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = false; o.frustumCulled = false; o.renderOrder = 10;
    if (o.isSkinnedMesh) {
      if (/Hair|Eyebrow|Eyes|Beard/i.test(o.name)) { o.visible = false; return; }
      const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones; if (!si || !sw) { o.visible = false; return; }
      const armW = new Float32Array(si.count); for (let v = 0; v < si.count; v++) { let w = 0; for (let k = 0; k < 4; k++) { const b = bones[si.getComponent(v, k)]; if (b && ARM.test(b.name)) w += sw.getComponent(v, k); } armW[v] = w; }
      const src = g.index ? g.index.array : Array.from({ length: si.count }, (_, i) => i), keep = [];
      for (let t = 0; t < src.length; t += 3) { const a0 = src[t], a1 = src[t + 1], a2 = src[t + 2]; if (armW[a0] > 0.5 && armW[a1] > 0.5 && armW[a2] > 0.5) keep.push(a0, a1, a2); }
      if (!keep.length) { o.visible = false; return; }
      const ng = g.clone(); ng.setIndex(keep); o.geometry = ng; // cópia: a geometria original é compartilhada com os outros personagens
    } else { // peças presas a ossos (ombreira, capa, chapéu): só as dos braços e o que está nas mãos
      let p = o.parent; while (p && !p.isBone) p = p.parent; if (!p || !ARM.test(p.name)) o.visible = false;
    }
  });
  // tronco e pescoço encolhem dentro do peito: só ficam os braços a partir do ombro (mangas e luvas da roupa)
  const hideBones = ['neck_01', 'Head', 'thigh_l', 'thigh_r'];
  // a base é a pose de LIGAÇÃO do esqueleto (o makeHero já vem na pose parada, com o tronco torcido: os ombros saíam tortos)
  { let sk = null; ch.root.traverse(o => { if (!sk && o.isSkinnedMesh) sk = o.skeleton; }); if (sk) sk.pose(); }
  // pose de repouso guardada (tudo volta a ela a cada quadro)
  const rest = new Map(); for (const b of Object.values(B)) rest.set(b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() });
  const resetPose = () => { for (const [b, r] of rest) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); } for (const n of hideBones) if (B[n]) B[n].scale.setScalar(0.001); };

  // olhos do herói ficam na câmera: medimos a cabeça e o ombro na pose de repouso, já virado para -z
  root.rotation.set(0, Math.PI, 0); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  resetPose(); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), loc = b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  // os OMBROS ficam onde estariam num corpo de verdade: 21 cm abaixo dos olhos e 6 cm atrás deles
  const sh = loc(B.upperarm_l).add(loc(B.upperarm_r)).multiplyScalar(0.5).applyAxisAngle(V(0, 1, 0), Math.PI);
  const base = V(-sh.x, -0.21 - sh.y, 0.06 - sh.z); root.position.copy(base);

  // eixos de cada mão no espaço do osso: "fwd" = punho → nós dos dedos, "palm" = normal da palma, "rad" = lado do polegar
  const handAxes = side => { const h = B['hand_' + side], m = B['middle_01_' + side], t = B['thumb_01_' + side], ix = B['index_01_' + side], pk = B['pinky_01_' + side];
    const fwd = m.position.clone().normalize(), rad = ix.position.clone().sub(pk.position).normalize(); rad.sub(fwd.clone().multiplyScalar(rad.dot(fwd))).normalize();
    let palm = new THREE.Vector3().crossVectors(fwd, rad).normalize(); if (palm.dot(t.position) < 0) palm.negate(); if (side === 'l') palm.negate(); // pelo polegar acerta a mão direita; na esquerda (espelhada) o polegar fica de lado e engana — conferido fechando o punho
    return { fwd, rad, palm }; };
  const AX = { r: handAxes('r'), l: handAxes('l') };
  // eixo de curvatura dos dedos (no espaço de cada falange, medido no repouso): dobra a ponta do dedo para a palma
  const curlAxis = new Map();
  const prep = side => { root.updateMatrixWorld(true); const hq = B['hand_' + side].getWorldQuaternion(new THREE.Quaternion()); const ax = AX[side];
    const palmW = ax.palm.clone().applyQuaternion(hq), fwdW = ax.fwd.clone().applyQuaternion(hq), axisW = new THREE.Vector3().crossVectors(fwdW, palmW).normalize(); // gira fwd → palma
    for (const f of [...FINGERS, 'thumb']) for (let k = 1; k <= 3; k++) { const b = B[`${f}_0${k}_${side}`]; if (!b) continue; const bq = b.getWorldQuaternion(new THREE.Quaternion()).invert();
      let a = axisW.clone(); if (f === 'thumb') a = palmW.clone().add(fwdW.clone().multiplyScalar(0.4)).normalize().cross(axisW).normalize().negate().lerp(axisW, 0.5).normalize(); curlAxis.set(b, a.applyQuaternion(bq).normalize()); } };
  prep('r'); prep('l');

  // eixo da arma no espaço da mão (a lâmina/cabo corre no eixo y da peça)
  const weapons = { r: [], l: [] }; for (const [name, it] of Object.entries(items)) { let p = it.parent, side = null; while (p) { if (p === B.hand_r) { side = 'r'; break; } if (p === B.hand_l) { side = 'l'; break; } p = p.parent; } if (side) weapons[side].push({ name, it }); }
  const weaponAxis = side => { const w = weapons[side][0]; if (!w) return null; root.updateMatrixWorld(true); const hq = B['hand_' + side].getWorldQuaternion(new THREE.Quaternion()).invert(); return V(0, 1, 0).applyQuaternion(w.it.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(hq).normalize(); };
  const WAX = { r: weaponAxis('r'), l: weaponAxis('l') };
  // escudo: preso no ANTEBRAÇO; a frente dele é o eixo mais fino da peça (medido no espaço do antebraço)
  let shieldN = null; const shield = items.shield; if (shield) { root.updateMatrixWorld(true); const bb = new THREE.Box3(), mi = new THREE.Matrix4().copy(B.lowerarm_l.matrixWorld).invert();
    shield.updateMatrixWorld(true); shield.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(mi, o.matrixWorld))); } });
    const sz = bb.getSize(new THREE.Vector3()), c0 = bb.getCenter(new THREE.Vector3()), n = sz.x < sz.y && sz.x < sz.z ? V(1, 0, 0) : sz.y < sz.z ? V(0, 1, 0) : V(0, 0, 1);
    const axis = B.hand_l.position.clone().normalize(); if (c0.clone().sub(axis.clone().multiplyScalar(c0.dot(axis))).dot(n) < 0) n.negate(); shieldN = n; } // aponta para o lado de fora (onde está a face)
  const twistBone = (bone, localN, wantW) => { // gira o osso em volta do próprio eixo para a normal localN olhar o mais perto possível de wantW
    const child = bone.children.find(c => c.isBone); if (!child) return; const bw = bone.getWorldQuaternion(new THREE.Quaternion()), ax = wp(child).sub(wp(bone)).normalize();
    const n = localN.clone().applyQuaternion(bw), a = n.sub(ax.clone().multiplyScalar(n.dot(ax))).normalize(), b = wantW.clone().sub(ax.clone().multiplyScalar(wantW.dot(ax))).normalize();
    let ang = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))); if (new THREE.Vector3().crossVectors(a, b).dot(ax) < 0) ang = -ang;
    const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion()); bone.quaternion.copy(pw.invert().multiply(new THREE.Quaternion().setFromAxisAngle(ax, ang).multiply(bw))); bone.updateMatrixWorld(true); };

  // ----- IK de dois ossos em espaço de mundo -----
  const wp = b => b.getWorldPosition(new THREE.Vector3());
  const aimBone = (bone, from, to) => { // gira o osso (no mundo) para que a direção atual from→filho vire from→to
    const child = bone.children.find(c => c.isBone); if (!child) return; const cur = wp(child).sub(from).normalize(), want = to.clone().sub(from).normalize();
    _q.setFromUnitVectors(cur, want); const bw = bone.getWorldQuaternion(new THREE.Quaternion()), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pw.invert().multiply(_q.multiply(bw))); bone.updateMatrixWorld(true); };
  const solveArm = (side, target, pole) => {
    const ua = B['upperarm_' + side], la = B['lowerarm_' + side], hd = B['hand_' + side];
    const S0 = wp(ua), E0 = wp(la), W0 = wp(hd), a = S0.distanceTo(E0), b = E0.distanceTo(W0);
    const d = Math.min(target.distanceTo(S0), (a + b) * 0.999), dir = target.clone().sub(S0).normalize();
    const T = S0.clone().addScaledVector(dir, d), x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const pv = pole.clone().sub(S0); pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
    const E = S0.clone().addScaledVector(dir, x).addScaledVector(pv, h);
    aimBone(ua, S0, E); aimBone(la, wp(la), T);
  };
  const orientHand = (side, axisLocal, wantAxis, secLocal, wantSec) => { // gira a mão no mundo: axisLocal → wantAxis e (o mais perto possível) secLocal → wantSec
    const hd = B['hand_' + side];
    const A = wantAxis.clone().normalize(), Fw = wantSec.clone().sub(A.clone().multiplyScalar(wantSec.dot(A))).normalize(), Cw = new THREE.Vector3().crossVectors(A, Fw);
    const a = axisLocal.clone().normalize(), f = secLocal.clone().sub(a.clone().multiplyScalar(secLocal.dot(a))).normalize(), c = new THREE.Vector3().crossVectors(a, f);
    const Mw = new THREE.Matrix4().makeBasis(A, Fw, Cw), Ml = new THREE.Matrix4().makeBasis(a, f, c), Q = new THREE.Quaternion().setFromRotationMatrix(Mw.multiply(Ml.transpose()));
    const pw = hd.parent.getWorldQuaternion(new THREE.Quaternion()); hd.quaternion.copy(pw.invert().multiply(Q)); hd.updateMatrixWorld(true);
    // torção dividida com o antebraço (sem "embrulho de bala" no punho)
  };
  const SG = { r: 1, l: 1 };
  const curl = (side, amt, thumb = amt, spread = 0) => { amt *= SG[side]; thumb *= SG[side];
    FINGERS.forEach((f, i) => { for (let k = 1; k <= 3; k++) { const b = B[`${f}_0${k}_${side}`]; if (!b) continue; const ang = amt * (k === 1 ? 1.25 : k === 2 ? 1.55 : 1.0) * (1 + i * 0.06);
      b.quaternion.multiply(_q2.setFromAxisAngle(curlAxis.get(b), ang)); } });
    for (let k = 1; k <= 3; k++) { const b = B[`thumb_0${k}_${side}`]; if (b) b.quaternion.multiply(_q2.setFromAxisAngle(curlAxis.get(b), thumb * (k === 1 ? 0.5 : 0.9))); }
  };

  let T = 0, atk = -9, atkKind = 'swing', breathe = 0;
  const api = {
    root, kind, B, SG,
    attack(k) { atk = T; atkKind = k || kind; },
    update(dt, { cam, speed = 0, sprint = false, camQuat }) {
      T += dt; breathe += dt;
      resetPose();
      // balanço: respiração parada, passada ao andar, mais forte correndo
      const w = Math.min(1, speed / 3.2), bobX = Math.cos(T * 4.6) * 0.011 * w, bobY = -Math.abs(Math.sin(T * 4.6)) * 0.014 * w + Math.sin(breathe * 1.5) * 0.004;
      root.position.set(base.x + bobX, base.y + bobY - (sprint ? 0.03 : 0), base.z + (sprint ? 0.02 : 0));
      root.updateMatrixWorld(true);
      const P = POSES[kind] || POSES.swing, toW = v => v.clone().applyMatrix4(cam.matrixWorld), dirW = v => v.clone().normalize().transformDirection(cam.matrixWorld);
      // golpe (etapa 1: um arco simples de cima para baixo cruzando a tela; a etapa 2 traz os golpes de cada arma)
      const k = (T - atk) / 0.42, s = k >= 0 && k < 1 ? k : null;
      let rPos = P.r.clone(), rDir = P.rDir && P.rDir.clone(), rFwd = P.rFwd.clone(), lPos = P.l.clone();
      if (s !== null) {
        if (kind === 'magic' || kind === 'staff') { const e = Math.sin(s * Math.PI); rPos.add(V(-0.05 * e, 0.06 * e, -0.16 * e)); rFwd = rFwd.lerp(V(0, 0.1, -1), e); }
        else if (kind === 'bow') { const e = s < 0.7 ? smooth(s / 0.7) : 1 - (s - 0.7) / 0.3; rPos.add(V(0.04 * e, 0.02 * e, 0.12 * e)); }
        else if (kind === 'fist') { const e = Math.sin(s * Math.PI); rPos.add(V(-0.08 * e, 0.04 * e, -0.22 * e)); }
        else { const wind = s < 0.3 ? smooth(s / 0.3) : 1 - smooth(Math.min(1, (s - 0.3) / 0.25)), cut = s < 0.3 ? 0 : s < 0.6 ? smooth((s - 0.3) / 0.3) : 1 - smooth((s - 0.6) / 0.4);
          rPos.add(V(0.06 * wind - 0.26 * cut, 0.16 * wind - 0.08 * cut, 0.04 * wind - 0.12 * cut));
          if (rDir) rDir = rDir.lerp(V(0.3, 0.6, 0.6), wind * 0.6).lerp(V(-0.9, -0.15, -0.5), cut * 0.85); }
      }
      solveArm('r', toW(rPos), toW(rPos.clone().add(V(0.35, -0.4, 0.15))));
      if (rDir && WAX.r) orientHand('r', WAX.r, dirW(rDir), AX.r.fwd, dirW(rFwd));
      else orientHand('r', AX.r.fwd, dirW(rFwd), AX.r.palm, dirW(P.rPalm || V(-0.4, -1, 0))); // sem arma: nós dos dedos para a frente, palma para baixo/dentro
      solveArm('l', toW(lPos), toW(lPos.clone().add(P.lShield ? V(-0.6, -0.25, 0.1) : V(-0.35, -0.4, 0.15))));
      if (P.lShield && shieldN) twistBone(B.lowerarm_l, shieldN, dirW(V(0.1, 0.05, -1))); // a face do escudo para a frente
      if (P.lGrip === true) orientHand('l', AX.l.fwd, dirW(V(0.3, 0.2, -1)), AX.l.palm, dirW(V(0.5, -1, 0)));
      else if (WAX.l) orientHand('l', WAX.l, dirW(P.lBow ? V(0.42, 1, -0.1) : V(-0.05, 0.95, -0.3)), AX.l.fwd, dirW(P.lBow ? V(0.25, 0, -1) : V(0.3, 0.1, -1)));
      else if (P.lPalm === 'up') orientHand('l', AX.l.fwd, dirW(V(0.25, 0.25, -1)), AX.l.palm, dirW(api.palmUpL || V(0.35, 0.8, 0)));
      else orientHand('l', AX.l.fwd, dirW(V(0.2, 0.1, -1)), AX.l.palm, dirW(V(0.5, -1, 0)));
      // dedos: fechados no cabo / punho cerrado / abertos e vivos para a magia
      const live = Math.sin(T * 1.7) * 0.05;
      curl('r', P.rOpen !== undefined ? P.rOpen + live : P.rFist ? 1.05 : 0.95, P.rOpen !== undefined ? 0.15 : 0.8);
      curl('l', P.lOpen !== undefined ? P.lOpen - live : (P.lFist || P.lGrip) ? 1.0 : 0.45, P.lOpen !== undefined ? 0.15 : 0.7);
    },
  };
  resetPose();
  return api;
}
