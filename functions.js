// RestaurantOS Firebase Cloud Functions
// Deploy with: firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const QRCode = require('qrcode');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// ============================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================

exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    try {
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            role: 'restaurant_owner',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            emailVerified: user.emailVerified,
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`User created: ${user.uid}`);
    } catch (error) {
        console.error('Error creating user document:', error);
    }
});

exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
    try {
        // Delete user document
        await db.collection('users').doc(user.uid).delete();

        // Delete restaurants owned by this user
        const restaurantsSnapshot = await db.collection('restaurants')
            .where('ownerId', '==', user.uid)
            .get();

        const batch = db.batch();
        restaurantsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`User deleted: ${user.uid}`);
    } catch (error) {
        console.error('Error deleting user:', error);
    }
});

// ============================================
// PAYMENT & SUBSCRIPTION
// ============================================

exports.processPayment = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { restaurantId, orderId, amount, plan } = data;

        // Verify restaurant ownership
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        // Verify with Cashfree (mock implementation)
        // In production, call Cashfree API to verify payment
        const paymentVerified = await verifyCashfreePayment(orderId);

        if (!paymentVerified) {
            throw new functions.https.HttpsError('invalid-argument', 'Payment verification failed');
        }

        // Create payment record
        const paymentData = {
            restaurantId: restaurantId,
            userId: context.auth.uid,
            orderId: orderId,
            amount: amount,
            plan: plan,
            status: 'completed',
            paymentMethod: 'cashfree',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const paymentRef = await db.collection('payments').add(paymentData);

        // Update restaurant subscription
        const expiryDate = new Date();
        if (plan === 'premium') {
            expiryDate.setMonth(expiryDate.getMonth() + 1); // Monthly subscription
        }

        await db.collection('restaurants').doc(restaurantId).update({
            'subscription.status': 'active',
            'subscription.plan': plan,
            'subscription.lastPaymentId': paymentRef.id,
            'subscription.activatedAt': admin.firestore.FieldValue.serverTimestamp(),
            'subscription.expiryDate': expiryDate,
            status: 'active'
        });

        // Generate QR code
        const qrLink = `https://restaurantos.app/menu?restaurant=${restaurantId}`;
        const qrCode = await QRCode.toDataURL(qrLink, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Save QR code to storage
        await saveQRCodeToStorage(restaurantId, qrCode);

        return {
            success: true,
            paymentId: paymentRef.id,
            message: 'Payment verified and subscription activated',
            subscriptionExpiry: expiryDate.toISOString()
        };
    } catch (error) {
        console.error('Payment processing error:', error);
        throw error;
    }
});

async function verifyCashfreePayment(orderId) {
    try {
        // Mock verification - in production, call Cashfree API
        // const response = await axios.get(`https://api.cashfree.com/orders/${orderId}`, {
        //     headers: {
        //         'x-api-version': '2022-01-01',
        //         'x-client-id': process.env.CASHFREE_CLIENT_ID,
        //         'x-client-secret': process.env.CASHFREE_CLIENT_SECRET
        //     }
        // });
        // return response.data.order_status === 'PAID';

        return true; // Mock success
    } catch (error) {
        console.error('Cashfree verification error:', error);
        return false;
    }
}

exports.checkSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { restaurantId } = data;

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
        console.error('Subscription check error:', error);
        throw error;
    }
});

exports.renewSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { restaurantId } = data;

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1);

        await db.collection('restaurants').doc(restaurantId).update({
            'subscription.status': 'active',
            'subscription.expiryDate': expiryDate,
            'subscription.renewedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            expiryDate: expiryDate.toISOString()
        };
    } catch (error) {
        console.error('Subscription renewal error:', error);
        throw error;
    }
});

// ============================================
// QR CODE GENERATION
// ============================================

async function saveQRCodeToStorage(restaurantId, qrCodeData) {
    try {
        const bucket = storage.bucket();
        const file = bucket.file(`qrcodes/${restaurantId}/qrcode.png`);

        // Convert data URL to buffer
        const base64Data = qrCodeData.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        await file.save(buffer, {
            metadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=86400'
            }
        });

        // Make file public
        await file.makePublic();

        console.log(`QR code saved for restaurant: ${restaurantId}`);
    } catch (error) {
        console.error('Error saving QR code:', error);
    }
}

exports.generateQRCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { restaurantId } = data;

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this restaurant');
        }

        // Check subscription
        const subscription = restaurantDoc.data().subscription || {};
        if (subscription.status !== 'active') {
            throw new functions.https.HttpsError('permission-denied', 'Active subscription required');
        }

        const qrLink = `https://restaurantos.app/menu?restaurant=${restaurantId}`;
        const qrCode = await QRCode.toDataURL(qrLink);

        await saveQRCodeToStorage(restaurantId, qrCode);

        return {
            success: true,
            qrCode: qrCode
        };
    } catch (error) {
        console.error('QR code generation error:', error);
        throw error;
    }
});

