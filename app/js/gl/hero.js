/* Hero particle engine — raw WebGL2 (no libraries).
   ~100k points morph between seven macroeconomic figures entirely on the GPU; HDR additive
   rendering + dual-Kawase bloom in the dark theme, ink-on-paper alpha blending in the light one. */
import { generateAll, SCENES } from './shapes.js';
import { clamp, lerp, rng, smooth, damp } from '../core/dom.js';

const NS = SCENES.length; // 7
const FLOATS = 4;

/* palette — 5 stops per scene, dark (glow) and light (ink) */
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const C = { amber: '#ffb547', mint: '#4fe3c1', coral: '#ff6a55', violet: '#8f80ff', sky: '#5bb3ff', white: '#fff4dc', slate: '#6f7d96', lime: '#c8f06b' };
const DARK = [
  ['amber', 'amber', 'mint', 'white', 'white'],
  ['violet', 'sky', 'mint', 'amber', 'white'],
  ['amber', 'amber', 'mint', 'coral', 'white'],
  ['amber', 'coral', 'white', 'mint', 'sky'],
  ['amber', 'coral', 'violet', 'sky', 'white'],
  ['amber', 'mint', 'slate', 'violet', 'white'],
  ['sky', 'mint', 'slate', 'amber', 'white'],
].map((r) => r.map((n) => hex(C[n])));
const L = { amber: '#d8401c', mint: '#0c7a6b', coral: '#b97a08', violet: '#4a4fc4', sky: '#1f74b8', white: '#17140f', slate: '#8a8474', lime: '#6b8a1c' };
const LIGHT = [
  ['amber', 'amber', 'mint', 'white', 'white'],
  ['violet', 'sky', 'mint', 'amber', 'white'],
  ['amber', 'amber', 'mint', 'coral', 'white'],
  ['amber', 'coral', 'white', 'mint', 'sky'],
  ['amber', 'coral', 'violet', 'sky', 'white'],
  ['amber', 'mint', 'slate', 'violet', 'white'],
  ['sky', 'mint', 'slate', 'amber', 'white'],
].map((r) => r.map((n) => hex(L[n])));

const BG_DARK = hex('#07090d'), BG_LIGHT = hex('#f2ece0');

/* per-scene motion: axis (xyz) + angular speed, mode (0 none, 1 rings, 2 rigid), shimmer (amp, freq, speed) */
const FLOW = [
  [0, 1, 0, 0.0], [0, 1, 0, 0.0], [0, 1, 0, 0.0], [0, 1, 0, 0.0], [0, 1, 0, 0.0], [0, 1, 0, 0.0], [0, 1, 0, 0.0],
];
const MODE = [1, 0, 0, 0, 2, 0, 2];
const WAVE = [
  [.012, 3.0, 1.2], [.016, 2.4, 1.6], [.014, 2.8, 1.1], [.020, 2.2, 1.3], [.010, 3.2, 1.0], [.014, 2.6, 1.4], [.006, 2.8, .8],
];
// ring axis (after the fixed tilt baked into the shapes), angular speed
const RING_AXIS = (() => { const t = -0.92; return [0, Math.cos(t), Math.sin(t)]; })();
FLOW[0] = [RING_AXIS[0], RING_AXIS[1], RING_AXIS[2], .42];
FLOW[4] = [0, Math.cos(-1.12), Math.sin(-1.12), .32];
FLOW[6] = [0, Math.cos(.42), Math.sin(.42), .16];

