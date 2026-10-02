/* Тропа темы (V3_PLAN §2.1, §6): Лекции → Модель → Задачи → Тест → Повторение → СРО.
   Состояние кодируется формой и словом: ○ не начат, ◐ частично, ● выполнен, ┄ нет в теме, ➜ следующий.
   Используется в #/course/:n (topic.js), в подсказке карты курса и (позже) в «Сегодня». */
import { h, plural } from '../core/dom.js';
import { S, SR, dayNum } from '../core/state.js';
import { store } from '../core/store.js';
import { PREDICT_NA, labTaskFrac } from '../core/mastery.js';
import { taskScore } from '../core/track.js';
import { TOPICS, LABS } from '../data/topics.js';

const NB = ' ';
/** неразрывные пробелы перед единицами и «из» */
export const nb = (s) => String(s).replace(/(\d) (из|мин|%|шт\.|ч)(?![\u0400-\u04FF])/g, '$1' + NB + '$2').replace(/ (из|в|на|по|с|к|и|не) /g, ' $1' + NB).replace(/ ([—–]) /g, NB + '$1 ');
export const pc = (x) => Math.round((x || 0) * 100) + NB + '%';

export const STATE_WORD = { todo: 'не начат', part: 'частично', done: 'выполнен', na: 'нет в теме', next: 'следующий' };

/** слово-статус темы: «Не начата» / «Изучается» / «Пройдена» / «Освоена» (по критериям plan/mastery) */
export function topicWord(st) {
  if (st.status === 'Освоена' || st.status === 'Пройдена') return st.status;
  return st.mastery > 0 || st.opened || st.studied || st.seen || st.nTests ? 'Изучается' : 'Не начата';
}

