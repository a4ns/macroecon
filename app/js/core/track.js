/* Хуки учёта для экранов: лекции, задачи, модели. Всё хранится в S (mx:v3). */
import { S, dayNum } from './state.js';
import { refreshMastery } from './plan.js';

const lec = (id) => S.data.lec[id] || (S.data.lec[id] = { o: 0, d: 0, s: 0, x: 0 });
export function lecOpen(id) { const l = lec(id); if (!l.o) l.o = Date.now(); S.save(); }
/** depth 0…1 — насколько прокручено; secs — видимые секунды за этот интервал; min — оценка чтения (мин) */
export function lecProgress(id, depth, secs, min) { const l = lec(id); l.d = Math.max(l.d || 0, Math.min(1, depth)); l.s = Math.min((l.s || 0) + secs, 1.5 * min * 60); if (!l.x && l.d >= .9 && l.s >= .35 * min * 60) l.x = Date.now(), refreshMastery(); S.save(); }
export function lecStudied(id, on = true) { const l = lec(id); l.x = on ? Date.now() : 0; S.save(); refreshMastery(); }

const tk = (id) => S.data.tk[id] || (S.data.tk[id] = { f: 0, n: 0, hs: 0, ss: 0, dn: 0 });
export function taskHint(id) { const t = tk(id); if (!t.hs) t.hs = Date.now(); S.save(); }
export function taskSolution(id) { const t = tk(id); if (!t.ss) t.ss = Date.now(); S.save(); }
/** correct из total полей верны; solved — все верны */
export function taskCheck(id, correct, total) { const t = tk(id); t.n++; t.tot = total; t.f = Math.max(t.f || 0, correct); if (correct === total && !t.dn) { t.dn = Date.now(); t.help = !!(t.hs || t.ss); } delete t.weak; S.save(); refreshMastery(); }
export const taskScore = (id) => { const t = S.data.tk[id]; if (!t) return 0; if (t.weak) return .8; if (t.dn) return t.help ? .6 : 1; return t.tot ? .5 * (t.f / t.tot) : 0; };

/** прогноз на модели: ok верных из total строк */
export function predict(labId, ok, total) { const p = S.data.pr[labId] || (S.data.pr[labId] = { n: 0, ok: 0, tot: 0, at: 0 }); p.n++; p.ok += ok; p.tot += total; p.at = Date.now(); S.save(); refreshMastery(); }
export const labSeen = (id) => !!S.data.pr[id];
