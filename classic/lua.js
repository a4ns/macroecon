/* Lua 5.1 -> JS compiler/runtime (core). nil = undefined (null treated as nil too).
   Functions are plain JS functions taking positional args. Return convention:
   undefined = no values; JS Array = multiple values; anything else = exactly one value. */
(function (root) {
'use strict';
class LuaError extends Error {
  constructor(value, traceback) { super(typeof value === 'string' ? value : 'lua error'); this.value = value; this.lua = true; }
}
class Multi { constructor(v) { this.values = v; } }

// ---------------------------------------------------------------- tables
class LuaTable {
  constructor() { this.arr = []; this.hash = null; this.meta = undefined; this._keys = null; }
  get(k) {
    if (typeof k === 'number') {
      const a = this.arr;
      if (k > 0 && k <= a.length && (k | 0) === k) return a[k - 1];
    }
    return this.hash === null ? undefined : this.hash.get(k);
  }
  getStr(k) { return this.hash === null ? undefined : this.hash.get(k); }
  set(k, v) {
    if (v === null) v = undefined;
    if (typeof k === 'number') {
      if ((k | 0) === k && k > 0) {
        const a = this.arr, n = a.length;
        if (k <= n) {
          a[k - 1] = v;
          if (v === undefined && k === n) { let m = n - 1; while (m > 0 && a[m - 1] === undefined) m--; a.length = m; }
          return;
        }
        if (k === n + 1) {
          if (v === undefined) { if (this.hash) this.hash.delete(k); return; }
          a.push(v);
          const h = this.hash;
          if (h !== null && h.size) { // migrate following keys
            if (h.has(k)) h.delete(k);
            let nk = k + 1, x;
            while ((x = h.get(nk)) !== undefined) { a.push(x); h.delete(nk); nk++; }
          }
          return;
        }
      } else if (k !== k) throw new LuaError('table index is NaN');
    } else if (k === undefined || k === null) throw new LuaError('table index is nil');
    if (v === undefined) { if (this.hash !== null) this.hash.delete(k); return; }
    if (this.hash === null) this.hash = new Map();
    if (this._keys !== null && !this.hash.has(k)) this._keys = null;
    this.hash.set(k, v);
  }
  length() { return this.arr.length; }
  keys() { // array of keys (array part then hash)
    const r = [];
    for (let i = 0; i < this.arr.length; i++) if (this.arr[i] !== undefined) r.push(i + 1);
    if (this.hash) for (const k of this.hash.keys()) r.push(k);
    return r;
  }
  next(k) {
    if (k === undefined || k === null) { this._keys = this.keys(); this._pos = null; }
    else if (this._keys === null) this._keys = this.keys();
    const ks = this._keys;
    let i;
    if (k === undefined || k === null) i = 0;
    else {
      if (this._pos && ks[this._pos.i] === k) i = this._pos.i + 1;
      else { i = ks.indexOf(k); if (i < 0) throw new LuaError("invalid key to 'next'"); i++; }
    }
    for (; i < ks.length; i++) {
      const v = this.get(ks[i]);
      if (v !== undefined) { this._pos = { i }; return [ks[i], v]; }
    }
    return undefined;
  }
}

// ---------------------------------------------------------------- number formatting
function fmtG(n, prec, alt, upper) {
  if (n !== n) return upper ? 'NAN' : 'nan';
  if (n === Infinity) return upper ? 'INF' : 'inf';
  if (n === -Infinity) return upper ? '-INF' : '-inf';
  if (prec === 0) prec = 1;
  if (n === 0) { let s = (1 / n < 0) ? '-0' : '0'; if (alt && prec > 1) s += '.' + '0'.repeat(prec - 1); return s; }
  const e = n.toExponential(prec - 1); // d.ddde+X
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(e);
  const exp = parseInt(m[4], 10);
  let s;
  if (exp < -4 || exp >= prec) {
    let digits = m[2] + (m[3] || '');
    let mant = digits[0] + (digits.length > 1 ? '.' + digits.slice(1) : '');
    if (!alt && mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
    const ea = Math.abs(exp);
    s = m[1] + mant + (upper ? 'E' : 'e') + (exp < 0 ? '-' : '+') + (ea < 10 ? '0' + ea : ea);
  } else {
    s = n.toFixed(Math.max(0, prec - 1 - exp));
    if (!alt && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}
function num2str(n) {
  if (n === (n | 0)) return (n === 0 && 1 / n < 0) ? '-0' : String(n);
  return fmtG(n, 14);
}
function str2num(s) {
  s = s.trim();
  if (s === '') return undefined;
  if (/^[+-]?0[xX][0-9a-fA-F]+$/.test(s)) { const neg = s[0] === '-'; const v = parseInt(s.replace(/^[+-]/, ''), 16); return neg ? -v : v; }
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
  const l = s.toLowerCase();
  if (l === 'inf' || l === '+inf' || l === 'infinity') return Infinity;
  return undefined;
}
function tonum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return str2num(v);
  return undefined;
}
function tostr(v) {
  switch (typeof v) {
    case 'string': return v;
    case 'number': return num2str(v);
    case 'undefined': return 'nil';
    case 'boolean': return v ? 'true' : 'false';
    default:
      if (v === null) return 'nil';
      if (v instanceof LuaTable) {
        const mt = v.meta; if (mt) { const f = mt.getStr('__tostring'); if (f !== undefined) return tostr($1(f(v))); }
        return 'table: 0x' + idOf(v);
      }
      if (typeof v === 'function') return (v.isBuiltin ? 'function: builtin: ' : 'function: 0x') + idOf(v);
      return String(v);
  }
}
let idCounter = 0x1000; const ids = new WeakMap();
function idOf(o) { let i = ids.get(o); if (!i) { i = (idCounter += 24); ids.set(o, i); } return ('00000000' + i.toString(16)).slice(-8); }
function type(v) {
  switch (typeof v) {
    case 'undefined': return 'nil';
    case 'boolean': return 'boolean';
    case 'number': return 'number';
    case 'string': return 'string';
    case 'function': return 'function';
    default: return v === null ? 'nil' : (v instanceof LuaTable ? 'table' : 'userdata');
  }
}

// ---------------------------------------------------------------- runtime state / helpers
const S = { ln: 0, chunk: '?', stringMeta: null };
function rterr(msg) { return new LuaError(S.chunk + ':' + S.ln + ': ' + msg); }
function $1(r) { return Array.isArray(r) ? r[0] : r; }
function $m(r) { return Array.isArray(r) ? r : (r === undefined ? [] : [r]); }
function truthy(v) { return v != null && v !== false; }

function getmeta(v) {
  if (v instanceof LuaTable) return v.meta;
  if (typeof v === 'string') return S.stringMeta;
  return undefined;
}
function index(o, k, desc) {
  if (o instanceof LuaTable) {
    const v = o.get(k);
    if (v !== undefined || o.meta === undefined) return v;
    const h = o.meta.getStr('__index');
    if (h === undefined) return undefined;
    if (typeof h === 'function') return $1(h(o, k));
    return index(h, k);
  }
  if (typeof o === 'string') { const h = S.stringMeta && S.stringMeta.getStr('__index'); return h instanceof LuaTable ? h.get(k) : undefined; }
  throw rterr('attempt to index ' + (desc ? desc + ' (a ' + type(o) + ' value)' : 'a ' + type(o) + ' value'));
}
function setindex(o, k, v, desc) {
  if (o instanceof LuaTable) {
    if (o.meta === undefined) { o.set(k, v); return; }
    if (o.get(k) !== undefined) { o.set(k, v); return; }
    const h = o.meta.getStr('__newindex');
    if (h === undefined) { o.set(k, v); return; }
    if (typeof h === 'function') { h(o, k, v); return; }
    setindex(h, k, v); return;
  }
  throw rterr('attempt to index ' + (desc ? desc + ' (a ' + type(o) + ' value)' : 'a ' + type(o) + ' value'));
}
function callable(f, desc) {
  if (typeof f === 'function') return f;
  const mt = getmeta(f);
  const h = mt && mt.getStr('__call');
  if (typeof h === 'function') return (...a) => h(f, ...a);
  throw rterr('attempt to call ' + (desc ? desc + ' (a ' + type(f) + ' value)' : 'a ' + type(f) + ' value'));
}
function arithNum(v, other, op) {
  const n = tonum(v);
  if (n === undefined) {
    const bad = (typeof v === 'number' || (typeof v === 'string' && tonum(v) !== undefined)) ? other : v;
    throw rterr('attempt to perform arithmetic on a ' + type(bad) + ' value');
  }
  return n;
}
const MM = { add: '__add', sub: '__sub', mul: '__mul', div: '__div', mod: '__mod', pow: '__pow' };
function arith(op, a, b) {
  let x = tonum(a), y = tonum(b);
  if (x === undefined || y === undefined) {
    let h = getmeta(a); h = h && h.getStr(MM[op]);
    if (h === undefined) { h = getmeta(b); h = h && h.getStr(MM[op]); }
    if (h !== undefined) return $1(h(a, b));
    x = arithNum(a, b, op); y = arithNum(b, a, op);
  }
  switch (op) {
    case 'add': return x + y; case 'sub': return x - y; case 'mul': return x * y; case 'div': return x / y;
    case 'mod': return y === 0 ? NaN : (y === Infinity ? (x >= 0 ? x : (x === -Infinity ? NaN : y)) : x - Math.floor(x / y) * y);
    case 'pow': return Math.pow(x, y);
  }
}
const add = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a + b : arith('add', a, b);
const sub = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : arith('sub', a, b);
const mul = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a * b : arith('mul', a, b);
const div = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a / b : arith('div', a, b);
const mod = (a, b) => (typeof a === 'number' && typeof b === 'number') ? (b === 0 ? NaN : a - Math.floor(a / b) * b) : arith('mod', a, b);
const pow = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.pow(a, b) : arith('pow', a, b);
function unm(a) {
  if (typeof a === 'number') return -a;
  const n = tonum(a);
  if (n !== undefined) return -n;
  const h = getmeta(a); const f = h && h.getStr('__unm');
  if (f) return $1(f(a, a));
  throw rterr('attempt to perform arithmetic on a ' + type(a) + ' value');
}
function concat(a, b) {
  const ta = typeof a, tb = typeof b;
  if ((ta === 'string' || ta === 'number') && (tb === 'string' || tb === 'number')) return (ta === 'string' ? a : num2str(a)) + (tb === 'string' ? b : num2str(b));
  let h = getmeta(a); h = h && h.getStr('__concat');
  if (h === undefined) { h = getmeta(b); h = h && h.getStr('__concat'); }
  if (h !== undefined) return $1(h(a, b));
  const bad = (ta === 'string' || ta === 'number') ? b : a;
  throw rterr('attempt to concatenate a ' + type(bad) + ' value');
}
function len(a) {
  if (typeof a === 'string') return a.length;
  if (a instanceof LuaTable) return a.length();
  throw rterr('attempt to get length of a ' + type(a) + ' value');
}
function eq(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a instanceof LuaTable && b instanceof LuaTable) {
    let h = a.meta && a.meta.getStr('__eq');
    if (h === undefined || h === null) h = b.meta && b.meta.getStr('__eq');
    if (h) return truthy($1(h(a, b)));
  }
  return false;
}
function cmpErr(a, b) {
  const t1 = type(a), t2 = type(b);
  return rterr(t1 === t2 ? 'attempt to compare two ' + t1 + ' values' : 'attempt to compare ' + t1 + ' with ' + t2);
}
function lt(a, b) {
  const ta = typeof a;
  if (ta === typeof b && (ta === 'number' || ta === 'string')) return a < b;
  let h = getmeta(a); h = h && h.getStr('__lt');
  if (h === undefined) { h = getmeta(b); h = h && h.getStr('__lt'); }
  if (h) return truthy($1(h(a, b)));
  throw cmpErr(a, b);
}
function le(a, b) {
  const ta = typeof a;
  if (ta === typeof b && (ta === 'number' || ta === 'string')) return a <= b;
  let h = getmeta(a); h = h && h.getStr('__le');
  if (h === undefined) { h = getmeta(b); h = h && h.getStr('__le'); }
  if (h) return truthy($1(h(a, b)));
  h = getmeta(a); h = h && h.getStr('__lt');
  if (h === undefined) { h = getmeta(b); h = h && h.getStr('__lt'); }
  if (h) return !truthy($1(h(b, a)));
  throw cmpErr(a, b);
}
function mkTable(arr, kv) {
  const t = new LuaTable();
  if (arr) {
    let n = arr.length;
    while (n > 0 && arr[n - 1] === undefined) n--;
    if (n === arr.length) t.arr = arr; else t.arr = arr.slice(0, n);
    // holes inside arr are permitted (nil entries)
    for (let i = 0; i < arr.length && i >= n; i++) { /* trailing nils dropped */ }
  }
  if (kv) for (let i = 0; i < kv.length; i += 2) { const k = kv[i]; if (k === undefined) throw rterr('table index is nil'); t.set(k, kv[i + 1]); }
  return t;
}
function forNum(v, what) {
  const n = tonum(v);
  if (n === undefined || typeof v === 'string') { if (typeof v !== 'string' || n === undefined) throw rterr("'for' " + what + ' must be a number'); }
  return n;
}
let nextFn = null;
function forIter(f, s, c) { // returns a JS iterator-ish protocol for generic for
  return null;
}

// ---------------------------------------------------------------- lexer
const KEYWORDS = new Set(['and','break','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while']);
function lex(src, chunk) {
  const toks = []; let i = 0, line = 1; const n = src.length;
  const err = (m, near) => new LuaError(chunk + ':' + line + ': ' + m + (near !== undefined ? " near '" + near + "'" : ''));
  function longBracket(start) { // at '[' ; returns level or -1
    let j = start + 1, lvl = 0;
    while (src[j] === '=') { lvl++; j++; }
    return src[j] === '[' ? lvl : -1;
  }
  function readLong(start, lvl) { // start at first '[' ; returns [string, endIndex]
    let j = start + lvl + 2;
    if (src[j] === '\r') { j++; if (src[j] === '\n') j++; line++; } else if (src[j] === '\n') { j++; if (src[j] === '\r') j++; line++; }
    const close = ']' + '='.repeat(lvl) + ']';
    const e = src.indexOf(close, j);
    if (e < 0) throw err('unfinished long string', '<eof>');
    const s = src.slice(j, e);
    for (let k = 0; k < s.length; k++) if (s[k] === '\n') line++;
    return [s.replace(/\r\n?/g, '\n'), e + close.length];
  }
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === '﻿' || c === ' ') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') {
      i += 2;
      if (src[i] === '[') { const l = longBracket(i); if (l >= 0) { const r = readLong(i, l); i = r[1]; continue; } }
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    const start = i;
    if (/[A-Za-z_]/.test(c)) {
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) i++;
      const w = src.slice(start, i);
      toks.push({ t: KEYWORDS.has(w) ? w : 'name', v: w, line });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        i += 2; while (i < n && /[0-9a-fA-F]/.test(src[i])) i++;
        toks.push({ t: 'number', v: parseInt(src.slice(start + 2, i), 16), line }); continue;
      }
      while (i < n && /[0-9]/.test(src[i])) i++;
      if (src[i] === '.') { i++; while (i < n && /[0-9]/.test(src[i])) i++; }
      if (src[i] === 'e' || src[i] === 'E') { i++; if (src[i] === '+' || src[i] === '-') i++; while (i < n && /[0-9]/.test(src[i])) i++; }
      const txt = src.slice(start, i);
      if (/[A-Za-z_]/.test(src[i] || '')) throw err('malformed number', txt + src[i]);
      const v = parseFloat(txt); if (v !== v) throw err('malformed number', txt);
      toks.push({ t: 'number', v, line }); continue;
    }
    if (c === '"' || c === "'") {
      i++; let s = '';
      for (;;) {
        if (i >= n) throw err('unfinished string', '<eof>');
        const d = src[i];
        if (d === c) { i++; break; }
        if (d === '\n') throw err('unfinished string', src.slice(start, i));
        if (d === '\\') {
          i++; const e = src[i];
          switch (e) {
            case 'n': s += '\n'; i++; break; case 't': s += '\t'; i++; break; case 'r': s += '\r'; i++; break;
            case 'a': s += '\x07'; i++; break; case 'b': s += '\b'; i++; break; case 'f': s += '\f'; i++; break; case 'v': s += '\v'; i++; break;
            case '\\': s += '\\'; i++; break; case '"': s += '"'; i++; break; case "'": s += "'"; i++; break;
            case '\n': s += '\n'; line++; i++; if (src[i] === '\r') i++; break;
            case '\r': s += '\n'; line++; i++; if (src[i] === '\n') i++; break;
            default:
              if (/[0-9]/.test(e)) { let j = i, v = 0, k = 0; while (k < 3 && /[0-9]/.test(src[j] || '')) { v = v * 10 + (+src[j]); j++; k++; } if (v > 255) throw err('escape sequence too large', src.slice(start, j)); s += String.fromCharCode(v); i = j; }
              else { s += e; i++; }
          }
        } else { s += d; i++; }
      }
      toks.push({ t: 'string', v: s, line }); continue;
    }
    if (c === '[') {
      const l = longBracket(i);
      if (l >= 0) { const ln = line; const r = readLong(i, l); i = r[1]; toks.push({ t: 'string', v: r[0], line: ln }); continue; }
    }
    const three = src.substr(i, 3), two = src.substr(i, 2);
    if (three === '...') { toks.push({ t: '...', line }); i += 3; continue; }
    if (['==', '~=', '<=', '>=', '..'].includes(two)) { toks.push({ t: two, line }); i += 2; continue; }
    if ('+-*/%^#<>=(){}[];:,.'.includes(c)) { toks.push({ t: c, line }); i++; continue; }
    throw err('unexpected symbol', c);
  }
  toks.push({ t: '<eof>', line });
  return toks;
}

