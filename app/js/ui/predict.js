/* ─────────────────────────────────────────────────────────────
   ui/predict.js — «Предскажи, затем проверь» для любой модели (V3_PLAN §2.3).

   Механизм ничего не знает об экономике модели. Он читает из DOM сцены атрибуты data-mx,
   которые ставит ui/controls.js:
     slider | toggle | seg | preset   — что можно изменить (data-label, data-v)
     stat                             — что наблюдаем (data-label, data-v, data-dec)

   mountPredict({ stage, frame, labId, lectures, inst, required, onFix }) → { el, attach(), refresh(), destroy() }
     stage     — корень модели (.simview__stage), в нём ищем data-mx
     frame     — рамка (получает класс is-predicting на время «паузы»)
     lectures  — лекции темы [{id, short, title}] для кнопки «Разобрать»
     onFix     — вызывается при «Зафиксировать» (sim.js делает chart.snapshot())
   Результат пишется только через track.predict(labId, верных, всего); в QA не пишем.
   Фазы: idle → draft (пауза, форма) → armed (ждём изменения) → result.
   ───────────────────────────────────────────────────────────── */
import { h, fmt } from '../core/dom.js';
import { S } from '../core/state.js';
import * as track from '../core/track.js';
import { PREDICT_NA } from '../core/mastery.js';

const NB = ' ';
const MAX_ROWS = 6, MIN_ROWS = 2, REL_EPS = 0.005, ABS_EPS = 1e-9, QUIET_MS = 600, MAXWAIT_MS = 2600;
const KINDS = { slider: 'Параметры', preset: 'Сценарии', toggle: 'Переключатели', seg: 'Переключатели' };
const SKIP_PRESET = /^\s*(исходн|сброс|reset|вернуть)/i;
const ARROW = { up: '▲', down: '▼', flat: '=' };
const WORD = { up: 'растёт', down: 'падает', flat: 'без изменений' };

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const visible = (el) => el.getClientRects().length > 0;

/* ── чтение сцены ───────────────────────────────────────────── */
export function scan(stage, { visibleOnly = true } = {}) {
  const seen = {};
  const items = [...stage.querySelectorAll('[data-mx]')].map((el) => {
    const kind = el.dataset.mx, label = (el.dataset.label || '').trim() || kind;
    const k = kind + '|' + label; const nth = (seen[k] = (seen[k] || 0) + 1);
    return { el, kind, label, nth, key: k + '|' + nth, v: el.dataset.v, dec: num(el.dataset.dec) || 0, unit: el.dataset.unit || '', shown: label + (nth > 1 ? ' №' + nth : '') };
  }).filter((x) => !visibleOnly || visible(x.el));
  const stats = items.filter((x) => x.kind === 'stat' && Number.isFinite(num(x.v)));
  const controls = items.filter((x) => x.kind !== 'stat' && !(x.kind === 'preset' && SKIP_PRESET.test(x.label)));
  return { items, stats, controls };
}

/* «без изменений» по правилу §2.3: |Δ|/|было| < 0,5 %, для нулевых — |Δ| < 1e-9 */
export function direction(was, now) {
  const d = now - was;
  if (was === 0 ? Math.abs(d) < ABS_EPS : Math.abs(d) / Math.abs(was) < REL_EPS) return 'flat';
  return d > 0 ? 'up' : 'down';
}

function fmtDelta(was, now, dec) {
  const d = now - was; let k = Math.max(0, dec || 0);
  while (k < 6 && Number(Math.abs(d).toFixed(k)) === 0) k++;
  const sign = d > 0 ? '+' : '−';
  let t = sign + fmt(Math.abs(d), k);
  if (was !== 0 && Number.isFinite(was)) { const p = d / Math.abs(was) * 100; t += ' (' + (p > 0 ? '+' : '−') + fmt(Math.abs(p), Math.abs(p) < 10 ? 1 : 0) + NB + '%)'; }
  return t;
}

