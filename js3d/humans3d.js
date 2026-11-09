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
    .then(() => { prepHeads(); prepMaterials(); for (const k of Object.keys(G)) if (k.startsWith('out_')) { if (k.startsWith('out_f_')) dropParts(G[k].scene, /Pauldron/); mergeOutfit(G[k].scene); } return G; });
  return loading;
}
export const humanAnims = () => (G.anims ? G.anims.animations : []);
/* S-127: as animações trazem a POSIÇÃO de todos os ossos (medidas do esqueleto masculino). No corpo feminino isso
   alarga ombros e quadris de homem. Para elas, usamos cópias das animações só com rotação (posição só na raiz/pélvis),
   e o esqueleto mantém as proporções femininas. */
const femClips = [];
const dwarfClips = { m: [], f: [] };
function animsFor(sex, dwarf) {
  const all = humanAnims();
  if (dwarf) { // S-178: anões sem trilhas de escala (as proporções de anão ficam nos ossos); elas também sem posição, como as mulheres
    const base = sex === 'f' ? animsFor('f') : all, out = dwarfClips[sex === 'f' ? 'f' : 'm'];
    if (out.length !== base.length) { out.length = 0; for (const c of base) out.push(new THREE.AnimationClip(c.name, c.duration, c.tracks.filter(t => !t.name.endsWith('.scale')))); }
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
/* S-178: corpo de ANÃO (proporções no espírito dos anões de MMO): cabeça grande, tronco largo e atarracado, braços grossos,
   pernas curtas e fortes, mãos e pés grandes. Tudo por escala nos ossos (as animações de anão não têm trilha de escala),
   e o corpo inteiro é alargado. Depois de encurtar as pernas, desce o boneco para os pés ficarem no chão. */
const DWARF_BONES = { // [fator no comprimento do osso, fator na grossura] — S-246: proporções suavizadas (antes ficava achatado e disforme)
  thigh_l: [0.84, 1.08], thigh_r: [0.84, 1.08], calf_l: [0.9, 1.04], calf_r: [0.9, 1.04], foot_l: [1.06, 1.05], foot_r: [1.06, 1.05],
  spine_01: [0.93, 1.07], spine_02: [0.96, 1.05], neck_01: [0.82, 1.04], // tronco um pouco mais curto e forte
  upperarm_l: [0.9, 1.06], upperarm_r: [0.9, 1.06], lowerarm_l: [0.94, 1.04], lowerarm_r: [0.94, 1.04], hand_l: [1.05, 1.05], hand_r: [1.05, 1.05],
};
function applyDwarfBody(obj, root, skel) {
  root.userData.dwarf = true;
  const by = n => skel.bones.find(b => b.name === n);
  humanIdlePose(root); const foot = by('foot_l') || by('ball_l'), before = new THREE.Vector3(), after = new THREE.Vector3(); if (foot) foot.getWorldPosition(before);
  for (const [n, [L, T]] of Object.entries(DWARF_BONES)) {
    const b = by(n); if (!b) continue;
    const ch = b.children.find(c => c.isBone); const ax = ch ? ch.position : new THREE.Vector3(0, 1, 0);
    const a = Math.abs(ax.x) >= Math.abs(ax.y) && Math.abs(ax.x) >= Math.abs(ax.z) ? 'x' : Math.abs(ax.y) >= Math.abs(ax.z) ? 'y' : 'z'; // eixo do comprimento do osso
    b.scale.set(a === 'x' ? L : T, a === 'y' ? L : T, a === 'z' ? L : T);
  }
  const head = by('Head'); if (head) head.scale.setScalar(1.13); // cabeça um pouco maior
  obj.scale.set(1.07, 0.97, 1.07); // robusto, sem achatar
  root.updateMatrixWorld(true);
  if (foot) { foot.getWorldPosition(after); root.position.y += (before.y * 0.95 - after.y) / 0.95; } // pés no chão
  root.userData.dwarfDrop = root.position.y;
}
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
  const anim = {
    name: '', cur: null,
    play(n, o = {}) { const list = animsFor(sex, dwarf), clip = THREE.AnimationClip.findByName(list, humanAnimName(n)) || THREE.AnimationClip.findByName(list, 'Idle_Loop'); if (!clip) return; const a = acts[clip.name] || (acts[clip.name] = mixer.clipAction(clip));
      if (this.cur === a && !o.restart && !o.once) { a.setEffectiveTimeScale(o.speed || 1); this.name = n; return; }
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once;
      if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.2, false); a.play(); this.cur = a; this.name = n; },
    update(dt) { mixer.update(dt); },
    /* S-236: golpe só no tronco e nos braços, somado por cima da corrida (as pernas continuam andando de verdade) */
    overlay(n, o = {}) {
      const list = animsFor(sex, dwarf), src = THREE.AnimationClip.findByName(list, humanAnimName(n)); if (!src) return;
      const key = 'up:' + src.name; let clip = upperClips[key];
      if (!clip) { clip = src.clone(); clip.name = key; clip.tracks = clip.tracks.filter(tk => UPPER_RE.test(tk.name.split('.')[0]) && !/position|scale/.test(tk.name)); THREE.AnimationUtils.makeClipAdditive(clip); upperClips[key] = clip; }
      const a = acts[key] || (acts[key] = mixer.clipAction(clip)); a.blendMode = THREE.AdditiveAnimationBlendMode;
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; a.setEffectiveWeight(1); a.play();
    },
    /* postura de luta só no tronco e nos braços (guarda erguida) somada à corrida: entre um golpe e outro o boneco não volta "à paisana" */
    layer(n, w, dt) {
      const list = animsFor(sex, dwarf), src = n ? THREE.AnimationClip.findByName(list, humanAnimName(n)) : null, key = src ? 'ly:' + src.name : null;
      if (key && !upperClips[key]) { const c = src.clone(); c.name = key; c.tracks = c.tracks.filter(tk => UPPER_RE.test(tk.name.split('.')[0]) && !/position|scale/.test(tk.name)); upperClips[key] = c; }
      const k = Math.min(1, dt * 7);
      for (const [name, a] of Object.entries(acts)) { if (!name.startsWith('ly:')) continue; const goal = name === key ? w : 0; a._lw = (a._lw || 0) + (goal - (a._lw || 0)) * k; if (a._lw < 0.01 && goal === 0) { a._lw = 0; if (a.isRunning()) a.stop(); continue; } a.setEffectiveWeight(a._lw); }
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
