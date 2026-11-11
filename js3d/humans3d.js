/* =========================================================================
   PERSONAGENS REALISTAS (S-093) — Quaternius (CC0): Universal Base Characters,
   Modular Character Outfits - Fantasy e Universal Animation Library.
   Montagem: corpo da ROUPA (braços, tronco, pernas, pés) + CABEÇA recortada do
   corpo base (rosto, olhos, sobrancelhas) + CABELO/BARBA presos no mesmo esqueleto.
   Todos usam o mesmo esqueleto de 65 ossos, então as 43 animações servem para tudo.
   ========================================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

const Q = 'assets3d/quaternius/';
export const HUMAN_HAIRS = { curto: 'Hair_SimpleParted', raspado: 'Hair_Buzzed', raspadoF: 'Hair_BuzzedFemale', longo: 'Hair_Long', coque: 'Hair_Buns', careca: null };
export const HUMAN_OUTFITS = { patrulheiro: 'Ranger', campones: 'Peasant' };
// cortes do criador antigo → cortes do modelo realista
export const OLD_TO_HUMAN_HAIR = { curto: 'curto', topete: 'curto', espetado: 'raspado', moicano: 'raspado', franja: 'curto', rabo: 'longo', coque: 'coque', longo: 'longo', careca: 'careca', raspado: 'raspado' };
// nomes das animações antigas (KayKit) → animações do corpo realista (Universal Animation Library)
const ANIM_MAP = {
  Idle: 'Idle_Loop', Idle_Combat: 'Sword_Idle', Unarmed_Idle: 'Idle_Loop',
  Walking_A: 'Walk_Loop', Walking_B: 'Walk_Loop', Walking_C: 'Walk_Loop', Walking_D_Skeletons: 'Walk_Loop', Walking_Backwards: 'Walk_Loop',
  Running_A: 'Jog_Fwd_Loop', Running_B: 'Jog_Fwd_Loop', Running_C: 'Sprint_Loop', Running_Strafe_Left: 'Jog_Fwd_Loop', Running_Strafe_Right: 'Jog_Fwd_Loop',
  Jump_Start: 'Jump_Start', Jump_Idle: 'Jump_Loop', Jump_Land: 'Jump_Land', Jump_Full_Short: 'Jump_Start',
  Death_A: 'Death01', Death_B: 'Death01', Death_C_Skeletons: 'Death01', Hit_A: 'Hit_Chest', Hit_B: 'Hit_Head',
  Interact: 'Interact', Cheer: 'Spell_Simple_Shoot', PickUp: 'PickUp_Table',
  Sit_Chair_Idle: 'Sitting_Idle_Loop', Sit_Chair_Down: 'Sitting_Enter', Sit_Floor_Down: 'Sitting_Enter', Sit_Floor_Idle: 'Sitting_Idle_Loop', Sit_Floor_StandUp: 'Sitting_Exit',
  Spellcasting: 'Spell_Simple_Idle_Loop', Spellcast_Shoot: 'Spell_Simple_Shoot', Spellcast_Long: 'Spell_Simple_Idle_Loop', Spellcast_Raise: 'Spell_Simple_Enter',
  '1H_Melee_Attack_Slice_Diagonal': 'Sword_Attack', '1H_Melee_Attack_Chop': 'Sword_Attack', '1H_Melee_Attack_Stab': 'Sword_Attack', '1H_Melee_Attack_Slice_Horizontal': 'Sword_Attack',
  '2H_Melee_Attack_Slice': 'Sword_Attack', '2H_Melee_Attack_Chop': 'Sword_Attack', '2H_Melee_Attack_Spin': 'Sword_Attack', '2H_Melee_Idle': 'Sword_Idle',
  Dualwield_Melee_Attack_Slice: 'Sword_Attack', Dualwield_Melee_Attack_Stab: 'Punch_Cross', Dualwield_Melee_Attack_Chop: 'Sword_Attack',
  '2H_Ranged_Shoot': 'Pistol_Shoot', '1H_Ranged_Shoot': 'Pistol_Shoot', '2H_Ranged_Aiming': 'Pistol_Aim_Neutral', '2H_Ranged_Reload': 'Pistol_Reload',
  Block: 'Sword_Idle', Lie_Idle: 'Death01', Lie_Pose: 'Death01',
};
export const humanAnimName = n => ANIM_MAP[n] || n;
const FILES = {
  base_m: 'base/Superhero_Male_FullBody.gltf', base_f: 'base/Superhero_Female_FullBody.gltf',
  out_m_Ranger: 'outfits/Male_Ranger.gltf', out_f_Ranger: 'outfits/Female_Ranger.gltf', out_m_Peasant: 'outfits/Male_Peasant.gltf', out_f_Peasant: 'outfits/Female_Peasant.gltf',
  Hair_SimpleParted: 'base/Hair_SimpleParted.gltf', Hair_Buzzed: 'base/Hair_Buzzed.gltf', Hair_BuzzedFemale: 'base/Hair_BuzzedFemale.gltf', Hair_Long: 'base/Hair_Long.gltf', Hair_Buns: 'base/Hair_Buns.gltf', Hair_Beard: 'base/Hair_Beard.gltf',
  Eyebrows_Regular: 'base/Eyebrows_Regular.gltf', Eyebrows_Female: 'base/Eyebrows_Female.gltf',
  anims: 'anims/UAL1_Standard.glb',
};
const G = {}; let loading = null;
export function loadHumans(onEach) {
  if (loading) return loading;
  const L = new GLTFLoader();
  loading = Promise.all(Object.entries(FILES).map(([k, f]) => L.loadAsync(Q + f).then(g => { G[k] = g; if (onEach) onEach(k); })))
    .then(() => { tameClips(); prepHeads(); prepMaterials(); for (const k of Object.keys(G)) if (k.startsWith('out_')) { if (k.startsWith('out_f_')) dropParts(G[k].scene, /Pauldron/); mergeOutfit(G[k].scene); } return G; });
  return loading;
}
export const humanAnims = () => (G.anims ? G.anims.animations : []);
/* S-331: o "Sword_Attack" do pacote gira a bacia 72° e o peito mais 78° por cima (quase meia-volta a cada golpe; os outros
   golpes giram no máximo ~20°). Em sequência, o personagem parecia rodar em volta de si mesmo — em TODAS as classes de
   espada/machado/maça/lança. Aqui, uma única vez ao carregar, cada osso listado é aproximado da pose do 1º quadro do clipe
   (slerp com fator k: 1 = como veio, 0 = parado). Braços e pernas ficam intactos: o talho continua legível. */
