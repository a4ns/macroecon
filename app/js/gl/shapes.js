/* Seven point-cloud "scenes" for the hero — each one is a macroeconomic figure.
   A generator fills n points as (x, y, z, c): position in scene space + palette coordinate c∈[0,1]. */
import { rng } from '../core/dom.js';

const TAU = Math.PI * 2;

function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

/** 3D value noise (cheap, for continents) */
function makeNoise(seed) {
  const r = rng(seed), P = new Uint8Array(512), G = [];
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const hash = (x, y, z) => P[P[P[x & 255] + (y & 255)] + (z & 255)] / 255;
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf), yf),
      l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  };
}

/** helper: run `count` iterations writing into out */
function run(out, at, count, fn) {
  for (let i = 0; i < count; i++) { const o = (at + i) * 4; fn(i, count, out, o); }
  return at + count;
}
const split = (n, parts) => { const t = parts.reduce((a, b) => a + b, 0); let acc = 0; return parts.map((p, i) => { const k = i === parts.length - 1 ? n - acc : Math.round((n * p) / t); acc += k; return k; }); };

/* ── 0 · Кругооборот: two counter-rotating rings + four agents ─ */
function flow(n, seed) {
  const r = rng(seed), out = new Float32Array(n * 4);
  const tilt = -0.92; // rings lie roughly in XZ, tilted toward the viewer
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const put = (o, x, y, z, c) => { out[o] = x; out[o + 1] = y * ct - z * st; out[o + 2] = y * st + z * ct; out[o + 3] = c; };
  const [a, b, nodes, dust] = split(n, [.40, .30, .22, .08]);
  let at = 0;
  at = run(out, at, a, (i, N, o4, o) => { const t = r() * TAU, rad = 1.22 + gauss(r) * .035, w = gauss(r) * .028; put(o, Math.cos(t) * rad * 1.22, w, Math.sin(t) * rad * .78, .02 + r() * .1); });
  at = run(out, at, b, (i, N, o4, o) => { const t = r() * TAU, rad = .80 + gauss(r) * .03, w = gauss(r) * .026; put(o, Math.cos(t) * rad * 1.22, w, Math.sin(t) * rad * .78, .46 + r() * .1); });
  // four agents: households (left), firms (right), goods & factor markets (back/front)
  const ang = [Math.PI, 0, Math.PI * 1.5, Math.PI * .5];
  at = run(out, at, nodes, (i, N, o4, o) => {
    const k = i % 4, t = ang[k], rad = 1.0 + (k > 1 ? 0 : 0.0), s = k < 2 ? .13 : .09;
    const cx = Math.cos(t) * 1.02 * 1.22 * 1.0, cz = Math.sin(t) * 1.02 * .78;
    // dense gaussian ball
    put(o, cx + gauss(r) * s, gauss(r) * s, cz + gauss(r) * s, .86 + r() * .14);
  });
  at = run(out, at, dust, (i, N, o4, o) => { const t = r() * TAU, rad = Math.sqrt(r()) * 1.7; put(o, Math.cos(t) * rad * 1.22, gauss(r) * .3, Math.sin(t) * rad * .78, .3 + r() * .3); });
  return out;
}

