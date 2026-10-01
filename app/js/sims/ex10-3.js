/* ─────────────────────────────────────────────────────────────
   Упражнение 10.3 — равновесие на товарном и денежном рынках (модель IS–LM)

   IS:  Y = (A − d·r) / (1 − mpc·(1 − t)),  A = Ca + Ia + G − mpc·Ta
   LM:  Y = (M/P + h·r) / k,                 k = round(1/V, 2)
   Y₀ = (h·A + d·M/P) / (k·d + h·(1 − mpc·(1 − t))),   r₀ = (k·Y₀ − M/P) / h
   Дополнительно: T = Ta + t·Y, C = Ca + mpc·(Y − T), I = Ia − d·r,
                  u = 7 − (Y − Y*)·100/(3·Y*)  (закон Оукена), B = T − G, π = (P − 1)·100.
   Исходно: Y₀ = Y* = 40000, r₀ = 35 %.
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, seg, stat, presets, figure, legend, callout, dtable, button, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';
import { typo, D, mT, aut, isY, isY0, isSlope, lmY, lmY0, lmSlope, kk, real, equil, f0, f1, f2, sgn, niceCeil, injectCss, SHARED_CSS } from './_islm.js';

const KEYS = ['Ca', 'mpc', 'Ia', 'd', 'Ta', 't', 'G', 'M', 'V', 'h', 'P', 'Yf'];
const RM = 70;
const YSTEPS = [100000, 125000, 150000, 200000, 300000];
const tk = (v) => { v = Math.abs(v); return v >= 1e4 ? fmt(v / 1e3, v % 1e3 ? 1 : 0) + 'k' : fmt(v, 0); };

/* крайние значения из оригинального задания: [мин, база, макс] */
const FA = { G: { sym: 'G', ext: [4975, 6875, 7975] }, t: { sym: 't', ext: [10, 20, 30] } };
const FB = { M: { sym: 'M', ext: [19000, 20000, 21000] }, V: { sym: 'V', ext: [1.05, 1.17, 1.25] }, P: { sym: 'P', ext: [0.8, 1, 1.5] } };

const rEnd = (v, sl) => clamp(v / sl, 0, RM);
const isPts = (s) => { const e = rEnd(isY0(s), isSlope(s)); return [[isY(s, 0), 0], [isY(s, e), e]]; };

