// Runs before the app (#158): applies the saved theme so the page never flashes the wrong colours.
try {
  var t = localStorage.getItem('retrace_theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  var l = localStorage.getItem('retrace_lang');
  if (l === 'kk' || l === 'ru') document.documentElement.lang = l;
} catch (e) {}
