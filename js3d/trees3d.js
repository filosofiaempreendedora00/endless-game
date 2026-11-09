/* =========================================================================
   ÁRVORES feitas em código — carvalhos de copa volumosa e pinheiros com
   camadas recortadas. Cada variação é uma geometria única (uma chamada de
   desenho por árvore), com cores por vértice (escuro embaixo, claro em cima).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';

function rngOf(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function colorize(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(tmp, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// deforma a malha com "ondulações" para não parecer uma bola perfeita
function lumpy(geo, rng, amt) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  const f1 = 2 + rng() * 2, f2 = 3 + rng() * 3, ph = rng() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * f1 + ph) * Math.cos(v.z * f2 + ph) + Math.sin(v.y * f2 * 0.7 + ph * 2) * 0.5;
    v.multiplyScalar(1 + n * amt + (rng() - 0.5) * amt * 0.6);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
const toNonIndexed = g => (g.index ? g.toNonIndexed() : g);
function trunkGeo(rng, h, r0, r1, barkA, barkB) {
  // S-150: tronco com casca sulcada e base que se alarga em raízes (como árvore de verdade saindo da terra)
  const g = new THREE.CylinderGeometry(r1, r0 * 1.15, h + 0.9, 14, 8); g.translate(0, (h + 0.9) / 2 - 0.9, 0); // continua 90 cm para dentro da terra (não flutua em encostas)
  const p = g.attributes.position, ph = rng() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), yy = Math.max(0, y) / h, ang = Math.atan2(z, x);
    const flare = 1 + Math.max(0, 0.6 - y) * 0.9 * (0.6 + 0.4 * Math.abs(Math.sin(ang * 2.5 + ph))); // raízes na base
    const groove = 1 + Math.sin(ang * 9 + y * 1.5 + ph) * 0.035; // sulcos da casca
    p.setXYZ(i, x * flare * groove + Math.sin(yy * 3 + 1 + ph) * 0.1 * yy, y, z * flare * groove + Math.cos(yy * 2.3 + ph) * 0.06 * yy);
  }
  g.computeVertexNormals();
  const a = new THREE.Color(barkA), b = new THREE.Color(barkB);
  return colorize(toNonIndexed(g), (c, x, y, z) => c.copy(a).lerp(b, Math.min(1, Math.max(0, y) / h) * 0.5 + (Math.sin(Math.atan2(z, x) * 9 + y * 1.5) * 0.5 + 0.5) * 0.35).multiplyScalar(y < 0.3 ? 0.85 : 1));
}
// folhagem: blob com "cachos" de folha (ruído de alta frequência) em vez de bola lisa
function foliageBlob(rng, rr, detail = 4) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(rr, detail)), p = g.attributes.position, v = new THREE.Vector3(), ph = rng() * 20;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const big = Math.sin(n.x * 2.3 + ph) * Math.cos(n.z * 2.1 + ph) * 0.12 + Math.sin(n.y * 3.1 + ph * 1.3) * 0.06;
    const leafy = Math.sin(n.x * 11 + ph) * Math.sin(n.y * 13 + ph * 0.7) * Math.sin(n.z * 12 - ph) * 0.07; // cachos de folhas
    v.multiplyScalar(1 + big + leafy); if (v.y < -rr * 0.45) v.y = -rr * 0.45 + (v.y + rr * 0.45) * 0.4; // fundo achatado
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

/* ---------- Folhagem de verdade (auditoria): cartões com folhas desenhadas uma a uma (recorte por alphaTest),
   em vez de bolas lisas. Atlas 2×2 com 4 cachos diferentes; agulhas de pinheiro em ramos com caimento. ---------- */
