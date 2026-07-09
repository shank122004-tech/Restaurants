/**
 * renewal-payment.js — Direct Cashfree Payment Integration
 * Simple flow: Create order → Open checkout modal → Done
 */

(function() {
  'use strict';

  const CF_ENV = 'production';
  const CLOUD_FUNCTION_URL = 'https://us-central1-gurufinder-6fd24.cloudfunctions.net/createRenewalOrder';

  /* ─── HELPERS ─────────────────────────────────────────────── */
  function currentUser() {
    if (window._firebaseAuth?.currentUser) {
      return window._firebaseAuth.currentUser;
    }
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        return user;
      }
    } catch (e) {
      console.log('[renewal] firebase.auth() error:', e.message);
    }
    return null;
  }

  function uid() {
    const user = currentUser();
    return user?.uid || ('guest_' + Date.now());
  }

  function showNotification(msg, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(msg, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }

  /* ─── LAZY-LOAD CASHFREE SDK ───────────────────────────────── */
  let _cfSdkLoading = null;

  function loadCashfreeSDK() {
    if (typeof Cashfree === 'function') return Promise.resolve();
    if (_cfSdkLoading) return _cfSdkLoading;

    _cfSdkLoading = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = function() { resolve(); };
      s.onerror = function() { reject(new Error('Cashfree SDK failed to load')); };
      document.head.appendChild(s);
    });
    return _cfSdkLoading;
  }

  async function getCF() {
    await loadCashfreeSDK();
    if (typeof Cashfree === 'function') return Cashfree({ mode: CF_ENV });
    throw new Error('Cashfree SDK not available');
  }

  /* ─── CREATE PAYMENT ORDER ────────────────────────────────── */
  async function createPaymentOrder() {
    try {
      console.log('[renewal] Creating payment order via HTTP...');

      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurantId: uid()
        })
      });

      console.log('[renewal] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[renewal] Server response:', data);

      if (!data.paymentSessionId) {
        throw new Error('No payment session received from server');
      }

      return {
        paymentSessionId: data.paymentSessionId,
        orderId: data.orderId,
        amount: data.amount
      };

    } catch (error) {
      console.error('[renewal] Error creating order:', error);
      throw new Error(error.message || 'Failed to create payment order');
    }
  }

  /* ─── MAIN PAYMENT HANDLER ────────────────────────────────── */
  window.handleRenewalPayment = async function() {
    try {
      console.log('[renewal] ===== PAYMENT INITIATED =====');

      const user = currentUser();
      if (!user || !user.uid) {
        showNotification('⚠️ Please login first to renew subscription', 'warning');
        return;
      }

      console.log('[renewal] ✅ User:', user.uid);
      showNotification('💳 Loading payment gateway...', 'info');

      // Load SDK
      try {
        await loadCashfreeSDK();
      } catch (err) {
        console.error('[renewal] SDK load error:', err);
        showNotification('❌ Payment SDK failed to load', 'error');
        return;
      }

      // Create order
      showNotification('💳 Preparing payment...', 'info');
      const orderData = await createPaymentOrder();

      console.log('[renewal] Order ready:', orderData.orderId);

      // Get Cashfree instance and open checkout
      showNotification('💳 Opening secure payment...', 'info');
      const cf = await getCF();

      const result = await cf.checkout({
        paymentSessionId: orderData.paymentSessionId,
        redirectTarget: '_modal'
      });

      console.log('[renewal] Checkout result:', result);
      showNotification('✅ Payment completed. Thank you!', 'success');

      // Reload after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('[renewal] Error:', error);
      showNotification('❌ ' + (error.message || 'Payment failed'), 'error');
    }
  };

  console.log('[renewal-payment.js] Loaded — Ready for direct Cashfree checkout');

})();