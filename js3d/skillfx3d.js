/* =========================================================================
   P-016 — HABILIDADES COM VISUAL PRÓPRIO POR CLASSE
   Cada habilidade tem: gesto do personagem (golpe sob medida de strikes3d ou um
   gesto próprio daqui), efeito visual (partículas, ondas, runas, arcos de corte,
   raios, pedras) e som próprio (Sound.play em js/audio.js, nomes 'sk_*').
   Regras de gosto: nada facetado, nada de PointLight direto (só vlight, por
   pouco tempo), nada permanente — o efeito nasce, conta o que aconteceu e some.

   playSkillFx(id, origem, alvo, opts) é tudo o que o jogo (e o online) precisa
   chamar: origem/alvo = {x,y,z}. O net3d chama a mesma função para mostrar a
   habilidade de outro jogador (o servidor só repassa {id, origem, alvo}).
   ========================================================================= */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { STRIKES, addShake } from './strikes3d.js';

let C = null; // { scene, camera, groundAt, vlight, sound, makeArrow }
const live = [];
let T = 0;

/* ---------------- gestos próprios (mesmo formato dos golpes de strikes3d) ---------------- */
// mão erguida (bênção/cura/aura), as duas mãos ao céu (meteoro/tempestade), punho ao chão (impacto) e giro (dança das lâminas)
STRIKES.bencao = [{ dur: 0.9, hit: 0.55, keys: [{ t: 0, l: [0.3, -0.5, 0.4] }, { t: 0.4, l: [0.18, 0.75, 0.25], lean: -0.08, lp: [0.6, -0.3, -0.4] }, { t: 0.7, l: [0.12, 0.8, 0.3], lean: -0.06 }, { t: 1, l: [0.3, -0.5, 0.4] }] }];
STRIKES.bencaoR = STRIKES.bencao.map(v => ({ ...v, keys: v.keys.map(k => ({ ...k, r: k.l ? [-k.l[0], k.l[1], k.l[2]] : undefined, l: undefined, rp: k.lp ? [-k.lp[0], k.lp[1], k.lp[2]] : undefined, lp: undefined })) }));
STRIKES.ceu = [{ dur: 1.0, hit: 0.7, keys: [{ t: 0, l: [0.3, -0.5, 0.4] }, { t: 0.45, l: [0.25, 0.95, 0.15], lean: -0.12, lp: [0.7, -0.2, -0.4] }, { t: 0.72, l: [0.1, 0.1, 1.0], lean: 0.16 }, { t: 1, l: [0.3, -0.5, 0.4] }] }];
STRIKES.ceuR = STRIKES.ceu.map(v => ({ ...v, keys: v.keys.map(k => ({ ...k, r: k.l ? [-k.l[0], k.l[1], k.l[2]] : undefined, l: undefined, rp: k.lp ? [-k.lp[0], k.lp[1], k.lp[2]] : undefined, lp: undefined })) }));
STRIKES.chao = [{ dur: 0.85, hit: 0.62, heavy: true, keys: [{ t: 0, r: [-0.2, -0.4, 0.6] }, { t: 0.38, r: [-0.1, 0.9, 0.1], lean: -0.15, rp: [-0.5, 0.2, -0.5] }, { t: 0.62, r: [-0.05, -0.85, 0.85], lean: 0.32 }, { t: 0.82, r: [-0.05, -0.85, 0.8], lean: 0.3 }, { t: 1, r: [-0.2, -0.4, 0.6] }] }];

/* gesto por habilidade: strike = golpe sob medida; staffSafe = gesto da mão livre (o braço do cajado fica com o IK dele) */
const GESTURE = {
  primeiros_socorros: 'bencaoR', golpe_poderoso: ['espada', 0], impacto_sismico: 'chao',
  seta_de_fogo: 'cajado', lanca_de_gelo: 'cajado', faisca: 'cajado', barreira_arcana: 'bencao',
  disparo_duplo: null, chuva_de_flechas: null, lamina_envenenada: ['adaga', 0],
  montaria_de_guerra: null, lamina_runica: ['pesada', 0], furia_de_batalha: 'bencaoR',
  julgamento: 'bencaoR', escudo_sagrado: ['paladino', 1],
  meteoro: 'ceu', bola_de_fogo: 'cajado', nevasca: 'ceu', tempestade: 'ceu',
  pilar_de_terra: 'gesto', runa_de_fogo: 'gesto', cura_maior: 'bencaoR',
  flecha_explosiva: null, cancao_de_batalha: null, nota_dissonante: null,
  golpe_sombrio: ['duas', 0], danca_das_laminas: ['duas', 2], roubar: ['punhos', 0], golpe_traicoeiro: ['sabre', 1],
};
export function skillGesture(id) { const g = GESTURE[id]; if (!g) return null; return Array.isArray(g) ? { strike: g[0], variant: g[1] } : { strike: g, variant: 0 }; }

/* ---------------- texturas suaves (feitas uma vez) ---------------- */
const TX = {};
function canvasTex(key, size, draw) {
  if (TX[key]) return TX[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (TX[key] = t);
}
const dotTex = () => canvasTex('dot', 64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.75)'); r.addColorStop(0.6, 'rgba(255,255,255,0.18)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
const smokeTex = () => canvasTex('smoke', 128, (g, s) => { // fumaça macia irregular (vários sopros sobrepostos)
  for (let k = 0; k < 26; k++) { const x = s / 2 + (Math.random() - 0.5) * s * 0.4, y = s / 2 + (Math.random() - 0.5) * s * 0.4, r = s * (0.12 + Math.random() * 0.2), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
  const m = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s / 2); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, s, s); });
