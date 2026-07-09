/**
 * app-renewal-integration.js — Simple renew subscription button handler
 */

(function() {
  'use strict';

  window.handleRenewalPaymentClick = async function() {
    try {
      console.log('[renewal] Renew subscription clicked');
      await window.handleRenewalPayment();
    } catch (error) {
      console.error('[renewal] Error:', error);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Error: ' + error.message, 'error');
      }
    }
  };

  console.log('[app-renewal-integration] Ready');

})();