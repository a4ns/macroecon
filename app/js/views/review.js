/* ─────────────────────────────────────────────────────────────
   Повторение — #/review (хаб) и #/review/run (сессия). Интервальные карточки: вопросы и термины.
   Запрос: ?topic=n (одна тема) · ?mix=q|t (колода) · ?short=1 (5 карточек) · ?errors=1 (очередь неразобранных ошибок).
   Расписание — core/sr.js; ответы пишет core/qa.js; сам вопрос рисует ui/qrun.js.
   ───────────────────────────────────────────────────────────── */
import { h, $, loadCSS, plural, reduced } from '../core/dom.js';
import { glossary } from '../core/data.js';
import { prepare } from '../core/qid.js';
import { S, SR, ERR, MODE, dayNum } from '../core/state.js';
import * as sr from '../core/sr.js';
import * as qa from '../core/qa.js';
import * as plan from '../core/plan.js';
import { enhance } from '../core/motion.js';
import { TOPICS } from '../data/topics.js';
import { mountQuestion, typeOfQ } from '../ui/qrun.js';

const NB = ' ';
const svg = (inner, sw = 2) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });
const P_R = '<path d="M5 12h14M13 6l6 6-6 6"/>', P_RE = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
const SEC_Q = 25, SEC_T = 15;               // оценка времени на карточку, секунд
const RETRY_GAP = 4;                         // неверная карточка возвращается через ≥4 других
const cardsWord = (n) => n + NB + plural(n, ['карточка', 'карточки', 'карточек']);
const daysWord = (n) => n + NB + plural(n, ['день', 'дня', 'дней']);
const minutes = (nq, nt) => Math.max(1, Math.round((nq * SEC_Q + nt * SEC_T) / 60));
const tShort = (n) => (TOPICS[n] ? TOPICS[n].short : 'тема ' + n);

/* ── ежедневный учёт лимитов: SR.data.today = {d, rev, nw} ──────────────── */
function tally() {
  const t = SR.data.today, d = dayNum();
  if (!t || t.d !== d) SR.data.today = { d, rev: 0, nw: 0 };
  return SR.data.today;
}

/* ── контекст очереди ─────────────────────────────────────────────────────── */
function makeEnv(c, gl) {
  const lecOpenIn = (n) => { const tp = c.ix.byTopic.get(n); return !!tp && tp.lectures.some((l) => (S.data.lec[l.id] || {}).o); };
  const anyOpen = () => Object.values(S.data.lec).some((l) => l && l.o);
  const unlocked = (t) => S.data.role === 'self' || (t == null ? anyOpen() : lecOpenIn(t));
  const gmap = new Map(gl.map((g) => [g.id, g]));
  return { c, gl, gmap, unlocked, lecOpenIn };
}
/** очередь с учётом того, что уже сделано сегодня */
function queueFor(env, f, dry) {
  const set = S.data.set, t = tally();
  const topics = f.topic ? [f.topic] : undefined;
  const mix = f.topic ? 'q' : f.mix || 'all';
  const q = sr.buildQueue({ bank: env.c.bank, glossary: env.gl, topics, unlocked: env.unlocked, mix, dry });
  const left = { rev: Math.max(0, set.revPerDay - t.rev), nw: Math.max(0, set.newPerDay - t.nw) };
  if (q.catchup && !dry) t.cu = 1;      // в этот день наверстываем: новые карточки не вводим и при повторном заходе
  return { due: q.due.slice(0, left.rev), fresh: t.cu || q.catchup ? [] : q.fresh.slice(0, left.nw), overdue: q.overdue, catchup: q.catchup, shifted: q.shifted, left };
}
/** элементы сессии по ключам */
function itemOf(env, key, fresh) {
  if (sr.isTerm(key)) { const g = env.gmap.get(key); return g ? { key, kind: 't', g, fresh } : null; }
  const list = env.c.bank.byUkey.get(key); if (!list) return null;
  const Q = { ...list[0], group: list };
  return { key, kind: 'q', Q, topic: Q.topic, fresh };
}
const countKinds = (items) => ({ q: items.filter((i) => i.kind === 'q').length, t: items.filter((i) => i.kind === 't').length });

