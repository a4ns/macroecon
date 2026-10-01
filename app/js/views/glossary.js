/* ─────────────────────────────────────────────────────────────
   Глоссарий — #/glossary, #/glossary/:letter  (?t=<id> подсвечивает термин, ?q=<слово> — поиск)
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, loadCSS, plural, fmt, reduced, esc, toast } from '../core/dom.js';
import { index, glossary, searchIndex } from '../core/data.js';
import { enhance, reveals } from '../core/motion.js';
import { TOPICS } from '../data/topics.js';
import { nb, ARROW, SEARCH, CLOSE } from './_typo.js';

const D = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const BADGE_RE = /\s*\(([^()]*)\)\s*$/;
const fold = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/\u00ad/g, '');
const words = (s) => fold(s).split(/[^a-zа-я0-9]+/).filter(Boolean);
const STOP = new Set(['и', 'в', 'во', 'на', 'по', 'с', 'со', 'к', 'о', 'у', 'из', 'за', 'от', 'не', 'но', 'а', 'для', 'при', 'или']);
const stem = (t) => (t.length >= 9 ? t.slice(0, -3) : t.length >= 6 ? t.slice(0, -2) : t);

/* ── data preparation ─────────────────────────────────────────── */
let PREP = null;
function prepare(raw) {
  if (PREP) return PREP;
  const items = raw.map((r) => {
    let title = r.term.replace(/\s+/g, ' ').trim(), badge = '';
    const m = title.match(BADGE_RE);
    if (m && (/[A-Za-z]/.test(m[1]) || /^[А-ЯЁ]{2,6}$/.test(m[1]))) { badge = m[1].trim().replace(/\s*[-–—]\s*/g, ' — '); title = title.replace(BADGE_RE, '').trim(); }
    const main = title.replace(/\([^)]*\)/g, ' ');
    const def = nb(r.def.replace(/\s+/g, ' ').trim());
    return {
      id: r.id, num: r.id.replace(/\D/g, '').padStart(3, '0'), letter: r.letter.toUpperCase(), title: nb(title), badge, def,
      abbr: r.abbr || '', sortKey: fold(title.replace(/^«/, '')),
      fTitle: fold(r.term + ' ' + (r.abbr || '')), fDef: fold(r.def),
      toks: words(main).filter((t) => !STOP.has(t)), abbrTok: /^[А-ЯЁ]{2,6}$/.test(r.abbr || '') ? fold(r.abbr) : '',
    };
  });
  items.sort((a, b) => a.letter.localeCompare(b.letter, 'ru') || a.sortKey.localeCompare(b.sortKey, 'ru'));
  const letters = [...new Set(items.map((i) => i.letter))];
  const by = new Map(items.map((i) => [i.id, i]));
  letters.forEach((l, i) => { items.filter((x) => x.letter === l).forEach((x) => { x.c = D[i % 6]; }); });
  return (PREP = { items, letters, by });
}

/* ── mentions: in which lectures does a term occur ────────────── */
const tokHit = (w, t) => (t.length <= 3 ? w === t : w.startsWith(stem(t)));
function lectureWords(text) {
  const ws = words(text), uniq = new Map();
  ws.forEach((w, i) => { (uniq.get(w) || uniq.set(w, []).get(w)).push(i); });
  return uniq;
}
function positions(uniq, t) {
  const out = [];
  uniq.forEach((arr, w) => { if (tokHit(w, t)) for (const p of arr) out.push(p); });
  return out.sort((a, b) => a - b);
}
function countPhrase(uniq, toks, W) {
  if (!toks.length) return 0;
  const lists = toks.map((t) => positions(uniq, t));
  if (lists.some((l) => !l.length)) return 0;
  if (lists.length === 1) return lists[0].length;
  lists.sort((a, b) => a.length - b.length);
  let n = 0, last = -99;
  for (const p of lists[0]) {
    if (p - last <= W) continue;
    if (lists.slice(1).every((l) => l.some((q) => Math.abs(q - p) <= W))) { n++; last = p; }
  }
  return n;
}
function computeMentions(lecs, items, ix) {
  const map = new Map(items.map((i) => [i.id, []]));
  const lw = lecs.map((l) => ({ id: l.id, u: lectureWords(l.text || '') }));
  const tocTerms = new Map(ix.lectures.map((l) => [l.id, (l.terms || []).map((t) => words(t).filter((x) => !STOP.has(x)))]));
  items.forEach((it) => {
    const res = [];
    lw.forEach(({ id, u }) => {
      let n = countPhrase(u, it.toks, it.toks.length > 2 ? 7 : 4);
      if (it.abbrTok) n += (u.get(it.abbrTok) || []).length;
      const def = (tocTerms.get(id) || []).some((tt) => tt.length && it.toks.length && it.toks.every((t) => tt.some((w) => tokHit(w, t) || tokHit(t, w))) && tt.every((w) => it.toks.some((t) => tokHit(w, t) || tokHit(t, w))));
      if (n > 0 || def) res.push({ id, n, def });
    });
    res.sort((a, b) => (b.def - a.def) || (b.n - a.n) || a.id.localeCompare(b.id, 'en', { numeric: true }));
    map.set(it.id, res);
  });
  return map;
}

