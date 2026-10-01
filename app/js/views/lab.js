/* ─────────────────────────────────────────────────────────────
   Лаборатория — #/lab : витрина всех интерактивных моделей
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, loadCSS, plural, fmt, clamp, reduced, bus, esc, toast } from '../core/dom.js';
import { index } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { labCard } from '../ui/cards.js';
import { TOPICS, LABS, rub } from '../data/topics.js';
import { nb, ARROW, SEARCH, CLOSE } from './_typo.js';

/* themes of the showcase: which textbook topics they gather and how they are told */
const GROUPS = [
  { id: 'flow', topics: [1, 2], c: 'd1', k: 'Потоки и счета', s: 'Потоки', t: 'Как <em>считать</em> экономику', p: 'С чего начинается макроэкономика: круговые потоки доходов и товаров, система национальных счетов и динамика главных показателей.' },
  { id: 'growth', topics: [3, 4], c: 'd6', k: 'Рост и безработица', s: 'Рост', t: 'Куда <em>растёт</em> экономика', p: 'Капитал копится и изнашивается, а рынок труда живёт потоками найма и увольнения. Найдите устойчивое состояние и естественный уровень безработицы.' },
  { id: 'adas', topics: [5, 6], c: 'd5', k: 'Спрос и предложение', s: 'Спрос–предложение', t: 'Кривые <em>сдвигаются</em>', p: 'Совокупный спрос и предложение, кейнсианский крест и мультипликатор: как шоки меняют выпуск и цены.' },
  { id: 'gov', topics: [7, 8], c: 'd4', k: 'Бюджет и деньги', s: 'Бюджет и деньги', t: 'Рычаги <em>государства</em> и банков', p: 'Налоги, закупки и состояние бюджета — с одной стороны, резервы и денежный мультипликатор — с другой.' },
  { id: 'islm', topics: [9, 10], c: 'd2', k: 'Два рынка', s: 'IS–LM', t: 'Одна ставка — <em>два рынка</em>', p: 'Кривые IS и LM по отдельности и вместе: что происходит с доходом и ставкой процента, когда действует фискальная или монетарная политика.' },
  { id: 'open', topics: [11, 12, 13, 14], c: 'd3', k: 'Циклы и открытый мир', s: 'Открытая экономика', t: 'Волны и <em>границы</em>', p: 'Мультипликатор плюс акселератор рождают циклы, а открытая экономика добавляет курс, чистый экспорт и платёжный баланс.' },
];

const labTitle = (l) => (LABS[l.id] || { short: l.title }).short;
const labTag = (l) => (LABS[l.id] || { tag: '' }).tag;
const taskCount = (l) => (l.task || []).filter((t) => !/^\s*Задание:?\s*$/i.test(t)).length;
const seenKey = (id) => 'lab.' + id.replace('-', '_') + '.seen';
const topicRange = (ts) => (ts.length > 1 ? 'Темы ' + ts[0] + '–' + ts[ts.length - 1] : 'Тема ' + ts[0]);

const I_DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const I_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

export async function load() {
  await loadCSS('app/css/v-lab.css');
  return index();
}

