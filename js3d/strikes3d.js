/* P-014 + P-011 — GOLPES SOB MEDIDA e IMPACTO
   Golpes: em vez dos clipes do pacote (Sword_Attack girava o tronco; socos viravam estocadas), cada arma tem 2–3 golpes
   descritos como trajetória da(s) mão(s) + giro/inclinação do tronco, em coordenadas do CORPO (relativas ao ombro, em
   "comprimentos de braço", então valem para humano, elfo e anão). Tudo é aplicado DEPOIS do mixer (IK de 2 ossos nos braços,
   rotação do tronco em volta de eixos do corpo); o humans3d.update devolve os ossos à pose pura antes de cada quadro, então
   nada acumula. As pernas ficam com a animação de base (em pé ou correndo) — nada de "sapo" nem meia-volta.
   Corpo: +z = frente, +y = cima, +x = ESQUERDA do personagem (−x = direita).
   Formato de um golpe: { dur, hit, keys: [{ t, r:[x,y,z] mão direita, l:[...] mão esquerda, yaw, lean, rp/lp: polo do cotovelo }] }
   — r/l ausentes = aquele braço fica com a pose da animação; two: true = mão esquerda segue a direita no cabo.
   Impacto: micro-pausa, recuo e piscada do alvo, partículas pelo material do alvo, tremida de câmera só em críticos/pesados. */
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _ax = new THREE.Vector3();
function setWorldQuat(b, wq) { b.parent.updateWorldMatrix(true, false); b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq)); b.updateWorldMatrix(false, true); }
function rotBoneTo(b, from, to) { _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize()); b.getWorldQuaternion(_q2); _q2.premultiply(_q); setWorldQuat(b, _q2.clone()); }
function ik2(a, b, c, T, pole, w) { // IK de 2 ossos (ombro → cotovelo → punho), cotovelo para o polo; w mistura com a pose atual
  if (w <= 0.001) return;
  a.getWorldPosition(_a); b.getWorldPosition(_b); c.getWorldPosition(_c);
  const tgt = _c.clone().lerp(T, w), l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c), d = Math.min(l1 + l2 - 1e-3, Math.max(0.05, _a.distanceTo(tgt)));
  const u = tgt.clone().sub(_a).normalize(), pw = pole.clone().sub(_a); pw.sub(u.clone().multiplyScalar(pw.dot(u))); if (pw.lengthSq() < 1e-8) return; pw.normalize();
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), B2 = _a.clone().add(u.clone().multiplyScalar(l1 * cosA)).add(pw.multiplyScalar(l1 * Math.sqrt(1 - cosA * cosA)));
  rotBoneTo(a, _b.clone().sub(_a), B2.clone().sub(_a));
  b.getWorldPosition(_b); c.getWorldPosition(_c); rotBoneTo(b, _c.clone().sub(_b), tgt.clone().sub(_b));
}
function rotAround(b, axWorld, ang) { if (!b || Math.abs(ang) < 1e-4) return; b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(_qb); _q2.setFromAxisAngle(axWorld, ang); b.quaternion.premultiply(_qb.clone().invert().multiply(_q2).multiply(_qb)); b.updateWorldMatrix(false, true); }

// eixo comprido da arma presa na mão (no espaço do osso da mão), achado uma vez: do punho até a ponta mais distante
function bladeAxis(ch, hand) {
  const key = '_bax_' + hand.name; if (ch[key] !== undefined) return ch[key];
  let best = null, bestD = 0.18; hand.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(hand.matrixWorld).invert(), v = new THREE.Vector3();
  hand.traverse(o => { if (o === hand || !o.isMesh || o.isSkinnedMesh || !o.geometry) return; const P = o.geometry.attributes.position; if (!P) return; const step = Math.max(1, (P.count / 300) | 0);
    for (let i = 0; i < P.count; i += step) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); const d = v.length(); if (d > bestD) { bestD = d; best = v.clone(); } } });
  return (ch[key] = best ? best.normalize() : null);
}
function aimBlade(ch, hand, dirW, w) { // gira a mão para a lâmina apontar na direção pedida (mistura w)
  const ax = bladeAxis(ch, hand); if (!ax || w <= 0.001) return;
  hand.updateWorldMatrix(true, false); hand.getWorldQuaternion(_q2); const cur = ax.clone().applyQuaternion(_q2), want = cur.clone().lerp(dirW.clone().normalize(), w).normalize();
  _q.setFromUnitVectors(cur, want); _q2.premultiply(_q); setWorldQuat(hand, _q2.clone());
}
/* ---------------- os golpes (mão direita = −x; esquerda = +x; valores em comprimentos de braço a partir do ombro) ----------------
   S-362/S-363/S-367: golpes de CORPO INTEIRO (Skyrim/WoW). Além das mãos e do tronco, cada chave pode ter:
     hip  = giro do quadril (o tronco vai junto; os pés ficam plantados por IK das pernas),
     dip  = quanto o corpo baixa (fração da perna; os joelhos dobram),
     step = passo do pé da frente (fração da perna; sf: 'l' esquerdo / 'r' direito) com o quadril indo junto (peso para a frente).
   O ombro (clavícula) sobe/avança com a mão, a cabeça segura o olhar no alvo, a mão livre/escudo faz o contrapeso.
   As chaves são ligadas por curva (Catmull-Rom): o golpe atravessa a chave do impacto sem "parar" em cada pose. */
