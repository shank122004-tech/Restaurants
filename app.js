// ============================================
// RESTAURANTOS - COMPLETE APPLICATION
// ============================================

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCDwPcVJf5Ftof3-wSmsR4vuGyqtIaTRe8",
  authDomain: "gurufinder-6fd24.firebaseapp.com",
  projectId: "gurufinder-6fd24",
  storageBucket: "gurufinder-6fd24.firebasestorage.app",
  messagingSenderId: "48259655802",
  appId: "1:48259655802:web:f8da6f1c373825e6a073c3",
  measurementId: "G-6QWJ7EN367"
};

// Initialize Firebase
let auth, db, storage, functions;
let firebaseInitialized = false;
let authStateReady = false;
let cashfreeInitialized = false;

// Helper function to inspect and log all Cashfree SDK methods
function inspectCashfreeSDK() {
    try {
        console.log('=== CASHFREE SDK INSPECTION ===');
        
        if (typeof Cashfree === 'undefined') {
            console.log('Cashfree SDK not loaded');
            return;
        }
        
        console.log('1. Cashfree type:', typeof Cashfree);
        console.log('2. Cashfree.toString():', Cashfree.toString().substring(0, 100));
        
        // Try to instantiate
        try {
            const instance = new Cashfree({mode: 'production'});
            
            console.log('3. Instance created successfully');
            console.log('4. Instance type:', typeof instance);
            
            // Get all properties and methods
            const props = Object.getOwnPropertyNames(instance);
            const protoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
            
            console.log('5. Instance properties:', props);
            console.log('6. Instance prototype methods:', protoProps);
            
            // Check for specific methods
            const methodsToCheck = [
                'checkoutRedirect',
                'checkout', 
                'redirectToCheckout',
                'getCheckoutURL',
                'setPaymentSessionId',
                'openCheckout',
                'load',
                'initialize'
            ];
            
            console.log('7. Checking specific methods:');
            methodsToCheck.forEach(method => {
                console.log(`   - ${method}: ${typeof instance[method]}`);
            });
            
            // Try to see if there's a redirect method
            const allMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
            console.log('8. All available methods:', allMethods);
            
        } catch (e) {
            console.log('3. Instance creation failed:', e.message);
        }
        
    } catch (error) {
        console.error('SDK inspection error:', error);
    }
}

// Initialize Cashfree SDK
function initializeCashfree() {
    try {
        console.log('[Cashfree] Checking SDK availability...');
        
        if (typeof Cashfree === 'undefined') {
            console.warn('[Cashfree] SDK not loaded yet');
            return false;
        }
        
        console.log('[Cashfree] SDK is loaded');
        console.log('[Cashfree] Cashfree is a:', typeof Cashfree);
        
        // Try to create a test instance to verify it works
        try {
            const testInstance = new Cashfree({
                mode: 'production'
            });
            console.log('[Cashfree] ✓ Instance creation successful');
            console.log('[Cashfree] Instance type:', typeof testInstance);
            console.log('[Cashfree] Instance prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(testInstance)));
            
            // Check which methods are available
            const proto = Object.getPrototypeOf(testInstance);
            const methods = Object.getOwnPropertyNames(proto).filter(name => typeof testInstance[name] === 'function');
            console.log('[Cashfree] Available instance methods:', methods);
            
            cashfreeInitialized = true;
            return true;
        } catch (instanceError) {
            console.warn('[Cashfree] Could not instantiate SDK:', instanceError.message);
            return false;
        }
    } catch (error) {
        console.warn('[Cashfree] Initialization error:', error.message);
        return false;
    }
}

// Initialize after Firebase SDK is loaded
function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded yet');
        return false;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
        functions = firebase.app().functions('us-central1');
        
        // CRITICAL: Set up auth state listener to ensure auth is ready
        auth.onAuthStateChanged((user) => {
            console.log('[Auth State Changed]', user ? `User: ${user.uid}` : 'Signed out');
            authStateReady = true;
        });
        
        firebaseInitialized = true;
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.warn('Firebase initialization error:', error.message);
        firebaseInitialized = false;
        return false;
    }
}

// Helper function to test if auth context is being passed to Cloud Functions
async function testAuthWithCloudFunction() {
    try {
        console.log('[Auth Test] Testing auth context with Cloud Functions...');
        const testFunc = functions.httpsCallable('testAuth');
        const result = await testFunc({});
        console.log('[Auth Test] ✓ Success! Auth is working. UID:', result.data.uid);
        return true;
    } catch (error) {
        console.error('[Auth Test] ✗ Failed - auth context not being passed');
        console.error('[Auth Test] Error:', error.message);
        return false;
    }
}

// Helper function to ensure auth is fully ready
async function waitForAuthState() {
    return new Promise((resolve) => {
        if (auth.currentUser) {
            console.log('[Auth] User already present:', auth.currentUser.uid);
            resolve(auth.currentUser);
            return;
        }

        console.log('[Auth] Waiting for auth state to be ready...');
        const unsubscribe = auth.onAuthStateChanged((user) => {
            console.log('[Auth State Listener] User:', user ? user.uid : 'null');
            unsubscribe(); // Unsubscribe after first call
            if (user) {
                console.log('[Auth] Auth state is ready for user:', user.uid);
                resolve(user);
            } else {
                console.log('[Auth] No user found');
                resolve(null);
            }
        });
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateObj) {
    if (!dateObj) return '-';
    
    let date;
    if (typeof dateObj === 'string') {
        date = new Date(dateObj);
    } else if (dateObj.toDate) {
        // Firestore Timestamp object
        date = dateObj.toDate();
    } else if (dateObj instanceof Date) {
        date = dateObj;
    } else if (dateObj.seconds !== undefined) {
        // Firestore Timestamp-like object {seconds, nanoseconds}
        date = new Date(dateObj.seconds * 1000);
    } else {
        return '-';
    }
    
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function isSubscriptionExpired(restaurant) {
    if (!restaurant || !restaurant.subscription) return true;
    
    const expiryDate = restaurant.subscription.expiryDate;
    if (!expiryDate) return true;
    
    let expiry;
    if (typeof expiryDate === 'string') {
        expiry = new Date(expiryDate);
    } else if (expiryDate.toDate) {
        expiry = expiryDate.toDate();
    } else if (expiryDate instanceof Date) {
        expiry = expiryDate;
    } else if (expiryDate.seconds !== undefined) {
        expiry = new Date(expiryDate.seconds * 1000);
    } else {
        return true;
    }
    
    return new Date() > expiry;
}

async function checkPaymentStatus(restaurantId, userId) {
    try {
        if (!firebaseInitialized || !db) {
            return { isPaymentConfirmed: false, isSubscriptionActive: false, isPending: false };
        }

        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        
        if (!restaurantDoc.exists) {
            return { isPaymentConfirmed: false, isSubscriptionActive: false, isPending: false };
        }

        const data = restaurantDoc.data();
        
        // Primary check: Restaurant status is set by Cloud Function after payment verification
        const restaurantStatus = data.status || 'pending_payment';
        const isPaymentConfirmed = restaurantStatus === 'active';
        
        // Check if subscription is active and not expired
        const subscription = data.subscription || {};
        const isSubscriptionActive = subscription.status === 'active' && !isSubscriptionExpired(data);
        
        // Check if payment is pending
        const isPending = restaurantStatus === 'pending_payment';

        return {
            isPaymentConfirmed,
            isSubscriptionActive,
            isPending,
            subscription: subscription,
            restaurantStatus: restaurantStatus
        };
    } catch (error) {
        console.error('Error checking payment status:', error);
        // Return safe default - no access without confirmation
        return { isPaymentConfirmed: false, isSubscriptionActive: false, isPending: false };
    }
}

// Global Application State
const app = {
    currentUser: null,
    currentRestaurant: null,
    currentPage: 'landing',
    userRole: null,
    cart: {},
    cartItems: [],
    selectedTable: null,
    currentRestaurantId: null,
    onboardingData: {},
    currentTab: 'overview',
    currentMenuTab: 'foods',
    charts: {},
    previousTab: 'overview',
    previousPage: null,
    selectedCategory: null,
    selectedFood: null,
    orders: [],
    reviews: [],
    offers: [],
    coupons: [],
    categories: [],
    foods: [],
    variants: [],
    addons: [],
    kitchenRefreshInterval: null,
    dashboardRefreshInterval: null,
    ordersRefreshInterval: null,
    kitchenListener: null,
    ordersListener: null,
    previewMode: false,
    customerMode: false,
    restaurantOpeningTime: '09:00',
    restaurantClosingTime: '23:00',
    restaurantClosed: false,
    weeklyHolidays: [],
    specialHolidays: [],
    tables: [],
    draggedItem: null,
    draggedType: null,
    nextOrderNumber: 1
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[App] DOMContentLoaded - Starting initialization');
    
    // Wait for Firebase SDK to load from CDN
    await new Promise(resolve => setTimeout(resolve, 500));

    // Initialize Firebase
    initializeFirebase();
    
    // Wait for Firebase to be fully ready
    let attempts = 0;
    while (!firebaseInitialized && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
    }
    
    console.log('[App] Firebase ready:', firebaseInitialized);
    
    // Initialize Cashfree SDK
    console.log('[App] Initializing Cashfree SDK...');
    let cashfreeAttempts = 0;
    while (!cashfreeInitialized && cashfreeAttempts < 10) {
        initializeCashfree();
        if (!cashfreeInitialized) {
            await new Promise(resolve => setTimeout(resolve, 300));
            cashfreeAttempts++;
        }
    }
    
    if (cashfreeInitialized) {
        console.log('[App] ✓ Cashfree SDK initialized');
        // Inspect available methods
        inspectCashfreeSDK();
    } else {
        console.warn('[App] ⚠️ Cashfree SDK initialization failed - will try again when needed');
    }

    // Check if this is a payment return from Cashfree
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('paymentStatus');
    const paymentOrderId = params.get('orderId');
    const paymentRestaurantId = params.get('restaurantId');
    
    if (paymentStatus && paymentOrderId && paymentRestaurantId) {
        console.log('[App] Payment return detected:', paymentStatus);
        // Clean up URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (paymentStatus === 'success') {
            // Handle payment completion
            handlePaymentReturn(paymentOrderId, paymentRestaurantId, 'success');
            return;
        } else {
            showNotification('Payment failed. Please try again.', 'error');
            navigateTo('landing');
            return;
        }
    }

    // Check if customer is accessing via QR code FIRST
    const restaurantId = params.get('restaurant');
    
    console.log('[App] Restaurant param:', restaurantId);
    
    if (restaurantId) {
        // Customer accessing via QR code - set customer mode
        console.log('[App] Customer mode - loading menu for restaurant:', restaurantId);
        app.customerMode = true;
        app.currentRestaurantId = restaurantId;
        
        if (firebaseInitialized && db) {
            await loadCustomerMenu(restaurantId);
        } else {
            console.error('[App] Firebase not ready');
            showNotification('Loading...', 'info');
            // Wait more and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (firebaseInitialized && db) {
                await loadCustomerMenu(restaurantId);
            }
        }
        // Skip auth setup for customer mode - customer should not access dashboard
        return;
    } else {
        // Show landing page for non-customers
        console.log('[App] Owner/Staff mode - showing landing page');
        navigateTo('landing');

        // Only setup auth if Firebase is initialized
        if (firebaseInitialized && auth) {
            // Check authentication state
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    app.currentUser = user;
                    try {
                        // First check if user email is approved in approved_owners collection
                        const approvedCheck = await Promise.race([
                            db.collection('approved_owners')
                                .where('email', '==', user.email.toLowerCase())
                                .limit(1)
                                .get(),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Approval check timeout')), 5000)
                            )
                        ]);

                        if (approvedCheck.empty) {
                            // User email is not approved - sign them out
                            await auth.signOut();
                            app.currentUser = null;
                            showNotification('⛔ Your email is not authorized. Contact administrator.', 'error');
                            updateLandingPageHeader(null);
                            return;
                        }

                        // User is approved, now get user role from Firestore
                        const userDoc = await Promise.race([
                            db.collection('users').doc(user.uid).get(),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Firestore timeout')), 5000)
                            )
                        ]);

                        if (userDoc.exists) {
                            app.userRole = userDoc.data().role;
                            
                            // Check if restaurant owner has created a restaurant
                            if (app.userRole === 'restaurant_owner') {
                                const restaurantDoc = await db.collection('restaurants')
                                    .where('ownerId', '==', user.uid)
                                    .limit(1)
                                    .get();
                                if (!restaurantDoc.empty) {
                                    app.currentRestaurant = restaurantDoc.docs[0].data();
                                    app.currentRestaurantId = restaurantDoc.docs[0].id;
                                    
                                    // Show dashboard button directly - no payment requirement
                                    showDashboardButton();
                                } else {
                                    // User is approved but hasn't created a restaurant yet
                                    showOnboardingButton();
                                }
                            }
                        } else {
                            // New user - show onboarding button
                            showOnboardingButton();
                        }
                        
                        // Update landing page header to show logged-in user
                        updateLandingPageHeader(user);
                    } catch (error) {
                        console.warn('Could not fetch user data:', error.message);
                        // Keep landing page visible but don't show as logged in if approval check failed
                        if (error.message.includes('Approval check') || error.message.includes('permissions')) {
                            await auth.signOut();
                            app.currentUser = null;
                            updateLandingPageHeader(null);
                        }
                    }
                } else {
                    // Not logged in - show normal landing page
                    updateLandingPageHeader(null);
                }
            });
        }
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('Service Worker registered');
            
            // Check for updates every 30 seconds for customer pages
            if (app.customerMode) {
                setInterval(() => {
                    registration.update();
                }, 30000);
            } else {
                // Check for updates every 5 minutes for other pages
                setInterval(() => {
                    registration.update();
                }, 300000);
            }
            
            // Listen for controller change (new service worker activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[SW] Controller changed - new version available');
                if (app.customerMode) {
                    console.log('[Customer] Reloading for latest menu data');
                    location.reload();
                }
            });
            
        }).catch(err => {
            console.log('Service Worker registration failed:', err);
        });
    }
});

// ============================================
// LANDING PAGE HEADER UPDATES
// ============================================

function updateLandingPageHeader(user) {
    const navLinks = document.querySelector('.nav-links');
    const heroGetStartedBtn = document.getElementById('hero-get-started');
    
    if (!navLinks) return;

    if (user) {
        // User is logged in - hide Get Started button
        if (heroGetStartedBtn) {
            heroGetStartedBtn.style.display = 'none';
        }
        
        navLinks.innerHTML = `
            <a href="#features" class="nav-link">Features</a>
            <a href="#pricing" class="nav-link">Pricing</a>
            <div class="user-menu" style="display: flex; align-items: center; gap: 15px;">
                <span class="nav-link" style="color: #64748B;">${user.displayName || user.email}</span>
                <button class="nav-btn" onclick="logout()" style="background: #EF4444;">Logout</button>
            </div>
        `;
    } else {
        // User is not logged in - show Get Started button
        if (heroGetStartedBtn) {
            heroGetStartedBtn.style.display = 'inline-block';
        }
        
        navLinks.innerHTML = `
            <a href="#features" class="nav-link">Features</a>
            <a href="#pricing" class="nav-link">Pricing</a>
            <a href="#" onclick="navigateTo('signin')" class="nav-btn">Sign In</a>
        `;
    }
}

function showDashboardButton() {
    const heroBtns = document.querySelector('.hero-buttons');
    const getStartedBtn = document.getElementById('hero-get-started');
    if (!heroBtns) return;

    // Hide the Get Started button
    if (getStartedBtn) {
        getStartedBtn.style.display = 'none';
    }

    const dashboard = heroBtns.querySelector('[onclick*="dashboard"]');
    if (!dashboard) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = '📊 Go to Dashboard';
        btn.onclick = () => navigateTo('dashboard');
        heroBtns.appendChild(btn);
    }
}

function showOnboardingButton() {
    const heroBtns = document.querySelector('.hero-buttons');
    const getStartedBtn = document.getElementById('hero-get-started');
    if (!heroBtns) return;

    // Hide the Get Started button
    if (getStartedBtn) {
        getStartedBtn.style.display = 'none';
    }

    const onboarding = heroBtns.querySelector('[onclick*="onboarding"]');
    if (!onboarding) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = '🚀 Complete Setup';
        btn.onclick = () => navigateTo('onboarding');
        heroBtns.appendChild(btn);
    }
}

function showPaymentPendingButton() {
    const heroBtns = document.querySelector('.hero-buttons');
    const getStartedBtn = document.getElementById('hero-get-started');
    if (!heroBtns) return;

    // Hide the Get Started button
    if (getStartedBtn) {
        getStartedBtn.style.display = 'none';
    }

    const pending = heroBtns.querySelector('[onclick*="pending"]');
    if (!pending) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = '⏳ Complete Payment';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.title = 'Your payment is being processed. Please wait.';
        heroBtns.appendChild(btn);
    }
}

function showPaymentRequiredButton() {
    // Payment is no longer required - show setup button instead
    showOnboardingButton();
}

function showPaymentRequiredModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 400px; text-align: center;">
            <h2 style="margin-top: 0; color: #0F172A;">Complete Payment Setup</h2>
            <p style="color: #64748B;">Unlock all features with a one-time setup fee.</p>
            <div style="background: #F8FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #64748B;">One-time Setup Fee</p>
                <p style="margin: 10px 0 0 0; font-size: 28px; font-weight: bold; color: #0F172A;">₹999</p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748B;">+ ₹499/month subscription after</p>
            </div>
            <button onclick="proceedToPaymentSetup()" style="background: #3B82F6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; font-weight: 600; margin-bottom: 10px;">💳 Proceed to Payment</button>
            <button onclick="this.closest('div').parentElement.remove()" style="background: #E2E8F0; color: #0F172A; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 14px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function proceedToPaymentSetup() {
    // Close the modal
    const modal = document.querySelector('[style*="position: fixed"][style*="z-index: 10000"]');
    if (modal) modal.remove();
    
    // Go to onboarding to complete payment
    navigateTo('onboarding');
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(page) {
    // Prevent navigation away from customer menu when in customer mode
    if (app.customerMode && page !== 'customer-menu') {
        console.log('[App] Blocked navigation to', page, '- customer mode active');
        showNotification('Please complete your order or close the browser tab to exit', 'warning');
        return;
    }
    
    console.log('[App] Navigating to:', page);
    app.currentPage = page;
    const appDiv = document.getElementById('app');
    appDiv.innerHTML = '';

    if (page === 'landing') {
        const template = document.getElementById('landing-page');
        appDiv.appendChild(template.content.cloneNode(true));
        
        // Setup landing page after rendering
        setTimeout(() => {
            setupLandingPage();
        }, 100);
    } else if (page === 'signin') {
        const template = document.getElementById('auth-page');
        appDiv.appendChild(template.content.cloneNode(true));
    } else if (page === 'onboarding') {
        const template = document.getElementById('onboarding-page');
        appDiv.appendChild(template.content.cloneNode(true));
        setupOnboarding();
    } else if (page === 'dashboard') {
        // Show dashboard if user has a restaurant
        if (app.currentRestaurantId && app.currentUser) {
            const template = document.getElementById('restaurant-dashboard');
            appDiv.appendChild(template.content.cloneNode(true));
            setupDashboard();
        } else {
            showNotification('Please login first', 'warning');
            navigateTo('signin');
        }
    } else if (page === 'customer-menu') {
        const template = document.getElementById('customer-menu');
        appDiv.appendChild(template.content.cloneNode(true));
        setupCustomerMenu();
    } else if (page === 'staff') {
        const template = document.getElementById('staff-page');
        appDiv.appendChild(template.content.cloneNode(true));
        setTimeout(() => loadStaff(), 100);
    } else if (page === 'offers') {
        const template = document.getElementById('offers-page');
        appDiv.appendChild(template.content.cloneNode(true));
        setTimeout(() => loadOffers(), 100);
    } else if (page === 'settings') {
        const template = document.getElementById('settings-page');
        appDiv.appendChild(template.content.cloneNode(true));
        setTimeout(() => loadSettings(), 100);
    } else if (page === 'admin-login') {
        const template = document.getElementById('admin-login-page');
        appDiv.appendChild(template.content.cloneNode(true));
    } else if (page === 'admin-dashboard') {
        const template = document.getElementById('admin-dashboard-page');
        appDiv.appendChild(template.content.cloneNode(true));
        setTimeout(() => {
            if (adminUser) {
                loadAdminDashboard();
            } else {
                navigateTo('admin-login');
            }
        }, 100);
    }
}

// ============================================
// LANDING PAGE SETUP
// ============================================

function setupLandingPage() {
    // Update header based on login state
    if (app.currentUser) {
        updateLandingPageHeader(app.currentUser);
        
        // Add dashboard/setup button if needed
        if (app.currentRestaurantId) {
            showDashboardButton();
        } else if (app.currentUser && !app.currentRestaurantId) {
            // User is logged in but hasn't completed onboarding
            showOnboardingButton();
        }
    } else {
        updateLandingPageHeader(null);
    }
}

// ============================================
// AUTHENTICATION
// ============================================

async function signInWithGoogle() {
    if (!firebaseInitialized || !auth) {
        showNotification('Firebase not configured. Please configure Firebase first.', 'error');
        return;
    }

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            'login_hint': 'user@example.com'
        });
        
        const result = await auth.signInWithPopup(provider);
        const userEmail = result.user.email;
        
        // Check if user's email is in approved_owners collection
        try {
            const approvedDoc = await db.collection('approved_owners')
                .where('email', '==', userEmail.toLowerCase())
                .get();
            
            if (approvedDoc.empty) {
                // User is not approved
                await auth.signOut();
                showNotification('⛔ Your email is not authorized to use this platform. Please contact the administrator.', 'error');
                return;
            }
        } catch (checkError) {
            console.error('Error checking approved owners:', checkError);
            await auth.signOut();
            showNotification('Error verifying authorization. Please try again.', 'error');
            return;
        }
        
        app.currentUser = result.user;
        
        // Save user to Firestore with timeout
        try {
            const userRef = db.collection('users').doc(result.user.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                // Save user with timeout
                await Promise.race([
                    userRef.set({
                        uid: result.user.uid,
                        email: result.user.email,
                        displayName: result.user.displayName,
                        photoURL: result.user.photoURL,
                        role: 'restaurant_owner',
                        createdAt: new Date(),
                        status: 'active'
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Firestore write timeout')), 5000)
                    )
                ]);
            }
        } catch (firestoreError) {
            console.warn('Could not save user to Firestore:', firestoreError.message);
            // Continue anyway - user is authenticated and approved
        }
        
        showNotification('Signed in successfully!', 'success');
        // Navigate back to landing page so user sees updated header with dashboard button
        setTimeout(() => navigateTo('landing'), 1500);
    } catch (error) {
        console.error('Auth error:', error);
        
        if (error.code === 'auth/popup-blocked') {
            showNotification('Pop-up was blocked. Please allow pop-ups for this site.', 'error');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showNotification('Sign-in cancelled', 'info');
        } else if (error.message && error.message.includes('offline')) {
            showNotification('You appear to be offline. Please check your internet connection.', 'error');
        } else if (error.message && error.message.includes('CORS')) {
            showNotification('Authentication service error. This may be a browser security issue.', 'error');
        } else {
            showNotification('Authentication failed: ' + (error.message || 'Unknown error'), 'error');
        }
    }
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            if (firebaseInitialized && auth) {
                await auth.signOut();
            }
            app.currentUser = null;
            app.currentRestaurant = null;
            app.currentRestaurantId = null;
            app.userRole = null;
            navigateTo('landing');
            showNotification('Logged out successfully', 'success');
        } catch (error) {
            showNotification('Logout failed: ' + error.message, 'error');
        }
    }
}

// ============================================
// ONBOARDING
// ============================================

function setupOnboarding() {
    updateProgressBar(1);
}

function nextStep() {
    const currentStep = parseInt(document.getElementById('current-step').textContent);
    
    // Validate current step
    if (!validateStep(currentStep)) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    // Save step data
    saveStepData(currentStep);
    
    if (currentStep < 5) {
        document.getElementById('step-' + currentStep).classList.remove('active');
        document.getElementById('step-' + (currentStep + 1)).classList.add('active');
        updateProgressBar(currentStep + 1);
    }
}

function previousStep() {
    const currentStep = parseInt(document.getElementById('current-step').textContent);
    if (currentStep > 1) {
        document.getElementById('step-' + currentStep).classList.remove('active');
        document.getElementById('step-' + (currentStep - 1)).classList.add('active');
        updateProgressBar(currentStep - 1);
    }
}

function updateProgressBar(step) {
    document.getElementById('current-step').textContent = step;
    document.getElementById('progress-fill').style.width = (step * 20) + '%';
}

function validateStep(step) {
    if (step === 1) {
        const name = document.getElementById('restaurantName').value;
        const type = document.getElementById('restaurantType').value;
        const owner = document.getElementById('ownerName').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        return name && type && owner && phone && email;
    } else if (step === 3) {
        const state = document.getElementById('state').value;
        const city = document.getElementById('city').value;
        const address = document.getElementById('address').value;
        const pincode = document.getElementById('pincode').value;
        return state && city && address && pincode;
    } else if (step === 4) {
        const tables = document.getElementById('tableCount').value;
        return tables;
    }
    return true;
}

function saveStepData(step) {
    if (step === 1) {
        app.onboardingData = {
            ...app.onboardingData,
            name: document.getElementById('restaurantName').value,
            type: document.getElementById('restaurantType').value,
            description: document.getElementById('restaurantDescription').value,
            ownerName: document.getElementById('ownerName').value,
            phone: document.getElementById('phone').value,
            whatsapp: document.getElementById('whatsapp').value,
            email: document.getElementById('email').value,
            website: document.getElementById('website').value,
            instagram: document.getElementById('instagram').value,
            facebook: document.getElementById('facebook').value
        };
    } else if (step === 3) {
        app.onboardingData = {
            ...app.onboardingData,
            state: document.getElementById('state').value,
            city: document.getElementById('city').value,
            area: document.getElementById('area').value,
            address: document.getElementById('address').value,
            pincode: document.getElementById('pincode').value
        };
    } else if (step === 4) {
        app.onboardingData = {
            ...app.onboardingData,
            openingTime: document.getElementById('openingTime').value,
            closingTime: document.getElementById('closingTime').value,
            tableCount: parseInt(document.getElementById('tableCount').value),
            prepTime: parseInt(document.getElementById('prepTime').value)
        };
    }
}

function previewImage(type) {
    const fileInput = type === 'logo' ? document.getElementById('logoInput') : document.getElementById('bannerInput');
    const previewDiv = type === 'logo' ? document.getElementById('logo-preview') : document.getElementById('banner-preview');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewDiv.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            app.onboardingData[type + 'File'] = fileInput.files[0];
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
}

