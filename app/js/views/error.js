import { h } from '../core/dom.js';

export function mount(el, ctx, err) {
  const missing = err && /Failed to fetch dynamically|Importing a module script failed|error loading dynamically/i.test(String(err && err.message));
  el.append(h('section.wrap.err',
    h('p.eyebrow', 'Ошибка · ' + (ctx.path || '')),
    h('h1.display.err__t', '404'),
    h('p.lede', missing ? 'Этот раздел ещё строится или не загрузился. Проверьте соединение и попробуйте снова.' : 'Такой страницы нет — возможно, ссылка устарела.'),
    h('div.err__row', h('a.btn.btn--primary', { href: '#/' }, 'На главную'), h('a.btn', { href: '#/theory' }, 'К теории'))));
  return { title: 'Страница не найдена' };
}