// ---------------------------------------------------------------- parser -> AST
function parse(src, chunk) {
  const toks = lex(src, chunk); let p = 0;
  const cur = () => toks[p];
  const err = (m, tk) => { tk = tk || cur(); const near = tk.t === '<eof>' ? '<eof>' : (tk.t === 'name' || tk.t === 'string' || tk.t === 'number') ? String(tk.v) : tk.t; return new LuaError(chunk + ':' + tk.line + ': ' + m + " near '" + near + "'"); };
  const check = t => cur().t === t;
  const accept = t => { if (cur().t === t) { p++; return true; } return false; };
  const expect = (t, what) => { if (cur().t !== t) throw err("'" + t + "' expected"); return toks[p++]; };
  const expectMatch = (t, open, line) => {
    if (cur().t !== t) {
      if (line === cur().line) throw err("'" + t + "' expected");
      throw err("'" + t + "' expected (to close '" + open + "' at line " + line + ')');
    }
    p++;
  };
  const name = () => { if (cur().t !== 'name') throw err('<name> expected'); return toks[p++].v; };
  function blockEnd() { const t = cur().t; return t === 'end' || t === 'else' || t === 'elseif' || t === 'until' || t === '<eof>'; }
  function block() {
    const stmts = [];
    while (!blockEnd()) {
      if (check('return')) {
        const line = cur().line; p++;
        let exprs = [];
        if (!blockEnd() && !check(';')) exprs = exprlist();
        accept(';');
        stmts.push({ k: 'return', exprs, line });
        if (!blockEnd()) throw err("'<eof>' expected");
        break;
      }
      if (check('break')) { const line = cur().line; p++; accept(';'); stmts.push({ k: 'break', line }); if (!blockEnd()) throw err("'end' expected"); break; }
      const s = statement(); if (s) stmts.push(s);
      accept(';');
    }
    return stmts;
  }
  function statement() {
    const tk = cur(), line = tk.line;
    switch (tk.t) {
      case 'if': {
        p++; const clauses = []; let els = null;
        let cond = expr(); expect('then'); clauses.push({ cond, body: block() });
        for (;;) {
          if (check('elseif')) { p++; cond = expr(); expect('then'); clauses.push({ cond, body: block() }); }
          else if (check('else')) { p++; els = block(); expectMatch('end', 'if', line); break; }
          else { expectMatch('end', 'if', line); break; }
        }
        return { k: 'if', clauses, els, line };
      }
      case 'while': { p++; const cond = expr(); expect('do'); const body = block(); expectMatch('end', 'while', line); return { k: 'while', cond, body, line }; }
      case 'do': { p++; const body = block(); expectMatch('end', 'do', line); return { k: 'do', body, line }; }
      case 'for': {
        p++; const n1 = name();
        if (check('=')) {
          p++; const a = expr(); expect(','); const b = expr(); let c = null; if (accept(',')) c = expr();
          expect('do'); const body = block(); expectMatch('end', 'for', line);
          return { k: 'fornum', v: n1, a, b, c, body, line };
        }
        const names = [n1]; while (accept(',')) names.push(name());
        expect('in'); const exprs = exprlist(); expect('do'); const body = block(); expectMatch('end', 'for', line);
        return { k: 'forin', names, exprs, body, line };
      }
      case 'repeat': { p++; const body = block(); expectMatch('until', 'repeat', line); const cond = expr(); return { k: 'repeat', body, cond, line }; }
      case 'function': {
        p++; let n = { k: 'name', v: name(), line }; let isMethod = false; let fname = n.v;
        while (check('.') || check(':')) {
          const colon = check(':'); p++; const key = name(); fname += (colon ? ':' : '.') + key;
          n = { k: 'index', o: n, key: { k: 'string', v: key }, line };
          if (colon) { isMethod = true; break; }
        }
        const f = funcbody(isMethod, line, fname);
        return { k: 'assign', targets: [n], exprs: [f], line };
      }
      case 'local': {
        p++;
        if (accept('function')) { const n = name(); const f = funcbody(false, line, n); return { k: 'localfunc', name: n, f, line }; }
        const names = [name()]; while (accept(',')) names.push(name());
        let exprs = []; if (accept('=')) exprs = exprlist();
        return { k: 'local', names, exprs, line };
      }
      default: {
        const e = suffixedexp();
        if (check('=') || check(',')) {
          const targets = [e]; while (accept(',')) targets.push(suffixedexp());
          expect('=');
          for (const t of targets) if (t.k !== 'name' && t.k !== 'index') throw err('syntax error');
          const exprs = exprlist();
          return { k: 'assign', targets, exprs, line };
        }
        if (e.k !== 'call' && e.k !== 'mcall') throw err('syntax error');
        return { k: 'callstat', e, line };
      }
    }
  }
  function funcbody(isMethod, line, fname) {
    const params = isMethod ? ['self'] : []; let vararg = false;
    expect('(');
    if (!check(')')) {
      do {
        if (check('...')) { p++; vararg = true; break; }
        params.push(name());
      } while (accept(','));
    }
    expect(')');
    const body = block(); expectMatch('end', 'function', line);
    return { k: 'function', params, vararg, body, line, fname };
  }
  function exprlist() { const l = [expr()]; while (accept(',')) l.push(expr()); return l; }
  function primaryexp() {
    const tk = cur();
    if (tk.t === 'name') { p++; return { k: 'name', v: tk.v, line: tk.line }; }
    if (tk.t === '(') { const line = tk.line; p++; const e = expr(); expectMatch(')', '(', line); return { k: 'paren', e, line }; }
    throw err('unexpected symbol');
  }
  function suffixedexp() {
    let e = primaryexp();
    for (;;) {
      const tk = cur();
      switch (tk.t) {
        case '.': p++; e = { k: 'index', o: e, key: { k: 'string', v: name() }, line: tk.line }; break;
        case '[': { p++; const key = expr(); expect(']'); e = { k: 'index', o: e, key, line: tk.line }; break; }
        case ':': { p++; const nm = name(); const args = callargs(); e = { k: 'mcall', o: e, name: nm, args, line: tk.line }; break; }
        case '(': case 'string': case '{': { const args = callargs(); e = { k: 'call', f: e, args, line: tk.line }; break; }
        default: return e;
      }
    }
  }
  function callargs() {
    const tk = cur();
    if (tk.t === 'string') { p++; return [{ k: 'string', v: tk.v }]; }
    if (tk.t === '{') return [tablecons()];
    if (tk.t === '(') {
      p++; if (accept(')')) return [];
      const a = exprlist(); expectMatch(')', '(', tk.line); return a;
    }
    throw err('function arguments expected');
  }
  function tablecons() {
    const line = cur().line; expect('{');
    const items = [];
    while (!check('}')) {
      if (check('[')) { p++; const k = expr(); expect(']'); expect('='); items.push({ kind: 'kv', k, v: expr() }); }
      else if (check('name') && toks[p + 1].t === '=') { const k = name(); p++; items.push({ kind: 'kv', k: { k: 'string', v: k }, v: expr() }); }
      else items.push({ kind: 'pos', v: expr() });
      if (!accept(',') && !accept(';')) break;
    }
    expectMatch('}', '{', line);
    return { k: 'table', items, line };
  }
  function simpleexp() {
    const tk = cur();
    switch (tk.t) {
      case 'number': p++; return { k: 'number', v: tk.v };
      case 'string': p++; return { k: 'string', v: tk.v };
      case 'nil': p++; return { k: 'nil' };
      case 'true': p++; return { k: 'true' };
      case 'false': p++; return { k: 'false' };
      case '...': p++; return { k: 'vararg', line: tk.line };
      case '{': return tablecons();
      case 'function': p++; return funcbody(false, tk.line, '?');
      default: return suffixedexp();
    }
  }
  const BIN = { 'or': [1, 1], 'and': [2, 2], '<': [3, 3], '>': [3, 3], '<=': [3, 3], '>=': [3, 3], '~=': [3, 3], '==': [3, 3], '..': [5, 4], '+': [6, 6], '-': [6, 6], '*': [7, 7], '/': [7, 7], '%': [7, 7], '^': [10, 9] };
  const UNARY_PRI = 8;
  function expr(limit) {
    limit = limit || 0;
    let left; const tk = cur();
    if (tk.t === 'not' || tk.t === '-' || tk.t === '#') {
      p++; const operand = expr(UNARY_PRI);
      if (tk.t === '-' && operand.k === 'number') left = { k: 'number', v: -operand.v };
      else left = { k: 'unop', op: tk.t, e: operand, line: tk.line };
    } else left = simpleexp();
    for (;;) {
      const op = cur().t; const pr = BIN[op];
      if (!pr || pr[0] <= limit) break;
      const line = cur().line; p++;
      const right = expr(pr[1]);
      left = { k: 'binop', op, l: left, r: right, line };
    }
    return left;
  }
  const b = block();
  if (!check('<eof>')) throw err("'<eof>' expected");
  return b;
}

