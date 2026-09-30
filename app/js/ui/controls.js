/* ─────────────────────────────────────────────────────────────
   mx-controls — the small UI kit every simulator / widget is built from.

   slider({ label, sym, min, max, step, value, unit, dec, fmt, color, help, onInput, clamp })
       → { el, value, set(v, {silent}), reset(), setRange(min,max), disable(b), on(fn) }
   seg({ options:[{v,label,hint}], value, onChange, label })
       → { el, value, set(v, {silent}) }
   toggle({ label, value, onChange, hint })            → { el, value, set(v, {silent}) }
   stat({ label, sym, unit, value, dec, fmt, color, size, tone })
       → { el, set(v), base(v), get() }     (animated roll-up, delta vs base)
   panel({ title, hint, open, collapsible }, ...children) → element
   presets([{ label, hint, apply }], { onApply })      → element
   button({ label, icon, variant, sm, onClick })       → element
   callout({ tone, title, html })                      → element
   legend([{ color, label, dash }])                    → element
   dtable({ cols:[{key,label,num,fmt}], rows })        → { el, set(rows) }
   field({ label, sym, value, unit, onChange, dec })   → { el, value, set(v) }
   figure(title, child, {note})                        → element
   simLayout(root)                                     → { root, controls, stage, stats, notes }
   symHTML('C_a') → 'C<sub>a</sub>'
   ───────────────────────────────────────────────────────────── */
import { h, clamp, fmt as nf, esc, reduced } from '../core/dom.js';

/* "Y_f", "r^*", "C_{a}" → html with <sub>/<sup> */
export function symHTML(str) {
  return esc(str).replace(/_\{([^}]*)\}|_([^\s_^{<]+?)(?=$|[\s,.;:)=+\-−*/^_]|&)|\^\{([^}]*)\}|\^([^\s_^{<]+?)(?=$|[\s,.;:)=+\-−*/^_]|&)/g,
    (m, a, b, c, d) => (a != null || b != null) ? `<sub>${a ?? b}</sub>` : `<sup>${c ?? d}</sup>`);
}
const symEl = (str) => h('i.sym', { html: symHTML(str) });
const decimalsOf = (step) => { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
const parseNum = (t) => parseFloat(String(t).replace(/[\s  ]/g, '').replace(/[−–—]/g, '-').replace(',', '.'));

let uidn = 0;
const uid = (p = 'c') => p + (++uidn);

/* ── slider ─────────────────────────────────────────────────── */
export function slider(o = {}) {
  const O = Object.assign({ min: 0, max: 100, step: 1, value: 0, unit: '', color: 'var(--accent)', clamp: true }, o);
  const dec = O.dec != null ? O.dec : decimalsOf(O.step);
  const f = O.fmt || ((v) => nf(v, dec));
  const id = uid('sl');
  let val = O.value; const def = O.value;
  const fns = new Set(); if (O.onInput) fns.add(O.onInput);

  const range = h('input.sl__range', { type: 'range', id, min: O.min, max: O.max, step: O.step, value: val });
  const num = h('input.sl__in', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value: f(val), 'aria-label': (O.label || O.sym || 'значение') + ' — точное значение', size: 1 });
  const unit = O.unit ? h('em.sl__unit', O.unit) : null;
  const notch = h('i.sl__def', { 'aria-hidden': 'true', title: 'Исходное значение' });
  const lab = h('label.sl__lab', { for: id }, O.sym ? h('span.sl__sym', symEl(O.sym)) : null, O.label ? h('span.sl__name', O.label) : null);
  const el = h('div.sl', { style: { '--c': O.color } },
    h('div.sl__top', lab, h('div.sl__val', num, unit)),
    h('div.sl__track', range, notch),
    O.help ? h('p.sl__help', O.help) : null);

  const pos = (v) => (O.max === O.min ? 0 : clamp((v - O.min) / (O.max - O.min)));
  const paint = () => {
    const p = pos(val); el.style.setProperty('--p', p.toFixed(4));
    notch.style.setProperty('--dp', pos(def).toFixed(4));
    notch.hidden = Math.abs(pos(def) - p) < 0.012;
    range.setAttribute('aria-valuetext', f(val) + (O.unit ? ' ' + O.unit : ''));
  };
  const emit = (fromUser) => fns.forEach((fn) => fn(val, fromUser));
  const set = (v, { silent = false, fromUser = false } = {}) => {
    if (!Number.isFinite(v)) return;
    if (O.clamp) v = clamp(v, O.min, O.max);
    val = v; range.value = v;
    if (document.activeElement !== num) num.value = f(v); paint();
    if (!silent) emit(fromUser);
  };
  range.addEventListener('input', () => { val = parseFloat(range.value); num.value = f(val); paint(); emit(true); });
  const commit = () => { const v = parseNum(num.value); if (Number.isFinite(v)) set(v, { fromUser: true }); else num.value = f(val); };
  num.addEventListener('change', commit);
  num.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { num.blur(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); set(val + (e.key === 'ArrowUp' ? 1 : -1) * O.step * (e.shiftKey ? 10 : 1), { fromUser: true }); num.select(); }
    if (e.key === 'Escape') { num.value = f(val); num.blur(); }
  });
  num.addEventListener('focus', () => num.select());
  num.addEventListener('blur', () => { num.value = f(val); });
  lab.addEventListener('dblclick', () => set(def, { fromUser: true }));
  paint();
  return {
    el, get value() { return val; }, set, def,
    reset(silent) { set(def, { silent }); },
    setRange(min, max, step) { O.min = min; O.max = max; if (step) { O.step = step; range.step = step; } range.min = min; range.max = max; set(val, { silent: true }); },
    disable(b = true) { range.disabled = b; num.disabled = b; el.classList.toggle('is-off', b); },
    on(fn) { fns.add(fn); return () => fns.delete(fn); },
    range, num,
  };
}

