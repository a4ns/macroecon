/* Идентификаторы вопросов, банк вопросов, детерминированная выборка.
   qid = «тема.индекс» (стабильно, пока tests.json не меняется); ukey = хэш текста и вариантов (одинаковые вопросы → один ukey). */
import { tests } from './data.js';

export function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
export const norm = (s) => String(s).toLowerCase().replace(/[  \s]+/g, ' ').trim();
export const b36 = (n, len = 7) => n.toString(36).padStart(len, '0').slice(-len);
/** детерминированный генератор 0…1 из строки-зерна */
export function seeded(seed) { let a = fnv1a(String(seed)) >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffled(arr, rand = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* варианты вида «Все перечисленное» нельзя переставлять */
export const POSITIONAL = /(все|всё|всего|всех|каждый|любой|ни\s+один|ничего)\s+(из\s+)?(выше|ниже)?(перечисл|указан|названн)|^все\b.{0,14}$/i;

let cache = null;
/** @returns {Promise<Bank>} Bank = { all, topics:[n…], byTopic:Map<n,Q[]>, byQid:Map, byUkey:Map<ukey,Q[]>, unique(n)->Q[], E(n), bk, counts } */
export async function bank(raw) {
  if (cache && !raw) return cache;
  const data = raw || await tests();
  const all = [], byTopic = new Map(), byQid = new Map(), byUkey = new Map();
  Object.keys(data).map(Number).sort((a, b) => a - b).forEach((n) => {
    const list = [];
    data[n].q.forEach((q, i) => {
      const a = q.a.map((o, k) => ({ t: o.t, ok: !!o.ok, i: k }));
      const ukey = b36(fnv1a(norm(q.q) + '|' + a.map((o) => norm(o.t)).sort().join('|')));
      const nOk = a.filter((o) => o.ok).length;
      const Q = { qid: n + '.' + i, ukey, topic: n, i, q: q.q, type: q.type, a, nOk, positional: q.type === 'tf' || a.some((o) => POSITIONAL.test(o.t.trim())), guess: q.type === 'tf' ? .5 : q.type === 'ms' ? .1 : 1 / a.length };
      list.push(Q); all.push(Q); byQid.set(Q.qid, Q);
      (byUkey.get(ukey) || byUkey.set(ukey, []).get(ukey)).push(Q);
    });
    byTopic.set(n, list);
  });
  const uniq = new Map();
  const unique = (n) => { if (!uniq.has(n)) { const seen = new Set(); uniq.set(n, (byTopic.get(n) || []).filter((Q) => !seen.has(Q.ukey) && seen.add(Q.ukey))); } return uniq.get(n); };
  const bk = fnv1a(all.map((Q) => Q.ukey).join(',')).toString(16).slice(0, 4).padStart(4, '0');
  const b = { all, topics: [...byTopic.keys()], byTopic, byQid, byUkey, unique, E: (n) => Math.min(20, unique(n).length), bk, counts: { records: all.length, unique: byUkey.size } };
  if (!raw) cache = b;
  return b;
}

/** подготовить вопрос к показу: перемешать варианты (кроме позиционных), вернуть копию */
export function prepare(Q, rand = Math.random) {
  const a = Q.positional ? Q.a.map((o) => ({ ...o })) : shuffled(Q.a.map((o) => ({ ...o })), rand);
  return { ...Q, a };
}

/** ukey вопроса по тексту и вариантам (как в bank()); a — [{t}] в любом порядке */
export const ukeyOf = (q, a) => b36(fnv1a(norm(q) + '|' + a.map((o) => norm(o.t)).sort().join('|')));
/** найти вопрос банка по показанному вопросу { q, a:[{t}] }; вернёт Q с group (все записи-дубликаты) или null */
export function findQ(b, { q, a }) {
  const list = b.byUkey.get(ukeyOf(q, a));
  return list ? { ...list[0], group: list } : null;
}
