/* scroll-linked motion: one rAF engine + small behaviours (reveal, split, counters, magnetic, spotlight, lit text, parallax, marquee) */
import { $$, clamp, lerp, reduced, easeOut, isTouch } from './dom.js';

/* ── scroll engine ──────────────────────────────────────────── */
const subs = new Set();
export const scroller = { y: 0, vy: 0, vh: innerHeight, vw: innerWidth };
let rafId = 0, lastY = -1, lastT = 0, idle = 0;

function tick(t) {
  const dt = Math.min(.05, (t - lastT) / 1000 || .016); lastT = t;
  const y = window.scrollY;
  scroller.vy = lerp(scroller.vy, (y - (lastY < 0 ? y : lastY)) / Math.max(dt, .001) / 60, .18);
  if (Math.abs(scroller.vy) < .001) scroller.vy = 0;
  scroller.y = y; scroller.vh = innerHeight; scroller.vw = innerWidth;
  if (y !== lastY || scroller.vy !== 0 || idle < 2) {
    idle = (y !== lastY || scroller.vy !== 0) ? 0 : idle + 1;
    lastY = y;
    subs.forEach((f) => f(y, scroller.vy, dt, t));
  }
  rafId = subs.size ? requestAnimationFrame(tick) : 0;
}
export function onScroll(fn) {
  subs.add(fn);
  if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(tick); }
  return () => { subs.delete(fn); };
}
window.addEventListener('resize', () => { idle = 0; });

/* ── reveal ─────────────────────────────────────────────────── */
let io;
export function reveals(root = document) {
  const els = $$('.rv:not(.in), [data-reveal]:not(.in)', root);
  if (!els.length) return;
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
  els.forEach((e) => io.observe(e));
}

/* ── split words (keeps inline tags like <em>) ──────────────── */
export function splitWords(el, { step = .045, start = 0 } = {}) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.textContent = part; s.style.transitionDelay = (start + i++ * step).toFixed(3) + 's';
          w.append(s); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
    });
  };
  walk(el);
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  el.classList.add('split');
}
export function splits(root = document) { $$('[data-split]', root).forEach((e) => splitWords(e, { step: +(e.dataset.step || .05), start: +(e.dataset.delay || 0) })); }

/* ── counters ───────────────────────────────────────────────── */
export function counters(root = document) {
  $$('[data-count]:not([data-counted])', root).forEach((el) => {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
    const fmt = (v) => v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    el.textContent = fmt(reduced() ? to : 0);
    if (reduced()) return;
    const io2 = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; io2.disconnect(); el.dataset.counted = 1;
      const t0 = performance.now(), dur = +(el.dataset.dur || 1800);
      const step = (t) => { const p = clamp((t - t0) / dur); el.textContent = fmt(to * easeOut(p)); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { threshold: .4 });
    io2.observe(el);
  });
}

/* ── magnetic buttons ───────────────────────────────────────── */
export function magnetic(root = document) {
  return () => {}; // formal: disabled
  if (isTouch() || reduced()) return () => {};
  const offs = [];
  $$('[data-magnetic]', root).forEach((el) => {
    const k = +(el.dataset.magnetic || .3);
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const loop = () => { cx = lerp(cx, tx, .18); cy = lerp(cy, ty, .18); el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`; raf = (Math.abs(cx - tx) + Math.abs(cy - ty) > .05) ? requestAnimationFrame(loop) : 0; };
    const mv = (e) => { const r = el.getBoundingClientRect(); tx = (e.clientX - (r.left + r.width / 2)) * k; ty = (e.clientY - (r.top + r.height / 2)) * k; if (!raf) raf = requestAnimationFrame(loop); };
    const lv = () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerleave', lv);
    offs.push(() => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerleave', lv); cancelAnimationFrame(raf); });
  });
  return () => offs.forEach((f) => f());
}

/* ── card spotlight (global, cheap) ─────────────────────────── */
let spot = false;
export function spotlight() {
  return; // formal: disabled
  if (spot || isTouch()) return; spot = true;
  let raf = 0, ev;
  window.addEventListener('pointermove', (e) => {
    ev = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const c = ev.target.closest && ev.target.closest('.card, [data-spot]');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      c.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    });
  }, { passive: true });
}

/* ── scroll-lit paragraph: words light up as you read ───────── */
export function litText(root = document) {
  const offs = [];
  $$('[data-lit]', root).forEach((el) => {
    splitWords(el, { step: 0 });
    el.classList.add('lit');
    const ws = $$('.w > span', el);
    ws.forEach((s) => { s.style.transitionDelay = '0s'; s.style.transform = 'none'; });
    const upd = () => {
      const r = el.getBoundingClientRect(), vh = innerHeight;
      const p = clamp((vh * .82 - r.top) / (r.height + vh * .34));
      const n = p * ws.length;
      ws.forEach((s, i) => { const k = clamp(n - i); s.style.opacity = (.14 + .86 * k).toFixed(3); s.style.filter = k < 1 ? `blur(${((1 - k) * 1.5).toFixed(2)}px)` : 'none'; });
    };
    if (reduced()) { ws.forEach((s) => { s.style.opacity = 1; }); return; }
    upd(); offs.push(onScroll(upd));
  });
  return () => offs.forEach((f) => f());
}

/* ── parallax ───────────────────────────────────────────────── */
export function parallax(root = document) {
  if (reduced()) return () => {};
  const items = $$('[data-parallax]', root).map((el) => ({ el, k: +el.dataset.parallax }));
  if (!items.length) return () => {};
  return onScroll(() => {
    const vh = innerHeight;
    for (const { el, k } of items) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -k).toFixed(1)}px, 0)`;
    }
  });
}

/* ── velocity marquee ───────────────────────────────────────── */
export function marquees(root = document) {
  const offs = [];
  $$('.marquee', root).forEach((m) => {
    const track = m.firstElementChild; if (!track) return;
    let x = 0; const dir = m.dataset.dir === 'r' ? 1 : -1, base = +(m.dataset.speed || .6);
    const w = () => track.scrollWidth / 2;
    const off = onScroll((y, vy) => {
      x += dir * (base + Math.min(14, Math.abs(vy) * .5)) * (vy * dir > 0 ? 1 : 1);
      const W = w(); if (W) { if (dir < 0 && x <= -W) x += W; if (dir > 0 && x >= 0) x -= W; }
      track.style.transform = `translate3d(${x}px,0,0) skewX(${clamp(-vy * .18, -8, 8).toFixed(2)}deg)`;
    });
    offs.push(off);
    // keep moving when page is idle
    let raf; const idle = (t) => { raf = requestAnimationFrame(idle); };
    offs.push(() => cancelAnimationFrame(raf));
  });
  return () => offs.forEach((f) => f());
}

/* ── apply everything for a freshly mounted view ────────────── */
export function enhance(root = document) {
  splits(root); counters(root); reveals(root);
  const offs = [magnetic(root), litText(root), parallax(root), marquees(root)];
  return () => offs.forEach((f) => f && f());
}
