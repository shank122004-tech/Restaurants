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

// Helper function to generate Cashfree signature
function generateSignature(postData, secretKey) {
    const dataToSign = postData + secretKey;
    return crypto.createHash('sha256').update(dataToSign).digest('hex');
}

// ============================================
// PAYMENT & SUBSCRIPTION
// ============================================

// Test function to debug data passing
exports.testPaymentData = functions.https.onCall(async (data, context) => {
    console.log('=== testPaymentData CALLED ===');
    console.log('Raw data:', data);
    console.log('Data type:', typeof data);
    
    if (!data) {
        return { success: false, message: 'data is null or undefined' };
    }
    
    return {
        success: true,
        dataReceived: data,
        keys: Object.keys(data),
        restaurantId: data.restaurantId,
        amount: data.amount,
        plan: data.plan,
        userId: data.userId
    };
});

exports.initiatePaymentWithCashfree = functions.https.onCall(async (data, context) => {
    try {
        console.log('=== initiatePaymentWithCashfree CALLED ===');
        console.log('Raw data received:', data);
        console.log('Data type:', typeof data);
        console.log('Data is null:', data === null);
        console.log('Data is undefined:', data === undefined);
        console.log('Context auth:', context.auth?.uid ? `UID: ${context.auth.uid}` : 'No auth');
        
        if (!data) {
            console.error('CRITICAL: data is null or undefined');
            throw new functions.https.HttpsError('invalid-argument', 'Request data is missing');
        }
        
        console.log('Data keys:', Object.keys(data));
        console.log('Data entries:', Object.entries(data).map(([k, v]) => `${k}=${v}`).join(', '));
        
        // Extract with multiple fallback approaches - handle wrapped data
        let restaurantId = data?.restaurantId || data?.data?.restaurantId;
        let amount = data?.amount !== undefined ? data.amount : (data?.data?.amount || undefined);
        let plan = data?.plan || data?.data?.plan;
        let userId = data?.userId || data?.data?.userId || context.auth?.uid;
        
        // Try one more fallback - check if data itself is the wrapped object
        if (!restaurantId && typeof data === 'object') {
            const dataStr = JSON.stringify(data);
            console.log('Data as JSON:', dataStr);
            if (dataStr.length < 500) {
                console.log('Full data object:', data);
            }
        }
        
        console.log('Extracted values:', { 
            restaurantId: restaurantId || 'MISSING', 
            amount: amount !== undefined ? amount : 'MISSING', 
            plan: plan || 'MISSING', 
            userId: userId || 'MISSING' 
        });
        
        // Ensure amount is a number
        let amountNum = amount;
        if (typeof amount === 'string') {
            amountNum = parseFloat(amount);
        }
        
        console.log('Amount as number:', amountNum, 'Type:', typeof amountNum);
        
        // Verify environment variables are set
        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            console.error('CRITICAL: Cashfree credentials not configured in environment variables');
            console.error('Missing CASHFREE_APP_ID:', !CASHFREE_APP_ID);
            console.error('Missing CASHFREE_SECRET_KEY:', !CASHFREE_SECRET_KEY);
            throw new functions.https.HttpsError('internal', 'Payment gateway not properly configured. Please ensure Cashfree API credentials are set in Firebase Cloud Functions environment variables.');
        }
        
        // Validate all required fields with detailed error messages
        const validations = {
            restaurantId: { value: restaurantId, valid: !!restaurantId },
            amount: { value: amountNum, valid: amountNum !== undefined && amountNum !== null && !isNaN(amountNum) && amountNum > 0 },
            plan: { value: plan, valid: !!plan },
            userId: { value: userId, valid: !!userId }
        };
        
        const missing = Object.entries(validations)
            .filter(([_, validation]) => !validation.valid)
            .map(([field, validation]) => `${field}${validation.value ? ` (value: ${validation.value})` : ''}`);
        
        if (missing.length > 0) {
            console.error('Validation failed. Missing/Invalid fields:', missing);
            console.error('Full validations:', validations);
            throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid fields: ' + missing.join(', '));
        }

        const orderId = `ROS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Creating Cashfree order:', orderId);
        
        try {
            // Create payment session with Cashfree
            console.log('Initiating Cashfree API call with orderId:', orderId);
            
            const cfResponse = await axios.post(
                'https://api.cashfree.com/pg/orders',
                {
                    order_id: orderId,
                    order_amount: amountNum,
                    order_currency: 'INR',
                    customer_details: {
                        customer_id: userId,
                        customer_email: 'user@restaurantos.com',
                        customer_phone: '9999999999'
                    },
                    order_meta: {
                        return_url: `${APP_URL}/?paymentStatus=success&orderId=${orderId}`,
                        notify_url: `${APP_URL}/webhook`
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

            console.log('Cashfree API response received');
            if (cfResponse.data) {
                console.log('Response has data field');
            }
            
            if (!cfResponse.data) {
                throw new Error('No response data from Cashfree API');
            }
            
            // Prepare payment order data with proper type conversion
            const paymentOrderData = {
                restaurantId: String(restaurantId),
                userId: String(userId),
                orderId: orderId,
                amount: amountNum,
                plan: String(plan),
                status: 'initiated',
                currency: 'INR',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000)
            };
            
            // Add optional session ID if available
            if (cfResponse.data?.payment_session_id) {
                paymentOrderData.cashfreeSessionId = String(cfResponse.data.payment_session_id);
            }
            
            console.log('Saving payment order to Firestore');
            
            // Store payment order
            const docRef = await db.collection('payment_orders').add(paymentOrderData);
            console.log('Payment order saved with ID:', docRef.id);
            
            const sessionId = cfResponse.data?.payment_session_id;
            if (!sessionId) {
                console.warn('⚠️  Cashfree response missing payment_session_id. Response:', cfResponse.data);
            }
            
            return {
                success: true,
                orderId: orderId,
                amount: amountNum,
                currency: 'INR',
                restaurantId: restaurantId,
                sessionId: sessionId || null
            };
            
        } catch (apiError) {
            let errorMsg = 'Cashfree API request failed';
            let statusCode = '';
            
            try {
                if (apiError && apiError.response && apiError.response.status) {
                    statusCode = String(apiError.response.status);
                }
                if (apiError && apiError.response && apiError.response.data && apiError.response.data.message) {
                    errorMsg = String(apiError.response.data.message);
                } else if (apiError && apiError.message) {
                    errorMsg = String(apiError.message);
                }
            } catch (e) {
                // If anything fails in error extraction, just use default
                errorMsg = 'Cashfree API error occurred';
            }
            
            console.error('Cashfree API failed with status:', statusCode);
            
            throw new functions.https.HttpsError(
                'internal',
                errorMsg
            );
        }
        
    } catch (error) {
        let errorMessage = 'Unknown error';
        
        try {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            
            errorMessage = error?.message || 'Failed to initiate payment';
        } catch (e) {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
        }
        
        console.error('Payment initiation failed:', errorMessage);
        
        throw new functions.https.HttpsError(
            'internal',
            errorMessage
        );
    }
});

exports.verifyAndCompletePayment = functions.https.onCall(async (data, context) => {
    console.log('verifyAndCompletePayment called');

    try {
        const { restaurantId, orderId, amount, userId } = data;
        console.log('Payment verification request:', { restaurantId, orderId, amount, userId });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== userId) {
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
                `${CASHFREE_API_URL}/pg/orders/${orderId}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-version': '2023-08-01',
                        'x-client-id': CASHFREE_APP_ID,
                        'x-client-secret': CASHFREE_SECRET_KEY
                    },
                    timeout: 10000
                }
            );

            console.log('Cashfree verification response:', verifyResponse.data);

            // Check if payment was successful - Cashfree uses different status values
            const orderStatus = verifyResponse.data.order_status || verifyResponse.data.status;
            const paymentStatus = verifyResponse.data.payment_status || verifyResponse.data.cf_payment_status;
            
            console.log('Order status from Cashfree:', orderStatus);
            console.log('Payment status from Cashfree:', paymentStatus);
            
            // Accept both PAID and SUCCESS statuses
            if (orderStatus !== 'PAID' && orderStatus !== 'ACTIVE' && paymentStatus !== 'SUCCESS') {
                console.error('Payment not completed. Order Status:', orderStatus, 'Payment Status:', paymentStatus);
                throw new functions.https.HttpsError('failed-precondition', 'Payment not completed on Cashfree. Order status: ' + orderStatus);
            }

            console.log('✓ Payment verified as PAID on Cashfree');

            const paymentData = {
                restaurantId: restaurantId,
                userId: userId,
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
            let errorMsg = 'Payment verification failed at Cashfree';
            try {
                if (cashfreeError && cashfreeError.response && cashfreeError.response.data && cashfreeError.response.data.message) {
                    errorMsg = String(cashfreeError.response.data.message);
                } else if (cashfreeError && cashfreeError.message) {
                    errorMsg = String(cashfreeError.message);
                }
            } catch (e) {
                errorMsg = 'Failed to verify payment';
            }
            console.error('Cashfree verification error');
            throw new functions.https.HttpsError('internal', errorMsg);
        }
    } catch (error) {
        let errorMsg = 'Payment verification error';
        try {
            if (error && error.message) {
                errorMsg = String(error.message);
            }
        } catch (e) {
            // ignore
        }
        console.error('Payment verification failed');
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});

