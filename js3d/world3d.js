/* =========================================================================
   MUNDO 3D — terreno contínuo (mundo aberto), regiões, estradas e cenário.
   1 unidade = 1 metro. Norte = -Z, Leste = +X.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

// S-076: 9× maior que o vale original. Expansão (2026-11-11): 450 → 630 (≈ 2× a área). Não passe de ~670: as salas ficam
// em x > HALF + 100 e a Arena começa em x = 777 (o servidor também usa x = 800 para ela).
export const HALF = 630; // o mundo vai de -630 a +630 nos dois eixos (2·HALF é múltiplo dos blocos de terreno de 90 m)
export const PLAY_LIMIT = 605; // até onde o jogador consegue ir (depois disso, montanhas ou mar)

export const ZONES = [
  { id: 'vila', name: 'Vila de Alvorada', lvl: 'Cidade', x: -70, z: 20, r: 30, music: 'vila', grass: '#7cb35a', safe: true },
  { id: 'campos', name: 'Campos de Verdelume', lvl: 'Nv. 1–12', x: 0, z: 28, r: 45, music: 'campo', grass: '#74ad4c' },
  { id: 'floresta', name: 'Bosque Sussurrante', lvl: 'Nv. 12–24', x: 82, z: 8, r: 45, music: 'floresta', grass: '#3f6d36' },
  { id: 'ruinas', name: 'Ruínas de Kael', lvl: 'Nv. 24–40', x: 0, z: -85, r: 42, music: 'ruinas', grass: '#6f7560' },
  // além da serra (S-076) — inspiração: Shadow of the Colossus (vastidão, gigantes de pedra) e WoW (regiões, cidades, grifos)
  { id: 'colinas', name: 'Colinas de Âmbar', lvl: 'Nv. 15–25', x: 200, z: 16, r: 58, music: 'campo', grass: '#93ad4c' },
  { id: 'pedraclara', name: 'Cidadela de Pedraclara', lvl: 'Cidade', x: 305, z: -14, r: 36, music: 'cidade', grass: '#7fab58', safe: true },
  { id: 'dunas', name: 'Dunas de Sal-Rubro', lvl: 'Nv. 22–32', x: 10, z: 292, r: 96, music: 'dunas', grass: '#d6b679' },
  { id: 'geada', name: 'Vale da Geada', lvl: 'Nv. 30–42', x: -300, z: 22, r: 96, music: 'geada', grass: '#dfe8ee' },
  { id: 'colossos', name: 'Ruínas dos Colossos', lvl: 'Nv. 40–55', x: 0, z: -300, r: 118, music: 'colossos', grass: '#8a8066' }, // S-161: terra arrasada, silêncio e mistério
  // S-117: cidades das raças e o litoral; S-118: o castelo nos campos
  { id: 'porto', name: 'Porto das Gaivotas', lvl: 'Cidade do litoral', x: 262, z: 262, r: 46, music: 'cidade', grass: '#9cb46a', safe: true },
  { id: 'pedrafunda', name: 'Pedrafunda', lvl: 'Cidade dos Anões', x: -288, z: -288, r: 40, music: 'cidade', grass: '#8d877c', safe: true },
  { id: 'aelindra', name: 'Aelindra', lvl: 'Cidade dos Elfos', x: 286, z: -284, r: 52, music: 'floresta', grass: '#4d7f3c', safe: true },
  { id: 'valcinza', name: 'Campos de Valcinza', lvl: 'Nv. 35–45', x: -268, z: 268, r: 72, music: 'campo', grass: '#8aa850' },
  // Expansão (2026-11-11): além da antiga serra da borda. `kind` = a região "mãe" (relevo, chão, clima, árvores e névoa iguais),
  // então a neve e o deserto continuam com transição gradual (biome/zoneWeight somam as regiões do mesmo tipo)
  { id: 'pinhal', name: 'Pinhal Nevado', lvl: 'Nv. 36–46', x: -532, z: 150, r: 100, music: 'geada', grass: '#b7c9bc', kind: 'geada' },
  { id: 'alem', name: 'Ermos Além da Muralha', lvl: 'Nv. 40–50', x: -532, z: -170, r: 110, music: 'geada', grass: '#e2eaef', kind: 'geada' },
  { id: 'brumosa', name: 'Costa Brumosa', lvl: 'Nv. 42–52', x: 0, z: -505, r: 120, music: 'geada', grass: '#b4bfbd', kind: 'geada' },
  { id: 'estepe', name: 'Estepe do Vento Seco', lvl: 'Nv. 30–40', x: -290, z: 515, r: 85, music: 'campo', grass: '#b3a862' },
  { id: 'areal', name: 'Grande Areal', lvl: 'Nv. 28–38', x: 40, z: 500, r: 120, music: 'dunas', grass: '#dcbb7c', kind: 'dunas' },
  { id: 'savana', name: 'Savana Dourada', lvl: 'Nv. 18–28', x: 418, z: 118, r: 70, music: 'campo', grass: '#b0b05c' },
  { id: 'turquesa', name: 'Costa Turquesa', lvl: 'Nv. 15–25', x: 468, z: -80, r: 72, music: 'campo', grass: '#86c25a' },
  { id: 'mata', name: 'Mata das Araras', lvl: 'Nv. 20–30', x: 508, z: -320, r: 70, music: 'floresta', grass: '#3f7a34' },
];
for (const zn of ZONES) zn._g = new THREE.Color(zn.grass); // cor da grama já convertida uma vez só (groundColor roda centenas de milhares de vezes)
const ZONE_GROUP = {}; for (const zn of ZONES) { (ZONE_GROUP[zn.id] = ZONE_GROUP[zn.id] || []).push(zn); if (zn.kind) (ZONE_GROUP[zn.kind] = ZONE_GROUP[zn.kind] || []).push(zn); } // 'geada' = Vale da Geada + Pinhal + Ermos + Costa Brumosa...
// Expansão: lagos congelados nos Ermos (só gelo no chão; o lago do Vale da Geada continua sendo o FROZEN), o oásis do Grande Areal
// (água rasa, de molhar os pés) e o platô da Costa Turquesa (cachoeira caindo na laguna). y/level são calculados na 1ª vez.
export const ICE_LAKES = [{ x: -538, z: -140, r: 17 }, { x: -527, z: -318, r: 13 }, { x: -548, z: 40, r: 11 }];
export const OASIS = { x: -44, z: 470, r: 12, level: null };
export const MESA = { x: null, z: -170, r: 36, top: 15 };
export const CITY2 = { x: 305, z: -14 }; // Pedraclara
export const FROZEN = { x: -330, z: 75, r: 24 }; // lago congelado do Vale da Geada
export const TEMPLE = { x: 0, z: -392 }; // Santuário Silente (entrada das Catacumbas)
export const CAMPS = { geada: { x: -248, z: 30 }, dunas: { x: -4, z: 228 }, colossos: { x: 0, z: -212 } }; // acampamentos com mestre-grifo
export const VILLAGE = { x: -70, z: 20 };
// S-117/S-118: novas cidades (centros planos) e o mar no canto sudeste
export const PORT = { x: 262, z: 262 };        // Porto das Gaivotas (humanos do litoral)
export const DWARF = { x: -288, z: -288 };     // Pedrafunda: bacia entre os picos mais altos
export const ELF = { x: 286, z: -284 };        // Aelindra: vale de floresta antiga
export const CASTLE = { x: -292, z: 296 };     // Castelo de Valcinza, no meio dos campos
const CASTLE_RY = Math.atan2(-280 - CASTLE.x, 270 - CASTLE.z), CASTLE_CS = Math.cos(CASTLE_RY), CASTLE_SN = Math.sin(CASTLE_RY); // mesma rotação do castle3d (a frente olha para a estrada)
export const SEA = { x: 500, z: 500, r: 300, level: -0.6, id: 'porto', shelf: 0.16, beach: 0.045 }; // o mar: tudo a menos de r deste ponto (com a costa irregular)
// Expansão (2026-11-11): mais dois mares, com o MESMO nível de água (seaDist/seaPush/waterLevelAt valem para todos):
// leste = Costa Turquesa (laguna rasa e clara, areia branca); norte = Costa Brumosa (fria, cascalho escuro, blocos de gelo).
// shelf = quanto o fundo afunda por metro mar adentro; beach = inclinação da praia.
export const SEA_TROPIC = { x: 960, z: -20, r: 470, level: SEA.level, id: 'turquesa', shelf: 0.065, beach: 0.03 };
export const SEA_NORTH = { x: 40, z: -1480, r: 950, level: SEA.level, id: 'brumosa', shelf: 0.2, beach: 0.07 };
export const SEAS = [SEA, SEA_TROPIC, SEA_NORTH];
// S-216: o porto tem um cais de pedra reto — a linha d'água é a mesma dos dois lados (nada de praia torta no meio da cidade)
// s = metros do centro do porto em direção ao mar; t = metros para o lado (ao longo do cais)
export const HARBOR = (() => { const ux = SEA.x - PORT.x, uz = SEA.z - PORT.z, l = Math.hypot(ux, uz); return { x: PORT.x, z: PORT.z, ux: ux / l, uz: uz / l, quay: 30, half: 72, land: SEA.level + 1.3 }; })();
export function harborST(x, z) { const dx = x - HARBOR.x, dz = z - HARBOR.z; return { s: dx * HARBOR.ux + dz * HARBOR.uz, t: dx * HARBOR.uz - dz * HARBOR.ux }; }
export function harborW(x, z) { const { s, t } = harborST(x, z); return (1 - smooth(HARBOR.half, HARBOR.half + 34, Math.abs(t))) * (1 - smooth(110, 150, s)) * smooth(-90, -55, s); }
// S-218: o porto não fica grudado no deserto — uma faixa verde de litoral (capim e arbustos) separa as dunas da cidade
export function coastBelt(x, z) { return smooth(115, 185, Math.hypot(x - PORT.x, z - PORT.z)); }
export function harborXZ(s, t) { return { x: HARBOR.x + HARBOR.ux * s + HARBOR.uz * t, z: HARBOR.z + HARBOR.uz * s - HARBOR.ux * t }; }
// costa irregular de um mar (o mar do porto continua com a mesma conta de antes: k = 1); longe da costa não precisa do detalhe
function seaRaw(s, x, z) { const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz) - s.r; if (d > 160) return d; const a = Math.atan2(dz, dx), k = s.r / 300; return d - 18 * Math.sin(a * 7 * k + 1.3) - 10.5 * Math.sin(a * 13 * k + 0.4); }
let lastSea = SEA; // o mar mais perto na última chamada de seaDist (seaAt/seaPush/heightAt usam)
export function seaDist(x, z) { // > 0 em terra, < 0 no mar (metros até a linha da praia) — o mais perto dos mares
  let sd = 1e9; for (const s of SEAS) { const d = seaRaw(s, x, z); if (d < sd) { sd = d; lastSea = s; } }
  sd += (vnoise(x * 0.05, z * 0.05) - 0.5) * 8;
  const w = lastSea === SEA ? harborW(x, z) : 0; if (w <= 0) return sd;
  return sd * (1 - w) + (HARBOR.quay - harborST(x, z).s) * w;
}
export function seaAt(x, z) { seaDist(x, z); return lastSea; } // qual mar (SEA, SEA_TROPIC ou SEA_NORTH) é o mais perto deste ponto
// bacias planas das cidades novas (1 no centro, 0 fora) — tiram as montanhas e aplainam o chão
const BASINS = [[PORT, 72, 104], /* S-285: o porto ganhou uma planície maior — sem o morro (pé da serra do canto) na entrada da cidade e do quebra-mar */[DWARF, 66, 84], [ELF, 50, 74], [CASTLE, 70, 104]];
export function basin(x, z) { let b = 0; for (const [c, r0, r1] of BASINS) { const d = Math.hypot(x - c.x, z - c.z); if (d < r1) b = Math.max(b, 1 - smooth(r0, r1, d)); } return b; }
export const LAKE = { x: 18, z: 52, r: 14, level: -0.9 };
export const ROADS = [
  [[-70, 20], [-45, 23], [-20, 26], [0, 28]],
  [[0, 28], [30, 22], [55, 14], [82, 8]],
  [[0, 28], [4, 0], [2, -30], [0, -62]],
  // estradas novas atravessam a serra por passagens (cânions)
  [[0, -62], [-3, -112], [2, -160], [0, -212], [-4, -270], [2, -330], [0, -372]], // norte: ruínas → acampamento → calçada antiga até o Santuário
  [[82, 8], [130, 12], [175, 22], [230, 10], [270, -10], [305, -14]],               // leste: bosque → colinas → Pedraclara
  [[0, 28], [-16, 66], [-12, 120], [-2, 175], [-4, 228], [12, 300]],                 // sul: campos → dunas
  [[-70, 20], [-112, 24], [-165, 30], [-210, 34], [-248, 30], [-310, 26]],           // oeste: vila → vale da geada
  [[-310, 26], [-318, -50], [-312, -130], [-300, -205], [-290, -262]],               // norte da geada → Pedrafunda (anões)
  [[305, -14], [312, -80], [306, -150], [294, -222], [286, -262]],                    // norte de Pedraclara → Aelindra (elfos)
  [[12, 300], [80, 296], [150, 284], [205, 272], [240, 264]],                         // leste das dunas → Porto das Gaivotas
  [[-165, 30], [-188, 100], [-222, 170], [-254, 230], [-280, 270]],                   // sudoeste: estrada do castelo de Valcinza
  // Expansão (2026-11-11): estradas para as regiões novas (as da serra abrem passagens)
  [[-222, 170], [-268, 186], [-338, 210], [-380, 262], [-418, 330], [-472, 344], [-526, 302], [-536, 220]], // passo do sudoeste: Valcinza → Pinhal Nevado (atrás da Muralha)
  [[12, 300], [2, 360], [-18, 418], [-36, 452]],                                        // sul: dunas → oásis do Grande Areal
  [[-36, 452], [-110, 482], [-200, 504], [-282, 516]],                                  // oásis → Estepe do Vento Seco
  [[305, -14], [352, -26], [404, -48], [446, -66]],                                     // leste: Pedraclara → Costa Turquesa
  [[2, -330], [-58, -352], [-104, -404], [-92, -458], [-40, -492]],                     // norte: contorna o Santuário até a Costa Brumosa
];
// S-expansão: caixa de cada trecho (pula o cálculo dos trechos longe — roadDist roda em todo heightAt)
const ROAD_SEGS = []; for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) { const [ax, az] = r[i], [bx, bz] = r[i + 1]; ROAD_SEGS.push([ax, az, bx, bz, Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)]); }

