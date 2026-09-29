/* AutoPlay Media Studio runtime emulation: stage, pages, objects, events */
(function () {
'use strict';
const P = window.PROJECT, Lua = window.Lua;
const L = new Lua.Interp();
const AMS = window.AMS = { L, P, page: null, dialogs: [], timers: {}, frames: {}, canvases: {}, history: [], histPos: -1, lastError: 0 };
const tostr = Lua.util.tostr;
const stage = document.getElementById('stage'); const wrap = document.getElementById('wrap');
const pageLayer = document.createElement('div'); pageLayer.className = 'layer'; stage.appendChild(pageLayer);
const overlay = document.createElement('div'); overlay.className = 'layer frames'; stage.appendChild(overlay);
const dlgLayer = document.createElement('div'); dlgLayer.className = 'layer dlgs'; stage.appendChild(dlgLayer);
AMS.pageLayer = pageLayer; AMS.overlay = overlay; AMS.dlgLayer = dlgLayer;

const px = n => n + 'px';
function fontCss(f, el) {
  if (!f) return;
  el.style.fontFamily = `"${f.face}", "Times New Roman", Times, serif`;
  el.style.fontSize = px(f.size);
  el.style.fontWeight = f.weight >= 600 ? 'bold' : 'normal';
  el.style.fontStyle = f.italic ? 'italic' : 'normal';
  el.style.textDecoration = [f.underline ? 'underline' : '', f.strike ? 'line-through' : ''].join(' ').trim() || 'none';
}
const num = v => (typeof v === 'number' ? v : (Lua.util.tonum(v) || 0));
function colorStr(n) { n = num(n) >>> 0; return '#' + [n & 255, (n >> 8) & 255, (n >> 16) & 255].map(x => ('0' + x.toString(16)).slice(-2)).join(''); }
AMS.colorStr = colorStr;
const fileUrl = s => (s || '').replace(/\\/g, '/').replace(/^.*?AutoPlay\//, '');

// ------------------------------------------------------------ script running
const cache = new Map();
function runScript(src, ctxName, evName, args) {
  if (!src || !src.trim()) return;
  let f = cache.get(src);
  try {
    if (!f) { f = L.compile(src, ctxName + ':' + evName); cache.set(src, f); }
    if (args) for (const k in args) L.setGlobal(k, args[k]);
    L.callSafe(f, []);
  } catch (e) {
    console.error('[script error]', ctxName, evName, e.message || e);
    AMS.lastError = 0;
  }
}
AMS.runScript = runScript;

// ------------------------------------------------------------ contexts (page / dialog)
function makeCtx(def, kind) { return { def, kind, name: def.name, objs: new Map(), list: [], el: null }; }
AMS.curCtx = () => AMS.dialogs.length ? AMS.dialogs[AMS.dialogs.length - 1] : AMS.page;
AMS.activeCtx = null; // context of currently running event (set by fire)
function findObj(name, cls) {
  const cs = [];
  if (AMS.activeCtx) cs.push(AMS.activeCtx);
  const top = AMS.curCtx(); if (top && cs.indexOf(top) < 0) cs.push(top);
  if (AMS.page && cs.indexOf(AMS.page) < 0) cs.push(AMS.page);
  for (const c of cs) {
    const o = c.objs.get(name);
    if (o && (!cls || o.cls === cls || (cls === 'Paragraph' && o.cls === 'Label'))) return o;
  }
  return null;
}
AMS.findObj = findObj;
function fire(obj, ev, args) {
  const src = obj.def.events && obj.def.events[ev];
  if (!src) return;
  const prev = AMS.activeCtx; AMS.activeCtx = obj.ctx;
  try { L.setGlobal('this', obj.name); runScript(src, obj.ctx.name + '/' + obj.name, ev, args); } finally { AMS.activeCtx = prev; }
}
function firePage(ctx, ev, args) {
  const src = ctx.def.events && ctx.def.events[ev];
  if (!src) return;
  const prev = AMS.activeCtx; AMS.activeCtx = ctx;
  try { runScript(src, ctx.name, ev, args); } finally { AMS.activeCtx = prev; }
}
AMS.fire = fire; AMS.firePage = firePage;

// ------------------------------------------------------------ object creation
function applyBox(o) {
  const r = o.rect, e = o.el;
  e.style.left = px(r[0]); e.style.top = px(r[1]); e.style.width = px(r[2] - r[0]); e.style.height = px(r[3] - r[1]);
}
function setVis(o, v) { o.visible = !!v; o.el.style.display = v ? '' : 'none'; }
function setEn(o, v) { o.enabled = !!v; o.el.classList.toggle('disabled', !v); if (o.input) o.input.disabled = !v; }

const COARSE = window.matchMedia && matchMedia('(pointer:coarse)').matches;
function noZoom(el, fs) { // iOS zooms into fields with font < 16px: render at 16px and scale down
  if (!COARSE || !fs || fs >= 16) return;
  const k = 16 / fs;
  el.style.fontSize = '16px'; el.style.width = (100 * k) + '%'; el.style.height = (100 * k) + '%';
  el.style.transform = `scale(${1 / k})`; el.style.transformOrigin = '0 0';
}
const MK = {};
MK.Paragraph = function (o) {
  const d = o.def, e = o.el;
  e.classList.add('para');
  const t = document.createElement('div'); t.className = 'ptext'; e.appendChild(t); o.text = t;
  o.props = { color: d.color, colorHover: d.colorHover, colorDown: d.colorDown, border: d.borderColor, bg: d.bg, opaque: d.opaque, weight: d.font ? d.font.weight : 400, borderStyle: 0 };
  o.setText = s => { t.textContent = s; o.textValue = s; };
  o.setText(d.text || '');
  fontCss(d.font, e);
  e.style.textAlign = ['left', 'center', 'right', 'justify'][d.align] || 'left';
  e.style.alignItems = ['flex-start', 'center', 'flex-end'][d.valign] || 'flex-start';
  e.style.whiteSpace = d.wrap === 0 ? 'pre' : 'pre-wrap';
  if (d.scroll) { e.style.overflowY = 'auto'; }
  o.refresh = function () {
    const p = o.props;
    e.style.color = p.color || '#000';
    e.style.background = (p.opaque && p.bg && p.bg !== '#c0c0c0') ? p.bg : 'transparent';
    e.style.fontWeight = p.weight >= 600 ? 'bold' : 'normal';
    e.style.boxShadow = p.borderStyle ? `inset 0 0 0 1px ${p.border || '#000'}` : 'none';
  };
  o.refresh();
  if (d.colorHover && d.colorHover !== d.color) {
    e.addEventListener('mouseenter', () => { e.style.color = o.props.colorHover; });
    e.addEventListener('mouseleave', () => { e.style.color = o.props.color || '#000'; });
  }
};
MK.Label = function (o) {
  MK.Paragraph(o); o.el.classList.add('label'); o.el.style.whiteSpace = 'pre';
  const d = o.def; o.props.opaque = !!d.bg && d.bg !== '#c0c0c0'; o.props.bg = d.bg; o.props.color = d.color; o.refresh();
  o.el.style.textAlign = 'left'; o.el.style.alignItems = 'center';
};
MK.Image = function (o) {
  const im = document.createElement('img'); im.src = o.def.img || ''; im.draggable = false; o.el.appendChild(im); o.img = im;
  im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'fill';
  o.el.classList.add('image');
};
MK.Web = function (o) {
  const f = document.createElement('iframe'); f.setAttribute('frameborder', '0'); f.style.width = '100%'; f.style.height = '100%'; f.style.border = '0'; f.style.background = '#fff';
  if (o.def.url) f.src = fileUrl(o.def.url);
  o.el.appendChild(f); o.frame = f;
};
MK.Hotspot = function (o) { o.el.classList.add('hotspot'); };
MK.Input = function (o) {
  const d = o.def, r = d.rect, h = r[3] - r[1];
  const multi = h > ((d.font ? d.font.size : 13) * 2.4);
  const i = document.createElement(multi ? 'textarea' : 'input'); if (!multi) i.type = 'text';
  i.value = d.text || ''; i.spellcheck = false;
  fontCss(d.font, i); i.style.color = d.color || '#000'; i.style.background = d.bg || '#fff';
  o.input = i; o.el.appendChild(i); o.el.classList.add('input'); noZoom(i, d.font ? d.font.size : 13);
  i.addEventListener('keydown', ev => {
    if (!d.events || !d.events['On Key']) return;
    fire(o, 'On Key', { e_Key: ev.keyCode, e_Modifiers: L.toLua({ shift: ev.shiftKey, ctrl: ev.ctrlKey, alt: ev.altKey }) });
  });
  i.addEventListener('input', () => fire(o, 'On Focus'));
};
MK.Button = function (o) {
  const d = o.def, sk = P.buttons[d.skin] || null; o.skin = sk;
  o.el.classList.add('btn');
  const t = document.createElement('span'); t.className = 'btxt'; o.el.appendChild(t); o.txt = t;
  o.setText = s => { t.textContent = s; };
  o.setText(d.text || '');
  const f = d.font || (sk && sk.font && { face: sk.font.face, size: Math.round(sk.font.size * 4 / 3), weight: sk.font.bold ? 700 : 400 });
  fontCss(f, o.el);
  o.state = 'up'; o.hover = false; o.down = false;
  o.render = function () {
    if (!sk) return;
    const st = !o.enabled ? sk.disabled : (o.down ? sk.down : (o.hover ? sk.hover : sk.up)) || sk.up;
    if (st && st.img) o.el.style.backgroundImage = `url("${st.img}")`;
    const col = st && st.color ? '#' + st.color.slice(4, 6) + st.color.slice(2, 4) + st.color.slice(0, 2) : '#000';
    const cc = (d.colors && d.colors[0]);
    o.txt.style.color = col === '#000000' && cc && cc !== '#000000' && false ? cc : col;
    o.txt.style.transform = o.down && st ? `translate(${st.dx || 0}px,${st.dy || 0}px)` : '';
  };
  o.el.addEventListener('mouseenter', () => { o.hover = true; o.render(); });
  o.el.addEventListener('mouseleave', () => { o.hover = false; o.down = false; o.render(); });
  o.el.addEventListener('mousedown', () => { o.down = true; o.render(); });
  window.addEventListener('mouseup', () => { if (o.down) { o.down = false; o.render(); } });
  o.render();
  if (d.tooltip) o.el.title = d.tooltip;
};
MK.xButton = function (o) {
  const d = o.def; o.el.classList.add('xbtn');
  if (d.imgs && d.imgs.length) {
    const im = document.createElement('img'); im.src = d.imgs[0]; im.style.width = '100%'; im.style.height = '100%'; im.draggable = false; o.el.appendChild(im);
    if (d.imgs[0].indexOf('vverx.jpg') >= 0 || d.imgs[0].indexOf('vniz.jpg') >= 0) { const alt = d.imgs[0].replace(/\.jpg$/, '1.jpg'); o.el.addEventListener('mouseenter', () => { im.src = alt; }); o.el.addEventListener('mouseleave', () => { im.src = d.imgs[0]; }); }
  } else {
    const t = document.createElement('span'); t.className = 'btxt'; t.textContent = d.text || ''; o.el.appendChild(t); o.txt = t;
    fontCss(d.font, o.el); o.el.style.color = d.color || '#000';
    o.el.addEventListener('mouseenter', () => { o.el.style.textDecoration = 'underline'; });
    o.el.addEventListener('mouseleave', () => { o.el.style.textDecoration = ''; });
  }
  o.setText = s => { if (o.txt) o.txt.textContent = s; };
  if (d.tooltip) o.el.title = d.tooltip;
};
MK.CheckBox = function (o) {
  const d = o.def; o.el.classList.add('chk');
  const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!d.checked;
  const s = document.createElement('span'); s.textContent = d.text || ''; fontCss(d.font, o.el);
  const lb = document.createElement('label'); lb.appendChild(i); lb.appendChild(s); o.el.appendChild(lb); o.input = i;
  i.addEventListener('click', () => fire(o, 'On Click'));
};
MK.RadioButton = function (o) {
  const d = o.def; o.el.classList.add('chk');
  const i = document.createElement('input'); i.type = 'radio'; i.checked = !!d.checked; i.name = 'rg_' + (o.ctx.name) + '_' + (d.group || '');
  const s = document.createElement('span'); s.textContent = d.text || ''; fontCss(d.font, o.el);
  const lb = document.createElement('label'); lb.appendChild(i); lb.appendChild(s); o.el.appendChild(lb); o.input = i;
  i.addEventListener('click', () => fire(o, 'On Click'));
};
MK.ComboBox = function (o) {
  const d = o.def; const s = document.createElement('select'); fontCss(d.font, s); o.el.appendChild(s); o.input = s; o.el.classList.add('combo'); noZoom(s, d.font ? d.font.size : 13);
  o.items = (d.items || []).map(x => ({ text: x[0], data: x[1] }));
  o.sync = function () {
    const sel = s.selectedIndex; s.innerHTML = '';
    o.items.forEach((it, i) => { const op = document.createElement('option'); op.textContent = it.text; s.appendChild(op); });
    if (sel >= 0 && sel < o.items.length) s.selectedIndex = sel; else s.selectedIndex = -1;
  };
  o.sync(); if (o.items.length) s.selectedIndex = 0;
  s.addEventListener('change', () => fire(o, 'On Select', { e_Selection: s.selectedIndex + 1 }));
};
MK.SlideShow = function (o) {
  const d = o.def; o.el.classList.add('slides'); const im = document.createElement('img'); im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'contain'; o.el.appendChild(im); o.img = im;
  o.idx = 1; o.go = function (n) { n = Math.max(1, Math.min(d.slides.length, n)); o.idx = n; im.src = d.slides[n - 1]; fire(o, 'On Slide Changed', { e_Index: n, e_FilePath: d.slides[n - 1] }); };
  im.src = d.slides[0] || '';
  o.play = () => { clearInterval(o.timer); o.timer = setInterval(() => { if (o.idx >= d.slides.length) { clearInterval(o.timer); fire(o, 'On Finished'); } else o.go(o.idx + 1); }, Math.max(500, d.interval || 3000)); };
  o.pause = () => clearInterval(o.timer);
};
MK.Grid = function (o) {
  const d = o.def; o.el.classList.add('grid');
  const tb = document.createElement('table'); o.el.appendChild(tb); o.table = tb;
  fontCss(d.font, o.el);
  const g = d.gcolors || {};
  o.cells = [];
  const rows = d.rows, cols = d.cols;
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr'); o.cells.push([]);
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      const fixed = r < d.fixedRows || c < d.fixedCols;
      if (fixed) td.className = 'fixed'; else td.contentEditable = 'true';
      td.spellcheck = false; tr.appendChild(td); o.cells[r].push(td);
    }
    tb.appendChild(tr);
  }
  const csv = P.files[d.csv];
  if (csv) {
    csv.split(/\r?\n/).forEach((line, r) => {
      if (r >= rows || !line) return;
      parseCsvLine(line).forEach((v, c) => { if (c < cols) o.cells[r][c].textContent = v; });
    });
  }
  const C = (v, d) => colorStr(v === undefined ? d : v);
  o.el.style.background = C(g.bg, 16777215); o.el.style.color = C(g.fg, 0);
  tb.querySelectorAll('td').forEach(td => { td.style.borderColor = C(g.line, 12632256); });
  tb.querySelectorAll('td.fixed').forEach(td => { td.style.background = C(g.fixbg, 15790320); td.style.color = C(g.fixfg, 0); });
  tb.addEventListener('input', ev => { const td = ev.target.closest('td'); if (td) { const r = td.parentNode.rowIndex, c = td.cellIndex; fire(o, 'On Cell Changed', { e_Row: r, e_Column: c, e_NewText: td.textContent, e_OldText: '' }); } });
};
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}