/* ── GLSL ───────────────────────────────────────────────────── */
const VS = `#version 300 es
precision highp float; precision highp int;
in vec4 aP0; in vec4 aP1; in vec4 aP2; in vec4 aP3; in vec4 aP4; in vec4 aP5; in vec4 aP6; in vec4 aR;
uniform mat4 uProj;
uniform float uTime, uScene, uIntro, uSize, uPx, uTheme, uScale, uFocus;
uniform vec3 uOffset;
uniform vec2 uRot;
uniform vec4 uPtr[4];
uniform vec4 uShock;
uniform vec4 uFlow[7];
uniform vec4 uWave[7];
uniform float uMode[7];
uniform vec3 uPal[35];
out vec4 vCol;
vec4 P(int k){ if(k==0)return aP0; if(k==1)return aP1; if(k==2)return aP2; if(k==3)return aP3; if(k==4)return aP4; if(k==5)return aP5; return aP6; }
vec3 pal(int s, float c){ float x = clamp(c,0.,1.)*4.; int k = int(min(floor(x),3.)); float f = x-float(k); return mix(uPal[s*5+k], uPal[s*5+k+1], f); }
vec3 rotAxis(vec3 p, vec3 a, float ang){ float c=cos(ang), s=sin(ang); return p*c + cross(a,p)*s + a*dot(a,p)*(1.-c); }
float sm5(float x){ x = clamp(x,0.,1.); return x*x*x*(x*(x*6.-15.)+10.); }
vec3 dyn(vec3 p, int s, float c){
  vec4 fl = uFlow[s]; float m = uMode[s];
  float dir = 0.;
  if (m > 1.5) dir = 1.; else if (m > .5) dir = (c < .3) ? 1. : ((c < .7) ? -1. : 0.);
  if (dir != 0. && fl.w != 0.) p = rotAxis(p, normalize(fl.xyz), uTime * fl.w * dir);
  vec4 w = uWave[s];
  p += vec3(sin(p.y*w.y + uTime*w.z + aR.y*6.283), sin(p.x*w.y*.9 + uTime*w.z*.8 + aR.z*6.283), cos(p.x*w.y*1.3 + uTime*w.z*.6 + aR.w*6.283)) * w.x * (.4 + aR.z);
  return p;
}
void main(){
  float sc = clamp(uScene, 0., float(${NS - 1}));
  int i0 = int(floor(sc)); if (i0 > ${NS - 2}) i0 = ${NS - 2};
  int i1 = i0 + 1;
  float f = (uScene >= float(${NS - 1})) ? 1. : sc - float(i0);
  vec4 A = P(i0), B = P(i1);
  vec3 pa = A.xyz * 2., pb = B.xyz * 2.;
  float sweep = clamp((pb.x + 1.8) / 3.6, 0., 1.);
  float delay = (sweep * .6 + aR.x * .4) * .55;
  float t = sm5((f - delay) / .45);
  vec3 da = dyn(pa, i0, A.w), db = dyn(pb, i1, B.w);
  vec3 pos = mix(da, db, t);
  float burst = sin(3.14159265 * t);
  vec3 q = (da + db) * .7 + aR.xyz * 6.283;
  pos += vec3(sin(q.y*2.1 + uTime*.7), sin(q.z*1.9 + uTime*.9), sin(q.x*2.3 + uTime*.6)) * burst * (.32 + .55 * aR.w);
  // intro: assemble out of a dust cloud
  if (uIntro < 1.) {
    vec3 st = (aR.xyz * 2. - 1.) * vec3(3.2, 2.0, 2.2);
    float ti = sm5(uIntro * 1.7 - aR.x * .7);
    pos = mix(st, pos, ti);
  }
  pos *= uScale;
  float cy = cos(uRot.x), sy = sin(uRot.x), cx = cos(uRot.y), sx = sin(uRot.y);
  vec3 w = vec3(cy*pos.x + sy*pos.z, pos.y, -sy*pos.x + cy*pos.z);
  w = vec3(w.x, cx*w.y - sx*w.z, sx*w.y + cx*w.z);
  w += uOffset;
  // pointer wake
  for (int i = 0; i < 4; i++) {
    vec2 d = w.xy - uPtr[i].xy; float r2 = dot(d, d); float k = exp(-r2 / .085) * uPtr[i].z;
    vec2 n = d / (sqrt(r2) + 1e-3);
    w.xy += n * k * .22 + vec2(-n.y, n.x) * k * .12;
    w.z += k * .35 * (aR.w - .35);
  }
  // click shock-wave
  float age = uTime - uShock.z;
  if (age > 0. && age < 3.) {
    float rr = length(w.xy - uShock.xy);
    float ring = exp(-pow((rr - age * 1.7) / .16, 2.)) * uShock.w * exp(-age * 1.3);
    w.xy += normalize(w.xy - uShock.xy + 1e-3) * ring * .3; w.z += ring * .35;
  }
  vec4 cp = uProj * vec4(w, 1.);
  gl_Position = cp;
  float zc = cp.w;
  float dof = abs(zc - 3.6) * uFocus;
  float szv = .55 + aR.w * 1.15;
  float ps = (uSize * szv + dof * 5.) * uPx * (3.6 / zc);
  gl_PointSize = clamp(ps, 1., 64.);
  vec3 col = mix(pal(i0, A.w), pal(i1, B.w), t);
  float hot = smoothstep(.86, 1., mix(A.w, B.w, t));
  float tw = .72 + .28 * sin(uTime * (.8 + aR.z * 2.6) + aR.w * 40.);
  float br = tw * (.5 + aR.y * .95) * (1. + burst * 1.5 + hot * 1.1);
  float dimf = 1. / (1. + dof * 3.4);
  vCol = vec4(col * br * dimf, dimf * (.35 + .65 * aR.y));
  if (uTheme > .5) vCol = vec4(col, (.52 + .48 * aR.y) * dimf * (1. - burst * .35));
}`;

