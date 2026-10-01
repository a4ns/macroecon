/* ─────────────────────────────────────────────────────────────
   Упражнение 2.1 — Система национальных счетов (Республика Казахстан, 2014–2016)

   Семь основных счетов СНС в виде Т-образных таблиц «Использование | Ресурсы»:
   производства · товаров и услуг · образования доходов · первичного распределения ·
   вторичного распределения · использования располагаемого дохода · операций с капиталом.
   Балансирующая статья каждого счёта находится как разность итогов и переходит в следующий счёт:
   ВВП → ВНД → ВНДР → валовое сбережение → чистое кредитование.

   Исходные данные — оригинальные таблицы упражнения (млн тенге). В оригинале три опечатки
   в итогах/статьях (см. комментарии у данных); здесь итоги и балансирующие статьи
   считаются из составляющих, поэтому счета сходятся.
   ───────────────────────────────────────────────────────────── */
import { h, fmt as nfmt, plural, reduced } from '../core/dom.js';
/* ru-форматирование с настоящим минусом «−» */
const fmt = (n, d = 0) => nfmt(n, d).replace(/-/g, '\u2212');
import { createChart } from '../ui/plot.js';
import { simLayout, panel, seg, toggle, stat, presets, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

/* ── исходные данные, млн тенге; индекс = год − 2014 ───────────── */
const YEARS = [2014, 2015, 2016];
const RAW = {
  Z:   [61860129.6, 63958086.2, 74731304.6],   // выпуск товаров и услуг в основных ценах
  IC:  [25208557.4, 25174185.8, 30393719.1],   // промежуточное потребление
  TP:  [3140575.7, 2223043.8, 2777016.3],      // налоги на продукты и импорт
  SP:  [116315.0, 122810.6, 143451.8],         // субсидии на продукты и импорт
  OT:  [457556.1, 462548.8, 688707.4],         // другие налоги на производство
  C:   [23477055.5, 26718002.2, 31083238.5],   // расходы на конечное потребление
  HH:  [18805873.9, 21491895.4, 25087440.1],   //   домашних хозяйств
  GV:  [4241218.1, 4755939.3, 5463145.6],      //   государственного сектора
  NP:  [429963.5, 470167.5, 532652.8],         //   некоммерческих организаций
  K:   [8552487.1, 9354911.6, 10671499.7],     // валовое накопление основного капитала
  INV: [1680008.3, 2054997.9, 2399436.0],      // изменение запасов материальных оборотных средств
  X:   [15609170.2, 11658809.0, 14957440.7],   // экспорт
  M:   [10169025.7, 10030113.0, 13371609.8],   // импорт
  SD:  [526137.5, 1127525.9, 1231144.9],       // статистическое расхождение (2016: .9 — как в диалоге, в таблице .8)
  W:   [12474013.6, 13161352.4, 14253989.5],   // оплата труда наёмных работников (произведённая)
  GOS: [23720002.5, 25159999.2, 29394888.6],   // валовая прибыль и валовые смешанные доходы
  WR:  [12152611.2, 12793951.4, 13808818.9],   // оплата труда, полученная резидентами
  PO:  [10937851.8, 13450060.8, 12147213.5],   // доходы от собственности, переданные «остальному миру»
  PI:  [7202601.2, 11369866.4, 8166340.3],     // …полученные «от остального мира»
  FISIM: [0, 0, 0],                            // корректировка на услуги финансовых посредников
  TO:  [8866430.0, 6835584.0, 11116410.3],     // текущие трансферты переданные
  TI:  [8561520.7, 6514464.6, 10981717.5],     // текущие трансферты полученные
  PEN: [320331.1, 874877.0, 527845.5],         // корректировка на изменение чистой стоимости средств ДХ в пенсионных фондах
  KRo: [0, 0, 136604.2], KRw: [6419.4, 36361.4, 95455.5],     // капитальные трансферты полученные: от других секторов / от остального мира
  KPo: [0, 0, 136604.2], KPw: [1268.0, 1791.7, 3754.2],       // …уплаченные: другим секторам / остальному миру
};
/* Опечатки оригинала: в счёте первичного распределения за 2014 итоги указаны 46 557 301,7 (верно 46 557 031,7);
   за 2015 субсидии указаны 122 910,6 (верно 122 810,6, как в счетах производства и образования доходов). */

const SHORT = [
  { n: 'Производства', b: 'ВВП' },
  { n: 'Товаров и услуг', b: 'Стат. расхождение' },
  { n: 'Образования доходов', b: 'Валовая прибыль' },
  { n: 'Первичного распределения', b: 'ВНД' },
  { n: 'Вторичного распределения', b: 'ВНДР' },
  { n: 'Использования дохода', b: 'Валовое сбережение' },
  { n: 'Операций с капиталом', b: 'Чистое кредитование' },
];

/* ── модель: счета как функции года ────────────────────────────── */
const R = (k, i) => RAW[k][i];
const r1 = (x) => Math.round(x * 10) / 10;
const row = (l, v, o = {}) => ({ l, v, ...o });

function buildAccounts(i) {
  const r = (k) => R(k, i);
  const taxes = r('TP') + r('OT');
  const A = [];
  A.push({
    id: 'a', title: 'Счёт производства', bal: 'ВВП',
    uses: [row('Промежуточное потребление', r('IC')), row('Валовой внутренний продукт', null, { bal: true, sym: 'ВВП' })],
    res: [row('Выпуск товаров и услуг в основных ценах', r('Z')), row('Налоги на продукты и импорт', r('TP')), row('Субсидии на продукты и импорт (−)', r('SP'), { neg: true })],
    what: 'Показывает, сколько новой стоимости создано в экономике: выпуск за вычетом промежуточного потребления плюс налоги на продукты без субсидий. Это ВВП производственным методом.',
  });
  A.push({
    id: 'b', title: 'Счёт товаров и услуг', bal: 'Статистическое расхождение',
    uses: [row('Промежуточное потребление', r('IC')), row('Расходы на конечное потребление', r('C')),
      row('домашних хозяйств', r('HH'), { sub: true }), row('государственного сектора', r('GV'), { sub: true }), row('некоммерческих организаций', r('NP'), { sub: true }),
      row('Валовое накопление основного капитала', r('K')), row('Изменение запасов материальных оборотных средств', r('INV')), row('Экспорт товаров и услуг', r('X')),
      row('Статистическое расхождение', null, { bal: true })],
    res: [row('Выпуск товаров и услуг в основных ценах', r('Z')), row('Налоги на продукты и импорт', r('TP')), row('Субсидии на продукты и импорт (−)', r('SP'), { neg: true }), row('Импорт', r('M'))],
    what: 'Баланс ресурсов товаров и услуг (выпуск, налоги, импорт) и их использования (потребление, накопление, экспорт). Статистическое расхождение — «невязка» разных источников данных.',
  });
  A.push({
    id: 'c', title: 'Счёт образования доходов', bal: 'Валовая прибыль и смешанные доходы',
    uses: [row('Оплата труда наёмных работников', r('W')), row('Налоги на производство и импорт, выплаченные', taxes),
      row('налоги на продукты и импорт', r('TP'), { sub: true }), row('другие налоги на производство', r('OT'), { sub: true }),
      row('Субсидии на производство и импорт (−)', r('SP'), { neg: true }), row('Валовая прибыль и валовые смешанные доходы', null, { bal: true })],
    res: [row('Валовой внутренний продукт', r('Z') + r('TP') - r('SP') - r('IC'))],
    what: 'Показывает, как созданный ВВП распределяется между трудом (оплата труда), государством (налоги за вычетом субсидий) и капиталом (валовая прибыль и смешанные доходы).',
  });
  A.push({
    id: 'd', title: 'Счёт распределения первичных доходов', bal: 'ВНД',
    uses: [row('Доходы от собственности, переданные «остальному миру»', r('PO')), row('Валовой национальный доход', null, { bal: true, sym: 'ВНД' })],
    res: [row('Валовая прибыль и валовые смешанные доходы', r('GOS')), row('Оплата труда', r('WR')), row('Налоги на производство и импорт, выплаченные', taxes),
      row('Субсидии на производство и импорт (−)', r('SP'), { neg: true }), row('Доходы от собственности, полученные «от остального мира»', r('PI')),
      row('Корректировка на условно исчисленную оплату услуг финансовых посредников', r('FISIM'))],
    what: 'Первичные доходы резидентов: от ВВП переходим к доходам, которые получают граждане и фирмы страны, где бы они ни работали — прибавляем доходы из-за рубежа и вычитаем переданные за рубеж. Получается ВНД.',
  });
  A.push({
    id: 'e', title: 'Счёт вторичного распределения доходов', bal: 'ВНДР',
    uses: [row('Текущие трансферты, переданные другим секторам и «остальному миру»', r('TO')), row('Валовой располагаемый доход', null, { bal: true, sym: 'ВНДР' })],
    res: [row('Валовой национальный доход', null, { link: 'gni' }), row('Текущие трансферты, полученные от других секторов и от «остального мира»', r('TI'))],
    what: 'Перераспределение через текущие трансферты (налоги на доходы, взносы, пособия, помощь) превращает ВНД в валовой располагаемый доход — то, чем страна реально может распорядиться.',
  });
  A.push({
    id: 'f', title: 'Счёт использования располагаемого дохода', bal: 'Валовое сбережение',
    uses: [row('Расходы на конечное потребление', r('C')), row('домашних хозяйств', r('HH'), { sub: true }), row('государственного сектора', r('GV'), { sub: true }), row('некоммерческих организаций', r('NP'), { sub: true }),
      row('Валовое сбережение', null, { bal: true, sym: 'S' }), row('Корректировка на изменение чистой стоимости средств домашних хозяйств в пенсионных фондах', r('PEN'))],
    res: [row('Валовой располагаемый доход', null, { link: 'gndi' }), row('Корректировка на изменение чистой стоимости средств домашних хозяйств в пенсионных фондах', r('PEN'))],
    what: 'Располагаемый доход делится на две части: конечное потребление и сбережение. Сбережение — то, что не потрачено на потребление, и источник будущего накопления.',
  });
  A.push({
    id: 'g', title: 'Счёт операций с капиталом', bal: 'Чистое кредитование (+) / заимствование (−)',
    uses: [row('Валовое накопление основного капитала', r('K')), row('Изменение запасов материальных оборотных средств', r('INV')),
      row('Чистое приобретение ценностей, земли и непроизведённых активов', 0), row('ценностей', 0, { sub: true }), row('земли', 0, { sub: true }), row('непроизведённых нефинансовых активов', 0, { sub: true }),
      row('Чистое кредитование (+) или чистое заимствование (−)', null, { bal: true, sym: 'NL' }), row('Статистическое расхождение', r('SD'))],
    res: [row('Валовое сбережение', null, { link: 'sav' }), row('Капитальные трансферты, полученные', r('KRo') + r('KRw')),
      row('от других секторов', r('KRo'), { sub: true }), row('от «остального мира»', r('KRw'), { sub: true }),
      row('Капитальные трансферты, уплаченные (−)', r('KPo') + r('KPw'), { neg: true }),
      row('другим секторам', r('KPo'), { sub: true }), row('«остальному миру»', r('KPw'), { sub: true })],
    what: 'Сбережение плюс чистые капитальные трансферты финансируют накопление капитала. Остаток — чистое кредитование (страна даёт в долг остальному миру) или чистое заимствование (берёт в долг).',
  });
  return A;
}

/* суммирует строки стороны (под-строки «в том числе» не считаются; (−) вычитаются) */
const sideSum = (rows) => rows.reduce((s, x) => s + (x.sub || x.v == null ? 0 : x.neg ? -x.v : x.v), 0);

/** решает цепочку счетов: подставляет значения балансирующих статей и связей между счетами */
function solve(i) {
  const A = buildAccounts(i);
  const out = { gdp: 0, gni: 0, gndi: 0, sav: 0, nl: 0 };
  const links = () => ({ gni: out.gni, gndi: out.gndi, sav: out.sav });
  const keys = { a: 'gdp', c: null, d: 'gni', e: 'gndi', f: 'sav', g: 'nl' };
  A.forEach((acc) => {
    const lk = links();
    [...acc.uses, ...acc.res].forEach((x) => { if (x.link) x.v = lk[x.link]; });
    const balRow = [...acc.uses, ...acc.res].find((x) => x.bal);
    const onUses = acc.uses.includes(balRow);
    const other = sideSum(onUses ? acc.res : acc.uses);
    const mine = sideSum((onUses ? acc.uses : acc.res).filter((x) => !x.bal));
    balRow.v = r1(other - mine);
    acc.balRow = balRow; acc.balSide = onUses ? 'u' : 'r';
    acc.totU = r1(sideSum(acc.uses)); acc.totR = r1(sideSum(acc.res));
    if (keys[acc.id]) out[keys[acc.id]] = balRow.v;
    // чистое приобретение ценностей и т. п. не зависит от года; пересчёт ГВП по счёту образования доходов — у счёта c
  });
  out.gcf = R('K', i) + R('INV', i);
  out.cons = R('C', i);
  out.accounts = A;
  return out;
}
const SOL = YEARS.map((_, i) => solve(i));

/* ── интерфейс ─────────────────────────────────────────────────── */
const f1 = (v) => fmt(v, 1);
const sg = (v, d = 1) => (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + fmt(Math.abs(v), d);
const parseRu = (t) => parseFloat(String(t).replace(/[\s  ]/g, '').replace(/[−–—]/g, '-').replace(',', '.'));
const SYM = (s) => symHTML(s);

export function mount(root, env) {
  root.classList.add('sim--ex2-1');
  const L = simLayout(root);
  const D = { yi: 2, ai: 0 };
  let yi = D.yi, ai = D.ai, quiz = false, cmp = null, solved = false;
  const rafs = new Set();

  /* ── управление ── */
  const yearSeg = seg({ label: 'Год', options: YEARS.map((y, i) => ({ v: i, label: String(y) })), value: yi });
  const yearSeg2 = seg({ options: YEARS.map((y, i) => ({ v: i, label: String(y) })), value: yi, label: 'Год' });
  const quizTg = toggle({ label: 'Проверь себя', hint: 'скрыть балансирующую статью — найдите её сами', color: 'var(--d4)', value: false });
  const acctList = h('div.ex21__list', { role: 'tablist', 'aria-label': 'Счета СНС' });
  const acctBtns = SHORT.map((s, k) => h('button.ex21__li', { type: 'button', role: 'tab', onclick: () => go(k) },
    h('i', String(k + 1)), h('span', 'Счёт ' + s.n.toLowerCase())));
  acctList.append(...acctBtns);

  const pre = presets([
    { label: 'ВВП: производство', color: 'var(--d1)', hint: 'ВВП = выпуск − промежуточное потребление + налоги на продукты − субсидии', apply: () => go(0) },
    { label: 'ВВП: использование', color: 'var(--d2)', hint: 'Сумма расходов на конечное потребление, накопление и чистого экспорта', apply: () => go(1) },
    { label: 'ВВП: доходы', color: 'var(--d5)', hint: 'Оплата труда + валовая прибыль + налоги − субсидии', apply: () => go(2) },
    { label: 'От ВВП к ВНД', color: 'var(--d3)', hint: 'Доходы от собственности и труда из-за рубежа', apply: () => go(3) },
    { label: 'От ВНД к ВНДР', color: 'var(--d4)', hint: 'Текущие трансферты', apply: () => go(4) },
    { label: 'Сбережение и кредитование', color: 'var(--d6)', hint: 'Сколько страна копит и сколько одалживает миру', apply: () => go(6) },
    { label: 'Рост 2015 → 2016', color: 'var(--ink-3)', hint: 'Сравнить показатели двух лет', apply: () => { cmp = 1; setYear(2); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии' });

  L.controls.append(
    panel({ title: 'Данные' }, h('div.ex21__ysel', yearSeg.el), h('p.ex21__src', nb('Данные Комитета по статистике, млн тенге, в текущих ценах.'))),
    panel({ title: 'Счета' }, acctList),
    panel({ title: 'Режим' }, quizTg.el),
    panel({ title: 'Что рассмотреть' }, pre));

  /* ── показатели ── */
  const S = {
    gdp: stat({ label: 'Валовой внутренний продукт', sym: 'ВВП', unit: 'млрд ₸', dec: 1, color: 'var(--accent)' }),
    gni: stat({ label: 'Валовой национальный доход', sym: 'ВНД', unit: 'млрд ₸', dec: 1, color: 'var(--d5)' }),
    gndi: stat({ label: 'Валовой располагаемый доход', sym: 'ВНДР', unit: 'млрд ₸', dec: 1, color: 'var(--d4)' }),
    cons: stat({ label: 'Конечное потребление', unit: 'млрд ₸', dec: 1, color: 'var(--d2)' }),
    gcf: stat({ label: 'Валовое накопление', unit: 'млрд ₸', dec: 1, color: 'var(--d6)' }),
    sav: stat({ label: 'Валовое сбережение', unit: 'млрд ₸', dec: 1, color: 'var(--d1)' }),
    nl: stat({ label: 'Чистое кредитование (+) / заимствование (−)', unit: 'млрд ₸', dec: 1, color: 'var(--d3)' }),
  };
  L.stats.append(...Object.values(S).map((x) => x.el));

  /* ── сцена: выбор года (телефон) + цепочка счетов ── */
  const chain = h('ol.ex21__chain');
  const nodes = SHORT.map((s, k) => {
    const v = h('b.ex21__cv');
    const el = h('li.ex21__node', h('button', { type: 'button', 'aria-label': 'Счёт ' + s.n.toLowerCase(), onclick: () => go(k) },
      h('i.ex21__no', String(k + 1)), h('span.ex21__nn', nb(s.n)), h('span.ex21__nb', s.b), v));
    chain.append(el);
    return { el, v, btn: el.firstChild };
  });
  const bar = h('div.ex21__bar', h('div.ex21__yr', yearSeg2.el), chain);

  /* ── Т-счёт ── */
  const taHead = h('h3.ex21__ttl');
  const taWhat = h('p.ex21__what');
  const colU = h('ul.ex21__rows'), colR = h('ul.ex21__rows');
  const totU = h('b.ex21__tn'), totR = h('b.ex21__tn');
  const sideU = h('section.ex21__side', h('h4', 'Использование'), colU, h('div.ex21__tot', h('span', 'Итого использовано'), totU));
  const sideR = h('section.ex21__side', h('h4', 'Ресурсы'), colR, h('div.ex21__tot', h('span', 'Итого ресурсов'), totR));
  const verdict = h('p.ex21__verdict', { 'aria-live': 'polite' });
  const ta = h('div.ex21__ta', h('div.ex21__cols', sideU, sideR), verdict);
  const taFig = figure('Т-счёт · использование и ресурсы', h('div.ex21__fig', h('div.ex21__top', taHead, h('span.ex21__unit', 'млн тенге')), taWhat, ta));

  /* ── три метода ВВП ── */
  const methods = h('div.ex21__meth');
  const methFig = figure('Один ВВП — три способа счёта', methods, { note: 'Производственный, расходный и распределительный методы дают один и тот же ВВП: так проверяют согласованность счетов.' });

  /* ── график ── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: 2013.6, max: 2016.45, ticks: YEARS, fmt: (v) => String(v), label: 'год', grid: true },
    y: { min: 0, max: 50, ticks: [0, 10, 20, 30, 40, 50], label: 'трлн тенге' },
    aspect: 1.7, maxH: 360, margin: { l: 46, r: 62, t: 30, b: 42 }, title: 'Динамика основных показателей СНС, трлн тенге',
  });
  const SER = [
    { id: 'gdp', label: 'ВВП', color: 'var(--accent)', val: (i) => SOL[i].gdp },
    { id: 'gni', label: 'ВНД', color: 'var(--d5)', val: (i) => SOL[i].gni },
    { id: 'cons', label: 'C', color: 'var(--d2)', val: (i) => SOL[i].cons },
    { id: 'gcf', label: 'I', color: 'var(--d6)', val: (i) => SOL[i].gcf },
  ];
  SER.forEach((s) => {
    chart.line(s.id, { pts: YEARS.map((y, i) => [y, s.val(i) / 1e6]), color: s.color, width: 3, label: s.label, labelAt: 1, labelDx: 10, labelDy: 4, ghost: false });
    chart.point(s.id + 'p', { x: () => YEARS[yi], y: () => s.val(yi) / 1e6, color: s.color, r: 6 });
  });
  chart.vline('yr', { x: () => YEARS[yi], color: 'var(--ink-3)', dash: '3 5', width: 1.2 });
  const chFig = figure('Динамика 2014–2016', host, { note: 'Точки — выбранный год. C — конечное потребление, I — валовое накопление (основной капитал и запасы).' });

  L.stage.append(bar, taFig, methFig, chFig);
  L.stage.append(legend([{ color: 'var(--accent)', label: 'ВВП' }, { color: 'var(--d5)', label: 'ВНД' }, { color: 'var(--d2)', label: 'C — потребление' }, { color: 'var(--d6)', label: 'I — накопление' }]));

  /* ── заметки: расчёт, таблица ── */
  const expl = callout({ tone: 'info', title: 'Как найдена балансирующая статья' });
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель' }, { key: 'a', label: 'База', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }, { key: 'p', label: '%', num: true }] });
  const cmpNote = h('p.ex21__cmp');
  L.notes.append(expl, cmpNote, tbl.el);

  /* ── числа с «прокруткой» ── */
  function roll(node, to) {
    const from = node._v; node._v = to;
    cancelAnimationFrame(node._raf); rafs.delete(node._raf);
    if (from == null || reduced() || Math.abs(from - to) < 0.05) { node.textContent = f1(to); return; }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - p, 3);
      node.textContent = f1(from + (to - from) * e);
      if (p < 1) { node._raf = requestAnimationFrame(tick); rafs.add(node._raf); } else node.textContent = f1(to);
    };
    node._raf = requestAnimationFrame(tick); rafs.add(node._raf);
  }

  /* ── построение строк счёта ── */
  let cells = [];
  let inputEl = null, balNum = null;
  function buildRows() {
    cells = []; colU.textContent = ''; colR.textContent = '';
    const acc = SOL[yi].accounts[ai];
    const mk = (x, side) => {
      const num = h('b.ex21__n');
      const li = h('li.ex21__r', { class: [x.sub ? 'is-sub' : '', x.neg ? 'is-neg' : '', x.bal ? 'is-bal' : ''].join(' ').trim() },
        h('span.ex21__l', x.l, x.bal ? h('em.ex21__tag', 'балансирующая статья') : null), num);
      if (x.bal) {
        const inp = h('input.ans.ex21__in', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', placeholder: 'ваш расчёт', 'aria-label': 'Ваш расчёт балансирующей статьи: ' + x.l });
        inp.addEventListener('input', onAnswer);
        li.append(inp); inputEl = inp; balNum = num; li._bal = true;
      }
      cells.push({ x, num, li });
      return li;
    };
    inputEl = null; balNum = null;
    acc.uses.forEach((x) => colU.append(mk(x, 'u')));
    acc.res.forEach((x) => colR.append(mk(x, 'r')));
    // ключ для анимации появления
    [...colU.children, ...colR.children].forEach((li, n) => { li.style.setProperty('--n', n); });
    ta.classList.remove('is-in'); void ta.offsetWidth; ta.classList.add('is-in');
  }

  function onAnswer() {
    const acc = SOL[yi].accounts[ai];
    const v = parseRu(inputEl.value);
    const fb = verdict;
    if (!inputEl.value.trim() || !Number.isFinite(v)) { inputEl.classList.remove('is-ok', 'is-bad'); fb.textContent = ''; fb.className = 'ex21__verdict'; return; }
    const d = v - acc.balRow.v;
    if (Math.abs(d) <= 0.06) { solved = true; inputEl.classList.remove('is-bad'); inputEl.classList.add('is-ok'); updateRows(); }
    else {
      inputEl.classList.remove('is-ok'); inputEl.classList.add('is-bad');
      fb.className = 'ex21__verdict is-bad';
      fb.textContent = nb(`Пока не сходится: ваш ответ ${d > 0 ? 'больше' : 'меньше'} нужного на ${f1(Math.abs(d))}. Балансирующая статья = итог противоположной стороны − остальные статьи своей стороны.`);
    }
  }

  function updateRows() {
    const acc = SOL[yi].accounts[ai];
    const hide = quiz && !solved;
    cells.forEach(({ x, num, li }) => {
      if (x.bal) { li.classList.toggle('is-ask', hide); li.classList.toggle('is-solved', quiz && solved); }
      if (x.bal && hide) { num.hidden = true; num._v = null; return; }
      num.hidden = false; roll(num, x.v);
    });
    const balSide = acc.balSide;
    const showTot = (side) => !(hide && side === balSide);
    [['u', totU, acc.totU], ['r', totR, acc.totR]].forEach(([side, el, v]) => {
      if (showTot(side)) { el.classList.remove('is-q'); roll(el, v); } else { el.classList.add('is-q'); el._v = null; el.textContent = '?'; }
    });
    sideU.classList.toggle('is-bals', balSide === 'u'); sideR.classList.toggle('is-bals', balSide === 'r');
    if (hide) {
      if (!inputEl.value.trim()) { verdict.className = 'ex21__verdict'; verdict.textContent = nb(`Найдите «${acc.bal}»: итог ${balSide === 'u' ? 'ресурсов' : 'использования'} известен, вычтите из него остальные статьи.`); }
    } else {
      const ok = Math.abs(acc.totU - acc.totR) < 0.06;
      verdict.className = 'ex21__verdict ' + (ok ? 'is-ok' : 'is-bad');
      verdict.textContent = ok ? nb(`Счёт сходится: итого использовано = итого ресурсов = ${f1(acc.totU)}.`) : 'Счёт не сходится.';
      if (quiz && solved) verdict.textContent = nb('Верно. ' + verdict.textContent);
    }
  }

  /* ── пояснение «как получено» ── */
  function explain() {
    const s = SOL[yi], A = s.accounts, a = A[ai], r = (k) => R(k, yi);
    const n = (v) => `<b>${f1(v)}</b>`, p = (v) => `<i class="ex21__num">${f1(v)}</i>`;
    let html = '', txt = '';
    switch (a.id) {
      case 'a':
        html = `${SYM('ВВП')} = Выпуск + Налоги на продукты − Субсидии − Промежуточное потребление = ${p(r('Z'))} + ${p(r('TP'))} − ${p(r('SP'))} − ${p(r('IC'))} = ${n(s.gdp)}`;
        txt = `Экономика создала ${f1(s.gdp)} млн ₸ новой стоимости. Рост к ${yi ? YEARS[yi - 1] : '—'}: ${yi ? sg((s.gdp / SOL[yi - 1].gdp - 1) * 100) + ' %' : 'нет базы для сравнения'} (в текущих ценах — это номинальный рост, инфляция не вычтена).`; break;
      case 'b': {
        const used = r('IC') + r('C') + r('K') + r('INV') + r('X');
        html = `Статистическое расхождение = (Выпуск + Налоги − Субсидии + Импорт) − (Пром. потребление + Конечное потребление + Накопление ОК + Запасы + Экспорт) = (${p(r('Z') + r('TP') - r('SP') + r('M'))}) − (${p(used)}) = ${n(a.balRow.v)}`;
        txt = `Ресурсы и использование товаров и услуг сходятся с точностью до статистического расхождения — ${f1(a.balRow.v)} млн ₸, то есть ${fmt(a.balRow.v / s.gdp * 100, 1)} % ВВП.`; break; }
      case 'c':
        html = `Валовая прибыль и смешанные доходы = ВВП − Оплата труда − (Налоги на производство и импорт − Субсидии) = ${p(A[2].res[0].v)} − ${p(r('W'))} − (${p(r('TP') + r('OT'))} − ${p(r('SP'))}) = ${n(a.balRow.v)}`;
        txt = `На оплату труда приходится ${fmt(r('W') / s.gdp * 100, 1)} % ВВП, на валовую прибыль и смешанные доходы — ${fmt(a.balRow.v / s.gdp * 100, 1)} %, на налоги за вычетом субсидий — ${fmt((r('TP') + r('OT') - r('SP')) / s.gdp * 100, 1)} %.`; break;
      case 'd':
        html = `${SYM('ВНД')} = ВВП + (Оплата труда получ. − Оплата труда произв.) + Доходы от собств. получ. − Доходы от собств. перед. = ${p(s.gdp)} + (${p(r('WR'))} − ${p(r('W'))}) + ${p(r('PI'))} − ${p(r('PO'))} = ${n(s.gni)}`;
        txt = s.gni < s.gdp ? `ВНД меньше ВВП на ${f1(s.gdp - s.gni)}: резиденты отдают миру больше доходов от собственности (прибыль и проценты иностранных инвесторов), чем получают.` : `ВНД больше ВВП на ${f1(s.gni - s.gdp)}: страна получает из-за рубежа больше, чем отдаёт.`; break;
      case 'e':
        html = `${SYM('ВНДР')} = ВНД + Трансферты получ. − Трансферты перед. = ${p(s.gni)} + ${p(r('TI'))} − ${p(r('TO'))} = ${n(s.gndi)}`;
        txt = `Чистые текущие трансферты ${r('TI') - r('TO') < 0 ? 'уменьшают' : 'увеличивают'} доход на ${f1(Math.abs(r('TI') - r('TO')))} млн ₸: ВНДР ${s.gndi < s.gni ? 'меньше' : 'больше'} ВНД.`; break;
      case 'f':
        html = `${SYM('S')} = ВНДР − Конечное потребление = ${p(s.gndi)} − ${p(r('C'))} = ${n(s.sav)}`;
        txt = `Норма сбережения: ${fmt(s.sav / s.gndi * 100, 1)} % располагаемого дохода. Корректировка на пенсионные фонды стоит с обеих сторон счёта и в разность не входит.`; break;
      case 'g':
        html = `${SYM('NL')} = S + Капитальные трансферты получ. − уплач. − Накопление ОК − Запасы − Стат. расхождение = ${p(s.sav)} + ${p(r('KRo') + r('KRw'))} − ${p(r('KPo') + r('KPw'))} − ${p(r('K'))} − ${p(r('INV'))} − ${p(r('SD'))} = ${n(s.nl)}`;
        txt = s.nl >= 0 ? `Внутренних сбережений хватает на всё накопление, остаток ${f1(s.nl)} млн ₸ страна даёт в кредит остальному миру.` : `Сбережений не хватает на накопление капитала: разницу ${f1(-s.nl)} млн ₸ страна занимает у остального мира.`; break;
    }
    expl.querySelector('.co__t').textContent = a.title + ' — ' + YEARS[yi];
    expl.querySelector('.co__b').innerHTML = `<p>${nb(a.what)}</p><p class="ex21__f">${html}</p><p>${nb(txt)}</p>`;
  }

  /* ── три метода ── */
  function drawMethods() {
    const i = yi, r = (k) => R(k, i), gdp = SOL[i].gdp;
    const M = [
      { n: 'Производственный', f: 'ВДС + налоги на продукты − субсидии', segs: [['Валовая добавленная стоимость', r('Z') - r('IC'), 'var(--d1)'], ['Налоги на продукты и импорт − субсидии', r('TP') - r('SP'), 'var(--d3)']] },
      { n: 'Расходный', f: 'C + I + чистый экспорт + расхождение', segs: [['Конечное потребление', r('C'), 'var(--d2)'], ['Накопление основного капитала', r('K'), 'var(--d6)'], ['Изменение запасов', r('INV'), 'var(--d4)'], ['Чистый экспорт', r('X') - r('M'), 'var(--d5)'], ['Статистическое расхождение', r('SD'), 'var(--ink-3)']] },
      { n: 'Распределительный', f: 'оплата труда + прибыль + налоги − субсидии', segs: [['Оплата труда', r('W'), 'var(--d2)'], ['Валовая прибыль и смешанные доходы', r('GOS'), 'var(--d1)'], ['Налоги на производство и импорт − субсидии', r('TP') + r('OT') - r('SP'), 'var(--d3)']] },
    ];
    methods.textContent = '';
    M.forEach((m) => {
      const tot = m.segs.reduce((s, q) => s + q[1], 0);
      const bar = h('div.ex21__stack', { role: 'img', 'aria-label': m.n + ' метод: ' + f1(tot) });
      m.segs.forEach((q) => bar.append(h('i', { style: { '--g': Math.max(0.0001, q[1] / tot).toFixed(4), '--c': q[2] }, title: q[0] + ': ' + f1(q[1]) })));
      const lg = h('ul.ex21__mlg', ...m.segs.map((q) => h('li', { style: { '--c': q[2] } }, h('i'), h('span', q[0]), h('b', f1(q[1])), h('em', fmt(q[1] / tot * 100, 1) + ' %'))));
      const ok = Math.abs(tot - gdp) < 0.2;
      methods.append(h('div.ex21__m', h('div.ex21__mh', h('b', m.n + ' метод'), h('span', m.f), h('em', { class: ok ? 'is-ok' : 'is-bad' }, '= ' + f1(tot) + (ok ? ' ✓' : ''))), bar, lg));
    });
  }

  /* ── общий пересчёт ── */
  function render(rebuild) {
    const s = SOL[yi], acc = s.accounts[ai];
    if (rebuild) { solved = false; buildRows(); }
    taHead.textContent = acc.title + ' · ' + YEARS[yi] + ' г.';
    taWhat.textContent = nb(acc.what);
    updateRows();
    const bi = cmp != null ? cmp : (yi > 0 ? yi - 1 : null), b = bi != null ? SOL[bi] : null;
    Object.keys(S).forEach((k) => { S[k].set(s[k] / 1000); S[k].base(b ? b[k] / 1000 : null); });
    nodes.forEach((nd, k) => {
      nd.el.classList.toggle('is-on', k === ai); nd.btn.setAttribute('aria-current', k === ai ? 'step' : 'false');
      nd.v.textContent = f1(s.accounts[k].balRow.v);
      acctBtns[k].setAttribute('aria-selected', String(k === ai)); acctBtns[k].classList.toggle('is-on', k === ai);
    });
    // таблица «база / сейчас»
    const base = b || s;
    const th = tbl.el.querySelectorAll('th'); th[1].textContent = b ? String(YEARS[bi]) : '—'; th[2].textContent = String(YEARS[yi]);
    const rows = [['Валовой внутренний продукт, ВВП', 'gdp'], ['Валовой национальный доход, ВНД', 'gni'], ['Валовой располагаемый доход, ВНДР', 'gndi'], ['Конечное потребление', 'cons'], ['Валовое накопление', 'gcf'], ['Валовое сбережение', 'sav'], ['Чистое кредитование (+) / заимствование (−)', 'nl']];
    tbl.set(rows.map(([k, key]) => ({ k, a: b ? f1(base[key]) : '—', b: f1(s[key]), d: b ? sg(s[key] - base[key]) : '—', p: b && Math.abs(base[key]) > 1 ? sg((s[key] / base[key] - 1) * 100) : '—' })));
    cmpNote.textContent = b ? nb(`Изменения показаны относительно ${YEARS[bi]} года${cmp != null ? ' (выбрано кнопкой «Сравнить»)' : ' (предыдущий год)'}. Всё в текущих ценах, поэтому рост номинальный.`) : nb('Для 2014 года предыдущего года в данных нет — выберите другой год или нажмите «Сравнить».');
    explain(); drawMethods(); chart.update();
  }

  function go(k) { if (k === ai) return; ai = k; render(true); }
  function setYear(i) { yi = i; yearSeg.set(i, { silent: true }); yearSeg2.set(i, { silent: true }); render(false); if (quiz) { solved = false; render(true); } }
  yearSeg.on((v) => setYear(v)); yearSeg2.on((v) => setYear(v));
  quizTg.on((v) => { quiz = v; solved = false; if (inputEl) { inputEl.value = ''; inputEl.classList.remove('is-ok', 'is-bad'); } render(true); });
  render(true);

  /* ── API рамки ── */
  const api = {
    charts: [chart],
    compare() { cmp = yi; render(false); },
    clearCompare() { cmp = null; render(false); },
    reset() { cmp = null; quiz = false; quizTg.set(false, { silent: true }); yi = D.yi; ai = D.ai; yearSeg.set(yi, { silent: true }); yearSeg2.set(yi, { silent: true }); render(true); },
    destroy() { rafs.forEach((id) => cancelAnimationFrame(id)); chart.destroy(); },
  };
  return api;
}

/* ── стили ─────────────────────────────────────────────────────── */
const css = `
.sim--ex2-1 .sim__stats { grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); }
.sim--ex2-1 .ex21__src { font: italic 300 .86rem/1.4 var(--f-serif); color: var(--ink-3); margin-top: .7rem; }
.sim--ex2-1 .ex21__list { display: grid; gap: .3rem; }
.sim--ex2-1 .ex21__li { display: flex; align-items: center; gap: .7rem; text-align: left; padding: .5rem .7rem; border-radius: var(--r-s); border: 1px solid transparent; font: 500 .88rem/1.25 var(--f-sans); color: var(--ink-2); transition: background-color .2s, color .2s, border-color .2s; }
.sim--ex2-1 .ex21__li i { flex: none; width: 1.55rem; height: 1.55rem; display: grid; place-items: center; border-radius: 50%; font: 600 .72rem/1 var(--f-mono); font-style: normal; background: var(--surface-3); color: var(--ink-3); }
.sim--ex2-1 .ex21__li:hover { background: var(--surface-2); color: var(--ink); }
.sim--ex2-1 .ex21__li.is-on { background: var(--accent-soft); border-color: color-mix(in oklab, var(--accent) 45%, transparent); color: var(--ink); }
.sim--ex2-1 .ex21__li.is-on i { background: var(--accent); color: var(--accent-ink); }

/* верхняя полоса: год (телефон) + цепочка счетов */
.sim--ex2-1 .ex21__bar { display: grid; gap: .8rem; min-width: 0; }
.sim--ex2-1 .ex21__yr { display: none; }
.sim--ex2-1 .ex21__chain { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: .45rem; counter-reset: n; }
.sim--ex2-1 .ex21__node { position: relative; min-width: 0; }
.sim--ex2-1 .ex21__node:not(:last-child)::after { content: ""; position: absolute; top: 1.35rem; left: calc(100% - .1rem); width: .65rem; height: 2px; background: var(--line-3); z-index: 1; }
.sim--ex2-1 .ex21__node button { width: 100%; height: 100%; display: grid; align-content: start; gap: .25rem; text-align: left; padding: .6rem .6rem .65rem; border-radius: var(--r-m); border: 1px solid var(--line); background: var(--surface); transition: background-color .25s, border-color .25s, transform .3s var(--ease); min-width: 0; }
.sim--ex2-1 .ex21__node button:hover { border-color: var(--line-3); transform: translateY(-1px); }
.sim--ex2-1 .ex21__node.is-on button { border-color: var(--accent); background: var(--accent-soft); }
.sim--ex2-1 .ex21__no { width: 1.5rem; height: 1.5rem; display: grid; place-items: center; border-radius: 50%; font: 600 .72rem/1 var(--f-mono); font-style: normal; background: var(--surface-3); color: var(--ink-3); }
.sim--ex2-1 .ex21__node.is-on .ex21__no { background: var(--accent); color: var(--accent-ink); }
.sim--ex2-1 .ex21__nn { font: 600 .72rem/1.2 var(--f-sans); color: var(--ink-2); overflow-wrap: anywhere; hyphens: auto; }
.sim--ex2-1 .ex21__nb { font: 500 .58rem/1.25 var(--f-mono); letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4); overflow-wrap: anywhere; }
.sim--ex2-1 .ex21__cv { font: 500 .72rem/1.1 var(--f-mono); color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -.03em; white-space: nowrap; }

/* Т-счёт */
.sim--ex2-1 .ex21__fig { display: grid; gap: .7rem; padding: 0 .3rem .4rem; }
.sim--ex2-1 .ex21__top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .3rem 1rem; }
.sim--ex2-1 .ex21__ttl { font: 600 1.18rem/1.25 var(--f-serif); color: var(--ink); text-transform: none; letter-spacing: 0; }
.sim--ex2-1 .ex21__unit { font: 500 .72rem/1 var(--f-mono); color: var(--ink-3); letter-spacing: .08em; }
.sim--ex2-1 .ex21__what { font: italic 300 .95rem/1.5 var(--f-serif); color: var(--ink-3); max-width: 62ch; }
.sim--ex2-1 .ex21__ta { container-type: inline-size; display: grid; gap: .7rem; }
.sim--ex2-1 .ex21__cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--line-2); border-radius: var(--r-m); background: var(--surface-2); overflow: hidden; }
.sim--ex2-1 .ex21__side { display: grid; grid-template-rows: auto 1fr auto; min-width: 0; }
.sim--ex2-1 .ex21__side + .ex21__side { border-left: 1px solid var(--line-3); }
.sim--ex2-1 .ex21__side h4 { margin: 0; padding: .6rem .9rem; font: 600 .68rem/1.2 var(--f-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); border-bottom: 1px solid var(--line-3); background: var(--surface-3); }
.sim--ex2-1 .ex21__rows { list-style: none; margin: 0; padding: .3rem 0; display: grid; align-content: start; }
.sim--ex2-1 .ex21__r { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: .15rem .8rem; padding: .5rem .9rem; border-bottom: 1px solid var(--line); font: 400 .9rem/1.3 var(--f-sans); color: var(--ink); animation: ex21-in .5s var(--ease) both; animation-delay: calc(var(--n, 0) * 30ms); }
.sim--ex2-1 .ex21__r:last-child { border-bottom: 0; }
.sim--ex2-1 .ex21__n { font: 500 .9rem/1.2 var(--f-mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.sim--ex2-1 .ex21__r.is-sub { padding-top: .2rem; padding-bottom: .2rem; padding-left: 1.7rem; font-size: .8rem; color: var(--ink-3); border-bottom-color: transparent; }
.sim--ex2-1 .ex21__r.is-sub .ex21__n { font-size: .8rem; color: var(--ink-3); }
.sim--ex2-1 .ex21__r.is-sub .ex21__l::before { content: "в т. ч. "; color: var(--ink-4); }
.sim--ex2-1 .ex21__r.is-neg .ex21__l { color: var(--ink-2); }
.sim--ex2-1 .ex21__r.is-bal { background: color-mix(in oklab, var(--accent) 10%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
.sim--ex2-1 .ex21__r.is-bal .ex21__n { color: var(--accent); font-weight: 700; }
.sim--ex2-1 .ex21__r.is-bal .ex21__l { font-weight: 600; }
.sim--ex2-1 .ex21__tag { display: block; margin-top: .15rem; font: 500 .6rem/1.2 var(--f-mono); font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.sim--ex2-1 .ex21__in { display: none; width: 8.5rem; max-width: 100%; height: 2.1rem; font-size: .88rem; }
.sim--ex2-1 .ex21__r.is-ask .ex21__in { display: block; }
.sim--ex2-1 .ex21__r.is-ask { border-left: 0; }
.sim--ex2-1 .ex21__tot { display: flex; justify-content: space-between; align-items: baseline; gap: .8rem; padding: .7rem .9rem; border-top: 1px solid var(--line-3); font: 700 .9rem/1.2 var(--f-sans); background: var(--surface-3); }
.sim--ex2-1 .ex21__tn { font: 700 .95rem/1.2 var(--f-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sim--ex2-1 .ex21__tn.is-q { color: var(--ink-4); }
.sim--ex2-1 .ex21__verdict { min-height: 1.3em; font: 500 .88rem/1.4 var(--f-sans); color: var(--ink-3); }
.sim--ex2-1 .ex21__verdict.is-ok { color: var(--ok); }
.sim--ex2-1 .ex21__verdict.is-bad { color: var(--bad); }
@keyframes ex21-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
@container (max-width: 600px) {
  .sim--ex2-1 .ex21__cols { grid-template-columns: 1fr; }
  .sim--ex2-1 .ex21__side + .ex21__side { border-left: 0; border-top: 1px solid var(--line-3); }
}

/* три метода */
.sim--ex2-1 .ex21__meth { display: grid; gap: 1.1rem; padding: .2rem .3rem .4rem; }
.sim--ex2-1 .ex21__m { display: grid; gap: .5rem; min-width: 0; }
.sim--ex2-1 .ex21__mh { display: flex; flex-wrap: wrap; align-items: baseline; gap: .1rem .8rem; font: 400 .85rem/1.3 var(--f-sans); color: var(--ink-3); }
.sim--ex2-1 .ex21__mh b { color: var(--ink); font-weight: 600; font-size: .95rem; text-transform: none; letter-spacing: 0; }
.sim--ex2-1 .ex21__mh em { margin-left: auto; font: 600 .86rem/1 var(--f-mono); font-style: normal; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sim--ex2-1 .ex21__mh em.is-ok { color: var(--ok); }
.sim--ex2-1 .ex21__mh em.is-bad { color: var(--bad); }
.sim--ex2-1 .ex21__stack { display: flex; gap: 2px; height: 1.5rem; border-radius: 7px; overflow: hidden; }
.sim--ex2-1 .ex21__stack i { flex: var(--g) 1 0; background: var(--c); min-width: 3px; transition: flex-grow .6s var(--ease); }
.sim--ex2-1 .ex21__mlg { list-style: none; margin: 0; padding: 0; display: grid; gap: .15rem .9rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); }
.sim--ex2-1 .ex21__mlg li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: baseline; gap: .5rem; font: 400 .8rem/1.35 var(--f-sans); color: var(--ink-2); }
.sim--ex2-1 .ex21__mlg i { width: .7rem; height: .7rem; border-radius: 3px; background: var(--c); align-self: center; }
.sim--ex2-1 .ex21__mlg b { font: 500 .78rem/1.2 var(--f-mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.sim--ex2-1 .ex21__mlg em { font: 500 .72rem/1.2 var(--f-mono); font-style: normal; color: var(--ink-3); min-width: 3.6rem; text-align: right; }

.sim--ex2-1 .ex21__f { font: 500 .92rem/1.9 var(--f-sans); color: var(--ink); overflow-wrap: anywhere; }
.sim--ex2-1 .ex21__num { font: 500 .84rem/1 var(--f-mono); font-style: normal; font-variant-numeric: tabular-nums; white-space: nowrap; letter-spacing: -.02em; }
.sim--ex2-1 .ex21__f b { font-family: var(--f-mono); font-size: .88rem; color: var(--accent); }
.sim--ex2-1 .ex21__cmp { font: italic 300 .88rem/1.4 var(--f-serif); color: var(--ink-3); }

@media (max-width: 980px) {
  .sim--ex2-1 .ex21__yr { display: block; }
  .sim--ex2-1 .ex21__ysel { display: none; }
  .sim--ex2-1 .ex21__chain { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .sim--ex2-1 .ex21__node::after { display: none; }
}
@media (max-width: 520px) {
  .sim--ex2-1 .sim__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
  .sim--ex2-1 .st__num { font-size: 1.3rem; }
  .sim--ex2-1 .st { padding-inline: .85rem .6rem; }
  .sim--ex2-1 .ex21__chain { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sim--ex2-1 .ex21__nb, .sim--ex2-1 .ex21__cv { display: none; }
  .sim--ex2-1 .ex21__r { padding-inline: .7rem; font-size: .86rem; }
  .sim--ex2-1 .ex21__mlg li { grid-template-columns: auto minmax(0, 1fr) auto; }
  .sim--ex2-1 .ex21__mlg em { display: none; }
}
@media (prefers-reduced-motion: reduce) { .sim--ex2-1 .ex21__r { animation: none; } }
`;
if (!document.getElementById('css-ex2-1')) { const st = document.createElement('style'); st.id = 'css-ex2-1'; st.textContent = css; document.head.append(st); }