// ============================================
// ORDER MANAGEMENT
// ============================================

exports.createOrder = functions.https.onCall(async (data, context) => {
    try {
        const { restaurantId, tableNumber, items, total } = data;

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Restaurant not found');
        }

        // Check subscription
        const subscription = restaurantDoc.data().subscription || {};
        if (subscription.status !== 'active') {
            throw new functions.https.HttpsError('permission-denied', 'Restaurant subscription inactive');
        }

        const orderId = 'ORD' + Math.floor(Date.now() / 1000);

        const orderData = {
            restaurantId: restaurantId,
            orderId: orderId,
            tableNumber: tableNumber,
            items: items,
            total: total,
            status: 'pending',
            paymentStatus: 'pending_cash',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            date: new Date().toDateString()
        };

        const orderRef = await db.collection('orders').add(orderData);

        // Send notification to restaurant
        await notifyRestaurant(restaurantId, `New order #${orderId} from table ${tableNumber}`);

        return {
            success: true,
            orderId: orderRef.id,
            orderNumber: orderId
        };
    } catch (error) {
        console.error('Order creation error:', error);
        throw error;
    }
});

exports.updateOrderStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { orderId, status } = data;

        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }

        const restaurantDoc = await db.collection('restaurants')
            .doc(orderDoc.data().restaurantId).get();

        if (restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You cannot update this order');
        }

        await db.collection('orders').doc(orderId).update({
            status: status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            message: `Order status updated to ${status}`
        };
    } catch (error) {
        console.error('Order update error:', error);
        throw error;
    }
});

// ============================================
// ANALYTICS & REPORTING
// ============================================

