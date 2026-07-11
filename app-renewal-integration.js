/**
 * app-renewal-integration.js — Renewal subscription button handler
 */

(function() {
  'use strict';

  window.handleRenewalPaymentClick = async function() {
    try {
      console.log('[renewal-integration] Renew subscription clicked');
      
      if (typeof window.handleRenewalPayment !== 'function') {
        console.error('[renewal-integration] handleRenewalPayment not available');
        if (typeof window.showNotification === 'function') {
          window.showNotification('Payment system not ready. Please refresh the page.', 'error');
        }
        return;
      }
      
      await window.handleRenewalPayment();
    } catch (error) {
      console.error('[renewal-integration] Error:', error);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Error: ' + error.message, 'error');
      }
    }
  };

  console.log('[app-renewal-integration] Module loaded');

})();