/* Хаб преподавателя — #/teach  (V3_PLAN §4.7, честные ограничения §4.8) */
import { h, loadCSS, plural } from '../core/dom.js';
import { ctx as planCtx, currentTopic } from '../core/plan.js';
import { S } from '../core/state.js';
import { TOPICS } from '../data/topics.js';

export async function load() {
  const [c] = await Promise.all([planCtx(), loadCSS('app/css/v-teach.css')]);
  return { c };
}

const ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const arrow = () => h('span.th-ar', { html: ARR });
const fmtDate = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export function mount(el, ctx, { c }) {
  const ix = c.ix, cur = currentTopic(c), curTp = ix.byTopic.get(cur);
  const lecSel = (id, label) => h('select.th-sel', { id, 'aria-label': label },
    ...ix.topics.map((tp) => h('optgroup', { label: `Тема ${tp.n}. ${TOPICS[tp.n] ? TOPICS[tp.n].short : tp.title}` }, ...tp.lectures.map((l) => h('option', { value: l.id, selected: l.id === curTp.lectures[0].id }, `${l.id} · ${l.short.length > 56 ? l.short.slice(0, 54) + '…' : l.short}`)))));
  const topicSel = (id, label, def = cur) => h('select.th-sel', { id, 'aria-label': label }, ...ix.topics.map((tp) => h('option', { value: tp.n, selected: tp.n === def }, `${tp.n}. ${TOPICS[tp.n] ? TOPICS[tp.n].short : tp.title}`)));

  const tile = (n, title, text, body, cls = '') => h('section.th-tile.card' + (cls ? '.' + cls : ''), { 'aria-labelledby': 'th-' + n },
    h('span.th-n.mono', n), h('h2.th-t', { id: 'th-' + n }, title), h('p.th-p', text), h('div.th-b', ...[].concat(body)));
  const go = (label, fn, primary = true) => h('button.btn.btn--sm' + (primary ? '.btn--primary' : ''), { type: 'button', onclick: fn }, label);
  const lecP = lecSel('th-lp', 'Лекция для презентации'), lecM = lecSel('th-lm', 'Лекция для плана пары');
  const voteT = topicSel('th-v', 'Тема для голосования'), wsT = topicSel('th-w', 'Тема рабочего листа');
  const to = (hash) => () => { location.hash = hash; };

  const last = S.data.teach.last;
  const lastBox = last && last.href
    ? h('a.th-last', { href: last.href }, h('small', 'Последнее'), h('b', last.kind === 'variants' ? 'Варианты · зерно ' + last.seed : last.kind === 'assign' ? 'Задание · ' + (last.title || last.id) : 'Недавнее'), h('span.mono', fmtDate(last.at)))
    : null;

  el.append(h('div.th.wrap',
    h('header.th-head',
      h('p.eyebrow.eyebrow--dot', 'Преподавателю'),
      h('h1.h1', 'Кабинет ', h('em', 'преподавателя')),
      h('p.lede', 'Лекция на проекторе, голосование карточками, варианты для бумаги, задание по ссылке и сводка по кодам. Всё работает без сервера и без регистрации.')),
    h('div.th-grid',
      h('div.th-tiles',
        tile('01', 'Презентация лекции', 'Лекция по шагам на весь экран; клавиши Q, M, G — вопрос, модель, карта.', [lecP, go('Открыть', () => to('#/present/' + lecP.value)())]),
        tile('02', 'План пары', 'Разминка, лекционные блоки, голосование, модель и выходной вопрос — из имеющегося материала.', [lecM, go('Открыть', () => to('#/teach/plan/' + lecM.value)())]),
        tile('03', 'Голосование', 'Вопрос на экране, студенты поднимают карточки А–Д, вы вносите счёт.', [voteT, go('Начать', () => to('#/teach/vote/' + voteT.value)())]),
        tile('04', 'Варианты и ДЗ', 'Наборы из банка без повторов, ключ и бланк ответов; тот же набор открывается по ссылке.', [h('a.btn.btn--sm.btn--primary', { href: '#/teach/variants' }, 'Собрать варианты'), last && last.kind === 'variants' ? h('a.btn.btn--sm', { href: last.href }, 'Последний набор') : null]),
        tile('05', 'Выдать задание', 'Выберите темы и пункты — получите ссылку, которую студенты открывают у себя.', [h('a.btn.btn--sm.btn--primary', { href: '#/teach/assign' }, 'Создать ссылку')]),
        tile('06', 'Сводка по кодам', 'Вставьте присланные коды — получите таблицу «студент × пункт» и самые трудные вопросы.', [h('a.btn.btn--sm.btn--primary', { href: '#/teach/summary' }, 'Открыть сводку')]),
        tile('07', 'Печатные листы', 'A4, чёрно-белые, без меню. Варианты, ключ и бланк печатаются из генератора.', [
          h('div.th-row', h('a.btn.btn--sm', { href: '#/print/cards' }, 'Карточки А–Д'), h('a.btn.btn--sm', { href: '#/teach/variants' }, 'Варианты, ключ, бланк')),
          h('div.th-row', wsT, go('Рабочий лист', () => to('#/print/worksheet/' + wsT.value)(), false))], 'th-tile--wide')),
      h('aside.th-side',
        h('section.card.th-cur', h('small.th-sm', 'Ближайшая тема'), h('h2.th-t', `Тема ${cur}`), h('p.th-p', curTp.title),
          h('p.mono.th-mm', curTp.lectures.length + ' ' + plural(curTp.lectures.length, ['лекция', 'лекции', 'лекций']) + ' · ' + curTp.lectures.reduce((a, l) => a + (l.min || 0), 0) + ' мин'),
          h('div.th-links', h('a', { href: '#/present/' + curTp.lectures[0].id }, 'Презентация ', arrow()), h('a', { href: '#/teach/plan/' + curTp.lectures[0].id }, 'План пары ', arrow()), h('a', { href: '#/teach/vote/' + cur }, 'Голосование ', arrow()), h('a', { href: '#/print/worksheet/' + cur }, 'Рабочий лист ', arrow())),
          S.data.set.start ? null : h('p.th-hint', 'Тема взята по вашей учебной траектории. Начало семестра можно задать в настройках — тогда тема будет определяться по календарю.')),
        lastBox)),
    h('section.th-lim.co.co--warn', { 'aria-labelledby': 'th-lim' },
      h('h2.co__t', { id: 'th-lim' }, 'Честные ограничения'),
      h('ul.th-ul',
        h('li', h('b', 'Результаты студентов — самоотчёт. '), 'Код сдачи защищён только от опечаток; подделать его без сервера можно. Для оценивания используйте рубежный контроль на бумаге с новым зерном.'),
        h('li', h('b', 'Банк вопросов открыт. '), 'Вопросы и верные ответы лежат в обычном JSON — студент может их найти. Поэтому всё в приложении — формативное, тренировочное.'),
        h('li', h('b', 'Защитить задание без сервера нельзя. '), 'Ссылка и код — это текст: их можно переслать, скопировать и изменить.'),
        h('li', h('b', 'Сводка строится у вас. '), 'Коды вставляются в браузер преподавателя и обрабатываются локально; данные не покидают браузер и никуда не отправляются.'),
        h('li', h('b', 'Голосование — карточками. '), 'Собрать ответы с телефонов без сервера нельзя: студенты поднимают карточки, счёт вносите вы.'),
        h('li', h('b', 'Данные живут в этом браузере. '), 'Смена устройства или очистка данных браузера стирает их; сохраняйте резервный файл в настройках.')))));
  return { title: 'Преподавателю', destroy() {} };
}
