/* Преподаватель: создать ссылку-задание — #/teach/assign  (V3_PLAN §4.5, С3) */
import { h, loadCSS, plural, toast } from '../core/dom.js';
import { encodeAssign } from '../core/codec.js';
import { ctx as planCtx, currentTopic } from '../core/plan.js';
import { S } from '../core/state.js';
import { copyText } from '../ui/sheet.js';
import { TOPICS } from '../data/topics.js';
import { describeItems, dueText } from './assign.js';

export async function load() {
  const [c] = await Promise.all([planCtx(), loadCSS('app/css/v-teach.css')]);
  return { c };
}

const LIMIT = 1500;
const two = (n) => String(n).padStart(2, '0');
const isoDate = (d) => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
const newId = () => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };

export function mount(el, ctx, { c }) {
  const ix = c.ix, bank = c.bank, now = new Date();
  const seedFor = (n) => String(now.getFullYear()).slice(2) + two(now.getMonth() + 1) + '-' + two(n);
  const cur = currentTopic(c);
  const T = new Map();             // тема → настройки пунктов
  const cfg = (n) => {
    if (!T.has(n)) {
      const tp = ix.byTopic.get(n), E = bank.E(n), uq = bank.unique(n).length;
      T.set(n, { lec: new Set(tp.lectures.map((l) => l.id)), lab: new Set(tp.lab || []), pr: true, task: new Set(tp.tasks || []), test: true, tn: Math.min(10, uq), tmin: 70, seed: seedFor(n), sr: false, sro: new Set() });
    }
    return T.get(n);
  };
  const state = { topics: new Set([cur]), t: '', by: S.data.prof.name || '', due: isoDate(new Date(now.getTime() + 7 * 864e5)), goals: '' };
  let titleTouched = false, built = null;

  const autoTitle = () => { const ts = [...state.topics].sort((a, b) => a - b); return ts.length === 1 ? `Тема ${ts[0]}. ${TOPICS[ts[0]] ? TOPICS[ts[0]].short : ix.byTopic.get(ts[0]).title}` : `Темы ${ts.join(', ')}`; };

  /* ── форма ──────────────────────────────────────────────── */
  const tIn = h('input.tv-in#ta-t', { type: 'text', maxlength: 80, autocomplete: 'off' });
  const byIn = h('input.tv-in#ta-by', { type: 'text', maxlength: 60, value: state.by, autocomplete: 'name', placeholder: 'Иванова А.Б.' });
  const dueIn = h('input.tv-in#ta-due', { type: 'date', value: state.due });
  const goalsIn = h('textarea.tv-in.ta-goals#ta-g', { rows: 3, maxlength: 600, placeholder: 'Например: объяснить, как сдвиг совокупного спроса меняет выпуск и цены.' });
  tIn.addEventListener('input', () => { titleTouched = true; state.t = tIn.value; invalidate(); });
  byIn.addEventListener('input', () => { state.by = byIn.value; invalidate(); });
  dueIn.addEventListener('input', () => { state.due = dueIn.value; invalidate(); });
  goalsIn.addEventListener('input', () => { state.goals = goalsIn.value; invalidate(); });
  const syncTitle = () => { if (!titleTouched) { state.t = autoTitle(); tIn.value = state.t; } };

  const topicChips = h('div.tv-chips', { role: 'group', 'aria-label': 'Темы задания' });
  const cards = h('div.ta-cards');
  function drawTopics() {
    topicChips.replaceChildren(...ix.topics.map((tp) => h('button.chip', { type: 'button', 'aria-pressed': String(state.topics.has(tp.n)), class: state.topics.has(tp.n) ? 'is-on' : null, title: 'Тема ' + tp.n + '. ' + tp.title, onclick: () => { if (state.topics.has(tp.n)) { if (state.topics.size > 1) state.topics.delete(tp.n); } else state.topics.add(tp.n); syncTitle(); drawTopics(); drawCards(); invalidate(); } }, String(tp.n))));
  }
  const chip = (label, on, fn, title) => h('button.chip', { type: 'button', 'aria-pressed': String(!!on), class: on ? 'is-on' : null, title: title || null, onclick: (e) => { fn(); const b = e.currentTarget, v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); b.classList.toggle('is-on', v); invalidate(); } }, label);
  const setToggle = (set, id) => () => { set.has(id) ? set.delete(id) : set.add(id); };
  function drawCards() {
    cards.replaceChildren(...[...state.topics].sort((a, b) => a - b).map((n) => {
      const tp = ix.byTopic.get(n), s = cfg(n), uq = bank.unique(n).length;
      const row = (label, ...kids) => h('div.ta-row', h('span.ta-rl', label), h('div.ta-rc', ...kids));
      const nIn = h('input.tv-in.ta-n', { type: 'number', min: 3, max: uq, value: s.tn, 'aria-label': 'Вопросов в тесте темы ' + n }); nIn.addEventListener('input', () => { s.tn = Math.max(1, Math.min(uq, parseInt(nIn.value, 10) || 10)); invalidate(); });
      const mIn = h('input.tv-in.ta-n', { type: 'number', min: 30, max: 100, step: 5, value: s.tmin, 'aria-label': 'Порог теста, процентов' }); mIn.addEventListener('input', () => { s.tmin = Math.max(10, Math.min(100, parseInt(mIn.value, 10) || 70)); invalidate(); });
      const sIn = h('input.tv-in.ta-sd', { type: 'text', value: s.seed, maxlength: 20, spellcheck: 'false', 'aria-label': 'Зерно теста' }); sIn.addEventListener('input', () => { s.seed = sIn.value.trim() || seedFor(n); invalidate(); });
      return h('section.ta-card.card', { 'aria-label': 'Тема ' + n },
        h('h3.ta-h', h('span.mono', 'Тема ' + n), ' ', TOPICS[n] ? TOPICS[n].short : tp.title),
        row('Лекции', ...tp.lectures.map((l) => chip(l.id, s.lec.has(l.id), setToggle(s.lec, l.id), l.short))),
        (tp.lab || []).length ? row('Модель', ...tp.lab.map((id) => chip(id, s.lab.has(id), setToggle(s.lab, id), (ix.labs.get(id) || {}).title)), h('label.ta-ck', h('input', { type: 'checkbox', checked: s.pr, onchange: (e) => { s.pr = e.target.checked; invalidate(); } }), ' с прогнозом')) : row('Модель', h('span.ta-no', 'в теме нет собственной модели')),
        (tp.tasks || []).length ? row('Задачи', ...tp.tasks.map((id) => chip(id, s.task.has(id), setToggle(s.task, id)))) : row('Задачи', h('span.ta-no', 'в теме нет задач')),
        row('Тест', h('label.ta-ck', h('input', { type: 'checkbox', checked: s.test, onchange: (e) => { s.test = e.target.checked; invalidate(); } }), ' включить'), h('label.ta-f', nIn, h('span', `из ${uq} вопросов`)), h('label.ta-f', mIn, h('span', '% порог')), h('label.ta-f', sIn, h('span', 'зерно'))),
        row('Повторение', h('label.ta-ck', h('input', { type: 'checkbox', checked: s.sr, onchange: (e) => { s.sr = e.target.checked; invalidate(); } }), ' карточки темы')),
        (tp.sro || []).length ? row('СРО', ...tp.sro.map((k) => chip('№' + ' ' + k, s.sro.has(k), setToggle(s.sro, k)))) : null);
    }));
  }

  /* ── сборка и вывод ─────────────────────────────────────── */
  const out = h('section.ta-out', { 'aria-live': 'polite' });
  function collect() {
    const items = [], tps = [...state.topics].sort((a, b) => a - b);
    const lec = [], task = [], sr = [];
    tps.forEach((n) => { const s = cfg(n), tp = ix.byTopic.get(n);
      tp.lectures.forEach((l) => s.lec.has(l.id) && lec.push(l.id));
      (tp.tasks || []).forEach((id) => s.task.has(id) && task.push(id));
      if (s.sr) sr.push(n);
    });
    if (lec.length) items.push({ k: 'lec', ids: lec });
    tps.forEach((n) => { const s = cfg(n), tp = ix.byTopic.get(n); (tp.lab || []).forEach((id) => s.lab.has(id) && items.push(s.pr ? { k: 'lab', id, pr: 1 } : { k: 'lab', id, pr: 0 })); });
    if (task.length) items.push({ k: 'task', ids: task });
    tps.forEach((n) => { const s = cfg(n); if (s.test) items.push({ k: 'test', topic: n, n: Math.min(s.tn, bank.unique(n).length), min: s.tmin, seed: s.seed }); });
    if (sr.length) items.push({ k: 'sr', topics: sr });
    tps.forEach((n) => [...cfg(n).sro].sort((a, b) => a - b).forEach((k) => items.push({ k: 'sro', n: k })));
    return items;
  }
  function invalidate() { if (built) { built = null; out.replaceChildren(h('p.th-hint', 'Параметры изменились — нажмите «Создать ссылку» ещё раз.')); } }

  async function create() {
    const items = collect();
    if (!items.length) { out.replaceChildren(h('div.co.co--warn', h('strong.co__t', 'Нечего выдавать'), h('p', 'Отметьте хотя бы один пункт.'))); return; }
    if (!state.t.trim()) { tIn.focus(); toast('Впишите название задания'); return; }
    const meta = { v: 1, id: newId(), t: state.t.trim(), by: state.by.trim(), due: state.due || '', items, goals: state.goals.trim(), bk: bank.bk };
    try {
      const payload = await encodeAssign(meta);
      const link = location.origin + location.pathname + '#/a/' + payload;
      built = { meta, payload, link };
      S.data.prof.name = S.data.prof.name || meta.by;
      const t = S.data.teach; (t.assigns = t.assigns || []).unshift({ id: meta.id, t: meta.t, by: meta.by, due: meta.due, at: Date.now() }); t.assigns.length = Math.min(t.assigns.length, 40);
      t.last = { kind: 'assign', id: meta.id, title: meta.t, href: '#/a/' + payload, at: Date.now() }; S.save(true);
      draw();
    } catch (e) { out.replaceChildren(h('div.co.co--bad', { role: 'alert' }, h('strong.co__t', 'Не удалось создать ссылку'), h('p', e.message))); }
  }
  function draw() {
    const { meta, payload, link } = built, long = link.length > LIMIT, d = describeItems(meta, ix);
    const lk = h('input.tv-in', { id: 'ta-link', readonly: true, value: link, 'aria-label': 'Ссылка на задание', onfocus: (e) => e.target.select() });
    out.replaceChildren(h('div.ta-res.card',
      h('p.eyebrow.eyebrow--dot', 'Ссылка готова'),
      h('div.ta-link', lk, h('button.btn.btn--primary', { type: 'button', onclick: async () => { const ok = await copyText(link); toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать — выделите ссылку вручную'); } }, 'Копировать')),
      h('p.ta-len.mono' + (long ? '.is-long' : ''), `Длина ссылки: ${link.length} знаков`),
      long ? h('div.co.co--warn', { role: 'alert' }, h('strong.co__t', 'Ссылка длинная'), h('p', `Больше ${LIMIT} знаков: часть мессенджеров обрезает такие ссылки. Уберите лишние пункты или сократите цели и создайте ссылку заново.`)) : null,
      h('div.ta-prev', h('h3.h3', 'Что увидит студент'),
        h('p.ta-pt', h('b', meta.t), meta.by ? ' · ' + meta.by : '', meta.due ? ' · срок ' + dueText(meta.due) : ''),
        meta.goals ? h('blockquote.ta-goals-q', meta.goals) : null,
        h('ol.ta-pl', ...d.map((x) => h('li', h('b', x.title), x.sub ? h('span', ' — ' + x.sub) : null)))),
      h('div.as-act', h('a.btn', { href: '#/a/' + payload, target: '_blank', rel: 'noopener' }, 'Открыть как студент'), h('a.btn', { href: '#/teach/summary' }, 'К сводке по кодам')),
      h('p.th-hint', 'Ссылка не содержит персональных данных. Задание хранится только в самой ссылке — сервера нет. Сохраните её в чате группы.')));
    out.firstChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  syncTitle(); drawTopics(); drawCards();
  el.append(h('div.ta.wrap',
    h('header.th-head', h('nav.crumbs', h('a', { href: '#/teach' }, 'Преподавателю'), h('i', '/'), h('span', 'Задание')),
      h('h1.h1', 'Выдать ', h('em', 'задание')), h('p.lede', 'Отметьте тему и пункты — получите одну ссылку. Студент откроет её у себя, а выполненное вернёт вам кодом.')),
    h('form.ta-form', { onsubmit: (e) => { e.preventDefault(); create(); } },
      h('section.ta-top.card',
        h('div.tv-f', h('span.tv-l', 'Темы'), topicChips),
        h('div.ta-2', h('div.tv-f', h('label.tv-l', { for: 'ta-t' }, 'Название'), tIn), h('div.tv-f', h('label.tv-l', { for: 'ta-by' }, 'Преподаватель'), byIn), h('div.tv-f', h('label.tv-l', { for: 'ta-due' }, 'Срок'), dueIn)),
        h('div.tv-f', h('label.tv-l', { for: 'ta-g' }, 'Цели (свой текст)'), goalsIn, h('p.tv-hint', 'Этот текст студент увидит в задании как цели темы. Приложение его не меняет и не дополняет.'))),
      cards,
      h('div.ta-go', h('button.btn.btn--primary.btn--lg', { type: 'submit' }, 'Создать ссылку'), h('span.th-hint', 'Каждое нажатие создаёт новое задание с новым номером.')),
      out)));
  tIn.value = state.t;
  return { title: 'Выдать задание', destroy() {} };
}