/* ── segmented ──────────────────────────────────────────────── */
export function seg(o = {}) {
  const O = Object.assign({ options: [], value: null }, o);
  let val = O.value != null ? O.value : (O.options[0] && O.options[0].v);
  const fns = new Set(); if (O.onChange) fns.add(O.onChange);
  const name = uid('sg');
  const btns = O.options.map((op, i) => h('button.seg__b', { type: 'button', role: 'radio', 'data-v': String(op.v), title: op.hint || null, onclick: () => set(op.v, { fromUser: true }) }, op.label));
  const el = h('div.seg', { role: 'radiogroup', 'aria-label': O.label || null, style: { '--n': O.options.length, '--i': 0 } }, h('i.seg__thumb'), ...btns);
  const paint = () => {
    const i = Math.max(0, O.options.findIndex((x) => x.v === val));
    el.style.setProperty('--i', i);
    btns.forEach((b, k) => { b.setAttribute('aria-checked', k === i ? 'true' : 'false'); b.tabIndex = k === i ? 0 : -1; });
  };
  const set = (v, { silent = false, fromUser = false } = {}) => { val = v; paint(); if (!silent) fns.forEach((fn) => fn(val, fromUser)); };
  el.addEventListener('keydown', (e) => {
    if (!/Arrow(Left|Right|Up|Down)/.test(e.key)) return; e.preventDefault();
    const i = O.options.findIndex((x) => x.v === val), d = /Right|Down/.test(e.key) ? 1 : -1;
    const n = O.options[(i + d + O.options.length) % O.options.length]; set(n.v, { fromUser: true }); btns[O.options.indexOf(n)].focus();
  });
  paint();
  const wrap = O.label ? h('div.seg-wrap', h('span.seg__lab', O.label), el) : el;
  return { el: wrap, seg: el, get value() { return val; }, set, on(fn) { fns.add(fn); } };
}

/* ── toggle ─────────────────────────────────────────────────── */
export function toggle(o = {}) {
  const O = Object.assign({ value: false }, o);
  let val = !!O.value; const fns = new Set(); if (O.onChange) fns.add(O.onChange);
  const inp = h('input.tg__in', { type: 'checkbox', role: 'switch', checked: val });
  const el = h('label.tg', { style: O.color ? { '--c': O.color } : null }, inp, h('span.tg__sw', h('i')), h('span.tg__lab', O.label, O.hint ? h('small', O.hint) : null));
  inp.addEventListener('change', () => { val = inp.checked; fns.forEach((fn) => fn(val, true)); });
  return { el, get value() { return val; }, set(v, { silent = false } = {}) { val = !!v; inp.checked = val; if (!silent) fns.forEach((fn) => fn(val, false)); }, on(fn) { fns.add(fn); } };
}

