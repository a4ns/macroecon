/* Печатные листы A4 (чёрно-белые, serif 11 pt) и мелкие утилиты преподавателя.
   Вёрстка листа — таблица с повторяющейся шапкой (thead) и строками, которые не разрываются (tr { break-inside: avoid }):
   так и Chrome, и Firefox переносят вопросы целиком и на каждой странице печатают номер варианта. Стили — app/css/v-print.css. */
import { h } from '../core/dom.js';

export const LET = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
export const tfText = (t) => (/^ложь$/i.test(t) ? 'Неверно' : t);
/** верные буквы показанного (уже перемешанного) вопроса: «Б» или «АВ» */
export const keyOf = (Q) => Q.a.map((o, i) => (o.ok ? LET[i] : '')).join('');

/* ── утилиты ───────────────────────────────────────────────── */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* запасной путь */ }
  try {
    const t = h('textarea', { value: text, readonly: true, style: { position: 'fixed', left: '-999px', top: '0' } });
    document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return !!ok;
  } catch (e) { return false; }
}
export function download(name, text, mime = 'text/plain;charset=utf-8', bom = false) {
  const blob = new Blob([bom ? '﻿' : '', text], { type: mime });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ── каркас страницы ───────────────────────────────────────── */
/** run — бегущая шапка (на каждой странице); rows — массив узлов, каждый внутри <tr> (не разрывается) */
export function page(run, rows, cls = '') {
  return h('table.sh-pg' + (cls ? '.' + cls : ''),
    h('thead', h('tr', h('td', h('div.sh-run', ...[].concat(run))))),
    h('tbody', ...rows.map((r) => (r instanceof Node && r.tagName === 'TR' ? r : h('tr', h('td', r))))));
}
const ln = (cls = '') => h('span.sh-ln' + (cls ? '.' + cls : ''), { 'aria-hidden': 'true' });
export function fio(opts = {}) {
  return h('div.sh-fio',
    h('span', 'ФИО', ln('sh-ln--w')),
    h('span', 'Группа', ln('sh-ln--s')),
    opts.variant ? h('span.sh-var', 'Вариант ', h('b', String(opts.variant))) : h('span', 'Дата', ln('sh-ln--s')));
}
const run = (meta, what) => [h('b', meta.title || 'Макроэкономика'), ' · ', what, meta.seed ? h('span.sh-run__r', 'зерно ' + meta.seed + (meta.bk ? ' · банк ' + meta.bk : '')) : null];

/* ── вариант (с бланком) ───────────────────────────────────── */
function questionRow(it, i) {
  const Q = it.Q;
  return h('tr.sh-qr', h('td',
    h('div.sh-q',
      h('span.sh-n', String(i + 1) + '.'),
      h('div.sh-qb',
        h('p.sh-qt', Q.q, Q.type === 'ms' ? h('i', ' (несколько верных ответов)') : null),
        h('ol.sh-o', ...Q.a.map((o, k) => h('li', h('b.sh-l', LET[k] + '.'), h('span', Q.type === 'tf' ? tfText(o.t) : o.t))))))));
}
export function bubbles(k, nOpts, { cols } = {}) {
  const c = cols || (k > 30 ? 4 : k > 15 ? 3 : 2), per = Math.ceil(k / c);
  const L = LET.slice(0, nOpts);
  return h('div.sh-bub', { style: { '--c': c } }, ...Array.from({ length: c }, (_, ci) => h('div.sh-bcol',
    ...Array.from({ length: Math.min(per, k - ci * per) }, (_, r) => { const n = ci * per + r + 1; return h('div.sh-brow', h('b.sh-bn', String(n)), ...L.map((l) => h('span.sh-bo', l))); }))));
}
export const maxOpts = (variants) => Math.min(8, Math.max(2, ...variants.flatMap((v) => v.items.map((it) => it.Q.a.length))));

export function variantPage(V, meta, nOpts) {
  const k = V.items.length;
  return page(run(meta, 'вариант ' + V.no), [
    h('div.sh-head', h('h1.sh-h', 'Вариант ', h('span.sh-hn', String(V.no))), fio({ variant: null })),
    h('p.sh-rule', 'К каждому вопросу выберите один верный ответ; где сказано «несколько», отметьте все верные. Ответы запишите в бланке в конце листа.'),
    ...V.items.map(questionRow),
    h('tr.sh-blr', h('td', h('div.sh-blank', h('h2.sh-h2', 'Бланк ответов · вариант ' + V.no), h('p.sh-note', 'Зачеркните букву верного ответа (для «нескольких» — все верные).'), bubbles(k, nOpts)))),
  ], 'sh-variant');
}
/** отдельный бланк ответов — по странице на вариант */
export function blankPage(V, meta, nOpts, k) {
  return page(run(meta, 'бланк ответов · вариант ' + V.no), [
    h('div.sh-head', h('h1.sh-h', 'Бланк ответов · вариант ', h('span.sh-hn', String(V.no))), fio()),
    h('p.sh-note', 'Зачеркните букву верного ответа. Для вопросов с пометкой «несколько» отметьте все верные.'),
    h('div.sh-blank.sh-blank--big', bubbles(k, nOpts)),
    h('div.sh-score', h('span', 'Верных ответов', ln('sh-ln--s')), h('span', 'Оценка', ln('sh-ln--s')), h('span', 'Подпись', ln('sh-ln--m'))),
  ], 'sh-blankpg');
}
/** ключ: строки — номера вопросов, столбцы — варианты */
export function keyPage(variants, meta) {
  const k = Math.max(...variants.map((v) => v.items.length));
  const head = h('tr.sh-kh', h('th', '№'), ...variants.map((v) => h('th', { scope: 'col' }, 'В' + v.no)));
  const rows = Array.from({ length: k }, (_, i) => h('tr.sh-kr', h('th', { scope: 'row' }, String(i + 1)), ...variants.map((v) => h('td', v.items[i] ? v.items[i].key : '—'))));
  return page(run(meta, 'ключ (не выдавать студентам)'), [
    h('div.sh-head', h('h1.sh-h', 'Ключ'), h('p.sh-note', `Варианты 1–${variants.length}. Буквы — по порядку ответов, как напечатано в варианте.`)),
    h('tr.sh-ktr', h('td', h('table.sh-key', h('thead', head), h('tbody', ...rows)))),
  ], 'sh-keypg');
}

/* ── карточки А–Д ──────────────────────────────────────────── */
export function cardPages(sets = 1) {
  const A = [['А'], ['Б'], ['В'], ['Г']], B = [['Д'], ['ok', 'Верно'], ['no', 'Неверно']];
  const mark = (g) => h('svg.sh-cs', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: g === 'ok' ? '<path d="m4.5 12.5 5 5L19.5 6.5"/>' : '<path d="M6 6l12 12M18 6 6 18"/>' });
  const card = ([g, w]) => h('div.sh-card', g.length === 1 ? h('span.sh-cl', g) : mark(g), w ? h('span.sh-cw', w) : null);
  const out = [];
  for (let s = 0; s < sets; s++) {
    out.push(h('section.sh-cards', ...A.map(card)));
    out.push(h('section.sh-cards', ...B.map(card)));
  }
  return out;
}

