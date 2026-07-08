const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Cashfree Configuration - Load from environment variables
let CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
let CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_URL = 'https://api.cashfree.com';
const APP_URL = process.env.APP_URL || 'https://gurufinder-6fd24.web.app';

// Validate Cashfree credentials at startup
if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn('⚠️  WARNING: Cashfree credentials not properly configured in environment variables');
    console.warn('Please ensure CASHFREE_APP_ID and CASHFREE_SECRET_KEY are set in Firebase Cloud Functions config');
}

// ============================================
// PAYMENT & SUBSCRIPTION
// ============================================

// Initiate subscription renewal payment - creates Cashfree order and returns payment URL
exports.initiateRenewalPayment = functions.https.onCall(async (data, context) => {
    try {
        console.log('=== initiateRenewalPayment CALLED ===');

        // Verify Cashfree credentials
        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            throw new functions.https.HttpsError('internal', 'Payment gateway not configured');
        }

        // Create unique order ID
        const orderId = `RENEW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const amount = 499; // 29 days renewal amount
        
        try {
            // Create order on Cashfree
            const cfResponse = await axios.post(
                `${CASHFREE_API_URL}/pg/orders`,
                {
                    order_id: orderId,
                    order_amount: amount,
                    order_currency: 'INR',
                    customer_details: {
                        customer_id: orderId,
                        customer_email: 'user@restaurantos.com',
                        customer_phone: '9999999999'
                    },
                    order_meta: {
                        return_url: `${APP_URL}/?action=verify_renewal&orderId=${orderId}`,
                        notify_url: `${APP_URL}/webhook/payment`
                    }
                },
                {
                    headers: {
                        'x-api-version': '2023-08-01',
                        'x-client-id': CASHFREE_APP_ID,
                        'x-client-secret': CASHFREE_SECRET_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            console.log('Cashfree order created:', orderId);

            // Save order to database
            await db.collection('payment_orders').add({
                orderId: orderId,
                amount: amount,
                plan: 'renewal',
                status: 'initiated',
                currency: 'INR',
                isRenewal: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000) // Order expires in 30 minutes
            });

            // Return payment URL and order details
            const paymentSessionId = cfResponse.data?.payment_session_id;
            const paymentLink = cfResponse.data?.payment_link || cfResponse.data?.short_url || cfResponse.data?.order_payment_link;
            
            // If no payment link in response, construct it from payment_session_id
            const finalPaymentUrl = paymentLink || (paymentSessionId ? `https://checkout.cashfree.com/pay/${paymentSessionId}` : null);
            
            return {
                success: true,
                orderId: orderId,
                amount: amount,
                paymentUrl: finalPaymentUrl,
                paymentSessionId: paymentSessionId
            };

        } catch (cashfreeError) {
            console.error('Cashfree API error:', cashfreeError.response?.data || cashfreeError.message);
            throw new functions.https.HttpsError(
                'internal',
                cashfreeError.response?.data?.message || 'Failed to create payment order'
            );
        }

    } catch (error) {
        console.error('Renewal payment initiation error:', error.message);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Failed to initiate renewal');
    }
});

// Verify renewal payment and update subscription
exports.verifyPaymentAndRenew = functions.https.onCall(async (data, context) => {
    try {
        console.log('=== verifyPaymentAndRenew CALLED ===');
        
        const { orderId, restaurantId } = data;

        if (!orderId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing orderId');
        }

        if (!restaurantId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing restaurantId');
        }

        // Get userId from Firebase auth context
        const userId = context.auth?.uid;

        try {
            // Verify payment status with Cashfree
            const verifyResponse = await axios.get(
                `${CASHFREE_API_URL}/pg/orders/${orderId}`,
                {
                    headers: {
                        'x-api-version': '2023-08-01',
                        'x-client-id': CASHFREE_APP_ID,
                        'x-client-secret': CASHFREE_SECRET_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            console.log('Cashfree verification response status:', verifyResponse.data.order_status);

            // Check if payment was successful
            const orderStatus = verifyResponse.data.order_status;
            
            if (orderStatus !== 'PAID') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Payment not completed. Status: ${orderStatus}`
                );
            }

            console.log('✓ Payment verified - Status: PAID');

            // Record payment
            const paymentRecord = {
                restaurantId: restaurantId,
                userId: userId,
                orderId: orderId,
                amount: 499,
                plan: 'renewal',
                status: 'completed',
                paymentMethod: 'cashfree',
                cashfreeRef: verifyResponse.data.cf_payment_id || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                verifiedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const paymentRef = await db.collection('payments').add(paymentRecord);
            console.log('Payment recorded:', paymentRef.id);

            // Calculate subscription expiry - 29 days from now
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 29);

            // Update restaurant subscription
            await db.collection('restaurants').doc(restaurantId).update({
                'subscription.status': 'active',
                'subscription.plan': 'premium',
                'subscription.lastPaymentId': paymentRef.id,
                'subscription.expiryDate': expiryDate,
                'subscription.renewedAt': admin.firestore.FieldValue.serverTimestamp()
            });

            console.log('✓ Subscription renewed for 29 days until:', expiryDate.toISOString());

            return {
                success: true,
                message: 'Subscription renewed successfully for 29 days',
                expiryDate: expiryDate.toISOString(),
                paymentId: paymentRef.id
            };

        } catch (verifyError) {
            console.error('Cashfree verification error:', verifyError.response?.data || verifyError.message);
            
            if (verifyError instanceof functions.https.HttpsError) {
                throw verifyError;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to verify payment with payment gateway'
            );
        }

    } catch (error) {
        console.error('Renewal verification error:', error.message);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Payment verification failed');
    }
});

// Check current subscription status
exports.getSubscriptionStatus = functions.https.onCall(async (data, context) => {
    try {
        const { restaurantId } = data;

        if (!restaurantId) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing restaurantId');
        }

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        const subscription = restaurantDoc.data().subscription || {};
        const expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate.seconds * 1000) : null;
        const isExpired = expiryDate && new Date() > expiryDate;

        return {
            status: subscription.status || 'inactive',
            plan: subscription.plan || 'free',
            expiryDate: expiryDate?.toISOString() || null,
            isExpired: isExpired,
            daysRemaining: expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
        };

    } catch (error) {
        console.error('Subscription status check error:', error.message);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to check subscription status');
    }
});