const ATLAS = {};
function leafAtlas(kind) {
  if (ATLAS[kind]) return ATLAS[kind];
  const W = 1024, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'), rng = rngOf(kind === 'leaf' ? 7 : 13);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * W / 2, oy = Math.floor(q / 2) * W / 2, S = W / 2;
    x.save(); x.beginPath(); x.rect(ox, oy, S, S); x.clip();
    if (kind === 'leaf') {
      // galhinhos finos por baixo (aparecem nos vãos)
      x.strokeStyle = '#4a3420'; x.lineCap = 'round';
      for (let k = 0; k < 5; k++) { x.lineWidth = 2 + rng() * 2; x.beginPath(); x.moveTo(ox + S / 2, oy + S * 0.95); x.quadraticCurveTo(ox + S * (0.2 + rng() * 0.6), oy + S * 0.5, ox + S * (0.1 + rng() * 0.8), oy + S * (0.1 + rng() * 0.3)); x.stroke(); }
      // folhas: elipses pontudas com nervura central, várias tonalidades, densas no meio e ralas na borda
      const n = 230;
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, rr = Math.pow(rng(), 0.7) * S * 0.46, px = ox + S / 2 + Math.cos(a) * rr, py = oy + S / 2 + Math.sin(a) * rr * 0.92;
        const L = S * (0.05 + rng() * 0.035), Wd = L * (0.42 + rng() * 0.12), rot = a + (rng() - 0.5) * 1.6;
        const tone = rng(), edge = rr / (S * 0.46);
        const g = Math.round(95 + tone * 70 - edge * 10), r = Math.round(48 + tone * 40), b = Math.round(28 + tone * 22);
        x.save(); x.translate(px, py); x.rotate(rot);
        x.fillStyle = `rgb(${r},${g},${b})`; x.beginPath(); x.moveTo(-L / 2, 0); x.quadraticCurveTo(0, -Wd, L / 2, 0); x.quadraticCurveTo(0, Wd, -L / 2, 0); x.fill();
        x.fillStyle = `rgba(255,255,220,${0.08 + tone * 0.12})`; x.beginPath(); x.moveTo(-L / 2, 0); x.quadraticCurveTo(0, -Wd, L / 2, 0); x.quadraticCurveTo(0, -Wd * 0.2, -L / 2, 0); x.fill(); // lado iluminado
        x.strokeStyle = `rgba(30,50,20,0.45)`; x.lineWidth = 1; x.beginPath(); x.moveTo(-L / 2, 0); x.lineTo(L / 2, 0); x.stroke();
        x.restore();
      }
    } else { // agulhas: ramo central com raminhos laterais densos de agulhas (forma de pena), pontas mais claras
      const base = [[26, 58, 34], [30, 64, 36], [24, 54, 32], [34, 70, 40]][q];
      x.strokeStyle = '#3a2818'; x.lineWidth = 6; x.beginPath(); x.moveTo(ox + S / 2, oy + S); x.lineTo(ox + S / 2, oy + S * 0.03); x.stroke();
      for (let j = 0; j < 30; j++) {
        const yy = oy + S * (0.05 + j / 30 * 0.92), side = j % 2 ? 1 : -1, prof = Math.sin(Math.PI * Math.min(1, (j / 30) * 1.1 + 0.05)), len = S * 0.44 * prof * (0.8 + rng() * 0.25);
        const ex = ox + S / 2 + side * len, ey = yy - len * 0.35;
        x.strokeStyle = '#3e2a1a'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(ox + S / 2, yy); x.lineTo(ex, ey); x.stroke();
        for (let k = 0; k < 34; k++) { const t2 = k / 34, bx = ox + S / 2 + (ex - ox - S / 2) * t2, by = yy + (ey - yy) * t2, nl = S * 0.045 * (1 - t2 * 0.35) * (0.7 + rng() * 0.6), tone = rng() * 0.7 + t2 * 0.3;
          x.strokeStyle = `rgb(${base[0] + tone * 30 | 0},${base[1] + tone * 46 | 0},${base[2] + tone * 22 | 0})`; x.lineWidth = 2;
          for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + side * nl * 0.45, by + sd * nl); x.stroke(); } }
      }
    }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return (ATLAS[kind] = t);
}
// um cartão (quad subdividido no comprimento para poder curvar), com normais "de copa" (suaves, apontando para fora do centro)
function card(out, o) {
  const { cx, cy, cz, w, h, dir, up, uvq, droop = 0, center, shade } = o, seg = 3;
  const side = new THREE.Vector3().crossVectors(dir, up).normalize(), u2 = new THREE.Vector3().crossVectors(side, dir).normalize();
  const base = out.pos.length / 3;
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= 1; j++) {
    const t = i / seg, sx = (j - 0.5) * w;
    const px = cx + dir.x * h * t + side.x * sx - u2.x * droop * t * t, py = cy + dir.y * h * t + side.y * sx - u2.y * droop * t * t - droop * t * t * 0.5, pz = cz + dir.z * h * t + side.z * sx - u2.z * droop * t * t;
    out.pos.push(px, py, pz);
    const n = new THREE.Vector3(px - center.x, (py - center.y) * 0.8, pz - center.z).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
    out.nor.push(n.x, n.y, n.z);
    out.uv.push((uvq % 2) * 0.5 + 0.005 + j * 0.49, 0.5 - Math.floor(uvq / 2) * 0.5 + 0.005 + t * 0.49); // quadrante do atlas (base do ramo embaixo da imagem)
    const sh = shade(px, py, pz); out.col.push(sh.r, sh.g, sh.b);
  }
  for (let i = 0; i < seg; i++) { const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3; out.idx.push(a, b, c, b, d, c); }
}
function cardGeo(out) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3)); g.setIndex(out.idx); g.computeBoundingSphere(); return g;
}
const rndDir = rng => { const u = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u); return new THREE.Vector3(Math.cos(a) * r, u, Math.sin(a) * r); };

