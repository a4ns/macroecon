/* ─────────────────────────────────────────────────────────────
   Упражнение 10.1 — построение кривой IS (товарный рынок)

   Y = C + I + G,  C = Ca + mpc·(Y − T),  I = Ia − d·r,  T = Ta + t·Y
   ⇒ IS:  Y = (Ca + Ia + G − mpc·Ta − d·r) / (1 − mpc·(1 − t))
   Исходно: Ca = 5500, mpc = 0,75, Ia = 18000, d = 400, Ta = 500, t = 20 %, G = 6875.
   Два варианта построения, как в оригинале: «I + G ↔ S + T» и «кейнсианский крест Eₚ».
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, seg, stat, presets, figure, legend, callout, dtable, button, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';
import { typo, D as D0, mT, aut, isY, isY0, isSlope, mult, f0, f2, sgn, niceCeil, injectCss, SHARED_CSS } from './_islm.js';

const KEYS = ['Ca', 'mpc', 'Ia', 'd', 'Ta', 't', 'G'];
const D = { ...Object.fromEntries(KEYS.map((k) => [k, D0[k]])), r: 21 };
const RM = 60;                       // верх шкалы ставки, %
const RLINE = 55;                    // до какой ставки рисуем кривые
const SWEEP = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const YSTEPS = [100000, 125000, 150000, 200000, 250000, 300000, 400000, 600000, 1000000];
const tk = (v) => { v = Math.abs(v); return v >= 1e4 ? fmt(v / 1e3, v % 1e3 ? 1 : 0) + 'k' : fmt(v, 0); };

/* производные величины в точке на IS при ставке r */
const igOf = (s, r) => s.Ia + s.G - s.d * r;                        // I + G
const stOf = (s, Y) => mT(s) * Y + s.mpc * s.Ta - s.Ca;               // S + T
const epOf = (s, r, Y) => aut(s) - s.d * r + s.mpc * (1 - s.t / 100) * Y;   // Eₚ