/* ── route ───────────────────────────────────────────────────────────────── */
export async function load() {
  const [c, gl] = await Promise.all([plan.ctx(), glossary(), loadCSS('app/css/v-review.css'), loadCSS('app/css/v-qrun.css')]);
  return { c, gl };
}
export function mount(el, ctx, data) {
  const env = makeEnv(data.c, data.gl);
  const root = h('div.rw');
  el.append(root);
  const topic = +ctx.query.topic || 0;
  const f = { topic: topic >= 1 && topic <= 14 ? topic : 0, mix: ctx.query.mix === 'q' || ctx.query.mix === 't' ? ctx.query.mix : 'all', short: ctx.query.short === '1' || ctx.query.n === '5', errors: ctx.query.errors === '1' };
  const inst = ctx.params.stage === 'run' ? runView(root, env, f) : hubView(root, env, f);
  const off = enhance(el);
  return { title: 'Повторение', destroy() { inst.destroy(); off && off(); } };
}

/* ═════════════════════════════ хаб ═════════════════════════════════════════ */
function hubView(root, env, f) {
  const { c } = env, bank = c.bank;
  const wrap = h('div.rw__wrap'); root.append(wrap);
  const qsOf = () => {
    const o = []; if (f.topic) o.push('topic=' + f.topic); if (f.mix !== 'all' && !f.topic) o.push('mix=' + f.mix); return o;
  };
  const link = (extra = []) => '#/review/run' + ((qsOf().concat(extra)).length ? '?' + qsOf().concat(extra).join('&') : '');
  const setF = (patch) => { Object.assign(f, patch); const o = qsOf(); history.replaceState(null, '', '#/review' + (o.length ? '?' + o.join('&') : '')); draw(); };

  function stats() {
    const cd = SR.data.c, today = dayNum();
    const known = new Set(bank.all.map((Q) => Q.ukey));
    const qk = Object.keys(cd).filter((k) => known.has(k)), tk = Object.keys(cd).filter(sr.isTerm);
    const due = (ks) => ks.filter((k) => cd[k][1] <= today).length;
    const learned = (ks) => ks.filter((k) => cd[k][0] >= 3).length;
    const td = (mix) => { const x = queueFor(env, { topic: 0, mix }, true); return x.due.length + x.fresh.length; };
    return { q: { total: bank.counts.unique, inDeck: qk.length, due: td('q'), learned: learned(qk) }, t: { total: env.gl.length, inDeck: tk.length, due: td('t'), learned: learned(tk) }, all: td('all') };
  }
  const topicDue = (n) => {
    const cd = SR.data.c, today = dayNum(); let k = 0;
    bank.unique(n).forEach((Q) => { const x = cd[Q.ukey]; if (x && x[1] <= today) k++; });
    return k;
  };

  function draw() {
    const qu = queueFor(env, f, true);
    const nq = [...qu.due, ...qu.fresh].filter((k) => !sr.isTerm(k)).length, nt = qu.due.length + qu.fresh.length - nq;
    const N = qu.due.length + qu.fresh.length;
    const st = stats();
    const errN = qa.openErrors(bank).length;
    const set = S.data.set, t = tally();
    const lockedTopics = S.data.role === 'self' ? 0 : bank.topics.filter((n) => !env.unlocked(n)).length;
    const hasDeck = st.q.inDeck + st.t.inDeck > 0;
    wrap.replaceChildren();

    const startBtn = N ? h('a.btn.btn--primary.btn--lg', { href: link() }, 'Начать', svg(P_R)) : null;
    const shortBtn = N > 5 ? h('a.btn.btn--lg', { href: link(['short=1']) }, 'Короткая сессия (5)') : null;
    wrap.append(h('header.rw-head',
      h('p.eyebrow.eyebrow--dot', 'Повторение'),
      h('h1.h1.rw-head__t', N ? ['К показу сегодня: ', h('span.rw-head__n', N)] : f.topic ? 'По теме ' + f.topic + ' на сегодня всё' : 'На сегодня всё'),
      N
        ? h('p.lede', '≈' + NB + minutes(nq, nt) + NB + 'мин' + (nq && nt ? ' · ' + nq + NB + plural(nq, ['вопрос', 'вопроса', 'вопросов']) + ' и ' + nt + NB + plural(nt, ['термин', 'термина', 'терминов']) : ''))
        : h('p.lede', hasDeck ? emptyLine(st) : 'Колода пока пуста: первые карточки появятся, когда вы откроете лекцию темы.'),
      h('div.rw-head__a', startBtn, shortBtn,
        !N && errN ? h('a.btn.btn--primary.btn--lg', { href: '#/review/run?errors=1' }, 'Разобрать ошибки · ' + errN, svg(P_R)) : null,
        !N && !errN ? h('a.btn.btn--lg', { href: hasDeck ? '#/today' : '#/course' }, hasDeck ? 'Следующий шаг' : 'К курсу', svg(P_R)) : null),
      qu.catchup ? h('p.rw-note.rw-note--warn', 'Накопилось ' + cardsWord(qu.overdue) + '. Не надо всё сразу: сегодня ' + (S.data.set.revPerDay) + ', остальные раскинем на ближайшие дни.') : null));

    /* колоды */
    const deck = (key, title, sub, s, extra) => h('button.rw-deck', { type: 'button', role: 'radio', 'aria-checked': String(f.mix === key && !f.topic), disabled: !!f.topic && key !== 'q', onclick: () => setF({ mix: key, topic: 0 }) },
      h('b.rw-deck__t', title), h('span.rw-deck__s', sub),
      h('span.rw-deck__m', s ? [h('span', s.inDeck + NB + 'в колоде'), h('span', 'сегодня' + NB + s.due), h('span', 'выучено' + NB + s.learned)] : null),
      extra || null);
    wrap.append(h('section.rw-sec', h('h2.rw-h', 'Колоды'),
      h('div.rw-decks', { role: 'radiogroup', 'aria-label': 'Колода' },
        deck('all', 'Всё вместе', 'Вопросы и термины вперемешку, 2 : 1', { inDeck: st.q.inDeck + st.t.inDeck, due: st.all, learned: st.q.learned + st.t.learned }),
        deck('q', 'Вопросы', bank.counts.unique + NB + 'различных' + (bank.counts.records !== bank.counts.unique ? ' — в файле ' + bank.counts.records + NB + 'записей, часть повторяется в разных темах' : ''), st.q),
        deck('t', 'Термины', st.t.total + NB + 'термина из словаря: термин → определение', st.t)),
      h('p.rw-note', 'Карточки получают ящик 0…5; интервалы — 1, 3, 7, 14, 30 дней. Неверный ответ возвращает карточку на завтра.')));

    /* темы */
    const chips = [h('button.chip' + (!f.topic ? '.is-on' : ''), { type: 'button', 'aria-pressed': String(!f.topic), onclick: () => setF({ topic: 0 }) }, 'Все темы')];
    bank.topics.forEach((n) => {
      const d = topicDue(n);
      chips.push(h('button.chip.rw-tp' + (f.topic === n ? '.is-on' : ''), { type: 'button', 'aria-pressed': String(f.topic === n), title: 'Тема ' + n + '. ' + tShort(n) + (d ? ' · к показу: ' + d : ''), onclick: () => setF({ topic: n }) },
        n, d ? h('small', d) : null));
    });
    wrap.append(h('section.rw-sec', h('h2.rw-h', 'Тема'), h('div.rw-tps', { role: 'group', 'aria-label': 'Фильтр по темам' }, ...chips),
      f.topic ? h('p.rw-note', 'Тема ' + f.topic + '. ' + tShort(f.topic) + ' · только вопросы' + (env.unlocked(f.topic) ? '' : ' · новые карточки появятся после первой лекции темы')) : null));

    /* ошибки и пояснения */
    wrap.append(h('section.rw-sec.rw-more',
      errN ? h('a.rw-link.card', { href: '#/review/run?errors=1' }, h('b', 'Неразобранные ошибки: ' + errN), h('span', 'Короткая сессия только по тем вопросам, где вы ошиблись'), svg(P_R)) : null,
      h('p.rw-note', 'Лимиты на день: ' + set.revPerDay + NB + 'повторений и ' + set.newPerDay + NB + 'новых. Сегодня сделано: ' + t.rev + NB + 'повторений, ' + t.nw + NB + 'новых. ', h('a', { href: '#/settings' }, 'Изменить в настройках')),
      lockedTopics && S.data.role !== 'self' ? h('p.rw-note', 'Новые карточки темы вводятся, когда вы открыли в ней хотя бы одну лекцию. Сейчас закрыто тем: ' + lockedTopics + '. Режим «Вся программа» в настройках снимает это ограничение.') : null));
  }
  function emptyLine(st) {
    const cd = SR.data.c, today = dayNum();
    const next = Math.min(...Object.keys(cd).map((k) => cd[k][1]).filter((d) => d > today), Infinity);
    return 'Следующая карточка — ' + (next === Infinity || next - today <= 1 ? 'завтра' : 'через ' + daysWord(next - today)) + '. Колода: ' + (st.q.inDeck + st.t.inDeck) + NB + 'карточек.';
  }
  draw();
  return { destroy() {} };
}

