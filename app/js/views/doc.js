/* ─────────────────────────────────────────────────────────────
   Документы раздела «Ещё» — #/more/:page  (sro · appendix · sources · about)
   Общий рендерер: шапка, оглавление со scroll-spy, «лист» документа, индикатор чтения.
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, loadCSS, plural, fmt, clamp, reduced, esc, toast } from '../core/dom.js';
import { index, docs, glossary } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance, onScroll, reveals } from '../core/motion.js';
import { TOPICS, LABS, SECTIONS, rub } from '../data/topics.js';
import { nb, nbTree, ARROW, SEARCH, CLOSE } from './_typo.js';

export const PAGES = [
  { id: 'sro', n: 1, title: 'СРО', full: 'Самостоятельная работа обучающихся', blurb: 'Задания для самостоятельной подготовки: кроссворды, тесты, сообщения и задачи — по каждой теме курса.', c: 'd1', glyph: 'СРО' },
  { id: 'appendix', n: 2, title: 'Приложение', full: 'Приложения к упражнениям', blurb: 'Теоретические справки к лабораторным моделям: безработица, равновесие рынков, открытая экономика.', c: 'd2', glyph: 'Σ' },
  { id: 'sources', n: 3, title: 'Источники', full: 'Источники и литература', blurb: 'Учебники и пособия, на материалах которых построен курс, и электронные ресурсы.', c: 'd5', glyph: '§' },
  { id: 'about', n: 4, title: 'Об учебнике', full: 'Об учебнике', blurb: 'Титульные сведения, авторы, аннотация и устройство издания.', c: 'd4', glyph: 'М' },
];
const FIX = [['Влиние', 'Влияние'], ['уровнения', 'уравнения'], ['таварном', 'товарном'], ['плавоющих', 'плавающих'], ['соверешнной', 'совершенной']];
const fixTypos = (s) => FIX.reduce((a, [x, y]) => a.split(x).join(y), s);
const stripTags = (s) => s.replace(/<[^>]*>/g, '');
const pad2 = (n) => String(n).padStart(2, '0');
const plSrc = (n) => n + ' ' + plural(n, ['источник', 'источника', 'источников']);

export async function load(ctx) {
  const id = ctx.params.page;
  const page = PAGES.find((p) => p.id === id);
  if (!page) throw new Error('Нет такой страницы: ' + id);
  await loadCSS('app/css/v-more.css');
  const [ix, d, gl] = await Promise.all([index(), docs(), glossary()]);
  return { ix, d, gl, page };
}

export function mount(el, ctx, data) {
  const { page } = data;
  const offs = [];
  const build = { sro, appendix, sources, about }[page.id](data, offs);
  const pos = PAGES.indexOf(page), prev = PAGES[pos - 1], next = PAGES[pos + 1];

  /* оглавление */
  const tocList = h('ol.doc__toclist', ...build.toc.map((t, i) => h('li', h('a', { href: '#' + t.id, 'data-s': t.id }, h('b.mono', t.n || pad2(i + 1)), h('span', t.label)))));
  const tocBox = h('details.doc__toc', { open: true },
    h('summary', h('span.eyebrow', 'Оглавление'), h('i.doc__chev')),
    build.tocHead || null, tocList);
  const mq = matchMedia('(min-width: 1001px)');
  const syncToc = () => { tocBox.open = mq.matches; tocBox.classList.toggle('is-fixed', mq.matches); };
  syncToc(); mq.addEventListener('change', syncToc); offs.push(() => mq.removeEventListener('change', syncToc));

  const prog = h('div.doc__prog', { 'aria-hidden': 'true' }, h('i'));
  const root = h('article.wrap.doc.doc--' + page.id, { style: { '--c': 'var(--' + page.c + ')' } },
    h('div.doc__top',
      h('nav.crumbs', { 'aria-label': 'Навигация' }, h('a', { href: '#/more' }, 'Ещё'), h('i', '/'), h('span', page.title)),
      h('nav.tabs.doc__tabs', { 'aria-label': 'Документы' }, ...PAGES.map((p) => h('a', { href: '#/more/' + p.id, 'aria-current': p.id === page.id ? 'true' : null }, p.title)))),
    h('header.doc__head',
      h('p.eyebrow.eyebrow--dot', 'Документ ' + rub(page.n) + ' · ' + page.full),
      h('h1.h1.doc__t', { html: build.title }),
      h('p.lede.doc__lede', nb(build.lede)),
      build.meta ? h('ul.doc__meta', ...build.meta.map((m) => h('li', m))) : null),
    h('div.doc__grid',
      h('aside.doc__aside', tocBox),
      h('div.doc__sheet', build.sheet)),
    h('nav.doc__pn', { 'aria-label': 'Соседние документы' },
      prev ? h('a.card.doc__pn-a', { href: '#/more/' + prev.id }, h('small', '← ' + rub(prev.n)), h('b', prev.title), h('span', nb(prev.blurb))) : h('span'),
      next ? h('a.card.doc__pn-a.is-next', { href: '#/more/' + next.id }, h('small', rub(next.n) + ' →'), h('b', next.title), h('span', nb(next.blurb))) : h('a.card.doc__pn-a.is-next', { href: '#/more' }, h('small', 'Весь раздел'), h('b', 'Ещё'), h('span', 'Вернуться к списку документов'))));
  el.append(root, prog);
  nbTree($('.doc__sheet', root));

  /* ссылки оглавления — плавный скролл без смены маршрута */
  const topH = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 68);
  const secs = () => build.toc.map((t) => document.getElementById(t.id)).filter(Boolean);
  const goTo = (id) => { const t = document.getElementById(id); if (!t) return; window.scrollTo({ top: window.scrollY + t.getBoundingClientRect().top - topH() - 20, behavior: reduced() ? 'auto' : 'smooth' }); t.classList.remove('is-flash'); void t.offsetWidth; t.classList.add('is-flash'); };
  const onClick = (e) => { const a = e.target.closest && e.target.closest('a[data-s]'); if (!a) return; e.preventDefault(); goTo(a.dataset.s); if (!mq.matches) tocBox.open = false; };
  root.addEventListener('click', onClick); offs.push(() => root.removeEventListener('click', onClick));

  /* scroll-spy + индикатор */
  const links = $$('a[data-s]', tocList);
  const bar = $('i', prog);
  let curId = '';
  const spy = () => {
    const ss = secs(); let cur = ss[0];
    ss.forEach((s) => { if (s.getBoundingClientRect().top <= topH() + 140) cur = s; });
    if (cur && cur.id !== curId) {
      curId = cur.id;
      links.forEach((a) => { const on = a.dataset.s === curId; a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      const on = links.find((a) => a.dataset.s === curId);
      if (on && mq.matches) { const box = tocList.parentElement; const r = on.getBoundingClientRect(), br = (box.closest('.doc__aside') || box).getBoundingClientRect(); if (r.top < br.top || r.bottom > innerHeight - 20) on.scrollIntoView({ block: 'nearest' }); }
    }
    const sh = $('.doc__sheet', root), r = sh.getBoundingClientRect();
    bar.style.transform = 'scaleX(' + clamp((-r.top + innerHeight * .35) / Math.max(1, r.height - innerHeight * .2)).toFixed(4) + ')';
  };
  spy(); offs.push(onScroll(spy));
  offs.push(enhance(el));
  if (ctx.query.s) setTimeout(() => goTo(ctx.query.s), 250);

  return { title: page.title, destroy() { offs.forEach((f) => { try { f && f(); } catch (e) { /* ignore */ } }); prog.remove(); } };
}

/* ═════════════════════ СРО ═════════════════════ */
function sro({ ix, d }, offs) {
  const doneKey = 'more.sro';
  const done = new Set((store.get(doneKey, []) || []).map(Number));
  const items = d.sro.map(parseSro);
  const ring = h('div.doc__prog-t', h('b.num', { 'data-r': '' }), h('span', 'выполнено'), h('div.doc__bar', h('i')));
  const upd = () => {
    const n = items.filter((i) => done.has(i.num)).length;
    $('b', ring).textContent = n + ' / ' + items.length; $('.doc__bar i', ring).style.transform = 'scaleX(' + (n / items.length).toFixed(3) + ')';
    const m = $('.doc__meta [data-done]'); if (m) m.textContent = 'Выполнено ' + n + ' из ' + items.length;
    $$('.doc__toclist li').forEach((li, i) => li.classList.toggle('is-done', done.has(items[i].num)));
  };
  const sheet = h('div.sro-list');
  items.forEach((it) => {
    const tm = TOPICS[it.topic] || TOPICS[1], tp = ix.byTopic.get(it.topic);
    const labs = (tp && tp.lab) || [];
    const cb = h('input', { type: 'checkbox', checked: done.has(it.num), 'aria-label': 'СРО ' + it.num + ' выполнена' });
    cb.addEventListener('change', () => { cb.checked ? done.add(it.num) : done.delete(it.num); store.set(doneKey, [...done]); sec.classList.toggle('is-done', cb.checked); upd(); if (cb.checked) toast('СРО ' + it.num + ' отмечена выполненной'); });
    const sec = h('section.sro.doc__sec' + (done.has(it.num) ? '.is-done' : ''), { id: 'sro-' + it.num, style: { '--c': 'var(--' + tm.c + ')' }, 'aria-labelledby': 'sro-h-' + it.num },
      h('header.sro__h',
        h('span.sro__n.display', pad2(it.num)),
        h('div.sro__t',
          h('div.sro__badges', h('span.sro__kind', it.kind), h('span.sro__topic.mono', 'Тема ' + it.topic)),
          h('h2.h2.sro__h2', { id: 'sro-h-' + it.num }, nb(it.name)))),
      h('div.doc__prose', { html: it.html }),
      h('footer.sro__f',
        h('div.sro__links',
          h('a.chip', { href: '#/theory/' + it.topic }, 'Теория'),
          tp && tp.tasks && tp.tasks.length ? h('a.chip', { href: '#/tasks/' + it.topic }, 'Задачи по теме') : null,
          ...labs.map((l) => h('a.chip', { href: '#/lab/' + l }, 'Модель: ' + ((LABS[l] || {}).short || l))),
          tp && tp.test ? h('a.chip', { href: '#/tests/' + it.topic }, 'Тест') : null),
        h('label.sro__done', cb, h('span.sro__box'), h('span', 'Выполнено'))));
    sheet.append(sec);
  });
  const topics = new Set(items.map((i) => i.topic)).size;
  const b = {
    title: 'Самостоятельная <em>работа</em>',
    lede: 'Пятнадцать заданий для самостоятельной подготовки — кроссворды, тесты, сообщения и расчётные задачи. Отмечайте выполненные: прогресс сохраняется в вашем браузере.',
    meta: [items.length + ' ' + plural(items.length, ['задание', 'задания', 'заданий']), 'по ' + topics + ' ' + plural(topics, ['теме', 'темам', 'темам']), h('span', { 'data-done': '' }, '')],
    tocHead: ring,
    toc: items.map((i) => ({ id: 'sro-' + i.num, n: pad2(i.num), label: i.name })),
    sheet,
  };
  setTimeout(upd, 0);
  return b;
}
function parseSro(item) {
  const m = item.title.match(/СРО\s*(\d+)\s*\.?\s*Тема\s*«?(.*?)»?\s*$/i);
  const num = m ? +m[1] : item.n;
  const name = fixTypos(m ? m[2].trim() : item.title).replace(/\s+/g, ' ');
  const box = document.createElement('div'); box.innerHTML = fixTypos(item.html);
  const first = box.firstElementChild;
  if (first && /^СРО\s*\d+\.?\s*$/.test(first.textContent.trim())) first.remove();
  const lead = (box.firstElementChild && box.firstElementChild.textContent) || '';
  const km = lead.match(/^(?:Подготовить\s+)?(.+?)\s+по\s+следующим/i);
  let kind = km ? km[1].trim() : 'Задание';
  kind = ({ 'письменную работу': 'письменная работа', 'решение задач': 'решение задач' })[kind.toLowerCase()] || kind;
  kind = kind.charAt(0).toUpperCase() + kind.slice(1);
  return { num, topic: item.topic, name, kind, html: richBody(box).innerHTML };
}

/* сгруппировать «1. …» в нумерованные списки, разметить требования, формулы и т. п. */
function richBody(box) {
  const out = document.createElement('div');
  let ol = null;
  const isNum = (s) => /^\s*\d+[.)]\s+/.test(stripTags(s));
  const li = (html) => h('li', { html: html.replace(/^\s*(<b>)?\s*\d+[.)]\s*(<\/b>)?\s*/i, '').trim() });
  [...box.children].forEach((p) => {
    if (p.tagName !== 'P') { out.append(p); ol = null; return; }
    const html = p.innerHTML.trim();
    const parts = html.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1 && parts.filter(isNum).length >= 2) {
      const lead = [], items = [];
      parts.forEach((s) => { if (isNum(s)) items.push(s); else if (items.length) items[items.length - 1] += ' ' + s; else lead.push(s); });
      if (lead.length) out.append(h('p.doc__lead', { html: lead.join(' ') }));
      out.append(h('ol.qlist', ...items.map(li))); ol = null; return;
    }
    if (parts.length === 1 && isNum(html)) { if (!ol) { ol = h('ol.qlist'); out.append(ol); } ol.append(li(html)); return; }
    ol = null;
    const txt = p.textContent;
    if (/^\s*Требования/i.test(txt)) p.classList.add('req');
    else if (/^\s*Форма контроля/i.test(txt)) p.classList.add('ctl');
    else if (/^\s*Задача\s*\d*/i.test(txt) && p.querySelector('b')) p.classList.add('task');
    else if (/[—―]{3,}/.test(txt) || ((txt.match(/=/g) || []).length >= 2 && (txt.match(/[А-Яа-яЁё]{3,}/g) || []).length <= 6)) p.classList.add('fx');
    else if (out.children.length === 0 && /по следующим|вопросам/.test(txt)) p.classList.add('doc__lead');
    out.append(p);
  });
  return out;
}

