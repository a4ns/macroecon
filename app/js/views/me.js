/* Прогресс — #/me (V3_PLAN §3.5). Подстраницы #/me/errors|notes|report делегируются модулям me-<page>.js. */
import { h, loadCSS, plural } from '../core/dom.js';
import { S, SR, QA, NT, dayNum, dayToDate } from '../core/state.js';
import { lastAnswers, openErrors } from '../core/qa.js';
import { isTerm } from '../core/sr.js';
import { ctx as dataCtx, trail } from '../core/plan.js';
import { profile, calibration } from '../core/mastery.js';
import { enhance } from '../core/motion.js';
import { TOPICS } from '../data/topics.js';
import { heat, heatLegend, how } from '../ui/heat.js';
import { topicWord, nb } from '../ui/trail.js';

const NB = ' ';
const PAGES = new Set(['errors', 'notes', 'report']);
const pct = (x) => Math.round(x * 100) + NB + '%';
const AR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export async function load(ctx) {
  const page = ctx.params && ctx.params.page;
  if (page && PAGES.has(page)) {
    let mod = null, data = null, error = null;
    try { mod = await import(`./me-${page}.js`); if (mod.load) data = await mod.load(ctx); } catch (e) { console.error(e); error = e; }
    return { sub: page, mod, data, error };
  }
  const [c] = await Promise.all([dataCtx(), loadCSS('app/css/v-course.css'), loadCSS('app/css/v-me.css')]);
  return { c };
}

