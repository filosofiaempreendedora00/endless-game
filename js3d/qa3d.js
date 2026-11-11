/* =========================================================================
   VERIFICADOR DO MUNDO (P-003) e TESTE DE MÚSICA (P-004)
   Roda por script (__api.qa()) ou pelo Painel do Mestre ("🔍 Verificar o mundo").
   Devolve um relatório: [{ tipo, gravidade: 'alta'|'media'|'baixa', objeto, x, z, detalhe }]
   - flutuando / enterrado (cenário em `placed`)
   - árvore em encosta íngreme
   - prédio com base fora do chão
   - colisão menor que o objeto (dá para atravessar)
   - NPC dentro de objeto
   - peças de personagem fora do corpo (arma fora da mão, chapéu/elmo solto, peça longe do osso)
   - música: trocar de zona, entrar/sair de casa, arena e masmorra → só uma música por vez
   ========================================================================= */
import * as THREE from 'three';

const SKIP = /^(cloud|mountain|lily|barco|veleiro|navio|galeao|calcamento|neve|ponte|cais|quebra_mar|redes|mar|prancha|estaleiro|lago|bote)/;
const TREE = /^(oak|oakdark|pine|pinedark|pinesnow|tree|trees|palmeira|arvore)/;
const BUILDING = /(home|tavern|taverna|church|igreja|blacksmith|ferraria|market|windmill|tower|casa|estabulo|salao|templo|armazem|guilda|alojamento|arsenal|corvaria|torreao|castelo|portao|muralha|wall)/;
const _b = new THREE.Box3(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();

function localBox(obj) { // caixa do objeto no espaço dele (não infla com a rotação)
  obj.updateMatrixWorld(true); const inv = _m.copy(obj.matrixWorld).invert(), box = new THREE.Box3(), tmp = new THREE.Box3(), mm = new THREE.Matrix4();
  obj.traverse(o => { if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(inv, o.matrixWorld)); box.union(tmp); });
  return box;
}
// menor vão entre os vértices mais baixos (até 25 cm acima do fundo) e o chão logo abaixo de cada um
function baseGap(obj, bottom, groundAt) {
  let best = Infinity; const v = new THREE.Vector3();
  obj.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const P = o.geometry.attributes.position, st = Math.max(1, Math.floor(P.count / 1500));
    for (let i = 0; i < P.count; i += st) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); if (v.y > bottom + 0.25) continue; best = Math.min(best, v.y - groundAt(v.x, v.z)); }
  });
  return best === Infinity ? 0 : best;
}
function insideCollider(c, x, z) {
  const dx = x - c.x, dz = z - c.z;
  if (c.box) { const cs = Math.cos(c.rot), sn = Math.sin(c.rot), lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= c.hx && Math.abs(lz) <= c.hz; }
  return dx * dx + dz * dz <= c.r * c.r;
}

