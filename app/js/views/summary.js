/* Преподаватель: сводка по кодам сдачи — #/teach/summary  (V3_PLAN §4.5)
   analyse() — чистая функция без DOM (используется в Node-самотесте). Данные не покидают браузер. */
import { h, loadCSS, plural, toast } from '../core/dom.js';
import { decodeSubmission, CodecError } from '../core/codec.js';
import { ctx as planCtx } from '../core/plan.js';
import { S } from '../core/state.js';
import { download } from '../ui/sheet.js';
import { describeItem, testQuestions } from './assign.js';

const NB = ' ';
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.\-–—_]+/g, '');

/** текст → список «кусков»: каждый — отдельный код (склеивает коды, разбитые по 40 знаков) */
export function splitCodes(text) {
  const out = []; let cur = null;
  String(text || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) { cur = null; return; }
    const i = line.search(/MX\d*-/);
    if (i >= 0) { cur = { s: line.slice(i).replace(/\s+/g, ''), line }; out.push(cur); return; }
    if (cur && /^[A-Za-z0-9_\-]{3,}$/.test(line)) { cur.s += line; return; }
    cur = null; out.push({ s: line, line, junk: true });
  });
  return out;
}

const REASON = { crc: 'код не принят: контрольная сумма не совпала (опечатка или код обрезан)', format: 'код не принят: повреждён или неполный', data: 'код не принят: данные повреждены', version: 'код от другой версии приложения', empty: 'пустая строка' };

/** @returns {Promise<{groups:[], bad:[], dups:number, total:number}>} */
export async function analyse(text, { bank, ix, mine = new Set() }) {
  const parts = splitCodes(text), bad = [], good = [];
  const res = await Promise.all(parts.map(async (p) => { if (p.junk) return { p, err: new CodecError('строка не распознана как код (код начинается с «MX1-»)', 'junk') }; try { return { p, o: await decodeSubmission(p.s) }; } catch (e) { return { p, err: e }; } }));
  res.forEach(({ p, o, err }) => { if (err) bad.push({ line: p.line, why: err.code === 'junk' ? err.message : REASON[err.code] || err.message }); else good.push(o); });

  // один и тот же код дважды = один раз (ключ id + имя); оставляем более свежий
  const byKey = new Map(); let dups = 0;
  good.forEach((o) => { const k = o.id + '|' + norm(o.n || o.hn); const old = byKey.get(k); if (old) { dups++; if ((o.at || 0) > (old.at || 0)) byKey.set(k, o); } else byKey.set(k, o); });

  const groups = new Map();
  [...byKey.values()].forEach((o) => { (groups.get(o.id) || groups.set(o.id, []).get(o.id)).push(o); });
  const out = [];
  groups.forEach((list, id) => {
    list.sort((a, b) => String(a.g || a.hg).localeCompare(String(b.g || b.hg), 'ru') || String(a.n || a.hn).localeCompare(String(b.n || b.hn), 'ru'));
    const ref = list.reduce((a, b) => ((b.i || []).length > (a.i || []).length ? b : a), list[0]);
    const items = (ref.i || []).map((it) => { let d = { title: 'Пункт', sub: '' }; try { d = describeItem(it, ix); } catch (e) { /* */ } return { k: it.k, title: d.title, ref: it }; });
    const rows = list.map((o) => {
      const cells = items.map((_, j) => cellOf((o.i || [])[j]));
      const test = cells.map((c) => c.test).filter(Boolean);
      return { name: o.n || o.hn || '?', grp: o.g || o.hg || '', at: o.at || 0, bkDiff: !!(o.bk && o.bk !== bank.bk), cells, done: cells.filter((c) => c.s === 2).length, o };
    });
    const own = !mine.size || mine.has(id);
    out.push({ id, t: ref.t || 'Задание', by: ref.by || '', own, items, rows, N: items.length, ...stats(rows, items, bank, own) });
  });
  return { groups: out, bad, dups, total: parts.length };
}