/* ---------- Carvalho / árvore de folhas ---------- */
export function oakGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const h = 3.4 + rng() * 1.6, R = 2.3 + rng() * 1.1; // carvalhos maiores (proporção com os personagens)
  const parts = [trunkGeo(rng, h + 0.6, 0.42, 0.22, '#4f3523', '#7a5638')];
  // galhos principais que sobem até dentro da copa (cada um sustenta um cacho de folhas)
  const n = 6 + Math.floor(rng() * 4), cy = h + R * 0.55, tips = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rng() * 0.6, d = i === 0 ? 0 : R * (0.4 + rng() * 0.45), y = cy + (rng() - 0.3) * R * 0.5 - (i === 0 ? 0 : d * 0.15);
    tips.push([a, d, y]);
    if (i === 0) continue;
    const from = new THREE.Vector3(0, h * (0.62 + rng() * 0.15), 0), to = new THREE.Vector3(Math.cos(a) * d * 0.8, y - R * 0.25, Math.sin(a) * d * 0.8);
    const len = from.distanceTo(to);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); const br2 = new THREE.CylinderGeometry(0.05, 0.13, len, 7, 3); br2.translate(0, len / 2, 0); br2.applyQuaternion(q); br2.translate(from.x, from.y, from.z);
    parts.push(colorize(toNonIndexed(br2), (c, x, y2, z) => c.set('#5a3e28').offsetHSL(0, 0, (Math.sin(x * 9 + z * 7) * 0.5) * 0.05)));
  }
  // copa (auditoria): cada cacho é uma nuvem de cartões com folhas desenhadas — silhueta recortada, vãos onde o céu aparece
  // e os galhos aparecem por dentro. Mais escuro no miolo e embaixo (sombra própria), mais claro em cima.
  const dk = opts.dark ? 0.72 : 1, out = { pos: [], nor: [], uv: [], col: [], idx: [] }, center = new THREE.Vector3(0, cy, 0), tmp = new THREE.Color();
  // galhinhos curtos saindo de cada ponta para dentro dos cachos
  tips.forEach(([a, d, y], i) => {
    const rr = R * (i === 0 ? 0.8 : 0.5 + rng() * 0.3), ccx = Math.cos(a) * d, ccz = Math.sin(a) * d, hue = (rng() - 0.5) * 0.05;
    const nCards = Math.round(12 + rr * 9);
    for (let k = 0; k < nCards; k++) {
      const dir = rndDir(rng); const along = Math.pow(rng(), 0.55); // mais cartões na casca externa do cacho
      const px = ccx + dir.x * rr * along * 0.85, py = y + dir.y * rr * along * 0.62, pz = ccz + dir.z * rr * along * 0.85;
      const sz = 1.0 + rng() * 0.8, out2 = new THREE.Vector3(px, py - cy * 0.15, pz).normalize(), up = new THREE.Vector3(rng() - 0.5, 1, rng() - 0.5).normalize();
      const dirC = out2.clone().add(rndDir(rng).multiplyScalar(0.6)).normalize(); if (Math.abs(dirC.dot(up)) > 0.95) up.set(1, 0, 0);
      card(out, { cx: px - dirC.x * sz * 0.5, cy: py - dirC.y * sz * 0.5, cz: pz - dirC.z * sz * 0.5, w: sz, h: sz, dir: dirC, up, uvq: Math.floor(rng() * 4), droop: sz * 0.12, center,
        shade: (x, yy, z) => { const inner = Math.min(1, Math.hypot(x, (yy - cy) * 1.2, z) / (R * 1.25)), top = Math.min(1, Math.max(0, (yy - (cy - R * 0.9)) / (R * 1.8))); const v = (0.58 + inner * 0.34 + top * 0.3) * dk; return tmp.setRGB(v * (1 + hue), v, v * (1 - hue * 0.5)); } });
    }
  });
  const leaf = cardGeo(out);
  const g = mergeGeometries(parts); // tronco e galhos (sombreado liso)
  return { geo: g, leaf, leafKind: 'leaf', radius: 0.55, height: cy + R };
}

