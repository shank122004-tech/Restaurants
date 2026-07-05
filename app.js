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
let auth, db, storage;
let firebaseInitialized = false;

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
        firebaseInitialized = true;
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.warn('Firebase initialization error:', error.message);
        firebaseInitialized = false;
        return false;
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
    ordersRefreshInterval: null
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Wait a moment for Firebase SDK to load from CDN
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize Firebase
    initializeFirebase();

    // Show landing page immediately
    navigateTo('landing');

    // Only setup auth if Firebase is initialized
    if (firebaseInitialized && auth) {
        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                app.currentUser = user;
                try {
                    // Get user role from Firestore with timeout
                    const userDoc = await Promise.race([
                        db.collection('users').doc(user.uid).get(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Firestore timeout')), 5000)
                        )
                    ]);

                    if (userDoc.exists) {
                        app.userRole = userDoc.data().role;
                        
                        // Check if restaurant owner has completed onboarding
                        if (app.userRole === 'restaurant_owner') {
                            const restaurantDoc = await db.collection('restaurants')
                                .where('ownerId', '==', user.uid)
                                .limit(1)
                                .get();
                            if (!restaurantDoc.empty) {
                                app.currentRestaurant = restaurantDoc.docs[0].data();
                                app.currentRestaurantId = restaurantDoc.docs[0].id;
                                // Show dashboard button in landing page header
                                showDashboardButton();
                            } else {
                                // Show start onboarding button
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
                    // Keep landing page visible
                }
            } else {
                // Check if customer is accessing via QR
                const params = new URLSearchParams(window.location.search);
                const restaurantId = params.get('restaurant');
                if (restaurantId) {
                    await loadCustomerMenu(restaurantId);
                } else {
                    // Not logged in - show normal landing page
                    updateLandingPageHeader(null);
                }
            }
        });
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('Service Worker not available:', err);
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

// ============================================
// NAVIGATION
// ============================================

function navigateTo(page) {
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
        const template = document.getElementById('restaurant-dashboard');
        appDiv.appendChild(template.content.cloneNode(true));
        setupDashboard();
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
        app.currentUser = result.user;
        
        // Try to save user to Firestore with timeout
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
            // Continue anyway - user is authenticated
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
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized. Please configure Firebase first.', 'error');
        return;
    }

    // Save restaurant data to Firestore
    try {
        const restaurantRef = await db.collection('restaurants').add({
            ownerId: app.currentUser.uid,
            ...app.onboardingData,
            createdAt: new Date(),
            status: 'pending_payment',
            subscription: {
                plan: 'premium',
                status: 'inactive',
                oneTimeAmount: 999,
                monthlyAmount: 199,
                expiryDate: null
            }
        });
        
        // Simulate payment success
        setTimeout(() => {
            completePayment(restaurantRef.id);
        }, 1000);
        
        showNotification('Processing payment...', 'info');
    } catch (error) {
        console.error('Error:', error);
        if (error.message && error.message.includes('offline')) {
            showNotification('You are offline. Cannot process payment right now.', 'error');
        } else {
            showNotification('Failed to process payment: ' + error.message, 'error');
        }
    }
}

