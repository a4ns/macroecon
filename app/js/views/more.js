/* ─────────────────────────────────────────────────────────────
   «Ещё» — #/more : витрина документов (СРО, приложение, источники, об учебнике)
   (#/more/:page рисует doc.js; на случай прямого вызова — делегируем ему)
   ───────────────────────────────────────────────────────────── */
import { h, $, loadCSS, plural } from '../core/dom.js';
import { index, docs, glossary } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { rub } from '../data/topics.js';
import { nb, ARROW } from './_typo.js';
import * as doc from './doc.js';

export async function load(ctx) {
  if (ctx.params && ctx.params.page) return { delegate: true, data: await doc.load(ctx) };
  await loadCSS('app/css/v-more.css');
  const [ix, d, gl] = await Promise.all([index(), docs(), glossary()]);
  return { ix, d, gl };
}

/* a little stack of paper sheets for every document */
const SHEETS = {
  sro: '<rect x="30" y="22" width="14" height="14" rx="4" class="mc__bx"/><path d="m33 29 3 3 5-6" class="mc__ck"/><path d="M52 29h60" /><rect x="30" y="50" width="14" height="14" rx="4" class="mc__bx"/><path d="M52 57h46"/><rect x="30" y="78" width="14" height="14" rx="4" class="mc__bx"/><path d="M52 85h54"/><rect x="30" y="106" width="14" height="14" rx="4" class="mc__bx"/><path d="M52 113h38"/>',
  appendix: '<path d="M32 30h72M32 48h50"/><path d="M32 84c12 0 14-26 26-26s14 26 26 26 12-18 24-18" class="mc__wave"/><path d="M32 112h80" stroke-dasharray="3 5"/><path d="M32 66h0"/>',
  sources: '<rect x="30" y="26" width="22" height="18" rx="4" class="mc__bx"/><path d="M60 31h52M60 40h34"/><rect x="30" y="58" width="22" height="18" rx="4" class="mc__bx"/><path d="M60 63h52M60 72h40"/><rect x="30" y="90" width="22" height="18" rx="4" class="mc__bx"/><path d="M60 95h52M60 104h28"/>',
  about: '<circle cx="46" cy="42" r="12"/><path d="M26 82c4-14 14-18 20-18s16 4 20 18"/><path d="M82 34h36M82 50h26M82 70h36M82 86h30M82 102h36"/>',
};

export function mount(el, ctx, data) {
  if (data && data.delegate) return doc.mount(el, ctx, data.data);
  const { ix, d, gl } = data;
  const nTasks = ix.topics.reduce((a, t) => a + (t.tasks || []).length, 0);
  const done = (store.get('more.sro', []) || []).length;
  const info = {
    sro: [d.sro.length + ' ' + plural(d.sro.length, ['задание', 'задания', 'заданий']), done ? 'выполнено ' + done : 'для самостоятельной работы'],
    appendix: [d.appendix.length + ' ' + plural(d.appendix.length, ['приложение', 'приложения', 'приложений']), 'с формулами'],
    sources: [d.sources.length + ' ' + plural(d.sources.length, ['источник', 'источника', 'источников']), '+ ресурс в сети'],
    about: ['2018', 'СКГУ им. М. Козыбаева'],
  };
  const cards = doc.PAGES.map((p, i) => h('a.card.mc.rv', { href: '#/more/' + p.id, style: { '--c': 'var(--' + p.c + ')', '--d': i * .08 + 's' }, 'aria-label': p.full },
    h('div.mc__art', { 'aria-hidden': 'true' },
      h('span.mc__sheet.mc__s3'), h('span.mc__sheet.mc__s2'),
      h('span.mc__sheet.mc__s1', h('svg', { viewBox: '0 0 144 144', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: SHEETS[p.id] })),
      h('b.mc__glyph.display', p.glyph)),
    h('div.mc__body',
      h('p.mc__k.mono', 'Документ ' + rub(p.n)),
      h('h2.mc__t', p.full),
      h('p.mc__p', nb(p.blurb)),
      h('div.mc__m', ...info[p.id].map((t) => h('span.chip', t)))),
    h('span.mc__go', 'Открыть', h('i', { html: ARROW }))));

  el.append(h('div.more.wrap',
    h('header.more__head',
      h('p.eyebrow.eyebrow--dot.rv', 'Раздел'),
      h('h1.display.more__t.rv', { style: { '--d': '.05s' }, html: 'Ещё <span class="more__t2">всё остальное</span>' }),
      h('p.lede.more__lede.rv', { style: { '--d': '.1s' } }, nb('Самостоятельная работа, приложения к упражнениям, список литературы и титульные сведения об издании — оформлены как документы с оглавлением.'))),
    h('div.more__grid', ...cards),
    h('section.more__links.rv',
      h('p.eyebrow', 'Рядом'),
      h('div.more__row',
        h('a.more__l', { href: '#/glossary' }, h('b', 'Глоссарий'), h('span', gl.length + ' ' + plural(gl.length, ['термин', 'термина', 'терминов'])), h('i', { html: ARROW })),
        h('a.more__l', { href: '#/tasks' }, h('b', 'Задачи'), h('span', nTasks + ' ' + plural(nTasks, ['задача', 'задачи', 'задач']) + ' с проверкой'), h('i', { html: ARROW })),
        h('a.more__l', { href: '#/lab' }, h('b', 'Лаборатория'), h('span', ix.labList.length + ' ' + plural(ix.labList.length, ['модель', 'модели', 'моделей'])), h('i', { html: ARROW }))))));
  const clean = enhance(el);
  return { title: 'Ещё', destroy() { clean && clean(); } };
}
