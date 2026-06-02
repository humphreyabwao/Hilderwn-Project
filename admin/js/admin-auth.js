'use strict';

(function () {
  var app = document.getElementById('admin-app');
  var logoutBtn = document.getElementById('admin-logout-btn');
  var userNameEl = document.getElementById('admin-user-name');
  var userDisplayEl = document.getElementById('admin-user-display');
  var userEmailEl = document.getElementById('admin-user-email');
  var avatars = document.querySelectorAll('[data-admin-avatar]');

  function displayNameFrom(user, profile) {
    if (profile && profile.display_name) return profile.display_name;
    if (user.displayName) return user.displayName;
    var email = user.email || '';
    return email.split('@')[0] || 'Admin';
  }

  function initialsFrom(name) {
    if (!name) return 'A';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  function setUserUI(user, profile) {
    var email = user.email || '';
    var name = displayNameFrom(user, profile);
    var initial = initialsFrom(name);
    var color = profile && profile.avatar_color;

    if (userNameEl) userNameEl.textContent = name;
    if (userDisplayEl) userDisplayEl.textContent = name;
    if (userEmailEl) userEmailEl.textContent = email;

    avatars.forEach(function (el) {
      el.textContent = initial;
      if (color) el.style.background = color;
    });

    if (logoutBtn) logoutBtn.disabled = false;
  }

  function loadProfile(user) {
    if (typeof db === 'undefined' || !db) {
      setUserUI(user, null);
      return;
    }
    db.collection('admin_profiles').doc(user.uid).get()
      .then(function (doc) {
        setUserUI(user, doc.exists ? doc.data() : null);
      })
      .catch(function () {
        setUserUI(user, null);
      });
  }

  function unlockApp() {
    if (app) app.classList.remove('is-auth-pending');
    document.body.classList.remove('is-auth-pending');
  }

  function denyAccess() {
    HildernwAuth.signOut().finally(function () {
      window.location.replace('/admin/login?unauthorized=1');
    });
  }

  HildernwAuth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.replace('/admin/login');
      return;
    }

    if (
      window.HildernwAdminConfig &&
      typeof window.HildernwAdminConfig.isAllowedEmail === 'function' &&
      !window.HildernwAdminConfig.isAllowedEmail(user.email)
    ) {
      denyAccess();
      return;
    }

    loadProfile(user);
    unlockApp();

    if (window.HildernwEnquiryIds) {
      if (typeof window.HildernwEnquiryIds.startRealtimeClientIdWatchers === 'function') {
        window.HildernwEnquiryIds.startRealtimeClientIdWatchers();
      }
      if (typeof window.HildernwEnquiryIds.backfillAllEnquiryClientIds === 'function') {
        window.HildernwEnquiryIds.backfillAllEnquiryClientIds().catch(function (err) {
          console.warn('Global client ID backfill:', err);
        });
      }
      if (typeof window.HildernwVacancyIds.backfillVacancyIds === 'function') {
        window.HildernwVacancyIds.backfillVacancyIds().catch(function (err) {
          console.warn('Vacancy ID backfill:', err);
        });
      }
    }
  });

  document.addEventListener('hildernw-admin-profile-updated', function (e) {
    var user = HildernwAuth.auth && HildernwAuth.auth.currentUser;
    if (user) setUserUI(user, e.detail || null);
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      logoutBtn.disabled = true;
      HildernwAuth.signOut().then(function () {
        window.location.replace('/admin/login');
      }).catch(function () {
        logoutBtn.disabled = false;
      });
    });
  }
})();
