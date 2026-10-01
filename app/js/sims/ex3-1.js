/* ─────────────────────────────────────────────────────────────
   Упражнение 3.1 — модели экономического роста
   Две модели (переключатель): Харрода — Домара и Солоу — Свана.

   Харрод — Домар (фиксированные пропорции, Y = min{qN, σK}):
       Y_AS = σ·K,  S = s·Y_AS,  C = Y_AS − S,  I₀ = S₀,  I_t = I_{t−1}(1 + d_i),  Y_AD = C + I
       K_{t+1} = K_t + S_t,  N_{t+1} = N_t(1 + n).
       Гарантированный рост: σ·s = d_i (спрос = предложению) и σ·s = n (полная занятость).
       Исходно: σ = 0,25; s = 0,20; N = 200; K = 600; n = d_i = σ·s = 0,05.
   Солоу — Свана (Кобб — Дуглас, Y = N^(1−α)·K^α):
       S = s·Y,  K_{t+1} = K_t + S_t,  N_{t+1} = N_t(1 + n);  k = K/N,  q = Y/N = k^α.
       Стационарное состояние: s·q = n·k  ⇒  k* = (s/n)^(1/(1−α)).
       Исходно: α = 0,25; s = 0,20; N = 200; K = 600; n = round(s·Y₀/K₀, 5) (≈ 0,0878).
   В оригинале при смене σ, s (Х–Д) и α, s, N, K (С–С) значение n (и d_i) пересчитывается на «согласованное».
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, seg, toggle, stat, presets, figure, legend, callout, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

const HD0 = { sigma: 0.25, s: 0.2, N: 200, K: 600 };
const SW0 = { alpha: 0.25, s: 0.2, N: 200, K: 600 };
const EPS = 5e-10;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const hdNat = (p) => p.sigma * p.s;
const swNopt = (p) => r5((p.s * Math.pow(p.N, 1 - p.alpha) * Math.pow(p.K, p.alpha)) / p.K);

/* ── Харрод — Домар ───────────────────────────────────────── */
function hdRun(p, H) {
  const rows = []; let K = p.K, N = p.N, I = 0, pY = 0, pK = 0;
  const q0 = (p.sigma * p.K) / p.N;
  for (let t = 0; t <= H; t++) {
    const Y = p.sigma * K, S = p.s * Y; I = t === 0 ? S : I * (1 + p.di);
    const C = Y - S, Yd = C + I;
    rows.push({ t, K, N, Y, S, I, C, Yd, dY: t ? (Y - pY) / pY : NaN, dK: t ? (K - pK) / pK : NaN, q: Y / N, psi: K / N, Yn: q0 * N });
    pY = Y; pK = K; K += S; N *= 1 + p.n;
  }
  return rows;
}
/* ── Солоу — Свана ────────────────────────────────────────── */
function swRun(p, H) {
  const rows = []; let K = p.K, N = p.N, pY = 0, pK = 0; const b = 1 - p.alpha;
  for (let t = 0; t <= H; t++) {
    const Y = Math.pow(N, b) * Math.pow(K, p.alpha), S = p.s * Y, q = Y / N, k = K / N;
    rows.push({ t, K, N, Y, S, q, sig: Y / K, k, dY: t ? (Y - pY) / pY : NaN, dK: t ? (K - pK) / pK : NaN, sq: p.s * q, nk: p.n * k });
    pY = Y; pK = K; K += S; N *= 1 + p.n;
  }
  return rows;
}
const swStar = (p) => (p.n > 0 ? Math.pow(p.s / p.n, 1 / (1 - p.alpha)) : Infinity);
const swStarC = (p) => Math.min(swStar(p), 1e3);
const at = (rows, key, x) => { const n = rows.length - 1; const i = clamp(Math.floor(x), 0, n), j = Math.min(n, i + 1); const a = rows[i][key], b = rows[j][key]; return a + (b - a) * clamp(x - i, 0, 1); };

