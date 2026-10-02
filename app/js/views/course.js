/* Карта курса — #/course (V3_PLAN §5.2, §6) */
import { h, loadCSS, plural } from '../core/dom.js';
import { S } from '../core/state.js';
import { lastAnswers } from '../core/qa.js';
import { ctx as dataCtx, trail, currentTopic } from '../core/plan.js';
import { readiness } from '../core/mastery.js';
import { enhance } from '../core/motion.js';
import { TOPICS } from '../data/topics.js';
import { ringMap, mapLegend } from '../ui/ringmap.js';
import { how } from '../ui/heat.js';
import { deckOf, topicWord, nextLabel, nb } from '../ui/trail.js';

const NB = ' ';
const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export async function load() {
  const [c] = await Promise.all([dataCtx(), loadCSS('app/css/v-course.css')]);
  return { c };
}

export function mount(el, ctx, { c }) {
  const cc = { ...c, last: lastAnswers([0, 2, 3]) };
  const topics = c.ix.topics.map((t) => t.n);
  const items = topics.map((n) => { const tr = trail(n, cc); return { n, tr, st: tr.stat, due: deckOf(n, cc).due }; });
  const cur = currentTopic(cc), curIt = items.find((x) => x.n === cur) || items[0];
  const mastered = items.filter((x) => x.st.status === 'Освоена').length, passed = items.filter((x) => x.st.status === 'Пройдена').length;
  const left = items.reduce((a, x) => a + x.tr.minLeft, 0);
  const touched = items.some((x) => topicWord(x.st) !== 'Не начата');
  const hrs = left >= 90 ? `≈${Math.round(left / 60)}${NB}ч` : `≈${left}${NB}мин`;

  const map = ringMap(items, { cur });
  const rk = (S.data.set.rk && S.data.set.rk.length === 2 ? S.data.set.rk : [7, 14]).map(Number);
  const ranges = [[1, rk[0]], [rk[0] + 1, rk[1]]];
  const rkCard = ([a, b], i) => {
    const ns = topics.filter((n) => n >= a && n <= b), its = items.filter((x) => ns.includes(x.n));
    const ready = readiness(ns, cc), any = its.some((x) => x.st.mastery > 0 || x.st.ret != null);
    const worst = its.slice().sort((x, y) => x.st.V - y.st.V).reverse()[0];
    return h('article.card.rk', { style: { '--p': ready.toFixed(3) } },
      h('p.eyebrow', `Рубежный контроль ${i + 1}`),
      h('h3.rk__t', `Темы ${a}–${b}`),
      h('div.rk__row', any ? h('b.rk__v.num', Math.round(ready * 100) + NB + '%') : null, h('span.rk__l', any ? 'готовность' : 'готовность: пока нет данных')),
      h('div.rk__bar', { role: 'img', 'aria-label': any ? `Готовность ${Math.round(ready * 100)} процентов` : 'Готовность не определена' }, h('i')),
      h('p.rk__s', nb(`Освоено ${its.filter((x) => x.st.status === 'Освоена').length} из ${ns.length}`) + (any && worst ? ` · слабее всего тема ${worst.n}` : '')),
      h('div.rk__act', h('a.btn.btn--sm.btn--primary', { href: '#/exam?rk=' + (i + 1) }, 'Подготовка'), how(['Готовность = среднее по темам: половина — процент освоения, половина — сохранность знаний (по карточкам повторения).', 'Это индикатор готовности, а не прогноз оценки. Оценку по шкале показывает только пробный экзамен.'])));
  };
  const nxt = curIt.tr.next;
  el.append(h('div.cm.wrap',
    h('header.cm__head',
      h('p.eyebrow.eyebrow--dot', 'Курс'),
      h('h1.display', { html: 'Карта <em>курса</em>' }),
      h('p.lede', touched ? nb(`Освоено ${mastered} из ${topics.length}, пройдено ещё ${passed}. До конца курса ${hrs} работы по шагам.`) : nb('14 тем в порядке курса. Ничего не заперто: начинайте с любой, но по порядку проще.')),
      h('div.cm__cta',
        nxt ? h('a.btn.btn--primary', { href: nxt.href, html: `Продолжить: тема ${curIt.n} · ${nextLabel(nxt)} ${ARR}` }) : h('a.btn.btn--primary', { href: '#/course/' + curIt.n }, `Тема ${curIt.n}`),
        h('a.btn', { href: '#/theory' }, 'Оглавление лекций'), h('a.btn.btn--quiet', { href: '#/diag' }, 'Входная диагностика'))),
    h('section.cm__map.rv', { 'aria-label': 'Карта тем' }, map.el, mapLegend()),
    h('section.cm__rk',
      h('h2.eyebrow', 'Рубежные контроли'),
      h('div.cm__rkg', ...ranges.map(rkCard)))));
  const done = enhance(el);
  return { title: 'Карта курса', destroy() { map.destroy(); done && done(); } };
}