/* ---------- ruído ---------- */
function hash(x, z) { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { return vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 5, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3 + 9) * 0.1; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
export function roadDist(x, z) {
  let d = 1e9;
  for (const g of ROAD_SEGS) {
    const ex = g[4] - x > 0 ? g[4] - x : x - g[5] > 0 ? x - g[5] : 0, ez = g[6] - z > 0 ? g[6] - z : z - g[7] > 0 ? z - g[7] : 0;
    if (ex * ex + ez * ez >= d * d) continue; // a caixa do trecho já está mais longe que o melhor achado
    const v = segDist(x, z, g[0], g[1], g[2], g[3]); if (v < d) d = v;
  }
  return d;
}

/* ---------- montanhas na borda do mundo (fazem parte do terreno) ---------- */
const edgeDist = (x, z) => Math.pow(Math.pow(Math.abs(x), 6) + Math.pow(Math.abs(z), 6), 1 / 6); // quadrado de cantos arredondados
const ridged = (x, z) => 1 - Math.abs(vnoise(x, z) * 2 - 1);
// S-103: o Santuário fica num nicho escavado na montanha — paredões dos lados e atrás, abertura para a planície.
// templeNiche = 1 no chão do pátio, 0 na rocha; templeCliff = paredão em volta do nicho.
export function templeNiche(x, z) {
  const dx = Math.abs(x - TEMPLE.x), dz = z - TEMPLE.z;
  const w = 15.2 + Math.max(0, dz) * 0.5 + (vnoise(x * 0.12 + 3, z * 0.12) - 0.5) * 3;
  return 1 - smooth(-0.5, 5, Math.max(dx - w, -8.2 - dz));
}
export function templeCliff(x, z) {
  const d = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (d > 75) return 0;
  return (1 - templeNiche(x, z)) * (1 - smooth(36, 75, d + Math.max(0, z - TEMPLE.z) * 0.6));
}
// Expansão (2026-11-11): a Muralha Gélida (cities3d, x = -405) era encostada na borda do mundo. A borda foi para longe, então
// uma serra alta continua atrás dela (a muralha segue encravada na montanha, igual a antes) e os Ermos começam depois (x < -500).
export function wallRidge(x, z) {
  if (x > -396 || x < -520) return 0;
  const n = (vnoise(x * 0.03 + 11, z * 0.03) - 0.5) * 18;
  return smooth(398, 436, -x) * (1 - smooth(468, 500, -x + n)) * (1 - smooth(262, 300, Math.abs(z - 2) + n));
}
export function mountainMask(x, z) {
  const e = edgeDist(x, z) + (vnoise(x * 0.03, z * 0.03) - 0.5) * 18;
  const inner = smooth(104, 128, e) * (1 - smooth(158, 192, e)); // serra que cerca o vale de Alvorada
  const ax = Math.abs(x), az = Math.abs(z), mn = Math.min(ax, az) + (vnoise(x * 0.02 + 5, z * 0.02) - 0.5) * 34;
  // maciços entre as regiões novas; expansão: eles param antes da borda nova (faixas de terra em volta), os cantos continuam montanha
  const corner = smooth(208, 262, mn) * (1 - smooth(445, 485, Math.max(ax, az) + (vnoise(x * 0.025 + 2, z * 0.025 + 8) - 0.5) * 24) * (1 - smooth(395, 445, mn)));
  const outer = smooth(HALF - 58, HALF - 14, e); // borda do mundo
  const wr = wallRidge(x, z);
  const pass = inner > 0.01 || corner > 0.01 || wr > 0.01 ? 1 - smooth(10, 26, roadDist(x, z)) : 0; // as estradas abrem passagens na serra
  const tn = Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 80 ? templeNiche(x, z) : 0; // pátio do Santuário escavado na montanha
  const bs = basin(x, z), sea = 1 - smooth(-30, 30, seaDist(x, z)); // cidades novas e o mar não têm montanha
  // S-166: as bacias das cidades só tiram a serra de dentro; a borda do mundo continua com montanha (nada de chão cortado e vazio cinza)
  return Math.max(Math.max(Math.max(inner, corner) * (1 - pass) * (1 - bs), outer * (1 - tn), wr * (1 - pass)) * (1 - sea), tn < 1 ? templeCliff(x, z) : 0);
}
// paredões de Pedrafunda: anel de rocha alta em volta da cidade dos anões, aberto ao sul (estrada)
export function dwarfCliff(x, z) {
  const d = Math.hypot(x - DWARF.x, z - DWARF.z); if (d > 146) return 0;
  const gate = 1 - smooth(9, 18, roadDist(x, z)); // a estrada atravessa o paredão (portão de Pedrafunda)
  return smooth(70, 84, d) * (1 - smooth(118, 146, d)) * (1 - gate); // S-178: cidade bem maior (muralha a 58 m), paredões mais para fora
}
export function mountainH(x, z) {
  const m = mountainMask(x, z), dcl = dwarfCliff(x, z); if (m <= 0 && dcl <= 0) return 0;
  const r = ridged(x * 0.022, z * 0.022) * 0.5 + ridged(x * 0.05 + 7, z * 0.05) * 0.28 + ridged(x * 0.13, z * 0.13 + 4) * 0.14 + vnoise(x * 0.3, z * 0.3) * 0.08; // cristas, picos e rochas
  const big = 0.45 + vnoise(x * 0.011 + 3, z * 0.011) * 0.9; // picos altos e vales mais baixos ao longo da cordilheira
  let h = Math.pow(m, 1.7) * (12 + r * 58) * big;
  const tc = templeCliff(x, z); if (tc > 0) h = Math.max(h, Math.pow(tc, 0.8) * (30 + r * 22)); // paredões altos em volta do Santuário
  const wr = wallRidge(x, z); if (wr > 0) h = Math.max(h, Math.pow(wr * smooth(10, 26, roadDist(x, z)), 0.8) * (42 + r * 34)); // serra alta atrás da Muralha (esconde as costas dela)
  if (dcl > 0) h = Math.max(h, Math.pow(dcl, 0.75) * (46 + r * 40 + vnoise(x * 0.04, z * 0.04) * 18)); // picos mais altos do mundo em volta de Pedrafunda
  return h;
}

/* S-154: árvore só nasce onde há terra: nada em rocha dura, encosta íngreme, neve alta ou cascalho de Pedrafunda.
   rockiness(x, z) usa a mesma conta da cor do chão (0 = terra/grama, 1 = rocha nua). */
export function rockiness(x, z) {
  const mm = Math.max(mountainMask(x, z), dwarfCliff(x, z)), h = heightAt(x, z), nn = vnoise(x * 0.2, z * 0.2);
  const slope = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
  let r = mm > 0.02 ? Math.min(1, smooth(7, 18, h + nn * 5) * 0.85 + smooth(0.6, 1.2, slope)) * mm : 0;
  if (h > 6 && (mm > 0.05 || edgeDist(x, z) < 150)) r = Math.max(r, smooth(6, 14, h) * (mm > 0.05 ? 1 : 0.6));
  return { rock: r, slope, h };
}
export function treeAllowed(x, z, opts = {}) {
  const { rock, slope, h } = rockiness(x, z);
  if (rock > (opts.maxRock ?? 0.3) || slope > (opts.maxSlope ?? 0.5) || h > 20) return false;
  if (Math.hypot(x - DWARF.x, z - DWARF.z) < 146) return false; // cascalho de Pedrafunda
  if (seaDist(x, z) < 14) return false; // praia
  if (x < -470 && ICE_LAKES.some(L => Math.hypot(x - L.x, z - L.z) < L.r * 1.3)) return false; // lagos congelados dos Ermos
  if (z > 400 && oasisDist(x, z) < OASIS.r + 2) return false; // lagoa do oásis
  return true;
}

/* ---------- altura do terreno ---------- */
/* ---------- lago com margem irregular (não é um círculo perfeito) ---------- */
export function lakeShape(x, z) { const a = Math.atan2(z - LAKE.z, x - LAKE.x); return 1 + 0.16 * Math.sin(3 * a + 1.1) + 0.09 * Math.sin(5 * a + 2.4) + 0.05 * Math.sin(8 * a + 0.3); }
// distância até o centro "corrigida" pela forma da margem: comparar com LAKE.r
export function lakeDist(x, z) { return Math.hypot(x - LAKE.x, z - LAKE.z) / lakeShape(x, z); }
const zw = (id, x, z) => { let w = 0; for (const zn of ZONE_GROUP[id]) { const v = 1 - smooth(zn.r * 0.55, zn.r * 1.3, Math.hypot(x - zn.x, z - zn.z)); if (v > w) w = v; } return w; }; // região + as do mesmo tipo
export function oasisShape(x, z) { const a = Math.atan2(z - OASIS.z, x - OASIS.x); return 1 + 0.14 * Math.sin(3 * a + 0.7) + 0.08 * Math.sin(5 * a + 2.1); }
export function oasisDist(x, z) { return Math.hypot(x - OASIS.x, z - OASIS.z) / oasisShape(x, z); } // comparar com OASIS.r (como o lakeDist)
function mesaReady() { if (MESA.x !== null) return; let cx = 520; for (let x = 400; x < 640; x++) if (seaDist(x, MESA.z) < 0) { cx = x; break; } MESA.x = cx - 22; } // o platô encosta na água
export function mesaH(x, z) { // platô de pedra da Costa Turquesa (altura somada ao chão; 0 fora dele)
  if (x < 420 || Math.abs(z - MESA.z) > 52) return 0; mesaReady();
  const d = Math.hypot(x - MESA.x, (z - MESA.z) * 1.25) + (vnoise(x * 0.12, z * 0.12) - 0.5) * 5; if (d > MESA.r) return 0;
  return (1 - smooth(MESA.r - 6, MESA.r, d)) * smooth(-1, 2.5, seaDist(x, z)) * (MESA.top + (vnoise(x * 0.07 + 3, z * 0.07) - 0.5) * 2.5);
}
export function heightAt(x, z) {
  let h = (fbm(x * 0.032, z * 0.032) - 0.45) * 8;
  if (Math.abs(x) > 140 || Math.abs(z) > 140) { // relevo próprio de cada região nova
    const wC = zw('colossos', x, z), wD = zw('dunas', x, z), wG = zw('geada', x, z), wH = zw('colinas', x, z);
    h *= 1 - wC * 0.7; // planície vasta e calma
    if (wC > 0) h += wC * (fbm(x * 0.006, z * 0.006) - 0.45) * 9; // ondulações largas
    if (wD > 0) { const dune = Math.pow(Math.sin(x * 0.045 + Math.sin(z * 0.018) * 2.6 + fbm(x * 0.01, z * 0.01) * 3) * 0.5 + 0.5, 2.2); h += wD * (dune * 5.5 + (fbm(x * 0.02, z * 0.02) - 0.4) * 5); }
    if (wG > 0) h += wG * (fbm(x * 0.013 + 7, z * 0.013) - 0.42) * 15; // morros nevados
    if (wH > 0) h += wH * (fbm(x * 0.022 + 3, z * 0.022) - 0.4) * 11; // colinas
    const dc = Math.hypot(x - CITY2.x, z - CITY2.z); if (dc < 50) h *= smooth(26, 50, dc); // cidade plana
    for (const c of Object.values(CAMPS)) { const d = Math.hypot(x - c.x, z - c.z); if (d < 20) h *= smooth(8, 20, d); }
    const df = Math.hypot(x - FROZEN.x, z - FROZEN.z) / FROZEN.r; if (df < 1.5) h = h * smooth(0.95, 1.5, df) + -0.3 * (1 - smooth(0.95, 1.5, df)); // lago congelado plano
    if (x < -470) for (const L of ICE_LAKES) { // lagos congelados dos Ermos: chão plano (o nível vem do relevo no centro, calculado 1 vez)
      const d = Math.hypot(x - L.x, z - L.z) / L.r; if (d >= 1.6) continue;
      if (L.y === undefined) { L.y = null; L.y = heightAt(L.x, L.z) - 0.35; } if (L.y === null) continue;
      const k = 1 - smooth(0.95, 1.6, d); h = h * (1 - k) + L.y * k;
    }
    if (z > 400) { const dO = oasisDist(x, z); if (dO < OASIS.r + 30) { // oásis: chão plano em volta e uma lagoa rasa
      if (OASIS.level === null) { OASIS.level = undefined; const b = heightAt(OASIS.x, OASIS.z); OASIS.level = Math.max(0.2, b * 0.4); }
      if (OASIS.level !== undefined) { const lv = OASIS.level, k = 1 - smooth(OASIS.r + 8, OASIS.r + 30, dO); h = h * (1 - k) + (lv + 0.3 + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.2) * k;
        if (dO < OASIS.r + 2) { const k2 = smooth(OASIS.r + 2, OASIS.r - 4, dO); h = h * (1 - k2) + (lv - 0.5 + (vnoise(x * 0.5, z * 0.5) - 0.5) * 0.12) * k2; } }
    } }
  }
  h *= smooth(16, 34, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)); // vila plana
  h *= 0.3 + 0.7 * smooth(2.5, 8, roadDist(x, z)); // estradas suaves
  const dl = lakeDist(x, z);
  if (dl < LAKE.r + 6) { const k = smooth(LAKE.r + 6, LAKE.r - 4, dl); h = h * (1 - k) + (LAKE.level - 1.3 - 1.5 * smooth(LAKE.r - 3, LAKE.r * 0.25, dl) + (vnoise(x * 0.4, z * 0.4) - 0.5) * 0.4) * k; } // fundo mais fundo no meio
  { const bs = basin(x, z); if (bs > 0) h *= 1 - bs * 0.85; } // cidades novas: chão quase plano
  { const sd = seaDist(x, z); if (sd < 60) { // litoral: praia que desce suave até o mar e fundo que vai afundando
    const sea = lastSea, beach = SEA.level + 0.35 + Math.max(0, sd) * sea.beach, k = 1 - smooth(18, 60, sd); // cada mar tem praia e fundo próprios (o do porto = como antes)
    h = h * (1 - k) + beach * k;
    if (sd < 0) h = SEA.level + 0.2 - Math.min(9, Math.pow(-sd, 0.9) * sea.shelf) + (vnoise(x * 0.1, z * 0.1) - 0.5) * (sea === SEA_TROPIC ? 0.3 : 0.6);
  } }
  h += mesaH(x, z); // platô da Costa Turquesa
  { const w = harborW(x, z); if (w > 0) { // S-216: cais de pedra — chão firme até a borda e água funda logo depois (dos dois lados igual)
    const { s } = harborST(x, z), q = HARBOR.quay;
    const target = s < q ? h + (HARBOR.land - h) * smooth(q - 46, q - 18, s) : SEA.level - 3.4 - Math.min(2.6, (s - q) * 0.05) + (vnoise(x * 0.1, z * 0.1) - 0.5) * 0.4;
    h = h * (1 - w) + target * w;
  } }
  h += mountainH(x, z); // montanhas na borda
  const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (dt < 80) { const f = templeNiche(x, z) * (1 - smooth(40, 78, dt)); h = h * (1 - f) + 2 * f; } // pátio do Santuário
  return h;
}

