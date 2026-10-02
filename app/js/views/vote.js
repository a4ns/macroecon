/* Голосование А–Д без сервера — #/teach/vote/:topic и компонент mountVote(root, {topic, onClose}).
   Студенты поднимают карточки (или пальцы), преподаватель вносит счёт клавишами 1…5 / кнопками ±.
   Enter — закрыть голосование и показать распределение, R — раскрыть верный ответ. Метод — peer instruction. */
import { h, $, $$, loadCSS, toast } from '../core/dom.js';
import { bank } from '../core/qid.js';
import { S } from '../core/state.js';
import { TOPICS } from '../data/topics.js';
import { nb } from './_typo.js';

const LET = ['А', 'Б', 'В', 'Г', 'Д'];
const CSS = 'app/css/v-vote.css';
const NBSP = ' ';

/** вопрос читается с проектора: текст ≤160 знаков, варианты ≤90 */
export const projectorOk = (Q) => Q.q.length <= 160 && Q.a.every((o) => o.t.length <= 90);
/** годится для голосования: mc и tf, не больше пяти вариантов (А–Д); ms отключены */
export const votable = (Q) => (Q.type === 'mc' || Q.type === 'tf') && Q.a.length >= 2 && Q.a.length <= 5;

const isoDay = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const pctOf = (n, t) => (t ? Math.round(n / t * 100) : 0);
const fmtT = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function teachStore() {
  const d = S.data;
  if (!d.teach || typeof d.teach !== 'object') d.teach = { votes: [], notes: {}, last: null };
  if (!Array.isArray(d.teach.votes)) d.teach.votes = [];
  return d.teach;
}

/** доля верных голосов: верными считаются все варианты с ok */
export function correctShare(Q, counts) { const t = sum(counts); return t ? sum(counts.map((c, i) => (Q.a[i] && Q.a[i].ok ? c : 0))) / t : 0; }

/** подсказка метода по доле верных (0…100) */
export function methodHint(p) {
  if (p < 30) return { tone: 'low', title: 'Объясните заново и повторите вопрос', sub: 'Меньше трети класса ответили верно: тема не усвоена. Кратко объясните иначе и проведите голосование ещё раз.' };
  if (p <= 70) return { tone: 'mid', title: 'Обсудите в парах 2 минуты и переголосуйте', sub: 'Мнения разделились: это лучший случай для обсуждения. Пусть соседи с разными ответами убеждают друг друга.' };
  return { tone: 'high', title: 'Коротко подтвердите и идите дальше', sub: 'Большинство ответили верно. Назовите ответ, одной фразой объясните, почему остальные неверны.' };
}

export async function load(ctx) {
  await Promise.all([loadCSS(CSS), bank()]);
  const b = await bank();
  const t = parseInt(ctx.params.topic, 10);
  if (!b.byTopic.has(t)) throw new Error('Нет такой темы: ' + ctx.params.topic);
  return { topic: t, b };
}

export function mount(el, ctx, { topic, b }) {
  const chips = h('nav.vq__topics', { 'aria-label': 'Тема голосования' }, ...b.topics.map((n) => h('a.vq__tc' + (n === topic ? '.is-on' : ''), { href: '#/teach/vote/' + n, 'aria-current': n === topic ? 'page' : null, title: (TOPICS[n] || {}).short || '' }, String(n))));
  const box = h('div.vq__page');
  const page = h('article.wrap.vqpage',
    h('header.vqpage__head',
      h('nav.crumbs', { 'aria-label': 'Навигация' }, h('a', { href: '#/teach' }, 'Преподавателю'), h('i', '/'), h('span', 'Голосование')),
      h('div.vqpage__row', h('h1.vqpage__h', 'Голосование ', h('em', 'А–Д')), chips),
      h('p.vqpage__sub', 'Сервера нет: студенты поднимают карточки А–Д, вы вносите счёт клавишами. ', h('a', { href: '#/print/cards' }, 'Карточки для печати'), '.')),
    box);
  el.append(page);
  const inst = mountVote(box, { topic, qid: ctx.query && ctx.query.q, page: true });
  return { title: 'Голосование · тема ' + topic, destroy() { inst.destroy(); } };
}