/* ---------- Pinheiro com camadas de galhos caídos (e versão com neve, S-158) ---------- */
export function pineGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const H = 7.5 + rng() * 4, base = 2.1 + rng() * 0.7;
  const parts = [trunkGeo(rng, H * 0.4, 0.27, 0.12, '#47301f', '#6a4630')];
  const dark = new THREE.Color(opts.dark ? '#14321d' : '#1d4628'), light = new THREE.Color(opts.dark ? '#2c6339' : '#467f45');
  const snowA = new THREE.Color('#f4f8fb'), snowB = new THREE.Color('#d6e3ee');
  // auditoria: camadas de galhos feitos de cartões de agulhas (ramos com caimento), em volta de um miolo escuro que dá massa
  const layers = 8 + Math.floor(rng() * 3), out = { pos: [], nor: [], uv: [], col: [], idx: [] }, tmp = new THREE.Color(), dk = opts.dark ? 0.7 : 0.9;
  for (let i = 0; i < layers; i++) {
    const k = i / layers, r = base * (1 - k * 0.85) * (0.92 + rng() * 0.16), y0 = H * 0.2 + k * H * 0.72, nb = Math.max(7, Math.round(9 + r * 4)), off = rng() * 6, center = new THREE.Vector3(0, y0, 0);
    // miolo: cone escuro e liso (não aparece como cone: fica dentro dos ramos e só escurece os vãos)
    const core = new THREE.ConeGeometry(r * 0.3, H * 0.16, 12, 1, true); core.translate(0, y0 + H * 0.04, 0);
    parts.push(colorize(toNonIndexed(core.deleteAttribute('uv')), c => c.copy(dark).multiplyScalar(0.55)));
    for (let j = 0; j < nb; j++) {
      const a = j / nb * Math.PI * 2 + off + (rng() - 0.5) * 0.4, len = r * (0.85 + rng() * 0.3), dir = new THREE.Vector3(Math.cos(a), 0.18 - k * 0.1 + (rng() - 0.5) * 0.1, Math.sin(a)).normalize();
      const up = new THREE.Vector3(0, 1, 0), w = len * (0.62 + rng() * 0.2), y = y0 + (rng() - 0.5) * H * 0.03;
      for (const tilt of [0, 0.9]) { // dois cartões cruzados por ramo (volume de todos os lados)
        const upT = up.clone().applyAxisAngle(dir, tilt);
        card(out, { cx: Math.cos(a) * 0.1, cy: y, cz: Math.sin(a) * 0.1, w, h: len, dir, up: upT, uvq: Math.floor(rng() * 4), droop: len * (0.38 + rng() * 0.18), center,
          shade: (x, yy, z) => { const out2 = Math.min(1, Math.hypot(x, z) / Math.max(0.3, r)), v = (0.62 + out2 * 0.38 + k * 0.12) * dk; return tmp.setRGB(v, v, v); } });
      }
      if (opts.snow && j % 3 === 0) { // S-158: montinhos de neve fofa em alguns ramos (o resto da neve vem do material, pelo lado de cima de cada ramo)
        const sn = mergeVertices(new THREE.SphereGeometry(1, 9, 5)); sn.scale(len * 0.36, 0.07 + rng() * 0.05, w * 0.3);
        const P = sn.attributes.position; for (let q = 0; q < P.count; q++) { const yy = P.getY(q); if (yy < 0) P.setY(q, yy * 0.3); P.setX(q, P.getX(q) + Math.sin(P.getZ(q) * 9 + j) * 0.03); }
        sn.computeVertexNormals(); sn.rotateY(-a); sn.translate(Math.cos(a) * len * 0.42, y + len * 0.05, Math.sin(a) * len * 0.42);
        parts.push(colorize(toNonIndexed(sn.deleteAttribute('uv')), (c, x, yy) => c.copy(snowA).lerp(snowB, rng() * 0.4)));
      }
    }
  }
  
  // ponta: três cartões de agulhas em pé (broto do topo), nada de cone liso
  for (let j = 0; j < 3; j++) { const a = j / 3 * Math.PI; card(out, { cx: 0, cy: H * 0.84, cz: 0, w: 0.38, h: H * 0.13, dir: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), uvq: j, droop: 0, center: new THREE.Vector3(0, H * 0.8, 0), shade: () => tmp.setRGB(0.9 * dk, 0.9 * dk, 0.9 * dk) }); }
  const leaf2 = cardGeo(out);
  const g = mergeGeometries(parts.map(q => { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; }));
  return { geo: g, leaf: leaf2, leafKind: opts.snow ? 'needleSnow' : 'needle', radius: 0.45, height: H };
}

