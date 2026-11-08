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
    .then(() => { prepHeads(); prepMaterials(); for (const k of Object.keys(G)) if (k.startsWith('out_')) mergeOutfit(G[k].scene); return G; });
  return loading;
}
export const humanAnims = () => (G.anims ? G.anims.animations : []);

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
const texCache = {};
function skinTexture(sex, tone) {
  const key = sex + tone; if (texCache[key]) return texCache[key];
  const f = sex === 'm' ? (tone === 'clara' ? 'T_Superhero_Male_Light.png' : 'T_Superhero_Male_Dark.png') : (tone === 'clara' ? 'T_Superhero_Female_Light_BaseColor.png' : 'T_Superhero_Female_Dark_BaseColor.png');
  const t = new THREE.TextureLoader().load(Q + 'base/' + f); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  return (texCache[key] = t);
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
  const sex = opts.sex === 'f' ? 'f' : 'm', outfit = HUMAN_OUTFITS[opts.outfit] || 'Ranger';
  const root = SkeletonUtils.clone(G[`out_${sex}_${outfit}`].scene);
  let skel = null; root.traverse(o => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
  root.traverse(o => { if (o.isMesh && /Head_Hood/.test(o.name)) o.visible = !!opts.hood; });
  const host = skel.bones[0].parent || root;
  const add = (srcScene, filter) => { const out = []; srcScene.traverse(o => { if (o.isSkinnedMesh && (!filter || filter(o))) { const m = graft(o, host, skel); if (m) out.push(m); } }); return out; };
  // cabeça (rosto + olhos) do corpo base, com o tom de pele escolhido
  const heads = add(G['base_' + sex].scene, o => !/Eyebrows/i.test(o.name));
  const skinT = skinTexture(sex, opts.skin || 'clara');
  for (const h of heads) if (/SuperHero/i.test(h.name)) { h.material = h.material.clone(); h.material.map = skinT; h.material.needsUpdate = true; }
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
  const anim = {
    name: '', cur: null,
    play(n, o = {}) { const clip = THREE.AnimationClip.findByName(humanAnims(), humanAnimName(n)) || THREE.AnimationClip.findByName(humanAnims(), 'Idle_Loop'); if (!clip) return; const a = acts[clip.name] || (acts[clip.name] = mixer.clipAction(clip));
      if (this.cur === a && !o.restart && !o.once) { a.setEffectiveTimeScale(o.speed || 1); this.name = n; return; }
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once;
      if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.2, false); a.play(); this.cur = a; this.name = n; },
    update(dt) { mixer.update(dt); },
  };
  root.userData.human = true;
  shareSkeletons(root);
  // volume fixo de 1,3 m em volta do corpo: o que está fora da tela (ou da sombra) não é desenhado
  const sph = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.3);
  root.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = true; o.boundingSphere = sph.clone(); o.computeBoundingSphere = function () { }; } });
  return { obj, root, anim, skeleton: skel };
}