const ringTex = () => canvasTex('ring', 128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * 0.30, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,0.0)'); r.addColorStop(0.8, 'rgba(255,255,255,0.9)'); r.addColorStop(0.9, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
const noteTex = () => canvasTex('note', 64, (g, s) => { g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', s / 2, s / 2 + 2); });
const crackTex = () => canvasTex('crack', 256, (g, s) => { // rachaduras no chão (impacto sísmico)
  g.strokeStyle = 'rgba(20,14,8,0.9)'; g.lineCap = 'round';
  for (let k = 0; k < 9; k++) { let a = k / 9 * Math.PI * 2 + Math.random() * 0.4, x = s / 2, y = s / 2, w = 5; g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 7; j++) { a += (Math.random() - 0.5) * 0.7; const L = s * (0.04 + Math.random() * 0.05); x += Math.cos(a) * L; y += Math.sin(a) * L; g.lineWidth = w; g.lineTo(x, y); w *= 0.78; } g.stroke(); }
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(40,28,16,0.55)'); r.addColorStop(0.35, 'rgba(40,28,16,0.15)'); r.addColorStop(1, 'rgba(40,28,16,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
function runeCircleTex(kind) { // círculo rúnico desenhado (cor vem do material); 'sol' tem raios, 'runa' tem glifos
  return canvasTex('runes_' + kind, 256, (g, s) => {
    const c = s / 2; g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, s * 0.46, 0, 7); g.stroke(); g.lineWidth = 1.6; g.beginPath(); g.arc(c, c, s * 0.40, 0, 7); g.stroke(); g.beginPath(); g.arc(c, c, s * 0.2, 0, 7); g.stroke();
    if (kind === 'sol') { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r0 = s * 0.22, r1 = s * (k % 2 ? 0.33 : 0.38); g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke(); } }
    else { g.font = `${Math.round(s * 0.07)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const glyph = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * s * 0.43, c + Math.sin(a) * s * 0.43); g.rotate(a + Math.PI / 2); g.fillText(glyph[k % glyph.length], 0, 0); g.restore(); }
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(c + Math.cos(a) * s * 0.4, c + Math.sin(a) * s * 0.4); g.lineTo(c + Math.cos(a + 2.09) * s * 0.4, c + Math.sin(a + 2.09) * s * 0.4); g.stroke(); } }
  });
}
const slashTex = () => canvasTex('slash', 256, (g, s) => { // arco de corte: brilho que nasce fino, engrossa e some (u = ao longo do corte)
  const img = g.createImageData(s, s), d = img.data;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const u = x / s, v = y / s, along = Math.pow(u, 1.6) * (1 - Math.pow(u, 6)), across = Math.exp(-Math.pow((v - 0.5) / (0.06 + 0.16 * u), 2)), a = Math.min(1, along * across * 1.6); const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255; }
  g.putImageData(img, 0, 0); });
const beamTex = () => canvasTex('beam', 128, (g, s) => { const lg = g.createLinearGradient(0, 0, s, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.3, 'rgba(255,255,255,0.55)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(0.7, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(0, 0, s, s);
  const vg = g.createLinearGradient(0, 0, 0, s); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.25, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = vg; g.fillRect(0, 0, s, s); });

/* ---------------- partículas: dois lotes instanciados (brilho somado e fumaça normal) ---------------- */
const PV = `attribute vec3 iColor; attribute float iAlpha; varying vec3 vC; varying float vA; varying vec2 vUv;
void main(){ vUv = uv; vC = iColor; vA = iAlpha; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const PF = `uniform sampler2D map; varying vec3 vC; varying float vA; varying vec2 vUv;
void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vC * t.rgb, t.a * vA); if (gl_FragColor.a < 0.004) discard; }`;
function makePool(n, tex, additive) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('iColor', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = additive ? 6 : 5;
  return { mesh, n, list: [] };
}
let GLOW = null, SMOKE = null;
const _q = new THREE.Quaternion(), _mx = new THREE.Matrix4(), _sc = new THREE.Vector3(), _pp = new THREE.Vector3(), _col = new THREE.Color(), _v = new THREE.Vector3();
function emit(pool, o) { // o: {p, v, life, s0, s1, color, a0, grav, drag, spin}
  if (pool.list.length >= pool.n) pool.list.shift();
  pool.list.push({ p: o.p.clone(), v: o.v ? o.v.clone() : new THREE.Vector3(), age: 0, life: o.life || 0.8, s0: o.s0 ?? 0.2, s1: o.s1 ?? 0.05, c: new THREE.Color(o.color || '#ffffff'), a0: o.a0 ?? 1, grav: o.grav || 0, drag: o.drag ?? 1.5 });
}
const rnd = (a, b) => a + Math.random() * (b - a);
const randDir = () => _v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().clone();
function burst(pos, o = {}) { // explosão de partículas
  const pool = o.smoke ? SMOKE : GLOW, n = o.n || 20;
  for (let i = 0; i < n; i++) { const d = randDir(); if (o.up) d.y = Math.abs(d.y) * o.up + (o.upBias || 0); if (o.flat) d.y *= 0.25; d.normalize();
    emit(pool, { p: new THREE.Vector3(pos.x, pos.y, pos.z).addScaledVector(d, o.r0 || 0), v: d.multiplyScalar(rnd((o.speed || 3) * 0.4, o.speed || 3)), life: rnd((o.life || 0.7) * 0.6, o.life || 0.7), s0: rnd((o.size || 0.2) * 0.6, o.size || 0.2), s1: o.s1 ?? (o.size || 0.2) * 0.2,
      color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color, a0: o.a0 ?? 1, grav: o.grav ?? 0, drag: o.drag ?? 2 }); }
}
function stepPool(pool, dt, cam) {
  const L = pool.list, M = pool.mesh, col = M.geometry.attributes.iColor, al = M.geometry.attributes.iAlpha; cam.getWorldQuaternion(_q);
  let k = 0;
  for (let i = L.length - 1; i >= 0; i--) { const p = L[i]; p.age += dt; if (p.age >= p.life) { L.splice(i, 1); continue; } }
  for (const p of L) {
    const u = p.age / p.life; p.v.y -= p.grav * dt; p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.p.addScaledVector(p.v, dt);
    const s = p.s0 + (p.s1 - p.s0) * u; _mx.compose(p.p, _q, _sc.set(s, s, s)); M.setMatrixAt(k, _mx);
    col.setXYZ(k, p.c.r, p.c.g, p.c.b); al.setX(k, p.a0 * (u < 0.12 ? u / 0.12 : 1 - Math.pow((u - 0.12) / 0.88, 1.6))); k++;
  }
  M.count = k; M.instanceMatrix.needsUpdate = true; col.needsUpdate = true; al.needsUpdate = true;
}

/* ---------------- peças: onda no chão, círculo de runas, arco de corte, coluna de luz, bolha, raio, pedra ---------------- */
const addMat = (map, color, op = 1, side = THREE.DoubleSide) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side, toneMapped: false });
function gy(p) { return C.groundAt(p.x, p.z); }
function add(obj, dur, update, dispose) { if (!obj.renderOrder) obj.renderOrder = 2; /* P-021: depois do calçamento (renderOrder 1), senão as marcas no chão somem nas praças */ C.scene.add(obj); live.push({ obj, t: 0, dur, update, dispose }); return obj; }
function groundWave(p, r, color, o = {}) { // onda que se abre rente ao chão
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), addMat(ringTex(), color, o.op ?? 0.9)); m.position.set(p.x, gy(p) + 0.06, p.z);
  return add(m, o.dur || 0.6, k => { m.scale.setScalar(0.15 + r * (1 - Math.pow(1 - k, 2.2))); m.material.opacity = (o.op ?? 0.9) * (1 - k); });
}
function runeCircle(p, r, color, o = {}) { // círculo de runas no chão: acende, gira devagar e apaga
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2), addMat(runeCircleTex(o.kind || 'runa'), color, 0)); m.position.set(p.x, gy(p) + 0.05, p.z);
  const dur = o.dur || 1.4, op = o.op ?? 0.85;
  return add(m, dur, (k, dt) => { m.rotation.y += dt * (o.spin ?? 0.6); m.material.opacity = op * Math.min(1, k * 6) * (k > 0.7 ? (1 - k) / 0.3 : 1); m.scale.setScalar(0.85 + 0.15 * Math.min(1, k * 4)); });
}
function decal(p, r, tex, o = {}) { // marca escura no chão (rachadura, chamuscado) — mistura normal, some devagar
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: o.op ?? 0.85, depthWrite: false, color: o.color || '#ffffff', polygonOffset: true, polygonOffsetFactor: -4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2), mat); m.position.set(p.x, gy(p) + 0.04, p.z); m.rotation.y = Math.random() * 6.28;
  return add(m, o.dur || 3, k => { m.material.opacity = (o.op ?? 0.85) * (k < 0.7 ? 1 : (1 - k) / 0.3); });
}
function arcGeo(r0, r1, a0, a1, seg = 28) { // faixa curva com u ao longo do arco (para o brilho que corre no corte)
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const u = i / seg, a = a0 + (a1 - a0) * u; for (const [r, v] of [[r0, 0], [r1, 1]]) { pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); uv.push(u, v); } }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
function slashArc(p, yaw, color, o = {}) { // corte luminoso diante do alvo
  const r = o.r || 1.1, m = new THREE.Mesh(arcGeo(r * 0.55, r, -1.1, 1.1), addMat(slashTex(), color, 1)); m.position.set(p.x, p.y + (o.h ?? 1.0), p.z);
  m.rotation.set(0, -yaw + Math.PI / 2, o.tilt ?? (Math.random() - 0.5) * 1.2, 'YXZ');
  if (o.dark) { m.material.blending = THREE.NormalBlending; m.material.opacity = 0.75; }
  const op0 = m.material.opacity;
  return add(m, o.dur || 0.28, k => { m.material.opacity = op0 * (1 - k * k); m.scale.setScalar(0.9 + 0.25 * k); });
}
const columnMat = color => new THREE.ShaderMaterial({ uniforms: { c: { value: new THREE.Color(color) }, a: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }`,
  fragmentShader: `uniform vec3 c; uniform float a; varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ float rim = 0.35 + 0.65 * pow(1.0 - abs(dot(vN, vV)), 1.6); float v = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y)); gl_FragColor = vec4(c * rim, rim * v * a); }` });
function lightColumn(p, h, r, color, o = {}) { // coluna de luz que desce do céu (julgamento, cura maior): volume macio, mais forte na base, some no alto
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 32, 1, true), columnMat(color)); m.position.set(p.x, gy(p) + h / 2, p.z);
  const dur = o.dur || 1.2;
  return add(m, dur, (k, dt) => { m.material.uniforms.a.value = (o.op ?? 0.8) * Math.min(1, k * 7) * Math.pow(1 - k, 1.3); m.scale.set(1 - 0.4 * k, 1, 1 - 0.4 * k); });
}
const bubbleMat = color => new THREE.ShaderMaterial({ uniforms: { c: { value: new THREE.Color(color) }, a: { value: 0 }, t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 w = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); vP = position; gl_Position = projectionMatrix * w; }`,
  fragmentShader: `uniform vec3 c; uniform float a; uniform float t; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.4); float s = 0.5 + 0.5 * sin(vP.y * 18.0 - t * 4.0); gl_FragColor = vec4(c * (f * 1.2 + 0.05 * s), (f * 0.9 + 0.04) * a); }` });
