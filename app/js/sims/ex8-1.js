/* ─────────────────────────────────────────────────────────────
   Упражнение 8.1 — денежный мультипликатор (создание денег банковской системой)

   H — денежная база, α — норма обязательных резервов, β — коэффициент кассовых остатков
   (избыточные резервы), γ — доля наличных денег в кредитах (cr).

   Пошаговый процесс (как в оригинале):
     1.  ЦБ покупает у населения золото на H, расплачиваясь чеками на себя.      CM = H
     2.  Наличные оказываются у населения.
     3.  Население вносит их в банки:  D = H,  CM = 0.
     4.  Банки перечисляют в ЦБ обязательный резерв  RR = α·D.
     5.  Банки создают собственные резервы  ER = β·D;  кредитный ресурс  K = D − RR − ER.
     6.  Банки выдают кредит K.
     7.  Население держит γ·K наличными, остальное (K − CM) вносит в банки:  D ↑.
     8.  Новый депозит снова делится на RR, ER, K  (ΔRR = α·ΔD, ΔER = β·ΔD, ΔK = ΔD − ΔRR − ΔER).
     9.  Новый кредит ΔK снова делится: ΔCM = γ·ΔK, ΔD = ΔK − ΔCM … и так до затухания.
   Итог:  M = (1 + γ(1−α−β))·H / (α + β + γ(1−α−β)),   D_max = H / (α + β + γ(1−α−β)),
          K_max = (1−α−β)·D_max.
   Исходные значения оригинала: H = 100, α = 0,2, β = 0,08, γ = 0,25  ⇒  M = 256,52.
   ───────────────────────────────────────────────────────────── */
import { h, fmt, clamp } from '../core/dom.js';
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, stat, presets, figure, legend, callout, dtable, button, symHTML } from '../ui/controls.js';

const NB = ' ';
const D0 = { H: 100, a: 0.2, b: 0.08, g: 0.25 };
const MAX_STEPS = 260;

/* ── the model ─────────────────────────────────────────────── */
const kk = (p) => 1 - p.a - p.b;
const denom = (p) => p.a + p.b + p.g * kk(p);
const Mmax = (p) => ((1 + p.g * kk(p)) * p.H) / denom(p);
const Dmax = (p) => p.H / denom(p);
const Kmax = (p) => kk(p) * Dmax(p);
const mult = (p) => Mmax(p) / p.H;
const r2 = (v) => Math.round(v * 100) / 100;

