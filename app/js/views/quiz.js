/* ─────────────────────────────────────────────────────────────
   Quiz — one test, one question per screen.
   Router maps #/tests/:topic to this module, so it is a route (load/mount) and a helper
   (buildQuiz, mountQuiz) that tests.js re-uses.
   Question types in tests.json: mc (one answer), ms (several), tf (верно / неверно).
   Progress: store tests.<topic|all> = { best, bestScore, bestTotal, attempts, last:{pct,score,total,time,at}, at }
   ───────────────────────────────────────────────────────────── */
import { h, s, $, $$, loadCSS, plural, reduced } from '../core/dom.js';
import { index, tests } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { TOPICS, icon, rub } from '../data/topics.js';
import { seg, callout } from '../ui/controls.js';
import { bank as loadBank, findQ } from '../core/qid.js';
import { S as ST, MODE } from '../core/state.js';
import * as qa from '../core/qa.js';

const NB = ' ';
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
const svg = (inner, sw = 2) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });
const P_R = '<path d="M5 12h14M13 6l6 6-6 6"/>', P_L = '<path d="M19 12H5M11 6l-6 6 6 6"/>', P_OK = '<path d="m4.5 12.5 5 5L19.5 7"/>', P_X = '<path d="M6 6l12 12M18 6 6 18"/>', P_RE = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
const qWord = (n) => n + NB + plural(n, ['вопрос', 'вопроса', 'вопросов']);

/* ── helpers shared with tests.js ────────────────────────────── */
export const keyOf = (topic) => 'tests.' + topic;
export const resultOf = (topic) => store.get(keyOf(topic), null);

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* options like «Все перечисленное» only make sense in their original place */
const POSITIONAL = /(все|всё|всего|всех|каждый|любой|ни\s+один|ничего)\s+(из\s+)?(выше|ниже)?(перечисл|указан|названн)|^все\b.{0,14}$/i;
function prepare(q, topic) {
  const a = q.a.map((o, i) => ({ t: o.t, ok: !!o.ok, i }));
  const keep = q.type === 'tf' || a.some((o) => POSITIONAL.test(o.t.trim()));
  return { q: q.q, type: q.type, topic, a: keep ? a : shuffle(a), nOk: a.filter((o) => o.ok).length };
}
/** pick `n` random questions of a topic (or of all topics when topic === 'all') */
export function buildQuiz(data, topic, n) {
  const pool = [];
  if (topic === 'all') Object.entries(data).forEach(([k, v]) => v.q.forEach((q) => pool.push([q, +k])));
  else data[topic].q.forEach((q) => pool.push([q, +topic]));
  return shuffle(pool).slice(0, n).map(([q, t]) => prepare(q, t));
}
const tfLabel = (t) => (/^ложь$/i.test(t) ? 'Неверно' : t);

function tween(from, to, ms, fn, done) {
  if (reduced()) { fn(to); done && done(); return () => {}; }
  const t0 = performance.now(); let raf = 0;
  const f = (t) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); fn(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(f); else done && done(); };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}
const mmss = (ms) => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ── route ───────────────────────────────────────────────────── */
export async function load(ctx) {
  await loadCSS('app/css/v-tests.css');
  const [ix, data, bk] = await Promise.all([index(), tests(), loadBank()]);
  const topic = ctx.params.topic;
  if (topic !== 'all' && !data[topic]) throw new Error('Нет такого теста: ' + topic);
  return { ix, data, topic, bk };
}

export function mount(el, ctx, d) {
  const root = h('div.qz');
  el.append(root);
  const inst = mountQuiz(root, ctx, d);
  const off = enhance(el);
  return { title: inst.title, destroy() { inst.destroy(); off && off(); } };
}

