'use strict';

(function () {
  var app = document.getElementById('admin-app');
  var logoutBtn = document.getElementById('admin-logout-btn');
  var userNameEl = document.getElementById('admin-user-name');
  var userDisplayEl = document.getElementById('admin-user-display');
  var userEmailEl = document.getElementById('admin-user-email');
  var avatars = document.querySelectorAll('[data-admin-avatar]');

  function setUserUI(user) {
    var email = user.email || '';
    var name = email.split('@')[0] || 'Admin';
    var initial = name.charAt(0).toUpperCase();

    if (userNameEl) userNameEl.textContent = name;
    if (userDisplayEl) userDisplayEl.textContent = name;
    if (userEmailEl) userEmailEl.textContent = email;

    avatars.forEach(function (el) {
      el.textContent = initial;
    });

    if (logoutBtn) logoutBtn.disabled = false;
  }

  function unlockApp() {
    if (app) app.classList.remove('is-auth-pending');
    document.body.classList.remove('is-auth-pending');
  }

  HildernwAuth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.replace('/admin/login');
      return;
    }

    setUserUI(user);
    unlockApp();
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