const TAME = { Sword_Attack: { pelvis: 0.32, spine_01: 0.5, spine_02: 0.55, spine_03: 0.42, neck_01: 0.45, Head: 0.5 } };
let tamed = false;
function tameClips() {
  if (tamed || !G.anims) return; tamed = true;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (const clip of G.anims.animations) {
    const T = TAME[clip.name]; if (!T) continue;
    for (const tr of clip.tracks) {
      const [bone, prop] = tr.name.split('.'); if (prop !== 'quaternion' || T[bone] === undefined) continue;
      const v = tr.values, k = T[bone]; qa.fromArray(v, 0);
      for (let i = 4; i < v.length; i += 4) { qb.fromArray(v, i); qb.copy(qa.clone().slerp(qb, k)); qb.toArray(v, i); }
    }
  }
}
/* S-127: as animações trazem a POSIÇÃO de todos os ossos (medidas do esqueleto masculino). No corpo feminino isso
   alarga ombros e quadris de homem. Para elas, usamos cópias das animações só com rotação (posição só na raiz/pélvis),
   e o esqueleto mantém as proporções femininas. */
const femClips = [];
const dwarfClips = { m: [], f: [] };
let DWARF_HIP = 0.69; // razão altura da pélvis anão/humano (calculada ao montar o 1º anão)
function animsFor(sex, dwarf) {
  const all = humanAnims();
  if (dwarf) { // S-178: anões sem trilhas de escala (as proporções de anão ficam nos ossos); elas também sem posição, como as mulheres
    const base = sex === 'f' ? animsFor('f') : all, out = dwarfClips[sex === 'f' ? 'f' : 'm'];
    if (out.length !== base.length) { out.length = 0; for (const c of base) { // sem escala e sem posição fora da raiz/pélvis (o esqueleto de anão mantém as próprias medidas); a pélvis desce junto com as pernas
      const tr = c.tracks.filter(t => !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || /^(root|pelvis)\./.test(t.name))).map(t => { if (t.name !== 'pelvis.position') return t; const n = t.clone(); for (let i = 0; i < n.values.length; i++) n.values[i] *= DWARF_HIP; return n; });
      out.push(new THREE.AnimationClip(c.name, c.duration, tr)); } }
    return out;
  }
  if (sex !== 'f') return all;
  if (femClips.length !== all.length) { femClips.length = 0; for (const c of all) femClips.push(new THREE.AnimationClip(c.name, c.duration, c.tracks.filter(t => !t.name.endsWith('.position') || /^(root|pelvis)\./.test(t.name)))); }
  return femClips;
}
// põe o esqueleto na pose parada (Idle) para encaixar peças no lugar certo; a animação de verdade assume no quadro seguinte
export function humanIdlePose(root) {
  const clip = THREE.AnimationClip.findByName(animsFor(root.userData.sex, root.userData.dwarf), 'Idle_Loop'); if (!clip) return;
  const mx = new THREE.AnimationMixer(root), a = mx.clipAction(clip); a.play(); mx.update(0.4); root.updateMatrixWorld(true);
  // (não chame a.stop(): ao desligar, o three.js devolve os ossos à pose em T do arquivo)
}
// proporções femininas: ombros um pouco mais estreitos e braços mais finos, quadril levemente mais largo
function feminize(skel) {
  const by = n => skel.bones.find(b => b.name === n);
  for (const s of ['l', 'r']) {
    const up = by('upperarm_' + s), lo = by('lowerarm_' + s), th = by('thigh_' + s), cl = by('clavicle_' + s);
    if (up) { up.position.multiplyScalar(0.9); up.scale.set(1, 0.88, 0.88); }
    if (lo) lo.scale.set(1, 0.94, 0.94);
    if (cl) cl.position.multiplyScalar(0.94);
    if (th) th.position.x *= 1.05;
  }
}