/* ═════════════════════ Приложение ═════════════════════ */
function appendix({ ix, d }) {
  const items = d.appendix.map((a, i) => {
    const m = a.title.match(/упражнению\s+(\d+)\.(\d+)\s*:?\s*(.*)$/i);
    const labId = m ? 'ex' + m[1] + '-' + m[2] : '';
    const lab = ix.labs.get(labId);
    const code = m ? m[1] + '.' + m[2] : '';
    const name = fixTypos(m && m[3] ? m[3].trim() : (lab ? ((LABS[labId] || {}).short || lab.title) : a.title));
    const box = document.createElement('div'); box.innerHTML = fixTypos(a.html);
    return { id: 'apx-' + (i + 1), i: i + 1, code, labId: lab ? labId : '', name, topic: a.topic, html: richBody(box).innerHTML, lab };
  });
  const sheet = h('div.apx-list', ...items.map((it) => {
    const tm = TOPICS[it.topic] || TOPICS[1];
    return h('section.apx.doc__sec', { id: it.id, style: { '--c': 'var(--' + tm.c + ')' }, 'aria-labelledby': it.id + '-h' },
      h('header.apx__h',
        h('span.apx__n.display', pad2(it.i)),
        h('div.apx__t', h('p.eyebrow', it.code ? 'К упражнению ' + it.code : 'Приложение'), h('h2.h2', { id: it.id + '-h' }, nb(it.name)))),
      h('div.doc__prose', { html: it.html }),
      h('footer.apx__f',
        it.labId ? h('a.btn.btn--sm', { href: '#/lab/' + it.labId, title: 'Модель «' + ((LABS[it.labId] || {}).short || it.lab.title) + '»', html: 'Открыть модель ' + ARROW }) : null,
        h('a.chip', { href: '#/theory/' + it.topic }, 'Тема ' + it.topic)));
  }));
  return {
    title: 'Приложения к <em>упражнениям</em>',
    lede: 'Теоретические справки, на которые опираются лабораторные модели: естественная безработица, равновесие товарного и денежного рынков, модель открытой экономики.',
    meta: [items.length + ' ' + plural(items.length, ['приложение', 'приложения', 'приложений']), 'с формулами'],
    toc: items.map((it) => ({ id: it.id, n: pad2(it.i), label: (it.code ? it.code + '. ' : '') + it.name })),
    sheet,
  };
}