async function completePayment(restaurantId) {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        // Upload logo and banner if provided
        if (app.onboardingData.logoFile) {
            try {
                const logoUrl = await uploadImage(app.onboardingData.logoFile, `restaurants/${restaurantId}/logo`);
                app.onboardingData.logo = logoUrl;
            } catch (error) {
                console.warn('Could not upload logo:', error.message);
            }
        }
        
        if (app.onboardingData.bannerFile) {
            try {
                const bannerUrl = await uploadImage(app.onboardingData.bannerFile, `restaurants/${restaurantId}/banner`);
                app.onboardingData.banner = bannerUrl;
            } catch (error) {
                console.warn('Could not upload banner:', error.message);
            }
        }
        
        // Update restaurant with payment details
        await db.collection('restaurants').doc(restaurantId).update({
            ...app.onboardingData,
            status: 'active',
            'subscription.status': 'active',
            'subscription.activatedAt': new Date(),
            'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });
        
        app.currentRestaurant = app.onboardingData;
        app.currentRestaurantId = restaurantId;
        
        showNotification('Restaurant setup completed! Welcome to RestaurantOS', 'success');
        // Navigate to landing page so they see full site with dashboard button
        setTimeout(() => navigateTo('landing'), 1500);
    } catch (error) {
        console.error('Error:', error);
        if (error.message && error.message.includes('offline')) {
            showNotification('You are offline. Cannot complete setup right now.', 'error');
        } else {
            showNotification('Failed to complete setup: ' + error.message, 'error');
        }
    }
}

// ============================================
// DASHBOARD
// ============================================

function setupDashboard() {
    loadDashboardData();
    setupDashboardMenuItems();
    document.getElementById('page-title').textContent = 'Dashboard';
    showDashboardPage('overview');
    
    // Auto-refresh dashboard data every 10 seconds
    if (!app.dashboardRefreshInterval) {
        app.dashboardRefreshInterval = setInterval(() => {
            if (app.currentTab === 'overview') {
                loadDashboardData();
            }
        }, 10000);
    }
}

async function loadDashboardData() {
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        // Load restaurant data with timeout
        const restaurantDoc = await Promise.race([
            db.collection('restaurants').doc(app.currentRestaurantId).get(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Load timeout')), 5000)
            )
        ]);

        if (restaurantDoc.exists) {
            app.currentRestaurant = restaurantDoc.data();
        }
        
        const nameInput = document.getElementById('user-name');
        if (nameInput) {
            nameInput.textContent = app.currentRestaurant?.name || 'Restaurant';
        }
        
        // Load today's metrics
        const today = new Date().toDateString();
        const ordersSnapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('date', '==', today)
            .get();
        
        let todayRevenue = 0;
        let pendingOrders = 0;
        let completedOrders = 0;
        
        ordersSnapshot.forEach(doc => {
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
        if (ordersEl) ordersEl.textContent = ordersSnapshot.size;
        if (pendingEl) pendingEl.textContent = pendingOrders;
        if (completedEl) completedEl.textContent = completedOrders;
        
        // Load recent orders
        loadRecentOrders();
        
        // Load subscription info
        const renewalEl = document.getElementById('renewal-date');
        if (renewalEl) {
            renewalEl.textContent = app.currentRestaurant?.subscription?.expiryDate 
                ? new Date(app.currentRestaurant.subscription.expiryDate).toLocaleDateString()
                : 'Active';
        }
        
        const nameInput2 = document.getElementById('setting-name');
        const descInput = document.getElementById('setting-description');
        if (nameInput2) nameInput2.value = app.currentRestaurant?.name || '';
        if (descInput) descInput.value = app.currentRestaurant?.description || '';
    } catch (error) {
        console.warn('Error loading dashboard:', error.message);
        if (error.message && error.message.includes('offline')) {
            showNotification('You are offline. Some features may not work.', 'warning');
        } else {
            showNotification('Failed to load dashboard data', 'error');
        }
    }
}

async function loadRecentOrders() {
    if (!firebaseInitialized || !db) return;

    try {
        const ordersSnapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        const list = document.getElementById('recent-orders-list');
        if (!list) return;

        list.innerHTML = '';
        
        if (ordersSnapshot.empty) {
            list.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No orders yet</p>';
            return;
        }
        
        ordersSnapshot.forEach(doc => {
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
                        <div class="order-number" style="font-weight: 600;">Order #${order.orderId.substring(3, 13)}</div>
                        <div style="font-size: 0.85rem; color: #999;">Customer: <strong>${order.customerName || 'Guest'}</strong></div>
                    </div>
                    <span class="order-status" style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize;">${order.status}</span>
                </div>
                <div class="order-details" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9rem;">
                    <div class="order-detail">
                        <span style="color: #999; font-size: 0.8rem;">Table</span>
                        <strong>🪑 ${order.tableNumber}</strong>
                    </div>
                    <div class="order-detail">
                        <span style="color: #999; font-size: 0.8rem;">Items</span>
                        <strong>${order.items?.length || 0}</strong>
                    </div>
                    <div class="order-detail">
                        <span style="color: #999; font-size: 0.8rem;">Total</span>
                        <strong style="color: #10B981;">₹${(order.total || 0).toFixed(2)}</strong>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.warn('Error loading recent orders:', error.message);
    }
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
        loadOrders('all');
        // Auto-refresh orders every 5 seconds
        if (app.ordersRefreshInterval) {
            clearInterval(app.ordersRefreshInterval);
        }
        app.ordersRefreshInterval = setInterval(() => {
            loadOrders('all');
        }, 5000);
    } else if (pageName === 'kitchen') {
        loadKitchenDisplay();
        // Auto-refresh kitchen display every 5 seconds
        if (app.kitchenRefreshInterval) {
            clearInterval(app.kitchenRefreshInterval);
        }
        app.kitchenRefreshInterval = setInterval(() => {
            loadKitchenDisplay();
        }, 5000);
    } else if (pageName === 'overview') {
        loadDashboardData();
        // Auto-refresh dashboard every 10 seconds
        if (app.dashboardRefreshInterval) {
            clearInterval(app.dashboardRefreshInterval);
        }
        app.dashboardRefreshInterval = setInterval(() => {
            loadDashboardData();
        }, 10000);
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
    } catch (error) {
        console.error('Error loading menu:', error);
        showNotification('Failed to load menu', 'error');
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
}

function openFoodModal() {
    const modal = document.getElementById('food-modal').content.cloneNode(true);
    document.getElementById('app').appendChild(modal);
    
    // Load variants and addons after modal is added to DOM
    setTimeout(async () => {
        try {
            // Load variants
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

            // Load addons
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
        } catch (error) {
            console.error('Error loading variants and addons:', error);
        }
    }, 100);
}

function openCategoryModal() {
    const modal = document.getElementById('category-modal').content.cloneNode(true);
    document.getElementById('app').appendChild(modal);
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
            prepTime: parseInt(document.getElementById('foodPrepTime')?.value || 15),
            type: type,
            description: document.getElementById('foodDescription')?.value || '',
            bestSeller: document.getElementById('foodBestSeller')?.checked || false,
            popular: document.getElementById('foodPopular')?.checked || false,
            variants: selectedVariants,
            addons: selectedAddons,
            available: true,
            createdAt: new Date()
        };
        
        // Upload image if provided
        const imageInput = document.getElementById('foodImage');
        if (imageInput?.files && imageInput.files[0]) {
            foodData.image = await uploadImage(imageInput.files[0], `restaurants/${app.currentRestaurantId}/foods`);
        }
        
        await db.collection('foods').add(foodData);
        showNotification('Food item added successfully!', 'success');
        closeModal();
        loadMenuData();
    } catch (error) {
        console.error('Error saving food:', error);
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

        const categoryData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            description: document.getElementById('categoryDescription')?.value || '',
            createdAt: new Date()
        };
        
        await db.collection('categories').add(categoryData);
        showNotification('Category added successfully!', 'success');
        closeModal();
        loadMenuData();
    } catch (error) {
        console.error('Error saving category:', error);
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

        const variantData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            priceAdjustment: parseFloat(document.getElementById('variantPriceAdjust')?.value || 0),
            description: document.getElementById('variantDescription')?.value || '',
            createdAt: new Date()
        };
        
        await db.collection('variants').add(variantData);
        showNotification('Variant added successfully!', 'success');
        closeModal();
        loadMenuData();
    } catch (error) {
        console.error('Error saving variant:', error);
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

        const addonData = {
            restaurantId: app.currentRestaurantId,
            name: name,
            price: parseFloat(price),
            description: document.getElementById('addonDescription')?.value || '',
            createdAt: new Date()
        };
        
        await db.collection('addons').add(addonData);
        showNotification('Addon added successfully!', 'success');
        closeModal();
        loadMenuData();
    } catch (error) {
        console.error('Error saving addon:', error);
        showNotification('Failed to save addon', 'error');
    }
}