/* ── the quiz itself ─────────────────────────────────────────── */
export function mountQuiz(root, ctx, { ix, data, topic, bk }) {
  const isAll = topic === 'all';
  const tnum = isAll ? 0 : +topic;
  const meta = isAll ? { short: 'Смешанный тест', tag: 'Вопросы из всех четырнадцати тем вперемешку', c: 'accent' } : TOPICS[tnum];
  const tp = isAll ? null : ix.byTopic.get(tnum);
  const total = isAll ? Object.values(data).reduce((a, v) => a + v.q.length, 0) : data[topic].q.length;
  const ask = isAll ? 20 : Math.min(data[topic].ask || 10, total);
  const color = 'var(--' + meta.c + ')';

  let timers = [], offs = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };

  /* тест до чтения лекций темы — диагностика: ответы пишем как MODE.diag, в освоение не засчитываются */
  const diag = !isAll && !!tp && !tp.lectures.some((l) => (ST.data.lec[l.id] || {}).o);
  const MODE_NOW = diag ? MODE.diag : MODE.test;
  const stage = h('div.qz__stage');
  root.append(
    h('div.qz__wrap',
      h('div.qz__top',
        h('nav.crumbs', { 'aria-label': 'Навигация' }, h('a', { href: '#/tests' }, 'Тесты'), h('i', '/'), h('span', isAll ? 'Смешанный' : 'Тема ' + tnum)),
        tp ? h('a.btn.btn--sm.btn--quiet', { href: '#/theory/' + tnum }, 'Теория темы', svg(P_R)) : null),
      diag ? callout({ tone: 'info', text: 'Вы ещё не читали лекции темы. Тест можно пройти как диагностику — результат не засчитается в освоение.' }) : null,
      stage));
  root.style.setProperty('--c', color);

  let S = null;   // run state

  /* ═════ intro ═════════════════════════════════════════════════ */
  function intro() {
    S = null; stage.replaceChildren(); root.classList.remove('is-run');
    const res = resultOf(topic);
    let n = ask;
    const info = h('p.qz-intro__i');
    const setInfo = () => { info.replaceChildren(h('span', qWord(n)), h('span', '≈' + NB + Math.max(1, Math.round(n * .5)) + NB + 'мин'), h('span', 'в банке ' + total)); };
    setInfo();
    const options = [{ v: ask, label: qWord(ask) }];
    if (total > ask) options.push({ v: total, label: 'Весь банк · ' + total });
    if (total > 20 && ask < 20) options.splice(1, 0, { v: 20, label: qWord(20) });
    const sg = options.length > 1 ? seg({ options, value: ask, label: 'Длина теста', onChange: (v) => { n = v; setInfo(); } }) : null;
    const start = h('button.btn.btn--primary.btn--lg', { type: 'button' }, res && res.attempts ? 'Пройти ещё раз' : 'Начать тест', svg(P_R));
    start.addEventListener('click', () => run(buildQuiz(data, topic, n), false));
    stage.append(h('section.qz-intro.card',
      h('div.qz-intro__h',
        h('span.qz-intro__n', isAll ? '∞' : rub(tnum)),
        isAll ? null : h('span.qz-intro__ic', { html: icon(tnum) })),
      h('p.eyebrow.eyebrow--dot', isAll ? 'Тест · все темы' : 'Тест · тема ' + tnum),
      h('h1.h1.qz-intro__t', meta.short),
      h('p.lede', isAll ? meta.tag : (tp ? tp.title : meta.tag)),
      info,
      sg ? sg.el : null,
      res && res.attempts ? bestBlock(res) : null,
      h('div.qz-intro__a', start, h('a.btn', { href: '#/tests' }, 'Все тесты')),
      h('ul.qz-intro__r',
        h('li', 'Вопросы выбираются случайно, варианты ответов перемешиваются.'),
        h('li', 'Ответ проверяется сразу. В вопросах с несколькими ответами нужно отметить все верные.'),
        h('li', h('span.kbd', '1'), h('span.kbd', '2'), h('span.kbd', '3'), ' — выбор варианта, ', h('span.kbd', 'Enter'), ' — дальше.'))));
    start.focus({ preventScroll: true });
  }
  function bestBlock(res) {
    const p = res.best || 0;
    const r = h('div.ring', { style: { '--p': p / 100, '--s': '3.6rem', '--c': p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--bad)' } }, h('b.num', p + '%'));
    return h('div.qz-best', r, h('div', h('b', 'Лучший результат'), h('span', `${res.bestScore} из ${res.bestTotal} · попыток: ${res.attempts}`)));
  }

  /* ═════ run ═══════════════════════════════════════════════════ */
  function run(qs, practice) {
    S = { qs, i: 0, res: [], practice, t0: Date.now(), locked: false, sel: new Set() };
    root.classList.add('is-run');
    stage.replaceChildren();
    S.ring = h('div.ring.qz-ring', { style: { '--s': '3.6rem', '--p': 0 } }, h('b.num', '1'));
    S.label = h('div.qz-bar__l', h('b'), h('span'));
    S.pips = h('ol.qz-pips', { 'aria-hidden': 'true' }, ...qs.map(() => h('li')));
    S.score = h('div.qz-bar__s.mono');
    S.bar = h('div.qz-bar', S.ring, S.label, S.score, S.pips);
    S.host = h('div.qz-host');
    stage.append(S.bar, S.host);
    question();
  }

  function setBar(answered) {
    const { qs, i, res } = S;
    S.ringStop && S.ringStop();
    const from = parseFloat(S.ring.style.getPropertyValue('--p')) || 0, to = answered / qs.length;
    S.ringStop = tween(from, to, 600, (v) => S.ring.style.setProperty('--p', v.toFixed(4)));
    $('.num', S.ring).textContent = Math.min(i + 1, qs.length);
    $('b', S.label).textContent = `Вопрос ${i + 1} из ${qs.length}`;
    const ok = res.filter((r) => r.ok).length;
    $('span', S.label).textContent = S.practice ? 'Работа над ошибками' : (isAll ? 'Смешанный тест' : meta.short);
    S.score.textContent = res.length ? `${ok}/${res.length}` : '';
    S.score.title = 'Верных ответов';
    $$('li', S.pips).forEach((li, k) => { li.className = k < res.length ? (res[k].ok ? 'is-ok' : 'is-bad') : k === i ? 'is-cur' : ''; });
    S.ring.setAttribute('role', 'img'); S.ring.setAttribute('aria-label', `Вопрос ${i + 1} из ${qs.length}`);
  }

  function question() {
    const { qs, i } = S;
    const q = qs[i];
    S.locked = false; S.sel = new Set(); S.qt = Date.now();
    setBar(S.res.length);
    const multi = q.type === 'ms';
    const kind = q.type === 'tf' ? 'Верно или неверно' : multi ? 'Несколько ответов' : 'Один ответ';
    const hint = multi ? 'Отметьте все верные варианты' : q.type === 'tf' ? 'Выберите одно' : 'Выберите один вариант';
    const opts = q.a.map((o, k) => {
      const b = h('button.qz-opt', { type: 'button', role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false', 'data-k': k, style: { '--i': k } },
        h('span.qz-opt__k', q.type === 'tf' ? (/^верно$/i.test(o.t) ? '✓' : '✕') : LETTERS[k] || k + 1),
        h('span.qz-opt__t', q.type === 'tf' ? tfLabel(o.t) : o.t),
        h('span.qz-opt__m', { 'aria-hidden': 'true' }));
      b.addEventListener('click', () => pick(k));
      return b;
    });
    const group = h('div.qz-opts', { role: multi ? 'group' : 'radiogroup', 'aria-labelledby': 'qz-q' }, ...opts);
    const fb = h('div.qz-fb', { role: 'status', 'aria-live': 'polite' });
    const act = h('div.qz-act');
    const bCheck = multi ? h('button.btn.btn--primary', { type: 'button', disabled: true }, 'Проверить', svg(P_OK)) : null;
    const last = i === qs.length - 1;
    const bNext = h('button.btn.btn--primary', { type: 'button', hidden: true }, last ? 'Узнать результат' : 'Дальше', svg(P_R));
    act.append(...[bCheck, bNext].filter(Boolean));
    const card = h('article.qz-card.card', { 'aria-live': 'off' },
      h('div.qz-meta', h('span.qz-badge', kind), isAll ? h('span.qz-tag', 'Тема ' + q.topic + ' · ' + TOPICS[q.topic].short) : null, h('span.qz-hint', hint)),
      h('h2.qz-q#qz-q', { tabindex: '-1' }, q.q),
      group, fb, act);
    S.host.replaceChildren(card);
    S.cur = { q, opts, fb, bCheck, bNext, card, group };
    if (!reduced()) card.classList.add('is-in');
    card.querySelector('.qz-q').focus({ preventScroll: true });
    if (innerWidth < 700) card.scrollIntoView({ block: 'nearest' });

    bNext.addEventListener('click', next);
    bCheck && bCheck.addEventListener('click', () => reveal());
  }

  function pick(k) {
    if (!S || S.locked) return;
    const { q, opts, bCheck } = S.cur;
    if (q.type === 'ms') {
      S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k);
      opts[k].classList.toggle('is-sel', S.sel.has(k)); opts[k].setAttribute('aria-checked', String(S.sel.has(k)));
      bCheck.disabled = S.sel.size === 0;
    } else {
      S.sel = new Set([k]);
      opts.forEach((o, j) => { o.setAttribute('aria-checked', String(j === k)); });
      opts[k].classList.add('is-sel');
      reveal();
    }
  }

  function reveal() {
    if (S.locked || !S.sel.size) return;
    S.locked = true;
    const { q, opts, fb, bCheck, bNext, card } = S.cur;
    const sel = S.sel;
    let ok = true;
    q.a.forEach((o, k) => {
      const chosen = sel.has(k), el = opts[k];
      el.disabled = true; el.classList.remove('is-sel');
      const mark = $('.qz-opt__m', el);
      if (o.ok && chosen) { el.classList.add('is-ok'); mark.append(svg(P_OK, 2.6)); }
      else if (!o.ok && chosen) { el.classList.add('is-bad'); mark.append(svg(P_X, 2.6)); ok = false; }
      else if (o.ok && !chosen) { el.classList.add('is-miss'); mark.append(svg(P_OK, 2.6)); mark.dataset.t = 'пропущен'; ok = false; }
      else el.classList.add('is-dim');
    });
    S.res.push({ q, sel: [...sel], ok });
    if (!S.practice && bk) { const Q = findQ(bk, q); if (Q) qa.record({ Q, ok, mode: MODE_NOW, ms: Date.now() - (S.qt || Date.now()), sel: [...sel] }); }
    card.classList.add(ok ? 'is-right' : 'is-wrong');
    if (bCheck) bCheck.hidden = true;
    const right = q.a.filter((o) => o.ok).map((o) => (q.type === 'tf' ? tfLabel(o.t) : o.t));
    fb.replaceChildren(callout(ok
      ? { tone: 'ok', title: pickOne(['Верно!', 'Точно!', 'Правильно!', 'Так и есть!']), text: q.type === 'ms' ? 'Вы отметили все верные варианты.' : '' }
      : { tone: 'bad', title: q.type === 'ms' && sel.size && q.a.some((o, k) => o.ok && sel.has(k)) ? 'Не совсем' : 'Неверно', text: (right.length > 1 ? 'Верные ответы выделены зелёным: ' : 'Верный ответ выделен зелёным: ') + right.map((r) => '«' + r.replace(/[.;]+$/, '') + '»').join(', ') + '.' }));
    fb.classList.add('is-in');
    bNext.hidden = false; bNext.focus({ preventScroll: true });
    later(() => { const r = bNext.getBoundingClientRect(); if (r.bottom > innerHeight - 12) window.scrollBy({ top: r.bottom - innerHeight + 24, behavior: reduced() ? 'auto' : 'smooth' }); }, 120);
    setBar(S.res.length);
    if (ok) pop(card);
  }
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  function next() {
    if (!S || !S.locked) return;
    if (S.i < S.qs.length - 1) {
      const c = S.cur.card;
      const go = () => { S.i++; question(); };
      if (reduced()) go(); else { c.classList.add('is-out'); later(go, 220); }
    } else finish();
  }

  /* little pulse under the correct answer */
  function pop(card) {
    if (reduced()) return;
    const el = $('.qz-opt.is-ok', card); if (!el) return;
    const r = h('i.qz-pulse', { 'aria-hidden': 'true' }); el.append(r); later(() => r.remove(), 800);
  }

  /* ═════ results ═══════════════════════════════════════════════ */
  function finish() {
    const { qs, res, practice } = S;
    const time = Date.now() - S.t0;
    const score = res.filter((r) => r.ok).length, n = qs.length, pct = Math.round((score / n) * 100);
    const prev = resultOf(topic);
    let record = false;
    if (!practice && !isAll && n) qa.session({ topic: tnum, ok: score, n, mode: MODE_NOW });
    if (!practice) {
      const prevBest = prev && prev.attempts ? prev.best : -1;
      record = pct > prevBest && prevBest >= 0;
      const first = prevBest < 0;
      const o = { attempts: ((prev && prev.attempts) || 0) + 1, last: { pct, score, total: n, time, at: Date.now() }, at: Date.now(),
        best: first || pct >= prevBest ? pct : prev.best, bestScore: first || pct >= prevBest ? score : prev.bestScore, bestTotal: first || pct >= prevBest ? n : prev.bestTotal };
      if (!first && pct === prevBest) { o.bestScore = Math.max(score, prev.bestScore || 0); o.bestTotal = n; }
      store.set(keyOf(topic), o);
    }
    const tone = pct >= 75 ? 'ok' : pct >= 50 ? 'warn' : 'bad';
    const word = pct === 100 ? 'Безупречно' : pct >= 90 ? 'Отлично' : pct >= 75 ? 'Хорошо' : pct >= 50 ? 'Неплохо, но есть что повторить' : 'Стоит вернуться к теории';
    const wrong = res.map((r, k) => Object.assign({ k }, r)).filter((r) => !r.ok);

    root.classList.remove('is-run');
    stage.replaceChildren();
    S.ringStop && S.ringStop();

    const arc = s('circle', { class: 'qz-res__arc', cx: 60, cy: 60, r: 52, pathLength: 100, 'stroke-dasharray': '0 100' });
    const gauge = s('svg', { class: 'qz-res__g', viewBox: '0 0 120 120', 'aria-hidden': 'true' }, s('circle', { class: 'qz-res__trk', cx: 60, cy: 60, r: 52 }), arc);
    const big = h('b.qz-res__n', '0');
    const gw = h('div.qz-res__gw', { role: 'img', 'aria-label': `Результат ${pct} процентов` }, gauge, h('div.qz-res__c', big, h('small', score + ' из ' + n)));
    const view = seg({ options: [{ v: 'bad', label: 'Ошибки · ' + wrong.length }, { v: 'all', label: 'Все вопросы' }], value: wrong.length ? 'bad' : 'all', onChange: (v) => renderReview(v) });
    const reviewList = h('div.qz-rev__l');
    const actions = h('div.qz-res__a',
      h('button.btn.btn--primary', { type: 'button', onclick: () => run(buildQuiz(data, topic, practice ? ask : n), false) }, 'Ещё раз', svg(P_RE)),
      wrong.length ? h('button.btn', { type: 'button', onclick: () => run(wrong.map((w) => prepare({ q: w.q.q, type: w.q.type, a: w.q.a.map((o) => ({ t: o.t, ok: o.ok })) }, w.q.topic)), true) }, 'Только ошибки') : null,
      h('a.btn', { href: '#/tests' }, 'К списку тестов'));

    const sec = h('section.qz-res.card.qz-res--' + tone,
      h('div.qz-res__top',
        gw,
        h('div.qz-res__t',
          h('p.eyebrow', practice ? 'Работа над ошибками' : (isAll ? 'Смешанный тест' : 'Тема ' + tnum + ' · ' + meta.short)),
          h('h1.h1', word + (pct >= 75 ? '!' : '')),
          h('div.qz-res__st',
            h('div', h('b.num', score), h('span', plural(score, ['верный ответ', 'верных ответа', 'верных ответов']))),
            h('div', h('b.num', n - score), h('span', plural(n - score, ['ошибка', 'ошибки', 'ошибок']))),
            h('div', h('b.num', mmss(time)), h('span', 'время'))),
          record ? h('p.qz-res__rec', h('i', { html: '★' }), 'Новый личный рекорд: было ' + prev.best + '%') : (prev && prev.attempts && !practice ? h('p.qz-res__bst', 'Лучший результат: ' + Math.max(prev.best, pct) + '%') : null),
          practice ? h('p.qz-res__bst', 'Этот проход не меняет сохранённый результат.') : null,
          actions)),
      h('ol.qz-res__pips', { 'aria-label': 'Ответы по вопросам' }, ...res.map((r, k) => h('li', h('a.' + (r.ok ? 'is-ok' : 'is-bad'), { href: '#qz-r' + k, title: 'Вопрос ' + (k + 1), onclick: (e) => { e.preventDefault(); view.set('all'); later(() => { const t = $('#qz-r' + k, root); t && t.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); }, 60); } }, k + 1)))));

    const rev = h('section.qz-rev', h('div.qz-rev__h', h('h2.h3', 'Разбор'), view.el), reviewList);
    stage.append(sec, rev);
    function renderReview(mode) {
      reviewList.replaceChildren();
      const list = mode === 'bad' ? wrong : res.map((r, k) => Object.assign({ k }, r));
      if (!list.length) { reviewList.append(h('div.qz-rev__ok', h('b', 'Ошибок нет'), h('span', 'Все ответы верны — можно переходить к следующей теме.'))); return; }
      list.forEach((r, j) => reviewList.append(reviewItem(r, j)));
    }
    renderReview(view.value);

    // gauge + counter
    gw.style.setProperty('--tone', 'var(--' + tone + ')');
    later(() => { arc.setAttribute('stroke-dasharray', pct + ' 100'); }, 60);
    tween(0, pct, 1400, (v) => { big.textContent = Math.round(v) + '%'; });
    if (pct >= 80) later(() => confetti(sec), 500);
    window.scrollTo({ top: 0, behavior: 'auto' });
    $('.qz-res h1', root).setAttribute('tabindex', '-1'); $('.qz-res h1', root).focus({ preventScroll: true });
  }

  function reviewItem(r, j) {
    const q = r.q, multi = q.type === 'ms';
    const mine = new Set(r.sel);
    return h('article.qz-ri.rv-i', { id: 'qz-r' + r.k, class: r.ok ? 'is-ok' : 'is-bad', style: { '--i': Math.min(j, 8) } },
      h('header', h('span.qz-ri__n', r.k + 1), h('span.qz-ri__s', r.ok ? 'Верно' : 'Ошибка'), isAll ? h('span.qz-tag', 'Тема ' + q.topic) : null),
      h('h3.qz-ri__q', q.q),
      h('ul.qz-ri__a', ...q.a.map((o, k) => {
        const chosen = mine.has(k);
        const cls = o.ok && chosen ? 'is-ok' : !o.ok && chosen ? 'is-bad' : o.ok ? 'is-miss' : '';
        const tag = o.ok && chosen ? 'ваш ответ · верно' : !o.ok && chosen ? 'ваш ответ' : o.ok ? (multi || !r.ok ? 'правильный ответ' : '') : '';
        return h('li', { class: cls }, h('i', { 'aria-hidden': 'true', html: o.ok ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5L19.5 7"/></svg>' : (chosen ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' : '') }), h('span', q.type === 'tf' ? tfLabel(o.t) : o.t), tag ? h('em', tag) : null);
      })));
  }

  /* confetti from the top of the result card */
  function confetti(host) {
    if (reduced()) return;
    const box = h('div.qz-conf', { 'aria-hidden': 'true' });
    const cols = ['--accent', '--d2', '--d5', '--d4', '--d6', '--d3'];
    for (let i = 0; i < 46; i++) {
      box.append(h('i', { style: { '--x': (Math.random() * 100).toFixed(1) + '%', '--dx': ((Math.random() - .5) * 220).toFixed(0) + 'px', '--dl': (Math.random() * .6).toFixed(2) + 's', '--du': (1.6 + Math.random() * 1.4).toFixed(2) + 's', '--c': 'var(' + cols[i % cols.length] + ')', '--r': Math.round(Math.random() * 720 - 360) + 'deg', '--w': (6 + Math.random() * 6).toFixed(0) + 'px' } }));
    }
    host.append(box); later(() => box.remove(), 3600);
  }

  /* keyboard */
  const onKey = (e) => {
    if (!S || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!root.classList.contains('is-run')) return;
    const tgt = e.target;
    if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
    if (/^[1-9]$/.test(e.key) && !S.locked) { const k = +e.key - 1; if (S.cur && k < S.cur.q.a.length) { e.preventDefault(); pick(k); } }
    else if (e.key === 'Enter' && !(tgt && tgt.tagName === 'BUTTON' && root.contains(tgt))) {
      e.preventDefault();
      if (S.locked) next(); else if (S.cur.q.type === 'ms' && S.sel.size) reveal();
    } else if ((e.key === 'ArrowRight') && S.locked) { e.preventDefault(); next(); }
  };
  document.addEventListener('keydown', onKey);
  offs.push(() => document.removeEventListener('keydown', onKey));

  intro();
  return {
    title: meta.short + ' · тест',
    destroy() { timers.forEach(clearTimeout); S && S.ringStop && S.ringStop(); offs.forEach((f) => f()); },
  };
}