// recorta do corpo base só a cabeça e o pescoço (triângulos presos aos ossos Head/neck_01)
function headOnly(mesh) {
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index.array;
  const bones = mesh.skeleton.bones.map(b => b.name), HEADB = new Set(['Head', 'neck_01']);
  const top = v => { let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > best) { best = w; bi = si.getComponent(v, k); } } return bones[bi]; };
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (HEADB.has(top(a)) && HEADB.has(top(b)) && HEADB.has(top(c))) keep.push(a, b, c); }
  const ng = g.clone(); ng.setIndex(keep); return ng;
}
function prepHeads() {
  for (const s of ['m', 'f']) {
    const sc = G['base_' + s].scene; let body = null;
    sc.traverse(o => { if (o.isSkinnedMesh && /SuperHero/i.test(o.name)) body = o; });
    if (body) body.geometry = headOnly(body);
  }
}
// tira peças da roupa (ex.: a ombreira pesada deixava a silhueta feminina com ombros de homem — S-127)
function dropParts(scene, re) { const out = []; scene.traverse(o => { if (o.isSkinnedMesh && re.test(o.name)) out.push(o); }); for (const o of out) o.parent.remove(o); }
// junta as peças da roupa que usam o mesmo material numa malha só (o capuz fica separado: ele liga/desliga)
function mergeOutfit(scene) {
  const groups = new Map(); let skel = null, parent = null, bindM = null;
  scene.traverse(o => { if (!o.isSkinnedMesh || /Head_Hood/.test(o.name)) return; skel = skel || o.skeleton; parent = parent || o.parent; bindM = bindM || o.bindMatrix; const k = o.material.uuid; (groups.get(k) || groups.set(k, []).get(k)).push(o); });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keys = Object.keys(list[0].geometry.attributes);
    if (list.some(o => Object.keys(o.geometry.attributes).sort().join() !== keys.slice().sort().join())) continue;
    const geo = mergeGeometries(list.map(o => o.geometry)); if (!geo) continue;
    const m = new THREE.SkinnedMesh(geo, list[0].material); m.name = list.map(o => o.name).join('+');
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    list[0].parent.add(m); m.bind(list[0].skeleton, list[0].bindMatrix);
    for (const o of list) o.parent.remove(o);
  }
}
/* ANÃO DE VERDADE (pedido do Roberto: "outra criatura, não o humano distorcido", no espírito dos anões de MMO).
   Nada de escala nos ossos (era o que esmagava). O corpo é REESCULPIDO no repouso:
   1) proporções novas mudando só a POSIÇÃO de repouso dos ossos (pernas curtas, tronco curto, pescoço quase nenhum,
      ombros bem largos, braços curtos);
   2) toda malha presa ao esqueleto (roupa, rosto, olhos, cabelo, barba) é recalculada para esse repouso
      (v' = Σ w·B'·B⁻¹·v) e os ossos ganham novos "inversos de repouso" — as animações giram os ossos novos;
   3) volume esculpido por cima: braços/coxas/panturrilhas/pescoço grossos, tronco em barril com barriga, mãos e pés grandes;
   4) rosto grosseiro: nariz batatudo, sobrancelha pesada, maçãs e mandíbula largas, orelhas maiores; barba farta.
   Tudo em cache por malha de origem (o mesmo anão é reaproveitado por todos os anões do mesmo sexo/roupa). */