// ---------------------------------------------------------------- code generation
function compileChunk(src, chunk) {
  const ast = parse(src, chunk);
  let uid = 0;
  function gen() {
    const fnStack = [];
    function newScope(parent) { return { vars: new Map(), parent }; }
    function lookup(sc, nm) { for (let s = sc; s; s = s.parent) { const v = s.vars.get(nm); if (v) return v; } return null; }
    function declare(sc, nm) { const id = 'v' + (++uid) + '_' + nm.replace(/[^A-Za-z0-9_]/g, '_'); sc.vars.set(nm, id); return id; }
    const Q = s => JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    let fn = null; // current function ctx
    function tmp() { const t = '$t' + (++fn.tmps); fn.tmpNames.push(t); return t; }

    function multi(e) { return e.k === 'call' || e.k === 'mcall' || e.k === 'vararg'; }
    // expression -> JS (single value)
    function ex(e, sc) {
      switch (e.k) {
        case 'nil': return 'undefined';
        case 'true': return 'true';
        case 'false': return 'false';
        case 'number': return (e.v < 0 || Object.is(e.v, -0)) ? '(' + String(e.v) + ')' : String(e.v);
        case 'string': return Q(e.v);
        case 'vararg': return '$va[0]';
        case 'function': return func(e, sc);
        case 'paren': return multi(e.e) ? '$1(' + exm(e.e, sc) + ')' : ex(e.e, sc);
        case 'name': { const v = lookup(sc, e.v); return v ? v : '$G(' + Q(e.v) + ')'; }
        case 'index': return '$idx(' + ex(e.o, sc) + ',' + ex(e.key, sc) + descOf(e.o, sc) + ')';
        case 'call': case 'mcall': return '$1(' + exm(e, sc) + ')';
        case 'table': return table(e, sc);
        case 'unop': {
          const a = ex(e.e, sc);
          if (e.op === 'not') return '!$tr(' + a + ')';
          if (e.op === '-') return '$unm(' + a + ')';
          return '$len(' + a + ')';
        }
        case 'binop': return binop(e, sc);
      }
      throw new Error('bad expr ' + e.k);
    }
    function descOf(o, sc) {
      if (o.k === 'name') { const v = lookup(sc, o.v); return ',' + Q((v ? "local '" : "global '") + o.v + "'"); }
      if (o.k === 'index' && o.key.k === 'string') return ',' + Q("field '" + o.key.v + "'");
      return '';
    }
    function binop(e, sc) {
      const op = e.op;
      if (op === 'and') { const t = tmp(); return '((' + t + '=' + ex(e.l, sc) + ')==null||' + t + '===false?' + t + ':' + ex(e.r, sc) + ')'; }
      if (op === 'or') { const t = tmp(); return '((' + t + '=' + ex(e.l, sc) + ')!=null&&' + t + '!==false?' + t + ':' + ex(e.r, sc) + ')'; }
      const l = ex(e.l, sc), r = ex(e.r, sc);
      switch (op) {
        case '+': return '$add(' + l + ',' + r + ')';
        case '-': return '$sub(' + l + ',' + r + ')';
        case '*': return '$mul(' + l + ',' + r + ')';
        case '/': return '$div(' + l + ',' + r + ')';
        case '%': return '$mod(' + l + ',' + r + ')';
        case '^': return '$pow(' + l + ',' + r + ')';
        case '..': return '$cat(' + l + ',' + r + ')';
        case '==': return '$eq(' + l + ',' + r + ')';
        case '~=': return '!$eq(' + l + ',' + r + ')';
        case '<': return '$lt(' + l + ',' + r + ')';
        case '>': { const t = tmp(); return '(' + t + '=' + l + ',$lt(' + r + ',' + t + '))'; }
        case '<=': return '$le(' + l + ',' + r + ')';
        case '>=': { const t = tmp(); return '(' + t + '=' + l + ',$le(' + r + ',' + t + '))'; }
      }
      throw new Error('bad op ' + op);
    }
    // multi-valued expression: returns JS expr yielding raw call result (array | single | undefined)
    function exm(e, sc) {
      if (e.k === 'vararg') return '$va';
      if (e.k === 'call') {
        return '$fn(' + ex(e.f, sc) + descOf(e.f, sc).replace(/^,/, ',') + ')(' + args(e.args, sc) + ')';
      }
      if (e.k === 'mcall') {
        const t = tmp();
        return '(' + t + '=' + ex(e.o, sc) + ',$fn($idx(' + t + ',' + Q(e.name) + descOf(e.o, sc) + '),' + Q("method '" + e.name + "'") + ')(' + t + (e.args.length ? ',' + args(e.args, sc) : '') + '))';
      }
      return ex(e, sc);
    }
    function args(list, sc) {
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (i === list.length - 1 && multi(a)) out.push('...$m(' + exm(a, sc) + ')'); else out.push(ex(a, sc));
      }
      return out.join(',');
    }
    // list of exprs -> JS array literal expression (with multi expansion of last)
    function arrayOf(list, sc) { return '[' + args(list, sc) + ']'; }
    function table(e, sc) {
      const pos = [], kv = [];
      const items = e.items;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'pos') {
          if (i === items.length - 1 && multi(it.v)) pos.push('...$m(' + exm(it.v, sc) + ')'); else pos.push(ex(it.v, sc));
        } else { kv.push(ex(it.k, sc), ex(it.v, sc)); }
      }
      return '$tbl(' + (pos.length ? '[' + pos.join(',') + ']' : 'null') + (kv.length ? ',[' + kv.join(',') + ']' : '') + ')';
    }
    function func(e, sc) {
      const inner = newScope(sc);
      const outer = fn;
      fn = { tmps: 0, tmpNames: [], vararg: e.vararg };
      const ps = e.params.map(pn => declare(inner, pn));
      const body = block(e.body, inner, true);
      const tmps = fn.tmpNames.length ? 'let ' + fn.tmpNames.join(',') + ';' : '';
      const va = e.vararg;
      fn = outer;
      return '(function(' + ps.concat(va ? ['...$va'] : []).join(',') + '){' + tmps + body + '})';
    }
    function block(stmts, sc, isFn) {
      let out = '';
      const scope = isFn ? sc : newScope(sc);
      for (const s of stmts) out += stmt(s, scope);
      return out;
    }
    function assignTo(t, val, sc) {
      if (t.k === 'name') { const v = lookup(sc, t.v); return v ? v + '=' + val + ';' : '$SG(' + Q(t.v) + ',' + val + ');'; }
      return '$sidx(' + ex(t.o, sc) + ',' + ex(t.key, sc) + ',' + val + descOf(t.o, sc) + ');';
    }
    function stmt(s, sc) {
      const ln = '$S.ln=' + s.line + ';';
      switch (s.k) {
        case 'callstat': return ln + exm(s.e, sc) + ';';
        case 'local': {
          // evaluate exprs before declaring names
          const names = s.names, exprs = s.exprs;
          let code = ln;
          if (exprs.length === 0) { const ids = names.map(n => declare(sc, n)); return code + 'let ' + ids.map(i => i + '=undefined').join(',') + ';'; }
          if (names.length === 1 && exprs.length === 1) { const val = ex(exprs[0], sc); const id = declare(sc, names[0]); return code + 'let ' + id + '=' + val + ';'; }
          const last = exprs[exprs.length - 1];
          let arr;
          if (exprs.length === 1 && multi(last)) arr = '$m(' + exm(last, sc) + ')';
          else arr = arrayOf(exprs, sc);
          const t = '$r' + (++uid);
          code += 'const ' + t + '=' + arr + ';';
          const ids = names.map(n => declare(sc, n));
          return code + 'let ' + ids.map((id, i) => id + '=' + t + '[' + i + ']').join(',') + ';';
        }
        case 'localfunc': {
          const id = declare(sc, s.name);
          return ln + 'let ' + id + ';' + id + '=' + func(s.f, sc) + ';';
        }
        case 'assign': {
          if (s.targets.length === 1 && s.exprs.length === 1) {
            const t = s.targets[0];
            if (t.k === 'name') return ln + assignTo(t, ex(s.exprs[0], sc), sc);
            // index: evaluate obj, key, then value
            return ln + '$sidx(' + ex(t.o, sc) + ',' + ex(t.key, sc) + ',' + ex(s.exprs[0], sc) + descOf(t.o, sc) + ');';
          }
          const t = '$r' + (++uid);
          const last = s.exprs[s.exprs.length - 1];
          let arr = (s.exprs.length === 1 && multi(last)) ? '$m(' + exm(last, sc) + ')' : arrayOf(s.exprs, sc);
          let code = ln;
          // evaluate target sub-expressions first (object/key) for index targets
          const pre = s.targets.map((tg, i) => {
            if (tg.k === 'index') { const o = '$o' + (++uid), k = '$k' + uid; code += 'const ' + o + '=' + ex(tg.o, sc) + ',' + k + '=' + ex(tg.key, sc) + ';'; return { o, k }; }
            return null;
          });
          code += 'const ' + t + '=' + arr + ';';
          s.targets.forEach((tg, i) => {
            if (tg.k === 'name') code += assignTo(tg, t + '[' + i + ']', sc);
            else code += '$sidx(' + pre[i].o + ',' + pre[i].k + ',' + t + '[' + i + ']);';
          });
          return code;
        }
        case 'return': {
          const e = s.exprs;
          if (e.length === 0) return ln + 'return;';
          if (e.length === 1) {
            const x = e[0];
            if (multi(x)) return ln + 'return ' + (x.k === 'vararg' ? '$va.slice()' : exm(x, sc)) + ';';
            return ln + 'return ' + ex(x, sc) + ';';
          }
          return ln + 'return ' + arrayOf(e, sc) + ';';
        }
        case 'break': return 'break;';
        case 'do': return '{' + block(s.body, sc) + '}';
        case 'if': {
          let code = ln;
          s.clauses.forEach((c, i) => { code += (i ? 'else ' : '') + 'if($tr(' + ex(c.cond, sc) + ')){' + block(c.body, sc) + '}'; });
          if (s.els) code += 'else{' + block(s.els, sc) + '}';
          return code;
        }
        case 'while': return ln + 'while($tr(' + ex(s.cond, sc) + ')){' + block(s.body, sc) + '}';
        case 'repeat': {
          const inner = newScope(sc);
          let body = ''; for (const st of s.body) body += stmt(st, inner);
          return 'for(;;){' + body + '$S.ln=' + s.line + ';if($tr(' + ex(s.cond, inner) + '))break;}';
        }
        case 'fornum': {
          const a = '$a' + (++uid), b = '$b' + uid, c = '$c' + uid, i = '$i' + uid;
          const inner = newScope(sc);
          const start = ex(s.a, sc), lim = ex(s.b, sc), step = s.c ? ex(s.c, sc) : '1';
          const id = declare(inner, s.v);
          return ln + '{const ' + a + '=$fnum(' + start + ",'initial value')," + b + '=$fnum(' + lim + ",'limit')," + c + '=$fnum(' + step + ",'step');" +
            'for(let ' + i + '=' + a + ';' + c + '>0?' + i + '<=' + b + ':' + i + '>=' + b + ';' + i + '+=' + c + '){let ' + id + '=' + i + ';' + block(s.body, inner) + '}}';
        }
        case 'forin': {
          const f = '$f' + (++uid), st = '$s' + uid, ct = '$c' + uid, r = '$r' + uid, it = '$it' + uid;
          const inner = newScope(sc);
          const ids = s.names.map(n => declare(inner, n));
          const init = arrayOf(s.exprs, sc);
          const bodyCode = block(s.body, inner);
          return ln + '{const ' + it + '=' + init + ';const ' + f + '=$fn(' + it + "[0],'for iterator'),$st=" + it + '[1];let ' + ct + '=' + it + '[2];' +
            'if(' + f + '===$next&&$st instanceof $LT){for(const $k of $st.keys()){const $v=$st.get($k);if($v===undefined)continue;let ' + ids[0] + '=$k' + (ids[1] ? ',' + ids[1] + '=$v' : '') + (ids.length > 2 ? ',' + ids.slice(2).map(x => x + '=undefined').join(',') : '') + ';' + bodyCode + '}}' +
            'else for(;;){const ' + r + '=$m(' + f + '($st,' + ct + '));let ' + ids.map((id, i) => id + '=' + r + '[' + i + ']').join(',') + ';if(' + ids[0] + '===undefined||' + ids[0] + '===null)break;' + ct + '=' + ids[0] + ';' + bodyCode + '}}';
        }
      }
      throw new Error('bad stmt ' + s.k);
    }
    // top-level chunk = vararg function
    fn = { tmps: 0, tmpNames: [], vararg: true };
    const top = newScope(null);
    const body = block(ast, top, true);
    const tmps = fn.tmpNames.length ? 'let ' + fn.tmpNames.join(',') + ';' : '';
    return 'return function(...$va){' + tmps + body + '};';
  }
  const code = gen();
  return code;
}

