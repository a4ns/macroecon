/* Студент: задание от преподавателя — #/a/:payload  (V3_PLAN §4.5, сценарий С3)
   Расшифровка, «Принять задание», прогресс пунктов из S, тест задания (детерминированный набор по seed), код сдачи.
   Экспорт для tassign.js и summary.js: describeItems, testQuestions, KIND, idRange, dueText. */
import { h, loadCSS, plural, toast } from '../core/dom.js';
import { decodeAssign, encodeSubmission, wrapText, CodecError } from '../core/codec.js';
import { ctx as planCtx, trail } from '../core/plan.js';
import { S, MODE, dayNum } from '../core/state.js';
import { store } from '../core/store.js';
import { record, session } from '../core/qa.js';
import { taskScore } from '../core/track.js';
import { labTaskFrac } from '../core/mastery.js';
import { seeded, shuffled, prepare } from '../core/qid.js';
import { mountQuestion } from '../ui/qrun.js';
import { copyText, LET } from '../ui/sheet.js';
import { TOPICS } from '../data/topics.js';

export const KIND = { lec: 'Лекции', lab: 'Модель', task: 'Задачи', test: 'Тест', sr: 'Повторение', sro: 'СРО' };
const NB = ' ';

/** «5.1, 5.2, 5.3» → «5.1–5.3» */
export function idRange(ids) {
  const p = ids.map((s) => String(s).split('.').map(Number));
  if (p.length > 2 && p.every((x, i) => x.length === 2 && x[0] === p[0][0] && (i === 0 || x[1] === p[i - 1][1] + 1))) return ids[0] + '–' + ids[ids.length - 1];
  return ids.join(', ');
}
export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function dueText(due) {
  if (!due) return '';
  const m = String(due).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return String(due).slice(0, 20);
  return +m[3] + NB + MONTHS[+m[2] - 1];
}
const daysLeft = (due) => { const m = String(due || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]), n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 864e5); };

/** набор вопросов теста задания: у всех студентов один и тот же (по seed и версии банка) */
export function testQuestions(bank, it) {
  const pool = bank.unique(it.topic);
  const n = Math.max(1, Math.min(+it.n || 10, pool.length));
  return shuffled(pool, seeded(String(it.seed || '') + ':' + it.topic)).slice(0, n);
}

/** описание пункта для людей: { title, sub } */
export function describeItem(it, ix) {
  const lec = (id) => (ix.byLec.get(id) || {}).short || '';
  switch (it.k) {
    case 'lec': return { title: (it.ids.length === 1 ? 'Лекция ' : 'Лекции ') + idRange(it.ids), sub: it.ids.map(lec).filter(Boolean).slice(0, 3).join(' · ') };
    case 'lab': { const l = ix.labs.get(it.id); return { title: 'Модель ' + it.id, sub: (l ? l.title : '') + (it.pr ? ' · с прогнозом' : '') }; }
    case 'task': return { title: (it.ids.length === 1 ? 'Задача ' : 'Задачи ') + idRange(it.ids), sub: 'Числовые поля с проверкой' };
    case 'test': return { title: `Тест темы ${it.topic}`, sub: `${it.n} ${plural(it.n, ['вопрос', 'вопроса', 'вопросов'])} · порог ${it.min}${NB}%` };
    case 'sr': return { title: 'Повторение ' + (it.topics.length === 1 ? 'темы ' : 'тем ') + it.topics.join(', '), sub: 'Карточки по теме' };
    case 'sro': return { title: 'СРО №' + NB + it.n, sub: 'Самостоятельная работа' };
    default: return { title: 'Пункт', sub: '' };
  }
}
export const describeItems = (meta, ix) => meta.items.map((it) => ({ k: it.k, ...describeItem(it, ix) }));