async function editFood(foodId) {
    try {
        const foodDoc = await db.collection('foods').doc(foodId).get();
        const food = foodDoc.data();
        
        // Open modal first to create DOM elements
        openFoodModal();
        
        // Wait for modal to be rendered, then populate fields
        setTimeout(() => {
            const foodNameEl = document.getElementById('foodName');
            if (foodNameEl) {
                document.getElementById('foodName').value = food.name || '';
                document.getElementById('foodCategory').value = food.category || '';
                document.getElementById('foodPrice').value = food.price || '';
                document.getElementById('foodDiscountPrice').value = food.discountPrice || '';
                document.getElementById('foodPrepTime').value = food.prepTime || 15;
                document.getElementById('foodType').value = food.type || '';
                document.getElementById('foodDescription').value = food.description || '';
                document.getElementById('foodBestSeller').checked = food.bestSeller || false;
                document.getElementById('foodPopular').checked = food.popular || false;
                
                document.getElementById('modal-title').textContent = 'Edit Food Item';
                
                // Update save button
                const saveBtn = document.querySelectorAll('.modal-footer button')[1];
                if (saveBtn) {
                    saveBtn.onclick = async function() {
                        try {
                            await db.collection('foods').doc(foodId).update({
                                name: document.getElementById('foodName').value,
                                category: document.getElementById('foodCategory').value,
                                price: parseFloat(document.getElementById('foodPrice').value),
                                discountPrice: document.getElementById('foodDiscountPrice').value ? parseFloat(document.getElementById('foodDiscountPrice').value) : null,
                                prepTime: parseInt(document.getElementById('foodPrepTime').value),
                                type: document.getElementById('foodType').value,
                                description: document.getElementById('foodDescription').value,
                                bestSeller: document.getElementById('foodBestSeller').checked,
                                popular: document.getElementById('foodPopular').checked,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            showNotification('Food item updated successfully!', 'success');
                            closeModal();
                            loadMenuData();
                        } catch (error) {
                            console.error('Error updating food:', error);
                            showNotification('Error updating food item', 'error');
                        }
                    };
                }
            }
        }, 100);
    } catch (error) {
        console.error('Error loading food:', error);
        showNotification('Error loading food item', 'error');
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
    if (!firebaseInitialized || !db) {
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        let query = db.collection('orders').where('restaurantId', '==', app.currentRestaurantId);
        
        if (filter !== 'all') {
            query = query.where('status', '==', filter);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
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
            order.items?.forEach(item => {
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
                        <div class="order-number" style="font-size: 1rem; font-weight: 600;">Order #${order.orderId.substring(3, 13)}</div>
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
                        <strong style="font-size: 1.1rem;">${order.items?.length || 0} items</strong>
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
                    ${order.status === 'pending' ? `<button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}', 'preparing')" style="background: #3B82F6;">Start</button>` : ''}
                    ${order.status === 'preparing' ? `<button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}', 'ready')" style="background: #F59E0B;">Ready</button>` : ''}
                    ${order.status !== 'completed' && order.status !== 'cancelled' ? `<button class="btn btn-sm btn-success" onclick="updateOrderStatus('${doc.id}', 'completed')">Done</button>` : ''}
                    ${order.status !== 'cancelled' && order.status !== 'completed' ? `<button class="btn btn-sm btn-danger" onclick="cancelOrder('${doc.id}')">Cancel</button>` : ''}
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Failed to load orders', 'error');
    }
}

function filterOrders(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    loadOrders(status);
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

// ============================================
// KITCHEN DISPLAY SYSTEM
// ============================================

async function loadKitchenDisplay() {
    try {
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('status', 'in', ['pending', 'preparing', 'ready'])
            .orderBy('createdAt', 'asc')
            .get();
        
        const display = document.getElementById('kitchen-display');
        display.innerHTML = '';
        
        if (snapshot.empty) {
            display.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><p style="font-size: 1.2rem;">✓ All orders completed</p><p>No active orders to prepare</p></div>';
            return;
        }

        snapshot.forEach(doc => {
            const order = doc.data();
            const card = document.createElement('div');
            card.className = 'kitchen-order';
            
            let statusColor = '#EF4444';
            let statusText = 'Pending';
            
            if (order.status === 'preparing') {
                card.style.borderTopColor = '#3B82F6';
                statusColor = '#3B82F6';
                statusText = 'Preparing';
            } else if (order.status === 'ready') {
                card.style.borderTopColor = '#10B981';
                statusColor = '#10B981';
                statusText = 'Ready';
            }
            
            // Get creation time
            let createdTime = '';
            if (order.createdAt) {
                const timestamp = order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt;
                const date = new Date(timestamp);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                createdTime = diffMins > 0 ? `${diffMins} mins ago` : 'just now';
            }
            
            let itemsList = '';
            order.items?.forEach(item => {
                itemsList += `
                    <div class="kitchen-item">
                        <div class="item-name"><strong>${item.quantity}x ${item.name}</strong></div>
                        <div class="item-qty">${item.type || 'Item'}</div>
                        ${item.specialInstructions ? `<div class="item-notes">📝 ${item.specialInstructions}</div>` : ''}
                    </div>
                `;
            });
            
            card.innerHTML = `
                <div class="kitchen-header">
                    <div class="kitchen-table">
                        <div style="font-size: 0.8rem; color: #999;">TABLE</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${order.tableNumber}</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.85rem; color: #999;">Customer: <strong>${order.customerName || 'Guest'}</strong></div>
                        <div style="font-size: 0.85rem; color: #999;">Order: <strong>#${order.orderId.substring(3, 13)}</strong></div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: #999;">${createdTime}</div>
                        <div style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-top: 4px; display: inline-block;">${statusText}</div>
                    </div>
                </div>
                <div class="kitchen-items">
                    ${itemsList}
                </div>
                <div class="kitchen-footer">
                    ${order.status !== 'preparing' ? `<button class="btn btn-primary" onclick="updateOrderStatus('${doc.id}', 'preparing')">🔄 Start Preparing</button>` : ''}
                    ${order.status === 'pending' ? `<button class="btn btn-secondary" onclick="updateOrderStatus('${doc.id}', 'ready')">⏭️ Mark Ready</button>` : ''}
                    ${order.status === 'preparing' ? `<button class="btn btn-success" onclick="updateOrderStatus('${doc.id}', 'ready')">✓ Mark Ready</button>` : ''}
                    ${order.status === 'ready' ? `<button class="btn btn-success" onclick="updateOrderStatus('${doc.id}', 'completed')" style="width: 100%;">✓ Completed</button>` : ''}
                </div>
            `;
            
            display.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading kitchen display:', error);
    }
}

// ============================================
// ANALYTICS
// ============================================

async function loadAnalytics() {
    try {
        // Load orders for last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', app.currentRestaurantId)
            .where('createdAt', '>=', sevenDaysAgo)
            .get();
        
        const revenueByDay = {};
        const ordersByDay = {};
        const foodCounts = {};
        
        snapshot.forEach(doc => {
            const order = doc.data();
            const date = new Date(order.createdAt.seconds * 1000).toLocaleDateString();
            
            revenueByDay[date] = (revenueByDay[date] || 0) + (order.total || 0);
            ordersByDay[date] = (ordersByDay[date] || 0) + 1;
            
            order.items?.forEach(item => {
                foodCounts[item.name] = (foodCounts[item.name] || 0) + item.quantity;
            });
        });
        
        // Draw revenue chart
        if (app.charts.revenue) {
            app.charts.revenue.destroy();
        }
        const revenueCtx = document.getElementById('revenue-chart').getContext('2d');
        app.charts.revenue = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: Object.keys(revenueByDay),
                datasets: [{
                    label: 'Daily Revenue',
                    data: Object.values(revenueByDay),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true
            }
        });
        
        // Draw orders chart
        if (app.charts.orders) {
            app.charts.orders.destroy();
        }
        const ordersCtx = document.getElementById('orders-chart').getContext('2d');
        app.charts.orders = new Chart(ordersCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(ordersByDay),
                datasets: [{
                    label: 'Orders',
                    data: Object.values(ordersByDay),
                    backgroundColor: '#10B981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true
            }
        });
        
        // Draw popular foods chart
        if (app.charts.foods) {
            app.charts.foods.destroy();
        }
        const foodsCtx = document.getElementById('foods-chart').getContext('2d');
        app.charts.foods = new Chart(foodsCtx, {
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
                maintainAspectRatio: true
            }
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// ============================================
// REVIEWS
// ============================================

async function loadReviews() {
    try {
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
    
    const qrLink = window.location.origin + '/menu?restaurant=' + app.currentRestaurantId;
    
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
        app.currentRestaurantId = restaurantId;
        
        // Load restaurant data
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (!restaurantDoc.exists) {
            navigateTo('landing');
            showNotification('Restaurant not found', 'error');
            return;
        }
        
        app.currentRestaurant = restaurantDoc.data();
        navigateTo('customer-menu');
    } catch (error) {
        console.error('Error loading customer menu:', error);
        showNotification('Failed to load restaurant', 'error');
    }
}

function setupCustomerMenu() {
    loadCustomerRestaurantData();
    loadCustomerMenuItems();
}

async function loadCustomerRestaurantData() {
    try {
        document.getElementById('restaurant-name-display').textContent = app.currentRestaurant.name || 'Restaurant';
        
        if (app.currentRestaurant.logo) {
            document.getElementById('restaurant-logo').innerHTML = `<img src="${app.currentRestaurant.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
        } else {
            document.getElementById('restaurant-logo').textContent = '🍽️';
        }
        
        // Check opening hours
        const now = new Date();
        const hours = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        const opening = app.currentRestaurant.openingTime;
        const closing = app.currentRestaurant.closingTime;
        
        const isOpen = hours >= opening && hours < closing;
        document.getElementById('restaurant-status').textContent = isOpen ? '🟢 Open' : '🔴 Closed';
        document.getElementById('restaurant-rating').textContent = '⭐ 4.5 (120 reviews)';
    } catch (error) {
        console.error('Error loading restaurant data:', error);
    }
}

async function loadCustomerMenuItems() {
    try {
        // Load categories
        const categoriesSnapshot = await db.collection('categories')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        const categoryScroll = document.getElementById('categories-scroll-list');
        categoryScroll.innerHTML = '';
        
        let firstCategory = null;
        
        categoriesSnapshot.forEach((doc, index) => {
            const cat = doc.data();
            if (index === 0) firstCategory = doc.id;
            
            const card = document.createElement('div');
            card.className = 'category-card ' + (index === 0 ? 'active' : '');
            card.innerHTML = `<strong>${cat.name}</strong>`;
            card.onclick = () => {
                document.querySelectorAll('.categories-scroll .category-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                loadFoodsForCategory(doc.id);
            };
            categoryScroll.appendChild(card);
        });
        
        // Load foods for first category
        if (firstCategory) {
            loadFoodsForCategory(firstCategory);
        } else {
            document.getElementById('foods-display').innerHTML = '<p>No items available</p>';
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('Failed to load menu', 'error');
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
        
        foodsSnapshot.forEach(doc => {
            const food = doc.data();
            const card = document.createElement('div');
            card.className = 'food-item-card';
            card.onclick = () => openFoodDetails(doc.id, food);
            
            let badgeHtml = '';
            if (food.bestSeller) badgeHtml += '<span class="food-badge">Bestseller</span>';
            if (food.popular) badgeHtml += '<span class="food-badge">Popular</span>';
            
            card.innerHTML = `
                <div class="food-item-image">
                    ${food.image ? `<img src="${food.image}" alt="${food.name}" style="width: 100%; height: 100%; object-fit: cover;">` : '🍜'}
                    ${badgeHtml}
                </div>
                <div class="food-item-info">
                    <div class="food-item-name">${food.name}</div>
                    <div class="food-item-category">${food.type}</div>
                    <div class="food-item-price">
                        <span class="current">₹${food.price}</span>
                        ${food.discountPrice ? `<span class="original">₹${food.discountPrice}</span>` : ''}
                    </div>
                    <div class="food-item-time">⏱️ ${food.prepTime} mins</div>
                </div>
            `;
            display.appendChild(card);
        });
        
        if (foodsSnapshot.empty) {
            display.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No items in this category</p>';
        }
    } catch (error) {
        console.error('Error loading foods:', error);
    }
}

function openFoodDetails(foodId, foodData) {
    // For now, add to cart directly
    // TODO: Open detailed view
    addToCart(foodId, foodData);
}

function searchFoods() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    // TODO: Implement search
}

async function addToCart(foodId, foodData) {
    const key = foodId;
    if (app.cart[key]) {
        app.cart[key].quantity += 1;
    } else {
        app.cart[key] = {
            id: foodId,
            name: foodData.name,
            price: foodData.price,
            image: foodData.image,
            category: foodData.category,
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
    
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    
    document.getElementById('subtotal').textContent = '₹' + subtotal.toFixed(2);
    document.getElementById('tax').textContent = '₹' + tax.toFixed(2);
    document.getElementById('total').textContent = '₹' + total.toFixed(2);
    document.getElementById('cart-count').textContent = items.length;
}

async function placeOrder() {
    const items = Object.values(app.cart);
    
    if (items.length === 0) {
        showNotification('Cart is empty!', 'error');
        return;
    }
    
    if (!app.selectedTable) {
        const tableNum = prompt('Select table number (1-' + app.currentRestaurant.tableCount + ')');
        if (!tableNum) return;
        app.selectedTable = parseInt(tableNum);
    }

    const customerName = prompt('Enter your name (for kitchen reference):');
    if (!customerName) return;
    
    try {
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.05;
        const total = subtotal + tax;
        
        const orderRef = await db.collection('orders').add({
            restaurantId: app.currentRestaurantId,
            orderId: 'ORD' + Date.now(),
            tableNumber: app.selectedTable,
            customerName: customerName,
            items: items,
            subtotal: subtotal,
            tax: tax,
            total: total,
            status: 'pending',
            paymentStatus: 'pending',
            date: new Date().toDateString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            specialInstructions: ''
        });
        
        // Clear cart
        app.cart = {};
        updateCartDisplay();
        
        // Show success message
        showNotification('Order #' + orderRef.id.substring(0, 8).toUpperCase() + ' placed! Kitchen is preparing your food.', 'success');
        
        // Show order details
        setTimeout(() => {
            navigateTo('landing');
        }, 3000);
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

async function uploadImage(file, path) {
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

async function loadOffers() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) return;
        
        const offersSnapshot = await db.collection('offers')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const offersList = document.getElementById('offers-list');
        
        if (offersSnapshot.empty) {
            offersList.innerHTML = '<p class="empty-state">No offers created yet</p>';
            return;
        }
        
        let html = '';
        offersSnapshot.forEach(doc => {
            const offer = doc.data();
            const isActive = offer.isActive ? 'Active' : 'Inactive';
            const badge = offer.isActive ? 'var(--success)' : 'var(--danger)';
            const discountText = offer.discountType === 'Percentage' ? 
                `${offer.discountValue}% OFF` : 
                `₹${offer.discountValue} OFF`;
            
            html += `
                <div class="offer-item">
                    <div class="offer-details">
                        <h3>${offer.name}</h3>
                        <span class="offer-badge">${discountText}</span>
                        <p class="offer-meta">Valid: ${offer.startDate} to ${offer.endDate}</p>
                        <p class="offer-meta">${offer.description}</p>
                    </div>
                    <div class="offer-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editOffer('${doc.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteOffer('${doc.id}')">Delete</button>
                    </div>
                </div>
            `;
        });
        
        offersList.innerHTML = html;
    } catch (error) {
        console.error('Error loading offers:', error);
        showNotification('Error loading offers', 'error');
    }
}

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
            const subEndDate = restaurant.subscription.expiryDate || 'N/A';
            
            subInfo.innerHTML = `
                <p><strong>Status:</strong> <span style="color: ${subStatus === 'active' ? 'var(--success)' : 'var(--danger)'}">${subStatus.toUpperCase()}</span></p>
                <p><strong>Plan:</strong> ${restaurant.subscription.plan || 'Premium'}</p>
                <p><strong>Expires:</strong> ${subEndDate}</p>
                <p><strong>Price:</strong> ₹${restaurant.subscription.amount || '199'}/month</p>
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
// ENHANCED CATEGORY MANAGEMENT
// ============================================

async function loadCategories() {
    try {
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('categories')
            .where('restaurantId', '==', app.currentRestaurantId)
            .orderBy('position', 'asc')
            .get();
        
        app.categories = [];
        const list = document.getElementById('categories-list') || document.querySelector('.categories-list');
        if (!list) return;
        
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
            card.innerHTML = `
                <div class="category-header">
                    <div class="category-info">
                        <h3>${cat.name}</h3>
                        <p>${cat.description || 'No description'}</p>
                    </div>
                    <span class="badge ${cat.hidden ? 'badge-danger' : 'badge-success'}">${cat.hidden ? 'Hidden' : 'Visible'}</span>
                </div>
                <div class="category-stats">
                    <div class="stat">
                        <span class="stat-label">Foods</span>
                        <span class="stat-value">0</span>
                    </div>
                </div>
                <div class="category-actions">
                    <button class="btn btn-primary btn-sm" onclick="editCategory('${doc.id}')">📝 Edit</button>
                    <button class="btn btn-sm" onclick="toggleCategoryVisibility('${doc.id}', ${cat.hidden})">${cat.hidden ? '👁️ Show' : '🙈 Hide'}</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteCategory('${doc.id}')">🗑️ Delete</button>
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
    const name = prompt('Category Name (e.g., Starters, Main Course, Drinks):');
    if (!name) return;
    
    const description = prompt('Category Description (optional):') || '';
    
    try {
        await db.collection('categories').add({
            restaurantId: app.currentRestaurantId,
            name: name,
            description: description,
            hidden: false,
            position: app.categories.length,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadCategories();
        showNotification('Category added successfully', 'success');
    } catch (error) {
        console.error('Error adding category:', error);
        showNotification('Error adding category', 'error');
    }
}

async function editCategory(categoryId) {
    const cat = app.categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    const newName = prompt('Edit Category Name:', cat.name);
    if (!newName) return;
    
    const newDesc = prompt('Edit Category Description:', cat.description || '');
    
    try {
        await db.collection('categories').doc(categoryId).update({
            name: newName,
            description: newDesc,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
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

// ============================================
// ENHANCED FOOD MANAGEMENT
// ============================================

async function loadFoods() {
    try {
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('foods')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.foods = [];
        const list = document.getElementById('foods-list') || document.querySelector('.foods-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><p>No food items yet. Add your first dish!</p><button class="btn btn-primary" onclick="openAddFoodModal()">+ Add Food</button></div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const food = doc.data();
            app.foods.push({ id: doc.id, ...food });
            
            const card = document.createElement('div');
            card.className = 'food-card premium-card';
            card.innerHTML = `
                <div class="food-image-container">
                    ${food.images && food.images.length > 0 ? `<img src="${food.images[0]}" alt="${food.name}" class="food-image">` : '<div class="food-image-placeholder">🍽️</div>'}
                    <div class="food-badges">
                        ${food.veg ? '<span class="badge-veg">🥬 Veg</span>' : ''}
                        ${food.nonVeg ? '<span class="badge-nonveg">🍗 Non-Veg</span>' : ''}
                        ${food.bestseller ? '<span class="badge-bestseller">⭐ Bestseller</span>' : ''}
                        ${food.recommended ? '<span class="badge-recommended">💎 Recommended</span>' : ''}
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
                    <button class="btn btn-sm" onclick="toggleFoodVisibility('${doc.id}', ${food.hidden})">${food.hidden ? '👁️ Show' : '🙈 Hide'}</button>
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
    showNotification('Food creation modal coming soon. Use the add button in Foods section.', 'info');
}

async function editFood(foodId) {
    const food = app.foods.find(f => f.id === foodId);
    if (!food) return;
    
    showNotification('Food editing features with image upload coming soon', 'info');
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

async function toggleFoodVisibility(foodId, isHidden) {
    try {
        await db.collection('foods').doc(foodId).update({
            hidden: !isHidden,
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

// ============================================
// VARIANTS MANAGEMENT
// ============================================

async function loadVariants() {
    try {
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('variants')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.variants = [];
        const list = document.getElementById('variants-list') || document.querySelector('.variants-list');
        if (!list) return;
        
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
            card.innerHTML = `
                <div class="variant-info">
                    <h4>${variant.name}</h4>
                    <span class="badge">₹${variant.price}</span>
                </div>
                <div class="variant-actions">
                    <button class="btn btn-primary btn-sm" onclick="editVariant('${doc.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteVariant('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading variants:', error);
        showNotification('Error loading variants', 'error');
    }
}

async function openAddVariantModal() {
    const name = prompt('Variant Name (e.g., Small, Medium, Large):');
    if (!name) return;
    
    const price = parseFloat(prompt('Price:') || '0');
    
    try {
        await db.collection('variants').add({
            restaurantId: app.currentRestaurantId,
            name: name,
            price: price,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadVariants();
        showNotification('Variant added successfully', 'success');
    } catch (error) {
        console.error('Error adding variant:', error);
        showNotification('Error adding variant', 'error');
    }
}

async function editVariant(variantId) {
    const variant = app.variants.find(v => v.id === variantId);
    if (!variant) return;
    
    const newName = prompt('Edit Variant Name:', variant.name);
    if (!newName) return;
    
    const newPrice = parseFloat(prompt('Edit Price:', variant.price));
    
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
        if (!firebaseInitialized || !db) return;
        
        const snapshot = await db.collection('addons')
            .where('restaurantId', '==', app.currentRestaurantId)
            .get();
        
        app.addons = [];
        const list = document.getElementById('addons-list') || document.querySelector('.addons-list');
        if (!list) return;
        
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
            card.innerHTML = `
                <div class="addon-info">
                    <h4>${addon.name}</h4>
                    <p>${addon.description || ''}</p>
                    <span class="badge">₹${addon.price}</span>
                </div>
                <div class="addon-actions">
                    <button class="btn btn-primary btn-sm" onclick="editAddon('${doc.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteAddon('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading addons:', error);
        showNotification('Error loading addons', 'error');
    }
}

async function openAddAddonModal() {
    const name = prompt('Addon Name (e.g., Extra Cheese, Extra Sauce):');
    if (!name) return;
    
    const price = parseFloat(prompt('Addon Price:') || '0');
    const description = prompt('Description (optional):') || '';
    
    try {
        await db.collection('addons').add({
            restaurantId: app.currentRestaurantId,
            name: name,
            price: price,
            description: description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadAddons();
        showNotification('Addon added successfully', 'success');
    } catch (error) {
        console.error('Error adding addon:', error);
        showNotification('Error adding addon', 'error');
    }
}

async function editAddon(addonId) {
    const addon = app.addons.find(a => a.id === addonId);
    if (!addon) return;
    
    const newName = prompt('Edit Addon Name:', addon.name);
    if (!newName) return;
    
    const newPrice = parseFloat(prompt('Edit Price:', addon.price));
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
                        <div class="upload-area">🏪 ${rest.logo ? 'Logo Uploaded' : 'Upload Logo'}</div>
                    </div>
                    <div class="image-upload">
                        <div class="upload-area">🖼️ ${rest.banner ? 'Banner Uploaded' : 'Upload Banner'}</div>
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
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error loading profile', 'error');
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
// ERROR HANDLING
// ============================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('An error occurred. Please refresh the page.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An error occurred. Please try again.', 'error');
});