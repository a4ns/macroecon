/* persistent chrome: header behaviour, nav pill, mobile menu, cursor follower, footer, progress hairline */
import { $, $$, h, bus, lerp, isTouch, reduced, clamp } from '../core/dom.js';
import { onScroll } from '../core/motion.js';
import { SECTIONS, TOPICS } from '../data/topics.js';
import { store } from '../core/store.js';

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

/* ── nav pill ───────────────────────────────────────────────── */
export function initNav() {
  const nav = $('#nav'), pill = $('.nav__pill', nav);
  const links = $$('a', nav);
  const place = (a, instant) => {
    if (!a) { pill.style.opacity = 0; return; }
    const nr = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
    if (!nr.width) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = r.width + 'px'; pill.style.transform = `translateX(${r.left - nr.left}px)`; pill.style.opacity = 1;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  };
  const cur = () => links.find((a) => a.getAttribute('aria-current') === 'page');
  let first = true;
  const sync = () => { place(cur(), first); first = false; };
  links.forEach((a) => { a.addEventListener('pointerenter', () => place(a)); a.addEventListener('focus', () => place(a)); });
  nav.addEventListener('pointerleave', sync);
  nav.addEventListener('focusout', () => setTimeout(() => { if (!nav.contains(document.activeElement)) sync(); }, 0));
  bus.on('nav', () => requestAnimationFrame(sync));
  window.addEventListener('resize', () => place(cur(), true));
  document.fonts && document.fonts.ready.then(() => place(cur(), true));
}

/* ── mobile menu ────────────────────────────────────────────── */
export function initMenu() {
  const b = $('#burger'), m = $('#menu');
  const set = (on) => {
    m.classList.toggle('is-open', on); b.setAttribute('aria-expanded', String(on)); m.setAttribute('aria-hidden', String(!on));
    document.documentElement.style.overflow = on ? 'hidden' : '';
    b.innerHTML = on ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>';
  };
  b.addEventListener('click', () => set(!m.classList.contains('is-open')));
  m.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('is-open')) set(false); });
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
        col('Учебник', SECTIONS.slice(0, 4).map((s) => [s.label, s.href])),
        col('Справка', [[SECTIONS[4].label, SECTIONS[4].href], ['СРО и приложения', '#/more/sro'], ['Источники', '#/more/sources'], ['Авторы', '#/more/authors']]),
        col('Ещё', [['Поиск по учебнику', '#/?k=1'], ['Классическая версия', 'classic/', true], ['Руководство', '#/more/guide']]),
      ),
      h('div.foot__mega', { 'aria-hidden': 'true' }, 'Макро'),
      h('div.foot__legal', h('span', '© СКГУ им. М. Козыбаева · Макроэкономика · 2018'), h('span', 'Версия 2026 · тёмная и светлая темы · ' + (read ? 'прочитано лекций: ' + read : 'всё работает офлайн')))));
  // the "search" link opens the palette
  f.querySelector('a[href="#/?k=1"]').addEventListener('click', (e) => { e.preventDefault(); $('#open-palette').click(); });
}
