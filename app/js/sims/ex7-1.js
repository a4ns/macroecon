/* ─────────────────────────────────────────────────────────────
   Упражнение 7.1 — дискретная и автоматическая фискальная политика

   Y = C + I + G,  C = Ca + mpc·Yd,  Yd = Y − T,  I = Ia − d·r,  T = Ta + t·Y
   Ep(Y) = Ca + mpc·((1−t)·Y − Ta) + Ia − d·r + G
   Y₀ = (Ca + Ia + G − mpc·Ta − d·r) / (1 − mpc·(1−t))
   u = 7 − ⅓·(Y₀ − Y*)/Y*·100,   B = T − G
   Мультипликаторы:  mult_G = 1/(1−mpc(1−t)),  mult_T = −mpc/(1−mpc(1−t))

   Исходные значения оригинала: Ca=5500, mpc=.75, Ia=18000, d=400, r=35 %, G=6875, Y*=40000;
   1) дискретная политика:    Ta=8500, t=0 %;
   2) автоматическая политика: Ta=500,  t=20 %.   В обоих случаях Y₀ = 40 000.
   ───────────────────────────────────────────────────────────── */
import { h, fmt } from '../core/dom.js';
import { createChart, mathText } from '../ui/plot.js';
import { simLayout, panel, slider, seg, stat, presets, figure, legend, callout, dtable, button, symHTML } from '../ui/controls.js';

const NB = ' ';
const D = { Ca: 5500, mpc: 0.75, Ia: 18000, d: 400, r: 35, G: 6875, Yf: 40000 };
const REG = { 1: { Ta: 8500, t: 0 }, 2: { Ta: 500, t: 20 } };

/* ── the model: pure functions of a state object ───────────── */
const mt = (s) => 1 - s.mpc * (1 - s.t / 100);
const Ep = (s, Y) => s.Ca + s.mpc * ((1 - s.t / 100) * Y - s.Ta) + s.Ia - s.d * s.r + s.G;
const Y0 = (s) => (s.Ca + s.Ia + s.G - s.mpc * s.Ta - s.d * s.r) / mt(s);
const taxes = (s) => s.Ta + (s.t / 100) * Y0(s);
const Yd = (s) => Y0(s) - taxes(s);
const cons = (s) => s.Ca + s.mpc * Yd(s);
const inv = (s) => s.Ia - s.d * s.r;
const sav = (s) => Yd(s) - cons(s);
const bal = (s) => taxes(s) - s.G;
const unemp = (s) => 7 - (1 / 3) * ((Y0(s) - s.Yf) * 100) / s.Yf;
const multG = (s) => 1 / mt(s);
const multT = (s) => -s.mpc / mt(s);
const lin = (f) => { f.linear = true; return f; };

