/* ─────────────────────────────────────────────────────────────
   qrun — движок одного вопроса (mc / ms / tf) для повторения, экзамена, диагностики.
   const r = mountQuestion(root, { Q, mode, conf = true, reveal = 'now'|'later', index, total, keys = true, onAnswer })
     Q        — подготовленный вопрос (qid.prepare); sel в onAnswer — индексы в Q.a в показанном порядке
     conf     — перед фиксацией ответа просим уверенность: 2 «Уверен», 1 «Скорее да», 0 «Угадываю» (без conf → conf = -1)
     reveal   — 'now': после ответа подсветка верного/неверного и верный ответ; 'later': только фиксируем выбор
     keys     — цифры 1…9 выбирают вариант, Q / W / E (по физической клавише) — уверенность, Enter — «Проверить»/«Ответить»
   onAnswer({ ok, sel:number[], conf, ms }) — один раз. Вопрос НЕ пишет в журнал: qa.record вызывает вызывающий.
   Возвращает { destroy(), lock(), el, state() }. state() → { answered, locked, sel, conf, ok, revealed }.
   Нажатие Enter, которым вопрос сам зафиксировал ответ, гасится (stopImmediatePropagation + флаг e.qrunHandled),
   чтобы обработчик «Дальше» у вызывающего не сработал тут же.
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, loadCSS, reduced } from '../core/dom.js';

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
const NB = ' ';
const svg = (inner, sw = 2.4) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });
const P_OK = '<path d="m4.5 12.5 5 5L19.5 7"/>', P_X = '<path d="M6 6l12 12M18 6 6 18"/>';
export const CONF = [
  { v: 2, label: 'Уверен', key: 'KeyQ', k: 'Q' },
  { v: 1, label: 'Скорее да', key: 'KeyW', k: 'W' },
  { v: 0, label: 'Угадываю', key: 'KeyE', k: 'E' },
];
const tfLabel = (t) => (/^ложь$/i.test(t) ? 'Неверно' : t);

/** 'mc' | 'ms' | 'tf' */
export const typeOfQ = (Q) => (Q.type === 'ms' || Q.type === 'tf' ? Q.type : 'mc');
/** верно ли: множество выбранных = множеству верных вариантов */
export function isCorrect(Q, sel) {
  const s = new Set(sel);
  return Q.a.every((o, k) => !!o.ok === s.has(k)) && s.size > 0;
}

