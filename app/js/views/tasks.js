/* ─────────────────────────────────────────────────────────────
   Tasks — #/tasks (all topics) and #/tasks/:topic (one topic, ?t=3.2 picks the task)
   • numeric answer fields live inside the task text (data-k="v1"…), checked with a tolerance
   • hint, step-by-step solution (broken-up source paragraphs are re-flowed into readable steps)
   • progress: store tasks.done.<1_1> = timestamp, tasks.st.<1_1> = { a:{v1:"415"}, n:tries, s:solution seen }
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, loadCSS, fmt, plural, reduced, toast } from '../core/dom.js';
import { index, tasks } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { TOPICS, icon, rub } from '../data/topics.js';
import { callout } from '../ui/controls.js';

const svgIn = (inner, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ico = (inner) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: inner });
const P_R = '<path d="M5 12h14M13 6l6 6-6 6"/>', P_L = '<path d="M19 12H5M11 6l-6 6 6 6"/>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5L19.5 7"/></svg>';
const kid = (id) => String(id).replace('.', '_');
const NB = ' ';
const words = (n) => n + NB + plural(n, ['задача', 'задачи', 'задач']);

/* ── store helpers ───────────────────────────────────────────── */
const isDone = (id) => !!store.get('tasks.done.' + kid(id));
const stOf = (id) => store.get('tasks.st.' + kid(id), null) || { a: {}, n: 0 };
const saveSt = (id, st) => store.set('tasks.st.' + kid(id), st);
function doneCount(list) { return list.filter((t) => isDone(t.id)).length; }

/* ── source patches ──────────────────────────────────────────────
   Some tasks lost their answer fields in conversion (or carry a broken table); put them back
   so that every key in `answers` has a field. */
const INP = (k, extra = '') => `<input class="ans ans--inline" data-k="${k}" inputmode="decimal" autocomplete="off" aria-label="Ответ ${k.slice(1)}"${extra}>`;
/* price/quantity tables lost their two-level header (and 2.3/2.4 have a junk row) */
const priceTbl = (s) => s.replace(/<tr><th>([^<]+)<\/th><th>([^<]+)<\/th><th>([^<]+)<\/th><\/tr><tr><td>(цена[^<]*)<\/td><td>(количество[^<]*)<\/td><td>цена[^<]*<\/td><td>количество[^<]*<\/td>(?:<td>.*?)?<\/tr>/,
  (m, a, b, c, p, q) => `<thead><tr><th rowspan="2">${a}</th><th colspan="2">${b}</th><th colspan="2">${c}</th></tr><tr><th>${p}</th><th>${q}</th><th>${p}</th><th>${q}</th></tr></thead>`);