class Interp {
  constructor() {
    this.globals = new LuaTable();
    this.helpers = null;
    this._initHelpers();
    if (Interp.installLibs) Interp.installLibs(this);
  }
  _initHelpers() {
    const G = this.globals;
    this.helpers = { $G: k => G.get(k) === undefined && G.meta ? index(G, k) : G.get(k), $SG: (k, v) => { if (G.meta) setindex(G, k, v); else G.set(k, v); },
      $S: S, $1, $m, $tr: truthy, $idx: index, $sidx: setindex, $fn: callable, $add: add, $sub: sub, $mul: mul, $div: div, $mod: mod, $pow: pow, $unm: unm, $cat: concat, $len: len, $eq: eq, $lt: lt, $le: le,
      $tbl: mkTable, $fnum: (v, what) => { const n = (typeof v === 'number') ? v : tonum(v); if (n === undefined) throw rterr("'for' " + what + ' must be a number'); return n; },
      $LT: LuaTable, $next: null };
  }
  compile(src, chunk) {
    chunk = chunk || 'chunk';
    S.chunk = chunk;
    const code = compileChunk(src, chunk);
    const h = this.helpers; h.$next = this.globals.get('next');
    const names = Object.keys(h);
    let factory;
    try { factory = new Function(...names, code); }
    catch (e) { throw new LuaError(chunk + ': internal compile error: ' + e.message + '\n' + code.slice(0, 400)); }
    const f = factory(...names.map(n => h[n]));
    const self = this;
    const wrapped = function (...args) { S.chunk = chunk; return f(...args); };
    wrapped.jsSource = code;
    return wrapped;
  }
  run(src, chunk) {
    const f = this.compile(src, chunk);
    return this.callSafe(f, []);
  }
  callSafe(f, args) {
    try { return $m(f(...args)); }
    catch (e) {
      if (e instanceof LuaError) throw e;
      if (e instanceof RangeError) throw new LuaError(S.chunk + ':' + S.ln + ': stack overflow');
      throw e;
    }
  }
  call(f, args) { return this.callSafe(callable(f), args || []); }
  setGlobal(k, v) { this.globals.set(k, v); }
  getGlobal(k) { return this.globals.get(k); }
  defineTable(name, fns) {
    const t = new LuaTable();
    for (const k of Object.keys(fns)) { const f = fns[k]; f.isBuiltin = true; t.set(k, f); }
    this.globals.set(name, t); return t;
  }
  toLua(v) {
    if (Array.isArray(v)) { const t = new LuaTable(); v.forEach((x, i) => t.set(i + 1, this.toLua(x))); return t; }
    if (v && typeof v === 'object' && !(v instanceof LuaTable) && !(v instanceof Multi)) { const t = new LuaTable(); for (const k of Object.keys(v)) t.set(k, this.toLua(v[k])); return t; }
    return v === null ? undefined : v;
  }
  fromLua(v) {
    if (v instanceof LuaTable) {
      const n = v.length(); const ks = v.keys();
      if (ks.length === n) { const r = []; for (let i = 1; i <= n; i++) r.push(this.fromLua(v.get(i))); return r; }
      const o = {}; for (const k of ks) o[String(k)] = this.fromLua(v.get(k)); return o;
    }
    return v;
  }
}

