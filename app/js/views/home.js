/* ─────────────────────────────────────────────────────────────
   Home — a scroll-driven story over a WebGL particle hero
   ───────────────────────────────────────────────────────────── */
import { h, $, $$, clamp, lerp, smooth, smoother, bus, fmt, plural, reduced, isTouch, toast } from '../core/dom.js';
import { index } from '../core/data.js';
import { store } from '../core/store.js';
import { onScroll, enhance } from '../core/motion.js';
import { createHero } from '../gl/hero.js';
import { createChart } from '../ui/plot.js';
import { slider, stat, presets, figure, legend, symHTML } from '../ui/controls.js';
import { topicCard, labCard } from '../ui/cards.js';
import { STORY, TOPICS, icon, rub } from '../data/topics.js';
import { getTheme } from '../core/theme.js';

export const load = () => index();

const P0 = .085, PEND = .94;           // scroll fractions where the scene tour starts / ends

export function mount(el, ctx, ix) {
  const offs = [];
  const nLect = ix.lectures.length, nTopics = ix.topics.length, nLabs = ix.labList.length;
  const nQ = 510;

  el.innerHTML = `
  <section class="hero" id="hero" aria-label="Обложка">
    <div class="hero__pin">
      <canvas class="hero__cv" aria-hidden="true"></canvas>
      <div class="hero__vig" aria-hidden="true"></div>

      <div class="hero__intro">
        <p class="eyebrow eyebrow--dot hero__eye">Интерактивный учебник · СКГУ им. М. Козыбаева</p>
        <h1 class="display hero__title" aria-label="Макроэкономика">
          <span class="split-line" style="--d:.1s"><span>Макро</span></span>
          <span class="split-line" style="--d:.22s"><span class="outline">экономика</span></span>
        </h1>
        <div class="hero__side">
          <p class="lede hero__lede">Кругооборот, ВВП, рост, цикл, IS–LM — <em>живыми моделями</em>, а не формулами на бумаге.</p>
          <div class="hero__cta">
            <a class="btn btn--primary" href="#/theory" data-magnetic="0.25">Начать читать <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
            <a class="btn" href="#/lab" data-magnetic="0.25">В лабораторию</a>
          </div>
        </div>
      </div>

      <div class="hero__story" aria-live="off">
        ${STORY.map((s, i) => `
        <article class="story" data-i="${i}" style="--c:var(--${s.c})">
          <div class="story__n"><b>${rub(i + 1)}</b><i></i><span>${rub(STORY.length)}</span></div>
          <p class="eyebrow story__k">${s.k}</p>
          <h2 class="h1 story__h">${s.h}</h2>
          <p class="story__p">${s.p}</p>
          <a class="story__a" href="${s.to}">Перейти к теме <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </article>`).join('')}
      </div>

      <ol class="hero__rail" aria-label="Сцены">
        ${STORY.map((s, i) => `<li><button type="button" data-go="${i}" style="--c:var(--${s.c})" aria-label="${s.k}"><i></i><span>${s.k}</span></button></li>`).join('')}
      </ol>

      <div class="hero__hud mono" aria-hidden="true"><span data-hud="scene">СЦЕНА 01 / 07</span><span data-hud="n"></span><span data-hud="fps"></span></div>
      <div class="hero__cue" aria-hidden="true"><span>листайте</span><i></i></div>
    </div>
  </section>

  <section class="marq" aria-hidden="true">
    <div class="marquee" data-speed=".5"><div class="marquee__track">${marqueeRow(['ВВП', 'Инфляция', 'Безработица', 'Мультипликатор', 'Ставка процента', 'Платёжный баланс', 'Совокупный спрос', 'Модель Солоу'], false)}${marqueeRow(['ВВП', 'Инфляция', 'Безработица', 'Мультипликатор', 'Ставка процента', 'Платёжный баланс', 'Совокупный спрос', 'Модель Солоу'], false)}</div></div>
    <div class="marquee" data-dir="r" data-speed=".4"><div class="marquee__track">${marqueeRow(['Кругооборот', 'Дефлятор', 'Денежная масса', 'Бюджетный дефицит', 'Валютный курс', 'Кривая IS', 'Кривая LM', 'Экономический цикл'], true)}${marqueeRow(['Кругооборот', 'Дефлятор', 'Денежная масса', 'Бюджетный дефицит', 'Валютный курс', 'Кривая IS', 'Кривая LM', 'Экономический цикл'], true)}</div></div>
  </section>

  <section class="section stats wrap">
    <p class="eyebrow rv">Внутри</p>
    <div class="stats__grid">
      ${[[nTopics, 'тем', 'от предмета науки до торговой политики'], [nLect, 'лекций', 'с формулами, схемами и терминами на лету'], [nLabs, 'живых моделей', 'каждая — с ползунками и графиками'], [nQ, 'тестовых вопросов', 'выбирайте, проверяйте, повторяйте']].map(([n, l, s], i) => `
      <div class="stat rv" style="--d:${i * .08}s"><b class="stat__n display" data-count="${n}" data-dur="1900">0</b><span class="stat__l">${l}</span><span class="stat__s">${s}</span></div>`).join('')}
    </div>
  </section>

  <section class="section manifesto">
    <div class="wrap wrap--narrow">
      <p class="manifesto__t h1" data-lit>Макроэкономика — это не формулы на бумаге. Это <em>потоки</em>, которые можно увидеть, <em>рычаги</em>, которые можно потянуть, и <em>кривые</em>, которые движутся под пальцами.</p>
    </div>
  </section>

  <section class="section atlas wrap" id="atlas">
    <header class="sec-head">
      <div>
        <p class="eyebrow rv">Атлас тем</p>
        <h2 class="h1 rv" style="--d:.06s">Четырнадцать тем — <em>один маршрут</em></h2>
      </div>
      <p class="sec-head__side rv" style="--d:.12s" id="atlas-prog"></p>
    </header>
    <div class="atlas__grid" id="atlas-grid"></div>
  </section>

  <section class="section demo">
    <div class="wrap">
      <div class="demo__grid">
        <div class="demo__text">
          <p class="eyebrow rv">Живая модель</p>
          <h2 class="h1 rv" style="--d:.06s">Потяните рычаг — <em>экономика ответит</em></h2>
          <p class="lede rv" style="--d:.12s">Перед вами кейнсианский крест: расходы фирм, семей и государства сходятся с доходом в одной точке. Сдвиньте автономные расходы — и увидите мультипликатор в действии.</p>
          <div class="demo__ctl rv" id="demo-ctl" style="--d:.18s"></div>
        </div>
        <div class="demo__viz rv" style="--d:.1s" id="demo-viz"></div>
      </div>
    </div>
  </section>

  <section class="section lab">
    <div class="wrap">
      <header class="sec-head">
        <div>
          <p class="eyebrow rv">Лаборатория</p>
          <h2 class="h1 rv" style="--d:.06s">Пятнадцать моделей, <em>которые можно трогать</em></h2>
        </div>
        <a class="btn rv" style="--d:.12s" href="#/lab" data-magnetic="0.25">Все модели <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </header>
    </div>
    <div class="lab__rail" id="lab-rail" tabindex="0" aria-label="Список моделей — прокрутите горизонтально"></div>
  </section>

  <section class="section trio wrap">
    <p class="eyebrow rv">Как это работает</p>
    <div class="trio__grid">
      <article class="trio__c rv">
        <b class="trio__n display">01</b>
        <h3 class="h3">Читайте</h3>
        <p>Лекции набраны заново: формулы — настоящие, схемы — перерисованы. Любой термин раскрывается подсказкой прямо в тексте.</p>
        <div class="mock mock--read"><p>Совокупный спрос определяется как сумма расходов на <span class="gloss">потребление</span>, инвестиции и государственные закупки…</p><div class="mock__pop"><i>термин</i><b>Потребление</b><span>Расходы домохозяйств на товары и услуги текущего периода.</span></div></div>
      </article>
      <article class="trio__c rv" style="--d:.1s">
        <b class="trio__n display">02</b>
        <h3 class="h3">Считайте</h3>
        <p>Задачи проверяются по каждому полю отдельно: видно, где ошибка, есть подсказка и подробное решение.</p>
        <div class="mock mock--task"><p>Располагаемый доход</p><div><span class="ans is-ok">415</span><em>✓</em></div><p>Амортизационный фонд</p><div><span class="ans is-bad">55</span><em>✗</em></div></div>
      </article>
      <article class="trio__c rv" style="--d:.2s">
        <b class="trio__n display">03</b>
        <h3 class="h3">Проверяйте</h3>
        <p>Тесты по каждой теме собираются из случайных вопросов — можно проходить снова и снова.</p>
        <div class="mock mock--quiz"><p>К инструментам макроэкономики не относится:</p><ul><li>Денежная политика</li><li class="is-on">Кадровая политика</li><li>Кредитная политика</li></ul></div>
      </article>
    </div>
  </section>

  <section class="section cta">
    <div class="wrap">
      <p class="eyebrow rv">Поехали</p>
      <h2 class="cta__t display rv">Начнём?</h2>
      <div class="cta__row rv" style="--d:.1s">
        <a class="btn btn--primary btn--lg" href="#/read/1.1" data-magnetic="0.3">Открыть первую лекцию <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        <button class="btn btn--lg" type="button" id="cta-search" data-magnetic="0.3">Найти что-нибудь <kbd class="kbd">⌘K</kbd></button>
      </div>
    </div>
  </section>`;

  /* ── continue where you stopped ──────────────────────────── */
  const last = store.get('last');
  if (last && last.route) {
    const chip = h('a.resume', { href: last.route }, h('span.resume__dot'), h('span', h('small', 'Продолжить'), h('b', last.title || 'Последняя лекция')), h('svg', { viewBox: '0 0 24 24', html: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' }));
    $('.hero__side', el).append(chip);
  }

  /* ── atlas & lab rails ───────────────────────────────────── */
  const grid = $('#atlas-grid', el);
  ix.topics.forEach((tp) => grid.append(topicCard(tp)));
  grid.append(h('a.card.atlas__end', { href: '#/lab', 'data-spot': '' },
    h('p.eyebrow', 'А дальше'), h('h3.h2', { html: 'Закрепите теорию <em>руками</em>' }),
    h('p', 'Перейдите в лабораторию — для каждой темы там есть модель, задачи и тест.'),
    h('span.btn.btn--sm', 'В лабораторию', h('svg', { viewBox: '0 0 24 24', html: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' }))));
  const readN = store.readCount();
  $('#atlas-prog', el).innerHTML = readN ? `Прочитано <b class="num">${readN}</b> из ${nLect} лекций` : `${nLect} лекций, ${ix.topics.reduce((a, t) => a + t.lectures.reduce((b, l) => b + l.min, 0), 0)} минут чтения — от первой до последней`;
  const rail = $('#lab-rail', el);
  ix.labList.forEach((lab, i) => rail.append(labCard(lab, i)));
  rail.append(h('div.lab__pad', { 'aria-hidden': 'true' }));
  dragScroll(rail);

  $('#cta-search', el).addEventListener('click', () => $('#open-palette').click());
  const kb = $('#cta-search .kbd', el); if (kb) kb.textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';

  /* ── hero ────────────────────────────────────────────────── */
  const heroEl = $('#hero', el), pin = $('.hero__pin', el), cv = $('.hero__cv', el);
  const stories = $$('.story', el), rails = $$('.hero__rail button', el);
  const intro = $('.hero__intro', el), cue = $('.hero__cue', el);
  const hud = { scene: $('[data-hud="scene"]', el), n: $('[data-hud="n"]', el), fps: $('[data-hud="fps"]', el) };
  let hero = null, heroOK = false, sceneNow = 0, visible = true;
  try {
    hero = createHero(cv, { theme: getTheme() });
    // createHero may swap the canvas for a fresh one when WebGL is unavailable
    heroOK = true;
    window.__hero = hero;
    hero.resize(); hero.setLayoutMix(0); hero.snap(); hero.start();
    hud.n.textContent = hero.count ? fmt(hero.count) + ' частиц' : '';
  } catch (e) { console.warn('hero failed', e); }
  requestAnimationFrame(() => requestAnimationFrame(() => { pin.classList.add('is-ready'); intro.classList.add('in'); }));

  const onTheme = (t) => hero && hero.setTheme(t);
  offs.push(bus.on('theme', onTheme));
  const onResize = () => { hero && hero.resize(); update(true); };
  window.addEventListener('resize', onResize); offs.push(() => window.removeEventListener('resize', onResize));

  // pointer → particles
  const onMove = (e) => {
    if (!hero || e.pointerType === 'touch') return;
    const r = pin.getBoundingClientRect();
    hero.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2, true);
  };
  const onLeave = () => hero && hero.setPointer(0, 0, false);
  const onDown = (e) => {
    if (!hero || e.target.closest('a, button')) return;
    const r = pin.getBoundingClientRect(); hero.shock(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  };
  pin.addEventListener('pointermove', onMove); pin.addEventListener('pointerleave', onLeave); pin.addEventListener('pointerdown', onDown);

  // pause when off-screen
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; hero && hero.setVisible(visible); }, { threshold: 0 });
  io.observe(heroEl); offs.push(() => io.disconnect());

  const holdScene = (p) => {
    const f = clamp((p - P0) / (PEND - P0)) * (STORY.length - 1);
    const i = Math.min(STORY.length - 2, Math.floor(f)), u = f - i;
    return i + smoother(clamp((u - .28) / .6));
  };

  let lastKey = '';
  function update(force) {
    const r = heroEl.getBoundingClientRect();
    const L = Math.max(1, r.height - innerHeight);
    const p = clamp(-r.top / L);
    const s = holdScene(p);
    sceneNow = s;
    const introV = 1 - smooth((p - .012) / .06);
    const mix = smoother(clamp((p - .012) / .09));
    if (heroOK) { hero.setScene(s); hero.setLayoutMix(mix); }
    const key = p.toFixed(4) + '|' + innerWidth;
    if (key === lastKey && !force) return; lastKey = key;
    intro.style.opacity = introV.toFixed(3);
    intro.style.transform = `translate3d(0, ${(-(1 - introV) * 34).toFixed(1)}px, 0)`;
    intro.style.filter = introV < .99 ? `blur(${((1 - introV) * 10).toFixed(1)}px)` : 'none';
    intro.style.pointerEvents = introV < .3 ? 'none' : '';
    cue.style.opacity = clamp(1 - p * 14).toFixed(3);
    const fade = 1 - smooth((p - .96) / .04);
    stories.forEach((st, i) => {
      const d = Math.abs(s - i);
      const v = clamp(1 - d / .46) * smooth((p - .072) / .05) * fade;
      const dir = Math.sign(i - s);
      st.style.opacity = v.toFixed(3);
      st.style.transform = `translate3d(0, ${(dir * (1 - v) * 46).toFixed(1)}px, 0)`;
      st.style.filter = v < .99 ? `blur(${((1 - v) * 8).toFixed(1)}px)` : 'none';
      st.style.visibility = v < .01 ? 'hidden' : 'visible';
      st.classList.toggle('is-on', v > .6);
    });
    const cur = Math.round(s);
    rails.forEach((b, i) => { b.classList.toggle('is-on', i === cur); b.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    $('.hero__rail', el).style.opacity = smooth((p - .05) / .06) * fade;
    hud.scene.textContent = 'СЦЕНА ' + rub(cur + 1) + ' / ' + rub(STORY.length);
    pin.style.setProperty('--sc', `var(--${STORY[cur].c})`);
  }
  update(true);
  offs.push(onScroll(() => update()));

  rails.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.go; const r = heroEl.getBoundingClientRect();
    const L = r.height - innerHeight; const p = P0 + (PEND - P0) * (i / (STORY.length - 1)) + .003;
    window.scrollTo({ top: window.scrollY + r.top + p * L, behavior: reduced() ? 'auto' : 'smooth' });
  }));
  cue.addEventListener('click', () => window.scrollBy({ top: innerHeight * .9, behavior: 'smooth' }));

  // fps read-out
  let fr = 0, ft = performance.now(), fraf = 0;
  const fpsLoop = (t) => { fr++; if (t - ft > 700) { if (visible) hud.fps.textContent = Math.round((fr * 1000) / (t - ft)) + ' fps'; fr = 0; ft = t; } fraf = requestAnimationFrame(fpsLoop); };
  fraf = requestAnimationFrame(fpsLoop); offs.push(() => cancelAnimationFrame(fraf));

  /* ── live Keynesian cross ────────────────────────────────── */
  offs.push(initDemo($('#demo-viz', el), $('#demo-ctl', el)));

  offs.push(enhance(el));
  return {
    title: '',
    destroy() { offs.forEach((f) => { try { f && f(); } catch (e) {} }); hero && hero.destroy && hero.destroy(); },
  };
}

/* ── helpers ──────────────────────────────────────────────────── */
function marqueeRow(words, outline) {
  return `<span class="marquee__set ${outline ? 'is-out' : ''}">${words.map((w) => `<span>${w}</span><i></i>`).join('')}</span>`;
}

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
