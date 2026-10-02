/* «План пары» — #/teach/plan/:id (id — лекция «4.1» или тема «4»).
   Собирается автоматически из имеющегося: вопросы банка, шаги презентации, модель темы. Новый текст курса не пишется:
   это шаблон методики peer instruction (разминка → мини-лекция → вопрос с голосованием → обсуждение → выходной вопрос). */
import { h, $, loadCSS, toast, plural } from '../core/dom.js';
import { index, lecture } from '../core/data.js';
import { bank, seeded, shuffled } from '../core/qid.js';
import { chunkLecture } from '../ui/chunker.js';
import { TOPICS, LABS } from '../data/topics.js';
import { nb } from './_typo.js';
import { projectorOk, votable } from './vote.js';

const LET = ['А', 'Б', 'В', 'Г', 'Д'];
const NBSP = ' ';
const STOP_EVERY = 8;
const PROMPTS = [
  'Попросите одного студента пересказать последние шаги одним предложением, остальных — уточнить.',
  'Спросите: «Что здесь главное?» — и дайте минуту на запись ответа в тетради.',
  'Попросите привести свой пример к только что сказанному или назвать, что осталось неясным.',
];
const pk = (id) => 'mx:plan:' + id;
const rd = (id) => { try { return JSON.parse(localStorage.getItem(pk(id))) || {}; } catch (e) { return {}; } };
const wr = (id, v) => { try { localStorage.setItem(pk(id), JSON.stringify(v)); } catch (e) { /* */ } };

export async function load(ctx) {
  const id = ctx.params.id;
  const [ix, b] = await Promise.all([index(), bank(), loadCSS('app/css/v-pair.css')]);
  let lecs, topic;
  if (ix.byLec.has(id)) { const l = ix.byLec.get(id); lecs = [l]; topic = l.topic; }
  else if (ix.byTopic.has(+id)) { topic = +id; lecs = ix.byTopic.get(topic).lectures.map((l) => ix.byLec.get(l.id)); }
  else throw new Error('Нет такой лекции или темы: ' + id);
  const stepsBy = await Promise.all(lecs.map((l) => lecture(l.id).then((html) => chunkLecture(html)).catch(() => [])));
  return { ix, b, id, lecs, topic, steps: stepsBy.map((s, i) => ({ lec: lecs[i], steps: s })) };
}

/** минуты по блокам: в сумме ровно total */
export function allocate(total, hasModel) {
  const warm = Math.max(3, Math.round(total * .10)), vote = Math.max(4, Math.round(total * .16)), exit = Math.max(3, Math.round(total * .08));
  const model = hasModel ? Math.max(5, Math.round(total * .20)) : 0;
  let lec = total - warm - vote - exit - model;
  if (lec < 6) lec = 6;
  const out = { warm, lec, vote, model, exit };
  // подгоняем сумму к total за счёт лекции
  const diff = total - (warm + lec + vote + model + exit);
  out.lec += diff;
  return out;
}

