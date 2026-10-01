/* ─────────────────────────────────────────────────────────────
   Упражнение 11.1 — модель Самуэльсона — Хикса (мультипликатор + акселератор)

   C_t   = Ca + mpc·Y_{t−1}                        Ca = 50
   I_t   = Ia_t + Iин_t,   Iин_t = ν·(Y_{t−1} − Y_{t−2})
   Y_t   = C_t + Ia_t + Iин_t

   до t0 включительно экономика в динамическом равновесии:  Y_0 = 1500,
       Ia_0 = 1500 − Ca − mpc·1500 (250 при mpc = 0,8);  с периода t1  Ia = 350.
   t = 1:  Iин = 0.   t = 2:  Iин = ν·(Y_1 − Y_0)  (без ограничений).
   t ≥ 3:  Iин = max(−D, ν·(Y_{t−1} − Y_{t−2}))          — «пол»: чистое сокращение запаса
                                                            не больше амортизации D = 500;
           Y_t = min(Y_f, C_t + Ia + Iин)               — «потолок»: полная занятость, Y_f = 3000,
           если потолок достигнут, Iин = Y_f − C_t − Ia.
   Исходные значения оригинала: mpc = 0,8, ν = 2,3 (диапазоны: mpc 0,75 – 0,86; ν 1,6 – 2,9), периоды 0 … 30.
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, stat, presets, figure, legend, callout, dtable, button, symHTML } from '../ui/controls.js';

const NB = ' ';
const CA = 50, Y_PREV = 1500, T_MAX = 30;
const D0 = { mpc: 0.8, nu: 2.3, Ia1: 350, Yf: 3000, D: 500 };

/* ── the model ─────────────────────────────────────────────── */
const Ia0 = (p) => Y_PREV - CA - p.mpc * Y_PREV;
function run(p) {
  const rows = [];
  const Y = [];
  for (let t = 0; t <= T_MAX; t++) {
    let C, Ia, Iin, y, flag = '';
    if (t === 0) { C = CA + p.mpc * Y_PREV; Ia = Ia0(p); Iin = 0; y = C + Ia + Iin; }
    else if (t === 1) { C = CA + p.mpc * Y[0]; Ia = p.Ia1; Iin = 0; y = C + Ia + Iin; }
    else if (t === 2) { C = CA + p.mpc * Y[1]; Ia = p.Ia1; Iin = p.nu * (Y[1] - Y[0]); y = C + Ia + Iin; }
    else {
      C = CA + p.mpc * Y[t - 1]; Ia = p.Ia1;
      const a = p.nu * (Y[t - 1] - Y[t - 2]), b = Math.max(-p.D, a), ya = C + Ia + b;
      y = Math.min(p.Yf, ya);
      if (ya >= p.Yf) { Iin = p.Yf - C - Ia; flag = 'ceil'; } else { Iin = b; if (b > a) flag = 'floor'; }
    }
    Y.push(y);
    rows.push({ t, C, Ia, Iin, Y: y, flag });
  }
  return rows;
}
const equil = (p) => (CA + p.Ia1) / (1 - p.mpc);
const roots = (p) => { const s = p.mpc + p.nu, disc = s * s - 4 * p.nu; return { s, disc }; };
function regime(p) {
  const { disc } = roots(p);
  if (p.nu < 1 - 1e-9) return disc < 0 ? { k: 'damp-osc', t: 'Затухающие колебания', c: 'var(--d5)' } : { k: 'damp', t: 'Плавное затухание', c: 'var(--d2)' };
  if (p.nu <= 1 + 1e-9) return { k: 'const', t: 'Колебания постоянной амплитуды', c: 'var(--d6)' };
  return disc < 0 ? { k: 'exp-osc', t: 'Взрывные колебания', c: 'var(--d1)' } : { k: 'exp', t: 'Монотонный взрыв', c: 'var(--d3)' };
}
/* boundaries of the stability map in the (mpc, ν) plane */
const nuLow = (m) => (2 - m) - 2 * Math.sqrt(Math.max(0, 1 - m));
const nuHigh = (m) => (2 - m) + 2 * Math.sqrt(Math.max(0, 1 - m));

