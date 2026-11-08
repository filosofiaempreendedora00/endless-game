/* =========================================================================
   CRÔNICAS DE AETHRA — PROTÓTIPO 3D (mundo aberto, controles estilo WoW)
   Usa as mesmas regras/dados do 2D (js/data.js + js/rules.js) e o mesmo save.
   ========================================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { ZONES, VILLAGE, LAKE, PLAY_LIMIT, HALF, CITY2, FROZEN, TEMPLE, CAMPS, heightAt, zoneAt, zoneWeight, roadDist, buildTerrain, updateTerrain, terrainNear, buildWater, buildSky, buildGrass, cullGrass, groundColor, updateNature, mountainMask, buildDistantMountains, lakeDist, lakeShape, buildReeds, lilyPadGeometry, buildSea, seaPush, PORT, DWARF, ELF, CASTLE, treeAllowed } from './world3d.js';
import { buildCities, deckAt, FROST } from './cities3d.js';
import { buildPortCity, buildMerchants, villageHouse } from './port3d.js';
import { buildCastle, castleMap } from './castle3d.js';
import { makeGiantHead, makeMonolith, makeArch, makeTemple, cactusGeometry, makeCampfire, makeRoost, makeRuinWall, makeWheelbarrow, makeSentinel, makeSeatedKing, makeStoneBeast, makeFallenTitan, makeHeadless, makeMist, buildRuins } from './landmarks3d.js';
import { makeCritter } from './critters.js';
import { makePet } from './pets3d.js';
import { dress, CLASS_LOOKS, friendlyFaces, RACES, applyRace, SKINS, RARITY, applySkin, HAIR_STYLES, HAIR_COLORS, DEFAULT_LOOK, applyHair, classHasHat, applyHat, hatCovers, FACE_TYPES, normalizeLook, npcHead, dressHuman, CLASS_OUTFIT, humanBorrow, dressNpcRole } from './looks3d.js';
import { makeTreeTemplates } from './trees3d.js';
import { buildCatacombs as buildDungeon, FLOORS, DUNGEON_SPAWNS, dungeonSpawn, dungeonMap, dungeonCull } from './dungeon3d.js';
import { INTERIORS, buildRoomShell, table, bench, counter, fireplace, hayBale, stall, lantern, makePortal, makeTarget, makeFruitStand } from './interiors3d.js';
import { MOUNTS, MOUNT_SPEED, makeMount } from './mounts3d.js';
import { riderPose } from './ride3d.js';
import { makeLightPool, vlight } from './lights3d.js';
import { makeSmithy, makeWell, makeBucket, makeClothFlag, retextureKayKit, makeBarrel, makeLogPile, makeWeaponRack } from './village3d.js';
import { makePalisade } from './palisade3d.js';
import { loadHumans, makeHuman, shareSkeletons } from './humans3d.js';

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
const FOG_SNOW = new THREE.Color('#e3edf4'), FOG_SAND = new THREE.Color('#ecd9b0'), FOG_PLAIN = new THREE.Color('#a9a79e');
scene.fog = new THREE.Fog(FOG_DAY.clone(), 90, 420);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1700);
const lightPool = makeLightPool(scene, 3); // poucas luzes reais, levadas às fontes mais próximas
const hemi = new THREE.HemisphereLight('#d8ecff', '#5a6b3a', 1.1); hemi.layers.enable(1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d0', 2.4); sun.layers.enable(1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 200 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sky = buildSky(); scene.add(sky);
scene.add(camera); // a câmera fica na cena: as mãos da 1ª pessoa são filhas dela
{ const ch = document.createElement('div'); ch.id = 'crosshair'; ch.className = 'hidden'; ch.innerHTML = '<i></i><i></i><i></i><i></i><b></b>'; document.body.appendChild(ch); }
const terrain = buildTerrain(); scene.add(terrain);
/* Auditoria: detalhe do terreno no shader — montanhas com rocha estratificada, fendas e variação de tom nas encostas,
   areia com marcas de vento, neve com brilho e manchas, e variação grande de cor no chão (nada de massa lisa e chapada). */
function terrainDetail(mat, strong = 1) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNor;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNor;
float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(th(i), th(i + vec2(1,0)), f.x), mix(th(i + vec2(0,1)), th(i + vec2(1,1)), f.x), f.y); }
float tfbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * tn(p); p *= 2.03; a *= 0.5; } return v; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 N = normalize(vWNor); float steep = 1.0 - smoothstep(0.55, 0.86, N.y);
  vec3 base = diffuseColor.rgb; float lum = dot(base, vec3(0.299, 0.587, 0.114));
  float macro = tfbm(vWPos.xz * 0.012); float meso = tfbm(vWPos.xz * 0.09);
  // variação grande de tom em todo o chão (quebra a cor lisa)
  diffuseColor.rgb *= 0.86 + macro * 0.22 + (meso - 0.5) * 0.10 * ${strong.toFixed(2)};
  // rocha: estratos (camadas) que seguem a altura, fendas escuras e liquens nas encostas íngremes
  vec2 rp = vec2(vWPos.x + vWPos.z, vWPos.y);
  float strata = smoothstep(0.2, 0.8, sin(vWPos.y * 0.9 + tfbm(rp * 0.08) * 9.0 + tfbm(rp * 0.5) * 2.0) * 0.5 + 0.5);
  float cracks = smoothstep(0.62, 0.7, tfbm(vec2(vWPos.x * 0.5 + vWPos.z * 0.5, vWPos.y * 1.6)));
  vec3 rock = mix(vec3(0.42, 0.40, 0.37), vec3(0.62, 0.59, 0.54), strata) * (0.8 + tfbm(rp * 0.6) * 0.4);
  rock = mix(rock, vec3(0.18, 0.17, 0.16), cracks * 0.7);
  rock = mix(rock, vec3(0.38, 0.45, 0.28), smoothstep(0.65, 0.8, tfbm(rp * 0.3 + 7.0)) * 0.35);
  bool snowy = lum > 0.78 && base.b > base.r * 0.95;
  if (snowy) rock = mix(rock, vec3(0.92, 0.95, 1.0), smoothstep(0.3, 0.75, N.y) * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, rock * (0.75 + lum * 0.45), steep * 0.85);
  // areia: marcas de vento finas
  float sandy = smoothstep(0.08, 0.2, base.r - base.b) * smoothstep(0.55, 0.7, lum) * (1.0 - steep);
  float rip = sin(vWPos.x * 2.3 + vWPos.z * 1.1 + tn(vWPos.xz * 0.3) * 6.0) * 0.5 + 0.5;
  diffuseColor.rgb *= 1.0 - sandy * (0.06 - rip * 0.1);
  // neve no plano: brilho leve e manchas de neve mais densa
  if (snowy) diffuseColor.rgb *= 0.96 + tn(vWPos.xz * 0.8) * 0.06 + step(0.985, th(floor(vWPos.xz * 6.0))) * 0.15;
}`);
  };
  mat.needsUpdate = true;
}
{ let tm = null; terrain.traverse(o => { if (!tm && o.isMesh) tm = o.material; }); if (tm) terrainDetail(tm, 1); }
scene.add(buildWater());
scene.add(buildSea()); // S-117: o mar do litoral (canto sudeste)
scene.add(buildGrass(mulberry(99)));
scene.add(buildReeds(mulberry(77)));

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
  barrel: W + 'props/barrel.gltf', crate_A: W + 'props/crate_A_big.gltf', crate_B: W + 'props/crate_B_small.gltf', sack: W + 'props/sack.gltf',
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
const TYPE_SCALE = { tower: 0.6, tent: 0.55, windmill: 0.9, crate_A: 0.55, crate_B: 0.55, sack: 0.55, target_prop: 0.55, fence: 0.75, market: 0.85 }; // poço, balde, bandeiras e ferraria são feitos em código no tamanho real (village3d)
const occluders = []; // objetos que bloqueiam a câmera
const placed = []; // todos os objetos de cenário (sugestões identificam o modelo)
// junta as peças fixas de um objeto (mesmo material) numa malha só: bem menos chamadas de desenho
function bakeStatic(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), groups = new Map(), drop = [];
  obj.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + o.castShadow;
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    groups.get(key).geos.push(g); drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  for (const { mat, cast, geos } of groups.values()) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = cast; m.receiveShadow = true; obj.add(m); }
  return obj;
}
const extraPick = []; // estruturas grandes feitas em código (paliçada...) que o Q também identifica
// cenário longe some (menos chamadas de desenho); marcos gigantes continuam visíveis de longe
let sceneryT = 0;
// salas, masmorra, arena e castelo ficam longe do mundo (x > HALF+100): só desenha quando você está lá dentro
let interiorObjs = null, interiorShown = null;
function cullInteriors() {
  if (!interiorObjs) {
    interiorObjs = [];
    const skip = new Set([...S.monsters.map(m => m.obj), ...S.npcs.map(n => n.obj), S.me && S.me.obj, S.pet && S.pet.obj]);
    const b = new THREE.Box3(), c = new THREE.Vector3();
    for (const o of scene.children) { if (skip.has(o) || o.isLight || o.isCamera || o.visible === false || o.userData.noRender) continue; /* não liga de volta o que nasceu escondido (bloqueadores de câmera) */ b.setFromObject(o); if (b.isEmpty()) continue; b.getCenter(c); if (c.x > HALF + 100 && b.min.x > HALF + 50) interiorObjs.push(o); }
  }
  const inside = camera.position.x > HALF + 100;
  if (inside === interiorShown) return; interiorShown = inside;
  for (const o of interiorObjs) o.visible = inside;
}
function cullScenery() {
  if (S.time - sceneryT < 0.5) return; sceneryT = S.time;
  const x = S.interior ? S.interior.back.x : S.pos.x, z = S.interior ? S.interior.back.z : S.pos.z;
  for (const o of placed) { if (o.userData.big) continue; const a = o.userData.asset; if (!a || /^(cloud|mountain)/.test(a)) continue; o.visible = Math.hypot(o.position.x - x, o.position.z - z) < (/^(home|tavern|church|blacksmith|market|windmill|tower|destroyed|wall)/.test(a) ? 330 : 200); } // prédios aparecem de mais longe
}
function place(name, x, z, o = {}) {
  const g = MODELS[name]; if (!g) return null;
  const obj = g.scene.clone(true);
  const native = !!g.native; // árvores feitas em código já estão em metros
  const s = (native ? 1 : WS) * (o.scale || 1) * (TYPE_SCALE[name] || 1);
  obj.scale.setScalar(s);
  obj.rotation.y = o.rot ?? rng() * Math.PI * 2;
  let gy = o.y ?? heightAt(x, z);
  if (o.y === undefined && !native && /^(home|tavern|blacksmith|church|windmill|tower|destroyed|well)/.test(name)) { // S-109: prédio em encosta assenta no ponto mais baixo do terreno sob ele (nada de base flutuando)
    const b = bbox(name), cs = Math.cos(obj.rotation.y), sn = Math.sin(obj.rotation.y);
    for (const [lx, lz] of [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z], [(b.min.x + b.max.x) / 2, b.max.z], [(b.min.x + b.max.x) / 2, b.min.z]]) gy = Math.min(gy, heightAt(x + (lx * cs + lz * sn) * s * 0.95, z + (-lx * sn + lz * cs) * s * 0.95));
    gy -= 0.08;
  }
  if (o.y === undefined && native) { const rr = Math.max(0.4, (g.radius || 0.5) * s); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; gy = Math.min(gy, heightAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr)); } } // em encosta, assenta no ponto mais baixo
  obj.position.set(x, gy - (o.sink || 0), z);
  scene.add(obj);
  obj.userData.asset = name; placed.push(obj);
  if (/^(mountain|cloud)/.test(name)) obj.traverse(m => { if (m.isMesh) m.castShadow = false; });
  if (o.solid !== false && !/^(fence|flag|lily|cloud)/.test(name)) occluders.push(obj);
  if (o.solid !== false) {
    const b = bbox(name);
    if (native || o.r || /^(lily|cloud|mountain)/.test(name)) {
      const r = o.r ?? (native && g.radius ? g.radius * s : Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 * s * (o.rf || 0.75));
      colliders.push({ x, z, r, name });
    } else { // caixa do tamanho real do objeto (girada junto): nada de entrar em tenda, caixote, casa...
      const rot = obj.rotation.y, cs = Math.cos(rot), sn = Math.sin(rot);
      const lcx = (b.min.x + b.max.x) / 2 * s, lcz = (b.min.z + b.max.z) / 2 * s;
      const hx = (b.max.x - b.min.x) / 2 * s * 0.97, hz = (b.max.z - b.min.z) / 2 * s * 0.97;
      const cx = x + lcx * cs + lcz * sn, cz = z - lcx * sn + lcz * cs;
      colliders.push({ x: cx, z: cz, r: Math.max(hx, hz), box: true, hx, hz, rot, name });
    }
  }
  return obj;
}

/* ---------- vitórias-régias: plataformas que boiam (dá para pular de uma para outra) ---------- */
const padMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
function buildLilyPads() {
  S.pads = [];
  const add = (x, z, r) => {
    if (lakeDist(x, z) > LAKE.r - 1.2 || S.pads.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.25)) return;
    const mesh = new THREE.Mesh(lilyPadGeometry(S.pads.length * 7919 + 13, r), padMat);
    mesh.position.set(x, LAKE.level, z); mesh.rotation.y = rng() * Math.PI * 2; mesh.receiveShadow = true; mesh.castShadow = true;
    mesh.userData.asset = 'lilypad'; placed.push(mesh); scene.add(mesh);
    S.pads.push({ x, z, r, mesh, ph: rng() * 6.28, load: 0 });
  };
  // uma trilha de folhas da margem até o meio do lago
  const a0 = 2.3, edge = LAKE.r * lakeShape(LAKE.x + Math.cos(a0), LAKE.z + Math.sin(a0));
  for (let i = 0; i < 7; i++) { const rr = edge - 2.2 - i * 2.05, a = a0 + Math.sin(i * 1.7) * 0.18; add(LAKE.x + Math.cos(a) * rr, LAKE.z + Math.sin(a) * rr, 0.95 + (i % 3) * 0.18); }
  for (let k = 0; k < 40 && S.pads.length < 16; k++) { const a = rng() * 6.28, rr = rng() * LAKE.r * 0.85; add(LAKE.x + Math.cos(a) * rr, LAKE.z + Math.sin(a) * rr, 0.7 + rng() * 0.7); }
}
function padUnder(x, z, y) { // folha embaixo do ponto (só conta se você está acima dela)
  let best = null;
  for (const pd of S.pads || []) if (Math.hypot(x - pd.x, z - pd.z) < pd.r * 0.95 && y >= LAKE.level - 0.3 && (!best || pd.r > best.r)) best = pd;
  return best;
}
function updatePads(dt) {
  for (const pd of S.pads || []) {
    pd.load += ((pd === S.onPad ? 1 : 0) - pd.load) * Math.min(1, dt * 8);
    pd.mesh.position.y = LAKE.level + 0.05 + Math.sin(S.time * 1.3 + pd.ph) * 0.012 - pd.load * 0.03; // S-199: afunda só um tiquinho quando você pisa
    pd.mesh.rotation.z = Math.sin(S.time * 0.9 + pd.ph) * 0.015;
  }
}

/* ---------- feira: tira os caixotes quadradões do modelo e põe uma barraca de frutas com feirante ---------- */
function buildFruitMarket(mk) {
  const mesh = mk.getObjectByProperty('isMesh', true);
  if (mesh) { // remove os caixotes/frutas em bloco da frente do modelo
    const g = mesh.geometry.clone(), P = g.attributes.position, idx = g.index ? g.index.array : null, keep = [], tri = idx ? idx.length / 3 : P.count / 3;
    for (let t = 0; t < tri; t++) { const vs = [0, 1, 2].map(k => idx ? idx[t * 3 + k] : t * 3 + k); if (!vs.every(v => P.getZ(v) > 0.17 && P.getY(v) > 0.035 && P.getY(v) < 0.37)) keep.push(...vs); }
    g.setIndex(keep); mesh.geometry = g;
  }
  const rot = mk.rotation.y, fx = Math.sin(rot), fz = Math.cos(rot), s = mk.scale.x;
  const mc = colliders.find(c => c.name === 'market'); // a caixa da feira passa a cobrir só o prédio (a barraca fica na frente)
  if (mc && mc.box) { const lz = (-0.71 + 0.17) / 2 * s; mc.hz = (0.71 + 0.17) / 2 * s * 0.97; mc.x = mk.position.x + fx * lz; mc.z = mk.position.z + fz * lz; mc.r = Math.max(mc.hx, mc.hz); }
  const sx = mk.position.x + fx * 0.42 * s, sz = mk.position.z + fz * 0.42 * s;
  const stand = bakeStatic(makeFruitStand()); stand.position.set(sx, Math.max(mk.position.y, heightAt(sx, sz)), sz); stand.rotation.y = rot; scene.add(stand);
  stand.userData.asset = 'fruitstand'; placed.push(stand); occluders.push(stand);
  colliders.push({ x: sx, z: sz, r: 1.9, box: true, hx: 1.95, hz: 0.6, rot, name: 'fruitstand' });
  // feirante atrás da mesa, virada para a praça
  const nx = sx - fx * 1.05, nz = sz - fz * 1.05;
  const ch = makeNpcHero({ id: 'flora', model: 'Mage', look: { race: 'humano', sex: 'f', hair: { style: 'coque', color: 'acobreado' } } });
  ch.obj.position.set(nx, heightAt(nx, nz), nz); ch.obj.rotation.y = rot; ch.anim.play('Idle', { speed: 0.9 });
  const npc = { id: 'flora', name: 'Dona Flora', title: 'Feirante', x: nx, z: nz, ...ch, isNpc: true, height: 1.85, radius: 0.5 };
  ch.obj.add(hitbox(npc, 0.6, 2)); scene.add(ch.obj); colliders.push({ x: nx, z: nz, r: 0.5 }); S.npcs.push(npc);
}

/* ---------- chão: terreno lá fora, piso dentro das casas ---------- */
function groundAt(x, z) { if (x > HALF + 100) return 0; const h = heightAt(x, z), d = deckAt(x, z); return d !== null && d > h ? d : h; } // salas longe do mundo com chão em y = 0; cais do porto contam como chão
function roomAt(x, z) { for (const I of Object.values(INTERIORS)) if (Math.abs(x - I.x) < (I.round || I.w / 2) + 4 && Math.abs(z - I.z) < (I.round || I.d / 2) + 4) return I; return null; }

/* ---------- portais nas portas e salas internas ---------- */
const portals = [];
function addDoorPortal(id, x, z, faceYaw) {
  const mesh = makePortal('#8fdcff'); mesh.position.set(x, heightAt(x, z), z); scene.add(mesh);
  portals.push({ kind: 'door', to: id, x, z, mesh, out: { x: x + Math.sin(faceYaw) * 2.2, z: z + Math.cos(faceYaw) * 2.2, yaw: faceYaw } });
  INTERIORS[id].door = { x, z };
}
function buildInteriors() {
  for (const [id, I] of Object.entries(INTERIORS)) {
    const { group, walls } = buildRoomShell(I); scene.add(group); group.updateMatrixWorld(true);
    for (const w of walls) { scene.attach(w); occluders.push(w); }
    const F = (obj, x, z, rot = 0, r = 0) => { obj.position.set(I.x + x, 0, I.z + z); obj.rotation.y = rot; obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(obj); if (r) colliders.push({ x: I.x + x, z: I.z + z, r }); if (obj.userData.update) roomAnims.push(obj); return obj; };
    const P = (name, x, z, o = {}) => place(name, I.x + x, I.z + z, { y: 0, rf: 0.6, ...o });
    if (!I.dungeon) for (const [x, z] of [[-I.w / 4, -1], [I.w / 4, -1], [0, I.d / 4]]) { const l = F(lantern(), x, z); l.position.y = I.h - 0.9; }
    if (id === 'estabulo') {
      // três baias com as montarias em exposição
      Object.keys(MOUNTS).filter(k => !MOUNTS[k].premium).forEach((k, i) => {
        const sx = (i - 1) * 4.2;
        F(stall(3.4, 3.2), sx, -I.d / 2 + 2.1);
        const mt = makeMount(k); mt.obj.scale.setScalar(0.92); F(mt.obj, sx, -I.d / 2 + 2.2, 0.25 * (i - 1), 1.4); roomMounts.push(mt);
      });
      F(hayBale(), -I.w / 2 + 1.3, 1.2, 0.3, 0.8); F(hayBale(), -I.w / 2 + 1.3, 2.2, -0.2, 0.8); const hb = F(hayBale(), -I.w / 2 + 1.35, 1.7, 0.1); hb.position.y = 0.6;
      F(hayBale(), I.w / 2 - 1.4, 2.4, 1.4, 0.8);
      P('bucket', I.w / 2 - 1.2, 0.6); P('wheelbarrow', I.w / 2 - 2.0, -0.6, { rot: 2.2 }); P('sack', -I.w / 2 + 1.0, 3.6); P('lumber', I.w / 2 - 1.2, 4.0, { rot: 1.6 });
      roomNpc({ id: 'tome', name: 'Tomé', title: 'Tratador de Montarias', model: 'Barbarian', show: ['Barbarian_Hat'], hat: true, look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'castanho' }, beard: true } }, I.x - 2.2, I.z + 0.6, 0.4);
    } else if (id === 'taverna') {
      F(counter(5.2), -1.2, -I.d / 2 + 2.0, 0, 0); colliders.push({ x: I.x - 3.2, z: I.z - I.d / 2 + 2, r: 1.2 }, { x: I.x - 1.2, z: I.z - I.d / 2 + 2, r: 1.2 }, { x: I.x + 0.8, z: I.z - I.d / 2 + 2, r: 1.2 });
      F(fireplace(), -I.w / 2 + 0.6, 0.5, Math.PI / 2, 1.2);
      for (const [x, z] of [[1.2, 0.8], [3.6, 3.0], [-1.6, 3.2]]) { F(table(2.0), x, z, 0, 1.0); F(bench(2.0), x, z - 0.9); F(bench(2.0), x, z + 0.9); }
      P('barrel', I.w / 2 - 0.9, -I.d / 2 + 0.9); P('barrel', I.w / 2 - 1.8, -I.d / 2 + 0.9); P('barrel', I.w / 2 - 0.9, -I.d / 2 + 1.8); P('crate_A', I.w / 2 - 1.0, I.d / 2 - 1.2);
      // atrás do balcão há um estrado de madeira: a Dona Rosa fica na altura certa e dá para ver o rosto dela (S-077)
      const dais = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 1.0), new THREE.MeshStandardMaterial({ color: '#5a3c22', roughness: 0.9 })); dais.position.set(I.x - 1.2, 0.15, I.z - I.d / 2 + 0.95); dais.receiveShadow = true; scene.add(dais);
      const rosa = roomNpc({ id: 'rosa', name: 'Dona Rosa', title: 'Taverneira', model: 'Rogue', show: ['Mug'], look: { race: 'humano', face: 'alegre', hair: { style: 'coque', color: 'ruivo' } } }, I.x - 1.2, I.z - I.d / 2 + 1.0, 0); rosa.obj.position.y = 0.3;
      // Velho Gui sentado no banco, de frente para a mesa (S-079)
      roomNpc({ id: 'gui', name: 'Velho Gui', title: 'Contador de Histórias', model: 'Knight', show: ['Mug'], look: { race: 'humano', face: 'gentil', hair: { style: 'careca', color: 'branco' }, beard: true } }, I.x + 3.6, I.z + 2.0, 0, 'Sit_Chair_Idle');
    } else if (id === 'catacumbas') buildDungeonFloors();
    if (I.dungeon && I.level > 1) continue; // andares de baixo: sobe-se pela escada, não há saída para fora
    // saída: portal junto à porta
    const ex = makePortal('#ffd27a'); ex.position.set(I.x, 0, I.z + I.d / 2 - 0.9); scene.add(ex);
    portals.push({ kind: 'exit', from: id, x: I.x, z: I.z + I.d / 2 - 0.9, mesh: ex });
  }
}
const roomAnims = [], roomMounts = [];
// S-159: Catacumbas em 4 andares — escadas (portais) entre os andares
function buildDungeonFloors() {
  buildDungeon({ scene, colliders, occluders, roomAnims, INTERIORS });
  for (const F of FLOORS) {
    const next = FLOORS[F.n], prev = FLOORS[F.n - 2];
    if (F.down && next) { const m = makePortal('#b08aff'); m.position.set(F.down.x, 0.05, F.down.z); scene.add(m); portals.push({ kind: 'floor', from: F.id, to: next.id, x: F.down.x, z: F.down.z, mesh: m, arrive: next.entry }); }
    if (F.up && prev) { const m = makePortal('#9ae0ff'); m.position.set(F.up.x, 0, F.up.z); scene.add(m); portals.push({ kind: 'floor', from: F.id, to: prev.id, x: F.up.x, z: F.up.z, mesh: m, arrive: prev.arriveUp }); }
  }
}
function goFloor(pt) {
  const I = INTERIORS[pt.to], back = S.interior.back;
  fadeTo(() => {
    S.interior = { id: pt.to, ...I, back };
    Object.assign(S.pos, { x: pt.arrive.x, z: pt.arrive.z, y: 0, vy: 0, ground: true, yaw: pt.arrive.yaw }); S.vel = { x: 0, z: 0 }; S.cam.yaw = S.cam.viewYaw = pt.arrive.yaw;
    setTarget(null); S.casting = null; S.fallTop = null;
    if (S.pet) { S.pet.x = S.pos.x + 1; S.pet.z = S.pos.z + 1; S.pet.vx = S.pet.vz = 0; }
    $('mapname').innerHTML = `${I.name} <small>Masmorra</small>`; banner(I.name, I.region || '');
    S.portalCd = S.time + 2; Sound.play('portal');
  });
}
function roomNpc(n, x, z, yaw, anim = 'Idle') {
  const ch = makeNpcHero(n);
  ch.obj.position.set(x, 0, z); ch.obj.rotation.y = yaw; ch.anim.play(anim, { speed: 0.9 });
  if (anim === 'Sit_Chair_Idle') ch.obj.position.y = 0.0;
  const npc = { ...n, x, z, ...ch, isNpc: true, height: 1.85, radius: 0.5 };
  ch.obj.add(hitbox(npc, 0.6, 2)); scene.add(ch.obj); colliders.push({ x, z, r: 0.6 }); S.npcs.push(npc);
  return npc;
}
function fadeTo(fn) {
  let f = $('fade3d'); if (!f) { f = document.createElement('div'); f.id = 'fade3d'; document.body.appendChild(f); }
  f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 120); }, 260);
}
function enterInterior(id, from) {
  const I = INTERIORS[id];
  fadeTo(() => {
    S.interior = { id, ...I, back: from.out };
    Object.assign(S.pos, { x: I.x, z: I.z + I.d / 2 - 2.8, y: 0, vy: 0, ground: true, yaw: Math.PI });
    S.vel = { x: 0, z: 0 }; S.cam.yaw = S.cam.viewYaw = Math.PI; S.cam.distT = Math.min(S.cam.distT, 6);
    setTarget(null); S.casting = null;
    if (S.pet) { S.pet.x = S.pos.x + 1.2; S.pet.z = S.pos.z + 0.8; S.pet.vx = S.pet.vz = 0; }
    if (S.riding) dismount(true);
    $('mapname').innerHTML = `${I.name} <small>${I.dungeon ? 'Masmorra' : 'Interior'}</small>`; banner(I.name, I.region || 'Vila de Alvorada');
    if (I.music) Sound.playSong(I.music);
    S.portalCd = S.time + 1.2; Sound.play('portal');
  });
}
function leaveInterior(instant) {
  const back = S.interior && S.interior.back; if (!back) return;
  if (S.arena) arenaLeave();
  const go = () => {
    S.interior = null; S.zone = null;
    Object.assign(S.pos, { x: back.x, z: back.z, y: heightAt(back.x, back.z), vy: 0, ground: true, yaw: back.yaw });
    S.vel = { x: 0, z: 0 }; S.cam.yaw = S.cam.viewYaw = back.yaw;
    if (S.pet) { S.pet.x = back.x - Math.sin(back.yaw) * 1.5; S.pet.z = back.z - Math.cos(back.yaw) * 1.5; S.pet.vx = S.pet.vz = 0; }
    S.portalCd = S.time + 1.2;
  };
  if (instant) go(); else { fadeTo(go); Sound.play('portal'); }
}
function updatePortals(dt) {
  for (const o of roomAnims) o.userData.update(S.time);
  for (const m of roomMounts) if (S.interior) m.animate(S.time, { speed: 0, turn: 0 }, dt);
  const P = S.pos;
  for (const pt of portals) {
    if (Math.abs(pt.x - P.x) > 60 || Math.abs(pt.z - P.z) > 60) continue;
    pt.mesh.userData.update(S.time);
    if (S.p.dead || S.time < (S.portalCd || 0) || Math.hypot(pt.x - P.x, pt.z - P.z) > 1.0) continue;
    if (pt.kind === 'door' && !S.interior) enterInterior(pt.to, pt);
    else if (pt.kind === 'exit' && S.interior && S.interior.id === pt.from) leaveInterior(false);
    else if (pt.kind === 'floor' && S.interior && S.interior.id === pt.from) goFloor(pt);
    S.portalCd = S.time + 2;
  }
}

/* ---------- montaria (tecla M) ---------- */
function mount() {
  const p = S.p; if (!p.mount) { log('Você ainda não tem montaria. Fale com o Tomé, no estábulo da vila.', 'warn'); Sound.play('error'); return; }
  if (S.interior) { log('Aqui dentro não dá para montar.', 'warn'); return; }
  if (p.dead || S.casting) return;
  const R = makeMount(p.mount.kind); R.obj.position.set(S.pos.x, S.pos.y, S.pos.z); R.obj.rotation.y = S.pos.yaw; scene.add(R.obj);
  S.riding = R; S.sitting = false; S.autoAttack = false;
  ring(S.pos, 1.8, '#ffe08a'); Sound.play('portal'); log(`🐎 Você montou no ${MOUNTS[p.mount.kind].name}. (M desmonta)`, 'sys');
}
function dismount(silent) {
  if (!S.riding) return;
  scene.remove(S.riding.obj); S.riding = null;
  if (!silent) { ring(S.pos, 1.4, '#ffe08a'); Sound.play('click'); }
}
function toggleMount() { if (S.riding && S.riding.war) { log('Você está na Montaria de Guerra: use a habilidade de novo para descer.', 'warn'); return; } if (S.riding) dismount(); else mount(); }

/* ---------- Mapa de Aethra (tecla G ou clique no minimapa) — para todos os jogadores ---------- */
let mapaTimer = null;
function renderMapa() {
  const body = UI.body('mapa');
  // S-171: ao lado do mapa, os monstros de cada região (com quantidade); S-176: as missões aparecem no mapa
  const zm = H3.zoneMobs ? H3.zoneMobs() : {}, seenL = S.p.seen || [], all = isAdmin() && S.god;
  const regions = Object.entries(zm).map(([zn, mobs]) => `<div class="mp-reg"><div class="mp-rn">${escH(zn)}</div>${Object.entries(mobs).sort((a, b) => MONSTERS[a[0]].lv - MONSTERS[b[0]].lv).map(([mid, n]) => { const ok = all || seenL.includes(mid); return `<div class="mp-mob ${ok ? '' : 'unseen'}" data-mob="${mid}" title="Abrir no Bestiário"><img src="${monsterThumb(mid)}" alt=""><span>${ok ? escH(MONSTERS[mid].name) : '???'}</span><small>Nv. ${MONSTERS[mid].lv} · ×${n}</small></div>`; }).join('')}</div>`).join('');
  body.innerHTML = `<div class="mp-wrap"><div><canvas id="mapa-cv" width="680" height="680" style="width:100%;border-radius:8px;display:block"></canvas>
    <div class="muted" style="font-size:11px;margin-top:6px">★ NPCs · 💀 mini-chefes · 👑 chefe · <b class="gold">! ? ⚔</b> suas missões · a seta é você. Feche com G ou Esc.</div></div>
    <div class="mp-side"><div class="mp-h">Monstros por região</div>${regions}</div></div>`;
  body.querySelectorAll('[data-mob]').forEach(el => el.onclick = () => { UI.bestSel = el.dataset.mob; UI.open('bestiario'); UI.render_bestiario(); });
  const cv = $('mapa-cv'), draw = () => { if (S.interior && !S.interior.dungeon && roomMap(cv.getContext('2d'), cv.width, S.pos.x, S.pos.z, 40, true)) return; if (S.interior && S.interior.dungeon && dungeonMap(cv.getContext('2d'), cv.width, S.pos.x, S.pos.z, 40, { whole: true, yaw: S.pos.yaw, monsters: S.monsters.filter(m => !m.dead && m.x > HALF + 100 && Math.abs(m.z - S.interior.z) < 36).map(m => ({ x: m.x, z: m.z, boss: m.def.boss })) })) return; drawAdmMap(cv); }; draw();
  clearInterval(mapaTimer); mapaTimer = setInterval(() => { if (!UI.wins.mapa || !document.body.contains(cv)) { clearInterval(mapaTimer); return; } draw(); }, 400);
}

/* ---------- Loja de Auroras ✦ (só cosméticos: skins e montarias) ---------- */
const AURORA_PACKS = [{ n: 500, price: 'R$ 9,90' }, { n: 1100, price: 'R$ 19,90', bonus: '+10%' }, { n: 2400, price: 'R$ 39,90', bonus: '+20%' }, { n: 6500, price: 'R$ 99,90', bonus: '+30%' }];
function cosm() { const p = S.p; if (!p.cosmetics) p.cosmetics = { auroras: 0, skins: [], skin: null, mounts: [] }; return p.cosmetics; }
let lojaTab = 'skins';
/* Loja de Auroras (S-135/S-136): lista à esquerda com miniatura de verdade de cada item e, à direita,
   uma prévia 3D grande (arraste para girar) mostrando a skin no SEU personagem ou a montaria com você em cima. */
let lojaSel = null, lojaStop = null;
const lojaThumbs = {};
function lojaObj(kind, k) {
  if (kind === 'skin') { const { ch } = makeHero(S.p.cls, S.p.look, hatOf(S.p)); try { applySkin(ch, k); } catch (e) { } ch.anim.play('Idle'); return { obj: ch.obj, tick: dt => ch.anim.update(dt) }; }
  const mt = makeMount(k), g = new THREE.Group(); g.add(mt.obj);
  const { ch } = makeHero(S.p.cls, S.p.look, hatOf(S.p)); ch.anim.play('Sit_Chair_Idle'); ch.obj.position.set(0, (mt.saddleY || 1.5) + (mt.bodyY || 0) - 0.52, 0); g.add(ch.obj);
  return { obj: g, tick: (dt, t) => { mt.animate && mt.animate(t, { speed: 0, turn: 0 }, dt); ch.anim.update(dt); riderPose(ch, mt, { t }); } };
}
function lojaThumb(kind, k) {
  const key = kind + ':' + k + ':' + S.p.cls; if (lojaThumbs[key]) return lojaThumbs[key];
  const o = lojaObj(kind, k); o.obj.position.set(900, 0, 900); o.obj.rotation.y = 0.6; scene.add(o.obj); o.tick(0.3, 1);
  const url = renderObj(o.obj, 120, 120); scene.remove(o.obj); return (lojaThumbs[key] = url);
}
function lojaLive(kind, k, cv) { return objViewer(cv, () => { const o = lojaObj(kind, k); return { obj: o.obj, tick: o.tick }; }, { yaw: 0.6, autoSpin: 0.4, dist: 0.92 }); } // S-240: sem travar ao arrastar
function lojaLiveOld(kind, k, cv) {
  const o = lojaObj(kind, k); o.obj.position.set(940, 0, 900); scene.add(o.obj); o.obj.traverse(x => x.layers.enable(1)); o.tick(0.1, 0); o.obj.updateMatrixWorld(true);
  const W = cv.width, H = cv.height, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), buf = new Uint8Array(W * H * 4);
  const box = new THREE.Box3().setFromObject(o.obj), sph = box.getBoundingSphere(new THREE.Sphere()), cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 80); cam.layers.set(1);
  let t = 0, last = performance.now(), alive = true, spin = 0.6, drag = null;
  cv.style.cursor = 'grab';
  cv.onpointerdown = e => { if (e.button !== 0 || FB.picking || FB.box) return; e.preventDefault(); drag = e.clientX; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (er) { } };
  cv.onpointermove = e => { if (drag === null) return; spin += (e.clientX - drag) * 0.012; drag = e.clientX; };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; cv.style.cursor = 'grab'; };
  const frame = () => {
    if (!alive || !document.body.contains(cv)) { alive = false; scene.remove(o.obj); rt.dispose(); return; }
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; if (drag === null) spin += dt * 0.4;
    o.obj.rotation.y = spin; o.tick(dt, t);
    const d = sph.radius / Math.sin(15 * Math.PI / 180) * 0.92; cam.position.set(sph.center.x, sph.center.y + sph.radius * 0.25, sph.center.z + d); cam.lookAt(sph.center);
    const bg = scene.background, fog = scene.fog, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    scene.background = null; scene.fog = null; renderer.setClearColor(0, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); renderer.setRenderTarget(null); scene.background = bg; scene.fog = fog; renderer.setClearColor(cc, ca);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    g.putImageData(img, 0, 0); setTimeout(() => requestAnimationFrame(frame), 30);
  };
  frame(); return () => { alive = false; scene.remove(o.obj); };
}
function renderLoja() {
  const c = cosm(), body = UI.body('loja');
  if (lojaStop) { lojaStop(); lojaStop = null; }
  const tabs = `<div class="tabs"><div class="tab ${lojaTab === 'skins' ? 'on' : ''}" data-lt="skins">🎨 Visuais da classe</div><div class="tab ${lojaTab === 'montarias' ? 'on' : ''}" data-lt="montarias">🐆 Montarias</div><div class="tab ${lojaTab === 'auroras' ? 'on' : ''}" data-lt="auroras">✦ Comprar Auroras</div></div>`;
  const head = `<div class="lj-head"><div><b class="lj-title">Loja de Auroras</b><div class="muted" style="font-size:11px">Só visual: nada aqui dá vantagem em combate.</div></div><div class="lj-bal">✦ <b>${c.auroras.toLocaleString('pt-BR')}</b> Auroras</div></div>`;
  if (lojaTab === 'auroras') {
    body.innerHTML = head + tabs + `<div class="lj-grid four">${AURORA_PACKS.map(pk => `<div class="lj-item pack"><div class="lj-big">✦</div><div class="lj-n">${pk.n.toLocaleString('pt-BR')} Auroras</div><div class="lj-r">${pk.bonus || '&nbsp;'}</div><button class="btn" disabled>${pk.price}</button></div>`).join('')}</div>
      <div class="lj-note">💳 A compra com dinheiro de verdade ainda não está ligada: precisa de um sistema de pagamento e de contas online (com servidor). Por enquanto, no seu computador, o Painel do Mestre (⌘Z) dá Auroras de teste.</div>`;
  } else {
    const kind = lojaTab === 'skins' ? 'skin' : 'mount';
    const list = kind === 'skin' ? Object.entries(SKINS) : Object.entries(MOUNTS).filter(([, m]) => m.premium);
    if (!list.some(([k]) => k === lojaSel)) lojaSel = list[0] && list[0][0];
    const items = list.map(([k, it]) => { const R = RARITY[it.rarity], own = kind === 'skin' ? c.skins.includes(k) : c.mounts.includes(k), on = kind === 'skin' ? c.skin === k : S.p.mount && S.p.mount.kind === k;
      return `<div class="lj-card ${k === lojaSel ? 'sel' : ''}" style="--rc:${R.color}" data-lsel="${k}"><img src="${lojaThumb(kind, k)}" alt=""><div class="lj-ct"><div class="lj-n">${it.name}</div><div class="lj-r">${R.name}</div><div class="lj-st">${on ? '✔ Em uso' : own ? 'Comprado' : `✦ ${it.price.toLocaleString('pt-BR')}`}</div></div></div>`; }).join('');
    const it = kind === 'skin' ? SKINS[lojaSel] : MOUNTS[lojaSel], R = RARITY[it.rarity], own = kind === 'skin' ? c.skins.includes(lojaSel) : c.mounts.includes(lojaSel), on = kind === 'skin' ? c.skin === lojaSel : S.p.mount && S.p.mount.kind === lojaSel;
    const btn = own ? (kind === 'skin' ? `<button class="btn ${on ? '' : 'gold'} lj-cta" data-skin="${lojaSel}">${on ? '✔ Usando (clique para tirar)' : 'Usar este visual'}</button>` : `<button class="btn ${on ? '' : 'gold'} lj-cta" data-mnt="${lojaSel}">${on ? '✔ Montaria atual' : 'Usar esta montaria'}</button>`)
      : `<button class="btn gold lj-cta" ${c.auroras < it.price ? 'disabled' : ''} data-${kind === 'skin' ? 'buy-skin' : 'buy-mnt'}="${lojaSel}">Comprar por ✦ ${it.price.toLocaleString('pt-BR')}</button>${c.auroras < it.price ? `<div class="lj-miss">Faltam ✦ ${(it.price - c.auroras).toLocaleString('pt-BR')}</div>` : ''}`;
    body.innerHTML = head + tabs + `<div class="lj2"><div class="lj-list">${items}</div><div class="lj-prev" style="--rc:${R.color}"><canvas id="lj-live" width="360" height="360"></canvas><div class="lj-hint">arraste para girar</div>
      <div class="lj-pn">${it.name}</div><div class="lj-pr">${R.name}${kind === 'skin' ? ` · para ${CLASSES[S.p.cls].name}` : ' · mesma velocidade das outras'}</div><div class="lj-pd">${it.desc}</div>${btn}</div></div>
      <div class="muted" style="font-size:11px;margin-top:6px">${kind === 'skin' ? 'Visuais trocam as cores e o brilho da roupa da sua classe atual; seu rosto e cabelo ficam iguais.' : 'Aperte M no mundo para montar. A prévia mostra você em cima dela.'}</div>`;
    lojaStop = lojaLive(kind, lojaSel, $('lj-live'));
  }
  const buy = (price, fn) => { if (c.auroras < price) { log('Auroras insuficientes.', 'warn'); Sound.play('error'); return; } c.auroras -= price; fn(); Sound.play('card'); save3d(); renderLoja(); hudDirty = true; };
  body.querySelectorAll('[data-lt]').forEach(el => el.onclick = () => { lojaTab = el.dataset.lt; lojaSel = null; Sound.play('click'); renderLoja(); });
  body.querySelectorAll('[data-lsel]').forEach(el => el.onclick = () => { lojaSel = el.dataset.lsel; Sound.play('click'); renderLoja(); });
  body.querySelectorAll('[data-buy-skin]').forEach(el => el.onclick = () => { const k = el.dataset.buySkin; buy(SKINS[k].price, () => { c.skins.push(k); c.skin = k; buildPlayerModel(); banner('Novo visual!', SKINS[k].name); }); });
  body.querySelectorAll('[data-skin]').forEach(el => el.onclick = () => { const k = el.dataset.skin; c.skin = c.skin === k ? null : k; buildPlayerModel(); Sound.play('click'); save3d(); renderLoja(); });
  body.querySelectorAll('[data-buy-mnt]').forEach(el => el.onclick = () => { const k = el.dataset.buyMnt; buy(MOUNTS[k].price, () => { c.mounts.push(k); S.p.mount = { kind: k }; if (S.riding) { dismount(true); mount(); } banner('Nova montaria!', MOUNTS[k].name); }); });
  body.querySelectorAll('[data-mnt]').forEach(el => el.onclick = () => { S.p.mount = { kind: el.dataset.mnt }; if (S.riding) { dismount(true); mount(); } Sound.play('click'); save3d(); renderLoja(); });
}

/* =========================================================================
   ARENA PvP — o servidor guarda o HP de todos; cada aba manda posição e golpes
   ========================================================================= */
const ARENA_I = { name: 'Arena de Aethra', x: 800, z: 0, w: 46, d: 46, h: 8, round: 21 };
function buildArena() {
  const A = ARENA_I, g = new THREE.Group(); g.position.set(A.x, 0, A.z); scene.add(g);
  const M = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...e });
  // chão de areia batida com desenho
  const floor = new THREE.Mesh(new THREE.CircleGeometry(23, 72), M('#cdb386')); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  for (const [r, w, c] of [[4, 0.25, '#a8885a'], [9, 0.18, '#b89a68'], [15, 0.18, '#b89a68'], [20.6, 0.4, '#8f7550']]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 72), M(c)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; g.add(ring); }
  g.add(arenaEmblem()); // S-120: medalhão de pedra gravado no centro (no lugar do hexágono vermelho)
  // muralha circular de pedra aparelhada (S-121: tijolos de pedra de verdade, com relevo) com ameias e arquibancada
  const brick = stoneBrickTex(), wallM = new THREE.MeshStandardMaterial({ map: brick.map, bumpMap: brick.bump, bumpScale: 2.2, roughness: 0.95 });
  const wallTex = { map: brick.map.clone(), bump: brick.bump.clone() }; for (const t of Object.values(wallTex)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 1); t.needsUpdate = true; }
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(21.6, 21.6, 3.2, 96, 1, true), new THREE.MeshStandardMaterial({ map: wallTex.map, bumpMap: wallTex.bump, bumpScale: 2.2, roughness: 0.95, side: THREE.DoubleSide })); wall.position.y = 1.6; wall.receiveShadow = true; g.add(wall);
  const capM = new THREE.MeshStandardMaterial({ map: brick.map, bumpMap: brick.bump, bumpScale: 1.5, roughness: 0.95 });
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.6), capM); b.position.set(Math.cos(a) * 21.7, 3.55, Math.sin(a) * 21.7); b.rotation.y = -a + Math.PI / 2; b.castShadow = true; g.add(b); }
  for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(23 + k * 1.3, 23 + k * 1.3, 0.6, 72, 1, true), new THREE.MeshStandardMaterial({ color: k % 2 ? '#7a5a3a' : '#6a4a2e', roughness: 1, side: THREE.DoubleSide })); st.position.y = 3.6 + k * 0.6; g.add(st); }
  // pilares com tochas e estandartes (vermelho x azul)
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = Math.cos(a) * 20.4, z = Math.sin(a) * 20.4;
    if (Math.abs(a - Math.PI / 2) < 0.2) continue; // vão do portão (sul)
    const pilTex = { map: brick.map.clone(), bump: brick.bump.clone() }; for (const t of Object.values(pilTex)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.4); t.needsUpdate = true; }
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 4.6, 20), new THREE.MeshStandardMaterial({ map: pilTex.map, bumpMap: pilTex.bump, bumpScale: 2, roughness: 0.95, color: '#d8d2c4' })); pil.position.set(x, 2.3, z); pil.castShadow = true; g.add(pil);
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.6, 0.35, 20), M('#8a8378')); capital.position.set(x, 4.65, z); g.add(capital);
    colliders.push({ x: A.x + x, z: A.z + z, r: 0.7 });
    // S-121: tocha de verdade — suporte de ferro preso no pilar, cabo de madeira com pano enrolado e chama em camadas
    const torch = makeWallTorch(i); torch.scale.setScalar(1.6); torch.position.set(Math.cos(a) * 19.84, 3.95, Math.sin(a) * 19.84); torch.rotation.y = -a - Math.PI / 2; g.add(torch);
    if (i % 3 === 0) { const l = vlight('#ffb060', 5, 14, 1.6); l.position.set(0, 0.75, 0.25); torch.add(l); }
    // estandarte de tecido com brasão pintado (e cartazes do torneio entre os pilares)
    const ban = makeBanner(i % 2); ban.position.set(Math.cos(a) * 19.72, 3.35, Math.sin(a) * 19.72); ban.rotation.y = -a - Math.PI / 2; g.add(ban);
    const b2 = i + 0.5, a2 = b2 / 12 * Math.PI * 2;
    if (Math.abs(a2 - Math.PI / 2) > 0.3) { const post = makePoster(i); post.position.set(Math.cos(a2) * 21.5, 1.75, Math.sin(a2) * 21.5); post.rotation.y = -a2 - Math.PI / 2; g.add(post); }
  }
  g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  INTERIORS.arena = ARENA_I;
  const ex = makePortal('#ffd27a'); ex.position.set(A.x, 0, A.z + 18.5); scene.add(ex);
  portals.push({ kind: 'exit', from: 'arena', x: A.x, z: A.z + 18.5, mesh: ex });
  const el = document.createElement('div'); el.id = 'arena-hud'; el.className = 'hidden'; document.body.appendChild(el);
}
const arenaFlames = [];
// S-124: quadro pintado com a tabela de refino (na parede do Mestre Brakar, em Pedrafunda)
function refineBoardTex() {
  const W = 768, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2a1a'); g.addColorStop(1, '#22180e'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; x.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 30, 1); }
  x.fillStyle = '#ffd77a'; x.font = 'bold 44px serif'; x.textAlign = 'center'; x.fillText('⚒ REFINO DE BRAKAR ⚒', W / 2, 60);
  x.font = 'italic 20px serif'; x.fillStyle = '#e8d4a8'; x.fillText('Ferrolume para armas (+ATQ) · Pedra-Égide para armaduras (+DEF)', W / 2, 92);
  const ch = typeof REFINE_CHANCE !== 'undefined' ? REFINE_CHANCE : [1, 1, 1, 1, 0.8, 0.65, 0.5, 0.35, 0.22, 0.12];
  const bw = 58, gap = 12, x0 = (W - (bw * 10 + gap * 9)) / 2, base = 400, top = 140;
  ch.forEach((v, i) => { const bx = x0 + i * (bw + gap), h = (base - top) * v; x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(bx, top, bw, base - top); x.fillStyle = i < 4 ? '#4ac060' : v >= 0.5 ? '#e0b030' : '#d0402a'; x.fillRect(bx, base - h, bw, h);
    x.fillStyle = '#fff6dc'; x.font = 'bold 24px serif'; x.fillText('+' + (i + 1), bx + bw / 2, base + 32); x.font = '18px serif'; x.fillText(Math.round(v * 100) + '%', bx + bw / 2, base - h - 8); });
  x.font = 'bold 20px serif'; x.fillStyle = '#8aff9a'; x.fillText('+1 a +4: SEGURO', W * 0.2, 478); x.fillStyle = '#ffd84a'; x.fillText('+5 a +7: ARRISCADO', W / 2, 478); x.fillStyle = '#ff7a5a'; x.fillText('+8 a +10: PODE QUEBRAR', W * 0.8, 478);
  x.strokeStyle = '#8a6a3a'; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* Auditoria: praças com calçamento de pedra de verdade (no lugar do chão bege liso) — disco que acompanha o terreno, pedras irregulares com relevo e borda que se mistura ao chão */
let _cobble = null;
function cobbleTex() {
  if (_cobble) return _cobble;
  const W = 1024, c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = b.width = W; c.height = b.height = W;
  const x = c.getContext('2d'), y = b.getContext('2d'); let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#5e5446'; x.fillRect(0, 0, W, W); y.fillStyle = '#202020'; y.fillRect(0, 0, W, W);
  // pedras em "leque" (calçada portuguesa/medieval): linhas curvas de paralelepípedos
  for (let row = 0; row < 40; row++) { const yy = row * 26 + (r() - 0.5) * 4; let xx = -r() * 30; while (xx < W) { const w = 22 + r() * 18, h = 20 + r() * 6; const cx = xx + w / 2, cy = yy + h / 2 + Math.sin(xx * 0.01 + row) * 3;
    const tone = 118 + r() * 62, warm = 10 + r() * 22; x.fillStyle = `rgb(${tone + warm},${tone + warm * 0.55},${tone - 14})`; x.beginPath(); x.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, (r() - 0.5) * 0.3, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,240,0.10)'; x.beginPath(); x.ellipse(cx - 2, cy - 3, w / 2 - 6, h / 2 - 7, 0, 0, 7); x.fill();
    if (r() < 0.25) { x.fillStyle = 'rgba(70,95,45,0.35)'; x.beginPath(); x.ellipse(cx + w / 2, cy, 3, 6, 0, 0, 7); x.fill(); } // musgo entre as pedras
    const gr = y.createRadialGradient(cx, cy - 2, 2, cx, cy, w / 2); gr.addColorStop(0, '#e0e0e0'); gr.addColorStop(0.8, '#a0a0a0'); gr.addColorStop(1, '#303030'); y.fillStyle = gr; y.beginPath(); y.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, 0, 0, 7); y.fill();
    xx += w; } }
  const dirt = x.createRadialGradient(W / 2, W / 2, W * 0.1, W / 2, W / 2, W * 0.7); dirt.addColorStop(0, 'rgba(90,70,50,0)'); dirt.addColorStop(1, 'rgba(90,70,50,0.25)'); x.fillStyle = dirt; x.fillRect(0, 0, W, W);
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b); map.colorSpace = THREE.SRGBColorSpace; for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return (_cobble = { map, bump });
}
function cobblePlaza(cx, cz, R, rep = 6) {
  const geo = new THREE.CircleGeometry(R, 72, 0, Math.PI * 2), P = geo.attributes.position, cols = new Float32Array(P.count * 4);
  // subdivide em anéis para acompanhar o relevo
  const rings = 14, segs = 72, pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) { const rr = R * i / rings, a = j / segs * Math.PI * 2, x = cx + Math.cos(a) * rr * (i === rings ? 1 + Math.sin(a * 5) * 0.06 : 1), z = cz + Math.sin(a) * rr * (i === rings ? 1 + Math.sin(a * 5) * 0.06 : 1);
    pos.push(x - cx, heightAt(x, z) + 0.03, z - cz); uv.push((x - cx) / R * rep, (z - cz) / R * rep); const edge = Math.min(1, Math.max(0, (R - rr) / (R * 0.18))); col.push(1, 1, 1, edge); }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const A = i * (segs + 1) + j, B = A + segs + 1; idx.push(A, A + 1, B, A + 1, B + 1, B); } // virado para cima
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const t = cobbleTex(), m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 3, roughness: 0.92, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(cx, 0, cz); m.receiveShadow = true; m.renderOrder = 1; scene.add(m); m.userData.asset = 'calcamento'; placed.push(m); m.userData.big = true;
  return m;
}
let _puff = null;
function cloudPuffTex() { // textura de nuvem: várias bolhas suaves de ruído, borda que some, sem forma geométrica
  if (_puff) return _puff;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d');
  for (let k = 0; k < 60; k++) { const px = W / 2 + (Math.random() - 0.5) * W * 0.55, py = W / 2 + (Math.random() - 0.5) * W * 0.32, r = 18 + Math.random() * 46, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, W); }
  const mask = x.createRadialGradient(W / 2, W / 2, W * 0.15, W / 2, W / 2, W / 2); mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = mask; x.fillRect(0, 0, W, W);
  _puff = new THREE.CanvasTexture(c); _puff.colorSpace = THREE.SRGBColorSpace; return _puff;
}
/* ---------- S-120/S-121: peças da Arena ---------- */
// textura de pedra aparelhada (tijolos de tamanhos e tons variados, argamassa funda) + mapa de relevo
let _brickTex = null;
function stoneBrickTex() {
  if (_brickTex) return _brickTex;
  const W = 512, H = 256, c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = b.width = W; c.height = b.height = H;
  const g = c.getContext('2d'), gb = b.getContext('2d'); let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#4c473f'; g.fillRect(0, 0, W, H); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
  let y = 0, row = 0;
  while (y < H) {
    const h = 30 + rnd() * 12; let x = row % 2 ? -rnd() * 40 : 0;
    while (x < W) {
      const w = 46 + rnd() * 50, l = 0.85 + rnd() * 0.3, hue = 34 + rnd() * 12;
      g.fillStyle = `hsl(${hue}, ${6 + rnd() * 8}%, ${44 * l}%)`; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 5); g.fill();
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,240' : '20,18,15'},${rnd() * 0.08})`; g.fillRect(x + 3 + rnd() * (w - 8), y + 3 + rnd() * (h - 8), 2 + rnd() * 7, 1 + rnd() * 4); } // granulado
      if (rnd() < 0.25) { g.strokeStyle = 'rgba(30,26,22,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + rnd() * w, y + 3); g.lineTo(x + rnd() * w, y + h - 3); g.stroke(); } // rachadura
      const gr = gb.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.5, '#d8d8d8'); gr.addColorStop(1, '#808080'); gb.fillStyle = gr; gb.beginPath(); gb.roundRect(x + 3, y + 3, w - 6, h - 6, 6); gb.fill();
      if (x + w > W) { g.save(); g.translate(-W, 0); g.fillStyle = `hsl(${hue}, 8%, ${44 * l}%)`; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 5); g.fill(); g.restore(); gb.save(); gb.translate(-W, 0); gb.fillStyle = '#c0c0c0'; gb.beginPath(); gb.roundRect(x + 3, y + 3, w - 6, h - 6, 6); gb.fill(); gb.restore(); }
      x += w;
    }
    y += h; row++;
  }
  // sujeira escura embaixo e musgo leve
  const dirt = g.createLinearGradient(0, H * 0.6, 0, H); dirt.addColorStop(0, 'rgba(40,30,20,0)'); dirt.addColorStop(1, 'rgba(40,30,20,0.35)'); g.fillStyle = dirt; g.fillRect(0, 0, W, H);
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return (_brickTex = { map, bump });
}
// medalhão de pedra no centro: disco gravado com borda, escudo e duas espadas cruzadas em bronze gasto
function arenaEmblem() {
  const g = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ color: '#a39a88', roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: '#7b725f', roughness: 0.95 }), bronze = new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.7, roughness: 0.45 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.8, 0.1, 64), stone); disc.position.y = 0.04; g.add(disc);
  for (const [r, w] of [[2.6, 0.12], [2.25, 0.05]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 72), dark); ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; ring.scale.z = 0.4; g.add(ring); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rune = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, k % 2 ? 0.18 : 0.1), dark); rune.position.set(Math.cos(a) * 2.42, 0.1, Math.sin(a) * 2.42); rune.rotation.y = -a; g.add(rune); } // marcas ao redor
  // escudo (gota) em relevo
  const sh = new THREE.Shape(); sh.moveTo(0, 0.95); sh.bezierCurveTo(0.55, 0.95, 0.85, 0.8, 0.85, 0.35); sh.bezierCurveTo(0.85, -0.35, 0.35, -0.8, 0, -1.05); sh.bezierCurveTo(-0.35, -0.8, -0.85, -0.35, -0.85, 0.35); sh.bezierCurveTo(-0.85, 0.8, -0.55, 0.95, 0, 0.95);
  const shield = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 3, curveSegments: 24 }), bronze); shield.rotation.x = -Math.PI / 2; shield.position.y = 0.09; g.add(shield);
  // duas espadas cruzadas atrás do escudo
  const sword = () => { const s = new THREE.Shape(); s.moveTo(0, 2.0); s.lineTo(0.09, 1.75); s.lineTo(0.08, 0); s.lineTo(0.32, 0); s.lineTo(0.32, -0.1); s.lineTo(0.06, -0.1); s.lineTo(0.06, -0.55); s.lineTo(0.11, -0.62); s.lineTo(0, -0.7); s.lineTo(-0.11, -0.62); s.lineTo(-0.06, -0.55); s.lineTo(-0.06, -0.1); s.lineTo(-0.32, -0.1); s.lineTo(-0.32, 0); s.lineTo(-0.08, 0); s.lineTo(-0.09, 1.75); s.lineTo(0, 2.0); return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), bronze); };
  for (const sd of [-1, 1]) { const sw = sword(); sw.scale.setScalar(1.15); sw.rotation.set(-Math.PI / 2, 0, sd * 0.75); sw.position.set(0, 0.075, 0.25); g.add(sw); }
  g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}