const DWARF_REST = { // multiplicador na posição de repouso (eixo y = comprimento do osso)
  calf_l: [1, 0.74, 1], calf_r: [1, 0.74, 1], foot_l: [1, 0.72, 1], foot_r: [1, 0.72, 1], // pernas curtas
  thigh_l: [1.4, 1, 1], thigh_r: [1.4, 1, 1],            // pernas afastadas (base larga)
  spine_01: [1, 0.9, 1], spine_02: [1, 0.85, 1], spine_03: [1, 0.85, 1], // tronco curto
  neck_01: [1, 0.72, 1], Head: [1, 0.5, 1],              // pescoço curto e grosso
  clavicle_l: [1, 0.86, 1], clavicle_r: [1, 0.86, 1],
  upperarm_l: [1, 1.45, 1], upperarm_r: [1, 1.45, 1],    // ombros bem largos (a clavícula fica mais comprida)
  lowerarm_l: [1, 0.8, 1], lowerarm_r: [1, 0.8, 1], hand_l: [1, 0.82, 1], hand_r: [1, 0.82, 1], // braços curtos
};
const DW_THICK = { upperarm: ['lowerarm', 0.4], lowerarm: ['hand', 0.36], thigh: ['calf', 0.34], calf: ['foot', 0.4], clavicle: ['upperarm', 0.22], neck_01: ['Head', 0.5] };
const dwCache = new Map();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3();
const gauss = (u, cx, cy, cz, rx, ry, rz) => Math.exp(-(((u.x - cx) / rx) ** 2 + ((u.y - cy) / ry) ** 2 + ((u.z - cz) / rz) ** 2));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function applyDwarfBody(obj, root, skel) {
  root.userData.dwarf = true;
  const bones = skel.bones, by = n => bones.find(b => b.name === n);
  obj.updateMatrixWorld(true);
  // pernas mais curtas → a pélvis desce o mesmo tanto (pés no chão)
  const legOld = by('calf_l').position.y + by('foot_l').position.y;
  for (const [n, f] of Object.entries(DWARF_REST)) { const b = by(n); if (b) b.position.multiply(_v.set(f[0], f[1], f[2])); }
  const legNew = by('calf_l').position.y + by('foot_l').position.y, pel = by('pelvis'), pz0 = pel.position.z;
  pel.position.z -= legOld - legNew; root.userData.dwarfHip = DWARF_HIP = pel.position.z / pz0;
  obj.updateMatrixWorld(true);
  const P = n => { const b = by(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const BW = new Map(bones.map(b => [b, b.matrixWorld.clone()]));
  const fp = [P('pelvis'), P('Head'), P('hand_l')].map(v => v.toArray().map(x => x.toFixed(3)).join()).join('|');
  const H = P('Head'), FOOT = { l: P('foot_l'), r: P('foot_r') }, HAND = { l: P('hand_l'), r: P('hand_r') }, SP1 = P('spine_01'), SEG = {};
  for (const [k, [c]] of Object.entries(DW_THICK)) for (const s of ['l', 'r']) { const a = P(k === 'neck_01' ? k : k + '_' + s), b = P(c === 'Head' ? c : c + '_' + s); if (a && b) SEG[k === 'neck_01' ? k : k + '_' + s] = [a, b]; }
  const sculpt = (p, bn, w, mesh, d) => { // deslocamento esculpido de um vértice (p no repouso novo), somado por peso de osso
    let m = /^(upperarm|lowerarm|thigh|calf|clavicle)_([lr])$/.exec(bn), key = m ? m[1] : bn;
    if (DW_THICK[key] && SEG[bn]) { const [a, b] = SEG[bn], ab = _w.copy(b).sub(a), t = Math.max(0, Math.min(1, _v.copy(p).sub(a).dot(ab) / ab.lengthSq())); const q = a.clone().addScaledVector(ab, t), r = _v.copy(p).sub(q), L = r.length(); if (L > 1e-5) d.addScaledVector(r, Math.min(L * DW_THICK[key][1], 0.03) / L * w); return; } // engrossa até 3 cm (ombreiras e peças soltas não voam para longe)
    m = /(hand|thumb|index|middle|ring|pinky)\w*_([lr])$/.exec(bn); if (m) { d.addScaledVector(_v.copy(p).sub(HAND[m[2]]), 0.24 * w); return; }
    m = /^(foot|ball)\w*_([lr])$/.exec(bn); if (m) { const F = FOOT[m[2]]; d.x += (p.x - F.x) * 0.32 * w; d.y += p.y * 0.12 * w; d.z += (p.z - F.z + 0.03) * 0.32 * w; return; }
    if (/^(pelvis|spine_0[123])$/.test(bn)) { // tronco em barril, com barriga
      const ux = p.x, uz = p.z - SP1.z, kx = bn === 'pelvis' ? 0.14 : bn === 'spine_01' ? 0.2 : 0.22;
      d.x += ux * kx * w; d.z += (uz > 0 ? uz * 0.24 : uz * 0.12) * w;
      d.z += 0.055 * Math.exp(-(((p.y - SP1.y - 0.03) / 0.13) ** 2)) * sstep(-0.02, 0.07, uz) * (1 - Math.min(1, Math.abs(ux) / 0.2)) * w; return;
    }
    if (bn === 'Head') { // rosto grosseiro (coordenadas relativas ao osso da cabeça; +z = frente)
      const u = _v.copy(p).sub(H), sx = Math.sign(u.x) || 1;
      let gx = 0, gy = 0, gz = 0, g; const eyes = /^Eyes/.test(mesh);
      if (!eyes) {
        g = gauss(u, 0, 0.045, 0.14, 0.034, 0.032, 0.035); gx += u.x * 1.1 * g; gz += 0.016 * g; gy -= 0.006 * g;    // nariz grande
        g = gauss(u, 0, 0.036, 0.15, 0.022, 0.02, 0.022); gx += u.x * 0.9 * g; gy += (u.y - 0.036) * 0.7 * g; gz += (u.z - 0.13) * 0.5 * g; // ponta redonda e larga (batatudo)
        g = gauss(u, 0, 0.03, 0.12, 0.034, 0.018, 0.025); gx += u.x * 1.1 * g; gz += 0.006 * g;                      // narinas largas
        g = gauss(u, 0, 0.122, 0.085, 0.075, 0.013, 0.03); gz += 0.016 * g; gy += 0.003 * g;                         // sobrancelha pesada (acima dos olhos, sem fechá-los)
        g = gauss(u, sx * 0.05, 0.062, 0.075, 0.025, 0.02, 0.03); gx += sx * 0.012 * g; gz += 0.005 * g;              // maçãs largas
      }
      const jaw = sstep(0.035, -0.03, u.y) * sstep(-0.05, 0.02, u.z); gx += u.x * 0.38 * jaw; gz += 0.008 * jaw;         // mandíbula larga e quadrada
      if (!eyes) { g = gauss(u, sx * 0.078, 0.065, -0.005, 0.028, 0.032, 0.03); gx += (u.x - sx * 0.078) * 0.35 * g + sx * 0.006 * g; gy += (u.y - 0.065) * 0.3 * g; } // orelhas maiores
      gx += u.x * 0.07;                                                                                                  // cabeça um pouco mais larga
      if (/Beard/.test(mesh)) { const lo = Math.min(0, u.y - 0.02); gy += lo * 1.0; gx += u.x * 0.28 * sstep(0.03, -0.02, u.y); gz += Math.max(0, u.z) * 0.3 * sstep(0.03, -0.03, u.y); } // barba farta e comprida
      if (/Eyebrows/.test(mesh)) { gy += Math.max(0, u.y - 0.106) * 1.1 + 0.004; gz += 0.004; gx += u.x * 0.1; }    // sobrancelhas grossas (crescem para cima, sem cobrir os olhos)
      d.x += gx * w; d.y += gy * w; d.z += gz * w;
    }
  };
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton, key = o.geometry.uuid + '|' + fp + '|' + sk.bones.map(b => b.name).join(',').length;
    let C = dwCache.get(key);
    if (!C) {
      const g = o.geometry.clone(), pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const M = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(BW.get(b) || b.matrixWorld, sk.boneInverses[i]));
      const bind = o.bindMatrix, bindInv = new THREE.Matrix4().copy(bind).invert(), N = pos.count, base = new Float32Array(N * 3), nb = nor ? new Float32Array(N * 3) : null;
      const acc = new THREE.Vector3(), nacc = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Vector3();
      for (let i = 0; i < N; i++) {
        q.fromBufferAttribute(pos, i).applyMatrix4(bind); acc.set(0, 0, 0); nacc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const bi = si.getComponent(i, k); acc.addScaledVector(_w.copy(q).applyMatrix4(M[bi]), w); if (nor) nacc.addScaledVector(_w.fromBufferAttribute(nor, i).applyMatrix3(_n3.setFromMatrix4(M[bi])), w); }
        d.set(0, 0, 0); for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w) sculpt(acc, sk.bones[si.getComponent(i, k)].name, w, o.name, d); }
        base[i * 3] = acc.x; base[i * 3 + 1] = acc.y; base[i * 3 + 2] = acc.z; if (nb) { nacc.normalize(); nb[i * 3] = nacc.x; nb[i * 3 + 1] = nacc.y; nb[i * 3 + 2] = nacc.z; }
        acc.add(d).applyMatrix4(bindInv); pos.setXYZ(i, acc.x, acc.y, acc.z);
      }
      if (nor && g.index) { // normais: as originais (mantêm quinas) + a mudança causada pela escultura
        const gs = g.clone(); gs.attributes.position.array.set(base); for (let i = 0; i < N; i++) { _v.fromArray(base, i * 3).applyMatrix4(bindInv); gs.attributes.position.setXYZ(i, _v.x, _v.y, _v.z); }
        gs.computeVertexNormals(); const ga = g.clone(); ga.computeVertexNormals();
        for (let i = 0; i < N; i++) { _v.fromArray(nb, i * 3).add(_w.fromBufferAttribute(ga.attributes.normal, i)).sub(q.fromBufferAttribute(gs.attributes.normal, i)).normalize(); nor.setXYZ(i, _v.x, _v.y, _v.z); }
        gs.dispose(); ga.dispose();
      }
      if (g.attributes.tangent) { try { g.computeTangents(); } catch (e) { } }
      g.computeBoundingSphere();
      C = { geo: g, inv: sk.bones.map(b => new THREE.Matrix4().copy(BW.get(b) || b.matrixWorld).invert()) };
      dwCache.set(key, C);
    }
    o.geometry = C.geo; o.skeleton.boneInverses = C.inv.slice();
  });
  // pele um pouco mais corada (anão de forja)
  root.traverse(o => { if (o.isSkinnedMesh && o.material && (/SuperHero/.test(o.name) || /Regular/.test(o.material.name))) o.material = dwarfSkin(o.material); });
}
const dwSkinCache = new Map();
function dwarfSkin(mat) { if (dwSkinCache.has(mat.uuid)) return dwSkinCache.get(mat.uuid); const m = mat.clone(); m.color = new THREE.Color('#ffe0d2'); m.needsUpdate = true; dwSkinCache.set(mat.uuid, m); return m; }
/* S-246: peças presas nos ossos de anão (ombreiras, braçadeiras, armas, chapéu) herdavam a escala desigual do osso e
   ficavam esticadas/achatadas. Aqui cada peça recebe a escala inversa (mantendo o volume), só nos anões. */
