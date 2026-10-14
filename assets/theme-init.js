// Apply before the first paint; shared by the website and standalone guide.
(() => {
  let saved = null;
  try { saved = localStorage.getItem('km-theme'); } catch (_) {}
  const dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
