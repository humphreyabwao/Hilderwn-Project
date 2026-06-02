/**
 * Image delivery: lazy backgrounds, hero deferral, prefetch on navigation, SW cache.
 */
(function () {
  'use strict';

  var SW_PATH = '/sw-images.js';
  var SW_VERSION = 'hildernw-images-v2';

  function resolveUrl(url) {
    if (!url || /^https?:\/\//i.test(url) || url.charAt(0) === '/') return url;
    try {
      return new URL(url, document.baseURI || window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  function bgUrlFromStyle(el) {
    var bg = el.style && el.style.backgroundImage;
    if (!bg || bg === 'none') return '';
    var match = bg.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    return match ? match[1] : '';
  }

  function prefetchImage(url) {
    var resolved = resolveUrl(url);
    if (!resolved) return;
    var img = new Image();
    img.decoding = 'async';
    img.src = resolved;
  }

  function applyBg(el, url) {
    var safe = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    el.style.backgroundImage = "url('" + safe + "')";
    el.classList.add('is-bg-loaded');
  }

  function loadBg(el, url) {
    if (!el || el.classList.contains('is-bg-loaded')) return;
    var src = url || el.getAttribute('data-bg') || bgUrlFromStyle(el);
    if (!src) return;

    if (el.getAttribute('data-bg') !== src) {
      el.setAttribute('data-bg', src);
    }

    var resolved = resolveUrl(src);
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      applyBg(el, src);
    };
    img.onerror = function () {
      el.classList.add('is-bg-error');
    };
    img.src = resolved;
  }

  function stripInlineBg(el) {
    var url = bgUrlFromStyle(el);
    if (!url) return '';
    el.style.backgroundImage = '';
    el.setAttribute('data-bg', url);
    return url;
  }

  /* ── <img> defaults ─────────────────────────── */
  function enhanceImages() {
    document.querySelectorAll('img').forEach(function (img) {
      if (!img.hasAttribute('decoding')) img.decoding = 'async';
      if (img.classList.contains('logo__icon')) {
        if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'high');
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'eager');
        return;
      }
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
    });
  }

  /* ── Background images ──────────────────────── */
  var bgObserver = null;

  function observeLazyBg(el) {
    if (!bgObserver) {
      bgObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            loadBg(entry.target);
            bgObserver.unobserve(entry.target);
          });
        },
        { rootMargin: '280px 0px', threshold: 0.01 }
      );
    }
    bgObserver.observe(el);
  }

  function initBackgrounds() {
    var heroSlider = document.querySelector('.hero__slider');

    document.querySelectorAll('.page-hero__bg').forEach(function (el) {
      var url = stripInlineBg(el) || el.getAttribute('data-bg');
      if (url) loadBg(el, url);
    });

    if (heroSlider) {
      var slides = heroSlider.querySelectorAll('.hero__img');
      slides.forEach(function (slide, index) {
        var url = stripInlineBg(slide) || slide.getAttribute('data-bg');
        if (!url) return;
        if (index === 0 || slide.classList.contains('is-active')) {
          loadBg(slide, url);
        }
      });

      function preloadRemainingHero() {
        slides.forEach(function (slide, index) {
          if (index === 0) return;
          var url = slide.getAttribute('data-bg');
          if (url && !slide.classList.contains('is-bg-loaded')) loadBg(slide, url);
        });
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadRemainingHero, { timeout: 3500 });
      } else {
        window.addEventListener('load', function () {
          setTimeout(preloadRemainingHero, 1500);
        });
      }
    }

    document.querySelectorAll('[style*="background-image"]').forEach(function (el) {
      if (el.closest('.hero__slider') || el.classList.contains('page-hero__bg')) return;
      var url = stripInlineBg(el);
      if (url) observeLazyBg(el);
    });

    document.querySelectorAll('[data-bg]:not(.is-bg-loaded)').forEach(function (el) {
      if (el.closest('.hero__slider') || el.classList.contains('page-hero__bg')) return;
      observeLazyBg(el);
    });
  }

  /* ── Prefetch page + hero on internal link hover ─ */
  function initLinkPrefetch() {
    var done = Object.create(null);

    document.addEventListener('mouseover', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
      if (/^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0) return;

      var key = resolveUrl(href);
      if (done[key]) return;
      done[key] = true;

      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = key;
      document.head.appendChild(link);
    }, { passive: true, capture: true });
  }

  /* ── Service worker: long-lived image cache ─── */
  function registerImageCache() {
    if (!('serviceWorker' in navigator) || location.pathname.indexOf('/admin') === 0) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register(SW_PATH).catch(function () { /* optional */ });
    });
  }

  window.HildernwImages = {
    loadBg: loadBg,
    prefetch: prefetchImage
  };

  enhanceImages();
  initBackgrounds();
  initLinkPrefetch();
  registerImageCache();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceImages);
  }
})();