/* ═════════════════════ Источники ═════════════════════ */
function sources({ d }) {
  const clean = (s) => nb(s.replace(/\s+/g, ' ').replace(/\s[-–_]\s/g, ' — ').replace(/\.\s*[-–]\s*(?=\d)/g, '. — ').replace(/С-Пб/g, 'СПб').replace(/,\s*(\d{4})\s*\.?\s*[-–]\s*(?=\d)/, ', $1. — ').replace(/(\d)\s*(?:с|стр)(?![а-яё])\.?/g, '$1 с.').replace(/\.\s*—\s*—/g, '. —').trim());
  const items = d.sources.map((s, i) => {
    const yr = (s.match(/\b(19[89]\d|20[0-2]\d)\b/g) || []).pop();
    const pg = (s.match(/(\d{2,4})\s*(?:с|стр)(?![а-яё])/g) || []).pop();
    const m = s.match(/^([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+(?:[А-ЯЁ]\.\s?){1,2})/);
    return { i: i + 1, raw: s, text: clean(s), year: yr ? +yr : 0, pages: pg ? pg.replace(/\D+/g, '') : '', author: m ? m[1].trim() : '', fold: s.toLowerCase().replace(/ё/g, 'е') };
  });
  let mode = 'list', fq = '';
  const status = h('p.src__status.mono', { 'aria-live': 'polite' });
  const list = h('ol.src');
  const online = d.sources_online ? [].concat(d.sources_online) : [];

  const input = h('input', { type: 'search', placeholder: 'Автор, название, издательство…', 'aria-label': 'Поиск по источникам', autocomplete: 'off', spellcheck: 'false' });
  const clr = h('button.src__x', { type: 'button', hidden: true, 'aria-label': 'Очистить', html: CLOSE });
  const modes = [['list', 'По списку'], ['year', 'По году ↓'], ['abc', 'А–Я']];
  const seg = h('div.tabs.src__seg', { role: 'group', 'aria-label': 'Порядок' }, ...modes.map(([k, l]) => { const b = h('button', { type: 'button', 'data-m': k, 'aria-pressed': String(k === mode) }, l); b.addEventListener('click', () => { mode = k; render(); }); return b; }));

  function render() {
    const toks = fq.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
    let rows = items.filter((it) => toks.every((t) => it.fold.includes(t)));
    if (mode === 'year') rows = [...rows].sort((a, b) => b.year - a.year || a.i - b.i);
    else if (mode === 'abc') rows = [...rows].sort((a, b) => a.raw.localeCompare(b.raw, 'ru'));
    list.textContent = '';
    rows.forEach((it, k) => {
      const hi = (s) => (toks.length ? esc(s).replace(new RegExp('(' + toks.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark>$1</mark>') : esc(s));
      list.append(h('li.src__i.rv', { style: { '--d': Math.min(k, 8) * .03 + 's', '--n': '"' + pad2(it.i) + '"' } },
        h('span.src__n.mono', pad2(it.i)),
        h('div.src__b', h('p.src__t', { html: hi(it.text) }),
          h('div.src__m', it.year ? h('span.chip', it.year) : null, it.pages ? h('span.chip', fmt(+it.pages) + ' с.') : null,
            h('button.src__cp', { type: 'button', title: 'Скопировать описание', 'aria-label': 'Скопировать описание источника', onClick: () => { (navigator.clipboard ? navigator.clipboard.writeText(it.text.replace(/ /g, ' ')) : Promise.reject()).then(() => toast('Источник скопирован'), () => toast('Не удалось скопировать')); } }, 'Копировать')))));
    });
    if (!rows.length) list.append(h('li.src__empty', 'Ничего не нашлось. Попробуйте другое слово.'));
    $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
    $$('button', seg).forEach((b) => b.toggleAttribute('aria-current', b.dataset.m === mode));
    status.textContent = toks.length ? 'Найдено ' + rows.length + ' из ' + items.length : '';
    clr.hidden = !fq;
    reveals(list);
  }
  input.addEventListener('input', () => { fq = input.value.trim(); render(); });
  clr.addEventListener('click', () => { input.value = ''; fq = ''; render(); input.focus(); });
  render();

  const sheet = h('div.src-wrap',
    h('section.doc__sec', { id: 'lit', 'aria-labelledby': 'lit-h' },
      h('header.sec-t', h('h2.h2', { id: 'lit-h', html: 'Основная и <em>дополнительная</em> литература' })),
      h('div.src__tools', h('label.src__q', h('span.src__qi', { html: SEARCH }), input, clr), seg, status),
      list),
    online.length ? h('section.doc__sec', { id: 'web', 'aria-labelledby': 'web-h' },
      h('header.sec-t', h('h2.h2', { id: 'web-h', html: 'Электронные <em>ресурсы</em>' })),
      h('ul.web', ...online.map((s) => {
        const dm = (s.match(/\(([a-z0-9.-]+\.[a-z]{2,})\)/i) || [])[1];
        return h('li.card.web__i', h('p', nb(s.replace(/\s*\([a-z0-9.-]+\.[a-z]{2,}\)\s*$/i, ''))),
          dm ? h('a.btn.btn--sm', { href: 'https://' + dm, target: '_blank', rel: 'noopener noreferrer', html: dm + ' ' + ARROW }) : null);
      }))) : null);
  return {
    title: '<em>Источники</em> и литература',
    lede: 'Учебники и пособия, на материалах которых построен курс. Найдите автора или издание, отсортируйте список по году.',
    meta: [plSrc(items.length), online.length ? online.length + ' ' + plural(online.length, ['электронный ресурс', 'электронных ресурса', 'электронных ресурсов']) : null].filter(Boolean),
    toc: [{ id: 'lit', n: '01', label: 'Литература' }].concat(online.length ? [{ id: 'web', n: '02', label: 'Электронные ресурсы' }] : []),
    sheet,
  };
}

/* ═════════════════════ Об учебнике ═════════════════════ */
function about({ ix, d, gl }) {
  const nLect = ix.lectures.length, nLab = ix.labList.length, nTopic = ix.topics.length;
  const nTasks = ix.topics.reduce((a, t) => a + (t.tasks || []).length, 0);
  const annot = document.createElement('div'); annot.innerHTML = d.annotation;
  if (annot.firstElementChild && /^\s*Авторы/i.test(annot.firstElementChild.textContent)) annot.firstElementChild.remove();
  const intro = document.createElement('div'); intro.innerHTML = d.intro;
  const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  const curve = '<svg class="ttl__art" viewBox="0 0 320 220" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1" opacity=".18">' + [0, 1, 2, 3, 4, 5].map((i) => '<path d="M0 ' + (i * 44) + 'H320"/>').join('') + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path d="M' + (i * 46) + ' 0V220"/>').join('') + '</g><path class="ttl__c1" d="M14 18C90 40 170 120 306 196" stroke="var(--d2)" stroke-width="4" stroke-linecap="round"/><path class="ttl__c2" d="M14 196C110 176 190 90 306 24" stroke="var(--d1)" stroke-width="4" stroke-linecap="round"/><circle cx="160" cy="108" r="7" fill="var(--accent)"/><circle class="ttl__ring" cx="160" cy="108" r="7" stroke="var(--accent)" stroke-width="1.6"/></svg>';
  const sheet = h('div.about',
    h('section.doc__sec.ttl', { id: 'ab-title', 'aria-label': 'Титульные сведения' },
      h('div.ttl__sheet',
        h('div.ttl__top', h('p.eyebrow', 'Электронное учебное издание'), h('span.ttl__year.mono', '2018')),
        h('h2.ttl__t.display', h('span', 'Макро'), h('span.ttl__t2', 'экономика')),
        h('p.ttl__sub', 'Интерактивный учебник для экономических специальностей'),
        h('div.ttl__art', { html: curve }),
        h('dl.ttl__meta',
          h('div', h('dt', 'Учебник'), h('dd', 'Макроэкономика')),
          h('div', h('dt', 'Университет'), h('dd', h('abbr', { title: 'Северо-Казахстанский государственный университет им. М. Козыбаева' }, 'СКГУ им. М. Козыбаева'))),
          h('div', h('dt', 'Кафедра'), h('dd', 'Экономика и учёт')),
          h('div', h('dt', 'Год'), h('dd.num', '2018'))))),
    h('section.doc__sec', { id: 'ab-authors', 'aria-labelledby': 'ab-authors-h' },
      h('header.sec-t', h('p.eyebrow', 'Составители'), h('h2.h2', { id: 'ab-authors-h', html: 'Авторы <em>издания</em>' })),
      h('ul.authors', ...d.authors.map((a, i) => h('li.card.author', h('span.author__i.display', initials(a.name)), h('div', h('b', a.name), h('span', nb(a.role))))))),
    h('section.doc__sec', { id: 'ab-annot', 'aria-labelledby': 'ab-annot-h' },
      h('header.sec-t', h('p.eyebrow', 'Аннотация'), h('h2.h2', { id: 'ab-annot-h', html: 'О чём <em>учебник</em>' })),
      h('div.doc__prose.doc__prose--lg', { html: annot.innerHTML })),
    h('section.doc__sec', { id: 'ab-intro', 'aria-labelledby': 'ab-intro-h' },
      h('header.sec-t', h('p.eyebrow', 'Предисловие'), h('h2.h2', { id: 'ab-intro-h', html: 'От <em>составителей</em>' })),
      h('div.doc__prose.doc__prose--lg', { html: intro.innerHTML })),
    h('section.doc__sec', { id: 'ab-struct', 'aria-labelledby': 'ab-struct-h' },
      h('header.sec-t', h('p.eyebrow', 'Структура'), h('h2.h2', { id: 'ab-struct-h', html: 'Из чего <em>состоит</em> издание' })),
      h('div.struct', ...[
        ['#/theory', 'Теория', nLect + ' ' + plural(nLect, ['лекция', 'лекции', 'лекций']) + ' по ' + nTopic + ' темам', 'd1'],
        ['#/lab', 'Лаборатория', nLab + ' ' + plural(nLab, ['модель', 'модели', 'моделей']) + ' с заданиями', 'd2'],
        ['#/tasks', 'Задачи', nTasks + ' ' + plural(nTasks, ['задача', 'задачи', 'задач']) + ' с проверкой', 'd3'],
        ['#/tests', 'Тесты', 'вопросы по каждой теме', 'd4'],
        ['#/glossary', 'Глоссарий', gl.length + ' ' + plural(gl.length, ['термин', 'термина', 'терминов']), 'd5'],
        ['#/more/sro', 'СРО и приложения', 'самостоятельная работа и справки', 'd6'],
      ].map(([href, t, p, c], i) => h('a.card.struct__c', { href, style: { '--c': 'var(--' + c + ')' } }, h('span.struct__n.display', pad2(i + 1)), h('b', t), h('span', nb(p)), h('i', { html: ARROW }))))),
    h('section.doc__sec', { id: 'ab-use', 'aria-labelledby': 'ab-use-h' },
      h('header.sec-t', h('p.eyebrow', 'Подсказки'), h('h2.h2', { id: 'ab-use-h', html: 'Как <em>пользоваться</em>' })),
      h('ul.tips',
        h('li', h('span.tips__k', h('kbd.kbd', 'Ctrl'), h('kbd.kbd', 'K')), h('p', nb('Поиск по всему учебнику: лекции, модели, задачи, термины. На компьютерах Apple — '), h('kbd.kbd', '⌘K'), '.')),
        h('li', h('span.tips__k', h('kbd.kbd', '/')), h('p', nb('В глоссарии клавиша «/» сразу переводит курсор в строку поиска.'))),
        h('li', h('span.tips__k.tips__sun', { 'aria-hidden': 'true' }, '◐'), h('p', nb('Две темы оформления — тёмная «Night Atlas» и светлая «Paper»: переключатель в шапке сайта.'))),
        h('li', h('span.tips__k.tips__sun', { 'aria-hidden': 'true' }, '✓'), h('p', nb('Прогресс — прочитанные лекции, решённые задачи, отмеченные СРО — хранится в вашем браузере.'))))));
  return {
    title: 'Об <em>учебнике</em>',
    lede: 'Макроэкономика — электронное учебное издание Северо-Казахстанского государственного университета им. М. Козыбаева, 2018 год.',
    meta: ['2018', 'СКГУ им. М. Козыбаева', d.authors.length + ' ' + plural(d.authors.length, ['автор', 'автора', 'авторов'])],
    toc: [{ id: 'ab-title', n: '01', label: 'Титул' }, { id: 'ab-authors', n: '02', label: 'Авторы' }, { id: 'ab-annot', n: '03', label: 'Аннотация' }, { id: 'ab-intro', n: '04', label: 'Предисловие' }, { id: 'ab-struct', n: '05', label: 'Структура' }, { id: 'ab-use', n: '06', label: 'Подсказки' }],
    sheet,
  };
}
