/* Заметки и закладки — #/me/notes. Источник: NT.data[lecId] = [{p, s, e, q, k, note, ts}]
   k: 'bm' закладка · 'imp' важно · 'ndu' не понял · 'srop' вопрос на СРОП · 'note' заметка.
   Здесь же «Лист вопросов к СРОП» (печать и копирование текстом). */
import { h, $, $$, loadCSS, plural, toast } from '../core/dom.js';
import { NT, ERR, S } from '../core/state.js';
import { openErrors } from '../core/qa.js';
import { ctx as planCtx } from '../core/plan.js';
import { enhance } from '../core/motion.js';
import { TOPICS, rub } from '../data/topics.js';

const NB = ' ';
export const KINDS = {
  bm: { label: 'Закладка', mark: '⚑' },
  imp: { label: 'Важно', mark: '★' },
  ndu: { label: 'Не понял', mark: '?' },
  srop: { label: 'Вопрос на СРОП', mark: '¿' },
  note: { label: 'Заметка', mark: '✎' },
};
const fdate = (t) => (t ? new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '');
const topicOf = (id) => +String(id).split('.')[0] || 0;

export async function load() {
  const [c] = await Promise.all([planCtx(), loadCSS('app/css/v-me2.css')]);
  return { c };
}

/** вся пометки одним списком: [{lec, i, n:{…}}] */
function allNotes() {
  const out = [];
  Object.entries(NT.data).forEach(([lec, arr]) => (arr || []).forEach((n, i) => out.push({ lec, i, n })));
  return out.sort((a, b) => (a.lec === b.lec ? (a.n.p - b.n.p) || ((a.n.s || 0) - (b.n.s || 0)) : a.lec.localeCompare(b.lec, 'ru', { numeric: true })));
}

/** состав листа вопросов к СРОП */
export function sropSheet(c) {
  const notes = allNotes().filter((x) => x.n.k === 'ndu' || x.n.k === 'srop');
  const errs = openErrors(c.bank).map((q) => ({ qid: q, Q: c.bank.byQid.get(q), e: ERR.data[q] }));
  errs.sort((a, b) => (b.e.sropq ? 1 : 0) - (a.e.sropq ? 1 : 0) || (b.e.conf === 2) - (a.e.conf === 2) || (b.e.n || 0) - (a.e.n || 0) || (b.e.last || 0) - (a.e.last || 0));
  const flagged = errs.filter((x) => x.e.sropq), rest = errs.filter((x) => !x.e.sropq);
  const top = flagged.concat(rest.slice(0, Math.max(0, 5 - flagged.length)));
  const tasks = Object.entries(S.data.tk || {}).filter(([, t]) => !t.dn && (t.n > 0 || t.hs || t.ss)).map(([id, t]) => ({ id, t }))
    .sort((a, b) => a.id.localeCompare(b.id, 'ru', { numeric: true }));
  return { notes, errs: top, tasks };
}

export function sropText(c, sheet = sropSheet(c)) {
  const prof = S.data.prof || {};
  const L = ['ЛИСТ ВОПРОСОВ К СРОП', [prof.name, prof.grp].filter(Boolean).join(', ') + (prof.name || prof.grp ? ' · ' : '') + new Date().toLocaleDateString('ru-RU'), ''];
  let n = 0;
  if (sheet.notes.length) {
    L.push('Что не понял по лекциям:');
    sheet.notes.forEach(({ lec, n: x }) => { const l = c.ix.byLec.get(lec); L.push(`${++n}. [${lec}${l ? ' ' + (l.short || l.title) : ''}] ${x.k === 'srop' ? 'Вопрос: ' : 'Не понял: '}${x.q ? '«' + x.q + '»' : 'абзац ' + (x.p + 1)}${x.note ? ' — ' + x.note : ''}`); });
    L.push('');
  }
  if (sheet.errs.length) {
    L.push('Ошибки в тестах:');
    sheet.errs.forEach(({ qid, Q }) => L.push(`${++n}. [вопрос ${qid}] ${Q.q}`));
    L.push('');
  }
  if (sheet.tasks.length) {
    L.push('Нерешённые задачи:');
    sheet.tasks.forEach(({ id, t }) => L.push(`${++n}. Задача ${id}${t.tot ? ` (верно полей: ${t.f || 0} из ${t.tot})` : ''}`));
    L.push('');
  }
  if (!n) L.push('Пока пусто.');
  return L.join('\n');
}