/* ── 1 · ВВП: quarterly columns growing with the economy ────── */
function gdp(n, seed) {
  const r = rng(seed + 11), out = new Float32Array(n * 4);
  const cols = 15, x0 = -1.62, x1 = 1.62, base = -.78;
  const heights = []; let lvl = .22;
  for (let i = 0; i < cols; i++) { lvl += .052 + gauss(r) * .028 + (i % 4 === 3 ? -.03 : .015); heights.push(Math.max(.12, lvl)); }
  const [fill, caps, ground, trend] = split(n, [.66, .12, .10, .12]);
  let at = 0;
  at = run(out, at, fill, (i, N, o4, o) => {
    const k = (r() * cols) | 0, h = heights[k] * 1.55, x = x0 + (x1 - x0) * (k / (cols - 1));
    const v = r(); const y = base + v * h;
    // denser near the skin of the column → reads as a glass pillar
    const side = r() < .55; let px = (r() - .5) * .14, pz = (r() - .5) * .14;
    if (side) { if (r() < .5) px = Math.sign(px || 1) * .07; else pz = Math.sign(pz || 1) * .07; }
    out[o] = x + px; out[o + 1] = y; out[o + 2] = pz; out[o + 3] = Math.min(1, .05 + v * .8 * (heights[k] / .9) + r() * .05);
  });
  at = run(out, at, caps, (i, N, o4, o) => { const k = (r() * cols) | 0, h = heights[k] * 1.55, x = x0 + (x1 - x0) * (k / (cols - 1)); out[o] = x + (r() - .5) * .18; out[o + 1] = base + h + gauss(r) * .012; out[o + 2] = (r() - .5) * .18; out[o + 3] = 1; });
  at = run(out, at, ground, (i, N, o4, o) => { out[o] = x0 - .2 + r() * (x1 - x0 + .4); out[o + 1] = base - .01; out[o + 2] = (r() - .5) * .9; out[o + 3] = .42 + r() * .04; });
  at = run(out, at, trend, (i, N, o4, o) => { const u = r(); const k = u * (cols - 1), i0 = Math.floor(k), f = k - i0, hh = heights[i0] * (1 - f) + heights[Math.min(cols - 1, i0 + 1)] * f; out[o] = x0 + (x1 - x0) * u; out[o + 1] = base + hh * 1.55 + .22 + gauss(r) * .01; out[o + 2] = gauss(r) * .02 - .2; out[o + 3] = .72; });
  return out;
}

/* ── 2 · Рост: f(k), s·f(k) and δk — the Solow steady state ─── */
function growth(n, seed) {
  const r = rng(seed + 23), out = new Float32Array(n * 4);
  const X0 = -1.55, X1 = 1.55, Y0 = -.86, YH = 1.72;
  const f = (t) => 1 - Math.exp(-2.2 * t);                 // concave production, 0..1
  const sf = (t) => .55 * f(t), dk = (t) => .34 * t * 1.25;
  // steady state: sf(t)=dk(t)
  let ts = .5; for (let i = 0; i < 40; i++) { const g = sf(ts) - dk(ts), d = (.55 * 2.2 * Math.exp(-2.2 * ts)) - .425; ts -= g / d; } ts = Math.max(.2, Math.min(.95, ts));
  const PX = (t) => X0 + (X1 - X0) * t, PY = (v) => Y0 + YH * v;
  const [axes, c1, c2, c3, knot, rays, dust] = split(n, [.09, .22, .18, .14, .09, .06, .22]);
  let at = 0;
  at = run(out, at, axes, (i, N, o4, o) => { const a = r() < .5; if (a) { out[o] = X0 + r() * (X1 - X0 + .12); out[o + 1] = Y0 + gauss(r) * .006; } else { out[o] = X0 + gauss(r) * .006; out[o + 1] = Y0 + r() * (YH + .12); } out[o + 2] = gauss(r) * .01; out[o + 3] = .52; });
  const curve = (cnt, g, c, w) => { at = run(out, at, cnt, (i, N, o4, o) => { const t = Math.pow(r(), .9); const a = r() * TAU, rad = Math.abs(gauss(r)) * w; out[o] = PX(t) + Math.cos(a) * rad * .4; out[o + 1] = PY(g(t)) + Math.sin(a) * rad; out[o + 2] = Math.cos(a * 1.3) * rad; out[o + 3] = c + r() * .05; }); };
  curve(c1, f, .0, .028); curve(c2, sf, .5, .024); curve(c3, dk, .74, .02);
  const kx = PX(ts), ky = PY(sf(ts));
  at = run(out, at, knot, (i, N, o4, o) => { out[o] = kx + gauss(r) * .055; out[o + 1] = ky + gauss(r) * .055; out[o + 2] = gauss(r) * .055; out[o + 3] = 1; });
  at = run(out, at, rays, (i, N, o4, o) => { // dashed drop-lines to axes
    const d = r() < .5; const u = r(); if (d) { out[o] = kx; out[o + 1] = ky + (Y0 - ky) * u; } else { out[o] = kx + (X0 - kx) * u; out[o + 1] = ky; }
    out[o + 2] = gauss(r) * .006; out[o + 3] = Math.sin(u * 60) > 0 ? .62 : 0.0; if (out[o + 3] === 0) { out[o + 3] = .5; }
  });
  at = run(out, at, dust, (i, N, o4, o) => { const t = r(); const g = f(t) * r(); out[o] = PX(t) + gauss(r) * .02; out[o + 1] = PY(g * .96); out[o + 2] = gauss(r) * .22; out[o + 3] = .5 - r() * .15; });
  return out;
}

