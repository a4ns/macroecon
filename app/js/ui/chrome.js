/* persistent chrome: header behaviour, nav pill, mobile menu, cursor follower, footer, progress hairline */
import { $, $$, h, bus, lerp, isTouch, reduced, clamp } from '../core/dom.js';
import { onScroll } from '../core/motion.js';
import { SECTIONS, TOPICS } from '../data/topics.js';
import { store } from '../core/store.js';
import { S, bus as sbus } from '../core/state.js';
import { ctx } from '../core/plan.js';
import { countDue } from '../core/sr.js';

/* ── header ─────────────────────────────────────────────────── */
export function initHeader() {
  const top = $('#top');
  let lastY = window.scrollY, hidden = false;
  onScroll((y, vy) => {
    top.classList.toggle('is-scrolled', y > 12);
    const menuOpen = $('#menu').classList.contains('is-open');
    const d = y - lastY;
    if (!menuOpen && y > 520 && d > 6 && !hidden) { hidden = true; top.classList.add('is-hidden'); }
    else if ((d < -6 || y < 400 || menuOpen) && hidden) { hidden = false; top.classList.remove('is-hidden'); }
    if (Math.abs(d) > 6 || y < 400) lastY = y; else if (d < 0) lastY = y;
  });
  // keep it visible while something inside has focus
  top.addEventListener('focusin', () => { hidden = false; top.classList.remove('is-hidden'); });
}

/* ── nav pill, library dropdown, role order ─────────────────── */
const topItems = (nav) => Array.from(nav.querySelectorAll(':scope > a, :scope > .nav__lib > .nav__libbtn'));
const LIB_NAV = new Set(['library', 'theory', 'lab', 'tasks', 'tests', 'glossary', 'more']);

export function initNav() {
  const nav = $('#nav'), pill = $('.nav__pill', nav);
  const place = (a, instant) => {
    if (!a) { pill.style.opacity = 0; return; }
    const nr = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
    if (!nr.width) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = r.width + 'px'; pill.style.transform = `translateX(${r.left - nr.left}px)`; pill.style.opacity = 1;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  };
  const cur = () => topItems(nav).find((a) => a.getAttribute('aria-current') === 'page');
  let first = true;
  const sync = () => { place(cur(), first); first = false; };
  topItems(nav).forEach((a) => { a.addEventListener('pointerenter', () => place(a)); a.addEventListener('focus', () => place(a)); });
  nav.addEventListener('pointerleave', sync);
  nav.addEventListener('focusout', () => setTimeout(() => { if (!nav.contains(document.activeElement)) sync(); }, 0));
  bus.on('nav', (n) => {
    const lb = $('#lib-btn'); if (lb) { if (LIB_NAV.has(n)) lb.setAttribute('aria-current', 'page'); else lb.removeAttribute('aria-current'); }
    $$('#tabbar a').forEach((a) => { if (a.dataset.nav === n) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    requestAnimationFrame(sync);
  });
  window.addEventListener('resize', () => place(cur(), true));
  document.fonts && document.fonts.ready.then(() => place(cur(), true));
  bus.on('shell', () => requestAnimationFrame(() => place(cur(), true)));
  initLibrary();
  initRole();
}

function initLibrary() {
  const wrap = $('#nav-lib'), btn = $('#lib-btn'), menu = $('#lib-menu'); if (!wrap) return;
  let timer = 0;
  const set = (on) => { clearTimeout(timer); wrap.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', String(on)); };
  const links = () => $$('a', menu);
  btn.addEventListener('click', () => set(!wrap.classList.contains('is-open')));
  wrap.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { clearTimeout(timer); set(true); } });
  wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') timer = setTimeout(() => set(false), 160); });
  wrap.addEventListener('focusout', () => setTimeout(() => { if (!wrap.contains(document.activeElement)) set(false); }, 0));
  wrap.addEventListener('keydown', (e) => {
    const open = wrap.classList.contains('is-open'), ls = links(), i = ls.indexOf(document.activeElement);
    if (e.key === 'Escape' && open) { e.preventDefault(); set(false); btn.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) set(true); (ls[i + 1] || ls[0]).focus(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); (ls[i - 1] || ls[ls.length - 1]).focus(); }
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  bus.on('route', () => set(false));
}

/* роль «преподаватель» ставит «Преподавателю» первым пунктом (десктоп и меню) */
function initRole() {
  const apply = () => {
    const teacher = S.data.role === 'teacher';
    const nav = $('#nav'), t = $('a[data-nav="teach"]', nav), pill = $('.nav__pill', nav);
    if (t) { if (teacher) nav.insertBefore(t, pill.nextSibling); else nav.append(t); }
    const m = $('#menu'), sub = $('.menu__sub', m);
    const mt = $('a[data-nav="teach"]', m), ml = $('a[data-nav="library"]', m), ms = $('a[data-nav="settings"]', m);
    (teacher ? [mt, ml, ms] : [ml, mt, ms]).forEach((x) => x && m.insertBefore(x, sub));
    bus.emit('shell');
  };
  apply();
  let last = S.data.role;
  sbus.on('change', (k) => { if (k === 'mx:v3' && S.data.role !== last) { last = S.data.role; apply(); } });
}

/* ── счётчик «к повторению»: число, не красная точка ──────────── */
export function initDue() {
  const render = (n) => $$('[data-due]').forEach((e) => {
    const on = n > 0; e.hidden = !on;
    if (on) { e.textContent = n > 99 ? '99+' : String(n); e.setAttribute('aria-label', 'к повторению: ' + n); e.title = 'К повторению сегодня: ' + n; }
  });
  let t = 0;
  const upd = async () => { try { const c = await ctx(); render(countDue(c.bank)); bus.emit('shell'); } catch (e) { /* без данных счётчика нет */ } };
  const sched = () => { clearTimeout(t); t = setTimeout(upd, 250); };
  sbus.on('change', (k) => { if (k === 'mx:v3:sr' || k === 'mx:v3') sched(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sched(); });
  return upd;
}

/* ── mobile menu ────────────────────────────────────────────── */
export function initMenu() {
  const b = $('#burger'), m = $('#menu');
  const set = (on) => {
    m.classList.toggle('is-open', on); b.setAttribute('aria-expanded', String(on)); m.setAttribute('aria-hidden', String(!on));
    m.inert = !on;
    document.documentElement.style.overflow = on ? 'hidden' : '';
    b.innerHTML = on ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>';
  };
  m.inert = true;
  b.addEventListener('click', () => set(!m.classList.contains('is-open')));
  m.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('is-open')) { set(false); b.focus(); } });
  bus.on('route', () => set(false));
}

