'use strict';

(function () {
  if (typeof db === 'undefined' || !db) return;

  var SOURCES = [
    { key: 'contact', collection: 'contact_enquiries', label: 'Contact', module: 'contact' },
    { key: 'vat-leach', collection: 'vat_leach_rentals', label: 'Vat leach', module: 'vat-leach' },
    { key: 'equipment', collection: 'equipment_rentals', label: 'Equipment', module: 'equipment' },
    { key: 'mining-support', collection: 'mining_support_enquiries', label: 'Mining support', module: 'mining-support' },
    { key: 'careers', collection: 'career_applications', label: 'Application', module: 'careers' },
    { key: 'vacancies', collection: 'vacancies', label: 'Vacancy', module: 'vacancies' }
  ];

  var CLEARED_STORAGE_PREFIX = 'admin-recent-cleared-';
  var RECENT_LIMIT = 20;

  var recentBySource = {};
  var recentEl = document.getElementById('dash-recent');
  var clearBtn = document.getElementById('dash-recent-clear');
  var alertEl = document.getElementById('dash-alert');

  function todayDateKey() {
    var n = new Date();
    var y = n.getFullYear();
    var m = String(n.getMonth() + 1).padStart(2, '0');
    var d = String(n.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function isToday(iso) {
    if (!iso) return false;
    var t = new Date(iso).getTime();
    if (isNaN(t)) return false;
    var item = new Date(t);
    var now = new Date();
    return (
      item.getFullYear() === now.getFullYear() &&
      item.getMonth() === now.getMonth() &&
      item.getDate() === now.getDate()
    );
  }

  function activityId(item) {
    return item.source.key + ':' + item.id;
  }

  function getClearedSet() {
    try {
      var raw = localStorage.getItem(CLEARED_STORAGE_PREFIX + todayDateKey());
      if (!raw) return {};
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return {};
      var map = {};
      list.forEach(function (id) {
        map[id] = true;
      });
      return map;
    } catch (e) {
      return {};
    }
  }

  function saveClearedSet(map) {
    try {
      var ids = Object.keys(map);
      localStorage.setItem(CLEARED_STORAGE_PREFIX + todayDateKey(), JSON.stringify(ids));
    } catch (e) { /* ignore */ }
  }

  function formatActivityTime(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    if (isToday(iso)) {
      return new Date(t).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }

  function pickTitle(data, label) {
    if (data.vacancy_id && data.title) return data.vacancy_id + ' · ' + data.title;
    if (data.vacancy_id) return data.vacancy_id;
    if (data.name) return data.name;
    if (data.email) return data.email;
    if (data.job_title) return data.job_title;
    if (data.title) return data.title;
    return label;
  }

  function pickMeta(data, source) {
    if (
      (source.key === 'contact' ||
        source.key === 'vat-leach' ||
        source.key === 'equipment' ||
        source.key === 'mining-support' ||
        source.key === 'careers') &&
      data.client_id
    ) {
      return data.client_id;
    }
    if (source.key === 'vacancies' && data.vacancy_id) return data.vacancy_id;
    if (source.key === 'careers' && data.job_title) return data.job_title;
    if (data.email) return data.email;
    if (data.phone) return data.phone;
    if (data.message) return String(data.message).slice(0, 60);
    return source.label;
  }

  function parseDoc(doc, source) {
    var data = doc.data();
    var time = data.submitted_at || data.created_at || data.updated_at || null;
    return {
      id: doc.id,
      source: source,
      title: pickTitle(data, source.label),
      meta: pickMeta(data, source),
      time: time,
      sortTime: time ? new Date(time).getTime() : 0,
      module: source.module
    };
  }

  function updateStatEl(key, value) {
    var el = document.getElementById('stat-' + key);
    if (!el) return;
    if (value === '!') {
      el.textContent = '!';
      return;
    }
    var n = typeof value === 'number' ? value : parseInt(value, 10);
    el.textContent = isNaN(n) ? '—' : n.toLocaleString();
    el.title = isNaN(n) ? '' : n.toLocaleString() + ' total all time';
  }

  function mergedTodayItems() {
    var merged = [];
    SOURCES.forEach(function (source) {
      (recentBySource[source.key] || []).forEach(function (item) {
        if (isToday(item.time)) merged.push(item);
      });
    });
    merged.sort(function (a, b) {
      return b.sortTime - a.sortTime;
    });
    return merged;
  }

  function visibleTodayItems() {
    var cleared = getClearedSet();
    return mergedTodayItems().filter(function (item) {
      return !cleared[activityId(item)];
    });
  }

  function renderRecent() {
    if (!recentEl) return;

    var todayAll = mergedTodayItems();
    var visible = visibleTodayItems();
    var top = visible.slice(0, RECENT_LIMIT);

    if (clearBtn) {
      clearBtn.hidden = visible.length === 0;
    }

    if (!top.length) {
      recentEl.innerHTML = todayAll.length
        ? '<p class="dash-recent__empty">No activity to show — cleared for today.</p>'
        : '<p class="dash-recent__empty">No activity yet today.</p>';
      return;
    }

    recentEl.innerHTML = top.map(function (item) {
      return (
        '<button type="button" class="dash-recent__item" data-module="' + escapeHtml(item.module) + '">' +
          '<span class="dash-recent__main">' +
            '<strong>' + escapeHtml(item.title) + '</strong>' +
            '<small>' + escapeHtml(item.source.label) + ' · ' + escapeHtml(item.meta) + '</small>' +
          '</span>' +
          '<span class="dash-recent__time">' + escapeHtml(formatActivityTime(item.time)) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function clearTodayActivities() {
    var cleared = getClearedSet();
    mergedTodayItems().forEach(function (item) {
      cleared[activityId(item)] = true;
    });
    saveClearedSet(cleared);
    renderRecent();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.hidden = false;
  }

  function onLiveData(e) {
    var source = e.detail.source;
    var snapshot = e.detail.snapshot;
    updateStatEl(source.key, snapshot.size);

    var items = [];
    snapshot.forEach(function (doc) {
      var item = parseDoc(doc, source);
      if (isToday(item.time)) items.push(item);
    });
    items.sort(function (a, b) {
      return b.sortTime - a.sortTime;
    });
    recentBySource[source.key] = items;
    renderRecent();
  }

  function onLiveDataError(e) {
    updateStatEl(e.detail.source.key, '!');
    showAlert('Unable to load live data. Check you are signed in with an authorised admin account.');
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearTodayActivities);
  }

  document.addEventListener('hildernw-live-data', onLiveData);
  document.addEventListener('hildernw-live-data-error', onLiveDataError);
})();
