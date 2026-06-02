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

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

var db = typeof firebase.firestore === 'function' ? firebase.firestore() : null;

/* One shared counter — every enquiry type gets the next H-001, H-002, … globally */
var ENQUIRY_COUNTER_ID = 'contact_enquiries';
var ENQUIRY_COLLECTIONS_WITH_ID = [
  'contact_enquiries',
  'vat_leach_rentals',
  'equipment_rentals',
  'mining_support_enquiries',
  'career_applications'
];

function formatClientId(num) {
  var pad = Math.max(3, String(num).length);
  return 'H-' + String(num).padStart(pad, '0');
}

function parseClientIdNumber(clientId) {
  if (!clientId || typeof clientId !== 'string') return 0;
  var m = clientId.match(/^H-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function counterRef() {
  return db.collection('_counters').doc(ENQUIRY_COUNTER_ID);
}

function reserveNextClientId() {
  return db.runTransaction(function (transaction) {
    return transaction.get(counterRef()).then(function (doc) {
      var next = 1;
      if (doc.exists && typeof doc.data().last === 'number') {
        next = doc.data().last + 1;
      }
      transaction.set(counterRef(), { last: next }, { merge: true });
      return formatClientId(next);
    });
  });
}

function reserveClientIdBlock(count) {
  if (!count || count < 1) {
    return Promise.resolve(0);
  }
  return db.runTransaction(function (transaction) {
    return transaction.get(counterRef()).then(function (doc) {
      var last = 0;
      if (doc.exists && typeof doc.data().last === 'number') {
        last = doc.data().last;
      }
      var startNum = last + 1;
      transaction.set(counterRef(), { last: last + count }, { merge: true });
      return startNum;
    });
  });
}

function syncEnquiryCounterFromExisting() {
  var tasks = ENQUIRY_COLLECTIONS_WITH_ID.map(function (col) {
    return db.collection(col).get();
  });
  return Promise.all(tasks).then(function (snaps) {
    var max = 0;
    snaps.forEach(function (snap) {
      snap.forEach(function (doc) {
        var n = parseClientIdNumber(doc.data().client_id);
        if (n > max) max = n;
      });
    });
    return counterRef().set({ last: max }, { merge: true });
  });
}

var FORM_FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  company: 160,
  message: 8000,
  details: 8000,
  location: 160,
  job_title: 200,
  job_id: 80,
  vacancy_id: 20,
  service: 80,
  equipment: 80,
  duration: 40
};

var FORM_ALLOWED_KEYS = [
  'name', 'email', 'phone', 'company', 'message', 'details', 'location',
  'service', 'equipment', 'duration', 'job_id', 'job_title', 'vacancy_id'
];

function trimField(value, max) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ensureHoneypot(form) {
  if (form.querySelector('[name="_gotcha"]')) return;
  var hp = document.createElement('input');
  hp.type = 'text';
  hp.name = '_gotcha';
  hp.tabIndex = -1;
  hp.autocomplete = 'off';
  hp.setAttribute('aria-hidden', 'true');
  hp.className = 'form-honeypot';
  form.appendChild(hp);
}

function sanitizeFormPayload(form) {
  var honeypot = form.querySelector('[name="_gotcha"]');
  if (honeypot && honeypot.value) {
    return { error: 'spam' };
  }

  var data = {};
  FORM_ALLOWED_KEYS.forEach(function (key) {
    var el = form.querySelector('[name="' + key + '"]');
    if (!el) return;
    var max = FORM_FIELD_LIMITS[key] || 500;
    data[key] = trimField(el.value, max);
  });

  if (data.email && !isValidEmail(data.email)) {
    return { error: 'email' };
  }
  if (form.querySelector('[name="name"][required]') && !data.name) {
    return { error: 'name' };
  }
  if (form.querySelector('[name="email"][required]') && !data.email) {
    return { error: 'email' };
  }

  return { data: data };
}

function attachEnquiryFields(data, clientId) {
  data.client_id = clientId;
  data.client_id_lower = clientId.toLowerCase();
  data.status = 'new';
  if (data.name) data.name_lower = String(data.name).trim().toLowerCase();
  if (data.email) data.email_lower = String(data.email).trim().toLowerCase();
  if (data.company) data.company_lower = String(data.company).trim().toLowerCase();
  return data;
}

function backfillCollectionClientIds(collection) {
  return db.collection(collection).orderBy('submitted_at', 'asc').get()
    .then(function (snap) {
      var docs = [];
      snap.forEach(function (doc) {
        if (!doc.data().client_id) docs.push(doc);
      });
      if (!docs.length) return syncEnquiryCounterFromExisting();
      return syncEnquiryCounterFromExisting().then(function () {
        return reserveClientIdBlock(docs.length).then(function (startNum) {
          var batch = db.batch();
          docs.forEach(function (doc, i) {
            var clientId = formatClientId(startNum + i);
            batch.update(doc.ref, {
              client_id: clientId,
              client_id_lower: clientId.toLowerCase(),
              status: doc.data().status || 'new'
            });
          });
          return batch.commit();
        });
      });
    });
}

var assigningIds = {};
var realtimeIdUnsubs = [];
var realtimeWatchersOn = false;

function buildClientIdPatch(existingData, clientId) {
  var patch = {
    client_id: clientId,
    client_id_lower: clientId.toLowerCase()
  };
  var d = existingData || {};
  if (!d.status) patch.status = 'new';
  if (d.name && !d.name_lower) patch.name_lower = String(d.name).trim().toLowerCase();
  if (d.email && !d.email_lower) patch.email_lower = String(d.email).trim().toLowerCase();
  if (d.company && !d.company_lower) patch.company_lower = String(d.company).trim().toLowerCase();
  return patch;
}

/** Assign H-xxx to a single enquiry document (admin realtime / backfill). */
function assignClientIdToDocument(docRef, existingData) {
  var docId = docRef.id;
  if (assigningIds[docId]) return assigningIds[docId];

  assigningIds[docId] = reserveNextClientId()
    .then(function (clientId) {
      return docRef.update(buildClientIdPatch(existingData, clientId));
    })
    .finally(function () {
      delete assigningIds[docId];
    });

  return assigningIds[docId];
}

function processSnapshotForMissingIds(snapshot) {
  if (!snapshot || !snapshot.docChanges) return;
  snapshot.docChanges().forEach(function (change) {
    if (change.type === 'removed') return;
    var data = change.doc.data();
    if (!data.client_id) {
      assignClientIdToDocument(change.doc.ref, data);
    }
  });
}

function startRealtimeClientIdWatchers() {
  if (!db || realtimeWatchersOn) return;
  realtimeWatchersOn = true;

  ENQUIRY_COLLECTIONS_WITH_ID.forEach(function (collection) {
    var unsub = db.collection(collection).onSnapshot(
      processSnapshotForMissingIds,
      function (err) {
        console.warn('Client ID watcher error (' + collection + '):', err);
      }
    );
    realtimeIdUnsubs.push(unsub);
  });
}

function stopRealtimeClientIdWatchers() {
  realtimeIdUnsubs.forEach(function (unsub) {
    if (typeof unsub === 'function') unsub();
  });
  realtimeIdUnsubs = [];
  realtimeWatchersOn = false;
}

window.HildernwEnquiryIds = {
  formatClientId: formatClientId,
  reserveNextClientId: reserveNextClientId,
  reserveClientIdBlock: reserveClientIdBlock,
  syncEnquiryCounterFromExisting: syncEnquiryCounterFromExisting,
  assignClientIdToDocument: assignClientIdToDocument,
  processSnapshotForMissingIds: processSnapshotForMissingIds,
  startRealtimeClientIdWatchers: startRealtimeClientIdWatchers,
  stopRealtimeClientIdWatchers: stopRealtimeClientIdWatchers,
  backfillContactClientIds: function () {
    return backfillCollectionClientIds('contact_enquiries');
  },
  backfillVatLeachClientIds: function () {
    return backfillCollectionClientIds('vat_leach_rentals');
  },
  backfillEquipmentClientIds: function () {
    return backfillCollectionClientIds('equipment_rentals');
  },
  backfillMiningSupportClientIds: function () {
    return backfillCollectionClientIds('mining_support_enquiries');
  },
  backfillCareerApplicationsClientIds: function () {
    return backfillCollectionClientIds('career_applications');
  },
  backfillAllEnquiryClientIds: function () {
    return ENQUIRY_COLLECTIONS_WITH_ID.reduce(function (chain, col) {
      return chain.then(function () {
        return backfillCollectionClientIds(col);
      });
    }, Promise.resolve());
  },
  ENQUIRY_COLLECTIONS_WITH_ID: ENQUIRY_COLLECTIONS_WITH_ID
};

/* ── Vacancy IDs (V-001, V-002, …) — admin-managed listings ── */

var VACANCY_COUNTER_ID = 'vacancies';
var VACANCY_COLLECTION = 'vacancies';
var assigningVacancyIds = {};

function formatVacancyId(num) {
  var pad = Math.max(3, String(num).length);
  return 'V-' + String(num).padStart(pad, '0');
}

function parseVacancyIdNumber(vacancyId) {
  if (!vacancyId || typeof vacancyId !== 'string') return 0;
  var m = vacancyId.match(/^V-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

function vacancyCounterRef() {
  return db.collection('_counters').doc(VACANCY_COUNTER_ID);
}

function reserveNextVacancyId() {
  return db.runTransaction(function (transaction) {
    return transaction.get(vacancyCounterRef()).then(function (doc) {
      var next = 1;
      if (doc.exists && typeof doc.data().last === 'number') {
        next = doc.data().last + 1;
      }
      transaction.set(vacancyCounterRef(), { last: next }, { merge: true });
      return formatVacancyId(next);
    });
  });
}

function reserveVacancyIdBlock(count) {
  if (!count || count < 1) return Promise.resolve(0);
  return db.runTransaction(function (transaction) {
    return transaction.get(vacancyCounterRef()).then(function (doc) {
      var last = 0;
      if (doc.exists && typeof doc.data().last === 'number') {
        last = doc.data().last;
      }
      var startNum = last + 1;
      transaction.set(vacancyCounterRef(), { last: last + count }, { merge: true });
      return startNum;
    });
  });
}

function syncVacancyCounterFromExisting() {
  return db.collection(VACANCY_COLLECTION).get().then(function (snap) {
    var max = 0;
    snap.forEach(function (doc) {
      var n = parseVacancyIdNumber(doc.data().vacancy_id);
      if (n > max) max = n;
    });
    return vacancyCounterRef().set({ last: max }, { merge: true });
  });
}

function backfillVacancyIds() {
  return db.collection(VACANCY_COLLECTION).get()
    .then(function (snap) {
      var docs = [];
      snap.forEach(function (doc) {
        if (!doc.data().vacancy_id) docs.push(doc);
      });
      docs.sort(function (a, b) {
        var ta = a.data().created_at || a.data().updated_at || '';
        var tb = b.data().created_at || b.data().updated_at || '';
        return ta.localeCompare(tb);
      });
      if (!docs.length) return syncVacancyCounterFromExisting();
      return syncVacancyCounterFromExisting().then(function () {
        return reserveVacancyIdBlock(docs.length).then(function (startNum) {
          var batch = db.batch();
          docs.forEach(function (doc, i) {
            var vacancyId = formatVacancyId(startNum + i);
            batch.update(doc.ref, {
              vacancy_id: vacancyId,
              vacancy_id_lower: vacancyId.toLowerCase()
            });
          });
          return batch.commit();
        });
      });
    });
}

function assignVacancyIdToDocument(docRef, existingData) {
  var docId = docRef.id;
  if (assigningVacancyIds[docId]) return assigningVacancyIds[docId];

  assigningVacancyIds[docId] = reserveNextVacancyId()
    .then(function (vacancyId) {
      return docRef.update({
        vacancy_id: vacancyId,
        vacancy_id_lower: vacancyId.toLowerCase()
      });
    })
    .finally(function () {
      delete assigningVacancyIds[docId];
    });

  return assigningVacancyIds[docId];
}

window.HildernwVacancyIds = {
  formatVacancyId: formatVacancyId,
  reserveNextVacancyId: reserveNextVacancyId,
  reserveVacancyIdBlock: reserveVacancyIdBlock,
  syncVacancyCounterFromExisting: syncVacancyCounterFromExisting,
  backfillVacancyIds: backfillVacancyIds,
  assignVacancyIdToDocument: assignVacancyIdToDocument,
  VACANCY_COLLECTION: VACANCY_COLLECTION
};

var lastSubmitAt = 0;
var SUBMIT_COOLDOWN_MS = 4000;

function submitForm(form, collectionName) {
  var btn = form.querySelector('button[type="submit"]');
  var originalText = btn.textContent;

  if (Date.now() - lastSubmitAt < SUBMIT_COOLDOWN_MS) {
    return;
  }

  var sanitized = sanitizeFormPayload(form);
  if (sanitized.error === 'spam') {
    return;
  }
  if (sanitized.error) {
    btn.textContent = 'Check your details';
    setTimeout(function () { btn.textContent = originalText; }, 2500);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  var data = sanitized.data;
  data.submitted_at = new Date().toISOString();
  data.page = String(window.location.pathname || '').slice(0, 300);

  function onSuccess() {
    lastSubmitAt = Date.now();
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
  }

  function onError(err) {
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
  }

  var savePromise;

  if (ENQUIRY_COLLECTIONS_WITH_ID.indexOf(collectionName) !== -1) {
    savePromise = reserveNextClientId().then(function (clientId) {
      attachEnquiryFields(data, clientId);
      return db.collection(collectionName).add(data);
    });
  } else {
    savePromise = db.collection(collectionName).add(data);
  }

  savePromise.then(onSuccess).catch(onError);
}

function bindFirestoreForms(root) {
  var scope = root || document;
  scope.querySelectorAll('[data-firestore]').forEach(function (form) {
    if (form.dataset.firestoreBound === 'true') return;
    form.dataset.firestoreBound = 'true';
    ensureHoneypot(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm(form, form.getAttribute('data-firestore'));
    });
  });
}

window.initCareerForms = bindFirestoreForms;

document.addEventListener('DOMContentLoaded', function () {
  bindFirestoreForms(document);
});