const PATCH = {
  '2.2': priceTbl, '2.3': priceTbl, '2.4': priceTbl,
  '8.1': (s) => s.replace('<th>Норма обязательного', '<th rowspan="2">Норма обязательного').replace('<th>Денежный мультипликатор', '<th rowspan="2">Денежный мультипликатор').replace('<th>Максимальный объем', '<th colspan="2">Максимальный объем'),
  '1.2': (s) => s.replace(/<p>г\) Объем НД:<\/p>\s*<p>ден\. единиц<\/p>/, `<p>г) Объем НД: ${INP('v4')} ден. единиц</p>`),
  '8.2': (s) => s.replace(/(R\s*<sub>факт<\/sub>\s*=)/, `$1 ${INP('v1')}`),
  '9.2': (s) => s.replace(/Δ<i>у<\/i>\s*=;\s*Δ<i>К<\/i>\s*=/, `Δ<i>y</i> = ${INP('v2')}; Δ<i>K</i> = ${INP('v3')}`),
  '13.1': (s) => s
    .replace(/<i>e<\/i>\s*=\s*\n/, `<i>e</i> = ${INP('v1')}\n`)
    .replace(/Вложения внутри страны<br>Чистый экспорт капитала/, `Вложения внутри страны: ${INP('v2')}<br>Чистый экспорт капитала: ${INP('v3')}`),
  '13.2': (s) => s
    .replace(/<i>y<\/i>\s*=;\s*<i>NE<\/i>\s*=;\s*<i>NKE<\/i>\s*=;/, `<i>y</i> = ${INP('v1')}; <i>NE</i> = ${INP('v2')}; <i>NKE</i> = ${INP('v3')};`)
    .replace(/<i>y<\/i>\s*=;\s*Δ<i>M<\/i>\s*=/, `<i>y</i> = ${INP('v4')}; Δ<i>M</i> = ${INP('v5')}`),
  /* 9.1: two balance sheets were flattened into text; rebuild them as real tables */
  '9.1': (s) => {
    const side = (cap, rows, total) => `<table><caption>${cap}</caption><tbody>${rows.map(([n, v]) => `<tr><th scope="row">${n}</th><td>${v}</td></tr>`).join('')}<tr class="is-total"><th scope="row">Всего</th><td>${total}</td></tr></tbody></table>`;
    const bal = (c) => `<div class="tk-bal">${side('Актив', [['Обязательные резервы', c[0]], ['Избыточные резервы', c[2]], ['Облигации', c[4]], ['Кредиты', c[6]]], c[8])}${side('Пассив', [['Бессрочные депозиты', c[1]], ['Срочные депозиты', c[3]], ['Собственный капитал', c[5]]], c[9])}</div>`;
    const t1 = bal([280, 1000, 100, 800, 620, 50, 850, '', 1850, 1850]);
    const t2 = bal([INP('v3'), INP('v4'), INP('v5'), INP('v6'), INP('v7'), INP('v8'), INP('v9'), '', INP('v10'), INP('v11')]);
    return s
      .replace(/(\(млн руб\.\)\.)[\s\S]*?<br>(Для бессрочных)/, (m0, a, b) => a + '</p>' + t1 + '<p>' + b)
      .replace(/<p>Актив\s*Пассив[\s\S]*?Всего\s*Всего<\/p>\s*$/, () => t2);
  },
};
/* the source has 1850 for the second «Всего» of the new balance; both totals are 2100 */
const ANSWER_FIX = { '9.1': { v11: 2100 } };

/* ── answer checking ─────────────────────────────────────────── */
export function parseNum(t) {
  const s = String(t).trim().replace(/[\s  ]/g, '').replace(/[−–—‒]/g, '-').replace(/%$/, '').replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
}
const decimals = (a) => { const s = String(a); return s.includes('.') ? s.split('.')[1].length : 0; };
export function matches(v, a) {
  if (!Number.isFinite(v)) return false;
  const tol = 0.5 * Math.pow(10, -decimals(a)) + Math.abs(a) * 0.001;
  return Math.abs(v - a) <= tol + 1e-9;
}

/* ── solution re-flow ────────────────────────────────────────────
   The converted solutions are chopped into one <p> per formula fragment ("y", "= 250 + 75 …").
   Glue the fragments back into sentences/formulas, then group into steps. */
