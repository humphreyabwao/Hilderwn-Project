'use strict';

(function () {
  if (typeof db === 'undefined' || !db) return;

  var PROFILE_COLLECTION = 'admin_profiles';
  var PREFS_COLLECTION = 'admin_preferences';

  var els = {
    tabs: document.querySelectorAll('[data-settings-tab]'),
    panels: document.querySelectorAll('[data-settings-panel]'),
    profileForm: document.getElementById('settings-profile-form'),
    passwordForm: document.getElementById('settings-password-form'),
    prefsForm: document.getElementById('settings-prefs-form'),
    displayName: document.getElementById('settings-display-name'),
    jobTitle: document.getElementById('settings-job-title'),
    department: document.getElementById('settings-department'),
    phone: document.getElementById('settings-phone'),
    email: document.getElementById('settings-email'),
    emailPreview: document.getElementById('settings-email-preview'),
    displayPreview: document.getElementById('settings-display-preview'),
    memberSince: document.getElementById('settings-member-since'),
    avatar: document.getElementById('settings-avatar'),
    avatarColor: document.getElementById('settings-avatar-color'),
    profileMsg: document.getElementById('settings-profile-msg'),
    passwordMsg: document.getElementById('settings-password-msg'),
    prefsMsg: document.getElementById('settings-prefs-msg'),
    profileSave: document.getElementById('settings-profile-save'),
    passwordSave: document.getElementById('settings-password-save'),
    prefsSave: document.getElementById('settings-prefs-save'),
    logoutBtn: document.getElementById('settings-logout-btn'),
    pageSize: document.getElementById('settings-page-size'),
    sidebarCollapsed: document.getElementById('settings-sidebar-collapsed'),
    emailNotify: document.getElementById('settings-email-notify'),
    themeMode: document.getElementById('settings-theme-mode')
  };

  var currentUser = null;
  var profileUnsub = null;
  var prefsUnsub = null;
  var activeTab = 'profile';

  function initials(name) {
    if (!name) return 'A';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  function defaultDisplayName(user) {
    if (user.displayName) return user.displayName;
    var email = user.email || '';
    return email.split('@')[0] || 'Admin';
  }

  function formatMemberSince(user) {
    var created = user.metadata && user.metadata.creationTime;
    if (!created) return '';
    try {
      return 'Member since ' + new Date(created).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  function applyAvatarColor(color) {
    if (!els.avatar) return;
    var c = color || '#0ea5e9';
    els.avatar.style.background = c;
    if (els.avatarColor) els.avatarColor.value = c;
  }

  function updatePreview(name, email) {
    var display = name || 'Admin';
    if (els.displayPreview) els.displayPreview.textContent = display;
    if (els.emailPreview) els.emailPreview.textContent = email || '—';
    if (els.avatar) els.avatar.textContent = initials(display);
    document.querySelectorAll('[data-admin-avatar]').forEach(function (el) {
      el.textContent = initials(display);
    });
  }

  function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.classList.toggle('settings__form-msg--error', !!isError);
    el.classList.toggle('settings__form-msg--ok', !isError && !!text);
  }

  function profileRef(uid) {
    return db.collection(PROFILE_COLLECTION).doc(uid);
  }

  function prefsRef(uid) {
    return db.collection(PREFS_COLLECTION).doc(uid);
  }

  function fillProfileForm(user, profile) {
    var display = (profile && profile.display_name) || defaultDisplayName(user);
    if (els.displayName) els.displayName.value = display;
    if (els.jobTitle) els.jobTitle.value = (profile && profile.job_title) || '';
    if (els.department) els.department.value = (profile && profile.department) || '';
    if (els.phone) els.phone.value = (profile && profile.phone) || '';
    if (els.email) els.email.value = user.email || '';
    if (els.memberSince) els.memberSince.textContent = formatMemberSince(user) || '';
    applyAvatarColor(profile && profile.avatar_color);
    updatePreview(display, user.email);
  }

  function fillPrefsForm(prefs) {
    prefs = prefs || {};
    if (els.pageSize) {
      els.pageSize.value = String(prefs.default_page_size || 25);
    }
    if (els.sidebarCollapsed) {
      els.sidebarCollapsed.checked = !!prefs.sidebar_collapsed;
    }
    if (els.emailNotify) {
      els.emailNotify.checked = !!prefs.email_notifications;
      els.emailNotify.disabled = true;
    }
    if (els.themeMode) {
      var theme = prefs.theme_mode || 'system';
      els.themeMode.value = theme;
    }
  }

  function applyPrefsToLocal(prefs) {
    prefs = prefs || {};
    if (prefs.default_page_size) {
      try {
        localStorage.setItem('admin-default-page-size', String(prefs.default_page_size));
      } catch (e) { /* ignore */ }
      document.querySelectorAll('[id$="-page-size"]').forEach(function (sel) {
        if (sel.tagName === 'SELECT') sel.value = String(prefs.default_page_size);
      });
    }
    if (typeof prefs.sidebar_collapsed === 'boolean') {
      try {
        localStorage.setItem('admin-sidebar-collapsed', prefs.sidebar_collapsed ? '1' : '0');
      } catch (e) { /* ignore */ }
      var app = document.getElementById('admin-app');
      if (app) app.classList.toggle('is-collapsed', prefs.sidebar_collapsed);
    }
    if (prefs.theme_mode && window.HildernwAdminTheme) {
      window.HildernwAdminTheme.setMode(prefs.theme_mode);
    }
  }

  function dispatchProfileUpdated(profile) {
    document.dispatchEvent(new CustomEvent('hildernw-admin-profile-updated', {
      detail: profile || {}
    }));
  }

  function setActiveTab(tabId) {
    activeTab = tabId || 'profile';

    document.querySelectorAll('.settings__tab[data-settings-tab]').forEach(function (btn) {
      var on = btn.getAttribute('data-settings-tab') === activeTab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    els.panels.forEach(function (panel) {
      var on = panel.getAttribute('data-settings-panel') === activeTab;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  }

  window.adminSettingsGoToTab = setActiveTab;

  function bindTabs() {
    document.querySelectorAll('.settings__tab[data-settings-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActiveTab(btn.getAttribute('data-settings-tab'));
      });
    });

    document.querySelectorAll('[data-settings-tab]:not(.settings__tab)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-settings-tab');
        if (typeof window.adminGoToModule === 'function') {
          window.adminGoToModule('settings');
        }
        setActiveTab(tab);
      });
    });
  }

  function saveProfile(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    var displayName = els.displayName ? els.displayName.value.trim() : '';
    if (!displayName) {
      showMsg(els.profileMsg, 'Display name is required.', true);
      return;
    }

    var payload = {
      display_name: displayName,
      job_title: els.jobTitle ? els.jobTitle.value.trim() : '',
      department: els.department ? els.department.value.trim() : '',
      phone: els.phone ? els.phone.value.trim() : '',
      avatar_color: els.avatarColor ? els.avatarColor.value : '#0ea5e9',
      email: currentUser.email || '',
      updated_at: new Date().toISOString()
    };

    if (els.profileSave) {
      els.profileSave.disabled = true;
      els.profileSave.textContent = 'Saving…';
    }
    showMsg(els.profileMsg, '', false);

    var authUpdate = HildernwAuth.updateDisplayName
      ? HildernwAuth.updateDisplayName(displayName)
      : Promise.resolve();

    authUpdate
      .then(function () {
        return profileRef(currentUser.uid).set(payload, { merge: true });
      })
      .then(function () {
        showMsg(els.profileMsg, 'Profile saved.', false);
        updatePreview(displayName, currentUser.email);
        applyAvatarColor(payload.avatar_color);
        dispatchProfileUpdated(payload);
      })
      .catch(function (err) {
        console.error('Profile save failed:', err);
        showMsg(els.profileMsg, 'Could not save profile. Try again.', true);
      })
      .finally(function () {
        if (els.profileSave) {
          els.profileSave.disabled = false;
          els.profileSave.textContent = 'Save profile';
        }
      });
  }

  function savePassword(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    var current = document.getElementById('settings-current-password');
    var next = document.getElementById('settings-new-password');
    var confirm = document.getElementById('settings-confirm-password');
    if (!current || !next || !confirm) return;

    var curVal = current.value;
    var newVal = next.value;
    var confVal = confirm.value;

    if (newVal.length < 8) {
      showMsg(els.passwordMsg, 'New password must be at least 8 characters.', true);
      return;
    }
    if (newVal !== confVal) {
      showMsg(els.passwordMsg, 'New passwords do not match.', true);
      return;
    }

    if (els.passwordSave) {
      els.passwordSave.disabled = true;
      els.passwordSave.textContent = 'Updating…';
    }
    showMsg(els.passwordMsg, '', false);

    HildernwAuth.updatePassword(curVal, newVal)
      .then(function () {
        current.value = '';
        next.value = '';
        confirm.value = '';
        showMsg(els.passwordMsg, 'Password updated successfully.', false);
      })
      .catch(function (err) {
        console.error('Password update failed:', err);
        var msg = 'Could not update password.';
        if (err && err.code === 'auth/wrong-password') {
          msg = 'Current password is incorrect.';
        } else if (err && err.code === 'auth/weak-password') {
          msg = 'Password is too weak. Use at least 8 characters.';
        } else if (HildernwAuth.authErrorMessage && err && err.code) {
          msg = HildernwAuth.authErrorMessage(err.code);
        }
        showMsg(els.passwordMsg, msg, true);
      })
      .finally(function () {
        if (els.passwordSave) {
          els.passwordSave.disabled = false;
          els.passwordSave.textContent = 'Update password';
        }
      });
  }

  function savePrefs(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    var payload = {
      default_page_size: parseInt(els.pageSize && els.pageSize.value, 10) || 25,
      sidebar_collapsed: !!(els.sidebarCollapsed && els.sidebarCollapsed.checked),
      email_notifications: !!(els.emailNotify && els.emailNotify.checked),
      theme_mode: els.themeMode ? els.themeMode.value : 'system',
      updated_at: new Date().toISOString()
    };

    if (els.prefsSave) {
      els.prefsSave.disabled = true;
      els.prefsSave.textContent = 'Saving…';
    }
    showMsg(els.prefsMsg, '', false);

    prefsRef(currentUser.uid).set(payload, { merge: true })
      .then(function () {
        applyPrefsToLocal(payload);
        showMsg(els.prefsMsg, 'Preferences saved.', false);
      })
      .catch(function (err) {
        console.error('Preferences save failed:', err);
        showMsg(els.prefsMsg, 'Could not save preferences.', true);
      })
      .finally(function () {
        if (els.prefsSave) {
          els.prefsSave.disabled = false;
          els.prefsSave.textContent = 'Save preferences';
        }
      });
  }

  function subscribeProfile(user) {
    if (profileUnsub) {
      profileUnsub();
      profileUnsub = null;
    }
    profileUnsub = profileRef(user.uid).onSnapshot(
      function (doc) {
        var profile = doc.exists ? doc.data() : null;
        fillProfileForm(user, profile);
        if (profile) dispatchProfileUpdated(profile);
      },
      function (err) {
        console.error('Profile listener error:', err);
        fillProfileForm(user, null);
      }
    );
  }

  function subscribePrefs(user) {
    if (prefsUnsub) {
      prefsUnsub();
      prefsUnsub = null;
    }
    prefsUnsub = prefsRef(user.uid).onSnapshot(
      function (doc) {
        var prefs = doc.exists ? doc.data() : null;
        fillPrefsForm(prefs);
        applyPrefsToLocal(prefs);
      },
      function (err) {
        console.error('Preferences listener error:', err);
        fillPrefsForm(null);
      }
    );
  }

  function start(user) {
    currentUser = user;
    subscribeProfile(user);
    subscribePrefs(user);
  }

  function stop() {
    currentUser = null;
    if (profileUnsub) {
      profileUnsub();
      profileUnsub = null;
    }
    if (prefsUnsub) {
      prefsUnsub();
      prefsUnsub = null;
    }
  }

  function bindForms() {
    if (els.profileForm) els.profileForm.addEventListener('submit', saveProfile);
    if (els.passwordForm) els.passwordForm.addEventListener('submit', savePassword);
    if (els.prefsForm) els.prefsForm.addEventListener('submit', savePrefs);

    if (els.displayName) {
      els.displayName.addEventListener('input', function () {
        updatePreview(els.displayName.value.trim() || 'Admin', currentUser && currentUser.email);
      });
    }

    if (els.avatarColor) {
      els.avatarColor.addEventListener('input', function () {
        applyAvatarColor(els.avatarColor.value);
      });
    }

    if (els.logoutBtn) {
      els.logoutBtn.addEventListener('click', function () {
        var mainLogout = document.getElementById('admin-logout-btn');
        if (mainLogout) mainLogout.click();
      });
    }
  }

  bindTabs();
  bindForms();

  HildernwAuth.onAuthStateChanged(function (user) {
    stop();
    if (user) start(user);
  });
})();
