/* Кодек обмена без сервера: ссылка-задание и код сдачи.
   Задание:  #/a/<payload>,  payload = base64url(deflate-raw(JSON)); запасной путь — base64url(JSON) с z:0.
   Сдача:    MX1-<id>-<ИмяФамилия>-<группа>-<тело base64url>-<CRC16 hex>
   Ничего не исполняется и не вставляется как HTML. Любая расшифровка бросает CodecError с понятным текстом и кодом причины:
   'empty' | 'format' | 'crc' | 'data' | 'version'. CRC защищает от опечаток, не от подделки. */

export class CodecError extends Error { constructor(msg, code) { super(msg); this.name = 'CodecError'; this.code = code; } }

/* ── base64url ─────────────────────────────────────────────── */
export function b64uEncode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64uDecode(str) {
  const s = String(str).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw new CodecError('Строка содержит недопустимые символы или обрезана.', 'format');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) по байтам UTF-8 ── */
export function crc16(str) {
  const b = new TextEncoder().encode(str);
  let crc = 0xffff;
  for (let i = 0; i < b.length; i++) {
    crc ^= b[i] << 8;
    for (let k = 0; k < 8; k++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
export const crcHex = (str) => crc16(str).toString(16).toUpperCase().padStart(4, '0');

/* ── deflate-raw ───────────────────────────────────────────── */
const canZ = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
async function pipe(bytes, stream) {
  const w = stream.writable.getWriter();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const r = stream.readable.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(value); n += value.length; if (n > 4e6) throw new Error('too big'); }
  const out = new Uint8Array(n); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}
const deflate = (b) => pipe(b, new CompressionStream('deflate-raw'));
const inflate = (b) => pipe(b, new DecompressionStream('deflate-raw'));

/** объект → строка base64url. Сжатие, если доступно и короче; иначе несжатый JSON с z:0 */
export async function pack(obj) {
  const enc = new TextEncoder();
  const plain = enc.encode(JSON.stringify({ ...obj, z: 0 }));
  if (canZ()) {
    try {
      const z = await deflate(enc.encode(JSON.stringify(obj)));
      if (z.length < plain.length) return b64uEncode(z);
    } catch (e) { /* запасной путь */ }
  }
  return b64uEncode(plain);
}
/** строка base64url → объект (понимает оба пути) */
export async function unpack(str) {
  const bytes = b64uDecode(str);
  if (!bytes.length) throw new CodecError('Пустые данные.', 'empty');
  const dec = new TextDecoder('utf-8', { fatal: true });
  const asJSON = (b) => { try { const o = JSON.parse(dec.decode(b)); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
  if (bytes[0] === 0x7b) { const o = asJSON(bytes); if (o) return o; }       // «{» — несжатый путь (z:0)
  if (!canZ()) throw new CodecError('Этот браузер не умеет распаковывать данные. Откройте ссылку в современном Chrome, Firefox или Safari.', 'data');
  let raw;
  try { raw = await inflate(bytes); } catch (e) { throw new CodecError('Данные повреждены: ссылка или код скопированы не полностью.', 'data'); }
  const o = asJSON(raw);
  if (!o) throw new CodecError('Данные повреждены: содержимое не читается.', 'data');
  return o;
}

/* ── задание ───────────────────────────────────────────────── */
export async function encodeAssign(obj) {
  try {
    if (!obj || typeof obj !== 'object') throw new Error('empty');
    return await pack(obj);
  } catch (e) { throw new CodecError('Не удалось закодировать задание.', 'data'); }
}
export async function decodeAssign(str) {
  try {
    const s = String(str == null ? '' : str).trim().replace(/^.*#\/a\//, '').replace(/[?#].*$/, '');
    if (!s) throw new CodecError('В ссылке нет задания.', 'empty');
    const o = await unpack(decodeURIComponent(s));
    if (!o || o.v !== 1 || !Array.isArray(o.items) || typeof o.id !== 'string') throw new CodecError('Это не задание «Макро» или оно от другой версии приложения.', 'version');
    if (o.items.length > 40) throw new CodecError('Задание слишком большое.', 'data');
    return o;
  } catch (e) {
    if (e instanceof CodecError) throw e;
    throw new CodecError('Ссылка повреждена или обрезана. Попросите преподавателя отправить её ещё раз целиком.', 'format');
  }
}

/* ── код сдачи ─────────────────────────────────────────────── */
const clean = (s, max) => String(s == null ? '' : s).replace(/[\s.\-–—‐‑]+/g, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, max) || 'x';
export const codeTag = { name: (s) => clean(s, 24), group: (s) => clean(s, 12) };

/** тело: { id, n:'Иванов Алексей', g:'ЭК-21', … }. Возвращает строку-код */
export async function encodeSubmission(obj) {
  try {
    if (!obj || typeof obj.id !== 'string' || !/^[A-Za-z0-9_]{1,12}$/.test(obj.id)) throw new Error('id');
    const body = await pack({ v: 1, ...obj });
    const head = ['MX1', obj.id, clean(obj.n, 24), clean(obj.g, 12), body].join('-');
    return head + '-' + crcHex(head);
  } catch (e) { throw new CodecError('Не удалось собрать код сдачи.', 'data'); }
}
/** строка-код → объект. Пробелы и переводы строк внутри игнорируются (код можно копировать «столбиком») */
export async function decodeSubmission(str) {
  try {
    const s = String(str == null ? '' : str).replace(/\s+/g, '');
    if (!s) throw new CodecError('Пустая строка.', 'empty');
    if (!/^MX1-/.test(s)) throw new CodecError('Код должен начинаться с «MX1-».', 'format');
    const parts = s.split('-');
    if (parts.length < 6) throw new CodecError('Код неполный: не хватает частей.', 'format');
    const crc = parts[parts.length - 1], head = s.slice(0, s.length - crc.length - 1);
    if (!/^[0-9A-Fa-f]{4}$/.test(crc) || crcHex(head) !== crc.toUpperCase()) throw new CodecError('Код не принят: контрольная сумма не совпала (опечатка или код обрезан).', 'crc');
    const body = parts.slice(4, -1).join('-');
    const o = await unpack(body);
    if (o.v !== 1 || typeof o.id !== 'string' || !Array.isArray(o.i)) throw new CodecError('Код от другой версии приложения.', 'version');
    o.hid = parts[1]; o.hn = parts[2]; o.hg = parts[3];
    return o;
  } catch (e) {
    if (e instanceof CodecError) throw e;
    throw new CodecError('Код не читается.', 'data');
  }
}
/** текст по строкам фиксированной ширины (читается с экрана) */
export const wrapText = (s, w = 40) => (String(s).match(new RegExp('.{1,' + w + '}', 'g')) || []).join('\n');