exports.calculateAnalytics = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
    try {
        const restaurantsSnapshot = await db.collection('restaurants').get();

        for (const restaurantDoc of restaurantsSnapshot.docs) {
            const restaurantId = restaurantDoc.id;
            const today = new Date().toDateString();

            // Get today's orders
            const ordersSnapshot = await db.collection('orders')
                .where('restaurantId', '==', restaurantId)
                .where('date', '==', today)
                .get();

            let todayRevenue = 0;
            let totalOrders = 0;
            const foodCounts = {};

            ordersSnapshot.forEach(orderDoc => {
                const order = orderDoc.data();
                todayRevenue += order.total || 0;
                totalOrders += 1;

                order.items?.forEach(item => {
                    foodCounts[item.name] = (foodCounts[item.name] || 0) + item.quantity;
                });
            });

            // Update analytics
            await db.collection('analytics').doc(restaurantId).set({
                restaurantId: restaurantId,
                date: today,
                dailyRevenue: todayRevenue,
                totalOrders: totalOrders,
                topFoods: foodCounts,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        console.log('Analytics calculated successfully');
    } catch (error) {
        console.error('Analytics calculation error:', error);
    }
});

// ============================================
// NOTIFICATIONS
// ============================================

async function notifyRestaurant(restaurantId, message) {
    try {
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        const ownerId = restaurantDoc.data().ownerId;

        await db.collection('notifications').add({
            userId: ownerId,
            restaurantId: restaurantId,
            message: message,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Notification sent to restaurant ${restaurantId}`);
    } catch (error) {
        console.error('Notification error:', error);
    }
}

// ============================================
// SCHEDULED TASKS
// ============================================

exports.checkSubscriptionExpiry = functions.pubsub.schedule('every 1 days').onRun(async (context) => {
    try {
        const restaurantsSnapshot = await db.collection('restaurants').get();
        const batch = db.batch();

        restaurantsSnapshot.forEach(doc => {
            const subscription = doc.data().subscription || {};
            if (subscription.expiryDate) {
                const expiryDate = new Date(subscription.expiryDate.seconds * 1000);
                if (new Date() > expiryDate) {
                    batch.update(doc.ref, {
                        'subscription.status': 'expired',
                        status: 'subscription_expired'
                    });
                }
            }
        });

        await batch.commit();
        console.log('Subscription expiry check completed');
    } catch (error) {
        console.error('Subscription expiry check error:', error);
    }
});

exports.cleanupOldData = functions.pubsub.schedule('every 30 days').onRun(async (context) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Delete old completed orders
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'completed')
            .where('createdAt', '<', thirtyDaysAgo)
            .get();

        const batch = db.batch();
        ordersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('Old data cleanup completed');
    } catch (error) {
        console.error('Cleanup error:', error);
    }
});

// ============================================
// STAFF MANAGEMENT
// ============================================

exports.addStaffMember = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { restaurantId, name, position, phone, email, status } = data;

        // Verify restaurant ownership
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists || restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
        }

        const staffData = {
            restaurantId: restaurantId,
            name: name,
            position: position,
            phone: phone,
            email: email,
            status: status,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('staff').add(staffData);
        return { id: docRef.id, ...staffData };
    } catch (error) {
        console.error('Error adding staff:', error);
        throw new functions.https.HttpsError('internal', 'Error adding staff member');
    }
});

// ============================================
// OFFERS & COUPONS
// ============================================

exports.createOffer = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { restaurantId, name, discountType, discountValue, minimumOrder, startDate, endDate, description, isActive } = data;

        // Verify restaurant ownership
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists || restaurantDoc.data().ownerId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
        }

        const offerData = {
            restaurantId: restaurantId,
            name: name,
            discountType: discountType,
            discountValue: discountValue,
            minimumOrder: minimumOrder,
            startDate: startDate,
            endDate: endDate,
            description: description,
            isActive: isActive,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('offers').add(offerData);
        return { id: docRef.id, ...offerData };
    } catch (error) {
        console.error('Error creating offer:', error);
        throw new functions.https.HttpsError('internal', 'Error creating offer');
    }
});

// ============================================
// REVIEWS & RATINGS
// ============================================

exports.submitReview = functions.https.onCall(async (data, context) => {
    try {
        const { restaurantId, rating, reviewText, customerName } = data;

        if (!restaurantId || !rating || rating < 1 || rating > 5) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid review data');
        }

        const reviewData = {
            restaurantId: restaurantId,
            rating: rating,
            text: reviewText || '',
            customerName: customerName || 'Anonymous',
            userId: context.auth?.uid || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            verified: context.auth ? true : false
        };

        const docRef = await db.collection('reviews').add(reviewData);

        // Update restaurant average rating
        const reviewsSnapshot = await db.collection('reviews')
            .where('restaurantId', '==', restaurantId)
            .get();

        let totalRating = 0;
        reviewsSnapshot.forEach(doc => {
            totalRating += doc.data().rating;
        });

        const averageRating = totalRating / reviewsSnapshot.size;

        await db.collection('restaurants').doc(restaurantId).update({
            averageRating: averageRating,
            totalReviews: reviewsSnapshot.size
        });

        return { id: docRef.id, ...reviewData };
    } catch (error) {
        console.error('Error submitting review:', error);
        throw new functions.https.HttpsError('internal', 'Error submitting review');
    }
});

// ============================================
// ENHANCED ANALYTICS
// ============================================

exports.recordOrderAnalytics = functions.https.onCall(async (data, context) => {
    try {
        const { restaurantId, orderId, totalAmount, itemCount } = data;

        const today = new Date().toISOString().split('T')[0];
        const analyticsId = `${restaurantId}_${today}`;

        const analyticsRef = db.collection('analytics').doc(analyticsId);
        const analyticsDoc = await analyticsRef.get();

        if (analyticsDoc.exists) {
            await analyticsRef.update({
                totalOrders: admin.firestore.FieldValue.increment(1),
                totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
                totalItems: admin.firestore.FieldValue.increment(itemCount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await analyticsRef.set({
                restaurantId: restaurantId,
                date: today,
                totalOrders: 1,
                totalRevenue: totalAmount,
                totalItems: itemCount,
                totalCustomers: 1,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error recording analytics:', error);
        throw new functions.https.HttpsError('internal', 'Error recording analytics');
    }
});

// ============================================
// GALLERY MANAGEMENT
// ============================================

exports.uploadGalleryImage = functions.storage.object().onFinalize(async (object) => {
    try {
        const filePath = object.name;
        const bucket = admin.storage().bucket();

        if (!filePath.includes('gallery/')) {
            return;
        }

        const filenameParts = filePath.split('/');
        const restaurantId = filenameParts[1];

        // Create public URL
        await bucket.file(filePath).makePublic();

        // Save to Firestore
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        await db.collection('gallery').add({
            restaurantId: restaurantId,
            imageUrl: publicUrl,
            fileName: filenameParts[filenameParts.length - 1],
            uploadedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Gallery image processed:', filePath);
    } catch (error) {
        console.error('Error processing gallery image:', error);
    }
});

// ============================================
// ERROR HANDLING & LOGGING
// ============================================

exports.logError = functions.https.onCall(async (data, context) => {
    try {
        const { error, context: errorContext } = data;

        await db.collection('error_logs').add({
            error: error,
            context: errorContext,
            userId: context.auth?.uid || 'anonymous',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.error('Client error logged:', error);
        return { success: true };
    } catch (error) {
        console.error('Error logging failed:', error);
    }
});

// ============================================
// EXPORTS FOR TESTING
// ============================================

module.exports = {
    processPayment: exports.processPayment,
    checkSubscription: exports.checkSubscription,
    generateQRCode: exports.generateQRCode,
    createOrder: exports.createOrder,
    updateOrderStatus: exports.updateOrderStatus,
    calculateAnalytics: exports.calculateAnalytics,
    checkSubscriptionExpiry: exports.checkSubscriptionExpiry,
    cleanupOldData: exports.cleanupOldData
};