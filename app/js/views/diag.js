/* ─────────────────────────────────────────────────────────────
   Диагностика — #/diag. 28 вопросов (по 2 из каждой темы), уверенность перед ответом, верный ответ не показываем.
   Итог — «Стартовая карта»: 14 тем в трёх состояниях (Знакомо 2/2 · Частично 1/2 · Новое 0/2).
   Состояние: S.data.ex.diag = { seed, i, ans:[{q, ok, sel, c, ms}], ts, done?, res?:[14 × 0..2] }  — сохраняется после каждого ответа.
   ───────────────────────────────────────────────────────────── */
import { h, loadCSS, plural, toast, reduced } from '../core/dom.js';
import { S, MODE } from '../core/state.js';
import * as qa from '../core/qa.js';
import { prepare, seeded, shuffled } from '../core/qid.js';
import { ctx as planCtx } from '../core/plan.js';
import { enhance } from '../core/motion.js';
import { TOPICS, icon } from '../data/topics.js';
import { mountQuestion } from '../ui/qrun.js';

const NB = ' ';
const svg = (inner, sw = 2) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });
const P_R = '<path d="M5 12h14M13 6l6 6-6 6"/>', P_OK = '<path d="m4.5 12.5 5 5L19.5 7"/>', P_CP = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', P_RE = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
const STATE = [
  { k: 'new', label: 'Новое', note: '0 из 2', hint: 'Начните с лекций' },
  { k: 'part', label: 'Частично', note: '1 из 2', hint: 'Есть основа — закрепите' },
  { k: 'known', label: 'Знакомо', note: '2 из 2', hint: 'Можно проверить тестом' },
];

/* ── набор вопросов: детерминированно по seed ───────────────── */
export function buildSet(bank, seed) {
  const used = new Set(), out = [];
  bank.topics.forEach((n) => {
    const rand = seeded(seed + ':' + n);
    const uq = bank.unique(n);
    const mc = shuffled(uq.filter((Q) => Q.type === 'mc'), rand), rest = shuffled(uq.filter((Q) => Q.type !== 'mc'), rand);
    let k = 0;
    [...mc, ...rest].forEach((Q) => { if (k < 2 && !used.has(Q.ukey)) { used.add(Q.ukey); out.push(Q.qid); k++; } });
  });
  return shuffled(out, seeded(seed + ':order'));
}
const variant = (Q, seed) => prepare(Q, seeded(seed + ':v:' + Q.ukey));

