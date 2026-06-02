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
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
    'auth/wrong-password': 'Current password is incorrect.',
    'auth/requires-recent-login': 'Please sign out and sign in again, then retry.'
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
  authErrorMessage: authErrorMessage,
  updateDisplayName: function (displayName) {
    var user = auth.currentUser;
    if (!user) return Promise.reject(new Error('Not signed in'));
    return user.updateProfile({ displayName: displayName });
  },
  updatePassword: function (currentPassword, newPassword) {
    var user = auth.currentUser;
    if (!user || !user.email) {
      return Promise.reject({ code: 'auth/user-not-found' });
    }
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    return user.reauthenticateWithCredential(credential).then(function () {
      return user.updatePassword(newPassword);
    });
  }
};