export function mount(root, env) {
  root.classList.add('sim--ex7-1');
  const L = simLayout(root);
  const st = { reg: 1, ...D, ...REG[1] };
  let base = { ...st };
  let marked = false;

  /* ── controls ─────────────────────────────────────────────── */
  const S = {
    G: slider({ label: 'Государственные закупки', sym: 'G', min: 4000, max: 9500, step: 25, value: D.G, unit: 'ден. ед.', color: 'var(--d5)' }),
    Ta1: slider({ label: 'Аккордный (паушальный) налог', sym: 'T_a', min: 6000, max: 11000, step: 50, value: REG[1].Ta, unit: 'ден. ед.', color: 'var(--d3)' }),
    Ta2: slider({ label: 'Автономные налоги', sym: 'T_a', min: 0, max: 3000, step: 50, value: REG[2].Ta, unit: 'ден. ед.', color: 'var(--d3)' }),
    t: slider({ label: 'Налоговая ставка с дохода', sym: 't', min: 0, max: 40, step: 1, value: REG[2].t, unit: '%', color: 'var(--d4)' }),
    Ca: slider({ label: 'Автономное потребление', sym: 'C_a', min: 3000, max: 8000, step: 100, value: D.Ca, unit: 'ден. ед.', color: 'var(--d1)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.6, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d2)' }),
    Ia: slider({ label: 'Автономные инвестиции', sym: 'I_a', min: 15000, max: 22000, step: 100, value: D.Ia, unit: 'ден. ед.', color: 'var(--d6)' }),
    d: slider({ label: 'Чувствительность инвестиций к ставке', sym: 'd', min: 300, max: 450, step: 1, value: D.d, color: 'var(--d4)' }),
    r: slider({ label: 'Ставка процента', sym: 'r', min: 20, max: 40, step: 1, value: D.r, unit: '%', color: 'var(--d3)' }),
    Yf: slider({ label: 'Потенциальный выпуск', sym: 'Y^*', min: 30000, max: 50000, step: 500, value: D.Yf, unit: 'ден. ед.', color: 'var(--ink-3)' }),
  };
  const regSeg = seg({
    options: [{ v: 1, label: 'Дискретная', hint: 'Налог не зависит от дохода: T = Ta' }, { v: 2, label: 'Автоматическая', hint: 'Налог растёт вместе с доходом: T = Ta + t·Y' }],
    value: 1,
  });
  regSeg.seg.setAttribute('aria-label', 'Вид фискальной политики');
  const regNote = h('p.ex71__regnote');

  const num = (k) => S[k].value;
  const setK = (k, v) => S[k].set(v, { fromUser: true });
  const taKey = () => (st.reg === 1 ? 'Ta1' : 'Ta2');
  const stepBy = (k, dv) => setK(k, S[k].value + dv);

  const pre = presets([
    { label: 'Стимулирующая: G ▲, Ta ▼, t ▼', color: 'var(--d2)', hint: 'Увеличиваются G, уменьшаются Ta и t', key: 'stim',
      apply: () => { mark(); stepBy('G', 500); stepBy(taKey(), -500); if (st.reg === 2) stepBy('t', -5); } },
    { label: 'Сдерживающая: G ▼, Ta ▲, t ▲', color: 'var(--d3)', hint: 'Уменьшаются G, увеличиваются Ta и t', key: 'rest',
      apply: () => { mark(); stepBy('G', -500); stepBy(taKey(), 500); if (st.reg === 2) stepBy('t', 5); } },
    { label: 'Рост G, Ta и t', color: 'var(--d5)', hint: 'Одновременно увеличиваются G, Ta и t', key: 'up',
      apply: () => { mark(); stepBy('G', 500); stepBy(taKey(), 500); if (st.reg === 2) stepBy('t', 5); } },
    { label: 'Сокращение G, Ta и t', color: 'var(--d4)', hint: 'Одновременно уменьшаются G, Ta и t', key: 'down',
      apply: () => { mark(); stepBy('G', -500); stepBy(taKey(), -500); if (st.reg === 2) stepBy('t', -5); } },
    { label: 'Шок спроса: Ia −500', color: 'var(--d6)', hint: 'Проверка автоматических стабилизаторов', key: 'shock',
      apply: () => { mark(); stepBy('Ia', -500); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии из задания' });

  const fiscal = panel({ title: 'Инструменты политики', hint: 'дважды щёлкните название — сброс' }, S.G.el, S.Ta1.el, S.Ta2.el, S.t.el);
  const closeGap = button({ label: 'Подобрать G так, чтобы Y₀ = Y*', variant: 'ghost', sm: true, onClick: () => { mark(); setK('G', gForTarget(st.Yf)); }, title: 'Найти государственные закупки, при которых экономика выйдет на потенциальный выпуск' });
  L.controls.append(
    panel({ title: 'Вид фискальной политики' }, regSeg.el, regNote),
    fiscal,
    panel({ title: 'Остальные параметры', collapsible: true, open: false, hint: 'частное потребление, инвестиции' }, S.Ca.el, S.mpc.el, S.Ia.el, S.d.el, S.r.el, S.Yf.el),
    panel({ title: 'Что будет, если…' }, pre, h('div.ex71__act', closeGap)));

  /* ── readouts ─────────────────────────────────────────────── */
  const R = {
    Y: stat({ label: 'Равновесный доход', sym: 'Y_0', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    C: stat({ label: 'Потребление', sym: 'C', color: 'var(--d2)' }),
    I: stat({ label: 'Инвестиции', sym: 'I', color: 'var(--d6)' }),
    T: stat({ label: 'Налоги', sym: 'T', color: 'var(--d3)' }),
    B: stat({ label: 'Сальдо бюджета', sym: 'B', unit: 'T − G', color: 'var(--d5)' }),
    u: stat({ label: 'Безработица', sym: 'u', unit: '%', dec: 2, color: 'var(--d4)' }),
    mG: stat({ label: 'Мультипликатор G', sym: 'mult_G', dec: 2, color: 'var(--d5)' }),
    mT: stat({ label: 'Мультипликатор Ta', sym: 'mult_T', dec: 2, color: 'var(--d3)' }),
  };
  L.stats.append(R.Y.el, R.C.el, R.I.el, R.T.el, R.B.el, R.u.el, R.mG.el, R.mT.el);

  /* ── chart ────────────────────────────────────────────────── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: 25000, max: 55000, label: 'Y', ticks: 6 },
    y: { min: 25000, max: 55000, label: 'E', ticks: 6 },
    aspect: 1.35, maxH: 560, margin: { l: 58, r: 34, t: 28, b: 44 }, title: 'Кейнсианский крест с налогами и государственными закупками',
  });
  const XM = () => chart.domain().x;
  chart.line('45', { fn: lin((y) => y), from: 25000, to: 55000, color: 'var(--ink-3)', width: 2, dash: '2 7', label: 'E = Y', labelAt: .9, labelDx: -44, labelDy: 26, glow: false, ghost: false });
  chart.line('ep0', { fn: lin((y) => Ep(base, y)), from: 25000, to: 55000, color: 'var(--d5)', width: 2.2, dash: '7 6', label: 'E_p^0', labelAt: .92, labelDy: 20, glow: false, ghost: false });
  chart.line('ep', { fn: lin((y) => Ep(st, y)), from: 25000, to: 55000, color: 'var(--d1)', width: 3.6, label: 'E_p', labelAt: .97, labelDy: -14, ghost: false });
  chart.vline('yf', { x: () => st.Yf, color: 'var(--ink-3)', dash: '6 6', width: 1.6, label: 'Y^*', labelDx: 8 });
  chart.arrow('shift', { from: () => [Y0(base), Y0(base)], to: () => [Y0(st), Y0(st)], color: 'var(--ink-2)', width: 1.6, head: 8 });
  chart.point('eq0', { x: () => Y0(base), y: () => Y0(base), color: 'var(--d5)', r: 5 });
  chart.point('eq', { x: () => Y0(st), y: () => Y0(st), color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'Y_1', y: 'E_1' },
    draggable: ({ x }) => { setK('G', gForTarget(x)); } });

  /* government spending needed for a target income, at current other parameters */
  function gForTarget(Yt) {
    const g = Yt * mt(st) - (st.Ca + st.Ia - st.mpc * st.Ta - st.d * st.r);
    return Math.round(g / 25) * 25;
  }

  const vis = (id, on) => { const e = chart.get(id); e && e.nodes.forEach((n) => { n.style.display = on ? '' : 'none'; }); };

  /* second figure: budget + automatic stabiliser */
  const budget = h('div.ex71__bud');
  const stab = h('div.ex71__stab');
  L.stage.append(
    figure('Кейнсианский крест · фискальная политика', host, { note: 'Ось E — планируемые расходы, ось Y — доход (ден. ед.). Пунктирная синяя кривая — Eₚ до изменения; стрелка показывает сдвиг равновесия. Точку равновесия можно перетаскивать: модель подберёт G.' }),
    legend([
      { color: 'var(--d1)', label: 'E_p — планируемые расходы' }, { color: 'var(--d5)', label: 'E_p^0 — до изменения', dash: true },
      { color: 'var(--ink-3)', label: 'E = Y', dash: true }, { color: 'var(--ink-3)', label: 'Y^* — потенциальный выпуск', dash: true }]),
    figure('Бюджет государства', budget, { class: 'ex71__fig' }),
    figure('Эффективность: насколько налог гасит шок спроса', stab, { class: 'ex71__fig' }),
  );

  /* ── table + explanation ──────────────────────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получено равновесие' });
  L.notes.append(tbl.el, expl);

  /* ── update ───────────────────────────────────────────────── */
  const KEYS = ['G', 'Ca', 'mpc', 'Ia', 'd', 'r', 'Yf'];
  function readState() {
    KEYS.forEach((k) => (st[k] = S[k].value));
    st.Ta = st.reg === 1 ? S.Ta1.value : S.Ta2.value;
    st.t = st.reg === 1 ? 0 : S.t.value;
  }
  const f0 = (v) => fmt(v, 0).replace('-', '−');
  const sign = (v, d = 0) => (v > 0.5 * Math.pow(10, -d) ? '+' : v < -0.5 * Math.pow(10, -d) ? '−' : '') + fmt(Math.abs(v), d);
  const same = (a, b) => KEYS.concat(['Ta', 't']).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
  const sub = (s) => symHTML(s);

  function applyReg() {
    const one = st.reg === 1;
    S.Ta1.el.hidden = !one; S.Ta2.el.hidden = one; S.t.el.hidden = one;
    regNote.textContent = one
      ? 'Налог не зависит от дохода: T = Ta. Он сдвигает кривую Eₚ параллельно и не меняет её наклон.'
      : 'Налог растёт вместе с доходом: T = Ta + t·Y. Ставка t уменьшает наклон Eₚ и мультипликатор — это встроенный стабилизатор.';
  }

  function render() {
    const y = Y0(st), by = Y0(base);
    R.Y.set(y); R.C.set(cons(st)); R.I.set(inv(st)); R.T.set(taxes(st)); R.B.set(bal(st)); R.u.set(unemp(st)); R.mG.set(multG(st)); R.mT.set(multT(st));
    R.Y.base(by); R.C.base(cons(base)); R.I.base(inv(base)); R.T.base(taxes(base)); R.B.base(bal(base)); R.u.base(unemp(base)); R.mG.base(multG(base)); R.mT.base(multT(base));

    const moved = Math.abs(y - by) > 0.5 || !same(st, base);
    vis('ep0', !same(st, base)); vis('eq0', Math.abs(y - by) > 0.5); vis('shift', Math.abs(y - by) > 0.5);
    const lab = chart.get('ep').lab; if (lab) mathText(lab, same(st, base) ? 'E_p' : 'E_p^1');

    const row = (k, a, b, dec = 0) => ({ k, a: fmt(a, dec).replace('-', '−'), b: fmt(b, dec).replace('-', '−'), d: sign(b - a, dec) });
    tbl.set([
      row('Равновесный доход Y₀', by, y),
      row('Потребление C', cons(base), cons(st)),
      row('Инвестиции I', inv(base), inv(st)),
      row('Закупки G', base.G, st.G),
      row('Налоги T', taxes(base), taxes(st)),
      row('Сальдо бюджета B = T − G', bal(base), bal(st)),
      row('Располагаемый доход Yd', Yd(base), Yd(st)),
      row('Безработица u, %', unemp(base), unemp(st), 2),
    ]);

    /* explanation */
    const Tn = taxes(st), B = bal(st), gap = y - st.Yf;
    const num = `(${f0(st.Ca)} + ${f0(st.Ia)} + ${f0(st.G)} − ${fmt(st.mpc, 2)}·${f0(st.Ta)} − ${f0(st.d)}·${f0(st.r)})`;
    let txt;
    txt = `<p>${sub('Y_0')} = (${sub('C_a')} + ${sub('I_a')} + ${sub('G')} − ${sub('mpc')}·${sub('T_a')} − ${sub('d')}·${sub('r')}) / (1 − ${sub('mpc')}·(1 − ${sub('t')})) = ${num}${NB}/${NB}${fmt(mt(st), 3)} = <b>${f0(y)}</b></p>`;
    const onlyFiscal = KEYS.filter((k) => k !== 'G' && k !== 'Yf').every((k) => Math.abs(st[k] - base[k]) < 1e-9) && Math.abs(st.t - base.t) < 1e-9 && st.Yf === base.Yf;
    if (marked || !same(st, base)) {
      if (onlyFiscal && (Math.abs(st.G - base.G) > 1e-9 || Math.abs(st.Ta - base.Ta) > 1e-9)) {
        const dG = st.G - base.G, dT = st.Ta - base.Ta;
        txt += `<p>Изменение: ΔY = mult<sub>G</sub>·ΔG + mult<sub>T</sub>·ΔT<sub>a</sub> = ${fmt(multG(st), 2)}·(${sign(dG)}) + (${fmt(multT(st), 2)})·(${sign(dT)}) = <b>${sign(y - by)}</b>.</p>`;
      } else if (Math.abs(y - by) > 0.5) {
        txt += `<p>Доход изменился на <b>${sign(y - by)}</b> (${sign(((y - by) / by) * 100, 1)}${NB}%).</p>`;
      }
    }
    const dir = y - by;
    let verdict = '';
    if (Math.abs(dir) > 0.5) {
      verdict += dir > 0
        ? `Кривая E<sub>p</sub> сдвинулась вверх, равновесный доход вырос, безработица ${unemp(st) < unemp(base) ? 'снизилась' : 'изменилась'} до ${fmt(unemp(st), 2)}${NB}%. `
        : `Кривая E<sub>p</sub> сдвинулась вниз, равновесный доход упал, безработица ${unemp(st) > unemp(base) ? 'выросла' : 'изменилась'} до ${fmt(unemp(st), 2)}${NB}%. `;
    }
    if (Math.abs(st.t - base.t) > 1e-9) verdict += `Ставка t изменила наклон E<sub>p</sub>: мультипликатор G теперь ${fmt(multG(st), 2)}. `;
    verdict += Math.abs(gap) < 1 ? '<b>Выпуск равен потенциальному.</b> ' : gap < 0 ? `<b>Рецессионный разрыв ${f0(-gap)}.</b> ` : `<b>Инфляционный разрыв ${f0(gap)}.</b> `;
    verdict += B > 0.5 ? `Бюджет в профиците: ${f0(B)}.` : B < -0.5 ? `Бюджет в дефиците: ${f0(-B)}.` : 'Бюджет сбалансирован.';
    expl.querySelector('.co__b').innerHTML = txt + `<p>${verdict}</p>`;

    drawBudget(Tn, B);
    drawStab();
    closeGap.disabled = Math.abs(gap) < 1;
  }

  function drawBudget(Tn, B) {
    const mx = Math.max(Tn, st.G, bal(base) + st.G, 1) * 1.08;
    const bar = (lab, v, c, ref) => h('div.ex71__r', h('span.ex71__l', { html: symHTML(lab) }),
      h('span.ex71__t', h('i', { style: { '--w': (Math.max(0, v) / mx).toFixed(4), '--c': c } }), ref != null ? h('u', { style: { '--w': (Math.max(0, ref) / mx).toFixed(4) }, title: 'Исходно' }) : null),
      h('b', f0(v)));
    budget.textContent = '';
    budget.append(
      bar('T', Tn, 'var(--d3)', marked || !same(st, base) ? taxes(base) : null),
      bar('G', st.G, 'var(--d5)', marked || !same(st, base) ? base.G : null),
      h('p.ex71__sum', B > 0.5 ? 'Профицит бюджета ' : B < -0.5 ? 'Дефицит бюджета ' : 'Баланс ', h('b', B > 0.5 ? '+' + f0(B) : f0(B)), ' = T − G. ',
        'Засечка — исходное значение. При росте дохода налоговые поступления T растут сами, без решений правительства — поэтому при ставке t бюджет сам «охлаждает» подъём и «подпитывает» спад.'));
  }

  function drawStab() {
    const dA = 1000, tEff = st.reg === 2 ? st.t : REG[2].t;
    const y1 = dA / (1 - st.mpc), y2 = dA / (1 - st.mpc * (1 - tEff / 100));
    const mx = y1 * 1.05;
    const bar = (lab, v, c) => h('div.ex71__r', h('span.ex71__l', lab), h('span.ex71__t', h('i', { style: { '--w': (v / mx).toFixed(4), '--c': c } })), h('b', f0(v)));
    stab.textContent = '';
    stab.append(
      bar('Только аккордный налог (t = 0)', y1, 'var(--d3)'),
      bar(`С пропорциональным налогом (t = ${f0(tEff)} %)`, y2, 'var(--d2)'),
      h('p.ex71__sum', `Шок автономных расходов ΔA = +${f0(dA)} (скажем, рост Ia) меняет доход на ΔY = ΔA/(1 − mpc·(1 − t)). Налог со ставкой ${f0(tEff)}${NB}% гасит около `, h('b', fmt((1 - y2 / y1) * 100, 0) + NB + '%'), '\u00a0колебаний дохода — без единого решения правительства.'));
  }

  /* chart domain follows the model */
  function fitDomain() {
    const pts = [Y0(st), Y0(base), st.Yf];
    const lo0 = Math.min(...pts), hi0 = Math.max(...pts);
    const lo = Math.max(0, Math.floor((lo0 * 0.68) / 5000) * 5000), hi = Math.ceil((hi0 * 1.32) / 5000) * 5000;
    const dm = chart.domain().x;
    if (lo !== dm[0] || hi !== dm[1]) {
      chart.setDomain({ x: [lo, hi], y: [lo, hi] }, true);
      ['45', 'ep0', 'ep'].forEach((id) => { const o = chart.get(id).op; o.from = lo; o.to = hi; });
      chart.update();
    }
  }

  const onChange = () => { readState(); fitDomain(); chart.update(); render(); };
  Object.values(S).forEach((s) => s.on(onChange));

  function setReg(v, silent) {
    st.reg = v; regSeg.set(v, { silent: true });
    applyReg();
    S.t.disable(v === 1);
    if (v === 1) S.t.set(0, { silent: true }); else S.t.set(REG[2].t, { silent: true });
  }
  regSeg.on((v) => {
    if (v === st.reg) return;
    setReg(v);
    api.reset(true);
    env.toast && env.toast(v === 1 ? 'Дискретная политика: Ta = 8 500, t = 0' : 'Автоматическая политика: Ta = 500, t = 20 %');
  });
  setReg(1); readState(); base = { ...st }; fitDomain(); render();

  /* ── frame API ────────────────────────────────────────────── */
  function mark() { base = { ...st }; marked = true; render(); chart.update(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { base = { ...REG_BASE() }; marked = false; render(); chart.update(); },
    reset(keepReg) {
      const reg = st.reg;
      Object.values(S).forEach((s) => s.reset(true));
      S.t.set(reg === 1 ? 0 : REG[2].t, { silent: true });
      marked = false; readState(); base = { ...st }; fitDomain(); chart.update(); render();
    },
    destroy() { chart.destroy(); },
  };
  function REG_BASE() { return { reg: st.reg, ...D, ...REG[st.reg] }; }
  return api;
}

/* ── scoped styles ──────────────────────────────────────────── */
const css = `
.sim--ex7-1 .ex71__regnote { margin: .7rem 0 0; font: italic 300 .9rem/1.45 var(--f-serif); color: var(--ink-3); }
.sim--ex7-1 .ex71__act { margin-top: .8rem; }
.sim--ex7-1 .ex71__act .btn:disabled { opacity: .45; pointer-events: none; }
.sim--ex7-1 .ex71__fig { min-width: 0; }
.sim--ex7-1 .ex71__bud, .sim--ex7-1 .ex71__stab { display: grid; gap: .65rem; padding: .3rem .6rem .7rem; }
.sim--ex7-1 .ex71__r { display: grid; grid-template-columns: minmax(5.5rem, 12rem) 1fr auto; align-items: center; gap: .7rem; }
.sim--ex7-1 .ex71__l { font: 400 .86rem/1.25 var(--f-sans); color: var(--ink-2); }
.sim--ex7-1 .ex71__r b { font: 500 .82rem/1 var(--f-mono); color: var(--ink); min-width: 4.4rem; text-align: right; }
.sim--ex7-1 .ex71__t { position: relative; height: .95rem; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
.sim--ex7-1 .ex71__t i { position: absolute; inset: 0 auto 0 0; width: calc(var(--w) * 100%); background: var(--c); border-radius: 4px; transition: width .6s var(--ease); }
.sim--ex7-1 .ex71__t u { position: absolute; top: -2px; bottom: -2px; left: calc(var(--w) * 100%); width: 2px; background: var(--ink); text-decoration: none; opacity: .85; transition: left .6s var(--ease); }
.sim--ex7-1 .ex71__sum { grid-column: 1 / -1; margin: .15rem 0 0; font: italic 300 .95rem/1.45 var(--f-serif); color: var(--ink-3); }
.sim--ex7-1 .ex71__sum b { margin-inline: .12em; color: var(--ink); font-style: normal; font-weight: 600; font-family: var(--f-mono); font-size: .86rem; }
@media (max-width: 520px) {
  .sim--ex7-1 .ex71__r { grid-template-columns: 1fr auto; row-gap: .25rem; }
  .sim--ex7-1 .ex71__r .ex71__t { grid-column: 1 / -1; grid-row: 2; }
}
`;
if (!document.getElementById('css-ex7-1')) { const s = document.createElement('style'); s.id = 'css-ex7-1'; s.textContent = css; document.head.append(s); }
