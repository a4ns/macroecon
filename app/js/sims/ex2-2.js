/* ─────────────────────────────────────────────────────────────
   Упражнение 2.2 — Динамика макроэкономических показателей
   Республика Казахстан, 2005–2017 гг. (данные Комитета по статистике, как в оригинале).

   Выберите два показателя → график (у каждого своя шкала: слева и справа),
   таблица значений и «анализ данных»: среднее, стандартное отклонение (выборочное, n − 1),
   минимум, максимум и коэффициент корреляции Пирсона
       r = Σ(xᵢ − x̄)(yᵢ − ȳ) / √(Σ(xᵢ − x̄)² · Σ(yᵢ − ȳ)²).
   Сверх оригинала: период анализа, диаграмма рассеяния с линией регрессии,
   показатели динамики (прирост, темп прироста) и корреляция годовых приростов.
   ───────────────────────────────────────────────────────────── */
import { h, fmt as nfmt, clamp } from '../core/dom.js';
/* ru-форматирование с настоящим минусом «−» */
const fmt = (n, d = 0) => nfmt(n, d).replace(/-/g, '\u2212');
import { createChart, niceTicks } from '../ui/plot.js';
import { simLayout, panel, slider, seg, stat, presets, figure, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

/* ── данные: [название, единица, мин. шкалы, макс. шкалы, значения 2005…2017] ── */
const YEARS = [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017];
const RAW = [
  ['ВВП', 'млн. тенге', 0, 60000000, '7590593.5 10213731.2 12849794 16052919.2 17007647 21815517 28243052.7 31015186.6 35999025.1 39675832.9 40884133.6 46971150.0 51966817.4'],
  ['ВВП на душу населения', 'тенге', 0, 3000000, '501127.5 667211.6 829865.3 1024175.0 1056854.7 1336605.6 1705848.6 1847084.8 2113204.8 2294830.2 2330360.2 2639710.3 2881019.9'],
  ['Уровень безработицы', 'в процентах', 0, 10, '8.1 7.8 7.3 6.6 6.6 5.8 5.4 5.3 5.2 5.0 5.1 5.0 4.9'],
  ['Среднемесячная номинальная заработная плата одного работника', 'тенге', 0, 160000, '34060 40790 52479 60805 67333 77611 90028 101263 109141 121021 126021 142898 149663'],
  ['Естественный прирост населения на 1000 человек', 'человек', 0, 20, '8.05 9.44 10.57 13.01 13.26 13.58 13.79 14.16 14.73 15.45 15.26 15.14 14.48'],
  ['Среднедушевые номинальные денежные доходы населения', 'долларов США', 0, 400, '118.8 151.9 205.8 274.2 232.4 264.8 313.2 347.8 371.1 347.5 303.6 223.8 250.1'],
  ['Индекс потребительских цен', '', 0, 120, '107.5 108.4 118.8 109.5 106.2 107.8 107.4 106.0 104.8 107.4 113.6 108.5 107.1'],
  ['Среднегодовой обменный курс доллара США', 'тенге/долларов США', 0, 350, '132.88 126.09 122.55 120.30 147.50 147.35 146.62 149.11 152.13 179.19 221.73 342.16 326.00'],
  ['Средний размер назначенной месячной пенсии', 'тенге', 0, 60000, '9061 9898 10654 13418 17090 21238 27338 29644 31918 36068 38933 42476 50850'],
  ['Индекс реальных денежных доходов', 'в процентах к предыдущему году', 0, 120, '114.5 111.7 118.9 111.8 96.9 106.3 108.7 107.5 102.9 103.4 101.4 99.3 99.1'],
  ['Доля населения, имеющего доходы ниже величины прожиточного минимума', 'в процентах', 0, 50, '31.6 18.2 12.7 12.1 8.2 6.5 5.5 3.8 2.9 2.8 2.7 2.6 2.6'],
  ['Величина прожиточного минимума', 'тенге', 0, 30000, '6014 8410 9653 12364 12660 13487 16072 16815 17789 19068 19647 21612 23783'],
  ['Рабочая сила (в возрасте 15 лет и старше)', 'тыс. человек', 0, 10000, '7901.7 8028.9 8228.3 8415.0 8457.9 8610.7 8774.6 8981.9 9041.3 8962.0 8887.6 8998.8 9027.4'],
  ['Занятое население', 'тыс. человек', 0, 10000, '7261.0 7403.5 7631.1 7857.2 7903.4 8114.2 8301.6 8507.1 8570.6 8510.1 8433.3 8553.4 8585.2'],
  ['Наёмные работники', 'тыс. человек', 0, 10000, '4640.5 4776.6 4973.5 5199.4 5238.8 5409.4 5581.4 5813.7 5949.7 6109.7 6294.9 6342.8 6485.9'],
  ['Самостоятельно занятые работники', 'тыс. человек', 0, 3000, '2620.4 2626.9 2657.6 2657.8 2664.6 2704.8 2720.2 2693.4 2621.0 2400.4 2138.4 2210.5 2099.2'],
  ['Уровень долгосрочной безработицы', 'в процентах', 0, 10, '4.3 4.0 3.3 2.8 2.5 2.2 2.1 2.5 2.5 2.4 2.5 2.2 2.2'],
  ['Индекс реальной заработной платы', 'в процентах к предыдущему году', 0, 120, '111.7 110.3 116.1 99.0 103.2 107.6 107.1 107.0 101.9 103.9 97.7 98.9 97.9'],
];
/* краткое имя, множитель для шкалы, единица на шкале, индекс «к предыдущему году» */
const META = [
  ['ВВП', 1e-6, 'трлн тенге'], ['ВВП на душу', 1e-6, 'млн тенге'], ['Безработица', 1, '%'], ['Зарплата', 1e-3, 'тыс. тенге'],
  ['Естеств. прирост', 1, 'на 1000 чел.'], ['Доходы в долларах', 1, 'долл. США'], ['Инфляция (ИПЦ)', 1, 'индекс', true], ['Курс доллара', 1, 'тенге за $'],
  ['Пенсия', 1e-3, 'тыс. тенге'], ['Реальные доходы', 1, '% к пред. году', true], ['Бедность', 1, '% населения'], ['Прожиточный минимум', 1e-3, 'тыс. тенге'],
  ['Рабочая сила', 1e-3, 'млн чел.'], ['Занятые', 1e-3, 'млн чел.'], ['Наёмные работники', 1e-3, 'млн чел.'], ['Самозанятые', 1e-3, 'млн чел.'],
  ['Долгосрочная безработица', 1, '%'], ['Реальная зарплата', 1, '% к пред. году', true],
];
const IND = RAW.map((r, i) => {
  const vals = r[4].split(' ').map(Number);
  const dec = Math.max(...r[4].split(' ').map((s) => (s.includes('.') ? s.split('.')[1].length : 0)));
  const unit = r[1] || 'индекс, предыдущий год = 100';
  return { i, name: r[0], unit, smin: r[2], smax: r[3], v: vals, dec, short: META[i][0], sc: META[i][1], su: META[i][2], idx: !!META[i][3] };
});

/* ── статистика ── */
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
const cov = (a, b) => { const ma = mean(a), mb = mean(b); return a.reduce((s, x, k) => s + (x - ma) * (b[k] - mb), 0) / (a.length - 1); };
const corr = (a, b) => cov(a, b) / (sd(a) * sd(b));
const growth = (a) => a.slice(1).map((x, k) => (x / a[k] - 1) * 100);
/* годовой прирост, %: для индексов «к предыдущему году» это сам индекс − 100 */
const chg = (ind, a) => (ind.idx ? a.slice(1).map((x) => x - 100) : growth(a));
const avgGrowth = (ind, a) => (ind.idx ? (Math.pow(a.reduce((p, x) => p * (x / 100), 1), 1 / a.length) - 1) * 100 : (Math.pow(a[a.length - 1] / a[0], 1 / (a.length - 1)) - 1) * 100);

const f1 = (v) => fmt(v, 1), f2 = (v) => fmt(v, 2);
const sg = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
const decOf = (step) => { for (let d = 0; d < 4; d++) if (Math.abs(step * Math.pow(10, d) - Math.round(step * Math.pow(10, d))) < 1e-6) return d; return 3; };
const sci = (v) => {
  const a = Math.abs(v); if (a === 0) return '0';
  if (a >= 1e7 || a < 1e-3) { const e = Math.floor(Math.log10(a)); return (v < 0 ? '−' : '') + fmt(a / Math.pow(10, e), 2) + '·10<sup>' + e + '</sup>'; }
  return fmt(v, a < 10 ? 3 : a < 1000 ? 2 : 1);
};
const strength = (r) => { const a = Math.abs(r); return a >= .9 ? 'очень сильная' : a >= .7 ? 'сильная' : a >= .5 ? 'заметная' : a >= .3 ? 'умеренная' : 'слабая'; };

const D = { ia: 0, ib: 2, y0: 2005, y1: 2017, scale: 'book' };
const COL_A = 'var(--d1)', COL_B = 'var(--d5)';

export function mount(root, env) {
  root.classList.add('sim--ex2-2');
  const L = simLayout(root);
  let ia = D.ia, ib = D.ib, y0 = D.y0, y1 = D.y1, scale = D.scale, hy = null;
  let cmp = null;

  /* ── управление ── */
  const mkSel = (color, withNone) => {
    const s = h('select.ex22__sel', { style: { '--c': color } },
      withNone ? h('option', { value: -1 }, '— не выбран —') : null,
      ...IND.map((x) => h('option', { value: x.i }, x.name + (x.unit ? ', ' + x.unit.replace(/\.$/, '') : ''))));
    return s;
  };
  const selA = mkSel(COL_A, false), selB = mkSel(COL_B, true);
  selA.value = ia; selB.value = ib;
  selA.id = 'ex22-a'; selB.id = 'ex22-b';
  const fieldOf = (id, num, color, sel) => h('div.ex22__fld', { style: { '--c': color } }, h('label', { for: id }, h('i', num), h('span', 'показатель')), sel);

  const s0 = slider({ label: 'Период: с года', min: 2005, max: 2015, step: 1, value: D.y0, color: 'var(--d6)', fmt: (v) => String(Math.round(v)) });
  const s1 = slider({ label: 'по год', min: 2007, max: 2017, step: 1, value: D.y1, color: 'var(--d6)', fmt: (v) => String(Math.round(v)) });
  const scaleSeg = seg({ label: 'Шкала графика', options: [{ v: 'book', label: 'Как в учебнике', hint: 'Границы шкалы из таблицы упражнения (обычно от нуля)' }, { v: 'data', label: 'По данным', hint: 'Шкала подогнана под размах значений — виден характер динамики' }], value: scale });

  const P = (a, b, o = {}) => ({ a, b, y0: o.y0 || 2005, y1: o.y1 || 2017 });
  const preset = (label, color, hint, p) => ({ label, color, hint, apply: () => setAll(p) });
  const pre = presets([
    preset('ВВП и безработица', 'var(--d1)', 'Растущий выпуск — падающая безработица', P(0, 2)),
    preset('ВВП и зарплата', 'var(--d2)', 'Оба показателя в текущих ценах растут вместе', P(0, 3)),
    preset('Номинальная и реальная зарплата', 'var(--d4)', 'Рост номинальной зарплаты съедается инфляцией', P(3, 17)),
    preset('Курс доллара и доходы в $', 'var(--d3)', 'Девальвация 2014–2016 гг. и доходы в долларах', P(7, 5)),
    preset('Курс и инфляция', 'var(--d5)', 'Передача девальвации в цены', P(7, 6)),
    preset('Зарплата и пенсия', 'var(--d6)', 'Индексация пенсий вслед за зарплатами', P(3, 8)),
    preset('Наёмные и самозанятые', 'var(--d4)', 'Структура занятости', P(14, 15)),
    preset('Только 2014–2017', 'var(--ink-3)', 'Период девальвации: корреляция меняется', P(7, 6, { y0: 2014, y1: 2017 })),
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии' });

  L.controls.append(
    panel({ title: 'Показатели', hint: 'выберите два' }, fieldOf('ex22-a', '1', COL_A, selA), fieldOf('ex22-b', '2', COL_B, selB)),
    panel({ title: 'Период анализа' }, s0.el, s1.el, h('p.ex22__src', nb('Данные Комитета по статистике, 2005–2017 гг. Анализ считается по выбранному периоду.'))),
    panel({ title: 'Показать' }, scaleSeg.el),
    panel({ title: 'Что рассмотреть' }, pre));

  /* ── показатели ── */
  const R = {
    r: stat({ label: 'Коэффициент корреляции', sym: 'r', size: 'l', dec: 2, color: 'var(--accent)' }),
    r2: stat({ label: 'Доля общей вариации', sym: 'R^2', dec: 2, color: 'var(--d4)' }),
    rd: stat({ label: 'Корреляция годовых приростов', sym: 'r_Δ', dec: 2, color: 'var(--d6)' }),
    ga: stat({ label: 'Средний прирост, 1-й', unit: '% в год', dec: 1, color: COL_A }),
    gb: stat({ label: 'Средний прирост, 2-й', unit: '% в год', dec: 1, color: COL_B }),
  };
  L.stats.append(...Object.values(R).map((x) => x.el));

  /* ── график 1: динамика, две шкалы ── */
  const ro = h('div.ex22__ro', { 'aria-live': 'off' });
  const host1 = h('div');
  const c1 = createChart(host1, {
    x: { min: 2004.55, max: 2017.45, ticks: [2005, 2007, 2009, 2011, 2013, 2015, 2017], fmt: (v) => String(v), label: 'год', arrow: false },
    y: { min: 0, max: 1, ticks: [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1], fmt: (t) => axisFmt(IND[ia], scaleOf(ia), t), arrow: false },
    aspect: 1.75, maxH: 360, margin: { l: 56, r: 56, t: 34, b: 40 }, title: 'Динамика двух показателей, каждый в своей шкале',
  });
  c1.line('A', { pts: [], color: COL_A, width: 3.2 });
  c1.line('B', { pts: [], color: COL_B, width: 3.2 });
  c1.point('hA', { x: () => hy ?? y0, y: () => (hy == null ? -1 : norm(ia, valAt(ia, hy))), color: COL_A, r: 6 });
  c1.point('hB', { x: () => hy ?? y0, y: () => (hy == null || ib < 0 ? -1 : norm(ib, valAt(ib, hy))), color: COL_B, r: 6 });
  c1.text('uA', { x: 2004.55, y: 1, dy: -14, anchor: 'start', text: '', color: COL_A, size: 12, cls: 'tk' });
  c1.text('uB', { x: 2017.45, y: 1, dy: -14, anchor: 'end', text: '', color: COL_B, size: 12, cls: 'tk' });
  const rt = [];
  for (let k = 0; k <= 10; k++) { c1.text('rt' + k, { x: 2017.45, y: k / 10, dx: 9, dy: 4, anchor: 'start', text: '', color: COL_B, size: 11, cls: 'tk' }); rt.push(k); }
  const lgA = h('span.ex22__lgi', { style: { '--c': COL_A } }, h('i'), h('b'), h('em')), lgB = h('span.ex22__lgi', { style: { '--c': COL_B } }, h('i'), h('b'), h('em'));
  const fig1 = figure('Динамика · 2005–2017', h('div.ex22__fig', h('div.ex22__lg', lgA, lgB), ro, host1), { note: 'Слева шкала первого показателя, справа — второго. Проведите курсором по графику: значения за год появятся над ним.' });

  /* ── график 2: диаграмма рассеяния ── */
  const dom2 = { x: [0, 1], y: [0, 1] };
  let pts2 = [], reg = { a: 0, b: 0 };
  const host2 = h('div');
  const c2 = createChart(host2, {
    x: { min: 0, max: 1, ticks: 5, fmt: (v) => axisTick(ia, v, dom2.x) },
    y: { min: 0, max: 1, ticks: 5, fmt: (v) => axisTick(ib < 0 ? ia : ib, v, dom2.y) },
    aspect: 1.6, maxH: 420, margin: { l: 58, r: 22, t: 34, b: 50 }, title: 'Диаграмма рассеяния: один год — одна точка',
  });
  c2.line('reg', { fn: Object.assign((x) => reg.a + reg.b * x, { linear: true }), from: 0, to: 1, color: 'var(--ink-3)', width: 2, dash: '7 6', glow: false, ghost: false });
  YEARS.forEach((yr, j) => {
    c2.point('p' + j, { x: () => (pts2[j] ? pts2[j][0] : 0), y: () => (pts2[j] ? pts2[j][1] : 0), color: 'var(--accent)', r: 5.5, label: String(yr), labelDx: 9, labelDy: -8 });
    const e = c2.get('p' + j); const lab = e.nodes[e.nodes.length - 1]; lab.style.font = '600 11px var(--f-mono)'; lab.style.fontStyle = 'normal'; e.lab = lab;
  });
  c2.text('xn', { x: () => dom2.x[1], y: () => dom2.y[0], anchor: 'end', dy: 42, text: '', color: COL_A, cls: 'axl', size: 15 });
  c2.text('yn', { x: () => dom2.x[0], y: () => dom2.y[1], anchor: 'start', dy: -14, text: '', color: COL_B, cls: 'axl', size: 15 });
  c2.text('rr', { x: () => dom2.x[0], y: () => dom2.y[1], anchor: 'start', dx: 10, dy: 18, text: '', color: 'var(--ink)', cls: 'tk', size: 13 });
  const fig2 = figure('Диаграмма рассеяния · связь двух показателей', host2, { note: 'Штриховая линия — линейная регрессия. Подписаны первый и последний год периода; наведите курсор на график динамики, чтобы подсветить год.' });

  L.stage.append(fig1, fig2);

  /* ── заметки ── */
  const expl = callout({ tone: 'info', title: 'Как найден коэффициент корреляции' });
  const caution = callout({ tone: 'warn', title: 'Корреляция — не причинность' });
  const stTbl = dtable({ caption: 'Анализ данных', cols: [{ key: 'k', label: 'Показатель' }, { key: 'm', label: 'Среднее', num: true }, { key: 's', label: 'Станд. откл.', num: true }, { key: 'lo', label: 'Минимум', num: true }, { key: 'hi', label: 'Максимум', num: true }] });
  const dyTbl = dtable({ caption: 'Таблица данных и показателей динамики', cols: [{ key: 'y', label: 'Год' }, { key: 'a', label: '1-й', num: true }, { key: 'da', label: 'Прирост, %', num: true }, { key: 'b', label: '2-й', num: true }, { key: 'db', label: 'Прирост, %', num: true }] });
  const dyWrap = h('div.ex22__dy', h('p.ex22__cap', 'Значения и годовой темп прироста (цепной): (xₜ / xₜ₋₁ − 1) · 100 %; для индексов «к предыдущему году» — индекс − 100'), dyTbl.el);
  L.notes.append(stTbl.el, expl, caution, dyWrap);

  /* ── вспомогательные для шкал ── */
  function scaleOf(i) {
    const x = IND[i];
    if (scale === 'book') return { lo: x.smin, hi: x.smax };
    const dmin = Math.min(...x.v), dmax = Math.max(...x.v);
    for (let k = -4; k <= 9; k++) for (const m of [1, 2, 2.5, 5]) {
      const step = m * Math.pow(10, k); const lo = Math.floor(dmin / step - 1e-9) * step;
      if (lo + 10 * step >= dmax - 1e-9) return { lo, hi: lo + 10 * step };
    }
    return { lo: dmin, hi: dmax };
  }
  function axisFmt(x, sc, t) { const stepDisp = ((sc.hi - sc.lo) / 10) * x.sc; const d = decOf(Math.round(stepDisp * 1e6) / 1e6); return fmt((sc.lo + t * (sc.hi - sc.lo)) * x.sc, Math.min(d, 3)); }
  function axisTick(i, v, dom) { const x = IND[i]; const ts = niceTicks(dom[0], dom[1], 5); const step = ts.length > 1 ? ts[1] - ts[0] : 1; return fmt(v * x.sc, Math.min(decOf(Math.round(step * x.sc * 1e6) / 1e6), 3)); }
  const valAt = (i, yr) => IND[i].v[yr - 2005];
  const norm = (i, v) => { const sc = scaleOf(i); return (v - sc.lo) / (sc.hi - sc.lo); };
  const slice = (i) => IND[i].v.slice(y0 - 2005, y1 - 2005 + 1);
  const yrs = () => YEARS.filter((y) => y >= y0 && y <= y1);

  /* ── пересчёт ── */
  let lastAxis = '';
  function render() {
    const A = IND[ia], B = ib >= 0 ? IND[ib] : null;
    const ya = slice(ia), yb = B ? slice(ib) : null, ys = yrs();
    // график 1
    const key = [ia, ib, scale].join();
    c1.get('A').op.pts = ys.map((yr) => [yr, norm(ia, valAt(ia, yr))]);
    const eb = c1.get('B'); eb.op.pts = B ? ys.map((yr) => [yr, norm(ib, valAt(ib, yr))]) : [];
    if (!B) { eb.node.style.display = 'none'; if (eb.halo) eb.halo.style.display = 'none'; } else { eb.node.style.display = ''; if (eb.halo) eb.halo.style.display = ''; }
    if (key !== lastAxis) { lastAxis = key; c1.setDomain({ y: [0, 1] }, false); }
    c1.update();
    c1.get('uA').setText(A.short + ', ' + A.su); c1.get('uB').setText(B ? B.short + ', ' + B.su : '');
    const scB = B ? scaleOf(ib) : null;
    rt.forEach((k) => { const e = c1.get('rt' + k); e.setText(B ? axisFmt(B, scB, k / 10) : ''); e.nodes[0].style.fill = COL_B; });
    c1.get('uA').nodes[0].style.fill = COL_A; c1.get('uB').nodes[0].style.fill = COL_B;
    c1.get('uA').nodes[0].style.font = '600 12px var(--f-sans)'; c1.get('uB').nodes[0].style.font = '600 12px var(--f-sans)';
    // легенда
    lgA.querySelector('b').textContent = A.short; lgA.querySelector('em').textContent = A.su;
    lgB.querySelector('b').textContent = B ? B.short : '—'; lgB.querySelector('em').textContent = B ? B.su : 'не выбран';
    renderRo(); syncHover();

    // статистика
    const stA = { m: mean(ya), s: sd(ya), lo: Math.min(...ya), hi: Math.max(...ya) };
    const rows = [{ k: A.name, m: fmt(stA.m, 1), s: fmt(stA.s, 2), lo: fmt(stA.lo, A.dec), hi: fmt(stA.hi, A.dec) }];
    let r = NaN, rd = NaN, r2 = NaN, stB = null;
    if (B) {
      stB = { m: mean(yb), s: sd(yb), lo: Math.min(...yb), hi: Math.max(...yb) };
      rows.push({ k: B.name, m: fmt(stB.m, 1), s: fmt(stB.s, 2), lo: fmt(stB.lo, B.dec), hi: fmt(stB.hi, B.dec) });
      r = corr(ya, yb); r2 = r * r; rd = corr(chg(A, ya), chg(B, yb));
    }
    stTbl.set(rows);
    R.r.set(r); R.r2.set(r2); R.rd.set(rd);
    const gA = avgGrowth(A, ya), gB = B ? avgGrowth(B, yb) : NaN;
    R.ga.set(gA); R.gb.set(gB);
    const base = cmp || null;
    R.r.base(base ? base.r : null); R.r2.base(base ? base.r2 : null); R.rd.base(base ? base.rd : null); R.ga.base(base ? base.ga : null); R.gb.base(base && Number.isFinite(base.gb) ? base.gb : null);
    R.ga.el.querySelector('.st__lab span:last-child').textContent = 'Средний прирост: ' + A.short;
    R.gb.el.querySelector('.st__lab span:last-child').textContent = B ? 'Средний прирост: ' + B.short : 'Средний прирост, 2-й';
    state = { r, r2, rd, ga: gA, gb: gB };

    // таблица динамики
    const ga = chg(A, slice(ia)), gb = B ? chg(B, slice(ib)) : [];
    dyTbl.set(ys.map((yr, k) => ({ y: String(yr), a: fmt(valAt(ia, yr), A.dec), da: k ? sg(ga[k - 1]) : '—', b: B ? fmt(valAt(ib, yr), B.dec) : '—', db: B && k ? sg(gb[k - 1]) : '—', _cls: yr === hy ? 'is-total' : '' })));
    const th = dyTbl.el.querySelectorAll('th'); th[1].textContent = A.short; th[3].textContent = B ? B.short : '2-й';

    // диаграмма рассеяния
    if (B) {
      const xs = ya.map((v) => v * A.sc), yv = yb.map((v) => v * B.sc);
      const pad = (a) => { const lo = Math.min(...a), hi = Math.max(...a), sp = (hi - lo) || Math.abs(hi) || 1; return [lo - sp * .12, hi + sp * .12]; };
      const dx = pad(xs), dy = pad(yv);
      const dxn = niceDom(dx), dyn = niceDom(dy);
      dom2.x = dxn.map((v) => v / A.sc); dom2.y = dyn.map((v) => v / B.sc);
      // график рассеяния живёт в исходных единицах; шкалы форматируют через множитель
      pts2 = YEARS.map((yr) => [valAt(ia, yr), valAt(ib, yr)]);
      const b1 = cov(ya, yb) / (sd(ya) * sd(ya)); reg = { a: mean(yb) - b1 * mean(ya), b: b1 };
      const rg = c2.get('reg'); rg.op.from = dom2.x[0]; rg.op.to = dom2.x[1]; rg.node.style.display = ''; if (rg.halo) rg.halo.style.display = '';
      c2.setDomain({ x: dom2.x, y: dom2.y }, true);
      YEARS.forEach((yr, j) => { const e = c2.get('p' + j); const inP = yr >= y0 && yr <= y1; e.nodes[0].style.display = inP ? '' : 'none'; e.lab.style.display = inP && (yr === y0 || yr === y1 || yr === hy) ? '' : 'none'; e.nodes[0].classList.toggle('is-hot', yr === hy); });
      c2.update();
      c2.get('xn').setText(A.short + ', ' + A.su); c2.get('yn').setText(B.short + ', ' + B.su);
      c2.get('xn').nodes[0].style.fill = COL_A; c2.get('yn').nodes[0].style.fill = COL_B;
      c2.get('rr').setText('r = ' + f2(r)); c2.get('rr').nodes[0].style.font = '600 13px var(--f-mono)';
    } else {
      pts2 = [];
      YEARS.forEach((yr, j) => { const e = c2.get('p' + j); e.nodes[0].style.display = 'none'; e.lab.style.display = 'none'; });
      const rg = c2.get('reg'); rg.node.style.display = 'none'; if (rg.halo) rg.halo.style.display = 'none';
      c2.get('xn').setText(''); c2.get('yn').setText(''); c2.get('rr').setText('Выберите второй показатель');
    }
    explain(A, B, ya, yb, r, r2, rd, stA, stB);
  }
  let state = {};

  /* «красивая» область для рассеяния */
  function niceDom([lo, hi]) { const t = niceTicks(lo, hi, 5); const step = t.length > 1 ? t[1] - t[0] : (hi - lo); return [Math.floor(lo / step + 1e-9) * step, Math.ceil(hi / step - 1e-9) * step]; }

  function syncHover() { ['hA', 'hB'].forEach((id) => { c1.get(id).nodes[0].style.display = hy == null || (id === 'hB' && ib < 0) ? 'none' : ''; }); }
  function renderRo() {
    ro.textContent = '';
    if (hy == null) { ro.append(h('span.ex22__hint', 'Проведите по графику — значения за год.')); return; }
    const A = IND[ia], B = ib >= 0 ? IND[ib] : null;
    ro.append(h('b.ex22__yr', String(hy)), h('span', { style: { '--c': COL_A } }, h('i'), A.short + ' ', h('b', fmt(valAt(ia, hy), A.dec))), B ? h('span', { style: { '--c': COL_B } }, h('i'), B.short + ' ', h('b', fmt(valAt(ib, hy), B.dec))) : null);
  }

  /* ── пояснение ── */
  function explain(A, B, ya, yb, r, r2, rd, sa, sb) {
    const n = ya.length, body = expl.querySelector('.co__b');
    if (!B) { body.innerHTML = `<p>${nb('Выберите второй показатель: коэффициент корреляции измеряет связь между двумя рядами.')}</p>`; caution.style.display = 'none'; return; }
    const cv = cov(ya, yb);
    const tail = r > 0 ? 'прямая' : 'обратная';
    const trendNote = Math.abs(r) >= .7 && Math.abs(rd) < .4;
    body.innerHTML = `<p class="ex22__f">${symHTML('r')} = cov(x, y) / (${symHTML('s_x')} · ${symHTML('s_y')}), cov = Σ(x<sub>i</sub> − x̄)(y<sub>i</sub> − ȳ) / (n − 1)</p>
      <p class="ex22__f">n = ${n}; x̄ = ${fmt(sa.m, 1)}; ȳ = ${fmt(sb.m, 1)}; ${symHTML('s_x')} = ${fmt(sa.s, 2)}; ${symHTML('s_y')} = ${fmt(sb.s, 2)}; cov = ${sci(cv)}</p>
      <p class="ex22__f">${symHTML('r')} = ${sci(cv)} / (${fmt(sa.s, 2)} · ${fmt(sb.s, 2)}) = <b>${f2(r)}</b></p>
      <p>${nb(`Связь ${strength(r)} ${tail}: ${r > 0 ? 'когда один показатель выше, второй в среднем тоже выше' : 'когда один показатель выше, второй в среднем ниже'}. Линейная связь объясняет ${fmt(r2 * 100, 0)} % вариации.`)}</p>`;
    caution.style.display = '';
    caution.querySelector('.co__b').innerHTML = `<p>${nb(trendNote ? `Корреляция уровней высока (r = ${f2(r)}), а годовых приростов — заметно ниже (r<sub>Δ</sub> = ${f2(rd)}): оба ряда в основном растут или падают вместе со временем, и это ещё не значит, что один показатель влияет на другой.` : `Корреляция годовых приростов r<sub>Δ</sub> = ${f2(rd)} показывает, согласованы ли показатели в самих колебаниях, а не только в общем тренде. Причины связи надо искать в экономике (спрос, цены, курс, занятость), а не в одном коэффициенте.`)}</p>`;
  }

  /* ── события ── */
  function readState() { ia = +selA.value; ib = +selB.value; y0 = Math.round(s0.value); y1 = Math.round(s1.value); scale = scaleSeg.value; }
  selA.addEventListener('change', () => { readState(); hy = null; render(); });
  selB.addEventListener('change', () => { readState(); hy = null; render(); });
  s0.on(() => { if (s0.value > s1.value - 2) s1.set(Math.min(2017, Math.round(s0.value) + 2), { silent: true }); readState(); fixHover(); render(); });
  s1.on(() => { if (s1.value < s0.value + 2) s0.set(Math.max(2005, Math.round(s1.value) - 2), { silent: true }); readState(); fixHover(); render(); });
  scaleSeg.on(() => { readState(); render(); });
  const fixHover = () => { if (hy != null && (hy < y0 || hy > y1)) hy = null; };
  c1.enableHover((xv) => {
    const next = xv == null ? null : clamp(Math.round(xv), y0, y1);
    if (next === hy) return; hy = next;
    renderRo(); syncHover(); c1.update();
    YEARS.forEach((yr, j) => { const e = c2.get('p' + j); if (ib < 0) return; const inP = yr >= y0 && yr <= y1; e.nodes[0].classList.toggle('is-hot', yr === hy); e.lab.style.display = inP && (yr === y0 || yr === y1 || yr === hy) ? '' : 'none'; });
    dyTbl.el.querySelectorAll('tbody tr').forEach((tr, k) => tr.classList.toggle('is-total', y0 + k === hy));
  });

  function setAll(p) { selA.value = p.a; selB.value = p.b; s0.set(p.y0, { silent: true }); s1.set(p.y1, { silent: true }); readState(); hy = null; render(); }
  readState(); render();

  /* ── API рамки ── */
  const api = {
    charts: [c1, c2],
    compare() { cmp = { ...state }; c1.snapshot(); render(); },
    clearCompare() { cmp = null; c1.clearGhosts(); render(); },
    reset() { cmp = null; c1.clearGhosts(); c2.clearGhosts(); scaleSeg.set(D.scale, { silent: true }); setAll({ a: D.ia, b: D.ib, y0: D.y0, y1: D.y1 }); },
    destroy() { c1.destroy(); c2.destroy(); },
  };
  return api;
}

/* ── стили ─────────────────────────────────────────────────────── */
const css = `
.sim--ex2-2 .ex22__src { font: italic 300 .86rem/1.4 var(--f-serif); color: var(--ink-3); margin-top: .7rem; }
.sim--ex2-2 .ex22__fld { display: grid; gap: .4rem; }
.sim--ex2-2 .ex22__fld + .ex22__fld { margin-top: .9rem; }
.sim--ex2-2 .ex22__fld label { display: flex; align-items: center; gap: .55rem; font: 500 .72rem/1 var(--f-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
.sim--ex2-2 .ex22__fld label i { width: 1.4rem; height: 1.4rem; display: grid; place-items: center; border-radius: 50%; background: var(--c); color: var(--ink-inv); font: 700 .72rem/1 var(--f-mono); font-style: normal; }
.sim--ex2-2 .ex22__sel { width: 100%; min-height: 2.7rem; padding: .45rem 2.2rem .45rem .8rem; border-radius: var(--r-s); border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font: 500 .88rem/1.3 var(--f-sans); appearance: none; -webkit-appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-3) 50%), linear-gradient(135deg, var(--ink-3) 50%, transparent 50%); background-position: calc(100% - 1.15rem) 52%, calc(100% - .8rem) 52%; background-size: .35rem .35rem; background-repeat: no-repeat; box-shadow: inset 3px 0 0 var(--c);
  text-overflow: ellipsis; cursor: pointer; transition: border-color .2s, box-shadow .2s; }
.sim--ex2-2 .ex22__sel:hover { border-color: var(--line-3); }
.sim--ex2-2 .ex22__sel:focus-visible { outline: none; border-color: var(--accent); box-shadow: inset 3px 0 0 var(--c), 0 0 0 3px var(--accent-soft); }
.sim--ex2-2 .ex22__sel option { color: var(--ink); background: var(--surface-2); }
.sim--ex2-2 .ex22__fig { display: grid; gap: .45rem; }
.sim--ex2-2 .ex22__lg { display: flex; flex-wrap: wrap; gap: .25rem 1.2rem; padding: 0 .4rem; }
.sim--ex2-2 .ex22__lgi { display: inline-flex; align-items: baseline; gap: .45rem; font: 500 .82rem/1.2 var(--f-sans); color: var(--ink-2); min-width: 0; }
.sim--ex2-2 .ex22__lgi i { width: 1.1rem; height: 3px; border-radius: 2px; background: var(--c); align-self: center; flex: none; }
.sim--ex2-2 .ex22__lgi b { font-weight: 600; color: var(--ink); }
.sim--ex2-2 .ex22__lgi em { font: 500 .7rem/1 var(--f-mono); font-style: normal; color: var(--ink-3); }
.sim--ex2-2 .ex22__ro { display: flex; flex-wrap: wrap; align-items: baseline; gap: .1rem 1.1rem; min-height: 1.7rem; padding: .25rem .6rem; border-radius: var(--r-s); background: var(--surface-2); border: 1px solid var(--line); font: 400 .8rem/1.3 var(--f-sans); color: var(--ink-2); }
.sim--ex2-2 .ex22__ro .ex22__yr { font: 700 .86rem/1 var(--f-mono); color: var(--ink); }
.sim--ex2-2 .ex22__ro span { display: inline-flex; align-items: baseline; gap: .35rem; }
.sim--ex2-2 .ex22__ro span i { width: .55rem; height: .55rem; border-radius: 50%; background: var(--c); align-self: center; }
.sim--ex2-2 .ex22__ro span b { font: 600 .84rem/1 var(--f-mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.sim--ex2-2 .ex22__hint { font: italic 300 .86rem/1.3 var(--f-serif); color: var(--ink-3); }
.sim--ex2-2 .mxp .pt .dot { transition: r .2s var(--ease); }
.sim--ex2-2 .mxp .pt.is-hot .dot { r: 9px; }
.sim--ex2-2 .ex22__f { font: 500 .92rem/1.8 var(--f-sans); color: var(--ink); overflow-wrap: anywhere; }
.sim--ex2-2 .ex22__f b { font: 700 .95rem/1 var(--f-mono); color: var(--accent); }
.sim--ex2-2 .ex22__dy { display: grid; gap: .5rem; }
.sim--ex2-2 .ex22__cap { font: italic 300 .88rem/1.4 var(--f-serif); color: var(--ink-3); }
.sim--ex2-2 .dt th { white-space: normal; }
@media (max-width: 520px) {
  .sim--ex2-2 .sim__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
  .sim--ex2-2 .st__num { font-size: 1.3rem; }
  .sim--ex2-2 .st--l .st__num { font-size: 1.8rem; }
  .sim--ex2-2 .st { padding-inline: .85rem .6rem; }
  .sim--ex2-2 .dt td, .sim--ex2-2 .dt th { padding-inline: .6rem; }
}
`;
if (!document.getElementById('css-ex2-2')) { const st = document.createElement('style'); st.id = 'css-ex2-2'; st.textContent = css; document.head.append(st); }