function cellOf(it) {
  if (!it) return { s: 0, text: '', n: null };
  const s = it.s | 0;
  switch (it.k) {
    case 'lec': return { s, text: `${it.x || 0}/${(it.ids || []).length}`, csv: `${it.x || 0} из ${(it.ids || []).length}` };
    case 'lab': return { s, text: it.pr ? `${it.pr[0]}/${it.pr[1]}` : '', csv: it.pr ? `прогноз ${it.pr[0]} из ${it.pr[1]}` : '' };
    case 'task': { const sc = it.sc || [], avg = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : 0; return { s, text: avg + '%', n: avg, csv: avg }; }
    case 'test': {
      if (it.total == null) return { s: 0, text: '', test: null };
      const pct = it.total ? Math.round(100 * it.score / it.total) : 0;
      return { s, text: pct + '%', n: pct, time: it.time, test: { pct, time: it.time || 0, score: it.score, total: it.total, w: it.w || [], seed: it.seed, topic: it.topic, n: it.n, min: it.min }, csv: pct };
    }
    default: return { s, text: '' };
  }
}

function stats(rows, items, bank, own) {
  const tj = items.map((x, j) => (x.k === 'test' ? j : -1)).filter((j) => j >= 0);
  const support = [], hist = new Array(10).fill(0), hard = [];
  if (!own) return { support, hist, hard, histLabel: '', tj };
  rows.forEach((r) => {
    if (tj.length) {
      const ts = tj.map((j) => r.cells[j].test);
      const miss = ts.findIndex((t) => !t);
      if (miss >= 0) support.push({ r, why: 'тест не пройден' });
      else { const low = ts.find((t) => t.pct < 50); if (low) support.push({ r, why: `тест ${low.pct}${NB}%` }); }
    } else if (r.done * 2 < items.length) support.push({ r, why: r.done ? `выполнено ${r.done} из ${items.length}` : 'не начал' });
  });
  let histLabel;
  if (tj.length) {
    histLabel = 'Результаты теста, % верных';
    rows.forEach((r) => { const ts = tj.map((j) => r.cells[j].test).filter(Boolean); if (ts.length) { const avg = ts.reduce((a, t) => a + t.pct, 0) / ts.length; hist[Math.min(9, Math.floor(avg / 10))]++; } });
  } else {
    histLabel = 'Выполнено пунктов, %';
    rows.forEach((r) => hist[Math.min(9, Math.floor(100 * r.done / Math.max(1, items.length) / 10))]++);
  }
  // самые трудные вопросы: по каждому тесту задания
  tj.forEach((j) => {
    const ref = items[j].ref, Qs = testQuestions(bank, ref);
    const takers = rows.filter((r) => r.cells[j].test && !r.bkDiff);
    if (!takers.length) return;
    const wrong = new Map();
    takers.forEach((r) => (r.cells[j].test.w || []).forEach((w) => { const [qid, mask] = String(w).split(':'); (wrong.get(qid) || wrong.set(qid, []).get(qid)).push(+mask || 0); }));
    Qs.forEach((Q) => {
      const ms = wrong.get(Q.qid) || [];
      if (!ms.length) return;
      const dist = new Map();
      ms.forEach((m) => Q.a.forEach((o, i) => { if ((m >> i) & 1 && !o.ok) dist.set(i, (dist.get(i) || 0) + 1); }));
      hard.push({ Q, bad: ms.length, N: takers.length, rate: ms.length / takers.length, dist: [...dist].sort((a, b) => b[1] - a[1]).map(([i, k]) => ({ t: Q.a[i].t, k })), j });
    });
  });
  hard.sort((a, b) => b.rate - a.rate || b.bad - a.bad || a.Q.qid.localeCompare(b.Q.qid, 'en', { numeric: true }));
  return { support, hist, histLabel, hard: hard.slice(0, 5), tj };
}

/* ── CSV ───────────────────────────────────────────────────── */
const csvCell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function toCSV(g) {
  const head = ['Группа', 'Студент'], tjs = new Set(g.tj);
  g.items.forEach((it, j) => { head.push(it.title); if (tjs.has(j)) head.push(it.title + ', время (с)'); });
  head.push('Выполнено пунктов', 'Версия банка отличается');
  const W = ['нет', 'частично', 'да'];
  const lines = [head.map(csvCell).join(';')];
  g.rows.forEach((r) => {
    const row = [r.grp, r.name];
    r.cells.forEach((c, j) => { const it = g.items[j]; if (it.k === 'test') { row.push(c.test ? c.test.pct : 'нет', c.test ? c.test.time : ''); } else if (it.k === 'task' || it.k === 'lec' || (it.k === 'lab' && c.csv)) row.push(c.csv != null && c.csv !== '' ? c.csv : W[c.s]); else row.push(W[c.s]); });
    row.push(r.done + ' из ' + g.N, r.bkDiff ? 'да' : '');
    lines.push(row.map(csvCell).join(';'));
  });
  return lines.join('\r\n') + '\r\n';
}

