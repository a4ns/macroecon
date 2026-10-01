/* Хранилище v3. Пять ключей localStorage (мелкое отдельно от тяжёлого), запись с задержкой, мягкая работа без хранилища.
   mx:v1 (старый прогресс) не трогаем — читаем при миграции. */
import { emitter } from './dom.js';

export const bus = emitter();
const clone = (o) => JSON.parse(JSON.stringify(o));
const DELAY = 400;
let storageOK = true;
const buckets = [];

export function bucket(key, def) {
  let data = null, timer = 0;
  const b = {
    key,
    get data() { return data || load(); },
    save(now) { clearTimeout(timer); const w = () => { try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { storageOK = false; bus.emit('storage-fail'); } }; now ? w() : (timer = setTimeout(w, DELAY)); bus.emit('change', key); },
    reload() { data = null; load(); },
    reset() { data = clone(def); b.save(true); },
    flush() { if (timer) b.save(true); },
  };
  function load() {
    let d = null;
    try { const raw = localStorage.getItem(key); d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (def && !Array.isArray(def) && Array.isArray(d))) d = clone(def);
    else if (!Array.isArray(def)) for (const k of Object.keys(def)) if (d[k] === undefined) d[k] = clone(def[k]);
    return (data = d);
  }
  buckets.push(b);
  return b;
}

export const DEFAULTS = {
  ver: 3, role: null, prof: { name: '', grp: '' },
  set: { newPerDay: 8, revPerDay: 30, conf: true, scale: 'kz', start: null, weeks: 15, pace: 30, rk: [7, 14], pause: [], confetti: true },
  lec: {},      // id → {o,d,s,x}  открыта, макс. глубина 0…1, видимые секунды, изучена (мс)
  pr: {},       // labId → {n, ok, tot, at}   проверенные прогнозы
  tk: {},       // taskId → {f, n, hs, ss, dn}  лучшие верные поля, попытки, метки подсказки/решения, решена
  ses: [],      // сессии вопросов: {t, topic, ok, n, mode, day}
  mast: {},     // topic → мс, когда впервые достигнуто «Освоена»
  ex: { hist: [], run: null },
  assign: {},   // id → {meta, at}
  teach: { votes: [], notes: {}, last: null },
  mig: {},
  seen: {},     // подсказки интерфейса, которые уже показывали
};

export const S = bucket('mx:v3', DEFAULTS);                      // основное состояние
export const SR = bucket('mx:v3:sr', { c: {}, last: 0 });        // карточки: key → [b,d,r,l,t]
export const QA = bucket('mx:v3:qa', []);                        // журнал ответов: [t,key,ok,ms,mode,conf]
export const ERR = bucket('mx:v3:err', {});                      // журнал ошибок: qid → {n,last,sel,conf,why,ok2}
export const NT = bucket('mx:v3:nt', {});                        // заметки: lecId → [{p,s,e,q,k,note,ts}]

export const MODE = { test: 0, diag: 1, exam: 2, review: 3, predict: 4, task: 5 };
export const storageAvailable = () => { try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return storageOK; } catch (e) { return false; } };

/** номер локального «учебного» дня; сутки начинаются в 04:00 */
export function dayNum(t = Date.now()) { const off = -new Date(t).getTimezoneOffset() * 60000; return Math.floor((t + off - 4 * 3600e3) / 864e5); }
export const dayToDate = (d) => new Date(d * 864e5 + 4 * 3600e3 - (-new Date(d * 864e5).getTimezoneOffset() * 60000));

typeof addEventListener !== 'undefined' && addEventListener('pagehide', () => buckets.forEach((b) => b.flush()));
typeof addEventListener !== 'undefined' && addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') buckets.forEach((b) => b.flush()); });
typeof addEventListener !== 'undefined' && addEventListener('storage', (e) => { const b = buckets.find((x) => x.key === e.key); if (b) { b.reload(); bus.emit('change', e.key); } });

