/* =========================================================================
   CRÔNICAS DE AETHRA — PROTÓTIPO 3D (mundo aberto, controles estilo WoW)
   Usa as mesmas regras/dados do 2D (js/data.js + js/rules.js) e o mesmo save.
   ========================================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/SkeletonUtils.js';
import { ZONES, VILLAGE, LAKE, PLAY_LIMIT, heightAt, zoneAt, zoneWeight, roadDist, buildTerrain, buildWater, buildSky, buildGrass, groundColor, updateNature } from './world3d.js';
import { makeCritter } from './critters.js';
import { makePet } from './pets3d.js';
import { dress, CLASS_LOOKS } from './looks3d.js';
import { makeTreeTemplates } from './trees3d.js';

const TM = 1.6; // metros por "tile" do 2D (alcances e distâncias de regras)
const $ = id => document.getElementById(id);
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HAS_SRV = location.protocol.startsWith('http');
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry(4242);
const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

/* =========================== Cena =========================== */
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game3d'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const FOG_DAY = new THREE.Color('#cfe7ff'), FOG_RUINS = new THREE.Color('#6a6680'), FOG_FOREST = new THREE.Color('#a9c9b0');
scene.fog = new THREE.Fog(FOG_DAY.clone(), 60, 240);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
scene.add(new THREE.HemisphereLight('#d8ecff', '#5a6b3a', 1.1));
const sun = new THREE.DirectionalLight('#fff1d0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 200 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sky = buildSky(); scene.add(sky);
const terrain = buildTerrain(); scene.add(terrain);
scene.add(buildWater());
scene.add(buildGrass(mulberry(99)));

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

/* =========================== Modelos =========================== */
const C = 'assets3d/characters/', SK = 'assets3d/skeletons/', W = 'assets3d/world/';
const ASSETS = {
  Knight: C + 'Knight.glb', Mage: C + 'Mage.glb', Barbarian: C + 'Barbarian.glb', Rogue: C + 'Rogue.glb', Rogue_Hooded: C + 'Rogue_Hooded.glb',
  Skeleton_Warrior: SK + 'Skeleton_Warrior.glb', Skeleton_Mage: SK + 'Skeleton_Mage.glb', Skeleton_Minion: SK + 'Skeleton_Minion.glb',
  sk_blade: SK + 'itens/Skeleton_Blade.gltf', sk_staff: SK + 'itens/Skeleton_Staff.gltf', sk_axe: SK + 'itens/Skeleton_Axe.gltf', sk_shield: SK + 'itens/Skeleton_Shield_Large_A.gltf',
  home_A: W + 'blue/building_home_A_blue.gltf', home_B: W + 'blue/building_home_B_blue.gltf', home_A_red: W + 'red/building_home_A_red.gltf', home_B_red: W + 'red/building_home_B_red.gltf',
  tavern: W + 'blue/building_tavern_blue.gltf', blacksmith: W + 'blue/building_blacksmith_blue.gltf', market: W + 'red/building_market_red.gltf', church: W + 'blue/building_church_blue.gltf',
  windmill: W + 'blue/building_windmill_blue.gltf', well: W + 'blue/building_well_blue.gltf', tower: W + 'blue/building_tower_A_blue.gltf',
  destroyed: W + 'neutral/building_destroyed.gltf', wall: W + 'neutral/wall_straight.gltf', wall_corner: W + 'neutral/wall_corner_A_outside.gltf',
  fence: W + 'neutral/fence_wood_straight.gltf', scaffold: W + 'neutral/building_scaffolding.gltf',
  tree_A: W + 'nature/tree_single_A.gltf', tree_B: W + 'nature/tree_single_B.gltf', trees_A_m: W + 'nature/trees_A_medium.gltf', trees_B_m: W + 'nature/trees_B_medium.gltf',
  trees_A_l: W + 'nature/trees_A_large.gltf', trees_B_l: W + 'nature/trees_B_large.gltf', stump: W + 'nature/trees_A_cut.gltf',
  rock_A: W + 'nature/rock_single_A.gltf', rock_B: W + 'nature/rock_single_B.gltf', rock_C: W + 'nature/rock_single_C.gltf', rock_D: W + 'nature/rock_single_D.gltf', rock_E: W + 'nature/rock_single_E.gltf',
  mountain_A: W + 'nature/mountain_A_grass_trees.gltf', mountain_B: W + 'nature/mountain_B_grass_trees.gltf', mountain_C: W + 'nature/mountain_C_grass.gltf',
  cloud: W + 'nature/cloud_big.gltf', cloud_s: W + 'nature/cloud_small.gltf', lily: W + 'nature/waterlily_A.gltf',
  barrel: W + 'props/barrel.gltf', crate_A: W + 'props/crate_A_big.gltf', crate_B: W + 'props/crate_B_small.gltf', sack: W + 'props/sack.gltf', wheelbarrow: W + 'props/wheelbarrow.gltf',
  flag_blue: W + 'props/flag_blue.gltf', flag_red: W + 'props/flag_red.gltf', tent: W + 'props/tent.gltf', weaponrack: W + 'props/weaponrack.gltf', lumber: W + 'props/resource_lumber.gltf', bucket: W + 'props/bucket_water.gltf', target_prop: W + 'props/target.gltf',
};
const MODELS = {};
async function loadAll() {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  const names = Object.keys(ASSETS);
  let done = 0;
  await Promise.all(names.map(n => new Promise(res => loader.load(ASSETS[n], g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    MODELS[n] = g; done++; $('ld-bar').style.width = (done / names.length * 100) + '%'; $('ld-txt').textContent = `Carregando o mundo... ${done}/${names.length}`; res();
  }, undefined, err => { console.warn('Falha ao carregar', n, err); done++; res(); }))));
}

/* escala do cenário: a casa vira ~6,5 m e todo o pacote medieval segue a mesma proporção */
let WS = 1;
const bboxCache = {};
function bbox(name) {
  if (!bboxCache[name]) { const b = new THREE.Box3().setFromObject(MODELS[name].scene); bboxCache[name] = b; }
  return bboxCache[name];
}
const colliders = [];
function freeAt(x, z, r) { return !colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + r); }
const TYPE_SCALE = { tower: 0.6, tent: 0.55, well: 0.7, windmill: 0.9, barrel: 0.55, crate_A: 0.55, crate_B: 0.55, sack: 0.55, wheelbarrow: 0.55, weaponrack: 0.55, lumber: 0.5, bucket: 0.55, target_prop: 0.55, flag_blue: 0.6, flag_red: 0.6, fence: 0.75, market: 0.85 };
const occluders = []; // objetos que bloqueiam a câmera
const placed = []; // todos os objetos de cenário (sugestões identificam o modelo)
function place(name, x, z, o = {}) {
  const g = MODELS[name]; if (!g) return null;
  const obj = g.scene.clone(true);
  const native = !!g.native; // árvores feitas em código já estão em metros
  const s = (native ? 1 : WS) * (o.scale || 1) * (TYPE_SCALE[name] || 1);
  obj.scale.setScalar(s);
  obj.rotation.y = o.rot ?? rng() * Math.PI * 2;
  obj.position.set(x, (o.y ?? heightAt(x, z)) - (o.sink || 0), z);
  scene.add(obj);
  obj.userData.asset = name; placed.push(obj);
  if (/^(mountain|cloud)/.test(name)) obj.traverse(m => { if (m.isMesh) m.castShadow = false; });
  if (o.solid !== false && !/^(fence|flag|lily|cloud)/.test(name)) occluders.push(obj);
  if (o.solid !== false) {
    const b = bbox(name);
    const r = o.r ?? (native && g.radius ? g.radius * s : Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 * s * (o.rf || 0.75));
    colliders.push({ x, z, r, name });
  }
  return obj;
}

/* =========================== Montagem do mundo =========================== */
const clouds = [];
function buildWorld() {
  const hb = bbox('home_A'); WS = 6.5 / Math.max(0.01, hb.max.y - hb.min.y);
  const V = VILLAGE;
  // vila: poço no centro, casas em anel virado para a praça (a leste fica a saída da estrada)
  place('well', V.x, V.z, { rot: 0, rf: 0.6 });
  const ring = [['tavern', 160, 23], ['home_A', 200, 22], ['home_B', 235, 22], ['blacksmith', 270, 23], ['home_A_red', 305, 23], ['church', 120, 25], ['home_B_red', 85, 22], ['market', 50, 22]];
  for (const [n, deg, r] of ring) {
    const a = deg * Math.PI / 180, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
    place(n, x, z, { rot: Math.atan2(V.x - x, V.z - z), rf: 0.62 });
  }
  place('windmill', V.x - 34, V.z - 26, { rf: 0.4 });
  place('tower', V.x + 22, V.z - 9, { rf: 0.5 }); place('tower', V.x + 22, V.z + 14, { rf: 0.5 });
  place('flag_blue', V.x + 18, V.z - 6, { solid: false }); place('flag_blue', V.x + 18, V.z + 11, { solid: false });
  // feira e enfeites
  const props = [['barrel', 6, -9], ['barrel', 7, -8], ['crate_A', 9, -10], ['sack', 5, -11], ['wheelbarrow', -9, 7], ['tent', 11, 9], ['weaponrack', -12, -4], ['lumber', -14, 10], ['bucket', 2, 3], ['crate_B', 10, 11], ['target_prop', -6, -14], ['flag_red', 12, -12]];
  for (const [n, dx, dz] of props) place(n, V.x + dx, V.z + dz, { rf: 0.6 });
  // cerca ao redor da vila (com aberturas para as estradas)
  for (let deg = 0; deg < 360; deg += 9) {
    if (deg < 22 || deg > 345) continue; // saída leste
    const a = deg * Math.PI / 180, x = V.x + Math.cos(a) * 33, z = V.z + Math.sin(a) * 33;
    place('fence', x, z, { rot: -a, rf: 0.35 });
  }
  // natureza
  const scatter = (zoneId, list, n, minW, gap, extra = {}) => {
    let placed = 0;
    for (let k = 0; k < n * 25 && placed < n; k++) {
      const zn = ZONES.find(q => q.id === zoneId);
      const x = zn.x + (rng() * 2 - 1) * zn.r * 1.25, z = zn.z + (rng() * 2 - 1) * zn.r * 1.25;
      if (Math.abs(x) > PLAY_LIMIT - 4 || Math.abs(z) > PLAY_LIMIT - 4) continue;
      if (zoneWeight(zoneId, x, z) < minW) continue;
      if (roadDist(x, z) < 5 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3 || Math.hypot(x - V.x, z - V.z) < 36) continue;
      if (!freeAt(x, z, gap)) continue;
      const name = list[Math.floor(rng() * list.length)];
      place(name, x, z, { scale: (extra.s0 || 0.9) + rng() * (extra.s1 || 0.4), rf: extra.rf || 0.35 });
      placed++;
    }
  };
  // árvores feitas em código (mais naturais que os pinheiros pontudos do pacote)
  for (const [k, v] of Object.entries(makeTreeTemplates())) MODELS[k] = { ...v, native: true };
  scatter('campos', ['oak_0', 'oak_1', 'oak_2', 'oak_3', 'oak_4', 'oak_1', 'pine_0', 'pine_1'], 60, 0.45, 5, { s0: 0.85, s1: 0.4 });
  scatter('campos', ['rock_A', 'rock_B', 'rock_C'], 22, 0.4, 3, { s0: 0.8, s1: 0.8, rf: 0.6 });
  scatter('floresta', ['pinedark_0', 'pinedark_1', 'pinedark_2', 'pinedark_3', 'pine_2', 'pine_3', 'pine_4', 'oakdark_0', 'oakdark_1', 'oakdark_2'], 150, 0.4, 3.4, { s0: 0.85, s1: 0.5 });
  scatter('floresta', ['rock_D', 'rock_E'], 18, 0.4, 3, { rf: 0.6 });
  scatter('ruinas', ['rock_A', 'rock_C', 'rock_D', 'rock_E', 'stump'], 45, 0.35, 3, { s0: 0.9, s1: 1, rf: 0.6 });
  // ruínas: prédios destruídos e muros quebrados
  const R = ZONES.find(q => q.id === 'ruinas');
  const ruinBits = [['destroyed', -14, -6], ['destroyed', 12, -16], ['destroyed', 20, 8], ['scaffold', -22, 12], ['destroyed', -8, -26], ['tower', 2, -30]];
  for (const [n, dx, dz] of ruinBits) place(n, R.x + dx, R.z + dz, { rf: 0.55, sink: n === 'tower' ? 2.5 : 0 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.15) continue; // abertura ao sul (estrada)
    if (rng() < 0.3) continue; // muro em pedaços
    const x = R.x + Math.cos(a) * 30, z = R.z + Math.sin(a) * 30;
    place(i % 4 === 0 ? 'wall_corner' : 'wall', x, z, { rot: -a + Math.PI / 2, rf: 0.45, sink: rng() * 0.8 });
  }
  // lago: vitórias-régias
  for (let i = 0; i < 8; i++) { const a = rng() * 6.28, r = rng() * LAKE.r * 0.8; place('lily', LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r, { y: LAKE.level + 0.02, solid: false, scale: 1.5 }); }
  // montanhas na borda do mundo
  for (let t = -140; t <= 140; t += 18) for (const [x, z] of [[t, -140], [t, 140], [-140, t], [140, t]]) {
    const n = ['mountain_A', 'mountain_B', 'mountain_C'][Math.floor(rng() * 3)];
    place(n, x + (rng() - 0.5) * 8, z + (rng() - 0.5) * 8, { scale: 2.6 + rng() * 1.4, solid: false, sink: 2 });
  }
  // nuvens
  for (let i = 0; i < 16; i++) {
    const c = place(rng() < 0.6 ? 'cloud' : 'cloud_s', (rng() * 2 - 1) * 160, (rng() * 2 - 1) * 160, { y: 48 + rng() * 22, scale: 3 + rng() * 3, solid: false });
    if (c) { c.traverse(o => { if (o.isMesh) o.castShadow = false; }); clouds.push(c); }
  }
}

/* =========================== Personagens animados =========================== */
const ACCESSORIES = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Mage_Hat', 'Mage_Cape'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Barbarian_Cape'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'],
  Rogue_Hooded: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'],
};
class Anim {
  constructor(root, clips) { this.mixer = new THREE.AnimationMixer(root); this.clips = clips; this.acts = {}; this.cur = null; this.name = ''; }
  act(n) { if (!this.acts[n]) { const c = THREE.AnimationClip.findByName(this.clips, n); if (!c) return null; this.acts[n] = this.mixer.clipAction(c); } return this.acts[n]; }
  play(n, o = {}) {
    const a = this.act(n) || this.act('Idle'); if (!a) return;
    if (this.cur === a && !o.once && !o.restart) { a.setEffectiveTimeScale(o.speed || 1); return; }
    a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setEffectiveWeight(1);
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once;
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.18, false);
    a.play(); this.cur = a; this.name = n;
  }
  update(dt) { this.mixer.update(dt); }
}
// escala única: todos os modelos KayKit têm o mesmo esqueleto, então usamos a altura do CORPO do
// Cavaleiro (sem elmo/chapéu/capa) como referência. Antes cada modelo era medido com seus acessórios,
// e quem não tinha chapéu (Arqueiro, Ladino...) ficava gigante.
let CHAR_SCALE = 0;
function charScale() {
  if (CHAR_SCALE) return CHAR_SCALE;
  const sc = MODELS.Knight.scene; sc.updateMatrixWorld(true);
  const box = new THREE.Box3();
  sc.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && /_(Body|Head|LegLeft|LegRight|ArmLeft|ArmRight)$/.test(o.name)) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  CHAR_SCALE = 1.8 / Math.max(0.01, box.max.y - box.min.y);
  return CHAR_SCALE;
}
function makeChar(model, show, height = 1.8) {
  const g = MODELS[model];
  const root = SkeletonUtils.clone(g.scene);
  const acc = ACCESSORIES[model];
  if (acc && show) root.traverse(o => { if (acc.includes(o.name)) o.visible = show.includes(o.name); });
  root.scale.setScalar(charScale() * height / 1.8);
  const wrap = new THREE.Group(); wrap.add(root);
  return { obj: wrap, root, anim: new Anim(root, g.animations) };
}
function attach(root, item, hand = 'r') {
  const bone = root.getObjectByName('handslot' + hand) || root.getObjectByName('handslot.' + hand);
  if (bone && MODELS[item]) bone.add(MODELS[item].scene.clone(true));
}
const ATTACK_ANIM = { '1h': ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'], '2h': ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop'], dual: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'], ranged: ['2H_Ranged_Shoot'], cast: ['2H_Melee_Attack_Chop'] };

