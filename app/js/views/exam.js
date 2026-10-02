/* ─────────────────────────────────────────────────────────────
   Экзамен и подготовка к РК — #/exam (настройка), #/exam/run (ход), #/exam/result (итог).
   S.data.ex.run  = { id, seed, topics[], mode:'train'|'exam', lim, left, qids[], ans:{idx:{sel,ok}}, flags[], seen[], ms:{idx}, cur, away, t0 }
   S.data.ex.last = { …итог последней попытки + всё для разбора… };  S.data.ex.hist — компактный кольцевой список (≤30).
   В журнал ответы пишутся по сдаче (qa.record, mode = MODE.exam); пока идёт экзамен, правильность не показывается.
   ───────────────────────────────────────────────────────────── */
import { h, loadCSS, plural, toast, reduced } from '../core/dom.js';
import { S, MODE } from '../core/state.js';
import * as qa from '../core/qa.js';
import { prepare, seeded, shuffled } from '../core/qid.js';
import { ctx as planCtx, trail, currentTopic } from '../core/plan.js';
import { topicStat, readiness } from '../core/mastery.js';
import { enhance } from '../core/motion.js';
import { go } from '../core/router.js';
import { TOPICS } from '../data/topics.js';
import { seg } from '../ui/controls.js';
import { mountQuestion } from '../ui/qrun.js';

const NB = ' ';
const svg = (inner, sw = 2) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });
const P_R = '<path d="M5 12h14M13 6l6 6-6 6"/>', P_L = '<path d="M19 12H5M11 6l-6 6 6 6"/>', P_OK = '<path d="m4.5 12.5 5 5L19.5 7"/>', P_X = '<path d="M6 6l12 12M18 6 6 18"/>', P_FL = '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>', P_CLK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', P_RE = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
const qWord = (n) => n + NB + plural(n, ['вопрос', 'вопроса', 'вопросов']);
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const tname = (n) => (TOPICS[n] ? TOPICS[n].short : 'Тема ' + n);
const STEP_LABEL = { lec: 'Читать лекции', lab: 'Открыть модель', task: 'Решить задачи', test: 'Пройти тест темы', review: 'Повторить карточки', sro: 'Сделать СРО' };
const HIST_MAX = 30;

/* типовая казахстанская буквенная шкала — подтверждается кафедрой */
export const SCALE_KZ = [[95, 'A', '4,0'], [90, 'A−', '3,67'], [85, 'B+', '3,33'], [80, 'B', '3,0'], [75, 'B−', '2,67'], [70, 'C+', '2,33'], [65, 'C', '2,0'], [60, 'C−', '1,67'], [55, 'D+', '1,33'], [50, 'D', '1,0'], [0, 'F', '0']];
export function gradeOf(pct) { const p = Math.round(pct); const i = SCALE_KZ.findIndex(([min]) => p >= min); const [min, letter, gpa] = SCALE_KZ[i]; const max = i ? SCALE_KZ[i - 1][0] - 1 : 100; return { letter, gpa, range: `${min}–${max}` }; }

/* ── состав экзамена ───────────────────────────────────────── */
/** поровну с каждой темы (остаток — случайным темам), без дублей по ukey; детерминированно по seed */
export function compose(bank, topics, n, seed) {
  const rand = seeded(seed + ':c');
  const pools = new Map(topics.map((t) => [t, shuffled(bank.unique(t), rand)]));
  const k = topics.length; if (!k) return [];
  const used = new Set(), picked = new Map(topics.map((t) => [t, []]));
  const take = (t, cnt) => { const pool = pools.get(t); let got = 0; while (got < cnt && pool.length) { const Q = pool.shift(); if (used.has(Q.ukey)) continue; used.add(Q.ukey); picked.get(t).push(Q); got++; } return got; };
  const base = Math.floor(n / k), extra = new Set(shuffled(topics, rand).slice(0, n % k));
  let short = 0;
  topics.forEach((t) => { short += (base + (extra.has(t) ? 1 : 0)) - take(t, base + (extra.has(t) ? 1 : 0)); });
  // недобор из-за маленьких тем — добираем по кругу из тем, где ещё есть вопросы
  for (let guard = 0; short > 0 && guard < 500; guard++) { let any = false; for (const t of shuffled(topics, rand)) { if (short > 0 && take(t, 1)) { short--; any = true; } } if (!any) break; }
  return shuffled(topics.flatMap((t) => picked.get(t).map((Q) => Q.qid)), seeded(seed + ':o'));
}
const variant = (Q, seed) => prepare(Q, seeded(seed + ':v:' + Q.ukey));
const rkRanges = (c) => { const all = c.ix.topics.map((t) => t.n), r = Math.min(Math.max(1, +(S.data.set.rk || [7])[0] || 7), all.length); return [all.filter((n) => n <= r), all.filter((n) => n > r)]; };
const range = (a) => (a.length ? (a.length === 1 ? '' + a[0] : a[0] + '–' + a[a.length - 1]) : '—');

