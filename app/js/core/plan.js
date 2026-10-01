/* Траектория темы, «Сегодня», контекст данных. Всё считается из существующих данных и учёта (mastery/track/sr). */
import { index, tasks as loadTasks } from './data.js';
import { bank as loadBank } from './qid.js';
import { S, SR, ERR, dayNum, bus } from './state.js';
import { store } from './store.js';
import { topicStat, labTaskFrac, PREDICT_NA, awardMastery, THRESH } from './mastery.js';
import { countDue, isTerm } from './sr.js';
import { lastAnswers, openErrors } from './qa.js';
import { taskScore } from './track.js';

export const REC_MODEL = { 9: ['ex8-1', 'ex10-3'], 14: ['ex12-1'] };   // у тем без собственной модели — модель-сосед (только ссылка)
let C = null;
/** контекст данных: { ix, bank, tasks } — загрузить один раз и передавать в функции ниже */
export async function ctx() {
  if (C) return C;
  const [ix, bank, tasks] = await Promise.all([index(), loadBank(), loadTasks()]);
  return (C = { ix, bank, tasks });
}
export function refreshMastery() { if (!C) return; const m = awardMastery(C); if (m.length) bus.emit('mastered', m); }

const mins = { model: 10, test: 6, review: 5 };
const taskMin = (t) => Math.min(20, 6 + .5 * Math.max(4, Object.keys(t.answers || {}).length));

