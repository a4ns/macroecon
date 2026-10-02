/* shared card components: topic cards, lab cards */
import { h, plural, rng } from '../core/dom.js';
import { TOPICS, LABS, icon, rub } from '../data/topics.js';
import { store } from '../core/store.js';

export const col = (c) => `var(--${c})`;

export function topicStats(tp) {
  const mins = tp.lectures.reduce((a, l) => a + (l.min || 0), 0);
  const read = tp.lectures.filter((l) => store.isRead(l.id)).length;
  return { mins, read, n: tp.lectures.length, labs: (tp.lab || []).length };
}

export function topicCard(tp) {
  const m = TOPICS[tp.n], s = topicStats(tp);
  return h('a.card.tcard', { href: '#/course/' + tp.n, style: { '--c': col(m.c) }, 'aria-label': 'Тема ' + tp.n + '. ' + tp.title },
    h('span.tcard__n', rub(tp.n)),
    h('span.tcard__ic', { html: icon(tp.n) }),
    h('div.tcard__body',
      h('h3.tcard__t', m.short),
      h('p.tcard__p', m.tag)),
    h('div.tcard__m',
      h('span', s.n + ' ' + plural(s.n, ['лекция', 'лекции', 'лекций'])),
      h('span', s.mins + ' мин'),
      s.labs ? h('span', s.labs + ' ' + plural(s.labs, ['модель', 'модели', 'моделей'])) : null),
    h('div.tcard__dots', { 'aria-hidden': 'true' }, ...tp.lectures.map((l) => h('i', { class: store.isRead(l.id) ? 'is-on' : '' }))));
}

/* a tiny generative chart used as the "thumbnail" of a model */
export function labArt(id, seed = 1) {
  const r = rng([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), seed) >>> 0);
  const W = 240, H = 130, L = 14, B = 112, T = 14, R = 226;
  const curve = (down) => {
    const y0 = down ? T + 6 + r() * 14 : B - 6 - r() * 14, y1 = down ? B - 10 - r() * 26 : T + 10 + r() * 26;
    const c1 = L + (R - L) * (.25 + r() * .2), c2 = L + (R - L) * (.55 + r() * .2);
    const k1 = y0 + (y1 - y0) * (r() * .5 - .05), k2 = y0 + (y1 - y0) * (.55 + r() * .5);
    return `M${L + 4},${y0.toFixed(1)} C${c1.toFixed(1)},${k1.toFixed(1)} ${c2.toFixed(1)},${k2.toFixed(1)} ${R - 4},${y1.toFixed(1)}`;
  };
  const a = curve(true), b = curve(false), b2 = curve(false);
  const px = L + (R - L) * (.42 + r() * .2), py = T + (B - T) * (.35 + r() * .3);
  return `<svg viewBox="0 0 ${W} ${H}" class="lart" fill="none" aria-hidden="true">
    <g class="lart__grid" stroke="currentColor" stroke-width="1" opacity=".16">${[0, 1, 2, 3, 4].map((i) => `<path d="M${L},${T + i * (B - T) / 4}H${R}"/>`).join('')}${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${L + i * (R - L) / 5},${T}V${B}"/>`).join('')}</g>
    <path d="M${L},${T - 4}V${B}H${R + 4}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
    <path class="lart__c lart__c1" d="${a}" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
    <path class="lart__c lart__c2" d="${b}" stroke="var(--c2, var(--ink-2))" stroke-width="3" stroke-linecap="round"/>
    <path class="lart__c lart__c3" d="${b2}" stroke="var(--c2, var(--ink-2))" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round" opacity=".6"/>
    <circle class="lart__p" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="var(--c)"/>
    <circle class="lart__p2" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" stroke="var(--c)" stroke-width="1.5"/>
  </svg>`;
}

export function labCard(lab, i = 0) {
  const m = TOPICS[lab.topic] || TOPICS[1], L = LABS[lab.id] || { short: lab.title, tag: '' };
  const c2 = ['d2', 'd5', 'd4', 'd1', 'd6', 'd3'][(i + 2) % 6];
  return h('a.card.lcard', { href: '#/lab/' + lab.id, style: { '--c': col(m.c), '--c2': col(c2) }, 'aria-label': 'Модель: ' + L.short },
    h('div.lcard__art', { html: labArt(lab.id) }),
    h('div.lcard__body',
      h('span.lcard__k', 'Тема ' + lab.topic + ' · модель ' + rub(i + 1)),
      h('h3.lcard__t', L.short),
      h('p.lcard__p', L.tag)),
    h('span.lcard__go', 'Открыть', h('svg', { viewBox: '0 0 24 24', html: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' })));
}
