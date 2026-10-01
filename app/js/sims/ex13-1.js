/* ─────────────────────────────────────────────────────────────
   Упражнение 13.1 — эффективность фискальной и монетарной политики
   в моделях IS–LM–BP (Манделла — Флеминга) и AD–AS, малая открытая экономика.

   IS:  Y = Ya − d/MLR · r,   Ya = (Ca + Ia + G + Xn_a − mpc·Ta) / MLR,   MLR = 1 − mpc(1 − t) + mpm
        Xn_a = Ex − Im − c_e·e,    Nx = Xn_a − mpm·Y
   LM:  Y = M/(k·P) + (h/k) · r
   BP = 0:  r = (m·r* − Xn_a + mpm·Y − CA) / m,    CF = CA + m·(r − r*),   BP = Nx + CF
   AD:  Y = h·A/(d·k + h·MLR) + d/(d·k + h·MLR) · M/P

   Три «периода» оригинала:
     0 — исходное равновесие;
     1 — шок экзогенной переменной, курс e пока прежний, r свободна;
     2 — приспособление:  плавающий курс — r = r*, Y = (M/P + h·r*)/k, подстраивается e;
                          фиксированный курс — e = const, r = r*, Y — по IS, подстраивается M (резервы).
   Исходно: M=20000, k=.85, Ta=500, t=20 %, G=6875, h=400, P=1, Yf=40000, Ex=1640, Im=1000,
            mpm=.001, c_e=12, e=50, m=1000, r*=35 %.
   ───────────────────────────────────────────────────────────── */
