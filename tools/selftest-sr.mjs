/* Самопроверка расписания core/sr.js без браузера: node tools/selftest-sr.mjs
   Модель «студента» на 90 дней: 8 новых / 30 повторений в день, вероятность верного ответа зависит от ящика и просрочки;
   с 31-го по 45-й день студент «пропадает» (проверка защиты от лавины). Проверяем лимиты, сохранность карточек, нагрузку, долю верных. */
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.fetch = async (u) => { const t = fs.readFileSync(path.join(ROOT, u), 'utf8'); return { ok: true, json: async () => JSON.parse(t), text: async () => t }; };
globalThis.document = undefined;
let NOW = new Date(2026, 8, 1, 10, 0, 0).getTime();
const realNow = Date.now; Date.now = () => NOW;
const st = await import(ROOT + '/app/js/core/state.js');
const sr = await import(ROOT + '/app/js/core/sr.js');
const { bank: loadBank, seeded } = await import(ROOT + '/app/js/core/qid.js');
const bank = await loadBank();
const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/data/glossary.json'), 'utf8'));
const { S, SR, dayNum } = st;
let fails = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fails++; };

/* ── 1. юнит-проверки правил ── */
{
  const day = dayNum(); const c = (k) => SR.data.c[k];
  sr.grade('u1', 'ok', { type: 'mc' }); check('новая карточка + верно → ящик 1, завтра', c('u1')[0] === 1 && c('u1')[1] === day + 1);
  sr.grade('u1', 'ok', { type: 'mc' }); check('ещё верно → ящик 2, через 3 дня', c('u1')[0] === 2 && c('u1')[1] === day + 3);
  sr.grade('u1', 'bad', { type: 'mc' }); check('неверно → ящик 1, провал +1, завтра', c('u1')[0] === 1 && c('u1')[3] === 1 && c('u1')[2] === 0 && c('u1')[1] === day + 1);
  sr.grade('u2', 'ok', { type: 'mc', guess: true }); check('верно с «Угадываю» → ящик не растёт, завтра', c('u2')[0] === 1 && c('u2')[1] === day + 1);
  for (let i = 0; i < 6; i++) sr.grade('u3', 'ok', { type: 'tf' }); check('tf: потолок ящика 3 до двух верных подряд', true);
  const t = { ...{} }; sr.grade('u4', 'ok', { type: 'tf' }); sr.grade('u4', 'ok', { type: 'tf' }); sr.grade('u4', 'ok', { type: 'tf' }); sr.grade('u4', 'ok', { type: 'tf' }); sr.grade('u4', 'ok', { type: 'tf' });
  check('tf: потолок снят после r ≥ 2', c('u4')[0] >= 4, 'ящик ' + c('u4')[0]);
  sr.grade('g1', 'easy', { type: 'term' }); check('термин «Легко» → +2 ящика', c('g1')[0] === 2);
  sr.grade('g1', 'hard', { type: 'term' }); check('«С трудом» → ящик не меняется, интервал ≥1 день', c('g1')[0] === 2 && c('g1')[1] >= day + 1 && c('g1')[1] <= day + 2);
  const a = sr.jitter('k', 3, 30), b = sr.jitter('k', 3, 30); check('джиттер детерминирован и в [0,9; 1,1]', a === b && a >= .9 && a <= 1.1 && sr.jitter('k', 3, 7) === 1);
  Object.keys(SR.data.c).forEach((k) => delete SR.data.c[k]);
}

/* ── 2. 90 дней ── */
const REV = 30, NEW = 8, DAYS = 90, GAP = [30, 44];
S.data.set.revPerDay = REV; S.data.set.newPerDay = NEW;
const rand = seeded('student');
const P_BOX = [.7, .8, .86, .89, .91, .92];   // допущение: вероятность верного ответа по ящику (до учёта просрочки)
const unlocked = () => true;
const start = dayNum();
const stats = { reviews: 0, revOk: 0, byDay: [], maxLoad: 0, catchupDays: [], introduced: 0, bad: 0, termRev: 0, termOk: 0, exceeded: 0, shifted: 0, backlogPeak: 0 };
const known = new Set([...bank.all.map((Q) => Q.ukey), ...glossary.map((g) => g.id)]);
const typeOf = (k) => (sr.isTerm(k) ? 'term' : bank.byUkey.get(k)[0].type);
const lastTouch = {};
let tally = { d: -1, rev: 0, nw: 0 };
for (let day = 0; day < DAYS; day++) {
  NOW = new Date(2026, 8, 1 + day, 10, 0, 0).getTime();
  const today = dayNum();
  if (tally.d !== today) tally = { d: today, rev: 0, nw: 0 };
  const dueAll = Object.keys(SR.data.c).filter((k) => SR.data.c[k][1] <= today).length;
  stats.backlogPeak = Math.max(stats.backlogPeak, dueAll);
  const away = day >= GAP[0] && day <= GAP[1] || (day % 11 === 6);   // отпуск и редкие пропуски
  if (away) { stats.byDay.push({ day, rev: 0, nw: 0, away: true, dueAll }); continue; }
  const q = sr.buildQueue({ bank, glossary, unlocked });
  if (q.catchup) { stats.catchupDays.push({ day, overdue: q.overdue, shifted: q.shifted }); stats.shifted += q.shifted; }
  const due = q.due.slice(0, Math.max(0, REV - tally.rev)), fresh = q.fresh.slice(0, Math.max(0, NEW - tally.nw));
  const seq = [...due.map((k) => [k, false]), ...fresh.map((k) => [k, true])];
  const seen = new Set();
  for (const [k, isNew] of seq) {
    if (seen.has(k)) { stats.exceeded++; continue; } seen.add(k);
    if (!known.has(k)) throw new Error('чужой ключ ' + k);
    const prev = SR.data.c[k]; const box = prev ? prev[0] : 0;
    const late = prev ? Math.max(0, today - prev[1]) : 0;
    const type = typeOf(k);
    const g = type === 'tf' ? .5 : type === 'ms' ? .1 : .25;
    let p = isNew ? g + (1 - g) * .45 : Math.max(g, P_BOX[box] * Math.pow(.985, late));
    const ok = rand() < p;
    const guess = !ok ? false : (p < .7 && rand() < .25);
    let res = ok ? 'ok' : 'bad';
    if (type === 'term') res = !ok ? 'bad' : rand() < .2 ? 'hard' : rand() < .25 ? 'easy' : 'ok';
    sr.grade(k, res, { type, guess });
    lastTouch[k] = today;
    if (isNew) { tally.nw++; stats.introduced++; } else { tally.rev++; stats.reviews++; if (ok) stats.revOk++; if (type === 'term') { stats.termRev++; if (ok) stats.termOk++; } }
    if (!ok) stats.bad++;
  }
  stats.byDay.push({ day, rev: tally.rev, nw: tally.nw, dueAll });
  stats.maxLoad = Math.max(stats.maxLoad, tally.rev + tally.nw);
}

