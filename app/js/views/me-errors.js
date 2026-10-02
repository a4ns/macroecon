/* Журнал ошибок — #/me/errors (монтируется из me.js как обычная страница).
   Записи: ERR.data[qid] = {n, last, sel, conf, why, ok2, fixed?, sropq?}. Пояснений к вопросам в данных нет —
   честно отсылаем к лекциям темы и (если нашёлся) к термину глоссария. */
import { h, $, $$, loadCSS, plural, toast } from '../core/dom.js';
import { glossary } from '../core/data.js';
import { ERR } from '../core/state.js';
import * as qa from '../core/qa.js';
import * as sr from '../core/sr.js';
import { ctx as planCtx } from '../core/plan.js';
import { enhance } from '../core/motion.js';
import { TOPICS, rub } from '../data/topics.js';

const NB = ' ';
const WHY = ['Не знал термин', 'Перепутал понятия', 'Вычислительная ошибка', 'Невнимательно', 'Угадывал'];
const CONF = { 2: 'уверены', 1: 'скорее да', 0: 'угадывали' };
const fdate = (t) => (t ? new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5L19.5 7"/></svg>';

export async function load() {
  const [c, gl] = await Promise.all([planCtx(), glossary(), loadCSS('app/css/v-me2.css')]);
  return { c, gl };
}

/** термины глоссария, встречающиеся в тексте вопроса и вариантов (не более 2, длинные вперёд) */
export function findTerms(Q, gl) {
  const scan = (text) => {
    const out = [];
    for (const g of gl) {
      const name = g.term.replace(/[«»"]/g, '').trim();
      let hit = false;
      if (name.length >= 4) {
        const stem = name.length > 6 ? name.slice(0, -1) : name;
        hit = new RegExp('(^|[^\\p{L}])' + esc(stem) + '[\\p{L}]{0,3}(?![\\p{L}])', 'iu').test(text);
      }
      if (!hit && g.abbr && g.abbr.length >= 2) hit = new RegExp('(^|[^\\p{L}])' + esc(g.abbr) + '(?![\\p{L}])', 'u').test(text);
      if (hit) out.push(g);
    }
    return out.sort((a, b) => b.term.length - a.term.length).slice(0, 2);
  };
  /* сначала сам вопрос; варианты ответов — только если в вопросе термина нет */
  const inQ = scan(Q.q);
  return inQ.length ? inQ : scan(Q.a.map((o) => o.t).join(' '));
}

export function mount(el, ctx, { c, gl }) {
  const bank = c.bank, ix = c.ix;
  const state = { topic: 0, show: 'open' };
  const root = h('div.m2.m2e');
  const offs = [];
  el.append(root);

  const entries = () => Object.keys(ERR.data).filter((q) => bank.byQid.has(q)).map((q) => ({ qid: q, Q: bank.byQid.get(q), e: ERR.data[q] }));
  const isOpen = (x) => !x.e.fixed;
  const danger = (x) => isOpen(x) && x.e.conf === 2;
  const byRecent = (a, b) => (b.e.last || 0) - (a.e.last || 0);

  function render() {
    const all = entries(), open = all.filter(isOpen), fixed = all.filter((x) => !isOpen(x));
    const scroll = scrollY;
    root.replaceChildren();
    root.append(head(all, open, fixed));
    if (!all.length) { root.append(empty()); return; }
    root.append(filters(all));
    const list = (state.show === 'open' ? open : fixed).filter((x) => !state.topic || x.Q.topic === state.topic);
    if (state.show === 'open') {
      const dz = list.filter(danger).sort(byRecent);
      if (dz.length) root.append(h('section.m2__sec.m2e__danger', { 'aria-labelledby': 'm2e-dz' },
        h('header.m2__sh', h('h2.h3', { id: 'm2e-dz' }, 'Опасные заблуждения'), h('p.m2__hint', 'Вы отвечали «Уверен» — и ошиблись. Такие ошибки закрепляются сильнее всего, начните с них.')),
        h('div.m2e__list', ...dz.map((x) => card(x, true)))));
      const rest = list.filter((x) => !danger(x));
      if (!list.length) root.append(h('p.m2__none', state.topic ? 'В этой теме неразобранных ошибок нет.' : 'Неразобранных ошибок нет.'));
      groupByTopic(rest).forEach(([n, arr]) => root.append(h('section.m2__sec', { 'aria-label': 'Тема ' + n },
        h('header.m2__sh', h('h2.h3', rub(n) + ' ', h('em', TOPICS[n].short)), h('span.m2__cnt.mono', arr.length + NB + plural(arr.length, ['ошибка', 'ошибки', 'ошибок']))),
        h('div.m2e__list', ...arr.map((x) => card(x))))));
    } else {
      if (!list.length) root.append(h('p.m2__none', 'Решённых ошибок пока нет. Они появятся, когда вы дважды ответите верно в разные дни или нажмёте «Я разобрался».'));
      groupByTopic(list).forEach(([n, arr]) => root.append(h('section.m2__sec',
        h('header.m2__sh', h('h2.h3', rub(n) + ' ', h('em', TOPICS[n].short))),
        h('div.m2e__list', ...arr.map((x) => card(x))))));
    }
    enhance(root);
    scrollTo(0, scroll);
  }

  function groupByTopic(arr) {
    const m = new Map();
    arr.sort(byRecent).forEach((x) => { (m.get(x.Q.topic) || m.set(x.Q.topic, []).get(x.Q.topic)).push(x); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }

  function head(all, open, fixed) {
    const dz = open.filter(danger).length;
    const rev = open.length; let k;
    return h('header.m2__head',
      h('div',
        h('p.eyebrow.eyebrow--dot', 'Прогресс · ошибки'),
        h('h1.h1', { html: 'Журнал <em>ошибок</em>' }),
        h('p.lede', 'Каждая неверная попытка попадает сюда сама. Разберите причину — и вопрос вернётся к вам завтра, а потом через всё более длинные паузы.')),
      all.length ? h('div.m2__stats',
        stat(open.length, 'не разобрано'), stat(dz, 'опасных заблуждений', dz ? 'bad' : ''), stat(fixed.length, 'решено', fixed.length ? 'ok' : ''),
        h('div.m2__acts',
          h('a.btn.btn--primary', { href: rev ? '#/review/run?errors=1' : null, 'aria-disabled': rev ? null : 'true', class: rev ? '' : 'is-off', tabindex: rev ? null : '-1' }, 'Повторить ' + (k = Math.min(5, rev) || 5) + NB + plural(k, ['ошибку', 'ошибки', 'ошибок'])),
          h('a.btn', { href: '#/me/notes' }, 'Лист вопросов к СРОП'))) : null);
  }
  const stat = (n, label, tone) => h('div.m2__stat' + (tone ? '.is-' + tone : ''), h('b.num', String(n)), h('span', label));

  function filters(all) {
    const open = all.filter(isOpen), fixed = all.filter((x) => !isOpen(x));
    const topics = [...new Set(all.map((x) => x.Q.topic))].sort((a, b) => a - b);
    return h('div.m2__filters',
      h('div.m2__seg', { role: 'group', 'aria-label': 'Показать' },
        ...[['open', 'Не разобраны', open.length], ['fixed', 'Решены', fixed.length]].map(([k, l, n]) => h('button.chip', { type: 'button', 'aria-pressed': String(state.show === k), class: state.show === k ? 'is-on' : '', onclick: () => { state.show = k; render(); } }, l + ' · ' + n))),
      topics.length > 1 ? h('div.m2__seg', { role: 'group', 'aria-label': 'Тема' },
        h('button.chip', { type: 'button', 'aria-pressed': String(!state.topic), class: !state.topic ? 'is-on' : '', onclick: () => { state.topic = 0; render(); } }, 'Все темы'),
        ...topics.map((n) => h('button.chip', { type: 'button', 'aria-pressed': String(state.topic === n), class: state.topic === n ? 'is-on' : '', title: TOPICS[n].short, onclick: () => { state.topic = n; render(); } }, 'Тема ' + n))) : null);
  }

  function empty() {
    return h('section.m2__empty',
      h('div.m2__empty-ic', { 'aria-hidden': 'true', html: CHECK }),
      h('h2.h2', 'Пока ни одной ошибки'),
      h('p', 'Это нормально: журнал заполняется сам, когда вы отвечаете на вопросы теста, диагностики или повторения. Неверный ответ — не провал, а точка, где знание ещё можно починить. Здесь вы увидите вопрос, верный ответ и сможете отметить причину.'),
      h('div.m2__acts', h('a.btn.btn--primary', { href: '#/tests' }, 'Пройти тест по теме'), h('a.btn', { href: '#/diag' }, 'Пройти диагностику')));
  }

  function selText(Q, e) {
    const sel = (e.sel || []).map((k) => Q.a.find((o) => o.i === k)).filter(Boolean);
    return sel.length ? sel.map((o) => o.t) : null;
  }

  function card(x, isDanger) {
    const { Q, e, qid } = x;
    const mine = selText(Q, e), right = Q.a.filter((o) => o.ok).map((o) => o.t);
    const tp = ix.byTopic.get(Q.topic);
    const terms = findTerms(Q, gl);
    const whyBox = h('div.m2e__why', { role: 'group', 'aria-label': 'Причина ошибки' },
      ...WHY.map((w) => h('button.chip', { type: 'button', 'aria-pressed': String(e.why === w), class: e.why === w ? 'is-on' : '', onclick: (ev) => { const on = e.why !== w; qa.setWhy(qid, on ? w : ''); $$('.chip', whyBox).forEach((b) => { const a = b === ev.currentTarget && on; b.classList.toggle('is-on', a); b.setAttribute('aria-pressed', String(a)); }); } }, w)));
    const termBox = h('div.m2e__term', { hidden: true });
    const termBtns = terms.map((g) => h('button.btn.btn--sm', { type: 'button', 'aria-expanded': 'false', onclick: (ev) => {
      const b = ev.currentTarget, on = b.getAttribute('aria-expanded') !== 'true';
      $$('button', termBox.parentNode).forEach((z) => z.getAttribute('aria-expanded') && z.setAttribute('aria-expanded', 'false'));
      b.setAttribute('aria-expanded', String(on)); termBox.hidden = !on;
      if (on) termBox.replaceChildren(h('b', g.term), h('p', g.def), h('a', { href: '#/glossary?t=' + g.id }, 'В глоссарии →'));
    } }, 'Термин: ' + g.term.replace(/[«»]/g, '')));
    const lecs = tp ? tp.lectures.map((l) => h('a', { href: '#/read/' + l.id }, l.id)) : [];
    const sropBtn = h('button.btn.btn--sm', { type: 'button', 'aria-pressed': String(!!e.sropq), onclick: (ev) => { e.sropq = e.sropq ? 0 : 1; ERR.save(); const b = ev.currentTarget; b.setAttribute('aria-pressed', String(!!e.sropq)); b.textContent = e.sropq ? '✓ В листе СРОП' : 'Добавить в лист СРОП'; b.classList.toggle('is-on', !!e.sropq); toast(e.sropq ? 'Добавлено в лист вопросов к СРОП' : 'Убрано из листа вопросов к СРОП'); } }, e.sropq ? '✓ В листе СРОП' : 'Добавить в лист СРОП');
    sropBtn.classList.toggle('is-on', !!e.sropq);
    const fixed = !!e.fixed;
    const main = fixed
      ? h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: () => { delete e.fixed; e.ok2 = 0; ERR.save(true); render(); } }, 'Вернуть в разбор')
      : h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => { qa.fixError(qid); sr.grade(Q.ukey, 'bad', { type: Q.type }); toast('Отмечено. Вопрос вернётся завтра'); render(); } }, 'Я разобрался');
    const report = h('button.btn.btn--sm.btn--quiet', { type: 'button', title: 'Скопировать номер и текст вопроса, чтобы отправить преподавателю', onclick: () => copy('Неточность в вопросе ' + qid + ': ' + Q.q + '\n' + Q.a.map((o) => (o.ok ? '[верно] ' : '[ ] ') + o.t).join('\n'), 'Скопировано: номер и текст вопроса') }, 'Сообщить о неточности');
    return h('article.card.m2e__q' + (isDanger ? '.is-danger' : '') + (fixed ? '.is-fixed' : ''), { style: { '--c': 'var(--' + TOPICS[Q.topic].c + ')' } },
      h('header.m2e__h',
        h('span.m2e__id.mono', 'Вопрос ' + qid),
        h('span.m2e__meta', (e.n || 1) + NB + plural(e.n || 1, ['ошибка', 'ошибки', 'ошибок']) + ' · ' + fdate(e.last)),
        e.conf === 2 ? h('span.m2__tag.is-bad', 'Были уверены') : e.conf === 0 ? h('span.m2__tag', 'Угадывали') : null,
        fixed ? h('span.m2__tag.is-ok', 'Решена') : (e.ok2 ? h('span.m2__tag', 'верно ' + e.ok2 + ' из 2') : null)),
      h('h3.m2e__text', Q.q),
      h('dl.m2e__ans',
        h('div.is-mine', h('dt', 'Ваш ответ'), h('dd', mine ? mine.map((t) => h('span', t)) : h('span.muted', 'ответ не записан'))),
        h('div.is-right', h('dt', 'Верный ответ'), h('dd', right.map((t) => h('span', t))))),
      h('p.m2e__expl', 'Пояснение в учебнике: лекции темы ' + Q.topic + ' — ', h('span.m2e__lecs', ...lecs)),
      terms.length ? h('div.m2e__terms', ...termBtns, termBox) : null,
      !fixed ? h('div.m2e__whyw', h('p.m2__lbl', 'Почему ошиблись?'), whyBox) : (e.why ? h('p.m2__lbl', 'Причина: ' + e.why) : null),
      h('footer.m2e__f', main, sropBtn, report));
  }

  function copy(text, msg) {
    const done = () => toast(msg);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const t = h('textarea', { style: { position: 'fixed', opacity: 0 } }); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); } t.remove(); }
  }

  render();
  return { title: 'Журнал ошибок', destroy() { offs.forEach((f) => f && f()); } };
}
