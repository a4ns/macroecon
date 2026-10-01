# Как писать страницу-вид (docs/VIEW_API.md)

SPA на чистых ES-модулях, hash-роутер (`app/js/core/router.js`). Каждая страница — модуль в `app/js/views/<name>.js`:

```js
import { h, $, $$, loadCSS } from '../core/dom.js';
import { index, tasks } from '../core/data.js';

export async function load(ctx) {            // ctx = { path, query, params, nav }; можно вернуть данные → пойдут третьим аргументом в mount
  await loadCSS('app/css/v-tasks.css');      // свои стили подключайте так (один раз, без вспышки нестилизованного контента)
  return { ix: await index(), data: await tasks() };
}
export function mount(el, ctx, data) {       // el = <main id="main">; уже очищен
  el.append(…);
  return {
    title: 'Задачи',                         // → document.title «Задачи · Макро»
    update(ctx) {…},                         // (необязательно) вызывается при смене query/params на той же странице вместо перемонтирования
    destroy() {…},                           // снять слушатели/таймеры/observer'ы
  };
}
```
Маршруты (`app/js/core/router.js`): `#/`, `#/theory`, `#/theory/:topic`, `#/read/:id`, `#/lab`, `#/lab/:id`, `#/tasks`, `#/tasks/:topic`, `#/tests`, `#/tests/:topic`, `#/glossary`, `#/glossary/:letter`, `#/more`, `#/more/:page`. Параметры запроса — `#/tasks/3?t=3.2` → `ctx.query.t`. Ссылки — обычные `<a href="#/…">`.

## Дизайн-язык (смотрите `app/js/views/home.js`, `app/js/views/sim.js` и `app/css/*.css` — это образец)

- Тёмная «Night Atlas» (по умолчанию) и светлая «Paper» темы через токены: `--bg --bg-2 --surface --surface-2 --surface-3 --line --line-2 --line-3 --ink --ink-2 --ink-3 --ink-4 --accent --accent-ink --d1..--d6 --ok --warn --bad`. **Только токены, никаких литеральных цветов.**
- Шрифты: `--f-serif` (Literata — текст и заголовки), `--f-sans` (Sofia Sans — интерфейс), `--f-display` (Sofia Sans XC, 900 — плакатные заголовки, капсом), `--f-mono` (метки, числа). Готовые классы: `.eyebrow`, `.eyebrow--dot`, `.display`, `.h1 .h2 .h3` (в них `<em>` = акцентный курсив), `.lede`, `.mono`, `.num`, `.muted`, `.kbd`, `.wrap`/`.wrap--narrow`, `.btn`(`--primary --sm --lg`), `.chip`(`.is-on`), `.card` (подсветка под курсором), `.tabs`, `.ring`, `.co` (callout), `.dt` (таблица), `.ans` (поле ответа, `.is-ok/.is-bad`).
- Контент страницы начинается под фиксированной шапкой: `padding-top: calc(var(--top-h) + 2rem)`. Боковые отступы — `.wrap`. Секции — `padding-block: clamp(3rem, 7vw, 7rem)`.
- Анимация появления: класс `.rv` (+ `style="--d:.1s"` для задержки) — элементы плавно всплывают при прокрутке; перед завершением вызывайте `enhance(el)` из `core/motion.js` (он подхватывает `.rv`, `[data-count]`, `[data-lit]`, `[data-magnetic]`, `[data-split]`) и возвращённую функцию вызывайте в `destroy`.
- Карточки: `app/js/ui/cards.js` (`topicCard(tp)`, `labCard(lab,i)`), иконки тем: `data/topics.js` (`TOPICS[n]` {short, tag, c}, `icon(n)`, `LABS`).
- Прогресс пользователя: `core/store.js` (`store.get/set('ключ.путь')`, ключ в localStorage `mx:v1`, безопасен при заблокированном хранилище). Используйте собственное поддерево: `tasks.*`, `tests.*`.
- Данные: `core/data.js` — `index()` → `{topics, lectures, byTopic, byLec, labs, labList}`; `tasks()`, `tests()`, `glossary()`, `docs()`, `lecture(id)`. Схемы JSON смотрите прямо в `app/data/*.json`.
- Интерфейс на русском. Типографика: неразрывные пробелы, «ёлочки», длинное тире; числа через `fmt()` из `core/dom.js`.
- Телефон (390px) и десктоп (1440px), обе темы; никакого горизонтального скролла страницы; фокус-стили уже есть; клавиатура должна работать; `prefers-reduced-motion` уважается классом `.reduce` на `<html>` (анимации при нём отключайте).

## Проверка

```bash
python3 /home/claude/tools/shot.py "http://localhost:8800/index.html#/tasks/3" --y 0,900 --out /tmp/shots/tasks   # затем смотрите PNG инструментом Read
python3 /home/claude/tools/shot.py "…" --w 390 --h 844 --mobile --dpr 2 --theme light --out /tmp/shots/tasks_m
python3 /home/claude/tools/check.py "#/tasks" "#/tasks/3"       # консоль + оверфлоу на 4 конфигурациях
```
Сервер уже запущен (`http://localhost:8800/`). Не запускайте свои. Git не трогайте. Общие файлы (`core/ ui/ css/ views/home.js sim.js router.js index.html`) не редактируйте — свои стили кладите в `app/css/v-<имя>.css`, подключая через `loadCSS`.
