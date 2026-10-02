/* Настройки — #/settings: роль, имя/группа, лимиты повторений, уверенность, календарь, шкала оценок,
   конфетти, резервная копия, сброс. Всё пишется в S.data (core/state.js). Подтверждения — внутри страницы. */
import { h, $, loadCSS, toast, plural } from '../core/dom.js';
import { S, exportBackup, importBackup, resetAll, storageAvailable } from '../core/state.js';
import { seg, toggle } from '../ui/controls.js';
import { weekInfo, dmy } from './today.js';
import { TOPICS } from '../data/topics.js';
import { enhance } from '../core/motion.js';

const NB = ' ';
const DAY = 864e5;
const svgI = (inner) => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: inner });

/** казахстанская буквенная шкала — типовые значения; кафедра может отличаться (поэтому её можно править) */
export const KZ_SCALE = [['A', 95], ['A−', 90], ['B+', 85], ['B', 80], ['B−', 75], ['C+', 70], ['C', 65], ['C−', 60], ['D+', 55], ['D', 50], ['F', 0]];
/** текущая шкала: [[буква, минимум %, максимум %], …] (учитывает правки из настроек) */
export function gradeScale() {
  const rows = Array.isArray(S.data.set.scaleRows) && S.data.set.scaleRows.length === KZ_SCALE.length ? S.data.set.scaleRows : KZ_SCALE;
  return rows.map(([l, min], i) => [l, min, i ? rows[i - 1][1] - 1 : 100]);
}
export const letterFor = (pct) => { const r = gradeScale().find(([, min]) => pct >= min); return r ? r[0] : 'F'; };

const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromIso = (s, end) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3], end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0); return d.getTime(); };
const ymd = (t) => iso(t).replace(/-/g, '');
const when = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export const load = () => loadCSS('app/css/v-settings.css');

