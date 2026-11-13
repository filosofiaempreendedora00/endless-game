/* =========================================================================
   CHAMA DE VERDADE (S-393; antes S-182/S-190): uma "folha" sempre virada para a câmera (só em volta do eixo vertical, a chama
   continua em pé) pintada por um shader de fogo: turbulência que sobe, línguas que se soltam no alto e somem, núcleo
   branco-amarelado embaixo e bordas laranja-avermelhadas, tudo aditivo e sem contornos. A versão antiga empilhava "gotas" com o
   mesmo contorno e, à noite, parecia um adesivo de anéis marrons.
   realFlame(size, seed, embers) → Group com userData.update(t); size = altura da chama em metros.
   Usada no castelo, na masmorra, nas tavernas, nas fogueiras e forjas das cidades (cities3d.flame) e nos marcos.
   ========================================================================= */
import * as THREE from 'three';

const FIRE_T = { value: 0 };
let _mat = null;
function fireMat() {
  if (_mat) return _mat;
  _mat = new THREE.ShaderMaterial({
    uniforms: { uT: FIRE_T, uSeed: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uT; uniform float uSeed; varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * n(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
      void main() {
        float y = vUv.y, x = vUv.x * 2.0 - 1.0, t = uT * 1.0 + uSeed * 7.3;
        // turbulência subindo (a chama "corre" para cima) e balanço do conjunto
        float tur = fbm(vec2(x * 2.2 + uSeed, y * 3.2 - t * 2.6));
        float sway = (fbm(vec2(uSeed, t * 0.9)) - 0.5) * 0.35 * y;
        float xx = x + sway + (tur - 0.5) * 0.55 * y;
        // largura: base redonda, afinando até a ponta
        float w = mix(0.62, 0.06, pow(y, 0.8)) * (1.0 - smoothstep(0.0, 0.08, 0.08 - y) * 0.3);
        float body = 1.0 - smoothstep(w * 0.55, w, abs(xx));
        // altura viva: a ponta sobe e desce com a turbulência; línguas soltas no alto
        float top = 0.72 + (tur - 0.5) * 0.45;
        float vert = 1.0 - smoothstep(top - 0.25, top + 0.05, y);
        float tongue = smoothstep(0.62, 0.8, fbm(vec2(x * 3.0 + 3.0, y * 4.0 - t * 3.4))) * smoothstep(0.35, 0.6, y) * (1.0 - smoothstep(0.85, 1.0, y)) * (1.0 - smoothstep(0.1, 0.55, abs(xx)));
        float base = smoothstep(0.0, 0.07, y);
        float I = clamp(body * vert * base + tongue * 0.75, 0.0, 1.0);
        I *= 0.8 + 0.2 * fbm(vec2(x * 6.0, y * 6.0 - t * 5.0));
        // cor: núcleo quase branco embaixo no meio, amarelo, laranja, vermelho nas bordas e na ponta
        float core = I * (1.0 - smoothstep(0.0, 0.55, y)) * (1.0 - smoothstep(0.0, w * 0.6, abs(xx)));
        vec3 col = mix(vec3(0.85, 0.18, 0.03), vec3(1.0, 0.55, 0.12), smoothstep(0.15, 0.6, I));
        col = mix(col, vec3(1.0, 0.86, 0.45), smoothstep(0.55, 0.9, I));
        col = mix(col, vec3(1.0, 0.97, 0.85), smoothstep(0.35, 0.8, core));
        float a = I * (1.0 - smoothstep(0.75, 1.0, y) * 0.6);
        gl_FragColor = vec4(col * a * 1.25, a);
      }`,
  });
  return _mat;
}
let _emberTex = null, _emberM = null;
function emberTex() { if (_emberTex) return _emberTex; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.3, 'rgba(255,150,40,0.8)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); _emberTex = new THREE.CanvasTexture(c); return _emberTex; }
const _wp = new THREE.Vector3(), _pq = new THREE.Quaternion(), _e = new THREE.Euler();
const PLANE = (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; })();

export function realFlame(size = 0.5, seed = 0, embers = true) {
  const g = new THREE.Group(), mat = fireMat(), sd = (seed * 0.731) % 10;
  // duas folhas levemente defasadas (a de trás um pouco maior e mais lenta) dão volume sem parecer um adesivo
  const sheets = [[1.0, 0.62, 0], [0.82, 0.5, 3.1]].map(([h, w, off]) => {
    const m = new THREE.Mesh(PLANE, mat); m.scale.set(size * w * 1.05, size * h * 1.18, 1); m.renderOrder = 20; m.frustumCulled = true;
    m.onBeforeRender = (r, sc, cam) => { // vira para a câmera só em volta do eixo vertical (a chama continua em pé)
      mat.uniforms.uSeed.value = sd + off; mat.uniformsNeedUpdate = true; // o material é o mesmo para todas: força mandar a semente desta chama
      m.parent.getWorldQuaternion(_pq); _e.setFromQuaternion(_pq, 'YXZ'); m.getWorldPosition(_wp);
      m.rotation.set(0, Math.atan2(cam.position.x - _wp.x, cam.position.z - _wp.z) - _e.y, 0); m.updateMatrixWorld(); };
    g.add(m); return m; });
  const emb = [];
  if (embers) { _emberM = _emberM || new THREE.SpriteMaterial({ map: emberTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let k = 0; k < 6; k++) { const e = new THREE.Sprite(_emberM); e.scale.setScalar(0.035 * Math.max(0.6, size)); g.add(e); emb.push({ e, off: k / 6 + seed * 0.13, dx: Math.sin(k * 2.4 + seed) * 0.12, dz: Math.cos(k * 1.9 + seed) * 0.12 }); } }
  g.userData.update = t => {
    FIRE_T.value = t;
    const f = 1 + Math.sin(t * 9 + seed) * 0.05 + Math.sin(t * 17.3 + seed * 2) * 0.04; sheets[0].scale.y = size * 1.18 * f; sheets[1].scale.y = size * 0.82 * 1.18 * (2 - f);
    for (const b of emb) { const k = (t * 0.55 + b.off) % 1; b.e.position.set(b.dx * size * (1 + k) + Math.sin(t * 4 + b.off * 9) * 0.05 * size, k * size * 2.2, b.dz * size * (1 + k)); b.e.scale.setScalar(0.04 * Math.max(0.6, size) * (1 - k)); }
  };
  return g;
}