const G0 = [-0.12, -0.66, 0.5], L0 = [0.3, -0.55, 0.36];         // guarda de espada de uma mão; mão livre baixa à frente
const S0 = [-0.2, -0.66, 0.42], SH0 = [0.34, -0.36, 0.5];        // Paladino: espada e ESCUDO à frente do corpo
const P0 = [-0.1, -0.8, 0.42];                                    // Cavaleiro: espada longa nas duas mãos
const D0 = [-0.14, -0.62, 0.5], DL = [0.26, -0.5, 0.52];          // ladino: adaga baixa, mão livre à frente
const swordSet = (g, lg, sh) => [ // sh = escudo no braço esquerdo (protege na preparação, recolhe para o lado no golpe)
  { dur: 0.8, hit: 0.53, sf: 'l', keys: [ // talho diagonal: de cima do ombro direito até embaixo à esquerda, passo com o pé esquerdo
    { t: 0, r: g, l: lg },
    { t: 0.36, r: [-0.5, 0.74, -0.14], l: sh ? [0.26, -0.18, 0.66] : [0.42, -0.22, 0.55], yaw: -0.42, hip: -0.24, lean: -0.08, dip: 0.02, rp: [-0.5, 0.6, -0.6], rb: [0.2, 0.6, -0.78] },
    { t: 0.46, r: [-0.28, 0.3, 0.74], l: sh ? [0.6, -0.4, 0.2] : [0.5, -0.36, 0.25], yaw: 0.0, hip: 0.02, lean: 0.1, dip: 0.05, step: 0.16, rb: [-0.2, 0.78, 0.6] }, // o braço vai À FRENTE do rosto, não rente a ele
    { t: 0.55, r: [0.28, -0.42, 0.9], l: sh ? [0.74, -0.5, -0.06] : [0.56, -0.46, 0.04], yaw: 0.4, hip: 0.28, lean: 0.26, dip: 0.08, step: 0.3, rb: [0.6, -0.5, 0.62] },
    { t: 0.76, r: [0.54, -0.84, 0.36], l: sh ? [0.74, -0.52, -0.08] : [0.56, -0.5, 0.0], yaw: 0.46, hip: 0.32, lean: 0.22, dip: 0.09, step: 0.3, rb: [0.5, -0.86, 0.1] },
    { t: 1, r: g, l: lg }] },
  { dur: 0.76, hit: 0.53, sf: 'l', keys: [ // talho horizontal da direita para a esquerda, quadril puxando
    { t: 0, r: g, l: lg },
    { t: 0.34, r: [-0.92, -0.02, -0.1], l: sh ? [0.28, -0.22, 0.64] : [0.46, -0.26, 0.5], yaw: -0.5, hip: -0.28, dip: 0.03, rp: [-0.3, -0.7, -0.5], rb: [-0.5, 0.12, -0.85] },
    { t: 0.55, r: [-0.02, -0.12, 1.0], l: sh ? [0.74, -0.5, -0.06] : [0.6, -0.42, 0.0], yaw: 0.14, hip: 0.14, lean: 0.16, dip: 0.07, step: 0.26, rb: [0.92, 0.0, 0.38] },
    { t: 0.78, r: [0.72, -0.2, 0.45], l: sh ? [0.74, -0.52, -0.08] : [0.62, -0.46, -0.04], yaw: 0.52, hip: 0.34, lean: 0.12, dip: 0.08, step: 0.26, rb: [0.8, -0.12, -0.55] },
    { t: 1, r: g, l: lg }] },
  { dur: 0.66, hit: 0.5, lunge: 0.3, sf: 'r', keys: [ // estocada com avanço do pé direito, ombro e quadril empurrando
    { t: 0, r: g, l: lg },
    { t: 0.32, r: [-0.42, -0.36, -0.06], l: sh ? [0.3, -0.26, 0.6] : [0.36, -0.3, 0.5], yaw: -0.36, hip: -0.26, lean: -0.06, dip: 0.04, rp: [-0.6, -0.4, -0.6], rb: [0.08, 0.1, 1] },
    { t: 0.52, r: [-0.05, -0.2, 1.04], l: sh ? [0.6, -0.42, 0.1] : [0.56, -0.5, -0.1], yaw: 0.26, hip: 0.26, lean: 0.32, dip: 0.11, step: 0.38, rb: [0.05, 0.02, 1] },
    { t: 0.72, r: [-0.06, -0.24, 0.96], l: sh ? [0.6, -0.42, 0.12] : [0.56, -0.5, -0.08], yaw: 0.22, hip: 0.24, lean: 0.28, dip: 0.11, step: 0.38 },
    { t: 1, r: g, l: lg }] },
];
export const STRIKES = {
  espada: swordSet(G0, L0, false),
  pesada: [ // Cavaleiro: golpe por cima (duas mãos) e varredura — o corpo todo desce no golpe
    { dur: 0.95, hit: 0.57, two: true, lunge: 0.35, heavy: true, sf: 'l', keys: [
      { t: 0, r: P0 },
      { t: 0.38, r: [-0.42, 0.66, -0.02], yaw: -0.26, hip: -0.18, lean: -0.12, dip: 0.02, rp: [-0.8, 0.1, -0.4], rb: [-0.15, 0.5, -0.85] }, // S-363: espada sobre o ombro direito (as mãos não passam por cima/dentro da cabeça)
      { t: 0.5, r: [-0.2, 0.35, 0.78], yaw: -0.02, hip: 0.0, lean: 0.12, dip: 0.06, step: 0.18, rb: [-0.05, 0.85, 0.5] },
      { t: 0.6, r: [0.0, -0.42, 0.95], yaw: 0.08, hip: 0.1, lean: 0.36, dip: 0.13, step: 0.3, rb: [0.05, -0.55, 0.85] },
      { t: 0.8, r: [0.06, -0.78, 0.72], yaw: 0.05, hip: 0.08, lean: 0.3, dip: 0.13, step: 0.3, rb: [0.05, -0.95, 0.25] },
      { t: 1, r: P0 }] },
    { dur: 0.9, hit: 0.56, two: true, heavy: true, sf: 'l', keys: [
      { t: 0, r: P0 },
      { t: 0.36, r: [-0.88, 0.12, -0.06], yaw: -0.5, hip: -0.3, lean: 0.02, dip: 0.04, rp: [-0.3, -0.6, -0.6], rb: [-0.6, 0.15, -0.75] },
      { t: 0.58, r: [0.1, -0.2, 0.98], yaw: 0.2, hip: 0.18, lean: 0.16, dip: 0.11, step: 0.26, rb: [0.9, -0.1, 0.4] },
      { t: 0.8, r: [0.74, -0.25, 0.52], yaw: 0.5, hip: 0.34, lean: 0.12, dip: 0.11, step: 0.26, rb: [0.75, -0.2, -0.55] },
      { t: 1, r: P0 }] },
  ],
  paladino: [ // S-362: espada longa de uma mão com o corpo todo + escudo; o empurrão de escudo vira o 3º golpe
    ...swordSet(S0, SH0, true).slice(0, 2).map(v => ({ ...v, dur: v.dur * 1.06 })),
    { dur: 0.66, hit: 0.5, lunge: 0.4, heavy: true, sf: 'l', keys: [
      { t: 0, r: S0, l: SH0 },
      { t: 0.32, r: [-0.3, -0.6, 0.2], l: [0.4, -0.24, 0.16], yaw: 0.26, hip: 0.18, lean: -0.06, dip: 0.05, lp: [0.8, -0.4, -0.3] },
      { t: 0.52, r: [-0.3, -0.62, 0.3], l: [0.08, -0.12, 1.0], yaw: -0.3, hip: -0.24, lean: 0.3, dip: 0.11, step: 0.34 },
      { t: 0.74, r: [-0.3, -0.62, 0.32], l: [0.1, -0.14, 0.92], yaw: -0.26, hip: -0.22, lean: 0.24, dip: 0.11, step: 0.34 },
      { t: 1, r: S0, l: SH0 }] },
  ],
  adaga: [ // S-367: ladino — o golpe nasce nas pernas: baixa, avança o pé, o quadril empurra o ombro; mão livre puxa para trás; recua rápido
    { dur: 0.52, hit: 0.46, lunge: 0.3, sf: 'r', keys: [ // estocada por baixo, na barriga
      { t: 0, r: D0, l: DL },
      { t: 0.26, r: [-0.3, -0.72, 0.06], l: [0.3, -0.3, 0.64], yaw: -0.3, hip: -0.24, lean: 0.06, dip: 0.07, rp: [-0.7, -0.5, -0.45], rb: [0.05, 0.3, 1] },
      { t: 0.46, r: [-0.02, -0.3, 1.04], l: [0.42, -0.44, 0.1], yaw: 0.3, hip: 0.28, lean: 0.3, dip: 0.13, step: 0.36, rb: [0.04, 0.18, 1] },
      { t: 0.6, r: [-0.04, -0.34, 0.96], l: [0.42, -0.44, 0.12], yaw: 0.26, hip: 0.26, lean: 0.26, dip: 0.13, step: 0.36, rb: [0.04, 0.12, 1] },
      { t: 0.8, r: [-0.2, -0.6, 0.38], l: [0.3, -0.46, 0.46], yaw: -0.04, hip: -0.04, lean: 0.1, dip: 0.08, step: 0.12 }, // recua já em guarda
      { t: 1, r: D0, l: DL }] },
    { dur: 0.5, hit: 0.5, lunge: 0.12, sf: 'l', keys: [ // corte reverso (de dentro para fora), giro curto do quadril
      { t: 0, r: D0, l: DL },
      { t: 0.28, r: [0.3, -0.16, 0.42], l: [0.44, -0.56, 0.18], yaw: 0.42, hip: 0.26, lean: 0.06, dip: 0.06, rp: [-0.35, -0.8, -0.35], rb: [0.85, 0.45, 0.25] },
      { t: 0.5, r: [-0.55, -0.45, 0.72], l: [0.3, -0.4, 0.52], yaw: -0.36, hip: -0.24, lean: 0.18, dip: 0.1, step: 0.22, rb: [-0.8, -0.35, 0.5] },
      { t: 0.72, r: [-0.7, -0.6, 0.42], l: [0.3, -0.42, 0.52], yaw: -0.42, hip: -0.28, lean: 0.14, dip: 0.1, step: 0.22, rb: [-0.7, -0.6, 0.2] },
      { t: 1, r: D0, l: DL }] },
    { dur: 0.52, hit: 0.5, lunge: 0.18, sf: 'l', keys: [ // corte diagonal por cima
      { t: 0, r: D0, l: DL },
      { t: 0.3, r: [-0.5, 0.2, 0.24], l: [0.3, -0.4, 0.62], yaw: -0.38, hip: -0.24, lean: -0.04, dip: 0.03, rp: [-0.65, 0.0, -0.7], rb: [-0.25, 0.9, 0.2] },
      { t: 0.52, r: [0.24, -0.46, 0.84], l: [0.44, -0.56, 0.14], yaw: 0.36, hip: 0.26, lean: 0.24, dip: 0.11, step: 0.28, rb: [0.7, -0.5, 0.55] },
      { t: 0.74, r: [0.32, -0.62, 0.6], l: [0.44, -0.56, 0.16], yaw: 0.32, hip: 0.24, lean: 0.2, dip: 0.11, step: 0.28, rb: [0.6, -0.7, 0.3] },
      { t: 1, r: D0, l: DL }] },
  ],
  duas: [ // katar / duas adagas: estocadas alternadas — o quadril troca de lado a cada golpe e o pé do mesmo lado avança
    { dur: 0.44, hit: 0.46, lunge: 0.24, sf: 'r', keys: [{ t: 0, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }, { t: 0.24, r: [-0.24, -0.28, 0.2], l: [0.15, -0.3, 0.62], yaw: -0.2, hip: -0.16, dip: 0.05, rp: [-0.6, -0.45, -0.5] }, { t: 0.44, r: [-0.01, -0.06, 1.08], l: [0.28, -0.38, 0.24], yaw: 0.3, hip: 0.24, lean: 0.26, dip: 0.1, step: 0.28 }, { t: 0.62, r: [-0.02, -0.08, 1.04], l: [0.28, -0.38, 0.26], yaw: 0.26, hip: 0.22, lean: 0.22, dip: 0.1, step: 0.28 }, { t: 1, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }] },
    { dur: 0.44, hit: 0.46, lunge: 0.24, sf: 'l', keys: [{ t: 0, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }, { t: 0.24, l: [0.24, -0.28, 0.2], r: [-0.15, -0.3, 0.62], yaw: 0.2, hip: 0.16, dip: 0.05, lp: [0.6, -0.45, -0.5] }, { t: 0.44, l: [0.01, -0.06, 1.08], r: [-0.28, -0.38, 0.24], yaw: -0.3, hip: -0.24, lean: 0.26, dip: 0.1, step: 0.28 }, { t: 0.62, l: [0.02, -0.08, 1.04], r: [-0.28, -0.38, 0.26], yaw: -0.26, hip: -0.22, lean: 0.22, dip: 0.1, step: 0.28 }, { t: 1, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }] },
    { dur: 0.52, hit: 0.52, sf: 'r', keys: [{ t: 0, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }, { t: 0.3, r: [-0.62, 0.05, 0.35], l: [0.62, 0.05, 0.35], lean: -0.06, dip: 0.03 }, { t: 0.55, r: [0.22, -0.3, 0.88], l: [-0.22, -0.3, 0.88], lean: 0.2, dip: 0.12, step: 0.26 }, { t: 0.75, r: [0.24, -0.34, 0.84], l: [-0.24, -0.34, 0.84], lean: 0.16, dip: 0.12, step: 0.26 }, { t: 1, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }] },
  ],
  sabre: [ // Gatuno-Mestre: corte de sabre e estocada da adaga (esquerda)
    { dur: 0.52, hit: 0.5, keys: [{ t: 0, r: [-0.25, -0.45, 0.5], l: [0.2, -0.45, 0.35] }, { t: 0.3, r: [-0.6, 0.5, 0.1], yaw: -0.32, rp: [-0.4, 0.4, -0.6], rb: [0.15, 0.75, -0.65] }, { t: 0.55, r: [0.28, -0.5, 0.78], yaw: 0.36, lean: 0.14, rb: [0.55, -0.45, 0.7] }, { t: 1, r: [-0.25, -0.45, 0.5], l: [0.2, -0.45, 0.35] }] },
    { dur: 0.46, hit: 0.48, lunge: 0.25, keys: [{ t: 0, r: [-0.25, -0.45, 0.5], l: [0.2, -0.45, 0.35] }, { t: 0.3, l: [0.28, -0.3, 0.15], r: [-0.4, -0.3, 0.3], yaw: 0.25, lp: [0.6, -0.4, -0.5] }, { t: 0.52, l: [0.04, -0.18, 1.0], r: [-0.45, -0.35, 0.25], yaw: -0.28, lean: 0.2 }, { t: 1, r: [-0.25, -0.45, 0.5], l: [0.2, -0.45, 0.35] }] },
  ],
  cajado: [ // o braço do cajado fica com o IK do holdStaff; a mão LIVRE (esquerda) conjura
    { dur: 0.6, hit: 0.55, keys: [{ t: 0, l: [0.3, -0.5, 0.4] }, { t: 0.35, l: [0.38, 0.12, 0.18], yaw: 0.12, lean: -0.04, lp: [0.6, -0.5, -0.4] }, { t: 0.55, l: [0.06, 0.02, 1.0], yaw: -0.14, lean: 0.12 }, { t: 0.78, l: [0.08, 0.0, 0.95], yaw: -0.1, lean: 0.1 }, { t: 1, l: [0.3, -0.5, 0.4] }] },
    { dur: 0.62, hit: 0.56, keys: [{ t: 0, l: [0.3, -0.5, 0.4] }, { t: 0.32, l: [0.2, 0.55, 0.25], lean: -0.08, lp: [0.7, -0.2, -0.4] }, { t: 0.56, l: [0.12, -0.15, 1.0], lean: 0.16 }, { t: 1, l: [0.3, -0.5, 0.4] }] },
  ],
  punhos: [ // sem arma: jab (esquerda) e direto (direita)
    { dur: 0.38, hit: 0.45, keys: [{ t: 0, r: [-0.15, -0.3, 0.45], l: [0.15, -0.22, 0.55] }, { t: 0.25, l: [0.16, -0.18, 0.4], yaw: 0.1 }, { t: 0.45, l: [0.04, -0.08, 1.0], yaw: -0.18, lean: 0.12 }, { t: 1, r: [-0.15, -0.3, 0.45], l: [0.15, -0.22, 0.55] }] },
    { dur: 0.44, hit: 0.48, lunge: 0.15, keys: [{ t: 0, r: [-0.15, -0.3, 0.45], l: [0.15, -0.22, 0.55] }, { t: 0.28, r: [-0.2, -0.26, 0.25], yaw: -0.22 }, { t: 0.5, r: [-0.03, -0.08, 1.0], yaw: 0.3, lean: 0.16 }, { t: 1, r: [-0.15, -0.3, 0.45], l: [0.15, -0.22, 0.55] }] },
  ],
};
// Sábio: o livro está na mão esquerda — o gesto de conjurar vem da DIREITA (espelho do cajado)
STRIKES.gesto = STRIKES.cajado.map(v => ({ ...v, keys: v.keys.map(k => ({ ...k, r: k.l ? [-k.l[0], k.l[1], k.l[2]] : undefined, l: undefined, rp: k.lp ? [-k.lp[0], k.lp[1], k.lp[2]] : undefined, lp: undefined, yaw: -(k.yaw || 0) })) }));
const POLE_R = [-0.65, -0.55, -0.35], POLE_L = [0.65, -0.55, -0.35];