const plainOf = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); };
const SUBVAR = /^[A-Za-zΔδ]{1,3}$/;
export function reflow(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const blocks = [];                 // { html, plain } | { fig }
  let cur = '', curPlain = '', last = '';
  const flush = () => { if (curPlain) blocks.push({ html: cur.trim().replace(/<\/sub>\s*<sub>/g, '').replace(/=&gt;/g, '⇒'), plain: curPlain }); cur = ''; curPlain = ''; last = ''; };
  [...tpl.content.children].forEach((n) => {
    if (n.tagName !== 'P') { flush(); blocks.push({ fig: n.outerHTML }); return; }
    let s = n.innerHTML.replace(/\s+/g, ' ').trim(); let pl = plainOf(s);
    if (!pl) return;
    if (/^[A-Za-zΔδ]$/.test(pl) && !/<(i|sub)>/.test(s)) s = '<i>' + s + '</i>';             // lone variable → italic
    if (!cur) { cur = s; curPlain = pl; last = pl; return; }
    const endsSentence = /[.;!?:…]$/.test(curPlain);
    const item = /^(\d+[).]|[а-яa-z]\)|[0-9]+\)\.?)\s/i.test(pl);
    if (endsSentence || item) { flush(); cur = s; curPlain = pl; last = pl; return; }
    // subscripts that were broken out of the line: "y" + "0" → y₀,  "y" + <i>v</i> → y_v
    let glue = ' ';
    if (SUBVAR.test(last)) {
      const mi = s.match(/^<i>([A-Za-z0-9]{1,3})<\/i>$/);
      if (mi || /^\d{1,2}$/.test(pl)) { s = '<sub>' + (mi ? mi[1] : pl) + '</sub>'; glue = ''; }
      else if (/^\d(?=\s*[:=,.;)]|$)/.test(pl) && !/^\d[\d,.]/.test(pl)) { s = s.replace(/^(\d)/, '<sub>$1</sub>'); glue = ''; }
    }
    if (glue && /[\d]$/.test(last) && /^[A-Za-z]{1,2}$/.test(pl)) glue = '';       // 0,5 y → 0,5y
    if (glue && (/^[,.;:)%]/.test(pl) || /\($/.test(last))) glue = '';
    cur += glue + s; curPlain += glue + pl; last = pl;
  });
  flush();
  // group into steps: a line that ends with a colon takes the next block as its display formula
  const steps = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.fig) { steps.push({ fig: b.fig }); continue; }
    const step = { ps: [b.html] };
    const nb = blocks[i + 1];
    if (/:$/.test(b.plain) && nb && !nb.fig && (nb.plain.match(/[А-Яа-яЁё]/g) || []).length < 8) { step.eq = nb.html; i++; }
    steps.push(step);
  }
  return steps;
}
const stepHTML = (s) => s.fig ? `<div class="tk-img">${s.fig}</div>` : s.ps.map((p) => `<p>${p}</p>`).join('') + (s.eq ? `<p class="tk-eq">${s.eq}</p>` : '');

/* ── load ────────────────────────────────────────────────────── */
export async function load() {
  await loadCSS('app/css/v-tasks.css');
  const [ix, all] = await Promise.all([index(), tasks()]);
  const list = all.map((t) => {
    const p = PATCH[t.id];
    return Object.assign({}, t, { html: p ? p(t.html) : t.html, answers: Object.assign({}, t.answers, ANSWER_FIX[t.id] || {}) });
  });
  const byTopic = new Map();
  list.forEach((t) => { (byTopic.get(t.topic) || byTopic.set(t.topic, []).get(t.topic)).push(t); });
  return { ix, list, byTopic };
}

export function mount(el, ctx, data) {
  const offs = [];
  const root = h('div.tk');
  el.append(root);
  const topic = ctx.params.topic ? +ctx.params.topic : 0;
  let inst;
  if (topic && data.byTopic.has(topic)) inst = topicView(root, ctx, data, topic, offs);
  else inst = indexView(root, data, offs);
  offs.push(enhance(el));
  return {
    title: inst.title,
    update: inst.update,
    destroy() { inst.destroy && inst.destroy(); offs.forEach((f) => { try { f && f(); } catch (e) { /* ignore */ } }); },
  };
}

