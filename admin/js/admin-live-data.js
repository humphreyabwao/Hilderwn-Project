'use strict';

/**
 * Single shared Firestore listener per collection (reduces duplicate reads).
 */
(function () {
  if (typeof db === 'undefined' || !db) return;

  window.HildernwLiveData = window.HildernwLiveData || {
    SOURCES: [
      { key: 'contact', collection: 'contact_enquiries', label: 'Contact', module: 'contact', hasStatus: true },
      { key: 'vat-leach', collection: 'vat_leach_rentals', label: 'Vat leach', module: 'vat-leach', hasStatus: true },
      { key: 'equipment', collection: 'equipment_rentals', label: 'Equipment', module: 'equipment', hasStatus: true },
      { key: 'mining-support', collection: 'mining_support_enquiries', label: 'Mining support', module: 'mining-support', hasStatus: true },
      { key: 'careers', collection: 'career_applications', label: 'Application', module: 'careers', hasStatus: true },
      { key: 'vacancies', collection: 'vacancies', label: 'Vacancy', module: 'vacancies', hasStatus: false }
    ],
    _unsubs: [],
    _counts: {},

    getCount: function (key) {
      return this._counts[key] != null ? this._counts[key] : 0;
    },

    stop: function () {
      this._unsubs.forEach(function (u) {
        if (typeof u === 'function') u();
      });
      this._unsubs = [];
      this._counts = {};
    },

    start: function () {
      var self = this;
      this.stop();

      this.SOURCES.forEach(function (source) {
        var unsub = db.collection(source.collection).onSnapshot(
          function (snapshot) {
            self._counts[source.key] = snapshot.size;
            document.dispatchEvent(new CustomEvent('hildernw-live-data', {
              detail: {
                source: source,
                snapshot: snapshot,
                size: snapshot.size
              }
            }));
          },
          function (err) {
            console.error('Live data error:', source.collection, err);
            self._counts[source.key] = 0;
            document.dispatchEvent(new CustomEvent('hildernw-live-data-error', {
              detail: { source: source, error: err }
            }));
          }
        );
        self._unsubs.push(unsub);
      });
    }
  };

  if (typeof HildernwAuth !== 'undefined') {
    HildernwAuth.onAuthStateChanged(function (user) {
      if (user) {
        window.HildernwLiveData.start();
      } else {
        window.HildernwLiveData.stop();
      }
    });
  } else {
    window.HildernwLiveData.start();
  }
})();
