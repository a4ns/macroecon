/* ─────────────────────────────────────────────────────────────
   Упражнение 12.1 — модель малой открытой экономики
   (сбережения, инвестиции, чистый экспорт и движение капитала)

   Y = C + I + G + Nx,  C = Ca + mpc·Yd,  Yd = Y − T,  T = Ta + t·Y,  I = Ia − d·r
   Sp = −Ca + (1 − mpc)(Y − Ta − t·Y),  Sg = Ta + t·Y − G,  Sn = Sp + Sg
   В открытой экономике ставка мировая: I = Ia − d·r*,  Nx = Sn − I,  CF = I − Sn
   В закрытой экономике ставка уравновешивает Sn = I:  r = (Ia − Sn) / d
   Исходно: Y=40000, Ca=5500, mpc=.75, Ia=18000, d=400, Ta=500, t=20 %, G=6875, r*=35 %.
   ───────────────────────────────────────────────────────────── */
import { h, fmt } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, stat, presets, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

const D = { Y: 40000, Ca: 5500, mpc: 0.75, Ia: 18000, d: 400, Ta: 500, t: 20, G: 6875, r: 35 };

/* модель — чистая функция состояния */
function calc(s) {
  const tax = s.t / 100;
  const T = s.Ta + tax * s.Y;
  const Yd = s.Y - T;
  const C = s.Ca + s.mpc * Yd;
  const Sp = Yd - C;                      // = −Ca + (1−mpc)(Y − Ta − tax·Y)
  const Sg = T - s.G;
  const Sn = Sp + Sg;
  const I = s.Ia - s.d * s.r;
  return { T, Yd, C, Sp, Sg, Sn, I, rv: (s.Ia - Sn) / s.d, Xn: Sn - I, CF: I - Sn };
}

