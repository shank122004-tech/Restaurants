const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || 'your_app_id';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || 'your_secret_key';
const CASHFREE_API_URL = 'https://api.cashfree.com';
const APP_URL = process.env.APP_URL || 'https://gurufinder-6fd24.web.app';

// Helper function to generate Cashfree signature
function generateSignature(postData, secretKey) {
    const dataToSign = postData + secretKey;
    return crypto.createHash('sha256').update(dataToSign).digest('hex');
}

// ============================================
// PAYMENT & SUBSCRIPTION
// ============================================

exports.initiatePaymentWithCashfree = functions.https.onCall(async (data, context) => {
    console.log('=== initiatePaymentWithCashfree CALLED ===');
    console.log('[Context] auth object exists:', !!context.auth);
    console.log('[Context] auth.uid:', context.auth?.uid || 'MISSING');
    console.log('[Context] auth.token:', context.auth?.token ? 'present' : 'missing');
    console.log('[Request Data]', JSON.stringify({ 
        restaurantId: data?.restaurantId, 
        amount: data?.amount, 
        plan: data?.plan 
    }));
    
    // Strict auth check
    if (!context.auth) {
        console.error('[ERROR] context.auth is null or undefined');
        console.error('[Context Keys]', Object.keys(context));
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'User must be authenticated. Please sign in and try again.'
        );
    }
    
    if (!context.auth.uid) {
        console.error('[ERROR] context.auth.uid is missing');
        console.error('[Auth Object]', JSON.stringify(context.auth));
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'User authentication is invalid. Please sign in again.'
        );
    }
    
    console.log('[SUCCESS] User authenticated with UID:', context.auth.uid);

    try {
        const { restaurantId, amount, plan } = data;
        console.log('📋 Payment initiation request:', { restaurantId, amount, plan, userId: context.auth.uid });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            console.error('❌ Restaurant not found:', restaurantId);
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            console.error('❌ Permission denied - user does not own restaurant');
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        const orderId = `ROS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('📝 Generated Order ID:', orderId);
        
        // Get user details
        const userRecord = await admin.auth().getUser(context.auth.uid);
        console.log('👤 User email:', userRecord.email);
        
        try {
            // Call Cashfree API to create payment session
            const cashfreePayload = {
                order_id: orderId,
                order_amount: amount,
                order_currency: 'INR',
                customer_details: {
                    customer_id: context.auth.uid,
                    customer_email: userRecord.email || 'customer@example.com',
                    customer_phone: restaurantDoc.data().phone || '9999999999'
                },
                order_meta: {
                    return_url: APP_URL + '/?paymentStatus=success&orderId=' + orderId + '&restaurantId=' + restaurantId,
                    notify_url: APP_URL + '/api/webhook/cashfree'
                },
                order_note: `Restaurant Setup - ${restaurantDoc.data().name || 'Restaurant'}`
            };

            console.log('🔗 Cashfree API URL:', CASHFREE_API_URL);
            console.log('📤 Creating Cashfree session for order:', orderId);
            console.log('💰 Amount:', amount, 'Currency:', 'INR');

            const response = await axios.post(
                `${CASHFREE_API_URL}/pg/v2/orders`,
                cashfreePayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-version': '2022-09-01',
                        'x-client-id': CASHFREE_APP_ID,
                        'x-client-secret': CASHFREE_SECRET_KEY
                    },
                    timeout: 5000
                }
            );

            console.log('✅ Cashfree session created successfully');
            console.log('📦 Response data:', {
                order_id: response.data.order_id,
                payment_session_id: response.data.payment_session_id,
                order_status: response.data.order_status
            });

            // Store payment order in Firestore
            await db.collection('payment_orders').add({
                restaurantId: restaurantId,
                userId: context.auth.uid,
                orderId: orderId,
                amount: amount,
                plan: plan,
                status: 'initiated',
                currency: 'INR',
                cashfreeSessionId: response.data.payment_session_id || null,
                cashfreeOrderId: response.data.order_id || orderId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            });

            console.log('💾 Payment order stored in Firestore:', orderId);
            console.log('🎫 Session ID ready for frontend:', response.data.payment_session_id);
            
            return {
                success: true,
                orderId: orderId,
                amount: amount,
                currency: 'INR',
                restaurantId: restaurantId,
                sessionId: response.data.payment_session_id,
                cashfreeOrderId: response.data.order_id
            };
        } catch (cashfreeError) {
            console.error('❌ Cashfree API error');
            console.error('Status:', cashfreeError.response?.status);
            console.error('Data:', cashfreeError.response?.data);
            console.error('Message:', cashfreeError.message);
            throw new functions.https.HttpsError('internal', 'Failed to create payment session with Cashfree: ' + (cashfreeError.response?.data?.message || cashfreeError.message));
        }
    } catch (error) {
        console.error('❌ Payment initiation error:', error.message);
        throw error;
    }
});

exports.verifyAndCompletePayment = functions.https.onCall(async (data, context) => {
    console.log('verifyAndCompletePayment called');
    console.log('Context auth:', context.auth ? 'Present' : 'Missing');
    
    if (!context.auth) {
        console.error('Authentication failed - context.auth is null');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated. Please sign in and try again.');
    }

    try {
        const { restaurantId, orderId, amount } = data;
        console.log('Payment verification request:', { restaurantId, orderId, amount, userId: context.auth.uid });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        // Verify this is the initial 999 payment
        if (amount !== 999) {
            console.error('Invalid payment amount:', amount);
            throw new functions.https.HttpsError('invalid-argument', 'Invalid payment amount for initial setup');
        }

        try {
            // Verify payment with Cashfree API
            console.log('Verifying payment with Cashfree for order:', orderId);
            
            const verifyResponse = await axios.get(
                `${CASHFREE_API_URL}/pg/v2/orders/${orderId}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-version': '2022-09-01',
                        'x-client-id': CASHFREE_APP_ID,
                        'x-client-secret': CASHFREE_SECRET_KEY
                    },
                    timeout: 5000
                }
            );

            console.log('Cashfree verification response:', verifyResponse.data);

            // Check if payment was successful
            const orderStatus = verifyResponse.data.order_status;
            console.log('Order status from Cashfree:', orderStatus);
            
            if (orderStatus !== 'PAID') {
                console.error('Payment not completed. Status:', orderStatus);
                throw new functions.https.HttpsError('failed-precondition', 'Payment not completed on Cashfree. Order status: ' + orderStatus);
            }

            console.log('✓ Payment verified as PAID on Cashfree');

            const paymentData = {
                restaurantId: restaurantId,
                userId: context.auth.uid,
                orderId: orderId,
                amount: amount,
                plan: 'premium',
                status: 'completed',
                paymentMethod: 'cashfree',
                cashfreeRef: verifyResponse.data.cf_payment_id || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                verifiedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const paymentRef = await db.collection('payments').add(paymentData);
            console.log('Payment record created:', paymentRef.id);

            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + 1);

            console.log('Updating restaurant subscription status to ACTIVE');
            
            await db.collection('restaurants').doc(restaurantId).update({
                'subscription.status': 'active',
                'subscription.plan': 'premium',
                'subscription.lastPaymentId': paymentRef.id,
                'subscription.activatedAt': admin.firestore.FieldValue.serverTimestamp(),
                'subscription.expiryDate': expiryDate,
                'subscription.monthlyAmount': 499,
                status: 'active'
            });

            console.log('✓ Payment verified and subscription activated for restaurant:', restaurantId);

            return {
                success: true,
                paymentId: paymentRef.id,
                message: 'Payment verified and subscription activated',
                subscriptionExpiry: expiryDate.toISOString()
            };
        } catch (cashfreeError) {
            console.error('Cashfree verification error:', cashfreeError.response?.data || cashfreeError.message);
            throw new functions.https.HttpsError('internal', 'Failed to verify payment with Cashfree: ' + (cashfreeError.response?.data?.message || cashfreeError.message));
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        throw error;
    }
});

