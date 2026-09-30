/* bootstrap */
import { initTheme } from './core/theme.js';
import { start } from './core/router.js';
import { spotlight } from './core/motion.js';
import { initHeader, initNav, initMenu, initCursor, renderFooter } from './ui/chrome.js';
import { initPalette } from './ui/palette.js';

initTheme();
initHeader();
initNav();
initMenu();
initCursor();
spotlight();
initPalette();
renderFooter();
start();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/^(localhost|127\.)/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