export function unsquashDwarf(root) {
  if (!root.userData.dwarf) return;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  root.traverse(b => {
    if (!b.isBone) return;
    for (const c of b.children) {
      if (c.isBone || c.isSkinnedMesh || c.userData.unsq) continue;
      m.multiplyMatrices(inv, b.matrixWorld).decompose(p, q, sc);
      const v = Math.cbrt(Math.abs(sc.x * sc.y * sc.z)) || 1; c.scale.set(c.scale.x * v / sc.x, c.scale.y * v / sc.y, c.scale.z * v / sc.z); c.userData.unsq = true;
    }
  });
}
// todas as malhas de um personagem passam a usar UM esqueleto (antes cada peça tinha o seu: 30 atualizações por personagem a cada quadro)
export function shareSkeletons(root) {
  let master = null; const eq = (a, b) => { for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > 1e-4) return false; return true; };
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (!master) { master = o.skeleton; return; }
    const sk = o.skeleton; if (sk === master || sk.bones.length !== master.bones.length) return;
    let ok = true; for (let i = 0; i < sk.bones.length && ok; i++) ok = sk.bones[i] === master.bones[i] && eq(sk.boneInverses[i], master.boneInverses[i]);
    if (ok) o.skeleton = master;
  });
}
// cores do cabelo/pele em materiais próprios (o cabelo recebe a cor escolhida)
function prepMaterials() {
  for (const k of Object.keys(G)) G[k].scene && G[k].scene.traverse(o => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    // relevo (normal map) precisa de tangentes; sem elas aparece um "xadrez" de triângulos na pele e no tecido
    const g = o.geometry; if (o.material && o.material.normalMap && g.index && g.attributes.uv && g.attributes.normal && !g.attributes.tangent) { try { g.computeTangents(); } catch (e) { o.material.normalScale.set(0.5, 0.5); } }
  });
}
/* S-127: tom de pele. As texturas do pacote têm todas o mesmo tom bronzeado/alaranjado; aqui geramos (uma vez) a versão
   clara (padrão) e a morena a partir dela, preservando os detalhes (poros, sombras). Vale para o rosto E para braços,
   mãos e pescoço da roupa (material "Regular"), que antes ficavam sempre escuros. */
