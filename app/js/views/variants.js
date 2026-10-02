/* Генератор вариантов из банка — #/teach/variants  (V3_PLAN §4.4)
   Чистая часть (parseParams / buildVariants) не касается DOM: её же использует print.js и Node-самотест. */
import { h, plural, toast, loadCSS } from '../core/dom.js';
import { bank as loadBank, seeded, shuffled, prepare } from '../core/qid.js';
import { S } from '../core/state.js';
import { seg, toggle } from '../ui/controls.js';
import { copyText, LET, keyOf } from '../ui/sheet.js';

/* ── параметры ─────────────────────────────────────────────── */
export const K_MIN = 5, K_MAX = 40, N_MAX = 8;
const TYPES = { mc: ['mc'], tf: ['mc', 'tf'], ms: ['mc', 'tf', 'ms'] };
export const projOK = (Q) => Q.q.length <= 160 && Q.a.every((o) => o.t.length <= 90);
const yymmdd = (d = new Date()) => String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
export const defaultSeed = () => yymmdd() + '-01';
const int = (v, a, b, d) => { const x = parseInt(v, 10); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };

/** query (строки) → полные параметры. rk — границы РК из настроек, по умолчанию РК1 = темы 1…7 */
export function parseParams(q = {}, bank, rk = [7, 14]) {
  const all = bank.topics;
  let topics = String(q.topics || '').split(/[,;.]/).map(Number).filter((n) => all.includes(n));
  topics = [...new Set(topics)].sort((a, b) => a - b);
  if (!topics.length) topics = all.filter((n) => n <= (rk[0] || 7));
  return {
    seed: String(q.seed || '').trim() || defaultSeed(),
    topics,
    k: int(q.k, K_MIN, K_MAX, 20),
    n: int(q.n, 1, N_MAX, 4),
    types: TYPES[q.types] ? q.types : 'mc',
    mix: q.mix === 'prop' ? 'prop' : 'eq',
    pj: q.pj === '1' || q.pj === 1 ? 1 : 0,
    ov: q.ov === '1' || q.ov === 1 ? 1 : 0,
    bk: q.bk ? String(q.bk) : '',
  };
}
export function toQuery(p, bank) {
  return { seed: p.seed, topics: p.topics.join(','), n: p.n, k: p.k, types: p.types, mix: p.mix, pj: p.pj ? 1 : '', ov: p.ov ? 1 : '', bk: bank ? bank.bk : p.bk };
}

/* ── ядро: детерминированная сборка ────────────────────────── */
/** пулы различных (по ukey) вопросов нужных типов по темам; один вопрос не попадает в пулы двух тем */
export function pools(bank, p) {
  const ok = new Set(TYPES[p.types]), seen = new Set(), out = new Map();
  p.topics.forEach((t) => out.set(t, bank.unique(t).filter((Q) => ok.has(Q.type) && (!p.pj || projOK(Q)) && !seen.has(Q.ukey) && (seen.add(Q.ukey), true))));
  return out;
}
/** сколько вопросов с каждой темы в каждый вариант (одинаково для всех вариантов — честный состав) */
export function quotas(sizes, k, mix, seed) {
  const T = [...sizes.keys()], total = T.reduce((a, t) => a + sizes.get(t), 0), tie = seeded(seed + ':quota');
  const rank = new Map(T.map((t) => [t, tie()]));
  let want = new Map();
  if (mix === 'prop' && total) {
    const raw = T.map((t) => [t, k * sizes.get(t) / total]);
    raw.forEach(([t, x]) => want.set(t, Math.floor(x)));
    let left = k - [...want.values()].reduce((a, b) => a + b, 0);
    raw.sort((a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1])) || rank.get(a[0]) - rank.get(b[0])).forEach(([t]) => { if (left > 0) { want.set(t, want.get(t) + 1); left--; } });
  } else {
    const base = Math.floor(k / T.length); T.forEach((t) => want.set(t, base));
    let left = k - base * T.length;
    [...T].sort((a, b) => sizes.get(b) - sizes.get(a) || rank.get(a) - rank.get(b)).forEach((t) => { if (left > 0) { want.set(t, want.get(t) + 1); left--; } });
  }
  // нехватка вопросов в теме → добираем из тем, где есть запас
  T.forEach((t) => want.set(t, Math.min(want.get(t), sizes.get(t))));
  let deficit = k - [...want.values()].reduce((a, b) => a + b, 0);
  while (deficit > 0) {
    const room = T.filter((t) => want.get(t) < sizes.get(t)).sort((a, b) => (sizes.get(b) - want.get(b)) - (sizes.get(a) - want.get(a)) || rank.get(a) - rank.get(b));
    if (!room.length) break;
    room.forEach((t) => { if (deficit > 0 && want.get(t) < sizes.get(t)) { want.set(t, want.get(t) + 1); deficit--; } });
  }
  return want;
}