/* ── 3 · Цикл: potential output and the business-cycle wave ─── */
function cycle(n, seed) {
  const r = rng(seed + 37), out = new Float32Array(n * 4);
  const X0 = -1.65, X1 = 1.65;
  const pot = (x) => -.42 + (x - X0) * .28;
  const act = (x) => { const u = (x - X0) / (X1 - X0); return pot(x) + .4 * Math.sin(u * TAU * 2.05 + .5) * (.78 + .3 * Math.sin(u * 3.1 + 1)); };
  const [potN, actN, hatch, marks, dust] = split(n, [.14, .30, .34, .04, .18]);
  let at = 0;
  at = run(out, at, potN, (i, N, o4, o) => { const x = X0 + r() * (X1 - X0); out[o] = x; out[o + 1] = pot(x) + gauss(r) * .012; out[o + 2] = gauss(r) * .03 - .12; out[o + 3] = .5; });
  at = run(out, at, actN, (i, N, o4, o) => { const x = X0 + r() * (X1 - X0); const a = r() * TAU, rad = Math.abs(gauss(r)) * .028; out[o] = x; out[o + 1] = act(x) + Math.sin(a) * rad; out[o + 2] = Math.cos(a) * rad; out[o + 3] = r() * .05; });
  at = run(out, at, hatch, (i, N, o4, o) => { const x = X0 + r() * (X1 - X0); const p = pot(x), a = act(x), t = r(); out[o] = x; out[o + 1] = p + (a - p) * t; out[o + 2] = gauss(r) * .06; out[o + 3] = a >= p ? .74 + r() * .04 : .24 + r() * .04; });
  at = run(out, at, marks, (i, N, o4, o) => { const k = (r() * 4) | 0; const u = (k + .5) / 2.05 * .49 + .08; const x = X0 + (X1 - X0) * (((k * .5 + .13) / 2.05) + .02 + .0); const y0 = -.95, y1 = act(x); out[o] = x; out[o + 1] = y0 + (y1 - y0) * r(); out[o + 2] = gauss(r) * .01; out[o + 3] = 1; });
  at = run(out, at, dust, (i, N, o4, o) => { const x = X0 + r() * (X1 - X0); out[o] = x; out[o + 1] = pot(x) + gauss(r) * .5; out[o + 2] = gauss(r) * .32; out[o + 3] = .5 + (r() - .5) * .3; });
  return out;
}

/* ── 4 · Мультипликатор: a geometric spiral 1 + c + c² + … ──── */
function multiplier(n, seed) {
  const r = rng(seed + 53), out = new Float32Array(n * 4);
  const tilt = -1.12, ct = Math.cos(tilt), st = Math.sin(tilt);
  const arms = 3, turns = 3.4, c = .72;
  const [spi, core, halo] = split(n, [.78, .08, .14]);
  let at = 0;
  at = run(out, at, spi, (i, N, o4, o) => {
    const k = (r() * arms) | 0, u = Math.pow(r(), .8), th = u * turns * TAU + (k * TAU) / arms;
    const rad = 1.38 * Math.pow(c, u * turns * 1.6) + .03, w = .022 + rad * .07;
    const a = r() * TAU, q = Math.abs(gauss(r)) * w;
    const x = Math.cos(th) * rad + Math.cos(a) * q, z = Math.sin(th) * rad + Math.sin(a) * q, y = gauss(r) * w * .7 - .22 * (1 - rad / 1.4);
    out[o] = x * 1.12; out[o + 1] = y * ct - z * st * .88; out[o + 2] = y * st + z * ct; out[o + 3] = Math.min(1, u * 1.15);
  });
  at = run(out, at, core, (i, N, o4, o) => { const x = gauss(r) * .09, y = gauss(r) * .09, z = gauss(r) * .09; out[o] = x; out[o + 1] = y * ct - z * st; out[o + 2] = y * st + z * ct; out[o + 3] = 1; });
  at = run(out, at, halo, (i, N, o4, o) => { const th = r() * TAU, rad = Math.sqrt(r()) * 1.7; const x = Math.cos(th) * rad, z = Math.sin(th) * rad, y = gauss(r) * .28; out[o] = x * 1.12; out[o + 1] = y * ct - z * st * .88; out[o + 2] = y * st + z * ct; out[o + 3] = .3 + r() * .25; });
  return out;
}

