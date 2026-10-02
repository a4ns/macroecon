import { bus } from './dom.js';

const meta = () => document.getElementById('meta-theme');
export const getTheme = () => document.documentElement.dataset.theme;

export function setTheme(t, persist = true) {
  document.documentElement.dataset.theme = t;
  if (persist) { try { localStorage.setItem('mx:theme', t); } catch (e) {} }
  const m = meta(); if (m) m.content = t === 'light' ? '#f7f6f2' : '#0f1319';
  bus.emit('theme', t);
}

/** toggle with a circular reveal from the click point (View Transitions API) */
export async function toggleTheme(ev) {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  const reduce = document.documentElement.classList.contains('reduce');
  if (!document.startViewTransition || reduce) { setTheme(next); return; }
  const r = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : innerWidth - 40, y = r ? r.top + r.height / 2 : 40;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.documentElement.classList.add('vt-theme');
  const t = document.startViewTransition(() => setTheme(next));
  try {
    await t.ready;
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
      { duration: 850, easing: 'cubic-bezier(.65,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
    );
    await t.finished;
  } catch (e) { /* ignore */ }
  document.documentElement.classList.remove('vt-theme');
}

export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', toggleTheme);
  // follow the OS only while the user has made no explicit choice
  const mq = matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener && mq.addEventListener('change', (e) => {
    let saved = null; try { saved = localStorage.getItem('mx:theme'); } catch (err) {}
    if (!saved) setTheme(e.matches ? 'light' : 'dark', false);
  });
}
