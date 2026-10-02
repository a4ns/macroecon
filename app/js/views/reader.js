/* Читалка лекций — #/read/:id */
import { h, $, $$, loadCSS, plural, clamp, reduced, toast } from '../core/dom.js';
import { index, lecture, glossary } from '../core/data.js';
import { store } from '../core/store.js';
import { S, NT, bus } from '../core/state.js';
import * as track from '../core/track.js';
import { enhance } from '../core/motion.js';
import { setProgress } from '../ui/chrome.js';
import { TOPICS, LABS, icon, rub } from '../data/topics.js';
import { nbTree } from './_typo.js';

const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export async function load(ctx) {
  const id = ctx.params.id;
  const [ix, html, gl] = await Promise.all([index(), lecture(id).catch(() => null), glossary(), loadCSS('app/css/v-reader.css'), loadCSS('app/css/v-me2.css')]);
  const lec = ix.byLec.get(id);
  if (!lec || html == null) throw new Error('Нет такой лекции: ' + id);
  return { ix, lec, html: html.replace(/¬/g, '­'), gl };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* оборачиваем первое вхождение термина в кнопку-подсказку */
function markTerms(root, terms) {
  const done = new Set();
  for (const g of terms) {
    const name = g.term.replace(/[«»"]/g, '').trim(); if (name.length < 4 || done.has(g.id)) continue;
    const stem = name.length > 6 ? name.slice(0, -1) : name;
    const re = new RegExp('(^|[^\\p{L}])(' + esc(stem) + '[\\p{L}]{0,3})(?![\\p{L}])', 'iu');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest('math,.eq,.gterm,figcaption,b,i') ? 2 : 1 });
    let n;
    while ((n = w.nextNode())) {
      const m = re.exec(n.nodeValue); if (!m) continue;
      const i = m.index + m[1].length, rng = document.createRange();
      rng.setStart(n, i); rng.setEnd(n, i + m[2].length);
      const b = h('button.gterm', { type: 'button', 'data-g': g.id });
      rng.surroundContents(b); done.add(g.id); break;
    }
  }
}

export function mount(el, ctx, { ix, lec, html, gl }) {
  const tp = ix.byTopic.get(lec.topic), tm = TOPICS[lec.topic];
  store.markRead(lec.id); store.last('#/read/' + lec.id, lec.short || lec.title, { id: lec.id });
  const body = h('div.prose', { html });
  nbTree && nbTree(body);
  const byId = new Map(gl.map((g) => [g.id, g]));
  const tt = (lec.terms || []).map((t) => gl.find((g) => g.term.toLowerCase() === t.toLowerCase())).filter(Boolean);
  markTerms(body, tt.concat(gl.filter((g) => !tt.includes(g) && g.term.length > 7).slice(0, 0)));

  /* оглавление: «Тема → лекции» */
  const toc = h('nav.rd__toc', { 'aria-label': 'Лекции темы' },
    h('p.eyebrow', 'Тема ' + lec.topic),
    ...tp.lectures.map((l) => h('a.rd__tl', { href: '#/read/' + l.id, class: l.id === lec.id ? 'is-cur' : (store.isRead(l.id) ? 'is-read' : '') }, h('b', l.id), h('span', l.short || l.title))));

  const labs = (tp.lab || []).map((id) => h('a.card.rd__lab', { href: '#/lab/' + id }, h('small', 'Попробуйте сами'), h('b', (LABS[id] || {}).short || id), h('i', { html: ARR })));
  const nav = (l, dir) => l ? h('a.card.rd__pn.' + dir, { href: '#/read/' + l.id }, h('small', dir === 'prev' ? '← Назад' : 'Дальше →'), h('b', l.short || l.title), h('span.mono', l.id)) : h('span');

  /* учёт: открытие, глубина, видимое время; отметка «изучена» */
  track.lecOpen(lec.id);
  const doneState = h('p.rd-done__t'), doneBtn = h('button.btn.btn--sm', { type: 'button' });
  const doneBox = h('section.rd-done', { 'aria-label': 'Отметка о прочтении' }, doneState,
    h('div.rd-done__a', doneBtn, h('a.btn.btn--sm.btn--quiet.rd-ntlink', { href: '#/me/notes?lec=' + lec.id }, 'Мои заметки к лекции')));
  const lc = () => S.data.lec[lec.id] || { d: 0, s: 0, x: 0 };
  const paintDone = () => {
    const l = lc(), on = !!l.x;
    doneBox.classList.toggle('is-on', on); doneBtn.setAttribute('aria-pressed', String(on));
    doneBtn.classList.toggle('btn--primary', !on);
    doneBtn.textContent = on ? 'Снять отметку' : 'Отметить как изученную';
    doneState.textContent = on ? 'Лекция изучена · ' + new Date(l.x).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + '.'
      : 'Прочитано ' + Math.round((l.d || 0) * 100) + '\u00a0% · ' + Math.round((l.s || 0) / 60) + '\u00a0мин из ≈' + lec.min + '. Отметка появится сама, когда вы дочитаете и пробудете в лекции достаточно времени — или поставьте её сами.';
  };
  doneBtn.addEventListener('click', () => { track.lecStudied(lec.id, !lc().x); paintDone(); });
  paintDone();
  const offBus = bus.on('change', (k) => { if (k === 'mx:v3') paintDone(); });

  el.append(h('article.rd', { style: { '--c': 'var(--' + tm.c + ')' } },
    h('header.rd__head.wrap',
      h('nav.crumbs', h('a', { href: '#/theory' }, 'Теория'), h('i', '/'), h('a', { href: '#/theory/' + lec.topic }, 'Тема ' + lec.topic)),
      h('p.rd__num.mono', rub(lec.topic) + ' · ' + lec.id),
      h('h1.rd__title', lec.title),
      h('p.rd__meta.mono', lec.min + ' мин · ' + lec.words + ' ' + plural(lec.words, ['слово', 'слова', 'слов']))),
    h('div.rd__grid.wrap', h('aside.rd__side', toc), h('div.rd__main', body, labs.length ? h('div.rd__labs', ...labs) : null,
      h('div.rd__tasks', tp.tasks && tp.tasks.length ? h('a.btn.btn--sm', { href: '#/tasks/' + lec.topic }, 'Задачи темы') : null, tp.test ? h('a.btn.btn--sm', { href: '#/tests/' + lec.topic }, 'Тест по теме') : null),
      doneBox,
      h('nav.rd__pn', nav(lec.prev, 'prev'), nav(lec.next, 'next'))))));

  /* подсказки терминов */
  const pop = h('div.gpop', { role: 'tooltip' });
  document.body.append(pop);
  let cur = null, tm_ = 0;
  const show = (btn) => {
    const g = byId.get(btn.dataset.g); if (!g) return;
    clearTimeout(tm_); cur = btn;
    pop.replaceChildren(h('span.gpop__k', 'Термин'), h('h4', g.term), h('p', g.def), h('a.btn.btn--sm', { href: '#/glossary?t=' + g.id }, 'В глоссарии'));
    const r = btn.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
    const x = clamp(r.left + r.width / 2 - w / 2, 12, innerWidth - w - 12);
    pop.style.setProperty('--ox', (r.left + r.width / 2 - x) + 'px');
    pop.style.left = x + 'px';
    pop.classList.add('is-on');
    const below = r.bottom + 8, ph = pop.offsetHeight;
    pop.style.top = (below + ph > innerHeight - 8 ? Math.max(8, r.top - ph - 8) : below) + 'px';
  };
  const hide = () => { tm_ = setTimeout(() => { pop.classList.remove('is-on'); cur = null; }, 160); };
  const over = (e) => { const b = e.target.closest && e.target.closest('.gterm'); if (b) show(b); };
  const out = (e) => { if (e.target.closest && e.target.closest('.gterm')) hide(); };
  const click = (e) => { const b = e.target.closest('.gterm'); if (b) { cur === b ? (pop.classList.remove('is-on'), cur = null) : show(b); } else if (!e.target.closest('.gpop')) { pop.classList.remove('is-on'); cur = null; } };
  body.addEventListener('mouseover', over); body.addEventListener('mouseout', out); document.addEventListener('click', click);
  pop.addEventListener('mouseenter', () => clearTimeout(tm_)); pop.addEventListener('mouseleave', hide);

  /* прогресс чтения + учёт глубины и видимых секунд */
  let depth = 0, acc = 0, lastAct = Date.now(), sentDepth = 0;
  const onScroll = () => {
    const r = body.getBoundingClientRect(), tot = r.height - innerHeight * .6;
    setProgress(clamp(-r.top / Math.max(1, tot)));
    depth = Math.max(depth, clamp((innerHeight * .92 - r.top) / Math.max(1, r.height)));
  };
  const act = () => { lastAct = Date.now(); };
  const flush = () => {
    if (acc > 0 || depth > sentDepth + .01) { track.lecProgress(lec.id, depth, acc, Math.max(1, lec.min || 1)); sentDepth = depth; acc = 0; }
  };
  let tick = 0;
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastAct < 180e3) acc++;
    if (++tick % 5 === 0) flush();
  }, 1000);
  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  ['scroll', 'mousemove', 'keydown', 'touchstart', 'click'].forEach((t) => addEventListener(t, act, { passive: true }));
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', flush);

  /* ── пометки: выделение → панель; флажок-закладка на полях абзаца ───────────────── */
  const KIND = { imp: 'Важно', ndu: 'Не понял', srop: 'Вопрос на СРОП', note: 'Заметка', bm: 'Закладка' };
  const blocks = () => [...body.children];
  const SHY = /\u00ad/g;
  const flagSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  const notes = () => NT.data[lec.id] || (NT.data[lec.id] = []);
  const saveNotes = () => { if (NT.data[lec.id] && !NT.data[lec.id].length) delete NT.data[lec.id]; NT.save(); };
  const textOf = (b) => { let t = ''; const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); while (w.nextNode()) t += w.currentNode.nodeValue; return t; };
  /* положение цитаты в абзаце: по смещениям, иначе поиск по цитате (в этом и других абзацах) */
  function locate(n) {
    const bs = blocks(), try_ = (b) => { const t = textOf(b), st = t.replace(SHY, ''); if (!n.q) return null;
      const exact = t.slice(n.s, n.e).replace(SHY, '');
      if (n.e > n.s && exact.startsWith(n.q)) return [n.s, n.e];
      const map = []; for (let i = 0; i < t.length; i++) if (t[i] !== '\u00ad') map.push(i);
      const k = st.indexOf(n.q); if (k < 0) return null;
      const len = Math.max(n.e - n.s, n.q.length); const s0 = map[k], e0 = Math.min(t.length, s0 + len + (t.slice(s0, s0 + len).split('\u00ad').length - 1));
      return [s0, e0]; };
    const first = bs[n.p] ? try_(bs[n.p]) : null; if (first) return { b: bs[n.p], r: first };
    for (const b of bs) { const r = try_(b); if (r) return { b, r }; }
    return null;
  }
  function wrapRange(b, s0, e0, kind, idx) {
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), segs = []; let pos = 0, nd;
    while ((nd = w.nextNode())) { const L = nd.nodeValue.length, a = Math.max(s0, pos), z = Math.min(e0, pos + L); if (z > a && !(nd.parentElement && nd.parentElement.closest('math,.rd-flag'))) segs.push([nd, a - pos, z - pos]); pos += L; }
    segs.forEach(([node, a, z]) => { if (!node.nodeValue.slice(a, z).trim()) return; const r = document.createRange(); r.setStart(node, a); r.setEnd(node, z); const m = h('mark.rd-mk', { 'data-k': kind, 'data-i': idx, title: KIND[kind] }); try { r.surroundContents(m); } catch (e) { /* пересечение границ — пропускаем */ } });
  }
  function paint() {
    $$('mark.rd-mk', body).forEach((m) => { const p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); m.remove(); p.normalize(); });
    $$('.rd-flag', body).forEach((f) => { f.classList.remove('is-on'); f.setAttribute('aria-pressed', 'false'); });
    const bs = blocks();
    notes().forEach((n, i) => {
      if (n.k === 'bm') { const f = bs[n.p] && $('.rd-flag', bs[n.p]); if (f) { f.classList.add('is-on'); f.setAttribute('aria-pressed', 'true'); f.title = 'Убрать закладку'; } return; }
      const loc = locate(n); if (loc) wrapRange(loc.b, loc.r[0], loc.r[1], n.k, i);
    });
  }
  /* флажки-закладки на полях */
  blocks().forEach((b, i) => {
    if (b.matches('.eq, .fig, figure, table, .tbl, hr') || textOf(b).trim().length < 25) return;
    const f = h('button.rd-flag', { type: 'button', 'aria-label': 'Закладка на этом абзаце', 'aria-pressed': 'false', title: 'Поставить закладку', html: flagSvg });
    f.addEventListener('click', (e) => {
      e.stopPropagation(); const a = notes(), k = a.findIndex((n) => n.k === 'bm' && n.p === i);
      if (k >= 0) { a.splice(k, 1); f.title = 'Поставить закладку'; } else { a.push({ p: i, s: 0, e: 0, q: textOf(b).replace(SHY, '').trim().slice(0, 80), k: 'bm', note: '', ts: Date.now() }); toast('Закладка поставлена. Все пометки — в «Мои заметки»'); }
      saveNotes(); paint();
    });
    b.append(f);
  });

  /* панель над выделением */
  const panel = h('div.rd-sel', { role: 'toolbar', 'aria-label': 'Пометить выделенный текст', hidden: true });
  document.body.append(panel);
  let saved = null;     // {p, s, e, q}
  const hidePanel = () => { panel.hidden = true; panel.replaceChildren(); saved = null; };
  const blockOf = (node) => { let n = node.nodeType === 1 ? node : node.parentElement; while (n && n.parentElement !== body) n = n.parentElement; return n && n.parentElement === body ? n : null; };
  function readSelection() {
    const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0); if (!body.contains(r.commonAncestorContainer) && r.commonAncestorContainer !== body) return null;
    const b0 = blockOf(r.startContainer); if (!b0) return null;
    const b1 = blockOf(r.endContainer);
    const pre = document.createRange(); pre.selectNodeContents(b0); pre.setEnd(r.startContainer, r.startOffset);
    const full = textOf(b0), s0 = pre.toString().length;
    let e0;
    if (b1 === b0) { const to = document.createRange(); to.selectNodeContents(b0); to.setEnd(r.endContainer, r.endOffset); e0 = to.toString().length; } else e0 = full.length;
    const raw = full.slice(s0, e0); if (raw.replace(/\s/g, '').length < 3) return null;
    return { p: blocks().indexOf(b0), s: s0, e: e0, q: raw.replace(SHY, '').slice(0, 80), rect: r.getBoundingClientRect() };
  }
  function place(rect) {
    const w = panel.offsetWidth, hgt = panel.offsetHeight, coarse = matchMedia('(pointer: coarse)').matches;
    const x = clamp(rect.left + rect.width / 2 - w / 2, 8, innerWidth - w - 8);
    let y = coarse ? rect.bottom + 14 : rect.top - hgt - 10; if (y < 8) y = rect.bottom + 10; if (y + hgt > innerHeight - 8) y = Math.max(8, innerHeight - hgt - 8);
    panel.style.left = x + 'px'; panel.style.top = y + 'px';
  }
  function addNote(k, note) {
    if (!saved) return; const { p, s, e, q } = saved;
    notes().push({ p, s, e, q, k, note: note || '', ts: Date.now() }); saveNotes();
    getSelection().removeAllRanges(); hidePanel(); paint();
    toast(KIND[k] + ': сохранено. Смотрите в «Мои заметки»');
  }
  function showSel() {
    const r = readSelection(); if (!r) return;
    saved = r; panel.replaceChildren(...['imp', 'ndu', 'srop'].map((k) => h('button', { type: 'button', onclick: () => addNote(k) }, KIND[k])),
      h('button', { type: 'button', onclick: () => noteForm() }, 'Заметка…'));
    panel.hidden = false; place(r.rect);
  }
  function noteForm() {
    const ta = h('textarea', { rows: 3, maxlength: 600, 'aria-label': 'Текст заметки', placeholder: 'Ваша заметка' });
    const rect = panel.getBoundingClientRect();
    panel.replaceChildren(h('div.rd-sel__note', ta, h('div', h('button', { type: 'button', onclick: () => hidePanel() }, 'Отмена'), h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => addNote('note', ta.value.trim()) }, 'Сохранить'))));
    place(rect); ta.focus();
    ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePanel(); else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote('note', ta.value.trim()); });
  }
  function showMark(m, ev) {
    const idx = +m.dataset.i, n = notes()[idx]; if (!n) return;
    saved = null;
    panel.replaceChildren(h('div.rd-sel__note', h('b', { style: { font: '600 .82rem var(--f-sans)' } }, KIND[n.k] || 'Пометка'), n.note ? h('p', { style: { margin: 0, font: '400 .88rem/1.45 var(--f-sans)' } }, n.note) : null,
      h('div', h('a.btn.btn--sm.btn--quiet', { href: '#/me/notes?lec=' + lec.id }, 'Все заметки'), h('button.btn.btn--sm', { type: 'button', onclick: () => { const a = notes(); const k = a.indexOf(n); if (k >= 0) a.splice(k, 1); saveNotes(); hidePanel(); paint(); } }, 'Удалить'))));
    panel.hidden = false; place(m.getBoundingClientRect());
  }
  let selT = 0;
  const onSelEnd = (e) => { if (panel.contains(e.target)) return; clearTimeout(selT); selT = setTimeout(() => { const mk = e.target.closest && e.target.closest('mark.rd-mk'); if (getSelection().isCollapsed && mk) showMark(mk, e); else if (!getSelection().isCollapsed) showSel(); else if (!panel.contains(document.activeElement)) hidePanel(); }, 10); };
  let scT = 0;
  const onSelChange = () => {
    const sel = getSelection();
    if (!sel.isCollapsed && matchMedia('(pointer: coarse)').matches) { clearTimeout(scT); scT = setTimeout(() => { if (!getSelection().isCollapsed) showSel(); }, 450); return; }
    if (getSelection().isCollapsed && !panel.contains(document.activeElement) && !panel.hidden && !panel.querySelector('textarea') && saved) hidePanel();
  };
  const onKeyUp = (e) => { if (e.key === 'Escape') { hidePanel(); return; } if (e.shiftKey && e.key.startsWith('Arrow')) onSelEnd(e); };
  panel.addEventListener('mousedown', (e) => { if (!e.target.closest('textarea')) e.preventDefault(); });
  body.addEventListener('mouseup', onSelEnd); body.addEventListener('touchend', onSelEnd); body.addEventListener('keyup', onKeyUp);
  document.addEventListener('selectionchange', onSelChange);
  const onDocDown = (e) => { if (!panel.hidden && !panel.contains(e.target) && !e.target.closest('mark.rd-mk')) hidePanel(); };
  document.addEventListener('mousedown', onDocDown);
  paint();

  /* переход к месту из «Моих заметок»: #/read/ID?p=N */
  const goP = ctx.query && ctx.query.p != null ? parseInt(ctx.query.p, 10) : NaN;
  let goT = 0;
  if (Number.isFinite(goP) && blocks()[goP]) goT = setTimeout(() => { const b = blocks()[goP]; b.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); b.classList.add('rd-hit'); setTimeout(() => b.classList.remove('rd-hit'), 2600); }, 450);

  const cleanEnh = enhance(el);
  return {
    title: lec.short || lec.title,
    destroy() {
      flush(); clearInterval(timer); clearTimeout(goT); clearTimeout(selT); clearTimeout(scT); offBus && offBus();
      removeEventListener('scroll', onScroll); ['scroll', 'mousemove', 'keydown', 'touchstart', 'click'].forEach((t) => removeEventListener(t, act));
      document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', flush);
      document.removeEventListener('selectionchange', onSelChange); document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('click', click); pop.remove(); panel.remove(); setProgress(null); cleanEnh && cleanEnh();
    },
  };
}
