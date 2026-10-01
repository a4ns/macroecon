/* Читалка лекций — #/read/:id */
import { h, $, $$, loadCSS, plural, clamp } from '../core/dom.js';
import { index, lecture, glossary } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { setProgress } from '../ui/chrome.js';
import { TOPICS, LABS, icon, rub } from '../data/topics.js';
import { nbTree } from './_typo.js';

const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export async function load(ctx) {
  const id = ctx.params.id;
  const [ix, html, gl] = await Promise.all([index(), lecture(id).catch(() => null), glossary(), loadCSS('app/css/v-reader.css')]);
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

  el.append(h('article.rd', { style: { '--c': 'var(--' + tm.c + ')' } },
    h('header.rd__head.wrap',
      h('nav.crumbs', h('a', { href: '#/theory' }, 'Теория'), h('i', '/'), h('a', { href: '#/theory/' + lec.topic }, 'Тема ' + lec.topic)),
      h('p.rd__num.mono', rub(lec.topic) + ' · ' + lec.id),
      h('h1.rd__title', lec.title),
      h('p.rd__meta.mono', lec.min + ' мин · ' + lec.words + ' ' + plural(lec.words, ['слово', 'слова', 'слов']))),
    h('div.rd__grid.wrap', h('aside.rd__side', toc), h('div.rd__main', body, labs.length ? h('div.rd__labs', ...labs) : null,
      h('div.rd__tasks', tp.tasks && tp.tasks.includes(lec.id) ? h('a.btn.btn--sm', { href: '#/tasks/' + lec.topic + '?t=' + lec.id }, 'Задача к лекции') : null, tp.test ? h('a.btn.btn--sm', { href: '#/tests/' + lec.topic }, 'Тест по теме') : null),
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

  /* прогресс чтения */
  const onScroll = () => {
    const r = body.getBoundingClientRect(), tot = r.height - innerHeight * .6;
    setProgress(clamp(-r.top / Math.max(1, tot)));
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const cleanEnh = enhance(el);
  return {
    title: lec.short || lec.title,
    destroy() { removeEventListener('scroll', onScroll); document.removeEventListener('click', click); pop.remove(); setProgress(null); cleanEnh && cleanEnh(); },
  };
}