/* ── 5 · IS–LM: two curves, one equilibrium, a burst of light ─ */
function islm(n, seed) {
  const r = rng(seed + 71), out = new Float32Array(n * 4);
  const X0 = -1.45, X1 = 1.45, Y0 = -.88, Y1 = .9;
  const IS = (t) => Y1 - .05 - (Y1 - Y0 - .16) * (1 - Math.exp(-1.7 * t)) / (1 - Math.exp(-1.7));          // falling, convex
  const LM = (t) => Y0 + .12 + (Y1 - Y0 - .24) * (Math.exp(1.55 * t) - 1) / (Math.exp(1.55) - 1);             // rising, convex
  let te = .5; for (let i = 0; i < 50; i++) { const g = IS(te) - LM(te); const d = (IS(te + 1e-3) - LM(te + 1e-3) - g) / 1e-3; te -= g / d; } te = Math.max(.2, Math.min(.8, te));
  const PX = (t) => X0 + (X1 - X0) * t;
  const ex = PX(te), ey = IS(te);
  const [axes, isN, lmN, knot, burst, guides, dust] = split(n, [.08, .2, .2, .1, .14, .04, .24]);
  let at = 0;
  at = run(out, at, axes, (i, N, o4, o) => { if (r() < .5) { out[o] = X0 + r() * (X1 - X0 + .1); out[o + 1] = Y0 + gauss(r) * .006; } else { out[o] = X0 + gauss(r) * .006; out[o + 1] = Y0 + r() * (Y1 - Y0 + .1); } out[o + 2] = gauss(r) * .01; out[o + 3] = .52; });
  const curve = (cnt, g, c) => { at = run(out, at, cnt, (i, N, o4, o) => { const t = r(); const a = r() * TAU, q = Math.abs(gauss(r)) * .03; out[o] = PX(t) + Math.cos(a) * q * .4; out[o + 1] = g(t) + Math.sin(a) * q; out[o + 2] = Math.cos(a) * q; out[o + 3] = c + r() * .04; }); };
  curve(isN, IS, .25); curve(lmN, LM, .0);
  at = run(out, at, knot, (i, N, o4, o) => { out[o] = ex + gauss(r) * .05; out[o + 1] = ey + gauss(r) * .05; out[o + 2] = gauss(r) * .05; out[o + 3] = 1; });
  at = run(out, at, burst, (i, N, o4, o) => { const a = r() * TAU, d = Math.pow(r(), 1.9) * .75, ph = Math.cos(a * 6) * .3; const rr = d * (1 + ph * .4); out[o] = ex + Math.cos(a) * rr; out[o + 1] = ey + Math.sin(a) * rr; out[o + 2] = gauss(r) * .08 * (1 - d); out[o + 3] = .96 - d * .3; });
  at = run(out, at, guides, (i, N, o4, o) => { const u = r(); const v = r() < .5; if (v) { out[o] = ex; out[o + 1] = ey + (Y0 - ey) * u; } else { out[o] = ex + (X0 - ex) * u; out[o + 1] = ey; } out[o + 2] = gauss(r) * .006; out[o + 3] = .76; });
  at = run(out, at, dust, (i, N, o4, o) => { const t = r(); out[o] = PX(t) + gauss(r) * .08; out[o + 1] = Y0 + (Y1 - Y0) * r(); out[o + 2] = gauss(r) * .25; out[o + 3] = .5 + (r() - .5) * .2; });
  return out;
}

