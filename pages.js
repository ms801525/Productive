/* ==========================================================
   Shared script for the How-to, Privacy, Terms and Contact pages.
   Kept in its own file (no inline scripts) so the strict
   Content Security Policy can block any script that isn't ours.
   ========================================================== */
(function () {
  'use strict';

  // Don't let other websites show these pages inside a frame (clickjacking).
  if (window.top !== window.self) {
    // Shown inside another website's frame: remove everything and offer only a link
    // that opens the real page in its own tab, so nothing can be click-jacked.
    document.body.innerHTML = '';
    var a = document.createElement('a');
    a.href = window.location.href;
    a.target = '_top';
    a.rel = 'noopener';
    a.textContent = 'Open Productive in its own tab';
    a.setAttribute('style', 'display:block;margin:40px auto;max-width:320px;padding:14px 20px;border-radius:999px;background:#d6ff3d;color:#0c0d11;font:600 16px system-ui,sans-serif;text-align:center;text-decoration:none');
    document.body.appendChild(a);
    return;
  }

  // Owner's contact address, assembled here (not in the HTML) to keep it away from spam bots.
  window.PRODUCTIVE_EMAIL = ['alimustafa189', 'yahoo.com'].join('@');

  document.querySelectorAll('.js-year').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  document.querySelectorAll('.js-email').forEach(function (a) {
    a.textContent = window.PRODUCTIVE_EMAIL;
    a.href = 'mailto:' + window.PRODUCTIVE_EMAIL;
  });

  var h = document.querySelector('.topbar');
  if (h) document.documentElement.style.setProperty('--topbar-h', h.offsetHeight + 'px');

  // Opening a link like help.html#bookmark: jump straight to that section (no long smooth scroll)
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) {
      var root = document.documentElement;
      root.style.scrollBehavior = 'auto';
      target.scrollIntoView();
      requestAnimationFrame(function () { root.style.scrollBehavior = ''; });
    }
  }
})();