export function mount(el, ctx, d) {
  if (d.sub) {
    if (d.mod && d.mod.mount) return d.mod.mount(el, ctx, d.data);
    el.append(h('div.wrap.me', h('header.me__head', h('p.eyebrow.eyebrow--dot', 'Прогресс'), h('h1.display', 'Раздел недоступен'), h('p.lede', 'Не удалось открыть этот раздел. Остальное на месте.'), h('a.btn', { href: '#/me' }, 'К прогрессу'))));
    return { title: 'Прогресс' };
  }
  const { c } = d;
  const cc = { ...c, last: lastAnswers([0, 2, 3]) };
  const topics = c.ix.topics.map((t) => t.n);
  const rows = topics.map((n) => { const tr = trail(n, cc); return { n, tr, st: tr.stat }; });
  const today = dayNum(), log = QA.data;
  const first = !log.length && !S.data.ses.length && !Object.keys(S.data.lec).length && !Object.keys(S.data.tk).length && !Object.keys(S.data.pr).length;
  const errN = openErrors(c.bank).length, noteN = Object.values(NT.data).reduce((a, x) => a + (Array.isArray(x) ? x.length : 0), 0);

  const nav = h('nav.me__nav', { 'aria-label': 'Разделы прогресса' },
    h('a.btn.btn--sm', { href: '#/me/errors' }, 'Ошибки' + (errN ? ` · ${errN}` : '')),
    h('a.btn.btn--sm', { href: '#/me/notes' }, 'Заметки' + (noteN ? ` · ${noteN}` : '')),
    h('a.btn.btn--sm', { href: '#/me/report' }, 'Справка'),
    h('a.btn.btn--sm.btn--primary', { href: '#/exam' }, 'Пробный экзамен'));
  const head = h('header.me__head',
    h('p.eyebrow.eyebrow--dot', 'Прогресс'),
    h('h1.display', { html: 'Ваша <em>карта</em>' }),
    h('p.lede', first ? 'Здесь появится карта, когда вы ответите на первые вопросы.' : 'Что освоено, что остывает и куда направить следующий час. Любое число можно развернуть: «как посчитано».'),
    nav);
  if (first) {
    el.append(h('div.wrap.me', head, h('section.card.me__empty.rv',
      h('h2.h3', 'Пока нечего показывать'),
      h('p', 'Карта строится из ваших ответов, решённых задач и прочитанных лекций. Начните с короткой диагностики (28 вопросов, без оценки) или сразу с первой лекции.'),
      h('div.me__ea', h('a.btn.btn--primary', { href: '#/diag' }, 'Пройти диагностику'), h('a.btn', { href: '#/read/1.1' }, 'Читать лекцию 1.1')))));
    const dn = enhance(el); return { title: 'Прогресс', destroy() { dn && dn(); } };
  }

  /* (1) курс */
  const mastered = rows.filter((r) => r.st.status === 'Освоена').length;
  const rets = rows.map((r) => r.st.ret).filter((x) => x != null), avgRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null;
  const dset = new Set();
  log.forEach((r) => dset.add(dayNum(r[0]))); S.data.ses.forEach((x) => dset.add(dayNum(x.t)));
  Object.values(S.data.lec).forEach((l) => { if (l.o) dset.add(dayNum(l.o)); if (l.x) dset.add(dayNum(l.x)); });
  const act28 = [...dset].filter((x) => x > today - 28 && x <= today).length;
  const kpi = (label, big, sub, href, hw) => h('div.me__k', { class: href ? 'is-link' : '' },
    href ? h('a.me__kn.num', { href, 'aria-label': label + ': ' + big }, big) : h('b.me__kn.num', big), h('span.me__kl', label), sub ? h('span.me__ks', nb(sub)) : null, how(hw));
  const course = h('section.me__sec.rv', h('h2.eyebrow', 'Курс'),
    h('div.me__kpis',
      kpi('Освоено тем', `${mastered} из ${topics.length}`, mastered ? 'Статус «Освоена» даёт полный критерий' : 'Пока ни одной: откройте карту курса', '#/course', ['Тема считается освоенной, когда выполнены все условия: лекции, прогноз на модели, задачи от 70 %, охват вопросов, две тестовые сессии в разные дни и сохранность от 70 %.', 'Список недостающего — на странице каждой темы.']),
      kpi('Средняя сохранность', avgRet == null ? '—' : pct(avgRet), avgRet == null ? 'Нужно хотя бы 5 карточек в одной теме' : `по ${rets.length} ${plural(rets.length, ['теме', 'темам', 'темам'])} с колодой`, '#/review', ['Сохранность карточки — вероятность вспомнить: 0,9 в степени (дней с последнего показа / интервал карточки). Тема: среднее по её карточкам, если их не меньше 5. Курс: среднее по темам.', 'Это модель забывания, а не измерение: она подсказывает, когда повторить.']),
      kpi('Активных дней за 4 недели', `${act28} из 28`, act28 ? 'Считаем дни, когда вы отвечали или читали' : 'Один день в неделю — уже ритм', null, ['День считается активным, если в нём был хотя бы один ответ на вопрос, сданная сессия или открытая лекция. Учебный день начинается в 04:00.', 'Серий и «потерянных дней» нет: пропуск ничего не обнуляет.'])));

  /* (2) карта тем */
  const map = h('section.me__sec.rv', h('div.me__sh', h('h2.eyebrow', 'Карта тем'), how(['Каждая клетка показывает долю выполненного: ○ пусто, ◔ четверть, ◑ половина, ◕ три четверти, ● всё; рядом число.', 'Чтение — изученные лекции; Модель — прогноз и пункты «Задание»; Задачи — средний балл; Тест — последний результат; Повторение — доля выученных карточек.', 'Освоение = 20 % чтение + 15 % модель + 25 % задачи + 40 % вопросы. Сохранность — средняя вероятность вспомнить карточки темы.'])),
    heat(rows, cc), heatLegend());

  /* (3) профиль */
  const pf = profile(cc);
  const bar = (label, v, hint, href, act, hw) => h('div.me__pf', h('div.me__pfh', h('b', label), v == null ? h('span.me__pv.muted', 'нет данных') : h('span.me__pv.num', pct(v))),
    h('div.me__pb', { role: 'img', 'aria-label': v == null ? label + ': нет данных' : label + ': ' + pct(v) }, h('i', { style: { width: v == null ? 0 : Math.max(2, v * 100) + '%' } })),
    h('p.me__pt', v == null ? hint : '', h('a', { href }, act)), how(hw));
  const profileSec = h('section.me__sec.rv', h('h2.eyebrow', 'Профиль по типам заданий'),
    h('div.me__pfs',
      bar('Знание: вопросы', pf.know, 'Появится после ответов на вопросы тестов.', '#/tests', 'К тестам', ['Доля верных ответов на вопросы банка с поправкой на угадывание (у вопроса на 5 вариантов угадывание даёт 20 %, у «верно/неверно» — 50 %). Среднее по темам, где есть ответы. Диагностика не считается.']),
      bar('Применение: задачи', pf.apply, 'Появится после первых решённых задач.', '#/tasks', 'К задачам', ['Средний балл по задачам: решено без подсказки — 100 %, с подсказкой — 60 %, иначе доля верных полей в лучшей попытке, умноженная на 0,5.']),
      bar('Прогнозирование: модели', pf.predict, 'Появится после первого прогноза на модели.', '#/lab', 'К моделям', ['Доля верных строк в прогнозах «предскажи, затем проверь» на моделях: верные строки / все строки по всем попыткам.'])));

  /* (4) пробелы */
  const gapAction = (r) => ({ Q: ['Пройти тест', '#/tests/' + r.n], P: ['Решить задачи', '#/tasks/' + r.n], R: ['Читать лекции', (r.tr.steps[0] || {}).href || '#/course/' + r.n], ret: ['Повторить', '#/review?topic=' + r.n], err: ['Разобрать ошибки', '#/me/errors'] })[r.st.reasonKey] || ['К теме', '#/course/' + r.n];
  const gaps = rows.filter((r) => topicWord(r.st) !== 'Не начата').sort((a, b) => b.st.V - a.st.V).slice(0, 5);
  const gapSec = h('section.me__sec.rv', h('div.me__sh', h('h2.eyebrow', 'Пробелы'), how(['Ценность повторения темы = 0,5·(1 − освоение) + 0,3·(1 − сохранность) + 0,2·(неразобранные ошибки / 5, не больше 1). Чем выше, тем больше пользы от повторения именно этой темы.', 'Причина — слагаемое с наибольшим вкладом. Полоска — сама ценность, чем длиннее, тем выше приоритет.'])),
    gaps.length ? h('ol.me__gaps', ...gaps.map((r) => { const [lab, href] = gapAction(r); return h('li.me__g', { style: { '--c': 'var(--' + TOPICS[r.n].c + ')' } },
      h('a.me__gt', { href: '#/course/' + r.n }, h('b.mono', r.n), h('span', TOPICS[r.n].short)),
      h('span.me__gr', 'Причина: ' + r.st.reason),
      h('span.me__gv', { 'aria-hidden': 'true' }, h('i', { style: { width: Math.round(Math.min(1, r.st.V) * 100) + '%' } })),
      h('a.btn.btn--sm', { href, html: lab + ' ' + AR })); })) : h('p.muted', 'Пробелы появятся, когда вы начнёте несколько тем: сравнивать будет что с чем.'));

  /* (5) калибровка */
  const cal = calibration(log), nConf = log.filter((r) => r[5] === 2 && [0, 1, 2, 3].includes(r[4])).length;
  const calSec = cal == null ? null : h('section.me__sec.rv', h('div.me__sh', h('h2.eyebrow', 'Калибровка'), how([`Среди ${nConf} ответов, где вы выбрали «Уверен», верными были ${pct(cal)}. Считается от 20 таких ответов.`, 'Если процент заметно ниже ста, уверенность стоит проверять: именно такие ошибки («Опасные заблуждения») полезнее всего разбирать.'])),
    h('p.me__cal', nb(`Когда вы пишете «Уверен», вы правы в `), h('b.num', pct(cal)), NB + 'случаев.'),
    cal < .8 ? h('a.btn.btn--sm.me__bt', { href: '#/me/errors' }, 'Разобрать уверенные ошибки') : h('p.muted', 'Ваша уверенность в целом оправдана.'));

  /* (6) активность по неделям */
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const weeks = [];
  for (let k = 7; k >= 0; k--) { const a = new Date(mon); a.setDate(a.getDate() - 7 * k); const b = new Date(a); b.setDate(b.getDate() + 7); weeks.push({ a, b, v: 0 }); }
  log.forEach((r) => { const w = weeks.find((x) => r[0] >= x.a.getTime() && r[0] < x.b.getTime()); if (w) w.v++; });
  const fd = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  const total8 = weeks.reduce((a, w) => a + w.v, 0);
  const actSec = h('section.me__sec.rv', h('div.me__sh', h('h2.eyebrow', 'Активность · 8 недель'), how(['Столбец — число ответов на вопросы, задачи и прогнозы за неделю (пн–вс). Журнал хранит последние 2000 ответов, поэтому давние недели могут быть неполными.', 'Это объём, а не оценка: серий и «потерянных дней» здесь нет.'])),
    total8 ? columns(weeks.map((w, i) => ({ v: w.v, l: fd(w.a), t: `Неделя с ${fd(w.a)}: ${w.v} ${plural(w.v, ['ответ', 'ответа', 'ответов'])}`, hi: i === weeks.length - 1 })), 'ответов') : h('p.muted', 'За последние 8 недель ответов нет. Хватит и пяти минут: начните с карточек.'));

  /* (7) нагрузка повторений */
  const known = new Set(c.bank.all.map((Q) => Q.ukey)), cards = SR.data.c;
  const load14 = Array.from({ length: 14 }, () => 0);
  Object.keys(cards).forEach((k) => { if (!isTerm(k) && !known.has(k)) return; const d = cards[k][1]; if (d <= today) load14[0]++; else if (d - today < 14) load14[d - today]++; });
  const sum14 = load14.reduce((a, b) => a + b, 0), peak = Math.max(...load14);
  const loadSec = h('section.me__sec.rv', h('div.me__sh', h('h2.eyebrow', 'Нагрузка повторений · 14 дней'), how(['Сколько карточек придёт на каждый учебный день, если ничего не менять. В «сегодня» входят и просроченные.', 'Дни начинаются в 04:00. Если накопилось много, повторение само раскидывает остаток на ближайшие дни.'])),
    sum14 ? h('div', columns(load14.map((v, i) => { const dd = dayToDate(today + i); return { v, l: String(dd.getDate()), m: i === 0 ? 'сегодня' : dd.getDate() === 1 ? dd.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') : '', t: `${i === 0 ? 'Сегодня' : fd(dd)}: ${v} ${plural(v, ['карточка', 'карточки', 'карточек'])}`, hi: i === 0 }; }), 'карточек'),
      h('p.me__ln', nb(`Всего на ближайшие 14 дней — ${sum14}, пик — ${peak} за день.`), load14[0] ? h('a.btn.btn--sm', { href: '#/review' }, `Повторить сегодняшние (${Math.min(load14[0], S.data.set.revPerDay)})`) : null))
      : h('p.muted', 'Карточки появятся после первых ответов на вопросы.'));

  el.append(h('div.wrap.me', head, course, map, profileSec, gapSec, calSec, actSec, loadSec));
  const dn = enhance(el);
  return { title: 'Прогресс', destroy() { dn && dn(); } };
}

/** столбики на CSS: подписи остаются читаемыми на телефоне; значения над столбцами */
function columns(items, unit) {
  const max = Math.max(1, ...items.map((x) => x.v));
  return h('div.cols', { role: 'list', 'aria-label': unit, style: { '--n': items.length } },
    ...items.map((x) => h('div.cols__c' + (x.hi ? '.is-hi' : '') + (x.v ? '' : '.is-0'), { role: 'listitem', 'aria-label': x.t, title: x.t },
      h('span.cols__v.num', String(x.v)), h('span.cols__b', h('i', { style: { height: x.v ? Math.max(4, x.v / max * 100) + '%' : '2px' } })), h('span.cols__l', x.l), h('span.cols__m', x.m || ''))));
}