/** → { variants:[{no, items:[{Q, key}]}], k, kWanted, avail, overlap, needOv, short, nMax, quota } */
export function buildVariants(bank, p) {
  const pl = pools(bank, p), sizes = new Map([...pl].map(([t, a]) => [t, a.length]));
  const avail = [...sizes.values()].reduce((a, b) => a + b, 0);
  const quota = quotas(sizes, p.k, p.mix, p.seed);
  const k = [...quota.values()].reduce((a, b) => a + b, 0);
  let overlap = 0, nMax = Infinity;
  const order = new Map();
  quota.forEach((q, t) => {
    const L = sizes.get(t);
    order.set(t, shuffled(pl.get(t), seeded(p.seed + ':pool:' + t)));
    if (q > 0) { nMax = Math.min(nMax, Math.floor(L / q)); const extra = p.n * q - L; if (extra > 0) overlap += Math.min(extra, L); }
  });
  if (!isFinite(nMax)) nMax = 0;
  const perm = shuffled([...Array(p.n).keys()], seeded(p.seed + ':vperm'));
  const variants = [];
  for (let v = 0; v < p.n; v++) {
    const slot = perm[v], rand = seeded(p.seed + ':' + (v + 1));
    let picked = [];
    quota.forEach((q, t) => { const L = order.get(t); for (let j = 0; j < q; j++) picked.push(L[(slot * q + j) % L.length]); });
    picked = shuffled(picked, rand);
    const items = picked.map((Q) => { const P = prepare(Q, rand); return { Q: P, key: keyOf(P) }; });
    variants.push({ no: v + 1, items });
  }
  return { variants, k, kWanted: p.k, avail, overlap, needOv: overlap > 0, short: k < p.k, nMax, quota };
}

/* ── экран ─────────────────────────────────────────────────── */
export async function load(ctx) {
  const [bank] = await Promise.all([loadBank(), loadCSS('app/css/v-teach.css')]);
  return { bank };
}

const hashFor = (p, bank, path = '/teach/variants') => '#' + path + '?' + Object.entries(toQuery(p, bank)).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v).replace(/%2C/g, ',')).join('&');
export { hashFor as variantHash };