function bubble(follow, r, color, o = {}) { // bolha de energia em volta do corpo (escudo/barreira): borda brilha, meio transparente
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), bubbleMat(color)); const dur = o.dur || 1.6;
  return add(m, dur, (k, dt) => { const q = follow(); m.position.set(q.x, q.y + r * 0.85, q.z); m.material.uniforms.t.value += dt; m.material.uniforms.a.value = Math.min(1, k * 6) * Math.pow(1 - k, 1.2) * (o.op ?? 1); m.scale.setScalar(0.9 + 0.1 * Math.min(1, k * 4)); });
}
function boltLine(a, b, color, o = {}) { // raio de verdade: caminho quebrado com ramos, que pisca e se refaz
  const make = () => { const pts = [], n = 12; for (let i = 0; i <= n; i++) { const u = i / n, q = new THREE.Vector3().lerpVectors(a, b, u); if (i && i < n) q.add(randDir().multiplyScalar(0.35 * Math.sin(u * Math.PI) * (o.wild || 1))); pts.push(q); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, o.w || 0.035, 5, false); };
  const g = new THREE.Group(), core = new THREE.Mesh(make(), addMat(null, '#ffffff', 1)), glow = new THREE.Mesh(make(), addMat(null, color, 0.5)); glow.scale.setScalar(1); glow.geometry = new THREE.TubeGeometry(core.geometry.parameters.path, 40, (o.w || 0.035) * 3.2, 5, false); g.add(glow, core);
  let flick = 0;
  return add(g, o.dur || 0.32, (k, dt) => { flick += dt; if (flick > 0.07) { flick = 0; core.geometry.dispose(); core.geometry = make(); glow.geometry.dispose(); glow.geometry = new THREE.TubeGeometry(core.geometry.parameters.path, 40, (o.w || 0.035) * 3.2, 5, false); } core.material.opacity = 1 - k; glow.material.opacity = 0.5 * (1 - k); },
    () => { core.geometry.dispose(); glow.geometry.dispose(); });
}
let _rockGeo = null;
function rockSpikeGeo() { // espinho de pedra arredondado (nada facetado): icosaedro subdividido, alongado e com ruído, normais suaves
  if (_rockGeo) return _rockGeo;
  let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const t = (y + 1) / 2, taper = Math.pow(1 - t, 0.9) * 0.9 + 0.08, n = 1 + 0.18 * Math.sin(x * 5.1 + z * 3.7) + 0.1 * Math.sin(y * 7.3 + x * 2.2); P.setXYZ(i, x * taper * n * 0.45, (y + 1) * 1.1, z * taper * n * 0.45); }
  g.computeVertexNormals(); return (_rockGeo = g);
}
const ROCK_MAT = () => TX.rockMat || (TX.rockMat = new THREE.MeshStandardMaterial({ color: '#7a6a55', roughness: 0.95, metalness: 0 }));
function rockSpikes(p, n, h, o = {}) { // pilar de terra: pedras que rasgam o chão e voltam
  const g = new THREE.Group(); g.position.set(p.x, gy(p), p.z);
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(rockSpikeGeo(), ROCK_MAT()); const a = i / n * Math.PI * 2 + Math.random(), r = i === 0 ? 0 : rnd(0.35, 0.9) * (o.spread || 1);
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.set(rnd(-0.35, 0.35) * (i ? 1 : 0.3), rnd(0, 6.28), rnd(-0.35, 0.35) * (i ? 1 : 0.3)); const s = (i === 0 ? 1 : rnd(0.45, 0.75)) * h; m.userData.s = s; m.scale.setScalar(0.001); m.castShadow = true; g.add(m); }
  const dur = o.dur || 1.5;
  return add(g, dur, k => { const up = Math.min(1, k / 0.12), down = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1, e = 1 - Math.pow(1 - up, 3); g.children.forEach(m => { const s = m.userData.s * e * down; m.scale.set(s * 0.9, s, s * 0.9); }); });
}
function flash(p, color, intensity = 3, dist = 7, dur = 0.25) { // clarão breve (luz virtual do pool, nunca PointLight direto)
  if (!C.vlight) return; const L = C.vlight(color, intensity, dist); L.position.set(p.x, p.y + 1, p.z);
  add(L, dur, k => { L.intensity = intensity * (1 - k); }, () => { L.userData.dead = true; });
}
function glowSprite(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.scale.setScalar(size); return s; }
function shardGeo() { // cristal de gelo: losango alongado com pontas suaves
  if (TX.shard) return TX.shard;
  const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(new THREE.Vector2(Math.sin(u * Math.PI) * (0.06 + 0.02 * Math.sin(u * 9)), (u - 0.5) * 0.7)); }
  return (TX.shard = new THREE.LatheGeometry(pts, 7).rotateX(Math.PI / 2));
}
const ICE_MAT = () => TX.iceMat || (TX.iceMat = new THREE.MeshStandardMaterial({ color: '#cfeeff', emissive: '#5ab8ff', emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }));

