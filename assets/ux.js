(() => {
  'use strict';
  const root = document.documentElement;
  const body = document.body;
  const themeButton = document.querySelector('#themeButton, #themeBtn');
  const preference = matchMedia('(prefers-color-scheme: dark)');
  const labelTheme = () => {
    const label = root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeButton?.setAttribute('aria-label', label);
    themeButton?.setAttribute('title', label);
  };
  const setTheme = dark => {root.dataset.theme = dark ? 'dark' : 'light'; labelTheme();};
  labelTheme();
  themeButton?.addEventListener('click', () => {
    setTheme(root.dataset.theme !== 'dark');
    try { localStorage.setItem('km-theme', root.dataset.theme); } catch (_) {}
  });
  preference.addEventListener('change', e => {
    let saved = null;
    try { saved = localStorage.getItem('km-theme'); } catch (_) {}
    if (saved !== 'dark' && saved !== 'light') setTheme(e.matches);
  });
  window.addEventListener('storage', e => {
    if (e.key === 'km-theme' || e.key === null) setTheme(e.newValue === 'dark' || (e.newValue !== 'light' && preference.matches));
  });

  const sidebar = document.getElementById('sidebar');
  const opener = document.querySelector('#menuButton, #menuBtn');
  const scrim = document.querySelector('#menuScrim, #scrim');
  const closer = sidebar?.querySelector('.menu-close');
  if (!sidebar || !opener) return;
  const mobile = matchMedia('(max-width:790px)');
  let opened = false;
  let previousFocus = null;
  const background = new Map();
  function lockBackground(lock) {
    if (lock) {
      [...body.children].filter(el => el !== sidebar && el !== scrim && !['SCRIPT','STYLE'].includes(el.tagName)).forEach(el => {
        background.set(el, el.inert); el.inert = true;
      });
    } else {
      background.forEach((value, el) => {el.inert = value;}); background.clear();
    }
  }
  function closeMenu(restoreFocus = true) {
    const wasOpen = opened;
    opened = false;
    lockBackground(false);
    body.classList.remove('menu-open');
    opener.setAttribute('aria-expanded', 'false');
    sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal');
    // Move focus before hiding the dialog from assistive technology.
    if (wasOpen && restoreFocus && mobile.matches) (previousFocus?.isConnected ? previousFocus : opener).focus();
    sidebar.inert = mobile.matches;
    if (mobile.matches) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
  }
  function openMenu() {
    if (!mobile.matches || opened) return;
    previousFocus = document.activeElement;
    opened = true;
    sidebar.inert = false; sidebar.removeAttribute('aria-hidden');
    sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true');
    body.classList.add('menu-open');
    opener.setAttribute('aria-expanded', 'true');
    closer.focus();
    lockBackground(true);
  }
  opener.addEventListener('click', () => opened ? closeMenu() : openMenu());
  closer?.addEventListener('click', () => closeMenu());
  scrim?.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', e => {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const items = [...sidebar.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {e.preventDefault(); last.focus();}
    else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first.focus();}
  });
  mobile.addEventListener('change', () => {
    const focusInSidebar = sidebar.contains(document.activeElement);
    closeMenu(false);
    if (focusInSidebar) (mobile.matches ? opener : sidebar.querySelector('a, .chap-btn')).focus();
  });
  window.addEventListener('pageshow', () => closeMenu(false));
  window.siteUX = {closeMenu};
  closeMenu(false);
})();