const Lua = { Interp, LuaTable, LuaError, Multi, S, util: { tostr, tonum, num2str, str2num, fmtG, type, truthy, $1, $m, index, setindex, callable, eq, lt, le, concat, rterr, mkTable, getmeta } };
if (typeof module !== 'undefined' && module.exports) module.exports = Lua; else root.Lua = Lua;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* Lua 5.1 standard library for lua_core.js */
(function () {
'use strict';
const Lua = globalThis.Lua;
const { LuaTable, LuaError, Multi, S } = Lua;
const U = Lua.util;
const { tostr, tonum, type, fmtG } = U;
const rterr = U.rterr;

function argErr(n, fname, msg) { return rterr("bad argument #" + n + " to '" + fname + "' (" + msg + ')'); }
function checkTable(v, n, f) { if (!(v instanceof LuaTable)) throw argErr(n, f, 'table expected, got ' + (v === undefined ? 'no value' : type(v))); return v; }
function checkInt(v, n, f, def) {
  if (v === undefined || v === null) { if (def !== undefined) return def; throw argErr(n, f, 'number expected, got no value'); }
  const x = tonum(v); if (x === undefined) throw argErr(n, f, 'number expected, got ' + type(v));
  return x < 0 ? Math.ceil(x) : Math.floor(x);
}
function checkNum(v, n, f, def) {
  if (v === undefined || v === null) { if (def !== undefined) return def; throw argErr(n, f, 'number expected, got no value'); }
  const x = tonum(v); if (x === undefined) throw argErr(n, f, 'number expected, got ' + type(v)); return x;
}
function checkStr(v, n, f, def) {
  if (v === undefined || v === null) { if (def !== undefined) return def; throw argErr(n, f, 'string expected, got no value'); }
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return U.num2str(v);
  throw argErr(n, f, 'string expected, got ' + type(v));
}

// ------------------------------------------------------------------ Lua patterns
const L_ESC = '%', MAXCCALLS = 200;
function classMatch(c, cl) { // c: char code, cl: class letter
  let res;
  const lower = cl.toLowerCase();
  switch (lower) {
    case 'a': res = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c > 127 && isLetterCode(c)); break;
    case 'c': res = c < 32 || c === 127; break;
    case 'd': res = c >= 48 && c <= 57; break;
    case 'l': res = (c >= 97 && c <= 122) || (c > 127 && isLower(c)); break;
    case 'p': res = (c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126); break;
    case 's': res = c === 32 || (c >= 9 && c <= 13); break;
    case 'u': res = (c >= 65 && c <= 90) || (c > 127 && isUpper(c)); break;
    case 'w': res = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c > 127 && isLetterCode(c)); break;
    case 'x': res = (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102); break;
    case 'z': res = c === 0; break;
    default: return cl === String.fromCharCode(c);
  }
  if (cl >= 'A' && cl <= 'Z') res = !res;
  return res;
}
function isLetterCode(c) { const ch = String.fromCharCode(c); return ch.toLowerCase() !== ch.toUpperCase(); }
function isLower(c) { const ch = String.fromCharCode(c); return ch !== ch.toUpperCase(); }
function isUpper(c) { const ch = String.fromCharCode(c); return ch !== ch.toLowerCase(); }

