/* ─────────────────────────────────────────────────────────────
   Упражнение 5.1 — рыночное равновесие в модели AD–AS (закрытая и открытая экономика)

   Y = C + I + G [+ Nx],  C = Ca + mpc·Yd,  Yd = Y − T,  T = Ta + t·Y,  I = Ia − d·r,  Nx = Ex − Im.
   IS–LM ⇒ кривая совокупного спроса      AD:  Y = Ya + E/P,
       A  = Ca + Ia + G [+ (Ex − Im)] − mpc·Ta,   Δ = k·d + h·(1 − mpc·(1 − t)),
       Ya = h·A/Δ,   E = d·M/Δ,   r = (k/h)·Y − M/(h·P).
   Предложение: SRAS — горизонталь на уровне цен P; LRAS — вертикаль Y = Y*.
   Краткосрочно:  Y₁ = Ya + E/P.   Долгосрочно:  Y₂ = Y*,  P₂ = E/(Y* − Ya),  инфляция (P₂ − P)/P.
   Исходные значения: Ca = 5500, mpc = 0,75, Ia = 18000, d = 400, Ta = 500, t = 20 %, G = 6875,
   M = 20000, k = 0,85, h = 400, P = 1,0, Y* = 40000, Ex = Im = 1000  ⇒  AD₀: Y = 24000 + 16000/P.
   Строки таблицы — как в оригинале: базовый / краткосрочный / долгосрочный период.
   ───────────────────────────────────────────────────────────── */
import { h, fmt } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, seg, stat, presets, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

const D = { Ca: 5500, mpc: 0.75, Ia: 18000, d: 400, Ta: 500, t: 20, G: 6875, M: 20000, k: 0.85, h: 400, P: 1.0, Yf: 40000, Ex: 1000, Im: 1000 };
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

/* ── модель: чистые функции ───────────────────────────────── */
function ad(p, open) {
  const tax = p.t / 100;
  const A = p.Ca + p.Ia + p.G + (open ? p.Ex - p.Im : 0) - p.mpc * p.Ta;
  const den = p.k * p.d + p.h * (1 - p.mpc * (1 - tax));
  return { tax, A, den, Ya: (p.h * A) / den, E: (p.d * p.M) / den };
}
function row(p, open, A, Y, P) {
  const T = r2(p.Ta + A.tax * Y), Yd = Y - (p.Ta + A.tax * Y), C = p.Ca + p.mpc * Yd;
  const r = (p.k / p.h) * Y - (1 / p.h) * (p.M / P);
  return { Y, P, Yf: p.Yf, gap: Y - p.Yf, T, G: p.G, B: T - p.G, Yd, C, S: Yd - C, I: p.Ia - p.d * r, r, M: p.M, Nx: open ? p.Ex - p.Im : null };
}
function run(p, open, p0) {
  const A = ad(p, open), A0 = ad(p0, open);
  const base = row(p0, open, A0, A0.Ya + A0.E / p0.P, p0.P);
  const sr = row(p, open, A, A.Ya + A.E / p.P, p.P); sr.inf = ((p.P - p0.P) * 100) / p0.P;
  const P2 = p.Yf - A.Ya > 1e-9 ? A.E / (p.Yf - A.Ya) : NaN;
  const lr = Number.isFinite(P2) ? row(p, open, A, p.Yf, P2) : null; if (lr) lr.inf = ((P2 - p.P) * 100) / p.P;
  return { A, A0, base, sr, lr, P2 };
}
const adPts = (A) => { const out = []; for (let i = 0; i < 72; i++) { const P = 0.25 + (2.75 * i) / 71; out.push([A.Ya + A.E / P, P]); } return out; };