/* ── миграция mx:v1 → mx:v3 (один раз) ─────────────────────── */
export function migrate() {
  const s = S.data; if (s.mig.v1) return;
  let v1 = {};
  try { v1 = JSON.parse(localStorage.getItem('mx:v1')) || {}; } catch (e) { v1 = {}; }
  Object.keys(v1.read || {}).forEach((k) => { const id = k.replace('_', '.'); s.lec[id] = s.lec[id] || { o: v1.read[k], d: 0, s: 0, x: 0 }; });
  Object.entries(v1.tests || {}).forEach(([t, r]) => { if (r && +t && r.bestTotal) s.ses.push({ t: r.at || Date.now(), topic: +t, ok: r.bestScore || 0, n: r.bestTotal, mode: 0, day: dayNum(r.at || Date.now()), weak: 1 }); });
  Object.keys((v1.tasks && v1.tasks.done) || {}).forEach((k) => { const id = k.replace('_', '.'); s.tk[id] = s.tk[id] || { f: 0, n: 1, hs: 0, ss: 0, dn: v1.tasks.done[k], weak: 1 }; });
  s.mig.v1 = 1; S.save();
}

/* ── резервная копия ───────────────────────────────────────── */
export function exportBackup() {
  let v1 = null; try { v1 = JSON.parse(localStorage.getItem('mx:v1')); } catch (e) { /* */ }
  return JSON.stringify({ app: 'makro', ver: 3, at: Date.now(), v1, S: S.data, SR: SR.data, QA: QA.data, ERR: ERR.data, NT: NT.data });
}
export function importBackup(text, mode = 'replace') {
  const j = JSON.parse(text);
  if (!j || j.app !== 'makro' || j.ver !== 3) throw new Error('Это не резервная копия «Макро».');
  if (mode === 'replace') {
    [[S, 'S'], [SR, 'SR'], [QA, 'QA'], [ERR, 'ERR'], [NT, 'NT']].forEach(([b, k]) => { b.data; Object.keys(b.data).forEach((x) => delete b.data[x]); if (Array.isArray(b.data)) b.data.length = 0; if (Array.isArray(j[k])) b.data.push(...j[k]); else Object.assign(b.data, j[k] || {}); b.save(true); });
    if (j.v1) try { localStorage.setItem('mx:v1', JSON.stringify(j.v1)); } catch (e) { /* */ }
  } else {
    Object.entries(j.SR.c || {}).forEach(([k, v]) => { const c = SR.data.c[k]; if (!c || (v[4] || 0) > (c[4] || 0)) SR.data.c[k] = v; });
    const seen = new Set(QA.data.map((r) => r[0] + r[1])); (j.QA || []).forEach((r) => { if (!seen.has(r[0] + r[1])) QA.data.push(r); }); QA.data.sort((a, b) => a[0] - b[0]); if (QA.data.length > 2000) QA.data.splice(0, QA.data.length - 2000);
    Object.entries(j.ERR || {}).forEach(([k, v]) => { const e = ERR.data[k]; if (!e || (v.last || 0) > (e.last || 0)) ERR.data[k] = v; });
    Object.entries(j.NT || {}).forEach(([k, v]) => { const a = NT.data[k] || (NT.data[k] = []); v.forEach((n) => { if (!a.some((x) => x.ts === n.ts)) a.push(n); }); });
    const s = S.data, js = j.S || {};
    Object.entries(js.lec || {}).forEach(([k, v]) => { const c = s.lec[k]; if (!c || (v.s || 0) > (c.s || 0) || (v.x || 0) > (c.x || 0)) s.lec[k] = { ...c, ...v }; });
    Object.entries(js.tk || {}).forEach(([k, v]) => { const c = s.tk[k]; if (!c || (v.f || 0) > (c.f || 0)) s.tk[k] = v; });
    Object.entries(js.pr || {}).forEach(([k, v]) => { const c = s.pr[k]; if (!c || (v.n || 0) > (c.n || 0)) s.pr[k] = v; });
    (js.ses || []).forEach((x) => { if (!s.ses.some((y) => y.t === x.t)) s.ses.push(x); }); Object.assign(s.mast, js.mast || {});
    [S, SR, QA, ERR, NT].forEach((b) => b.save(true));
  }
}
export function resetAll() { [S, SR, QA, ERR, NT].forEach((b) => b.reset()); try { localStorage.removeItem('mx:v1'); } catch (e) { /* */ } }