/* ---------------- projéteis próprios (o dano chega quando ele bate) ---------------- */
function projectile(from, toFn, o) {
  const g = new THREE.Group(); g.position.copy(from);
  if (o.core) g.add(glowSprite(o.core, o.size || 0.5));
  if (o.halo) g.add(glowSprite(o.halo, (o.size || 0.5) * 2.2));
  if (o.mesh) g.add(o.mesh);
  let trailT = 0; const speed = o.speed || 18;
  const tgt = toFn(); g.lookAt(tgt);
  return add(g, 12, (k, dt) => {
    const to = toFn(), d = to.distanceTo(g.position), st = speed * dt;
    trailT += dt; if (o.trail && trailT > 0.016) { trailT = 0; o.trail(g.position); }
    if (o.spin) g.children.forEach((c, i) => { if (c.isMesh) c.rotation.z += dt * 8; });
    if (d <= st + 0.25) { g.position.copy(to); o.onHit(to); return false; }
    g.lookAt(to); g.position.addScaledVector(_pp.subVectors(to, g.position).normalize(), st);
  });
}

/* ---------------- cores dos elementos e assinatura de cada habilidade ---------------- */
const EL = { fogo: ['#ff7a2a', '#ffc35a', '#ff4a1a'], agua: ['#5ab8ff', '#bfe8ff', '#2a7aff'], terra: ['#d8a24a', '#8a6a3a', '#f0c870'], vento: ['#c8fff0', '#8af0d0', '#ffffff'], sagrado: ['#ffe68a', '#fff6d0', '#ffcf4a'], sombra: ['#3a2a44', '#1a141e', '#5a4a66'], veneno: ['#7fe05a', '#3a9a2a', '#c8ff8a'], arcano: ['#b08aff', '#d6c4ff', '#8fc4ff'], neutro: ['#ffffff', '#e8e8e8', '#ffe8b0'] };
const P3 = p => new THREE.Vector3(p.x, p.y ?? 0, p.z);
const up = (p, h) => new THREE.Vector3(p.x, (p.y ?? 0) + h, p.z);
const sound = n => { try { C.sound && C.sound(n); } catch (e) { } };