export function mount(root, env) {
  root.classList.add('sim--ex11-1');
  const L = simLayout(root);
  const st = { ...D0 };
  let base = { ...D0 };
  let rows = run(st), baseRows = run(base);
  let shown = T_MAX, timer = 0, playing = false, pick = 1;
  let marked = false;

  /* ── controls ─────────────────────────────────────────────── */
  const S = {
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.5, max: 0.95, step: 0.01, value: D0.mpc, dec: 2, color: 'var(--d2)', help: 'в оригинале 0,75 – 0,86' }),
    nu: slider({ label: 'Коэффициент акселерации', sym: 'ν', min: 0, max: 4, step: 0.1, value: D0.nu, dec: 1, color: 'var(--d5)', help: 'в оригинале 1,6 – 2,9' }),
    Ia1: slider({ label: 'Автономные инвестиции с периода t₁', sym: 'I_a', min: 200, max: 600, step: 10, value: D0.Ia1, unit: 'ден. ед.', color: 'var(--d1)' }),
    Yf: slider({ label: 'Доход при полной занятости', sym: 'Y_f', min: 2000, max: 4000, step: 100, value: D0.Yf, unit: 'ден. ед.', color: 'var(--d6)' }),
    D: slider({ label: 'Амортизация', sym: 'D', min: 0, max: 1000, step: 50, value: D0.D, unit: 'ден. ед.', color: 'var(--d3)' }),
  };
  const set = (o) => Object.keys(o).forEach((k) => S[k].set(o[k], { fromUser: true }));
  const pre = presets([
    { label: 'mpc 0,75 · ν 1,6', color: 'var(--d2)', hint: 'нижние границы диапазона из задания', apply: () => { mark(); set({ mpc: 0.75, nu: 1.6 }); } },
    { label: 'mpc 0,86 · ν 1,6', color: 'var(--d2)', hint: 'высокая склонность к потреблению, слабый акселератор', apply: () => { mark(); set({ mpc: 0.86, nu: 1.6 }); } },
    { label: 'mpc 0,75 · ν 2,9', color: 'var(--d5)', hint: 'низкая склонность, сильный акселератор', apply: () => { mark(); set({ mpc: 0.75, nu: 2.9 }); } },
    { label: 'mpc 0,86 · ν 2,9', color: 'var(--d5)', hint: 'верхние границы диапазона', apply: () => { mark(); set({ mpc: 0.86, nu: 2.9 }); } },
    { label: 'Затухание: ν = 0,8', color: 'var(--d6)', hint: 'акселератор слабее единицы — колебания гаснут', apply: () => { mark(); set({ mpc: 0.8, nu: 0.8 }); } },
    { label: 'Граница: ν = 1', color: 'var(--d1)', hint: 'колебания постоянной амплитуды', apply: () => { mark(); set({ mpc: 0.8, nu: 1.0 }); } },
    { label: 'Шире «пол»: D = 1000', color: 'var(--d3)', hint: 'инвестиции могут сокращаться сильнее', apply: () => { mark(); set({ D: 1000 }); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сочетания mpc и ν' });
  L.controls.append(
    panel({ title: 'Параметры модели', hint: 'дважды щёлкните название — сброс' }, S.mpc.el, S.nu.el, S.Ia1.el, S.Yf.el, S.D.el),
    panel({ title: 'Что будет, если…' }, pre));

  /* ── readouts ─────────────────────────────────────────────── */
  const R = {
    peak: stat({ label: 'Максимум дохода', sym: 'Y_{max}', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    end: stat({ label: 'Доход в периоде 30', sym: 'Y_30', color: 'var(--d5)' }),
    eq: stat({ label: 'Равновесие без акселератора', sym: 'Y^*', color: 'var(--d2)' }),
    mu: stat({ label: 'Мультипликатор', unit: '= 1/(1−mpc)', dec: 2, color: 'var(--d1)' }),
    nc: stat({ label: 'Периодов на потолке', sym: 'Y_f', color: 'var(--d6)' }),
    nf: stat({ label: 'Периодов на «полу»', sym: '−D', color: 'var(--d3)' }),
  };
  L.stats.append(R.peak.el, R.end.el, R.eq.el, R.mu.el, R.nc.el, R.nf.el);

  /* ── main chart: income dynamics ──────────────────────────── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: 0, max: T_MAX, label: 't', ticks: [0, 5, 10, 15, 20, 25, 30] },
    y: { min: 0, max: 3500, label: 'Y', ticks: 7, fmt: (v) => fmt(v, 0) },
    aspect: 1.65, maxH: 440, margin: { l: 56, r: 36, t: 28, b: 44 }, title: 'Динамика национального дохода',
  });
  const ptsY = (r, n) => r.slice(0, n + 1).map((q) => [q.t, q.Y]);
  chart.hline('Yf', { y: () => st.Yf, color: 'var(--d6)', dash: '6 6', width: 1.6, label: 'Y_f', labelDy: -8 });
  chart.hline('eq', { y: () => equil(st), color: 'var(--d2)', dash: '3 6', width: 1.4, label: 'Y^*', labelDy: 16 });
  chart.line('y0', { pts: ptsY(baseRows, T_MAX), color: 'var(--ink-3)', width: 2, dash: '7 6', glow: false, ghost: false, label: 'Y^0', labelAt: .98, labelDy: 18 });
  chart.line('Y', { pts: ptsY(rows, shown), color: 'var(--accent)', width: 3.4, ghost: false });
  const dots = chart.point('dot', { x: () => pick, y: () => (rows[pick] ? rows[pick].Y : 0), color: 'var(--accent)', r: 6.5, pulse: true });

  /* inspector (hover / tap a period) */
  const insp = h('div.ex111__insp', { 'aria-live': 'polite' });
  const regBadge = h('span.ex111__reg');
  const playBtnHost = h('span');
  let bPlay = button({ label: 'Проиграть', icon: 'play', sm: true, onClick: () => togglePlay() });

  /* ── stability map ────────────────────────────────────────── */
  const mapHost = h('div');
  const map = createChart(mapHost, {
    x: { min: 0.5, max: 1, label: 'mpc', ticks: [0.5, 0.6, 0.7, 0.8, 0.9, 1], fmt: (v) => fmt(v, 1) },
    y: { min: 0, max: 4, label: 'ν', ticks: [0, 1, 2, 3, 4], fmt: (v) => fmt(v, 0) },
    aspect: 1.2, maxH: 400, margin: { l: 40, r: 22, t: 26, b: 42 }, title: 'Карта режимов в плоскости mpc и ν',
  });
  const cap = (f) => (m) => Math.min(4, f(m));
  const A = { from: 0.5, to: 1, samples: 40 };
  map.area('r1', { ...A, fn: (m) => nuLow(m), fn2: () => 0, color: 'var(--d2)', opacity: .2 });
  map.area('r2', { ...A, fn: () => 1, fn2: (m) => nuLow(m), color: 'var(--d5)', opacity: .2 });
  map.area('r3', { ...A, fn: cap(nuHigh), fn2: () => 1, color: 'var(--d1)', opacity: .2 });
  map.area('r4', { ...A, fn: () => 4, fn2: cap(nuHigh), color: 'var(--d3)', opacity: .2 });
  map.line('b1', { fn: () => 1, from: 0.5, to: 1, samples: 2, color: 'var(--ink-3)', width: 1.4, dash: '5 5', glow: false, ghost: false });
  map.line('b2', { fn: nuLow, from: 0.5, to: 1, samples: 40, color: 'var(--ink-3)', width: 1.4, glow: false, ghost: false });
  map.line('b3', { fn: cap(nuHigh), from: 0.5, to: 1, samples: 40, color: 'var(--ink-3)', width: 1.4, glow: false, ghost: false });
  map.line('task', { pts: [[0.75, 1.6], [0.86, 1.6], [0.86, 2.9], [0.75, 2.9], [0.75, 1.6]], color: 'var(--ink-2)', width: 1.4, dash: '2 4', glow: false, ghost: false });
  map.text('tl', { x: 0.755, y: 3.0, text: 'задание', dx: 2, dy: -6, size: 11, color: 'var(--ink-2)' });
  map.point('p0', { x: () => base.mpc, y: () => base.nu, color: 'var(--ink-3)', r: 4.5 });
  map.point('p', { x: () => st.mpc, y: () => st.nu, color: 'var(--accent)', r: 8, pulse: true,
    draggable: ({ x, y }) => { set({ mpc: +x.toFixed(2), nu: +y.toFixed(1) }); } });

  /* ── induced investment bars ──────────────────────────────── */
  const barHost = h('div');
  const bars = createChart(barHost, {
    x: { min: -0.5, max: T_MAX + 0.5, label: 't', ticks: [0, 5, 10, 15, 20, 25, 30], fmt: (v) => fmt(v, 0) },
    y: { min: -600, max: 800, label: 'Iин', ticks: 5, fmt: (v) => fmt(v, 0) },
    aspect: 1.2, maxH: 400, margin: { l: 52, r: 18, t: 26, b: 42 }, title: 'Индуцированные инвестиции по периодам',
  });
  const barData = () => rows.slice(0, shown + 1).map((q) => ({ x: q.t, y: q.Iin, color: q.flag === 'ceil' ? 'var(--d6)' : q.flag === 'floor' ? 'var(--d3)' : 'var(--d5)' }));
  bars.hline('floor', { y: () => -st.D, color: 'var(--d3)', dash: '6 5', width: 1.4, label: '−D', labelDy: 14 });
  bars.hline('zero', { y: 0, color: 'var(--ink-3)', dash: '', width: 1, label: '' });
  bars.bars('b', { data: barData, width: 0.9 });

  const pair = h('div.ex111__pair',
    figure('Карта режимов', mapHost, { class: 'ex111__fig', note: 'Перетащите точку: каждая пара mpc и ν даёт свой режим. Серая точка — исходные значения, пунктирный прямоугольник — диапазон из задания.' }),
    figure('Индуцированные инвестиции Iин', barHost, { class: 'ex111__fig', note: 'Бирюзовые столбцы — обычные инвестиции; коралловые — упёрлись в «пол» (−D); лаймовые — «потолок» (Yf).' }));
  L.stage.append(
    figure('Динамика национального дохода', host, { right: regBadge, note: 'Ось t — периоды. Прежний путь (пунктир) остаётся после «Сравнить» или выбора сценария. Наведите курсор на график — справа внизу появятся значения периода.' }),
    h('div.ex111__bar', insp, h('span.ex111__sp'), bPlay),
    legend([{ color: 'var(--accent)', label: 'Y_t — национальный доход' }, { color: 'var(--d6)', label: 'Y_f — полная занятость', dash: true }, { color: 'var(--d2)', label: 'Y^* — равновесие без акселератора', dash: true }, { color: 'var(--ink-3)', label: 'Y^0 — до изменения', dash: true }]),
    pair,
    legend([{ color: 'var(--d2)', label: 'плавное затухание' }, { color: 'var(--d5)', label: 'затухающие колебания' }, { color: 'var(--d1)', label: 'взрывные колебания' }, { color: 'var(--d3)', label: 'монотонный взрыв' }]));

  /* ── table + explanation ──────────────────────────────────── */
  const tbl = dtable({ cols: [{ key: 't', label: 't', num: true }, { key: 'C', label: 'C', num: true }, { key: 'Ia', label: 'Ia', num: true }, { key: 'Iin', label: 'Iин', num: true }, { key: 'Y', label: 'Y', num: true }, { key: 'f', label: 'Граница' }], caption: 'Периоды 0–30: потребление, инвестиции, доход' });
  const tblWrap = h('div.ex111__tbl', tbl.el);
  const expl = callout({ tone: 'info', title: 'Как получена траектория' });
  L.notes.append(figure('Таблица по периодам', tblWrap, { class: 'ex111__fig', note: 'Строки с границей — периоды, где сработало ограничение: потолок Yf (доход не может превысить полную занятость) или пол −D (инвестиции не падают ниже амортизации).' }), expl);

  /* ── render ───────────────────────────────────────────────── */
  const f0 = (v) => fmt(v, 0).replace('-', '−');
  const f1 = (v) => fmt(v, 1);
  function drawInsp() {
    const q = rows[pick]; if (!q) return;
    const prev = pick > 0 ? rows[pick - 1] : null;
    insp.innerHTML = `<span class="ex111__t">t = ${pick}</span><span>${symHTML('Y_t')} = <b>${f0(q.Y)}</b></span><span>${symHTML('C')} = ${f0(q.C)}</span><span>${symHTML('I_a')} = ${f0(q.Ia)}</span><span>${symHTML('I_ин')} = ${f0(q.Iin)}</span>` +
      (q.flag === 'ceil' ? '<em class="is-c">потолок Y<sub>f</sub></em>' : q.flag === 'floor' ? '<em class="is-f">пол −D</em>' : '') + (prev ? `<span class="ex111__d">ΔY = ${(q.Y - prev.Y >= 0 ? '+' : '−') + f0(Math.abs(q.Y - prev.Y))}</span>` : '');
  }
  function drawDomain() {
    const mx = Math.max(st.Yf, base.Yf, ...rows.map((q) => q.Y), ...baseRows.map((q) => q.Y)) * 1.1;
    const top = Math.ceil(mx / 500) * 500;
    chart.setDomain({ y: [0, top] }, true);
    const iv = rows.map((q) => q.Iin).concat(baseRows.map((q) => q.Iin));
    const hi = Math.max(100, ...iv) * 1.15, lo = Math.min(-st.D, -base.D, ...iv) * 1.18;
    const nice = (v) => Math.sign(v) * Math.ceil(Math.abs(v) / 100) * 100;
    bars.setDomain({ y: [nice(Math.min(lo, -100)), nice(hi)] }, true);
  }
  function render() {
    const ys = rows.map((q) => q.Y), bys = baseRows.map((q) => q.Y);
    const mxV = Math.max(...ys), mxT = ys.indexOf(mxV);
    const nC = rows.filter((q) => q.flag === 'ceil').length, nF = rows.filter((q) => q.flag === 'floor').length;
    const bC = baseRows.filter((q) => q.flag === 'ceil').length, bF = baseRows.filter((q) => q.flag === 'floor').length;
    R.peak.set(mxV); R.end.set(ys[T_MAX]); R.eq.set(equil(st)); R.mu.set(1 / (1 - st.mpc)); R.nc.set(nC); R.nf.set(nF);
    R.peak.base(Math.max(...bys)); R.end.base(bys[T_MAX]); R.eq.base(equil(base)); R.mu.base(1 / (1 - base.mpc)); R.nc.base(bC); R.nf.base(bF);
    const rg = regime(st);
    regBadge.textContent = rg.t; regBadge.style.setProperty('--c', rg.c);
    tbl.set(rows.map((q) => ({ t: String(q.t), C: f0(q.C), Ia: f0(q.Ia), Iin: f0(q.Iin), Y: f0(q.Y), f: q.flag === 'ceil' ? 'потолок Yf' : q.flag === 'floor' ? 'пол −D' : '', _cls: q.flag ? 'is-lim is-' + q.flag : null })));
    drawInsp();

    /* explanation */
    const m = st.mpc, nu = st.nu, { s, disc } = roots(st);
    const q1 = rows[1], q2 = rows[2];
    let txt = `<p>${symHTML('Y_t')} = ${symHTML('C_t')} + ${symHTML('I_a')} + ${symHTML('I_ин')} = ${CA} + ${symHTML('mpc')}·${symHTML('Y_{t−1}')} + ${symHTML('I_a')} + ${symHTML('ν')}·(${symHTML('Y_{t−1}')} − ${symHTML('Y_{t−2}')}).</p>`;
    txt += `<p>До периода 0 экономика в равновесии: ${symHTML('Y_0')} = ${f0(rows[0].Y)} (при ${symHTML('I_a')} = ${f0(rows[0].Ia)}). С периода 1 автономные инвестиции равны ${f0(st.Ia1)}: ` +
      `${symHTML('Y_1')} = ${CA} + ${fmt(m, 2)}·${f0(rows[0].Y)} + ${f0(st.Ia1)} = <b>${f0(q1.Y)}</b>; ${symHTML('Y_2')} = ${CA} + ${fmt(m, 2)}·${f0(q1.Y)} + ${f0(st.Ia1)} + ${f1(nu)}·(${f0(q1.Y)} − ${f0(rows[0].Y)}) = <b>${f0(q2.Y)}</b>.</p>`;
    let why;
    if (disc < 0) {
      const ang = Math.atan2(Math.sqrt(-disc), s), per = (2 * Math.PI) / ang;
      why = `Характеристическое уравнение λ² − ${fmt(s, 2)}·λ + ${f1(nu)} = 0 имеет комплексные корни с модулем √ν = ${fmt(Math.sqrt(nu), 2)}: ` +
        (nu < 1 ? `колебания <b>затухают</b>, период около ${fmt(per, 1)} периода.` : nu > 1 ? `колебания <b>нарастают</b> (период около ${fmt(per, 1)} периода), пока не упрутся в потолок или пол.` : `амплитуда колебаний <b>не меняется</b> (период около ${fmt(per, 1)} периода).`);
    } else {
      const l1 = (s + Math.sqrt(disc)) / 2;
      why = `Корни λ² − ${fmt(s, 2)}·λ + ${f1(nu)} = 0 вещественны (наибольший ${fmt(l1, 2)}): ` + (nu < 1 ? 'доход <b>плавно сходится</b> к равновесию без колебаний.' : `доход <b>монотонно растёт</b>, пока не упрётся в потолок ${symHTML('Y_f')} = ${f0(st.Yf)}.`);
    }
    txt += `<p>${why}</p>`;
    const first = rows.find((q) => q.flag === 'ceil');
    const firstF = rows.find((q) => q.flag === 'floor');
    const lim = [];
    if (first) lim.push(`в периоде <b>${first.t}</b> доход достигает потолка ${symHTML('Y_f')} = ${f0(st.Yf)}; всего на потолке ${nC} ${nC === 1 ? 'период' : nC < 5 ? 'периода' : 'периодов'}`);
    if (firstF) lim.push(`в периоде <b>${firstF.t}</b> индуцированные инвестиции упираются в «пол» −${symHTML('D')} = −${f0(st.D)}`);
    txt += `<p>${lim.length ? 'Нелинейные ограничения: ' + lim.join('; ') + '. Они не дают колебаниям разойтись и превращают взрыв в устойчивый цикл.' : 'Ограничения (потолок и пол) не срабатывают: динамика определяется только линейной моделью.'}</p>`;
    expl.querySelector('.co__b').innerHTML = txt;
  }
  function refreshChart() {
    chart.get('Y').op.pts = ptsY(rows, shown);
    chart.get('y0').op.pts = ptsY(baseRows, T_MAX);
    const same = rows.every((q, i) => Math.abs(q.Y - baseRows[i].Y) < 1e-9);
    const e = chart.get('y0'); e.nodes.forEach((n) => { n.style.display = same ? 'none' : ''; });
    const e2 = map.get('p0'); e2.nodes.forEach((n) => { n.style.display = st.mpc === base.mpc && st.nu === base.nu ? 'none' : ''; });
    drawDomain(); chart.update(); bars.update(); map.update();
  }
  function recompute() {
    Object.keys(S).forEach((k) => (st[k] = S[k].value));
    rows = run(st); baseRows = run(base);
    refreshChart(); render();
  }
  Object.values(S).forEach((s2) => s2.on(() => { stopPlay(true); recompute(); }));

  /* hover / tap */
  chart.enableHover((xv) => { if (xv == null) return; pick = clamp(Math.round(xv), 0, shown); chart.update('dot'); drawInsp(); });
  bars.enableHover((xv) => { if (xv == null) return; pick = clamp(Math.round(xv), 0, shown); chart.update('dot'); drawInsp(); });

  /* play: reveal the path period by period */
  function togglePlay() {
    if (playing) { stopPlay(); return; }
    shown = 0; pick = 0; playing = true; swapPlay(); refreshChart(); drawInsp();
    const tick = () => {
      if (!playing) return;
      if (shown >= T_MAX) { stopPlay(); return; }
      shown++; pick = shown; refreshChart(); drawInsp();
      timer = setTimeout(tick, 230);
    };
    timer = setTimeout(tick, 350);
  }
  function stopPlay(full) { clearTimeout(timer); const was = playing; playing = false; if (was || full) { shown = T_MAX; if (was) swapPlay(); refreshChart(); } }
  function swapPlay() { const n = button({ label: playing ? 'Остановить' : 'Проиграть', icon: playing ? 'pause' : 'play', sm: true, onClick: () => togglePlay() }); bPlay.replaceWith(n); bPlay = n; }

  pick = rows.map((q) => q.Y).indexOf(Math.max(...rows.map((q) => q.Y)));
  recompute();

  /* ── frame API ────────────────────────────────────────────── */
  function mark() { base = { ...st }; marked = true; baseRows = run(base); refreshChart(); render(); }
  const api = {
    charts: [chart, map, bars],
    compare() { mark(); },
    clearCompare() { base = { ...D0 }; marked = false; baseRows = run(base); refreshChart(); render(); },
    reset() { stopPlay(); base = { ...D0 }; marked = false; Object.values(S).forEach((s2) => s2.reset(true)); recompute(); },
    destroy() { clearTimeout(timer); playing = false; chart.destroy(); map.destroy(); bars.destroy(); },
  };
  return api;
}

/* ── scoped styles ──────────────────────────────────────────── */
const css = `
.sim--ex11-1 .ex111__fig { min-width: 0; }
.sim--ex11-1 .ex111__reg { display: inline-flex; align-items: center; gap: .45rem; font: 500 .7rem/1 var(--f-mono); letter-spacing: .04em; color: var(--ink-2); text-transform: none; }
.sim--ex11-1 .ex111__reg::before { content: ""; width: .6rem; height: .6rem; border-radius: 50%; background: var(--c, var(--accent)); }
.sim--ex11-1 .ex111__bar { display: flex; align-items: center; gap: .8rem; flex-wrap: wrap; padding: .15rem .1rem; }
.sim--ex11-1 .ex111__sp { flex: 1; }
.sim--ex11-1 .ex111__insp { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 1rem; font: 400 .9rem/1.4 var(--f-serif); color: var(--ink-2); min-width: 0; }
.sim--ex11-1 .ex111__insp b { font-family: var(--f-mono); font-weight: 600; color: var(--ink); }
.sim--ex11-1 .ex111__t { font: 600 .78rem/1 var(--f-mono); color: var(--accent); letter-spacing: .06em; }
.sim--ex11-1 .ex111__d { font: 400 .78rem/1 var(--f-mono); color: var(--ink-3); }
.sim--ex11-1 .ex111__insp em { font: 500 .66rem/1 var(--f-mono); font-style: normal; letter-spacing: .06em; text-transform: uppercase; padding: .22rem .45rem; border-radius: 99px; border: 1px solid currentColor; }
.sim--ex11-1 .ex111__insp em.is-c { color: var(--d6); }
.sim--ex11-1 .ex111__insp em.is-f { color: var(--d3); }
.sim--ex11-1 .ex111__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.sim--ex11-1 .ex111__tbl { max-height: 22rem; overflow: auto; border-radius: var(--r-s); }
.sim--ex11-1 .ex111__tbl thead th { position: sticky; top: 0; background: var(--surface); z-index: 1; }
.sim--ex11-1 .ex111__tbl tr.is-lim td { background: var(--surface-2); }
.sim--ex11-1 .ex111__tbl tr.is-ceil td:last-child { color: var(--d6); }
.sim--ex11-1 .ex111__tbl tr.is-floor td:last-child { color: var(--d3); }
.sim--ex11-1 .ex111__tbl td:last-child { font: 500 .72rem/1 var(--f-mono); white-space: nowrap; }
@media (max-width: 900px) { .sim--ex11-1 .ex111__pair { grid-template-columns: 1fr; } }
`;
if (!document.getElementById('css-ex11-1')) { const s = document.createElement('style'); s.id = 'css-ex11-1'; s.textContent = css; document.head.append(s); }