/* ---------------- tocar um golpe ---------------- */
export function startStrike(ch, kind, o = {}) {
  const set = STRIKES[kind]; if (!set || !ch || !ch.root) return null;
  const n = (ch._stN = ((ch._stN ?? -1) + 1)) % set.length, def = set[o.variant ?? n];
  const dur = Math.max(0.12, Math.min(def.dur, o.delay ? o.delay * 0.95 : def.dur) / (o.speed || 1));
  const prev = ch._strike && ch._strike.t < ch._strike.dur ? sampleNow(ch._strike) : null;
  ch._strike = { def, t: 0, dur, kind, prev, w0: prev ? prev.w : 0 };
  return { hitAt: dur * def.hit, lunge: def.lunge || 0, heavy: !!def.heavy, dur };
}
export function strikeActive(ch) { return !!(ch && ch._strike && ch._strike.t < ch._strike.dur); }
const lerp3 = (a, b, k) => a && b ? [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] : (k < 0.5 ? a : b);
const ease = k => k * k * (3 - 2 * k);
const SCAL = ['yaw', 'lean', 'hip', 'dip', 'step'];
function prep(def) { // completa as chaves uma vez: mão sem chave herda a anterior (ou a próxima, no começo)
  if (def._K) return def._K;
  const K = def.keys.map(k => ({ ...k }));
  for (const side of ['r', 'l']) { let last = null; for (const k of K) { if (k[side]) last = k[side]; else k[side] = last; } let next = null; for (let i = K.length - 1; i >= 0; i--) { if (def.keys[i][side]) next = def.keys[i][side]; else if (!K[i][side]) K[i][side] = next; } }
  for (const k of K) for (const s of SCAL) k[s] = k[s] || 0;
  def._smax = Math.max(1e-3, ...K.map(k => Math.abs(k.step)));
  return (def._K = K);
}
// curva de Hermite (Catmull-Rom não uniforme): passa por todas as chaves sem parar nelas; velocidade zero só no começo e no fim
function herm(K, i, k, get) {
  const A = K[i], B = K[i + 1], a = get(A), b = get(B); if (a == null || b == null) return a ?? b;
  const dt = B.t - A.t, tan = j => { if (j <= 0 || j >= K.length - 1) return null; const p = get(K[j - 1]), q = get(K[j + 1]); return p == null || q == null ? null : [p, q, K[j + 1].t - K[j - 1].t]; };
  const ta = tan(i), tb = tan(i + 1), k2 = k * k, k3 = k2 * k, h00 = 2 * k3 - 3 * k2 + 1, h10 = k3 - 2 * k2 + k, h01 = -2 * k3 + 3 * k2, h11 = k3 - k2;
  const one = (x, y, ma, mb) => h00 * x + h10 * dt * ma + h01 * y + h11 * dt * mb;
  if (typeof a === 'number') return one(a, b, ta ? (ta[1] - ta[0]) / ta[2] * 0.8 : 0, tb ? (tb[1] - tb[0]) / tb[2] * 0.8 : 0);
  return [0, 1, 2].map(c => one(a[c], b[c], ta ? (ta[1][c] - ta[0][c]) / ta[2] * 0.8 : 0, tb ? (tb[1][c] - tb[0][c]) / tb[2] * 0.8 : 0));
}
function sampleAt(def, u) {
  const K = prep(def); let i = 0; while (i < K.length - 2 && u > K[i + 1].t) i++;
  const A = K[i], B = K[i + 1], k = Math.max(0, Math.min(1, (u - A.t) / Math.max(1e-4, B.t - A.t)));
  const s = { r: herm(K, i, k, x => x.r), l: herm(K, i, k, x => x.l), rp: lerp3(A.rp || POLE_R, B.rp || POLE_R, ease(k)), lp: lerp3(A.lp || POLE_L, B.lp || POLE_L, ease(k)),
    rbA: A.rb || null, rbB: B.rb || null, lbA: A.lb || null, lbB: B.lb || null, k: ease(k) };
  for (const n of SCAL) s[n] = herm(K, i, k, x => x[n]);
  return s;
}
function envelope(st, u) { const a = Math.min(1, u / 0.14), b = Math.min(1, (1 - u) / 0.24); const e = Math.max(0, Math.min(a, b)); return Math.max(e, st.w0 * Math.max(0, 1 - u / 0.14)); }
function sampleNow(st) { const u = Math.min(1, st.t / st.dur), s = sampleAt(st.def, u); s.w = envelope(st, u); return s; }

