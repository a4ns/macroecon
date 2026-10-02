/* bootstrap */
import { initTheme } from './core/theme.js';
import { start } from './core/router.js';
import { spotlight } from './core/motion.js';
import { migrate, S, bus as sbus, storageAvailable } from './core/state.js';
import { ctx, refreshMastery } from './core/plan.js';
import { bus, h, toast, reduced, debounce } from './core/dom.js';
import { TOPICS } from './data/topics.js';
import { initHeader, initNav, initMenu, initCursor, initDue, renderFooter } from './ui/chrome.js';
import { initPalette } from './ui/palette.js';

try { migrate(); } catch (e) { console.warn('migrate', e); }   // mx:v1 → mx:v3, один раз
initTheme();
initHeader();
initNav();
initMenu();
initCursor();
spotlight();
initPalette();
renderFooter();
const due = initDue();
start();

/* контекст данных (оглавление, банк вопросов, задачи) — заранее, в простое; затем счётчик и проверка освоения */
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
idle(() => ctx().then(() => { due(); refreshMastery(); }).catch(() => {}));

/* ── тихое празднование: только за реальную веху «Освоена», один раз на тему ── */
function celebrate(ns) {
  const fresh = (ns || []).filter((n) => !S.data.seen['m' + n]);
  if (!fresh.length) return;
  fresh.forEach((n) => { S.data.seen['m' + n] = Date.now(); });
  S.save();
  const name = (n) => 'тема ' + n + (TOPICS[n] ? ' «' + TOPICS[n].short + '»' : '');
  toast(fresh.length === 1 ? 'Освоена ' + name(fresh[0]) + '. Отличная работа.' : 'Освоены темы ' + fresh.join(', ') + '. Отличная работа.');
  if (S.data.set.confetti && !reduced()) confetti();
}
function confetti() {
  const box = h('div.sh-conf', { 'aria-hidden': 'true' });
  const cols = ['--accent', '--d2', '--d5', '--d4', '--d6'];
  for (let i = 0; i < 28; i++) box.append(h('i', { style: { '--x': (8 + Math.random() * 84).toFixed(1) + '%', '--dx': ((Math.random() - .5) * 160).toFixed(0) + 'px', '--dl': (Math.random() * .5).toFixed(2) + 's', '--du': (2.2 + Math.random() * 1.4).toFixed(2) + 's', '--c': 'var(' + cols[i % cols.length] + ')', '--r': Math.round(Math.random() * 360) + 'deg', '--w': (6 + Math.random() * 5).toFixed(0) + 'px' } }));
  document.body.append(box);
  setTimeout(() => box.remove(), 4200);
}
sbus.on('mastered', celebrate);
// проверка вех: после смены маршрута и после записи результатов (с задержкой, чтобы не считать на каждый ответ)
const check = debounce(() => { try { refreshMastery(); } catch (e) { /* данные ещё не загружены */ } }, 1500);
bus.on('route', check);
sbus.on('change', (k) => { if (k === 'mx:v3' || k === 'mx:v3:qa') check(); });

/* ── хранилище недоступно: честно говорим, что прогресс не сохранится ── */
let warned = false;
function warnStorage() {
  if (warned) return; warned = true;
  const bar = h('div#storage-warn.sh-warn', { role: 'alert' },
    h('span', 'В этом режиме браузера прогресс не сохранится. Скачайте резервную копию в ', h('a', { href: '#/settings' }, 'Настройках'), '.'),
    h('button.sh-warn__x', { type: 'button', 'aria-label': 'Закрыть предупреждение', onclick: () => { bar.remove(); document.documentElement.classList.remove('has-warn'); } }, '×'));
  document.body.append(bar); document.documentElement.classList.add('has-warn');
}
sbus.on('storage-fail', warnStorage);
if (!storageAvailable()) warnStorage();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/^(localhost|127\.)/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