// cada habilidade: cast(origem, alvo, o) — chamado no início; wave(centro, R, i) — a cada onda de área; hit(alvo, o) — quando o golpe/projétil acerta; projectile(from, toFn, onHit) — quando é a habilidade que viaja
export const SKILL_FX = {
  primeiros_socorros: { cast: (a) => { sound('sk_heal'); spiral(a, EL.veneno.concat(['#ffffff']), { n: 18, r: 0.5, h: 1.9, dur: 1.0, size: 0.14 }); groundWave(a, 1.2, '#9affb0', { op: 0.6 }); lightColumn(a, 2.0, 0.4, '#9affb0', { op: 0.22, dur: 0.9 }); } }, // P-021: um brilho verde suave no corpo deixa a cura legível sem exagero
  cura_maior: { gems: 'agua', cast: (a) => { sound('sk_heal'); lightColumn(a, 3.2, 0.55, '#7fe0ff', { op: 0.36, dur: 1.4 }); spiral(a, ['#7fd8ff', '#c8fff0', '#5ab8ff'], { n: 26, r: 0.7, h: 2.6, dur: 1.4, size: 0.14 }); runeCircle(a, 1.3, '#8fe8ff', { kind: 'sol', dur: 1.5 }); } },
  golpe_poderoso: { hit: (t, o) => { sound('sk_slash'); slashArc(t, o.yaw, '#fff2c8', { r: 1.5, dur: 0.36, tilt: -0.5 }); slashArc(t, o.yaw, '#ffc35a', { r: 1.2, dur: 0.3, tilt: -0.5, h: 0.95 }); groundWave(t, 1.3, '#ffd27a', { op: 0.45, dur: 0.35 }); addShake(0.02); burst(up(t, 1), { n: 16, color: ['#ffe6a0', '#ffffff'], speed: 4, life: 0.35, size: 0.09, grav: 6 }); flash(up(t, 0), '#ffe6b0', 2, 5, 0.15); } },
  impacto_sismico: { cast: () => sound('sk_quake'), wave: (c, R, i) => { if (i) return; decal(c, R * 1.1, crackTex(), { dur: 3.5, op: 0.9 }); groundWave(c, R * 1.25, '#e0b070', { op: 0.55, dur: 0.7 });
    burst(up(c, 0.2), { n: 30, smoke: true, color: ['#8a7356', '#6e5c46'], speed: 4, up: 0.5, upBias: 0.3, life: 1.2, size: 0.9, s1: 1.6, a0: 0.55, drag: 2.6, flat: true, r0: 0.6 });
    burst(up(c, 0.1), { n: 22, color: ['#6a5a46', '#9a8466'], speed: 6, up: 1, upBias: 0.6, life: 0.8, size: 0.12, grav: 14, a0: 0.9, r0: 0.4 }); rockSpikes(c, 5, 0.55, { spread: 1.8, dur: 1.0 }); } },
  seta_de_fogo: { projectile: (f, to, hit) => fireball(f, to, hit, 0.32), hit: t => fireHit(t, 0.8) },
  bola_de_fogo: { projectile: (f, to, hit) => fireball(f, to, hit, 0.55), hit: t => fireHit(t, 1.5) },
  lanca_de_gelo: { projectile: (f, to, hit) => iceShard(f, to, hit), hit: t => { sound('sk_shatter'); burst(up(t, 1), { n: 18, color: EL.agua, speed: 4, life: 0.5, size: 0.08, grav: 8 }); groundWave(t, 1.3, '#bfe8ff', { op: 0.6, dur: 0.5 }); } },
  faisca: { projectile: (f, to, hit) => { sound('sk_zap'); const tg = to(); boltLine(f, tg, '#9fd8ff', { dur: 0.22 }); flash(tg, '#bfe0ff', 2.5, 6, 0.12); setTimeout(() => hit(tg), 60); }, hit: t => burst(up(t, 1), { n: 10, color: EL.vento, speed: 5, life: 0.25, size: 0.07 }) },
  barreira_arcana: { cast: (a, b, o) => { sound('sk_shield'); bubble(o.follow, 0.95, '#8fb8ff', { dur: 1.8 }); runeCircle(a, 1.2, '#9fc0ff', { dur: 1.6 }); } },
  disparo_duplo: { cast: (a) => burst(up(a, 1.4), { n: 6, color: ['#ffffff', '#e8f0ff'], speed: 2, life: 0.3, size: 0.06 }), hit: t => { burst(up(t, 1), { n: 12, color: ['#fff2c8', '#ffffff'], speed: 3.5, life: 0.35, size: 0.08, grav: 6 }); const s = glowSprite('#fff2c8', 0.4); s.position.copy(up(t, 1.05)); add(s, 0.22, k => { s.scale.setScalar(0.3 + k * 0.7); s.material.opacity = 1 - k; }); } }, // P-021: estalo claro no acerto (antes quase não se via)
  chuva_de_flechas: { cast: () => sound('sk_arrows'), wave: (c, R) => arrowRain(c, R) },
  lamina_envenenada: { hit: (t, o) => { sound('sk_poison'); slashArc(t, o.yaw, '#9aff6a', { r: 1.05, dur: 0.3 }); burst(up(t, 1), { n: 18, smoke: true, color: ['#3f8a2a', '#5aa83a'], speed: 1.6, life: 1.2, size: 0.3, s1: 0.6, a0: 0.7, grav: -0.6 });
    burst(up(t, 1.1), { n: 10, color: EL.veneno, speed: 2.5, life: 0.6, size: 0.07, grav: 7 }); } },
  montaria_de_guerra: { cast: (a) => { groundWave(a, 2.2, '#ffcf5a', { op: 0.6 }); burst(up(a, 0.2), { n: 18, smoke: true, color: ['#9a8466'], speed: 3, flat: true, life: 0.9, size: 0.6, s1: 1.1, a0: 0.4 }); } },
  lamina_runica: { cast: (a) => sound('sk_rune'), hit: (t, o) => { runeCircle(t, 1.4, '#5ac8ff', { dur: 1.1, spin: 1.4 }); slashArc(t, o.yaw, '#8fe0ff', { r: 1.45, tilt: -0.9, dur: 0.32 }); flash(t, '#7fd0ff', 2.6, 6, 0.2); sound('sk_heavy');
    for (let i = 0; i < 6; i++) setTimeout(() => emit(GLOW, { p: up(t, 0.3).add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6))), v: new THREE.Vector3(0, rnd(1, 2), 0), life: 0.9, s0: 0.16, s1: 0.04, color: '#8fe0ff' }), i * 40); } },
  furia_de_batalha: { cast: (a, b, o) => { sound('sk_rage'); groundWave(a, 1.8, '#ff6a3a', { op: 0.6 }); embers(o.follow, ['#ff7a3a', '#ffb05a', '#ff4a2a'], 1.6, 26); flash(a, '#ff7a3a', 2, 5, 0.3); lightColumn(a, 2.1, 0.45, '#ff5a2a', { op: 0.2, dur: 0.8 }); } }, // P-021: brilho vermelho breve no corpo
  julgamento: { cast: (a) => { sound('sk_holy'); runeCircle(a, 2.6, '#ffe08a', { kind: 'sol', dur: 1.6, spin: 0.3 }); lightColumn(a, 6, 0.9, '#ffe6a0', { op: 0.7, dur: 1.1 }); flash(a, '#ffe6a0', 3.2, 9, 0.5); },
    wave: (c, R, i) => { groundWave(c, R, '#ffe08a', { op: 0.8, dur: 0.6 }); for (let k = 0; k < 16; k++) emit(GLOW, { p: new THREE.Vector3(c.x + rnd(-R, R) * 0.7, gy(c) + rnd(2.5, 4), c.z + rnd(-R, R) * 0.7), v: new THREE.Vector3(0, -rnd(2, 4), 0), life: 0.9, s0: 0.12, s1: 0.05, color: EL.sagrado[k % 3], drag: 0.2 }); } },
  escudo_sagrado: { cast: (a, b, o) => { sound('sk_shield'); bubble(o.follow, 1.0, '#ffe08a', { dur: 1.8 }); motes(o.follow, EL.sagrado, 1.6, 18); } },
  meteoro: { hitDelay: 0.72, cast: () => sound('sk_meteor'), wave: (c, R, i) => meteor(c, R, i) }, // hitDelay: o dano entra quando a rocha toca o chão
  runa_de_fogo: { gems: 'fogo', cast: () => sound('sk_rune'), wave: (c, R, i) => { if (!i) runeCircle(c, R, '#ff9a4a', { dur: 1.8, spin: 0.8 }); fireHit(up(c, 0), 0.8 + R * 0.25, R); } },
  nevasca: { gems: 'agua', cast: () => sound('sk_wind'), wave: (c, R, i) => blizzard(c, R, i) },
  tempestade: { gems: 'vento', cast: () => sound('sk_wind'), wave: (c, R, i) => { for (let k = 0; k < 3; k++) setTimeout(() => { const p = new THREE.Vector3(c.x + rnd(-R, R) * 0.7, gy(c), c.z + rnd(-R, R) * 0.7); boltLine(up(p, 14), up(p, 0), '#b8d8ff', { w: 0.05, wild: 2.2, dur: 0.3 }); flash(p, '#c8e0ff', 3.5, 10, 0.18); groundWave(p, 1.4, '#b8d8ff', { op: 0.6, dur: 0.4 }); sound('sk_thunder'); }, k * 90); } },
  pilar_de_terra: { gems: 'terra', projectile: (f, to, hit) => { const t = to(); setTimeout(() => { rockSpikes(t, 4, 1.25, { dur: 1.6 }); sound('sk_rock'); burst(up(t, 0.1), { n: 22, smoke: true, color: ['#8a7356'], speed: 2.5, up: 0.4, life: 1.1, size: 0.7, s1: 1.2, a0: 0.5, flat: true }); burst(up(t, 0.2), { n: 16, color: ['#6a5a46', '#9a8466'], speed: 5, up: 1, upBias: 0.8, life: 0.8, size: 0.1, grav: 14 }); hit(t); }, 220); } },
  flecha_explosiva: { hit: t => { fireHit(t, 1.6, 1.4); decal(t, 1.1, crackTex(), { dur: 3, op: 0.55 }); } },
  cancao_de_batalha: { cast: (a, b, o) => { notes(o.follow, ['#ffd0e8', '#ffe6a0', '#c8e8ff'], 14); groundWave(a, 1.8, '#ffb3d9', { op: 0.5 }); } },
  nota_dissonante: { cast: (a, b, o) => notes(o.follow, ['#e08aff', '#ff8ab8'], 10), wave: (c, R) => { groundWave(c, R, '#e08aff', { op: 0.7, dur: 0.5 }); groundWave(c, R * 0.7, '#ff8ab8', { op: 0.5, dur: 0.45 }); } },
  golpe_sombrio: { hit: (t, o) => { sound('sk_shadow'); slashArc(t, o.yaw, '#2a2030', { r: 1.2, dark: true, dur: 0.35 }); slashArc(t, o.yaw, '#b48aff', { r: 1.25, dur: 0.32, tilt: 0.6 }); flash(up(t, 1), '#9a6bff', 1.6, 4, 0.18); // P-021: fio violeta legível sobre a sombra
    burst(up(t, 1), { n: 14, smoke: true, color: ['#1a141e', '#2a2030'], speed: 1.4, life: 0.9, size: 0.35, s1: 0.7, a0: 0.6, grav: -0.4 }); } },
  danca_das_laminas: { cast: () => sound('sk_blades'), wave: (c, R, i) => { for (let k = 0; k < 4; k++) setTimeout(() => { const yaw = (i * 4 + k) * 1.57 + rnd(-0.3, 0.3); slashArc(new THREE.Vector3(c.x, gy(c), c.z), yaw, '#e8eef8', { r: R * 0.55, h: rnd(0.7, 1.3), dur: 0.22, tilt: rnd(-1.2, 1.2) }); }, k * 50);
    burst(up(c, 1), { n: 10, color: ['#ffffff', '#cfd8e8'], speed: 5, flat: true, life: 0.25, size: 0.06 }); } },
  roubar: { hit: t => { sound('coin'); const s = glowSprite('#ffe08a', 0.5); s.position.copy(up(t, 1.5)); add(s, 0.5, k => { s.material.opacity = Math.sin(k * Math.PI); s.scale.setScalar(0.2 + k * 0.6); }); burst(up(t, 1.3), { n: 8, color: ['#ffd84a', '#fff2b0'], speed: 2, life: 0.5, size: 0.06, grav: 3 }); } },
  golpe_traicoeiro: { hit: (t, o) => { sound('sk_slash'); slashArc(t, o.yaw, '#ff5a4a', { r: 1.0, dur: 0.24, tilt: 0.9 }); burst(up(t, 1), { n: 10, smoke: true, color: ['#2a1418'], speed: 1, life: 0.6, size: 0.25, s1: 0.45, a0: 0.45 }); } },
};