export function mount(el, ctx, { c }) {
  const ix = c.ix;
  const state = { topic: 0, kind: '', lec: (ctx && ctx.query && ctx.query.lec) || '' };
  const root = h('div.m2.m2n');
  el.append(root);
  let editing = null;

  function render() {
    const scroll = scrollY;
    root.replaceChildren();
    const list = allNotes();
    root.append(head(list));
    if (!list.length) { root.append(empty()); root.append(sheetBlock()); enhance(root); return; }
    root.append(filters(list));
    const shown = list.filter((x) => (!state.lec || x.lec === state.lec) && (!state.topic || topicOf(x.lec) === state.topic) && (!state.kind || x.n.k === state.kind));
    if (!shown.length) root.append(h('p.m2__none', 'По этому фильтру пометок нет.'));
    const byLec = new Map();
    shown.forEach((x) => (byLec.get(x.lec) || byLec.set(x.lec, []).get(x.lec)).push(x));
    byLec.forEach((arr, lec) => {
      const l = ix.byLec.get(lec), tm = TOPICS[topicOf(lec)] || TOPICS[1];
      root.append(h('section.m2__sec', { style: { '--c': 'var(--' + tm.c + ')' } },
        h('header.m2__sh', h('h2.h3', h('span.mono', lec + ' '), h('em', l ? (l.short || l.title) : 'Лекция')), h('a.btn.btn--sm.btn--quiet', { href: '#/read/' + lec }, 'Открыть лекцию')),
        h('div.m2n__list', ...arr.map(noteCard))));
    });
    root.append(sheetBlock());
    enhance(root);
    scrollTo(0, scroll);
  }

  function head(list) {
    const cnt = (k) => list.filter((x) => x.n.k === k).length;
    return h('header.m2__head',
      h('div', h('p.eyebrow.eyebrow--dot', 'Прогресс · заметки'),
        h('h1.h1', { html: 'Заметки и <em>закладки</em>' }),
        h('p.lede', 'Всё, что вы отметили в лекциях. Пометки «Не понял» и «Вопрос на СРОП» собираются в лист для встречи с преподавателем.')),
      list.length ? h('div.m2__stats', ...['bm', 'imp', 'ndu', 'srop', 'note'].map((k) => h('div.m2__stat', h('b.num', String(cnt(k))), h('span', KINDS[k].label)))) : null);
  }

  function empty() {
    const first = ix.lectures[0];
    return h('section.m2__empty',
      h('div.m2__empty-ic', { 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>' }),
      h('h2.h2', 'Пометок пока нет'),
      h('p', 'Откройте любую лекцию и выделите фрагмент текста: появится панель «Важно», «Не понял», «Вопрос на СРОП», «Заметка…». Флажок на полях абзаца ставит закладку.'),
      h('div.m2__acts', h('a.btn.btn--primary', { href: '#/read/' + first.id }, 'Открыть лекцию ' + first.id)));
  }

  function filters(list) {
    const topics = [...new Set(list.map((x) => topicOf(x.lec)))].sort((a, b) => a - b);
    const chip = (on, label, fn, title) => h('button.chip', { type: 'button', 'aria-pressed': String(on), class: on ? 'is-on' : '', title, onclick: fn }, label);
    return h('div.m2__filters',
      state.lec ? h('div.m2__seg', chip(true, 'Лекция ' + state.lec + ' ✕', () => { state.lec = ''; render(); }, 'Показать все лекции')) : null,
      h('div.m2__seg', { role: 'group', 'aria-label': 'Тип пометки' },
        chip(!state.kind, 'Все', () => { state.kind = ''; render(); }),
        ...Object.entries(KINDS).map(([k, v]) => chip(state.kind === k, v.mark + ' ' + v.label, () => { state.kind = k; render(); }))),
      topics.length > 1 ? h('div.m2__seg', { role: 'group', 'aria-label': 'Тема' },
        chip(!state.topic, 'Все темы', () => { state.topic = 0; render(); }),
        ...topics.map((n) => chip(state.topic === n, 'Тема ' + n, () => { state.topic = n; render(); }, TOPICS[n] && TOPICS[n].short))) : null);
  }

  function noteCard({ lec, i, n }) {
    const K = KINDS[n.k] || KINDS.note;
    const isEd = editing === n.ts + ':' + lec;
    const body = [];
    if (n.q) body.push(h('blockquote.m2n__q', n.q + (n.q.length >= 80 ? '…' : '')));
    else body.push(h('p.m2n__q.muted', 'Абзац ' + (n.p + 1)));
    if (isEd) {
      const ta = h('textarea.m2n__ta', { rows: 3, 'aria-label': 'Текст заметки', maxlength: 600 }); ta.value = n.note || '';
      body.push(ta, h('div.m2n__ed',
        h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => { n.note = ta.value.trim(); NT.save(true); editing = null; render(); } }, 'Сохранить'),
        h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: () => { editing = null; render(); } }, 'Отмена')));
      setTimeout(() => ta.focus(), 0);
    } else if (n.note) body.push(h('p.m2n__note', n.note));
    return h('article.card.m2n__n.k-' + n.k,
      h('header.m2n__h', h('span.m2n__k', h('i', { 'aria-hidden': 'true' }, K.mark), K.label), h('span.m2n__d.mono', fdate(n.ts))),
      ...body,
      isEd ? null : h('footer.m2n__f',
        h('a.btn.btn--sm', { href: '#/read/' + lec + '?p=' + n.p }, 'К месту в лекции'),
        h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: () => { editing = n.ts + ':' + lec; render(); } }, n.note ? 'Изменить' : 'Добавить текст'),
        h('button.btn.btn--sm.btn--quiet', { type: 'button', 'aria-label': 'Удалить пометку', onclick: () => { const a = NT.data[lec]; const k = a.indexOf(n); if (k >= 0) a.splice(k, 1); if (!a.length) delete NT.data[lec]; NT.save(true); render(); } }, 'Удалить')));
  }

  function sheetBlock() {
    const sh = sropSheet(c), total = sh.notes.length + sh.errs.length + sh.tasks.length;
    const prof = S.data.prof || {};
    const sec = h('section.m2__sec.m2n__sheet', { 'aria-labelledby': 'm2n-sh' },
      h('header.m2__sh', h('h2.h3', { id: 'm2n-sh' }, 'Лист вопросов к СРОП'),
        h('div.m2__acts.no-print',
          h('button.btn.btn--primary.btn--sm', { type: 'button', disabled: !total, onclick: () => { root.dataset.print = 'sheet'; const done = () => { delete root.dataset.print; removeEventListener('afterprint', done); }; addEventListener('afterprint', done); print(); } }, 'Печать'),
          h('button.btn.btn--sm', { type: 'button', disabled: !total, onclick: () => copy(sropText(c, sh), 'Лист скопирован') }, 'Скопировать как текст'),
          h('button.btn.btn--sm.btn--quiet', { type: 'button', disabled: !list0(), onclick: () => copy(allText(), 'Все заметки скопированы') }, 'Все заметки текстом'))),
      h('p.m2__hint.no-print', 'В лист попадают: «Не понял» и «Вопрос на СРОП» из лекций, до пяти ошибок из журнала (отмеченные «В лист СРОП» — первыми) и задачи, которые вы пробовали, но не решили.'),
      h('div.m2n__paper',
        h('p.m2n__ph', h('b', 'Лист вопросов к СРОП'), h('span', [prof.name, prof.grp].filter(Boolean).join(', ') || 'ФИО не указано'), h('span.mono', new Date().toLocaleDateString('ru-RU'))),
        total ? null : h('p.m2__none', 'Пока в листе нечего показать: он заполнится, когда вы отметите «Не понял» в лекциях или ошибётесь в вопросе.'),
        sh.notes.length ? block('Не понял по лекциям', sh.notes.map(({ lec, n }) => { const l = ix.byLec.get(lec); return li(`${lec}${l ? ' · ' + (l.short || l.title) : ''}`, (n.k === 'srop' ? 'Вопрос: ' : 'Не понял: ') + (n.q ? '«' + n.q + '»' : 'абзац ' + (n.p + 1)) + (n.note ? ' — ' + n.note : ''), '#/read/' + lec + '?p=' + n.p); })) : null,
        sh.errs.length ? block('Ошибки в тестах', sh.errs.map(({ qid, Q }) => li('Вопрос ' + qid, Q.q, '#/me/errors'))) : null,
        sh.tasks.length ? block('Нерешённые задачи', sh.tasks.map(({ id, t }) => li('Задача ' + id, t.tot ? `верно полей: ${t.f || 0} из ${t.tot}` : 'решение не найдено', '#/tasks/' + id.split('.')[0] + '?t=' + id))) : null));
    return sec;
  }
  const list0 = () => allNotes().length;
  const block = (title, items) => h('div.m2n__blk', h('h3.m2n__bt', title), h('ol', ...items));
  const li = (tag, text, href) => h('li', h('a.m2n__tag.mono', { href }, tag), h('span', text));

  function allText() {
    const L = ['МОИ ЗАМЕТКИ', ''];
    allNotes().forEach(({ lec, n }) => { const l = ix.byLec.get(lec); L.push(`[${lec}${l ? ' ' + (l.short || l.title) : ''}] ${(KINDS[n.k] || KINDS.note).label}: «${n.q || 'абзац ' + (n.p + 1)}»${n.note ? ' — ' + n.note : ''}`); });
    return L.join('\n');
  }
  function copy(text, msg) {
    const done = () => toast(msg);
    const fb = () => { const t = h('textarea', { style: { position: 'fixed', opacity: 0 } }); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb); else fb();
  }

  render();
  return { title: 'Заметки и закладки', destroy() { /* нет подписок */ } };
}