function matchState(src, pat) { return { src, pat, level: 0, capStart: [], capLen: [], depth: 0 }; }
const CAP_UNFINISHED = -1, CAP_POSITION = -2;
function classEnd(ms, p) {
  const pat = ms.pat;
  if (p >= pat.length) throw rterr('malformed pattern (ends with \'%\')');
  const c = pat[p++];
  if (c === L_ESC) { if (p >= pat.length) throw rterr("malformed pattern (ends with '%')"); return p + 1; }
  if (c === '[') {
    if (pat[p] === '^') p++;
    do {
      if (p >= pat.length) throw rterr("malformed pattern (missing ']')");
      const cc = pat[p++];
      if (cc === L_ESC) p++;
    } while (pat[p] !== ']' || false ? (p < pat.length || (() => { throw rterr("malformed pattern (missing ']')"); })()) : false);
    return p + 1;
  }
  return p;
}
function matchClassSet(ms, c, p, ec) { // p at '[', ec at the ']' index
  const pat = ms.pat; let sig = true; p++;
  if (pat[p] === '^') { sig = false; p++; }
  while (p < ec) {
    if (pat[p] === L_ESC) { p++; if (classMatch(c, pat[p])) return sig; p++; }
    else if (pat[p + 1] === '-' && p + 2 < ec) {
      if (pat.charCodeAt(p) <= c && c <= pat.charCodeAt(p + 2)) return sig;
      p += 3;
    } else { if (pat.charCodeAt(p) === c) return sig; p++; }
  }
  return !sig;
}
function singleMatch(ms, s, p, ep) {
  if (s >= ms.src.length) return false;
  const c = ms.src.charCodeAt(s);
  switch (ms.pat[p]) {
    case '.': return true;
    case L_ESC: return classMatch(c, ms.pat[p + 1]);
    case '[': return matchClassSet(ms, c, p, ep - 1);
    default: return ms.pat.charCodeAt(p) === c;
  }
}
function matchBalance(ms, s, p) {
  if (p + 1 >= ms.pat.length) throw rterr("unbalanced pattern");
  if (s >= ms.src.length || ms.src[s] !== ms.pat[p]) return -1;
  const b = ms.pat[p], e = ms.pat[p + 1]; let cont = 1;
  for (let i = s + 1; i < ms.src.length; i++) {
    const c = ms.src[i];
    if (c === e) { if (--cont === 0) return i + 1; }
    else if (c === b) cont++;
  }
  return -1;
}
function maxExpand(ms, s, p, ep) {
  let i = 0;
  while (singleMatch(ms, s + i, p, ep)) i++;
  while (i >= 0) { const r = doMatch(ms, s + i, ep + 1); if (r !== -1) return r; i--; }
  return -1;
}
function minExpand(ms, s, p, ep) {
  for (;;) {
    const r = doMatch(ms, s, ep + 1);
    if (r !== -1) return r;
    if (singleMatch(ms, s, p, ep)) s++; else return -1;
  }
}
function startCapture(ms, s, p, what) {
  const l = ms.level; if (l >= 32) throw rterr('too many captures');
  ms.capStart[l] = s; ms.capLen[l] = what; ms.level = l + 1;
  const r = doMatch(ms, s, p);
  if (r === -1) ms.level--;
  return r;
}
function endCapture(ms, s, p) {
  let l = -1;
  for (let i = ms.level - 1; i >= 0; i--) if (ms.capLen[i] === CAP_UNFINISHED) { l = i; break; }
  if (l < 0) throw rterr('invalid pattern capture');
  ms.capLen[l] = s - ms.capStart[l];
  const r = doMatch(ms, s, p);
  if (r === -1) ms.capLen[l] = CAP_UNFINISHED;
  return r;
}
function matchCapture(ms, s, l) {
  l = l.charCodeAt(0) - 49;
  if (l < 0 || l >= ms.level || ms.capLen[l] === CAP_UNFINISHED) throw rterr('invalid capture index');
  const cap = ms.src.substr(ms.capStart[l], ms.capLen[l]);
  if (ms.src.length - s >= cap.length && ms.src.substr(s, cap.length) === cap) return s + cap.length;
  return -1;
}
function doMatch(ms, s, p) {
  if (++ms.depth > MAXCCALLS * 20) throw rterr('pattern too complex');
  try {
    const pat = ms.pat;
    for (;;) {
      if (p >= pat.length) return s;
      const c = pat[p];
      switch (c) {
        case '(':
          if (pat[p + 1] === ')') return startCapture(ms, s, p + 2, CAP_POSITION);
          return startCapture(ms, s, p + 1, CAP_UNFINISHED);
        case ')': return endCapture(ms, s, p + 1);
        case '$':
          if (p + 1 === pat.length) return s === ms.src.length ? s : -1;
          break;
        case L_ESC: {
          const n = pat[p + 1];
          if (n === 'b') { s = matchBalance(ms, s, p + 2); if (s === -1) return -1; p += 4; continue; }
          if (n === 'f') {
            p += 2;
            if (pat[p] !== '[') throw rterr("missing '[' after '%f' in pattern");
            const ep = classEnd(ms, p);
            const prev = s === 0 ? 0 : ms.src.charCodeAt(s - 1);
            const cur = s < ms.src.length ? ms.src.charCodeAt(s) : 0;
            if (!matchClassSet(ms, prev, p, ep - 1) && matchClassSet(ms, cur, p, ep - 1)) { p = ep; continue; }
            return -1;
          }
          if (n >= '0' && n <= '9') { s = matchCapture(ms, s, n); if (s === -1) return -1; p += 2; continue; }
          break;
        }
      }
      // default
      const ep = classEnd(ms, p);
      const epc = pat[ep];
      if (epc === '?') {
        if (singleMatch(ms, s, p, ep)) { const r = doMatch(ms, s + 1, ep + 1); if (r !== -1) return r; }
        p = ep + 1; continue;
      }
      if (epc === '*') return maxExpand(ms, s, p, ep);
      if (epc === '+') return singleMatch(ms, s, p, ep) ? maxExpand(ms, s + 1, p, ep) : -1;
      if (epc === '-') return minExpand(ms, s, p, ep);
      if (!singleMatch(ms, s, p, ep)) return -1;
      s++; p = ep;
    }
  } finally { ms.depth--; }
}
function getCapture(ms, i, s, e) {
  if (i >= ms.level) {
    if (i === 0) return ms.src.slice(s, e);
    throw rterr('invalid capture index');
  }
  const l = ms.capLen[i];
  if (l === CAP_UNFINISHED) throw rterr('unfinished capture');
  if (l === CAP_POSITION) return ms.capStart[i] + 1;
  return ms.src.substr(ms.capStart[i], l);
}
function pushCaptures(ms, s, e, wholeIfNone) {
  const n = (ms.level === 0 && wholeIfNone) ? 1 : ms.level;
  const out = [];
  for (let i = 0; i < n; i++) out.push(getCapture(ms, i, s, e));
  return out;
}
function posrelat(pos, len) { if (pos >= 0) return pos; if (-pos > len) return 0; return len + pos + 1; }
function noSpecials(p) { return !/[\^$*+?.()\[\]%\-]/.test(p); }
function strFind(s, pat, init, plain, find, fname) {
  s = checkStr(s, 1, fname); pat = checkStr(pat, 2, fname);
  let i = posrelat(checkInt(init, 3, fname, 1), s.length);
  if (i < 1) i = 1;
  if (i > s.length + 1) return [undefined];
  if (find && (U.truthy(plain) || noSpecials(pat))) {
    const r = s.indexOf(pat, i - 1);
    return r < 0 ? [undefined] : [r + 1, r + pat.length];
  }
  let anchor = pat[0] === '^'; let p = anchor ? 1 : 0; let si = i - 1;
  do {
    const ms = matchState(s, pat); const pp = p;
    const e = doMatch(ms, si, pp);
    if (e !== -1) {
      if (find) return [si + 1, e].concat(pushCaptures(ms, undefined, undefined, false));
      const caps = pushCaptures(ms, si, e, true); return caps.length === 1 ? caps[0] : caps;
    }
    si++;
  } while (si <= s.length && !anchor);
  return [undefined];
}
function gmatch(s, pat) {
  s = checkStr(s, 1, 'gmatch'); pat = checkStr(pat, 2, 'gmatch');
  let si = 0;
  return function () {
    for (; si <= s.length; si++) {
      const ms = matchState(s, pat);
      const e = doMatch(ms, si, 0);
      if (e !== -1) {
        const start = si; si = (e === si) ? e + 1 : e; // avoid infinite loop on empty match
        const caps = pushCaptures(ms, start, e, true); return caps.length === 1 ? caps[0] : caps;
      }
    }
    return undefined;
  };
}
function gsub(interp, s, pat, repl, maxn) {
  s = checkStr(s, 1, 'gsub'); pat = checkStr(pat, 2, 'gsub');
  const tr = type(repl);
  if (!(tr === 'number' || tr === 'string' || tr === 'table' || tr === 'function')) throw argErr(3, 'gsub', 'string/function/table expected, got ' + (repl === undefined ? 'no value' : tr));
  const max = maxn === undefined ? Infinity : checkInt(maxn, 4, 'gsub');
  const anchor = pat[0] === '^'; const p = anchor ? 1 : 0;
  let si = 0, n = 0; const out = [];
  const rs = tr === 'number' ? U.num2str(repl) : repl;
  while (n < max) {
    const ms = matchState(s, pat);
    const e = doMatch(ms, si, p);
    if (e !== -1) {
      n++;
      let val;
      const whole = s.slice(si, e);
      if (typeof rs === 'string') {
        let r = '';
        for (let i = 0; i < rs.length; i++) {
          const c = rs[i];
          if (c === L_ESC) {
            i++; const d = rs[i];
            if (d === L_ESC) r += L_ESC;
            else if (d >= '0' && d <= '9') { const v = d === '0' ? whole : getCapture(ms, d.charCodeAt(0) - 49, si, e); r += (typeof v === 'number') ? U.num2str(v) : v; }
            else throw rterr("invalid use of '%' in replacement string");
          } else r += c;
        }
        val = r;
      } else {
        const cap = getCapture(ms, 0, si, e);
        if (tr === 'table') val = U.index(rs, cap);
        else { const caps = pushCaptures(ms, si, e, true); val = U.$1(rs(...caps)); }
        if (val === undefined || val === false || val === null) val = whole;
        else if (typeof val === 'number') val = U.num2str(val);
        else if (typeof val !== 'string') throw rterr('invalid replacement value (a ' + type(val) + ')');
      }
      out.push(val);
    }
    if (e !== -1 && e > si) si = e;
    else if (si < s.length) out.push(s[si++]);
    else break;
    if (si > s.length || anchor) break;
  }
  if (si < s.length) out.push(s.slice(si));
  return [out.join(''), n];
}