export function mount(root, env) {
  root.classList.add('sim--ex5-1');
  const L = simLayout(root);
  const st = { ...D };
  let base = { ...D };
  let open = false;
  let M = run(st, open, base);

  /* ── управление ───────────────────────────────────────────── */
  const U = 'ден. ед.';
  const S = {
    Ca: slider({ label: 'Автономное потребление', sym: 'C_a', min: 3000, max: 8000, step: 100, value: D.Ca, unit: U, color: 'var(--d1)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.6, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d2)' }),
    Ia: slider({ label: 'Автономные инвестиции', sym: 'I_a', min: 15000, max: 21000, step: 100, value: D.Ia, unit: U, color: 'var(--d5)' }),
    d: slider({ label: 'Чувствительность инвестиций к ставке', sym: 'd', min: 300, max: 500, step: 1, value: D.d, color: 'var(--d4)' }),
    Ta: slider({ label: 'Автономные налоги', sym: 'T_a', min: 0, max: 2000, step: 50, value: D.Ta, unit: U, color: 'var(--d3)' }),
    t: slider({ label: 'Налоговая ставка', sym: 't', min: 5, max: 40, step: 1, value: D.t, unit: '%', color: 'var(--d1)' }),
    G: slider({ label: 'Государственные расходы', sym: 'G', min: 4000, max: 10000, step: 25, value: D.G, unit: U, color: 'var(--d5)' }),
    M: slider({ label: 'Предложение денег', sym: 'M', min: 15000, max: 25000, step: 100, value: D.M, unit: U, color: 'var(--d6)' }),
    k: slider({ label: 'Чувствительность спроса на деньги к доходу', sym: 'k', min: 0.7, max: 1.0, step: 0.01, value: D.k, dec: 2, color: 'var(--d2)' }),
    h: slider({ label: 'Чувствительность спроса на деньги к ставке', sym: 'h', min: 300, max: 500, step: 1, value: D.h, color: 'var(--d4)' }),
    P: slider({ label: 'Уровень цен в краткосрочном периоде (SRAS)', sym: 'P', min: 0.5, max: 1.5, step: 0.01, value: D.P, dec: 2, color: 'var(--d3)' }),
    Yf: slider({ label: 'Потенциальный выпуск (LRAS)', sym: 'Y^*', min: 32000, max: 48000, step: 500, value: D.Yf, unit: U, color: 'var(--d6)' }),
    Ex: slider({ label: 'Экспорт', sym: 'Ex', min: 600, max: 1400, step: 25, value: D.Ex, unit: U, color: 'var(--d2)' }),
    Im: slider({ label: 'Импорт', sym: 'Im', min: 600, max: 1400, step: 25, value: D.Im, unit: U, color: 'var(--d3)' }),
  };
  const variant = seg({ label: 'Вариант модели', options: [{ v: 'closed', label: 'Закрытая экономика' }, { v: 'open', label: 'Открытая экономика' }], value: 'closed' });

  const set = (k, v) => S[k].set(v, { fromUser: true });
  const bump = (k, dv, dec = 0) => { mark(); set(k, +(st[k] + dv).toFixed(dec)); };
  const common = [
    { label: 'Стимулы: G + 1000', color: 'var(--d5)', hint: 'Рост госрасходов сдвигает AD вправо', apply: () => bump('G', 1000) },
    { label: 'Налоги: Ta + 500', color: 'var(--d3)', hint: 'Рост автономных налогов сдвигает AD влево', apply: () => bump('Ta', 500) },
    { label: 'Налоговая ставка + 5 п.п.', color: 'var(--d1)', hint: 'Мультипликатор уменьшается, AD становится круче', apply: () => bump('t', 5) },
    { label: 'Денежная эмиссия: M + 1000', color: 'var(--d6)', hint: 'Рост предложения денег сдвигает AD вправо', apply: () => bump('M', 1000) },
    { label: 'Оптимизм: Ca + 500', color: 'var(--d2)', hint: 'Домохозяйства тратят больше', apply: () => bump('Ca', 500) },
    { label: 'Спад инвестиций: Ia − 500', color: 'var(--d4)', apply: () => bump('Ia', -500) },
    { label: 'Рост цен в краткосрочном периоде: P + 0,1', color: 'var(--d3)', hint: 'SRAS поднимается вверх', apply: () => bump('P', 0.1, 2) },
    { label: 'Потенциал растёт: Y* + 2000', color: 'var(--d6)', hint: 'LRAS сдвигается вправо', apply: () => bump('Yf', 2000) },
    { label: 'Потенциал падает: Y* − 2000', color: 'var(--d5)', apply: () => bump('Yf', -2000) },
  ];
  const onlyOpen = [
    { label: 'Экспорт + 100', color: 'var(--d2)', hint: 'Чистый экспорт растёт — AD вправо', apply: () => bump('Ex', 100) },
    { label: 'Импорт + 100', color: 'var(--d3)', hint: 'Чистый экспорт падает — AD влево', apply: () => bump('Im', 100) },
  ];
  const reset = { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() };
  const mkPre = (list) => presets(list.map((p) => ({ ...p, label: nb(p.label) })), { title: 'Сценарии' });
  const preClosed = mkPre([...common, reset]), preOpen = mkPre([...common, ...onlyOpen, reset]);

  const pBody = panel({ title: 'Что будет, если…' }, preClosed);
  const pEx = panel({ title: 'Внешний сектор' }, S.Ex.el, S.Im.el);
  pEx.hidden = true;
  L.controls.append(
    panel({ title: 'Модель' }, variant.el),
    panel({ title: 'Домашние хозяйства и фирмы' }, S.Ca.el, S.mpc.el, S.Ia.el, S.d.el),
    panel({ title: 'Государство' }, S.Ta.el, S.t.el, S.G.el),
    panel({ title: 'Денежный рынок' }, S.M.el, S.k.el, S.h.el),
    panel({ title: 'Предложение' }, S.P.el, S.Yf.el),
    pEx, pBody);

  /* ── показатели ───────────────────────────────────────────── */
  const R = {
    Y1: stat({ label: 'Краткосрочный выпуск', sym: 'Y_1', unit: U, size: 'l', color: 'var(--accent)' }),
    gap: stat({ label: 'Разрыв выпуска', sym: 'Y_1 − Y^*', color: 'var(--d3)' }),
    P2: stat({ label: 'Долгосрочный уровень цен', sym: 'P_2', dec: 3, color: 'var(--d1)' }),
    inf: stat({ label: 'Инфляция в долгосрочном периоде', unit: '%', dec: 2, color: 'var(--d5)' }),
    r: stat({ label: 'Ставка процента (кратк.)', sym: 'r_1', unit: '%', dec: 1, color: 'var(--d4)' }),
  };
  L.stats.append(R.Y1.el, R.gap.el, R.P2.el, R.inf.el, R.r.el);

  /* ── график AD–AS ─────────────────────────────────────────── */
  const host = h('div');
  const readout = h('p.ex51__ro', { 'aria-live': 'off' }, nb('Наведите курсор на график — увидите уровень цен, при котором спрос равен выпуску.'));
  const chart = createChart(host, {
    x: { min: 30000, max: 52000, label: 'Y', ticks: 6, fmt: (v) => fmt(v, 0) },
    y: { min: 0.25, max: 2.25, label: 'P', ticks: [0.5, 1, 1.5, 2], fmt: (v) => fmt(v, 2) },
    aspect: 1.35, maxH: 540, margin: { l: 58, r: 30, t: 28, b: 44 }, title: 'Модель AD–AS',
  });
  chart.line('ad0', { pts: adPts(M.A0), color: 'var(--ink-3)', width: 2.2, dash: '6 6', label: 'AD_0', labelAt: 0.12, labelDy: 18, labelDx: -4, glow: false, ghost: false });
  chart.line('ad1', { pts: adPts(M.A), color: 'var(--d1)', width: 3.6, label: 'AD_1', labelAt: 0.12, labelDy: -12, labelDx: 2, ghost: false });
  const flat = (f) => { const fn = (x) => f(); fn.linear = true; return fn; };
  chart.line('sras0', { fn: flat(() => base.P), from: 30000, to: 52000, color: 'var(--ink-3)', width: 1.8, dash: '2 7', label: 'SRAS_0', labelAt: 0.04, labelDy: 18, glow: false, ghost: false });
  chart.line('sras1', { fn: flat(() => st.P), from: 30000, to: 52000, color: 'var(--d5)', width: 3, label: 'SRAS_1', labelAt: 0.95, labelDy: -9, labelDx: -52, ghost: false });
  chart.vline('lras0', { x: () => base.Yf, color: 'var(--ink-3)', dash: '2 7', width: 1.8, label: 'LRAS_0', labelDx: -56 });
  chart.vline('lras1', { x: () => st.Yf, color: 'var(--d6)', dash: '', width: 3, label: 'LRAS_1', labelDx: 4 });
  chart.arrow('a01', { from: () => [M.base.Y, M.base.P], to: () => [M.sr.Y, M.sr.P], color: 'var(--ink-2)', width: 1.8, head: 9 });
  chart.arrow('a12', { from: () => [M.sr.Y, M.sr.P], to: () => [M.lr ? M.lr.Y : M.sr.Y, M.lr ? M.lr.P : M.sr.P], color: 'var(--ink-2)', width: 1.8, head: 9 });
  chart.point('e0', { x: () => M.base.Y, y: () => M.base.P, color: 'var(--ink-3)', r: 5.5, label: 'E_0', labelDx: -26, labelDy: -10 });
  chart.point('e1', { x: () => M.sr.Y, y: () => M.sr.P, color: 'var(--d5)', r: 6.5, label: 'E_1', labelDx: 8, labelDy: 22 });
  chart.point('e2', { x: () => (M.lr ? M.lr.Y : M.sr.Y), y: () => (M.lr ? M.lr.P : M.sr.P), color: 'var(--accent)', r: 7.5, pulse: true, label: 'E_2', labelDx: 10, labelDy: -10, guides: { x: 'Y^*', y: 'P_2' } });
  chart.enableHover((xv, px, ev) => {
    if (xv == null) { readout.textContent = nb('Наведите курсор на график — увидите уровень цен, при котором спрос равен выпуску.'); return; }
    const P = xv - M.A.Ya > 1 ? M.A.E / (xv - M.A.Ya) : NaN;
    readout.textContent = Number.isFinite(P) ? nb(`При Y = ${fmt(xv, 0)} совокупный спрос AD₁ равен выпуску, если P = ${fmt(P, 2)}.`) : nb('Левее асимптоты кривой AD.');
  });

  L.stage.append(figure('Совокупный спрос и предложение', host, { note: nb('Серые линии и точка E₀ — исходное состояние (или сохранённое сравнение). E₁ — краткосрочное равновесие на SRAS, E₂ — долгосрочное на LRAS.') }), readout);
  L.stage.append(legend([
    { color: 'var(--d1)', label: 'AD — совокупный спрос' }, { color: 'var(--d5)', label: 'SRAS — краткосрочное предложение' },
    { color: 'var(--d6)', label: 'LRAS — долгосрочное предложение' }, { color: 'var(--ink-3)', label: 'исходное положение', dash: true }]));

  /* ── таблица и пояснение ──────────────────────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Базовый', num: true }, { key: 'b', label: 'Краткосрочный', num: true }, { key: 'c', label: 'Долгосрочный', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получено равновесие' });
  L.notes.append(tbl.el, expl);

  /* ── вывод ────────────────────────────────────────────────── */
  const f0 = (v) => fmt(v, 0), f2 = (v) => fmt(v, 2);
  const sgn = (v, d = 0) => (Math.abs(v) < Math.pow(10, -d) / 2 ? '' : v > 0 ? '+' : '−') + fmt(Math.abs(v), d);
  const dash = '—';
  function render() {
    const { A, A0, base: b0, sr, lr } = M;
    R.Y1.set(sr.Y); R.Y1.base(b0.Y);
    R.gap.set(sr.gap); R.gap.base(b0.gap);
    R.P2.set(lr ? lr.P : NaN); R.P2.base(b0.P);
    R.inf.set(lr ? lr.inf : NaN); R.inf.base(0);
    R.r.set(r1(sr.r)); R.r.base(r1(b0.r));

    const g = (o, key, d = 2, plain = false) => (o == null ? dash : o[key] == null ? dash : plain ? f0(o[key]) : fmt(o[key], d));
    const rows = [
      ['M', 'M', 0], ['P', 'P', 2], ['Y', 'Y', 2], ['Y^*', 'Yf', 0], ['Y − Y^*', 'gap', 2],
      ['T', 'T', 2], ['G', 'G', 0], ['B = T − G', 'B', 2], ['Yd', 'Yd', 2], ['C', 'C', 2], ['S', 'S', 2], ['I', 'I', 2],
    ];
    const out = rows.map(([lab, key, d]) => ({ k: lab, a: g(b0, key, d), b: g(sr, key, d), c: lr ? (key === 'gap' ? dash : g(lr, key, d)) : dash }));
    out.splice(out.length, 0, { k: 'r, %', a: fmt(r1(b0.r), 1), b: fmt(r1(sr.r), 1), c: lr ? fmt(r1(lr.r), 1) : dash });
    out.push({ k: 'Темп инфляции, %', a: dash, b: f2(sr.inf), c: lr ? f2(lr.inf) : dash });
    if (open) out.push({ k: 'Nx = Ex − Im', a: f0(b0.Nx), b: f0(sr.Nx), c: lr ? f0(lr.Nx) : dash });
    tbl.set(out);

    /* пояснение */
    const sY = (o) => symHTML(o);
    const aTxt = `${sY('C_a')} + ${sY('I_a')} + ${sY('G')}${open ? ` + (${sY('Ex')} − ${sY('Im')})` : ''} − ${sY('mpc')}·${sY('T_a')} = ${f0(st.Ca)} + ${f0(st.Ia)} + ${f0(st.G)}${open ? ` + (${f0(st.Ex)} − ${f0(st.Im)})` : ''} − ${fmt(st.mpc, 2)}·${f0(st.Ta)} = <b>${f0(A.A)}</b>`;
    const dTxt = `${sY('k')}·${sY('d')} + ${sY('h')}·(1 − ${sY('mpc')}·(1 − ${sY('t')})) = ${fmt(st.k, 2)}·${f0(st.d)} + ${f0(st.h)}·(1 − ${fmt(st.mpc, 2)}·${fmt(1 - A.tax, 2)}) = <b>${fmt(A.den, 1)}</b>`;
    const dAD1 = (A.Ya + A.E / base.P) - (A0.Ya + A0.E / base.P);   // сдвиг AD при исходном уровне цен
    const shift = Math.abs(dAD1) < 0.5 ? 'Кривая AD осталась на месте.' : dAD1 > 0 ? `Кривая AD сместилась вправо: при прежнем уровне цен спрос вырос на ${f0(dAD1)}.` : `Кривая AD сместилась влево: при прежнем уровне цен спрос упал на ${f0(-dAD1)}.`;
    const gapTxt = Math.abs(sr.gap) < 0.5 ? 'Экономика в краткосрочном периоде находится на уровне потенциала.'
      : sr.gap < 0 ? `В краткосрочном периоде выпуск ниже потенциального на ${f0(-sr.gap)} (рецессионный разрыв, безработица выше естественной).`
        : `В краткосрочном периоде выпуск выше потенциального на ${f0(sr.gap)} (инфляционный разрыв, экономика перегрета).`;
    let lrTxt;
    if (!lr) lrTxt = `Потенциальный выпуск Y* = ${f0(st.Yf)} лежит левее асимптоты AD (Yₐ = ${f0(A.Ya)}): ни при каком положительном уровне цен спрос не равен потенциалу — долгосрочного равновесия нет.`;
    else if (Math.abs(lr.inf) < 0.005) lrTxt = `Долгосрочное равновесие совпадает с краткосрочным: P₂ = ${fmt(lr.P, 3)}, цены не меняются.`;
    else lrTxt = `Цены подстраиваются: ${sY('P_2')} = ${sY('E')}/(${sY('Y^*')} − ${sY('Y_a')}) = ${f0(A.E)}/(${f0(st.Yf)} − ${f0(A.Ya)}) = <b>${fmt(lr.P, 3)}</b>. Выпуск возвращается к Y*, а цены ${lr.inf > 0 ? 'растут' : 'снижаются'} на <b>${f2(Math.abs(lr.inf))} %</b> относительно краткосрочного периода.`;
    expl.querySelector('.co__b').innerHTML =
      `<p>${sY('A')} = ${aTxt}; ${sY('Δ')} = ${dTxt}.</p>` +
      `<p>${sY('Y_a')} = ${sY('h')}·${sY('A')}/${sY('Δ')} = <b>${f0(A.Ya)}</b>; ${sY('E')} = ${sY('d')}·${sY('M')}/${sY('Δ')} = <b>${f0(A.E)}</b>; ${nb('следовательно,')} ${sY('AD')}: ${sY('Y')} = ${f0(A.Ya)} + ${f0(A.E)}/${sY('P')}.</p>` +
      `<p>${nb(shift)} ${nb(gapTxt)}</p><p>${nb(lrTxt)}</p>` +
      `<p class="ex51__tip">${nb('В долгосрочном периоде выпуск определяет только предложение (Y*): изменения спроса отражаются на уровне цен, но не на реальном выпуске.')}</p>`;
  }

  /* ── обновление ───────────────────────────────────────────── */
  const rd = () => Object.keys(S).forEach((k) => (st[k] = S[k].value));
  function fit() {
    const xs = [M.base.Y, M.sr.Y, st.Yf, base.Yf, ...(M.lr ? [M.lr.Y] : [])];
    const lo = Math.min(30000, Math.floor((Math.min(...xs) - 2500) / 2000) * 2000), hi = Math.max(52000, Math.ceil((Math.max(...xs) + 2500) / 2000) * 2000);
    const ps = [M.base.P, M.sr.P, base.P, ...(M.lr && Number.isFinite(M.lr.P) ? [M.lr.P] : [])];
    const pmax = Math.max(2.25, Math.min(8, Math.ceil((Math.max(...ps) + 0.2) * 4) / 4));
    const pmin = Math.min(0.25, Math.max(0, Math.floor((Math.min(...ps) - 0.1) * 4) / 4));
    ['sras0', 'sras1'].forEach((id) => { chart.get(id).op.from = lo; chart.get(id).op.to = hi; });
    chart.setDomain({ x: [lo, hi], y: [pmin, pmax] }, true);
  }
  function refresh() {
    M = run(st, open, base);
    chart.get('ad0').op.pts = adPts(M.A0); chart.get('ad1').op.pts = adPts(M.A);
    fit(); chart.update();
    // стрелки скрываем, если смещения нет
    [['a01', M.base, M.sr], ['a12', M.sr, M.lr || M.sr]].forEach(([id, a, b]) => { const e = chart.get(id); const far = Math.hypot((a.Y - b.Y) / 22000, (a.P - b.P) / 2) > 0.012; e.nodes.forEach((n) => (n.style.display = far ? '' : 'none')); });
    render();
  }
  Object.values(S).forEach((s) => s.on(() => { rd(); refresh(); }));
  variant.on((v) => {
    open = v === 'open'; pEx.hidden = !open;
    pBody.querySelector('.pn__b').replaceChildren(open ? preOpen : preClosed);
    refresh();
  });
  rd(); refresh();

  /* ── API рамки ────────────────────────────────────────────── */
  function mark() { base = { ...st }; refresh(); }
  const api = {
    charts: [chart],
    compare() { base = { ...st }; refresh(); },
    clearCompare() { base = { ...D }; refresh(); },
    reset() { base = { ...D }; Object.values(S).forEach((s) => s.reset(true)); rd(); refresh(); },
    destroy() { chart.destroy(); },
  };
  return api;
}

/* scoped styles */
const css = `
.sim--ex5-1 [hidden] { display: none !important; }
.sim--ex5-1 .seg-wrap { display: grid; gap: .35rem; }
.sim--ex5-1 .seg__lab { font: 500 .68rem/1 var(--f-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-4); }
.sim--ex5-1 .seg { min-width: 0; }
.sim--ex5-1 .seg__b { white-space: normal; line-height: 1.15; padding-inline: .4rem; }
.sim--ex5-1 .ex51__ro { margin: -.2rem .4rem 0; font: 400 .74rem/1.4 var(--f-mono); color: var(--ink-3); min-height: 2.1em; }
.sim--ex5-1 .ex51__tip { color: var(--ink-3); font-style: italic; }
`;
if (!document.getElementById('css-ex5-1')) { const s = document.createElement('style'); s.id = 'css-ex5-1'; s.textContent = css; document.head.append(s); }