/* ---------- Toco com raízes (enterrado no chão, não flutua em encostas) ---------- */
export function stumpGeometry(seed) {
  const rng = rngOf(seed);
  const h = 0.45 + rng() * 0.45, r = 0.32 + rng() * 0.18;
  const parts = [];
  const g = new THREE.CylinderGeometry(r * 0.92, r * 1.15, h + 0.6, 10, 3); g.translate(0, (h + 0.6) / 2 - 0.6, 0); // 60 cm abaixo do chão
  const p = g.attributes.position; // topo serrado inclinado e irregular
  for (let i = 0; i < p.count; i++) { if (p.getY(i) > h - 0.05) p.setY(i, h + p.getX(i) * 0.12 + (rng() - 0.5) * 0.06); }
  g.computeVertexNormals();
  const barkA = new THREE.Color('#4e3522'), barkB = new THREE.Color('#6d4c33'), wood = new THREE.Color('#c9a674'), ring = new THREE.Color('#a8824f');
  parts.push(colorize(toNonIndexed(g), (c, x, y, z) => {
    if (y > h - 0.12 && Math.hypot(x, z) < r * 0.85) { const d = Math.hypot(x, z) / r; c.copy(wood).lerp(ring, (Math.sin(d * 22) * 0.5 + 0.5) * 0.6); } // anéis da madeira
    else c.copy(barkA).lerp(barkB, (Math.sin(x * 18 + z * 11 + y * 4) * 0.5 + 0.5) * 0.7);
  }));
  // raízes saindo e entrando no chão
  const nr = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < nr; i++) {
    const a = i / nr * Math.PI * 2 + rng() * 0.5, len = 0.5 + rng() * 0.4;
    const root = new THREE.CylinderGeometry(0.04, 0.13, len, 6); root.translate(0, len / 2, 0);
    root.rotateZ(-(1.15 + rng() * 0.25)); root.rotateY(-a); root.translate(Math.cos(a) * r * 0.6, 0.12, Math.sin(a) * r * 0.6);
    parts.push(colorize(toNonIndexed(root), (c, x, y, z) => c.copy(barkA).lerp(barkB, (Math.sin(x * 15 + z * 9) * 0.5 + 0.5) * 0.5)));
  }
  if (rng() < 0.6) { // musgo / cogumelinhos
    const moss = new THREE.SphereGeometry(r * 0.5, 8, 6); moss.scale(1, 0.25, 1); moss.translate((rng() - 0.5) * r, h * (0.3 + rng() * 0.3), r * 0.9);
    parts.push(colorize(toNonIndexed(moss), c => c.set('#5f8f3c')));
  }
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  return { geo, radius: r + 0.1, height: h };
}
/* ---------- Tronco caído (meio enterrado) ---------- */
export function logGeometry(seed) {
  const rng = rngOf(seed);
  const L = 2.2 + rng() * 1.6, r = 0.22 + rng() * 0.12;
  const g = new THREE.CylinderGeometry(r, r * 1.12, L, 10, 6); g.rotateZ(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + Math.sin(x * 1.3) * 0.05); } // levemente torto
  g.computeVertexNormals(); g.translate(0, r * 0.55, 0); // ~45% enterrado
  const barkA = new THREE.Color('#4a3322'), barkB = new THREE.Color('#6a4a32'), wood = new THREE.Color('#bf9a68');
  const parts = [colorize(toNonIndexed(g), (c, x, y, z) => {
    if (Math.abs(x) > L / 2 - 0.02) c.copy(wood).lerp(new THREE.Color('#9a7848'), (Math.sin(Math.hypot(y - r * 0.55, z) * 40) * 0.5 + 0.5) * 0.6);
    else c.copy(barkA).lerp(barkB, (Math.sin(x * 9 + z * 20) * 0.5 + 0.5) * 0.6).lerp(new THREE.Color('#5a8a3a'), y > r * 1.2 ? 0.35 : 0); // musgo em cima
  })];
  const br = new THREE.CylinderGeometry(0.03, 0.07, 0.6, 5); br.translate(0, 0.3, 0); br.rotateZ(-0.6); br.translate(L * 0.15, r * 1.3, 0.05);
  parts.push(colorize(toNonIndexed(br), c => c.copy(barkB)));
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  return { geo, radius: r + 0.2, height: r * 1.6, collider: 'log', length: L };
}

