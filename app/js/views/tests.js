/* ─────────────────────────────────────────────────────────────
   Tests — #/tests: the list of 14 topic tests (+ one mixed test) with best results.
   #/tests/:topic is routed to quiz.js by the router; if this module is ever mounted with a
   topic param it hands over to the quiz so both entry points behave the same.
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, loadCSS, plural, reduced } from '../core/dom.js';
import { index, tests } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { TOPICS, icon, rub } from '../data/topics.js';
import * as quiz from './quiz.js';

const NB = ' ';
const svg = (inner) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });
const P_R = '<path d="M5 12h14M13 6l6 6-6 6"/>';
const qWord = (n) => n + NB + plural(n, ['вопрос', 'вопроса', 'вопросов']);
const tone = (p) => (p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--bad)');

export async function load(ctx) {
  if (ctx.params && ctx.params.topic) return quiz.load(ctx);
  await loadCSS('app/css/v-tests.css');
  const [ix, data] = await Promise.all([index(), tests()]);
  return { ix, data };
}

export function mount(el, ctx, d) {
  if (ctx.params && ctx.params.topic) return quiz.mount(el, ctx, d);
  const { ix, data } = d;
  const offs = [];
  const topics = Object.keys(data).map(Number).sort((a, b) => a - b);
  const totalQ = topics.reduce((a, t) => a + data[t].q.length, 0);
  const done = topics.filter((t) => (quiz.resultOf(t) || {}).attempts);
  const avg = done.length ? Math.round(done.reduce((a, t) => a + quiz.resultOf(t).best, 0) / done.length) : 0;
  const attempts = topics.reduce((a, t) => a + ((quiz.resultOf(t) || {}).attempts || 0), 0);
  const next = topics.find((t) => !(quiz.resultOf(t) || {}).attempts) || topics[0];

  const ring = h('div.ring.ts-ring', { style: { '--p': 0, '--s': '7.2rem', '--c': done.length ? tone(avg) : 'var(--accent)' }, role: 'img', 'aria-label': done.length ? `Пройдено ${done.length} из ${topics.length}` : 'Тесты ещё не пройдены' }, h('b.num', done.length), h('small', 'из ' + topics.length));
  const grid = h('div.ts-grid', { 'aria-label': 'Тесты по темам' });
  let filter = 'all';
  const cards = [];

  const render = () => {
    grid.replaceChildren();
    const shown = cards.filter((c) => filter === 'all' || (filter === 'done') === c.done);
    shown.forEach((c, i) => { c.el.style.setProperty('--d', (i % 4) * .06 + 's'); grid.append(c.el); });
    if (!shown.length) grid.append(h('p.ts-empty', filter === 'done' ? 'Пока ни один тест не пройден — начните с любого.' : 'Все тесты пройдены. Можно улучшать результаты.'));
    if (shown.length) enhance(grid);
  };

  cards.push(card('all', null, 'Смешанный тест', 'Вопросы из всех тем вперемешку — как мини-экзамен.', 20, totalQ));
  topics.forEach((t) => cards.push(card(t, TOPICS[t], TOPICS[t].short, TOPICS[t].tag, Math.min(data[t].ask, data[t].q.length), data[t].q.length)));

  const chips = [['all', 'Все'], ['new', 'Не пройдены'], ['done', 'Пройдены']].map(([v, l]) => {
    const b = h('button.chip', { type: 'button', 'aria-pressed': v === 'all' ? 'true' : 'false' }, l);
    b.addEventListener('click', () => { filter = v === 'new' ? 'new' : v; $$('.chip', chipRow).forEach((c) => { const on = c === b; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); }); render(); });
    if (v === 'all') b.classList.add('is-on');
    return b;
  });
  const chipRow = h('div.ts-filter', { role: 'group', 'aria-label': 'Фильтр' }, ...chips);

  el.append(h('div.ts',
    h('header.wrap.ts-head',
      h('div.ts-head__t',
        h('p.eyebrow.eyebrow--dot', 'Проверка знаний · ' + topics.length + ' теста · ' + totalQ + ' вопросов'),
        h('h1.h1', { html: 'Проверьте себя — <em>вопрос за вопросом</em>' }),
        h('p.lede', 'По каждой теме — тест из случайных вопросов: ответ проверяется сразу, а в конце вы увидите результат и разбор ошибок. Лучший результат запоминается.'),
        h('div.ts-head__a',
          h('a.btn.btn--primary', { href: '#/tests/' + next }, done.length ? 'Следующий: тема ' + next : 'Начать с темы 1', svg(P_R)),
          h('a.btn', { href: '#/tasks' }, 'Лучше решу задачи'))),
      h('div.ts-head__s', ring,
        h('div.ts-head__m', h('b', 'Ваш прогресс'),
          h('span', done.length ? `Пройдено ${done.length} из ${topics.length}` : 'Пока ничего не пройдено'),
          h('span.muted', done.length ? `Средний лучший результат ${avg}%` : 'Результаты сохраняются в браузере'),
          attempts ? h('span.muted', attempts + NB + plural(attempts, ['попытка', 'попытки', 'попыток'])) : null))),
    h('section.wrap.ts-list', h('div.ts-list__h', h('h2.eyebrow', 'Все тесты'), chipRow), grid)));
  render();

  const to = done.length / topics.length;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (reduced() || !to) { ring.style.setProperty('--p', to); return; }
    const t0 = performance.now(); let raf = 0;
    const f = (t) => { const p = Math.min(1, (t - t0) / 1100); ring.style.setProperty('--p', (to * (1 - Math.pow(1 - p, 3))).toFixed(4)); raf = p < 1 ? requestAnimationFrame(f) : 0; };
    raf = requestAnimationFrame(f); offs.push(() => cancelAnimationFrame(raf));
  }));
  offs.push(enhance(el));

  function card(key, m, title, tag, ask, bank) {
    const res = quiz.resultOf(key);
    const has = res && res.attempts;
    const col = m ? 'var(--' + m.c + ')' : 'var(--accent)';
    const a = h('a.card.ts-card.rv', { href: '#/tests/' + key, style: { '--c': col }, 'aria-label': `${m ? 'Тема ' + key + '. ' : ''}${title}: ${qWord(ask)} из ${bank}${has ? ', лучший результат ' + res.best + '%' : ', не пройден'}` },
      h('span.ts-card__n', key === 'all' ? '∞' : rub(key)),
      m ? h('span.ts-card__ic', { html: icon(key) }) : h('span.ts-card__ic.is-mix', { html: '<svg class="tic" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14h9l12 20h15M6 34h9l5-8M27 14h15"/><path d="m37 9 5 5-5 5M37 29l5 5-5 5"/></svg>' }),
      h('div.ts-card__b', h('h3.ts-card__t', title), h('p.ts-card__p', tag)),
      h('div.ts-card__f',
        h('div.ts-card__m', h('span', qWord(ask)), h('span', 'в банке ' + bank)),
        has
          ? h('div.ts-card__r', h('div.ring', { style: { '--p': res.best / 100, '--s': '2.9rem', '--c': tone(res.best) } }, h('b', res.best + '')), h('small', res.attempts + NB + plural(res.attempts, ['попытка', 'попытки', 'попыток'])))
          : h('span.ts-card__go', 'Пройти', svg(P_R))));
    return { el: a, done: !!has };
  }

  return { title: 'Тесты', destroy() { offs.forEach((f) => { try { f && f(); } catch (e) { /* ignore */ } }); } };
}
