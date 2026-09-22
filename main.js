/* Behaviour layer.

   The two interactive effects on the reference site (the character-scramble on
   link hover, and the staggered entrance) are driven by its compiled JS, not by
   the stylesheet — so these are written from scratch. The timings below are
   starting points; tune the constants at the top of each block.
*/

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     Staggered entrance
     Elements marked .appear fade up in document order.
     --------------------------------------------------------------------- */
  var STAGGER_MS = 60;
  var BASE_DELAY_MS = 40;

  var appears = document.querySelectorAll('.appear');
  Array.prototype.forEach.call(appears, function (el, i) {
    el.style.setProperty('--appear-delay', (BASE_DELAY_MS + i * STAGGER_MS) + 'ms');
  });

  /* ----------------------------------------------------------------------
     Character scramble on hover
     Each .scramble-text cycles random glyphs, resolving left-to-right back
     to its original string.
     --------------------------------------------------------------------- */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var FRAME_MS = 28;      // how fast glyphs churn
  var REVEAL_PER_FRAME = 0.34; // characters locked in per frame

  function scramble(host) {
    var original = host.getAttribute('data-original');
    if (original === null) {
      var src = host.querySelector('.scramble-original');
      original = src ? src.textContent : host.textContent;
      host.setAttribute('data-original', original);
    }
    if (host._raf) return; // already running

    // Lock the box so the row can't reflow while characters change.
    var rect = host.getBoundingClientRect();
    if (rect.width) host.style.minWidth = rect.width + 'px';

    var target = host.querySelector('.scramble-original') || host;
    var revealed = 0;
    var last = 0;

    function tick(now) {
      if (now - last >= FRAME_MS) {
        last = now;
        revealed += REVEAL_PER_FRAME;
        var out = '';
        for (var i = 0; i < original.length; i++) {
          var ch = original[i];
          if (i < Math.floor(revealed) || ch === ' ') {
            out += ch;
          } else {
            out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
        }
        target.textContent = out;
        if (revealed >= original.length) {
          target.textContent = original;
          host._raf = null;
          host.style.minWidth = '';
          return;
        }
      }
      host._raf = requestAnimationFrame(tick);
    }
    host._raf = requestAnimationFrame(tick);
  }

  if (!reduceMotion) {
    var nodes = document.querySelectorAll('.scramble-text');
    Array.prototype.forEach.call(nodes, function (host) {
      var trigger = host.closest('a') || host;
      trigger.addEventListener('mouseenter', function () { scramble(host); });
      trigger.addEventListener('focus', function () { scramble(host); });
    });
  }

  /* ----------------------------------------------------------------------
     Theme toggle — persisted, falls back to the OS preference
     --------------------------------------------------------------------- */
  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ----------------------------------------------------------------------
     Copy-to-clipboard buttons
     --------------------------------------------------------------------- */
  var copyButtons = document.querySelectorAll('.copy-button');
  Array.prototype.forEach.call(copyButtons, function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-copy') || '';
      var done = function () {
        var prev = btn.textContent;
        btn.textContent = 'copied';
        setTimeout(function () { btn.textContent = prev; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () {});
      }
    });
  });
})();
