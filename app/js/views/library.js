/* «Библиотека» — #/library: шесть существующих разделов с живой статистикой + поиск (открывает палитру). */
import { h, loadCSS, plural } from '../core/dom.js';
import { glossary } from '../core/data.js';
import { store } from '../core/store.js';
import { S, SR } from '../core/state.js';
import * as plan from '../core/plan.js';
import { enhance } from '../core/motion.js';
import { openPalette } from '../ui/palette.js';

const NB = ' ';
const svg = (inner, cls) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls || null, html: inner });
const ARROW = '<path d="M5 12h14M13 6l6 6-6 6"/>';
const IC = {
  theory: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  lab: '<path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 15h9"/>',
  tasks: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  tests: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.3 2.4 2.4 4.6-5"/>',
  glossary: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M10 8h5"/>',
  more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
};

export async function load() {
  const [c, gl] = await Promise.all([plan.ctx(), glossary(), loadCSS('app/css/v-today.css')]);
  return { c, gl };
}

export function mount(el, ctx, { c, gl }) {
  const { ix } = c, s = S.data;
  const nLec = ix.lectures.length, nLab = ix.labList.length, nTask = c.tasks.length;
  const nQ = c.bank.all.length, nT = ix.topics.length, nGl = gl.length;
  const readN = ix.lectures.filter((l) => store.isRead(l.id) || s.lec[l.id]).length;
  const studied = ix.lectures.filter((l) => (s.lec[l.id] || {}).x).length;
  const labsTried = ix.labList.filter((l) => { const d = store.get('lab.' + l.id.replace('-', '_') + '.done', []); return (Array.isArray(d) && d.length) || (s.pr[l.id] && s.pr[l.id].n); }).length;
  const solved = c.tasks.filter((t) => (s.tk[t.id] || {}).dn).length;
  const testTopics = ix.topics.filter((t) => store.get('tests.' + t.n) || s.ses.some((x) => x.topic === t.n && x.mode === 0)).length;
  const glCards = Object.keys(SR.data.c).filter((k) => /^g\d+$/.test(k)).length;
  const sroAll = ix.topics.reduce((a, t) => a + (t.sro || []).length, 0);
  const chk = store.get('more.sro', {}) || {};
  const sroDone = Array.isArray(chk) ? chk.length : Object.values(chk).filter(Boolean).length;

  const tiles = [
    { id: 'theory', href: '#/theory', c: 'd1', t: 'Теория', stat: [readN, ` из${NB}${nLec}${NB}${plural(nLec, ['лекции', 'лекций', 'лекций'])} прочитано`], sub: studied ? `Изучено: ${studied}. ` + `${nT}${NB}тем, всё в порядке курса.` : `${nT}${NB}тем. Читайте по порядку или с любого места.`, p: readN / nLec },
    { id: 'lab', href: '#/lab', c: 'd2', t: 'Лаборатория', stat: [labsTried, ` из${NB}${nLab}${NB}моделей опробовано`], sub: 'Сначала прогноз, потом проверка на живой модели.', p: labsTried / nLab },
    { id: 'tasks', href: '#/tasks', c: 'd3', t: 'Задачи', stat: [solved, ` из${NB}${nTask}${NB}${plural(nTask, ['задачи', 'задач', 'задач'])} решено`], sub: 'Числовые поля с проверкой; подсказка и решение — по запросу.', p: solved / nTask },
    { id: 'tests', href: '#/tests', c: 'd4', t: 'Тесты', stat: [testTopics, ` из${NB}${nT}${NB}тем пройдено`], sub: `${nQ}${NB}${plural(nQ, ['вопрос', 'вопроса', 'вопросов'])}. Ошибки сами попадают в повторение.`, p: testTopics / nT },
    { id: 'glossary', href: '#/glossary', c: 'd5', t: 'Глоссарий', stat: [glCards, ` из${NB}${nGl}${NB}${plural(nGl, ['термина', 'терминов', 'терминов'])} в карточках`], sub: 'Термины можно учить карточками в повторении.', p: glCards / nGl },
    { id: 'more', href: '#/more', c: 'd6', t: 'Ещё', stat: sroAll ? [sroDone, ` из${NB}${sroAll}${NB}СРО отмечено`] : null, sub: 'СРО, приложения, источники, об учебнике.', p: sroAll ? sroDone / sroAll : 0 },
  ];

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const search = h('button.lib__search.rv', { type: 'button', 'aria-label': 'Поиск по учебнику', onclick: () => openPalette() },
    svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'), h('span', 'Лекции, термины, задачи, модели…'), h('kbd.kbd', isMac ? '⌘K' : 'Ctrl K'));

  el.append(h('div.lib.wrap',
    h('header.lib__head',
      h('p.eyebrow.eyebrow--dot', 'Библиотека'),
      h('h1.display.lib__h1', { html: 'Всё <em>под рукой</em>' }),
      h('p.lede', 'Шесть разделов учебника. Когда нужно понять, что делать дальше, — откройте «Сегодня»; когда нужно что-то найти, — здесь.'),
      search),
    h('div.lib__grid', { role: 'list' }, ...tiles.map((t, i) => h('a.card.lib__tile.rv', { role: 'listitem', href: t.href, 'data-spot': '', style: { '--c': 'var(--' + t.c + ')', '--d': (.06 * i).toFixed(2) + 's' } },
      h('span.lib__ic', svg(IC[t.id])),
      h('h2.lib__t', t.t),
      t.stat ? h('p.lib__stat', h('b', String(t.stat[0])), t.stat[1]) : null,
      t.stat ? h('div.lib__bar', { 'aria-hidden': 'true' }, h('i', { style: { '--p': Math.min(1, t.p).toFixed(3) } })) : null,
      h('p.lib__sub', t.sub),
      h('span.lib__go', 'Открыть', svg(ARROW)))))));
  const cleanup = enhance(el);
  return { title: 'Библиотека', destroy() { cleanup && cleanup(); } };
}