const SKIN_TONE = { clara: { mode: 'screen', k: [0.36, 0.55, 0.6] }, escura: { mode: 'mult', k: [0.74, 0.7, 0.7] } };
const toneCache = new Map();
function tonedTexture(srcTex, tone) {
  if (!srcTex || !srcTex.image) return srcTex;
  const key = srcTex.uuid + tone; if (toneCache.has(key)) return toneCache.get(key);
  const img = srcTex.image, W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, W, H), a = d.data, T = SKIN_TONE[tone] || SKIN_TONE.clara;
  for (let i = 0; i < a.length; i += 4) for (let ch = 0; ch < 3; ch++) a[i + ch] = T.mode === 'screen' ? 255 - (255 - a[i + ch]) * T.k[ch] : a[i + ch] * T.k[ch];
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = srcTex.flipY; t.wrapS = srcTex.wrapS; t.wrapT = srcTex.wrapT; t.anisotropy = 4;
  toneCache.set(key, t); return t;
}
const skinMatCache = new Map();
function skinMaterial(mat, tone) { // um material por (material original, tom): compartilhado entre os personagens
  const key = mat.uuid + tone; if (skinMatCache.has(key)) return skinMatCache.get(key);
  const m = mat.clone(); m.map = tonedTexture(mat.map, tone); m.needsUpdate = true; skinMatCache.set(key, m); return m;
}
// liga uma malha com pele (SkinnedMesh) de outro arquivo ao esqueleto do personagem, pelos nomes dos ossos
function graft(src, root, skeleton) {
  const m = new THREE.SkinnedMesh(src.geometry, src.material);
  m.name = src.name; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  const byName = Object.fromEntries(skeleton.bones.map(b => [b.name, b]));
  const bones = src.skeleton.bones.map(b => byName[b.name]);
  if (bones.some(b => !b)) return null;
  src.parent && root.add(m);
  m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
  m.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
  return m;
}
/**
 * opts: { sex: 'm'|'f', outfit: 'patrulheiro'|'campones', hair, hairColor (#hex), skin: 'clara'|'escura', beard, hood }
 * Devolve { obj, root, anim (mixer com as animações), mats }
 */
