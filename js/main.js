(function () {
  'use strict';

  /* ── SCROLL: shadow + hide nav on scroll down ── */
  var header = document.getElementById('header');
  var nav    = header.querySelector('.nav');
  var lastY  = 0;
  var threshold = 80;

  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    header.classList.toggle('scrolled', y > 10);

    if (y > threshold) {
      nav.classList.toggle('is-hidden', y > lastY);
    } else {
      nav.classList.remove('is-hidden');
    }

    lastY = y;
  }, { passive: true });


  /* ── MOBILE MENU ───────────────────────────── */
  var burger = document.getElementById('burger');
  var menu   = document.getElementById('nav-menu');

  burger.addEventListener('click', function () {
    var open = burger.classList.toggle('is-open');
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target) && !burger.contains(e.target) && menu.classList.contains('is-open')) {
      burger.classList.remove('is-open');
      menu.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      burger.classList.remove('is-open');
      menu.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.focus();
    }
  });


  /* ── DROPDOWN / ACCORDION TOGGLES ──────────── */
  var parentBtns = document.querySelectorAll('.nav__item--parent');

  parentBtns.forEach(function (btn) {
    var sub = btn.nextElementSibling;

    btn.addEventListener('click', function () {
      var isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close siblings first
      parentBtns.forEach(function (other) {
        if (other !== btn) {
          other.setAttribute('aria-expanded', 'false');
          var otherSub = other.nextElementSibling;
          if (otherSub) otherSub.classList.remove('is-open');
        }
      });

      btn.setAttribute('aria-expanded', String(!isOpen));
      if (sub) sub.classList.toggle('is-open', !isOpen);
    });

    // Close dropdown on outside click (desktop)
    document.addEventListener('click', function (e) {
      var parent = btn.closest('.nav__has-sub');
      if (parent && !parent.contains(e.target)) {
        btn.setAttribute('aria-expanded', 'false');
        if (sub) sub.classList.remove('is-open');
      }
    });
  });


  /* ── HERO SLIDESHOW ────────────────────────── */
  (function () {
    var slides  = document.querySelectorAll('.hero__img');
    var count   = slides.length;
    if (count < 2) return;

    var cur     = 0;
    var speed   = 4500;
    var running = true;

    function next() {
      var prev = cur;
      cur = (cur + 1) % count;

      slides[prev].classList.add('is-leaving');
      slides[prev].classList.remove('is-active');

      slides[cur].classList.add('is-active');

      setTimeout(function () {
        slides[prev].classList.remove('is-leaving');
      }, 900);
    }

    var last = performance.now();

    function tick(now) {
      if (running && now - last >= speed) {
        next();
        last = now;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) last = performance.now();
    });
  })();


  /* ── SCROLL REVEAL ─────────────────────────── */
  var reveals = document.querySelectorAll('.reveal, .reveal-left');

  if (reveals.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    reveals.forEach(function (el) { observer.observe(el); });
  }


  /* ── HORIZONTAL SCROLL ARROWS ──────────────── */
  document.querySelectorAll('.scroll-row').forEach(function (row) {
    var leftBtn  = row.querySelector('.scroll-arrow--left');
    var rightBtn = row.querySelector('.scroll-arrow--right');
    var track    = row.querySelector('.services__cards, .ops__row');
    if (!track || !leftBtn || !rightBtn) return;

    function updateArrows() {
      var sl = track.scrollLeft;
      var maxScroll = track.scrollWidth - track.clientWidth;

      leftBtn.classList.toggle('is-visible', sl > 10);
      rightBtn.classList.toggle('is-visible', sl < maxScroll - 10);
    }

    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    updateArrows();

    var scrollAmount = 320;

    leftBtn.addEventListener('click', function () {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', function () {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  });


  /* ── CAREERS TOGGLE (delegated — supports Firestore-rendered jobs) ── */
  var careersList = document.getElementById('careers-list');
  if (careersList) {
    careersList.addEventListener('click', function (e) {
      var btn = e.target.closest('.careers__toggle');
      if (!btn) return;

      var job = btn.closest('.careers__job');
      var details = job && job.querySelector('.careers__details');
      if (!details) return;

      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      details.classList.toggle('is-open', !open);

      var label = btn.querySelector('.careers__toggle-label');
      if (label) label.textContent = open ? 'View Details' : 'Hide Details';
    });
  }


  /* ── FLOATING SCROLL TOP BUTTON ───────────── */
  var scrollTopBtn = document.querySelector('[data-scroll-top]');

  if (scrollTopBtn) {
    function toggleScrollTop() {
      scrollTopBtn.classList.toggle('is-visible', window.scrollY > 500);
    }

    window.addEventListener('scroll', toggleScrollTop, { passive: true });
    toggleScrollTop();

    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

})();
