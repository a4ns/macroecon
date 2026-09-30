/* ─────────────────────────────────────────────────────────────
   Упражнение 6.1 — простая кейнсианская модель «доходы — расходы»
   (REFERENCE IMPLEMENTATION: other simulators follow this structure)

   Y = C + I,  C = Ca + mpc·Y,  I = Ia − d·r   ⇒   Y₀ = (Ca + Ia − d·r) / (1 − mpc)
   Original defaults: Ca=5500, mpc=.75, Ia=18000, d=400, r=35 %, Y*=38000.
   ───────────────────────────────────────────────────────────── */
import { h, fmt } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, toggle, stat, presets, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';

const D = { Ca: 5500, mpc: 0.75, Ia: 18000, d: 400, r: 35, Yf: 38000 };

/* the model, pure functions of a state object */
const inv = (s) => s.Ia - s.d * s.r;
const y0 = (s) => (s.Ca + s.Ia - s.d * s.r) / (1 - s.mpc);
const cons = (s) => s.Ca + s.mpc * y0(s);
const mult = (s) => 1 / (1 - s.mpc);
const lin = (f) => { f.linear = true; return f; };

export function mount(root, env) {
  root.classList.add('sim--ex6-1');
  const L = simLayout(root);
  const st = { ...D };           // current state
  let base = { ...D };           // what we compare against (defaults until the user presses «Сравнить»)
  let marked = false;

  /* ── controls ─────────────────────────────────────────────── */
  const S = {
    Ca: slider({ label: 'Автономное потребление', sym: 'C_a', min: 3000, max: 8000, step: 100, value: D.Ca, unit: 'ден. ед.', color: 'var(--d1)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.6, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d2)' }),
    Ia: slider({ label: 'Автономные инвестиции', sym: 'I_a', min: 15000, max: 22000, step: 100, value: D.Ia, unit: 'ден. ед.', color: 'var(--d5)' }),
    d: slider({ label: 'Чувствительность инвестиций к ставке', sym: 'd', min: 300, max: 450, step: 1, value: D.d, color: 'var(--d4)' }),
    r: slider({ label: 'Ставка процента', sym: 'r', min: 20, max: 40, step: 1, value: D.r, unit: '%', color: 'var(--d3)' }),
    Yf: slider({ label: 'Потенциальный выпуск', sym: 'Y^*', min: 30000, max: 46000, step: 500, value: D.Yf, unit: 'ден. ед.', color: 'var(--d6)' }),
  };
  const showC = toggle({ label: 'Показать потребление C', hint: 'кривая C = Ca + mpc·Y', color: 'var(--d2)', value: false });

  const set = (k, v) => S[k].set(v, { fromUser: true });
  const pre = presets([
    { label: 'Оптимизм: Ca +1000', color: 'var(--d1)', hint: 'Домохозяйства стали тратить больше', apply: () => { mark(); set('Ca', st.Ca + 1000); } },
    { label: 'Бум инвестиций: Ia +1000', color: 'var(--d5)', hint: 'Фирмы расширяют производство', apply: () => { mark(); set('Ia', st.Ia + 1000); } },
    { label: 'Экономим: mpc −0,05', color: 'var(--d2)', hint: 'Люди больше сберегают', apply: () => { mark(); set('mpc', +(st.mpc - 0.05).toFixed(2)); } },
    { label: 'Ставка +5 п.п.', color: 'var(--d3)', hint: 'Кредит дорожает, инвестиции падают', apply: () => { mark(); set('r', st.r + 5); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии' });

  L.controls.append(
    panel({ title: 'Параметры модели', hint: 'дважды щёлкните название — сброс' }, S.Ca.el, S.mpc.el, S.Ia.el, S.d.el, S.r.el, S.Yf.el),
    panel({ title: 'Показать' }, showC.el),
    panel({ title: 'Что будет, если…' }, pre));

  /* ── readouts ─────────────────────────────────────────────── */
  const R = {
    Y: stat({ label: 'Равновесный доход', sym: 'Y_0', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    C: stat({ label: 'Потребление', sym: 'C', color: 'var(--d2)' }),
    I: stat({ label: 'Инвестиции', sym: 'I', color: 'var(--d5)' }),
    M: stat({ label: 'Мультипликатор', unit: '= 1/(1−mpc)', dec: 2, color: 'var(--d1)' }),
    G: stat({ label: 'Разрыв выпуска', unit: 'Y₀ − Y*', color: 'var(--d3)' }),
  };
  L.stats.append(R.Y.el, R.C.el, R.I.el, R.M.el, R.G.el);

  /* ── chart ────────────────────────────────────────────────── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: 0, max: 60000, label: 'Y', ticks: [0, 20000, 40000, 60000] },
    y: { min: 0, max: 60000, label: 'E', ticks: [0, 20000, 40000, 60000] },
    aspect: 1.4, maxH: 560, margin: { l: 62, r: 34, t: 28, b: 44 }, title: 'Кейнсианский крест',
  });
  chart.line('c', { fn: lin((y) => st.Ca + st.mpc * y), from: 0, to: 60000, color: 'var(--d2)', width: 2.4, label: 'C', labelAt: .7, labelDy: 20, glow: false, ghost: false });
  chart.line('45', { fn: lin((y) => y), from: 0, to: 60000, color: 'var(--ink-3)', width: 2, dash: '2 7', label: 'E = Y', labelAt: .86, labelDx: -44, labelDy: 26, glow: false, ghost: false });
  chart.line('ep', { fn: lin((y) => inv(st) + st.Ca + st.mpc * y), from: 0, to: 60000, color: 'var(--d1)', width: 3.6, label: 'E_p', labelAt: .95, labelDy: -14 });
  chart.vline('yf', { x: () => st.Yf, color: 'var(--d6)', dash: '6 6', width: 1.8, label: 'Y^*', labelDx: 12 });
  chart.point('eq', { x: () => y0(st), y: () => y0(st), color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'Y_0', y: 'E_0' } });
  const cLine = chart.get('c'); const applyC = () => { [cLine.node, cLine.halo, cLine.lab].forEach((n) => n && (n.style.display = showC.value ? '' : 'none')); };
  applyC(); showC.on(() => { applyC(); });

  /* second figure: the multiplier unrolled into spending rounds */
  const rounds = h('div.ex61__rounds');
  L.stage.append(
    figure('Кейнсианский крест · доходы и расходы', host, { note: 'Точка — равновесие, где планируемые расходы Eₚ равны доходу. Пунктир — положение до сохранённого сравнения.' }),
    figure('Мультипликатор по шагам', rounds, { class: 'ex61__fig' }),
  );
  L.stage.append(legend([
    { color: 'var(--d1)', label: 'E_p — планируемые расходы' }, { color: 'var(--ink-3)', label: 'E = Y', dash: true },
    { color: 'var(--d6)', label: 'Y^* — потенциальный выпуск', dash: true }, { color: 'var(--d2)', label: 'C — потребление' }]));

  /* ── before / after table + explanation ───────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получено равновесие' });
  L.notes.append(tbl.el, expl);

  /* ── update ───────────────────────────────────────────────── */
  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); }
  const f0 = (v) => fmt(v, 0);
  const sign = (v) => (v > 0.5 ? '+' : v < -0.5 ? '−' : '') + f0(Math.abs(v));
  function render() {
    const Y = y0(st), C = cons(st), I = inv(st), M = mult(st), gap = Y - st.Yf;
    R.Y.set(Y); R.C.set(C); R.I.set(I); R.M.set(M); R.G.set(gap);
    const by = y0(base);
    R.Y.base(by); R.C.base(cons(base)); R.I.base(inv(base)); R.M.base(mult(base));
    tbl.set([
      { k: 'Равновесный доход Y₀', a: f0(by), b: f0(Y), d: sign(Y - by) },
      { k: 'Потребление C', a: f0(cons(base)), b: f0(C), d: sign(C - cons(base)) },
      { k: 'Инвестиции I', a: f0(inv(base)), b: f0(I), d: sign(I - inv(base)) },
      { k: 'Сбережения S = Y − C', a: f0(by - cons(base)), b: f0(Y - C), d: sign(Y - C - (by - cons(base))) },
      { k: 'Мультипликатор', a: fmt(mult(base), 2), b: fmt(M, 2), d: fmt(M - mult(base), 2) },
    ]);
    const gtxt = Math.abs(gap) < 1 ? '<b>Экономика на уровне потенциального выпуска.</b> Разрыва нет.'
      : gap < 0 ? `<b>Рецессионный разрыв ${f0(-gap)}:</b> равновесие ниже потенциального выпуска — безработица выше естественной.`
        : `<b>Инфляционный разрыв ${f0(gap)}:</b> спрос превышает возможности экономики — цены начнут расти.`;
    expl.querySelector('.co__b').innerHTML =
      `<p>${symHTML('Y_0')} = (${symHTML('C_a')} + ${symHTML('I_a')} − ${symHTML('d')}·${symHTML('r')}) / (1 − ${symHTML('mpc')}) = (${f0(st.Ca)} + ${f0(st.Ia)} − ${f0(st.d)}·${f0(st.r)}) / ${fmt(1 - st.mpc, 2)} = <b>${f0(Y)}</b></p><p>${gtxt}</p>`;
    drawRounds();
  }

  function drawRounds() {
    const dA0 = (st.Ca + st.Ia - st.d * st.r) - (base.Ca + base.Ia - base.d * base.r);
    rounds.textContent = '';
    if (Math.abs(dA0) < 1 || Math.abs(st.mpc - base.mpc) > 1e-9) {
      rounds.append(h('p.ex61__hint', Math.abs(st.mpc - base.mpc) > 1e-9 ? 'Изменилась склонность к потреблению — сам множитель стал другим: сравните значения в таблице.' : 'Измените автономное потребление, инвестиции или ставку — и здесь развернётся цепочка расходов.'));
      return;
    }
    const n = 9, m = st.mpc; let tot = 0; const max = Math.max(1, Math.abs(dA0));
    const row = h('div.ex61__row');
    for (let i = 0; i < n; i++) {
      const v = dA0 * Math.pow(m, i); tot += v;
      row.append(h('div.ex61__b', { style: { '--h': (Math.abs(v) / max).toFixed(3), '--c': dA0 > 0 ? 'var(--d2)' : 'var(--d3)', '--i': i } }, h('i'), h('span', (v > 0 ? '+' : '−') + f0(Math.abs(v)))));
    }
    const all = dA0 * mult(st);
    rounds.append(row, h('p.ex61__sum', 'Начальный толчок ', h('b', sign(dA0)), ' → за ', n, ' шагов накопилось ', h('b', sign(tot)), ' из ', h('b', sign(all)), '  (ΔY = ΔA · 1/(1−mpc)).'));
  }

  const STEPS = [40000, 50000, 60000, 80000, 100000, 130000, 160000, 200000, 300000, 500000];
  let top = 60000;
  function fitDomain() {
    const need = Math.max(y0(st), st.Yf, 30000) * 1.22;
    const H = STEPS.find((v) => v >= need) || STEPS[STEPS.length - 1];
    if (H !== top) { top = H; chart.setDomain({ x: [0, H], y: [0, H] }, true); chart.get('c').op.to = chart.get('45').op.to = chart.get('ep').op.to = H; chart.update(); }
  }
  const onChange = () => { readState(); fitDomain(); chart.update(); render(); };
  Object.values(S).forEach((s) => s.on(onChange));
  readState(); fitDomain(); render();

  /* ── frame API ────────────────────────────────────────────── */
  function mark() { base = { ...st }; chart.snapshot(); marked = true; render(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { chart.clearGhosts(); base = { ...D }; marked = false; render(); },
    reset() { chart.clearGhosts(); base = { ...D }; marked = false; Object.values(S).forEach((s) => s.reset(true)); readState(); fitDomain(); chart.update(); render(); },
    destroy() { chart.destroy(); },
  };
  return api;
}

/* scoped styles */
const css = `
.sim--ex6-1 .ex61__rounds { min-height: 9rem; display: grid; align-content: end; gap: .8rem; padding: .4rem .6rem .6rem; }
.sim--ex6-1 .ex61__row { display: flex; align-items: flex-end; gap: .5rem; height: 7rem; }
.sim--ex6-1 .ex61__b { position: relative; flex: 1; height: max(calc(var(--h) * 100%), 6px); border-radius: 7px 7px 2px 2px; background: var(--c); opacity: calc(1 - var(--i) * .07); transition: height .6s var(--ease), background-color .3s; }
.sim--ex6-1 .ex61__b span { position: absolute; bottom: calc(100% + 4px); left: 50%; translate: -50% 0; font: 500 .62rem/1 var(--f-mono); color: var(--ink-3); white-space: nowrap; }
.sim--ex6-1 .ex61__sum, .sim--ex6-1 .ex61__hint { font: italic 300 .95rem/1.45 var(--f-serif); color: var(--ink-3); }
.sim--ex6-1 .ex61__sum b { color: var(--ink); font-style: normal; font-weight: 600; font-family: var(--f-mono); font-size: .86rem; }
@media (max-width: 520px) { .sim--ex6-1 .ex61__b span:nth-child(n) { display: none; } .sim--ex6-1 .ex61__b:nth-child(-n+3) span { display: block; } }
`;
if (!document.getElementById('css-ex6-1')) { const s = document.createElement('style'); s.id = 'css-ex6-1'; s.textContent = css; document.head.append(s); }