export async function load() {
  await loadCSS('app/css/v-exam.css');
  return { c: await planCtx() };
}

export function mount(el, ctx, { c }) {
  const stage = ctx.params.stage;
  const root = h('div.ex'); el.append(root);
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
  let inst;
  if (stage === 'run') inst = runView(root, c);
  else if (stage === 'result') inst = resultView(root, c);
  else inst = setupView(root, c, ctx);
  const off = enhance(root);
  return { title: inst.title, destroy() { inst.destroy && inst.destroy(); off && off(); } };
}

/* ═══ настройка ═══════════════════════════════════════════════ */
function setupView(root, c, ctx) {
  const bank = c.bank, all = c.ix.topics.map((t) => t.n);
  const [rk1, rk2] = rkRanges(c);
  const ready1 = readiness(rk1, c), ready2 = readiness(rk2, c);
  const run = S.data.ex.run;
  const q = ctx.query || {};
  let sel = new Set(q.rk === '1' ? rk1 : q.rk === '2' ? rk2 : (rk1.includes(currentTopic(c)) ? rk1 : rk2));
  let nQ = 30, minutes = 36, minutesTouched = false, mode = 'exam';
  const stat = new Map(all.map((n) => [n, topicStat(n, c)]));
  const pct = (x) => Math.round(x * 100);

  /* готовность */
  const rkCard = (label, topics, ready, num) => {
    const rows = topics.map((n) => {
      const st = stat.get(n), tr = trail(n, c), nx = tr.next;
      const good = st.status === 'Освоена';
      const href = nx && nx.href ? nx.href : '#/course/' + n;
      return h('li.ex-row', { class: good ? 'is-good' : st.mastery < 35 ? 'is-low' : '' },
        h('a.ex-row__t', { href: '#/course/' + n }, h('b.num', n), h('span', tname(n))),
        h('div.ex-row__b', { role: 'img', 'aria-label': `Освоение ${st.mastery}%` }, h('i', { style: { '--w': st.mastery + '%' } }), h('span.num', st.mastery + '%')),
        good ? h('span.ex-row__r.muted', 'Освоена')
          : h('a.ex-row__r', { href }, h('span', st.reason), h('small', (nx ? STEP_LABEL[nx.k] : 'К теме') + ' →')));
    });
    return h('article.ex-rk.rv', { style: { '--d': (num - 1) * .1 + 's' } },
      h('header.ex-rk__h',
        h('div', h('h3.ex-rk__t', 'Готовность к РК' + num), h('p.ex-rk__s', 'Темы ' + range(topics))),
        h('div.ring.ex-ring', { style: { '--p': ready, '--s': '4.6rem', '--c': ready >= .7 ? 'var(--ok)' : ready >= .4 ? 'var(--warn)' : 'var(--bad)' }, role: 'img', 'aria-label': `Готовность ${pct(ready)} процентов` }, h('b.num', pct(ready) + '%'))),
      h('p.ex-rk__n', 'Индикатор готовности, а не прогноз оценки. Оценку показывает только пробный экзамен.'),
      h('ul.ex-rows', ...rows),
      h('a.btn.btn--sm', { href: '#/exam?rk=' + num, onclick: (e) => { e.preventDefault(); setSel(topics); document.getElementById('ex-form').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } }, 'Пробный РК' + num, svg(P_R)));
  };

  /* план на три дня */
  const errs = qa.openErrors(bank).length;
  const weak = all.map((n) => stat.get(n)).filter((st) => st.status !== 'Освоена').sort((a, b) => b.V - a.V).slice(0, 3).map((st) => st.n);
  const days = [
    ['День 1', 'Ошибки и слабые темы', errs ? `В журнале ${errs} ${plural(errs, ['неразобранная ошибка', 'неразобранные ошибки', 'неразобранных ошибок'])}. Разберите их, затем — слабые темы${weak.length ? ': ' + weak.join(', ') : ''}.` : 'Неразобранных ошибок нет. Пройдите слабые темы' + (weak.length ? ': ' + weak.join(', ') : '') + '.', errs ? '#/me/errors' : '#/course' + (weak[0] ? '/' + weak[0] : ''), errs ? 'Открыть журнал ошибок' : 'К слабой теме'],
    ['День 2', 'Карточки повторения', 'Верните то, что начало забываться: короткие серии карточек, пока знания не остыли.', '#/review', 'Повторить карточки'],
    ['День 3', 'Пробный РК', '30 вопросов, 36 минут, без подсказок. Результат покажет не больше трёх тем для доработки.', '#/exam', 'Настроить пробный РК'],
  ];
  const plan = h('ol.ex-plan', ...days.map(([d, t, p, href, cta], i) => h('li.ex-day.rv', { style: { '--d': i * .08 + 's' } },
    h('span.ex-day__d', d), h('h3.ex-day__t', t), h('p', p),
    h('a.ex-day__a', { href, onclick: i === 2 ? (e) => { e.preventDefault(); setCfg(30, 36, 'exam'); document.getElementById('ex-form').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } : null }, cta, svg(P_R)))));

  /* форма */
  const topicChips = all.map((n) => h('button.chip.ex-tc', { type: 'button', 'aria-pressed': 'false', 'data-n': n, title: tname(n), 'aria-label': `Тема ${n}: ${tname(n)}`, onclick: () => { sel.has(n) ? sel.delete(n) : sel.add(n); paint(); } }, n));
  const same = (a) => a.length === sel.size && a.every((n) => sel.has(n));
  const presets = [['РК1 · ' + range(rk1), rk1], ['РК2 · ' + range(rk2), rk2], ['Все ' + all.length, all]].map(([l, a]) => h('button.chip.ex-pc', { type: 'button', 'aria-pressed': 'false', onclick: () => setSel(a) }, l));
  function setSel(a) { sel = new Set(a); paint(); }
  function setCfg(n, m, md) { nQ = n; minutes = m; minutesTouched = false; mode = md; qSeg.set(n, { silent: true }); mSeg.set(md, { silent: true }); minIn.value = m; paint(); }
  const qSeg = seg({ label: 'Вопросов', options: [20, 30, 40, 60].map((v) => ({ v, label: String(v) })), value: nQ, onChange: (v) => { nQ = v; if (!minutesTouched) { minutes = Math.round(v * 1.2); minIn.value = minutes; } paint(); } });
  const mSeg = seg({ label: 'Режим', options: [{ v: 'train', label: 'Тренировка' }, { v: 'exam', label: 'Экзамен' }], value: mode, onChange: (v) => { mode = v; paint(); } });
  const minIn = h('input.ex-min', { type: 'number', min: 5, max: 240, step: 1, value: minutes, inputmode: 'numeric', id: 'ex-min', onchange: () => { minutesTouched = true; minutes = Math.min(240, Math.max(5, +minIn.value || minutes)); minIn.value = minutes; paint(); } });
  const modeNote = h('p.ex-hint'), sum = h('p.ex-sum', { 'aria-live': 'polite' }), warn = h('p.ex-warn', { hidden: true });
  const start = h('button.btn.btn--primary.btn--lg', { type: 'button', onclick: begin }, 'Начать', svg(P_R));
  function paint() {
    topicChips.forEach((b) => { const on = sel.has(+b.dataset.n); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on); });
    [rk1, rk2, all].forEach((a, i) => { const on = same(a); presets[i].setAttribute('aria-pressed', String(on)); presets[i].classList.toggle('is-on', on); });
    const t = [...sel].sort((a, b) => a - b), pool = t.reduce((a, n) => a + bank.unique(n).length, 0), n = Math.min(nQ, pool);
    modeNote.textContent = mode === 'exam' ? 'Экзамен: правильность не видна до сдачи, результат — в конце. Подсказок нет.' : 'Тренировка: после каждого ответа сразу видно, верно ли. Время всё равно идёт.';
    sum.textContent = t.length ? `${qWord(n)} · ${minutes}${NB}мин · ${t.length === 1 ? 'тема ' + t[0] : t.length + ' ' + plural(t.length, ['тема', 'темы', 'тем'])}${t.length > 1 ? ', ' + (n / t.length >= 1 ? 'по ' + (Math.floor(n / t.length) === Math.ceil(n / t.length) ? Math.floor(n / t.length) : Math.floor(n / t.length) + '–' + Math.ceil(n / t.length)) : 'не со всех') : ''}` : 'Выберите хотя бы одну тему.';
    warn.hidden = !(t.length && pool < nQ); warn.textContent = `В выбранных темах только ${qWord(pool)} без повторов — экзамен будет короче.`;
    start.disabled = !t.length; start.toggleAttribute('disabled', !t.length);
  }
  function begin() {
    const t = [...sel].sort((a, b) => a - b); if (!t.length) return;
    const seed = Date.now().toString(36);
    const qids = compose(bank, t, nQ, seed);
    S.data.ex.run = { id: seed, seed, topics: t, mode, lim: minutes * 60000, left: minutes * 60000, qids, ans: {}, flags: [], seen: [0], ms: {}, cur: 0, away: 0, t0: Date.now() };
    S.save(true); go('/exam/run');
  }

  const hist = (S.data.ex.hist || []).slice(-3).reverse();
  const resume = run && run.qids && run.qids.length ? h('section.ex-resume.wrap',
    h('div', h('b', 'Есть незавершённый экзамен'), h('p', `Осталось ${mmss(run.left)} · отвечено ${Object.keys(run.ans).length} из ${run.qids.length}. Время стоит, пока страница закрыта.`)),
    h('div.ex-resume__a', h('a.btn.btn--primary', { href: '#/exam/run' }, `Продолжить экзамен, осталось ${mmss(run.left)}`, svg(P_R)),
      h('button.btn.btn--quiet', { type: 'button', onclick: () => { if (confirm('Отказаться от начатого экзамена? Ответы не сохранятся.')) { S.data.ex.run = null; S.save(true); resume.remove(); } } }, 'Отказаться'))) : null;

  root.append(...[
    h('header.wrap.ex-head',
      h('p.eyebrow.eyebrow--dot', 'Рубежный контроль'),
      h('h1.h1', { html: 'Подготовка <em>к РК</em>' }),
      h('p.lede', 'Главный антидот к «знаю, но на экзамене не вспомнил» — тренировка в условиях контроля: время ограничено, подсказок нет.')),
    resume,
    h('section.wrap.ex-sec', h('h2.eyebrow', 'Где вы сейчас'), h('div.ex-rks', rkCard('РК1', rk1, ready1, 1), rkCard('РК2', rk2, ready2, 2))),
    h('section.wrap.ex-sec', h('h2.eyebrow', 'План на три дня'), plan),
    h('section.wrap.ex-sec#ex-form', { tabindex: -1 },
      h('h2.eyebrow', 'Настроить экзамен'),
      h('form.ex-form', { onsubmit: (e) => { e.preventDefault(); begin(); } },
        h('fieldset.ex-fs', h('legend', 'Темы'), h('div.ex-presets', ...presets), h('div.ex-chips', ...topicChips)),
        h('div.ex-opts',
          qSeg.el,
          h('div.seg-wrap', h('label.seg__lab', { for: 'ex-min' }, 'Время, минут'), h('div.ex-minw', minIn, h('small', 'по умолчанию 1,2 мин на вопрос'))),
          mSeg.el),
        modeNote, warn,
        h('div.ex-go', sum, start))),
    hist.length ? h('section.wrap.ex-sec', h('h2.eyebrow', 'Прошлые попытки'),
      h('ul.ex-hist', ...hist.map((x) => h('li', h('time', new Date(x.t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })), h('b.num', x.pct + '%'), h('span', `${x.ok} из ${x.n} · ${x.mode === 'exam' ? 'экзамен' : 'тренировка'} · темы ${rangeStr(x.topics)}`)))),
      h('a.btn.btn--quiet', { href: '#/exam/result' }, 'Открыть последний итог', svg(P_R))) : null].filter(Boolean));
  paint();
  return { title: 'Подготовка к РК' };
}
const rangeStr = (a) => { if (!a || !a.length) return '—'; const s = a.slice().sort((x, y) => x - y); return s.length > 3 && s[s.length - 1] - s[0] === s.length - 1 ? s[0] + '–' + s[s.length - 1] : s.join(', '); };