export function mount(el, ctx, { bank }) {
  const rk = S.data.set.rk || [7, 14];
  const q0 = ctx.query || {};
  let p = parseParams(q0, bank, rk);
  let bkOld = q0.bk && q0.bk !== bank.bk ? q0.bk : '';
  let tab = 1;
  const touched = !!q0.seed;

  const out = h('div.tv-out'), warn = h('div.tv-warn');
  const topicsBox = h('div.tv-chips', { role: 'group', 'aria-label': 'Темы' });
  const chipBtn = (label, on, fn, aria) => { const b = h('button.chip', { type: 'button', 'aria-pressed': String(!!on), class: on ? 'is-on' : null, title: aria || null, onclick: fn }, label); return b; };
  const setTopics = (arr) => { p.topics = arr.length ? [...new Set(arr)].sort((a, b) => a - b) : p.topics; change(); drawTopics(); };
  function drawTopics() {
    topicsBox.replaceChildren(
      ...bank.topics.map((n) => chipBtn(String(n), p.topics.includes(n), () => setTopics(p.topics.includes(n) ? p.topics.filter((x) => x !== n) : [...p.topics, n]), 'Тема ' + n)),
    );
    const rk1 = bank.topics.filter((n) => n <= rk[0]), rk2 = bank.topics.filter((n) => n > rk[0] && n <= rk[1]);
    const same = (a) => a.length === p.topics.length && a.every((x, i) => x === p.topics[i]);
    quick.replaceChildren(chipBtn('РК1', same(rk1), () => setTopics(rk1), 'Темы 1–' + rk[0]), chipBtn('РК2', same(rk2), () => setTopics(rk2), 'Темы ' + (rk[0] + 1) + '–' + rk[1]), chipBtn('Все 14', p.topics.length === bank.topics.length, () => setTopics(bank.topics)));
  }
  const quick = h('div.tv-chips');

  const kIn = h('input.tv-num__in', { type: 'number', min: K_MIN, max: K_MAX, step: 1, value: p.k, inputmode: 'numeric', 'aria-label': 'Вопросов в варианте' });
  const kRange = h('input.tv-range', { type: 'range', min: K_MIN, max: K_MAX, step: 1, value: p.k, 'aria-label': 'Вопросов в варианте (ползунок)' });
  const setK = (v) => { p.k = int(v, K_MIN, K_MAX, p.k); kIn.value = kRange.value = p.k; change(); };
  kIn.addEventListener('change', () => setK(kIn.value)); kRange.addEventListener('input', () => setK(kRange.value));
  const nBox = h('div.tv-chips', { role: 'radiogroup', 'aria-label': 'Вариантов' });
  function drawN() { nBox.replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('button.chip', { type: 'button', role: 'radio', 'aria-checked': String(p.n === n), class: p.n === n ? 'is-on' : null, onclick: () => { p.n = n; if (tab > n) tab = n; change(); drawN(); } }, String(n)))); }
  const types = seg({ label: 'Типы вопросов', value: p.types, options: [{ v: 'mc', label: 'mc', hint: 'один верный ответ' }, { v: 'tf', label: '+ tf', hint: 'и «верно/неверно»' }, { v: 'ms', label: '+ ms', hint: 'и «несколько ответов»' }], onChange: (v) => { p.types = v; change(); } });
  const mix = seg({ label: 'Состав', value: p.mix, options: [{ v: 'eq', label: 'Поровну с темы', hint: 'одинаково с каждой темы' }, { v: 'prop', label: 'Пропорционально', hint: 'пропорционально числу вопросов темы в банке' }], onChange: (v) => { p.mix = v; change(); } });
  const seedIn = h('input.tv-in', { type: 'text', value: p.seed, 'aria-label': 'Зерно', spellcheck: 'false', autocomplete: 'off', maxlength: 40 });
  seedIn.addEventListener('input', () => { p.seed = seedIn.value.trim() || defaultSeed(); change(); });
  const reseed = () => { const d = yymmdd(), m = (S.data.teach.seedN = ((S.data.teach.seedN || 0) % 99) + 1); p.seed = d + '-' + String(m).padStart(2, '0'); seedIn.value = p.seed; change(); };
  const pj = toggle({ label: 'Фильтр для проектора', hint: 'вопрос до 160 знаков, варианты до 90', value: !!p.pj, onChange: (v) => { p.pj = v ? 1 : 0; change(); } });

  const poolInfo = h('p.tv-hint');
  const panel = h('form.tv-params.card', { onsubmit: (e) => e.preventDefault(), 'aria-label': 'Параметры набора' },
    h('div.tv-f', h('span.tv-l', 'Темы'), topicsBox, quick),
    h('div.tv-f.tv-f--row', h('label.tv-l', { for: 'tv-k' }, 'Вопросов в варианте'), h('div.tv-num', kIn, kRange)),
    h('div.tv-f', h('span.tv-l', 'Вариантов'), nBox),
    h('div.tv-f', types.el), h('div.tv-f', mix.el),
    h('div.tv-f', h('label.tv-l', { for: 'tv-seed' }, 'Зерно'), h('div.tv-seed', seedIn, h('button.btn.btn--sm', { type: 'button', onclick: reseed }, 'Другое')), h('p.tv-hint', 'Одно зерно — один и тот же набор у любого, у кого та же версия банка.')),
    h('div.tv-f', pj.el), poolInfo);
  kIn.id = 'tv-k'; seedIn.id = 'tv-seed';

  let res = null;
  function change() {
    p.bk = bank.bk; bkOld = '';
    try { history.replaceState(null, '', hashFor(p, bank)); } catch (e) { /* */ }
    S.data.teach.last = { kind: 'variants', seed: p.seed, href: hashFor(p, bank), at: Date.now() }; S.save();
    render();
  }

  function render() {
    res = buildVariants(bank, p);
    const total = [...pools(bank, p).values()].reduce((a, b) => a + b.length, 0);
    poolInfo.textContent = `В выбранных темах ${total} ${plural(total, ['подходящий различный вопрос', 'подходящих различных вопроса', 'подходящих различных вопросов'])}.`;
    warn.replaceChildren();
    const W = (tone, title, ...kids) => warn.append(h('aside.co.co--' + tone, { role: tone === 'bad' ? 'alert' : null }, h('strong.co__t', title), ...kids));
    if (bkOld) W('warn', 'Банк вопросов изменился с момента создания набора', h('p', `Ссылка создана при версии банка ${bkOld}, сейчас ${bank.bk}. Набор может отличаться от напечатанного раньше. Если нужна старая бумага — сверяйте по ключу, который печатался вместе с вариантами.`));
    if (res.short) W('warn', `В выбранных темах только ${res.avail} подходящих вопросов`, h('p', `Вариант получится короче заказанных ${p.k}: ${res.k} вопр. Добавьте темы или снимите фильтр.`));
    if (res.needOv && !p.ov) {
      W('warn', `Варианты будут пересекаться по ${res.overlap} ${plural(res.overlap, ['вопросу', 'вопросам', 'вопросам'])}`,
        h('p', res.nMax >= 1 ? `Без повторов банк темы выдержит ${res.nMax} ${plural(res.nMax, ['вариант', 'варианта', 'вариантов'])} по ${res.k} вопросов. Уменьшите число вопросов или вариантов, добавьте темы — или разрешите пересечения.` : 'Вопросов выбранных тем не хватает даже на один вариант без повторов. Добавьте темы или уменьшите число вопросов.'),
        h('div.tv-act', h('button.btn.btn--sm', { type: 'button', onclick: () => { p.ov = 1; change(); } }, 'Разрешить пересечения')));
    } else if (res.needOv) {
      W('info', `Варианты пересекаются по ${res.overlap} ${plural(res.overlap, ['вопросу', 'вопросам', 'вопросам'])}`, h('p', 'Пересечения разрешены. Соседям по парте лучше раздавать разные варианты.'), h('div.tv-act', h('button.btn.btn--sm', { type: 'button', onclick: () => { p.ov = 0; change(); } }, 'Запретить пересечения')));
    }
    drawOut();
  }

  function drawOut() {
    const blocked = res.needOv && !p.ov;
    out.replaceChildren();
    if (blocked || !res.k) { out.append(h('div.tv-empty', blocked ? 'Решите вопрос с пересечениями — и варианты появятся здесь.' : 'Выберите темы, чтобы получить варианты.')); return; }
    const q = hashFor({ ...p, ov: res.needOv ? 1 : p.ov }, bank, '').slice(1);          // «?seed=…»
    const pr = (kind, arg) => '#/print/' + kind + (arg ? '/' + arg : '') + q;
    const link = location.origin + location.pathname + hashFor(p, bank);
    const tabs = h('div.tabs.tv-tabs', { role: 'tablist', 'aria-label': 'Варианты' }, ...res.variants.map((v) => h('button', { type: 'button', role: 'tab', id: 'tv-t' + v.no, 'aria-selected': String(v.no === tab), 'aria-controls': 'tv-pane', tabindex: v.no === tab ? 0 : -1, onclick: () => { tab = v.no; drawOut(); out.querySelector('[role=tab][aria-selected=true]').focus(); } }, 'Вариант ' + v.no)));
    tabs.addEventListener('keydown', (e) => { if (!/Arrow(Left|Right)/.test(e.key)) return; e.preventDefault(); tab = Math.min(res.variants.length, Math.max(1, tab + (e.key === 'ArrowRight' ? 1 : -1))); drawOut(); out.querySelector('[role=tab][aria-selected=true]').focus(); });
    const V = res.variants[tab - 1];
    const act = h('div.tv-bar',
      h('a.btn.btn--primary.btn--sm', { href: pr('variant', 'all'), target: '_blank', rel: 'noopener' }, 'Печать вариантов'),
      h('a.btn.btn--sm', { href: pr('key'), target: '_blank', rel: 'noopener' }, 'Печать ключа'),
      h('a.btn.btn--sm', { href: pr('blank'), target: '_blank', rel: 'noopener' }, 'Бланк ответов'),
      h('button.btn.btn--sm', { type: 'button', onclick: async () => { const ok = await copyText(link); toast(ok ? 'Ссылка на набор скопирована' : 'Не удалось скопировать — выделите ссылку вручную'); } }, 'Ссылка на этот набор'));
    const list = h('ol.tv-q', ...V.items.map((it, i) => h('li.tv-qi',
      h('p.tv-qt', it.Q.q, it.Q.type === 'ms' ? h('em.tv-ms', ' Отметьте все верные.') : null),
      h('ol.tv-opts', { class: it.Q.type === 'tf' ? 'is-tf' : null }, ...it.Q.a.map((o, k) => h('li', { 'data-l': LET[k] }, h('span', it.Q.type === 'tf' ? o.t.replace(/^ложь$/i, 'Неверно') : o.t)))))));
    const key = h('aside.tv-key.card', { 'aria-label': 'Ключ варианта ' + V.no },
      h('h3.tv-key__h', 'Ключ · вариант ' + V.no),
      h('ol.tv-key__g', ...V.items.map((it) => h('li', h('b', it.key)))),
      h('p.tv-hint', 'Только для преподавателя: ключ напечатается отдельным листом.'));
    out.append(h('div.tv-top', tabs, h('span.tv-meta.mono', `${res.k} ${plural(res.k, ['вопрос', 'вопроса', 'вопросов'])} · зерно ${p.seed} · банк ${bank.bk}`)), act,
      h('div.tv-body', { id: 'tv-pane', role: 'tabpanel', 'aria-labelledby': 'tv-t' + tab }, h('div.tv-list.card', list, h('a.btn.btn--sm.tv-one', { href: pr('variant', String(tab)), target: '_blank', rel: 'noopener' }, 'Печать варианта ' + tab)), key),
      h('div.tv-link', h('label.tv-l', { for: 'tv-link' }, 'Ссылка на этот набор'), h('input.tv-in', { id: 'tv-link', readonly: true, value: link, onfocus: (e) => e.target.select() })));
  }

  drawTopics(); drawN();
  el.append(h('div.tv.wrap',
    h('header.th-head',
      h('nav.crumbs', h('a', { href: '#/teach' }, 'Преподавателю'), h('i', '/'), h('span', 'Варианты')),
      h('h1.h1', 'Варианты ', h('em', 'из банка')),
      h('p.lede', 'Одно зерно — один набор. Вопросы без повторов, ключ считается из банка, печать — чёрно-белая на A4.')),
    h('div.tv-grid', panel, h('div.tv-main', warn, out))));
  render();
  if (!touched) { /* не пишем в ссылку, пока преподаватель ничего не менял */ }
  return { title: 'Варианты', destroy() {} };
}
