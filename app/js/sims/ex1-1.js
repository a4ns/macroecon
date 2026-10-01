/* ─────────────────────────────────────────────────────────────
   Упражнение 1.1 — Модель кругооборота потоков в экономике
   Двух-, трёх- и четырёхсекторная модели (домохозяйства, фирмы, государство, иностранный сектор;
   рынки ресурсов, товаров и услуг, финансовый).

   Математика оригинала (C = 500 + 0,75·Yd):
     2 сектора :  Y = (500 + I) / (1 − 0,75),                         Yd = Y
     3 сектора :  Y = (500 + I + G − 0,75·T) / (1 − 0,75),            Yd = Y − T,  B = T − G − Tr
     4 сектора :  Y = (500 + I + G + Ex − Im − 0,75·T) / (1 − 0,75),  Nx = Ex − Im
     C = 500 + 0,75·Yd,  S = Yd − C
   Исходные значения: I = 100, T = 100, Tr = 10, G = 100, Ex = 100, Im = 100.
   В оригинале трансферты Tr не входят в Yd (влияют только на баланс бюджета);
   переключатель «Трансферты в доходе» показывает «строгий» вариант Yd = Y − T + Tr.
   ───────────────────────────────────────────────────────────── */
import { h, fmt as nfmt, clamp, reduced } from '../core/dom.js';
/* ru-форматирование с настоящим минусом «−» */
const fmt = (n, d = 0) => nfmt(n, d).replace(/-/g, '\u2212');
import { createChart } from '../ui/plot.js';
import { simLayout, panel, slider, seg, toggle, stat, presets, figure, legend, callout, dtable, symHTML } from '../ui/controls.js';
import { nb } from './_nb.js';

const D = { sector: 4, I: 100, T: 100, Tr: 10, G: 100, Ex: 100, Im: 100, a0: 500, mpc: 0.75, strict: false };

/* ── модель ── */
function model(p) {
  const s = p.sector;
  const I = p.I, G = s >= 3 ? p.G : 0, T = s >= 3 ? p.T : 0, Tr = s >= 3 ? p.Tr : 0, Ex = s >= 4 ? p.Ex : 0, Im = s >= 4 ? p.Im : 0;
  const k = 1 - p.mpc, tr = p.strict ? Tr : 0, Nx = Ex - Im;
  const A = p.a0 + I + G + Nx - p.mpc * T + p.mpc * tr;     // отрезок на оси E в «кресте»
  const Y = A / k, Yd = Y - T + tr, C = p.a0 + p.mpc * Yd, S = Yd - C;
  const B = T - G - Tr, BD = -B;
  return { s, I, G, T, Tr, Ex, Im, Nx, tr, k, A, Y, Yd, C, S, B, BD, leak: S + T + Im, inj: I + G + Ex + tr };
}

/* ── геометрия схемы (viewBox 840×560, начало слева −20) ── */
const VB = { x: -20, y: 0, w: 840, h: 560 };
const BOX = {
  W: { x: 30, y: 40, w: 190, h: 62, t: ['Иностранный', 'сектор'], kind: 'agent', sec: 4, c: 'var(--d6)' },
  GM: { x: 305, y: 40, w: 190, h: 62, t: ['Рынок товаров', 'и услуг'], kind: 'market', sec: 2, c: 'var(--d2)' },
  H: { x: 30, y: 230, w: 190, h: 62, t: ['Домохозяйства'], kind: 'agent', sec: 2, c: 'var(--d4)' },
  G: { x: 305, y: 230, w: 190, h: 62, t: ['Государство'], kind: 'agent', sec: 3, c: 'var(--d5)' },
  F: { x: 580, y: 230, w: 190, h: 62, t: ['Фирмы'], kind: 'agent', sec: 2, c: 'var(--d1)' },
  FIN: { x: 305, y: 360, w: 190, h: 62, t: ['Финансовый', 'рынок'], kind: 'market', sec: 2, c: 'var(--d4)' },
  RM: { x: 305, y: 470, w: 190, h: 62, t: ['Рынок', 'ресурсов'], kind: 'market', sec: 2, c: 'var(--d2)' },
};
const rev = (a) => a.slice().reverse();
const f0 = (v) => fmt(v, 0);
const f1 = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? fmt(v, 0) : fmt(v, 1));
const sg = (v) => (v > 0.0005 ? '+' : v < -0.0005 ? '−' : '') + f1(Math.abs(v));