export function checkWorld(ctx) {
  const { placed, colliders, groundAt, heightAt, HALF } = ctx, out = [];
  const near = (x, z, R) => colliders.filter(c => Math.abs(c.x - x) < R + (c.r || 1) && Math.abs(c.z - z) < R + (c.r || 1));
  for (const obj of placed) {
    const a = obj.userData.asset || ''; if (!a || obj.userData.big || SKIP.test(a)) continue;
    obj.updateMatrixWorld(true); _b.setFromObject(obj); if (_b.isEmpty()) continue;
    const lb = localBox(obj); if (lb.isEmpty()) continue;
    const sx = obj.getWorldScale(_v).x, x = obj.position.x, z = obj.position.z, inRoom = x > HALF + 100;
    const W = (lx, lz) => { const p = new THREE.Vector3(lx, 0, lz).applyMatrix4(obj.matrixWorld); return [p.x, p.z]; };
    const hx = (lb.max.x - lb.min.x) / 2, hz = (lb.max.z - lb.min.z) / 2, cx = (lb.max.x + lb.min.x) / 2, cz = (lb.max.z + lb.min.z) / 2;
    const foot = Math.max(hx, hz) * sx, height = _b.max.y - _b.min.y;
    // chão sob o objeto: centro + cantos (75% da pegada)
    const pts = [[cx, cz], [cx - hx * 0.75, cz - hz * 0.75], [cx + hx * 0.75, cz - hz * 0.75], [cx - hx * 0.75, cz + hz * 0.75], [cx + hx * 0.75, cz + hz * 0.75]].map(([u, v]) => W(u, v));
    const gs = pts.map(([px, pz]) => groundAt(px, pz)), gMin = Math.min(...gs), gMax = Math.max(...gs), bottom = _b.min.y;
    const isB = BUILDING.test(a), isT = TREE.test(a);
    if (bottom - gMin > (isB ? 0.3 : 0.25) && foot < 60 && !/^(tabela|placa|poster|banner|lanterna)/.test(a)) { // placas/estandartes ficam presos na parede, no alto // candidato: mede o vão de verdade nos vértices da base (a copa larga numa encosta engana a pegada)
      const gap = baseGap(obj, bottom, groundAt);
      if (gap > (isB ? 0.3 : 0.25)) out.push({ tipo: 'flutuando', gravidade: gap > 0.8 ? 'alta' : 'media', objeto: a, x, z, detalhe: `base ${gap.toFixed(2)} m acima do chão` });
    } else if (_b.max.y < Math.min(gMin, groundAt(x, z)) - 0.05 && height < 30) out.push({ tipo: 'enterrado', gravidade: 'baixa', objeto: a, x, z, detalhe: `inteiro ${(Math.min(gMin, groundAt(x, z)) - _b.max.y).toFixed(2)} m abaixo do chão (invisível)` });
    if (isT && !inRoom) { const d = 1.2, gx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d), gz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d), ang = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
      if (ang > 40) out.push({ tipo: 'árvore em encosta', gravidade: ang > 50 ? 'media' : 'baixa', objeto: a, x, z, detalhe: `inclinação ${ang.toFixed(0)}°` }); }
    if (isB && foot > 1.5 && foot < 40) { // prédio: algum canto com vão por baixo
      const corners = [[lb.min.x, lb.min.z], [lb.max.x, lb.min.z], [lb.min.x, lb.max.z], [lb.max.x, lb.max.z]].map(([u, v]) => W(u * 0.92, v * 0.92));
      const gap = Math.max(...corners.map(([px, pz]) => bottom - groundAt(px, pz)));
      if (gap > 0.35) out.push({ tipo: 'prédio com base no ar', gravidade: gap > 0.9 ? 'alta' : 'media', objeto: a, x, z, detalhe: `vão de ${gap.toFixed(2)} m sob um canto` });
    }
    // colisão: sólido alto que não é árvore — quanto da pegada está coberta por colisão
    if (!isT && height > 1.1 && foot > 0.7 && obj.userData.solid !== false && !/^(flag|banner|mastro|calcada|ossos|tabela|lanterna|fonte|portal|portao|arco)/.test(a)) { // portões e arcos têm passagem no meio de propósito // bandeiras, calçadas e ossadas são de passar por cima/por dentro
      const cs = near(x, z, foot + 2); let tot = 0, hit = 0;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const [px, pz] = W(cx + hx * 0.7 * i / 2, cz + hz * 0.7 * j / 2); tot++; if (cs.some(c => insideCollider(c, px, pz))) hit++; }
      const cov = hit / tot, lim = isB ? 0.5 : 0.25;
      if (cov < lim) out.push({ tipo: cov === 0 ? 'sem colisão' : 'colisão menor que o objeto', gravidade: isB ? 'alta' : cov === 0 && foot > 1.5 ? 'media' : 'baixa', objeto: a, x, z, detalhe: `colisão cobre ${(cov * 100).toFixed(0)}% da base (${(foot * 2).toFixed(1)} m)` });
    }
  }
  // NPCs dentro de objetos (fora o próprio círculo do NPC)
  for (const n of ctx.S.npcs || []) {
    const cs = near(n.x, n.z, 1).filter(c => !(Math.abs(c.x - n.x) < 0.01 && Math.abs(c.z - n.z) < 0.01 && !c.box && Math.abs(c.r - 0.6) < 0.01));
    const inside = cs.find(c => insideCollider(c, n.x, n.z) && !(c.y1 !== undefined));
    if (inside) out.push({ tipo: 'NPC dentro de objeto', gravidade: inside.box ? 'baixa' : 'media', /* caixa de prédio costuma incluir alpendre/pórtico (NPC na porta); círculo = adereço (banca, mesa, trono) */ objeto: n.name || n.id, x: n.x, z: n.z, detalhe: `dentro de ${inside.name || (inside.box ? 'caixa' : 'círculo')} de colisão` });
  }
  return out;
}

// peças presas aos ossos: arma fora da mão, chapéu/elmo solto, peça longe do osso
function checkRig(root, label, x = 0, z = 0) {
  const out = []; root.updateMatrixWorld(true);
  const bp = new THREE.Vector3(), box = new THREE.Box3();
  root.traverse(b => {
    if (!b.isBone) return;
    for (const c of b.children) {
      if (c.isBone || c.isSkinnedMesh || !c.visible) continue;
      let has = false; c.traverse(o => { if (o.isMesh && o.visible && !o.isPoints) has = true; }); if (!has) continue;
      box.makeEmpty(); c.traverse(o => { if (o.isMesh && o.visible && !o.isPoints) { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && (m.transparent && m.opacity < 0.6 || m.blending === THREE.AdditiveBlending)) return; box.expandByObject(o, true); } });
      if (box.isEmpty()) continue;
      b.getWorldPosition(bp); const d = box.distanceToPoint(bp), nm = c.name || (c.children[0] && c.children[0].name) || 'peça';
      // o osso Head fica na base do crânio: chapéu/elmo encaixado fica a até ~22 cm dele; mais que isso = flutuando
      if (/^hand_[lr]$/.test(b.name) && d > 0.1) out.push({ tipo: 'arma fora da mão', gravidade: 'alta', objeto: `${label} · ${nm}`, x, z, detalhe: `${(d * 100).toFixed(0)} cm da mão (${b.name})` });
      else if (/^Head$/.test(b.name) && d > 0.26) out.push({ tipo: 'peça solta na cabeça', gravidade: 'alta', objeto: `${label} · ${nm}`, x, z, detalhe: `${(d * 100).toFixed(0)} cm da cabeça` });
      else if (d > 0.3 && !/^spine|^pelvis|^root/.test(b.name)) out.push({ tipo: 'peça longe do corpo', gravidade: 'media', objeto: `${label} · ${nm}`, x, z, detalhe: `${(d * 100).toFixed(0)} cm do osso ${b.name}` }); // no tronco ficam efeitos que flutuam de propósito (grimório, runas)
    }
  });
  return out;
}