/* ═══ index: every topic ═══════════════════════════════════════ */
function indexView(root, { ix, list, byTopic }, offs) {
  const total = list.length, done = doneCount(list);
  const firstOpen = list.find((t) => !isDone(t.id)) || list[0];
  const tries = list.reduce((a, t) => a + stOf(t.id).n, 0);
  const ring = h('div.ring.tk-bigring', { style: { '--p': 0, '--s': '7.4rem' }, role: 'img', 'aria-label': `Решено ${done} из ${total}` }, h('b.num', done), h('small', 'из ' + total));
  root.append(
    h('header.wrap.tk-head',
      h('div.tk-head__t',
        h('p.eyebrow.eyebrow--dot', 'Практикум · ' + words(total)),
        h('h1.h1', { html: 'Посчитайте — <em>мы проверим</em>' }),
        h('p.lede', 'Задачи по всем четырнадцати темам: впишите числа, получите проверку по каждому полю, при затруднении откройте подсказку и пошаговое решение.'),
        h('div.tk-head__a',
          h('a.btn.btn--primary', { href: '#/tasks/' + firstOpen.topic + '?t=' + firstOpen.id }, done ? 'Продолжить: задача ' + firstOpen.id : 'Начать с задачи 1.1', ico(P_R)),
          h('a.btn', { href: '#/tests' }, 'К тестам'))),
      h('div.tk-head__s', ring,
        h('div.tk-head__m', h('b', 'Ваш прогресс'), h('span', done ? `Решено ${done} из ${total}` : 'Пока ничего не решено'), h('span.muted', tries ? tries + NB + plural(tries, ['проверка', 'проверки', 'проверок']) : 'проверок ещё не было')))),
    h('section.wrap.tk-grid', { 'aria-label': 'Темы' },
      ...ix.topics.filter((tp) => byTopic.has(tp.n)).map((tp, i) => topicTile(tp, byTopic.get(tp.n), i))));
  // animate the ring after layout
  const to = total ? done / total : 0;
  requestAnimationFrame(() => requestAnimationFrame(() => animateRing(ring, to, done, offs)));
  return { title: 'Задачи' };
}

function animateRing(ring, to, n, offs) {
  if (reduced() || to === 0) { ring.style.setProperty('--p', to); return; }
  const t0 = performance.now(), D = 1100; let raf = 0;
  const f = (t) => { const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3); ring.style.setProperty('--p', (to * e).toFixed(4)); raf = p < 1 ? requestAnimationFrame(f) : 0; };
  raf = requestAnimationFrame(f); offs.push(() => cancelAnimationFrame(raf));
}

function topicTile(tp, list, i) {
  const m = TOPICS[tp.n], d = doneCount(list);
  return h('a.card.tk-tile.rv', { href: '#/tasks/' + tp.n, style: { '--c': 'var(--' + m.c + ')', '--d': (i % 3) * .07 + 's' }, 'aria-label': `Тема ${tp.n}. ${m.short}: ${words(list.length)}, решено ${d}` },
    h('span.tk-tile__n', rub(tp.n)),
    h('span.tk-tile__ic', { html: icon(tp.n) }),
    h('div.tk-tile__b', h('h2.tk-tile__t', m.short), h('p.tk-tile__p', m.tag)),
    h('div.tk-tile__f',
      h('span.tk-tile__c', words(list.length)),
      h('span.tk-tile__d', d === list.length ? 'решено всё' : d ? `решено ${d}` : 'не начато')),
    h('div.tk-dots', { 'aria-hidden': 'true' }, ...list.map((t) => h('i', { class: isDone(t.id) ? 'is-on' : '' }, h('b', t.n)))));
}

