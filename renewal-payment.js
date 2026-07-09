/**
 * renewal-payment.js — Cashfree Payment v2023-08-01 with Firebase Integration
 */

(function() {
  'use strict';

  const CF_ENV = 'production';
  
  // Cloud Function URL - adjust based on your Firebase project deployment
  // This will be dynamically set if window.RENEWAL_FUNCTION_URL is available
  const DEFAULT_FUNCTION_URL = 'https://renewalpaymentorder-mty7cmapfa-uc.a.run.app';
  const VERIFY_FUNCTION_URL = 'https://us-central1-gurufinder-6fd24.cloudfunctions.net/verifyRenewalPayment';
  
  let _cfSdkLoading = null;

  // ────── NOTIFICATION HELPER ──────
  function showNotification(msg, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(msg, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log(`[renewal-${type}] ${msg}`);
    }
  }

  // ────── GET CURRENT USER UID ──────
  async function getCurrentUserUID() {
    try {
      // Try multiple ways to get Firebase auth
      let auth;
      
      if (typeof window.auth !== 'undefined') {
        auth = window.auth;
      } 
      else if (typeof window.firebase !== 'undefined' && typeof window.firebase.auth !== 'undefined') {
        auth = window.firebase.auth();
      }
      else if (typeof window.getAuth !== 'undefined') {
        auth = window.getAuth();
      }
      else {
        throw new Error('Firebase auth not initialized. Please refresh the page.');
      }

      const currentUser = auth.currentUser || (auth.getCurrentUser && auth.getCurrentUser());
      if (!currentUser) {
        throw new Error('No user logged in. Please sign in first.');
      }

      console.log('[renewal] Current user UID:', currentUser.uid);
      return currentUser.uid;

    } catch (error) {
      console.error('[renewal] Error getting user UID:', error.message);
      throw new Error('Authentication failed: ' + error.message);
    }
  }

  // ────── LAZY-LOAD CASHFREE SDK ──────
  function loadCashfreeSDK() {
    if (typeof Cashfree === 'function') {
      console.log('[renewal] Cashfree SDK already loaded');
      return Promise.resolve();
    }
    
    if (_cfSdkLoading) {
      return _cfSdkLoading;
    }

    console.log('[renewal] Loading Cashfree SDK v3...');
    _cfSdkLoading = new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = function() {
        console.log('[renewal] Cashfree SDK v3 loaded successfully');
        resolve();
      };
      script.onerror = function() {
        console.error('[renewal] Cashfree SDK failed to load');
        reject(new Error('Cashfree SDK failed to load. Please refresh and try again.'));
      };
      script.onabort = function() {
        reject(new Error('Cashfree SDK load was aborted'));
      };
      document.head.appendChild(script);
    });

    return _cfSdkLoading;
  }

  async function getCashfreeInstance() {
    try {
      await loadCashfreeSDK();
      if (typeof Cashfree === 'undefined') {
        throw new Error('Cashfree SDK not available');
      }
      // Cashfree is a class - use new keyword
      return new Cashfree({ mode: CF_ENV });
    } catch (error) {
      console.error('[renewal] Error getting Cashfree instance:', error);
      throw error;
    }
  }

  // ────── CREATE PAYMENT ORDER ──────
  async function createPaymentOrder(userUID) {
    try {
      console.log('[renewal] Creating payment order for user:', userUID);

      const functionUrl = window.RENEWAL_FUNCTION_URL || DEFAULT_FUNCTION_URL;
      console.log('[renewal] Using function URL:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ownerId: userUID
        })
      });

      console.log('[renewal] Response status:', response.status);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: response.statusText };
        }
        
        const errorMsg = errorData.error || errorData.message || `HTTP ${response.status}`;
        console.error('[renewal] Server error:', errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('[renewal] Order created:', {
        orderId: data.orderId,
        hasSessionId: !!data.paymentSessionId
      });

      if (!data.paymentSessionId) {
        throw new Error('Payment session ID not received from server');
      }

      if (!data.orderId) {
        throw new Error('Order ID not received from server');
      }

      return {
        orderId: data.orderId,
        paymentSessionId: data.paymentSessionId,
        amount: data.amount,
        currency: data.currency || 'INR',
        ownerId: userUID
      };

    } catch (error) {
      console.error('[renewal] Error creating order:', error.message);
      throw new Error('Failed to create payment order: ' + error.message);
    }
  }

  // ────── OPEN CASHFREE CHECKOUT ──────