const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_r', 'clavicle_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
function bonesOf(ch) { if (ch._stB) return ch._stB; const B = {}; for (const n of BONES) B[n] = ch.root.getObjectByName(n); return (ch._stB = B); }
/* S-363: volume do tronco medido (roupa, armadura e barriga do anão), no espaço do corpo em volta do osso spine_02: meia-largura e frente.
   As mãos ficam por fora dele e os cotovelos/antebraços nunca entram (o braço do anão de placas atravessava a couraça). */
const _tv = new THREE.Vector3();
function torsoOf(ch, B, bq) {
  if (ch._torso) return ch._torso;
  const inv = bq.clone().invert(), c = B.spine_02.getWorldPosition(new THREE.Vector3()), xs = [], zs = [], skip = new Set();
  for (const n of ['clavicle_r', 'clavicle_l', 'neck_01']) { const b = B[n]; if (b) b.traverse(o => skip.add(o)); }
  const idx = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03'].map(n => B[n]).filter(Boolean));
  const add = v => { v.sub(c).applyQuaternion(inv); if (v.y < -0.42 || v.y > 0.22) return; if (Math.abs(v.z) < 0.1) xs.push(Math.abs(v.x)); if (Math.abs(v.x) < 0.1 && v.z > 0) zs.push(v.z); };
  ch.root.updateMatrixWorld(true);
  ch.root.traverse(o => {
    if (!o.isMesh || !o.visible || skip.has(o) || !o.geometry || !o.geometry.attributes.position) return;
    const P = o.geometry.attributes.position, step = Math.max(1, (P.count / 1500) | 0);
    if (o.isSkinnedMesh) {
      const SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight; if (!SI) return; const bi = o.skeleton.bones.map(b => idx.has(b));
      for (let i = 0; i < P.count; i += step) { let w = 0; for (let k = 0; k < 4; k++) if (bi[SI.getComponent(i, k)]) w += SW.getComponent(i, k); if (w < 0.6) continue; o.getVertexPosition(i, _tv); o.localToWorld(_tv); add(_tv); }
    } else { let p = o.parent, onBody = false; while (p) { if (idx.has(p)) { onBody = true; break; } if (skip.has(p)) break; p = p.parent; } if (!onBody) return;
      for (let i = 0; i < P.count; i += step) { _tv.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); add(_tv); } }
  });
  const q = (a, f) => { if (!a.length) return null; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, (a.length * f) | 0)]; };
  return (ch._torso = { side: q(xs, 0.95) || 0.17, front: q(zs, 0.95) || 0.14 });
}
// empurra um ponto para fora da elipse do tronco (no plano horizontal do corpo já girado); devolve true se mexeu
function outOfTorso(p, ctr, tq, T, m) {
  _tv.copy(p).sub(ctr).applyQuaternion(tq.clone().invert()); if (_tv.y < -0.5 || _tv.y > 0.3) return false;
  const ax = T.side + m, az = T.front + m, e = (_tv.x / ax) ** 2 + (_tv.z / az) ** 2; if (e >= 1) return false;
  if (_tv.z < -0.02 * az) return false; // atrás do tronco não é com a gente (ombro/costas)
  const s = 1 / Math.sqrt(Math.max(1e-6, e)); _tv.x *= s; _tv.z *= s; p.copy(_tv.applyQuaternion(tq).add(ctr)); return true;
}
/* S-363: duas mãos no cabo — o ponto do cabo tem de estar ao alcance dos DOIS braços e fora do tronco. O anão de placas (braço
   curto, barriga e couraça ~30 cm à frente da coluna) não alcança com a esquerda um cabo junto ao quadril direito: o braço
   "atravessava" o corpo. Se algum braço não alcança, o cabo desliza para a frente do peito, na altura pedida (guarda mais alta). */