const prRec = (labId) => S.data.pr[labId] || null;
function statusText(labId) {
  const p = prRec(labId);
  if (!p || !p.n) return null;
  return 'Прогнозов: ' + p.n + (p.tot ? ' · верно ' + Math.round(100 * p.ok / p.tot) + NB + '%' : '');
}

/* ── компонент ──────────────────────────────────────────────── */
export function mountPredict(o) {
  const { stage, frame, labId, lectures = [], inst, required = false, onFix } = o;

  if (PREDICT_NA.has(labId)) {
    const el = h('p.pr.pr--na', { role: 'note' }, h('b', 'Прогноз'), ' — здесь прогноз не применим: модель показывает данные, а не реакцию на шок.');
    return { el, attach() {}, refresh() {}, destroy() {} };
  }

  const P = { phase: 'idle', choice: null, dir: null, rows: {}, why: '', base: null, baseStats: [], rowDefs: [], clicked: new Set(), hint: '', result: null };
  let obs = null, timer = 0, firstEv = 0, listenersOn = false, paused = false;

  const sum = h('summary.pr__sum');
  const body = h('div.pr__body');
  const el = h('details.pr', { open: required ? '' : null }, sum, body);
  el.dataset.phase = 'idle';
  const put = (...k) => body.replaceChildren(...k.filter(Boolean));
  const live = h('div.pr__live.sr', { 'aria-live': 'polite', role: 'status' });
  el.append(live);

  const say = (t) => { live.textContent = ''; setTimeout(() => (live.textContent = t), 30); };

  function drawSummary() {
    const st = statusText(labId);
    sum.replaceChildren(
      h('span.pr__s', 'Прогноз'),
      st ? h('span.pr__c', st) : h('span.pr__c.is-hint', 'рекомендуется: сначала прогноз'),
      h('i.pr__chev'));
  }

  /* ── пауза ───────────────────────────────────────────────── */
  const block = (e) => {
    if (!paused) return;
    if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Shift')) return;
    e.stopPropagation(); e.preventDefault();
  };
  const BLOCK_EV = ['keydown', 'keyup', 'click', 'input', 'change', 'dblclick'];
  function pause(on) {
    paused = on;
    if (frame) frame.classList.toggle('is-predicting', on);
    if (on && !listenersOn) { BLOCK_EV.forEach((t) => stage.addEventListener(t, block, true)); listenersOn = true; }
    if (!on && listenersOn) { BLOCK_EV.forEach((t) => stage.removeEventListener(t, block, true)); listenersOn = false; }
  }

  /* ── наблюдение за изменением ────────────────────────────── */
  const onClick = (e) => {
    if (P.phase !== 'armed' || paused) return;
    const b = e.target.closest && e.target.closest('[data-mx="preset"]');
    if (b && stage.contains(b)) { P.clicked.add((b.dataset.label || '').trim()); kick(); }
  };
  function watch(on) {
    if (obs) { obs.disconnect(); obs = null; }
    stage.removeEventListener('click', onClick, true);
    clearTimeout(timer); timer = 0; firstEv = 0;
    if (!on) return;
    obs = new MutationObserver(() => kick());
    obs.observe(stage, { subtree: true, attributes: true, attributeFilter: ['data-v'] });
    stage.addEventListener('click', onClick, true);
  }
  function kick() {
    if (P.phase !== 'armed') return;
    const now = performance.now(); if (!firstEv) firstEv = now;
    clearTimeout(timer);
    timer = setTimeout(check, now - firstEv > MAXWAIT_MS ? 0 : QUIET_MS);
  }

  const baseVal = (key) => (P.base.find((x) => x.key === key) || {}).v;
  function check() {
    timer = 0; firstEv = 0;
    if (P.phase !== 'armed') return;
    const cur = scan(stage, { visibleOnly: false });
    const curBy = new Map(cur.items.map((x) => [x.key, x]));
    const ch = P.choice;                                   // {kind,label,nth,key}
    const changed = P.base.filter((b) => b.kind !== 'stat' && curBy.has(b.key) && curBy.get(b.key).v !== b.v);
    const mine = curBy.get(ch.key);
    let hit = false, note = '', hint = '';
    if (ch.kind === 'preset') {
      hit = P.clicked.has(ch.label);
      const others = [...P.clicked].filter((l) => l !== ch.label);
      if (hit && others.length) note = 'Вы нажимали и другие сценарии («' + others.join('», «') + '»): сравнение с исходным состоянием условное.';
      if (!hit && P.clicked.size) hint = 'Вы нажали другой сценарий. В прогнозе — «' + ch.label + '». Нажмите его.';
    } else if (mine) {
      const was = num(baseVal(ch.key)), now = num(mine.v);
      if (ch.kind === 'slider') {
        const d = now - was;
        if (Math.abs(d) > 1e-12) {
          const dir = d > 0 ? 'up' : 'down';
          if (dir === P.dir) hit = true;
          else hint = 'В прогнозе «' + ch.label + '» ' + (P.dir === 'up' ? '▲ увеличивается' : '▼ уменьшается') + ', а вы двигаете в другую сторону. Измените значение в заявленном направлении.';
        }
      } else hit = mine.v !== baseVal(ch.key);
      const others = changed.filter((x) => x.key !== ch.key);
      if (hit && others.length) note = 'Изменены и другие параметры («' + [...new Set(others.map((x) => x.label))].join('», «') + '»): сравнение с исходным состоянием условное.';
    }
    if (!hit) {
      if (!hint && changed.some((x) => x.key !== ch.key)) hint = 'Вы изменили другой элемент. В прогнозе — «' + chosenText() + '». Измените его — тогда сравним с прогнозом.';
      if (hint !== P.hint) { P.hint = hint; drawBody(); }
      return;
    }
    finish(curBy, note);
  }

  function finish(curBy, note) {
    const rows = [];
    P.rowDefs.forEach((r) => {
      const was = num(P.baseStats.find((b) => b.key === r.key).v), c = curBy.get(r.key);
      if (!c) return;
      const now = num(c.v); if (!Number.isFinite(now)) return;
      const act = direction(was, now), pred = P.rows[r.key];
      rows.push({ key: r.key, label: r.shown, pred, act, ok: pred === act, was, now, dec: r.dec, unit: r.unit });
    });
    const asked = rows.filter((r) => r.pred);
    const okN = asked.filter((r) => r.ok).length, tot = asked.length;
    P.result = { rows: asked, ok: okN, tot, note };
    P.phase = 'result'; watch(false);
    try { track.predict(labId, okN, tot); } catch (e) { console.error(e); }
    const why = P.why.trim();
    if (why) {
      try { const p = prRec(labId); if (p) { p.notes = [...(p.notes || []), chosenText() + ' — ' + why].slice(-5); S.save(); } } catch (e) { console.error(e); }
    }
    draw(); drawSummary();
    say('Прогноз и факт. Верно ' + okN + ' из ' + tot + '.');
    const t = body.querySelector('.pr__sc'); t && t.focus({ preventScroll: true });
  }

  function chosenText() {
    const c = P.choice; if (!c) return '';
    return c.label + (c.kind === 'slider' ? (P.dir === 'up' ? ' ▲ увеличим' : ' ▼ уменьшим') : '');
  }

  /* ── отрисовка по фазам ──────────────────────────────────── */
  function draw() {
    el.dataset.phase = P.phase;
    if (P.phase === 'idle') drawIdle();
    else if (P.phase === 'draft') drawDraft();
    else if (P.phase === 'armed') drawBody();
    else drawResult();
  }
  const drawBody = () => (P.phase === 'armed' ? drawArmed() : null);

  function banner() {
    if (!required) return null;
    const done = prRec(labId) && prRec(labId).n > 0;
    return h('p.pr__req', { role: 'note' }, h('b', done ? 'Прогноз выполнен. ' : 'Шаг траектории: сначала прогноз. '),
      done ? 'Можно переходить к заданию или сделать ещё один.' : 'Для шага «Модель» нужен хотя бы один проверенный прогноз. Это мягкая подсказка: ничто не блокируется.');
  }

  function drawIdle() {
    const sc = scan(stage);
    const why = !sc.stats.length ? 'в модели нет показателей, за которыми можно следить'
      : sc.stats.length < MIN_ROWS ? 'в модели меньше двух показателей: сравнивать нечего'
        : !sc.controls.length ? 'в модели нет параметров или сценариев, которые можно изменить' : '';
    if (why) {
      put(banner(), h('p.pr__lede', 'Для этой модели прогноз неприменим: ' + why + '.'));
      return;
    }
    put(banner(),
      h('p.pr__lede', 'Сначала предскажите, как изменятся показатели, потом проверьте на модели. Так вы замечаете, чего не понимали, — это полезнее простого наблюдения.'),
      h('div.pr__act', h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: begin }, h('span', 'Сделать прогноз'))));
  }

  function begin() {
    const sc = scan(stage);
    if (sc.stats.length < MIN_ROWS || !sc.controls.length) { drawIdle(); return; }
    P.sc = sc; P.choice = null; P.dir = null; P.rows = {}; P.why = ''; P.hint = ''; P.clicked = new Set(); P.result = null;
    P.rowDefs = sc.stats.slice(0, MAX_ROWS);
    P.phase = 'draft'; pause(true); draw();
    const s = body.querySelector('select'); s && s.focus({ preventScroll: false });
    say('Модель поставлена на паузу. Заполните прогноз.');
  }

  function drawDraft() {
    const sc = P.sc;
    const sel = h('select.pr__sel', { id: 'pr-sel-' + labId, 'aria-describedby': 'pr-need-' + labId }, h('option', { value: '' }, '— выберите —'));
    const groups = {};
    sc.controls.forEach((c) => {
      const g = KINDS[c.kind] || 'Прочее';
      const og = groups[g] || (groups[g] = h('optgroup', { label: g }));
      og.append(h('option', { value: c.key }, c.shown));
    });
    Object.values(groups).forEach((g) => sel.append(g));
    if (P.choice) sel.value = P.choice.key;
    const dirBox = h('div.pr__dir', { role: 'radiogroup', 'aria-label': 'Направление изменения' });
    const dirBtns = [['up', '▲ увеличим'], ['down', '▼ уменьшим']].map(([k, t]) => h('button.chip.pr__c', { type: 'button', role: 'radio', 'aria-checked': 'false', onclick: () => { P.dir = k; paintDir(); validate(); } }, t));
    dirBox.append(...dirBtns);
    const paintDir = () => { dirBox.hidden = !(P.choice && P.choice.kind === 'slider'); dirBtns.forEach((b, i) => { const on = P.dir === ['up', 'down'][i]; b.setAttribute('aria-checked', String(on)); b.classList.toggle('is-on', on); b.tabIndex = on || (!P.dir && i === 0) ? 0 : -1; }); };
    sel.addEventListener('change', () => { P.choice = sel.value ? sc.controls.find((c) => c.key === sel.value) : null; if (!P.choice || P.choice.kind !== 'slider') P.dir = null; paintDir(); validate(); });

    const rowEls = P.rowDefs.map((r) => {
      const name = 'Как изменится «' + r.shown + '»';
      const btns = ['up', 'down', 'flat'].map((k) => h('button.chip.pr__c.pr__c--' + k, { type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': r.shown + ': ' + WORD[k], onclick: () => { P.rows[r.key] = P.rows[r.key] === k ? null : k; paint(); validate(); } },
        h('b', { 'aria-hidden': 'true' }, k === 'flat' ? '' : ARROW[k]), h('span', k === 'flat' ? 'без изменений' : WORD[k])));
      const grp = h('div.pr__chips', { role: 'radiogroup', 'aria-label': name }, ...btns);
      const paint = () => btns.forEach((b, i) => { const on = P.rows[r.key] === ['up', 'down', 'flat'][i]; b.setAttribute('aria-checked', String(on)); b.classList.toggle('is-on', on); });
      paint();
      return h('li.pr__row', h('span.pr__lab', r.shown), grp);
    });

    const why = h('input.pr__why', { type: 'text', id: 'pr-why-' + labId, maxlength: 160, autocomplete: 'off', placeholder: 'например: «выше спрос — выше доход»', value: P.why });
    why.addEventListener('input', () => { P.why = why.value; });
    const need = h('p.pr__need', { id: 'pr-need-' + labId });
    const fix = h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: fixIt }, h('span', 'Зафиксировать'));
    const cancel = h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: cancelIt }, h('span', 'Отмена'));
    function validate() {
      const filled = P.rowDefs.filter((r) => P.rows[r.key]).length;
      const min = Math.min(MIN_ROWS, P.rowDefs.length);
      let msg = '';
      if (!P.choice) msg = 'Выберите, что вы измените.';
      else if (P.choice.kind === 'slider' && !P.dir) msg = 'Укажите направление: увеличим или уменьшим.';
      else if (filled < min) msg = 'Отметьте минимум ' + min + ' показателя (' + (min - filled === 1 ? 'остался 1' : 'осталось ' + (min - filled)) + ').';
      need.textContent = msg; fix.disabled = !!msg; fix.setAttribute('aria-disabled', String(!!msg));
    }
    put(banner(),
      h('div.pr__step', h('label.pr__q', { for: 'pr-sel-' + labId }, h('i', '1'), 'Что вы измените?'), sel, dirBox),
      h('div.pr__step', h('p.pr__q#pr-q2-' + labId, h('i', '2'), 'Как изменятся показатели?'), h('ul.pr__rows', { 'aria-labelledby': 'pr-q2-' + labId }, ...rowEls)),
      h('div.pr__step', h('label.pr__q', { for: 'pr-why-' + labId }, h('i', '3'), 'Почему? ', h('small', 'одной фразой, необязательно')), why,
        h('p.pr__soft', 'Сформулировать причину полезнее, чем угадать направление.')),
      h('div.pr__act', fix, cancel, need));
    paintDir(); validate();
  }

  function cancelIt() { P.phase = 'idle'; pause(false); draw(); const b = body.querySelector('.btn'); b && b.focus(); }

  function fixIt() {
    pause(false);
    try { onFix && onFix(); } catch (e) { console.error(e); }
    const cur = scan(stage, { visibleOnly: false });
    P.base = cur.items.map((x) => ({ key: x.key, kind: x.kind, label: x.label, v: x.v }));
    P.baseStats = P.base.filter((x) => x.kind === 'stat');
    P.phase = 'armed'; P.hint = ''; P.clicked = new Set();
    draw(); watch(true);
    say('Прогноз зафиксирован. Модель разблокирована: измените выбранный параметр.');
    const t = body.querySelector('.pr__sc'); t && t.focus({ preventScroll: true });
  }

  function drawArmed() {
    const c = P.choice;
    const how = c.kind === 'preset' ? ['Нажмите сценарий ', h('b', '«' + c.label + '»'), '.']
      : c.kind === 'slider' ? ['Измените параметр ', h('b', '«' + c.label + '»'), ': ', h('b', P.dir === 'up' ? '▲ увеличьте' : '▼ уменьшите'), ' значение (ползунком или числом).']
        : ['Переключите ', h('b', '«' + c.label + '»'), '.'];
    put(banner(),
      h('p.pr__sc', { tabindex: '-1' }, h('b', 'Прогноз зафиксирован. '), 'Прежние кривые остались пунктиром. ', ...how),
      h('ul.pr__mine', ...P.rowDefs.filter((r) => P.rows[r.key]).map((r) => h('li', h('span', r.shown), h('b', ARROW[P.rows[r.key]] + NB + WORD[P.rows[r.key]])))),
      P.hint ? h('p.pr__warn', { role: 'status' }, P.hint) : null,
      h('div.pr__act', h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: () => { watch(false); P.phase = 'idle'; draw(); } }, h('span', 'Отменить прогноз'))));
  }

  function drawResult() {
    const R = P.result, all = R.ok === R.tot;
    const tb = h('table.pr__t', h('caption.sr', 'Прогноз и факт'),
      h('thead', h('tr', h('th', { scope: 'col' }, 'Показатель'), h('th', { scope: 'col' }, 'Ваш прогноз'), h('th', { scope: 'col' }, 'Факт'), h('th.pr__tc', { scope: 'col' }, h('span.sr', 'Итог')))),
      h('tbody', ...R.rows.map((r) => h('tr', { class: r.ok ? 'is-ok' : 'is-bad' },
        h('th', { scope: 'row' }, r.label),
        h('td', h('span.pr__tag', ARROW[r.pred] + NB + (r.pred === 'flat' ? 'без изм.' : WORD[r.pred]))),
        h('td', h('span.pr__tag.pr__act-v', { class: r.ok ? null : 'is-diff' }, r.act === 'flat' ? '= без изменений' : ARROW[r.act] + NB + fmtDelta(r.was, r.now, r.dec)), r.ok ? null : h('small', 'не совпало')),
        h('td.pr__tc', h('b.pr__mk', { 'aria-label': r.ok ? 'верно' : 'не совпало' }, r.ok ? '✓' : '✗'))))));
    const lec = lectures.length ? h('div.pr__lec', { hidden: true }, h('p', 'Лекции темы — найдите, какое звено рассуждения не сработало:'),
      h('ul', ...lectures.map((l) => h('li', h('a.chip', { href: '#/read/' + l.id }, h('b', l.id), ' ', l.short || l.title))))) : null;
    const bLec = !all && lec ? h('button.btn.btn--sm', { type: 'button', 'aria-expanded': 'false', onclick: () => { lec.hidden = !lec.hidden; bLec.setAttribute('aria-expanded', String(!lec.hidden)); } }, h('span', 'Разобрать')) : null;
    const more = all ? h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => { reset(); const f = stage.querySelector('[data-mx] input, [data-mx] button'); f && f.focus({ preventScroll: false }); } }, h('span', 'Теперь измените что-то ещё')) : null;
    put(banner(),
      h('h3.pr__ht', 'Прогноз и факт'),
      h('p.pr__ch', 'Вы меняли: ', h('b', chosenText())),
      tb,
      h('p.pr__sc', { tabindex: '-1', class: all ? 'is-ok' : 'is-bad' }, h('b', 'Верно ' + R.ok + ' из ' + R.tot), all ? ' — прогноз полностью совпал с моделью.' : ' — расхождения отмечены подчёркиванием.'),
      R.note ? h('p.pr__warn', R.note) : null,
      h('div.pr__act', more, bLec, h('button.btn.btn--sm' + (all ? '.btn--quiet' : ''), { type: 'button', onclick: () => { reset(); begin(); } }, h('span', 'Новый прогноз'))),
      lec);
  }

  function reset() { watch(false); pause(false); P.phase = 'idle'; P.result = null; P.hint = ''; draw(); }

  drawSummary(); draw();
  return {
    el,
    attach() { if (P.phase === 'idle') drawIdle(); },
    refresh() { drawSummary(); },
    open() { el.open = true; },
    destroy() { watch(false); pause(false); clearTimeout(timer); },
  };
}
