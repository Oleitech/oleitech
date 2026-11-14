/* Oleitech v2 — fita 3D de cartões.
   Código próprio, escrito a partir das constantes da receita de estilo (specs/).
   three.js (MIT) vendorizado em js/vendor/. */
/* caminho relativo: sem depender de importmap (Safari < 16.4 não o suporta) */
import * as THREE from './vendor/three.module.min.js';

const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, a, b) => a + ((((v - a) % (b - a)) + (b - a)) % (b - a));
const easeOut3 = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ constantes */
export const CFG = {
  layout: { ratio: 16 / 9, ratioPortrait: 0.75, width: 3.8, widthPortrait: 3.0, gap: 0.08, segX: 96, segY: 28, radius: 0.03 },
  camera: { fov: 40, fitWidth: 0.8, fitWidthPortrait: 0.86 },
  placementY: 0.1,
  scroll: { dragTau: 0.42, wheelTau: 0.22, wheelScale: 0.0055, maxSpeed: 22 },
  flow: { asymmetry: 0.6, tau: 0.11, bow: 0.16, blur: 0.69, blurOpen: 0.55 },
  hover: { depth: 0.235, radius: 0.18, drive: 1.25, tap: 5, tapSize: 0.63, edges: 0.9 },
  open: { lift: 0.44, frequency: 1.5, falloff: 0.55, glideSpeed: 3, tauGlide: 0.06, tauOpen: 0.075, tauFlatten: 0.105, margin: 0.07, lag: 0.1 },
  intro: { delay: 0.1, travelX: 0.09, travelZ: -0.9, travelDur: 1.8, spinCards: 6, spinDur: 2.2, shapeDur: 2.2 },
  bg: {
    pts: [[0.078, 0.078, 0.078, -0.5, 0.5], [0.173, 0.173, 0.173, 0.328, -0.245], [0.196, 0.196, 0.196, -0.123, 0.196],
      [0.133, 0.133, 0.133, -0.359, -0.123], [0.161, 0.161, 0.161, 0.439, 0.446], [0.114, 0.114, 0.114, 0.109, 0.356],
      [0.078, 0.078, 0.078, -0.349, -0.335], [0.145, 0.145, 0.145, 0.398, -0.425]],
    warp: 0.27, warpScale: 3.95, darken: 0.3,
  },
};

/* forma da fita: [yawL a,s,e, yawR, pitchL, pitchR, twistL, twistR] */
/* SHAPE_LAND parte dos valores da receita; sinais/fins ajustados por ajuste ao idle-1440.png (as convenções de eixo
   da nossa integração diferem das do original, ver relatório). Receita: yaw -81/-360, pitch 231/-247, twist 63/189. */
const SHAPE_LAND = [32.4, .1, 2.0, -360, .1, 15.5, -346.5, 1.05, 72.25, -98.8, 1.05, 9.08, -94.5, .1, 4.42, 189, .1, 6.8];
const SHAPE_WIDE = [32.4, .1, 2.0, -360, .1, 15.5, 0, 1.05, 72.25, 0, 1.05, 9.08, 0, .1, 4.42, 0, .1, 6.8];
/* retrato: ajustado contra as capturas de referência a 390/375/414:
   cartão central quase plano; os vizinhos dobram logo a seguir à junta e só se vê uma tira de cada lado. */
const SHAPE_PORT = [80, 1.5, 3.6, -95, 1.5, 3.4, 8, 1.6, 4, -8, 1.6, 4, 0, .1, 4, 0, .1, 4];
/* inclinação do grupo em retrato (lado esquerdo mais perto), desfaz-se ao abrir um cartão */
const TILT_PORT = { y: 0, z: 3.9 * DEG }; /* original: orientation.z 3.9° em retrato */
const SHAPE_INTRO = [-220, .1, 14.55, 48, .1, 36.1, -115, .31, 19, 88, 0, 17.75, -8, .1, 3.4, 360, .1, 21.9];
const mixShape = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
/* retrato: formas do original para 393/852 (Y) e 1:1 (B), em unidades do cartão de retrato deles (layout.scale 1.391 de largura);
   escaladas para o nosso cartão. A curva só existe até PORT_STRAIGHT do centro: dobra dentro do cartão central,
   por isso a velocidade (fL/fR) deforma o próprio cartão central, como no original. */
const PORT_K = 3.0 / 1.391, PORT_STRAIGHT = 1.511 * PORT_K;
const PV = -1; /* a nossa integração roda o lado esquerdo no sentido oposto ao do original: ângulos da esquerda trocam de sinal */
const sc = (a) => a.map((v, i) => (i % 3 === 0 ? v * (i < 3 || (i >= 6 && i < 9) || (i >= 12 && i < 15) ? PV : 1) : v * PORT_K));
const SHAPE_PORT_Y = sc([-287.5, 0, 5.689, -360, 0, 5.206, 258, .397, 10.919, -247, .397, 8.577, -277.5, .228, 21.935, 298.5, 0, 12.419]);
const SHAPE_PORT_B = sc([-287.5, 0, 5.689, -360, 0, 10.56, 72, .397, 10.919, -80, .397, 8.577, 67.5, .228, 21.935, 104.5, 0, 12.419]);
function shapeForAspect(a) {
  if (a < 1) return mixShape(SHAPE_PORT_Y, SHAPE_PORT_B, clamp((a - 393 / 852) / (1 - 393 / 852), 0, 1));
  if (a >= 2.88) return SHAPE_WIDE;
  if (a >= 1.6) return SHAPE_LAND;
  return mixShape(SHAPE_PORT, SHAPE_LAND, clamp((a - 0.461) / (1.6 - 0.461), 0, 1));
}