export function mount(root, env) {
  root.classList.add('sim--ex12-1');
  const L = simLayout(root);
  const st = { ...D };
  let base = { ...D };
  let m = calc(st), mb = calc(base);

  /* ── управление ───────────────────────────────────────────── */
  const S = {
    Y: slider({ label: 'Доход (потенциальный выпуск)', sym: 'Y', min: 30000, max: 50000, step: 500, value: D.Y, unit: 'ден. ед.', color: 'var(--d1)' }),
    Ca: slider({ label: 'Автономное потребление', sym: 'C_a', min: 3500, max: 7500, step: 100, value: D.Ca, unit: 'ден. ед.', color: 'var(--d2)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.6, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d2)' }),
    Ia: slider({ label: 'Автономные инвестиции', sym: 'I_a', min: 15000, max: 21000, step: 100, value: D.Ia, unit: 'ден. ед.', color: 'var(--d5)' }),
    d: slider({ label: 'Чувствительность инвестиций к ставке', sym: 'd', min: 300, max: 450, step: 1, value: D.d, color: 'var(--d5)' }),
    Ta: slider({ label: 'Автономные налоги', sym: 'T_a', min: 0, max: 2000, step: 50, value: D.Ta, unit: 'ден. ед.', color: 'var(--d4)' }),
    t: slider({ label: 'Налоговая ставка', sym: 't', min: 0, max: 40, step: 1, value: D.t, unit: '%', color: 'var(--d4)' }),
    G: slider({ label: 'Государственные расходы', sym: 'G', min: 3000, max: 10000, step: 25, value: D.G, unit: 'ден. ед.', color: 'var(--d4)' }),
    r: slider({ label: 'Мировая ставка процента', sym: 'r^*', min: 15, max: 55, step: 1, value: D.r, unit: '%', color: 'var(--d6)' }),
  };
  const set = (k, v) => S[k].set(v, { fromUser: true });
  const pre = presets([
    { label: 'Бюджетный стимул: G +500', color: 'var(--d4)', hint: 'Государство тратит больше: Sg падает, а с ним и Sn', apply: () => { mark(); set('G', st.G + 500); } },
    { label: 'Налоги: t +5 п.п.', color: 'var(--d4)', hint: 'Бюджет улучшается, Sg растёт', apply: () => { mark(); set('t', st.t + 5); } },
    { label: 'Мировая ставка r* +5 п.п.', color: 'var(--d6)', hint: 'Инвестиции дома дорожают, капитал уходит за границу', apply: () => { mark(); set('r', st.r + 5); } },
    { label: 'Бум инвестиций: Ia +1000', color: 'var(--d5)', hint: 'Фирмы хотят инвестировать больше при той же ставке', apply: () => { mark(); set('Ia', st.Ia + 1000); } },
    { label: 'Экономим: mpc −0,05', color: 'var(--d2)', hint: 'Домохозяйства потребляют меньше и сберегают больше', apply: () => { mark(); set('mpc', +(st.mpc - 0.05).toFixed(2)); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии' });

  L.controls.append(
    panel({ title: 'Частный сектор', hint: 'дважды щёлкните название — сброс' }, S.Y.el, S.Ca.el, S.mpc.el, S.Ia.el, S.d.el),
    panel({ title: 'Государство' }, S.Ta.el, S.t.el, S.G.el),
    panel({ title: 'Остальной мир' }, S.r.el),
    panel({ title: 'Что будет, если…' }, pre));

  /* ── показатели ───────────────────────────────────────────── */
  const R = {
    Xn: stat({ label: 'Сальдо текущих операций', sym: 'Nx', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    CF: stat({ label: 'Сальдо движения капитала', sym: 'CF', color: 'var(--d3)' }),
    Sn: stat({ label: 'Национальные сбережения', sym: 'S_n', color: 'var(--d4)' }),
    I: stat({ label: 'Инвестиции', sym: 'I', color: 'var(--d2)' }),
    rv: stat({ label: 'Ставка в закрытой экономике', sym: 'r', unit: '%', dec: 2, color: 'var(--ink-2)' }),
  };
  L.stats.append(R.Xn.el, R.CF.el, R.Sn.el, R.I.el, R.rv.el);

  /* ── график: рынок заёмных средств ────────────────────────── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: -8000, max: 20000, label: 'I, S, тыс.', ticks: 7, fmt: (v) => fmt(v / 1000, 0) },
    y: { min: 5, max: 60, label: 'r, %', ticks: 6, fmt: (v) => fmt(v, 0) },
    aspect: 1.35, maxH: 520, margin: { l: 42, r: 30, t: 30, b: 44 }, title: 'Сбережения, инвестиции и ставка процента',
  });
  chart.vline('zero', { x: 0, color: 'var(--line-3)', dash: '', width: 1.4 });
  chart.line('S', { pts: [[0, -200], [0, 400]], color: 'var(--d4)', width: 3.4, glow: false });
  chart.line('I', { pts: [[0, -200], [0, 400]], color: 'var(--d2)', width: 3.4, glow: false });
  chart.hline('rs', { y: () => st.r, color: 'var(--d6)', dash: '7 6', width: 1.8, label: 'r^*', labelDy: -7 });
  chart.line('rv', { pts: [[0, 0], [0, 0]], color: 'var(--ink-3)', width: 1.7, dash: '2 6', glow: false, ghost: false });
  chart.line('nx', { pts: [[0, 0], [0, 0]], color: 'var(--d3)', width: 5.5, glow: false, ghost: false });
  chart.text('tS', { x: () => m.Sn, y: () => chart.domain().y[1], text: 'S_n', dx: 7, dy: 16, color: 'var(--d4)' });
  chart.text('tI', { x: () => st.Ia - st.d * (chart.domain().y[0] + 5), y: () => chart.domain().y[0] + 5, text: 'I', dx: -14, dy: -6, color: 'var(--d2)' });
  chart.text('tNx', { x: () => (m.Sn + m.I) / 2, y: () => st.r, text: 'Nx', anchor: 'middle', dy: -10, color: 'var(--d3)' });
  chart.point('closed', { x: () => m.Sn, y: () => m.rv, color: 'var(--ink-2)', r: 5, label: 'r', labelDx: -16, labelDy: 20 });
  chart.point('open', {
    x: () => m.I, y: () => st.r, color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'I', y: 'r^*' },
    draggable: (p) => set('r', Math.round(p.y)),
  });

  /* линии зависят только от состояния модели; концы уходят далеко за пределы поля и обрезаются */
  function setPts(id, pts) { chart.get(id).op.pts = pts; }
  function geometry() {
    setPts('S', [[m.Sn, -200], [m.Sn, 400]]);
    setPts('I', [[st.Ia + st.d * 200, -200], [st.Ia - st.d * 400, 400]]);
    setPts('rv', [[0, m.rv], [m.Sn, m.rv]]);
    setPts('nx', [[m.Sn, st.r], [m.I, st.r]]);
  }

  /* поле графика подстраивается под состояние, чтобы всё оставалось видимым */
  let dom = { x: [-8000, 20000], y: [5, 60] };
  function domainFor() {
    const xs = [m.Sn, m.I, 0], rs = [st.r, m.rv];
    const xlo = Math.min(-8000, Math.floor((Math.min(...xs) - 2500) / 4000) * 4000);
    const xhi = Math.max(20000, Math.ceil((Math.max(...xs) + 2500) / 4000) * 4000);
    const ylo = Math.min(5, Math.floor((Math.min(...rs) - 4) / 5) * 5);
    const yhi = Math.max(60, Math.ceil((Math.max(...rs) + 4) / 5) * 5);
    return { x: [xlo, xhi], y: [ylo, yhi] };
  }
  function fitDomain() {
    const n = domainFor();
    if (n.x[0] !== dom.x[0] || n.x[1] !== dom.x[1] || n.y[0] !== dom.y[0] || n.y[1] !== dom.y[1]) { dom = n; chart.setDomain(n, true); }
  }

  /* ── баланс сбережений и инвестиций (столбики) ────────────── */
  const bal = h('div.ex12__bal', { role: 'img', 'aria-label': 'Сбережения, инвестиции и сальдо операций с заграницей' });
  const BR = [
    { k: 'Sp', label: 'S_p', name: 'Частные сбережения', color: 'var(--d2)', v: (q) => q.Sp },
    { k: 'Sg', label: 'S_g', name: 'Сбережения государства (T − G)', color: 'var(--d4)', v: (q) => q.Sg },
    { k: 'Sn', label: 'S_n', name: 'Национальные сбережения', color: 'var(--d4)', v: (q) => q.Sn, sum: true },
    { k: 'I', label: 'I', name: 'Инвестиции при ставке r*', color: 'var(--d5)', v: (q) => q.I },
    { k: 'Xn', label: 'Nx', name: 'Сальдо текущих операций = Sn − I', color: 'var(--d3)', v: (q) => q.Xn, sum: true },
    { k: 'CF', label: 'CF', name: 'Сальдо движения капитала = I − Sn', color: 'var(--d3)', v: (q) => q.CF },
  ];
  const rowEls = BR.map((b) => {
    const fill = h('i.ex12__fill'), val = h('b'), nm = h('span.ex12__nm', { html: `<i class="sym">${symHTML(b.label)}</i> ${nb(b.name)}` });
    const row = h('div.ex12__row' + (b.sum ? '.is-sum' : ''), { style: { '--c': b.color } }, nm, h('div.ex12__bar', h('s'), fill), val);
    bal.append(row);
    return { fill, val };
  });

  L.stage.append(
    figure('Рынок заёмных средств: инвестиции и сбережения', host, { note: nb('Точка — открытая экономика: инвестиции определяются мировой ставкой r*, и её можно потянуть по вертикали. Серый кружок — равновесие закрытой экономики, где Sn = I.') }),
    figure('Баланс сбережений и инвестиций', bal, { class: 'ex12__fig', note: nb('Всё, что сбережено сверх инвестиций, уходит за границу: Nx = Sn − I, а сальдо капитала CF = −Nx.') }),
  );
  L.stage.append(legend([
    { color: 'var(--d4)', label: 'S_n — национальные сбережения' }, { color: 'var(--d2)', label: 'I — спрос на инвестиции' },
    { color: 'var(--d6)', label: 'r^* — мировая ставка', dash: true }, { color: 'var(--d3)', label: 'Nx — чистый экспорт' }]));

  /* ── таблица «до / после» + пояснение ─────────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получено' });
  L.notes.append(tbl.el, expl);

  const f0 = (v) => fmt(v, 0), f2 = (v) => fmt(v, 2);
  const sg = (v, d = 0) => (v > 0.5 * Math.pow(10, -d) ? '+' : v < -0.5 * Math.pow(10, -d) ? '−' : '') + fmt(Math.abs(v), d);
  const sy = symHTML;

  function render() {
    R.Xn.set(m.Xn); R.CF.set(m.CF); R.Sn.set(m.Sn); R.I.set(m.I); R.rv.set(m.rv);
    R.Xn.base(mb.Xn); R.CF.base(mb.CF); R.Sn.base(mb.Sn); R.I.base(mb.I); R.rv.base(mb.rv);

    const mx = Math.max(1, ...BR.map((b) => Math.abs(b.v(m))), ...BR.map((b) => Math.abs(b.v(mb))));
    BR.forEach((b, i) => {
      const v = b.v(m), w = Math.abs(v) / mx * 50;
      rowEls[i].fill.style.left = (v >= 0 ? 50 : 50 - w) + '%'; rowEls[i].fill.style.width = w + '%';
      rowEls[i].val.textContent = (v > 0.5 ? '+' : '') + f0(v);
    });

    tbl.set([
      { k: 'r^* — мировая ставка, %', a: f0(base.r), b: f0(st.r), d: sg(st.r - base.r) },
      { k: 'r — ставка в закрытой экономике, %', a: f2(mb.rv), b: f2(m.rv), d: sg(m.rv - mb.rv, 2) },
      { k: 'S_p — частные сбережения', a: f0(mb.Sp), b: f0(m.Sp), d: sg(m.Sp - mb.Sp) },
      { k: 'S_g — сбережения государства', a: f0(mb.Sg), b: f0(m.Sg), d: sg(m.Sg - mb.Sg) },
      { k: 'S_n — национальные сбережения', a: f0(mb.Sn), b: f0(m.Sn), d: sg(m.Sn - mb.Sn), _cls: 'is-total' },
      { k: 'I — инвестиции', a: f0(mb.I), b: f0(m.I), d: sg(m.I - mb.I) },
      { k: 'Nx — сальдо текущих операций', a: f0(mb.Xn), b: f0(m.Xn), d: sg(m.Xn - mb.Xn), _cls: 'is-total' },
      { k: 'CF — сальдо движения капитала', a: f0(mb.CF), b: f0(m.CF), d: sg(m.CF - mb.CF), _cls: 'is-total' },
    ]);

    const tx = st.t / 100;
    const p1 = `<p>${sy('S_p')} = −${sy('C_a')} + (1 − ${sy('mpc')})(${sy('Y')} − ${sy('T_a')} − ${sy('t')}·${sy('Y')}) = −${f0(st.Ca)} + ${fmt(1 - st.mpc, 2)}·(${f0(st.Y)} − ${f0(st.Ta)} − ${fmt(tx, 2)}·${f0(st.Y)}) = <b>${f0(m.Sp)}</b>; ${sy('S_g')} = ${sy('T_a')} + ${sy('t')}·${sy('Y')} − ${sy('G')} = <b>${f0(m.Sg)}</b>; ${sy('S_n')} = <b>${f0(m.Sn)}</b>.</p>`;
    const p2 = `<p>${sy('I')} = ${sy('I_a')} − ${sy('d')}·${sy('r^*')} = ${f0(st.Ia)} − ${f0(st.d)}·${f0(st.r)} = <b>${f0(m.I)}</b>. ${nb('В закрытой экономике сбережения и инвестиции уравновешивала бы ставка')} ${sy('r')} = (${sy('I_a')} − ${sy('S_n')})/${sy('d')} = <b>${f2(m.rv)} %</b>.</p>`;
    let verdict;
    if (Math.abs(m.Xn) < 0.5) verdict = nb('<b>Внешнее равновесие.</b> Сбережения равны инвестициям, Nx = 0 и CF = 0: мировая ставка совпала с ставкой закрытой экономики, капитал не перетекает.');
    else if (m.Xn > 0) verdict = nb(`<b>Сбережения превышают инвестиции на ${f0(m.Xn)}.</b> Мировая ставка выше ставки закрытой экономики (${f2(st.r)} % против ${f2(m.rv)} %), поэтому часть сбережений уходит за границу: чистый экспорт Nx = +${f0(m.Xn)}, чистый отток капитала CF = −${f0(m.Xn)}.`);
    else verdict = nb(`<b>Инвестиции превышают сбережения на ${f0(-m.Xn)}.</b> Мировая ставка ниже ставки закрытой экономики (${f2(st.r)} % против ${f2(m.rv)} %), поэтому недостающие средства приходят из-за границы: Nx = −${f0(-m.Xn)} (дефицит), приток капитала CF = +${f0(m.CF)}.`);
    const dxn = m.Xn - mb.Xn;
    const diff = Math.abs(dxn) < 0.5 ? '' : `<p class="ex12__tip">${nb(`По сравнению с исходным состоянием сальдо текущих операций изменилось на ${sg(dxn)}: ${dxn < 0 ? 'страна стала больше занимать у мира (или меньше ссужать)' : 'страна стала больше ссужать миру (или меньше занимать)'}.`)}</p>`;
    expl.querySelector('.co__b').innerHTML = p1 + p2 + `<p>${verdict}</p>` + diff;
  }

  /* ── обновление ───────────────────────────────────────────── */
  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); m = calc(st); mb = calc(base); }
  function refresh() {
    readState(); geometry(); fitDomain();
    chart.update();
    const moved = Math.abs(m.Xn) > 0.5;
    chart.get('nx').nodes.forEach((n) => (n.style.opacity = moved ? 1 : 0));
    chart.get('tNx').nodes.forEach((n) => (n.style.opacity = moved ? 1 : 0));
    render();
  }
  Object.values(S).forEach((s) => s.on(refresh));
  refresh();

  /* ── API рамки ────────────────────────────────────────────── */
  function mark() { base = { ...st }; chart.snapshot(); mb = calc(base); render(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { chart.clearGhosts(); base = { ...D }; refresh(); },
    reset() { chart.clearGhosts(); base = { ...D }; Object.values(S).forEach((s) => s.reset(true)); refresh(); },
    destroy() { chart.destroy(); },
  };
  return api;
}

/* стили модели */
const css = `
.sim--ex12-1 .ex12__bal { display: grid; gap: .55rem; padding: .3rem .4rem .5rem; }
.sim--ex12-1 .ex12__row { display: grid; grid-template-columns: minmax(0, 12.5rem) minmax(0, 1fr) 4.6rem; gap: .8rem; align-items: center; }
.sim--ex12-1 .ex12__nm { font: 400 .86rem/1.25 var(--f-sans); color: var(--ink-2); min-width: 0; }
.sim--ex12-1 .ex12__nm .sym { font: italic 500 1rem/1 var(--f-serif); color: var(--c); margin-right: .25rem; }
.sim--ex12-1 .ex12__row.is-sum .ex12__nm { color: var(--ink); font-weight: 500; }
.sim--ex12-1 .ex12__bar { position: relative; height: 1.15rem; border-radius: 4px; background: color-mix(in oklab, var(--ink) 5%, transparent); }
.sim--ex12-1 .ex12__bar s { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--line-3); }
.sim--ex12-1 .ex12__fill { position: absolute; top: 2px; bottom: 2px; border-radius: 3px; background: var(--c); transition: left .55s var(--ease), width .55s var(--ease); }
.sim--ex12-1 .ex12__row b { font: 500 .86rem/1 var(--f-mono); font-variant-numeric: tabular-nums; color: var(--ink); text-align: right; }
.sim--ex12-1 .ex12__tip { font: italic 300 .95rem/1.45 var(--f-serif); color: var(--ink-3); }
@media (max-width: 560px) {
  .sim--ex12-1 .ex12__row { grid-template-columns: minmax(0, 1fr) 4.2rem; gap: .25rem .6rem; }
  .sim--ex12-1 .ex12__nm { grid-column: 1 / -1; }
  .sim--ex12-1 .ex12__bar { grid-column: 1; }
}
`;
if (!document.getElementById('css-ex12-1')) { const s = document.createElement('style'); s.id = 'css-ex12-1'; s.textContent = css; document.head.append(s); }
