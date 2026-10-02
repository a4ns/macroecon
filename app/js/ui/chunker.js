/* Нарезка текста лекции на «шаги» для режима презентации и плана пары.
   Чистая строковая функция (без DOM): работает и в браузере, и в Node.
   chunkLecture(html) → [{ kind:'p'|'def'|'fig'|'eq'|'list', html, words, firstWords, text, cont? }]
   Содержание не меняется: куски — это подстроки исходных блоков, теги всегда сбалансированы. */

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'wbr', 'col']);
export const LONG = 60;   // абзац длиннее — режем
export const MAXW = 45;   // цель для куска
const SHY = '­';

/* ── токенизатор: теги и текст ─────────────────────────────── */
function tokenize(html) {
  const out = []; const re = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>|<!--[\s\S]*?-->/g;
  let last = 0, m;
  while ((m = re.exec(html))) {
    if (m.index > last) out.push({ t: 'x', s: html.slice(last, m.index) });
    if (m[2] === undefined) out.push({ t: 'c', s: m[0] });
    else {
      const name = m[2].toLowerCase(), closing = !!m[1], selfc = !!m[4] || VOID.has(name);
      out.push({ t: closing ? 'e' : selfc ? 'v' : 's', name, s: m[0] });
    }
    last = re.lastIndex;
  }
  if (last < html.length) out.push({ t: 'x', s: html.slice(last) });
  return out;
}

/** разбить фрагмент на элементы верхнего уровня: [{ html, name, attrs, text }] */
function topBlocks(html) {
  const toks = tokenize(html), blocks = [];
  let depth = 0, buf = '', name = '', open = '';
  const flushText = (s) => { if (s.trim()) blocks.push({ html: s.trim(), name: '#text', open: '' }); };
  for (const k of toks) {
    if (depth === 0) {
      if (k.t === 'x') { flushText(k.s); continue; }
      if (k.t === 'c') continue;
      if (k.t === 'v') { blocks.push({ html: k.s, name: k.name, open: k.s }); continue; }
      if (k.t === 's') { depth = 1; buf = k.s; name = k.name; open = k.s; continue; }
      continue; // лишний закрывающий тег
    }
    buf += k.s;
    if (k.t === 's') depth++;
    else if (k.t === 'e') { depth--; if (depth === 0) { blocks.push({ html: buf, name, open }); buf = ''; } }
  }
  if (depth > 0 && buf.trim()) blocks.push({ html: buf, name, open }); // незакрытый блок — отдаём как есть
  return blocks;
}

export const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export const wordsOf = (html) => { const t = textOf(html).trim(); return t ? t.split(/\s+/).length : 0; };
const firstWords = (html, n = 6) => textOf(html).trim().split(/\s+/).slice(0, n).join(' ');

