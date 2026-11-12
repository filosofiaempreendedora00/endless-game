/* Qualidade gráfica (Esc → ⚙️ Configurações): cinco níveis, do "muito baixo" (computador fraco) ao "muito alto".
   É uma preferência DO APARELHO (não do personagem), por isso fica no localStorage — o mesmo save roda em
   computadores diferentes com qualidades diferentes. "Alto" é o visual de sempre do jogo. */
export const GFX_LEVELS = [
  { id: 'muito_baixo', name: 'Muito baixo', desc: 'Para computadores fracos: resolução reduzida, sem sombras, sem grama e sem vida ambiente.',
    pr: 0.7, shadows: 0, grass: 0, scenery: 0.45, fauna: false, far: 310, fogK: 0.7 },
  { id: 'baixo', name: 'Baixo', desc: 'Resolução um pouco menor, sombras simples, grama só bem perto.',
    pr: 0.9, shadows: 1024, grass: 60, scenery: 0.65, fauna: true, far: 460, fogK: 0.9 },
  { id: 'medio', name: 'Médio', desc: 'Equilíbrio entre beleza e leveza.',
    pr: 1.25, shadows: 1536, grass: 95, scenery: 0.82, fauna: true, far: 900, fogK: 1 },
  { id: 'alto', name: 'Alto', desc: 'O visual completo do jogo (padrão).',
    pr: 2, shadows: 2048, grass: 131, scenery: 1, fauna: true, far: 1700, fogK: 1 },
  { id: 'muito_alto', name: 'Muito alto', desc: 'Sombras mais nítidas, grama e cenário até mais longe. Pede um computador forte.',
    pr: 2, shadows: 4096, grass: 175, scenery: 1.4, fauna: true, far: 1700, fogK: 1 },
];
const KEY = 'aethra_gfx';
let cur = 'alto';
try { const v = localStorage.getItem(KEY); if (GFX_LEVELS.some(l => l.id === v)) cur = v; } catch (e) { }
export const gfxLevel = () => GFX_LEVELS.find(l => l.id === cur) || GFX_LEVELS[3];
export const gfxId = () => cur;

/* aplica o nível: C = { renderer, sun, scene, camera, sky, setGrassRange, onChange }
   far: até onde a câmera desenha (nos níveis baixos a névoa fica um pouco mais perto e esconde o corte; o céu encolhe junto) */
export function applyGfx(C, id = cur) {
  if (GFX_LEVELS.some(l => l.id === id)) cur = id;
  try { localStorage.setItem(KEY, cur); } catch (e) { }
  const L = gfxLevel(), r = C.renderer;
  r.setPixelRatio(Math.min(L.pr, Math.max(1, devicePixelRatio)));
  r.setSize(innerWidth, innerHeight);
  const wantShadow = L.shadows > 0;
  if (C.sun) {
    const changed = C.sun.castShadow !== wantShadow || (wantShadow && C.sun.shadow.mapSize.x !== L.shadows);
    C.sun.castShadow = wantShadow;
    if (wantShadow && C.sun.shadow.mapSize.x !== L.shadows) { C.sun.shadow.mapSize.set(L.shadows, L.shadows); if (C.sun.shadow.map) { C.sun.shadow.map.dispose(); C.sun.shadow.map = null; } }
    r.shadowMap.enabled = wantShadow;
    if (changed && C.scene) C.scene.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; }); // os materiais recompilam com/sem sombra
  }
  if (C.camera) { C.camera.far = L.far; C.camera.updateProjectionMatrix(); }
  if (C.sky) C.sky.scale.setScalar(Math.min(1, (L.far * 0.92) / 880));
  if (C.setGrassRange) C.setGrassRange(L.grass);
  if (C.onChange) C.onChange(L);
  return L;
}