/* ── 6 · Открытая экономика: a globe with trade arcs ────────── */
function globe(n, seed) {
  const r = rng(seed + 97), out = new Float32Array(n * 4), noise = makeNoise(seed + 5);
  const R0 = .98, tilt = .42, ct = Math.cos(tilt), st = Math.sin(tilt);
  const land = (x, y, z) => { const v = noise(x * 1.7 + 7, y * 1.7 + 3, z * 1.7 + 1) * .62 + noise(x * 3.6, y * 3.6 + 9, z * 3.6) * .28 + noise(x * 7.5 + 3, y * 7.5, z * 7.5) * .1; return v; };
  const sphPoint = () => { const u = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - u * u); return [s * Math.cos(t), u, s * Math.sin(t)]; };
  const rot = (x, y, z) => [x, y * ct - z * st, y * st + z * ct];
  const [ocean, cont, arcs, halo] = split(n, [.26, .38, .24, .12]);
  // city nodes on land
  const cities = []; let guard = 0;
  while (cities.length < 16 && guard++ < 4000) { const p = sphPoint(); if (land(p[0], p[1], p[2]) > .58) cities.push(p); }
  let at = 0;
  at = run(out, at, ocean, (i, N, o4, o) => { const p = sphPoint(); const q = rot(p[0] * R0, p[1] * R0, p[2] * R0); out[o] = q[0]; out[o + 1] = q[1]; out[o + 2] = q[2]; out[o + 3] = .5; });
  at = run(out, at, cont, (i, N, o4, o) => { let p, g = 0; do { p = sphPoint(); } while (land(p[0], p[1], p[2]) < .56 && g++ < 60); const q = rot(p[0] * R0, p[1] * R0, p[2] * R0); out[o] = q[0]; out[o + 1] = q[1]; out[o + 2] = q[2]; out[o + 3] = .05 + land(p[0], p[1], p[2]) * .22 + r() * .05; });
  at = run(out, at, arcs, (i, N, o4, o) => {
    const a = cities[(r() * cities.length) | 0]; let b = cities[(r() * cities.length) | 0]; if (b === a) b = cities[(cities.indexOf(a) + 3) % cities.length];
    const t = r(), dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], om = Math.acos(Math.max(-1, Math.min(1, dot))), so = Math.sin(om) || 1;
    const k1 = Math.sin((1 - t) * om) / so, k2 = Math.sin(t * om) / so; let x = a[0] * k1 + b[0] * k2, y = a[1] * k1 + b[1] * k2, z = a[2] * k1 + b[2] * k2;
    const lift = 1 + Math.sin(Math.PI * t) * (.1 + om * .16) + gauss(r) * .004, w = .006;
    const q = rot(x * R0 * lift + gauss(r) * w, y * R0 * lift + gauss(r) * w, z * R0 * lift + gauss(r) * w); out[o] = q[0]; out[o + 1] = q[1]; out[o + 2] = q[2]; out[o + 3] = .72 + r() * .28;
  });
  at = run(out, at, halo, (i, N, o4, o) => { const p = sphPoint(); const rr = R0 * (1.08 + Math.pow(r(), 2.2) * .55); const q = rot(p[0] * rr, p[1] * rr, p[2] * rr); out[o] = q[0]; out[o + 1] = q[1]; out[o + 2] = q[2]; out[o + 3] = .5 + (r() - .5) * .16; });
  return out;
}

export const SCENES = [
  { id: 'flow', gen: flow },
  { id: 'gdp', gen: gdp },
  { id: 'growth', gen: growth },
  { id: 'cycle', gen: cycle },
  { id: 'multiplier', gen: multiplier },
  { id: 'islm', gen: islm },
  { id: 'globe', gen: globe },
];

export function generateAll(n, seed = 7) { return SCENES.map((s) => s.gen(n, seed)); }