const FS = `#version 300 es
precision highp float;
in vec4 vCol; uniform float uTheme; out vec4 o;
void main(){
  vec2 d = gl_PointCoord - .5; float r = length(d) * 2.;
  if (r > 1.) discard;
  if (uTheme < .5) {
    float a = pow(1. - r, 1.7), core = exp(-r*r*7.);
    o = vec4(vCol.rgb * (a * .5 + core * .95) * (.6 + vCol.a), 1.);
  } else {
    float cov = smoothstep(1., .5, r);
    o = vec4(vCol.rgb, cov * vCol.a);
  }
}`;

const VS_FS = `#version 300 es
out vec2 uv; void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); uv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

const FS_DOWN = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst; out vec4 o;
vec3 s(vec2 p){ return texture(uTex, p).rgb; }
float karis(vec3 c){ return 1. / (1. + dot(c, vec3(.2126,.7152,.0722))); }
void main(){
  vec2 t = uTexel;
  vec3 a = s(uv + t*vec2(-2,-2)), b = s(uv + t*vec2(0,-2)), c = s(uv + t*vec2(2,-2));
  vec3 d = s(uv + t*vec2(-2,0)),  e = s(uv),                f = s(uv + t*vec2(2,0));
  vec3 g = s(uv + t*vec2(-2,2)),  h = s(uv + t*vec2(0,2)),  i = s(uv + t*vec2(2,2));
  vec3 j = s(uv + t*vec2(-1,-1)), k = s(uv + t*vec2(1,-1)), l = s(uv + t*vec2(-1,1)), m = s(uv + t*vec2(1,1));
  vec3 r;
  if (uFirst > .5) {
    vec3 g0 = (a+b+d+e)*.125*.25, g1 = (b+c+e+f)*.125*.25, g2 = (d+e+g+h)*.125*.25, g3 = (e+f+h+i)*.125*.25, g4 = (j+k+l+m)*.5*.25;
    r = g0*karis(a+b+d+e) + g1*karis(b+c+e+f) + g2*karis(d+e+g+h) + g3*karis(e+f+h+i) + g4*karis(j+k+l+m);
    r *= 1.15;
  } else r = e*.125 + (a+c+g+i)*.03125 + (b+d+f+h)*.0625 + (j+k+l+m)*.125;
  o = vec4(r, 1.);
}`;