exports.renewSubscription = functions.https.onCall(async (data, context) => {
    console.log('renewSubscription called');

    try {
        const { restaurantId, userId } = data;
        console.log('Subscription renewal request:', { restaurantId, userId });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        const renewalOrderId = `ROR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.collection('payment_orders').add({
            restaurantId: restaurantId,
            userId: userId,
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
        let errorMsg = 'Renewal order creation failed';
        try {
            if (error && error.message) {
                errorMsg = String(error.message);
            }
        } catch (e) {
            // ignore
        }
        console.error('Subscription renewal error');
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});

exports.verifyRenewalPayment = functions.https.onCall(async (data, context) => {
    console.log('verifyRenewalPayment called');

    try {
        const { restaurantId, orderId, amount, userId } = data;
        console.log('Renewal verification request:', { restaurantId, orderId, amount, userId });

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        // Verify this is the renewal payment (499)
        if (amount !== 499) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid payment amount for renewal');
        }

        const renewalPaymentData = {
            restaurantId: restaurantId,
            userId: userId,
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
        let errorMsg = 'Renewal verification failed';
        try {
            if (error && error.message) {
                errorMsg = String(error.message);
            }
        } catch (e) {
            // ignore
        }
        console.error('Renewal verification error');
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});

exports.checkSubscription = functions.https.onCall(async (data, context) => {
    console.log('checkSubscription called');

    try {
        const { restaurantId } = data;
        console.log('Subscription check request:', { restaurantId });

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
        let errorMsg = 'Subscription check failed';
        try {
            if (error && error.message) {
                errorMsg = String(error.message);
            }
        } catch (e) {
            // ignore
        }
        console.error('Subscription check error');
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', errorMsg);
    }
});