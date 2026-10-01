/* tiny Russian typography helpers shared by the glossary / lab / more views */
const SHORT = 'в|во|на|и|а|но|с|со|к|ко|о|об|у|по|до|из|за|от|не|ни|же|бы|для|при|над|под|без|про|или|что|как|то|их|её|его|ли|я';
const RE = new RegExp('(^|[\\s(«„"])(' + SHORT + ')\\s+', 'gi');

const NB = String.fromCharCode(160);
const LB = '(?<![А-Яа-яЁёA-Za-z])';
const R_INI2 = new RegExp(LB + '([А-ЯЁ])\\.\\s+([А-ЯЁ])\\.', 'g');
const R_INI1 = new RegExp(LB + '([А-ЯЁ]\\.(?:' + NB + '?[А-ЯЁ]\\.)?)\\s+(?=[А-ЯЁ][а-яё])', 'g');
const R_ABBR = new RegExp('(?<![А-Яа-яЁё])(им|гг?|тыс|млн|млрд|руб|см|рис|табл|т\\.е|напр)\\.\\s+', 'g');

/** plain text → non-breaking spaces after short words, before dashes and units */
export function nb(s) {
  return String(s == null ? '' : s)
    .replace(/\s+([—–])\s/g, NB + '$1 ')
    .replace(RE, '$1$2' + NB).replace(RE, '$1$2' + NB)
    .replace(/(\d)\s+(%|г\.|гг\.|с\.|мин|шт\.)/g, '$1' + NB + '$2')
    .replace(R_INI2, '$1.' + NB + '$2.')
    .replace(R_INI1, '$1' + NB)
    .replace(R_ABBR, '$1.' + NB);
}

/** apply nb() to the text nodes of an element (leaves markup alone) */
export function nbTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const ns = []; while (w.nextNode()) ns.push(w.currentNode);
  ns.forEach((n) => { if (n.parentNode && /^(SCRIPT|STYLE|CODE|PRE)$/.test(n.parentNode.nodeName)) return; n.nodeValue = nb(n.nodeValue); });
  return root;
}

export const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>';
export const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
