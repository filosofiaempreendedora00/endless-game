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