/* efeitos compostos usados acima */
function spiral(at, colors, o) { const n = o.n || 16; for (let i = 0; i < n; i++) setTimeout(() => { const a = i * 0.9, r = o.r || 0.5; emit(GLOW, { p: new THREE.Vector3(at.x + Math.cos(a) * r, (at.y ?? gy(at)) + 0.1, at.z + Math.sin(a) * r), v: new THREE.Vector3(-Math.sin(a) * 0.6, (o.h || 2) / (o.dur || 1), Math.cos(a) * 0.6), life: o.dur || 1, s0: o.size || 0.1, s1: 0.03, color: colors[i % colors.length], drag: 0.3 }); }, i * ((o.dur || 1) * 500 / n)); }
function embers(follow, colors, dur, n) { for (let i = 0; i < n; i++) setTimeout(() => { const q = follow(); emit(GLOW, { p: new THREE.Vector3(q.x + rnd(-0.45, 0.45), q.y + rnd(0.1, 1.4), q.z + rnd(-0.45, 0.45)), v: new THREE.Vector3(rnd(-0.2, 0.2), rnd(0.8, 1.8), rnd(-0.2, 0.2)), life: rnd(0.5, 0.9), s0: 0.11, s1: 0.02, color: colors[i % colors.length], drag: 0.6 }); }, (i / n) * dur * 1000); }
function motes(follow, colors, dur, n) { for (let i = 0; i < n; i++) setTimeout(() => { const q = follow(), a = rnd(0, 6.28); emit(GLOW, { p: new THREE.Vector3(q.x + Math.cos(a) * 0.9, q.y + rnd(0.2, 1.8), q.z + Math.sin(a) * 0.9), v: new THREE.Vector3(-Math.cos(a) * 0.4, 0.3, -Math.sin(a) * 0.4), life: 0.9, s0: 0.09, s1: 0.02, color: colors[i % colors.length], drag: 0.8 }); }, (i / n) * dur * 1000); }
function notes(follow, colors, n) { // notas musicais que sobem flutuando e somem (canções do Bardo)
  for (let i = 0; i < n; i++) setTimeout(() => { const q = follow(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex(), color: colors[i % colors.length], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); const a = rnd(0, 6.28), r = rnd(0.3, 0.8), x0 = q.x + Math.cos(a) * r, z0 = q.z + Math.sin(a) * r, y0 = q.y + rnd(0.8, 1.6);
    s.scale.setScalar(0.22); add(s, 1.4, k => { s.position.set(x0 + Math.sin(k * 6 + i) * 0.12, y0 + k * 1.1, z0); s.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.9; s.material.rotation = Math.sin(k * 5 + i) * 0.3; }); }, i * 110); }
