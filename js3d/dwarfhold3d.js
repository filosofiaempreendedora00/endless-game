/* =========================================================================
   PEDRAFUNDA, A FORTALEZA SOB OS PICOS — etapa 1 (2026-11-13)
   Pedido do Roberto: "algo bem foda e característico", inspirado no que a literatura de fantasia diz dos anões
   (eles moram DENTRO da montanha, constroem tudo colossal, veneram os ancestrais, vivem do fogo e do metal).
   Aqui ficam:
   • a Fachada dos Reis: o paredão do norte esculpido (80 × 50 m), com pilastras chanfradas, cornijas
     com dentículos, frisos de runas, o emblema da bigorna e o portão trapezoidal de bronze com o selo rúnico;
   • os dois Reis de pedra (24 m) — anões de verdade do jogo posados e transformados em pedra (ctx.stoneHero);
   • as cascatas de lava que descem da fachada para bacias e o elevador de corrente com a gaiola subindo e descendo;
   • as moradas escavadas no paredão em volta da cidade (portas, janelas acesas, sacadas);
   • as canaletas de lava (com grelhas de ferro) ao longo da rua principal.
   Tudo original: nenhum nome, cena ou desenho de livro ou filme.
   ========================================================================= */
import * as THREE from 'three';
import { vlight } from './lights3d.js';
import { heightAt } from './world3d.js';
import { addLevel } from './levels3d.js';

