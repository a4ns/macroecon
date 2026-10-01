# «Макро» — современная версия учебника (ветка `modern`)

Классическая эмуляция лежит в `classic/` (ветка `main` не трогается; `/classic/` на Vercel).
Современная версия — корень репозитория: статический SPA без сборки (vanilla ES-modules).

## Структура
- `index.html` — оболочка (шапка, меню, `<main id=main>`, подвал, оверлеи)
- `app/css/` — `tokens.css` (темы Night Atlas / Paper), `base.css`, `ui.css` (контролы, графики, палитра), `views.css`
- `app/js/core/` — `dom.js` (h(), утилиты), `router.js` (hash-роутер, View Transitions), `motion.js` (scroll/reveal/split/counters), `theme.js`, `store.js` (прогресс в localStorage `mx:v1`), `data.js`
- `app/js/gl/` — `hero.js` (WebGL2-частицы, 7 сцен), `shapes.js`
- `app/js/ui/` — `plot.js` (SVG-графики), `controls.js` (слайдеры и др.), `cards.js`, `chrome.js`, `palette.js` (⌘K)
- `app/js/views/` — home, theory, topic, reader, lab, sim, tasks, tests, quiz, glossary, more, doc, error
- `app/js/sims/<id>.js` — 15 симуляторов (контракт: `docs/SIM_API.md`)
- `app/data/` — JSON/HTML, генерируется `python3 tools/content.py` из `classic/project.js` и `classic/Docs`
- `tools/fonts.py` — сабсет шрифтов → `app/fonts/*.woff2`
- `sw.js` — service worker (network-first), `manifest.webmanifest`

## Запуск локально
`python3 -m http.server 8800` в корне → http://localhost:8800/ . Скриншоты: `/home/claude/tools/shot.py`.

## Состояние (обновляется)
См. git log. Сделано: оболочка, главная (герой на WebGL + секции), библиотека контролов/графиков.

## Статус (1 октября)
Готово: оболочка и дизайн-система, WebGL-герой (7 сцен), главная, теория/тема/читалка (глоссарные подсказки, MathML), 15 симуляторов, задачи, тесты, глоссарий, лаборатория, «Ещё». Все маршруты проходят tools/check.py (консоль, переполнение 1440/390, обе темы).
Идеи на потом: полировка футера и вступления героя, правка v11 в tasks.json (1850→2100), PWA-офлайн проверка.