const FS_UP = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uRadius; out vec4 o;
void main(){
  vec2 t = uTexel * uRadius;
  vec3 r = texture(uTex, uv).rgb * 4.;
  r += texture(uTex, uv + vec2(-t.x, 0)).rgb * 2.; r += texture(uTex, uv + vec2(t.x, 0)).rgb * 2.;
  r += texture(uTex, uv + vec2(0, -t.y)).rgb * 2.; r += texture(uTex, uv + vec2(0, t.y)).rgb * 2.;
  r += texture(uTex, uv + vec2(-t.x,-t.y)).rgb; r += texture(uTex, uv + vec2(t.x,-t.y)).rgb;
  r += texture(uTex, uv + vec2(-t.x, t.y)).rgb; r += texture(uTex, uv + vec2(t.x, t.y)).rgb;
  o = vec4(r / 16., 1.);
}`;

const FS_COMP = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uScene, uBloom; uniform vec3 uBg, uGlow; uniform vec2 uGlowPos; uniform float uAspect, uTime, uBloomK, uGlowK; out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 c = uv - .5; float r = length(c * vec2(uAspect, 1.));
  vec2 ca = c * .0028 * (r + .15);
  vec3 sc = vec3(texture(uScene, uv + ca).r, texture(uScene, uv).g, texture(uScene, uv - ca).b);
  vec3 bl = texture(uBloom, uv).rgb;
  float g = exp(-pow(length((uv - uGlowPos) * vec2(uAspect, 1.)) * 1.25, 2.));
  vec3 col = uBg + uGlow * g * uGlowK + sc + bl * uBloomK;
  col = 1. - exp(-col * 1.28);                                    // soft filmic shoulder
  col *= mix(1., smoothstep(1.32, .28, r), .72);                   // vignette
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) / 255. * 2.6;  // dither
  o = vec4(col, 1.);
}`;

const FS_BG = `#version 300 es
precision highp float; in vec2 uv; uniform vec3 uBg, uGlow; uniform vec2 uGlowPos; uniform float uAspect, uGlowK; out vec4 o;
void main(){
  float g = exp(-pow(length((uv - uGlowPos) * vec2(uAspect, 1.)) * 1.15, 2.));
  vec3 col = mix(uBg, uGlow, g * uGlowK);
  float r = length((uv - .5) * vec2(uAspect, 1.));
  col *= mix(1., smoothstep(1.4, .35, r), .10);
  o = vec4(col, 1.);
}`;

