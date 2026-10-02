/* Карта курса (V3_PLAN §6): 14 узлов-тем на «тропе». Десктоп — две змейки (темы 1–7 слева направо,
   8–14 справа налево), телефон — вертикальная лента. Узел: глиф темы, дуга освоения 0–100 %,
   подпись статуса словом, точка «есть карточки к повторению». Основа — <ol>, поэтому карта читается скринридером. */
import { h, s, plural, reduced } from '../core/dom.js';
import { TOPICS, icon } from '../data/topics.js';
import { topicWord, nextShort, nb } from './trail.js';

const NB = ' ';
const VW = 1200, VH = 470, X0 = 105, DX = 148, Y1 = 118, Y2 = 336, AMP = 20;

const badge = (word) => ({
  'Освоена': '<circle class="b-f" cx="9" cy="9" r="7"/><path class="b-c" d="M5.6 9.2l2.5 2.5 4.4-5"/>',
  'Пройдена': '<circle class="b-r" cx="9" cy="9" r="7"/><path class="b-f" d="M9 2a7 7 0 0 0 0 14z"/>',
  'Изучается': '<circle class="b-r" cx="9" cy="9" r="7"/>',
  'Не начата': '<circle class="b-r b-d" cx="9" cy="9" r="7"/>',
})[word];

/** позиция узла i (0…13) в координатах viewBox */
export function pos(i) {
  const row = i < 7 ? 0 : 1, col = row ? 13 - i : i;
  return { x: X0 + col * DX, y: (row ? Y2 : Y1) + (col % 2 ? AMP : -AMP), row, col };
}
function segPath(i) {
  const a = pos(i), b = pos(i + 1);
  if (a.row !== b.row) return `M${a.x},${a.y} C${a.x + 150},${a.y + 20} ${b.x + 150},${b.y - 20} ${b.x},${b.y}`;
  const m = (b.x - a.x) / 2; return `M${a.x},${a.y} C${a.x + m},${a.y} ${b.x - m},${b.y} ${b.x},${b.y}`;
}

