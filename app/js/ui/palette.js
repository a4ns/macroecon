/* command palette: ⌘K / Ctrl+K / "/" — search across lectures, terms, tasks, tests, models */
import { h, esc, debounce } from '../core/dom.js';
import { searchIndex, index, glossary } from '../core/data.js';
import { store } from '../core/store.js';
import { TOPICS, LABS, SECTIONS } from '../data/topics.js';

let root, input, list, box, open = false, items = [], sel = 0, corpus = null, loading = null;

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
const stem = (w) => (w.length > 6 ? w.slice(0, w.length - 2) : w.length > 4 ? w.slice(0, -1) : w);
const GROUPS = { lec: 'Лекции', gl: 'Глоссарий', task: 'Задачи', test: 'Тесты', lab: 'Модели', sro: 'СРО', app: 'Приложения', nav: 'Разделы' };
const GLYPH = { lec: 'Л', gl: 'Г', task: 'З', test: 'Т', lab: 'М', sro: 'С', app: 'П', nav: '→' };

async function ensure() {
  if (corpus) return corpus;
  if (!loading) loading = Promise.all([searchIndex(), index(), glossary()]).then(([s, ix, gl]) => {
    const glById = new Map(gl.map((g) => [g.id, g]));
    corpus = s.filter((d) => d.title).map((d) => {
      const o = Object.assign({}, d);
      if (d.t === 'lec') { o.href = '#/read/' + d.id; o.sub = 'Тема ' + d.topic + ' · лекция ' + d.id; }
      else if (d.t === 'gl') { const g = glById.get(d.id); o.href = '#/glossary' + (g ? '/' + encodeURIComponent(g.letter) : '') + '?t=' + d.id; o.sub = 'Термин'; }
      else if (d.t === 'task') { o.href = '#/tasks/' + d.topic + '?t=' + d.id; o.sub = 'Тема ' + d.topic; }
      else if (d.t === 'test') { o.href = '#/tests/' + d.id; o.sub = 'Тема ' + d.topic; }
      else if (d.t === 'lab') { o.href = '#/lab/' + d.id; o.title = (LABS[d.id] && LABS[d.id].short) || d.title.replace(/^Упражнение:\s*/, ''); o.sub = 'Модель · тема ' + d.topic; }
      else if (d.t === 'sro') { o.href = '#/more/sro?n=' + d.id; o.sub = 'Самостоятельная работа'; }
      else if (d.t === 'app') { o.href = '#/more/appendix?n=' + d.id; o.sub = 'Приложение'; }
      o.nt = norm(o.title); o.nx = norm(o.text);
      return o;
    });
    SECTIONS.forEach((s) => corpus.push({ t: 'nav', id: s.id, title: s.label, sub: s.sub, href: s.href, nt: norm(s.label + ' ' + s.id), nx: '' }));
    TOPICS && Object.keys(TOPICS).forEach((n) => corpus.push({ t: 'nav', id: 'topic' + n, title: 'Тема ' + n + '. ' + TOPICS[n].short, sub: TOPICS[n].tag, href: '#/theory/' + n, nt: norm('тема ' + n + ' ' + TOPICS[n].short + ' ' + TOPICS[n].tag), nx: '' }));
    return corpus;
  });
  return loading;
}

function score(doc, toks) {
  let s = 0;
  for (const t of toks) {
    const ti = doc.nt.indexOf(t);
    const xi = doc.nx ? doc.nx.indexOf(t) : -1;
    if (ti < 0 && xi < 0) return 0;
    if (ti >= 0) s += 8 + (ti === 0 || doc.nt[ti - 1] === ' ' ? 6 : 0) + (doc.nt.length < 30 ? 2 : 0);
    if (xi >= 0) s += 2;
  }
  if (doc.t === 'gl') s += 2; if (doc.t === 'lab') s += 1.5; if (doc.t === 'nav') s += 1;
  return s;
}

function snippet(doc, toks) {
  if (!doc.text) return doc.sub || '';
  const i = toks.map((t) => doc.nx.indexOf(t)).filter((x) => x >= 0).sort((a, b) => a - b)[0];
  if (i == null || i < 0) return doc.text.slice(0, 110);
  const a = Math.max(0, i - 40), b = Math.min(doc.text.length, i + 90);
  return (a > 0 ? '…' : '') + doc.text.slice(a, b) + (b < doc.text.length ? '…' : '');
}
const mark = (str, toks) => {
  let out = esc(str);
  toks.forEach((t) => { if (t.length < 2) return; const re = new RegExp('(' + esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яa-z0-9]*)', 'gi'); out = out.replace(re, '<mark>$1</mark>'); });
  return out;
};

function defaultItems() {
  const out = [];
  const last = store.get('last');
  if (last && last.route) out.push({ g: 'Продолжить', t: 'lec', title: last.title || 'Последнее прочитанное', sub: 'Вернуться к месту, где вы остановились', href: last.route, glyph: '↺' });
  SECTIONS.forEach((s) => out.push({ g: 'Разделы', t: 'nav', title: s.label, sub: s.sub, href: s.href }));
  ['ex6-1', 'ex10-3', 'ex3-1'].forEach((id) => out.push({ g: 'Популярные модели', t: 'lab', title: LABS[id].short, sub: LABS[id].tag, href: '#/lab/' + id }));
  return out;
}

async function run(q) {
  q = q.trim();
  if (!q) { items = defaultItems(); render([]); return; }
  await ensure();
  const toks = norm(q).split(/\s+/).filter(Boolean).map(stem);
  const res = [];
  for (const d of corpus) { const s = score(d, toks); if (s > 0) res.push([s, d]); }
  res.sort((a, b) => b[0] - a[0]);
  const per = {}; const out = [];
  for (const [, d] of res) { per[d.t] = (per[d.t] || 0) + 1; if (per[d.t] <= (d.t === 'lec' ? 6 : 4)) out.push(d); if (out.length >= 24) break; }
  const order = ['nav', 'lab', 'lec', 'gl', 'task', 'test', 'sro', 'app'];
  out.sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t));
  items = out.map((d) => Object.assign({ g: GROUPS[d.t], hl: toks, snip: snippet(d, toks) }, d));
  render(toks);
}

