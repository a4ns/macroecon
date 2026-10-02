/* Траектория темы — #/course/:topic (V3_PLAN §2). Старый #/theory/:n редиректит сюда. */
import { h, loadCSS, plural } from '../core/dom.js';
import { S } from '../core/state.js';
import { lastAnswers } from '../core/qa.js';
import { ctx as dataCtx, trail } from '../core/plan.js';
import { docs } from '../core/data.js';
import { enhance } from '../core/motion.js';
import { TOPICS, icon, rub } from '../data/topics.js';
import { trailView, sessionLine, nextLabel, remMin, topicWord, nb } from '../ui/trail.js';
import { how } from '../ui/heat.js';

const NB = ' ';
const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CRIT = [
  ['lectures', 'Лекции изучены', 'lec'], ['models', 'Прогноз на модели', 'lab'], ['tasks', 'Задачи: средний балл от 70 %', 'task'],
  ['cover', 'Охват вопросов банка', 'test'], ['sessions', 'Две тестовые сессии в разные дни', 'test'], ['keep', 'Сохранность знаний от 70 %', 'review'],
];
const dfmt = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export async function load(ctx) {
  const [c, dc] = await Promise.all([dataCtx(), docs().catch(() => ({ appendix: [] })), loadCSS('app/css/v-course.css')]);
  const n = +ctx.params.topic;
  if (!c.ix.byTopic.get(n)) throw new Error('Нет такой темы: ' + ctx.params.topic);
  return { c, dc, n };
}

/** задания преподавателя, затрагивающие тему n (структура meta.items читается осторожно) */
function assignsFor(n, c) {
  const out = [], A = (S.data && S.data.assign) || {};
  Object.entries(A).forEach(([id, a]) => {
    const m = (a && a.meta) || {}; let hit = false;
    const topicOfId = (x) => { const t = parseInt(String(x), 10); return Number.isFinite(t) ? t : null; };
    (Array.isArray(m.items) ? m.items : []).forEach((it) => {
      if (!it || typeof it !== 'object') return;
      if (it.topic === n || (Array.isArray(it.topics) && it.topics.includes(n)) || it.n === n && it.k === 'sro') hit = true;
      (Array.isArray(it.ids) ? it.ids : []).forEach((x) => { if (topicOfId(x) === n) hit = true; });
      if (typeof it.id === 'string') { const lab = c.ix.labs.get(it.id); if (lab ? lab.topic === n : topicOfId(it.id) === n) hit = true; }
    });
    if (Array.isArray(m.topics) && m.topics.includes(n)) hit = true;
    if (hit) out.push({ id: (a && a.id) || id, m });
  });
  return out;
}

