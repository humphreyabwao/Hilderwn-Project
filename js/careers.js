'use strict';

(function () {
  var listEl  = document.getElementById('careers-list');
  var emptyEl = document.getElementById('careers-empty');
  if (!listEl || typeof db === 'undefined') return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function buildJobCard(job, index) {
    var delay = (0.1 + index * 0.05).toFixed(2);
    var title = escapeHtml(job.title);
    var type = escapeHtml(job.employment_type || job.type || 'Full-time');
    var location = escapeHtml(job.location || 'Warianda');
    var posted = escapeHtml(job.posted_label || job.posted || '');
    var desc = formatDescription(job.description || job.summary || '');
    var reqs = job.requirements ? '<h4>Requirements</h4>' + toList(job.requirements) : '';
    var benefits = job.benefits ? '<h4>What we offer</h4>' + toList(job.benefits) : '';

    return (
      '<article class="careers__job reveal" style="--delay:' + delay + 's" data-job-id="' + escapeHtml(job.id) + '">' +
        '<div class="careers__job-header">' +
          '<div class="careers__job-info">' +
            '<h3>' + title + '</h3>' +
            '<div class="careers__job-meta">' +
              '<span>' + type + '</span>' +
              '<span>' + location + '</span>' +
              (posted ? '<span>Posted: ' + posted + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<button class="careers__toggle" type="button" aria-expanded="false">' +
            '<span class="careers__toggle-label">View Details</span>' +
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="careers__details">' +
          '<div class="careers__desc">' + desc + reqs + benefits + '</div>' +
          '<form class="careers__apply" data-firestore="career_applications" novalidate>' +
            '<input type="hidden" name="job_id" value="' + escapeHtml(job.id) + '" />' +
            '<input type="hidden" name="job_title" value="' + title + '" />' +
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

  function setLoading(loading) {
    if (loading) {
      listEl.innerHTML = '<p class="careers__loading" aria-live="polite">Loading openings…</p>';
      listEl.style.display = '';
      if (emptyEl) emptyEl.style.display = 'none';
    }
  }

  function renderJobs(jobs) {
    if (!jobs.length) {
      listEl.innerHTML = '';
      listEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }

    listEl.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';
    listEl.innerHTML = jobs.map(buildJobCard).join('');

    if (typeof window.initCareerForms === 'function') {
      window.initCareerForms(listEl);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        if (typeof window.initCareerForms === 'function') {
          window.initCareerForms(listEl);
        }
      });
    }
  }

  setLoading(true);

  db.collection('vacancies').onSnapshot(
    function (snapshot) {
      var jobs = [];
      snapshot.forEach(function (doc) {
        var data = doc.data();
        if (data.active === false) return;
        jobs.push({
          id: doc.id,
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
        return a.sort_order - b.sort_order;
      });

      renderJobs(jobs);
    },
    function (err) {
      console.error('Vacancies listener error:', err);
      listEl.innerHTML = '<p class="careers__error">Unable to load openings. Please refresh or email <a href="mailto:info@hildernwmining.co.ke">info@hildernwmining.co.ke</a>.</p>';
    }
  );
})();
