/* Режим презентации лекции — #/present/:id
   Текст существующей лекции режется на «шаги» (ui/chunker.js); показываем крупно, по одному шагу за нажатие.
   Клавиши: → Space клик — дальше · ← назад · G карта · B пустой экран · M модель · Q голосование · T таймер · D термины · F полный экран · +/− шрифт · V режим · Esc выход. */
import { h, $, $$, loadCSS, toast, reduced, bus } from '../core/dom.js';
import { index, lecture, glossary } from '../core/data.js';
import { getTheme, setTheme } from '../core/theme.js';
import { splitWords } from '../core/motion.js';
import { chunkLecture } from '../ui/chunker.js';
import { nbTree } from './_typo.js';
import { LABS } from '../data/topics.js';

const LADDER = [22, 28, 36, 44];
const LNAME = ['S', 'M', 'L', 'XL'];
const PK = 'mx:pz';
const KIND = { p: '', def: 'определение', list: 'пункт', eq: 'формула', fig: 'рисунок' };

const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } };
const ICON_FS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

export async function load(ctx) {
  const id = ctx.params.id;
  const [ix, html, gl] = await Promise.all([index(), lecture(id).catch(() => null), glossary(), loadCSS('app/css/v-present.css')]);
  const lec = ix.byLec.get(id);
  if (!lec || html == null) throw new Error('Нет такой лекции: ' + id);
  return { ix, lec, steps: chunkLecture(html), gl };
}