async function initiatePayment() {
    console.log('=== PAYMENT INITIATION START ===');
    
    if (!firebaseInitialized || !db || !functions || !auth) {
        console.error('Firebase not initialized:', { firebaseInitialized, db: !!db, functions: !!functions, auth: !!auth });
        showNotification('Firebase not initialized. Please configure Firebase first.', 'error');
        return;
    }

    // Check if user is authenticated
    const currentUser = auth.currentUser;
    console.log('Current user:', currentUser ? { uid: currentUser.uid, email: currentUser.email } : 'NULL');
    
    if (!currentUser) {
        console.error('User not authenticated');
        showNotification('You must be logged in to proceed with payment.', 'error');
        navigateTo('signin');
        return;
    }

    console.log('User authenticated:', currentUser.uid);

    // Wait for auth state to be fully ready in Firebase
    console.log('Ensuring auth state is fully synchronized...');
    const authUser = await waitForAuthState();
    if (!authUser) {
        console.error('Auth state listener failed to detect user');
        showNotification('Authentication failed. Please sign in again.', 'error');
        navigateTo('signin');
        return;
    }
    console.log('Auth state synchronized:', authUser.uid);

    // Force refresh the auth token to ensure it's valid and fresh
    try {
        console.log('Refreshing auth token...');
        const freshToken = await currentUser.getIdToken(true);
        console.log('Auth token refreshed successfully, length:', freshToken.length);
    } catch (tokenError) {
        console.error('Failed to refresh auth token:', tokenError);
        showNotification('Authentication expired. Please sign in again.', 'error');
        navigateTo('signin');
        return;
    }

    // Auth is already verified - user is logged in
    console.log('[Auth] User authenticated:', currentUser.uid);

    // Save restaurant data to Firestore
    let restaurantRef = null;
    try {
        console.log('Creating restaurant record...');
        restaurantRef = await db.collection('restaurants').add({
            ownerId: currentUser.uid,
            ...app.onboardingData,
            createdAt: new Date(),
            status: 'pending_payment',
            subscription: {
                plan: 'premium',
                status: 'inactive',
                oneTimeAmount: 999,
                monthlyAmount: 499,
                expiryDate: null
            }
        });
        
        console.log('Restaurant created:', restaurantRef.id);
        app.currentRestaurantId = restaurantRef.id;
        
        // Wait to ensure auth state is fully propagated
        console.log('Waiting for auth propagation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify auth is still present before calling function
        console.log('Verifying auth before function call...');
        if (!auth.currentUser) {
            throw new Error('Auth state lost before calling function');
        }
        console.log('Auth verified, current user:', auth.currentUser.uid);
        
        // Call backend function to process payment with Cashfree
        try {
            console.log('Preparing to call initiatePaymentWithCashfree...');
            console.log('User UID:', currentUser.uid);
            console.log('Restaurant ID:', restaurantRef.id);
            
            // Show loading state
            showNotification('Initiating payment with Cashfree...', 'info');
            
            // Create the callable function reference
            const initiatePaymentFunc = functions.httpsCallable('initiatePaymentWithCashfree');
            console.log('[Callable] Function reference created, calling with data...');
            console.log('[Callable] functions object exists:', !!functions);
            console.log('[Callable] functions type:', typeof functions);
            
            // Call the function with userId parameter
            const paymentData = {
                restaurantId: restaurantRef.id,
                amount: 999,
                plan: 'premium',
                userId: currentUser.uid
            };
            
            console.log('[DEBUG] Payment Data to send:', JSON.stringify(paymentData));
            console.log('[DEBUG] restaurantId:', restaurantRef.id);
            console.log('[DEBUG] amount:', 999);
            console.log('[DEBUG] plan:', 'premium');
            console.log('[DEBUG] userId:', currentUser.uid);
            
            const result = await initiatePaymentFunc(paymentData);
            
            console.log('[Callable] ✓ Function call successful');
            console.log('[Callable] Response data:', result.data);
            
            // Verify response has required fields
            if (!result.data) {
                throw new Error('Response data is empty');
            }
            
            console.log('[Callable] Order ID:', result.data.orderId);
            console.log('[Callable] Session ID:', result.data.sessionId);
            console.log('[Callable] Amount:', result.data.amount);
            
            if (!result.data.orderId) {
                throw new Error('Order ID not in response');
            }
            
            // Store order details
            app.onboardingData.cashfreeOrderId = result.data.orderId;
            app.cashfreeSessionId = result.data.sessionId;
            
            console.log('[Payment] Stored Order ID:', app.onboardingData.cashfreeOrderId);
            console.log('[Payment] Stored Session ID:', app.cashfreeSessionId);
            
            // Open Cashfree payment with session ID
            console.log('[Payment] Opening Cashfree payment...');
            openCashfreePayment(result.data, restaurantRef.id);
            
        } catch (functionError) {
            console.error('Payment error:', functionError.message);
            showNotification('Error initiating payment: ' + functionError.message, 'error');
            return;
        }
    } catch (error) {
        console.error('Error initiating payment:', error.message);
        showNotification('Failed to process payment: ' + error.message, 'error');
    }
}

function openCashfreePayment(paymentData, restaurantId) {
    try {
        console.log('=== OPENING PAYMENT MODAL ===');
        console.log('Payment data:', paymentData);
        console.log('Restaurant ID:', restaurantId);
        console.log('Session ID available:', !!app.cashfreeSessionId);
        
        showNotification('Opening Cashfree Payment Gateway...', 'info');
        
        // Remove any existing payment container
        const existingContainer = document.getElementById('cf-payment-container');
        if (existingContainer) {
            console.log('Removing existing payment container');
            existingContainer.remove();
        }
        
        // Create a payment session container
        const paymentContainer = document.createElement('div');
        paymentContainer.id = 'cf-payment-container';
        paymentContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        paymentContainer.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <h2 style="color: #0F172A; margin-top: 0; font-size: 24px; margin-bottom: 10px;">Complete Payment</h2>
                <p style="color: #64748B; margin: 0 0 30px 0;">Setup fee for your restaurant</p>
                <div style="margin: 30px 0;">
                    <div style="border: 2px solid #3B82F6; border-radius: 8px; padding: 20px; background: #F0F9FF;">
                        <p style="margin: 10px 0; font-size: 16px; color: #0F172A;">
                            <strong>Amount to Pay</strong>
                        </p>
                        <p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #3B82F6;">
                            ₹${paymentData.amount}
                        </p>
                        <p style="margin: 10px 0; font-size: 12px; color: #64748B;">
                            <strong>Order ID:</strong> ${paymentData.orderId}
                        </p>
                    </div>
                </div>
                <p style="color: #64748B; font-size: 14px; margin: 20px 0;">You will be redirected to Cashfree for secure payment.</p>
                <button id="proceed-payment-btn" onclick="proceedToCashfreeCheckout('${paymentData.orderId}', '${restaurantId}', ${paymentData.amount})" 
                        style="background: #3B82F6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; margin-bottom: 10px; transition: background 0.3s;">
                    ✓ Proceed to Payment
                </button>
                <button onclick="cancelPayment('${restaurantId}')" 
                        style="background: #E2E8F0; color: #0F172A; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; width: 100%; transition: background 0.3s;">
                    Cancel
                </button>
            </div>
        `;
        
        document.body.appendChild(paymentContainer);
        console.log('✓ Payment modal added to DOM');
        console.log('Modal element exists:', !!document.getElementById('cf-payment-container'));
        console.log('Proceed button exists:', !!document.getElementById('proceed-payment-btn'));
        
    } catch (error) {
        console.error('=== PAYMENT MODAL ERROR ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        showNotification('Error opening payment gateway. Please try again.', 'error');
    }
}

async function proceedToCashfreeCheckout(orderId, restaurantId, amount) {
    try {
        console.log('=== CASHFREE CHECKOUT START ===');
        console.log('Order ID:', orderId);
        console.log('Restaurant ID:', restaurantId);
        console.log('Amount:', amount);
        console.log('Session ID stored:', app.cashfreeSessionId);
        
        showNotification('Opening payment gateway...', 'info');
        
        // Check Cashfree SDK availability
        console.log('[Cashfree] SDK check:');
        console.log('[Cashfree] typeof Cashfree:', typeof Cashfree);
        console.log('[Cashfree] Cashfree exists:', !!Cashfree);
        
        if (typeof Cashfree === 'undefined') {
            console.error('❌ Cashfree SDK not loaded');
            showNotification('Payment gateway SDK not loaded. Please refresh the page.', 'error');
            return;
        }
        
        // Check session ID before proceeding
        if (!app.cashfreeSessionId) {
            console.error('❌ No session ID available');
            showNotification('Payment session not available. Please try again.', 'error');
            return;
        }

        console.log('✓ Session ID available:', app.cashfreeSessionId.substring(0, 20) + '...');
        
        // Disable the button to prevent multiple clicks
        const btn = document.getElementById('proceed-payment-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processing...';
        }
        
        let checkoutSuccess = false;
        const checkoutConfig = {
            paymentSessionId: app.cashfreeSessionId
        };
        
        // Method 1: Try static Cashfree.checkout() method
        try {
            console.log('[Cashfree] Attempting Method 1: Cashfree.checkout()');
            if (typeof Cashfree.checkout === 'function') {
                console.log('[Cashfree] Calling Cashfree.checkout()');
                await Cashfree.checkout(checkoutConfig);
                checkoutSuccess = true;
                console.log('✅ Method 1 successful: Cashfree.checkout()');
            }
        } catch (method1Error) {
            console.log('[Cashfree] Method 1 failed:', method1Error.message);
        }
        
        // Method 2: Try Cashfree.redirect() method
        if (!checkoutSuccess) {
            try {
                console.log('[Cashfree] Attempting Method 2: Cashfree.redirect()');
                if (typeof Cashfree.redirect === 'function') {
                    console.log('[Cashfree] Calling Cashfree.redirect()');
                    await Cashfree.redirect(checkoutConfig);
                    checkoutSuccess = true;
                    console.log('✅ Method 2 successful: Cashfree.redirect()');
                }
            } catch (method2Error) {
                console.log('[Cashfree] Method 2 failed:', method2Error.message);
            }
        }
        
        // Method 3: Try instance.checkout() method
        if (!checkoutSuccess) {
            try {
                console.log('[Cashfree] Attempting Method 3: new Cashfree().checkout()');
                const instance = new Cashfree();
                if (typeof instance.checkout === 'function') {
                    console.log('[Cashfree] Calling instance.checkout()');
                    await instance.checkout(checkoutConfig);
                    checkoutSuccess = true;
                    console.log('✅ Method 3 successful: instance.checkout()');
                } else {
                    console.log('[Cashfree] Instance does not have checkout method');
                }
            } catch (method3Error) {
                console.log('[Cashfree] Method 3 failed:', method3Error.message);
            }
        }
        
        // Method 4: Try opening checkout as window
        if (!checkoutSuccess) {
            try {
                console.log('[Cashfree] Attempting Method 4: Direct redirect to checkout URL');
                const instance = new Cashfree();
                if (typeof instance.getCheckoutURL === 'function') {
                    const url = await instance.getCheckoutURL(checkoutConfig);
                    if (url) {
                        window.location.href = url;
                        checkoutSuccess = true;
                        console.log('✅ Method 4 successful: Redirecting to checkout URL');
                    }
                }
            } catch (method4Error) {
                console.log('[Cashfree] Method 4 failed:', method4Error.message);
            }
        }
        
        // Log available methods if nothing worked
        if (!checkoutSuccess) {
            console.log('[Cashfree] All methods failed. Inspecting Cashfree SDK...');
            try {
                const staticMethods = Object.getOwnPropertyNames(Cashfree).filter(m => typeof Cashfree[m] === 'function');
                console.log('[Cashfree] Available static methods:', staticMethods);
                
                const instance = new Cashfree();
                const instanceMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).filter(m => typeof instance[m] === 'function');
                console.log('[Cashfree] Available instance methods:', instanceMethods);
            } catch (inspectError) {
                console.log('[Cashfree] Could not inspect SDK:', inspectError.message);
            }
        }
        
        if (checkoutSuccess) {
            console.log('✅ Cashfree checkout opened successfully');
            showNotification('Redirecting to payment...', 'success');
        } else {
            console.error('❌ All Cashfree checkout methods failed');
            showNotification('Payment gateway error. Please ensure your Cashfree API is properly configured and payment session was created successfully.', 'error');
            
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.textContent = '✓ Proceed to Payment';
            }
        }
        
    } catch (error) {
        console.error('=== CASHFREE CHECKOUT ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        showNotification('Payment error: ' + error.message, 'error');
        
        // Re-enable button
        const btn = document.getElementById('proceed-payment-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Proceed to Payment';
        }
    }
}

function showPaymentCompletionUI() {
    try {
        // Remove any existing completion UI
        const existingUI = document.getElementById('payment-completion-ui');
        if (existingUI) existingUI.remove();
        
        // Create completion UI
        const completionUI = document.createElement('div');
        completionUI.id = 'payment-completion-ui';
        completionUI.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;
        
        completionUI.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 40px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.4s ease-out;">
                <div style="font-size: 60px; margin-bottom: 20px; animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);">✅</div>
                <h2 style="color: #0F172A; margin: 0 0 10px 0; font-size: 24px;">Payment Successful!</h2>
                <p style="color: #64748B; margin: 0 0 20px 0;">Your restaurant is now set up.</p>
                <p style="color: #10B981; margin: 0; font-size: 14px; font-weight: 600;">Redirecting to your dashboard...</p>
            </div>
            <style>
                @keyframes slideUp {
                    from {
                        transform: translateY(30px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes scaleIn {
                    from {
                        transform: scale(0);
                    }
                    to {
                        transform: scale(1);
                    }
                }
            </style>
        `;
        
        document.body.appendChild(completionUI);
        console.log('Payment completion UI shown');
    } catch (error) {
        console.error('Error showing completion UI:', error);
    }
}

function handlePaymentReturn(orderId, restaurantId, status) {
    try {
        console.log('[Payment Return] Status:', status, 'Order ID:', orderId, 'Restaurant ID:', restaurantId);
        
        if (status === 'success') {
            // Remove payment container
            const container = document.getElementById('cf-payment-container');
            if (container) {
                console.log('[Payment Return] Removing payment modal');
                container.remove();
            }
            
            // Verify and complete payment
            console.log('[Payment Return] Starting payment verification');
            verifyPaymentAndComplete(orderId, restaurantId);
        } else {
            console.error('[Payment Return] Payment status is not success:', status);
            showNotification('Payment failed or was cancelled. Please try again.', 'error');
            cancelPayment(restaurantId);
        }
    } catch (error) {
        console.error('Error handling payment return:', error);
        console.error('Error stack:', error.stack);
        showNotification('Error processing payment completion.', 'error');
    }
}

async function cancelPayment(restaurantId) {
    try {
        // Remove payment UI
        const container = document.getElementById('cf-payment-container');
        if (container) container.remove();
        
        // Delete the pending restaurant
        await db.collection('restaurants').doc(restaurantId).delete();
        
        showNotification('Payment cancelled. Please try again later.', 'info');
    } catch (error) {
        console.error('Error cancelling payment:', error);
        showNotification('Error cancelling payment.', 'error');
    }
}

async function verifyPaymentAndComplete(orderId, restaurantId) {
    console.log('=== PAYMENT VERIFICATION START ===');
    console.log('Order ID:', orderId);
    console.log('Restaurant ID:', restaurantId);
    
    if (!firebaseInitialized || !db || !functions) {
        console.error('❌ Firebase not initialized');
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        console.log('Waiting for auth state before verification...');
        const currentUser = await waitForAuthState();
        
        if (!currentUser) {
            console.error('User not authenticated');
            showNotification('Authentication failed. Please sign in again.', 'error');
            navigateTo('signin');
            return;
        }
        
        console.log('Auth confirmed for user:', currentUser.uid);
        console.log('Calling verifyAndCompletePayment Cloud Function...');
        console.log('Parameters:', { restaurantId, orderId, amount: 999, userId: currentUser.uid });
        
        // Call backend to verify payment with Cashfree with timeout
        let result;
        try {
            result = await Promise.race([
                functions.httpsCallable('verifyAndCompletePayment')({
                    restaurantId: restaurantId,
                    orderId: orderId,
                    amount: 999,
                    userId: currentUser.uid
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Verification timeout')), 30000))
            ]);
        } catch (timeoutError) {
            console.error('Verification timeout or error:', timeoutError.message);
            // Still try to show success since Cashfree processed it
            showNotification('Processing your payment... This may take a moment.', 'info');
            
            // Try again after delay
            await new Promise(resolve => setTimeout(resolve, 3000));
            try {
                result = await functions.httpsCallable('verifyAndCompletePayment')({
                    restaurantId: restaurantId,
                    orderId: orderId,
                    amount: 999,
                    userId: currentUser.uid
                });
            } catch (retryError) {
                console.error('Retry failed:', retryError.message);
                throw retryError;
            }
        }

        console.log('✓ Verification result:', result.data);

        if (!result.data.success) {
            console.error('❌ Payment verification failed');
            showNotification('Payment verification failed. Please try again.', 'error');
            return;
        }

        console.log('✓ Payment verified successfully');
        console.log('Payment ID:', result.data.paymentId);

        // Show completion status
        showPaymentCompletionUI();
        
        // Remove payment UI after showing completion
        const container = document.getElementById('cf-payment-container');
        if (container) {
            console.log('Removing payment modal');
            setTimeout(() => {
                if (container && container.parentElement) {
                    container.remove();
                }
            }, 1000);
        }

        // Upload logo and banner if provided
        if (app.onboardingData.logoFile) {
            try {
                console.log('Uploading logo...');
                const logoUrl = await uploadImage(app.onboardingData.logoFile, `restaurants/${restaurantId}/logo`);
                app.onboardingData.logo = logoUrl;
                console.log('✓ Logo uploaded:', logoUrl);
            } catch (error) {
                console.warn('Could not upload logo:', error.message);
            }
        }
        
        if (app.onboardingData.bannerFile) {
            try {
                console.log('Uploading banner...');
                const bannerUrl = await uploadImage(app.onboardingData.bannerFile, `restaurants/${restaurantId}/banner`);
                app.onboardingData.banner = bannerUrl;
                console.log('✓ Banner uploaded:', bannerUrl);
            } catch (error) {
                console.warn('Could not upload banner:', error.message);
            }
        }
        
        // Update restaurant with payment details - status will be updated by Cloud Function
        console.log('Updating restaurant with onboarding data...');
        await db.collection('restaurants').doc(restaurantId).update({
            ...app.onboardingData,
            'subscription.activatedAt': new Date(),
            // Initialize default tables based on tableCount
            tables: Array.from({ length: app.onboardingData.tableCount || 10 }, (_, i) => ({
                number: i + 1,
                name: `Table ${i + 1}`,
                status: 'available',
                enabled: true
            }))
        });
        
        console.log('✓ Restaurant updated');
        
        app.currentRestaurant = app.onboardingData;
        app.currentRestaurantId = restaurantId;
        
        console.log('✓ Payment completed successfully!');
        showNotification('✅ Payment confirmed! Restaurant setup completed. Welcome to RestaurantOS!', 'success');
        
        // Clear session storage
        sessionStorage.removeItem('paymentOrderId');
        sessionStorage.removeItem('paymentRestaurantId');
        sessionStorage.removeItem('paymentAmount');
        
        console.log('Redirecting to landing page in 3 seconds...');
        // Navigate to landing page so they see full site with dashboard button
        setTimeout(() => {
            console.log('Performing redirect and reload');
            navigateTo('landing');
            // Use a small delay before reload to ensure UI updates
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }, 3000);
        
    } catch (error) {
        console.error('=== PAYMENT VERIFICATION ERROR ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        showNotification('Error verifying payment. Please contact support.', 'error');
    }
}

async function completePayment(restaurantId) {
    // This function is deprecated - use verifyPaymentAndComplete instead
    showNotification('Verifying payment...', 'info');
}

// ============================================
// DASHBOARD
// ============================================

function setupDashboard() {
    loadDashboardData();
    setupDashboardMenuItems();
    document.getElementById('page-title').textContent = 'Dashboard';
    showDashboardPage('overview');
    
    // Check subscription status
    if (app.currentRestaurantId) {
        checkAndDisplaySubscriptionStatus(app.currentRestaurantId);
    }
    
    // Removed 10-second polling - now using real-time listeners via setupDashboardListener
}

async function checkAndDisplaySubscriptionStatus(restaurantId) {
    if (!firebaseInitialized || !db) return;

    try {
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) return;

        const data = restaurantDoc.data();
        const subscription = data.subscription || {};
        
        if (subscription.status !== 'active') return;

        let expiryDate;
        if (subscription.expiryDate) {
            if (typeof subscription.expiryDate === 'string') {
                expiryDate = new Date(subscription.expiryDate);
            } else if (subscription.expiryDate.toDate) {
                expiryDate = subscription.expiryDate.toDate();
            } else if (subscription.expiryDate.seconds !== undefined) {
                expiryDate = new Date(subscription.expiryDate.seconds * 1000);
            }
        }

        if (!expiryDate) return;

        const now = new Date();
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

        let bannerHTML = '';
        let bannerColor = '';

        if (daysRemaining < 0) {
            // Subscription expired
            bannerColor = '#DC2626';
            bannerHTML = `
                <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="color: white; flex: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 1.1rem;">🚨 Subscription Expired</h3>
                        <p style="margin: 0; font-size: 0.9rem;">Your subscription expired on ${expiryDate.toLocaleDateString('en-IN')}. Renew now to continue using RestaurantOS.</p>
                    </div>
                    <button onclick="initiateRenewalPayment('${restaurantId}')" style="background: white; color: #DC2626; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap; margin-left: 15px;">Renew Now (₹199) →</button>
                </div>
            `;
        } else if (daysRemaining <= 7) {
            // Subscription expiring soon
            bannerColor = '#F59E0B';
            bannerHTML = `
                <div style="background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="color: #0F172A; flex: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 1.1rem;">⏰ Subscription Expiring Soon</h3>
                        <p style="margin: 0; font-size: 0.9rem;">Your subscription expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Renew before ${expiryDate.toLocaleDateString('en-IN')}.</p>
                    </div>
                    <button onclick="initiateRenewalPayment('${restaurantId}')" style="background: white; color: #0F172A; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap; margin-left: 15px;">Renew Now (₹199) →</button>
                </div>
            `;
        }

        if (bannerHTML) {
            const setupBanner = document.getElementById('table-setup-banner');
            if (setupBanner) {
                setupBanner.innerHTML = bannerHTML;
            }
        }
    } catch (error) {
        console.error('Error checking subscription status:', error);
    }
}

async function initiateRenewalPayment(restaurantId) {
    if (!firebaseInitialized || !auth || !functions) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        showNotification('Initiating renewal payment...', 'info');
        
        // Call backend function to create renewal order
        const result = await functions.httpsCallable('renewSubscription')({
            restaurantId: restaurantId
        });

        if (result.data.success) {
            // Store renewal order ID
            window.renewalOrderId = result.data.orderId;
            window.renewalRestaurantId = restaurantId;
            
            // Show payment gateway
            showRenewalPaymentGateway(result.data);
        } else {
            showNotification('Failed to initiate renewal. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Renewal payment error:', error);
        showNotification('Error initiating renewal payment: ' + error.message, 'error');
    }
}

function showRenewalPaymentGateway(paymentData) {
    // Display renewal payment modal
    showNotification('Processing renewal payment of ₹199...', 'info');
    
    // For production, integrate with Cashfree Payments SDK
    // This will redirect to payment gateway or show embedded payment form
}

async function loadDashboardData() {
    if (!firebaseInitialized || !db || !app.currentRestaurantId) return;

    try {
        const restaurantDoc = await db.collection('restaurants').doc(app.currentRestaurantId).get();
        if (restaurantDoc.exists) {
            app.currentRestaurant = restaurantDoc.data();
        }
        
        // Check if tables are configured
        if (!app.currentRestaurant?.tables || app.currentRestaurant.tables.length === 0) {
            const setupBanner = document.getElementById('table-setup-banner');
            if (setupBanner) {
                setupBanner.innerHTML = `
                    <div style="background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="color: #0F172A; flex: 1;">
                            <h3 style="margin: 0 0 8px 0; font-size: 1.1rem;">⚠️ Table Setup Required</h3>
                            <p style="margin: 0; font-size: 0.9rem;">Configure your restaurant tables so customers can select a table when placing orders.</p>
                        </div>
                        <button onclick="showDashboardPage('settings')" style="background: white; color: #0F172A; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap; margin-left: 15px;">Setup Tables →</button>
                    </div>
                `;
            }
        }
        
        const nameInput = document.getElementById('user-name');
        if (nameInput) {
            nameInput.textContent = app.currentRestaurant?.name || 'Restaurant';
        }
        
        // Set user avatar with restaurant logo
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar && app.currentRestaurant?.logo) {
            userAvatar.src = app.currentRestaurant.logo;
            userAvatar.style.display = 'block';
        } else if (userAvatar) {
            userAvatar.style.display = 'none';
        }
        
        const nameInput2 = document.getElementById('setting-name');
        const descInput = document.getElementById('setting-description');
        if (nameInput2) nameInput2.value = app.currentRestaurant?.name || '';
        if (descInput) descInput.value = app.currentRestaurant?.description || '';
        
        // Set up real-time listeners for metrics
        setupDashboardListener();
    } catch (error) {
        console.warn('Error loading dashboard:', error.message);
    }
}

function setupDashboardListener() {
    if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
    
    const today = new Date().toDateString();
    
    // Real-time listener for restaurant updates (logo, name, etc)
    db.collection('restaurants').doc(app.currentRestaurantId)
        .onSnapshot(
            (doc) => {
                if (doc.exists) {
                    const updatedRestaurant = doc.data();
                    app.currentRestaurant = { ...app.currentRestaurant, ...updatedRestaurant };
                    
                    // Update user avatar with new logo
                    const userAvatar = document.getElementById('user-avatar');
                    if (userAvatar && app.currentRestaurant?.logo) {
                        userAvatar.src = app.currentRestaurant.logo;
                        userAvatar.style.display = 'block';
                    }
                    
                    // Update user name if changed
                    const userNameEl = document.getElementById('user-name');
                    if (userNameEl) {
                        userNameEl.textContent = app.currentRestaurant?.name || 'Restaurant';
                    }
                }
            },
            (error) => {
                console.warn('Dashboard restaurant listener error:', error);
            }
        );
    
    // Real-time listener for today's metrics
    db.collection('orders')
        .where('restaurantId', '==', app.currentRestaurantId)
        .where('date', '==', today)
        .onSnapshot(
            (snapshot) => {
                let todayRevenue = 0;
                let pendingOrders = 0;
                let completedOrders = 0;
                
                snapshot.forEach(doc => {
                    const order = doc.data();
                    todayRevenue += order.total || 0;
                    if (order.status === 'pending') pendingOrders++;
                    if (order.status === 'completed') completedOrders++;
                });
                
                const revenueEl = document.getElementById('today-revenue');
                const ordersEl = document.getElementById('today-orders');
                const pendingEl = document.getElementById('pending-orders');
                const completedEl = document.getElementById('completed-orders');

                if (revenueEl) revenueEl.textContent = '₹' + todayRevenue;
                if (ordersEl) ordersEl.textContent = snapshot.size;
                if (pendingEl) pendingEl.textContent = pendingOrders;
                if (completedEl) completedEl.textContent = completedOrders;
            },
            (error) => {
                console.error('Dashboard metrics listener error:', error);
            }
        );
    
    // Real-time listener for recent orders
    db.collection('orders')
        .where('restaurantId', '==', app.currentRestaurantId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .onSnapshot(
            (snapshot) => {
                const list = document.getElementById('recent-orders-list');
                if (!list) return;

                list.innerHTML = '';
                
                if (snapshot.empty) {
                    list.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No orders yet</p>';
                    return;
                }
                
                snapshot.forEach(doc => {
                    const order = doc.data();
                    let statusColor = '#EF4444';
                    if (order.status === 'preparing') statusColor = '#3B82F6';
                    else if (order.status === 'ready') statusColor = '#F59E0B';
                    else if (order.status === 'completed') statusColor = '#10B981';
                    
                    const card = document.createElement('div');
                    card.className = 'order-card';
                    card.innerHTML = `
                        <div class="order-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <div class="order-number" style="font-weight: 600;">${order.orderId}</div>
                                <div style="font-size: 0.85rem; color: #999;">Customer: <strong>${order.customerName || 'Guest'}</strong></div>
                            </div>
                            <span class="order-status" style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize;">${order.status}</span>
                        </div>
                        <div class="order-details" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9rem;">
                            <div><span style="color: #999; font-size: 0.8rem;">Table</span><strong>🪑 ${order.tableNumber}</strong></div>
                            <div><span style="color: #999; font-size: 0.8rem;">Items</span><strong>${order.items?.length || 0}</strong></div>
                            <div><span style="color: #999; font-size: 0.8rem;">Total</span><strong style="color: #10B981;">₹${(order.total || 0).toFixed(2)}</strong></div>
                        </div>
                    `;
                    list.appendChild(card);
                });
            },
            (error) => {
                console.error('Recent orders listener error:', error);
            }
        );
}

function setupDashboardMenuItems() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function showDashboardPage(pageName) {
    if (app.currentTab !== pageName) {
        app.previousTab = app.currentTab;
    }
    app.currentTab = pageName;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageName).classList.add('active');
    
    const pageTitle = {
        'overview': '📊 Dashboard',
        'menu': '📋 Menu Management',
        'categories': '🏷️ Categories',
        'foods': '🍽️ Foods',
        'variants': '📏 Variants',
        'addons': '➕ Add-ons',
        'orders': '📦 Orders',
        'kitchen': '👨‍🍳 Kitchen Display',
        'analytics': '📈 Analytics',
        'reviews': '⭐ Reviews',
        'offers': '🎉 Offers',
        'coupons': '🎟️ Coupons',
        'profile': '🏪 Profile',
        'settings': '⚙️ Settings'
    };
    
    document.getElementById('page-title').textContent = pageTitle[pageName] || 'Dashboard';
    
    // Add back button visibility
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.style.display = ['categories', 'foods', 'variants', 'addons', 'menu'].includes(pageName) ? 'flex' : 'none';
    }
    
    // Clear refresh intervals if switching away
    if (app.kitchenRefreshInterval && pageName !== 'kitchen') {
        clearInterval(app.kitchenRefreshInterval);
        app.kitchenRefreshInterval = null;
    }
    if (app.dashboardRefreshInterval && pageName !== 'overview') {
        clearInterval(app.dashboardRefreshInterval);
        app.dashboardRefreshInterval = null;
    }
    if (app.ordersRefreshInterval && pageName !== 'orders') {
        clearInterval(app.ordersRefreshInterval);
        app.ordersRefreshInterval = null;
    }

    if (pageName === 'menu') {
        loadMenuData();
    } else if (pageName === 'categories') {
        loadCategories();
    } else if (pageName === 'foods') {
        loadFoods();
    } else if (pageName === 'variants') {
        loadVariants();
    } else if (pageName === 'addons') {
        loadAddons();
    } else if (pageName === 'orders') {
        setupOrdersListener('all');
    } else if (pageName === 'kitchen') {
        setupKitchenListener();
    } else if (pageName === 'overview') {
        setupDashboardListener();
    } else if (pageName === 'analytics') {
        loadAnalytics();
    } else if (pageName === 'reviews') {
        loadReviews();
    } else if (pageName === 'offers') {
        loadOffers();
    } else if (pageName === 'coupons') {
        loadCoupons();
    } else if (pageName === 'profile') {
        loadRestaurantProfile();
    } else if (pageName === 'settings') {
        // Load all settings after a delay to ensure DOM is ready
        setTimeout(() => {
            loadDashboardSettings();
        }, 150);
    }
}

function goBack() {
    const currentPage = app.currentTab;
    if (['categories', 'foods', 'variants', 'addons'].includes(currentPage)) {
        showDashboardPage('menu');
    } else {
        showDashboardPage('overview');
    }
}

// ============================================
// MENU MANAGEMENT
// ============================================

async function loadMenuData() {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    if (!app.currentRestaurantId) {
        console.warn('Restaurant ID not set');
        return;
    }

    try {
        // Load categories
        const categoriesSnapshot = await db.collection('categories')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        const categorySelect = document.getElementById('foodCategory');
        if (categorySelect) {
            categorySelect.innerHTML = '<option>Select Category</option>';
            
            categoriesSnapshot.forEach(doc => {
                const cat = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = cat.name;
                categorySelect.appendChild(option);
            });
        }

        // Load variants for food form
        const variantsSnapshot = await db.collection('variants')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();

        const variantsSelectDiv = document.getElementById('food-variants-select');
        if (variantsSelectDiv) {
            variantsSelectDiv.innerHTML = '';
            if (variantsSnapshot.empty) {
                variantsSelectDiv.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No variants added yet</p>';
            } else {
                variantsSnapshot.forEach(doc => {
                    const variant = doc.data();
                    const checkbox = document.createElement('div');
                    checkbox.style.padding = '8px 0';
                    checkbox.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" value="${doc.id}">
                            <span>${variant.name} (+₹${variant.priceAdjustment || 0})</span>
                        </label>
                    `;
                    variantsSelectDiv.appendChild(checkbox);
                });
            }
        }

        // Load addons for food form
        const addonsSnapshot = await db.collection('addons')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();

        const addonsSelectDiv = document.getElementById('food-addons-select');
        if (addonsSelectDiv) {
            addonsSelectDiv.innerHTML = '';
            if (addonsSnapshot.empty) {
                addonsSelectDiv.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No addons added yet</p>';
            } else {
                addonsSnapshot.forEach(doc => {
                    const addon = doc.data();
                    const checkbox = document.createElement('div');
                    checkbox.style.padding = '8px 0';
                    checkbox.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" value="${doc.id}">
                            <span>${addon.name} (+₹${addon.price})</span>
                        </label>
                    `;
                    addonsSelectDiv.appendChild(checkbox);
                });
            }
        }
        
        // Load foods
        const foodsSnapshot = await db.collection('foods')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        // Store foods in app state
        app.foods = [];
        foodsSnapshot.forEach(doc => {
            app.foods.push({ id: doc.id, ...doc.data() });
        });
        
        const foodsList = document.getElementById('foods-list');
        if (foodsList) {
            foodsList.innerHTML = '';
            
            if (foodsSnapshot.empty) {
                foodsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No food items added yet</p>';
            }
            
            foodsSnapshot.forEach(doc => {
                const food = doc.data();
                const card = document.createElement('div');
                card.className = 'food-card';
                card.innerHTML = `
                    <div class="food-image">
                        ${food.image ? `<img src="${food.image}" alt="${food.name}" style="width: 100%; height: 100%; object-fit: cover;">` : '🍜'}
                    </div>
                    <div class="food-info">
                        <div class="food-name">${food.name}</div>
                        <div class="food-category">${food.category}</div>
                        <div class="food-price">₹${food.price}${food.discountPrice ? ` <span style="text-decoration: line-through;">₹${food.discountPrice}</span>` : ''}</div>
                    </div>
                    <div class="food-actions">
                        <button class="btn btn-sm" onclick="editFood('${doc.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFood('${doc.id}')">Delete</button>
                    </div>
                `;
                foodsList.appendChild(card);
            });
        }
        
        // Store categories in app state
        app.categories = [];
        categoriesSnapshot.forEach(doc => {
            app.categories.push({ id: doc.id, ...doc.data() });
        });
        
        // Load categories list
        const catList = document.getElementById('categories-list');
        if (catList) {
            catList.innerHTML = '';
            
            if (categoriesSnapshot.empty) {
                catList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No categories added yet</p>';
            }
            
            categoriesSnapshot.forEach(doc => {
                const cat = doc.data();
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `
                    <div class="category-info">
                        <h4>${cat.name}</h4>
                        <p>${cat.description || 'No description'}</p>
                    </div>
                    <div class="category-actions">
                        <button class="btn btn-sm" onclick="editCategory('${doc.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCategory('${doc.id}')">Delete</button>
                    </div>
                `;
                catList.appendChild(card);
            });
        }

        // Store variants in app state
        app.variants = [];
        variantsSnapshot.forEach(doc => {
            app.variants.push({ id: doc.id, ...doc.data() });
        });

        // Load variants list
        const variantsList = document.getElementById('variants-list');
        if (variantsList) {
            variantsList.innerHTML = '';
            
            if (variantsSnapshot.empty) {
                variantsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No variants added yet</p>';
            }
            
            variantsSnapshot.forEach(doc => {
                const variant = doc.data();
                const card = document.createElement('div');
                card.className = 'variant-card';
                card.innerHTML = `
                    <div class="variant-info">
                        <h4>${variant.name}</h4>
                        <p>Price Adjustment: +₹${variant.priceAdjustment || 0}</p>
                        <p style="font-size: 0.9rem; color: #999;">${variant.description || 'No description'}</p>
                    </div>
                    <div class="variant-actions">
                        <button class="btn btn-sm" onclick="editVariant('${doc.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteVariant('${doc.id}')">Delete</button>
                    </div>
                `;
                variantsList.appendChild(card);
            });
        }

        // Store addons in app state
        app.addons = [];
        addonsSnapshot.forEach(doc => {
            app.addons.push({ id: doc.id, ...doc.data() });
        });

        // Load addons list
        const addonsList = document.getElementById('addons-list');
        if (addonsList) {
            addonsList.innerHTML = '';
            
            if (addonsSnapshot.empty) {
                addonsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No addons added yet</p>';
            }
            
            addonsSnapshot.forEach(doc => {
                const addon = doc.data();
                const card = document.createElement('div');
                card.className = 'addon-card';
                card.innerHTML = `
                    <div class="addon-info">
                        <h4>${addon.name}</h4>
                        <p>Price: ₹${addon.price}</p>
                        <p style="font-size: 0.9rem; color: #999;">${addon.description || 'No description'}</p>
                    </div>
                    <div class="addon-actions">
                        <button class="btn btn-sm" onclick="editAddon('${doc.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteAddon('${doc.id}')">Delete</button>
                    </div>
                `;
                addonsList.appendChild(card);
            });
        }
        
        // Update tab visibility based on items
        updateMenuTabsVisibility();
    } catch (error) {
        console.error('Error loading menu:', error);
        showNotification('Failed to load menu', 'error');
    }
}

function updateMenuTabsVisibility() {
    const categoriesTab = document.querySelector('.menu-tabs [onclick*="categories"]');
    const variantsTab = document.querySelector('.menu-tabs [onclick*="variants"]');
    const addonsTab = document.querySelector('.menu-tabs [onclick*="addons"]');
    
    // Show/hide based on whether items exist
    if (categoriesTab) {
        categoriesTab.style.display = app.categories.length > 0 ? 'block' : 'none';
    }
    if (variantsTab) {
        variantsTab.style.display = app.variants.length > 0 ? 'block' : 'none';
    }
    if (addonsTab) {
        addonsTab.style.display = app.addons.length > 0 ? 'block' : 'none';
    }
}

function switchMenuTab(tab) {
    app.currentMenuTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('tab-' + tab).classList.add('active');
    
    if (tab === 'foods') {
        loadMenuData();
    }
    
    // Update tab visibility
    updateMenuTabsVisibility();
}

function openFoodModal() {
    const modal = document.getElementById('food-modal').content.cloneNode(true);
    document.getElementById('app').appendChild(modal);
    
    // Reset form
    document.getElementById('foodName').value = '';
    document.getElementById('foodCategory').value = '';
    document.getElementById('foodPrice').value = '';
    document.getElementById('foodType').value = 'Veg';
    document.getElementById('foodDescription').value = '';
    document.getElementById('foodPrepTime').value = '15';
    document.getElementById('foodBestSeller').checked = false;
    document.getElementById('foodPopular').checked = false;
    document.getElementById('modal-title').textContent = 'Add Food Item';
    
    // Load categories, variants and addons after modal is added to DOM
    setTimeout(async () => {
        try {
            // Load categories
            const categoriesSnapshot = await db.collection('categories')
                .where('restaurantId', '==', app.currentRestaurantId)
                .orderBy('position', 'asc')
                .get();

            const categorySelect = document.getElementById('foodCategory');
            if (categorySelect) {
                categorySelect.innerHTML = '<option value="">Select Category</option>';
                if (!categoriesSnapshot.empty) {
                    categoriesSnapshot.forEach(doc => {
                        const cat = doc.data();
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.textContent = cat.name;
                        categorySelect.appendChild(option);
                    });
                } else {
                    categorySelect.innerHTML = '<option value="">No categories available. Please add one first.</option>';
                }
            }

            // Load variants with professional styling
            const variantsSnapshot = await db.collection('variants')
                .where('restaurantId', '==', app.currentRestaurantId)
                .get();

            const variantsSelectDiv = document.getElementById('food-variants-select');
            if (variantsSelectDiv) {
                variantsSelectDiv.innerHTML = '';
                if (variantsSnapshot.empty) {
                    variantsSelectDiv.innerHTML = '<div style="padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center; color: #0f172a;"><p style="margin: 0; font-weight: 500;">No variants added yet</p><p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #64748b;">Create variants in the 📏 Variants section</p></div>';
                } else {
                    const variantsContainer = document.createElement('div');
                    variantsContainer.style.cssText = 'display: grid; gap: 12px;';
                    variantsSnapshot.forEach(doc => {
                        const variant = doc.data();
                        const checkboxContainer = document.createElement('div');
                        checkboxContainer.style.cssText = 'padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; transition: all 0.2s;';
                        checkboxContainer.innerHTML = `
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                                <input type="checkbox" value="${doc.id}" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-weight: 500; color: #0f172a;">${variant.name}</span>
                                <span style="margin-left: auto; color: #22c55e; font-weight: 600;">+₹${variant.priceAdjustment || 0}</span>
                            </label>
                        `;
                        checkboxContainer.addEventListener('change', (e) => {
                            checkboxContainer.style.background = e.target.checked ? '#e0f2fe' : '#f8fafc';
                            checkboxContainer.style.borderColor = e.target.checked ? '#0284c7' : '#e2e8f0';
                        });
                        variantsContainer.appendChild(checkboxContainer);
                    });
                    variantsSelectDiv.appendChild(variantsContainer);
                }
            }

            // Load addons with professional styling
            const addonsSnapshot = await db.collection('addons')
                .where('restaurantId', '==', app.currentRestaurantId)
                .get();

            const addonsSelectDiv = document.getElementById('food-addons-select');
            if (addonsSelectDiv) {
                addonsSelectDiv.innerHTML = '';
                if (addonsSnapshot.empty) {
                    addonsSelectDiv.innerHTML = '<div style="padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center; color: #0f172a;"><p style="margin: 0; font-weight: 500;">No add-ons added yet</p><p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #64748b;">Create add-ons in the ➕ Add-ons section</p></div>';
                } else {
                    const addonsContainer = document.createElement('div');
                    addonsContainer.style.cssText = 'display: grid; gap: 12px;';
                    addonsSnapshot.forEach(doc => {
                        const addon = doc.data();
                        const checkboxContainer = document.createElement('div');
                        checkboxContainer.style.cssText = 'padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; transition: all 0.2s;';
                        checkboxContainer.innerHTML = `
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                                <input type="checkbox" value="${doc.id}" style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-weight: 500; color: #0f172a;">${addon.name}</span>
                                <span style="margin-left: auto; color: #f97316; font-weight: 600;">+₹${addon.price}</span>
                            </label>
                        `;
                        checkboxContainer.addEventListener('change', (e) => {
                            checkboxContainer.style.background = e.target.checked ? '#fef3c7' : '#f8fafc';
                            checkboxContainer.style.borderColor = e.target.checked ? '#f59e0b' : '#e2e8f0';
                        });
                        addonsContainer.appendChild(checkboxContainer);
                    });
                    addonsSelectDiv.appendChild(addonsContainer);
                }
            }
        } catch (error) {
            console.error('Error loading categories, variants and addons:', error);
        }
    }, 100);
}

function openCategoryModal() {
    const modal = document.getElementById('category-modal').content.cloneNode(true);
    document.getElementById('app').appendChild(modal);
    document.getElementById('category-modal-title').textContent = 'Add Category';
    document.getElementById('category-save-btn').textContent = 'Add Category';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryDescription').value = '';
}

function openVariantModal() {
    const modal = document.getElementById('variant-modal').content.cloneNode(true);
    document.getElementById('app').appendChild(modal);
    document.getElementById('variant-modal-title').textContent = 'Add Variant';
    document.getElementById('variant-save-btn').textContent = 'Add Variant';
    document.getElementById('variantName').value = '';
    document.getElementById('variantPriceAdjust').value = '';
    document.getElementById('variantDescription').value = '';
}

function openAddonModal() {
    const modal = document.getElementById('addon-modal').content.cloneNode(true);
    document.getElementById('app').appendChild(modal);
    document.getElementById('addon-modal-title').textContent = 'Add Addon';
    document.getElementById('addon-save-btn').textContent = 'Add Addon';
    document.getElementById('addonName').value = '';
    document.getElementById('addonPrice').value = '';
    document.getElementById('addonDescription').value = '';
}

async function saveFood() {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        const name = document.getElementById('foodName')?.value;
        const categoryId = document.getElementById('foodCategory')?.value;
        const price = document.getElementById('foodPrice')?.value;
        const type = document.getElementById('foodType')?.value;

        if (!name || !categoryId || !price || !type) {
            showNotification('Please fill all required fields', 'error');
            return;
        }

        // Get category name from ID
        const categoryDoc = await db.collection('categories').doc(categoryId).get();
        const categoryName = categoryDoc.exists ? categoryDoc.data().name : categoryId;

        // Get selected variants and addons
        const selectedVariants = [];
        const selectedAddons = [];
        
        const variantCheckboxes = document.querySelectorAll('#food-variants-select input[type="checkbox"]:checked');
        variantCheckboxes.forEach(checkbox => {
            selectedVariants.push(checkbox.value);
        });
        
        const addonCheckboxes = document.querySelectorAll('#food-addons-select input[type="checkbox"]:checked');
        addonCheckboxes.forEach(checkbox => {
            selectedAddons.push(checkbox.value);
        });

        const foodData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            categoryId: categoryId,
            category: categoryName,
            price: parseFloat(price),
            discountPrice: document.getElementById('foodDiscountPrice')?.value ? parseFloat(document.getElementById('foodDiscountPrice').value) : null,
            preparationTime: parseInt(document.getElementById('foodPrepTime')?.value || 15),
            type: type,
            shortDescription: document.getElementById('foodDescription')?.value || '',
            bestSeller: document.getElementById('foodBestSeller')?.checked || false,
            popular: document.getElementById('foodPopular')?.checked || false,
            variants: selectedVariants,
            addons: selectedAddons,
            available: true,
            images: [],
            createdAt: new Date()
        };
        
        // Upload image if provided
        const imageInput = document.getElementById('foodImage');
        if (imageInput?.files && imageInput.files[0]) {
            const imageUrl = await uploadImage(imageInput.files[0], `restaurants/${app.currentRestaurantId}/foods`);
            foodData.images = [imageUrl];
            foodData.image = imageUrl;
        }
        
        // Show success screen
        showSuccessScreen('🍽️ Adding Food Item...');
        
        await db.collection('foods').add(foodData);
        
        // Close modal
        closeModal();
        
        // Update success message
        updateSuccessScreen('✅ Food Item Added Successfully!', name);
        
        // Wait for visibility
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide success screen
        hideSuccessScreen();
        
        // Load foods
        await loadFoods();
    } catch (error) {
        console.error('Error saving food:', error);
        hideSuccessScreen();
        showNotification('Failed to save food item', 'error');
    }
}

