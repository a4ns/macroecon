/* hash router with lazy views + view transitions */
import { bus } from './dom.js';

const R = (pattern, loader, nav) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { re, keys, loader, nav };
};

const routes = [
  R('/', () => import('../views/home.js'), 'home'),
  R('/theory', () => import('../views/theory.js'), 'theory'),
  R('/theory/:topic', () => import('../views/topic.js'), 'theory'),
  R('/read/:id', () => import('../views/reader.js'), 'theory'),
  R('/lab', () => import('../views/lab.js'), 'lab'),
  R('/lab/:id', () => import('../views/sim.js'), 'lab'),
  R('/tasks', () => import('../views/tasks.js'), 'tasks'),
  R('/tasks/:topic', () => import('../views/tasks.js'), 'tasks'),
  R('/tests', () => import('../views/tests.js'), 'tests'),
  R('/tests/:topic', () => import('../views/quiz.js'), 'tests'),
  R('/glossary', () => import('../views/glossary.js'), 'glossary'),
  R('/glossary/:letter', () => import('../views/glossary.js'), 'glossary'),
  R('/more', () => import('../views/more.js'), 'more'),
  R('/more/:page', () => import('../views/doc.js'), 'more'),
  /* v3 — оболочка «ведёт» */
  R('/start', () => import('../views/start.js'), 'today'),
  R('/today', () => import('../views/today.js'), 'today'),
  R('/course', () => import('../views/course.js'), 'course'),
  R('/course/:topic', () => import('../views/topic.js'), 'course'),
  R('/library', () => import('../views/library.js'), 'library'),
  R('/diag', () => import('../views/diag.js'), 'today'),
  R('/review', () => import('../views/review.js'), 'review'),
  R('/review/:stage', () => import('../views/review.js'), 'review'),
  R('/exam', () => import('../views/exam.js'), 'me'),
  R('/exam/:stage', () => import('../views/exam.js'), 'me'),
  R('/me', () => import('../views/me.js'), 'me'),
  R('/me/:page', () => import('../views/me.js'), 'me'),
  R('/settings', () => import('../views/settings.js'), 'me'),
  R('/a/:payload', () => import('../views/assign.js'), 'today'),
  R('/teach', () => import('../views/teach.js'), 'teach'),
  R('/teach/plan/:id', () => import('../views/pair.js'), 'teach'),
  R('/teach/vote/:topic', () => import('../views/vote.js'), 'teach'),
  R('/teach/variants', () => import('../views/variants.js'), 'teach'),
  R('/teach/assign', () => import('../views/tassign.js'), 'teach'),
  R('/teach/summary', () => import('../views/summary.js'), 'teach'),
  R('/present/:id', () => import('../views/present.js'), 'teach'),
  R('/print/:kind', () => import('../views/print.js'), 'teach'),
  R('/print/:kind/:arg', () => import('../views/print.js'), 'teach'),
];

export function parseHash(hash = location.hash) {
  let h = hash.replace(/^#/, '') || '/';
  if (!h.startsWith('/')) h = '/' + h;
  const [path, qs = ''] = h.split('?');
  const query = {};
  qs.split('&').forEach((p) => { if (!p) return; const [k, v = ''] = p.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v); });
  return { path: decodeURI(path), query };
}

export function href(path, query) {
  let q = '';
  if (query) { const p = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)); if (p.length) q = '?' + p.join('&'); }
  return '#' + path + q;
}

export function go(path, query, { replace = false } = {}) {
  const h = href(path, query);
  if (replace) history.replaceState(null, '', h), navigate(); else location.hash = h;
}

let current = null;      // { view, route, ctx, inst }
let token = 0;
let first = true;
const main = () => document.getElementById('main');

function setNav(nav) {
  document.querySelectorAll('#nav a, #menu a').forEach((a) => {
    const on = a.dataset.nav ? a.dataset.nav === nav : (a.getAttribute('href') || '').replace('#/', '') === nav;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  bus.emit('nav', nav);
}

export async function navigate() {
  const my = ++token;
  const { path, query } = parseHash();
  const rd = path.match(/^\/theory\/(\d+)\/?$/); if (rd) { history.replaceState(null, '', '#/course/' + rd[1]); return navigate(); }
  let route = null, params = {};
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { route = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
  }
  if (!route) route = routes[0], params = {};
  const ctx = { path, query, params, nav: route.nav, prev: current && current.ctx };
  let mod, data;
  try {
    mod = await route.loader();
    if (mod.load) data = await mod.load(ctx);
  } catch (err) {
    console.error(err);
    mod = await import('../views/error.js'); data = err;
  }
  if (my !== token) return;

  // same view, only query/params changed and the view wants to handle it itself
  if (current && current.mod === mod && current.inst && current.inst.update && current.path === path) {
    current.ctx = ctx; current.inst.update(ctx, data); return;
  }

  const swap = () => {
    if (current && current.inst && current.inst.destroy) { try { current.inst.destroy(); } catch (e) { console.error(e); } }
    const el = main();
    el.replaceChildren();
    el.className = 'view view--' + (route.nav || 'x');
    window.scrollTo(0, 0);
    setNav(route.nav);
    document.documentElement.classList.toggle('on-home', route.nav === 'home');
    const inst = mod.mount(el, ctx, data) || {};
    current = { mod, route, ctx, inst, path };
    if (ctx.title || inst.title) document.title = (inst.title || ctx.title) + ' · Макро';
    else document.title = 'Макро — интерактивный учебник макроэкономики';
    bus.emit('route', ctx);
  };

  const reduce = document.documentElement.classList.contains('reduce');
  if (!first && document.startViewTransition && !reduce && !document.documentElement.classList.contains('vt-theme')) {
    const t = document.startViewTransition(swap);
    try { await t.updateCallbackDone; } catch (e) {}
  } else swap();
  first = false;
  const f = document.getElementById('main'); f.focus && f.focus({ preventScroll: true });
}

export function start() {
  window.addEventListener('hashchange', navigate);
  navigate();
}

export const currentCtx = () => current && current.ctx;
