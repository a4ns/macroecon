/* tiny DOM + math helpers (no framework) */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** h('div.card#id', {class:'x', onclick:fn, dataset:{a:1}, style:{...}}, child, 'text', [children]) */
export function h(tag, attrs, ...kids) {
  let el;
  if (typeof tag === 'string') {
    const m = tag.match(/^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i);
    const name = (m && m[1]) || 'div';
    const svgNames = 'svg g path circle rect line polyline polygon text tspan defs marker clipPath linearGradient radialGradient stop ellipse use mask pattern filter feGaussianBlur foreignObject title desc';
    el = svgNames.split(' ').includes(name) && (name === 'svg' || h._svg)
      ? document.createElementNS('http://www.w3.org/2000/svg', name) : document.createElement(name);
    if (m && m[2]) m[2].replace(/([.#])([\w-]+)/g, (_, k, v) => { if (k === '.') el.classList.add(v); else el.id = v; });
  } else el = tag;
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs) || typeof attrs === 'string' || typeof attrs === 'number')) { kids.unshift(attrs); attrs = null; }
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') v && el.setAttribute('class', (el.getAttribute('class') ? el.getAttribute('class') + ' ' : '') + v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

/** svg element factory: s('path', {d:'...'}) */
export function s(tag, attrs, ...kids) {
  h._svg = true;
  try { return h(tag, attrs, ...kids); } finally { h._svg = false; }
}

/** create DOM from html string */
export function fromHTML(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}
export function fragHTML(str) {
  const t = document.createElement('template');
  t.innerHTML = str;
  return t.content;
}

export function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** delegated listener */
export function on(root, type, sel, fn, opts) {
  const f = (e) => { const t = e.target.closest && e.target.closest(sel); if (t && root.contains(t)) fn(e, t); };
  root.addEventListener(type, f, opts);
  return () => root.removeEventListener(type, f, opts);
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => (x - a) / (b - a);
export const map = (x, a, b, c, d) => c + ((x - a) / (b - a)) * (d - c);
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const reduced = () => document.documentElement.classList.contains('reduce');
export const isTouch = () => matchMedia('(hover: none), (pointer: coarse)').matches;

/** seeded PRNG */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** number formatting (ru) */
const nfCache = {};
export function fmt(n, d = 0) {
  if (!isFinite(n)) return '—';
  const k = 'd' + d;
  const nf = nfCache[k] || (nfCache[k] = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.format(Math.abs(n) < 5e-13 ? 0 : n).replace('−', '−').replace(/ /g, ' ');
}
export const pct = (n, d = 1) => fmt(n * 100, d) + ' %';

/** plural: plural(5, ['лекция','лекции','лекций']) */
export function plural(n, f) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2];
}

export function debounce(fn, ms = 120) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function throttleRAF(fn) { let q = false, last; return (...a) => { last = a; if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(...last); }); }; }

export function toast(msg) {
  const t = h('div.toast', msg);
  const box = document.getElementById('toasts');
  box.append(t);
  setTimeout(() => t.remove(), 3200);
}

/** run fn when element first scrolls into view */
export function whenVisible(el, fn, opts = { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }) {
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.disconnect(); fn(e.target); } }, opts);
  io.observe(el);
  return () => io.disconnect();
}

/** simple event emitter */
export function emitter() {
  const m = new Map();
  return {
    on(t, f) { (m.get(t) || m.set(t, new Set()).get(t)).add(f); return () => m.get(t).delete(f); },
    emit(t, d) { (m.get(t) || []).forEach((f) => f(d)); },
  };
}

export const bus = emitter();

/** load a script-ish JSON/HTML with caching */
const _cache = new Map();
export function getJSON(url) {
  if (!_cache.has(url)) _cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }));
  return _cache.get(url);
}
export function getText(url) {
  if (!_cache.has('t:' + url)) _cache.set('t:' + url, fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); }));
  return _cache.get('t:' + url);
}