/** @param {HTMLElement} root @param {{topic:number, qid?:string, onClose?:Function, embedded?:boolean, page?:boolean}} o */
export function mountVote(root, o = {}) {
  const topic = +o.topic;
  let dead = false;
  const st = {
    proj: true, pool: [], idx: 0, Q: null, round: 1, phase: 'vote', counts: [], undo: [], revealed: false, recIdx: -1,
    asked: new Set(), log: new Map(), r1: null, tmr: 0, tmrLeft: 0, b: null,
  };
  const wrap = h('div.vq' + (o.embedded ? '.vq--emb' : ''), { tabindex: '-1' }, h('p.vq__load', 'Загрузка вопросов…'));
  root.append(wrap);

  /* ── пул вопросов ── */
  function buildPool(keepQid) {
    const all = st.b.unique(topic).filter(votable);
    st.pool = st.proj ? all.filter(projectorOk) : all;
    const at = keepQid ? st.pool.findIndex((q) => q.qid === keepQid) : -1;
    st.idx = at >= 0 ? at : 0;
  }
  function setQ(Q) {
    st.Q = Q; st.round = 1; st.phase = 'vote'; st.counts = Q ? Q.a.map(() => 0) : []; st.undo = []; st.revealed = false; st.recIdx = -1; st.r1 = null;
    clearInterval(st.tmr); st.tmr = 0; st.tmrLeft = 0;
    draw();
  }
  const pick = (i) => { if (!st.pool.length) return setQ(null); st.idx = ((i % st.pool.length) + st.pool.length) % st.pool.length; setQ(st.pool[st.idx]); };
  const nextQ = () => pick(st.idx + 1);
  const otherQ = () => {
    const left = st.pool.map((q, i) => i).filter((i) => i !== st.idx && !st.asked.has(st.pool[i].qid));
    const cand = left.length ? left : st.pool.map((q, i) => i).filter((i) => i !== st.idx);
    if (!cand.length) return;
    pick(cand[Math.floor(Math.random() * cand.length)]);
  };

  /* ── ввод ── */
  function bump(i, d) {
    if (st.phase !== 'vote' || !st.Q || i < 0 || i >= st.counts.length) return;
    const v = st.counts[i] + d; if (v < 0) return;
    st.counts[i] = v; st.undo.push([i, d]); upd(i);
  }
  function undo() { const u = st.undo.pop(); if (!u) return; st.counts[u[0]] -= u[1]; upd(u[0]); }
  function upd(i) {
    const n = wrap.querySelector('[data-n="' + i + '"]'); if (n) { n.textContent = st.counts[i]; n.parentElement.classList.remove('is-pop'); void n.offsetWidth; n.parentElement.classList.add('is-pop'); }
    const t = wrap.querySelector('[data-total]'); if (t) t.textContent = sum(st.counts);
    const m = wrap.querySelector('[data-minus="' + i + '"]'); if (m) m.disabled = st.counts[i] <= 0;
    const u = wrap.querySelector('[data-undo]'); if (u) u.disabled = !st.undo.length;
  }
  function closeVoting() {
    if (st.phase !== 'vote' || !st.Q) return;
    const total = sum(st.counts);
    if (!total) { toast('Внесите хотя бы один голос'); return; }
    // запись: один элемент на раунд вопроса; повторное закрытие того же раунда его перезаписывает
    const T = teachStore();
    const e = { date: isoDay(), qid: st.Q.qid, round: st.round, counts: st.counts.slice(), total };
    if (st.recIdx >= 0 && T.votes[st.recIdx] && T.votes[st.recIdx].qid === e.qid && T.votes[st.recIdx].round === e.round) T.votes[st.recIdx] = e;
    else { T.votes.push(e); st.recIdx = T.votes.length - 1; }
    S.save();
    const L = st.log.get(st.Q.qid) || { Q: st.Q, shares: [], totals: [] };
    L.shares[st.round - 1] = pctOf(sum(st.counts.map((c, i) => (st.Q.a[i].ok ? c : 0))), total); L.totals[st.round - 1] = total;
    st.log.set(st.Q.qid, L); st.asked.add(st.Q.qid);
    st.phase = 'result'; st.revealed = false;
    draw();
  }
  function reveal() { if (st.phase !== 'result') return; st.revealed = !st.revealed; draw(); }
  function backToVote() { if (st.phase !== 'result') return; st.phase = 'vote'; st.revealed = false; draw(); }
  function secondRound() {
    if (st.phase !== 'result' || st.round !== 1) return;
    st.r1 = { counts: st.counts.slice(), total: sum(st.counts) };
    st.round = 2; st.phase = 'vote'; st.counts = st.Q.a.map(() => 0); st.undo = []; st.revealed = false; st.recIdx = -1;
    clearInterval(st.tmr); st.tmr = 0; draw();
  }
  function discussTimer(btn) {
    if (st.tmr) { clearInterval(st.tmr); st.tmr = 0; st.tmrLeft = 0; btn.textContent = 'Таймер 2:00'; return; }
    st.tmrLeft = 120; btn.textContent = 'Осталось ' + fmtT(st.tmrLeft);
    st.tmr = setInterval(() => {
      st.tmrLeft--; if (st.tmrLeft <= 0) { clearInterval(st.tmr); st.tmr = 0; btn.textContent = 'Время вышло'; toast('Время обсуждения вышло'); return; }
      btn.textContent = 'Осталось ' + fmtT(st.tmrLeft);
    }, 1000);
  }

  function toggleFull(force) {
    const on = force != null ? force : !wrap.classList.contains('vq--full');
    wrap.classList.toggle('vq--full', on);
    document.documentElement.classList.toggle('vq-full', on);
    try { if (on && wrap.requestFullscreen && !document.fullscreenElement) wrap.requestFullscreen().catch(() => {}); if (!on && document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* */ }
    draw();
  }
  const onFs = () => { if (document.fullscreenElement === wrap) wrap.dataset.realfs = '1'; else if (wrap.dataset.realfs) { wrap.dataset.realfs = ''; if (wrap.classList.contains('vq--full')) toggleFull(false); } };
  document.addEventListener('fullscreenchange', onFs);

  function onKey(e) {
    if (dead || !wrap.isConnected) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = t && t.tagName;
    if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
    if (m && st.phase === 'vote') { e.preventDefault(); if (e.repeat) return; bump(+m[1] - 1, e.shiftKey ? -1 : 1); return; }
    if (e.repeat) return;
    if (e.code === 'KeyF' && o.page) { e.preventDefault(); toggleFull(); return; }
    if (e.key === 'Escape' && wrap.classList.contains('vq--full')) { e.preventDefault(); toggleFull(false); return; }
    if (e.key === 'Enter') { if (tag === 'BUTTON' || tag === 'A') return; e.preventDefault(); if (st.phase === 'vote') closeVoting(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); st.phase === 'vote' ? undo() : backToVote(); return; }
    const L = { KeyR: reveal, KeyN: nextQ, KeyD: otherQ, KeyS: secondRound }[e.code];
    if (L) { e.preventDefault(); L(); }
  }
  document.addEventListener('keydown', onKey);

  /* ── отрисовка ── */
  const btn = (label, fn, cls, extra) => h('button.vq__b' + (cls || ''), Object.assign({ type: 'button', onclick: (ev) => { fn(ev); try { ev.currentTarget.blur(); } catch (e) { /* */ } } }, extra || {}), label);

  function head() {
    const tm = TOPICS[topic] || {};
    const total = st.pool.length;
    const filt = btn(h('span.vq__sw', { 'aria-hidden': 'true' }), () => { st.proj = !st.proj; buildPool(st.Q && st.Q.qid); setQ(st.pool[st.idx] || null); }, '.vq__filt' + (st.proj ? '.is-on' : ''), { 'aria-pressed': String(st.proj), title: 'Вопрос ≤160 знаков, варианты ≤90' });
    filt.append('Читается с проектора');
    const full = o.page ? btn(wrap.classList.contains('vq--full') ? 'Свернуть' : 'На весь экран', () => toggleFull(), '.vq__x', { title: 'F' }) : null;
    return h('header.vq__head',
      h('div.vq__ctx', h('span.vq__t', 'Тема ' + topic + (tm.short ? ' · ' + tm.short : '')), h('span.vq__c', total ? 'вопрос ' + (st.idx + 1) + ' из ' + total : ''), st.round === 2 ? h('span.vq__r', 'Раунд 2 · после обсуждения') : h('span.vq__r.is-1', 'Раунд 1')),
      h('div.vq__hr', h('span.vq__n', 'Вопросов проведено: ', h('b', String(st.asked.size))), filt, full, o.onClose ? btn('Закрыть', () => o.onClose(), '.vq__x', { title: 'Закрыть (Esc)' }) : null));
  }

  function draw() {
    if (dead) return;
    wrap.replaceChildren();
    wrap.dataset.phase = st.phase;
    const Q = st.Q;
    if (!Q) {
      wrap.append(head(), h('div.vq__empty', h('p', st.proj ? 'В этой теме нет вопросов, которые читаются с проектора.' : 'В этой теме нет подходящих вопросов.'), st.proj ? btn('Показать все вопросы темы', () => { st.proj = false; buildPool(); setQ(st.pool[0] || null); }, '.vq__primary') : null));
      return;
    }
    wrap.append(head(), h('div.vq__body', question(Q), st.phase === 'vote' ? voteBody(Q) : resultBody(Q)), st.phase === 'vote' ? voteFoot() : resultFoot(Q), sessionLog());
  }

  const question = (Q) => h('h2.vq__q', nb(Q.q));

  function voteBody(Q) {
    return h('ol.vq__opts', ...Q.a.map((a, i) => h('li.vq__o', { class: st.counts[i] ? 'has-v' : null },
      h('span.vq__l', LET[i]),
      h('span.vq__ot', nb(a.t)),
      h('span.vq__ctl',
        btn('−', () => bump(i, -1), '.vq__pm.vq__pm--m', { 'aria-label': 'Минус один голос за ' + LET[i], 'data-minus': i, disabled: st.counts[i] <= 0 }),
        h('b.vq__cn', { 'aria-live': 'off' }, h('span', { 'data-n': i }, String(st.counts[i]))),
        btn('+', () => bump(i, 1), '.vq__pm.vq__pm--p', { 'aria-label': 'Плюс один голос за ' + LET[i] })),
      h('kbd.kbd.vq__k', String(i + 1)))));
  }
  function voteFoot() {
    return h('footer.vq__foot',
      h('div.vq__tot', 'Голосов: ', h('b', { 'data-total': '' }, String(sum(st.counts)))),
      h('p.vq__keys', h('kbd.kbd', '1…' + st.Q.a.length), ' +1 · ', h('kbd.kbd', '⇧'), '+', h('kbd.kbd', '1…' + st.Q.a.length), ' −1 · ', h('kbd.kbd', '⌫'), ' отменить'),
      h('div.vq__fa', btn('Отменить', undo, '', { 'data-undo': '', disabled: !st.undo.length }), btn(h('span', 'Закрыть голосование'), closeVoting, '.vq__primary', { title: 'Enter' }), h('kbd.kbd.vq__ek', 'Enter')));
  }

  function resultBody(Q) {
    const total = sum(st.counts), mx = Math.max(1, ...st.counts);
    return h('ol.vq__opts.vq__opts--res', ...Q.a.map((a, i) => {
      const p = pctOf(st.counts[i], total);
      const cls = st.revealed ? (a.ok ? '.is-ok' : '.is-no') : '';
      return h('li.vq__o' + cls,
        h('span.vq__l', LET[i]),
        h('span.vq__ot', nb(a.t), st.revealed && a.ok ? h('i.vq__tag', '✓ верно') : null),
        h('span.vq__bar', { style: { '--w': (st.counts[i] / mx * 100).toFixed(1) + '%' } }, h('i')),
        h('span.vq__pc', h('b', p + ' %'), h('small', st.counts[i] + NBSP + 'гол.')));
    }));
  }

  function resultFoot(Q) {
    const total = sum(st.counts);
    const share = pctOf(sum(st.counts.map((c, i) => (Q.a[i].ok ? c : 0))), total);
    const parts = [h('div.vq__tot', 'Голосов: ', h('b', String(total)))];
    if (!st.revealed) {
      parts.push(h('div.vq__fa', btn('Исправить голоса', backToVote, '', { title: 'Backspace' }), btn(h('span', 'Раскрыть верный ответ'), reveal, '.vq__primary', { title: 'R' }), h('kbd.kbd.vq__ek', 'R')));
      return h('footer.vq__foot.vq__foot--res', ...parts);
    }
    const hint = methodHint(share);
    const first = st.round === 2 && st.r1 ? pctOf(sum(st.r1.counts.map((c, i) => (Q.a[i].ok ? c : 0))), st.r1.total) : null;
    const dTxt = first == null ? null : (share > first ? 'стало лучше' : share < first ? 'стало хуже' : 'без изменений');
    const dbtn = btn('Таймер 2:00', (ev) => discussTimer(ev.currentTarget), '.vq__tm');
    return h('footer.vq__foot.vq__foot--res',
      h('div.vq__verdict',
        h('div.vq__share', h('b', share + ' %'), h('span', 'ответили верно')),
        first != null ? h('div.vq__delta.is-' + (share > first ? 'up' : share < first ? 'down' : 'eq'), 'Было ', h('b', first + ' %'), ' верных → стало ', h('b', share + ' %'), ' после обсуждения', h('small', ' · ' + dTxt)) : null,
        st.round === 1 || first == null ? h('div.vq__hint.is-' + hint.tone, { role: 'status' }, h('b', hint.title), h('span', hint.sub)) : h('div.vq__hint.is-' + hint.tone, { role: 'status' }, h('b', 'Теперь коротко объясните верный ответ'), h('span', 'Второй раунд проведён. Назовите правильный вариант и скажите, почему остальные не подходят.'))),
      h('div.vq__fa',
        st.round === 1 ? btn('Второй раунд', secondRound, '.vq__b2' + (hint.tone === 'mid' ? '.vq__primary' : ''), { title: 'S' }) : null,
        st.round === 1 && hint.tone === 'mid' ? dbtn : null,
        btn('Следующий', nextQ, hint.tone === 'high' || st.round === 2 ? '.vq__primary' : '', { title: 'N' }),
        btn('Другой вопрос', otherQ, '', { title: 'D' })),
      h('p.vq__keys', 'R — ответ · S — второй раунд · N — следующий · D — другой · ⌫ — исправить'));
  }

  function sessionLog() {
    if (!st.log.size) return h('span');
    const rows = [...st.log.values()].map((L) => h('tr', h('td.mono', L.Q.qid), h('td', nb(L.Q.q.length > 70 ? L.Q.q.slice(0, 68).trim() + '…' : L.Q.q)),
      h('td.num', L.shares[0] == null ? '—' : L.shares[0] + ' %'), h('td.num', L.shares[1] == null ? '—' : L.shares[1] + ' %')));
    return h('details.vq__log', h('summary', 'Проведено в этой сессии: ' + st.log.size), h('div.vq__lg', h('table.dt', h('thead', h('tr', h('th', 'Вопрос'), h('th', 'Текст'), h('th', '1-й раунд'), h('th', '2-й раунд'))), h('tbody', ...rows)), h('p.vq__note', 'Результаты сохраняются на этом устройстве (teach.votes) и войдут в сводку преподавателя.')));
  }

  /* ── запуск ── */
  bank().then((b) => {
    if (dead) return;
    st.b = b;
    if (!b.byTopic.has(topic)) { wrap.replaceChildren(h('p.vq__load', 'Нет такой темы: ' + topic)); return; }
    buildPool(o.qid);
    // вопрос из ссылки может не пройти фильтр проектора — тогда показываем его всё равно
    if (o.qid && st.pool[st.idx] && st.pool[st.idx].qid !== o.qid) { const Q = b.byQid.get(o.qid); if (Q && Q.topic === topic && votable(Q)) { st.pool.unshift(Q); st.idx = 0; } }
    setQ(st.pool[st.idx] || null);
    if (!o.page) setTimeout(() => wrap.focus({ preventScroll: true }), 0);
  });
  loadCSS(CSS);

  return {
    destroy() { dead = true; document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); document.documentElement.classList.remove('vq-full'); try { if (document.fullscreenElement === wrap) document.exitFullscreen(); } catch (e) { /* */ } clearInterval(st.tmr); wrap.remove(); },
    get state() { return st; },
  };
}