/* ── статусы пунктов из S ──────────────────────────────────── */
const rec = (id) => S.data.assign[id];
export function statusOf(it, i, a, c) {
  const s = S.data;
  switch (it.k) {
    case 'lec': { const x = it.ids.filter((id) => (s.lec[id] || {}).x).length, o = it.ids.some((id) => (s.lec[id] || {}).o); return { s: x === it.ids.length ? 2 : x || o ? 1 : 0, text: `${x} из ${it.ids.length}`, x }; }
    case 'lab': { const p = s.pr[it.id], got = !!(p && p.n), tf = labTaskFrac(it.id, c) > 0; const done = it.pr ? got : got || tf; return { s: done ? 2 : tf ? 1 : 0, text: got ? `прогноз ${p.ok} из ${p.tot}` : it.pr ? 'прогноз не сделан' : 'не открыта', pr: got ? [p.ok, p.tot] : 0 }; }
    case 'task': { const d = it.ids.filter((id) => (s.tk[id] || {}).dn).length, any = it.ids.some((id) => (s.tk[id] || {}).n || (s.tk[id] || {}).f); return { s: d === it.ids.length ? 2 : any ? 1 : 0, text: `решено ${d} из ${it.ids.length}`, sc: it.ids.map((id) => Math.round(taskScore(id) * 100)), d }; }
    case 'test': { const r = a && a.res && a.res[i]; if (!r) return { s: 0, text: 'не пройден' }; const f = r.total ? r.score / r.total : 0; return { s: f * 100 >= it.min ? 2 : 1, text: `${r.score} из ${r.total} · ${Math.round(f * 100)}${NB}%`, r }; }
    case 'sr': { const st = it.topics.map((n) => { try { const x = trail(n, c).steps.find((q) => q.k === 'review'); return x ? x.state : 'todo'; } catch (e) { return 'todo'; } }); const all = st.every((x) => x === 'done'), any = st.some((x) => x !== 'todo'); return { s: all ? 2 : any ? 1 : 0, text: all ? 'карточки повторены' : any ? 'есть карточки к повторению' : 'карточек ещё нет' }; }
    case 'sro': { const chk = store.get('more.sro', []) || []; const on = (Array.isArray(chk) ? chk.map(Number).includes(+it.n) : !!chk[it.n]); return { s: on ? 2 : 0, text: on ? 'отмечена выполненной' : 'не отмечена' }; }
    default: return { s: 0, text: '' };
  }
}
const GL = ['○', '◐', '✓'], WORD = ['не начато', 'в процессе', 'выполнено'];

function itemHref(it, i, meta, payload) {
  switch (it.k) {
    case 'lec': return it.ids.map((id) => ({ label: id, href: '#/read/' + id }));
    case 'lab': return [{ label: 'Открыть модель', href: '#/lab/' + it.id }];
    case 'task': return it.ids.map((id) => ({ label: id, href: '#/tasks/' + id.split('.')[0] + '?t=' + id }));
    case 'test': return [{ label: 'Пройти тест', href: '#/a/' + payload + '?run=' + i, primary: true }];
    case 'sr': return it.topics.map((n) => ({ label: 'Тема ' + n, href: '#/review?topic=' + n }));
    case 'sro': return [{ label: 'Открыть СРО', href: '#/more/sro' }];
    default: return [];
  }
}

/* ── код сдачи ─────────────────────────────────────────────── */
export function buildSubmission(meta, a, c, name, grp) {
  const i = meta.items.map((it, k) => {
    const st = statusOf(it, k, a, c), o = { k: it.k, s: st.s };
    if (it.k === 'lec') Object.assign(o, { ids: it.ids, x: st.x });
    else if (it.k === 'lab') Object.assign(o, { id: it.id, pr: st.pr || 0 });
    else if (it.k === 'task') Object.assign(o, { ids: it.ids, sc: st.sc });
    else if (it.k === 'test') { Object.assign(o, { topic: it.topic, n: it.n, min: it.min, seed: it.seed }); if (st.r) Object.assign(o, { score: st.r.score, total: st.r.total, time: st.r.time, w: st.r.w }); }
    else if (it.k === 'sr') Object.assign(o, { topics: it.topics });
    else if (it.k === 'sro') Object.assign(o, { n: it.n });
    return o;
  });
  return { id: meta.id, n: name, g: grp, at: Date.now(), bk: c.bank.bk, t: meta.t, by: meta.by, i };
}

/* ── загрузка ──────────────────────────────────────────────── */
export async function load(ctx) {
  const [c] = await Promise.all([planCtx(), loadCSS('app/css/v-teach.css'), loadCSS('app/css/v-qrun.css')]);
  let meta = null, err = null;
  try { meta = await decodeAssign(ctx.params.payload); } catch (e) { err = e instanceof CodecError ? e : new CodecError('Ссылка не читается.', 'format'); }
  return { c, meta, err };
}