/** the step-by-step process: array of states + the money-supply path by "cycle" */
function process(p) {
  const out = [];
  const z = { CM: 0, D: 0, RR: 0, ER: 0, K: 0, Kp: 0, V: 0, U: 0, gold: 0, hh: 0, dCM: 0, dD: 0, dK: 0 };
  const push = (o, text, kind, cyc) => out.push({ ...o, text, kind, cyc: cyc != null ? cyc : out.length ? out[out.length - 1].cyc : 0 });
  let s = { ...z };
  push(s, 'Исходное состояние. Нажмите «Далее» — и проследите, как из одной денежной базы банки создают много денег.', 'start', 0);
  s = { ...s, gold: p.H, U: p.H };
  push(s, `Центральный банк оплачивает покупку у населения золота на ${fmt(p.H, 0)}${NB}ден.${NB}ед. чеками на себя.`, 'cb', 0);
  s = { ...s, hh: p.H, CM: p.H, U: 0 };
  push(s, `Наличные деньги поступают в распоряжение населения в количестве ${fmt(p.H, 0)}${NB}ден.${NB}ед.`, 'pop', 0);
  s = { ...s, CM: 0, D: p.H, V: p.H };
  push(s, `Эти деньги вносятся в коммерческие банки: население открывает счета до востребования на ${fmt(p.H, 0)}${NB}ден.${NB}ед.`, 'pop', 0);
  s = { ...s, RR: s.D * p.a, V: s.D - s.D * p.a };
  push(s, 'Коммерческие банки перечисляют в Центральный банк обязательный резерв (RR).', 'bank', 0);
  s = { ...s, ER: s.D * p.b, K: s.D - s.D * p.a - s.D * p.b, V: 0, U: s.D - s.D * p.a - s.D * p.b };
  push(s, 'Коммерческие банки создают собственные резервы (ER), а оставшаяся часть депозита служит кредитным ресурсом (K).', 'bank', 0);
  s = { ...s, Kp: s.K, CM: s.K, U: 0 };
  push(s, 'Коммерческие банки предоставляют кредиты населению (K).', 'bank', 0);
  /* round 1: population splits the loan */
  let cyc = 0, dK = s.K, first = true, dD = 0, dCM = 0;
  for (let n = 0; n < MAX_STEPS; n++) {
    /* population step */
    if (first) { dCM = p.g * s.K; s = { ...s, CM: dCM, V: s.K - dCM }; dD = s.K - dCM; s.D = s.D + dD; first = false; }
    else { dCM = p.g * dK; dD = dK - dCM; s = { ...s, Kp: s.K, CM: s.CM + dCM, D: s.D + dD, V: dD, U: 0 }; }
    cyc++;
    push({ ...s, dCM, dD }, `Население часть средств, полученных в кредит, держит наличными (+${fmt(r2(dCM), 2)}${NB}ден.${NB}ед.), а оставшуюся часть вносит в банки (+${fmt(r2(dD), 2)}${NB}ден.${NB}ед.).`, 'pop', cyc);
    const done = r2(dD) === 0 && r2(dCM) === 0;
    /* bank step */
    const dRR = dD * p.a, dER = dD * p.b; dK = dD - dRR - dER;
    s = { ...s, RR: s.RR + dRR, ER: s.ER + dER, K: s.K + dK, V: 0, U: dK };
    if (done) { push(s, `Коммерческие банки перечисляют в ЦБ обязательный и собственные резервы (RR и ER), остальное — кредитные ресурсы. Банковская система создала денег: M${NB}=${NB}${fmt(Mmax(p), 2)}.`, 'end', cyc); break; }
    push(s, 'Коммерческие банки перечисляют в ЦБ обязательный и собственные резервы (RR и ER). Оставшаяся часть депозитов — кредитные ресурсы, которые снова выдаются населению.', 'bank', cyc);
  }
  const cycles = [];
  out.forEach((st) => { if (st.kind === 'pop' && st.cyc >= 1) cycles[st.cyc] = { k: st.cyc, M: st.CM + st.D, D: st.D, CM: st.CM }; });
  cycles[0] = { k: 0, M: p.H, D: p.H, CM: 0 };
  return { steps: out, cycles: cycles.filter(Boolean) };
}