/* ═════════════════════════════ сессия ══════════════════════════════════════ */
function runView(root, env, f) {
  const { c } = env, bank = c.bank, today = dayNum();
  const set = S.data.set;
  const wrap = h('div.rw__wrap'); root.append(wrap);
  let timers = [], offs = [], qr = null, destroyed = false;
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };

  /* состав сессии */
  let queue, items = [], catchup = null;
  if (f.errors) {
    const ids = qa.openErrors(bank).sort((a, b) => (ERR.data[b].last || 0) - (ERR.data[a].last || 0));
    const seen = new Set();
    ids.forEach((qid) => { const Q = bank.byQid.get(qid); if (Q && !seen.has(Q.ukey)) { seen.add(Q.ukey); const it = itemOf(env, Q.ukey, false); it && items.push(it); } });
    items = items.slice(0, f.short ? 5 : 20);
  } else {
    queue = queueFor(env, f, false);
    items = [...queue.due.map((k) => itemOf(env, k, false)), ...queue.fresh.map((k) => itemOf(env, k, true))].filter(Boolean);
    if (f.short) items = items.slice(0, 5);
    if (queue.catchup) catchup = queue;
  }
  const run = { items: items.slice(), i: 0, total: items.length, done: 0, skipped: 0, ok: 0, nq: 0, okq: 0, byTopic: new Map(), keys: new Set(), retry: new Map(), t0: Date.now() };
  const label = f.errors ? 'Разбор ошибок' : f.topic ? 'Тема ' + f.topic + ' · ' + tShort(f.topic) : f.mix === 'q' ? 'Вопросы' : f.mix === 't' ? 'Термины' : 'Повторение';

  const top = h('div.rw__top',
    h('nav.crumbs', { 'aria-label': 'Навигация' }, h('a', { href: '#/review' }, 'Повторение'), h('i', '/'), h('span', f.errors ? 'Ошибки' : 'Сессия')),
    h('a.btn.btn--sm.btn--quiet', { href: '#/review' }, 'Закончить'));
  const stage = h('div.rw__stage');
  wrap.append(top, stage);

  if (!items.length) return emptyState(), { destroy };

  /* панель прогресса */
  const ring = h('div.ring.rw-ring', { role: 'img', style: { '--s': '3.4rem', '--p': 0 } }, h('b.num', '1'));
  const bLab = h('b'), bSub = h('span');
  const bLast = h('div.rw-last', { role: 'status', 'aria-live': 'polite' });
  const bar = h('div.rw-bar', ring, h('div.rw-bar__l', bLab, bSub), bLast);
  const host = h('div.rw-host');
  const bNext = h('button.btn.btn--primary.btn--lg.rw-next', { type: 'button', hidden: true }, 'Дальше', svg(P_R));
  const bSkip = h('button.btn.btn--quiet.rw-skip', { type: 'button' }, 'Пропустить на сегодня');
  const act = h('div.rw-act', bSkip, bNext);
  bNext.addEventListener('click', next); bSkip.addEventListener('click', skip);
  stage.append(...(catchup ? [h('p.rw-note.rw-note--warn', 'Накопилось ' + cardsWord(catchup.overdue) + '. Не надо всё сразу: сегодня ' + set.revPerDay + ', остальные раскинем на ближайшие дни.')] : []), bar, host, act);

  function setBar() {
    const doneAll = run.done + run.skipped, cur = items_remaining();
    const it = run.items[run.i], answered = !!(it && it.kind === 'q' && qr && qr.state().answered && !it.retry);
    const pos = Math.min(doneAll + (answered ? 0 : 1), run.total);
    ring.style.setProperty('--p', Math.min(1, doneAll / run.total).toFixed(3));
    $('.num', ring).textContent = pos;
    ring.setAttribute('aria-label', `Карточка ${pos} из ${run.total}`);
    bLab.textContent = `${pos} из ${run.total} · ≈${minutes(cur.q, cur.t)}${NB}мин`;
    bSub.textContent = label;
  }
  function items_remaining() {
    const rest = run.items.slice(run.i).filter((it) => !it.retry); return countKinds(rest);
  }

  /* показ карточки */
  function show() {
    qr && qr.destroy(); qr = null; host.replaceChildren(); bNext.hidden = true; bSkip.hidden = false; bLast.dataset.show = '';
    const it = run.items[run.i];
    if (!it) return finish();
    setBar();
    if (it.kind === 'q') { bLast.textContent = ''; showQ(it); } else showT(it);
    if (innerWidth < 700) host.scrollIntoView({ block: 'nearest' });
  }
  function nextInterval(key) {
    const k = SR.data.c[key]; if (!k) return '';
    const d = Math.max(1, k[1] - dayNum());
    return d === 1 ? 'завтра' : 'через ' + daysWord(d);
  }
  function chipNext(key, retried) {
    return h('p.rw-chip', { role: 'status' }, 'Следующий показ: ' + nextInterval(key), retried ? h('span', ' · вернётся ещё раз в этой сессии') : null);
  }
  function requeue(it) {
    const n = (run.retry.get(it.key) || 0); if (n >= 2) return false;
    run.retry.set(it.key, n + 1);
    const at = Math.min(run.items.length, run.i + 1 + RETRY_GAP);
    run.items.splice(at, 0, { ...it, retry: true, fresh: false });
    return true;
  }
  function count(it, ok) {
    run.done++; run.keys.add(it.key); if (ok) run.ok++;
    if (it.kind === 'q') { run.nq++; if (ok) run.okq++; const b = run.byTopic.get(it.topic) || { n: 0, ok: 0 }; b.n++; if (ok) b.ok++; run.byTopic.set(it.topic, b); }
    if (!f.errors) { const t = tally(); if (it.fresh) t.nw++; else t.rev++; SR.save(); }
  }

  function showQ(it) {
    const Q = prepare(it.Q);
    const card = h('div.card.rw-card'); host.append(card);
    const retry = !!it.retry;
    qr = mountQuestion(card, {
      Q, mode: MODE.review, conf: !!set.conf && !retry, reveal: 'now', index: retry ? null : run.done + run.skipped + 1, total: retry ? null : run.total,
      onAnswer: ({ ok, sel, conf, ms }) => {
        let again = false;
        if (!retry) {
          sr.grade(it.key, ok ? 'ok' : 'bad', { type: typeOfQ(Q), guess: conf === 0 });
          qa.record({ Q, ok, mode: MODE.review, conf, ms, sel: sel.map((k) => (Q.a[k] ? Q.a[k].i : k)) });
          count(it, ok);
          if (!ok) again = requeue(it);
        } else if (!ok) again = requeue(it);
        const fb = $('.qr-fb', card);
        if (retry) fb.append(h('p.rw-chip', 'Закрепление: результат расписание не меняет.'));
        else fb.append(chipNext(it.key, again));
        afterAnswer(!retry ? ok : null, it);
      },
    });
    const tag = retry ? h('p.rw-retry', 'Закрепление · эта карточка в прошлый раз не далась') : (it.fresh ? h('p.rw-retry.rw-retry--new', 'Новая карточка') : null);
    if (tag) card.prepend(tag);
  }
  function afterAnswer(ok, it) {
    setBar();
    bSkip.hidden = true; bNext.hidden = false; bNext.focus({ preventScroll: true });
    bNext.textContent = ''; bNext.append(run.i >= run.items.length - 1 ? 'Итоги' : 'Дальше', svg(P_R));
    later(() => { const fb = $('.qr-fb', host); fb && fb.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }, 140);
  }

  /* термин */
  function showT(it) {
    const g = it.g, retry = !!it.retry;
    let flipped = false;
    const face = h('div.rw-term__f');
    const card = h('article.card.rw-card.rw-term', { 'data-side': 'front' }, retry ? h('p.rw-retry', 'Закрепление · эта карточка в прошлый раз не далась') : (it.fresh ? h('p.rw-retry.rw-retry--new', 'Новая карточка') : null),
      h('p.rw-term__k', 'Термин', g.abbr ? h('span', ' · ' + g.abbr) : null), face);
    const grades = [['bad', 'Не вспомнил', 1], ['hard', 'С трудом', 2], ['ok', 'Вспомнил', 3], ['easy', 'Легко', 4]];
    const gbox = h('div.rw-gr', { role: 'group', 'aria-label': 'Насколько хорошо вспомнили', hidden: true },
      ...grades.map(([r, l, k]) => h('button.rw-gr__b.rw-gr__b--' + r, { type: 'button', 'data-r': r, onclick: () => rate(r) }, h('span.kbd', k), l)));
    const flipBtn = h('button.btn.btn--primary.btn--lg.rw-flip', { type: 'button', onclick: flip }, 'Показать определение', h('span.kbd', 'Space'));
    const paintFront = () => { face.replaceChildren(h('h2.rw-term__t', { tabindex: '-1' }, g.term), h('p.rw-term__h', 'Вспомните определение своими словами, затем переверните карточку.')); };
    const paintBack = () => { face.replaceChildren(h('h2.rw-term__t.rw-term__t--s', { tabindex: '-1' }, g.term), h('p.rw-term__d', g.def)); };
    paintFront();
    host.append(card, h('div.rw-grw', gbox, flipBtn));
    $('.rw-term__t', card).focus({ preventScroll: true });
    function flip() {
      if (flipped) return; flipped = true;
      const sw = () => { paintBack(); card.dataset.side = 'back'; flipBtn.hidden = true; gbox.hidden = false; bSkip.hidden = true; $('.rw-term__t', card).focus({ preventScroll: true }); card.classList.remove('is-flip'); };
      if (reduced()) sw(); else { card.classList.add('is-flip'); later(sw, 90); }
    }
    function rate(r) {
      if (!flipped || gbox.dataset.done) return; gbox.dataset.done = '1';
      const ok = r !== 'bad';
      if (!retry) {
        sr.grade(it.key, r, { type: 'term' }); count(it, ok);
        const again = !ok && requeue(it);
        bLast.textContent = 'Предыдущий термин: следующий показ ' + nextInterval(it.key) + (again ? ' · вернётся в этой сессии' : '');
      } else if (!ok) requeue(it);
      run.i++; show();
    }
    host._term = { flip, rate, isFlipped: () => flipped };
  }

  function next() {
    if (!qr || !qr.state().answered || host.classList.contains('is-out')) return;
    run.i++;
    if (reduced()) return show();
    host.classList.add('is-out'); later(() => { host.classList.remove('is-out'); show(); }, 160);
  }
  function skip() {
    const it = run.items[run.i]; if (!it) return;
    if (!it.retry) { run.skipped++; const k = SR.data.c[it.key]; if (k && k[1] <= today) { k[1] = today + 1; SR.save(); } }
    run.i++; show();
  }

  /* клавиатура */
  const onKey = (e) => {
    if (destroyed || e.ctrlKey || e.metaKey || e.altKey || e.qrunHandled) return;
    const tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
    const it = run.items[run.i]; if (!it) return;
    if (it.kind === 't' && host._term) {
      const T = host._term;
      if (!T.isFlipped() && (e.key === ' ' || e.key === 'Enter') && !(tg && tg.tagName === 'BUTTON' && e.key === 'Enter')) { e.preventDefault(); T.flip(); }
      else if (T.isFlipped() && /^[1-4]$/.test(e.key)) { e.preventDefault(); T.rate(['bad', 'hard', 'ok', 'easy'][+e.key - 1]); }
    } else if (it.kind === 'q' && qr && qr.state().answered && (e.key === 'ArrowRight' || (e.key === 'Enter' && !(tg && tg.tagName === 'BUTTON')))) { e.preventDefault(); next(); }
  };
  document.addEventListener('keydown', onKey); offs.push(() => document.removeEventListener('keydown', onKey));

  /* итоги */
  function finish() {
    qr && qr.destroy(); qr = null;
    stage.replaceChildren();
    const cd = SR.data.c;
    const n = run.done, ok = run.ok;
    const tomorrow = [...run.keys].filter((k) => cd[k] && cd[k][1] <= today + 1).length;
    if (run.nq) qa.session({ topic: f.topic || 0, ok: run.okq, n: run.nq, mode: MODE.review });
    const tops = [...run.byTopic.entries()].filter(([, b]) => b.n >= 2).map(([t, b]) => ({ t, r: b.ok / b.n, n: b.n })).sort((a, b) => b.r - a.r || b.n - a.n);
    let cmp = null;
    if (!f.topic && tops.length >= 2 && tops[0].r > tops[tops.length - 1].r) cmp = 'Лучше всего усвоена тема ' + tops[0].t + ' (' + tShort(tops[0].t) + '), хуже всего — тема ' + tops[tops.length - 1].t + ' (' + tShort(tops[tops.length - 1].t) + ').';
    const pct = n ? ok / n : 0, tone = pct >= .75 ? 'ok' : pct >= .5 ? 'warn' : 'bad';
    const t = tally();
    const restDue = (() => { const q = queueFor(env, f, true); return q.due.length + q.fresh.length; })();
    const errN = qa.openErrors(bank).length;
    const ringBig = h('div.ring.rw-res__r', { style: { '--s': '6.4rem', '--p': pct, '--c': 'var(--' + tone + ')' }, role: 'img', 'aria-label': `Верно ${ok} из ${n}` }, h('b.num', ok + '/' + n));
    stage.append(h('section.card.rw-res.rw-res--' + tone,
      h('div.rw-res__top', ringBig, h('div',
        h('p.eyebrow', label),
        h('h1.h1.rw-res__h', n ? 'Сегодня: ' + cardsWord(n) + ', ' + ok + ' верно.' : 'Эту сессию вы пропустили.'),
        h('p.rw-res__p', n ? ('Завтра вернётся ' + tomorrow + '.' + (cmp ? ' ' + cmp : '')) : 'Карточки остались на очереди.'))),
      run.skipped ? h('p.rw-note', 'Пропущено на сегодня: ' + run.skipped + '. Они придут завтра в начале очереди.') : null,
      restDue && !f.errors ? h('p.rw-note', 'В очереди остаётся ещё ' + cardsWord(restDue) + '.') : h('p.rw-note', f.errors ? '' : 'На сегодня карточек больше нет: сделано ' + t.rev + NB + plural(t.rev, ['повторение', 'повторения', 'повторений']) + ' и ' + t.nw + NB + plural(t.nw, ['новая', 'новые', 'новых']) + '.'),
      h('div.rw-res__a',
        restDue && !f.errors ? h('a.btn.btn--primary', { href: '#/review/run' + (f.topic ? '?topic=' + f.topic : '') }, 'Продолжить', svg(P_R)) : null,
        errN && !f.errors ? h('a.btn' + (restDue ? '' : '.btn--primary'), { href: '#/review/run?errors=1' }, 'Разобрать ошибки · ' + errN) : null,
        f.errors && errN ? h('a.btn.btn--primary', { href: '#/review/run?errors=1' }, 'Ещё ошибки · ' + errN, svg(P_RE)) : null,
        h('a.btn', { href: '#/today' }, 'Следующий шаг'),
        h('a.btn.btn--quiet', { href: '#/review' }, 'К повторению'))));
    window.scrollTo({ top: 0, behavior: 'auto' });
    const hh = $('h1', stage); hh.setAttribute('tabindex', '-1'); hh.focus({ preventScroll: true });
  }

  function emptyState() {
    const errN = qa.openErrors(bank).length;
    const cd = SR.data.c;
    const nxt = Math.min(...Object.keys(cd).map((k) => cd[k][1]).filter((d) => d > today), Infinity);
    stage.append(h('section.card.rw-res',
      h('p.eyebrow', label),
      h('h1.h1.rw-res__h', f.errors ? 'Неразобранных ошибок нет' : 'На сегодня всё'),
      h('p.rw-res__p', f.errors ? 'Ошибки появляются в журнале после неверных ответов в тестах и повторении.' : 'Следующая карточка — ' + (nxt === Infinity || nxt - today <= 1 ? 'завтра' : 'через ' + daysWord(nxt - today)) + '.' + (Object.keys(cd).length ? '' : ' Колода появится, когда вы откроете первую лекцию.')),
      h('div.rw-res__a',
        errN && !f.errors ? h('a.btn.btn--primary', { href: '#/review/run?errors=1' }, 'Разобрать ошибки · ' + errN, svg(P_R)) : null,
        h('a.btn' + (errN && !f.errors ? '' : '.btn--primary'), { href: '#/today' }, 'Следующий шаг', svg(P_R)),
        h('a.btn.btn--quiet', { href: '#/review' }, 'К повторению'))));
  }

  function destroy() { destroyed = true; timers.forEach(clearTimeout); offs.forEach((o) => o()); qr && qr.destroy(); S.save(); SR.save(); }
  show();
  return { destroy };
}