export function mount(root, env) {
  root.classList.add('sim--ex10-3');
  injectCss('css-islm-shared', SHARED_CSS);
  const L = simLayout(root);
  const st = { ...D };
  let base = { ...D };
  let YM = YSTEPS[0];
  let fa = 'G', fb = 'M';

  const lmPts = (s) => { const rr = clamp((YM - lmY0(s)) / lmSlope(s), 0, RM); return [[lmY(s, 0), 0], [lmY(s, rr), rr]]; };

  /* ── параметры ───────────────────────────────────────────── */
  const S = {
    G: slider({ label: 'Государственные расходы', sym: 'G', min: 4000, max: 9000, step: 25, value: D.G, unit: 'ден. ед.', color: 'var(--d4)' }),
    t: slider({ label: 'Налоговая ставка', sym: 't', min: 5, max: 35, step: 1, value: D.t, unit: '%', color: 'var(--d3)' }),
    M: slider({ label: 'Номинальная денежная масса', sym: 'M', min: 16000, max: 24000, step: 100, value: D.M, unit: 'ден. ед.', color: 'var(--d1)' }),
    V: slider({ label: 'Скорость обращения денег', sym: 'V', min: 1.0, max: 1.3, step: 0.01, value: D.V, dec: 2, color: 'var(--d1)' }),
    P: slider({ label: 'Уровень цен', sym: 'P', min: 0.7, max: 1.6, step: 0.05, value: D.P, dec: 2, color: 'var(--d1)' }),
    Ca: slider({ label: 'Автономное потребление', sym: 'C_a', min: 3000, max: 9000, step: 100, value: D.Ca, unit: 'ден. ед.', color: 'var(--d2)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.6, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d2)' }),
    Ia: slider({ label: 'Автономные инвестиции', sym: 'I_a', min: 14000, max: 24000, step: 100, value: D.Ia, unit: 'ден. ед.', color: 'var(--d5)' }),
    d: slider({ label: 'Чувствительность инвестиций к ставке', sym: 'd', min: 200, max: 700, step: 10, value: D.d, color: 'var(--d5)' }),
    Ta: slider({ label: 'Автономные налоги', sym: 'T_a', min: 0, max: 2000, step: 50, value: D.Ta, unit: 'ден. ед.', color: 'var(--d3)' }),
    h: slider({ label: 'Чувствительность спроса на деньги к ставке', sym: 'h', min: 100, max: 1500, step: 10, value: D.h, color: 'var(--d1)' }),
    Yf: slider({ label: 'Потенциальный выпуск', sym: 'Y^*', min: 30000, max: 50000, step: 500, value: D.Yf, unit: 'ден. ед.', color: 'var(--d6)' }),
  };
  const set = (k, v) => S[k].set(v, { fromUser: true });
  const resetAll = () => Object.values(S).forEach((s) => s.reset(true));

  /* задание: (а) G или t, (б) M, V или P; четыре комбинации крайних значений */
  const segA = seg({ label: 'Переменная (а) — фискальная', value: 'G', options: [{ v: 'G', label: 'G · госрасходы' }, { v: 't', label: 't · налоговая ставка' }] });
  const segB = seg({ label: 'Переменная (б) — денежная', value: 'M', options: [{ v: 'M', label: 'M · деньги' }, { v: 'V', label: 'V · скорость' }, { v: 'P', label: 'P · цены' }] });
  const combos = [[2, 2, 'макс', 'макс'], [2, 0, 'макс', 'мин'], [0, 2, 'мин', 'макс'], [0, 0, 'мин', 'мин']];
  const comboBtns = combos.map(([ia, ib]) => button({ label: '…', sm: true, onClick: () => applyCombo(ia, ib) }));
  const labelCombos = () => combos.forEach(([ia, ib, la, lb], i) => { comboBtns[i].lastChild.textContent = `${fa} ${la} · ${fb} ${lb}`; comboBtns[i].title = `(а) ${fa} = ${fmt(FA[fa].ext[ia], FA[fa].ext[ia] % 1 ? 2 : 0)}, (б) ${fb} = ${fmt(FB[fb].ext[ib], FB[fb].ext[ib] % 1 ? 2 : 0)}`; });
  function applyCombo(ia, ib) {
    api.clearCompare(); resetAll();
    set(fa, FA[fa].ext[ia]); set(fb, FB[fb].ext[ib]);
    readState(); onChange();
  }
  segA.on((v) => { fa = v; labelCombos(); });
  segB.on((v) => { fb = v; labelCombos(); });
  labelCombos();

  const pre = presets([
    { label: 'Фискальный стимул: G +1000', color: 'var(--d4)', hint: 'Госзакупки растут — IS вправо', apply: () => { mark(); set('G', st.G + 1000); } },
    { label: 'Налоги выше: t +5 п.п.', color: 'var(--d3)', hint: 'Налоговая ставка выросла — IS круче и левее', apply: () => { mark(); set('t', st.t + 5); } },
    { label: 'Денежная экспансия: M +1000', color: 'var(--d1)', hint: 'Центральный банк увеличивает предложение денег — LM вправо', apply: () => { mark(); set('M', st.M + 1000); } },
    { label: 'Денежное сжатие: M −1000', color: 'var(--d1)', hint: 'LM влево', apply: () => { mark(); set('M', st.M - 1000); } },
    { label: 'Цены выше: P +0,1', color: 'var(--d1)', hint: 'Реальные деньги M/P уменьшаются — LM влево', apply: () => { mark(); set('P', +(st.P + 0.1).toFixed(2)); } },
    { label: 'Смешанная политика: G +1000, M +1000', color: 'var(--d6)', hint: 'Деньги «страхуют» от вытеснения инвестиций', apply: () => { mark(); set('G', st.G + 1000); set('M', st.M + 1000); } },
    { label: 'LM почти горизонтальна: h = 1500', color: 'var(--d5)', hint: 'Сверх задания: ловушка ликвидности — ставка не растёт, вытеснения нет', apply: () => { mark(); set('h', 1500); } },
    { label: 'LM крутая: h = 150', color: 'var(--d5)', hint: 'Сверх задания: классический случай — фискальный импульс почти целиком вытесняет инвестиции', apply: () => { mark(); set('h', 150); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Что будет, если…' });

  L.controls.append(
    panel({ title: 'Задание · крайние значения', hint: 'считается от исходного состояния' }, segA.el, h('div', { style: { height: '.6rem' } }), segB.el,
      h('div.ex103__combo', ...comboBtns)),
    panel({ title: 'Экзогенные переменные', hint: 'дважды щёлкните название — сброс' }, S.G.el, S.t.el, S.M.el, S.V.el, S.P.el),
    panel({ title: 'Сценарии' }, pre),
    panel({ title: 'Остальные параметры', hint: 'коэффициенты модели', collapsible: true, open: false },
      S.Ca.el, S.mpc.el, S.Ia.el, S.d.el, S.Ta.el, S.h.el, S.Yf.el));

  /* ── показатели ──────────────────────────────────────────── */
  const R = {
    Y: stat({ label: 'Равновесный доход', sym: 'Y_0', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    r: stat({ label: 'Равновесная ставка', sym: 'r_0', unit: '%', dec: 1, color: 'var(--d1)' }),
    I: stat({ label: 'Инвестиции', sym: 'I', color: 'var(--d5)' }),
    u: stat({ label: 'Безработица', sym: 'u', unit: '%', dec: 2, color: 'var(--d3)' }),
    B: stat({ label: 'Бюджет', sym: 'B = T − G', unit: 'ден. ед.', color: 'var(--d4)' }),
  };
  L.stats.append(R.Y.el, R.r.el, R.I.el, R.u.el, R.B.el);

  /* ── график IS–LM ────────────────────────────────────────── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: 0, max: YM, label: 'Y, ден. ед.', ticks: 5, fmt: tk }, y: { min: 0, max: RM, label: 'r, %', ticks: [0, 10, 20, 30, 40, 50, 60, 70] },
    aspect: 1.5, maxH: 480, margin: { l: 50, r: 34, t: 28, b: 44 }, title: 'Модель IS–LM: равновесие на товарном и денежном рынках',
  });
  const E = () => equil(st), E0 = () => equil(base);
  const rc = (r) => clamp(r, 0, RM);
  chart.vline('yf', { x: () => st.Yf, color: 'var(--d6)', dash: '6 6', width: 1.6, label: 'Y^*', labelDx: 8 });
  chart.line('isRef', { pts: isPts(base), color: 'var(--d2)', width: 2, dash: '6 6', glow: false, ghost: false, label: 'IS_0', labelAt: 1, labelDx: 8, labelDy: 4 });
  chart.line('lmRef', { pts: lmPts(base), color: 'var(--d1)', width: 2, dash: '6 6', glow: false, ghost: false, label: 'LM_0', labelAt: 0, labelAnchor: 'end', labelDx: -6, labelDy: -8 });
  chart.line('is', { pts: isPts(st), color: 'var(--d2)', width: 3.6, label: 'IS', labelAt: 0, labelDx: 8, labelDy: -10 });
  chart.line('lm', { pts: lmPts(st), color: 'var(--d1)', width: 3.6, label: 'LM', labelAt: 1, labelDx: 8, labelDy: 4 });
  chart.arrow('mv', { from: () => [E0().Y, rc(E0().r)], to: () => [E().Y, rc(E().r)], color: 'var(--ink-2)', width: 2, head: 9 });
  chart.point('e0', { x: () => E0().Y, y: () => rc(E0().r), color: 'var(--ink-3)', r: 5, label: 'E_0', labelDx: 10, labelDy: 16 });
  chart.point('e1', { x: () => E().Y, y: () => rc(E().r), color: 'var(--ink)', r: 7.5, pulse: true, guides: { x: 'Y_0', y: 'r_0' } });

  /* ── структура расходов Y = C + I + G ────────────────────── */
  const bar = (cls) => {
    const seg3 = ['C', 'I', 'G'].map((k) => h('div.ex103__seg', { class: 'is-' + k }, h('span')));
    const mark = h('i.ex103__ystar', { title: 'Потенциальный выпуск Y*' });
    const track = h('div.ex103__track', ...seg3, mark);
    return { el: h('div.ex103__row', h('b', cls), track, h('em')), seg3, mark, em: null, tail: null, track };
  };
  const bars = [bar('Период 0'), bar('Период 1')];
  const barBox = h('div.ex103__bars', ...bars.map((b) => b.el),
    h('ul.ex103__key', h('li.is-C', 'C · потребление'), h('li.is-I', 'I · инвестиции'), h('li.is-G', 'G · государство'), h('li.is-Y', 'Y* · потенциальный')));
  function drawBars() {
    const e1 = E(), e0 = E0();
    const full = Math.max(e1.Y, e0.Y, st.Yf, base.Yf) * 1.06;
    [[bars[0], e0, base], [bars[1], e1, st]].forEach(([b, e, s]) => {
      const vals = [e.C, Math.max(0, e.I), s.G];
      b.seg3.forEach((sg, i) => { const w = Math.max(0, vals[i]) / full * 100; sg.style.width = w + '%'; sg.firstChild.textContent = w > 11 ? f0(vals[i]) : ''; sg.title = ['Потребление C', 'Инвестиции I', 'Государственные расходы G'][i] + ': ' + f0(vals[i]); });
      b.mark.style.left = (s.Yf / full * 100) + '%';
      b.el.lastChild.textContent = 'Y = ' + f0(e.Y);
    });
  }

  L.stage.append(
    figure('IS–LM · равновесие рынков', host, { note: 'Пересечение IS и LM — единственная пара (Y, r), при которой равновесны и рынок благ, и рынок денег. Пунктир и серая точка — исходное положение, стрелка — сдвиг равновесия.' }),
    figure('Структура дохода · Y = C + I + G', barBox, { class: 'ex103__fig', note: 'Закрытая экономика (Nx = 0): доход распадается на потребление, инвестиции и госрасходы. Вертикальная метка — потенциальный выпуск Y*.' }));
  const lgd = legend([
    { color: 'var(--d2)', label: 'IS — товарный рынок' }, { color: 'var(--d1)', label: 'LM — денежный рынок' },
    { color: 'var(--d6)', label: 'Y^* — потенциальный выпуск', dash: true }, { color: 'var(--ink-3)', label: 'до изменения (IS_0, LM_0, E_0)', dash: true }]);

  /* ── таблица периодов (как в оригинале) и пояснения ─────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Период 0', num: true }, { key: 'b', label: 'Период 1', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как найдено равновесие' }); expl.classList.add('islm__expl');
  const why = callout({ tone: 'ok', title: 'Что произошло' }); why.classList.add('islm__expl');
  L.notes.append(lgd, tbl.el, expl, why);

  const rows = (a, b, sa, sb) => {
    const R2 = (label, va, vb, dec = 0, key) => ({ k: label, a: dec < 0 ? va : fmt(va, dec), b: dec < 0 ? vb : fmt(vb, dec), d: dec < 0 ? '' : sgn(vb - va, dec) });
    return [
      R2('Денежная масса M, ден. ед.', sa.M, sb.M), R2('Потребление C', a.C, b.C, 0), R2('Инвестиции I', a.I, b.I, 0), R2('Госрасходы G', sa.G, sb.G),
      { k: 'Чистый экспорт Nx', a: '—', b: '—', d: '' }, R2('Доход Y', a.Y, b.Y, 0), R2('Потенциальный выпуск Y^*', sa.Yf, sb.Yf),
      R2('Безработица u, %', a.u, b.u, 2), R2('Уровень цен P', sa.P, sb.P, 2), R2('Ставка r, %', a.r, b.r, 1),
      R2('Темп инфляции, %', a.infl, b.infl, 1), R2('Налоги T', a.T, b.T, 0), R2('Бюджет B = T − G', a.B, b.B, 0),
    ];
  };

  const dirTxt = (v, a, b) => (v > 1e-9 ? a : v < -1e-9 ? b : '');
  function describe() {
    const ch = KEYS.filter((k) => Math.abs(st[k] - base[k]) > 1e-9);
    if (!ch.length) return nb('<p>Экономика в исходном равновесии: <b>Y₀ = Y* = 40 000</b>, <b>r₀ = 35 %</b>, безработица равна естественной (7 %).</p><p>Выберите сценарий или одну из четырёх комбинаций крайних значений — таблица покажет, как изменились показатели, а график — как сдвинулись IS и LM.</p>');
    const e0 = E0(), e1 = E(), r0 = e0.r;
    const dIS = isY(st, r0) - isY(base, r0), dLM = lmY(st, r0) - lmY(base, r0);
    const rotIS = Math.abs(mT(st) / st.d - mT(base) / base.d) > 1e-9, rotLM = Math.abs(kk(st) / st.h - kk(base) / base.h) > 1e-9;
    const part = (name, d, rot) => Math.abs(d) < 0.5 && !rot ? `${name} не изменилась` : `${name} ${rot ? 'повернулась и ' : ''}${Math.abs(d) < 0.5 ? 'осталась на месте' : (d > 0 ? 'сдвинулась вправо' : 'сдвинулась влево')}${Math.abs(d) >= 0.5 ? ' на ' + f0(Math.abs(d)) + ' (при прежней ставке)' : ''}`;
    const dY = e1.Y - e0.Y, dr = e1.r - e0.r, dI = e1.I - e0.I;
    const out = [`<p><strong>${part('IS', dIS, rotIS)}; ${part('LM', dLM, rotLM)}.</strong></p>`];
    out.push(`<p>Новое равновесие: Y ${dirTxt(dY, '▲', '▼')} <b>${f0(e1.Y)}</b> (${sgn(dY)}), r ${dirTxt(dr, '▲', '▼')} <b>${f1(e1.r)} %</b> (${sgn(dr, 1)} п.п.), безработица <b>${fmt(e1.u, 2)} %</b> (${sgn(e1.u - e0.u, 2)}).</p>`);
    if (dr > 0.05 && dIS > 0.5 && Math.abs(dLM) < 0.5) {
      const simple = (aut(st) - aut(base)) / mT(st);
      out.push(`<p><b>Эффект вытеснения.</b> Рост спроса поднял ставку на ${f1(dr)} п.п., инвестиции упали на ${f0(-dI)} — доход вырос лишь на ${f0(dY)} вместо ${f0(simple)} по простому мультипликатору${simple > 1 ? ' (' + f0((1 - dY / simple) * 100) + ' % «съедено» ростом ставки)' : ''}.</p>`);
    } else if (dr < -0.05 && dLM > 0.5 && Math.abs(dIS) < 0.5) {
      out.push(`<p><b>Денежная экспансия работает через ставку:</b> r снизилась на ${f1(-dr)} п.п., инвестиции выросли на ${f0(dI)} и потянули за собой доход (${sgn(dY)}).</p>`);
    } else if (Math.abs(dr) > 0.05 && Math.abs(dY) > 0.5 && dY * dr < 0) {
      out.push(`<p>Ставка и доход движутся в разные стороны: сдвиг LM сильнее сдвига IS — деньги дешевеют (дорожают), инвестиции ${dI > 0 ? 'растут' : 'падают'} на ${f0(Math.abs(dI))}.</p>`);
    }
    if (Math.abs(st.P - base.P) > 1e-9) out.push(`<p>Уровень цен изменился на ${sgn((st.P / base.P - 1) * 100, 1)} % — это и есть инфляция в таблице; реальные деньги M/P стали ${f0(real(st))} вместо ${f0(real(base))}.</p>`);
    return nb(out.join(''));
  }

  function render() {
    const e = E(), e0 = E0();
    R.Y.set(e.Y); R.r.set(e.r); R.I.set(e.I); R.u.set(e.u); R.B.set(e.B);
    R.Y.base(e0.Y); R.r.base(e0.r); R.I.base(e0.I); R.u.base(e0.u); R.B.base(e0.B);
    tbl.set(rows(e0, e, base, st));
    const mt = mT(st), A = aut(st), k = kk(st), mp = e.mp;
    expl.querySelector('.co__b').innerHTML = nb(`<p class="islm__eq">${symHTML('Y_0')} = (h·A + d·M/P) / (k·d + h·(1 − mpc(1−t))) = (${f0(st.h)}·${f0(A)} + ${f0(st.d)}·${f0(real(st))}) / (${f2(k)}·${f0(st.d)} + ${f0(st.h)}·${f2(mt)}) = <b>${f0(e.Y)}</b></p>
      <p class="islm__eq">${symHTML('r_0')} = (k·Y₀ − M/P) / h = (${f2(k)}·${f0(e.Y)} − ${f0(real(st))}) / ${f0(st.h)} = <b>${f1(e.r)} %</b></p>
      <p>Здесь A = ${symHTML('C_a')} + ${symHTML('I_a')} + G − mpc·${symHTML('T_a')} = ${f0(A)}, k = 1/V = ${f2(k)}. Проверка: по IS при r₀ доход ${f0(isY(st, e.r))}, по LM — ${f0(lmY(st, e.r))}; кривые пересекаются в одной точке.</p>
      <p>Затем: T = ${symHTML('T_a')} + t·Y = ${f0(e.T)}; C = ${symHTML('C_a')} + mpc·(Y − T) = ${f0(e.C)}; I = ${symHTML('I_a')} − d·r = ${f0(e.I)}; u = 7 − (Y − Y*)·100 / (3·Y*) = ${fmt(e.u, 2)} %.</p>`);
    why.querySelector('.co__b').innerHTML = describe();
    drawBars();
    void mp;
  }

  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); }
  function fitDomain() {
    const need = Math.max(isY0(st), isY0(base), lmY(st, 40), lmY(base, 40)) * 1.04;
    const v = niceCeil(need, YSTEPS); const ch = v !== YM; YM = v; return ch;
  }
  function refresh() {
    const same = KEYS.every((k) => Math.abs(st[k] - base[k]) < 1e-9);
    chart.get('is').op.pts = isPts(st); chart.get('lm').op.pts = lmPts(st);
    chart.get('isRef').op.pts = isPts(base); chart.get('lmRef').op.pts = lmPts(base);
    chart.setDomain({ x: [0, YM], y: [0, RM] }, true);
    ['isRef', 'lmRef', 'mv', 'e0'].forEach((id) => { const el = chart.get(id); (el.nodes || []).forEach((n) => n && (n.style.display = same ? 'none' : '')); });
    chart.update();
  }
  function onChange() { readState(); fitDomain(); refresh(); render(); }
  Object.values(S).forEach((s) => s.on(() => onChange()));

  /* ── API рамки ───────────────────────────────────────────── */
  function mark() { base = { ...st }; onChange(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { base = { ...D }; onChange(); },
    reset() { base = { ...D }; resetAll(); onChange(); },
    destroy() { chart.destroy(); },
  };
  readState(); fitDomain(); refresh(); render();
  chart.update(null, true);
  typo(L.controls); typo(L.stage); typo(L.stats);
  return api;
}

const css = `
.sim--ex10-3 .ex103__combo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .45rem; margin-top: .7rem; }
.sim--ex10-3 .ex103__combo .btn { justify-content: center; white-space: nowrap; font-family: var(--f-mono); font-size: .72rem; padding-inline: .4rem; }
.sim--ex10-3 .ex103__bars { display: grid; gap: .9rem; padding: .3rem .4rem .5rem; }
.sim--ex10-3 .ex103__row { display: grid; grid-template-columns: 5.2rem minmax(0, 1fr); grid-template-areas: "l t" ". e"; gap: .3rem .8rem; align-items: center; }
.sim--ex10-3 .ex103__row b { grid-area: l; font: 600 .7rem/1.2 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.sim--ex10-3 .ex103__row em { grid-area: e; font: 500 .78rem/1 var(--f-mono); font-style: normal; color: var(--ink-2); }
.sim--ex10-3 .ex103__track { grid-area: t; position: relative; display: flex; height: 2.1rem; border-radius: 7px; background: color-mix(in oklab, var(--ink) 6%, transparent); overflow: visible; }
.sim--ex10-3 .ex103__seg { height: 100%; min-width: 0; display: grid; place-items: center; overflow: hidden; transition: width .5s var(--ease); background: var(--c); }
.sim--ex10-3 .ex103__seg:first-child { border-radius: 7px 0 0 7px; }
.sim--ex10-3 .ex103__seg span { font: 600 .66rem/1 var(--f-mono); color: var(--ink-inv); white-space: nowrap; }
.sim--ex10-3 .is-C { --c: var(--d2); } .sim--ex10-3 .is-I { --c: var(--d5); } .sim--ex10-3 .is-G { --c: var(--d4); } .sim--ex10-3 .is-Y { --c: var(--d6); }
.sim--ex10-3 .ex103__ystar { position: absolute; top: -5px; bottom: -5px; width: 0; border-left: 2px dashed var(--d6); transition: left .5s var(--ease); pointer-events: none; }
.sim--ex10-3 .ex103__key { display: flex; flex-wrap: wrap; gap: .3rem 1.1rem; list-style: none; margin: 0; padding: 0 0 0 6rem; font: 500 .72rem/1.2 var(--f-mono); color: var(--ink-3); }
.sim--ex10-3 .ex103__key li::before { content: ""; display: inline-block; width: .7rem; height: .7rem; border-radius: 3px; background: var(--c); margin-right: .4rem; vertical-align: -.08rem; }
.sim--ex10-3 .ex103__key li.is-Y::before { background: none; border-left: 2px dashed var(--c); border-radius: 0; width: 0; height: .8rem; margin-right: .5rem; }
@media (max-width: 520px) { .sim--ex10-3 .ex103__row { grid-template-columns: 1fr; grid-template-areas: "l" "t" "e"; } .sim--ex10-3 .ex103__key { padding-left: 0; } }
`;
injectCss('css-ex10-3', css);
