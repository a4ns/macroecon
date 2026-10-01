/* ─────────────────────────────────────────────────────────────
   Упражнение 4.1 — естественный уровень безработицы
   (динамика потоков «занятые ⇄ безработные»)

   L — трудовые ресурсы, N — занятые, U = L − N — безработные.
   Каждый месяц: теряют работу σ·N, находят работу g·U (оба потока округляются до 0,01 млн чел., как в оригинале)
       N_{t+1} = N_t − σ·N_t + g·U_t,    U_{t+1} = U_t + σ·N_t − g·U_t.
   Равновесие: σ·N = g·U  ⇒  u* = U/L = σ/(σ+g).
   Исходные значения оригинала: L = 120, N = 110, σ = 1 %, g = 1 %.
   Оригинал останавливает расчёт, когда округлённые потоки сравниваются, и выводит u = U·100/L.
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, button, stat, presets, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

const D = { L: 120, N: 110, sg: 1, g: 1 };          // σ и g — в процентах
const r2 = (v) => Math.round(v * 100) / 100;
const MAXT = 1500;

/* траектория — чистая функция состояния */
function run(p) {
  const L = p.L, s = p.sg / 100, g = p.g / 100;
  let N = clamp(p.N, 0, L);
  const Ns = [], Us = [], In = [], Out = [];
  for (let t = 0; t <= MAXT; t++) {
    const U = r2(L - N), fin = r2(g * U), fout = r2(s * N);
    Ns.push(N); Us.push(U); In.push(fin); Out.push(fout);
    if (fin === fout) break;
    N = r2(N - fout + fin);
  }
  const T = Ns.length - 1;
  return { Ns, Us, In, Out, T, N: Ns[T], U: Us[T], u: (Us[T] * 100) / L, ustar: (p.sg / (p.sg + p.g)) * 100, L };
}
const at = (a, x) => { const i = clamp(Math.floor(x), 0, a.length - 1), j = Math.min(a.length - 1, i + 1); return a[i] + (a[j] - a[i]) * clamp(x - i, 0, 1); };