async function openCashfreeCheckout(orderData) {

    await loadCashfreeSDK();

    const cashfree = new Cashfree({
        mode: CF_ENV
    });

    console.log(cashfree);

    const result = await cashfree.checkout({

        paymentSessionId: orderData.paymentSessionId,

        redirectTarget: "_modal"

    });

    console.log(result);

    return result;
}
  // ────── VERIFY PAYMENT COMPLETION ──────
  async function verifyPaymentCompletion(orderId, ownerId) {
    try {
      console.log('[renewal] Verifying payment completion...');

      const verifyUrl = window.VERIFY_FUNCTION_URL || VERIFY_FUNCTION_URL;

      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId,
          ownerId: ownerId
        })
      });

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: response.statusText };
        }
        throw new Error(errorData.error || 'Verification failed');
      }

      const data = await response.json();
      console.log('[renewal] Verification result:', data);
      return data;

    } catch (error) {
      console.error('[renewal] Verification error:', error.message);
      throw error;
    }
  }

  // ────── MAIN PAYMENT HANDLER ──────
  window.handleRenewalPayment = async function() {
    try {
      console.log('[renewal] ===== RENEWAL PAYMENT INITIATED =====');

      showNotification('💳 Initializing payment...', 'info');

      // Step 1: Get current user UID
      console.log('[renewal] Step 1: Verifying login...');
      let userUID;
      try {
        userUID = await getCurrentUserUID();
        console.log('[renewal] User verified');
      } catch (error) {
        console.error('[renewal] Failed to verify user:', error.message);
        showNotification('❌ ' + error.message, 'error');
        return;
      }

      // Step 2: Load Cashfree SDK
      console.log('[renewal] Step 2: Loading Cashfree SDK...');
      showNotification('💳 Loading payment gateway...', 'info');
      try {
        await loadCashfreeSDK();
        console.log('[renewal] SDK loaded');
      } catch (error) {
        console.error('[renewal] SDK load failed:', error.message);
        showNotification('❌ Payment gateway failed to load: ' + error.message, 'error');
        return;
      }

      // Step 3: Create payment order
      console.log('[renewal] Step 3: Creating payment order...');
      showNotification('💳 Preparing payment order...', 'info');
      let orderData;
      try {
        orderData = await createPaymentOrder(userUID);
        console.log('[renewal] Order created successfully');
      } catch (error) {
        console.error('[renewal] Order creation failed:', error.message);
        showNotification('❌ ' + error.message, 'error');
        return;
      }

      // Step 4: Open Cashfree checkout
      console.log('[renewal] Step 4: Opening checkout modal...');
      showNotification('💳 Opening secure payment...', 'info');
      
      try {
        await openCashfreeCheckout(orderData);
        console.log('[renewal] Checkout modal closed/completed');
      } catch (error) {
        console.error('[renewal] Checkout error:', error.message);
        showNotification('❌ ' + error.message, 'error');
        return;
      }

      // Step 5: Verify payment
      console.log('[renewal] Step 5: Verifying payment...');
      showNotification('💳 Verifying payment...', 'info');
      try {
        const verificationResult = await verifyPaymentCompletion(orderData.orderId, userUID);
        
        if (verificationResult.success) {
          console.log('[renewal] Payment verified successfully');
          showNotification('✅ Subscription renewed successfully! 🎉', 'success');
          
          // Reload page after 2 seconds to reflect updated subscription
          setTimeout(() => {
            console.log('[renewal] Reloading page...');
            window.location.reload();
          }, 2000);
        } else {
          throw new Error(verificationResult.error || 'Payment verification failed');
        }
      } catch (error) {
        console.error('[renewal] Verification failed:', error.message);
        showNotification('⚠️ Payment completed but verification pending: ' + error.message, 'warning');
        
        // Still reload as payment might be successful
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }

    } catch (error) {
      console.error('[renewal] Unexpected error:', error);
      showNotification('❌ Payment failed: ' + (error.message || 'Unknown error'), 'error');
    }
  };

  console.log('[renewal-payment.js] Module loaded and ready');

})();