/* ---------- Pedra arredondada e irregular (com musgo em cima) ---------- */
export function rockGeometry(seed, opts = {}) {
  const rng = rngOf(seed);
  const R = (opts.size || 1) * (0.6 + rng() * 0.7);
  const g = mergeVertices(new THREE.IcosahedronGeometry(R, 4)), p = g.attributes.position, v = new THREE.Vector3(); // vértices unidos = sombreado suave
  const sx = 1 + rng() * 0.6, sy = 0.45 + rng() * 0.35, sz = 0.8 + rng() * 0.5, ph = rng() * 10;
  // ruído suave em várias escalas + achatado embaixo (assenta no chão)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * 2.1 + ph) * Math.cos(v.z * 1.7 + ph) * 0.14 + Math.sin(v.x * 5.3 + v.y * 4.1 + ph * 2) * 0.05 + Math.sin(v.z * 9.1 - v.y * 7.3 + ph) * 0.02;
    v.multiplyScalar(R * (1 + n)); v.x *= sx; v.y *= sy; v.z *= sz;
    if (v.y < -R * sy * 0.35) v.y = -R * sy * 0.35 + (v.y + R * sy * 0.35) * 0.15;
    p.setXYZ(i, v.x, v.y + R * sy * 0.25, v.z);
  }
  g.computeVertexNormals();
  const N = g.attributes.normal;
  // S-259: pedra cinzenta (granito: manchas e pintas por ruído, sem as faixas listradas de antes); limo só leve, nos topos, e
  // nas pedras da neve nada de limo — neve assentada em cima
  const stone = new THREE.Color(opts.dark ? '#706e6a' : '#8e8c88'), stone2 = new THREE.Color(opts.dark ? '#57565a' : '#6f6e6c'), moss = new THREE.Color(opts.dark ? '#5d6650' : '#7a8566'), snow = new THREE.Color('#f2f6fa');
  const hn = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, L = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
    return L(L(L(hn(ix, iy, iz), hn(ix + 1, iy, iz), fx), L(hn(ix, iy + 1, iz), hn(ix + 1, iy + 1, iz), fx), fy), L(L(hn(ix, iy, iz + 1), hn(ix + 1, iy, iz + 1), fx), L(hn(ix, iy + 1, iz + 1), hn(ix + 1, iy + 1, iz + 1), fx), fy), fz); };
  colorize(g, (c, x, y, z) => {
    const n = vn(x * 2.2, y * 2.2, z * 2.2) * 0.65 + vn(x * 7, y * 7, z * 7) * 0.35;
    c.copy(stone).lerp(stone2, n).offsetHSL(0, 0, (hn(x, y, z) - 0.5) * 0.05);
  });
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i++) { const up = N.getY(i), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (opts.snow) { if (up > 0.62 && y > R * sy * 0.35) { /* só no alto da pedra: os lados ficam de pedra cinza */ const k = Math.min(1, (up - 0.62) * 3.5 + (vn(x * 3, y * 3, z * 3) - 0.5) * 0.8); if (k > 0) col.setXYZ(i, col.getX(i) + (snow.r - col.getX(i)) * k, col.getY(i) + (snow.g - col.getY(i)) * k, col.getZ(i) + (snow.b - col.getZ(i)) * k); } }
    else if (up > 0.6 && opts.moss !== false) { const k = Math.min(1, (up - 0.6) * 2) * 0.4 * Math.max(0, vn(x * 2.5, y * 2.5, z * 2.5) * 1.6 - 0.5); col.setXYZ(i, col.getX(i) + (moss.r - col.getX(i)) * k, col.getY(i) + (moss.g - col.getY(i)) * k, col.getZ(i) + (moss.b - col.getZ(i)) * k); } }
  return { geo: g, radius: R * Math.max(sx, sz) * 0.85, height: R * sy * 1.6 };
}