function createObj(ctx, def, parentEl) {
  const o = { def, cls: def.cls, name: def.name, ctx, rect: def.rect.slice(), visible: def.visible !== false, enabled: def.enabled !== false };
  const el = document.createElement('div'); el.className = 'obj ' + def.cls; o.el = el;
  applyBox(o);
  const mk = MK[def.cls]; if (mk) mk(o);
  setVis(o, o.visible); setEn(o, o.enabled);
  if (o.input && def.cls !== 'Input') o.input.disabled = !o.enabled;
  // click events
  if (def.events && def.events['On Click'] && def.cls !== 'CheckBox' && def.cls !== 'RadioButton') {
    el.classList.add('clickable');
    el.addEventListener('click', ev => { if (!o.enabled) return; fire(o, 'On Click'); });
  }
  for (const ev of ['On Enter', 'On Leave']) if (def.events && def.events[ev]) el.addEventListener(ev === 'On Enter' ? 'mouseenter' : 'mouseleave', () => fire(o, ev));
  parentEl.appendChild(el);
  ctx.objs.set(def.name, o); ctx.list.push(o);
  return o;
}

// ------------------------------------------------------------ pages
function clearFrames() { for (const k in AMS.frames) { AMS.frames[k].el.remove(); } AMS.frames = {}; overlay.innerHTML = ''; }
function closePage() {
  const p = AMS.page; if (!p) return;
  stopTimer();
  firePage(p, 'On Close');
  p.list.forEach(o => { if (o.timer) clearInterval(o.timer); });
  clearFrames(); pageLayer.innerHTML = '';
  AMS.page = null;
}
function stopTimer() { if (AMS.pageTimer) { clearInterval(AMS.pageTimer); AMS.pageTimer = null; } }
function jump(name, noHist, fromPop) {
  const def = P.pages[name];
  if (!def) { console.warn('no page', name); return; }
  if (AMS.dialogs.length) closeAllDialogs();
  closePage();
  const ctx = makeCtx(def, 'page'); AMS.page = ctx;
  const el = document.createElement('div'); el.className = 'page'; el.style.background = (def.bg ? `url("${fileUrl(def.bg)}") 0 0 no-repeat, ` : '') + '#c0c0c0'; pageLayer.appendChild(el); ctx.el = el;
  for (const od of def.objects) createObj(ctx, od, el);
  if (!noHist) { AMS.history = AMS.history.slice(0, AMS.histPos + 1); AMS.history.push(name); AMS.histPos = AMS.history.length - 1; }
  document.title = 'Макроэкономика — ' + name;
  firePage(ctx, 'On Preload');
  firePage(ctx, 'On Show');
  const hash = '#' + encodeURIComponent(name); if (location.hash !== hash) { AMS.silent = true; try { (fromPop ? history.replaceState : history.pushState).call(history, null, '', hash); } catch (e) { } AMS.silent = false; }
}
AMS.jump = jump; AMS.createObj = createObj;
AMS.startTimer = ms => {
  stopTimer();
  AMS.pageTimer = setInterval(() => { const c = AMS.page; if (c) firePage(c, 'On Timer', { e_ID: 1 }); }, ms);
};
AMS.stopTimer = stopTimer;
AMS.navigate = function (dir) {
  const order = P.pageorder; const cur = AMS.page ? AMS.page.name : order[0]; const i = order.indexOf(cur);
  if (dir === 0) jump(order[0]);
  else if (dir === 1) jump(order[order.length - 1]);
  else if (dir === 2) { if (i < order.length - 1) jump(order[i + 1]); }
  else if (dir === 3) { if (i > 0) jump(order[i - 1]); }
  else if (dir === 4) { if (AMS.histPos > 0) { AMS.histPos--; jump(AMS.history[AMS.histPos], true); } }
  else if (dir === 5) { if (AMS.histPos < AMS.history.length - 1) { AMS.histPos++; jump(AMS.history[AMS.histPos], true); } }
};