/* =========================== Estado =========================== */
const S = {
  time: 0, paused: false, god: false, started: false,
  p: null, orig: null, // personagem (mesmo formato do save do 2D) e o save original
  me: null, // { obj, root, anim, look }
  pos: { x: VILLAGE.x + 6, z: VILLAGE.z + 2, y: 0, vy: 0, yaw: Math.PI / 2, ground: true },
  cam: { yaw: Math.PI / 2, pitch: 0.32, dist: 9, distT: 9 },
  target: null, autoAttack: false, nextAttack: 0, lockAnim: 0, casting: null, sitting: false,
  monsters: [], npcs: [], projectiles: [], fx: [], timers: [], floaters: [],
  zone: null, lastMsg: {}, lastSave: 0, uid: 1,
};
Object.defineProperty(S, 'god', { get: () => G.god, set: v => { G.god = v; } });
Object.defineProperty(S, 'paused', { get: () => G.paused, set: v => { G.paused = v; } });
const later = (sec, fn) => S.timers.push({ at: S.time + sec, fn });
const hitboxes = [];
function hitbox(ref, r, h) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  m.position.y = h / 2; m.userData.ref = ref; hitboxes.push(m); return m;
}

/* =========================== Monstros =========================== */
const SPAWNS = [
  ['campos', 'gotinha', 10], ['campos', 'fungolino', 8], ['campos', 'coelho_chifre', 6], ['campos', 'abelha_rubra', 4], ['campos', 'gosmao', 1],
  ['floresta', 'lobo_cinzento', 9], ['floresta', 'abelha_rubra', 3], ['floresta', 'lobo_alfa', 1],
  ['ruinas', 'esqueleto_vigia', 7], ['ruinas', 'cavaleiro_caido', 3], ['ruinas', 'espectro', 3],
];
function spawnPoint(zoneId) {
  const zn = ZONES.find(q => q.id === zoneId);
  for (let k = 0; k < 60; k++) {
    const x = zn.x + (rng() * 2 - 1) * zn.r, z = zn.z + (rng() * 2 - 1) * zn.r;
    if (Math.abs(x) > PLAY_LIMIT - 6 || Math.abs(z) > PLAY_LIMIT - 6) continue;
    if (zoneWeight(zoneId, x, z) < 0.5 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 40) continue;
    if (!freeAt(x, z, 1.2)) continue;
    return { x, z };
  }
  return { x: zn.x, z: zn.z };
}
function monsterVisual(m) {
  const d = m.def;
  if (d.shape === 'skeleton' || d.shape === 'knight' || d.shape === 'ghost') {
    const model = d.shape === 'ghost' ? 'Skeleton_Mage' : 'Skeleton_Warrior';
    const ch = makeChar(model, null, 1.85 * (d.shape === 'knight' ? 1.18 : 1));
    if (d.shape === 'ghost') attach(ch.root, 'sk_staff', 'r');
    else if (d.shape === 'knight') { attach(ch.root, 'sk_axe', 'r'); attach(ch.root, 'sk_shield', 'l'); }
    else attach(ch.root, 'sk_blade', 'r');
    if (d.shape === 'ghost') ch.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.7; o.material.emissive = new THREE.Color('#5a7aff'); o.material.emissiveIntensity = 0.35; } });
    if (d.shape === 'knight') ch.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); } });
    ch.anim.play('Idle');
    return { ...ch, kind: 'skel', height: 1.9 * (d.shape === 'knight' ? 1.18 : 1), radius: 0.55 };
  }
  const cr = makeCritter(d.shape, d.color, d.mini || d.boss);
  const s = Math.max(0.6, d.size) * (d.shape === 'blob' ? 1.1 : 1);
  cr.root.scale.setScalar(s);
  const obj = new THREE.Group(); obj.add(cr.root);
  const h = (d.shape === 'bee' ? 1.4 : d.shape === 'wolf' ? 1.1 : 0.9) * s;
  return { obj, critter: cr, kind: 'critter', height: h, radius: 0.45 * s };
}
function spawnMonster(zoneId, type, at) {
  const def = MONSTERS[type]; if (!def) return;
  const pt = at || spawnPoint(zoneId);
  const m = { uid: S.uid++, type, def, zoneId, hp: def.hp, maxHp: def.hp, x: pt.x, z: pt.z, yaw: rng() * 6.28, home: { ...pt }, aggro: false, returning: false, wander: null, nextThink: rng() * 3, nextAttack: 0, status: {}, dead: false, lockAnim: 0, moving: false, stolen: false };
  const v = monsterVisual(m);
  Object.assign(m, { vis: v, obj: v.obj, radius: v.radius, height: v.height });
  m.obj.add(hitbox(m, Math.max(0.5, v.radius + 0.15), v.height + 0.2));
  m.obj.position.set(m.x, heightAt(m.x, m.z), m.z);
  scene.add(m.obj);
  S.monsters.push(m);
}
function monAnim(m, name, o) { if (m.vis.anim) m.vis.anim.play(name, o); }

