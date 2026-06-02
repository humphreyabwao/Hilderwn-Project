'use strict';

(function () {
  var listEl = document.getElementById('careers-list');
  var emptyEl = document.getElementById('careers-empty');
  var liveEl = document.getElementById('careers-live-status');
  var unsub = null;
  var expandedJobIds = {};
  var initialSnapshot = true;

  if (!listEl) return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isVacancyVisible(data) {
    if (!data) return false;
    if (data.active === false || data.active === 'false') return false;
    return true;
  }

  function toList(items) {
    if (!items) return '';
    var arr = Array.isArray(items) ? items : String(items).split('\n').filter(Boolean);
    if (!arr.length) return '';
    return '<ul>' + arr.map(function (item) {
      return '<li>' + escapeHtml(item.trim()) + '</li>';
    }).join('') + '</ul>';
  }

  function formatDescription(text) {
    if (!text) return '';
    return String(text).split('\n').filter(Boolean).map(function (p) {
      return '<p>' + escapeHtml(p.trim()) + '</p>';
    }).join('');
  }

  function rememberExpanded() {
    expandedJobIds = {};
    listEl.querySelectorAll('.careers__job').forEach(function (job) {
      var id = job.getAttribute('data-job-id');
      var btn = job.querySelector('.careers__toggle');
      if (id && btn && btn.getAttribute('aria-expanded') === 'true') {
        expandedJobIds[id] = true;
      }
    });
  }

  function buildJobCard(job, index, isNew) {
    var delay = (0.1 + index * 0.05).toFixed(2);
    var title = escapeHtml(job.title);
    var type = escapeHtml(job.employment_type || job.type || 'Full-time');
    var location = escapeHtml(job.location || 'Warianda');
    var posted = escapeHtml(job.posted_label || job.posted || '');
    var desc = formatDescription(job.description || job.summary || '');
    var reqs = job.requirements ? '<h4>Requirements</h4>' + toList(job.requirements) : '';
    var benefits = job.benefits ? '<h4>What we offer</h4>' + toList(job.benefits) : '';
    var newClass = isNew ? ' careers__job--new' : '';
    var wasOpen = expandedJobIds[job.id];
    var expanded = wasOpen ? 'true' : 'false';
    var detailsOpen = wasOpen ? ' is-open' : '';
    var toggleLabel = wasOpen ? 'Hide Details' : 'View Details';

    return (
      '<article class="careers__job reveal' + newClass + '" style="--delay:' + delay + 's" data-job-id="' + escapeHtml(job.id) + '">' +
        '<div class="careers__job-header">' +
          '<div class="careers__job-info">' +
            '<h3>' + title + '</h3>' +
            '<div class="careers__job-meta">' +
              (job.vacancy_id ? '<span>Ref: ' + escapeHtml(job.vacancy_id) + '</span>' : '') +
              '<span>' + type + '</span>' +
              '<span>' + location + '</span>' +
              (posted ? '<span>Posted: ' + posted + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<button class="careers__toggle" type="button" aria-expanded="' + expanded + '">' +
            '<span class="careers__toggle-label">' + toggleLabel + '</span>' +
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="careers__details' + detailsOpen + '">' +
          '<div class="careers__desc">' + desc + reqs + benefits + '</div>' +
          '<form class="careers__apply" data-firestore="career_applications" novalidate>' +
            '<input type="hidden" name="job_id" value="' + escapeHtml(job.id) + '" />' +
            '<input type="hidden" name="job_title" value="' + title + '" />' +
            (job.vacancy_id ? '<input type="hidden" name="vacancy_id" value="' + escapeHtml(job.vacancy_id) + '" />' : '') +
            '<div class="careers__apply-grid">' +
              '<label class="form-field"><span>Full name</span><input type="text" name="name" required autocomplete="name" /></label>' +
              '<label class="form-field"><span>Email</span><input type="email" name="email" required autocomplete="email" /></label>' +
              '<label class="form-field"><span>Phone</span><input type="tel" name="phone" required autocomplete="tel" /></label>' +
              '<label class="form-field form-field--full"><span>Cover note (optional)</span><textarea name="message" rows="3" placeholder="Brief introduction or relevant experience"></textarea></label>' +
            '</div>' +
            '<button type="submit" class="btn btn--yellow">Apply for this role</button>' +
          '</form>' +
        '</div>' +
      '</article>'
    );
  }

  function setLiveStatus(count, fromCache) {
    if (!liveEl) return;
    if (fromCache) {
      liveEl.textContent = 'Loading live openings…';
      return;
    }
    liveEl.textContent = count
      ? count + ' opening' + (count === 1 ? '' : 's') + ' · updated just now'
      : 'No active openings right now';
  }

  function setLoading(loading) {
    if (loading) {
      listEl.innerHTML = '<p class="careers__loading" aria-live="polite">Loading openings…</p>';
      listEl.style.display = '';
      if (emptyEl) emptyEl.style.display = 'none';
      if (liveEl) liveEl.textContent = 'Connecting…';
    }
  }

  function renderJobs(jobs, highlightIds) {
    highlightIds = highlightIds || {};

    if (!jobs.length) {
      listEl.innerHTML = '';
      listEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = '';
      setLiveStatus(0, false);
      return;
    }

    listEl.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';

    rememberExpanded();

    listEl.innerHTML = jobs.map(function (job, index) {
      return buildJobCard(job, index, !!highlightIds[job.id]);
    }).join('');

    setLiveStatus(jobs.length, false);

    if (typeof window.observeReveals === 'function') {
      window.observeReveals(listEl);
    } else {
      listEl.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('is-visible');
      });
    }

    if (typeof window.initCareerForms === 'function') {
      window.initCareerForms(listEl);
    }

    setTimeout(function () {
      listEl.querySelectorAll('.careers__job--new').forEach(function (el) {
        el.classList.remove('careers__job--new');
      });
    }, 2500);
  }

  function parseSnapshot(snapshot) {
    var jobs = [];
    var highlightIds = {};

    if (snapshot.docChanges) {
      snapshot.docChanges().forEach(function (change) {
        if (change.type === 'added' && isVacancyVisible(change.doc.data())) {
          highlightIds[change.doc.id] = true;
        }
        if (change.type === 'modified' && isVacancyVisible(change.doc.data())) {
          highlightIds[change.doc.id] = true;
        }
      });
    }

    snapshot.forEach(function (doc) {
      var data = doc.data();
      if (!isVacancyVisible(data)) return;
      jobs.push({
        id: doc.id,
        vacancy_id: data.vacancy_id || '',
        title: data.title || 'Untitled role',
        employment_type: data.employment_type || data.type,
        location: data.location,
        posted_label: data.posted_label || data.posted,
        description: data.description || data.summary,
        requirements: data.requirements,
        benefits: data.benefits,
        sort_order: data.sort_order != null ? data.sort_order : 999
      });
    });

    jobs.sort(function (a, b) {
      return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
    });

    return { jobs: jobs, highlightIds: highlightIds };
  }

  function handleSnapshot(snapshot) {
    var parsed = parseSnapshot(snapshot);
    var highlights = initialSnapshot ? {} : parsed.highlightIds;
    initialSnapshot = false;
    renderJobs(parsed.jobs, highlights);
  }

  function startListener() {
    if (typeof db === 'undefined' || !db) {
      setTimeout(startListener, 100);
      return;
    }

    if (unsub) return;

    setLoading(true);

    unsub = db.collection('vacancies').onSnapshot(
      function (snapshot) {
        handleSnapshot(snapshot);
      },
      function (err) {
        console.error('Vacancies listener error:', err);
        if (liveEl) liveEl.textContent = '';
        listEl.innerHTML = '<p class="careers__error">Unable to load openings. Please refresh or email <a href="mailto:info@hildernwmining.co.ke">info@hildernwmining.co.ke</a>.</p>';
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startListener);
  } else {
    startListener();
  }
})();
