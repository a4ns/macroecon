/* simulator frame: title, task checklist, toolbar, and the per-exercise module mounted into it */
import { h, $, toast, plural, bus, loadCSS } from '../core/dom.js';
import { index } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { TOPICS, LABS, icon, rub } from '../data/topics.js';
import { button } from '../ui/controls.js';
import { labArt } from '../ui/cards.js';
import { mountPredict } from '../ui/predict.js';

export async function load(ctx) {
  await loadCSS('app/css/v-predict.css');
  const ix = await index();
  const lab = ix.labs.get(ctx.params.id);
  if (!lab) throw new Error('Нет такой модели: ' + ctx.params.id);
  let mod = null;
  try { mod = await import('../sims/' + lab.id + '.js'); } catch (e) { console.warn('sim module missing', lab.id, e.message); }
  return { ix, lab, mod };
}

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export function mount(el, ctx, { ix, lab, mod }) {
  const L = LABS[lab.id] || { short: lab.title, tag: '' };
  const tp = ix.byTopic.get(lab.topic), tm = TOPICS[lab.topic];
  const pos = ix.labList.findIndex((l) => l.id === lab.id);
  const prev = ix.labList[pos - 1], next = ix.labList[pos + 1];
  store.set('lab.' + lab.id.replace('-', '_') + '.seen', Date.now());
  const doneKey = 'lab.' + lab.id.replace('-', '_') + '.done';
  const done = new Set(store.get(doneKey, []));

  const stage = h('div.simview__stage', { id: 'sim-root' });
  const tasks = (lab.task || []).filter((t) => !/^\s*Задание:?\s*$/i.test(t)).map((t) => t.replace(/^\s*\d+[.)]\s*/, ''));
  const taskList = h('ol.task__list', ...tasks.map((t, i) => {
    const cb = h('input', { type: 'checkbox', checked: done.has(i), 'aria-label': 'Задание выполнено' });
    cb.addEventListener('change', () => { cb.checked ? done.add(i) : done.delete(i); store.set(doneKey, [...done]); counter.textContent = done.size + '/' + tasks.length; });
    return h('li', h('label', cb, h('span.task__box'), h('span.task__t', t)));
  }));
  const counter = h('span.task__c', done.size + '/' + tasks.length);
  const taskBox = tasks.length ? h('details.task', h('summary', h('span.task__s', 'Задание'), counter, h('i.task__chev')), taskList) : null;

  const tools = h('div.simview__tools');
  let inst = null, ghost = false;
  const bReset = button({ label: 'Сбросить', icon: 'reset', sm: true, title: 'Вернуть исходные значения', onClick: () => { inst && inst.reset && inst.reset(); ghostOff(); toast('Значения сброшены'); } });
  const bCmp = button({ label: 'Сравнить', icon: 'camera', sm: true, title: 'Запомнить текущие кривые и сравнивать с ними', onClick: () => {
    if (!inst) return;
    if (!ghost) { (inst.compare ? inst.compare() : (inst.charts || []).forEach((c) => c.snapshot())); ghost = true; bCmp.classList.add('is-on'); bCmp.lastChild.textContent = 'Убрать след'; toast('Прежнее положение кривых сохранено пунктиром'); }
    else ghostOff();
  } });
  function ghostOff() { if (!ghost) return; (inst && inst.clearCompare ? inst.clearCompare() : ((inst && inst.charts) || []).forEach((c) => c.clearGhosts())); ghost = false; bCmp.classList.remove('is-on'); bCmp.lastChild.textContent = 'Сравнить'; }
  const bPng = button({ label: 'PNG', sm: true, title: 'Сохранить график как картинку', onClick: async () => {
    const c = inst && inst.charts && inst.charts[0]; if (!c) return;
    try { const blob = await c.toPNG(); const a = h('a', { href: URL.createObjectURL(blob), download: lab.id + '.png' }); document.body.append(a); a.click(); a.remove(); toast('График сохранён'); } catch (e) { toast('Не удалось сохранить'); }
  } });
  const bFs = button({ label: 'Во весь экран', sm: true, onClick: () => { const t = $('.simview__frame', el); if (document.fullscreenElement) document.exitFullscreen(); else t.requestFullscreen && t.requestFullscreen(); } });

  const frame = h('div.simview__frame', stage);
  const predHost = h('div.pr-host');
  el.append(h('article.wrap.simview.sim-' + lab.id,
    h('div.simview__top', h('nav.crumbs', { 'aria-label': 'Навигация' }, h('a', { href: '#/lab' }, 'Лаборатория'), h('i', '/'), h('a', { href: '#/theory/' + lab.topic }, 'Тема ' + lab.topic)), tools),
    h('header.simview__head',
      h('div', h('p.eyebrow.eyebrow--dot', 'Модель ' + rub(pos + 1) + ' · тема ' + lab.topic), h('h1.h1.simview__t', L.short), h('p.lede.simview__lede', L.tag)),
      h('div.simview__ic', { html: icon(lab.topic), style: { '--c': 'var(--' + tm.c + ')' } })),
    taskBox,
    predHost,
    frame,
    h('section.simview__rel',
      h('h2.eyebrow', 'Теория к этой модели'),
      h('ul', ...tp.lectures.map((l) => h('li', h('a', { href: '#/read/' + l.id }, h('b', l.id), h('span', l.short || l.title), h('i', { html: arrow }))))),
      tp.tasks && tp.tasks.length ? h('a.btn.btn--sm', { href: '#/tasks/' + lab.topic }, 'Задачи по теме') : null,
      tp.test ? h('a.btn.btn--sm', { href: '#/tests/' + lab.topic }, 'Тест по теме') : null),
    h('nav.simview__pn', { 'aria-label': 'Соседние модели' },
      prev ? h('a.card.simview__pn-a', { href: '#/lab/' + prev.id }, h('small', '← Предыдущая'), h('b', (LABS[prev.id] || {}).short || prev.title)) : h('span'),
      next ? h('a.card.simview__pn-a.is-next', { href: '#/lab/' + next.id }, h('small', 'Следующая →'), h('b', (LABS[next.id] || {}).short || next.title)) : h('span'))));

  if (mod && (mod.mount || mod.default)) {
    const env = { id: lab.id, lab, topic: lab.topic, tasks, reduced: document.documentElement.classList.contains('reduce'), bus, toast };
    try {
      inst = (mod.mount || mod.default)(stage, env) || {};
    } catch (e) {
      console.error(e);
      stage.append(h('div.co.co--bad', h('strong.co__t', 'Не удалось запустить модель'), h('div.co__b', String(e && e.message || e))));
      inst = {};
    }
    if (inst.reset) tools.append(bReset);
    if ((inst.charts && inst.charts.length) || inst.compare) tools.append(bCmp);
    if (inst.charts && inst.charts.length) tools.append(bPng);
    if (document.fullscreenEnabled) tools.append(bFs);
  } else {
    stage.append(h('div.simview__soon', h('div.simview__soon-art', { html: labArt(lab.id), style: { '--c': 'var(--' + tm.c + ')', '--c2': 'var(--d2)' } }), h('p.lede', 'Эта модель ещё настраивается. Загляните чуть позже.'), h('a.btn', { href: '#/lab' }, 'Ко всем моделям')));
  }
  /* «Предскажи, затем проверь»: панель над моделью (после блока задания); ?predict=1 — раскрыта и «обязательна» */
  let pred = null;
  try {
    pred = mountPredict({
      stage, frame, labId: lab.id, inst, lectures: tp.lectures || [], required: ctx.query && ctx.query.predict === '1',
      /* при фиксации прогноза прежние кривые остаются пунктиром — как кнопка «Сравнить» */
      onFix: () => {
        if (!inst) return;
        (inst.compare ? inst.compare() : (inst.charts || []).forEach((c) => c.snapshot()));
        ghost = true; bCmp.classList.add('is-on'); bCmp.lastChild.textContent = 'Убрать след';
      },
    });
    predHost.append(pred.el);
  } catch (e) { console.error(e); }
  const cleanEnh = enhance(el);
  return {
    title: L.short,
    destroy() { try { pred && pred.destroy(); } catch (e) { console.error(e); } try { inst && inst.destroy && inst.destroy(); } catch (e) { console.error(e); } cleanEnh && cleanEnh(); },
  };
}
