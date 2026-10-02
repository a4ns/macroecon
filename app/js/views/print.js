/* Печатные листы — #/print/:kind[/:arg]
   variant[/N|all]?seed=…  вариант с бланком · key?seed=…  ключ · blank[/N|all]?seed=…  бланк ответов
   cards[?sets=N]  карточки А–Д · worksheet/:topic  рабочий лист темы
   Данные для variant/key/blank берутся из тех же параметров запроса, что и у генератора (views/variants.js). */
import { h, loadCSS } from '../core/dom.js';
import { bank as loadBank } from '../core/qid.js';
import { ctx as planCtx } from '../core/plan.js';
import { S } from '../core/state.js';
import { parseParams, buildVariants, variantHash } from './variants.js';
import { variantPage, blankPage, keyPage, cardPages, worksheetPage, maxOpts } from '../ui/sheet.js';

const KINDS = { variant: 'Варианты', key: 'Ключ', blank: 'Бланк ответов', cards: 'Карточки А–Д', worksheet: 'Рабочий лист' };

export async function load(ctx) {
  const kind = ctx.params.kind;
  if (!KINDS[kind]) throw new Error('Неизвестный лист: ' + kind);
  await Promise.all([loadCSS('app/css/v-teach.css'), loadCSS('app/css/v-print.css')]);
  const c = await planCtx();
  let tasks = c.tasks;
  if (kind === 'worksheet') {
    try { const { PATCH } = await import('./tasks.js'); tasks = tasks.map((t) => (PATCH && PATCH[t.id] ? { ...t, html: PATCH[t.id](t.html) } : t)); } catch (e) { /* без заплаток: поля ввода всё равно заменяются */ }
  }
  return { c, tasks };
}

function paramsOf(ctx, bank) {
  const a = ctx.params.arg || '';
  let q = ctx.query;
  if (a.startsWith('{')) { try { q = { ...JSON.parse(a) }; } catch (e) { /* */ } }
  return parseParams(q, bank, S.data.set.rk || [7, 14]);
}
const pick = (arg, n) => { const v = parseInt(arg, 10); return v >= 1 && v <= n ? [v] : null; };

export function mount(el, ctx, { c, tasks }) {
  const kind = ctx.params.kind, bank = c.bank;
  document.documentElement.classList.add('print-view');
  const sheets = h('div.sh-sheets');
  let title = KINDS[kind], sub = '', warn = null, back = '#/teach';

  if (kind === 'cards') {
    const sets = Math.min(10, Math.max(1, parseInt(ctx.query.sets, 10) || 1));
    sheets.append(...cardPages(sets));
    sub = 'Две страницы A4 — комплект из 7 карточек: А, Б, В, Г, Д, «Верно», «Неверно». Вырежьте по пунктирным линиям. Для группы из 25 человек печатайте столько комплектов, сколько нужно.';
    title = 'Карточки для голосования';
  } else if (kind === 'worksheet') {
    const n = parseInt(ctx.params.arg, 10), tp = c.ix.byTopic.get(n);
    if (!tp) { sheets.append(h('p.sh-miss', 'Укажите тему: #/print/worksheet/5')); }
    else {
      const list = tasks.filter((t) => t.topic === n);
      if (!list.length) sheets.append(h('p.sh-miss', 'В теме ' + n + ' нет задач.'));
      else sheets.append(worksheetPage(tp, list, { title: 'Макроэкономика' }));
      sub = `Тема ${n}: ${list.length} задач без решений. Вместо полей ввода — линии, под каждой задачей место для решения.`;
    }
    title = 'Рабочий лист · тема ' + (n || '');
  } else {
    const p = paramsOf(ctx, bank), res = buildVariants(bank, p), meta = { seed: p.seed, bk: bank.bk };
    const nOpts = maxOpts(res.variants);
    back = variantHash(p, bank);
    if (ctx.query.bk && ctx.query.bk !== bank.bk) warn = 'Банк вопросов изменился с момента создания набора: вопросы могут отличаться от напечатанных раньше.';
    if (!res.k) sheets.append(h('p.sh-miss', 'Нет вопросов для печати. Выберите темы в генераторе.'));
    else if (kind === 'key') { sheets.append(keyPage(res.variants, meta)); sub = `Ключ ко всем ${res.variants.length} вариантам на одном листе. Зерно ${p.seed}.`; }
    else {
      const one = pick(ctx.params.arg, res.variants.length), vs = one ? res.variants.filter((v) => v.no === one[0]) : res.variants;
      if (kind === 'variant') { vs.forEach((v) => sheets.append(variantPage(v, meta, nOpts))); sub = `${vs.length === 1 ? 'Вариант ' + vs[0].no : vs.length + ' вариантов, каждый с новой страницы'}; бланк ответов — в конце каждого варианта. Зерно ${p.seed}.`; }
      else { vs.forEach((v) => sheets.append(blankPage(v, meta, nOpts, res.k))); sub = `Бланки на ${res.k} вопросов, по странице на вариант.`; }
    }
  }

  const bar = h('header.sh-bar.wrap',
    h('nav.crumbs', h('a', { href: '#/teach' }, 'Преподавателю'), h('i', '/'), h('span', 'Печать')),
    h('div.sh-bar__r',
      h('div', h('h1.h3', title), sub ? h('p.sh-bar__s', sub) : null),
      h('div.sh-bar__a', h('button.btn.btn--primary', { type: 'button', onclick: () => window.print() }, 'Печать'), kind === 'cards' || kind === 'worksheet' ? null : h('a.btn', { href: back }, 'К генератору'))),
    warn ? h('aside.co.co--warn', h('strong.co__t', warn)) : null,
    h('p.sh-bar__t', 'В окне печати выберите A4, масштаб 100 %, отключите «Колонтитулы» браузера. Печать чёрно-белая — цвет не нужен.'));
  el.append(h('div.sh-view', bar, sheets));
  return { title: 'Печать · ' + title, destroy() { document.documentElement.classList.remove('print-view'); } };
}
