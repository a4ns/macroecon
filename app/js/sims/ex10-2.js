/* ─────────────────────────────────────────────────────────────
   Упражнение 10.2 — построение кривой LM (денежный рынок)

   M/P = k·Y − h·r,  k = round(1/V, 2)   ⇒   LM:  Y = (M/P + h·r) / k,   r = (k·Y − M/P) / h
   Исходно: P = 1, M = 20000, V = 1,17 (k = 0,85), h = 400; выбранный доход Y = 40000 (r = 35 %).
   Для каждого выбранного Y находим ставку, при которой спрос на деньги M^D = k·Y − h·r равен
   реальному предложению M/P — это точка LM; соединив точки, получаем всю кривую.
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, stat, presets, figure, legend, callout, dtable, button, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';
import { typo, D as D0, kk, real, lmY, lmR, lmY0, lmSlope, f0, f1, f2, sgn, niceCeil, injectCss, SHARED_CSS } from './_islm.js';

const KEYS = ['P', 'M', 'V', 'h'];
const D = { ...Object.fromEntries(KEYS.map((k) => [k, D0[k]])), Y: 40000 };
const RM = 70, YM = 100000;
const SWEEP = [25000, 30000, 35000, 40000, 45000, 50000, 55000];
const MSTEPS = [40000, 60000, 80000, 100000, 150000];
const tk = (v) => { v = Math.abs(v); return v >= 1e4 ? fmt(v / 1e3, v % 1e3 ? 1 : 0) + 'k' : fmt(v, 0); };
const md = (s, r) => kk(s) * s.Y - s.h * r;                     // спрос на деньги M^D(r) при доходе s.Y
const rEnd = (v, sl) => clamp(v / sl, 0, RM);

export function mount(root, env) {
  root.classList.add('sim--ex10-2');
  injectCss('css-islm-shared', SHARED_CSS);
  const L = simLayout(root);
  L.stage.classList.add('is-2');
  const st = { ...D };
  let base = { ...D };
  let MM = MSTEPS[0];
  const timers = new Set();
  const pins = [];                     // { Y, id }

  /* ── параметры ───────────────────────────────────────────── */
  const S = {
    P: slider({ label: 'Общий уровень цен', sym: 'P', min: 0.5, max: 1.5, step: 0.05, value: D.P, dec: 2, color: 'var(--d3)' }),
    M: slider({ label: 'Номинальная денежная масса', sym: 'M', min: 12000, max: 28000, step: 100, value: D.M, unit: 'ден. ед.', color: 'var(--d1)' }),
    V: slider({ label: 'Скорость обращения денег', sym: 'V', min: 1.0, max: 1.3, step: 0.01, value: D.V, dec: 2, color: 'var(--d4)' }),
    h: slider({ label: 'Чувствительность спроса на деньги к ставке', sym: 'h', min: 200, max: 600, step: 10, value: D.h, color: 'var(--d5)' }),
    Y: slider({ label: 'Выбранный уровень дохода', sym: 'Y', min: 20000, max: 80000, step: 500, value: D.Y, unit: 'ден. ед.', color: 'var(--ink)' }),
  };
  const set = (k, v) => S[k].set(v, { fromUser: true });

  const playBtn = button({ label: 'Построить по точкам', icon: 'play', sm: true, onClick: () => (sweeping ? stopSweep() : startSweep()) });
  const pinBtn = button({ label: 'Отметить точку', sm: true, onClick: () => addPin(st.Y) });
  const clrBtn = button({ label: 'Стереть точки', sm: true, onClick: () => clearPins() });

  const pre = presets([
    { label: 'Эмиссия: M +2000', color: 'var(--d1)', hint: 'Денежная масса растёт при тех же ценах', apply: () => { mark(); set('M', st.M + 2000); } },
    { label: 'Цены растут: P +0,2', color: 'var(--d3)', hint: 'Реальные кассовые остатки сокращаются', apply: () => { mark(); set('P', +(st.P + 0.2).toFixed(2)); } },
    { label: 'Деньги быстрее: V +0,10', color: 'var(--d4)', hint: 'Каждая денежная единица обслуживает больше сделок', apply: () => { mark(); set('V', +(st.V + 0.1).toFixed(2)); } },
    { label: 'Спрос чувствительнее: h +100', color: 'var(--d5)', hint: 'Спрос на деньги сильнее реагирует на ставку — LM положе', apply: () => { mark(); set('h', st.h + 100); } },
    { label: 'Спрос менее чувствителен: h −100', color: 'var(--d5)', hint: 'LM становится круче', apply: () => { mark(); set('h', st.h - 100); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Что будет, если…' });

  L.controls.append(
    panel({ title: 'Выбранный доход', hint: 'тяните точку на LM' }, S.Y.el,
      h('div.islm__row', { style: { marginTop: '.6rem' } }, playBtn, pinBtn, clrBtn)),
    panel({ title: 'Параметры денежного рынка', hint: 'дважды щёлкните название — сброс' }, S.P.el, S.M.el, S.V.el, S.h.el),
    panel({ title: 'Сценарии' }, pre));

  /* ── показатели ──────────────────────────────────────────── */
  const R = {
    r: stat({ label: 'Ставка при выбранном доходе', sym: 'r', unit: '%', dec: 1, size: 'l', color: 'var(--d1)' }),
    MP: stat({ label: 'Реальные деньги', sym: 'M/P', unit: 'ден. ед.', color: 'var(--d1)' }),
    k: stat({ label: 'Коэффициент', sym: 'k', unit: '= 1/V', dec: 2, color: 'var(--d4)' }),
    Y0: stat({ label: 'LM при r = 0', sym: 'Y', unit: 'ден. ед.', color: 'var(--d3)' }),
    SL: stat({ label: 'Наклон LM', sym: 'ΔY/Δr', unit: '= h/k', color: 'var(--d5)' }),
  };
  L.stats.append(R.r.el, R.MP.el, R.k.el, R.Y0.el, R.SL.el);

  /* ── график LM ───────────────────────────────────────────── */
  const clampR = (r) => clamp(r, 0, RM);
  const lmPts = (s) => { const rr = clamp((YM - lmY0(s)) / lmSlope(s), 0, RM); return [[lmY(s, 0), 0], [lmY(s, rr), rr]]; };
  const lmHost = h('div');
  const lm = createChart(lmHost, {
    x: { min: 0, max: YM, label: 'Y', ticks: 5, fmt: tk }, y: { min: 0, max: RM, label: 'r, %', ticks: [0, 10, 20, 30, 40, 50, 60, 70] },
    aspect: 1.15, maxH: 440, margin: { l: 50, r: 30, t: 28, b: 42 }, title: 'Кривая LM: доход Y и ставка процента r',
  });
  lm.line('ref', { pts: lmPts(base), color: 'var(--ink-3)', width: 2.2, dash: '6 6', glow: false, ghost: false, label: 'LM_0', labelAt: .9, labelAnchor: 'end', labelDx: -8, labelDy: 0 });
  lm.line('lm', { pts: lmPts(st), color: 'var(--d1)', width: 3.6, label: 'LM', labelAt: 1, labelDx: 8, labelDy: 4 });
  lm.point('pt', { x: () => st.Y, y: () => clampR(lmR(st, st.Y)), color: 'var(--ink)', r: 7.5, pulse: true, guides: { x: 'Y', y: 'r' },
    draggable: ({ x }) => S.Y.set(clamp(Math.round(x / 500) * 500, 20000, 80000), { fromUser: true }) });

  /* ── график денежного рынка ──────────────────────────────── */
  const mdPts = (s, Y) => { const k = kk(s), e = rEnd(k * Y, s.h); return [[k * Y, 0], [k * Y - s.h * e, e]]; };
  const mkHost = h('div');
  const mk = createChart(mkHost, {
    x: { min: 0, max: MM, label: 'M/P', ticks: 4, fmt: tk }, y: { min: 0, max: RM, label: 'r, %', ticks: [0, 10, 20, 30, 40, 50, 60, 70] },
    aspect: 1.15, maxH: 440, margin: { l: 50, r: 36, t: 28, b: 42 }, title: 'Рынок денег: спрос M^D и предложение M^S',
  });
  mk.vline('msRef', { x: () => real(base), color: 'var(--ink-3)', dash: '6 6', width: 1.6 });
  mk.line('mdRef', { pts: mdPts({ ...base, Y: st.Y }, st.Y), color: 'var(--ink-3)', width: 2, dash: '6 6', glow: false, ghost: false });
  mk.vline('ms', { x: () => real(st), color: 'var(--d1)', width: 3, dash: '', label: 'M^S', labelDx: 8 });
  mk.line('md', { pts: mdPts(st, st.Y), color: 'var(--d5)', width: 3.6, label: 'M^D', labelAt: 1, labelDx: 8, labelDy: 14 });
  mk.point('eq', { x: () => real(st), y: () => clampR(lmR(st, st.Y)), color: 'var(--ink)', r: 7, pulse: true, guides: { x: 'M/P', y: 'r' } });

  function addPin(Y) {
    if (pins.some((p) => p.Y === Y)) return;
    const id = 'pin' + Y; pins.push({ Y, id });
    mk.line('l' + id, { pts: mdPts(st, Y), color: 'var(--d5)', width: 1.6, glow: false, ghost: false, dash: '2 5' });
    mk.point('p' + id, { x: () => real(st), y: () => clampR(lmR(st, Y)), color: 'var(--d5)', r: 4 });
    lm.point('p' + id, { x: Y, y: () => clampR(lmR(st, Y)), color: 'var(--d1)', r: 4.5 });
    syncPins();
  }
  function clearPins() { pins.forEach((p) => { mk.remove('l' + p.id); mk.remove('p' + p.id); lm.remove('p' + p.id); }); pins.length = 0; }
  const syncPins = () => { pins.forEach((p) => { mk.get('l' + p.id).op.pts = mdPts(st, p.Y); }); };

  L.stage.append(
    figure('Кривая LM · доход и ставка', lmHost, { class: 'ex102__lm', note: 'Для выбранного дохода Y ставка r — такая, при которой спрос на деньги равен предложению. Тяните точку вдоль LM по горизонтали.' }),
    figure('Рынок денег · M^D и M^S', mkHost, { class: 'ex102__mk', note: 'Горизонтальный пунктир переносит ставку из денежного рынка на график LM. Точечные линии — спрос на деньги при отмеченных значениях Y.' }));
  const lgd = (legend([
    { color: 'var(--d1)', label: 'LM; M^S = M/P — предложение денег' }, { color: 'var(--d5)', label: 'M^D = kY − hr — спрос на деньги' },
    { color: 'var(--ink-3)', label: 'исходное положение', dash: true }]));

  /* ── таблица и пояснения ─────────────────────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получена точка LM' }); expl.classList.add('islm__expl');
  const why = callout({ tone: 'ok', title: 'Что произошло с кривой' }); why.classList.add('islm__expl');
  L.notes.append(lgd, tbl.el, expl, why);

  const SYM = { P: 'P', M: 'M', V: 'V', h: 'h' };
  const TONE = { P: 'var(--d3)', M: 'var(--d1)', V: 'var(--d4)', h: 'var(--d5)' };
  const point = (s) => ({ r: lmR(s, st.Y), MP: real(s), k: kk(s), Y0: lmY0(s), sl: lmSlope(s), Y70: lmY(s, RM), MD0: kk(s) * st.Y });
  function describe() {
    const ch = KEYS.filter((k) => Math.abs(st[k] - base[k]) > 1e-9);
    if (!ch.length) return nb('<p>Кривая LM стоит в исходном положении. Измените любой параметр или выберите сценарий — пунктир покажет, где она была.</p><p>Рост <b>M</b> и <b>V</b> сдвигает LM вправо, рост <b>P</b> — влево, а <b>h</b> меняет наклон: чем выше чувствительность спроса на деньги к ставке, тем положе LM.</p>');
    const b = point(base), c = point(st);
    const flatter0 = base.h ? kk(base) / base.h : 0, flatter1 = kk(st) / st.h;
    const rot = Math.abs(flatter1 - flatter0) > 1e-9;
    const dYr = lmY(st, st.Y > 0 ? lmR(st, st.Y) : 0) - lmY(base, lmR(st, st.Y));        // сдвиг по Y при той же ставке
    const head = rot
      ? `<strong>LM повернулась и стала ${flatter1 < flatter0 ? 'положе' : 'круче'}</strong>: ΔY/Δr = ${f0(b.sl)} → ${f0(c.sl)} на 1 п.п. ставки.`
      : `<strong>LM сдвинулась параллельно ${dYr > 0 ? 'вправо' : 'влево'}</strong> на ${f0(Math.abs(dYr))} при любой ставке.`;
    const detail = [];
    if (Math.abs(real(st) - real(base)) > 1e-9) detail.push(`Реальные деньги M/P: ${f0(b.MP)} → <b>${f0(c.MP)}</b>.`);
    if (Math.abs(c.k - b.k) > 1e-9) detail.push(`Коэффициент k = 1/V: ${f2(b.k)} → <b>${f2(c.k)}</b>.`);
    detail.push(`При Y = ${f0(st.Y)} ставка меняется с ${f1(b.r)} % до <b>${f1(c.r)} %</b> (${sgn(c.r - b.r, 1)} п.п.).`);
    const why1 = {
      M: (v) => v > 0 ? 'больше номинальных денег — больше реальных остатков M/P; при каждой ставке экономика «обслуживает» больший доход' : 'меньше денег — меньше M/P, при каждой ставке доход, который они обслуживают, ниже',
      P: (v) => v > 0 ? 'рост цен обесценивает деньги: реальное предложение M/P падает, LM смещается влево' : 'цены ниже — реальное предложение M/P растёт, LM смещается вправо',
      V: (v) => v > 0 ? 'деньги обращаются быстрее, k = 1/V меньше: на единицу дохода нужно меньше денег, LM уходит вправо и становится положе' : 'деньги обращаются медленнее — спрос на деньги вырастает, LM уходит влево и становится круче',
      h: (v) => v > 0 ? 'спрос на деньги сильнее зависит от ставки: чтобы вернуть равновесие при росте дохода, ставка меняется слабее — LM положе' : 'спрос на деньги слабее реагирует на ставку: нужен больший рост ставки — LM круче',
    };
    return nb(`<p>${head}</p><p>${detail.join(' ')}</p><p>${ch.slice(0, 3).map((k) => `<span class="islm__tag" style="--c:${TONE[k]}">${symHTML(SYM[k])} ${sgn(st[k] - base[k], k === 'P' || k === 'V' ? 2 : 0)}</span> ${why1[k](st[k] - base[k])}`).join('. ')}.</p>`);
  }

  function render() {
    const c = point(st), b = point(base);
    R.r.set(c.r); R.MP.set(c.MP); R.k.set(c.k); R.Y0.set(c.Y0); R.SL.set(c.sl);
    R.r.base(b.r); R.MP.base(b.MP); R.k.base(b.k); R.Y0.base(b.Y0); R.SL.base(b.sl);
    tbl.set([
      { k: 'Ставка r при выбранном Y, %', a: f1(b.r), b: f1(c.r), d: sgn(c.r - b.r, 1) },
      { k: 'Реальные деньги M/P', a: f0(b.MP), b: f0(c.MP), d: sgn(c.MP - b.MP) },
      { k: 'Коэффициент k = 1/V', a: f2(b.k), b: f2(c.k), d: sgn(c.k - b.k, 2) },
      { k: 'Спрос на деньги при r = 0: kY', a: f0(b.MD0), b: f0(c.MD0), d: sgn(c.MD0 - b.MD0) },
      { k: 'Доход на LM при r = 0', a: f0(b.Y0), b: f0(c.Y0), d: sgn(c.Y0 - b.Y0) },
      { k: 'Доход на LM при r = 70 %', a: f0(b.Y70), b: f0(c.Y70), d: sgn(c.Y70 - b.Y70) },
      { k: 'Наклон LM, ΔY/Δr', a: f0(b.sl), b: f0(c.sl), d: sgn(c.sl - b.sl) },
    ]);
    const k = kk(st), spec = real(st), tr = k * st.Y;
    const out = c.r < 0 || c.r > RM;
    expl.querySelector('.co__b').innerHTML = nb(`<p class="islm__eq">${symHTML('r')} = (k·Y − M/P) / h = (${f2(k)}·${f0(st.Y)} − ${f0(st.M)}/${f2(st.P)}) / ${f0(st.h)} = <b>${f1(c.r)} %</b></p>
      <p>Деньги нужны на сделки в размере k·Y = <b>${f0(tr)}</b>; предложено M/P = <b>${f0(spec)}</b>. ${tr > spec
        ? `Разность <b>${f0(tr - spec)}</b> должен «снять» спекулятивный спрос: он падает с ростом ставки на h = ${f0(st.h)} за каждый п.п., поэтому равновесие достигается при r = ${f1(c.r)} %.`
        : `Предложение денег больше, чем нужно на сделки, — равновесие требует нулевой или отрицательной ставки (${f1(c.r)} %): при таком доходе кривая LM здесь не определена.`}</p>
      ${out ? `<p><strong>Точка вне поля графика</strong> (r ${c.r < 0 ? '< 0' : '> 70 %'}): измените доход или параметры.</p>` : ''}
      <p>Дальше — по LM: Y = (M/P + h·r) / k = (${f0(spec)} + ${f0(st.h)}·${f1(c.r)}) / ${f2(k)} = <b>${f0(st.Y)}</b>.</p>`);
    why.querySelector('.co__b').innerHTML = describe();
  }

  function fitDomain() {
    const want = niceCeil(Math.max(kk(st) * st.Y * 1.1, real(st) * 1.15, real(base) * 1.15), MSTEPS);
    const ch = want !== MM; MM = want; return ch;
  }
  function refresh() {
    const same = KEYS.every((k) => Math.abs(st[k] - base[k]) < 1e-9);
    lm.get('lm').op.pts = lmPts(st); lm.get('ref').op.pts = lmPts(base);
    mk.get('md').op.pts = mdPts(st, st.Y); mk.get('mdRef').op.pts = mdPts({ ...base, Y: st.Y }, st.Y);
    syncPins();
    mk.setDomain({ x: [0, MM], y: [0, RM] }, true);
    [lm.get('ref'), mk.get('mdRef'), mk.get('msRef')].forEach((e) => [e.node, e.halo, e.lab, ...(e.nodes || [])].forEach((n) => n && (n.style.display = same ? 'none' : '')));
    lm.update(); mk.update();
  }
  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); }
  function onChange() { readState(); fitDomain(); refresh(); render(); }
  Object.values(S).forEach((s) => s.on(() => onChange()));

  /* ── построение по точкам ────────────────────────────────── */
  let sweeping = false, tm = 0;
  const setPlayLabel = (on) => { playBtn.lastChild.textContent = on ? 'Остановить' : 'Построить по точкам'; };
  function stopSweep() { sweeping = false; clearTimeout(tm); timers.delete(tm); setPlayLabel(false); }
  function startSweep() {
    clearPins(); sweeping = true; setPlayLabel(true); let i = 0;
    const step = () => {
      if (!sweeping) return;
      if (i >= SWEEP.length) { stopSweep(); return; }
      set('Y', SWEEP[i]); addPin(SWEEP[i]); i++;
      tm = setTimeout(step, 560); timers.add(tm);
    };
    step();
  }

  /* ── API рамки ───────────────────────────────────────────── */
  function mark() { base = { ...st }; onChange(); }
  const api = {
    charts: [lm, mk],
    compare() { mark(); },
    clearCompare() { base = { ...D }; onChange(); },
    reset() { stopSweep(); clearPins(); base = { ...D }; Object.values(S).forEach((s) => s.reset(true)); onChange(); },
    destroy() { stopSweep(); timers.forEach(clearTimeout); lm.destroy(); mk.destroy(); },
  };
  readState(); fitDomain(); refresh(); render();
  lm.update(null, true); mk.update(null, true);
  typo(L.controls); typo(L.stage); typo(L.stats);
  return api;
}

const css = `
@media (min-width: 1101px) { .sim--ex10-2 .ex102__lm { order: 2; } .sim--ex10-2 .ex102__mk { order: 1; } }
`;
injectCss('css-ex10-2', css);
