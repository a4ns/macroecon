/* Карта тем 14×5 (V3_PLAN §3.5, §6): «заполненные четверти» вместо цветовой раскраски + число.
   Плюс универсальное всплывающее «как посчитано». */
import { h } from '../core/dom.js';
import { TOPICS } from '../data/topics.js';
import { topicWord, deckOf, nb } from './trail.js';

const NB = ' ';

/** «как посчитано»: кнопка-сводка и всплывающий текст; закрывается по клику вне и Esc */
export function how(text, label = 'как посчитано') {
  const d = h('details.how', h('summary', label), h('div.how__b', { role: 'note' }, ...[].concat(text).map((t) => (typeof t === 'string' ? h('p', nb(t)) : t))));
  const close = (e) => { if (d.open && (e.type === 'keydown' ? e.key === 'Escape' : !d.contains(e.target))) { d.open = false; if (e.type === 'keydown') d.querySelector('summary').focus(); } };
  d.addEventListener('toggle', () => { if (d.open) { d.classList.remove('how--r'); const r = d.querySelector('.how__b').getBoundingClientRect(); if (r.right > innerWidth - 8) d.classList.add('how--r'); document.addEventListener('pointerdown', close); document.addEventListener('keydown', close); } else { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); } });
  return d;
}

/** четверть-пирог: v 0…1 → ○ ◔ ◑ ◕ ●; SVG, чтобы форма не зависела от шрифта */
export function quarter(v) {
  if (v == null) return '<svg class="q" viewBox="0 0 20 20" aria-hidden="true"><circle class="q__r q__na" cx="10" cy="10" r="7.5"/></svg>';
  const k = v <= 0 ? 0 : v < .375 ? 1 : v < .625 ? 2 : v < .875 ? 3 : 4;
  const sector = ['', 'M10 10V2.5A7.5 7.5 0 0 1 17.5 10z', 'M10 10V2.5A7.5 7.5 0 0 1 10 17.5z', 'M10 10V2.5A7.5 7.5 0 0 1 2.5 10 7.5 7.5 0 0 1 10 17.5z', ''][k];
  return `<svg class="q" viewBox="0 0 20 20" aria-hidden="true"><circle class="q__r" cx="10" cy="10" r="7.5"/>${k === 4 ? '<circle class="q__f" cx="10" cy="10" r="7.5"/>' : k ? `<path class="q__f" d="${sector}"/>` : ''}</svg>`;
}
const QW = ['пусто', 'четверть', 'половина', 'три четверти', 'полностью'];
const qword = (v) => (v == null ? 'нет данных' : v <= 0 ? QW[0] : v < .375 ? QW[1] : v < .625 ? QW[2] : v < .875 ? QW[3] : QW[4]);

const COLS = [
  ['Чтение', 'Лекций изучено из всех лекций темы.', 'lec'],
  ['Модель', 'Прогноз на модели и отмеченные пункты «Задание». Пусто (—), если моделей в теме нет.', 'lab'],
  ['Задачи', 'Средний балл по задачам темы (решено без подсказки = 100 %, с подсказкой = 60 %).', 'task'],
  ['Тест', 'Результат последнего тематического теста.', 'test'],
  ['Повторение', 'Доля карточек темы, которые уже в ящике 2 и выше («выучены»).', 'review'],
];

/** @param {{n:number, st:object, tr:object}[]} rows — по темам; c — контекст данных */
export function heat(rows, c) {
  const head = h('tr', h('th', { scope: 'col' }, 'Тема'), ...COLS.map((x) => h('th.ht__q', { scope: 'col', title: x[1] }, x[0])), h('th.ht__q', { scope: 'col', title: 'Итог по формуле освоения' }, 'Освоение'), h('th.ht__q', { scope: 'col', title: 'Средняя вероятность вспомнить карточки темы' }, 'Сохранность'));
  const cell = (v, text, label) => h('td.ht__c', { 'data-label': label }, h('span.ht__v', { html: quarter(v) }, ), h('span.ht__n', text), h('span.sr-only', ' ' + qword(v)));
  const body = rows.map(({ n, st, tr }) => {
    const d = deckOf(n, c), lab = tr.steps.find((s) => s.k === 'lab');
    const cells = [
      [st.R, st.N ? `${st.studied}/${st.N}` : '—'],
      lab && lab.state === 'na' ? [null, '—'] : [st.M, st.M == null ? '—' : Math.round(st.M * 100) + NB + '%'],
      st.P == null ? [null, '—'] : [st.P, Math.round(st.P * 100) + NB + '%'],
      st.lastTest == null ? [0, '—'] : [st.lastTest, Math.round(st.lastTest * 100) + NB + '%'],
      d.total ? [d.learned / d.total, `${d.learned}/${d.total}`] : [0, '—'],
    ];
    const a = h('a.ht__a', { href: '#/course/' + n, 'aria-label': `Тема ${n}. ${TOPICS[n].short}. ${topicWord(st)}` }, h('b.mono', n), h('span', TOPICS[n].short));
    const tri = h('tr', { style: { '--c': 'var(--' + TOPICS[n].c + ')' }, class: 'is-' + (st.mastered ? 'm' : st.passed ? 'p' : 'l') },
      h('th.ht__t', { scope: 'row' }, a, h('small', topicWord(st))),
      ...cells.map(([v, t], i) => cell(v, t, COLS[i][0])),
      cell(st.mastery / 100, st.mastery + NB + '%', 'Освоение'),
      cell(st.ret, st.ret == null ? '—' : Math.round(st.ret * 100) + NB + '%', 'Сохранность'));
    tri.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = '#/course/' + n; });
    return tri;
  });
  return h('div.dt.ht', h('table', h('caption.sr-only', 'Карта тем: что сделано по каждому шагу'), h('thead', head), h('tbody', ...body)));
}
export const heatLegend = () => h('p.ht__lg', { html: ['пусто', 'четверть', 'половина', 'три четверти', 'всё'].map((w, i) => `<span class="ht__lgi"><span class="ht__v">${quarter([0, .25, .5, .75, 1][i])}</span>${w}</span>`).join('') });