function armLen(B, s) { const a = B['upperarm_' + s], b = B['lowerarm_' + s], c = B['hand_' + s]; return a.getWorldPosition(_a).distanceTo(b.getWorldPosition(_b)) + _b.distanceTo(c.getWorldPosition(_c)); }
function twoHandReach(ch, B, T, safe, bq) {
  const sL = B.upperarm_l.getWorldPosition(new THREE.Vector3()), sR = B.upperarm_r.getWorldPosition(new THREE.Vector3());
  const Ll = (ch._armL ?? (ch._armL = armLen(B, 'l'))) * 0.97, Lr = (ch._armR ?? (ch._armR = armLen(B, 'r'))) * 0.97, ok = P => P.distanceTo(sL) <= Ll && P.distanceTo(sR) <= Lr;
  if (ok(T)) return T;
  const q = safe ? safe.tq : bq, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q), mid = sL.clone().add(sR).multiplyScalar(0.5);
  const c = safe ? safe.c.clone() : mid.clone(), A = c.addScaledVector(fwd, (safe ? safe.T.front : 0.18) + 0.07).addScaledVector(right, 0.03); A.y = Math.max(mid.y - 0.3, Math.min(mid.y - 0.02, T.y)); // no máximo na altura dos ombros (as mãos não tapam o rosto)
  for (let k = 0.2; k < 1.01; k += 0.2) { const P = T.clone().lerp(A, k); if (ok(P)) return P; }
  for (let k = 0.1; k < 1.01; k += 0.1) { const P = A.clone(); P.y += (mid.y - 0.05 - A.y) * k; P.addScaledVector(fwd, -0.04 * k); if (ok(P)) return P; } // ainda longe: sobe para a altura do peito
  return A;
}
// braço por IK com folga do tronco: a mão vai por fora dele e, se o cotovelo ou o antebraço entrarem, o cotovelo abre para o lado
function armSafe(ua, la, ha, T, pole, w, safe) {
  const q0 = [ua.quaternion.clone(), la.quaternion.clone(), ha.quaternion.clone()];
  if (safe) outOfTorso(T, safe.c, safe.tq, safe.T, safe.m + 0.04);
  ik2(ua, la, ha, T, pole, w); if (!safe) return;
  const e = la.getWorldPosition(new THREE.Vector3()), h = ha.getWorldPosition(new THREE.Vector3()), mid = e.clone().lerp(h, 0.5);
  const e2 = e.clone(), m2 = mid.clone(), hitE = outOfTorso(e2, safe.c, safe.tq, safe.T, safe.m), hitM = outOfTorso(m2, safe.c, safe.tq, safe.T, safe.m);
  if (!hitE && !hitM) return;
  const sh = ua.getWorldPosition(new THREE.Vector3()), out = (hitE ? e2.sub(e) : m2.sub(mid)).normalize(), P2 = e.clone().addScaledVector(out, 0.6).addScaledVector(e.clone().sub(sh).normalize(), 0.1);
  ua.quaternion.copy(q0[0]); la.quaternion.copy(q0[1]); ha.quaternion.copy(q0[2]); ua.updateWorldMatrix(false, true);
  ik2(ua, la, ha, T, P2, w);
}
// quadril, passo e joelhos: gira/baixa/avança a pélvis e devolve os pés ao chão por IK (o pé do passo vai à frente com um arco)
function bodyMove(ch, B, bq, hip, dip, step, def) {
  if (!B.pelvis || !B.thigh_l || !B.thigh_r || !B.calf_l || !B.calf_r || !B.foot_l || !B.foot_r) return;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bq), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(bq), side = new THREE.Vector3(1, 0, 0).applyQuaternion(bq);
  const legs = [[B.thigh_l, B.calf_l, B.foot_l, 1], [B.thigh_r, B.calf_r, B.foot_r, -1]];
  const feet = legs.map(([, , f]) => ({ p: f.getWorldPosition(new THREE.Vector3()), q: f.getWorldQuaternion(new THREE.Quaternion()) }));
  const L = ch._legL || (ch._legL = B.thigh_l.getWorldPosition(_a).distanceTo(B.calf_l.getWorldPosition(_b)) + _b.distanceTo(B.foot_l.getWorldPosition(_c)));
  rotAround(B.pelvis, up, hip);
  B.pelvis.parent.updateWorldMatrix(true, false);
  const pp = B.pelvis.getWorldPosition(new THREE.Vector3()).addScaledVector(up, -dip * L).addScaledVector(fwd, step * 0.42 * L);
  B.pelvis.position.copy(B.pelvis.parent.worldToLocal(pp)); B.pelvis.updateWorldMatrix(false, true);
  const sf = def.sf === 'r' ? 1 : 0, k = Math.min(1, Math.abs(step) / (def._smax || 1));
  legs.forEach(([t, c, f, sg], i) => {
    const T = feet[i].p.clone();
    if (i === sf && Math.abs(step) > 1e-4) T.addScaledVector(fwd, step * L * 0.85).addScaledVector(up, Math.sin(Math.PI * k) * 0.08 * L);
    const P = t.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, L).addScaledVector(side, sg * 0.18 * L);
    ik2(t, c, f, T, P, 1); setWorldQuat(f, feet[i].q);
  });
}
/* aplica o golpe no quadro (depois do mixer e da postura da classe). opts.skipR / skipL: braço ocupado por outro IK (cajado, arco).
   opts.still (0..1): parado = 1; correndo, o passo e o agachamento somem (as pernas são da corrida). */