/* ── резка абзаца по границам предложений ──────────────────── */
// последнее «слово» перед точкой — сокращение или инициал → не граница
const ABBR = /(?:^|[\s(«"„ >])(?:[А-ЯЁA-Z]|т\.\s?[едпкн]|т\.\s?е|гг?|рис|стр|напр|табл|им|см|руб|тыс|млн|млрд|др|пр|проц|ст|пп?|гл|ч|англ|лат|нем|франц|итал|греч|от|до|тж|вкл|ок|св|ср|прим|доп|см|ул|обл|пос|корп|напр|англ|прав)\.$/i;
const BOUND_BR = /(?:[ \t\r\n\u00A0]*<br\s*\/?>)+[ \t\r\n\u00A0]*/gi;                      // строка внутри абзаца (маркированный перечень)
const BOUND_SC = /(?<=;(?:<\/[a-zA-Z]+>)*)[ \t\r\n\u00A0]+(?=\S)/g;                          // запасной вариант: «;» между пунктами
const BOUND = /(?<=[.!?…](?:<\/[a-zA-Z]+>)*["»”)]*)[ \t\r\n ]+(?=(?:<[a-zA-Z][^>]*>)*[А-ЯЁA-Z«„"])/g;

/** позиции допустимых разрезов (индексы начала пробельного разделителя) внутри строки inner */
function cutPoints(inner, re = BOUND, check = true) {
  const toks = tokenize(inner);
  // глубина вложенности по позициям
  const depthAt = []; let pos = 0, depth = 0;
  for (const k of toks) {
    if (k.t === 's') depth++;
    const start = pos; pos += k.s.length;
    depthAt.push([start, pos, depth, k]);
    if (k.t === 'e') depth--;
  }
  const depthOf = (p) => { for (const [a, b, d, k] of depthAt) if (p >= a && p < b) return k.t === 's' ? d - 1 : d; return depth; };
  const cuts = []; let m; re.lastIndex = 0;
  while ((m = re.exec(inner))) {
    const p = m.index;
    if (depthOf(p) !== 0) continue;                       // внутри i/b/sub/sup/math…
    const before = textOf(inner.slice(0, p)).replace(/\s+$/, '');
    if (check && ABBR.test(before)) continue;                      // «Р.», «т.е.», «гг.», «рис.»…
    // парные скобки и кавычки не рвём
    const par = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
    const gui = (before.match(/«/g) || []).length - (before.match(/»/g) || []).length;
    if (par > 0 || gui > 0) continue;
    cuts.push([p, p + m[0].length]);
  }
  return cuts;
}

/** набрать куски ≤ MAXW слов: минимум кусков, затем минимум суммы квадратов (ровные куски) */
function pack(sentences) {
  const n = sentences.length, w = sentences.map(wordsOf);
  const best = Array(n + 1).fill(null); best[n] = { c: 0, q: 0, nx: n };
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i; j < n; j++) {
      sum += w[j];
      if (sum > MAXW && j > i) break;
      const nb = best[j + 1]; if (!nb) continue;
      const over = sum > MAXW ? 1e6 : 0;
      const cand = { c: nb.c + 1 + (over ? 1e3 : 0), q: nb.q + sum * sum + over, nx: j + 1 };
      if (!best[i] || cand.c < best[i].c || (cand.c === best[i].c && cand.q < best[i].q)) best[i] = cand;
    }
  }
  const out = []; let i = 0;
  while (i < n) { const nx = best[i].nx; out.push(sentences.slice(i, nx).join(' ')); i = nx; }
  return out;
}

const trimBr = (s) => s.replace(/^(?:\s|<br\s*\/?>)+/i, '').replace(/(?:\s|<br\s*\/?>)+$/i, '');

const pieces = (inner, cuts) => { const out = []; let from = 0; for (const [a, b] of cuts) { out.push(inner.slice(from, a)); from = b; } out.push(inner.slice(from)); return out; };

/** разрезать «внутренность» абзаца на куски (строки HTML) */
export function splitInner(inner) {
  if (wordsOf(inner) <= LONG) return [inner];
  const merge = (a, b) => { const r = []; for (const c of a.concat(b).sort((x, y) => x[0] - y[0])) if (!r.length || c[0] >= r[r.length - 1][1]) r.push(c); return r; };
  let units = pieces(inner, merge(cutPoints(inner), cutPoints(inner, BOUND_BR, false)));
  // слишком длинное предложение — пробуем резать по «;»
  units = units.flatMap((u) => wordsOf(u) > LONG ? pieces(u, cutPoints(u, BOUND_SC, false)) : [u]);
  units = units.map(trimBr).filter((u) => u.length);
  if (units.length < 2) return [inner];
  const parts = pack(units).map(trimBr);
  return parts.length ? parts : [inner];
}

/* ── классификация и сборка шагов ──────────────────────────── */
function classOf(open) { const m = /class\s*=\s*"([^"]*)"/.exec(open || ''); return m ? m[1].split(/\s+/) : []; }

function addClass(open, c) { return /class\s*=/.test(open) ? open.replace(/class\s*=\s*"([^"]*)"/, (m, k) => 'class="' + k + ' ' + c + '"') : open.replace(/^<(\w+)/, '<$1 class="' + c + '"'); }