export function mount(root, env) {
  root.classList.add('sim--ex3-1');
  const L = simLayout(root);
  let model = 'hd';                 // 'hd' | 'sw'
  let H = 6;                        // горизонт, периодов
  const hd = { ...HD0, n: hdNat(HD0), di: hdNat(HD0) };
  const sw = { ...SW0, n: swNopt(SW0) };
  let hdBase = { ...hd }, swBase = { ...sw };
  let hdRows = hdRun(hd, H), swRows = swRun(sw, H);

  /* ── управление ───────────────────────────────────────────── */
  const modelSeg = seg({ label: 'Вариант модели', options: [{ v: 'hd', label: 'Харрод — Домар' }, { v: 'sw', label: 'Солоу — Сван' }], value: 'hd' });
  const horSeg = seg({ label: 'Горизонт, периодов', options: [{ v: 6, label: '6' }, { v: 12, label: '12' }, { v: 20, label: '20' }], value: 6 });

  const A = { // Х–Д
    sigma: slider({ label: 'Производительность капитала', sym: 'σ', min: 0.15, max: 0.4, step: 0.01, value: HD0.sigma, dec: 2, color: 'var(--d1)', help: nb('Y = σ·K: сколько выпуска даёт единица капитала.') }),
    s: slider({ label: 'Норма сбережений', sym: 's', min: 0.08, max: 0.4, step: 0.01, value: HD0.s, dec: 2, color: 'var(--d4)' }),
    N: slider({ label: 'Труд', sym: 'N_0', min: 50, max: 1000, step: 5, value: HD0.N, unit: 'ед. труда', color: 'var(--d2)' }),
    K: slider({ label: 'Капитал', sym: 'K_0', min: 100, max: 3000, step: 10, value: HD0.K, unit: 'ед. капитала', color: 'var(--d5)' }),
    n: slider({ label: 'Темп прироста труда', sym: 'n', min: 0, max: 0.2, step: 0.001, value: hdNat(HD0), dec: 3, color: 'var(--d6)' }),
    di: slider({ label: 'Темп прироста инвестиций', sym: 'd_i', min: 0, max: 0.2, step: 0.001, value: hdNat(HD0), dec: 3, color: 'var(--d3)' }),
  };
  const B = { // С–С
    alpha: slider({ label: 'Доля капитала в доходе', sym: 'α', min: 0.15, max: 0.45, step: 0.01, value: SW0.alpha, dec: 2, color: 'var(--d1)' }),
    s: slider({ label: 'Норма сбережений', sym: 's', min: 0.05, max: 0.45, step: 0.01, value: SW0.s, dec: 2, color: 'var(--d4)' }),
    N: slider({ label: 'Труд', sym: 'N_0', min: 50, max: 1000, step: 5, value: SW0.N, unit: 'ед. труда', color: 'var(--d2)' }),
    K: slider({ label: 'Капитал', sym: 'K_0', min: 100, max: 3000, step: 10, value: SW0.K, unit: 'ед. капитала', color: 'var(--d5)' }),
    n: slider({ label: 'Темп прироста труда', sym: 'n', min: 0, max: 0.25, step: 0.0001, value: swNopt(SW0), dec: 4, color: 'var(--d3)' }),
  };
  const lockHD = toggle({ label: 'n и инвестиции следуют за σ·s', hint: nb('Как в оригинале: при смене σ и s темпы возвращаются к σ·s.'), value: true, color: 'var(--accent)' });
  const lockSW = toggle({ label: 'n следует за s·Y₀/K₀', hint: nb('Как в оригинале: при смене α, s, N, K значение n подбирается так, что k₀ = k*. Выключите, чтобы менять параметры при том же n.'), value: true, color: 'var(--accent)' });
  const hdSet = (k, v) => A[k].set(v, { fromUser: true });
  const swSet = (k, v) => B[k].set(v, { fromUser: true });

  const hdPre = presets([
    { label: 'Согласовать n и инвестиции с σ·s', color: 'var(--ink-3)', hint: 'Возвращает n и темп прироста инвестиций к гарантированному темпу', apply: () => { markHD(); hdSnap(); refresh(); } },
    { label: 'Инвестиции растут быстрее: +0,005', color: 'var(--d3)', hint: 'Спрос растёт быстрее предложения', apply: () => { markHD(); hdSnap(); hdSet('di', +(hdNat(hd) + 0.005).toFixed(3)); } },
    { label: 'Инвестиции растут медленнее: −0,005', color: 'var(--d5)', hint: 'Спрос отстаёт от предложения', apply: () => { markHD(); hdSnap(); hdSet('di', +(hdNat(hd) - 0.005).toFixed(3)); } },
    { label: 'Труд растёт быстрее: n + 0,005', color: 'var(--d2)', hint: 'Труд растёт быстрее капитала — безработица', apply: () => { markHD(); hdSnap(); hdSet('n', +(hdNat(hd) + 0.005).toFixed(3)); } },
    { label: 'Труд растёт медленнее: n − 0,005', color: 'var(--d6)', hint: 'Капитал растёт быстрее труда', apply: () => { markHD(); hdSnap(); hdSet('n', +(hdNat(hd) - 0.005).toFixed(3)); } },
    { label: 'Больше сбережений: s = 0,24', color: 'var(--d4)', hint: 'Гарантированный темп σ·s растёт; n и темп инвестиций подстраиваются', apply: () => { markHD(); hdSet('s', 0.24); } },
    { label: 'Исходные значения', color: 'var(--ink-4)', apply: () => api.reset() },
  ].map((p) => ({ ...p, label: nb(p.label) })), { title: 'Сценарии' });
  const swPre = presets([
    { label: 'Сбережения выше: s = 0,30', color: 'var(--d4)', hint: 'Больше инвестиций на работника — выше k*', apply: () => { markSW(); swSet('s', 0.3); } },
    { label: 'Сбережения ниже: s = 0,15', color: 'var(--d5)', apply: () => { markSW(); swSet('s', 0.15); } },
    { label: 'Население растёт быстрее: n + 0,005', color: 'var(--d3)', hint: 'Линия n·k круче — k* ниже', apply: () => { markSW(); swSet('n', +(swNopt(sw) + 0.005).toFixed(4)); } },
    { label: 'Население медленнее: n − 0,005', color: 'var(--d2)', apply: () => { markSW(); swSet('n', +(swNopt(sw) - 0.005).toFixed(4)); } },
    { label: 'Капитала мало: K = 300', color: 'var(--d1)', hint: 'Старт левее k* — капиталовооружённость растёт', apply: () => { markSW(); lockSW.set(false, { silent: true }); swSet('K', 300); } },
    { label: 'Капитала много: K = 1200', color: 'var(--d6)', hint: 'Старт правее k* — капиталовооружённость падает', apply: () => { markSW(); lockSW.set(false, { silent: true }); swSet('K', 1200); } },
    { label: 'Исходные значения', color: 'var(--ink-4)', apply: () => api.reset() },
  ].map((p) => ({ ...p, label: nb(p.label) })), { title: 'Сценарии' });

  const pModel = panel({ title: 'Модель' }, modelSeg.el, horSeg.el);
  const pHD = panel({ title: 'Параметры Харрода — Домара', hint: 'дважды щёлкните название — сброс' }, A.sigma.el, A.s.el, A.N.el, A.K.el, A.n.el, A.di.el, lockHD.el);
  const pSW = panel({ title: 'Параметры Солоу — Свана', hint: 'дважды щёлкните название — сброс' }, B.alpha.el, B.s.el, B.N.el, B.K.el, B.n.el, lockSW.el);
  const pPre = panel({ title: 'Что будет, если…' }, hdPre);
  L.controls.append(pModel, pHD, pSW, pPre);

  /* ── показатели ───────────────────────────────────────────── */
  const RH = {
    Y: stat({ label: 'Предложение', sym: 'Y_AS', size: 'l', color: 'var(--accent)', dec: 1 }),
    D: stat({ label: 'Спрос', sym: 'Y_AD', color: 'var(--d5)', dec: 1 }),
    G: stat({ label: 'Разрыв AD − AS', color: 'var(--d3)', dec: 1 }),
    W: stat({ label: 'Гарантированный темп', sym: 'σ·s', unit: '%', dec: 2, color: 'var(--d1)' }),
    E: stat({ label: 'Загрузка труда', sym: 'Y_AS / qN', unit: '%', dec: 1, color: 'var(--d2)' }),
  };
  const RS = {
    Y: stat({ label: 'Выпуск', sym: 'Y', size: 'l', color: 'var(--accent)', dec: 1 }),
    q: stat({ label: 'Выпуск на работника', sym: 'q', color: 'var(--d2)', dec: 3 }),
    k: stat({ label: 'Капиталовооружённость', sym: 'k', color: 'var(--d5)', dec: 3 }),
    ks: stat({ label: 'Стационарное значение', sym: 'k^*', color: 'var(--d1)', dec: 3 }),
    gK: stat({ label: 'Темп роста капитала', sym: 'dK/K', unit: '%', dec: 2, color: 'var(--d3)' }),
  };

  /* ── графики: Х–Д ─────────────────────────────────────────── */
  const hA = h('div'), hB = h('div');
  const cA = createChart(hA, {
    x: { min: 0, max: H, label: 't', ticks: 6, fmt: (v) => String(Math.round(v)) },
    y: { min: 0, max: 100, label: 'Y', ticks: 5 },
    aspect: 1.5, maxH: 400, margin: { l: 62, r: 34, t: 30, b: 44 }, title: 'Предложение и спрос по периодам',
  });
  cA.area('gap', { fn: (x) => at(hdRows, 'Yd', x), fn2: (x) => at(hdRows, 'Y', x), from: 0, to: H, color: 'var(--d3)', opacity: 0.22 });
  cA.line('yn', { fn: (x) => at(hdRows, 'Yn', x), from: 0, to: H, color: 'var(--ink-3)', width: 2, dash: '2 7', label: 'q·N', labelAt: 0.5, labelDy: 40, labelDx: -4, glow: false, ghost: false });
  cA.line('as', { fn: (x) => at(hdRows, 'Y', x), from: 0, to: H, color: 'var(--d1)', width: 3.4, label: 'Y_AS', labelAt: 0.97, labelDy: 22, labelDx: -42 });
  cA.line('ad', { fn: (x) => at(hdRows, 'Yd', x), from: 0, to: H, color: 'var(--d5)', width: 3.4, label: 'Y_AD', labelAt: 0.97, labelDy: -12, labelDx: -42 });
  cA.vline('hz', { x: () => H, color: 'var(--ink-4)', dash: '3 6', width: 1.2 });
  cA.point('pas', { x: () => H, y: () => at(hdRows, 'Y', H), color: 'var(--d1)', r: 5.5 });
  cA.point('pad', { x: () => H, y: () => at(hdRows, 'Yd', H), color: 'var(--d5)', r: 5.5 });

  const cB = createChart(hB, {
    x: { min: 0.35, max: 3.65, label: '', ticks: [], hideTicks: true, arrow: false },
    y: { min: 0, max: 8, label: '% за период', ticks: 4, fmt: (v) => fmt(v, 1) },
    aspect: 1.5, maxH: 400, margin: { l: 56, r: 24, t: 30, b: 50 }, title: 'Три темпа роста',
  });
  const rate = (i) => [hdNat(hd), hd.n, hd.di][i] * 100;
  const cols = ['var(--d1)', 'var(--d2)', 'var(--d3)'];
  cB.bars('b', { data: () => [0, 1, 2].map((i) => ({ x: i + 1, y: rate(i), color: cols[i] })), width: 0.55 });
  cB.hline('ws', { y: () => hdNat(hd) * 100, color: 'var(--ink-2)', dash: '5 5', width: 1.4 });
  ['σ·s', 'n', 'd_i'].forEach((t, i) => {
    cB.text('l' + i, { x: i + 1, y: 0, text: t, dy: 22, anchor: 'middle', color: 'var(--ink-2)', size: 15 });
    cB.text('v' + i, { x: i + 1, y: () => rate(i), text: '', dy: -9, anchor: 'middle', color: 'var(--ink)', size: 13 });
  });

  /* ── графики: С–С ─────────────────────────────────────────── */
  const hC = h('div'), hD = h('div');
  const fk = (k) => Math.pow(Math.max(k, 0), sw.alpha);
  const cC = createChart(hC, {
    x: { min: 0, max: 8, label: 'k', ticks: 8, fmt: (v) => fmt(v, v % 1 ? 1 : 0) },
    y: { min: 0, max: 1.8, label: 'q', ticks: 6, fmt: (v) => fmt(v, 1) },
    aspect: 1.45, maxH: 440, margin: { l: 52, r: 34, t: 30, b: 44 }, title: 'Диаграмма Солоу: f(k), s·f(k), n·k',
  });
  cC.line('f', { fn: fk, from: 0, to: 8, color: 'var(--d5)', width: 3.2, label: 'f(k)', labelAt: 0.95, labelDy: -12, labelDx: -40 });
  cC.line('sf', { fn: (k) => sw.s * fk(k), from: 0, to: 8, color: 'var(--d1)', width: 3.4, label: 's·f(k)', labelAt: 0.97, labelDy: 20, labelDx: -62 });
  cC.line('nk', { fn: (k) => sw.n * k, from: 0, to: 8, color: 'var(--d3)', width: 3, label: 'n·k', labelAt: 0.55, labelDy: -14, labelDx: -4 });
  cC.vline('ks', { x: () => swStarC(sw), color: 'var(--accent)', dash: '5 6', width: 1.6, label: 'k^*', labelDx: 8 });
  cC.point('st', { x: () => swStarC(sw), y: () => sw.s * fk(swStarC(sw)), color: 'var(--accent)', r: 7.5, pulse: true });
  cC.point('k0', { x: () => sw.K / sw.N, y: () => sw.s * fk(sw.K / sw.N), color: 'var(--ink)', r: 5.5, label: 'k_0', labelDx: -6, labelDy: -12 });
  cC.point('k0f', { x: () => sw.K / sw.N, y: () => fk(sw.K / sw.N), color: 'var(--ink)', r: 4.5 });
  cC.vline('k0v', { x: () => sw.K / sw.N, color: 'var(--ink-3)', dash: '2 5', width: 1.2, ghost: false });

  const cD = createChart(hD, {
    x: { min: 0, max: H, label: 't', ticks: 6, fmt: (v) => String(Math.round(v)) },
    y: { min: 0, max: 0.2, label: 'темп роста', ticks: 5, fmt: (v) => fmt(v * 100, 1) + '%' },
    aspect: 1.5, maxH: 420, margin: { l: 62, r: 34, t: 30, b: 44 }, title: 'Темпы роста капитала и выпуска',
  });
  const gAt = (key) => (x) => (x < 1 ? NaN : at(swRows, key, x));
  cD.hline('nn', { y: () => sw.n, color: 'var(--d3)', dash: '5 5', width: 1.6, label: 'n', labelDy: -8 });
  cD.line('gK', { fn: gAt('dK'), from: 1, to: H, color: 'var(--d5)', width: 3.2, label: 'dK/K', labelAt: 0.5, labelDy: -14 });
  cD.line('gY', { fn: gAt('dY'), from: 1, to: H, color: 'var(--d1)', width: 3.2, label: 'dY/Y', labelAt: 0.5, labelDy: 22 });

  /* таблица траектории (аналог исходного Grid) */
  const trajHost = h('div.ex31__tbl');
  const trajFig = figure('Траектория: периоды 0 — ' + H, trajHost, { class: 'ex31__traj' });
  const trajCap = trajFig.querySelector('figcaption span');
  const baseHost = h('div.ex31__tbl');
  const expl = callout({ tone: 'info', title: 'Что показывает модель' });

  const lgHD = legend([
    { color: 'var(--d1)', label: 'Y_AS = σ·K — предложение' }, { color: 'var(--d5)', label: 'Y_AD = C + I — спрос' },
    { color: 'var(--ink-3)', label: 'q·N — выпуск при полной занятости труда', dash: true }, { color: 'var(--d3)', label: 'разрыв AD и AS' }]);
  const lgSW = legend([
    { color: 'var(--d5)', label: 'f(k) = k^α — выпуск на работника' }, { color: 'var(--d1)', label: 's·f(k) — сбережения на работника' },
    { color: 'var(--d3)', label: 'n·k — инвестиции, сохраняющие k' }, { color: 'var(--accent)', label: 'k^* — стационарное состояние', dash: true }]);

  const figsHD = [
    figure('Предложение и спрос', hA, { note: nb('Предложение растёт с капиталом, спрос — со скоростью прироста инвестиций. Закрашенная область — разрыв между ними; пунктир — выпуск, который мог бы обеспечить растущий труд (q·N).') }),
    figure('Условие гарантированного роста', hB, { note: nb('Совпадают ли гарантированный темп σ·s, темп прироста труда n и темп прироста инвестиций?') }),
  ];
  const figsSW = [
    figure('Диаграмма Солоу', hC, { note: nb('Пока s·f(k) выше n·k, капиталовооружённость растёт; пересечение — стационарное состояние k*. Точка k₀ = K₀/N₀ — стартовое состояние.') }),
    figure('Темпы роста', hD, { note: nb('В стационарном состоянии капитал, труд и выпуск растут одним темпом n.') }),
  ];
  const statsHD = [RH.Y.el, RH.D.el, RH.G.el, RH.W.el, RH.E.el];
  const statsSW = [RS.Y.el, RS.q.el, RS.k.el, RS.ks.el, RS.gK.el];

  /* ── переключение модели ──────────────────────────────────── */
  function show() {
    const isHD = model === 'hd';
    pHD.hidden = !isHD; pSW.hidden = isHD;
    pPre.querySelector('.pn__b').replaceChildren(isHD ? hdPre : swPre);
    L.stats.replaceChildren(...(isHD ? statsHD : statsSW));
    L.stage.replaceChildren(...(isHD ? figsHD : figsSW));
    L.notes.replaceChildren(isHD ? lgHD : lgSW, trajFig, baseHost, expl);
    L.stage.classList.add('is-2');
    root.dataset.model = model;
    render();
    (isHD ? [cA, cB] : [cC, cD]).forEach((c) => { c.update(); });
  }

  /* ── пересчёт и вывод ─────────────────────────────────────── */
  const f2 = (v) => fmt(v, 2), f4 = (v) => fmt(v, 4);
  const sgn = (v, d = 2) => (Math.abs(v) < Math.pow(10, -d) / 2 ? '' : v > 0 ? '+' : '−') + fmt(Math.abs(v), d);
  function table(host, head, rowsDef) {
    const thead = h('thead', h('tr', ...head.map((c, i) => h('th', { class: i ? 'num' : null, scope: 'col' }, c))));
    const tbody = h('tbody', ...rowsDef.map((r) => h('tr', h('th', { scope: 'row', html: symHTML(r[0]) }), ...r[1].map((v) => h('td.num', v)))));
    host.replaceChildren(h('div.dt', h('table', thead, tbody)));
  }

  function renderHD() {
    const last = hdRows[H], first = hdRows[0], b = hdRun(hdBase, H)[H];
    const w = hdNat(hd);
    RH.Y.set(last.Y); RH.D.set(last.Yd); RH.G.set(last.Yd - last.Y); RH.W.set(w * 100);
    RH.E.set((last.Y / last.Yn) * 100);
    RH.Y.base(b.Y); RH.D.base(b.Yd); RH.G.base(b.Yd - b.Y); RH.W.base(hdNat(hdBase) * 100); RH.E.base((b.Y / b.Yn) * 100);
    ['v0', 'v1', 'v2'].forEach((id, i) => cB.get(id).setText(fmt(rate(i), 2).replace(/ /g, '') + '%'));
    table(trajHost, ['Период t', ...hdRows.map((r) => String(r.t))], [
      ['K', hdRows.map((r) => f2(r.K))], ['N', hdRows.map((r) => f2(r.N))], ['Y_AS', hdRows.map((r) => f2(r.Y))],
      ['S', hdRows.map((r) => f2(r.S))], ['I', hdRows.map((r) => f2(r.I))], ['C', hdRows.map((r) => f2(r.C))], ['Y_AD', hdRows.map((r) => f2(r.Yd))],
      ['dY/Y', hdRows.map((r) => (r.t ? f4(r.dY) : '—'))], ['dK/K', hdRows.map((r) => (r.t ? f4(r.dK) : '—'))],
      ['q = Y/N', hdRows.map((r) => f4(r.q))], ['K/N', hdRows.map((r) => f4(r.psi))],
    ]);
    trajCap.textContent = 'Траектория: периоды 0 — ' + H;
    const bb = hdRun(hdBase, H);
    table(baseHost, ['Показатель в периоде ' + H, 'Исходно', 'Сейчас', 'Изменение'], [
      ['Y_AS', [f2(bb[H].Y), f2(last.Y), sgn(last.Y - bb[H].Y)]],
      ['Y_AD', [f2(bb[H].Yd), f2(last.Yd), sgn(last.Yd - bb[H].Yd)]],
      ['K', [f2(bb[H].K), f2(last.K), sgn(last.K - bb[H].K)]],
      ['N', [f2(bb[H].N), f2(last.N), sgn(last.N - bb[H].N)]],
      ['σ·s', [f4(hdNat(hdBase)), f4(w), sgn(w - hdNat(hdBase), 4)]],
      ['q = Y/N', [f4(bb[H].q), f4(last.q), sgn(last.q - bb[H].q, 4)]],
    ]);
    const okAD = Math.abs(w - hd.di) < EPS, okN = Math.abs(w - hd.n) < EPS;
    const txt = okAD && okN ? 'В стране выполнено условие гарантированного роста национального дохода. Гарантированный темп роста НД обеспечивает полное использование растущего объёма капитала и поддерживает полную занятость трудовых ресурсов.'
      : !okAD && okN ? 'В стране не выполнено условие гарантированного роста национального дохода. Не обеспечивается полное использование растущего объёма капитала, но поддерживается полная занятость трудовых ресурсов.'
        : okAD && !okN ? 'В стране выполнено условие гарантированного роста национального дохода. Гарантированный темп роста НД обеспечивает полное использование растущего объёма капитала, но не поддерживается полная занятость трудовых ресурсов.'
          : 'В стране не выполнено условие гарантированного роста национального дохода. Не обеспечивается полное использование растущего объёма капитала и не поддерживается полная занятость трудовых ресурсов.';
    const tone = okAD && okN ? 'ok' : 'warn';
    const gapTxt = Math.abs(last.Yd - last.Y) < 0.005 ? `в периоде ${H} спрос и предложение совпадают`
      : last.Yd > last.Y ? `в периоде ${H} спрос превышает предложение на <b>${f2(last.Yd - last.Y)}</b> (инфляционное давление)`
        : `в периоде ${H} спрос меньше предложения на <b>${f2(last.Y - last.Yd)}</b> (часть мощностей простаивает)`;
    const labTxt = okN ? 'труд растёт тем же темпом, что и выпуск'
      : hd.n > w ? `труд растёт быстрее выпуска (${fmt(hd.n * 100, 1)} % против ${fmt(w * 100, 2)} %): возникает избыток рабочей силы — безработица`
        : `труд растёт медленнее выпуска (${fmt(hd.n * 100, 1)} % против ${fmt(w * 100, 2)} %): капитал не обеспечен работниками`;
    expl.className = 'co co--' + tone;
    expl.querySelector('.co__t').textContent = okAD && okN ? 'Гарантированный рост: условие выполнено' : 'Гарантированный рост: условие нарушено';
    expl.querySelector('.co__b').innerHTML =
      `<p>${nb(txt)}</p>` +
      `<p>${symHTML('σ')}·${symHTML('s')} = ${f2(hd.sigma)}·${f2(hd.s)} = <b>${fmt(w, 4)}</b>; ${symHTML('n')} = <b>${fmt(hd.n, 3)}</b>; ${symHTML('d_i')} = <b>${fmt(hd.di, 3)}</b>.</p>` +
      `<p>${nb('Поскольку')} ${symHTML('K')} ${nb('растёт на')} ${symHTML('S')} = ${symHTML('s')}·${symHTML('Y')}, ${nb('предложение')} ${symHTML('Y_AS')} = ${symHTML('σ')}·${symHTML('K')} ${nb('растёт темпом')} ${symHTML('σ')}·${symHTML('s')}. ${nb(gapTxt)}; ${nb(labTxt)}.</p>`;
  }

  function renderSW() {
    const last = swRows[H], b = swRun(swBase, H), bl = b[H], star = swStar(sw), s0 = swStar(swBase);
    const kS = Number.isFinite(star) ? star : NaN;
    RS.Y.set(last.Y); RS.q.set(last.q); RS.k.set(last.k); RS.ks.set(kS); RS.gK.set((H ? last.dK : NaN) * 100);
    RS.Y.base(bl.Y); RS.q.base(bl.q); RS.k.base(bl.k); RS.ks.base(s0); RS.gK.base((H ? bl.dK : NaN) * 100);
    table(trajHost, ['Период t', ...swRows.map((r) => String(r.t))], [
      ['K', swRows.map((r) => f2(r.K))], ['N', swRows.map((r) => f2(r.N))], ['Y', swRows.map((r) => f2(r.Y))],
      ['q = Y/N', swRows.map((r) => f4(r.q))], ['Y/K', swRows.map((r) => f4(r.sig))], ['k = K/N', swRows.map((r) => f4(r.k))],
      ['dY/Y', swRows.map((r) => (r.t ? f4(r.dY) : '—'))], ['dK/K', swRows.map((r) => (r.t ? f4(r.dK) : '—'))],
      ['s·q', swRows.map((r) => f4(r.sq))], ['n·k', swRows.map((r) => f4(r.nk))],
    ]);
    trajCap.textContent = 'Траектория: периоды 0 — ' + H;
    table(baseHost, ['Показатель в периоде ' + H, 'Исходно', 'Сейчас', 'Изменение'], [
      ['Y', [f2(bl.Y), f2(last.Y), sgn(last.Y - bl.Y)]],
      ['q = Y/N', [f4(bl.q), f4(last.q), sgn(last.q - bl.q, 4)]],
      ['k = K/N', [f4(bl.k), f4(last.k), sgn(last.k - bl.k, 4)]],
      ['k^*', [Number.isFinite(s0) ? f4(s0) : '—', Number.isFinite(kS) ? f4(kS) : '—', Number.isFinite(kS) && Number.isFinite(s0) ? sgn(kS - s0, 4) : '']],
      ['n', [f4(swBase.n), f4(sw.n), sgn(sw.n - swBase.n, 4)]],
    ]);
    const k0 = sw.K / sw.N, f0 = Math.pow(k0, sw.alpha), sav = sw.s * f0, brk = sw.n * k0;
    const diff = sav - brk;
    let dir;
    if (Math.abs(diff) < 5e-4 * Math.max(f0, 1e-9)) dir = nb('Сбережения на работника равны инвестициям, сохраняющим k: экономика уже в стационарном состоянии — K, N и Y растут одним темпом n, а q и k постоянны.');
    else if (diff > 0) dir = nb('Сбережения на работника больше, чем нужно для сохранения k: капиталовооружённость растёт, q увеличивается — экономика движется к k*, и темпы роста Y и K превышают n.');
    else dir = nb('Сбережения на работника меньше, чем нужно для сохранения k: капиталовооружённость падает, q снижается — экономика движется к k*, и темпы роста Y и K ниже n.');
    expl.className = 'co co--info';
    expl.querySelector('.co__t').textContent = 'Динамика капиталовооружённости';
    expl.querySelector('.co__b').innerHTML =
      `<p>${symHTML('k')}<sub>0</sub> = ${f2(sw.K)}/${f2(sw.N)} = <b>${fmt(k0, 3)}</b>; ${symHTML('s')}·${symHTML('f')}(${symHTML('k')}<sub>0</sub>) = ${f2(sw.s)}·${fmt(f0, 3)} = <b>${fmt(sav, 4)}</b>; ${symHTML('n')}·${symHTML('k')}<sub>0</sub> = ${fmt(sw.n, 4)}·${fmt(k0, 3)} = <b>${fmt(brk, 4)}</b>.</p>` +
      `<p>${dir}</p>` +
      `<p>${symHTML('k^*')} = (${symHTML('s')}/${symHTML('n')})<sup>1/(1−α)</sup> = (${f2(sw.s)}/${fmt(sw.n, 4)})<sup>${fmt(1 / (1 - sw.alpha), 2)}</sup> = <b>${Number.isFinite(kS) ? fmt(kS, 3) : '—'}</b>${nb('. Стартовое значение по умолчанию совпадает с k*, потому что n = s·Y₀/K₀.')}</p>`;
  }
  function render() { if (model === 'hd') renderHD(); else renderSW(); }

  /* домены графиков */
  function fitHD() {
    const ys = hdRows.flatMap((r) => [r.Y, r.Yd, r.Yn]); const mx = Math.max(...ys), mn = Math.min(...ys), rg = mx - mn;
    const lo = Math.max(0, mn - rg * 0.45 - 0.02 * mx), hi = mx + rg * 0.25 + 0.03 * mx;
    ['gap', 'yn', 'as', 'ad'].forEach((id) => (cA.get(id).op.to = H));
    cA.setDomain({ x: [0, H], y: [lo, hi] }, true);
    const rmax = Math.max(hdNat(hd), hd.n, hd.di, 0.02) * 100; cB.setDomain({ y: [0, rmax * 1.3] }, true);
  }
  function fitSW() {
    const star = swStar(sw), k0 = sw.K / sw.N, kH = swRows[H].k;
    const need = Math.max(8, Math.ceil(1.25 * Math.max(k0, kH, Number.isFinite(star) ? Math.min(star, 60) : 0)));
    const kx = need; const ym = Math.max(fk(kx), 0.2) * 1.1;
    ['f', 'sf', 'nk'].forEach((id) => (cC.get(id).op.to = kx));
    cC.setDomain({ x: [0, kx], y: [0, ym] }, true);
    ['gK', 'gY'].forEach((id) => (cD.get(id).op.to = H));
    const gm = Math.max(sw.n, ...swRows.slice(1).flatMap((r) => [r.dK, r.dY]), 0.01);
    cD.setDomain({ x: [0, H], y: [0, gm * 1.25] }, true);
  }
  function refresh() {
    if (model === 'hd') { hdRows = hdRun(hd, H); fitHD(); cA.update(); cB.update(); } else { swRows = swRun(sw, H); fitSW(); cC.update(); cD.update(); }
    render();
  }

  /* ── события ──────────────────────────────────────────────── */
  const rd = (o, S) => Object.keys(S).forEach((k) => (o[k] = S[k].value));
  function hdSnap() { A.n.set(hdNat(hd), { silent: true }); A.di.set(hdNat(hd), { silent: true }); hd.n = A.n.value; hd.di = A.di.value; }
  Object.keys(A).forEach((k) => A[k].on((v, fromUser) => {
    rd(hd, A);
    if ((k === 'sigma' || k === 's') && lockHD.value) { hd.n = hd.di = hdNat(hd); A.n.set(hd.n, { silent: true }); A.di.set(hd.di, { silent: true }); }
    refresh();
  }));
  const swSnap = () => { const v = swNopt(sw); B.n.set(v, { silent: true }); sw.n = B.n.value; };
  Object.keys(B).forEach((k) => B[k].on(() => {
    rd(sw, B);
    if (k !== 'n' && lockSW.value) { sw.n = swNopt(sw); B.n.set(sw.n, { silent: true }); }
    refresh();
  }));
  lockHD.on((v) => { if (v) { hdSnap(); refresh(); } });
  lockSW.on((v) => { if (v) { swSnap(); refresh(); } });
  modelSeg.on((v) => { model = v; ghostClear(); show(); refresh(); });
  horSeg.on((v) => {
    H = v; hdRows = hdRun(hd, H); swRows = swRun(sw, H);
    [cA, cB, cC, cD].forEach((c) => c.clearGhosts());
    cA.setDomain({ x: [0, H] }, false); cD.setDomain({ x: [0, H] }, false); refresh();
  });
  rd(hd, A); rd(sw, B); hdRows = hdRun(hd, H); swRows = swRun(sw, H);
  show(); fitHD(); fitSW(); cA.update(true); cB.update(true); cC.update(true); cD.update(true); render();

  /* ── API рамки ────────────────────────────────────────────── */
  function markHD() { hdBase = { ...hd }; cA.snapshot(); cB.snapshot(); }
  function markSW() { swBase = { ...sw }; cC.snapshot(); cD.snapshot(); }
  function ghostClear() { [cA, cB, cC, cD].forEach((c) => c.clearGhosts()); hdBase = { ...hd }; swBase = { ...sw }; }
  const api = {
    get charts() { return model === 'hd' ? [cA, cB] : [cC, cD]; },
    compare() { if (model === 'hd') markHD(); else markSW(); render(); },
    clearCompare() { ghostClear(); hdBase = { ...hd0() }; swBase = { ...sw0() }; render(); },
    reset() {
      ghostClear();
      lockHD.set(true, { silent: true }); lockSW.set(true, { silent: true });
      Object.values(A).forEach((s) => s.reset(true)); Object.values(B).forEach((s) => s.reset(true));
      rd(hd, A); rd(sw, B); hd.n = hd.di = hdNat(hd); A.n.set(hd.n, { silent: true }); A.di.set(hd.di, { silent: true });
      sw.n = swNopt(sw); B.n.set(sw.n, { silent: true }); rd(hd, A); rd(sw, B);
      hdBase = { ...hd }; swBase = { ...sw };
      hdRows = hdRun(hd, H); swRows = swRun(sw, H); fitHD(); fitSW(); [cA, cB, cC, cD].forEach((c) => c.update()); render();
    },
    destroy() { [cA, cB, cC, cD].forEach((c) => c.destroy()); },
  };
  const hd0 = () => ({ ...HD0, n: hdNat(HD0), di: hdNat(HD0) });
  const sw0 = () => ({ ...SW0, n: swNopt(SW0) });
  hdBase = hd0(); swBase = sw0(); render();
  return api;
}