/* потоки денег; real — парный поток товаров/ресурсов навстречу */
const MONEY = [
  { id: 'yh', sec: 2, sym: 'Y', col: 'var(--d1)', pts: [[305, 501], [125, 501], [125, 292]], lab: [215, 501], val: (m) => m.Y,
    name: 'Доходы домохозяйств', from: 'рынок ресурсов', to: 'домохозяйства', how: () => 'Всё, что фирмы выручили, выплачивается владельцам ресурсов: Y',
    real: { sym: 'Рес', name: 'Ресурсы домохозяйств (труд, капитал, земля)', from: 'домохозяйства', to: 'рынок ресурсов', lab: [215, 501] } },
  { id: 'z', sec: 2, sym: 'Y', col: 'var(--d1)', pts: [[675, 292], [675, 501], [495, 501]], lab: [585, 501], val: (m) => m.Y,
    name: 'Оплата за ресурсы', from: 'фирмы', to: 'рынок ресурсов', how: () => 'Расходы фирм на ресурсы = созданный доход Y',
    real: { sym: 'Рес', name: 'Ресурсы — фирмам для производства', from: 'рынок ресурсов', to: 'фирмы', lab: [585, 501] } },
  { id: 'c', sec: 2, sym: 'C', col: 'var(--d1)', pts: [[160, 230], [160, 165], [350, 165], [350, 102]], lab: [255, 165], val: (m) => m.C,
    name: 'Потребительские расходы', from: 'домохозяйства', to: 'рынок товаров и услуг', how: (m, p) => `C = ${f0(p.a0)} + ${fmt(p.mpc, 2)} · Yd`,
    real: { sym: 'Тов', name: 'Потребительские товары и услуги', from: 'рынок товаров и услуг', to: 'домохозяйства', lab: [255, 165] } },
  { id: 's', sec: 2, sym: 'S', col: 'var(--d4)', pts: [[195, 292], [195, 391], [305, 391]], lab: [195, 340], val: (m) => m.S,
    name: 'Сбережения', from: 'домохозяйства', to: 'финансовый рынок', how: () => 'S = Yd − C' },
  { id: 'rev', sec: 2, sym: 'Y', col: 'var(--d1)', pts: [[495, 71], [725, 71], [725, 230]], lab: [615, 71], val: (m) => m.Y,
    name: 'Выручка фирм от продаж', from: 'рынок товаров и услуг', to: 'фирмы', how: () => 'Выручка = C + I + G + Nx = Y',
    real: { sym: 'Тов', name: 'Произведённые товары и услуги', from: 'фирмы', to: 'рынок товаров и услуг', lab: [615, 71] } },
  { id: 'inv', sec: 2, sym: 'I', col: 'var(--d1)', pts: [[640, 230], [640, 165], [450, 165], [450, 102]], lab: [545, 165], val: (m) => m.I,
    name: 'Инвестиционные расходы', from: 'фирмы', to: 'рынок товаров и услуг', how: () => 'I задана (автономные инвестиции)',
    real: { sym: 'Тов', name: 'Инвестиционные товары (оборудование, здания)', from: 'рынок товаров и услуг', to: 'фирмы', lab: [545, 165] } },
  { id: 'cred', sec: 2, sym: 'Кр', col: 'var(--d4)', pts: [[495, 391], [640, 391], [640, 292]], lab: [570, 391], val: (m) => m.I,
    name: 'Заёмные средства (кредиты фирмам)', from: 'финансовый рынок', to: 'фирмы', how: () => 'Инвестиции фирм финансируются кредитом: Кр = I' },
  { id: 't', sec: 3, sym: 'T', col: 'var(--d5)', pts: [[220, 246], [305, 246]], lab: [262, 246], val: (m) => m.T,
    name: 'Налоги', from: 'домохозяйства', to: 'государство', how: () => 'T задан; Yd = Y − T' },
  { id: 'tr', sec: 3, sym: 'Tr', col: 'var(--d5)', pts: [[305, 276], [220, 276]], lab: [262, 276], val: (m) => m.Tr,
    name: 'Трансферты', from: 'государство', to: 'домохозяйства', how: (m, p) => (p.strict ? 'Yd = Y − T + Tr' : 'В модели оригинала Tr не входит в Yd — только в баланс бюджета'), dashed: (m, p) => !p.strict },
  { id: 'g', sec: 3, sym: 'G', col: 'var(--d5)', pts: [[400, 230], [400, 102]], lab: [400, 170], val: (m) => m.G,
    name: 'Государственные закупки', from: 'государство', to: 'рынок товаров и услуг', how: () => 'G задана',
    real: { sym: 'Тов', name: 'Товары и услуги для государства', from: 'рынок товаров и услуг', to: 'государство', lab: [400, 170] } },
  { id: 'gb', sec: 3, sym: 'B', col: 'var(--d3)', pts: [[400, 360], [400, 292]], lab: [400, 326], val: (m) => Math.abs(m.B), flip: (m) => m.B > 0,
    name: (m) => (m.B > 0 ? 'Профицит бюджета направлен на финансовый рынок' : 'Заём государства'), from: (m) => (m.B > 0 ? 'государство' : 'финансовый рынок'), to: (m) => (m.B > 0 ? 'финансовый рынок' : 'государство'),
    how: (m) => (m.B > 0 ? 'B = T − G − Tr > 0' : 'Дефицит BD = Tr + G − T покрывается займом'), color: (m) => (m.B > 0 ? 'var(--d5)' : 'var(--d3)') },
  { id: 'ex', sec: 4, sym: 'Ex', col: 'var(--d6)', pts: [[220, 56], [305, 56]], lab: [262, 56], val: (m) => m.Ex,
    name: 'Экспорт товаров и услуг', from: 'иностранный сектор', to: 'рынок товаров и услуг', how: () => 'Ex задан (спрос иностранцев на отечественные товары)',
    real: { sym: 'Тов', name: 'Экспортируемые товары и услуги', from: 'рынок товаров и услуг', to: 'иностранный сектор', lab: [262, 56] } },
  { id: 'im', sec: 4, sym: 'Im', col: 'var(--d6)', pts: [[305, 86], [220, 86]], lab: [262, 86], val: (m) => m.Im,
    name: 'Импорт товаров и услуг', from: 'рынок товаров и услуг', to: 'иностранный сектор', how: () => 'Im задан',
    real: { sym: 'Тов', name: 'Импортируемые товары и услуги', from: 'иностранный сектор', to: 'рынок товаров и услуг', lab: [262, 86] } },
  { id: 'kap', sec: 4, sym: 'Nx', col: 'var(--d6)', pts: [[30, 71], [-8, 71], [-8, 410], [305, 410]], lab: [66, 410], val: (m) => Math.abs(m.Nx), flip: (m) => m.Nx > 0,
    name: (m) => (m.Nx > 0 ? 'Отток капитала' : 'Приток капитала'), from: (m) => (m.Nx > 0 ? 'финансовый рынок' : 'иностранный сектор'), to: (m) => (m.Nx > 0 ? 'иностранный сектор' : 'финансовый рынок'),
    how: () => 'Nx = Ex − Im; сальдо торговли уравновешивается движением капитала' },
];

const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}, p) => { const e = document.createElementNS(NS, n); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.append(e); return e; };

/* смещение ломаной на d вдоль её левой нормали + скругление углов */
function offsetPts(pts, d) {
  if (!d) return pts;
  const nrm = (a, b) => [Math.sign(b[1] - a[1]), -Math.sign(b[0] - a[0])];
  return pts.map((p, i) => {
    const nPrev = i > 0 ? nrm(pts[i - 1], p) : null, nNext = i < pts.length - 1 ? nrm(p, pts[i + 1]) : null;
    const nx = (nPrev ? nPrev[0] : 0) + (nNext ? nNext[0] : 0), ny = (nPrev ? nPrev[1] : 0) + (nNext ? nNext[1] : 0);
    return [p[0] + d * nx, p[1] + d * ny];
  });
}
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const toward = (a, b, r) => { const L = dist(a, b) || 1; return [a[0] + ((b[0] - a[0]) * r) / L, a[1] + ((b[1] - a[1]) * r) / L]; };
function pathD(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], r = Math.min(12, dist(a, b) / 2, dist(b, c) / 2);
    const p1 = toward(b, a, r), p2 = toward(b, c, r);
    d += `L${p1[0].toFixed(1)},${p1[1].toFixed(1)}Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const l = pts[pts.length - 1]; return d + `L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
}