/** items: [{n, st, tr, due}]; cur — номер текущей темы. Возвращает {el, destroy} */
export function ringMap(items, { cur = null } = {}) {
  const stage = h('div.rm__stage');
  const svg = s('svg.rm__svg', { viewBox: `0 0 ${VW} ${VH}`, 'aria-hidden': 'true', focusable: 'false' });
  const base = s('g.rm__base'), fill = s('g.rm__fills');
  const fills = [];
  items.slice(0, -1).forEach((it, i) => {
    const steps = it.tr.steps.filter((x) => x.state !== 'na'), done = steps.filter((x) => x.state === 'done').length;
    const f = steps.length ? done / steps.length : 0, d = segPath(i);
    base.append(s('path', { d, class: 'rm__seg' }));
    const p = s('path', { d, class: 'rm__fill', pathLength: 1, style: `--c:var(--${TOPICS[it.n].c});stroke-dasharray:0 1` });
    p.dataset.f = f.toFixed(3); fills.push(p); fill.append(p);
  });
  svg.append(base, fill);
  stage.append(svg);
  const list = h('ol.rm__list', { 'aria-label': 'Темы курса' });
  const arcs = [];
  items.forEach((it, i) => {
    const { n, st, tr } = it, m = TOPICS[n], p = pos(i), word = topicWord(st);
    const steps = tr.steps.filter((x) => x.state !== 'na'), done = steps.filter((x) => x.state === 'done').length;
    const nx = tr.next, ret = st.ret == null ? null : Math.round(st.ret * 100);
    const label = `Тема ${n}. ${m.short}. ${word}, освоено ${st.mastery} %. ${done} из ${steps.length} шагов выполнено.` + (nx ? ` Следующий шаг: ${nextShort(nx)}.` : '') + (it.due ? ` К повторению: ${it.due} ${plural(it.due, ['карточка', 'карточки', 'карточек'])}.` : '');
    const arc = s('circle', { class: 'rm__arc', cx: 50, cy: 50, r: 46, pathLength: 100, style: 'stroke-dasharray:0 100' });
    arc.dataset.p = String(st.mastery); if (!st.mastery) arc.setAttribute('opacity', '0'); arcs.push(arc);
    const ringSvg = s('svg.rm__ring', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' }, s('circle', { class: 'rm__trk', cx: 50, cy: 50, r: 46 }), arc);
    const a = h('a.rm__a', { href: '#/course/' + n, 'aria-label': label, 'aria-current': cur === n ? 'step' : null },
      h('span.rm__node', ringSvg, h('span.rm__ic', { html: icon(n, 'rm__tic') }),
        it.due ? h('span.rm__dot', { 'aria-hidden': 'true', title: `К повторению: ${it.due}` }) : null,
        h('span.rm__bd', { html: `<svg viewBox="0 0 18 18" aria-hidden="true">${badge(word)}</svg>` })),
      h('span.rm__l', h('b.rm__n', n), h('span.rm__tt', m.short)),
      h('span.rm__s', word === 'Не начата' ? word : word + ' · ' + st.mastery + NB + '%'),
      h('span.rm__x', nb(`${done} из ${steps.length} шагов`) + (nx ? ` · дальше: ${nextShort(nx)}` : '')));
    const pop = h('div.rm__pop', { 'aria-hidden': 'true' },
      h('b', `${n} · ${m.short}`),
      h('span', nb(`${done} из ${steps.length} шагов`) + ' · ' + (ret == null ? 'сохранность —' : `сохранность ${ret}${NB}%`)),
      h('span', nx ? 'Следующий шаг: ' + nextShort(nx) : word === 'Освоена' ? 'Все шаги выполнены' : 'Все обязательные шаги выполнены'),
      it.due ? h('span.rm__pd', `К повторению: ${it.due} ${plural(it.due, ['карточка', 'карточки', 'карточек'])}`) : null);
    const li = h('li.rm__i.is-' + ({ 'Освоена': 'm', 'Пройдена': 'p', 'Изучается': 'l', 'Не начата': 'z' })[word] + (cur === n ? '.is-cur' : '') + (p.col === 0 ? '.is-l' : p.col === 6 ? '.is-r' : '') + (p.row ? '.is-low' : ''),
      { style: { '--x': (p.x / VW * 100).toFixed(3) + '%', '--y': (p.y / VH * 100).toFixed(3) + '%', '--c': 'var(--' + m.c + ')', '--f': ((steps.length ? done / steps.length : 0)).toFixed(3) } }, a, pop);
    list.append(li);
  });
  stage.append(list);
  // «заливка»: после первого кадра — плавно до значений
  const apply = () => { arcs.forEach((a) => a.setAttribute('style', `stroke-dasharray:${a.dataset.p} 100`)); fills.forEach((f) => f.setAttribute('style', f.getAttribute('style').replace(/stroke-dasharray:[^;]*/, `stroke-dasharray:${f.dataset.f} 1`))); };
  let raf = 0;
  if (reduced()) { stage.classList.add('is-static'); apply(); } else raf = requestAnimationFrame(() => { raf = requestAnimationFrame(apply); });
  return { el: stage, destroy() { cancelAnimationFrame(raf); } };
}

export const mapLegend = () => h('ul.rm__lg', { 'aria-label': 'Обозначения статуса' },
  ...[['Не начата', 'ещё не открывали'], ['Изучается', 'есть начало'], ['Пройдена', 'шаги 1–4 выполнены'], ['Освоена', 'выполнен весь критерий']].map(([w, t]) => h('li', h('span.rm__lgb', { html: `<svg viewBox="0 0 18 18" aria-hidden="true">${badge(w)}</svg>` }), h('b', w), ' — ' + t)),
  h('li', h('span.rm__lgd', { 'aria-hidden': 'true' }), 'точка у узла — есть карточки к повторению'),
  h('li', h('span.rm__lga', { 'aria-hidden': 'true' }), 'дуга — процент освоения'));
