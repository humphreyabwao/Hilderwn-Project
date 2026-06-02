'use strict';

(function () {
  var app         = document.getElementById('admin-app');
  var sidebar     = document.getElementById('admin-sidebar');
  var overlay     = document.getElementById('admin-overlay');
  var menuBtn     = document.getElementById('admin-menu-btn');
  var collapseBtn = document.getElementById('admin-collapse-btn');
  var navLinks    = document.querySelectorAll('.admin-sidebar [data-module]');
  var modules     = document.querySelectorAll('.admin-module');
  var pageTitle   = document.getElementById('admin-page-title');
  var notifyWrap  = document.getElementById('admin-notify');
  var notifyBtn   = document.getElementById('admin-notify-btn');
  var notifyDrop  = document.getElementById('admin-notify-dropdown');
  var userWrap    = document.getElementById('admin-user');
  var userBtn     = document.getElementById('admin-user-btn');
  var userDrop    = document.getElementById('admin-user-dropdown');

  var labels = {
    dashboard: 'Dashboard',
    contact: 'Contact',
    'vat-leach': 'Vat leach',
    equipment: 'Equipment',
    'mining-support': 'Mining support',
    careers: 'Applications',
    vacancies: 'Vacancies',
    settings: 'Settings'
  };

  function setActiveModule(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-module') === id);
    });

    modules.forEach(function (mod) {
      mod.classList.toggle('is-active', mod.getAttribute('data-module-panel') === id);
    });

    if (pageTitle) pageTitle.textContent = labels[id] || 'Admin';

    closeMobileSidebar();
    closeNotifyDropdown();
    closeUserDropdown();
  }

  function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('is-open');
    if (overlay) overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-visible');
    document.body.style.overflow = '';
  }

  function setSidebarCollapsed(collapsed) {
    if (!app) return;
    app.classList.toggle('is-collapsed', collapsed);
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
    try {
      localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  function toggleSidebarCollapsed() {
    if (!app) return;
    setSidebarCollapsed(!app.classList.contains('is-collapsed'));
  }

  function openNotifyDropdown() {
    if (!notifyBtn || !notifyDrop) return;
    notifyBtn.classList.add('is-open');
    notifyBtn.setAttribute('aria-expanded', 'true');
    notifyDrop.hidden = false;
    if (window.HildernwAdminNotify && typeof window.HildernwAdminNotify.refresh === 'function') {
      window.HildernwAdminNotify.refresh();
    }
  }

  function closeNotifyDropdown() {
    if (!notifyBtn || !notifyDrop) return;
    notifyBtn.classList.remove('is-open');
    notifyBtn.setAttribute('aria-expanded', 'false');
    notifyDrop.hidden = true;
  }

  function toggleNotifyDropdown() {
    if (!notifyDrop || notifyDrop.hidden) {
      closeUserDropdown();
      openNotifyDropdown();
    } else {
      closeNotifyDropdown();
    }
  }

  function openUserDropdown() {
    if (!userBtn || !userDrop) return;
    userBtn.classList.add('is-open');
    userBtn.setAttribute('aria-expanded', 'true');
    userDrop.hidden = false;
  }

  function closeUserDropdown() {
    if (!userBtn || !userDrop) return;
    userBtn.classList.remove('is-open');
    userBtn.setAttribute('aria-expanded', 'false');
    userDrop.hidden = true;
  }

  function toggleUserDropdown() {
    if (!userDrop || userDrop.hidden) {
      closeNotifyDropdown();
      openUserDropdown();
    } else {
      closeUserDropdown();
    }
  }

  /* Restore collapsed state (desktop) */
  try {
    if (localStorage.getItem('admin-sidebar-collapsed') === '1') {
      setSidebarCollapsed(true);
    }
  } catch (e) { /* ignore */ }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      setActiveModule(link.getAttribute('data-module'));
    });
  });

  if (menuBtn) {
    menuBtn.addEventListener('click', openMobileSidebar);
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebarCollapsed);
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }

  if (notifyBtn) {
    notifyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleNotifyDropdown();
    });
  }

  if (userBtn) {
    userBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleUserDropdown();
    });
  }

  if (userDrop) {
    userDrop.querySelectorAll('[data-module], [data-settings-tab]').forEach(function (item) {
      item.addEventListener('click', function () {
        var tab = item.getAttribute('data-settings-tab');
        var mod = item.getAttribute('data-module');
        if (tab) {
          setActiveModule('settings');
          if (typeof window.adminSettingsGoToTab === 'function') {
            window.adminSettingsGoToTab(tab);
          }
          return;
        }
        if (mod) setActiveModule(mod);
      });
    });
  }

  document.addEventListener('click', function (e) {
    if (notifyWrap && !notifyWrap.contains(e.target)) {
      closeNotifyDropdown();
    }
    if (userWrap && !userWrap.contains(e.target)) {
      closeUserDropdown();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeMobileSidebar();
      closeNotifyDropdown();
      closeUserDropdown();
    }
  });

  var adminContent = document.querySelector('.admin-content');
  if (adminContent) {
    adminContent.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-module]');
      if (!trigger || !trigger.closest('.admin-module[data-module-panel="dashboard"]')) return;
      if (!trigger.hasAttribute('data-module')) return;
      var mod = trigger.getAttribute('data-module');
      if (mod && mod !== 'dashboard') setActiveModule(mod);
    });
  }

  window.adminGoToModule = setActiveModule;
})();