export function updateStrike(ch, dt, opts = {}) {
  const st = ch && ch._strike; if (!st) return false;
  st.t += dt; if (st.t >= st.dur) { ch._strike = null; return false; }
  const u = st.t / st.dur; let s = sampleAt(st.def, u); const w = envelope(st, u);
  if (st.prev && u < 0.14) { const k = ease(u / 0.14); s = { ...s, r: s.r && st.prev.r ? lerp3(st.prev.r, s.r, k) : s.r, l: s.l && st.prev.l ? lerp3(st.prev.l, s.l, k) : s.l }; for (const n of SCAL) s[n] = (st.prev[n] || 0) + (s[n] - (st.prev[n] || 0)) * k; }
  const B = bonesOf(ch), body = ch.obj || ch.root; if (!B.spine_01) return false;
  body.updateWorldMatrix(true, true); body.getWorldQuaternion(_qb); const bq = _qb.clone();
  const T0 = B.spine_02 ? torsoOf(ch, B, bq) : null;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bq), side = new THREE.Vector3(1, 0, 0).applyQuaternion(bq), fwdAx = new THREE.Vector3(0, 0, 1).applyQuaternion(bq);
  const still = opts.still ?? 1, yaw = s.yaw * w, lean = s.lean * w, hip = s.hip * w;
  // pernas e quadril (o golpe nasce do chão): giro do quadril, peso baixando e o passo
  if (Math.abs(hip) > 1e-3 || s.dip * w * still > 1e-3 || Math.abs(s.step) * w * still > 1e-3) bodyMove(ch, B, bq, hip * (0.4 + 0.6 * still), s.dip * w * still, s.step * w * still, st.def);
  // tronco: giro (em volta do "para cima" do corpo) e inclinação para a frente, espalhados pela coluna
  rotAround(B.spine_01, up, yaw * 0.45); rotAround(B.spine_02, up, yaw * 0.35); rotAround(B.spine_03, up, yaw * 0.2);
  rotAround(B.spine_01, side, lean * 0.55); rotAround(B.spine_02, side, lean * 0.45);
  // a cabeça segura o olhar no alvo (desfaz parte do giro do tronco e do quadril)
  const turn = yaw + hip * (0.4 + 0.6 * still); if (B.neck_01) rotAround(B.neck_01, up, -turn * 0.3); if (B.Head) rotAround(B.Head, up, -turn * 0.35);
  if (B.Head) rotAround(B.Head, side, -lean * 0.4);
  const toW = v => new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(bq);
  let rOff = s.r, lOff = s.l;
  if (st.def.two && rOff) lOff = null; // duas mãos no cabo: a esquerda vai até a direita (feito abaixo)
  // ombro (clavícula) acompanha a mão: sobe quando ela sobe, avança quando ela vai à frente, recua na preparação
  const shoulder = (cl, off, sg) => { if (!cl || !off) return; const raise = Math.max(0, Math.min(1, off[1] + 0.25)) * 0.3 * w, prot = Math.max(-0.5, Math.min(0.6, off[2] - 0.45)) * 0.42 * w; rotAround(cl, fwdAx, -sg * raise); rotAround(cl, up, sg * prot); };
  if (!opts.skipR) shoulder(B.clavicle_r, rOff, 1);
  if (!opts.skipL && lOff) shoulder(B.clavicle_l, lOff, -1);
  // folga do tronco (no corpo já girado)
  let safe = null;
  if (T0 && B.spine_02) { B.spine_02.updateWorldMatrix(true, false); const tq = bq.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(up, turn)); safe = { c: B.spine_02.getWorldPosition(new THREE.Vector3()), tq, T: T0, m: 0.035 }; }
  // braços por IK: alvo = ombro + offset (em comprimentos de braço, no espaço do corpo)
  const arm = (ua, la, ha, off, pole) => {
    if (!ua || !la || !ha || !off) return;
    ua.getWorldPosition(_a); la.getWorldPosition(_b); ha.getWorldPosition(_c); const L = _a.distanceTo(_b) + _b.distanceTo(_c), sh = _a.clone();
    armSafe(ua, la, ha, sh.clone().add(toW(off).multiplyScalar(L)), sh.clone().add(toW(pole).multiplyScalar(L)), w, safe);
  };
  if (!opts.skipR && st.def.two && rOff && B.upperarm_l) { // duas mãos: o cabo onde os dois braços alcançam, fora do tronco
    B.upperarm_r.getWorldPosition(_a); const L = (ch._armR ?? (ch._armR = armLen(B, 'r'))), sh = _a.clone();
    if (B.clavicle_l) rotAround(B.clavicle_l, up, -0.16 * w); // o ombro esquerdo avança para chegar ao cabo
    const T = twoHandReach(ch, B, sh.clone().add(toW(rOff).multiplyScalar(L)), safe, bq);
    armSafe(B.upperarm_r, B.lowerarm_r, B.hand_r, T, sh.clone().add(toW(s.rp).multiplyScalar(L)), w, safe);
  } else if (!opts.skipR) arm(B.upperarm_r, B.lowerarm_r, B.hand_r, rOff, s.rp);
  if (st.def.two && rOff && B.hand_r && !opts.skipL) { // mão esquerda abaixo da direita, no mesmo cabo; cotovelo para fora (nunca para dentro do peito)
    B.hand_r.getWorldPosition(_c); const ax = bladeAxis(ch, B.hand_r), dir = ax ? ax.clone().applyQuaternion(B.hand_r.getWorldQuaternion(new THREE.Quaternion())) : toW([0, 1, 0]);
    const T = _c.clone().addScaledVector(dir, -0.1).add(toW([0.02, 0, 0])), P = new THREE.Vector3(); B.upperarm_l.getWorldPosition(P); P.add(toW([0.75, -0.45, 0.1]));
    armSafe(B.upperarm_l, B.lowerarm_l, B.hand_l, T, P, w * 0.95, safe ? { ...safe, m: 0.02 } : null);
  } else if (!opts.skipL) arm(B.upperarm_l, B.lowerarm_l, B.hand_l, lOff, s.lp);
  // pulso: lâmina na direção pedida pela chave (ou seguindo o antebraço, como numa estocada)
  const fore = (lo, ha) => { lo.getWorldPosition(_a); ha.getWorldPosition(_b); return _b.clone().sub(_a).normalize(); };
  const blend = (lo, ha, a, b) => { const f = fore(lo, ha), da = a ? toW(a).normalize() : f, db = b ? toW(b).normalize() : f; return da.lerp(db, s.k ?? 0).normalize(); }; // chave sem direção = segue o antebraço
  if (!opts.skipR && rOff && B.hand_r) aimBlade(ch, B.hand_r, blend(B.lowerarm_r, B.hand_r, s.rbA, s.rbB), w * 0.85);
  if (!opts.skipL && lOff && !st.def.two && B.hand_l) aimBlade(ch, B.hand_l, blend(B.lowerarm_l, B.hand_l, s.lbA, s.lbB), w * 0.85);
  return true;
}
/* S-346/S-352: GUARDA e DESCANSO das armas de lâmina, no mesmo espaço do corpo dos golpes (vale para humano, elfo e anão).
   - descanso (fora de combate): a lâmina pende para baixo e um pouco à frente, rente à perna (no clipe "Idle" ela ficava
     atravessada na horizontal, apontando para trás);
   - guarda: a mão da arma à frente do corpo, na altura do umbigo, com a ponta para a frente e para cima (Skyrim/WoW);
     o Cavaleiro empunha a espada longa com as duas mãos (guarda média firme), o ladino fica baixo com a mão livre à frente.
   Aplicado DEPOIS do mixer e da postura da classe e ANTES do golpe — o golpe parte da guarda e volta para ela. */
