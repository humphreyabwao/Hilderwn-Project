'use strict';

(function () {
  if (typeof db === 'undefined' || !db) return;

  var COLLECTION = 'vacancies';

  var els = {
    loading: document.getElementById('vacancies-loading'),
    tableWrap: document.getElementById('vacancies-table-wrap'),
    tbody: document.getElementById('vacancies-tbody'),
    empty: document.getElementById('vacancies-empty'),
    count: document.getElementById('vacancies-count'),
    search: document.getElementById('vacancies-search'),
    filter: document.getElementById('vacancies-filter'),
    refresh: document.getElementById('vacancies-refresh'),
    add: document.getElementById('vacancies-add'),
    modal: document.getElementById('vacancies-modal'),
    modalTitle: document.getElementById('vacancies-modal-title'),
    form: document.getElementById('vacancies-form'),
    formError: document.getElementById('vacancies-form-error'),
    save: document.getElementById('vacancies-save'),
    viewModal: document.getElementById('vacancies-view-modal'),
    viewBody: document.getElementById('vacancies-view-body'),
    viewEdit: document.getElementById('vacancies-view-edit')
  };

  var unsub = null;
  var items = [];
  var searchQuery = '';
  var statusFilter = 'all';
  var editingId = null;
  var viewingId = null;
  var searchTimer = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function linesToArray(text) {
    if (!text || !String(text).trim()) return [];
    return String(text).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function arrayToLines(arr) {
    if (!arr) return '';
    if (Array.isArray(arr)) return arr.join('\n');
    return String(arr);
  }

  function docToItem(doc) {
    var data = doc.data();
    return {
      id: doc.id,
      vacancy_id: data.vacancy_id || '',
      title: data.title || 'Untitled',
      employment_type: data.employment_type || data.type || 'Full-time',
      location: data.location || 'Warianda',
      posted_label: data.posted_label || data.posted || '',
      description: data.description || data.summary || '',
      requirements: data.requirements || [],
      benefits: data.benefits || [],
      active: data.active !== false,
      sort_order: data.sort_order != null ? data.sort_order : 0,
      updated_at: data.updated_at || ''
    };
  }

  function filteredItems() {
    var term = searchQuery.trim().toLowerCase();
    return items.filter(function (item) {
      if (statusFilter === 'active' && !item.active) return false;
      if (statusFilter === 'inactive' && item.active) return false;
      if (!term) return true;
      var hay = (
        item.vacancy_id + ' ' + item.title + ' ' + item.location + ' ' + item.employment_type
      ).toLowerCase();
      if (/^v-?\d/i.test(term)) {
        var idTerm = term.replace(/\s/g, '');
        if (idTerm.charAt(0) === 'v' && idTerm.charAt(1) !== '-') {
          idTerm = 'V-' + idTerm.slice(1);
        } else {
          idTerm = idTerm.charAt(0).toUpperCase() + idTerm.slice(1);
        }
        return item.vacancy_id.toUpperCase().indexOf(idTerm.toUpperCase()) === 0;
      }
      return hay.indexOf(term) !== -1;
    });
  }

  function updateCount() {
    var total = items.length;
    var active = items.filter(function (i) { return i.active; }).length;
    if (els.count) {
      els.count.textContent = total.toLocaleString();
      els.count.title = 'Total vacancies ever created: ' + total.toLocaleString() +
        (active !== total ? ' (' + active + ' published)' : '');
    }
    var statEl = document.getElementById('stat-vacancies');
    if (statEl) statEl.textContent = total.toLocaleString();
  }

  function setLoading(on) {
    if (els.loading) els.loading.hidden = !on;
    if (on && els.tableWrap) els.tableWrap.hidden = true;
  }

  function renderTable() {
    setLoading(false);
    var list = filteredItems();
    list.sort(function (a, b) {
      return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
    });

    updateCount();

    if (!list.length) {
      if (els.tableWrap) els.tableWrap.hidden = true;
      if (els.empty) els.empty.hidden = false;
      if (els.tbody) els.tbody.innerHTML = '';
      return;
    }

    if (els.empty) els.empty.hidden = true;
    if (els.tableWrap) els.tableWrap.hidden = false;
    if (!els.tbody) return;

    els.tbody.innerHTML = list.map(function (item) {
      var statusPill = item.active
        ? '<span class="mod-pill pill--replied">Active</span>'
        : '<span class="mod-pill pill--closed">Hidden</span>';
      return (
        '<tr data-id="' + escapeHtml(item.id) + '">' +
          '<td><span class="mod-vacancy-id">' + escapeHtml(item.vacancy_id || '—') + '</span></td>' +
          '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
          '<td>' + escapeHtml(item.employment_type) + '</td>' +
          '<td>' + escapeHtml(item.location) + '</td>' +
          '<td>' + escapeHtml(item.posted_label || '—') + '</td>' +
          '<td>' + escapeHtml(String(item.sort_order)) + '</td>' +
          '<td>' + statusPill + '</td>' +
          '<td class="mod-table__actions">' +
            '<button type="button" class="mod-btn mod-btn--sm" data-action="view" data-id="' + escapeHtml(item.id) + '">View</button>' +
            '<button type="button" class="mod-btn mod-btn--sm mod-btn--ghost" data-action="edit" data-id="' + escapeHtml(item.id) + '">Edit</button>' +
            '<button type="button" class="mod-btn mod-btn--sm mod-btn--ghost" data-action="toggle" data-id="' + escapeHtml(item.id) + '">' +
              (item.active ? 'Hide' : 'Publish') +
            '</button>' +
            '<button type="button" class="mod-btn mod-btn--sm mod-btn--danger" data-action="delete" data-id="' + escapeHtml(item.id) + '">Delete</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    els.tbody.querySelectorAll('[data-action="view"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openViewModal(btn.getAttribute('data-id'));
      });
    });

    els.tbody.querySelectorAll('[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(btn.getAttribute('data-id'));
      });
    });

    els.tbody.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleActive(btn.getAttribute('data-id'));
      });
    });

    els.tbody.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteVacancy(btn.getAttribute('data-id'));
      });
    });
  }

  function getItem(id) {
    return items.find(function (i) { return i.id === id; });
  }

  function renderVacancyViewHtml(item) {
    var reqs = Array.isArray(item.requirements) ? item.requirements : [];
    var benefits = Array.isArray(item.benefits) ? item.benefits : [];
    var published = item.active;

    return (
      '<div class="mod-detail">' +
        '<div class="mod-detail__head mod-detail__head--modal">' +
          '<div>' +
            (item.vacancy_id ? '<p class="mod-vacancy-id mod-client-id--lg">' + escapeHtml(item.vacancy_id) + '</p>' : '') +
            '<h4>' + escapeHtml(item.title) + '</h4>' +
            '<span class="mod-pill ' + (published ? 'pill--replied' : 'pill--closed') + '">' +
              (published ? 'Published' : 'Hidden') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<p class="mod-vacancy-preview__meta">' +
          '<span>' + escapeHtml(item.employment_type) + '</span>' +
          '<span>' + escapeHtml(item.location) + '</span>' +
          (item.posted_label ? '<span>' + escapeHtml(item.posted_label) + '</span>' : '') +
          '<span>Sort: ' + escapeHtml(String(item.sort_order)) + '</span>' +
        '</p>' +
        (item.description
          ? '<div class="mod-detail__block"><span class="mod-detail__label">Description</span><p class="mod-detail__message">' + escapeHtml(item.description) + '</p></div>'
          : '') +
        (reqs.length
          ? '<div class="mod-detail__block"><span class="mod-detail__label">Requirements</span><ul class="mod-detail__list">' +
              reqs.map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('') +
            '</ul></div>'
          : '') +
        (benefits.length
          ? '<div class="mod-detail__block"><span class="mod-detail__label">Benefits</span><ul class="mod-detail__list">' +
              benefits.map(function (b) { return '<li>' + escapeHtml(b) + '</li>'; }).join('') +
            '</ul></div>'
          : '') +
      '</div>'
    );
  }

  function openViewModal(id) {
    var item = getItem(id);
    if (!item || !els.viewModal || !els.viewBody) return;

    viewingId = id;
    els.viewBody.innerHTML = renderVacancyViewHtml(item);
    els.viewModal.hidden = false;
    document.body.classList.add('mod-modal-open');
  }

  function closeViewModal() {
    if (!els.viewModal) return;
    els.viewModal.hidden = true;
    viewingId = null;
    if (!els.modal || els.modal.hidden) {
      document.body.classList.remove('mod-modal-open');
    }
  }

  function openModal(id) {
    closeViewModal();
    editingId = id || null;
    if (!els.modal || !els.form) return;

    if (els.formError) {
      els.formError.hidden = true;
      els.formError.textContent = '';
    }

    if (editingId) {
      var item = getItem(editingId);
      if (!item) return;
      if (els.modalTitle) els.modalTitle.textContent = 'Edit vacancy';
      if (els.save) els.save.textContent = 'Update vacancy';
      document.getElementById('vac-field-title').value = item.title;
      document.getElementById('vac-field-type').value = item.employment_type;
      document.getElementById('vac-field-location').value = item.location;
      document.getElementById('vac-field-posted').value = item.posted_label;
      document.getElementById('vac-field-sort').value = String(item.sort_order);
      document.getElementById('vac-field-active').checked = item.active;
      document.getElementById('vac-field-description').value = item.description;
      document.getElementById('vac-field-requirements').value = arrayToLines(item.requirements);
      document.getElementById('vac-field-benefits').value = arrayToLines(item.benefits);
      var idField = document.getElementById('vac-field-vacancy-id');
      if (idField) idField.value = item.vacancy_id || '';
    } else {
      if (els.modalTitle) els.modalTitle.textContent = 'Add vacancy';
      if (els.save) els.save.textContent = 'Save vacancy';
      els.form.reset();
      document.getElementById('vac-field-location').value = 'Warianda';
      document.getElementById('vac-field-sort').value = '0';
      document.getElementById('vac-field-active').checked = true;
      var idFieldNew = document.getElementById('vac-field-vacancy-id');
      if (idFieldNew) idFieldNew.value = '';
    }

    els.modal.hidden = false;
    document.body.classList.add('mod-modal-open');
    document.getElementById('vac-field-title').focus();
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.hidden = true;
    editingId = null;
    document.body.classList.remove('mod-modal-open');
  }

  function buildPayload() {
    var now = new Date().toISOString();
    return {
      title: document.getElementById('vac-field-title').value.trim(),
      employment_type: document.getElementById('vac-field-type').value,
      location: document.getElementById('vac-field-location').value.trim() || 'Warianda',
      posted_label: document.getElementById('vac-field-posted').value.trim(),
      description: document.getElementById('vac-field-description').value.trim(),
      requirements: linesToArray(document.getElementById('vac-field-requirements').value),
      benefits: linesToArray(document.getElementById('vac-field-benefits').value),
      active: document.getElementById('vac-field-active').checked === true,
      sort_order: parseInt(document.getElementById('vac-field-sort').value, 10) || 0,
      updated_at: now
    };
  }

  function showFormError(msg) {
    if (!els.formError) return;
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }

  function saveVacancy(e) {
    if (e) e.preventDefault();
    var payload = buildPayload();
    if (!payload.title || !payload.description) {
      showFormError('Title and description are required.');
      return;
    }

    if (els.save) {
      els.save.disabled = true;
      els.save.textContent = 'Saving…';
    }

    var promise;
    if (editingId) {
      promise = db.collection(COLLECTION).doc(editingId).update(payload);
    } else if (window.HildernwVacancyIds && window.HildernwVacancyIds.reserveNextVacancyId) {
      promise = window.HildernwVacancyIds.reserveNextVacancyId().then(function (vacancyId) {
        payload.vacancy_id = vacancyId;
        payload.vacancy_id_lower = vacancyId.toLowerCase();
        payload.created_at = payload.updated_at;
        return db.collection(COLLECTION).add(payload);
      });
    } else {
      payload.created_at = payload.updated_at;
      promise = db.collection(COLLECTION).add(payload);
    }

    promise
      .then(function () {
        closeModal();
      })
      .catch(function (err) {
        console.error('Save vacancy failed:', err);
        showFormError('Could not save. Check you are signed in and rules are deployed.');
      })
      .finally(function () {
        if (els.save) {
          els.save.disabled = false;
          els.save.textContent = editingId ? 'Update vacancy' : 'Save vacancy';
        }
      });
  }

  function toggleActive(id) {
    var item = getItem(id);
    if (!item) return;
    db.collection(COLLECTION).doc(id).update({
      active: !item.active,
      updated_at: new Date().toISOString()
    }).catch(function (err) {
      console.error('Toggle vacancy failed:', err);
      alert('Could not update listing status.');
    });
  }

  function deleteVacancy(id) {
    var item = getItem(id);
    if (!item) return;
    if (!window.confirm('Delete “' + item.title + '”? This cannot be undone.')) return;
    db.collection(COLLECTION).doc(id).delete().catch(function (err) {
      console.error('Delete vacancy failed:', err);
      alert('Could not delete vacancy.');
    });
  }

  function subscribe() {
    if (unsub) {
      unsub();
      unsub = null;
    }
    setLoading(true);
    unsub = db.collection(COLLECTION).onSnapshot(
      function (snapshot) {
        if (window.HildernwVacancyIds && window.HildernwVacancyIds.assignVacancyIdToDocument) {
          snapshot.forEach(function (doc) {
            if (!doc.data().vacancy_id) {
              window.HildernwVacancyIds.assignVacancyIdToDocument(doc.ref, doc.data());
            }
          });
        }
        items = [];
        snapshot.forEach(function (doc) {
          items.push(docToItem(doc));
        });
        renderTable();
      },
      function (err) {
        console.error('Vacancies error:', err);
        setLoading(false);
        if (els.empty) {
          els.empty.textContent = 'Unable to load vacancies. Check Firestore rules for admin access.';
          els.empty.hidden = false;
        }
      }
    );
  }

  function bindControls() {
    if (els.search) {
      els.search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          searchQuery = els.search.value;
          renderTable();
        }, 300);
      });
    }

    if (els.filter) {
      els.filter.addEventListener('change', function () {
        statusFilter = els.filter.value;
        renderTable();
      });
    }

    if (els.refresh) els.refresh.addEventListener('click', subscribe);
    if (els.add) els.add.addEventListener('click', function () { openModal(null); });

    if (els.form) els.form.addEventListener('submit', saveVacancy);

    document.querySelectorAll('[data-close-vacancy-modal]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    document.querySelectorAll('[data-close-vacancy-view]').forEach(function (el) {
      el.addEventListener('click', closeViewModal);
    });

    if (els.viewEdit) {
      els.viewEdit.addEventListener('click', function () {
        var id = viewingId;
        closeViewModal();
        if (id) openModal(id);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (els.viewModal && !els.viewModal.hidden) {
        closeViewModal();
        return;
      }
      if (els.modal && !els.modal.hidden) closeModal();
    });
  }

  function ensureVacancyIds() {
    if (window.HildernwVacancyIds && typeof window.HildernwVacancyIds.backfillVacancyIds === 'function') {
      return window.HildernwVacancyIds.backfillVacancyIds().catch(function (err) {
        console.warn('Vacancy ID backfill:', err);
      });
    }
    return Promise.resolve();
  }

  function start() {
    bindControls();
    ensureVacancyIds().finally(subscribe);
  }

  function stop() {
    if (unsub) {
      unsub();
      unsub = null;
    }
    closeModal();
    closeViewModal();
  }

  if (typeof HildernwAuth !== 'undefined') {
    HildernwAuth.onAuthStateChanged(function (user) {
      stop();
      if (user) start();
    });
  } else {
    start();
  }
})();
