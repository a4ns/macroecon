/* ─────────────────────────────────────────────────────────────
   mx-plot — tiny SVG chart engine for the lab simulators.

   const chart = createChart(hostEl, {
     x: { min: 0, max: 100, label: 'Y', ticks: 6, fmt: v => v, grid: true, arrow: true, hideTicks: false },
     y: { min: 0, max: 100, label: 'E', ... },
     aspect: 1.35,            // height = width / aspect   (or  height: 420)
     margin: { l: 56, r: 26, t: 22, b: 46 },
   });

   chart.line('IS', { fn: x => 900 - 40 * x, from: 0, to: 20, color: 'var(--d2)', width: 3, label: 'IS', labelAt: .92, labelDx: 8, labelDy: -8, ghost: true })
   chart.line('pts', { pts: [[0,0],[1,2]] })          // polyline through data
   chart.area('gap', { fn: f1, fn2: f2, color: 'var(--d3)', opacity: .18 })   // between two curves (fn2 omitted → y = 0 / bottom)
   chart.point('E', { x: 10, y: 20, color: 'var(--accent)', label: 'E', guides: { x: 'Y*', y: 'r*' }, pulse: true })
   chart.vline('Yf', { x: 50, label: 'Yf', dash: '4 4' }) · chart.hline(...)
   chart.arrow('shift', { from: [x,y], to: [x,y], color })
   chart.text('t', { x, y, text: 'AD_1', dx, dy, anchor: 'start' })
   chart.bars('b', { data: [{ x, y, color, label }], width: 0.8 })

   // change model state, then:
   chart.update();              // every element recomputes from its closure and eases to the new shape
   chart.snapshot('до');         // freeze current lines as faded dashed "ghosts" (before / after comparisons)
   chart.clearGhosts();
   chart.setDomain({ x: [0, 200], y: [0, 100] });
   chart.toPNG().then(blob => …)
   chart.destroy();
   ───────────────────────────────────────────────────────────── */
import { h, s, clamp, lerp } from '../core/dom.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

/** nice tick values (1-2-5) */
export function niceTicks(min, max, count = 6) {
  const span = max - min; if (!(span > 0)) return [min];
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag; const step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
  const out = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : +v.toFixed(10));
  return out;
}

const fmtTick = (v) => { const a = Math.abs(v); if (a >= 1e4) return (v / 1e3).toLocaleString('ru-RU') + 'k'; return (Math.round(v * 1e6) / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 6 }); };

/** write "Y_1", "r^*", "M/P", "Y_{f}" as italic text with tspans */
export function mathText(node, str, opts = {}) {
  node.textContent = '';
  const parts = String(str).split(/(_\{[^}]*\}|_[^\s_^{]|\^\{[^}]*\}|\^[^\s_^{])/g).filter((p) => p !== '');
  for (const p of parts) {
    if (p[0] === '_' || p[0] === '^') {
      const t = el('tspan', { 'font-size': '72%', dy: p[0] === '_' ? '.32em' : '-.42em', 'font-style': 'normal' }, node);
      t.textContent = p.slice(1).replace(/^\{|\}$/g, '');
      // reset baseline after the sub/sup run
      const back = el('tspan', { dy: p[0] === '_' ? '-.32em' : '.42em' }, node); back.textContent = '​';
    } else { const t = el('tspan', {}, node); t.textContent = p; }
  }
  return node;
}

