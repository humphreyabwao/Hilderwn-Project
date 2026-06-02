'use strict';

window.initAdminEnquiryModule = function (cfg) {
  if (typeof db === 'undefined' || !db) {
    return { stop: function () {}, start: function () {} };
  }

  if (!cfg || !cfg.idPrefix || !cfg.collection || !cfg.kind) {
    console.error('initAdminEnquiryModule: invalid cfg', cfg);
    return { stop: function () {}, start: function () {} };
  }

  var idPrefix = cfg.idPrefix;
  var COLLECTION = cfg.collection;
  var statKey = cfg.statKey || idPrefix;
  var kind = cfg.kind;
  var backfillFnKey = cfg.backfillFn || '';
  var emptyText = cfg.emptyText || 'No enquiries match your filters.';
  var moduleLabel = cfg.moduleLabel || 'enquiries';

  var STATUSES = cfg.statuses || {
    new: { label: 'New', pill: 'pill--new' },
    contacted: { label: 'Contacted', pill: 'pill--contacted' },
    replied: { label: 'Replied', pill: 'pill--replied' },
    closed: { label: 'Closed', pill: 'pill--closed' }
  };

  var STATUS_ACTIONS = cfg.statusActions || [
    { status: 'contacted', label: 'Mark contacted' },
    { status: 'replied', label: 'Mark replied' },
    { status: 'closed', label: 'Mark closed' },
    { status: 'new', label: 'Reset to new' }
  ];

  var SERVICE_LABELS = {
    'vat-leach': 'Vat Leach Solutions',
    'equipment-rental': 'Equipment & Fleet Rental',
    'mining-support': 'Mining Support Services',
    'partnership': 'Partnership / Investment',
    'other': 'Other Enquiry'
  };

  var DURATION_LABELS = {
    '1-month': '1 Month',
    '3-months': '3 Months',
    '6-months': '6 Months',
    '12-months': '12 Months',
    'custom': 'Custom'
  };

  var EQUIPMENT_LABELS = {
    'excavator': 'Excavator',
    'dump-truck': 'Dump Truck',
    'loader': 'Front-end Loader',
    'drill-rig': 'Drilling Rig',
    'pump': 'Water Pump',
    'multiple': 'Multiple Items'
  };

  var EQUIPMENT_DURATION_LABELS = {
    '1-week': '1 Week',
    '1-month': '1 Month',
    '3-months': '3 Months',
    '6-months': '6 Months+'
  };

  var MINING_SUPPORT_LABELS = {
    'site-prep': 'Site Preparation',
    'geological': 'Geological Surveys',
    'blasting': 'Blasting Coordination',
    'hauling': 'Hauling & Logistics',
    'consulting': 'Operational Consulting',
    'multiple': 'Multiple Services'
  };

  function elId(suffix) {
    return idPrefix + '-' + suffix;
  }

  var els = {
    loading: document.getElementById(elId('loading')),
    tableWrap: document.getElementById(elId('table-wrap')),
    tbody: document.getElementById(elId('tbody')),
    empty: document.getElementById(elId('empty')),
    pagination: document.getElementById(elId('pagination')),
    pageInfo: document.getElementById(elId('page-info')),
    prev: document.getElementById(elId('prev')),
    next: document.getElementById(elId('next')),
    count: document.getElementById(elId('count')),
    search: document.getElementById(elId('search')),
    statusFilter: document.getElementById(elId('status-filter')),
    pageSize: document.getElementById(elId('page-size')),
    refresh: document.getElementById(elId('refresh')),
    modal: document.getElementById(elId('modal')),
    modalBody: document.getElementById(elId('modal-body')),
    modalFoot: document.getElementById(elId('modal-foot'))
  };

  var unsub = null;
  var items = [];
  var pageSize = 25;
  var currentPage = 0;
  var pageCursors = [];
  var hasNextPage = false;
  var statusFilter = 'all';
  var searchQuery = '';
  var searchTimer = null;
  var lifetimeTotal = null;
  var filteredTotal = null;
  var lifetimeUnsub = null;
  var activeModalId = null;
  var activeNotesId = null;
  var notesModalReady = false;
  var controlsBound = false;
  var authUnsub = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function serviceLabel(value) {
    return SERVICE_LABELS[value] || value || '—';
  }

  function durationLabel(value) {
    return DURATION_LABELS[value] || value || '—';
  }

  function equipmentLabel(value) {
    return EQUIPMENT_LABELS[value] || value || '—';
  }

  function equipmentDurationLabel(value) {
    return EQUIPMENT_DURATION_LABELS[value] || value || '—';
  }

  function miningSupportLabel(value) {
    return MINING_SUPPORT_LABELS[value] || value || '—';
  }

  function formatStatusLabel(value) {
    if (!value) return 'New';
    return String(value)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function statusMeta(value) {
    var key = value || 'new';
    return STATUSES[key] || { label: formatStatusLabel(key), pill: 'pill--closed' };
  }

  function isAllowedStatus(status) {
    return !!STATUSES[status] || STATUS_ACTIONS.some(function (a) { return a.status === status; });
  }

  function statusActionsDropdownHtml(id) {
    return STATUS_ACTIONS.map(function (a) {
      return actionOption(id, a.status, a.label);
    }).join('');
  }

  function statusActionsFooterHtml() {
    return STATUS_ACTIONS.map(function (a) {
      var label = a.footerLabel || a.label.replace(/^Mark /, '');
      return statusBtn(a.status, label);
    }).join('');
  }

  function docToItem(doc) {
    var data = doc.data();
    var item = {
      id: doc.id,
      client_id: data.client_id || '',
      name: data.name || 'Unknown',
      company: data.company || '',
      email: data.email || '',
      phone: data.phone || '',
      submitted_at: data.submitted_at || '',
      page: data.page || '',
      status: data.status || 'new',
      admin_notes: data.admin_notes || '',
      status_updated_at: data.status_updated_at || ''
    };

    if (kind === 'contact') {
      item.service = data.service || '';
      item.message = data.message || '';
    } else if (kind === 'vat-leach') {
      item.location = data.location || '';
      item.duration = data.duration || '';
      item.details = data.details || '';
    } else if (kind === 'equipment') {
      item.equipment = data.equipment || '';
      item.duration = data.duration || '';
      item.details = data.details || '';
    } else if (kind === 'mining-support') {
      item.service = data.service || '';
      item.details = data.details || '';
    } else if (kind === 'careers') {
      item.job_id = data.job_id || '';
      item.job_title = data.job_title || 'General application';
      item.message = data.message || '';
    }

    return item;
  }

  function normalizeSearchFields(data) {
    if (data.name) data.name_lower = String(data.name).trim().toLowerCase();
    if (data.email) data.email_lower = String(data.email).trim().toLowerCase();
    if (data.company) data.company_lower = String(data.company).trim().toLowerCase();
    if (!data.status) data.status = 'new';
    return data;
  }

  function buildQuery() {
    var term = searchQuery.trim().toLowerCase();
    var ref = db.collection(COLLECTION);
    var q;

    if (term.length >= 2) {
      if (/^h-?\d/i.test(term)) {
        var idTerm = term.replace(/\s/g, '');
        if (idTerm.charAt(0) === 'h' && idTerm.charAt(1) !== '-') {
          idTerm = 'H-' + idTerm.slice(1);
        } else {
          idTerm = idTerm.charAt(0).toUpperCase() + idTerm.slice(1);
        }
        q = ref.orderBy('client_id').startAt(idTerm).endAt(idTerm + '\uf8ff');
      } else if (term.indexOf('@') !== -1) {
        q = ref.orderBy('email_lower').startAt(term).endAt(term + '\uf8ff');
      } else {
        q = ref.orderBy('name_lower').startAt(term).endAt(term + '\uf8ff');
      }
    } else if (statusFilter !== 'all') {
      q = ref.where('status', '==', statusFilter).orderBy('submitted_at', 'desc');
    } else {
      q = ref.orderBy('submitted_at', 'desc');
    }

    q = q.limit(pageSize);

    if (currentPage > 0 && pageCursors[currentPage - 1]) {
      q = q.startAfter(pageCursors[currentPage - 1]);
    }

    return q;
  }

  function setLoading(on) {
    if (els.loading) els.loading.hidden = !on;
    if (on) {
      if (els.tableWrap) els.tableWrap.hidden = true;
      if (els.empty) els.empty.hidden = true;
      if (els.pagination) els.pagination.hidden = true;
    }
  }

  function updatePaginationUI() {
    if (!els.pagination || !els.pageInfo) return;

    var start = items.length ? currentPage * pageSize + 1 : 0;
    var end = currentPage * pageSize + items.length;
    var totalLabel = '';
    if (searchQuery.trim().length >= 2) {
      totalLabel = ' (search)';
    } else if (statusFilter !== 'all' && filteredTotal !== null) {
      totalLabel = ' of ' + filteredTotal.toLocaleString() + ' matching filter';
    } else if (lifetimeTotal !== null) {
      totalLabel = ' of ' + lifetimeTotal.toLocaleString() + ' total';
    }
    var searchHint = '';

    els.pageInfo.textContent =
      items.length
        ? 'Showing ' + start + '–' + end + totalLabel + searchHint + ' · Page ' + (currentPage + 1)
        : 'No results · Page ' + (currentPage + 1);

    if (els.prev) els.prev.disabled = currentPage === 0;
    if (els.next) els.next.disabled = !hasNextPage;
    els.pagination.hidden = false;
  }

  function updateLifetimeCountUI() {
    if (lifetimeTotal === null) return;
    if (els.count) {
      els.count.textContent = lifetimeTotal.toLocaleString();
      els.count.title = 'Total ever received: ' + lifetimeTotal.toLocaleString();
    }
    var statEl = document.getElementById('stat-' + statKey);
    if (statEl) statEl.textContent = lifetimeTotal.toLocaleString();
    updatePaginationUI();
  }

  function fetchLifetimeTotal() {
    var ref = db.collection(COLLECTION);
    if (typeof ref.count !== 'function') return;

    ref.count().get()
      .then(function (snap) {
        lifetimeTotal = snap.data().count;
        updateLifetimeCountUI();
      })
      .catch(function (err) {
        console.warn(moduleLabel + ' lifetime count:', err);
      });
  }

  function startLifetimeCountListener() {
    stopLifetimeCountListener();
    var ref = db.collection(COLLECTION);

    if (typeof ref.count === 'function') {
      lifetimeUnsub = ref.onSnapshot(
        function () {
          fetchLifetimeTotal();
        },
        function (err) {
          console.warn(moduleLabel + ' lifetime listener:', err);
        }
      );
      fetchLifetimeTotal();
      return;
    }

    lifetimeUnsub = ref.onSnapshot(
      function (snap) {
        lifetimeTotal = snap.size;
        updateLifetimeCountUI();
      },
      function (err) {
        console.warn(moduleLabel + ' lifetime listener:', err);
      }
    );
  }

  function stopLifetimeCountListener() {
    if (lifetimeUnsub) {
      lifetimeUnsub();
      lifetimeUnsub = null;
    }
  }

  function fetchFilteredTotal() {
    if (searchQuery.trim().length >= 2) {
      filteredTotal = null;
      updatePaginationUI();
      return;
    }

    if (statusFilter === 'all') {
      filteredTotal = lifetimeTotal;
      updatePaginationUI();
      return;
    }

    var q = db.collection(COLLECTION).where('status', '==', statusFilter);
    if (typeof q.count !== 'function') {
      filteredTotal = null;
      updatePaginationUI();
      return;
    }

    q.count().get()
      .then(function (snap) {
        filteredTotal = snap.data().count;
        updatePaginationUI();
      })
      .catch(function () {
        filteredTotal = null;
        updatePaginationUI();
      });
  }

  function applicantCells(item) {
    if (kind === 'careers') {
      return (
        '<td><a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a></td>' +
        '<td>' + escapeHtml(item.phone || '—') + '</td>'
      );
    }
    return (
      '<td>' + escapeHtml(item.company || '—') + '</td>' +
      '<td><a href="mailto:' + escapeHtml(item.email) + '">' + escapeHtml(item.email) + '</a></td>'
    );
  }

  function kindSpecificCells(item) {
    if (kind === 'contact') {
      return '<td>' + escapeHtml(serviceLabel(item.service)) + '</td>';
    }
    if (kind === 'vat-leach') {
      return (
        '<td>' + escapeHtml(item.location || '—') + '</td>' +
        '<td>' + escapeHtml(durationLabel(item.duration)) + '</td>'
      );
    }
    if (kind === 'equipment') {
      return (
        '<td>' + escapeHtml(equipmentLabel(item.equipment)) + '</td>' +
        '<td>' + escapeHtml(equipmentDurationLabel(item.duration)) + '</td>'
      );
    }
    if (kind === 'mining-support') {
      return '<td>' + escapeHtml(miningSupportLabel(item.service)) + '</td>';
    }
    if (kind === 'careers') {
      return '<td>' + escapeHtml(item.job_title || 'General application') + '</td>';
    }
    return '';
  }

  function renderTable() {
    closeAllDropdowns();
    setLoading(false);

    if (els.empty) {
      els.empty.textContent = emptyText;
    }

    if (!items.length) {
      if (els.tableWrap) els.tableWrap.hidden = true;
      if (els.empty) els.empty.hidden = false;
      if (els.tbody) els.tbody.innerHTML = '';
      updatePaginationUI();
      return;
    }

    if (els.empty) els.empty.hidden = true;
    if (els.tableWrap) els.tableWrap.hidden = false;

    if (!els.tbody) return;

    els.tbody.innerHTML = items.map(function (item) {
      var st = statusMeta(item.status);
      return (
        '<tr data-id="' + escapeHtml(item.id) + '">' +
          '<td><span class="mod-client-id">' + escapeHtml(item.client_id || '—') + '</span></td>' +
          '<td><strong>' + escapeHtml(item.name) + '</strong></td>' +
          applicantCells(item) +
          kindSpecificCells(item) +
          '<td><span class="mod-pill ' + st.pill + '">' + escapeHtml(st.label) + '</span></td>' +
          '<td class="mod-table__time">' + escapeHtml(formatTime(item.submitted_at)) + '</td>' +
          '<td class="mod-table__actions">' +
            '<button type="button" class="mod-btn mod-btn--sm" data-action="view" data-id="' + escapeHtml(item.id) + '">View</button>' +
            notesButtonHtml(item) +
            '<div class="mod-actions-menu" data-enquiry-prefix="' + escapeHtml(idPrefix) + '">' +
              '<button type="button" class="mod-btn mod-btn--sm mod-btn--ghost" data-action="menu" data-id="' + escapeHtml(item.id) + '" aria-haspopup="true" aria-expanded="false">Status ▾</button>' +
              '<div class="mod-actions-dropdown" hidden data-enquiry-prefix="' + escapeHtml(idPrefix) + '">' +
                statusActionsDropdownHtml(item.id) +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    els.tbody.querySelectorAll('[data-action="view"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(btn.getAttribute('data-id'));
      });
    });

    els.tbody.querySelectorAll('[data-action="notes"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openNotesModal(btn.getAttribute('data-id'));
      });
    });

    els.tbody.querySelectorAll('[data-action="menu"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = btn.getAttribute('aria-expanded') === 'true';
        closeAllDropdowns();
        if (wasOpen) return;
        var wrap = btn.closest('.mod-actions-menu');
        var menu = wrap && wrap.querySelector('.mod-actions-dropdown');
        if (!menu) return;
        openActionsDropdown(btn, menu);
      });
    });

    els.tbody.querySelectorAll('[data-action="status"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var status = btn.getAttribute('data-status');
        closeAllDropdowns();
        updateStatus(id, status);
      });
    });

    updatePaginationUI();
  }

  function actionOption(id, status, label) {
    return (
      '<button type="button" class="mod-actions-dropdown__item" data-action="status" data-id="' +
      escapeHtml(id) + '" data-status="' + escapeHtml(status) + '">' + escapeHtml(label) + '</button>'
    );
  }

  function notesInitials(name) {
    var n = String(name || '').trim();
    if (!n) return '?';
    var parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }

  function notesSecondaryLine(item) {
    if (item.email) return item.email;
    if (kind === 'careers' && item.job_title) return item.job_title;
    if (item.phone) return item.phone;
    if (item.company) return item.company;
    return '';
  }

  function notesSaveButtonInner(label) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>' +
        '<polyline points="17 21 17 13 7 13 7 21"/>' +
        '<polyline points="7 3 7 8 15 8"/>' +
      '</svg>' +
      escapeHtml(label || 'Save notes')
    );
  }

  function notesButtonHtml(item) {
    var hasNotes = !!(item.admin_notes && String(item.admin_notes).trim());
    return (
      '<button type="button" class="mod-btn mod-btn--sm mod-btn--ghost mod-btn--notes' +
      (hasNotes ? ' has-notes' : '') + '" data-action="notes" data-id="' + escapeHtml(item.id) + '" title="' +
      (hasNotes ? 'Edit internal notes' : 'Add internal notes') + '">' +
        'Notes' +
        (hasNotes ? '<span class="mod-notes-dot" aria-hidden="true"></span>' : '') +
      '</button>'
    );
  }

  function ensureNotesModal() {
    if (notesModalReady && els.notesModal) return;

    var existing = document.getElementById(elId('notes-modal'));
    if (!existing) {
      var wrap = document.createElement('div');
      wrap.innerHTML =
        '<div class="mod-modal mod-modal--notes" id="' + escapeHtml(elId('notes-modal')) + '" hidden role="dialog" aria-modal="true" aria-labelledby="' + escapeHtml(elId('notes-modal-title')) + '">' +
          '<div class="mod-modal__backdrop" data-close-notes-modal="' + escapeHtml(idPrefix) + '"></div>' +
          '<div class="mod-modal__box mod-modal__box--notes">' +
            '<header class="mod-modal__head mod-modal__head--notes">' +
              '<div class="mod-notes-modal__title-wrap">' +
                '<span class="mod-notes-modal__icon" aria-hidden="true">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>' +
                    '<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>' +
                  '</svg>' +
                '</span>' +
                '<div>' +
                  '<h3 id="' + escapeHtml(elId('notes-modal-title')) + '">Internal notes</h3>' +
                  '<p class="mod-notes-modal__subtitle">For your team only</p>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="mod-modal__close" data-close-notes-modal="' + escapeHtml(idPrefix) + '" aria-label="Close">&times;</button>' +
            '</header>' +
            '<div class="mod-modal__body mod-modal__body--notes" id="' + escapeHtml(elId('notes-modal-body')) + '"></div>' +
            '<footer class="mod-modal__foot mod-modal__foot--notes" id="' + escapeHtml(elId('notes-modal-foot')) + '"></footer>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap.firstElementChild);
    }

    els.notesModal = document.getElementById(elId('notes-modal'));
    els.notesModalBody = document.getElementById(elId('notes-modal-body'));
    els.notesModalFoot = document.getElementById(elId('notes-modal-foot'));
    notesModalReady = true;

    if (els.notesModal && !els.notesModal.dataset.closeDelegated) {
      els.notesModal.dataset.closeDelegated = 'true';
      els.notesModal.addEventListener('click', function (e) {
        if (!e.target.closest('[data-close-notes-modal="' + idPrefix + '"]')) return;
        e.preventDefault();
        closeNotesModal();
      });
    }
  }

  function renderNotesModalContent(item) {
    if (!item || !els.notesModalBody || !els.notesModalFoot) return;

    var st = statusMeta(item.status);
    var secondary = notesSecondaryLine(item);
    var textareaId = elId('notes-modal-textarea');
    var saveId = elId('notes-modal-save');
    var closeAttr = 'data-close-notes-modal="' + idPrefix + '"';

    els.notesModalBody.innerHTML =
      '<div class="mod-notes-modal">' +
        '<div class="mod-notes-subject">' +
          '<div class="mod-notes-subject__avatar" aria-hidden="true">' + escapeHtml(notesInitials(item.name)) + '</div>' +
          '<div class="mod-notes-subject__main">' +
            (item.client_id
              ? '<span class="mod-client-id mod-client-id--notes">' + escapeHtml(item.client_id) + '</span>'
              : '') +
            '<p class="mod-notes-subject__name">' + escapeHtml(item.name || '—') + '</p>' +
            (secondary ? '<p class="mod-notes-subject__meta">' + escapeHtml(secondary) + '</p>' : '') +
          '</div>' +
          '<div class="mod-notes-subject__aside">' +
            '<span class="mod-pill ' + st.pill + '">' + escapeHtml(st.label) + '</span>' +
            '<time class="mod-notes-subject__time" datetime="' + escapeHtml(item.submitted_at || '') + '">' +
              escapeHtml(formatTime(item.submitted_at)) +
            '</time>' +
          '</div>' +
        '</div>' +
        '<div class="mod-notes-editor">' +
          '<div class="mod-notes-editor__head">' +
            '<label class="mod-notes-editor__label" for="' + escapeHtml(textareaId) + '">Your notes</label>' +
            '<span class="mod-notes-editor__badge">Private</span>' +
          '</div>' +
          '<textarea class="mod-notes mod-notes--field" id="' + escapeHtml(textareaId) + '" rows="7" ' +
            'placeholder="Add context for follow-ups, calls, or handoffs…">' +
            escapeHtml(item.admin_notes || '') +
          '</textarea>' +
        '</div>' +
        '<div class="mod-notes-privacy" role="note">' +
          '<span class="mod-notes-privacy__icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="11" width="18" height="11" rx="2"/>' +
              '<path d="M7 11V7a5 5 0 0110 0v4"/>' +
            '</svg>' +
          '</span>' +
          '<p>Not visible to customers or applicants — admin access only.</p>' +
        '</div>' +
      '</div>';

    els.notesModalFoot.innerHTML =
      '<button type="button" class="mod-btn mod-btn--ghost mod-notes-modal__cancel" ' + closeAttr + '>Cancel</button>' +
      '<button type="button" class="mod-btn mod-btn--save-notes" id="' + escapeHtml(saveId) + '">' +
        notesSaveButtonInner('Save notes') +
      '</button>';

    var saveBtn = document.getElementById(saveId);
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveNotesFromModal(item.id);
      });
    }
  }

  function openNotesModal(id) {
    ensureNotesModal();
    var item = getItem(id);
    if (!item || !els.notesModal) return;

    closeModal();
    closeAllDropdowns();
    activeNotesId = id;
    renderNotesModalContent(item);
    els.notesModal.hidden = false;
    document.body.classList.add('mod-modal-open');

    var ta = document.getElementById(elId('notes-modal-textarea'));
    if (ta) {
      setTimeout(function () {
        ta.focus();
      }, 50);
    }
  }

  function closeNotesModal() {
    if (!els.notesModal) return;
    els.notesModal.hidden = true;
    activeNotesId = null;
    if (els.modal && els.modal.hidden) {
      document.body.classList.remove('mod-modal-open');
    }
  }

  function saveNotesFromModal(id) {
    ensureNotesModal();
    var ta = document.getElementById(elId('notes-modal-textarea'));
    if (!ta) return;

    var notes = ta.value.trim();
    var saveBtn = document.getElementById(elId('notes-modal-save'));

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = notesSaveButtonInner('Saving…');
    }

    db.collection(COLLECTION).doc(id).update({ admin_notes: notes })
      .then(function () {
        var item = getItem(id);
        if (item) item.admin_notes = notes;
        if (saveBtn) {
          saveBtn.innerHTML = notesSaveButtonInner('Saved');
          setTimeout(function () {
            saveBtn.innerHTML = notesSaveButtonInner('Save notes');
            saveBtn.disabled = false;
          }, 1200);
        }
        renderTable();
        if (activeNotesId === id) {
          setTimeout(closeNotesModal, 400);
        }
      })
      .catch(function (err) {
        console.error(moduleLabel + ' notes save failed:', err);
        alert('Could not save notes. Check admin permissions.');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = notesSaveButtonInner('Save notes');
        }
      });
  }

  function saveNotesOnly(id) {
    var ta = document.getElementById(elId('modal-notes'));
    if (ta) {
      saveNotesValue(id, ta.value.trim(), elId('save-notes'));
      return;
    }
    saveNotesFromModal(id);
  }

  function saveNotesValue(id, notes, feedbackBtnId) {
    db.collection(COLLECTION).doc(id).update({ admin_notes: notes })
      .then(function () {
        var item = getItem(id);
        if (item) item.admin_notes = notes;
        if (feedbackBtnId) {
          var btn = document.getElementById(feedbackBtnId);
          if (btn) {
            var prev = btn.textContent;
            btn.textContent = 'Saved';
            setTimeout(function () { btn.textContent = prev; }, 1500);
          }
        }
        renderTable();
      })
      .catch(function (err) {
        console.error(moduleLabel + ' notes save failed:', err);
        alert('Could not save notes.');
      });
  }

  function positionActionsDropdown(btn, menu) {
    menu.hidden = false;
    var rect = btn.getBoundingClientRect();
    var gap = 6;
    var menuW = menu.offsetWidth || 180;
    var menuH = menu.offsetHeight || 160;

    var top = rect.bottom + gap;
    var left = rect.right - menuW;

    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) {
      left = window.innerWidth - menuW - 8;
    }
    if (top + menuH > window.innerHeight - 8) {
      top = rect.top - menuH - gap;
    }
    if (top < 8) top = 8;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  }

  function openActionsDropdown(btn, menu) {
    var wrap = btn.closest('.mod-actions-menu');
    if (!wrap) return;

    menu._returnTo = wrap;
    menu.classList.add('is-floating');
    document.body.appendChild(menu);
    menu.hidden = false;

    requestAnimationFrame(function () {
      positionActionsDropdown(btn, menu);
    });

    btn.setAttribute('aria-expanded', 'true');
    var tr = btn.closest('tr');
    if (tr) tr.classList.add('is-actions-open');

    menu._positionAnchor = btn;
  }

  function closeAllDropdowns() {
    var selector = '.mod-actions-dropdown[data-enquiry-prefix="' + idPrefix + '"]';
    document.querySelectorAll(selector).forEach(function (menu) {
      menu.hidden = true;
      menu.classList.remove('is-floating');
      menu.style.top = '';
      menu.style.left = '';
      menu._positionAnchor = null;

      if (menu._returnTo) {
        menu._returnTo.appendChild(menu);
        menu._returnTo = null;
      }
    });

    if (els.tbody) {
      els.tbody.querySelectorAll('[data-action="menu"]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
      });
      els.tbody.querySelectorAll('tr.is-actions-open').forEach(function (tr) {
        tr.classList.remove('is-actions-open');
      });
    }
  }

  function getItem(id) {
    return items.find(function (i) { return i.id === id; });
  }

  function modalDetailBlock(label, text) {
    if (!text) return '';
    return (
      '<div class="mod-detail__block">' +
        '<span class="mod-detail__label">' + escapeHtml(label) + '</span>' +
        '<p class="mod-detail__message">' + escapeHtml(text) + '</p>' +
      '</div>'
    );
  }

  function modalGridFields(item) {
    var rows = [
      modalRow('Email', item.email, 'mailto:' + encodeURIComponent(item.email)),
      modalRow('Phone', item.phone, item.phone ? 'tel:' + item.phone.replace(/\s/g, '') : '')
    ];

    if (kind === 'careers') {
      rows.push(modalRow('Position', item.job_title));
      if (item.vacancy_id) {
        rows.push(modalRow('Vacancy ref', item.vacancy_id));
      }
    } else {
      rows.push(modalRow('Company', item.company));
    }

    if (kind === 'contact') {
      rows.push(modalRow('Service', serviceLabel(item.service)));
    } else if (kind === 'vat-leach') {
      rows.push(modalRow('Location', item.location));
      rows.push(modalRow('Duration', durationLabel(item.duration)));
    } else if (kind === 'equipment') {
      rows.push(modalRow('Equipment', equipmentLabel(item.equipment)));
      rows.push(modalRow('Duration', equipmentDurationLabel(item.duration)));
    }

    if (item.status_updated_at) {
      rows.push(modalRow('Status updated', formatTime(item.status_updated_at)));
    }

    return rows.join('');
  }

  function messageBlock(item) {
    if (kind === 'contact') {
      return modalDetailBlock('Message', item.message);
    }
    if (kind === 'careers') {
      return modalDetailBlock('Cover note', item.message);
    }
    if (kind === 'vat-leach' || kind === 'equipment' || kind === 'mining-support') {
      return modalDetailBlock('Details', item.details);
    }
    return '';
  }

  function vacancyPreviewHtml(vacancy) {
    if (!vacancy) {
      return (
        '<section class="mod-vacancy-preview">' +
          '<h4>Vacancy details</h4>' +
          '<p class="mod-detail__meta">Vacancy record could not be loaded.</p>' +
        '</section>'
      );
    }

    var reqs = Array.isArray(vacancy.requirements) ? vacancy.requirements : [];
    var benefits = Array.isArray(vacancy.benefits) ? vacancy.benefits : [];
    var vid = vacancy.vacancy_id || '';
    var published = vacancy.active !== false;

    return (
      '<section class="mod-vacancy-preview">' +
        '<h4>Vacancy details</h4>' +
        '<p class="mod-vacancy-preview__meta">' +
          (vid ? '<span>Ref: ' + escapeHtml(vid) + '</span>' : '') +
          '<span>' + escapeHtml(vacancy.employment_type || vacancy.type || '') + '</span>' +
          '<span>' + escapeHtml(vacancy.location || '') + '</span>' +
          (vacancy.posted_label ? '<span>' + escapeHtml(vacancy.posted_label) + '</span>' : '') +
          '<span class="mod-pill ' + (published ? 'pill--replied' : 'pill--closed') + '">' +
            (published ? 'Published' : 'Hidden') +
          '</span>' +
        '</p>' +
        '<p><strong>' + escapeHtml(vacancy.title || '') + '</strong></p>' +
        (vacancy.description
          ? '<p class="mod-detail__message">' + escapeHtml(vacancy.description) + '</p>'
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
      '</section>'
    );
  }

  function renderModalContent(id, item, vacancyData) {
    if (!item || !els.modal || !els.modalBody) return;

    var st = statusMeta(item.status);
    var notesId = elId('modal-notes');
    var saveNotesId = elId('save-notes');
    var closeAttr = 'data-close-modal="' + idPrefix + '"';
    var vacancyBlock = '';

    if (kind === 'careers' && item.job_id && item.job_id !== 'general') {
      vacancyBlock = vacancyPreviewHtml(vacancyData);
    } else if (kind === 'careers' && item.job_title) {
      vacancyBlock =
        '<section class="mod-vacancy-preview">' +
          '<h4>Position</h4>' +
          '<p class="mod-detail__message">' + escapeHtml(item.job_title) + '</p>' +
          '<p class="mod-detail__meta">General application (no linked vacancy).</p>' +
        '</section>';
    }

    els.modalBody.innerHTML =
      '<div class="mod-detail">' +
        '<div class="mod-detail__head mod-detail__head--modal">' +
          '<div>' +
            (item.client_id ? '<p class="mod-client-id mod-client-id--lg">' + escapeHtml(item.client_id) + '</p>' : '') +
            '<h4>' + escapeHtml(item.name) + '</h4>' +
            '<span class="mod-pill ' + st.pill + '">' + escapeHtml(st.label) + '</span>' +
          '</div>' +
          '<span class="mod-detail__time">' + escapeHtml(formatTime(item.submitted_at)) + '</span>' +
        '</div>' +
        '<div class="mod-detail__grid">' +
          modalGridFields(item) +
        '</div>' +
        messageBlock(item) +
        vacancyBlock +
        '<label class="mod-detail__block">' +
          '<span class="mod-detail__label">Admin notes</span>' +
          '<textarea class="mod-notes" id="' + escapeHtml(notesId) + '" rows="3" placeholder="Internal notes…">' + escapeHtml(item.admin_notes) + '</textarea>' +
        '</label>' +
        (item.page ? '<p class="mod-detail__meta">Submitted from ' + escapeHtml(item.page) + '</p>' : '') +
      '</div>';

    els.modalFoot.innerHTML =
      '<button type="button" class="mod-btn mod-btn--ghost" ' + closeAttr + '>Close</button>' +
      '<button type="button" class="mod-btn mod-btn--ghost" id="' + escapeHtml(saveNotesId) + '">Save notes</button>' +
      '<div class="mod-modal__status-btns">' +
        statusActionsFooterHtml() +
      '</div>';

    els.modalFoot.querySelectorAll('[data-modal-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        updateStatus(id, btn.getAttribute('data-modal-status'), true);
      });
    });

    var saveNotes = document.getElementById(saveNotesId);
    if (saveNotes) {
      saveNotes.addEventListener('click', function () {
        saveNotesOnly(id);
      });
    }

    bindModalCloseHandlers();

    els.modal.hidden = false;
    document.body.classList.add('mod-modal-open');
  }

  function openModal(id) {
    var item = getItem(id);
    if (!item || !els.modal || !els.modalBody) return;

    closeNotesModal();
    activeModalId = id;

    if (kind === 'careers' && item.job_id && item.job_id !== 'general') {
      db.collection('vacancies').doc(item.job_id).get()
        .then(function (doc) {
          if (activeModalId !== id) return;
          renderModalContent(id, item, doc.exists ? doc.data() : null);
        })
        .catch(function () {
          if (activeModalId !== id) return;
          renderModalContent(id, item, null);
        });
      return;
    }

    renderModalContent(id, item, null);
  }

  function modalRow(label, value, link) {
    if (!value) return '';
    var valHtml = link
      ? '<a href="' + escapeHtml(link) + '">' + escapeHtml(value) + '</a>'
      : escapeHtml(value);
    return (
      '<div class="mod-detail__row">' +
        '<span class="mod-detail__label">' + escapeHtml(label) + '</span>' +
        '<span class="mod-detail__value">' + valHtml + '</span>' +
      '</div>'
    );
  }

  function statusBtn(status, label) {
    return (
      '<button type="button" class="mod-btn mod-btn--sm mod-btn--status" data-modal-status="' +
      escapeHtml(status) + '">' + escapeHtml(label) + '</button>'
    );
  }

  function bindModalCloseHandlers() {
    if (!els.modal) return;
    els.modal.querySelectorAll('[data-close-modal="' + idPrefix + '"]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.hidden = true;
    activeModalId = null;
    document.body.classList.remove('mod-modal-open');
  }

  function updateStatus(id, status, fromModal) {
    if (!isAllowedStatus(status)) return;

    var payload = {
      status: status,
      status_updated_at: new Date().toISOString()
    };

    db.collection(COLLECTION).doc(id).update(payload)
      .then(function () {
        var item = getItem(id);
        if (item) {
          item.status = status;
          item.status_updated_at = payload.status_updated_at;
        }
        renderTable();
        if (fromModal && activeModalId === id) openModal(id);
      })
      .catch(function (err) {
        console.error(moduleLabel + ' status update failed:', err);
        alert('Could not update status. Check admin permissions.');
      });
  }

  function resetPagination() {
    currentPage = 0;
    pageCursors = [];
    hasNextPage = false;
  }

  function subscribePage() {
    if (unsub) {
      unsub();
      unsub = null;
    }

    setLoading(true);
    closeAllDropdowns();

    unsub = buildQuery().onSnapshot(
      function (snapshot) {
        if (
          window.HildernwEnquiryIds &&
          typeof window.HildernwEnquiryIds.assignClientIdToDocument === 'function'
        ) {
          snapshot.forEach(function (doc) {
            if (!doc.data().client_id) {
              window.HildernwEnquiryIds.assignClientIdToDocument(doc.ref, doc.data());
            }
          });
        }

        items = [];
        snapshot.forEach(function (doc) {
          items.push(docToItem(doc));
        });

        if (searchQuery.trim().length >= 2 && statusFilter !== 'all') {
          items = items.filter(function (i) { return i.status === statusFilter; });
        }

        if (snapshot.docs.length > 0) {
          pageCursors[currentPage] = snapshot.docs[snapshot.docs.length - 1];
        }

        hasNextPage = snapshot.docs.length === pageSize;
        renderTable();
      },
      function (err) {
        console.error(moduleLabel + ' page error:', err);
        setLoading(false);
        if (els.empty) {
          els.empty.textContent =
            'Unable to load ' + moduleLabel + '. Deploy Firestore indexes (see firestore.indexes.json).';
          els.empty.hidden = false;
        }
      }
    );
  }

  function reload() {
    fetchFilteredTotal();
    subscribePage();
  }

  function onDocumentClick(e) {
    if (
      e.target.closest('.mod-actions-menu[data-enquiry-prefix="' + idPrefix + '"]') ||
      e.target.closest('.mod-actions-dropdown[data-enquiry-prefix="' + idPrefix + '"]')
    ) {
      return;
    }
    closeAllDropdowns();
  }

  function onKeydown(e) {
    if (e.key !== 'Escape') return;
    if (els.notesModal && !els.notesModal.hidden) {
      closeNotesModal();
      return;
    }
    if (els.modal && !els.modal.hidden) closeModal();
  }

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    ensureNotesModal();

    if (els.search) {
      els.search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          var next = els.search.value.trim();
          if (next === searchQuery) return;
          searchQuery = next;
          resetPagination();
          reload();
        }, 400);
      });
    }

    if (els.statusFilter) {
      els.statusFilter.addEventListener('change', function () {
        statusFilter = els.statusFilter.value;
        resetPagination();
        reload();
      });
    }

    if (els.pageSize) {
      els.pageSize.addEventListener('change', function () {
        pageSize = parseInt(els.pageSize.value, 10) || 25;
        resetPagination();
        reload();
      });
    }

    if (els.refresh) {
      els.refresh.addEventListener('click', function () {
        reload();
      });
    }

    if (els.prev) {
      els.prev.addEventListener('click', function () {
        if (currentPage > 0) {
          currentPage--;
          subscribePage();
        }
      });
    }

    if (els.next) {
      els.next.addEventListener('click', function () {
        if (hasNextPage) {
          currentPage++;
          subscribePage();
        }
      });
    }

    document.addEventListener('click', onDocumentClick);
    window.addEventListener('resize', closeAllDropdowns);
    window.addEventListener('scroll', closeAllDropdowns, true);

    if (els.tableWrap && !els.tableWrap.dataset.scrollBound) {
      els.tableWrap.dataset.scrollBound = 'true';
      els.tableWrap.addEventListener('scroll', closeAllDropdowns, { passive: true });
    }

    if (els.modal) {
      bindModalCloseHandlers();
    }

    document.addEventListener('keydown', onKeydown);
  }

  function unbindControls() {
    if (!controlsBound) return;
    controlsBound = false;
    document.removeEventListener('click', onDocumentClick);
    window.removeEventListener('resize', closeAllDropdowns);
    window.removeEventListener('scroll', closeAllDropdowns, true);
    document.removeEventListener('keydown', onKeydown);
  }

  function ensureClientIds() {
    var backfillFn =
      typeof window.HildernwEnquiryIds !== 'undefined' &&
      backfillFnKey &&
      typeof window.HildernwEnquiryIds[backfillFnKey] === 'function'
        ? window.HildernwEnquiryIds[backfillFnKey]
        : null;

    if (!backfillFn) {
      return Promise.resolve();
    }

    if (els.loading) {
      els.loading.textContent = 'Assigning client IDs to enquiries…';
      els.loading.hidden = false;
    }

    return backfillFn().catch(function (err) {
      console.warn(moduleLabel + ' client ID backfill:', err);
    });
  }

  function start() {
    bindControls();
    startLifetimeCountListener();
    reload();
    ensureClientIds();
  }

  function stop() {
    if (unsub) {
      unsub();
      unsub = null;
    }
    stopLifetimeCountListener();
    lifetimeTotal = null;
    filteredTotal = null;
    if (els.count) els.count.textContent = '—';
    closeModal();
    closeNotesModal();
    closeAllDropdowns();
    items = [];
    resetPagination();
  }

  function wireAuth() {
    if (typeof HildernwAuth === 'undefined') {
      start();
      return;
    }

    authUnsub = HildernwAuth.onAuthStateChanged(function (user) {
      stop();
      if (user) start();
    });
  }

  wireAuth();

  return {
    stop: stop,
    start: start,
    normalizeSearchFields: normalizeSearchFields,
    destroy: function () {
      stop();
      unbindControls();
      if (authUnsub && typeof authUnsub === 'function') {
        authUnsub();
        authUnsub = null;
      }
    }
  };
};