export function checkCharacters(ctx) {
  const out = [], { makeHero, CLASSES } = ctx;
  if (makeHero && CLASSES) for (const cls of Object.keys(CLASSES)) for (const race of ['humano', 'anao']) {
    try {
      const { ch, d } = makeHero(cls, { race, sex: 'm', skin: 'clara', hair: { style: 'curto', color: 'castanho' }, beard: race === 'anao' });
      ch.anim.play('Idle'); ch.anim.update(0.4); if (d && d.update) d.update(0.4);
      out.push(...checkRig(ch.root || ch.obj, `${CLASSES[cls].name} (${race === 'anao' ? 'anão' : 'humano'})`));
    } catch (e) { out.push({ tipo: 'erro ao montar personagem', gravidade: 'alta', objeto: `${cls} (${race})`, x: 0, z: 0, detalhe: e.message }); }
  }
  for (const n of ctx.S.npcs || []) if (n.root) out.push(...checkRig(n.root, `NPC ${n.name || n.id}`, n.x, n.z));
  return out;
}

/* P-004: só uma música por vez — vigia os "ônibus" de música do Sound enquanto troca de zona, entra/sai de casa, arena e masmorra */
export async function checkMusic(ctx, wait = ms => new Promise(r => setTimeout(r, ms))) {
  const { Sound, S, teleport3d, sim, INTERIORS } = ctx, out = [], steps = [];
  if (!Sound) return out;
  try { Sound.init && Sound.init(); } catch (e) { }
  if (!Sound.ctx) { out.push({ tipo: 'música', gravidade: 'baixa', objeto: 'som', x: 0, z: 0, detalhe: 'sem contexto de áudio (o navegador ainda não liberou o som)' }); return out; }
  const live = new Set(), orig = Sound.playSong.bind(Sound);
  const track = () => { const b = Sound.bus; if (b && !b.__qa) { b.__qa = true; live.add(b); const dc = b.disconnect.bind(b); b.disconnect = (...a) => { live.delete(b); return dc(...a); }; } };
  Sound.playSong = id => { const r = orig(id); track(); return r; }; track();
  const audible = () => [...live].filter(b => b.gain.value > 0.02 || (Sound.bus === b)).length;
  const saved = { x: S.pos.x, z: S.pos.z, int: S.interior, god: S.god }; S.god = true; if (S.p) { S.p.dead = false; S.p.hp = S.p.d.maxHp; } // em God Mode: os monstros não interrompem o teste
  const go = async (label, fn, expect) => { fn(); for (let k = 0; k < 6; k++) { sim(0.25); await wait(260); } const n = audible(), id = Sound.songId; steps.push(`${label}: ${id} (${n} tocando)`);
    if (n > 1) out.push({ tipo: 'duas músicas ao mesmo tempo', gravidade: 'alta', objeto: label, x: S.pos.x, z: S.pos.z, detalhe: `${n} músicas tocando (${id})` });
    if (expect && expect() && id !== expect()) out.push({ tipo: 'música errada', gravidade: 'media', objeto: label, x: S.pos.x, z: S.pos.z, detalhe: `tocando ${id}, esperado ${expect()}` }); };
  try {
    if (S.interior && ctx.leaveInterior) { ctx.leaveInterior(true); sim(0.2); }
    for (const z of (ctx.zones || [])) await go(`zona ${z.name}`, () => teleport3d(z.x, z.z), () => S.zone && S.zone.music);
    const enter = id => () => { if (INTERIORS[id] && ctx.enterInterior) ctx.enterInterior(id, { out: { x: saved.x, z: saved.z, yaw: 0 } }); };
    for (const id of ['taverna', 'catacumbas']) if (INTERIORS[id]) { await go(`entrar: ${INTERIORS[id].name}`, enter(id), () => INTERIORS[id].music || Sound.songId); await go(`sair: ${INTERIORS[id].name}`, () => ctx.leaveInterior && ctx.leaveInterior(true), () => S.zone && S.zone.music); }
    if (ctx.enterArena) { await go('entrar na Arena', () => ctx.enterArena(), null); await go('sair da Arena', () => ctx.leaveInterior && ctx.leaveInterior(true), null); }
  } finally {
    Sound.playSong = orig; teleport3d(saved.x, saved.z); sim(0.2); S.god = saved.god;
  }
  out.steps = steps; return out;
}