async function saveCategory() {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        const name = document.getElementById('categoryName')?.value;
        if (!name) {
            showNotification('Please enter a category name', 'error');
            return;
        }

        // Show success screen
        showSuccessScreen('🏷️ Adding Category...');

        const categoryData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            description: document.getElementById('categoryDescription')?.value || '',
            position: app.categories.length,
            createdAt: new Date()
        };
        
        await db.collection('categories').add(categoryData);
        
        // Close modal
        closeModal();
        
        // Update success message
        updateSuccessScreen('✅ Category Added Successfully!', name);
        
        // Wait for visibility
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide success screen
        hideSuccessScreen();
        
        // Load categories
        await loadCategories();
    } catch (error) {
        console.error('Error saving category:', error);
        hideSuccessScreen();
        showNotification('Failed to save category', 'error');
    }
}

async function saveVariant() {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        const name = document.getElementById('variantName')?.value;
        if (!name) {
            showNotification('Please enter a variant name', 'error');
            return;
        }

        // Show success screen
        showSuccessScreen('📐 Adding Variant...');

        const variantData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            priceAdjustment: parseFloat(document.getElementById('variantPriceAdjust')?.value || 0),
            description: document.getElementById('variantDescription')?.value || '',
            createdAt: new Date()
        };
        
        await db.collection('variants').add(variantData);
        
        // Close modal
        closeModal();
        
        // Update success message
        updateSuccessScreen('✅ Variant Added Successfully!', name);
        
        // Wait for visibility
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide success screen
        hideSuccessScreen();
        
        // Load variants
        await loadVariants();
    } catch (error) {
        console.error('Error saving variant:', error);
        hideSuccessScreen();
        showNotification('Failed to save variant', 'error');
    }
}

async function saveAddon() {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        const name = document.getElementById('addonName')?.value;
        const price = document.getElementById('addonPrice')?.value;
        
        if (!name || !price) {
            showNotification('Please fill all required fields', 'error');
            return;
        }

        // Show success screen
        showSuccessScreen('➕ Adding Add-on...');

        const addonData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            price: parseFloat(price),
            description: document.getElementById('addonDescription')?.value || '',
            createdAt: new Date()
        };
        
        await db.collection('addons').add(addonData);
        
        // Close modal
        closeModal();
        
        // Update success message
        updateSuccessScreen('✅ Add-on Added Successfully!', name);
        
        // Wait for visibility
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide success screen
        hideSuccessScreen();
        
        // Load addons
        await loadAddons();
    } catch (error) {
        console.error('Error saving addon:', error);
        hideSuccessScreen();
        showNotification('Failed to save addon', 'error');
    }
}



async function deleteFood(foodId) {
    if (confirm('Are you sure you want to delete this food item?')) {
        try {
            await db.collection('foods').doc(foodId).delete();
            showNotification('Food item deleted successfully!', 'success');
            loadMenuData();
        } catch (error) {
            console.error('Error deleting food:', error);
            showNotification('Failed to delete food item', 'error');
        }
    }
}

async function editVariant(variantId) {
    try {
        const variantDoc = await db.collection('variants').doc(variantId).get();
        const variant = variantDoc.data();
        
        openVariantModal();
        
        setTimeout(() => {
            const nameEl = document.getElementById('variantName');
            if (nameEl) {
                document.getElementById('variantName').value = variant.name || '';
                document.getElementById('variantPriceAdjust').value = variant.priceAdjustment || '';
                document.getElementById('variantDescription').value = variant.description || '';
                
                document.getElementById('variant-modal-title').textContent = 'Edit Variant';
                document.getElementById('variant-save-btn').textContent = 'Update Variant';
                
                const saveBtn = document.getElementById('variant-save-btn');
                if (saveBtn) {
                    saveBtn.onclick = async function() {
                        try {
                            await db.collection('variants').doc(variantId).update({
                                name: document.getElementById('variantName').value,
                                priceAdjustment: parseFloat(document.getElementById('variantPriceAdjust').value || 0),
                                description: document.getElementById('variantDescription').value,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            showNotification('Variant updated successfully!', 'success');
                            closeModal();
                            loadVariants();
                            loadMenuData();
                        } catch (error) {
                            console.error('Error updating variant:', error);
                            showNotification('Error updating variant', 'error');
                        }
                    };
                }
            }
        }, 100);
    } catch (error) {
        console.error('Error loading variant:', error);
        showNotification('Error loading variant', 'error');
    }
}

async function deleteVariant(variantId) {
    if (confirm('Are you sure you want to delete this variant?')) {
        try {
            await db.collection('variants').doc(variantId).delete();
            showNotification('Variant deleted successfully!', 'success');
            loadVariants();
            loadMenuData();
        } catch (error) {
            console.error('Error deleting variant:', error);
            showNotification('Failed to delete variant', 'error');
        }
    }
}

async function editAddon(addonId) {
    try {
        const addonDoc = await db.collection('addons').doc(addonId).get();
        const addon = addonDoc.data();
        
        openAddonModal();
        
        setTimeout(() => {
            const nameEl = document.getElementById('addonName');
            if (nameEl) {
                document.getElementById('addonName').value = addon.name || '';
                document.getElementById('addonPrice').value = addon.price || '';
                document.getElementById('addonDescription').value = addon.description || '';
                
                document.getElementById('addon-modal-title').textContent = 'Edit Addon';
                document.getElementById('addon-save-btn').textContent = 'Update Addon';
                
                const saveBtn = document.getElementById('addon-save-btn');
                if (saveBtn) {
                    saveBtn.onclick = async function() {
                        try {
                            await db.collection('addons').doc(addonId).update({
                                name: document.getElementById('addonName').value,
                                price: parseFloat(document.getElementById('addonPrice').value),
                                description: document.getElementById('addonDescription').value,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            showNotification('Addon updated successfully!', 'success');
                            closeModal();
                            loadAddons();
                            loadMenuData();
                        } catch (error) {
                            console.error('Error updating addon:', error);
                            showNotification('Error updating addon', 'error');
                        }
                    };
                }
            }
        }, 100);
    } catch (error) {
        console.error('Error loading addon:', error);
        showNotification('Error loading addon', 'error');
    }
}

async function deleteAddon(addonId) {
    if (confirm('Are you sure you want to delete this addon?')) {
        try {
            await db.collection('addons').doc(addonId).delete();
            showNotification('Addon deleted successfully!', 'success');
            loadAddons();
            loadMenuData();
        } catch (error) {
            console.error('Error deleting addon:', error);
            showNotification('Failed to delete addon', 'error');
        }
    }
}

async function deleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category?')) {
        try {
            await db.collection('categories').doc(categoryId).delete();
            showNotification('Category deleted successfully!', 'success');
            loadCategories();
            loadMenuData();
        } catch (error) {
            console.error('Error deleting category:', error);
            showNotification('Failed to delete category', 'error');
        }
    }
}

// ============================================
// ORDERS MANAGEMENT
// ============================================

async function loadOrders(filter) {
    // Deprecated: Use setupOrdersListener instead for real-time updates
    setupOrdersListener(filter);
}

function filterOrders(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    setupOrdersListener(status);
}

function setupOrdersListener(filter) {
    if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
    
    // Unsubscribe from previous listener
    if (app.ordersListener) {
        app.ordersListener();
    }
    
    let query = db.collection('orders').where('restaurantId', '==', app.currentRestaurantId);
    
    if (filter !== 'all') {
        query = query.where('status', '==', filter);
    }
    
    // Set up real-time listener instead of polling
    app.ordersListener = query.orderBy('createdAt', 'desc').onSnapshot(
        (snapshot) => {
            const list = document.getElementById('orders-list');
            if (!list) return;
            
            list.innerHTML = '';
            
            if (snapshot.empty) {
                list.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No orders found</p>';
                return;
            }
            
            snapshot.forEach(doc => {
                const order = doc.data();
                const card = document.createElement('div');
                card.className = 'order-card';
                
                let itemsList = '';
                let totalItems = 0;
                order.items?.forEach(item => {
                    totalItems += item.quantity || 1;
                    itemsList += `<li><span>${item.quantity}x ${item.name}</span> <span style="color: #999;">₹${(item.price * item.quantity).toFixed(2)}</span></li>`;
                });
                
                const createdAtTime = order.createdAt?.seconds 
                    ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString()
                    : 'N/A';

                const createdAtDate = order.createdAt?.seconds 
                    ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                    : 'N/A';
                
                let statusBadgeColor = '#EF4444';
                if (order.status === 'preparing') statusBadgeColor = '#3B82F6';
                else if (order.status === 'ready') statusBadgeColor = '#F59E0B';
                else if (order.status === 'completed') statusBadgeColor = '#10B981';
                
                card.innerHTML = `
                    <div class="order-header" style="display: flex; justify-content: space-between; align-items: center; padding: 0 0 12px 0; border-bottom: 1px solid #E2E8F0;">
                        <div>
                            <div class="order-number" style="font-size: 1rem; font-weight: 600;">${order.orderId}</div>
                            <div style="font-size: 0.85rem; color: #999;">Customer: <strong>${order.customerName || 'Guest'}</strong></div>
                        </div>
                        <span class="order-status" style="background: ${statusBadgeColor}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; text-transform: capitalize;">${order.status}</span>
                    </div>
                    <div class="order-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; padding: 12px 0;">
                        <div class="order-detail">
                            <span style="font-size: 0.75rem; color: #999; text-transform: uppercase;">Table</span>
                            <strong style="font-size: 1.3rem;">🪑 ${order.tableNumber}</strong>
                        </div>
                        <div class="order-detail">
                            <span style="font-size: 0.75rem; color: #999; text-transform: uppercase;">Date & Time</span>
                            <strong style="font-size: 0.9rem;">${createdAtDate} ${createdAtTime}</strong>
                        </div>
                        <div class="order-detail">
                            <span style="font-size: 0.75rem; color: #999; text-transform: uppercase;">Items</span>
                            <strong style="font-size: 1.1rem;">${totalItems} item${totalItems !== 1 ? 's' : ''}</strong>
                        </div>
                        <div class="order-detail">
                            <span style="font-size: 0.75rem; color: #999; text-transform: uppercase;">Total</span>
                            <strong style="font-size: 1.2rem; color: #10B981;">₹${order.total?.toFixed(2) || 0}</strong>
                        </div>
                    </div>
                    <div class="order-items" style="padding: 12px 0; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0;">
                        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;">
                            ${itemsList}
                        </ul>
                    </div>
                    ${order.paymentStatus ? `<div style="padding: 8px 0; font-size: 0.85rem;"><span style="color: #999;">Payment:</span> <strong style="color: ${order.paymentStatus === 'paid' ? '#10B981' : '#EF4444'}">${order.paymentStatus}</strong></div>` : ''}
                    <div class="order-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; padding: 12px 0; border-top: 1px solid #E2E8F0;">
                        <button class="btn btn-sm" onclick="showOrderDetailsModal('${doc.id}')" style="background: #6366F1;">View</button>
                        ${order.status === 'pending' ? `<button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}', 'preparing')" style="background: #3B82F6;">Start</button>` : ''}
                        ${order.status === 'preparing' ? `<button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}', 'ready')" style="background: #F59E0B;">Ready</button>` : ''}
                        ${order.status !== 'completed' && order.status !== 'cancelled' ? `<button class="btn btn-sm btn-success" onclick="updateOrderStatus('${doc.id}', 'completed')">Done</button>` : ''}
                        ${order.status !== 'cancelled' && order.status !== 'completed' ? `<button class="btn btn-sm btn-danger" onclick="cancelOrder('${doc.id}')">Cancel</button>` : ''}
                        <button class="btn btn-sm" onclick="printOrderReceipt('${doc.id}')" style="background: #8B5CF6;">Print</button>
                    </div>
                `;
                list.appendChild(card);
            });
        },
        (error) => {
            console.error('Error setting up orders listener:', error);
            showNotification('Failed to load orders', 'error');
        }
    );
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Order status updated!', 'success');
        loadOrders('all');
        // Also refresh kitchen display if it's visible
        const kitchenDisplay = document.getElementById('kitchen-display');
        if (kitchenDisplay) {
            loadKitchenDisplay();
        }
    } catch (error) {
        console.error('Error updating order:', error);
        showNotification('Failed to update order', 'error');
    }
}

async function cancelOrder(orderId) {
    if (confirm('Are you sure you want to cancel this order?')) {
        try {
            await db.collection('orders').doc(orderId).update({
                status: 'cancelled',
                cancelledAt: new Date()
            });
            showNotification('Order cancelled!', 'success');
            loadOrders('all');
        } catch (error) {
            console.error('Error cancelling order:', error);
            showNotification('Failed to cancel order', 'error');
        }
    }
}

async function cancelOrderFromKitchen(orderId) {
    if (confirm('Are you sure you want to cancel this order?')) {
        try {
            await db.collection('orders').doc(orderId).update({
                status: 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showNotification('Order cancelled', 'success');
        } catch (error) {
            console.error('Error cancelling order:', error);
            showNotification('Failed to cancel order', 'error');
        }
    }
}

function setupKitchenListener() {
    if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
    
    // Unsubscribe from previous listener
    if (app.kitchenListener) {
        app.kitchenListener();
    }
    
    // Set up real-time listener for kitchen display
    app.kitchenListener = db.collection('orders')
        .where('restaurantId', '==', app.currentRestaurantId)
        .where('status', 'in', ['pending', 'accepted', 'preparing', 'ready'])
        .orderBy('createdAt', 'desc')
        .onSnapshot(
            (snapshot) => {
                const display = document.getElementById('kitchen-display');
                if (!display) return;
                
                display.innerHTML = '';
                
                if (snapshot.empty) {
                    display.innerHTML = '<div style="text-align: center; padding: 60px; color: #999;"><div style="font-size: 2rem; margin-bottom: 10px;">✓</div><p style="font-size: 1.2rem; font-weight: 600;">All orders completed</p><p>No active orders to prepare</p></div>';
                    return;
                }

                const orders = {
                    pending: [],
                    accepted: [],
                    preparing: [],
                    ready: []
                };
                
                snapshot.forEach(doc => {
                    const order = doc.data();
                    order.docId = doc.id;
                    orders[order.status] = orders[order.status] || [];
                    orders[order.status].push(order);
                });

                const statusConfigs = {
                    pending: { label: 'Pending', color: '#EF4444', bgColor: '#FEE2E2', icon: '🔴' },
                    accepted: { label: 'Accepted', color: '#F59E0B', bgColor: '#FEF3C7', icon: '🟡' },
                    preparing: { label: 'Preparing', color: '#3B82F6', bgColor: '#DBEAFE', icon: '🔵' },
                    ready: { label: 'Ready', color: '#10B981', bgColor: '#D1FAE5', icon: '🟢' }
                };

                let allOrders = [];
                ['pending', 'accepted', 'preparing', 'ready'].forEach(status => {
                    if (orders[status]) {
                        allOrders = allOrders.concat(orders[status].map(o => ({...o, status})));
                    }
                });

                let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; padding: 16px; width: 100%;">';
                
                allOrders.forEach(order => {
                    const status = statusConfigs[order.status];
                    const createdTime = order.createdAt ? (() => {
                        const timestamp = order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt;
                        const date = new Date(timestamp);
                        const now = new Date();
                        const diffMs = now - date;
                        const diffMins = Math.floor(diffMs / 60000);
                        return diffMins > 0 ? `${diffMins} mins ago` : 'just now';
                    })() : 'unknown';
                    
                    let itemsList = '';
                    order.items?.forEach(item => {
                        const variants = item.selectedVariants ? Object.values(item.selectedVariants).join(', ') : '';
                        const addons = item.selectedAddons ? Object.values(item.selectedAddons).join(', ') : '';
                        
                        itemsList += `
                            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;">
                                <div style="font-weight: 600; color: #0F172A; font-size: 0.95rem;"><strong>${item.quantity}x ${item.name}</strong></div>
                                ${variants ? `<div style="font-size: 0.8rem; color: #666;">📌 ${variants}</div>` : ''}
                                ${addons ? `<div style="font-size: 0.8rem; color: #666;">✕ ${addons}</div>` : ''}
                                ${item.specialInstructions ? `<div style="font-size: 0.8rem; color: #EF4444; font-weight: 500;">📝 ${item.specialInstructions}</div>` : ''}
                            </div>
                        `;
                    });
                    
                    const estimatedTime = order.estimatedPrepTime || 30;
                    
                    html += `
                        <div style="background: white; border-radius: 12px; padding: 14px; border: 1px solid #E5E7EB; display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: ${status.bgColor}; border-radius: 20px; border-left: 3px solid ${status.color};">
                                    <span style="font-size: 1.2rem;">${status.icon}</span>
                                    <span style="font-size: 0.8rem; font-weight: 600; color: ${status.color};">${status.label}</span>
                                </div>
                                <div style="text-align: right; font-size: 0.75rem; color: #666;">
                                    <div>${createdTime}</div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                <div style="flex: 1;">
                                    <div style="font-size: 1.3rem; font-weight: 700; color: #0F172A;">Table ${order.tableNumber}</div>
                                    <div style="font-size: 0.75rem; color: #999; margin-top: 2px;">${order.orderId}</div>
                                </div>
                                <div style="text-align: right; padding: 4px 8px; background: #F3F4F6; border-radius: 6px;">
                                    <div style="font-size: 0.9rem; font-weight: 600; color: ${status.color};">${estimatedTime}m</div>
                                </div>
                            </div>
                            
                            <div style="padding-top: 8px; border-top: 1px solid #E5E7EB;">
                                <div style="font-size: 0.8rem; color: #666; margin-bottom: 8px; font-weight: 500;">👤 ${order.customerName || 'Guest'}</div>
                                <div style="font-size: 0.9rem; color: #333;">
                                    ${itemsList}
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 8px; border-top: 1px solid #E5E7EB;">
                                ${order.status === 'pending' ? `<button class="btn btn-primary" style="padding: 8px 12px; font-size: 0.75rem; width: 100%;" onclick="updateOrderStatus('${order.docId}', 'accepted')">✓ Accept</button>` : ''}
                                ${order.status === 'accepted' ? `<button class="btn btn-primary" style="padding: 8px 12px; font-size: 0.75rem; width: 100%;" onclick="updateOrderStatus('${order.docId}', 'preparing')">🔄 Prep</button>` : ''}
                                ${order.status === 'preparing' ? `<button class="btn btn-success" style="padding: 8px 12px; font-size: 0.75rem; width: 100%;" onclick="updateOrderStatus('${order.docId}', 'ready')">✓ Ready</button>` : ''}
                                ${order.status === 'ready' ? `<button class="btn btn-success" style="padding: 8px 12px; font-size: 0.75rem; width: 100%;" onclick="updateOrderStatus('${order.docId}', 'completed')">✓ Done</button>` : ''}
                                <button class="btn btn-danger" style="padding: 8px 12px; font-size: 0.75rem; width: 100%;" onclick="cancelOrderFromKitchen('${order.docId}')">✕ Cancel</button>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
                display.innerHTML = html;
            },
            (error) => {
                console.error('Error setting up kitchen listener:', error);
            }
        );
}

async function loadKitchenDisplay() {
    // Deprecated: Use setupKitchenListener instead for real-time updates
    setupKitchenListener();
}

function showOrderDetailsModal(orderId) {
    // Get order data from the page
    const orderCards = document.querySelectorAll('.order-card');
    let orderData = null;
    
    // Query Firebase directly for detailed order data
    db.collection('orders').doc(orderId).get().then(doc => {
        if (!doc.exists) return;
        
        const order = doc.data();
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            overflow-y: auto;
            padding: 20px;
        `;
        
        let itemsHTML = '';
        order.items?.forEach(item => {
            itemsHTML += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: left;">${item.quantity}x</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: left;">${item.name}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
            `;
        });
        
        let statusBadgeColor = '#EF4444';
        if (order.status === 'preparing') statusBadgeColor = '#3B82F6';
        else if (order.status === 'ready') statusBadgeColor = '#F59E0B';
        else if (order.status === 'completed') statusBadgeColor = '#10B981';
        
        const createdAtTime = order.createdAt?.seconds 
            ? new Date(order.createdAt.seconds * 1000).toLocaleString()
            : 'N/A';
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
        `;
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                <div>
                    <h2 style="margin: 0 0 5px 0; color: #0F172A; font-size: 1.6rem;">${order.orderId}</h2>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">${createdAtTime}</p>
                </div>
                <span style="background: ${statusBadgeColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; text-transform: capitalize;">${order.status}</span>
            </div>
            
            <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #999; text-transform: uppercase;">Customer</p>
                        <p style="margin: 0; font-weight: 600; color: #0F172A;">${order.customerName || 'Guest'}</p>
                    </div>
                    <div>
                        <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #999; text-transform: uppercase;">Table</p>
                        <p style="margin: 0; font-weight: 600; color: #0F172A;">🪑 ${order.tableNumber}</p>
                    </div>
                    <div>
                        <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #999; text-transform: uppercase;">Payment</p>
                        <p style="margin: 0; font-weight: 600; color: ${order.paymentStatus === 'paid' ? '#10B981' : '#EF4444'};">${order.paymentStatus || 'Pending'}</p>
                    </div>
                    <div>
                        <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #999; text-transform: uppercase;">Items</p>
                        <p style="margin: 0; font-weight: 600; color: #0F172A;">${order.items?.length || 0} item${(order.items?.length || 0) !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>
            
            <h3 style="margin: 20px 0 12px 0; color: #0F172A; font-size: 1.1rem;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tbody>
                    ${itemsHTML}
                    <tr style="background: #F9FAFB; font-weight: 600; border-top: 2px solid #E5E7EB;">
                        <td colspan="2" style="padding: 12px; text-align: right;">Total</td>
                        <td style="padding: 12px; text-align: right; color: #10B981; font-size: 1.2rem;">₹${order.total?.toFixed(2) || 0}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; background: #E5E7EB; color: #0F172A; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Close</button>
                <button onclick="printOrderReceipt('${orderId}')" style="padding: 10px 20px; background: #8B5CF6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">🖨️ Print</button>
            </div>
        `;
        
        modalOverlay.appendChild(modalContent);
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        };
        document.body.appendChild(modalOverlay);
    });
}