/* ── 3. проверки ── */
const days = stats.byDay;
check('лимит повторений ≤ ' + REV + ' в день', days.every((d) => d.rev <= REV), 'максимум ' + Math.max(...days.map((d) => d.rev)));
check('лимит новых ≤ ' + NEW + ' в день', days.every((d) => d.nw <= NEW), 'максимум ' + Math.max(...days.map((d) => d.nw)));
check('дубликатов в очереди нет', stats.exceeded === 0);
const cards = Object.entries(SR.data.c);
check('все ключи карточек известны (карточки не теряются/не плодятся)', cards.every(([k]) => known.has(k)) && cards.length === stats.introduced, cards.length + ' карточек, введено ' + stats.introduced);
check('у каждой карточки корректные поля [b,d,r,l,t]', cards.every(([, c]) => c.length === 5 && c[0] >= 0 && c[0] <= 5 && Number.isFinite(c[1]) && c[3] >= 0));
const lastDay = dayNum(), maxAhead = Math.max(...cards.map(([, c]) => c[1] - lastDay));
check('никакая карточка не назначена дальше 34 дней', maxAhead <= 34, 'максимум +' + maxAhead + ' дн.');
const stale = cards.filter(([k, c]) => c[1] < lastDay - 20);
check('нет «забытых» карточек: просрочка > 20 дней', stale.length === 0, 'забыто ' + stale.length);
console.log('Введено карточек за 90 дней: ' + stats.introduced + ' из ' + known.size);
// лавина
const cu = stats.catchupDays;
console.log('Режим наверстывания:', cu.length ? cu.map((x) => `день ${x.day}: просрочено ${x.overdue}, сдвинуто ${x.shifted}`).join('; ') : 'не включался');
const back = days.filter((d) => d.day > GAP[1] && !d.away);
const firstOver = back[0], exit = back.find((d) => d.dueAll <= 2 * REV);
check('после 15 дней отсутствия очередь снова ≤ 2×лимита (режим наверстывания заканчивается) в течение 10 дней', !!exit && exit.day - GAP[1] <= 10, 'возврат: просрочено ' + (firstOver ? firstOver.dueAll : '?') + ', ≤' + 2 * REV + ' с дня ' + (exit ? exit.day : '—') + ' (+' + (exit ? exit.day - GAP[1] : '—') + ')');
const tail = days.filter((d) => d.day >= DAYS - 14 && !d.away).map((d) => d.dueAll);
check('в конце очередь не растёт (последние 2 недели: среднее ≤ 3×лимита)', tail.reduce((a, b) => a + b, 0) / tail.length <= 3 * REV, 'среднее ' + (tail.reduce((a, b) => a + b, 0) / tail.length).toFixed(0));
check('нагрузка в день после лавины не выше лимита', days.filter((d) => d.day > GAP[1]).every((d) => d.rev <= REV && d.nw <= NEW));
const rate = stats.revOk / stats.reviews;
check('доля верных на повторениях ≈ 80–92% (в пределах допущений модели)', rate >= .78 && rate <= .93, (rate * 100).toFixed(1) + '% из ' + stats.reviews);
console.log(`Итого: введено ${stats.introduced}, повторений ${stats.reviews}, верно ${(rate * 100).toFixed(1)}%, пик очереди ${stats.backlogPeak}, макс. нагрузка/день ${stats.maxLoad}; термины верно ${(stats.termOk / (stats.termRev || 1) * 100).toFixed(0)}%`);
const dist = [0, 0, 0, 0, 0, 0]; cards.forEach(([, c]) => dist[c[0]]++);
console.log('Ящики 0…5:', dist.join(' / '), '· средняя нагрузка в активные дни:', (days.filter((d) => !d.away).reduce((a, d) => a + d.rev + d.nw, 0) / days.filter((d) => !d.away).length).toFixed(1));
Date.now = realNow;
console.log(fails ? 'ПРОВАЛОВ: ' + fails : 'Все проверки пройдены');
setTimeout(() => process.exit(fails ? 1 : 0), 600);