/* ── tiny mat4 ──────────────────────────────────────────────── */
function persp(fovy, aspect, n, f) { const t = 1 / Math.tan(fovy / 2); const nf = 1 / (n - f); return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); }
function mulT(m, z) { // m * translate(0,0,z)
  const o = m.slice(); o[12] = m[8] * z + m[12]; o[13] = m[9] * z + m[13]; o[14] = m[10] * z + m[14]; o[15] = m[11] * z + m[15]; return o;
}

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('shader: ' + log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 4000)); }
  return s;
}
function program(gl, vs, fs, attribs) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  if (attribs) attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export class Hero {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.theme = opts.theme || 'dark';
    this.count = opts.count || 100000;
    this.scene = { target: 0, cur: 0 };
    this.ptr = { x: 0, y: 0, tx: 0, ty: 0, active: 0, trail: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], t: 0 };
    this.layout = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1 };
    this.rot = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
    this.shockV = [0, 0, -10, 0];
    this.time = 0; this.intro = 0; this.running = false; this.visible = true; this.destroyed = false;
    this.q = { level: 0, frames: 0, acc: 0, cool: 0 };
    this.fail = null;
    try { this._init(); } catch (e) { console.warn('[hero] WebGL init failed', e); this.fail = e; }
  }

  get ok() { return !this.fail; }

  _init() {
    const cv = this.canvas;
    const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!this.opts.preserve });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    this.ext = { cbf: gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float') };
    this.prog = program(gl, VS, FS, ['aP0', 'aP1', 'aP2', 'aP3', 'aP4', 'aP5', 'aP6', 'aR']);
    this.progComp = program(gl, VS_FS, FS_COMP);
    this.progBg = program(gl, VS_FS, FS_BG);
    this.progDown = program(gl, VS_FS, FS_DOWN);
    this.progUp = program(gl, VS_FS, FS_UP);
    this.vaoEmpty = gl.createVertexArray();
    this._buildBuffers(this.count);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.fail = new Error('context lost'); this.opts.onFail && this.opts.onFail(); });
    this.resize();
  }

  _buildBuffers(n) {
    const gl = this.gl;
    const scenes = generateAll(n, 7);
    const stride = 64; // 7 × vec4<int16> (56) + vec4<uint8> seed (4) + pad
    const buf = new ArrayBuffer(n * stride), i16 = new Int16Array(buf), u8 = new Uint8Array(buf);
    const r = rng(99);
    for (let i = 0; i < n; i++) {
      const base = i * (stride / 2);
      for (let s = 0; s < NS; s++) {
        const src = scenes[s], o = i * 4, d = base + s * 4;
        i16[d] = clamp(src[o] / 2, -1, 1) * 32767; i16[d + 1] = clamp(src[o + 1] / 2, -1, 1) * 32767;
        i16[d + 2] = clamp(src[o + 2] / 2, -1, 1) * 32767; i16[d + 3] = clamp(src[o + 3], 0, 1) * 32767;
      }
      const b = i * stride + 56;
      u8[b] = (r() * 255) | 0; u8[b + 1] = (r() * 255) | 0; u8[b + 2] = (r() * 255) | 0; u8[b + 3] = (r() * 255) | 0;
    }
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    for (let s = 0; s < NS; s++) { gl.enableVertexAttribArray(s); gl.vertexAttribPointer(s, 4, gl.SHORT, true, stride, s * 8); }
    gl.enableVertexAttribArray(7); gl.vertexAttribPointer(7, 4, gl.UNSIGNED_BYTE, true, stride, 56);
    gl.bindVertexArray(null);
    this.n = n; this.draw = n;
  }

  _makeRT(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h, ok };
  }
  _freeRTs() { const gl = this.gl; (this.rts || []).forEach((r) => { gl.deleteTexture(r.tex); gl.deleteFramebuffer(r.fb); }); this.rts = null; }

  resize() {
    if (!this.gl) return;
    const cv = this.canvas, gl = this.gl;
    const dprCap = this.opts.dpr || Math.min(window.devicePixelRatio || 1, 2);
    const cssW = cv.clientWidth || innerWidth, cssH = cv.clientHeight || innerHeight;
    let scale = dprCap * [1, .8, .64, .5][this.q.level];
    const maxPx = 2.6e6; if (cssW * cssH * scale * scale > maxPx) scale = Math.sqrt(maxPx / (cssW * cssH));
    const w = Math.max(2, Math.round(cssW * scale)), h = Math.max(2, Math.round(cssH * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    this.w = w; this.h = h; this.px = scale; this.aspect = w / h;
    this.cssW = cssW; this.cssH = cssH;
    this._freeRTs();
    this.post = this.theme === 'dark' && !!this.ext.cbf && this.q.level < 3;
    if (this.post) {
      const rts = [this._makeRT(w, h)];
      let cw = w, ch = h;
      for (let i = 0; i < 5; i++) { cw = Math.max(2, cw >> 1); ch = Math.max(2, ch >> 1); rts.push(this._makeRT(cw, ch)); }
      const up = []; cw = w; ch = h; for (let i = 0; i < 5; i++) { cw = Math.max(2, cw >> 1); ch = Math.max(2, ch >> 1); up.push(this._makeRT(cw, ch)); }
      this.rts = rts.concat(up);
      if (this.rts.some((r) => !r.ok)) { this.post = false; this._freeRTs(); }
    }
    this._layoutTarget();
  }

  /** composition: centred at rest, shifted right while captions sit on the left */
  _layoutTarget() {
    const a = this.aspect || 1.6, L = this.layout, p = this.layoutMix == null ? 1 : this.layoutMix; // 0 centred intro → 1 docked
    let dockX, dockY, dockS, introY, introS;
    if (a >= 1.15) { dockX = .62 * Math.min(1.25, a / 1.78 + .1); dockY = 0; dockS = .78; introY = .16; introS = .92; }
    else { dockX = 0; dockY = .42 + (1.0 - Math.min(a, 1)) * .3; dockS = .56 + a * .1; introY = .48; introS = .62 + a * .12; }
    L.tx = lerp(0, dockX, p); L.ty = lerp(introY, dockY, p); L.ts = lerp(introS, dockS, p);
  }
  setLayoutMix(p) { this.layoutMix = p; this._layoutTarget(); }
  snap() { const L = this.layout; L.x = L.tx; L.y = L.ty; L.s = L.ts; this.scene.cur = this.scene.target; }

  setScene(f) { this.scene.target = clamp(f, 0, NS - 1); }
  setPointer(nx, ny, active = true) { this.ptr.tx = nx; this.ptr.ty = ny; this.ptr.active = active ? 1 : 0; this.rot.tyaw = nx * .22; this.rot.tpitch = -ny * .1; }
  shock(nx, ny) { const w = this._ndc2world(nx, ny); this.shockV = [w[0], w[1], this.time, 1]; }
  setTheme(t) { if (t === this.theme) return; this.theme = t; this.resize(); }
  setVisible(v) { this.visible = v; if (v) this.start(); }

  _ndc2world(nx, ny) { const t = Math.tan((38 * Math.PI / 180) / 2) * 3.6; return [nx * this.aspect * t, ny * t]; }

  start() { if (this.running || !this.ok || this.destroyed) return; this.running = true; this.last = performance.now(); const loop = (t) => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this._frame(t); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  _frame(nowMs) {
    if (!this.visible || document.hidden) { this.last = nowMs; return; }
    const dt = Math.min(.05, (nowMs - this.last) / 1000); this.last = nowMs;
    this.time += dt;
    this._adapt(dt);
    const reduce = document.documentElement.classList.contains('reduce');
    const s = this.scene; s.cur = reduce ? s.target : damp(s.cur, s.target, 5.5, dt);
    if (Math.abs(s.cur - s.target) < 1e-4) s.cur = s.target;
    const L = this.layout; L.x = damp(L.x, L.tx, 4, dt); L.y = damp(L.y, L.ty, 4, dt); L.s = damp(L.s, L.ts, 4, dt);
    this.intro = Math.min(1, this.intro + dt / (reduce ? .01 : 2.6));
    const R = this.rot; R.yaw = damp(R.yaw, R.tyaw + Math.sin(this.time * .12) * .08, 2.5, dt); R.pitch = damp(R.pitch, R.tpitch, 2.5, dt);
    const P = this.ptr; P.x = damp(P.x, P.tx, 9, dt); P.y = damp(P.y, P.ty, 9, dt);
    // pointer trail: 4 samples, each lagging more
    const w = this._ndc2world(P.x, P.y);
    const tr = P.trail; for (let i = 3; i > 0; i--) { tr[i][0] = damp(tr[i][0], tr[i - 1][0], 14 - i * 3, dt); tr[i][1] = damp(tr[i][1], tr[i - 1][1], 14 - i * 3, dt); }
    tr[0][0] = w[0]; tr[0][1] = w[1]; P.str = damp(P.str || 0, P.active, 6, dt);
    this.render();
  }

  _adapt(dt) {
    const q = this.q; q.acc += dt; q.frames++;
    if (q.cool > 0) q.cool -= dt;
    if (q.frames >= 50) {
      const avg = q.acc / q.frames; q.acc = 0; q.frames = 0;
      if (avg > .030 && q.cool <= 0) { // too slow → step down
        if (this.draw > this.n * .55) this.draw = Math.floor(this.draw * .72);
        else if (q.level < 3) { q.level++; this.resize(); }
        else this.draw = Math.max(12000, Math.floor(this.draw * .8));
        q.cool = 1.2;
      } else if (avg < .0135 && q.level === 0 && this.draw < this.n && q.cool <= 0) { this.draw = Math.min(this.n, Math.floor(this.draw * 1.25)); q.cool = 3; }
    }
  }

  render() {
    const gl = this.gl, dark = this.theme === 'dark';
    const fovy = 38 * Math.PI / 180;
    const proj = mulT(persp(fovy, this.aspect, .1, 30), -3.6);
    const pal = (dark ? DARK : LIGHT).flat(2);
    const U = this.prog.u;
    const bg = dark ? BG_DARK : BG_LIGHT;
    const glowCol = (dark ? DARK : LIGHT)[Math.round(this.scene.cur) % NS][dark ? 2 : 0];
    const glowPos = [.5 + this.layout.x * .1, .5 + this.layout.y * .12];
    const target = this.post ? this.rts[0] : null;

    if (!dark) { this._bgPass(bg, glowCol, glowPos, .06); }

    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, this.w, this.h);
    if (dark) { gl.clearColor(target ? 0 : bg[0], target ? 0 : bg[1], target ? 0 : bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.enable(gl.BLEND);
    if (dark) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.prog.p);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uTime, this.time); gl.uniform1f(U.uScene, this.scene.cur); gl.uniform1f(U.uIntro, this.intro);
    gl.uniform1f(U.uSize, (dark ? 2.3 : 1.9) * (this.opts.size || 1)); gl.uniform1f(U.uPx, this.px); gl.uniform1f(U.uTheme, dark ? 0 : 1);
    gl.uniform1f(U.uScale, this.layout.s); gl.uniform1f(U.uFocus, .22);
    gl.uniform3f(U.uOffset, this.layout.x, this.layout.y, 0);
    gl.uniform2f(U.uRot, this.rot.yaw, this.rot.pitch);
    const pt = new Float32Array(16); const str = this.ptr.str || 0;
    for (let i = 0; i < 4; i++) { pt[i * 4] = this.ptr.trail[i][0]; pt[i * 4 + 1] = this.ptr.trail[i][1]; pt[i * 4 + 2] = str * (1 - i * .18); }
    gl.uniform4fv(U.uPtr, pt);
    gl.uniform4fv(U.uShock, this.shockV);
    gl.uniform4fv(U.uFlow, new Float32Array(FLOW.flat()));
    gl.uniform4fv(U.uWave, new Float32Array(WAVE.map((w) => [w[0], w[1], w[2], 0]).flat()));
    gl.uniform1fv(U.uMode, new Float32Array(MODE));
    gl.uniform3fv(U.uPal, new Float32Array(pal));
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.draw);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    if (this.post) this._bloom(bg, glowCol, glowPos);
  }

  _bgPass(bg, glow, pos, k) {
    const gl = this.gl, P = this.progBg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(P.p); gl.uniform3fv(P.u.uBg, bg); gl.uniform3fv(P.u.uGlow, glow); gl.uniform2fv(P.u.uGlowPos, pos); gl.uniform1f(P.u.uAspect, this.aspect); gl.uniform1f(P.u.uGlowK, k);
    gl.bindVertexArray(this.vaoEmpty); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
  }

  _bloom(bg, glow, pos) {
    const gl = this.gl, rts = this.rts;
    const down = this.progDown, up = this.progUp;
    gl.bindVertexArray(this.vaoEmpty);
    // down-chain: rts[0] (full) → rts[1..5]
    gl.useProgram(down.p);
    for (let i = 1; i <= 5; i++) {
      const src = rts[i - 1], dst = rts[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(down.u.uTex, 0); gl.uniform2f(down.u.uTexel, 1 / src.w, 1 / src.h); gl.uniform1f(down.u.uFirst, i === 1 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // up-chain: rts[6+i] is the up level of size 1/2^(i+1); each step upsamples the previous level and adds the matching down level
    gl.useProgram(up.p);
    let prev = rts[5];
    for (let i = 3; i >= 0; i--) {
      const dst = rts[6 + i], add = rts[i + 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prev.tex);
      gl.uniform1i(up.u.uTex, 0); gl.uniform2f(up.u.uTexel, 1 / prev.w, 1 / prev.h); gl.uniform1f(up.u.uRadius, 1.0);
      gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
      // add the down level of the same size (a zero-texel pass of the down shader is a plain copy)
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(down.p); gl.bindTexture(gl.TEXTURE_2D, add.tex); gl.uniform1i(down.u.uTex, 0); gl.uniform2f(down.u.uTexel, 0, 0); gl.uniform1f(down.u.uFirst, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND); gl.useProgram(up.p);
      prev = dst;
    }
    // composite
    const C = this.progComp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(C.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rts[0].tex); gl.uniform1i(C.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rts[6].tex); gl.uniform1i(C.u.uBloom, 1);
    gl.uniform3fv(C.u.uBg, bg); gl.uniform3fv(C.u.uGlow, glow); gl.uniform2fv(C.u.uGlowPos, pos);
    gl.uniform1f(C.u.uAspect, this.aspect); gl.uniform1f(C.u.uTime, this.time); gl.uniform1f(C.u.uBloomK, .62); gl.uniform1f(C.u.uGlowK, .07);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  destroy() {
    this.destroyed = true; this.stop();
    try { const ext = this.gl && this.gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); } catch (e) { /* noop */ }
  }
}

/* ── 2D canvas fallback (no WebGL): a light subset of the same scenes ─ */
export class Hero2D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.theme = opts.theme || 'dark';
    this.n = opts.count || 5200; this.scenes = generateAll(this.n, 7);
    this.scene = { target: 0, cur: 0 }; this.time = 0; this.ptr = { x: 0, y: 0 }; this.layoutMix = 0; this.ok = true; this.running = false; this.visible = true;
  }
  setScene(f) { this.scene.target = clamp(f, 0, NS - 1); }
  setPointer(x, y) { this.ptr.x = x; this.ptr.y = y; }
  setTheme(t) { this.theme = t; }
  setLayoutMix(p) { this.layoutMix = p; }
  snap() {}
  setVisible(v) { this.visible = v; if (v) this.start(); }
  shock() {}
  resize() { const cv = this.canvas, d = Math.min(devicePixelRatio || 1, 2); cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; this.d = d; }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = (t) => { if (!this.running) return; requestAnimationFrame(loop); this._frame(t); }; requestAnimationFrame(loop); }
  stop() { this.running = false; }
  _frame(t) {
    if (!this.visible || document.hidden) { this.last = t; return; }
    const dt = Math.min(.05, (t - this.last) / 1000); this.last = t; this.time += dt;
    const s = this.scene; s.cur = damp(s.cur, s.target, 5, dt);
    const { ctx, canvas: cv } = this, W = cv.width, H = cv.height, dark = this.theme === 'dark';
    ctx.fillStyle = dark ? '#07090d' : '#f2ece0'; ctx.fillRect(0, 0, W, H);
    const i0 = Math.min(NS - 2, Math.floor(s.cur)), f = s.cur >= NS - 1 ? 1 : s.cur - i0, A = this.scenes[i0], B = this.scenes[i0 + 1];
    const pal = (dark ? DARK : LIGHT), ppx = Math.min(W, H * 1.6) / 4.2, cx = W * (.5 + .14 * this.layoutMix), cy = H * (.5 - .04 * this.layoutMix);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    const yaw = Math.sin(this.time * .15) * .3 + this.ptr.x * .2, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    for (let i = 0; i < this.n; i++) {
      const o = i * 4, sw = clamp((f * 1.5 - ((B[o] + 1.8) / 3.6) * .5), 0, 1), k = smooth(sw);
      const x = lerp(A[o], B[o], k), y = lerp(A[o + 1], B[o + 1], k), z = lerp(A[o + 2], B[o + 2], k), c = lerp(A[o + 3], B[o + 3], k);
      const xr = x * cyw + z * syw, zr = -x * syw + z * cyw, pers = 3.6 / (3.6 - zr * .8);
      const px = cx + xr * ppx * pers * .9, py = cy - y * ppx * pers * .9;
      const st = pal[Math.round(s.cur)][Math.min(4, Math.floor(c * 4.99))];
      ctx.fillStyle = `rgba(${(st[0] * 255) | 0},${(st[1] * 255) | 0},${(st[2] * 255) | 0},${dark ? .55 : .7})`;
      ctx.fillRect(px, py, 2 * this.d, 2 * this.d);
    }
  }
  destroy() { this.stop(); }
}

export function createHero(canvas, opts) {
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 720;
  const count = (opts && opts.count) || (coarse ? 42000 : (navigator.hardwareConcurrency || 4) <= 4 ? 70000 : 110000);
  const hero = new Hero(canvas, Object.assign({}, opts, { count }));
  if (hero.ok) return hero;
  // a canvas that already handed out a webgl context cannot give a 2d one → swap in a fresh element
  const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh);
  return new Hero2D(fresh, opts);
}
export const SCENE_COUNT = NS;