import { h, fmt } from '../core/dom.js';
import { createChart, mathText } from '../ui/plot.js';
import { simLayout, panel, slider, seg, stat, presets, button, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

const K = { Ca: 5500, mpc: 0.75, Ia: 18000, d: 400, h: 400, P: 1, Yf: 40000, Ex: 1640, Im: 1000, mpm: 0.001, ce: 12, e0: 50, CA: 0, m: 1000, rw: 35 };
const B0 = { M: 20000, k: 0.85, Ta: 500, t: 20, G: 6875 };

/* крайние значения факторов — как в оригинале (для k «максимум» = 0,80: LM смещается вправо, как при росте M) */
const FACT = {
  M: { label: 'M', name: 'Денежное предложение', max: 21000, min: 19000, lo: 19000, hi: 21000, step: 50, unit: 'ден. ед.', color: 'var(--d3)' },
  k: { label: 'k', name: 'Чувствительность спроса на деньги к доходу', max: 0.8, min: 0.9, lo: 0.8, hi: 0.9, step: 0.01, dec: 2, color: 'var(--d3)' },
  Ta: { label: 'T_a', name: 'Автономные налоги', max: 1000, min: 1, lo: 1, hi: 1000, step: 1, unit: 'ден. ед.', color: 'var(--d5)' },
  t: { label: 't', name: 'Налоговая ставка', max: 30, min: 10, lo: 10, hi: 30, step: 1, unit: '%', color: 'var(--d5)' },
  G: { label: 'G', name: 'Государственные расходы', max: 7975, min: 4975, lo: 4975, hi: 7975, step: 25, unit: 'ден. ед.', color: 'var(--d5)' },
};

/* ── модель ────────────────────────────────────────────────── */
function curves(p, e) {
  const tax = p.t / 100;
  const Xna = K.Ex - K.Im - K.ce * e;
  const A = K.Ca + K.Ia + p.G + Xna - K.mpc * p.Ta;
  const MLR = 1 - K.mpc * (1 - tax) + K.mpm;
  return { Xna, A, MLR, Ya: A / MLR, dr: K.d / MLR };
}
/* показатели в точке (Y, r) при курсе e */
function indicators(p, e, Y, r) {
  const tax = p.t / 100;
  const T = p.Ta + tax * Y, Yd = Y - T, C = K.Ca + K.mpc * Yd, I = K.Ia - K.d * r;
  const Xn = K.Ex - K.Im - K.mpm * Y - K.ce * e;
  const Sp = Yd - C, B = T - p.G;
  return { T, Yd, C, I, Xn, Sp, B, Sn: Sp + B, u: 7 - (1 / 3) * ((Y - K.Yf) * 100) / K.Yf, P: K.P };
}
/* пересечение IS и LM при заданных параметрах и курсе */
function shortRun(p, e) {
  const c = curves(p, e);
  const den = p.k * K.d + K.h * c.MLR;
  const Y = (K.h * c.A) / den + (K.d / den) * (p.M / K.P);
  const r = (p.k * Y) / K.h - p.M / (K.h * K.P);
  return { c, Y, r };
}

function solve(p, regime) {
  /* период 0 — базовые параметры */
  const q0 = shortRun(B0, K.e0), i0 = indicators(B0, K.e0, q0.Y, q0.r);
  const s0 = { p: B0, e: K.e0, M: B0.M, k: B0.k, ...q0.c, Y: q0.Y, r: q0.r, ...i0, CF: K.CA + K.m * (q0.r - K.rw), dRes: 0 };
  s0.BP = s0.Xn + s0.CF - s0.dRes;
  /* период 1 — шок, курс прежний */
  const q1 = shortRun(p, K.e0), i1 = indicators(p, K.e0, q1.Y, q1.r);
  const s1 = { p, e: K.e0, M: p.M, k: p.k, ...q1.c, Y: q1.Y, r: q1.r, ...i1, CF: K.CA + K.m * (q1.r - K.rw), dRes: 0 };
  s1.BP = s1.Xn + s1.CF - s1.dRes;
  /* период 2 — приспособление */
  let s2;
  const tax = p.t / 100;
  if (regime === 'float') {
    const Y = (p.M / K.P) / p.k + (K.h / p.k) * K.rw;
    const Xna1 = Y + K.mpm * Y - K.Ca - K.mpc * (Y - p.Ta - tax * Y) - K.Ia + K.d * K.rw - p.G;
    const e = (K.Ex - K.Im - Xna1) / K.ce;
    const A = K.Ca + K.Ia + p.G + Xna1 - K.mpc * p.Ta;
    const MLR = 1 - K.mpc * (1 - tax) + K.mpm;
    const ind = indicators(p, e, Y, K.rw);
    s2 = { p, e, M: p.M, k: p.k, Xna: Xna1, A, MLR, Ya: A / MLR, dr: K.d / MLR, Y, r: K.rw, ...ind, CF: -ind.Xn, dRes: 0 };
  } else {
    const c = curves(p, K.e0);
    const Y = c.Ya - c.dr * K.rw;
    const M = (Y - (K.h / p.k) * K.rw) * (p.k * K.P);
    const ind = indicators(p, K.e0, Y, K.rw);
    const dRes = M - B0.M;
    s2 = { p, e: K.e0, M, k: p.k, ...c, Y, r: K.rw, ...ind, CF: -ind.Xn + dRes, dRes };
  }
  s2.BP = s2.Xn + s2.CF - s2.dRes;
  return [s0, s1, s2];
}

/* кривые на графиках в виде функций состояния периода */
const rBP = (s, Y) => (K.m * K.rw - s.Xna + K.mpm * Y - K.CA) / K.m;
const denAD = (s) => s.k * K.d + K.h * s.MLR;
const yAD = (s, P) => (K.h * s.A) / denAD(s) + (K.d / denAD(s)) * (s.M / P);

const X0 = 24000, X1 = 62000, R0 = 20, R1 = 50, P0 = 0.5, P1 = 1.5;
const ADP = Array.from({ length: 21 }, (_, i) => P0 + ((P1 - P0) * i) / 20);

export function mount(root, env) {
  root.classList.add('sim--ex13-1');
  const L = simLayout(root);
  const st = { regime: 'float', fa: 'M', fb: 'G', stage: 1 };
  let res = solve(B0, st.regime);
  let timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* ── управление ───────────────────────────────────────────── */
  const sl = (k) => { const f = FACT[k]; return slider({ label: f.name, sym: f.label, min: f.lo, max: f.hi, step: f.step, value: B0[k], unit: f.unit || '', dec: f.dec, color: f.color }); };
  const S = { M: sl('M'), k: sl('k'), Ta: sl('Ta'), t: sl('t'), G: sl('G') };

  const sRegime = seg({ label: 'Режим валютного курса', value: st.regime, options: [{ v: 'float', label: 'Плавающий', hint: 'Курс свободно подстраивается, ЦБ не вмешивается' }, { v: 'fixed', label: 'Фиксированный', hint: 'ЦБ удерживает курс, меняя денежное предложение' }] });
  const sA = seg({ label: 'Фактор (а) — денежный рынок', value: st.fa, options: [{ v: 'M', label: 'M', hint: 'Предложение денег' }, { v: 'k', label: 'k', hint: 'Чувствительность спроса на деньги к доходу' }] });
  const sB = seg({ label: 'Фактор (б) — бюджет', value: st.fb, options: [{ v: 'Ta', label: 'Ta', hint: 'Автономные налоги' }, { v: 't', label: 't', hint: 'Налоговая ставка' }, { v: 'G', label: 'G', hint: 'Госрасходы' }] });
  const sStage = seg({ label: 'Показать период', value: st.stage, options: [{ v: 0, label: 'Исходно', hint: 'Период 0 — до шока' }, { v: 1, label: 'Период 1', hint: 'Сразу после шока, курс прежний' }, { v: 2, label: 'Период 2', hint: 'После приспособления' }] });
  const stageNote = h('p.ex13__note');
  const playBtn = button({ label: 'Проиграть 0 → 1 → 2', icon: 'play', sm: true, onClick: () => play() });

  const slidersA = h('div.ex13__sl', S.M.el, S.k.el), slidersB = h('div.ex13__sl', S.Ta.el, S.t.el, S.G.el);
  const range = h('p.ex13__note');

  const set = (k, v) => S[k].set(v, { fromUser: true });
  const pickA = (k) => { if (st.fa !== k) { sA.set(k); } };
  const pickB = (k) => { if (st.fb !== k) { sB.set(k); } };
  const corner = (a, b) => () => { set(st.fa, FACT[st.fa][a]); set(st.fb, FACT[st.fb][b]); play(); };
  const pre = presets([
    { label: '(а) макс · (б) макс', color: 'var(--d1)', hint: 'Оба фактора до максимума', apply: corner('max', 'max') },
    { label: '(а) макс · (б) мин', color: 'var(--d2)', apply: corner('max', 'min') },
    { label: '(а) мин · (б) макс', color: 'var(--d4)', apply: corner('min', 'max') },
    { label: '(а) мин · (б) мин', color: 'var(--d5)', apply: corner('min', 'min') },
    { label: 'Фискальный шок: G до максимума', color: 'var(--d5)', hint: 'Только бюджет: G = 7 975', apply: () => { resetShocks(); pickB('G'); set('G', FACT.G.max); play(); } },
    { label: 'Монетарный шок: M до максимума', color: 'var(--d3)', hint: 'Только деньги: M = 21 000', apply: () => { resetShocks(); pickA('M'); set('M', FACT.M.max); play(); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии из задания' });

  L.controls.append(
    panel({ title: 'Режим курса' }, sRegime.el),
    panel({ title: 'Экзогенные переменные', hint: 'дважды щёлкните название — сброс' }, sA.el, slidersA, sB.el, slidersB, range),
    panel({ title: 'Как изменяется экономика' }, sStage.el, stageNote, playBtn),
    panel({ title: 'Что будет, если…' }, pre));

  /* ── показатели ───────────────────────────────────────────── */
  const R = {
    Y: stat({ label: 'Доход', sym: 'Y', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    r: stat({ label: 'Ставка процента', sym: 'r', unit: '%', dec: 2, color: 'var(--d3)' }),
    Xn: stat({ label: 'Чистый экспорт', sym: 'Nx', color: 'var(--d2)' }),
    CF: stat({ label: 'Сальдо капитала', sym: 'CF', color: 'var(--d5)' }),
    e: stat({ label: 'Курс', sym: 'e', dec: 2, color: 'var(--d6)' }),
    M: stat({ label: 'Денежное предложение', sym: 'M', color: 'var(--d4)' }),
  };
  L.stats.append(R.Y.el, R.r.el, R.Xn.el, R.CF.el, R.e.el, R.M.el);

  /* ── график 1: IS — LM — BP ───────────────────────────────── */
  const hostA = h('div');
  const cA = createChart(hostA, {
    x: { min: X0, max: X1, label: 'Y, тыс.', ticks: [30000, 40000, 50000, 60000], fmt: (v) => fmt(v / 1000, 0) },
    y: { min: R0, max: R1, label: 'r, %', ticks: [20, 25, 30, 35, 40, 45, 50], fmt: (v) => fmt(v, 0) },
    aspect: 1.25, maxH: 470, margin: { l: 40, r: 30, t: 30, b: 44 }, title: 'Модель IS–LM–BP',
  });
  const v = () => res[st.stage];
  const ends = (f) => [[f(R0), R0], [f(R1), R1]];
  const geo = {
    IS: (s) => ends((r) => s.Ya - s.dr * r),
    LM: (s) => ends((r) => s.M / (K.P * s.k) + (K.h / s.k) * r),
    BP: (s) => [[X0, rBP(s, X0)], [X1, rBP(s, X1)]],
  };
  cA.line('IS0', { pts: geo.IS(res[0]), color: 'var(--d5)', width: 1.8, dash: '5 6', glow: false, ghost: false });
  cA.line('LM0', { pts: geo.LM(res[0]), color: 'var(--d3)', width: 1.8, dash: '5 6', glow: false, ghost: false });
  cA.line('BP', { pts: geo.BP(res[0]), color: 'var(--d2)', width: 2.6, glow: false, label: 'BP = 0', labelAt: 1, labelAnchor: 'end', labelDy: -9 });
  cA.line('IS', { pts: geo.IS(res[0]), color: 'var(--d5)', width: 3.4, label: 'IS', labelAt: 0, labelDx: 8, labelDy: -8 });
  cA.line('LM', { pts: geo.LM(res[0]), color: 'var(--d3)', width: 3.4, label: 'LM', labelAt: 1, labelDx: 8, labelDy: 6 });
  cA.text('tIS0', { x: () => res[0].Ya - res[0].dr * R0, y: R0, text: 'IS_0', dx: 8, dy: -26, color: 'var(--d5)', size: 12 });
  cA.text('tLM0', { x: () => res[0].M / (K.P * res[0].k) + (K.h / res[0].k) * R1, y: R1, text: 'LM_0', dx: 8, dy: 22, color: 'var(--d3)', size: 12 });
  cA.point('E0', { x: () => res[0].Y, y: () => res[0].r, color: 'var(--ink-3)', r: 4.5 });
  cA.point('E', { x: () => v().Y, y: () => v().r, color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'Y', y: 'r' } });

  /* ── график 2: AD — AS ────────────────────────────────────── */
  const hostB = h('div');
  const cB = createChart(hostB, {
    x: { min: X0, max: X1, label: 'Y, тыс.', ticks: [30000, 40000, 50000, 60000], fmt: (v2) => fmt(v2 / 1000, 0) },
    y: { min: P0, max: P1, label: 'P', ticks: [0.5, 0.75, 1, 1.25, 1.5], fmt: (v2) => fmt(v2, 2) },
    aspect: 1.25, maxH: 470, margin: { l: 44, r: 30, t: 30, b: 44 }, title: 'Модель AD–AS',
  });
  const adPts = (s) => ADP.map((P) => [yAD(s, P), P]);
  cB.line('AD0', { pts: adPts(res[0]), color: 'var(--d4)', width: 1.8, dash: '5 6', glow: false, ghost: false });
  cB.line('AD', { pts: adPts(res[0]), color: 'var(--d4)', width: 3.4, label: 'AD', labelAt: 0, labelDx: 6, labelDy: 2 });
  cB.hline('SRAS', { y: () => K.P, color: 'var(--d6)', dash: '', width: 2.8, label: 'SRAS', labelDy: -8 });
  cB.vline('LRAS', { x: () => K.Yf, color: 'var(--ink-3)', dash: '8 5', width: 2.4, label: 'LRAS', labelDx: 8 });
  cB.text('tAD0', { x: () => yAD(res[0], P0), y: P0, text: 'AD_0', dx: 8, dy: -26, color: 'var(--d4)', size: 12 });
  cB.point('E0', { x: () => res[0].Y, y: K.P, color: 'var(--ink-3)', r: 4.5 });
  cB.point('E', { x: () => v().Y, y: K.P, color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'Y' } });

  function setPts(c, id, pts) { c.get(id).op.pts = pts; }
  function setHidden(c, ids, hide) { ids.forEach((id) => c.get(id).nodes.forEach((n) => (n.style.opacity = hide ? 0 : ''))); }

  L.stage.classList.add('is-2');
  L.stage.append(
    figure('Модель IS–LM–BP', hostA, { note: nb('Точка — равновесие выбранного периода; серый кружок и пунктир — исходное положение. Линия BP = 0 почти горизонтальна: капитал очень чувствителен к ставке.') }),
    figure('Модель AD–AS', hostB, { note: nb('При фиксированных ценах (SRAS) выпуск определяется спросом: AD пересекает горизонталь P = 1 там же, где IS и LM.') }));
  L.notes.append(legend([
    { color: 'var(--d5)', label: 'IS' }, { color: 'var(--d3)', label: 'LM' }, { color: 'var(--d2)', label: 'BP = 0' },
    { color: 'var(--d4)', label: 'AD' }, { color: 'var(--d6)', label: 'SRAS' }, { color: 'var(--ink-3)', label: 'LRAS — потенциальный выпуск', dash: true }]));

  /* ── таблица периодов, матрица эффективности, пояснение ───── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Период 1', num: true }, { key: 'c', label: 'Период 2', num: true }] });
  const tblWrap = h('div.ex13__tbl', { dataset: { stage: String(st.stage) } }, tbl.el);
  const mx = dtable({ cols: [{ key: 'k', label: 'Режим курса' }, { key: 'a', label: 'Монетарная политика (а)' }, { key: 'b', label: 'Фискальная политика (б)' }] });
  const expl = callout({ tone: 'info', title: 'Как получено' });
  const verdict = callout({ tone: 'ok', title: 'При каком режиме политика эффективна' });
  L.notes.append(expl, tblWrap, verdict);
  const mxBox = h('div.ex13__mx', mx.el);
  verdict.append(mxBox);

  const f0 = (x) => fmt(x, 0), f2 = (x) => fmt(x, 2);
  const sg = (x, d = 0) => (x > 0.5 * Math.pow(10, -d) ? '+' : x < -0.5 * Math.pow(10, -d) ? '−' : '') + fmt(Math.abs(x), d);
  const sy = symHTML;

  function params() { return { M: S.M.value, k: S.k.value, Ta: S.Ta.value, t: S.t.value, G: S.G.value }; }
  const monChanged = (p) => Math.abs(p.M - B0.M) > 1e-9 || Math.abs(p.k - B0.k) > 1e-9;
  const fisChanged = (p) => Math.abs(p.Ta - B0.Ta) > 1e-9 || Math.abs(p.t - B0.t) > 1e-9 || Math.abs(p.G - B0.G) > 1e-9;

  function tableRows() {
    const rows = [
      ['M — денежное предложение', 'M', 0], ['k', 'k', 2], ['T_a — автономные налоги', 'Ta', 0, (s) => s.p.Ta], ['t — налоговая ставка, %', 't', 0, (s) => s.p.t], ['G — госрасходы', 'G', 0, (s) => s.p.G],
      ['C — потребление', 'C', 0], ['I — инвестиции', 'I', 0], ['Nx — чистый экспорт', 'Xn', 0, null, true], ['Y — доход', 'Y', 0, null, true],
      ['Y_f — потенциальный выпуск', 'Yf', 0, () => K.Yf], ['u — безработица, %', 'u', 2], ['P — уровень цен', 'P', 2], ['r — ставка процента, %', 'r', 2],
      ['S_p — частные сбережения', 'Sp', 0], ['T — налоги', 'T', 0], ['B = T − G — сальдо бюджета', 'B', 0], ['S_n — национальные сбережения', 'Sn', 0],
      ['CF — сальдо движения капитала', 'CF', 0, null, true], ['BP — сальдо платёжного баланса', 'BP', 0, null, true], ['e — курс (номинальный = реальный)', 'e', 2],
    ];
    return rows.map(([label, key, dec, get, tot]) => {
      const g = get || ((s) => s[key]);
      const o = { k: label, _cls: tot ? 'is-total' : null };
      ['a', 'b', 'c'].forEach((c, i) => { const val = g(res[i]); o[c] = fmt(Math.abs(val) < 0.5 * Math.pow(10, -dec) ? 0 : val, dec); });
      return o;
    });
  }

  /* эффективность политик при предельных значениях выбранных факторов (по периоду 2) */
  function matrix() {
    const out = [];
    for (const reg of ['float', 'fixed']) {
      const pm = { ...B0, [st.fa]: FACT[st.fa].max }, pf = { ...B0, [st.fb]: FACT[st.fb].max };
      const y0 = solve(B0, reg)[2].Y, ym = solve(pm, reg)[2].Y - y0, yf = solve(pf, reg)[2].Y - y0;
      const cell = (d) => (Math.abs(d) < 0.5 ? 'ΔY = 0 — неэффективна' : `ΔY = ${sg(d)} — эффективна`);
      out.push({ k: reg === 'float' ? 'Плавающий' : 'Фиксированный', a: cell(ym), b: cell(yf), _cls: reg === st.regime ? 'is-total' : null });
    }
    return out;
  }

  function explain() {
    const p = params(), s0 = res[0], s1 = res[1], s2 = res[2], fl = st.regime === 'float';
    const mon = monChanged(p), fis = fisChanged(p);
    const lines = [];
    const lm = (s) => `${sy('Y')} = ${f0(s.M / (K.P * s.k))} + ${f2(K.h / s.k)}·${sy('r')}`;
    const is = (s) => `${sy('Y')} = ${f0(s.Ya)} − ${f2(s.dr)}·${sy('r')}`;
    if (st.stage === 0 || (!mon && !fis)) {
      lines.push(`<p>${nb('Исходное равновесие.')} ${sy('IS')}: ${is(s0)}; ${sy('LM')}: ${lm(s0)}. ${nb('Они пересекаются в точке')} ${sy('Y')} = <b>${f0(s0.Y)}</b>, ${sy('r')} = <b>${f2(s0.r)} %</b>. ${nb('Ставка совпадает с мировой')} ${sy('r^*')} = ${f0(K.rw)} %, ${nb('поэтому')} ${sy('CF')} = ${sy('m')}(${sy('r')} − ${sy('r^*')}) = 0, ${sy('Nx')} = ${f0(s0.Xn)} ${nb('и')} ${sy('BP')} = 0.</p>`);
      if (!mon && !fis) lines.push(`<p class="ex13__tip">${nb('Измените фактор (а) или (б) либо нажмите один из сценариев — и ниже появится пошаговое объяснение.')}</p>`);
    } else if (st.stage === 1) {
      const rw = K.rw;
      const dIS = (s1.Ya - s1.dr * rw) - (s0.Ya - s0.dr * rw), dLM = (s1.M / (K.P * s1.k) + (K.h / s1.k) * rw) - (s0.M / (K.P * s0.k) + (K.h / s0.k) * rw);
      const mv = [];
      if (Math.abs(dIS) > 1) mv.push(`${sy('IS')} ${nb(dIS > 0 ? 'сдвинулась вправо' : 'сдвинулась влево')}`);
      if (Math.abs(dLM) > 1) mv.push(`${sy('LM')} ${nb(dLM > 0 ? 'сдвинулась вправо' : 'сдвинулась влево')}`);
      lines.push(`<p><b>${nb('Период 1.')}</b> ${nb('Шок экзогенной переменной:')} ${mv.join(', ') || nb('кривые не сдвинулись')}. ${nb('Курс пока прежний')} (${sy('e')} = ${f0(K.e0)}). ${sy('IS')}: ${is(s1)}; ${sy('LM')}: ${lm(s1)}. ${nb('Новое равновесие:')} ${sy('Y')} = <b>${f0(s1.Y)}</b>, ${sy('r')} = <b>${f2(s1.r)} %</b>.</p>`);
      const dir = s1.CF > 0.5 ? nb('ставка выше мировой — капитал притекает') : s1.CF < -0.5 ? nb('ставка ниже мировой — капитал уходит') : nb('ставка равна мировой');
      lines.push(`<p>${sy('CF')} = ${sy('m')}(${sy('r')} − ${sy('r^*')}) = ${f0(K.m)}·(${f2(s1.r)} − ${f0(K.rw)}) = <b>${sg(s1.CF)}</b> (${dir}); ${sy('Nx')} = <b>${sg(s1.Xn)}</b>; ${sy('BP')} = ${sy('Nx')} + ${sy('CF')} = <b>${sg(s1.BP)}</b>. ${Math.abs(s1.BP) < 0.5 ? '' : nb(s1.BP > 0 ? 'Платёжный баланс в профиците: на валютном рынке избыток иностранной валюты.' : 'Платёжный баланс в дефиците: на валютном рынке нехватка иностранной валюты.')}</p>`);
    } else if (fl) {
      lines.push(`<p><b>${nb('Период 2, плавающий курс.')}</b> ${nb('Приток или отток капитала меняет курс, пока ставка не вернётся к мировой:')} ${sy('r')} = ${sy('r^*')} = ${f0(K.rw)} %. ${nb('Выпуск определяет только денежный рынок:')} ${sy('Y')} = (${sy('M')}/${sy('P')} + ${sy('h')}·${sy('r^*')})/${sy('k')} = (${f0(p.M)}/${f0(K.P)} + ${f0(K.h)}·${f0(K.rw)})/${f2(p.k)} = <b>${f0(s2.Y)}</b>.</p>`);
      lines.push(`<p>${nb('Курс скорректировался:')} ${sy('e')} = ${f0(K.e0)} → <b>${f2(s2.e)}</b> (${nb(s2.e > K.e0 + 1e-6 ? 'национальная валюта укрепилась' : s2.e < K.e0 - 1e-6 ? 'национальная валюта ослабла' : 'без изменений')}); ${sy('Nx')} = ${f0(K.Ex)} − ${f0(K.Im)} − ${sy('mpm')}·${sy('Y')} − ${sy('c_e')}·${sy('e')} = <b>${sg(s2.Xn)}</b>, ${sy('CF')} = −${sy('Nx')} = <b>${sg(s2.CF)}</b>, ${sy('BP')} = 0.</p>`);
      if (fis && !mon) lines.push(`<p>${nb('<b>Итог:</b> выпуск остался прежним. Бюджетный импульс вытеснен изменением курса и чистого экспорта, поэтому при плавающем курсе фискальная политика не действует.')}</p>`);
      else if (mon) lines.push(`<p>${nb(`<b>Итог:</b> выпуск изменился на ${sg(s2.Y - s0.Y)}. При плавающем курсе монетарная политика сдвигает LM, а курс «доводит» IS до новой точки — политика эффективна.`)}</p>`);
    } else {
      lines.push(`<p><b>${nb('Период 2, фиксированный курс.')}</b> ${nb('Центральный банк удерживает')} ${sy('e')} = ${f0(K.e0)}, ${nb('поэтому выпуск определяет только')} ${sy('IS')} ${nb('при мировой ставке:')} ${sy('Y')} = ${sy('Y_a')} − ${sy('d')}/${sy('MLR')}·${sy('r^*')} = ${f0(s2.Ya)} − ${f2(s2.dr)}·${f0(K.rw)} = <b>${f0(s2.Y)}</b>.</p>`);
      lines.push(`<p>${nb('Денежное предложение становится эндогенным:')} ${sy('M')} = (${sy('Y')} − ${sy('h')}/${sy('k')}·${sy('r^*')})·${sy('k')}·${sy('P')} = <b>${f0(s2.M)}</b>; ${nb('изменение резервов')} ${sy('ΔRes')} = ${sy('M')} − ${f0(B0.M)} = <b>${sg(s2.dRes)}</b>. ${sy('Nx')} = <b>${sg(s2.Xn)}</b>, ${sy('CF')} = −${sy('Nx')} + ${sy('ΔRes')} = <b>${sg(s2.CF)}</b>, ${sy('BP')} = 0.</p>`);
      if (mon && !fis) lines.push(`<p>${nb('<b>Итог:</b> выпуск не изменился — ЦБ обязан возвращать денежное предложение к уровню, при котором удерживается курс. Монетарная политика при фиксированном курсе бессильна.')}</p>`);
      else if (fis) lines.push(`<p>${nb(`<b>Итог:</b> выпуск изменился на ${sg(s2.Y - s0.Y)}. При фиксированном курсе IS задаёт выпуск напрямую, а ЦБ «подгоняет» LM, — фискальная политика эффективна.`)}</p>`);
    }
    expl.querySelector('.co__b').innerHTML = lines.join('');
  }

  const STAGE_NOTE = [
    'Период 0 — равновесие до шока: Y = Yf, r = r*, платёжный баланс сведён.',
    'Период 1 — сразу после шока: кривые сдвинулись, курс прежний, ставка свободна.',
    'Период 2 — приспособление: ставка возвращается к мировой, подстраивается курс или денежная масса.',
  ];

  /* ── обновление ───────────────────────────────────────────── */
  function refresh() {
    const p = params();
    res = solve(p, st.regime);
    const s = v(), s0 = res[0];
    setPts(cA, 'IS0', geo.IS(s0)); setPts(cA, 'LM0', geo.LM(s0));
    setPts(cA, 'IS', geo.IS(s)); setPts(cA, 'LM', geo.LM(s)); setPts(cA, 'BP', geo.BP(s));
    setPts(cB, 'AD0', adPts(s0)); setPts(cB, 'AD', adPts(s));
    const moved = st.stage > 0 && (monChanged(p) || fisChanged(p));
    const dIS = Math.abs(s.Ya - s0.Ya) + Math.abs(s.dr - s0.dr), dLM = Math.abs(s.M / s.k - s0.M / s0.k) + Math.abs(s.k - s0.k);
    const dAD = Math.abs(yAD(s, 1) - yAD(s0, 1)) + Math.abs(yAD(s, P0) - yAD(s0, P0));
    setHidden(cA, ['IS0', 'tIS0'], !moved || dIS < 0.5); setHidden(cA, ['LM0', 'tLM0'], !moved || dLM < 1e-6);
    setHidden(cA, ['E0'], !moved); setHidden(cB, ['AD0', 'tAD0'], !moved || dAD < 0.5); setHidden(cB, ['E0'], !moved);
    cA.update(); cB.update();
    mathText(cA.get('IS').lab, 'IS_' + st.stage); mathText(cA.get('LM').lab, 'LM_' + st.stage); mathText(cB.get('AD').lab, 'AD_' + st.stage);

    R.Y.set(s.Y); R.r.set(s.r); R.Xn.set(s.Xn); R.CF.set(s.CF); R.e.set(s.e); R.M.set(s.M);
    R.Y.base(s0.Y); R.r.base(s0.r); R.Xn.base(s0.Xn); R.CF.base(s0.CF); R.e.base(s0.e); R.M.base(s0.M);

    stageNote.textContent = nb(STAGE_NOTE[st.stage]);
    tblWrap.dataset.stage = String(st.stage);
    tbl.set(tableRows());
    mx.set(matrix());
    verdict.querySelector('.co__b').innerHTML = `<p>${nb(`Изменение периода 2 при доведении до максимума только фактора (а) = ${symHTML(FACT[st.fa].label)} или только фактора (б) = ${symHTML(FACT[st.fb].label)} (при исходных остальных параметрах):`)}</p>`;
    explain();
    const fa = FACT[st.fa], fb = FACT[st.fb];
    const rg = (f, k) => `${symHTML(f.label)}: ${fmt(f.min, f.dec || 0)} … ${fmt(f.max, f.dec || 0)}`;
    range.innerHTML = nb(`Крайние значения из задания — ${rg(fa)}; ${rg(fb)}. Для k «максимум» — 0,80 (спрос на деньги падает, LM сдвигается вправо, как при росте M).`);
  }

  function setStage(i) { st.stage = i; sStage.set(i, { silent: true }); refresh(); }
  function play() {
    clearTimers();
    if (document.documentElement.classList.contains('reduce')) { setStage(2); return; }
    setStage(0);
    timers.push(setTimeout(() => setStage(1), 700), setTimeout(() => setStage(2), 2600));
  }
  function resetShocks() { Object.keys(S).forEach((k) => S[k].reset(true)); }

  sRegime.on((val) => { st.regime = val; refresh(); });
  sA.on((val) => { st.fa = val; ['M', 'k'].forEach((k) => { if (k !== val) S[k].reset(true); }); showSliders(); refresh(); });
  sB.on((val) => { st.fb = val; ['Ta', 't', 'G'].forEach((k) => { if (k !== val) S[k].reset(true); }); showSliders(); refresh(); });
  sStage.on((val) => { clearTimers(); st.stage = val; refresh(); });
  function showSliders() { ['M', 'k'].forEach((k) => (S[k].el.style.display = k === st.fa ? '' : 'none')); ['Ta', 't', 'G'].forEach((k) => (S[k].el.style.display = k === st.fb ? '' : 'none')); }
  Object.values(S).forEach((s) => s.on(() => { clearTimers(); refresh(); }));
  showSliders(); refresh();

  /* ── API рамки ────────────────────────────────────────────── */
  const api = {
    charts: [cA, cB],
    reset() { clearTimers(); cA.clearGhosts(); cB.clearGhosts(); resetShocks(); st.stage = 1; sStage.set(1, { silent: true }); refresh(); },
    destroy() { clearTimers(); cA.destroy(); cB.destroy(); },
  };
  return api;
}

/* стили модели */
const css = `
.sim--ex13-1 .ex13__sl { display: grid; gap: .9rem; }
.sim--ex13-1 .ex13__note { font: italic 300 .88rem/1.4 var(--f-serif); color: var(--ink-3); margin: .5rem 0 .2rem; }
.sim--ex13-1 .ex13__tip { font: italic 300 .95rem/1.45 var(--f-serif); color: var(--ink-3); }
.sim--ex13-1 .ex13__tbl .dt { max-width: 100%; }
.sim--ex13-1 .ex13__tbl[data-stage="0"] td:nth-child(2), .sim--ex13-1 .ex13__tbl[data-stage="1"] td:nth-child(3), .sim--ex13-1 .ex13__tbl[data-stage="2"] td:nth-child(4) { background: color-mix(in oklab, var(--accent) 8%, transparent); }
.sim--ex13-1 .ex13__mx { margin-top: .5rem; }
.sim--ex13-1 .co > * { min-width: 0; }
.sim--ex13-1 .ex13__mx .dt td { font-size: .86rem; }
.sim--ex13-1 .sim__stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 560px) { .sim--ex13-1 .dt th, .sim--ex13-1 .dt td { padding: .5rem .55rem; font-size: .8rem; } .sim--ex13-1 .dt td:first-child { min-width: 8.5rem; } .sim--ex13-1 .sim__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sim--ex13-1 .ex13__mx .dt tr.is-total td { background: color-mix(in oklab, var(--accent) 9%, transparent); }
.sim--ex13-1 .co .dt { background: var(--surface); }
`;
if (!document.getElementById('css-ex13-1')) { const s = document.createElement('style'); s.id = 'css-ex13-1'; s.textContent = css; document.head.append(s); }