function step(kind, html, extra) {
  const text = textOf(html).replace(/\s+/g, ' ').trim();
  return Object.assign({ kind, html, words: text ? text.split(' ').length : 0, firstWords: text.split(' ').slice(0, 6).join(' '), text }, extra);
}

/** Длинная формула с несколькими знаками «=» на верхнем уровне: переносим строку перед каждым «=», кроме первого
 *  (каждая строка — свой <math>, содержимое то же). Так формула не мельчает до нечитаемого размера. */
const EQ_LONG = 45;
function splitEq(html) {
  if (textOf(html).replace(/\s+/g, '').length < EQ_LONG) return html;
  const m = /^([\s\S]*?)(<math[^>]*>)<mrow>([\s\S]*)<\/mrow><\/math>([\s\S]*)$/.exec(html);
  if (!m || /<math/.test(m[3])) return html;
  const inner = m[3], toks = tokenize(inner), cuts = [];
  let depth = 0, pos = 0;
  for (let i = 0; i < toks.length; i++) {
    const k = toks[i];
    if (depth === 0 && k.t === 's' && k.name === 'mo' && toks[i + 1] && toks[i + 1].t === 'x' && toks[i + 1].s.trim() === '=' && toks[i + 2] && toks[i + 2].t === 'e') cuts.push(pos);
    if (k.t === 's') depth++; else if (k.t === 'e') depth--;
    pos += k.s.length;
  }
  if (cuts.length < 2) return html;
  const parts = []; let from = 0;
  for (const c of cuts.slice(1)) { parts.push(inner.slice(from, c)); from = c; }
  parts.push(inner.slice(from));
  return m[1] + parts.map((pt) => m[2] + '<mrow>' + pt + '</mrow></math>').join('') + m[4];
}

/** @param {string} html — содержимое app/data/lec/<id>.html
 *  @returns {Array<{kind:'p'|'def'|'fig'|'eq'|'list', html:string, words:number, firstWords:string, text:string, cont?:boolean}>} */
export function chunkLecture(html) {
  html = String(html == null ? '' : html).replace(/¬/g, SHY);
  const steps = [];
  for (const b of topBlocks(html)) {
    const cl = classOf(b.open), name = b.name;
    if (name === 'figure' || name === 'img') { steps.push(step('fig', b.html)); continue; }
    if (name === 'math' || cl.includes('eq')) {
      steps.push(step('eq', splitEq(name === 'math' ? '<div class="eq">' + b.html + '</div>' : b.html))); continue;
    }
    if (name === 'p' || name === '#text' || name === 'div' || name === 'ul' || name === 'ol') {
      let kind = 'p', openTag = '<p>', inner, wrapOpen = '', wrapClose = '';
      if (name === 'p') {
        openTag = b.open; inner = b.html.slice(b.open.length, b.html.length - 4);
        if (cl.includes('def')) kind = 'def';
        else if (cl.includes('bl') || cl.includes('li')) {
          kind = 'list';
          const m = /^((?:<span class="n">[\s\S]*?<\/span>)?)<span class="t">([\s\S]*)<\/span>$/.exec(inner);
          if (m) { wrapOpen = m[1] + '<span class="t">'; wrapClose = '</span>'; inner = m[2]; }
        }
      } else if (name === '#text') inner = b.html;
      else { steps.push(step('p', b.html)); continue; }   // нестандартный блок — целиком
      const parts = splitInner(inner);
      parts.forEach((pt, i) => {
        const open = i === 0 ? openTag : addClass(openTag, 'cont');
        const lead = i === 0 ? wrapOpen : wrapOpen.replace(/^<span class="n">[\s\S]*?<\/span>/, '');
        steps.push(step(kind, open + lead + pt + wrapClose + '</p>', parts.length > 1 ? { cont: i > 0 } : null));
      });
      continue;
    }
    steps.push(step('p', b.html));
  }
  return steps;
}

/** проверка целостности: теги сбалансированы */
export function balanced(html) {
  const st = [];
  for (const k of tokenize(html)) {
    if (k.t === 's') st.push(k.name);
    else if (k.t === 'e') { if (st.pop() !== k.name) return false; }
  }
  return st.length === 0;
}
