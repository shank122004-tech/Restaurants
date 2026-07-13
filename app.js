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
let isSigningIn = false; // Track if user is in the signing-in process

// ═══════════════════════════════════════════════════════════════════════════════
// LISTENER MANAGEMENT - OPTIMIZED TO PREVENT AGGRESSIVE READS
// ═══════════════════════════════════════════════════════════════════════════════
let activeListeners = {
    orders: null,
    kitchen: null
};

function cleanupAllListeners() {
    try {
        if (activeListeners.orders) {
            activeListeners.orders();
            activeListeners.orders = null;
        }
        if (activeListeners.kitchen) {
            activeListeners.kitchen();
            activeListeners.kitchen = null;
        }
        console.log('[Listeners] All listeners cleaned up');
    } catch (error) {
        console.error('[Listeners] Error during cleanup:', error);
    }
}

// Cleanup on page exit
window.addEventListener('beforeunload', cleanupAllListeners);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('[Listeners] Page hidden - cleaning up');
        cleanupAllListeners();
    }
});
window.addEventListener('hashchange', cleanupAllListeners);

// ═══════════════════════════════════════════════════════════════════════════════
// MENU DATA CACHING - PREVENT REPEATED READS
// ═══════════════════════════════════════════════════════════════════════════════
let menuCache = {};
const MENU_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function loadMenuDataOptimized(restaurantId) {
    try {
        // Check cache first
        if (menuCache[restaurantId]) {
            const cached = menuCache[restaurantId];
            if (Date.now() - cached.timestamp < MENU_CACHE_DURATION) {
                console.log('[MenuCache] Using cached menu for:', restaurantId);
                return cached.data;
            }
        }

        console.log('[MenuCache] Loading fresh menu for:', restaurantId);

        // Load all in parallel with LIMITS to prevent read explosion
        const [categoriesSnapshot, variantsSnapshot, addonsSnapshot, foodsSnapshot] = await Promise.all([
            db.collection('categories')
                .where('restaurantId', '==', restaurantId)
                .limit(100)
                .get(),
            db.collection('variants')
                .where('restaurantId', '==', restaurantId)
                .limit(1000)
                .get(),
            db.collection('addons')
                .where('restaurantId', '==', restaurantId)
                .limit(500)
                .get(),
            db.collection('foods')
                .where('restaurantId', '==', restaurantId)
                .limit(500)
                .get()
        ]);

        const menuData = {
            categories: categoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
            variants: variantsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
            addons: addonsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
            foods: foodsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        };

        // Store in cache
        menuCache[restaurantId] = {
            data: menuData,
            timestamp: Date.now()
        };

        console.log('[MenuCache] Menu cached for:', restaurantId);
        return menuData;

    } catch (error) {
        console.error('[MenuCache] Error loading menu:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PROFESSIONAL CATEGORY ICONS - SVG BASED ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const ProfessionalCategoryIcons = {
    burger: { name: 'Burger', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="45" width="70" height="8" fill="#D2691E" rx="2"/><ellipse cx="50" cy="45" rx="35" ry="8" fill="#E8A76A"/><rect x="20" y="30" width="60" height="15" fill="#228B22" rx="2"/><circle cx="30" cy="37" r="2" fill="#FFD700"/><circle cx="45" cy="35" r="2" fill="#FFD700"/><circle cx="60" cy="38" r="2" fill="#FFD700"/><ellipse cx="50" cy="53" rx="35" ry="7" fill="#D2691E"/><circle cx="35" cy="53" r="1.5" fill="#CD853F"/><circle cx="50" cy="54" r="1.5" fill="#CD853F"/><circle cx="65" cy="52" r="1.5" fill="#CD853F"/><rect x="15" y="60" width="70" height="8" fill="#D2691E" rx="2"/></svg>' },
    pizza: { name: 'Pizza', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 15 L85 80 Q50 90 15 80 Z" fill="#F4A460"/><circle cx="45" cy="45" r="4" fill="#FF0000"/><circle cx="55" cy="50" r="4" fill="#FF0000"/><circle cx="50" cy="60" r="4" fill="#FF0000"/><circle cx="40" cy="65" r="3.5" fill="#228B22"/><circle cx="60" cy="65" r="3.5" fill="#228B22"/><ellipse cx="50" cy="55" rx="3" ry="2.5" fill="#FFD700"/><ellipse cx="45" cy="70" rx="2.5" ry="2" fill="#FFD700"/><path d="M50 15 L50 85" stroke="#8B4513" stroke-width="1" fill="none"/></svg>' },
    chicken: { name: 'Chicken', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="28" ry="35" fill="#DAA520"/><path d="M35 70 Q30 80 28 90" stroke="#8B4513" stroke-width="2" fill="none"/><path d="M65 70 Q70 80 72 90" stroke="#8B4513" stroke-width="2" fill="none"/><circle cx="40" cy="35" r="3" fill="#FFD700"/><circle cx="50" cy="32" r="3" fill="#FFD700"/><circle cx="60" cy="35" r="3" fill="#FFD700"/><path d="M48 20 L50 15 L52 20" fill="#FF6347"/><ellipse cx="50" cy="60" rx="15" ry="12" fill="#DEB887" opacity="0.6"/><circle cx="35" cy="50" r="2.5" fill="#8B4513"/><circle cx="65" cy="50" r="2.5" fill="#8B4513"/></svg>' },
    noodles: { name: 'Noodles', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="55" rx="35" ry="28" fill="#F5DEB3"/><path d="M20 50 Q25 40 30 45" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M35 35 Q40 30 45 38" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M55 35 Q60 28 65 37" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M70 45 Q75 40 80 50" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="35" cy="55" r="3" fill="#FF6347"/><circle cx="50" cy="50" r="3" fill="#FF6347"/><circle cx="65" cy="58" r="3" fill="#FF6347"/><ellipse cx="50" cy="82" rx="38" ry="8" fill="#CD853F" rx="3"/><rect x="20" y="75" width="60" height="3" fill="#8B4513" rx="1.5"/></svg>' },
    salad: { name: 'Salad', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="32" ry="25" fill="#FFB6C1"/><path d="M30 55 L28 35" stroke="#228B22" stroke-width="2" fill="none"/><path d="M50 50 L50 25" stroke="#228B22" stroke-width="2" fill="none"/><path d="M70 55 L72 35" stroke="#228B22" stroke-width="2" fill="none"/><circle cx="25" cy="30" r="4" fill="#228B22"/><circle cx="50" cy="20" r="4.5" fill="#228B22"/><circle cx="75" cy="28" r="4" fill="#228B22"/><circle cx="35" cy="60" r="2.5" fill="#FF0000"/><circle cx="50" cy="65" r="2.5" fill="#FF0000"/><circle cx="65" cy="62" r="2.5" fill="#FF0000"/><circle cx="45" cy="55" r="2" fill="#FFD700"/><circle cx="55" cy="58" r="2" fill="#FFD700"/><ellipse cx="50" cy="80" rx="35" ry="10" fill="#D2B48C"/></svg>' },
    coffee: { name: 'Coffee', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="35" width="45" height="40" fill="#8B6F47" rx="3"/><rect x="25" y="35" width="45" height="28" fill="#3E2723" rx="3"/><path d="M72 45 Q78 40 78 55 Q78 65 72 70" stroke="#8B6F47" stroke-width="3" fill="none"/><rect x="27" y="37" width="41" height="3" fill="#A0826D"/><ellipse cx="50" cy="30" rx="24" ry="6" fill="#D4AF37"/><rect x="28" y="77" width="44" height="4" fill="#8B6F47"/><circle cx="40" cy="48" r="1.5" fill="#F5DEB3" opacity="0.6"/><circle cx="50" cy="45" r="1.5" fill="#F5DEB3" opacity="0.6"/><circle cx="60" cy="50" r="1.5" fill="#F5DEB3" opacity="0.6"/></svg>' },
    drink: { name: 'Beverage', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="25" width="30" height="50" fill="#B0E0E6" rx="3"/><path d="M30 25 Q25 20 35 15 L65 15 Q75 20 70 25" fill="#87CEEB"/><rect x="50" y="20" width="8" height="15" fill="#CD853F"/><ellipse cx="45" cy="75" rx="18" ry="6" fill="#B0E0E6"/><line x1="35" y1="45" x2="55" y2="45" stroke="#87CEEB" stroke-width="1.5" opacity="0.5"/><circle cx="38" cy="50" r="1" fill="#FFD700"/><circle cx="50" cy="48" r="1" fill="#FFD700"/><circle cx="48" cy="60" r="1" fill="#FFD700"/><path d="M32 70 L32 75 M50 70 L50 75" stroke="#999" stroke-width="0.5" opacity="0.5"/></svg>' },
    fish: { name: 'Seafood', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="25" ry="20" fill="#FF8C00"/><path d="M75 50 L85 40 L85 60 Z" fill="#FF8C00"/><path d="M40 35 Q45 30 50 35" stroke="#FFD700" stroke-width="1.5" fill="none"/><circle cx="60" cy="48" r="2.5" fill="#000"/><path d="M48 55 Q50 60 52 55" stroke="#FFA500" stroke-width="1.5" fill="none"/><path d="M35 48 L28 45 L32 50 L28 55 L35 52" fill="#FFD700"/><circle cx="45" cy="48" r="1" fill="#FFD700"/><circle cx="55" cy="45" r="1" fill="#FFD700"/><ellipse cx="50" cy="65" rx="12" ry="4" fill="#654321" opacity="0.3"/></svg>' },
    biryani: { name: 'Biryani', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="55" rx="35" ry="28" fill="#CD853F"/><circle cx="35" cy="45" r="3" fill="#FFD700"/><circle cx="50" cy="40" r="3" fill="#FFD700"/><circle cx="65" cy="48" r="3" fill="#FFD700"/><circle cx="40" cy="60" r="2.5" fill="#228B22"/><circle cx="55" cy="62" r="2.5" fill="#228B22"/><circle cx="70" cy="58" r="2.5" fill="#228B22"/><path d="M30 50 L28 30" stroke="#D2691E" stroke-width="1.5" fill="none"/><path d="M70 50 L72 30" stroke="#D2691E" stroke-width="1.5" fill="none"/><rect x="20" y="75" width="60" height="4" fill="#A0522D" rx="2"/><circle cx="45" cy="55" r="1.5" fill="#FF6347"/><circle cx="55" cy="58" r="1.5" fill="#FF6347"/></svg>' },
    soup: { name: 'Soup', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 50 L35 80 L65 80 L70 50 Z" fill="#FFB347" stroke="#8B4513" stroke-width="1.5"/><ellipse cx="50" cy="50" rx="20" ry="8" fill="#FFD700" stroke="#8B4513" stroke-width="1"/><path d="M45 30 L50 50" stroke="#D2691E" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M55 28 L60 48" stroke="#D2691E" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="45" cy="60" r="2" fill="#228B22"/><circle cx="55" cy="65" r="2" fill="#228B22"/><circle cx="50" cy="70" r="1.5" fill="#FF6347"/><path d="M35 50 Q40 45 45 50" stroke="#FFA500" stroke-width="1" fill="none" opacity="0.6"/></svg>' },
    dessert: { name: 'Dessert', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="30" ry="20" fill="#FFB6C1"/><path d="M50 40 L55 50 L50 60 L45 50 Z" fill="#FF69B4"/><path d="M35 58 L38 45 L42 55 Z" fill="#FFD700"/><path d="M65 58 L62 45 L58 55 Z" fill="#FFD700"/><circle cx="45" cy="60" r="2" fill="#FF0000"/><circle cx="55" cy="62" r="2" fill="#FF0000"/><circle cx="50" cy="70" r="1.5" fill="#00CED1"/><rect x="20" y="78" width="60" height="5" fill="#D2691E" rx="2"/><ellipse cx="50" cy="78" rx="32" ry="4" fill="#CD853F"/></svg>' },
    bread: { name: 'Bread', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 30 Q30 25 50 20 Q70 25 70 30 L65 75 Q65 80 50 80 Q35 80 35 75 Z" fill="#D2B48C"/><path d="M30 30 L70 30" stroke="#8B4513" stroke-width="2"/><line x1="38" y1="30" x2="37" y2="70" stroke="#8B4513" stroke-width="1.5"/><line x1="50" y1="30" x2="50" y2="75" stroke="#8B4513" stroke-width="1.5"/><line x1="62" y1="30" x2="63" y2="70" stroke="#8B4513" stroke-width="1.5"/><circle cx="40" cy="50" r="1" fill="#CD853F"/><circle cx="50" cy="55" r="1" fill="#CD853F"/><circle cx="60" cy="48" r="1" fill="#CD853F"/></svg>' },
    rice: { name: 'Rice', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="35" ry="25" fill="#F5DEB3"/><g stroke="#DAA520" stroke-width="1.5" fill="none"><line x1="30" y1="50" x2="28" y2="35"/><line x1="40" y1="45" x2="38" y2="25"/><line x1="50" y1="40" x2="50" y2="20"/><line x1="60" y1="45" x2="62" y2="25"/><line x1="70" y1="50" x2="72" y2="35"/></g><circle cx="35" cy="55" r="1.5" fill="#FFD700"/><circle cx="50" cy="58" r="1.5" fill="#FFD700"/><circle cx="65" cy="60" r="1.5" fill="#FFD700"/><ellipse cx="50" cy="82" rx="38" ry="8" fill="#CD853F" rx="3"/></svg>' },
    sandwich: { name: 'Sandwich', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="30" width="60" height="8" fill="#D2691E" rx="2"/><rect x="22" y="38" width="56" height="6" fill="#228B22"/><rect x="22" y="44" width="56" height="5" fill="#FFD700"/><rect x="22" y="49" width="56" height="5" fill="#FF6347"/><rect x="22" y="54" width="56" height="5" fill="#FFA500"/><circle cx="28" cy="62" r="1.5" fill="#228B22"/><circle cx="50" cy="61" r="1.5" fill="#228B22"/><circle cx="72" cy="63" r="1.5" fill="#228B22"/><rect x="20" y="62" width="60" height="8" fill="#D2691E" rx="2"/><line x1="30" y1="30" x2="32" y2="70" stroke="#8B4513" stroke-width="0.5" opacity="0.5"/></svg>' },
    frenchfries: { name: 'Fries', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="12" height="55" fill="#CD853F" rx="2"/><rect x="45" y="15" width="12" height="60" fill="#D2691E" rx="2"/><rect x="60" y="22" width="12" height="53" fill="#CD853F" rx="2"/><circle cx="36" cy="20" r="2" fill="#FFD700"/><circle cx="51" cy="15" r="2" fill="#FFD700"/><circle cx="66" cy="22" r="2" fill="#FFD700"/><rect x="25" y="75" width="50" height="12" fill="#E8A76A" rx="2"/><ellipse cx="50" cy="81" rx="28" ry="5" fill="#DAA520"/></svg>' },
    icecream: { name: 'Ice Cream', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="45" rx="20" ry="22" fill="#FFB6C1"/><path d="M35 60 L40 85 L60 85 L65 60 Z" fill="#D2691E"/><circle cx="45" cy="40" r="2" fill="#FFD700"/><circle cx="55" cy="42" r="2" fill="#FFD700"/><circle cx="50" cy="52" r="2" fill="#FFD700"/><path d="M40 60 L45 75" stroke="#8B4513" stroke-width="1" opacity="0.5"/><path d="M60 60 L55 75" stroke="#8B4513" stroke-width="1" opacity="0.5"/><ellipse cx="50" cy="60" rx="18" ry="6" fill="#FFC0CB" opacity="0.6"/></svg>' },
    veg: { name: 'Vegetarian', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="28" fill="#90EE90"/><path d="M50 30 Q55 35 50 45 Q45 35 50 30" fill="#228B22"/><circle cx="40" cy="55" r="4" fill="#FFD700"/><circle cx="60" cy="55" r="4" fill="#FFD700"/><circle cx="45" cy="68" r="3" fill="#FF6347"/><circle cx="55" cy="68" r="3" fill="#FF6347"/><path d="M48 50 L48 60" stroke="#228B22" stroke-width="1" opacity="0.5"/><path d="M52 50 L52 60" stroke="#228B22" stroke-width="1" opacity="0.5"/></svg>' },
    hotdog: { name: 'Hot Dog', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="35" width="50" height="10" fill="#D2691E" rx="3"/><ellipse cx="50" cy="45" rx="28" ry="6" fill="#DAA520"/><path d="M28 40 Q35 38 50 37 Q65 38 72 40" stroke="#FFD700" stroke-width="1.5" fill="none"/><path d="M28 50 Q35 52 50 53 Q65 52 72 50" stroke="#FF6347" stroke-width="1.5" fill="none"/><rect x="20" y="45" width="8" height="10" fill="#F5DEB3"/><rect x="72" y="45" width="8" height="10" fill="#F5DEB3"/></svg>' },
    tacos: { name: 'Tacos', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 35 Q50 30 70 35 L75 55 Q50 65 25 55 Z" fill="#D2691E" opacity="0.8"/><path d="M32 38 Q50 35 68 38" stroke="#FFD700" stroke-width="1.5" fill="none"/><circle cx="40" cy="45" r="2" fill="#228B22"/><circle cx="50" cy="46" r="2" fill="#FF6347"/><circle cx="60" cy="45" r="2" fill="#228B22"/><ellipse cx="50" cy="55" rx="22" ry="4" fill="#CD853F"/></svg>' },
    curry: { name: 'Curry', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="35" ry="25" fill="#CD853F"/><circle cx="38" cy="50" r="3" fill="#FFD700"/><circle cx="50" cy="48" r="3" fill="#FFD700"/><circle cx="62" cy="52" r="3" fill="#FFD700"/><circle cx="42" cy="65" r="2" fill="#228B22"/><circle cx="55" cy="68" r="2" fill="#228B22"/><circle cx="65" cy="63" r="2" fill="#228B22"/><ellipse cx="50" cy="85" rx="36" ry="6" fill="#A0522D" rx="3"/></svg>' },
    tandoori: { name: 'Tandoori', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="28" ry="35" fill="#8B4513"/><path d="M35 70 Q30 80 28 90" stroke="#A0522D" stroke-width="2" fill="none"/><path d="M65 70 Q70 80 72 90" stroke="#A0522D" stroke-width="2" fill="none"/><circle cx="40" cy="35" r="2.5" fill="#FF6347"/><circle cx="50" cy="32" r="2.5" fill="#FF6347"/><circle cx="60" cy="35" r="2.5" fill="#FF6347"/><circle cx="42" cy="50" r="2" fill="#FFD700"/><circle cx="58" cy="50" r="2" fill="#FFD700"/></svg>' },
    dosa: { name: 'Dosa', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="55" rx="38" ry="20" fill="#DAA520" transform="rotate(15 50 55)"/><path d="M25 50 Q50 40 75 50" stroke="#D2691E" stroke-width="1.5" fill="none" opacity="0.5"/><circle cx="40" cy="55" r="2" fill="#FF6347"/><circle cx="50" cy="52" r="2" fill="#228B22"/><circle cx="60" cy="58" r="2" fill="#FFD700"/><ellipse cx="50" cy="75" rx="38" ry="6" fill="#8B4513" opacity="0.3"/></svg>' },
    kebab: { name: 'Kebab', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="45" y="20" width="10" height="60" fill="#8B4513" rx="2"/><circle cx="50" cy="30" r="6" fill="#CD853F"/><circle cx="50" cy="42" r="6" fill="#FF6347"/><circle cx="50" cy="54" r="6" fill="#228B22"/><circle cx="50" cy="66" r="6" fill="#DAA520"/><rect x="30" y="78" width="40" height="8" fill="#D2B48C" rx="2"/></svg>' },
    paneer: { name: 'Paneer', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g stroke="#D2B48C" stroke-width="2" fill="none"><rect x="25" y="30" width="15" height="15"/><rect x="45" y="30" width="15" height="15"/><rect x="65" y="30" width="10" height="15"/><rect x="25" y="50" width="15" height="15"/><rect x="45" y="50" width="15" height="15"/><rect x="65" y="50" width="10" height="15"/><rect x="30" y="70" width="40" height="10"/></g></svg>' },
    vegan: { name: 'Vegan', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="28" fill="#7CB342"/><path d="M50 28 L60 45 L70 50 L60 55 L50 72 L40 55 L30 50 L40 45 Z" fill="#689F38"/><circle cx="35" cy="35" r="3" fill="#C8E6C9"/><circle cx="65" cy="35" r="3" fill="#C8E6C9"/></svg>' },
    samosa: { name: 'Samosa', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 20 L75 65 L25 65 Z" fill="#D2691E"/><path d="M50 30 L65 60 L35 60 Z" fill="#DAA520"/><circle cx="48" cy="48" r="1.5" fill="#228B22"/><circle cx="50" cy="50" r="1.5" fill="#228B22"/><circle cx="52" cy="48" r="1.5" fill="#228B22"/></svg>' },
    chaat: { name: 'Chaat', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="35" ry="20" fill="#DAA520"/><path d="M30 50 L32 35" stroke="#D2691E" stroke-width="1.5" fill="none"/><path d="M50 48 L50 25" stroke="#D2691E" stroke-width="1.5" fill="none"/><path d="M70 50 L68 35" stroke="#D2691E" stroke-width="1.5" fill="none"/><circle cx="38" cy="60" r="2" fill="#FF6347"/><circle cx="50" cy="62" r="2" fill="#228B22"/><circle cx="62" cy="60" r="2" fill="#FFD700"/></svg>' },
    idli: { name: 'Idli', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g><ellipse cx="35" cy="50" rx="15" ry="22" fill="#F5DEB3"/><ellipse cx="50" cy="50" rx="15" ry="22" fill="#F5DEB3"/><ellipse cx="65" cy="50" rx="15" ry="22" fill="#F5DEB3"/><ellipse cx="35" cy="50" rx="13" ry="20" fill="#E8D4B0"/><ellipse cx="50" cy="50" rx="13" ry="20" fill="#E8D4B0"/><ellipse cx="65" cy="50" rx="13" ry="20" fill="#E8D4B0"/></g></svg>' },
    uttapam: { name: 'Uttapam', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="35" fill="#DAA520"/><circle cx="50" cy="50" r="32" fill="#F5DEB3"/><circle cx="35" cy="45" r="2.5" fill="#FF0000"/><circle cx="50" cy="42" r="2.5" fill="#228B22"/><circle cx="65" cy="45" r="2.5" fill="#FFD700"/><circle cx="42" cy="60" r="2" fill="#FF0000"/><circle cx="58" cy="62" r="2" fill="#228B22"/></svg>' },
    naan: { name: 'Naan', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="55" rx="32" ry="28" fill="#CD853F"/><path d="M35 40 Q40 35 45 40" stroke="#8B4513" stroke-width="1.5" fill="none" opacity="0.6"/><path d="M55 40 Q60 35 65 40" stroke="#8B4513" stroke-width="1.5" fill="none" opacity="0.6"/><circle cx="40" cy="55" r="1.5" fill="#D2691E"/><circle cx="50" cy="57" r="1.5" fill="#D2691E"/><circle cx="60" cy="54" r="1.5" fill="#D2691E"/></svg>' },
    roti: { name: 'Roti', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="35" fill="#D2B48C"/><circle cx="50" cy="50" r="32" fill="#E8C59C"/><path d="M35 50 L65 50 M50 35 L50 65" stroke="#A0826D" stroke-width="1.5" opacity="0.5"/><circle cx="45" cy="48" r="1" fill="#8B6F47"/><circle cx="55" cy="52" r="1" fill="#8B6F47"/></svg>' },
    thali: { name: 'Thali', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="38" fill="#DAA520" stroke="#8B4513" stroke-width="1"/><circle cx="35" cy="40" r="8" fill="#FFB347"/><circle cx="65" cy="40" r="8" fill="#228B22"/><circle cx="50" cy="55" r="8" fill="#FF6347"/><circle cx="40" cy="68" r="6" fill="#F5DEB3"/><circle cx="60" cy="68" r="6" fill="#F5DEB3"/></svg>' },
    tikka: { name: 'Tikka', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="45" y="20" width="10" height="55" fill="#A0522D" rx="2"/><circle cx="50" cy="32" r="6" fill="#CD853F"/><circle cx="50" cy="45" r="6" fill="#FF6347"/><circle cx="50" cy="58" r="6" fill="#228B22"/><circle cx="50" cy="71" r="6" fill="#DAA520"/><rect x="35" y="78" width="30" height="8" fill="#D2B48C" rx="2"/></svg>' },
    momos: { name: 'Momos', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="45" r="12" fill="#F5DEB3" stroke="#D2B48C" stroke-width="1"/><circle cx="60" cy="45" r="12" fill="#F5DEB3" stroke="#D2B48C" stroke-width="1"/><path d="M40 38 L40 35" stroke="#8B4513" stroke-width="1"/><path d="M60 38 L60 35" stroke="#8B4513" stroke-width="1"/><circle cx="40" cy="48" r="1.5" fill="#FF6347"/><circle cx="60" cy="48" r="1.5" fill="#FF6347"/><ellipse cx="50" cy="70" rx="20" ry="5" fill="#DAA520"/></svg>' },
    chowmein: { name: 'Chow Mein', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="55" rx="35" ry="28" fill="#F5DEB3"/><path d="M25 50 Q30 40 35 48" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M45 38 Q50 32 55 42" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M65 48 Q70 40 75 50" stroke="#D4A574" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="40" cy="58" r="2" fill="#FF6347"/><circle cx="55" cy="60" r="2" fill="#228B22"/></svg>' },
    dumpling: { name: 'Dumpling', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M45 30 L55 30 L60 50 L55 65 L45 65 L40 50 Z" fill="#F5DEB3" stroke="#D2B48C" stroke-width="1"/><path d="M50 40 L50 55" stroke="#8B4513" stroke-width="1"/><circle cx="48" cy="50" r="1" fill="#FF6347"/><circle cx="52" cy="50" r="1" fill="#FF6347"/></svg>' },
    fishchips: { name: 'Fish & Chips', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="12" height="55" fill="#CD853F" rx="2"/><rect x="45" y="15" width="12" height="60" fill="#D2691E" rx="2"/><rect x="60" y="22" width="12" height="53" fill="#CD853F" rx="2"/><ellipse cx="65" cy="40" rx="15" ry="18" fill="#FF8C00"/><circle cx="70" cy="35" r="2" fill="#000"/></svg>' },
    meatpie: { name: 'Meat Pie', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 35 Q30 25 50 20 Q70 25 70 35 L65 70 Q65 80 50 80 Q35 80 35 70 Z" fill="#CD853F"/><path d="M30 35 L70 35" stroke="#8B4513" stroke-width="1.5"/><circle cx="40" cy="50" r="1.5" fill="#FF6347"/><circle cx="50" cy="48" r="1.5" fill="#FF6347"/><circle cx="60" cy="52" r="1.5" fill="#FF6347"/></svg>' },
    sushi: { name: 'Sushi', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="50" rx="12" ry="18" fill="#90EE90" stroke="#228B22" stroke-width="1"/><ellipse cx="60" cy="50" rx="12" ry="18" fill="#90EE90" stroke="#228B22" stroke-width="1"/><circle cx="38" cy="45" r="2" fill="#FF0000"/><circle cx="42" cy="48" r="2" fill="#FFD700"/><circle cx="58" cy="45" r="2" fill="#FF0000"/><circle cx="62" cy="48" r="2" fill="#FFD700"/><rect x="25" y="70" width="50" height="8" fill="#DAA520"/></svg>' },
    gyro: { name: 'Gyro', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="35" width="60" height="8" fill="#D2691E" rx="2"/><rect x="25" y="43" width="50" height="5" fill="#228B22"/><rect x="25" y="48" width="50" height="4" fill="#FFD700"/><rect x="25" y="52" width="50" height="4" fill="#FF6347"/><rect x="25" y="56" width="50" height="4" fill="#FFA500"/><ellipse cx="50" cy="65" rx="28" ry="6" fill="#F5DEB3" rx="2"/></svg>' },
    falafel: { name: 'Falafel', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g><circle cx="38" cy="45" r="10" fill="#8B7355"/><circle cx="62" cy="45" r="10" fill="#8B7355"/><circle cx="50" cy="62" r="10" fill="#8B7355"/></g><circle cx="38" cy="45" r="8" fill="#A0826D"/><circle cx="62" cy="45" r="8" fill="#A0826D"/><circle cx="50" cy="62" r="8" fill="#A0826D"/></svg>' },
    hummus: { name: 'Hummus', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="35" ry="22" fill="#D4B59F"/><circle cx="38" cy="55" r="3" fill="#228B22"/><circle cx="50" cy="52" r="3" fill="#228B22"/><circle cx="62" cy="56" r="3" fill="#228B22"/><circle cx="45" cy="68" r="2" fill="#A0826D"/><circle cx="55" cy="68" r="2" fill="#A0826D"/><ellipse cx="50" cy="82" rx="37" ry="8" fill="#A0826D"/></svg>' },
    shawarma: { name: 'Shawarma', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="35" y="25" width="30" height="50" fill="#8B4513"/><path d="M35 25 L32 20 L55 18 L58 25" fill="#DAA520"/><rect x="37" y="30" width="26" height="4" fill="#228B22"/><rect x="37" y="35" width="26" height="4" fill="#FF6347"/><rect x="37" y="40" width="26" height="4" fill="#FFD700"/><ellipse cx="50" cy="80" rx="22" ry="6" fill="#D2B48C"/></svg>' },
    bbq: { name: 'BBQ', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M25 60 Q30 40 50 35 Q70 40 75 60" fill="#8B4513" stroke="#654321" stroke-width="1"/><ellipse cx="50" cy="75" rx="28" ry="8" fill="#654321"/><circle cx="38" cy="55" r="3" fill="#FF6347"/><circle cx="50" cy="50" r="3" fill="#DAA520"/><circle cx="62" cy="55" r="3" fill="#FF6347"/></svg>' },
    smoothie: { name: 'Smoothie', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="25" width="36" height="45" fill="#FF69B4" rx="4"/><rect x="32" y="25" width="36" height="30" fill="#C71585" rx="4" opacity="0.8"/><rect x="48" y="15" width="4" height="12" fill="#CD853F"/><ellipse cx="50" cy="25" rx="20" ry="4" fill="#FFB6C1"/><circle cx="42" cy="35" r="2" fill="#FFD700"/><circle cx="55" cy="33" r="2" fill="#FFD700"/></svg>' },
    lassi: { name: 'Lassi', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="28" width="36" height="42" fill="#FFE4C4" rx="3"/><rect x="32" y="28" width="36" height="28" fill="#F0E68C" rx="3" opacity="0.7"/><rect x="48" y="18" width="4" height="12" fill="#8B4513"/><ellipse cx="50" cy="28" rx="19" ry="4" fill="#FFDAB9"/><path d="M42 40 L48 50" stroke="#8B4513" stroke-width="1" opacity="0.4"/></svg>' },
    raita: { name: 'Raita', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="60" rx="35" ry="22" fill="#F0E68C"/><circle cx="38" cy="55" r="2" fill="#228B22"/><circle cx="50" cy="52" r="2" fill="#228B22"/><circle cx="62" cy="56" r="2" fill="#228B22"/><circle cx="44" cy="67" r="1.5" fill="#8B4513"/><circle cx="55" cy="68" r="1.5" fill="#8B4513"/><ellipse cx="50" cy="82" rx="36" ry="8" fill="#FFE4B5"/></svg>' },
    haleem: { name: 'Haleem', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 50 L35 80 L65 80 L70 50 Z" fill="#8B5A2B" stroke="#654321" stroke-width="1.5"/><ellipse cx="50" cy="50" rx="20" ry="8" fill="#A0522D" stroke="#654321" stroke-width="1"/><circle cx="40" cy="60" r="2" fill="#228B22"/><circle cx="50" cy="62" r="2" fill="#FF6347"/><circle cx="60" cy="60" r="2" fill="#FFD700"/></svg>' },
    pakora: { name: 'Pakora', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g><circle cx="38" cy="45" r="10" fill="#DAA520"/><circle cx="62" cy="45" r="10" fill="#DAA520"/><circle cx="50" cy="62" r="10" fill="#DAA520"/></g><circle cx="38" cy="45" r="8" fill="#CD853F"/><circle cx="62" cy="45" r="8" fill="#CD853F"/><circle cx="50" cy="62" r="8" fill="#CD853F"/></svg>' },
    spring: { name: 'Spring Roll', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="35" width="50" height="30" fill="#F5DEB3" stroke="#D2B48C" stroke-width="1.5" rx="2"/><path d="M30 40 L70 40 M30 50 L70 50 M30 60 L70 60" stroke="#D2B48C" stroke-width="0.5" opacity="0.6"/><circle cx="40" cy="50" r="2" fill="#228B22"/><circle cx="60" cy="50" r="2" fill="#FF6347"/></svg>' },
    shavedice: { name: 'Shaved Ice', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M40 30 L60 30 L65 70 Q50 75 35 70 Z" fill="#87CEEB"/><circle cx="45" cy="45" r="2.5" fill="#FF1493"/><circle cx="55" cy="50" r="2.5" fill="#32CD32"/><circle cx="50" cy="60" r="2.5" fill="#FFD700"/><circle cx="48" cy="35" r="1.5" fill="#FF69B4"/></svg>' },
    tea: { name: 'Tea', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="35" width="45" height="38" fill="#D2B48C" rx="3"/><rect x="25" y="35" width="45" height="24" fill="#8B6F47" rx="3"/><path d="M72 45 Q78 40 78 55 Q78 65 72 70" stroke="#D2B48C" stroke-width="3" fill="none"/><rect x="27" y="37" width="41" height="2" fill="#A0826D"/><ellipse cx="50" cy="30" rx="23" ry="5" fill="#E8A76A"/><rect x="28" y="74" width="42" height="3" fill="#D2B48C"/></svg>' },
    juice: { name: 'Juice', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="28" width="36" height="48" fill="#FF6347" rx="3"/><rect x="32" y="28" width="36" height="35" fill="#FF4500" rx="3" opacity="0.8"/><rect x="48" y="18" width="4" height="12" fill="#8B4513"/><ellipse cx="50" cy="28" rx="19" ry="4" fill="#FF7F50"/><circle cx="45" cy="40" r="1" fill="#FFD700"/><circle cx="55" cy="42" r="1" fill="#FFD700"/></svg>' },
    beer: { name: 'Beer', svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="32" width="28" height="45" fill="#DAA520" rx="2"/><rect x="30" y="32" width="28" height="32" fill="#CD853F" rx="2" opacity="0.8"/><path d="M58 38 Q64 35 64 50 Q64 62 58 68" stroke="#DAA520" stroke-width="2.5" fill="none"/><ellipse cx="44" cy="32" rx="14" ry="5" fill="#FFE4B5"/><circle cx="38" cy="50" r="1" fill="#FFF8DC"/><circle cx="45" cy="55" r="1" fill="#FFF8DC"/></svg>' }
};

function getCategoryIconSVG(categoryName) {
    const name = (categoryName || '').toLowerCase();
    
    // Find matching icon by name
    for (let key in ProfessionalCategoryIcons) {
        if (name.includes(key)) {
            return ProfessionalCategoryIcons[key].svg;
        }
    }
    
    // Map common category names to icons
    const iconMap = {
        'burger': ProfessionalCategoryIcons.burger.svg,
        'burgers': ProfessionalCategoryIcons.burger.svg,
        'pizza': ProfessionalCategoryIcons.pizza.svg,
        'chicken': ProfessionalCategoryIcons.chicken.svg,
        'noodles': ProfessionalCategoryIcons.noodles.svg,
        'pasta': ProfessionalCategoryIcons.noodles.svg,
        'salad': ProfessionalCategoryIcons.salad.svg,
        'coffee': ProfessionalCategoryIcons.coffee.svg,
        'beverage': ProfessionalCategoryIcons.drink.svg,
        'drinks': ProfessionalCategoryIcons.drink.svg,
        'seafood': ProfessionalCategoryIcons.fish.svg,
        'fish': ProfessionalCategoryIcons.fish.svg,
        'biryani': ProfessionalCategoryIcons.biryani.svg,
        'soup': ProfessionalCategoryIcons.soup.svg,
        'dessert': ProfessionalCategoryIcons.dessert.svg,
        'sweets': ProfessionalCategoryIcons.dessert.svg,
        'bread': ProfessionalCategoryIcons.bread.svg,
        'rice': ProfessionalCategoryIcons.rice.svg,
        'sandwich': ProfessionalCategoryIcons.sandwich.svg,
        'sandwiches': ProfessionalCategoryIcons.sandwich.svg,
        'fries': ProfessionalCategoryIcons.frenchfries.svg,
        'icecream': ProfessionalCategoryIcons.icecream.svg,
        'veg': ProfessionalCategoryIcons.veg.svg,
        'vegetarian': ProfessionalCategoryIcons.veg.svg,
        'hotdog': ProfessionalCategoryIcons.hotdog.svg,
        'hot dog': ProfessionalCategoryIcons.hotdog.svg,
        'tacos': ProfessionalCategoryIcons.tacos.svg,
        'curry': ProfessionalCategoryIcons.curry.svg,
        'tandoori': ProfessionalCategoryIcons.tandoori.svg,
        'dosa': ProfessionalCategoryIcons.dosa.svg,
        'kebab': ProfessionalCategoryIcons.kebab.svg,
        'paneer': ProfessionalCategoryIcons.paneer.svg,
        'vegan': ProfessionalCategoryIcons.vegan.svg,
        'samosa': ProfessionalCategoryIcons.samosa.svg,
        'chaat': ProfessionalCategoryIcons.chaat.svg,
        'idli': ProfessionalCategoryIcons.idli.svg,
        'uttapam': ProfessionalCategoryIcons.uttapam.svg,
        'naan': ProfessionalCategoryIcons.naan.svg,
        'roti': ProfessionalCategoryIcons.roti.svg,
        'thali': ProfessionalCategoryIcons.thali.svg,
        'tikka': ProfessionalCategoryIcons.tikka.svg,
        'momos': ProfessionalCategoryIcons.momos.svg,
        'chowmein': ProfessionalCategoryIcons.chowmein.svg,
        'chow mein': ProfessionalCategoryIcons.chowmein.svg,
        'dumpling': ProfessionalCategoryIcons.dumpling.svg,
        'dumplings': ProfessionalCategoryIcons.dumpling.svg,
        'fish & chips': ProfessionalCategoryIcons.fishchips.svg,
        'fish and chips': ProfessionalCategoryIcons.fishchips.svg,
        'meat pie': ProfessionalCategoryIcons.meatpie.svg,
        'sushi': ProfessionalCategoryIcons.sushi.svg,
        'gyro': ProfessionalCategoryIcons.gyro.svg,
        'falafel': ProfessionalCategoryIcons.falafel.svg,
        'hummus': ProfessionalCategoryIcons.hummus.svg,
        'shawarma': ProfessionalCategoryIcons.shawarma.svg,
        'bbq': ProfessionalCategoryIcons.bbq.svg,
        'smoothie': ProfessionalCategoryIcons.smoothie.svg,
        'lassi': ProfessionalCategoryIcons.lassi.svg,
        'raita': ProfessionalCategoryIcons.raita.svg,
        'haleem': ProfessionalCategoryIcons.haleem.svg,
        'pakora': ProfessionalCategoryIcons.pakora.svg,
        'spring roll': ProfessionalCategoryIcons.spring.svg,
        'shaved ice': ProfessionalCategoryIcons.shavedice.svg,
        'tea': ProfessionalCategoryIcons.tea.svg,
        'juice': ProfessionalCategoryIcons.juice.svg,
        'beer': ProfessionalCategoryIcons.beer.svg
    };
    
    return iconMap[name] || ProfessionalCategoryIcons.burger.svg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CURRENCY SYSTEM (USD, INR, GBP) - SIMPLE STATIC CONVERSION ───────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CurrencyManager = {
  // Currency definitions with symbols
  currencies: {
    USD: { symbol: '$', name: 'US Dollar', code: 'USD', country: 'US' },
    INR: { symbol: '₹', name: 'Indian Rupee', code: 'INR', country: 'IN' },
    GBP: { symbol: '£', name: 'British Pound', code: 'GBP', country: 'UK' }
  },

  // Static conversion rates (relative to INR)
  conversionRates: {
    USD: 0.012,    // 1 INR = 0.012 USD
    INR: 1,        // 1 INR = 1 INR
    GBP: 0.0095    // 1 INR = 0.0095 GBP
  },

  // Current active currency
  activeCurrency: 'INR',

  // Initialize currency system
  async init() {
    try {
      const savedCurrency = localStorage.getItem('user_selected_currency');
      if (savedCurrency && this.currencies[savedCurrency]) {
        this.activeCurrency = savedCurrency;
        console.log('[CurrencyManager] Loaded saved currency:', this.activeCurrency);
        return;
      }

      const detectedCurrency = await this.detectCurrencyFromLocation();
      if (detectedCurrency) {
        this.activeCurrency = detectedCurrency;
        localStorage.setItem('user_selected_currency', detectedCurrency);
        console.log('[CurrencyManager] Detected currency from location:', this.activeCurrency);
        return;
      }

      this.activeCurrency = 'INR';
      localStorage.setItem('user_selected_currency', 'INR');
      console.log('[CurrencyManager] Using default currency: INR');
    } catch (err) {
      console.error('[CurrencyManager] Init error:', err);
      this.activeCurrency = 'INR';
    }
  },

  // Detect currency from user's geolocation
  async detectCurrencyFromLocation() {
    try {
      const response = await fetch('https://ipapi.co/json/', { timeout: 2000 });
      const data = await response.json();
      const countryCode = data.country_code;

      console.log('[CurrencyManager] Detected country:', countryCode);

      if (countryCode === 'US') return 'USD';
      if (countryCode === 'GB') return 'GBP';
      if (countryCode === 'IN') return 'INR';
      
      return 'INR';
    } catch (err) {
      console.log('[CurrencyManager] Geolocation detection failed:', err.message);
      return null;
    }
  },

  // Get current currency object
  getCurrentCurrency() {
    return this.currencies[this.activeCurrency];
  },

  // Set active currency
  setCurrency(currencyCode) {
    if (this.currencies[currencyCode]) {
      this.activeCurrency = currencyCode;
      localStorage.setItem('user_selected_currency', currencyCode);
      console.log('[CurrencyManager] Currency changed to:', currencyCode);
      return true;
    }
    return false;
  },

  // Convert price from source currency to target currency
  convertPrice(amount, sourceOrTargetCurrency = null, targetCurrency = null) {
    if (!amount || isNaN(amount)) return 0;

    let fromCurrency = 'INR';
    let toCurrency = sourceOrTargetCurrency || this.activeCurrency;
    
    if (targetCurrency) {
      fromCurrency = sourceOrTargetCurrency;
      toCurrency = targetCurrency;
    }

    if (fromCurrency === toCurrency) {
      return Math.round(amount * 100) / 100;
    }

    const inrAmount = amount / (this.conversionRates[fromCurrency] || 1);
    const converted = inrAmount * (this.conversionRates[toCurrency] || 1);
    
    return Math.round(converted * 100) / 100;
  },

  // Convert between any two currencies
  convert(amount, fromCurrency = 'INR', toCurrency = null) {
    const targetCurrency = toCurrency || this.activeCurrency;
    if (!amount || isNaN(amount)) return 0;
    
    return this.convertPrice(amount, fromCurrency, targetCurrency);
  },

  // Format price for display
  formatPrice(amount, currencyCode = null) {
    const currency = currencyCode ? this.currencies[currencyCode] : this.getCurrentCurrency();
    if (!currency || !amount) return currency.symbol + '0';

    const value = parseFloat(amount);
    if (isNaN(value)) return currency.symbol + '0';

    if (currency.code === 'INR') {
      return currency.symbol + Math.round(value).toLocaleString('en-IN');
    } else {
      return currency.symbol + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  },

  // Get all currencies as dropdown options
  getCurrencyOptions() {
    return Object.keys(this.currencies).map(code => ({
      code,
      name: this.currencies[code].name,
      symbol: this.currencies[code].symbol
    }));
  }
};

window.CurrencyManager = CurrencyManager;

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
        
        // Expose functions globally for other scripts
        window._firebaseFns = functions;
        
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
    
    const subscription = restaurant.subscription;
    const expiryDate = subscription.expiryDate;
    
    if (!expiryDate) return true;
    
    // Check subscription status first
    if (subscription.status !== 'active') return true;
    
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

// Check if QR code access is allowed for this restaurant
function isQRCodeAccessAllowed(restaurant) {
    if (!restaurant) return false;
    
    const subscription = restaurant.subscription || {};
    
    // Must have active subscription
    if (subscription.status !== 'active') {
        return false;
    }
    
    // Must not be expired
    if (isSubscriptionExpired(restaurant)) {
        return false;
    }
    
    // Premium must be true
    if (restaurant.premium !== true) {
        return false;
    }
    
    return true;
}

// Check if customer can access restaurant via QR code
async function checkCustomerQRAccess(restaurantId) {
    try {
        const doc = await db.collection('restaurants').doc(restaurantId).get();
        
        if (!doc.exists) {
            console.error('[QR Access] Restaurant not found:', restaurantId);
            return { allowed: false, reason: 'Restaurant not found' };
        }
        
        const restaurant = doc.data();
        
        if (!isQRCodeAccessAllowed(restaurant)) {
            return {
                allowed: false,
                reason: 'Restaurant subscription expired or inactive',
                restaurant: restaurant.name || 'Unknown'
            };
        }
        
        return {
            allowed: true,
            restaurant: restaurant
        };
    } catch (error) {
        console.error('[QR Access] Error checking access:', error);
        return {
            allowed: false,
            reason: 'Error checking access'
        };
    }
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
// Get current currency symbol
function getCurrencySymbol() {
    if (typeof CurrencyManager !== 'undefined') {
        const currency = CurrencyManager.getCurrentCurrency();
        return currency.symbol || '₹';
    }
    return '₹';
}

// Get current currency code
function getCurrencyCode() {
    if (typeof CurrencyManager !== 'undefined') {
        const currency = CurrencyManager.getCurrentCurrency();
        return currency.code || 'INR';
    }
    return 'INR';
}

// Update currency labels in modals
function updateCurrencyLabels() {
    const symbol = getCurrencySymbol();
    const priceLabel = document.getElementById('price-currency-label');
    const discountLabel = document.getElementById('discount-currency-label');
    const editPriceLabel = document.getElementById('edit-price-currency-label');
    const editDiscountLabel = document.getElementById('edit-discount-currency-label');
    
    if (priceLabel) priceLabel.textContent = symbol;
    if (discountLabel) discountLabel.textContent = symbol;
    if (editPriceLabel) editPriceLabel.textContent = symbol;
    if (editDiscountLabel) editDiscountLabel.textContent = symbol;
}

const app = {
    currentUser: null,
    currentRestaurant: null,
    currentPage: 'landing',
    userRole: null,
    userApproved: false,
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
    appliedCoupon: null,
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
    kitchenListenerActive: false,
    ordersListener: null,
    currentOrdersFilter: null,
    dashboardRestaurantListener: null,
    dashboardMetricsListener: null,
    dashboardOrdersListener: null,
    customerMenuRestaurantListener: null,
    customerMenuFoodsListener: null,
    customerMenuCategoriesListener: null,
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
    nextOrderNumber: 1,
    // Cache management
    cache: {
        restaurants: {},
        menus: {},
        categories: {},
        foods: {},
        variants: {},
        addons: {},
        timestamps: {}
    },
    cacheExpireTime: 30 * 60 * 1000, // 30 minutes
    // Session tracking to prevent duplicate loads during same session
    sessionLoaded: {
        overview: false,
        menu: false,
        analytics: false,
        reviews: false,
        offers: false,
        coupons: false,
        profile: false,
        settings: false,
        variants: false,
        addons: false,
        categories: false,
        foods: false,
        customerMenuInitialized: false,
        customerMenuRestaurantId: null
    }
};

// ============================================
// CACHE UTILITIES
// ============================================

function getCachedData(type, key) {
    if (!app.cache[type] || !app.cache[type][key]) return null;
    const timestamp = app.cache.timestamps[`${type}:${key}`];
    if (!timestamp || Date.now() - timestamp > app.cacheExpireTime) {
        delete app.cache[type][key];
        delete app.cache.timestamps[`${type}:${key}`];
        return null;
    }
    return app.cache[type][key];
}

function setCachedData(type, key, data) {
    if (!app.cache[type]) app.cache[type] = {};
    app.cache[type][key] = data;
    app.cache.timestamps[`${type}:${key}`] = Date.now();
}

function clearListeners(listenerRefs) {
    listenerRefs.forEach(ref => {
        if (app[ref] && typeof app[ref] === 'function') {
            app[ref]();
            app[ref] = null;
        }
    });
}

// Reset session-specific cache flags when restaurant changes
function resetSessionCache(reason = '') {
    console.log('[Session] Resetting session cache - reason:', reason);
    Object.keys(app.sessionLoaded).forEach(key => {
        if (key === 'customerMenuRestaurantId') {
            app.sessionLoaded[key] = null;
        } else {
            app.sessionLoaded[key] = false;
        }
    });
}

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
    
    // Initialize Currency System
    console.log('[App] Initializing Currency System...');
    await CurrencyManager.init();
    console.log('[App] ✓ Currency System initialized:', CurrencyManager.activeCurrency);
    
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

    // Check if this is a renewal payment return from Cashfree
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const renewalOrderId = params.get('orderId');
    const renewalRestaurantId = params.get('restaurantId');
    
    if (action === 'verify_renewal' && renewalOrderId && renewalRestaurantId) {
        console.log('[App] Renewal payment return detected:', renewalOrderId);
        // Clean up URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Handle renewal payment verification
        handleRenewalPaymentReturn(renewalOrderId, renewalRestaurantId);
        return;
    }

    // Check if this is a payment return from Cashfree (initial subscription)
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
        // Customer accessing via QR code - validate subscription first
        console.log('[App] Customer mode - validating QR access for restaurant:', restaurantId);
        
        if (firebaseInitialized && db) {
            const accessCheck = await checkCustomerQRAccess(restaurantId);
            
            if (!accessCheck.allowed) {
                console.warn('[App] QR access denied:', accessCheck.reason);
                navigateTo('landing');
                showNotification('❌ ' + (accessCheck.reason || 'Unable to access this restaurant'), 'error');
                return;
            }
            
            console.log('[App] QR access allowed - loading menu for restaurant:', restaurantId);
            app.customerMode = true;
            app.currentRestaurantId = restaurantId;
            
            try {
                await loadCustomerMenu(restaurantId);
            } catch (error) {
                console.error('[App] Error loading customer menu:', error);
                showNotification('Failed to load menu. Please try again.', 'error');
            }
        } else {
            console.error('[App] Firebase not ready');
            showNotification('Loading...', 'info');
            // Wait for Firebase to be ready
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (firebaseInitialized && db) {
                const accessCheck = await checkCustomerQRAccess(restaurantId);
                if (!accessCheck.allowed) {
                    navigateTo('landing');
                    showNotification('❌ ' + (accessCheck.reason || 'Unable to access this restaurant'), 'error');
                    return;
                }
                
                app.customerMode = true;
                app.currentRestaurantId = restaurantId;
                await loadCustomerMenu(restaurantId);
            } else {
                showNotification('❌ Failed to initialize. Please refresh the page.', 'error');
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
                    
                    // Skip auth checks if currently signing in
                    if (isSigningIn) {
                        console.log('[Auth] Currently signing in, deferring auth state check');
                        return;
                    }
                    
                    try {
                        // Get user role from Firestore with timeout
                        const userDoc = await Promise.race([
                            db.collection('users').doc(user.uid).get(),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Firestore timeout')), 5000)
                            )
                        ]);

                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            
                            // Check if user is approved (isApproved flag)
                            if (userData.isApproved !== true) {
                                // User is not approved - sign them out
                                console.warn('User not approved:', user.email);
                                await auth.signOut();
                                app.currentUser = null;
                                app.userApproved = false;
                                showNotification('⛔ Your account is not authorized. Contact administrator.', 'error');
                                updateLandingPageHeader(null);
                                return;
                            }

                            // User is approved
                            app.userApproved = true;
                            app.userRole = userData.role;
                            
                            // Check if restaurant owner has created a restaurant
                            if (app.userRole === 'restaurant_owner') {
                                const restaurantDoc = await db.collection('restaurants')
                                    .where('ownerId', '==', user.uid)
                                    .limit(1)
                                    .get();
                                if (!restaurantDoc.empty) {
                                    app.currentRestaurant = restaurantDoc.docs[0].data();
                                    app.currentRestaurantId = restaurantDoc.docs[0].id;
                                    
                                    // Show dashboard button and update header
                                    updateLandingPageHeader(user);
                                    showDashboardButton();
                                    console.log('[Auth] Approved user with restaurant - showing dashboard');
                                } else {
                                    // User is approved but hasn't created a restaurant yet
                                    updateLandingPageHeader(user);
                                    console.log('[Auth] Approved user without restaurant - awaiting admin configuration');
                                }
                            } else {
                                updateLandingPageHeader(user);
                            }
                        } else {
                            // User document doesn't exist - create it with default not approved
                            // The signInWithGoogle function will update it if they're in approved_owners
                            console.log('[Auth] User document does not exist:', user.email);
                            
                            // Check if user is in approved_owners
                            try {
                                const approvedDoc = await db.collection('approved_owners')
                                    .where('email', '==', user.email.toLowerCase())
                                    .limit(1)
                                    .get();

                                if (!approvedDoc.empty) {
                                    console.log('[Auth] User found in approved_owners, creating approved user document');
                                    // User is approved, create their document
                                    await db.collection('users').doc(user.uid).set({
                                        uid: user.uid,
                                        email: user.email,
                                        displayName: user.displayName,
                                        photoURL: user.photoURL,
                                        role: 'restaurant_owner',
                                        isApproved: true,
                                        approvalStatus: 'verified',
                                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                        status: 'active'
                                    }, { merge: true });

                                    // User is now approved
                                    app.userApproved = true;
                                    app.userRole = 'restaurant_owner';
                                    console.log('[Auth] User approved and document created');
                                    
                                    // Now check if they have a restaurant
                                    const restaurantDoc = await db.collection('restaurants')
                                        .where('ownerId', '==', user.uid)
                                        .limit(1)
                                        .get();
                                    
                                    if (!restaurantDoc.empty) {
                                        console.log('[Auth] User has a restaurant, showing dashboard button');
                                        app.currentRestaurant = restaurantDoc.docs[0].data();
                                        app.currentRestaurantId = restaurantDoc.docs[0].id;
                                        showDashboardButton();
                                    } else {
                                        console.log('[Auth] Approved user without restaurant yet');
                                    }
                                    
                                    updateLandingPageHeader(user);
                                } else {
                                    // User is not approved - sign them out
                                    console.warn('[Auth] User not in approved_owners:', user.email);
                                    await auth.signOut();
                                    app.currentUser = null;
                                    app.userApproved = false;
                                    showNotification('⛔ Your account is not authorized. Contact administrator.', 'error');
                                    updateLandingPageHeader(null);
                                    return;
                                }
                            } catch (approvalError) {
                                console.error('[Auth] Error checking approval:', approvalError);
                                // Sign out on approval check error
                                await auth.signOut();
                                app.currentUser = null;
                                showNotification('Error verifying authorization. Please try again.', 'error');
                                updateLandingPageHeader(null);
                                return;
                            }
                        }
                        
                        // Auth state check complete
                    } catch (error) {
                        console.warn('Could not fetch user data:', error.message);
                        // On error, sign out to be safe
                        await auth.signOut();
                        app.currentUser = null;
                        updateLandingPageHeader(null);
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

    // Clear any existing dynamically created buttons
    const existingDynamicBtns = heroBtns.querySelectorAll('button:not(#hero-get-started)');
    existingDynamicBtns.forEach(btn => btn.remove());

    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-lg';
    btn.textContent = '📊 Go to Dashboard';
    btn.onclick = () => navigateTo('dashboard');
    heroBtns.appendChild(btn);
}

function showOnboardingButton() {
    // Setup flow removed - approved users go directly to dashboard
    console.log('[App] Onboarding flow disabled for approved users');
}

function showPaymentPendingButton() {
    // Payment flow removed
    console.log('[App] Payment pending button disabled');
}

function showPaymentRequiredButton() {
    // Payment flow removed
    console.log('[App] Payment required button disabled');
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
    
    // Cleanup old page listeners and intervals
    if (app.currentPage === 'dashboard') {
        clearListeners(['dashboardRestaurantListener', 'dashboardMetricsListener', 'dashboardOrdersListener']);
    } else if (app.currentPage === 'customer-menu') {
        clearListeners(['customerMenuRestaurantListener', 'customerMenuFoodsListener', 'customerMenuCategoriesListener']);
    }
    
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
        // Show dashboard if user has a restaurant and is approved
        if (app.currentRestaurantId && app.currentUser) {
            // Double-check approval status
            if (app.userApproved !== true) {
                showNotification('⛔ Your account is not authorized to access dashboard.', 'error');
                navigateTo('landing');
                return;
            }
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
        
        // Show dashboard button if user has a restaurant
        if (app.currentRestaurantId) {
            showDashboardButton();
        }
        // If user is approved but doesn't have restaurant, don't show any button
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

    isSigningIn = true;
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            'login_hint': 'user@example.com'
        });
        
        console.log('[SignIn] Starting Google sign-in');
        const result = await auth.signInWithPopup(provider);
        const userEmail = result.user.email;
        const userId = result.user.uid;
        
        console.log('[SignIn] Google auth completed for:', userEmail);

        // Check if user's email is in approved_owners collection
        try {
            console.log('[SignIn] Checking if user is in approved_owners');
            const approvedDoc = await db.collection('approved_owners')
                .where('email', '==', userEmail.toLowerCase())
                .limit(1)
                .get();
            
            if (approvedDoc.empty) {
                // User is not approved - immediately sign out
                console.warn('[SignIn] User not in approved_owners, signing out:', userEmail);
                await auth.signOut();
                isSigningIn = false;
                showNotification('⛔ Your email is not authorized to use this platform. Please contact the administrator.', 'error');
                return;
            }

            console.log('[SignIn] User is in approved_owners, creating/updating user document');

            // User is approved, create or update user document
            const userDocRef = db.collection('users').doc(userId);
            
            // Set the user document with merge option to avoid overwriting existing data
            await userDocRef.set({
                uid: userId,
                email: userEmail,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
                role: 'restaurant_owner',
                isApproved: true,
                approvalStatus: 'verified',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            }, { merge: true });

            console.log('[SignIn] User document created/updated successfully');

            // Wait for Firestore to sync
            await new Promise(resolve => setTimeout(resolve, 800));

            app.currentUser = result.user;
            app.userApproved = true;
            app.userRole = 'restaurant_owner';
            isSigningIn = false;
            
            console.log('[SignIn] Sign-in successful:', userEmail);
            showNotification('✅ Signed in successfully!', 'success');
            
            // Navigate to landing - onAuthStateChanged will handle the rest
            setTimeout(() => navigateTo('landing'), 500);

        } catch (checkError) {
            console.error('[SignIn] Error during approval check:', checkError.message || checkError);
            isSigningIn = false;
            
            // If permission error, try to sign out and show error
            try {
                await auth.signOut();
            } catch (signoutError) {
                console.error('[SignIn] Error signing out after failed check:', signoutError);
            }
            
            // Show appropriate error message
            if (checkError.message && checkError.message.includes('Missing or insufficient permissions')) {
                showNotification('Authorization check failed. Please ensure Firestore rules are deployed. Try again in a moment.', 'error');
            } else {
                showNotification('Error verifying authorization: ' + (checkError.message || 'Unknown error'), 'error');
            }
            return;
        }
        
    } catch (error) {
        isSigningIn = false;
        console.error('[SignIn] Authentication error:', error);
        
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
            isSigningIn = false;
            
            // Cleanup all listeners
            clearListeners([
                'kitchenListener',
                'ordersListener',
                'dashboardRestaurantListener',
                'dashboardMetricsListener',
                'dashboardOrdersListener',
                'customerMenuRestaurantListener',
                'customerMenuFoodsListener',
                'customerMenuCategoriesListener'
            ]);
            
            // Clear intervals
            if (app.kitchenRefreshInterval) {
                clearInterval(app.kitchenRefreshInterval);
                app.kitchenRefreshInterval = null;
            }
            if (app.dashboardRefreshInterval) {
                clearInterval(app.dashboardRefreshInterval);
                app.dashboardRefreshInterval = null;
            }
            if (app.ordersRefreshInterval) {
                clearInterval(app.ordersRefreshInterval);
                app.ordersRefreshInterval = null;
            }
            
            // Reset session flags
            Object.keys(app.sessionLoaded).forEach(key => {
                if (key === 'customerMenuRestaurantId') {
                    app.sessionLoaded[key] = null;
                } else {
                    app.sessionLoaded[key] = false;
                }
            });
            
            if (firebaseInitialized && auth) {
                await auth.signOut();
            }
            app.currentUser = null;
            app.currentRestaurant = null;
            app.currentRestaurantId = null;
            app.userRole = null;
            app.userApproved = false;
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
            country: 'IN',
            currency: 'INR',
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

async function handleRenewalPaymentReturn(orderId, restaurantId) {
    try {
        console.log('[Renewal Return] Verifying renewal payment');
        console.log('Order ID:', orderId);
        console.log('Restaurant ID:', restaurantId);
        
        // Wait for auth and verify renewal
        await verifyRenewalPayment(orderId, restaurantId);
    } catch (error) {
        console.error('Error handling renewal return:', error);
        showNotification('Error processing renewal: ' + error.message, 'error');
    }
}

async function verifyRenewalPayment(orderId, restaurantId) {
    console.log('=== RENEWAL PAYMENT VERIFICATION START ===');
    console.log('Order ID:', orderId);
    console.log('Restaurant ID:', restaurantId);
    
    if (!firebaseInitialized || !functions) {
        console.error('❌ Firebase not initialized');
        showNotification('Firebase not initialized', 'error');
        return;
    }

    try {
        console.log('Calling verifyPaymentAndRenew Cloud Function...');
        
        // Call backend to verify renewal payment
        const result = await Promise.race([
            functions.httpsCallable('verifyPaymentAndRenew')({
                restaurantId: restaurantId,
                orderId: orderId
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Verification timeout')), 30000))
        ]);

        console.log('✓ Renewal verification result:', result.data);

        if (!result.data.success) {
            console.error('❌ Renewal verification failed');
            showNotification('Renewal verification failed. Please try again.', 'error');
            navigateTo('settings');
            return;
        }

        console.log('✓ Subscription renewed successfully');
        showNotification('✓ Subscription renewed successfully for 29 days!', 'success');
        
        // Reload app data
        await loadUserRestaurants();
        navigateTo('settings');
        
    } catch (error) {
        console.error('Renewal verification error:', error.message);
        showNotification('Error verifying renewal: ' + error.message, 'error');
        navigateTo('settings');
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

        // Check if restaurant is in India for renewal eligibility
        const restaurantCountry = app.currentRestaurant?.country || 'IN';
        const isIndianRestaurant = restaurantCountry === 'IN' || restaurantCountry === 'India';
        
        const renewalButton = isIndianRestaurant 
            ? `<button onclick="handleRenewalPayment()" style="background: white; color: #DC2626; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap; margin-left: 15px;">Renew Now (₹499/month) →</button>`
            : `<div style="background: rgba(255,255,255,0.2); color: white; padding: 10px 15px; border-radius: 8px; font-size: 0.9rem; margin-left: 15px; white-space: nowrap;">📞 Contact Admin for Renewal</div>`;
        
        const renewalButtonExpiring = isIndianRestaurant 
            ? `<button onclick="handleRenewalPayment()" style="background: white; color: #0F172A; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap; margin-left: 15px;">Renew Now (₹499/month) →</button>`
            : `<div style="background: rgba(255,255,255,0.2); color: #0F172A; padding: 10px 15px; border-radius: 8px; font-size: 0.9rem; margin-left: 15px; white-space: nowrap;">📞 Contact Admin for Renewal</div>`;
        
        if (daysRemaining < 0) {
            // Subscription expired
            bannerColor = '#DC2626';
            bannerHTML = `
                <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="color: white; flex: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 1.1rem;">🚨 Subscription Expired</h3>
                        <p style="margin: 0; font-size: 0.9rem;">Your subscription expired on ${expiryDate.toLocaleDateString('en-IN')}. Renew now to continue using RestaurantOS.</p>
                    </div>
                    ${renewalButton}
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
                    ${renewalButtonExpiring}
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

// Payment initiation now handled by handleRenewalPayment() from renewal-payment.js
// This function is deprecated and kept for backward compatibility only
async function initiateRenewalPayment() {
    console.warn('[app.js] initiateRenewalPayment() is deprecated. Use handleRenewalPayment() instead.');
    if (typeof handleRenewalPayment === 'function') {
        return await handleRenewalPayment();
    }
    showNotification('Payment system not available. Please refresh the page.', 'error');
}

// Get subscription renewal info in selected currency
function getSubscriptionRenewalInfo() {
    const amountINR = 499;
    const convertedAmount = CurrencyManager.convertPrice(amountINR);
    const formattedAmount = CurrencyManager.formatPrice(convertedAmount);
    const currency = CurrencyManager.getCurrentCurrency();
    
    return {
        amountINR: amountINR,
        convertedAmount: convertedAmount,
        formattedAmount: formattedAmount,
        currency: currency.code,
        currencyName: currency.name,
        currencySymbol: currency.symbol
    };
}

// Format order total using selected currency
function getFormattedOrderTotal(orderTotalINR) {
    if (!orderTotalINR) return CurrencyManager.getCurrentCurrency().symbol + '0';
    return CurrencyManager.formatPrice(
        CurrencyManager.convertPrice(orderTotalINR)
    );
}

function showRenewalPaymentModal(paymentData) {
    try {
        console.log('=== SHOWING RENEWAL PAYMENT MODAL ===');
        
        // Remove any existing modal
        const existing = document.querySelector('[style*="position: fixed"][style*="z-index: 10001"]');
        if (existing) existing.remove();
        
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'renewal-payment-modal';
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
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 16px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.3s ease;
            text-align: center;
        `;
        
        modalContent.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 20px;">🔄</div>
            <h2 style="margin: 0 0 10px 0; color: #0F172A; font-size: 1.8rem;">Renew Your Subscription</h2>
            <p style="margin: 0 0 30px 0; color: #666; font-size: 1rem;">Keep your restaurant running with premium features</p>
            
            <div style="background: #F0F4F8; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #3B82F6;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span style="color: #666; font-weight: 600;">Plan</span>
                    <span style="color: #0F172A; font-weight: 700;">Premium - Monthly</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #E2E8F0;">
                    <span style="color: #0F172A; font-weight: 700;">Total Amount</span>
                    <span style=\"color: #3B82F6; font-size: 2rem; font-weight: 900;\">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(paymentData.amount))}</span>
                </div>
            </div>
            
            <div style="background: #ECFDF5; padding: 12px; border-radius: 8px; border-left: 4px solid #10B981; margin-bottom: 25px; font-size: 0.9rem; color: #065F46; font-weight: 500;">
                <strong>✓ Benefits:</strong> Unlimited orders, menu management, analytics & 24/7 support
            </div>
            
            <p style="color: #64748B; font-size: 14px; margin: 20px 0;">You will be redirected to Cashfree for secure payment</p>
            
            <button id="renew-proceed-btn" onclick="proceedToCashfreeRenewal('${paymentData.orderId}', '${app.currentRestaurantId}', ${paymentData.amount})" style="
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                margin-bottom: 12px;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 20px rgba(59, 130, 246, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                💳 Proceed to Payment
            </button>
            
            <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
                width: 100%;
                padding: 12px;
                background: #E2E8F0;
                color: #0F172A;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: background 0.3s ease;
            " onmouseover="this.style.background='#CBD5E1';" onmouseout="this.style.background='#E2E8F0';">
                Cancel
            </button>
        `;
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Close when clicking outside
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        };
        
        console.log('✓ Renewal payment modal shown');
    } catch (error) {
        console.error('Error showing renewal modal:', error);
        showNotification('Error opening payment modal', 'error');
    }
}

async function proceedToCashfreeRenewal(orderId, restaurantId, amount) {
    try {
        console.log('=== CASHFREE RENEWAL CHECKOUT START ===');
        console.log('Order ID:', orderId);
        console.log('Restaurant ID:', restaurantId);
        console.log('Amount:', amount);
        
        // Disable the button to prevent multiple clicks
        const btn = document.getElementById('renew-proceed-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '💳 Processing...';
        }
        
        // Call the renewal payment handler from renewal-payment.js
        if (typeof window.handleRenewalPaymentClick === 'function') {
            console.log('Opening Cashfree payment modal...');
            await window.handleRenewalPaymentClick();
        } else {
            throw new Error('Payment system not initialized. Please refresh the page.');
        }
        
    } catch (error) {
        console.error('=== CASHFREE RENEWAL CHECKOUT ERROR ===');
        console.error('Error:', error.message);
        
        showNotification('Payment error: ' + error.message, 'error');
        
        const btn = document.getElementById('renew-proceed-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💳 Proceed to Payment';
        }
    }
}

async function loadDashboardData() {
    if (!firebaseInitialized || !db || !app.currentRestaurantId) return;

    try {
        const restaurantDoc = await db.collection('restaurants').doc(app.currentRestaurantId).get();
        if (restaurantDoc.exists) {
            app.currentRestaurant = restaurantDoc.data();
            
            // Apply restaurant's currency setting
            const restaurantCurrency = app.currentRestaurant.currency || 'INR';
            console.log('[Dashboard] Applying restaurant currency:', restaurantCurrency);
            CurrencyManager.setCurrency(restaurantCurrency);
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
    
    // CRITICAL: Check if DOM elements exist - don't load if tab not visible
    const recentOrdersList = document.getElementById('recent-orders-list');
    if (!recentOrdersList) {
        console.log('[Dashboard] recent-orders-list element not found in DOM - skipping data load');
        return;
    }
    
    // Guard: If dashboard already loaded in this session, don't recreate
    if (app.sessionLoaded.overview) {
        console.log('[Dashboard] Already loaded in this session');
        return;
    }
    
    app.sessionLoaded.overview = true;
    console.log('[Dashboard] Loading dashboard data');
    
    // Unsubscribe from old listeners (if any)
    clearListeners(['dashboardRestaurantListener', 'dashboardMetricsListener', 'dashboardOrdersListener']);
    
    const today = new Date().toDateString();
    
    // Load restaurant data once (no realtime needed for static data)
    console.log('[Dashboard] Loading restaurant data');
    db.collection('restaurants').doc(app.currentRestaurantId).get()
        .then(doc => {
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
        })
        .catch(error => console.warn('Dashboard restaurant load error:', error));
    
    // Load today's metrics once (no realtime needed)
    console.log('[Dashboard] Loading today metrics');
    db.collection('orders')
        .where('restaurantId', '==', app.currentRestaurantId)
        .where('date', '==', today)
        .limit(1000)
        .get()
        .then(snapshot => {
            console.log('[Dashboard] Today metrics loaded:', snapshot.size, 'orders');
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

            if (revenueEl) revenueEl.textContent = CurrencyManager.formatPrice(CurrencyManager.convertPrice(todayRevenue, 'INR', CurrencyManager.activeCurrency));
            if (ordersEl) ordersEl.textContent = snapshot.size;
            if (pendingEl) pendingEl.textContent = pendingOrders;
            if (completedEl) completedEl.textContent = completedOrders;
        })
        .catch(error => console.error('Dashboard metrics load error:', error));
    
    // Load recent orders once (not realtime to reduce aggressive reads)
    console.log('[Dashboard] Loading recent orders');
    db.collection('orders')
        .where('restaurantId', '==', app.currentRestaurantId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
        .then((snapshot) => {
            console.log('[Dashboard] Recent orders loaded:', snapshot.size, 'orders');
            const list = document.getElementById('recent-orders-list');
            if (!list) return;

            list.innerHTML = '';
            
            if (snapshot.empty) {
                list.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No orders yet</p>';
                console.log('[Dashboard] No recent orders found');
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
                        <div><span style="color: #999; font-size: 0.8rem;">Total</span><strong style="color: #10B981;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.total || 0, order.totalCurrency || 'INR', CurrencyManager.activeCurrency))}</strong></div>
                    </div>
                `;
                list.appendChild(card);
            });
        })
        .catch(error => console.error('Recent orders load error:', error));
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
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // CRITICAL: Unsubscribe from ALL listeners when switching away from their tabs
    // This prevents continuous reads when owner is NOT on that tab
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Unsubscribe from ORDERS listener when leaving Orders tab
    if (pageName !== 'orders' && activeListeners.orders) {
        console.log('[Dashboard] Unsubscribing from Orders listener');
        activeListeners.orders(); // Call the unsubscribe function
        activeListeners.orders = null;
        app.currentOrdersFilter = null;
    }
    
    // Unsubscribe from KITCHEN listener when leaving Kitchen tab
    if (pageName !== 'kitchen' && activeListeners.kitchen) {
        console.log('[Dashboard] Unsubscribing from Kitchen listener');
        activeListeners.kitchen(); // Call the unsubscribe function
        activeListeners.kitchen = null;
    }
    
    // Unsubscribe from DASHBOARD listeners when leaving Dashboard tab
    if (pageName !== 'overview') {
        console.log('[Dashboard] Unsubscribing from Dashboard listeners');
        clearListeners(['dashboardRestaurantListener', 'dashboardMetricsListener', 'dashboardOrdersListener']);
        app.sessionLoaded.overview = false; // Reset so listeners can be recreated if needed
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

    // ═══════════════════════════════════════════════════════════════════════════════
    // LOAD PAGE DATA - Listeners will only activate for the current tab
    // ═══════════════════════════════════════════════════════════════════════════════
    
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
        // ✓ ORDERS tab - Setup real-time listener ONLY when viewing this tab
        console.log('[Dashboard] Setting up Orders listener');
        setupOrdersListener('all');
    } else if (pageName === 'kitchen') {
        // ✓ KITCHEN tab - Setup real-time listener ONLY when viewing this tab
        console.log('[Dashboard] Setting up Kitchen listener');
        setupKitchenListener();
    } else if (pageName === 'overview') {
        // ✓ DASHBOARD/OVERVIEW tab - Setup listeners ONLY when viewing this tab
        console.log('[Dashboard] Setting up Dashboard listeners');
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
        // Guard: If menu data already loaded in this session, skip
        if (app.sessionLoaded.menu) {
            console.log('[Menu] Menu data already loaded in this session');
            return;
        }
        
        app.sessionLoaded.menu = true;
        
        // OPTIMIZED: Use cached menu data to prevent read explosion
        let menuData;
        try {
            menuData = await loadMenuDataOptimized(app.currentRestaurantId);
        } catch (error) {
            console.error('[Menu] Failed to load menu data:', error);
            showNotification('Failed to load menu data', 'error');
            return;
        }

        // Create snapshot-like objects from cached data
        const categoriesSnapshot = {
            empty: menuData.categories.length === 0,
            forEach: function(callback) {
                menuData.categories.forEach((cat, idx) => {
                    callback({ id: cat.id, data: () => cat });
                });
            }
        };

        const variantsSnapshot = {
            empty: menuData.variants.length === 0,
            forEach: function(callback) {
                menuData.variants.forEach((v, idx) => {
                    callback({ id: v.id, data: () => v });
                });
            }
        };

        const addonsSnapshot = {
            empty: menuData.addons.length === 0,
            forEach: function(callback) {
                menuData.addons.forEach((a, idx) => {
                    callback({ id: a.id, data: () => a });
                });
            }
        };

        const foodsSnapshot = {
            empty: menuData.foods.length === 0,
            forEach: function(callback) {
                menuData.foods.forEach((f, idx) => {
                    callback({ id: f.id, data: () => f });
                });
            }
        };
        
        const categorySelect = document.getElementById('foodCategory');
        if (categorySelect) {
            categorySelect.innerHTML = '<option>Select Category</option>';
            menuData.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                categorySelect.appendChild(option);
            });
        }

        const variantsSelectDiv = document.getElementById('food-variants-select');
        if (variantsSelectDiv) {
            variantsSelectDiv.innerHTML = '';
            if (menuData.variants.length === 0) {
                variantsSelectDiv.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No variants added yet</p>';
            } else {
                menuData.variants.forEach(variant => {
                    const checkbox = document.createElement('div');
                    checkbox.style.padding = '8px 0';
                    const variantPrice = CurrencyManager.convert(variant.priceAdjustment || 0, variant.priceAdjustmentCurrency || 'INR', CurrencyManager.activeCurrency);
                    checkbox.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" value="${variant.id}">
                            <span>${variant.name} (+${CurrencyManager.getCurrentCurrency().symbol}${variantPrice.toFixed(2)})</span>
                        </label>
                    `;
                    variantsSelectDiv.appendChild(checkbox);
                });
            }
        }

        const addonsSelectDiv = document.getElementById('food-addons-select');
        if (addonsSelectDiv) {
            addonsSelectDiv.innerHTML = '';
            if (menuData.addons.length === 0) {
                addonsSelectDiv.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No addons added yet</p>';
            } else {
                menuData.addons.forEach(addon => {
                    const checkbox = document.createElement('div');
                    checkbox.style.padding = '8px 0';
                    const addonPrice = CurrencyManager.convert(addon.price || 0, addon.priceCurrency || 'INR', CurrencyManager.activeCurrency);
                    checkbox.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" value="${addon.id}">
                            <span>${addon.name} (+${CurrencyManager.getCurrentCurrency().symbol}${addonPrice.toFixed(2)})</span>
                        </label>
                    `;
                    addonsSelectDiv.appendChild(checkbox);
                });
            }
        }
        
        app.foods = menuData.foods;
        
        const foodsList = document.getElementById('foods-list');
        if (foodsList) {
            foodsList.innerHTML = '';
            
            if (menuData.foods.length === 0) {
                foodsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No food items added yet</p>';
            }
            
            menuData.foods.forEach(food => {
                const card = document.createElement('div');
                card.className = 'food-card';
                card.innerHTML = `
                    <div class="food-image">
                        ${food.image ? `<img src="${food.image}" alt="${food.name}" style="width: 100%; height: 100%; object-fit: cover;">` : '🍜'}
                    </div>
                    <div class="food-info">
                        <div class="food-name">${food.name}</div>
                        <div class="food-category">${food.category}</div>
                        <div class="food-price" data-original-price="${food.price}" data-original-currency="${food.priceCurrency || 'INR'}">${CurrencyManager.formatPrice(CurrencyManager.convert(food.price, food.priceCurrency || 'INR', CurrencyManager.activeCurrency))}${food.discountPrice ? ` <span style="text-decoration: line-through;" data-original-price="${food.discountPrice}" data-original-currency="${food.discountPriceCurrency || 'INR'}">${CurrencyManager.formatPrice(CurrencyManager.convert(food.discountPrice, food.discountPriceCurrency || 'INR', CurrencyManager.activeCurrency))}</span>` : ''}</div>
                    </div>
                    <div class="food-actions">
                        <button class="btn btn-sm" onclick="editFood('${food.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFood('${food.id}')">Delete</button>
                    </div>
                `;
                foodsList.appendChild(card);
            });
        }
        
        app.categories = menuData.categories;
        
        const catList = document.getElementById('categories-list');
        if (catList) {
            catList.innerHTML = '';
            
            if (menuData.categories.length === 0) {
                catList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No categories added yet</p>';
            }
            
            menuData.categories.forEach(cat => {
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `
                    <div class="category-info">
                        <h4>${cat.name}</h4>
                        <p>${cat.description || 'No description'}</p>
                    </div>
                    <div class="category-actions">
                        <button class="btn btn-sm" onclick="editCategory('${cat.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">Delete</button>
                    </div>
                `;
                catList.appendChild(card);
            });
        }

        app.variants = menuData.variants;

        const variantsList = document.getElementById('variants-list');
        if (variantsList) {
            variantsList.innerHTML = '';
            
            if (menuData.variants.length === 0) {
                variantsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No variants added yet</p>';
            }
            
            menuData.variants.forEach(variant => {
                const card = document.createElement('div');
                card.className = 'variant-card';
                card.innerHTML = `
                    <div class="variant-info">
                        <h4>${variant.name}</h4>
                        <p>Price Adjustment: +${CurrencyManager.formatPrice(CurrencyManager.convert(variant.priceAdjustment || 0, variant.priceAdjustmentCurrency || 'INR', CurrencyManager.activeCurrency))}</p>
                        <p style="font-size: 0.9rem; color: #999;">${variant.description || 'No description'}</p>
                    </div>
                    <div class="variant-actions">
                        <button class="btn btn-sm" onclick="editVariant('${variant.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteVariant('${variant.id}')">Delete</button>
                    </div>
                `;
                variantsList.appendChild(card);
            });
        }

        app.addons = menuData.addons;

        const addonsList = document.getElementById('addons-list');
        if (addonsList) {
            addonsList.innerHTML = '';
            
            if (menuData.addons.length === 0) {
                addonsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No addons added yet</p>';
            }
            
            menuData.addons.forEach(addon => {
                const card = document.createElement('div');
                card.className = 'addon-card';
                card.innerHTML = `
                    <div class="addon-info">
                        <h4>${addon.name}</h4>
                        <p>Price: ${CurrencyManager.formatPrice(CurrencyManager.convert(addon.price, addon.priceCurrency || 'INR', CurrencyManager.activeCurrency))}</p>
                        <p style="font-size: 0.9rem; color: #999;">${addon.description || 'No description'}</p>
                    </div>
                    <div class="addon-actions">
                        <button class="btn btn-sm" onclick="editAddon('${addon.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteAddon('${addon.id}')">Delete</button>
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
            // Load categories with limit
            const categoriesSnapshot = await db.collection('categories')
                .where('restaurantId', '==', app.currentRestaurantId)
                .orderBy('position', 'asc')
                .limit(100)
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

            // Load variants with professional styling and limit
            const variantsSnapshot = await db.collection('variants')
                .where('restaurantId', '==', app.currentRestaurantId)
                .limit(1000)
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
                                <span style="margin-left: auto; color: #22c55e; font-weight: 600;">+${CurrencyManager.formatPrice(CurrencyManager.convert(variant.priceAdjustment || 0, variant.priceAdjustmentCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
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

            // Load addons with professional styling and limit
            const addonsSnapshot = await db.collection('addons')
                .where('restaurantId', '==', app.currentRestaurantId)
                .limit(500)
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
                                <span style="margin-left: auto; color: #f97316; font-weight: 600;">+${CurrencyManager.formatPrice(CurrencyManager.convert(addon.price, addon.priceCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
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
    
    // Set default icon
    const iconInput = document.getElementById('categoryIcon');
    if (iconInput) {
        iconInput.value = '🍽️';
    }
    
    // Popular categories for quick selection
    const quickCategories = [
        'Burgers', 'Pizza', 'Chicken', 'Seafood', 'Biryani', 'Noodles',
        'Salad', 'Dessert', 'Coffee', 'Curry', 'Tandoori', 'Dosa',
        'Kebab', 'Tacos', 'Sushi', 'Bread', 'Rice', 'Soup',
        'Sandwich', 'Hot Dog', 'Fries', 'Ice Cream', 'Tea', 'Juice'
    ];
    
    setTimeout(() => {
        const quickButtonsContainer = document.getElementById('quickCategoryButtons');
        if (quickButtonsContainer) {
            quickButtonsContainer.innerHTML = '';
            quickCategories.forEach(cat => {
                const btn = document.createElement('button');
                btn.textContent = cat;
                btn.type = 'button';
                btn.style.cssText = 'padding: 8px 10px; font-size: 12px; border: 1px solid #E2E8F0; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; text-align: center; font-weight: 500;';
                btn.onmouseover = () => {
                    btn.style.background = '#F1F5F9';
                    btn.style.borderColor = '#3B82F6';
                };
                btn.onmouseout = () => {
                    btn.style.background = 'white';
                    btn.style.borderColor = '#E2E8F0';
                };
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.getElementById('categoryName').value = cat;
                    btn.style.background = '#3B82F6';
                    btn.style.color = 'white';
                    btn.style.borderColor = '#3B82F6';
                    setTimeout(() => {
                        document.getElementById('categoryName').focus();
                    }, 50);
                };
                quickButtonsContainer.appendChild(btn);
            });
        }
    }, 50);
    
    // Add icon picker if not already present
    const categoryIcons = ['🍽️', '🍔', '🍕', '🍝', '🍜', '🍲', '🥘', '🍛', '🍣', '🥗', '🍱', '🥙', '🌮', '🌯', '🥪', '🍰', '🧁', '☕', '🥤', '🍷', '🍻', '🥂', '🍾', '🌭', '🥓', '🥩', '🍗', '🐟', '🦐', '🥟', '🍤', '🥠', '🥟', '🍚', '🍚', '🥞', '🧇', '🥯', '🍗', '🍖', '🌯', '🥙', '🥪', '🍖', '🧆', '🧈', '🥨', '🥐', '🍞', '🥖', '🥯', '🍠', '🥐', '🍪', '🍩', '🍮', '🍯', '🍼', '☕', '🍵', '🍶', '🍺', '🍻', '🍹', '🍸', '🥃', '🍲', '🥘', '🍛', '🍜', '🍲', '🥞', '🍤', '🦪', '🍥', '🍣', '🍱', '🥟', '🦑', '🦐', '🐙'];
    
    setTimeout(() => {
        const iconSection = document.querySelector('.category-icon-picker');
        if (!iconSection && document.getElementById('categoryIcon')) {
            const container = document.getElementById('categoryIcon').parentElement;
            const pickerDiv = document.createElement('div');
            pickerDiv.className = 'category-icon-picker';
            pickerDiv.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 10px;';
            
            categoryIcons.forEach(icon => {
                const btn = document.createElement('button');
                btn.textContent = icon;
                btn.style.cssText = 'padding: 10px; font-size: 1.5rem; border: 2px solid #E5E7EB; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s;';
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.getElementById('categoryIcon').value = icon;
                    document.querySelectorAll('.category-icon-picker button').forEach(b => b.style.transform = 'scale(1)');
                    btn.style.transform = 'scale(1.3)';
                    btn.style.background = '#3B82F6';
                    btn.style.color = 'white';
                    btn.style.borderColor = '#3B82F6';
                };
                pickerDiv.appendChild(btn);
            });
            
            container.appendChild(pickerDiv);
        }
    }, 100);
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
            priceCurrency: CurrencyManager.activeCurrency,
            discountPrice: document.getElementById('foodDiscountPrice')?.value ? parseFloat(document.getElementById('foodDiscountPrice').value) : null,
            discountPriceCurrency: document.getElementById('foodDiscountPrice')?.value ? CurrencyManager.activeCurrency : null,
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
            icon: document.getElementById('categoryIcon')?.value || '🍽️',
            position: app.categories.length,
            createdAt: new Date()
        };
        
        const categoryRef = await db.collection('categories').add(categoryData);
        
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
            priceAdjustmentCurrency: CurrencyManager.activeCurrency,
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
            priceCurrency: CurrencyManager.activeCurrency,
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
                                priceAdjustmentCurrency: CurrencyManager.activeCurrency,
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
                                priceCurrency: CurrencyManager.activeCurrency,
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
    
    const ordersList = document.getElementById('orders-list');
    if (!ordersList) {
        console.log('[Orders] orders-list element not found - skipping listener setup');
        return;
    }
    
    if (activeListeners.orders && app.currentOrdersFilter === filter) {
        console.log('[Orders] Listener already active for filter:', filter);
        return;
    }
    
    // Clean up previous listener
    if (activeListeners.orders) {
        console.log('[Orders] Unsubscribing from previous listener');
        activeListeners.orders();
        activeListeners.orders = null;
    }
    
    app.currentOrdersFilter = filter;
    
    let query = db.collection('orders').where('restaurantId', '==', app.currentRestaurantId);
    
    if (filter !== 'all') {
        query = query.where('status', '==', filter);
    }
    
    console.log('[Orders] Setting up listener for filter:', filter);
    
    // OPTIMIZED: Add limit to prevent reading all orders
    activeListeners.orders = query
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(
        (snapshot) => {
            const list = document.getElementById('orders-list');
            if (!list) return;
            
            list.innerHTML = '';
            
            if (snapshot.empty) {
                list.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No orders found</p>';
                return;
            }
            
            // OPTIMIZED: Use docChanges() to only process changed documents
            snapshot.docChanges().forEach(change => {
                const doc = change.doc;
                const order = doc.data();
                const card = document.createElement('div');
                card.className = 'order-card';
                card.id = `order-${doc.id}`;
                
                // Get currency from order or default to INR
                const orderCurrency = order.totalCurrency || order.currency || 'INR';
                const formatPrice = (amount) => {
                    if (typeof CurrencyManager !== 'undefined') {
                        return CurrencyManager.formatPrice(CurrencyManager.convertPrice(amount, orderCurrency, CurrencyManager.activeCurrency));
                    }
                    return CurrencyManager.formatPrice(CurrencyManager.convertPrice(amount.toFixed(2)));
                };
                
                let itemsList = '';
                let totalItems = 0;
                order.items?.forEach(item => {
                    totalItems += item.quantity || 1;
                    const itemCurrency = item.priceCurrency || orderCurrency || 'INR';
                    const itemTotal = CurrencyManager.convertPrice(item.price * item.quantity, itemCurrency, CurrencyManager.activeCurrency);
                    const formattedPrice = CurrencyManager.formatPrice(itemTotal);
                    itemsList += `<li><span>${item.quantity}x ${item.name}</span> <span style="color: #999;">${formattedPrice}</span></li>`;
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
                            <strong style="font-size: 1.2rem; color: #10B981;">${formatPrice(order.total || 0)}</strong>
                        </div>
                    </div>
                    <div class="order-items" style="padding: 12px 0; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0;">
                        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;">
                            ${itemsList}
                        </ul>
                    </div>
                    ${order.paymentStatus ? `<div style="padding: 8px 0; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;"><div><span style="color: #999;">Payment:</span> <strong style="color: ${order.paymentStatus === 'paid' ? '#10B981' : '#EF4444'}">${order.paymentStatus}</strong></div>${order.paymentStatus === 'pending' ? `<button class="btn btn-sm" onclick="updatePaymentStatus('${doc.id}', 'completed')" style="background: #10B981; color: white; padding: 4px 12px; font-size: 0.8rem;">Mark Paid</button>` : ''}</div>` : ''}
                    <div class="order-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; padding: 12px 0; border-top: 1px solid #E2E8F0;">
                        <button class="btn btn-sm" onclick="showOrderDetailsModal('${doc.id}')" style="background: #6366F1;">View</button>
                        ${order.status === 'pending' ? `<button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}', 'preparing')" style="background: #3B82F6;">Start</button>` : ''}
                        ${order.status === 'preparing' ? `<button class="btn btn-sm" onclick="updateOrderStatus('${doc.id}', 'ready')" style="background: #F59E0B;">Ready</button>` : ''}
                        ${order.status !== 'completed' && order.status !== 'cancelled' ? `<button class="btn btn-sm btn-success" onclick="updateOrderStatus('${doc.id}', 'completed')">Done</button>` : ''}
                        ${order.status !== 'cancelled' && order.status !== 'completed' ? `<button class="btn btn-sm btn-danger" onclick="cancelOrder('${doc.id}')">Cancel</button>` : ''}
                        <button class="btn btn-sm" onclick="printOrderReceipt('${doc.id}')" style="background: #8B5CF6;">Print</button>
                    </div>
                `;
                
                // Handle different change types
                if (change.type === 'added') {
                    list.appendChild(card);
                } else if (change.type === 'modified') {
                    const existing = list.getElementById(`order-${doc.id}`);
                    if (existing) {
                        existing.replaceWith(card);
                    } else {
                        list.appendChild(card);
                    }
                } else if (change.type === 'removed') {
                    const existing = list.getElementById(`order-${doc.id}`);
                    if (existing) {
                        existing.remove();
                    }
                }
            });
        },
        (error) => {
            console.error('[Orders] Listener error:', error);
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

async function updatePaymentStatus(orderId, newStatus) {
    try {
        await db.collection('orders').doc(orderId).update({
            paymentStatus: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Payment status updated to ' + newStatus + '!', 'success');
        loadOrders('all');
    } catch (error) {
        console.error('Error updating payment status:', error);
        showNotification('Failed to update payment status', 'error');
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
    
    // CRITICAL: Check if DOM element exists - don't create listener if not visible
    const kitchenDisplay = document.getElementById('kitchen-display');
    if (!kitchenDisplay) {
        console.log('[Kitchen] kitchen-display element not found in DOM - skipping listener setup');
        return;
    }
    
    // Guard: If listener already exists, don't recreate it
    if (activeListeners.kitchen) {
        console.log('[Kitchen] Listener already active');
        return;
    }
    
    // Unsubscribe from previous listener only if it exists
    if (activeListeners.kitchen) {
        console.log('[Kitchen] Unsubscribing from previous listener');
        activeListeners.kitchen();
        activeListeners.kitchen = null;
    }
    console.log('[Kitchen] Setting up listener');
    
    // OPTIMIZED: Set up real-time listener for kitchen display with limits
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    activeListeners.kitchen = db.collection('orders')
        .where('restaurantId', '==', app.currentRestaurantId)
        .where('createdAt', '>=', twentyFourHoursAgo)
        .where('status', '!=', 'completed')
        .orderBy('status')
        .orderBy('createdAt', 'desc')
        .limit(30)
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
                    <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(item.price * item.quantity))}</td>
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
                    ${order.appliedCoupon ? `
                        <tr style="background: #F0FDF4; border-top: 1px solid #E5E7EB;">
                            <td colspan="2" style="padding: 12px; text-align: right;">Coupon (${order.appliedCoupon.code})</td>
                            <td style="padding: 12px; text-align: right; color: #10B981; font-size: 1rem;">-${CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.appliedCoupon.discountAmount || 0, order.totalCurrency || 'INR', CurrencyManager.activeCurrency))}</td>
                        </tr>
                    ` : ''}
                    <tr style="background: #F9FAFB; font-weight: 600; border-top: 2px solid #E5E7EB;">
                        <td colspan="2" style="padding: 12px; text-align: right;">Total</td>
                        <td style="padding: 12px; text-align: right; color: #10B981; font-size: 1.2rem;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.total || 0, order.totalCurrency || 'INR', CurrencyManager.activeCurrency))}</td>
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
                    <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(item.price * item.quantity))}</td>
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
                                <td style="text-align: right;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.total || 0, order.totalCurrency || 'INR', CurrencyManager.activeCurrency))}</td>
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
        
        // Guard: If analytics already loaded in this session, skip
        if (app.sessionLoaded.analytics) {
            console.log('[Analytics] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.analytics = true;
        
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
        
        // Format currency for display
        const formatCurrency = (amount) => {
            if (typeof CurrencyManager !== 'undefined') {
                return CurrencyManager.formatPrice(CurrencyManager.convertPrice(amount, 'INR', CurrencyManager.activeCurrency));
            }
            return '₹' + amount.toLocaleString();
        };
        
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
                        <span class="metric-value">${formatCurrency(totalRevenue)}</span>
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
                        <span class="metric-value">${formatCurrency(avgOrderValue)}</span>
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
        
        // Guard: If reviews already loaded in this session, skip
        if (app.sessionLoaded.reviews) {
            console.log('[Reviews] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.reviews = true;
        
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
                <div class="review-text">${review.comment || review.text || ''}</div>
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
        // Enhanced subscription check
        if (!app.currentRestaurant) {
            showNotification('❌ Restaurant data not loaded. Please refresh the page.', 'error');
            return;
        }
        
        if (!isQRCodeAccessAllowed(app.currentRestaurant)) {
            const subscription = app.currentRestaurant.subscription || {};
            
            if (subscription.status !== 'active') {
                showNotification('❌ Your subscription is not active. Please renew to use QR codes.', 'error');
            } else if (isSubscriptionExpired(app.currentRestaurant)) {
                showNotification('❌ Your subscription has expired on ' + 
                    new Date(subscription.expiryDate).toLocaleDateString('en-IN') + 
                    '. Please renew your subscription to continue using QR codes.', 'error');
            } else if (app.currentRestaurant.premium !== true) {
                showNotification('❌ Your account is not premium. Please upgrade to use QR codes.', 'error');
            } else {
                showNotification('❌ Unable to access QR code feature. Please contact support.', 'error');
            }
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

// Renewal payment now handled by handleRenewalPayment() from renewal-payment.js
// This function is deprecated and kept for backward compatibility
async function renewSubscription() {
    if (typeof handleRenewalPayment === 'function') {
        return await handleRenewalPayment();
    }
    showNotification('Payment system not ready. Please refresh the page.', 'error');
}

// ============================================
// CUSTOMER MENU EXPERIENCE
// ============================================

// Show server down page when QR is disabled
function showServerDownPage(restaurantName) {
    const appDiv = document.getElementById('app');
    appDiv.innerHTML = `
        <div style="
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
        ">
            <div style="
                background: white;
                border-radius: 16px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                max-width: 400px;
            ">
                <div style="
                    font-size: 80px;
                    margin-bottom: 20px;
                    animation: pulse 2s infinite;
                ">⚠️</div>
                
                <h1 style="
                    font-size: 28px;
                    color: #0F172A;
                    margin-bottom: 12px;
                    font-weight: 700;
                ">Server Down</h1>
                
                <p style="
                    font-size: 16px;
                    color: #64748B;
                    margin-bottom: 8px;
                ">${restaurantName}</p>
                
                <p style="
                    font-size: 14px;
                    color: #94A3B8;
                    line-height: 1.6;
                ">
                    We're currently maintaining our service. Please try again in a few moments.
                </p>
                
                <div style="
                    margin-top: 30px;
                    padding-top: 30px;
                    border-top: 1px solid #E2E8F0;
                ">
                    <p style="
                        font-size: 13px;
                        color: #94A3B8;
                    ">Contact the restaurant for assistance</p>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        </style>
    `;
}

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
        
        const restaurantData = restaurantDoc.data();
        
        // Check if QR code is enabled
        if (restaurantData.qr_enabled === false) {
            console.warn('[Customer] QR code is disabled for this restaurant');
            // Show server down page
            showServerDownPage(restaurantData.name || 'Restaurant');
            return;
        }
        
        console.log('[Customer] Restaurant data loaded:', restaurantData.name);
        app.currentRestaurant = restaurantData;
        
        // Apply restaurant's currency setting for customer menu
        const restaurantCurrency = restaurantData.currency || 'INR';
        console.log('[Customer] Applying restaurant currency:', restaurantCurrency);
        CurrencyManager.setCurrency(restaurantCurrency);
        
        // Load nextOrderNumber from Firestore to persist order IDs
        if (restaurantData.nextOrderNumber) {
            app.nextOrderNumber = restaurantData.nextOrderNumber;
            console.log('[Customer] Loaded nextOrderNumber from Firestore:', app.nextOrderNumber);
        } else {
            app.nextOrderNumber = 1;
            console.log('[Customer] No nextOrderNumber found, starting from 1');
        }
        
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
        
        console.log('[Customer] Loading menu data');
        // Setup data loading (replaced realtime listeners with cached one-time loads)
        setupCustomerMenuRealtimeUpdates(restaurantId);
        
        console.log('[Customer] Menu loaded successfully');
        
    } catch (error) {
        console.error('Error loading customer menu:', error);
        showNotification('Failed to load restaurant', 'error');
    }
}

// Optimized customer menu updates with one-time loads and caching (no realtime)
function setupCustomerMenuRealtimeUpdates(restaurantId) {
    try {
        if (!firebaseInitialized || !db) return;
        
        // Guard: If customer menu already initialized for this restaurant in this session, skip
        if (app.sessionLoaded.customerMenuInitialized && app.sessionLoaded.customerMenuRestaurantId === restaurantId) {
            console.log('[Customer] Menu already loaded for this session');
            return;
        }
        
        // Mark as initialized for this session
        app.sessionLoaded.customerMenuInitialized = true;
        app.sessionLoaded.customerMenuRestaurantId = restaurantId;
        
        // Unsubscribe from old listeners
        clearListeners(['customerMenuRestaurantListener', 'customerMenuFoodsListener', 'customerMenuCategoriesListener']);
        
        // Load restaurant data once (cache for 30 min)
        const cachedRestaurant = getCachedData('restaurants', restaurantId);
        if (cachedRestaurant) {
            app.currentRestaurant = { ...app.currentRestaurant, ...cachedRestaurant };
            console.log('[Customer] Using cached restaurant data');
        } else {
            db.collection('restaurants').doc(restaurantId).get()
                .then(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        setCachedData('restaurants', restaurantId, data);
                        app.currentRestaurant = { ...app.currentRestaurant, ...data };
                        loadCustomerRestaurantData();
                    }
                })
                .catch(error => console.warn('[Customer] Restaurant load error:', error));
        }
        
        // Load foods once (cache for 30 min)
        const cachedFoods = getCachedData('foods', restaurantId);
        if (cachedFoods) {
            console.log('[Customer] Using cached foods data');
        } else {
            db.collection('foods')
                .where('restaurantId', '==', restaurantId)
                .get()
                .then(snapshot => {
                    const foods = [];
                    snapshot.forEach(doc => foods.push({ id: doc.id, ...doc.data() }));
                    setCachedData('foods', restaurantId, foods);
                })
                .catch(error => console.warn('[Customer] Foods load error:', error));
        }
        
        // Load categories once (cache for 30 min)
        const cachedCategories = getCachedData('categories', restaurantId);
        if (cachedCategories) {
            console.log('[Customer] Using cached categories data');
        } else {
            db.collection('categories')
                .where('restaurantId', '==', restaurantId)
                .get()
                .then(snapshot => {
                    const categories = [];
                    snapshot.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
                    setCachedData('categories', restaurantId, categories);
                })
                .catch(error => console.warn('[Customer] Categories load error:', error));
        }
        
    } catch (error) {
        console.error('Error loading customer menu data:', error);
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
        
        // Load actual review count and rating
        try {
            const reviewsSnapshot = await db.collection('reviews')
                .where('restaurantId', '==', app.currentRestaurantId)
                .get();
            
            if (!reviewsSnapshot.empty) {
                let totalRating = 0;
                reviewsSnapshot.forEach(doc => {
                    totalRating += doc.data().rating || 0;
                });
                const avgRating = (totalRating / reviewsSnapshot.size).toFixed(1);
                document.getElementById('restaurant-rating').textContent = `⭐ ${avgRating} (${reviewsSnapshot.size} reviews)`;
            } else {
                document.getElementById('restaurant-rating').textContent = '⭐ No reviews yet';
            }
        } catch (error) {
            console.error('Error loading reviews:', error);
            document.getElementById('restaurant-rating').textContent = '⭐ Rating';
        }
    } catch (error) {
        console.error('Error loading restaurant data:', error);
    }
}

async function loadCustomerMenuItems() {
    try {
        // Load and display offers/coupons banner
        await loadAndDisplayCustomerOffers();
        
        // Try to use cached categories first
        let categoriesSnapshot;
        const cachedCats = getCachedData('categories', app.currentRestaurantId);
        
        if (cachedCats) {
            console.log('[Customer] Using cached categories');
            // Simulate snapshot structure from cached data
            categoriesSnapshot = {
                docs: cachedCats.map(cat => ({ id: cat.id, data: () => ({ ...cat, id: undefined }) })),
                forEach: function(fn) { this.docs.forEach(doc => fn(doc)); }
            };
        } else {
            const snap = await db.collection('categories')
                .where('restaurantId', '==', app.currentRestaurantId)
                .orderBy('position', 'asc')
                .get();
            const cats = [];
            snap.forEach(doc => cats.push({ id: doc.id, ...doc.data() }));
            setCachedData('categories', app.currentRestaurantId, cats);
            categoriesSnapshot = snap;
        }
        
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
                const docId = doc.id;
                const cat = typeof doc.data === 'function' ? doc.data() : doc;
                if (categoryIndex === 0) firstCategory = docId;
                
                const colorScheme = categoryColors[categoryIndex % categoryColors.length];
                
                const card = document.createElement('div');
                card.className = 'category-card premium-category-card' + (categoryIndex === 0 ? ' active' : '');
                card.style.background = colorScheme.bg;
                card.style.color = colorScheme.color;
                card.dataset.categoryId = docId;
                
                card.innerHTML = `
                    <div class="category-icon" style="font-size: 2.5rem; margin-bottom: 8px; width: 60px; height: 60px; margin-left: auto; margin-right: auto;">
                        ${getCategoryIconSVG(cat.name)}
                    </div>
                    <strong class="category-name">${cat.name}</strong>
                `;
                
                card.onclick = () => {
                    document.querySelectorAll('.categories-scroll .category-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    loadFoodsForCategory(docId);
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
            const gradients = ['gradient-purple', 'gradient-pink', 'gradient-orange', 'gradient-teal', 'gradient-sunset'];
            const icons = ['🎉', '🎊', '⭐', '💎', '🔥'];
            let offerIndex = 0;
            
            offersSnapshot.forEach(doc => {
                const offer = doc.data();
                app.offers.push({ id: doc.id, ...offer });
                
                // Determine gradient based on discount value for themed colors
                let themeGradient = 'gradient-purple';
                const discountValue = offer.discount || offer.discountPercent || 0;
                
                if (discountValue >= 50) themeGradient = 'gradient-crimson';
                else if (discountValue >= 30) themeGradient = 'gradient-sunset';
                else if (discountValue >= 15) themeGradient = 'gradient-golden';
                else themeGradient = 'gradient-emerald';
                
                const icon = icons[offerIndex % icons.length];
                offerIndex++;
                
                const safeDiscount = discountValue || 0;
                
                offersHTML += `
                    <div class="premium-offer-card food-themed-card ${themeGradient}">
                        <div class="offer-card-shine"></div>
                        <div class="offer-content">
                            <div class="offer-details">
                                <div class="offer-title">${icon} ${offer.title}</div>
                                <div class="offer-description">${offer.description}</div>
                                <div class="offer-discount-badge">
                                    <span class="discount-value">${safeDiscount}</span>
                                    <span class="discount-symbol">%</span>
                                    <span class="discount-label">OFF</span>
                                </div>
                            </div>
                            <div class="offer-icon-wrapper">${icon}</div>
                        </div>
                    </div>
                `;
            });
            
            // Load coupons into app but don't display in banner
            couponsSnapshot.forEach(doc => {
                const coupon = doc.data();
                app.coupons.push({ id: doc.id, ...coupon });
            });
            
            if (offersHTML) {
                offersContainer.innerHTML = `<div class="premium-offers-container">${offersHTML}</div>`;
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
                        <span class="current" data-original-price="${food.price}" data-original-currency="${food.priceCurrency || 'INR'}">${CurrencyManager.getCurrentCurrency().symbol}${CurrencyManager.convert(food.price, food.priceCurrency || 'INR', CurrencyManager.activeCurrency).toFixed(2)}</span>
                        ${food.discountPrice ? `<span class="original" data-original-price="${food.discountPrice}" data-original-currency="${food.discountPriceCurrency || 'INR'}">${CurrencyManager.getCurrentCurrency().symbol}${CurrencyManager.convert(food.discountPrice, food.discountPriceCurrency || 'INR', CurrencyManager.activeCurrency).toFixed(2)}</span>` : ''}
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
                        <input type="checkbox" value="${variant.id}" data-price="${variant.priceAdjustment || 0}" data-currency="${variant.priceAdjustmentCurrency || 'INR'}" style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="flex: 1; font-weight: 500; color: #0F172A;">${variant.name}</span>
                        <span style="color: #10B981; font-weight: 700;">+${CurrencyManager.getCurrentCurrency().symbol}${CurrencyManager.convert(variant.priceAdjustment || 0, variant.priceAdjustmentCurrency || 'INR', CurrencyManager.activeCurrency).toFixed(2)}</span>
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
                        <input type="checkbox" value="${addon.id}" data-price="${addon.price || 0}" data-currency="${addon.priceCurrency || 'INR'}" style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="flex: 1; font-weight: 500; color: #0F172A;">${addon.name}</span>
                        <span style="color: #10B981; font-weight: 700;">+${CurrencyManager.getCurrentCurrency().symbol}${CurrencyManager.convert(addon.price || 0, addon.priceCurrency || 'INR', CurrencyManager.activeCurrency).toFixed(2)}</span>
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
                    <div style="font-size: 2.2rem; font-weight: 900; color: white;" data-original-price="${foodData.price}" data-original-currency="${foodData.priceCurrency || 'INR'}">${CurrencyManager.getCurrentCurrency().symbol}${CurrencyManager.convert(foodData.price, foodData.priceCurrency || 'INR', CurrencyManager.activeCurrency).toFixed(2)}</div>
                    ${foodData.discountPrice ? `<div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); text-decoration: line-through; margin-top: 2px;" data-original-price="${foodData.discountPrice}" data-original-currency="${foodData.discountPriceCurrency || 'INR'}">${CurrencyManager.getCurrentCurrency().symbol}${CurrencyManager.convert(foodData.discountPrice, foodData.discountPriceCurrency || 'INR', CurrencyManager.activeCurrency).toFixed(2)}</div>` : ''}
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

async function addToCartWithOptions(foodId, basePrice, foodName) {
    try {
        const quantity = parseInt(document.getElementById(`qty-${foodId}`).value) || 1;
        
        // Use already loaded menu data instead of fetching from Firestore
        // Prices are already loaded when customer opened the menu
        // Only validate latest prices when placing order (checkout time)
        const currentBasePrice = basePrice; // Use cached price from loaded menu
        
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
        
        const totalPrice = currentBasePrice + variantPrice + addonPrice;
        
        // Add to cart with options
        const key = foodId;
        if (app.cart[key]) {
            app.cart[key].quantity += quantity;
            app.cart[key].price = totalPrice;
            app.cart[key].basePrice = currentBasePrice;
        } else {
            app.cart[key] = {
                id: foodId,
                name: foodName,
                price: totalPrice,
                priceCurrency: CurrencyManager.activeCurrency,
                basePrice: currentBasePrice,
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
    } catch (error) {
        console.error('[Cart] Error adding to cart:', error);
        showNotification('Error adding to cart. Please try again.', 'error');
    }
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
            priceCurrency: foodData.priceCurrency || 'INR',
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
    let totalInActiveCurrency = 0;
    
    items.forEach(item => {
        const itemCurrency = item.priceCurrency || 'INR';
        // Convert each item price to active currency before summing
        const convertedPrice = CurrencyManager.convert(item.price, itemCurrency, CurrencyManager.activeCurrency);
        const itemTotal = convertedPrice * item.quantity;
        totalInActiveCurrency += itemTotal;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        const displayPrice = CurrencyManager.formatPrice(convertedPrice);
        itemDiv.innerHTML = `
            <div class="cart-item-header">
                <span class="cart-item-name">${item.name}</span>
                <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">×</button>
            </div>
            <div class="cart-item-price">${displayPrice} × ${item.quantity}</div>
            <div class="cart-item-qty">
                <button onclick="updateCartQuantity('${item.id}', -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQuantity('${item.id}', 1)">+</button>
            </div>
        `;
        cartItemsDiv.appendChild(itemDiv);
    });
    
    // Display total in active currency (no conversion needed as we already converted each item)
    document.getElementById('total').textContent = CurrencyManager.formatPrice(totalInActiveCurrency);
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

function selectTableAndContinue(tableNumber) {
    // Set the selected table
    app.selectedTable = tableNumber;
    console.log('Table selected:', tableNumber);
    
    // Close the modal
    closeTableSelectionModal();
    
    // Ask for customer name
    setTimeout(() => {
        const customerName = prompt('Please enter your name:', '');
        
        if (customerName !== null && customerName.trim() !== '') {
            // Ask for coupon code
            setTimeout(() => {
                showCouponInputModal(customerName.trim());
            }, 300);
        } else if (customerName === '') {
            // User clicked OK but didn't enter a name
            showNotification('Please enter your name to continue', 'error');
            // Reset table selection
            app.selectedTable = null;
        } else {
            // User clicked Cancel
            showNotification('Order cancelled', 'info');
            // Reset table selection
            app.selectedTable = null;
        }
    }, 300);
}

function showCouponInputModal(customerName) {
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
        border-radius: 16px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0; color: #0F172A; font-size: 1.8rem;">Apply Coupon Code</h2>
            <p style="margin: 0; color: #666; font-size: 1rem;">Optional: Enter coupon code for discount</p>
        </div>
        
        <div style="margin-bottom: 24px;">
            <input type="text" id="coupon-code-input" placeholder="Enter coupon code (optional)" style="
                width: 100%;
                padding: 12px 16px;
                border: 2px solid #E2E8F0;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
            " />
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <button onclick="closeCouponModal()" style="
                padding: 12px 30px;
                background: #E5E7EB;
                color: #1F2937;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: background 0.3s ease;
            " onmouseover="this.style.background='#D1D5DB';" onmouseout="this.style.background='#E5E7EB';">
                Skip
            </button>
            <button onclick="proceedWithCoupon('${customerName}')" style="
                padding: 12px 30px;
                background: #3B82F6;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: background 0.3s ease;
            " onmouseover="this.style.background='#2563EB';" onmouseout="this.style.background='#3B82F6';">
                Continue
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Focus on input
    setTimeout(() => {
        document.getElementById('coupon-code-input').focus();
    }, 100);
    
    // Close modal if clicking outside
    modalOverlay.onclick = function(e) {
        if (e.target === modalOverlay) {
            closeCouponModal();
        }
    };
}

function closeCouponModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'slideUp 0.3s reverse';
        setTimeout(() => modal.remove(), 300);
    }
}

async function proceedWithCoupon(customerName) {
    const couponCode = document.getElementById('coupon-code-input')?.value.trim() || '';
    
    if (couponCode) {
        // Validate coupon
        try {
            const couponSnapshot = await db.collection('coupons')
                .where('restaurantId', '==', app.currentRestaurantId)
                .where('code', '==', couponCode.toUpperCase())
                .where('active', '==', true)
                .get();
            
            if (couponSnapshot.empty) {
                showNotification('Invalid coupon code', 'error');
                return;
            }
            
            const coupon = couponSnapshot.docs[0].data();
            app.appliedCoupon = {
                id: couponSnapshot.docs[0].id,
                code: coupon.code,
                discountAmount: coupon.discountAmount || 0,
                discountPercent: coupon.discountPercent || 0,
                discountCurrency: coupon.discountCurrency || 'INR'
            };
            
            showNotification(`✅ Coupon "${couponCode}" applied!`, 'success');
        } catch (error) {
            console.error('Error validating coupon:', error);
            showNotification('Error validating coupon', 'error');
            return;
        }
    } else {
        app.appliedCoupon = null;
    }
    
    closeCouponModal();
    proceedWithOrderPlacement(customerName);
}

function showOrderTicketModal(orderId, tableNumber, customerName, items, total, appliedCoupon) {
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
    
    // Get active currency for formatting
    const activeCurrency = (typeof CurrencyManager !== 'undefined') ? CurrencyManager.activeCurrency : 'INR';
    
    let itemsHTML = '';
    items.forEach(item => {
        const itemCurrency = item.priceCurrency || 'INR';
        const itemTotalInDisplay = CurrencyManager.convertPrice(item.price * item.quantity, itemCurrency, CurrencyManager.activeCurrency);
        const formattedPrice = CurrencyManager.formatPrice(itemTotalInDisplay);
        itemsHTML += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: left;">${item.quantity}x ${item.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formattedPrice}</td>
            </tr>
        `;
    });
    
    // Calculate original total and discount for display
    let originalTotal = total;
    let discountAmount = 0;
    if (appliedCoupon) {
        // Recalculate original total
        originalTotal = total + (appliedCoupon.discountAmount || 0);
        discountAmount = appliedCoupon.discountAmount || 0;
    }
    
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
            ${appliedCoupon ? `
            <div style="display: flex; justify-content: space-between; color: #666; font-size: 0.9rem; margin-top: 10px; padding-top: 10px; border-top: 1px solid #E5E7EB;">
                <span>Coupon Code:</span>
                <span style="font-weight: 600; color: #10B981;">✓ ${appliedCoupon.code}</span>
            </div>
            ` : ''}
        </div>
        
        <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <tbody>
                ${itemsHTML}
                ${appliedCoupon ? `
                <tr style="background: #F0FDF4; border-top: 1px solid #E5E7EB;">
                    <td style="padding: 12px; text-align: left; color: #666; font-size: 0.9rem;">Subtotal</td>
                    <td style="padding: 12px; text-align: right; color: #666; font-size: 0.9rem;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(originalTotal))}</td>
                </tr>
                <tr style="background: #F0FDF4;">
                    <td style="padding: 12px; text-align: left; color: #10B981; font-size: 0.9rem; font-weight: 600;">Discount (${appliedCoupon.discountPercent ? appliedCoupon.discountPercent + '%' : ''})</td>
                    <td style="padding: 12px; text-align: right; color: #10B981; font-size: 0.9rem; font-weight: 600;">-${CurrencyManager.formatPrice(CurrencyManager.convertPrice(discountAmount))}</td>
                </tr>
                ` : ''}
                <tr style="background: #0F172A; color: white; font-weight: 700;">
                    <td style="padding: 14px; text-align: left; border-radius: 0 0 0 8px;">TOTAL AMOUNT</td>
                    <td style="padding: 14px; text-align: right; font-size: 1.3rem; color: #3B82F6; border-radius: 0 0 8px 0;">${CurrencyManager.formatPrice(CurrencyManager.convertPrice(total))}</td>
                </tr>
            </tbody>
        </table>
        
        <div style="background: #ECFDF5; padding: 12px; border-radius: 8px; border-left: 4px solid #10B981; margin-bottom: 25px; font-size: 0.9rem; color: #065F46; font-weight: 500;">
            <strong>✓ Status:</strong> Your order is being prepared in the kitchen. Our staff will serve you shortly!
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <button onclick="downloadOrderReceiptSafe('${orderId}', '${customerName}', ${tableNumber})" style="
                padding: 12px;
                background: #10B981;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.95rem;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 15px rgba(16, 185, 129, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                📥 Download Receipt
            </button>
            
            <button onclick="openCustomerReviewModal()" style="
                padding: 12px;
                background: #F59E0B;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.95rem;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 15px rgba(245, 158, 11, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                ⭐ Write Review
            </button>
        </div>
        
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

async function downloadOrderReceiptSafe(orderId, customerName, tableNumber) {
    try {
        console.log('[Receipt] Fetching order:', orderId);
        
        // Query by orderId field since orders are stored with .add() not .doc()
        const orderSnapshot = await db.collection('orders')
            .where('orderId', '==', orderId)
            .where('restaurantId', '==', app.currentRestaurantId)
            .limit(1)
            .get();
        
        if (orderSnapshot.empty) {
            console.error('[Receipt] Order not found in Firestore. OrderID:', orderId, 'RestaurantID:', app.currentRestaurantId);
            showNotification('Order not found in system. Please try again.', 'error');
            return;
        }
        
        const orderDoc = orderSnapshot.docs[0];
        const orderData = orderDoc.data();
        
        console.log('[Receipt] Order found:', orderData);
        
        const items = orderData.items || [];
        const total = orderData.total || orderData.totalAmount || 0;
        
        downloadOrderReceipt(orderId, tableNumber, customerName, items, total);
    } catch (error) {
        console.error('[Receipt] Error fetching order:', error.message, error.code);
        showNotification('Error downloading receipt: ' + error.message, 'error');
    }
}

function downloadOrderReceipt(orderId, tableNumber, customerName, items, total) {
    try {
        console.log('[Receipt Download] Starting - OrderID:', orderId, 'Items:', items.length, 'Total:', total);
        
        // Parse items if it's a JSON string
        let parsedItems = items;
        if (typeof items === 'string') {
            try {
                parsedItems = JSON.parse(items);
            } catch (e) {
                console.error('Failed to parse items:', e);
                parsedItems = [];
            }
        }
        
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        // Get currency info
        const currency = CurrencyManager.getCurrentCurrency();
        const convertedTotal = CurrencyManager.convertPrice(total);
        
        let itemsHTML = '';
        parsedItems.forEach(item => {
            const itemTotal = CurrencyManager.convertPrice(item.price * item.quantity);
            const formattedPrice = CurrencyManager.formatPrice(itemTotal, currency.code);
            itemsHTML += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantity}x ${item.name}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formattedPrice}</td>
                </tr>
            `;
        });
        
        const formattedTotal = CurrencyManager.formatPrice(convertedTotal, currency.code);
        
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
                <div class="receipt" id="receiptContent">
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
                                <td style="text-align: right; color: #3B82F6;">${formattedTotal}</td>
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
                    // Convert to JPEG using html2canvas
                    if (typeof html2canvas !== 'undefined') {
                        html2canvas(document.getElementById('receiptContent'), {
                            backgroundColor: '#ffffff',
                            scale: 2,
                            useCORS: true
                        }).then(canvas => {
                            const link = document.createElement('a');
                            link.href = canvas.toDataURL('image/jpeg', 0.95);
                            link.download = 'Receipt-${orderId}-' + Date.now() + '.jpeg';
                            link.click();
                            window.close();
                        }).catch(error => {
                            console.error('Error generating JPEG:', error);
                            window.print();
                        });
                    } else {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;
        
        // Create blob and download
        const blob = new Blob([receiptHTML], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        document.body.appendChild(a);
        
        console.log('[Receipt Download] Opening receipt in new window');
        a.click();
        
        // Cleanup
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
        }, 100);
        
        showNotification('Receipt opening... Download will start automatically', 'success');
        console.log('[Receipt Download] Success - Receipt window opened');
    } catch (error) {
        console.error('[Receipt Download] Error:', error.message, error.stack);
        showNotification('Failed to download receipt: ' + error.message, 'error');
    }
}

async function submitCustomerReview(rating, reviewText) {
    try {
        if (!app.currentRestaurantId) {
            showNotification('Restaurant not found', 'error');
            return;
        }
        
        if (rating < 1 || rating > 5) {
            showNotification('Please select a rating between 1 and 5', 'error');
            return;
        }
        
        if (!reviewText || reviewText.trim().length === 0) {
            showNotification('Please write a review', 'error');
            return;
        }
        
        await db.collection('reviews').add({
            restaurantId: app.currentRestaurantId,
            rating: parseInt(rating),
            comment: reviewText.trim(),
            customerName: 'Anonymous Customer',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            likes: 0
        });
        
        showNotification('Thank you for your review!', 'success');
        // Close review modal
        const modal = document.querySelector('[data-modal="review-modal"]');
        if (modal) {
            modal.remove();
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showNotification('Failed to submit review: ' + error.message, 'error');
    }
}

function openCustomerReviewModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.setAttribute('data-modal', 'review-modal');
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
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
        animation: slideUp 0.3s ease;
    `;
    
    modalContent.innerHTML = `
        <h2 style="margin: 0 0 10px 0; color: #0F172A; text-align: center;">Share Your Feedback</h2>
        <p style="text-align: center; color: #666; margin-bottom: 25px;">Help us improve by sharing your experience</p>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #0F172A;">Rating *</label>
            <div style="display: flex; gap: 10px; justify-content: center;">
                ${[1,2,3,4,5].map(i => `
                    <button onclick="setRating(${i})" style="
                        font-size: 2.5rem;
                        background: none;
                        border: none;
                        cursor: pointer;
                        opacity: 0.5;
                        transition: opacity 0.2s;
                    " id="rating-${i}" title="Click to rate">⭐</button>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #0F172A;">Your Review *</label>
            <textarea id="review-text" placeholder="Tell us about your experience..." style="
                width: 100%;
                padding: 12px;
                border: 2px solid #E2E8F0;
                border-radius: 8px;
                font-family: inherit;
                font-size: 1rem;
                resize: vertical;
                min-height: 120px;
                box-sizing: border-box;
            "></textarea>
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button onclick="this.closest('[data-modal]').remove()" style="
                flex: 1;
                padding: 12px;
                background: #E2E8F0;
                color: #0F172A;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Cancel</button>
            <button onclick="submitCustomerReview(window.selectedRating || 5, document.getElementById('review-text').value)" style="
                flex: 1;
                padding: 12px;
                background: #10B981;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Submit Review</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Set default rating
    window.selectedRating = 5;
    document.getElementById('rating-5').style.opacity = '1';
}

function setRating(rating) {
    // Reset all ratings
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById('rating-' + i);
        if (btn) btn.style.opacity = '0.5';
    }
    // Set selected rating
    window.selectedRating = rating;
    document.getElementById('rating-' + rating).style.opacity = '1';
}

async function proceedRenewalPayment(orderId, restaurantId, amount) {
    try {
        console.log('=== RENEWAL PAYMENT START ===');
        console.log('Order ID:', orderId);
        console.log('Restaurant ID:', restaurantId);
        console.log('Amount:', amount);
        
        if (!firebaseInitialized || !functions) {
            showNotification('Firebase not initialized', 'error');
            return;
        }
        
        if (!auth.currentUser || !auth.currentUser.uid) {
            showNotification('User not authenticated', 'error');
            return;
        }
        
        showNotification('Processing renewal payment...', 'info');
        
        // Get Cashfree session ID for renewal payment
        console.log('Calling initiatePaymentWithCashfree for renewal...');
        const initiatePaymentFunc = functions.httpsCallable('initiatePaymentWithCashfree');
        
        const paymentResponse = await initiatePaymentFunc({
            restaurantId: restaurantId,
            amount: amount,
            plan: 'premium_renewal',
            orderId: orderId,
            isRenewal: true,
            userId: auth.currentUser.uid
        });
        
        console.log('Payment session response:', paymentResponse.data);
        
        if (!paymentResponse.data.success || !paymentResponse.data.sessionId) {
            console.error('Failed to get Cashfree session');
            showNotification('Failed to initialize payment. Please try again.', 'error');
            return;
        }
        
        // Store session ID and proceed with checkout
        app.cashfreeSessionId = paymentResponse.data.sessionId;
        window.renewalPaymentInProgress = true;
        
        console.log('Session ID obtained, proceeding to checkout');
        
        // Proceed with Cashfree checkout for renewal
        await proceedRenewalCheckout(orderId, restaurantId, amount, auth.currentUser.uid);
        
    } catch (error) {
        console.error('Renewal payment error:', error);
        showNotification('Error processing renewal payment: ' + error.message, 'error');
    }
}

async function proceedRenewalCheckout(orderId, restaurantId, amount, userId) {
    try {
        console.log('=== RENEWAL CHECKOUT START ===');
        
        if (typeof Cashfree === 'undefined') {
            console.error('Cashfree SDK not loaded');
            showNotification('Payment gateway SDK not loaded. Please refresh and try again.', 'error');
            return;
        }
        
        if (!app.cashfreeSessionId) {
            console.error('No session ID available');
            showNotification('Payment session not available. Please try again.', 'error');
            return;
        }
        
        let checkoutSuccess = false;
        
        // Try checkoutRedirect on Cashfree constructor
        try {
            if (typeof Cashfree.checkoutRedirect === 'function') {
                console.log('Attempting Cashfree.checkoutRedirect()');
                await Cashfree.checkoutRedirect({
                    sessionId: app.cashfreeSessionId
                });
                checkoutSuccess = true;
                console.log('Cashfree.checkoutRedirect() successful');
            }
        } catch (e) {
            console.log('Cashfree.checkoutRedirect() failed:', e.message);
        }
        
        // Try with instance
        if (!checkoutSuccess) {
            try {
                const instance = new Cashfree({mode: 'production'});
                if (typeof instance.checkout === 'function') {
                    console.log('Attempting instance.checkout()');
                    await instance.checkout({
                        paymentSessionId: app.cashfreeSessionId
                    });
                    checkoutSuccess = true;
                    console.log('instance.checkout() successful');
                }
            } catch (e) {
                console.log('instance.checkout() failed:', e.message);
            }
        }
        
        // Try redirect method
        if (!checkoutSuccess) {
            try {
                if (typeof Cashfree.redirect === 'function') {
                    console.log('Attempting Cashfree.redirect()');
                    await Cashfree.redirect({
                        paymentSessionId: app.cashfreeSessionId
                    });
                    checkoutSuccess = true;
                    console.log('Cashfree.redirect() successful');
                }
            } catch (e) {
                console.log('Cashfree.redirect() failed:', e.message);
            }
        }
        
        // Try using getCheckoutURL
        if (!checkoutSuccess) {
            try {
                if (typeof Cashfree.getCheckoutURL === 'function') {
                    console.log('Attempting Cashfree.getCheckoutURL()');
                    const checkoutURL = await Cashfree.getCheckoutURL({
                        sessionId: app.cashfreeSessionId
                    });
                    if (checkoutURL) {
                        console.log('Got checkout URL, redirecting...');
                        window.location.href = checkoutURL;
                        checkoutSuccess = true;
                    }
                }
            } catch (e) {
                console.log('Cashfree.getCheckoutURL() failed:', e.message);
            }
        }
        
        if (!checkoutSuccess) {
            console.error('No Cashfree checkout method available');
            console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(new Cashfree({mode: 'production'}))));
            showNotification('Payment gateway not available. Please try again.', 'error');
            return;
        }
        
        // Listen for payment result
        setupRenewalPaymentListener(orderId, restaurantId, amount, userId);
        
    } catch (error) {
        console.error('Renewal checkout error:', error);
        showNotification('Error during checkout: ' + error.message, 'error');
    }
}

function setupRenewalPaymentListener(orderId, restaurantId, amount, userId) {
    // Check payment status after a delay
    let checkAttempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    const checkInterval = setInterval(async () => {
        checkAttempts++;
        console.log('Checking renewal payment status, attempt:', checkAttempts);
        
        try {
            // Query by orderId field since document is created with .add()
            const paymentOrderQuery = await db.collection('payment_orders')
                .where('orderId', '==', orderId)
                .limit(1)
                .get();
            
            if (!paymentOrderQuery.empty) {
                const paymentData = paymentOrderQuery.docs[0].data();
                console.log('Payment order status:', paymentData.status);
                
                if (paymentData.status === 'completed' || paymentData.status === 'success') {
                    clearInterval(checkInterval);
                    console.log('Payment successful! Verifying renewal...');
                    
                    // Verify renewal payment
                    await verifyRenewalPaymentCompletion(restaurantId, orderId, amount, userId);
                    
                } else if (paymentData.status === 'failed' || paymentData.status === 'cancelled') {
                    clearInterval(checkInterval);
                    console.log('Payment failed');
                    showNotification('Payment was not successful. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        }
        
        if (checkAttempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.log('Payment verification timeout');
        }
    }, 1000);
}

async function verifyRenewalPaymentCompletion(restaurantId, orderId, amount, userId) {
    try {
        console.log('Verifying renewal payment...');
        
        if (!functions) {
            showNotification('Firebase not initialized', 'error');
            return;
        }
        
        const verifyRenewalFunc = functions.httpsCallable('verifyPaymentAndRenew');
        
        const verifyResult = await verifyRenewalFunc({
            restaurantId: restaurantId,
            orderId: orderId,
            userId: userId
        });
        
        console.log('Renewal verification result:', verifyResult.data);
        
        if (verifyResult.data.success) {
            showNotification('✓ Subscription renewed successfully! Your premium features are active.', 'success');
            
            // Reload dashboard to show updated subscription status
            setTimeout(() => {
                loadDashboardData();
                location.reload();
            }, 2000);
        } else {
            showNotification('Verification failed: ' + (verifyResult.data.message || 'Please contact support'), 'error');
        }
    } catch (error) {
        console.error('Renewal verification error:', error);
        showNotification('Error verifying renewal: ' + error.message, 'error');
    }
}

async function proceedWithOrderPlacement(customerName) {
    try {
        const items = Object.values(app.cart);
        
        // Sanitize items - store currency for each item
        const sanitizedItems = items.map(item => ({
            id: item.id || '',
            name: item.name || 'Unknown Item',
            price: item.price || 0,
            priceCurrency: item.priceCurrency || 'INR',
            category: item.category || '',
            quantity: item.quantity || 1
        }));
        
        // Calculate total in INR (store base value in INR)
        let totalInINR = 0;
        sanitizedItems.forEach(item => {
            const itemCurrency = item.priceCurrency || 'INR';
            const priceInINR = item.price / (CurrencyManager.conversionRates[itemCurrency] || 1);
            totalInINR += priceInINR * item.quantity;
        });
        
        // Apply coupon discount
        let discountAmount = 0;
        let appliedCouponCode = null;
        if (app.appliedCoupon) {
            if (app.appliedCoupon.discountAmount) {
                discountAmount = app.appliedCoupon.discountAmount;
            } else if (app.appliedCoupon.discountPercent) {
                discountAmount = (totalInINR * app.appliedCoupon.discountPercent) / 100;
            }
            appliedCouponCode = app.appliedCoupon.code;
            totalInINR = Math.max(0, totalInINR - discountAmount);
        }
        
        // Generate simple order number
        const orderNumber = String(app.nextOrderNumber).padStart(4, '0');
        const simpleOrderId = 'ORD-' + orderNumber;
        
        const orderData = {
            restaurantId: app.currentRestaurantId,
            orderId: simpleOrderId,
            orderNumber: app.nextOrderNumber,
            tableNumber: app.selectedTable,
            customerName: customerName,
            items: sanitizedItems,
            total: totalInINR,
            totalCurrency: 'INR',
            status: 'pending',
            paymentStatus: 'pending',
            date: new Date().toDateString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            estimatedPrepTime: 30,
            specialInstructions: ''
        };
        
        // Add coupon information to order if applied
        if (app.appliedCoupon) {
            orderData.appliedCoupon = {
                code: app.appliedCoupon.code,
                discountAmount: discountAmount,
                discountPercent: app.appliedCoupon.discountPercent,
                originalTotal: totalInINR + discountAmount
            };
        }
        
        const orderRef = await db.collection('orders').add(orderData);
        
        // Increment order number for next order and save to Firestore
        app.nextOrderNumber++;
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            nextOrderNumber: app.nextOrderNumber
        }).catch(err => console.error('Error updating nextOrderNumber:', err));
        
        // Update table status to occupied
        if (app.currentRestaurant.tables) {
            const tableIndex = app.currentRestaurant.tables.findIndex(t => t.number === app.selectedTable);
            if (tableIndex >= 0) {
                app.currentRestaurant.tables[tableIndex].status = 'occupied';
                app.currentRestaurant.tables[tableIndex].currentOrderId = orderRef.id;
            }
        }
        
        // Clear cart and coupon
        app.cart = {};
        const appliedCouponData = app.appliedCoupon; // Save before clearing
        app.appliedCoupon = null;
        updateCartDisplay();
        
        // Show professional order ticket with coupon data
        showOrderTicketModal(simpleOrderId, app.selectedTable, customerName, sanitizedItems, totalInINR, appliedCouponData);
        
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
            minimumOrderCurrency: CurrencyManager.activeCurrency,
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
// CURRENCY SETTINGS
// ============================================

function initCurrencySettings() {
  try {
    const settingsContent = document.getElementById('settingsContent') || document.querySelector('.settings-section');
    if (!settingsContent) return;

    if (document.getElementById('currencySelectorSection')) return;

    const currencySelectorHTML = `
      <div id="currencySelectorSection" style="padding: 15px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);">
        <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px; color: #fff;">
          💱 Currency
        </label>
        <select id="currencySelect" style="
          width: 100%;
          padding: 8px 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          cursor: pointer;
        ">
          <option value="USD">$ USD - US Dollar</option>
          <option value="INR">₹ INR - Indian Rupee</option>
          <option value="GBP">£ GBP - British Pound</option>
        </select>
        <p style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 8px;">
          ℹ️ Prices will be displayed in your selected currency
        </p>
      </div>
    `;

    if (settingsContent.firstChild) {
      settingsContent.insertAdjacentHTML('afterbegin', currencySelectorHTML);
    }

    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
      currencySelect.value = CurrencyManager.activeCurrency;
      
      currencySelect.addEventListener('change', (e) => {
        const newCurrency = e.target.value;
        CurrencyManager.setCurrency(newCurrency);
        showNotification('💱 Currency changed to ' + CurrencyManager.getCurrentCurrency().symbol + ' ' + newCurrency);
      });
    }
  } catch (err) {
    console.error('[CurrencySettings] Error initializing:', err);
  }
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function loadSettings() {
    try {
        // Initialize currency selector UI
        initCurrencySettings();
        
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
                <p><strong>Price:</strong> ${CurrencyManager.formatPrice(CurrencyManager.convertPrice(restaurant.subscription.monthlyAmount || 499))}/month</p>
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
// CURRENCY SETTINGS MANAGEMENT
// ============================================

/**
 * Load and apply saved currency settings when opening settings page
 */
async function loadCurrencySettings() {
    try {
        // Wait a bit to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get saved currency from localStorage or use app's current currency
        const savedCurrency = localStorage.getItem('user_selected_currency') || CurrencyManager.activeCurrency;
        
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.value = savedCurrency;
            console.log('[Currency] ✓ Loaded settings. Current currency:', savedCurrency);
        } else {
            console.warn('[Currency] currencySelect element not found in DOM');
        }
    } catch (error) {
        console.error('[Currency] Error loading settings:', error);
    }
}

/**
 * Handle currency change in dropdown
 */
async function changeCurrency() {
    try {
        const currencySelect = document.getElementById('currencySelect');
        if (!currencySelect) return;
        
        const selectedCurrency = currencySelect.value;
        console.log('[Currency] Currency selected:', selectedCurrency);
        
        // Temporarily update the currency manager
        CurrencyManager.activeCurrency = selectedCurrency;
        
        // Show preview
        showNotification(`Selected currency: ${CurrencyManager.currencies[selectedCurrency].name}`, 'info');
    } catch (error) {
        console.error('[Currency] Error changing currency:', error);
        showNotification('Error selecting currency', 'error');
    }
}

/**
 * Save currency settings and apply to all food items
 */
async function saveCurrencySettings() {
    try {
        if (!firebaseInitialized || !app.currentRestaurantId) {
            showNotification('Please refresh and try again', 'error');
            return;
        }
        
        const currencySelect = document.getElementById('currencySelect');
        if (!currencySelect) {
            showNotification('Currency selector not found', 'error');
            return;
        }
        
        const selectedCurrency = currencySelect.value;
        
        // Save to localStorage
        localStorage.setItem('user_selected_currency', selectedCurrency);
        
        // Update CurrencyManager
        CurrencyManager.activeCurrency = selectedCurrency;
        
        // Save to Firebase
        await db.collection('restaurants').doc(app.currentRestaurantId).update({
            'settings.currency': selectedCurrency,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Apply currency to all food items displayed
        applyCurrencyToAllPrices();
        
        showNotification(`✓ Currency changed to ${CurrencyManager.currencies[selectedCurrency].name}. All prices updated.`, 'success');
        
        console.log('[Currency] Settings saved. Currency:', selectedCurrency);
    } catch (error) {
        console.error('[Currency] Error saving settings:', error);
        showNotification('Error saving currency settings: ' + error.message, 'error');
    }
}

/**
 * Apply currency conversion to all displayed food items
 */
function applyCurrencyToAllPrices() {
    try {
        const priceElements = document.querySelectorAll('[data-original-price]');
        
        priceElements.forEach(element => {
            const originalPrice = parseFloat(element.getAttribute('data-original-price'));
            const originalCurrency = element.getAttribute('data-original-currency') || 'INR';
            if (isNaN(originalPrice)) return;
            
            // Convert from stored currency to selected currency
            const convertedPrice = CurrencyManager.convert(originalPrice, originalCurrency, CurrencyManager.activeCurrency);
            const currencySymbol = CurrencyManager.getCurrentCurrency().symbol;
            
            element.textContent = `${currencySymbol}${convertedPrice.toFixed(2)}`;
            element.setAttribute('data-current-currency', CurrencyManager.activeCurrency);
        });
        
        console.log('[Currency] Applied to', priceElements.length, 'price elements');
    } catch (error) {
        console.error('[Currency] Error applying prices:', error);
    }
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
        
        // Guard: If settings already loaded in this session, skip
        if (app.sessionLoaded.settings) {
            console.log('[Settings] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.settings = true;
        
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
        
        // Load currency settings
        await loadCurrencySettings();
        
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
        
        // Guard: If categories already loaded in this session, skip
        if (app.sessionLoaded.categories) {
            console.log('[Categories] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.categories = true;
        
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
    
    const categoryIcons = Object.keys(ProfessionalCategoryIcons);
    
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
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Category Icon</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-height: 300px; overflow-y: auto; padding: 10px; border: 1px solid #E5E7EB; border-radius: 8px; background: #F9FAFB;">
                ${categoryIcons.map(iconKey => {
                    const iconObj = ProfessionalCategoryIcons[iconKey];
                    const isSelected = (cat.icon && cat.icon.includes(iconKey)) || getCategoryIconSVG(cat.name) === iconObj.svg;
                    return `
                    <button type="button" onclick="document.getElementById('edit-cat-icon').value='${iconKey}'; document.querySelectorAll('.icon-picker-btn').forEach(b => b.style.border='2px solid #E5E7EB'); event.target.style.border='3px solid #3B82F6'; event.target.style.boxShadow='0 0 8px rgba(59,130,246,0.3)';" class="icon-picker-btn" style="
                        padding: 12px;
                        border: ${isSelected ? '3px solid #3B82F6' : '2px solid #E5E7EB'};
                        background: white;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        ${isSelected ? 'box-shadow: 0 0 8px rgba(59,130,246,0.3);' : ''}
                    ">
                        <div style="width: 50px; height: 50px; margin: 0 auto;">
                            ${iconObj.svg}
                        </div>
                        <div style="font-size: 0.75rem; font-weight: 600; color: #0F172A; margin-top: 4px;">${iconObj.name}</div>
                    </button>
                    `;
                }).join('')}
            </div>
            <input type="hidden" id="edit-cat-icon" value="${cat.icon || 'burger'}" />
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
    const newIcon = document.getElementById('edit-cat-icon').value || '🍽️';
    
    if (!newName) {
        showNotification('Category name cannot be empty', 'error');
        return;
    }
    
    try {
        await db.collection('categories').doc(categoryId).update({
            name: newName,
            description: newDesc,
            icon: newIcon,
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
            icon: cat.icon || '🍽️',
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
        
        // Guard: If foods already loaded in this session, skip
        if (app.sessionLoaded.foods) {
            console.log('[Foods] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.foods = true;
        
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
                        <span class="price" data-original-price="${food.price}" data-original-currency="${food.priceCurrency || 'INR'}">${CurrencyManager.formatPrice(CurrencyManager.convert(food.price, food.priceCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
                        ${food.discountPrice ? `<span class="original-price" data-original-price="${food.discountPrice}" data-original-currency="${food.discountPriceCurrency || 'INR'}">${CurrencyManager.formatPrice(CurrencyManager.convert(food.discountPrice, food.discountPriceCurrency || 'INR', CurrencyManager.activeCurrency))}</span>` : ''}
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
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #0F172A;">Price *</label>
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
            priceCurrency: CurrencyManager.activeCurrency,
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
        
        // Guard: If variants already loaded in this session, skip
        if (app.sessionLoaded.variants) {
            console.log('[Variants] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.variants = true;
        
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
        
        // Guard: If addons already loaded in this session, skip
        if (app.sessionLoaded.addons) {
            console.log('[Addons] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.addons = true;
        
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
                        <strong>${CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.total || 0, order.totalCurrency || 'INR', CurrencyManager.activeCurrency))}</strong>
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
        const itemCurrency = item.priceCurrency || order.totalCurrency || 'INR';
        const itemTotal = CurrencyManager.convertPrice(item.price * item.quantity, itemCurrency, CurrencyManager.activeCurrency);
        const formattedPrice = CurrencyManager.formatPrice(itemTotal);
        itemsHtml += `<div class="order-item">
            <span>${item.name} x${item.quantity}</span>
            <span>${formattedPrice}</span>
        </div>`;
    });
    
    const totalCurrency = order.totalCurrency || 'INR';
    const displayTotal = CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.total || 0, totalCurrency, CurrencyManager.activeCurrency));
    const subtotal = CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.subtotal || 0, totalCurrency, CurrencyManager.activeCurrency));
    const tax = CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.tax || 0, totalCurrency, CurrencyManager.activeCurrency));
    
    const details = `Order #${order.orderId}
Status: ${order.status}
Table: ${order.tableNumber}
Items:
${itemsHtml}
Subtotal: ${subtotal}
Tax: ${tax}
Total: ${displayTotal}`;
    
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
    
    const totalCurrency = order.totalCurrency || 'INR';
    const itemsLine = order.items?.map(item => {
        const itemCurrency = item.priceCurrency || totalCurrency || 'INR';
        const itemTotal = CurrencyManager.convertPrice(item.price * item.quantity, itemCurrency, CurrencyManager.activeCurrency);
        return `${item.name} x${item.quantity} = ${CurrencyManager.formatPrice(itemTotal)}`;
    }).join('\n');
    
    const subtotal = CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.subtotal || 0, totalCurrency, CurrencyManager.activeCurrency));
    const tax = CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.tax || 0, totalCurrency, CurrencyManager.activeCurrency));
    const total = CurrencyManager.formatPrice(CurrencyManager.convertPrice(order.total || 0, totalCurrency, CurrencyManager.activeCurrency));
    
    const receipt = `
=========================
${app.currentRestaurant.name}
=========================
Order #${order.orderId}
Table: ${order.tableNumber}
Time: ${new Date(order.createdAt?.toDate()).toLocaleString()}

ITEMS:
${itemsLine}

SUBTOTAL: ${subtotal}
TAX: ${tax}
TOTAL: ${total}

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
        
        // Guard: If offers already loaded in this session, skip
        if (app.sessionLoaded.offers) {
            console.log('[Offers] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.offers = true;
        
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
                        <span class="badge">${offer.type === 'percentage' ? offer.value + '%' : CurrencyManager.formatPrice(CurrencyManager.convertPrice(offer.value, offer.valueCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
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
            valueCurrency: CurrencyManager.activeCurrency,
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
        
        // Guard: If coupons already loaded in this session, skip
        if (app.sessionLoaded.coupons) {
            console.log('[Coupons] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.coupons = true;
        
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
                        <span>${coupon.discountType === 'percentage' ? coupon.discountValue + '%' : CurrencyManager.formatPrice(CurrencyManager.convertPrice(coupon.discountValue, coupon.discountCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
                        <span>Min: ${CurrencyManager.formatPrice(CurrencyManager.convertPrice(coupon.minimumAmount || 0, coupon.minimumCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
                        <span>Max: ${coupon.maximumDiscount === 'Unlimited' ? 'Unlimited' : CurrencyManager.formatPrice(CurrencyManager.convertPrice(coupon.maximumDiscount || 0, coupon.maximumCurrency || 'INR', CurrencyManager.activeCurrency))}</span>
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
            discountCurrency: CurrencyManager.activeCurrency,
            minimumAmount: minimumAmount,
            minimumCurrency: CurrencyManager.activeCurrency,
            maximumDiscount: maximumDiscount === 0 ? null : maximumDiscount,
            maximumCurrency: CurrencyManager.activeCurrency,
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
            discountCurrency: CurrencyManager.activeCurrency,
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
        console.log('[Coupon] Attempting to delete coupon:', couponId);
        
        if (!app.currentRestaurantId) {
            console.error('[Coupon] Restaurant ID not found');
            showNotification('Restaurant ID not found. Please refresh and try again.', 'error');
            return;
        }
        
        console.log('[Coupon] Restaurant ID:', app.currentRestaurantId);
        
        await db.collection('coupons').doc(couponId).delete();
        
        console.log('[Coupon] Successfully deleted coupon:', couponId);
        loadCoupons();
        showNotification('Coupon deleted successfully', 'success');
    } catch (error) {
        console.error('[Coupon] Error deleting coupon:', {
            message: error.message,
            code: error.code,
            couponId: couponId,
            restaurantId: app.currentRestaurantId,
            userId: auth.currentUser?.uid
        });
        showNotification('Error deleting coupon: ' + error.message, 'error');
    }
}

// ============================================
// RESTAURANT PROFILE MANAGEMENT
// ============================================

async function loadRestaurantProfile() {
    try {
        if (!app.currentRestaurant) return;
        
        // Guard: If profile already loaded in this session, skip
        if (app.sessionLoaded.profile) {
            console.log('[Profile] Already loaded in this session');
            return;
        }
        
        app.sessionLoaded.profile = true;
        
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

            <div class="premium-section">
                <div class="premium-header">
                    <h2 class="premium-title">✨ Premium Features & Support</h2>
                </div>

                <!-- Help Section -->
                <div class="premium-card help-card">
                    <div class="card-icon">📞</div>
                    <div class="card-content">
                        <h3 class="card-title">Get Help & Support</h3>
                        <p class="card-description">Contact our support team for any assistance or queries about RestaurantOS</p>
                        
                        <div class="contact-methods">
                            <div class="contact-item">
                                <div class="contact-label">WhatsApp Support</div>
                                <a href="https://wa.me/918800000000" target="_blank" class="contact-link">
                                    <span class="contact-icon">💬</span>
                                    <span>+91 88000 00000</span>
                                </a>
                            </div>
                            
                            <div class="contact-item">
                                <div class="contact-label">Email Support</div>
                                <a href="mailto:support@restaurantos.com" class="contact-link">
                                    <span class="contact-icon">📧</span>
                                    <span>support@restaurantos.com</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Payment Renewal Section -->
                <div class="premium-card payment-card">
                    <div class="card-icon">💳</div>
                    <div class="card-content">
                        <h3 class="card-title">Subscription Renewal</h3>
                        <p class="card-description">Keep your restaurant active with seamless subscription management</p>
                        
                        <div class="payment-options">
                            <div class="payment-option">
                                <div class="region-badge">🇮🇳 India</div>
                                <div class="payment-details">
                                    <p class="amount">₹499<span class="period">/month</span></p>
                                    <p class="method">Cashfree Payment Gateway</p>
                                </div>
                                <button class="btn btn-primary btn-small" onclick="handleRenewalPayment()">Renew Now</button>
                            </div>
                            
                            <div class="payment-option">
                                <div class="region-badge">🇺🇸 USA</div>
                                <div class="payment-details">
                                    <p class="amount">$49<span class="period">/month</span></p>
                                    <p class="method">PayPal Payment</p>
                                </div>
                                <button class="btn btn-primary btn-small" onclick="handlePayPalRenewal('USD')">Renew via PayPal</button>
                            </div>
                            
                            <div class="payment-option">
                                <div class="region-badge">🇬🇧 UK</div>
                                <div class="payment-details">
                                    <p class="amount">£49<span class="period">/month</span></p>
                                    <p class="method">PayPal Payment</p>
                                </div>
                                <button class="btn btn-primary btn-small" onclick="handlePayPalRenewal('GBP')">Renew via PayPal</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Policy & Legal -->
                <div class="premium-card policy-card">
                    <div class="card-icon">📋</div>
                    <div class="card-content">
                        <h3 class="card-title">Policies & Legal</h3>
                        <p class="card-description">Important information about terms, privacy, and service policies</p>
                        
                        <div class="policy-links">
                            <button class="policy-link-btn" onclick="showPolicyModal('terms')">
                                <span class="policy-icon">📜</span>
                                <span class="policy-text">Terms of Service</span>
                            </button>
                            
                            <button class="policy-link-btn" onclick="showPolicyModal('privacy')">
                                <span class="policy-icon">🔒</span>
                                <span class="policy-text">Privacy Policy</span>
                            </button>
                            
                            <button class="policy-link-btn" onclick="showPolicyModal('refund')">
                                <span class="policy-icon">💰</span>
                                <span class="policy-text">Refund Policy</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- App Version -->
                <div class="premium-footer">
                    <p class="version-text">RestaurantOS v2.0 | Premium Edition</p>
                </div>
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

// Handle PayPal renewal for USA/UK users
async function handlePayPalRenewal(currency) {
    try {
        const userUID = auth.currentUser?.uid;
        if (!userUID) {
            showNotification('Please sign in first', 'error');
            return;
        }

        showNotification('💳 Redirecting to PayPal...', 'info');
        
        // PayPal payment configuration based on currency
        const paypalConfig = {
            USD: {
                amount: '49',
                currency: 'USD',
                currencySymbol: '$'
            },
            GBP: {
                amount: '49',
                currency: 'GBP',
                currencySymbol: '£'
            }
        };

        const config = paypalConfig[currency] || paypalConfig.USD;
        
        // Replace 'shank122004' with your PayPal.me username
        const paypalMeUrl = `https://www.paypal.me/Shashankshri4u/${config.amount}${config.currency}?description=RestaurantOS Monthly Subscription (${currency})`;
        
        // Store payment info for reference
        window.pendingPayPalPayment = {
            userUID: userUID,
            currency: currency,
            amount: config.amount,
            timestamp: new Date().getTime()
        };
        
        // Redirect to PayPal.me
        window.location.href = paypalMeUrl;
        
    } catch (error) {
        console.error('PayPal renewal error:', error);
        showNotification('Error initiating PayPal payment', 'error');
    }
}

// Show policy modal
function showPolicyModal(type) {
    const policyData = {
        terms: {
            title: 'Terms of Service',
            icon: '📜',
            content: `
                <h4>Terms of Service - RestaurantOS</h4>
                <p><strong>Last Updated: 2024</strong></p>
                
                <h5>1. Acceptance of Terms</h5>
                <p>By using RestaurantOS, you agree to these terms and conditions. If you do not agree, please do not use our service.</p>
                
                <h5>2. Service Description</h5>
                <p>RestaurantOS is a digital restaurant management platform that enables restaurants and cafes to manage their operations, including menu management, order processing, and QR-based ordering systems.</p>
                
                <h5>3. User Responsibilities</h5>
                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.</p>
                
                <h5>4. Subscription Terms</h5>
                <p>- Monthly subscription fee: ₹499 (India), $5.99 (USA/UK)<br/>
                - Automatic renewal on each billing cycle<br/>
                - You may cancel your subscription at any time<br/>
                - Cancellation will take effect at the end of the current billing period</p>
                
                <h5>5. Prohibited Activities</h5>
                <p>You may not: violate any laws, engage in fraudulent activities, attempt to gain unauthorized access, or use the platform for illegal purposes.</p>
                
                <h5>6. Limitation of Liability</h5>
                <p>RestaurantOS is provided "as-is" without warranties. We are not liable for indirect, incidental, or consequential damages.</p>
                
                <h5>7. Changes to Terms</h5>
                <p>We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of modified terms.</p>
            `
        },
        privacy: {
            title: 'Privacy Policy',
            icon: '🔒',
            content: `
                <h4>Privacy Policy - RestaurantOS</h4>
                <p><strong>Last Updated: 2024</strong></p>
                
                <h5>1. Information We Collect</h5>
                <p>We collect information you provide directly, such as:</p>
                <p>- Restaurant details (name, address, contact information)<br/>
                - Menu and pricing information<br/>
                - Customer orders and transaction data<br/>
                - Account authentication credentials</p>
                
                <h5>2. How We Use Your Information</h5>
                <p>We use your information to:</p>
                <p>- Provide and maintain the RestaurantOS service<br/>
                - Process payments and subscriptions<br/>
                - Send service-related notifications<br/>
                - Improve our platform and user experience</p>
                
                <h5>3. Data Security</h5>
                <p>We implement industry-standard security measures to protect your data. However, no transmission over the internet is 100% secure.</p>
                
                <h5>4. Third-Party Services</h5>
                <p>We use Firebase for authentication and database storage, and Cashfree/PayPal for payment processing. These services have their own privacy policies.</p>
                
                <h5>5. Data Retention</h5>
                <p>We retain your data as long as your account is active. You may request data deletion by contacting support.</p>
                
                <h5>6. Your Rights</h5>
                <p>You have the right to access, correct, or delete your personal information. Contact us at support@restaurantos.com for any requests.</p>
                
                <h5>7. Contact Us</h5>
                <p>For privacy concerns, contact: support@restaurantos.com or WhatsApp: +91 88000 00000</p>
            `
        },
        refund: {
            title: 'Refund Policy',
            icon: '💰',
            content: `
                <h4>Refund Policy - RestaurantOS</h4>
                <p><strong>Last Updated: 2024</strong></p>
                
                <h5>1. Subscription Refunds</h5>
                <p>RestaurantOS offers a 7-day money-back guarantee for new subscriptions. If you are not satisfied with our service, you may request a full refund within 7 days of your initial payment.</p>
                
                <h5>2. How to Request a Refund</h5>
                <p>To request a refund, contact our support team:</p>
                <p>- Email: support@restaurantos.com<br/>
                - WhatsApp: +91 88000 00000<br/>
                - Provide your order ID and reason for refund request</p>
                
                <h5>3. Refund Processing</h5>
                <p>- India (Cashfree): Refunds are processed to your original payment method within 5-7 business days<br/>
                - USA/UK (PayPal): Refunds are processed through your PayPal account within 2-3 business days</p>
                
                <h5>4. Non-Refundable Scenarios</h5>
                <p>- Refunds are not available after the 7-day period<br/>
                - Requests due to user error or misunderstanding<br/>
                - Requests for service beyond the refund period</p>
                
                <h5>5. Partial Refunds</h5>
                <p>If you cancel mid-month, no partial refunds are provided. Cancellation takes effect at the end of the billing period.</p>
                
                <h5>6. Questions About Refunds</h5>
                <p>For refund-related inquiries, contact our support team immediately with details of your payment and reason for the refund request.</p>
            `
        }
    };

    const policy = policyData[type] || policyData.terms;
    
    // Create modal HTML
    const modalHTML = `
        <div class="policy-modal-backdrop" onclick="closePolicyModal()">
            <div class="policy-modal" onclick="event.stopPropagation()">
                <div class="policy-modal-header">
                    <div class="modal-title-section">
                        <span class="modal-icon">${policy.icon}</span>
                        <h2 class="modal-title">${policy.title}</h2>
                    </div>
                    <button class="modal-close-btn" onclick="closePolicyModal()">✕</button>
                </div>
                <div class="policy-modal-body">
                    ${policy.content}
                </div>
                <div class="policy-modal-footer">
                    <button class="btn btn-secondary" onclick="closePolicyModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existingModal = document.getElementById('policy-modal-container');
    if (existingModal) existingModal.remove();
    
    // Create and insert modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'policy-modal-container';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
}

// Close policy modal
function closePolicyModal() {
    const modalContainer = document.getElementById('policy-modal-container');
    if (modalContainer) {
        modalContainer.remove();
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
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading reviews:', error);
        showNotification('Error loading reviews', 'error');
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
        const formatAdminRevenue = (typeof CurrencyManager !== 'undefined') ? CurrencyManager.formatPrice(totalRevenue) : CurrencyManager.formatPrice(CurrencyManager.convertPrice(totalRevenue.toFixed(0)));
        document.getElementById('total-revenue').textContent = formatAdminRevenue;
        
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
        // Page is visible - refresh data only if not already loaded in this session
        if (app.currentPage === 'dashboard' && !app.sessionLoaded.overview) {
            setupDashboardListener();
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
// ADMIN SUBSCRIPTION RENEWAL - Called from admin dashboard
// ============================================

window.adminRenewSubscription = async function(restaurantId, adminEmail) {
    try {
        console.log('[Admin Renewal] Starting admin renewal for restaurant:', restaurantId);
        
        if (!restaurantId) {
            showNotification('❌ Restaurant ID is required', 'error');
            return false;
        }
        
        showNotification('💳 Renewing subscription...', 'info');
        
        // Call admin renewal cloud function
        const adminRenewalUrl = 'https://us-central1-gurufinder-6fd24.cloudfunctions.net/adminRenewSubscription';
        
        const response = await fetch(adminRenewalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                restaurantId: restaurantId,
                adminEmail: adminEmail || 'admin'
            })
        });
        
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: response.statusText };
            }
            
            const errorMsg = errorData.error || `HTTP ${response.status}`;
            console.error('[Admin Renewal] Error:', errorMsg);
            showNotification('❌ ' + errorMsg, 'error');
            return false;
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('[Admin Renewal] Success:', data);
            showNotification('✅ Subscription renewed successfully for ' + (data.restaurantName || restaurantId), 'success');
            
            // Refresh admin data after short delay
            setTimeout(() => {
                if (typeof loadRestaurantsOverviewData === 'function') {
                    loadRestaurantsOverviewData();
                }
            }, 1000);
            
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Failed to renew subscription'), 'error');
            return false;
        }
        
    } catch (error) {
        console.error('[Admin Renewal] Unexpected error:', error);
        showNotification('❌ Error: ' + error.message, 'error');
        return false;
    }
};

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