/** Шаги траектории темы n. state: 'todo' | 'part' | 'done' | 'na' */
export function trail(n, c = C, now = Date.now()) {
  const st = topicStat(n, c, now), tp = c.ix.byTopic.get(n), s = S.data;
  const steps = [];
  const lecMin = tp.lectures.reduce((a, l) => a + (l.min || 0), 0);
  steps.push({ k: 'lec', label: 'Лекции', sub: `Лекции ${tp.lectures[0].id}–${tp.lectures[tp.lectures.length - 1].id} · ${lecMin} мин`, state: st.studied === st.N ? 'done' : st.opened || st.studied ? 'part' : 'todo', frac: st.N ? st.studied / st.N : 0, count: `${st.studied} из ${st.N}`, href: '#/read/' + (tp.lectures.find((l) => !(s.lec[l.id] || {}).x) || tp.lectures[0]).id, min: lecMin });
  const labs = tp.lab || [];
  if (labs.length) {
    const ok = labs.map((id) => (PREDICT_NA.has(id) ? 0 : (s.pr[id] && s.pr[id].n ? .5 : 0)) + (PREDICT_NA.has(id) ? 1 : .5) * Math.min(1, labTaskFrac(id, c) / .5));
    const frac = ok.reduce((a, b) => a + b, 0) / labs.length;
    const next = labs.find((id, i) => ok[i] < 1) || labs[0];
    steps.push({ k: 'lab', label: 'Модель', sub: `Модель ${labs.join(', ')} · прогноз + задание`, state: frac >= 1 ? 'done' : frac > 0 ? 'part' : 'todo', frac, count: `${ok.filter((x) => x >= 1).length} из ${labs.length}`, href: '#/lab/' + next, min: mins.model * labs.length, labs });
  } else steps.push({ k: 'lab', label: 'Модель', sub: REC_MODEL[n] ? `У темы своей модели нет. Похожий механизм: ${REC_MODEL[n].join(', ')}` : 'В этой теме модели нет', state: 'na', frac: 0, href: REC_MODEL[n] ? '#/lab/' + REC_MODEL[n][0] : null, min: 0, rec: REC_MODEL[n] || [] });
  const tl = c.tasks.filter((t) => t.topic === n);
  if (tl.length) steps.push({ k: 'task', label: 'Задачи', sub: `Задачи ${tl.map((t) => t.id).join(', ')} · ${tl.length} шт.`, state: st.P >= THRESH.P ? 'done' : (st.P > 0 || tl.some((t) => (s.tk[t.id] || {}).n)) ? 'part' : 'todo', frac: Math.min(1, (st.P || 0) / THRESH.P), count: `балл ${Math.round((st.P || 0) * 100)}% из 70%`, href: '#/tasks/' + n + ((tl.find((t) => taskScore(t.id) < 1) || tl[0]) ? '?t=' + (tl.find((t) => taskScore(t.id) < .7) || tl[0]).id : ''), min: tl.reduce((a, t) => a + taskMin(t), 0) });
  else steps.push({ k: 'task', label: 'Задачи', sub: 'Задач в теме нет', state: 'na', frac: 0, href: null, min: 0 });
  const lastTest = st.lastTest;
  steps.push({ k: 'test', label: 'Тест', sub: `Тест темы · 10 из ${c.bank.byTopic.get(n).length} вопросов`, state: lastTest != null && lastTest >= THRESH.test ? 'done' : st.nTests ? 'part' : 'todo', frac: lastTest == null ? 0 : Math.min(1, lastTest / THRESH.test), count: lastTest == null ? 'не пройден' : `последний ${Math.round(lastTest * 100)}%`, href: '#/tests/' + n, min: mins.test });
  const ukeys = new Set(c.bank.unique(n).map((q) => q.ukey));
  const cards = Object.entries(SR.data.c).filter(([k]) => ukeys.has(k));
  const learned = cards.filter(([, v]) => v[0] >= 2).length, dueN = cards.filter(([, v]) => v[1] <= dayNum()).length;
  steps.push({ k: 'review', label: 'Повторение', sub: cards.length ? `Карточки темы: ${learned} выучено, ${dueN} к повторению` : 'Карточки появятся после первых ответов', state: !cards.length ? 'todo' : dueN ? 'part' : 'done', frac: cards.length ? learned / cards.length : 0, count: dueN ? `к повторению: ${dueN}` : '', href: '#/review?topic=' + n, min: mins.review, optional: true });
  const sro = (tp.sro || []);
  if (sro.length) { const chk = store.get('more.sro', {}); const nDone = sro.filter((x) => chk && (Array.isArray(chk) ? chk.includes(x) : chk[x])).length; steps.push({ k: 'sro', label: 'СРО', sub: `СРО ${sro.join(', ')} · по заданию преподавателя`, state: nDone === sro.length ? 'done' : nDone ? 'part' : 'todo', frac: nDone / sro.length, count: `${nDone} из ${sro.length}`, href: '#/more/sro', min: 0, optional: true }); }
  const next = steps.find((x) => !x.optional && x.state !== 'done' && x.state !== 'na') || steps.find((x) => x.k === 'review' && x.state === 'part') || null;
  if (next) next.next = true;
  const missing = [];
  const k = st.crit;
  if (!k.lectures) missing.push(`Лекции: изучено ${st.studied} из ${st.N}`);
  if (!k.models) missing.push('Модель: сделайте хотя бы один прогноз');
  if (!k.tasks) missing.push(`Задачи: ${Math.round((st.P || 0) * 100)}% из 70%`);
  if (!k.cover) missing.push(`Вопросы: просмотрено ${st.seen} из ${st.E} различных`);
  if (!k.sessions) missing.push('Нужны две тестовые сессии с результатом ≥70% в разные дни');
  if (!k.keep) missing.push('Знания остывают: пройдите повторение');
  let acc = 0; const sessions = []; let cur = [];
  steps.filter((x) => !x.optional && x.state !== 'na' && x.state !== 'done').forEach((x) => { if (acc + x.min > 30 && cur.length) { sessions.push(cur); cur = []; acc = 0; } cur.push(x.k); acc += x.min; }); if (cur.length) sessions.push(cur);
  return { topic: n, stat: st, steps, next, missing, status: st.status, minLeft: steps.filter((x) => !x.optional && x.state !== 'done' && x.state !== 'na').reduce((a, x) => a + Math.round(x.min * (1 - (x.frac || 0))), 0), sessions: sessions.length };
}