export function mount(el, ctx, { ix, lec, steps, gl }) {
  const pref = Object.assign({ fs: 2, mode: 'acc', theme: 'light' }, rd(PK, {}));
  pref.fs = Math.max(0, Math.min(3, +pref.fs | 0));
  const save = () => wr(PK, pref);
  const N = steps.length;
  const tp = ix.byTopic.get(lec.topic);
  const posKey = PK + ':pos:' + lec.id;

  /* ── тема: «Paper» по умолчанию, на выходе возвращаем прежнюю ── */
  const prevTheme = getTheme();
  if (getTheme() !== pref.theme) setTheme(pref.theme, false);
  document.documentElement.classList.add('pz-on');

  /* ── DOM шагов ── */
  const flow = h('div.pz__flow');
  steps.forEach((s, i) => {
    const html = s.html.replace(/\sloading="lazy"/g, '');
    const e = h('div.pz__s.pz__s--' + s.kind, { 'data-i': i, html });
    if (s.kind === 'fig') { const im = $('img', e); if (im) { im.removeAttribute('loading'); im.draggable = false; } }
    if (s.kind === 'def') splitWords(e, { step: Math.min(.045, 1.1 / Math.max(8, s.words)) }); else nbTree(e);
    if (s.cont) e.classList.add('is-cont');
    e.hidden = true;
    s.el = e; flow.append(e);
  });
  const stage = h('div.pz__stage', { tabindex: '-1' }, flow);
  const hint = h('div.pz__hint', { role: 'status' });

  /* ── верхняя панель ── */
  let cur = 0, ov = null, ovClean = null, mode = pref.mode, pageStart = 0;
  const panels = { terms: null, timer: null };
  const mk = (label, key, title, fn, cls) => {
    const b = h('button.pz__b' + (cls || ''), { type: 'button', title: title + (key ? ' (' + key + ')' : ''), onclick: (ev) => { fn(ev); b.blur(); } }, label);
    return b;
  };
  const bMap = mk('Карта', 'G', 'Карта лекции', () => toggleOv('map'));
  const bModel = mk('Модель', 'M', 'Показать модель темы поверх слайда', () => toggleOv('model'));
  const bVote = mk('Вопрос', 'Q', 'Вопрос на голосование', () => toggleOv('vote'));
  const bTimer = mk('Таймер', 'T', 'Таймер', () => togglePanel('timer'));
  const bTerms = mk('Термины', 'D', 'Термины лекции', () => togglePanel('terms'));
  const bMinus = mk('A−', '−', 'Мельче', () => setFs(pref.fs - 1), '.pz__b--sq');
  const bPlus = mk('A+', '+', 'Крупнее', () => setFs(pref.fs + 1), '.pz__b--sq');
  const lvl = h('span.pz__lvl', { 'aria-hidden': 'true' });
  const bMode = mk('', 'V', 'Накопление или по одному', () => setMode(mode === 'acc' ? 'one' : 'acc'));
  const bTheme = mk('', 'C', 'Тема оформления', () => { pref.theme = getTheme() === 'light' ? 'dark' : 'light'; save(); setTheme(pref.theme, false); bTheme.textContent = pref.theme === 'light' ? 'Paper' : 'Night'; });
  bTheme.textContent = pref.theme === 'light' ? 'Paper' : 'Night';
  const bFs = mk('', 'F', 'Во весь экран', () => toggleFs()); bFs.innerHTML = ICON_FS; bFs.setAttribute('aria-label', 'Во весь экран');
  const bHelp = mk('?', '?', 'Все клавиши', () => toggleOv('help'), '.pz__b--sq');
  const bRead = h('a.pz__b', { href: '#/read/' + lec.id, title: 'Открыть читалку (Esc)' }, 'Открыть читалку');
  const bExit = mk('', 'Esc', 'Выйти', () => { location.hash = '#/read/' + lec.id; }, '.pz__b--sq'); bExit.innerHTML = ICON_X; bExit.setAttribute('aria-label', 'Выйти из презентации');
  const bClean = mk('', 'F', 'Вернуть панель', () => toggleFs(), '.pz__clean'); bClean.innerHTML = ICON_X; bClean.setAttribute('aria-label', 'Выйти из режима «во весь экран»');

  const title = h('div.pz__title', h('b.mono', lec.id), h('span', lec.short || lec.title));
  const bar = h('header.pz__bar', title, h('div.pz__tools', bMap, bModel, bVote, bTimer, bTerms, h('span.pz__sep'), bMinus, lvl, bPlus, bMode, bTheme, bFs, bHelp, h('span.pz__sep'), bRead, bExit));

  /* ── нижняя панель ── */
  const cnt = h('span.pz__cnt.mono');
  const fill = h('i');
  const live = h('div.sr', { 'aria-live': 'polite' });
  const foot = h('footer.pz__foot', h('div.pz__pbar', { role: 'progressbar', 'aria-label': 'Прогресс по лекции', 'aria-valuemin': 1, 'aria-valuemax': N }, fill), h('div.pz__fl', cnt, h('span.pz__keys', '← назад · → дальше · G карта · ? клавиши')));

  const root = h('section.pz', { 'aria-label': 'Презентация лекции ' + lec.id, lang: 'ru' }, bar, stage, foot, hint, live, bClean);
  el.append(root);

  /* ── размеры ── */
  const capPx = () => Math.max(19, innerWidth * .066);
  const px = (l) => Math.round(Math.min(LADDER[l], capPx()));
  const applyFs = () => {
    root.style.setProperty('--fs', px(pref.fs) + 'px');
    lvl.textContent = LNAME[pref.fs];
    bMinus.disabled = pref.fs === 0; bPlus.disabled = pref.fs === 3;
  };
  function setFs(l) { l = Math.max(0, Math.min(3, l)); if (l === pref.fs) return; pref.fs = l; save(); applyFs(); render(true); toast('Шрифт ' + LNAME[l] + ' · ' + LADDER[l] + ' px'); }
  function setMode(m, quiet) { mode = pref.mode = m; save(); bMode.textContent = m === 'acc' ? 'Накопление' : 'По одному'; bMode.setAttribute('aria-pressed', String(m === 'acc')); if (!quiet) render(); }

  let hintT = 0;
  const showHint = (t) => { clearTimeout(hintT); hint.textContent = t || ''; hint.classList.toggle('is-on', !!t); if (t) hintT = setTimeout(() => hint.classList.remove('is-on'), 4200); };

  /* ── подгонка шага под экран ── */
  const pad = () => { const cs = getComputedStyle(flow); return { t: parseFloat(cs.paddingTop) || 0, b: Math.min(parseFloat(cs.paddingBottom) || 0, stage.clientHeight * .1), l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 }; };
  function fit() {
    const s = steps[cur]; if (!s) return;
    const e = s.el; e.style.removeProperty('--fs');
    const p = pad(), availH = stage.clientHeight - 2 * p.t;
    const availW = flow.clientWidth - p.l - p.r;
    if (s.kind === 'fig') {
      const im = $('img', e); if (!im) return;
      const cap = $('figcaption', e);
      const w0 = +im.getAttribute('width') || im.naturalWidth || 600, h0 = +im.getAttribute('height') || im.naturalHeight || 400;
      const capH = cap ? cap.getBoundingClientRect().height + 24 : 0;
      const k = Math.min(availW / (w0 + 20), (availH - capH) / (h0 + 20), 2.6);
      im.style.width = Math.round(w0 * k) + 'px'; im.style.height = Math.round(h0 * k) + 'px';
      return;
    }
    const fits = () => e.getBoundingClientRect().height <= availH + 1 && e.scrollWidth <= e.clientWidth + 1;
    if (s.kind === 'eq') {                      // формулу сжимаем плавно: рвать её по уровням нельзя
      let k = px(pref.fs), k0 = k;
      while (!fits() && k > 14) { k = Math.floor(k * .92); e.style.setProperty('--fs', k + 'px'); }
      if (k < k0) showHint('Формула уменьшена, чтобы поместиться');
      return;
    }
    let l = pref.fs;
    for (; l >= 0; l--) {
      if (l < pref.fs) e.style.setProperty('--fs', px(l) + 'px');
      if (fits()) break;
    }
    if (l < 0) l = 0;
    if (l < pref.fs && px(l) < px(pref.fs)) showHint('Размер уменьшен до ' + LNAME[l] + ', чтобы кусок поместился');
  }

  /* ── показ шага ── */
  const isSolo = (i) => steps[i].kind === 'fig' || steps[i].kind === 'eq';
  const lastFigBefore = (i) => { for (let k = i - 1; k >= 0; k--) if (steps[k].kind === 'fig') return k; return -1; };
  let lastPage = -1, lastSolo = null;
  function render(refit) {
    const solo = isSolo(cur) || mode === 'one';
    pageStart = lastFigBefore(cur) + 1;
    steps.forEach((s, i) => {
      const show = solo ? i === cur : (i >= pageStart && i <= cur);
      s.el.hidden = !show;
      s.el.classList.toggle('is-cur', i === cur);
      s.el.classList.toggle('is-past', show && i < cur);
      s.el.setAttribute('aria-current', i === cur ? 'step' : 'false');
    });
    root.classList.toggle('is-solo', solo);
    root.classList.toggle('is-acc', !solo);
    showHint('');
    fit();
    const s = steps[cur];
    if (s.kind === 'def') { s.el.classList.remove('in'); void s.el.offsetWidth; requestAnimationFrame(() => s.el.classList.add('in')); }
    // прокрутка
    const instant = reduced() || refit === true || pageStart !== lastPage || solo !== lastSolo;
    lastPage = pageStart; lastSolo = solo;
    if (solo) stage.scrollTo({ top: 0, behavior: 'auto' });
    else {
      const H = stage.clientHeight, fr = flow.getBoundingClientRect(), er = s.el.getBoundingClientRect();
      const top = er.top - fr.top, bot = top + er.height, m = H * .06;
      let t = top - H * .28;
      if (bot - t > H - m) t = bot - (H - m);
      stage.scrollTo({ top: Math.max(0, t), behavior: instant ? 'auto' : 'smooth' });
    }
    cnt.textContent = 'шаг ' + (cur + 1) + ' / ' + N + (KIND[s.kind] ? ' · ' + KIND[s.kind] : '');
    fill.style.width = ((cur + 1) / N * 100) + '%';
    foot.firstChild.setAttribute('aria-valuenow', cur + 1);
    live.textContent = 'Шаг ' + (cur + 1) + ' из ' + N;
    wr(posKey, cur);
  }
  function go(i, refit) {
    if (ov === 'end') closeOv();
    i = Math.max(0, Math.min(N - 1, i));
    cur = i; render(refit);
  }
  const next = () => { if (ov === 'end') return; if (cur >= N - 1) openOv('end'); else go(cur + 1); };
  const prev = () => { if (ov === 'end') { closeOv(); return; } go(cur - 1); };

  /* ── оверлеи ── */
  function mkOv(name, ...kids) { return h('div.pz__ov.pz__ov--' + name, { role: 'dialog', 'aria-modal': 'true', 'aria-label': name }, ...kids); }
  function openOv(name) {
    closeOv(true);
    ov = name; root.classList.add('has-ov', 'has-ov--' + name);
    const f = { map: buildMap, model: buildModel, vote: buildVote, help: buildHelp, blank: buildBlank, end: buildEnd }[name];
    const node = f(); root.append(node);
    ovClean = () => { node.dispatchEvent(new Event('pz-destroy')); node.remove(); };
    const first = $('[data-focus]', node) || node; first.focus && first.focus({ preventScroll: true });
  }
  function closeOv(silent) {
    if (!ov) return;
    const n = ov; ov = null;
    try { ovClean && ovClean(); } catch (e) { console.error(e); } ovClean = null;
    root.classList.remove('has-ov', 'has-ov--' + n);
    if (!silent) stage.focus({ preventScroll: true });
  }
  function toggleOv(n) { if (ov === n) closeOv(); else openOv(n); }

  /* карта лекции */
  function buildMap() {
    const items = steps.map((s, i) => {
      const b = h('button.pz__mc' + (i === cur ? '.is-cur' : '') + '.k-' + s.kind, { type: 'button', onclick: () => { closeOv(); go(i, true); } },
        h('b.mono', String(i + 1)), h('small', KIND[s.kind] || ' '), h('span', s.firstWords + (s.words > 6 ? '…' : '')));
      if (i === cur) { b.dataset.focus = '1'; b.setAttribute('aria-current', 'step'); }
      return b;
    });
    const node = mkOv('map', h('header.pz__oh', h('h2', 'Карта лекции ' + lec.id), h('span.pz__ohm', N + ' шагов · клик — перейти'), mk('Закрыть', 'Esc', 'Закрыть', () => closeOv())), h('div.pz__mgrid', items));
    setTimeout(() => { const c = $('.is-cur', node); c && c.scrollIntoView({ block: 'center' }); }, 0);
    return node;
  }

  /* пустой экран и конец */
  function buildBlank() { const n = mkOv('blank'); n.tabIndex = -1; n.addEventListener('click', () => closeOv()); n.setAttribute('aria-label', 'Пустой экран. B — вернуться'); return n; }
  function buildHelp() {
    const rows = [['→ · Space · клик', 'дальше'], ['←', 'назад'], ['Home · End', 'в начало · в конец'], ['G', 'карта лекции'], ['B', 'пустой экран'], ['M', 'модель темы поверх слайда'], ['Q', 'вопрос на голосование'], ['T', 'таймер'], ['D', 'термины лекции'], ['+ · −', 'размер шрифта S / M / L / XL'], ['V', 'накопление / по одному'], ['C', 'тема Paper / Night'], ['F', 'во весь экран'], ['Esc', 'закрыть окно, затем выйти в читалку'], ['Свайп ← →', 'на телефоне']];
    return mkOv('help', h('header.pz__oh', h('h2', 'Клавиши'), mk('Закрыть', 'Esc', 'Закрыть', () => closeOv())), h('dl.pz__keys2', ...rows.flatMap(([k, d]) => [h('dt', h('kbd.kbd', k)), h('dd', d)])));
  }
  function buildEnd() {
    const nx = lec.next;
    const node = mkOv('end', h('div.pz__endc',
      h('p.pz__eyebrow', 'Конец лекции ' + lec.id),
      h('h2', 'Что осталось в памяти?'),
      h('p.pz__endm', 'Попросите назвать три главные мысли без подсказки или проведите голосование по теме.'),
      h('div.pz__endb',
        h('button.pz__b.pz__b--big', { type: 'button', 'data-focus': '1', onclick: () => openOv('vote') }, 'Голосование по теме'),
        nx ? h('a.pz__b.pz__b--big', { href: '#/present/' + nx.id }, 'Лекция ' + nx.id + ' →') : null,
        h('a.pz__b.pz__b--big', { href: '#/read/' + lec.id }, 'Открыть читалку'),
        h('button.pz__b.pz__b--big', { type: 'button', onclick: () => { closeOv(); go(0, true); } }, 'С начала'))));
    return node;
  }

  /* голосование (Q) */
  function buildVote() {
    const body = h('div.pz__votebox');
    const node = mkOv('vote', body);
    let inst = null, dead = false;
    import('./vote.js').then((m) => { if (dead) return; inst = m.mountVote(body, { topic: lec.topic, onClose: () => closeOv(), embedded: true }); })
      .catch((e) => { console.error(e); body.append(h('p.pz__err', 'Не удалось открыть голосование')); });
    node.addEventListener('pz-destroy', () => { dead = true; try { inst && inst.destroy && inst.destroy(); } catch (e) { console.error(e); } });
    return node;
  }

  /* модель (M) */
  function buildModel() {
    const labs = (tp && tp.lab) || [];
    const stg = h('div.pz-model__stage', { id: 'pz-sim' });
    const head = h('header.pz__oh');
    const node = mkOv('model', head, h('div.pz-model', stg));
    node.classList.add('pz-model-ov');
    let inst = null, tokenM = 0, curLab = null;
    const killSim = () => { try { inst && inst.destroy && inst.destroy(); } catch (e) { console.error(e); } inst = null; stg.replaceChildren(); };
    node.addEventListener('pz-destroy', () => { tokenM++; killSim(); });
    async function show(id) {
      const my = ++tokenM; curLab = id; killSim();
      $$('.pz__lab', head).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
      stg.append(h('p.pz__loading', 'Загрузка модели…'));
      let mod = null;
      try { mod = await import('../sims/' + id + '.js'); } catch (e) { console.warn(e); }
      if (my !== tokenM) return;
      stg.replaceChildren();
      if (!mod || !(mod.mount || mod.default)) { stg.append(h('p.pz__err', 'Модуль модели не найден')); return; }
      const lab = ix.labs.get(id);
      const env = { id, lab, topic: lab ? lab.topic : lec.topic, tasks: [], reduced: reduced(), bus, toast };
      try { inst = (mod.mount || mod.default)(stg, env) || {}; } catch (e) { console.error(e); stg.append(h('p.pz__err', 'Не удалось запустить модель: ' + String(e && e.message || e))); }
    }
    if (!labs.length) {
      head.append(h('h2', 'Модель'), mk('Закрыть', 'Esc', 'Закрыть', () => closeOv()));
      stg.append(h('p.pz__empty', 'К теме ' + lec.topic + ' нет интерактивной модели. Вернитесь к слайдам клавишей Esc.'));
    } else {
      head.append(h('h2', (LABS[labs[0]] || {}).short || 'Модель'),
        labs.length > 1 ? h('div.pz__labs', { role: 'group', 'aria-label': 'Выбор модели' }, ...labs.map((id) => h('button.pz__b.pz__lab', { type: 'button', 'data-id': id, onclick: () => { head.firstChild.textContent = (LABS[id] || {}).short || id; show(id); } }, (LABS[id] || {}).short || id))) : null,
        mk('Закрыть', 'Esc', 'Закрыть', () => closeOv()));
      show(labs[0]);
    }
    return node;
  }

  /* ── панели: термины и таймер ── */
  function togglePanel(name) {
    if (panels[name]) { panels[name].remove(); panels[name] = null; root.classList.remove('has-' + name); return; }
    panels[name] = name === 'terms' ? buildTerms() : buildTimer();
    root.classList.add('has-' + name); root.append(panels[name]);
    if (name === 'terms') relayout();
  }
  const relayout = () => { fit(); render(true); };
  function buildTerms() {
    const seen = new Set(), list = [];
    (lec.terms || []).forEach((t) => {
      const k = t.toLowerCase(); if (seen.has(k)) return; seen.add(k);
      const g = gl.find((x) => x.term.toLowerCase() === k) || gl.find((x) => x.term.toLowerCase().startsWith(k) || k.startsWith(x.term.toLowerCase()));
      list.push({ term: g ? g.term : t, def: g ? g.def : '', id: g && g.id });
    });
    const body = list.length ? h('dl', ...list.flatMap((g) => [h('dt', g.term), h('dd', g.def || 'Определение смотрите в глоссарии.')])) : h('p.pz__empty', 'Для этой лекции термины не отмечены.');
    const x = mk('Закрыть', 'D', 'Закрыть', () => { togglePanel('terms'); relayout(); }, '.pz__b--sm');
    return h('aside.pz__terms', { 'aria-label': 'Термины лекции' }, h('header', h('h2', 'Термины'), x), body, h('a.pz__more', { href: '#/glossary' }, 'Весь глоссарий →'));
  }

  const T = { left: 120000, total: 120000, run: false, at: 0, iv: 0, done: false };
  let timerEls = {};
  const fmtT = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function tick() {
    if (T.run) { T.left = T.at - Date.now(); if (T.left <= 0) { T.left = 0; T.run = false; T.done = true; clearInterval(T.iv); T.iv = 0; beep(); toast('Время вышло'); if (!panels.timer) togglePanel('timer'); } }
    drawTimer();
  }
  function drawTimer() {
    bTimer.textContent = T.run || T.done || T.left !== T.total ? 'Таймер ' + fmtT(T.left) : 'Таймер';
    const e = timerEls; if (!e.t) return;
    e.t.textContent = fmtT(T.left); e.go.textContent = T.run ? 'Пауза' : (T.left === 0 ? 'Заново' : 'Старт');
    e.box.classList.toggle('is-done', T.done); e.box.classList.toggle('is-run', T.run);
    e.msg.textContent = T.done ? 'Время вышло' : '';
  }
  function beep() { try { const A = window.AudioContext || window.webkitAudioContext; const c = new A(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = .12; o.connect(g); g.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 450); } catch (e) { /* */ } }
  function setTimer(min) { T.total = T.left = min * 60000; T.run = false; T.done = false; clearInterval(T.iv); T.iv = 0; drawTimer(); }
  function buildTimer() {
    const t = h('div.pz__tt.mono', fmtT(T.left)), msg = h('div.pz__tm', { 'aria-live': 'off' });
    const go = h('button.pz__b', { type: 'button', onclick: (ev) => {
      if (T.run) { T.left = T.at - Date.now(); T.run = false; clearInterval(T.iv); T.iv = 0; }
      else { if (T.left <= 0) { T.left = T.total; T.done = false; } T.run = true; T.at = Date.now() + T.left; T.iv = setInterval(tick, 250); }
      drawTimer(); ev.currentTarget.blur();
    } }, 'Старт');
    const reset = h('button.pz__b', { type: 'button', onclick: (ev) => { setTimer(T.total / 60000); ev.currentTarget.blur(); } }, 'Сброс');
    const presets = [1, 2, 5, 10].map((m) => h('button.pz__b.pz__b--sm', { type: 'button', onclick: (ev) => { setTimer(m); ev.currentTarget.blur(); } }, m + ' мин'));
    const plus = h('button.pz__b.pz__b--sm', { type: 'button', title: 'Добавить минуту', onclick: (ev) => { T.left += 60000; T.total += 60000; if (T.run) T.at += 60000; T.done = false; drawTimer(); ev.currentTarget.blur(); } }, '+1');
    const close = h('button.pz__b.pz__b--sm.pz__b--sq', { type: 'button', 'aria-label': 'Скрыть таймер', onclick: () => togglePanel('timer') }, '×');
    const box = h('aside.pz__timer', { 'aria-label': 'Таймер' }, h('div.pz__tr', h('span.pz__eyebrow', 'Таймер'), close), t, msg, h('div.pz__tb', ...presets, plus), h('div.pz__tb', go, reset));
    timerEls = { box, t, go, msg };
    setTimeout(drawTimer, 0);
    return box;
  }

  /* ── полный экран ── */
  const hasFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  function toggleFs() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (hasFs) {
      try {
        if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); p && p.catch && p.catch(() => root.classList.toggle('is-clean')); }
      } catch (e) { root.classList.toggle('is-clean'); }
    } else root.classList.toggle('is-clean');          // iOS: «псевдополный» режим без панелей
    setTimeout(() => render(true), 120);
  }
  const onFs = () => { root.classList.toggle('is-fs', !!(document.fullscreenElement || document.webkitFullscreenElement)); setTimeout(() => render(true), 120); };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

  /* ── ввод ── */
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = t && t.tagName;
    if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable)) { if (e.key === 'Escape') { t.blur(); } return; }
    const code = e.code, key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      if (ov) closeOv();
      else if (panels.timer || panels.terms) { ['timer', 'terms'].forEach((n) => panels[n] && togglePanel(n)); relayout(); }
      else if (root.classList.contains('is-clean')) root.classList.remove('is-clean');
      else location.hash = '#/read/' + lec.id;
      return;
    }
    if (ov === 'vote') return;                                   // голосование ведёт ввод само
    if (ov === 'model' && code !== 'KeyM') return;               // слайдеры модели берут клавиши себе
    const letter = { KeyG: 'g', KeyB: 'b', KeyM: 'm', KeyQ: 'q', KeyT: 't', KeyD: 'd', KeyF: 'f', KeyV: 'v', KeyC: 'c', KeyH: 'h' }[code];
    if (letter) {
      if (e.repeat) return;
      e.preventDefault();
      if (letter === 'g') toggleOv('map'); else if (letter === 'b') toggleOv('blank'); else if (letter === 'm') toggleOv('model');
      else if (letter === 'q') toggleOv('vote'); else if (letter === 't') togglePanel('timer'); else if (letter === 'd') { togglePanel('terms'); }
      else if (letter === 'f') toggleFs(); else if (letter === 'v') setMode(mode === 'acc' ? 'one' : 'acc'); else if (letter === 'c') bTheme.click(); else if (letter === 'h') toggleOv('help');
      return;
    }
    if (key === '?') { e.preventDefault(); toggleOv('help'); return; }
    if (ov && ov !== 'end' && ov !== 'blank') return;       // модальные окна ведут себя сами
    if (ov === 'blank') { if (/^(ArrowRight|ArrowLeft| |PageDown|PageUp)$/.test(key)) { closeOv(); } return; }
    if (key === '+' || key === '=' || code === 'NumpadAdd') { e.preventDefault(); setFs(pref.fs + 1); return; }
    if (key === '-' || key === '−' || key === '_' || code === 'NumpadSubtract') { e.preventDefault(); setFs(pref.fs - 1); return; }
    if (tag === 'BUTTON' || tag === 'A') { if (key === ' ' || key === 'Enter') return; }   // родное поведение кнопок и ссылок
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || (key === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
    else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'Backspace' || (key === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
    else if (key === 'Home') { e.preventDefault(); go(0, true); }
    else if (key === 'End') { e.preventDefault(); go(N - 1, true); }
  }
  document.addEventListener('keydown', onKey);

  /* клик и свайп по сцене */
  let px0 = null, swiped = false;
  stage.addEventListener('pointerdown', (e) => { px0 = { x: e.clientX, y: e.clientY, t: Date.now() }; swiped = false; });
  stage.addEventListener('pointerup', (e) => {
    if (!px0) return; const dx = e.clientX - px0.x, dy = e.clientY - px0.y; px0 = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; dx < 0 ? next() : prev(); }
  });
  stage.addEventListener('pointercancel', () => { px0 = null; });
  stage.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('a,button,input,summary')) return;
    const sel = window.getSelection && String(window.getSelection()); if (sel) return;
    if (e.shiftKey) prev(); else next();
  });

  /* панель скрывается, когда мышь неподвижна */
  let idleT = 0;
  const wake = () => { root.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!root.contains(document.activeElement) || document.activeElement === stage || document.activeElement === document.body) root.classList.add('is-idle'); }, 3200); };
  root.addEventListener('pointermove', wake); root.addEventListener('pointerdown', wake); root.addEventListener('focusin', () => { root.classList.remove('is-idle'); clearTimeout(idleT); });
  wake();

  const onResize = () => { applyFs(); render(true); };
  addEventListener('resize', onResize);

  /* ── старт ── */
  let start = 0;
  const q = ctx.query && +ctx.query.s;
  if (q > 0) start = Math.min(N - 1, q - 1);
  else { const p = +rd(posKey, 0); if (p > 0 && p < N - 1) { start = p; setTimeout(() => toast('Продолжаем с шага ' + (p + 1) + ' · Home — сначала'), 300); } }
  cur = start; applyFs(); setMode(mode, true); render(true);
  document.fonts && document.fonts.ready.then(() => render(true));
  stage.focus({ preventScroll: true });
  $$('img', flow).forEach((im) => { if (!im.complete) im.addEventListener('load', () => { if (steps[cur].el.contains(im)) render(true); }, { once: true }); });

  return {
    title: 'Презентация ' + lec.id,
    update(c) { const s = c.query && +c.query.s; if (s > 0) go(Math.min(N - 1, s - 1), true); },
    destroy() {
      document.removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      clearTimeout(idleT); clearTimeout(hintT); clearInterval(T.iv);
      if (ov) closeOv(true);
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* */ }
      document.documentElement.classList.remove('pz-on');
      setTheme(prevTheme, false);
    },
  };
}
