/* Оглавление курса — #/theory */
import { h, loadCSS, plural } from '../core/dom.js';
import { index } from '../core/data.js';
import { store } from '../core/store.js';
import { enhance } from '../core/motion.js';
import { topicCard } from '../ui/cards.js';

export async function load() { const [ix] = await Promise.all([index(), loadCSS('app/css/v-reader.css')]); return { ix }; }
export function mount(el, ctx, { ix }) {
  const total = ix.lectures.length, read = ix.lectures.filter((l) => store.isRead(l.id)).length;
  const mins = ix.lectures.reduce((a, l) => a + l.min, 0);
  const next = ix.lectures.find((l) => !store.isRead(l.id));
  const secs = [{ topics: ix.topics.map((t) => t.n) }];
  el.append(h('div.th.wrap',
    h('header.th__head',
      h('p.eyebrow.eyebrow--dot', 'Теория'),
      h('h1.display', { html: 'Курс <em>целиком</em>' }),
      h('p.lede', total + ' ' + plural(total, ['лекция', 'лекции', 'лекций']) + ' в ' + ix.topics.length + ' темах — примерно ' + Math.round(mins / 6) / 10 + ' ч чтения. Прочитано: ' + read + '.'),
      h('div.tp__cta', next ? h('a.btn.btn--primary', { href: '#/read/' + next.id }, read ? 'Продолжить с ' + next.id : 'Начать с 1.1') : null)),
    ...secs.map((s) => h('section.th__sec', s.title ? h('h2.eyebrow', s.title) : null,
      h('div.th__grid', ...(s.topics || []).map((n) => ix.byTopic.get(n)).filter(Boolean).map(topicCard))))));
  const c = enhance(el);
  return { title: 'Теория', destroy() { c && c(); } };
}
