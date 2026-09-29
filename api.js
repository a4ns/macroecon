/* AMS Lua API emulation */
(function () {
'use strict';
const AMS = window.AMS, L = AMS.L, Lua = window.Lua, P = AMS.P;
const U = Lua.util, tostr = U.tostr, LT = Lua.LuaTable;
const num = v => (typeof v === 'number' ? v : (U.tonum(v) || 0));
const find = (n, c) => AMS.findObj(n, c);
const def = (name, fns) => L.defineTable(name, fns);
const px = n => n + 'px';
const fileUrl = s => (s || '').replace(/\\/g, '/').replace(/^.*?AutoPlay\//, '');

// generic per-class functions
function common(cls) {
  const fns = {
    SetVisible: (n, v) => { const o = find(n, cls); if (o) { o.visible = !!v && v !== undefined; o.el.style.display = o.visible ? '' : 'none'; } },
    GetVisible: n => { const o = find(n, cls); return o ? o.visible : false; },
    IsVisible: n => { const o = find(n, cls); return o ? o.visible : false; },
    SetEnabled: (n, v) => { const o = find(n, cls); if (o) { o.enabled = !!v; o.el.classList.toggle('disabled', !v); if (o.input) o.input.disabled = !v; if (o.render) o.render(); } },
    GetEnabled: n => { const o = find(n, cls); return o ? o.enabled : false; },
    IsEnabled: n => { const o = find(n, cls); return o ? o.enabled : false; },
    SetPos: (n, x, y) => { const o = find(n, cls); if (o) { const w = o.rect[2] - o.rect[0], h = o.rect[3] - o.rect[1]; o.rect = [num(x), num(y), num(x) + w, num(y) + h]; o.el.style.left = px(num(x)); o.el.style.top = px(num(y)); } },
    GetPos: n => { const o = find(n, cls); return o ? L.toLua({ X: o.rect[0], Y: o.rect[1] }) : undefined; },
    SetSize: (n, w, h) => { const o = find(n, cls); if (o) { o.rect[2] = o.rect[0] + num(w); o.rect[3] = o.rect[1] + num(h); o.el.style.width = px(num(w)); o.el.style.height = px(num(h)); } },
    GetSize: n => { const o = find(n, cls); return o ? L.toLua({ Width: o.rect[2] - o.rect[0], Height: o.rect[3] - o.rect[1] }) : undefined; },
  };
  return fns;
}
const textOf = (o) => o.cls === 'Input' ? o.input.value : (o.textValue !== undefined ? o.textValue : (o.txt ? o.txt.textContent : ''));

// ---- Paragraph
const PP = common('Paragraph');
Object.assign(PP, {
  SetText: (n, t) => { const o = find(n, 'Paragraph'); if (o && t !== undefined && t !== null) o.setText(tostr(t)); },
  GetText: n => { const o = find(n, 'Paragraph'); return o ? (o.textValue || '') : ''; },
  SetProperties: (n, t) => {
    const o = find(n, 'Paragraph'); if (!o || !(t instanceof LT)) return;
    for (const k of t.keys()) {
      const v = t.get(k);
      switch (k) {
        case 'Text': o.setText(tostr(v)); break;
        case 'FontWeight': o.props.weight = num(v); break;
        case 'BorderStyle': o.props.borderStyle = num(v); break;
        case 'BorderColor': o.props.border = AMS.colorStr(v); break;
        case 'ColorNormal': case 'FontColor': o.props.color = AMS.colorStr(v); break;
        case 'BackgroundColor': o.props.bg = AMS.colorStr(v); break;
        case 'Opaque': o.props.opaque = !!v; break;
        case 'FontSize': o.el.style.fontSize = px(Math.round(num(v) * 4 / 3)); break;
        case 'FontName': o.el.style.fontFamily = tostr(v); break;
        case 'FontItalic': o.el.style.fontStyle = v ? 'italic' : 'normal'; break;
        case 'FontUnderline': o.el.style.textDecoration = v ? 'underline' : 'none'; break;
        case 'Visible': o.visible = !!v; o.el.style.display = v ? '' : 'none'; break;
        case 'Enabled': o.enabled = !!v; break;
      }
    }
    o.refresh();
  },
  GetProperties: n => { const o = find(n, 'Paragraph'); return o ? L.toLua({ Text: o.textValue || '' }) : undefined; },
});
def('Paragraph', PP);
const LB = common('Label');
Object.assign(LB, {
  SetText: (n, t) => { const o = find(n, 'Label'); if (o && t !== undefined && t !== null) o.setText(tostr(t)); },
  GetText: n => { const o = find(n, 'Label'); return o ? (o.textValue || '') : ''; },
  SetProperties: PP.SetProperties,
});
def('Label', LB);
def('Image', Object.assign(common('Image'), {
  SetImage: (n, p) => { const o = find(n, 'Image'); if (o) o.img.src = fileUrl(p); },
  Load: (n, p) => { const o = find(n, 'Image'); if (o) o.img.src = fileUrl(p); },
}));
def('Hotspot', common('Hotspot'));
const IN = common('Input');
Object.assign(IN, {
  SetText: (n, t) => { const o = find(n, 'Input'); if (o && t !== undefined && t !== null) o.input.value = tostr(t); },
  GetText: n => { const o = find(n, 'Input'); return o ? o.input.value : ''; },
  SetSelection: () => { }, SetFocus: n => { const o = find(n, 'Input'); if (o) o.input.focus(); },
});
def('Input', IN);
def('Button', Object.assign(common('Button'), {
  SetText: (n, t) => { const o = find(n, 'Button'); if (o) o.setText(tostr(t)); },
  GetText: n => { const o = find(n, 'Button'); return o ? o.txt.textContent : ''; },
  SetProperties: () => { },
}));
def('xButton', Object.assign(common('xButton'), {
  SetText: (n, t) => { const o = find(n, 'xButton'); if (o) o.setText(tostr(t)); },
  GetText: n => { const o = find(n, 'xButton'); return o && o.txt ? o.txt.textContent : ''; },
}));
def('Web', Object.assign(common('Web'), {
  LoadURL: (n, u) => { const o = find(n, 'Web'); if (o) o.frame.src = fileUrl(tostr(u)); },
  Print: (n) => { const o = find(n, 'Web'); try { o.frame.contentWindow.focus(); o.frame.contentWindow.print(); } catch (e) { window.print(); } },
  GetURL: n => { const o = find(n, 'Web'); return o ? o.frame.src : ''; },
  Back: () => { }, Forward: () => { }, Stop: () => { }, Refresh: () => { },
}));
def('CheckBox', Object.assign(common('CheckBox'), {
  GetChecked: n => { const o = find(n, 'CheckBox'); return o ? o.input.checked : false; },
  SetChecked: (n, v) => { const o = find(n, 'CheckBox'); if (o) o.input.checked = !!v; },
}));
def('RadioButton', Object.assign(common('RadioButton'), {
  GetChecked: n => { const o = find(n, 'RadioButton'); return o ? o.input.checked : false; },
  SetChecked: (n, v) => { const o = find(n, 'RadioButton'); if (o) o.input.checked = !!v; },
}));
def('ComboBox', Object.assign(common('ComboBox'), {
  GetSelected: n => { const o = find(n, 'ComboBox'); return o ? o.input.selectedIndex + 1 || -1 : -1; },
  SetSelected: (n, i) => { const o = find(n, 'ComboBox'); if (o) o.input.selectedIndex = num(i) - 1; },
  GetCount: n => { const o = find(n, 'ComboBox'); return o ? o.items.length : 0; },
  GetItemText: (n, i) => { const o = find(n, 'ComboBox'); const it = o && o.items[num(i) - 1]; return it ? it.text : ''; },
  GetItemData: (n, i) => { const o = find(n, 'ComboBox'); const it = o && o.items[num(i) - 1]; return it ? it.data : ''; },
  SetItemData: (n, i, d) => { const o = find(n, 'ComboBox'); const it = o && o.items[num(i) - 1]; if (it) it.data = tostr(d); },
  SetItemText: (n, i, t) => { const o = find(n, 'ComboBox'); const it = o && o.items[num(i) - 1]; if (it) { it.text = tostr(t); o.sync(); } },
  GetText: n => { const o = find(n, 'ComboBox'); const i = o ? o.input.selectedIndex : -1; return i >= 0 ? o.items[i].text : ''; },
  InsertItem: (n, i, t, d) => {
    const o = find(n, 'ComboBox'); if (!o) return -1;
    i = num(i); const it = { text: tostr(t), data: d === undefined ? '' : tostr(d) };
    if (i <= 0 || i > o.items.length) { o.items.push(it); i = o.items.length; } else o.items.splice(i - 1, 0, it);
    o.sync(); return i;
  },
  DeleteItem: (n, i) => { const o = find(n, 'ComboBox'); if (o) { o.items.splice(num(i) - 1, 1); o.sync(); } },
  ResetContent: n => { const o = find(n, 'ComboBox'); if (o) { o.items = []; o.sync(); } },
  FindItem: (n, t) => { const o = find(n, 'ComboBox'); return o ? o.items.findIndex(x => x.text === tostr(t)) + 1 || -1 : -1; },
}));
def('SlideShow', Object.assign(common('SlideShow'), {
  GoToSlide: (n, i) => { const o = find(n, 'SlideShow'); if (o) o.go(num(i)); },
  GetCurrentSlide: n => { const o = find(n, 'SlideShow'); return o ? o.idx : 0; },
  Play: n => { const o = find(n, 'SlideShow'); if (o) o.play(); },
  Pause: n => { const o = find(n, 'SlideShow'); if (o) o.pause(); },
  Stop: n => { const o = find(n, 'SlideShow'); if (o) o.pause(); },
  Next: n => { const o = find(n, 'SlideShow'); if (o) o.go(o.idx + 1); },
  Previous: n => { const o = find(n, 'SlideShow'); if (o) o.go(o.idx - 1); },
}));
def('Grid', Object.assign(common('Grid'), {
  SetCellText: (n, r, c, t) => { const o = find(n, 'Grid'); const row = o && o.cells[num(r)]; if (row && row[num(c)]) row[num(c)].textContent = tostr(t); },
  GetCellText: (n, r, c) => { const o = find(n, 'Grid'); const row = o && o.cells[num(r)]; return row && row[num(c)] ? row[num(c)].textContent : ''; },
  SetCellFont: (n, r, c, props) => {
    const o = find(n, 'Grid'); const row = o && o.cells[num(r)]; const td = row && row[num(c)]; if (!td || !(props instanceof LT)) return;
    const g = k => props.get(k);
    if (g('FontName')) td.style.fontFamily = tostr(g('FontName')); if (g('FontSize')) td.style.fontSize = px(Math.round(num(g('FontSize')) * 4 / 3));
    if (g('FontColor') !== undefined) td.style.color = AMS.colorStr(g('FontColor')); if (g('FontWeight')) td.style.fontWeight = num(g('FontWeight')) >= 600 ? 'bold' : 'normal';
  },
  SaveToFile: () => { }, SetSelectedCell: () => { }, GetSelectedCell: () => undefined,
}));

// ---- Page
def('Page', {
  Jump: n => { setTimeout(() => AMS.jump(tostr(n)), 0); },
  Navigate: d => { setTimeout(() => AMS.navigate(num(d)), 0); },
  StartTimer: ms => AMS.startTimer(num(ms)), StopTimer: () => AMS.stopTimer(),
  ClickObject: n => { const o = find(n); if (o) AMS.fire(o, 'On Click'); },
  Print: () => { window.print(); },
  GetSize: () => L.toLua({ Width: 800, Height: 600 }),
  GetObjectNames: () => { const c = AMS.curCtx(); return L.toLua([...c.objs.keys()]); },
  CreateObject: (type, name, props) => {
    if (num(type) !== 6 || !(props instanceof LT)) return '';
    const g = k => props.get(k), c = AMS.curCtx();
    const def = { cls: 'Web', name: tostr(name), rect: [num(g('X')), num(g('Y')), num(g('X')) + num(g('Width')), num(g('Y')) + num(g('Height'))], url: g('URL') ? tostr(g('URL')) : '', events: {}, enabled: true, visible: true };
    AMS.createObj(c, def, c.el); return tostr(name);
  }, DeleteObject: n => { const o = find(n); if (o) { o.el.remove(); AMS.curCtx().objs.delete(n); } },
  GetFocus: () => '', SetFocus: () => { },
});
def('Application', {
  GetWndHandle: () => 1, GetLastError: () => AMS.lastError, Exit: () => { }, Minimize: () => { }, Maximize: () => { }, Restore: () => { },
  GetPageNames: () => L.toLua(P.pageorder), GetCurrentPage: () => AMS.page.name, GetPageCount: () => P.pageorder.length,
  LoadScript: () => { }, Sleep: () => { }, SetLastError: e => { AMS.lastError = num(e); }, GetInstalledApp: () => '', SetTitle: t => { document.title = tostr(t); },
});
def('Dialog', {
  Message: (t, m, b, i) => AMS.message(tostr(t), tostr(m), num(b), num(i)),
  TimedMessage: (t, m) => AMS.message(tostr(t), tostr(m), 0, 0), Input: () => '', SplashImage: () => { }, PopupMenu: () => -1,
});
def('DialogEx', {
  Show: n => { setTimeout(() => AMS.showDialog(tostr(n)), 0); return 0; },
  Close: () => { setTimeout(() => AMS.closeDialog(), 0); },
  GetSize: () => L.toLua({ Width: 760, Height: 430 }), SetSize: () => { }, SetPos: () => { },
});
def('Audio', {
  Load: (ch, p, play, loop) => { try { AMS.audio && AMS.audio.pause(); const a = new Audio(fileUrl(tostr(p))); a.loop = !!loop; AMS.audio = a; if (play) a.play().catch(() => { }); } catch (e) { } },
  Play: () => { try { AMS.audio && AMS.audio.play().catch(() => { }); } catch (e) { } }, Pause: () => { AMS.audio && AMS.audio.pause(); },
  Stop: () => { if (AMS.audio) { AMS.audio.pause(); AMS.audio.currentTime = 0; } }, SetVolume: () => { }, GetState: () => 'Stopped',
});
def('File', { OpenURL: u => { window.open(tostr(u), '_blank'); }, Open: () => { }, Exists: () => false });
def('Shell', { Execute: () => 0 });

// ---- System
const p2 = n => (n < 10 ? '0' : '') + n;
def('System', {
  GetTime: f => { const d = new Date(); f = num(f); return f === 1 ? p2(d.getHours()) : f === 2 ? p2(d.getMinutes()) : f === 3 ? p2(d.getSeconds()) : p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); },
  GetDate: f => { const d = new Date(); f = num(f); if (f === 6 || f === 5) return String(Math.floor(d.getTime() / 86400000) + 2440588); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); },
});

// ---- Math / String / Table
const M = L.getGlobal('math');
def('Math', {
  Round: (x, p) => { x = num(x); const m = Math.pow(10, num(p)); return Math.sign(x) * Math.round(Math.abs(x) * m + 1e-9) / m; },
  Random: (a, b) => { a = a === undefined ? 1 : num(a); b = num(b); if (a > b) { const t = a; a = b; b = t; } return Math.floor(Math.random() * (b - a + 1)) + a; }, RandomSeed: s => { },
  Pow: (a, b) => Math.pow(num(a), num(b)), Max: (a, b) => Math.max(num(a), num(b)), Min: (a, b) => Math.min(num(a), num(b)),
  Floor: a => Math.floor(num(a)), Ceil: a => Math.ceil(num(a)), Abs: a => Math.abs(num(a)), Sqrt: a => Math.sqrt(num(a)),
  Log: a => Math.log(num(a)), Log10: a => Math.log10(num(a)), Exp: a => Math.exp(num(a)), Sin: a => Math.sin(num(a)), Cos: a => Math.cos(num(a)), Tan: a => Math.tan(num(a)),
  HexColorToNumber: h => { h = tostr(h).replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return r + g * 256 + b * 65536; },
  NumberToHexColor: n => { n = num(n); return [n & 255, (n >> 8) & 255, (n >> 16) & 255].map(x => ('0' + x.toString(16)).slice(-2)).join('').toUpperCase(); },
  Sign: a => Math.sign(num(a)), Mod: (a, b) => num(a) % num(b),
});
def('String', {
  ToNumber: s => { const n = U.tonum(tostr(s)); return n === undefined ? 0 : n; },
  Length: s => tostr(s).length, Left: (s, n) => tostr(s).slice(0, num(n)), Right: (s, n) => { s = tostr(s); n = num(n); return n <= 0 ? '' : s.slice(-n); },
  Mid: (s, st, n) => tostr(s).substr(num(st) - 1, num(n)), Upper: s => tostr(s).toUpperCase(), Lower: s => tostr(s).toLowerCase(),
  Find: (s, sub, st, cs) => { s = tostr(s); sub = tostr(sub); st = st === undefined ? 1 : num(st); if (!cs) { s = s.toLowerCase(); sub = sub.toLowerCase(); } const i = s.indexOf(sub, st - 1); return i < 0 ? -1 : i + 1; },
  Replace: (s, a, b) => tostr(s).split(tostr(a)).join(tostr(b)), TrimLeft: s => tostr(s).replace(/^\s+/, ''), TrimRight: s => tostr(s).replace(/\s+$/, ''),
  Concat: (a, b) => tostr(a) + tostr(b), Repeat: (s, n) => tostr(s).repeat(num(n)), ToString: s => tostr(s),
  Compare: (a, b) => { a = tostr(a); b = tostr(b); return a < b ? -1 : a > b ? 1 : 0; }, Char: n => String.fromCharCode(num(n)), Asc: s => tostr(s).charCodeAt(0),
});
def('Table', {
  Count: t => (t instanceof LT ? t.keys().length : 0),
  Insert: (t, pos, v) => { const n = t.length(); pos = num(pos); if (pos < 1 || pos > n + 1) pos = n + 1; for (let i = n; i >= pos; i--) t.set(i + 1, t.get(i)); t.set(pos, v); },
  Remove: (t, pos) => { const n = t.length(); pos = pos === undefined ? n : num(pos); const v = t.get(pos); for (let i = pos; i < n; i++) t.set(i, t.get(i + 1)); t.set(n, undefined); return v; },
  Concat: (t, sep, s, e) => { const a = []; for (let i = num(s) || 1; i <= (e === undefined || num(e) < 0 ? t.length() : num(e)); i++) a.push(tostr(t.get(i))); return a.join(sep === undefined ? '' : tostr(sep)); },
  Sort: (t, cmp) => { const n = t.length(); const a = []; for (let i = 1; i <= n; i++) a.push(t.get(i)); a.sort((x, y) => (typeof x === 'number' && typeof y === 'number') ? x - y : (tostr(x) < tostr(y) ? -1 : 1)); a.forEach((v, i) => t.set(i + 1, v)); },
});

// ---- XML
let xdoc = null;
function xnode(path) {
  if (!xdoc) return null; let n = xdoc;
  for (const seg of tostr(path).split('/')) {
    if (!seg) continue; const m = /^([^:]+)(?::(\d+))?$/.exec(seg); const nm = m[1], k = m[2] ? +m[2] : 1;
    if (n === xdoc && n.documentElement && n.documentElement.nodeName === nm) { n = n.documentElement; continue; }
    let c = 0, found = null;
    for (const ch of n.children) if (ch.nodeName === nm && ++c === k) { found = ch; break; }
    if (!found) return null; n = found;
  }
  return n;
}
def('XML', {
  Load: p => { const key = fileUrl(tostr(p)); const t = P.files[key] || P.files[key.replace(/\\/g, '/')]; if (t === undefined) { AMS.lastError = 1; return; } xdoc = new DOMParser().parseFromString(t.trim(), 'application/xml'); },
  Count: (p, tag) => { const n = xnode(p); if (!n) return 0; let c = 0; for (const ch of n.children) if (ch.nodeName === tostr(tag)) c++; return c; },
  GetValue: p => { const n = xnode(p); return n ? n.textContent : ''; },
  SetValue: (p, v) => { const n = xnode(p); if (n) n.textContent = tostr(v); },
  GetAttribute: (p, a) => { const n = xnode(p); return n && n.hasAttribute(tostr(a)) ? n.getAttribute(tostr(a)) : ''; },
  SetAttribute: (p, a, v) => { const n = xnode(p); if (n) n.setAttribute(tostr(a), tostr(v)); },
  RemoveAttribute: (p, a) => { const n = xnode(p); if (n) n.removeAttribute(tostr(a)); },
  GetElementXML: p => { const n = xnode(p); return n ? new XMLSerializer().serializeToString(n) : ''; },
});
// globals
L.setGlobal('_SourceFolder', '.'); L.setGlobal('_WindowsFolder', '.'); L.setGlobal('_DesktopFolder', '.');
})();