// ------------------------------------------------------------ dialogs
function showDialog(name) {
  const def = P.dialogs[name]; if (!def) return;
  const ctx = makeCtx(def, 'dialog');
  const back = document.createElement('div'); back.className = 'dback';
  const win = document.createElement('div'); win.className = 'dwin'; win.style.width = px(def.width); win.style.left = px((800 - def.width) / 2); win.style.top = px(Math.max(0, (600 - def.height - 28) / 2));
  const bar = document.createElement('div'); bar.className = 'dbar'; bar.textContent = def.title;
  const x = document.createElement('span'); x.className = 'dx'; x.textContent = '✕'; x.onclick = () => closeDialog(ctx); bar.appendChild(x);
  const body = document.createElement('div'); body.className = 'dbody'; body.style.height = px(def.height); body.style.background = '#e9edf3';
  win.appendChild(bar); win.appendChild(body); back.appendChild(win); dlgLayer.appendChild(back);
  ctx.el = back; ctx.body = body; AMS.dialogs.push(ctx);
  for (const od of def.objects) createObj(ctx, od, body);
  firePage(ctx, 'On Preload'); firePage(ctx, 'On Show');
}
function closeDialog(ctx) {
  ctx = ctx || AMS.dialogs[AMS.dialogs.length - 1]; if (!ctx) return;
  const i = AMS.dialogs.indexOf(ctx); if (i < 0) return;
  firePage(ctx, 'On Close');
  AMS.dialogs.splice(i, 1); ctx.el.remove();
}
function closeAllDialogs() { while (AMS.dialogs.length) closeDialog(); }
AMS.showDialog = showDialog; AMS.closeDialog = closeDialog;