/** текущая тема: первая в порядке курса, не «Пройдена»/«Освоена» (или тема недели по календарю) */
export function currentTopic(c = C) {
  const set = S.data.set;
  if (set.start) { const w = Math.floor((Date.now() - set.start) / (7 * 864e5)); if (w >= 0 && w < 14) return w + 1; }
  const t = c.ix.topics.find((x) => { const st = topicStat(x.n, c); return st.status === 'Изучается'; });
  return t ? t.n : c.ix.topics[c.ix.topics.length - 1].n;
}

/** «Сегодня»: до трёх карточек действий (V3_PLAN §3.1). Каждая: {kind, title, sub, min, href, tone} */
export function today(c = C) {
  const set = S.data.set, now = Date.now(), out = [];
  const due = countDue(c.bank), n = currentTopic(c), tr = trail(n, c);
  const errs = openErrors(c.bank).length;
  const first = !Object.keys(S.data.lec).length && !S.data.ses.length && !Object.keys(SR.data.c).length;
  const lastAct = Math.max(0, ...Object.values(S.data.lec).map((l) => l.o || 0), ...S.data.ses.map((x) => x.t));
  const idle = lastAct ? Math.floor((now - lastAct) / 864e5) : 0;
  const assign = Object.values(S.data.assign).filter((a) => a.meta && a.meta.due && new Date(a.meta.due) - now < 3 * 864e5 && !a.done)[0];
  if (assign) out.push({ kind: 'assign', title: 'Задание преподавателя', sub: `${assign.meta.t} · срок ${assign.meta.due}`, min: 0, href: '#/a/' + assign.id, tone: 'urgent' });
  if (due >= 15 && out.length < 3) out.push({ kind: 'review', title: `Повторить ${Math.min(due, set.revPerDay)} карточек`, sub: `Накопилось ${due} — вернуть знания, пока не забылись`, min: Math.ceil(Math.min(due, set.revPerDay) * .3), href: '#/review', tone: 'urgent' });
  if (first) { out.push({ kind: 'start', title: 'Начните с лекции 1.1', sub: 'Две минуты чтения — и вы в курсе', min: 2, href: '#/read/1.1', tone: 'main' }); out.push({ kind: 'diag', title: 'Входная диагностика', sub: '28 вопросов · карта знаний без оценки', min: 12, href: '#/diag', tone: 'side' }); return { cards: out.slice(0, 3), topic: n, trail: tr, idle, first }; }
  if (tr.next) out.push({ kind: 'step', title: stepTitle(tr.next), sub: `Тема ${n} · ${tr.next.sub}`, min: Math.max(1, Math.round(tr.next.min * (1 - tr.next.frac))), href: tr.next.href, tone: 'main', step: tr.next.k });
  if (due && out.length < 3 && !out.some((x) => x.kind === 'review')) out.push({ kind: 'review', title: `Повторить ${Math.min(due, set.revPerDay)} ${due === 1 ? 'карточку' : 'карточек'}`, sub: 'Закрепление: возвращаем материал до того, как он забудется', min: Math.max(1, Math.ceil(Math.min(due, set.revPerDay) * .3)), href: '#/review', tone: 'side' });
  else if (errs && out.length < 3) out.push({ kind: 'errors', title: `Разобрать ошибки (${Math.min(errs, 5)})`, sub: `В журнале ${errs} неразобранных`, min: 5, href: '#/me/errors', tone: 'side' });
  if (out.length < 3) { const nx = c.ix.byTopic.get(n + 1); if (nx) out.push({ kind: 'next', title: `Заглянуть в тему ${n + 1}`, sub: nx.title, min: nx.lectures[0].min || 3, href: '#/read/' + nx.lectures[0].id, tone: 'extra' }); }
  return { cards: out.slice(0, 3), topic: n, trail: tr, idle, first, due, errs };
}
function stepTitle(s) { return ({ lec: 'Читать лекцию', lab: 'Открыть модель', task: 'Решить задачу', test: 'Пройти тест темы', review: 'Повторить', sro: 'Сделать СРО' })[s.k]; }
