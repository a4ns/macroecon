/* ─────────────────────────────────────────────────────────────
   Home — сдержанная титульная страница учебника
   ───────────────────────────────────────────────────────────── */
import { h, $, fmt, bus } from '../core/dom.js';
import { index } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { createChart } from '../ui/plot.js';
import { slider, stat, presets, figure } from '../ui/controls.js';
import { topicCard, labCard } from '../ui/cards.js';

import { S } from '../core/state.js';
import * as plan from '../core/plan.js';
import { actionLabel, miniMap } from './today.js';

let CTX = null;                                    // контекст данных оболочки (для кнопки и миникарты)
export function load() { CTX = plan.ctx().catch(() => null); return index(); }

const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export function mount(el, ctx, ix) {
  const offs = [];
  const nLect = ix.lectures.length, nTopics = ix.topics.length, nLabs = ix.labList.length;
  const nQ = 510;
  const minutes = ix.topics.reduce((a, t) => a + t.lectures.reduce((b, l) => b + l.min, 0), 0);

  el.innerHTML = `
  <section class="cover wrap">
    <div class="cover__main">
      <p class="eyebrow">Учебное пособие · Северо-Казахстанский университет им. М. Козыбаева</p>
      <h1 class="cover__title">Макроэкономика</h1>
      <p class="cover__lede">Электронный учебник: лекции, интерактивные модели, задачи с проверкой и тесты. Курс построен как последовательность из четырнадцати тем — от предмета науки до внешней торговли.</p>
      <div class="cover__cta">
        <a class="btn btn--primary btn--lg" href="#/start">Начать курс ${ARR}</a>
        <a class="btn btn--lg" href="#/course">Содержание</a>
      </div>
    </div>
    <aside class="cover__side" id="cover-side" aria-label="Состав курса">
      <dl class="facts">
        <div><dt>Тем</dt><dd>${nTopics}</dd></div>
        <div><dt>Лекций</dt><dd>${nLect}</dd></div>
        <div><dt>Интерактивных моделей</dt><dd>${nLabs}</dd></div>
        <div><dt>Задач с проверкой</dt><dd>41</dd></div>
        <div><dt>Тестовых вопросов</dt><dd>${nQ}</dd></div>
        <div><dt>Терминов в глоссарии</dt><dd>83</dd></div>
      </dl>
    </aside>
  </section>

  <section class="section atlas wrap" id="atlas">
    <header class="sec-head">
      <div>
        <p class="eyebrow">Содержание</p>
        <h2 class="h1">Темы курса</h2>
      </div>
      <p class="sec-head__side" id="atlas-prog"></p>
    </header>
    <div class="atlas__grid" id="atlas-grid"></div>
  </section>

  <section class="section demo">
    <div class="wrap">
      <div class="demo__grid">
        <div class="demo__text">
          <p class="eyebrow">Пример модели</p>
          <h2 class="h1">Кейнсианский крест</h2>
          <p class="lede">Совокупные расходы складываются из автономной части и доли дохода, которая тратится. Равновесие достигается там, где расходы равны доходу. Измените параметры и проследите за сдвигом равновесия и мультипликатором.</p>
          <div class="demo__ctl" id="demo-ctl"></div>
        </div>
        <div class="demo__viz" id="demo-viz"></div>
      </div>
    </div>
  </section>

  <section class="section lab">
    <div class="wrap">
      <header class="sec-head">
        <div>
          <p class="eyebrow">Лаборатория</p>
          <h2 class="h1">Интерактивные модели</h2>
        </div>
        <a class="btn" href="#/lab">Все модели ${ARR}</a>
      </header>
    </div>
    <div class="lab__rail" id="lab-rail" tabindex="0" aria-label="Список моделей — прокрутите горизонтально"></div>
  </section>

  <section class="section trio wrap">
    <p class="eyebrow">Как устроена работа</p>
    <div class="trio__grid">
      <article class="trio__c">
        <b class="trio__n">1</b>
        <h3 class="h3">Чтение</h3>
        <p>Лекции с формулами и схемами. Каждый термин раскрывается подсказкой прямо в тексте.</p>
      </article>
      <article class="trio__c">
        <b class="trio__n">2</b>
        <h3 class="h3">Практика</h3>
        <p>Задачи проверяются по каждому полю отдельно: видно, где допущена ошибка, есть подсказка и подробное решение.</p>
      </article>
      <article class="trio__c">
        <b class="trio__n">3</b>
        <h3 class="h3">Контроль</h3>
        <p>Тесты по темам, повторение по интервалам и итоговый экзамен. Ошибки сохраняются для работы над ними.</p>
      </article>
    </div>
  </section>

  <section class="section cta">
    <div class="wrap">
      <div class="cta__row">
        <a class="btn btn--primary btn--lg" href="#/read/1.1">Открыть первую лекцию ${ARR}</a>
        <button class="btn btn--lg" type="button" id="cta-search">Поиск по учебнику <kbd class="kbd">⌘K</kbd></button>
      </div>
    </div>
  </section>`;

  /* ── продолжить с того места, где остановились ───────────── */
  const side = $('#cover-side', el);
  const last = store.get('last');
  if (last && last.route) {
    side.append(h('a.resume', { href: last.route }, h('span.resume__dot'), h('span', h('small', 'Продолжить'), h('b', last.title || 'Последняя лекция')), h('svg', { viewBox: '0 0 24 24', html: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' })));
  }

  /* ── состояние оболочки: кнопка по прогрессу и карта курса ── */
  const myCtx = CTX;
  let alive = true; offs.push(() => { alive = false; });
  myCtx && myCtx.then((c) => {
    if (!c || !alive) return;
    let T; try { T = plan.today(c); } catch (e) { return; }
    const setBtn = (b, label, href) => { if (!b) return; b.setAttribute('href', href); if (b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = label + ' '; };
    const a = T.cards[0];
    const [label, href] = T.first ? ['Начать курс', '#/start'] : a ? ['Сегодня: ' + actionLabel(a), a.href] : ['Открыть «Сегодня»', '#/today'];
    setBtn($('.cover__cta .btn--primary', el), label, href);
    if (S.data.role === 'teacher') { const b = $('.cover__cta .btn:not(.btn--primary)', el); if (b) { b.setAttribute('href', '#/teach'); b.textContent = 'Преподавателю'; } }
    if (!T.first) {
      side.append(h('div.resume-map', h('div.resume-map__h', h('span', 'Карта курса'), h('a', { href: '#/course' }, 'Открыть')), miniMap(c, { cur: T.topic })));
    }
  });

  /* ── темы и модели ───────────────────────────────────────── */
  const grid = $('#atlas-grid', el);
  ix.topics.forEach((tp) => grid.append(topicCard(tp)));
  const readN = store.readCount();
  $('#atlas-prog', el).innerHTML = readN ? `Прочитано <b class="num">${readN}</b> из ${nLect} лекций` : `${nLect} лекций, около ${Math.round(minutes / 60)} ч чтения`;
  const rail = $('#lab-rail', el);
  ix.labList.forEach((lab, i) => rail.append(labCard(lab, i)));
  rail.append(h('div.lab__pad', { 'aria-hidden': 'true' }));
  dragScroll(rail);

  $('#cta-search', el).addEventListener('click', () => $('#open-palette').click());
  const kb = $('#cta-search .kbd', el); if (kb) kb.textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';

  offs.push(initDemo($('#demo-viz', el), $('#demo-ctl', el)));
  offs.push(enhance(el));
  return {
    title: '',
    destroy() { offs.forEach((f) => { try { f && f(); } catch (e) {} }); },
  };
}

/* ── helpers ──────────────────────────────────────────────────── */
function dragScroll(rail) {
  let down = false, sx = 0, sl = 0, moved = 0;
  rail.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add('is-drag'); });
  window.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); rail.scrollLeft = sl - dx; });
  window.addEventListener('pointerup', () => { down = false; rail.classList.remove('is-drag'); });
  rail.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  rail.addEventListener('dragstart', (e) => e.preventDefault());
}