/* ═══ ход ═════════════════════════════════════════════════════ */
function runView(root, c) {
  const bank = c.bank, run = S.data.ex.run;
  if (!run || !run.qids || !run.qids.length) {
    root.append(h('section.wrap--narrow.ex-empty', h('h1.h1', { html: 'Нет начатого <em>экзамена</em>' }), h('p.lede', 'Настройте экзамен — и он появится здесь.'), h('a.btn.btn--primary', { href: '#/exam' }, 'К подготовке', svg(P_R))));
    return { title: 'Экзамен' };
  }
  const N = run.qids.length, train = run.mode === 'train';
  const answered = (i) => !!run.ans[i];
  let cur = Math.min(N - 1, Math.max(0, run.cur || 0)), r = null, replaying = false, alive = true;
  let tq = performance.now(), left0 = run.left, t0 = performance.now();
  const timers = [];
  const spent = (i) => run.ms[i] || 0;
  const leave = () => { run.ms[cur] = spent(cur) + Math.round(performance.now() - tq); tq = performance.now(); };
  const left = () => Math.max(0, left0 - (performance.now() - t0));
  const snap = () => { run.left = Math.round(left()); run.cur = cur; run.savedAt = Date.now(); };
  const save = (now) => { leave(); snap(); S.save(!!now); };

  /* верхняя панель */
  const timerEl = h('span.ex-timer__v.num', mmss(left()));
  const lowTxt = h('span.ex-timer__w', { hidden: true });
  const live = h('div.ex-live', { 'aria-live': 'polite', role: 'status' });
  const doneEl = h('span.ex-bar__p');
  const bar = h('div.ex-bar', h('div.ex-timer', { role: 'timer', 'aria-label': 'Осталось времени' }, svg(P_CLK), timerEl, lowTxt), doneEl,
    h('span.ex-bar__m', train ? 'Тренировка' : 'Экзамен'),
    h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => ask() }, 'Сдать'));
  /* панель вопросов */
  const cells = run.qids.map((_, i) => h('button.ex-cell', { type: 'button', onclick: () => goTo(i) }, h('span.num', i + 1), h('i.ex-cell__f', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3h2v18H5zM8 4h11l-3 4.5L19 13H8z"/></svg>' })));
  const panel = h('aside.ex-panel', { 'aria-label': 'Панель вопросов' },
    h('h2.ex-panel__h', 'Вопросы'), h('div.ex-cells', ...cells),
    h('ul.ex-legend', h('li.is-done', h('i'), 'отвечен'), h('li.is-flag', h('i'), 'помечен'), h('li.is-skip', h('i'), 'пропущен'), h('li.is-cur', h('i'), 'текущий')));
  const qbox = h('div.ex-q'), flagB = h('button.btn.btn--sm.ex-flag', { type: 'button', 'aria-pressed': 'false', onclick: () => toggleFlag() }, svg(P_FL), h('span', 'Пометить'));
  const prevB = h('button.btn', { type: 'button', onclick: () => goTo(cur - 1) }, svg(P_L), 'Назад');
  const nextB = h('button.btn.btn--primary', { type: 'button', onclick: () => (cur === N - 1 ? ask() : goTo(cur + 1)) }, h('span', 'Дальше'), svg(P_R));
  const note = h('p.ex-qnote');
  const main = h('section.ex-main', h('div.ex-qh', h('span.ex-qn', 'Вопрос ' + (cur + 1)), flagB), qbox, note, h('div.ex-nav', prevB, nextB));
  root.append(h('div.wrap.ex-run', bar, live, h('div.ex-grid', main, panel)));

  const dlg = h('dialog.ex-dlg', { 'aria-labelledby': 'ex-dlg-t' });
  root.append(dlg);

  function paintPanel() {
    const flags = new Set(run.flags), seen = new Set(run.seen);
    cells.forEach((b, i) => {
      const a = answered(i), f = flags.has(i), sk = !a && seen.has(i) && i !== cur;
      b.classList.toggle('is-done', a); b.classList.toggle('is-flag', f); b.classList.toggle('is-skip', sk); b.classList.toggle('is-cur', i === cur);
      b.setAttribute('aria-label', `Вопрос ${i + 1}: ${a ? 'отвечен' : sk ? 'пропущен' : 'без ответа'}${f ? ', помечен' : ''}${i === cur ? ', текущий' : ''}`);
      i === cur ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current');
    });
    const na = Object.keys(run.ans).length;
    doneEl.textContent = `Отвечено ${na}${NB}из${NB}${N}` + (run.flags.length ? ` · помечено ${run.flags.length}` : '');
  }

  function toggleFlag() {
    const k = run.flags.indexOf(cur); k >= 0 ? run.flags.splice(k, 1) : run.flags.push(cur);
    paintFlag(); paintPanel(); save();
  }
  function paintFlag() { const on = run.flags.includes(cur); flagB.setAttribute('aria-pressed', String(on)); flagB.classList.toggle('is-on', on); flagB.lastChild.textContent = on ? 'Помечен' : 'Пометить'; }

  function goTo(i) {
    if (i < 0 || i >= N) return;
    leave(); cur = i; if (!run.seen.includes(i)) run.seen.push(i);
    showQ(); save();
  }

  function showQ(forceNew) {
    r && r.destroy(); r = null; qbox.replaceChildren(); note.textContent = ''; note.hidden = true;
    const Q0 = bank.byQid.get(run.qids[cur]), Qv = variant(Q0, run.seed), prev = run.ans[cur];
    main.querySelector('.ex-qn').textContent = `Вопрос ${cur + 1} из ${N}`;
    prevB.disabled = cur === 0;
    nextB.firstChild.textContent = cur === N - 1 ? 'К сдаче' : 'Дальше';
    r = mountQuestion(qbox, {
      Q: Qv, mode: MODE.exam, conf: false, reveal: train ? 'now' : 'later', index: cur + 1, total: N, keys: true,
      onAnswer: ({ ok, sel }) => {
        if (replaying) return;
        run.ans[cur] = { sel, ok: ok ? 1 : 0 }; run.ms[cur] = spent(cur);
        paintPanel(); save(true);
        if (!train) note.hidden = false, note.textContent = 'Ответ записан. Пока экзамен идёт, правильность не показывается; ответ можно изменить.';
        if (!train) addChange();
      },
    });
    if (prev && !forceNew) {   // вернулись к уже отвеченному: показываем сделанный выбор
      replaying = true;
      try { const opts = r.el.querySelectorAll('.qr-opt'); prev.sel.forEach((k) => opts[k] && opts[k].click()); const go2 = r.el.querySelector('.qr-go'); if (go2 && !go2.hidden && !r.state().locked) go2.click(); } finally { replaying = false; }
      if (!train) { note.hidden = false; note.textContent = 'Ваш ответ сохранён.'; addChange(); }
    }
    paintFlag(); paintPanel();
  }
  function addChange() {
    if (note.querySelector('button')) return;
    const b = h('button.btn.btn--quiet.btn--sm', { type: 'button', onclick: () => { showQ(true); const q1 = qbox.querySelector('.qr-q'); q1 && q1.focus({ preventScroll: true }); note.hidden = false; note.textContent = 'Прежний ответ сохранён, пока вы не выберете новый.'; } }, 'Изменить ответ');
    note.append(' ', b);
  }

  /* таймер */
  const said = new Set();
  const say = (k, t) => { if (!said.has(k)) { said.add(k); live.textContent = t; } };
  function tick() {
    const l = left();
    timerEl.textContent = mmss(l);
    const low = l <= 60000;
    bar.classList.toggle('is-low', low); lowTxt.hidden = !low; lowTxt.textContent = low ? (l <= 30000 ? 'Меньше 30 секунд' : 'Осталась минута') : '';
    if (l <= 300000 && l > 295000) say('5', 'Осталось пять минут');
    if (l <= 60000 && l > 55000) say('1', 'Осталась одна минута');
    if (l <= 30000 && l > 25000) say('30', 'Осталось тридцать секунд');
    if (l <= 0) submit('time');
  }
  timers.push(setInterval(tick, 250));
  timers.push(setInterval(() => save(), 5000));
  if (left() <= 300000) said.add('5'); if (left() <= 60000) said.add('1'); if (left() <= 30000) said.add('30');

  /* выход из вкладки */
  const onVis = () => { if (document.visibilityState === 'hidden') { run.away = (run.away || 0) + 1; save(true); } };
  const onHide = () => { save(true); };
  document.addEventListener('visibilitychange', onVis); addEventListener('pagehide', onHide);
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || dlg.open) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(cur + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur - 1); }
  };
  document.addEventListener('keydown', onKey);

  /* сдача */
  function ask() {
    leave(); save();
    const na = N - Object.keys(run.ans).length, nf = run.flags.length;
    dlg.replaceChildren(h('h2#ex-dlg-t.ex-dlg__t', 'Сдать экзамен?'),
      h('p', na ? `Без ответа: ${na}. Такие вопросы будут засчитаны как неверные.` : 'На все вопросы дан ответ.'),
      nf ? h('p', `Помеченных вопросов: ${nf}.`) : null,
      h('p.muted', `Осталось времени: ${mmss(left())}.`),
      h('div.ex-dlg__a', h('button.btn.btn--primary', { type: 'button', onclick: () => { dlg.close(); submit('user'); } }, 'Сдать'), h('button.btn', { type: 'button', autofocus: true, onclick: () => dlg.close() }, 'Вернуться к вопросам')));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function submit(reason) {
    if (!alive || run.done) return; run.done = true;
    leave(); snap();
    timers.forEach(clearInterval);
    const by = {}; let ok = 0;
    run.qids.forEach((qid, i) => {
      const Q = bank.byQid.get(qid), a = run.ans[i];
      by[Q.topic] = by[Q.topic] || [0, 0]; by[Q.topic][1]++;
      if (!a) return;
      if (a.ok) { ok++; by[Q.topic][0]++; }
      const Qv = variant(Q, run.seed);
      qa.record({ Q, ok: !!a.ok, mode: MODE.exam, conf: -1, ms: run.ms[i] || 0, sel: a.sel.map((k) => Qv.a[k].i) });   // в журнале индексы исходного порядка
    });
    Object.entries(by).forEach(([t, [o, n]]) => qa.session({ topic: +t, ok: o, n, mode: MODE.exam }));
    const used = Math.max(0, run.lim - run.left), pct = Math.round(100 * ok / N);
    const rec = { t: Date.now(), mode: run.mode, topics: run.topics, n: N, ok, pct, ms: used, lim: run.lim, by, away: run.away || 0, auto: reason === 'time' ? 1 : 0, na: N - Object.keys(run.ans).length };
    const ex = S.data.ex;
    ex.hist = (ex.hist || []).concat([rec]).slice(-HIST_MAX);
    ex.last = { ...rec, seed: run.seed, qids: run.qids, ans: run.qids.map((_, i) => run.ans[i] || 0), flags: run.flags, qms: run.qids.map((_, i) => run.ms[i] || 0) };
    ex.run = null; S.save(true);
    go('/exam/result');
  }

  showQ(); tick();
  return {
    title: 'Экзамен',
    destroy() { alive = false; timers.forEach(clearInterval); document.removeEventListener('visibilitychange', onVis); removeEventListener('pagehide', onHide); document.removeEventListener('keydown', onKey); if (!run.done) { try { save(true); } catch (e) { /* */ } } r && r.destroy(); try { dlg.open && dlg.close(); } catch (e) { /* */ } },
  };
}

