/* localStorage-backed progress store (safe when storage is blocked) */
import { emitter } from './dom.js';

const KEY = 'mx:v1';
const ev = emitter();
let mem = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* storage blocked: keep in memory */ }
}
function st() { return mem || (mem = load()); }

export const store = {
  on: ev.on,
  get(path, def) {
    let o = st();
    for (const k of path.split('.')) { if (o == null) return def; o = o[k]; }
    return o === undefined ? def : o;
  },
  set(path, val) {
    const ks = path.split('.'); let o = st();
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] || (o[ks[i]] = {});
    o[ks[ks.length - 1]] = val; save(); ev.emit('change', path);
  },
  del(path) {
    const ks = path.split('.'); let o = st();
    for (let i = 0; i < ks.length - 1; i++) { o = o[ks[i]]; if (!o) return; }
    delete o[ks[ks.length - 1]]; save(); ev.emit('change', path);
  },
  markRead(id) { if (!this.get('read.' + id.replace('.', '_'))) this.set('read.' + id.replace('.', '_'), Date.now()); },
  isRead(id) { return !!this.get('read.' + id.replace('.', '_')); },
  readCount() { return Object.keys(this.get('read', {})).length; },
  last(route, title, extra) { this.set('last', Object.assign({ route, title, at: Date.now() }, extra || {})); },
};