export function mount(el, ctx, { c, dc, n }) {
  const cc = { ...c, last: lastAnswers([0, 2, 3]) };
  const tp = c.ix.byTopic.get(n), meta = TOPICS[n], prev = c.ix.byTopic.get(n - 1), next = c.ix.byTopic.get(n + 1);
  const tr = trail(n, cc), st = tr.stat, word = topicWord(st);
  const mins = tp.lectures.reduce((a, l) => a + l.min, 0);
  const nxt = tr.next, sline = sessionLine(tr);
  const trailEl = trailView(tr, { c: cc, open: nxt ? nxt.k : null });
  const stDone = (x) => ({ 'Освоена': '●', 'Пройдена': '◐', 'Изучается': '○', 'Не начата': '┄' })[x];

  /* критерии «Освоена» */
  const mastAt = S.data.mast[n];
  let mi = 0;
  const rows = CRIT.map(([k, label, step]) => {
    const ok = st.crit[k], msg = ok ? null : tr.missing[mi++];
    const sh = tr.steps.find((x) => x.k === step);
    const note = ok && k === 'keep' && st.ret == null ? 'данных пока нет (нужно 5 карточек)' : ok && k === 'models' && st.M == null ? 'в теме нет моделей' : null;
    return h('li.ck__i.' + (ok ? 'is-ok' : 'is-no'), h('i.ck__m', { 'aria-hidden': 'true' }, ok ? '●' : '○'), h('span.ck__t', nb(msg || label), note ? h('small', ' — ' + note) : null, h('span.sr-only', ok ? ' — выполнено' : ' — не выполнено')),
      !ok && sh && sh.href ? h('a.ck__a', { href: sh.href }, 'Перейти') : null);
  });
  const miss = rows.filter((r) => r.classList.contains('is-no')).length;
  const check = h('section.ct__ck.card.rv',
    h('div.ct__ckh', h('h2.eyebrow', mastAt && miss ? 'Освоена — пора обновить' : miss ? 'Чего не хватает до «Освоена»' : 'Критерий «Освоена»'),
      how(['Тема «Освоена», когда одновременно: все лекции изучены; на каждой модели есть проверенный прогноз; средний балл задач от 70 %; просмотрено не меньше E различных вопросов; две тестовые сессии с результатом от 70 % в разные дни; сохранность от 70 %.', 'Освоено присваивается один раз и остаётся с датой; сохранность может показать «пора повторить».'])),
    miss === 0 ? h('p.ct__ckok', mastAt ? nb(`Тема освоена ${dfmt(mastAt)}. Чтобы знания не остыли, раз в неделю повторяйте карточки.`) : 'Все условия выполнены.') : null,
    h('ul.ck', ...rows));

  /* следующий шаг */
  const noLec = nxt && nxt.k === 'test' && st.studied === 0;
  const nextCard = h('section.ct__next.card.rv',
    h('div.ct__nb',
      h('p.eyebrow', word === 'Освоена' && !nxt ? 'Тема освоена' : nxt ? 'Следующий шаг' : 'Тема пройдена'),
      nxt ? h('h2.ct__nt', nextLabel(nxt)) : h('h2.ct__nt', word === 'Освоена' ? 'Всё сделано' : 'Обязательные шаги выполнены'),
      nxt ? h('p.ct__ns', nb(nxt.sub)) : h('p.ct__ns', tr.missing.length ? 'До «Освоена» ещё есть условия — они ниже.' : 'Осталось поддерживать знания: повторение раз в неделю.'),
      noLec ? h('p.co.co--warn.ct__w', 'Вы ещё не читали лекции темы. Тест можно пройти как диагностику — результат не засчитается в освоение.') : null,
      h('p.ct__meta.mono', [sline, tr.minLeft ? `осталось ≈${tr.minLeft}${NB}мин` : null].filter(Boolean).join(' · '))),
    h('div.ct__na', nxt ? h('a.btn.btn--primary.btn--lg', { href: nxt.href, html: `Следующий шаг ${ARR}` }) : h('a.btn.btn--primary.btn--lg', { href: next ? '#/course/' + next.n : '#/review', html: (next ? `Тема ${next.n}` : 'Повторение') + ' ' + ARR }),
      nxt && nxt.min ? h('span.ct__nm.mono', `≈${Math.max(1, remMin(nxt))}${NB}мин`) : null));

  /* плашки заданий преподавателя */
  const asg = assignsFor(n, c).map(({ id, m }) => h('aside.co.co--accent.ct__as',
    h('b', 'Задание преподавателя' + (m.t ? ': ' + m.t : '')),
    h('span', [m.by ? m.by : null, m.due ? 'срок ' + m.due : null].filter(Boolean).join(' · ') || 'Без срока'),
    m.goals ? h('p.ct__goals', h('b', 'Цели темы от преподавателя: '), String(m.goals)) : null,
    h('a.ct__al', { href: '#/a/' + id }, 'Открыть задание')));

  /* приложение к упражнению */
  const apps = ((dc && dc.appendix) || []).filter((a) => (tp.app || []).includes(a.n));
  const appBlock = apps.length ? h('section.ct__app.card.rv',
    h('div', h('p.eyebrow', 'Необязательное ответвление'), h('h3.ct__at', apps.length === 1 ? apps[0].title : 'Приложение к упражнению'), apps.length > 1 ? h('ul', ...apps.map((a) => h('li', a.title))) : null,
      h('p.ct__ns', 'Дополнительный материал к модели этой темы. Для «Освоена» не нужен, но помогает с заданиями.')),
    h('a.btn.btn--sm', { href: '#/more/appendix', html: `Открыть приложение ${ARR}` })) : null;

  const dots = (w) => stDone(w);
  const nb2 = (t, dir) => t ? h('a.card.ct__pc.' + dir, { href: '#/course/' + t.n }, h('small', dir === 'prev' ? '← Тема ' + t.n : 'Тема ' + t.n + ' →'), h('b', TOPICS[t.n].short), h('span.mono', dots(topicWord(trail(t.n, cc).stat)) + ' ' + topicWord(trail(t.n, cc).stat))) : h('span');

  const comp = (x) => (x == null ? '—' : Math.round(x * 100) + NB + '%');
  const rings = h('div.ct__ring', { style: { '--p': st.mastery / 100 }, role: 'img', 'aria-label': `Освоение ${st.mastery} процентов` }, h('b.num', st.mastery + NB + '%'), h('small', 'освоение'));
  el.append(h('article.ct', { style: { '--c': 'var(--' + meta.c + ')' } },
    h('header.ct__head.wrap',
      h('nav.crumbs', h('a', { href: '#/course' }, 'Курс'), h('i', '/'), h('span', 'Тема ' + n)),
      h('div.ct__hero', h('span.ct__big', { 'aria-hidden': 'true' }, rub(n)), h('div.ct__ic', { html: icon(n) }), rings),
      h('div.ct__tr', h('div.ct__tx',
        h('h1.ct__title', tp.title),
        h('p.lede', meta.tag),
        h('div.ct__chips',
          h('span.chip.ct__st.is-' + ({ 'Освоена': 'm', 'Пройдена': 'p', 'Изучается': 'l', 'Не начата': 'z' })[word], h('span.ct__sg', { 'aria-hidden': 'true' }, stDone(word)), word),
          h('span.chip', 'Уровень: ' + st.level),
          h('span.chip.mono', `${tp.lectures.length} ${plural(tp.lectures.length, ['лекция', 'лекции', 'лекций'])} · ${mins}${NB}мин`)),
        how([`Освоение = 20 % чтение + 15 % модель + 25 % задачи + 40 % вопросы (если моделей нет, её доля перераспределяется).`, `Сейчас: чтение ${comp(st.R)}, модель ${comp(st.M)}, задачи ${comp(st.P)}, вопросы ${comp(st.Q)} (охват ${comp(st.cov)} × верные с поправкой на угадывание ${comp(st.adj)}).`, 'Уровень — подпись по проценту: ниже 20 «Знакомство», до 50 «В процессе», до 80 «Уверенно», выше «Почти освоено». Статус «Освоена» даёт только критерий ниже, а не процент.'], 'как посчитано освоение')))),
    h('div.wrap.ct__body',
      ...asg,
      nextCard,
      h('section.ct__trail',
        h('h2.eyebrow', 'Тропа темы'),
        trailEl,
        h('p.ct__hint', 'Ничего не заперто: любой шаг открывается всегда. Нажмите на узел, чтобы увидеть детали.')),
      check,
      appBlock),
    h('nav.wrap', { 'aria-label': 'Соседние темы' }, h('div.ct__pn', nb2(prev, 'prev'), nb2(next, 'next')))));
  const done = enhance(el);
  return { title: 'Тема ' + n + '. ' + meta.short, destroy() { done && done(); } };
}