/* ── cursor follower ────────────────────────────────────────── */
export function initCursor() {
  if (isTouch() || reduced()) return;
  const c = $('#cursor'); if (!c) return;
  const ring = $('i', c), dot = $('b', c);
  let x = -100, y = -100, rx = x, ry = y, on = false, raf = 0;
  const loop = () => {
    rx = lerp(rx, x, .2); ry = lerp(ry, y, .2);
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`; dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    raf = (Math.abs(rx - x) + Math.abs(ry - y) > .1) ? requestAnimationFrame(loop) : 0;
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    x = e.clientX; y = e.clientY; if (!on) { on = true; c.classList.add('on'); rx = x; ry = y; }
    if (!raf) raf = requestAnimationFrame(loop);
    const t = e.target;
    const lab = t.closest && t.closest('[data-cursor]');
    const link = t.closest && t.closest('a, button, [role="button"], summary, label, .card, .sl__range, .seg__b');
    const text = t.closest && t.closest('input[type="text"], textarea, .ans, .sl__in');
    c.classList.toggle('is-label', !!lab); ring.textContent = lab ? lab.dataset.cursor : '';
    c.classList.toggle('is-link', !lab && !!link && !text); c.classList.toggle('is-text', !!text);
  }, { passive: true });
  window.addEventListener('pointerdown', () => c.classList.add('is-down'));
  window.addEventListener('pointerup', () => c.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => { on = false; c.classList.remove('on'); });
  document.documentElement.classList.add('has-cursor');
}

/* ── progress hairline (reader etc.) ────────────────────────── */
export function setProgress(p) {
  const el = $('#progress'); if (!el) return;
  if (p == null) { el.classList.remove('on'); return; }
  el.classList.add('on'); el.style.setProperty('--p', clamp(p).toFixed(4));
}

/* ── footer ─────────────────────────────────────────────────── */
export function renderFooter() {
  const f = $('#foot');
  const col = (t, items) => h('div', h('h4', t), h('ul', ...items.map(([l, href, ext]) => h('li', h('a', { href, ...(ext ? { rel: 'noopener' } : {}) }, l)))));
  const read = store.readCount();
  f.replaceChildren(
    h('div.wrap',
      h('div.foot__grid',
        h('div', h('a.brand', { href: '#/', 'aria-label': 'Макро — на главную' }, h('span', h('span.brand__word', 'Макро'))),
          h('p.foot__about', { style: { marginTop: '1.1rem' } }, 'Электронный учебник по макроэкономике Северо-Казахстанского государственного университета имени Манаша Козыбаева — заново, для экрана.')),
        col('Курс', [['Сегодня', '#/today'], ['Карта курса', '#/course'], ['Повторение', '#/review'], ['Прогресс', '#/me']]),
        col('Библиотека', [...SECTIONS.slice(0, 5).map((s) => [s.label, s.href]), ['Все разделы', '#/library']]),
        col('Ещё', [['СРО и приложения', '#/more/sro'], ['Источники', '#/more/sources'], ['Об учебнике', '#/more/about'], ['Преподавателю', '#/teach'], ['Настройки и резервная копия', '#/settings'], ['Поиск по учебнику', '#/?k=1'], ['Классическая версия', 'classic/', true]]),
      ),
      h('div.foot__mega', { 'aria-hidden': 'true' }, 'Макро'),
      h('div.foot__legal', h('span', '© СКГУ им. М. Козыбаева · Макроэкономика · 2018'), h('span', 'Версия 2026 · тёмная и светлая темы · ' + (read ? 'прочитано лекций: ' + read : 'всё работает офлайн')))));
  // the "search" link opens the palette
  f.querySelector('a[href="#/?k=1"]').addEventListener('click', (e) => { e.preventDefault(); $('#open-palette').click(); });
}
