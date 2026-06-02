'use strict';

var auth = firebase.auth();

function authErrorMessage(code) {
  var messages = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return messages[code] || 'Unable to sign in. Please try again.';
}

window.HildernwAuth = {
  auth: auth,
  signIn: function (email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  },
  signOut: function () {
    return auth.signOut();
  },
  onAuthStateChanged: function (callback) {
    return auth.onAuthStateChanged(callback);
  },
  authErrorMessage: authErrorMessage
};
