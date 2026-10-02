/* Справка о прохождении — #/me/report. Печатная страница A4, чёрно-белая; статус темы — словом.
   Всё считается из записей в браузере студента (S, QA, store «more.sro»). */
import { h, $, loadCSS, plural } from '../core/dom.js';
import { S, QA } from '../core/state.js';
import { store } from '../core/store.js';
import { ctx as planCtx } from '../core/plan.js';
import { topicStat, PREDICT_NA } from '../core/mastery.js';
import { TOPICS } from '../data/topics.js';

const NB = ' ';
const pctS = (a, b) => (b ? Math.round(100 * a / b) + NB + '%' : '—');

export async function load() {
  const [c] = await Promise.all([planCtx(), loadCSS('app/css/v-me2.css')]);
  return { c };
}

/** строки отчёта и итоги (чистая функция от учёта; экспортируется для печатной страницы преподавателя) */
export function reportData(c) {
  const s = S.data;
  const sroDone = new Set((store.get('more.sro', []) || []).map(Number));
  const sroAll = new Set(); c.ix.topics.forEach((tp) => (tp.sro || []).forEach((n) => sroAll.add(+n)));
  const rows = c.ix.topics.map((tp) => {
    const n = tp.n, st = topicStat(n, c);
    const labs = (tp.lab || []).filter((id) => !PREDICT_NA.has(id)), pred = labs.filter((id) => s.pr[id] && s.pr[id].n).length;
    const tl = (c.tasks || []).filter((t) => t.topic === n), solved = tl.filter((t) => (s.tk[t.id] || {}).dn).length;
    const ses = s.ses.filter((x) => x.topic === n && x.mode === 0 && x.n), best = ses.reduce((m, x) => (x.ok / x.n > m.r ? { r: x.ok / x.n, ok: x.ok, n: x.n } : m), { r: -1 });
    const started = st.opened || st.studied || ses.length || tl.some((t) => s.tk[t.id]) || labs.some((id) => s.pr[id]) || st.seen;
    return {
      n, title: (TOPICS[n] || {}).short || tp.title, lec: [st.studied, st.N], pred: labs.length ? [pred, labs.length] : null, tasks: tl.length ? [solved, tl.length] : null,
      test: best.r >= 0 ? { ok: best.ok, n: best.n, att: ses.length } : null, status: st.mastered ? 'Освоена' : st.passed ? 'Пройдена' : started ? 'Изучается' : 'Не начата',
      sro: (tp.sro || []).filter((x) => sroDone.has(+x)).length,
    };
  });
  const sec = Object.values(s.lec).reduce((a, l) => a + (l.s || 0), 0);
  const sum = (f) => rows.reduce((a, r) => a + (r[f] ? r[f][0] : 0), 0), tot = (f) => rows.reduce((a, r) => a + (r[f] ? r[f][1] : 0), 0);
  return {
    rows, sec, answers: QA.data.length, sesN: s.ses.length,
    lec: [sum('lec'), tot('lec')], pred: [sum('pred'), tot('pred')], tasks: [sum('tasks'), tot('tasks')],
    sro: [[...sroAll].filter((n) => sroDone.has(n)).length, sroAll.size],
    mastered: rows.filter((r) => r.status === 'Освоена').length,
  };
}
export const fmtTime = (sec) => { const m = Math.round(sec / 60); return m < 60 ? m + NB + 'мин' : Math.floor(m / 60) + NB + 'ч' + (m % 60 ? ' ' + (m % 60) + NB + 'мин' : ''); };

export function mount(el, ctx, { c }) {
  const d = reportData(c), prof = S.data.prof || (S.data.prof = { name: '', grp: '' });
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const field = (key, label, ph) => {
    const inp = h('input.m2r__in', { type: 'text', value: prof[key] || '', placeholder: ph, 'aria-label': label, autocomplete: key === 'name' ? 'name' : 'off', maxlength: 80, oninput: () => { prof[key] = inp.value.trim(); S.save(); } });
    return h('label.m2r__f', h('span', label), inp);
  };
  const cell = (p, empty = '—') => (p ? p[0] + ' из ' + p[1] : empty);
  const root = h('div.m2.m2r',
    h('header.m2__head.no-print',
      h('div', h('p.eyebrow.eyebrow--dot', 'Прогресс · справка'), h('h1.h1', { html: 'Справка о <em>прохождении</em>' }),
        h('p.lede', 'Заполните ФИО и группу — они хранятся только в этом браузере. Затем нажмите «Печать»: страница рассчитана на один лист A4, в чёрно-белом режиме статус темы указан словом.')),
      h('div.m2__acts', h('button.btn.btn--primary', { type: 'button', onclick: () => print() }, 'Печать'))),
    h('article.m2r__sheet', { 'aria-label': 'Справка о прохождении' },
      h('header.m2r__top',
        h('div', h('p.m2r__org', 'Интерактивный учебник «Макро»'), h('h2.m2r__h', 'Справка о прохождении курса «Макроэкономика»')),
        h('p.m2r__date', 'Дата: ', h('b', today))),
      h('div.m2r__who', field('name', 'ФИО', 'Фамилия Имя Отчество'), field('grp', 'Группа', 'например, ЭК-21')),
      h('table.m2r__t', { 'aria-label': 'Прохождение по темам' },
        h('thead', h('tr', h('th', 'Тема'), h('th', 'Лекций изучено'), h('th', 'Моделей с прогнозом'), h('th', 'Задач решено'), h('th', 'Лучший тест'), h('th', 'Попыток'), h('th', 'Статус'))),
        h('tbody', ...d.rows.map((r) => h('tr', h('th', { scope: 'row' }, h('span.mono', r.n + '. '), r.title), h('td', cell(r.lec)), h('td', cell(r.pred)), h('td', cell(r.tasks)),
          h('td', r.test ? r.test.ok + '/' + r.test.n + ' (' + pctS(r.test.ok, r.test.n) + ')' : '—'), h('td', r.test ? String(r.test.att) : '—'), h('td.m2r__st.is-' + ({ 'Освоена': 'm', 'Пройдена': 'p', 'Изучается': 'i', 'Не начата': 'n' })[r.status], r.status)))),
        h('tfoot', h('tr', h('th', 'Итого'), h('td', cell(d.lec)), h('td', d.pred[1] ? cell(d.pred) : '—'), h('td', cell(d.tasks)), h('td', { colspan: 3 }, 'тем со статусом «Освоена»: ' + d.mastered + ' из ' + d.rows.length)))),
      h('dl.m2r__sum',
        h('div', h('dt', 'Активное время за чтением лекций'), h('dd', d.sec ? fmtTime(d.sec) : '—')),
        h('div', h('dt', 'Ответов на вопросы (в журнале)'), h('dd', String(d.answers))),
        h('div', h('dt', 'Сессий вопросов'), h('dd', String(d.sesN))),
        h('div', h('dt', 'Заданий СРО отмечено'), h('dd', d.sro[1] ? d.sro[0] + ' из ' + d.sro[1] : String(d.sro[0])))),
      h('p.m2r__note', 'Сформировано автоматически по записям в браузере студента. Не является заверенным документом.')));
  el.append(root);
  return { title: 'Справка о прохождении', destroy() { /* нет подписок */ } };
}