export function mount(root, env) {
  root.classList.add('sim--ex10-1');
  injectCss('css-islm-shared', SHARED_CSS);
  const L = simLayout(root);
  const st = { ...D };
  let base = { ...D };
  let variant = 'a';
  let dm = { Y: 100000, IG: 30000, I: 20000 };
  const timers = new Set();

  /* ── параметры ───────────────────────────────────────────── */
  const S = {
    Ca: slider({ label: 'Автономное потребление', sym: 'C_a', min: 3000, max: 9000, step: 100, value: D.Ca, unit: 'ден. ед.', color: 'var(--d2)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.6, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d2)' }),
    Ia: slider({ label: 'Автономные инвестиции', sym: 'I_a', min: 14000, max: 24000, step: 100, value: D.Ia, unit: 'ден. ед.', color: 'var(--d5)' }),
    d: slider({ label: 'Чувствительность инвестиций к ставке', sym: 'd', min: 200, max: 700, step: 10, value: D.d, color: 'var(--d5)' }),
    G: slider({ label: 'Государственные расходы', sym: 'G', min: 3000, max: 12000, step: 100, value: D.G, unit: 'ден. ед.', color: 'var(--d4)' }),
    Ta: slider({ label: 'Автономные налоги', sym: 'T_a', min: 0, max: 2000, step: 50, value: D.Ta, unit: 'ден. ед.', color: 'var(--d3)' }),
    t: slider({ label: 'Налоговая ставка', sym: 't', min: 0, max: 40, step: 1, value: D.t, unit: '%', color: 'var(--d3)' }),
    r: slider({ label: 'Выбранная ставка процента', sym: 'r', min: 0, max: 50, step: 0.5, value: D.r, dec: 1, unit: '%', color: 'var(--ink)' }),
  };
  const set = (k, v) => S[k].set(v, { fromUser: true });
  const mode = seg({ label: 'Вариант построения', value: 'a', options: [
    { v: 'a', label: 'I + G ↔ S + T', hint: 'Первый вариант: через инвестиции с госрасходами и сбережения с налогами' },
    { v: 'b', label: 'Крест Eₚ', hint: 'Второй вариант: через кейнсианский крест' }] });

  const playBtn = button({ label: 'Построить по точкам', icon: 'play', sm: true, onClick: () => (sweeping ? stopSweep() : startSweep()) });
  const pinBtn = button({ label: 'Отметить точку', sm: true, onClick: () => addPin(st.r) });
  const clrBtn = button({ label: 'Стереть точки', sm: true, onClick: () => clearPins() });

  const pre = presets([
    { label: 'Потребление: Ca +500', color: 'var(--d2)', hint: 'Домохозяйства тратят больше при любом доходе', apply: () => { mark(); set('Ca', st.Ca + 500); } },
    { label: 'Инвестиции: Ia +500', color: 'var(--d5)', hint: 'Фирмы инвестируют больше при любой ставке', apply: () => { mark(); set('Ia', st.Ia + 500); } },
    { label: 'Госрасходы: G +500', color: 'var(--d4)', hint: 'Прямой рост спроса со стороны государства', apply: () => { mark(); set('G', st.G + 500); } },
    { label: 'Налоги: Ta +500', color: 'var(--d3)', hint: 'Автономные налоги сокращают потребление лишь частично', apply: () => { mark(); set('Ta', st.Ta + 500); } },
    { label: 'Налоговая ставка: t +5 п.п.', color: 'var(--d3)', hint: 'Налоги растут вместе с доходом — IS становится круче', apply: () => { mark(); set('t', st.t + 5); } },
    { label: 'Инвестиции чувствительнее: d +100', color: 'var(--d5)', hint: 'Каждый процентный пункт сильнее давит на инвестиции — IS положе', apply: () => { mark(); set('d', st.d + 100); } },
    { label: 'Сберегаем больше: mpc −0,05', color: 'var(--d2)', hint: 'Мультипликатор уменьшается', apply: () => { mark(); set('mpc', +(st.mpc - 0.05).toFixed(2)); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Что будет, если…' });

  L.controls.append(
    panel({ title: 'Как строить', hint: 'два варианта из задания' }, mode.el,
      h('div.islm__row', { style: { marginTop: '.7rem' } }, playBtn, pinBtn, clrBtn)),
    panel({ title: 'Ставка процента', hint: 'тяните точку на графике IS' }, S.r.el),
    panel({ title: 'Параметры модели', hint: 'дважды щёлкните название — сброс' },
      S.Ca.el, S.mpc.el, S.Ia.el, S.d.el, S.G.el, S.Ta.el, S.t.el),
    panel({ title: 'Сценарии' }, pre));

  /* ── показатели ──────────────────────────────────────────── */
  const R = {
    Y: stat({ label: 'Доход на IS при данной ставке', sym: 'Y_1', unit: 'ден. ед.', size: 'l', color: 'var(--d2)' }),
    IG: stat({ label: 'Расходы I + G при этой ставке', unit: 'ден. ед.', color: 'var(--d5)' }),
    A: stat({ label: 'Автономные расходы', sym: 'A', unit: 'ден. ед.', color: 'var(--d4)' }),
    M: stat({ label: 'Мультипликатор', unit: '= 1/(1−mpc(1−t))', dec: 2, color: 'var(--d1)' }),
    SL: stat({ label: 'Наклон IS', sym: 'ΔY/Δr', unit: 'на 1 п.п.', color: 'var(--d3)' }),
  };
  L.stats.append(R.Y.el, R.IG.el, R.A.el, R.M.el, R.SL.el);

  /* ── главный график: IS ──────────────────────────────────── */
  const rEnd = (v, sl) => clamp(v / sl, 0, RLINE);        // до какой ставки кривая остаётся в области положительных значений
  const isPts = (s) => { const e = rEnd(isY0(s), isSlope(s)); return [[isY(s, 0), 0], [isY(s, e), e]]; };
  const mainHost = h('div');
  const chart = createChart(mainHost, {
    x: { min: 0, max: dm.Y, label: 'Y', ticks: 5, fmt: tk }, y: { min: 0, max: RM, label: 'r, %', ticks: [0, 10, 20, 30, 40, 50, 60] },
    aspect: 1.55, maxH: 440, margin: { l: 52, r: 34, t: 28, b: 42 }, title: 'Кривая IS: доход Y и ставка процента r',
  });
  chart.line('is', { pts: isPts(st), color: 'var(--d2)', width: 3.6, label: 'IS', labelAt: 1, labelDx: 10, labelDy: 4 });
  chart.point('pt', { x: () => isY(st, st.r), y: () => st.r, color: 'var(--ink)', r: 7.5, pulse: true, guides: { x: 'Y_1', y: 'r' },
    draggable: ({ y }) => S.r.set(clamp(Math.round(y * 2) / 2, 0, 50), { fromUser: true }) });

  const pins = new Map();
  function addPin(r) {
    const key = r.toFixed(1); if (pins.has(key)) return;
    const id = 'pin' + key; pins.set(key, id);
    chart.point(id, { x: () => isY(st, r), y: r, color: 'var(--d2)', r: 4.5 });
  }
  function clearPins() { pins.forEach((id) => chart.remove(id)); pins.clear(); }

  /* ── «четыре квадранта» ──────────────────────────────────── */
  const MG = { l: 46, r: 16, t: 26, b: 32 };
  const qopts = (x, y, title) => ({ x: { ticks: 3, fmt: tk, ...x }, y: { ticks: 3, fmt: tk, ...y }, aspect: 1.15, minH: 210, maxH: 300, margin: MG, title });
  const cell = (cap, host) => h('div.ex101__cell', h('div.islm__cap', { html: cap }), host);
  const dash = { color: 'var(--ink-2)', width: 1.7, dash: '5 5', glow: false, ghost: false };
  const dot = (c, id, x, y, color) => c.point(id, { x, y, color, r: 5 });

  function makeQuad(kind) {
    const hosts = { TL: h('div'), TR: h('div'), BL: h('div'), BR: h('div') };
    const charts = [];
    const mk = (pos, o) => { const c = createChart(hosts[pos], o); charts.push(c); return c; };
    const r = () => st.r, Y1 = () => isY(st, st.r);
    const refresh = [];
    const dom = (c, x, y) => c.setDomain({ x, y }, true);
    let infoEl = null;

    /* TR — IS (общий для обоих вариантов) */
    const tr = mk('TR', qopts({ min: 0, max: dm.Y, label: 'Y' }, { min: 0, max: RM, label: 'r, %' }, 'Кривая IS'));
    tr.line('is', { pts: isPts(st), color: 'var(--d2)', width: 3.2, label: 'IS', labelAt: 1, labelDx: 8, labelDy: 4 });
    tr.point('p', { x: Y1, y: r, color: 'var(--ink)', r: 6.5, pulse: true, guides: { x: 'Y_1', y: 'r' } });
    refresh.push(() => { tr.get('is').op.pts = isPts(st); dom(tr, [0, dm.Y], [0, RM]); });

    if (kind === 'a') {
      const tl = mk('TL', qopts({ min: -dm.IG, max: 0, arrow: false, fmt: tk }, { min: 0, max: RM, label: 'r, %' }, 'I + G в зависимости от ставки'));
      const bl = mk('BL', qopts({ min: -dm.IG, max: 0, arrow: false }, { min: -dm.IG, max: 0, arrow: false }, 'Линия 45°: S + T = I + G'));
      const br = mk('BR', qopts({ min: 0, max: dm.Y, label: 'Y' }, { min: -dm.IG, max: 0, arrow: false }, 'S + T в зависимости от дохода'));
      const igPts = () => { const e = rEnd(st.Ia + st.G, st.d); return [[-igOf(st, 0), 0], [-igOf(st, e), e]]; };
      const stPts = () => [[0, -stOf(st, 0)], [dm.Y, -stOf(st, dm.Y)]];
      const IG1 = () => igOf(st, st.r);
      tl.line('ig', { pts: igPts(), color: 'var(--d5)', width: 3.2, label: 'I+G', labelAt: 1, labelDx: 8, labelDy: 14 });
      tl.line('pj', { pts: [[0, 0], [0, 0], [0, 0]], ...dash });
      dot(tl, 'd', () => -IG1(), r, 'var(--d5)');
      bl.line('d45', { pts: [[-dm.IG, -dm.IG], [0, 0]], color: 'var(--ink-3)', width: 2.2, label: '45°', labelAt: .62, labelDx: 6, labelDy: 20, glow: false, ghost: false });
      bl.line('pj', { pts: [[0, 0], [0, 0], [0, 0]], ...dash });
      dot(bl, 'd', () => -IG1(), () => -IG1(), 'var(--ink-2)');
      br.line('st', { pts: stPts(), color: 'var(--d4)', width: 3.2 });
      br.line('pj', { pts: [[0, 0], [0, 0], [0, 0]], ...dash });
      dot(br, 'd', Y1, () => -IG1(), 'var(--d4)');
      br.text('yl', { x: 0, y: () => -dm.IG, text: 'S+T', dx: 8, dy: -8, color: 'var(--ink-3)', size: 12 });
      refresh.push(() => {
        tl.get('ig').op.pts = igPts(); tl.get('pj').op.pts = [[0, st.r], [-IG1(), st.r], [-IG1(), 0]]; dom(tl, [-dm.IG, 0], [0, RM]);
        bl.get('d45').op.pts = [[-dm.IG, -dm.IG], [0, 0]]; bl.get('pj').op.pts = [[-IG1(), 0], [-IG1(), -IG1()], [0, -IG1()]]; dom(bl, [-dm.IG, 0], [-dm.IG, 0]);
        br.get('st').op.pts = stPts(); br.get('pj').op.pts = [[0, -IG1()], [Y1(), -IG1()], [Y1(), 0]]; dom(br, [0, dm.Y], [-dm.IG, 0]);
      });
      const caps = [
        cell('I + G = I<sub>a</sub> + G − d·r', hosts.TL), cell('Кривая IS — все пары (Y, r), где S + T = I + G', hosts.TR),
        cell('Перенос по линии 45°: S + T = I + G', hosts.BL), cell('S + T = m<sub>t</sub>·Y + mpc·T<sub>a</sub> − C<sub>a</sub>', hosts.BR)];
      return { charts, refresh, el: h('div.ex101__quad', ...caps), info: null };
    }

    /* вариант Б: инвестиции → кейнсианский крест → IS */
    const tl = mk('TL', qopts({ min: 0, max: dm.I, label: 'I' }, { min: 0, max: RM, label: 'r, %' }, 'Инвестиционная функция'));
    const br = mk('BR', qopts({ min: 0, max: dm.Y, label: 'Y' }, { min: 0, max: dm.Y, label: 'E' }, 'Кейнсианский крест'));
    const iPts = () => { const e = rEnd(st.Ia, st.d); return [[st.Ia, 0], [st.Ia - st.d * e, e]]; };
    const I1 = () => st.Ia - st.d * st.r;
    const epPts = (rr) => [[0, epOf(st, rr, 0)], [dm.Y, epOf(st, rr, dm.Y)]];
    tl.line('i', { pts: iPts(), color: 'var(--d5)', width: 3.2, label: 'I', labelAt: 0, labelDx: 8, labelDy: -8 });
    tl.line('pj', { pts: [[0, 0], [0, 0]], ...dash });
    dot(tl, 'd', I1, r, 'var(--d5)');
    br.line('d45', { pts: [[0, 0], [dm.Y, dm.Y]], color: 'var(--ink-3)', width: 2, dash: '2 7', label: 'E = Y', labelAt: .72, labelDx: -52, labelDy: 20, glow: false, ghost: false });
    br.line('ep0', { pts: epPts(0), color: 'var(--ink-3)', width: 1.6, dash: '5 5', glow: false, ghost: false });
    br.line('ep', { pts: epPts(st.r), color: 'var(--d2)', width: 3.2, label: 'E_p', labelAt: .98, labelDx: -8, labelDy: -10 });
    br.point('p', { x: Y1, y: Y1, color: 'var(--ink)', r: 6, pulse: true, guides: { x: 'Y_1', y: 'E_1' } });
    infoEl = h('div.ex101__info');
    refresh.push(() => {
      tl.get('i').op.pts = iPts(); tl.get('pj').op.pts = [[0, st.r], [I1(), st.r]]; dom(tl, [0, dm.I], [0, RM]);
      br.get('d45').op.pts = [[0, 0], [dm.Y, dm.Y]]; br.get('ep0').op.pts = epPts(0); br.get('ep').op.pts = epPts(st.r); dom(br, [0, dm.Y], [0, dm.Y]);
      const a = aut(st) - st.d * st.r, c = st.mpc * (1 - st.t / 100);
      infoEl.innerHTML = `<p>При ставке <b>${fmt(st.r, 1)} %</b> инвестиции равны ${symHTML('I')} = ${f0(st.Ia)} − ${f0(st.d)}·${fmt(st.r, 1)} = <b>${f0(I1())}</b>.</p>
        <p>Они сдвигают линию ${symHTML('E_p')} вверх или вниз: <span class="islm__eq">${symHTML('E_p')} = ${f0(a)} + ${f2(c)}·Y</span>.</p>
        <p>Пунктир — ${symHTML('E_p')} при r = 0. Чем выше ставка, тем ниже линия и левее её пересечение с E = Y, то есть тем меньше ${symHTML('Y_1')} = <b>${f0(Y1())}</b>.</p>`;
    });
    const el = h('div.ex101__quad',
      cell('I = I<sub>a</sub> − d·r', hosts.TL), cell('Кривая IS — все пары (Y, r), где E<sub>p</sub> = Y', hosts.TR),
      h('div.ex101__cell', h('div.islm__cap', 'Как ставка сдвигает Eₚ'), infoEl), cell('E<sub>p</sub> = C + I + G при данной ставке', hosts.BR));
    return { charts, refresh, el, info: infoEl };
  }

  const quads = { a: makeQuad('a'), b: makeQuad('b') };
  const quadBox = h('div.ex101__quads', quads.a.el, quads.b.el);
  const setVariant = (v) => { variant = v; quads.a.el.hidden = v !== 'a'; quads.b.el.hidden = v !== 'b'; refreshQuad(); };
  const allCharts = [chart, ...quads.a.charts, ...quads.b.charts];

  const capNote = h('span.islm__kbd');
  L.stage.append(
    figure('Кривая IS · доход и ставка процента', mainHost, { note: 'Тяните точку вдоль IS или двигайте ползунок «Ставка процента». Пунктир — положение кривой до сохранённого сравнения.' }),
    figure('Как строится IS · четыре квадранта', quadBox, { right: capNote, class: 'ex101__fig', note: 'Серый пунктир — путь от выбранной ставки: расходы → линия 45° → сбережения и налоги → доход → точка на IS.' }));
  L.stage.append(legend([
    { color: 'var(--d2)', label: 'IS — равновесие на рынке благ' }, { color: 'var(--d5)', label: 'I + G (или I)' }, { color: 'var(--d4)', label: 'S + T' },
    { color: 'var(--ink-2)', label: 'путь от ставки к доходу', dash: true }]));

  /* ── таблица и пояснение ─────────────────────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получена точка IS' });
  expl.classList.add('islm__expl');
  const why = callout({ tone: 'ok', title: 'Что произошло с кривой' });
  why.classList.add('islm__expl');
  L.notes.append(tbl.el, expl, why);

  /* ── расчёт ──────────────────────────────────────────────── */
  const point = (s, r) => {
    const Y = isY(s, r), T = s.Ta + (s.t / 100) * Y;
    return { Y, Y0: isY0(s), sl: -isSlope(s), m: mult(s), I: s.Ia - s.d * r, IG: igOf(s, r), C: s.Ca + s.mpc * (Y - T), T };
  };
  const rows = (b, c) => [
    ['Доход Y₁ на IS при данной r', 'Y', 0], ['Доход Y при r = 0', 'Y0', 0], ['Наклон IS, ΔY/Δr', 'sl', 0], ['Мультипликатор', 'm', 2],
    ['Инвестиции I = Ia − d·r', 'I', 0], ['Потребление C', 'C', 0], ['Налоги T', 'T', 0],
  ].map(([k, key, dec]) => ({ k, a: fmt(b[key], dec), b: fmt(c[key], dec), d: sgn(c[key] - b[key], dec) }));

  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); }
  function fitDomain() {
    const Y = niceCeil(Math.max(isY(st, 0), isY(base, 0)) * 1.06, YSTEPS);
    const IG = Math.max(30000, Math.ceil((Math.max(st.Ia + st.G, base.Ia + base.G) * 1.15) / 5000) * 5000);
    const I = Math.max(20000, Math.ceil((Math.max(st.Ia, base.Ia) * 1.15) / 5000) * 5000);
    const ch = Y !== dm.Y || IG !== dm.IG || I !== dm.I; dm = { Y, IG, I };
    return ch;
  }
  function refreshQuad() { quads[variant].refresh.forEach((f) => f()); quads[variant].charts.forEach((c) => c.update()); }
  function refreshMain() {
    chart.get('is').op.pts = isPts(st);
    chart.setDomain({ x: [0, dm.Y], y: [0, RM] }, true);
  }

  const SYM = { Ca: 'C_a', mpc: 'mpc', Ia: 'I_a', d: 'd', Ta: 'T_a', t: 't', G: 'G' };
  const TONE = { Ca: 'var(--d2)', mpc: 'var(--d2)', Ia: 'var(--d5)', d: 'var(--d5)', G: 'var(--d4)', Ta: 'var(--d3)', t: 'var(--d3)' };
  function describe() {
    const ch = KEYS.filter((k) => Math.abs(st[k] - base[k]) > 1e-9);
    if (!ch.length) return nb('<p>Кривая IS стоит в исходном положении. Измените любой параметр или выберите сценарий — пунктир покажет, откуда она сдвинулась.</p><p>Параметры <b>Ca, Ia, G</b> сдвигают IS параллельно, <b>Ta</b> сдвигает её слабее (часть налога уменьшает сбережения), а <b>t, mpc, d</b> меняют наклон.</p>');
    const b = point(base, st.r), c = point(st, st.r);
    const dY = c.Y - b.Y, rot = Math.abs(mT(st) / st.d - mT(base) / base.d) > 1e-9;
    const dA = aut(st) - aut(base);
    const head = rot
      ? `<strong>IS повернулась и стала ${mT(st) / st.d < mT(base) / base.d ? 'положе' : 'круче'}</strong>: наклон ${f0(b.sl)} → ${f0(c.sl)} ден. ед. на 1 п.п.`
      : `<strong>IS сдвинулась параллельно ${dY > 0 ? 'вправо' : 'влево'}</strong> на ${f0(Math.abs(dY))} при любой ставке.`;
    const parts = [];
    if (!rot && Math.abs(dA) > 1e-9) parts.push(`Расходы изменились на ΔA = ${sgn(dA)}, мультипликатор ${f2(mult(st))} → ΔY = ${sgn(dA)}·${f2(mult(st))} = <b>${sgn(dY)}</b>.`);
    if (rot) parts.push(`При ставке ${fmt(st.r, 1)} % доход изменился на <b>${sgn(dY)}</b>; у оси Y (r = 0) IS сместилась на ${sgn(c.Y0 - b.Y0)}.`);
    const why1 = {
      Ca: 'выше автономное потребление — выше расходы при любом доходе',
      Ia: 'выше автономные инвестиции — фирмы тратят больше при любой ставке',
      G: 'государство покупает больше — спрос растёт напрямую',
      Ta: 'автономные налоги сильнее давят на расходы — потребление падает на mpc·ΔTa, поэтому сдвиг меньше, чем от такого же изменения G',
      t: 'налоги растут вместе с доходом — мультипликатор мал, IS круче',
      mpc: 'склонность к потреблению задаёт мультипликатор: чем она выше, тем сильнее отклик дохода на расходы',
      d: 'чем чувствительнее инвестиции к ставке, тем сильнее падает доход при росте r — IS положе',
    };
    parts.push(`Изменено: ${ch.map((k) => `${symHTML(SYM[k])} ${sgn(st[k] - base[k], k === 'mpc' ? 2 : 0)}`).join(', ')}.`);
    return nb(`<p>${head}</p><p>${parts.join(' ')}</p><p>${ch.slice(0, 3).map((k) => `<span class="islm__tag" style="--c:${TONE[k]}">${symHTML(SYM[k])}</span> ${why1[k]}`).join('. ')}.</p>`);
  }

  function render() {
    const c = point(st, st.r), b = point(base, st.r);
    R.Y.set(c.Y); R.IG.set(c.IG); R.A.set(aut(st)); R.M.set(c.m); R.SL.set(c.sl);
    R.Y.base(b.Y); R.IG.base(b.IG); R.A.base(aut(base)); R.M.base(b.m); R.SL.base(b.sl);
    tbl.set(rows(b, c));
    const mt = mT(st);
    expl.querySelector('.co__b').innerHTML = nb(`<p class="islm__eq">${symHTML('Y_1')} = (${symHTML('C_a')} + ${symHTML('I_a')} + G − ${symHTML('mpc')}·${symHTML('T_a')} − d·r) / (1 − mpc·(1 − t))
      = (${f0(st.Ca)} + ${f0(st.Ia)} + ${f0(st.G)} − ${f2(st.mpc)}·${f0(st.Ta)} − ${f0(st.d)}·${fmt(st.r, 1)}) / ${f2(mt)} = <b>${f0(c.Y)}</b></p>
      <p>${variant === 'a'
        ? `При ставке ${fmt(st.r, 1)} % расходы фирм и государства <b>I + G = ${f0(c.IG)}</b>. Сбережения и налоги S + T = ${f2(mt)}·Y ${st.mpc * st.Ta - st.Ca < 0 ? '−' : '+'} ${f0(Math.abs(st.mpc * st.Ta - st.Ca))} сравниваются с ними при доходе <b>${f0(c.Y)}</b> — это и есть точка IS.`
        : `При ставке ${fmt(st.r, 1)} % инвестиции <b>I = ${f0(c.I)}</b>, линия Eₚ пересекает E = Y при доходе <b>${f0(c.Y)}</b> — это и есть точка IS.`}</p>
      <p>Каждой ставке соответствует свой доход; соединив такие точки, получаем всю кривую IS: чем выше ставка, тем меньше инвестиции и тем левее точка равновесия.</p>`);
    why.querySelector('.co__b').innerHTML = describe();
    capNote.textContent = `r = ${fmt(st.r, 1)} % → Y = ${f0(c.Y)}`;
  }

  function onChange(fromR) {
    readState();
    const dc = fitDomain();
    refreshMain(); chart.update(); refreshQuad(); render();
    if (dc) quads[variant === 'a' ? 'b' : 'a'].refresh.forEach((f) => f());
  }
  Object.values(S).forEach((s) => s.on(() => onChange()));
  mode.on((v) => setVariant(v));

  /* ── построение по точкам (проигрыватель) ───────────────── */
  let sweeping = false, tm = 0;
  const setPlayLabel = (on) => { playBtn.lastChild.textContent = on ? 'Остановить' : 'Построить по точкам'; };
  function stopSweep() { sweeping = false; clearTimeout(tm); timers.delete(tm); setPlayLabel(false); }
  function startSweep() {
    clearPins(); sweeping = true; setPlayLabel(true); let i = 0;
    const step = () => {
      if (!sweeping) return;
      if (i >= SWEEP.length) { stopSweep(); return; }
      set('r', SWEEP[i]); addPin(SWEEP[i]); i++;
      tm = setTimeout(step, 520); timers.add(tm);
    };
    step();
  }

  /* ── API рамки ───────────────────────────────────────────── */
  function mark() { base = { ...st }; allCharts.forEach((c) => c.snapshot()); onChange(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { allCharts.forEach((c) => c.clearGhosts()); base = { ...D }; onChange(); },
    reset() {
      stopSweep(); clearPins(); allCharts.forEach((c) => c.clearGhosts()); base = { ...D };
      Object.values(S).forEach((s) => s.reset(true)); onChange();
    },
    destroy() { stopSweep(); timers.forEach(clearTimeout); allCharts.forEach((c) => c.destroy()); },
  };

  readState(); fitDomain(); refreshMain(); setVariant('a'); onChange();
  allCharts.forEach((c) => c.update(null, true));
  typo(L.controls); typo(L.stage); typo(L.stats);
  return api;
}

/* scoped styles */
const css = `
.sim--ex10-1 .ex101__quads { container-type: inline-size; }
.sim--ex10-1 .ex101__quad { display: grid; grid-template-columns: 1fr; gap: .9rem 1rem; }
.sim--ex10-1 .ex101__quad[hidden] { display: none; }
.sim--ex10-1 .ex101__cell { min-width: 0; }
@container (min-width: 540px) { .sim--ex10-1 .ex101__quad { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sim--ex10-1 .ex101__info { font: 300 .95rem/1.5 var(--f-serif); color: var(--ink-2); padding: .3rem .5rem; border-left: 2px solid var(--line-2); }
.sim--ex10-1 .ex101__info p { margin: 0 0 .5rem; }
.sim--ex10-1 .ex101__info b { font: 600 .84rem var(--f-mono); color: var(--ink); white-space: nowrap; margin: 0 .12em; }
.sim--ex10-1 .ex101__fig figcaption .islm__kbd { text-transform: none; letter-spacing: 0; }
`;
injectCss('css-ex10-1', css);