export const GUARDS = {
  espada: { r: [-0.12, -0.66, 0.5], rb: [0.14, 0.62, 1], rp: [-0.75, -0.55, -0.25], chest: -0.25 },
  pesada: { r: [-0.1, -0.8, 0.42], rb: [0.1, 0.6, 1], two: true, lean: -0.06, rp: [-0.8, -0.5, -0.2], chest: -0.12 },
  paladino: { r: [-0.2, -0.66, 0.42], rb: [0.1, 0.55, 1], rp: [-0.75, -0.55, -0.25], l: [0.34, -0.36, 0.5], lp: [0.8, -0.4, -0.2], chest: -0.2 }, // S-362: escudo à frente, pronto para recolher no golpe
  adaga: { r: [-0.14, -0.62, 0.5], rb: [0.18, 0.3, 1], l: [0.26, -0.5, 0.52], lb: [0.1, 0.6, 0.6], lp: [0.75, -0.55, -0.25], rp: [-0.75, -0.55, -0.3], lean: 0.08, chest: -0.3 },
  sabre: { r: [-0.14, -0.62, 0.5], rb: [0.12, 0.6, 1], l: [0.28, -0.62, 0.4], lb: [0.0, 0.2, 1], rp: [-0.75, -0.55, -0.25], lp: [0.75, -0.55, -0.25], chest: -0.3 },
};
const REST_DIR = [-0.24, -0.8, 0.55]; // ponta para baixo/à frente, levemente para fora
export function guardPose(ch, kind, o = {}) {
  const G = GUARDS[kind]; if (!G || !ch || !ch.root) return;
  const gw = Math.max(0, Math.min(1, o.guard || 0)), rw = Math.max(0, Math.min(1, o.rest || 0)) * (1 - gw);
  if (gw < 0.01 && rw < 0.01) return;
  const B = bonesOf(ch), body = ch.obj || ch.root; if (!B.spine_01 || !B.hand_r) return;
  body.updateWorldMatrix(true, true); body.getWorldQuaternion(_qb); const bq = _qb.clone(), toW = v => new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(bq);
  if (rw > 0.01) { // descanso: só o pulso (o braço segue o clipe), e a mão esquerda da adaga do Salteador também
    aimBlade(ch, B.hand_r, toW(REST_DIR), rw * 0.9);
    if (kind === 'sabre' && B.hand_l) aimBlade(ch, B.hand_l, toW([0.12, -0.78, 0.6]), rw * 0.9);
  }
  if (gw < 0.01) return;
  if (G.lean) { const side = new THREE.Vector3(1, 0, 0).applyQuaternion(bq); rotAround(B.spine_01, side, G.lean * gw * 0.55); rotAround(B.spine_02, side, G.lean * gw * 0.45); }
  if (G.chest !== undefined && B.upperarm_l && B.upperarm_r) { // S-363: o clipe de guarda gira o peito ~50° para a direita; com a armadura/barriga do anão os
    // braços cruzavam por DENTRO do corpo para chegar ao cabo. O peito volta para quase de frente (G.chest) e a cabeça segue olhando para a frente
    const d = B.upperarm_l.getWorldPosition(new THREE.Vector3()).sub(B.upperarm_r.getWorldPosition(new THREE.Vector3())).applyQuaternion(bq.clone().invert());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bq), corr = Math.max(-1.2, Math.min(1.2, G.chest - Math.atan2(-d.z, d.x))) * gw;
    rotAround(B.spine_01, up, corr * 0.4); rotAround(B.spine_02, up, corr * 0.35); rotAround(B.spine_03, up, corr * 0.25);
    if (B.neck_01) rotAround(B.neck_01, up, -corr * 0.5); if (B.Head) rotAround(B.Head, up, -corr * 0.5);
  }
  const dw = ch.root.userData.dwarf; // anão: braço curto para o tronco — mãos um pouco mais baixas (senão a guarda sobe até o queixo)
  const T0 = B.spine_02 ? torsoOf(ch, B, bq) : null, safe = T0 ? { c: B.spine_02.getWorldPosition(new THREE.Vector3()), tq: bq, T: T0, m: 0.035 } : null; // S-363: mãos e cotovelos por fora do tronco/armadura
  const arm = (ua, la, ha, off, pole) => {
    ua.getWorldPosition(_a); la.getWorldPosition(_b); ha.getWorldPosition(_c); const L = _a.distanceTo(_b) + _b.distanceTo(_c), sh = _a.clone(), o2 = dw ? [off[0], off[1] * 1.14, off[2]] : off;
    armSafe(ua, la, ha, sh.clone().add(toW(o2).multiplyScalar(L)), sh.clone().add(toW(pole).multiplyScalar(L)), gw, safe);
  };
  if (G.two && B.upperarm_l) { // S-363: cabo ao alcance das duas mãos (anão: guarda à frente do peito, não no quadril)
    if (B.clavicle_l) rotAround(B.clavicle_l, new THREE.Vector3(0, 1, 0).applyQuaternion(bq), -0.16 * gw);
    B.upperarm_r.getWorldPosition(_a); const L = (ch._armR ?? (ch._armR = armLen(B, 'r'))), sh = _a.clone(), o2 = dw ? [G.r[0], G.r[1] * 1.14, G.r[2]] : G.r;
    armSafe(B.upperarm_r, B.lowerarm_r, B.hand_r, twoHandReach(ch, B, sh.clone().add(toW(o2).multiplyScalar(L)), safe, bq), sh.clone().add(toW(G.rp || POLE_R).multiplyScalar(L)), gw, safe);
  } else arm(B.upperarm_r, B.lowerarm_r, B.hand_r, G.r, G.rp || POLE_R);
  aimBlade(ch, B.hand_r, toW(G.rb), gw);
  if (G.two && B.hand_l) { // mão esquerda logo abaixo da direita, no mesmo cabo (do lado do pomo)
    const ax = bladeAxis(ch, B.hand_r); B.hand_r.updateWorldMatrix(true, false); B.hand_r.getWorldPosition(_c);
    const dir = ax ? ax.clone().applyQuaternion(B.hand_r.getWorldQuaternion(new THREE.Quaternion())) : toW([0, 1, 0]);
    const T = _c.clone().addScaledVector(dir, -0.1).add(toW([0.025, 0, 0])), P = new THREE.Vector3(); B.upperarm_l.getWorldPosition(P); P.add(toW([0.75, -0.45, 0.1])); // cotovelo para fora, não para dentro do peito
    armSafe(B.upperarm_l, B.lowerarm_l, B.hand_l, T, P, gw * 0.95, safe ? { ...safe, m: 0.02 } : null);
  } else if (G.l && B.hand_l) { arm(B.upperarm_l, B.lowerarm_l, B.hand_l, G.l, G.lp || POLE_L); if (G.lb) aimBlade(ch, B.hand_l, toW(G.lb), gw * 0.8); }
}
// qual conjunto de golpes cada classe/arma usa
export function strikeKind(cls, wtype, armed) {
  if (!armed) return 'punhos';
  if (wtype === 'katar' || (cls === 'lamina_sombria' && wtype === 'adaga')) return 'duas';
  if (cls === 'saqueador') return 'sabre';
  if (wtype === 'adaga') return 'adaga';
  if (wtype === 'cajado' || wtype === 'varinha') return 'cajado';
  if (cls === 'cavaleiro_runico') return 'pesada';
  if (cls === 'guardiao_sagrado') return 'paladino';
  if (/^(espada|machado|maca|lanca)/.test(wtype || '')) return 'espada';
  return null;
}

