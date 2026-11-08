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

const Q = 'assets3d/quaternius/';
export const HUMAN_HAIRS = { curto: 'Hair_SimpleParted', raspado: 'Hair_Buzzed', raspadoF: 'Hair_BuzzedFemale', longo: 'Hair_Long', coque: 'Hair_Buns', careca: null };
export const HUMAN_OUTFITS = { patrulheiro: 'Ranger', campones: 'Peasant' };
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
    .then(() => { prepHeads(); prepMaterials(); return G; });
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
  const hairFile = HUMAN_HAIRS[opts.hair] ?? (sex === 'f' ? 'Hair_Long' : 'Hair_SimpleParted');
  if (hairFile && !opts.hood) tint(add(G[hairFile].scene));
  if (opts.beard && sex === 'm') tint(add(G.Hair_Beard.scene));
  const obj = new THREE.Group(); obj.add(root);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  const anim = {
    name: '', cur: null,
    play(n, o = {}) { const clip = THREE.AnimationClip.findByName(humanAnims(), n) || THREE.AnimationClip.findByName(humanAnims(), 'Idle_Loop'); if (!clip) return; const a = acts[clip.name] || (acts[clip.name] = mixer.clipAction(clip));
      if (this.cur === a && !o.restart && !o.once) { a.setEffectiveTimeScale(o.speed || 1); return; }
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once;
      if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.2, false); a.play(); this.cur = a; this.name = n; },
    update(dt) { mixer.update(dt); },
  };
  return { obj, root, anim, skeleton: skel };
}
