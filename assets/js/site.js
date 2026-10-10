/* =====================================================================
   AFTER FIVE TINT — page behaviour (no dependencies)
   The 3D car scene lives in intro.js and listens to the
   'intro:progress' events this file dispatches.
   ===================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduced = doc.classList.contains('reduced-motion');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smooth = function (a, b, v) { var t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  var nav = $('#nav');
  var intro = $('.intro');
  var stage = $('#introStage');
  var scene = $('#scene');
  var dock = $('#dock');
  var hero = $('#hero');

  /* -------------------------------------------------------------------
     GALLERY — real After Five Tint photos only.
     To add one: put the image in assets/img/work/ and add a line, e.g.
       { src: 'assets/img/work/ceramic-civic.webp', alt: 'Black Civic with ceramic tint on the rear windows', caption: 'Ceramic, rear windows' },
     under the right category. Empty categories show a holding panel.
     ------------------------------------------------------------------- */
  var GALLERY = {
    auto: [],
    home: [],
    power: []
  };
  var CAT_NAMES = { auto: 'Auto', home: 'Home', power: 'Boats & Powersports' };

  /* ===================================================================
     INTRO SCROLL CONTROLLER
     =================================================================== */
  var introState = { p: 0, done: false };
  var cinematic = !reduced && !!intro;

  function introEnd() {
    if (!intro) return 0;
    return intro.offsetTop + intro.offsetHeight - window.innerHeight;
  }

  function applyIntro(p) {
    var reveal = smooth(0.78, 0.97, p);
    var fade = 1 - smooth(0.95, 1, p);
    stage.style.setProperty('--p', p.toFixed(4));
    stage.style.setProperty('--reveal', reveal.toFixed(4));
    stage.style.setProperty('--fade', fade.toFixed(4));
    var done = p >= 0.999;
    if (done !== introState.done) {
      introState.done = done;
      scene.style.visibility = done ? 'hidden' : '';
      stage.classList.toggle('is-done', done);
    }
    introState.p = p;
    document.dispatchEvent(new CustomEvent('intro:progress', { detail: { p: p } }));
  }

  function updateChrome() {
    var y = window.scrollY;
    var pastIntro = !cinematic || y >= introEnd() - 2 || doc.classList.contains('no-cinema');
    if (!document.body.classList.contains('menu-open')) nav.setAttribute('data-state', pastIntro ? 'site' : 'intro');
    if (dock) dock.classList.toggle('is-on', pastIntro && y > 80);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (cinematic && !doc.classList.contains('no-cinema')) {
        var end = introEnd();
        var p = end > 0 ? clamp01((window.scrollY - intro.offsetTop) / (end - intro.offsetTop)) : 1;
        if (Math.abs(p - introState.p) > 0.0004 || p === 0 || p === 1) applyIntro(p);
      }
      updateChrome();
      updateSteps();
    });
  }

  if (cinematic) {
    // Poster mode until the 3D scene says it's ready (intro.js swaps to .is-3d).
    scene.classList.add('is-poster');
    applyIntro(0);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  document.addEventListener('intro:mode', function () { onScroll(); });

  function skipIntro() {
    window.scrollTo({ top: Math.max(0, introEnd()), behavior: 'instant' });
  }
  var skipBtn = $('#introSkip');
  if (skipBtn) skipBtn.addEventListener('click', function () {
    skipIntro();
    var first = $('.hero__cta .btn');
    if (first) first.focus({ preventScroll: true });
  });
  // Keyboard users tabbing into the hero shouldn't land behind the car.
  if (hero) hero.addEventListener('focusin', function () {
    if (cinematic && introState.p < 0.999) skipIntro();
  });
  // Coming back with a hash or mid-page reload: let the browser restore, then sync.
  window.addEventListener('load', onScroll);
  window.addEventListener('pageshow', onScroll);

  /* ===================================================================
     MOBILE MENU
     =================================================================== */
  var toggle = $('#navToggle');
  var menu = $('#menu');
  var lastFocus = null;

  function focusables() { return $$('a, button', menu).concat([toggle]); }
  function openMenu() {
    lastFocus = document.activeElement;
    menu.hidden = false;
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    nav.setAttribute('data-state', 'site');
    var f = $('a', menu); if (f) f.focus();
  }
  function closeMenu(restore) {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    setTimeout(function () { if (toggle.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 300);
    if (restore !== false && lastFocus) lastFocus.focus({ preventScroll: true });
    updateChrome();
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
    });
    $$('a[href^="#"]', menu).forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key === 'Tab') {
        var f = focusables(); var first = f[0]; var last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.matchMedia('(min-width: 1101px)').addEventListener('change', function (m) { if (m.matches && !menu.hidden) closeMenu(false); });
  }

  /* ===================================================================
     ACTIVE NAV LINK
     =================================================================== */
  var navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = byId[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          navLinks.forEach(function (x) { x.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        } else if (a.getAttribute('aria-current')) {
          a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) secObs.observe(el); });
  }

  /* ===================================================================
     FILM SELECTOR (tabs)
     =================================================================== */
  var film = $('#film');
  if (film) {
    var tabs = $$('[role="tab"]', film);
    var select = function (i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      film.setAttribute('data-tier', String(i));
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, k = e.key, to = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i - 1 + n) % n;
        else if (k === 'Home') to = 0;
        else if (k === 'End') to = n - 1;
        if (to !== null) { e.preventDefault(); select(to, true); }
      });
    });
    select(0);
  }

  /* ===================================================================
     TINT COMPARISON
     =================================================================== */
  var frame = $('#compareFrame');
  var range = $('#compareRange');
  if (frame && range) {
    var setPos = function (v) {
      v = Math.max(0, Math.min(100, v));
      frame.style.setProperty('--pos', v + '%');
      range.value = String(Math.round(v));
      range.setAttribute('aria-valuetext', Math.round(v) + '% darker look');
    };
    range.addEventListener('input', function () { setPos(+range.value); });
    // Pointer: drag anywhere on the image (the range stays for keyboard + screen readers)
    range.style.pointerEvents = 'none';
    var dragging = false;
    var fromEvent = function (e) {
      var r = frame.getBoundingClientRect();
      setPos(((e.clientX - r.left) / r.width) * 100);
    };
    frame.addEventListener('pointerdown', function (e) {
      dragging = true; frame.classList.add('is-drag');
      frame.setPointerCapture(e.pointerId); fromEvent(e);
    });
    frame.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    var stop = function () { dragging = false; frame.classList.remove('is-drag'); };
    frame.addEventListener('pointerup', stop);
    frame.addEventListener('pointercancel', stop);
    setPos(50);
  }

  /* ===================================================================
     PROCESS TIMELINE
     =================================================================== */
  var stepsEl = $('#steps');
  var steps = stepsEl ? $$('.step', stepsEl) : [];
  function updateSteps() {
    if (!stepsEl) return;
    var vh = window.innerHeight;
    var r = stepsEl.getBoundingClientRect();
    var fill = reduced ? 1 : clamp01((vh * 0.72 - r.top) / (r.height || 1));
    stepsEl.style.setProperty('--fill', fill.toFixed(3));
    steps.forEach(function (s, i) {
      s.classList.toggle('is-on', reduced || fill >= (i / steps.length) + 0.02 || (i === 0 && fill > 0));
    });
  }

  /* ===================================================================
     GALLERY + LIGHTBOX
     =================================================================== */
  var grid = $('#workGrid');
  var empty = $('#workEmpty');
  var emptyCat = $('#workEmptyCat');
  var chips = $$('.work__filters .chip');
  var lightbox = $('#lightbox');
  var current = { cat: 'auto', i: 0 };

  function renderGallery(cat) {
    current.cat = cat;
    var items = GALLERY[cat] || [];
    grid.innerHTML = '';
    if (!items.length) {
      empty.hidden = false;
      emptyCat.textContent = CAT_NAMES[cat];
      return;
    }
    empty.hidden = true;
    items.forEach(function (it, i) {
      var fig = document.createElement('figure');
      fig.className = 'work__item';
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'View larger: ' + it.alt);
      var img = document.createElement('img');
      img.src = it.src; img.alt = it.alt; img.loading = 'lazy'; img.decoding = 'async';
      b.appendChild(img);
      b.addEventListener('click', function () { openLightbox(i); });
      fig.appendChild(b);
      if (it.caption) { var c = document.createElement('figcaption'); c.textContent = it.caption; fig.appendChild(c); }
      grid.appendChild(fig);
    });
  }
  function showLightbox(i) {
    var items = GALLERY[current.cat];
    current.i = (i + items.length) % items.length;
    var it = items[current.i];
    $('#lightboxImg').src = it.src;
    $('#lightboxImg').alt = it.alt;
    $('#lightboxCap').textContent = it.caption || '';
  }
  function openLightbox(i) {
    if (!lightbox || !lightbox.showModal) return;
    showLightbox(i);
    lightbox.showModal();
  }
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || e.target === lightbox) lightbox.close();
      else if (e.target.closest('[data-prev]')) showLightbox(current.i - 1);
      else if (e.target.closest('[data-next]')) showLightbox(current.i + 1);
    });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showLightbox(current.i - 1);
      if (e.key === 'ArrowRight') showLightbox(current.i + 1);
    });
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      renderGallery(c.getAttribute('data-filter'));
    });
  });
  if (grid) renderGallery('auto');

  /* ===================================================================
     FAQ
     =================================================================== */
  $$('.faq__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var open = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', open ? 'false' : 'true');
      document.getElementById(q.getAttribute('aria-controls')).hidden = open;
    });
  });

  /* ===================================================================
     QUIET REVEALS (section headings and key blocks only)
     =================================================================== */
  if (!reduced && 'IntersectionObserver' in window) {
    var targets = $$('.section .display, .section .intro-text, .why__grid, .film, .compare, .lineup__group, .steps, .work__empty, .home__art, .faq__list, .location__info, .contact__inner');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (t) {
      // Anything already on screen (e.g. after a mid-page reload) shows immediately.
      var r = t.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) return;
      t.classList.add('rv'); io.observe(t);
    });
  }

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  onScroll();
})();