// message box
AMS.message = function (title, text, btns, icon) {
  stage.querySelectorAll('.dback.msg').forEach(x => x.remove());
  const back = document.createElement('div'); back.className = 'dback msg';
  const win = document.createElement('div'); win.className = 'dwin msgwin';
  const bar = document.createElement('div'); bar.className = 'dbar'; bar.textContent = title;
  const body = document.createElement('div'); body.className = 'msgbody';
  const ic = document.createElement('div'); ic.className = 'msgicon i' + (icon || 0); ic.textContent = ({ 16: '✖', 32: '?', 48: '!', 64: 'i' })[icon] || '';
  const tx = document.createElement('div'); tx.className = 'msgtext'; tx.textContent = text;
  const bb = document.createElement('div'); bb.className = 'msgbtns';
  const labels = { 0: [['OK', 1]], 1: [['OK', 1], ['Отмена', 2]], 4: [['Да', 6], ['Нет', 7]], 3: [['Да', 6], ['Нет', 7], ['Отмена', 2]] }[btns || 0] || [['OK', 1]];
  labels.forEach(([t, v]) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => back.remove(); bb.appendChild(b); });
  body.appendChild(ic); body.appendChild(tx); win.appendChild(bar); win.appendChild(body); win.appendChild(bb); back.appendChild(win); stage.appendChild(back);
  return labels[0][1];
};

