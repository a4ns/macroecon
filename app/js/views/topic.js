/* Страница темы — #/theory/:topic */
import { h, loadCSS, plural } from '../core/dom.js';
import { index } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { TOPICS, LABS, icon, rub } from '../data/topics.js';
import { labCard } from '../ui/cards.js';

const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export async function load(ctx) {
  const [ix] = await Promise.all([index(), loadCSS('app/css/v-reader.css')]);
  const n = +ctx.params.topic, tp = ix.byTopic.get(n);
  if (!tp) throw new Error('Нет такой темы: ' + ctx.params.topic);
  return { ix, tp };
}
export function mount(el, ctx, { ix, tp }) {
  const m = TOPICS[tp.n], prev = ix.byTopic.get(tp.n - 1), next = ix.byTopic.get(tp.n + 1);
  const mins = tp.lectures.reduce((a, l) => a + l.min, 0);
  const firstUnread = tp.lectures.find((l) => !store.isRead(l.id)) || tp.lectures[0];
  el.append(h('article.tp', { style: { '--c': 'var(--' + m.c + ')' } },
    h('header.tp__head.wrap',
      h('nav.crumbs', h('a', { href: '#/theory' }, 'Теория'), h('i', '/'), h('span', 'Тема ' + tp.n)),
      h('div.tp__hero', h('span.tp__big', { 'aria-hidden': 'true' }, rub(tp.n)), h('div.tp__ic', { html: icon(tp.n) })),
      h('h1.tp__title', tp.title),
      h('p.lede', m.tag),
      h('p.rd__meta.mono', tp.lectures.length + ' ' + plural(tp.lectures.length, ['лекция', 'лекции', 'лекций']) + ' · ' + mins + ' мин'),
      h('div.tp__cta', h('a.btn.btn--primary', { href: '#/read/' + firstUnread.id }, store.isRead(firstUnread.id) ? 'Читать сначала' : (tp.lectures.some((l) => store.isRead(l.id)) ? 'Продолжить чтение' : 'Начать читать')),
        (tp.lab || []).length ? h('a.btn', { href: '#/lab/' + tp.lab[0] }, 'Открыть модель') : null)),
    h('section.wrap.tp__list',
      ...tp.lectures.map((l, i) => h('a.card.tp__l.rv', { href: '#/read/' + l.id, style: { '--d': i * .06 + 's' }, class: store.isRead(l.id) ? 'is-read' : '' },
        h('b.tp__id.mono', l.id), h('div', h('h3', l.title), h('p.mono', l.min + ' мин' + (l.figs ? ' · ' + l.figs + ' рис.' : ''))), h('i.tp__ok', { html: store.isRead(l.id) ? '✓' : ARR })))),
    (tp.lab || []).length || tp.tasks.length || tp.test ? h('section.wrap.tp__more',
      h('h2.eyebrow', 'Закрепить'),
      h('div.tp__acts',
        ...(tp.lab || []).map((id, i) => labCard(ix.labs.get(id), i)),
        tp.tasks.length ? h('a.card.tp__act', { href: '#/tasks/' + tp.n }, h('small', 'Практика'), h('b', 'Задачи по теме'), h('span.mono', tp.tasks.length + ' шт.')) : null,
        tp.test ? h('a.card.tp__act', { href: '#/tests/' + tp.n }, h('small', 'Проверка'), h('b', 'Тест по теме'), h('span.mono', 'с мгновенной проверкой')) : null)) : null,
    h('nav.wrap.rd__pn',
      prev ? h('a.card.rd__pn.prev', { href: '#/theory/' + prev.n }, h('small', '← Тема ' + prev.n), h('b', TOPICS[prev.n].short)) : h('span'),
      next ? h('a.card.rd__pn.next', { href: '#/theory/' + next.n }, h('small', 'Тема ' + next.n + ' →'), h('b', TOPICS[next.n].short)) : h('span'))));
  const c = enhance(el);
  return { title: 'Тема ' + tp.n + '. ' + m.short, destroy() { c && c(); } };
}