/* ------------------------------------------------------------------ bake da fita */
const CURVE_N = 1025;
function rot(v, k, c, s) {
  const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cx = k[1] * v[2] - k[2] * v[1], cy = k[2] * v[0] - k[0] * v[2], cz = k[0] * v[1] - k[1] * v[0];
  const f = d * (1 - c);
  v[0] = v[0] * c + cx * s + k[0] * f; v[1] = v[1] * c + cy * s + k[1] * f; v[2] = v[2] * c + cz * s + k[2] * f;
}
function rate(sh, i, s, factor) {
  const angle = sh[i] * factor, start0 = sh[i + 1], end0 = sh[i + 2];
  const start = Math.max(start0, Math.max(start0, 0.1));
  const end = Math.max(end0, start + 0.15);
  const bl = Math.min(Math.max(start0, 0.1), (end - start) / 2);
  const win = smooth(start - bl, start + bl, s) * (1 - smooth(end - bl, end + bl, s));
  return (angle * DEG / (end - start)) * win;
}
function bake(sh, fL, fR, H, out, straightLen) {
  const ds = H / 512;
  const put = (idx, P, U, N) => {
    const o = idx * 4; out[o] = P[0]; out[o + 1] = P[1]; out[o + 2] = P[2];
    const o1 = (CURVE_N + idx) * 4; out[o1] = U[0]; out[o1 + 1] = U[1]; out[o1 + 2] = U[2];
    const o2 = (2 * CURVE_N + idx) * 4; out[o2] = N[0]; out[o2 + 1] = N[1]; out[o2 + 2] = N[2];
  };
  put(512, [0, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (const dir of [1, -1]) {
    const P = [0, 0, 0], T = [1, 0, 0], U = [0, 1, 0], N = [0, 0, 1];
    const off = dir > 0 ? 3 : 0; const fy = dir > 0 ? fR : fL;
    for (let k = 1; k <= 512; k++) {
      const s = (k - 0.5) * ds;
      let yaw = 0, pitch = 0, twist = 0;
      if (s <= straightLen) {
        yaw = rate(sh, 0 + off, s, fy);
        pitch = rate(sh, 6 + off, s, 1);
        twist = rate(sh, 12 + off, s, 1);
      }
      const w = [T[0] * twist + U[0] * yaw + N[0] * pitch, T[1] * twist + U[1] * yaw + N[1] * pitch, T[2] * twist + U[2] * yaw + N[2] * pitch];
      const m = Math.hypot(w[0], w[1], w[2]);
      const half = m * ds * 0.5;
      if (m > 1e-9) {
        const kx = [w[0] / m, w[1] / m, w[2] / m], c = Math.cos(half), sn = Math.sin(half);
        rot(T, kx, c, sn); rot(U, kx, c, sn); rot(N, kx, c, sn);
        P[0] += dir * T[0] * ds; P[1] += dir * T[1] * ds; P[2] += dir * T[2] * ds;
        rot(T, kx, c, sn); rot(U, kx, c, sn); rot(N, kx, c, sn);
      } else { P[0] += dir * T[0] * ds; P[1] += dir * T[1] * ds; P[2] += dir * T[2] * ds; }
      put(512 + dir * k, P, U, N);
    }
  }
}

/* ------------------------------------------------------------------ shaders */
const VERT = /* glsl */`
uniform sampler2D uCurve; uniform highp sampler2D uWave;
uniform float uH, uSlotX, uBow, uFlat, uLift, uWaveAmp;
uniform vec2 uHalf, uFlatS, uTap, uWaveSize; uniform vec3 uFlatC;
varying vec2 vUv; varying vec3 vN, vU, vT, vW;
vec4 cv(int row, float s){
  float f = clamp((s + uH) / (2.0 * uH), 0.0, 1.0) * 1024.0;
  int i0 = int(floor(f)); int i1 = min(i0 + 1, 1024); float t = f - float(i0);
  return mix(texelFetch(uCurve, ivec2(i0, row), 0), texelFetch(uCurve, ivec2(i1, row), 0), t);
}
float wv(vec2 uv){
  vec2 g = uv * uWaveSize - 0.5; vec2 i = floor(g); vec2 f = fract(g); f = f * f * (3.0 - 2.0 * f);
  ivec2 mx = ivec2(uWaveSize) - 1; ivec2 a = clamp(ivec2(i), ivec2(0), mx); ivec2 b = clamp(ivec2(i) + 1, ivec2(0), mx);
  return mix(mix(texelFetch(uWave, a, 0).r, texelFetch(uWave, ivec2(b.x, a.y), 0).r, f.x),
             mix(texelFetch(uWave, ivec2(a.x, b.y), 0).r, texelFetch(uWave, b, 0).r, f.x), f.y);
}
void main(){
  float s = uSlotX + position.x;
  vec3 P = cv(0, s).xyz; vec3 U = cv(1, s).xyz; vec3 N = cv(2, s).xyz;
  float yn = position.y / uHalf.y;
  float h = wv(uv) * uWaveAmp;
  vec3 curved = P + U * position.y + N * (uBow * (1.0 - yn * yn) + h);
  vec3 flatp = vec3(uFlatC.x + position.x * uFlatS.x, uFlatC.y + position.y * uFlatS.y, uFlatC.z + h);
  vec3 w = mix(curved, flatp, uFlat);
  float d = length((uv - uTap) * 2.0 * uHalf) / uHalf.y;
  w.z += uLift * 0.3 * exp(-d * ${CFG.open.falloff.toFixed(2)}) * cos(d * ${(CFG.open.frequency * 2.2).toFixed(2)});
  vec3 n = normalize(mix(N, vec3(0.0, 0.0, 1.0), uFlat));
  vU = normalize(mix(U, vec3(0.0, 1.0, 0.0), uFlat)); vN = n; vT = normalize(cross(vU, n));
  vUv = uv;
  vec4 wp = modelMatrix * vec4(w, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform sampler2D uTex; uniform highp sampler2D uWave;
uniform float uSheet, uRadius, uWaveAmp, uExposure;
uniform vec2 uHalf, uWaveSize;
varying vec2 vUv; varying vec3 vN, vU, vT, vW;
float wv(vec2 uv){
  vec2 g = uv * uWaveSize - 0.5; vec2 i = floor(g); vec2 f = fract(g); f = f * f * (3.0 - 2.0 * f);
  ivec2 mx = ivec2(uWaveSize) - 1; ivec2 a = clamp(ivec2(i), ivec2(0), mx); ivec2 b = clamp(ivec2(i) + 1, ivec2(0), mx);
  return mix(mix(texelFetch(uWave, a, 0).r, texelFetch(uWave, ivec2(b.x, a.y), 0).r, f.x),
             mix(texelFetch(uWave, ivec2(a.x, b.y), 0).r, texelFetch(uWave, b, 0).r, f.x), f.y);
}
float envL(vec3 r){
  float top = smoothstep(0.15, 0.95, r.y);
  float win = smoothstep(0.55, 0.92, abs(sin(r.x * 2.6 + 1.1))) * smoothstep(-0.35, 0.45, r.y) * 0.5;
  float flo = smoothstep(0.1, -0.8, r.y) * 0.12;
  return 0.2 + top * 0.95 + win + flo + 0.25 * smoothstep(0.4, 1.0, r.z);
}
void main(){
  vec2 p = (vUv - 0.5) * 2.0 * uHalf; vec2 q = abs(p) - uHalf + uRadius;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float aa = max(fwidth(d), 1e-5); float alpha = clamp(0.5 - d / aa, 0.0, 1.0);
  if (alpha < 0.004) discard;
  vec3 n = normalize(vN);
  vec2 e = 1.0 / uWaveSize;
  float gx = (wv(vUv + vec2(e.x, 0.0)) - wv(vUv - vec2(e.x, 0.0))) / (2.0 * e.x * 2.0 * uHalf.x);
  float gy = (wv(vUv + vec2(0.0, e.y)) - wv(vUv - vec2(0.0, e.y))) / (2.0 * e.y * 2.0 * uHalf.y);
  n = normalize(n - (vT * gx + vU * gy) * uWaveAmp);
  bool ff = gl_FrontFacing; if (!ff) n = -n;
  vec3 V = normalize(cameraPosition - vW);
  vec3 r = reflect(-V, n);
  float en = envL(r);
  vec3 paper = vec3(0.965, 0.965, 0.972);
  vec3 base = ff ? mix(texture2D(uTex, vUv).rgb, paper, uSheet) : paper;
  float fres = pow(1.0 - abs(dot(n, V)), 3.0);
  vec3 col = base * (0.80 + 0.5 * (en - 0.4)) + (fres * 0.10 + 0.03) * en;
  col *= uExposure;
  gl_FragColor = vec4(col, alpha);
}`;

const BG_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const BG_FRAG = /* glsl */`
uniform vec2 uAspect; uniform vec3 uPts[8]; uniform vec2 uPos[8];
uniform float uWarp, uWarpScale, uDarken;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.02; a *= 0.5; } return s; }
void main(){
  vec2 p = (vUv - 0.5) * uAspect;
  p += uWarp * (vec2(fbm(p * uWarpScale * 0.25), fbm(p * uWarpScale * 0.25 + 7.3)) - 0.5);
  float wsum = 0.0; float acc = 0.0;
  for (int i = 0; i < 8; i++){ float d = distance(p, uPos[i] * 1.2); float w = 1.0 / (d * d + 0.235); acc += w * uPts[i].x; wsum += w; }
  float g = acc / wsum * uDarken;
  gl_FragColor = vec4(vec3(g), 1.0);
}`;

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = /* glsl */`
uniform sampler2D tMap; uniform vec2 uDir; uniform float uAmt; uniform vec2 uRes; uniform float uGrain;
varying vec2 vUv;
float hh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c;
  if (uAmt < 0.0015) c = texture2D(tMap, vUv).rgb;
  else {
    float j = hh(gl_FragCoord.xy) - 0.5; c = vec3(0.0);
    for (int i = 0; i < 16; i++){ float t = (float(i) + j) / 15.0 - 0.5; c += texture2D(tMap, vUv + uDir * t).rgb; }
    c /= 16.0;
  }
  float n = hh(floor(gl_FragCoord.xy / 1.3) + 17.0);
  float lum = dot(c, vec3(0.333));
  c += (n - 0.5) * uGrain * (0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.5, lum)));
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/* ------------------------------------------------------------------ simulação de ondas (CPU) */
class WaveSim {
  constructor(gw, gh) {
    this.gw = gw; this.gh = gh;
    this.h = new Float32Array(gw * gh); this.p = new Float32Array(gw * gh); this.n = new Float32Array(gw * gh);
    this.data = new Float32Array(gw * gh);
    this.tex = new THREE.DataTexture(this.data, gw, gh, THREE.RedFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.needsUpdate = true;
    this.energy = 0; this.acc = 0; this.slot = -1; this.last = 0;
  }
  reset(slot) { this.h.fill(0); this.p.fill(0); this.data.fill(0); this.slot = slot; this.energy = 0; this.tex.needsUpdate = true; }
  bump(u, v, rad, amp) {
    const { gw, gh, h } = this; const cx = u * gw - 0.5, cy = v * gh - 0.5; const rc = rad * gh / 2;
    const x0 = Math.max(0, Math.floor(cx - rc * 2.5)), x1 = Math.min(gw - 1, Math.ceil(cx + rc * 2.5));
    const y0 = Math.max(0, Math.floor(cy - rc * 2.5)), y1 = Math.min(gh - 1, Math.ceil(cy + rc * 2.5));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (rc * rc);
      h[y * gw + x] += amp * Math.exp(-d2 * 1.4);
    }
  }
  step() {
    const { gw, gh } = this; let { h, p, n } = this; const k = 0.24, damp = 0.976; let e = 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, c = h[i];
      const l = x > 0 ? h[i - 1] : 0, r = x < gw - 1 ? h[i + 1] : 0, d = y > 0 ? h[i - gw] : 0, u = y < gh - 1 ? h[i + gw] : 0;
      let v = (2 * c - p[i] + k * (l + r + d + u - 4 * c)) * damp;
      if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) v *= CFG.hover.edges;
      n[i] = v; e += v * v;
    }
    this.p = h; this.h = n; this.n = p; this.energy = e;
  }
  upload() { this.data.set(this.h); this.tex.needsUpdate = true; }
}

/* ------------------------------------------------------------------ Ribbon */
export class Ribbon {
  /**
   * @param {object} o { canvas, images:[HTMLImageElement], captions:[string], reduced:boolean,
   *   onCenter(i), onOpen(i, rect), onSettled(i), onClose(), onInteract() }
   */
  constructor(o) {
    this.o = o; this.canvas = o.canvas; this.N = o.images.length;
    this.reduced = !!o.reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!this.renderer.capabilities.isWebGL2) throw new Error('WebGL2 indisponivel');
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CFG.camera.fov, 1, 0.1, 100);
    this.group = new THREE.Group(); this.scene.add(this.group); this.gs = 0.9; this.placeY = CFG.placementY; this.group.scale.setScalar(this.gs);

    this.H = 9; this.curveData = new Float32Array(CURVE_N * 3 * 4);
    this.curveTex = new THREE.DataTexture(this.curveData, CURVE_N, 3, THREE.RGBAFormat, THREE.FloatType);
    this.curveTex.minFilter = this.curveTex.magFilter = THREE.NearestFilter;

    // estado
    this.scroll = 0; this.velocity = 0; this.residual = 0; this.lastTotal = 0; this.measured = 0;
    this.flowSpeed = 0; this.fL = 1; this.fR = 1; this.bakedKey = '';
    this.introT = -1; this.introDone = this.reduced; this.introScroll = 0; this.introE1 = 1; this.introE2 = 1;
    this.openSlot = -1; this.openAmt = { x: 0, v: 0 }; this.glide = null; this.closeAt = 0;
    this.tapUV = [0.5, 0.5]; this.hover = null; this.sims = []; this.simFree = [];
    this.drag = null; this.centerIdx = -1; this.frames = 3; this.pointer = { x: -1, y: -1, t: 0, sp: 0 };
    this.zeroTex = new THREE.DataTexture(new Float32Array(4), 2, 2, THREE.RedFormat, THREE.FloatType); this.zeroTex.needsUpdate = true;

    this._bgMat(); this._post(); this._layout(true); this._events();
    this.clock = performance.now(); this.running = true;
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }

  /* ---------------------------------------------------------------- setup */
  get portrait() { return this.vw < this.vh; }
  _bgMat() {
    const c = CFG.bg.pts;
    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        uAspect: { value: new THREE.Vector2(1, 1) }, uPts: { value: c.map((p) => new THREE.Vector3(p[0], p[1], p[2])) },
        uPos: { value: c.map((p) => new THREE.Vector2(p[3], p[4])) }, uWarp: { value: CFG.bg.warp }, uWarpScale: { value: CFG.bg.warpScale }, uDarken: { value: CFG.bg.darken },
      },
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat); m.frustumCulled = false; m.renderOrder = -10; this.scene.add(m);
  }
  _post() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.UnsignedByteType, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.postMat = new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tMap: { value: this.rt.texture }, uDir: { value: new THREE.Vector2() }, uAmt: { value: 0 }, uRes: { value: new THREE.Vector2() }, uGrain: { value: 0.1 } },
    });
    this.postScene = new THREE.Scene(); this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat); q.frustumCulled = false; this.postScene.add(q);
  }

  /** (re)constrói geometria, texturas e slots; chamado no arranque e quando a orientação muda */
  _layout(first) {
    const portrait = window.innerWidth < window.innerHeight;
    if (!first && portrait === this._portrait) return;
    this._portrait = portrait;
    const L = CFG.layout;
    this.cw = portrait ? L.widthPortrait : L.width;
    this.ch = portrait ? L.widthPortrait / L.ratioPortrait : L.width / L.ratio;
    this.pitch = this.cw + L.gap;
    const span = Math.ceil((2 * this.H) / this.pitch) + 2;
    this.slots = Math.min(40, Math.ceil(span / this.N) * this.N);
    // limpa
    if (this.meshes) { this.meshes.forEach((m) => { this.group.remove(m); m.material.dispose(); }); this.geo.dispose(); this.texs.forEach((t) => t.dispose()); }
    this.geo = new THREE.PlaneGeometry(this.cw, this.ch, L.segX, L.segY);
    this.texs = this.o.images.map((img, i) => this._cardTexture(img, this.o.captions[i]));
    this.shared = { uCurve: { value: this.curveTex }, uH: { value: this.H }, uBow: { value: 0 }, uExposure: { value: 1.05 } };
    this.meshes = [];
    for (let i = 0; i < this.slots; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
        uniforms: {
          uCurve: this.shared.uCurve, uH: this.shared.uH, uBow: this.shared.uBow, uExposure: this.shared.uExposure,
          uTex: { value: this.texs[i % this.N] }, uWave: { value: this.zeroTex }, uWaveSize: { value: new THREE.Vector2(2, 2) },
          uSlotX: { value: 0 }, uFlat: { value: 0 }, uLift: { value: 0 }, uSheet: { value: 0 }, uWaveAmp: { value: 0 },
          uHalf: { value: new THREE.Vector2(this.cw / 2, this.ch / 2) }, uRadius: { value: L.radius },
          uFlatS: { value: new THREE.Vector2(1, 1) }, uFlatC: { value: new THREE.Vector3() }, uTap: { value: new THREE.Vector2(0.5, 0.5) },
        },
      });
      const m = new THREE.Mesh(this.geo, mat); m.frustumCulled = false; this.group.add(m); this.meshes.push(m);
    }
    this.flat = Array.from({ length: this.slots }, () => ({ x: 0, v: 0 }));
    this.slotX = new Float32Array(this.slots);
    this.sims.forEach((s) => this.simFree.push(s)); this.sims = [];
    this.simPool = []; // as WaveSim têm tamanho dependente do cartão
    this._resize(true);
  }

  _cardTexture(img, caption) {
    const port = this.portrait;
    /* texturas à medida do ecrã: no telemóvel o cartão tem ~350 px CSS (x DPR 2 = 700), 768x1024 chega e poupa memória no iOS */
    const big = Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2) > 2200;
    const W = port ? 768 : big ? 1792 : 1280, Hh = port ? 1024 : big ? 1008 : 720;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const g = c.getContext('2d');
    g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, W, Hh);
    const iw = img.naturalWidth || 1600, ih = img.naturalHeight || 1066;
    const s = Math.max(W / iw, Hh / ih), dw = iw * s, dh = ih * s;
    g.drawImage(img, (W - dw) / 2, (Hh - dh) / 2, dw, dh);
    // legenda
    const fs = Math.round(Hh * 0.085), mx = Math.round(W * (port ? 0.08 : 0.07)), by = Math.round(Hh * 0.07);
    g.font = `600 ${fs}px "League Spartan", sans-serif`; g.textBaseline = 'alphabetic';
    let txt = caption; let tw = g.measureText(txt).width;
    let size = fs; while (tw > W - mx * 2 && size > 20) { size -= 2; g.font = `600 ${size}px "League Spartan", sans-serif`; tw = g.measureText(txt).width; }
    const rx = mx, ry = Hh - by;
    let lum = 0.5;
    try { const d = g.getImageData(rx, ry - size, Math.min(W - rx, Math.ceil(tw)), size).data; let sum = 0, cnt = 0; for (let i = 0; i < d.length; i += 16) { sum += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255; cnt++; } lum = sum / cnt; } catch (e) { /* tainted */ }
    g.fillStyle = lum > 0.52 ? '#141414' : '#ffffff';
    g.fillText(txt, rx, ry);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.NoColorSpace;
    return t;
  }

  _resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!force && w === this.vw && h === this.vh) return;
    this.vw = w; this.vh = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(8294400 / (w * h)), 2); // DPR máx. 2: a 3 o iPhone pinta 2,25x os píxeis sem ganho visível
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.rt.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
    this.postMat.uniforms.uRes.value.set(w * dpr, h * dpr);
    const asp = w / h; this.camera.aspect = asp;
    { const t = clamp((asp - 0.461) / (1.6 - 0.461), 0, 1); this.gs = lerp(0.935, 0.9, t); /* retrato: cartão do tamanho do original a 390 */ this.placeY = lerp(0.2, CFG.placementY, t);
      this.portT = 1 - smooth(0.75, 1.1, asp); /* 1 = telemóvel ao alto, 0 = paisagem */ }
    const fit = this.portrait ? CFG.camera.fitWidthPortrait : CFG.camera.fitWidth;
    /* em retrato o cartão também não passa de ~54% da altura (tablet ao alto: cartão a meio ecrã, como na referência a 768) */
    const visW = this.portrait ? Math.max(this.cw / fit, (this.ch / 0.54) * asp) : this.cw / fit; const visH = visW / asp;
    this.camera.position.set(0, 0, visH / (2 * Math.tan(CFG.camera.fov * DEG / 2)));
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.wpp = visW / w; this.visW = visW; this.visH = visH; this.lpp = this.wpp / this.gs;
    this.bgMat.uniforms.uAspect.value.set(asp, 1);
    // moldura do cartão aberto (px)
    let fw, fh;
    if (this.portrait) { fw = w * 0.88; fh = Math.min(h * 0.74, fw / 0.5); }
    else { fh = h * 0.83; fw = Math.min(w * 0.92, fh * CFG.layout.ratio * 1.0); if (fw / fh < CFG.layout.ratio && fw < w * 0.92) fh = fw / CFG.layout.ratio; }
    const cy = h * (this.portrait ? 0.5 : 0.545);
    this.frame = { left: (w - fw) / 2, top: cy - fh / 2, width: fw, height: fh, radius: (CFG.layout.radius / this.ch) * fh };
    const fwW = fw * this.lpp, fhW = fh * this.lpp;
    this.flatS = [fwW / this.cw, fhW / this.ch];
    this.flatC = [0, ((h / 2 - cy) * this.wpp - this.placeY) / this.gs, 0];
    this.pitchOpen = Math.max(2 * (fwW / 2 + 0.02 * (visW / 2) / this.gs), (visW / 2) / this.gs + fwW / 2 + this.cw / 2); /* vizinhos saem do ecrã ao abrir */
    this.shapeBase = shapeForAspect(asp);
    /* em retrato a entrada parte de uma forma mais calma: a fita gira de lado, sem cartões a vir à câmara */
    this.shapeIntro = mixShape(this.shapeBase, SHAPE_INTRO, lerp(1, 0.12, this.portT));
    this.bakedKey = ''; this.frames = Math.max(this.frames, 4);
    if (this.openSlot >= 0 && this.o.onFrame) this.o.onFrame(this.frame);
  }

  /* ---------------------------------------------------------------- entrada */
  _events() {
    const c = this.canvas;
    this._onResize = () => { this._resize(false); this._layout(false); };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); return; }
      if (this.openSlot >= 0 || this.o.locked?.()) return;
      if (e.target.closest && e.target.closest('.menu, .sheet')) return;
      e.preventDefault(); this.o.onInteract?.();
      let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      d *= e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.vh : 1;
      this.velocity = 0; const lim = CFG.scroll.maxSpeed * CFG.scroll.wheelTau * 4;
      this.residual = clamp(this.residual + d * CFG.scroll.wheelScale, -lim, lim); this.frames = 6;
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (e.key === 'Escape' && this.openSlot >= 0) { this.close(); }
      else if (this.openSlot >= 0 && e.key === 'ArrowRight') this.step(1);
      else if (this.openSlot >= 0 && e.key === 'ArrowLeft') this.step(-1);
      else if (this.openSlot < 0 && !this.o.locked?.() && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        this.o.onInteract?.(); this.residual += (e.key === 'ArrowDown' ? 1 : -1) * this.vh * 0.2 * CFG.scroll.wheelScale * 2; this.frames = 6;
      } else if (this.openSlot < 0 && !this.o.locked?.() && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        this.o.onInteract?.(); this.residual += (e.key === 'ArrowRight' ? 1 : -1) * this.pitch * 0.5; this.frames = 6;
      }
    });
    window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
    c.addEventListener('pointerdown', (e) => {
      if (this.o.locked?.()) return;
      c.setPointerCapture(e.pointerId); this.o.onInteract?.();
      this.velocity = 0; this.residual = 0; this.glide = this.openSlot >= 0 ? this.glide : null;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), lt: performance.now(), v: 0, moved: false };
    });
    c.addEventListener('pointermove', (e) => {
      const now = performance.now();
      const p = this.pointer; const dx0 = e.clientX - p.x, dy0 = e.clientY - p.y; const dtp = Math.max(1, now - p.t) / 1000;
      p.sp = Math.min(6, Math.hypot(dx0, dy0) / dtp / (this.vh * 0.25)); p.x = e.clientX; p.y = e.clientY; p.t = now;
      if (this.drag && this.drag.id === e.pointerId) {
        const d = this.drag; const dx = e.clientX - d.x; const dt = Math.max(1e-3, (now - d.lt) / 1000);
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
        if (this.openSlot < 0) {
          this.scroll += -dx * this.lpp;
          const inst = (-dx * this.lpp) / dt; d.v += (inst - d.v) * (1 - Math.exp(-dt / 0.06));
        } else d.dx = (d.dx || 0) + dx;
        d.x = e.clientX; d.lt = now; this.frames = 6;
      }
      this._hoverAt(e.clientX, e.clientY);
    });
    const up = (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return; this.drag = null;
      const now = performance.now();
      if (!d.moved && now - d.t <= 350) { this._tap(e.clientX, e.clientY); return; }
      if (this.openSlot >= 0) { if (Math.abs(d.dx || 0) > 70) this.step(d.dx < 0 ? 1 : -1); return; }
      this.velocity = now - d.lt > 80 ? 0 : clamp(d.v, -CFG.scroll.maxSpeed, CFG.scroll.maxSpeed);
      /* pára sempre com um cartão ao centro: mesma inércia (dragTau), mas o ponto de chegada é o cartão mais próximo */
      const tau = CFG.scroll.dragTau, end = Math.round((this.scroll + this.velocity * tau) / this.pitch) * this.pitch;
      this.velocity = (end - this.scroll) / tau;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { this.hover = null; this.pointer.x = -1; });
    document.addEventListener('visibilitychange', () => { this.clock = performance.now(); this.frames = Math.max(this.frames, 4); });
    /* o iOS tira o contexto WebGL a separadores em segundo plano ou com pouca memória; sem isto o canvas fica preto */
    c.addEventListener('webglcontextlost', (e) => e.preventDefault());
    c.addEventListener('webglcontextrestored', () => location.reload()); // ponytail: recarrega em vez de reconstruir texturas/RT; raro
  }

  /* ---------------------------------------------------------------- geometria CPU (para picking) */
  _curveAt(row, s, out) {
    const H = this.H; const f = clamp((s + H) / (2 * H), 0, 1) * 1024; const i0 = Math.floor(f), i1 = Math.min(i0 + 1, 1024), t = f - i0;
    const a = (row * CURVE_N + i0) * 4, b = (row * CURVE_N + i1) * 4, d = this.curveData;
    out[0] = lerp(d[a], d[b], t); out[1] = lerp(d[a + 1], d[b + 1], t); out[2] = lerp(d[a + 2], d[b + 2], t);
  }
  _slotPoint(i, u, v, out) {
    const lx = (u - 0.5) * this.cw, ly = (v - 0.5) * this.ch;
    const P = this._P || (this._P = [0, 0, 0]), U = this._U || (this._U = [0, 0, 0]), N = this._N || (this._N = [0, 0, 0]);
    const s = this.slotX[i] + lx; this._curveAt(0, s, P); this._curveAt(1, s, U); this._curveAt(2, s, N);
    const yn = ly / (this.ch / 2); const bow = this.shared.uBow.value * (1 - yn * yn);
    const cx = P[0] + U[0] * ly + N[0] * bow, cy = P[1] + U[1] * ly + N[1] * bow, cz = P[2] + U[2] * ly + N[2] * bow;
    const f = this.flat[i].x, m = this.meshes[i].material.uniforms;
    const fx = m.uFlatC.value.x + lx * m.uFlatS.value.x, fy = m.uFlatC.value.y + ly * m.uFlatS.value.y, fz = m.uFlatC.value.z;
    out.set(lerp(cx, fx, f), lerp(cy, fy, f), lerp(cz, fz, f));
    return out;
  }
  /** devolve {slot,u,v} do cartão sob o ponto (px) */
  pick(px, py) {
    const GX = 28, GY = 10; const vec = new THREE.Vector3(); const g = this.group;
    const pts = new Float32Array((GX + 1) * (GY + 1) * 3); let best = null;
    const nx = (px / this.vw) * 2 - 1, ny = -(py / this.vh) * 2 + 1;
    for (let i = 0; i < this.slots; i++) {
      if (!this.meshes[i].visible) continue;
      for (let y = 0; y <= GY; y++) for (let x = 0; x <= GX; x++) {
        this._slotPoint(i, x / GX, y / GY, vec); vec.multiplyScalar(this.gs).applyQuaternion(g.quaternion).add(g.position).project(this.camera);
        const o = (y * (GX + 1) + x) * 3; pts[o] = vec.x; pts[o + 1] = vec.y; pts[o + 2] = vec.z;
      }
      for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
        const o00 = (y * (GX + 1) + x) * 3, o10 = o00 + 3, o01 = o00 + (GX + 1) * 3, o11 = o01 + 3;
        for (const tri of [[o00, o10, o11, 0], [o00, o11, o01, 1]]) {
          const A = tri[0], B = tri[1], C = tri[2];
          const d = (pts[B + 1] - pts[C + 1]) * (pts[A] - pts[C]) + (pts[C] - pts[B]) * (pts[A + 1] - pts[C + 1]);
          if (Math.abs(d) < 1e-12) continue;
          const l1 = ((pts[B + 1] - pts[C + 1]) * (nx - pts[C]) + (pts[C] - pts[B]) * (ny - pts[C + 1])) / d;
          const l2 = ((pts[C + 1] - pts[A + 1]) * (nx - pts[C]) + (pts[A] - pts[C]) * (ny - pts[C + 1])) / d;
          const l3 = 1 - l1 - l2;
          if (l1 < 0 || l2 < 0 || l3 < 0) continue;
          const z = l1 * pts[A + 2] + l2 * pts[B + 2] + l3 * pts[C + 2];
          if (!best || z < best.z) {
            const ux = [0, 1, 1], uy = [0, 0, 1]; const ux2 = [0, 1, 0], uy2 = [0, 1, 1];
            const cu = tri[3] ? ux2 : ux, cvv = tri[3] ? uy2 : uy;
            const uu = (x + l1 * cu[0] + l2 * cu[1] + l3 * cu[2]) / GX, vv = (y + l1 * cvv[0] + l2 * cvv[1] + l3 * cvv[2]) / GY;
            best = { slot: i, u: uu, v: vv, z };
          }
        }
      }
    }
    return best;
  }

  /* ---------------------------------------------------------------- ondas */
  _simFor(slot) {
    let s = this.sims.find((x) => x.slot === slot);
    if (s) { s.last = performance.now(); return s; }
    if (this.sims.length >= 4) { this.sims.sort((a, b) => a.last - b.last); const old = this.sims.shift(); this.meshes[old.slot].material.uniforms.uWave.value = this.zeroTex; this.meshes[old.slot].material.uniforms.uWaveSize.value.set(2, 2); this.simFree.push(old); }
    const gw = this.portrait ? 32 : 56, gh = this.portrait ? 42 : 32;
    s = this.simFree.find((x) => x.gw === gw && x.gh === gh);
    if (s) this.simFree.splice(this.simFree.indexOf(s), 1); else s = new WaveSim(gw, gh);
    s.reset(slot); s.last = performance.now(); this.sims.push(s);
    const u = this.meshes[slot].material.uniforms; u.uWave.value = s.tex; u.uWaveSize.value.set(gw, gh);
    return s;
  }
  _hoverAt(x, y) {
    if (this.reduced) return;
    const hit = this.pick(x, y); this.hover = hit;
  }

  /* ---------------------------------------------------------------- abrir / fechar */
  _tap(x, y) {
    if (this.openSlot >= 0) return;
    const hit = this.pick(x, y); if (!hit) return;
    this.open(hit.slot, [hit.u, hit.v]);
  }
  open(slot, uv) {
    if (this.openSlot === slot) return;
    const was = this.openSlot >= 0;
    this.openSlot = slot; this.closeAt = 0;
    this.tapUV = uv || [0.5, 0.5];
    const m = this.meshes[slot].material.uniforms; m.uTap.value.set(this.tapUV[0], this.tapUV[1]);
    if (!this.reduced) { const s = this._simFor(slot); s.bump(this.tapUV[0], this.tapUV[1], CFG.hover.tapSize * 0.5, CFG.hover.tap * 0.06); }
    // desliza a fita para centrar o cartão
    const pos = this.scroll / this.pitch; const d = wrap(slot - pos, -this.slots / 2, this.slots / 2);
    const stretch = clamp(Math.abs(d) / (CFG.open.glideSpeed * 0.5) / CFG.open.tauGlide / 10, 1, 3);
    this.glide = { target: this.scroll + d * this.pitch, tau: CFG.open.tauGlide * stretch * (was ? 1.6 : 1.0) };
    this.velocity = 0; this.residual = 0; this.settled = false; this.revealed = false;
    this.o.onOpen?.(slot % this.N, this.frame);
    this.frames = 10;
  }
  close() {
    if (this.openSlot < 0) return;
    this.closeAt = performance.now() + CFG.open.lag * 1000; this.closing = true;
    this.o.onClose?.(); this.frames = 10;
  }
  step(dir) {
    if (this.openSlot < 0) return;
    this.open(wrap(this.openSlot + dir, 0, this.slots), [0.5, 0.5]);
  }

  /* ---------------------------------------------------------------- intro */
  /* em retrato a entrada gira metade dos cartões (as capturas de referência mostram ~3) */
  _spinCards() { return lerp(CFG.intro.spinCards, 3, this.portT || 0); }
  startIntro() { if (this.reduced) { this.introDone = true; return; } this.introT = -CFG.intro.delay; this.introDone = false; this.frames = 10; }

  /* ---------------------------------------------------------------- loop */
  _loop(now) {
    requestAnimationFrame(this._loop);
    if (document.hidden) return;
    let dt = (now - this.clock) / 1000; this.clock = now; if (dt <= 0) return; dt = Math.min(dt, 0.1);
    this._update(dt, now);
    const active = this.frames > 0 || Math.abs(this.flowSpeed) > 0.005 || this.sims.length || !this.introDone || this.openSlot >= 0 && !this.settled
      || this.glide || this.velocity || this.residual || this.openAmt.v > 1e-3 || Math.abs(this.openAmt.x - (this.openSlot >= 0 ? 1 : 0)) > 1e-3;
    if (this.frames > 0) this.frames--;
    if (active) this._render();
  }
  _update(dt, now) {
    const S = CFG.scroll;
    // intro
    if (!this.introDone && this.introT > -1) {
      this.introT += dt; const t = Math.max(0, this.introT); const I = CFG.intro;
      this.introE1 = easeOut3(t / I.travelDur); this.introE2 = easeOut3(t / I.spinDur);
      this.introScroll = -this._spinCards() * this.pitch * (1 - this.introE2);
      if (t >= Math.max(I.travelDur, I.spinDur, I.shapeDur) + 0.05) { this.introDone = true; this.introE1 = this.introE2 = 1; this.introScroll = 0; }
    } else if (this.introT === -1 && !this.introDone) { this.introE1 = 0; this.introE2 = 0; this.introScroll = -this._spinCards() * this.pitch; }
    // input
    if (!this.drag && !this.glide && !this.velocity && !this.residual && this.openSlot < 0 && this.introDone) {
      const snap = Math.round(this.scroll / this.pitch) * this.pitch;
      if (Math.abs(snap - this.scroll) > 1e-3) this.glide = { target: snap, tau: 0.12 };
    }
    if (this.glide && !this.drag) {
      const k = 1 - Math.exp(-dt / this.glide.tau); this.scroll += (this.glide.target - this.scroll) * k;
      if (Math.abs(this.glide.target - this.scroll) < 1e-3) { this.scroll = this.glide.target; this.glide = null; }
    } else {
      if (this.velocity) { const k = Math.exp(-dt / S.dragTau); this.scroll += this.velocity * S.dragTau * (1 - k); this.velocity *= k; if (Math.abs(this.velocity) < 1e-4) this.velocity = 0; }
      if (this.residual) { const a = this.residual * (1 - Math.exp(-dt / S.wheelTau)); this.scroll += a; this.residual -= a; if (Math.abs(this.residual) < 1e-5) this.residual = 0; }
    }
    // fechar com atraso
    if (this.closeAt && now >= this.closeAt) { this.closeAt = 0; this.openSlot = -1; this.closing = false; this.settled = false; if (location.hash) history.replaceState(null, '', location.pathname + location.search); }
    const total = this.scroll + this.introScroll;
    this.measured = (total - this.lastTotal) / dt; this.lastTotal = total;
    if (Math.abs(this.measured) > 300) this.measured = 0;
    const F = CFG.flow;
    this.flowSpeed += (this.measured - this.flowSpeed) * (1 - Math.exp(-dt / F.tau));
    if (Math.abs(this.flowSpeed) < 1e-4) this.flowSpeed = 0;
    let u = this.reduced ? 0 : Math.tanh(this.flowSpeed / 8);
    const bow = -F.bow * u;
    this.fL = 1 - (Math.abs(u) * 0.4 - u * F.asymmetry); this.fR = 1 - (Math.abs(u) * 0.4 + u * F.asymmetry);
    if (this.reduced) { this.fL = this.fR = 1; }
    // abertura
    const o = CFG.open;
    const sp = (st, target, tau) => { const r = 1 / tau, a = 1 + 2 * dt * r, b = r * r * dt, c = dt * b, s = 1 / (a + c); const x = st.x, v = st.v; st.x = (a * x + dt * v + c * target) * s; st.v = (v + b * (target - x)) * s; };
    sp(this.openAmt, this.openSlot >= 0 ? 1 : 0, o.tauOpen);
    let allFlat = true;
    for (let i = 0; i < this.slots; i++) {
      const tgt = this.openSlot === i ? 1 : 0;
      sp(this.flat[i], tgt, o.tauFlatten);
      if (this.flat[i].x < 1e-4 && tgt === 0) { this.flat[i].x = 0; this.flat[i].v = 0; }
    }
    /* a folha (DOM) entra quando o cartão já está quase plano, para a capa nunca dar lugar a papel em branco */
    if (this.openSlot >= 0 && !this.revealed && this.flat[this.openSlot].x > (this.portrait ? 0.72 : 0.96)) { this.revealed = true; this.o.onSettled?.(this.openSlot % this.N); }
    if (this.openSlot >= 0 && !this.settled && this.flat[this.openSlot].x > 0.96) this.settled = true;
    // forma
    const sh = this.introDone ? this.shapeBase : mixShape(this.shapeIntro, this.shapeBase, this.introE2);
    const key = sh.join(',') + '|' + this.fL.toFixed(4) + '|' + this.fR.toFixed(4);
    if (key !== this.bakedKey) { this.bakedKey = key; bake(sh, this.fL, this.fR, this.H, this.curveData, this.portrait ? PORT_STRAIGHT : 4); this.curveTex.needsUpdate = true; }
    this.shared.uBow.value = bow; this.bowU = u;
    // slots
    const pitchEff = lerp(this.pitch, this.pitchOpen, this.openAmt.x);
    const pos = total / this.pitch; const limit = Math.min(this.H, (this.slots * pitchEff) / 2 - this.cw / 2);
    for (let i = 0; i < this.slots; i++) {
      const d = wrap(i - pos, -this.slots / 2, this.slots / 2); const x = d * pitchEff;
      this.slotX[i] = x; const m = this.meshes[i]; const vis = Math.abs(x) - this.cw / 2 < limit;
      /* com um projecto aberto só esse fica: os outros afastam-se (pitchOpen) e desaparecem a meio da abertura */
      const away = this.openAmt.x > (this.openSlot >= 0 ? 0.35 : 0.5);
      m.visible = vis && (!away || i === this.openSlot || this.flat[i].x > 0.01);
      const U = m.material.uniforms; U.uSlotX.value = x; const f = this.flat[i].x;
      U.uFlat.value = clamp(f, 0, 1.0); U.uSheet.value = 0; // o cartão aberto mantém a capa até o site (DOM por cima) carregar
      U.uFlatS.value.set(this.flatS[0], this.flatS[1]); U.uFlatC.value.set(x, this.flatC[1], this.flatC[2]);
      U.uLift.value = Math.sin(Math.PI * clamp(f, 0, 1)) * (this.reduced ? 0 : o.lift) * (this.openSlot === i || f > 0.01 ? 1 : 0);
      this.meshes[i].renderOrder = f > 0.01 ? 5 : 0;
    }
    // grupo / intro
    const I = CFG.intro; const e1 = this.introE1;
    this.group.position.set(2 * I.travelX * (this.visW / 2) * (1 - e1), this.placeY, I.travelZ * (1 - e1) * lerp(1, 1.4, this.portT)); this.group.scale.setScalar(this.gs);
    { const k = this.portT * (1 - clamp(this.openAmt.x, 0, 1)); this.group.rotation.set(0, TILT_PORT.y * k, TILT_PORT.z * k); }
    // ondas
    const flowMotion = clamp(Math.abs(u) * 3, 0, 1);
    const depth = this.reduced ? 0 : CFG.hover.depth * (1 - flowMotion);
    if (this.hover && !this.reduced && this.pointer.sp > 0.01 && this.openSlot < 0 && !this.drag) {
      const s = this._simFor(this.hover.slot); s.bump(this.hover.u, this.hover.v, CFG.hover.radius, -CFG.hover.drive * this.pointer.sp * 0.022);
    }
    this.pointer.sp *= Math.exp(-dt / 0.08);
    for (let k = this.sims.length - 1; k >= 0; k--) {
      const s = this.sims[k]; s.acc += dt; let n = 0; while (s.acc >= 1 / 60 && n < 4) { s.step(); s.acc -= 1 / 60; n++; }
      if (n) s.upload();
      const mu = this.meshes[s.slot].material.uniforms; mu.uWaveAmp.value = depth * (this.ch / 2);
      if (s.energy < 2e-5 && !(this.hover && this.hover.slot === s.slot) && now - s.last > 600) {
        mu.uWave.value = this.zeroTex; mu.uWaveSize.value.set(2, 2); mu.uWaveAmp.value = 0; this.sims.splice(k, 1); this.simFree.push(s);
      }
    }
    // blur
    const amt = this.reduced ? 0 : (this.openAmt.x > 0.5 ? F.blurOpen : F.blur) * Math.abs(u);
    this.postMat.uniforms.uAmt.value = amt;
    this.postMat.uniforms.uDir.value.set(Math.sign(u) * amt * 0.22 * lerp(1, 0.22, this.portT), 0);
    // centro
    const ci = this.openSlot >= 0 ? this.openSlot % this.N : ((Math.round(pos) % this.N) + this.N) % this.N;
    if (ci !== this.centerIdx) { this.centerIdx = ci; this.o.onCenter?.(ci); }
  }
  _render() {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.render(this.scene, this.camera);
    r.setRenderTarget(null); r.render(this.postScene, this.postCam);
  }
  /** pede um fotograma (ex.: depois de carregar imagens) */
  poke(n = 4) { this.frames = Math.max(this.frames, n); }
  get isOpen() { return this.openSlot >= 0; }
}