/* ═══ one topic ════════════════════════════════════════════════ */
function topicView(root, ctx, { ix, list, byTopic }, topic, offs) {
  const items = byTopic.get(topic);
  const tp = ix.byTopic.get(topic), m = TOPICS[topic];
  const topics = [...byTopic.keys()].sort((a, b) => a - b);
  const prevT = topics[topics.indexOf(topic) - 1], nextT = topics[topics.indexOf(topic) + 1];
  let curId = null, card = null, cardCtl = null;

  const ring = h('div.ring', { style: { '--s': '3.4rem', '--p': 0 } }, h('b.num'));
  const sub = h('span.tk-sub');
  const tabs = h('nav.tabs.tk-tabs', { 'aria-label': 'Задачи темы' });
  const stage = h('div.tk-stage');
  const foot = h('nav.wrap.tk-foot', { 'aria-label': 'Дальше' });

  const refreshHead = () => {
    const d = doneCount(items);
    ring.style.setProperty('--p', d / items.length);
    $('.num', ring).textContent = d + '/' + items.length;
    ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `Решено ${d} из ${items.length}`);
    sub.textContent = d === items.length ? 'Тема пройдена' : d ? `Решено ${d} из ${items.length}` : words(items.length);
    $$('a', tabs).forEach((a) => a.classList.toggle('is-done', isDone(a.dataset.id)));
  };

  root.append(
    h('div.wrap.tk-top', h('nav.crumbs', { 'aria-label': 'Навигация' }, h('a', { href: '#/tasks' }, 'Задачи'), h('i', '/'), h('span', 'Тема ' + topic)),
      h('div.tk-top__l',
        prevT ? h('a.btn.btn--sm.btn--quiet', { href: '#/tasks/' + prevT, title: 'Тема ' + prevT, 'aria-label': 'Предыдущая тема' }, ico(P_L), 'Тема ' + prevT) : null,
        nextT ? h('a.btn.btn--sm.btn--quiet', { href: '#/tasks/' + nextT, title: 'Тема ' + nextT, 'aria-label': 'Следующая тема' }, 'Тема ' + nextT, ico(P_R)) : null)),
    h('header.wrap.tk-thead', { style: { '--c': 'var(--' + m.c + ')', '--tc': 'var(--' + m.c + ')' } },
      h('div.tk-thead__t',
        h('p.eyebrow.eyebrow--dot', 'Тема ' + rub(topic) + ' · задачи'),
        h('h1.h1.tk-thead__h', m.short),
        h('p.lede', tp ? tp.title : m.tag)),
      h('div.tk-thead__s', h('span.tk-thead__ic', { html: icon(topic) }), h('div.tk-thead__r', ring, sub))),
    h('div.wrap.tk-picker', tabs),
    h('div.wrap', stage),
    foot);

  items.forEach((t) => {
    tabs.append(h('a', { href: '#/tasks/' + topic + '?t=' + t.id, 'data-id': t.id, title: 'Задача ' + t.id }, h('span.tk-tab__n', t.n), h('span.tk-tab__t', 'Задача ' + t.n), h('i.tk-tab__ok', { html: CHECK })));
  });

  function select(id, first) {
    const t = items.find((x) => x.id === id) || items[0];
    if (card && curId === t.id) return;
    curId = t.id;
    $$('a', tabs).forEach((a) => { const on = a.dataset.id === t.id; a.setAttribute('aria-current', on ? 'true' : 'false'); if (on) a.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    cardCtl && cardCtl.destroy();
    stage.replaceChildren();
    cardCtl = taskCard(t, { topic, onChange: refreshHead, items, nextT, m });
    card = cardCtl.el; stage.append(card);
    if (!first && !reduced()) { card.classList.add('is-in'); }
    // foot nav
    const i = items.indexOf(t), nx = items[i + 1], pv = items[i - 1];
    foot.replaceChildren(
      pv ? h('a.card.tk-fa', { href: '#/tasks/' + topic + '?t=' + pv.id }, h('small', '← Предыдущая'), h('b', 'Задача ' + pv.id)) : h('a.card.tk-fa', { href: '#/tasks' }, h('small', '← Все темы'), h('b', 'К списку тем')),
      nx ? h('a.card.tk-fa.is-next', { href: '#/tasks/' + topic + '?t=' + nx.id }, h('small', 'Следующая →'), h('b', 'Задача ' + nx.id))
        : nextT ? h('a.card.tk-fa.is-next', { href: '#/tasks/' + nextT }, h('small', 'Следующая тема →'), h('b', 'Тема ' + nextT + ' · ' + TOPICS[nextT].short))
          : h('a.card.tk-fa.is-next', { href: '#/tests' }, h('small', 'Закрепить →'), h('b', 'Перейти к тестам')));
    store.last('#/tasks/' + topic + '?t=' + t.id, 'Задача ' + t.id);
  }

  refreshHead();
  select(ctx.query.t, true);
  const offStore = store.on('change', (p) => { if (/^tasks\.done/.test(p)) refreshHead(); });
  offs.push(offStore);
  return {
    title: 'Задачи · тема ' + topic,
    update(c) { select(c.query.t); },
    destroy() { cardCtl && cardCtl.destroy(); },
  };
}

/* ═══ one task ═════════════════════════════════════════════════ */
function taskCard(t, { topic, onChange, items, nextT, m }) {
  const st = stOf(t.id);
  const keys = Object.keys(t.answers);
  let timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };

  /* body: the converted markup, with the answer fields in place */
  const body = h('div.tk-body', { html: t.html });
  const inputs = $$('input[data-k]', body);
  // keys without a field in the text → put them in an extra row
  const have = new Set(inputs.map((i) => i.dataset.k));
  const orphans = keys.filter((k) => !have.has(k));
  if (orphans.length) {
    const extra = h('div.tk-extra', h('p.tk-extra__t', 'Остальные ответы'));
    orphans.forEach((k, i) => {
      const inp = h('input.ans', { 'data-k': k, inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Ответ ' + k.slice(1), id: 'tk-' + kid(t.id) + '-' + k });
      extra.append(h('label.tk-extra__f', h('span', 'Ответ ' + (keys.indexOf(k) + 1)), inp)); inputs.push(inp);
    });
    body.append(extra);
  }
  // numbered badge for each field
  inputs.forEach((inp) => {
    const n = keys.indexOf(inp.dataset.k) + 1;
    inp.setAttribute('aria-label', 'Ответ ' + n + ' из ' + keys.length);
    inp.setAttribute('enterkeyhint', 'done'); inp.setAttribute('spellcheck', 'false');
    inp.placeholder = '?';
    if (st.a[inp.dataset.k] != null) inp.value = st.a[inp.dataset.k];
  });
  // tables → horizontally scrollable on phones (wrapper already .tbl in source)
  $$('table', body).forEach((tb) => { if (!tb.closest('.tbl, .tk-bal')) { const w = h('div.tbl'); tb.replaceWith(w); w.append(tb); } });

  const fb = h('div.tk-fb', { role: 'status', 'aria-live': 'polite' });
  const bCheck = h('button.btn.btn--primary.tk-check', { type: 'button' }, h('span', 'Проверить'), h('i', { html: CHECK }));
  const bHint = h('button.btn.btn--sm', { type: 'button', 'aria-expanded': 'false' }, 'Подсказка');
  const bSol = h('button.btn.btn--sm', { type: 'button', 'aria-expanded': 'false' }, 'Решение');
  const bClear = h('button.btn.btn--sm.btn--quiet', { type: 'button' }, 'Очистить');

  const hintBox = h('section.tk-fold', { hidden: true }, h('div.tk-fold__in', h('p.eyebrow', 'Подсказка'), h('div.tk-fold__b', { html: t.hint || '<p>Повторите теорию по этой теме.</p>' }), h('a.tk-fold__a', { href: '#/theory/' + topic }, 'Открыть теорию темы ' + topic, ico(P_R))));
  const solBox = h('section.tk-fold.tk-sol', { hidden: true });

  const status = h('span.tk-status', { class: isDone(t.id) ? 'is-on' : '' }, h('i', { html: CHECK }), h('span', isDone(t.id) ? 'Решено' : 'Не решено'));
  const el = h('article.card.tk-card', { style: { '--c': 'var(--' + m.c + ')' }, 'aria-labelledby': 'tk-h-' + kid(t.id) },
    h('header.tk-card__h',
      h('div', h('p.eyebrow', 'Тема ' + topic + ' · ' + (t.src ? 'источник ' + t.src : 'задача')), h('h2.h2', { id: 'tk-h-' + kid(t.id) }, 'Задача ', h('em', t.id))),
      status),
    body,
    keys.length > 1 ? h('p.tk-count', { hidden: !isDone(t.id) }, h('b.num', { 'data-cnt': '' }, '0'), ' из ' + keys.length + ' ответов верно') : null,
    h('div.tk-actions', bCheck, bHint, bSol, inputs.length ? bClear : null),
    fb, hintBox, solBox);

  const countEl = $('[data-cnt]', el);
  const setStatus = (d) => { status.classList.toggle('is-on', d); $('span', status).textContent = d ? 'Решено' : 'Не решено'; };
  const persist = () => { st.a = {}; inputs.forEach((i) => { if (i.value.trim()) st.a[i.dataset.k] = i.value; }); saveSt(t.id, st); };
  const clearState = (inp) => { inp.classList.remove('is-ok', 'is-bad'); };

  function say(tone, title, text) {
    fb.replaceChildren(callout({ tone, title, html: text }));
    fb.classList.remove('is-in'); void fb.offsetWidth; fb.classList.add('is-in');
  }
  const setCount = (n) => { if (countEl) { countEl.textContent = n; countEl.parentNode.hidden = false; countEl.parentNode.classList.toggle('is-full', n === keys.length); } };

  function check() {
    let ok = 0, empty = 0, bad = 0;
    inputs.forEach((inp) => {
      const raw = inp.value.trim(); clearState(inp);
      if (!raw) { empty++; return; }
      const good = matches(parseNum(raw), t.answers[inp.dataset.k]);
      void inp.offsetWidth;
      inp.classList.add(good ? 'is-ok' : 'is-bad'); inp.setAttribute('aria-invalid', good ? 'false' : 'true');
      good ? ok++ : bad++;
    });
    setCount(ok);
    if (!ok && !bad) { say('warn', 'Поля пустые', 'Впишите хотя бы один ответ. Десятичные дроби можно писать и через запятую.'); const f = inputs.find((i) => !i.value.trim()); f && f.focus(); return; }
    st.n++; persist();
    if (ok === inputs.length) {
      const first = !isDone(t.id);
      store.set('tasks.done.' + kid(t.id), Date.now()); setStatus(true);
      const nx = items[items.indexOf(t) + 1];
      say('ok', first ? 'Верно!' : 'Верно — ещё раз.', (st.n === 1 && first ? 'С первой попытки. ' : '') + (nx ? `Идём дальше: <a href="#/tasks/${topic}?t=${nx.id}">задача ${nx.id}</a>.` : nextT ? `Тема закончена — <a href="#/tasks/${nextT}">перейти к теме ${nextT}</a>.` : 'Это была последняя задача.'));
      if (first) burst(el);
      onChange && onChange();
    } else if (ok) {
      say('warn', `Верно ${ok} из ${inputs.length}`, bad ? 'Красные поля не сходятся — перепроверьте вычисления' + (empty ? ', остальные заполните' : '') + '.' : 'Заполните оставшиеся поля.');
    } else {
      say('bad', 'Пока не сходится', 'Проверьте единицы измерения и округление. Если застряли — откройте подсказку.');
    }
  }

  bCheck.addEventListener('click', check);
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => { clearState(inp); inp.removeAttribute('aria-invalid'); persist(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return; e.preventDefault();
      const nxt = inputs.slice(i + 1).find((x) => !x.value.trim());
      if (nxt && inp.value.trim()) nxt.focus(); else check();
    });
  });
  bClear.addEventListener('click', () => { inputs.forEach((i) => { i.value = ''; clearState(i); i.removeAttribute('aria-invalid'); }); setCount(0); fb.replaceChildren(); persist(); inputs[0] && inputs[0].focus(); });

  /* hint */
  const fold = (box, btn, open) => {
    btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('is-on', open);
    if (open) { box.hidden = false; void box.offsetWidth; box.classList.add('is-open'); } else { box.classList.remove('is-open'); later(() => { if (!box.classList.contains('is-open')) box.hidden = true; }, reduced() ? 0 : 420); }
  };
  bHint.addEventListener('click', () => fold(hintBox, bHint, !hintBox.classList.contains('is-open')));

  /* solution: answers + steps revealed one by one */
  let steps = null, shown = 0, built = false;
  function buildSolution() {
    built = true;
    steps = reflow(t.solution || '');
    const figOnly = steps.every((s) => s.fig);
    const list = h('ol.tk-steps');
    const more = h('button.btn.btn--sm', { type: 'button' });
    const all = h('button.btn.btn--sm.btn--quiet', { type: 'button' }, 'Показать всё');
    const prog = h('span.tk-steps__p.mono');
    const ctl = h('div.tk-steps__c', more, all, prog);
    const ans = h('div.tk-ans', h('p.eyebrow', keys.length > 1 ? 'Ответы' : 'Ответ'), h('ul', ...keys.map((k, i) => h('li', keys.length > 1 ? h('i', String(i + 1)) : null, h('b.num', fmt(t.answers[k], Math.min(3, decimals(t.answers[k]))))))));
    solBox.append(h('div.tk-fold__in', h('p.eyebrow', 'Решение'), ans, list, steps.length ? ctl : h('p.muted', 'Подробного решения для этой задачи нет.')));
    const renderLeft = () => {
      const left = steps.length - shown;
      more.hidden = all.hidden = left <= 0; prog.textContent = shown + ' / ' + steps.length;
      more.textContent = left === 1 ? 'Последний шаг' : 'Следующий шаг'; ctl.classList.toggle('is-done', left <= 0);
    };
    const reveal = (n) => {
      for (let k = 0; k < n && shown < steps.length; k++) {
        const s = steps[shown++];
        const li = h('li.tk-step' + (s.fig ? '.is-fig' : ''), { html: stepHTML(s), style: { '--i': k } });
        if (!s.fig) li.prepend(h('i.tk-step__n', { 'aria-hidden': 'true' }, shown));
        list.append(li); li.classList.add('is-new');
        if (k === 0 && shown > 1 && !reduced()) later(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
      }
      renderLeft();
    };
    more.addEventListener('click', () => reveal(1));
    all.addEventListener('click', () => reveal(steps.length));
    if (figOnly || steps.length <= 2) reveal(steps.length); else reveal(1);
    if (figOnly || steps.length <= 2) ctl.hidden = true;
    renderLeft();
  }
  bSol.addEventListener('click', () => {
    const open = !solBox.classList.contains('is-open');
    if (open && !built) { buildSolution(); if (!st.s) { st.s = 1; saveSt(t.id, st); } }
    fold(solBox, bSol, open);
    if (open && !reduced()) later(() => solBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 120);
  });

  // restore: if previously checked, show the last result quietly
  if (isDone(t.id)) setCount(inputs.filter((i) => matches(parseNum(i.value), t.answers[i.dataset.k])).length);
  if (isDone(t.id)) inputs.forEach((i) => { if (i.value && matches(parseNum(i.value), t.answers[i.dataset.k])) i.classList.add('is-ok'); });

  return { el, destroy() { timers.forEach(clearTimeout); } };
}

/* little celebration: sparks fly out of the check button */
function burst(card) {
  if (reduced()) return;
  const b = $('.tk-check', card); if (!b) return;
  const box = h('span.tk-burst', { 'aria-hidden': 'true' });
  const cols = ['--accent', '--d2', '--d5', '--d4', '--d6', '--d1'];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.random() * .4, r = 46 + Math.random() * 54;
    box.append(h('i', { style: { '--x': Math.cos(a) * r + 'px', '--y': Math.sin(a) * r - 10 + 'px', '--c': 'var(' + cols[i % cols.length] + ')', '--r': Math.round(Math.random() * 360) + 'deg', '--dl': (Math.random() * .08).toFixed(2) + 's' } }));
  }
  box.style.setProperty('--bx', (b.offsetLeft + b.offsetWidth / 2) + 'px'); b.parentNode.append(box); setTimeout(() => box.remove(), 1100);
}