function printOrderReceipt(orderId) {
    db.collection('orders').doc(orderId).get().then(doc => {
        if (!doc.exists) return;
        
        const order = doc.data();
        const createdAtTime = order.createdAt?.seconds 
            ? new Date(order.createdAt.seconds * 1000).toLocaleString()
            : 'N/A';
        
        let itemsHTML = '';
        let totalItems = 0;
        order.items?.forEach(item => {
            totalItems += item.quantity;
            itemsHTML += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantity}x ${item.name}</td>
                    <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
            `;
        });
        
        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Order Receipt - ${order.orderId}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; background: white; }
                    .receipt { max-width: 400px; margin: 0 auto; padding: 20px; border: 2px solid #0F172A; border-radius: 8px; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0F172A; padding-bottom: 15px; }
                    .restaurant-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
                    .order-id { font-size: 24px; font-weight: bold; color: #3B82F6; margin: 15px 0; font-family: monospace; letter-spacing: 2px; }
                    .details { margin: 15px 0; font-size: 13px; }
                    .detail-row { display: flex; justify-content: space-between; margin: 5px 0; }
                    table { width: 100%; font-size: 13px; margin: 15px 0; }
                    th { text-align: left; padding: 8px; border-bottom: 2px solid #ddd; font-weight: bold; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; }
                    .total-row { background: #f9fafb; font-weight: bold; }
                    .footer { text-align: center; margin-top: 15px; font-size: 12px; color: #666; border-top: 2px solid #0F172A; padding-top: 10px; }
                    @media print { body { margin: 0; padding: 0; } }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <div class="restaurant-name">${app.currentRestaurant?.name || 'Restaurant'}</div>
                        <div style="font-size: 12px; color: #666;">Order Receipt</div>
                    </div>
                    
                    <div class="order-id">${order.orderId}</div>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span>Date & Time:</span>
                            <span>${createdAtTime}</span>
                        </div>
                        <div class="detail-row">
                            <span>Customer:</span>
                            <span>${order.customerName || 'Guest'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Table:</span>
                            <span>🪑 ${order.tableNumber}</span>
                        </div>
                        <div class="detail-row">
                            <span>Items:</span>
                            <span>${totalItems} item${totalItems !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="detail-row">
                            <span>Status:</span>
                            <span>${order.status.toUpperCase()}</span>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                            <tr class="total-row">
                                <td>TOTAL</td>
                                <td style="text-align: right;">₹${order.total?.toFixed(2) || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <div>Thank you for your order!</div>
                        <div style="margin-top: 10px;">Please keep this receipt for reference</div>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    });
}

// ============================================
// KITCHEN DISPLAY SYSTEM
// ============================================

async function loadKitchenDisplay() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('status', 'in', ['pending', 'accepted', 'preparing', 'ready'])
            .orderBy('createdAt', 'asc')
            .get();
        
        const display = document.getElementById('kitchen-display');
        display.innerHTML = '';
        
        if (snapshot.empty) {
            display.innerHTML = '<div style="text-align: center; padding: 60px; color: #999;"><div style="font-size: 2rem; margin-bottom: 10px;">✓</div><p style="font-size: 1.2rem; font-weight: 600;">All orders completed</p><p>No active orders to prepare</p></div>';
            return;
        }

        const orders = {
            pending: [],
            accepted: [],
            preparing: [],
            ready: []
        };
        
        snapshot.forEach(doc => {
            const order = doc.data();
            order.docId = doc.id;
            orders[order.status] = orders[order.status] || [];
            orders[order.status].push(order);
        });

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; padding: 20px;">';
        
        const statusConfigs = [
            { key: 'pending', label: 'Pending Orders', color: '#EF4444', bgColor: '#FEE2E2', icon: '🔴' },
            { key: 'accepted', label: 'Accepted', color: '#F59E0B', bgColor: '#FEF3C7', icon: '🟡' },
            { key: 'preparing', label: 'Preparing', color: '#3B82F6', bgColor: '#DBEAFE', icon: '🔵' },
            { key: 'ready', label: 'Ready for Delivery', color: '#10B981', bgColor: '#D1FAE5', icon: '🟢' }
        ];
        
        statusConfigs.forEach(status => {
            const statusOrders = orders[status.key] || [];
            
            html += `
                <div style="background: ${status.bgColor}; border-radius: 12px; padding: 16px; border-left: 4px solid ${status.color};">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                        <span style="font-size: 1.5rem;">${status.icon}</span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; color: #0F172A;">${status.label}</h3>
                            <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #666;">${statusOrders.length} order${statusOrders.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; max-height: 600px; overflow-y: auto;">
            `;
            
            if (statusOrders.length === 0) {
                html += '<p style="text-align: center; color: #999; padding: 20px 0;">No orders</p>';
            } else {
                statusOrders.forEach(order => {
                    const createdTime = order.createdAt ? (() => {
                        const timestamp = order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt;
                        const date = new Date(timestamp);
                        const now = new Date();
                        const diffMs = now - date;
                        const diffMins = Math.floor(diffMs / 60000);
                        return diffMins > 0 ? `${diffMins} mins ago` : 'just now';
                    })() : 'unknown';
                    
                    let itemsList = '';
                    order.items?.forEach(item => {
                        const variants = item.selectedVariants ? Object.values(item.selectedVariants).join(', ') : '';
                        const addons = item.selectedAddons ? Object.values(item.selectedAddons).join(', ') : '';
                        
                        itemsList += `
                            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;">
                                <div style="font-weight: 600; color: #0F172A;"><strong>${item.quantity}x ${item.name}</strong></div>
                                ${variants ? `<div style="font-size: 0.85rem; color: #666;">📌 ${variants}</div>` : ''}
                                ${addons ? `<div style="font-size: 0.85rem; color: #666;">✕ ${addons}</div>` : ''}
                                ${item.specialInstructions ? `<div style="font-size: 0.85rem; color: #EF4444; font-weight: 500;">📝 ${item.specialInstructions}</div>` : ''}
                            </div>
                        `;
                    });
                    
                    const estimatedTime = order.estimatedPrepTime || 30;
                    
                    html += `
                        <div class="premium-card" style="background: white; padding: 12px; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div>
                                    <div style="font-size: 1.2rem; font-weight: 700; color: #0F172A;">Table ${order.tableNumber}</div>
                                    <div style="font-size: 0.8rem; color: #666;">Order #${order.orderId.substring(0, 8)}</div>
                                </div>
                                <div style="text-align: right; font-size: 0.75rem; color: #999;">
                                    <div>${createdTime}</div>
                                    <div style="color: ${status.color}; font-weight: 600;">${estimatedTime} mins</div>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 8px;">
                                <div style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">👤 ${order.customerName || 'Guest'}</div>
                                ${itemsList}
                            </div>
                            
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${status.key === 'pending' ? `<button class="btn btn-primary" style="flex: 1; font-size: 0.8rem;" onclick="updateOrderStatus('${order.docId}', 'accepted')">✓ Accept</button>` : ''}
                                ${status.key === 'accepted' ? `<button class="btn btn-primary" style="flex: 1; font-size: 0.8rem;" onclick="updateOrderStatus('${order.docId}', 'preparing')">🔄 Preparing</button>` : ''}
                                ${status.key === 'preparing' ? `<button class="btn btn-success" style="flex: 1; font-size: 0.8rem;" onclick="updateOrderStatus('${order.docId}', 'ready')">✓ Ready</button>` : ''}
                                ${status.key === 'ready' ? `<button class="btn btn-success" style="flex: 1; font-size: 0.8rem;" onclick="updateOrderStatus('${order.docId}', 'completed')">✓ Completed</button>` : ''}
                                <button class="btn btn-danger" style="font-size: 0.8rem;" onclick="cancelOrderFromKitchen('${order.docId}')">✕</button>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += '</div></div>';
        });
        
        html += '</div>';
        display.innerHTML = html;
    } catch (error) {
        console.error('Error loading kitchen display:', error);
    }
}

// ============================================
// ANALYTICS
// ============================================