export function mountQuestion(root, o) {
  const { Q, mode = 0, conf: wantConf = true, reveal = 'now', index, total, keys = true, onAnswer } = o;
  loadCSS('app/css/v-qrun.css');
  const type = typeOfQ(Q), multi = type === 'ms';
  const st = { answered: false, locked: false, sel: new Set(), conf: wantConf ? null : -1, ok: null, revealed: false };
  const t0 = performance.now();
  let committedAt = 0, timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };

  const kind = type === 'tf' ? 'Верно или неверно' : multi ? 'Несколько ответов' : 'Один ответ';
  const hint = multi ? 'Отметьте все верные варианты' : type === 'tf' ? 'Выберите одно' : 'Выберите один вариант';
  const opts = Q.a.map((a, k) => {
    const b = h('button.qr-opt', { type: 'button', role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false', 'data-k': k },
      h('span.qr-opt__k', type === 'tf' ? (/^верно$/i.test(a.t) ? '✓' : '✕') : LETTERS[k] || k + 1),
      h('span.qr-opt__t', type === 'tf' ? tfLabel(a.t) : a.t),
      h('span.qr-opt__m', { 'aria-hidden': 'true' }));
    b.addEventListener('click', () => pick(k));
    return b;
  });
  const group = h('div.qr-opts', { role: multi ? 'group' : 'radiogroup', 'aria-labelledby': 'qr-q' }, ...opts);

  const chips = CONF.map((c) => {
    const b = h('button.qr-cf__c', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-v': c.v, title: 'Клавиша ' + c.k }, c.label);
    b.addEventListener('click', () => setConf(c.v));
    return b;
  });
  const cfBox = wantConf ? h('div.qr-cf', { role: 'radiogroup', 'aria-label': 'Насколько вы уверены в ответе' }, h('span.qr-cf__l', 'Насколько вы уверены?'), h('div.qr-cf__r', ...chips)) : null;

  const fb = h('div.qr-fb', { role: 'status', 'aria-live': 'polite' });
  const bGo = h('button.btn.btn--primary.qr-go', { type: 'button', disabled: true }, reveal === 'now' ? 'Проверить' : 'Ответить', svg(P_OK));
  bGo.addEventListener('click', commit);
  const need = h('p.qr-need', { hidden: true, 'aria-live': 'polite' });
  const card = h('article.qr.qr-card', { 'data-type': type, 'data-mode': mode },
    h('div.qr-meta', h('span.qr-badge', kind),
      index != null && total ? h('span.qr-n', index + NB + 'из' + NB + total) : null,
      h('span.qr-hint', hint)),
    h('h2.qr-q#qr-q', { tabindex: '-1' }, Q.q),
    cfBox, group, need, fb,
    h('div.qr-act', bGo));
  root.append(card);
  if (!reduced()) card.classList.add('is-in');
  try { $('.qr-q', card).focus({ preventScroll: true }); } catch (e) { /* */ }

  function refresh() {
    const ready = st.sel.size > 0 && (!wantConf || st.conf !== null);
    // одиночный выбор фиксируется сам (выбор + уверенность); кнопка нужна только для ms
    bGo.disabled = !ready;
    bGo.hidden = !multi || st.locked;
    const miss = [];
    if (!st.sel.size) miss.push(multi ? 'отметьте варианты' : 'выберите вариант');
    if (wantConf && st.conf === null) miss.push('оцените уверенность');
    if (!st.locked && st.sel.size && miss.length) { need.hidden = false; need.textContent = 'Ещё: ' + miss.join(' и ') + '.'; } else need.hidden = true;
  }
  function setConf(v) {
    if (st.locked) return;
    st.conf = v;
    chips.forEach((b) => { const on = +b.dataset.v === v; b.setAttribute('aria-checked', String(on)); b.classList.toggle('is-on', on); });
    refresh();
    if (!multi && st.sel.size) commit();
  }
  function pick(k) {
    if (st.locked) return;
    if (multi) { st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); }
    else st.sel = new Set([k]);
    opts.forEach((b, j) => { const on = st.sel.has(j); b.classList.toggle('is-sel', on); b.setAttribute('aria-checked', String(on)); });
    refresh();
    if (!multi && (!wantConf || st.conf !== null)) commit();
    else if (!multi && wantConf && st.conf === null && cfBox && !reduced()) { cfBox.classList.remove('is-nudge'); void cfBox.offsetWidth; cfBox.classList.add('is-nudge'); }
  }
  function commit() {
    if (st.locked || !st.sel.size || (wantConf && st.conf === null)) return;
    st.locked = st.answered = true; committedAt = performance.now();
    const sel = [...st.sel].sort((a, b) => a - b), ok = isCorrect(Q, sel);
    st.ok = ok;
    group.classList.add('is-locked'); cfBox && cfBox.classList.add('is-locked');
    opts.forEach((b) => { b.disabled = true; }); chips.forEach((b) => { b.disabled = true; });
    bGo.hidden = true; need.hidden = true;
    if (reveal === 'now') showReveal(sel, ok); else { card.classList.add('is-sent'); fb.replaceChildren(h('p.qr-sent', 'Ответ записан.')); }
    const res = { ok, sel, conf: st.conf, ms: Math.round(committedAt - t0) };
    onAnswer && onAnswer(res);
  }
  function showReveal(sel, ok) {
    st.revealed = true;
    const picked = new Set(sel);
    Q.a.forEach((a, k) => {
      const el = opts[k], chosen = picked.has(k), mark = $('.qr-opt__m', el);
      el.classList.remove('is-sel');
      if (a.ok && chosen) { el.classList.add('is-ok'); mark.append(svg(P_OK, 2.6)); mark.dataset.t = 'верно'; }
      else if (!a.ok && chosen) { el.classList.add('is-bad'); mark.append(svg(P_X, 2.6)); mark.dataset.t = 'ошибка'; }
      else if (a.ok) { el.classList.add('is-miss'); mark.append(svg(P_OK, 2.6)); mark.dataset.t = 'пропущен'; }
      else el.classList.add('is-dim');
    });
    card.classList.add(ok ? 'is-right' : 'is-wrong');
    const right = Q.a.filter((a) => a.ok).map((a) => (type === 'tf' ? tfLabel(a.t) : a.t));
    const partial = !ok && multi && Q.a.some((a, k) => a.ok && picked.has(k));
    const title = ok ? 'Верно' : partial ? 'Не совсем' : 'Неверно';
    const body = [];
    if (!ok) body.push(h('p.qr-fb__r', right.length > 1 ? 'Верные ответы: ' : 'Верный ответ: ', ...right.flatMap((r, i) => [i ? '; ' : '', h('b', '«' + r.replace(/[.;]+$/, '') + '»')])));
    if (ok && multi) body.push(h('p.qr-fb__r', 'Вы отметили все верные варианты.'));
    if (!ok && st.conf === 2) body.push(h('p.qr-fb__n', 'Вы были уверены — такие ошибки стоит разобрать в первую очередь.'));
    if (ok && st.conf === 0) body.push(h('p.qr-fb__n', 'Ответ верный, но вы угадывали — карточка вернётся завтра.'));
    if (Q.topic) body.push(h('a.qr-fb__l', { href: '#/course/' + Q.topic }, 'Лекции темы' + NB + Q.topic, svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2)));
    fb.replaceChildren(h('div.qr-fb__b.' + (ok ? 'is-ok' : 'is-bad'), h('strong.qr-fb__t', svg(ok ? P_OK : P_X, 2.8), title), ...body));
    fb.classList.add('is-in');
  }

  const onKey = (e) => {
    if (!keys || e.ctrlKey || e.metaKey || e.altKey || !root.isConnected) return;
    const tg = e.target;
    if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
    if (st.locked) return;
    if (/^[1-9]$/.test(e.key)) { const k = +e.key - 1; if (k < Q.a.length) { e.preventDefault(); pick(k); } return; }
    if (wantConf) { const c = CONF.find((x) => x.key === e.code); if (c) { e.preventDefault(); setConf(c.v); return; } }
    if (e.key === 'Enter' && !(tg && tg.tagName === 'BUTTON' && root.contains(tg) && tg !== bGo)) {
      if (st.sel.size && (!wantConf || st.conf !== null)) { e.preventDefault(); e.stopImmediatePropagation(); e.qrunHandled = true; commit(); }
    }
  };
  if (keys) document.addEventListener('keydown', onKey, true);
  refresh();

  return {
    el: card,
    lock() { if (!st.locked) { st.locked = true; group.classList.add('is-locked'); cfBox && cfBox.classList.add('is-locked'); opts.forEach((b) => { b.disabled = true; }); chips.forEach((b) => { b.disabled = true; }); bGo.hidden = true; need.hidden = true; } },
    state: () => ({ answered: st.answered, locked: st.locked, sel: [...st.sel].sort((a, b) => a - b), conf: st.conf === null ? null : st.conf, ok: st.ok, revealed: st.revealed }),
    destroy() { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey, true); card.remove(); },
  };
}