export function mount(root, env) {
  root.classList.add('sim--ex4-1');
  const L = simLayout(root);
  const st = { ...D };
  let base = { ...D }, baseRun = run(base);
  let tr = run(st);
  let t = 0, playing = false, raf = 0, last = 0;

  /* ── controls ─────────────────────────────────────────────── */
  const S = {
    L: slider({ label: 'Трудовые ресурсы', sym: 'L', min: 20, max: 300, step: 1, value: D.L, unit: 'млн чел.', color: 'var(--d5)' }),
    N: slider({ label: 'Работающие в начальный момент', sym: 'N_0', min: 0, max: D.L, step: 1, value: D.N, unit: 'млн чел.', color: 'var(--d2)' }),
    sg: slider({ label: 'Доля теряющих работу за месяц', sym: 'σ', min: 0.5, max: 15, step: 0.5, value: D.sg, dec: 1, unit: '%', color: 'var(--d3)' }),
    g: slider({ label: 'Доля находящих работу за месяц', sym: 'g', min: 0.5, max: 50, step: 0.5, value: D.g, dec: 1, unit: '%', color: 'var(--d1)' }),
  };
  const TS = slider({ label: 'Месяц', sym: 't', min: 0, max: 12, step: 1, value: 0, unit: 'мес.', color: 'var(--accent)' });
  const playBtn = button({ label: 'Проиграть', icon: 'play', variant: 'primary', onClick: () => (playing ? stop() : play()) });

  const set = (k, v) => S[k].set(v, { fromUser: true });
  const pre = presets([
    { label: 'Пример: σ = 2 %, g = 20 %', color: 'var(--d1)', hint: 'Типичные для экономики потоки: безработица около 9 %', apply: () => { mark(); set('sg', 2); set('g', 20); } },
    { label: 'Увольнений вдвое больше', color: 'var(--d3)', hint: 'σ удваивается — безработица растёт', apply: () => { mark(); set('sg', Math.min(15, st.sg * 2)); } },
    { label: 'Быстрее находят работу: g + 10 п.п.', color: 'var(--d2)', hint: 'Рынок труда «подвижнее» — безработица падает', apply: () => { mark(); set('g', st.g + 10); } },
    { label: 'Старт с N = 60', color: 'var(--d5)', hint: 'Начальная занятость не влияет на естественный уровень', apply: () => { mark(); set('N', Math.round(st.L / 2)); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ].map((p) => ({ ...p, label: nb(p.label) })), { title: 'Сценарии' });

  L.controls.append(
    panel({ title: 'Параметры модели', hint: 'дважды щёлкните название — сброс' }, S.L.el, S.N.el, S.sg.el, S.g.el),
    panel({ title: 'Время', hint: 'месяц, за который показано состояние' }, TS.el, h('div.ex41__play', playBtn)),
    panel({ title: 'Что будет, если…' }, pre));

  /* ── показатели ───────────────────────────────────────────── */
  const R = {
    u: stat({ label: 'Естественный уровень безработицы', sym: 'u^*', unit: '%', dec: 2, size: 'l', color: 'var(--accent)' }),
    ut: stat({ label: 'Безработица сейчас', sym: 'u_t', unit: '%', dec: 2, color: 'var(--d3)' }),
    N: stat({ label: 'Занятые сейчас', sym: 'N_t', unit: 'млн чел.', dec: 2, color: 'var(--d2)' }),
    U: stat({ label: 'Безработные сейчас', sym: 'U_t', unit: 'млн чел.', dec: 2, color: 'var(--d3)' }),
    T: stat({ label: 'До равновесия', unit: 'мес.', dec: 0, color: 'var(--d5)' }),
  };
  L.stats.append(R.u.el, R.ut.el, R.N.el, R.U.el, R.T.el);

  /* ── график 1: численность занятых и безработных ──────────── */
  const hostA = h('div');
  const cA = createChart(hostA, {
    x: { min: 0, max: 12, label: 't, мес.', ticks: 6 },
    y: { min: 0, max: D.L, label: 'млн чел.', ticks: 5 },
    aspect: 1.7, maxH: 400, margin: { l: 56, r: 34, t: 30, b: 44 }, title: 'Занятые и безработные по месяцам',
  });
  const lin = (arr) => (x) => at(arr, x);
  cA.line('N', { fn: (x) => at(tr.Ns, x), from: 0, to: 12, color: 'var(--d2)', width: 3.4, label: 'N', labelAt: .08, labelDy: -12, labelDx: 4 });
  cA.line('U', { fn: (x) => at(tr.Us, x), from: 0, to: 12, color: 'var(--d3)', width: 3.4, label: 'U', labelAt: .08, labelDy: 20, labelDx: 4 });
  cA.hline('Ns', { y: () => tr.N, color: 'var(--d2)', dash: '4 6', width: 1.5, label: 'N^*', labelDy: -6 });
  cA.hline('Us', { y: () => tr.U, color: 'var(--d3)', dash: '4 6', width: 1.5, label: 'U^*', labelDy: -6 });
  cA.vline('tm', { x: () => t, color: 'var(--ink-3)', dash: '3 5', width: 1.4 });
  cA.point('pN', { x: () => t, y: () => at(tr.Ns, t), color: 'var(--d2)', r: 6.5 });
  cA.point('pU', { x: () => t, y: () => at(tr.Us, t), color: 'var(--d3)', r: 6.5 });

  /* ── график 2: потоки ─────────────────────────────────────── */
  const hostB = h('div');
  const cB = createChart(hostB, {
    x: { min: 0, max: 12, label: 't, мес.', ticks: 6 },
    y: { min: 0, max: 2, label: 'млн чел. в месяц', ticks: 5, fmt: (v) => fmt(v, v < 10 ? 1 : 0) },
    aspect: 1.7, maxH: 400, margin: { l: 56, r: 34, t: 30, b: 44 }, title: 'Потоки: теряют и находят работу',
  });
  cB.line('out', { fn: (x) => at(tr.Out, x), from: 0, to: 12, color: 'var(--d3)', width: 3.2, label: 'σN', labelAt: .08, labelDy: -12, labelDx: 4 });
  cB.line('in', { fn: (x) => at(tr.In, x), from: 0, to: 12, color: 'var(--d1)', width: 3.2, label: 'gU', labelAt: .08, labelDy: 20, labelDx: 4 });
  cB.vline('tm', { x: () => t, color: 'var(--ink-3)', dash: '3 5', width: 1.4 });
  cB.point('pO', { x: () => t, y: () => at(tr.Out, t), color: 'var(--d3)', r: 6 });
  cB.point('pI', { x: () => t, y: () => at(tr.In, t), color: 'var(--d1)', r: 6 });
  cB.point('eq', { x: () => tr.T, y: () => tr.Out[tr.T], color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'T' } });

  /* ── схема: два «резервуара» и потоки между ними ──────────── */
  const el = {
    bn: h('i.ex41__bn'), bu: h('i.ex41__bu'),
    nv: h('b'), uv: h('b'), nl: h('small', 'млн чел.'), ul: h('small', 'млн чел.'),
    fin: h('b'), fout: h('b'), arIn: h('i.ex41__ar.is-l'), arOut: h('i.ex41__ar.is-r'),
    pn: h('span.ex41__pc'), pu: h('span.ex41__pc'),
  };
  const pools = h('div.ex41__pools', { 'data-run': '0' },
    h('div.ex41__bar', { role: 'img', 'aria-label': 'Доли занятых и безработных в трудовых ресурсах' }, el.bn, el.bu),
    h('div.ex41__row',
      h('div.ex41__card.is-n', h('span.ex41__cap', 'Занятые ', h('i.sym', { html: symHTML('N') })), el.nv, el.nl, el.pn),
      h('div.ex41__flows',
        h('div.ex41__fl.is-in', h('span', { html: nb('Находят работу ') + symHTML('g') + '·' + symHTML('U') }), el.fin, el.arIn),
        h('div.ex41__fl.is-out', h('span', { html: nb('Теряют работу ') + symHTML('σ') + '·' + symHTML('N') }), el.fout, el.arOut)),
      h('div.ex41__card.is-u', h('span.ex41__cap', 'Безработные ', h('i.sym', { html: symHTML('U') })), el.uv, el.ul, el.pu)));

  L.stage.classList.add('is-2');
  L.stage.append(
    figure('Занятые и безработные', hostA, { note: nb('Сплошные кривые — численность, пунктир — равновесные N* и U*. Вертикаль отмечает выбранный месяц t.') }),
    figure('Потоки между состояниями', hostB, { note: nb('Равновесие там, где кривые сходятся: за месяц выходит из занятости столько же людей, сколько в неё входит.') }),
    figure('Рынок труда в выбранном месяце', pools, { class: 'ex41__pfig' }));
  L.notes.append(legend([
    { color: 'var(--d2)', label: 'N — занятые' }, { color: 'var(--d3)', label: 'U — безработные' },
    { color: 'var(--d3)', label: 'σN — потеряли работу' }, { color: 'var(--d1)', label: 'gU — нашли работу' }]));

    /* ── таблица и пояснение ── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получено равновесие' });
  L.notes.append(tbl.el, expl);

  /* ── вывод ────────────────────────────────────────────────── */
  const f2 = (v) => fmt(v, 2);
  const sgn = (v, d = 2) => (v > 0.0049 ? '+' : v < -0.0049 ? '−' : '') + fmt(Math.abs(v), d);
  function render() {
    const T = tr.T, tt = Math.round(t);
    const Nt = tr.Ns[tt], Ut = tr.Us[tt];
    R.u.set(tr.u); R.u.base(baseRun.u);
    R.ut.set((Ut * 100) / st.L); R.N.set(Nt); R.U.set(Ut); R.T.set(T);
    R.ut.base(null); R.N.base(null); R.U.base(null); R.T.base(baseRun.T);

    const pn = (Nt / st.L) * 100;
    el.nv.textContent = f2(Nt); el.uv.textContent = f2(Ut);
    el.pn.textContent = fmt(pn, 1) + ' %'; el.pu.textContent = fmt(100 - pn, 1) + ' %';
    el.bn.style.setProperty('--w', (Nt / st.L).toFixed(4)); el.bu.style.setProperty('--w', (Ut / st.L).toFixed(4));
    const fi = tr.In[tt], fo = tr.Out[tt], mx = Math.max(fi, fo, 0.01);
    el.fin.textContent = '+' + f2(fi); el.fout.textContent = '−' + f2(fo);
    el.arIn.style.setProperty('--k', (fi / mx).toFixed(3)); el.arOut.style.setProperty('--k', (fo / mx).toFixed(3));
    pools.dataset.run = tt < T ? '1' : '0';

    const dN = tr.N - baseRun.N, dU = tr.U - baseRun.U;
    tbl.set([
      { k: 'Естественная безработица u* = U/L, %', a: f2(baseRun.u), b: f2(tr.u), d: sgn(tr.u - baseRun.u) },
      { k: 'Занятые в равновесии N*, млн чел.', a: f2(baseRun.N), b: f2(tr.N), d: sgn(dN) },
      { k: 'Безработные в равновесии U*, млн чел.', a: f2(baseRun.U), b: f2(tr.U), d: sgn(dU) },
      { k: 'Поток σN = gU в равновесии, млн чел./мес.', a: f2(baseRun.Out[baseRun.T]), b: f2(tr.Out[T]), d: sgn(tr.Out[T] - baseRun.Out[baseRun.T]) },
      { k: 'Месяцев до равновесия', a: fmt(baseRun.T, 0), b: fmt(T, 0), d: sgn(T - baseRun.T, 0) },
    ]);

    const s = st.sg / 100, g = st.g / 100;
    const rate = `<p>${nb('В равновесии')} ${symHTML('σ')}·${symHTML('N')} = ${symHTML('g')}·${symHTML('U')}, ${nb('а')} ${symHTML('N')} = ${symHTML('L')} − ${symHTML('U')}. ${nb('Отсюда')} ${symHTML('u^*')} = ${symHTML('U')}/${symHTML('L')} = ${symHTML('σ')}/(${symHTML('σ')} + ${symHTML('g')}) = ${fmt(st.sg, 1)}/(${fmt(st.sg, 1)} + ${fmt(st.g, 1)}) = <b>${fmt(tr.ustar, 2)} %</b>.</p>`;
    const sim = T === 0
      ? `<p>${nb('Начальное состояние уже равновесное: потоки равны, безработица не меняется.')}</p>`
      : `<p>${nb('Расчёт по месяцам (потоки округляются до 0,01, как в исходной модели) останавливается через')} <b>${T}</b> ${nb('мес.: безработица')} ${fmt(tr.U, 2)}/${fmt(st.L, 0)} = <b>${fmt(tr.u, 2)} %</b>. ${nb('Равновесие устойчиво: чем дальше состояние от него, тем больше разница потоков и тем быстрее оно возвращается.')}</p>`;
    const dir = st.N > tr.N ? nb('Вначале занятых больше равновесного — потеря работы (σN) превышает найм (gU), и безработица растёт.')
      : st.N < tr.N ? nb('Вначале безработных больше равновесного — найм (gU) превышает потерю работы (σN), и безработица снижается.') : '';
    expl.querySelector('.co__b').innerHTML = rate + sim + (dir ? `<p>${dir}</p>` : '') +
      `<p class="ex41__tip">${nb('Заметьте: уровень естественной безработицы зависит только от отношения g/σ и не зависит от L и N')}<sub>0</sub>${nb(' — они влияют лишь на длительность перехода.')}</p>`;
  }

  /* ── обновление ───────────────────────────────────────────── */
  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); }
  function fit() {
    const H = Math.max(12, tr.T);
    const fm = Math.max(0.05, ...tr.In, ...tr.Out) * 1.2;
    for (const [c, ids] of [[cA, ['N', 'U']], [cB, ['out', 'in']]]) ids.forEach((id) => (c.get(id).op.to = H));
    cA.setDomain({ x: [0, H], y: [0, st.L] }, true);
    cB.setDomain({ x: [0, H], y: [0, fm] }, true);
    TS.setRange(0, tr.T, 1);
    if (t > tr.T) { t = tr.T; TS.set(t, { silent: true }); }
  }
  function refresh() { cA.update(); cB.update(); render(); }
  function onChange() {
    readState();
    S.N.setRange(0, st.L, 1);
    st.N = S.N.value;
    stop();
    tr = run(st); fit(); refresh();
  }
  Object.values(S).forEach((s) => s.on(onChange));
  TS.on((v, fromUser) => { if (fromUser) stop(); t = v; refresh(); });
  readState(); tr = run(st); fit(); render();

  /* ── воспроизведение ──────────────────────────────────────── */
  const ICON = { play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>', pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>' };
  function paintBtn() { playBtn.querySelector('span:not(.btn__i)').textContent = playing ? 'Пауза' : (t >= tr.T && tr.T > 0 ? 'Сначала' : 'Проиграть'); const i = playBtn.querySelector('.btn__i'); if (i) i.innerHTML = playing ? ICON.pause : ICON.play; }
  function play() {
    if (tr.T === 0) return;
    if (t >= tr.T) { t = 0; TS.set(0, { silent: true }); }
    playing = true; last = performance.now(); paintBtn();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const speed = Math.max(3, tr.T / 7);
      t = Math.min(tr.T, t + dt * speed);
      TS.set(Math.round(t), { silent: true });
      cA.update(); cB.update(); render();
      if (t >= tr.T) { playing = false; paintBtn(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stop() { if (!playing) { paintBtn(); return; } playing = false; cancelAnimationFrame(raf); paintBtn(); }
  paintBtn();

  /* ── API рамки ────────────────────────────────────────────── */
  function mark() { base = { ...st }; baseRun = run(base); cA.snapshot(); cB.snapshot(); render(); }
  const api = {
    charts: [cA, cB],
    compare() { mark(); },
    clearCompare() { cA.clearGhosts(); cB.clearGhosts(); base = { ...D }; baseRun = run(base); render(); },
    reset() {
      stop(); cA.clearGhosts(); cB.clearGhosts(); base = { ...D }; baseRun = run(base); t = 0; TS.set(0, { silent: true });
      S.N.setRange(0, D.L, 1); Object.values(S).forEach((s) => s.reset(true)); readState();
      tr = run(st); fit(); cA.update(true); cB.update(true); render();
    },
    destroy() { stop(); cancelAnimationFrame(raf); cA.destroy(); cB.destroy(); },
  };
  return api;
}

/* scoped styles */
const css = `
.sim--ex4-1 .ex41__pfig { grid-column: 1 / -1; }
.sim--ex4-1 .ex41__play { display: flex; margin-top: .7rem; }
.sim--ex4-1 .ex41__play .btn { width: 100%; justify-content: center; }
.sim--ex4-1 .ex41__pools { display: grid; gap: 1rem; padding: .2rem .4rem .5rem; }
.sim--ex4-1 .ex41__bar { display: flex; height: 14px; border-radius: 99px; overflow: hidden; background: var(--surface-3); gap: 2px; }
.sim--ex4-1 .ex41__bar i { display: block; width: calc(var(--w, 0) * 100%); transition: width .35s var(--ease); min-width: 0; }
.sim--ex4-1 .ex41__bn { background: var(--d2); }
.sim--ex4-1 .ex41__bu { background: var(--d3); }
.sim--ex4-1 .ex41__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr); gap: .8rem; align-items: stretch; }
.sim--ex4-1 .ex41__card { display: grid; align-content: center; gap: .15rem; padding: .8rem .9rem; border-radius: var(--r-m); border: 1px solid var(--line-2); background: var(--surface-2); }
.sim--ex4-1 .ex41__card.is-n { border-color: var(--d2); }
.sim--ex4-1 .ex41__card.is-u { border-color: var(--d3); }
.sim--ex4-1 .ex41__cap { font: 600 .66rem/1.2 var(--f-mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
.sim--ex4-1 .ex41__card b { font: 600 1.7rem/1.1 var(--f-mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.sim--ex4-1 .ex41__card.is-n b { color: var(--d2); }
.sim--ex4-1 .ex41__card.is-u b { color: var(--d3); }
.sim--ex4-1 .ex41__card small, .sim--ex4-1 .ex41__pc { font: 400 .72rem/1.3 var(--f-mono); color: var(--ink-3); }
.sim--ex4-1 .ex41__flows { display: grid; gap: .6rem; align-content: center; }
.sim--ex4-1 .ex41__fl { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: .1rem .6rem; font: 400 .8rem/1.3 var(--f-sans); color: var(--ink-2); }
.sim--ex4-1 .ex41__fl b { font: 600 .98rem/1 var(--f-mono); font-variant-numeric: tabular-nums; }
.sim--ex4-1 .ex41__fl.is-in b { color: var(--d1); }
.sim--ex4-1 .ex41__fl.is-out b { color: var(--d3); }
.sim--ex4-1 .ex41__ar { grid-column: 1 / -1; position: relative; display: block; height: calc(2px + var(--k, 0) * 5px); margin: 4px 7px 4px 0; border-radius: 3px; color: var(--c); background: repeating-linear-gradient(90deg, currentColor 0 7px, transparent 7px 13px); background-size: 13px 100%; }
.sim--ex4-1 .is-in .ex41__ar { --c: var(--d1); }
.sim--ex4-1 .is-out .ex41__ar { --c: var(--d3); }
.sim--ex4-1 .ex41__ar::after { content: ""; position: absolute; top: 50%; translate: 0 -50%; border: 6px solid transparent; }
.sim--ex4-1 .ex41__ar.is-r::after { right: -9px; border-left: 9px solid currentColor; border-right: 0; }
.sim--ex4-1 .ex41__ar.is-l::after { left: -9px; border-right: 9px solid currentColor; border-left: 0; }
.sim--ex4-1 [data-run="1"] .ex41__ar.is-r { animation: ex41-r .8s linear infinite; }
.sim--ex4-1 [data-run="1"] .ex41__ar.is-l { animation: ex41-l .8s linear infinite; }
@keyframes ex41-r { to { background-position: 13px 0; } }
@keyframes ex41-l { to { background-position: -13px 0; } }
.sim--ex4-1 .ex41__tip { color: var(--ink-3); font-style: italic; }
@media (max-width: 560px) {
  .sim--ex4-1 .ex41__row { grid-template-columns: 1fr 1fr; }
  .sim--ex4-1 .ex41__flows { grid-column: 1 / -1; grid-row: 2; }
  .sim--ex4-1 .ex41__card b { font-size: 1.4rem; }
}
@media (prefers-reduced-motion: reduce) { .sim--ex4-1 .ex41__ar { animation: none !important; } }
`;
if (!document.getElementById('css-ex4-1')) { const s = document.createElement('style'); s.id = 'css-ex4-1'; s.textContent = css; document.head.append(s); }