/* ── search ───────────────────────────────────────────────────── */
function makeQuery(q) {
  const toks = words(q);
  const res = toks.map((t) => new RegExp('(^|[^a-zа-я0-9])' + stem(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const hl = toks.length ? new RegExp('(?<![а-яёa-z0-9])(?:' + toks.map((t) => stem(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]')).join('|') + ')[а-яёa-z0-9]*', 'giu') : null;
  return { toks, res, hl };
}
function runSearch(items, Q) {
  const out = [];
  items.forEach((it) => {
    let s = 0;
    for (const re of Q.res) {
      let k = 0;
      if (re.test(it.fTitle)) k = 4 + (it.fTitle.startsWith(Q.toks[0]) ? 1 : 0); else if (re.test(it.fDef)) k = 1;
      if (!k) { s = 0; break; } s += k;
    }
    if (s) out.push([s, it]);
  });
  out.sort((a, b) => b[0] - a[0] || a[1].sortKey.localeCompare(b[1].sortKey, 'ru'));
  return out.map((x) => x[1]);
}
const mark = (text, Q) => (Q && Q.hl ? esc(text).replace(Q.hl, (m) => '<mark>' + m + '</mark>') : esc(text));

/* ── icons ────────────────────────────────────────────────────── */
const I_DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const I_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

/* ── page ─────────────────────────────────────────────────────── */
export async function load() {
  await loadCSS('app/css/v-glossary.css');
  const [ix, raw] = await Promise.all([index(), glossary()]);
  return { ix, P: prepare(raw) };
}

export function mount(el, ctx, { ix, P }) {
  const { items, letters, by } = P;
  const offs = [];
  const total = items.length;
  const counts = new Map(letters.map((l) => [l, items.filter((i) => i.letter === l).length]));
  let letter = null, q = '', Q = null, hitId = '', mentions = null, timer = 0, ghostI = 0;

  const search = h('input', { type: 'search', placeholder: 'Найти: инфляция, мультипликатор…', 'aria-label': 'Поиск по глоссарию', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search' });
  const clearBtn = h('button.gl-search__x', { type: 'button', 'aria-label': 'Очистить поиск', hidden: true, html: CLOSE });
  const status = h('p.gl-status', { 'aria-live': 'polite' });
  const ghost = h('div.gl-hero__ghost', { 'aria-hidden': 'true' }, h('span', 'А'));
  const randomBtn = h('button.btn.btn--sm.gl-rand', { type: 'button', title: 'Показать случайный термин', html: I_DICE + '<span>Случайный термин</span>' });

  const rail = h('nav.gl-rail', { 'aria-label': 'Алфавитный указатель' },
    h('a.gl-rail__a.gl-rail__all', { href: '#/glossary', 'data-l': '', title: 'Все термины' }, h('b', 'Все'), h('i', total)),
    ...letters.map((l) => h('a.gl-rail__a', { href: '#/glossary/' + encodeURIComponent(l), 'data-l': l, title: counts.get(l) + ' ' + plural(counts.get(l), ['термин', 'термина', 'терминов']) + ' на «' + l + '»' }, h('b', l), h('i', counts.get(l)))));
  const list = h('div.gl-list');

  el.append(h('div.gl.wrap',
    h('header.gl-hero',
      ghost,
      h('p.eyebrow.eyebrow--dot.rv', 'Глоссарий · ' + total + ' ' + plural(total, ['термин', 'термина', 'терминов'])),
      h('h1.display.gl-hero__t.rv', { style: { '--d': '.05s' }, html: 'Язык <span class="hl">макро</span>экономики' }),
      h('p.lede.gl-hero__lede.rv', { style: { '--d': '.1s' } }, 'От агрегирования до эффекта Фишера: определения в одном месте. Ищите по слову, листайте по алфавиту — и переходите в лекции, где термин встречается.'),
      h('div.gl-tools.rv', { style: { '--d': '.16s' } },
        h('label.gl-search', h('span.gl-search__i', { html: SEARCH }), search, clearBtn, h('kbd.kbd.gl-search__k', '/')),
        randomBtn),
      status),
    h('div.gl-body', rail, list)));

  /* ── cards ─────────────────────────────────────────────────── */
  const lecName = (id) => { const l = ix.byLec.get(id); return l ? (l.short || l.title) : id; };
  function card(it, i, pop) {
    const body = h('article.card.gl-card' + (pop === 'rv' ? '.rv' : ''), { id: 't-' + it.id, style: { '--c': 'var(--' + it.c + ')', '--d': pop === 'rv' ? (i % 2) * .08 + 's' : null, '--i': pop === 'pop' ? Math.min(i, 14) : null }, 'aria-labelledby': 'h-' + it.id });
    if (pop === 'pop') body.classList.add('gl-pop');
    const copy = h('button.gl-card__cp', { type: 'button', title: 'Скопировать определение', 'aria-label': 'Скопировать определение', html: I_COPY });
    copy.addEventListener('click', () => {
      const txt = it.title + (it.badge ? ' (' + it.badge + ')' : '') + ' — ' + it.def.replace(/\u00a0/g, ' ');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Определение скопировано'), () => toast('Не удалось скопировать'));
    });
    body.append(
      h('div.gl-card__top', h('span.gl-card__n.mono', '№ ' + it.num), it.badge ? h('span.gl-card__b', it.badge) : null, copy),
      h('h3.gl-card__t', { id: 'h-' + it.id, html: Q ? mark(it.title, Q) : esc(it.title) }),
      h('p.gl-card__d', { html: Q ? mark(it.def, Q) : esc(it.def) }),
      h('div.gl-card__l', { 'data-id': it.id }));
    return body;
  }

  function paintMentions(root) {
    $$('.gl-card__l', root).forEach((box) => {
      const it = by.get(box.dataset.id); box.textContent = ''; box.classList.remove('is-load');
      if (!mentions) { box.classList.add('is-load'); box.append(h('span.gl-card__lt', 'Ищем в лекциях'), h('i'), h('i'), h('i')); return; }
      const ms = mentions.get(it.id) || [];
      if (!ms.length) { box.append(h('span.gl-card__lt.is-none', 'В лекциях отдельно не упоминается')); return; }
      const SHOW = 4, rest = ms.slice(SHOW);
      box.append(h('span.gl-card__lt', ms.some((m) => m.def) ? 'Определяется и встречается' : 'Встречается в лекциях'));
      const row = h('div.gl-card__row');
      const chip = (m) => {
        const tp = TOPICS[(ix.byLec.get(m.id) || {}).topic] || TOPICS[1];
        return h('a.gl-lec' + (m.def ? '.is-def' : ''), { href: '#/read/' + m.id, style: { '--c': 'var(--' + tp.c + ')' }, title: 'Лекция ' + m.id + '. ' + lecName(m.id) + (m.n ? ' — упоминаний: ' + m.n : '') + (m.def ? ' (определение)' : '') },
          h('b', m.id), h('span', lecName(m.id)));
      };
      ms.slice(0, SHOW).forEach((m) => row.append(chip(m)));
      if (rest.length) {
        const more = h('button.gl-lec.gl-lec--more', { type: 'button', 'aria-expanded': 'false' }, '+' + rest.length);
        more.addEventListener('click', () => { rest.forEach((m) => row.insertBefore(chip(m), more)); more.remove(); });
        row.append(more);
      }
      box.append(row);
    });
  }

  /* ── render ────────────────────────────────────────────────── */
  function setStatus(txt) { status.innerHTML = txt; }
  function render({ scrollTo } = {}) {
    list.textContent = '';
    const frag = document.createDocumentFragment();
    let shown = 0;
    if (q) {
      const res = runSearch(items, Q);
      shown = res.length;
      setStatus(res.length ? 'Найдено <b class="num">' + res.length + '</b> из ' + total + ' по запросу «' + esc(q) + '»' : '');
      if (!res.length) frag.append(empty('Ничего не нашлось по запросу «' + q + '»', 'Попробуйте часть слова («инфляц», «рефинанс») или перейдите по алфавиту.'));
      else frag.append(h('div.gl-grid', ...res.map((it, i) => card(it, i, 'pop'))));
    } else if (letter && !counts.has(letter)) {
      frag.append(empty('На букву «' + letter + '» терминов нет', 'Выберите другую букву в указателе.'));
      setStatus('');
    } else {
      const ls = letter ? [letter] : letters;
      let k = 0;
      ls.forEach((l) => {
        const its = items.filter((i) => i.letter === l);
        shown += its.length;
        const c = its[0].c;
        frag.append(h('section.gl-sec', { id: 'L-' + l, style: { '--c': 'var(--' + c + ')' }, 'aria-label': 'Буква ' + l },
          h('header.gl-sec__h' + (letter ? '.gl-pop' : '.rv'), { style: { '--i': 0 } }, h('h2.gl-sec__l', { 'aria-label': 'Буква ' + l }, l), h('p.gl-sec__n.mono', its.length + ' ' + plural(its.length, ['термин', 'термина', 'терминов']))),
          h('div.gl-grid', ...its.map((it, i) => card(it, k++, letter ? 'pop' : 'rv')))));
      });
      if (letter) {
        const li = letters.indexOf(letter), pv = letters[li - 1], nx = letters[li + 1];
        frag.append(h('nav.gl-pn', { 'aria-label': 'Соседние буквы' },
          pv ? h('a.card.gl-pn__a', { href: '#/glossary/' + encodeURIComponent(pv), 'data-l': pv }, h('small', '← Предыдущая'), h('b', pv), h('span', counts.get(pv) + ' ' + plural(counts.get(pv), ['термин', 'термина', 'терминов']))) : h('span'),
          h('a.btn.btn--sm', { href: '#/glossary', 'data-l': '' }, 'Весь алфавит'),
          nx ? h('a.card.gl-pn__a.is-next', { href: '#/glossary/' + encodeURIComponent(nx), 'data-l': nx }, h('small', 'Следующая →'), h('b', nx), h('span', counts.get(nx) + ' ' + plural(counts.get(nx), ['термин', 'термина', 'терминов']))) : h('span')));
      }
      setStatus('');
    }
    list.append(frag);
    paintMentions(list);
    reveals(list);
    // rail state
    $$('.gl-rail__a', rail).forEach((a) => {
      const l = a.dataset.l;
      const on = !q && (l === (letter || ''));
      a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      a.classList.toggle('is-dim', !!q);
    });
    clearBtn.hidden = !q;
    ghostSet();
    document.title = (letter && !q ? 'Глоссарий — ' + letter : 'Глоссарий') + ' · Макро';
    if (scrollTo) focusTerm(scrollTo);
  }
  function empty(t, p) {
    const sug = items.filter((_, i) => i % 11 === 3).slice(0, 5);
    return h('div.gl-empty', h('b.gl-empty__g', '∅'), h('h3.h3', t), h('p', nb(p)),
      h('div.gl-empty__s', ...sug.map((s) => h('a.chip', { href: '#/glossary/' + encodeURIComponent(s.letter) + '?t=' + s.id }, s.title))));
  }
  function focusTerm(id) {
    const c = $('#t-' + id, list); if (!c) return;
    const go = () => { c.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); c.classList.remove('is-hit'); void c.offsetWidth; c.classList.add('is-hit'); setTimeout(() => c.classList.remove('is-hit'), 2800); };
    requestAnimationFrame(() => requestAnimationFrame(go));
  }

  /* ghost letter in the hero: follows the chosen letter, wanders through the alphabet otherwise */
  function ghostSet(ch) {
    const t = ch || (q ? '?' : letter ? letter : letters[ghostI % letters.length]);
    const s = ghost.firstChild;
    if (s.textContent === t) return;
    s.textContent = t; ghost.classList.remove('is-in'); void ghost.offsetWidth; ghost.classList.add('is-in');
  }
  function startGhost() {
    if (reduced()) return;
    timer = setInterval(() => { if (!letter && !q && !document.hidden) { ghostI++; ghostSet(); } }, 2600);
  }

  /* ── state / routing ───────────────────────────────────────── */
  function route(c, first) {
    const p = c.params.letter ? decodeURIComponent(c.params.letter).toUpperCase() : null;
    letter = p;
    if (c.query.q != null && first) { q = c.query.q; search.value = q; Q = q ? makeQuery(q) : null; if (Q && !Q.toks.length) { q = ''; Q = null; } }
    hitId = c.query.t && by.has(c.query.t) ? c.query.t : '';
    if (hitId && !letter) letter = by.get(hitId).letter;
    if (hitId && by.get(hitId).letter !== letter) letter = by.get(hitId).letter;
    if (hitId && q) { q = ''; search.value = ''; Q = null; }
    render({ scrollTo: hitId });
  }
  function navLetter(l, push = true) {
    if (q) { q = ''; search.value = ''; Q = null; }
    letter = l || null;
    const url = '#/glossary' + (l ? '/' + encodeURIComponent(l) : '');
    if (push && location.hash !== url) history.pushState(null, '', url);
    render();
    const top = $('.gl-body', el);
    if (top && top.getBoundingClientRect().top < 0) window.scrollTo({ top: window.scrollY + top.getBoundingClientRect().top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 68) - 24, behavior: reduced() ? 'auto' : 'smooth' });
  }

  const onClick = (e) => {
    const a = e.target.closest && e.target.closest('a[data-l]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); navLetter(a.dataset.l);
  };
  el.addEventListener('click', onClick); offs.push(() => el.removeEventListener('click', onClick));

  search.addEventListener('input', () => {
    q = search.value.trim(); Q = q ? makeQuery(q) : null;
    if (Q && !Q.toks.length) { q = ''; Q = null; }
    render();
  });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { search.value = ''; search.dispatchEvent(new Event('input')); e.stopPropagation(); } });
  clearBtn.addEventListener('click', () => { search.value = ''; search.dispatchEvent(new Event('input')); search.focus(); });
  const onKey = (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    e.preventDefault(); search.focus(); search.select();
  };
  window.addEventListener('keydown', onKey); offs.push(() => window.removeEventListener('keydown', onKey));

  randomBtn.addEventListener('click', () => {
    let it; do { it = items[Math.floor(Math.random() * items.length)]; } while (it.id === hitId && items.length > 1);
    if (q) { q = ''; search.value = ''; Q = null; }
    hitId = it.id; letter = it.letter;
    history.pushState(null, '', '#/glossary/' + encodeURIComponent(it.letter) + '?t=' + it.id);
    render({ scrollTo: it.id });
  });

  /* ── lectures index (lazy) ─────────────────────────────────── */
  let dead = false;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
  searchIndex().then((s) => { if (dead) return; idle(() => { if (dead) return; try { mentions = computeMentions(s.filter((d) => d.t === 'lec'), items, ix); } catch (e) { console.warn('mentions failed', e); mentions = new Map(items.map((i) => [i.id, []])); } paintMentions(list); }); })
    .catch(() => { mentions = new Map(items.map((i) => [i.id, []])); paintMentions(list); });

  route(ctx, true);
  startGhost();
  const clean = enhance(el);
  if (!hitId && ctx.query.focus) search.focus();

  return {
    title: letter ? 'Глоссарий — ' + letter : 'Глоссарий',
    update(c) { route(c, false); },
    destroy() { dead = true; clearInterval(timer); offs.forEach((f) => f()); clean && clean(); },
  };
}