export function mount(root, env) {
  root.classList.add('sim--ex8-1');
  const L = simLayout(root);
  const st = { ...D0 };
  let base = { ...D0 };
  let marked = false;
  let proc = process(st), baseProc = process(base);
  let step = proc.steps.length - 1, follow = true, timer = 0, playing = false;

  /* ── controls ─────────────────────────────────────────────── */
  const S = {
    H: slider({ label: 'Денежная база', sym: 'H', min: 10, max: 200, step: 5, value: D0.H, unit: 'ден. ед.', color: 'var(--d1)' }),
    a: slider({ label: 'Норма обязательных резервов', sym: 'α', min: 0.05, max: 0.4, step: 0.01, value: D0.a, dec: 2, color: 'var(--d3)', help: 'в оригинале 0,1 – 0,3' }),
    b: slider({ label: 'Коэффициент кассовых остатков банков', sym: 'β', min: 0.01, max: 0.2, step: 0.01, value: D0.b, dec: 2, color: 'var(--d4)', help: 'в оригинале 0,05 – 0,1' }),
    g: slider({ label: 'Доля наличных в кредитах банков', sym: 'γ', min: 0.05, max: 0.5, step: 0.01, value: D0.g, dec: 2, color: 'var(--d2)', help: 'в оригинале 0,2 – 0,3' }),
  };
  const set = (k, v) => S[k].set(+v.toFixed(2), { fromUser: true });
  const pre = presets([
    { label: 'Резервы строже: α = 0,3', color: 'var(--d3)', hint: 'ЦБ повышает норму обязательных резервов', apply: () => { mark(); set('a', 0.3); } },
    { label: 'Резервы мягче: α = 0,1', color: 'var(--d3)', hint: 'ЦБ снижает норму обязательных резервов', apply: () => { mark(); set('a', 0.1); } },
    { label: 'Больше наличных: γ = 0,3', color: 'var(--d2)', hint: 'Население чаще держит деньги наличными', apply: () => { mark(); set('g', 0.3); } },
    { label: 'Меньше наличных: γ = 0,2', color: 'var(--d2)', hint: 'Население охотнее хранит деньги в банках', apply: () => { mark(); set('g', 0.2); } },
    { label: 'Максимум мультипликатора', color: 'var(--d6)', hint: 'α = 0,1; β = 0,05; γ = 0,2', apply: () => { mark(); set('a', 0.1); set('b', 0.05); set('g', 0.2); } },
    { label: 'Минимум мультипликатора', color: 'var(--d5)', hint: 'α = 0,3; β = 0,1; γ = 0,3', apply: () => { mark(); set('a', 0.3); set('b', 0.1); set('g', 0.3); } },
    { label: 'База вдвое больше: H = 200', color: 'var(--d1)', hint: 'Эмиссия: центральный банк расширяет базу', apply: () => { mark(); S.H.set(200, { fromUser: true }); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Сценарии' });
  L.controls.append(
    panel({ title: 'Параметры модели', hint: 'дважды щёлкните название — сброс' }, S.H.el, S.a.el, S.b.el, S.g.el),
    panel({ title: 'Что будет, если…' }, pre));

  /* ── readouts ─────────────────────────────────────────────── */
  const R = {
    M: stat({ label: 'Денежная масса', sym: 'M', unit: 'ден. ед.', dec: 2, size: 'l', color: 'var(--accent)' }),
    k: stat({ label: 'Денежный мультипликатор', unit: '= M / H', dec: 2, color: 'var(--d1)' }),
    D: stat({ label: 'Депозиты', sym: 'D_max', dec: 2, color: 'var(--d5)' }),
    K: stat({ label: 'Кредиты', sym: 'K_max', dec: 2, color: 'var(--d4)' }),
    C: stat({ label: 'Наличные', sym: 'CM', dec: 2, color: 'var(--d2)' }),
    Rs: stat({ label: 'Резервы', sym: 'RR + ER', dec: 2, color: 'var(--d3)' }),
  };
  L.stats.append(R.M.el, R.k.el, R.D.el, R.K.el, R.C.el, R.Rs.el);

  /* ── chart: money supply by cycle ─────────────────────────── */
  const host = h('div');
  const chart = createChart(host, {
    x: { min: 0, max: 14, label: 'k', ticks: 7 },
    y: { min: 0, max: 300, label: 'ден. ед.', ticks: 5, fmt: (v) => fmt(v, 0) },
    aspect: 1.6, maxH: 460, margin: { l: 56, r: 40, t: 28, b: 44 }, title: 'Денежная масса по кругам кредитования',
  });
  const ptsOf = (pr, key) => pr.cycles.map((c) => [c.k, c[key]]);
  chart.hline('lim', { y: () => Mmax(st), color: 'var(--accent)', dash: '6 6', width: 1.6, label: 'M_{max}', labelDy: -8 });
  chart.line('m0', { pts: ptsOf(baseProc, 'M'), color: 'var(--ink-3)', width: 2, dash: '7 6', glow: false, ghost: false, label: 'M^0', labelAt: .97, labelDy: 18 });
  chart.line('D', { pts: ptsOf(proc, 'D'), color: 'var(--d5)', width: 2.4, glow: false, ghost: false, label: 'D', labelAt: .97, labelDy: 16 });
  chart.line('CM', { pts: ptsOf(proc, 'CM'), color: 'var(--d2)', width: 2.4, glow: false, ghost: false, label: 'CM', labelAt: .97, labelDy: -8 });
  chart.line('M', { pts: ptsOf(proc, 'M'), color: 'var(--accent)', width: 3.6, ghost: false, label: 'M', labelAt: .6, labelDy: -12 });
  const cur = { k: 0, M: 0 };
  chart.point('now', { x: () => cur.k, y: () => cur.M, color: 'var(--accent)', r: 7, pulse: true, guides: { y: 'M_k' } });

  /* ── process panel ────────────────────────────────────────── */
  const stepSl = slider({ label: 'Шаг процесса', min: 0, max: proc.steps.length - 1, step: 1, value: step, dec: 0, color: 'var(--d1)', fmt: (v) => fmt(v, 0) });
  const stepOf = h('span.ex81__of');
  stepSl.el.querySelector('.sl__val').append(stepOf);
  const narr = h('p.ex81__narr', { 'aria-live': 'polite' });
  const bsHost = h('div.ex81__bs');
  const bBack = button({ label: 'Назад', sm: true, onClick: () => go(step - 1, true) });
  const bNext = button({ label: 'Далее', icon: 'arrow', sm: true, variant: 'primary', onClick: () => go(step + 1, true) });
  const bEnd = button({ label: 'К итогу', sm: true, onClick: () => go(proc.steps.length - 1, true) });
  let bPlay = button({ label: 'Проиграть', icon: 'play', sm: true, onClick: () => togglePlay() });
  const bar = h('div.ex81__ctl', bBack, bNext, bPlay, bEnd);
  const procBox = h('div.ex81__proc', stepSl.el, bar, narr, bsHost);

  const compo = h('div.ex81__cmp');
  L.stage.append(
    figure('Денежная масса по кругам кредитования', host, { note: 'По оси k — число «кругов»: деньги вносятся в банк, банк выдаёт кредит, часть кредита оседает в банках как новый депозит. Пунктир — предел M; точка — шаг процесса, выбранный ниже.' }),
    legend([{ color: 'var(--accent)', label: 'M — денежная масса (CM + D)' }, { color: 'var(--d5)', label: 'D — депозиты' }, { color: 'var(--d2)', label: 'CM — наличные у населения' }, { color: 'var(--ink-3)', label: 'M^0 — до изменения', dash: true }]),
    figure('Процесс создания денег · балансы', procBox, { class: 'ex81__fig' }),
    figure('Куда уходит база и из чего состоит M', compo, { class: 'ex81__fig' }),
  );

  /* ── table + explanation ──────────────────────────────────── */
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получена денежная масса' });
  L.notes.append(tbl.el, expl);

  /* ── balances ─────────────────────────────────────────────── */
  let prevState = null;
  const v2 = (v) => fmt(r2(v), 2);
  function sheet(title, who, left, right, tot, prev, cur2) {
    const row = (lab, key, hint) => {
      const val = cur2[key], pv = prev ? prev[key] : null;
      const chg = prev && Math.abs(r2(val) - r2(pv)) > 0;
      return h('div.ex81__row' + (chg ? '.is-new' : '') + (r2(val) === 0 ? '.is-zero' : ''), { title: hint || null }, h('i.sym', { html: symHTML(lab) }), h('b', cur2.kind === 'start' ? '' : v2(val)));
    };
    const sum = (arr) => arr.reduce((a, k) => a + cur2[k.v], 0);
    const colA = h('div.ex81__col', h('span.ex81__ch', 'Актив'), ...left.map((x) => row(x.s, x.v, x.t)), h('div.ex81__row.ex81__sum', h('i', 'Всего'), h('b', cur2.kind === 'start' ? '' : v2(sum(left)))));
    const colP = h('div.ex81__col', h('span.ex81__ch', 'Пассив'), ...right.map((x) => row(x.s, x.v, x.t)), h('div.ex81__row.ex81__sum', h('i', 'Всего'), h('b', cur2.kind === 'start' ? '' : v2(sum(right)))));
    return h('div.ex81__sheet', { style: { '--c': who } }, h('h4', title), h('div.ex81__cols', colA, colP));
  }
  function drawSheets() {
    const s = proc.steps[step], pv = step > 0 ? proc.steps[step - 1] : null;
    /* derived rows */
    const withD = (x) => (x ? { ...x, cb_cm: x.CM + x.V + x.U } : x);
    const c = withD(s), p = withD(pv);
    bsHost.textContent = '';
    bsHost.append(
      sheet('Центральный банк', 'var(--d1)',
        [{ s: 'H', v: 'gold', t: 'Активы ЦБ (золото) = денежная база' }],
        [{ s: 'CM', v: 'cb_cm', t: 'Наличные в обращении (у населения и в кассах банков)' }, { s: 'RR', v: 'RR', t: 'Обязательные резервы банков' }, { s: 'ER', v: 'ER', t: 'Избыточные резервы банков' }], null, p, c),
      sheet('Коммерческие банки', 'var(--d5)',
        [{ s: 'RR', v: 'RR' }, { s: 'ER', v: 'ER' }, { s: 'K', v: 'K', t: 'Выданные кредиты и кредитные ресурсы' }, { s: 'V', v: 'V', t: 'Новый депозит, ещё не распределённый на RR, ER и K' }],
        [{ s: 'D', v: 'D', t: 'Депозиты населения' }], null, p, c),
      sheet('Население', 'var(--d2)',
        [{ s: 'CM', v: 'CM', t: 'Наличные у населения' }, { s: 'D', v: 'D' }],
        [{ s: 'K', v: 'Kp', t: 'Долг по кредитам' }, { s: 'H', v: 'hh', t: 'Выручка от продажи золота' }], null, p, c));
  }

  /* ── compose / render ─────────────────────────────────────── */
  function drawCompose() {
    const M = Mmax(st), Dm = Dmax(st), Cm = st.g * Kmax(st), RR = st.a * Dm, ER = st.b * Dm;
    const seg = (items, tot) => h('div.ex81__stack', ...items.map((it) => h('span', { style: { '--w': (it.v / tot).toFixed(4), '--c': it.c }, title: `${it.l}: ${v2(it.v)}` }, h('em', { html: symHTML(it.l) }), h('b', v2(it.v)))));
    compo.textContent = '';
    compo.append(
      h('div.ex81__line', h('span.ex81__l', { html: `База ${symHTML('H')} = ${symHTML('CM')} + ${symHTML('RR')} + ${symHTML('ER')}` }), seg([{ l: 'CM', v: Cm, c: 'var(--d2)' }, { l: 'RR', v: RR, c: 'var(--d3)' }, { l: 'ER', v: ER, c: 'var(--d4)' }], st.H)),
      h('div.ex81__line', h('span.ex81__l', { html: `Деньги ${symHTML('M')} = ${symHTML('CM')} + ${symHTML('D')}` }), seg([{ l: 'CM', v: Cm, c: 'var(--d2)' }, { l: 'D', v: Dm, c: 'var(--d5)' }], M)),
      h('p.ex81__note', `База ${fmt(st.H, 0)} «обслуживает» денежную массу ${v2(M)}: каждая единица базы превращается в `, h('b', fmt(mult(st), 2)), ' единицы денег.'));
  }

  function drawChart() {
    chart.get('m0').op.pts = ptsOf(baseProc, 'M');
    chart.get('M').op.pts = ptsOf(proc, 'M'); chart.get('D').op.pts = ptsOf(proc, 'D'); chart.get('CM').op.pts = ptsOf(proc, 'CM');
    const kmax = Math.max(proc.cycles.length - 1, baseProc.cycles.length - 1, 4);
    const ymax = Math.max(Mmax(st), Mmax(base)) * 1.12;
    const mag = Math.pow(10, Math.floor(Math.log10(ymax))); const top = Math.ceil(ymax / (mag / 2)) * (mag / 2);
    const kx = Math.ceil(kmax / 2) * 2;
    chart.setDomain({ x: [0, kx], y: [0, top] }, true);
    const same = Math.abs(Mmax(st) - Mmax(base)) < 1e-9 && st.H === base.H;
    const e = chart.get('m0'); e && e.nodes.forEach((n) => { n.style.display = same ? 'none' : ''; });
    chart.update();
  }

  function drawStep() {
    const s = proc.steps[step];
    cur.k = s.cyc; cur.M = s.CM + s.D; chart.update('now');
    narr.textContent = s.text;
    stepSl.set(step, { silent: true });
    stepOf.textContent = ' из ' + (proc.steps.length - 1);
    bBack.disabled = step <= 0; bNext.disabled = step >= proc.steps.length - 1;
    drawSheets();
  }

  function go(i, user) {
    if (user) stopPlay();
    step = clamp(i, 0, proc.steps.length - 1);
    follow = step === proc.steps.length - 1;
    drawStep();
  }
  function togglePlay() {
    if (playing) { stopPlay(); return; }
    if (step >= proc.steps.length - 1) { step = 0; drawStep(); }
    playing = true; swapPlay();
    const tick = () => {
      if (!playing) return;
      if (step >= proc.steps.length - 1) { stopPlay(); return; }
      step++; follow = step === proc.steps.length - 1; drawStep();
      timer = setTimeout(tick, step <= 6 ? 1300 : 520);
    };
    timer = setTimeout(tick, 400);
  }
  function stopPlay() { clearTimeout(timer); if (playing) { playing = false; swapPlay(); } }
  function swapPlay() { const n = button({ label: playing ? 'Пауза' : 'Проиграть', icon: playing ? 'pause' : 'play', sm: true, onClick: () => togglePlay() }); bPlay.replaceWith(n); bPlay = n; }

  function render() {
    const M = Mmax(st), D = Dmax(st), K = Kmax(st), CM = st.g * K, Rs = (st.a + st.b) * D;
    const bM = Mmax(base), bD = Dmax(base), bK = Kmax(base), bCM = base.g * bK, bR = (base.a + base.b) * bD;
    R.M.set(M); R.k.set(mult(st)); R.D.set(D); R.K.set(K); R.C.set(CM); R.Rs.set(Rs);
    R.M.base(bM); R.k.base(mult(base)); R.D.base(bD); R.K.base(bK); R.C.base(bCM); R.Rs.base(bR);
    const sg = (v, d = 2) => (v > 0.5 * Math.pow(10, -d) ? '+' : v < -0.5 * Math.pow(10, -d) ? '−' : '') + fmt(Math.abs(v), d);
    const row = (k, a, b, d = 2) => ({ k, a: fmt(a, d), b: fmt(b, d), d: sg(b - a, d) });
    tbl.set([
      row('Денежная масса M', bM, M), row('Мультипликатор M/H', mult(base), mult(st)), row('Депозиты D', bD, D),
      row('Кредиты K', bK, K), row('Наличные CM', bCM, CM), row('Обязательные резервы RR', base.a * bD, st.a * D),
      row('Избыточные резервы ER', base.b * bD, st.b * D), row('Созданные деньги M − H', bM - base.H, M - st.H),
    ]);
    const kq = kk(st), dn = denom(st);
    expl.querySelector('.co__b').innerHTML =
      `<p>${symHTML('M')} = (1 + ${symHTML('γ')}(1 − ${symHTML('α')} − ${symHTML('β')}))·${symHTML('H')} / (${symHTML('α')} + ${symHTML('β')} + ${symHTML('γ')}(1 − ${symHTML('α')} − ${symHTML('β')})) = ` +
      `(1 + ${fmt(st.g, 2)}·${fmt(kq, 2)})·${fmt(st.H, 0)} / (${fmt(st.a, 2)} + ${fmt(st.b, 2)} + ${fmt(st.g, 2)}·${fmt(kq, 2)}) = ${fmt(1 + st.g * kq, 3)}·${fmt(st.H, 0)} / ${fmt(dn, 3)} = <b>${fmt(M, 2)}</b></p>` +
      `<p>Мультипликатор ${fmt(mult(st), 2)}: банковская система из ${fmt(st.H, 0)} единиц базы создала ${fmt(M - st.H, 2)} новых денег. Депозиты ${symHTML('D_max')} = ${symHTML('H')}/(…) = ${fmt(D, 2)}, кредиты ${symHTML('K_max')} = (1 − ${symHTML('α')} − ${symHTML('β')})·${symHTML('D_max')} = ${fmt(K, 2)}.</p>` +
      `<p>${verdict()}</p>`;
  }
  function verdict() {
    const dm = mult(st) - mult(base);
    if (Math.abs(dm) < 0.005) return 'Параметры не отличаются от исходных: мультипликатор не изменился. Выберите сценарий или подвигайте ползунки.';
    const parts = [];
    if (st.a !== base.a) parts.push(`норма резервов ${st.a > base.a ? 'выросла' : 'снизилась'}`);
    if (st.b !== base.b) parts.push(`кассовые остатки ${st.b > base.b ? 'выросли' : 'снизились'}`);
    if (st.g !== base.g) parts.push(`доля наличных ${st.g > base.g ? 'выросла' : 'снизилась'}`);
    const why = parts.length ? parts.join(', ') + ' — ' : '';
    return `<b>${dm > 0 ? 'Мультипликатор вырос' : 'Мультипликатор упал'} на ${fmt(Math.abs(dm), 2)}.</b> ${why}${dm > 0 ? 'больше денег остаётся в банковском обороте и снова уходит в кредиты' : 'больше денег «утекает» в резервы и наличные, кредитный круг короче'}.`;
  }

  function recompute() {
    Object.keys(S).forEach((k) => (st[k] = S[k].value));
    proc = process(st); baseProc = process(base);
    stepSl.setRange(0, proc.steps.length - 1);
    step = follow ? proc.steps.length - 1 : Math.min(step, proc.steps.length - 1);
    drawChart(); drawStep(); render(); drawCompose();
  }
  Object.values(S).forEach((s) => s.on(() => { stopPlay(); recompute(); }));
  stepSl.on((v, user) => { if (user) go(Math.round(v), true); });
  recompute();

  /* ── frame API ────────────────────────────────────────────── */
  function mark() { base = { ...st }; marked = true; baseProc = process(base); drawChart(); render(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { base = { ...D0 }; marked = false; baseProc = process(base); drawChart(); render(); },
    reset() { stopPlay(); base = { ...D0 }; marked = false; follow = true; Object.values(S).forEach((s) => s.reset(true)); recompute(); },
    destroy() { stopPlay(); chart.destroy(); },
  };
  return api;
}

/* ── scoped styles ──────────────────────────────────────────── */
const css = `
.sim--ex8-1 .ex81__fig { min-width: 0; }
.sim--ex8-1 .ex81__proc { display: grid; gap: .9rem; padding: .2rem .5rem .6rem; }
.sim--ex8-1 .ex81__of { margin-left: .35rem; font: 400 .72rem/1 var(--f-mono); color: var(--ink-3); white-space: nowrap; }
.sim--ex8-1 .ex81__ctl { display: flex; flex-wrap: wrap; gap: .5rem; }
.sim--ex8-1 .ex81__ctl .btn:disabled { opacity: .4; pointer-events: none; }
.sim--ex8-1 .ex81__narr { margin: 0; min-height: 3.1em; padding: .75rem .95rem; border-left: 3px solid var(--accent); background: var(--surface-2); border-radius: 0 var(--r-s) var(--r-s) 0; font: 400 1rem/1.5 var(--f-serif); color: var(--ink); }
.sim--ex8-1 .ex81__bs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
.sim--ex8-1 .ex81__sheet { min-width: 0; border: 1px solid var(--line-2); border-top: 3px solid var(--c); border-radius: var(--r-s); background: var(--surface); padding: .6rem .65rem .7rem; }
.sim--ex8-1 .ex81__sheet h4 { margin: 0 0 .5rem; font: 600 .74rem/1.2 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }
.sim--ex8-1 .ex81__cols { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.sim--ex8-1 .ex81__col { display: grid; gap: .3rem; align-content: start; min-width: 0; }
.sim--ex8-1 .ex81__ch { font: 500 .62rem/1 var(--f-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); padding-bottom: .2rem; border-bottom: 1px solid var(--line); }
.sim--ex8-1 .ex81__row { display: flex; justify-content: space-between; align-items: baseline; gap: .3rem; padding: .18rem .3rem; border-radius: 5px; font: 400 .88rem/1.25 var(--f-serif); color: var(--ink-2); transition: background-color .4s var(--ease), color .4s; }
.sim--ex8-1 .ex81__row b { font: 500 .78rem/1 var(--f-mono); color: var(--ink); white-space: nowrap; }
.sim--ex8-1 .ex81__row.is-zero b { color: var(--ink-4); }
.sim--ex8-1 .ex81__row.is-new { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
.sim--ex8-1 .ex81__row.is-new b { color: var(--accent); }
.sim--ex8-1 .ex81__sum { margin-top: .1rem; border-top: 1px dashed var(--line-2); border-radius: 0; padding-top: .35rem; font: 500 .62rem/1 var(--f-mono); text-transform: uppercase; letter-spacing: .08em; }
.sim--ex8-1 .ex81__sum i { font: inherit; font-style: normal; }
.sim--ex8-1 .ex81__cmp { display: grid; gap: .9rem; padding: .3rem .6rem .7rem; }
.sim--ex8-1 .ex81__line { display: grid; gap: .35rem; }
.sim--ex8-1 .ex81__l { font: 400 .86rem/1.3 var(--f-sans); color: var(--ink-2); }
.sim--ex8-1 .ex81__stack { display: flex; height: 2rem; border-radius: 6px; overflow: hidden; background: var(--surface-3); }
.sim--ex8-1 .ex81__stack span { flex: 0 0 calc(var(--w) * 100%); min-width: 0; display: flex; align-items: center; justify-content: center; gap: .4rem; overflow: hidden; background: var(--c); color: var(--bg); transition: flex-basis .6s var(--ease); font: 500 .7rem/1 var(--f-mono); }
.sim--ex8-1 .ex81__stack span em { font-style: normal; font-family: var(--f-serif); font-size: .8rem; }
.sim--ex8-1 .ex81__stack span b { font-weight: 500; }
.sim--ex8-1 .ex81__note { margin: 0; font: italic 300 .95rem/1.45 var(--f-serif); color: var(--ink-3); }
.sim--ex8-1 .ex81__note b { color: var(--ink); font-style: normal; font-weight: 600; font-family: var(--f-mono); font-size: .86rem; }
@media (max-width: 760px) {
  .sim--ex8-1 .ex81__bs { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .sim--ex8-1 .ex81__stack span em { display: none; }
}
`;
if (!document.getElementById('css-ex8-1')) { const s = document.createElement('style'); s.id = 'css-ex8-1'; s.textContent = css; document.head.append(s); }