/* ── рабочий лист темы ─────────────────────────────────────── */
/** html задачи → узел без полей ввода (вместо input.ans — линия), без подсказок и решений */
export function taskNode(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  t.content.querySelectorAll('input.ans, input[data-k]').forEach((i) => { const s = document.createElement('span'); s.className = 'sh-ln sh-ln--a'; s.setAttribute('aria-hidden', 'true'); i.replaceWith(s); });
  t.content.querySelectorAll('script, style, button, [hidden], .tk-hint, .tk-sol').forEach((x) => x.remove());
  const d = document.createElement('div'); d.className = 'sh-tb'; d.append(t.content); return d;
}
export function worksheetPage(tp, tasks, meta) {
  const rows = [h('div.sh-head', h('h1.sh-h', 'Рабочий лист · тема ', h('span.sh-hn', String(tp.n))), fio()), h('p.sh-note', tp.title)];
  tasks.forEach((t) => rows.push(h('tr.sh-tr', h('td', h('article.sh-task', h('h2.sh-h2', 'Задача ' + t.id), taskNode(t.html), h('div.sh-sol', h('span.sh-solh', 'Решение'), ...Array.from({ length: 4 }, () => h('i.sh-sl'))))))));
  return page(run(meta, 'рабочий лист, тема ' + tp.n), rows, 'sh-work');
}
