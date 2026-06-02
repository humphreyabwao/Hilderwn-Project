'use strict';

/**
 * Admin emails allowed to use the panel.
 * Must match the list in firestore.rules (function isAdmin).
 */
window.HildernwAdminConfig = {
  allowedEmails: [
    'info@hildernwmining.co.ke'
  ],

  isAllowedEmail: function (email) {
    if (!email || typeof email !== 'string') return false;
    var normalized = email.trim().toLowerCase();
    return this.allowedEmails.some(function (allowed) {
      return allowed.toLowerCase() === normalized;
    });
  }
};