/* ── stat (animated number) ─────────────────────────────────── */
export function stat(o = {}) {
  const O = Object.assign({ value: 0, dec: 0, unit: '', size: 'm', color: null }, o);
  const f = O.fmt || ((v) => nf(v, O.dec));
  let cur = O.value, tgt = O.value, raf = 0, baseV = null;
  const numEl = h('b.st__num', f(cur));
  const dEl = h('span.st__d');
  const el = h('div.st.st--' + O.size, { style: O.color ? { '--c': O.color } : null },
    h('span.st__lab', O.sym ? h('span.st__sym', symEl(O.sym)) : null, O.label ? h('span', O.label) : null),
    h('span.st__val', numEl, O.unit ? h('em', O.unit) : null), dEl);
  const showDelta = () => {
    if (baseV == null || !Number.isFinite(tgt)) { dEl.textContent = ''; dEl.className = 'st__d'; return; }
    const d = tgt - baseV;
    if (Math.abs(d) < Math.pow(10, -(O.dec + 1)) * 5) { dEl.textContent = 'без изменений'; dEl.className = 'st__d is-0'; return; }
    dEl.textContent = (d > 0 ? '▲ +' : '▼ −') + nf(Math.abs(d), O.dec) + (O.unit && O.unit.length < 4 ? ' ' + O.unit : '');
    dEl.className = 'st__d ' + (d > 0 ? 'is-up' : 'is-down');
  };
  const tick = (t0, from) => (t) => {
    const p = clamp((t - t0) / 420); const e = 1 - Math.pow(1 - p, 3);
    cur = from + (tgt - from) * e; numEl.textContent = f(cur);
    raf = p < 1 ? requestAnimationFrame(tick(t0, from)) : 0; if (p >= 1) { cur = tgt; numEl.textContent = f(cur); }
  };
  return {
    el, get() { return tgt; },
    set(v) {
      if (!Number.isFinite(v)) { tgt = v; cur = v; numEl.textContent = '—'; return; }
      if (v === tgt && raf === 0) { numEl.textContent = f(v); showDelta(); return; }
      const prev = Number.isFinite(cur) ? cur : v; tgt = v; showDelta();
      cancelAnimationFrame(raf);
      if (reduced() || Math.abs(prev - v) < 1e-9) { cur = v; numEl.textContent = f(v); return; }
      el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
      raf = requestAnimationFrame(tick(performance.now(), prev));
    },
    base(v) { baseV = v; showDelta(); },
    setUnit(u) { const e = el.querySelector('.st__val em'); if (e) e.textContent = u; },
  };
}

/* ── panel ──────────────────────────────────────────────────── */
export function panel(o = {}, ...kids) {
  const O = typeof o === 'string' ? { title: o } : o;
  const head = O.title ? h('header.pn__h', h('h3', O.title), O.hint ? h('span', O.hint) : null, O.action || null) : null;
  const body = h('div.pn__b', ...kids);
  const el = h('section.pn', { class: O.class || null }, head, body);
  if (O.collapsible && head) {
    head.classList.add('is-click'); head.tabIndex = 0; head.setAttribute('role', 'button');
    const t = () => { const c = el.classList.toggle('is-shut'); head.setAttribute('aria-expanded', String(!c)); };
    head.addEventListener('click', t); head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
    head.append(h('i.pn__chev')); head.setAttribute('aria-expanded', 'true'); if (O.open === false) t();
  }
  return el;
}

/* ── presets ────────────────────────────────────────────────── */
export function presets(list, o = {}) {
  const el = h('div.pre', { role: 'group', 'aria-label': o.label || 'Сценарии' });
  if (o.title !== false) el.append(h('span.pre__t', o.title || 'Сценарии'));
  list.forEach((p) => el.append(h('button.chip.pre__b', { type: 'button', title: p.hint || null, onclick: () => { p.apply(); o.onApply && o.onApply(p); } }, p.color ? h('i', { style: { '--c': p.color } }) : null, p.label)));
  return el;
}