/** SVG-глиф состояния шага (44×44). Форма несёт смысл; цвет — --c темы */
export function glyph(state, next = false, anim = false) {
  const ring = '<circle class="g-ring" cx="22" cy="22" r="15"/>';
  let body = '';
  if (next) body = '<circle class="g-halo" cx="22" cy="22" r="15"/>' + ring + '<path class="g-arrow" d="M14 22h15M23 16l6 6-6 6"/>';
  else if (state === 'done') body = ring + '<circle class="g-fill' + (anim ? ' g-anim' : '') + '" cx="22" cy="22" r="15"/><path class="g-chk' + (anim ? ' g-anim' : '') + '" d="M15 22.5l5 5 9-10"/>';
  else if (state === 'part') body = ring + '<path class="g-half" d="M22 7a15 15 0 0 0 0 30z"/>';
  else if (state === 'na') body = '<circle class="g-ring g-dash" cx="22" cy="22" r="15"/>';
  else body = ring;
  return `<svg class="tr__svg" viewBox="0 0 44 44" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** сколько минут осталось по шагу */
export const remMin = (s) => Math.max(0, Math.round((s.min || 0) * (1 - (s.frac || 0))));
const taskMin = (t) => Math.min(20, 6 + .5 * Math.max(4, Object.keys(t.answers || {}).length));

const labName = (id) => { const sh = (LABS[id] || {}).short || id; return /^Модель/.test(sh) ? sh : 'Модель «' + sh + '»'; };
/** «Читать лекцию 5.2» / «Решить задачу 5.2» … */
export function nextLabel(s) {
  if (!s) return '';
  const q = (s.href || '').split('?')[1] || '';
  const id = (s.href || '').split('?')[0].split('/').pop();
  if (s.k === 'lec') return 'Читать лекцию ' + id;
  if (s.k === 'lab') return labName(id);
  if (s.k === 'task') { const m = q.match(/t=([\d.]+)/); return m ? 'Решить задачу ' + m[1] : 'Решить задачи'; }
  if (s.k === 'test') return 'Тест темы';
  if (s.k === 'review') return 'Повторение карточек';
  return 'СРО';
}
/** короткая форма для подсказок: «Лекция 5.2», «Задача 5.2», «Тест» */
export function nextShort(s) {
  if (!s) return '';
  const q = (s.href || '').split('?')[1] || '', id = (s.href || '').split('?')[0].split('/').pop();
  if (s.k === 'lec') return 'Лекция ' + id;
  if (s.k === 'lab') return labName(id);
  if (s.k === 'task') { const m = q.match(/t=([\d.]+)/); return m ? 'Задача ' + m[1] : 'Задачи'; }
  return ({ test: 'Тест темы', review: 'Повторение', sro: 'СРО' })[s.k] || '';
}

/** колода темы: карточек всего / выучено (ящик ≥2) / к показу сегодня */
export function deckOf(n, c) {
  const keys = new Set(c.bank.unique(n).map((q) => q.ukey)), today = dayNum();
  const cs = Object.entries(SR.data.c).filter(([k]) => keys.has(k));
  return { total: cs.length, learned: cs.filter(([, v]) => v[0] >= 2).length, due: cs.filter(([, v]) => v[1] <= today).length };
}

/** сеансы по ≤30 мин: как в plan.trail, но с составом и временем */
export function sessions(tr) {
  const out = []; let cur = null, acc = 0;
  tr.steps.forEach((x, i) => {
    if (x.optional || x.state === 'na' || x.state === 'done') return;
    if (!cur || (acc + x.min > 30 && cur.keys.length)) { cur = { keys: [], idx: [], min: 0 }; out.push(cur); acc = 0; }
    cur.keys.push(x.k); cur.idx.push(i); acc += x.min; cur.min += remMin(x) || 1;
  });
  return out;
}
/** «Сеанс 1 из 2 · ≈25 мин» для сеанса, в котором лежит следующий шаг (или первого) */
export function sessionLine(tr) {
  const ss = sessions(tr); if (!ss.length) return '';
  const nk = tr.next && tr.next.k, i = Math.max(0, ss.findIndex((s) => s.keys.includes(nk)));
  return `Сеанс ${i + 1} из ${ss.length} · ≈${ss[i].min}${NB}мин`;
}

/* ── состояния отдельных пунктов ── */
const lecState = (id) => { const l = S.data.lec[id] || {}; return l.x ? ['done', 'изучена'] : l.o ? ['part', `открыта, прокручено ${Math.round((l.d || 0) * 100)}${NB}%`] : ['todo', 'не читана']; };
const mark = (st) => h('i.tr__mk.tr__mk--' + st, { 'aria-hidden': 'true' }, st === 'done' ? '●' : st === 'part' ? '◐' : '○');

function panelBody(step, tr, c) {
  const n = tr.topic, st = tr.stat, tp = c.ix.byTopic.get(n);
  const go = (href, label, primary) => href ? h('a.btn.btn--sm' + (primary ? '.btn--primary' : ''), { href }, label) : null;
  const ul = (...li) => h('ul.tr__ul', ...li);
  if (step.k === 'lec') {
    return [ul(...tp.lectures.map((l) => { const [s, w] = lecState(l.id); return h('li', mark(s), h('a', { href: '#/read/' + l.id }, h('b.mono', l.id), ' ', l.short || l.title), h('span.tr__r', nb(`${w} · ${l.min} мин`))); })),
      h('p.tr__note', 'Лекция считается изученной, когда вы дочитали её почти до конца или отметили это кнопкой внизу лекции.'),
      go(step.href, step.state === 'done' ? 'Перечитать' : 'Читать', step.next)];
  }
  if (step.k === 'lab') {
    if (step.state === 'na') {
      const rec = step.rec || [];
      return [h('p.tr__note', 'В этой теме своей модели нет, шаг не нужен для «Освоена».'),
        rec.length ? h('div', h('p.tr__note', 'Похожий механизм показывают модели:'), ul(...rec.map((id) => { const lab = c.ix.labs.get(id); return h('li', mark('todo'), h('a', { href: '#/lab/' + id }, (LABS[id] || {}).short || id, h('span.chip.tr__chip', 'похожий механизм')), h('span.tr__r', lab ? 'тема ' + lab.topic : '')); }))) : null];
    }
    return [ul(...step.labs.map((id) => { const pr = S.data.pr[id], f = labTaskFrac(id, c), na = PREDICT_NA.has(id);
      const stt = (na ? f >= 1 : pr && pr.n && f >= .5) ? 'done' : (pr && pr.n) || f > 0 ? 'part' : 'todo';
      const w = [na ? 'прогноз здесь не требуется' : pr && pr.n ? `прогнозов: ${pr.n}, верных строк ${pr.ok} из ${pr.tot}` : 'прогноза ещё не было', `задание ${Math.round(f * 100)}${NB}%`].join(' · ');
      return h('li', mark(stt), h('a', { href: '#/lab/' + id }, (LABS[id] || {}).short || id), h('span.tr__r', nb(w))); })),
      h('p.tr__note', 'Сначала предскажите, как изменятся показатели, потом проверьте на модели. Шаг засчитан, когда есть проверенный прогноз и отмечена половина пунктов «Задание».'),
      go(step.href, 'Открыть модель', step.next)];
  }
  if (step.k === 'task') {
    const tl = c.tasks.filter((t) => t.topic === n);
    return [ul(...tl.map((t) => { const sc = taskScore(t.id), r = S.data.tk[t.id] || {};
      const w = r.dn ? (r.help ? 'решена с подсказкой' : 'решена сама') : r.n ? `в процессе: ${r.f || 0} из ${r.tot || '?'} полей` : 'не начата';
      return h('li', mark(r.dn ? 'done' : r.n ? 'part' : 'todo'), h('a', { href: '#/tasks/' + n + '?t=' + t.id }, h('b.mono', t.id), ' ', t.title || 'Задача ' + t.id), h('span.tr__r', nb(`${w} · балл ${Math.round(sc * 100)}${NB}% · ≈${Math.round(taskMin(t))} мин`))); })),
      h('p.tr__note', 'Шаг выполнен, когда средний балл по задачам не ниже 70 %. Решение без подсказки даёт 100 %, с подсказкой — 60 %.'),
      go(step.href, 'К задачам', step.next)];
  }
  if (step.k === 'test') {
    const total = c.bank.byTopic.get(n).length, uniq = c.bank.unique(n).length;
    return [
      st.studied === 0 ? h('div.co.co--warn.tr__co', h('b', 'Вы ещё не читали лекции темы.'), h('span', 'Тест можно пройти как диагностику — результат не засчитается в освоение.')) : null,
      ul(h('li', mark(step.state), h('span', st.lastTest == null ? 'Тест ещё не проходили' : `Последний результат: ${Math.round(st.lastTest * 100)}${NB}% (нужно 70${NB}%) · попыток: ${st.nTests}`)),
        h('li', mark(st.seen >= st.E ? 'done' : st.seen ? 'part' : 'todo'), h('span', nb(`Просмотрено ${st.seen} из ${st.E} различных вопросов · в банке ${total} записей, ${uniq} различных`)))),
      h('p.tr__note', 'В тесте 10 вопросов; для «Освоена» нужны две сессии с результатом от 70 % в разные дни.'),
      go(step.href, 'Пройти тест', step.next)];
  }
  if (step.k === 'review') {
    const d = deckOf(n, c);
    return [h('p', d.total ? nb(`В колоде темы ${d.total} ${plural(d.total, ['карточка', 'карточки', 'карточек'])}: выучено ${d.learned}, к повторению сегодня ${d.due}.`) : 'Карточки появятся после первых ответов на вопросы темы.'),
      st.ret != null ? h('p.tr__note', nb(`Сохранность знаний по теме: ${Math.round(st.ret * 100)} %.`)) : h('p.tr__note', 'Сохранность считается, когда в колоде не меньше 5 карточек.'),
      go(step.href, d.due ? `Повторить ${d.due}` : 'Открыть повторение', step.next || d.due > 0)];
  }
  const sro = tp.sro || [], chk = store.get('more.sro', {});
  return [ul(...sro.map((x) => { const on = chk && (Array.isArray(chk) ? chk.includes(x) : chk[x]); return h('li', mark(on ? 'done' : 'todo'), h('a', { href: '#/more/sro' }, 'СРО ' + x), h('span.tr__r', on ? 'отмечено' : 'не отмечено')); })),
    h('p.tr__note', 'Самостоятельная работа — по заданию преподавателя; отметка ваш самоотчёт.'),
    go(step.href, 'Открыть СРО', step.next)];
}

/** полная тропа: <div.tr> с 6 узлами, сеансами и раскрывающимися панелями
 *  opts: { c, open?: 'lec'…, animate?: true } */
export function trailView(tr, { c, open = null, animate = true } = {}) {
  const n = tr.topic, steps = tr.steps, ss = sessions(tr);
  const root = h('div.tr', { style: { '--cols': steps.length } });
  const segs = h('div.tr__segs', { 'aria-hidden': 'true' });
  ss.forEach((s, i) => { const a = Math.min(...s.idx) + 1, b = Math.max(...s.idx) + 2; segs.append(h('div.tr__seg', { style: { gridColumn: a + ' / ' + b } }, h('b', `Сеанс ${i + 1} из ${ss.length}`), h('span', ` ≈${s.min}${NB}мин`))); });
  const list = h('ol.tr__list', { role: 'list', 'aria-label': 'Шаги темы ' + n });
  const nodes = [];
  steps.forEach((x, i) => {
    const sIdx = ss.findIndex((s) => s.idx[0] === i);
    if (sIdx >= 0) list.append(h('li.tr__sh', { role: 'presentation', 'aria-hidden': 'true' }, `Сеанс ${sIdx + 1} из ${ss.length} · ≈${ss[sIdx].min}${NB}мин`));
    const key = 'tr:' + n + ':' + x.k;
    const fresh = animate && x.state === 'done' && !S.data.seen[key];
    if (x.state === 'done' && !S.data.seen[key]) { S.data.seen[key] = 1; S.save(); }
    const id = `trp-${n}-${x.k}`;
    const word = x.next ? STATE_WORD.next : STATE_WORD[x.state];
    const btn = h('button.tr__n', { type: 'button', 'aria-expanded': 'false', 'aria-controls': id, style: { gridColumn: i + 1 } },
      h('span.tr__g', { html: glyph(x.state, !!x.next, fresh) }),
      h('b.tr__t', x.label),
      h('span.tr__w', word),
      h('span.tr__c', x.count ? nb(x.count) : NB));
    const panel = h('div.tr__p', { id, hidden: true, role: 'region', 'aria-label': x.label, style: {} }, h('p.tr__sub', nb(x.sub)), ...panelBody(x, tr, c).filter(Boolean));
    const li = h('li.tr__s.is-' + x.state + (x.next ? '.is-next' : '') + (x.optional ? '.is-opt' : ''), { role: 'listitem', dataset: { k: x.k }, 'aria-current': x.next ? 'step' : null }, btn, panel);
    nodes.push({ li, btn, panel, x });
    list.append(li);
  });
  const toggle = (it, on) => { it.btn.setAttribute('aria-expanded', on ? 'true' : 'false'); it.panel.hidden = !on; it.li.classList.toggle('is-open', on); };
  nodes.forEach((it) => it.btn.addEventListener('click', () => { const was = it.btn.getAttribute('aria-expanded') === 'true'; nodes.forEach((o) => toggle(o, false)); toggle(it, !was); }));
  // на десктопе панели живут в третьей строке сетки и показываются под всей тропой
  root.append(segs, list);
  const first = nodes.find((it) => it.x.k === open) || null; if (first) toggle(first, true);
  root.openStep = (k) => { const it = nodes.find((o) => o.x.k === k); if (it) { nodes.forEach((o) => toggle(o, false)); toggle(it, true); } };
  return root;
}

/** компактная полоска из 6 глифов (для подсказки карты и «Сегодня») */
export function miniTrail(tr) {
  return h('span.mt', { role: 'img', 'aria-label': tr.steps.map((s) => `${s.label}: ${STATE_WORD[s.next ? 'next' : s.state]}`).join(', ') },
    ...tr.steps.map((s) => h('i.mt__i.is-' + s.state + (s.next ? '.is-next' : ''), { title: `${s.label}: ${STATE_WORD[s.state]}` }, s.state === 'done' ? '●' : s.state === 'part' ? '◐' : s.state === 'na' ? '┄' : s.next ? '➜' : '○')));
}
