'use strict';

var firebaseConfig = {
  apiKey: "AIzaSyAmgsShvh3WRHYo-F6j2BlGFGfkHWSMH10",
  authDomain: "hildernw-project.firebaseapp.com",
  databaseURL: "https://hildernw-project-default-rtdb.firebaseio.com",
  projectId: "hildernw-project",
  storageBucket: "hildernw-project.firebasestorage.app",
  messagingSenderId: "869220187067",
  appId: "1:869220187067:web:ac5df5b3b922a1d630629e",
  measurementId: "G-X0L8P9DQY1"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

function submitForm(form, collectionName) {
  var btn = form.querySelector('button[type="submit"]');
  var originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Sending...';

  var data = {};
  var inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(function (el) {
    if (el.name) {
      data[el.name] = el.value;
    }
  });

  data.submitted_at = new Date().toISOString();
  data.page = window.location.pathname;

  db.collection(collectionName).add(data)
    .then(function () {
      btn.textContent = 'Sent!';
      btn.style.background = '#059669';
      btn.style.borderColor = '#059669';
      btn.style.color = '#fff';
      form.reset();

      setTimeout(function () {
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 3000);
    })
    .catch(function (err) {
      console.error('Firestore error:', err);
      btn.textContent = 'Error — try again';
      btn.style.background = '#dc2626';
      btn.style.borderColor = '#dc2626';
      btn.style.color = '#fff';
      btn.disabled = false;

      setTimeout(function () {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 3000);
    });
}

function bindFirestoreForms(root) {
  var scope = root || document;
  scope.querySelectorAll('[data-firestore]').forEach(function (form) {
    if (form.dataset.firestoreBound === 'true') return;
    form.dataset.firestoreBound = 'true';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var collection = form.getAttribute('data-firestore');
      submitForm(form, collection);
    });
  });
}

window.initCareerForms = bindFirestoreForms;

document.addEventListener('DOMContentLoaded', function () {
  bindFirestoreForms(document);
});