exports.renewSubscription = functions.https.onCall(async (data, context) => {
    console.log('renewSubscription called');
    console.log('Context auth:', context.auth ? 'Present' : 'Missing');
    
    if (!context.auth) {
        console.error('Authentication failed - context.auth is null');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated. Please sign in and try again.');
    }

    try {
        const { restaurantId } = data;
        console.log('Subscription renewal request:', { restaurantId, userId: context.auth.uid });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        const renewalOrderId = `ROR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.collection('payment_orders').add({
            restaurantId: restaurantId,
            userId: context.auth.uid,
            orderId: renewalOrderId,
            amount: 499,
            plan: 'premium_renewal',
            status: 'initiated',
            currency: 'INR',
            isRenewal: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        console.log('Renewal order created successfully:', renewalOrderId);

        return {
            success: true,
            orderId: renewalOrderId,
            amount: 499,
            message: 'Renewal payment initiated'
        };
    } catch (error) {
        console.error('Subscription renewal error:', error);
        throw error;
    }
});

exports.verifyRenewalPayment = functions.https.onCall(async (data, context) => {
    console.log('verifyRenewalPayment called');
    console.log('Context auth:', context.auth ? 'Present' : 'Missing');
    
    if (!context.auth) {
        console.error('Authentication failed - context.auth is null');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated. Please sign in and try again.');
    }

    try {
        const { restaurantId, orderId, amount } = data;
        console.log('Renewal verification request:', { restaurantId, orderId, amount, userId: context.auth.uid });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        // Verify this is the renewal payment (499)
        if (amount !== 499) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid payment amount for renewal');
        }

        const renewalPaymentData = {
            restaurantId: restaurantId,
            userId: context.auth.uid,
            orderId: orderId,
            amount: amount,
            plan: 'premium_renewal',
            status: 'completed',
            paymentMethod: 'cashfree',
            isRenewal: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const paymentRef = await db.collection('payments').add(renewalPaymentData);

        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1);

        await db.collection('restaurants').doc(restaurantId).update({
            'subscription.status': 'active',
            'subscription.plan': 'premium',
            'subscription.lastPaymentId': paymentRef.id,
            'subscription.expiryDate': expiryDate,
            'subscription.renewedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Renewal verified and subscription updated for restaurant:', restaurantId);

        return {
            success: true,
            paymentId: paymentRef.id,
            message: 'Subscription renewed successfully',
            subscriptionExpiry: expiryDate.toISOString()
        };
    } catch (error) {
        console.error('Renewal verification error:', error);
        throw error;
    }
});

exports.checkSubscription = functions.https.onCall(async (data, context) => {
    console.log('checkSubscription called');
    console.log('Context auth:', context.auth ? 'Present' : 'Missing');
    
    if (!context.auth) {
        console.error('Authentication failed - context.auth is null');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated. Please sign in and try again.');
    }

    try {
        const { restaurantId } = data;
        console.log('Subscription check request:', { restaurantId, userId: context.auth.uid });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        const subscription = restaurantDoc.data().subscription || {};
        const expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate.seconds * 1000) : null;
        const isExpired = expiryDate && new Date() > expiryDate;

        console.log('Subscription status:', { restaurantId, status: subscription.status, isExpired });

        return {
            status: subscription.status || 'inactive',
            plan: subscription.plan || 'free',
            expiryDate: expiryDate?.toISOString() || null,
            isExpired: isExpired,
            daysRemaining: expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
        };
    } catch (error) {
        console.error('Subscription check error:', error);
        throw error;
    }
});