export function mount(el, ctx, { c, meta, err }) {
  const root = h('div.as.wrap'); el.append(root);
  let cleanup = () => {}, ctxNow = ctx;
  const payload = ctx.params.payload;

  if (err) {
    root.append(h('header.as-head', h('p.eyebrow.eyebrow--dot', 'Задание'), h('h1.h1', 'Ссылка ', h('em', 'не открылась')), h('p.lede', err.message)),
      h('div.co.co--warn', h('strong.co__t', 'Что сделать'), h('ol.th-ul', h('li', 'Попросите преподавателя отправить ссылку ещё раз и откройте её целиком (в мессенджере она могла обрезаться — нажмите на ссылку, а не копируйте часть).'), h('li', 'Если ссылка длинная, преподаватель может убрать часть пунктов и создать новую.'))),
      h('p', h('a.btn', { href: '#/today' }, 'На «Сегодня»')));
    return { title: 'Задание', destroy() {} };
  }

  const acc = () => !!rec(meta.id);
  const save = () => { S.data.assign[meta.id] = S.data.assign[meta.id] || { meta, at: Date.now(), id: meta.id, res: {} }; S.save(true); };
  const refreshDone = () => { const a = rec(meta.id); if (!a) return; const all = meta.items.every((it, i) => statusOf(it, i, a, c).s === 2); if (!!a.done !== all) { a.done = all ? Date.now() : 0; S.save(); } };

  function overview() {
    cleanup();
    root.replaceChildren();
    const a = rec(meta.id), sts = meta.items.map((it, i) => statusOf(it, i, a, c)), nDone = sts.filter((x) => x.s === 2).length, N = meta.items.length;
    refreshDone();
    const dl = daysLeft(meta.due);
    const dueChip = meta.due ? h('span.as-due' + (dl != null && dl < 0 ? '.is-late' : dl != null && dl <= 2 ? '.is-soon' : ''), 'Срок: ' + dueText(meta.due), dl == null ? '' : dl < 0 ? ' · просрочено' : dl === 0 ? ' · сегодня' : dl === 1 ? ' · завтра' : ' · ещё ' + dl + NB + plural(dl, ['день', 'дня', 'дней'])) : null;
    const frac = N ? nDone / N : 0;
    root.append(h('header.as-head',
      h('div.as-head__t', h('p.eyebrow.eyebrow--dot', 'Задание от преподавателя'), h('h1.h1', meta.t || 'Задание'), h('p.lede', meta.by ? 'Преподаватель: ' + meta.by : ''), h('div.as-meta', dueChip)),
      h('div.as-ring', h('div.ring', { style: { '--p': frac, '--s': '84px' }, role: 'img', 'aria-label': `Выполнено ${nDone} из ${N}` }, h('b', `${nDone}/${N}`)), h('span', 'выполнено'))));
    if (meta.bk && meta.bk !== c.bank.bk) root.append(h('aside.co.co--warn', h('strong.co__t', 'Версия банка вопросов отличается от версии преподавателя'), h('p', 'Тест может содержать другие вопросы, чем у остальной группы. Попросите преподавателя сверить версию приложения.')));
    if (meta.goals) root.append(h('section.as-goals.card', h('small.th-sm', 'Цели от преподавателя'), h('p.as-goals__t', String(meta.goals))));
    if (!acc()) root.append(h('aside.co.co--accent.as-accept', h('strong.co__t', 'Задание ещё не сохранено у вас'), h('p', 'Нажмите «Принять» — оно появится на «Сегодня», и результаты теста будут записаны в задание.'), h('div.as-act', h('button.btn.btn--primary', { type: 'button', onclick: () => { save(); overview(); toast('Задание принято'); } }, 'Принять задание'))));
    root.append(h('ol.as-items', ...meta.items.map((it, i) => {
      const d = describeItem(it, c.ix), st = sts[i], links = itemHref(it, i, meta, payload);
      const lecDone = (id) => !!(S.data.lec[id] || {}).x, taskDone = (id) => !!(S.data.tk[id] || {}).dn;
      return h('li.as-item.card.as-s' + st.s, { 'data-k': it.k },
        h('span.as-st', { role: 'img', 'aria-label': WORD[st.s] }, GL[st.s]),
        h('div.as-body', h('small.th-sm', KIND[it.k] || 'Пункт'), h('h2.as-t', d.title), d.sub ? h('p.as-s', d.sub) : null, h('p.as-x.mono', WORD[st.s] + ' · ' + st.text),
          h('div.as-links', ...links.map((l) => h('a.btn.btn--sm' + (l.primary ? '.btn--primary' : ''), { href: l.href }, (it.k === 'lec' && lecDone(l.label) ? '✓ ' : it.k === 'task' && taskDone(l.label) ? '✓ ' : '') + (/^\d/.test(l.label) ? (it.k === 'task' ? 'Задача ' : 'Лекция ') : '') + l.label)))));
    })));
    root.append(h('section.as-send',
      h('div', h('h2.h3', 'Сдать преподавателю'), h('p.as-s', 'Получите код со своими результатами и отправьте его преподавателю в чат или на почту. Имя и группа будут внутри кода.'), h('p.th-hint', 'Код — самоотчёт студента: подделать его без сервера можно, поэтому он нужен для сводки, а не для оценки.')),
      h('div.as-act', h('button.btn.btn--primary', { type: 'button', onclick: () => submitDialog(), disabled: !acc() ? true : null, title: acc() ? null : 'Сначала примите задание' }, 'Сдать преподавателю'), acc() ? h('button.btn.btn--quiet.btn--sm', { type: 'button', onclick: () => { if (confirm('Убрать задание из списка? Результаты теста задания будут удалены с этого устройства.')) { delete S.data.assign[meta.id]; S.save(true); overview(); } } }, 'Убрать задание') : null)));
  }

  /* ── окно «Сдать преподавателю» ─────────────────────────── */
  function submitDialog() {
    const a = rec(meta.id);
    const name = h('input.tv-in#as-name', { type: 'text', value: S.data.prof.name || '', autocomplete: 'name', maxlength: 60, placeholder: 'Иванов Алексей' });
    const grp = h('input.tv-in#as-grp', { type: 'text', value: S.data.prof.grp || '', maxlength: 20, placeholder: 'ЭК-21' });
    const out = h('div.as-code', { hidden: true });
    const dlg = h('dialog.as-dlg', { 'aria-labelledby': 'as-dt' });
    const form = h('form', { method: 'dialog', onsubmit: async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { name.focus(); toast('Впишите имя'); return; }
      S.data.prof.name = name.value.trim(); S.data.prof.grp = grp.value.trim(); S.save();
      try {
        const code = await encodeSubmission(buildSubmission(meta, a, c, name.value.trim(), grp.value.trim()));
        const ta = h('textarea.as-ta', { readonly: true, rows: 6, 'aria-label': 'Код сдачи', onfocus: (ev) => ev.target.select() }); ta.value = code;
        const wrapped = h('pre.as-wrapped', { hidden: true }, wrapText(code, 40));
        const tgl = h('button.btn.btn--sm', { type: 'button', 'aria-expanded': 'false', onclick: () => { const on = wrapped.hidden; wrapped.hidden = !on; tgl.setAttribute('aria-expanded', String(on)); tgl.textContent = on ? 'Скрыть текст по 40 символов' : 'Показать как текст по 40 символов'; } }, 'Показать как текст по 40 символов');
        out.replaceChildren(h('label.tv-l', { for: 'as-ta' }, `Ваш код · ${code.length} знаков`), ta, h('div.as-act', h('button.btn.btn--primary.btn--sm', { type: 'button', onclick: async () => { const ok = await copyText(code); toast(ok ? 'Код скопирован' : 'Не удалось скопировать — выделите код вручную'); } }, 'Скопировать'), tgl), wrapped,
          h('p.th-hint', 'Код — самоотчёт студента, подделать его без сервера можно. Внутри: ваше имя и группа, статусы пунктов, результат теста и номера вопросов, в которых были ошибки. Больше ничего.'));
        ta.id = 'as-ta'; out.hidden = false; ta.focus(); ta.select();
      } catch (er) { toast(er.message || 'Не удалось собрать код'); }
    } },
    h('h2.h3#as-dt', 'Ваше имя и группа'), h('p.as-s', 'Они попадут внутрь кода, чтобы преподаватель знал, чей он.'),
    h('div.tv-f', h('label.tv-l', { for: 'as-name' }, 'Имя и фамилия'), name), h('div.tv-f', h('label.tv-l', { for: 'as-grp' }, 'Группа'), grp),
    h('div.as-act', h('button.btn.btn--primary', { type: 'submit' }, 'Получить код'), h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Закрыть')), out);
    dlg.append(form);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
    name.focus();
  }

  /* ── тест задания ───────────────────────────────────────── */
  function run(i) {
    cleanup();
    const it = meta.items[i];
    if (!it || it.k !== 'test') { go(); return; }
    if (!acc()) save();
    const Qs = testQuestions(c.bank, it).map((Q) => prepare(Q));
    const wrong = [], t0 = Date.now(); let idx = 0, ms = 0, ok = 0, cur = null;
    root.replaceChildren();
    const head = h('header.as-run__h', h('a.as-back', { href: '#/a/' + payload }, '← К заданию'), h('p.eyebrow', `Тест темы ${it.topic} · порог ${it.min}${NB}%`));
    const box = h('div.as-run__q'), nav = h('div.as-act');
    root.append(h('section.as-run', head, box, nav));
    cleanup = () => { cur && cur.destroy(); cur = null; };
    function show() {
      cur && cur.destroy();
      box.replaceChildren(); nav.replaceChildren();
      const P = Qs[idx];
      cur = mountQuestion(box, { Q: P, mode: MODE.test, conf: !!S.data.set.conf, reveal: 'now', index: idx + 1, total: Qs.length, keys: true, onAnswer: ({ ok: good, sel, conf, ms: t }) => {
        ms += t; if (good) ok++; else wrong.push(P.qid + ':' + sel.reduce((m, k) => m | (1 << P.a[k].i), 0));
        record({ Q: P, ok: good, mode: MODE.test, conf, ms: t, sel });
        const last = idx === Qs.length - 1;
        nav.replaceChildren(h('button.btn.btn--primary', { type: 'button', onclick: () => { if (last) finish(); else { idx++; show(); } } }, last ? 'Показать результат' : 'Дальше'));
        nav.firstChild.focus({ preventScroll: true });
      } });
    }
    function finish() {
      const a = rec(meta.id), total = Qs.length, time = Math.round(Math.max(ms, 0) / 1000) || Math.round((Date.now() - t0) / 1000);
      session({ topic: it.topic, ok, n: total, mode: MODE.test });
      a.res = a.res || {}; const old = a.res[i];
      const better = !old || ok / total >= old.score / old.total;
      if (better) a.res[i] = { score: ok, total, time, seed: it.seed, w: wrong.slice(), at: Date.now(), att: (old ? old.att : 0) + 1 };
      else old.att++;
      S.save(true); refreshDone();
      cleanup(); root.replaceChildren();
      const f = ok / total, pass = f * 100 >= it.min;
      root.append(h('section.as-run', h('a.as-back', { href: '#/a/' + payload }, '← К заданию'),
        h('div.as-res.card', h('p.eyebrow', 'Результат теста'), h('div.as-res__n', h('b.display', `${ok}`), h('span', `из ${total}`)), h('p.as-s', `${Math.round(f * 100)}${NB}% · порог ${it.min}${NB}% — ${pass ? 'порог пройден' : 'порог не пройден'}. Время: ${Math.floor(time / 60)}${NB}мин ${time % 60}${NB}с.${better ? '' : ' В задании сохранён более высокий результат.'}`),
          wrong.length ? h('div', h('h3.h3', 'Разберите ошибки'), h('ul.as-wrong', ...wrong.map((w) => { const Q = c.bank.byQid.get(w.split(':')[0]); return Q ? h('li', h('p.as-wq', Q.q), h('p.as-wa', 'Верно: ', ...Q.a.filter((o) => o.ok).map((o, k) => h('b', (k ? '; ' : '') + o.t.replace(/^ложь$/i, 'Неверно'))))) : null; }))) : h('p.as-s', 'Ошибок нет.'),
          h('div.as-act', h('a.btn.btn--primary', { href: '#/a/' + payload }, 'К заданию'), h('a.btn', { href: '#/a/' + payload + '?run=' + i }, 'Пройти ещё раз')))));
    }
    show();
  }
  const go = () => { if (ctxNow.query && ctxNow.query.run != null && ctxNow.query.run !== '') run(+ctxNow.query.run); else overview(); };
  go();
  return {
    title: meta.t || 'Задание',
    update(ctx2) { ctxNow = ctx2; go(); },
    destroy() { cleanup(); document.querySelectorAll('dialog.as-dlg').forEach((d) => d.remove()); },
  };
}