export function mount(el, ctx, ix) {
  const offs = [];
  const labs = ix.labList;
  const nL = labs.length;
  const nTasks = labs.reduce((a, l) => a + taskCount(l), 0);
  const nTopics = new Set(labs.map((l) => l.topic)).size;
  const seen = (l) => !!store.get(seenKey(l.id));
  const nSeen = labs.filter(seen).length;
  const groupOf = (l) => GROUPS.find((g) => g.topics.includes(l.topic)) || GROUPS[0];

  /* ── skeleton ──────────────────────────────────────────────── */
  const cv = h('canvas.lb-hero__cv', { 'aria-hidden': 'true' });
  const hud = h('div.lb-hud.mono', { 'aria-hidden': 'true' },
    h('span', h('i', { style: { '--c': 'var(--d2)' } }), 'D — спрос'), h('span', h('i', { style: { '--c': 'var(--d1)' } }), 'S — предложение'),
    h('b.lb-hud__eq', 'P* = —  ·  Q* = —'));
  const chips = h('div.lb-chips', { role: 'group', 'aria-label': 'Фильтр по темам' });
  const q = h('input', { type: 'search', placeholder: 'Найти модель…', 'aria-label': 'Поиск по моделям', autocomplete: 'off', spellcheck: 'false' });
  const qx = h('button.lb-q__x', { type: 'button', hidden: true, 'aria-label': 'Очистить', html: CLOSE });
  const status = h('p.lb-status.mono', { 'aria-live': 'polite' });
  const body = h('div.lb-groups');
  const empty = h('div.lb-empty', { hidden: true }, h('b', '∅'), h('h3.h3', 'Таких моделей нет'), h('p', 'Измените фильтр или очистите поиск.'), h('button.btn.btn--sm', { type: 'button', id: 'lb-reset' }, 'Сбросить фильтры'));

  const rand = () => {
    const pool = labs.filter((l) => !seen(l)); const from = pool.length ? pool : labs;
    return from[Math.floor(Math.random() * from.length)];
  };

  el.append(h('div.lb',
    h('header.lb-hero', { id: 'lb-hero' },
      cv,
      h('div.wrap.lb-hero__in',
        h('p.eyebrow.eyebrow--dot.rv', 'Лаборатория · ' + nL + ' ' + plural(nL, ['модель', 'модели', 'моделей'])),
        h('h1.display.lb-hero__t.rv', { style: { '--d': '.05s' }, html: 'Лабо&shy;ратория<span class="hl"> живой экономики</span>' }),
        h('p.lede.lb-hero__lede.rv', { style: { '--d': '.1s' } }, nb('Каждая модель — рабочий стол с ползунками, графиками и заданиями. Сдвигайте кривые и смотрите, как перестраивается экономика. Попробуйте прямо здесь: поводите курсором по схеме.')),
        h('div.lb-hero__cta.rv', { style: { '--d': '.16s' } },
          h('a.btn.btn--primary', { href: '#/lab/' + labs[0].id, 'data-magnetic': '0.25', html: 'Начать с кругооборота ' + ARROW }),
          h('button.btn', { type: 'button', id: 'lb-rand', html: I_DICE + '<span>Случайная модель</span>' })),
        hud)),
    h('section.wrap.lb-stats',
      ...[[nL, plural(nL, ['модель', 'модели', 'моделей']), 'от кругооборота до IS–LM–BP'], [nTopics, plural(nTopics, ['тема', 'темы', 'тем']), 'учебника получили свою модель'], [nTasks, plural(nTasks, ['задание', 'задания', 'заданий']), 'проверьте себя на каждой модели'], [nSeen, 'открыто вами', 'из ' + nL + ' — отмечается автоматически']].map(([n, l, s], i) =>
        h('div.lb-stat.rv', { style: { '--d': i * .07 + 's' } }, h('b.lb-stat__n.display', { 'data-count': n, 'data-dur': '1500' }, '0'), h('span.lb-stat__l', l), h('span.lb-stat__s', nb(s))))),
    h('div.lb-bar',
      h('div.wrap.lb-bar__in', chips, h('label.lb-q', h('span.lb-q__i', { html: SEARCH }), q, qx), status)),
    h('div.wrap.lb-main', body, empty,
      h('section.lb-end',
        h('p.eyebrow.rv', 'А дальше'),
        h('h2.h1.rv', { style: { '--d': '.05s' }, html: 'Теория, задачи, <em>тесты</em>' }),
        h('div.lb-end__row',
          ...[['#/theory', 'Теория', 'Лекции с формулами и подсказками к терминам'], ['#/tasks', 'Задачи', 'Проверка по каждому полю и подробные решения'], ['#/tests', 'Тесты', 'Случайные вопросы по каждой теме']].map(([href, t, p], i) =>
            h('a.card.lb-end__c.rv', { href, style: { '--d': i * .08 + 's' } }, h('b', t), h('span', nb(p)), h('i', { html: ARROW }))))))));

  /* ── cards grouped by theme ────────────────────────────────── */
  const entries = []; // { lab, card, group, hay }
  GROUPS.forEach((g, gi) => {
    const ls = labs.filter((l) => g.topics.includes(l.topic));
    if (!ls.length) return;
    const grid = h('div.lb-grid');
    ls.forEach((l) => {
      const i = labs.indexOf(l);
      const card = labCard(l, i);
      card.classList.add('rv'); card.style.setProperty('--d', (grid.children.length % 3) * .08 + 's');
      const art = $('.lcard__art', card);
      const tc = taskCount(l);
      if (tc) art.append(h('span.lb-tag.mono', tc + ' ' + plural(tc, ['задание', 'задания', 'заданий'])));
      if (seen(l)) { art.append(h('span.lb-seen', { title: 'Вы уже открывали эту модель', html: I_CHECK + '<span>открыта</span>' })); card.classList.add('is-seen'); }
      grid.append(card);
      entries.push({ lab: l, card, g, hay: (labTitle(l) + ' ' + labTag(l) + ' ' + l.title + ' тема ' + l.topic).toLowerCase().replace(/ё/g, 'е') });
    });
    const sec = h('section.lb-grp', { 'data-g': g.id, style: { '--c': 'var(--' + g.c + ')' }, 'aria-labelledby': 'lbg-' + g.id },
      h('header.lb-grp__h',
        h('span.lb-grp__n.display.rv', rub(gi + 1)),
        h('div.lb-grp__t',
          h('p.eyebrow.rv', g.k + ' · ' + topicRange(ls.map((l) => l.topic).filter((v, k, a) => a.indexOf(v) === k))),
          h('h2.h1.lb-grp__h2.rv', { id: 'lbg-' + g.id, style: { '--d': '.05s' }, html: g.t }),
          h('p.lb-grp__p.rv', { style: { '--d': '.1s' } }, nb(g.p))),
        h('p.lb-grp__c.mono.rv', h('b.num', { 'data-n': '' }, ls.length), ' ', plural(ls.length, ['модель', 'модели', 'моделей']))),
      grid);
    g.sec = sec; g.grid = grid; g.n = ls.length;
    body.append(sec);
  });

  /* ── filters ───────────────────────────────────────────────── */
  let fg = 'all', fnew = false, fq = '';
  const chipEl = (id, label, n, color) => {
    const b = h('button.chip.lb-chip', { type: 'button', 'data-f': id, 'aria-pressed': 'false', style: color ? { '--c': 'var(--' + color + ')' } : null }, color ? h('i') : null, label, h('em.mono', n));
    b.addEventListener('click', () => { fg = id; apply(true); });
    return b;
  };
  chips.append(chipEl('all', 'Все', nL));
  GROUPS.forEach((g) => { if (g.n) chips.append(chipEl(g.id, g.s, g.n, g.c)); });
  const newChip = h('button.chip.lb-chip.lb-chip--new', { type: 'button', 'aria-pressed': 'false', title: 'Показать только модели, которые вы ещё не открывали' }, 'Не открывал', h('em.mono', nL - nSeen));
  newChip.addEventListener('click', () => { fnew = !fnew; apply(true); });
  chips.append(h('span.lb-chips__sep', { 'aria-hidden': 'true' }), newChip);

  function apply(animate) {
    const toks = fq.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
    let shown = 0;
    entries.forEach((e) => {
      const ok = (fg === 'all' || e.g.id === fg) && (!fnew || !seen(e.lab)) && toks.every((t) => e.hay.includes(t.length > 5 ? t.slice(0, -2) : t));
      e.card.hidden = !ok;
      if (ok) { shown++; if (animate && !reduced()) { e.card.classList.remove('lb-pop'); void e.card.offsetWidth; e.card.style.setProperty('--pi', Math.min(shown, 10)); e.card.classList.add('lb-pop'); } }
    });
    GROUPS.forEach((g) => { if (!g.sec) return; const n = g.grid.querySelectorAll('.lcard:not([hidden])').length; g.sec.hidden = !n; const c = $('.lb-grp__c b', g.sec); if (c) c.textContent = n; });
    $$('.lb-chip', chips).forEach((b) => { const on = b.dataset.f ? b.dataset.f === fg : fnew; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    empty.hidden = shown > 0;
    qx.hidden = !fq;
    status.textContent = shown === nL ? '' : 'Показано ' + shown + ' из ' + nL;
  }
  q.addEventListener('input', () => { fq = q.value.trim(); apply(true); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { q.value = ''; fq = ''; apply(true); e.stopPropagation(); } });
  qx.addEventListener('click', () => { q.value = ''; fq = ''; apply(true); q.focus(); });
  $('#lb-reset', el).addEventListener('click', () => { fg = 'all'; fnew = false; q.value = ''; fq = ''; apply(true); });
  apply(false);

  $('#lb-rand', el).addEventListener('click', () => { const l = rand(); toast('Открываем: ' + labTitle(l)); setTimeout(() => { location.hash = '#/lab/' + l.id; }, 350); });

  /* ── hero scene: a supply–demand cross that follows the pointer ── */
  const eq = createScene(cv, $('.lb-hud__eq', hud), $('#lb-hero', el));
  offs.push(eq.destroy);

  offs.push(enhance(el));
  return { title: 'Лаборатория', destroy() { offs.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); } };
}

/* ── the equilibrium scene (canvas) ───────────────────────────── */
function createScene(cv, readout, host) {
  const ctx = cv.getContext('2d');
  const css = () => getComputedStyle(document.documentElement);
  let col = {}, W = 0, H = 0, dpr = 1, raf = 0, vis = true, last = 0;
  const readCols = () => {
    const s = css(), g = (n) => s.getPropertyValue(n).trim() || '#888';
    col = { D: g('--d2'), S: g('--d1'), A: g('--accent'), L: g('--line-2'), L2: g('--line'), T: g('--ink-3'), I: g('--ink') };
  };
  readCols();
  const st = { px: 0, py: 0, tx: 0, ty: 0, lastMove: -9, shock: 0, trail: [], trailT: 0, t: 0, eqx: .5, eqy: .5 };

  const D = (x, sx) => { const u = x - sx; return .96 - .86 * u + .26 * (u - .5) * (u - .5); };
  const S = (x, ty) => .1 + ty + .66 * x + .32 * x * x;
  const solve = (sx, ty) => { let a = -.2, b = 1.3; for (let i = 0; i < 28; i++) { const m = (a + b) / 2; if (D(m, sx) - S(m, ty) > 0) a = m; else b = m; } const x = (a + b) / 2; return [x, S(x, ty)]; };

  const resize = () => {
    const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(10, r.width); H = Math.max(10, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    draw(performance.now());
  };
  const ro = new ResizeObserver(resize); ro.observe(cv);

  const plot = () => {
    const wide = W > 640;
    const l = wide ? W * .1 : 34, r = W - (wide ? W * .07 : 22), t = wide ? H * .2 : 24, b = H - (wide ? H * .17 : 34);
    return { l, r, t, b, w: r - l, h: b - t };
  };

  const onMove = (e) => {
    if (reduced()) return;
    const r = cv.getBoundingClientRect();
    const nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.2, 1.2), ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.2, 1.2);
    st.tx = nx; st.ty = ny; st.lastMove = performance.now() / 1000;
  };
  const onDown = (e) => { if (e.target.closest('a, button')) return; st.shock = 1; };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; if (vis && !raf && !reduced()) { last = performance.now(); raf = requestAnimationFrame(loop); } }, { threshold: 0 });
  io.observe(host);
  const offTheme = bus.on('theme', () => { setTimeout(() => { readCols(); draw(performance.now()); }, 30); });

  function curve(f, p, color, w, alpha, dash) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const x = i / 60, y = f(x); const X = p.l + x * p.w, Y = p.b - clamp(y, -.1, 1.12) * p.h; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!W) return;
    const tt = now / 1000, p = plot();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = st.px * .13, ty = -st.py * .15 + (st.shock ? 0 : 0);
    // grid
    ctx.lineWidth = 1; ctx.strokeStyle = col.L2; ctx.globalAlpha = .9;
    for (let i = 0; i <= 8; i++) { const x = p.l + p.w * i / 8; ctx.beginPath(); ctx.moveTo(x, p.t); ctx.lineTo(x, p.b); ctx.stroke(); }
    for (let i = 0; i <= 6; i++) { const y = p.b - p.h * i / 6; ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(p.r, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // axes
    ctx.strokeStyle = col.T; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.l, p.t - 8); ctx.lineTo(p.l, p.b); ctx.lineTo(p.r + 8, p.b); ctx.stroke();
    ctx.fillStyle = col.T; ctx.font = '500 12px ' + css().getPropertyValue('--f-mono'); ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('P', p.l + 8, p.t - 6); ctx.textAlign = 'right'; ctx.fillText('Q', p.r + 6, p.b + 16);
    // trail (ghost positions)
    st.trail.forEach((g, i) => { const a = (i + 1) / st.trail.length; curve((x) => D(x, g[0]), p, col.D, 2, .05 + .12 * a); curve((x) => S(x, g[1]), p, col.S, 2, .05 + .12 * a); });
    // live curves
    curve((x) => D(x, sx), p, col.D, 3.6, 1); curve((x) => S(x, ty), p, col.S, 3.6, 1);
    // flowing particles along both curves
    if (!reduced()) {
      for (let k = 0; k < 16; k++) {
        const u = ((k / 16) + tt * .06) % 1;
        let X = p.l + u * p.w, Y = p.b - clamp(D(u, sx), -.1, 1.12) * p.h; ctx.fillStyle = col.D; ctx.globalAlpha = .55 * Math.sin(u * Math.PI); ctx.beginPath(); ctx.arc(X, Y, 2.4, 0, 6.283); ctx.fill();
        const v = ((k / 16) + .5 * (1 / 16) - tt * .05 + 2) % 1;
        X = p.l + v * p.w; Y = p.b - clamp(S(v, ty), -.1, 1.12) * p.h; ctx.fillStyle = col.S; ctx.globalAlpha = .55 * Math.sin(v * Math.PI); ctx.beginPath(); ctx.arc(X, Y, 2.4, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // labels
    ctx.font = '700 15px ' + css().getPropertyValue('--f-mono'); ctx.textAlign = 'left';
    ctx.fillStyle = col.D; ctx.fillText('D', p.r - 18, p.b - clamp(D(1, sx), 0, 1.1) * p.h + 16);
    ctx.fillStyle = col.S; ctx.fillText('S', p.r - 14, p.b - clamp(S(1, ty), 0, 1.1) * p.h - 14);
    // equilibrium
    const [ex, ey] = solve(sx, ty); st.eqx = ex; st.eqy = ey;
    const X = p.l + ex * p.w, Y = p.b - ey * p.h;
    ctx.strokeStyle = col.A; ctx.lineWidth = 1.4; ctx.setLineDash([3, 6]); ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, p.b); ctx.moveTo(X, Y); ctx.lineTo(p.l, Y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const gr = ctx.createRadialGradient(X, Y, 0, X, Y, 54); gr.addColorStop(0, col.A); gr.addColorStop(1, 'transparent');
    ctx.globalAlpha = .26 + .08 * Math.sin(tt * 2.4); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, 54, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    const ph = reduced() ? 0 : (tt * .8) % 1;
    ctx.strokeStyle = col.A; ctx.lineWidth = 1.6; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(X, Y, 9 + ph * 34 + st.shock * 24 * ph, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = col.A; ctx.beginPath(); ctx.arc(X, Y, 7, 0, 6.283); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col.I; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(X, Y, 7, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = col.A; ctx.font = '600 13px ' + css().getPropertyValue('--f-mono'); ctx.textAlign = 'right'; ctx.fillText('P*', p.l - 8, Y); ctx.textAlign = 'center'; ctx.fillText('Q*', X, p.b + 16);
  }

  let hudT = 0;
  function loop(now) {
    raf = 0; if (!vis || reduced()) return;
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; st.t += dt;
    const idle = now / 1000 - st.lastMove > 2.2;
    if (idle) { st.tx = Math.sin(st.t * .55) * .8; st.ty = Math.cos(st.t * .41 + 1) * .7; }
    if (st.shock > 0) { st.shock = Math.max(0, st.shock - dt * 1.4); }
    const k = 1 - Math.exp(-dt * 3.2);
    st.px += (st.tx - st.px) * k; st.py += (st.ty - st.py) * k;
    st.trailT += dt;
    if (st.trailT > .11) { st.trailT = 0; st.trail.push([st.px * .13, -st.py * .15]); if (st.trail.length > 7) st.trail.shift(); }
    draw(now);
    hudT += dt; if (hudT > .12) { hudT = 0; readout.textContent = 'P* = ' + fmt(st.eqy * 100, 0) + '  ·  Q* = ' + fmt(st.eqx * 100, 0); }
    raf = requestAnimationFrame(loop);
  }
  if (reduced()) { st.px = .25; st.py = -.15; resize(); readout.textContent = 'P* = ' + fmt(st.eqy * 100, 0) + '  ·  Q* = ' + fmt(st.eqx * 100, 0); }
  else { last = performance.now(); raf = requestAnimationFrame(loop); }

  return { destroy() { cancelAnimationFrame(raf); raf = 0; vis = false; ro.disconnect(); io.disconnect(); host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerdown', onDown); offTheme && offTheme(); } };
}