function fireball(from, toFn, onHit, size) {
  sound('sk_fireball');
  return projectile(from, toFn, { core: '#ffd27a', halo: '#ff6a1a', size, speed: 16, onHit,
    trail: p => { emit(GLOW, { p: p.clone(), v: randDir().multiplyScalar(0.4), life: 0.35, s0: size * 0.8, s1: size * 0.1, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffc35a', drag: 1 }); if (Math.random() < 0.35) emit(SMOKE, { p: p.clone(), v: new THREE.Vector3(0, 0.6, 0), life: 0.7, s0: size * 0.7, s1: size * 1.6, color: '#3a2a22', a0: 0.35 }); } });
}
function fireHit(t, s = 1, R = 0) {
  sound('sk_fireboom'); const c = up(t, R ? 0.4 : 1);
  burst(c, { n: Math.round(18 * s), color: EL.fogo, speed: 3.5 * s, life: 0.5, size: 0.28 * s, s1: 0.04, drag: 3, r0: R * 0.4 });
  burst(c, { n: Math.round(10 * s), smoke: true, color: ['#2e2622', '#4a3a30'], speed: 1.6 * s, life: 1.2, size: 0.5 * s, s1: 1.1 * s, a0: 0.5, grav: -0.8, r0: R * 0.4 });
  burst(c, { n: Math.round(12 * s), color: ['#ffd27a', '#ffffff'], speed: 6 * s, life: 0.45, size: 0.05, grav: 8 });
  flash(c, '#ff9a4a', 2.5 * s, 6 + 3 * s, 0.25); if (R) groundWave(t, R, '#ff9a4a', { op: 0.6, dur: 0.5 });
}
function iceShard(from, toFn, onHit) {
  sound('sk_ice'); const m = new THREE.Mesh(shardGeo(), ICE_MAT());
  return projectile(from, toFn, { mesh: m, halo: '#8fd0ff', size: 0.35, speed: 20, onHit, trail: p => emit(GLOW, { p: p.clone(), v: randDir().multiplyScalar(0.3), life: 0.4, s0: 0.08, s1: 0.02, color: Math.random() < 0.5 ? '#bfe8ff' : '#ffffff' }) });
}
function arrowRain(c, R) { // flechas de verdade caindo do céu na área
  for (let k = 0; k < 9; k++) setTimeout(() => { const p = new THREE.Vector3(c.x + rnd(-R, R) * 0.75, gy(c), c.z + rnd(-R, R) * 0.75), a = C.makeArrow ? C.makeArrow() : glowSprite('#fff', 0.2), y0 = p.y + 9; if (C.makeArrow) a.userData.keep = true;
    a.position.set(p.x - 1.2, y0, p.z); a.lookAt(p.x, p.y, p.z);
    let landed = false; // P-021: a flecha fica cravada no chão um instante (antes sumia ao tocar e quase não se via a chuva)
    add(a, 1.3, k2 => { const f = Math.min(1, k2 / 0.25); a.position.set(p.x - 1.2 * (1 - f), y0 - (y0 - p.y - 0.3) * f, p.z); if (f >= 1 && !landed) { landed = true; burst(up(p, 0.1), { n: 6, smoke: true, color: ['#8a7a62'], speed: 1.2, flat: true, life: 0.6, size: 0.25, s1: 0.5, a0: 0.4 }); } }); }, k * 35);
}
/* P-021: meteoro de verdade — rocha incandescente que cai do céu em diagonal com rastro de fumaça e brasas,
   sombra que cresce no chão como aviso, impacto com onda de choque, poeira, cratera com brasas que esfriam e tremida leve */
function meteorGeo() {
  if (TX.meteorGeo) return TX.meteorGeo;
  let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = 1 + 0.16 * Math.sin(x * 4.3 + y * 2.1) + 0.11 * Math.sin(z * 5.7 - x * 1.9) + 0.07 * Math.sin(y * 9.1 + z * 3.3); P.setXYZ(i, x * n * 1.12, y * n * 0.92, z * n); }
  g.computeVertexNormals(); return (TX.meteorGeo = g);
}
const METEOR_MAT = () => TX.meteorMat || (TX.meteorMat = new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 0.95, metalness: 0, emissive: '#ff4a10', emissiveIntensity: 0.55 })); // crosta escura que ainda brilha (forte demais virava uma bola laranja chapada)
function meteorShadow(t, r, dur) { // aviso: mancha escura que cresce e esquenta até o impacto
  const mat = new THREE.MeshBasicMaterial({ map: dotTex(), color: '#2a0e04', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat); m.position.set(t.x, t.y + 0.05, t.z);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), addMat(ringTex(), '#ff7a2a', 0)); glow.position.set(t.x, t.y + 0.07, t.z); m.add(glow); glow.position.set(0, 0.02, 0); glow.renderOrder = 3;
  return add(m, dur, k => { const e = k * k; m.scale.setScalar(r * (0.35 + 0.65 * k)); m.material.opacity = 0.7 * Math.min(1, k * 3); glow.material.opacity = 0.15 + 0.6 * e; glow.scale.setScalar(1 + 0.08 * Math.sin(k * 40)); });
}
function meteor(c, R, i) {
  const t = new THREE.Vector3(c.x + rnd(-R, R) * 0.4, gy(c), c.z + rnd(-R, R) * 0.4), dir = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize();
  const from = new THREE.Vector3(t.x - dir.x * 13, t.y + 24, t.z - dir.z * 13), size = 0.75 + rnd(0, 0.25), fall = 0.72;
  const g = new THREE.Group(), rock = new THREE.Mesh(meteorGeo(), METEOR_MAT()); rock.scale.setScalar(size);
  const halo = glowSprite('#ff6a1a', size * 3.2), core = glowSprite('#ffd27a', size * 1.3); g.add(halo, core, rock); g.position.copy(from); // brilho menor: a rocha aparece (antes virava uma bola laranja)
  if (!i) sound('sk_meteor');
  meteorShadow(t, Math.max(1.2, R * 0.75), fall);
  let tr = 0; const spin = new THREE.Vector3(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4));
  add(g, fall, (k, dt) => {
    const e = Math.pow(k, 1.6); g.position.lerpVectors(from, t, e); rock.rotation.x += spin.x * dt; rock.rotation.y += spin.y * dt; rock.rotation.z += spin.z * dt;
    halo.material.opacity = 0.5 + 0.1 * Math.sin(T * 40); tr += dt;
    if (tr > 0.014) { tr = 0; const p = g.position.clone();
      emit(GLOW, { p, v: randDir().multiplyScalar(0.6), life: 0.45, s0: size * 1.3, s1: size * 0.15, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffc35a', drag: 1.2 });
      emit(SMOKE, { p: p.clone(), v: new THREE.Vector3(0, 0.4, 0), life: 1.6, s0: size * 1.2, s1: size * 3.4, color: Math.random() < 0.5 ? '#2a221e' : '#4a3a30', a0: 0.7 });
      if (Math.random() < 0.6) emit(GLOW, { p: p.clone(), v: randDir().multiplyScalar(2.2).add(new THREE.Vector3(0, -1, 0)), life: rnd(0.6, 1.1), s0: 0.08, s1: 0.02, color: '#ffb04a', grav: 3, drag: 0.4 }); }
    if (k >= 1) {
      fireHit(t, 2.4, R); flash(up(t, 0.5), '#ff8a3a', 4, 12, 0.45);
      const fb = glowSprite('#ffb060', 1); fb.position.copy(up(t, 0.6)); add(fb, 0.4, k2 => { fb.scale.setScalar(0.5 + R * 1.3 * Math.sqrt(k2)); fb.position.y = t.y + 0.6 + k2 * 1.2; fb.material.opacity = 1 - k2 * k2; }); // bola de fogo do impacto addShake(i ? 0.03 : 0.05); sound('sk_quake');
      groundWave(t, R * 1.5, '#ffb070', { op: 0.75, dur: 0.55 }); setTimeout(() => groundWave(t, R * 2.1, '#e8c8a0', { op: 0.4, dur: 0.8 }), 70); // onda de choque em dois anéis
      burst(up(t, 0.25), { n: 30, smoke: true, color: ['#7a6650', '#5e4e3e', '#8a7356'], speed: 5, up: 0.4, upBias: 0.25, life: 1.6, size: 1.0, s1: 2.2, a0: 0.55, drag: 2.4, flat: true, r0: 0.5 }); // poeira baixa
      burst(up(t, 0.2), { n: 18, color: ['#3a2e26', '#6a5a46'], speed: 7, up: 1, upBias: 0.7, life: 0.9, size: 0.14, grav: 16, a0: 0.95, r0: 0.3 }); // pedrinhas
      decal(t, Math.max(1.0, R * 0.7), dotTex(), { dur: 6, op: 0.8, color: '#1c120c' }); // cratera: chão chamuscado
      decal(t, Math.max(1.1, R * 0.85), crackTex(), { dur: 6, op: 0.85 }); // e rachado
      for (let n = 0; n < 16; n++) { const a = rnd(0, 6.28), d = rnd(0.1, 0.9) * Math.max(0.9, R * 0.6); emit(GLOW, { p: new THREE.Vector3(t.x + Math.cos(a) * d, t.y + 0.08, t.z + Math.sin(a) * d), v: new THREE.Vector3(0, 0.05, 0), life: rnd(1.8, 3.2), s0: rnd(0.18, 0.32), s1: 0.03, color: n % 3 ? '#ff6a1a' : '#ffb04a', drag: 2 }); } // brasas no chão que esfriam
    } });
}
function blizzard(c, R, i) {
  for (let k = 0; k < 28; k++) emit(GLOW, { p: new THREE.Vector3(c.x + rnd(-R, R), gy(c) + rnd(1.5, 5), c.z + rnd(-R, R)), v: new THREE.Vector3(rnd(1.5, 3), -rnd(2, 4), rnd(-1, 1)), life: rnd(0.8, 1.4), s0: rnd(0.05, 0.12), s1: 0.04, color: '#ffffff', drag: 0.1 });
  burst(up(c, 0.5), { n: 12, smoke: true, color: ['#d8eef8', '#bcd8ec'], speed: 2.5, flat: true, life: 1.4, size: 1.0, s1: 1.8, a0: 0.3, r0: R * 0.5 });
  for (let k = 0; k < 4; k++) setTimeout(() => { const p = new THREE.Vector3(c.x + rnd(-R, R) * 0.6, gy(c), c.z + rnd(-R, R) * 0.6), m = new THREE.Mesh(shardGeo(), ICE_MAT()); m.scale.setScalar(1.6); const y0 = p.y + 6;
    add(m, 0.3, k2 => { m.position.set(p.x, y0 - (y0 - p.y - 0.25) * k2, p.z); m.rotation.set(Math.PI / 2, 0, 0); if (k2 >= 1) burst(up(p, 0.2), { n: 8, color: EL.agua, speed: 3, life: 0.4, size: 0.06, grav: 8 }); }); }, k * 70);
  if (!i) groundWave(c, R, '#bfe8ff', { op: 0.5, dur: 0.8 });
}

// libera geometrias e materiais próprios de cada efeito (texturas, pedra e gelo são compartilhados e ficam)
function freeObj(obj) {
  if (!obj.traverse || obj.userData.keep) return; // flechas de verdade usam peças compartilhadas do jogo
  obj.traverse(o => {
    if ((o.isMesh || o.isSprite) && o.geometry && o.geometry !== _rockGeo && o.geometry !== TX.shard && o.geometry !== TX.meteorGeo && !o.isSprite) o.geometry.dispose();
    if (o.material && o.material !== TX.rockMat && o.material !== TX.iceMat && o.material !== TX.meteorMat) o.material.dispose();
  });
}

/* ---------------- API ---------------- */
export function initSkillFx(ctx) {
  C = ctx; if (GLOW) return;
  GLOW = makePool(700, dotTex(), true); SMOKE = makePool(260, smokeTex(), false);
  ctx.scene.add(GLOW.mesh, SMOKE.mesh);
}
/* id: habilidade · from/to: {x,y,z} · o: { radius, wave, phase:'cast'|'wave'|'hit', yaw, follow() } */
export function playSkillFx(id, from, to, o = {}) {
  const F = SKILL_FX[id]; if (!F || !C) return;
  const f = P3(from), t = P3(to || from), yaw = o.yaw ?? Math.atan2(t.x - f.x, t.z - f.z), follow = o.follow || (() => f);
  const ph = o.phase || 'cast';
  if (ph === 'cast' && F.cast) F.cast(f, t, { ...o, yaw, follow });
  else if (ph === 'wave' && F.wave) F.wave(t, o.radius || 2, o.wave || 0);
  else if (ph === 'hit' && F.hit) F.hit(t, { ...o, yaw });
}
/* P-021: efeito completo para OUTRO jogador (online): o sync só traz o lançamento, então aqui o efeito toca inteiro —
   lançamento + projétil até o alvo (ou golpe) + ondas de área — só visual, sem dano */
export function playSkillFxRemote(id, from, to, o = {}) {
  const F = SKILL_FX[id]; if (!F || !C) return;
  playSkillFx(id, from, to, o);
  const f = P3(from), t = P3(to || from);
  if (F.projectile) { const a = up(f, 1.2), b = up(t, 1.0); F.projectile(a, () => b.clone(), p => { if (F.hit) F.hit(p || b, { yaw: Math.atan2(t.x - f.x, t.z - f.z) }); }); }
  else if (F.hit) setTimeout(() => F.hit(up(t, 0), { yaw: Math.atan2(t.x - f.x, t.z - f.z) }), 250);
  if (F.wave) { const R = o.radius || 2.5, n = o.waves || 3; for (let i = 0; i < n; i++) setTimeout(() => F.wave(t, R, i), 150 + i * 250); }
}
// a habilidade viaja até o alvo? (true = o efeito cuida do projétil e chama onHit no impacto)
export function skillProjectile(id, from, toFn, onHit, delay = 0) { const F = SKILL_FX[id]; if (!F || !F.projectile || !C) return false; const f0 = from.clone(), go = () => F.projectile(f0, toFn, p => { onHit(); if (F.hit) F.hit(p, {}); }); if (delay > 0) setTimeout(go, delay * 1000); else go(); return true; } // delay: espera o auge do gesto
export function skillHitDelay(id) { const F = SKILL_FX[id]; return F && F.hitDelay || 0; }
export function skillGemElement(id) { const F = SKILL_FX[id]; return F && F.gems || null; }
export function updateSkillFx(dt) {
  if (!C) return; T += dt;
  for (let i = live.length - 1; i >= 0; i--) {
    const e = live[i]; e.t += dt; const k = Math.min(1, e.t / e.dur); const r = e.update ? e.update(k, dt) : true;
    if (r === false || k >= 1) { if (e.obj.parent) e.obj.parent.remove(e.obj); if (e.dispose) e.dispose(); freeObj(e.obj); live.splice(i, 1); }
  }
  stepPool(GLOW, dt, C.camera); stepPool(SMOKE, dt, C.camera);
}