// tocha de parede
function makeWallTorch(seed = 0) {
  const g = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: '#2b2622', metalness: 0.8, roughness: 0.5 }), wood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.85 }), cloth = new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.04), iron); g.add(plate);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20, Math.PI / 2), iron); arm.rotation.set(0, Math.PI / 2, Math.PI); arm.position.set(0, -0.02, 0.16); g.add(arm);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.1, 16, 1, true), iron); cup.position.set(0, 0.14, 0.3); g.add(cup);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.55, 12), wood); handle.position.set(0, 0.25, 0.3); handle.rotation.x = 0.18; g.add(handle);
  for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.018, 6, 16), cloth); w.rotation.x = Math.PI / 2 + 0.18; w.position.set(0, 0.42 + k * 0.035, 0.33 + k * 0.006); g.add(w); }
  // chama em três camadas (núcleo claro, corpo laranja, ponta avermelhada), aditivas
  const fl = new THREE.Group(); fl.position.set(0, 0.6, 0.345); g.add(fl);
  const layer = (r, h, c, o, y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.set(1, h, 1); m.position.y = y; fl.add(m); return m; };
  layer(0.11, 2.4, '#ff5a1a', 0.45, 0.12); layer(0.08, 2.2, '#ffa040', 0.7, 0.1); layer(0.045, 2.0, '#fff2b0', 0.95, 0.06);
  fl.userData.seed = seed * 1.7; arenaFlames.push(fl);
  return g;
}
// estandarte de tecido: barra de ferro, pano com bico (rabo de andorinha), barra dourada e brasão pintado
function makeBanner(team) {
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const base = team ? ['#8e1f1a', '#b8332a'] : ['#1e3f7a', '#2f5aa8'], gr = x.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, base[0]); gr.addColorStop(0.5, base[1]); gr.addColorStop(1, base[0]);
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * W, Math.random() * H, 1, 3); } // trama do tecido
  x.strokeStyle = '#d8b25a'; x.lineWidth = 6; x.strokeRect(9, 9, W - 18, H - 30);
  x.save(); x.translate(W / 2, 110); x.fillStyle = '#e6c46a'; x.strokeStyle = '#6a4a18'; x.lineWidth = 2;
  if (team) { // leão estilizado: cabeça com juba de raios
    for (let k = 0; k < 14; k++) { x.rotate(Math.PI * 2 / 14); x.beginPath(); x.moveTo(-6, -22); x.lineTo(0, -40); x.lineTo(6, -22); x.fill(); }
    x.beginPath(); x.arc(0, 0, 22, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#6a4a18'; x.beginPath(); x.arc(-8, -4, 3, 0, 7); x.arc(8, -4, 3, 0, 7); x.fill(); x.beginPath(); x.moveTo(-6, 8); x.lineTo(0, 13); x.lineTo(6, 8); x.fill();
  } else { // águia de asas abertas
    x.beginPath(); x.moveTo(0, -30); x.lineTo(8, -14); x.lineTo(44, -26); x.lineTo(30, -6); x.lineTo(40, 2); x.lineTo(14, 4); x.lineTo(10, 30); x.lineTo(0, 22); x.lineTo(-10, 30); x.lineTo(-14, 4); x.lineTo(-40, 2); x.lineTo(-30, -6); x.lineTo(-44, -26); x.lineTo(-8, -14); x.closePath(); x.fill(); x.stroke();
  }
  x.restore();
  x.fillStyle = '#e6c46a'; x.font = 'bold 15px serif'; x.textAlign = 'center'; x.fillText(team ? 'LEÕES' : 'ÁGUIAS', W / 2, 205);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // pano com bico embaixo (rabo de andorinha) e dobras leves
  const g = new THREE.Group(), clothM = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 });
  const pl = new THREE.PlaneGeometry(1, 2, 10, 20), P = pl.attributes.position; pl.translate(0, -1, 0);
  for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i); let yy = py; if (py < -1.69) yy = -2.0 + Math.abs(px) * 0.6; P.setXYZ(i, px, yy, Math.sin(px * 8 + py * 1.3) * 0.035 + Math.sin(py * 2.6) * 0.03); }
  pl.computeVertexNormals(); const cl = new THREE.Mesh(pl, clothM); cl.castShadow = true; g.add(cl);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.25, 10), new THREE.MeshStandardMaterial({ color: '#2b2622', metalness: 0.8, roughness: 0.45 })); rod.rotation.z = Math.PI / 2; g.add(rod);
  for (const s of [-1, 1]) { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: '#b8923a', metalness: 0.8, roughness: 0.35 })); knob.position.x = s * 0.64; g.add(knob); }
  g.position.z = 0.05;
  return g;
}
// cartaz do torneio pregado no muro: pergaminho com título, desenho de dois lutadores e regras
function makePoster(i) {
  const W = 192, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const gr = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 170); gr.addColorStop(0, '#efe0b8'); gr.addColorStop(1, '#c4a46a'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(90,60,20,${Math.random() * 0.07})`; x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 1 + Math.random() * 3); }
  x.fillStyle = '#4a2a10'; x.textAlign = 'center'; x.font = 'bold 22px serif'; x.fillText(['GRANDE TORNEIO', 'DUELO DE HONRA', 'ARENA DE ALVORADA'][i % 3], W / 2, 34);
  x.font = 'italic 13px serif'; x.fillText(['Glória aos campeões!', 'Leões contra Águias', 'Todo dia, ao pôr do sol'][i % 3], W / 2, 54);
  // dois lutadores em silhueta, espadas cruzadas
  x.strokeStyle = '#3a2210'; x.fillStyle = '#3a2210'; x.lineWidth = 4; x.lineCap = 'round';
  for (const s of [-1, 1]) { const cx = W / 2 + s * 38; x.beginPath(); x.arc(cx, 92, 9, 0, 7); x.fill(); x.beginPath(); x.moveTo(cx, 101); x.lineTo(cx, 140); x.moveTo(cx, 140); x.lineTo(cx - 12, 172); x.moveTo(cx, 140); x.lineTo(cx + 12, 172); x.moveTo(cx, 112); x.lineTo(cx - s * 22, 100); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(cx - s * 22, 100); x.lineTo(cx - s * 48, 74); x.stroke(); x.lineWidth = 4; }
  x.font = '12px serif'; x.fillText('Prêmio: honra e glória', W / 2, 200); x.fillText('Fale com o Capitão Bravo', W / 2, 218);
  x.strokeStyle = '#7a5a2a'; x.lineWidth = 3; x.strokeRect(6, 6, W - 12, H - 12);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.PlaneGeometry(0.9, 1.2, 6, 8), P = pl.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, Math.sin(P.getX(k) * 5 + P.getY(k) * 3) * 0.012 + (Math.abs(P.getX(k)) > 0.4 && P.getY(k) < -0.5 ? 0.03 : 0)); pl.computeVertexNormals(); // papel levemente ondulado, cantos soltos
  const g = new THREE.Group(), m = new THREE.Mesh(pl, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide })); m.position.z = 0.03; g.add(m);
  for (const [px, py] of [[-0.38, 0.52], [0.38, 0.52]]) { const nail = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: '#3a3330', metalness: 0.8, roughness: 0.4 })); nail.position.set(px, py, 0.05); g.add(nail); }
  g.rotation.z = (i % 2 ? 1 : -1) * 0.04;
  return g;
}
function enterArena() {
  const n = S.npcs.find(x => x.id === 'bravo');
  const back = { x: n.x + 2, z: n.z + 1.5, yaw: 0 };
  fadeTo(() => {
    if (S.riding) dismount(true);
    S.interior = { id: 'arena', ...ARENA_I, back };
    const a = Math.random() * 6.28, r = 6 + Math.random() * 8;
    Object.assign(S.pos, { x: ARENA_I.x + Math.cos(a) * r, z: ARENA_I.z + Math.sin(a) * r, y: 0, vy: 0, ground: true });
    S.vel = { x: 0, z: 0 }; setTarget(null); S.casting = null;
    if (S.pet) { S.pet.x = S.pos.x + 1; S.pet.z = S.pos.z + 1; S.pet.vx = S.pet.vz = 0; }
    S.arena = { id: (S.p.charId || 'x') + '-' + Math.random().toString(36).slice(2, 7), since: 0, rivals: new Map(), savedHp: S.p.hp, kills: 0, deaths: 0, dead: false, busy: false, last: 0 };
    S.p.hp = S.p.d.maxHp;
    $('mapname').innerHTML = 'Arena de Aethra <small>PvP</small>'; banner('⚔️ Arena de Aethra', 'Tab escolhe adversário • R ataca • portal dourado para sair');
    log('⚔️ Você entrou na Arena. Outros jogadores que estiverem aqui aparecem em vermelho.', 'sys');
    $('arena-hud').classList.remove('hidden');
    S.portalCd = S.time + 1.5; Sound.play('portal');
    arenaSync();
  });
}
function arenaLeave() {
  const A = S.arena; if (!A) return;
  fetch('/api/arena/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: A.id }), keepalive: true }).catch(() => { });
  for (const r of A.rivals.values()) removeRival(r);
  S.p.hp = Math.max(1, Math.min(S.p.d.maxHp, A.savedHp)); S.arena = null; setTarget(null);
  $('arena-hud').classList.add('hidden'); hudDirty = true;
  log('Você saiu da Arena.', 'sys');
}
addEventListener('beforeunload', () => { if (S.arena) navigator.sendBeacon && navigator.sendBeacon('/api/arena/leave', new Blob([JSON.stringify({ id: S.arena.id })], { type: 'application/json' })); });
async function arenaSync() {
  const A = S.arena; if (!A || A.busy) return; A.busy = true; A.last = S.time;
  const p = S.p, d = p.d;
  const body = { id: A.id, name: p.name, cls: p.cls, look: p.look, hat: hatOf(p), skin: (p.cosmetics || {}).skin || null, x: S.pos.x, z: S.pos.z, yaw: S.pos.yaw, moving: Math.hypot(S.vel.x, S.vel.z) > 0.5, anim: S.me.anim.name, maxHp: d.maxHp, def: d.def, mdef: d.mdef, flee: d.flee, baseLv: p.baseLv, since: A.since };
  try {
    const r = await (await fetch('/api/arena/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (S.arena !== A) return;
    A.since = r.seq;
    if (r.you) {
      p.hp = r.you.hp; A.kills = r.you.kills; A.deaths = r.you.deaths; hudDirty = true;
      if (r.you.dead && !A.dead) { A.dead = true; S.autoAttack = false; S.me.anim.play('Death_A', { once: true, fade: 0.1 }); Sound.play('death'); }
      if (r.you.dead) $('arena-hud').dataset.dead = Math.ceil(r.you.respawn);
      if (!r.you.dead && A.dead) { A.dead = false; S.me.anim.play('Idle', { restart: true }); delete $('arena-hud').dataset.dead; }
      if (r.you.tp) { Object.assign(S.pos, { x: r.you.tp.x, z: r.you.tp.z, y: 0, vy: 0, ground: true }); ring(S.pos, 2, '#ffd76a'); Sound.play('portal'); }
    }
    const seen = new Set();
    for (const o of r.players) { seen.add(o.id); let rv = A.rivals.get(o.id); if (!rv || rv.lookKey !== JSON.stringify([o.cls, o.look, o.hat, o.skin])) { if (rv) removeRival(rv); rv = makeRival(o); A.rivals.set(o.id, rv); } updateRival(rv, o); }
    for (const [id, rv] of A.rivals) if (!seen.has(id)) { removeRival(rv); A.rivals.delete(id); if (S.target === rv) setTarget(null); }
    for (const e of r.events) arenaEvent(e);
  } catch (e) { } finally { A.busy = false; }
}
function makeRival(o) {
  const pc = buildPreviewChar(o.look, o.cls, o.skin ? { skin: o.skin } : null, o.hat);
  const obj = pc.ch.obj; obj.position.set(o.x, 0, o.z); scene.add(obj);
  const rv = { id: o.id, isRival: true, aggro: true, obj, ch: pc.ch, fx: pc.fx, x: o.x, z: o.z, tx: o.x, tz: o.z, yaw: o.yaw, height: 1.6, radius: 0.5, hp: o.hp, maxHp: o.maxHp, dead: o.dead, status: {}, lookKey: JSON.stringify([o.cls, o.look, o.hat, o.skin]),
    def: { name: o.name, lv: o.baseLv, element: 'neutro', aggressive: true, def: o.def || 0, mdef: o.mdef || 0, flee: o.flee || 0, size: 1 } };
  obj.add(hitbox(rv, 0.6, 1.8));
  return rv;
}
function updateRival(rv, o) {
  rv.tx = o.x; rv.tz = o.z; rv.tyaw = o.yaw; rv.moving = o.moving; rv.hp = o.hp; rv.maxHp = o.maxHp || rv.maxHp; rv.anim = o.anim;
  Object.assign(rv.def, { name: o.name, lv: o.baseLv, def: o.def || 0, mdef: o.mdef || 0, flee: o.flee || 0 });
  if (o.dead && !rv.dead) { rv.ch.anim.play('Death_A', { once: true, fade: 0.1 }); if (S.target === rv) S.autoAttack = false; }
  if (!o.dead && rv.dead) rv.ch.anim.play('Idle', { restart: true });
  rv.dead = o.dead;
}
function removeRival(rv) { scene.remove(rv.obj); const hi = hitboxes.findIndex(h => h.userData.ref === rv); if (hi >= 0) hitboxes.splice(hi, 1); }
function updateArena(dt) {
  const A = S.arena; if (!A) return;
  if (S.time - A.last > 0.12) arenaSync();
  for (const f of arenaFlames) { const sd = f.userData.seed || f.id; f.scale.set(1 + Math.sin(S.time * 17 + sd) * 0.08, 0.85 + Math.sin(S.time * 11 + sd) * 0.15 + Math.sin(S.time * 23 + sd * 2) * 0.07, 1); f.rotation.z = Math.sin(S.time * 7 + sd) * 0.08; }
  for (const rv of A.rivals.values()) {
    const k = 1 - Math.exp(-dt * 12);
    rv.x += (rv.tx - rv.x) * k; rv.z += (rv.tz - rv.z) * k; rv.yaw = angLerp(rv.yaw, rv.tyaw ?? rv.yaw, k);
    rv.obj.position.set(rv.x, 0, rv.z); rv.obj.rotation.y = rv.yaw;
    if (!rv.dead) { const want = rv.anim && /Attack|Shoot|Spell|Chop|Slice|Stab/.test(rv.anim) ? rv.anim : rv.moving ? 'Running_A' : 'Idle'; if (rv.ch.anim.name !== want) rv.ch.anim.play(want, /Attack|Shoot|Spell|Chop|Slice|Stab/.test(want) ? { once: true } : {}); }
    rv.ch.anim.update(dt); rv.fx(S.time);
  }
  const hud = $('arena-hud'), dead = hud.dataset.dead;
  hud.innerHTML = `⚔️ <b>Arena</b> · Abates <b>${A.kills}</b> · Derrotas <b>${A.deaths}</b> · Adversários <b>${A.rivals.size}</b>${dead ? `<div class="ar-dead">Você foi derrotado — voltando em ${dead}s</div>` : A.rivals.size ? '' : '<div class="ar-wait">Esperando adversários… (abra o jogo em outra janela com outro personagem para testar)</div>'}`;
}
function arenaHit(rv, res, elem) {
  if (rv.dead || !S.arena) return;
  if (res.miss) floatAt(rv.obj.position, 'Errou', '#cfd6e0', rv.height + 0.4);
  fetch('/api/arena/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.arena.id, to: rv.id, dmg: Math.round(res.dmg || 0), crit: !!res.crit, miss: !!res.miss, kind: elem || 'fisico' }) }).catch(() => { });
}
function arenaEvent(e) {
  const A = S.arena; if (!A) return;
  if (e.kind === 'golpe') {
    if (e.to === A.id) { if (!e.miss) { floatAt(S.me.obj.position, '-' + e.dmg, '#ff5a5a', 2.1); Sound.play('hurt'); } }
    else { const rv = A.rivals.get(e.to); if (rv && !e.miss) { floatAt(rv.obj.position, (e.crit ? '💥 ' : '') + e.dmg, e.crit ? '#ffd76a' : '#ffffff', rv.height + 0.4); Sound.play(e.crit ? 'crit' : 'hit'); } }
  } else if (e.kind === 'morte') {
    log(`☠️ ${escH(e.killer || '?')} derrotou ${escH(e.victim || '?')}!`, 'card');
    if (e.killer === S.p.name && e.to !== A.id) { banner('Vitória!', `Você derrotou ${e.victim}`); Sound.play('levelup'); }
  } else if (e.kind === 'entrou') log(`⚔️ ${escH(e.who || '?')} entrou na Arena.`, 'sys');
  else if (e.kind === 'saiu') log(`${escH(e.who || '?')} saiu da Arena.`, 'sys');
}

/* =========================== Montagem do mundo =========================== */
const clouds = [];
function buildWorld() {
  const hb = bbox('home_A'); WS = 6.5 / Math.max(0.01, hb.max.y - hb.min.y);
  MODELS.target_round = { scene: bakeStatic(makeTarget()), radius: 0.6, native: true }; // alvo de treino feito em código
  MODELS.wheelbarrow = { scene: bakeStatic(makeWheelbarrow()), radius: 0.55, native: true }; // carrinho de mão feito em código (S-082)
  retextureKayKit(MODELS); // S-132: pedra, madeira e reboco com relevo nos prédios prontos
  MODELS.well = { scene: makeWell(), radius: 1.15, native: true };          // S-129
  MODELS.bucket = { scene: makeBucket(), radius: 0.22, native: true };      // S-129
  MODELS.barrel = { scene: makeBarrel(), radius: 0.43, native: true };      // S-174: barril de aduelas, aros e tampa
  MODELS.lumber = { scene: makeLogPile(), radius: 1.1, native: true };      // auditoria: pilha de toras de verdade
  MODELS.weaponrack = { scene: makeWeaponRack(), radius: 0.9, native: true }; // auditoria: suporte com espadas, lança e escudo
  MODELS.blacksmith = { scene: makeSmithy(), radius: 3.0, native: true };   // S-125: ferraria sem o forno gigante
  MODELS.flag_blue = { scene: makeClothFlag('blue'), radius: 0.3, native: true }; // S-131: pano ao vento
  MODELS.flag_red = { scene: makeClothFlag('red'), radius: 0.3, native: true };
  const V = VILLAGE;
  // vila: poço no centro, casas em anel virado para a praça (a leste fica a saída da estrada)
  place('well', V.x, V.z, { rot: 0, rf: 0.6 });
  cobblePlaza(V.x, V.z, 14.5, 6); // auditoria: praça calçada de pedra
  const ring = [['tavern', 160, 23], ['home_A', 200, 22], ['home_B', 235, 22], ['blacksmith', 270, 23], ['home_A_red', 305, 23], ['church', 120, 25], ['home_B_red', 85, 22], ['market', 50, 22]];
  for (const [n, deg, r] of ring) {
    const a = deg * Math.PI / 180, x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
    let bo;
    if (/^home_(A|B|A_red)$/.test(n)) { // auditoria: casas de verdade (estilo das do porto) no lugar das casinhas de desenho
      const rot = Math.atan2(V.x - x, V.z - z), hh = villageHouse(31 + Math.round(deg), 7.6, 6.4); bo = hh.obj; let gy = heightAt(x, z);
      for (const [lx, lz] of [[-4, -3.4], [4, -3.4], [-4, 3.4], [4, 3.4]]) { const cs = Math.cos(rot), sn = Math.sin(rot); gy = Math.min(gy, heightAt(x + lx * cs + lz * sn, z - lx * sn + lz * cs)); }
      bo.position.set(x, gy, z); bo.rotation.y = rot; scene.add(bo); bo.userData.asset = 'casa_da_vila'; placed.push(bo); occluders.push(bo);
      for (const [lx, lz, hx, hz] of hh.box) { const cs = Math.cos(rot), sn = Math.sin(rot); colliders.push({ x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs, r: Math.max(hx, hz), box: true, hx, hz, rot, name: 'casa_da_vila' }); }
    } else bo = place(n, x, z, { rot: Math.atan2(V.x - x, V.z - z), rf: 0.62 });
    if (n === 'market') buildFruitMarket(bo);
    const inside = { tavern: 'taverna', home_B_red: 'estabulo' }[n];
    if (inside) { // porta com portal: entra na casa
      // S-109: o portal fica no pé da escada da porta (a porta não é no meio da fachada: taverna à esquerda, estábulo à direita)
      const hc = colliders[colliders.length - 1], ux = (V.x - x) / r, uz = (V.z - z) / r, off = (hc.box ? hc.hz : hc.r) + 0.45, lat = { tavern: -1.0, home_B_red: 1.05 }[n] || 0;
      addDoorPortal(inside, hc.x + ux * off + uz * lat, hc.z + uz * off - ux * lat, Math.atan2(V.x - x, V.z - z));
    }
  }
  buildInteriors();
  buildArena();
  place('windmill', V.x - 34, V.z - 26, { rf: 0.4 });
  place('tower', V.x + 22, V.z - 9, { rf: 0.5 }); place('tower', V.x + 22, V.z + 14, { rf: 0.5 });
  place('flag_blue', V.x + 18, V.z - 6, { solid: false }); place('flag_blue', V.x + 18, V.z + 11, { solid: false });
  // feira e enfeites
  const props = [['barrel', 6, -9], ['barrel', 7.1, -8], ['barrel', 6.2, -7.6], ['crate_A', 9, -10], ['crate_B', 9.9, -8.8], ['crate_A', 8.2, -11.2], ['wheelbarrow', -9, 7], ['weaponrack', -12, -4], ['lumber', -14, 10], ['bucket', 1.75, 0.45], /* S-172 balde junto do poço · S-173 sem o saco · S-174 barris detalhados e 3 caixas · S-198 sem a caixa no caminho */ ['target_round', -6, -14], ['flag_red', 12, -12]];
  for (const [n, dx, dz] of props) place(n, V.x + dx, V.z + dz, { rf: 0.6 });
  // paliçada de troncos ao redor da vila (portão a leste, na estrada) — S-072
  {
    const pts = []; for (let deg = 22; deg <= 345; deg += 1) { const a = deg * Math.PI / 180; pts.push({ x: V.x + Math.cos(a) * 33, z: V.z + Math.sin(a) * 33 }); }
    const pal = makePalisade(pts, heightAt, { x: V.x, z: V.z });
    pal.group.position.set(0, 0, 0); scene.add(pal.group);
    pal.group.userData.asset = 'palisade'; pal.group.userData.center = new THREE.Vector3(V.x, 0, V.z);
    colliders.push(...pal.colliders);
    for (const mk of pal.marks) { const o = new THREE.Object3D(); o.position.set(mk.x, 0, mk.z); o.userData.asset = 'fence'; placed.push(o); } // minimapa
    extraPick.push(pal.group); // sugestões (Q) acertam a paliçada
  }
  // natureza
  const scatter = (zoneId, list, n, minW, gap, extra = {}) => {
    let placed = 0;
    for (let k = 0; k < n * 25 && placed < n; k++) {
      const zn = ZONES.find(q => q.id === zoneId);
      const x = zn.x + (rng() * 2 - 1) * zn.r * 1.25, z = zn.z + (rng() * 2 - 1) * zn.r * 1.25;
      if (Math.abs(x) > PLAY_LIMIT - 4 || Math.abs(z) > PLAY_LIMIT - 4) continue;
      if (zoneWeight(zoneId, x, z) < minW) continue;
      if (roadDist(x, z) < 5 || lakeDist(x, z) < LAKE.r + 3 || Math.hypot(x - V.x, z - V.z) < 36 || Math.hypot(x - CITY2.x, z - CITY2.z) < 44 || Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 46 || Math.hypot(x - FROZEN.x, z - FROZEN.z) < FROZEN.r + 4 || Math.hypot(x - FROST.x, z - FROST.z) < 48 || x < -398 || Object.values(CAMPS).some(c => Math.hypot(x - c.x, z - c.z) < 16) || mountainMask(x, z) > 0.3) continue;
      if (/^(oak|pine|cactus)/.test(list[0]) && !treeAllowed(x, z)) continue; // S-154: árvore só onde há terra
      if (!freeAt(x, z, gap)) continue;
      const name = list[Math.floor(rng() * list.length)];
      place(name, x, z, { scale: (extra.s0 || 0.9) + rng() * (extra.s1 || 0.4), rf: extra.rf || 0.35 });
      placed++;
    }
  };
  // árvores feitas em código (mais naturais que os pinheiros pontudos do pacote)
  for (const [k, v] of Object.entries(makeTreeTemplates())) MODELS[k] = { ...v, native: true };
  scatter('campos', ['oak_0', 'oak_1', 'oak_2', 'oak_3', 'oak_4', 'oak_1', 'pine_0', 'pine_1'], 60, 0.45, 5, { s0: 0.85, s1: 0.4 });
  scatter('campos', ['stone_0', 'stone_1', 'stone_2', 'stone_3', 'stone_4', 'stone_5'], 26, 0.4, 3, { s0: 0.7, s1: 0.8 });
  scatter('floresta', ['pinedark_0', 'pinedark_1', 'pinedark_2', 'pinedark_3', 'pine_2', 'pine_3', 'pine_4', 'oakdark_0', 'oakdark_1', 'oakdark_2'], 150, 0.4, 3.4, { s0: 0.85, s1: 0.5 });
  scatter('floresta', ['stonedark_0', 'stonedark_1', 'stonedark_2', 'stonedark_3'], 20, 0.4, 3, { s0: 0.7, s1: 0.7 });
  scatter('ruinas', ['stonedark_0', 'stonedark_1', 'stone_3', 'stone_4', 'stone_5'], 36, 0.35, 3, { s0: 0.7, s1: 0.9 });
  scatter('ruinas', ['stump_0', 'stump_1', 'stump_2', 'log_0', 'log_1'], 14, 0.3, 3, { s0: 0.9, s1: 0.3 });
  scatter('floresta', ['stump_0', 'stump_1', 'stump_2', 'log_0', 'log_1'], 16, 0.4, 3, { s0: 0.9, s1: 0.3 });
  // regiões novas (S-076)
  for (let k = 0; k < 3; k++) { const c = cactusGeometry(400 + k); MODELS['cactus_' + k] = { scene: new THREE.Mesh(c.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })), radius: c.radius, native: true }; MODELS['cactus_' + k].scene.castShadow = true; }
  scatter('colinas', ['oak_0', 'oak_1', 'oak_2', 'oak_3', 'oak_4', 'pine_0'], 55, 0.35, 6, { s0: 0.85, s1: 0.45 });
  scatter('colinas', ['stone_0', 'stone_1', 'stone_2', 'stone_3', 'stump_0', 'log_0'], 24, 0.3, 3, { s0: 0.8, s1: 0.6 });
  scatter('geada', ['pinesnow_0', 'pinesnow_1', 'pinesnow_2', 'pinesnow_3'], 90, 0.3, 4, { s0: 0.8, s1: 0.6 }); // S-158: pinheiros com neve
  scatter('geada', ['stone_3', 'stone_4', 'stone_5', 'stonedark_0'], 28, 0.3, 3, { s0: 0.8, s1: 0.9 });
  scatter('dunas', ['cactus_0', 'cactus_1', 'cactus_2', 'cactus_0'], 60, 0.3, 5, { s0: 0.8, s1: 0.5 });
  scatter('dunas', ['stone_0', 'stone_3', 'stone_4', 'stump_1', 'log_1'], 34, 0.3, 4, { s0: 0.8, s1: 1.2 });
  scatter('colossos', ['stump_0', 'stump_1', 'stump_2', 'log_0', 'log_1'], 22, 0.3, 10, { s0: 1.0, s1: 0.5 }); // S-161: terra arrasada, sem árvores verdes
  scatter('colossos', ['stone_3', 'stone_4', 'stone_5', 'stonedark_1', 'stonedark_2'], 50, 0.25, 6, { s0: 1.0, s1: 1.6 });
  buildFrontier();
  // ruínas: prédios destruídos e muros quebrados
  const R = ZONES.find(q => q.id === 'ruinas');
  const ruinBits = [['destroyed', -14, -6], ['destroyed', 12, -16], ['destroyed', 20, 8], ['scaffold', -22, 12], ['destroyed', -8, -26], ['tower', 2, -30]];
  for (const [n, dx, dz] of ruinBits) place(n, R.x + dx, R.z + dz, { rf: 0.55, sink: n === 'tower' ? 2.5 : 0 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.15 || Math.abs(Math.sin(a) + 1) < 0.15) continue; // aberturas ao sul e ao norte (estradas)
    if (rng() < 0.3) continue; // muro em pedaços
    const x = R.x + Math.cos(a) * 30, z = R.z + Math.sin(a) * 30;
    { // muro de pedra de verdade (S-092): blocos irregulares, musgo e topo quebrado
      const rot = -a + Math.PI / 2, len = 7 + rng() * 2.5, w = makeRuinWall(i * 7 + 3, len, 2.6 + rng() * 1.4);
      w.position.set(x, heightAt(x, z) - 0.1, z); w.rotation.y = rot; scene.add(w); w.userData.asset = 'ruin_wall'; placed.push(w); occluders.push(w);
      colliders.push({ x, z, r: len / 2, box: true, hx: len / 2, hz: 0.55, rot, name: 'ruin_wall' });
    }
  }
  // lago: vitórias-régias
  buildLilyPads();
  // pinheiros só no sopé das montanhas (nascem da terra, não no topo)
  for (let k = 0, n = 0; k < 16000 && n < 320; k++) {
    const x = (rng() * 2 - 1) * (HALF - 10), z = (rng() * 2 - 1) * (HALF - 10), mm = mountainMask(x, z);
    if (mm < 0.12 || mm > 0.6 || (Math.abs(x) < 100 && Math.abs(z) < 100) || roadDist(x, z) < 8) continue;
    const h = heightAt(x, z); if (h > 14 || !treeAllowed(x, z, { maxRock: 0.22, maxSlope: 0.42 }) || zoneWeight('dunas', x, z) > 0.5) continue; // S-154: só no sopé com terra
    if (Math.max(Math.abs(x), Math.abs(z)) < PLAY_LIMIT - 2 && !freeAt(x, z, 3)) continue;
    place((zoneWeight('geada', x, z) > 0.3 ? ['pinesnow_0', 'pinesnow_1', 'pinesnow_2', 'pinesnow_3'] : ['pine_0', 'pine_2', 'pine_3', 'pinedark_0', 'pinedark_1', 'pinedark_2'])[Math.floor(rng() * (zoneWeight('geada', x, z) > 0.3 ? 4 : 6))], x, z, { scale: 0.9 + rng() * 0.6, solid: Math.max(Math.abs(x), Math.abs(z)) < PLAY_LIMIT, sink: 0.3 }); n++;
  }
  { const dm = buildDistantMountains(); dm.traverse(o => { if (o.isMesh && !o.material.userData.td) { o.material.userData.td = true; terrainDetail(o.material, 0.6); } }); scene.add(dm); } // auditoria: montanhas do horizonte com rocha
  // nuvens (auditoria): nada de bolotas de desenho — cúmulos macios feitos de vários "puffs" com textura de névoa,
  // base mais escura e topo iluminado pelo sol, que viram sempre para a câmera e andam devagar com o vento
  { const tex = cloudPuffTex();
    for (let i = 0; i < 46; i++) {
      const g = new THREE.Group(), n = 9 + Math.floor(rng() * 10), w = 40 + rng() * 60;
      for (let k = 0; k < n; k++) { const top = rng(), sh = 0.78 + top * 0.22, m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(sh, sh, Math.min(1, sh + 0.04)), transparent: true, opacity: 0.55 + rng() * 0.3, depthWrite: false, fog: false });
        const sp = new THREE.Sprite(m), sz = (16 + rng() * 24) * (1 - Math.abs(k / n - 0.5) * 0.6); sp.scale.set(sz * 1.6, sz, 1); sp.position.set((k / n - 0.5) * w + (rng() - 0.5) * 8, top * 8 + (rng() - 0.5) * 3, (rng() - 0.5) * 14); g.add(sp); }
      g.position.set((rng() * 2 - 1) * (HALF + 40), 105 + rng() * 40, (rng() * 2 - 1) * (HALF + 40)); g.userData.asset = 'cloud'; scene.add(g); clouds.push(g);
    } }
}


/* =========================== Além da serra (S-076) ===========================
   Pedraclara (2ª cidade), acampamentos com mestre-grifo, a Planície dos Colossos
   e o Santuário Silente (entrada das Catacumbas). Voo de grifo entre os pontos conhecidos. */
const FLIGHTS = {
  vila: { name: 'Vila de Alvorada', x: VILLAGE.x + 26, z: VILLAGE.z + 7 },
  pedraclara: { name: 'Cidadela de Pedraclara', x: CITY2.x - 9, z: CITY2.z + 10 },
  geada: { name: 'Acampamento da Geada', x: CAMPS.geada.x + 1, z: CAMPS.geada.z + 6 },
  dunas: { name: 'Oásis de Sal-Rubro', x: CAMPS.dunas.x + 6, z: CAMPS.dunas.z + 1 },
  colossos: { name: 'Acampamento dos Colossos', x: CAMPS.colossos.x + 6, z: CAMPS.colossos.z + 1 },
};
function worldNpc(n, x, z, yaw) {
  const ch = makeNpcHero(n);
  ch.obj.position.set(x, groundAt(x, z), z); ch.obj.rotation.y = yaw ?? 0; ch.anim.play('Idle', { speed: 0.8 + rng() * 0.4 });
  const npc = { ...n, x, z, ...ch, isNpc: true, height: 1.85, radius: 0.5 };
  ch.obj.add(hitbox(npc, 0.6, 2)); scene.add(ch.obj); colliders.push({ x, z, r: 0.6 }); S.npcs.push(npc);
  return npc;
}
function landmark(obj, asset, x, z, rot, cols, y) {
  obj.position.set(x, y ?? heightAt(x, z) - 0.4, z); obj.rotation.y = rot; scene.add(obj);
  obj.userData.asset = asset; obj.userData.big = true; placed.push(obj); occluders.push(obj);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (const [lx, lz, r] of cols || []) colliders.push({ x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs, r, name: asset });
  obj.traverse(o => { if (o.userData.update) roomAnims.push(o); });
  return obj;
}
const GRIFEIROS = {
  vila: { id: 'neli', name: 'Neli', title: 'Mestra dos Noctívagos', model: 'Rogue', look: { race: 'humano', face: 'alegre', hair: { style: 'rabo', color: 'ruivo' } } },
  pedraclara: { id: 'aldo', name: 'Aldo', title: 'Mestre dos Noctívagos', model: 'Knight', show: ['Knight_Cape'], look: { race: 'humano', face: 'sereno', hair: { style: 'curto', color: 'grisalho' }, beard: true } },
  geada: { id: 'ruan', name: 'Ruan', title: 'Mestre dos Noctívagos', model: 'Barbarian', show: ['Barbarian_Cape'], look: { race: 'anao', face: 'valente', hair: { style: 'careca', color: 'branco' }, beard: true } },
  dunas: { id: 'samira', name: 'Samira', title: 'Mestra dos Noctívagos', model: 'Rogue', show: ['Rogue_Cape'], look: { race: 'humano', face: 'astuto', hair: { style: 'longo', color: 'preto' } } },
  colossos: { id: 'oto', name: 'Oto', title: 'Mestre dos Noctívagos', model: 'Rogue_Hooded', show: ['Rogue_Cape'], look: { race: 'elfo', face: 'gentil', hair: { style: 'franja', color: 'platinado' } } },
};
function buildFrontier() {
  // pontos de voo: poleiro com o emblema + mestre-grifo
  for (const [k, f] of Object.entries(FLIGHTS)) {
    const r = makeRoost(); r.position.set(f.x + 1.6, heightAt(f.x + 1.6, f.z - 0.4), f.z - 0.4); scene.add(r); roomAnims.push(r); for (const [lx, lz, rr] of r.userData.cols || []) colliders.push({ x: f.x + 1.6 + lx, z: f.z - 0.4 + lz, r: rr });
    worldNpc({ ...GRIFEIROS[k], grifo: k }, f.x, f.z, k === 'vila' ? -Math.PI / 2 : rng() * 6.28);
  }
  // ---------- Cidadela de Pedraclara: muralha de pedra, torres, portão a oeste ----------
  const C = CITY2, wb = bbox('wall'), wlen = Math.max(4, (wb.max.x - wb.min.x) * WS * 0.96), R = 38;
  for (let a = 0; a < Math.PI * 2; a += wlen / R) {
    if (Math.abs(Math.cos(a) + 1) < 0.06) continue; // portão a oeste, na estrada
    place('wall', C.x + Math.cos(a) * R, C.z + Math.sin(a) * R, { rot: -a + Math.PI / 2, sink: 0.2 });
  }
  for (const deg of [45, 135, 225, 315]) { const a = deg * Math.PI / 180; place('tower', C.x + Math.cos(a) * R, C.z + Math.sin(a) * R, { rf: 0.5 }); }
  for (const sz of [-4.5, 4.5]) { place('tower', C.x - R - 0.5, C.z + sz, { rf: 0.4, scale: 0.7 }); place('flag_red', C.x - R + 1.5, C.z + sz * 1.5, { solid: false }); }
  const ring2 = [['church', 270, 22], ['tavern', 225, 21], ['home_A', 315, 21], ['blacksmith', 35, 22], ['market', 90, 21], ['home_B', 140, 21], ['home_A_red', 0, 23], ['home_B_red', 62, 23]];
  for (const [n, deg, r] of ring2) { const a = deg * Math.PI / 180, x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r; place(n, x, z, { rot: Math.atan2(C.x - x, C.z - z), rf: 0.62 }); }
  place('well', C.x, C.z, { rot: 0, rf: 0.6 });
  for (const [n, dx, dz] of [['barrel', 8, -6], ['barrel', 8.8, -5.2], ['crate_A', 10, -7], ['sack', -9, 7], ['weaponrack', -12, -3], ['flag_blue', 6, 10], ['flag_blue', -6, -10], ['wheelbarrow', 11, 7], ['crate_B', -11, 9]]) place(n, C.x + dx, C.z + dz, { rf: 0.6 });
  place('windmill', C.x + 52, C.z + 14, { rf: 0.4 });
  worldNpc({ id: 'isis', name: 'Ísis', title: 'Mercadora de Pedraclara', model: 'Mage', show: ['Mage_Cape'], look: { race: 'elfo', face: 'sereno', hair: { style: 'coque', color: 'castanho_escuro' } }, shopList: 'geral', shopTitle: '🛒 Empório de Pedraclara', hello: 'Pedraclara recebe caravanas do vale e das dunas. Tenho de tudo um pouco, e pago bem pelo que você trouxer das terras novas!' }, C.x + 5, C.z - 4, Math.PI);
  worldNpc({ id: 'bastiao', name: 'Bastião', title: 'Guarda do Portão', model: 'Knight', show: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'], hat: true, look: { race: 'anao', face: 'valente', hair: { style: 'curto', color: 'ruivo' }, beard: true },
    lines: 'Ao norte das Ruínas de Kael fica a Planície dos Colossos: gigantes de pedra ajoelhados, dormindo há mil anos. No fim da calçada antiga, encravado na montanha, está o Santuário Silente.\nDizem que nas Catacumbas lá embaixo vigia a Sentinela Silente. Vá preparado — e leve poções.' }, C.x - R + 4, C.z + 3, -Math.PI / 2);
  worldNpc({ id: 'mirela', name: 'Irmã Mirela', title: 'Curandeira de Pedraclara', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], look: { race: 'humano', face: 'gentil', hair: { style: 'longo', color: 'loiro' } }, heals: true }, C.x - 6, C.z - 7, Math.PI / 4);
  // ---------- acampamentos: barraca, fogueira, caixotes e bandeira ----------
  for (const c of Object.values(CAMPS)) {
    place('tent', c.x + 5, c.z - 4, { rf: 0.6 }); place('crate_A', c.x - 3, c.z + 2.5, { rf: 0.6 }); place('barrel', c.x - 4, c.z + 3.6, { rf: 0.6 }); place('flag_blue', c.x + 3, c.z + 5, { solid: false });
    const f = makeCampfire(); f.position.set(c.x, heightAt(c.x, c.z), c.z); scene.add(f); roomAnims.push(f); colliders.push({ x: c.x, z: c.z, r: 0.7 });
  }
  // ---------- Planície dos Colossos ----------
  // S-102: cinco colossos diferentes, maiores e esculpidos (cada um traz sua colisão em userData.cols)
  const colo = (o, id, x, z, rot) => landmark(o, id, x, z, rot, o.userData.cols, heightAt(x, z) - 0.3);
  colo(makeSentinel(41), 'colosso_sentinela', -50, -310, Math.PI / 2 - 0.25);   // de pé, de frente para a calçada
  colo(makeSeatedKing(53), 'colosso_rei', 78, -340, -Math.PI / 2 + 0.2);        // rei no trono, olhando a calçada
  colo(makeStoneBeast(67), 'colosso_fera', -78, -352, 0.9);                     // fera agachada
  colo(makeFallenTitan(79), 'colosso_tita', 100, -275, -0.4);                   // titã caído com o braço erguido
  colo(makeHeadless(97), 'colosso_sem_cabeca', -96, -246, 1.1);                 // guerreiro sem cabeça (a cabeça caiu a seus pés)
  buildRuins({ scene, placed, colliders, occluders, heightAt, roadDist }); // S-161: ruínas e escombros
  { const mist = makeMist(heightAt, 0, -300, 115, 30, 5); scene.add(mist); roomAnims.push(mist); } // névoa baixa: clima de mistério
  landmark(makeGiantHead(7), 'cabeca_gigante', 46, -252, 0.6, [[0, 0, 4.6]], heightAt(46, -252) - 1.4);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.2, x = Math.cos(a) * 24, z = -300 + Math.sin(a) * 24; if (Math.abs(x) < 5) continue; landmark(makeMonolith(30 + k, 6 + (k % 3) * 1.6), 'monolito', x, z, -a, [[0, 0, 1.2]]); }
  for (let k = 0; k < 6; k++) { const x = (k % 2 ? 1 : -1) * (40 + k * 17), z = -230 - k * 26; landmark(makeMonolith(60 + k, 5 + (k % 2) * 2), 'monolito', x, z, k, [[0, 0, 1.2]]); }
  for (const z of [-262, -338]) landmark(makeArch(z), 'arco', 0, z, 0, [[-4.5, 0, 1.1], [4.5, 0, 1.1]]);
  // ---------- Santuário Silente: fachada encravada na montanha; o portal leva às Catacumbas ----------
  const ty = heightAt(TEMPLE.x, TEMPLE.z);
  const tpm = makeTemple(13), tp = landmark(tpm, 'santuario', TEMPLE.x, TEMPLE.z, 0, tpm.userData.cols, ty - 0.1);
  colliders.push({ x: TEMPLE.x, z: TEMPLE.z + 0.6, r: 15, box: true, hx: 15.2, hz: 10.4, rot: 0, name: 'santuario' });
  addDoorPortal('catacumbas', TEMPLE.x, TEMPLE.z + 12.6, 0);
  // ---------- S-117: cidades das raças (anões, elfos, porto) e S-118: o Castelo de Valcinza ----------
  S.cities = buildCities({ scene, place, worldNpc, colliders, occluders, placed, roomAnims, camera });
  { const portCtx = { scene, place, worldNpc, roomNpc, colliders, occluders, placed, roomAnims, camera, addDoorPortal, portals }; S.port = buildPortCity(portCtx); buildMerchants(portCtx); } // S-208..S-218: Porto das Gaivotas (port3d)
  buildCastle({ scene, place, colliders, occluders, placed, roomAnims, roomNpc, worldNpc, INTERIORS, addDoorPortal, makePortal, portals });
  if (S.cities && S.cities.refineBoard) { const b = S.cities.refineBoard, m = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.92, b.h * 0.88), new THREE.MeshStandardMaterial({ map: refineBoardTex(), roughness: 0.9 })); m.position.set(b.x, b.y, b.z); m.rotation.y = b.yaw; m.translateZ(0.06); scene.add(m); m.userData.asset = 'tabela_refino'; placed.push(m); extraPick.push(m); } // S-124: tabela de refino na parede do ferreiro
}
// voo de grifo: libera o ponto ao conversar com o mestre-grifo dele
function flightDialog(n) {
  const p = S.p; p.flights = p.flights || ['vila'];
  if (!p.flights.includes(n.grifo)) { p.flights.push(n.grifo); log(`🦇 Novo ponto de voo descoberto: ${FLIGHTS[n.grifo].name}!`, 'card'); Sound.play('levelup'); save3d(); }
  const cost = 40;
  const opts = Object.entries(FLIGHTS).filter(([k]) => k !== n.grifo && p.flights.includes(k)).map(([k, f]) => ({ label: `🦇 ${f.name} — ${S.god ? 'grátis' : cost + ' z'}`, gold: true, fn: () => fly(k, cost) }));
  UI.dialog(n, opts.length ? 'Para onde voamos hoje? O Noctívago conhece o caminho de cor.' : 'Você ainda não conhece outros pontos de voo. Fale com os mestres dos Noctívagos pelo mundo (Pedraclara, Geada, Dunas, Colossos) para poder voar até eles!', [...opts, { label: 'Até logo.', fn: () => UI.close('dialog') }]);
}
function fly(k, cost) {
  const p = S.p, f = FLIGHTS[k];
  if (!S.god && p.zeny < cost) { log('Zeny insuficiente para o voo.', 'warn'); Sound.play('error'); return; }
  if (!S.god) { p.zeny -= cost; hudDirty = true; }
  UI.close('dialog'); if (S.riding) dismount(true);
  fadeTo(() => { teleport3d(f.x + 2.5, f.z + 1.5); banner(f.name, '🦇 Voo de Noctívago'); });
}
// ---------- Catacumbas do Santuário (masmorra) ----------
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
const HERO_H = 1.78; // altura dos personagens realistas (jogador e NPCs)
function makeChar(model, show, height = HERO_H) {
  const g = MODELS[model];
  const root = SkeletonUtils.clone(g.scene);
  const acc = ACCESSORIES[model];
  if (acc && show) root.traverse(o => { if (acc.includes(o.name)) o.visible = show.includes(o.name); });
  root.scale.setScalar(charScale() * height / 1.8);
  shareSkeletons(root); // um esqueleto por personagem (monstros esqueleto também)
  const wrap = new THREE.Group(); wrap.add(root);
  return { obj: wrap, root, anim: new Anim(root, g.animations) };
}
function attach(root, item, hand = 'r') {
  const bone = root.getObjectByName('handslot' + hand) || root.getObjectByName('handslot.' + hand);
  if (bone && MODELS[item]) bone.add(MODELS[item].scene.clone(true));
}
// S-205: cada linha de classe ataca de um jeito (clipes da UAL; o 2 mãos é mais lento e com avanço do corpo)
const CLASS_ATTACK = {
  aprendiz: { clips: ['Punch_Jab', 'Punch_Cross', 'Sword_Attack'], sound: 'swing', speed: 1.1 },
  guerreiro: { clips: ['Sword_Attack'], sound: 'swing', speed: 1.15 }, cavaleiro_runico: { clips: ['Sword_Attack'], sound: 'heavySwing', speed: 0.85, lunge: 0.6 }, guardiao_sagrado: { clips: ['Sword_Attack'], sound: 'heavySwing', speed: 0.9, lunge: 0.4 },
  ladino: { clips: ['Punch_Jab', 'Punch_Cross'], sound: 'stab', speed: 1.4, lunge: 0.25 }, lamina_sombria: { clips: ['Punch_Cross', 'Punch_Jab'], sound: 'stab', speed: 1.6, lunge: 0.35 }, saqueador: { clips: ['Punch_Jab', 'Sword_Attack'], sound: 'stab', speed: 1.3 },
  arqueiro: { clips: ['Pistol_Shoot'], sound: 'bow', speed: 0.9, aim: 'Pistol_Aim_Neutral' }, cacador: { clips: ['Pistol_Shoot'], sound: 'bow', speed: 1.0, aim: 'Pistol_Aim_Neutral' }, menestrel: { clips: ['Spell_Simple_Shoot'], sound: 'bow', speed: 1.1 },
  mago: { clips: ['Spell_Simple_Shoot'], sound: 'magic', speed: 1.0 }, arquimago: { clips: ['Spell_Simple_Shoot'], sound: 'magic', speed: 1.1 }, sabio_elemental: { clips: ['Spell_Simple_Shoot'], sound: 'magic', speed: 1.05 },
};
function attackAnim(p, me) {
  const ca = CLASS_ATTACK[p.cls]; if (!ca) { const list = ATTACK_ANIM[me.look.style]; me.anim.play(list[Math.floor(rng() * list.length)], { once: true, restart: true, fade: 0.08, speed: Math.max(1, 900 / p.d.aspd) }); return { sound: 'swing' }; }
  S.atkN = (S.atkN || 0) + 1; const clip = ca.clips[S.atkN % ca.clips.length]; S.lastAtk = S.time;
  if (Math.hypot(S.vel.x, S.vel.z) > 0.6 && me.anim.overlay) { me.anim.overlay(clip, { speed: ca.speed * Math.max(1, 900 / p.d.aspd) }); S.overlayAtk = true; } // S-236: andando, o golpe vai só no tronco e as pernas seguem andando
  else { me.anim.play(clip, { once: true, restart: true, fade: 0.06, speed: ca.speed * Math.max(1, 900 / p.d.aspd) }); S.overlayAtk = false; }
  if (ca.lunge) S.lunge = { t: S.time, d: ca.lunge }; // avanço curto do corpo no golpe
  return ca;
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


/* =========================== Modo ação (S-094) ===========================
   V alterna a câmera: 'classica' (estilo WoW, com alvo) → 'fps' (1ª pessoa, estilo Skyrim) → 'ombro' (3ª pessoa de ação).
   Nos modos de ação o mouse fica preso (clique na tela), a mira fica no centro e segurar o botão
   esquerdo ataca o que está na mira. Habilidades (1–9) também vão para quem está na mira. */
const VIEWS = ['classica', 'fps', 'ombro'], VIEW_NAMES = { classica: '3ª pessoa clássica (alvo)', fps: '1ª pessoa (mira)', ombro: '3ª pessoa de ação (mira)' };
try { S.view = localStorage.getItem('aethra_view') || 'classica'; } catch (e) { S.view = 'classica'; }
if (!VIEWS.includes(S.view)) S.view = 'classica';
S.aim = 0.05; S.fire = false;
const isAction = () => S.view !== 'classica';
function setView(v) {
  S.view = v; try { localStorage.setItem('aethra_view', v); } catch (e) { }
  $('crosshair').classList.toggle('hidden', !isAction());
  if (!isAction() && document.pointerLockElement) document.exitPointerLock();
  if (S.me) S.me.obj.visible = S.view !== 'fps';
  if (viewModel) viewModel.visible = S.view === 'fps';
  banner(VIEW_NAMES[v], isAction() ? 'Clique para mirar · segure o botão esquerdo para atacar · Esc solta o mouse' : 'Segure o botão esquerdo para atacar onde o cursor aponta · botão direito gira a câmera');
}
function cycleView() { setView(VIEWS[(VIEWS.indexOf(S.view) + 1) % VIEWS.length]); }
// quem está na mira: raio do centro da tela; para corpo a corpo, um cone generoso à frente
const aimRay = new THREE.Raycaster();
// S-141: no modo clássico a mira é o CURSOR do mouse (estilo Skyrim, sem alvo travado); nos modos de ação, o centro da tela
const mouseNdc = new THREE.Vector2(0, 0), NDC0 = new THREE.Vector2(0, 0);
const AIM_WEIGHT = { leve: 0.0035, medio: 0.0022, pesado: 0.0012, travado: 0 }; // S-234: quanto a câmera gira ao mexer o mouse segurando o ataque
try { S.aimWeight = localStorage.getItem('aethra_aimw') || 'pesado'; } catch (e) { }
const aimNdc = () => isAction() ? NDC0 : mouseNdc;
function aimTarget(maxRange) {
  aimRay.setFromCamera(aimNdc(), camera);
  const hit = aimRay.intersectObjects(hitboxes, false).find(h => { const r = h.object.userData.ref; return r && !r.isNpc && !r.dead && Math.hypot(r.x - S.pos.x, r.z - S.pos.z) <= maxRange; });
  if (hit) return hit.object.userData.ref;
  if (!isAction()) { // com o cursor: quem está debaixo da mira ou bem perto do ponto do chão que ela aponta (hitbox um pouco generosa, como no WoW)
    const q = aimPoint(maxRange + 6); let best = null, bd = 1e9;
    for (const m of [...S.monsters, ...(S.arena ? S.arena.rivals.values() : [])]) { if (m.dead || !m.obj.visible) continue; const dP = Math.hypot(m.x - S.pos.x, m.z - S.pos.z); if (dP > maxRange) continue; const dA = Math.hypot(m.x - q.x, m.z - q.z); if (dA < (m.radius || 0.5) + 0.9 && dA < bd) { bd = dA; best = m; } }
    return best;
  }
  let best = null, bd = 1e9;
  for (const m of [...S.monsters, ...(S.arena ? S.arena.rivals.values() : [])]) {
    if (m.dead || !m.obj.visible) continue; const d = Math.hypot(m.x - S.pos.x, m.z - S.pos.z); if (d > Math.min(maxRange, 4.5)) continue;
    const a = Math.abs(((Math.atan2(m.x - S.pos.x, m.z - S.pos.z) - S.cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (a < 0.6 && d < bd) { bd = d; best = m; }
  }
  return best;
}
function aimPoint(dist = 30) {
  aimRay.setFromCamera(aimNdc(), camera);
  if (!isAction()) { const r = aimRay.ray; for (let d = 1; d < 60; d += 0.5) { const q = r.at(d, new THREE.Vector3()); if (q.y <= groundAt(q.x, q.z) + 0.05) return q; } } // cursor: ponto do chão onde ele aponta
  return aimRay.ray.at(dist, new THREE.Vector3());
}
function actionFire() {
  const p = S.p, t = S.time; if (!S.fire || p.dead || t < S.nextAttack || t < S.lockAnim || S.casting) return;
  const ranged = p.d.ranged || p.d.magicAuto, reach = ranged ? 32 : p.d.rangeTiles * TM + 1.8;
  if (!isAction()) { const q = aimPoint(30); S.pos.yaw = Math.atan2(q.x - S.pos.x, q.z - S.pos.z); } // vira para onde o cursor aponta
  const m = aimTarget(reach);
  S.nextAttack = t + p.d.aspd / 1000;
  vmAttack(ranged ? (p.d.magicAuto ? 'magic' : 'bow') : 'swing');
  if (m) { setTarget(m); playerAttack(m); return; }
  // S-192: no vazio o golpe é idêntico ao golpe num alvo (mesma animação, tempo e som) — só não dá dano; projétil segue reto
  if (S.riding && !S.riding.war) dismount(true);
  const me = S.me, ca = attackAnim(p, me); S.lockAnim = S.overlayAtk ? t : t + Math.min(0.55, p.d.aspd / 1000 * 0.7); S.sitting = false;
  if (ranged) { const to = aimPoint(28); later(p.d.magicAuto ? 0.3 : 0.25, () => shoot(me.obj.position.clone().add(new THREE.Vector3(0, 1.2, 0)), () => to.clone(), p.d.magicAuto ? '#9ad0ff' : '#e8d9b0', () => { }, !p.d.magicAuto)); Sound.play(p.d.magicAuto ? 'magic' : 'bow'); }
  else { Sound.play(ca.sound || 'swing'); later(0.25, () => { const q = aimPoint(3); floatAt(new THREE.Vector3(q.x, groundAt(q.x, q.z), q.z), 'Errou', '#cfd6e0', 1.2); Sound.play('miss'); }); } // S-233: golpe no vazio mostra "Errou" com som
}
// mãos em 1ª pessoa: braços com manga da classe, mãos na cor da pele e a arma que o personagem carrega
let viewModel = null, vmArmR = null, vmArmL = null, vmT = 0, vmKind = 'swing';
function buildViewModel() {
  if (viewModel) { camera.remove(viewModel); viewModel = null; }
  const L = CLASS_LOOKS[S.p.cls] || CLASS_LOOKS.aprendiz, sleeve = new THREE.MeshStandardMaterial({ color: (L.tint && L.tint.body) || '#6a5a48', roughness: 0.8 });
  const skinCol = (() => { let c = null; S.me.root.traverse(o => { if (!c && o.userData.skin) c = o.userData.skin; }); return c || new THREE.Color().setRGB(0.871, 0.527, 0.352); })();
  const skin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 }), glove = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.75 });
  const arm = side => {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 18), sleeve); fore.rotation.x = Math.PI / 2; fore.position.z = 0.16; g.add(fore);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.012, 10, 24), glove); cuff.position.z = -0.04; g.add(cuff);
    const hand = new THREE.Group(); hand.position.z = -0.1; g.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), skin); palm.scale.set(0.9, 0.55, 1.15); hand.add(palm);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 4, 10), skin); f.rotation.x = Math.PI / 2 + 0.9; f.position.set(-0.03 + k * 0.02, -0.02, -0.055); hand.add(f); } // dedos fechados no cabo
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.035, 4, 10), skin); th.rotation.set(Math.PI / 2, 0, side * 0.8); th.position.set(side * 0.04, 0.01, -0.03); hand.add(th);
    g.userData.hand = hand; return g;
  };
  viewModel = new THREE.Group(); camera.add(viewModel);
  vmArmR = arm(1); vmArmR.position.set(0.22, -0.2, -0.42); vmArmR.rotation.set(0.25, 0.12, 0); viewModel.add(vmArmR);
  vmArmL = arm(-1); vmArmL.position.set(-0.24, -0.22, -0.44); vmArmL.rotation.set(0.3, -0.15, 0); viewModel.add(vmArmL);
  // a arma: copia o que está nas mãos do personagem
  for (const [name, it] of Object.entries(S.me.root.userData.items || {})) { // corpo realista: as armas ficam registradas por nome
    const armG = /Offhand|Shield|Spellbook/.test(name) ? vmArmL : vmArmR, w = it.clone(true), ws = new THREE.Vector3(); it.getWorldScale(ws);
    w.scale.set(ws.x * 0.55, ws.y * 0.55, ws.z * 0.55); w.position.set(0, 0.01, -0.02); w.rotation.set(-0.55, 0, 0); armG.userData.hand.add(w);
  }
  for (const [hn, armG] of S.me.root.userData.items ? [] : [['handslotr', vmArmR], ['handslotl', vmArmL]]) {
    const slot = S.me.root.getObjectByName(hn) || S.me.root.getObjectByName(hn.replace('slot', 'slot.')); if (!slot) continue;
    for (const c of slot.children) { if (!c.visible) continue; const w = c.clone(true); const ws = new THREE.Vector3(); c.getWorldScale(ws); w.scale.set(ws.x * 0.55, ws.y * 0.55, ws.z * 0.55); w.position.set(0, 0.01, -0.02); w.rotation.set(-0.55, 0, 0); armG.userData.hand.add(w); } // arma menor e inclinada para frente/cima, como em Skyrim
  }
  vmKind = (S.p.d.magicAuto ? 'magic' : S.p.d.ranged ? 'bow' : 'swing');
  if (vmKind === 'magic') { const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: '#9ad0ff' })); orb.position.set(0, 0.06, -0.05); vmArmR.userData.hand.add(orb); vmArmR.userData.orb = orb; }
  viewModel.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; o.renderOrder = 10; } });
  viewModel.visible = S.view === 'fps';
}
let vmAtk = -9;
function vmAttack(kind) { vmAtk = S.time; vmKind = kind; }
function updateViewModel(dt) {
  if (!viewModel || !viewModel.visible) return;
  vmT += dt; const sp = Math.hypot(S.vel.x, S.vel.z), bob = Math.sin(vmT * 9) * 0.012 * Math.min(1, sp / 3), k = Math.min(1, (S.time - vmAtk) / 0.35), sw = k < 1 ? Math.sin(k * Math.PI) : 0;
  viewModel.position.set(Math.cos(vmT * 4.5) * 0.006 * Math.min(1, sp / 3), bob + Math.sin(vmT * 1.6) * 0.004, 0);
  if (vmKind === 'swing') { vmArmR.rotation.set(0.25 - sw * 1.2, 0.12 + sw * 0.9, -sw * 0.6); vmArmR.position.x = 0.22 - sw * 0.12; }
  else if (vmKind === 'bow') { vmArmL.rotation.set(0.1, -0.05, 0); vmArmL.position.set(-0.1, -0.16, -0.5); vmArmR.position.set(0.1, -0.15, -0.36 + sw * 0.12); vmArmR.rotation.set(0.1, 0.1, 0); }
  else { vmArmR.rotation.set(0.15 - sw * 0.5, 0.05, 0); vmArmR.position.z = -0.42 - sw * 0.15; vmArmL.rotation.set(0.3 - sw * 0.3, -0.15, 0); if (vmArmR.userData.orb) vmArmR.userData.orb.scale.setScalar(1 + Math.sin(vmT * 6) * 0.15 + sw); }
}

/* =========================== Monstros =========================== */
const SPAWNS = [
  ['campos', 'gotinha', 10], ['campos', 'fungolino', 8], ['campos', 'coelho_chifre', 6], ['campos', 'abelha_rubra', 4], ['campos', 'gosmao', 1],
  ['floresta', 'lobo_cinzento', 9], ['floresta', 'abelha_rubra', 3], ['floresta', 'lobo_alfa', 1],
  ['ruinas', 'esqueleto_vigia', 7], ['ruinas', 'cavaleiro_caido', 3], ['ruinas', 'espectro', 3],
  // regiões novas (S-076)
  ['floresta', 'musguinho', 4], ['colinas', 'musguinho', 7], ['colinas', 'coelho_chifre', 5], ['colinas', 'lobo_cinzento', 6], ['colinas', 'abelha_rubra', 4],
  ['dunas', 'brasinha', 10], ['dunas', 'esqueleto_vigia', 4],
  ['geada', 'geadinha', 11], ['geada', 'lobo_alfa', 1],
  ['colossos', 'gotinha_sombria', 8], ['colossos', 'cavaleiro_caido', 5], ['colossos', 'espectro', 5],
  ...DUNGEON_SPAWNS, // S-159: monstros por andar das Catacumbas (os mais fortes embaixo; chefe no 4º)
  // S-138: chefes grandes, um em cada região
  ['dunas', 'kharzul', 1], ['colossos', 'maldoran', 1], ['geada', 'vharnyr', 1], ['ruinas', 'selvara', 1],
  // S-170: nenhum campo vazio — mais monstros e os que ainda não apareciam no mundo
  ['valcinza', 'golem_musgo', 7], ['valcinza', 'espantalho', 6], ['valcinza', 'guardiao_ancestral', 2], ['valcinza', 'lobo_alfa', 2], ['valcinza', 'cavaleiro_caido', 3],
  ['colinas', 'espantalho', 5], ['floresta', 'golem_musgo', 2], ['ruinas', 'morcego_cripta', 6], ['catacumbas', 'morcego_cripta', 5],
  // S-167/S-169: criaturas novas das Dunas
  ['dunas', 'mandacaru', 5], ['dunas', 'escorpiao_rubro', 6], ['dunas', 'formiga_ceifadora', 7], ['dunas', 'lagarto_sal', 4], ['dunas', 'trotavento_selvagem', 4],
  ['dunas', 'brasinha', 4], ['geada', 'geadinha', 4], ['geada', 'lobo_cinzento', 5], ['campos', 'gotinha', 3], ['campos', 'fungolino', 3],
];
let SPAWN_BOSS_NEXT = false;
function spawnPoint(zoneId) {
  const room = INTERIORS[zoneId];
  if (room && room.dungeon) { const b = SPAWN_BOSS_NEXT; SPAWN_BOSS_NEXT = false; return dungeonSpawn(zoneId, rng, b) || { x: room.x, z: room.z }; }
  if (room) { // masmorra: ponto livre dentro da sala (longe da entrada); o chefe fica no salão do fundo
    if (zoneId === 'catacumbas' && SPAWN_BOSS_NEXT) { SPAWN_BOSS_NEXT = false; return { x: room.x, z: room.z - room.d / 2 + 9 }; }
    for (let k = 0; k < 80; k++) { const x = room.x + (rng() * 2 - 1) * (room.w / 2 - 3), z = room.z + (rng() * 2 - 1) * (room.d / 2 - 3); if (z > room.z + room.d / 2 - 12 && Math.abs(x - room.x) < 10) continue; if (freeAt(x, z, 1.2)) return { x, z }; }
    return { x: room.x, z: room.z };
  }
  const zn = ZONES.find(q => q.id === zoneId);
  for (let k = 0; k < 60; k++) {
    const x = zn.x + (rng() * 2 - 1) * zn.r, z = zn.z + (rng() * 2 - 1) * zn.r;
    if (Math.abs(x) > PLAY_LIMIT - 6 || Math.abs(z) > PLAY_LIMIT - 6) continue;
    if (zoneWeight(zoneId, x, z) < 0.5 || lakeDist(x, z) < LAKE.r + 2 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 40) continue;
    if (!freeAt(x, z, 1.2)) continue;
    return { x, z };
  }
  return { x: zn.x, z: zn.z };
}
// brilho nas órbitas, capa rasgada (cavaleiro) e rastro etéreo (espectro): esqueletos com mais presença
const EYE_GLOW = {}, GHOST_TEX = { t: null };
function skeletonExtras(ch, d) {
  const head = ch.root.getObjectByName('head') || ch.root.getObjectByName('Head'); if (!head) return null;
  ch.root.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); head.getWorldScale(ws); const os = ch.obj.scale.x || 1;
  const g = new THREE.Group(); g.scale.setScalar(1 / ws.x * (ch.root.scale.x)); head.add(g); // a partir daqui: unidades do modelo (como o resto do esqueleto)
  const col = d.shape === 'ghost' ? '#8fb4ff' : d.boss ? '#c06aff' : d.shape === 'knight' ? '#ff5a3a' : '#7fe0ff';
  const m = EYE_GLOW[col] || (EYE_GLOW[col] = new THREE.MeshBasicMaterial({ color: col }));
  const halo = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), m); e.position.set(sx * 0.17, 0.42, 0.38); g.add(e); const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), halo); h.position.copy(e.position); g.add(h); eyes.push(h); }
  const parts = [];
  if (d.shape === 'knight') { // capa rasgada nas costas
    const chest = ch.root.getObjectByName('chest') || ch.root.getObjectByName('Chest');
    if (chest) { const cg = new THREE.PlaneGeometry(0.9, 1.3, 8, 10), P = cg.attributes.position;
      for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); if (y < -0.45) P.setY(k, y + (Math.sin(x * 23) * 0.5 + 0.5) * 0.25); P.setZ(k, Math.sin(x * 3) * 0.05); } cg.translate(0, -0.6, 0); cg.computeVertexNormals();
      const cape = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: '#4a1a1e', roughness: 0.95, side: THREE.DoubleSide })); const cw = new THREE.Vector3(); chest.getWorldScale(cw);
      const holder = new THREE.Group(); holder.scale.setScalar(1 / cw.x * ch.root.scale.x); chest.add(holder); cape.position.set(0, 0.35, -0.42); cape.rotation.x = 0.12; cape.castShadow = true; holder.add(cape); parts.push(cape); }
  }
  let trail = null;
  if (d.shape === 'ghost') { // rastro etéreo que some no chão
    if (!GHOST_TEX.t) { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(160,190,255,0.32)'); gr.addColorStop(1, 'rgba(160,190,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 64); GHOST_TEX.t = new THREE.CanvasTexture(c); }
    trail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 20, 1, true), new THREE.MeshBasicMaterial({ map: GHOST_TEX.t, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    trail.rotation.x = Math.PI; trail.position.y = 0.42; ch.obj.add(trail);
  }
  return t => {
    for (const [i, h] of eyes.entries()) h.scale.setScalar(0.8 + Math.sin(t * 3 + i) * 0.2);
    for (const c of parts) c.rotation.x = 0.12 + Math.sin(t * 1.7) * 0.06;
    if (trail) { ch.root.position.y = 0.25 + Math.sin(t * 1.6) * 0.1; trail.scale.set(1 + Math.sin(t * 2.3) * 0.08, 1, 1); trail.rotation.y = t * 0.6; } // espectro flutua
  };
}
function monsterVisual(m) {
  const d = m.def;
  if (d.shape === 'skeleton' || d.shape === 'knight' || d.shape === 'ghost') {
    const model = d.shape === 'ghost' ? 'Skeleton_Mage' : 'Skeleton_Warrior';
    const ch = makeChar(model, null, 1.85 * (d.shape === 'knight' ? 1.18 : 1) * (d.boss ? 1.55 : 1));
    if (d.shape === 'ghost') attach(ch.root, 'sk_staff', 'r');
    else if (d.shape === 'knight') { attach(ch.root, 'sk_axe', 'r'); attach(ch.root, 'sk_shield', 'l'); }
    else attach(ch.root, 'sk_blade', 'r');
    // osso envelhecido (amarelado, fosco); cavaleiro mais escuro e enferrujado; espectro translúcido e azulado
    const boneTint = new THREE.Color(d.shape === 'knight' ? '#9a8f7a' : '#e6dbc2');
    ch.root.traverse(o => { if (!o.isMesh) return; o.material = o.material.clone(); o.material.roughness = 0.85;
      if (d.shape === 'ghost') { o.material.transparent = true; o.material.opacity = 0.62; o.material.emissive = new THREE.Color('#5a7aff'); o.material.emissiveIntensity = 0.45; o.material.depthWrite = false; }
      else { o.material.color.multiply(boneTint); if (d.shape === 'knight') o.material.color.multiplyScalar(0.62); } });
    const fx = skeletonExtras(ch, d);
    ch.anim.play('Idle');
    return { ...ch, fx, kind: 'skel', height: 1.9 * (d.shape === 'knight' ? 1.18 : 1) * (d.boss ? 1.55 : 1), radius: 0.55 * (d.boss ? 1.5 : 1) };
  }
  const cr = makeCritter(d.shape, d.color, d.mini || d.boss, d.variant);
  const s = Math.max(0.6, d.size) * (d.shape === 'blob' ? 1.1 : 1);
  cr.root.scale.setScalar(s);
  const obj = new THREE.Group(); obj.add(cr.root);
  const h = (d.shape === 'bee' ? 1.4 : d.shape === 'wolf' ? 1.1 : d.shape === 'dummy' ? 2.1 : d.shape === 'demonking' ? 0.95 : d.shape === 'goatmage' ? 0.85 : d.shape === 'frostdragon' ? 0.75 : d.shape === 'lichqueen' ? 1.0 : d.shape === 'cactus' ? 1.25 : d.shape === 'saltlizard' ? 0.7 : d.shape === 'scorpion' ? 0.55 : d.shape === 'ant' ? 0.55 : d.shape === 'runnerbird' ? 2.1 : d.shape === 'bat' ? 1.45 : 0.9) * s;
  return { obj, critter: cr, kind: 'critter', height: h, radius: 0.45 * s * (d.shape === 'frostdragon' ? 1.3 : d.shape === 'saltlizard' ? 1.4 : 1) };
}
// miniaturas e visualização animada dos monstros (Bestiário)
const thumbCache = {};
function monsterThumb(type) {
  if (thumbCache[type]) return thumbCache[type];
  const v = monsterVisual({ def: MONSTERS[type] });
  v.obj.position.set(900, 0, 900); v.obj.rotation.y = 0.55; scene.add(v.obj);
  if (v.critter) v.critter.animate(1.3, false, 0.016); else if (v.anim) { v.anim.play('Idle'); v.anim.update(0.4); }
  const url = renderObj(v.obj, 96, 96); scene.remove(v.obj);
  return (thumbCache[type] = url);
}
/* Visualizador próprio (renderizador separado, sem ler pixels do jogo): rápido de arrastar (S-240) e com zoom (S-237).
   makeObj() → { obj, tick(dt, t), attack?() }. Devolve stop(). */
function objViewer(cv, makeObj, o = {}) {
  const rr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); rr.setPixelRatio(Math.min(2, devicePixelRatio)); rr.setSize(cv.width, cv.height, false);
  rr.outputColorSpace = THREE.SRGBColorSpace; rr.toneMapping = THREE.ACESFilmicToneMapping; rr.setClearColor(0, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#e0ecff', '#5a4a3a', 1.2)); const k = new THREE.DirectionalLight('#fff3e0', 2.4); k.position.set(2, 4, 3); const rim = new THREE.DirectionalLight('#9fc4ff', 1.2); rim.position.set(-3, 2, -3); sc.add(k, rim);
  const it = makeObj(); sc.add(it.obj); it.obj.position.set(0, 0, 0); it.obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(it.obj), sph = box.getBoundingSphere(new THREE.Sphere()), cam = new THREE.PerspectiveCamera(30, cv.width / cv.height, 0.02, 200);
  let t = 0, last = performance.now(), alive = true, spin = o.yaw ?? 0.6, drag = null, zoom = 1, zoomT = 1, pitch = 0.18, nextAtk = 2;
  cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
  cv.onpointerdown = e => { if (e.button !== 0 || (typeof FB !== 'undefined' && (FB.picking || FB.box))) return; e.preventDefault(); e.stopPropagation(); drag = [e.clientX, e.clientY]; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (er) { } };
  cv.onpointermove = e => { if (!drag) return; spin += (e.clientX - drag[0]) * 0.012; if (o.zoom) pitch = clamp(pitch + (e.clientY - drag[1]) * 0.006, -0.3, 1.1); drag = [e.clientX, e.clientY]; };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; cv.style.cursor = 'grab'; };
  if (o.zoom) cv.onwheel = e => { e.preventDefault(); zoomT = clamp(zoomT * (e.deltaY > 0 ? 1.15 : 0.87), 0.25, 2.2); };
  const frame = () => {
    if (!alive || !document.body.contains(cv)) { stop(); return; }
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; if (!drag) spin += dt * (o.autoSpin ?? 0.35);
    zoom += (zoomT - zoom) * Math.min(1, dt * 8);
    it.obj.rotation.y = spin; it.tick && it.tick(dt, t);
    if (it.attack && t > nextAtk) { it.attack(); nextAtk = t + 3 + Math.random() * 2; }
    const d = sph.radius / Math.sin(15 * Math.PI / 180) * (o.dist || 1) * zoom, cy = sph.center.y + (o.zoom ? (1 - zoom) * sph.radius * 0.35 : 0);
    cam.position.set(sph.center.x, cy + Math.sin(pitch) * d, sph.center.z + Math.cos(pitch) * d); cam.lookAt(sph.center.x, cy, sph.center.z);
    rr.render(sc, cam); requestAnimationFrame(frame);
  };
  function stop() { if (!alive) return; alive = false; sc.remove(it.obj); rr.dispose(); try { rr.forceContextLoss(); } catch (e) { } }
  requestAnimationFrame(frame); return stop;
}
function monsterObj(type) { const v = monsterVisual({ def: MONSTERS[type] }); if (v.anim) v.anim.play(MONSTERS[type].aggressive ? 'Idle_Combat' : 'Idle'); return { obj: v.obj, tick: (dt, t) => { if (v.critter) v.critter.animate(t, false, dt); else if (v.anim) v.anim.update(dt); }, attack: v.critter && v.critter.attack ? () => v.critter.attack() : null }; }
function monsterPopup(type) { // S-237: janela grande para girar 360°, inclinar e dar zoom no monstro
  const d = MONSTERS[type], w = document.createElement('div'); w.className = 'mon-pop'; w.innerHTML = `<div class="mon-pop-box"><div class="mon-pop-h"><b>${escH(d.name)}</b><span class="muted">Nv. ${d.lv} · arraste para girar e inclinar · rodinha aproxima</span><button class="mon-pop-x">✕</button></div><canvas width="760" height="560"></canvas></div>`;
  document.body.appendChild(w); const cv = w.querySelector('canvas'), stop = objViewer(cv, () => monsterObj(type), { zoom: true, autoSpin: 0.15 });
  const close = () => { stop(); w.remove(); removeEventListener('keydown', esc); }; const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  w.querySelector('.mon-pop-x').onclick = close; w.onclick = e => { if (e.target === w) close(); }; addEventListener('keydown', esc, true);
}
function monsterLive(type, cv) { // Bestiário: visualizador próprio (S-240) e clique abre a janela grande (S-237)
  cv.title = 'Arraste para girar · clique duplo abre a visualização grande'; cv.ondblclick = () => monsterPopup(type);
  return objViewer(cv, () => monsterObj(type), {});
}
function monsterLiveOld(type, cv) {
  const v = monsterVisual({ def: MONSTERS[type] }); v.obj.position.set(920, 0, 900); scene.add(v.obj);
  if (v.anim) v.anim.play(MONSTERS[type].aggressive ? 'Idle_Combat' : 'Idle');
  const W = cv.width, H = cv.height, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), buf = new Uint8Array(W * H * 4);
  v.obj.traverse(o => o.layers.enable(1)); v.obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(v.obj), sph = box.getBoundingSphere(new THREE.Sphere());
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 80); cam.layers.set(1);
  let t = 0, last = performance.now(), alive = true, nextAtk = 1.5, spin = 0, drag = null;
  // S-099: arrastar com o botão esquerdo gira o bicho (como na vitrine); solto, ele volta a girar sozinho devagar
  cv.style.cursor = 'grab'; cv.title = 'Arraste para girar';
  cv.addEventListener('pointerdown', e => { if (e.button !== 0 || (typeof FB !== 'undefined' && (FB.picking || FB.box))) return; e.preventDefault(); e.stopPropagation(); drag = e.clientX; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
  cv.addEventListener('pointermove', e => { if (drag === null) return; spin += (e.clientX - drag) * 0.012; drag = e.clientX; });
  const endDrag = () => { drag = null; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  const frame = () => {
    if (!alive || !document.body.contains(cv)) { alive = false; scene.remove(v.obj); rt.dispose(); return; }
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (drag === null) spin += dt * 0.35; // gira devagar para mostrar os lados
    v.obj.rotation.y = 0.5 + spin;
    if (v.critter) { v.critter.animate(t, false, dt); if (t > nextAtk && v.critter.attack) { v.critter.attack(); nextAtk = t + 3 + Math.random() * 2; } }
    else if (v.anim) v.anim.update(dt);
    const d = sph.radius * 1.0 / Math.sin(15 * Math.PI / 180);
    cam.position.set(sph.center.x, sph.center.y + sph.radius * 0.35, sph.center.z + d); cam.lookAt(sph.center);
    const bg = scene.background, fog = scene.fog, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    scene.background = null; scene.fog = null; renderer.setClearColor(0, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); renderer.setRenderTarget(null); scene.background = bg; scene.fog = fog; renderer.setClearColor(cc, ca);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    g.putImageData(img, 0, 0);
    setTimeout(() => requestAnimationFrame(frame), 30);
  };
  frame();
  return () => { alive = false; scene.remove(v.obj); };
}
function spawnMonster(zoneId, type, at) {
  const def = MONSTERS[type]; if (!def) return;
  if (def.boss && INTERIORS[zoneId]) SPAWN_BOSS_NEXT = true;
  const pt = at || spawnPoint(zoneId);
  const m = { uid: S.uid++, type, def, zoneId, hp: def.hp, maxHp: def.hp, x: pt.x, z: pt.z, yaw: rng() * 6.28, home: { ...pt }, aggro: false, returning: false, wander: null, nextThink: rng() * 3, nextAttack: 0, status: {}, dead: false, lockAnim: 0, moving: false, stolen: false };
  const v = monsterVisual(m);
  Object.assign(m, { vis: v, obj: v.obj, radius: v.radius, height: v.height });
  m.obj.add(hitbox(m, Math.max(0.5, v.radius + 0.15), v.height + 0.2));
  m.obj.position.set(m.x, groundAt(m.x, m.z), m.z);
  scene.add(m.obj);
  S.monsters.push(m);
}
function monAnim(m, name, o) { if (m.vis.anim) m.vis.anim.play(name, o); }

function updateMonster(m, dt) {
  const t = S.time, d = m.def, P = S.pos;
  if (d.dummy) { m.vis.critter.animate(t, false, dt); return; } // boneco: só balança
  if (m.vis.anim) m.vis.anim.update(dt);
  if (m.vis.fx) m.vis.fx(t);
  if (m.dead) {
    const k = t - m.deathT;
    if (m.vis.kind === 'critter') {
      const cr = m.vis.critter, r = cr.root;
      if (m.deathStyle === 'raro') { // brilha e se desfaz em luz
        const kk = Math.min(1, k / 0.3); r.scale.setScalar(Math.max(0.6, d.size) * (1 + kk * 0.15) * (k > 0.3 ? Math.max(0.01, 1 - (k - 0.3) * 4) : 1));
        if (!m.glowed) { m.glowed = true; r.traverse(o => { if (o.isMesh && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.set('#fff2c0'); o.material.emissiveIntensity = 0.9; } }); }
      } else { // cai de lado, fica um tempo e afunda devagar
        const f = Math.min(1, k / 0.45), ease = 1 - Math.pow(1 - f, 3);
        r.rotation.z = m.deathSide * ease * Math.PI / 2 * 0.95; r.position.y = (cr.flying ? -Math.min(1.05, k * 3) : 0) + Math.sin(f * Math.PI) * 0.08;
        if (k > 2.4) r.position.y -= (k - 2.4) * 0.35;
      }
    }
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
  if (!m.aggro && d.aggressive && !S.p.dead && !safe && dp < d.aggroRange * TM * 1.3) { m.aggro = true; m.returning = false; }
  if (m.aggro && (S.p.dead || safe || Math.hypot(m.x - m.home.x, m.z - m.home.z) > 38)) { m.aggro = false; m.returning = true; m.hp = m.maxHp; }
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
    if (t >= m.nextThink) { m.nextThink = t + 2 + rng() * 5; m.wander = rng() < 0.6 ? { x: m.home.x + (rng() * 2 - 1) * 8, z: m.home.z + (rng() * 2 - 1) * 8 } : null; if (m.wander && lakeDist(m.wander.x, m.wander.z) < LAKE.r + 3) m.wander = null; }
    if (m.wander) { goal = m.wander; speed *= 0.5; if (Math.hypot(m.x - m.wander.x, m.z - m.wander.z) < 0.6) m.wander = null; }
  }
  m.moving = false;
  if (goal && t >= m.lockAnim) {
    const ang = Math.atan2(goal.x - m.x, goal.z - m.z);
    m.yaw = angLerp(m.yaw, ang, Math.min(1, dt * 8));
    const nx = m.x + Math.sin(ang) * speed * dt, nz = m.z + Math.cos(ang) * speed * dt;
    const r = resolve(nx, nz, m.radius);
    m.x = r.x; m.z = r.z; m.moving = true;
    const ld = lakeDist(m.x, m.z), lim = LAKE.r + 2.5; // monstros não entram no lago
    if (!m.interior && ld < lim) { const a = Math.atan2(m.z - LAKE.z, m.x - LAKE.x), rr = lim * lakeShape(LAKE.x + Math.cos(a), LAKE.z + Math.sin(a)) + 0.1; m.x = LAKE.x + Math.cos(a) * rr; m.z = LAKE.z + Math.sin(a) * rr; if (m.wander) m.wander = null; }
  }
  m.obj.position.set(m.x, groundAt(m.x, m.z), m.z);
  m.obj.rotation.y = m.yaw;
  { // sons de cada bicho (S-091/S-097): passos perto de você e um som de "presença" de vez em quando
    const sx = MON_SFX[d.shape], near = Math.hypot(m.x - P.x, m.z - P.z);
    if (sx && near < 16 && sx.step && m.moving && t >= (m.stepT || 0)) { Sound.play(sx.step); m.stepT = t + sx.every * (m.aggro ? 0.7 : 1) * (0.85 + rng() * 0.3); }
    if (sx && sx.idle && near < (sx.idleR || 22) && t >= (m.idleT || 0)) { if (m.idleT) Sound.play(sx.idle); m.idleT = t + (sx.idleEvery || 8) * (0.7 + rng() * 0.8); }
  }
  if (m.vis.critter) m.vis.critter.animate(t, m.moving, dt);
  else if (t >= m.lockAnim) monAnim(m, m.moving ? (m.aggro || m.returning ? 'Running_C' : 'Walking_D_Skeletons') : (m.aggro ? 'Idle_Combat' : 'Idle'));
}
const MON_SFX = {
  wolf: { step: 'wolfStep', every: 0.32, attack: 'wolfBite', pre: 'wolfGrowl', hurt: 'wolfHurt', die: 'wolfDie', idle: 'wolfHowl', idleEvery: 25, idleR: 60 },
  bee: { step: 'beeBuzz', every: 0.42, attack: 'beeSting', die: 'beeDie' },
  blob: { step: 'slimeStep', every: 0.5, attack: 'slimeStep', die: 'slimeDie' },
  mushroom: { step: 'mushStep', every: 0.42, attack: 'mushStep', die: 'mushDie' },
  rabbit: { step: 'rabbitStep', every: 0.35, die: 'rabbitDie' },
  skeleton: { step: 'boneStep', every: 0.45, attack: 'boneAttack', pre: 'boneChatter', hurt: 'boneHit', hurtP: 1, die: 'boneDie', idle: 'boneChatter', idleEvery: 10, idleR: 16 },
  knight: { step: 'boneStep', every: 0.5, attack: 'knightSwing', pre: 'knightVoice', hurt: 'boneHit', hurtP: 1, die: 'boneDie', idle: 'knightVoice', idleEvery: 11, idleR: 26, talk: 'knightVoice' }, // S-104: o Cavaleiro Caído fala e golpeia com peso
  ghost: { attack: 'ghostWail', die: 'ghostWail', idle: 'ghostWail', idleEvery: 12, idleR: 18 },
  cactus: { step: 'mushStep', every: 0.4, attack: 'beeSting', die: 'mushDie' },
  saltlizard: { step: 'rabbitStep', every: 0.3, attack: 'wolfBite', pre: 'dragonBreath', hurt: 'wolfHurt', die: 'wolfDie' },
  scorpion: { step: 'boneStep', every: 0.25, attack: 'beeSting', pre: 'boneChatter', hurt: 'boneHit', die: 'boneDie' },
  ant: { step: 'boneStep', every: 0.22, attack: 'wolfBite', pre: 'boneChatter', die: 'beeDie' },
  runnerbird: { step: 'rabbitStep', every: 0.35, attack: 'swing', hurt: 'wolfHurt', die: 'wolfDie' },
  bat: { step: 'beeBuzz', every: 0.5, attack: 'wolfBite', die: 'beeDie', idle: 'ghostWail', idleEvery: 14, idleR: 16 },
  demonking: { step: 'bossStep', every: 0.9, attack: 'demonRoar', pre: 'demonRoar', hurt: 'hit', die: 'death', idle: 'demonRoar', idleEvery: 14, idleR: 40 },
  goatmage: { attack: 'magic', pre: 'goatChant', die: 'ghostWail', idle: 'goatChant', idleEvery: 15, idleR: 30 },
  frostdragon: { step: 'bossStep', every: 1.0, attack: 'dragonBreath', pre: 'dragonRoar', hurt: 'wolfHurt', die: 'dragonRoar', idle: 'dragonRoar', idleEvery: 12, idleR: 45 },
  lichqueen: { attack: 'lichWail', pre: 'lichWail', hurt: 'boneHit', hurtP: 1, die: 'boneDie', idle: 'lichWail', idleEvery: 10, idleR: 30 },
};
function monsterAttack(m) {
  { const sx = MON_SFX[m.def.shape]; if (sx && sx.attack) Sound.play(sx.attack); if (sx && sx.pre && !m.growled) { Sound.play(sx.pre); m.growled = true; } else if (sx && sx.talk && Math.random() < 0.25) later(0.5, () => Sound.play(sx.talk)); }
  const d = m.def;
  if (m.vis.anim) { monAnim(m, d.shape === 'ghost' ? 'Spellcast_Shoot' : (d.shape === 'knight' ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop'), { once: true, restart: true }); m.lockAnim = S.time + 0.7; }
  else if (m.vis.critter.attack) m.vis.critter.attack(); // bote / mordida / ferroada (animação própria de cada bicho)
  else { const r = m.vis.critter.root; r.position.z = 0.3; later(0.15, () => { r.position.z = 0; }); }
  if (d.range > 2) shoot(m.obj.position.clone().add(new THREE.Vector3(0, 1.4, 0)), () => S.me.obj.position.clone().add(new THREE.Vector3(0, 1.1, 0)), ELEMENTS[d.element].color, () => monsterHit(m));
  else later(0.35, () => {
    if (m.dead) return;
    const pe = S.pet, reach = d.range * TM + m.radius + 1.6;
    // S-114: se o mascote está brigando com ele de perto, às vezes o golpe vai no mascote
    if (pe && !pe.down && S.p.pet && m.petHits && S.time - m.petHits < 6 && Math.hypot(pe.x - m.x, pe.z - m.z) < reach && Math.random() < (Math.hypot(pe.x - m.x, pe.z - m.z) < Math.hypot(S.pos.x - m.x, S.pos.z - m.z) ? 0.6 : 0.25)) { if (Math.random() * 100 < clamp(80 + d.hit - 20, 5, 95)) petHurt(m, randInt(d.atk[0], d.atk[1])); return; }
    if (Math.hypot(S.pos.x - m.x, S.pos.z - m.z) < reach) monsterHit(m);
  });
}
function monsterHit(m) {
  const p = S.p, d = m.def; if (p.dead) return;
  if (Math.random() * 100 >= clamp(80 + d.hit - p.d.flee, 5, 95)) { floatAt(S.me.obj.position, 'Esquivou', '#cfe8ff', 1.9); Sound.play('miss'); return; }
  hurtPlayer(m, randInt(d.atk[0], d.atk[1]));
}
function hurtPlayer(m, raw) {
  const p = S.p;
  let dmg = raw * 100 / (100 + p.d.def);
  dmg *= 1 - Math.min(80, p.d.resist[m.def.element] || 0) / 100;
  if (p.pet && PETS[p.pet.species].role === 'guardiao' && petNear()) dmg *= 1 - petPower(p.pet).guard / 100;
  dmg = Math.max(1, Math.round(dmg));
  if (S.god) { floatAt(S.me.obj.position, `-${dmg} (imune)`, '#ffd76a', 2); return; } // God Mode: os monstros atacam, mas o HP não desce
  p.hp -= dmg; S.sitting = false;
  floatAt(S.me.obj.position, '-' + dmg, '#ff5a5a', 2.1);
  Sound.play('hurt');
  if (!S.casting && S.time >= S.lockAnim && !moveInput().any) { S.me.anim.play('Hit_A', { once: true, restart: true, fade: 0.08 }); S.lockAnim = S.time + 0.35; }
  if (p.hp <= 0) { p.hp = 0; playerDie(); }
}
/* S-098: queda de lugar alto machuca (como no Skyrim): até 5 m nada; a partir daí o dano cresce rápido e
   de ~19 m para cima mata. Cair na água amortece. Montado, a montaria absorve parte. God Mode não sente. */
const SLOPE_MAX = 1.0; // inclinação máxima para subir andando (≈ 45°)
function fallDamage(drop, water) {
  const p = S.p; if (!p || p.dead || drop < 5 || water || S.interior || S.pos.x > HALF + 100 || S.time - (S.tpT || -9) < 1.5) return; // salas e logo após teleporte não contam
  const k = Math.pow((drop - 5) / 14, 1.35) * (S.riding ? 0.6 : 1), dmg = Math.max(1, Math.round(p.d.maxHp * k));
  if (S.god) { floatAt(S.me.obj.position, `-${dmg} queda (imune)`, '#ffd76a', 2); return; }
  p.hp -= dmg; S.sitting = false; hudDirty = true;
  floatAt(S.me.obj.position, '-' + dmg + ' queda', '#ff5a5a', 2.1); Sound.play('hurt');
  if (p.hp <= 0) { p.hp = 0; log(`Você caiu de ${Math.round(drop)} m de altura.`, 'warn'); playerDie(); }
  else if (k > 0.3) log(`Que queda! (${Math.round(drop)} m)`, 'warn');
}
// corpos não se sobrepõem (S-088): monstros entre si, com o jogador e com o mascote.
// Cada um tem um "peso" (chefe e boneco de treino quase não saem do lugar; o jogador cede pouco).
function separateBodies() {
  const P = S.pos, list = [];
  for (const m of S.monsters) if (!m.dead && m.obj.visible && Math.abs(m.x - P.x) < 45 && Math.abs(m.z - P.z) < 45) list.push({ o: m, r: Math.max(0.35, m.radius * 0.85), w: m.def.dummy ? 0 : m.def.boss ? 0.15 : m.def.mini ? 0.4 : 1, mon: true });
  if (!list.length) return;
  if (S.p && !S.p.dead) list.push({ o: P, r: 0.4, w: 0.25, me: true });
  if (S.pet) list.push({ o: S.pet, r: 0.35, w: 0.8, pet: true });
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const A = list[i], B = list[j], dx = B.o.x - A.o.x, dz = B.o.z - A.o.z, d = Math.hypot(dx, dz), min = A.r + B.r;
    if (d >= min || (A.w + B.w) === 0) continue;
    const nx = d > 1e-4 ? dx / d : Math.cos(i), nz = d > 1e-4 ? dz / d : Math.sin(i), push = (min - d), wa = A.w / (A.w + B.w), wb = B.w / (A.w + B.w);
    A.o.x -= nx * push * wa; A.o.z -= nz * push * wa; B.o.x += nx * push * wb; B.o.z += nz * push * wb;
    A.moved = B.moved = true;
  }
  for (const e of list) if (e.moved) { const r = resolve(e.o.x, e.o.z, e.r); e.o.x = r.x; e.o.z = r.z; if (e.mon) e.o.obj.position.set(e.o.x, groundAt(e.o.x, e.o.z), e.o.z); } // não empurra ninguém para dentro de parede
}
function hurtMonster(m, res, elem) {
  if (m.dead) return;
  if (m.isRival) return arenaHit(m, res, elem); // PvP: quem decide o HP é o servidor
  const p = S.p;
  if (res.miss) { floatAt(m.obj.position, 'Errou', '#cfd6e0', m.height + 0.4); Sound.play('miss'); m.aggro = true; m.hitByPlayer = true; return; }
  if (m.def.dummy) { // boneco de treino: mostra o dano, guarda para o DPS e nunca cai
    (m.dps = m.dps || []).push([S.time, res.dmg]); m.total = (m.total || 0) + res.dmg;
    floatAt(m.obj.position, res.dmg, res.crit ? '#ffe36a' : '#ffffff', m.height + 0.4, res.crit); Sound.play(res.crit ? 'crit' : 'hit');
    if (m.vis.critter.hit) m.vis.critter.hit(Math.sign(Math.cos(Math.atan2(S.pos.x - m.x, S.pos.z - m.z) - m.yaw)) || 1);
    return;
  }
  m.hp -= res.dmg; m.aggro = true; m.returning = false; m.hitByPlayer = true;
  const strong = elem && elem !== 'neutro' && elem !== 'veneno' && elementMult(elem, m.def.element) > 1;
  floatAt(m.obj.position, res.dmg, res.crit ? '#ffe36a' : strong ? '#ffb070' : elem === 'veneno' ? '#9be36a' : '#ffffff', m.height + 0.4, res.crit);
  Sound.play(res.crit ? 'crit' : 'hit');
  { const sx = MON_SFX[m.def.shape]; if (sx && sx.hurt && Math.random() < (sx.hurtP ?? 0.6)) Sound.play(sx.hurt); }
  if (m.vis.critter) { const r = m.vis.critter.root, s0 = r.scale.x; r.scale.setScalar(s0 * 1.15); later(0.08, () => r.scale.setScalar(s0)); }
  else if (S.time >= m.lockAnim) { monAnim(m, 'Hit_A', { once: true, restart: true, fade: 0.05 }); m.lockAnim = S.time + 0.3; }
  if (p.d.lifesteal) p.hp = Math.min(p.d.maxHp, p.hp + Math.floor(res.dmg * p.d.lifesteal / 100));
  if (m.hp <= 0) killMonster(m);
}
function killMonster(m) {
  const d = m.def, p = S.p;
  m.dead = true; m.deathT = S.time; m.hp = 0; m.deathStyle = Math.random() < 0.15 ? 'raro' : 'normal'; m.deathSide = Math.random() < 0.5 ? -1 : 1;
  if (m.deathStyle === 'raro') later(m.vis.kind === 'critter' ? 0.25 : 1.1, () => soulBurst(m));
  if (m.vis.anim) monAnim(m, 'Death_C_Skeletons', { once: true, fade: 0.1 });
  Sound.play((MON_SFX[d.shape] && MON_SFX[d.shape].die) || 'mdie');
  gainExp(d.exp, d.jexp);
  if (questOnKill(p, m.type)) hudDirty = true; // S-126
  for (const [id, rate] of d.drops) if (Math.random() < rate * CONFIG.DROP_RATE) { addItem(p, id, 1); log(`Saque: ${ITEMS[id].name}`, 'item'); }
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
  // S-126: o NPC da história principal fica na praça, ao sul do poço
  { ...QUEST_GIVERS_NPC.teodoro, dx: -1, dz: -11, lines: 'Alvorada já viu muitos aventureiros partirem por aquele portão. Poucos voltaram com histórias tão boas quanto as que você ainda vai viver.' },
  // look: rosto 3D + cabelo (mesmo sistema do jogador); hat = o acessório cobre a cabeça
  { id: 'ivra', name: 'Mestra Ivra', title: 'Mentora de Classes', model: 'Mage', show: [], dx: -8, dz: -6, look: { race: 'elfo', face: 'alegre', hair: { style: 'longo', color: 'platinado' } } }, // S-231: visual único de mentora (vestido, tiara e grimório)
  { id: 'bento', name: 'Bento', title: 'Mercador', model: 'Barbarian', show: ['Mug', 'Barbarian_Hat'], dx: 9, dz: -7, hat: true, look: { race: 'humano', face: 'alegre', hair: { style: 'curto', color: 'castanho' }, beard: true } },
  { id: 'clara', name: 'Irmã Clara', title: 'Curandeira', model: 'Mage', show: ['Spellbook_open', 'Mage_Cape'], dx: -7, dz: 7, look: { race: 'humano', face: 'sereno', hair: { style: 'coque', color: 'loiro' } } },
  { id: 'tobias', name: 'Guarda Tobias', title: 'Guia da Vila', model: 'Knight', show: ['1H_Sword', 'Rectangle_Shield', 'Knight_Helmet', 'Knight_Cape'], dx: 15, dz: 2, hat: true, look: { race: 'humano', face: 'valente', hair: { style: 'curto', color: 'castanho_escuro' } } },
  { id: 'bravo', name: 'Capitão Bravo', title: 'Mestre da Arena (PvP)', model: 'Knight', show: ['2H_Sword', 'Knight_Cape'], dx: 13, dz: -9, look: { race: 'humano', face: 'valente', hair: { style: 'espetado', color: 'preto' }, beard: true } },
];
function spawnNpcs() {
  for (const n of NPC3D) {
    const ch = makeNpcHero(n);
    const x = VILLAGE.x + n.dx, z = VILLAGE.z + n.dz;
    ch.obj.position.set(x, heightAt(x, z), z);
    ch.obj.rotation.y = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
    ch.anim.play(n.id === 'bento' ? 'Idle' : 'Idle', { speed: 0.8 + rng() * 0.4 });
    const npc = { ...n, x, z, ...ch, isNpc: true, height: 1.85, radius: 0.5 };
    ch.obj.add(hitbox(npc, 0.6, 2));
    scene.add(ch.obj); colliders.push({ x, z, r: 0.6 });
    S.npcs.push(npc);
  }
}

/* =========================== Jogador =========================== */
// veste o personagem com a aparência dele: cabelo personalizado (novo) ou cabeça pronta (personagens antigos)
function dressLook(ch, cls, look = {}, hatId = null) {
  look = normalizeLook(look); // todo mundo usa a cabeça lisa + rosto 3D (saves antigos com cabeça pronta são convertidos)
  const custom = true;
  const d = dress(ch, cls, MODELS, 'Barbarian');
  applyHair(ch, look, hatCovers(hatId));
  applyRace(ch, look && look.race);
  const hfx = hatId ? applyHat(ch, hatId, MODELS, custom) : null; // chapéu = o que estiver equipado no topo da cabeça
  return hfx ? { ...d, update: t => { d.update(t); hfx(t); } } : d;
}
const hatOf = p => (p && p.equip && p.equip.cabeca && p.equip.cabeca.id) || null;
// personagem realista (S-093): roupa da classe + rosto/cabelo/pele do jogador + armas + enfeites + chapéu equipado
const SKIN_HEX = { clara: '#e2b393', escura: '#8a5a3c' };
function makeHero(cls, look0 = {}, hatId = null, extra = {}) {
  const look = normalizeLook(look0);
  const h = makeHuman({ race: look.race, sex: look.sex, outfit: extra.outfit || CLASS_OUTFIT[cls] || 'campones', hair: look.hair.style, hairColor: HAIR_COLORS[look.hair.color].hex, skin: look.skin, beard: (look.beard || look.race === 'anao') && look.sex === 'm', hood: extra.hood });
  h.root.userData.skin = new THREE.Color(SKIN_HEX[look.skin]);
  const d = cls ? dressHuman(h, cls, MODELS, { offhand: extra.offhand }) : { style: '1h', update: () => { } };
  if (look.race === 'elfo') h.obj.scale.set(0.97, 1.04, 0.97); // anão: o corpo de anão de verdade vem do makeHuman (S-178)
  const hfx = hatId ? applyHat(h, hatId, MODELS, true) : null;
  return { ch: h, d: hfx ? { ...d, update: t => { d.update(t); hfx(t); } } : d };
}
const NPC_FEMALE = new Set(['ivra', 'clara', 'flora', 'rosa', 'neli', 'samira', 'isis', 'mirela']);
function makeNpcHero(n) {
  const look = normalizeLook({ ...(n.look || {}), sex: (n.look && n.look.sex) || (NPC_FEMALE.has(n.id) ? 'f' : 'm') });
  const { ch } = makeHero(null, look, null, { outfit: /Knight|Barbarian|Rogue/.test(n.model) ? 'patrulheiro' : 'campones', hood: n.model === 'Rogue_Hooded' });
  for (const it of n.show || []) if (!/_Cape$/.test(it)) humanBorrow(ch.root, MODELS, n.model, it);
  const rfx = dressNpcRole(ch, n.id, MODELS); if (rfx) ch.roleFx = rfx; // S-193/S-197: freira, guarda...
  return ch;
}
const offOf = p => (p && p.equip && p.equip.escudo && p.equip.escudo.id) || null; // S-202: escudo só aparece se estiver equipado
function buildPlayerModel() {
  if (S.me) scene.remove(S.me.obj);
  const L = CLASS_LOOKS[S.p.cls] || CLASS_LOOKS.aprendiz;
  const { ch, d } = makeHero(S.p.cls, S.p.look, hatOf(S.p), { offhand: offOf(S.p) });
  let skinFx = null; try { skinFx = S.p.cosmetics && S.p.cosmetics.skin ? applySkin(ch, S.p.cosmetics.skin) : null; } catch (e) { }
  S.me = { hatId: hatOf(S.p), offId: offOf(S.p), ...ch, look: { model: 'humano', show: L.show, style: d.style }, lookFx: skinFx ? t => { d.update(t); skinFx(t); } : d.update };
  scene.add(ch.obj);
  ch.anim.play('Idle');
  S.me.song = makeSongAura(); ch.obj.add(S.me.song);
  buildViewModel(); ch.obj.visible = S.view !== 'fps'; $('crosshair').classList.toggle('hidden', !isAction()); // mãos da 1ª pessoa com a arma da classe
}
/* S-108: aura da canção do Bardo — só aparece enquanto ele está sob uma canção (buff).
   Uma pauta dourada de 5 linhas gira na cintura e notas de formatos diferentes (semínima, colcheia,
   par de colcheias ligadas, clave) nascem nela e sobem em espiral, cada uma com sua cor, como uma melodia. */
const SONG_BUFFS = new Set((CLASSES.menestrel.skills || []).filter(id => SKILLS[id] && SKILLS[id].effect && SKILLS[id].effect.kind === 'buff'));
function noteShape(kind) {
  const shapes = [];
  const addHead = (cx, cy) => { const s2 = new THREE.Shape(); s2.absellipse(cx, cy, 0.05, 0.034, 0, Math.PI * 2, false, -0.4); shapes.push(s2); };
  const stem = (x, y0, y1) => { const s2 = new THREE.Shape(); s2.moveTo(x - 0.007, y0); s2.lineTo(x + 0.007, y0); s2.lineTo(x + 0.007, y1); s2.lineTo(x - 0.007, y1); shapes.push(s2); };
  if (kind === 'clave') { // clave de sol estilizada: espiral + haste com laço
    const pts = []; for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 3.2, r = 0.012 + k / 64 * 0.06; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r - 0.02)); }
    const c = new THREE.CatmullRomCurve3([...pts.map(p => new THREE.Vector3(p.x, p.y, 0)), new THREE.Vector3(0.05, 0.12, 0), new THREE.Vector3(0.0, 0.2, 0), new THREE.Vector3(-0.03, 0.12, 0), new THREE.Vector3(0.02, -0.12, 0), new THREE.Vector3(-0.02, -0.16, 0)]);
    return new THREE.TubeGeometry(c, 90, 0.009, 6, false);
  }
  addHead(0, 0); stem(0.044, 0.0, 0.2);
  if (kind === 'colcheia') { const f = new THREE.Shape(); f.moveTo(0.037, 0.2); f.bezierCurveTo(0.06, 0.17, 0.12, 0.14, 0.09, 0.06); f.bezierCurveTo(0.1, 0.12, 0.07, 0.15, 0.037, 0.16); shapes.push(f); }
  if (kind === 'par') { addHead(0.14, 0.03); stem(0.184, 0.03, 0.22); const b = new THREE.Shape(); b.moveTo(0.037, 0.2); b.lineTo(0.191, 0.22); b.lineTo(0.191, 0.185); b.lineTo(0.037, 0.165); shapes.push(b); }
  return new THREE.ExtrudeGeometry(shapes, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 16 });
}
function makeSongAura() {
  const g = new THREE.Group(), cols = ['#ffd76a', '#ffb3d9', '#9ae0ff', '#c9a2ff', '#ffe9a8'], kinds = ['seminima', 'colcheia', 'par', 'colcheia', 'clave', 'seminima', 'par', 'colcheia', 'seminima', 'colcheia'];
  const staff = new THREE.Group(); g.add(staff);
  const lineM = new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let k = 0; k < 5; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.0045, 4, 96), lineM); r.rotation.x = Math.PI / 2; r.position.y = 0.95 + k * 0.045; staff.add(r); }
  staff.rotation.z = 0.12;
  const geos = {}, notes = kinds.map((kd, i) => {
    const m = new THREE.Mesh(geos[kd] || (geos[kd] = noteShape(kd)), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], emissive: cols[i % cols.length], emissiveIntensity: 1.3, roughness: 0.35, metalness: 0.3, transparent: true, depthWrite: false }));
    m.castShadow = false; g.add(m); return { m, off: i / kinds.length, spin: (i % 2 ? 1 : -1) * (0.8 + (i % 3) * 0.3) };
  });
  const L = vlight('#ffc8e8', 0.9, 5); L.position.y = 1.2; g.add(L);
  g.visible = false;
  g.userData.update = (t, on) => {
    const a = g.userData.alpha = Math.max(0, Math.min(1, (g.userData.alpha || 0) + (on ? 0.04 : -0.04))); g.visible = a > 0.01; if (!g.visible) { L.intensity = 0; return; }
    staff.rotation.y = t * 0.6; lineM.opacity = 0.5 * a;
    for (const n of notes) {
      const k = (t * 0.22 + n.off) % 1, ang = n.off * Math.PI * 2 + t * 0.9 + k * 2.2, r = 0.78 - k * 0.35;
      n.m.position.set(Math.cos(ang) * r, 0.98 + k * 1.5 + Math.sin(t * 3 + n.off * 9) * 0.05, Math.sin(ang) * r);
      n.m.rotation.set(Math.sin(t * 2 + n.off * 5) * 0.25, -ang + Math.PI / 2, Math.sin(t * 1.5 + n.off * 7) * 0.3 * n.spin);
      const life = Math.sin(Math.min(1, k * 1.15) * Math.PI); n.m.material.opacity = life * a; n.m.scale.setScalar(0.85 + life * 0.5);
    }
    L.intensity = 0.9 * a;
  };
  return g;
}
const keys = {};
const mouse = { left: false, right: false, moved: 0, x: 0, y: 0 };
const _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _ty = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);
function legTwist(me, ang) {
  const r = me.root, pel = me._pel || (me._pel = r.getObjectByName('pelvis')), sp = me._sp || (me._sp = r.getObjectByName('spine_01')); if (!pel || !sp) return;
  pel.parent.updateWorldMatrix(true, false); pel.parent.getWorldQuaternion(_tq);
  _ty.setFromAxisAngle(_UP, ang); _tq2.copy(_tq).invert().multiply(_ty).multiply(_tq); pel.quaternion.premultiply(_tq2); // gira o quadril (e as pernas) em volta do "para cima" do mundo
  pel.updateWorldMatrix(false, false); pel.getWorldQuaternion(_tq);
  _ty.setFromAxisAngle(_UP, -ang); _tq2.copy(_tq).invert().multiply(_ty).multiply(_tq); sp.quaternion.premultiply(_tq2); // e devolve o tronco para a mira
}
function moveInput() {
  const k = keys;
  let fwd = 0, strafe = 0, turn = 0;
  if (k.w || k.arrowup || (mouse.left && mouse.right)) fwd += 1;
  if (k.s || k.arrowdown) fwd -= 1;
  const L = k.a || k.arrowleft, R = k.d || k.arrowright;
  if (mouse.right || isAction() || S.fire) { if (L) strafe -= 1; if (R) strafe += 1; } else { if (L) turn += 1; if (R) turn -= 1; } // modo ação ou mirando (botão esquerdo): A/D andam de lado
  if (k.q_strafe) strafe -= 1;
  return { fwd, strafe, turn, any: !!(fwd || strafe) };
}
// grade de colisão: cada obstáculo entra nas células de 16 m que ele toca; o teste só olha a célula do ponto
const CG = 16, cgrid = new Map(); let cgridN = -1;
function colGrid() {
  if (cgridN === colliders.length) return; cgrid.clear(); cgridN = colliders.length;
  for (const c of colliders) { const R = c.r + 2; for (let i = Math.floor((c.x - R) / CG); i <= Math.floor((c.x + R) / CG); i++) for (let j = Math.floor((c.z - R) / CG); j <= Math.floor((c.z + R) / CG); j++) { const k = i * 100003 + j; let a = cgrid.get(k); if (!a) cgrid.set(k, a = []); a.push(c); } }
}
const NOCOL = [];
function resolve(x, z, r) {
  colGrid();
  const near = cgrid.get(Math.floor(x / CG) * 100003 + Math.floor(z / CG)) || NOCOL;
  for (let it = 0; it < 2; it++) for (const c of near) {
    const dx = x - c.x, dz = z - c.z;
    if (c.box) {
      if (Math.abs(dx) > c.r + r + 0.5 || Math.abs(dz) > c.r + r + 0.5) continue;
      const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      const px = c.hx + r - Math.abs(lx), pz = c.hz + r - Math.abs(lz);
      if (px > 0 && pz > 0) { if (px < pz) lx = Math.sign(lx || 1) * (c.hx + r); else lz = Math.sign(lz || 1) * (c.hz + r); x = c.x + lx * cs + lz * sn; z = c.z - lx * sn + lz * cs; }
      continue;
    }
    const d = Math.hypot(dx, dz), min = c.r + r;
    if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
  }
  const I = x > HALF + 100 ? roomAt(x, z) : null; // vale para jogador, mascote e monstros (a masmorra tem monstros)
  if (I && I.round) { const dx = x - I.x, dz = z - I.z, d = Math.hypot(dx, dz), R = I.round - 0.6; if (d > R) { x = I.x + dx / d * R; z = I.z + dz / d * R; } }
  else if (I) { x = clamp(x, I.x - I.w / 2 + 0.6, I.x + I.w / 2 - 0.6); z = clamp(z, I.z - I.d / 2 + 0.6, I.z + I.d / 2 - 0.3); }
  else if (x <= HALF + 100) { x = clamp(x, -PLAY_LIMIT, PLAY_LIMIT); z = clamp(z, -PLAY_LIMIT, PLAY_LIMIT); const sp = deckAt(x, z) === null ? seaPush(x, z) : null; if (sp) { x = sp.x; z = sp.z; } } // ninguém entra no mar fundo
  return { x, z };
}
function updatePlayer(dt) {
  const p = S.p, P = S.pos, me = S.me, t = S.time;
  me.anim.update(dt);
  { // S-236: mirando (botão esquerdo) e andando de lado, as pernas viram para onde você anda e o tronco continua na mira
    const mi0 = moveInput(), want = S.fire && !isAction() && !S.riding && mi0.any ? (mi0.fwd > 0 ? mi0.strafe * -0.6 : mi0.fwd < 0 ? mi0.strafe * 0.5 : mi0.strafe * -Math.PI / 2 * 0.9) : 0;
    S.legTwist = angLerp(S.legTwist || 0, want, Math.min(1, dt * 10));
    if (Math.abs(S.legTwist) > 0.01) legTwist(me, S.legTwist);
  }
  if (me.lookFx) me.lookFx(t);
  if (me.song) me.song.userData.update(t, Object.keys(p.buffs).some(id => SONG_BUFFS.has(id)));
  if (p.dead) return;
  if (S.arena && S.arena.dead) return; // derrotado na arena: esperando voltar
  // buffs e regeneração
  for (const id in p.buffs) if (p.buffs[id].until <= t) { delete p.buffs[id]; recalc(p); log(`${SKILLS[id].name} terminou.`); hudDirty = true; }
  S.regenHp = (S.regenHp || 0) + dt; S.regenSp = (S.regenSp || 0) + dt;
  if (S.regenHp >= (S.sitting ? 3 : 6)) { S.regenHp = 0; p.hp = Math.min(p.d.maxHp, p.hp + Math.max(1, Math.floor(p.d.maxHp / 60 + p.d.vit / 4)) + p.d.hpRegen); }
  if (S.regenSp >= (S.sitting ? 4 : 8)) { S.regenSp = 0; p.sp = Math.min(p.d.maxSp, p.sp + Math.max(1, Math.floor(p.d.maxSp / 50 + p.d.int / 5)) + p.d.spRegen); }
  if (S.god) { p.hp = p.d.maxHp; p.sp = p.d.maxSp; }
  // movimento
  const mi = moveInput();
  if (!isAction()) updateAimCursor();
  if (isAction()) { P.yaw = S.cam.yaw; actionFire(); updateViewModel(dt); } // o corpo olha para onde a mira aponta
  else if (S.fire) { const q = aimPoint(30); P.yaw = angLerp(P.yaw, Math.atan2(q.x - P.x, q.z - P.z), Math.min(1, dt * 14)); actionFire(); } // S-141/S-196: segurando o esquerdo, o corpo mira no cursor e WASD anda (A/D de lado) enquanto ataca
  else {
    P.yaw += mi.turn * 2.6 * dt;
    if (mi.turn && !mouse.left) S.cam.yaw = angLerp(S.cam.yaw, P.yaw, Math.min(1, dt * 20));
    else if (mi.any && !mouse.left && !mouse.right) S.cam.yaw = angLerp(S.cam.yaw, P.yaw, Math.min(1, dt * 3));
  }
  if ((mi.any || mi.turn) && S.sitting) S.sitting = false;
  if (mi.any && S.casting) { S.casting = null; log('Conjuração cancelada.', 'warn'); $('castbar3d').classList.add('hidden'); }
  const base = p.d.speed / 32 * TM * 1.1 * (S.god ? 3.2 : 1) * (S.riding ? (S.riding.war ? 1.25 : MOUNT_SPEED) : 1) * ((S.fire || S.time - (S.lastAtk || -9) < 0.6) && !S.riding ? 0.55 : 1); // S-236: atacando você anda mais devagar (estilo WoW)
  const inLake = !S.interior && lakeDist(P.x, P.z) < LAKE.r + 1;
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
  let r = resolve(P.x + S.vel.x * dt, P.z + S.vel.z * dt, 0.45);
  // S-098: encostas íngremes não dão para subir (nem pulando). Fora das salas e sem God Mode.
  if (!S.god && !S.interior && r.x <= HALF + 100) {
    const steep = (x, z) => { const hd = Math.hypot(x - P.x, z - P.z); if (hd < 1e-4) return false; const rise = groundAt(x, z) - P.y; return P.ground ? rise > 0.06 && rise / hd > SLOPE_MAX : rise > 0.25; };
    if (steep(r.x, r.z)) {
      // tenta deslizar ao longo da encosta (só x ou só z); se nada servir, fica parado
      const ax = resolve(r.x, P.z, 0.45), az = resolve(P.x, r.z, 0.45);
      if (!steep(ax.x, ax.z)) { r = ax; S.vel.z *= 0.3; } else if (!steep(az.x, az.z)) { r = az; S.vel.x *= 0.3; } else { r = { x: P.x, z: P.z }; S.vel.x *= 0.2; S.vel.z *= 0.2; }
    }
    // parado numa encosta íngreme demais: escorrega para baixo
    if (P.ground) {
      const e = 0.6, gx = (groundAt(P.x + e, P.z) - groundAt(P.x - e, P.z)) / (2 * e), gz = (groundAt(P.x, P.z + e) - groundAt(P.x, P.z - e)) / (2 * e), gs = Math.hypot(gx, gz);
      if (gs > SLOPE_MAX * 1.15) { const k = Math.min(6, (gs - SLOPE_MAX) * 8) * dt; r = resolve(r.x - gx / gs * k, r.z - gz / gs * k, 0.45); if (!S.slideMsg || S.time - S.slideMsg > 4) { S.slideMsg = S.time; msgOnce('slope', 'Íngreme demais para subir.'); } }
    }
  }
  if (S.lunge && S.time - S.lunge.t < 0.2) { const k = S.lunge.d / 0.2 * dt, q = resolve(r.x + Math.sin(P.yaw) * k, r.z + Math.cos(P.yaw) * k, 0.45); r = q; } // avanço do golpe pesado
  P.x = r.x; P.z = r.z;
  const coast = !mi.any ? Math.hypot(S.vel.x, S.vel.z) : 0;
  let gy = groundAt(P.x, P.z); if (inLake) gy = Math.max(gy, LAKE.level - 0.6); // na água: afundado até a cintura
  const pad = padUnder(P.x, P.z, P.y); S.onPad = pad && P.ground ? pad : null;
  if (pad) gy = Math.max(gy, pad.mesh.position.y + 0.1); // S-199: pés em cima da folha, não dentro da água
  if (P.ground && gy < P.y - 0.3) { P.ground = false; P.vy = 0; } // saiu da beirada (ex.: da folha): cai
  if (P.ground) { P.y = gy; S.fallTop = null; }
  else {
    S.fallTop = Math.max(S.fallTop ?? P.y, P.y); // ponto mais alto do salto/queda
    P.vy -= 22 * dt; P.y += P.vy * dt;
    if (P.y <= gy) { P.y = gy; P.ground = true; if (!S.riding) { me.anim.play('Jump_Land', { once: true, restart: true, fade: 0.05 }); S.lockAnim = t + 0.25; } fallDamage((S.fallTop ?? gy) - gy, inLake); S.fallTop = null; }
  }
  me.obj.position.set(P.x, P.y, P.z);
  if (S.riding) { // montado: o bicho anda, você vai sentado na sela
    const R = S.riding, spd = Math.hypot(S.vel.x, S.vel.z);
    R.obj.position.set(P.x, P.y, P.z); R.obj.rotation.y = P.yaw;
    let dy = P.yaw - (R.lastYaw ?? P.yaw); while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; R.lastYaw = P.yaw;
    R.turn = (R.turn || 0) + ((dt > 0 ? dy / dt : 0) - (R.turn || 0)) * Math.min(1, dt * 6);
    R.animate(t, { speed: spd / (base / MOUNT_SPEED * 1.2), turn: Math.max(-4, Math.min(4, R.turn)), air: !P.ground, vy: P.vy }, dt);
    me.obj.position.y = P.y + R.saddleY + R.bodyY - 0.52;
  }
  // de frente para o alvo quando parado atacando
  if (S.autoAttack && S.target && !mi.any && !mi.turn && !mouse.right) P.yaw = angLerp(P.yaw, Math.atan2(S.target.x - P.x, S.target.z - P.z), Math.min(1, dt * 8));
  // S-151: o corpo gira para o lado em que anda (andar de lado vira corrida na diagonal; para trás, passos de ré de verdade)
  { const moving = mi.any && !S.riding && P.ground && !isAction() && !S.fire; const want = moving ? (mi.fwd > 0 ? mi.strafe * -0.6 : mi.fwd < 0 ? mi.strafe * 0.5 : mi.strafe * -Math.PI / 2) : 0; S.bodyTwist = angLerp(S.bodyTwist || 0, want, Math.min(1, dt * 10)); }
  me.obj.rotation.y = P.yaw + (S.bodyTwist || 0);
  if (S.riding) riderPose(me, S.riding, { t, gait: Math.min(1, Math.hypot(S.vel.x, S.vel.z) / 6) }); // S-242: sentado de verdade na sela
  // animação
  if (S.casting) { if (me.anim.name !== 'Spellcasting') me.anim.play('Spellcasting'); }
  else if (S.riding && t >= S.lockAnim) me.anim.play('Sit_Chair_Idle', { fade: 0.2 }); // montado: sempre sentado na sela (também no pulo)
  else if (t < S.lockAnim) { /* golpe / levar dano em andamento */ }
  else if (!P.ground) { if (me.anim.name !== 'Jump_Start') me.anim.play('Jump_Idle'); }
  else if (S.sitting) { if (me.anim.name !== 'Sit_Floor_Idle' && me.anim.name !== 'Sit_Floor_Down') { me.anim.play('Sit_Floor_Down', { once: true }); later(0.9, () => { if (S.sitting) me.anim.play('Sit_Floor_Idle'); }); } }
  else if (mi.fwd > 0) me.anim.play('Running_A', { speed: S.god ? 1.9 : 1 });
  else if (mi.fwd < 0) me.anim.play('Walking_Backwards', { speed: -1.05 }); // a caminhada tocada ao contrário = passos para trás
  else if (mi.strafe) me.anim.play('Running_A'); // de lado: o corpo vira para a direção (bodyTwist) e corre
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
      if (d > Math.max(range * 2.5, range + 12)) { // longe demais: sai do modo de combate (como no WoW)
        S.autoAttack = false; log('Você se afastou do alvo e saiu do combate.', 'sys');
        if (d > 40) { S.target = null; hudDirty = true; }
      }
      else if (d > range) msgOnce('range', 'Alvo fora de alcance.');
      else if (!facing) msgOnce('face', 'Você precisa estar de frente para o alvo.');
      else { S.nextAttack = t + p.d.aspd / 1000; playerAttack(m); }
    }
  }
  // zona
  // zona (com margem: na divisa entre duas regiões não fica trocando de música sem parar)
  if (S.interior) return;
  let zn = zoneAt(P.x, P.z);
  if (S.zone && zn !== S.zone) {
    const nd = q => Math.hypot(P.x - q.x, P.z - q.z) / q.r;
    if (nd(zn) > nd(S.zone) - 0.08) zn = S.zone;
  }
  if (zn !== S.zone) {
    S.zone = zn; banner(zn.name, zn.lvl); Sound.playSong(zn.music);
    $('mapname').innerHTML = `${zn.name} <small>${zn.lvl}</small>`;
    if (zn.safe) log('Você está em uma área segura.', 'sys');
  }
}
function playerAttack(m) {
  if (S.riding && !S.riding.war) dismount(true); // na Montaria de Guerra dá para lutar montado
  const p = S.p, me = S.me, st = me.look.style;
  const ca = attackAnim(p, me);
  S.lockAnim = S.overlayAtk ? S.time : S.time + Math.min(0.55, p.d.aspd / 1000 * 0.7);
  S.sitting = false;
  const hit = () => {
    if (m.dead) return;
    hurtMonster(m, rollPhys(p, m, 1, 'neutro')); if (!p.d.ranged) Sound.play('impact');
    if (p.d.doubleAttack && !p.d.ranged && Math.random() * 100 < p.d.doubleAttack) later(0.15, () => { if (!m.dead) hurtMonster(m, rollPhys(p, m, 1, 'neutro')); });
  };
  if (p.d.magicAuto) { // projétil arcano do cajado
    me.anim.play('Spellcast_Shoot', { once: true, restart: true, fade: 0.08, speed: Math.max(1, 900 / p.d.aspd) });
    Sound.play('magic');
    later(0.3, () => shoot(me.obj.position.clone().add(new THREE.Vector3(0, 1.1, 0)), () => m.obj.position.clone().add(new THREE.Vector3(0, m.height * 0.6, 0)), '#9fb8ff', () => { if (!m.dead) hurtMonster(m, rollMagic(p, m, 0.85, 'neutro'), 'neutro'); }, false));
  }
  else if (p.d.ranged) { Sound.play(ca.sound === 'magic' ? 'magic' : 'bow'); later(0.25, () => shoot(me.obj.position.clone().add(new THREE.Vector3(0, 1.3, 0)), () => m.obj.position.clone().add(new THREE.Vector3(0, m.height * 0.6, 0)), '#e8e0c8', hit, true)); }
  else { Sound.play(ca.sound || 'swing'); later(0.28, hit); }
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
      S.interior = null; S.zone = null; dismount(true);
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
  m.obj.position.set(S.pet.x, groundAt(S.pet.x, S.pet.z), S.pet.z);
  scene.add(m.obj);
}
function petStats() { // garante hp/sta no save do mascote (saves antigos não têm)
  const data = S.p.pet, pw = petPower(data);
  if (typeof data.hp !== 'number' || data.hp > pw.maxHp) data.hp = Math.min(pw.maxHp, typeof data.hp === 'number' ? data.hp : pw.maxHp);
  if (typeof data.sta !== 'number') data.sta = pw.maxSta; data.sta = Math.min(pw.maxSta, data.sta);
  return pw;
}
// monstro acerta o mascote (quando ele está brigando de perto)
function petHurt(m, raw) {
  const pe = S.pet, data = S.p.pet; if (!pe || !data || pe.down) return;
  const pw = petStats(), dmg = Math.max(1, Math.round(raw * 100 / (100 + pw.def)));
  if (S.god) { floatAt(pe.obj.position, `-${dmg} (imune)`, '#ffd76a', pe.height + 0.6); return; }
  data.hp -= dmg; floatAt(pe.obj.position, '-' + dmg, '#ff9a6a', pe.height + 0.6); Sound.play('hit');
  if (data.hp <= 0) { data.hp = 0; pe.down = S.time + 25; log(`🐾 ${petInfo(data).name} desmaiou! Ele se recupera em alguns segundos.`, 'warn'); }
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
  // S-114: vida e stamina do mascote
  const stats = petStats(); pe.hpRegenT = (pe.hpRegenT || 0) + dt;
  if (pe.hpRegenT >= 1) { pe.hpRegenT = 0; if (!pe.down) data.hp = Math.min(pw.maxHp, data.hp + Math.max(1, Math.round(pw.maxHp * (tgt ? 0.004 : S.sitting ? 0.03 : 0.015)))); }
  data.sta = Math.min(pw.maxSta, data.sta + dt * (tgt ? 3 : pe.moving ? 6 : 14)); // em combate recupera devagar
  if (pe.down) { // desmaiado: fica deitado descansando e só volta com um pouco de vida
    data.hp = Math.min(pw.maxHp, data.hp + pw.maxHp * 0.02 * dt);
    if (t >= pe.down) { pe.down = 0; log(`🐾 ${petInfo(data).name} se levantou!`); }
    if (Math.hypot(P.x - pe.x, P.z - pe.z) > 30) { pe.x = P.x - 1.5; pe.z = P.z - 1.5; }
    pe.obj.position.set(pe.x, groundAt(pe.x, pe.z), pe.z); pe.obj.rotation.set(0, pe.yaw, Math.PI / 2 * 0.85, 'YXZ');
    pe.animate(t, { speed: 0, turn: 0 }, dt); return;
  }
  const tired = data.sta < 15, useSta = c => { if (data.sta < c) return false; data.sta -= c; return true; };
  if (role === 'ataque' && tgt) { // S-113: ataque padrão corpo a corpo — corre até o alvo e dá botes como um lobo
    const d = Math.hypot(tgt.x - pe.x, tgt.z - pe.z), reach = 0.9 + tgt.radius;
    goal = d > reach ? { x: tgt.x - (tgt.x - pe.x) / d * (reach - 0.2), z: tgt.z - (tgt.z - pe.z) / d * (reach - 0.2) } : null; stopAt = 0.25; face = tgt;
    if (d < reach + 0.5 && t >= pe.next && useSta(8)) {
      pe.next = t + (1.6 - pe.stage * 0.25);
      if (pe.attack) pe.attack(); Sound.play(MON_SFX.wolf.attack);
      later(0.18, () => { if (!tgt.dead && S.pet === pe) { petHit(tgt); tgt.petHits = S.time; } });
    }
    // habilidade (a partir da Labareda): cuspe de brasa de longe, de tempos em tempos
    if (pe.stage >= 1 && d < 9 && t >= (pe.spitNext || 0) && useSta(20)) {
      pe.spitNext = t + 8;
      const from = pe.obj.position.clone().add(new THREE.Vector3(0, pe.height * 0.7, 0));
      shoot(from, () => tgt.obj.position.clone().add(new THREE.Vector3(0, tgt.height * 0.5, 0)), '#ff8a3d', () => {
        if (tgt.dead) return;
        petHit(tgt, 1.2);
        if (pe.stage === 2) { ring({ x: tgt.x, y: tgt.obj.position.y, z: tgt.z }, 2.6, '#ffb04a'); S.monsters.filter(o => o !== tgt && !o.dead && Math.hypot(o.x - tgt.x, o.z - tgt.z) < 2.6).forEach(o => petHit(o, 0.5)); }
      });
      Sound.play('fire');
    }
  } else if (role === 'guardiao' && tgt) { // vai até o alvo e dá pancadas que atordoam
    const d = Math.hypot(tgt.x - pe.x, tgt.z - pe.z);
    goal = d > 1.6 + tgt.radius ? { x: tgt.x, z: tgt.z } : null; stopAt = 1.4 + tgt.radius; face = tgt;
    if (d < 2.4 + tgt.radius && t >= pe.next && useSta(25)) {
      pe.next = t + 6; petHit(tgt, 0.7); tgt.petHits = t; if (pe.attack) pe.attack();
      tgt.status.stun = t + 1 + pe.stage * 0.5; floatAt(tgt.obj.position, 'Atordoado!', '#e8c890', tgt.height + 0.9);
      ring({ x: tgt.x, y: tgt.obj.position.y, z: tgt.z }, 1.5, '#c9a15a'); Sound.play('quake');
    }
  } else if (role === 'suporte') { // cura e escudo de água
    const p = S.p;
    if (t >= pe.next && p.hp < p.d.maxHp * 0.9 && useSta(15)) {
      pe.next = t + 6; if (pe.attack) pe.attack(); const v = Math.round(p.d.maxHp * pw.heal + data.lv * 2);
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
  const maxSp = S.p.d.speed / 32 * TM * 1.25 * pw.speedMult * (tired ? 0.6 : 1); // cansado (pouca stamina), anda mais devagar
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
  const slope = Math.atan2(groundAt(pe.x + fx, pe.z + fz) - groundAt(pe.x - fx, pe.z - fz), 0.6);
  pe.pitch = (pe.pitch || 0) + (-slope - (pe.pitch || 0)) * (1 - Math.exp(-dt * 8));
  pe.obj.position.set(pe.x, !S.interior && lakeDist(pe.x, pe.z) < LAKE.r - 0.5 ? Math.max(heightAt(pe.x, pe.z), LAKE.level - 0.3) : groundAt(pe.x, pe.z), pe.z); // na água o mascote nada na superfície
  pe.obj.rotation.set(pe.pitch, pe.yaw, 0, 'YXZ');
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
// subir de nível (S-084): asas douradas que se abrem e batem, coluna de luz, círculo de runas no chão,
// partículas subindo em espiral, auréola e fanfarra. Dura ~3 s.
const LV = {};
function lvAssets() {
  if (LV.feather) return LV;
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.09, 0.25, 0.035, 0.62); sh.quadraticCurveTo(0, 0.7, -0.03, 0.6); sh.quadraticCurveTo(-0.06, 0.25, 0, 0);
  LV.feather = new THREE.ShapeGeometry(sh, 10);
  LV.featherMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#ffcf5a', emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 1, roughness: 0.35, metalness: 0.2 });
  const tex = (draw, w = 256, h = 256) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  LV.beamTex = tex((g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,230,140,0)'); gr.addColorStop(0.06, 'rgba(255,230,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,215,106,0.35)'); gr.addColorStop(1, 'rgba(255,215,106,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 8, 128);
  LV.dotTex = tex((g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,230,150,0.8)'); gr.addColorStop(1, 'rgba(255,215,106,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, 64, 64);
  LV.runeTex = tex((g, w) => { g.translate(w / 2, w / 2); g.strokeStyle = '#ffe9a8'; g.lineWidth = 4; for (const r of [118, 100, 60]) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); } g.font = 'bold 22px serif'; g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.textBaseline = 'middle'; const runes = 'ᚨᛖᛏᚺᚱᚨᛉᛟᚾᛁᛋᛞ'; for (let k = 0; k < 12; k++) { g.save(); g.rotate(k / 12 * Math.PI * 2); g.fillText(runes[k], 0, -109); g.restore(); } for (let k = 0; k < 6; k++) { g.save(); g.rotate(k / 6 * Math.PI * 2); g.beginPath(); g.moveTo(0, -60); g.lineTo(0, -100); g.stroke(); g.restore(); } g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2 * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); } g.stroke(); });
  return LV;
}
function makeWing(side) {
  const A = lvAssets(), wing = new THREE.Group(), rows = [[9, 1.0, 0], [8, 0.72, 0.08], [9, 0.45, 0.16]]; // primárias, secundárias, coberteiras
  for (const [n, len, off] of rows) for (let k = 0; k < n; k++) {
    const u = k / (n - 1), f = new THREE.Mesh(A.feather, A.featherMat);
    const a = -0.25 + u * 1.45; // leque do topo para fora
    f.scale.set(1.15, len * (1.25 - u * 0.35), 1);
    f.position.set(side * (0.08 + u * 0.55 * (1 - off)), 0.1 + u * 0.32 - off * 0.6, -off * 0.05 - k * 0.002);
    f.rotation.set(0, 0, side * -(Math.PI / 2 - a)); wing.add(f);
  }
  return wing;
}
function levelFx() {
  Sound.play('levelup');
  if (!S.me) return;
  const A = lvAssets(), me = S.me.obj, root = new THREE.Group(); me.add(root);
  const add = o => { root.add(o); return o; };
  // asas nas costas
  const wings = [-1, 1].map(sd => { const w = add(makeWing(sd)); w.position.set(sd * 0.1, 1.0, -0.28); w.traverse(o => { o.renderOrder = 5; }); return w; });
  // coluna de luz e círculo de runas
  const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 7, 32, 1, true), new THREE.MeshBasicMaterial({ map: A.beamTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
  beam.position.y = 3.5;
  const beam2 = add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 24, 1, true), beam.material.clone())); beam2.position.y = 4.5;
  const rune = add(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: A.runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd76a' })));
  rune.rotation.x = -Math.PI / 2; rune.position.y = 0.06;
  const halo = add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 10, 40), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, blending: THREE.AdditiveBlending })));
  halo.rotation.x = Math.PI / 2; halo.position.y = 1.85;
  // partículas douradas subindo em espiral
  const N = 90, pos = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => [Math.random() * 6.28, Math.random(), 0.3 + Math.random() * 0.8]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = add(new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffe9a8', size: 0.16, map: A.dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const L = vlight('#ffd76a', 3, 10); L.position.y = 1.5; root.add(L);
  floatAt(me.position, '✨ LEVEL UP!', '#ffe36a', 2.6);
  S.fx.push({ obj: root, t0: S.time, dur: 3.2, parent: me, update: k => {
    const open = Math.min(1, k / 0.12), fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    wings.forEach((w, i) => { const sd = i ? 1 : -1, flap = Math.sin(Math.max(0, k - 0.12) * Math.PI * 2 * 3.2) * 0.35 * (k < 0.75 ? 1 : fade);
      w.rotation.y = sd * (-1.3 * (1 - open) + 0.35 + flap); w.scale.setScalar(0.4 + open * 0.75 + (1 - fade) * 0.3); w.position.y = 1.0 + (1 - fade) * 0.6; });
    A.featherMat.opacity = fade; A.featherMat.emissiveIntensity = 0.7 + Math.sin(k * 30) * 0.2;
    beam.material.opacity = Math.min(1, k * 6) * fade * 0.38; beam2.material.opacity = Math.min(1, k * 4) * fade * 0.3; beam.scale.set(1 + k * 0.3, 1, 1 + k * 0.3);
    rune.rotation.z = k * 3; rune.scale.setScalar(0.4 + Math.min(1, k * 4) * 0.7); rune.material.opacity = fade;
    halo.material.opacity = fade; halo.position.y = 1.85 + Math.sin(k * 12) * 0.03;
    for (let n = 0; n < N; n++) { const [a, ph, sp] = seeds[n], q = (k * 1.6 * sp + ph) % 1, r = 0.4 + q * 0.5; pos[n * 3] = Math.cos(a + q * 7) * r; pos[n * 3 + 1] = q * 3.4; pos[n * 3 + 2] = Math.sin(a + q * 7) * r; }
    pg.attributes.position.needsUpdate = true; pts.material.opacity = fade;
    L.intensity = 3 * fade;
  } });
  if (!moveInput().any) { S.me.anim.play('Cheer', { once: true, restart: true }); S.lockAnim = S.time + 1.2; }
}

/* =========================== Habilidades =========================== */
function trySkill(id) {
  if (S.riding) dismount(true);
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
  if (eff.kind === 'warmount') { // S-203
    if (S.riding && S.riding.war) { dismount(); log('Trotavento dispensado.'); return; }
    if (S.interior) { log('Aqui dentro não dá para montar.', 'warn'); return; }
    if (S.riding) dismount(true);
    const R = makeMount('trotavento'); R.war = true; R.obj.position.set(S.pos.x, S.pos.y, S.pos.z); R.obj.rotation.y = S.pos.yaw; scene.add(R.obj);
    S.riding = R; S.sitting = false; ring(S.pos, 2, '#ffcf5a'); Sound.play('portal'); log('🐦 Montaria de Guerra: você monta no seu Trotavento e pode lutar montado.', 'lvl'); return;
  }
  if (eff.kind === 'heal') { const v = eff.amount(lv, p); p.hp = Math.min(p.d.maxHp, p.hp + v); floatAt(me.obj.position, '+' + v, '#5fe08a', 2.2); ring(me.obj.position, 1.6, '#7dff9a'); Sound.play('heal'); return; }
  if (eff.kind === 'buff') { p.buffs[a.id] = { until: S.time + eff.dur / 1000, bonuses: eff.bonuses(lv) }; recalc(p); ring(me.obj.position, 1.8, sk.fxColor || '#ffd76a'); Sound.play('buff'); log(`${sk.name} ativada!`); return; }
  if (eff.kind === 'steal') {
    const m = a.m;
    if (m.stolen) floatAt(m.obj.position, 'Nada', '#cfd6e0', m.height + 0.4);
    else if (Math.random() < eff.chance(lv) + (p.d.dex - m.def.lv) / 300) { const [id] = m.def.drops[Math.floor(Math.random() * m.def.drops.length)]; m.stolen = true; addItem(p, id, 1); Sound.play('coin'); floatAt(m.obj.position, 'Roubou!', '#ffd84a', m.height + 0.4); log(`Você roubou ${ITEMS[id].name}!`, 'item'); }
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
    for (let i = 0; i < hits; i++) later(0.15 + i * 0.25, () => { ring({ x: center.x, y: groundAt(center.x, center.z), z: center.z }, R, col); inRadius(center, R).forEach(hitOne); });
    Sound.play(el === 'fogo' ? 'fire' : el === 'vento' ? 'zap' : el === 'terra' ? 'quake' : el === 'sagrado' ? 'holy' : 'swing');
  } else if (eff.splash) {
    const m = a.m;
    shoot(from(), to(m), col, () => { ring({ x: m.x, y: groundAt(m.x, m.z), z: m.z }, eff.splash * TM, col); inRadius({ x: m.x, z: m.z }, eff.splash * TM).forEach(hitOne); Sound.play('fire'); }, true);
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
// morte rara: o monstro vira faíscas de luz que sobem
function soulBurst(m) {
  const c = new THREE.Color(ELEMENTS[m.def.element] ? ELEMENTS[m.def.element].color : '#fff2c0').lerp(new THREE.Color('#ffffff'), 0.4);
  const p0 = m.obj.position.clone().add(new THREE.Vector3(0, (m.height || 1) * 0.5, 0));
  const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = new THREE.SphereGeometry(0.06, 6, 4);
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Mesh(geo, mat.clone()), a = Math.random() * Math.PI * 2, up = 1.2 + Math.random() * 2, out = 0.6 + Math.random() * 1.4;
    s.position.copy(p0); scene.add(s);
    S.fx.push({ obj: s, t0: S.time, dur: 1.1 + Math.random() * 0.5, update: k => { s.position.set(p0.x + Math.cos(a) * out * k, p0.y + up * k - k * k * 0.6, p0.z + Math.sin(a) * out * k); s.material.opacity = 1 - k; s.scale.setScalar(1.4 - k); } });
  }
  ring({ x: m.x, y: m.obj.position.y, z: m.z }, 2, '#' + c.getHexString()); Sound.play('holy');
}
function ring(pos, r, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(pos.x, (pos.y ?? groundAt(pos.x, pos.z)) + 0.08, pos.z); scene.add(m);
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
  for (const e of [...S.monsters, ...S.npcs, ...(S.arena ? S.arena.rivals.values() : [])]) {
    if (e.dead && !e.isNpc) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    // nomes só de perto: monstros até 13 m (ou o alvo / quem está brigando com você), NPCs até 24 m
    if (!e.isNpc && !e.dead && e.type && d < 22 && e.obj.visible && !(S.p.seen || (S.p.seen = [])).includes(e.type) && MONSTERS[e.type]) { S.p.seen.push(e.type); log(`📖 Nova criatura no Bestiário: ${e.def.name}!`, 'lvl'); Sound.play('card'); if (UI.wins.bestiario) UI.render_bestiario(); } // S-171: pokédex
    const qm = e.isNpc ? questMarker(S.p, e.id) : ''; // S-126: "!" / "?" de missão, visível de mais longe (como no WoW)
    const near = e.isNpc ? (qm && qm !== '…' ? 45 : 24) : 13, fight = (e === S.target || (!e.isNpc && e.aggro && !e.def.dummy)) && d < 20; // nem em combate aparece de longe (S-096, S-116: no máximo 20 m)
    if ((d > near && !fight) || (e.obj && !e.obj.visible)) continue;
    const s = toScreen(tmpV.set(e.x, (e.obj.position.y) + e.height + 0.45, e.z));
    if (!s.vis) continue;
    let el = plateEls.get(e);
    if (!el) { el = document.createElement('div'); el.className = 'plate3d'; $('plates').appendChild(el); plateEls.set(e, el); }
    const hostile = !e.isNpc && (e.def.aggressive || e.aggro);
    const color = e.isNpc ? '#7dff9a' : hostile ? '#ff6a6a' : '#ffe36a';
    const hp = e.isNpc ? '' : (e.hp < e.maxHp || e === S.target) ? `<div class="pbar"><div style="width:${e.hp / e.maxHp * 100}%"></div></div>` : '';
    const key = `${e.isNpc ? e.name : e.def.name}|${color}|${hp}|${e === S.target}|${qm}`;
    if (el._k !== key) { el._k = key; el.innerHTML = `${qm ? `<div class="qmark ${qm === '?' ? 'ready' : qm === '…' ? 'wait' : ''}">${qm === '…' ? '?' : qm}</div>` : ''}<span style="color:${color}">${escH(e.isNpc ? e.name : e.def.name)}</span>${e.isNpc ? `<small>&lt;${escH(e.title)}&gt;</small>` : ''}${hp}`; el.classList.toggle('sel', e === S.target); }
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    el.style.opacity = fight ? 1 : Math.max(0, Math.min(1, (near - d) / 3)); // aparece suavemente ao se aproximar
    shown.add(e);
  }
  if (S.pet && S.p.pet) {
    const pe = S.pet, s = toScreen(tmpV.set(pe.x, pe.obj.position.y + pe.height + 0.35, pe.z));
    let el = plateEls.get(pe);
    if (!el) { el = document.createElement('div'); el.className = 'plate3d'; $('plates').appendChild(el); plateEls.set(pe, el); }
    const info = petInfo(S.p.pet), pw = petStats(), hpP = Math.round(S.p.pet.hp / pw.maxHp * 100), stP = Math.round(S.p.pet.sta / pw.maxSta * 100), key = info.name + S.p.pet.lv + '|' + hpP + '|' + stP + '|' + !!pe.down;
    if (el._k !== key) { el._k = key; el.innerHTML = `<span style="color:#9ff0ff">${info.icon} ${escH(info.name)}</span><small>Nv. ${S.p.pet.lv}${pe.down ? ' · 💤 desmaiado' : ''}</small><div class="pbar pet"><div style="width:${hpP}%"></div></div><div class="pbar sta"><div style="width:${stP}%"></div></div>`; }
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
  const cands = (S.arena ? [...S.arena.rivals.values()] : S.monsters).filter(m => !m.dead && Math.hypot(m.x - P.x, m.z - P.z) < 40)
    .map(m => { const a = Math.atan2(m.x - P.x, m.z - P.z) - S.cam.yaw; return { m, d: Math.hypot(m.x - P.x, m.z - P.z), front: Math.cos(a) }; })
    .filter(c => c.front > 0.2).sort((a, b) => a.d - b.d);
  if (!cands.length) return msgOnce('tab', S.arena ? 'Nenhum adversário à frente.' : 'Nenhum inimigo à frente.');
  const i = cands.findIndex(c => c.m === S.target);
  setTarget(cands[(i + 1) % cands.length].m);
}
function interact(e, attack) {
  if (!e) return;
  setTarget(e);
  if (e.isNpc) {
    if (Math.hypot(e.x - S.pos.x, e.z - S.pos.z) > 5) return log('Chegue mais perto para conversar.', 'warn');
    talk(e);
  } else if (attack && !e.dead) { S.autoAttack = true; S.pos.yaw = Math.atan2(e.x - S.pos.x, e.z - S.pos.z); S.nextAttack = Math.min(S.nextAttack, S.time); } // clique (esquerdo ou direito) num monstro: vira para ele e ataca
}

/* =========================== Diálogos (janela compartilhada com o 2D) =========================== */
function talk(n) {
  const p = S.p, bye = { label: 'Até logo.', fn: () => UI.close('dialog') };
  n.anim.play('Interact', { once: true, restart: true }); later(1.2, () => n.anim.play('Idle'));
  if (n.grifo) return flightDialog(n);
  // S-126: missões primeiro (aceitar, entregar, acompanhar); "Conversar" leva às falas normais do NPC
  if (!n._qskip) {
    const qo = questDialog(p, n, gainExp, () => talk(n));
    if (qo.length) { hudDirty = true; return UI.dialog(n, n.questHello || (n.id === 'teodoro' ? 'Ah, que bom te ver. Alvorada precisa de gente como você.' : 'Olá, aventureiro! Tenho algo para você.'), [...qo, { label: '💬 Conversar', fn: () => { n._qskip = true; talk(n); n._qskip = false; } }, bye]); }
  }
  // S-124: refinador (cidade dos anões)
  if (n.refine) return UI.dialog(n, n.hello || 'O aço só mostra o que vale depois de apanhar do martelo. Quer arriscar?', [{ label: '⚒️ Refinar equipamento', gold: true, fn: () => { UI.close('dialog'); UI.open('refino'); } }, { label: '🛒 Comprar Ferrolume e Pedra-Égide', fn: () => { UI.close('dialog'); UI.close('shop'); UI.shopList = ['ferrolume', 'pedra_egide']; UI.shopTitle = '⚒️ Materiais de refino'; UI.open('shop'); } }, bye]);
  if (n.heals) { p.hp = p.d.maxHp; p.sp = p.d.maxSp; Sound.play('heal'); ring(S.me.obj.position, 1.6, '#7dff9a'); return UI.dialog(n, 'Descanse um pouco, viajante. Pronto: feridas fechadas e o fôlego de volta.', [bye]); }
  if (n.shopList) return UI.dialog(n, n.hello, [{ label: '🛒 Ver mercadorias', gold: true, fn: () => { UI.close('dialog'); UI.close('shop'); UI.shopList = n.shopList === 'geral' ? null : n.shopList; UI.shopTitle = n.shopTitle; UI.open('shop'); } }, bye]);
  if (n.lines) return UI.dialog(n, n.lines, [bye]);
  if (n.id === 'clara') { p.hp = p.d.maxHp; p.sp = p.d.maxSp; Sound.play('heal'); ring(S.me.obj.position, 1.6, '#7dff9a'); UI.dialog(n, 'Que a luz te guarde, viajante. Suas feridas estão curadas.\nVolte sempre que precisar.', [bye]); }
  else if (n.id === 'bento') UI.dialog(n, 'Bem-vindo, bem-vindo! Poções fresquinhas, armas para toda classe... e compro qualquer tralha que você trouxer dos campos!', [{ label: '🛒 Ver mercadorias', gold: true, fn: () => { UI.close('dialog'); UI.close('shop'); UI.shopList = null; UI.shopTitle = null; UI.open('shop'); } }, bye]);
  else if (n.id === 'flora') UI.dialog(n, 'Olha a fruta fresquinha! Maçã, laranja, pera, uva, banana e melancia, tudo colhido hoje cedo nos Campos de Verdelume. Cada uma recupera um pouquinho de vida ou de fôlego!', [{ label: '🍎 Ver as frutas', gold: true, fn: () => { UI.close('dialog'); UI.close('shop'); UI.shopList = FRUIT_SHOP; UI.shopTitle = '🍎 Barraca da Dona Flora'; UI.open('shop'); } }, bye]);
  else if (n.id === 'tome') {
    const cur = p.mount && MOUNTS[p.mount.kind];
    const opts = Object.entries(MOUNTS).filter(([k, m]) => !m.premium).map(([k, m]) => ({ label: `${p.mount && p.mount.kind === k ? '✔ ' : '🐎 '}${m.name} <span class="muted">— ${m.desc}</span>`, gold: !p.mount, fn: () => {
      p.mount = { kind: k }; UI.close('dialog'); Sound.play('levelup'); banner('Nova montaria!', m.name);
      log(`🐎 ${m.name} agora é seu! Aperte M lá fora para montar e andar bem mais rápido.`, 'sys'); save3d();
    } }));
    UI.dialog(n, cur ? `E aí, como vai o ${cur.name}? Se quiser trocar de bicho, é só escolher.\n<span class="muted">Lá fora, aperte <b>M</b> para montar ou desmontar.</span>` : 'Opa! Andar a pé por esses campos cansa, né? Escolha um dos meus corcéis — é por conta da casa para quem está começando.\n<span class="muted">Lá fora, aperte <b>M</b> para montar ou desmontar.</span>', [...opts, bye]);
  }
  else if (n.id === 'rosa') UI.dialog(n, 'Seja bem-vindo à Caneca Alegre! Senta, descansa... Quer um suco de frutinhas? Recupera o fôlego.', [{ label: '🍹 Suco de frutinhas (10 z) — recupera todo o SP', gold: true, fn: () => {
      if (p.zeny < 10) { log('Zeny insuficiente.', 'warn'); Sound.play('error'); return; }
      p.zeny -= 10; p.sp = p.d.maxSp; Sound.play('heal'); hudDirty = true; UI.close('dialog'); log('🍹 Delícia! SP recuperado.', 'item');
    } }, bye]);
  else if (n.id === 'gui') UI.dialog(n, 'Dizem que nas Ruínas de Kael dorme um Guardião Ancestral, feito de raiz e pedra...\nQuem o derrota leva uma carta que faz o coração bater mais forte. Mas cuidado: ele bate o chão e tudo treme!', [bye]);
  else if (n.id === 'bravo') UI.dialog(n, 'Quer testar sua força contra outros aventureiros? Na Arena de Aethra vale tudo: golpes, magias e até o seu mascote!\n<span class="muted">Ninguém perde EXP nem itens lá dentro. Derrotado, você volta em 5 segundos. Para sair, use o portal dourado.</span>', [{ label: '⚔️ Entrar na Arena (PvP)', gold: true, fn: () => { UI.close('dialog'); enterArena(); } }, bye]);
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
  if (en && CLASSES[cls].weapons.includes(ITEMS[gift].wtype) && (ITEMS[gift].lv || 1) <= p.baseLv) { const i = p.inventory.indexOf(en); p.inventory.splice(i, 1); if (p.equip.arma) p.inventory.push(p.equip.arma); p.equip.arma = en; if (TWO_HANDED.includes(ITEMS[gift].wtype) && p.equip.escudo) { p.inventory.push(p.equip.escudo); p.equip.escudo = null; } }
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
    $('tg-hptxt').textContent = t.isNpc ? '' : t.def.dummy ? '∞ (boneco de treino)' : `${Math.max(0, Math.round(t.hp))} / ${t.maxHp}`;
    tf.querySelector('.bar').style.display = t.isNpc ? 'none' : ''; // NPC não tem barra de vida (S-083)
    if (t.def && t.def.dummy) { const w = (t.dps || []).filter(e => S.time - e[0] < 5); t.dps = w; const dps = w.length ? Math.round(w.reduce((a, e) => a + e[1], 0) / Math.max(1, Math.min(5, S.time - w[0][0] + 0.5))) : 0; $('tg-info').textContent = `⚔️ DPS ${dps} · dano total ${(t.total || 0).toLocaleString('pt-BR')}`; tf.classList.toggle('hostile', false); }
    else $('tg-info').textContent = t.isNpc ? '💬 Clique com o botão direito para conversar' : `${ELEMENTS[t.def.element].name}${t.def.aggressive ? ' • Agressivo' : ' • Passivo'}${S.autoAttack ? ' • ⚔️ atacando' : ''}`;
    tf.classList.toggle('hostile', !t.isNpc);
  } else tf.classList.add('hidden');
  const pl = $('st-pet');
  if (pl) {
    if (S.p.pet) { const info = petInfo(S.p.pet), pct = S.p.pet.lv >= PET_MAX_LV ? 100 : S.p.pet.exp / petExpNext(S.p.pet.lv) * 100; const pw = petStats(), hk = `${info.name}|${S.p.pet.lv}|${Math.round(pct)}|${Math.round(S.p.pet.hp)}|${Math.round(S.p.pet.sta)}`; if (pl._k !== hk) { pl._k = hk; pl.innerHTML = `<span>${info.icon} ${escH(info.name)} <b>Nv. ${S.p.pet.lv}</b></span><div class="pet-bar hp" title="Vida do mascote"><div style="width:${S.p.pet.hp / pw.maxHp * 100}%"></div><i>${Math.round(S.p.pet.hp)}/${pw.maxHp}</i></div><div class="pet-bar sta" title="Stamina do mascote (correr e atacar cansam)"><div style="width:${S.p.pet.sta / pw.maxSta * 100}%"></div><i>Stamina ${Math.round(S.p.pet.sta)}</i></div><div class="pet-xp"><div style="width:${pct}%"></div></div>`; } pl.style.display = ''; }
    else pl.style.display = 'none';
  }
  if (S.casting) $('castbar3d').querySelector('.fill').style.width = ((S.time - S.casting.start) / (S.casting.end - S.casting.start) * 100) + '%';
  if (hudDirty) { UI.markDirty(); hudDirty = false; }
  if (UI.dirty) UI.refreshOpen();
}
/* =========================== Mapa-múndi pintado (minimapa e Painel do Mestre) =========================== */
const WM = 640; // resolução do mapa pintado (cobre o mundo todo: -HALF..HALF)
const worldMap = document.createElement('canvas'); worldMap.width = worldMap.height = WM;
const w2m = v => (v / HALF + 1) / 2 * WM; // metros -> pixel do mapa pintado
const mmBase = worldMap; // compatibilidade
function buildMinimap() {
  const g = worldMap.getContext('2d'), img = g.createImageData(WM, WM), step = HALF * 2 / WM;
  // relevo com sombreado (luz vinda do noroeste) e cores do chão
  const H = new Float32Array((WM + 1) * (WM + 1));
  for (let j = 0; j <= WM; j++) for (let i = 0; i <= WM; i++) H[j * (WM + 1) + i] = heightAt(-HALF + i * step, -HALF + j * step);
  for (let j = 0; j < WM; j++) for (let i = 0; i < WM; i++) {
    const x = -HALF + i * step, z = -HALF + j * step, h = H[j * (WM + 1) + i];
    const dl = lakeDist(x, z);
    let c;
    if (dl < LAKE.r) { c = new THREE.Color('#2f7fc8').lerp(new THREE.Color('#5ab0ee'), Math.max(0, 1 - dl / LAKE.r) * 0.6); }
    else c = groundColor(x, z, h, Math.hypot(H[j * (WM + 1) + i + 1] - h, H[(j + 1) * (WM + 1) + i] - h) / step);
    const nx = H[j * (WM + 1) + i + 1] - h, nz = H[(j + 1) * (WM + 1) + i] - h;
    const shade = Math.max(0.55, Math.min(1.35, 1 - (nx + nz) * 0.9));
    const edge = Math.max(Math.abs(x), Math.abs(z)) > PLAY_LIMIT ? 0.72 : 1; // fora da área jogável fica mais escuro
    const k = (j * WM + i) * 4;
    img.data[k] = Math.min(255, c.r * 255 * shade * edge); img.data[k + 1] = Math.min(255, c.g * 255 * shade * edge); img.data[k + 2] = Math.min(255, c.b * 255 * shade * edge); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // margem do lago
  g.strokeStyle = 'rgba(232,214,160,0.9)'; g.lineWidth = 2.5; g.beginPath();
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, rr = LAKE.r * lakeShape(LAKE.x + Math.cos(a), LAKE.z + Math.sin(a)); const X = w2m(LAKE.x + Math.cos(a) * rr), Y = w2m(LAKE.z + Math.sin(a) * rr); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  g.stroke();
  // cenário: árvores, pedras e prédios
  const px = 300 / WM;
  for (const o of placed) {
    const a = o.userData.asset, x = w2m(o.position.x), y = w2m(o.position.z);
    if (/^cloud|^lily|^mountain/.test(a)) continue;
    if (/^(colosso|cabeca|monolito|arco)/.test(a)) { g.fillStyle = '#9d978b'; g.beginPath(); g.arc(x, y, (a === 'colosso' ? 6 : a === 'cabeca_gigante' ? 4 : 1.4) / px, 0, 7); g.fill(); continue; }
    if (/^tree|^trees|^stump|^oak|^pine|^log|^cactus/.test(a)) {
      const r = (/^oak/.test(a) ? 2.6 * o.scale.x : /^pine/.test(a) ? 2.0 * o.scale.x : /_l$/.test(a) ? 3.2 : /_m$/.test(a) ? 2.4 : 1.6) / px;
      g.fillStyle = 'rgba(20,50,22,0.35)'; g.beginPath(); g.arc(x + 1, y + 1, r, 0, 7); g.fill();
      g.fillStyle = '#2f6a30'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(140,200,110,0.45)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); g.fill();
    } else if (/^rock|^stone/.test(a)) { g.fillStyle = '#8c8c88'; g.beginPath(); g.arc(x, y, 0.9 / px, 0, 7); g.fill(); }
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
/* S-189: planta de qualquer sala/prédio (paredes, móveis e colunas pelas colisões, a porta de saída) — minimapa e mapa G */
function roomMap(c, W, x, z, range, whole) {
  const I = S.interior; if (!I) return false;
  const R = W / 2, sc = whole ? (W * 0.9) / Math.max(I.w || 2 * I.round, I.d || 2 * I.round) : R / range, cx = whole ? I.x : x, cz = whole ? I.z : z;
  const pt = (px, pz) => [R + (px - cx) * sc, R + (pz - cz) * sc];
  c.fillStyle = '#16120c'; c.fillRect(0, 0, W, W);
  if (I.id === 'castelo') { castleMap(c, W, x, z, whole ? 50 : range, { yaw: S.pos.yaw, whole }); return true; }
  c.fillStyle = '#4a3c28'; c.strokeStyle = '#c9a24a'; c.lineWidth = 2;
  if (I.round) { const [a, b] = pt(I.x, I.z); c.beginPath(); c.arc(a, b, I.round * sc, 0, 7); c.fill(); c.stroke(); }
  else { const [a, b] = pt(I.x - I.w / 2, I.z - I.d / 2); c.fillRect(a, b, I.w * sc, I.d * sc); c.strokeRect(a, b, I.w * sc, I.d * sc); }
  c.fillStyle = 'rgba(20,14,8,0.85)';
  for (const co of colliders) { if (Math.abs(co.x - I.x) > (I.w || 2 * I.round) / 2 + 2 || Math.abs(co.z - I.z) > (I.d || 2 * I.round) / 2 + 2) continue; const [a, b] = pt(co.x, co.z);
    if (co.box) { c.save(); c.translate(a, b); c.rotate(-co.rot); c.fillRect(-co.hx * sc, -co.hz * sc, co.hx * 2 * sc, co.hz * 2 * sc); c.restore(); } else { c.beginPath(); c.arc(a, b, Math.max(1.5, co.r * sc), 0, 7); c.fill(); } }
  for (const pt2 of portals) if (Math.abs(pt2.x - I.x) < (I.w || 2 * I.round) && Math.abs(pt2.z - I.z) < (I.d || 2 * I.round)) { const [a, b] = pt(pt2.x, pt2.z); c.fillStyle = '#7ad8ff'; c.beginPath(); c.arc(a, b, 4, 0, 7); c.fill(); }
  if (whole) { c.font = '700 16px Cinzel, serif'; c.fillStyle = '#ffe9a8'; c.textAlign = 'center'; c.fillText(I.name || '', R, 22); const [a, b] = pt(x, z); c.fillStyle = '#fff'; c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); }
  return true;
}
function drawMinimap() {
  const cv = $('minimap'), c = cv.getContext('2d'), W = cv.width, R = W / 2;
  c.clearRect(0, 0, W, W);
  c.save(); c.beginPath(); c.arc(R, R, R - 7, 0, 7); c.clip();
  const sizePx = mmRange * 2 / 300 * WM;
  if (S.interior && !S.interior.dungeon) roomMap(c, W, S.pos.x, S.pos.z, Math.min(mmRange, 40)); // S-189: dentro de prédios, a planta da sala
  else if (!(S.interior && S.interior.dungeon && dungeonMap(c, W, S.pos.x, S.pos.z, mmRange))) { // na masmorra: planta do andar
    c.fillStyle = '#1a2a1a'; c.fillRect(0, 0, W, W);
    const MP = S.interior ? S.interior.back : S.pos; // dentro de casa: mostra a porta
    c.drawImage(worldMap, w2m(MP.x) - sizePx / 2, w2m(MP.z) - sizePx / 2, sizePx, sizePx, 0, 0, W, W);
  }
  const pt = (x, z) => [R + (x - S.pos.x) / mmRange * R, R + (z - S.pos.z) / mmRange * R];
  const inside = (x, y) => Math.hypot(x - R, y - R) < R - 9;
  for (const m of S.monsters) if (!m.dead) {
    if (S.interior && S.interior.dungeon && Math.abs(m.z - S.interior.z) > 36) continue; // só os do andar atual
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
  if ($('overlay').classList.contains('show')) return; // barbearia/derrota por cima do mundo: as teclas são da tela
  if (k === 'q') { FB.start(); return; }
  if (k === 'p') { H3.setPaused(!G.paused); return; }
  if (k === 'enter') { UI.setChatMin(false); $('chatinput').focus(); e.preventDefault(); return; }
  if ((k === 'arrowup' || k === 'arrowdown') && UI.wins.bestiario) { e.preventDefault(); UI.bestStep(k === 'arrowup' ? -1 : 1); return; } // S-100: com o Bestiário aberto, as setas escolhem o monstro
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys[k] = true; e.preventDefault(); return; }
  const win = { c: 'char', i: 'inv', e: 'equip', k: 'skills', t: 'tree', h: 'help', l: 'sugestoes', b: 'bestiario', o: 'loja', g: 'mapa', j: 'quests' }[k];
  if (win) { if (document.pointerLockElement) document.exitPointerLock(); UI.toggle(win); return; }
  if (k === 'n') { toggleSound(); return; }
  if (k === 'z') { if (isAdmin()) toggleGod(); return; }
  if (S.paused) return;
  if (k === 'tab') { e.preventDefault(); tabTarget(); return; }
  if (k === ' ') { e.preventDefault(); if (S.pos.ground && !S.p.dead) { S.pos.vy = 7.5; S.pos.ground = false; S.sitting = false; if (!S.riding) S.me.anim.play('Jump_Start', { once: true, restart: true, fade: 0.05 }); later(0.3, () => { if (!S.pos.ground && !S.riding) S.me.anim.play('Jump_Idle'); }); if (S.casting) { S.casting = null; $('castbar3d').classList.add('hidden'); } } return; }
  if (k === '0') { cycleHotPreset(); return; } // S-107: troca o conjunto de atalhos (3 ao todo)
  { const dg = /^Digit([1-9])$/.exec(e.code); if (dg && (e.shiftKey || (k >= '1' && k <= '9'))) { { const tg = aimTarget(40); if (tg) setTarget(tg); } /* habilidade vai para quem está na mira (cursor ou centro) */ useSlot(hbBase() + (e.shiftKey && hbRows() > 1 ? 9 : 0) + +dg[1] - 1); return; } } // modo ação: a habilidade vai para quem está na mira
  if (k === 'r') { if (S.target && !S.target.isNpc && !S.target.dead) { S.autoAttack = !S.autoAttack; log(S.autoAttack ? 'Ataque automático ligado.' : 'Ataque automático desligado.'); } else msgOnce('sel', 'Selecione um inimigo (Tab).'); return; }
  if (k === 'x') { if (!S.p.dead) { if (S.riding) dismount(); S.sitting = !S.sitting; S.autoAttack = false; } return; }
  if (k === 'm') { toggleMount(); return; }
  if (k === 'v') { cycleView(); return; } // câmera: clássica → 1ª pessoa → ombro (S-094)
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = mouse.mid = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (!S.started || S.menuOpen || FB.picking || FB.box) return;
  if (isAction()) { // modo ação: o 1º clique prende o mouse; depois, segurar o esquerdo ataca
    if (document.pointerLockElement !== canvas) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (err) { } return; }
    if (e.button === 0) S.fire = true; return;
  }
  if (e.button === 1) { e.preventDefault(); mouse.mid = true; S.lookYaw = S.lookYaw || 0; try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (err) { } return; } // S-115: segurar o botão do meio e arrastar = olhar o personagem por qualquer ângulo (360°)
  if (e.button === 0) { // S-141: botão esquerdo = atacar (segurar = continuar atacando); em NPC = conversar
    const hit = pick(e.clientX, e.clientY);
    if (hit && hit.isNpc) { mouse.left = true; mouse.moved = 0; mouse.x = e.clientX; mouse.y = e.clientY; mouse.btn = 0; return; }
    S.fire = true; S.autoAttack = false; return;
  }
  if (e.button === 2) mouse.right = true; else return;
  mouse.moved = 0; mouse.x = e.clientX; mouse.y = e.clientY; mouse.btn = e.button;
});
// S-233: enquanto o botão esquerdo está apertado, o cursor vira uma mira (branca; vermelha quando há um inimigo debaixo dela)
const AIM_CUR = c => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><g fill='none' stroke='${c}' stroke-width='2'><circle cx='16' cy='16' r='9'/><path d='M16 2v7M16 23v7M2 16h7M23 16h7'/></g><circle cx='16' cy='16' r='1.6' fill='${c}'/><g fill='none' stroke='rgba(0,0,0,0.6)' stroke-width='1'><circle cx='16' cy='16' r='10.5'/></g></svg>`)}") 16 16, crosshair`;
const AIM_W = AIM_CUR('#ffffff'), AIM_R = AIM_CUR('#ff4a3a');
function updateAimCursor() { if (isAction()) return; const want = S.fire ? (aimTarget(S.p && (S.p.d.ranged || S.p.d.magicAuto) ? 32 : 3.5) ? AIM_R : AIM_W) : ''; if (canvas.style.cursor !== want) canvas.style.cursor = want; }
addEventListener('mousemove', e => {
  mouseNdc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (isAction() && S.started && document.pointerLockElement === canvas) { S.cam.yaw -= e.movementX * 0.0024; S.aim = clamp(S.aim - e.movementY * 0.0022, -1.25, 1.3); return; }
  if (S.fire && !isAction() && S.started) { const w = AIM_WEIGHT[S.aimWeight || 'pesado']; S.cam.yaw -= e.movementX * w; S.cam.pitch = clamp(S.cam.pitch + e.movementY * w * 0.6, -0.12, 1.52); S.cam.pitchT = S.cam.pitch; } // S-234: segurando o ataque, mexer o mouse também gira a câmera (devagar, "pesado")
  if (mouse.mid) { S.lookYaw -= e.movementX * 0.006; S.cam.pitch = clamp(S.cam.pitch + e.movementY * 0.004, -0.12, 1.52); S.cam.pitchT = S.cam.pitch; return; }
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
  if (e.button === 0) S.fire = false;
  if (isAction()) return;
  const wasClick = mouse.moved <= 4 && (e.button === 0 ? mouse.left : mouse.right);
  if (e.button === 1) { mouse.mid = false; if (!mouse.left && !mouse.right && document.pointerLockElement) document.exitPointerLock(); }
  if (e.button === 0) mouse.left = false; else if (e.button === 2) mouse.right = false;
  if (!mouse.left && !mouse.right && document.pointerLockElement) document.exitPointerLock();
  if (wasClick && S.started && e.target === canvas && !FB.picking && !FB.box) {
    const hit = pick(e.clientX, e.clientY);
    if (hit && hit.isNpc) interact(hit, false);
    else if (hit && e.button === 2) setTarget(hit); // botão direito num monstro: só marca (para ver a vida/as habilidades)
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
// Esc → Configurações: som geral, música e efeitos separados, com volume (S-086)
function showSettings() {
  const o = $('overlay'); Sound.init();
  const pct = v => Math.round(v * 100);
  o.innerHTML = `<div class="death-box opts-box"><h2 style="color:var(--gold)">⚙️ Configurações</h2>
    <div class="opt-sec">🔊 Som</div>
    <label class="opt-sw"><input type="checkbox" id="o-all" ${Sound.enabled ? 'checked' : ''}><span>Som do jogo (tudo)</span></label>
    <label class="opt-sw"><input type="checkbox" id="o-mon" ${Sound.musicOn ? 'checked' : ''}><span>🎵 Música</span><input type="range" id="o-mv" min="0" max="100" value="${pct(Sound.musicVol)}"><b id="o-mv-t">${pct(Sound.musicVol)}%</b></label>
    <label class="opt-sw"><input type="checkbox" id="o-son" ${Sound.sfxOn ? 'checked' : ''}><span>💥 Efeitos <small class="muted">(golpes, saltos, monstros, passos...)</small></span><input type="range" id="o-sv" min="0" max="100" value="${pct(Sound.sfxVol)}"><b id="o-sv-t">${pct(Sound.sfxVol)}%</b></label>
    <div class="opt-sec">🎯 Combate</div>
    <div class="opt-sw"><span>Peso da mira ao atacar <small class="muted">(quanto a câmera gira ao mexer o mouse segurando o ataque)</small></span><select id="o-aimw">${[['leve', 'Leve'], ['medio', 'Médio'], ['pesado', 'Pesado'], ['travado', 'Câmera parada']].map(([k, n]) => `<option value="${k}" ${(S.aimWeight || 'pesado') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="menu-btns" style="margin-top:14px"><button class="btn" id="o-test">▶ Testar efeito</button><button class="btn gold" id="o-back">← Voltar</button></div></div>`;
  $('o-all').onchange = e => { Sound.setEnabled(e.target.checked); try { localStorage.setItem('aethra_sound', e.target.checked ? '1' : '0'); } catch (er) { } if (e.target.checked && Sound.music) { Sound.songId = null; Sound.playSong(S.zone ? S.zone.music : 'vila'); } };
  $('o-mon').onchange = e => Sound.setMusicOn(e.target.checked);
  $('o-son').onchange = e => Sound.setSfxOn(e.target.checked);
  $('o-mv').oninput = e => { Sound.setVolumes(e.target.value / 100, null); $('o-mv-t').textContent = e.target.value + '%'; };
  $('o-sv').oninput = e => { Sound.setVolumes(null, e.target.value / 100); $('o-sv-t').textContent = e.target.value + '%'; };
  $('o-test').onclick = () => Sound.play('levelup');
  $('o-aimw').onchange = e => { S.aimWeight = e.target.value; try { localStorage.setItem('aethra_aimw', S.aimWeight); } catch (er) { } };
  $('o-back').onclick = () => { S.menuOpen = false; toggleMenu(); };
}
function toggleMenu() {
  S.menuOpen = !S.menuOpen;
  const o = $('overlay');
  if (!S.menuOpen) { o.classList.remove('show'); return; }
  o.innerHTML = `<div class="death-box" style="border-color:var(--border);min-width:300px"><h2 style="color:var(--gold)">Menu</h2>
    <div class="muted" style="margin-bottom:14px">${escH(S.p.name)} — Nv. ${S.p.baseLv} ${CLASSES[S.p.cls].name}</div>
    <div class="menu-btns">
      <button class="btn gold" id="m-cont">▶ Continuar <span class="muted">(Esc)</span></button>
      <button class="btn" id="m-opts">⚙️ Configurações</button>
      <button class="btn" id="m-help">❔ Controles</button>
      <button class="btn" id="m-chars">🏠 Trocar de personagem</button>
    </div><div class="muted" style="margin-top:12px;font-size:11px">O jogo salva automaticamente. <b>Q</b> faz uma sugestão sobre qualquer tela.</div></div>`;
  o.classList.add('show');
  $('m-cont').onclick = toggleMenu;
  $('m-help').onclick = () => { toggleMenu(); UI.open('help'); };
  $('m-opts').onclick = () => showSettings();
  $('m-chars').onclick = () => { save3d(); location.reload(); };
}
const SAVE_FIELDS3 = ['charId', 'pet', 'mount', 'cosmetics', 'flights', 'name', 'look', 'cls', 'baseLv', 'jobLv', 'baseExp', 'jobExp', 'stats', 'statPoints', 'skillPoints', 'skills', 'zeny', 'inventory', 'equip', 'hotbar', 'hotPreset', 'hotRows', 'quests', 'seen', 'hp', 'sp'];
function save3d() {
  if (!S.p || !HAS_SRV) return;
  const s = {}; for (const k of SAVE_FIELDS3) s[k] = S.p[k];
  // a posição do 2D é preservada; a do 3D vai em pos3d
  s.mapId = S.orig.mapId || 'vila'; s.x = S.orig.x; s.y = S.orig.y; s.uid = Math.max(S.orig.uid || 1, 1000 + S.uid);
  s.pos3d = S.interior ? { x: S.interior.back.x, z: S.interior.back.z, yaw: S.interior.back.yaw } : { x: S.pos.x, z: S.pos.z, yaw: S.pos.yaw };
  s.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { }
  fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s), keepalive: true })
    .then(r => r.json()).then(j => { if (j.apagado) { alert(`O personagem ${s.name} foi apagado.`); location.reload(); } }).catch(() => { });
  S.lastSave = S.time;
}
addEventListener('beforeunload', () => { if (S.started) save3d(); });

/* =========================== Loop =========================== */
const clock = new THREE.Clock();
let titleSkip = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  step(dt);
  // fora do jogo (vitrine/criador), o mundo atrás do menu é só fundo: redesenha a cada 4 quadros e sem refazer sombras
  const ov = $('overlay'), behind = !S.started && ov.classList.contains('show');
  const covered = behind && !!ov.querySelector('.cs, .cc'); // vitrine e criador cobrem a tela inteira: o mundo nem precisa ser desenhado
  renderer.shadowMap.autoUpdate = !behind;
  if (!covered && (!behind || (titleSkip++ % 4) === 0)) draw(dt);
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
    for (const m of [...S.monsters]) { // monstros longe e calmos ficam parados (o mundo grande tem muitos)
      const far = Math.hypot(m.x - S.pos.x, m.z - S.pos.z);
      if (!m.dead && !m.aggro && far > 70) { m.obj.visible = far < 85; continue; } // a névoa já esconde quem está longe
      m.obj.visible = true; updateMonster(m, dt);
    }
    separateBodies();
    for (const n of S.npcs) { const d = Math.abs(n.x - S.pos.x) + Math.abs(n.z - S.pos.z); n.obj.visible = d < 95; if (d < 80) n.anim.update(dt); } // gente longe: nem anima nem aparece
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const pr = S.projectiles[i], to = pr.toFn(), d = to.distanceTo(pr.mesh.position), st = pr.speed * dt;
      if (d <= st + 0.2) { scene.remove(pr.mesh); S.projectiles.splice(i, 1); pr.onHit(); }
      else { pr.mesh.lookAt(to); pr.mesh.position.add(to.sub(pr.mesh.position).normalize().multiplyScalar(st)); }
    }
    for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i], k = (S.time - f.t0) / f.dur; if (k >= 1) { (f.parent || scene).remove(f.obj); S.fx.splice(i, 1); } else f.update(k); }
    for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > HALF + 30) c.position.x = -HALF - 30; }
    if (S.me && (S.me.hatId !== hatOf(S.p) || S.me.offId !== offOf(S.p))) buildPlayerModel(); // trocou o chapéu ou o escudo
    updateNature(S.time); updatePads(dt); updatePortals(dt); updateTerrain(S.pos.x, S.pos.z); cullScenery(); cullInteriors(); dungeonCull(camera.position.x, camera.position.z); if (S.arena) updateArena(dt); lightPool(S.me ? S.me.obj.position : camera.position); cullGrass(camera.position.x, camera.position.z);
    if (S.time - S.lastSave > 30) save3d();
  }
}
function draw(dt) {
  if (S.started) {
    // câmera estilo WoW: atrás do personagem, orbitando
    const P = S.pos, cam = S.cam;
    cam.dist += (cam.distT - cam.dist) * Math.min(1, dt * 10);
    if (cam.pitchT !== undefined) cam.pitch += (cam.pitchT - cam.pitch) * Math.min(1, dt * 12);
    if (!mouse.mid && S.lookYaw) { S.lookYaw *= Math.max(0, 1 - dt * 4); if (Math.abs(S.lookYaw) < 0.01) S.lookYaw = 0; } // soltou o botão do meio: a câmera volta para trás do personagem
    cam.viewYaw = mouse.mid ? cam.yaw + S.lookYaw : angLerp(cam.viewYaw ?? cam.yaw, cam.yaw + (S.lookYaw || 0), Math.min(1, dt * 10));
    const head = new THREE.Vector3(P.x, P.y + 1.45 - Math.max(0, 1.6 - cam.dist) * 0.25 + (S.riding ? 1 : 0), P.z);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let cx = P.x - Math.sin(cam.viewYaw) * cp * cam.dist, cz = P.z - Math.cos(cam.viewYaw) * cp * cam.dist, cy = head.y + sp * cam.dist;
    { const I = S.interior; if (I && I.round) { // S-119: na Arena a câmera nunca sai do círculo (nada de olhar para o muro por fora)
      const R = I.round - 2.2, ox = cx - P.x, oz = cz - P.z, px = P.x - I.x, pz = P.z - I.z;
      const A = ox * ox + oz * oz, B = 2 * (px * ox + pz * oz), C = px * px + pz * pz - R * R;
      if ((cx - I.x) ** 2 + (cz - I.z) ** 2 > R * R && A > 1e-6) { const tt = Math.max(0.05, (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A)); cx = P.x + ox * tt; cz = P.z + oz * tt; cy = head.y + (cy - head.y) * tt; }
    } }
    const gy = groundAt(cx, cz) + 0.5; if (cy < gy) cy = gy;
    const camPos = new THREE.Vector3(cx, cy, cz), dir = camPos.clone().sub(head), len = dir.length();
    camRay.set(head, dir.normalize()); camRay.far = len;
    const near = occluders.filter(o => Math.abs(o.position.x - P.x) < 30 && Math.abs(o.position.z - P.z) < 30);
    const hit = camRay.intersectObjects(near, true)[0];
    if (hit) camPos.copy(head).addScaledVector(dir, Math.max(0.6, hit.distance - 0.3));
    camera.position.copy(camPos); camera.lookAt(head);
    if (isAction()) { // 1ª pessoa / por cima do ombro: a câmera aponta para a mira (S-094)
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), ap = Math.cos(S.aim), as = Math.sin(S.aim), look = new THREE.Vector3(fx * ap, as, fz * ap);
      if (S.view === 'fps') { const eye = new THREE.Vector3(P.x + fx * 0.14, P.y + HERO_H * 0.92 + (S.riding ? 1 : 0), P.z + fz * 0.14); camera.position.copy(eye); camera.lookAt(eye.clone().add(look)); }
      else {
        const pivot = new THREE.Vector3(P.x - fz * 0.55, P.y + 1.62 + (S.riding ? 1 : 0), P.z + fx * 0.55), back = look.clone().multiplyScalar(-2.7);
        camRay.set(pivot, back.clone().normalize()); camRay.far = 2.7; const oh = camRay.intersectObjects(near, true)[0];
        const cpos = pivot.clone().add(back.setLength(oh ? Math.max(0.5, oh.distance - 0.25) : 2.7)); cpos.y = Math.max(cpos.y, groundAt(cpos.x, cpos.z) + 0.3);
        camera.position.copy(cpos); camera.lookAt(pivot.clone().addScaledVector(look, 12));
      }
    }
    sun.position.set(P.x + 30, P.y + 60, P.z + 18); sun.target.position.set(P.x, P.y, P.z);
    sky.position.copy(camera.position);
    // névoa por região
    if (S.interior && S.interior.dungeon) { scene.fog.color.set('#0d0b0c'); scene.fog.near = 6; scene.fog.far = 46; }
    else {
      const wr = zoneWeight('ruinas', P.x, P.z), wf = zoneWeight('floresta', P.x, P.z), wg = zoneWeight('geada', P.x, P.z), wd = zoneWeight('dunas', P.x, P.z), wc = zoneWeight('colossos', P.x, P.z);
      scene.fog.color.copy(FOG_DAY).lerp(FOG_FOREST, wf * 0.6).lerp(FOG_RUINS, wr * 0.85).lerp(FOG_SNOW, wg * 0.85).lerp(FOG_SAND, wd * 0.7).lerp(FOG_PLAIN, wc * 0.6);
      scene.fog.near = 90 - wr * 60 - wf * 35 - wg * 40 - wc * 55; scene.fog.far = 420 - wr * 270 - wf * 180 - wg * 150 - wd * 60 - wc * 210;
    }
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
  if (S.started) cullInteriors(); // garante que a sala aparece no mesmo quadro em que a câmera entra
  renderer.render(scene, camera);
}
// para testes automáticos: avança o jogo sem depender do requestAnimationFrame
window.__sim = (sec, fps = 30) => { for (let i = 0; i < sec * fps; i++) step(1 / fps); draw(1 / fps); };

/* =========================== Início =========================== */
/* =========================================================================
   ÁREA DE PERSONAGENS — vitrine (seleção) e criador com o boneco ao vivo
   ========================================================================= */
const RACE_ORDER = ['humano', 'elfo', 'anao'];
// luzes de estúdio (só na camada 1, usada pelas vitrines)
const stageKey = new THREE.DirectionalLight('#fff3e0', 2.2), stageRim = new THREE.DirectionalLight('#9fc4ff', 1.6);
for (const l of [stageKey, stageRim]) { l.layers.set(1); scene.add(l, l.target); }
const STAGE_POS = new THREE.Vector3(1000, 0, 1000);
stageKey.position.set(STAGE_POS.x + 2, 3, STAGE_POS.z + 4); stageKey.target.position.copy(STAGE_POS);
stageRim.position.set(STAGE_POS.x - 3, 2.5, STAGE_POS.z - 3); stageRim.target.position.copy(STAGE_POS);
function buildPreviewChar(look, cls = 'aprendiz', cosmetics = null, hatId = null) {
  const { ch, d } = makeHero(cls, look || {}, hatId);
  let skinFx = null; try { skinFx = cosmetics && cosmetics.skin ? applySkin(ch, cosmetics.skin) : null; } catch (e) { }
  ch.anim.play('Idle');
  return { ch, fx: t => { d.update(t); if (skinFx) skinFx(t); } };
}
// palco 3D numa <canvas>: personagem girando no pedestal, arrastar (ou A/D) gira, zoom no rosto, mascote ao lado.
// Tem o próprio renderizador (antes era desenhado no do mundo e copiado pixel a pixel a cada quadro: travava).
function makeStage(cv) {
  const W = cv.width, H = cv.height;
  const rr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); // preserve: o print das sugestões (Q) lê a imagem
  rr.setPixelRatio(Math.min(2, devicePixelRatio) * Math.max(1, (cv.clientWidth || W) / W) > 1.5 ? 1.5 : 1);
  rr.setSize(W, H, false); rr.outputColorSpace = THREE.SRGBColorSpace; rr.toneMapping = THREE.ACESFilmicToneMapping; rr.toneMappingExposure = 1.05; rr.setClearColor(0, 0);
  const sc = new THREE.Scene(), root = new THREE.Group(); sc.add(root);
  sc.add(new THREE.HemisphereLight('#d8ecff', '#5a6b3a', 1.1));
  const key = new THREE.DirectionalLight('#fff3e0', 2.6); key.position.set(2, 3.4, 4); const rim = new THREE.DirectionalLight('#9fc4ff', 1.6); rim.position.set(-3, 2.5, -3);
  const top = new THREE.DirectionalLight('#fff1d0', 1.2); top.position.set(1, 6, 2); sc.add(key, rim, top);
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.05, 50);
  // S-140: o pedestal agora é parte da cena 3D (no chão, y = 0): pés e patas sempre em cima do círculo
  { // S-219: pedestal de pedra clara com runas e brilho suave (dentro do enquadramento)
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), R = 256;
    const glow = x.createRadialGradient(R, R, 40, R, R, R); glow.addColorStop(0, 'rgba(255,214,140,0.42)'); glow.addColorStop(0.62, 'rgba(255,200,120,0.18)'); glow.addColorStop(0.86, 'rgba(255,190,100,0.06)'); glow.addColorStop(1, 'rgba(255,190,100,0)'); x.fillStyle = glow; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = 'rgba(255,226,160,0.55)'; x.lineWidth = 3; x.beginPath(); x.arc(R, R, 196, 0, 7); x.stroke(); x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,226,160,0.35)'; x.beginPath(); x.arc(R, R, 178, 0, 7); x.stroke(); x.beginPath(); x.arc(R, R, 120, 0, 7); x.stroke();
    x.fillStyle = 'rgba(255,230,170,0.5)'; x.font = '20px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const runes = 'ᚨᛖᚦᚱᚨ✦ᚲᚱᛟᚾᛁᚲᚨᛊ✦';
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; x.save(); x.translate(R + Math.cos(a) * 187, R + Math.sin(a) * 187); x.rotate(a + Math.PI / 2); x.fillText(runes[k % runes.length], 0, 0); x.restore(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const pad = new THREE.Mesh(new THREE.CircleGeometry(1.15, 96), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.002; pad.renderOrder = -1; sc.add(pad); }
  let zoomAt = new THREE.Vector3(0, 0, 0); // S-149: ponto para onde a rodinha aproxima (onde está o cursor)
  const zr = new THREE.Raycaster();
  let cur = null, pet = null, yaw = 0.35, vel = 0, drag = false, lastX = 0, t = 0, last = performance.now(), alive = true, zoom = 0, zoomT = 0, idleT = 0;
  let fit = { cx: 0, cy: 0.75, dist: 3.8, face: 1.02 }, keyTurn = 0;
  cv.onpointerdown = e => { drag = true; lastX = e.clientX; vel = 0; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - lastX; lastX = e.clientX; yaw += dx * 0.012; vel = dx * 0.012; idleT = 0; };
  cv.onpointerup = () => { drag = false; cv.style.cursor = 'grab'; };
  cv.onwheel = e => { e.preventDefault();
    if (e.deltaY < 0 && zoomT < 0.01) { // começando a aproximar: mira no ponto do personagem/mascote debaixo do cursor
      const r = cv.getBoundingClientRect(), v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); zr.setFromCamera(v, cam);
      const hit = zr.intersectObjects(root.children, true).find(h => h.object.visible && !h.object.isPoints);
      zoomAt = hit ? hit.point.clone() : new THREE.Vector3(fit.cx, fit.face, 0);
    }
    zoomT = Math.max(0, Math.min(1, zoomT + (e.deltaY < 0 ? 0.25 : -0.25))); };
  cv.style.cursor = 'grab';
  // A/D (ou ←/→ no criador) giram o boneco como o mouse
  const kd = e => { const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return; const k = e.key.toLowerCase(); if (k === 'a') keyTurn = -1; else if (k === 'd') keyTurn = 1; };
  const ku = e => { const k = e.key.toLowerCase(); if ((k === 'a' && keyTurn < 0) || (k === 'd' && keyTurn > 0)) keyTurn = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  // enquadramento: personagem e mascote inteiros, girando em qualquer ângulo (raio horizontal = invariante à rotação)
  const extent = obj => {
    obj.updateMatrixWorld(true); const box = new THREE.Box3(), v = new THREE.Vector3(); let rad = 0;
    obj.traverse(o => { if (!(o.isMesh || o.isSkinnedMesh) || !o.visible || o.isPoints) return; let hid = false; for (let p = o.parent; p; p = p.parent) if (!p.visible) hid = true; if (hid) return;
      let b; if (o.isSkinnedMesh) { o.computeBoundingBox(); b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); } else b = new THREE.Box3().expandByObject(o, true); box.union(b); // preciso: vértice a vértice (caixa girada inflava a espada)
      for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) rad = Math.max(rad, Math.hypot(x - obj.position.x, z - obj.position.z)); });
    return { rad: Math.min(rad, 1.3), top: Math.min(box.max.y, 2.6) };
  };
  const refit = () => {
    let x0 = -0.5, x1 = 0.5, h = HERO_H, depth = 0.5;
    if (cur) { const e = extent(cur.ch.obj); x0 = -e.rad; x1 = e.rad; h = Math.max(h, e.top); depth = e.rad; }
    if (pet) { const e = extent(pet.obj); x0 = Math.min(x0, pet.obj.position.x - e.rad); x1 = Math.max(x1, pet.obj.position.x + e.rad); h = Math.max(h, e.top); depth = Math.max(depth, pet.obj.position.z + e.rad); }
    const th = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), wHalf = (x1 - x0) / 2 + 0.12, hHalf = h / 2 + 0.16;
    let face = HERO_H * 0.68; // altura do rosto: centro da cabeça de verdade (anão é mais baixo)
    if (cur) { const hb = new THREE.Box3(); cur.ch.obj.traverse(o => { if (o.isSkinnedMesh && o.visible && (o.name === 'PlayerHead' || /^SuperHero/i.test(o.name) || /_Head(_Hooded)?$/.test(o.name))) { o.computeBoundingBox(); hb.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } }); if (!hb.isEmpty()) face = hb.getCenter(new THREE.Vector3()).y - 0.02; const hbone = cur.ch.root.getObjectByName('Head'); if (hbone) { const v = new THREE.Vector3(); hbone.getWorldPosition(v); face = v.y + 0.09; } } // corpo realista: mira o osso da cabeça
    fit = { cx: (x0 + x1) / 2, cy: h / 2 - 0.08, dist: (Math.max(hHalf / th, wHalf / (th * cam.aspect)) + depth * 0.45) * 1.14, face }; // S-219: margem embaixo, nada cortado
  };
  const api = {
    setChar(obj) { if (cur) root.remove(cur.ch.obj); cur = obj; if (cur) { root.add(cur.ch.obj); cur.ch.obj.position.set(0, 0, 0); cur.ch.anim.update(0.3); } refit(); draw(0); },
    setPet(species) { if (pet) root.remove(pet.obj); pet = null; if (species && PETS[species]) { pet = makePet(species, 0); pet.obj.position.set(0.85, 0, 0.3); root.add(pet.obj); pet.animate(0, { speed: 0, turn: 0 }, 0.016); } refit(); draw(0); },
    draw: () => draw(0.016),
    setZoom(z, now) { zoomAt = new THREE.Vector3(fit.cx, fit.face, 0); zoomT = z; if (now) { zoom = z; draw(0); } }, // botão "Ver rosto": aproxima do rosto get zoom() { return zoomT; }, get fit() { return fit; }, get cur() { return cur; },
    spin(d) { vel = d; idleT = 0; },
    setYaw(y) { yaw = y; vel = 0; idleT = 0; draw(0); },
    dispose() { if (!alive) return; alive = false; removeEventListener('keydown', kd); removeEventListener('keyup', ku); rr.dispose(); try { rr.forceContextLoss(); } catch (e) { } },
  };
  const frame = () => {
    if (!alive) return;
    if (!document.body.contains(cv)) { api.dispose(); return; }
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    draw(dt); requestAnimationFrame(frame);
  };
  function draw(dt) {
    if (!alive) return;
    t += dt; idleT += dt;
    if (keyTurn) { yaw += keyTurn * dt * 2.6; vel = 0; idleT = 0; }
    else if (!drag) { yaw += vel; vel *= 0.92; if (idleT > 4) yaw += dt * 0.25; } // inércia e giro lento quando parado
    zoom += (zoomT - zoom) * Math.min(1, dt * 8);
    if (cur) { cur.ch.obj.rotation.y = yaw; cur.ch.anim.update(dt); cur.fx(t); }
    if (pet) { pet.obj.rotation.y = yaw; pet.animate(t, { speed: 0, turn: 0 }, dt); } // S-149: o mascote olha sempre para o mesmo lado do personagem
    // zoom: do corpo inteiro (com o mascote) até o ponto que estava sob o cursor (S-149)
    const zx = zoomAt.x, zy = zoomAt.y || fit.face, cx = fit.cx + (zx - fit.cx) * zoom, cy = fit.cy + (zy - fit.cy) * zoom, dist = fit.dist + (Math.max(1.1, zoomAt.z + 1.2) - fit.dist) * zoom;
    cam.position.set(cx, cy + 0.12 * (1 - zoom), dist); cam.lookAt(cx, cy, 0);
    rr.render(sc, cam);
  }
  requestAnimationFrame(frame);
  return api;
}
const fmtAgo = ms => { if (!ms) return '—'; const m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? 'agora há pouco' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} dia(s)`; };
const lookLabel = l0 => { const l = normalizeLook(l0); return `${l.sex === 'f' ? 'Mulher' : 'Homem'} · ${HAIR_STYLES[l.hair.style].name} · ${HAIR_COLORS[l.hair.color].name}`; };
const thumbCacheChars = {};
function charThumb(s) {
  const key = s.slug + '|' + s.cls + '|' + JSON.stringify(s.look || {}) + '|' + JSON.stringify((s.cosmetics || {}).skin || '') + '|' + hatOf(s);
  if (thumbCacheChars[key]) return thumbCacheChars[key];
  const pc = buildPreviewChar(s.look, s.cls, s.cosmetics, hatOf(s)); const o = pc.ch.obj; o.position.set(1100, 0, 1000); o.rotation.y = 0.35; scene.add(o); pc.ch.anim.update(0.3); pc.fx(0.5);
  const url = renderObj(o, 140, 180); scene.remove(o);
  return (thumbCacheChars[key] = url);
}

// ---------- vitrine de personagens ----------
let csStage = null;
async function chooseCharacter() {
  const o = $('overlay');
  let list = [];
  try { list = await (await fetch('/api/saves')).json(); } catch (e) { }
  list = list.filter(c => c && c.name && CLASSES[c.cls]);
  if (!list.length) { showCreate3d(list); return; }
  const full = await Promise.all(list.map(async c => { try { return { ...(await (await fetch('/api/save/' + c.slug)).json()), slug: c.slug }; } catch (e) { return { ...c }; } }));
  let i = 0;
  o.innerHTML = `<div class="cs">
    <div class="cs-head"><h1>${GAME_TITLE}</h1><div class="sub">SEUS PERSONAGENS</div></div>
    <div class="cs-main">
      <button class="cs-arrow" id="cs-prev" title="Anterior (←)">‹</button>
      <div class="cs-stage"><canvas id="cs-cv" width="640" height="620"></canvas><div class="cs-hint">arraste ou <b>A</b>/<b>D</b> para girar · rodinha aproxima · <b>←</b>/<b>→</b> troca de personagem</div></div>
      <button class="cs-arrow" id="cs-next" title="Próximo (→)">›</button>
      <div class="cs-info" id="cs-info"></div>
    </div>
    <div class="cs-strip" id="cs-strip">${full.map((c, k) => `<div class="cs-card" data-k="${k}"><img alt=""><b>${escH(c.name)}</b><span>Nv. ${c.baseLv} · ${CLASSES[c.cls].name}</span></div>`).join('')}
      <div class="cs-card cs-new" id="cs-new"><div class="cs-plus">＋</div><b>Novo personagem</b><span>criar do zero</span></div></div>
    <div class="ver">Personagens: Quaternius (quaternius.com) • Cenário e monstros: KayKit, por Kay Lousberg (kaylousberg.com) • CC0 · clique para ativar o som</div>
  </div>`;
  o.classList.add('show');
  if (csStage) csStage.dispose();
  csStage = makeStage($('cs-cv'));
  // miniaturas aos poucos (não trava a tela)
  full.forEach((c, k) => setTimeout(() => { const im = o.querySelector(`.cs-card[data-k="${k}"] img`); if (im) im.src = charThumb(c); }, 60 + k * 40));
  const show = k => {
    i = (k + full.length) % full.length; const c = full[i], cl = CLASSES[c.cls];
    o.querySelectorAll('.cs-card[data-k]').forEach(el => el.classList.toggle('on', +el.dataset.k === i));
    csStage.setChar(buildPreviewChar(c.look, c.cls, c.cosmetics, hatOf(c))); csStage.setPet(c.pet && c.pet.species);
    const race = RACES[(c.look && c.look.race) || 'humano'], pi = c.pet ? petInfo(c.pet) : null;
    const zn = c.pos3d ? zoneAt(c.pos3d.x, c.pos3d.z) : null, bxp = Math.floor((c.baseExp || 0) / baseExpNext(c.baseLv) * 100);
    $('cs-info').innerHTML = `<div class="cs-name">${escH(c.name)}</div>
      <div class="cs-cls">${cl.icon} ${cl.name} <span class="muted">· ${race.icon} ${race.name}</span></div>
      <div class="cs-bars"><div><span>Nível de Base</span><b>${c.baseLv}</b><i><u style="width:${bxp}%"></u></i></div><div><span>Nível de Classe</span><b>${c.jobLv}</b></div></div>
      <div class="cs-grid">
        <div><span>💰 Zeny</span><b>${(c.zeny || 0).toLocaleString('pt-BR')}</b></div>
        <div><span>❤️ HP / 💧 SP</span><b>${c.hp || '—'} / ${c.sp || '—'}</b></div>
        <div><span>🐾 Mascote</span><b>${pi ? `${pi.icon} ${escH(pi.name)} Nv. ${c.pet.lv}` : '—'}</b></div>
        <div><span>🐎 Montaria</span><b>${c.mount && MOUNTS[c.mount.kind] ? MOUNTS[c.mount.kind].name : '—'}</b></div>
        <div><span>📍 Onde está</span><b>${zn ? zn.name : 'Vila de Alvorada'}</b></div>
        <div><span>🕒 Último jogo</span><b>${fmtAgo(c.savedAt)}</b></div>
        <div><span>💇 Visual</span><b>${escH(lookLabel(c.look))}</b></div>
        <div><span>✦ Auroras</span><b>${((c.cosmetics || {}).auroras || 0).toLocaleString('pt-BR')}</b></div>
      </div>
      <button class="btn gold cs-play" id="cs-play">▶ Entrar no mundo <span class="muted">(Enter)</span></button>
      <button class="btn cs-del" id="cs-del">🗑 Apagar personagem</button>`;
    $('cs-play').onclick = play;
    $('cs-del').onclick = () => askDelete(c);
  };
  const play = async () => { if (!csStage) return; Sound.init(); removeEventListener('keydown', keys); csStage.dispose(); csStage = null; const s = await (await fetch('/api/save/' + full[i].slug)).json(); startWith(s); };
  const keys = e => { if (!o.querySelector('.cs')) { removeEventListener('keydown', keys); return; } if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'Enter') play(); };
  addEventListener('keydown', keys);
  $('cs-prev').onclick = () => { Sound.init(); Sound.play('click'); show(i - 1); };
  $('cs-next').onclick = () => { Sound.init(); Sound.play('click'); show(i + 1); };
  o.querySelectorAll('.cs-card[data-k]').forEach(el => { el.onclick = () => { Sound.init(); Sound.play('click'); show(+el.dataset.k); }; el.ondblclick = play; });
  $('cs-new').onclick = () => { Sound.init(); removeEventListener('keydown', keys); csStage.dispose(); csStage = null; showCreate3d(full); };
  const askDelete = c => {
    const box = document.createElement('div'); box.className = 'cs-modal';
    box.innerHTML = `<div class="card"><h3>Apagar ${escH(c.name)}?</h3><div class="muted" style="margin-bottom:8px">O personagem vai para a lixeira do projeto (saves/lixeira) e some daqui. Para confirmar, digite o nome dele:</div>
      <input id="cs-del-name" placeholder="${escH(c.name)}"><div class="row" style="margin-top:10px"><button class="btn" id="cs-del-no">Cancelar</button><button class="btn" id="cs-del-yes" style="background:#8a2a2a" disabled>Apagar</button></div></div>`;
    o.appendChild(box);
    const inp = $('cs-del-name'); inp.focus(); inp.onkeydown = e => e.stopPropagation();
    inp.oninput = () => { $('cs-del-yes').disabled = inp.value.trim() !== c.name; };
    $('cs-del-no').onclick = () => box.remove();
    $('cs-del-yes').onclick = async () => { await fetch('/api/save/' + c.slug, { method: 'DELETE' }); try { const l = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (l && l.name === c.name) localStorage.removeItem(SAVE_KEY); } catch (e) { } box.remove(); removeEventListener('keydown', keys); csStage.dispose(); csStage = null; chooseCharacter(); };
  };
  show(0);
}

// ---------- criador de personagem (ou "barbearia" do mestre, no modo edição) ----------
const HERO_STYLES = ['curto', 'raspado', 'longo', 'coque', 'careca']; // cortes do corpo realista
function randomLook() { const pick = a => a[Math.floor(Math.random() * a.length)], sex = Math.random() < 0.5 ? 'm' : 'f'; return { race: pick(RACE_ORDER), sex, skin: pick(['clara', 'escura']), hair: { style: pick(HERO_STYLES), color: pick(Object.keys(HAIR_COLORS)) }, beard: sex === 'm' && Math.random() < 0.35 }; }
function showCreate3d(list, opts = {}) {
  const o = $('overlay'), edit = !!opts.edit;
  const st = { ...normalizeLook(opts.look || DEFAULT_LOOK), pet: opts.pet || null, name: '', cls: opts.cls || 'aprendiz' };
  const PREV = ['aprendiz', 'guerreiro', 'mago', 'arqueiro', 'gatuno'].filter(k => CLASSES[k]);
  o.innerHTML = `<div class="cc">
    <div class="cc-stagewrap">
      <div class="cc-stage"><canvas id="cc-cv" width="760" height="660"></canvas></div>
      <div class="cc-tools"><button class="btn" id="cc-l" title="Girar">⟲</button><button class="btn" id="cc-zoom">🙂 Ver rosto</button><button class="btn" id="cc-r" title="Girar">⟳</button><button class="btn" id="cc-rand">🎲 Aleatório</button></div>
      <div class="cc-prev"><span class="muted">Ver com a roupa de:</span>${PREV.map(k => `<button class="cc-chip ${k === st.cls ? 'on' : ''}" data-pc="${k}">${CLASSES[k].icon} ${CLASSES[k].name}</button>`).join('')}</div>
    </div>
    <div class="cc-panel">
      <div class="cc-title">${edit ? '💈 Barbearia do Mestre' : 'Criar personagem'}</div>
      <div class="cc-sub">${edit ? 'Mude a aparência de ' + escH(S.p.name) + ' — o resto continua igual.' : 'Monte seu aventureiro e veja ao lado como ele fica.'}</div>
      <div class="cc-sec"><h4><b>1</b> Raça</h4><div class="cc-races">${RACE_ORDER.map(k => `<div class="cc-race" data-race="${k}"><div class="i">${RACES[k].icon}</div><div class="n">${RACES[k].name}</div><div class="h">${RACES[k].hint}</div></div>`).join('')}</div><div class="cc-note" id="cc-race-d"></div></div>
      <div class="cc-sec"><h4><b>2</b> Corpo e pele</h4><div class="cc-faces" style="grid-template-columns:repeat(4,1fr)">${[['sex', 'm', '🧔', 'Homem'], ['sex', 'f', '👩', 'Mulher'], ['skin', 'clara', '🏻', 'Pele clara'], ['skin', 'escura', '🏾', 'Pele morena']].map(([f, v, i, n]) => `<button class="cc-face" data-${f}="${v}"><span class="i">${i}</span><b>${n}</b></button>`).join('')}</div></div>
      <div class="cc-sec"><h4><b>3</b> Corte de cabelo</h4><div class="cc-styles">${HERO_STYLES.map(k => `<button class="cc-style" data-style="${k}"><span>${HAIR_STYLES[k].icon}</span>${HAIR_STYLES[k].name}</button>`).join('')}</div></div>
      <div class="cc-sec"><h4><b>4</b> Cor do cabelo <span class="muted" id="cc-col-n"></span></h4><div class="cc-colors">${Object.entries(HAIR_COLORS).map(([k, c]) => `<button class="cc-col" data-color="${k}" title="${c.name}" style="--c:${c.hex}"></button>`).join('')}</div>
        <label class="cc-check"><input type="checkbox" id="cc-beard"> Barba <span class="muted">(da mesma cor do cabelo)</span></label></div>
      ${edit ? '' : `<div class="cc-sec"><h4><b>5</b> Companheiro</h4><div class="cc-pets">${Object.entries(PETS).map(([k, p]) => `<div class="cc-pet" data-pet="${k}" style="--pc:${p.color}"><div class="i">${p.stages[0].icon}</div><div class="n">${p.stages[0].name}</div><div class="h">${p.roleIcon} ${p.roleName}</div></div>`).join('')}</div><div class="cc-note" id="cc-pet-d"></div></div>
      <div class="cc-sec"><h4><b>6</b> Nome</h4><input type="text" id="c3-name" maxlength="16" placeholder="Como seu aventureiro vai se chamar?"><div class="cw-err" id="cw-err"></div></div>`}
      <div class="cc-foot"><button class="btn" id="cc-back">← ${edit ? 'Cancelar' : list.length ? 'Meus personagens' : 'Voltar'}</button><button class="btn gold" id="cc-ok">${edit ? '✔ Salvar aparência' : '✨ Criar personagem'}</button></div>
    </div></div>`;
  o.classList.add('show');
  const stage = makeStage($('cc-cv'));
  window.__ccStage = stage; // testes
  const refresh = () => {
    stage.setChar(buildPreviewChar({ race: st.race, hair: st.hair, beard: st.beard, sex: st.sex, skin: st.skin }, st.cls));
    o.querySelectorAll('[data-sex]').forEach(el => el.classList.toggle('on', el.dataset.sex === st.sex));
    o.querySelectorAll('[data-skin]').forEach(el => el.classList.toggle('on', el.dataset.skin === st.skin));
    $('cc-beard').parentElement.style.display = st.sex === 'm' ? '' : 'none';
    o.querySelectorAll('[data-race]').forEach(el => el.classList.toggle('on', el.dataset.race === st.race));
    o.querySelectorAll('[data-style]').forEach(el => el.classList.toggle('on', el.dataset.style === st.hair.style));
    o.querySelectorAll('[data-color]').forEach(el => el.classList.toggle('on', el.dataset.color === st.hair.color));
    o.querySelectorAll('[data-pet]').forEach(el => el.classList.toggle('on', el.dataset.pet === st.pet));
    o.querySelectorAll('[data-pc]').forEach(el => el.classList.toggle('on', el.dataset.pc === st.cls));
    $('cc-beard').checked = !!st.beard; $('cc-col-n').textContent = '· ' + HAIR_COLORS[st.hair.color].name;
    $('cc-race-d').textContent = RACES[st.race].desc + (st.race === 'anao' ? ' (a barba de anão vem sempre)' : '');
    if ($('cc-pet-d')) $('cc-pet-d').textContent = st.pet ? PETS[st.pet].desc : 'Escolha quem vai te acompanhar — ele luta ao seu lado e evolui com você.';
  };
  const click = () => { Sound.init(); Sound.play('click'); };
  o.querySelectorAll('[data-race]').forEach(el => el.onclick = () => { click(); st.race = el.dataset.race; refresh(); });
  o.querySelectorAll('[data-sex]').forEach(el => el.onclick = () => { click(); st.sex = el.dataset.sex; if (st.sex === 'f') st.beard = false; refresh(); });
  o.querySelectorAll('[data-skin]').forEach(el => el.onclick = () => { click(); st.skin = el.dataset.skin; stage.setZoom(1); $('cc-zoom').textContent = '🧍 Corpo inteiro'; refresh(); }); // mostra o rosto de perto
  o.querySelectorAll('[data-style]').forEach(el => el.onclick = () => { click(); st.hair = { ...st.hair, style: el.dataset.style }; refresh(); });
  o.querySelectorAll('[data-color]').forEach(el => el.onclick = () => { click(); st.hair = { ...st.hair, color: el.dataset.color }; refresh(); });
  o.querySelectorAll('[data-pet]').forEach(el => el.onclick = () => { click(); st.pet = el.dataset.pet; stage.setPet(st.pet); refresh(); });
  o.querySelectorAll('[data-pc]').forEach(el => el.onclick = () => { click(); st.cls = el.dataset.pc; refresh(); });
  $('cc-beard').onchange = e => { st.beard = e.target.checked; refresh(); };
  $('cc-l').onclick = () => stage.spin(-0.12); $('cc-r').onclick = () => stage.spin(0.12);
  $('cc-zoom').onclick = () => { const z = stage.zoom > 0.5 ? 0 : 1; stage.setZoom(z); $('cc-zoom').textContent = z ? '🧍 Corpo inteiro' : '🙂 Ver rosto'; };
  $('cc-rand').onclick = () => { click(); Object.assign(st, randomLook()); refresh(); };
  $('cc-back').onclick = () => { click(); stage.dispose(); if (edit) { o.classList.remove('show'); o.innerHTML = ''; } else if (list.length) chooseCharacter(); else showCreate3d(list); };
  const err = m => { $('cw-err').textContent = m; Sound.play('error'); };
  $('cc-ok').onclick = async () => {
    const look = { race: st.race, hair: { ...st.hair }, beard: !!st.beard && st.sex === 'm', sex: st.sex, skin: st.skin };
    if (edit) { S.p.look = look; buildPlayerModel(); save3d(); stage.dispose(); o.classList.remove('show'); o.innerHTML = ''; log('💈 Aparência atualizada!', 'sys'); return; }
    const nameEl = $('c3-name'), name = nameEl.value.trim();
    if (!st.pet) return err('Escolha um companheiro (passo 5).');
    if (name.length < 2) { nameEl.focus(); return err('Dê um nome ao seu personagem (pelo menos 2 letras).'); }
    if (list.some(c => (c.slug || saveSlug(c.name)) === saveSlug(name))) { nameEl.focus(); return err('Você já tem um personagem com esse nome. Escolha outro.'); }
    Sound.init();
    const c = createCharacter(name, look, st.pet);
    const s = {}; for (const k of SAVE_FIELDS3) s[k] = c[k];
    Object.assign(s, { mapId: 'vila', x: 20 * CONFIG.TILE + 16, y: 18 * CONFIG.TILE + 16, uid: G.uid, savedAt: Date.now() });
    try { await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }); } catch (e) { }
    stage.dispose(); startWith(s);
    log('Você tem 48 pontos de atributo para distribuir (C).', 'sys');
  };
  if ($('c3-name')) { const n = $('c3-name'); n.addEventListener('keydown', e => { e.stopPropagation(); $('cw-err').textContent = ''; if (e.key === 'Enter') $('cc-ok').click(); }); }
  stage.setPet(st.pet);
  refresh();
}
function renderObj(obj, W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  obj.updateMatrixWorld(true); obj.traverse(o => o.layers.enable(1));
  const box = new THREE.Box3().setFromObject(obj), h = Math.max(1, box.max.y - box.min.y), c = box.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 60); cam.position.set(c.x, c.y + h * 0.12, c.z + h * 2.6); cam.lookAt(c); cam.layers.set(1);
  const bg = scene.background, fog = scene.fog, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  scene.background = null; scene.fog = null; renderer.setClearColor(0, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(null); scene.background = bg; scene.fog = fog; renderer.setClearColor(cc, ca); rt.dispose();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  g.putImageData(img, 0, 0); return cv.toDataURL('image/png');
}
function startWith(s) {
  if (!s.pet) {
    return showPetChoice(`${escH(s.name)}, três criaturinhas te seguiram até a vila... Qual delas vai te acompanhar?`, species => { s.pet = newPet(species); startWith(s); setTimeout(save3d, 500); log(`🐾 ${PETS[species].stages[0].name} agora é seu companheiro!`, 'card'); });
  }
  const p = { ...s };
  p.look = normalizeLook(p.look); // conserta saves antigos (cabeça pronta, cor do cabelo quebrada) e dá o rosto padrão
  if (!p.charId) p.charId = newCharId();
  normalizeHotbar(p);
  Object.assign(p, { buffs: {}, cds: {}, dead: false });
  recalc(p); if (p.hp <= 0) p.hp = Math.floor(p.d.maxHp / 2);
  S.p = p; S.orig = s;
  let maxUid = s.uid || 1;
  for (const e of [...(p.inventory || []), ...Object.values(p.equip || {})]) if (e && e.uid > maxUid) maxUid = e.uid;
  G.uid = maxUid + 1; G.player = p;
  const pos = s.pos3d;
  if (pos && Math.abs(pos.x) < PLAY_LIMIT && Math.abs(pos.z) < PLAY_LIMIT) Object.assign(S.pos, { x: pos.x, z: pos.z, yaw: pos.yaw || 0 });
  S.pos.y = heightAt(S.pos.x, S.pos.z); S.cam.yaw = S.pos.yaw;
  terrainNear(S.pos.x, S.pos.z); cullGrass(S.pos.x, S.pos.z, true);
  buildPlayerModel(); buildPet();
  $('overlay').classList.remove('show'); $('hud').classList.remove('hidden');
  S.started = true; hudDirty = true; syncG(); UI.refreshOpen();
  log(`Bem-vindo(a) ao mundo aberto de Aethra, ${p.name}!`, 'card');
  log('W/S andam • A/D viram • botão direito segurado gira a câmera junto • Espaço pula • Tab escolhe alvo • R ataca • H ajuda', 'sys');
  if (!localStorage.getItem('aethra3d_help')) { UI.open('help'); try { localStorage.setItem('aethra3d_help', '1'); } catch (e) { } }
}


/* =========================== Integração com as janelas do 2D =========================== */
const ASSET_NAMES = { casa_da_vila: 'Casa da vila', muralha_pedrafunda: 'Muralha de Pedrafunda', rua_pedrafunda: 'Rua principal de Pedrafunda', estoa_pedrafunda: 'Pórtico da ágora', acropole_pedrafunda: 'Acrópole de Pedrafunda', templo_da_forja: 'Templo da Forja', santuario_ancestrais: 'Santuário dos Ancestrais', taverna_anao: 'Taverna Bigorna Bêbada', mesas_da_taverna: 'Mesas da taverna', carroca_de_minerio: 'Carroça de minério', lago_congelado: 'Lago congelado', cais_de_pedra: 'Cais de pedra', cabeco: 'Cabeços de amarração', navio: 'Navio Gaivota Dourada', prancha: 'Prancha de embarque', quebra_mar: 'Quebra-mar do farol', estaleiro: 'Estaleiro (bote em conserto)', ancora_da_praca: 'Âncora da praça', mesa_da_capitania: 'Mesa da Capitania', toras: 'Pilha de toras', calcamento: 'Calçamento de pedra da praça', ruinas: 'Ruínas', calcada_antiga: 'Calçada antiga', coluna_quebrada: 'Coluna quebrada', muro_desabado: 'Muro desabado', coluna_tombada: 'Coluna gigante tombada', pedestal_vazio: 'Pedestal vazio', escombros: 'Escombros', muralha_gelida: 'A Muralha Gélida', escadaria_da_muralha: 'Escadaria da Muralha', sarilho: 'Sarilho do elevador', elevador_de_gaiola: 'Elevador de gaiola', torre_do_comandante: 'Torre do Comandante', salao_comunal: 'Salão comunal', alojamento: 'Alojamento da Vigília', corvaria: 'Corvaria', arsenal: 'Arsenal com forja', estabulo_da_vigilia: 'Estábulo da Vigília', patio_de_treino: 'Pátio de treino', portao_da_muralha: 'Portão selado da Muralha', lenha: 'Lenha empilhada', neve: 'Neve acumulada', guilda_dos_mercadores: 'Guilda dos Mercadores', armazem: 'Armazém de carga', banca_do_mercado: 'Banca do mercado', guindaste_do_cais: 'Guindaste do cais', galeao_mercante: 'Galeão mercante', noctivago: 'Noctívago (cavalo alado)', pinesnow_0: 'Pinheiro com neve', pinesnow_1: 'Pinheiro com neve', pinesnow_2: 'Pinheiro com neve', pinesnow_3: 'Pinheiro com neve', oak_0: 'Carvalho', oak_1: 'Carvalho', oak_2: 'Carvalho', oak_3: 'Carvalho', oak_4: 'Carvalho', oakdark_0: 'Carvalho do bosque', oakdark_1: 'Carvalho do bosque', oakdark_2: 'Carvalho do bosque', pine_0: 'Pinheiro', pine_1: 'Pinheiro', pine_2: 'Pinheiro', pine_3: 'Pinheiro', pine_4: 'Pinheiro', pinedark_0: 'Pinheiro escuro', pinedark_1: 'Pinheiro escuro', pinedark_2: 'Pinheiro escuro', pinedark_3: 'Pinheiro escuro', stone_0: 'Pedra', stone_1: 'Pedra', stone_2: 'Pedra', stone_3: 'Rocha', stone_4: 'Rocha', stone_5: 'Rocha', stonedark_0: 'Rocha musgosa', stonedark_1: 'Rocha musgosa', stonedark_2: 'Rocha musgosa', stonedark_3: 'Rocha musgosa', stump_0: 'Toco', stump_1: 'Toco', stump_2: 'Toco', log_0: 'Tronco caído', log_1: 'Tronco caído', home_A: 'Casa', home_B: 'Casa', home_A_red: 'Casa', home_B_red: 'Casa', tavern: 'Taverna', blacksmith: 'Ferraria', market: 'Feira', church: 'Igreja', windmill: 'Moinho', well: 'Poço', tower: 'Torre', destroyed: 'Prédio em ruínas', wall: 'Muro', wall_corner: 'Muro (canto)', fence: 'Cerca', palisade: 'Paliçada de troncos', colosso: 'Colosso de pedra', colosso_sentinela: 'Colosso Sentinela (de pé, com espada e escudo)', colosso_rei: 'Rei de Pedra no trono', colosso_fera: 'Fera de pedra agachada', colosso_tita: 'Titã caído (braço erguido)', colosso_sem_cabeca: 'Guerreiro de pedra sem cabeça', ruin_wall: 'Muro em ruínas', cabeca_gigante: 'Cabeça de gigante caída', monolito: 'Monólito com runas', arco: 'Arco antigo', santuario: 'Santuário Silente', cactus_0: 'Cacto', cactus_1: 'Cacto', cactus_2: 'Cacto', scaffold: 'Andaime', tree_A: 'Pinheiro', tree_B: 'Pinheiro', trees_A_m: 'Grupo de árvores', trees_B_m: 'Grupo de árvores', trees_A_l: 'Bosque denso', trees_B_l: 'Bosque denso', stump: 'Tocos', rock_A: 'Pedra', rock_B: 'Pedra', rock_C: 'Pedra', rock_D: 'Pedra', rock_E: 'Pedra', mountain_A: 'Montanha', mountain_B: 'Montanha', mountain_C: 'Montanha', cloud: 'Nuvem', cloud_s: 'Nuvem', lily: 'Vitória-régia', lilypad: 'Vitória-régia (dá para pular em cima)', barrel: 'Barril', crate_A: 'Caixote', crate_B: 'Caixote', sack: 'Saco', wheelbarrow: 'Carrinho de mão', flag_blue: 'Bandeira', flag_red: 'Bandeira', tent: 'Tenda', weaponrack: 'Suporte de armas', lumber: 'Toras', bucket: 'Balde', target_prop: 'Alvo de treino', target_round: 'Alvo de treino', fruitstand: 'Barraca de frutas', cais: 'Cais do porto', barco: 'Barco de pesca', veleiro: 'Veleiro', farol: 'Farol', casa_do_porto: 'Casa do porto', banca_de_peixe: 'Banca de peixe', redes_de_pesca: 'Redes de pesca', palmeira: 'Palmeira', mastro: 'Mastro com estandarte', portao_pedrafunda: 'Portão de Pedrafunda', estatua_anao: 'Estátua de guerreiro anão', salao_anao: 'Salão do Rei-Sob-a-Pedra', casa_anao: 'Casa de anão', morada_anao: 'Morada escavada na rocha', ferraria_anao: 'Ferraria do Mestre Brakar', forja_da_praca: 'Forja da praça', banca_de_armas: 'Banca de machados', arvore_ancia: 'Árvore anciã', ponte_elfica: 'Ponte suspensa', casa_elfica: 'Casa élfica', pavilhao_elfico: 'Pavilhão élfico', fonte_da_lua: 'Fonte da Lua', portal_elfico: 'Portal de Aelindra', lanterna_elfica: 'Lanternas élficas', castelo_valcinza: 'Castelo de Valcinza', interior_castelo: 'Interior do Castelo de Valcinza', tabela_refino: 'Tabela de refino do Mestre Brakar' };
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
  const oh = raycaster.intersectObjects([...near, ...extraPick, terrain], true)[0];
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
    const a = o.userData.asset, op = o.userData.center ? pt : o.position; // estruturas grandes: marca onde foi clicado
    if (a === 'palisade') return { kind: 'cenario', id: a, name: ASSET_NAMES[a], wpos: { x: pt.x, y: pt.y, z: pt.z }, r: 2, x: pt.x, y: pt.z, tile: tileOf(pt.x, pt.z), codigo: 'js3d/palisade3d.js → makePalisade (troncos, travessas, cordas) · js3d/main3d.js → buildWorld (traçado em volta da vila)', details: { modelo: a, versao: '3D' } };
    return { kind: 'cenario', id: a, name: ASSET_NAMES[a] || a, wpos: { x: op.x, y: op.y, z: op.z }, r: 2, x: op.x, y: op.z, tile: tileOf(o.position.x, o.position.z), codigo: ASSETS[a] ? `${ASSETS[a]} (modelo KayKit) · js3d/main3d.js → buildWorld (posição/escala) e TYPE_SCALE` : /^(colosso|cabeca|monolito|arco|santuario|cactus|ruin_wall|wheelbarrow)/.test(a) ? `js3d/landmarks3d.js (forma, '${a}') · js3d/main3d.js → buildFrontier (onde fica)` : `js3d/trees3d.js → árvore feita em código ('${a}') · js3d/main3d.js → buildWorld (onde nasce)`, details: { modelo: a, versao: '3D' } };
  }
  const zn = zoneAt(pt.x, pt.z), rd = roadDist(pt.x, pt.z), lake = lakeDist(pt.x, pt.z) < LAKE.r;
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
  S.fallTop = null; S.tpT = S.time;
  const r = resolve(x, z, 0.5);
  if (S.interior) leaveInterior(true);
  terrainNear(r.x, r.z); cullGrass(r.x, r.z, true);
  Object.assign(S.pos, { x: r.x, z: r.z, y: heightAt(r.x, r.z), vy: 0, ground: true });
  setTarget(null); S.casting = null; $('castbar3d').classList.add('hidden');
  ring(S.pos, 2.2, '#9fe3ff'); ring(S.pos, 1.2, '#ffd76a'); Sound.play('portal');
}
// retrato do personagem de frente (janela de Equipamento): renderiza só o modelo do jogador
let portraitRT = null, portraitCache = { key: '', url: null };
function portrait(yawOff = 0.42) {
  if (!S.me || !S.p) return null;
  const p = S.p, key = yawOff.toFixed(2) + '|' + p.cls + '|' + JSON.stringify(p.cosmetics || {}) + '|' + JSON.stringify(p.look || {}) + '|' + EQUIP_SLOTS.map(s => p.equip[s] ? p.equip[s].id : '').join(',') + '|' + S.me.obj.uuid;
  if (portraitCache.key === key && portraitCache.url) return portraitCache.url;
  const W = 300, H = 420;
  if (!portraitRT) { portraitRT = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); portraitRT.texture.colorSpace = THREE.SRGBColorSpace; }
  const obj = S.me.obj, vis = obj.visible;
  obj.visible = true; obj.updateMatrixWorld(true);
  obj.traverse(o => o.layers.enable(1));
  // enquadra o personagem inteiro (com a arma) usando uma esfera em volta dele
  const box = new THREE.Box3(); obj.traverse(o => { if (o.isMesh && o.visible && !o.isPoints) { o.geometry.computeBoundingBox && !o.isSkinnedMesh ? box.expandByObject(o) : box.expandByObject(o, true); } });
  if (box.isEmpty()) box.setFromObject(obj);
  const sph = box.getBoundingSphere(new THREE.Sphere()), h = Math.max(1, box.max.y - box.min.y);
  const yaw = obj.rotation.y + yawOff; // 3/4 de frente (arrastável na janela)
  const target = sph.center.clone();
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 60);
  const vf = 26 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * W / H);
  const dist = sph.radius * 1.08 / Math.sin(Math.min(vf, hf) / 2);
  cam.position.set(target.x + Math.sin(yaw) * dist, target.y + h * 0.12, target.z + Math.cos(yaw) * dist);
  cam.lookAt(target); cam.layers.set(1);
  const bg = scene.background, fog = scene.fog, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(portraitRT); renderer.clear(); renderer.render(scene, cam); 
  const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(portraitRT, 0, 0, W, H, buf);
  renderer.setRenderTarget(null); scene.background = bg; scene.fog = fog; renderer.setClearColor(cc, ca); obj.visible = vis;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // vira de cabeça para cima
  g.putImageData(img, 0, 0);
  portraitCache = { key, url: c.toDataURL('image/png') };
  return portraitCache.url;
}
function installIntegration() {
  UI.render_loja = renderLoja;
  UI.render_mapa = renderMapa;
  Object.assign(H3, {
    save: save3d, useItem: use3d, useSlot, levelFx, portrait, monsterThumb, monsterLive, monsterPopup, refineFx: (ok, broke) => { ring(S.pos, ok ? 1.8 : 1.4, ok ? '#ffd76a' : broke ? '#ff4a3a' : '#9a9a9a'); if (ok) ring(S.pos, 1.0, '#fff6c0'); floatAt(S.me.obj.position, ok ? 'Refino bem-sucedido!' : broke ? 'Quebrou!' : 'Falhou', ok ? '#ffd76a' : '#ff6a5a', 2.4); },
    setPet: (k, st, force) => { if (!isAdmin() || (!G.god && !force)) return; const pt = newPet(k); pt.lv = st ? PET_EVOLVE[st] : 1; S.p.pet = pt; buildPet(); hudDirty = true; log(`⚡ Mascote trocado: ${petInfo(pt).name} (Nv. ${pt.lv}).`, 'sys'); save3d(); },
    spawnInfo: () => { const o = {}, c = {}; for (const [zone, type, n] of SPAWNS) { const zn = ZONES.find(q => q.id === zone) || INTERIORS[zone]; if (!zn) continue; const k = type + '|' + zn.name; c[k] = (c[k] || 0) + (n || 1); } for (const k in c) { const [type, name] = k.split('|'); (o[type] = o[type] || []).push(`${name} <b>×${c[k]}</b>`); } return o; }, // S-171: onde e quantos
    zoneMobs: () => { const o = {}; for (const [zone, type, n] of SPAWNS) { const zn = ZONES.find(q => q.id === zone) || INTERIORS[zone]; if (!zn) continue; const a = (o[zn.name] = o[zn.name] || {}); a[type] = (a[type] || 0) + (n || 1); } return o; },
    questTargets, zoneMusic: () => (S.zone ? S.zone.music : 'vila'),
    setPaused: on => { G.paused = on; mouse.left = mouse.right = false; for (const k in keys) keys[k] = false; if (Sound.music) Sound.music.gain.setTargetAtTime((on ? 0.05 : 0.16) * Sound.mv(), Sound.ctx.currentTime, 0.2); updatePauseBar(); },
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
      <b>Tab</b> próximo inimigo à frente • <b>clique</b> seleciona • <b>R</b> ou <b>botão direito no alvo</b> ataca • <b>1–9</b> habilidades/itens • <b>X</b> sentar<br><b>V</b> troca a câmera: clássica → <b>1ª pessoa</b> → <b>por cima do ombro</b>. Nos dois modos de ação: clique para prender o mouse, a mira fica no centro, <b>segure o botão esquerdo</b> para atacar o que está na mira, A/D andam de lado, Esc solta o mouse.<br><br>
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
  out.push({ label: '🏛️ Santuário Silente', x: TEMPLE.x, z: TEMPLE.z + 26 });
  out.push({ label: '⚒️ Pedrafunda (anões)', x: DWARF.x, z: DWARF.z + 30 }, { label: '🌙 Aelindra (elfos)', x: ELF.x, z: ELF.z + 30 }, { label: '⚓ Porto das Gaivotas', x: PORT.x - 10, z: PORT.z - 10 }, { label: '🏰 Castelo de Valcinza', x: CASTLE.x + 26, z: CASTLE.z - 50 });
  for (const n of S.npcs) if (Math.abs(n.x) < HALF) out.push({ label: `🧑 ${n.name}`, x: n.x + 2, z: n.z + 1 });
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
      ${(() => { // S-105: árvore de evolução compacta — Aprendiz no topo, cada 1ª classe com as suas 2ª classes logo abaixo, ligadas por linhas
        const btn = c => `<button class="adm-class ${p.cls === c ? 'on' : ''} ${p.cls !== c && (CLASSES[p.cls].parent === c || CLASSES[CLASSES[p.cls].parent || 'aprendiz'].parent === c) ? 'path' : ''}" data-cls="${c}" title="${escH(CLASSES[c].desc)}"><span>${CLASSES[c].icon}</span>${CLASSES[c].name}</button>`;
        const t1 = Object.keys(CLASSES).filter(c => CLASSES[c].tier === 1);
        return `<div class="adm-tree"><div class="adm-tree-root">${btn('aprendiz')}</div><div class="adm-tree-cols">${t1.map(c => `<div class="adm-tree-col"><div class="adm-tree-t1">${btn(c)}</div><div class="adm-tree-t2">${(CLASSES[c].next || []).map(btn).join('')}</div></div>`).join('')}</div></div>`;
      })()}
      <button class="btn small" data-cmd="skills" style="margin-top:6px">📚 Liberar todas as habilidades da classe</button>
    </div>
    <div class="adm-card"><div class="adm-card-h">🌍 Teleporte <span class="muted" style="font-weight:400">— clique no mapa onde quer aparecer</span></div>
      <div class="adm-mapframe"><canvas id="adm-map3d" width="560" height="560"></canvas></div>
      <div id="adm-info" class="adm-info">Passe o mouse no mapa e clique para ir</div>
    </div>
    <div class="adm-card"><div class="adm-card-h">🧬 Raça e aparência</div>
      <div class="adm-chips">${Object.entries(RACES).map(([k, r]) => `<button class="adm-chip ${(p.look && (p.look.race || 'humano')) === k ? 'on' : ''}" data-race="${k}">${r.icon} ${r.name}</button>`).join('')}</div>
      <div class="adm-chips" style="margin-top:6px"><button class="adm-chip" data-barber="1">💈 Barbearia: rosto, cabelo, cor e barba (com o boneco ao vivo)</button></div>
    </div>
    <div class="adm-card"><div class="adm-card-h">🐾 Mascote <span class="muted" style="font-weight:400">— troque de bicho ou de evolução na hora</span></div>
      ${Object.entries(PETS).map(([k, pe]) => `<div class="adm-tier"><span class="adm-tier-n">${pe.roleIcon} ${pe.roleName}</span><div class="adm-classgrid">${pe.stages.map((sg, si) => { const on = p.pet && p.pet.species === k && petInfo(p.pet).stage === si; return `<button class="adm-class ${on ? 'on' : ''}" data-petset="${k}" data-st="${si}" title="${escH(sg.name)} — Nv. ${PET_EVOLVE[si]}"><span>${sg.icon}</span>${escH(sg.name)}</button>`; }).join('')}</div></div>`).join('')}
    </div>
    <div class="adm-card"><div class="adm-card-h">🛠️ Atalhos de mestre</div>
      <div class="adm-chips">
        <button class="adm-chip" data-cmd="cura">❤️ Curar tudo</button><button class="adm-chip" data-cmd="lv1">⭐ +1 Nível Base</button><button class="adm-chip" data-cmd="lv5">⭐ +5 Níveis Base</button>
        <button class="adm-chip" data-cmd="job1">✦ +1 Nível Classe</button><button class="adm-chip" data-cmd="job10">✦ +10 Níveis Classe</button><button class="adm-chip" data-cmd="zeny">💰 +10.000 z</button>
        <button class="adm-chip" data-cmd="rate">📈 EXP ${CONFIG.EXP_RATE}× (trocar)</button>
        ${p.pet ? '<button class="adm-chip" data-pet="1">🐾 Mascote +5 níveis</button>' : ''}<button class="adm-chip" data-aur="1">✦ +1.000 Auroras (teste)</button></div>
    </div>`;
  body.querySelector('#adm-god').onclick = () => toggleGod();
  body.querySelectorAll('[data-cls]').forEach(el => el.onclick = () => ADMIN.setClass(el.dataset.cls));
  body.querySelectorAll('[data-cmd]').forEach(el => el.onclick = () => ADMIN.cmd(el.dataset.cmd));
  body.querySelectorAll('[data-race]').forEach(el => el.onclick = () => { p.look = { ...(p.look || {}), race: el.dataset.race }; buildPlayerModel(); save3d(); log(`🧬 Raça trocada: ${RACES[el.dataset.race].name}.`, 'sys'); adminRender(); });
  body.querySelectorAll('[data-barber]').forEach(el => el.onclick = () => { UI.close('admin'); showCreate3d([], { edit: true, look: normalizeLook(p.look), cls: p.cls }); });
  body.querySelectorAll('[data-aur]').forEach(el => el.onclick = () => { cosm().auroras += 1000; log('✦ +1.000 Auroras (teste do mestre).', 'sys'); UI.markDirty(); save3d(); });
  body.querySelectorAll('[data-petset]').forEach(el => el.onclick = () => { H3.setPet(el.dataset.petset, +el.dataset.st, true); adminRender(); });
  body.querySelectorAll('[data-pet]').forEach(el => el.onclick = () => { for (let i = 0; i < 5; i++) petExpGain(petExpNext(p.pet.lv) * 2); hudDirty = true; UI.markDirty(); });
  body.querySelectorAll('[data-poi]').forEach(el => el.onclick = () => { const o = pois[+el.dataset.poi]; UI.close('admin'); teleport3d(o.x, o.z); log(`Teleportado: ${o.label}`); });
  const cv = body.querySelector('#adm-map3d');
  const toWorld = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width * 2 - 1) * HALF, z: ((e.clientY - r.top) / r.height * 2 - 1) * HALF }; };
  cv.onmousemove = e => { admHover = toWorld(e); drawAdmMap(cv, true); const zn = zoneAt(admHover.x, admHover.z), lim = Math.abs(admHover.x) > PLAY_LIMIT || Math.abs(admHover.z) > PLAY_LIMIT; $('adm-info').innerHTML = `<b>${zn.name}</b> <span class="muted">${zn.lvl}</span> · (${Math.round(admHover.x)}, ${Math.round(admHover.z)})${lim ? ' · <span style="color:#ffb070">fora da área jogável — você aparece na borda</span>' : ''}`; };
  cv.onmouseleave = () => { admHover = null; drawAdmMap(cv, true); $('adm-info').textContent = 'Passe o mouse no mapa e clique para ir'; };
  cv.onclick = e => { const w = toWorld(e); UI.close('admin'); teleport3d(w.x, w.z); log(`Teleportado para (${Math.round(w.x)}, ${Math.round(w.z)}).`); };
  drawAdmMap(cv, true);
}
/* S-176: onde fazer cada missão — pontos no mapa (NPC para falar/entregar, regiões dos monstros ou de quem deixa cair o item) */
function zonePos(zoneId) { const z = ZONES.find(q => q.id === zoneId); if (z) return { x: z.x, z: z.z, name: z.name }; const I = INTERIORS[zoneId]; if (I && I.door) return { x: I.door.x, z: I.door.z, name: I.name || zoneId }; return null; }
function questTargets(id) {
  const q = QUESTS[id], p = S.p; if (!q) return [];
  const pr = questProgress(p, id), ready = pr && pr.every(x => x.have >= x.need), out = [];
  const npcAt = nid => { const n = S.npcs.find(x => x.id === nid); if (!n) return null; if (Math.abs(n.x) > HALF + 50) { const I = Object.values(INTERIORS).find(I => Math.abs(n.x - I.x) < (I.w || 40) && Math.abs(n.z - I.z) < (I.d || 40)); return I && I.door ? { x: I.door.x, z: I.door.z, name: n.name } : null; } return { x: n.x, z: n.z, name: n.name }; };
  if (ready) { const t = npcAt(q.turnIn); if (t) out.push({ ...t, kind: '?', label: `Entregar: ${t.name}` }); return out; }
  for (const x of pr) { if (x.have >= x.need) continue; const o = x.o;
    if (o.talk) { const t = npcAt(o.talk); if (t) out.push({ ...t, kind: '!', label: `Falar com ${t.name}` }); }
    const mons = o.kill ? [o.kill] : o.collect ? Object.keys(MONSTERS).filter(mid => (MONSTERS[mid].drops || []).some(d => d[0] === o.collect)) : [];
    const zones = new Set(); for (const [zid, mid] of SPAWNS) if (mons.includes(mid)) zones.add(zid);
    for (const zid of zones) { const zp = zonePos(zid); if (zp) out.push({ ...zp, kind: '⚔', label: `${o.kill ? MONSTERS[o.kill].name : ITEMS[o.collect].name} · ${zp.name}` }); }
  }
  return out;
}
function drawAdmMap(cv, clean) { // clean (S-232): no Painel do Mestre só o mapa, sem NPCs, missões nem marcadores
  const c = cv.getContext('2d'), W = cv.width, pt = (x, z) => [(x / HALF + 1) / 2 * W, (z / HALF + 1) / 2 * W];
  c.imageSmoothingEnabled = true; c.drawImage(worldMap, 0, 0, W, W);
  // vinheta suave nas bordas
  const v = c.createRadialGradient(W / 2, W / 2, W * 0.38, W / 2, W / 2, W * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,8,4,0.55)');
  c.fillStyle = v; c.fillRect(0, 0, W, W);
  const label = (txt, x, y, size, col) => { c.font = `700 ${size}px Cinzel, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(20,14,4,0.85)'; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y); };
  for (const z of ZONES) { const [x, y] = pt(z.x, z.z); label(z.name, x, y - 22, 15, '#ffe9a8'); c.font = '11px Nunito'; c.fillStyle = '#e8dcc0'; c.fillText(z.lvl, x, y - 6); }
  if (!clean) for (const m of S.monsters) if (!m.dead && (m.def.mini || m.def.boss)) { const [x, y] = pt(m.x, m.z); c.font = '15px sans-serif'; c.fillText(m.def.boss ? '👑' : '💀', x, y); }
  if (!clean) for (const n of S.npcs) { if (Math.abs(n.x) > HALF) continue; const [x, y] = pt(n.x, n.z); c.fillStyle = '#ffe36a'; c.font = '13px sans-serif'; c.fillText('★', x, y); }
  // S-176: marcadores das missões ativas (a selecionada pisca)
  if (!clean && S.p && typeof QUESTS !== 'undefined') { const act = Object.keys(questState(S.p).active), selQ = UI.qSel || act[0];
    for (const qid of act) for (const tg of questTargets(qid)) { const [x, y] = pt(tg.x, tg.z), on = qid === selQ, pulse = on ? 1 + Math.sin(performance.now() / 200) * 0.25 : 1;
      c.fillStyle = on ? 'rgba(255,216,74,0.30)' : 'rgba(255,216,74,0.14)'; c.beginPath(); c.arc(x, y, (tg.kind === '⚔' ? 22 : 12) * pulse, 0, 7); c.fill();
      c.font = `900 ${on ? 18 : 14}px Cinzel, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(20,14,4,0.9)'; c.strokeText(tg.kind, x, y); c.fillStyle = '#ffd84a'; c.fillText(tg.kind, x, y);
      if (on) { c.font = '700 11px Nunito'; c.strokeText(tg.label, x, y + 18); c.fillStyle = '#fff3c4'; c.fillText(tg.label, x, y + 18); } } }
  const MP = S.interior ? S.interior.back : S.pos; const [px, py] = pt(MP.x, MP.z);
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
  await loadHumans(k => { const t = $('ld-txt'); if (t) t.textContent = 'Carregando personagens… ' + k; }); // corpos realistas (Quaternius, CC0)
  friendlyFaces(MODELS);
  buildWorld();
  terrainNear(VILLAGE.x, VILLAGE.z, 130); // detalhe em volta da vila (tela inicial e começo do jogo)
  spawnNpcs();
  for (const [zone, type, n] of SPAWNS) for (let i = 0; i < n; i++) spawnMonster(zone, type);
  for (const [dx, dz] of [[-5, 13], [-1.5, 14.5], [2, 13]]) spawnMonster('vila', 'boneco_treino', { x: VILLAGE.x + dx, z: VILLAGE.z + dz }); // bonecos de treino (S-090)
  buildMinimap();
  installIntegration();
  $('mm-in').onclick = () => zoomMinimap(1); $('mm-out').onclick = () => zoomMinimap(-1);
  $('minimap').style.cursor = 'pointer'; $('minimap').title = 'Abrir o mapa (G)'; $('minimap').onclick = () => UI.toggle('mapa');
  $('loading3d').classList.add('hidden');
  window.__S3 = S; window.__api = { groundAt, renderer, MODELS, dressLook, dressHead: (ch, cls, head) => dress(ch, cls, MODELS, head), applyRace, shot: (p, l, W = 960, H = 540) => { // para testes: foto de qualquer ângulo
    const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 900); cam.position.set(...p); cam.lookAt(...l);
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace; renderer.setRenderTarget(rt); renderer.render(scene, cam);
    const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); renderer.setRenderTarget(null); rt.dispose();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); g.putImageData(img, 0, 0); return cv.toDataURL('image/jpeg', 0.85); }, makeChar, dressAs: (ch, cls) => dress(ch, cls, MODELS, "Knight"), CLASS_LOOKS, scene, camera, buildPet, petExpGain, updatePet, talk, interact, trySkill, tabTarget, pick, toScreen, fbPick, fbArea, teleport3d, useSlot }; // para testes
  chooseCharacter();
})();