// gera variações prontas para clonar: { nome: { scene, radius } }
export function makeTreeTemplates() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: false });
  // auditoria: casca com sulcos verticais, placas e musgo (ruído no espaço do mundo, sem textura nem custo de geometria)
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vBW;
float bh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bh(i), bh(i + vec2(1,0)), f.x), mix(bh(i + vec2(0,1)), bh(i + vec2(1,1)), f.x), f.y); }`).replace('#include <color_fragment>', `#include <color_fragment>
{ float a = (vBW.x + vBW.z) * 9.0; float furrow = bn(vec2(a, vBW.y * 1.3)) * 0.6 + bn(vec2(a * 2.3, vBW.y * 3.0)) * 0.4;
  float plates = smoothstep(0.35, 0.65, furrow); diffuseColor.rgb *= 0.55 + plates * 0.6;
  float moss = smoothstep(0.62, 0.8, bn(vec2(a * 0.4, vBW.y * 0.6) + 5.0)) * smoothstep(2.5, 0.3, vBW.y - 0.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.36, 0.16), moss * 0.55); }`);
  };
  const out = {};
  // folhas: alphaTest (recorte sem ordenar transparência), dois lados, e material de profundidade com o mesmo recorte para a sombra ter o desenho das folhas
  const leafMats = {}, leafMat = kind => leafMats[kind] || (leafMats[kind] = (() => {
    const map = leafAtlas(kind === 'needleSnow' ? 'needle' : kind), m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.78, emissive: new THREE.Color(kind === 'leaf' ? '#0e1a06' : '#081208') });
    if (kind === 'needleSnow') { // S-158: neve assentada no lado de CIMA de cada ramo (pela inclinação real do cartão), em manchas — pontas e lado de baixo seguem verdes
      m.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW;\nfloat sh1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
          .replace('#include <color_fragment>', `#include <color_fragment>
          { vec3 fn = normalize(cross(dFdx(vSW), dFdy(vSW))); if (dot(fn, cameraPosition - vSW) < 0.0) fn = -fn;
            float patchy = 0.55 + 0.45 * sin(vSW.x * 2.7 + vSW.z * 3.1) * sin(vSW.y * 1.9 - vSW.x * 1.3);
            float snow = smoothstep(0.35, 0.75, fn.y) * smoothstep(0.4, 0.75, patchy);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0) * (0.92 + sh1(floor(vSW.xz * 8.0)) * 0.08), snow * 0.9); }`);
      };
      m.customProgramCacheKey = () => 'needleSnow';
    }
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });
    return { m, dm };
  })());
  // S-259: as pedras usavam o material da CASCA (sulcos verticais + musgo verde do shader) — daí as listras e o limo. Agora têm o seu:
  // granito em espaço do mundo (manchas, pintas claras/escuras e grão fino), sem musgo
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  rockMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRW;
float rh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float rn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rh(i), rh(i + vec3(1,0,0)), f.x), mix(rh(i + vec3(0,1,0)), rh(i + vec3(1,1,0)), f.x), f.y), mix(mix(rh(i + vec3(0,0,1)), rh(i + vec3(1,0,1)), f.x), mix(rh(i + vec3(0,1,1)), rh(i + vec3(1,1,1)), f.x), f.y), f.z); }`).replace('#include <color_fragment>', `#include <color_fragment>
{ float big = rn(vRW * 1.3) * 0.6 + rn(vRW * 3.7) * 0.4, grain = rn(vRW * 22.0);
  diffuseColor.rgb *= 0.82 + big * 0.3 + (grain - 0.5) * 0.08;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25, smoothstep(0.75, 0.95, rn(vRW * 14.0)) * 0.5); }`);
  };
  rockMat.customProgramCacheKey = () => 'aethraRock';
  const add = (name, { geo, radius, height, leaf, leafKind }) => {
    const m = new THREE.Mesh(geo, /^stone/.test(name) ? rockMat : mat); m.castShadow = true; m.receiveShadow = true;
    const scene = new THREE.Group(); scene.add(m);
    if (leaf) { const lm = leafMat(leafKind), l = new THREE.Mesh(leaf, lm.m); l.customDepthMaterial = lm.dm; l.castShadow = true; l.receiveShadow = true; scene.add(l); }
    out[name] = { scene, radius, height };
  };
  for (let i = 0; i < 5; i++) add('oak_' + i, oakGeometry(100 + i * 17));
  for (let i = 0; i < 3; i++) add('oakdark_' + i, oakGeometry(300 + i * 23, { dark: true }));
  for (let i = 0; i < 5; i++) add('pine_' + i, pineGeometry(500 + i * 31));
  for (let i = 0; i < 4; i++) add('pinedark_' + i, pineGeometry(700 + i * 29, { dark: true }));
  for (let i = 0; i < 4; i++) add('pinesnow_' + i, pineGeometry(800 + i * 37, { dark: i % 2 === 0, snow: true })); // S-158: pinheiros com neve (Vale da Geada)
  for (let i = 0; i < 3; i++) add('stump_' + i, stumpGeometry(900 + i * 13));
  for (let i = 0; i < 6; i++) add('stone_' + i, rockGeometry(1200 + i * 11, { size: i < 3 ? 0.8 : 1.3 }));
  for (let i = 0; i < 4; i++) add('stonedark_' + i, rockGeometry(1300 + i * 17, { size: 1.1, dark: true }));
  for (let i = 0; i < 4; i++) add('stonesnow_' + i, rockGeometry(1400 + i * 13, { size: i < 2 ? 0.9 : 1.3, snow: true, dark: true })); // S-259: pedras da neve, cobertas de neve, sem limo
  for (let i = 0; i < 2; i++) add('log_' + i, logGeometry(950 + i * 7));
  return out;
}