/* ── экран ─────────────────────────────────────────────────── */
export async function load() { const [c] = await Promise.all([planCtx(), loadCSS('app/css/v-teach.css')]); return { c }; }

const GL = ['○', '◐', '✓'], WORD = ['не начато', 'в процессе', 'выполнено'];
const SK = 'mx:sum';

export function mount(el, ctx, { c }) {
  const ta = h('textarea.tv-in.sm-ta#sm-in', { rows: 9, spellcheck: 'false', autocomplete: 'off', placeholder: 'MX1-k3p9-ИвановАС-ЭК21-…-9F2C\nMX1-k3p9-ПетроваМН-ЭК21-…-3B07', 'aria-label': 'Коды сдачи' });
  try { ta.value = sessionStorage.getItem(SK) || ''; } catch (e) { /* */ }
  const out = h('div.sm-out', { 'aria-live': 'polite' });
  const mine = new Set(((S.data.teach.assigns) || []).map((a) => a.id));

  async function build() {
    const text = ta.value;
    try { sessionStorage.setItem(SK, text); } catch (e) { /* */ }
    if (!text.trim()) { out.replaceChildren(h('div.sm-empty', h('b', 'Пока пусто'), h('p', 'Вставьте в поле выше коды, которые прислали студенты (по одному в строке), и нажмите «Построить».'))); ta.focus(); return; }
    const t0 = performance.now();
    let r;
    try { r = await analyse(text, { bank: c.bank, ix: c.ix, mine }); } catch (e) { out.replaceChildren(h('div.co.co--bad', { role: 'alert' }, h('strong.co__t', 'Не удалось построить сводку'), h('p', e.message))); return; }
    draw(r, Math.round(performance.now() - t0));
  }

  function draw(r, ms) {
    const ok = r.groups.reduce((a, g) => a + g.rows.length, 0);
    const kids = [h('p.sm-sum.mono', `Строк: ${r.total} · принято: ${ok}` + (r.dups ? ` · повторов: ${r.dups}` : '') + (r.bad.length ? ` · не принято: ${r.bad.length}` : '') + ` · ${ms}${NB}мс`)];
    if (!r.groups.length && !r.bad.length) kids.push(h('div.sm-empty', h('p', 'В тексте нет кодов. Код начинается с «MX1-».')));
    r.groups.forEach((g) => kids.push(group(g)));
    if (r.bad.length) kids.push(h('section.sm-bad.card', h('h2.h3', 'Не принято: ' + r.bad.length), h('ul.sm-bl', ...r.bad.map((b) => h('li', h('code.sm-code', b.line.length > 46 ? b.line.slice(0, 44) + '…' : b.line), h('span', ' — ' + b.why)))), h('p.th-hint', 'Попросите студента отправить код ещё раз целиком (кнопка «Скопировать» в окне «Сдать преподавателю»).')));
    out.replaceChildren(...kids);
  }

  function group(g) {
    const tj = new Set(g.tj);
    const head = h('tr', h('th.sm-c1', { scope: 'col' }, 'Студент'), ...g.items.map((it, j) => h('th', { scope: 'col', class: tj.has(j) ? 'num' : null }, it.title)), h('th.num', { scope: 'col' }, 'Итого'));
    const rows = g.rows.map((r) => h('tr', { class: r.bkDiff ? 'is-warn' : null },
      h('th.sm-c1', { scope: 'row' }, h('b', r.name), r.grp ? h('small', r.grp) : null, r.bkDiff ? h('small.sm-flag', 'другая версия банка') : null),
      ...r.cells.map((cl, j) => { const test = g.items[j].k === 'test'; return h('td', { class: 'sm-s' + cl.s + (test ? ' num' : '') }, h('span.sm-g', { role: 'img', 'aria-label': WORD[cl.s] }, test && cl.test ? '' : GL[cl.s]), cl.text ? h('span.sm-v', cl.text) : null, test && cl.test && cl.test.time ? h('small.sm-t', `${Math.floor(cl.test.time / 60)}:${String(cl.test.time % 60).padStart(2, '0')}`) : null); }),
      h('td.num', `${r.done}/${g.N}`)));
    const box = h('section.sm-grp.card', { 'aria-label': g.t },
      h('header.sm-gh', h('div', h('p.eyebrow', 'Задание ' + g.id), h('h2.h3', g.t), g.by ? h('p.th-hint', g.by) : null), h('button.btn.btn--sm', { type: 'button', onclick: () => { download('svodka-' + g.id + '.csv', toCSV(g), 'text/csv;charset=utf-8', true); toast('CSV сохранён'); } }, 'Скачать CSV')),
      !g.own ? h('aside.co.co--warn', h('strong.co__t', 'Задание другого преподавателя'), h('p', 'Этого задания нет среди созданных в этом браузере (его выдали на другом устройстве или другой преподаватель). Таблица показана, но в «Кого поддержать» и «Трудные вопросы» оно не входит.')) : null,
      h('div.dt.sm-dt', h('table', h('thead', head), h('tbody', ...rows))));
    if (g.own) {
      box.append(h('div.sm-cols',
        h('section.sm-blk', h('h3.sm-bt', 'Кого поддержать'), g.support.length ? h('ul.sm-sup', ...g.support.map((x) => h('li', h('b', x.r.name), x.r.grp ? ' · ' + x.r.grp : '', h('span.sm-why', ' — ' + x.why)))) : h('p.th-hint', g.rows.length ? 'Все сдавшие выше порога поддержки (50' + NB + '% по тесту).' : '—')),
        h('section.sm-blk', h('h3.sm-bt', g.histLabel), hist(g.hist))));
      if (g.tj.length) box.append(h('section.sm-blk.sm-hard', h('h3.sm-bt', 'Пять самых трудных вопросов'), g.hard.length ? h('ol.sm-hl', ...g.hard.map((q) => h('li', h('p.sm-hq', q.Q.q), h('p.sm-hr.mono', `ошиблись ${q.bad} из ${q.N} · ${Math.round(q.rate * 100)}${NB}%`), q.dist.length ? h('ul.sm-hd', ...q.dist.map((d) => h('li', h('span', '«' + d.t.replace(/^ложь$/i, 'Неверно') + '»'), h('b', ` — ${d.k}`)))) : null, h('p.sm-ha', 'Верно: ' + q.Q.a.filter((o) => o.ok).map((o) => o.t.replace(/^ложь$/i, 'Неверно')).join('; '))))) : h('p.th-hint', 'Ошибок в тесте пока нет — или нет сдавших с той же версией банка.')));
    }
    return box;
  }
  function hist(a) {
    const max = Math.max(1, ...a);
    return h('div.sm-hist', { role: 'img', 'aria-label': 'Гистограмма: ' + a.map((n, i) => `${i * 10}–${i === 9 ? 100 : i * 10 + 9}: ${n}`).join('; ') },
      ...a.map((n, i) => h('div.sm-hb', h('b', n ? String(n) : ''), h('i', { style: { '--v': n / max } }), h('span', String(i * 10)))));
  }

  const go = h('button.btn.btn--primary.btn--lg', { type: 'button', onclick: build }, 'Построить');
  ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); build(); } });
  el.append(h('div.sm.wrap',
    h('header.th-head', h('nav.crumbs', h('a', { href: '#/teach' }, 'Преподавателю'), h('i', '/'), h('span', 'Сводка')),
      h('h1.h1', 'Сводка ', h('em', 'по кодам')), h('p.lede', 'Студенты присылают коды сдачи — вставьте их сюда, и получите таблицу «студент × пункт», тех, кого стоит поддержать, и самые трудные вопросы.')),
    h('section.sm-in.card', h('label.tv-l', { for: 'sm-in' }, 'Вставьте коды, по одному в строке'), ta,
      h('div.as-act', go, h('button.btn', { type: 'button', onclick: () => { ta.value = ''; try { sessionStorage.removeItem(SK); } catch (e) { /* */ } out.replaceChildren(); ta.focus(); } }, 'Очистить'), h('span.th-hint', 'Ctrl+Enter — построить')),
      h('p.th-hint', 'Код — самоотчёт студента, подделать его без сервера можно: сводка помогает вести занятие, но не заменяет контроль. Коды обрабатываются в вашем браузере и никуда не отправляются.')),
    out));
  if (ta.value.trim()) build();
  return { title: 'Сводка по кодам', destroy() {} };
}