export function makeHuman(opts = {}) {
  const dwarf = opts.race === 'anao';
  const sex = opts.sex === 'f' ? 'f' : 'm', outfit = HUMAN_OUTFITS[opts.outfit] || 'Ranger';
  const root = SkeletonUtils.clone(G[`out_${sex}_${outfit}`].scene);
  let skel = null; root.traverse(o => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
  root.traverse(o => { if (o.isMesh && /Head_Hood/.test(o.name)) o.visible = !!opts.hood; });
  const host = skel.bones[0].parent || root;
  const add = (srcScene, filter) => { const out = []; srcScene.traverse(o => { if (o.isSkinnedMesh && (!filter || filter(o))) { const m = graft(o, host, skel); if (m) out.push(m); } }); return out; };
  // cabeça (rosto + olhos) do corpo base, com o tom de pele escolhido
  const heads = add(G['base_' + sex].scene, o => !/Eyebrows/i.test(o.name));
  const tone = opts.skin === 'escura' ? 'escura' : 'clara';
  for (const h of heads) if (/SuperHero/i.test(h.name)) h.material = skinMaterial(h.material, tone);
  root.traverse(o => { if (o.isSkinnedMesh && o.material && /Regular/.test(o.material.name)) o.material = skinMaterial(o.material, tone); }); // braços, mãos e pescoço
  // sobrancelhas, cabelo e barba na cor escolhida
  const hairCol = new THREE.Color(opts.hairColor || '#4a2e1a');
  const tint = arr => arr.forEach(m => { m.material = m.material.clone(); m.material.color = hairCol.clone(); m.material.needsUpdate = true; });
  tint(add(G[sex === 'f' ? 'Eyebrows_Female' : 'Eyebrows_Regular'].scene));
  let hairKey = OLD_TO_HUMAN_HAIR[opts.hair] || opts.hair; if (hairKey === 'raspado' && sex === 'f') hairKey = 'raspadoF';
  const hairFile = hairKey === 'careca' ? null : (HUMAN_HAIRS[hairKey] ?? (sex === 'f' ? 'Hair_Long' : 'Hair_SimpleParted'));
  if (hairFile && !opts.hood) tint(add(G[hairFile].scene));
  if (opts.beard && sex === 'm') tint(add(G.Hair_Beard.scene));
  const obj = new THREE.Group(); obj.add(root);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  const upperClips = {}, UPPER_RE = /spine|neck|head|clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky/i;
  /* S-309: camada só do tronco/braços. O golpe gira o QUADRIL no clipe original; sem o quadril, a coluna sozinha girava demais
     sobre o quadril da corrida e os braços abriam "em avião". Aqui a rotação do quadril do golpe é assada dentro da spine_01
     (relativa ao quadril de repouso), então o peito fica virado como no golpe de verdade, com as pernas correndo por baixo. */
  const pelvisBone = skel.bones.find(b => b.name === 'pelvis'), pelvisRestInv = pelvisBone ? pelvisBone.quaternion.clone().invert() : null;
  const upperOf = (src, key) => {
    const c = src.clone(); c.name = key; c.tracks = c.tracks.filter(tk => UPPER_RE.test(tk.name.split('.')[0]) && !/position|scale/.test(tk.name));
    const pt = src.tracks.find(tk => tk.name === 'pelvis.quaternion'), si = c.tracks.findIndex(tk => tk.name === 'spine_01.quaternion');
    if (pt && si >= 0 && pelvisRestInv) {
      const st = c.tracks[si].clone(), pi = pt.createInterpolant(), qp = new THREE.Quaternion(), qs = new THREE.Quaternion(), v = st.values;
      for (let i = 0; i < st.times.length; i++) { const r = pi.evaluate(st.times[i]); qp.set(r[0], r[1], r[2], r[3]); qs.fromArray(v, i * 4); qp.premultiply(pelvisRestInv).multiply(qs).normalize(); qp.toArray(v, i * 4); }
      c.tracks[si] = st;
    }
    return c;
  };
  const anim = {
    name: '', cur: null,
    play(n, o = {}) { const list = animsFor(sex, dwarf), clip = THREE.AnimationClip.findByName(list, humanAnimName(n)) || THREE.AnimationClip.findByName(list, 'Idle_Loop'); if (!clip) return; const a = acts[clip.name] || (acts[clip.name] = mixer.clipAction(clip));
      if (this.cur === a && !o.restart && !o.once) { a.setEffectiveTimeScale(o.speed || 1); this.name = n; return; }
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once;
      if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.2, false); a.play(); this.cur = a; this.name = n; },
    update(dt) {
      /* S-329: o mixer do three.js só regrava um osso quando o valor da animação MUDA de um quadro para o outro. Em clipes com as
         pernas paradas (Pistol_*, guardas) ele deixava de regravar as coxas, e os ajustes feitos depois do mixer (postura da classe,
         giro de quadril, arco/besta, cabeça erguida) se SOMAVAM quadro a quadro — as pernas iam abrindo/girando até o absurdo.
         Agora cada osso volta à pose pura da animação do quadro anterior antes do mixer atualizar: nada acumula. */
      const B = this._bones || (this._bones = (() => { const l = []; root.traverse(o => { if (o.isBone) l.push(o); }); return l; })());
      const SQ = this._sq || (this._sq = B.map(b => b.quaternion.clone())), SP = this._sp || (this._sp = B.map(b => b.position.clone()));
      if (this._snapOk) for (let i = 0; i < B.length; i++) { B[i].quaternion.copy(SQ[i]); B[i].position.copy(SP[i]); }
      mixer.update(dt);
      for (let i = 0; i < B.length; i++) { SQ[i].copy(B[i].quaternion); SP[i].copy(B[i].position); }
      this._snapOk = true;
      // S-309: o golpe por cima da corrida some suave no fim (sem estalo de volta para a pose de correr)
      for (const [k, a] of Object.entries(acts)) { if (!k.startsWith('upr:') || !a.enabled || a._fading || a.getEffectiveWeight() <= 0) continue; const left = (a.getClip().duration - a.time) / Math.max(0.01, a.getEffectiveTimeScale()); if (left < 0.1) { a.fadeOut(Math.max(0.04, left)); a._fading = true; } }
    },
    /* S-236: golpe só no tronco e nos braços, somado por cima da corrida (as pernas continuam andando de verdade) */
    overlay(n, o = {}) {
      const list = animsFor(sex, dwarf), src = THREE.AnimationClip.findByName(list, humanAnimName(n)); if (!src) return;
      /* S-309: o golpe SUBSTITUI o tronco e os braços (camada normal, peso alto) em vez de somar deltas aditivos sobre a corrida e a guarda —
         a soma abria os braços "como boneco de posto" ao andar de lado. As pernas continuam com a corrida/ré. */
      const key = 'upr:' + src.name; let clip = upperClips[key];
      if (!clip) { clip = upperOf(src, key); upperClips[key] = clip; }
      for (const [k, b] of Object.entries(acts)) if (k.startsWith('upr:') && k !== key && b.enabled && !b._fading) { b.fadeOut(0.07); b._fading = true; } // golpe anterior cede suave ao novo (ASPD alto)
      const a = acts[key] || (acts[key] = mixer.clipAction(clip)); a.blendMode = THREE.NormalAnimationBlendMode;
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a._fading = false;
      a.setEffectiveWeight(6); a.fadeIn(Math.min(0.06, 0.25 / Math.max(1, o.speed || 1))); a.play();
    },
    /* postura de luta só no tronco e nos braços (guarda erguida) somada à corrida: entre um golpe e outro o boneco não volta "à paisana" */
    layer(n, w, dt) {
      const list = animsFor(sex, dwarf), src = n ? THREE.AnimationClip.findByName(list, humanAnimName(n)) : null, key = src ? 'ly:' + src.name : null;
      if (key && !upperClips[key]) upperClips[key] = upperOf(src, key);
      const k = Math.min(1, dt * 7), busy = Object.entries(acts).some(([nm, b]) => nm.startsWith('upr:') && b.enabled && b.getEffectiveWeight() > 0.3); // S-309: guarda some enquanto o golpe toca no tronco e volta suave depois
      for (const [name, a] of Object.entries(acts)) { if (!name.startsWith('ly:')) continue; const goal = name === key && !busy ? w : 0; a._lw = (a._lw || 0) + (goal - (a._lw || 0)) * k; if (a._lw < 0.01 && goal === 0) { a._lw = 0; if (a.isRunning()) a.stop(); continue; } a.setEffectiveWeight(a._lw); }
      if (key && w > 0) { const a = acts[key] || (acts[key] = mixer.clipAction(upperClips[key])); if (!a.isRunning()) { a._lw = a._lw || 0; a.setLoop(THREE.LoopRepeat); a.setEffectiveWeight(a._lw); a.play(); } }
    },
  };
  root.userData.human = true; root.userData.sex = sex;
  if (sex === 'f') feminize(skel);
  if (dwarf) applyDwarfBody(obj, root, skel); // S-178: anão de verdade, não um humano encolhido
  shareSkeletons(root);
  // volume fixo de 1,3 m em volta do corpo: o que está fora da tela (ou da sombra) não é desenhado
  const sph = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.3);
  root.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = true; o.boundingSphere = sph.clone(); o.computeBoundingSphere = function () { }; } });
  return { obj, root, anim, skeleton: skel };
}