/* ---------- região (zona) em um ponto ---------- */
const ZONE_BY = Object.fromEntries(ZONES.map(z => [z.id, z]));
// peso de cada região num ponto (somam 1): transições suaves entre biomas (S-095)
export function biome(x, z) {
  let tw = 0; const w = {};
  for (const zn of ZONES) { const d = Math.max(1, Math.hypot(x - zn.x, z - zn.z) / zn.r), v = 1 / (d * d * d * d), k = zn.kind || zn.id; w[k] = (w[k] || 0) + v; tw += v; } // regiões novas somam no tipo delas (neve, deserto)
  for (const k in w) w[k] /= tw; return w;
}
export function zoneAt(x, z) {
  let best = ZONES[1], bd = 1e9;
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < bd) { bd = d; best = zn; } }
  return best;
}
export function zoneWeight(id, x, z) { // a região e as do mesmo tipo (zoneWeight('geada') também vale nos Ermos, no Pinhal e na Costa Brumosa)
  let w = 0; for (const zn of ZONE_GROUP[id] || []) { const v = 1 - smooth(zn.r * 0.6, zn.r * 1.4, Math.hypot(x - zn.x, z - zn.z)); if (v > w) w = v; }
  return w;
}

/* ---------- malha do terreno (low-poly, cores por vértice) ---------- */
export function groundColor(x, z, h, slopeIn) {
  const c = new THREE.Color();
  // mistura das cores de grama das regiões (peso pelo inverso da distância)
  let tw = 0; const acc = new THREE.Color(0, 0, 0);
  for (const zn of ZONES) {
    const d = Math.max(1, Math.hypot(x - zn.x, z - zn.z) / zn.r);
    const w = 1 / (d * d * d * d); tw += w;
    const g = zn._g; acc.r += g.r * w; acc.g += g.g * w; acc.b += g.b * w;
  }
  c.setRGB(acc.r / tw, acc.g / tw, acc.b / tw);
  const n = (fbm(x * 0.15, z * 0.15) - 0.5) * 0.12;
  c.offsetHSL(0, 0, n);
  const far = Math.abs(x) > 140 || Math.abs(z) > 140;
  if (far) { // chão das regiões novas
    const bw = biome(x, z), wD = bw.dunas * coastBelt(x, z), wG = bw.geada, wC = bw.colossos;
    if (wD > 0.08) { const rip = Math.sin(x * 0.9 + Math.sin(z * 0.3) * 3) * 0.5 + 0.5, dune = Math.sin(x * 0.045 + Math.sin(z * 0.018) * 2.6) * 0.5 + 0.5; c.lerp(new THREE.Color('#e8c98c').offsetHSL(0.005, 0.05, rip * 0.06 - 0.04 + (dune - 0.5) * 0.08), smooth(0.12, 0.5, wD)); } // areia bem marcada, com marolas e sombra das dunas
    if (wG > 0.08) { const patch = vnoise(x * 0.07, z * 0.07), cover = smooth(0.12, 0.55, wG); c.lerp(new THREE.Color('#f3f6f9').offsetHSL(0.55, 0.05, (patch - 0.5) * 0.06), cover * (patch > 0.6 - cover * 0.45 ? 1 : 0.35)); } // neve que vai cobrindo a grama aos poucos
    if (wC > 0.12) { // S-161: terra arrasada — chão de terra seca e cinzenta, manchas queimadas, rachaduras e pouco capim morto
      const k = smooth(0.12, 0.55, wC), patch = vnoise(x * 0.045, z * 0.045), crack = Math.abs(vnoise(x * 0.35, z * 0.35) - 0.5);
      const dirt = new THREE.Color('#7a6f5c').lerp(new THREE.Color('#5e564a'), patch).offsetHSL(0, -0.02, (vnoise(x * 0.4, z * 0.4) - 0.5) * 0.07);
      if (crack < 0.035) dirt.multiplyScalar(0.72); // fendas no chão
      if (vnoise(x * 0.02 + 9, z * 0.02) > 0.68) dirt.lerp(new THREE.Color('#3f3a35'), 0.45); // manchas queimadas
      c.lerp(dirt, k * (patch > 0.72 ? 0.7 : 0.95));
    }
    const df = Math.hypot(x - FROZEN.x, z - FROZEN.z) / FROZEN.r * (1 + (vnoise(x * 0.2, z * 0.2) - 0.5) * 0.15);
    if (df < 1.05) c.lerp(new THREE.Color('#cfe6f1').offsetHSL(0, 0, (vnoise(x * 0.05, z * 0.05) - 0.5) * 0.05), smooth(1.05, 0.95, df)); // gelo (S-229: cor lisa no chão; o desenho do gelo vem da camada de gelo por cima, sem quadriculado)
    if (x < -470) for (const L of ICE_LAKES) { const d = Math.hypot(x - L.x, z - L.z) / L.r * (1 + (vnoise(x * 0.2, z * 0.2) - 0.5) * 0.18); if (d < 1.08) { // lagos congelados dos Ermos: gelo azulado com rachaduras
      const crack = Math.abs(vnoise(x * 0.5 + 7, z * 0.5) - 0.5) < 0.03 ? 0.06 : 0; c.lerp(new THREE.Color('#bcdcec').offsetHSL(0, 0, (vnoise(x * 0.08, z * 0.08) - 0.5) * 0.08 + crack), smooth(1.08, 0.94, d)); } }
    if (z > 400) { const dO = oasisDist(x, z); if (dO < OASIS.r + 24) { // oásis: anel verde de capim e areia úmida na beira
      c.lerp(new THREE.Color('#6fa548').offsetHSL(0, 0, (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.08), (1 - smooth(OASIS.r + 8, OASIS.r + 24, dO)) * 0.9);
      if (dO < OASIS.r + 2.5) c.lerp(new THREE.Color('#b8a678'), smooth(OASIS.r + 2.5, OASIS.r, dO) * 0.85);
    } }
    if (x > 420) { const me = mesaH(x, z); if (me > 0.4) { // platô da Costa Turquesa: paredões de pedra clara, topo com capim
      const sl = slopeIn ?? 0, rk = new THREE.Color('#a69780').lerp(new THREE.Color('#857761'), vnoise(x * 0.3, z * 0.3 + 4)).offsetHSL(0, 0, (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.06);
      c.lerp(rk, Math.min(1, smooth(0.45, 1.0, sl) + smooth(0.6, 0.2, me / MESA.top) * 0.6)); } }
    const dc = Math.hypot(x - CITY2.x, z - CITY2.z); if (dc < 26) c.lerp(new THREE.Color('#bdb5a3').offsetHSL(0, 0, ((Math.floor(x / 2.5) + Math.floor(z / 2.5)) & 1) * 0.03), smooth(26, 22, dc)); // praça de Pedraclara
    const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (dt < 34) c.lerp(new THREE.Color('#9e998d').offsetHSL(0, 0, ((Math.floor(x / 3) + Math.floor(z / 3)) & 1) * 0.035), smooth(34, 26, dt) * smooth(0.6, 0.95, templeNiche(x, z))); // pátio do Santuário
  }
  { const sd = seaDist(x, z), sea = lastSea; if (sd < 26) { // areia da praia (com a faixa molhada mais escura) e fundo do mar
    const wet = smooth(4, -1, sd);
    if (sea === SEA_NORTH) { // Costa Brumosa: cascalho escuro e seixos, sem areia
      const peb = vnoise(x * 1.7, z * 1.7), grav = new THREE.Color('#6d6a64').lerp(new THREE.Color('#4c4a47'), vnoise(x * 0.25, z * 0.25)).offsetHSL(0, 0, (peb - 0.5) * 0.12 - wet * 0.08);
      c.lerp(grav, smooth(28, 10, sd)); if (sd < -2) c.lerp(new THREE.Color('#3f4a4c'), smooth(-2, -16, sd) * 0.85);
    } else {
      const trop = sea === SEA_TROPIC, sand = new THREE.Color(trop ? '#f1e6c4' : '#e3cf9c').offsetHSL(0, 0, (vnoise(x * 0.4, z * 0.4) - 0.5) * 0.06 - wet * (trop ? 0.08 : 0.12));
      c.lerp(sand, smooth(trop ? 30 : 26, 12, sd) * (1 - harborW(x, z))); // no porto o cais é de pedra: sem faixa de areia
      if (sd < -2) c.lerp(new THREE.Color(trop ? '#e6dcb4' : '#9c9a72'), smooth(-2, -20, sd) * (trop ? 0.9 : 0.8)); // laguna: fundo de areia clara (a água fica turquesa)
    }
  } }
  { const dp = Math.hypot(x - PORT.x, z - PORT.z); if (dp < 190) { // S-218: litoral verde em volta do porto (capim de restinga), sem areia de deserto
    const k = (1 - smooth(120, 190, dp)) * smooth(10, 30, seaDist(x, z)), g = new THREE.Color('#86a85a').offsetHSL(0, 0, (vnoise(x * 0.12, z * 0.12) - 0.5) * 0.08);
    c.lerp(g, k * 0.85);
  } }
  { const dd = Math.hypot(x - DWARF.x, z - DWARF.z); if (dd < 150) { // S-164: chegando em Pedrafunda o chão vira cascalho e pedra (sem grama)
    const k = 1 - smooth(70, 150, dd), gr = new THREE.Color('#8b8478').lerp(new THREE.Color('#6f6a62'), vnoise(x * 0.25, z * 0.25)).offsetHSL(0, 0, (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.06);
    c.lerp(gr, k * 0.9);
  } }
  { const w = harborW(x, z); if (w > 0.3) { const { s, t } = harborST(x, z), q = HARBOR.quay; // S-210: calçamento de pedras irregulares (nada de tabuleiro) no cais e na praça do porto
    const inQuay = Math.abs(t) < HARBOR.half - 4 && s < q + 0.5, dP = Math.hypot(x - PORT.x, z - PORT.z);
    const kStone = Math.max(inQuay ? smooth(q - 14, q - 12, s) : 0, dP < 20 ? smooth(20, 16, dP) : 0), kEarth = inQuay ? smooth(q - 26, q - 22, s) * (1 - kStone) : 0;
    if (kEarth > 0) { const e = new THREE.Color('#a8916c').offsetHSL(0, -0.02, (vnoise(x * 0.35, z * 0.35) - 0.5) * 0.1 + (vnoise(x * 1.3, z * 1.3) - 0.5) * 0.05); c.lerp(e, kEarth * w * 0.9); } // rua de terra batida entre as casas e o passeio
    if (kStone > 0) { const u = x * 0.9 + Math.sin(z * 0.7) * 0.6, v = z * 0.9 + Math.sin(x * 0.7) * 0.6, cell = vnoise(Math.floor(u * 1.4) * 1.7, Math.floor(v * 1.4) * 1.3);
      const cob = new THREE.Color('#9d927e').offsetHSL(0.012 * (cell - 0.5), 0.02, (cell - 0.5) * 0.1 + (vnoise(x * 0.25, z * 0.25) - 0.5) * 0.12 - (vnoise(x * 0.08 + 3, z * 0.08) > 0.62 ? 0.06 : 0)); c.lerp(cob, kStone * w); } } } // calçamento com manchas de uso
  for (const [ct, rr, col, cell] of [[DWARF, 56, '#8a8073', 0], [ELF, 16, '#d9d4c4', 2.2], [PORT, 0, '#c7b48e', 2.5], [CASTLE, 0, '#b8b09c', 3]]) { // praças das cidades novas (o porto tem calçamento próprio)
    if (!rr) continue; const d = Math.hypot(x - ct.x, z - ct.z);
    if (d < rr) c.lerp(new THREE.Color(col).offsetHSL(0, 0, (cell ? ((Math.floor(x / cell) + Math.floor(z / cell)) & 1) * 0.03 : 0) + (vnoise(x * (cell ? 0.5 : 0.12), z * (cell ? 0.5 : 0.12)) - 0.5) * 0.05), smooth(rr, rr - 4, d));
  }
  const rd = roadDist(x, z);
  if (rd < 3.2) { const stone = far && zw('colossos', x, z) > 0.3; c.lerp(new THREE.Color(stone ? '#a7a092' : '#b08c5a').offsetHSL(0, 0, stone ? ((Math.floor(x / 2) + Math.floor(z / 2.6)) & 1) * 0.04 : 0), smooth(3.2, 1.6, rd)); } // calçada antiga nos Colossos
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (dv < 13) c.lerp(new THREE.Color('#c2b9a6'), smooth(13, 10, dv)); // praça de pedra
  const dl = lakeDist(x, z);
  if (dl < LAKE.r + 2.5) c.lerp(new THREE.Color('#c9b98a'), smooth(LAKE.r + 2.5, LAKE.r, dl) * (0.75 + vnoise(x * 0.5, z * 0.5) * 0.25)); // areia
  if (dl < LAKE.r - 0.5) c.lerp(new THREE.Color('#6d6a4a'), smooth(LAKE.r - 0.5, LAKE.r - 4, dl) * 0.7); // lodo no fundo
  const mm = Math.max(mountainMask(x, z), dwarfCliff(x, z));
  if (mm > 0.02) { // encostas: grama → rocha → neve, conforme altura e inclinação
    const slope = slopeIn ?? Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
    const nn = vnoise(x * 0.2, z * 0.2);
    const rock = new THREE.Color('#9a958b').lerp(new THREE.Color('#7b766d'), nn).offsetHSL(0, 0, (vnoise(x * 0.6, z * 0.6) - 0.5) * 0.08);
    const kr = Math.min(1, smooth(7, 18, h + nn * 5) * 0.85 + smooth(0.6, 1.2, slope)) * mm;
    c.lerp(rock, kr);
    const ks = smooth(44, 54, h + (nn - 0.5) * 10) * (1 - smooth(0.9, 1.5, slope) * 0.8);
    if (ks > 0) c.lerp(new THREE.Color('#f2f5f8').offsetHSL(0, 0, (nn - 0.5) * 0.05), ks);
  }
  const wr = zoneWeight('ruinas', x, z);
  if (wr > 0.3) { // lajes de pedra antigas no chão das ruínas
    const cell = (Math.floor(x / 3) + Math.floor(z / 3)) & 1, crack = vnoise(x * 0.7, z * 0.7);
    const slab = new THREE.Color(cell ? '#8d8a80' : '#7f7c73').offsetHSL(0, 0, (crack - 0.5) * 0.08);
    c.lerp(slab, smooth(0.3, 0.8, wr) * (vnoise(x * 0.08, z * 0.08) > 0.35 ? 0.85 : 0.3));
  }
  if (h > 6 && (mm > 0.05 || edgeDist(x, z) < 150)) c.lerp(new THREE.Color('#8a8c86'), smooth(6, 14, h) * (mm > 0.05 ? 1 : 0.6)); // rocha (só serra e vale; morros das regiões novas continuam com grama/neve)
  if (h > 22) c.lerp(new THREE.Color('#f2f4f7'), smooth(22, 30, h)); // neve
  return c;
}

// textura de detalhe (manchas e pontinhos), repetida pelo chão para tirar a cara de "chapado"
function detailTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = 0.86 + vnoise(x * 0.05, y * 0.05) * 0.1 + vnoise(x * 0.3, y * 0.3) * 0.06 + (Math.random() - 0.5) * 0.05;
    const k = (y * S + x) * 4, v = Math.max(0, Math.min(255, n * 255));
    img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(70, 70); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
// O terreno é dividido em blocos de 90 m. Todos começam com pouca resolução (rápido de montar);
// os blocos perto do jogador ganham resolução alta aos poucos (um pedacinho por quadro, sem travar).
// Cada bloco tem uma "saia" de 2 m para baixo nas bordas: não aparecem frestas entre resoluções diferentes.
const TILE = 90, NT = Math.round(HALF * 2 / TILE), LO = 24, HI = 64, HI_R = 150, LO_R = 240;
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const tiles = [];
function* tileBuilder(t, seg) {
  const step = TILE / seg, n = seg + 3, x0 = t.x0 - step, z0 = t.z0 - step; // grade com uma borda extra (saia + normais certas)
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) { for (let i = 0; i < n; i++) H[j * n + i] = heightAt(x0 + i * step, z0 + j * step); if (seg === HI && (j & 3) === 3) yield; }
  const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), v = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i, x = x0 + i * step, z = z0 + j * step, h = H[k];
      const hl = H[j * n + Math.max(0, i - 1)], hr = H[j * n + Math.min(n - 1, i + 1)], hu = H[Math.max(0, j - 1) * n + i], hd = H[Math.min(n - 1, j + 1) * n + i];
      v.set(hl - hr, 2 * step, hu - hd).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z;
      const slope = Math.hypot(hr - hl, hd - hu) / (2 * step);
      const c = groundColor(x, z, h, slope); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      const cx = Math.min(t.x0 + TILE, Math.max(t.x0, x)), cz = Math.min(t.z0 + TILE, Math.max(t.z0, z));
      pos[k * 3] = cx; pos[k * 3 + 1] = edge ? h - 2 : h; pos[k * 3 + 2] = cz;
      uv[k * 2] = cx / 300; uv[k * 2 + 1] = cz / 300; // mesma densidade da textura de antes
    }
    if (seg === HI && (j & 3) === 3) yield;
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const runNow = gen => { let r; do r = gen.next(); while (!r.done); return r.value; };
export function buildTerrain() {
  terrainMat.map = detailTexture();
  const group = new THREE.Group();
  for (let tj = 0; tj < NT; tj++) for (let ti = 0; ti < NT; ti++) {
    const t = { x0: -HALF + ti * TILE, z0: -HALF + tj * TILE, cx: -HALF + (ti + 0.5) * TILE, cz: -HALF + (tj + 0.5) * TILE, hi: null, job: null };
    t.lo = runNow(tileBuilder(t, LO));
    t.mesh = new THREE.Mesh(t.lo, terrainMat); t.mesh.receiveShadow = true; group.add(t.mesh); tiles.push(t);
  }
  return group;
}
// chamada a cada quadro: troca a resolução dos blocos conforme a distância (orçamento de ~3 ms)
export function updateTerrain(x, z, budgetMs = 3) {
  const t0 = performance.now();
  let best = null, bd = 1e9;
  for (const t of tiles) {
    const d = Math.hypot(t.cx - x, t.cz - z);
    if (t.hi && d > LO_R && t.mesh.geometry === t.hi) { t.mesh.geometry = t.lo; t.hi.dispose(); t.hi = null; }
    if (!t.hi && d < HI_R && d < bd) { bd = d; best = t; }
  }
  if (!best) return;
  if (!best.job) best.job = tileBuilder(best, HI);
  while (performance.now() - t0 < budgetMs) {
    const r = best.job.next();
    if (r.done) { best.hi = r.value; best.job = null; best.mesh.geometry = best.hi; return; }
  }
}
// constrói na hora a resolução alta em volta de um ponto (início do jogo / teleporte)
export function terrainNear(x, z, r = 100) { for (const t of tiles) if (!t.hi && Math.hypot(t.cx - x, t.cz - z) < r) { t.hi = runNow(tileBuilder(t, HI)); t.job = null; t.mesh.geometry = t.hi; } }

// cordilheira distante no horizonte (silhueta azulada com neve, como no fundo de um vale)
export function buildDistantMountains() {
  const SEGA = 300, ROWS = 7, R0 = 470, R1 = 740, pos = [], col = [], idx = [];
  const rockC = new THREE.Color('#56606e'), farC = new THREE.Color('#8ea3ba'), snowC = new THREE.Color('#e6edf4'), hazeC = new THREE.Color('#c4d8ec');
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= SEGA; i++) {
    const a = i / SEGA * Math.PI * 2, k = j / ROWS;
    // S-166: o mundo é quadrado — nos cantos a cordilheira distante começa depois da borda (antes ela nascia DENTRO do mapa,
    // perto do jogador, e aparecia como uma parede cinza sem forma)
    const sq = (HALF + 25) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), r0 = Math.max(R0, sq), r = r0 + (R1 - R0) * k;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const peak = ridged(a * 3.1, k * 2 + 3) * 0.6 + ridged(a * 7.3 + 2, k * 3) * 0.3 + vnoise(a * 17, k * 4) * 0.1;
    const gap = (c, w) => Math.exp(-Math.pow((((a - c) + Math.PI * 3) % (Math.PI * 2) - Math.PI) / w, 2));
    const seaGap = Math.max(gap(Math.PI / 4, 0.42), gap(-0.12, 0.5), gap(-1.56, 0.6)); // S-117: horizonte aberto sobre o mar (sudeste); expansão: e sobre os mares do leste e do norte
    const h = (j === 0 || j === ROWS ? 0 : 1) * (45 + peak * 120) * Math.sin(k * Math.PI) * (1 - seaGap * 0.97) - 4 - seaGap * 30;
    pos.push(x, h, z);
    const c = rockC.clone().lerp(farC, 0.6 + k * 0.3).lerp(hazeC, 0.35 + k * 0.25); // névoa azulada da distância
    if (h > 105 + vnoise(a * 9, k) * 25) c.lerp(snowC, 0.75);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEGA; i++) { const a = j * (SEGA + 1) + i, b = a + SEGA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, fog: false, side: THREE.DoubleSide }));
  m.renderOrder = -1;
  return m;
}

