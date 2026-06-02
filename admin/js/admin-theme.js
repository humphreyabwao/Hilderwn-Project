'use strict';

(function () {
  var STORAGE_KEY = 'admin-theme-mode';
  var MODES = ['light', 'dark', 'system'];

  function resolveMode(mode) {
    if (MODES.indexOf(mode) === -1) mode = 'system';
    if (mode !== 'system') return mode;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function updateMeta(resolved) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#e2e8f0');
  }

  function updateToggleUi(resolved) {
    var btn = document.getElementById('admin-theme-btn');
    if (!btn) return;
    var isDark = resolved === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', isDark ? 'Light mode' : 'Dark mode');
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.classList.toggle('is-dark', isDark);
  }

  function applyInstant() {
    var root = document.documentElement;
    root.classList.add('theme-instant');
    window.clearTimeout(applyInstant._t);
    applyInstant._t = window.setTimeout(function () {
      root.classList.remove('theme-instant');
    }, 50);
  }

  function apply(mode) {
    applyInstant();
    var resolved = resolveMode(mode);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode);
    updateMeta(resolved);
    updateToggleUi(resolved);
    document.dispatchEvent(new CustomEvent('hildernw-admin-theme', {
      detail: { mode: mode, resolved: resolved }
    }));
    return resolved;
  }

  function setMode(mode, persist) {
    if (MODES.indexOf(mode) === -1) mode = 'system';
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch (e) { /* ignore */ }
    }
    return apply(mode);
  }

  function getMode() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return MODES.indexOf(stored) !== -1 ? stored : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function toggle() {
    var resolved = resolveMode(getMode());
    setMode(resolved === 'dark' ? 'light' : 'dark');
    var select = document.getElementById('settings-theme-mode');
    if (select) select.value = getMode();
  }

  function bindControls() {
    var btn = document.getElementById('admin-theme-btn');
    if (btn) btn.addEventListener('click', toggle);

    var select = document.getElementById('settings-theme-mode');
    if (select) {
      select.value = getMode();
      select.addEventListener('change', function () {
        setMode(select.value);
      });
    }
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (getMode() === 'system') apply('system');
    });
  }

  window.HildernwAdminTheme = {
    getMode: getMode,
    setMode: setMode,
    toggle: toggle,
    resolveMode: resolveMode,
    apply: apply
  };

  setMode(getMode(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls);
  } else {
    bindControls();
  }
})();