// ------------------------------------------------------------------ string.format
function pad(s, width, left, zero) {
  if (s.length >= width) return s;
  if (left) return s + ' '.repeat(width - s.length);
  if (zero) { const m = /^([+\- ]?(?:0[xX])?)(.*)$/.exec(s); return m[1] + '0'.repeat(width - s.length) + m[2]; }
  return ' '.repeat(width - s.length) + s;
}
function format(fmt, ...args) {
  fmt = checkStr(fmt, 1, 'format'); let ai = 0; let out = '';
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i];
    if (c !== '%') { out += c; continue; }
    i++;
    if (fmt[i] === '%') { out += '%'; continue; }
    let flags = '';
    while ('-+ #0'.includes(fmt[i]) && i < fmt.length) flags += fmt[i++];
    let width = ''; while (/[0-9]/.test(fmt[i] || '')) width += fmt[i++];
    let prec = null; if (fmt[i] === '.') { i++; prec = ''; while (/[0-9]/.test(fmt[i] || '')) prec += fmt[i++]; prec = prec === '' ? 0 : parseInt(prec, 10); }
    const conv = fmt[i]; const left = flags.includes('-'), plus = flags.includes('+'), space = flags.includes(' '), alt = flags.includes('#'), zero = flags.includes('0');
    const w = width === '' ? 0 : parseInt(width, 10);
    const argn = ++ai;
    const arg = args[argn - 1];
    let s;
    const signed = (n, str) => (n < 0 || Object.is(n, -0) ? str : (plus ? '+' + str : (space ? ' ' + str : str)));
    switch (conv) {
      case 'd': case 'i': {
        const v = checkNum(arg, argn + 1, 'format'); let n = v < 0 ? Math.ceil(v) : Math.floor(v);
        let digits = Math.abs(n).toFixed(0); if (!isFinite(n)) digits = n !== n ? 'nan' : 'inf';
        if (prec !== null) digits = digits.padStart(prec, '0');
        s = (n < 0 ? '-' : plus ? '+' : space ? ' ' : '') + digits;
        s = pad(s, w, left, zero && prec === null); break;
      }
      case 'u': { const n = Math.floor(checkNum(arg, argn + 1, 'format')); s = pad(String(n < 0 ? n + 4294967296 : n), w, left, zero); break; }
      case 'c': s = pad(String.fromCharCode(checkNum(arg, argn + 1, 'format')), w, left, false); break;
      case 'x': case 'X': case 'o': {
        let n = Math.floor(checkNum(arg, argn + 1, 'format')); if (n < 0) n += 4294967296;
        let t = n.toString(conv === 'o' ? 8 : 16); if (conv === 'X') t = t.toUpperCase();
        if (prec !== null) t = t.padStart(prec, '0');
        if (alt && n !== 0) t = (conv === 'o' ? '0' : conv === 'x' ? '0x' : '0X') + t;
        s = pad(t, w, left, zero && prec === null); break;
      }
      case 'e': case 'E': {
        const n = checkNum(arg, argn + 1, 'format');
        if (!isFinite(n)) s = signed(n, fmtG(n, 6, false, conv === 'E'));
        else { let t = n.toExponential(prec === null ? 6 : prec).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') t = t.toUpperCase(); s = signed(n, t); }
        s = pad(s, w, left, zero && isFinite(n)); break;
      }
      case 'f': case 'F': {
        const n = checkNum(arg, argn + 1, 'format');
        if (!isFinite(n)) s = signed(n, fmtG(n, 6));
        else {
          let t = Math.abs(n) >= 1e21 ? BigInt(Math.round(Math.abs(n))).toString() + (prec === 0 ? '' : '.' + '0'.repeat(prec === null ? 6 : prec)) : Math.abs(n).toFixed(prec === null ? 6 : Math.min(prec, 100));
          if (alt && prec === 0) t += '.';
          s = (n < 0 || Object.is(n, -0) ? '-' : plus ? '+' : space ? ' ' : '') + t;
        }
        s = pad(s, w, left, zero && isFinite(n)); break;
      }
      case 'g': case 'G': {
        const n = checkNum(arg, argn + 1, 'format');
        s = signed(n, fmtG(n, prec === null ? 6 : prec, alt, conv === 'G'));
        s = pad(s, w, left, zero && isFinite(n)); break;
      }
      case 'q': {
        const t = checkStr(arg, argn + 1, 'format');
        s = '"' + t.replace(/[\\"\n\r\0]/g, m => m === '\n' ? '\\\n' : m === '\r' ? '\\r' : m === '\0' ? '\\000' : '\\' + m) + '"'; break;
      }
      case 's': {
        if (argn > args.length && arg === undefined) throw argErr(argn + 1, 'format', 'string expected, got no value');
        let t = tostr(arg); if (prec !== null) t = t.slice(0, prec); s = pad(t, w, left, false); break;
      }
      default: throw rterr("invalid option '%" + (conv === undefined ? '' : conv) + "' to 'format'");
    }
    out += s;
  }
  return out;
}

// ------------------------------------------------------------------ os.date
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function p2(n) { return n < 10 ? '0' + n : String(n); }
function osDate(fmt, t) {
  fmt = fmt === undefined ? '%c' : checkStr(fmt, 1, 'date');
  const time = t === undefined ? Math.floor(Date.now() / 1000) : checkNum(t, 2, 'date');
  const utc = fmt[0] === '!'; if (utc) fmt = fmt.slice(1);
  const d = new Date(time * 1000);
  const g = utc ? { Y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), S: d.getUTCSeconds(), w: d.getUTCDay() }
    : { Y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), H: d.getHours(), M: d.getMinutes(), S: d.getSeconds(), w: d.getDay() };
  const start = utc ? Date.UTC(g.Y, 0, 1) : new Date(g.Y, 0, 1).getTime();
  const cur = utc ? Date.UTC(g.Y, g.m, g.d) : new Date(g.Y, g.m, g.d).getTime();
  const yday = Math.round((cur - start) / 86400000) + 1;
  if (fmt.slice(0, 2) === '*t') {
    const r = new LuaTable();
    r.set('year', g.Y); r.set('month', g.m + 1); r.set('day', g.d); r.set('hour', g.H); r.set('min', g.M); r.set('sec', g.S); r.set('wday', g.w + 1); r.set('yday', yday); r.set('isdst', false);
    return r;
  }
  return fmt.replace(/%(.)/g, (m, c) => {
    switch (c) {
      case 'a': return DAYS[g.w].slice(0, 3); case 'A': return DAYS[g.w];
      case 'b': case 'h': return MONTHS[g.m].slice(0, 3); case 'B': return MONTHS[g.m];
      case 'c': return DAYS[g.w].slice(0, 3) + ' ' + MONTHS[g.m].slice(0, 3) + ' ' + String(g.d).padStart(2, ' ') + ' ' + p2(g.H) + ':' + p2(g.M) + ':' + p2(g.S) + ' ' + g.Y;
      case 'd': return p2(g.d); case 'e': return String(g.d).padStart(2, ' ');
      case 'H': return p2(g.H); case 'I': return p2(g.H % 12 || 12); case 'j': return String(yday).padStart(3, '0');
      case 'm': return p2(g.m + 1); case 'M': return p2(g.M); case 'p': return g.H < 12 ? 'AM' : 'PM';
      case 'S': return p2(g.S); case 'w': return String(g.w); case 'y': return p2(g.Y % 100); case 'Y': return String(g.Y);
      case 'x': case 'D': return p2(g.m + 1) + '/' + p2(g.d) + '/' + p2(g.Y % 100);
      case 'X': case 'T': return p2(g.H) + ':' + p2(g.M) + ':' + p2(g.S);
      case 'F': return g.Y + '-' + p2(g.m + 1) + '-' + p2(g.d);
      case 'Z': return utc ? 'UTC' : 'LOCAL'; case 'z': return '+0000'; case '%': return '%'; case 'n': return '\n'; case 't': return '\t';
      default: return m;
    }
  });
}
function osTime(t) {
  if (t === undefined) return Math.floor(Date.now() / 1000);
  checkTable(t, 1, 'time');
  const f = (k, d) => { const v = t.get(k); if (v === undefined) { if (d === undefined) throw rterr("field '" + k + "' missing in date table"); return d; } return tonum(v); };
  return Math.floor(new Date(f('year'), f('month') - 1, f('day'), f('hour', 12), f('min', 0), f('sec', 0)).getTime() / 1000);
}

// ------------------------------------------------------------------ PRNG
function makeRandom() {
  let s = 0x2545F491 ^ (Date.now() & 0xffffffff);
  function next() { // xorshift32 -> [0,1)
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  }
  return { next, seed(v) { s = (Math.floor(v) >>> 0) || 1; for (let i = 0; i < 4; i++) next(); } };
}