function updateMonster(m, dt) {
  const t = S.time, d = m.def, P = S.pos;
  if (m.vis.anim) m.vis.anim.update(dt);
  if (m.dead) {
    const k = t - m.deathT;
    if (m.vis.kind === 'critter') { const s = Math.max(0.01, 1 - k * 1.5); m.vis.critter.root.scale.setScalar(Math.max(0.6, d.size) * s); }
    else if (k > 2.2) m.obj.position.y -= dt * 0.6;
    if (k > 4) {
      scene.remove(m.obj); S.monsters.splice(S.monsters.indexOf(m), 1);
      const hi = hitboxes.findIndex(h => h.userData.ref === m); if (hi >= 0) hitboxes.splice(hi, 1);
    }
    return;
  }
  // estados
  if (m.status.poison && m.status.poison.until > t && t >= m.status.poison.next) { m.status.poison.next = t + 1; hurtMonster(m, { dmg: Math.max(2, Math.floor(m.status.poison.dmg)) }, 'veneno'); if (m.dead) return; }
  const frozen = m.status.freeze > t, stunned = m.status.stun > t;
  if (m.vis.critter) m.vis.critter.root.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.set(frozen ? '#2a5aa0' : '#000000'); });
  if (frozen || stunned) { m.moving = false; if (m.vis.critter) m.vis.critter.animate(t, false, dt); return; }
  const dp = Math.hypot(P.x - m.x, P.z - m.z);
  const safe = zoneAt(P.x, P.z).safe;
  if (!m.aggro && d.aggressive && !S.p.dead && !S.god && !safe && dp < d.aggroRange * TM * 1.3) { m.aggro = true; m.returning = false; }
  if (m.aggro && (S.p.dead || safe || Math.hypot(m.x - m.home.x, m.z - m.home.z) > 38 || (S.god && !m.hitByPlayer))) { m.aggro = false; m.returning = true; m.hp = m.maxHp; }
  let goal = null, speed = d.speed / 32 * TM;
  if (m.aggro) {
    const reach = d.range * TM + m.radius + 0.7;
    if (dp > reach) { goal = { x: P.x, z: P.z }; speed *= 1.25; }
    else {
      m.yaw = angLerp(m.yaw, Math.atan2(P.x - m.x, P.z - m.z), Math.min(1, dt * 10));
      if (t >= m.nextAttack && t >= m.lockAnim) { m.nextAttack = t + d.aspd / 1000; monsterAttack(m); }
    }
  } else if (m.returning) {
    goal = m.home; speed *= 1.4;
    if (Math.hypot(m.x - m.home.x, m.z - m.home.z) < 1.5) m.returning = false;
  } else {
    if (t >= m.nextThink) { m.nextThink = t + 2 + rng() * 5; m.wander = rng() < 0.6 ? { x: m.home.x + (rng() * 2 - 1) * 8, z: m.home.z + (rng() * 2 - 1) * 8 } : null; }
    if (m.wander) { goal = m.wander; speed *= 0.5; if (Math.hypot(m.x - m.wander.x, m.z - m.wander.z) < 0.6) m.wander = null; }
  }
  m.moving = false;
  if (goal && t >= m.lockAnim) {
    const ang = Math.atan2(goal.x - m.x, goal.z - m.z);
    m.yaw = angLerp(m.yaw, ang, Math.min(1, dt * 8));
    const nx = m.x + Math.sin(ang) * speed * dt, nz = m.z + Math.cos(ang) * speed * dt;
    const r = resolve(nx, nz, m.radius);
    m.x = r.x; m.z = r.z; m.moving = true;
  }
  m.obj.position.set(m.x, heightAt(m.x, m.z), m.z);
  m.obj.rotation.y = m.yaw;
  if (m.vis.critter) m.vis.critter.animate(t, m.moving, dt);
  else if (t >= m.lockAnim) monAnim(m, m.moving ? (m.aggro || m.returning ? 'Running_C' : 'Walking_D_Skeletons') : (m.aggro ? 'Idle_Combat' : 'Idle'));
}
function monsterAttack(m) {
  const d = m.def;
  if (m.vis.anim) { monAnim(m, d.shape === 'ghost' ? 'Spellcast_Shoot' : (d.shape === 'knight' ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop'), { once: true, restart: true }); m.lockAnim = S.time + 0.7; }
  else { const r = m.vis.critter.root; r.position.z = 0.3; later(0.15, () => { r.position.z = 0; }); }
  if (d.range > 2) shoot(m.obj.position.clone().add(new THREE.Vector3(0, 1.4, 0)), () => S.me.obj.position.clone().add(new THREE.Vector3(0, 1.1, 0)), ELEMENTS[d.element].color, () => monsterHit(m));
  else later(0.35, () => { if (!m.dead && Math.hypot(S.pos.x - m.x, S.pos.z - m.z) < d.range * TM + m.radius + 1.6) monsterHit(m); });
}
function monsterHit(m) {
  const p = S.p, d = m.def; if (p.dead) return;
  if (Math.random() * 100 >= clamp(80 + d.hit - p.d.flee, 5, 95)) { floatAt(S.me.obj.position, 'Esquivou', '#cfe8ff', 1.9); Sound.play('miss'); return; }
  hurtPlayer(m, randInt(d.atk[0], d.atk[1]));
}
function hurtPlayer(m, raw) {
  const p = S.p;
  if (S.god) { floatAt(S.me.obj.position, 'Imune', '#ffd76a', 2); return; }
  let dmg = raw * 100 / (100 + p.d.def);
  dmg *= 1 - Math.min(80, p.d.resist[m.def.element] || 0) / 100;
  if (p.pet && PETS[p.pet.species].role === 'guardiao' && petNear()) dmg *= 1 - petPower(p.pet).guard / 100;
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg; S.sitting = false;
  floatAt(S.me.obj.position, '-' + dmg, '#ff5a5a', 2.1);
  Sound.play('hurt');
  if (!S.casting && S.time >= S.lockAnim && !moveInput().any) { S.me.anim.play('Hit_A', { once: true, restart: true, fade: 0.08 }); S.lockAnim = S.time + 0.35; }
  if (p.hp <= 0) { p.hp = 0; playerDie(); }
}
function hurtMonster(m, res, elem) {
  if (m.dead) return;
  const p = S.p;
  if (res.miss) { floatAt(m.obj.position, 'Errou', '#cfd6e0', m.height + 0.4); Sound.play('miss'); m.aggro = true; m.hitByPlayer = true; return; }
  m.hp -= res.dmg; m.aggro = true; m.returning = false; m.hitByPlayer = true;
  const strong = elem && elem !== 'neutro' && elem !== 'veneno' && elementMult(elem, m.def.element) > 1;
  floatAt(m.obj.position, res.dmg, res.crit ? '#ffe36a' : strong ? '#ffb070' : elem === 'veneno' ? '#9be36a' : '#ffffff', m.height + 0.4, res.crit);
  Sound.play(res.crit ? 'crit' : 'hit');
  if (m.vis.critter) { const r = m.vis.critter.root, s0 = r.scale.x; r.scale.setScalar(s0 * 1.15); later(0.08, () => r.scale.setScalar(s0)); }
  else if (S.time >= m.lockAnim) { monAnim(m, 'Hit_A', { once: true, restart: true, fade: 0.05 }); m.lockAnim = S.time + 0.3; }
  if (p.d.lifesteal) p.hp = Math.min(p.d.maxHp, p.hp + Math.floor(res.dmg * p.d.lifesteal / 100));
  if (m.hp <= 0) killMonster(m);
}
function killMonster(m) {
  const d = m.def, p = S.p;
  m.dead = true; m.deathT = S.time; m.hp = 0;
  if (m.vis.anim) monAnim(m, 'Death_C_Skeletons', { once: true, fade: 0.1 });
  Sound.play('mdie');
  gainExp(d.exp, d.jexp);
  for (const [id, rate] of d.drops) if (Math.random() < rate * CONFIG.DROP_RATE) { addItem(p, id, 1); log(`Saque: ${ITEMS[id].icon} ${ITEMS[id].name}`, 'item'); }
  if (Math.random() < (d.cardRate ?? CONFIG.CARD_DROP_RATE)) {
    addItem(p, 'carta_' + m.type, 1); Sound.play('card');
    banner('✨ Uma carta caiu! ✨', ITEMS['carta_' + m.type].name.toUpperCase());
    log(`✨ Você obteve ${ITEMS['carta_' + m.type].name}!`, 'card');
  }
  if (S.target === m) { S.target = null; S.autoAttack = false; }
  later(d.respawn ? d.respawn / 1000 : CONFIG.RESPAWN_MIN + rng() * (CONFIG.RESPAWN_MAX - CONFIG.RESPAWN_MIN), () => spawnMonster(m.zoneId, m.type));
  hudDirty = true;
}

/* =========================== NPCs =========================== */
const NPC3D = [
  { id: 'ivra', name: 'Mestra Ivra', title: 'Mentora de Classes', model: 'Mage', show: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'], dx: -8, dz: -6 },
  { id: 'bento', name: 'Bento', title: 'Mercador', model: 'Barbarian', show: ['Mug', 'Barbarian_Hat'], dx: 9, dz: -7 },
  { id: 'clara', name: 'Irmã Clara', title: 'Curandeira', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], dx: -7, dz: 7 },
  { id: 'tobias', name: 'Guarda Tobias', title: 'Guia da Vila', model: 'Knight', show: ['1H_Sword', 'Rectangle_Shield', 'Knight_Helmet', 'Knight_Cape'], dx: 15, dz: 2 },
];
function spawnNpcs() {
  for (const n of NPC3D) {
    const ch = makeChar(n.model, n.show);
    const x = VILLAGE.x + n.dx, z = VILLAGE.z + n.dz;
    ch.obj.position.set(x, heightAt(x, z), z);
    ch.obj.rotation.y = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
    ch.anim.play(n.id === 'bento' ? 'Idle' : 'Idle', { speed: 0.8 + rng() * 0.4 });
    const npc = { ...n, x, z, ...ch, isNpc: true, height: 1.9, radius: 0.5 };
    ch.obj.add(hitbox(npc, 0.6, 2));
    scene.add(ch.obj); colliders.push({ x, z, r: 0.6 });
    S.npcs.push(npc);
  }
}

/* =========================== Jogador =========================== */
function buildPlayerModel() {
  if (S.me) scene.remove(S.me.obj);
  const L = CLASS_LOOKS[S.p.cls] || CLASS_LOOKS.aprendiz;
  const ch = makeChar(L.outfit, L.show);
  const d = dress(ch, S.p.cls, MODELS, (S.p.look && S.p.look.head) || 'Knight');
  S.me = { ...ch, look: { model: L.outfit, show: L.show, style: d.style }, lookFx: d.update };
  scene.add(ch.obj);
  ch.anim.play('Idle');
}
const keys = {};
const mouse = { left: false, right: false, moved: 0, x: 0, y: 0 };
function moveInput() {
  const k = keys;
  let fwd = 0, strafe = 0, turn = 0;
  if (k.w || k.arrowup || (mouse.left && mouse.right)) fwd += 1;
  if (k.s || k.arrowdown) fwd -= 1;
  const L = k.a || k.arrowleft, R = k.d || k.arrowright;
  if (mouse.right) { if (L) strafe -= 1; if (R) strafe += 1; } else { if (L) turn += 1; if (R) turn -= 1; }
  if (k.q_strafe) strafe -= 1;
  return { fwd, strafe, turn, any: !!(fwd || strafe) };
}
function resolve(x, z, r) {
  for (let it = 0; it < 2; it++) for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
    if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
  }
  x = clamp(x, -PLAY_LIMIT, PLAY_LIMIT); z = clamp(z, -PLAY_LIMIT, PLAY_LIMIT);
  return { x, z };
}
function updatePlayer(dt) {
  const p = S.p, P = S.pos, me = S.me, t = S.time;
  me.anim.update(dt);
  if (me.lookFx) me.lookFx(t);
  if (p.dead) return;
  // buffs e regeneração
  for (const id in p.buffs) if (p.buffs[id].until <= t) { delete p.buffs[id]; recalc(p); log(`${SKILLS[id].name} terminou.`); hudDirty = true; }
  S.regenHp = (S.regenHp || 0) + dt; S.regenSp = (S.regenSp || 0) + dt;
  if (S.regenHp >= (S.sitting ? 3 : 6)) { S.regenHp = 0; p.hp = Math.min(p.d.maxHp, p.hp + Math.max(1, Math.floor(p.d.maxHp / 60 + p.d.vit / 4)) + p.d.hpRegen); }
  if (S.regenSp >= (S.sitting ? 4 : 8)) { S.regenSp = 0; p.sp = Math.min(p.d.maxSp, p.sp + Math.max(1, Math.floor(p.d.maxSp / 50 + p.d.int / 5)) + p.d.spRegen); }
  if (S.god) { p.hp = p.d.maxHp; p.sp = p.d.maxSp; }
  // movimento
  const mi = moveInput();
  P.yaw += mi.turn * 2.6 * dt;
  if (mi.turn && !mouse.left) S.cam.yaw = angLerp(S.cam.yaw, P.yaw, Math.min(1, dt * 20));
  else if (mi.any && !mouse.left && !mouse.right) S.cam.yaw = angLerp(S.cam.yaw, P.yaw, Math.min(1, dt * 3));
  if ((mi.any || mi.turn) && S.sitting) S.sitting = false;
  if (mi.any && S.casting) { S.casting = null; log('Conjuração cancelada.', 'warn'); $('castbar3d').classList.add('hidden'); }
  const base = p.d.speed / 32 * TM * 1.1 * (S.god ? 1.8 : 1);
  const inLake = Math.hypot(P.x - LAKE.x, P.z - LAKE.z) < LAKE.r - 1;
  let vx = 0, vz = 0;
  if (mi.any && !S.casting) {
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
    let dx = fx * mi.fwd + rx * mi.strafe, dz = fz * mi.fwd + rz * mi.strafe; const l = Math.hypot(dx, dz) || 1;
    const sp = base * (mi.fwd < 0 ? 0.55 : mi.fwd === 0 ? 0.85 : 1) * (inLake ? 0.6 : 1);
    vx = dx / l * sp; vz = dz / l * sp;
  }
  // aceleração/desaceleração suave: ao soltar a tecla o personagem para em ~0,2 s, não de uma vez
  S.vel = S.vel || { x: 0, z: 0 };
  const kv = 1 - Math.exp(-dt * (vx || vz ? 16 : 9));
  if (!P.ground) { S.vel.x += (vx - S.vel.x) * kv * 0.25; S.vel.z += (vz - S.vel.z) * kv * 0.25; }
  else { S.vel.x += (vx - S.vel.x) * kv; S.vel.z += (vz - S.vel.z) * kv; }
  if (Math.hypot(S.vel.x, S.vel.z) < 0.05) { S.vel.x = 0; S.vel.z = 0; }
  const r = resolve(P.x + S.vel.x * dt, P.z + S.vel.z * dt, 0.45);
  P.x = r.x; P.z = r.z;
  const coast = !mi.any ? Math.hypot(S.vel.x, S.vel.z) : 0;
  let gy = heightAt(P.x, P.z); if (inLake) gy = Math.max(gy, LAKE.level - 1.05);
  if (P.ground) P.y = gy;
  else {
    P.vy -= 22 * dt; P.y += P.vy * dt;
    if (P.y <= gy) { P.y = gy; P.ground = true; me.anim.play('Jump_Land', { once: true, restart: true, fade: 0.05 }); S.lockAnim = t + 0.25; }
  }
  me.obj.position.set(P.x, P.y, P.z);
  // de frente para o alvo quando parado atacando
  if (S.autoAttack && S.target && !mi.any && !mi.turn && !mouse.right) P.yaw = angLerp(P.yaw, Math.atan2(S.target.x - P.x, S.target.z - P.z), Math.min(1, dt * 8));
  me.obj.rotation.y = P.yaw;
  // animação
  if (S.casting) { if (me.anim.name !== 'Spellcasting') me.anim.play('Spellcasting'); }
  else if (t < S.lockAnim) { /* golpe / levar dano em andamento */ }
  else if (!P.ground) { if (me.anim.name !== 'Jump_Start') me.anim.play('Jump_Idle'); }
  else if (S.sitting) { if (me.anim.name !== 'Sit_Floor_Idle' && me.anim.name !== 'Sit_Floor_Down') { me.anim.play('Sit_Floor_Down', { once: true }); later(0.9, () => { if (S.sitting) me.anim.play('Sit_Floor_Idle'); }); } }
  else if (mi.fwd > 0) me.anim.play('Running_A', { speed: S.god ? 1.4 : 1 });
  else if (mi.fwd < 0) me.anim.play('Walking_Backwards');
  else if (mi.strafe) me.anim.play(mi.strafe < 0 ? 'Running_Strafe_Left' : 'Running_Strafe_Right');
  else if (coast > 0.8) me.anim.play('Running_A', { speed: Math.max(0.45, coast / base) });
  else if (mi.turn) me.anim.play('Walking_B', { speed: 0.8 });
  else me.anim.play(S.autoAttack && S.target ? (S.me.look.style === '2h' || S.me.look.style === 'cast' ? '2H_Melee_Idle' : 'Idle') : 'Idle');
  // conjuração
  if (S.casting && t >= S.casting.end) { const c = S.casting; S.casting = null; $('castbar3d').classList.add('hidden'); executeSkill(c); }
  // ataque automático
  if (S.autoAttack) {
    const m = S.target;
    if (!m || m.dead) { S.autoAttack = false; }
    else if (!S.casting && t >= S.nextAttack && t >= S.lockAnim - 0.1) {
      const d = Math.hypot(m.x - P.x, m.z - P.z), range = p.d.rangeTiles * TM + m.radius + 0.9;
      const facing = Math.cos(Math.atan2(m.x - P.x, m.z - P.z) - P.yaw) > 0.3;
      if (d > range) msgOnce('range', 'Alvo fora de alcance.');
      else if (!facing) msgOnce('face', 'Você precisa estar de frente para o alvo.');
      else { S.nextAttack = t + p.d.aspd / 1000; playerAttack(m); }
    }
  }
  // zona
  const zn = zoneAt(P.x, P.z);
  if (zn !== S.zone) {
    S.zone = zn; banner(zn.name, zn.lvl); Sound.playSong(zn.music);
    $('mapname').innerHTML = `${zn.name} <small>${zn.lvl}</small>`;
    if (zn.safe) log('Você está em uma área segura.', 'sys');
  }
}
function playerAttack(m) {
  const p = S.p, me = S.me, st = me.look.style;
  const list = ATTACK_ANIM[st]; me.anim.play(list[Math.floor(rng() * list.length)], { once: true, restart: true, fade: 0.08, speed: Math.max(1, 900 / p.d.aspd) });
  S.lockAnim = S.time + Math.min(0.6, p.d.aspd / 1000 * 0.8);
  S.sitting = false;
  const hit = () => {
    if (m.dead) return;
    hurtMonster(m, rollPhys(p, m, 1, 'neutro'));
    if (p.d.doubleAttack && !p.d.ranged && Math.random() * 100 < p.d.doubleAttack) later(0.15, () => { if (!m.dead) hurtMonster(m, rollPhys(p, m, 1, 'neutro')); });
  };
  if (p.d.ranged) { Sound.play('bow'); later(0.25, () => shoot(me.obj.position.clone().add(new THREE.Vector3(0, 1.3, 0)), () => m.obj.position.clone().add(new THREE.Vector3(0, m.height * 0.6, 0)), '#e8e0c8', hit, true)); }
  else { Sound.play('swing'); later(0.28, hit); }
}
function playerDie() {
  const p = S.p;
  p.dead = true; S.autoAttack = false; S.casting = null; S.sitting = false;
  S.me.anim.play('Death_A', { once: true, fade: 0.1 });
  for (const m of S.monsters) { m.aggro = false; m.returning = true; }
  const loss = Math.floor(baseExpNext(p.baseLv) * 0.01); p.baseExp = Math.max(0, p.baseExp - loss);
  Sound.play('death'); log('Você foi derrotado...', 'warn');
  setTimeout(() => {
    $('overlay').innerHTML = `<div class="death-box"><h2>Você foi derrotado</h2><div class="muted">Perdeu ${loss} de EXP de Base.</div><br><button class="btn gold" id="d-ok" style="padding:8px 18px">Reviver na Vila de Alvorada</button></div>`;
    $('overlay').classList.add('show');
    $('d-ok').onclick = () => {
      $('overlay').classList.remove('show');
      p.dead = false; p.hp = Math.max(1, Math.floor(p.d.maxHp / 2)); p.sp = Math.floor(p.d.maxSp / 2);
      Object.assign(S.pos, { x: VILLAGE.x + 4, z: VILLAGE.z + 3, ground: true, vy: 0 }); S.me.anim.play('Idle', { restart: true }); save3d();
    };
  }, 1200);
}

/* =========================== Mascote =========================== */
function buildPet() {
  if (S.pet) { scene.remove(S.pet.obj); S.pet = null; }
  const data = S.p && S.p.pet; if (!data) return;
  const st = petStage(data), m = makePet(data.species, st);
  const P = S.pos;
  S.pet = { ...m, stage: st, x: P.x - 1.5, z: P.z - 1.5, yaw: P.yaw, next: S.time + 2, buffNext: S.time + 8, moving: false };
  m.obj.position.set(S.pet.x, heightAt(S.pet.x, S.pet.z), S.pet.z);
  scene.add(m.obj);
}
function petNear() { const pe = S.pet; return pe && Math.hypot(pe.x - S.pos.x, pe.z - S.pos.z) < 14; }
function petHit(m, mult = 1) {
  const data = S.p.pet, sp = PETS[data.species], pw = petPower(data);
  const dmg = Math.max(1, Math.round(pw.atk * mult * (0.9 + Math.random() * 0.2) * elementMult(sp.element, m.def.element) * 100 / (100 + m.def.mdef)));
  hurtMonster(m, { dmg }, sp.element);
}
function updatePet(dt) {
  const pe = S.pet, data = S.p && S.p.pet; if (!pe || !data || S.p.dead) return;
  const P = S.pos, t = S.time, role = PETS[data.species].role, pw = petPower(data);
  const tgt = S.target && !S.target.isNpc && !S.target.dead && (S.autoAttack || S.target.aggro) && Math.hypot(S.target.x - P.x, S.target.z - P.z) < 24 ? S.target : null;
  // lugar padrão: um pouco atrás e ao lado do jogador
  let goal = { x: P.x - Math.sin(P.yaw) * 1.7 + Math.cos(P.yaw) * 1.1, z: P.z - Math.cos(P.yaw) * 1.7 - Math.sin(P.yaw) * 1.1 }, stopAt = 0.4, face = null;
  if (role === 'ataque' && tgt) { // fica a ~5 m do alvo e cospe fogo
    const d = Math.hypot(tgt.x - pe.x, tgt.z - pe.z);
    goal = d > 6 ? { x: tgt.x - (tgt.x - pe.x) / d * 5, z: tgt.z - (tgt.z - pe.z) / d * 5 } : null; face = tgt;
    if (d < 8 && t >= pe.next) {
      pe.next = t + (2.4 - pe.stage * 0.45);
      const from = pe.obj.position.clone().add(new THREE.Vector3(0, pe.height * 0.7, 0));
      shoot(from, () => tgt.obj.position.clone().add(new THREE.Vector3(0, tgt.height * 0.5, 0)), '#ff8a3d', () => {
        if (tgt.dead) return;
        petHit(tgt);
        if (pe.stage === 2) { ring({ x: tgt.x, y: tgt.obj.position.y, z: tgt.z }, 2.6, '#ffb04a'); S.monsters.filter(o => o !== tgt && !o.dead && Math.hypot(o.x - tgt.x, o.z - tgt.z) < 2.6).forEach(o => petHit(o, 0.5)); }
      });
      Sound.play('fire');
    }
  } else if (role === 'guardiao' && tgt) { // vai até o alvo e dá pancadas que atordoam
    const d = Math.hypot(tgt.x - pe.x, tgt.z - pe.z);
    goal = d > 1.6 + tgt.radius ? { x: tgt.x, z: tgt.z } : null; stopAt = 1.4 + tgt.radius; face = tgt;
    if (d < 2.4 + tgt.radius && t >= pe.next) {
      pe.next = t + 6; petHit(tgt, 0.7);
      tgt.status.stun = t + 1 + pe.stage * 0.5; floatAt(tgt.obj.position, 'Atordoado!', '#e8c890', tgt.height + 0.9);
      ring({ x: tgt.x, y: tgt.obj.position.y, z: tgt.z }, 1.5, '#c9a15a'); Sound.play('quake');
    }
  } else if (role === 'suporte') { // cura e escudo de água
    const p = S.p;
    if (t >= pe.next && p.hp < p.d.maxHp * 0.9) {
      pe.next = t + 6; const v = Math.round(p.d.maxHp * pw.heal + data.lv * 2);
      p.hp = Math.min(p.d.maxHp, p.hp + v); floatAt(S.me.obj.position, '+' + v, '#5fe08a', 2.3); ring(S.pos, 1.4, '#7ad0ff'); Sound.play('heal');
    }
    const inCombat = S.monsters.some(m => m.aggro && !m.dead && Math.hypot(m.x - P.x, m.z - P.z) < 20);
    if (inCombat && t >= pe.buffNext) {
      pe.buffNext = t + 30;
      p.buffs.bencao_mare = { until: t + 20, bonuses: { def: Math.round((4 + data.lv / 2) * (1 + pe.stage * 0.5)), hpRegen: Math.round(3 + data.lv / 2 + pe.stage * 4) } };
      recalc(p); ring(S.pos, 2, '#4ab0ff'); log(`🌊 ${petInfo(data).name} te protegeu com a Bênção da Maré!`); hudDirty = true;
    }
  }
  // movimento com inércia: acelera, faz curvas e desacelera suavemente
  const dToPlayer = Math.hypot(P.x - pe.x, P.z - pe.z);
  const maxSp = S.p.d.speed / 32 * TM * 1.25 * pw.speedMult;
  let wantX = 0, wantZ = 0;
  if (dToPlayer > 30) { pe.x = P.x - 1.5; pe.z = P.z - 1.5; pe.vx = pe.vz = 0; } // ficou longe demais: aparece ao seu lado
  else if (goal) {
    const dx = goal.x - pe.x, dz = goal.z - pe.z, d = Math.hypot(dx, dz);
    if (d > stopAt) { // freia ao chegar perto (velocidade proporcional à distância)
      const sp = Math.min(maxSp * (d > 6 ? 1.4 : 1), (d - stopAt) * 2.2 + 0.4);
      wantX = dx / d * sp; wantZ = dz / d * sp;
    }
  }
  const k = 1 - Math.exp(-dt * ((wantX || wantZ) ? 5 : 7));
  pe.vx = (pe.vx || 0) + (wantX - (pe.vx || 0)) * k; pe.vz = (pe.vz || 0) + (wantZ - (pe.vz || 0)) * k;
  const spd = Math.hypot(pe.vx, pe.vz);
  if (spd < 0.03) pe.vx = pe.vz = 0;
  pe.x += pe.vx * dt; pe.z += pe.vz * dt;
  pe.moving = spd > 0.25;
  const prevYaw = pe.yaw;
  const wantYaw = spd > 0.25 ? Math.atan2(pe.vx, pe.vz) : face ? Math.atan2(face.x - pe.x, face.z - pe.z) : spd < 0.05 && dToPlayer < 3.5 ? P.yaw : pe.yaw;
  pe.yaw = angLerp(pe.yaw, wantYaw, 1 - Math.exp(-dt * (spd > 0.25 ? 7 : 3)));
  let dy = pe.yaw - prevYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  pe.turn = (pe.turn || 0) + ((dt > 0 ? dy / dt : 0) - (pe.turn || 0)) * (1 - Math.exp(-dt * 6));
  const r = resolve(pe.x, pe.z, 0.3); pe.x = r.x; pe.z = r.z;
  // acompanha a inclinação do terreno
  const fx = Math.sin(pe.yaw) * 0.3, fz = Math.cos(pe.yaw) * 0.3;
  const slope = Math.atan2(heightAt(pe.x + fx, pe.z + fz) - heightAt(pe.x - fx, pe.z - fz), 0.6);
  pe.pitch = (pe.pitch || 0) + (-slope - (pe.pitch || 0)) * (1 - Math.exp(-dt * 8));
  pe.obj.position.set(pe.x, heightAt(pe.x, pe.z), pe.z); pe.obj.rotation.set(pe.pitch, pe.yaw, 0, 'YXZ');
  pe.animate(t, { speed: spd / Math.max(1, maxSp), turn: Math.max(-4, Math.min(4, pe.turn)) }, dt);
}
function petExpGain(baseExp) {
  const data = S.p.pet; if (!data) return;
  const before = petInfo(data).name;
  const r = petGainExp(data, baseExp * 0.5);
  if (r.up) log(`🐾 ${petInfo(data).name} subiu para o Nv. ${data.lv}!`, 'lvl');
  if (r.evolved !== null) {
    const now = petInfo(data);
    banner(`${before} evoluiu!`, `AGORA É ${now.name.toUpperCase()} ${now.icon}`);
    log(`✨ ${before} evoluiu para ${now.name}! ${now.desc}`, 'card');
    Sound.play('card'); buildPet(); if (S.pet) { ring(S.pet.obj.position, 2.5, PETS[data.species].color); ring(S.pet.obj.position, 1.4, '#ffe680'); }
  }
}
// escolha do mascote (na criação ou para personagens que ainda não têm)
function showPetChoice(intro, onPick, onBack) {
  const o = $('overlay'); let sel = null;
  const card = k => { const sp = PETS[k], s0 = sp.stages[0];
    return `<div class="pet-card" data-k="${k}" style="--pc:${sp.color}"><div class="pc-icon">${s0.icon}</div><div class="pc-name">${s0.name}</div><div class="pc-role">${sp.roleIcon} ${sp.roleName}</div><div class="pc-desc">${sp.desc}</div>
      <div class="pc-chain">${sp.stages.map((s, i) => `<span title="${escH(s.desc)}">${s.icon} ${s.name}${i ? ` <small>Nv.${PET_EVOLVE[i]}</small>` : ''}</span>`).join('<b>→</b>')}</div></div>`; };
  o.innerHTML = `<div class="title-box pet-pick"><h1>Escolha seu mascote</h1><div class="sub">${intro}</div>
    <div class="pet-cards">${Object.keys(PETS).map(card).join('')}</div>
    <div class="row" style="max-width:420px;margin:14px auto 0">${onBack ? '<button class="btn" id="pk-back">← Voltar</button>' : ''}<button class="btn gold" id="pk-ok" disabled>Escolha um mascote</button></div></div>`;
  o.classList.add('show');
  o.querySelectorAll('.pet-card').forEach(c => c.onclick = () => {
    sel = c.dataset.k; Sound.init(); Sound.play('click');
    o.querySelectorAll('.pet-card').forEach(x => x.classList.toggle('on', x === c));
    const b = $('pk-ok'); b.disabled = false; b.textContent = `Escolher ${PETS[sel].stages[0].name} ${PETS[sel].stages[0].icon}`;
  });
  $('pk-ok').onclick = () => { if (sel) onPick(sel); };
  if (onBack) $('pk-back').onclick = onBack;
}

/* =========================== Progressão =========================== */
function gainExp(base, job) {
  const p = S.p;
  const mult = CONFIG.EXP_RATE * (1 + p.d.expPct / 100);
  base = Math.floor(base * mult); job = Math.floor(job * mult);
  let lv = false, jl = false;
  p.baseExp += base;
  while (p.baseLv < CONFIG.MAX_BASE_LV && p.baseExp >= baseExpNext(p.baseLv)) { p.baseExp -= baseExpNext(p.baseLv); p.baseLv++; p.statPoints += Math.floor(p.baseLv / 5) + 3; lv = true; }
  const mj = maxJobLv(p), tier = CLASSES[p.cls].tier;
  if (p.jobLv < mj) { p.jobExp += job; while (p.jobLv < mj && p.jobExp >= jobExpNext(p.jobLv, tier)) { p.jobExp -= jobExpNext(p.jobLv, tier); p.jobLv++; p.skillPoints++; jl = true; } if (p.jobLv >= mj) p.jobExp = 0; }
  petExpGain(base);
  recalc(p);
  if (lv) { p.hp = p.d.maxHp; p.sp = p.d.maxSp; levelFx(); log(`⭐ Nível de Base ${p.baseLv}!`, 'lvl'); }
  if (jl) { if (!lv) levelFx(); log(`✦ Nível de Classe ${p.jobLv}! +1 ponto de habilidade.`, 'lvl'); if (canChangeClass(p)) log('🌟 Você já pode evoluir de classe! Fale com a Mestra Ivra na vila.', 'card'); }
  if (lv || jl) save3d();
  hudDirty = true;
}
function levelFx() {
  Sound.play('levelup');
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  g.position.y = 3; S.me.obj.add(g);
  S.fx.push({ obj: g, t0: S.time, dur: 1.4, parent: S.me.obj, update: (k) => { g.material.opacity = 0.5 * (1 - k); g.scale.set(1 + k, 1, 1 + k); } });
  if (!moveInput().any) { S.me.anim.play('Cheer', { once: true, restart: true }); S.lockAnim = S.time + 1.2; }
}

/* =========================== Habilidades =========================== */
function trySkill(id) {
  const p = S.p; if (p.dead || S.casting) return;
  const sk = SKILLS[id], lv = p.skills[id] || 0;
  if (!lv) return log('Você ainda não aprendeu essa habilidade.', 'warn');
  if (sk.type === 'passive') return log(`${sk.name} é passiva — já está ativa.`);
  if (p.cds[id] > S.time && !S.god) return msgOnce('cd', 'Habilidade em recarga.');
  if (p.sp < sk.sp(lv) && !S.god) { Sound.play('error'); return msgOnce('sp', 'SP insuficiente.'); }
  const m = S.target && !S.target.dead && !S.target.isNpc ? S.target : null;
  let pt = null;
  if (sk.target === 'enemy') {
    if (!m) return msgOnce('sel', 'Selecione um alvo (Tab ou clique).');
    const range = (sk.range === 'weapon' ? p.d.rangeTiles : sk.range) * TM + m.radius + 0.9;
    if (Math.hypot(m.x - S.pos.x, m.z - S.pos.z) > range) return msgOnce('range', 'Alvo fora de alcance.');
    S.pos.yaw = Math.atan2(m.x - S.pos.x, m.z - S.pos.z);
  } else if (sk.target === 'ground') {
    pt = m ? { x: m.x, z: m.z } : { x: S.pos.x + Math.sin(S.pos.yaw) * 7, z: S.pos.z + Math.cos(S.pos.yaw) * 7 };
  }
  S.sitting = false;
  const ct = S.god ? 0 : (sk.cast ? sk.cast(lv) : 0) * p.d.castMult / 1000;
  const a = { id, lv, m, pt };
  if (ct > 0.05) {
    S.casting = { ...a, start: S.time, end: S.time + ct };
    $('castbar3d').classList.remove('hidden'); $('castbar3d').querySelector('span').textContent = sk.name;
    if (sk.effect.dmg === 'magic') Sound.play('magic');
  } else executeSkill(a);
  // conjuradores e arqueiros não saem correndo para o corpo a corpo depois de uma magia
  if (m && S.me.look.style !== 'cast' && !p.d.ranged && Math.hypot(m.x - S.pos.x, m.z - S.pos.z) <= p.d.rangeTiles * TM + m.radius + 0.9) S.autoAttack = true;
}
function executeSkill(a) {
  const p = S.p, sk = SKILLS[a.id], lv = a.lv, eff = sk.effect, me = S.me;
  if (sk.target === 'enemy' && (!a.m || a.m.dead)) return;
  if (!S.god) { p.sp -= sk.sp(lv); p.cds[a.id] = S.time + (sk.cd || 0) / 1000; }
  const anim = eff.dmg === 'magic' || eff.kind === 'heal' || eff.kind === 'buff' ? 'Spellcast_Shoot' : sk.target === 'selfAoe' ? '2H_Melee_Attack_Spin' : ATTACK_ANIM[me.look.style][0];
  me.anim.play(anim, { once: true, restart: true, fade: 0.08 }); S.lockAnim = S.time + 0.6;
  hudDirty = true;
  if (eff.kind === 'heal') { const v = eff.amount(lv, p); p.hp = Math.min(p.d.maxHp, p.hp + v); floatAt(me.obj.position, '+' + v, '#5fe08a', 2.2); ring(me.obj.position, 1.6, '#7dff9a'); Sound.play('heal'); return; }
  if (eff.kind === 'buff') { p.buffs[a.id] = { until: S.time + eff.dur / 1000, bonuses: eff.bonuses(lv) }; recalc(p); ring(me.obj.position, 1.8, sk.fxColor || '#ffd76a'); Sound.play('buff'); log(`${sk.name} ativada!`); return; }
  if (eff.kind === 'steal') {
    const m = a.m;
    if (m.stolen) floatAt(m.obj.position, 'Nada', '#cfd6e0', m.height + 0.4);
    else if (Math.random() < eff.chance(lv) + (p.d.dex - m.def.lv) / 300) { const [id] = m.def.drops[Math.floor(Math.random() * m.def.drops.length)]; m.stolen = true; addItem(p, id, 1); Sound.play('coin'); floatAt(m.obj.position, 'Roubou!', '#ffd84a', m.height + 0.4); log(`Você roubou ${ITEMS[id].icon} ${ITEMS[id].name}!`, 'item'); }
    else { floatAt(m.obj.position, 'Falhou', '#cfd6e0', m.height + 0.4); Sound.play('miss'); }
    m.aggro = true; return;
  }
  // dano
  const hits = eff.hits ? eff.hits(lv) : 1, mult = eff.mult(lv), el = eff.element || 'neutro', col = ELEMENTS[el].color;
  const R = (eff.radius || 0) * TM;
  const center = sk.target === 'selfAoe' ? { x: S.pos.x, z: S.pos.z } : sk.target === 'ground' ? a.pt : { x: a.m.x, z: a.m.z };
  const inRadius = (c, r) => S.monsters.filter(m => !m.dead && Math.hypot(m.x - c.x, m.z - c.z) <= r + m.radius);
  const hitOne = m => {
    if (!m || m.dead) return;
    const res = eff.dmg === 'magic' ? rollMagic(p, m, mult, el) : rollPhys(p, m, mult, el, { hitBonus: eff.hitBonus ? eff.hitBonus(lv) : 0, ignoreDef: eff.ignoreDef, autoCrit: eff.autoCrit, flat: eff.flat ? eff.flat(lv, p) : 0 });
    hurtMonster(m, res, el);
    if (eff.status && !m.dead && !res.miss && Math.random() < eff.status.chance(lv)) {
      const s = eff.status;
      if (s.type === 'poison') m.status.poison = { until: S.time + s.dur / 1000, dmg: Math.max(2, p.d.atk * 0.15), next: S.time + 1 };
      else m.status[s.type] = S.time + (m.def.boss ? s.dur / 3000 : s.dur / 1000);
      floatAt(m.obj.position, { freeze: 'Congelado!', stun: 'Atordoado!', poison: 'Envenenado!' }[s.type], '#9fe3ff', m.height + 0.9);
    }
  };
  const from = () => me.obj.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const to = m => () => m.obj.position.clone().add(new THREE.Vector3(0, m.height * 0.6, 0));
  if (R > 0) {
    for (let i = 0; i < hits; i++) later(0.15 + i * 0.25, () => { ring({ x: center.x, y: heightAt(center.x, center.z), z: center.z }, R, col); inRadius(center, R).forEach(hitOne); });
    Sound.play(el === 'fogo' ? 'fire' : el === 'vento' ? 'zap' : el === 'terra' ? 'quake' : el === 'sagrado' ? 'holy' : 'swing');
  } else if (eff.splash) {
    const m = a.m;
    shoot(from(), to(m), col, () => { ring({ x: m.x, y: heightAt(m.x, m.z), z: m.z }, eff.splash * TM, col); inRadius({ x: m.x, z: m.z }, eff.splash * TM).forEach(hitOne); Sound.play('fire'); }, true);
  } else if (eff.dmg === 'magic' || ['arrow', 'bolt', 'lightning', 'pillar'].includes(sk.fx)) {
    Sound.play(el === 'fogo' ? 'fire' : el === 'agua' ? 'ice' : 'magic');
    for (let i = 0; i < hits; i++) later(i * 0.14, () => shoot(from(), to(a.m), col, () => hitOne(a.m), sk.fx === 'arrow'));
  } else {
    Sound.play('swing');
    for (let i = 0; i < hits; i++) later(0.25 + i * 0.14, () => hitOne(a.m));
  }
}

/* =========================== Efeitos =========================== */
function shoot(from, toFn, color, onHit, arrow) {
  const g = arrow ? new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5).rotateX(Math.PI / 2) : new THREE.SphereGeometry(0.18, 10, 8);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color }));
  if (!arrow) mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })));
  mesh.position.copy(from); scene.add(mesh);
  S.projectiles.push({ mesh, toFn, onHit, speed: arrow ? 28 : 18 });
}
function ring(pos, r, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(pos.x, (pos.y ?? heightAt(pos.x, pos.z)) + 0.08, pos.z); scene.add(m);
  S.fx.push({ obj: m, t0: S.time, dur: 0.6, update: k => { m.scale.setScalar(0.2 + k * r); m.material.opacity = 0.85 * (1 - k); } });
}
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4040', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
selRing.visible = false; scene.add(selRing);
const fbRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
fbRing.visible = false; fbRing.renderOrder = 10; scene.add(fbRing);

