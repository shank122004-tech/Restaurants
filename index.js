const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_URL = process.env.CASHFREE_API_URL || 'https://api.cashfree.com';
const APP_URL = process.env.APP_URL || 'https://gurufinder-6fd24.web.app';
const RENEWAL_AMOUNT_INR = 499;

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn('⚠️ WARNING: Cashfree credentials not configured');
}

// ============================================
// RENEWAL PAYMENT ORDER - Cashfree PG v2023-08-01 (SDK v4 Compatible)
// ============================================

exports.renewalPaymentOrder = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    console.log('[renewalPaymentOrder] Request received');

    // Validate Cashfree credentials
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      console.error('[renewalPaymentOrder] Credentials missing');
      return res.status(500).json({
        success: false,
        error: "Cashfree credentials not configured"
      });
    }

    const body = req.body || {};
    const ownerId = body.ownerId;

    // Validate owner ID
    if (!ownerId) {
      console.error('[renewalPaymentOrder] Missing ownerId');
      return res.status(400).json({
        success: false,
        error: "Missing required field: ownerId"
      });
    }

    // Retrieve owner data from Firestore using Admin SDK
    console.log('[renewalPaymentOrder] Retrieving owner data for:', ownerId);
    let ownerData;
    try {
      // Find restaurant document where ownerId matches this user
      const restaurantsQuery = await db.collection('restaurants').where('ownerId', '==', ownerId).limit(1).get();
      
      if (restaurantsQuery.empty) {
        console.error('[renewalPaymentOrder] No restaurant found for owner:', ownerId);
        console.error('[renewalPaymentOrder] Document does not exist. Possible causes:');
        console.error('  1. Restaurant was never created by this owner');
        console.error('  2. Owner was approved but did not complete registration');
        
        return res.status(404).json({
          success: false,
          error: "Restaurant profile not found. Please ensure you have completed registration.",
          hint: "Check that your restaurant was created after approval"
        });
      }

      const restaurantDoc = restaurantsQuery.docs[0];
      ownerData = restaurantDoc.data();
      console.log('[renewalPaymentOrder] Restaurant data retrieved:', {
        hasName: !!ownerData.name,
        hasEmail: !!ownerData.email,
        hasPhone: !!ownerData.phone,
        ownerId: ownerData.ownerId
      });
    } catch (firestoreError) {
      console.error('[renewalPaymentOrder] Firestore error:', firestoreError.message);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve restaurant information",
        details: firestoreError.message
      });
    }

    const amount = Number(body.amount || RENEWAL_AMOUNT_INR);
    const customerName = ownerData.name || ownerData.restaurantName || "Restaurant Owner";
    const customerEmail = ownerData.email || "owner@example.com";
    const customerPhone = ownerData.phone || "9999999999";
    
    // Generate unique order ID
    const orderId = `RENEW_${ownerId}_${Date.now()}`;

    console.log('[renewalPaymentOrder] Creating order:', {
      orderId,
      amount,
      customerId: ownerId,
      email: customerEmail
    });

    // Create Cashfree order using v2023-08-01 API
    const cashfreeResponse = await axios.post(
      `${CASHFREE_API_URL}/pg/orders`,
      {
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: ownerId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone
        },
        order_meta: {
          return_url: `${APP_URL}/?payment=renewal&status=success&order_id=${orderId}`
        }
      },
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    console.log('[renewalPaymentOrder] Cashfree response received');

    // Validate Cashfree response
    if (!cashfreeResponse.data) {
      console.error('[renewalPaymentOrder] Empty response from Cashfree');
      return res.status(500).json({
        success: false,
        error: "Invalid response from payment gateway"
      });
    }

    const { payment_session_id, order_id } = cashfreeResponse.data;

    if (!payment_session_id) {
      console.error('[renewalPaymentOrder] No payment_session_id in response:', cashfreeResponse.data);
      return res.status(500).json({
        success: false,
        error: "Payment session ID not received from gateway"
      });
    }

    console.log('[renewalPaymentOrder] Success - session ID:', payment_session_id);

    // Store order details in Firestore for tracking
    try {
      await db.collection('renewal_orders').doc(orderId).set({
        orderId: orderId,
        ownerId: ownerId,
        amount: amount,
        sessionId: payment_session_id,
        status: 'created',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry
      });
      console.log('[renewalPaymentOrder] Order stored in Firestore');
    } catch (firestoreError) {
      console.warn('[renewalPaymentOrder] Firestore storage failed:', firestoreError.message);
      // Don't fail the response, just warn
    }

    // Return success response
    return res.status(200).json({
      success: true,
      orderId: order_id,
      paymentSessionId: payment_session_id,
      amount: amount,
      currency: "INR"
    });

  } catch (error) {
    console.error('[renewalPaymentOrder] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config?.url
    });

    // Provide specific error messages based on error type
    let errorMessage = "Failed to create payment order";

    if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = "Payment gateway authentication failed";
    } else if (error.response?.status === 400) {
      errorMessage = error.response?.data?.message || "Invalid payment request parameters";
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = "Payment gateway timeout - please try again";
    } else if (error.message?.includes('ENOTFOUND')) {
      errorMessage = "Payment gateway unreachable - check internet connection";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    return res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// VERIFY RENEWAL PAYMENT - Verify after success (SDK v4 Compatible)
// ============================================

exports.verifyRenewalPayment = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    console.log('[verifyRenewalPayment] Verification requested');

    const { orderId, ownerId } = req.body;

    if (!orderId || !ownerId) {
      return res.status(400).json({
        success: false,
        error: "Missing orderId or ownerId"
      });
    }

    // Verify order with Cashfree
    const verifyResponse = await axios.get(
      `${CASHFREE_API_URL}/pg/orders/${orderId}`,
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": "2023-08-01"
        },
        timeout: 10000
      }
    );

    const orderData = verifyResponse.data;
    const orderStatus = orderData.order_status;
    const paymentStatus = orderData.payment_status;

    console.log('[verifyRenewalPayment] Order status:', {
      orderId,
      orderStatus,
      paymentStatus
    });

    if (orderStatus === 'PAID' && paymentStatus === 'SUCCESS') {
      // Update Firestore to mark subscription as renewed
      try {
        // Find restaurant document where ownerId matches
        const restaurantsQuery = await db.collection('restaurants').where('ownerId', '==', ownerId).limit(1).get();
        
        if (restaurantsQuery.empty) {
          return res.status(404).json({
            success: false,
            error: "Restaurant not found"
          });
        }

        const restaurantDoc = restaurantsQuery.docs[0];
        const now = new Date();
        const renewalDate = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000); // 29 days

        await db.collection('restaurants').doc(restaurantDoc.id).update({
          'subscription.status': 'active',
          'subscription.expiryDate': renewalDate,
          'subscription.renewedAt': admin.firestore.FieldValue.serverTimestamp(),
          'subscription.lastPaymentOrderId': orderId,
          'premium': true
        });

        console.log('[verifyRenewalPayment] Subscription renewed for restaurant:', restaurantDoc.id);

        // Update order record
        await db.collection('renewal_orders').doc(orderId).update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentStatus: paymentStatus
        });

        return res.status(200).json({
          success: true,
          message: "Subscription renewed successfully",
          expiresAt: renewalDate
        });
      } catch (firestoreError) {
        console.error('[verifyRenewalPayment] Firestore update failed:', firestoreError.message);
        return res.status(500).json({
          success: false,
          error: "Failed to update subscription status"
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "Payment not completed",
        orderStatus: orderStatus,
        paymentStatus: paymentStatus
      });
    }

  } catch (error) {
    console.error('[verifyRenewalPayment] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to verify payment"
    });
  }
});