/* ---------------- IMPACTO ---------------- */
let FX = null; // partículas (um InstancedMesh só)
const PN = 160, parts = [], _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
export function initImpact(scene) {
  if (FX) return;
  FX = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), PN);
  FX.instanceMatrix.setUsage(THREE.DynamicDrawUsage); FX.frustumCulled = false; FX.count = 0; FX.renderOrder = 5;
  FX.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PN * 3), 3);
  scene.add(FX);
}
const MAT_OF = { skeleton: 'osso', ghost: 'osso', knight: 'metal', golem: 'pedra', treant: 'madeira', dummy: 'palha', blob: 'gosma', slime: 'gosma', mushroom: 'planta', cactus: 'planta', bee: 'quitina', scorpion: 'quitina', ant: 'quitina' };
const PAL = { carne: ['#7a1414', '#a82020', '#5a0e0e'], osso: ['#e8e2cf', '#cfc6ad', '#9a917a'], pedra: ['#8a8478', '#6e6a60', '#a8a294'], metal: ['#fff2b0', '#ffd060', '#ffffff'], palha: ['#d8b860', '#b89040', '#e8d090'], madeira: ['#6a4a2a', '#8a6a3a', '#4a3420'], gosma: ['#6ab8ff', '#9ad8ff', '#3a88d8'], planta: ['#6a9a3a', '#a8c060', '#4a6a28'], quitina: ['#3a2a1a', '#8a6a2a', '#5a4a2a'] };
export function materialOf(m) { const sh = m && m.def && m.def.shape; return MAT_OF[sh] || (m && m.def && m.def.dummy ? 'palha' : 'carne'); }
function burst(pos, dir, kind, n, crit) {
  if (!FX) return; const pal = PAL[kind] || PAL.carne, spark = kind === 'metal';
  for (let i = 0; i < n; i++) {
    if (parts.length >= PN) parts.shift();
    const sp = (spark ? 4.5 : kind === 'carne' || kind === 'gosma' ? 2.2 : 2.8) * (0.6 + Math.random() * 0.8) * (crit ? 1.25 : 1);
    const v = new THREE.Vector3(dir.x + (Math.random() - 0.5) * 1.3, 0.35 + Math.random() * (spark ? 0.9 : 0.7), dir.z + (Math.random() - 0.5) * 1.3).normalize().multiplyScalar(sp);
    parts.push({ p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15)), v, life: 0, max: spark ? 0.22 + Math.random() * 0.12 : 0.4 + Math.random() * 0.3,
      size: spark ? 0.012 + Math.random() * 0.01 : kind === 'carne' || kind === 'gosma' ? 0.018 + Math.random() * 0.02 : 0.02 + Math.random() * 0.03, col: pal[(Math.random() * pal.length) | 0], spark, g: spark ? 4 : 9 });
  }
}
const flashes = [], knocks = new Set();
function flash(m) { // piscada branca curta: troca o material por uma cópia com brilho (só malhas com emissive), devolve em 90 ms
  const list = m._flashL || (m._flashL = (() => { const l = []; m.obj.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.material && !Array.isArray(o.material) && o.material.emissive && !o.material.transparent && o.visible) l.push(o); }); return l.slice(0, 40); })());
  for (const o of list) { if (!o._flashMat) { o._flashMat = o.material.clone(); o._flashMat.emissive = new THREE.Color('#ffffff'); o._flashMat.emissiveIntensity = 0.55; } if (o.material !== o._flashMat) { o._baseMat = o.material; o.material = o._flashMat; } }
  flashes.push({ list, until: performance.now() + 90 });
}
let stop = 0, shake = 0, shakeT = 0;
/* chamado a cada acerto: m = monstro/alvo, dir = direção do golpe (mundo, xz), o = { crit, heavy, dmg } */
export function impact(m, dir, o = {}) {
  if (!m || !m.obj) return;
  const kind = materialOf(m), d = new THREE.Vector3(dir.x, 0, dir.z); if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
  stop = Math.max(stop, o.crit || o.heavy ? 0.06 : 0.04);
  if (!m.def || !m.def.dummy) { m._kbV = d.clone().multiplyScalar(o.heavy || o.crit ? 0.32 : 0.18); m._kbT = 0; knocks.add(m); }
  flash(m);
  const pos = m.obj.position.clone(); pos.y += (m.height || 1.2) * 0.6; pos.addScaledVector(d, -(m.radius || 0.5) * 0.7);
  burst(pos, d, kind, (o.crit ? 10 : 6) + (o.heavy ? 3 : 0), o.crit);
  if (o.crit || o.heavy) { shake = Math.max(shake, o.crit && o.heavy ? 0.09 : 0.05); shakeT = 0; }
}
// micro-pausa: o laço do jogo passa o dt por aqui (fica ~10% por 40–60 ms depois de um acerto)
export function addShake(a) { shake = Math.max(shake, a); shakeT = 0; } // P-021: tremida leve pedida pelos efeitos de habilidade (meteoro)
export function hitStopDt(dt) { if (stop <= 0) return dt; stop -= dt; return dt * 0.12; }
export function updateImpact(dt) {
  const now = performance.now();
  for (let i = flashes.length - 1; i >= 0; i--) if (now >= flashes[i].until) { for (const o of flashes[i].list) if (o._baseMat && o.material === o._flashMat) o.material = o._baseMat; flashes.splice(i, 1); }
  for (const m of knocks) { // recuo do alvo: sai 18–32 cm para trás e volta (só no visual; a posição de regra não muda)
    m._kbT += dt; const k = m._kbT < 0.08 ? m._kbT / 0.08 : Math.max(0, 1 - (m._kbT - 0.08) / 0.22), cur = m.obj.position;
    if (m._kbLast && cur.distanceToSquared(m._kbLast) < 1e-10 && m._kbAppl) cur.sub(m._kbAppl);
    const off = m._kbV.clone().multiplyScalar(ease(Math.max(0, Math.min(1, k)))); cur.add(off); m._kbAppl = off; m._kbLast = cur.clone();
    if (m._kbT > 0.3 || m.dead) { cur.sub(off); m._kbAppl = null; m._kbLast = null; knocks.delete(m); }
  }
  if (FX) {
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life += dt; if (q.life >= q.max) { parts.splice(i, 1); continue; } q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0 && !q.spark) { q.p.y = 0; q.v.multiplyScalar(0.3); } }
    for (const q of parts) {
      const k = 1 - q.life / q.max, sz = q.size * (q.spark ? 1 : 0.4 + 0.6 * k);
      if (q.spark) { _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), q.v.clone().normalize()); _s.set(sz, sz, sz * 6 * k + sz); } else { _q.identity(); _s.set(sz, sz, sz); }
      _m.compose(q.p, _q, _s); FX.setMatrixAt(n, _m); _col.set(q.col); if (q.spark) _col.multiplyScalar(1.6 * k + 0.4); FX.setColorAt(n, _col); n++;
    }
    FX.count = n; FX.instanceMatrix.needsUpdate = true; if (FX.instanceColor) FX.instanceColor.needsUpdate = true;
  }
}
// tremidinha de câmera (só críticos e golpes pesados), aplicada depois de a câmera ser posicionada
export function shakeCamera(camera, dt) { if (shake <= 0) return; shakeT += dt; const a = shake * Math.max(0, 1 - shakeT / 0.22); if (a <= 0.001) { shake = 0; return; } camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a * 0.7; camera.position.z += (Math.random() - 0.5) * a; }
