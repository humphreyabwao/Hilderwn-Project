'use strict';

(function () {
  var form = document.getElementById('login-form');
  var emailInput = document.getElementById('login-email');
  var passwordInput = document.getElementById('login-password');
  var submitBtn = document.getElementById('login-submit');
  var errorEl = document.getElementById('login-error');

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('is-visible');
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Signing in…' : 'Sign in';
    if (emailInput) emailInput.disabled = loading;
    if (passwordInput) passwordInput.disabled = loading;
  }

  HildernwAuth.onAuthStateChanged(function (user) {
    if (user) {
      window.location.replace('/admin');
    }
  });

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var email = emailInput.value.trim();
    var password = passwordInput.value;

    if (!email || !password) {
      showError('Enter your email and password.');
      return;
    }

    setLoading(true);

    HildernwAuth.signIn(email, password)
      .then(function () {
        window.location.replace('/admin');
      })
      .catch(function (err) {
        setLoading(false);
        showError(HildernwAuth.authErrorMessage(err.code));
      });
  });
})();
