'use strict';

(function () {
  if (typeof db === 'undefined' || !db) return;

  var SOURCES = (window.HildernwLiveData && window.HildernwLiveData.SOURCES) || [];

  var NOTIFY_LIMIT = 20;
  var DISMISSED_STORAGE_KEY = 'admin-notify-dismissed';

  var els = {
    badge: document.getElementById('admin-notify-badge'),
    newPill: document.getElementById('admin-notify-new-pill'),
    clearBtn: document.getElementById('admin-notify-clear'),
    list: document.getElementById('admin-notify-list'),
    empty: document.getElementById('admin-notify-empty'),
    dropdown: document.getElementById('admin-notify-dropdown')
  };

  var itemsBySource = {};

  var ICONS = {
    contact: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>',
    'vat-leach': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>',
    equipment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="6" width="15" height="10" rx="1"/><circle cx="5.5" cy="18" r="2"/></svg>',
    'mining-support': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    careers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    vacancies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>'
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatRelativeTime(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var sec = Math.floor((Date.now() - t) / 1000);
    if (sec < 45) return 'Just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    if (sec < 604800) return Math.floor(sec / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }

  function isNewItem(data, source) {
    if (!source.hasStatus) return false;
    return (data.status || 'new') === 'new';
  }

  function pickTitle(data, source) {
    if (data.client_id) return data.client_id + ' · ' + (data.name || source.label);
    if (data.name) return data.name;
    if (data.title) return data.title;
    if (data.job_title) return data.job_title;
    if (data.email) return data.email;
    return 'New ' + source.label.toLowerCase();
  }

  function pickMeta(data, source) {
    if (source.hasStatus) {
      var status = data.status || 'new';
      var statusLabel = status === 'new' ? 'Needs review' : status.replace(/-/g, ' ');
      var extra = data.job_title || data.service || data.email || '';
      return source.label + ' · ' + statusLabel + (extra ? ' · ' + extra : '');
    }
    var state = data.active === false ? 'Hidden' : 'Published';
    return source.label + ' · ' + state + (data.vacancy_id ? ' · ' + data.vacancy_id : '');
  }

  function parseDoc(doc, source) {
    var data = doc.data();
    var time = data.submitted_at || data.created_at || data.updated_at || null;
    return {
      id: doc.id,
      sourceKey: source.key,
      sourceLabel: source.label,
      module: source.module,
      title: pickTitle(data, source),
      meta: pickMeta(data, source),
      time: time,
      sortTime: time ? new Date(time).getTime() : 0,
      isNew: isNewItem(data, source)
    };
  }

  function notifyItemId(item) {
    return item.sourceKey + ':' + item.id;
  }

  function getDismissedSet() {
    try {
      var raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveDismissedSet(set) {
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(set));
    } catch (e) { /* ignore quota */ }
  }

  function isDismissed(item, dismissed) {
    return !!(dismissed || getDismissedSet())[notifyItemId(item)];
  }

  function allMergedItems() {
    var merged = [];
    SOURCES.forEach(function (source) {
      (itemsBySource[source.key] || []).forEach(function (item) {
        merged.push(item);
      });
    });
    merged.sort(function (a, b) {
      return b.sortTime - a.sortTime;
    });
    return merged;
  }

  function mergedItems() {
    var dismissed = getDismissedSet();
    return allMergedItems().filter(function (item) {
      return !isDismissed(item, dismissed);
    });
  }

  function pruneDismissedSet() {
    var dismissed = getDismissedSet();
    var liveIds = {};
    allMergedItems().forEach(function (item) {
      liveIds[notifyItemId(item)] = true;
    });
    var changed = false;
    Object.keys(dismissed).forEach(function (key) {
      if (!liveIds[key]) {
        delete dismissed[key];
        changed = true;
      }
    });
    if (changed) saveDismissedSet(dismissed);
  }

  function clearNotifications() {
    var dismissed = getDismissedSet();
    mergedItems().forEach(function (item) {
      dismissed[notifyItemId(item)] = true;
    });
    saveDismissedSet(dismissed);
    renderList();
  }

  function updateClearButton() {
    if (!els.clearBtn) return;
    els.clearBtn.hidden = mergedItems().length === 0;
  }

  function countNew() {
    var n = 0;
    mergedItems().forEach(function (item) {
      if (item.isNew) n += 1;
    });
    return n;
  }

  function updateBadge() {
    var newCount = countNew();

    if (els.badge) {
      if (newCount > 0) {
        els.badge.textContent = newCount > 99 ? '99+' : String(newCount);
        els.badge.hidden = false;
        els.badge.removeAttribute('aria-hidden');
      } else {
        els.badge.hidden = true;
        els.badge.setAttribute('aria-hidden', 'true');
      }
    }

    if (els.newPill) {
      if (newCount > 0) {
        els.newPill.textContent = newCount + ' new';
        els.newPill.hidden = false;
      } else {
        els.newPill.hidden = true;
      }
    }

    updateClearButton();
  }

  function renderList() {
    if (!els.list) return;

    var items = mergedItems().slice(0, NOTIFY_LIMIT);

    if (!items.length) {
      els.list.innerHTML = '';
      if (els.empty) els.empty.hidden = false;
      updateBadge();
      return;
    }

    if (els.empty) els.empty.hidden = true;

    els.list.innerHTML = items.map(function (item) {
      var rowClass = 'admin-notify__item' + (item.isNew ? ' admin-notify__item--new' : '');
      var icon = ICONS[item.sourceKey] || ICONS.contact;
      return (
        '<button type="button" class="' + rowClass + '" role="menuitem" data-module="' + escapeHtml(item.module) + '" data-notify-id="' + escapeHtml(item.sourceKey + ':' + item.id) + '">' +
          (item.isNew ? '<span class="admin-notify__dot" aria-hidden="true"></span>' : '') +
          '<span class="admin-notify__icon admin-notify__icon--' + escapeHtml(item.sourceKey) + '" aria-hidden="true">' + icon + '</span>' +
          '<span class="admin-notify__body">' +
            '<span class="admin-notify__title">' + escapeHtml(item.title) + '</span>' +
            '<span class="admin-notify__meta">' + escapeHtml(item.meta) + '</span>' +
          '</span>' +
          '<span class="admin-notify__time">' + escapeHtml(formatRelativeTime(item.time)) + '</span>' +
        '</button>'
      );
    }).join('');

    updateBadge();
  }

  function onLiveData(e) {
    var source = e.detail.source;
    var snapshot = e.detail.snapshot;
    var items = [];
    snapshot.forEach(function (doc) {
      items.push(parseDoc(doc, source));
    });
    items.sort(function (a, b) {
      return b.sortTime - a.sortTime;
    });
    itemsBySource[source.key] = items;
    pruneDismissedSet();
    renderList();
  }

  function bindClicks() {
    if (!els.list) return;

    els.list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-module]');
      if (!btn) return;
      var mod = btn.getAttribute('data-module');
      if (mod && typeof window.adminGoToModule === 'function') {
        window.adminGoToModule(mod);
      }
      var notifyBtn = document.getElementById('admin-notify-btn');
      var notifyDrop = document.getElementById('admin-notify-dropdown');
      if (notifyBtn) {
        notifyBtn.classList.remove('is-open');
        notifyBtn.setAttribute('aria-expanded', 'false');
      }
      if (notifyDrop) notifyDrop.hidden = true;
    });

    if (els.clearBtn) {
      els.clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearNotifications();
      });
    }

    if (els.dropdown) {
      els.dropdown.querySelectorAll('.admin-notify__view-all').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mod = btn.getAttribute('data-module');
          var notifyBtn = document.getElementById('admin-notify-btn');
          var notifyDrop = document.getElementById('admin-notify-dropdown');
          if (notifyBtn) {
            notifyBtn.classList.remove('is-open');
            notifyBtn.setAttribute('aria-expanded', 'false');
          }
          if (notifyDrop) notifyDrop.hidden = true;
          if (mod && typeof window.adminGoToModule === 'function') {
            window.adminGoToModule(mod);
          }
        });
      });
    }
  }

  bindClicks();

  window.HildernwAdminNotify = {
    getNewCount: countNew,
    refresh: renderList,
    clear: clearNotifications
  };

  document.addEventListener('hildernw-live-data', onLiveData);
})();
