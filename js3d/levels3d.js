/* =========================================================================
   ANDARES E ESCADAS (S-281) — sistema reutilizável de pisos elevados
   Cada superfície é um retângulo girado (como os tablados do porto), com altura
   fixa (piso, mezanino, patamar) ou subindo de y0 até y1 ao longo do comprimento
   (escada/rampa). A diferença para os tablados: a altura do chão depende de ONDE
   o personagem está na vertical — embaixo do mezanino ele continua no térreo,
   em cima dele anda a 4 m. Só se "sobe" numa superfície que esteja no máximo
   STEP acima dos pés (degrau); o resto passa por cima da cabeça.

   addLevel({ x, z, yaw, w, len, y0, y1 })  → x,z = início (meio da borda de entrada),
       yaw = direção em que o comprimento cresce (0 = +z), w = largura, len = comprimento
   levelAt(x, z, y) → altura da superfície mais alta alcançável a partir de y (ou null)
   levelWall(colliders, x, z, hx, hz, rot, y0, y1) → colisão que só vale entre as alturas
       y0..y1 (guarda-corpo do mezanino, lateral da escada, vão sob os degraus)
   ========================================================================= */
export const LEVELS = [];
export const STEP = 0.45;

export function addLevel(L) { LEVELS.push({ y1: L.y0, ...L, cs: Math.cos(L.yaw || 0), sn: Math.sin(L.yaw || 0) }); return L; }

export function levelAt(x, z, y) {
  let best = null;
  for (const L of LEVELS) {
    const dx = x - L.x, dz = z - L.z, lx = dx * L.cs - dz * L.sn, lz = dx * L.sn + dz * L.cs;
    if (Math.abs(lx) > L.w / 2 || lz < 0 || lz > L.len) continue;
    const h = L.y0 + (L.y1 - L.y0) * (lz / L.len);
    if (h <= y + STEP && (best === null || h > best)) best = h;
  }
  return best;
}

// colisão com faixa de altura (resolve() em main3d ignora quando os pés estão fora de y0..y1)
export function levelWall(colliders, x, z, hx, hz, rot = 0, y0 = -1, y1 = 99, name = 'andar') {
  colliders.push({ x, z, r: Math.max(hx, hz), box: true, hx, hz, rot, y0, y1, name });
}