function render(toks = []) {
  list.textContent = '';
  if (!items.length) { list.append(h('div.pal__empty', 'Ничего не нашлось. Попробуйте другое слово — например, «мультипликатор».')); return; }
  let g = null;
  items.forEach((it, i) => {
    if (it.g !== g) { g = it.g; list.append(h('div.pal__g', g)); }
    const t = h('div.pal__t', h('b', { html: toks.length ? mark(it.title, toks) : esc(it.title) }), h('span', { html: toks.length && it.snip && it.t !== 'nav' ? mark(it.snip, toks) : esc(it.sub || '') }));
    const r = h('div.pal__r', { role: 'option', id: 'pal-' + i, 'aria-selected': i === sel ? 'true' : 'false', 'data-i': i }, h('span.pal__ic', it.glyph || GLYPH[it.t] || '·'), t, h('span.pal__k', it.t === 'lec' ? 'лекция' : it.t === 'gl' ? 'термин' : it.t === 'lab' ? 'модель' : it.t === 'task' ? 'задача' : it.t === 'test' ? 'тест' : ''));
    list.append(r);
  });
  sel = Math.min(sel, items.length - 1);
  mark1();
}
function mark1() {
  [...list.querySelectorAll('.pal__r')].forEach((r) => r.setAttribute('aria-selected', +r.dataset.i === sel ? 'true' : 'false'));
  const cur = list.querySelector('.pal__r[aria-selected="true"]'); if (cur) { cur.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', cur.id); }
}
function go(i) {
  const it = items[i]; if (!it) return;
  closePalette();
  if (location.hash === it.href) location.hash = ''; // force re-navigation
  setTimeout(() => { location.hash = it.href.replace(/^#/, ''); }, 10);
}

function build() {
  input = h('input', { type: 'text', placeholder: 'Искать лекции, термины, задачи, модели…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Поиск по учебнику', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list' });
  list = h('div.pal__list', { id: 'pal-list', role: 'listbox' });
  box = h('div.pal__box', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Поиск' },
    h('div.pal__in', h('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' }), input, h('kbd.kbd', 'Esc')),
    list,
    h('div.pal__foot', h('span', h('kbd.kbd', '↑'), h('kbd.kbd', '↓'), 'выбрать'), h('span', h('kbd.kbd', '↵'), 'открыть'), h('span', h('kbd.kbd', 'Esc'), 'закрыть')));
  root = h('div.pal', { onmousedown: (e) => { if (e.target === root) closePalette(); } }, box);
  document.getElementById('overlays').append(root);
  const dq = debounce((v) => { sel = 0; run(v); }, 60);
  input.addEventListener('input', () => dq(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark1(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark1(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'Home' && !input.value) { sel = 0; mark1(); }
  });
  list.addEventListener('mousemove', (e) => { const r = e.target.closest('.pal__r'); if (r && +r.dataset.i !== sel) { sel = +r.dataset.i; mark1(); } });
  list.addEventListener('click', (e) => { const r = e.target.closest('.pal__r'); if (r) go(+r.dataset.i); });
}

export function openPalette(q = '') {
  if (!root) build();
  open = true; sel = 0; input.value = q; root.classList.add('is-on'); document.documentElement.style.overflow = 'hidden';
  run(q); ensure(); setTimeout(() => input.focus(), 30);
}
export function closePalette() {
  if (!root) return; open = false; root.classList.remove('is-on'); document.documentElement.style.overflow = '';
  const b = document.getElementById('open-palette'); if (b && document.activeElement === input) b.focus();
}

export function initPalette() {
  document.getElementById('open-palette').addEventListener('click', () => openPalette());
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'л')) { e.preventDefault(); open ? closePalette() : openPalette(); return; }
    if (!open && e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) && !e.target.isContentEditable) { e.preventDefault(); openPalette(); }
  });
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const kb = document.querySelector('.searchbtn .kbd'); if (kb) kb.textContent = isMac ? '⌘K' : 'Ctrl K';
}