const TAU = Math.PI * 2;
export const LAVA_T = { value: 0 };
let _lava = null;
// lava que corre: brilho com crosta escura que se move (nas cascatas desce, nas canaletas corre pela canaleta)
export function lavaMat() {
  if (_lava) return _lava;
  const m = new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a08', emissiveIntensity: 1.7, roughness: 0.55 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = LAVA_T;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLW; varying vec3 vLN;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uT; varying vec3 vLW; varying vec3 vLN;
float lh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ln(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lh(i), lh(i + vec2(1, 0)), f.x), mix(lh(i + vec2(0, 1)), lh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { bool fall = abs(vLN.y) < 0.55; vec2 q = fall ? vec2((vLW.x + vLW.z) * 0.6, vLW.y * 0.35 + uT * 1.6) : vec2(vLW.x * 0.45, vLW.z * 0.45 + uT * 0.25);
    float n = ln(q * 1.6) * 0.6 + ln(q * 4.1 + 3.0) * 0.4, crust = smoothstep(0.55, 0.75, n);
    totalEmissiveRadiance *= mix(1.25, 0.18, crust); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.05, 0.03), crust * 0.85); }`);
  };
  return (_lava = m);
}
// pilar de seção chanfrada (octógono alongado) — a "coluna" dos anões: reta, pesada, sem a curva grega
export function chamferPillar(w, d, h, c = 0.3) {
  const s = new THREE.Shape(), x = w / 2, z = d / 2; s.moveTo(-x + c, -z); s.lineTo(x - c, -z); s.lineTo(x, -z + c); s.lineTo(x, z - c); s.lineTo(x - c, z); s.lineTo(-x + c, z); s.lineTo(-x, z - c); s.lineTo(-x, -z + c); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; // de y = 0 até h
}
// moldura trapezoidal (o portão anão: mais largo embaixo), extrudada para a frente
function trapFrame(wb, wt, h, t, depth) {
  const s = new THREE.Shape(); s.moveTo(-wb / 2 - t, 0); s.lineTo(wb / 2 + t, 0); s.lineTo(wt / 2 + t, h + t); s.lineTo(-wt / 2 - t, h + t); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-wb / 2, 0); hole.lineTo(-wt / 2, h); hole.lineTo(wt / 2, h); hole.lineTo(wb / 2, 0); hole.closePath(); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}
function trapSolid(wb, wt, h, depth, x0 = -wb / 2, x1 = wb / 2) { // folha de porta (meia trapézio quando x0/x1 cortam no meio)
  const s = new THREE.Shape(), xt = v => v * (wt / wb); s.moveTo(x0, 0); s.lineTo(x1, 0); s.lineTo(xt(x1), h); s.lineTo(xt(x0), h); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

// fio de lava caindo: fita que se alarga embaixo e ondula (nada de tábua reta)
function lavaRibbon(h) { const g = new THREE.PlaneGeometry(2.2, h, 8, 60), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), v = 0.5 - y / h; P.setX(i, x * (0.55 + v * 0.75) + Math.sin(y * 0.45) * 0.25); P.setZ(i, Math.sin(y * 0.7 + x * 2.0) * 0.18 + (x * x) * -0.25 + v * v * 0.9); } g.computeVertexNormals(); return g; }
/* ---------------- a Fachada dos Reis ---------------- */
// H: { C, base, Kit, M, runeGlyph, addDeck, put, brazier, makeBanner } — ajudantes do cities3d; FZ = z (local da cidade) da frente da fachada; PY = altura da plataforma
export function buildKingsGate(ctx, H, { FZ = -64, PY = 6.6, PD = 15, PW = 60 } = {}) {
  const { C, base, Kit, M, runeGlyph, addDeck, put, brazier, makeBanner } = H, st = M.dwarfStone(), cv = M.dwarfCarve(), Y = base + PY;
  const GW = 12, GT = 8.6, GH = 17; // portão: largura embaixo, em cima, altura
  const K = new Kit();
  // maciço da fachada (a frente fica em z = 0; o fundo entra na montanha)
  K.box(84, 52, 12, cv, 0, 24, -6); // pedra lavrada em blocos grandes (o tijolo miúdo parecia muralha de castelo)
  for (let k = 0; k < 3; k++) K.box(84 - k * 10, 3, 12 - k * 2.5, cv, 0, 51 + k * 3, -6 - k * 1.2); // coroa em degraus
  // cornijas com dentículos e frisos de runas
  for (const y of [19.5, 37.5]) { K.box(86, 1.4, 1.8, cv, 0, y, 0.6); for (let x = -42; x <= 42; x += 1.4) K.box(0.6, 0.6, 0.5, cv, x, y - 0.95, 1.2); }
  for (let k = 0; k < 40; k++) { const x = -39 + k * 2; if (Math.abs(x) < GT / 2 + 3) continue; runeGlyph(K, x, 21.7, 0.08, 1.1, k * 3 + 1); }
  // faixa de "nó" angular (chevrons) entre as cornijas de cima — o ornamento geométrico dos anões
  for (let x = -40; x <= 40; x += 2.4) for (const s of [-1, 1]) K.box(0.42, 2.2, 0.35, cv, x + s * 0.55, 42.2, 0.2, 0, 0, s * 0.785);
  K.box(84, 0.5, 0.4, cv, 0, 40.6, 0.25); K.box(84, 0.5, 0.4, cv, 0, 43.8, 0.25);
  // pilastras chanfradas (dos lados das estátuas e nas pontas), com base e capitel em degraus
  for (const x of [-38, -26, 26, 38]) { K.add(chamferPillar(3.2, 1.6, 50, 0.45), cv, x, 0, 0.6); for (let k = 0; k < 3; k++) { K.box(4.2 - k * 0.4, 0.6, 2.4 - k * 0.3, cv, x, 0.3 + k * 0.6, 0.7); K.box(4.2 - k * 0.4, 0.6, 2.4 - k * 0.3, cv, x, 49.6 - k * 0.6, 0.7); } }
  // nichos das estátuas (fundo escuro, moldura trapezoidal em degraus)
  for (const sx of [-1, 1]) { const nx = sx * 16.75; K.add(trapSolid(13.2, 10.2, 33.4, 0.3), plainDark(M), nx, 0, 0.05);
    for (let k = 0; k < 3; k++) K.add(trapFrame(14 + k * 0.9, 11 + k * 0.9, 34 + k * 0.6, 0.45, 0.5 + k * 0.25), cv, nx, 0, 0.15); }
  // o portão: três molduras em degraus, as folhas de bronze, o selo de runas e o emblema da bigorna em cima
  for (let k = 0; k < 4; k++) K.add(trapFrame(GW + k * 1.3, GT + k * 1.3, GH + k * 0.9, 0.65, 1.0 + k * 0.45), cv, 0, 0, 0); // molduras em degraus (as de fora avançam mais)
  // etapa 2: o portão ABERTO — as folhas de bronze escancaradas para fora e, no vão, a luz quente do Grande Salão
  { const gg = trapSolid(GW, GT, GH, 0.1), uv = gg.attributes.uv, P = gg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (P.getX(i) + GW / 2) / GW, P.getY(i) / GH); K.add(gg, hallGlow(), 0, 0, 0.12); }
  for (const s of [-1, 1]) { const g = trapSolid(GW, GT, GH, 0.5, s < 0 ? -GW / 2 : 0.04, s < 0 ? -0.04 : GW / 2); g.translate(-s * GW / 2, 0, 0); // dobradiça na origem
    const KD = new Kit(); KD.add(g, bronze()); for (let k = 0; k < 6; k++) KD.box(GW / 2 - 0.8, 0.35, 0.2, M.iron(), -s * (GW / 4), 1.5 + k * 2.8, 0.55);
    const d = KD.build(); d.position.set(C.x + s * GW / 2, Y, C.z + FZ + 0.4); d.rotation.y = s < 0 ? -1.95 : 1.95; ctx.scene.add(d); d.userData.asset = 'portao_dos_reis'; }
  { const ey = GH + 6.5; K.add(new THREE.CylinderGeometry(5.2, 5.2, 1.2, 6), cv, 0, ey, 0.6, 0, Math.PI / 2, Math.PI / 6); K.add(new THREE.TorusGeometry(4.4, 0.16, 6, 6), M.rune(), 0, ey, 1.25, 0, 0, Math.PI / 6);
    // bigorna (perfil de verdade) e dois martelos cruzados, em relevo
    const an = new THREE.Shape(); an.moveTo(-2.4, 0.9); an.lineTo(1.6, 0.9); an.quadraticCurveTo(2.9, 0.9, 3.1, 0.3); an.lineTo(1.2, 0.0); an.lineTo(0.8, -0.6); an.lineTo(1.4, -1.6); an.lineTo(-1.6, -1.6); an.lineTo(-1.0, -0.6); an.lineTo(-1.6, 0.0); an.lineTo(-2.4, 0.2); an.closePath();
    K.add(new THREE.ExtrudeGeometry(an, { depth: 0.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08 }), M.iron(), 0, ey - 0.6, 1.2);
    for (const s of [-1, 1]) { K.box(0.32, 5.0, 0.3, M.darkWood(), s * 1.2, ey + 1.4, 1.5, 0, 0, s * 0.55); K.box(1.8, 0.9, 0.7, M.iron(), s * 2.4, ey + 3.4, 1.6, 0, 0, s * 0.55); } }
  // braseiros enormes dos dois lados do portão e a luz da lava/runas
  // cascatas de lava das "bocas" esculpidas para as bacias (lados de fora)
  const LV = new Kit();
  for (const sx of [-1]) { const x = sx * 32; K.add(trapFrame(3.4, 2.6, 2.6, 0.5, 2.0), cv, x, 30, 0.3); K.box(3.4, 2.6, 0.3, plainDark(M), x, 31.3, 0.05); // a leste fica o elevador
    LV.add(lavaRibbon(30), lavaMat(), x, 15.2, 1.85); LV.box(2.8, 0.5, 2.4, lavaMat(), x, 30.1, 1.1);
    K.box(8, 1.6, 6, cv, x, 0.8, 3.0); LV.box(6.8, 0.2, 4.8, lavaMat(), x, 1.45, 3.0); for (let k = 0; k < 5; k++) K.box(7.2, 0.25, 0.25, M.iron(), x, 1.75, 0.9 + k * 1.05); } // bacia com grelha de ferro por cima
  // o elevador de corrente (lado leste): trilhos esculpidos, sacada lá no alto e a gaiola que sobe e desce
  const EX = 32; K.box(0.7, 34, 0.8, cv, EX - 1.7, 17, 0.9); K.box(0.7, 34, 0.8, cv, EX + 1.7, 17, 0.9);
  K.box(6, 0.6, 3.6, cv, EX, 33.7, 1.8); K.box(6, 1.0, 0.3, cv, EX, 34.5, 3.5); for (const s of [-1, 1]) K.box(0.3, 1.0, 3.6, cv, EX + s * 2.85, 34.5, 1.8);
  K.add(new THREE.CylinderGeometry(0.9, 0.9, 3.6, 20), M.iron(), EX, 36.6, 1.2, 0, 0, Math.PI / 2); // sarilho lá em cima
  const g = put(ctx, K, 'fachada_dos_reis', C.x, C.z + FZ, 0, { y: Y, occ: true }); g.userData.far = 900;
  const lv = LV.build(); lv.position.set(C.x, Y, C.z + FZ); ctx.scene.add(lv);
  const cage = new THREE.Group(); { const KC = new Kit(); KC.box(2.6, 0.2, 2.6, M.iron(), 0, 0, 0); KC.box(2.6, 0.2, 2.6, M.iron(), 0, 2.6, 0); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) KC.box(0.12, 2.6, 0.12, M.iron(), a * 1.25, 1.3, b * 1.25); for (let k = 0; k < 7; k++) { KC.box(0.04, 2.4, 0.04, M.iron(), -1.2 + k * 0.4, 1.3, 1.27); KC.box(0.04, 2.4, 0.04, M.iron(), -1.2 + k * 0.4, 1.3, -1.27); } KC.box(1.8, 0.5, 1.2, M.darkWood(), 0, 0.35, 0); cage.add(KC.build()); }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), M.iron()); cage.add(chain);
  ctx.scene.add(cage); const CX = C.x + EX, CZ = C.z + FZ + 1.6;
  cage.userData.update = t => { const k = 0.5 - 0.5 * Math.cos(t * 0.18), y = Y + 0.3 + k * 31; cage.position.set(CX, y, CZ); chain.scale.y = Y + 36 - y - 2.6; chain.position.y = 2.6 + chain.scale.y / 2; LAVA_T.value = t; };
  ctx.roomAnims.push(cage);
  // plataforma de pedra na frente da fachada (liga no terraço de cima da acrópole) — chão de verdade e bordas
  { const KP = new Kit(); KP.box(PW, PY, PD, st, 0, -PY / 2, PD / 2); KP.box(PW + 0.6, 0.5, PD + 0.4, cv, 0, -0.25, PD / 2); for (let k = 0; k < Math.floor(PW / 3); k++) runeGlyph(KP, -PW / 2 + 1.5 + k * 3, -1.6, PD + 0.22, 0.6, k * 5 + 3);
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) KP.box(1.2, 1.0, 1.2, cv, sx * (PW / 2 - 0.6), 0.5, 1 + k * 2.6); // muretas nas laterais
    put(ctx, KP, 'plataforma_dos_reis', C.x, C.z + FZ, 0, { y: Y, occ: false });
    addDeck({ x: C.x, z: C.z + FZ, yaw: 0, w: PW, len: PD, y: Y, tag: 'pedrafunda' });
    const edge = (x0, x1, zz) => { const cx = (x0 + x1) / 2, hx = (x1 - x0) / 2; ctx.colliders.push({ x: C.x + cx, z: C.z + FZ + zz, r: Math.max(hx, 0.6), box: true, hx, hz: 0.6, rot: 0, name: 'plataforma_dos_reis' }); };
    edge(-PW / 2, -17.6, PD); edge(17.6, PW / 2, PD); // frente da plataforma (fora do terraço) — o terraço da acrópole tem 34 m (x ±17)
    for (const sx of [-1, 1]) ctx.colliders.push({ x: C.x + sx * PW / 2, z: C.z + FZ + PD / 2, r: PD / 2, box: true, hx: 0.7, hz: PD / 2, rot: 0, name: 'plataforma_dos_reis' });
    ctx.colliders.push({ x: C.x, z: C.z + FZ - 3.5, r: 42, box: true, hx: 42, hz: 3.4, rot: 0, name: 'fachada_dos_reis' });
    ctx.colliders.push({ x: C.x - 32, z: C.z + FZ + 3, r: 4, box: true, hx: 4, hz: 3, rot: 0, name: 'bacia_de_lava' }); ctx.colliders.push({ x: C.x + 32, z: C.z + FZ + 1.6, r: 2.2, box: true, hx: 2.2, hz: 1.6, rot: 0, name: 'elevador' }); }
  // os dois Reis de pedra nos pedestais, olhando a cidade
  { const kings = [{ id: 'rei_pedra_o', name: 'Rei de Pedra', model: 'Barbarian', show: ['2H_Axe'], look: { race: 'anao', face: 'valente', hair: { style: 'longo', color: 'grisalho' }, beard: true } },
      { id: 'rei_pedra_l', name: 'Rei de Pedra', model: 'Knight', show: ['2H_Sword', 'Knight_Helmet'], hat: true, look: { race: 'anao', face: 'sereno', hair: { style: 'longo', color: 'grisalho' }, beard: true } }];
    for (const [i, sx] of [-1, 1].entries()) { const KP = new Kit(); KP.box(9, 5, 8, cv, 0, 2.5, 0); KP.box(9.8, 0.6, 8.8, cv, 0, 0.3, 0); KP.box(9.6, 0.6, 8.6, cv, 0, 4.9, 0); for (let k = 0; k < 7; k++) runeGlyph(KP, -3 + k, 3.3, 4.05, 0.7, k * 9 + i);
      const px = sx * 16.75, pz = 5.5; put(ctx, KP, 'pedestal_do_rei', C.x + px, C.z + FZ + pz, 0, { y: Y, box: [[0, 0, 4.9, 4.4]] });
      if (ctx.stoneHero) { const s = ctx.stoneHero(kings[i], { scale: 17.5, anim: 'Idle', t: 0.5 + i * 0.4 }); s.position.set(C.x + px, Y + 5.2, C.z + FZ + pz - 0.8); s.rotation.y = -sx * 0.12; ctx.scene.add(s); s.userData.asset = 'rei_de_pedra'; s.userData.big = true; ctx.placed.push(s); } } }
  for (const sx of [-1, 1]) { brazier(ctx, C.x + sx * 8.6, Y, C.z + FZ + 4, true, sx * 3); const b = makeBanner('anao', 3.4, 12); b.position.set(C.x + sx * 7.5, Y + 33, C.z + FZ + 1.5); ctx.scene.add(b); }
  for (const [x, y, c, i] of [[0, 8.5, '#ff8a3a', 5], [-32, 4, '#ff5a10', 6], [24, 10, '#ffb070', 3]]) { const L = vlight(c, i, 26, 1.4); L.position.set(C.x + x, Y + y, C.z + FZ + 4); ctx.scene.add(L); }
  return { gate: { x: C.x, z: C.z + FZ + 4.5, y: Y } };
}
let _glowH = null; function hallGlow() { // o vão do portão aberto: escuro em cima, luz quente subindo do chão (profundidade, não parede laranja)
  if (_glowH) return _glowH; const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#000000'); gr.addColorStop(0.45, '#120804'); gr.addColorStop(0.8, '#5a2a0c'); gr.addColorStop(1, '#c8641e'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(6 + k * 12, 60, 4, 196); } // silhuetas dos pilares lá dentro
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_glowH = new THREE.MeshBasicMaterial({ map: t })); }
let _bronze = null; function bronze() { return _bronze || (_bronze = new THREE.MeshStandardMaterial({ color: '#7a5a32', metalness: 0.7, roughness: 0.42 })); }
let _warm = null; function warmDoor() { return _warm || (_warm = new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ff9a40', emissiveIntensity: 1.1, roughness: 0.8 })); }
let _dark = null; function plainDark(M) { return _dark || (_dark = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 1 })); }

/* ---------------- terraços talhados no paredão (as moradas dos clãs) ---------------- */
// Cada terraço é um bloco de pedra lavrada cuja frente fica TODA no ar e cujo fundo entra na montanha:
// portas acesas no térreo, janelas no andar de cima, passarela com mureta e mísulas, cornija com runas e estandartes.
// (A 1ª versão pendurava casinhas soltas na encosta e elas pareciam caixas coladas.)
export function buildCliffDwellings(ctx, H, { spots } = {}) {
  const { C, base, Kit, M, put, runeGlyph, makeBanner } = H, cv = M.dwarfCarve(), st = M.dwarfStone(), K = new Kit();
  const m4 = new THREE.Matrix4(), mp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  let T = null; const part = (geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) => { mp.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), one); const g = geo.clone(); g.applyMatrix4(mp); g.applyMatrix4(T); K.add(g, mat); };
  const box = (w, h, d, mat, x, y, z, ry, rx, rz) => part(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, rx, rz);
  const glass = M.glass(), out = [];
  for (const [deg, yW, W] of spots || [[160, 12, 30], [198, 24, 26], [232, 14, 24], [308, 16, 24], [342, 26, 26], [18, 12, 30]]) {
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    let d = 0; for (let dd = 66; dd < 140; dd += 0.25) { if (heightAt(C.x + ca * dd, C.z + sa * dd) - base >= yW - 1) { d = dd; break; } }
    if (!d) continue;
    const HH = 13, ry = Math.atan2(-ca, -sa), x = ca * d, z = sa * d;
    T = new THREE.Matrix4().compose(v.set(x, yW, z), q.setFromEuler(e.set(0, ry, 0, 'YXZ')), one);
    // o muro de arrimo desce até a encosta mais baixa sob o bloco (a rocha varia ao longo da largura: antes uma ponta ficava no ar)
    let low = 0; for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) { const px = x + Math.cos(ry) * u * W, pz = z - Math.sin(ry) * u * W; for (const f of [0, 2.5]) low = Math.min(low, heightAt(C.x + px - ca * f, C.z + pz - sa * f) - base - yW); }
    const dn = Math.min(40, 3 - low);
    box(W, HH + dn, 16, cv, 0, (HH + dn) / 2 - dn, -8); // o bloco e o muro de arrimo embaixo, que entra na encosta
    box(W + 1.2, 1.0, 1.4, cv, 0, HH + 0.2, 0.3); for (let k = 0; k < Math.floor(W / 1.3); k++) box(0.5, 0.5, 0.4, cv, -W / 2 + 0.65 + k * 1.3, HH - 0.55, 0.85); // cornija com dentículos
    for (let k = 0; k < 3; k++) box(W + 1.2 - k * 1.0, 0.7, 1.6 - k * 0.3, cv, 0, HH + 0.9 + k * 0.7, -0.2 - k * 0.5); // coroa em degraus
    const nD = Math.max(2, Math.floor(W / 7));
    for (let k = 0; k < nD; k++) { const px = -W / 2 + (k + 0.5) * W / nD;
      box(2.2, 3.0, 0.12, warmDoor(), px, 1.5, 0.04); for (const s of [-1, 1]) box(0.45, 3.2, 0.5, cv, px + s * 1.3, 1.6, 0.2); for (let j = 0; j < 3; j++) box(3.2 - j * 0.6, 0.4, 0.6, cv, px, 3.4 + j * 0.4, 0.25); // porta acesa com lintel em degraus
      for (const s of [-1, 1]) { const wx = px + s * 2.1; box(1.1, 1.6, 0.1, glass, wx, 7.4, 0.04); box(1.5, 0.25, 0.4, cv, wx, 6.5, 0.2); box(1.5, 0.3, 0.4, cv, wx, 8.35, 0.2); box(0.08, 1.6, 0.14, M.iron(), wx, 7.4, 0.1); } // janelas do andar de cima
      if (k < nD - 1) { const lx = px + W / nD / 2; box(1.1, HH, 0.9, st, lx, HH / 2, 0.35); for (let j = 0; j < 2; j++) box(1.5 - j * 0.2, 0.4, 1.2, cv, lx, 0.2 + j * 0.4, 0.4); } } // pilastras entre as casas
    box(W + 1.0, 0.6, 3.2, cv, 0, -0.3, 1.6); box(W + 1.0, 1.0, 0.4, cv, 0, 0.5, 3.0); for (const s of [-1, 1]) box(0.4, 1.0, 3.2, cv, s * (W / 2 + 0.3), 0.5, 1.6); // passarela com mureta
    for (let k = 0; k < Math.floor(W / 3); k++) box(0.8, 2.4, 1.6, cv, -W / 2 + 1.5 + k * 3, -1.7, 2.0, 0, -0.55); // mísulas sob a passarela
    out.push({ x: C.x + x + ca * -2, z: C.z + z + sa * -2, y: base + yW, ry });
  }
  const g = put(ctx, K, 'terracos_dos_clas', C.x, C.z, 0, { y: base, occ: false }); g.userData.far = 900;
  for (const o of out) { const b = makeBanner('anao', 1.6, 5); b.position.set(o.x, o.y + 11.5, o.z); b.rotation.y = o.ry; ctx.scene.add(b); }
  return out.length;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- canaletas de lava da rua principal ---------------- */
export function buildLavaChannels(ctx, H, { x = 4.6, z0 = 30, z1 = 54 } = {}) {
  const { C, base, Kit, M, put } = H, K = new Kit(), cv = M.dwarfCarve(), L = z1 - z0;
  for (const sx of [-1, 1]) { const cx = sx * x;
    K.box(0.35, 0.35, L, cv, cx - 0.55, 0.12, z0 + L / 2); K.box(0.35, 0.35, L, cv, cx + 0.55, 0.12, z0 + L / 2); // meio-fio
    K.box(0.75, 0.1, L, lavaMat(), cx, 0.0, z0 + L / 2);
    for (let z = z0 + 0.3; z < z1; z += 0.55) K.box(0.9, 0.06, 0.1, M.iron(), cx, 0.27, z); } // grelha de ferro por cima (dá para pisar)
  put(ctx, K, 'canaletas_de_lava', C.x, C.z, 0, { y: base, occ: false });
  for (const z of [z0 + 6, z1 - 6]) { const L2 = vlight('#ff5a10', 2.2, 9, 1.6); L2.position.set(C.x, base + 0.6, C.z + z); ctx.scene.add(L2); }
}

/* =========================================================================
   ETAPA 2 — O GRANDE SALÃO SOB A MONTANHA (por trás do portão dos Reis)
   Sala de 56 × 96 m e 30 m de pé-direito, em penumbra quente (I.mood):
   • fileiras de pilares colossais chanfrados com runas acesas e capitéis em degraus que se abrem no teto;
   • o ABISMO atravessando o salão de lado a lado, com lava lá no fundo e cascatas nas paredes — e uma ponte estreita
     sem corrimão (a beirada tem uma barreira invisível: ninguém cai, mas a vertigem é de verdade);
   • a Grande Forja: fornalha acesa, bigorna gigante e o martelo-pilão movido por uma roda dentada (bate de verdade);
   • trilhos de minério com a vagoneta indo e voltando; o salão de festa com mesas compridas, bancos e barris;
   • o trono do Rei-Sob-a-Pedra no alto de uma escadaria, entre dois ancestrais de pedra.
   ========================================================================= */
export function buildGreatHall(ctx, H, { id = 'grande_salao', x: IX = 2700, z: IZ = 0 } = {}) {
  const { Kit, M, runeGlyph, makeBanner } = H, cv = M.dwarfCarve(), st = M.dwarfStone(), iron = M.iron(), wd = M.darkWood();
  const W = 56, D = 96, HT = 30, hw = W / 2, hd = D / 2, CH = { z0: 6, z1: 22 }; // abismo de z = 6 a 22 (local)
  const I = { name: 'Grande Salão de Pedrafunda', x: IX, z: IZ, w: W, d: D, h: HT, region: 'Pedrafunda',
    mood: { hemi: 0.8, sky: '#ffd9a8', ground: '#4a3020', sun: 0.55, exp: 1.18, fog: '#24180f', near: 40, far: 170 } };
  ctx.INTERIORS[id] = I;
  const K = new Kit(), WK = new Kit(), LK = new Kit(), add = (kit, asset, occ) => { const g = kit.build(); g.position.set(IX, 0, IZ); ctx.scene.add(g); g.userData.asset = asset; if (occ) ctx.occluders.push(g); return g; };
  const col = (lx, lz, hx, hz, name = id) => ctx.colliders.push({ x: IX + lx, z: IZ + lz, r: Math.max(hx, hz), box: true, hx, hz, rot: 0, name });
  // ---------- chão (com o vão do abismo), paredes, teto ----------
  for (const [z0, z1] of [[-hd, CH.z0], [CH.z1, hd]]) { K.box(W, 0.6, z1 - z0, cv, 0, -0.3, (z0 + z1) / 2); for (let z = z0 + 3; z < z1; z += 6) K.box(W, 0.02, 0.12, st, 0, 0.01, z); } // lajes grandes
  K.box(3.2, 1.2, CH.z1 - CH.z0, cv, 0, -0.6, (CH.z0 + CH.z1) / 2); // a ponte: uma lâmina de pedra só
  for (let k = 0; k < 4; k++) K.box(3.4, 0.25, 0.4, cv, 0, -0.1, CH.z0 + 2 + k * 4); // juntas da ponte
  for (const z of [CH.z0, CH.z1]) { const s = z === CH.z0 ? -1 : 1; for (const [x0, x1] of [[-hw, -1.6], [1.6, hw]]) K.box(x1 - x0, 44, 1.0, st, (x0 + x1) / 2, -22.3, z + s * 0.5); } // paredes do abismo
  K.box(3.2, 44, 1.0, st, 0, -23, CH.z0 - 0.5); K.box(3.2, 44, 1.0, st, 0, -23, CH.z1 + 0.5);
  for (const sx of [-1, 1]) K.box(1.5, 46, CH.z1 - CH.z0 + 2, st, sx * (hw + 0.75), -23, (CH.z0 + CH.z1) / 2); // as paredes do salão descem até a lava (antes sobravam frestas para o vazio)
  LK.box(W, 0.5, CH.z1 - CH.z0, lavaMat(), 0, -40, (CH.z0 + CH.z1) / 2); // o rio de lava lá no fundo
  for (const sx of [-1, 1]) for (const zz of [9, 15, 19]) LK.add(lavaRibbon(36), lavaMat(), sx * (hw - 0.9), -21, zz, -sx * Math.PI / 2); // cascatas de lava nas paredes do abismo
  const HW2 = HT + 2, T = 1.5, wb = [];
  const WALL = (w, d, x, z) => { WK.box(w, HW2, d, cv, x, HW2 / 2, z); wb.push([x, z, w / 2, d / 2]); };
  WALL(W + T * 2, T, 0, -hd - T / 2); WALL(T, D, -hw - T / 2, 0); WALL(T, D, hw + T / 2, 0);
  WALL(hw - 4, T, -hw / 2 - 2, hd + T / 2); WALL(hw - 4, T, hw / 2 + 2, hd + T / 2); WK.box(8, HW2 - 12, T, cv, 0, 12 + (HW2 - 12) / 2, hd + T / 2);
  WK.box(W + 2, 1.5, D + 2, st, 0, HT + 0.75, 0); // teto
  for (let z = -hd + 6; z < hd; z += 12) WK.box(W, 2.2, 1.6, cv, 0, HT - 1.1, z); // vigas de pedra do teto
  // relevo das paredes: faixas, pilastras e portais escuros (galerias mais fundas) — o salão continua montanha adentro
  for (const sx of [-1, 1]) { const x = sx * (hw - 0.4);
    for (const y of [6, 18]) { K.box(0.8, 1.2, D, cv, x, y, 0); for (let z = -hd + 1; z < hd; z += 2.4) runeGlyph(K, x - sx * 0.42, y + 0.5, z, 0.7, Math.floor(z * 3 + y)); }
    for (let z = -hd + 10; z < hd - 6; z += 16) { if (z > CH.z0 - 4 && z < CH.z1 + 4) continue; K.add(trapSolid(6, 4.4, 9, 0.3), plainDark(M), x - sx * 0.05, 0, z, sx * -Math.PI / 2); K.add(trapFrame(6, 4.4, 9, 0.6, 0.8), cv, x - sx * 0.2, 0, z, sx * -Math.PI / 2); } }
  // ---------- pilares colossais ----------
  const pillar = (x, z) => { K.add(chamferPillar(3.4, 3.4, HT, 0.6), cv, x, 0, z); for (let k = 0; k < 3; k++) { K.box(5 - k * 0.6, 0.7, 5 - k * 0.6, cv, x, 0.35 + k * 0.7, z); K.box(4.2 + k * 1.4, 0.9, 4.2 + k * 1.4, cv, x, HT - 3.6 + k * 0.9, z); }
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (let k = 0; k < 3; k++) runeGlyph(K, x + fx * 1.72, 6.5 + k * 1.1, z + fz * 1.72, 0.8, k + Math.floor(x + z)); // runas acesas nas quatro faces
    col(x, z, 2.5, 2.5, 'pilar'); };
  for (const z of [38, 28, -4, -16, -28]) for (const sx of [-1, 1]) pillar(sx * 13, z);
  // ---------- lustres de ferro pendurados (aros com velas e uma brasa no meio) ----------
  const lights = [];
  for (const [lx, lz] of [[0, 34], [0, -10], [0, -30]]) { K.add(new THREE.TorusGeometry(2.6, 0.12, 8, 40), iron, lx, 14, lz, 0, Math.PI / 2); K.add(new THREE.TorusGeometry(1.6, 0.1, 8, 32), iron, lx, 14.6, lz, 0, Math.PI / 2);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; K.cyl(0.03, 0.03, HT - 14, iron, lx + Math.cos(a) * 1.2, 14 + (HT - 14) / 2, lz + Math.sin(a) * 1.2, 4, 0, Math.cos(a) * 0.08, -Math.sin(a) * 0.08); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; K.cyl(0.07, 0.07, 0.4, M.glass(), lx + Math.cos(a) * 2.6, 14.3, lz + Math.sin(a) * 2.6, 8); }
    K.add(new THREE.DodecahedronGeometry(0.5, 1), M.ember(), lx, 13.6, lz); lights.push([lx, 12.5, lz, '#ffb060', 5, 34]); }
  // ---------- salão de festa (perto da entrada): mesas compridas, bancos, barris e canecas ----------
  for (const sx of [-1, 1]) { const tx = sx * 6.5; K.box(2.0, 0.14, 14, wd, tx, 0.9, 36); for (const zz of [30, 36, 42]) for (const ox of [-0.8, 0.8]) K.box(0.16, 0.9, 0.16, wd, tx + ox, 0.45, zz);
    for (const ox of [-1.6, 1.6]) K.box(0.5, 0.1, 14, wd, tx + ox, 0.5, 36); for (const ox of [-1.6, 1.6]) for (const zz of [30.5, 36, 41.5]) K.box(0.4, 0.5, 0.12, wd, tx + ox, 0.25, zz);
    for (let k = 0; k < 9; k++) { const zz = 29.8 + k * 1.55, ox = (k % 2 ? 0.55 : -0.55); K.add(new THREE.CylinderGeometry(0.11, 0.1, 0.24, 14), wd, tx + ox, 1.1, zz); K.add(new THREE.TorusGeometry(0.07, 0.02, 6, 12, Math.PI), iron, tx + ox + 0.12, 1.1, zz, 0, 0, -Math.PI / 2); }
    for (let k = 0; k < 3; k++) K.add(new THREE.SphereGeometry(0.22, 12, 8), P2('roast', '#7a3a1a'), tx, 1.1, 32 + k * 4, 0, 0, 0, 1.4, 0.7, 1); // assados na mesa
    col(tx, 36, 1.0, 7.0, 'mesa'); col(tx - 1.6, 36, 0.3, 7, 'banco'); col(tx + 1.6, 36, 0.3, 7, 'banco'); }
  for (const [bx, bz] of [[-hw + 2, 30], [-hw + 2, 32.2], [-hw + 2, 34.4], [hw - 2, 30], [hw - 2, 32.2]]) { K.add(new THREE.CylinderGeometry(0.9, 0.9, 1.9, 20), wd, bx, 0.95, bz, 0, 0, Math.PI / 2); for (const o of [-0.6, 0.6]) K.add(new THREE.TorusGeometry(0.92, 0.05, 6, 24), iron, bx + o, 0.95, bz, Math.PI / 2); col(bx, bz, 1.0, 1.0, 'barril'); }
  // ---------- a Grande Forja (leste) ----------
  const FX = hw - 6, FZ = -14;
  K.box(9, 7, 6, cv, hw - 3.5, 3.5, FZ); K.box(0.3, 2.6, 5, plainDark(M), hw - 8.05, 2.0, FZ); LK.box(0.2, 2.0, 4.4, lavaMat(), hw - 8.15, 1.6, FZ); // fornalha com a boca acesa
  K.box(4, HT - 7, 4, st, hw - 3, 7 + (HT - 7) / 2, FZ); col(hw - 3.5, FZ, 4.5, 3.0, 'fornalha');
  { const an = new THREE.Shape(); an.moveTo(-2.4, 0.9); an.lineTo(1.6, 0.9); an.quadraticCurveTo(2.9, 0.9, 3.1, 0.3); an.lineTo(1.2, 0.0); an.lineTo(0.8, -0.6); an.lineTo(1.4, -1.6); an.lineTo(-1.6, -1.6); an.lineTo(-1.0, -0.6); an.lineTo(-1.6, 0.0); an.lineTo(-2.4, 0.2); an.closePath();
    const g = new THREE.ExtrudeGeometry(an, { depth: 1.4, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08 }); g.translate(0, 1.6, -0.7); K.add(g, iron, FX - 8, 0, FZ + 6, Math.PI / 2); K.box(2.4, 0.2, 2.4, cv, FX - 8, 0.1, FZ + 6); col(FX - 8, FZ + 6, 1.6, 1.4, 'bigorna'); } // a bigorna gigante (perfil de verdade)
  K.box(3.0, 1.0, 1.4, cv, FX - 4, 0.5, FZ + 10); LK.box(2.6, 0.1, 1.0, P2('water', '#3a6a7a'), FX - 4, 0.98, FZ + 10); col(FX - 4, FZ + 10, 1.5, 0.7, 'tina'); // tina de têmpera
  // martelo-pilão: armação de madeira, roda dentada girando na parede e o braço que sobe devagar e cai de uma vez sobre a bigorna
  const AX = FX - 8, AZ = FZ + 6, PX = AX + 5.8; for (const sz of [-1.6, 1.6]) { K.box(0.6, 7, 0.6, wd, PX, 3.5, AZ + sz); } K.box(0.7, 0.7, 4.2, wd, PX, 6.6, AZ); col(PX, AZ, 0.5, 2.0, 'pilão');
  const arm = new THREE.Group(); arm.position.set(IX + PX, 6.6, IZ + AZ); ctx.scene.add(arm); // o eixo fica de modo que a cabeça do martelo caia bem na bigorna
  { const KA = new Kit(); KA.box(6.2, 0.6, 0.6, wd, -3.1, 0, 0); KA.box(1.6, 1.6, 1.4, iron, -5.8, -0.8, 0); KA.box(0.9, 0.3, 0.9, iron, -5.8, -1.7, 0); arm.add(KA.build()); }
  const gear = new THREE.Group(); gear.position.set(IX + hw - 0.9, 8, IZ + AZ); ctx.scene.add(gear);
  { const KG = new Kit(); KG.add(new THREE.CylinderGeometry(3, 3, 0.6, 40), wd, 0, 0, 0, 0, 0, Math.PI / 2); for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; KG.box(0.7, 0.7, 0.5, iron, 0, Math.sin(a) * 3.2, Math.cos(a) * 3.2, 0, a); } for (let k = 0; k < 4; k++) KG.box(0.62, 5.6, 0.4, iron, 0, 0, 0, 0, k * Math.PI / 4); KG.add(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), iron, 0, 0, 0, 0, 0, Math.PI / 2); gear.add(KG.build()); }
  let lastHit = 0; const anvilTop = 1.6 + 0.9 + 0.08;
  arm.userData.update = t => { const cyc = (t % 2.6) / 2.6, lift = cyc < 0.82 ? cyc / 0.82 : Math.max(0, 1 - (cyc - 0.82) / 0.05); arm.rotation.z = 0.38 - lift * 0.6; // 0,38 = cabeça na bigorna; levanta devagar e cai de uma vez gear.rotation.x = t * 0.6;
    if (cyc > 0.86 && cyc < 0.9 && t - lastHit > 1.5) { lastHit = t; const c = ctx.camera && ctx.camera.position; if (c && Math.abs(c.x - (IX + AX)) < 30 && Math.abs(c.z - (IZ + AZ)) < 30 && typeof Sound !== 'undefined') Sound.play('impact'); } };
  ctx.roomAnims.push(arm); void anvilTop;
  lights.push([FX - 6, 3, FZ, '#ff6a20', 7, 22]);
  // ---------- trilhos de minério (oeste) e a vagoneta que vai e volta ----------
  const RX = -hw + 5;
  for (const [z0, z1] of [[CH.z1 + 1, hd - 4], [-hd + 6, CH.z0 - 1]]) { for (const o of [-0.6, 0.6]) K.box(0.12, 0.12, z1 - z0, iron, RX + o, 0.12, (z0 + z1) / 2); for (let z = z0; z < z1; z += 0.9) K.box(1.8, 0.1, 0.3, wd, RX, 0.05, z); }
  const cart = new THREE.Group(); ctx.scene.add(cart);
  { const KC = new Kit(); KC.box(1.6, 0.9, 2.2, iron, 0, 0.75, 0); KC.box(1.4, 0.1, 2.0, wd, 0, 0.35, 0); for (const sx of [-0.6, 0.6]) for (const sz of [-0.7, 0.7]) KC.add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 16), iron, sx, 0.3, sz, 0, 0, Math.PI / 2); for (let k = 0; k < 9; k++) KC.add(new THREE.DodecahedronGeometry(0.22, 0), k % 3 ? st : M.ember(), (k % 3 - 1) * 0.45, 1.3, (Math.floor(k / 3) - 1) * 0.6, k); cart.add(KC.build()); }
  cart.userData.update = t => { const u = 0.5 - 0.5 * Math.cos(t * 0.22); cart.position.set(IX + RX, 0, IZ - hd + 9 + u * (CH.z0 - 1 - (-hd + 9) - 3)); }; ctx.roomAnims.push(cart);
  col(RX, (-hd + 6 + CH.z0 - 1) / 2, 1.1, (CH.z0 - 1 + hd - 6) / 2, 'trilhos'); // não dá para ficar na frente da vagoneta
  // ---------- o trono: escadaria larga, estrado, o trono de pedra e bronze e dois ancestrais ----------
  const TZ0 = -34, TZ1 = -38, TY = 1.6;
  for (let k = 0; k < 4; k++) K.box(20 - k * 0.6, TY * (k + 1) / 4, 1.0, cv, 0, TY * (k + 1) / 8, TZ0 - 0.5 - k);
  K.box(20, TY, hd + TZ1, cv, 0, TY / 2, (TZ1 - hd) / 2); // estrado
  { const tx = 0, tz = -44; K.box(3.0, 1.0, 2.4, cv, tx, TY + 0.5, tz); K.box(3.4, 4.6, 0.8, cv, tx, TY + 2.3, tz - 1.4); for (const sx of [-1, 1]) K.box(0.5, 1.6, 2.4, cv, tx + sx * 1.5, TY + 1.3, tz);
    K.add(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 6), bronze(), tx, TY + 4.9, tz - 1.3, 0, Math.PI / 2, Math.PI / 6); for (let k = 0; k < 5; k++) runeGlyph(K, tx - 1.2 + k * 0.6, TY + 3.4, tz - 0.98, 0.5, k * 3 + 1); col(tx, tz - 0.4, 1.8, 1.6, 'trono'); }
  addLevel({ x: IX, z: IZ + TZ0, yaw: Math.PI, w: 20, len: TZ0 - TZ1, y0: 0, y1: TY }); addLevel({ x: IX, z: IZ + TZ1, yaw: Math.PI, w: 20, len: TZ1 + hd, y0: TY });
  for (const sx of [-1, 1]) col(sx * 10.3, (TZ0 - hd) / 2, 0.3, (hd + TZ0) / 2, 'estrado'); // laterais do estrado (degrau alto)
  for (const sx of [-1, 1]) { const KP = new Kit(); KP.box(3.4, 1.4, 3.4, cv, 0, 0.7, 0); for (let k = 0; k < 3; k++) runeGlyph(KP, -0.8 + k * 0.8, 1.0, 1.72, 0.5, k + sx); const g = KP.build(); g.position.set(IX + sx * 7, TY, IZ - 42); ctx.scene.add(g); col(sx * 7, -42, 1.7, 1.7, 'ancestral');
    if (ctx.stoneHero) { const s = ctx.stoneHero({ id: 'ancestral_' + sx, model: sx < 0 ? 'Barbarian' : 'Knight', show: [sx < 0 ? '2H_Axe' : '2H_Sword'], look: { race: 'anao', face: sx < 0 ? 'valente' : 'sereno', hair: { style: 'longo', color: 'grisalho' }, beard: true } }, { scale: 5.2, anim: 'Idle', t: 0.7 + sx * 0.2 }); s.position.set(IX + sx * 7, TY + 1.4, IZ - 42); s.rotation.y = -sx * 0.25; ctx.scene.add(s); } }
  for (const sx of [-1, 1]) { lights.push([sx * 4, TY + 2.5, -40, '#ff9a48', 4, 16]); const b = makeBanner('anao', 3.0, 14); b.position.set(IX + sx * 9.5, HT - 9, IZ - hd + 1.2); ctx.scene.add(b); }
  // braseiros do trono e da ponte (taça de ferro com brasa e chama de verdade)
  const fire = (x, y, z, s) => { const KB = new Kit(); KB.add(new THREE.LatheGeometry([[0.02, 0], [0.4, 0], [0.25, 0.2], [0.18, 1.0], [0.6, 1.2], [0.9, 1.5], [0.82, 1.55], [0.02, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 20), iron); for (let k = 0; k < 7; k++) KB.add(new THREE.DodecahedronGeometry(0.16, 0), M.ember(), Math.cos(k) * 0.4, 1.5, Math.sin(k) * 0.4); const g = KB.build(); g.position.set(IX + x, y, IZ + z); ctx.scene.add(g); const f = H.flame(s, x + z); f.position.set(IX + x, y + 1.55, IZ + z); ctx.scene.add(f); ctx.roomAnims.push(f); col(x, z, 0.9, 0.9, 'braseiro'); };
  for (const sx of [-1, 1]) { fire(sx * 3.5, TY, -38.6, 1.1); fire(sx * 3.2, 0, CH.z1 + 2.5, 0.9); fire(sx * 3.2, 0, CH.z0 - 2.5, 0.9); }
  // ---------- o abismo: barreira invisível na beirada (fora da ponte) e a luz da lava vindo de baixo ----------
  for (const sx of [-1, 1]) col(sx * (hw + 1.7) / 2, (CH.z0 + CH.z1) / 2, (hw - 1.7) / 2, (CH.z1 - CH.z0) / 2, 'abismo');
  lights.push([0, -10, 14, '#ff4a10', 8, 50], [-hw + 4, 6, 14, '#ff5a20', 4, 24], [hw - 4, 6, 14, '#ff5a20', 4, 24]);
  // ---------- porta de saída: as folhas de bronze abertas para dentro e o portal ----------
  for (const s of [-1, 1]) { const g = trapSolid(12, 8.6, 17, 0.5, 0, 6); g.translate(-6, 0, 0); const KD = new Kit(); KD.add(g, bronze(), 0, 0, 0); const d = KD.build(); d.position.set(IX + s * 6, 0, IZ + hd - 0.6); d.rotation.y = s > 0 ? Math.PI * 0.6 : -Math.PI * 0.6 + Math.PI; ctx.scene.add(d); }
  { // pelo vão da saída entra a claridade de fora (degradê de dia, não o céu chapado)
    const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g2 = c.getContext('2d'), gr = g2.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#dfe9f0'); gr.addColorStop(0.6, '#c8c0ae'); gr.addColorStop(1, '#7a7264'); g2.fillStyle = gr; g2.fillRect(0, 0, 32, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const day = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 12.4), new THREE.MeshBasicMaterial({ map: t, fog: false })); day.position.set(IX, 6.2, IZ + hd + 1.6); day.rotation.y = Math.PI; ctx.scene.add(day); }
  const ex = ctx.makePortal('#ffb070'); ex.position.set(IX, 0, IZ + hd - 1.4); ctx.scene.add(ex); ctx.portals.push({ kind: 'exit', from: id, x: IX, z: IZ + hd - 1.4, mesh: ex });
  // ---------- monta tudo ----------
  add(K, 'grande_salao', false); const wg = add(WK, 'grande_salao_paredes', true); void wg; add(LK, 'grande_salao_lava', false);
  for (const [lx, lz, hx, hz] of wb) col(lx, lz, hx, hz, id);
  for (const [lx, ly, lz, c, it, dist] of lights) { const L = vlight(c, it, dist, 1.3); L.position.set(IX + lx, ly, IZ + lz); ctx.scene.add(L); }
  const N = (n, x, z, yaw, anim, y = 0) => { const npc = ctx.roomNpc(n, IX + x, IZ + z, yaw, anim); if (y) { npc.obj.position.y = y; npc.deckY = y; } return npc; };
  return { I, N, TY, hd, CH };
}
let _p2 = {}; function P2(k, c) { return _p2[k] || (_p2[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); }