/* the live mini-model: E = A + mpc·Y */
function initDemo(viz, ctl) {
  const st = { A: 600, mpc: .7 };
  const ystar = () => st.A / (1 - st.mpc);
  const sA = slider({ label: 'Автономные расходы', sym: 'A', min: 200, max: 800, step: 10, value: 600, unit: 'ден. ед.', color: 'var(--d1)' });
  const sM = slider({ label: 'Предельная склонность к потреблению', sym: 'mpc', min: .3, max: .85, step: .01, value: .7, color: 'var(--d2)', dec: 2 });
  const yS = stat({ label: 'Равновесный доход', sym: 'Y^*', value: ystar(), unit: '', color: 'var(--accent)', size: 'l' });
  const mS = stat({ label: 'Мультипликатор', sym: '1/(1−mpc)', value: 1 / (1 - st.mpc), dec: 2, color: 'var(--d2)' });
  const dS = stat({ label: 'Изменение дохода', value: 0, color: 'var(--d3)', dec: 0 });
  const rounds = h('div.rounds', { 'aria-label': 'Раунды расходов' });
  const host = h('div.demo__chart');
  const pre = presets([
    { label: 'Госзакупки +100', hint: 'Автономные расходы вырастут на 100', color: 'var(--d5)', apply: () => { chart.snapshot(); sA.set(Math.min(800, sA.value + 100), { fromUser: true }); runRounds(100); } },
    { label: 'Спад: −150', hint: 'Автономные расходы упадут на 150', color: 'var(--d3)', apply: () => { chart.snapshot(); sA.set(Math.max(200, sA.value - 150), { fromUser: true }); runRounds(-150); } },
    { label: 'Люди копят', hint: 'Склонность к потреблению снизится', color: 'var(--d4)', apply: () => { chart.snapshot(); sM.set(Math.max(.3, sM.value - .1), { fromUser: true }); } },
    { label: 'Сбросить', color: 'var(--ink-3)', apply: () => { chart.clearGhosts(); sA.reset(); sM.reset(); rounds.textContent = ''; } },
  ], { title: 'Попробуйте' });

  ctl.append(h('div.demo__sl', sA.el, sM.el), pre);
  viz.append(figure('Кейнсианский крест · доходы и расходы', host, { note: 'Пунктир — положение до изменения. Точка — равновесие, где расходы равны доходу.' }), h('div.demo__stats', yS.el, mS.el, dS.el), rounds);

  const chart = createChart(host, { x: { min: 0, max: 6000, label: 'Y', ticks: [0, 2000, 4000, 6000], grid: true }, y: { min: 0, max: 6000, label: 'E', ticks: [0, 2000, 4000, 6000] }, aspect: 1.3, margin: { l: 54, r: 30, t: 26, b: 44 } });
  chart.line('45', { fn: (y) => y, from: 0, to: 6000, color: 'var(--ink-3)', width: 2, dash: '2 6', label: 'E = Y', labelAt: .9, labelDy: 20, labelDx: -40, glow: false, ghost: false });
  chart.line('E', { fn: (y) => st.A + st.mpc * y, from: 0, to: 6000, color: 'var(--d1)', width: 3.4, label: 'E', labelAt: .95, labelDy: -12 });
  chart.point('eq', { x: () => ystar(), y: () => ystar(), color: 'var(--accent)', r: 7, pulse: true, guides: { x: 'Y^*', y: 'E^*' } });
  const baseY = ystar();
  yS.base(baseY); dS.set(0);
  let ghostOn = false;
  const upd = () => {
    st.A = sA.value; st.mpc = sM.value;
    chart.update(); yS.set(ystar()); mS.set(1 / (1 - st.mpc)); dS.set(ystar() - baseY);
  };
  sA.on(upd); sM.on(upd);
  [sA, sM].forEach((s) => s.range.addEventListener('pointerdown', () => { if (!ghostOn) { chart.snapshot(); } }));

  let timers = [];
  function runRounds(dA) {
    timers.forEach(clearTimeout); timers = []; rounds.textContent = '';
    const m = st.mpc, n = 8; let tot = 0; const max = Math.abs(dA) / (1 - m);
    rounds.append(h('span.rounds__t', 'Раунды: каждый тенге расходов становится чьим-то доходом'));
    const row = h('div.rounds__row'); rounds.append(row);
    for (let i = 0; i < n; i++) {
      const v = dA * Math.pow(m, i); tot += v;
      const bar = h('div.rounds__b', { style: { '--h': (Math.abs(v) / Math.abs(dA)).toFixed(3), '--c': dA > 0 ? 'var(--d2)' : 'var(--d3)' } }, h('i'), h('span', (v > 0 ? '+' : '−') + fmt(Math.abs(v), 0)));
      row.append(bar);
      timers.push(setTimeout(() => bar.classList.add('is-on'), 130 * i + 50));
    }
    rounds.append(h('p.rounds__s', 'Сумма за 8 раундов: ', h('b.num', (tot > 0 ? '+' : '−') + fmt(Math.abs(tot), 0)), ' из ', h('b.num', (dA > 0 ? '+' : '−') + fmt(max, 0)), ' предельных.'));
  }
  const offTheme = bus.on('theme', () => chart.update(undefined, true));
  return () => { timers.forEach(clearTimeout); offTheme && offTheme(); chart.destroy(); };
}