export function createChart(host, opts = {}) {
  const o = Object.assign({ aspect: 1.5, margin: { l: 58, r: 28, t: 24, b: 48 }, grid: true, minH: 260 }, opts);
  const X = Object.assign({ min: 0, max: 100, label: '', ticks: 6, grid: true, fmt: fmtTick, arrow: true, hideTicks: false, sub: '' }, o.x);
  const Y = Object.assign({ min: 0, max: 100, label: '', ticks: 6, grid: true, fmt: fmtTick, arrow: true, hideTicks: false, sub: '' }, o.y);
  const M = Object.assign({ l: 58, r: 28, t: 24, b: 48 }, o.margin);

  const svg = el('svg', { class: 'mxp', role: 'img', 'aria-label': o.title || 'График', xmlns: NS });
  svg.style.cssText = 'display:block;width:100%;overflow:visible;touch-action:pan-y';
  const defs = el('defs', {}, svg);
  const uid = 'p' + Math.random().toString(36).slice(2, 7);
  const clip = el('clipPath', { id: uid + 'c' }, defs); const clipRect = el('rect', {}, clip);
  const glow = el('filter', { id: uid + 'g', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  el('feGaussianBlur', { stdDeviation: '3.2' }, glow);
  const L = {}; ['grid', 'axes', 'areas', 'ghosts', 'lines', 'guides', 'pts', 'labels', 'hover'].forEach((k) => (L[k] = el('g', { class: 'L-' + k }, svg)));
  L.areas.setAttribute('clip-path', `url(#${uid}c)`); L.lines.setAttribute('clip-path', `url(#${uid}c)`); L.ghosts.setAttribute('clip-path', `url(#${uid}c)`);
  host.append(svg);

  let W = 600, H = 400, innerW = 0, innerH = 0;
  const els = new Map();
  let raf = 0, last = 0;
  const sx = (v) => M.l + ((v - X.min) / (X.max - X.min)) * innerW;
  const sy = (v) => M.t + innerH - ((v - Y.min) / (Y.max - Y.min)) * innerH;
  const ix = (px) => X.min + ((px - M.l) / innerW) * (X.max - X.min);
  const iy = (py) => Y.min + ((M.t + innerH - py) / innerH) * (Y.max - Y.min);

  /* axes + grid ------------------------------------------------ */
  function drawAxes() {
    L.grid.textContent = ''; L.axes.textContent = '';
    const tx = Array.isArray(X.ticks) ? X.ticks : (X.ticks ? niceTicks(X.min, X.max, X.ticks) : []);
    const ty = Array.isArray(Y.ticks) ? Y.ticks : (Y.ticks ? niceTicks(Y.min, Y.max, Y.ticks) : []);
    if (o.grid) {
      if (X.grid) tx.forEach((v) => { if (v > X.min + 1e-9 && v < X.max) el('line', { x1: sx(v), x2: sx(v), y1: M.t, y2: M.t + innerH, class: 'gl' }, L.grid); });
      if (Y.grid) ty.forEach((v) => { if (v > Y.min + 1e-9 && v < Y.max) el('line', { y1: sy(v), y2: sy(v), x1: M.l, x2: M.l + innerW, class: 'gl' }, L.grid); });
    }
    const x0 = M.l, y0 = M.t + innerH;
    el('line', { x1: x0, y1: y0, x2: x0 + innerW + (X.arrow ? 10 : 0), y2: y0, class: 'ax' }, L.axes);
    el('line', { x1: x0, y1: y0, x2: x0, y2: M.t - (Y.arrow ? 10 : 0), class: 'ax' }, L.axes);
    if (X.arrow) el('path', { d: `M${x0 + innerW + 10},${y0} l-7,-3.6 l0,7.2 z`, class: 'axh' }, L.axes);
    if (Y.arrow) el('path', { d: `M${x0},${M.t - 10} l-3.6,7 l7.2,0 z`, class: 'axh' }, L.axes);
    if (!X.hideTicks) tx.forEach((v) => { el('line', { x1: sx(v), x2: sx(v), y1: y0, y2: y0 + 5, class: 'ax' }, L.axes); const t = el('text', { x: sx(v), y: y0 + 19, 'text-anchor': 'middle', class: 'tk' }, L.axes); t.textContent = X.fmt(v); });
    if (!Y.hideTicks) ty.forEach((v) => { el('line', { x1: x0 - 5, x2: x0, y1: sy(v), y2: sy(v), class: 'ax' }, L.axes); const t = el('text', { x: x0 - 9, y: sy(v) + 4, 'text-anchor': 'end', class: 'tk' }, L.axes); t.textContent = Y.fmt(v); });
    if (X.label) { const t = el('text', { x: x0 + innerW + (X.arrow ? 10 : 2), y: y0 + (X.hideTicks ? 20 : 34), 'text-anchor': 'end', class: 'axl' }, L.axes); mathText(t, X.label); }
    if (Y.label) { const t = el('text', { x: x0 + 10, y: M.t - (Y.arrow ? 14 : 8), 'text-anchor': 'start', class: 'axl' }, L.axes); mathText(t, Y.label); }
  }

  /* layout ----------------------------------------------------- */
  function layout() {
    const w = Math.max(240, host.clientWidth || 600);
    const hh = o.height ? o.height : Math.max(o.minH, Math.round(w / o.aspect));
    W = w; H = hh; innerW = W - M.l - M.r; innerH = H - M.t - M.b;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
    clipRect.setAttribute('x', M.l - 1); clipRect.setAttribute('y', M.t - 2); clipRect.setAttribute('width', innerW + 2); clipRect.setAttribute('height', innerH + 4);
    drawAxes();
    els.forEach((e) => e.resize && e.resize());
    paintAll();
  }

  /* element model ---------------------------------------------- */
  const SAMPLES = 96;
  function sample(fn, from, to, n) { const a = new Float64Array(n); for (let i = 0; i < n; i++) { const xv = from + ((to - from) * i) / (n - 1); const yv = fn(xv); a[i] = Number.isFinite(yv) ? yv : NaN; } return a; }
  const pathFromYs = (xs0, xs1, ys, n) => { let d = '', pen = false; for (let i = 0; i < n; i++) { const xv = xs0 + ((xs1 - xs0) * i) / (n - 1); const yv = ys[i]; if (!Number.isFinite(yv)) { pen = false; continue; } d += (pen ? 'L' : 'M') + sx(xv).toFixed(1) + ',' + sy(yv).toFixed(1); pen = true; } return d; };

  function addEl(id, kind, e) { if (els.has(id)) remove(id); e.id = id; e.kind = kind; els.set(id, e); start(); return api; }
  function remove(id) { const e = els.get(id); if (!e) return api; e.nodes && e.nodes.forEach((n) => n.remove()); els.delete(id); return api; }

  function line(id, p = {}) {
    const op = Object.assign({ color: 'var(--accent)', width: 3, from: X.min, to: X.max, samples: 0, labelAt: .96, labelDx: 6, labelDy: -8, glow: true, ghost: true, z: 0 }, p);
    const node = el('path', { class: 'ln', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, L.lines);
    const halo = op.glow ? el('path', { class: 'ln-halo', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: `url(#${uid}g)` }, L.lines) : null;
    if (halo) L.lines.insertBefore(halo, node);
    const lab = op.label ? el('text', { class: 'lab', 'text-anchor': op.labelAnchor || 'start' }, L.labels) : null;
    if (lab) mathText(lab, op.label);
    const e = {
      op, nodes: [node, halo, lab].filter(Boolean), node, halo, lab, ys: null, tgt: null, n: 0,
      compute() {
        const n = op.pts ? op.pts.length : (op.samples || (op.fn && op.fn.linear ? 2 : SAMPLES)); const from = op.from, to = op.to;
        if (op.pts) return { kind: 'pts', v: Float64Array.from(op.pts.flatMap((q) => [q[0], q[1]])), n };
        return { kind: 'fn', v: sample(op.fn, from, to, n), n, from, to };
      },
      sync(jump) {
        const t = e.compute(); e.tgt = t;
        if (!e.cur || e.cur.n !== t.n || e.cur.kind !== t.kind || jump) e.cur = { kind: t.kind, v: Float64Array.from(t.v), n: t.n, from: t.from, to: t.to };
        else { e.cur.from = t.from; e.cur.to = t.to; }
      },
      step(k) { let moving = false; const c = e.cur, t = e.tgt; for (let i = 0; i < c.v.length; i++) { const a = c.v[i], b = t.v[i]; if (!Number.isFinite(b)) { c.v[i] = b; continue; } if (!Number.isFinite(a)) { c.v[i] = b; continue; } const d = b - a; if (Math.abs(d) > 1e-4 * (Math.abs(b) + 1)) { c.v[i] = a + d * k; moving = true; } else c.v[i] = b; } return moving; },
      paint() {
        const c = e.cur; let d = '';
        if (c.kind === 'pts') { for (let i = 0; i < c.n; i++) d += (i ? 'L' : 'M') + sx(c.v[2 * i]).toFixed(1) + ',' + sy(c.v[2 * i + 1]).toFixed(1); }
        else d = pathFromYs(c.from, c.to, c.v, c.n);
        node.setAttribute('d', d); if (halo) halo.setAttribute('d', d);
        node.setAttribute('stroke', op.color); node.setAttribute('stroke-width', op.width); if (op.dash) node.setAttribute('stroke-dasharray', op.dash);
        if (halo) { halo.setAttribute('stroke', op.color); halo.setAttribute('stroke-width', op.width + 3); halo.setAttribute('opacity', .55); }
        if (lab) {
          let xv, yv;
          if (c.kind === 'fn') { const i = Math.round(clamp(op.labelAt, 0, 1) * (c.n - 1)); xv = c.from + ((c.to - c.from) * i) / (c.n - 1); yv = c.v[i]; }
          else { const i = Math.round(clamp(op.labelAt, 0, 1) * (c.n - 1)); xv = c.v[2 * i]; yv = c.v[2 * i + 1]; }
          if (Number.isFinite(yv)) { lab.setAttribute('x', sx(xv) + op.labelDx); lab.setAttribute('y', sy(yv) + op.labelDy); lab.setAttribute('fill', op.color); lab.style.opacity = 1; } else lab.style.opacity = 0;
        }
      },
      ghostPath() { return node.getAttribute('d'); },
    };
    e.sync(true); e.paint();
    return addEl(id, 'line', e);
  }

  function area(id, p = {}) {
    const op = Object.assign({ color: 'var(--accent)', opacity: .16, from: X.min, to: X.max, samples: SAMPLES, baseline: null }, p);
    const node = el('path', { class: 'ar' }, L.areas);
    const e = {
      op, nodes: [node], cur: null, tgt: null,
      compute() { const n = op.samples; const a = sample(op.fn, op.from, op.to, n); const b = op.fn2 ? sample(op.fn2, op.from, op.to, n) : new Float64Array(n).fill(op.baseline == null ? Y.min : op.baseline); const v = new Float64Array(2 * n); v.set(a, 0); v.set(b, n); return { v, n, from: op.from, to: op.to }; },
      sync(jump) { const t = e.compute(); e.tgt = t; if (!e.cur || e.cur.n !== t.n || jump) e.cur = { v: Float64Array.from(t.v), n: t.n, from: t.from, to: t.to }; else { e.cur.from = t.from; e.cur.to = t.to; } },
      step(k) { let mv = false; const c = e.cur, t = e.tgt; for (let i = 0; i < c.v.length; i++) { const a = c.v[i], b = t.v[i]; const d = b - a; if (Number.isFinite(d) && Math.abs(d) > 1e-4 * (Math.abs(b) + 1)) { c.v[i] = a + d * k; mv = true; } else c.v[i] = b; } return mv; },
      paint() { const c = e.cur, n = c.n; let d = ''; for (let i = 0; i < n; i++) { const xv = c.from + ((c.to - c.from) * i) / (n - 1); d += (i ? 'L' : 'M') + sx(xv).toFixed(1) + ',' + sy(c.v[i]).toFixed(1); } for (let i = n - 1; i >= 0; i--) { const xv = c.from + ((c.to - c.from) * i) / (n - 1); d += 'L' + sx(xv).toFixed(1) + ',' + sy(c.v[n + i]).toFixed(1); } node.setAttribute('d', d + 'Z'); node.setAttribute('fill', op.color); node.setAttribute('fill-opacity', op.opacity); },
    };
    e.sync(true); e.paint();
    return addEl(id, 'area', e);
  }

  function point(id, p = {}) {
    const op = Object.assign({ x: 0, y: 0, r: 6, color: 'var(--accent)', pulse: false, guides: null, label: '', labelDx: 10, labelDy: -10, draggable: null }, p);
    const g = el('g', { class: 'pt' }, L.pts);
    let gx = null, gy = null, gxl = null, gyl = null, pulse = null;
    if (op.guides) { gx = el('line', { class: 'gd' }, L.guides); gy = el('line', { class: 'gd' }, L.guides); if (op.guides.x) { gxl = el('text', { class: 'gdl', 'text-anchor': 'middle' }, L.labels); mathText(gxl, op.guides.x); } if (op.guides.y) { gyl = el('text', { class: 'gdl', 'text-anchor': 'end' }, L.labels); mathText(gyl, op.guides.y); } }
    if (op.pulse) pulse = el('circle', { class: 'pulse', r: op.r }, g);
    const dot = el('circle', { r: op.r, class: 'dot' }, g);
    const lab = op.label ? el('text', { class: 'lab', 'text-anchor': 'start' }, L.labels) : null; if (lab) mathText(lab, op.label);
    const e = {
      op, nodes: [g, gx, gy, gxl, gyl, lab].filter(Boolean), cur: null, tgt: null,
      compute() { return { x: typeof op.x === 'function' ? op.x() : op.x, y: typeof op.y === 'function' ? op.y() : op.y }; },
      sync(jump) { const t = e.compute(); e.tgt = t; if (!e.cur || jump) e.cur = { ...t }; },
      step(k) { const c = e.cur, t = e.tgt; let mv = false; for (const q of ['x', 'y']) { const d = t[q] - c[q]; if (Math.abs(d) > 1e-4 * (Math.abs(t[q]) + 1)) { c[q] += d * k; mv = true; } else c[q] = t[q]; } return mv; },
      paint() {
        const c = e.cur, px = sx(c.x), py = sy(c.y); g.setAttribute('transform', `translate(${px.toFixed(1)},${py.toFixed(1)})`);
        dot.setAttribute('fill', op.color); if (pulse) pulse.setAttribute('fill', op.color);
        if (gx) { gx.setAttribute('x1', px); gx.setAttribute('x2', px); gx.setAttribute('y1', py); gx.setAttribute('y2', M.t + innerH); gx.setAttribute('stroke', op.color); gy.setAttribute('x1', M.l); gy.setAttribute('x2', px); gy.setAttribute('y1', py); gy.setAttribute('y2', py); gy.setAttribute('stroke', op.color); }
        if (gxl) { gxl.setAttribute('x', px + 7); gxl.setAttribute('y', M.t + innerH - 8); gxl.setAttribute('text-anchor', 'start'); gxl.setAttribute('fill', op.color); }
        if (gyl) { gyl.setAttribute('x', M.l + 8); gyl.setAttribute('y', py - 8); gyl.setAttribute('text-anchor', 'start'); gyl.setAttribute('fill', op.color); }
        if (lab) { lab.setAttribute('x', px + op.labelDx); lab.setAttribute('y', py + op.labelDy); lab.setAttribute('fill', op.color); }
      },
    };
    if (op.draggable) {
      g.style.cursor = 'grab'; g.style.touchAction = 'none';
      const hit = el('circle', { r: Math.max(18, op.r + 10), fill: 'transparent' }, g);
      g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); g.setPointerCapture(ev.pointerId); g.style.cursor = 'grabbing';
        const mv = (m) => { const r = svg.getBoundingClientRect(); const px = (m.clientX - r.left) * (W / r.width), py = (m.clientY - r.top) * (H / r.height); op.draggable({ x: clamp(ix(px), X.min, X.max), y: clamp(iy(py), Y.min, Y.max) }); };
        const up = () => { g.style.cursor = 'grab'; g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
      });
    }
    e.sync(true); e.paint();
    return addEl(id, 'point', e);
  }

  function guideLine(id, p, vertical) {
    const op = Object.assign({ color: 'var(--ink-3)', dash: '5 5', width: 1.6, label: '', labelDx: 6, labelDy: -6 }, p);
    const node = el('line', { class: 'gl2' }, L.guides);
    const lab = op.label ? el('text', { class: 'lab', 'text-anchor': vertical ? 'middle' : 'end' }, L.labels) : null; if (lab) mathText(lab, op.label);
    const e = {
      op, nodes: [node, lab].filter(Boolean), cur: null, tgt: null,
      compute() { return { v: typeof op.v === 'function' ? op.v() : op.v, a: op.from != null ? op.from : (vertical ? Y.min : X.min), b: op.to != null ? op.to : (vertical ? Y.max : X.max) }; },
      sync(j) { const t = e.compute(); e.tgt = t; if (!e.cur || j) e.cur = { ...t }; },
      step(k) { let mv = false; for (const q of ['v', 'a', 'b']) { const d = e.tgt[q] - e.cur[q]; if (Math.abs(d) > 1e-4 * (Math.abs(e.tgt[q]) + 1)) { e.cur[q] += d * k; mv = true; } else e.cur[q] = e.tgt[q]; } return mv; },
      paint() {
        const c = e.cur; node.setAttribute('stroke', op.color); node.setAttribute('stroke-dasharray', op.dash || ''); node.setAttribute('stroke-width', op.width);
        if (vertical) { node.setAttribute('x1', sx(c.v)); node.setAttribute('x2', sx(c.v)); node.setAttribute('y1', sy(c.a)); node.setAttribute('y2', sy(c.b)); if (lab) { lab.setAttribute('x', sx(c.v) + op.labelDx); lab.setAttribute('y', M.t + innerH + 18); lab.setAttribute('fill', op.color); } }
        else { node.setAttribute('y1', sy(c.v)); node.setAttribute('y2', sy(c.v)); node.setAttribute('x1', sx(c.a)); node.setAttribute('x2', sx(c.b)); if (lab) { lab.setAttribute('x', M.l + innerW - 4); lab.setAttribute('y', sy(c.v) + op.labelDy); lab.setAttribute('fill', op.color); } }
      },
    };
    e.sync(true); e.paint();
    return addEl(id, vertical ? 'vline' : 'hline', e);
  }
  const vline = (id, p) => guideLine(id, Object.assign({}, p, { v: p.x }), true);
  const hline = (id, p) => guideLine(id, Object.assign({}, p, { v: p.y }), false);

  function text(id, p = {}) {
    const op = Object.assign({ x: 0, y: 0, text: '', dx: 0, dy: 0, anchor: 'start', color: 'var(--ink-2)', size: 14, cls: 'lab' }, p);
    const t = el('text', { class: op.cls, 'text-anchor': op.anchor }, L.labels); mathText(t, op.text); t.setAttribute('font-size', op.size);
    const e = { op, nodes: [t], cur: null, tgt: null,
      compute() { return { x: typeof op.x === 'function' ? op.x() : op.x, y: typeof op.y === 'function' ? op.y() : op.y }; },
      sync(j) { e.tgt = e.compute(); if (!e.cur || j) e.cur = { ...e.tgt }; },
      step(k) { let mv = false; for (const q of ['x', 'y']) { const d = e.tgt[q] - e.cur[q]; if (Math.abs(d) > 1e-4 * (Math.abs(e.tgt[q]) + 1)) { e.cur[q] += d * k; mv = true; } else e.cur[q] = e.tgt[q]; } return mv; },
      paint() { t.setAttribute('x', sx(e.cur.x) + op.dx); t.setAttribute('y', sy(e.cur.y) + op.dy); t.setAttribute('fill', op.color); },
      setText(s2) { mathText(t, s2); },
    };
    e.sync(true); e.paint();
    return addEl(id, 'text', e);
  }

  function arrow(id, p = {}) {
    const op = Object.assign({ color: 'var(--ink-2)', width: 2, from: [0, 0], to: [1, 1], head: 9 }, p);
    const ln = el('line', { class: 'arw' }, L.guides); const hd = el('path', { class: 'arh' }, L.guides);
    const e = { op, nodes: [ln, hd], cur: null, tgt: null,
      compute() { const f = typeof op.from === 'function' ? op.from() : op.from, t = typeof op.to === 'function' ? op.to() : op.to; return { a: f[0], b: f[1], c: t[0], d: t[1] }; },
      sync(j) { e.tgt = e.compute(); if (!e.cur || j) e.cur = { ...e.tgt }; },
      step(k) { let mv = false; for (const q of ['a', 'b', 'c', 'd']) { const d = e.tgt[q] - e.cur[q]; if (Math.abs(d) > 1e-4 * (Math.abs(e.tgt[q]) + 1)) { e.cur[q] += d * k; mv = true; } else e.cur[q] = e.tgt[q]; } return mv; },
      paint() { const c = e.cur; const x1 = sx(c.a), y1 = sy(c.b), x2 = sx(c.c), y2 = sy(c.d); const ang = Math.atan2(y2 - y1, x2 - x1), hs = op.head; const bx = x2 - Math.cos(ang) * hs * .7, by = y2 - Math.sin(ang) * hs * .7;
        ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', bx); ln.setAttribute('y2', by); ln.setAttribute('stroke', op.color); ln.setAttribute('stroke-width', op.width);
        hd.setAttribute('d', `M${x2},${y2} L${x2 - Math.cos(ang - .42) * hs},${y2 - Math.sin(ang - .42) * hs} L${x2 - Math.cos(ang + .42) * hs},${y2 - Math.sin(ang + .42) * hs}Z`); hd.setAttribute('fill', op.color); },
    };
    e.sync(true); e.paint();
    return addEl(id, 'arrow', e);
  }

  function bars(id, p = {}) {
    const op = Object.assign({ data: [], width: .7, color: 'var(--accent)', base: 0 }, p);
    const g = el('g', { class: 'bars' }, L.areas);
    const e = { op, nodes: [g], rects: [], cur: null, tgt: null,
      compute() { const d = typeof op.data === 'function' ? op.data() : op.data; return { d }; },
      sync(j) { const t = e.compute(); e.tgt = t; const same = e.cur && e.cur.d.length === t.d.length; if (!same || j) { e.cur = { d: t.d.map((q) => ({ ...q })) }; g.textContent = ''; e.rects = t.d.map(() => el('rect', { rx: 3 }, g)); } },
      step(k) { let mv = false; e.cur.d.forEach((c, i) => { const t = e.tgt.d[i]; for (const q of ['x', 'y']) { const d = t[q] - c[q]; if (Math.abs(d) > 1e-4 * (Math.abs(t[q]) + 1)) { c[q] += d * k; mv = true; } else c[q] = t[q]; } c.color = t.color; }); return mv; },
      paint() { e.cur.d.forEach((c, i) => { const r = e.rects[i]; const w = op.width * (innerW / Math.max(1, e.cur.d.length)) * .8; const y1 = sy(c.y), y0 = sy(op.base); r.setAttribute('x', sx(c.x) - w / 2); r.setAttribute('width', Math.max(0, w)); r.setAttribute('y', Math.min(y0, y1)); r.setAttribute('height', Math.abs(y0 - y1)); r.setAttribute('fill', c.color || op.color); r.setAttribute('fill-opacity', .86); }); },
    };
    e.sync(true); e.paint();
    return addEl(id, 'bars', e);
  }

  /* ghosts -------------------------------------------------- */
  const ghosts = [];
  function snapshot() {
    clearGhosts();
    els.forEach((e) => {
      if (e.kind !== 'line' || !e.op.ghost) return;
      const p = el('path', { d: e.ghostPath(), fill: 'none', stroke: e.op.color, 'stroke-width': Math.max(1.6, e.op.width - 1), 'stroke-dasharray': '6 6', opacity: .42, 'stroke-linecap': 'round', class: 'ghost' }, L.ghosts);
      ghosts.push(p);
    });
    return api;
  }
  function clearGhosts() { while (ghosts.length) ghosts.pop().remove(); return api; }
  function redrawGhosts() { /* ghosts are static paths in pixel space → re-snapshot not possible after resize; clear instead */ if (ghosts.length) clearGhosts(); }

  /* loop ----------------------------------------------------- */
  function paintAll() { els.forEach((e) => e.paint()); }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-(document.documentElement.classList.contains('reduce') ? 200 : 15) * dt);
    let mv = false; els.forEach((e) => { if (e.tgt && e.step(k)) mv = true; e.paint(); });
    raf = mv ? requestAnimationFrame(tick) : 0;
  }
  function update(id, jump) { const list = id ? [els.get(id)] : [...els.values()]; list.forEach((e) => e && e.sync && e.sync(jump)); start(); return api; }

  /* hover crosshair ------------------------------------------ */
  let hoverOn = false, hoverCb = null;
  const hv = { line: el('line', { class: 'gd', stroke: 'var(--ink-3)', 'stroke-dasharray': '3 4', opacity: 0 }, L.hover), dots: [] };
  function enableHover(cb) {
    hoverCb = cb; if (hoverOn) return api; hoverOn = true;
    svg.addEventListener('pointermove', (ev) => { const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (W / r.width); if (px < M.l || px > M.l + innerW) { hv.line.setAttribute('opacity', 0); hoverCb && hoverCb(null); return; } const xv = ix(px); hv.line.setAttribute('x1', px); hv.line.setAttribute('x2', px); hv.line.setAttribute('y1', M.t); hv.line.setAttribute('y2', M.t + innerH); hv.line.setAttribute('opacity', .8); hoverCb && hoverCb(xv, px, ev); });
    svg.addEventListener('pointerleave', () => { hv.line.setAttribute('opacity', 0); hoverCb && hoverCb(null); });
    return api;
  }

  /* export ---------------------------------------------------- */
  async function toPNG(scale = 2, bg) {
    const clone = svg.cloneNode(true); clone.setAttribute('width', W); clone.setAttribute('height', H);
    const cs = getComputedStyle(document.documentElement);
    const css = `.gl{stroke:${cs.getPropertyValue('--line').trim()};stroke-width:1}.ax{stroke:${cs.getPropertyValue('--line-3').trim()};stroke-width:1.4}.axh{fill:${cs.getPropertyValue('--line-3').trim()}}text{font-family:${cs.getPropertyValue('--f-mono')};fill:${cs.getPropertyValue('--ink-3').trim()}}.ln{fill:none}`;
    const st = document.createElementNS(NS, 'style'); st.textContent = css; clone.prepend(st);
    // resolve var(--x) colours
    clone.querySelectorAll('*').forEach((n) => { ['stroke', 'fill'].forEach((a) => { const v = n.getAttribute(a); if (v && v.startsWith('var(')) { const name = v.slice(4, -1).trim(); n.setAttribute(a, cs.getPropertyValue(name).trim()); } }); });
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    await img.decode();
    const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale; const ctx = cv.getContext('2d');
    ctx.fillStyle = bg || cs.getPropertyValue('--surface').trim() || '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }

  function setDomain(d, animate = false) {
    if (d.x) { X.min = d.x[0]; X.max = d.x[1]; } if (d.y) { Y.min = d.y[0]; Y.max = d.y[1]; }
    drawAxes(); els.forEach((e) => e.sync && e.sync(!animate)); paintAll(); start(); return api;
  }

  const ro = new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - W) > 1 || !innerW) { clearGhosts(); layout(); } });
  ro.observe(host);
  layout();

  const api = {
    svg, line, area, point, vline, hline, text, arrow, bars, remove, update, snapshot, clearGhosts, setDomain, enableHover, toPNG,
    sx, sy, ix, iy, get W() { return W; }, get H() { return H; }, get inner() { return { l: M.l, t: M.t, w: innerW, h: innerH }; }, domain: () => ({ x: [X.min, X.max], y: [Y.min, Y.max] }),
    get(id) { return els.get(id); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); els.clear(); },
  };
  return api;
}