/* textos flutuantes (dano) e placas de nome — HTML posicionado sobre a cena */
const tmpV = new THREE.Vector3();
function toScreen(v) { tmpV.copy(v).project(camera); return { x: (tmpV.x + 1) / 2 * innerWidth, y: (1 - tmpV.y) / 2 * innerHeight, vis: tmpV.z < 1 }; }
function floatAt(pos, text, color, h = 2, big = false) {
  const el = document.createElement('div'); el.className = 'float3d' + (big ? ' big' : ''); el.textContent = text; el.style.color = color;
  $('plates').appendChild(el);
  S.floaters.push({ el, pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.5, pos.y + h, pos.z), t0: S.time });
}
const plateEls = new Map();
function updatePlates() {
  const P = S.pos;
  const shown = new Set();
  for (const e of [...S.monsters, ...S.npcs]) {
    if (e.dead && !e.isNpc) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d > 32 && e !== S.target) continue;
    const s = toScreen(tmpV.set(e.x, (e.obj.position.y) + e.height + 0.45, e.z));
    if (!s.vis) continue;
    let el = plateEls.get(e);
    if (!el) { el = document.createElement('div'); el.className = 'plate3d'; $('plates').appendChild(el); plateEls.set(e, el); }
    const hostile = !e.isNpc && (e.def.aggressive || e.aggro);
    const color = e.isNpc ? '#7dff9a' : hostile ? '#ff6a6a' : '#ffe36a';
    const hp = e.isNpc ? '' : (e.hp < e.maxHp || e === S.target) ? `<div class="pbar"><div style="width:${e.hp / e.maxHp * 100}%"></div></div>` : '';
    const key = `${e.isNpc ? e.name : e.def.name}|${color}|${hp}|${e === S.target}`;
    if (el._k !== key) { el._k = key; el.innerHTML = `<span style="color:${color}">${escH(e.isNpc ? e.name : e.def.name)}</span>${e.isNpc ? `<small>&lt;${escH(e.title)}&gt;</small>` : ''}${hp}`; el.classList.toggle('sel', e === S.target); }
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    el.style.opacity = d > 26 ? 0.6 : 1;
    shown.add(e);
  }
  if (S.pet && S.p.pet) {
    const pe = S.pet, s = toScreen(tmpV.set(pe.x, pe.obj.position.y + pe.height + 0.35, pe.z));
    let el = plateEls.get(pe);
    if (!el) { el = document.createElement('div'); el.className = 'plate3d'; $('plates').appendChild(el); plateEls.set(pe, el); }
    const info = petInfo(S.p.pet), key = info.name + S.p.pet.lv;
    if (el._k !== key) { el._k = key; el.innerHTML = `<span style="color:#9ff0ff">${info.icon} ${escH(info.name)}</span><small>Nv. ${S.p.pet.lv}</small>`; }
    el.style.display = s.vis ? '' : 'none';
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    shown.add(pe);
  }
  for (const [e, el] of plateEls) if (!shown.has(e)) { el.remove(); plateEls.delete(e); }
  // barras de HP e SP logo abaixo dos pés do personagem (como no 2D)
  let pb = $('mybars');
  if (!pb) { pb = document.createElement('div'); pb.id = 'mybars'; pb.innerHTML = '<div class="hp"><div></div></div><div class="sp"><div></div></div>'; $('plates').appendChild(pb); }
  const ps = toScreen(tmpV.set(P.x, S.pos.y, P.z));
  if (ps.vis && S.p) {
    pb.style.display = '';
    pb.style.transform = `translate(${ps.x}px, ${ps.y + 6}px) translate(-50%, 0)`;
    pb.children[0].firstChild.style.width = (S.p.hp / S.p.d.maxHp * 100) + '%';
    pb.children[1].firstChild.style.width = (S.p.sp / S.p.d.maxSp * 100) + '%';
    pb.classList.toggle('low', S.p.hp / S.p.d.maxHp < 0.3);
  } else pb.style.display = 'none';
  for (let i = S.floaters.length - 1; i >= 0; i--) {
    const f = S.floaters[i], k = (S.time - f.t0) / 1.1;
    if (k >= 1) { f.el.remove(); S.floaters.splice(i, 1); continue; }
    const s = toScreen(tmpV.copy(f.pos).add(new THREE.Vector3(0, k * 1.2, 0)));
    f.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${k < 0.15 ? 0.6 + k * 3 : 1})`;
    f.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    f.el.style.display = s.vis ? '' : 'none';
  }
}

/* =========================== Alvo e cliques =========================== */
const raycaster = new THREE.Raycaster();
const camRay = new THREE.Raycaster();
function pick(cx, cy) {
  const v = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(v, camera);
  const hits = raycaster.intersectObjects(hitboxes, false);
  for (const h of hits) { const r = h.object.userData.ref; if (r && !(r.dead && !r.isNpc)) return r; }
  return null;
}
function setTarget(e) { S.target = e; if (!e) S.autoAttack = false; hudDirty = true; }
function tabTarget() {
  const P = S.pos;
  const cands = S.monsters.filter(m => !m.dead && Math.hypot(m.x - P.x, m.z - P.z) < 40)
    .map(m => { const a = Math.atan2(m.x - P.x, m.z - P.z) - S.cam.yaw; return { m, d: Math.hypot(m.x - P.x, m.z - P.z), front: Math.cos(a) }; })
    .filter(c => c.front > 0.2).sort((a, b) => a.d - b.d);
  if (!cands.length) return msgOnce('tab', 'Nenhum inimigo à frente.');
  const i = cands.findIndex(c => c.m === S.target);
  setTarget(cands[(i + 1) % cands.length].m);
}
function interact(e, attack) {
  if (!e) return;
  setTarget(e);
  if (e.isNpc) {
    if (Math.hypot(e.x - S.pos.x, e.z - S.pos.z) > 5) return log('Chegue mais perto para conversar.', 'warn');
    talk(e);
  } else if (attack) S.autoAttack = true;
}

/* =========================== Diálogos (janela compartilhada com o 2D) =========================== */
function talk(n) {
  const p = S.p, bye = { label: 'Até logo.', fn: () => UI.close('dialog') };
  n.anim.play('Interact', { once: true, restart: true }); later(1.2, () => n.anim.play('Idle'));
  if (n.id === 'clara') { p.hp = p.d.maxHp; p.sp = p.d.maxSp; Sound.play('heal'); ring(S.me.obj.position, 1.6, '#7dff9a'); UI.dialog(n, 'Que a luz te guarde, viajante. Suas feridas estão curadas.\nVolte sempre que precisar.', [bye]); }
  else if (n.id === 'bento') UI.dialog(n, 'Bem-vindo, bem-vindo! Poções fresquinhas, armas para toda classe... e compro qualquer tralha que você trouxer dos campos!', [{ label: '🛒 Ver mercadorias', gold: true, fn: () => { UI.close('dialog'); UI.open('shop'); } }, bye]);
  else if (n.id === 'tobias') UI.dialog(n, 'Bem-vindo ao mundo aberto de Aethra!\n<b>W/S</b> anda, <b>A/D</b> vira, <b>botão direito segurado</b> + A/D anda de lado, <b>Espaço</b> pula.\n<b>Tab</b> escolhe um inimigo, <b>R</b> ou botão direito nele ataca, <b>1–9</b> usa habilidades.\nOs campos ficam a leste; o bosque, mais a leste; as ruínas, ao norte.', [bye]);
  else if (n.id === 'ivra') {
    const c = CLASSES[p.cls];
    const tree = { label: '🌳 Ver a Árvore de Classes', fn: () => { UI.close('dialog'); UI.open('tree'); } };
    if (!canChangeClass(p)) return UI.dialog(n, c.next.length ? `Continue treinando como ${c.name}. No <b>Nível de Classe ${c.tier === 0 ? CONFIG.JOB_CHANGE_1 : CONFIG.JOB_CHANGE_2}</b> (você está no ${p.jobLv}) eu te mostro o próximo caminho.` : 'Você trilhou seu caminho até o fim... por enquanto.', [tree, bye]);
    UI.dialog(n, 'Chegou a hora. Que caminho você escolhe?\n<span class="muted">A escolha é para sempre.</span>', [...c.next.map(k => ({ label: `${CLASSES[k].icon} Tornar-me ${CLASSES[k].name}`, gold: true, fn: () => { UI.close('dialog'); changeClass3d(k); } })), tree, bye]);
  }
}
function changeClass3d(cls) {
  const p = S.p;
  p.cls = cls; p.jobLv = 1; p.jobExp = 0;
  for (const [id, q] of CLASSES[cls].gift || []) addItem(p, id, q);
  // equipa a arma de presente, se a classe puder usar
  const gift = (CLASSES[cls].gift || []).map(g => g[0]).find(id => ITEMS[id].type === 'arma');
  const en = gift && p.inventory.find(e => e.id === gift);
  if (en && CLASSES[cls].weapons.includes(ITEMS[gift].wtype) && (ITEMS[gift].lv || 1) <= p.baseLv) { const i = p.inventory.indexOf(en); p.inventory.splice(i, 1); if (p.equip.arma) p.inventory.push(p.equip.arma); p.equip.arma = en; }
  recalc(p); p.hp = p.d.maxHp; p.sp = p.d.maxSp;
  buildPlayerModel(); levelFx();
  banner(`${CLASSES[cls].icon} ${CLASSES[cls].name}`, 'NOVA CLASSE');
  log(`🌟 Você agora é ${CLASSES[cls].name}!`, 'card');
  save3d(); hudDirty = true;
}

/* =========================== HUD =========================== */
let hudDirty = true;
function log(text, cls = 'sys') { UI.log(text, cls); }
// aviso vermelho passageiro no centro da tela (como no WoW), sem encher o chat
function msgOnce(key, text) {
  if ((S.lastMsg[key] || 0) + 1.2 > S.time) return;
  S.lastMsg[key] = S.time;
  const el = $('err3d'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function banner(t, sub) { const b = $('banner'); b.innerHTML = `<div class="b1">${escH(t)}</div><div class="b2">${escH(sub || '')}</div>`; b.classList.add('show'); clearTimeout(banner._t); banner._t = setTimeout(() => b.classList.remove('show'), 2600); }
function useSlot(i) {
  const p = S.p, h = p && p.hotbar[i]; if (!h || p.dead || S.paused) return;
  if (h.kind === 'skill') trySkill(h.id);
  else { const e = p.inventory.find(x => x.id === h.id); if (e) use3d(e); else msgOnce('item', `Sem ${ITEMS[h.id].name}.`); }
}
function use3d(entry) {
  const p = S.p; if (!p || p.dead) return;
  if (S.paused) return msgOnce('pause', 'O jogo está pausado (P para continuar).');
  const it = ITEMS[entry.id]; if (it.type !== 'consumivel') return;
  const u = it.use;
  if (u.warp) { Object.assign(S.pos, { x: VILLAGE.x + 4, z: VILLAGE.z + 3, ground: true, vy: 0 }); Sound.play('portal'); ring(S.pos, 2, '#9fe3ff'); }
  if (u.hp) { p.hp = Math.min(p.d.maxHp, p.hp + u.hp); floatAt(S.me.obj.position, '+' + u.hp, '#5fe08a', 2.2); }
  if (u.sp) { p.sp = Math.min(p.d.maxSp, p.sp + u.sp); floatAt(S.me.obj.position, '+' + u.sp + ' SP', '#7ab0ff', 2.5); }
  removeItem(p, entry); Sound.play('heal'); hudDirty = true;
}
function updateHud() {
  UI.updateHud();
  const t = S.target, tf = $('target3d');
  if (t && !(t.dead && !t.isNpc)) {
    tf.classList.remove('hidden');
    $('tg-name').textContent = t.isNpc ? t.name : t.def.name;
    $('tg-lv').textContent = t.isNpc ? t.title : `Nv. ${t.def.lv}${t.def.boss ? ' • CHEFE' : t.def.mini ? ' • Elite' : ''}`;
    $('tg-hp').style.width = t.isNpc ? '100%' : (t.hp / t.maxHp * 100) + '%';
    $('tg-hptxt').textContent = t.isNpc ? 'Amigável' : `${Math.max(0, Math.round(t.hp))} / ${t.maxHp}`;
    $('tg-info').textContent = t.isNpc ? '' : `${ELEMENTS[t.def.element].name}${t.def.aggressive ? ' • Agressivo' : ' • Passivo'}${S.autoAttack ? ' • ⚔️ atacando' : ''}`;
    tf.classList.toggle('hostile', !t.isNpc);
  } else tf.classList.add('hidden');
  const pl = $('st-pet');
  if (pl) {
    if (S.p.pet) { const info = petInfo(S.p.pet), pct = S.p.pet.lv >= PET_MAX_LV ? 100 : S.p.pet.exp / petExpNext(S.p.pet.lv) * 100; pl.innerHTML = `<span>${info.icon} ${escH(info.name)} <b>Nv. ${S.p.pet.lv}</b></span><div class="pet-xp"><div style="width:${pct}%"></div></div>`; pl.style.display = ''; }
    else pl.style.display = 'none';
  }
  if (S.casting) $('castbar3d').querySelector('.fill').style.width = ((S.time - S.casting.start) / (S.casting.end - S.casting.start) * 100) + '%';
  if (hudDirty) { UI.markDirty(); hudDirty = false; }
  if (UI.dirty) UI.refreshOpen();
}
/* =========================== Mapa-múndi pintado (minimapa e Painel do Mestre) =========================== */
const WM = 720; // resolução do mapa pintado (cobre o mundo todo: -150..150)
const worldMap = document.createElement('canvas'); worldMap.width = worldMap.height = WM;
const w2m = v => (v / 150 + 1) / 2 * WM; // metros -> pixel do mapa pintado
const mmBase = worldMap; // compatibilidade
function buildMinimap() {
  const g = worldMap.getContext('2d'), img = g.createImageData(WM, WM), step = 300 / WM;
  // relevo com sombreado (luz vinda do noroeste) e cores do chão
  const H = new Float32Array((WM + 1) * (WM + 1));
  for (let j = 0; j <= WM; j++) for (let i = 0; i <= WM; i++) H[j * (WM + 1) + i] = heightAt(-150 + i * step, -150 + j * step);
  for (let j = 0; j < WM; j++) for (let i = 0; i < WM; i++) {
    const x = -150 + i * step, z = -150 + j * step, h = H[j * (WM + 1) + i];
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
    let c;
    if (dl < LAKE.r) { c = new THREE.Color('#2f7fc8').lerp(new THREE.Color('#5ab0ee'), Math.max(0, 1 - dl / LAKE.r) * 0.6); }
    else c = groundColor(x, z, h);
    const nx = H[j * (WM + 1) + i + 1] - h, nz = H[(j + 1) * (WM + 1) + i] - h;
    const shade = Math.max(0.55, Math.min(1.35, 1 - (nx + nz) * 0.9));
    const edge = Math.max(Math.abs(x), Math.abs(z)) > PLAY_LIMIT ? 0.72 : 1; // fora da área jogável fica mais escuro
    const k = (j * WM + i) * 4;
    img.data[k] = Math.min(255, c.r * 255 * shade * edge); img.data[k + 1] = Math.min(255, c.g * 255 * shade * edge); img.data[k + 2] = Math.min(255, c.b * 255 * shade * edge); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // margem do lago
  g.strokeStyle = 'rgba(232,214,160,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(w2m(LAKE.x), w2m(LAKE.z), LAKE.r / 300 * WM, 0, 7); g.stroke();
  // cenário: árvores, pedras e prédios
  const px = 300 / WM;
  for (const o of placed) {
    const a = o.userData.asset, x = w2m(o.position.x), y = w2m(o.position.z);
    if (/^cloud|^lily|^mountain/.test(a)) continue;
    if (/^tree|^trees|^stump|^oak|^pine/.test(a)) {
      const r = (/^oak/.test(a) ? 2.6 * o.scale.x : /^pine/.test(a) ? 2.0 * o.scale.x : /_l$/.test(a) ? 3.2 : /_m$/.test(a) ? 2.4 : 1.6) / px;
      g.fillStyle = 'rgba(20,50,22,0.35)'; g.beginPath(); g.arc(x + 1, y + 1, r, 0, 7); g.fill();
      g.fillStyle = '#2f6a30'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(140,200,110,0.45)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); g.fill();
    } else if (/^rock/.test(a)) { g.fillStyle = '#8c8c88'; g.beginPath(); g.arc(x, y, 0.9 / px, 0, 7); g.fill(); }
    else if (/^(wall|fence)/.test(a)) { g.fillStyle = a === 'fence' ? '#7a5532' : '#77736b'; g.fillRect(x - 1.5, y - 1.5, 3, 3); }
    else { // prédios: telhado na cor do pacote
      const roof = /red|market/.test(a) ? '#b8483a' : /destroyed|scaffold/.test(a) ? '#6a6258' : '#3f6fb5', s = (/tower|well/.test(a) ? 2.2 : 3.6) / px;
      g.save(); g.translate(x, y); g.rotate(-o.rotation.y);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-s / 2 + 1.5, -s / 2 + 1.5, s, s);
      g.fillStyle = roof; g.fillRect(-s / 2, -s / 2, s, s);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-s / 2, -s / 2, s, s / 3);
      g.restore();
    }
  }
}
// minimapa redondo: mostra a região ao seu redor (zoom com + e −)
let mmRange = 60;
function drawMinimap() {
  const cv = $('minimap'), c = cv.getContext('2d'), W = cv.width, R = W / 2;
  c.clearRect(0, 0, W, W);
  c.save(); c.beginPath(); c.arc(R, R, R - 7, 0, 7); c.clip();
  const sizePx = mmRange * 2 / 300 * WM;
  c.fillStyle = '#1a2a1a'; c.fillRect(0, 0, W, W);
  c.drawImage(worldMap, w2m(S.pos.x) - sizePx / 2, w2m(S.pos.z) - sizePx / 2, sizePx, sizePx, 0, 0, W, W);
  const pt = (x, z) => [R + (x - S.pos.x) / mmRange * R, R + (z - S.pos.z) / mmRange * R];
  const inside = (x, y) => Math.hypot(x - R, y - R) < R - 9;
  for (const m of S.monsters) if (!m.dead) {
    const [x, y] = pt(m.x, m.z); if (!inside(x, y)) continue;
    c.fillStyle = m.def.boss || m.def.mini ? '#ffb84a' : (m.def.aggressive || m.aggro) ? '#ff5a5a' : '#ffe08a';
    c.beginPath(); c.arc(x, y, m.def.mini || m.def.boss ? 3.5 : 2.3, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.stroke();
  }
  for (const n of S.npcs) { const [x, y] = pt(n.x, n.z); if (!inside(x, y)) continue; c.fillStyle = '#ffe36a'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', x, y); }
  if (S.pet) { const [x, y] = pt(S.pet.x, S.pet.z); c.fillStyle = '#9ff0ff'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
  c.restore();
  // moldura dourada estilo WoW
  const ring = c.createLinearGradient(0, 0, W, W); ring.addColorStop(0, '#f3d98a'); ring.addColorStop(0.5, '#a97c2c'); ring.addColorStop(1, '#f3d98a');
  c.lineWidth = 7; c.strokeStyle = ring; c.beginPath(); c.arc(R, R, R - 4, 0, 7); c.stroke();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(30,20,5,0.9)'; c.beginPath(); c.arc(R, R, R - 7.5, 0, 7); c.stroke();
  c.beginPath(); c.arc(R, R, R - 0.8, 0, 7); c.stroke();
  // você (seta no centro)
  c.save(); c.translate(R, R); c.rotate(-S.pos.yaw + Math.PI);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#1a3a8a'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
  // norte
  c.fillStyle = '#2a1e08'; c.beginPath(); c.arc(R, 6, 7, 0, 7); c.fill(); c.strokeStyle = '#f3d98a'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#ffe9a8'; c.font = 'bold 9px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', R, 6.5);
}
function zoomMinimap(dir) { mmRange = clamp(mmRange * (dir > 0 ? 0.75 : 1.33), 25, 150); }

/* =========================== Entrada =========================== */
function typing() { const t = document.activeElement && document.activeElement.tagName; return t === 'INPUT' || t === 'TEXTAREA'; }
addEventListener('keydown', e => {
  if (!S.started || typing()) return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (isAdmin()) UI.toggle('admin'); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (FB.picking || FB.box) { if (k === 'escape') FB.cancel(); return; }
  if (k === 'escape') { if (UI.closeAll()) return; if (S.target) setTarget(null); else toggleMenu(); return; }
  if (S.menuOpen) return;
  if (k === 'q') { FB.start(); return; }
  if (k === 'p') { H3.setPaused(!G.paused); return; }
  if (k === 'enter') { UI.setChatMin(false); $('chatinput').focus(); e.preventDefault(); return; }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; e.preventDefault(); return; }
  const win = { c: 'char', i: 'inv', e: 'equip', k: 'skills', t: 'tree', h: 'help', l: 'sugestoes' }[k];
  if (win) { UI.toggle(win); return; }
  if (k === 'n') { toggleSound(); return; }
  if (k === 'z') { if (isAdmin()) toggleGod(); return; }
  if (S.paused) return;
  if (k === 'tab') { e.preventDefault(); tabTarget(); return; }
  if (k === ' ') { e.preventDefault(); if (S.pos.ground && !S.p.dead) { S.pos.vy = 7.5; S.pos.ground = false; S.sitting = false; S.me.anim.play('Jump_Start', { once: true, restart: true, fade: 0.05 }); later(0.3, () => { if (!S.pos.ground) S.me.anim.play('Jump_Idle'); }); if (S.casting) { S.casting = null; $('castbar3d').classList.add('hidden'); } } return; }
  if (k >= '1' && k <= '9') { useSlot(+k - 1); return; }
  if (k === 'r') { if (S.target && !S.target.isNpc && !S.target.dead) { S.autoAttack = !S.autoAttack; log(S.autoAttack ? 'Ataque automático ligado.' : 'Ataque automático desligado.'); } else msgOnce('sel', 'Selecione um inimigo (Tab).'); return; }
  if (k === 'x') { if (!S.p.dead) { S.sitting = !S.sitting; S.autoAttack = false; } return; }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (!S.started || S.menuOpen || FB.picking || FB.box) return;
  if (e.button === 1) { e.preventDefault(); S.frontView = true; return; } // segurar o botão do meio: vista de frente
  if (e.button === 0) mouse.left = true; else if (e.button === 2) mouse.right = true; else return;
  mouse.moved = 0; mouse.x = e.clientX; mouse.y = e.clientY; mouse.btn = e.button;
});
addEventListener('mousemove', e => {
  if (!mouse.left && !mouse.right) return;
  const dx = e.movementX, dy = e.movementY;
  mouse.moved += Math.abs(dx) + Math.abs(dy);
  if (mouse.moved > 4 && document.pointerLockElement !== canvas && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (err) { } }
  if (mouse.moved > 2) {
    S.cam.yaw -= dx * 0.005;
    S.cam.pitch = clamp(S.cam.pitch + dy * 0.004, -0.12, 1.52); S.cam.pitchT = S.cam.pitch;
    if (mouse.right) S.pos.yaw = S.cam.yaw;
  }
});
addEventListener('mouseup', e => {
  const wasClick = mouse.moved <= 4 && (e.button === 0 ? mouse.left : mouse.right);
  if (e.button === 1) S.frontView = false;
  if (e.button === 0) mouse.left = false; else if (e.button === 2) mouse.right = false;
  if (!mouse.left && !mouse.right && document.pointerLockElement) document.exitPointerLock();
  if (wasClick && S.started && e.target === canvas && !FB.picking && !FB.box) {
    const hit = pick(e.clientX, e.clientY);
    if (hit) interact(hit, e.button === 2);
    else if (e.button === 0) setTarget(null);
  }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const d = e.deltaY || e.deltaX; // com Shift, alguns navegadores mandam a rolagem na horizontal
  if (e.shiftKey) S.cam.pitchT = clamp((S.cam.pitchT ?? S.cam.pitch) + (d > 0 ? 0.07 : -0.07), -0.12, 1.52); // de rente ao chão até quase 90°
  else S.cam.distT = clamp(S.cam.distT * (d > 0 ? 1.12 : 0.89), 1.6, 26);
}, { passive: false });
canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

/* =========================== Menu, ajuda, salvar =========================== */
function toggleMenu() {
  S.menuOpen = !S.menuOpen;
  const o = $('overlay');
  if (!S.menuOpen) { o.classList.remove('show'); return; }
  o.innerHTML = `<div class="death-box" style="border-color:var(--border);min-width:300px"><h2 style="color:var(--gold)">Menu</h2>
    <div class="muted" style="margin-bottom:14px">${escH(S.p.name)} — Nv. ${S.p.baseLv} ${CLASSES[S.p.cls].name}</div>
    <div class="menu-btns">
      <button class="btn gold" id="m-cont">▶ Continuar <span class="muted">(Esc)</span></button>
      <button class="btn" id="m-help">❔ Controles</button>
      <button class="btn" id="m-2d">🗺️ Versão clássica 2D</button>
      <button class="btn" id="m-chars">🏠 Trocar de personagem</button>
    </div><div class="muted" style="margin-top:12px;font-size:11px">O jogo salva automaticamente. Seu personagem é o mesmo no 2D e no 3D.</div></div>`;
  o.classList.add('show');
  $('m-cont').onclick = toggleMenu;
  $('m-help').onclick = () => { toggleMenu(); UI.open('help'); };
  $('m-2d').onclick = () => { save3d(); location.href = '2d.html'; };
  $('m-chars').onclick = () => { save3d(); location.reload(); };
}
const SAVE_FIELDS3 = ['charId', 'pet', 'name', 'look', 'cls', 'baseLv', 'jobLv', 'baseExp', 'jobExp', 'stats', 'statPoints', 'skillPoints', 'skills', 'zeny', 'inventory', 'equip', 'hotbar', 'hp', 'sp'];
function save3d() {
  if (!S.p || !HAS_SRV) return;
  const s = {}; for (const k of SAVE_FIELDS3) s[k] = S.p[k];
  // a posição do 2D é preservada; a do 3D vai em pos3d
  s.mapId = S.orig.mapId || 'vila'; s.x = S.orig.x; s.y = S.orig.y; s.uid = Math.max(S.orig.uid || 1, 1000 + S.uid);
  s.pos3d = { x: S.pos.x, z: S.pos.z, yaw: S.pos.yaw };
  s.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { }
  fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s), keepalive: true })
    .then(r => r.json()).then(j => { if (j.apagado) { alert(`O personagem ${s.name} foi apagado.`); location.reload(); } }).catch(() => { });
  S.lastSave = S.time;
}
addEventListener('beforeunload', () => { if (S.started) save3d(); });

/* =========================== Loop =========================== */
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  step(dt); draw(dt);
  requestAnimationFrame(frame);
}
function syncG() {
  G.player = S.p; G.time = S.time;
  G.state = !S.started ? 'title' : S.p.dead ? 'dead' : 'play';
  if (S.zone) { G.mapId = 'mundo3d:' + S.zone.id; G.map.def.name = S.zone.name; }
}
function step(dt) {
  syncG();
  if (S.started && !S.paused && !S.menuOpen) {
    S.time += dt;
    for (let i = S.timers.length - 1; i >= 0; i--) if (S.timers[i].at <= S.time) { const t = S.timers.splice(i, 1)[0]; t.fn(); }
    updatePlayer(dt);
    updatePet(dt);
    for (const m of [...S.monsters]) updateMonster(m, dt);
    for (const n of S.npcs) n.anim.update(dt);
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const pr = S.projectiles[i], to = pr.toFn(), d = to.distanceTo(pr.mesh.position), st = pr.speed * dt;
      if (d <= st + 0.2) { scene.remove(pr.mesh); S.projectiles.splice(i, 1); pr.onHit(); }
      else { pr.mesh.lookAt(to); pr.mesh.position.add(to.sub(pr.mesh.position).normalize().multiplyScalar(st)); }
    }
    for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i], k = (S.time - f.t0) / f.dur; if (k >= 1) { (f.parent || scene).remove(f.obj); S.fx.splice(i, 1); } else f.update(k); }
    for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 170) c.position.x = -170; }
    updateNature(S.time);
    if (S.time - S.lastSave > 30) save3d();
  }
}
function draw(dt) {
  if (S.started) {
    // câmera estilo WoW: atrás do personagem, orbitando
    const P = S.pos, cam = S.cam;
    cam.dist += (cam.distT - cam.dist) * Math.min(1, dt * 10);
    if (cam.pitchT !== undefined) cam.pitch += (cam.pitchT - cam.pitch) * Math.min(1, dt * 12);
    cam.viewYaw = angLerp(cam.viewYaw ?? cam.yaw, S.frontView ? P.yaw + Math.PI : cam.yaw, Math.min(1, dt * 10));
    const head = new THREE.Vector3(P.x, P.y + 1.4 - Math.max(0, 1.6 - cam.dist) * 0.3, P.z);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let cx = P.x - Math.sin(cam.viewYaw) * cp * cam.dist, cz = P.z - Math.cos(cam.viewYaw) * cp * cam.dist, cy = head.y + sp * cam.dist;
    const gy = heightAt(cx, cz) + 0.5; if (cy < gy) cy = gy;
    const camPos = new THREE.Vector3(cx, cy, cz), dir = camPos.clone().sub(head), len = dir.length();
    camRay.set(head, dir.normalize()); camRay.far = len;
    const near = occluders.filter(o => Math.abs(o.position.x - P.x) < 30 && Math.abs(o.position.z - P.z) < 30);
    const hit = camRay.intersectObjects(near, true)[0];
    if (hit) camPos.copy(head).addScaledVector(dir, Math.max(0.6, hit.distance - 0.3));
    camera.position.copy(camPos); camera.lookAt(head);
    sun.position.set(P.x + 30, P.y + 60, P.z + 18); sun.target.position.set(P.x, P.y, P.z);
    sky.position.copy(camera.position);
    // névoa por região
    const wr = zoneWeight('ruinas', P.x, P.z), wf = zoneWeight('floresta', P.x, P.z);
    scene.fog.color.copy(FOG_DAY).lerp(FOG_FOREST, wf * 0.6).lerp(FOG_RUINS, wr * 0.85);
    scene.fog.near = 60 - wr * 35 - wf * 15; scene.fog.far = 240 - wr * 120 - wf * 60;
    // seleção
    const t = S.target;
    if (t && !(t.dead && !t.isNpc)) { selRing.visible = true; selRing.position.set(t.x, t.obj.position.y + 0.06, t.z); selRing.scale.setScalar(Math.max(0.7, t.radius + 0.35)); selRing.material.color.set(t.isNpc ? '#7dff9a' : (t.def.aggressive || t.aggro) ? '#ff4040' : '#ffe36a'); }
    else selRing.visible = false;
    const hp = FB.picking && FB.hoverPick;
    if (hp && hp.wpos) { fbRing.visible = true; fbRing.position.set(hp.wpos.x, hp.wpos.y + 0.08, hp.wpos.z); fbRing.scale.setScalar(hp.r || 1); fbRing.material.opacity = 0.6 + Math.sin(performance.now() / 150) * 0.3; }
    else fbRing.visible = false;
    updateHud(); updatePlates(); drawMinimap();
  } else {
    // tela inicial: câmera passeando pela vila
    const a = performance.now() / 9000;
    camera.position.set(VILLAGE.x + Math.cos(a) * 42, 18, VILLAGE.z + Math.sin(a) * 42);
    camera.lookAt(VILLAGE.x, 2, VILLAGE.z);
    sky.position.copy(camera.position);
  }
  renderer.render(scene, camera);
}
// para testes automáticos: avança o jogo sem depender do requestAnimationFrame
window.__sim = (sec, fps = 30) => { for (let i = 0; i < sec * fps; i++) step(1 / fps); draw(1 / fps); };

/* =========================== Início =========================== */
async function chooseCharacter() {
  const o = $('overlay');
  let list = [];
  try { list = await (await fetch('/api/saves')).json(); } catch (e) { }
  list = list.filter(c => c && c.name && CLASSES[c.cls]);
  o.innerHTML = `<div class="title-box"><h1>${GAME_TITLE}</h1><div class="sub">UM RPG DE MUNDO ABERTO • CLASSES • CARTAS</div><div class="card">
    ${list.length ? '<label style="margin-top:0">Escolha seu personagem</label>' + list.map((c, i) => `<button class="btn ${i ? '' : 'gold'} c3" data-i="${i}" style="width:100%;padding:9px;font-size:14px;margin-bottom:5px;text-align:left">▶ <b>${escH(c.name)}</b> <span class="muted">— Nv. ${c.baseLv} ${CLASSES[c.cls].icon} ${CLASSES[c.cls].name}</span></button>`).join('')
      : ''}
    <div class="row"><button class="btn ${list.length ? '' : 'gold'}" id="c3-new">＋ Criar novo personagem</button></div>
    <div class="row" style="margin-top:6px"><a class="btn" href="2d.html" style="text-align:center;text-decoration:none">🗺️ Versão clássica 2D</a></div>
    </div><div class="ver">Seu personagem é o mesmo no 2D e no 3D • clique para ativar o som<br>Modelos 3D: KayKit, por Kay Lousberg (kaylousberg.com) • CC0</div></div>`;
  o.classList.add('show');
  $('c3-new').onclick = () => { Sound.init(); showCreate3d(list); };
  if (!list.length) { showCreate3d(list); return; }
  o.querySelectorAll('.c3').forEach(b => b.onclick = async () => {
    Sound.init();
    const s = await (await fetch('/api/save/' + list[+b.dataset.i].slug)).json();
    startWith(s);
  });
}
// criação de personagem no 3D (nome obrigatório; mesmo começo do 2D)
function showCreate3d(list) {
  const o = $('overlay');
  o.innerHTML = `<div class="title-box"><h1>${GAME_TITLE}</h1><div class="sub">CRIAR NOVO PERSONAGEM</div><div class="card">
    <label style="margin-top:0">Nome <span style="color:#ff8a8a">*</span></label><input type="text" id="c3-name" maxlength="16" placeholder="Como seu aventureiro vai se chamar?">
    <div id="c3-err" style="color:#ff8a8a;font-size:12px;min-height:16px;margin-top:3px"></div>
    <div class="muted" style="font-size:12px;margin:4px 0 10px">Você começa como 🌱 Aprendiz na Vila de Alvorada. No Nível de Classe ${CONFIG.JOB_CHANGE_1}, a Mestra Ivra te ajuda a escolher seu caminho.</div>
    <div class="row">${list.length ? '<button class="btn" id="c3-back">← Voltar</button>' : ''}<button class="btn gold" id="c3-ok">Criar personagem</button></div>
  </div><div class="ver">Modelos 3D: KayKit, por Kay Lousberg (kaylousberg.com) • CC0</div></div>`;
  o.classList.add('show');
  const nameEl = $('c3-name'), err = $('c3-err');
  const create = async () => {
    const name = nameEl.value.trim();
    if (name.length < 2) { err.textContent = 'Dê um nome ao seu personagem (pelo menos 2 letras).'; nameEl.focus(); Sound.play('error'); return; }
    if (list.some(c => c.slug === saveSlug(name))) { err.textContent = 'Você já tem um personagem com esse nome. Escolha outro.'; nameEl.focus(); Sound.play('error'); return; }
    Sound.init();
    showPetChoice('Toda jornada começa com um companheiro. Ele vai lutar ao seu lado e evoluir junto com você.', species => createWithPet(name, species), () => showCreate3d(list));
  };
  const createWithPet = async (name, species) => {
    const c = createCharacter(name, {}, species);
    const s = {}; for (const k of SAVE_FIELDS3) s[k] = c[k];
    Object.assign(s, { mapId: 'vila', x: 20 * CONFIG.TILE + 16, y: 18 * CONFIG.TILE + 16, uid: G.uid, savedAt: Date.now() });
    try { await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }); } catch (e) { }
    startWith(s);
    log('Você tem 48 pontos de atributo para distribuir (C).', 'sys');
  };
  $('c3-ok').onclick = create;
  nameEl.addEventListener('keydown', e => { e.stopPropagation(); err.textContent = ''; if (e.key === 'Enter') create(); });
  if ($('c3-back')) $('c3-back').onclick = () => chooseCharacter();
  setTimeout(() => nameEl.focus(), 50);
}
function startWith(s) {
  if (!s.pet) {
    return showPetChoice(`${escH(s.name)}, três criaturinhas te seguiram até a vila... Qual delas vai te acompanhar?`, species => { s.pet = newPet(species); startWith(s); setTimeout(save3d, 500); log(`🐾 ${PETS[species].stages[0].name} agora é seu companheiro!`, 'card'); });
  }
  const p = { ...s };
  if (!p.charId) p.charId = newCharId();
  p.hotbar = (p.hotbar || []).concat(Array(9).fill(null)).slice(0, 9);
  Object.assign(p, { buffs: {}, cds: {}, dead: false });
  recalc(p); if (p.hp <= 0) p.hp = Math.floor(p.d.maxHp / 2);
  S.p = p; S.orig = s;
  let maxUid = s.uid || 1;
  for (const e of [...(p.inventory || []), ...Object.values(p.equip || {})]) if (e && e.uid > maxUid) maxUid = e.uid;
  G.uid = maxUid + 1; G.player = p;
  const pos = s.pos3d;
  if (pos && Math.abs(pos.x) < PLAY_LIMIT && Math.abs(pos.z) < PLAY_LIMIT) Object.assign(S.pos, { x: pos.x, z: pos.z, yaw: pos.yaw || 0 });
  S.pos.y = heightAt(S.pos.x, S.pos.z); S.cam.yaw = S.pos.yaw;
  buildPlayerModel(); buildPet();
  $('overlay').classList.remove('show'); $('hud').classList.remove('hidden');
  S.started = true; hudDirty = true; syncG(); UI.refreshOpen();
  log(`Bem-vindo(a) ao mundo aberto de Aethra, ${p.name}!`, 'card');
  log('W/S andam • A/D viram • botão direito segurado gira a câmera junto • Espaço pula • Tab escolhe alvo • R ataca • H ajuda', 'sys');
  if (!localStorage.getItem('aethra3d_help')) { UI.open('help'); try { localStorage.setItem('aethra3d_help', '1'); } catch (e) { } }
}


/* =========================== Integração com as janelas do 2D =========================== */
const ASSET_NAMES = { oak_0: 'Carvalho', oak_1: 'Carvalho', oak_2: 'Carvalho', oak_3: 'Carvalho', oak_4: 'Carvalho', oakdark_0: 'Carvalho do bosque', oakdark_1: 'Carvalho do bosque', oakdark_2: 'Carvalho do bosque', pine_0: 'Pinheiro', pine_1: 'Pinheiro', pine_2: 'Pinheiro', pine_3: 'Pinheiro', pine_4: 'Pinheiro', pinedark_0: 'Pinheiro escuro', pinedark_1: 'Pinheiro escuro', pinedark_2: 'Pinheiro escuro', pinedark_3: 'Pinheiro escuro', home_A: 'Casa', home_B: 'Casa', home_A_red: 'Casa', home_B_red: 'Casa', tavern: 'Taverna', blacksmith: 'Ferraria', market: 'Feira', church: 'Igreja', windmill: 'Moinho', well: 'Poço', tower: 'Torre', destroyed: 'Prédio em ruínas', wall: 'Muro', wall_corner: 'Muro (canto)', fence: 'Cerca', scaffold: 'Andaime', tree_A: 'Pinheiro', tree_B: 'Pinheiro', trees_A_m: 'Grupo de árvores', trees_B_m: 'Grupo de árvores', trees_A_l: 'Bosque denso', trees_B_l: 'Bosque denso', stump: 'Tocos', rock_A: 'Pedra', rock_B: 'Pedra', rock_C: 'Pedra', rock_D: 'Pedra', rock_E: 'Pedra', mountain_A: 'Montanha', mountain_B: 'Montanha', mountain_C: 'Montanha', cloud: 'Nuvem', cloud_s: 'Nuvem', lily: 'Vitória-régia', barrel: 'Barril', crate_A: 'Caixote', crate_B: 'Caixote', sack: 'Saco', wheelbarrow: 'Carrinho de mão', flag_blue: 'Bandeira', flag_red: 'Bandeira', tent: 'Tenda', weaponrack: 'Suporte de armas', lumber: 'Toras', bucket: 'Balde', target_prop: 'Alvo de treino' };
const tileOf = (x, z) => [Math.round(x), Math.round(z)];
function describeMonster(m) {
  const d = m.def;
  const visual = m.vis.kind === 'skel' ? `js3d/main3d.js → monsterVisual (esqueleto KayKit, forma '${d.shape}')` : `js3d/critters.js → forma '${d.shape}' (monstro feito em código)`;
  return { kind: 'monstro', id: m.type, name: d.name, ref: m, wpos: { x: m.x, y: m.obj.position.y, z: m.z }, r: m.radius + 0.4, x: m.x, y: m.z, tile: tileOf(m.x, m.z),
    codigo: `js/data.js → MONSTERS.${m.type} (status, drops, carta) · ${visual}`,
    details: { nivel: d.lv, elemento: ELEMENTS[d.element].name, forma: d.shape, cor: d.color, tamanho: d.size, hp: `${Math.max(0, Math.round(m.hp))}/${m.maxHp}`, agressivo: !!d.aggressive, versao: '3D' } };
}
// o que está embaixo do cursor no mundo 3D (para as sugestões)
function fbPick(sx, sy) {
  raycaster.setFromCamera(new THREE.Vector2(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1), camera);
  const cands = [];
  const eh = raycaster.intersectObjects(hitboxes, false).find(h => { const r = h.object.userData.ref; return r && !(r.dead && !r.isNpc); });
  if (eh) cands.push({ d: eh.distance, ent: eh.object.userData.ref });
  if (S.me) { const mh = raycaster.intersectObject(S.me.obj, true)[0]; if (mh) cands.push({ d: mh.distance, me: true }); }
  if (S.pet) { const ph = raycaster.intersectObject(S.pet.obj, true)[0]; if (ph) cands.push({ d: ph.distance, pet: true }); }
  const near = placed.filter(o => Math.hypot(o.position.x - S.pos.x, o.position.z - S.pos.z) < 120);
  const oh = raycaster.intersectObjects([...near, terrain], true)[0];
  if (oh) cands.push({ d: oh.distance, hit: oh });
  cands.sort((a, b) => a.d - b.d);
  const c = cands[0];
  if (!c) return { kind: 'terreno', id: 'ceu', name: 'Céu', x: S.pos.x, y: S.pos.z, tile: tileOf(S.pos.x, S.pos.z), codigo: 'js3d/world3d.js → buildSky (céu) · js3d/main3d.js → névoa por região', details: { versao: '3D' } };
  if (c.pet) { const info = petInfo(S.p.pet); return { kind: 'mascote', id: S.p.pet.species, name: `${info.name} (Nv. ${S.p.pet.lv})`, wpos: { x: S.pet.x, y: S.pet.obj.position.y, z: S.pet.z }, r: 0.8, x: S.pet.x, y: S.pet.z, tile: tileOf(S.pet.x, S.pet.z), codigo: `js3d/pets3d.js → visual (espécie '${S.p.pet.species}', estágio ${info.stage}) · js/data.js → PETS · js3d/main3d.js → updatePet (comportamento)`, details: { especie: S.p.pet.species, estagio: info.stage, papel: PETS[S.p.pet.species].roleName, versao: '3D' } }; }
  if (c.me) { const look = S.me.look; return { kind: 'jogador', id: S.p.cls, name: `${S.p.name} (${CLASSES[S.p.cls].name})`, wpos: { x: S.pos.x, y: S.pos.y, z: S.pos.z }, r: 0.9, x: S.pos.x, y: S.pos.z, tile: tileOf(S.pos.x, S.pos.z), codigo: 'js3d/main3d.js → classLook (modelo e acessórios por classe) · assets3d/characters/', details: { modelo: look.model, acessorios: look.show, versao: '3D' } }; }
  if (c.ent) {
    const e = c.ent;
    if (e.isNpc) return { kind: 'npc', id: e.id, name: e.name, wpos: { x: e.x, y: e.obj.position.y, z: e.z }, r: 0.9, x: e.x, y: e.z, tile: tileOf(e.x, e.z), codigo: `js3d/main3d.js → NPC3D ('${e.id}', modelo ${e.model}) e talk() (falas)`, details: { titulo: e.title, modelo: e.model, versao: '3D' } };
    return describeMonster(e);
  }
  const h = c.hit, pt = h.point;
  let o = h.object; while (o && !o.userData.asset && o.parent) o = o.parent;
  if (o && o.userData.asset) {
    const a = o.userData.asset;
    return { kind: 'cenario', id: a, name: ASSET_NAMES[a] || a, wpos: { x: o.position.x, y: o.position.y, z: o.position.z }, r: 2, x: o.position.x, y: o.position.z, tile: tileOf(o.position.x, o.position.z), codigo: ASSETS[a] ? `${ASSETS[a]} (modelo KayKit) · js3d/main3d.js → buildWorld (posição/escala) e TYPE_SCALE` : `js3d/trees3d.js → árvore feita em código ('${a}') · js3d/main3d.js → buildWorld (onde nasce)`, details: { modelo: a, versao: '3D' } };
  }
  const zn = zoneAt(pt.x, pt.z), rd = roadDist(pt.x, pt.z), lake = Math.hypot(pt.x - LAKE.x, pt.z - LAKE.z) < LAKE.r;
  const what = lake ? 'Lago' : rd < 3 ? 'Estrada de terra' : pt.y > 6 ? 'Encosta / montanha' : 'Chão';
  return { kind: 'terreno', id: lake ? 'lago' : rd < 3 ? 'estrada' : 'chao', name: `${what} — ${zn.name}`, wpos: { x: pt.x, y: pt.y, z: pt.z }, r: 1.2, x: pt.x, y: pt.z, tile: tileOf(pt.x, pt.z), codigo: 'js3d/world3d.js → heightAt (relevo), groundColor (cores), ROADS/LAKE/ZONES', details: { regiao: zn.id, altura: +pt.y.toFixed(1), versao: '3D' } };
}
// área arrastada na tela: o que aparece dentro dela
function fbArea(x0, y0, x1, y1) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  const inRect = (x, y, z) => { const s = toScreen(new THREE.Vector3(x, y, z)); return s.vis && s.x >= ax && s.x <= bx && s.y >= ay && s.y <= by; };
  const count = arr => arr.reduce((o, k) => (o[k] = (o[k] || 0) + 1, o), {});
  const mons = count(S.monsters.filter(m => !m.dead && inRect(m.x, m.obj.position.y + 0.5, m.z)).map(m => m.def.name));
  const npcs = S.npcs.filter(n => inRect(n.x, n.obj.position.y + 1, n.z)).map(n => n.name);
  const objs = count(placed.filter(o => Math.hypot(o.position.x - S.pos.x, o.position.z - S.pos.z) < 90 && inRect(o.position.x, o.position.y + 1, o.position.z)).map(o => ASSET_NAMES[o.userData.asset] || o.userData.asset));
  const center = fbPick((ax + bx) / 2, (ay + by) / 2);
  return { kind: 'area', id: 'area3d', name: `Área da tela (${Math.round(bx - ax)}×${Math.round(by - ay)} px)`, x: center.x, y: center.y, tile: center.tile,
    codigo: 'js3d/main3d.js → buildWorld (cenário) · js3d/world3d.js (terreno)', details: { monstros: mons, npcs, cenario: objs, centro: center.name, versao: '3D' } };
}
// teleporte do Painel do Mestre
function teleport3d(x, z) {
  const r = resolve(x, z, 0.5);
  Object.assign(S.pos, { x: r.x, z: r.z, y: heightAt(r.x, r.z), vy: 0, ground: true });
  setTarget(null); S.casting = null; $('castbar3d').classList.add('hidden');
  ring(S.pos, 2.2, '#9fe3ff'); ring(S.pos, 1.2, '#ffd76a'); Sound.play('portal');
}
function installIntegration() {
  Object.assign(H3, {
    save: save3d, useItem: use3d, useSlot, levelFx, zoneMusic: () => (S.zone ? S.zone.music : 'vila'),
    setPaused: on => { G.paused = on; mouse.left = mouse.right = false; for (const k in keys) keys[k] = false; if (Sound.music) Sound.music.gain.setTargetAtTime(on ? 0.05 : 0.16, Sound.ctx.currentTime, 0.2); updatePauseBar(); },
    say: txt => floatAt(S.me.obj.position, '💬 ' + txt, '#ffffff', 2.6),
  });
  // sugestões (Q): escolher no mundo 3D
  FB.pickAt = (sx, sy) => fbPick(sx, sy);
  FB.pickArea = (x0, y0, x1, y1) => fbArea(x0, y0, x1, y1);
  FB.renderWorld = () => { };
  // Painel do Mestre: trocar de classe reconstrói o modelo 3D; teleporte usa o mapa do mundo 3D
  const setClass2d = ADMIN.setClass.bind(ADMIN);
  ADMIN.setClass = cls => { setClass2d(cls); buildPlayerModel(); };
  ADMIN.render = adminRender;
  // janela de ajuda com os controles do 3D
  UI.render_help = () => {
    UI.body('help').innerHTML = `<div style="line-height:1.7">
      <b class="gold">Movimento (estilo WoW)</b><br>
      <b>W / S</b> anda para frente / trás • <b>A / D</b> vira • <b>Espaço</b> pula<br>
      <b>Botão direito (segurar)</b> gira a câmera <i>e</i> o personagem — aí A/D andam de lado<br>
      <b>Botão esquerdo (segurar)</b> só olha em volta • <b>os dois botões</b> correm • <b>roda</b> zoom<br><br>
      <b class="gold">Combate</b><br>
      <b>Tab</b> próximo inimigo à frente • <b>clique</b> seleciona • <b>R</b> ou <b>botão direito no alvo</b> ataca • <b>1–9</b> habilidades/itens • <b>X</b> sentar<br><br>
      <b class="gold">Janelas</b> (as mesmas do 2D)<br>
      <b>C</b> Personagem • <b>I</b> Inventário • <b>E</b> Equipamento • <b>K</b> Habilidades • <b>T</b> Árvore de Classes • <b>L</b> Sugestões • <b>N</b> Som • <b>Enter</b> chat<br><br>
      <b class="gold">Pausa, sugestões e mestre</b><br>
      <b>P</b> pausa • <b>Q</b> sugestão: clique em qualquer coisa do mundo (monstro, NPC, casa, árvore, chão, você) ou arraste uma área<br>
      <b>Z</b> God Mode • <b>⌘ Cmd + Z</b> Painel do Mestre (classe, teleporte e atalhos) • <b>Esc</b> fecha janelas / menu<br><br>
      <span class="muted">Mapa: Vila a oeste • Campos no centro • Bosque a leste • Ruínas ao norte.</span></div>`;
  };
  UI.init();
}
// Painel do Mestre na versão 3D
let admHover = null;
function admPois() {
  const out = ZONES.map(z => ({ label: `📍 ${z.name}`, x: z.x, z: z.z + (z.id === 'vila' ? 4 : 0) }));
  for (const n of S.npcs) out.push({ label: `🧑 ${n.name}`, x: n.x + 2, z: n.z + 1 });
  for (const m of S.monsters) if (!m.dead && (m.def.mini || m.def.boss)) out.push({ label: `💀 Perto do ${m.def.name}`, x: m.x + 4, z: m.z });
  return out;
}
function adminRender() {
  const p = S.p; if (!p) return;
  const body = UI.body('admin'), pois = admPois();
  const tierName = ['Inicial', '1ª classe', '2ª classe'];
  body.innerHTML = `
    <div class="adm-card adm-godcard ${G.god ? 'on' : ''}">
      <div><div class="adm-card-h">⚡ God Mode</div><div class="muted">Imortal, SP infinito, sem recarga e mais rápido. Atalho: <b>Z</b></div></div>
      <button class="adm-switch ${G.god ? 'on' : ''}" id="adm-god" title="Liga / desliga"><span></span></button>
    </div>
    <div class="adm-card"><div class="adm-card-h">🎭 Virar qualquer classe</div>
      ${[0, 1, 2].map(tier => `<div class="adm-tier"><span class="adm-tier-n">${tierName[tier]}</span><div class="adm-classgrid">${Object.keys(CLASSES).filter(c => CLASSES[c].tier === tier).map(c => `<button class="adm-class ${p.cls === c ? 'on' : ''}" data-cls="${c}" title="${escH(CLASSES[c].desc)}"><span>${CLASSES[c].icon}</span>${CLASSES[c].name}</button>`).join('')}</div></div>`).join('')}
      <button class="btn small" data-cmd="skills" style="margin-top:6px">📚 Liberar todas as habilidades da classe</button>
    </div>
    <div class="adm-card"><div class="adm-card-h">🌍 Teleporte <span class="muted" style="font-weight:400">— clique no mapa onde quer aparecer</span></div>
      <div class="adm-mapframe"><canvas id="adm-map3d" width="560" height="560"></canvas></div>
      <div id="adm-info" class="adm-info">Passe o mouse no mapa e clique para ir</div>
      <div class="adm-chips">${pois.map((o, i) => `<button class="adm-chip" data-poi="${i}">${o.label}</button>`).join('')}</div>
    </div>
    <div class="adm-card"><div class="adm-card-h">🛠️ Atalhos de mestre</div>
      <div class="adm-chips">
        <button class="adm-chip" data-cmd="cura">❤️ Curar tudo</button><button class="adm-chip" data-cmd="lv1">⭐ +1 Nível Base</button><button class="adm-chip" data-cmd="lv5">⭐ +5 Níveis Base</button>
        <button class="adm-chip" data-cmd="job1">✦ +1 Nível Classe</button><button class="adm-chip" data-cmd="job10">✦ +10 Níveis Classe</button><button class="adm-chip" data-cmd="zeny">💰 +10.000 z</button>
        <button class="adm-chip" data-cmd="rate">📈 EXP ${CONFIG.EXP_RATE}× (trocar)</button>
        ${p.pet ? '<button class="adm-chip" data-pet="1">🐾 Mascote +5 níveis</button>' : ''}</div>
    </div>`;
  body.querySelector('#adm-god').onclick = () => toggleGod();
  body.querySelectorAll('[data-cls]').forEach(el => el.onclick = () => ADMIN.setClass(el.dataset.cls));
  body.querySelectorAll('[data-cmd]').forEach(el => el.onclick = () => ADMIN.cmd(el.dataset.cmd));
  body.querySelectorAll('[data-pet]').forEach(el => el.onclick = () => { for (let i = 0; i < 5; i++) petExpGain(petExpNext(p.pet.lv) * 2); hudDirty = true; UI.markDirty(); });
  body.querySelectorAll('[data-poi]').forEach(el => el.onclick = () => { const o = pois[+el.dataset.poi]; UI.close('admin'); teleport3d(o.x, o.z); log(`Teleportado: ${o.label}`); });
  const cv = body.querySelector('#adm-map3d');
  const toWorld = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width * 2 - 1) * 150, z: ((e.clientY - r.top) / r.height * 2 - 1) * 150 }; };
  cv.onmousemove = e => { admHover = toWorld(e); drawAdmMap(cv); const zn = zoneAt(admHover.x, admHover.z), lim = Math.abs(admHover.x) > PLAY_LIMIT || Math.abs(admHover.z) > PLAY_LIMIT; $('adm-info').innerHTML = `<b>${zn.name}</b> <span class="muted">${zn.lvl}</span> · (${Math.round(admHover.x)}, ${Math.round(admHover.z)})${lim ? ' · <span style="color:#ffb070">fora da área jogável — você aparece na borda</span>' : ''}`; };
  cv.onmouseleave = () => { admHover = null; drawAdmMap(cv); $('adm-info').textContent = 'Passe o mouse no mapa e clique para ir'; };
  cv.onclick = e => { const w = toWorld(e); UI.close('admin'); teleport3d(w.x, w.z); log(`Teleportado para (${Math.round(w.x)}, ${Math.round(w.z)}).`); };
  drawAdmMap(cv);
}
function drawAdmMap(cv) {
  const c = cv.getContext('2d'), W = cv.width, pt = (x, z) => [(x / 150 + 1) / 2 * W, (z / 150 + 1) / 2 * W];
  c.imageSmoothingEnabled = true; c.drawImage(worldMap, 0, 0, W, W);
  // vinheta suave nas bordas
  const v = c.createRadialGradient(W / 2, W / 2, W * 0.38, W / 2, W / 2, W * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,8,4,0.55)');
  c.fillStyle = v; c.fillRect(0, 0, W, W);
  const label = (txt, x, y, size, col) => { c.font = `700 ${size}px Cinzel, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(20,14,4,0.85)'; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y); };
  for (const z of ZONES) { const [x, y] = pt(z.x, z.z); label(z.name, x, y - 22, 15, '#ffe9a8'); c.font = '11px Nunito'; c.fillStyle = '#e8dcc0'; c.fillText(z.lvl, x, y - 6); }
  for (const m of S.monsters) if (!m.dead && (m.def.mini || m.def.boss)) { const [x, y] = pt(m.x, m.z); c.font = '15px sans-serif'; c.fillText(m.def.boss ? '👑' : '💀', x, y); }
  for (const n of S.npcs) { const [x, y] = pt(n.x, n.z); c.fillStyle = '#ffe36a'; c.font = '13px sans-serif'; c.fillText('★', x, y); }
  const [px, py] = pt(S.pos.x, S.pos.z);
  c.fillStyle = 'rgba(58,140,255,0.25)'; c.beginPath(); c.arc(px, py, 14, 0, 7); c.fill();
  c.save(); c.translate(px, py); c.rotate(-S.pos.yaw + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#1a3a8a'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
  label('Você', px, py - 20, 12, '#cfe8ff');
  // rosa dos ventos
  c.save(); c.translate(W - 34, 34); c.fillStyle = 'rgba(20,14,4,0.7)'; c.beginPath(); c.arc(0, 0, 20, 0, 7); c.fill(); c.strokeStyle = '#d9b860'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#ffe9a8'; c.beginPath(); c.moveTo(0, -15); c.lineTo(4, 0); c.lineTo(-4, 0); c.fill(); c.fillStyle = '#8a6a2a'; c.beginPath(); c.moveTo(0, 15); c.lineTo(4, 0); c.lineTo(-4, 0); c.fill();
  c.font = 'bold 10px Nunito'; c.fillStyle = '#ffe9a8'; c.fillText('N', 0, -22 + 30 - 30); c.restore();
  if (admHover) { const [hx, hy] = pt(admHover.x, admHover.z); c.strokeStyle = '#ffd76a'; c.lineWidth = 2.5; c.beginPath(); c.arc(hx, hy, 10, 0, 7); c.stroke(); c.beginPath(); c.moveTo(hx - 16, hy); c.lineTo(hx - 6, hy); c.moveTo(hx + 6, hy); c.lineTo(hx + 16, hy); c.moveTo(hx, hy - 16); c.lineTo(hx, hy - 6); c.moveTo(hx, hy + 6); c.lineTo(hx, hy + 16); c.stroke(); }
  c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, W - 3, W - 3);
}

(async function boot() {
  requestAnimationFrame(frame);
  await loadAll();
  buildWorld();
  spawnNpcs();
  for (const [zone, type, n] of SPAWNS) for (let i = 0; i < n; i++) spawnMonster(zone, type);
  buildMinimap();
  installIntegration();
  $('mm-in').onclick = () => zoomMinimap(1); $('mm-out').onclick = () => zoomMinimap(-1);
  $('loading3d').classList.add('hidden');
  window.__S3 = S; window.__api = { makeChar, dressAs: (ch, cls) => dress(ch, cls, MODELS, "Knight"), CLASS_LOOKS, scene, camera, buildPet, petExpGain, updatePet, talk, interact, trySkill, tabTarget, pick, toScreen, fbPick, fbArea, teleport3d, useSlot }; // para testes
  chooseCharacter();
})();
