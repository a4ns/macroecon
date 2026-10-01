/* Интервальное повторение: Лейтнер на 6 ящиков с поправками. Карточка: [b, d, r, l, t] —
   ящик 0…5, учебный день следующего показа, верных подряд, провалов, время последнего показа. Ключи: ukey вопроса или g### термина. */
import { SR, S, dayNum } from './state.js';
import { seeded, shuffled } from './qid.js';

export const INTERVALS = [0, 1, 3, 7, 14, 30];
export const CAP = { mc: 5, ms: 5, term: 5, tf: 3 };
export const cards = () => SR.data.c;
export const isTerm = (k) => /^g\d+$/.test(k);

export function jitter(key, r, interval) { if (interval < 14) return 1; return 0.9 + 0.2 * seeded(key + ':' + r)(); }
export function intervalDays(b) { return INTERVALS[Math.max(0, Math.min(5, b))]; }
export function schedule(card, key) { const [b, , r] = card; const iv = intervalDays(b); card[1] = dayNum() + Math.max(b === 0 ? 0 : 1, Math.round(iv * jitter(key, r, iv))); return card; }

/** результат: 'ok' | 'bad' | 'hard' | 'easy'; type — тип вопроса ('mc','ms','tf','term'); guess — ответ с уверенностью «Угадываю» */
export function grade(key, result, { type = 'mc', guess = false } = {}) {
  const c = SR.data.c[key] || (SR.data.c[key] = [0, dayNum(), 0, 0, 0]);
  const cap = type === 'tf' && c[2] < 2 ? CAP.tf : CAP[type] || 5;
  if (result === 'bad') { c[0] = 1; c[3]++; c[2] = 0; }
  else if (result === 'hard') { c[2]++; if (c[0] === 0) c[0] = 1; }
  else if (result === 'easy') { c[0] = Math.min(cap, c[0] + 2); c[2]++; }
  else { c[2]++; if (!guess) c[0] = Math.min(cap, c[0] + 1); else c[0] = Math.max(1, c[0]); }
  c[4] = Date.now();
  schedule(c, key);
  if (result === 'hard') c[1] = dayNum() + Math.max(1, Math.round(intervalDays(c[0]) / 2));
  if (result === 'bad' || guess) c[1] = dayNum() + 1;
  SR.save();
  return c;
}
/** ошибка в тесте/экзамене/задаче сразу кладёт вопрос в колоду на завтра */
export function seed(key, ok, type) { if (!ok) grade(key, 'bad', { type }); else if (!SR.data.c[key]) { /* верный ответ новую карточку не создаёт */ } }

/** сохранность карточки: 0,9^(дней с последнего показа / интервал ящика) */
export function retention(card, now = Date.now()) { if (!card || !card[4]) return 0; const days = (now - card[4]) / 864e5; return Math.pow(0.9, days / Math.max(1, intervalDays(card[0]))); }

/** Очередь на сегодня.
 * @param {{bank:object, glossary:object[], topics?:number[], unlocked?:(topic:number|null)=>boolean, limits?:{rev:number,nw:number}, mix?:'q'|'t'|'all'}} o
 * @returns {{due:string[], fresh:string[], overdue:number, catchup:boolean, shifted:number}} */
export function buildQueue(o) {
  const set = S.data.set, lim = o.limits || { rev: set.revPerDay, nw: set.newPerDay };
  const today = dayNum(), c = SR.data.c;
  const topicOf = new Map(); o.bank.all.forEach((Q) => { if (!topicOf.has(Q.ukey)) topicOf.set(Q.ukey, Q.topic); });
  const okTopic = (k) => { if (isTerm(k)) return o.mix !== 'q'; const t = topicOf.get(k); if (t == null) return false; if (o.mix === 't') return false; return !o.topics || o.topics.includes(t); };
  let due = Object.keys(c).filter((k) => c[k][1] <= today && okTopic(k) && c[k][4] !== -1)
    .sort((a, b) => ((today - c[b][1]) / Math.max(1, intervalDays(c[b][0]))) - ((today - c[a][1]) / Math.max(1, intervalDays(c[a][0]))));
  const overdue = due.length; let shifted = 0, catchup = false;
  if (overdue > 2 * lim.rev) {
    catchup = true; const rest = due.slice(lim.rev);
    rest.forEach((k) => { c[k][1] = today + 1 + Math.floor(seeded(k + today)() * 3); shifted++; });
    due = due.slice(0, lim.rev); SR.save();
  } else due = due.slice(0, lim.rev);
  const unlocked = o.unlocked || (() => true);
  const pool = [];
  o.bank.all.forEach((Q) => { if (!c[Q.ukey] && !pool.some((p) => p.k === Q.ukey) && unlocked(Q.topic) && (!o.topics || o.topics.includes(Q.topic)) && o.mix !== 't') pool.push({ k: Q.ukey, t: Q.topic, tf: Q.type === 'tf' }); });
  const terms = (o.mix === 'q' ? [] : (o.glossary || []).filter((g) => !c[g.id] && unlocked(null)).map((g) => ({ k: g.id, t: 0 })));
  const rand = seeded('new:' + today);
  const q = shuffled(pool, rand), t = shuffled(terms, rand), fresh = [];
  while (fresh.length < lim.nw && (q.length || t.length)) { for (let i = 0; i < 2 && q.length && fresh.length < lim.nw; i++) fresh.push(q.shift().k); if (t.length && fresh.length < lim.nw) fresh.push(t.shift().k); }
  return { due: spread(due, topicOf), fresh, overdue, catchup, shifted };
}
/* не более двух подряд карточек одной темы, где возможно */
function spread(keys, topicOf) {
  const out = [], rest = keys.slice(); let guard = 0;
  while (rest.length && guard++ < 5000) {
    const t = (k) => (isTerm(k) ? 0 : topicOf.get(k));
    let i = rest.findIndex((k) => !(out.length >= 2 && t(out[out.length - 1]) === t(k) && t(out[out.length - 2]) === t(k)));
    if (i < 0) i = 0; out.push(rest.splice(i, 1)[0]);
  }
  return out;
}
export const countDue = (bank) => { const today = dayNum(); const c = SR.data.c; const known = new Set(bank.all.map((Q) => Q.ukey)); return Object.keys(c).filter((k) => c[k][1] <= today && (isTerm(k) || known.has(k))).length; };
