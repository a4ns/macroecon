/* «Сегодня» — #/today. Один главный шаг и два запасных (V3_PLAN §3.1).
   Здесь же общие помощники оболочки: miniMap (главная и «Сегодня»), actionLabel, weekInfo. */
import { h, loadCSS, plural, reduced } from '../core/dom.js';
import { store } from '../core/store.js';
import { S } from '../core/state.js';
import * as plan from '../core/plan.js';
import { topicStat } from '../core/mastery.js';
import { lastAnswers } from '../core/qa.js';
import { enhance } from '../core/motion.js';
import { TOPICS, LABS } from '../data/topics.js';

const NB = ' ';
const DAY = 864e5;
const svg = (inner, cls) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls || null, html: inner });
const ARROW = '<path d="M5 12h14M13 6l6 6-6 6"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
export const dmy = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
export const minText = (m) => (m >= 60 ? Math.floor(m / 60) + NB + 'ч' + (m % 60 ? NB + (m % 60) + NB + 'мин' : '') : m + NB + 'мин');

/** неделя семестра по календарю из настроек (с учётом каникул). null, если календарь не задан */
export function weekInfo(set = S.data.set, now = Date.now()) {
  if (!set.start) return null;
  const W = set.weeks || 15;
  if (now < set.start) return { before: true, days: Math.ceil((set.start - now) / DAY), W };
  const pauses = (set.pause || []).filter((p) => Array.isArray(p) && p.length === 2);
  let eff = now - set.start;
  pauses.forEach(([a, b]) => { const lo = Math.max(a, set.start), hi = Math.min(b, now); if (hi > lo) eff -= hi - lo; });
  const week = Math.floor(eff / (7 * DAY)) + 1;
  return { week, W, pause: pauses.some(([a, b]) => now >= a && now <= b), over: week > W };
}