/* =========================================================================
   P-012 — VERIFICADOR DE PERSONAGENS (13 classes × 3 raças, várias poses)
   Usa os manequins da galeria da Arena (ensureGallery/galleryAnim no main3d) e mede, em cada pose:
   (a) roupa/armadura dentro do corpo   (b) roupa base/malha aparecendo por fora das placas
   (c) arma fora da mão                 (d) pernas abertas/agachadas   (e) cabeça olhando para baixo
   (f) peça flutuando longe do osso     (g) barba/cabelo atravessando o tronco/gola
   ========================================================================= */
const CQ = { v: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };
const BASE_RE = /^(Male|Female)_(Ranger|Peasant)_|^SuperHero_/, HAIR_RE = /Hair|Beard|Eyebrow/i, WEAPON_SKIP = /shield|escudo|book|livro|lute|alaude|instrument|flute|flauta|bandolim/i;
const SEGS = [['pelvis', 'spine_03', 'tronco'], ['spine_03', 'neck_01', 'pescoço'], ['neck_01', 'Head', 'pescoço'], ['upperarm_l', 'lowerarm_l', 'braço esq.'], ['lowerarm_l', 'hand_l', 'antebraço esq.'], ['upperarm_r', 'lowerarm_r', 'braço dir.'], ['lowerarm_r', 'hand_r', 'antebraço dir.'], ['thigh_l', 'calf_l', 'coxa esq.'], ['calf_l', 'foot_l', 'canela esq.'], ['thigh_r', 'calf_r', 'coxa dir.'], ['calf_r', 'foot_r', 'canela dir.']];
const GRAV = { alta: 15, media: 6, baixa: 2 };
function boneOf(root, n) { return root.getObjectByName(n); }
function segDist(p, a, b, out) { // distância do ponto ao segmento ab (e o t)
  CQ.c.subVectors(b, a); const L2 = CQ.c.lengthSq() || 1e-9; let t = CQ.a.subVectors(p, a).dot(CQ.c) / L2; t = Math.max(0, Math.min(1, t));
  out.copy(a).addScaledVector(CQ.c, t); return p.distanceTo(out);
}
function worldVerts(mesh, stride = 3, max = 4000) { // vértices no mundo (com a pele animada, se houver)
  const P = mesh.geometry && mesh.geometry.attributes.position; if (!P) return [];
  const st = Math.max(stride, Math.ceil(P.count / max)), out = [];
  for (let i = 0; i < P.count; i += st) { const v = new THREE.Vector3(); if (mesh.isSkinnedMesh && mesh.getVertexPosition) mesh.getVertexPosition(i, v); else v.fromBufferAttribute(P, i); out.push(v.applyMatrix4(mesh.matrixWorld)); }
  return out;
}
function bodyCapsules(root) { // cápsulas do corpo: raio = mediana da distância da pele ao osso
  const skin = []; root.traverse(o => { if (o.isSkinnedMesh && o.visible && !/Hair|Beard|Eyebrow|Eyes/i.test(o.name)) skin.push(o); }); // corpo + roupa base (a superfície por baixo das peças)
  const segs = SEGS.map(([a, b, nome]) => { const A = boneOf(root, a), B = boneOf(root, b); if (!A || !B) return null; return { nome, a: A.getWorldPosition(new THREE.Vector3()), b: B.getWorldPosition(new THREE.Vector3()), ds: [] }; }).filter(Boolean);
  const tmp = new THREE.Vector3();
  for (const m of skin) for (const v of worldVerts(m, 3, 1500)) { let best = null, bd = 1e9; for (const s of segs) { const d = segDist(v, s.a, s.b, tmp); if (d < bd) { bd = d; best = s; } } if (best && bd < 0.3) best.ds.push(bd); }
  for (const s of segs) { s.ds.sort((x, y) => x - y); s.r = s.ds.length ? s.ds[Math.floor(s.ds.length * 0.5)] : 0.06; delete s.ds; }
  return segs;
}
function insideFrac(verts, caps, k) { // fração de vértices bem dentro do corpo (mais perto do osso que k × raio)
  if (!verts.length) return { f: 0, onde: '' }; const tmp = new THREE.Vector3(), cnt = {}; let n = 0;
  for (const v of verts) for (const s of caps) { const d = segDist(v, s.a, s.b, tmp); if (d < s.r * k) { n++; cnt[s.nome] = (cnt[s.nome] || 0) + 1; break; } }
  const onde = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]).join(', ');
  return { f: n / verts.length, onde };
}
function overlayGroups(root) { // peças de roupa/armadura (malhas rígidas presas aos ossos), por osso
  const g = {}; root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !o.visible || o.isPoints) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && (m.transparent && m.opacity < 0.7 || m.blending === THREE.AdditiveBlending)) return;
    let p = o.parent, bone = null, weapon = false; while (p && p !== root) { if (!bone && p.isBone) bone = p.name; if (/^hand_[lr]$/.test(p.name) || p.userData && p.userData.isWeapon) weapon = true; p = p.parent; }
    if (weapon || !bone) return; (g[bone] = g[bone] || []).push(o);
  });
  return g;
}
function weaponsOf(root) {
  const out = [], seen = new Set(), items = root.userData.items || {};
  const add = (name, obj) => { if (!obj || seen.has(obj) || WEAPON_SKIP.test(name)) return; seen.add(obj); let p = obj.parent, hand = null; while (p && p !== root) { if (/^hand_[lr]$/.test(p.name)) { hand = p.name; break; } p = p.parent; } if (hand) out.push({ name, obj, hand }); };
  for (const [k, o] of Object.entries(items)) add(k, o);
  if (root.userData.katar) { add('Katar_R', root.userData.katar.r); add('Katar_L', root.userData.katar.l); }
  return out;
}
function gripOffset(root, w) { // distância do centro do punho fechado ao eixo principal da arma
  const side = w.hand.slice(-1), pts = [];
  for (const f of ['index', 'middle', 'ring', 'pinky']) for (const j of ['01', '02']) { const b = boneOf(root, `${f}_${j}_${side}`); if (b) pts.push(b.getWorldPosition(new THREE.Vector3())); }
  if (pts.length < 3) return null; const fist = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const vs = []; w.obj.updateMatrixWorld(true); w.obj.traverse(o => { if (o.isMesh && o.visible) vs.push(...worldVerts(o, 1, 1500)); }); if (vs.length < 6) return null;
  const c = vs.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / vs.length);
  let far = vs[0], fd = 0; for (const p of vs) { const d = p.distanceToSquared(c); if (d > fd) { fd = d; far = p; } }
  const dir = far.clone().sub(c).normalize(); // eixo principal (do centro à ponta mais longe)
  let tmin = 1e9, tmax = -1e9; for (const p of vs) { const t = CQ.v.subVectors(p, c).dot(dir); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); }
  const a = c.clone().addScaledVector(dir, tmin), b = c.clone().addScaledVector(dir, tmax);
  return segDist(fist, a, b, new THREE.Vector3());
}
function legsInfo(root, fwd) { // abertura LATERAL das coxas (no plano de frente do corpo): avançar uma perna (estocada) não conta, "perereca" conta
  const g = n => { const b = boneOf(root, n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const tl = g('thigh_l'), cl = g('calf_l'), tr = g('thigh_r'), cr = g('calf_r'), pv = g('pelvis'); if (!tl || !cl || !tr || !cr || !pv) return null;
  const dl = cl.clone().sub(tl), dr = cr.clone().sub(tr), L0 = Math.min(dl.length(), dr.length()); if (fwd) { dl.addScaledVector(fwd, -dl.dot(fwd)); dr.addScaledVector(fwd, -dr.dot(fwd)); }
  if (Math.min(dl.length(), dr.length()) < L0 * 0.45) return { spread: 0, pelvisY: pv.y, lunge: true }; // coxa apontando para a frente (avanço/estocada): não é abertura lateral
  dl.normalize(); dr.normalize();
  return { spread: THREE.MathUtils.radToDeg(dl.angleTo(dr)), pelvisY: pv.y };
}
function headAxis(root, fwd) { // eixo local da cabeça que mais aponta para a frente do personagem (escolhido na pose parada)
  const h = boneOf(root, 'Head'); if (!h) return null; const q = h.getWorldQuaternion(new THREE.Quaternion()); let best = null, bd = -2;
  for (const ax of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const v = new THREE.Vector3(...ax).applyQuaternion(q); const d = v.dot(fwd); if (d > bd) { bd = d; best = ax; } }
  return best;
}
function headPitch(root, ax) { const h = boneOf(root, 'Head'); if (!h || !ax) return 0; const v = new THREE.Vector3(...ax).applyQuaternion(h.getWorldQuaternion(new THREE.Quaternion())); return THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, -v.y)))); }
// (b) roupa base visível: renderiza o manequim de 4 lados com e sem a roupa base e conta os pixels que mudam (usa os shaders reais)
let _rt = null, _qs = null;
function exposedBase(ctx, n) {
  const { renderer, scene } = ctx; if (!renderer || !scene) return null;
  const W = 72, H = 120; _rt = _rt || new THREE.WebGLRenderTarget(W, H); const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 30);
  const base = []; n.root.traverse(o => { if (o.isSkinnedMesh && o.visible && /^(Male|Female)_(Ranger|Peasant)_/.test(o.name)) base.push(o); }); if (!base.length) return null;
  // o manequim vai sozinho para uma cena pequena (sem Arena nem outros manequins): bem mais rápido e o fundo fica transparente
  if (!_qs) { _qs = new THREE.Scene(); _qs.add(new THREE.HemisphereLight('#ffffff', '#6a6a6a', 1.4)); const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 3); _qs.add(dl); _qs.environment = scene.environment || null; }
  const par = n.obj.parent; _qs.add(n.obj); const others = [];
  const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevCC = renderer.getClearColor(new THREE.Color()), prevCA = renderer.getClearAlpha(), a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4), hgt = n.height || 1.8;
  let changed = 0, sil = 0;
  try {
    for (let k = 0; k < 4; k++) {
      const yaw = n.obj.rotation.y + k * Math.PI / 2; cam.position.set(n.x + Math.sin(yaw) * 4.4, hgt * 0.55, n.z + Math.cos(yaw) * 4.4); cam.lookAt(n.x, hgt * 0.52, n.z); cam.updateMatrixWorld();
      renderer.setRenderTarget(_rt); renderer.autoClear = true; renderer.setClearColor(0x000000, 0); renderer.render(_qs, cam); renderer.readRenderTargetPixels(_rt, 0, 0, W, H, a);
      base.forEach(o => o.visible = false); renderer.render(_qs, cam); renderer.readRenderTargetPixels(_rt, 0, 0, W, H, b); base.forEach(o => o.visible = true);
      for (let i = 0; i < W * H * 4; i += 4) { if (a[i + 3] < 8) continue; sil++; const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]); if (d > 24) changed++; }
    }
  } finally { renderer.setRenderTarget(prevRT); renderer.autoClear = prevAuto; renderer.setClearColor(prevCC, prevCA); if (par) par.add(n.obj); }
  return sil ? changed / sil : 0;
}
// leva o manequim a um instante do ciclo da galeria (0–3 parado, 3–5,2 guarda, 5,2–8 golpes) rodando a animação de verdade
function driveTo(ctx, n, t0, t1, dt = 1 / 15) {
  for (let t = t0; t <= t1 + 1e-6; t += dt) { n.gOff = t - ctx.S.time; n.anim.update(dt); ctx.galleryAnim(n, dt); }
  n.root.updateMatrixWorld(true); n.obj.updateMatrixWorld(true);
}
const POSES = [['parado', 0, 2.4], ['guarda', 3, 4.8], ['golpe', 5.2, 5.55], ['golpe (fim)', 5.6, 6.0], ['andando', null], ['montado', null]];
function measure(ctx, n, pose, ref, out, label) {
  const root = n.root, push = (tipo, gravidade, detalhe, valor) => out.push({ tipo, gravidade, objeto: label, pose, detalhe, valor, x: n.x, z: n.z, ref: n });
  const caps = bodyCapsules(root), groups = overlayGroups(root), atk = /golpe/.test(pose);
  // (a) roupa/armadura dentro do corpo (por peça presa a cada osso)
  for (const [bone, meshes] of Object.entries(groups)) { const vs = []; meshes.forEach(m => vs.push(...worldVerts(m, 2, 800))); const r = insideFrac(vs, caps, 0.5); if (r.f > 0.15 && vs.length > 20) push('peça dentro do corpo', r.f > 0.35 ? 'alta' : 'media', `${(r.f * 100).toFixed(0)}% das peças presas a ${bone} estão dentro do corpo (${r.onde})`, r.f); }
  // (c) arma fora da mão
  for (const w of weaponsOf(root)) { const d = gripOffset(root, w); if (d != null && d > 0.065) push('arma fora da mão', d > 0.1 ? 'alta' : 'media', `${w.name}: cabo a ${(d * 100).toFixed(0)} cm do centro do punho (${w.hand})`, d); }
  // (d) pernas abertas / agachadas (no golpe a tolerância é maior)
  const L = pose === 'montado' ? null : legsInfo(root, ref.fwd); if (L && ref.legs) { /* sentado/montado: as pernas abrem de propósito */ const sp = L.spread, drop = (ref.legs.pelvisY - L.pelvisY) / (n.height || 1.8), lim = Math.max(atk ? 40 : 26, ref.legs.spread + (atk ? 18 : 10));
    if (sp > lim) push('pernas abertas', sp > lim + 12 ? 'alta' : 'media', `${sp.toFixed(0)}° entre as coxas (em pé: ${ref.legs.spread.toFixed(0)}°)`, sp);
    if (drop > (atk ? 0.16 : 0.08)) push('agachado demais', drop > (atk ? 0.24 : 0.14) ? 'alta' : 'media', `quadril ${(drop * 100).toFixed(0)}% mais baixo que em pé`, drop); }
  // (e) cabeça olhando para baixo
  const pt = headPitch(root, ref.headAx); if (pt - (ref.pitch0 || 0) > (atk ? 32 : 22)) push('cabeça para baixo', pt - ref.pitch0 > 38 ? 'alta' : 'media', `cabeça ${pt.toFixed(0)}° para baixo (em pé: ${(ref.pitch0 || 0).toFixed(0)}°)`, pt);
  // (f) peça flutuando longe do osso
  for (const r of checkRig(root, label, n.x, n.z)) push(r.tipo, r.gravidade, r.detalhe, 0);
  // (g) barba/cabelo atravessando o tronco
  root.traverse(o => { if (o.isSkinnedMesh && o.visible && /Beard/i.test(o.name)) { const r = insideFrac(worldVerts(o, 2, 1200), caps.filter(c => /tronco|pescoço/.test(c.nome)), 0.85); if (r.f > 0.06) push('barba atravessando o tronco/gola', r.f > 0.2 ? 'alta' : 'media', `${(r.f * 100).toFixed(0)}% da barba dentro do corpo/roupa`, r.f); } });
  // (b) roupa base/malha aparecendo (só faz sentido em quem usa armadura por cima)
  if (n._armored && (pose === 'parado' || pose === 'guarda' || pose === 'golpe')) { const e = exposedBase(ctx, n); if (e != null && e > 0.1) push('malha/roupa de baixo aparecendo', e > 0.2 ? 'alta' : 'media', `${(e * 100).toFixed(0)}% da silhueta é a roupa de baixo (4 lados)`, e); }
}
export async function checkCharsDeep(ctx, opts = {}) {
  const t0 = performance.now(), { S, teleport3d, ensureGallery } = ctx, out = [], fichas = [];
  if (!ensureGallery || !ctx.galleryAnim) return { resumo: { total: 0, ms: 0, erro: 'galeria indisponível' }, problemas: [], fichas };
  const back = { x: S.pos.x, z: S.pos.z };
  if (Math.abs(S.pos.x - 800) > 40) { teleport3d(800, 4); if (ctx.sim) ctx.sim(0.1); }
  ensureGallery();
  const gal = S.npcs.filter(n => n.gallery && n.root && (!opts.cls || opts.cls.includes(n.cls)));
  for (const n of gal) {
    const label = n.name, prob = []; if (opts.onProgress) opts.onProgress(fichas.length, gal.length, label);
    try {
      n._armored = !!n.root.userData.armorSet;
      const saveOff = n.gOff, fwd = new THREE.Vector3(Math.sin(n.obj.rotation.y), 0, Math.cos(n.obj.rotation.y));
      driveTo(ctx, n, 0, 2.4); const ref = { fwd, legs: legsInfo(n.root, fwd), headAx: headAxis(n.root, fwd) }; ref.pitch0 = headPitch(n.root, ref.headAx);
      for (const [pose, a, b] of POSES) {
        if (a != null) driveTo(ctx, n, a, b);
        else { driveTo(ctx, n, 0, 0.3); n.anim.play(pose === 'andando' ? 'Running_A' : 'Sit_Chair_Idle', { fade: 0 }); for (let k = 0; k < 12; k++) n.anim.update(1 / 30); n.root.updateMatrixWorld(true); }
        measure(ctx, n, pose, ref, prob, label);
        await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); // não congela a tela (MessageChannel: não é atrasado com a aba em segundo plano)
      }
      n.gPh = -1; driveTo(ctx, n, 0, 0.4); n.gOff = saveOff; // volta à pose normal (sem ficar sentado)
    } catch (e) { prob.push({ tipo: 'erro ao medir', gravidade: 'alta', objeto: label, pose: '-', detalhe: e.message, x: n.x, z: n.z, ref: n }); }
    // um problema repetido em várias poses vira uma linha só (com as poses)
    const merged = new Map(); for (const p of prob) { const k = p.tipo + '|' + p.detalhe.replace(/\d+/g, '#') + '|' + p.gravidade; const m = merged.get(k); if (m) { m.poses.add(p.pose); if (GRAV[p.gravidade] > GRAV[m.gravidade]) Object.assign(m, { gravidade: p.gravidade, detalhe: p.detalhe }); } else merged.set(k, { ...p, poses: new Set([p.pose]) }); }
    const lista = [...merged.values()].map(p => ({ ...p, pose: [...p.poses].join(', ') }));
    const nota = Math.max(0, 100 - lista.reduce((s, p) => s + GRAV[p.gravidade], 0));
    fichas.push({ nome: label, cls: n.cls, nota, problemas: lista, ref: n }); out.push(...lista);
  }
  if (opts.returnTo !== false && Math.hypot(back.x - S.pos.x, back.z - S.pos.z) > 40) teleport3d(back.x, back.z);
  const ord = { alta: 0, media: 1, baixa: 2 }; out.sort((a, b) => ord[a.gravidade] - ord[b.gravidade] || (b.valor || 0) - (a.valor || 0)); fichas.sort((a, b) => a.nota - b.nota);
  const resumo = { total: out.length, alta: out.filter(r => r.gravidade === 'alta').length, media: out.filter(r => r.gravidade === 'media').length, baixa: out.filter(r => r.gravidade === 'baixa').length, ms: Math.round(performance.now() - t0), nota: fichas.length ? Math.round(fichas.reduce((s, f) => s + f.nota, 0) / fichas.length) : 100, personagens: fichas.length, musica: [] };
  return { resumo, problemas: out, fichas };
}
export function showQAChars(rep, ctx) {
  let w = document.getElementById('qa-win'); if (w) w.remove();
  w = document.createElement('div'); w.id = 'qa-win';
  w.style.cssText = 'position:fixed;inset:5% 10%;z-index:80;background:rgba(14,12,24,0.96);border:1px solid rgba(255,215,106,0.4);border-radius:12px;color:#e8e2d2;display:flex;flex-direction:column;font-size:13px;box-shadow:0 10px 40px rgba(0,0,0,0.6)';
  const col = { alta: '#ff6a5a', media: '#ffc46a', baixa: '#9ab8d8' }, esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])), r = rep.resumo;
  const nc = v => v >= 85 ? '#8fe08a' : v >= 60 ? '#ffc46a' : '#ff6a5a';
  w.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08)"><b style="color:#ffd76a;font-size:16px">🧍 Verificação dos personagens</b><span>nota média <b style="color:${nc(r.nota)}">${r.nota}</b> · ${r.personagens} personagens · <span style="color:${col.alta}">${r.alta} graves</span> · <span style="color:${col.media}">${r.media} médios</span> · ${(r.ms / 1000).toFixed(1)} s</span><button id="qa-x" class="btn small">Fechar</button></div>
  <div style="overflow:auto;padding:8px 16px;flex:1">${rep.fichas.map((f, i) => `<details style="border-bottom:1px solid rgba(255,255,255,0.06);padding:6px 0"${f.nota < 60 ? ' open' : ''}><summary style="cursor:pointer;display:flex;gap:10px;align-items:center"><b style="min-width:42px;color:${nc(f.nota)}">${f.nota}</b><b style="flex:1">${esc(f.nome)}</b><span style="color:#b9b2c8">${f.problemas.length} problema(s)</span><button class="btn small" data-qa-see="${i}">ver</button></summary>
    ${f.problemas.map(p => `<div style="display:flex;gap:10px;padding:3px 0 3px 52px"><span style="color:${col[p.gravidade]};min-width:52px">● ${p.gravidade}</span><b style="min-width:200px">${esc(p.tipo)}</b><span style="flex:1">${esc(p.detalhe)}</span><span style="color:#8d86a0">${esc(p.pose)}</span></div>`).join('') || '<div style="padding:3px 0 3px 52px;color:#8fe08a">Nada encontrado ✓</div>'}</details>`).join('')}</div>`;
  document.body.appendChild(w);
  w.querySelector('#qa-x').onclick = () => w.remove();
  w.querySelectorAll('[data-qa-see]').forEach(b => b.onclick = e => { e.preventDefault(); const n = rep.fichas[+b.dataset.qaSee].ref, S = ctx.S; w.remove();
    const dx = 800 - n.x, dz = 0 - n.z, l = Math.hypot(dx, dz) || 1, x = n.x + dx / l * 3.2, z = n.z + dz / l * 3.2; ctx.teleport3d(x, z);
    const yaw = Math.atan2(n.x - x, n.z - z); S.pos.yaw = yaw; if (S.cam) { S.cam.yaw = yaw; if ('pitch' in S.cam) S.cam.pitch = 0.25; } });
}

export async function runQA(ctx, opts = {}) {
  const t0 = performance.now(), mundo = checkWorld(ctx), pers = opts.chars === false ? [] : checkCharacters(ctx);
  const musica = opts.music === false ? [] : await checkMusic(ctx);
  const all = [...mundo, ...pers, ...musica], ord = { alta: 0, media: 1, baixa: 2 };
  all.sort((a, b) => ord[a.gravidade] - ord[b.gravidade]);
  const resumo = { total: all.length, alta: all.filter(r => r.gravidade === 'alta').length, media: all.filter(r => r.gravidade === 'media').length, baixa: all.filter(r => r.gravidade === 'baixa').length, ms: Math.round(performance.now() - t0), musica: musica.steps || [] };
  return { resumo, problemas: all };
}

/* janela do relatório (Painel do Mestre) — com "ir até lá" em cada item */
export function showQA(rep, teleport3d) {
  let w = document.getElementById('qa-win'); if (w) w.remove();
  w = document.createElement('div'); w.id = 'qa-win';
  w.style.cssText = 'position:fixed;inset:6% 12%;z-index:80;background:rgba(14,12,24,0.96);border:1px solid rgba(255,215,106,0.4);border-radius:12px;color:#e8e2d2;display:flex;flex-direction:column;font-size:13px;box-shadow:0 10px 40px rgba(0,0,0,0.6)';
  const col = { alta: '#ff6a5a', media: '#ffc46a', baixa: '#9ab8d8' }, esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const r = rep.resumo;
  w.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08)"><b style="color:#ffd76a;font-size:16px">🔍 Verificação do mundo</b><span>${r.total} itens · <span style="color:${col.alta}">${r.alta} graves</span> · <span style="color:${col.media}">${r.media} médios</span> · <span style="color:${col.baixa}">${r.baixa} leves</span> · ${(r.ms / 1000).toFixed(1)} s</span><button id="qa-x" class="btn small">Fechar</button></div>
  ${r.musica.length ? `<div style="padding:8px 16px;color:#b9b2c8;font-size:12px">🎵 ${r.musica.map(esc).join(' · ')}</div>` : ''}
  <div style="overflow:auto;padding:8px 16px;flex:1">${rep.problemas.length ? rep.problemas.map((p, i) => `<div style="display:flex;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="color:${col[p.gravidade]};min-width:52px">● ${p.gravidade}</span><b style="min-width:190px">${esc(p.tipo)}</b><span style="flex:1">${esc(p.objeto)} — ${esc(p.detalhe)}</span>${p.x || p.z ? `<button class="btn small" data-qa-go="${i}">ir até lá</button>` : ''}</div>`).join('') : '<div style="padding:20px;text-align:center">Nada encontrado. ✓</div>'}</div>`;
  document.body.appendChild(w);
  w.querySelector('#qa-x').onclick = () => w.remove();
  w.querySelectorAll('[data-qa-go]').forEach(b => b.onclick = () => { const p = rep.problemas[+b.dataset.qaGo]; w.remove(); teleport3d(p.x + 2, p.z + 2); });
}
