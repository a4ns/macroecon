/* Журнал ответов и ошибок. Один вход для всех режимов: record(). */
import { QA, ERR, S, MODE, dayNum } from './state.js';
import { seed } from './sr.js';

const LIMIT = 2000;
/** @param {{Q:object, ok:boolean, mode:number, conf?:0|1|2, ms?:number, sel?:number[]}} r  conf: 0 «Угадываю», 1 «Скорее да», 2 «Уверен» */
export function record({ Q, ok, mode, conf = -1, ms = 0, sel = [] }) {
  const log = QA.data; log.push([Date.now(), Q.ukey, ok ? 1 : 0, Math.min(999999, Math.round(ms)), mode, conf]);
  if (log.length > LIMIT) log.splice(0, log.length - LIMIT);
  (Q.group || [Q]).forEach((g) => {
    if (!ok) {
      const e = ERR.data[g.qid] || (ERR.data[g.qid] = { n: 0, last: 0, sel: [], conf: -1, why: '', ok2: 0 });
      e.n++; e.last = Date.now(); e.sel = sel; e.conf = conf; e.ok2 = 0; e.day = dayNum();
    } else if (ERR.data[g.qid]) {
      const e = ERR.data[g.qid]; if (e.day !== dayNum() && !e.fixed) { e.ok2 = (e.ok2 || 0) + 1; if (e.ok2 >= 2) e.fixed = Date.now(); } 
    }
  });
  if (mode !== MODE.review && mode !== MODE.predict) seed(Q.ukey, ok, Q.type);
  QA.save(); ERR.save();
}
/** сессия вопросов (тест/экзамен/повторение) — для критерия «две сессии в разные дни» */
export function session({ topic, ok, n, mode }) { const s = S.data; s.ses.push({ t: Date.now(), topic, ok, n, mode, day: dayNum() }); if (s.ses.length > 400) s.ses.splice(0, s.ses.length - 400); S.save(); }
export const openErrors = (bank) => Object.keys(ERR.data).filter((q) => !ERR.data[q].fixed && bank.byQid.has(q));
export function fixError(qid) { const e = ERR.data[qid]; if (e) { e.fixed = Date.now(); ERR.save(); } }
export function setWhy(qid, why) { const e = ERR.data[qid]; if (e) { e.why = why; ERR.save(); } }
/** последний ответ на каждый различный вопрос: Map<ukey, {ok,t,mode,conf}> */
export function lastAnswers(modes = [0, 2, 3]) { const m = new Map(); QA.data.forEach(([t, key, ok, , mode, conf]) => { if (modes.includes(mode)) m.set(key, { ok, t, mode, conf }); }); return m; }