/** результаты по темам из ответов: [0..2] для каждой темы */
export function scoreByTopic(ans, topics) {
  const r = Object.fromEntries(topics.map((n) => [n, 0]));
  ans.forEach((a) => { if (a.ok) r[+String(a.q).split('.')[0]]++; });
  return topics.map((n) => Math.min(2, r[n]));
}
export const diagCode = (res, ts) => 'MXD-' + btoa(JSON.stringify({ ver: 1, ts, res })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function load() {
  await loadCSS('app/css/v-diag.css');
  return { c: await planCtx() };
}

export function mount(el, ctx, { c }) {
  const bank = c.bank, topics = bank.topics;
  const root = h('div.dg'); el.append(root);
  let q = null, timers = [], offEnh = null, alive = true;
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const ex = () => S.data.ex;
  const D = () => ex().diag;
  const clearView = () => { q && q.destroy(); q = null; timers.forEach(clearTimeout); timers = []; offEnh && offEnh(); offEnh = null; root.replaceChildren(); };
  const qsMap = new Map();

  function show() {
    const d = D();
    if (d && d.done) return result();
    if (d && d.i > 0 && d.i < qsOf(d).length) return intro(true);
    return intro(false);
  }
  const qsOf = (d) => qsMap.get(d.seed) || qsMap.set(d.seed, buildSet(bank, d.seed)).get(d.seed);

  /* ── вступление ────────────────────────────────────────── */
  function intro(resume) {
    clearView();
    const d = D(), n = d ? qsOf(d).length : topics.length * 2;
    root.append(h('section.wrap--narrow.dg-intro',
      h('p.eyebrow.eyebrow--dot', 'Входная диагностика'),
      h('h1.h1', { html: 'Узнайте, <em>с чего начать</em>' }),
      h('p.lede', `По два вопроса из каждой темы — ${n} ${plural(n, ['вопрос', 'вопроса', 'вопросов'])}, около 12${NB}минут. Результат нужен, чтобы вы видели, с чего начать, а не для оценки.`),
      h('ul.dg-facts',
        fact('1', 'Перед ответом — уверенность', '«Уверен», «Скорее да» или «Угадываю». Так видно, где вы уверенно ошибаетесь: это самое полезное для обучения.'),
        fact('2', 'Верный ответ не показывается', 'Это диагностика, а не тренировка. Ошибки попадут в журнал и в карточки повторения — вернётесь к ним позже.'),
        fact('3', 'Можно прервать', 'Каждый ответ сохраняется. Закройте страницу и продолжите с того же места.')),
      h('div.dg-act',
        resume
          ? [h('button.btn.btn--primary.btn--lg', { type: 'button', onclick: () => run() }, `Продолжить: вопрос ${d.i + 1} из ${n}`, svg(P_R)), h('button.btn', { type: 'button', onclick: () => restart() }, svg(P_RE), 'Начать заново')]
          : [h('button.btn.btn--primary.btn--lg', { type: 'button', onclick: () => restart() }, 'Начать диагностику', svg(P_R)), h('a.btn', { href: '#/today' }, 'Позже')])));
    focusTop();
  }
  const fact = (n, t, p) => h('li.dg-fact', h('span.dg-fact__n.num', n), h('div', h('b', t), h('p', p)));
  const focusTop = () => { const f = root.querySelector('h1'); if (f) { f.tabIndex = -1; try { f.focus({ preventScroll: true }); } catch (e) { /* */ } } };

  function restart() {
    ex().diag = { seed: Date.now().toString(36), i: 0, ans: [], ts: Date.now() };
    S.save(true);
    run();
  }

  /* ── ход ──────────────────────────────────────────────── */
  function run() {
    clearView();
    const d = D(), qs = qsOf(d), N = qs.length;
    if (d.i >= N) return finish();
    const Q0 = bank.byQid.get(qs[d.i]);
    const bar = h('span.dg-bar__i', { style: { '--p': d.i / N } });
    root.append(h('section.wrap--narrow.dg-run',
      h('header.dg-top',
        h('p.eyebrow', 'Диагностика'),
        h('div.dg-bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': N, 'aria-valuenow': d.i, 'aria-label': 'Ход диагностики' }, bar),
        h('span.dg-top__n.num', `${d.i + 1}${NB}/${NB}${N}`),
        h('a.dg-top__x', { href: '#/today' }, 'Прервать — вернусь позже')),
      h('div.dg-q', { id: 'dg-q' }),
      h('p.dg-note', 'Верный ответ не показывается — это диагностика. Угадывать не стыдно: отметьте «Угадываю».')));
    const box = root.querySelector('#dg-q');
    const Qv = variant(Q0, d.seed);
    q = mountQuestion(box, {
      Q: Qv, mode: MODE.diag, conf: true, reveal: 'later', index: d.i + 1, total: N, keys: true,
      onAnswer: ({ ok, sel, conf, ms }) => {
        const Qp = bank.byQid.get(qs[d.i]);
        const orig = sel.map((k) => Qv.a[k].i);   // журнал хранит индексы исходного порядка вариантов
        qa.record({ Q: Qp, ok, mode: MODE.diag, conf, ms, sel: orig });
        d.ans.push({ q: Qp.qid, ok: ok ? 1 : 0, sel: orig, c: conf, ms });
        d.i++; S.save(true);
        bar.style.setProperty('--p', d.i / N);
        later(() => { if (alive) run(); }, reduced() ? 150 : 650);
      },
    });
  }

  function finish() {
    const d = D();
    d.res = scoreByTopic(d.ans, topics); d.done = Date.now();
    qa.session({ topic: 0, ok: d.ans.filter((a) => a.ok).length, n: d.ans.length, mode: MODE.diag });
    S.data.seen.diag = d.done;
    S.save(true);
    result(true);
  }

  /* ── итог: «Стартовая карта» ───────────────────────────── */
  function result(fresh) {
    clearView();
    const d = D(), res = d.res || scoreByTopic(d.ans, topics);
    const cnt = [0, 0, 0]; res.forEach((r) => cnt[r]++);
    const firstGap = topics.find((n, i) => res[i] < 2);
    const confBad = d.ans.filter((a) => !a.ok && a.c === 2).length;
    const mins = Math.max(1, Math.round(d.ans.reduce((a, x) => a + (x.ms || 0), 0) / 60000));
    const known = cnt[2], pct = known / topics.length;

    const tiles = topics.map((n, i) => {
      const r = res[i], st = STATE[r], meta = TOPICS[n] || { short: 'Тема ' + n, c: 'accent' };
      const go = r === 2
        ? h('a.dg-tile__go.is-test', { href: '#/tests/' + n }, 'Проверить тестом темы', svg(P_R))
        : h('a.dg-tile__go' + (n === firstGap ? '.is-first' : ''), { href: '#/course/' + n }, 'Начать здесь', svg(P_R));
      return h('article.dg-tile.rv', { class: 'is-' + st.k, style: { '--c': 'var(--' + meta.c + ')', '--i': i, '--d': (i * .055) + 's' }, 'data-state': st.k },
        h('div.dg-tile__h',
          h('span.dg-tile__n', n),
          h('span.dg-tile__ic', { html: icon(n) })),
        h('h3.dg-tile__t', meta.short),
        h('div.dg-tile__m',
          h('span.dg-pips', { role: 'img', 'aria-label': `${st.note}` }, h('i', { class: r >= 1 ? 'on' : '' }), h('i', { class: r >= 2 ? 'on' : '' })),
          h('span.dg-tile__s', h('b', st.label), h('small', st.note))),
        r < 2 ? h('span.dg-tile__tag', n === firstGap ? 'начать здесь' : 'в плане') : null,
        go);
    });

    const code = diagCode(res, d.done || d.ts || Date.now());
    const codeBtn = h('button.btn', { type: 'button', onclick: () => copy(code, codeBtn) }, svg(P_CP), 'Скопировать код результата');
    const redo = h('button.btn.btn--quiet', { type: 'button', onclick: () => { if (redo.dataset.sure) restart(); else { redo.dataset.sure = 1; redo.lastChild.textContent = 'Точно? Ответы в журнале останутся'; later(() => { delete redo.dataset.sure; redo.lastChild.textContent = 'Пройти заново'; }, 4000); } } }, svg(P_RE), h('span', 'Пройти заново'));

    root.append(h('div.wrap.dg-res' + (fresh ? '.is-fresh' : ''),
      h('header.dg-res__h',
        h('div.dg-res__t',
          h('p.eyebrow.eyebrow--dot', 'Стартовая карта'),
          h('h1.h1', { html: firstGap ? 'С чего <em>начать</em>' : 'Все темы <em>знакомы</em>' }),
          h('p.lede', firstGap
            ? `Знакомо ${cnt[2]}, частично ${cnt[1]}, новое ${cnt[0]}. Лучше идти по порядку: начните с темы${NB}${firstGap}.`
            : 'Ни одной новой темы. Проверьте себя тестами — они покажут, где знания неполные.'),
          h('div.dg-res__a',
            firstGap ? h('a.btn.btn--primary.btn--lg', { href: '#/course/' + firstGap }, `Начать с темы${NB}${firstGap}`, svg(P_R)) : h('a.btn.btn--primary.btn--lg', { href: '#/tests' }, 'К тестам тем', svg(P_R)),
            h('a.btn', { href: '#/today' }, 'Открыть «Сегодня»'))),
        h('div.dg-res__s',
          h('div.ring.dg-ring', { style: { '--p': pct, '--s': '8rem' }, role: 'img', 'aria-label': `Знакомо ${known} из ${topics.length} тем` }, h('b.num', known), h('small', 'из' + NB + topics.length)),
          h('div.dg-res__m',
            h('b', 'Итог в цифрах'),
            h('span', `${d.ans.filter((a) => a.ok).length} верных из ${d.ans.length}`),
            h('span.muted', `${mins}${NB}${plural(mins, ['минута', 'минуты', 'минут'])}`),
            confBad ? h('a.dg-res__w', { href: '#/me/errors' }, `Уверенных ошибок: ${confBad}`) : h('span.muted', 'Уверенных ошибок нет')))),
      h('p.dg-caveat', { role: 'note' }, h('b', 'Два вопроса — грубая оценка. '), 'Карта подсказывает, с чего начать, и не заменяет тест темы. Неверные ответы уже в журнале ошибок и в колоде повторения.'),
      h('div.dg-legend', { 'aria-hidden': 'true' }, ...STATE.slice().reverse().map((s) => h('span.dg-legend__i.is-' + s.k, h('span.dg-pips', h('i', { class: s.k !== 'new' ? 'on' : '' }), h('i', { class: s.k === 'known' ? 'on' : '' })), s.label + ' · ' + s.note))),
      h('div.dg-grid', { 'aria-label': 'Карта тем' }, ...tiles),
      h('section.dg-code',
        h('div', h('b', 'Код результата'), h('p', 'Одна строка с результатом по 14 темам. Её можно отправить преподавателю.')),
        h('div.dg-code__a', codeBtn, redo))));
    offEnh = enhance(root);
    focusTop();
  }

  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const ta = h('textarea', { readonly: true, style: { position: 'fixed', opacity: 0 } }, text); document.body.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { /* */ }
    }
    if (ok) { toast('Код скопирован'); const t = btn.lastChild; const old = t.textContent; t.textContent = 'Скопировано'; later(() => { t.textContent = old; }, 2000); }
    else {
      const inp = h('input.dg-code__f', { readonly: true, value: text, 'aria-label': 'Код результата' });
      btn.closest('.dg-code').append(inp); inp.focus(); inp.select();
    }
  }

  show();
  return {
    title: 'Диагностика',
    destroy() { alive = false; clearView(); },
  };
}