/* scoped styles */
const css = `
.sim--ex3-1 [hidden] { display: none !important; }
.sim--ex3-1 .seg-wrap { display: grid; gap: .35rem; margin-bottom: .8rem; }
.sim--ex3-1 .seg-wrap:last-child { margin-bottom: 0; }
.sim--ex3-1 .seg__lab { font: 500 .68rem/1 var(--f-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-4); }
.sim--ex3-1 .ex31__traj { overflow: hidden; }
.sim--ex3-1 .ex31__tbl { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.sim--ex3-1 .ex31__tbl .dt { min-width: max-content; }
.sim--ex3-1 .ex31__tbl th[scope="row"] { text-align: left; font: 500 .84rem/1.2 var(--f-serif); text-transform: none; letter-spacing: 0; color: var(--ink-2); white-space: nowrap; position: sticky; left: 0; background: var(--surface); }
.sim--ex3-1 .ex31__tbl td.num, .sim--ex3-1 .ex31__tbl th.num { white-space: nowrap; }
.sim--ex3-1 .co--ok { border-color: var(--ok); }
.sim--ex3-1 .co--warn { border-color: var(--warn); }
`;
if (!document.getElementById('css-ex3-1')) { const s = document.createElement('style'); s.id = 'css-ex3-1'; s.textContent = css; document.head.append(s); }