export function mount(el, ctx, { ix, b, id, lecs, topic, steps }) {
  const first = lecs[0], isTopic = !ix.byLec.has(id);
  const tp = ix.byTopic.get(topic), tm = TOPICS[topic] || {};
  const labs = (tp.lab || []).map((lid) => ix.labs.get(lid)).filter(Boolean);
  const totalSteps = steps.reduce((s, x) => s + x.steps.length, 0);
  const saved = rd(id);
  const st = { min: Math.min(120, Math.max(20, +saved.min || 50)), sl: Object.assign({ warm: 0, v1: 0, v2: 1, ex: 2 }, saved.sl || {}) };
  const save = () => wr(id, { min: st.min, sl: st.sl });

  /* ── пулы вопросов ── */
  const okQ = (Q) => votable(Q) && projectorOk(Q);
  const firstInTopic = !isTopic && ix.byTopic.get(topic).lectures[0].id === first.id;
  const warmTopic = (isTopic || firstInTopic) && topic > 1 ? topic - 1 : topic;
  const poolN = shuffled(b.unique(topic).filter(okQ), seeded('plan:' + topic + ':' + id));
  const poolW = warmTopic === topic ? poolN : shuffled(b.unique(warmTopic).filter(okQ), seeded('plan:warm:' + warmTopic + ':' + id));
  const at = (pool, i) => (pool.length ? pool[((i % pool.length) + pool.length) % pool.length] : null);
  function slotQ(slot) {
    const pool = slot === 'warm' ? poolW : poolN;
    return at(pool, st.sl[slot]);
  }
  function replace(slot) {
    const pool = slot === 'warm' ? poolW : poolN; if (pool.length < 2) { toast('Других подходящих вопросов нет'); return; }
    const taken = new Set(['warm', 'v1', 'v2', 'ex'].filter((k) => k !== slot && (k === 'warm') === (slot === 'warm')).map((k) => pool.indexOf(slotQ(k))));
    if (slot === 'warm' && poolW === poolN) ['v1', 'v2', 'ex'].forEach((k) => taken.add(pool.indexOf(slotQ(k))));
    if (slot !== 'warm' && poolW === poolN) taken.add(pool.indexOf(slotQ('warm')));
    let i = st.sl[slot];
    for (let k = 0; k < pool.length; k++) { i = (i + 1) % pool.length; if (!taken.has(i)) break; }
    st.sl[slot] = i; save(); draw();
  }
  // на старте гарантируем, что слоты не совпадают
  (function dedupe() {
    const seen = new Set();
    ['warm', 'v1', 'v2', 'ex'].forEach((k) => {
      const pool = k === 'warm' ? poolW : poolN; if (!pool.length) return;
      for (let g = 0; g < pool.length; g++) { const Q = at(pool, st.sl[k]); const key = Q.ukey; if (!seen.has(key)) { seen.add(key); break; } st.sl[k]++; }
    });
  })();

  /* ── сборка страницы ── */
  const out = h('div.pl__out');
  const times = h('div.pl__times');
  const minIn = h('input.pl__min', { type: 'number', min: 20, max: 120, step: 5, value: st.min, 'aria-label': 'Длительность пары, минут', inputmode: 'numeric' });
  const setMin = (v) => { v = Math.min(120, Math.max(20, Math.round(+v) || 50)); st.min = v; minIn.value = v; save(); draw(); };
  minIn.addEventListener('change', () => setMin(minIn.value));
  const stepper = (d, label) => h('button.pl__st', { type: 'button', 'aria-label': label, onclick: () => setMin(st.min + d) }, d > 0 ? '+5' : '−5');

  const qcard = (Q, slot, linkTo) => {
    if (!Q) return h('p.pl__none', 'В этой теме нет вопросов, которые читаются с проектора.');
    return h('div.pl__q',
      h('p.pl__qt', h('span.pl__qid.mono', Q.qid), nb(Q.q)),
      h('ol.pl__qo', ...Q.a.map((a, i) => h('li' + (a.ok ? '.is-ok' : ''), h('b', LET[i]), h('span', nb(a.t)), a.ok ? h('i.pl__ok', ' ✓ верный') : null))),
      h('div.pl__qa.pl__noprint',
        h('button.pl__link', { type: 'button', onclick: () => replace(slot) }, 'Заменить вопрос'),
        h('a.pl__link', { href: '#/teach/vote/' + Q.topic + '?q=' + Q.qid }, 'Открыть в голосовании')));
  };

  function checkpoints(minLec) {
    const rows = []; let off = 0;
    steps.forEach(({ lec, steps: ss }) => {
      for (let k = STOP_EVERY; k < ss.length; k += STOP_EVERY) rows.push({ lec, k, w: ss[k - 1].firstWords, share: (off + k) / totalSteps });
      off += ss.length;
    });
    return rows.map((r, i) => ({ ...r, min: Math.round(r.share * minLec), prompt: PROMPTS[i % PROMPTS.length] }));
  }

  function draw() {
    const A = allocate(st.min, labs.length > 0);
    const seq = [['warm', 'Разминка', A.warm], ['lec', 'Лекционный блок', A.lec], ['vote', 'Голосование', A.vote]];
    if (labs.length) seq.push(['model', 'Модель', A.model]);
    seq.push(['exit', 'Выходной вопрос', A.exit]);
    let t = 0; const rows = seq.map(([k, name, m]) => { const r = { k, name, m, from: t, to: t + m }; t += m; return r; });

    // шкала
    times.replaceChildren(
      h('div.pl__scale', { role: 'img', 'aria-label': 'Распределение времени по блокам' }, ...rows.map((r) => h('div.pl__seg.pl__seg--' + r.k, { style: { flexGrow: r.m }, title: r.name + ' · ' + r.m + ' мин' }, h('b', String(r.m)), h('small', r.name)))),
      h('p.pl__tm', 'Всего ', h('b', st.min + NBSP + 'мин'), ' · лекция ≈', A.lec + NBSP + 'мин на ', totalSteps + NBSP + plural(totalSteps, ['шаг', 'шага', 'шагов']), ' (≈', (totalSteps / A.lec).toFixed(1).replace('.', ',') + NBSP + 'шага в минуту)',
        totalSteps / A.lec > 3.5 ? h('span.pl__warn', ' · плотно: заранее отметьте шаги, которые можно пропустить (карта лекции, клавиша G)') : null));

    const clock = (r) => h('span.pl__clock.mono', fmt(r.from) + '–' + fmt(r.to));
    const fmt = (m) => m + ':00';
    const blocks = [];
    const head = (i, r, sub) => h('header.pl__bh', h('span.pl__bn.mono', String(i + 1)), h('div', h('h2', r.name), sub ? h('p.pl__sub', sub) : null), h('div.pl__bt', h('b', r.m + NBSP + 'мин'), clock(r)));
    const rowBy = Object.fromEntries(rows.map((r) => [r.k, r]));
    let n = 0;

    // 1 разминка
    {
      const r = rowBy.warm, Q = slotQ('warm');
      blocks.push(h('li.pl__b.pl__b--warm', head(n++, r, 'Ретривал: вспомнить без подсказок. ' + (warmTopic === topic ? 'Тема продолжается — вопрос из этой же темы, не вошедший в голосование.' : 'Вопрос по предыдущей теме (' + warmTopic + ': ' + ((TOPICS[warmTopic] || {}).short || '') + ').')),
        h('ol.pl__how', h('li', 'Покажите вопрос, дайте минуту подумать молча.'), h('li', 'Проголосуйте карточками А–Д (без обсуждения), назовите ответ.'), h('li', 'Связка со сегодняшней темой — одной фразой.')),
        qcard(Q, 'warm')));
    }
    // 2 лекция
    {
      const r = rowBy.lec, cps = checkpoints(r.m);
      blocks.push(h('li.pl__b.pl__b--lec', head(n++, r, totalSteps + NBSP + plural(totalSteps, ['шаг', 'шага', 'шагов']) + ' презентации · остановка каждые ≈' + STOP_EVERY),
        h('ul.pl__lecs', ...steps.map(({ lec, steps: ss }) => h('li', h('a', { href: '#/present/' + lec.id }, h('b.mono', lec.id), h('span', lec.short || lec.title)), h('small.mono', ss.length + NBSP + plural(ss.length, ['шаг', 'шага', 'шагов']) + ' · ≈' + lec.min + NBSP + 'мин чтения')))),
        cps.length ? h('ol.pl__stops', ...cps.map((c) => h('li', h('span.pl__flag', 'Здесь остановиться и спросить'), h('b', ' после шага ' + c.k + (isTopic ? ' лекции ' + c.lec.id : '')), h('span.pl__at.mono', ' ≈ ' + c.min + ' мин'),
          h('q.pl__ctx', c.w + '…'), h('span.pl__pr', c.prompt)))) : h('p.pl__none', 'Лекция короткая: остановка нужна только в конце.'),
        h('p.pl__tip.pl__noprint', 'В презентации: ', h('kbd.kbd', 'Q'), ' — вопрос на голосование, ', h('kbd.kbd', 'G'), ' — карта лекции, ', h('kbd.kbd', 'T'), ' — таймер.')));
    }
    // 3 голосование
    {
      const r = rowBy.vote;
      blocks.push(h('li.pl__b.pl__b--vote', head(n++, r, 'Два вопроса темы ' + topic + '. Правило: до 30 % верных — объяснить заново; 30–70 % — обсуждение в парах 2 мин и второй раунд; больше 70 % — идти дальше.'),
        h('div.pl__qs', qcard(slotQ('v1'), 'v1'), qcard(slotQ('v2'), 'v2')),
        h('p.pl__go.pl__noprint', h('a.btn.btn--sm', { href: '#/teach/vote/' + topic }, 'Открыть голосование по теме ' + topic))));
    }
    // 4 модель
    if (labs.length) {
      const r = rowBy.model;
      blocks.push(h('li.pl__b.pl__b--model', head(n++, r, 'Классный прогноз: сначала предсказываем, потом проверяем на модели.'),
        h('ol.pl__how', h('li', 'До запуска выберите, что именно вы измените, и спросите класс: «вырастет, упадёт или не изменится?» Класс голосует карточками.'), h('li', 'Измените параметр на модели и покажите факт.'), h('li', 'Обсудите расхождение: почему мы ошиблись или оказались правы.')),
        h('ul.pl__labs', ...labs.map((l) => h('li', h('b', (LABS[l.id] || {}).short || l.title), h('span', (LABS[l.id] || {}).tag || ''),
          (l.task || []).filter((x) => !/^\s*Задание:?\s*$/i.test(x)).slice(0, 2).length ? h('small', 'В задании к модели: ' + (l.task || []).filter((x) => !/^\s*Задание:?\s*$/i.test(x)).slice(0, 2).map((x) => x.replace(/^\s*\d+[.)]\s*/, '').replace(/[;.]$/, '')).join('; ')) : null))),
        h('p.pl__tip.pl__noprint', 'В презентации модель открывается клавишей ', h('kbd.kbd', 'M'), '. ', h('a', { href: '#/lab/' + labs[0].id }, 'Открыть модель отдельно'), '.')));
    }
    // 5 выход
    {
      const r = rowBy.exit;
      blocks.push(h('li.pl__b.pl__b--exit', head(n++, r, 'Каждый отвечает письменно, без обсуждения, затем 30 секунд на проверку.'),
        qcard(slotQ('ex'), 'ex'),
        h('p.pl__tip', 'Соберите листки или посмотрите долю верных по поднятым карточкам. Это формативная проверка, а не оценка.')));
    }
    out.replaceChildren(h('ol.pl__blocks', ...blocks));
  }
  draw();

  const bPres = h('a.btn.btn--primary', { href: '#/present/' + first.id }, 'Открыть в презентации');
  const bPrint = h('button.btn', { type: 'button', onclick: () => window.print() }, 'Печать');
  const page = h('article.wrap.pl',
    h('header.pl__head',
      h('nav.crumbs.pl__noprint', { 'aria-label': 'Навигация' }, h('a', { href: '#/teach' }, 'Преподавателю'), h('i', '/'), h('span', 'План пары')),
      h('p.eyebrow', 'Тема ' + topic + (tm.short ? ' · ' + tm.short : '')),
      h('h1.pl__h', 'План пары ', h('em', isTopic ? 'темы ' + topic : first.id)),
      h('p.pl__lede', isTopic ? tp.title : (first.short || first.title)),
      h('p.pl__how0', 'Собрано автоматически из лекций, вопросов и моделей курса — новый текст не пишется. Структура — по методике peer instruction.')),
    h('div.pl__bar.pl__noprint',
      h('label.pl__dur', h('span', 'Длительность пары, мин'), h('span.pl__dw', stepper(-5, 'Меньше на 5 минут'), minIn, stepper(5, 'Больше на 5 минут'))),
      h('div.pl__acts', bPres, bPrint)),
    times, out);
  el.append(page);
  return { title: 'План пары ' + (isTopic ? 'темы ' + topic : first.id), destroy() {} };
}
