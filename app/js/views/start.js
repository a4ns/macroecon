/* Знакомство — #/start: «Кто вы?», тур из четырёх экранов, предложение входной диагностики.
   Роль и имя пишутся в S.data.role / S.data.prof; всё необязательно, всё можно пропустить. */
import { h, $, loadCSS } from '../core/dom.js';
import { S } from '../core/state.js';
import { TOPICS } from '../data/topics.js';

const NB = ' ';
const svgI = (inner, cls) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls || null, html: inner });
const ARROW = '<path d="M5 12h14M13 6l6 6-6 6"/>';
const ROLES = [
  { v: 'student', t: 'Студент', p: 'Иду по курсу: план на день, повторение, подготовка к рубежному контролю и экзамену.', ic: '<path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 12v4.2c0 1.3 2.5 2.6 5.5 2.6s5.5-1.3 5.5-2.6V12"/><path d="M21.5 9.5v5"/>' },
  { v: 'teacher', t: 'Преподаватель', p: 'Презентация лекции, варианты и задания из банка, печать, сводка по группе.', ic: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 9h5M7 12h8"/>' },
  { v: 'self', t: 'Самоучка', p: 'Без группы и без внешнего ритма: недельный план, диагностика, самопроверка.', ic: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
];
const TOUR = [
  { k: 'Карта', t: 'Курс — это карта из 14 тем', p: ['Каждая тема — узел на карте. Дуга вокруг узла растёт по мере того, как вы читаете, решаете задачи и проходите тесты.', 'Состояние всегда подписано словом: «Изучается», «Пройдена», «Освоена». Цвет — только подсказка.'] },
  { k: 'Траектория', t: 'У каждой темы — короткая траектория', p: ['Лекции, модель, задачи, тест, повторение, СРО. Следующий шаг подсвечен, а время каждого шага подписано.', 'Замков нет: можно идти в любом порядке. Подсветка лишь отвечает на вопрос «что дальше?».'] },
  { k: 'Повторение', t: 'Повторение возвращает забытое', p: ['Карточки возвращаются примерно через 1, 3, 7, 14 и 30 дней: чем лучше вы помните, тем реже они приходят.', 'Ошибка в тесте или задаче сама кладёт вопрос в колоду на завтра. Число карточек на сегодня видно на вкладке «Повторение».'] },
  { k: 'Где что', t: 'Где что лежит', p: ['Шесть мест — и больше ничего. Если потерялись, откройте «Сегодня»: там всегда один главный шаг.'] },
];
const WHERE = [
  ['Сегодня', 'Один главный шаг и два запасных', '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>', 'd1'],
  ['Курс', 'Карта 14 тем и траектория каждой', '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h5.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H16"/>', 'd2'],
  ['Повторение', 'Карточки на сегодня и ошибки', '<rect x="3.5" y="7" width="13" height="12" rx="2"/><path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4H19a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 1-1.5 1.5H16.5"/>', 'd4'],
  ['Прогресс', 'Освоение, пробелы, журнал ошибок', '<path d="M4 20h16"/><rect x="5" y="12" width="3.5" height="8" rx="1"/><rect x="10.25" y="8" width="3.5" height="12" rx="1"/><rect x="15.5" y="4" width="3.5" height="16" rx="1"/>', 'd5'],
  ['Библиотека', 'Лекции, модели, задачи, тесты, глоссарий', '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>', 'd6'],
  ['Настройки', 'Роль, календарь, резервная копия', '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', 'd3'],
];
const STEPS = 1 + TOUR.length + 1;          // кто вы · 4 экрана · диагностика

export const load = () => loadCSS('app/css/v-start.css');

/* ── иллюстрации ─────────────────────────────────────────── */
function mapArt() {
  const xs = [44, 112, 180, 248, 316, 384, 452], pts = [];
  for (let n = 1; n <= 14; n++) { const row = n <= 7 ? 0 : 1, i = row ? 14 - n : n - 1; pts.push([xs[i], row ? 214 : 86, n]); }
  const path = `M${pts[0][0]} 86H452C500 86 500 214 452 214H44`;
  const L = 2 * Math.PI * 17, state = (n) => (n <= 3 ? 'done' : n === 4 ? 'going' : 'none');
  const nodes = pts.map(([x, y, n], i) => {
    const s = state(n), c = `var(--${TOPICS[n].c})`;
    return `<g transform="translate(${x} ${y})"><g class="st-node" style="--i:${i};color:${c}">
      <circle r="17" fill="var(--surface)" stroke="var(--line-3)" stroke-width="2.4" ${s === 'none' ? 'stroke-dasharray="2 4"' : ''}/>
      ${s === 'going' ? `<circle r="17" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${(L * .55).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90)"/>` : ''}
      ${s === 'done' ? `<circle r="19" fill="currentColor"/><path d="m-6 .6 4.2 4.2 8-8.2" fill="none" stroke="var(--bg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : `<text y="4.5" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink-2)" font-family="var(--f-mono)">${n}</text>`}
    </g></g>`;
  }).join('');
  return `<svg class="st-art st-art--map" viewBox="0 0 500 300" role="img" aria-label="Пример карты: три темы освоены, четвёртая изучается, остальные не начаты">
    <path class="st-path" d="${path}" fill="none" stroke="var(--line-3)" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round"/>
    ${nodes}
    <g font-family="var(--f-mono)" font-size="11" letter-spacing="1.4" fill="var(--ink-3)"><text x="44" y="144">ПРИМЕР</text></g>
  </svg>`;
}
function trailArt() {
  const S6 = [['Лекции', '≈ 20 мин'], ['Модель', '≈ 10 мин'], ['Задачи', '≈ 15 мин'], ['Тест темы', '≈ 6 мин'], ['Повторение', '≈ 5 мин'], ['СРО', 'по заданию']];
  return h('ol.st-trail', { 'aria-label': 'Пример траектории темы' }, ...S6.map(([t, m], i) => h('li', { class: i < 2 ? 'is-done' : i === 2 ? 'is-next' : '', style: { '--i': i } },
    h('span.st-trail__n', { 'aria-hidden': 'true', html: i < 2 ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' : String(i + 1) }),
    h('span.st-trail__t', t, h('small', i < 2 ? 'сделано' : i === 2 ? 'следующий шаг · ' + m : m)))));
}
function srArt() {
  const D = [1, 3, 7, 14, 30], xs = [40, 118, 206, 316, 430];
  const arcs = xs.map((x, i) => (i ? `<path class="st-arc" style="--i:${i}" d="M${xs[i - 1]} 150Q${(xs[i - 1] + x) / 2} ${150 - 22 - i * 16} ${x} 150" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>` : '')).join('');
  const dots = xs.map((x, i) => `<g class="st-dot" style="--i:${i}"><circle cx="${x}" cy="150" r="9" fill="${i ? 'var(--surface)' : 'var(--accent)'}" stroke="var(--accent)" stroke-width="2.4"/>${i ? '' : ''}<text x="${x}" y="186" text-anchor="middle" font-size="12" fill="var(--ink-2)" font-family="var(--f-mono)">${i ? 'через ' + D[i - 1] + NB + (D[i - 1] === 1 ? 'день' : D[i - 1] < 5 ? 'дня' : 'дней') : 'сегодня'}</text></g>`).join('');
  return `<svg class="st-art" viewBox="0 0 500 220" role="img" aria-label="Карточка возвращается через 1, 3, 7, 14 и 30 дней: интервалы растут">
    <path d="M30 150H470" stroke="var(--line-2)" stroke-width="2"/>${arcs}${dots}
    <text x="30" y="40" font-size="11" letter-spacing="1.4" fill="var(--ink-3)" font-family="var(--f-mono)">КАЖДЫЙ ВЕРНЫЙ ОТВЕТ — ДАЛЬШЕ ПРОМЕЖУТОК</text>
    <text x="30" y="60" font-size="11" letter-spacing="1.4" fill="var(--ink-3)" font-family="var(--f-mono)">ОШИБКА — ЗАВТРА</text>
  </svg>`;
}

export function mount(el, ctx) {
  let step = 0, offs = [];
  const prof = S.data.prof;
  const set = (patch) => { Object.assign(S.data, patch); S.save(); };
  const root = h('div.onb.wrap');
  el.append(root);
  const $stage = h('section.onb__stage', { 'aria-live': 'polite' });
  const dots = h('ol.onb__dots', { 'aria-label': 'Шаги знакомства' }, ...Array.from({ length: STEPS }, (_, i) => h('li', h('i'))));
  const skip = h('button.onb__skip', { type: 'button', onclick: () => go(STEPS - 1) }, 'Пропустить');
  const nav = h('footer.onb__nav');
  root.append(h('header.onb__top', h('p.eyebrow.eyebrow--dot', 'Знакомство'), dots, skip), $stage, nav);

  const finish = () => { S.data.seen.start = Date.now(); S.save(); };
  function go(n, dir = 1) {
    step = Math.max(0, Math.min(STEPS - 1, n));
    render(dir);
  }
  function render(dir) {
    [...dots.children].forEach((li, i) => { li.className = i < step ? 'is-done' : i === step ? 'is-cur' : ''; if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    dots.setAttribute('aria-label', `Шаг ${step + 1} из ${STEPS}`);
    skip.hidden = step === STEPS - 1;
    const pane = step === 0 ? paneWho() : step < STEPS - 1 ? paneTour(step - 1) : paneOffer();
    pane.classList.add('onb__pane'); pane.dataset.dir = dir > 0 ? 'f' : 'b';
    $stage.replaceChildren(pane);
    renderNav();
    const hd = $('[data-focus]', pane); if (hd) { hd.tabIndex = -1; hd.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }
  function renderNav() {
    nav.replaceChildren();
    if (step === STEPS - 1) return;
    nav.append(step > 0 ? h('button.btn.btn--quiet', { type: 'button', onclick: () => go(step - 1, -1) }, svgI('<path d="M19 12H5M11 6l-6 6 6 6"/>', 'onb__back'), 'Назад') : h('span'),
      h('button.btn.btn--primary', { type: 'button', onclick: () => { if (step === 0) saveProf(); go(step + 1); } }, step === 0 ? 'Продолжить' : step === STEPS - 2 ? 'К диагностике' : 'Дальше', svgI(ARROW)));
  }

  /* 1 · Кто вы */
  let nameI, grpI;
  const saveProf = () => { if (!nameI) return; prof.name = nameI.value.trim().slice(0, 60); prof.grp = grpI.value.trim().slice(0, 20); S.save(); };
  function paneWho() {
    const cards = ROLES.map((r, i) => h('button.st-role', { type: 'button', role: 'radio', 'aria-checked': S.data.role === r.v ? 'true' : 'false', tabIndex: (S.data.role ? S.data.role === r.v : i === 0) ? 0 : -1, 'data-v': r.v, style: { '--i': i }, onclick: () => pick(r.v) },
      h('span.st-role__ic', svgI(r.ic)), h('b', r.t), h('span', r.p), h('i.st-role__ok', { 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' })));
    const group = h('div.st-roles', { role: 'radiogroup', 'aria-label': 'Кто вы' }, ...cards);
    const pick = (v) => { set({ role: v }); cards.forEach((c) => { const on = c.dataset.v === v; c.setAttribute('aria-checked', String(on)); c.tabIndex = on ? 0 : -1; }); };
    group.addEventListener('keydown', (e) => {
      if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return; e.preventDefault();
      const i = cards.indexOf(document.activeElement), d = /Right|Down/.test(e.key) ? 1 : -1, n = cards[(i + d + cards.length) % cards.length]; n.focus(); pick(n.dataset.v);
    });
    nameI = h('input.st-in', { type: 'text', id: 'st-name', autocomplete: 'name', maxlength: 60, value: prof.name || '', placeholder: 'Например, Айгерим' });
    grpI = h('input.st-in', { type: 'text', id: 'st-grp', maxlength: 20, value: prof.grp || '', placeholder: 'Например, ЭК-21' });
    [nameI, grpI].forEach((i) => i.addEventListener('change', saveProf));
    return h('div.st-who',
      h('p.onb__k', 'Шаг 1'),
      h('h1.display.onb__h', { 'data-focus': '' }, 'Кто вы?'),
      h('p.lede', 'Роль не ограничивает возможности — она только расставляет акценты в меню и на главной.'),
      group,
      h('div.st-prof',
        h('div.st-fld', h('label', { for: 'st-name' }, 'Как к вам обращаться', h('small', ' · необязательно')), nameI),
        h('div.st-fld', h('label', { for: 'st-grp' }, 'Группа', h('small', ' · необязательно')), grpI)),
      h('p.onb__fine', 'Имя и группа остаются в этом браузере. Они понадобятся только для справки о прохождении.'));
  }

  /* 2–5 · тур */
  function paneTour(i) {
    const T = TOUR[i];
    const art = i === 0 ? h('div.st-art-box', { html: mapArt() }) : i === 1 ? h('div.st-art-box', trailArt()) : i === 2 ? h('div.st-art-box', { html: srArt() }) : null;
    const where = i === 3 ? h('ul.st-where', ...WHERE.map(([t, p, ic, c], j) => h('li', { style: { '--i': j, '--c': 'var(--' + c + ')' } }, h('span.st-where__ic', svgI(ic)), h('b', t), h('span', p)))) : null;
    return h('div.st-tour' + (where ? '.st-tour--wide' : ''),
      h('div.st-tour__txt',
        h('p.onb__k', `${T.k} · ${i + 1}${NB}из${NB}${TOUR.length}`),
        h('h1.display.onb__h.onb__h--s', { 'data-focus': '' }, T.t),
        ...T.p.map((x) => h('p.onb__p', x))),
      art || where);
  }

  /* 6 · диагностика */
  function paneOffer() {
    const teacher = S.data.role === 'teacher';
    const later = () => { finish(); location.hash = '#/today'; };
    return h('div.st-offer',
      h('p.onb__k', 'Последний шаг'),
      h('h1.display.onb__h', { 'data-focus': '', html: 'Входная <em>диагностика</em>' }),
      h('div.st-offer__grid',
        h('div.st-offer__stats', h('p', h('b', '28'), h('span', 'вопросов')), h('p', h('b', '≈12'), h('span', 'минут'))),
        h('div.st-offer__txt',
          h('p.lede', 'По два вопроса из каждой из 14 тем и вопрос «насколько вы уверены». Это не оценка, а карта: по ней видно, с каких тем начать.'),
          h('p.onb__fine', 'Два вопроса на тему — грубая оценка. Результат: «Знакомо», «Частично» или «Новое».'))),
      h('div.st-offer__cta',
        h('a.btn.btn--primary.btn--lg', { href: '#/diag', onclick: finish }, 'Пройти сейчас', svgI(ARROW)),
        h('button.btn.btn--lg', { type: 'button', onclick: later }, 'Позже'),
        teacher ? h('a.btn.btn--quiet', { href: '#/teach', onclick: finish }, 'В кабинет преподавателя') : null),
      h('p.onb__fine', 'Диагностику можно пройти позже: она всегда доступна на вкладке «Сегодня».'));
  }

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''))) return;
    if (e.target.closest && e.target.closest('[role="radiogroup"]')) return;
    if (e.key === 'ArrowRight' && step < STEPS - 1) { if (step === 0) saveProf(); go(step + 1); }
    else if (e.key === 'ArrowLeft' && step > 0) go(step - 1, -1);
  };
  document.addEventListener('keydown', onKey);
  offs.push(() => document.removeEventListener('keydown', onKey));
  go(0);
  return { title: 'Знакомство', destroy() { saveProf(); offs.forEach((f) => f()); } };
}
