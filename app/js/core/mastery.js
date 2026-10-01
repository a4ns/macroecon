/* Формулы освоения (V3_PLAN §5.5). Чистые функции от (данные, состояние). */
import { S, SR } from './state.js';
import { store } from './store.js';
import { lastAnswers } from './qa.js';
import { retention, isTerm } from './sr.js';
import { taskScore } from './track.js';

export const W = { R: .20, M: .15, P: .25, Q: .40 };
export const PREDICT_NA = new Set(['ex2-1', 'ex2-2']);       // модели, где прогноз «шок → реакция» не применим
export const THRESH = { P: .7, test: .7, ret: .7 };
export const LEVELS = [[80, 'Почти освоено'], [50, 'Уверенно'], [20, 'В процессе'], [0, 'Знакомство']];

export function labTaskFrac(id, c) {
  const lab = c.ix.labs.get(id), tasks = ((lab && lab.task) || []).filter((t) => !/^\s*Задание:?\s*$/i.test(t));
  if (!tasks.length) return 1;
  const d = store.get('lab.' + id.replace('-', '_') + '.done', []);
  return Math.min(1, (Array.isArray(d) ? d.length : 0) / tasks.length);
}
/** контекст: { ix, bank, tasks } — tasks: массив задач с полем answers (после патча) */
export function topicStat(n, c, now = Date.now()) {
  const s = S.data, tp = c.ix.byTopic.get(n);
  const N = tp.lectures.length;
  const studied = tp.lectures.filter((l) => (s.lec[l.id] || {}).x).length;
  const opened = tp.lectures.filter((l) => (s.lec[l.id] || {}).o).length;
  const R = N ? studied / N : null;
  const labs = (tp.lab || []);
  let M = null;
  if (labs.length) {
    const parts = labs.map((id) => { const done = labTaskFrac(id, c); const pr = s.pr[id]; return PREDICT_NA.has(id) ? done : Math.min(1, .5 * (pr && pr.n ? 1 : 0) + .5 * done); });
    M = parts.reduce((a, b) => a + b, 0) / parts.length;
  }
  const tl = (c.tasks || []).filter((t) => t.topic === n);
  const P = tl.length ? tl.reduce((a, t) => a + taskScore(t.id), 0) / tl.length : null;
  const U = c.bank.unique(n), E = c.bank.E(n);
  const last = c.last || lastAnswers([0, 2, 3]);
  let seen = 0, okN = 0, g = 0;
  U.forEach((Q) => { const a = last.get(Q.ukey); if (a) { seen++; okN += a.ok; g += Q.guess; } });
  const cov = E ? Math.min(1, seen / E) : 0;
  const p = seen ? okN / seen : 0, gm = seen ? g / seen : 0;
  const adj = seen ? Math.max(0, (p - gm) / (1 - gm)) : 0;
  const Q = cov * adj;
  const comp = { R, M, P, Q }, w = { ...W }; let sw = 0, sum = 0;
  for (const k of Object.keys(comp)) { if (comp[k] == null) continue; sw += w[k]; sum += w[k] * comp[k]; }
  const mastery = sw ? Math.round(100 * sum / sw) : 0;
  const level = LEVELS.find(([t]) => mastery >= t)[1];
  // сохранность по карточкам темы
  const keys = new Set(U.map((x) => x.ukey)); const cs = Object.entries(SR.data.c).filter(([k, v]) => keys.has(k) && v[0] >= 1);
  const ret = cs.length >= 5 ? cs.reduce((a, [, v]) => a + retention(v, now), 0) / cs.length : null;
  const errs = Object.keys(require_err()).filter((q) => q.split('.')[0] == n && !require_err()[q].fixed).length;
  const V = .5 * (1 - mastery / 100) + .3 * (1 - (ret == null ? 0 : ret)) + .2 * Math.min(1, errs / 5);
  const contrib = [['Q', .5 * W.Q * (1 - Q)], ['P', .5 * W.P * (1 - (P == null ? 1 : P))], ['R', .5 * W.R * (1 - (R == null ? 1 : R))], ['ret', .3 * (1 - (ret == null ? 1 : ret))], ['err', .2 * Math.min(1, errs / 5)]].sort((a, b) => b[1] - a[1]);
  const REASON = { Q: 'мало решено вопросов', P: 'не пройдены задачи', R: 'не изучены лекции', ret: 'знания остывают', err: 'не разобраны ошибки' };
  // критерий «Освоена»
  const sess = s.ses.filter((x) => x.topic === n && [0, 2, 3].includes(x.mode) && x.n >= 5 && x.ok / x.n >= THRESH.test);
  const days = new Set(sess.map((x) => x.day));
  const lastSes = s.ses.filter((x) => x.topic === n && x.mode === 0).slice(-1)[0];
  const crit = {
    lectures: studied === N,
    models: M == null || labs.every((id) => PREDICT_NA.has(id) ? true : !!(s.pr[id] && s.pr[id].n)),
    tasks: P == null || P >= THRESH.P,
    cover: seen >= E,
    sessions: days.size >= 2,
    keep: ret == null || ret >= THRESH.ret,
  };
  const passed = crit.lectures && (crit.models) && crit.tasks && !!lastSes && lastSes.ok / lastSes.n >= THRESH.test;
  const mastered = Object.values(crit).every(Boolean) || !!s.mast[n];
  return { n, N, studied, opened, R, M, P, Q, cov, seen, E, p, adj, mastery, level, ret, errs, V, reason: REASON[contrib[0][0]], reasonKey: contrib[0][0], crit, passed, mastered, status: mastered ? 'Освоена' : passed ? 'Пройдена' : 'Изучается', lastTest: lastSes ? lastSes.ok / lastSes.n : null, nTests: s.ses.filter((x) => x.topic === n && x.mode === 0).length };
}
import { ERR } from './state.js';
function require_err() { return ERR.data; }

export function readiness(topics, c) {
  const arr = topics.map((n) => { const st = topicStat(n, c); return .5 * st.mastery / 100 + .5 * (st.ret == null ? 0 : st.ret); });
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}
/** профиль по типам заданий: знание / применение / прогнозирование (0…1, null если данных нет) */
export function profile(c) {
  const st = c.ix.topics.map((t) => topicStat(t.n, c));
  const know = st.filter((x) => x.seen).map((x) => x.adj), app = st.filter((x) => x.P != null).map((x) => x.P);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const pr = Object.values(S.data.pr); const tot = pr.reduce((a, x) => a + x.tot, 0);
  return { know: avg(know), apply: avg(app), predict: tot ? pr.reduce((a, x) => a + x.ok, 0) / tot : null };
}
/** калибровка: доля верных среди ответов с «Уверен» (≥20, иначе null) */
export function calibration(log) { const a = log.filter((r) => r[5] === 2 && [0, 1, 2, 3].includes(r[4])); return a.length >= 20 ? a.filter((r) => r[2]).length / a.length : null; }
/** выставляем «Освоена» один раз и навсегда; возвращает номера впервые освоенных тем */
export function awardMastery(c) { const out = []; c.ix.topics.forEach((t) => { if (!S.data.mast[t.n] && topicStat(t.n, c).crit && Object.values(topicStat(t.n, c).crit).every(Boolean)) { S.data.mast[t.n] = Date.now(); out.push(t.n); } }); if (out.length) S.save(); return out; }
