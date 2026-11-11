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
/* ---------------- os golpes (mão direita = −x; esquerda = +x; valores em comprimentos de braço a partir do ombro) ---------------- */
const G = (r, l) => ({ r, l });
export const STRIKES = {
  espada: [ // uma mão: talho diagonal, talho horizontal, estocada
    { dur: 0.62, hit: 0.5, keys: [{ t: 0, r: [-0.25, -0.5, 0.55], yaw: 0 }, { t: 0.32, r: [-0.62, 0.62, 0.05], yaw: -0.38, lean: -0.04, rp: [-0.4, 0.5, -0.6], rb: [0.15, 0.75, -0.65] }, { t: 0.55, r: [0.3, -0.55, 0.8], yaw: 0.42, lean: 0.18, rb: [0.55, -0.45, 0.7] }, { t: 0.78, r: [0.42, -0.8, 0.42], yaw: 0.34, lean: 0.12, rb: [0.7, -0.6, 0.2] }, { t: 1, r: [-0.25, -0.5, 0.55], yaw: 0 }] },
    { dur: 0.6, hit: 0.5, keys: [{ t: 0, r: [-0.25, -0.5, 0.55] }, { t: 0.3, r: [-0.85, -0.05, 0.12], yaw: -0.48, rp: [-0.3, -0.7, -0.5], rb: [-0.55, 0.1, -0.8] }, { t: 0.55, r: [-0.05, -0.1, 0.98], yaw: 0.05, lean: 0.12, rb: [0.9, 0.0, 0.4] }, { t: 0.78, r: [0.6, -0.12, 0.55], yaw: 0.5, lean: 0.08, rb: [0.8, -0.1, -0.45] }, { t: 1, r: [-0.25, -0.5, 0.55] }] },
    { dur: 0.55, hit: 0.48, lunge: 0.3, keys: [{ t: 0, r: [-0.25, -0.5, 0.55] }, { t: 0.32, r: [-0.38, -0.32, 0.02], yaw: -0.32, lean: -0.05, rp: [-0.6, -0.4, -0.6] }, { t: 0.52, r: [-0.06, -0.22, 1.0], yaw: 0.18, lean: 0.26 }, { t: 0.72, r: [-0.08, -0.25, 0.92], yaw: 0.12, lean: 0.2 }, { t: 1, r: [-0.25, -0.5, 0.55] }] },
  ],
  pesada: [ // Cavaleiro: golpe por cima (duas mãos) e varredura
    { dur: 0.85, hit: 0.56, two: true, lunge: 0.35, heavy: true, keys: [{ t: 0, r: [-0.15, -0.35, 0.65] }, { t: 0.36, r: [-0.12, 0.95, -0.08], yaw: -0.1, lean: -0.12, rp: [-0.5, 0.3, -0.5], rb: [0.0, 0.35, -0.95] }, { t: 0.58, r: [0.0, -0.5, 0.88], yaw: 0.05, lean: 0.34, rb: [0.05, -0.55, 0.85] }, { t: 0.8, r: [0.08, -0.85, 0.6], lean: 0.28, rb: [0.05, -0.95, 0.25] }, { t: 1, r: [-0.15, -0.35, 0.65] }] },
    { dur: 0.8, hit: 0.55, two: true, heavy: true, keys: [{ t: 0, r: [-0.15, -0.35, 0.65] }, { t: 0.34, r: [-0.85, 0.1, -0.1], yaw: -0.62, lean: 0.02, rp: [-0.3, -0.6, -0.6], rb: [-0.6, 0.15, -0.75] }, { t: 0.58, r: [0.1, -0.2, 0.92], yaw: 0.25, lean: 0.14, rb: [0.9, -0.1, 0.4] }, { t: 0.8, r: [0.7, -0.25, 0.45], yaw: 0.62, lean: 0.1, rb: [0.75, -0.2, -0.55] }, { t: 1, r: [-0.15, -0.35, 0.65] }] },
  ],
  paladino: [ // golpe curto e empurrão de escudo
    { dur: 0.56, hit: 0.5, keys: [{ t: 0, r: [-0.3, -0.55, 0.45] }, { t: 0.3, r: [-0.5, 0.48, 0.15], yaw: -0.22, rp: [-0.4, 0.4, -0.6], rb: [0.1, 0.8, -0.6] }, { t: 0.55, r: [0.08, -0.38, 0.82], yaw: 0.2, lean: 0.16, rb: [0.45, -0.45, 0.75] }, { t: 0.78, r: [0.18, -0.6, 0.55], yaw: 0.15, lean: 0.1, rb: [0.55, -0.75, 0.3] }, { t: 1, r: [-0.3, -0.55, 0.45] }] },
    { dur: 0.6, hit: 0.5, lunge: 0.4, heavy: true, keys: [{ t: 0, l: [0.25, -0.3, 0.45] }, { t: 0.32, l: [0.32, -0.22, 0.12], yaw: 0.3, lean: -0.05, lp: [0.7, -0.4, -0.4] }, { t: 0.52, l: [0.05, -0.12, 0.98], yaw: -0.32, lean: 0.26 }, { t: 0.74, l: [0.06, -0.15, 0.9], yaw: -0.28, lean: 0.2 }, { t: 1, l: [0.25, -0.3, 0.45] }] },
  ],
  adaga: [ // estocadas rápidas e corte reverso
    { dur: 0.42, hit: 0.48, lunge: 0.2, keys: [{ t: 0, r: [-0.2, -0.45, 0.5] }, { t: 0.3, r: [-0.28, -0.32, 0.18], yaw: -0.22, rp: [-0.6, -0.4, -0.5] }, { t: 0.5, r: [-0.04, -0.2, 0.98], yaw: 0.18, lean: 0.2 }, { t: 1, r: [-0.2, -0.45, 0.5] }] },
    { dur: 0.48, hit: 0.5, keys: [{ t: 0, r: [-0.2, -0.45, 0.5] }, { t: 0.3, r: [0.28, -0.05, 0.42], yaw: 0.32, rp: [-0.2, -0.7, -0.5] }, { t: 0.55, r: [-0.62, -0.25, 0.62], yaw: -0.28, lean: 0.12 }, { t: 0.78, r: [-0.72, -0.35, 0.42], yaw: -0.32 }, { t: 1, r: [-0.2, -0.45, 0.5] }] },
  ],
  duas: [ // katar / duas adagas: estocadas alternadas, elegantes ("dança" do Algoz), sem abrir as pernas
    { dur: 0.42, hit: 0.46, lunge: 0.24, keys: [{ t: 0, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }, { t: 0.24, r: [-0.24, -0.26, 0.22], l: [0.15, -0.3, 0.62], yaw: -0.22, rp: [-0.6, -0.45, -0.5] }, { t: 0.44, r: [-0.01, -0.06, 1.08], l: [0.26, -0.36, 0.28], yaw: 0.34, lean: 0.24 }, { t: 0.62, r: [-0.02, -0.08, 1.04], l: [0.26, -0.36, 0.3], yaw: 0.3, lean: 0.2 }, { t: 1, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }] }, // P-021: braço quase reto à frente na altura do peito, ombro acompanhando, segura um instante
    { dur: 0.42, hit: 0.46, lunge: 0.24, keys: [{ t: 0, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }, { t: 0.24, l: [0.24, -0.26, 0.22], r: [-0.15, -0.3, 0.62], yaw: 0.22, lp: [0.6, -0.45, -0.5] }, { t: 0.44, l: [0.01, -0.06, 1.08], r: [-0.26, -0.36, 0.28], yaw: -0.34, lean: 0.24 }, { t: 0.62, l: [0.02, -0.08, 1.04], r: [-0.26, -0.36, 0.3], yaw: -0.3, lean: 0.2 }, { t: 1, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }] },
    { dur: 0.5, hit: 0.52, keys: [{ t: 0, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }, { t: 0.3, r: [-0.62, 0.05, 0.35], l: [0.62, 0.05, 0.35], lean: -0.04 }, { t: 0.55, r: [0.22, -0.3, 0.85], l: [-0.22, -0.3, 0.85], lean: 0.16 }, { t: 1, r: [-0.18, -0.4, 0.55], l: [0.18, -0.4, 0.55] }] },
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
function sampleAt(def, u) { // interpolação suave entre as chaves; mão sem chave de um lado herda a do outro lado
  const K = def.keys; let i = 0; while (i < K.length - 2 && u > K[i + 1].t) i++;
  const A = K[i], B = K[i + 1], k = ease(Math.max(0, Math.min(1, (u - A.t) / Math.max(1e-4, B.t - A.t))));
  const pick = (key, side) => { for (let j = K.indexOf(key); j >= 0; j--) if (K[j][side]) return K[j][side]; return null; };
  const r0 = A.r || pick(A, 'r'), r1 = B.r || r0, l0 = A.l || pick(A, 'l'), l1 = B.l || l0;
  return { r: r0 ? lerp3(r0, r1, k) : null, l: l0 ? lerp3(l0, l1, k) : null, yaw: (A.yaw || 0) + ((B.yaw || 0) - (A.yaw || 0)) * k, lean: (A.lean || 0) + ((B.lean || 0) - (A.lean || 0)) * k,
    rp: lerp3(A.rp || POLE_R, B.rp || POLE_R, k), lp: lerp3(A.lp || POLE_L, B.lp || POLE_L, k), rbA: A.rb || null, rbB: B.rb || null, lbA: A.lb || null, lbB: B.lb || null, k };
}
function envelope(st, u) { const a = Math.min(1, u / 0.14), b = Math.min(1, (1 - u) / 0.24); const e = Math.max(0, Math.min(a, b)); return Math.max(e, st.w0 * Math.max(0, 1 - u / 0.14)); }
function sampleNow(st) { const u = Math.min(1, st.t / st.dur), s = sampleAt(st.def, u); s.w = envelope(st, u); return s; }

const BONES = ['spine_01', 'spine_02', 'spine_03', 'upperarm_r', 'lowerarm_r', 'hand_r', 'upperarm_l', 'lowerarm_l', 'hand_l'];
function bonesOf(ch) { if (ch._stB) return ch._stB; const B = {}; for (const n of BONES) B[n] = ch.root.getObjectByName(n); return (ch._stB = B); }
/* aplica o golpe no quadro (depois do mixer e da postura da classe). opts.skipR / skipL: braço ocupado por outro IK (cajado, arco). */
export function updateStrike(ch, dt, opts = {}) {
  const st = ch && ch._strike; if (!st) return false;
  st.t += dt; if (st.t >= st.dur) { ch._strike = null; return false; }
  const u = st.t / st.dur; let s = sampleAt(st.def, u); const w = envelope(st, u);
  if (st.prev && u < 0.14) { const k = ease(u / 0.14); s = { ...s, r: s.r && st.prev.r ? lerp3(st.prev.r, s.r, k) : s.r, l: s.l && st.prev.l ? lerp3(st.prev.l, s.l, k) : s.l, yaw: st.prev.yaw + (s.yaw - st.prev.yaw) * k, lean: st.prev.lean + (s.lean - st.prev.lean) * k }; }
  const B = bonesOf(ch), body = ch.obj || ch.root; if (!B.spine_01) return false;
  body.updateWorldMatrix(true, true); body.getWorldQuaternion(_qb); const bq = _qb.clone();
  // tronco: giro (em volta do "para cima" do corpo) e inclinação para a frente, espalhados pela coluna
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bq), side = new THREE.Vector3(1, 0, 0).applyQuaternion(bq);
  const yaw = s.yaw * w, lean = s.lean * w;
  rotAround(B.spine_01, up, yaw * 0.45); rotAround(B.spine_02, up, yaw * 0.35); rotAround(B.spine_03, up, yaw * 0.2);
  rotAround(B.spine_01, side, lean * 0.55); rotAround(B.spine_02, side, lean * 0.45);
  // braços por IK: alvo = ombro + offset (em comprimentos de braço, no espaço do corpo)
  const toW = v => new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(bq);
  const arm = (ua, la, ha, off, pole) => {
    if (!ua || !la || !ha || !off) return;
    ua.getWorldPosition(_a); la.getWorldPosition(_b); ha.getWorldPosition(_c); const L = _a.distanceTo(_b) + _b.distanceTo(_c), sh = _a.clone();
    const T = sh.clone().add(toW(off).multiplyScalar(L)), P = sh.clone().add(toW(pole).multiplyScalar(L));
    ik2(ua, la, ha, T, P, w);
  };
  let rOff = s.r, lOff = s.l;
  if (st.def.two && rOff) lOff = null; // duas mãos no cabo: a esquerda vai até a direita (feito abaixo)
  if (!opts.skipR) arm(B.upperarm_r, B.lowerarm_r, B.hand_r, rOff, s.rp);
  if (st.def.two && rOff && B.hand_r && !opts.skipL) { // mão esquerda abaixo da direita, no mesmo cabo
    B.hand_r.getWorldPosition(_c); const T = _c.clone().add(toW([0.02, -0.11, -0.04])), P = new THREE.Vector3(); B.upperarm_l.getWorldPosition(P); P.add(toW([0.5, -0.5, -0.3]));
    ik2(B.upperarm_l, B.lowerarm_l, B.hand_l, T, P, w * 0.95);
  } else if (!opts.skipL) arm(B.upperarm_l, B.lowerarm_l, B.hand_l, lOff, s.lp);
  // pulso: lâmina na direção pedida pela chave (ou seguindo o antebraço, como numa estocada)
  const fore = (lo, ha) => { lo.getWorldPosition(_a); ha.getWorldPosition(_b); return _b.clone().sub(_a).normalize(); };
  const blend = (lo, ha, a, b) => { const f = fore(lo, ha), da = a ? toW(a).normalize() : f, db = b ? toW(b).normalize() : f; return da.lerp(db, s.k ?? 0).normalize(); }; // chave sem direção = segue o antebraço
  if (!opts.skipR && rOff && B.hand_r) aimBlade(ch, B.hand_r, blend(B.lowerarm_r, B.hand_r, s.rbA, s.rbB), w * 0.85);
  if (!opts.skipL && lOff && !st.def.two && B.hand_l) aimBlade(ch, B.hand_l, blend(B.lowerarm_l, B.hand_l, s.lbA, s.lbB), w * 0.85);
  return true;
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