// ============================================
// ADMIN RENEW SUBSCRIPTION - Admin can renew without payment
// ============================================

exports.adminRenewSubscription = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    console.log('[adminRenewSubscription] Admin renewal requested');

    const { restaurantId, adminEmail } = req.body;

    // Validate required fields
    if (!restaurantId) {
      console.error('[adminRenewSubscription] Missing restaurantId');
      return res.status(400).json({
        success: false,
        error: "Missing required field: restaurantId"
      });
    }

    // Verify restaurant exists
    console.log('[adminRenewSubscription] Verifying restaurant:', restaurantId);
    const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();

    if (!restaurantDoc.exists) {
      console.error('[adminRenewSubscription] Restaurant not found:', restaurantId);
      return res.status(404).json({
        success: false,
        error: "Restaurant not found"
      });
    }

    const restaurantData = restaurantDoc.data();
    const now = new Date();
    const renewalDate = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000); // 29 days

    // Update restaurant subscription
    await db.collection('restaurants').doc(restaurantId).update({
      'subscription.status': 'active',
      'subscription.expiryDate': renewalDate,
      'subscription.renewedAt': admin.firestore.FieldValue.serverTimestamp(),
      'subscription.adminRenewedBy': adminEmail || 'system',
      'subscription.lastAdminRenewal': admin.firestore.FieldValue.serverTimestamp(),
      'premium': true
    });

    console.log('[adminRenewSubscription] Subscription renewed for restaurant:', restaurantId);

    // Store admin renewal record
    try {
      await db.collection('admin_renewals').add({
        restaurantId: restaurantId,
        restaurantName: restaurantData.name || 'Unknown',
        ownerId: restaurantData.ownerId,
        adminEmail: adminEmail || 'system',
        renewedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiryDate: renewalDate,
        reason: 'Admin manual renewal'
      });
      console.log('[adminRenewSubscription] Renewal record stored');
    } catch (logError) {
      console.warn('[adminRenewSubscription] Failed to log renewal:', logError.message);
      // Don't fail the response, just warn
    }

    return res.status(200).json({
      success: true,
      message: "Subscription renewed successfully by admin",
      restaurantName: restaurantData.name,
      expiresAt: renewalDate
    });

  } catch (error) {
    console.error('[adminRenewSubscription] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to renew subscription",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// ADMIN STOP SUBSCRIPTION - Admin can deactivate owner's subscription
// ============================================

exports.adminStopSubscription = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    console.log('[adminStopSubscription] Admin stop subscription requested');

    const { restaurantId, adminEmail, reason } = req.body;

    // Validate required fields
    if (!restaurantId) {
      console.error('[adminStopSubscription] Missing restaurantId');
      return res.status(400).json({
        success: false,
        error: "Missing required field: restaurantId"
      });
    }

    // Verify restaurant exists
    console.log('[adminStopSubscription] Verifying restaurant:', restaurantId);
    const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();

    if (!restaurantDoc.exists) {
      console.error('[adminStopSubscription] Restaurant not found:', restaurantId);
      return res.status(404).json({
        success: false,
        error: "Restaurant not found"
      });
    }

    const restaurantData = restaurantDoc.data();

    // Update restaurant subscription to inactive
    await db.collection('restaurants').doc(restaurantId).update({
      'subscription.status': 'inactive',
      'subscription.stoppedAt': admin.firestore.FieldValue.serverTimestamp(),
      'subscription.stoppedBy': adminEmail || 'system',
      'subscription.stopReason': reason || 'Admin action',
      'premium': false
    });

    console.log('[adminStopSubscription] Subscription stopped for restaurant:', restaurantId);

    // Store admin stop record
    try {
      await db.collection('admin_subscription_logs').add({
        restaurantId: restaurantId,
        restaurantName: restaurantData.name || 'Unknown',
        ownerId: restaurantData.ownerId,
        action: 'stopped',
        adminEmail: adminEmail || 'system',
        actionAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: reason || 'Admin action',
        previousStatus: restaurantData.subscription?.status || 'unknown'
      });
      console.log('[adminStopSubscription] Stop record stored');
    } catch (logError) {
      console.warn('[adminStopSubscription] Failed to log stop:', logError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Subscription stopped successfully",
      restaurantName: restaurantData.name
    });

  } catch (error) {
    console.error('[adminStopSubscription] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to stop subscription",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// ADMIN START SUBSCRIPTION - Admin can reactivate owner's subscription
// ============================================

exports.adminStartSubscription = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    console.log('[adminStartSubscription] Admin start subscription requested');

    const { restaurantId, adminEmail } = req.body;

    // Validate required fields
    if (!restaurantId) {
      console.error('[adminStartSubscription] Missing restaurantId');
      return res.status(400).json({
        success: false,
        error: "Missing required field: restaurantId"
      });
    }

    // Verify restaurant exists
    console.log('[adminStartSubscription] Verifying restaurant:', restaurantId);
    const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();

    if (!restaurantDoc.exists) {
      console.error('[adminStartSubscription] Restaurant not found:', restaurantId);
      return res.status(404).json({
        success: false,
        error: "Restaurant not found"
      });
    }

    const restaurantData = restaurantDoc.data();
    const now = new Date();
    const newExpiryDate = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000); // 29 days

    // Update restaurant subscription to active
    await db.collection('restaurants').doc(restaurantId).update({
      'subscription.status': 'active',
      'subscription.expiryDate': newExpiryDate,
      'subscription.startedAt': admin.firestore.FieldValue.serverTimestamp(),
      'subscription.startedBy': adminEmail || 'system',
      'premium': true
    });

    console.log('[adminStartSubscription] Subscription started for restaurant:', restaurantId);

    // Store admin start record
    try {
      await db.collection('admin_subscription_logs').add({
        restaurantId: restaurantId,
        restaurantName: restaurantData.name || 'Unknown',
        ownerId: restaurantData.ownerId,
        action: 'started',
        adminEmail: adminEmail || 'system',
        actionAt: admin.firestore.FieldValue.serverTimestamp(),
        expiryDate: newExpiryDate,
        previousStatus: restaurantData.subscription?.status || 'unknown'
      });
      console.log('[adminStartSubscription] Start record stored');
    } catch (logError) {
      console.warn('[adminStartSubscription] Failed to log start:', logError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Subscription started successfully",
      restaurantName: restaurantData.name,
      expiresAt: newExpiryDate
    });

  } catch (error) {
    console.error('[adminStartSubscription] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to start subscription",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});