// ------------------------------------------------------------ canvas overlay
AMS.canvasCreate = function (w, h, color) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = colorStr(color); g.fillRect(0, 0, w, h);
  const id = Object.keys(AMS.canvases).length + 1 + Math.floor(Math.random() * 1e6) * 0; let k = 1; while (AMS.canvases[k]) k++;
  AMS.canvases[k] = { c, g, w, h }; return k;
};
AMS.frameShow = function (cid, x, y) {
  const cv = AMS.canvases[cid]; if (!cv) return 0;
  const c = document.createElement('canvas'); c.width = cv.w; c.height = cv.h; c.className = 'frame'; c.style.left = px(x); c.style.top = px(y);
  overlay.appendChild(c);
  let k = 1; while (AMS.frames[k]) k++;
  AMS.frames[k] = { el: c }; return k;
};
AMS.frameLoad = function (fid, cid) {
  const f = AMS.frames[fid], cv = AMS.canvases[cid]; if (!f || !cv) return;
  f.el.width = cv.w; f.el.height = cv.h; f.el.getContext('2d').drawImage(cv.c, 0, 0);
};
AMS.frameFree = function (fid) { const f = AMS.frames[fid]; if (f) { f.el.remove(); delete AMS.frames[fid]; } };

// ------------------------------------------------------------ stage scaling
function fit() {
  const W = wrap.clientWidth || window.innerWidth, H = wrap.clientHeight || window.innerHeight;
  const s = Math.min(W / 800, H / 600);
  const sc = Math.max(0.3, s);
  document.body.classList.toggle('portrait', W < 700 && H > W);
  stage.style.transform = `scale(${sc})`;
  stage.style.left = px((W - 800 * sc) / 2); stage.style.top = px((H - 600 * sc) / 2);
}
window.addEventListener('resize', fit); window.addEventListener('orientationchange', () => setTimeout(fit, 250)); if (window.visualViewport) visualViewport.addEventListener('resize', fit); setTimeout(fit, 300); fit();
AMS.fit = fit;
window.addEventListener('keydown', ev => { if (ev.key === 'Escape') { const m = stage.querySelector('.dback.msg'); if (m) m.remove(); else if (AMS.dialogs.length) closeDialog(); } });
window.addEventListener('popstate', () => {
  const h = decodeURIComponent((location.hash || '').slice(1));
  if (P.pages[h] && (!AMS.page || AMS.page.name !== h)) jump(h, false, true);
});
AMS.start = function () {
  L.run(P.prelude, 'prelude');
  L.run(P.global, 'global');
  const hash = decodeURIComponent((location.hash || '').slice(1));
  jump(P.pages[hash] ? hash : P.pageorder[0]);
};
})();