async function loadAnalytics() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        // Load orders for last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('createdAt', '>=', sevenDaysAgo)
            .get();
        
        const allOrdersSnapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        const revenueByDay = {};
        const ordersByDay = {};
        const foodCounts = {};
        const hourlyOrders = {};
        let totalRevenue = 0;
        let completedOrders = 0;
        let cancelledOrders = 0;
        let totalPrepTime = 0;
        let orderCount = 0;
        
        snapshot.forEach(doc => {
            const order = doc.data();
            if (!order.createdAt) return;
            
            const timestamp = order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt;
            const date = new Date(timestamp);
            const dateStr = date.toLocaleDateString();
            const hour = date.getHours();
            
            // Daily aggregates
            revenueByDay[dateStr] = (revenueByDay[dateStr] || 0) + (order.total || 0);
            ordersByDay[dateStr] = (ordersByDay[dateStr] || 0) + 1;
            hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
            
            // Food popularity
            order.items?.forEach(item => {
                foodCounts[item.name] = (foodCounts[item.name] || 0) + item.quantity;
            });
        });
        
        // Calculate metrics from all orders
        allOrdersSnapshot.forEach(doc => {
            const order = doc.data();
            totalRevenue += order.total || 0;
            if (order.status === 'completed') completedOrders++;
            if (order.status === 'cancelled') cancelledOrders++;
            totalPrepTime += order.estimatedPrepTime || 0;
            orderCount++;
        });
        
        const avgOrderValue = orderCount > 0 ? (totalRevenue / orderCount).toFixed(0) : 0;
        const avgPrepTime = orderCount > 0 ? (totalPrepTime / orderCount).toFixed(0) : 0;
        const returnRate = orderCount > 0 ? ((completedOrders / orderCount) * 100).toFixed(1) : 0;
        
        // Find peak hour
        let peakHour = 0;
        let maxOrders = 0;
        Object.entries(hourlyOrders).forEach(([hour, count]) => {
            if (count > maxOrders) {
                maxOrders = count;
                peakHour = hour;
            }
        });
        
        // Display summary metrics
        const summaryEl = document.getElementById('analytics-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="metric-card">
                    <div class="metric-icon">💰</div>
                    <div class="metric-info">
                        <span class="metric-label">Total Revenue</span>
                        <span class="metric-value">₹${totalRevenue.toLocaleString()}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">📦</div>
                    <div class="metric-info">
                        <span class="metric-label">Total Orders</span>
                        <span class="metric-value">${orderCount}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">✅</div>
                    <div class="metric-info">
                        <span class="metric-label">Completed Orders</span>
                        <span class="metric-value">${completedOrders}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">❌</div>
                    <div class="metric-info">
                        <span class="metric-label">Cancelled Orders</span>
                        <span class="metric-value">${cancelledOrders}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-info">
                        <span class="metric-label">Avg Order Value</span>
                        <span class="metric-value">₹${avgOrderValue}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">⏱️</div>
                    <div class="metric-info">
                        <span class="metric-label">Avg Prep Time</span>
                        <span class="metric-value">${avgPrepTime} min</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">🔄</div>
                    <div class="metric-info">
                        <span class="metric-label">Completion Rate</span>
                        <span class="metric-value">${returnRate}%</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">⏰</div>
                    <div class="metric-info">
                        <span class="metric-label">Peak Hour</span>
                        <span class="metric-value">${peakHour}:00</span>
                    </div>
                </div>
            `;
        }
        
        // Display detailed analytics table
        const detailedEl = document.getElementById('detailed-analytics');
        if (detailedEl) {
            const sortedFoods = Object.entries(foodCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #F3F4F6; border-bottom: 2px solid #E5E7EB;">
                            <th style="padding: 12px; text-align: left;">Food Name</th>
                            <th style="padding: 12px; text-align: right;">Orders</th>
                            <th style="padding: 12px; text-align: right;">% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            sortedFoods.forEach(([name, count]) => {
                const percentage = orderCount > 0 ? ((count / orderCount) * 100).toFixed(1) : 0;
                tableHTML += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 12px;">${name}</td>
                        <td style="padding: 12px; text-align: right;"><strong>${count}</strong></td>
                        <td style="padding: 12px; text-align: right;">${percentage}%</td>
                    </tr>
                `;
            });
            
            tableHTML += '</tbody></table>';
            detailedEl.innerHTML = tableHTML;
        }
        
        // Draw revenue chart
        if (app.charts.revenue) {
            app.charts.revenue.destroy();
        }
        const revenueCtx = document.getElementById('revenue-chart');
        if (revenueCtx) {
            app.charts.revenue = new Chart(revenueCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: Object.keys(revenueByDay),
                    datasets: [{
                        label: 'Daily Revenue',
                        data: Object.values(revenueByDay),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true }
                    }
                }
            });
        }
        
        // Draw orders chart
        if (app.charts.orders) {
            app.charts.orders.destroy();
        }
        const ordersCtx = document.getElementById('orders-chart');
        if (ordersCtx) {
            app.charts.orders = new Chart(ordersCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: Object.keys(ordersByDay),
                    datasets: [{
                        label: 'Daily Orders',
                        data: Object.values(ordersByDay),
                        backgroundColor: '#10B981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true }
                    }
                }
            });
        }
        
        // Draw popular foods chart
        if (app.charts.foods) {
            app.charts.foods.destroy();
        }
        const foodsCtx = document.getElementById('foods-chart');
        if (foodsCtx) {
            app.charts.foods = new Chart(foodsCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: Object.keys(foodCounts).slice(0, 5),
                    datasets: [{
                        data: Object.values(foodCounts).slice(0, 5),
                        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true }
                    }
                }
            });
        }
        
        // Draw hourly chart
        if (app.charts.hourly) {
            app.charts.hourly.destroy();
        }
        const hourlyCtx = document.getElementById('hourly-chart');
        if (hourlyCtx) {
            const hours = Array.from({length: 24}, (_, i) => i);
            app.charts.hourly = new Chart(hourlyCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: hours.map(h => h + ':00'),
                    datasets: [{
                        label: 'Orders by Hour',
                        data: hours.map(h => hourlyOrders[h] || 0),
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// ============================================
// REVIEWS
// ============================================

async function loadReviews() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const snapshot = await db.collection('reviews')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const list = document.getElementById('reviews-list');
        list.innerHTML = '';
        
        snapshot.forEach(doc => {
            const review = doc.data();
            const card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
                <div class="review-header">
                    <div class="reviewer-name">${review.customerName || 'Anonymous'}</div>
                    <div class="review-rating">${'⭐'.repeat(review.rating)}</div>
                </div>
                <div class="review-text">${review.text}</div>
                <div class="review-date">${new Date(review.createdAt.seconds * 1000).toLocaleDateString()}</div>
            `;
            list.appendChild(card);
        });
        
        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No reviews yet</p>';
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

// ============================================
// SETTINGS
// ============================================

async function updateRestaurantProfile() {
    try {
        const name = document.getElementById('setting-name').value;
        const description = document.getElementById('setting-description').value;
        
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            name: name,
            description: description,
            updatedAt: new Date()
        });
        
        app.currentRestaurant.name = name;
        app.currentRestaurant.description = description;
        
        showNotification('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile', 'error');
    }
}

async function generateAndDownloadQR() {
    try {
        // Check subscription status
        if (isSubscriptionExpired(app.currentRestaurant)) {
            showNotification('Your subscription has expired. Please renew your subscription to use QR codes.', 'error');
            return;
        }
        
        if (app.currentRestaurant.subscription?.status !== 'active') {
            showNotification('Your subscription is not active. Please upgrade to use QR codes.', 'error');
            return;
        }
        
        const modal = document.getElementById('qr-modal').content.cloneNode(true);
        document.getElementById('app').appendChild(modal);
        
        setTimeout(() => {
            generateQRCode();
        }, 100);
    } catch (error) {
        console.error('Error generating QR:', error);
        showNotification('Failed to generate QR code', 'error');
    }
}

function generateQRCode() {
    const container = document.getElementById('qr-code-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Generate QR code with GitHub Pages URL
    const qrLink = 'https://shank122004-tech.github.io/Restaurants/?restaurant=' + app.currentRestaurantId;
    
    try {
        new QRCode(container, {
            text: qrLink,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
}

function downloadQRCode() {
    try {
        const canvas = document.querySelector('#qr-code-container canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = app.currentRestaurant.name + '-qr-code.png';
            link.click();
            showNotification('QR Code downloaded!', 'success');
        }
    } catch (error) {
        console.error('Error downloading QR:', error);
        showNotification('Failed to download QR code', 'error');
    }
}

function printQRCode() {
    try {
        const canvas = document.querySelector('#qr-code-container canvas');
        if (canvas) {
            const printWindow = window.open('', '_blank');
            const qrImage = canvas.toDataURL('image/png');
            
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Print QR Code</title>
                        <style>
                            body { 
                                display: flex; 
                                justify-content: center; 
                                align-items: center; 
                                min-height: 100vh;
                                margin: 0;
                                padding: 20px;
                                font-family: Arial, sans-serif;
                            }
                            .print-container { 
                                text-align: center;
                                max-width: 600px;
                            }
                            h2 { margin: 20px 0 10px 0; color: #333; }
                            .qr-section { margin: 30px 0; }
                            img { width: 300px; height: 300px; border: 2px solid #ddd; padding: 10px; }
                            p { color: #666; margin: 15px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="print-container">
                            <h2>${app.currentRestaurant.name}</h2>
                            <p>Scan to View Menu & Place Order</p>
                            <div class="qr-section">
                                <img src="${qrImage}" alt="QR Code">
                            </div>
                            <p>Place this QR code on each table for customers to scan and order</p>
                            <p style="font-size: 12px; color: #999;">Powered by RestaurantOS</p>
                        </div>
                    </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
                showNotification('Print dialog opened!', 'success');
            }, 500);
        }
    } catch (error) {
        console.error('Error printing QR:', error);
        showNotification('Failed to print QR code', 'error');
    }
}

async function renewSubscription() {
    // TODO: Implement subscription renewal with Cashfree
    showNotification('Renewal coming soon. Contact support for manual renewal.', 'info');
}

// ============================================
// CUSTOMER MENU EXPERIENCE
// ============================================

async function loadCustomerMenu(restaurantId) {
    try {
        console.log('[Customer] Loading menu for restaurant:', restaurantId);
        
        app.customerMode = true;
        app.currentRestaurantId = restaurantId;
        
        console.log('[Customer] customerMode set to:', app.customerMode);
        
        // Load restaurant data
        console.log('[Customer] Fetching restaurant data from Firestore...');
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        
        if (!restaurantDoc.exists) {
            console.error('[Customer] Restaurant not found:', restaurantId);
            navigateTo('landing');
            showNotification('Restaurant not found', 'error');
            return;
        }
        
        console.log('[Customer] Restaurant data loaded:', restaurantDoc.data().name);
        app.currentRestaurant = restaurantDoc.data();
        
        // Ensure tables are loaded - if not, create default tables based on tableCount
        if (!app.currentRestaurant.tables || app.currentRestaurant.tables.length === 0) {
            const tableCount = app.currentRestaurant.tableCount || 10;
            const defaultTables = [];
            for (let i = 1; i <= tableCount; i++) {
                defaultTables.push({
                    number: i,
                    name: `Table ${i}`,
                    status: 'available',
                    enabled: true
                });
            }
            app.currentRestaurant.tables = defaultTables;
        }
        
        console.log('[Customer] Navigating to customer-menu page');
        navigateTo('customer-menu');
        
        console.log('[Customer] Setting up real-time listeners');
        // Setup real-time listener for restaurant data updates
        setupCustomerMenuRealtimeUpdates(restaurantId);
        
        // Refresh data when page comes back to focus
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && app.customerMode && app.currentRestaurantId) {
                console.log('[Customer] Page visibility changed - refreshing data');
                refreshCustomerMenuData();
            }
        });
        
        console.log('[Customer] Menu loaded successfully');
        
    } catch (error) {
        console.error('Error loading customer menu:', error);
        showNotification('Failed to load restaurant', 'error');
    }
}

// Real-time listener for restaurant data changes
function setupCustomerMenuRealtimeUpdates(restaurantId) {
    try {
        if (!firebaseInitialized || !db) return;
        
        // Listen to restaurant updates (banner, logo, name, status)
        db.collection('restaurants').doc(restaurantId)
            .onSnapshot(doc => {
                if (doc.exists) {
                    const updatedData = doc.data();
                    
                    // Check if banner or logo changed
                    if (updatedData.banner !== app.currentRestaurant.banner ||
                        updatedData.logo !== app.currentRestaurant.logo ||
                        updatedData.name !== app.currentRestaurant.name) {
                        console.log('[Customer] Restaurant data updated - refreshing UI');
                        app.currentRestaurant = { ...app.currentRestaurant, ...updatedData };
                        loadCustomerRestaurantData();
                    }
                }
            }, error => {
                console.warn('[Customer] Real-time listener error:', error);
            });
        
        // Listen to foods updates
        db.collection('foods')
            .where('restaurantId', '==', restaurantId)
            .onSnapshot(snapshot => {
                console.log('[Customer] Foods updated - refreshing menu');
                loadCustomerMenuItems();
            }, error => {
                console.warn('[Customer] Foods listener error:', error);
            });
        
        // Listen to categories updates
        db.collection('categories')
            .where('restaurantId', '==', restaurantId)
            .onSnapshot(snapshot => {
                console.log('[Customer] Categories updated - refreshing menu');
                loadCustomerMenuItems();
            }, error => {
                console.warn('[Customer] Categories listener error:', error);
            });
        
    } catch (error) {
        console.error('Error setting up real-time updates:', error);
    }
}

// Refresh customer menu data
async function refreshCustomerMenuData() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const refreshBtn = document.getElementById('refresh-menu-btn');
        if (refreshBtn) {
            refreshBtn.style.animation = 'spin 0.6s linear infinite';
            refreshBtn.disabled = true;
        }
        
        const restaurantDoc = await db.collection('restaurants').doc(app.currentRestaurantId).get();
        if (restaurantDoc.exists) {
            app.currentRestaurant = restaurantDoc.data();
            await loadCustomerRestaurantData();
            await loadCustomerMenuItems();
            console.log('[Customer] Menu data refreshed');
            
            if (refreshBtn) {
                refreshBtn.style.animation = 'none';
                refreshBtn.disabled = false;
                showNotification('Menu updated!', 'success');
            }
        }
    } catch (error) {
        console.error('Error refreshing customer menu:', error);
        const refreshBtn = document.getElementById('refresh-menu-btn');
        if (refreshBtn) {
            refreshBtn.style.animation = 'none';
            refreshBtn.disabled = false;
        }
    }
}

function setupCustomerMenu() {
    // Hide back button if customer accessed via QR code
    if (app.customerMode) {
        const backBtn = document.getElementById('back-to-home-btn');
        if (backBtn) {
            backBtn.style.display = 'none';
            backBtn.disabled = true;
        }
    }
    
    // Remove any navigation elements for customer mode
    if (app.customerMode) {
        const navElements = document.querySelectorAll('.nav-container, .landing-nav');
        navElements.forEach(el => {
            if (el) el.style.display = 'none';
        });
    }
    
    loadCustomerRestaurantData();
    loadCustomerMenuItems();
}

async function loadCustomerRestaurantData() {
    try {
        document.getElementById('restaurant-name-display').textContent = app.currentRestaurant.name || 'Restaurant';
        
        // Set banner background image if available
        const headerElement = document.getElementById('customer-header-bg');
        if (headerElement && app.currentRestaurant.banner) {
            headerElement.style.backgroundImage = `url('${app.currentRestaurant.banner}')`;
        }
        
        // Set logo image or emoji
        const logoElement = document.getElementById('restaurant-logo');
        if (app.currentRestaurant.logo) {
            logoElement.innerHTML = `<img src="${app.currentRestaurant.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
        } else {
            logoElement.textContent = '🍽️';
            logoElement.style.background = 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)';
            logoElement.style.color = 'white';
            logoElement.style.fontSize = '2.5rem';
        }
        
        // Check restaurant status using the isRestaurantOpen function
        const restaurantOpen = isRestaurantOpen();
        const statusEl = document.getElementById('restaurant-status');
        const placeOrderBtn = document.getElementById('place-order-btn');
        const foodsDisplay = document.getElementById('foods-display');
        
        if (restaurantOpen) {
            statusEl.textContent = '🟢 Open';
            if (placeOrderBtn) {
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = 'Place Order';
            }
        } else {
            statusEl.textContent = '🔴 Closed';
            if (placeOrderBtn) {
                placeOrderBtn.disabled = true;
                const opening = app.currentRestaurant.openingTime || '09:00';
                placeOrderBtn.textContent = `Opens at ${opening}`;
            }
            
            // Show overlay on menu
            if (foodsDisplay && !foodsDisplay.classList.contains('restaurant-closed-overlay')) {
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                `;
                overlay.innerHTML = `
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
                        <p style="font-size: 1.2rem; margin: 10px 0;">🔴 Restaurant Closed</p>
                        <p style="color: #666; margin: 10px 0;">Opens at ${app.currentRestaurant.openingTime || '09:00'}</p>
                    </div>
                `;
            }
        }
        
        document.getElementById('restaurant-rating').textContent = '⭐ 4.5 (120 reviews)';
    } catch (error) {
        console.error('Error loading restaurant data:', error);
    }
}

async function loadCustomerMenuItems() {
    try {
        // Load and display offers/coupons banner
        await loadAndDisplayCustomerOffers();
        
        // Load categories
        const categoriesSnapshot = await db.collection('categories')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('position', 'asc')
            .get();
        
        const categoryScroll = document.getElementById('categories-scroll-list');
        if (categoryScroll) {
            categoryScroll.innerHTML = '';
            
            let firstCategory = null;
            let categoryIndex = 0;
            
            // Color gradients for categories - premium foodie theme
            const categoryColors = [
                { bg: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%)', color: '#fff' },      // Red/Coral
                { bg: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)', color: '#fff' },      // Teal
                { bg: 'linear-gradient(135deg, #FFD93D 0%, #FFA31A 100%)', color: '#fff' },      // Gold/Orange
                { bg: 'linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)', color: '#fff' },      // Purple
                { bg: 'linear-gradient(135deg, #00B894 0%, #27AE60 100%)', color: '#fff' },      // Green
                { bg: 'linear-gradient(135deg, #FD79A8 0%, #E84393 100%)', color: '#fff' },      // Pink
                { bg: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)', color: '#fff' },      // Sunset
                { bg: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)', color: '#fff' },      // Purple Blue
                { bg: 'linear-gradient(135deg, #FA8231 0%, #F5AF19 100%)', color: '#fff' },      // Warm Gold
                { bg: 'linear-gradient(135deg, #2E86AB 0%, #A23B72 100%)', color: '#fff' }       // Deep Purple
            ];
            
            categoriesSnapshot.forEach((doc) => {
                const cat = doc.data();
                if (categoryIndex === 0) firstCategory = doc.id;
                
                const colorScheme = categoryColors[categoryIndex % categoryColors.length];
                
                const card = document.createElement('div');
                card.className = 'category-card premium-category-card' + (categoryIndex === 0 ? ' active' : '');
                card.style.background = colorScheme.bg;
                card.style.color = colorScheme.color;
                card.dataset.categoryId = doc.id;
                
                card.innerHTML = `
                    <div class="category-icon">🍽️</div>
                    <strong class="category-name">${cat.name}</strong>
                `;
                
                card.onclick = () => {
                    document.querySelectorAll('.categories-scroll .category-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    loadFoodsForCategory(doc.id);
                };
                
                categoryScroll.appendChild(card);
                categoryIndex++;
            });
            
            // Load foods for first category automatically
            if (firstCategory) {
                console.log('[Customer] Auto-loading first category:', firstCategory);
                await loadFoodsForCategory(firstCategory);
            } else {
                document.getElementById('foods-display').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🍽️</div>
                        <p>No food items available at the moment</p>
                    </div>
                `;
            }
        }
        
        // Load variants and addons for customer use
        await loadVariantsAndAddonsForCustomer();
    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('Failed to load menu', 'error');
    }
}

async function loadAndDisplayCustomerOffers() {
    try {
        const offersSnapshot = await db.collection('offers')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('active', '==', true)
            .get();
        
        const couponsSnapshot = await db.collection('coupons')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('active', '==', true)
            .get();
        
        app.offers = [];
        app.coupons = [];
        
        const offersContainer = document.getElementById('customer-offers-section');
        
        if (offersContainer) {
            let offersHTML = '';
            
            offersSnapshot.forEach(doc => {
                const offer = doc.data();
                app.offers.push({ id: doc.id, ...offer });
                offersHTML += `
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 18px; border-radius: 14px; margin: 10px 0; text-align: center; box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 28px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 20px rgba(102, 126, 234, 0.3)'">
                        <div style="font-weight: 700; font-size: 1.15rem; margin-bottom: 6px;">🎉 ${offer.title}</div>
                        <div style="font-size: 0.95rem; margin: 8px 0; opacity: 0.95;">${offer.description}</div>
                        <div style="font-size: 1.3rem; font-weight: 800; margin-top: 8px;">Get ${offer.discount}% OFF</div>
                    </div>
                `;
            });
            
            couponsSnapshot.forEach(doc => {
                const coupon = doc.data();
                app.coupons.push({ id: doc.id, ...coupon });
                offersHTML += `
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 16px 18px; border-radius: 14px; margin: 10px 0; text-align: center; box-shadow: 0 8px 20px rgba(245, 87, 108, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 28px rgba(245, 87, 108, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 20px rgba(245, 87, 108, 0.3)'">
                        <div style="font-weight: 700; font-size: 1.15rem; margin-bottom: 6px;">🎟️ ${coupon.code}</div>
                        <div style="font-size: 0.95rem; margin: 8px 0; opacity: 0.95;">${coupon.description}</div>
                        <div style="font-size: 0.9rem; background: rgba(255,255,255,0.25); padding: 8px 12px; border-radius: 8px; margin-top: 8px; font-weight: 600; backdrop-filter: blur(10px);">Discount: ₹${coupon.discountAmount || coupon.discountPercent + '%'}</div>
                    </div>
                `;
            });
            
            if (offersHTML) {
                offersContainer.innerHTML = `<div style="padding: 15px 0;">${offersHTML}</div>`;
                offersContainer.style.display = 'block';
            } else {
                offersContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading customer offers:', error);
    }
}

async function loadVariantsAndAddonsForCustomer() {
    try {
        const variantsSnapshot = await db.collection('variants')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        const addonsSnapshot = await db.collection('addons')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.variants = [];
        app.addons = [];
        
        variantsSnapshot.forEach(doc => {
            app.variants.push({ id: doc.id, ...doc.data() });
        });
        
        addonsSnapshot.forEach(doc => {
            app.addons.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading variants and addons:', error);
    }
}

async function loadFoodsForCategory(categoryId) {
    try {
        const categoryDoc = await db.collection('categories').doc(categoryId).get();
        const categoryName = categoryDoc.data().name;
        
        const foodsSnapshot = await db.collection('foods')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('category', '==', categoryName)
            .get();
        
        const display = document.getElementById('foods-display');
        display.innerHTML = '';
        
        const availableFoods = [];
        
        foodsSnapshot.forEach(doc => {
            const food = doc.data();
            const availability = food.availability || (food.outOfStock ? 'outOfStock' : (food.hidden ? 'hidden' : 'available'));
            
            // Skip completely hidden items for customers
            if (food.hidden) return;
            
            if (availability !== 'hidden') {
                availableFoods.push({ id: doc.id, ...food });
            }
            
            const card = document.createElement('div');
            const isAvailable = availability === 'available';
            card.className = 'food-item-card' + (isAvailable ? '' : ' unavailable');
            card.style.opacity = isAvailable ? '1' : '0.6';
            card.dataset.categoryId = categoryId;
            card.onclick = () => {
                if (isAvailable) {
                    openFoodDetails(doc.id, food);
                } else {
                    showNotification(`This item is ${availability === 'outOfStock' ? 'Out of Stock' : availability === 'coming soon' ? 'Coming Soon' : 'Currently Unavailable'}`, 'info');
                }
            };
            
            let badgeHtml = '';
            if (availability === 'outOfStock') badgeHtml += '<span class="food-badge" style="background: #FEE2E2; color: #991B1B;">❌ Out of Stock</span>';
            if (availability === 'coming soon') badgeHtml += '<span class="food-badge" style="background: #FEF3C7; color: #854D0E;">⏰ Coming Soon</span>';
            if (availability === 'seasonal') badgeHtml += '<span class="food-badge" style="background: #DBEAFE; color: #1E40AF;">🌿 Seasonal</span>';
            if (food.bestseller) badgeHtml += '<span class="food-badge">⭐ Bestseller</span>';
            if (food.popular) badgeHtml += '<span class="food-badge">🔥 Popular</span>';
            if (food.recommended) badgeHtml += '<span class="food-badge">💎 Recommended</span>';
            if (food.chefSpecial) badgeHtml += '<span class="food-badge">👨‍🍳 Chef Special</span>';
            if (food.todaySpecial) badgeHtml += '<span class="food-badge">📅 Today Special</span>';
            
            card.innerHTML = `
                <div class="food-item-image" style="position: relative;">
                    ${food.images && food.images[0] ? `<img src="${food.images[0]}" alt="${food.name}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🍜'}
                    <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; flex-wrap: wrap;">${badgeHtml}</div>
                    ${!isAvailable ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border-radius: 8px;">${availability === 'outOfStock' ? 'Out of Stock' : availability === 'coming soon' ? 'Coming Soon' : 'Not Available'}</div>` : ''}
                </div>
                <div class="food-item-info">
                    <div class="food-item-name">${food.name}</div>
                    <p style="font-size: 0.85rem; color: #666; margin: 4px 0;">${food.shortDescription || ''}</p>
                    <div class="food-item-price">
                        <span class="current">₹${food.price}</span>
                        ${food.discountPrice ? `<span class="original">₹${food.discountPrice}</span>` : ''}
                    </div>
                    ${food.preparationTime ? `<div class="food-item-time">⏱️ ${food.preparationTime} mins</div>` : ''}
                </div>
            `;
            display.appendChild(card);
        });
        
        if (availableFoods.length === 0) {
            display.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍽️</div>
                    <p>No items available in this category</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading foods:', error);
    }
}

function openFoodDetails(foodId, foodData) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(to bottom, #FFFFFF 0%, #F8FAFC 100%);
        padding: 0;
        border-radius: 24px;
        max-width: 520px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.15);
        animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
    `;
    
    // Filter variants - only show those linked to this food
    let variantsHTML = '';
    let foodVariants = [];
    if (foodData.variants && foodData.variants.length > 0 && app.variants && app.variants.length > 0) {
        foodVariants = app.variants.filter(variant => 
            foodData.variants.includes(variant.id)
        );
        
        if (foodVariants.length > 0) {
            variantsHTML = `
                <div style="margin: 20px 0; padding: 0 20px;">
                    <label style="font-weight: 700; display: block; margin-bottom: 12px; color: #0F172A; font-size: 0.95rem;">📏 Select Size:</label>
                    <div id="food-detail-variants" style="display: flex; flex-direction: column; gap: 10px;">
            `;
            foodVariants.forEach(variant => {
                variantsHTML += `
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 14px; border: 2px solid #E5E7EB; border-radius: 12px; transition: all 0.3s ease; background: white;" onmouseover="this.style.borderColor='#FF6B6B'; this.style.backgroundColor='#FFF5F5';" onmouseout="this.style.borderColor='#E5E7EB'; this.style.backgroundColor='white';">
                        <input type="checkbox" value="${variant.id}" data-price="${variant.priceAdjustment || 0}" style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="flex: 1; font-weight: 500; color: #0F172A;">${variant.name}</span>
                        <span style="color: #10B981; font-weight: 700;">+₹${variant.priceAdjustment || 0}</span>
                    </label>
                `;
            });
            variantsHTML += '</div></div>';
        }
    }
    
    // Filter add-ons - only show those linked to this food
    let addonsHTML = '';
    let foodAddons = [];
    if (foodData.addons && foodData.addons.length > 0 && app.addons && app.addons.length > 0) {
        foodAddons = app.addons.filter(addon => 
            foodData.addons.includes(addon.id)
        );
        
        if (foodAddons.length > 0) {
            addonsHTML = `
                <div style="margin: 20px 0; padding: 0 20px;">
                    <label style="font-weight: 700; display: block; margin-bottom: 12px; color: #0F172A; font-size: 0.95rem;">🧅 Add-ons:</label>
                    <div id="food-detail-addons" style="display: flex; flex-direction: column; gap: 10px;">
            `;
            foodAddons.forEach(addon => {
                addonsHTML += `
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 14px; border: 2px solid #E5E7EB; border-radius: 12px; transition: all 0.3s ease; background: white;" onmouseover="this.style.borderColor='#FF6B6B'; this.style.backgroundColor='#FFF5F5';" onmouseout="this.style.borderColor='#E5E7EB'; this.style.backgroundColor='white';">
                        <input type="checkbox" value="${addon.id}" data-price="${addon.price || 0}" style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="flex: 1; font-weight: 500; color: #0F172A;">${addon.name}</span>
                        <span style="color: #10B981; font-weight: 700;">+₹${addon.price || 0}</span>
                    </label>
                `;
            });
            addonsHTML += '</div></div>';
        }
    }
    
    modalContent.innerHTML = `
        <div style="position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 24px 24px 0 0; overflow: hidden;">
            <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.2); border: none; font-size: 1.8rem; cursor: pointer; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; z-index: 11;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.1)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)';">×</button>
            ${foodData.images && foodData.images[0] ? `<img src="${foodData.images[0]}" alt="${foodData.name}" style="width: 100%; height: 280px; object-fit: cover;">` : `<div style="width: 100%; height: 280px; background: linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%); display: flex; align-items: center; justify-content: center; font-size: 5rem;">🍽️</div>`}
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 80px; background: linear-gradient(to bottom, transparent, rgba(26, 26, 46, 0.9));"></div>
        </div>
        
        <div style="padding: 24px 20px; padding-top: 20px;">
            <h2 style="margin: 0 0 8px 0; color: #0F172A; font-size: 1.8rem; font-weight: 800; word-break: break-word;">${foodData.name}</h2>
            <p style="color: #64748B; font-size: 0.95rem; margin: 0 0 16px 0; line-height: 1.5;">${foodData.shortDescription || foodData.description || ''}</p>
            
            <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%); padding: 18px; border-radius: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.2);">
                <div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.85); margin-bottom: 4px; font-weight: 600;">Price</div>
                    <div style="font-size: 2.2rem; font-weight: 900; color: white;">₹${foodData.price}</div>
                    ${foodData.discountPrice ? `<div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); text-decoration: line-through; margin-top: 2px;">₹${foodData.discountPrice}</div>` : ''}
                </div>
                ${foodData.preparationTime ? `<div style="text-align: right; color: white;"><div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 4px; font-weight: 600;">Prep Time</div><div style="font-size: 1.6rem; font-weight: 800;">⏱️ ${foodData.preparationTime}</div><div style="font-size: 0.75rem; opacity: 0.85;">mins</div></div>` : ''}
            </div>
            
            <div style="margin: 20px 0; padding: 16px; background: #F8FAFC; border-radius: 14px; border: 2px solid #E5E7EB;">
                <label style="font-weight: 700; display: block; margin-bottom: 14px; color: #0F172A; font-size: 0.95rem;">🔢 Quantity:</label>
                <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
                    <button onclick="
                        const qtyInput = document.getElementById('qty-${foodId}');
                        qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
                        updateAddButtonState('${foodId}');
                    " style="padding: 10px 16px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%); border: none; border-radius: 10px; cursor: pointer; font-size: 1.2rem; color: white; font-weight: 700; transition: all 0.3s ease; min-width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 8px 20px rgba(255, 107, 107, 0.3)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">−</button>
                    <input type="number" id="qty-${foodId}" value="1" min="1" oninput="updateAddButtonState('${foodId}')" style="width: 70px; padding: 12px; border: 2px solid #FF6B6B; border-radius: 10px; text-align: center; font-size: 1.1rem; font-weight: 700; color: #0F172A;">
                    <button onclick="
                        const qtyInput = document.getElementById('qty-${foodId}');
                        qtyInput.value = parseInt(qtyInput.value) + 1;
                        updateAddButtonState('${foodId}');
                    " style="padding: 10px 16px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%); border: none; border-radius: 10px; cursor: pointer; font-size: 1.2rem; color: white; font-weight: 700; transition: all 0.3s ease; min-width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 8px 20px rgba(255, 107, 107, 0.3)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">+</button>
                </div>
            </div>
            
            ${variantsHTML}
            ${addonsHTML}
            
            <button id="add-to-cart-btn-${foodId}" onclick="addToCartWithOptions('${foodId}', ${foodData.price}, '${foodData.name}')" style="
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%);
                color: white;
                border: none;
                border-radius: 14px;
                cursor: pointer;
                font-weight: 800;
                font-size: 1.05rem;
                margin-top: 24px;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: 0 12px 32px rgba(255, 107, 107, 0.25);
                position: relative;
                overflow: hidden;
                transform: translateY(0);
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 16px 40px rgba(255, 107, 107, 0.35)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 12px 32px rgba(255, 107, 107, 0.25)';">
                🛒 Add to Order
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Close modal when clicking outside
    modalOverlay.onclick = function(e) {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };
}

function updateAddButtonState(foodId) {
    const qtyInput = document.getElementById(`qty-${foodId}`);
    const addBtn = document.getElementById(`add-to-cart-btn-${foodId}`);
    const quantity = parseInt(qtyInput.value) || 0;
    
    if (addBtn) {
        if (quantity > 0) {
            addBtn.style.display = 'block';
            addBtn.style.animation = 'slideUp 0.3s ease';
        } else {
            addBtn.style.display = 'none';
        }
    }
}

function addToCartWithOptions(foodId, basePrice, foodName) {
    const quantity = parseInt(document.getElementById(`qty-${foodId}`).value) || 1;
    
    // Get selected variants
    const selectedVariants = [];
    const variantCheckboxes = document.querySelectorAll('#food-detail-variants input[type="checkbox"]:checked');
    let variantPrice = 0;
    variantCheckboxes.forEach(checkbox => {
        selectedVariants.push(checkbox.value);
        variantPrice += parseFloat(checkbox.dataset.price || 0);
    });
    
    // Get selected addons
    const selectedAddons = [];
    const addonCheckboxes = document.querySelectorAll('#food-detail-addons input[type="checkbox"]:checked');
    let addonPrice = 0;
    addonCheckboxes.forEach(checkbox => {
        selectedAddons.push(checkbox.value);
        addonPrice += parseFloat(checkbox.dataset.price || 0);
    });
    
    const totalPrice = basePrice + variantPrice + addonPrice;
    
    // Add to cart with options
    const key = foodId;
    if (app.cart[key]) {
        app.cart[key].quantity += quantity;
    } else {
        app.cart[key] = {
            id: foodId,
            name: foodName,
            price: totalPrice,
            basePrice: basePrice,
            quantity: quantity,
            variants: selectedVariants,
            addons: selectedAddons,
            variantPrice: variantPrice,
            addonPrice: addonPrice
        };
    }
    
    showNotification(`${foodName} added to cart! 🛒`, 'success');
    
    // Close modal
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    
    updateCartDisplay();
}

function searchFoods() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const foodsDisplay = document.getElementById('foods-display');
    
    // If search is empty, show all foods in current display
    if (!searchTerm) {
        const foodCards = foodsDisplay.querySelectorAll('.food-item-card');
        foodCards.forEach(card => {
            card.style.display = 'block';
        });
        return;
    }
    
    // Filter foods based on search term
    const foodCards = foodsDisplay.querySelectorAll('.food-item-card');
    let matchedCount = 0;
    
    foodCards.forEach(card => {
        const foodName = card.querySelector('.food-item-name')?.textContent?.toLowerCase() || '';
        if (foodName.includes(searchTerm)) {
            card.style.display = 'block';
            matchedCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show "no results" message if no matches found
    if (matchedCount === 0) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'empty-state';
        noResultsDiv.style.gridColumn = '1 / -1';
        noResultsDiv.innerHTML = `
            <div class="empty-state-icon">🔍</div>
            <p>No items found matching "<strong>${searchTerm}</strong>"</p>
        `;
        
        // Remove previous "no results" message if exists
        const existingNoResults = foodsDisplay.querySelector('.empty-state');
        if (existingNoResults) {
            existingNoResults.remove();
        }
        
        foodsDisplay.appendChild(noResultsDiv);
    } else {
        // Remove "no results" message if it exists
        const existingNoResults = foodsDisplay.querySelector('.empty-state');
        if (existingNoResults) {
            existingNoResults.remove();
        }
    }
}

async function addToCart(foodId, foodData) {
    const key = foodId;
    if (app.cart[key]) {
        app.cart[key].quantity += 1;
    } else {
        app.cart[key] = {
            id: foodId,
            name: foodData.name || 'Unknown Item',
            price: foodData.price || 0,
            image: foodData.images ? foodData.images[0] : (foodData.image || null),
            category: foodData.category || '',
            quantity: 1
        };
    }
    
    updateCartDisplay();
    showNotification('Added to cart!', 'success');
}

function removeFromCart(foodId) {
    delete app.cart[foodId];
    updateCartDisplay();
}

function updateCartQuantity(foodId, change) {
    if (app.cart[foodId]) {
        app.cart[foodId].quantity += change;
        if (app.cart[foodId].quantity <= 0) {
            removeFromCart(foodId);
        } else {
            updateCartDisplay();
        }
    }
}

function updateCartDisplay() {
    const cartItemsDiv = document.getElementById('cart-items');
    const items = Object.values(app.cart);
    
    cartItemsDiv.innerHTML = '';
    let subtotal = 0;
    
    items.forEach(item => {
        subtotal += item.price * item.quantity;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div class="cart-item-header">
                <span class="cart-item-name">${item.name}</span>
                <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">×</button>
            </div>
            <div class="cart-item-price">₹${item.price} × ${item.quantity}</div>
            <div class="cart-item-qty">
                <button onclick="updateCartQuantity('${item.id}', -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQuantity('${item.id}', 1)">+</button>
            </div>
        `;
        cartItemsDiv.appendChild(itemDiv);
    });
    
    const total = subtotal;
    
    document.getElementById('total').textContent = '₹' + total.toFixed(2);
    document.getElementById('cart-count').textContent = items.length;
}

async function placeOrder() {
    const items = Object.values(app.cart);
    
    // Check if restaurant is open
    if (!isRestaurantOpen() && !app.previewMode) {
        showNotification('Restaurant is currently closed. Orders can only be placed during business hours.', 'error');
        return;
    }
    
    if (items.length === 0) {
        showNotification('Cart is empty!', 'error');
        return;
    }
    
    // Get available tables
    let availableTables = [];
    if (app.currentRestaurant && app.currentRestaurant.tables && app.currentRestaurant.tables.length > 0) {
        availableTables = app.currentRestaurant.tables.filter(t => 
            t.status !== 'disabled' && t.status !== 'reserved'
        );
    }
    
    // Debug log
    console.log('Current Restaurant:', app.currentRestaurant);
    console.log('Available Tables:', availableTables);
    
    if (!availableTables || availableTables.length === 0) {
        showNotification('⚠️ No tables available. Please ask staff for table assignment or contact restaurant.', 'error');
        return;
    }
    
    showTableSelectionModal(availableTables);
}

function showTableSelectionModal(availableTables) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    let tablesHTML = '';
    availableTables.forEach(table => {
        tablesHTML += `
            <button onclick="selectTableAndContinue(${table.number})" style="
                padding: 20px;
                margin: 8px;
                border: 2px solid #E5E7EB;
                background: white;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 1rem;
                font-weight: 600;
                color: #0F172A;
                min-width: 120px;
                display: inline-block;
            " onmouseover="this.style.borderColor='#3B82F6'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.2)';" onmouseout="this.style.borderColor='#E5E7EB'; this.style.boxShadow='none';">
                🪑 Table ${table.number}
                <br><small style="color: #666; font-weight: 400;">${table.name || 'Table ' + table.number}</small>
            </button>
        `;
    });
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 16px;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0; color: #0F172A; font-size: 1.8rem;">Select Your Table</h2>
            <p style="margin: 0; color: #666; font-size: 1rem;">Choose a table number to continue with your order</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; max-height: 400px; overflow-y: auto;">
            ${tablesHTML}
        </div>
        
        <div style="text-align: center;">
            <button onclick="closeTableSelectionModal()" style="
                padding: 12px 30px;
                background: #EF4444;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: background 0.3s ease;
            " onmouseover="this.style.background='#DC2626';" onmouseout="this.style.background='#EF4444';">
                Cancel
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Close modal if clicking outside
    modalOverlay.onclick = function(e) {
        if (e.target === modalOverlay) {
            closeTableSelectionModal();
        }
    };
}

function closeTableSelectionModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'slideUp 0.3s reverse';
        setTimeout(() => modal.remove(), 300);
    }
}

function showOrderTicketModal(orderId, tableNumber, customerName, items, total) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        backdrop-filter: blur(5px);
        overflow-y: auto;
        padding: 20px;
    `;
    
    let itemsHTML = '';
    items.forEach(item => {
        itemsHTML += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: left;">${item.quantity}x ${item.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateString = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const estimatedTime = new Date(now.getTime() + 25 * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 35px;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
        animation: slideUp 0.3s ease;
        position: relative;
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 4rem; margin-bottom: 15px; animation: bounce 0.6s ease;">✅</div>
            <h2 style="margin: 0; color: #10B981; font-size: 2rem; margin-bottom: 8px; font-weight: 800;">Order Confirmed!</h2>
            <p style="margin: 0; color: #666; font-size: 1rem;">Your order has been sent to the kitchen</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #0F172A 0%, #1e293b 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px; color: white; text-align: center;">
            <div style="font-size: 0.8rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;">🎟️ Order Reference ID</div>
            <div style="font-size: 2.5rem; font-weight: 900; color: #3B82F6; font-family: 'Courier New', monospace; letter-spacing: 4px; margin-bottom: 15px; word-break: break-all;">${orderId}</div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
                    <div>
                        <div style="color: #cbd5e1; margin-bottom: 5px;">Time</div>
                        <div style="font-weight: 700; color: #fff;">${timeString}</div>
                    </div>
                    <div>
                        <div style="color: #cbd5e1; margin-bottom: 5px;">Date</div>
                        <div style="font-weight: 700; color: #fff;">${dateString}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
            <div style="background: #F0FFFE; padding: 15px; border-radius: 8px; border-left: 4px solid #10B981;">
                <div style="color: #0F172A; font-size: 0.8rem; font-weight: 600; margin-bottom: 5px;">🪑 Table Number</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #10B981;">Table ${tableNumber}</div>
            </div>
            <div style="background: #FFF7ED; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B;">
                <div style="color: #0F172A; font-size: 0.8rem; font-weight: 600; margin-bottom: 5px;">⏱️ Ready in</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #F59E0B;">${estimatedTime}</div>
            </div>
        </div>
        
        <div style="background: #F9FAFB; padding: 18px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E5E7EB;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #666; font-size: 0.9rem;">
                <span>Customer Name:</span>
                <span style="font-weight: 600; color: #0F172A;">${customerName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #666; font-size: 0.9rem;">
                <span>Total Items:</span>
                <span style="font-weight: 600; color: #0F172A;">${items.length} item${items.length !== 1 ? 's' : ''}</span>
            </div>
        </div>
        
        <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <tbody>
                ${itemsHTML}
                <tr style="background: #0F172A; color: white; font-weight: 700;">
                    <td style="padding: 14px; text-align: left; border-radius: 0 0 0 8px;">TOTAL AMOUNT</td>
                    <td style="padding: 14px; text-align: right; font-size: 1.3rem; color: #3B82F6; border-radius: 0 0 8px 0;">₹${total.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
        
        <div style="background: #ECFDF5; padding: 12px; border-radius: 8px; border-left: 4px solid #10B981; margin-bottom: 25px; font-size: 0.9rem; color: #065F46; font-weight: 500;">
            <strong>✓ Status:</strong> Your order is being prepared in the kitchen. Our staff will serve you shortly!
        </div>
        
        <button onclick="downloadOrderReceipt('${orderId}', ${tableNumber}, '${customerName}', ${JSON.stringify(items)}, ${total})" style="
            width: 100%;
            padding: 12px;
            background: #10B981;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            margin-bottom: 10px;
            transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 15px rgba(16, 185, 129, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            📥 Download Receipt as Proof
        </button>
        
        <button onclick="closeOrderTicketAndNavigate()" style="
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
            transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 20px rgba(59, 130, 246, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            Continue Ordering
        </button>
        
        <p style="text-align: center; color: #999; font-size: 0.85rem; margin-top: 15px; margin-bottom: 0; font-weight: 500;">
            📞 Show this Order ID to staff if you have any questions
        </p>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
}

function closeOrderTicketAndNavigate() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'slideUp 0.3s reverse';
        setTimeout(() => {
            modal.remove();
            // Clear cart and stay on customer menu
            app.cart = {};
            app.cartItems = [];
            // Update cart display to show empty cart
            const cartDisplay = document.getElementById('cart-items');
            if (cartDisplay) {
                updateCartDisplay();
            }
            // Refresh menu items to show updated state
            loadCustomerMenuItems();
            // Ensure customer mode is still active to prevent navigation
            app.customerMode = true;
            showNotification('Order placed! Your food is being prepared. Check the kitchen for updates.', 'success');
        }, 300);
    }
}

function downloadOrderReceipt(orderId, tableNumber, customerName, items, total) {
    try {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        let itemsHTML = '';
        items.forEach(item => {
            itemsHTML += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantity}x ${item.name}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
            `;
        });
        
        const receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Order Receipt - ${orderId}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .receipt {
                        max-width: 400px;
                        margin: 0 auto;
                        background: white;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 {
                        text-align: center;
                        color: #10B981;
                        margin-bottom: 20px;
                    }
                    .order-id {
                        text-align: center;
                        background: #F0F4F8;
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        border: 2px dashed #3B82F6;
                    }
                    .order-id .label {
                        font-size: 0.8rem;
                        color: #666;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 5px;
                    }
                    .order-id .value {
                        font-size: 1.8rem;
                        font-weight: 900;
                        color: #0F172A;
                        font-family: 'Courier New', monospace;
                        letter-spacing: 2px;
                    }
                    .details {
                        margin: 20px 0;
                        border-top: 1px solid #ddd;
                        border-bottom: 1px solid #ddd;
                        padding: 15px 0;
                    }
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        font-size: 0.9rem;
                    }
                    .detail-row .label {
                        color: #666;
                    }
                    .detail-row .value {
                        font-weight: 600;
                        color: #0F172A;
                    }
                    table {
                        width: 100%;
                        margin: 20px 0;
                        border-collapse: collapse;
                    }
                    td {
                        padding: 8px;
                        border-bottom: 1px solid #ddd;
                        font-size: 0.9rem;
                    }
                    .total-row {
                        background: #0F172A;
                        color: white;
                        font-weight: 700;
                        font-size: 1.1rem;
                    }
                    .total-row td {
                        padding: 12px;
                        border: none;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        color: #666;
                        font-size: 0.85rem;
                    }
                    .status {
                        background: #ECFDF5;
                        color: #065F46;
                        padding: 12px;
                        border-radius: 8px;
                        text-align: center;
                        margin: 15px 0;
                        border-left: 4px solid #10B981;
                        font-weight: 500;
                    }
                    @media print {
                        body {
                            background: white;
                            padding: 0;
                        }
                        .receipt {
                            box-shadow: none;
                            max-width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <h1>✅ Order Confirmed</h1>
                    
                    <div class="order-id">
                        <div class="label">🎟️ Order Reference ID</div>
                        <div class="value">${orderId}</div>
                    </div>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="label">🪑 Table Number:</span>
                            <span class="value">Table ${tableNumber}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">👤 Customer Name:</span>
                            <span class="value">${customerName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">📅 Date:</span>
                            <span class="value">${dateString}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">⏰ Time:</span>
                            <span class="value">${timeString}</span>
                        </div>
                    </div>
                    
                    <table>
                        <tbody>
                            ${itemsHTML}
                            <tr class="total-row">
                                <td>TOTAL AMOUNT</td>
                                <td style="text-align: right; color: #3B82F6;">₹${total.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="status">
                        ✓ Your order is being prepared in the kitchen
                    </div>
                    
                    <div class="footer">
                        <p><strong>Keep this receipt as proof of your order</strong></p>
                        <p>Show Order ID to staff if you have any questions</p>
                        <p style="margin-top: 15px; font-size: 0.8rem; color: #999;">Generated on ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                
                <script>
                    window.print();
                </script>
            </body>
            </html>
        `;
        
        // Create blob and download
        const blob = new Blob([receiptHTML], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Receipt-${orderId}-${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Receipt saved! Check downloads folder.', 'success');
    } catch (error) {
        console.error('Error downloading receipt:', error);
        showNotification('Failed to download receipt', 'error');
    }
}

function selectTableAndContinue(tableNumber) {
    app.selectedTable = tableNumber;
    closeTableSelectionModal();
    
    // Show customer name prompt
    const customerName = prompt('Enter your name (for kitchen reference):');
    if (!customerName) {
        app.selectedTable = null;
        return;
    }
    
    // Get the items and proceed with order placement
    proceedWithOrderPlacement(customerName);
}

async function proceedWithOrderPlacement(customerName) {
    try {
        const items = Object.values(app.cart);
        
        // Sanitize items - remove undefined values before saving to Firestore
        const sanitizedItems = items.map(item => ({
            id: item.id || '',
            name: item.name || 'Unknown Item',
            price: item.price || 0,
            category: item.category || '',
            quantity: item.quantity || 1
        }));
        
        const total = sanitizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Generate simple order number
        const orderNumber = String(app.nextOrderNumber).padStart(4, '0');
        const simpleOrderId = 'ORD-' + orderNumber;
        
        const orderRef = await db.collection('orders').add({
            restaurantId: app.currentRestaurantId,
            orderId: simpleOrderId,
            orderNumber: app.nextOrderNumber,
            tableNumber: app.selectedTable,
            customerName: customerName,
            items: sanitizedItems,
            total: total,
            status: 'pending',
            paymentStatus: 'pending',
            date: new Date().toDateString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            estimatedPrepTime: 30,
            specialInstructions: ''
        });
        
        // Increment order number for next order
        app.nextOrderNumber++;
        
        // Update table status to occupied
        if (app.currentRestaurant.tables) {
            const tableIndex = app.currentRestaurant.tables.findIndex(t => t.number === app.selectedTable);
            if (tableIndex >= 0) {
                app.currentRestaurant.tables[tableIndex].status = 'occupied';
                app.currentRestaurant.tables[tableIndex].currentOrderId = orderRef.id;
            }
        }
        
        // Clear cart
        app.cart = {};
        updateCartDisplay();
        
        // Show professional order ticket
        showOrderTicketModal(simpleOrderId, app.selectedTable, customerName, sanitizedItems, total);
        
        // Reset table selection
        app.selectedTable = null;
    } catch (error) {
        console.error('Error placing order:', error);
        showNotification('Failed to place order', 'error');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function openModal(templateId) {
    const template = document.getElementById(templateId);
    if (!template) {
        console.warn(`Template ${templateId} not found`);
        return;
    }
    
    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Clone and append modal
    const modal = template.content.cloneNode(true);
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'slideUp 0.3s reverse';
        setTimeout(() => modal.remove(), 300);
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification');
    if (!container) return;

    const template = document.getElementById('notification-template');
    const notification = template.content.cloneNode(true);
    
    const notifElement = notification.querySelector('.notification');
    notifElement.classList.add(type);
    const messageEl = notification.querySelector('#notification-message');
    if (messageEl) {
        messageEl.textContent = message;
    }
    
    container.appendChild(notification);
    
    setTimeout(() => {
        const el = document.querySelector('#notification .notification');
        if (el) {
            el.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => el.remove(), 300);
        }
    }, 4000);
}

function closeNotification(element) {
    element.style.animation = 'slideInRight 0.3s reverse';
    setTimeout(() => element.remove(), 300);
}

// ============================================
// SUCCESS SCREEN FUNCTIONS
// ============================================

function showSuccessScreen(message) {
    const container = document.getElementById('app');
    if (!container) return;
    
    const successScreen = document.createElement('div');
    successScreen.id = 'success-screen';
    successScreen.innerHTML = `
        <div class="success-screen-overlay">
            <div class="success-screen-content">
                <div class="success-spinner"></div>
                <h2 class="success-message">${message}</h2>
            </div>
        </div>
    `;
    successScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        background: rgba(255, 255, 255, 0.98);
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
    `;
    
    const overlayDiv = successScreen.querySelector('.success-screen-overlay');
    overlayDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
    `;
    
    const contentDiv = successScreen.querySelector('.success-screen-content');
    contentDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        text-align: center;
    `;
    
    const spinner = successScreen.querySelector('.success-spinner');
    spinner.style.cssText = `
        width: 60px;
        height: 60px;
        border: 4px solid #e0e7ff;
        border-top: 4px solid #3B82F6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;
    
    const msgEl = successScreen.querySelector('.success-message');
    msgEl.style.cssText = `
        font-size: 1.5rem;
        color: #0F172A;
        font-weight: 600;
        margin: 0;
        letter-spacing: -0.3px;
    `;
    
    document.body.appendChild(successScreen);
    
    // Add spin animation if not exists
    if (!document.getElementById('success-screen-styles')) {
        const style = document.createElement('style');
        style.id = 'success-screen-styles';
        style.innerHTML = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function updateSuccessScreen(message, itemName) {
    const screen = document.getElementById('success-screen');
    if (!screen) return;
    
    const spinner = screen.querySelector('.success-spinner');
    const msgEl = screen.querySelector('.success-message');
    
    // Remove spinner animation
    spinner.style.borderTop = '4px solid #10B981';
    spinner.style.animation = 'none';
    spinner.innerHTML = '✅';
    spinner.style.width = '70px';
    spinner.style.height = '70px';
    spinner.style.display = 'flex';
    spinner.style.alignItems = 'center';
    spinner.style.justifyContent = 'center';
    spinner.style.fontSize = '48px';
    spinner.style.borderRadius = '50%';
    spinner.style.background = '#F0FDF4';
    spinner.style.border = 'none';
    
    msgEl.innerHTML = `${message}<br><span style="font-size: 0.9rem; color: #64748B; font-weight: 500; margin-top: 8px; display: block;">${itemName}</span>`;
}

function hideSuccessScreen() {
    const screen = document.getElementById('success-screen');
    if (!screen) return;
    
    screen.style.opacity = '0';
    screen.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => screen.remove(), 300);
}

async function uploadImage(file, path) {
    // NOTE: If you get "User does not have permission to access" error,
    // update your Firebase Storage Rules in Firebase Console:
    // rules_version = '2';
    // service firebase.storage {
    //   match /b/{bucket}/o {
    //     match /restaurants/{restaurantId}/{allPaths=**} {
    //       allow read: if true;
    //       allow write: if request.auth != null;
    //     }
    //   }
    // }
    
    if (!firebaseInitialized || !storage) {
        console.warn('Firebase Storage not initialized, skipping image upload');
        return null;
    }

    try {
        // Compress image before upload
        const compressed = await compressImage(file);
        const storageRef = storage.ref(path + '/' + Date.now() + '.' + file.name.split('.').pop());
        const snapshot = await storageRef.put(compressed);
        return await snapshot.ref.getDownloadURL();
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > 1200) {
                    height = (height * 1200) / width;
                    width = 1200;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
        };
    });
}

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// FAQ MANAGEMENT
// ============================================

function toggleFAQ(element) {
    const faqItem = element.closest('.faq-item');
    const wasActive = faqItem.classList.contains('active');
    
    // Close all FAQs
    document.querySelectorAll('.faq-item.active').forEach(item => {
        item.classList.remove('active');
    });
    
    // Open clicked FAQ if it wasn't active
    if (!wasActive) {
        faqItem.classList.add('active');
    }
}

// ============================================
// STAFF MANAGEMENT
// ============================================

async function loadStaff() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const staffSnapshot = await db.collection('staff')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        const staffList = document.getElementById('staff-list');
        
        if (staffSnapshot.empty) {
            staffList.innerHTML = '<p class="empty-state">No staff members added yet</p>';
            return;
        }
        
        let html = '';
        staffSnapshot.forEach(doc => {
            const staff = doc.data();
            html += `
                <div class="staff-item">
                    <div class="staff-info">
                        <h3>${staff.name}</h3>
                        <p>${staff.position}</p>
                        <p>${staff.phone}</p>
                    </div>
                    <div class="staff-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editStaff('${doc.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteStaff('${doc.id}')">Delete</button>
                    </div>
                </div>
            `;
        });
        
        staffList.innerHTML = html;
    } catch (error) {
        console.error('Error loading staff:', error);
        showNotification('Error loading staff members', 'error');
    }
}

async function saveStaff() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const name = document.getElementById('staffName').value.trim();
        const position = document.getElementById('staffPosition').value;
        const phone = document.getElementById('staffPhone').value.trim();
        const email = document.getElementById('staffEmail').value.trim();
        const status = document.getElementById('staffStatus').value;
        
        if (!name || !position || !phone) {
            showNotification('Please fill all required fields', 'error');
            return;
        }
        
        const staffData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            position: position,
            phone: phone,
            email: email,
            status: status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('staff').add(staffData);
        showNotification('Staff member added successfully', 'success');
        closeModal();
        loadStaff();
    } catch (error) {
        console.error('Error saving staff:', error);
        showNotification('Error adding staff member', 'error');
    }
}

async function deleteStaff(staffId) {
    if (confirm('Are you sure you want to delete this staff member?')) {
        try {
            await db.collection('staff').doc(staffId).delete();
            showNotification('Staff member deleted', 'success');
            loadStaff();
        } catch (error) {
            console.error('Error deleting staff:', error);
            showNotification('Error deleting staff member', 'error');
        }
    }
}

// ============================================
// OFFERS & COUPONS MANAGEMENT
// ============================================

async function saveOffer() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const name = document.getElementById('offerName').value.trim();
        const type = document.getElementById('offerType').value;
        const value = parseFloat(document.getElementById('offerValue').value);
        const minOrder = parseFloat(document.getElementById('offerMinOrder').value) || 0;
        const startDate = document.getElementById('offerStartDate').value;
        const endDate = document.getElementById('offerEndDate').value;
        const description = document.getElementById('offerDescription').value.trim();
        const isActive = document.getElementById('offerActive').checked;
        
        if (!name || !type || !value || !startDate || !endDate) {
            showNotification('Please fill all required fields', 'error');
            return;
        }
        
        const offerData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            discountType: type,
            discountValue: value,
            minimumOrder: minOrder,
            startDate: startDate,
            endDate: endDate,
            description: description,
            isActive: isActive,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('offers').add(offerData);
        showNotification('Offer created successfully', 'success');
        closeModal();
        loadOffers();
    } catch (error) {
        console.error('Error saving offer:', error);
        showNotification('Error creating offer', 'error');
    }
}

async function deleteOffer(offerId) {
    if (confirm('Are you sure you want to delete this offer?')) {
        try {
            await db.collection('offers').doc(offerId).delete();
            showNotification('Offer deleted', 'success');
            loadOffers();
        } catch (error) {
            console.error('Error deleting offer:', error);
            showNotification('Error deleting offer', 'error');
        }
    }
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function loadSettings() {
    try {
        if (!firebaseInitialized || !app.currentRestaurant) return;
        
        const restaurant = app.currentRestaurant;
        
        document.getElementById('settingsRestaurantName').value = restaurant.name || '';
        document.getElementById('settingsDescription').value = restaurant.description || '';
        document.getElementById('settingsPhone').value = restaurant.phone || '';
        document.getElementById('settingsWhatsapp').value = restaurant.whatsapp || '';
        document.getElementById('settingsEmail').value = restaurant.email || '';
        document.getElementById('settingsInstagram').value = restaurant.instagram || '';
        document.getElementById('settingsFacebook').value = restaurant.facebook || '';
        document.getElementById('settingsWebsite').value = restaurant.website || '';
        document.getElementById('settingsOpeningTime').value = restaurant.openingTime || '';
        document.getElementById('settingsClosingTime').value = restaurant.closingTime || '';
        
        // Load subscription info
        if (restaurant.subscription) {
            const subInfo = document.getElementById('subscription-info');
            const subStatus = restaurant.subscription.status;
            const subEndDate = formatDate(restaurant.subscription.expiryDate);
            const isExpired = isSubscriptionExpired(restaurant);
            const displayStatus = isExpired ? 'expired' : subStatus;
            
            subInfo.innerHTML = `
                <p><strong>Status:</strong> <span style="color: ${isExpired ? 'var(--danger)' : (subStatus === 'active' ? 'var(--success)' : 'var(--danger)')}">${displayStatus === 'active' ? '✓ Active' : (isExpired ? '✗ Expired' : 'INACTIVE')}</span></p>
                <p><strong>Plan:</strong> ${restaurant.subscription.plan || 'Premium'}</p>
                <p><strong>Renewal Date:</strong> ${subEndDate}</p>
                <p><strong>Price:</strong> ₹${restaurant.subscription.monthlyAmount || '499'}/month</p>
            `;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('Error loading settings', 'error');
    }
}

async function saveSettings() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const updateData = {
            name: document.getElementById('settingsRestaurantName').value,
            description: document.getElementById('settingsDescription').value,
            phone: document.getElementById('settingsPhone').value,
            whatsapp: document.getElementById('settingsWhatsapp').value,
            email: document.getElementById('settingsEmail').value,
            instagram: document.getElementById('settingsInstagram').value,
            facebook: document.getElementById('settingsFacebook').value,
            website: document.getElementById('settingsWebsite').value,
            openingTime: document.getElementById('settingsOpeningTime').value,
            closingTime: document.getElementById('settingsClosingTime').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('restaurants').doc(app.currentRestaurantId).update(updateData);
        
        // Update local state
        app.currentRestaurant = { ...app.currentRestaurant, ...updateData };
        
        showNotification('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings', 'error');
    }
}

function manageSubscription() {
    // Open subscription management modal
    showNotification('Subscription management coming soon', 'info');
}

// ============================================
// RESTAURANT OPENING/CLOSING SYSTEM
// ============================================

async function updateRestaurantHours() {
    try {
        const openingTime = document.getElementById('settingsOpeningTime').value;
        const closingTime = document.getElementById('settingsClosingTime').value;
        
        if (!openingTime || !closingTime) {
            showNotification('Please set both opening and closing times', 'error');
            return;
        }
        
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            openingTime: openingTime,
            closingTime: closingTime,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        app.currentRestaurant.openingTime = openingTime;
        app.currentRestaurant.closingTime = closingTime;
        
        showNotification('Restaurant hours updated successfully', 'success');
    } catch (error) {
        console.error('Error updating hours:', error);
        showNotification('Error updating restaurant hours', 'error');
    }
}

function isRestaurantOpen() {
    if (!app.currentRestaurant) return true;
    
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const opening = app.currentRestaurant.openingTime || '09:00';
    const closing = app.currentRestaurant.closingTime || '23:00';
    
    const currentDay = now.getDay();
    const weeklyHolidays = app.currentRestaurant.weeklyHolidays || [];
    
    // Check if today is a weekly holiday
    if (weeklyHolidays.includes(currentDay)) {
        return false;
    }
    
    // Check special holidays
    const today = new Date().toISOString().split('T')[0];
    const specialHolidays = app.currentRestaurant.specialHolidays || [];
    if (specialHolidays.includes(today)) {
        return false;
    }
    
    // Check if restaurant is manually closed
    if (app.currentRestaurant.isClosed) {
        return false;
    }
    
    // Compare times
    return currentTime >= opening && currentTime <= closing;
}

function getRestaurantStatus() {
    if (!isRestaurantOpen()) {
        const closing = app.currentRestaurant.closingTime || '23:00';
        return {
            isOpen: false,
            message: `Restaurant Closed • Opens at ${app.currentRestaurant.openingTime || '09:00'}`
        };
    }
    
    return {
        isOpen: true,
        message: 'Restaurant Open • Accepting Orders'
    };
}

async function setRestaurantClosed(reason = 'temporary') {
    try {
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            isClosed: true,
            closedReason: reason,
            closedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        app.currentRestaurant.isClosed = true;
        app.currentRestaurant.closedReason = reason;
        
        showNotification('Restaurant marked as closed', 'success');
    } catch (error) {
        console.error('Error closing restaurant:', error);
        showNotification('Error updating restaurant status', 'error');
    }
}

async function reopenRestaurant() {
    try {
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            isClosed: false,
            closedReason: null,
            closedAt: null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        app.currentRestaurant.isClosed = false;
        app.currentRestaurant.closedReason = null;
        
        showNotification('Restaurant is now open', 'success');
    } catch (error) {
        console.error('Error reopening restaurant:', error);
        showNotification('Error updating restaurant status', 'error');
    }
}

async function addSpecialHoliday(date) {
    try {
        const specialHolidays = app.currentRestaurant.specialHolidays || [];
        if (!specialHolidays.includes(date)) {
            specialHolidays.push(date);
            
            await db.collection('restaurants').doc(app.currentRestaurantId).update({
                specialHolidays: specialHolidays,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            app.currentRestaurant.specialHolidays = specialHolidays;
            showNotification('Special holiday added', 'success');
        }
    } catch (error) {
        console.error('Error adding special holiday:', error);
        showNotification('Error adding special holiday', 'error');
    }
}

async function removeSpecialHoliday(date) {
    try {
        const specialHolidays = app.currentRestaurant.specialHolidays || [];
        const index = specialHolidays.indexOf(date);
        if (index > -1) {
            specialHolidays.splice(index, 1);
            
            await db.collection('restaurants').doc(app.currentRestaurantId).update({
                specialHolidays: specialHolidays,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            app.currentRestaurant.specialHolidays = specialHolidays;
            showNotification('Special holiday removed', 'success');
        }
    } catch (error) {
        console.error('Error removing special holiday:', error);
        showNotification('Error removing special holiday', 'error');
    }
}

// ============================================
// SETTINGS PAGE
// ============================================

async function loadSettingsPage() {
    try {
        if (!app.currentRestaurant) return;
        
        // Load basic info - with null checks
        const settingsRestaurantName = document.getElementById('settingsRestaurantName');
        const settingsDescription = document.getElementById('settingsDescription');
        const settingsPhone = document.getElementById('settingsPhone');
        const settingsWhatsapp = document.getElementById('settingsWhatsapp');
        const settingsEmail = document.getElementById('settingsEmail');
        const settingsInstagram = document.getElementById('settingsInstagram');
        const settingsFacebook = document.getElementById('settingsFacebook');
        const settingsWebsite = document.getElementById('settingsWebsite');
        const settingsOpeningTime = document.getElementById('settingsOpeningTime');
        const settingsClosingTime = document.getElementById('settingsClosingTime');
        
        if (settingsRestaurantName) settingsRestaurantName.value = app.currentRestaurant.name || '';
        if (settingsDescription) settingsDescription.value = app.currentRestaurant.description || '';
        if (settingsPhone) settingsPhone.value = app.currentRestaurant.phone || '';
        if (settingsWhatsapp) settingsWhatsapp.value = app.currentRestaurant.whatsapp || '';
        if (settingsEmail) settingsEmail.value = app.currentRestaurant.email || '';
        if (settingsInstagram) settingsInstagram.value = app.currentRestaurant.instagram || '';
        if (settingsFacebook) settingsFacebook.value = app.currentRestaurant.facebook || '';
        if (settingsWebsite) settingsWebsite.value = app.currentRestaurant.website || '';
        if (settingsOpeningTime) settingsOpeningTime.value = app.currentRestaurant.openingTime || '09:00';
        if (settingsClosingTime) settingsClosingTime.value = app.currentRestaurant.closingTime || '23:00';
        
        // Load table settings - IMPORTANT: This must be called and awaited
        await loadTableSettings();
        
        // Load subscription info
        const subInfo = document.getElementById('subscription-info');
        if (subInfo) {
            const sub = app.currentRestaurant.subscription || {};
            const status = sub.status === 'active' ? '✓ Active' : '⏳ Inactive';
            const plan = sub.plan || 'basic';
            const activatedDate = sub.activatedAt ? (typeof sub.activatedAt.toDate === 'function' ? new Date(sub.activatedAt.toDate()).toLocaleDateString() : new Date(sub.activatedAt).toLocaleDateString()) : 'N/A';
            subInfo.innerHTML = `
                <div style="padding: 15px; background: var(--light-gray); border-radius: var(--radius); margin-bottom: 15px;">
                    <p style="margin: 8px 0;"><strong>Status:</strong> ${status}</p>
                    <p style="margin: 8px 0;"><strong>Plan:</strong> ${plan}</p>
                    <p style="margin: 8px 0;"><strong>Since:</strong> ${activatedDate}</p>
                </div>
            `;
        }
        
        console.log('Settings page loaded successfully. Tables:', app.currentRestaurant.tables);
    } catch (error) {
        console.error('Error loading settings page:', error);
        showNotification('Error loading settings page: ' + error.message, 'error');
    }
}

// Dashboard-specific settings loader
async function loadDashboardSettings() {
    try {
        if (!app.currentRestaurant) {
            console.warn('No current restaurant');
            return;
        }
        
        console.log('Loading dashboard settings...');
        
        // Load restaurant profile info
        const settingName = document.getElementById('setting-name');
        const settingDescription = document.getElementById('setting-description');
        const planName = document.getElementById('plan-name');
        const renewalDate = document.getElementById('renewal-date');
        
        if (settingName) settingName.value = app.currentRestaurant.name || '';
        if (settingDescription) settingDescription.value = app.currentRestaurant.description || '';
        
        // Load subscription info
        if (app.currentRestaurant.subscription) {
            if (planName) planName.textContent = app.currentRestaurant.subscription.plan || 'Premium';
            if (renewalDate) renewalDate.textContent = formatDate(app.currentRestaurant.subscription.expiryDate);
        }
        
        // Load table settings
        await loadTableSettings();
        
        console.log('Dashboard settings loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard settings:', error);
    }
}

// ============================================
// TABLE MANAGEMENT
// ============================================

async function loadTableSettings() {
    try {
        console.log('Loading table settings...');
        if (!app.currentRestaurant) {
            console.warn('No current restaurant');
            return;
        }
        
        // Wait for DOM elements to be available - increased timeout for safety
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const input = document.getElementById('tableCountInput');
        const tablesList = document.getElementById('tables-list');
        
        // Log detailed debugging info
        console.log('DOM Check - Input element found:', !!input);
        console.log('DOM Check - TablesList element found:', !!tablesList);
        
        if (!input || !tablesList) {
            console.warn('Table settings elements not found in DOM. This may be expected if not in settings page.');
            return;
        }
        
        // Set tableCount input value
        const tableCount = app.currentRestaurant.tableCount || 10;
        input.value = tableCount;
        
        console.log('Current tables:', app.currentRestaurant.tables);
        
        // Initialize tables array if it doesn't exist or is empty
        if (!app.currentRestaurant.tables || app.currentRestaurant.tables.length === 0) {
            console.log('Initializing new tables...');
            const tables = [];
            for (let i = 1; i <= tableCount; i++) {
                tables.push({
                    number: i,
                    name: `Table ${i}`,
                    status: 'available',
                    enabled: true,
                    active: false
                });
            }
            app.currentRestaurant.tables = tables;
            
            // Save to Firebase
            try {
                if (firebaseInitialized && db && app.currentRestaurantId) {
                    await db.collection('restaurants').doc(app.currentRestaurantId).update({
                        tables: tables,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('Tables saved to Firebase');
                }
            } catch (error) {
                console.error('Error saving tables to Firebase:', error);
                // Continue anyway - tables are at least in memory
            }
        }
        
        // Render the tables list
        console.log('Rendering tables list...');
        renderTablesList();
        console.log('Table settings loaded successfully');
        
    } catch (error) {
        console.error('Error loading table settings:', error);
        showNotification('Error loading table settings: ' + error.message, 'error');
    }
}

function renderTablesList() {
    try {
        const container = document.getElementById('tables-list');
        
        if (!container) {
            console.warn('tables-list container not found');
            return;
        }
        
        if (!app.currentRestaurant || !app.currentRestaurant.tables) {
            console.warn('No tables to render');
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No tables configured. Update the total tables count above.</p>';
            return;
        }
        
        const tables = app.currentRestaurant.tables || [];
        
        if (tables.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No tables configured. Update the total tables count above and click Update.</p>';
            return;
        }
        
        let html = '<div class="tables-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">';
        
        tables.forEach((table, idx) => {
            const statusColors = {
                'available': { bg: '#DCFCE7', text: '#166534', icon: '✓' },
                'occupied': { bg: '#FEE2E2', text: '#991B1B', icon: '🍴' },
                'reserved': { bg: '#FEF08A', text: '#854D0E', icon: '🔔' },
                'disabled': { bg: '#F3F4F6', text: '#6B7280', icon: '⛔' }
            };
            
            const currentStatus = table.status || (table.enabled ? 'available' : 'disabled');
            const statusInfo = statusColors[currentStatus] || statusColors.available;
            const statusLabel = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
            
            const orderInfo = table.currentOrderId ? `<div style="font-size: 0.85rem; color: #666; margin-top: 4px;">Order: ${table.currentOrderId}</div>` : '';
            const lastOrder = table.lastOrderTime ? `<div style="font-size: 0.75rem; color: #999;">Last: ${new Date(table.lastOrderTime).toLocaleTimeString()}</div>` : '';
            
            html += `
                <div class="table-card premium-card" style="border-left: 4px solid ${statusInfo.bg}; display: flex; flex-direction: column; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #0F172A;">${table.name || `Table ${table.number}`}</div>
                            <div style="font-size: 0.85rem; color: #666; margin-top: 2px;">Table #${table.number}</div>
                        </div>
                        <span style="font-size: 1.2rem;">${statusInfo.icon}</span>
                    </div>
                    
                    <div style="padding: 8px; background: ${statusInfo.bg}; color: ${statusInfo.text}; border-radius: 6px; font-size: 0.85rem; font-weight: 600; text-align: center; margin-bottom: 10px;">${statusLabel}</div>
                    
                    ${orderInfo}
                    ${lastOrder}
                    
                    <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #E5E7EB;">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 8px;">
                            <button class="btn btn-sm" style="font-size: 0.75rem; padding: 6px 8px;" onclick="setTableStatus(${idx}, 'available')">Available</button>
                            <button class="btn btn-sm" style="font-size: 0.75rem; padding: 6px 8px;" onclick="setTableStatus(${idx}, 'occupied')">Occupied</button>
                            <button class="btn btn-sm" style="font-size: 0.75rem; padding: 6px 8px;" onclick="setTableStatus(${idx}, 'reserved')">Reserved</button>
                            <button class="btn btn-sm" style="font-size: 0.75rem; padding: 6px 8px;" onclick="setTableStatus(${idx}, 'disabled')">Disabled</button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                            <button class="btn btn-sm btn-primary" style="font-size: 0.75rem; padding: 6px 8px;" onclick="editTableName(${idx})">✏️ Edit</button>
                            <button class="btn btn-sm" style="font-size: 0.75rem; padding: 6px 8px;" onclick="toggleTableStatus(${idx})">${table.enabled ? '🔒 Lock' : '🔓 Unlock'}</button>
                            <button class="btn btn-sm btn-danger" style="font-size: 0.75rem; padding: 6px 8px;" onclick="deleteTable(${idx})">🗑️ Delete</button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        console.log('Rendered ' + tables.length + ' tables');
        
    } catch (error) {
        console.error('Error rendering tables list:', error);
        const container = document.getElementById('tables-list');
        if (container) {
            container.innerHTML = '<p style="color: #d32f2f; padding: 20px;">Error loading tables: ' + error.message + '</p>';
        }
    }
}

async function updateTableCount() {
    try {
        const count = parseInt(document.getElementById('tableCountInput').value);
        
        if (!count || count < 1 || count > 99) {
            showNotification('Please enter a valid number between 1 and 99', 'error');
            return;
        }
        
        // Reinitialize tables array with status field
        const newTables = [];
        for (let i = 1; i <= count; i++) {
            newTables.push({
                number: i,
                name: `Table ${i}`,
                status: 'available',
                enabled: true,
                active: false
            });
        }
        
        // Update in memory
        app.currentRestaurant.tableCount = count;
        app.currentRestaurant.tables = newTables;
        
        // Update restaurant document in Firebase
        if (firebaseInitialized && db && app.currentRestaurantId) {
            await db.collection('restaurants').doc(app.currentRestaurantId).update({
                tableCount: count,
                tables: newTables,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        renderTablesList();
        showNotification(`✓ Updated to ${count} tables`, 'success');
        console.log('Table count updated to:', count);
    } catch (error) {
        console.error('Error updating table count:', error);
        showNotification('Error updating table count: ' + error.message, 'error');
    }
}

function addNewTable() {
    const currentTables = app.currentRestaurant.tables || [];
    const nextNumber = Math.max(...currentTables.map(t => t.number), 0) + 1;
    
    const newTable = {
        number: nextNumber,
        name: `Table ${nextNumber}`,
        enabled: true,
        active: false
    };
    
    app.currentRestaurant.tables = [...currentTables, newTable];
    renderTablesList();
    showNotification('Table added', 'success');
}

function editTableName(index) {
    const table = app.currentRestaurant.tables[index];
    if (!table) return;
    
    const newName = prompt('Enter table name:', table.name);
    if (newName && newName.trim()) {
        table.name = newName.trim();
        renderTablesList();
        showNotification('Table name updated', 'success');
    }
}

function toggleTableStatus(index) {
    const table = app.currentRestaurant.tables[index];
    if (!table) return;
    
    table.enabled = !table.enabled;
    renderTablesList();
    showNotification(`Table ${table.enabled ? 'enabled' : 'disabled'}`, 'success');
}

function deleteTable(index) {
    if (!confirm('Delete this table?')) return;
    
    app.currentRestaurant.tables.splice(index, 1);
    renderTablesList();
    showNotification('Table deleted', 'success');
}

function setTableStatus(index, status) {
    const table = app.currentRestaurant.tables[index];
    if (!table) return;
    
    table.status = status;
    table.lastStatusChange = new Date().toISOString();
    renderTablesList();
    saveTables();
}

function addTableManually() {
    const name = prompt('Enter table name/number:');
    if (!name) return;
    
    const currentTables = app.currentRestaurant.tables || [];
    const maxNumber = Math.max(...currentTables.map(t => t.number || 0), 0);
    
    const newTable = {
        number: maxNumber + 1,
        name: name.trim(),
        status: 'available',
        enabled: true,
        createdAt: new Date().toISOString()
    };
    
    app.currentRestaurant.tables = [...currentTables, newTable];
    renderTablesList();
    showNotification('Table added successfully', 'success');
    saveTables();
}

async function saveTables() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            tables: app.currentRestaurant.tables || [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('Table configuration saved', 'success');
    } catch (error) {
        console.error('Error saving tables:', error);
        showNotification('Error saving tables', 'error');
    }
}

// ============================================
// ENHANCED CATEGORY MANAGEMENT
// ============================================

async function loadCategories() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const snapshot = await db.collection('categories')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('position', 'asc')
            .get();
        
        app.categories = [];
        
        // Try to find the list element with multiple methods
        let list = document.getElementById('categories-list');
        if (!list) list = document.querySelector('.categories-list');
        if (!list) {
            console.warn('Categories list element not found in DOM');
            return;
        }
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No categories yet. Create one to get started!</p><button class="btn btn-primary" onclick="openAddCategoryModal()">+ Add Category</button></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const cat = doc.data();
            app.categories.push({ id: doc.id, ...cat });
            
            const card = document.createElement('div');
            card.className = 'category-card premium-card';
            card.draggable = true;
            card.dataset.categoryId = doc.id;
            card.style.cssText = 'padding: 16px; background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%); border: 1px solid #7dd3fc; border-radius: 8px; cursor: move; transition: all 0.2s; display: flex; flex-direction: column;';
            
            // Drag event listeners
            card.addEventListener('dragstart', (e) => {
                app.draggedItem = { id: doc.id, type: 'category', index: app.categories.findIndex(c => c.id === doc.id) };
                card.style.opacity = '0.6';
                e.dataTransfer.effectAllowed = 'move';
            });
            
            card.addEventListener('dragend', () => {
                card.style.opacity = '1';
            });
            
            // Add hover effects
            card.addEventListener('mouseenter', () => {
                card.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.15)';
                card.style.transform = 'translateY(-2px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = 'none';
                card.style.transform = 'translateY(0)';
            });
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.style.borderTop = '3px solid #3B82F6';
            });
            
            card.addEventListener('dragleave', () => {
                card.style.borderTop = 'none';
            });
            
            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                card.style.borderTop = 'none';
                
                if (app.draggedItem && app.draggedItem.type === 'category') {
                    const draggedIndex = app.draggedItem.index;
                    const targetIndex = app.categories.findIndex(c => c.id === doc.id);
                    
                    if (draggedIndex !== targetIndex) {
                        // Swap positions
                        const temp = app.categories[draggedIndex].position;
                        app.categories[draggedIndex].position = app.categories[targetIndex].position;
                        app.categories[targetIndex].position = temp;
                        
                        // Update in Firestore
                        await db.collection('categories').doc(app.categories[draggedIndex].id).update({
                            position: app.categories[draggedIndex].position
                        });
                        await db.collection('categories').doc(app.categories[targetIndex].id).update({
                            position: app.categories[targetIndex].position
                        });
                        
                        loadCategories();
                    }
                }
            });
            
            card.innerHTML = `
                <div class="category-header">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                        <span style="cursor: move; color: #cbd5e1; font-size: 1.3rem; font-weight: bold;">⋮⋮</span>
                        <div class="category-info">
                            <h3 style="margin: 0 0 4px 0; color: #0f172a; font-size: 1.05rem; font-weight: 600;">${cat.name}</h3>
                            <p style="margin: 0; color: #64748b; font-size: 0.9rem;">${cat.description || 'No description added'}</p>
                        </div>
                    </div>
                    <span class="badge" style="background: ${cat.hidden ? '#ef4444' : '#10b981'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">${cat.hidden ? '🙈 Hidden' : '👁️ Visible'}</span>
                </div>
                <div class="category-stats" style="display: flex; gap: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; margin-top: 12px;">
                    <div class="stat" style="flex: 1; text-align: center;">
                        <span class="stat-label" style="display: block; color: #64748b; font-size: 0.85rem; margin-bottom: 4px;">Items</span>
                        <span class="stat-value" style="display: block; color: #0f172a; font-size: 1.3rem; font-weight: 700;">0</span>
                    </div>
                </div>
                <div class="category-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                    <button class="btn btn-primary btn-sm" onclick="editCategory('${doc.id}')" style="padding: 8px; font-size: 0.85rem;">📝 Edit</button>
                    <button class="btn btn-sm" onclick="duplicateCategory('${doc.id}')" style="padding: 8px; font-size: 0.85rem;">📋 Copy</button>
                    <button class="btn btn-sm" onclick="toggleCategoryVisibility('${doc.id}', ${cat.hidden})" style="padding: 8px; font-size: 0.85rem;">${cat.hidden ? '👁️ Show' : '🙈 Hide'}</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteCategory('${doc.id}')" style="padding: 8px; font-size: 0.85rem;">🗑️ Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('Error loading categories', 'error');
    }
}

async function openAddCategoryModal() {
    openCategoryModal();
}

async function editCategory(categoryId) {
    let cat = app.categories.find(c => c.id === categoryId);
    
    // If not in app state, fetch from Firebase
    if (!cat) {
        try {
            const catDoc = await db.collection('categories').doc(categoryId).get();
            if (catDoc.exists) {
                cat = { id: categoryId, ...catDoc.data() };
            } else {
                showNotification('Category not found', 'error');
                return;
            }
        } catch (error) {
            console.error('Error fetching category:', error);
            showNotification('Error loading category', 'error');
            return;
        }
    }
    
    if (!cat) return;
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
    `;
    
    modalContent.innerHTML = `
        <h2 style="margin: 0 0 20px 0; color: #0F172A;">Edit Category</h2>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Category Name *</label>
            <input type="text" id="edit-cat-name" value="${cat.name}" style="
                width: 100%;
                padding: 12px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
            " />
        </div>
        
        <div style="margin-bottom: 30px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Description</label>
            <textarea id="edit-cat-desc" style="
                width: 100%;
                padding: 12px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 1rem;
                font-family: inherit;
                resize: vertical;
                min-height: 100px;
                box-sizing: border-box;
            ">${cat.description || ''}</textarea>
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button onclick="document.querySelector('.modal-overlay').remove()" style="
                flex: 1;
                padding: 12px;
                background: #E5E7EB;
                color: #0F172A;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.3s;
            " onmouseover="this.style.background='#D1D5DB'" onmouseout="this.style.background='#E5E7EB'">Cancel</button>
            <button onclick="saveCategoryEdit('${categoryId}')" style="
                flex: 1;
                padding: 12px;
                background: #3B82F6;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.3s;
            " onmouseover="this.style.background='#2563EB'" onmouseout="this.style.background='#3B82F6'">Save Changes</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };
    document.body.appendChild(modalOverlay);
}

async function saveCategoryEdit(categoryId) {
    const newName = document.getElementById('edit-cat-name').value.trim();
    const newDesc = document.getElementById('edit-cat-desc').value.trim();
    
    if (!newName) {
        showNotification('Category name cannot be empty', 'error');
        return;
    }
    
    try {
        await db.collection('categories').doc(categoryId).update({
            name: newName,
            description: newDesc,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        document.querySelector('.modal-overlay').remove();
        loadCategories();
        showNotification('Category updated successfully', 'success');
    } catch (error) {
        console.error('Error editing category:', error);
        showNotification('Error editing category', 'error');
    }
}

async function toggleCategoryVisibility(categoryId, isHidden) {
    try {
        await db.collection('categories').doc(categoryId).update({
            hidden: !isHidden,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadCategories();
        showNotification(isHidden ? 'Category is now visible' : 'Category is now hidden', 'success');
    } catch (error) {
        console.error('Error toggling visibility:', error);
        showNotification('Error updating category', 'error');
    }
}

async function confirmDeleteCategory(categoryId) {
    if (!confirm('Are you sure? Foods in this category will not be deleted.')) return;
    
    try {
        await db.collection('categories').doc(categoryId).delete();
        loadCategories();
        showNotification('Category deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting category:', error);
        showNotification('Error deleting category', 'error');
    }
}

async function duplicateCategory(categoryId) {
    const cat = app.categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    try {
        const newName = cat.name + ' (Copy)';
        
        await db.collection('categories').add({
            restaurantId: app.currentRestaurantId,
            name: newName,
            description: cat.description || '',
            hidden: false,
            position: app.categories.length,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Also duplicate all foods in this category
        const foodsSnapshot = await db.collection('foods')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('category', '==', cat.name)
            .get();
        
        foodsSnapshot.forEach(async (foodDoc) => {
            const food = foodDoc.data();
            const newFood = { ...food };
            delete newFood.id;
            newFood.name = food.name + ' (Copy)';
            newFood.category = newName;
            newFood.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            
            await db.collection('foods').add(newFood);
        });
        
        loadCategories();
        showNotification('Category and its foods duplicated successfully', 'success');
    } catch (error) {
        console.error('Error duplicating category:', error);
        showNotification('Error duplicating category', 'error');
    }
}

// ============================================
// ENHANCED FOOD MANAGEMENT
// ============================================

async function loadFoods() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const snapshot = await db.collection('foods')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('createdAt', 'desc')
            .get();
        
        app.foods = [];
        
        // Try to find the list element with multiple methods
        let list = document.getElementById('foods-list');
        if (!list) list = document.querySelector('.foods-list');
        if (!list) {
            console.warn('Foods list element not found in DOM');
            return;
        }
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍽️</div>
                    <p><strong>No food items yet</strong></p>
                    <p style="font-size: 0.9rem; margin-bottom: 20px;">Start by adding your first dish to your menu</p>
                    <button class="btn btn-primary" onclick="openFoodModal()">+ Add Food Item</button>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const food = doc.data();
            app.foods.push({ id: doc.id, ...food });
            
            const availability = food.availability || (food.outOfStock ? 'outOfStock' : (food.archived ? 'archived' : 'available'));
            const isArchived = availability === 'archived' || food.archived;
            const card = document.createElement('div');
            card.className = 'food-card premium-card';
            card.draggable = true;
            card.dataset.foodId = doc.id;
            card.style.opacity = isArchived ? '0.6' : '1';
            
            // Drag event listeners for foods
            card.addEventListener('dragstart', (e) => {
                app.draggedItem = { id: doc.id, type: 'food', food: food };
                card.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            
            card.addEventListener('dragend', () => {
                card.style.opacity = isArchived ? '0.6' : '1';
            });
            
            // Add hover effects
            card.addEventListener('mouseenter', () => {
                card.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                card.style.transform = 'translateY(-4px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = 'var(--shadow-sm)';
                card.style.transform = 'translateY(0)';
            });
            
            let badgesHTML = '';
            if (food.veg) badgesHTML += '<span class="badge-veg">🥬 Veg</span>';
            if (food.nonVeg) badgesHTML += '<span class="badge-nonveg">🍗 Non-Veg</span>';
            if (food.bestseller) badgesHTML += '<span class="badge-bestseller">⭐ Bestseller</span>';
            if (food.recommended) badgesHTML += '<span class="badge-recommended">💎 Recommended</span>';
            if (food.chefSpecial) badgesHTML += '<span class="badge-special">👨‍🍳 Chef Special</span>';
            if (food.todaySpecial) badgesHTML += '<span class="badge-today">📅 Today Special</span>';
            
            // Add availability badges
            if (availability === 'outOfStock') badgesHTML += '<span class="badge-outofstock">❌ Out of Stock</span>';
            if (availability === 'coming soon') badgesHTML += '<span class="badge-soon">⏰ Coming Soon</span>';
            if (availability === 'seasonal') badgesHTML += '<span class="badge-seasonal">🌿 Seasonal</span>';
            if (isArchived) badgesHTML += '<span class="badge-archived">📦 Archived</span>';
            
            card.innerHTML = `
                <div class="food-image-container">
                    ${food.images && food.images.length > 0 ? `<img src="${food.images[0]}" alt="${food.name}" class="food-image" loading="lazy">` : '<div class="food-image-placeholder">🍽️</div>'}
                    <div class="food-badges">
                        ${badgesHTML}
                    </div>
                </div>
                <div class="food-info">
                    <h4>${food.name}</h4>
                    <p class="food-category">${food.category}</p>
                    <p class="food-description">${food.shortDescription || ''}</p>
                    <div class="food-pricing">
                        <span class="price">₹${food.price}</span>
                        ${food.discountPrice ? `<span class="original-price">₹${food.discountPrice}</span>` : ''}
                    </div>
                    ${food.preparationTime ? `<div class="prep-time">⏱️ ${food.preparationTime} min</div>` : ''}
                </div>
                <div class="food-actions">
                    <button class="btn btn-primary btn-sm" onclick="editFood('${doc.id}')">📝 Edit</button>
                    <button class="btn btn-sm" onclick="duplicateFood('${doc.id}')">📋 Duplicate</button>
                    <button class="btn btn-sm" onclick="showAvailabilityOptions('${doc.id}')" title="Change availability">📊 Availability</button>
                    <button class="btn btn-sm" onclick="toggleFoodVisibility('${doc.id}', ${food.hidden})">${food.hidden ? '👁️ Show' : '🙈 Hide'}</button>
                    ${!isArchived ? `<button class="btn btn-warning btn-sm" onclick="archiveFood('${doc.id}')">📦 Archive</button>` : `<button class="btn btn-success btn-sm" onclick="restoreFood('${doc.id}')">♻️ Restore</button>`}
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteFood('${doc.id}')">🗑️ Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading foods:', error);
        showNotification('Error loading foods', 'error');
    }
}

async function openAddFoodModal() {
    openFoodModal();
}

async function editFood(foodId) {
    let food = app.foods.find(f => f.id === foodId);
    
    // If not in app state, fetch from Firebase
    if (!food) {
        try {
            const foodDoc = await db.collection('foods').doc(foodId).get();
            if (foodDoc.exists) {
                food = { id: foodId, ...foodDoc.data() };
            } else {
                showNotification('Food item not found', 'error');
                return;
            }
        } catch (error) {
            console.error('Error fetching food:', error);
            showNotification('Error loading food item', 'error');
            return;
        }
    }
    
    if (!food) return;
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
        overflow-y: auto;
        padding: 20px;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        max-width: 700px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
        margin: auto;
    `;
    
    const currentImage = food.images && food.images.length > 0 ? food.images[0] : (food.image ? food.image : null);
    
    modalContent.innerHTML = `
        <h2 style="margin: 0 0 30px 0; color: #0F172A;">Edit Food Item</h2>
        
        <div style="margin-bottom: 25px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Food Image</label>
            <div style="position: relative; margin-bottom: 12px;">
                ${currentImage ? `<img id="edit-current-image" src="${currentImage}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; border: 2px solid #E5E7EB;">` : `<div id="edit-current-image" style="width: 100%; height: 250px; background: #F3F4F6; border: 2px dashed #D1D5DB; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #9CA3AF; font-size: 3rem;">🍽️</div>`}
            </div>
            <input type="file" id="edit-food-image" accept="image/*" style="
                width: 100%;
                padding: 12px;
                border: 2px solid #E5E7EB;
                border-radius: 8px;
                font-size: 0.95rem;
                box-sizing: border-box;
                cursor: pointer;
            " />
            <p style="font-size: 0.85rem; color: #6B7280; margin-top: 6px;">Leave empty to keep current image</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Food Name *</label>
            <input type="text" id="edit-food-name" value="${food.name}" style="
                width: 100%;
                padding: 12px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
            " />
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Price (₹) *</label>
            <input type="number" id="edit-food-price" value="${food.price}" step="0.01" style="
                width: 100%;
                padding: 12px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
            " />
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Description</label>
            <textarea id="edit-food-desc" style="
                width: 100%;
                padding: 12px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 1rem;
                font-family: inherit;
                resize: vertical;
                min-height: 100px;
                box-sizing: border-box;
            ">${food.shortDescription || ''}</textarea>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Preparation Time (mins)</label>
            <input type="number" id="edit-food-prep" value="${food.preparationTime || 30}" style="
                width: 100%;
                padding: 12px;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
            " />
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 30px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="edit-food-veg" ${food.veg ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;" />
                <span style="color: #0F172A; font-weight: 500;">🥬 Vegetarian</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="edit-food-nonveg" ${food.nonVeg ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;" />
                <span style="color: #0F172A; font-weight: 500;">🍗 Non-Vegetarian</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="edit-food-bestseller" ${food.bestseller ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;" />
                <span style="color: #0F172A; font-weight: 500;">⭐ Bestseller</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="edit-food-special" ${food.chefSpecial ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;" />
                <span style="color: #0F172A; font-weight: 500;">👨‍🍳 Chef Special</span>
            </label>
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button onclick="document.querySelector('.modal-overlay').remove()" style="
                flex: 1;
                padding: 12px;
                background: #E5E7EB;
                color: #0F172A;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.3s;
            " onmouseover="this.style.background='#D1D5DB'" onmouseout="this.style.background='#E5E7EB'">Cancel</button>
            <button onclick="saveFoodEdit('${foodId}')" style="
                flex: 1;
                padding: 12px;
                background: #3B82F6;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.3s;
            " onmouseover="this.style.background='#2563EB'" onmouseout="this.style.background='#3B82F6'">Save Changes</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    
    // Add image preview functionality
    const imageInput = modalContent.querySelector('#edit-food-image');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const currentImageEl = modalContent.querySelector('#edit-current-image');
                    if (currentImageEl) {
                        currentImageEl.remove();
                    }
                    const newImg = document.createElement('img');
                    newImg.id = 'edit-current-image';
                    newImg.src = event.target.result;
                    newImg.style.cssText = 'width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; border: 2px solid #E5E7EB; display: block; margin-bottom: 12px;';
                    imageInput.parentElement.insertBefore(newImg, imageInput);
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };
    document.body.appendChild(modalOverlay);
}

async function saveFoodEdit(foodId) {
    const name = document.getElementById('edit-food-name').value.trim();
    const price = parseFloat(document.getElementById('edit-food-price').value);
    const description = document.getElementById('edit-food-desc').value.trim();
    const prepTime = parseInt(document.getElementById('edit-food-prep').value);
    const isVeg = document.getElementById('edit-food-veg').checked;
    const isNonVeg = document.getElementById('edit-food-nonveg').checked;
    const isBestseller = document.getElementById('edit-food-bestseller').checked;
    const isChefSpecial = document.getElementById('edit-food-special').checked;
    
    if (!name || !price) {
        showNotification('Name and price are required', 'error');
        return;
    }
    
    try {
        const updateData = {
            name: name,
            price: price,
            shortDescription: description,
            preparationTime: prepTime,
            veg: isVeg,
            nonVeg: isNonVeg,
            bestseller: isBestseller,
            chefSpecial: isChefSpecial,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Handle image upload if new image is selected
        const imageInput = document.getElementById('edit-food-image');
        if (imageInput && imageInput.files && imageInput.files[0]) {
            const imageUrl = await uploadImage(imageInput.files[0], `restaurants/${app.currentRestaurantId}/foods`);
            updateData.images = [imageUrl];
            updateData.image = imageUrl;
        }
        
        await db.collection('foods').doc(foodId).update(updateData);
        
        document.querySelector('.modal-overlay').remove();
        loadFoods();
        showNotification('Food item updated successfully', 'success');
    } catch (error) {
        console.error('Error editing food:', error);
        showNotification('Error editing food', 'error');
    }
}

async function duplicateFood(foodId) {
    const food = app.foods.find(f => f.id === foodId);
    if (!food) return;
    
    try {
        const newFood = { ...food };
        delete newFood.id;
        newFood.name = food.name + ' (Copy)';
        newFood.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        
        await db.collection('foods').add(newFood);
        loadFoods();
        showNotification('Food duplicated successfully', 'success');
    } catch (error) {
        console.error('Error duplicating food:', error);
        showNotification('Error duplicating food', 'error');
    }
}

async function changeFoodAvailability(foodId, status) {
    try {
        const updateData = {
            availability: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Also update old fields for compatibility
        if (status === 'outOfStock') {
            updateData.outOfStock = true;
        } else {
            updateData.outOfStock = false;
        }
        
        if (status === 'hidden') {
            updateData.hidden = true;
        } else {
            updateData.hidden = false;
        }
        
        await db.collection('foods').doc(foodId).update(updateData);
        loadFoods();
        showNotification(`Food marked as ${status}`, 'success');
    } catch (error) {
        console.error('Error changing food availability:', error);
        showNotification('Error updating food availability', 'error');
    }
}

async function toggleFoodVisibility(foodId, isHidden) {
    try {
        await db.collection('foods').doc(foodId).update({
            hidden: !isHidden,
            availability: !isHidden ? 'hidden' : 'available',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadFoods();
        showNotification(isHidden ? 'Food is now visible' : 'Food is now hidden', 'success');
    } catch (error) {
        console.error('Error toggling visibility:', error);
        showNotification('Error updating food', 'error');
    }
}

async function confirmDeleteFood(foodId) {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    
    try {
        await db.collection('foods').doc(foodId).delete();
        loadFoods();
        showNotification('Food deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting food:', error);
        showNotification('Error deleting food', 'error');
    }
}

async function toggleStockStatus(foodId, isOutOfStock) {
    try {
        await db.collection('foods').doc(foodId).update({
            outOfStock: !isOutOfStock,
            availability: !isOutOfStock ? 'outOfStock' : 'available',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadFoods();
        showNotification(!isOutOfStock ? 'Marked as out of stock' : 'Marked as in stock', 'success');
    } catch (error) {
        console.error('Error updating stock status:', error);
        showNotification('Error updating stock status', 'error');
    }
}

function showAvailabilityOptions(foodId) {
    const food = app.foods.find(f => f.id === foodId);
    if (!food) return;
    
    const availabilityOptions = [
        { value: 'available', label: '✓ Available' },
        { value: 'outOfStock', label: '❌ Out of Stock' },
        { value: 'coming soon', label: '⏰ Coming Soon' },
        { value: 'seasonal', label: '🌿 Seasonal' },
        { value: 'hidden', label: '🙈 Hidden from Menu' }
    ];
    
    let message = 'Change availability status to:\n\n';
    availabilityOptions.forEach((opt, idx) => {
        message += `${idx + 1}. ${opt.label}\n`;
    });
    message += `\nEnter number (1-${availabilityOptions.length}):`;
    
    const choice = prompt(message);
    if (choice && choice >= 1 && choice <= availabilityOptions.length) {
        const status = availabilityOptions[parseInt(choice) - 1].value;
        changeFoodAvailability(foodId, status);
    }
}

async function archiveFood(foodId) {
    try {
        await db.collection('foods').doc(foodId).update({
            archived: true,
            availability: 'archived',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadFoods();
        showNotification('Food archived successfully', 'success');
    } catch (error) {
        console.error('Error archiving food:', error);
        showNotification('Error archiving food', 'error');
    }
}

async function restoreFood(foodId) {
    try {
        await db.collection('foods').doc(foodId).update({
            archived: false,
            availability: 'available',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadFoods();
        showNotification('Food restored successfully', 'success');
    } catch (error) {
        console.error('Error restoring food:', error);
        showNotification('Error restoring food', 'error');
    }
}

// ============================================
// VARIANTS MANAGEMENT
// ============================================

async function loadVariants() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const snapshot = await db.collection('variants')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.variants = [];
        
        // Try to find the list element with multiple methods
        let list = document.getElementById('variants-list');
        if (!list) list = document.querySelector('.variants-list');
        if (!list) {
            console.warn('Variants list element not found in DOM');
            return;
        }
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No variants yet. Create pricing options for your foods!</p><button class="btn btn-primary" onclick="openAddVariantModal()">+ Add Variant</button></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const variant = doc.data();
            app.variants.push({ id: doc.id, ...variant });
            
            const card = document.createElement('div');
            card.className = 'variant-card premium-card';
            card.style.cssText = 'display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 16px; background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border: 1px solid #e2e8f0; border-radius: 8px; transition: all 0.2s;';
            card.innerHTML = `
                <div class="variant-info">
                    <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.1rem; font-weight: 600;">${variant.name}</h4>
                    ${variant.description ? `<p style="margin: 0; color: #64748b; font-size: 0.9rem;">${variant.description}</p>` : ''}
                    <span class="badge" style="display: inline-block; margin-top: 8px; background: #22c55e; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: 600;">+₹${variant.priceAdjustment || variant.price || 0}</span>
                </div>
                <div class="variant-actions" style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                    <button class="btn btn-primary btn-sm" onclick="editVariant('${doc.id}')" style="padding: 8px 12px; font-size: 0.85rem;">📝 Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteVariant('${doc.id}')" style="padding: 8px 12px; font-size: 0.85rem;">🗑️ Delete</button>
                </div>
            `;
            card.addEventListener('mouseenter', () => {
                card.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.1)';
                card.style.transform = 'translateY(-2px)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = 'none';
                card.style.transform = 'translateY(0)';
            });
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading variants:', error);
        showNotification('Error loading variants', 'error');
    }
}

async function openAddVariantModal() {
    openVariantModal();
}

async function editVariant(variantId) {
    let variant = app.variants.find(v => v.id === variantId);
    
    // If not in app state, fetch from Firebase
    if (!variant) {
        try {
            const variantDoc = await db.collection('variants').doc(variantId).get();
            if (variantDoc.exists) {
                variant = { id: variantId, ...variantDoc.data() };
            } else {
                showNotification('Variant not found', 'error');
                return;
            }
        } catch (error) {
            console.error('Error fetching variant:', error);
            showNotification('Error loading variant', 'error');
            return;
        }
    }
    
    if (!variant) return;
    
    const newName = prompt('Edit Variant Name:', variant.name);
    if (!newName) return;
    
    const newPrice = parseFloat(prompt('Edit Price:', variant.price || 0));
    
    try {
        await db.collection('variants').doc(variantId).update({
            name: newName,
            price: newPrice,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadVariants();
        showNotification('Variant updated successfully', 'success');
    } catch (error) {
        console.error('Error editing variant:', error);
        showNotification('Error editing variant', 'error');
    }
}

async function confirmDeleteVariant(variantId) {
    if (!confirm('Delete this variant?')) return;
    
    try {
        await db.collection('variants').doc(variantId).delete();
        loadVariants();
        showNotification('Variant deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting variant:', error);
        showNotification('Error deleting variant', 'error');
    }
}

// ============================================
// ADDONS MANAGEMENT
// ============================================

async function loadAddons() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const snapshot = await db.collection('addons')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.addons = [];
        
        // Try to find the list element with multiple methods
        let list = document.getElementById('addons-list');
        if (!list) list = document.querySelector('.addons-list');
        if (!list) {
            console.warn('Addons list element not found in DOM');
            return;
        }
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No addons yet. Create extra options for customers!</p><button class="btn btn-primary" onclick="openAddAddonModal()">+ Add Addon</button></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const addon = doc.data();
            app.addons.push({ id: doc.id, ...addon });
            
            const card = document.createElement('div');
            card.className = 'addon-card premium-card';
            card.style.cssText = 'display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 16px; background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%); border: 1px solid #fcd34d; border-radius: 8px; transition: all 0.2s;';
            card.innerHTML = `
                <div class="addon-info">
                    <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.1rem; font-weight: 600;">${addon.name}</h4>
                    ${addon.description ? `<p style="margin: 0; color: #64748b; font-size: 0.9rem;">${addon.description}</p>` : ''}
                    <span class="badge" style="display: inline-block; margin-top: 8px; background: #f97316; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: 600;">+₹${addon.price}</span>
                </div>
                <div class="addon-actions" style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                    <button class="btn btn-primary btn-sm" onclick="editAddon('${doc.id}')" style="padding: 8px 12px; font-size: 0.85rem;">📝 Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteAddon('${doc.id}')" style="padding: 8px 12px; font-size: 0.85rem;">🗑️ Delete</button>
                </div>
            `;
            card.addEventListener('mouseenter', () => {
                card.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.1)';
                card.style.transform = 'translateY(-2px)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = 'none';
                card.style.transform = 'translateY(0)';
            });
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading addons:', error);
        showNotification('Error loading addons', 'error');
    }
}

async function openAddAddonModal() {
    openAddonModal();
}

async function editAddon(addonId) {
    let addon = app.addons.find(a => a.id === addonId);
    
    // If not in app state, fetch from Firebase
    if (!addon) {
        try {
            const addonDoc = await db.collection('addons').doc(addonId).get();
            if (addonDoc.exists) {
                addon = { id: addonId, ...addonDoc.data() };
            } else {
                showNotification('Addon not found', 'error');
                return;
            }
        } catch (error) {
            console.error('Error fetching addon:', error);
            showNotification('Error loading addon', 'error');
            return;
        }
    }
    
    if (!addon) return;
    
    const newName = prompt('Edit Addon Name:', addon.name);
    if (!newName) return;
    
    const newPrice = parseFloat(prompt('Edit Price:', addon.price || 0));
    const newDesc = prompt('Edit Description:', addon.description || '');
    
    try {
        await db.collection('addons').doc(addonId).update({
            name: newName,
            price: newPrice,
            description: newDesc,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadAddons();
        showNotification('Addon updated successfully', 'success');
    } catch (error) {
        console.error('Error editing addon:', error);
        showNotification('Error editing addon', 'error');
    }
}

async function confirmDeleteAddon(addonId) {
    if (!confirm('Delete this addon?')) return;
    
    try {
        await db.collection('addons').doc(addonId).delete();
        loadAddons();
        showNotification('Addon deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting addon:', error);
        showNotification('Error deleting addon', 'error');
    }
}

// ============================================
// ENHANCED ORDERS MANAGEMENT
// ============================================

async function loadOrders(filter = 'all') {
    try {
        if (!firebaseInitialized || !db) return;
        
        let query = db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId);
        
        if (filter !== 'all') {
            query = query.where('status', '==', filter);
        }
        
        query = query.orderBy('createdAt', 'desc');
        
        const snapshot = await query.get();
        
        app.orders = [];
        const list = document.getElementById('orders-list') || document.querySelector('.orders-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No orders found</p></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const order = doc.data();
            app.orders.push({ id: doc.id, ...order });
            
            const statusColor = {
                'pending': '#F59E0B',
                'accepted': '#3B82F6',
                'preparing': '#8B5CF6',
                'ready': '#10B981',
                'completed': '#6B7280',
                'cancelled': '#EF4444'
            };
            
            const card = document.createElement('div');
            card.className = 'order-card premium-card';
            card.innerHTML = `
                <div class="order-header">
                    <div class="order-number">Order #${order.orderId}</div>
                    <span class="badge" style="background: ${statusColor[order.status]}">${order.status.toUpperCase()}</span>
                </div>
                <div class="order-meta">
                    <div class="meta-item">
                        <span>Table</span>
                        <strong>${order.tableNumber}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Items</span>
                        <strong>${order.items?.length || 0}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Total</span>
                        <strong>₹${order.total || 0}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Time</span>
                        <strong>${new Date(order.createdAt?.toDate()).toLocaleTimeString() || 'N/A'}</strong>
                    </div>
                </div>
                <div class="order-actions">
                    <button class="btn btn-primary btn-sm" onclick="viewOrderDetails('${doc.id}')">View</button>
                    <button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}')">Status</button>
                    <button class="btn btn-sm" onclick="printReceipt('${doc.id}')">Print</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders', 'error');
    }
}

async function viewOrderDetails(orderId) {
    const order = app.orders.find(o => o.id === orderId);
    if (!order) return;
    
    let itemsHtml = '';
    order.items?.forEach(item => {
        itemsHtml += `<div class="order-item">
            <span>${item.name} x${item.quantity}</span>
            <span>₹${item.price * item.quantity}</span>
        </div>`;
    });
    
    const details = `Order #${order.orderId}
Status: ${order.status}
Table: ${order.tableNumber}
Items:
${itemsHtml}
Subtotal: ₹${order.subtotal || 0}
Tax: ₹${order.tax || 0}
Total: ₹${order.total || 0}`;
    
    alert(details);
}

async function updateOrderStatus(orderId) {
    const statuses = ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'];
    const statusStr = prompt(`Current statuses:\n0: Pending\n1: Accepted\n2: Preparing\n3: Ready\n4: Completed\n5: Cancelled\n\nSelect (0-5):`);
    
    if (statusStr === null || isNaN(statusStr)) return;
    
    const newStatus = statuses[parseInt(statusStr)];
    
    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadOrders();
        showNotification('Order status updated', 'success');
    } catch (error) {
        console.error('Error updating order:', error);
        showNotification('Error updating order', 'error');
    }
}

async function printReceipt(orderId) {
    const order = app.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const receipt = `
=========================
${app.currentRestaurant.name}
=========================
Order #${order.orderId}
Table: ${order.tableNumber}
Time: ${new Date(order.createdAt?.toDate()).toLocaleString()}

ITEMS:
${order.items?.map(item => `${item.name} x${item.quantity} = ₹${item.price * item.quantity}`).join('\n')}

SUBTOTAL: ₹${order.subtotal || 0}
TAX: ₹${order.tax || 0}
TOTAL: ₹${order.total || 0}

Status: ${order.status.toUpperCase()}
=========================
Thank you for your order!
=========================`;
    
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write('<pre>' + receipt + '</pre>');
    printWindow.document.close();
    printWindow.print();
}

// ============================================
// ENHANCED OFFERS MANAGEMENT
// ============================================

async function loadOffers() {
    try {
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('offers')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.offers = [];
        const list = document.getElementById('offers-list') || document.querySelector('.offers-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No offers yet. Create special deals!</p><button class="btn btn-primary" onclick="openAddOfferModal()">+ Add Offer</button></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const offer = doc.data();
            app.offers.push({ id: doc.id, ...offer });
            
            const card = document.createElement('div');
            card.className = 'offer-card premium-card';
            card.innerHTML = `
                <div class="offer-info">
                    <h4>🎉 ${offer.title}</h4>
                    <p>${offer.description}</p>
                    <div class="offer-details">
                        <span class="badge">${offer.type === 'percentage' ? offer.value + '%' : '₹' + offer.value}</span>
                        <span class="badge ${offer.active ? 'badge-success' : 'badge-danger'}">${offer.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    ${offer.expiryDate ? `<small>Expires: ${new Date(offer.expiryDate).toLocaleDateString()}</small>` : ''}
                </div>
                <div class="offer-actions">
                    <button class="btn btn-primary btn-sm" onclick="editOffer('${doc.id}')">Edit</button>
                    <button class="btn btn-sm" onclick="toggleOfferStatus('${doc.id}', ${offer.active})">${offer.active ? 'Deactivate' : 'Activate'}</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteOffer('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading offers:', error);
        showNotification('Error loading offers', 'error');
    }
}

async function openAddOfferModal() {
    const title = prompt('Offer Title (e.g., Weekend Discount):');
    if (!title) return;
    
    const description = prompt('Description:') || '';
    const type = prompt('Type (percentage/flat):') || 'percentage';
    const value = parseFloat(prompt('Discount Value:') || '0');
    
    try {
        await db.collection('offers').add({
            restaurantId: app.currentRestaurantId,
            title: title,
            description: description,
            type: type,
            value: value,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadOffers();
        showNotification('Offer created successfully', 'success');
    } catch (error) {
        console.error('Error creating offer:', error);
        showNotification('Error creating offer', 'error');
    }
}

async function editOffer(offerId) {
    const offer = app.offers.find(o => o.id === offerId);
    if (!offer) return;
    
    const newTitle = prompt('Edit Title:', offer.title);
    if (!newTitle) return;
    
    const newDesc = prompt('Edit Description:', offer.description);
    const newValue = parseFloat(prompt('Edit Value:', offer.value));
    
    try {
        await db.collection('offers').doc(offerId).update({
            title: newTitle,
            description: newDesc,
            value: newValue,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadOffers();
        showNotification('Offer updated successfully', 'success');
    } catch (error) {
        console.error('Error updating offer:', error);
        showNotification('Error updating offer', 'error');
    }
}

async function toggleOfferStatus(offerId, isActive) {
    try {
        await db.collection('offers').doc(offerId).update({
            active: !isActive,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadOffers();
        showNotification(isActive ? 'Offer deactivated' : 'Offer activated', 'success');
    } catch (error) {
        console.error('Error toggling offer:', error);
        showNotification('Error updating offer', 'error');
    }
}

async function confirmDeleteOffer(offerId) {
    if (!confirm('Delete this offer?')) return;
    
    try {
        await db.collection('offers').doc(offerId).delete();
        loadOffers();
        showNotification('Offer deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting offer:', error);
        showNotification('Error deleting offer', 'error');
    }
}

// ============================================
// COUPONS MANAGEMENT
// ============================================

async function loadCoupons() {
    try {
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('coupons')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.coupons = [];
        const list = document.getElementById('coupons-list') || document.querySelector('.coupons-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No coupons yet. Create discount codes!</p><button class="btn btn-primary" onclick="openAddCouponModal()">+ Add Coupon</button></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const coupon = doc.data();
            app.coupons.push({ id: doc.id, ...coupon });
            
            const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
            
            const card = document.createElement('div');
            card.className = 'coupon-card premium-card';
            card.innerHTML = `
                <div class="coupon-code">${coupon.code}</div>
                <div class="coupon-info">
                    <p>${coupon.description}</p>
                    <div class="coupon-details">
                        <span>${coupon.discountType === 'percentage' ? coupon.discountValue + '%' : '₹' + coupon.discountValue}</span>
                        <span>Min: ₹${coupon.minimumAmount || 0}</span>
                        <span>Max: ₹${coupon.maximumDiscount || 'Unlimited'}</span>
                    </div>
                    ${isExpired ? '<span class="badge-danger">Expired</span>' : '<span class="badge-success">Active</span>'}
                </div>
                <div class="coupon-actions">
                    <button class="btn btn-primary btn-sm" onclick="editCoupon('${doc.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteCoupon('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading coupons:', error);
        showNotification('Error loading coupons', 'error');
    }
}

async function openAddCouponModal() {
    const code = prompt('Coupon Code (e.g., WELCOME10):')?.toUpperCase();
    if (!code) return;
    
    const description = prompt('Description:') || '';
    const discountType = prompt('Discount Type (percentage/flat):') || 'percentage';
    const discountValue = parseFloat(prompt('Discount Value:') || '0');
    const minimumAmount = parseFloat(prompt('Minimum Order Amount:') || '0');
    const maximumDiscount = parseFloat(prompt('Maximum Discount (0 for unlimited):') || '0');
    
    try {
        await db.collection('coupons').add({
            restaurantId: app.currentRestaurantId,
            code: code,
            description: description,
            discountType: discountType,
            discountValue: discountValue,
            minimumAmount: minimumAmount,
            maximumDiscount: maximumDiscount === 0 ? null : maximumDiscount,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadCoupons();
        showNotification('Coupon created successfully', 'success');
    } catch (error) {
        console.error('Error creating coupon:', error);
        showNotification('Error creating coupon', 'error');
    }
}

async function editCoupon(couponId) {
    const coupon = app.coupons.find(c => c.id === couponId);
    if (!coupon) return;
    
    const newDesc = prompt('Edit Description:', coupon.description);
    const newValue = parseFloat(prompt('Edit Discount Value:', coupon.discountValue));
    
    try {
        await db.collection('coupons').doc(couponId).update({
            description: newDesc,
            discountValue: newValue,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadCoupons();
        showNotification('Coupon updated successfully', 'success');
    } catch (error) {
        console.error('Error updating coupon:', error);
        showNotification('Error updating coupon', 'error');
    }
}

async function confirmDeleteCoupon(couponId) {
    if (!confirm('Delete this coupon?')) return;
    
    try {
        await db.collection('coupons').doc(couponId).delete();
        loadCoupons();
        showNotification('Coupon deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting coupon:', error);
        showNotification('Error deleting coupon', 'error');
    }
}

// ============================================
// RESTAURANT PROFILE MANAGEMENT
// ============================================

async function loadRestaurantProfile() {
    try {
        if (!app.currentRestaurant) return;
        
        const profileContainer = document.getElementById('profile-container') || document.querySelector('.profile-container');
        if (!profileContainer) return;
        
        const rest = app.currentRestaurant;
        
        profileContainer.innerHTML = `
            <div class="profile-section">
                <h3>Restaurant Logo & Banner</h3>
                <div class="profile-images">
                    <div class="image-upload">
                        <div class="upload-area" id="logo-upload-area">
                            <input type="file" id="logo-file-input" accept="image/*">
                            <span>🏪 ${rest.logo ? 'Logo Uploaded ✓' : 'Upload Logo'}</span>
                        </div>
                        ${rest.logo ? `<img src="${rest.logo}" alt="Logo" class="image-preview">` : ''}
                    </div>
                    <div class="image-upload">
                        <div class="upload-area" id="banner-upload-area">
                            <input type="file" id="banner-file-input" accept="image/*">
                            <span>🖼️ ${rest.banner ? 'Banner Uploaded ✓' : 'Upload Banner'}</span>
                        </div>
                        ${rest.banner ? `<img src="${rest.banner}" alt="Banner" class="image-preview">` : ''}
                    </div>
                </div>
            </div>
            
            <div class="profile-section">
                <h3>Basic Information</h3>
                <div class="form-group">
                    <label>Restaurant Name</label>
                    <input type="text" id="profile-name" value="${rest.name || ''}" class="form-input">
                </div>
                <div class="form-group">
                    <label>About</label>
                    <textarea id="profile-about" class="form-input">${rest.about || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Type (e.g., Multi-cuisine, Italian, Chinese)</label>
                    <input type="text" id="profile-type" value="${rest.type || ''}" class="form-input">
                </div>
            </div>
            
            <div class="profile-section">
                <h3>Contact Details</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" id="profile-phone" value="${rest.phone || ''}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="profile-email" value="${rest.email || ''}" class="form-input">
                    </div>
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="profile-address" value="${rest.address || ''}" class="form-input">
                </div>
            </div>
            
            <div class="profile-section">
                <h3>Operating Hours</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Opening Time</label>
                        <input type="time" id="profile-opening" value="${rest.openingTime || ''}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Closing Time</label>
                        <input type="time" id="profile-closing" value="${rest.closingTime || ''}" class="form-input">
                    </div>
                </div>
            </div>
            
            <div class="profile-section">
                <h3>Social Media</h3>
                <div class="form-group">
                    <label>Instagram</label>
                    <input type="text" id="profile-instagram" value="${rest.instagram || ''}" placeholder="@yourprofile" class="form-input">
                </div>
                <div class="form-group">
                    <label>Facebook</label>
                    <input type="text" id="profile-facebook" value="${rest.facebook || ''}" class="form-input">
                </div>
            </div>
            
            <div class="profile-actions">
                <button class="btn btn-primary" onclick="saveRestaurantProfile()">💾 Save Changes</button>
            </div>
        `;

        // Add file upload event listeners
        setTimeout(() => {
            const logoUploadArea = document.getElementById('logo-upload-area');
            const logoFileInput = document.getElementById('logo-file-input');
            const bannerUploadArea = document.getElementById('banner-upload-area');
            const bannerFileInput = document.getElementById('banner-file-input');

            if (logoUploadArea && logoFileInput) {
                logoUploadArea.addEventListener('click', () => logoFileInput.click());
                logoFileInput.addEventListener('change', (e) => handleImageUpload(e, 'logo'));
                logoUploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    logoUploadArea.classList.add('dragover');
                });
                logoUploadArea.addEventListener('dragleave', () => {
                    logoUploadArea.classList.remove('dragover');
                });
                logoUploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    logoUploadArea.classList.remove('dragover');
                    if (e.dataTransfer.files.length > 0) {
                        logoFileInput.files = e.dataTransfer.files;
                        handleImageUpload({ target: { files: e.dataTransfer.files } }, 'logo');
                    }
                });
            }

            if (bannerUploadArea && bannerFileInput) {
                bannerUploadArea.addEventListener('click', () => bannerFileInput.click());
                bannerFileInput.addEventListener('change', (e) => handleImageUpload(e, 'banner'));
                bannerUploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    bannerUploadArea.classList.add('dragover');
                });
                bannerUploadArea.addEventListener('dragleave', () => {
                    bannerUploadArea.classList.remove('dragover');
                });
                bannerUploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    bannerUploadArea.classList.remove('dragover');
                    if (e.dataTransfer.files.length > 0) {
                        bannerFileInput.files = e.dataTransfer.files;
                        handleImageUpload({ target: { files: e.dataTransfer.files } }, 'banner');
                    }
                });
            }
        }, 100);
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error loading profile', 'error');
    }
}

async function handleImageUpload(event, type) {
    try {
        if (!firebaseInitialized || !storage || !app.currentRestaurantId) return;

        const files = event.target?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
            showNotification('Please upload an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showNotification('Image must be less than 5MB', 'error');
            return;
        }

        showNotification('Uploading ' + type + '...', 'info');

        const storagePath = `restaurants/${app.currentRestaurantId}/${type}-${Date.now()}`;
        const uploadTask = storage.ref(storagePath).put(file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload progress: ' + progress + '%');
            },
            (error) => {
                console.error('Upload error:', error);
                showNotification('Error uploading ' + type, 'error');
            },
            async () => {
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                const updateData = {};
                updateData[type] = downloadURL;

                await db.collection('restaurants').doc(app.currentRestaurantId).update(updateData);
                app.currentRestaurant[type] = downloadURL;

                showNotification(type.charAt(0).toUpperCase() + type.slice(1) + ' uploaded successfully', 'success');
                loadRestaurantProfile();
            }
        );
    } catch (error) {
        console.error('Error handling image upload:', error);
        showNotification('Error uploading image', 'error');
    }
}

async function saveRestaurantProfile() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const updateData = {
            name: document.getElementById('profile-name')?.value || '',
            about: document.getElementById('profile-about')?.value || '',
            type: document.getElementById('profile-type')?.value || '',
            phone: document.getElementById('profile-phone')?.value || '',
            email: document.getElementById('profile-email')?.value || '',
            address: document.getElementById('profile-address')?.value || '',
            openingTime: document.getElementById('profile-opening')?.value || '',
            closingTime: document.getElementById('profile-closing')?.value || '',
            instagram: document.getElementById('profile-instagram')?.value || '',
            facebook: document.getElementById('profile-facebook')?.value || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('restaurants').doc(app.currentRestaurantId).update(updateData);
        app.currentRestaurant = { ...app.currentRestaurant, ...updateData };
        
        showNotification('Profile updated successfully', 'success');
        loadRestaurantProfile();
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error saving profile', 'error');
    }
}

// ============================================
// REVIEWS MANAGEMENT
// ============================================

async function loadReviews() {
    try {
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('reviews')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('createdAt', 'desc')
            .get();
        
        app.reviews = [];
        const list = document.getElementById('reviews-list') || document.querySelector('.reviews-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No reviews yet. Customers will leave reviews after ordering!</p></div>';
            return;
        }
        
        // Calculate average rating
        let totalRating = 0;
        snapshot.forEach(doc => {
            const review = doc.data();
            app.reviews.push({ id: doc.id, ...review });
            totalRating += review.rating || 0;
        });
        
        const avgRating = (totalRating / snapshot.size).toFixed(1);
        
        const statsHtml = `
            <div class="reviews-stats">
                <div class="stat">
                    <div class="rating-value">⭐ ${avgRating}</div>
                    <div class="rating-count">${snapshot.size} reviews</div>
                </div>
            </div>
        `;
        
        list.innerHTML = statsHtml;
        
        snapshot.forEach(doc => {
            const review = doc.data();
            
            const card = document.createElement('div');
            card.className = 'review-card premium-card';
            card.innerHTML = `
                <div class="review-header">
                    <div class="reviewer-info">
                        <h4>${review.customerName || 'Anonymous'}</h4>
                        <div class="rating">${'⭐'.repeat(review.rating || 0)}</div>
                    </div>
                    <small>${new Date(review.createdAt?.toDate()).toLocaleDateString()}</small>
                </div>
                <p class="review-text">${review.comment || ''}</p>
                ${review.foodName ? `<small>About: ${review.foodName}</small>` : ''}
                ${review.reply ? `
                    <div class="review-reply">
                        <strong>Your reply:</strong>
                        <p>${review.reply}</p>
                        <button class="btn btn-sm btn-danger" onclick="deleteReviewReply('${doc.id}')">Delete Reply</button>
                    </div>
                ` : `
                    <button class="btn btn-primary btn-sm" onclick="replyToReview('${doc.id}')">Reply</button>
                `}
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading reviews:', error);
        showNotification('Error loading reviews', 'error');
    }
}

async function replyToReview(reviewId) {
    const reply = prompt('Write your reply:');
    if (!reply) return;
    
    try {
        await db.collection('reviews').doc(reviewId).update({
            reply: reply,
            replyAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadReviews();
        showNotification('Reply added successfully', 'success');
    } catch (error) {
        console.error('Error adding reply:', error);
        showNotification('Error adding reply', 'error');
    }
}

async function deleteReviewReply(reviewId) {
    if (!confirm('Delete your reply?')) return;
    
    try {
        await db.collection('reviews').doc(reviewId).update({
            reply: firebase.firestore.FieldValue.delete(),
            replyAt: firebase.firestore.FieldValue.delete()
        });
        
        loadReviews();
        showNotification('Reply deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting reply:', error);
        showNotification('Error deleting reply', 'error');
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

let adminUser = null;

async function adminLogin() {
    try {
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        
        if (!email || !password) {
            showNotification('Please enter email and password', 'error');
            return;
        }
        
        // Mock admin login (in production, use proper authentication)
        // For this demo, any email/password works
        if (email === 'admin@restaurantos.com' && password === 'admin123') {
            adminUser = { email: email, isAdmin: true };
            navigateTo('admin-dashboard');
            loadAdminDashboard();
        } else {
            showNotification('Invalid credentials', 'error');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        showNotification('Login failed', 'error');
    }
}

function adminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        adminUser = null;
        navigateTo('landing');
    }
}

async function loadAdminDashboard() {
    try {
        if (!firebaseInitialized) return;
        
        // Get total restaurants
        const restaurantsSnapshot = await db.collection('restaurants').get();
        document.getElementById('total-restaurants').textContent = restaurantsSnapshot.size;
        
        // Get total orders
        const ordersSnapshot = await db.collection('orders').get();
        document.getElementById('total-orders').textContent = ordersSnapshot.size;
        
        // Get total revenue
        let totalRevenue = 0;
        ordersSnapshot.forEach(doc => {
            totalRevenue += doc.data().total || 0;
        });
        document.getElementById('total-revenue').textContent = '₹' + totalRevenue.toFixed(0);
        
        // Get active subscriptions
        let activeSubscriptions = 0;
        restaurantsSnapshot.forEach(doc => {
            if (doc.data().subscription?.status === 'active') {
                activeSubscriptions++;
            }
        });
        document.getElementById('active-subscriptions').textContent = activeSubscriptions;
        
        // Load restaurants list
        loadAdminRestaurantsList(restaurantsSnapshot);
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showNotification('Error loading dashboard', 'error');
    }
}

function loadAdminRestaurantsList(snapshot) {
    const restaurantsList = document.getElementById('admin-restaurants-list');
    
    if (snapshot.empty) {
        restaurantsList.innerHTML = '<p class="empty-state">No restaurants found</p>';
        return;
    }
    
    let html = `
        <div class="restaurant-row">
            <div><strong>Restaurant Name</strong></div>
            <div><strong>Owner</strong></div>
            <div><strong>Status</strong></div>
            <div><strong>Orders</strong></div>
            <div><strong>Actions</strong></div>
        </div>
    `;
    
    snapshot.forEach(doc => {
        const restaurant = doc.data();
        const subStatus = restaurant.subscription?.status === 'active' ? 'Active' : 'Inactive';
        const statusColor = restaurant.subscription?.status === 'active' ? 'var(--success)' : 'var(--danger)';
        
        html += `
            <div class="restaurant-row">
                <div>${restaurant.name || 'N/A'}</div>
                <div>${restaurant.ownerName || 'N/A'}</div>
                <div style="color: ${statusColor}; font-weight: 600;">${subStatus}</div>
                <div>0</div>
                <div class="row-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewRestaurantDetails('${doc.id}')">View</button>
                </div>
            </div>
        `;
    });
    
    restaurantsList.innerHTML = html;
}

function viewRestaurantDetails(restaurantId) {
    showNotification('View details coming soon', 'info');
}

// ============================================
// CUSTOMER ORDER TIMELINE
// ============================================

function showOrderTimeline(orderId) {
    if (!firebaseInitialized || !db) {
        showNotification('Please wait for the app to load', 'error');
        return;
    }
    
    db.collection('orders').doc(orderId).get().then(doc => {
        if (!doc.exists) {
            showNotification('Order not found', 'error');
            return;
        }
        
        const order = doc.data();
        const statuses = [
            { status: 'pending', label: 'Order Placed', icon: '📝' },
            { status: 'accepted', label: 'Accepted', icon: '✓' },
            { status: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
            { status: 'ready', label: 'Ready', icon: '📦' },
            { status: 'completed', label: 'Completed', icon: '✓✓' }
        ];
        
        let timeline = '<div style="padding: 20px;">';
        timeline += `<h3 style="margin-bottom: 20px;">Order #${order.orderId.substring(0, 8)} Timeline</h3>`;
        timeline += `<div style="margin-bottom: 20px; padding: 10px; background: #F3F4F6; border-radius: 8px;">`;
        timeline += `<div>📍 Table ${order.tableNumber}</div>`;
        timeline += `<div>👤 ${order.customerName || 'Guest'}</div>`;
        timeline += `<div>⏱️ Est. Time: ${order.estimatedPrepTime || 30} minutes</div>`;
        timeline += `</div>`;
        
        timeline += '<div style="position: relative;">';
        
        statuses.forEach((item, idx) => {
            const isCompleted = order.status === item.status || 
                                 (order.status === 'completed' && statuses.map(s => s.status).indexOf(order.status) >= idx);
            const isActive = order.status === item.status;
            
            const bgColor = isCompleted ? (isActive ? '#3B82F6' : '#10B981') : '#E5E7EB';
            const textColor = isCompleted ? 'white' : '#666';
            
            timeline += `
                <div style="display: flex; margin-bottom: 20px; position: relative;">
                    <div style="display: flex; flex-direction: column; align-items: center; margin-right: 15px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${bgColor}; color: ${textColor}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.1rem;">
                            ${item.icon}
                        </div>
                        ${idx < statuses.length - 1 ? `<div style="width: 3px; height: 30px; background: ${isCompleted ? '#10B981' : '#E5E7EB'};"></div>` : ''}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #0F172A;">${item.label}</div>
                        <div style="font-size: 0.9rem; color: #999;">
                            ${isCompleted ? (order.updatedAt ? new Date(order.updatedAt.seconds ? order.updatedAt.seconds * 1000 : order.updatedAt).toLocaleString() : 'Completed') : 'Pending'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        timeline += '</div></div>';
        
        // Show in alert
        const modal = document.createElement('div');
        modal.innerHTML = timeline;
        modal.style.maxHeight = '500px';
        modal.style.overflowY = 'auto';
        
        alert(modal.innerText);
    }).catch(error => {
        console.error('Error fetching order:', error);
        showNotification('Error fetching order details', 'error');
    });
}

// ============================================
// PRINTABLE QR PDF GENERATION
// ============================================

async function downloadPrintableQR() {
    try {
        if (!app.currentRestaurant) {
            showNotification('Restaurant not loaded', 'error');
            return;
        }
        
        // Check subscription status
        if (isSubscriptionExpired(app.currentRestaurant)) {
            showNotification('Your subscription has expired. Please renew your subscription to download QR codes.', 'error');
            return;
        }
        
        if (app.currentRestaurant.subscription?.status !== 'active') {
            showNotification('Your subscription is not active. Please upgrade to download QR codes.', 'error');
            return;
        }
        
        // Create a new window with printable content
        const printWindow = window.open('', '', 'height=600,width=800');
        const restaurant = app.currentRestaurant;
        
        // Get restaurant logo - use restaurant logo or image if available
        const restaurantLogo = restaurant.logo || restaurant.image || null;
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Restaurant QR Code - ${restaurant.name}</title>
                <style>
                    @media print {
                        body { margin: 0; padding: 0; background: white; }
                        .qr-container { box-shadow: none; margin: 0; padding: 20px !important; }
                        .print-page { page-break-after: avoid; }
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    html, body {
                        width: 100%;
                        height: 100%;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 10px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                    }
                    .qr-container {
                        width: 21cm;
                        height: 29.7cm;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        text-align: center;
                        padding: 30px;
                        box-sizing: border-box;
                        background: white;
                        position: relative;
                        overflow: hidden;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                    }
                    
                    /* Logo Background Pattern */
                    .qr-container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: ${restaurantLogo ? `url('${restaurantLogo}')` : 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)'};
                        background-size: ${restaurantLogo ? 'cover' : 'auto'};
                        background-position: center;
                        opacity: 0.08;
                        z-index: 0;
                        pointer-events: none;
                    }
                    
                    /* Gradient overlay */
                    .qr-container::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(180deg, rgba(15, 23, 42, 0.03) 0%, rgba(15, 23, 42, 0.08) 100%);
                        z-index: 1;
                        pointer-events: none;
                    }
                    
                    .qr-content {
                        position: relative;
                        z-index: 2;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 100%;
                        height: 100%;
                        justify-content: center;
                    }
                    
                    .logo-section {
                        margin-bottom: 15px;
                        position: relative;
                    }
                    
                    .logo-container {
                        width: 90px;
                        height: 90px;
                        background: white;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                        overflow: hidden;
                        margin: 0 auto 15px;
                        border: 2px solid #f5f5f5;
                        position: relative;
                    }
                    
                    .logo-container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 100%);
                        z-index: 2;
                    }
                    
                    .logo-img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    
                    .logo-placeholder {
                        font-size: 56px;
                        font-weight: bold;
                        color: #0F172A;
                    }
                    
                    .restaurant-name {
                        font-size: 32px;
                        font-weight: 800;
                        color: #0F172A;
                        margin-bottom: 4px;
                        letter-spacing: -1px;
                        line-height: 1.2;
                    }
                    
                    .subtitle {
                        font-size: 14px;
                        color: #64748B;
                        margin-bottom: 4px;
                        font-weight: 600;
                        letter-spacing: 0.3px;
                    }
                    
                    .tagline {
                        font-size: 12px;
                        color: #94A3B8;
                        margin-bottom: 20px;
                        font-style: italic;
                        font-weight: 500;
                    }
                    
                    .divider {
                        width: 60px;
                        height: 3px;
                        background: linear-gradient(90deg, transparent, #3B82F6, transparent);
                        margin-bottom: 20px;
                        border-radius: 2px;
                    }
                    
                    .qr-box {
                        background: white;
                        padding: 25px;
                        border-radius: 16px;
                        margin: 0 auto;
                        box-shadow: 0 15px 30px rgba(0,0,0,0.1);
                        position: relative;
                        border: 2px solid #F1F5F9;
                    }
                    
                    .qr-box::before {
                        content: '';
                        position: absolute;
                        top: -2px;
                        left: -2px;
                        right: -2px;
                        bottom: -2px;
                        background: linear-gradient(135deg, #3B82F6 0%, #10B981 100%);
                        border-radius: 20px;
                        z-index: -1;
                        opacity: 0.15;
                    }
                    
                    #qr-code {
                        position: relative;
                        z-index: 2;
                        padding: 20px;
                        background: #FFFFFF;
                        border-radius: 12px;
                        margin-bottom: 15px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    #qr-logo {
                        width: 70px;
                        height: 70px;
                        border-radius: 10px;
                        object-fit: cover;
                        box-shadow: 0 3px 10px rgba(0,0,0,0.1);
                    }
                    
                    #qr-logo.placeholder {
                        background: linear-gradient(135deg, #3B82F6, #10B981);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 36px;
                    }
                    
                    #qr-code canvas {
                        max-width: 100%;
                        height: auto !important;
                        width: 220px !important;
                        display: block;
                    }
                    
                    .scan-text {
                        font-size: 18px;
                        color: #0F172A;
                        font-weight: 800;
                        margin-bottom: 6px;
                        position: relative;
                        z-index: 2;
                        letter-spacing: -0.5px;
                    }
                    
                    .instruction {
                        font-size: 12px;
                        color: #64748B;
                        margin-bottom: 0;
                        position: relative;
                        z-index: 2;
                        line-height: 1.6;
                        font-weight: 500;
                    }
                    
                    .features {
                        display: flex;
                        justify-content: center;
                        gap: 15px;
                        margin-top: 25px;
                        color: #0F172A;
                        font-size: 11px;
                        position: relative;
                        z-index: 2;
                        flex-wrap: wrap;
                    }
                    
                    .feature-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: 600;
                        color: #475569;
                    }
                    
                    .feature-icon {
                        font-size: 16px;
                    }
                    
                    .footer {
                        margin-top: auto;
                        text-align: center;
                        color: #94A3B8;
                        font-size: 10px;
                        letter-spacing: 0.2px;
                        position: relative;
                        z-index: 2;
                        padding-top: 12px;
                        border-top: 1px solid #E2E8F0;
                        margin-top: 20px;
                    }
                    
                    .footer-text {
                        margin: 4px 0;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="qr-container">
                    <div class="qr-content">
                        <div class="logo-section">
                            <div class="logo-container">
                                ${restaurantLogo ? `<img src="${restaurantLogo}" class="logo-img" alt="Logo">` : `<div class="logo-placeholder">🍽️</div>`}
                            </div>
                        </div>
                        
                        <div class="restaurant-name">${restaurant.name || 'RestaurantOS'}</div>
                        <div class="subtitle">Digital Ordering System</div>
                        <div class="tagline">Order instantly, eat fresh!</div>
                        <div class="divider"></div>
                        
                        <div class="qr-box">
                            <div id="qr-code">
                                ${restaurantLogo ? `<img id="qr-logo" src="${restaurantLogo}" alt="Logo">` : `<div id="qr-logo" class="placeholder">🍽️</div>`}
                            </div>
                            <div class="scan-text">📱 Scan to Order</div>
                            <div class="instruction">Point your phone camera<br>at this QR code</div>
                        </div>
                        
                        <div class="features">
                            <div class="feature-item">
                                <span class="feature-icon">⚡</span>
                                <span>Instant Ordering</span>
                            </div>
                            <div class="feature-item">
                                <span class="feature-icon">📱</span>
                                <span>No App Needed</span>
                            </div>
                            <div class="feature-item">
                                <span class="feature-icon">🎯</span>
                                <span>Mobile Friendly</span>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <div class="footer-text">Powered by RestaurantOS</div>
                            ${restaurant.phone ? `<div class="footer-text">☎️ ${restaurant.phone}</div>` : ''}
                        </div>
                    </div>
                </div>
                
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
                <script>
                    const qrElement = document.getElementById('qr-code');
                    const restaurantId = '${app.currentRestaurantId}';
                    const restaurantUrl = 'https://shank122004-tech.github.io/Restaurants/?restaurant=' + restaurantId;
                    
                    new QRCode(qrElement, {
                        text: restaurantUrl,
                        width: 240,
                        height: 240,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    
                    setTimeout(() => {
                        window.print();
                    }, 1000);
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        showNotification('QR Code ready for printing', 'success');
    } catch (error) {
        console.error('Error generating QR PDF:', error);
        showNotification('Error generating QR code', 'error');
    }
}

// ============================================
// ADVANCED ANALYTICS EXPANSION
// ============================================

async function loadExpandedAnalytics() {
    try {
        if (!firebaseInitialized || !db || !app.currentRestaurantId) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get all orders for analytics
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        // Initialize analytics data
        const analytics = {
            mostOrderedFoods: {},
            totalOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
            avgOrderValue: 0,
            avgPrepTime: 0,
            totalPrepTime: 0,
            peakHour: null,
            hourlyOrders: {},
            dailyRevenue: {}
        };
        
        snapshot.forEach(doc => {
            const order = doc.data();
            
            // Count orders
            analytics.totalOrders++;
            if (order.status === 'completed') analytics.completedOrders++;
            if (order.status === 'cancelled') analytics.cancelledOrders++;
            
            // Revenue
            analytics.totalRevenue += order.total || 0;
            
            // Prep time
            analytics.totalPrepTime += order.estimatedPrepTime || 0;
            
            // Food items
            order.items?.forEach(item => {
                analytics.mostOrderedFoods[item.name] = (analytics.mostOrderedFoods[item.name] || 0) + item.quantity;
            });
            
            // Hourly breakdown
            if (order.createdAt) {
                const timestamp = order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt;
                const date = new Date(timestamp);
                const hour = date.getHours();
                analytics.hourlyOrders[hour] = (analytics.hourlyOrders[hour] || 0) + 1;
                
                const dateStr = date.toISOString().split('T')[0];
                analytics.dailyRevenue[dateStr] = (analytics.dailyRevenue[dateStr] || 0) + (order.total || 0);
            }
        });
        
        // Calculate averages
        analytics.avgOrderValue = analytics.totalOrders > 0 ? analytics.totalRevenue / analytics.totalOrders : 0;
        analytics.avgPrepTime = analytics.totalOrders > 0 ? analytics.totalPrepTime / analytics.totalOrders : 0;
        
        // Find peak hour
        let maxOrders = 0;
        Object.keys(analytics.hourlyOrders).forEach(hour => {
            if (analytics.hourlyOrders[hour] > maxOrders) {
                maxOrders = analytics.hourlyOrders[hour];
                analytics.peakHour = hour;
            }
        });
        
        return analytics;
    } catch (error) {
        console.error('Error loading analytics:', error);
        return null;
    }
}

// ============================================
// RESTAURANT PREVIEW MODE
// ============================================

async function enterPreviewMode() {
    try {
        app.previewMode = true;
        app.previousPage = app.currentPage;
        
        // Load customer menu in preview mode
        await loadCustomerMenu(app.currentRestaurantId);
        navigateTo('customer-menu');
        
        // Show preview banner
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: #FCD34D;
            color: #0F172A;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            z-index: 10000;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        banner.innerHTML = `
            👁️ PREVIEW MODE • Click to Exit
        `;
        banner.onclick = exitPreviewMode;
        document.body.appendChild(banner);
        
        // Adjust page margin
        const app_el = document.getElementById('app');
        if (app_el) app_el.style.marginTop = '50px';
        
        showNotification('Entered preview mode - Testing as customer', 'info');
    } catch (error) {
        console.error('Error entering preview mode:', error);
        showNotification('Error entering preview mode', 'error');
    }
}

function exitPreviewMode() {
    try {
        app.previewMode = false;
        
        // Remove banner
        document.querySelectorAll('div').forEach(el => {
            if (el.style.position === 'fixed' && el.textContent.includes('PREVIEW MODE')) {
                el.remove();
            }
        });
        
        const app_el = document.getElementById('app');
        if (app_el) app_el.style.marginTop = '0';
        
        // Go back to dashboard
        navigateTo('dashboard');
        
        showNotification('Exited preview mode', 'success');
    } catch (error) {
        console.error('Error exiting preview mode:', error);
    }
}

// ============================================
// PAGE VISIBILITY HANDLING
// ============================================

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden
    } else {
        // Page is visible - refresh data
        if (app.currentPage === 'dashboard') {
            loadDashboardData();
        }
    }
});

// ============================================
// PWA INSTALLATION
// ============================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install button if needed
});

// ============================================
// CUSTOMER MODE PROTECTION
// ============================================

// Prevent browser back button in customer mode
window.addEventListener('popstate', function() {
    if (app.customerMode) {
        window.history.pushState(null, null, window.location.href);
        showNotification('You cannot go back while ordering. Complete your order or refresh the page.', 'warning');
    }
});

// Push state on page load to create history entry
window.addEventListener('load', function() {
    if (app.customerMode) {
        window.history.pushState(null, null, window.location.href);
    }
});

// Prevent page unload in customer mode
window.addEventListener('beforeunload', function(e) {
    if (app.customerMode && Object.keys(app.cart).length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

// Customer mode protection handled differently - location override removed to prevent errors

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An error occurred. Please try again.', 'error');
});

// ============================================
// CASHFREE SDK DEBUGGING (Call from console)
// ============================================

window.debugCashfreeSDK = function() {
    console.log('=== CASHFREE SDK DEBUG ===');
    
    if (typeof Cashfree === 'undefined') {
        console.log('❌ Cashfree SDK not loaded');
        return;
    }
    
    console.log('✓ Cashfree SDK is loaded');
    console.log('SDK type:', typeof Cashfree);
    console.log('SDK constructor:', Cashfree.constructor.name);
    
    // Static methods
    console.log('\n--- STATIC METHODS ---');
    const staticMethods = Object.getOwnPropertyNames(Cashfree).filter(m => typeof Cashfree[m] === 'function');
    console.log('Available:', staticMethods.length > 0 ? staticMethods : 'None');
    staticMethods.forEach(m => console.log(`  - ${m}()`));
    
    // Try to create instance
    try {
        const instance = new Cashfree();
        console.log('\n--- INSTANCE METHODS ---');
        const instanceMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
            .filter(m => typeof instance[m] === 'function');
        console.log('Available:', instanceMethods.length > 0 ? instanceMethods : 'None');
        instanceMethods.forEach(m => console.log(`  - ${m}()`));
        
        console.log('\n--- INSTANCE PROPERTIES ---');
        const instanceProps = Object.getOwnPropertyNames(instance);
        console.log('Count:', instanceProps.length);
        if (instanceProps.length < 20) {
            instanceProps.forEach(p => console.log(`  - ${p}`));
        }
    } catch (err) {
        console.log('Cannot instantiate Cashfree:', err.message);
    }
    
    console.log('\n=== END DEBUG ===');
};

console.log('Tip: Run window.debugCashfreeSDK() to inspect Cashfree SDK at any time');