/* ── button ─────────────────────────────────────────────────── */
export function button(o = {}) {
  const arrows = { reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>', arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>', camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>', play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>', pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>', check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5 5L20 6"/></svg>', calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>' };
  const ic = o.icon ? (arrows[o.icon] ? h('span.btn__i', { html: arrows[o.icon] }) : o.icon) : null;
  return h('button.btn' + (o.variant ? '.btn--' + o.variant : '') + (o.sm ? '.btn--sm' : ''), { type: 'button', onclick: o.onClick, title: o.title || null, class: o.class || null }, ic, o.label ? h('span', o.label) : null);
}

/* ── callout ────────────────────────────────────────────────── */
export function callout(o = {}) {
  return h('aside.co.co--' + (o.tone || 'info'), { role: o.tone === 'bad' ? 'alert' : null },
    o.title ? h('strong.co__t', o.title) : null, h('div.co__b', o.html ? { html: o.html } : null, o.text || null));
}

/* ── legend ─────────────────────────────────────────────────── */
export function legend(items) {
  return h('ul.lg', ...items.map((it) => h('li.lg__i', h('i', { class: it.dash ? 'is-dash' : '', style: { '--c': it.color } }), h('span', { html: symHTML(it.label) }))));
}

/* ── small data table ───────────────────────────────────────── */
export function dtable({ cols, rows = [], caption } = {}) {
  const tb = h('tbody'); const el = h('div.dt', h('table', caption ? h('caption.sr', caption) : null, h('thead', h('tr', ...cols.map((c) => h('th', { class: c.num ? 'num' : null, scope: 'col' }, c.label)))), tb));
  const set = (rs) => {
    tb.textContent = '';
    rs.forEach((r) => tb.append(h('tr', { class: r._cls || null }, ...cols.map((c) => { const v = r[c.key]; return h('td', { class: c.num ? 'num' : null }, c.fmt && typeof v === 'number' ? c.fmt(v) : (v == null ? '' : (typeof v === 'string' && /[_^]/.test(v) && c.sym ? h('span', { html: symHTML(v) }) : v))); })))); };
  set(rows);
  return { el, set };
}

/* ── numeric field ──────────────────────────────────────────── */
export function field(o = {}) {
  const O = Object.assign({ value: '', dec: 0 }, o); const id = uid('fd'); const fns = new Set(); if (O.onChange) fns.add(O.onChange);
  const inp = h('input.fd__in', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: O.value === '' ? '' : nf(O.value, O.dec), placeholder: O.placeholder || null });
  const el = h('div.fd', h('label', { for: id }, O.sym ? symEl(O.sym) : null, O.label ? h('span', O.label) : null), h('span.fd__box', inp, O.unit ? h('em', O.unit) : null));
  let val = O.value === '' ? NaN : O.value;
  inp.addEventListener('input', () => { val = parseNum(inp.value); fns.forEach((fn) => fn(val)); });
  inp.addEventListener('blur', () => { if (Number.isFinite(val)) inp.value = nf(val, O.dec); });
  return { el, inp, get value() { return val; }, set(v) { val = v; inp.value = Number.isFinite(v) ? nf(v, O.dec) : ''; }, on(fn) { fns.add(fn); } };
}

/* ── figure (titled container for a chart) ──────────────────── */
export function figure(title, child, o = {}) {
  return h('figure.sfig', { class: o.class || null }, title ? h('figcaption', h('span', title), o.right || null) : null, child, o.note ? h('p.sfig__note', o.note) : null);
}

/* ── standard two-column simulator layout ───────────────────── */
export function simLayout(root, o = {}) {
  const controls = h('aside.sim__controls', { 'aria-label': 'Параметры модели' });
  const stats = h('div.sim__stats');
  const stage = h('div.sim__stage');
  const notes = h('div.sim__notes');
  root.classList.add('sim');
  root.append(h('div.sim__grid', { class: o.wide ? 'is-wide' : null }, controls, h('div.sim__main', stats, stage, notes)));
  return { root, controls, stats, stage, notes };
}

/* small number helper exported for sims */
export const numfmt = nf;