// ------------------------------------------------------------------ install
Lua.Interp.installLibs = function (L) {
  const G = L.globals;
  const def = (t, name, f) => { f.isBuiltin = true; t.set(name, f); return f; };
  const lib = name => { const t = new LuaTable(); G.set(name, t); return t; };
  L.stdout = (s) => { if (typeof process !== 'undefined' && process.stdout) process.stdout.write(s); else console.log(s); };

  G.set('_G', G); G.set('_VERSION', 'Lua 5.1');
  def(G, 'print', (...a) => { L.stdout(a.map(tostr).join('\t') + '\n'); });
  def(G, 'type', (...a) => { if (a.length === 0) throw argErr(1, 'type', 'value expected'); return type(a[0]); });
  def(G, 'tostring', v => tostr(v));
  def(G, 'tonumber', (v, base) => {
    if (base === undefined || base === 10 && false) return tonum(v) === undefined ? undefined : (typeof v === 'number' ? v : tonum(v));
    base = checkInt(base, 2, 'tonumber'); const s = checkStr(v, 1, 'tonumber').trim().toLowerCase();
    if (!s || !/^[0-9a-z]+$/.test(s)) return undefined;
    let r = 0; for (const ch of s) { const d = parseInt(ch, 36); if (d >= base) return undefined; r = r * base + d; } return r;
  });
  def(G, 'ipairs', t => { checkTable(t, 1, 'ipairs'); const it = (tt, i) => { i = i + 1; const v = tt.get(i); return v === undefined ? undefined : [i, v]; }; return [it, t, 0]; });
  const next = def(G, 'next', (t, k) => { checkTable(t, 1, 'next'); return t.next(k); });
  def(G, 'pairs', t => { checkTable(t, 1, 'pairs'); const mm = t.meta && t.meta.getStr('__pairs'); if (mm) return mm(t); return [next, t, undefined]; });
  def(G, 'rawget', (t, k) => checkTable(t, 1, 'rawget').get(k));
  def(G, 'rawset', (t, k, v) => { checkTable(t, 1, 'rawset').set(k, v); return t; });
  def(G, 'rawequal', (a, b) => a === b);
  def(G, 'setmetatable', (t, m) => { checkTable(t, 1, 'setmetatable'); if (m !== undefined && !(m instanceof LuaTable)) throw argErr(2, 'setmetatable', 'nil or table expected'); if (t.meta && t.meta.getStr('__metatable') !== undefined) throw rterr('cannot change a protected metatable'); t.meta = m; return t; });
  def(G, 'getmetatable', v => { const m = U.getmeta(v); if (m) { const p = m.getStr('__metatable'); if (p !== undefined) return p; } return m; });
  def(G, 'assert', (...a) => { if (!U.truthy(a[0])) { if (a.length > 1 && a[1] !== undefined) throw new LuaError(a[1]); throw rterr('assertion failed!'); } return a; });
  def(G, 'error', (msg, level) => {
    level = level === undefined ? 1 : level;
    if (typeof msg === 'string' && level > 0) msg = S.chunk + ':' + S.ln + ': ' + msg;
    throw new LuaError(msg);
  });
  def(G, 'pcall', (f, ...a) => {
    const depth = S.ln;
    try { return [true].concat(U.$m(U.callable(f)(...a))); }
    catch (e) {
      if (e instanceof LuaError) return [false, e.value];
      if (e instanceof RangeError) return [false, 'stack overflow'];
      throw e;
    }
  });
  def(G, 'xpcall', (f, h) => {
    try { return [true].concat(U.$m(U.callable(f)())); }
    catch (e) {
      if (e instanceof LuaError) return [false].concat(U.$m(h(e.value)));
      if (e instanceof RangeError) return [false].concat(U.$m(h('stack overflow')));
      throw e;
    }
  });
  def(G, 'select', (n, ...a) => {
    if (n === '#') return a.length;
    n = checkInt(n, 1, 'select');
    if (n < 0) n = a.length + n; else n = n - 1;
    if (n < 0) throw argErr(1, 'select', 'index out of range');
    return a.slice(n);
  });
  def(G, 'unpack', (t, i, j) => { checkTable(t, 1, 'unpack'); i = i === undefined ? 1 : i; j = j === undefined ? t.length() : j; const r = []; for (let k = i; k <= j; k++) r.push(t.get(k)); return r; });
  def(G, 'loadstring', (s, name) => { try { return L.compile(checkStr(s, 1, 'loadstring'), name || s.slice(0, 20)); } catch (e) { if (e instanceof LuaError) return [undefined, e.value]; throw e; } });
  def(G, 'collectgarbage', (opt) => opt === 'count' ? 100 : 0);
  def(G, 'getfenv', () => G); def(G, 'setfenv', f => f);
  def(G, 'dofile', () => { throw rterr('dofile not supported'); });
  def(G, 'require', () => { throw rterr('require not supported'); });

  // string
  const str = lib('string');
  const sm = new LuaTable(); sm.set('__index', str); S.stringMeta = sm;
  def(str, 'len', s => checkStr(s, 1, 'len').length);
  def(str, 'sub', (s, i, j) => {
    s = checkStr(s, 1, 'sub'); const l = s.length;
    let a = posrelat(checkInt(i, 2, 'sub', 1), l), b = posrelat(checkInt(j, 3, 'sub', -1), l);
    if (a < 1) a = 1; if (b > l) b = l; return a > b ? '' : s.slice(a - 1, b);
  });
  def(str, 'upper', s => checkStr(s, 1, 'upper').toUpperCase());
  def(str, 'lower', s => checkStr(s, 1, 'lower').toLowerCase());
  def(str, 'rep', (s, n) => { s = checkStr(s, 1, 'rep'); n = checkInt(n, 2, 'rep'); return n > 0 ? s.repeat(n) : ''; });
  def(str, 'reverse', s => checkStr(s, 1, 'reverse').split('').reverse().join(''));
  def(str, 'byte', (s, i, j) => { s = checkStr(s, 1, 'byte'); const l = s.length; let a = posrelat(checkInt(i, 2, 'byte', 1), l); let b = j === undefined ? a : posrelat(checkInt(j, 3, 'byte'), l); if (a < 1) a = 1; if (b > l) b = l; const r = []; for (let k = a; k <= b; k++) r.push(s.charCodeAt(k - 1)); return r; });
  def(str, 'char', (...a) => a.map((c, i) => String.fromCharCode(checkInt(c, i + 1, 'char'))).join(''));
  def(str, 'format', format);
  def(str, 'find', (s, p, i, plain) => strFind(s, p, i, plain, true, 'find'));
  def(str, 'match', (s, p, i) => strFind(s, p, i, false, false, 'match'));
  def(str, 'gmatch', gmatch);
  def(str, 'gsub', (s, p, r, n) => gsub(L, s, p, r, n));

  // table
  const tab = lib('table');
  def(tab, 'insert', (...a) => {
    const t = checkTable(a[0], 1, 'insert'); const n = t.length();
    if (a.length === 2) t.set(n + 1, a[1]);
    else if (a.length === 3) { const pos = checkInt(a[1], 2, 'insert'); for (let i = n; i >= pos; i--) t.set(i + 1, t.get(i)); t.set(pos, a[2]); }
    else throw rterr("wrong number of arguments to 'insert'");
  });
  def(tab, 'remove', (t, pos) => {
    checkTable(t, 1, 'remove'); const n = t.length(); pos = pos === undefined ? n : checkInt(pos, 2, 'remove');
    if (n === 0 && pos === 0) return undefined; if (pos < 1 || pos > n + 1) return undefined;
    const v = t.get(pos); for (let i = pos; i < n; i++) t.set(i, t.get(i + 1)); if (pos <= n) t.set(n, undefined); return v;
  });
  def(tab, 'concat', (t, sep, i, j) => {
    checkTable(t, 1, 'concat'); sep = sep === undefined ? '' : checkStr(sep, 2, 'concat');
    i = i === undefined ? 1 : checkInt(i, 3, 'concat'); j = j === undefined ? t.length() : checkInt(j, 4, 'concat');
    const parts = [];
    for (let k = i; k <= j; k++) { const v = t.get(k); if (typeof v !== 'string' && typeof v !== 'number') throw rterr("invalid value (at index " + k + ") in table for 'concat'"); parts.push(tostr(v)); }
    return parts.join(sep);
  });
  def(tab, 'sort', (t, cmp) => {
    checkTable(t, 1, 'sort'); const n = t.length(); const a = []; for (let i = 1; i <= n; i++) a.push(t.get(i));
    const lt = cmp === undefined ? U.lt : (x, y) => U.truthy(U.$1(cmp(x, y)));
    a.sort((x, y) => lt(x, y) ? -1 : (lt(y, x) ? 1 : 0));
    for (let i = 0; i < n; i++) t.set(i + 1, a[i]);
  });
  def(tab, 'maxn', t => { let m = 0; for (const k of checkTable(t, 1, 'maxn').keys()) if (typeof k === 'number' && k > m) m = k; return m; });
  def(tab, 'getn', t => checkTable(t, 1, 'getn').length());
  def(tab, 'setn', () => { });
  def(tab, 'foreach', (t, f) => { for (const k of t.keys()) { const r = U.$1(f(k, t.get(k))); if (r !== undefined) return r; } });
  def(tab, 'foreachi', (t, f) => { const n = t.length(); for (let i = 1; i <= n; i++) { const r = U.$1(f(i, t.get(i))); if (r !== undefined) return r; } });

  // math
  const m = lib('math'); const rnd = makeRandom();
  m.set('pi', Math.PI); m.set('huge', Infinity);
  const m1 = (name, f) => def(m, name, x => f(checkNum(x, 1, name)));
  m1('abs', Math.abs); m1('ceil', Math.ceil); m1('floor', Math.floor); m1('sqrt', Math.sqrt); m1('sin', Math.sin); m1('cos', Math.cos); m1('tan', Math.tan);
  m1('asin', Math.asin); m1('acos', Math.acos); m1('atan', Math.atan); m1('sinh', Math.sinh); m1('cosh', Math.cosh); m1('tanh', Math.tanh);
  m1('exp', Math.exp); m1('log', Math.log); m1('log10', Math.log10); m1('deg', x => x * 180 / Math.PI); m1('rad', x => x * Math.PI / 180);
  def(m, 'atan2', (y, x) => Math.atan2(checkNum(y, 1, 'atan2'), checkNum(x, 2, 'atan2')));
  def(m, 'pow', (x, y) => Math.pow(checkNum(x, 1, 'pow'), checkNum(y, 2, 'pow')));
  def(m, 'fmod', (x, y) => checkNum(x, 1, 'fmod') % checkNum(y, 2, 'fmod'));
  def(m, 'modf', x => { x = checkNum(x, 1, 'modf'); const i = x < 0 ? Math.ceil(x) : Math.floor(x); return [i, isFinite(x) ? x - i : 0]; });
  def(m, 'frexp', x => { x = checkNum(x, 1, 'frexp'); if (x === 0 || !isFinite(x)) return [x, 0]; let e = Math.max(-1023, Math.floor(Math.log2(Math.abs(x))) + 1); let f = x * Math.pow(2, -e); while (Math.abs(f) < 0.5) { f *= 2; e--; } while (Math.abs(f) >= 1) { f /= 2; e++; } return [f, e]; });
  def(m, 'ldexp', (x, e) => checkNum(x, 1, 'ldexp') * Math.pow(2, checkInt(e, 2, 'ldexp')));
  def(m, 'min', (...a) => { let r = checkNum(a[0], 1, 'min'); for (let i = 1; i < a.length; i++) r = Math.min(r, checkNum(a[i], i + 1, 'min')); return r; });
  def(m, 'max', (...a) => { let r = checkNum(a[0], 1, 'max'); for (let i = 1; i < a.length; i++) r = Math.max(r, checkNum(a[i], i + 1, 'max')); return r; });
  def(m, 'random', (a, b) => {
    const r = rnd.next();
    if (a === undefined) return r;
    a = checkInt(a, 1, 'random');
    if (b === undefined) { if (a < 1) throw argErr(1, 'random', 'interval is empty'); return Math.floor(r * a) + 1; }
    b = checkInt(b, 2, 'random'); if (a > b) throw argErr(2, 'random', 'interval is empty'); return Math.floor(r * (b - a + 1)) + a;
  });
  def(m, 'randomseed', x => { rnd.seed(checkNum(x, 1, 'randomseed')); });

  // os / io
  const os = lib('os');
  def(os, 'time', osTime); def(os, 'date', osDate); def(os, 'clock', () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000);
  def(os, 'getenv', () => undefined); def(os, 'difftime', (a, b) => checkNum(a, 1, 'difftime') - checkNum(b, 2, 'difftime'));
  const io = lib('io'); def(io, 'write', (...a) => { L.stdout(a.map(x => checkStr(x, 1, 'write')).join('')); });
};
})();