/* ═══ итог ════════════════════════════════════════════════════ */
function resultView(root, c) {
  const L = S.data.ex.last, bank = c.bank;
  if (!L) {
    root.append(h('section.wrap--narrow.ex-empty', h('h1.h1', { html: 'Итогов <em>пока нет</em>' }), h('p.lede', 'Пройдите пробный РК — результат по темам и список того, что доработать, появятся здесь.'), h('a.btn.btn--primary', { href: '#/exam' }, 'К подготовке', svg(P_R))));
    return { title: 'Итог экзамена' };
  }
  const g = gradeOf(L.pct), isExam = L.mode === 'exam';
  const topics = Object.keys(L.by).map(Number).sort((a, b) => a - b);
  const rows = topics.map((n) => { const [o, t] = L.by[n], p = t ? o / t : 0; return { n, o, t, p }; });
  const weak = rows.filter((x) => x.p < 1).sort((a, b) => a.p - b.p || a.n - b.n).slice(0, 3);
  const tone = L.pct >= 70 ? 'var(--ok)' : L.pct >= 50 ? 'var(--warn)' : 'var(--bad)';
  const errsNow = qa.openErrors(bank).length;

  const stats = h('ul.ex-stats',
    h('li', h('b.num', `${L.ok}${NB}/${NB}${L.n}`), h('span', 'верных ответов')),
    h('li', h('b.num', mmss(L.ms)), h('span', `из ${mmss(L.lim)}${L.auto ? ' · время вышло' : ''}`)),
    L.na ? h('li', h('b.num', L.na), h('span', 'без ответа')) : null,
    L.away ? h('li', h('b.num', L.away), h('span', `${plural(L.away, ['раз', 'раза', 'раз'])} покидали вкладку · без санкций`)) : null);

  const gradeCard = h('div.ex-grade',
    h('div.ex-grade__l', h('b.num', g.letter), h('small', 'балл ' + g.gpa)),
    h('div', h('p.ex-grade__t', 'Оценка по шкале вуза: ' + g.letter + ' (' + g.range + '%)'),
      h('p.ex-grade__n', 'Типовые значения шкалы — подтвердите на кафедре.' + (isExam ? '' : ' Это тренировка: ответы были видны сразу, поэтому оценка — только ориентир.'))));

  const bars = h('ul.ex-bars', ...rows.map((x, i) => h('li.ex-brow.rv', { style: { '--d': i * .04 + 's' }, class: x.p >= .7 ? 'is-ok' : x.p >= .5 ? 'is-mid' : 'is-bad' },
    h('a.ex-brow__t', { href: '#/course/' + x.n }, h('b.num', x.n), h('span', tname(x.n))),
    h('div.ex-brow__b', { role: 'img', 'aria-label': `${x.o} из ${x.t}` }, h('i', { style: { '--w': Math.round(x.p * 100) + '%' } })),
    h('span.ex-brow__v.num', `${x.o}/${x.t}`))));

  /* что делать дальше */
  const nextBlocks = weak.map((x) => {
    const tr = trail(x.n, c), st = tr.stat;
    const steps = tr.steps.filter((s) => s.state !== 'done' && s.state !== 'na' && s.href).sort((a, b) => (b.optional ? 0 : 1) - (a.optional ? 0 : 1)).slice(0, 3);
    return { x, st, steps };
  });
  let budget = 10; nextBlocks.forEach((b) => { b.steps = b.steps.slice(0, Math.max(0, Math.min(b.steps.length, budget))); budget -= b.steps.length; });
  const next = h('div.ex-next', ...(nextBlocks.length ? nextBlocks.map(({ x, st, steps }, i) => h('article.ex-nx.rv', { style: { '--d': i * .08 + 's' } },
    h('header', h('b.num', 'Тема ' + x.n), h('h3', tname(x.n)), h('span.ex-nx__s', `${x.o} из ${x.t}`)),
    h('p.ex-nx__r', 'Что тянет вниз: ' + st.reason + '.'),
    steps.length ? h('ul', ...steps.map((s) => h('li', h('a', { href: s.href }, h('b', STEP_LABEL[s.k] || s.label), h('small', s.sub.replace(/^[^·]*·\s*/, '') + (s.min ? ' · ~' + s.min + NB + 'мин' : '')), svg(P_R))))) : h('a.btn.btn--sm', { href: '#/course/' + x.n }, 'К теме', svg(P_R))))
    : [h('p.ex-all', 'Все темы решены без ошибок. Закрепите результат карточками, чтобы он не остыл.')]));

  /* разбор */
  let filter = 'all';
  const list = h('ol.ex-rev');
  const items = L.qids.map((qid, i) => {
    const Q = bank.byQid.get(qid), Qv = variant(Q, L.seed), a = L.ans[i], picked = new Set(a ? a.sel : []);
    const st = !a ? 'na' : a.ok ? 'ok' : 'bad';
    const lab = { ok: 'верно', bad: 'неверно', na: 'нет ответа' }[st];
    const opts = Qv.a.map((o, k) => h('li.ex-opt', { class: (o.ok ? 'is-right ' : '') + (picked.has(k) ? 'is-pick' : '') },
      h('span.ex-opt__m', { 'aria-hidden': 'true' }, o.ok ? svg(P_OK, 2.6) : picked.has(k) ? svg(P_X, 2.6) : null),
      h('span.ex-opt__t', Qv.type === 'tf' && /^ложь$/i.test(o.t) ? 'Неверно' : o.t),
      h('span.ex-opt__l', [picked.has(k) ? 'ваш ответ' : '', o.ok ? 'верный' : ''].filter(Boolean).join(' · '))));
    const li = h('li.ex-item.is-' + st, { 'data-st': st },
      h('details', h('summary', h('span.ex-item__n.num', i + 1), h('span.ex-item__q', Q.q), h('span.ex-item__s', st === 'ok' ? svg(P_OK, 2.6) : st === 'bad' ? svg(P_X, 2.6) : null, lab)),
        h('ul.ex-opts', ...opts), h('a.ex-item__l', { href: '#/course/' + Q.topic }, 'Лекции темы' + NB + Q.topic, svg(P_R))));
    return li;
  });
  const nBad = items.filter((x) => x.dataset.st !== 'ok').length;
  const paintList = () => { list.replaceChildren(...items.filter((x) => filter === 'all' || x.dataset.st !== 'ok')); if (!list.children.length) list.append(h('li.ex-none', 'Ошибок нет.')); };
  const tabs = h('div.tabs.ex-tabs', { role: 'tablist' }, ...[['all', `Все вопросы (${items.length})`], ['bad', `Только ошибки (${nBad})`]].map(([v, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(v === filter), onclick: (e) => { filter = v; [...tabs.children].forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget))); paintList(); } }, l)));
  paintList();

  root.append(
    h('header.wrap.ex-rh',
      h('div.ex-rh__t',
        h('p.eyebrow.eyebrow--dot', (isExam ? 'Экзамен' : 'Тренировка') + ' · темы ' + rangeStr(L.topics)),
        h('h1.h1', { html: L.pct >= 70 ? 'Хороший <em>результат</em>' : L.pct >= 50 ? 'Есть над чем <em>поработать</em>' : 'Пока <em>рано</em> считать готовым' }),
        h('p.lede', weak.length ? `Слабее всего: ${weak.map((x) => 'тема ' + x.n).join(', ')}. Ниже — конкретные шаги, а не «подтянуть всё».` : 'Ошибок нет. Проверьте себя через пару дней, чтобы убедиться, что знания держатся.'),
        stats),
      h('div.ex-rh__r',
        h('div.ring.ex-pct', { style: { '--p': L.pct / 100, '--s': '9rem', '--c': tone }, role: 'img', 'aria-label': `Результат ${L.pct} процентов` }, h('b.num', L.pct + '%')),
        gradeCard)),
    h('section.wrap.ex-sec', h('h2.eyebrow', 'Результат по темам'), bars),
    h('section.wrap.ex-sec', h('h2.eyebrow', 'Что делать дальше'), next,
      h('p.ex-errnote', errsNow ? `Ошибки уже в журнале (неразобранных: ${errsNow}) и в колоде повторения.` : 'Ошибки уже в журнале и в колоде повторения.', ' ', h('a', { href: '#/me/errors' }, 'Открыть журнал ошибок'))),
    h('section.wrap.ex-sec', h('h2.eyebrow', 'Разбор'), tabs, list),
    h('div.wrap.ex-end', h('a.btn.btn--primary', { href: '#/exam' }, svg(P_RE), 'Пройти ещё раз'), h('a.btn', { href: '#/review' }, 'Повторить карточки'), h('a.btn.btn--quiet', { href: '#/today' }, 'Сегодня')));
  return { title: 'Итог экзамена' };
}