/** подпись кнопки карточки: «Читать 5.2 · 5 мин» */
export function actionLabel(card) {
  const hr = card.href || '', m = card.min ? ' · ' + card.min + NB + 'мин' : '';
  let t = card.title, x;
  if ((x = hr.match(/^#\/read\/([\d.]+)/))) t = 'Читать' + NB + x[1];
  else if ((x = hr.match(/^#\/lab\/([\w-]+)/))) t = 'Открыть модель' + (LABS[x[1]] ? ' «' + LABS[x[1]].short + '»' : '');
  else if (hr.startsWith('#/tasks') && (x = hr.match(/[?&]t=([\d.]+)/))) t = 'Решить задачу' + NB + x[1];
  else if ((x = hr.match(/^#\/tests\/(\d+)/))) t = 'Пройти тест темы' + NB + x[1];
  return t + m;
}

/** миникарта 14 тем: кольцо освоения вокруг номера; «Освоена» — заливка с галочкой; состояние и словом, и формой */
export function miniMap(c, { cur = null, row = false, legend = false } = {}) {
  const cc = Object.assign({}, c, { last: lastAnswers() });
  const L = 2 * Math.PI * 13;
  const items = c.ix.topics.map((tp) => {
    const st = topicStat(tp.n, cc), m = TOPICS[tp.n];
    const s = st.status === 'Освоена' ? 'done' : st.status === 'Пройдена' ? 'passed' : (st.opened || st.studied || st.seen || st.mastery) ? 'going' : 'none';
    const word = { done: 'освоена', passed: 'пройдена', going: 'изучается', none: 'не начата' }[s];
    const frac = s === 'done' || s === 'passed' ? 1 : Math.max(.08, st.mastery / 100);
    const inner = `<circle class="mm__t" cx="16" cy="16" r="13"/>` +
      (s === 'none' ? '' : s === 'done' ? `<circle class="mm__f" cx="16" cy="16" r="14.5"/><path class="mm__k" d="m10.5 16.4 3.6 3.6 7.4-7.6"/>` : `<circle class="mm__a" cx="16" cy="16" r="13" stroke-dasharray="${(L * frac).toFixed(1)} ${L.toFixed(1)}"/>`) +
      `<text class="mm__n" x="16" y="19.9">${tp.n}</text>`;
    return h('li', h('a', { href: '#/course/' + tp.n, 'data-s': s, class: cur === tp.n ? 'is-cur' : null, style: { '--c': 'var(--' + m.c + ')' }, title: `Тема ${tp.n}. ${m.short} · ${word}`, 'aria-label': `Тема ${tp.n}, ${m.short}: ${word}${s === 'going' ? ', ' + st.mastery + '%' : ''}`, 'aria-current': cur === tp.n ? 'step' : null, html: `<svg viewBox="0 0 32 32" aria-hidden="true">${inner}</svg>` }));
  });
  const ol = h('ol.mm', { class: row ? 'mm--row' : null, 'aria-label': 'Карта тем курса' }, ...items);
  // data-s на ссылке: стили ждут его на родителе .mm [data-s]
  if (!legend) return ol;
  const k = (inner, t) => h('span', h('svg', { viewBox: '0 0 32 32', 'aria-hidden': 'true', html: inner }), t);
  return h('div', ol, h('p.mm__leg',
    k('<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3.4" opacity=".6"/>', 'не начата'),
    k('<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="3"/><path d="M16 3a13 13 0 0 1 12.4 9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>', 'изучается'),
    k('<circle cx="16" cy="16" r="13" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="3"/>', 'пройдена'),
    k('<circle cx="16" cy="16" r="14.5" fill="currentColor"/><path d="m10.5 16.4 3.6 3.6 7.4-7.6" fill="none" stroke="var(--bg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', 'освоена')));
}

const TONE = {
  urgent: { label: 'Сначала срочное', cls: 'urgent', ic: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.3v.1"/>' },
  main: { label: 'Главное сейчас', cls: 'main', ic: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>' },
  side: { label: 'Закрепить', cls: 'side', ic: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>' },
  extra: { label: 'Если останется время', cls: 'extra', ic: '<path d="M12 4v16M4 12h16"/>' },
};
const BTN = { review: 'Повторить', errors: 'Разобрать', diag: 'Пройти диагностику', assign: 'Открыть задание', next: 'Заглянуть' };

export async function load() {
  const [c] = await Promise.all([plan.ctx(), loadCSS('app/css/v-today.css')]);
  return { c };
}

export function mount(el, ctx, { c }) {
  const now = Date.now(), set = S.data.set;
  const T = plan.today(c), tr = T.trail;
  const d = new Date(now);
  const weekday = d.toLocaleDateString('ru-RU', { weekday: 'long' });
  const live = tr.steps.filter((s) => s.state !== 'na');
  const done = live.filter((s) => s.state === 'done').length;

  /* полоса недели */
  const wk = weekInfo(set, now);
  const parts = [];
  if (wk && wk.before) parts.push(`До начала семестра ${wk.days}${NB}${plural(wk.days, ['день', 'дня', 'дней'])}`);
  else if (wk && wk.pause) parts.push('Каникулы: календарь на паузе');
  else if (wk && wk.over) parts.push('Семестр по календарю закончился');
  else if (wk) parts.push(`Неделя${NB}${wk.week} из${NB}${wk.W}`);
  parts.push(`тема${NB}${T.topic}`, `${done} из${NB}${live.length}${NB}${plural(live.length, ['шага', 'шагов', 'шагов'])}`);
  if (tr.minLeft > 0) parts.push(`осталось ≈${NB}${minText(tr.minLeft)}`);
  else if (tr.status !== 'Изучается') parts.push(tr.status.toLowerCase());
  const topicFrac = live.length ? done / live.length : 0;
  let pace = null;
  if (tr.minLeft > 0 && set.pace && !T.first) {
    const days = Math.ceil(tr.minLeft / set.pace);
    pace = days <= 1 ? `При ${set.pace}${NB}мин в день тему можно закончить сегодня.` : `При ${set.pace}${NB}мин в день тему можно закончить около ${dmy(now + (days - 1) * DAY)}.`;
  }
  const week = h('div.td__week.rv', { style: { '--d': '.05s' } },
    h('p.td__wl', ...parts.flatMap((p, i) => (i ? [h('i', { 'aria-hidden': 'true' }, ' · '), p] : [p]))),
    h('div.td__bar', { role: 'img', 'aria-label': `Тема ${T.topic}: сделано ${done} из ${live.length} шагов` }, h('i', { style: { '--p': topicFrac.toFixed(3) } })),
    pace ? h('p.td__pace', pace) : null,
    !wk ? h('p.td__pace', 'Календарь семестра не задан. ', h('a', { href: '#/settings' }, 'Задать в настройках')) : null);

  /* приветствие по состоянию */
  let note = null;
  if (T.first) {
    note = h('div.td__note.rv', { style: { '--d': '.1s' } }, h('p', 'Начните с короткой диагностики или сразу с лекции 1.1.'), h('a.td__lnk', { href: '#/start' }, 'Как устроен курс', svg(ARROW)));
  } else if (T.idle >= 10) {
    note = h('div.td__note.td__note--back.rv', { style: { '--d': '.1s' } }, h('p', h('b', 'С возвращением. '), T.due ? 'Начните с 5 карточек — это 2 минуты, дальше решим, что делать.' : 'Начните с короткого шага ниже — дальше решим, что делать.'),
      T.due ? h('a.btn.btn--sm.btn--primary', { href: '#/review?n=5' }, '5 карточек · 2' + NB + 'мин', svg(ARROW)) : null);
  }

  /* карточки действий */
  const cards = T.cards.map((k, i) => {
    const tone = TONE[k.tone] || TONE.side;
    const primary = i === 0;
    return h('article.tdc.rv', { class: 'tdc--' + tone.cls + (primary ? ' is-first' : ''), style: { '--d': (0.12 + i * .1).toFixed(2) + 's' } },
      h('div.tdc__top', h('p.tdc__k', svg(tone.ic), tone.label), k.min ? h('span.tdc__t', svg(CLOCK), '≈' + NB + k.min + NB + 'мин') : null),
      h('h2.tdc__h', k.title),
      h('p.tdc__p', k.sub),
      h('a.btn' + (primary ? '.btn--primary' : ''), { href: k.href, 'data-cursor': '' }, actionLabel(k), svg(ARROW)));
  });
  const cardsEl = cards.length
    ? h('section.td__cards', { 'aria-label': 'План на сегодня', class: 'n' + cards.length }, ...cards)
    : h('section.td__cards.td__cards--empty.rv', h('div.tdc.tdc--empty', h('h2.tdc__h', 'На сегодня всё'), h('p.tdc__p', 'Срочного нет, основные шаги темы выполнены. Загляните в прогресс или откройте что-нибудь из библиотеки.'), h('div.tdc__row', h('a.btn.btn--primary', { href: '#/me' }, 'Мой прогресс', svg(ARROW)), h('a.btn', { href: '#/library' }, 'Библиотека'))));

  /* «Последнее» */
  const last = store.get('last');
  let lastEl = null;
  if (last && last.route) {
    const lec = last.id && S.data.lec[last.id];
    const pct = lec && lec.d > .02 && lec.d < .95 ? Math.round(lec.d * 100) : 0;
    const what = last.id ? `Лекция${NB}${last.id}` : last.title;
    lastEl = h('a.card.td__last.rv', { href: last.route, 'data-spot': '', style: { '--d': '.2s' } },
      h('p.eyebrow', 'Последнее'),
      h('p.td__lt', what, last.id && last.title ? h('span', ' · ' + last.title) : null),
      h('p.td__ls', pct ? `Вы остановились на ${pct}${NB}%` : 'Вернуться к тому месту, где вы были'),
      h('span.td__go', 'Продолжить', svg(ARROW)));
  }
  const mapEl = h('section.card.td__map.rv', { style: { '--d': '.28s' }, 'aria-label': 'Карта тем' },
    h('div.td__mh', h('p.eyebrow', 'Курс на одной карте'), h('a.td__lnk', { href: '#/course' }, 'Открыть карту', svg(ARROW))),
    miniMap(c, { cur: T.topic, legend: true }));

  el.append(h('div.td.wrap',
    h('header.td__head',
      h('p.eyebrow.eyebrow--dot', weekday.charAt(0).toUpperCase() + weekday.slice(1)),
      h('h1.display.td__h1', 'Сегодня, ' + dmy(now))),
    week, note, cardsEl,
    h('div.td__bottom' + (lastEl ? '' : '.td__bottom--solo'), lastEl, mapEl)));
  const cleanup = enhance(el);
  return { title: 'Сегодня', destroy() { cleanup && cleanup(); } };
}