export function mount(root, env) {
  root.classList.add('sim--ex1-1');
  const L = simLayout(root);
  const st = { ...D };
  let base = { ...D };           // с чем сравниваем (исходные значения или сохранённое «Сравнить»)
  let marked = false, layer = 'both', labelsOn = true, hov = null, agent = 'H';

  /* ── управление ── */
  const secSeg = seg({ label: 'Модель экономики', options: [{ v: 2, label: '2 сектора', hint: 'Домохозяйства и фирмы' }, { v: 3, label: '3 сектора', hint: '+ государство' }, { v: 4, label: '4 сектора', hint: '+ иностранный сектор' }], value: D.sector });
  const S = {
    I: slider({ label: 'Инвестиции', sym: 'I', min: 0, max: 300, step: 10, value: D.I, unit: 'ден. ед.', color: 'var(--d1)' }),
    T: slider({ label: 'Налоги', sym: 'T', min: 0, max: 300, step: 10, value: D.T, unit: 'ден. ед.', color: 'var(--d5)' }),
    Tr: slider({ label: 'Трансферты', sym: 'Tr', min: 0, max: 60, step: 1, value: D.Tr, unit: 'ден. ед.', color: 'var(--d5)' }),
    G: slider({ label: 'Государственные закупки', sym: 'G', min: 0, max: 300, step: 10, value: D.G, unit: 'ден. ед.', color: 'var(--d5)' }),
    Ex: slider({ label: 'Экспорт', sym: 'Ex', min: 0, max: 300, step: 10, value: D.Ex, unit: 'ден. ед.', color: 'var(--d6)' }),
    Im: slider({ label: 'Импорт', sym: 'Im', min: 0, max: 300, step: 10, value: D.Im, unit: 'ден. ед.', color: 'var(--d6)' }),
    a0: slider({ label: 'Автономное потребление', sym: 'C_a', min: 100, max: 1000, step: 50, value: D.a0, unit: 'ден. ед.', color: 'var(--d2)' }),
    mpc: slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: 0.5, max: 0.9, step: 0.01, value: D.mpc, dec: 2, color: 'var(--d4)' }),
  };
  const strictTg = toggle({ label: 'Трансферты в доходе', hint: 'Yd = Y − T + Tr (в оригинале Tr не входит в Yd)', color: 'var(--d5)', value: false });
  const layerSeg = seg({ label: 'Потоки', options: [{ v: 'money', label: 'Деньги', hint: 'Денежные (финансовые) потоки' }, { v: 'real', label: 'Товары', hint: 'Потоки товаров, услуг и ресурсов' }, { v: 'both', label: 'Оба' }], value: layer });
  const lblTg = toggle({ label: 'Названия и суммы потоков', color: 'var(--accent)', value: true });
  const set = (k, v) => S[k].set(v, { fromUser: true });
  const pre = presets([
    { label: 'Госзакупки G +10', color: 'var(--d5)', hint: 'Задание 3: ΔG = +10 → ΔY = +40', apply: () => { ensure(3); mark(); set('G', st.G + 10); } },
    { label: 'Налоги T +10', color: 'var(--d3)', hint: 'Налоги — утечка: ΔY = −30', apply: () => { ensure(3); mark(); set('T', st.T + 10); } },
    { label: 'Инвестиции I +10', color: 'var(--d1)', hint: 'Инъекция: ΔY = +40', apply: () => { mark(); set('I', st.I + 10); } },
    { label: 'Экспорт Ex +10', color: 'var(--d6)', hint: 'Инъекция из-за рубежа', apply: () => { ensure(4); mark(); set('Ex', st.Ex + 10); } },
    { label: 'Импорт Im +10', color: 'var(--d6)', hint: 'Утечка за рубеж', apply: () => { ensure(4); mark(); set('Im', st.Im + 10); } },
    { label: 'Трансферты Tr +5', color: 'var(--d5)', hint: 'В оригинале влияют только на баланс бюджета', apply: () => { ensure(3); mark(); set('Tr', st.Tr + 5); } },
    { label: 'Сбалансированный бюджет', color: 'var(--d2)', hint: 'T = G + Tr: B = 0', apply: () => { ensure(3); mark(); set('T', st.G + st.Tr); } },
    { label: 'Исходные значения', color: 'var(--ink-3)', apply: () => api.reset() },
  ], { title: 'Что будет, если…' });
  function ensure(n) { if (st.sector < n) { secSeg.set(n, { fromUser: true }); } }

  L.controls.append(
    panel({ title: 'Агенты в модели' }, secSeg.el),
    panel({ title: 'Входные данные', hint: 'дважды щёлкните название — сброс' }, S.I.el, S.T.el, S.Tr.el, S.G.el, S.Ex.el, S.Im.el),
    panel({ title: 'Поведение домохозяйств', hint: 'C = Ca + mpc · Yd', collapsible: true, open: false }, S.a0.el, S.mpc.el, strictTg.el),
    panel({ title: 'Показать' }, layerSeg.el, lblTg.el),
    panel({ title: 'Задания' }, pre));

  /* ── показатели ── */
  const R = {
    Y: stat({ label: 'Совокупный доход', sym: 'Y', unit: 'ден. ед.', size: 'l', color: 'var(--accent)' }),
    Yd: stat({ label: 'Располагаемый доход', sym: 'Yd', unit: 'ден. ед.', color: 'var(--d5)' }),
    C: stat({ label: 'Потребление', sym: 'C', unit: 'ден. ед.', color: 'var(--d1)' }),
    S: stat({ label: 'Сбережения', sym: 'S', unit: 'ден. ед.', color: 'var(--d4)' }),
    B: stat({ label: 'Бюджет (профицит +)', sym: 'B', unit: 'ден. ед.', color: 'var(--d3)' }),
    Nx: stat({ label: 'Чистый экспорт', sym: 'Nx', unit: 'ден. ед.', color: 'var(--d6)' }),
  };
  L.stats.append(...Object.values(R).map((x) => x.el));

  /* ── схема кругооборота ── */
  const host = h('div.ex11__host');
  const svg = el('svg', { class: 'ex11__svg', viewBox: `${VB.x} ${VB.y} ${VB.w} ${VB.h}`, role: 'group', 'aria-label': 'Схема кругооборота доходов, ресурсов и товаров' });
  svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible';
  host.append(svg);
  const gFlows = el('g', { class: 'ex11__flows' }), gLab = el('g', { class: 'ex11__labs' }), gBox = el('g', { class: 'ex11__boxes' });
  svg.append(gBox, gFlows, gLab);

  /* дом. рамки: блоки */
  const boxEl = {};
  Object.entries(BOX).forEach(([k, b]) => {
    const g = el('g', { class: `bx bx--${b.kind}`, tabindex: b.kind === 'agent' ? 0 : null, role: b.kind === 'agent' ? 'button' : null, 'aria-label': b.t.join(' ') + (b.kind === 'agent' ? ' — роль в модели' : '') }, gBox);
    g.style.setProperty('--c', b.c);
    el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.kind === 'market' ? 31 : 12 }, g);
    const t = el('text', { x: b.x + b.w / 2, y: b.y + b.h / 2, 'text-anchor': 'middle' }, g);
    b.t.forEach((line, i) => { const ts = el('tspan', { x: b.x + b.w / 2, dy: i === 0 ? (b.t.length === 1 ? '.35em' : '-.3em') : '1.15em' }, t); ts.textContent = line; });
    if (b.kind === 'agent') { const pick = () => { agent = k; renderAgent(); }; g.addEventListener('click', pick); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }); }
    boxEl[k] = g;
  });

  /* потоки */
  const defs = el('defs', {}, svg);
  const FLOWS = [];
  const mkFlow = (def, isReal) => {
    const g = el('g', { class: 'fl' + (isReal ? ' fl--real' : ''), tabindex: 0, role: 'button' }, gFlows);
    const hit = el('path', { class: 'fl__hit', fill: 'none' }, g);
    const body = el('path', { class: 'fl__b', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const dots = el('path', { class: 'fl__d', fill: 'none', 'stroke-linecap': 'round' }, g);
    const head = el('path', { class: 'fl__h', d: 'M0,0 L-11,-6.5 L-11,6.5 Z' }, g);
    const pill = el('g', { class: 'pl' }, gLab); const pr = el('rect', { rx: 9 }, pill); const pt = el('text', { 'text-anchor': 'middle' }, pill);
    const F = { def, isReal, g, hit, body, dots, head, pill, pr, pt, id: (isReal ? 'r_' : '') + def.id, on: false };
    g.addEventListener('pointerenter', () => setHov(F.id)); g.addEventListener('pointerleave', () => setHov(null)); g.addEventListener('focus', () => setHov(F.id)); g.addEventListener('blur', () => setHov(null));
    g.addEventListener('click', () => setHov(hov === F.id ? null : F.id));
    FLOWS.push(F); return F;
  };
  MONEY.forEach((d) => { mkFlow(d, false); if (d.real) mkFlow({ ...d, ...d.real, id: d.id, sym: d.real.sym, col: 'var(--d2)', pts: rev(d.pts), real: null, how: () => 'Реальный поток: стоимость товаров (ресурсов) равна денежному потоку навстречу', isRealDef: true, counter: d }, true); });

  const caption = h('p.ex11__cap', { 'aria-live': 'polite' });
  const figSvg = figure('Кругооборот потоков', h('div.ex11__wrap', host, caption), { note: 'Толщина стрелки пропорциональна величине потока. Наведите или коснитесь потока — появится пояснение; щёлкните по агенту — его роль.' });

  /* ── перекрёстная диаграмма ── */
  const chHost = h('div');
  const chart = createChart(chHost, {
    x: { min: 0, max: 4000, label: 'Y', ticks: [0, 1000, 2000, 3000, 4000] }, y: { min: 0, max: 4000, label: 'E', ticks: [0, 1000, 2000, 3000, 4000] },
    aspect: 1.5, maxH: 400, margin: { l: 56, r: 30, t: 28, b: 42 }, title: 'Кейнсианский крест: планируемые расходы и доход',
  });
  const lin = (f) => { f.linear = true; return f; };
  let top = 4000, cur = model(st);
  chart.line('45', { fn: lin((y) => y), from: 0, to: 4000, color: 'var(--ink-3)', width: 2, dash: '2 7', label: 'E = Y', labelAt: .88, labelDx: -50, labelDy: 26, glow: false, ghost: false });
  chart.line('ae', { fn: lin((y) => cur.A + st.mpc * y), from: 0, to: 4000, color: 'var(--d1)', width: 3.6, label: 'AE', labelAt: .94, labelDy: -14 });
  chart.point('eq', { x: () => cur.Y, y: () => cur.Y, color: 'var(--accent)', r: 7.5, pulse: true, guides: { x: 'Y_0', y: 'E_0' } });
  const crossFig = figure('Кейнсианский крест · равновесие', chHost, { note: 'AE = Ca + I + G + Nx − mpc·T + mpc·Y. Сдвиг линии вверх на ΔA даёт приращение дохода ΔA/(1 − mpc): это и есть мультипликатор.' });
  L.stage.append(figSvg, crossFig);
  L.stage.append(legend([{ color: 'var(--d1)', label: 'денежные потоки' }, { color: 'var(--d4)', label: 'сбережения и кредит' }, { color: 'var(--d5)', label: 'государство' }, { color: 'var(--d6)', label: 'заграница' }, { color: 'var(--d2)', label: 'товары и ресурсы', dash: true }]));

  /* ── заметки ── */
  const res = callout({ tone: 'accent', title: 'Результаты расчётов' });
  const bars = h('div.ex11__bal');
  const tbl = dtable({ cols: [{ key: 'k', label: 'Показатель', sym: true }, { key: 'a', label: 'Исходно', num: true }, { key: 'b', label: 'Сейчас', num: true }, { key: 'd', label: 'Изменение', num: true }] });
  const expl = callout({ tone: 'info', title: 'Как получен доход' });
  const agentCard = h('div.ex11__agent');
  L.notes.append(res, panel({ title: 'Утечки и инъекции', hint: 'в равновесии равны' }, bars), tbl.el, expl, panel({ title: 'Роль агента', hint: 'щёлкните по блоку на схеме' }, agentCard));

  /* ── роли агентов ── */
  const ROLES = {
    H: ['Домохозяйства', 'Владеют ресурсами (труд, капитал, земля) и продают их фирмам на рынке ресурсов — так возникает доход Y. Доход расходуется на потребление C, сбережения S и налоги T; при наличии государства домохозяйства получают трансферты Tr.', 2],
    F: ['Фирмы', 'Покупают ресурсы на рынке ресурсов (это их затраты и чужие доходы), производят товары и услуги и продают их на рынке товаров — выручка. Инвестиции I финансируются кредитами с финансового рынка: сбережения домохозяйств превращаются в заёмные средства.', 2],
    G: ['Государство', 'Собирает налоги T, выплачивает трансферты Tr и закупает товары и услуги G. Баланс бюджета B = T − G − Tr: при B < 0 дефицит покрывается займом на финансовом рынке, при B > 0 профицит направляется на финансовый рынок.', 3],
    W: ['Иностранный сектор', 'Покупает отечественные товары (экспорт Ex) и продаёт свои (импорт Im). Чистый экспорт Nx = Ex − Im: если Nx > 0, страна вывозит капитал (отток), если Nx < 0 — привлекает (приток капитала).', 4],
  };
  function renderAgent() {
    const r = ROLES[agent];
    agentCard.textContent = '';
    agentCard.append(h('h4', r[0]), h('p', nb(r[1])), h('p.ex11__act', st.sector >= r[2] ? nb('Участвует в выбранной модели.') : nb(`Появляется в модели с ${r[2]} секторами — выберите её слева.`)));
    Object.entries(boxEl).forEach(([k, g]) => g.classList.toggle('is-sel', k === agent));
  }

  /* ── размеры схемы / шрифты ── */
  let kf = 1;
  function onResize() {
    const w = host.clientWidth || 800; kf = clamp(VB.w / w, 0.9, 2.4);
    svg.classList.toggle('is-sm', w < 560);
    svg.style.setProperty('--k', kf.toFixed(3));
    gBox.querySelectorAll('text').forEach((t) => { t.style.fontSize = Math.min(13 * kf, 24).toFixed(1) + 'px'; });
    drawFlows();
  }
  const ro = new ResizeObserver(() => { if (Math.abs((host.clientWidth || 0) - lastW) > 1) { lastW = host.clientWidth; onResize(); } });
  let lastW = 0; ro.observe(host);

  /* ── обновление потоков ── */
  function drawFlows() {
    const m = cur, p = st, vmax = Math.max(1, m.Y);
    const rd = layer === 'real', both = layer === 'both';
    FLOWS.forEach((F) => {
      const d = F.def; let v = d.val(m);
      const secOn = d.sec <= p.sector;
      let vis = secOn && v > 0.4 && (F.isReal ? layer !== 'money' : layer !== 'real');
      if (F.isReal && d.counter) v = d.counter.val(m);
      F.on = vis; F.g.style.display = vis ? '' : 'none'; F.pill.style.display = vis && labelsOn ? '' : 'none';
      if (!vis) { F.vv = 0; return; }
      let pts = d.pts; const flipNow = d.flip ? d.flip(m) : false; if (flipNow) pts = rev(pts);
      const off = both ? 5.5 : 0; pts = offsetPts(pts, off);
      const w = (F.isReal ? 1.5 : 2.2) + (F.isReal ? 4.5 : 8.5) * Math.sqrt(clamp(v / vmax));
      const n = pts.length, last = pts[n - 1], prev = pts[n - 2];
      const ux = Math.sign(last[0] - prev[0]), uy = Math.sign(last[1] - prev[1]);
      const hk = 0.75 + w / 16;
      const shortLast = [last[0] - ux * 8 * hk, last[1] - uy * 8 * hk];
      const body = pts.slice(0, n - 1).concat([shortLast]);
      const D_ = pathD(body);
      const color = d.color ? d.color(m) : d.col;
      [F.hit, F.body, F.dots].forEach((n_) => n_.setAttribute('d', D_));
      F.hit.style.strokeWidth = Math.max(w + 8, 14 * kf) + 'px';
      F.body.style.stroke = color; F.body.style.strokeWidth = w.toFixed(2) + 'px';
      F.body.style.strokeDasharray = (F.isReal || (d.dashed && d.dashed(m, p))) ? '1 10' : 'none';
      F.body.style.opacity = F.isReal ? .85 : (d.dashed && d.dashed(m, p) ? .8 : .55);
      F.dots.style.strokeWidth = Math.max(1.6, w * 0.42).toFixed(2) + 'px';
      const ang = Math.atan2(uy, ux) * 180 / Math.PI;
      F.head.style.fill = color; F.head.setAttribute('transform', `translate(${last[0].toFixed(1)},${last[1].toFixed(1)}) rotate(${ang.toFixed(0)}) scale(${hk.toFixed(2)})`);
      F.vv = v; F.color = color; F.flipNow = flipNow;
      // подпись-таблетка
      const sym = F.isReal ? d.sym : d.sym;
      const txt = svg.classList.contains('is-sm') ? sym : `${sym} ${f0(v)}`;
      F.pt.textContent = txt; F.pt.style.fontSize = (10.5 * kf).toFixed(1) + 'px';
      const cw = (F.pt.style.fontSize ? parseFloat(F.pt.style.fontSize) : 11) * 0.62;
      const wpx = txt.length * cw + 14 * kf * 0.8, hpx = 17 * kf * 0.95;
      F.pr.setAttribute('width', wpx.toFixed(1)); F.pr.setAttribute('height', hpx.toFixed(1)); F.pr.setAttribute('x', (-wpx / 2).toFixed(1)); F.pr.setAttribute('y', (-hpx / 2).toFixed(1)); F.pr.setAttribute('rx', (hpx / 2).toFixed(1));
      F.pt.setAttribute('y', (hpx * 0.17).toFixed(1));
      const lab = d.lab; F.pill.setAttribute('transform', `translate(${lab[0] + (both ? (F.isReal ? 0 : 0) : 0)},${lab[1] + (both && F.isReal ? 0 : 0)})`);
      F.pill.style.setProperty('--c', color); F.pill.classList.toggle('pl--real', F.isReal);
      if (both && F.isReal) F.pill.style.display = 'none';
      const nm = typeof d.name === 'function' ? d.name(m) : d.name;
      F.g.setAttribute('aria-label', `${nm}: ${f1(v)} ден. ед.`);
    });
    boxEl.G.classList.toggle('is-off', p.sector < 3); boxEl.W.classList.toggle('is-off', p.sector < 4);
    setHov(hov, true);
  }

  function setHov(id, keep) {
    const F = FLOWS.find((f) => f.id === id && f.on);
    hov = F ? id : null;
    svg.classList.toggle('is-hov', !!F);
    FLOWS.forEach((f) => f.g.classList.toggle('is-hot', f === F));
    if (!F) { caption.textContent = ''; caption.append(h('span.ex11__hint', nb(layer === 'real' ? 'Товары и ресурсы идут навстречу деньгам — их стоимость равна.' : 'Доход → расходы → выручка → доход. Коснитесь потока — пояснение.'))); return; }
    const d = F.def, m = cur, nm = typeof d.name === 'function' ? d.name(m) : d.name;
    const from = typeof d.from === 'function' ? d.from(m) : d.from, to = typeof d.to === 'function' ? d.to(m) : d.to;
    const how = d.how ? d.how(m, st) : '';
    caption.textContent = '';
    caption.append(h('b', nm), h('span', `${F.isReal ? 'товары и ресурсы' : 'деньги'}: ${from} → ${to}`), h('strong', f1(F.vv) + ' ден. ед.'), how ? h('em', how) : null);
  }

  /* ── пересчёт и текст ── */
  function readState() { Object.keys(S).forEach((k) => (st[k] = S[k].value)); st.sector = secSeg.value; st.strict = strictTg.value; }
  function render() {
    if (!marked) base = { ...D, sector: st.sector };
    const m = cur = model(st), b = model(base);
    // доступность ползунков
    S.T.disable(st.sector < 3); S.Tr.disable(st.sector < 3); S.G.disable(st.sector < 3); S.Ex.disable(st.sector < 4); S.Im.disable(st.sector < 4);
    // показатели
    R.Y.set(m.Y); R.Yd.set(m.Yd); R.C.set(m.C); R.S.set(m.S); R.B.set(st.sector >= 3 ? m.B : NaN); R.Nx.set(st.sector >= 4 ? m.Nx : NaN);
    R.Y.base(b.Y); R.Yd.base(b.Yd); R.C.base(b.C); R.S.base(b.S); R.B.base(st.sector >= 3 && base.sector >= 3 ? b.B : null); R.Nx.base(st.sector >= 4 && base.sector >= 4 ? b.Nx : null);
    // результаты как в оригинале
    let txt = `Y = ${f0(m.Y)} ден. ед., Yd = ${f0(m.Yd)} ден. ед., C = ${f0(m.C)} ден. ед., S = ${f0(m.S)} ден. ед.`;
    if (st.sector >= 3) txt += `, B = ${f0(m.B)} ден. ед.`;
    if (st.sector >= 4) txt += `, Nx = ${f0(m.Nx)} ден. ед.`;
    if (st.sector >= 3) { if (m.B < 0) txt += ` Так как B < 0, то в экономике дефицит бюджета в размере ${f0(m.BD)} ден. ед. Покрытие происходит за счёт займа на финансовом рынке.`; else if (m.B > 0) txt += ` Профицит государственного бюджета составил ${f0(m.B)} ден. ед.`; }
    if (st.sector >= 4) { if (m.Nx < 0) txt += ` Приток капитала в размере ${f0(-m.Nx)} ден. ед.`; else if (m.Nx > 0) txt += ` Отток капитала в размере ${f0(m.Nx)} ден. ед.`; }
    res.querySelector('.co__b').textContent = nb(txt);
    // утечки и инъекции
    drawBalance(m);
    // таблица
    const rows = [['Совокупный доход Y', 'Y'], ['Располагаемый доход Yd', 'Yd'], ['Потребление C', 'C'], ['Сбережения S', 'S']];
    if (st.sector >= 3) rows.push(['Налоги T', 'T'], ['Госзакупки G', 'G'], ['Баланс бюджета B', 'B']);
    if (st.sector >= 4) rows.push(['Чистый экспорт Nx', 'Nx']);
    tbl.set(rows.map(([k, key]) => ({ k: k.replace(/ ([A-Za-z]+)$/, (_, s) => ' ' + s), a: f1(b[key]), b: f1(m[key]), d: sg(m[key] - b[key]) })));
    explain(m, b);
    // диаграмма
    const need = Math.max(m.Y, 800) * 1.28, STEPS = [1500, 2000, 3000, 4000, 6000, 8000, 12000, 20000, 40000], Hh = STEPS.find((v) => v >= need) || STEPS[STEPS.length - 1];
    if (Hh !== top) { top = Hh; const dm = [0, Hh]; chart.setDomain({ x: dm, y: dm }, true); chart.get('45').op.to = Hh; chart.get('ae').op.to = Hh; }
    chart.update();
    drawFlows(); renderAgent();
  }

  function drawBalance(m) {
    bars.textContent = '';
    const leak = [['S', m.S, 'var(--d4)']]; const inj = [['I', m.I, 'var(--d1)']];
    if (st.sector >= 3) { leak.push(['T', m.T, 'var(--d5)']); inj.push(['G', m.G, 'var(--d5)']); if (st.strict) inj.push(['Tr', m.Tr, 'var(--d3)']); }
    if (st.sector >= 4) { leak.push(['Im', m.Im, 'var(--d6)']); inj.push(['Ex', m.Ex, 'var(--d6)']); }
    const tot = Math.max(1, m.leak, m.inj);
    const mk = (title, items, sum) => h('div.ex11__brow', h('div.ex11__bh', h('b', title), h('i', f0(sum))), h('div.ex11__stack', ...items.map(([sy, v, c]) => h('span', { style: { '--g': Math.max(0.0001, v / tot).toFixed(4), '--c': c }, title: `${sy} = ${f0(v)}` }, v / tot > 0.07 ? sy : ''))),
      h('div.ex11__bl', items.map(([sy, v, c]) => h('span', { style: { '--c': c } }, h('i'), h('b', { html: symHTML(sy) }), ' ' + f0(v)))));
    const ok = Math.abs(m.leak - m.inj) < 1e-6;
    bars.append(mk('Утечки: S' + (st.sector >= 3 ? ' + T' : '') + (st.sector >= 4 ? ' + Im' : ''), leak, m.leak), mk('Инъекции: I' + (st.sector >= 3 ? ' + G' : '') + (st.strict && st.sector >= 3 ? ' + Tr' : '') + (st.sector >= 4 ? ' + Ex' : ''), inj, m.inj),
      h('p.ex11__ok', { class: ok ? 'is-ok' : '' }, ok ? nb('Утечки равны инъекциям — доход находится в равновесии.') : nb('Утечки и инъекции не равны.')));
  }

  function explain(m, b) {
    const k = 1 / m.k, p = st, sect = st.sector;
    const parts = [`${p.a0}`, `${f0(m.I)}`]; let sym = [symHTML('C_a'), 'I'];
    let num = `${f0(p.a0)} + ${f0(m.I)}`, form = `${symHTML('C_a')} + I`;
    if (sect >= 3) { num += ` + ${f0(m.G)}`; form += ' + G'; }
    if (sect >= 4) { num += ` + ${f0(m.Ex)} − ${f0(m.Im)}`; form += ' + Ex − Im'; }
    if (sect >= 3) { num += ` − ${fmt(p.mpc, 2)}·${f0(m.T)}`; form += ` − ${symHTML('mpc')}·T`; if (p.strict) { num += ` + ${fmt(p.mpc, 2)}·${f0(m.Tr)}`; form += ` + ${symHTML('mpc')}·Tr`; } }
    const dY = m.Y - b.Y; let why = '';
    const diffs = [['I', m.I - b.I, k, 'инвестиции'], ['G', m.G - b.G, k, 'госзакупки'], ['Ex', m.Ex - b.Ex, k, 'экспорт'], ['Im', m.Im - b.Im, -k, 'импорт'], ['T', m.T - b.T, -p.mpc * k, 'налоги'], ['Tr', p.strict ? m.Tr - b.Tr : 0, p.mpc * k, 'трансферты']].filter((x) => sect >= (x[0] === 'T' || x[0] === 'G' || x[0] === 'Tr' ? 3 : x[0] === 'Ex' || x[0] === 'Im' ? 4 : 2) && Math.abs(x[1]) > 1e-9);
    if (b.sector === st.sector && Math.abs(p.mpc - base.mpc) < 1e-9 && Math.abs(p.a0 - base.a0) < 1e-9 && diffs.length) {
      why = `<p>${nb('Изменение дохода по сравнению с исходным состоянием:')} ` + diffs.map((x) => `Δ${symHTML(x[0])} = ${sg(x[1])} → ${sg(x[1] * x[2])}`).join('; ') + `. ${nb('Итого')} ΔY = <b>${sg(dY)}</b>.</p>`;
      if (diffs.length === 1) { const x = diffs[0]; why += `<p>${nb(`Мультипликатор ${x[0] === 'T' ? 'налогов' : x[0] === 'Tr' ? 'трансфертов' : x[0] === 'Im' ? 'импорта' : 'расходов'} равен ${fmt(x[2], 2)}: ${x[0] === 'T' ? `налоги сначала снижают располагаемый доход на ΔT, но потребление падает лишь на ${fmt(p.mpc, 2)}·ΔT — остальное уходит из сбережений, поэтому множитель по модулю меньше, чем у G` : `каждая дополнительная денежная единица «${x[3]}» становится чьим-то доходом, из которого ${fmt(p.mpc, 2)} снова тратится на потребление; так цепочка расходов даёт ΔY = ΔA · 1/(1 − ${fmt(p.mpc, 2)}) = ΔA · ${fmt(k, 2)}`}.`)}</p>`; }
    } else if (b.sector !== st.sector) why = `<p>${nb('Число секторов изменилось, поэтому сравнивать приращения по отдельным статьям нельзя: смотрите таблицу «Исходно / Сейчас».')}</p>`;
    else why = `<p>${nb(`Мультипликатор автономных расходов 1/(1 − ${fmt(p.mpc, 2)}) = ${fmt(k, 2)}: приращение ΔG на 10 ден. ед. даёт ΔY = 10 · ${fmt(k, 2)} = ${f0(10 * k)} ден. ед. Нажмите «Госзакупки G +10».`)}</p>`;
    expl.querySelector('.co__t').textContent = 'Как получен доход';
    expl.querySelector('.co__b').innerHTML = `<p class="ex11__f">${symHTML('Y')} = (${form}) / (1 − ${symHTML('mpc')}) = (${num}) / ${fmt(m.k, 2)} = <b>${f0(m.Y)}</b></p>` + why;
  }

  /* ── события ── */
  const onChange = () => { readState(); render(); };
  Object.values(S).forEach((s) => s.on(onChange)); secSeg.on(onChange); strictTg.on(onChange);
  layerSeg.on((v) => { layer = v; drawFlows(); }); lblTg.on((v) => { labelsOn = v; drawFlows(); });
  readState(); render(); renderAgent();

  /* ── API рамки ── */
  function mark() { base = { ...st }; chart.snapshot(); marked = true; render(); }
  const api = {
    charts: [chart],
    compare() { mark(); },
    clearCompare() { chart.clearGhosts(); base = { ...D, sector: st.sector }; marked = false; render(); },
    reset() { chart.clearGhosts(); base = { ...D }; marked = false; Object.values(S).forEach((s) => s.reset(true)); secSeg.set(D.sector, { silent: true }); strictTg.set(false, { silent: true }); layerSeg.set('both', { silent: true }); layer = 'both'; lblTg.set(true, { silent: true }); labelsOn = true; hov = null; readState(); render(); },
    destroy() { ro.disconnect(); chart.destroy(); },
  };
  return api;
}

/* ── стили ─────────────────────────────────────────────────────── */
const css = `
.sim--ex1-1 .ex11__wrap { display: grid; gap: .6rem; }
.sim--ex1-1 .ex11__host { min-width: 0; }
.sim--ex1-1 .bx rect { fill: var(--surface-2); stroke: color-mix(in oklab, var(--c) 70%, transparent); stroke-width: 1.6; transition: opacity .3s, fill .3s, stroke-width .2s; }
.sim--ex1-1 .bx--market rect { stroke-dasharray: 5 5; fill: color-mix(in oklab, var(--c) 7%, var(--surface-2)); }
.sim--ex1-1 .bx--agent rect { fill: color-mix(in oklab, var(--c) 12%, var(--surface-2)); }
.sim--ex1-1 .bx text { fill: var(--ink); font-family: var(--f-sans); font-weight: 600; pointer-events: none; }
.sim--ex1-1 .bx--market text { font-weight: 500; fill: var(--ink-2); }
.sim--ex1-1 .bx--agent { cursor: pointer; outline: none; }
.sim--ex1-1 .bx--agent:hover rect, .sim--ex1-1 .bx--agent:focus-visible rect, .sim--ex1-1 .bx.is-sel rect { stroke-width: 3; stroke: var(--c); }
.sim--ex1-1 .bx.is-off { opacity: .28; }
.sim--ex1-1 .fl { cursor: pointer; outline: none; transition: opacity .3s; }
.sim--ex1-1 .fl__hit { stroke: transparent; }
.sim--ex1-1 .fl__b { transition: stroke-width .5s var(--ease), opacity .3s; }
.sim--ex1-1 .fl__d { stroke: var(--ink); stroke-dasharray: .1 15; opacity: .75; animation: ex11-flow 1.3s linear infinite; pointer-events: none; }
.sim--ex1-1 .fl--real .fl__d { stroke: var(--surface); opacity: .9; animation-duration: 1.7s; }
.sim--ex1-1 .fl__h { transition: fill .3s; }
.sim--ex1-1 .ex11__svg.is-hov .fl:not(.is-hot) { opacity: .16; }
.sim--ex1-1 .fl.is-hot .fl__b { opacity: 1; }
.sim--ex1-1 .pl rect { fill: var(--surface); stroke: var(--c); stroke-width: 1.4; }
.sim--ex1-1 .pl text { fill: var(--ink); font-family: var(--f-mono); font-weight: 600; pointer-events: none; font-variant-numeric: tabular-nums; }
.sim--ex1-1 .ex11__svg.is-hov .pl { opacity: .35; }
@keyframes ex11-flow { to { stroke-dashoffset: -15.1; } }
.reduce .sim--ex1-1 .fl__d, .sim--ex1-1 .reduce .fl__d { animation: none; }
@media (prefers-reduced-motion: reduce) { .sim--ex1-1 .fl__d { animation: none; } }
.sim--ex1-1 .ex11__cap { display: flex; flex-wrap: wrap; align-items: baseline; gap: .15rem .9rem; min-height: 2.6rem; padding: .5rem .8rem; border-radius: var(--r-s); background: var(--surface-2); border: 1px solid var(--line); font: 400 .84rem/1.4 var(--f-sans); color: var(--ink-2); }
.sim--ex1-1 .ex11__cap b { font-weight: 700; color: var(--ink); }
.sim--ex1-1 .ex11__cap strong { font: 700 .86rem/1 var(--f-mono); color: var(--accent); }
.sim--ex1-1 .ex11__cap em { flex-basis: 100%; font: italic 300 .9rem/1.35 var(--f-serif); color: var(--ink-3); }
.sim--ex1-1 .ex11__hint { font: italic 300 .9rem/1.35 var(--f-serif); color: var(--ink-3); }
.sim--ex1-1 .ex11__bal { display: grid; gap: .9rem; }
.sim--ex1-1 .ex11__brow { display: grid; gap: .35rem; }
.sim--ex1-1 .ex11__bh { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; font: 500 .86rem/1.2 var(--f-sans); color: var(--ink-2); }
.sim--ex1-1 .ex11__bh b { color: var(--ink); font-weight: 600; }
.sim--ex1-1 .ex11__bh i { font: 700 .95rem/1 var(--f-mono); font-style: normal; color: var(--ink); }
.sim--ex1-1 .ex11__stack { display: flex; gap: 2px; height: 1.6rem; border-radius: 7px; overflow: hidden; }
.sim--ex1-1 .ex11__stack span { flex: var(--g) 1 0; background: var(--c); min-width: 2px; display: grid; place-items: center; font: 700 .7rem/1 var(--f-mono); color: var(--ink-inv); overflow: hidden; transition: flex-grow .6s var(--ease); }
.sim--ex1-1 .ex11__bl { display: flex; flex-wrap: wrap; gap: .1rem 1rem; font: 500 .78rem/1.4 var(--f-mono); color: var(--ink-2); }
.sim--ex1-1 .ex11__bl span { display: inline-flex; align-items: baseline; gap: .3rem; }
.sim--ex1-1 .ex11__bl i { width: .6rem; height: .6rem; border-radius: 3px; background: var(--c); align-self: center; }
.sim--ex1-1 .ex11__bl b { font-family: var(--f-serif); font-style: italic; color: var(--ink); }
.sim--ex1-1 .ex11__ok { font: 500 .86rem/1.4 var(--f-sans); color: var(--bad); }
.sim--ex1-1 .ex11__ok.is-ok { color: var(--ok); }
.sim--ex1-1 .ex11__f { font: 500 .92rem/1.8 var(--f-sans); color: var(--ink); overflow-wrap: anywhere; }
.sim--ex1-1 .ex11__f b { font: 700 .95rem/1 var(--f-mono); color: var(--accent); }
.sim--ex1-1 .ex11__agent { display: grid; gap: .5rem; max-width: 70ch; }
.sim--ex1-1 .ex11__agent h4 { font: 600 1.05rem/1.2 var(--f-serif); color: var(--ink); text-transform: none; letter-spacing: 0; margin: 0; }
.sim--ex1-1 .ex11__agent p { font: 400 .94rem/1.55 var(--f-sans); color: var(--ink-2); }
.sim--ex1-1 .ex11__act { font: italic 300 .9rem/1.4 var(--f-serif) !important; color: var(--ink-3) !important; }
.sim--ex1-1 .is-off .sl__range { opacity: .4; }
@media (max-width: 520px) {
  .sim--ex1-1 .sim__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
  .sim--ex1-1 .st__num { font-size: 1.3rem; }
  .sim--ex1-1 .st--l .st__num { font-size: 1.8rem; }
  .sim--ex1-1 .st { padding-inline: .85rem .6rem; }
  .sim--ex1-1 .ex11__cap { min-height: 2.2rem; padding: .35rem .6rem; font-size: .76rem; }
}
`;
if (!document.getElementById('css-ex1-1')) { const s = document.createElement('style'); s.id = 'css-ex1-1'; s.textContent = css; document.head.append(s); }
