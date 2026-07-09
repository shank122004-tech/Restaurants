const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_URL = process.env.CASHFREE_API_URL || 'https://api.cashfree.com';
const APP_URL = process.env.APP_URL || 'https://gurufinder-6fd24.web.app';
const RENEWAL_AMOUNT_INR = 499;

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn('⚠️ WARNING: Cashfree credentials not configured');
    console.warn('Set: CASHFREE_APP_ID and CASHFREE_SECRET_KEY');
}

// ============================================
// CREATE RENEWAL ORDER - HTTP Endpoint
// ============================================

exports.createRenewalOrder = functions.https.onRequest(async (req, res) => {
    try {
        console.log('=== createRenewalOrder HTTP CALLED ===');

        // Allow CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.status(200).send('');
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        const { restaurantId } = req.body;

        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            console.error('Cashfree credentials missing!');
            res.status(500).json({ error: 'Payment gateway not configured' });
            return;
        }

        const customerId = restaurantId || ('guest-' + Date.now());
        const orderId = `RENEW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const amount = RENEWAL_AMOUNT_INR;

        try {
            // Step 1: Create order on Cashfree
            console.log('[1] Creating Cashfree order:', orderId);
            
            const orderResponse = await axios.post(
                `${CASHFREE_API_URL}/pg/orders`,
                {
                    order_id: orderId,
                    order_amount: amount,
                    order_currency: 'INR',
                    customer_details: {
                        customer_id: customerId,
                        customer_email: 'subscription@restaurant.local',
                        customer_phone: '9999999999',
                        customer_name: 'Restaurant Owner'
                    },
                    order_meta: {
                        return_url: `${APP_URL}/?orderId=${orderId}`,
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

            console.log('[2] Order created, creating payment session...');

            // Step 2: Create payment session
            const sessionResponse = await axios.post(
                `${CASHFREE_API_URL}/pg/orders/${orderId}/create/session`,
                {},
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

            const paymentSessionId = sessionResponse.data?.payment_session_id;

            if (!paymentSessionId) {
                console.error('No payment_session_id in response');
                res.status(500).json({ error: 'Cashfree did not return payment_session_id' });
                return;
            }

            console.log('[3] Session created, returning to client');

            // Save order record
            await db.collection('renewal_orders').add({
                orderId: orderId,
                restaurantId: restaurantId || null,
                amount: amount,
                paymentSessionId: paymentSessionId,
                status: 'initiated',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json({
                success: true,
                orderId: orderId,
                amount: amount,
                paymentSessionId: paymentSessionId
            });

        } catch (cashfreeError) {
            console.error('Cashfree API error:', 
                cashfreeError.response?.data || cashfreeError.message);
            res.status(500).json({
                error: cashfreeError.response?.data?.message || 'Failed to create payment order'
            });
        }

    } catch (error) {
        console.error('Create renewal order error:', error.message);
        res.status(500).json({
            error: error.message || 'Failed to create order'
        });
    }
});