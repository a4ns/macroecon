/* ─────────────────────────────────────────────────────────────
   Общее расчётное ядро модели IS–LM (упражнения 10.1 – 10.3).
   Те же формулы, что в оригинальном учебнике (закрытая экономика, P = const):

     Y = C + I + G,  C = Ca + mpc·(Y − T),  I = Ia − d·r,  T = Ta + t·Y
        ⇒ IS:  Y = (A − d·r) / m_t,     A = Ca + Ia + G − mpc·Ta,   m_t = 1 − mpc·(1 − t)
     M/P = k·Y − h·r,   k = round(1/V, 2)
        ⇒ LM:  Y = (M/P + h·r) / k
     Равновесие:  m₀ = k·d + h·m_t,   Y₀ = (h·A + d·M/P) / m₀,   r₀ = (k·Y₀ − M/P) / h
     Дополнительно: T = Ta + t·Y₀,  C = Ca + mpc·(Y₀ − T),  I = Ia − d·r₀,
                    u = 7 − (Y₀ − Y*)·100 / (3·Y*),  B = T − G,  π = (P − 1)·100.
   ───────────────────────────────────────────────────────────── */
import { fmt } from '../core/dom.js';
import { nb } from './_nb.js';

/* исходные значения оригинала */
export const D = { Ca: 5500, mpc: 0.75, Ia: 18000, d: 400, Ta: 500, t: 20, G: 6875, M: 20000, V: 1.17, h: 400, P: 1, Yf: 40000 };

/* Math.Round(1/V, 2) из оригинала */
export const kOf = (V) => Math.round(100 / V) / 100;

/* ── товарный рынок (IS) ── */
export const mT = (s) => 1 - s.mpc * (1 - s.t / 100);
export const aut = (s) => s.Ca + s.Ia + s.G - s.mpc * s.Ta;            // автономные расходы A
export const isY0 = (s) => aut(s) / mT(s);                              // отрезок IS на оси Y (r = 0)
export const isSlope = (s) => s.d / mT(s);                              // |dY/dr|
export const isY = (s, r) => isY0(s) - isSlope(s) * r;                  // IS: доход при ставке r
export const isR = (s, Y) => (isY0(s) - Y) / isSlope(s);                // IS: ставка при доходе Y
export const mult = (s) => 1 / mT(s);                                   // мультипликатор расходов

/* ── денежный рынок (LM) ── */
export const kk = (s) => kOf(s.V);
export const real = (s) => s.M / s.P;                                   // реальное предложение денег M/P
export const lmY = (s, r) => (real(s) + s.h * r) / kk(s);               // LM: доход при ставке r
export const lmR = (s, Y) => (kk(s) * Y - real(s)) / s.h;               // LM: ставка при доходе Y
export const lmY0 = (s) => real(s) / kk(s);                             // отрезок LM на оси Y (r = 0)
export const lmSlope = (s) => s.h / kk(s);                              // dY/dr

/* ── совместное равновесие ── */
export function equil(s) {
  const k = kk(s), m = mT(s), A = aut(s), mp = k * s.d + s.h * m;
  const Y = (s.h * A) / mp + (s.d / mp) * real(s);
  const r = (k * Y - real(s)) / s.h;
  const T = s.Ta + (s.t / 100) * Y, Yd = Y - T, C = s.Ca + s.mpc * Yd, I = s.Ia - s.d * r;
  return { Y, r, T, Yd, C, I, S: Yd - C, B: T - s.G, u: 7 - ((Y - s.Yf) * 100) / (3 * s.Yf), infl: (s.P - 1) * 100, k, mp,
    dYdG: s.h / mp, dYdM: s.d / (mp * s.P) };
}

/* ── вспомогательные для интерфейса ── */
export const f0 = (v) => fmt(v, 0);
export const f1 = (v) => fmt(v, 1);
export const f2 = (v) => fmt(v, 2);
/* знак и значение: «+1 200» / «−300» / «0» */
export function sgn(v, dec = 0) {
  const lim = Math.pow(10, -dec) / 2;
  if (!Number.isFinite(v)) return '—';
  return (v > lim ? '+' : v < -lim ? '−' : '') + fmt(Math.abs(v), dec);
}
/* подпись по знаку изменения */
export const dir = (v, up, down, none = 'без изменений') => (Math.abs(v) < 1e-9 ? none : v > 0 ? up : down);

/* красивый «потолок» шкалы из набора ступеней */
export function niceCeil(v, steps) { return steps.find((x) => x >= v) || steps[steps.length - 1]; }

/* неразрывные пробелы во всех текстовых узлах (кроме SVG графиков) */
export function typo(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = []; for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
  list.forEach((n) => { if (n.parentNode && n.parentNode.closest && n.parentNode.closest('svg')) return; const v = nb(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
}

/* один раз вставить стили <style id="css-…"> */
export function injectCss(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.append(s);
}

/* общие стили для всех трёх симуляторов (префикс .islm__ — безопасен вне .sim--exN) */
export const SHARED_CSS = `
.sim .islm__kbd { font: 500 .78rem/1.3 var(--f-mono); color: var(--ink-2); }
.sim .islm__expl p { margin: 0 0 .5rem; }
.sim .islm__expl p:last-child { margin-bottom: 0; }
.sim .islm__expl .islm__eq { font-family: var(--f-math); font-size: .98rem; color: var(--ink); overflow-wrap: anywhere; }
.sim .islm__expl b { font-family: var(--f-mono); font-weight: 600; font-size: .86em; color: var(--ink); white-space: nowrap; }
.sim .islm__expl strong { font-weight: 600; color: var(--ink); }
.sim .islm__tag { display: inline-block; padding: .05rem .5rem; border-radius: var(--r-pill); font: 600 .72rem/1.5 var(--f-mono); background: color-mix(in oklab, var(--c, var(--ink-3)) 18%, transparent); color: var(--c, var(--ink-2)); white-space: nowrap; }
.sim .islm__cap { font: 500 .72rem/1.3 var(--f-mono); color: var(--ink-3); padding: 0 .1rem .3rem; }
.sim .islm__cap i { font-style: normal; text-transform: none; letter-spacing: 0; font-family: var(--f-math); font-size: .92em; color: var(--ink-2); }
.sim .dt th, .sim .dt td { padding-inline: .8rem; }
@media (max-width: 520px) { .sim .dt th, .sim .dt td { padding: .5rem .45rem; } .sim .dt table { font-size: .8rem; } .sim .dt th { letter-spacing: .04em; font-size: .6rem; } }
.sim .islm__row { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
`;