// água com ondas, brilho do sol, cor rasa perto da margem, espuma na beira e reflexo do céu
export function buildWater(L = LAKE, distFn = lakeDist, seg = 110) { // expansão: também a lagoa do oásis (buildWater(OASIS, oasisDist, 60))
  const LAKE = L, lakeDist = distFn; if (L === OASIS && OASIS.level == null) heightAt(OASIS.x, OASIS.z); // o nível do oásis sai do relevo
  const R = LAKE.r * 1.3 + 3;
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, depth = new Float32Array(p.count);
  const mask = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = LAKE.x + p.getX(i), z = LAKE.z + p.getZ(i);
    depth[i] = LAKE.level - heightAt(x, z);
    mask[i] = 1 - smooth(LAKE.r - 0.5, LAKE.r + 1.2, lakeDist(x, z)); // só existe água dentro do lago (nada de poças em buracos fora dele)
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1)); geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
  const mat = new THREE.MeshStandardMaterial({ color: '#2a6f9e', roughness: 0.18, metalness: 0.0, transparent: true, depthWrite: false });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'attribute float aDepth;\nattribute float aMask;\nvarying float vDepth;\nvarying float vMask;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vDepth = aDepth; vMask = aMask;
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nvarying float vDepth;\nvarying float vMask;\nvarying vec3 vWPos;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vDepth < -0.05 || vMask < 0.02) discard;
        float dk = smoothstep(0.0, 1.8, vDepth);
        diffuseColor.rgb = mix(vec3(0.20, 0.45, 0.42), vec3(0.04, 0.20, 0.34), dk);
        diffuseColor.a = mix(0.45, 0.93, smoothstep(0.0, 1.0, vDepth));
        float fo = smoothstep(0.12, 0.0, vDepth + 0.04 * sin(uTime * 1.7 + vWPos.x * 1.9 + vWPos.z * 1.4));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.92, 0.9), fo * 0.55);
        diffuseColor.a = max(diffuseColor.a, fo * 0.8);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float t = uTime; vec2 q = vWPos.xz;
          float a1 = q.x * 1.3 + t * 1.6, a2 = q.x * 2.9 + q.y * 1.7 + t * 2.3, a3 = q.x * 5.3 - q.y * 4.1 - t * 3.1, a4 = q.y * 1.1 - t * 1.3;
          float dx = 0.13 * cos(a1) + 0.17 * cos(a2) + 0.18 * cos(a3);
          float dz = 0.09 * cos(a4) + 0.10 * cos(a2) - 0.14 * cos(a3);
          vec3 wn = normalize(vec3(-dx * 0.35, 1.0, -dz * 0.35));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz); }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.52, 0.70, 0.86), fr * 0.4);
          gl_FragColor.a = mix(gl_FragColor.a, 1.0, fr * 0.5) * smoothstep(0.02, 0.6, vMask); }`);
  };
  const m = new THREE.Mesh(geo, mat);
  m.position.set(LAKE.x, LAKE.level, LAKE.z); m.receiveShadow = true; m.renderOrder = 2;
  return m;
}
// S-117: o mar do canto sudeste — mesma água do lago (cor pela profundidade, espuma na beira, ondas), em grande escala
// Expansão: cada mar tem a sua cor (rasa e funda) — por vértice, misturando suave onde dois mares se encontram (porto ↔ Costa Turquesa)
const SEA_COLORS = new Map([[SEA, [[0.22, 0.62, 0.60], [0.03, 0.22, 0.40]]], [SEA_TROPIC, [[0.30, 0.84, 0.77], [0.04, 0.40, 0.56]]], [SEA_NORTH, [[0.27, 0.42, 0.45], [0.05, 0.14, 0.21]]]]);
// planos de água (retângulos sem sobreposição) que cobrem o mar de cada costa, até um pouco além da borda do mundo
// (mantidos abaixo de x = HALF + 70: a Arena e as salas ficam em x > HALF + 100)
const SEA_RECTS = [[150, 700, 150, 700], [430, 700, -400, 150], [-440, 470, -720, -480]];
let seaMat = null;
export function buildSea() {
  const g = new THREE.Group();
  for (const [x0, x1, z0, z1] of SEA_RECTS) g.add(seaPlane(x0, x1, z0, z1));
  return g;
}
function seaPlane(x0, x1, z0, z1) {
  const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, STEP = 3;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W / STEP), Math.round(D / STEP)); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, depth = new Float32Array(p.count), mask = new Float32Array(p.count), shal = new Float32Array(p.count * 3), deep = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = cx + p.getX(i), z = cz + p.getZ(i); depth[i] = SEA.level - heightAt(x, z); mask[i] = 1 - smooth(-2, 6, seaDist(x, z));
    let dm = 1e9; const ds = SEAS.map(s => { const d = Math.hypot(x - s.x, z - s.z) - s.r; dm = Math.min(dm, d); return d; });
    let tw = 0; const a = [0, 0, 0], b = [0, 0, 0];
    SEAS.forEach((s, k) => { const w = Math.exp(-(ds[k] - dm) / 35), [cs, cd] = SEA_COLORS.get(s); tw += w; for (let c = 0; c < 3; c++) { a[c] += cs[c] * w; b[c] += cd[c] * w; } });
    for (let c = 0; c < 3; c++) { shal[i * 3 + c] = a[c] / tw; deep[i * 3 + c] = b[c] / tw; }
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1)); geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
  geo.setAttribute('aShal', new THREE.BufferAttribute(shal, 3)); geo.setAttribute('aDeep', new THREE.BufferAttribute(deep, 3));
  const mat = seaMat || (seaMat = new THREE.MeshStandardMaterial({ color: '#2a6f9e', roughness: 0.15, metalness: 0.0, transparent: true, depthWrite: false }));
  if (!mat.onBeforeCompile.__sea) mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'uniform float uTime;\nattribute float aDepth;\nattribute float aMask;\nattribute vec3 aShal;\nattribute vec3 aDeep;\nvarying vec3 vShal;\nvarying vec3 vDeep;\nvarying float vDepth;\nvarying float vMask;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vDepth = aDepth; vMask = aMask; vShal = aShal; vDeep = aDeep;
      vec3 wp0 = (modelMatrix * vec4(transformed, 1.0)).xyz;
      transformed.y += (sin(wp0.x * 0.11 + uTime * 1.1) * 0.12 + sin(wp0.z * 0.07 - uTime * 0.8) * 0.1) * smoothstep(0.5, 4.0, aDepth); // marulho em mar aberto
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vShal;\nvarying vec3 vDeep;\nvarying float vDepth;\nvarying float vMask;\nvarying vec3 vWPos;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vDepth < -0.1 || vMask < 0.02) discard;
        float dk = smoothstep(0.0, 5.0, vDepth);
        diffuseColor.rgb = mix(vShal, vDeep, dk);
        diffuseColor.a = mix(0.4, 0.95, smoothstep(0.0, 1.6, vDepth));
        float fo = smoothstep(0.22, 0.0, vDepth + 0.08 * sin(uTime * 1.3 + vWPos.x * 0.6 + vWPos.z * 0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 0.95), fo * 0.75);
        diffuseColor.a = max(diffuseColor.a, fo * 0.9);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float t = uTime; vec2 q = vWPos.xz * 0.5;
          float a1 = q.x * 1.3 + t * 1.2, a2 = q.x * 2.9 + q.y * 1.7 + t * 1.9, a3 = q.x * 5.3 - q.y * 4.1 - t * 2.6, a4 = q.y * 1.1 - t * 1.0;
          float dx = 0.13 * cos(a1) + 0.17 * cos(a2) + 0.15 * cos(a3), dz = 0.09 * cos(a4) + 0.10 * cos(a2) - 0.12 * cos(a3);
          normal = normalize((viewMatrix * vec4(normalize(vec3(-dx * 0.35, 1.0, -dz * 0.35)), 0.0)).xyz); }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.55, 0.74, 0.90), fr * 0.45);
          gl_FragColor.a = mix(gl_FragColor.a, 1.0, fr * 0.5) * smoothstep(0.02, 0.5, vMask); }`);
  };
  mat.onBeforeCompile.__sea = true;
  const m = new THREE.Mesh(geo, mat); m.position.set(cx, SEA.level, cz); m.receiveShadow = true; m.renderOrder = 2;
  return m;
}
/* ---------- Expansão (2026-11-11): cachoeira do platô da Costa Turquesa e blocos de gelo do mar do norte ---------- */
function fallMat(kind) { // água que escorre (faixas descendo) ou espuma (anéis), sem textura: só o tempo do vento (windUniform)
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0, emissive: '#5d7f88', emissiveIntensity: 0.6, transparent: true, depthWrite: false, side: THREE.DoubleSide }); // emissivo: a água nunca fica preta na sombra
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'attribute vec2 aFall;\nvarying vec2 vF;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vF = aFall;');
    sh.fragmentShader = 'uniform float uTime;\nvarying vec2 vF;\n' + sh.fragmentShader.replace('#include <color_fragment>', kind === 'fall' ? `#include <color_fragment>
      float col = floor(vF.x * 22.0), hh = fract(sin(col * 91.7) * 4375.5);
      float flow = fract(vF.y * 2.4 - uTime * (1.2 + hh * 0.7) + hh), streak = smoothstep(0.0, 0.3, flow) * smoothstep(1.0, 0.5, flow);
      float edge = smoothstep(0.0, 0.14, vF.x) * smoothstep(1.0, 0.86, vF.x);
      diffuseColor.rgb = mix(vec3(0.55, 0.83, 0.90), vec3(0.97, 0.99, 1.0), streak * 0.75 + vF.y * 0.25);
      diffuseColor.a = (0.45 + streak * 0.45) * edge;` : `#include <color_fragment>
      vec2 c = vF - 0.5; float r = length(c) * 2.0, a = atan(c.y, c.x);
      float ring = 0.5 + 0.5 * sin(r * 18.0 - uTime * 3.0 + sin(a * 7.0) * 0.8);
      diffuseColor.rgb = vec3(0.95, 0.98, 1.0); diffuseColor.a = smoothstep(1.0, 0.35, r) * (0.35 + ring * 0.4);`);
  };
  return m;
}
export function buildWaterfall() {
  mesaReady();
  const ul = Math.hypot(SEA_TROPIC.x - MESA.x, SEA_TROPIC.z - MESA.z), ux = (SEA_TROPIC.x - MESA.x) / ul, uz = (SEA_TROPIC.z - MESA.z) / ul;
  let rim = null, foot = null;
  for (let t = 0; t < 90; t += 0.5) { // anda do meio do platô em direção ao mar: borda (rim) e onde a água cai (foot)
    const x = MESA.x + ux * t, z = MESA.z + uz * t;
    if (mesaH(x, z) > MESA.top * 0.75) rim = { x, z, t, y: heightAt(x, z) };
    else if (rim && heightAt(x, z) < SEA.level + 0.15) { foot = { x, z, t }; break; }
  }
  if (!rim) return null;
  const g = new THREE.Group(), top = rim.y + 0.25, bot = SEA.level + 0.02, out = foot ? Math.min(7, Math.max(2, foot.t - rim.t + 0.5)) : 3, W = 4.4, N = 28, C = 6;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= N; j++) { const v = j / N, f = 0.3 + out * Math.pow(v, 1.2), y = top - (top - bot) * v; // quase vertical no alto (nada de lâmina deitada no topo)
    for (let i = 0; i <= C; i++) { const u = i / C - 0.5, sw = u * W * (1 + v * 0.3); pos.push(ux * f - uz * sw, y, uz * f + ux * sw); uv.push(i / C, v); } }
  for (let j = 0; j < N; j++) for (let i = 0; i < C; i++) { const a = j * (C + 1) + i, b = a + C + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('aFall', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals();
  const fall = new THREE.Mesh(fg, fallMat('fall')); fall.renderOrder = 3; g.add(fall);
  // véu de trás (mais largo e transparente): dá volume à queda
  const back = fall.clone(); back.scale.set(1.12, 1, 1.12); back.renderOrder = 3; g.add(back);
  const fx = ux * (0.2 + out), fz = uz * (0.2 + out);
  const cg = new THREE.CircleGeometry(5.5, 40); cg.rotateX(-Math.PI / 2); cg.setAttribute('aFall', cg.attributes.uv.clone());
  const foam = new THREE.Mesh(cg, fallMat('foam')); foam.position.set(fx, bot + 0.05, fz); foam.renderOrder = 4; g.add(foam);
  { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const sm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.4 });
    for (let k = 0; k < 3; k++) { const sp = new THREE.Sprite(sm); sp.scale.setScalar(6 + k * 2.5); sp.position.set(fx + (k - 1) * 1.5 * -uz, bot + 1.2 + k * 1.1, fz + (k - 1) * 1.5 * ux); g.add(sp); } } // névoa da queda
  g.position.set(rim.x, 0, rim.z); g.userData.asset = 'cachoeira'; g.userData.big = true;
  return g;
}
export function buildIceFloes(rng) {
  const geo = new THREE.CylinderGeometry(1, 1.12, 0.7, 8, 1); const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i), k = 0.82 + Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.32; P.setXYZ(i, P.getX(i) * k, y > 0 ? y + Math.abs(Math.sin(i * 7.31)) * 0.12 : y, P.getZ(i) * k); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#e6f2f7', roughness: 0.32, metalness: 0.02, emissive: '#5c7f92', emissiveIntensity: 0.12 });
  mat.onBeforeCompile = sh => { sh.uniforms.uTime = windUniform; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      transformed.y += sin(uTime * 0.7 + instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21) * 0.09; // balança devagar na água
    #endif`); };
  const spots = [];
  for (let k = 0; k < 2500 && spots.length < 46; k++) {
    const x = -420 + rng() * 870, z = -700 + rng() * 200, sd = seaDist(x, z), near = sd > -12;
    if (sd > -3 || sd < -150 || spots.some(p => Math.hypot(p.x - x, p.z - z) < (near ? 5 : 11))) continue;
    const s = near ? 0.7 + rng() * 1.2 : 1.4 + Math.pow(rng(), 2) * 5.5; spots.push({ x, z, s, r: rng() * 6.28 });
  }
  const im = new THREE.InstancedMesh(geo, mat, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach((p, i) => { q.setFromAxisAngle(v.set(0, 1, 0), p.r); sc.set(p.s * (0.8 + rng() * 0.4), 0.55 + rng() * 0.5, p.s * (0.8 + rng() * 0.4)); m4.compose(v.set(p.x, SEA.level - 0.22, p.z), q, sc); im.setMatrixAt(i, m4); });
  im.receiveShadow = true; im.castShadow = false; im.computeBoundingSphere(); im.userData.asset = 'gelo_flutuante'; im.userData.big = true;
  return im;
}
// o jogador e os monstros não entram no mar fundo (devolve a posição empurrada de volta para a praia)
export function seaPush(x, z, maxDepth = 8) { // maxDepth = metros mar adentro (≈ 1 m de fundura)
  const sd = seaDist(x, z); if (sd > -maxDepth) return null;
  const sea = lastSea, dx = x - sea.x, dz = z - sea.z, d = Math.hypot(dx, dz) || 1, k = (-maxDepth - sd) / d; // empurra para longe do centro do mar mais perto
  return { x: x + dx * k, z: z + dz * k };
}
// nível da superfície da água neste ponto (mar ou lago), ou null se não há água aqui — base da natação; costas e lagos novos entram aqui
export function waterLevelAt(x, z) {
  if (seaDist(x, z) < 6) return SEA.level;
  if (lakeDist(x, z) < LAKE.r + 1) return LAKE.level;
  return null;
}
// juncos e taboas na margem
export function buildReeds(rng) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 0.9 + i * 0.25, st = new THREE.CylinderGeometry(0.012, 0.02, h, 4); st.translate((i - 1.5) * 0.08, h / 2, (i % 2) * 0.07);
    st.rotateZ((i - 1.5) * 0.08); parts.push([st, '#5d7f3a']);
    if (i % 2 === 0) { const hd = new THREE.CapsuleGeometry(0.035, 0.16, 2, 6); hd.translate((i - 1.5) * 0.08 + (i - 1.5) * 0.08 * h, h + 0.05, (i % 2) * 0.07); parts.push([hd, '#6b4428']); }
  }
  for (let i = 0; i < 5; i++) { const lf = new THREE.PlaneGeometry(0.05, 0.8 + i * 0.12); lf.translate(0, 0.4 + i * 0.06, 0); lf.rotateZ((i - 2) * 0.25); lf.rotateY(i * 1.3); parts.push([lf, '#7a9a48']); }
  const geos = parts.map(([g, col]) => { const ng = g.index ? g.toNonIndexed() : g, c = new THREE.Color(col), n = ng.attributes.position.count, arr = new Float32Array(n * 3); for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; } ng.setAttribute('color', new THREE.BufferAttribute(arr, 3)); ng.deleteAttribute('uv'); if (ng.attributes.normal) ng.deleteAttribute('normal'); return ng; });
  const merged = mergeGeometries(geos); merged.computeVertexNormals();
  const inst = new THREE.InstancedMesh(merged, windMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 80);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; tries < 6000 && n < inst.count; tries++) {
    const a = rng() * Math.PI * 2, rr = LAKE.r * lakeShape(LAKE.x + Math.cos(a), LAKE.z + Math.sin(a)) * (0.95 + rng() * 0.12);
    const x = LAKE.x + Math.cos(a) * rr, z = LAKE.z + Math.sin(a) * rr;
    if (Math.sin(a * 3 + 0.7) < 0.2 || rng() < 0.3) continue; // em moitas, não um anel contínuo
    q.setFromAxisAngle(up, rng() * 6.28); const k = 0.55 + rng() * 0.4; s.set(k, k * (0.8 + rng() * 0.4), k);
    m.compose(v.set(x, Math.max(heightAt(x, z), LAKE.level - 0.5), z), q, s); inst.setMatrixAt(n++, m);
  }
  inst.count = n; inst.castShadow = true;
  return inst;
}
// vitórias-régias (estilo Victoria amazonica): folha redonda e lisa com a borda levantada, nervuras e uma fendinha na borda
export function lilyPadGeometry(seed, r) {
  let a = seed; const rng = () => ((a = (a * 16807 + 11) % 2147483647) / 2147483647);
  const RS = 72, RINGS = 10, pos = [], col = [], idx = [];
  const leaf = new THREE.Color('#4f8f34'), vein = new THREE.Color('#7fb45a'), dark = new THREE.Color('#3a6f28'), rimOut = new THREE.Color('#8a3446'), rimIn = new THREE.Color('#5d9a3e');
  const gap = 0.08 + rng() * 0.05, gapAt = rng() * Math.PI * 2; // fenda estreita só na borda
  const rimH = r * (0.09 + rng() * 0.03);
  const prof = [];
  for (let k = 0; k <= RINGS; k++) prof.push([r * k / RINGS * 0.97, 0.02 + (k / RINGS) * (k / RINGS) * 0.03, 'top']);
  prof.push([r * 0.985, rimH * 0.55, 'rimIn'], [r * 1.0, rimH, 'lip'], [r * 1.025, rimH * 0.6, 'rimOut'], [r * 1.02, 0.0, 'rimOut']);
  for (let k = 0; k < prof.length; k++) for (let j = 0; j <= RS; j++) {
    const ang = j / RS * Math.PI * 2, [rr, yy, part] = prof[k];
    const da = Math.abs(((ang - gapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI), inGap = da < gap / 2;
    const y = part === 'top' ? yy + Math.sin(ang * 5 + rr * 3) * 0.004 : inGap ? Math.min(yy, 0.03) : yy;
    pos.push(Math.cos(ang) * rr, y, Math.sin(ang) * rr);
    const c = new THREE.Color();
    if (part === 'top') { const v = Math.pow(Math.abs(Math.cos(ang * 14)), 18) * Math.min(1, rr / (r * 0.3)); c.copy(leaf).lerp(dark, 0.25 * (1 - rr / r)).lerp(vein, v * 0.75); c.offsetHSL(0, 0, (rng() - 0.5) * 0.03); }
    else c.copy(part === 'rimOut' ? rimOut : part === 'lip' ? rimOut.clone().lerp(rimIn, 0.4) : rimIn);
    col.push(c.r, c.g, c.b);
  }
  for (let k = 0; k < prof.length - 1; k++) for (let j = 0; j < RS; j++) { const p0 = k * (RS + 1) + j, p1 = p0 + RS + 1; idx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1); } // virado para cima
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g = g.toNonIndexed(); g.computeVertexNormals();
  const parts = [g];
  if (rng() < 0.4) { // flor grande branco-rosada em camadas
    const fx = (rng() - 0.5) * r * 0.6, fz = (rng() - 0.5) * r * 0.6;
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 9; i++) {
      const pt = new THREE.SphereGeometry(0.09 - layer * 0.015, 8, 6); pt.scale(0.55, 0.25, 1.6); pt.translate(0, 0, 0.12 - layer * 0.02); pt.rotateX(-0.35 - layer * 0.35); pt.rotateY(i / 9 * Math.PI * 2 + layer * 0.35); pt.translate(fx, 0.09 + layer * 0.04, fz);
      const ng = pt.toNonIndexed(), n = ng.attributes.position.count, cc = new THREE.Color(layer === 2 ? '#ffd2e2' : layer ? '#fff4f8' : '#ffffff'), arr = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) { arr[v * 3] = cc.r; arr[v * 3 + 1] = cc.g; arr[v * 3 + 2] = cc.b; }
      ng.setAttribute('color', new THREE.BufferAttribute(arr, 3)); ng.deleteAttribute('uv'); parts.push(ng);
    }
    const cen = new THREE.SphereGeometry(0.05, 8, 6).toNonIndexed(); cen.translate(fx, 0.2, fz); const n = cen.attributes.position.count, arr = new Float32Array(n * 3); for (let v = 0; v < n; v++) { arr[v * 3] = 1; arr[v * 3 + 1] = 0.82; arr[v * 3 + 2] = 0.25; } cen.setAttribute('color', new THREE.BufferAttribute(arr, 3)); cen.deleteAttribute('uv'); parts.push(cen);
  }
  return mergeGeometries(parts);
}
// céu com gradiente (cúpula)
export function buildSky(top = '#4f9be8', horizon = '#cfe7ff') {
  const geo = new THREE.SphereGeometry(880, 32, 16);
  const ct = new THREE.Color(top), ch = new THREE.Color(horizon);
  const cols = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / 880); const c = ch.clone().lerp(ct, Math.pow(k, 0.6)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

// grama de verdade: tufos de lâminas curvas que balançam com o vento + flores + pedregulhos
const windUniform = { value: 0 };
export function updateNature(time) { windUniform.value = time; }
// tufos baixos e finos (3 formatos diferentes para não parecerem carimbos iguais)
function tuftGeometry(rng, variant = 0) {
  const pos = [], col = [], idx = [];
  const base = new THREE.Color('#4f8a36'), tip = new THREE.Color(['#a8d470', '#b8dc7c', '#9cc868'][variant % 3]);
  const blades = 7 + variant * 3;
  for (let b = 0; b < blades; b++) {
    const ang = rng() * Math.PI * 2, lean = 0.03 + rng() * 0.12, h = 0.09 + rng() * (0.12 + variant * 0.04), w = 0.016 + rng() * 0.012;
    const spread = 0.04 + variant * 0.05, dx = Math.cos(ang), dz = Math.sin(ang), rr = rng() * spread, ox = Math.cos(ang + 1.3) * rr, oz = Math.sin(ang + 1.3) * rr;
    const seg = 2, start = pos.length / 3; // 2 segmentos bastam para lâminas tão curtas
    for (let s = 0; s <= seg; s++) {
      const k = s / seg, y = h * k, bend = lean * k * k, ww = w * (1 - k * 0.9);
      const cx = ox + dx * bend, cz = oz + dz * bend;
      pos.push(cx - dz * ww, y, cz + dx * ww, cx + dz * ww, y, cz - dx * ww);
      const c = base.clone().lerp(tip, k);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let s = 0; s < seg; s++) { const i = start + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function windMaterial(opts) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sway = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.25) * 0.5 + sin(uWind * 3.1 + ip.x * 0.9) * 0.2;
      transformed.x += sway * 0.09 * transformed.y * transformed.y * 6.0;
      transformed.z += sway * 0.05 * transformed.y * transformed.y * 6.0;`);
  };
  return m;
}
/* S-153: flores nascem juntinhas, em touceiras — um tufo de folhas com hastes curvas e finas (que se inclinam
   para lados diferentes) e várias flores de 5–6 pétalas viradas para o sol. Regra: nunca flor solta no chão.
   A cor das pétalas vem da instância (cor branca no vértice = recebe a cor); folhas e hastes ficam verdes. */
function flowerGeometry(seed = 3) {
  let sd = seed * 9301 + 49297; const rng = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const G = [{ pos: [], col: [], idx: [] }, { pos: [], col: [], idx: [] }]; let pos, col, idx; // [0] folhas e hastes, [1] flores (recebem a cor da instância)
  const use = k => { ({ pos, col, idx } = G[k]); }; use(0);
  const leafA = new THREE.Color('#3f7a2c'), leafB = new THREE.Color('#6aa548'), stemC = new THREE.Color('#4a8a34'), petal = new THREE.Color('#ffffff'), heart = new THREE.Color('#e8b020');
  const quad = (p0, p1, p2, p3, c0, c1) => { const i = pos.length / 3; pos.push(...p0, ...p1, ...p2, ...p3); col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c1.r, c1.g, c1.b); idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); };
  // folhas do tufo: lâminas largas, arqueadas para fora
  for (let k = 0; k < 16; k++) {
    const ang = rng() * Math.PI * 2, len = 0.07 + rng() * 0.07, w = 0.02 + rng() * 0.012, dx = Math.cos(ang), dz = Math.sin(ang), seg = 3;
    let px = dx * 0.02, pz = dz * 0.02, py = 0;
    for (let sg = 0; sg < seg; sg++) {
      const t0 = sg / seg, t1 = (sg + 1) / seg, out = len / seg, up0 = 0.08 * (1 - t0 * t0), up1 = 0.08 * (1 - t1 * t1);
      const nx = px + dx * out, nz = pz + dz * out, ny = py + (up1 - up0) + len * 0.3 / seg * (1 - t1 * 1.6);
      const w0 = w * Math.sin(Math.PI * (0.15 + t0 * 0.85)), w1 = w * Math.sin(Math.PI * (0.15 + t1 * 0.85)) * (sg === seg - 1 ? 0.15 : 1);
      quad([px - dz * w0, py, pz + dx * w0], [px + dz * w0, py, pz - dx * w0], [nx - dz * w1, ny, nz + dx * w1], [nx + dz * w1, ny, nz - dx * w1], leafA.clone().lerp(leafB, t0), leafA.clone().lerp(leafB, t1));
      px = nx; pz = nz; py = ny;
    }
  }
  // hastes curvas com flor na ponta
  const nf = 7 + Math.floor(rng() * 5);
  for (let f = 0; f < nf; f++) {
    const ang = rng() * Math.PI * 2, r0 = rng() * 0.07, H = 0.09 + rng() * 0.11, lean = 0.03 + rng() * 0.06, dx = Math.cos(ang), dz = Math.sin(ang);
    const pt = t => [Math.cos(ang) * r0 + dx * lean * t * t + Math.sin(t * 3 + f) * 0.008, H * t, Math.sin(ang) * r0 + dz * lean * t * t];
    const seg = 5, sw = 0.0045;
    for (let sg = 0; sg < seg; sg++) { const a0 = pt(sg / seg), a1 = pt((sg + 1) / seg); quad([a0[0] - sw, a0[1], a0[2]], [a0[0] + sw, a0[1], a0[2]], [a1[0] - sw, a1[1], a1[2]], [a1[0] + sw, a1[1], a1[2]], stemC, stemC); quad([a0[0], a0[1], a0[2] - sw], [a0[0], a0[1], a0[2] + sw], [a1[0], a1[1], a1[2] - sw], [a1[0], a1[1], a1[2] + sw], stemC, stemC); }
    // flor: pétalas em forma de gota, levemente em taça, inclinada como a haste
    const top = pt(1), np = 5 + (f % 2), pr = 0.03 + rng() * 0.016, tilt = 0.35 + rng() * 0.3;
    use(1);
    const ci = pos.length / 3; pos.push(top[0], top[1] + 0.006, top[2]); col.push(heart.r, heart.g, heart.b);
    for (let k = 0; k < np; k++) {
      const a0 = k / np * Math.PI * 2 + f, a1 = a0 + Math.PI * 2 / np * 0.5, a2 = a0 + Math.PI * 2 / np;
      const P = (a, r, y) => [top[0] + Math.cos(a) * r + dx * tilt * r * 0.6, top[1] + y + r * 0.35 - (dx * Math.cos(a) + dz * Math.sin(a)) * r * tilt, top[2] + Math.sin(a) * r + dz * tilt * r * 0.6];
      const i0 = pos.length / 3; const pa = P(a0, pr * 0.55, 0), pm = P(a1, pr * 1.15, 0.004), pb = P(a2, pr * 0.55, 0);
      pos.push(...pa, ...pm, ...pb); for (let q = 0; q < 3; q++) col.push(petal.r, petal.g, petal.b);
      idx.push(ci, i0, i0 + 1, ci, i0 + 1, i0 + 2);
    }
    use(0);
  }
  // pétalas: as duas faces viradas para cima (iluminadas pelo sol dos dois lados, nada de pétala preta)
  { const P = G[1]; const n = P.idx.length; for (let k = 0; k < n; k += 3) P.idx.push(P.idx[k], P.idx[k + 2], P.idx[k + 1]); }
  return G.map(({ pos, col, idx }, gi) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (gi === 1) { const N = g.attributes.normal; for (let k = 0; k < N.count; k++) { const v = new THREE.Vector3(N.getX(k) * 0.3, 1, N.getZ(k) * 0.3).normalize(); N.setXYZ(k, v.x, v.y, v.z); } }
    return g; });
}
// escombros (S-161): lascas de pedra quebrada com faces de corte, não bolinhas redondas
function rubbleGeometry() {
  const g = mergeVerticesSafe(new THREE.IcosahedronGeometry(0.2, 1)), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 23 + 1) * Math.cos(v.z * 19) * 0.25 + Math.sin(v.y * 31) * 0.1; v.multiplyScalar(1 + n); v.y = Math.max(v.y * 0.6, -0.06); p.setXYZ(i, v.x * 1.3, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function mergeVerticesSafe(g) { const pa = g.attributes.position; const map = new Map(), idx = [], pos = []; for (let i = 0; i < pa.count; i++) { const k = `${pa.getX(i).toFixed(4)},${pa.getY(i).toFixed(4)},${pa.getZ(i).toFixed(4)}`; let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); } idx.push(j); } const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out; }
const grassChunks = [];
// grama em blocos de 50 m gerados conforme o jogador chega perto (o mundo é grande demais para gerar tudo de uma vez)
const GCH = 50, GN = Math.ceil(HALF * 2 / GCH); // ceil: o último bloco passa um pouco da borda (nada de faixa sem grama)
let grassRoot = null, grassMat = null, flowerMat = null, petalMat = null, tuftGeos = null, flowerGeo = null, rubbleGeo = null, rubbleMat = null;
const grassMade = new Map();
const PETAL = ['#ffd84a', '#ff7aa8', '#ffffff', '#b48cff', '#ff9a4a', '#7ad0ff'].map(c => new THREE.Color(c));
const C_FOREST = new THREE.Color('#7fa07a'), C_RUINS = new THREE.Color('#c8b98a'), C_GOLD = new THREE.Color('#b8a676'), C_FROST = new THREE.Color('#dfe9ef'), C_DRY = new THREE.Color('#d8c48a');
function grassChunk(ci, cj) {
  let sd = (ci * 7919 + cj * 104729 + 99) % 2147483647 || 1;
  const rng = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const x0 = -HALF + ci * GCH, z0 = -HALF + cj * GCH, cx = x0 + GCH / 2, cz = z0 + GCH / 2;
  const valley = Math.abs(cx) < 130 && Math.abs(cz) < 130;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  const tuft = [[], [], []], flw = [], rub = [];
  const tries = GCH * GCH * 0.75;
  for (let k = 0; k < tries; k++) {
    const x = x0 + rng() * GCH, z = z0 + rng() * GCH;
    if (Math.abs(x) > PLAY_LIMIT || Math.abs(z) > PLAY_LIMIT) continue;
    if (lakeDist(x, z) < LAKE.r + 1.5 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 12 || Math.hypot(x - CITY2.x, z - CITY2.z) < 27 || Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 31) continue;
    if (Math.hypot(x - FROZEN.x, z - FROZEN.z) < FROZEN.r * 1.05) continue;
    if (x < -470 && ICE_LAKES.some(L => Math.hypot(x - L.x, z - L.z) < L.r * 1.05)) continue; // gelo dos Ermos
    const oas = z > 400 ? 1 - smooth(OASIS.r + 6, OASIS.r + 22, oasisDist(x, z)) : 0; if (oas > 0 && oasisDist(x, z) < OASIS.r + 1) continue; // oásis: sem grama dentro d'água, capim verde em volta
    if (x > 420) { const me = mesaH(x, z); if (me > 0.5 && me < MESA.top - 2.5) continue; } // paredão do platô
    { const dx = x - CASTLE.x, dz = z - CASTLE.z; if (Math.abs(dx) < 80 && Math.abs(dz) < 80 && Math.abs(dx * CASTLE_CS - dz * CASTLE_SN) < 56 && Math.abs(dx * CASTLE_SN + dz * CASTLE_CS) < 56) continue; } // S-275: nada de grama no pátio calçado, na muralha e no fosso do castelo
    { const dd = Math.hypot(x - DWARF.x, z - DWARF.z); if (dd < 150 && rng() > smooth(75, 150, dd)) continue; } // S-164: a grama vai sumindo antes de Pedrafunda
    if (seaDist(x, z) < 24 || Math.hypot(x - DWARF.x, z - DWARF.z) < 64 || Math.hypot(x - PORT.x, z - PORT.z) < 20 || (harborW(x, z) > 0.3 && harborST(x, z).s > HARBOR.quay - 14) || Math.hypot(x - ELF.x, z - ELF.z) < 16) continue; // praia, mar e praças
    if (mountainMask(x, z) > 0.35) continue;
    const y = heightAt(x, z);
    if (valley && y > 7) continue;
    const ruins = valley ? zoneWeight('ruinas', x, z) : 0, forest = valley ? zoneWeight('floresta', x, z) : 0;
    const bw = biome(x, z), wD = bw.dunas * coastBelt(x, z) * (1 - oas), wG = bw.geada, wC = bw.colossos;
    q.setFromAxisAngle(up, rng() * 6.28);
    // densidade de planta pela mistura de regiões: deserto quase nada, neve pouco, planície dos colossos capim alto (transição gradual)
    // S-249: na areia, nada de tufos espalhados por todo canto — só em poucas manchas (baixadas onde a água empoça), em touceiras
    const sandy = smooth(0.08, 0.45, wD);
    if (sandy > 0) { const patch = vnoise(x * 0.04 + 31.7, z * 0.04 - 12.3), inPatch = patch > 0.86 && rng() < 0.3; if (!inPatch && rng() < sandy * 0.995 + 0.005) { if (wD > 0.5 && rng() < 0.012) { sc.set(0.4 + rng() * 1.6, 0.3 + rng() * 0.7, 0.4 + rng() * 1.4); m.compose(v.set(x, y + 0.02, z), q, sc); rub.push(m.clone()); } continue; } }
    const dens = 1 - wD * 0.45 - wG * 0.8 - wC * 0.72; // S-161: Ruínas dos Colossos = terra arrasada, pouca grama
    if (wG > 0.15) { const patch = vnoise(x * 0.07, z * 0.07), cover = smooth(0.12, 0.55, wG); if (patch > 0.6 - cover * 0.45 - 0.04 || rng() < cover * 0.55) continue; } // S-227: na neve, só tufinhos onde o chão aparece (as manchas sem neve), nunca no meio da neve
    if (rng() > dens) { if ((wD > 0.5 && rng() < 0.02) || (wC > 0.4 && rng() < 0.012)) { /* S-301: bem menos lascas soltas na planície dos colossos */ sc.set(0.4 + rng() * 1.6, 0.3 + rng() * 0.7, 0.4 + rng() * 1.4); m.compose(v.set(x, y + 0.02, z), q, sc); rub.push(m.clone()); } continue; } // escombros e lascas de pedra pelo chão
    if (ruins > 0.55) {
      if (rng() < 0.5) { sc.set(0.6 + rng() * 1.4, 0.4 + rng() * 0.6, 0.6 + rng() * 1.4); m.compose(v.set(x, y + 0.03, z), q, sc); rub.push(m.clone()); continue; }
      if (rng() < 0.75) continue;
    }
    if (roadDist(x, z) < 2.2) continue; // estradas limpas
    if (rng() < 0.004 && forest < 0.5 && ruins < 0.3 && wG < 0.3 && wD < 0.3 && wC < 0.3) {
      // S-153: flores só em canteirinhos (3–7 touceiras juntas, da mesma cor), nunca soltas
      const pc = PETAL[Math.floor(rng() * PETAL.length)], nC = 3 + Math.floor(rng() * 5);
      for (let c = 0; c < nC; c++) { const fx = x + (rng() - 0.5) * 1.6, fz = z + (rng() - 0.5) * 1.6; q.setFromAxisAngle(up, rng() * 6.28); sc.setScalar(0.8 + rng() * 0.5); m.compose(v.set(fx, heightAt(fx, fz) - 0.01, fz), q, sc); flw.push([m.clone(), pc.clone().offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.08)]); }
    } else if (rng() < 0.75) {
      const tall = 1 - wC * 0.3; // capim baixo e ralo na terra arrasada
      const kk = 0.8 + rng() * 0.6; sc.set(kk, kk * (0.7 + rng() * 0.6) * tall, kk); m.compose(v.set(x, y - 0.01, z), q, sc);
      tint.setRGB(1, 1, 1).lerp(C_FOREST, forest * 0.6).lerp(C_RUINS, ruins * 0.8).lerp(C_GOLD, wC * 0.55).lerp(C_FROST, wG * 0.8).lerp(C_DRY, wD).multiplyScalar(0.85 + rng() * 0.3);
      tuft[Math.floor(rng() * 3)].push([m.clone(), tint.clone()]);
    }
  }
  const g = new THREE.Group(); g.userData.cx = cx; g.userData.cz = cz;
  tuft.forEach((arr, vi) => { if (!arr.length) return; const mesh = new THREE.InstancedMesh(tuftGeos[vi], grassMat, arr.length); mesh.receiveShadow = true; arr.forEach(([mm, cc], i) => { mesh.setMatrixAt(i, mm); mesh.setColorAt(i, cc); }); mesh.computeBoundingSphere(); g.add(mesh); });
  if (flw.length) { // touceira (folhas/hastes) + flores coloridas, mesmas matrizes
    const lv = new THREE.InstancedMesh(flowerGeo[0], flowerMat, flw.length), f = new THREE.InstancedMesh(flowerGeo[1], petalMat, flw.length);
    flw.forEach(([mm, cc], i) => { lv.setMatrixAt(i, mm); f.setMatrixAt(i, mm); f.setColorAt(i, cc); }); lv.computeBoundingSphere(); f.computeBoundingSphere(); g.add(lv, f);
  }
  if (rub.length) { const r = new THREE.InstancedMesh(rubbleGeo, rubbleMat, rub.length); rub.forEach((mm, i) => r.setMatrixAt(i, mm)); r.castShadow = r.receiveShadow = true; r.computeBoundingSphere(); g.add(r); }
  return g;
}
// qualidade gráfica: até onde a grama aparece (0 = sem grama)
let GRASS_VIS = 131;
export function setGrassRange(r) { GRASS_VIS = r; if (grassRoot) grassRoot.visible = r > 0; }
// visibilidade (e geração/descarte) dos blocos de grama perto do jogador
export function cullGrass(x, z, force = false) {
  if (!grassRoot || GRASS_VIS <= 0) return;
  let made = 0;
  const ci0 = Math.floor((x + HALF) / GCH), cj0 = Math.floor((z + HALF) / GCH);
  const R = Math.ceil((GRASS_VIS + 9) / GCH) + 1;
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const ci = ci0 + di, cj = cj0 + dj; if (ci < 0 || cj < 0 || ci >= GN || cj >= GN) continue;
    const key = ci * 1000 + cj; if (grassMade.has(key) || (made && !force)) continue;
    const ccx = -HALF + (ci + 0.5) * GCH, ccz = -HALF + (cj + 0.5) * GCH;
    if (Math.hypot(ccx - x, ccz - z) > GRASS_VIS + 9) continue;
    const g = grassChunk(ci, cj); grassMade.set(key, g); grassRoot.add(g); grassChunks.push(g); made++; // no máximo 1 bloco novo por quadro
  }
  for (const [key, g] of grassMade) {
    const d = Math.hypot(g.userData.cx - x, g.userData.cz - z);
    g.visible = d < GRASS_VIS;
    if (d > Math.max(280, GRASS_VIS * 2)) { grassRoot.remove(g); g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); grassMade.delete(key); grassChunks.splice(grassChunks.indexOf(g), 1); } // longe demais: libera a memória
  }
}
export function buildGrass(rng) {
  grassRoot = new THREE.Group();
  grassMat = windMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  flowerMat = windMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }); petalMat = windMaterial({ vertexColors: true, roughness: 0.6 });
  tuftGeos = [0, 1, 2].map(v => tuftGeometry(rng, v)); flowerGeo = flowerGeometry();
  rubbleGeo = rubbleGeometry(); rubbleMat = new THREE.MeshStandardMaterial({ color: '#8a857a', roughness: 1 });
  return grassRoot;
}