export function mount(el) {
  const offs = [];
  const root = h('div.stg.wrap');
  el.append(root);
  const status = h('p.stg__saved', { role: 'status', 'aria-live': 'polite' });
  let fadeT = 0;
  const saved = () => { status.textContent = 'Сохранено'; status.classList.add('on'); clearTimeout(fadeT); fadeT = setTimeout(() => status.classList.remove('on'), 1800); };
  const save = () => { S.save(); saved(); };
  const set = S.data.set;

  const row = (id, title, hint, ...ctl) => h('div.stg-row', { id }, h('div.stg-row__l', h('b', title), hint ? h('p', hint) : null), h('div.stg-row__c', ...ctl));
  const sec = (id, n, title, lead, ...kids) => h('section.stg-sec.rv', { id, 'aria-labelledby': id + '-h' }, h('header', h('p.eyebrow', n), h('h2.h2', { id: id + '-h' }, title), lead ? h('p.stg-sec__lead', lead) : null), ...kids);
  const field = (type, val, o = {}) => h('input.stg-in', Object.assign({ type, value: val == null ? '' : val }, o));

  /* ── профиль ── */
  const roleSeg = seg({ label: 'Роль', options: [{ v: 'student', label: 'Студент' }, { v: 'teacher', label: 'Преподаватель' }, { v: 'self', label: 'Самоучка' }], value: S.data.role || 'student', onChange: (v, user) => { if (!user) return; S.data.role = v; save(); } });
  let pt = 0;
  const nameI = field('text', S.data.prof.name, { id: 'stg-name', maxlength: 60, autocomplete: 'name', placeholder: 'Необязательно' });
  const grpI = field('text', S.data.prof.grp, { id: 'stg-grp', maxlength: 20, placeholder: 'Необязательно' });
  const saveProf = () => { clearTimeout(pt); pt = setTimeout(() => { S.data.prof.name = nameI.value.trim(); S.data.prof.grp = grpI.value.trim(); save(); }, 350); };
  nameI.addEventListener('input', saveProf); grpI.addEventListener('input', saveProf);
  const secProfile = sec('profile', '01', 'Вы',
    'Роль не ограничивает возможности. Она только расставляет акценты в меню и на главной: преподавателю «Преподавателю» выносится на первое место.',
    row('r-role', 'Роль', null, roleSeg.el),
    row('r-name', 'Имя', 'Нужно только для справки о прохождении. Остаётся в этом браузере.', h('label.sr', { for: 'stg-name' }, 'Имя'), nameI),
    row('r-grp', 'Группа', null, h('label.sr', { for: 'stg-grp' }, 'Группа'), grpI));

  /* ── повторение ── */
  const revSeg = seg({ label: 'Карточек повторения в день', options: [15, 30, 50].map((v) => ({ v, label: String(v) })), value: [15, 30, 50].includes(set.revPerDay) ? set.revPerDay : 30, onChange: (v, u) => { if (!u) return; set.revPerDay = v; save(); } });
  const newSeg = seg({ label: 'Новых карточек в день', options: [5, 8, 15].map((v) => ({ v, label: String(v) })), value: [5, 8, 15].includes(set.newPerDay) ? set.newPerDay : 8, onChange: (v, u) => { if (!u) return; set.newPerDay = v; save(); } });
  const conf = toggle({ label: 'Спрашивать уверенность', hint: 'После ответа на вопрос — «Уверен», «Скорее да» или «Угадываю». Угаданные ответы не считаются выученными, а уверенные ошибки попадают в журнал первыми.', value: !!set.conf, onChange: (v, u) => { if (!u) return; set.conf = v; save(); } });
  const secReview = sec('review', '02', 'Повторение',
    'Если карточек накапливается больше лимита, остаток переносится на следующие дни — очередь не растёт лавиной.',
    row('r-rev', 'Лимит повторений', 'Сколько старых карточек показывать за один день.', revSeg.el),
    row('r-new', 'Новые карточки', 'Сколько новых вопросов и терминов добавлять в день.', newSeg.el),
    row('r-conf', 'Уверенность', null, conf.el));

  /* ── календарь ── */
  const preview = h('p.stg-preview', { 'aria-live': 'polite' });
  const paintPreview = () => {
    const w = weekInfo(set);
    preview.textContent = !set.start ? 'Календарь не задан: «Сегодня» покажет следующий шаг без привязки к неделям.'
      : w.before ? `Семестр начнётся ${dmy(set.start)} — через ${w.days}${NB}${plural(w.days, ['день', 'дня', 'дней'])}.`
      : w.pause ? 'Сейчас каникулы: календарь на паузе.'
      : w.over ? `Недель по календарю было ${w.W}. Семестр закончился — спасибо, что дошли.`
      : `Сегодня неделя ${w.week} из ${w.W}. Тема недели подставится на «Сегодня» автоматически.`;
  };
  const startI = field('date', set.start ? iso(set.start) : '', { id: 'stg-start', 'aria-describedby': 'stg-start-h' });
  startI.addEventListener('change', () => { set.start = fromIso(startI.value); save(); paintPreview(); });
  const clearBtn = h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: () => { set.start = null; startI.value = ''; save(); paintPreview(); } }, 'Очистить');
  const weeksI = field('number', set.weeks || 15, { id: 'stg-weeks', min: 4, max: 20, step: 1, inputmode: 'numeric' });
  weeksI.addEventListener('change', () => { const v = Math.max(4, Math.min(20, Math.round(+weeksI.value) || 15)); weeksI.value = v; set.weeks = v; save(); paintPreview(); });
  const paceSeg = seg({ label: 'Темп', options: [{ v: 15, label: '15 мин', hint: 'Спокойный' }, { v: 30, label: '30 мин', hint: 'Обычный' }, { v: 60, label: '60 мин', hint: 'Напряжённый' }], value: [15, 30, 60].includes(set.pace) ? set.pace : 30, onChange: (v, u) => { if (!u) return; set.pace = v; save(); } });
  const rkSel = (i) => {
    const s = h('select.stg-in', { id: 'stg-rk' + i, 'aria-label': `Рубежный контроль ${i + 1}: после темы` }, ...Object.keys(TOPICS).map((n) => h('option', { value: n, selected: (set.rk || [7, 14])[i] === +n }, `после темы ${n}`)));
    s.addEventListener('change', () => { const r = (set.rk || [7, 14]).slice(); r[i] = +s.value; set.rk = r.sort((a, b) => a - b); save(); $('#stg-rk0').value = set.rk[0]; $('#stg-rk1').value = set.rk[1]; });
    return s;
  };
  const pauseBox = h('div.stg-pauses');
  const err = h('p.stg-err', { role: 'alert' });
  const paintPauses = () => {
    pauseBox.replaceChildren();
    const list = set.pause || (set.pause = []);
    list.forEach((p, i) => {
      const a = field('date', iso(p[0]), { 'aria-label': `Каникулы ${i + 1}: с` }), b = field('date', iso(p[1]), { 'aria-label': `Каникулы ${i + 1}: по` });
      const upd = () => { const x = fromIso(a.value), y = fromIso(b.value, true); if (x == null || y == null || y < x) { err.textContent = 'Дата окончания каникул не может быть раньше начала.'; a.setAttribute('aria-invalid', 'true'); b.setAttribute('aria-invalid', 'true'); return; } err.textContent = ''; a.removeAttribute('aria-invalid'); b.removeAttribute('aria-invalid'); list[i] = [x, y]; save(); paintPreview(); };
      a.addEventListener('change', upd); b.addEventListener('change', upd);
      pauseBox.append(h('div.stg-pause', h('span', 'с'), a, h('span', 'по'), b, h('button.btn.btn--sm.btn--quiet', { type: 'button', 'aria-label': `Удалить каникулы ${i + 1}`, onclick: () => { list.splice(i, 1); save(); paintPauses(); paintPreview(); } }, 'Удалить')));
    });
  };
  paintPauses(); paintPreview();
  const addPause = h('button.btn.btn--sm', { type: 'button', onclick: () => { const t0 = Math.max(Date.now(), set.start || 0); set.pause = (set.pause || []).concat([[fromIso(iso(t0)), fromIso(iso(t0 + 6 * DAY), true)]]); save(); paintPauses(); paintPreview(); } }, '+ Добавить каникулы');
  const secCal = sec('calendar', '03', 'Календарь семестра',
    'Нужен, чтобы «Сегодня» показывало неделю и тему недели: по одной теме в неделю, последняя неделя — повторение. Пауза на каникулах сдвигает календарь.',
    row('r-start', 'Дата начала', 'Первый день первой недели.', h('div.stg-inline', startI, clearBtn), h('p#stg-start-h.sr', 'Дата начала семестра')),
    row('r-weeks', 'Недель в семестре', 'По умолчанию 15.', h('label.sr', { for: 'stg-weeks' }, 'Недель в семестре'), weeksI),
    row('r-pace', 'Темп', 'Сколько минут в день вы готовы заниматься — по нему считается, когда тема закончится.', paceSeg.el),
    row('r-rk', 'Рубежный контроль', 'По умолчанию после тем 7 и 14.', h('div.stg-inline', rkSel(0), rkSel(1))),
    row('r-pause', 'Каникулы', 'Пока идёт пауза, неделя не считается.', pauseBox, err, addPause),
    preview);

  /* ── шкала оценок ── */
  const scaleBox = h('div.stg-scale');
  const scaleErr = h('p.stg-err', { role: 'alert' });
  const paintScale = () => {
    scaleBox.replaceChildren();
    const sc = gradeScale(), mins = sc.map((r) => r[1]);
    const t = h('table.stg-tbl', h('caption.sr', 'Шкала оценок: нижняя граница в процентах'), h('thead', h('tr', h('th', { scope: 'col' }, 'Оценка'), h('th', { scope: 'col' }, 'От, %'), h('th', { scope: 'col' }, 'Диапазон'))));
    const body = h('tbody');
    sc.forEach(([l, min, max], i) => {
      const inp = i === sc.length - 1 ? h('span.stg-fix', '0') : field('number', min, { min: 1, max: 100, step: 1, inputmode: 'numeric', 'aria-label': `Оценка ${l}: нижняя граница, %` });
      const rng = h('td.stg-rng', `${min}–${max}`);
      if (inp.tagName === 'INPUT') inp.addEventListener('change', () => {
        const next = mins.slice(); next[i] = Math.round(+inp.value);
        const ok = next.every((v, k) => Number.isFinite(v) && (k === next.length - 1 ? v === 0 : v >= 1 && v <= 100) && (k === 0 || v < next[k - 1]));
        if (!ok) { scaleErr.textContent = 'Нижние границы должны убывать сверху вниз: каждая меньше предыдущей.'; inp.setAttribute('aria-invalid', 'true'); return; }
        scaleErr.textContent = ''; set.scaleRows = KZ_SCALE.map(([x], k) => [x, next[k]]); save(); paintScale();
      });
      body.append(h('tr', h('th', { scope: 'row' }, l), h('td', inp), rng));
    });
    t.append(body); scaleBox.append(t);
  };
  paintScale();
  const secScale = sec('scale', '04', 'Шкала оценок',
    'Буквенная шкала, которой подписываются проценты в справке и на экране прогресса. Это типовые значения. Подтвердите их на кафедре: если границы у вас другие, поправьте.',
    h('p.stg-chip', h('i', { 'aria-hidden': 'true' }), 'Типовые значения, подтвердите на кафедре'),
    scaleBox, scaleErr,
    h('button.btn.btn--sm.btn--quiet', { type: 'button', onclick: () => { delete set.scaleRows; scaleErr.textContent = ''; save(); paintScale(); } }, 'Вернуть типовые'));

  /* ── эффекты ── */
  const confetti = toggle({ label: 'Тихое празднование', hint: 'Короткое сообщение и мягкое конфетти, когда тема впервые становится «Освоена». Один раз на тему. Не показывается при системной настройке «уменьшить движение».', value: set.confetti !== false, onChange: (v, u) => { if (!u) return; set.confetti = v; save(); } });
  const secFx = sec('effects', '05', 'Эффекты', null, row('r-conf2', 'Празднование', null, confetti.el));

  /* ── резервная копия ── */
  const bkMsg = h('p.stg-msg', { role: 'status', 'aria-live': 'polite' });
  const lastBk = h('p.stg-last');
  const paintLast = () => { lastBk.textContent = S.data.seen.backup ? 'Последняя копия скачана ' + when(S.data.seen.backup) + '.' : 'Копию ещё не скачивали.'; };
  paintLast();
  const download = () => {
    try {
      const blob = new Blob([exportBackup()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: `makro-backup-${ymd(Date.now())}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      S.data.seen.backup = Date.now(); S.save(); paintLast(); bkMsg.className = 'stg-msg'; bkMsg.textContent = 'Файл сохранён. Храните его вне браузера: на диске или в облаке.';
    } catch (e) { bkMsg.className = 'stg-msg is-bad'; bkMsg.textContent = 'Не удалось создать файл: ' + (e.message || e); }
  };
  const panel = h('div.stg-import', { hidden: true });
  const fileI = h('input.sr', { type: 'file', accept: '.json,application/json', id: 'stg-file', onchange: async () => {
    const f = fileI.files && fileI.files[0]; if (!f) return;
    try {
      const text = await f.text(), j = JSON.parse(text);
      if (!j || j.app !== 'makro' || j.ver !== 3) throw new Error('Это не резервная копия «Макро».');
      showPanel(f.name, text, j);
    } catch (e) { panel.hidden = true; bkMsg.className = 'stg-msg is-bad'; bkMsg.textContent = e instanceof SyntaxError ? 'Файл не читается: это не резервная копия «Макро».' : (e.message || 'Не удалось прочитать файл.'); }
    fileI.value = '';
  } });
  const showPanel = (name, text, j) => {
    const nA = (j.QA || []).length, nC = Object.keys((j.SR && j.SR.c) || {}).length, nL = Object.keys((j.S && j.S.lec) || {}).length;
    let mode = 'merge';
    const modeSeg = seg({ label: 'Как загрузить', options: [{ v: 'merge', label: 'Объединить' }, { v: 'replace', label: 'Заменить' }], value: 'merge', onChange: (v) => { mode = v; hint.textContent = HINT[mode]; apply.classList.toggle('is-danger', mode === 'replace'); } });
    const HINT = { merge: 'Берётся лучшее из двух: новые карточки, ответы, заметки, прочитанные лекции. Ничего не теряется.', replace: 'Весь прогресс в этом браузере будет заменён данными из файла. Если в браузере есть то, чего нет в файле, оно пропадёт.' };
    const hint = h('p.stg-hint', HINT.merge);
    const apply = h('button.btn.btn--primary', { type: 'button', onclick: () => {
      try { importBackup(text, mode); panel.hidden = true; bkMsg.className = 'stg-msg is-ok'; bkMsg.textContent = mode === 'replace' ? 'Готово: прогресс заменён данными из файла.' : 'Готово: данные из файла объединены с текущими.'; toast('Копия загружена'); rerender(); }
      catch (e) { bkMsg.className = 'stg-msg is-bad'; bkMsg.textContent = e.message || 'Не удалось загрузить копию.'; }
    } }, 'Загрузить');
    panel.hidden = false;
    panel.replaceChildren(h('p.stg-import__f', h('b', name), ' · от ', when(j.at || Date.now())), h('p.stg-import__s', `Ответов в журнале: ${nA}, карточек: ${nC}, лекций с отметками: ${nL}.`), modeSeg.el, hint, h('div.stg-btns', apply, h('button.btn.btn--quiet', { type: 'button', onclick: () => { panel.hidden = true; } }, 'Отмена')));
    modeSeg.seg.querySelector('[aria-checked="true"]').focus();
  };
  const secBackup = sec('backup', '06', 'Резервная копия',
    'Единственный способ перенести прогресс на другое устройство или спасти его при очистке браузера — файл. Он содержит только ваши данные, не учебник.',
    row('r-dl', 'Скачать', null, h('button.btn.btn--primary', { type: 'button', onclick: download }, svgI('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'), 'Скачать копию'), lastBk),
    row('r-ul', 'Загрузить', 'Объединить с текущим прогрессом или заменить его.', h('label.btn', { for: 'stg-file' }, svgI('<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>'), 'Выбрать файл…'), fileI, panel),
    bkMsg);

  /* ── сброс ── */
  const confirmBox = h('div.stg-confirm', { hidden: true, role: 'alertdialog', 'aria-labelledby': 'stg-cf-t', 'aria-describedby': 'stg-cf-d' });
  const resetBtn = h('button.btn.is-danger', { type: 'button', onclick: () => {
    confirmBox.hidden = false; resetBtn.hidden = true;
    confirmBox.replaceChildren(h('p#stg-cf-t.stg-confirm__t', 'Сбросить весь прогресс?'), h('p#stg-cf-d', 'Будут удалены отметки о лекциях, задачи, результаты тестов, карточки, журнал ошибок, заметки и настройки в этом браузере. Отменить это нельзя. Сначала скачайте копию, если прогресс вам дорог.'),
      h('div.stg-btns', h('button.btn.is-danger.btn--primary', { type: 'button', onclick: () => { resetAll(); toast('Прогресс сброшен'); location.hash = '#/start'; } }, 'Да, удалить всё'), h('button.btn', { type: 'button', id: 'stg-cf-no', onclick: () => { confirmBox.hidden = true; resetBtn.hidden = false; resetBtn.focus(); } }, 'Отмена')));
    $('#stg-cf-no', confirmBox).focus();
  } }, 'Сбросить прогресс…');
  const secReset = sec('reset', '07', 'Сброс', 'Начать с чистого листа.', h('div.stg-danger', resetBtn, confirmBox));

  /* ── честная плашка ── */
  const note = h('aside.stg-note.rv', { 'aria-label': 'Как хранится прогресс' },
    h('b', 'Как хранится ваш прогресс'),
    h('ul', h('li', 'Только в этом браузере на этом устройстве: на сервер ничего не отправляется.'),
      h('li', 'Очистка данных сайта, другой браузер или другое устройство — и вы начнёте с нуля. Перенос — файлом резервной копии (ниже).'),
      h('li', 'Результаты тестов и задач — самопроверка, а не официальная оценка: вопросы и ответы лежат в открытом виде.')),
    !storageAvailable() ? h('p.stg-note__bad', 'Сейчас браузер не даёт сохранять данные (например, приватный режим): прогресс пропадёт при закрытии вкладки. Скачайте копию.') : null);

  const toc = [['profile', 'Вы'], ['review', 'Повторение'], ['calendar', 'Календарь'], ['scale', 'Шкала оценок'], ['effects', 'Эффекты'], ['backup', 'Резервная копия'], ['reset', 'Сброс']];
  let secs = [];
  function build() {
    root.replaceChildren(
      h('header.stg__head',
        h('p.eyebrow.eyebrow--dot', 'Настройки'),
        h('h1.display.stg__h1', { html: 'Под <em>себя</em>' }),
        status),
      note,
      h('div.stg__body',
        h('nav.stg__toc', { 'aria-label': 'Разделы настроек' }, ...toc.map(([id, t]) => h('a', { href: '#/settings', onclick: (e) => { e.preventDefault(); const s = document.getElementById(id); if (s) s.scrollIntoView({ behavior: document.documentElement.classList.contains('reduce') ? 'auto' : 'smooth', block: 'start' }); } }, t))),
        h('div.stg__secs', secProfile, secReview, secCal, secScale, secFx, secBackup, secReset)));
    secs = enhance(el);
  }
  // после загрузки копии значения в полях устарели: пересобираем страницу
  const rerender = () => { cleanup && cleanup(); clearTimeout(pt); el.replaceChildren(); const r = mount(el); inst.destroy = r.destroy; };
  let cleanup = null; const inst = {};
  build(); cleanup = secs;
  Object.assign(inst, { title: 'Настройки', destroy() { clearTimeout(pt); clearTimeout(fadeT); if (nameI.value.trim() !== (S.data.prof.name || '') || grpI.value.trim() !== (S.data.prof.grp || '')) { S.data.prof.name = nameI.value.trim(); S.data.prof.grp = grpI.value.trim(); S.save(); } cleanup && cleanup(); offs.forEach((f) => f()); } });
  return inst;
}
