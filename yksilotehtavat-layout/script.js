/**
 * KampusRuoka - main application logic
 */

const CONFIG = {
    API_BASE_URL: 'https://media2.edu.metropolia.fi/restaurant',
};

const AppState = {
    currentRestaurantId: null,
    currentView: 'daily',
    restaurants: [],
    userLocation: null,
    filters: {
        search: '',
        city: '',
        provider: '',
    },
    user: null,
};

const DOM = {
    restaurantList: document.getElementById('restaurantList'),
    menuContent: document.getElementById('menuContent'),
    restaurantTitle: document.getElementById('restaurantTitle'),
    searchInput: document.getElementById('searchRestaurants'),
    cityFilter: document.getElementById('cityFilter'),
    providerFilter: document.getElementById('providerFilter'),
    viewButtons: document.querySelectorAll('.view-btn'),
    loginBtn: document.getElementById('loginBtn'),
    headerNav: document.getElementById('headerNav'),
    authModal: document.getElementById('authModal'),
    authModalClose: document.getElementById('authModalClose'),
    profileModal: document.getElementById('profileModal'),
    profileModalClose: document.getElementById('profileModalClose'),
    favoritesModal: document.getElementById('favoritesModal'),
    favoritesModalClose: document.getElementById('favoritesModalClose'),
    modal: document.getElementById('modal'),
    modalClose: document.getElementById('modalClose'),
    errorNotification: document.getElementById('errorNotification'),
    successNotification: document.getElementById('successNotification'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    profileForm: document.getElementById('profileForm'),
    avatarUpload: document.getElementById('avatarUpload'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profilePhone: document.getElementById('profilePhone'),
    favoritesList: document.getElementById('favoritesList'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();
    AppState.user = AUTH.getCurrentUser();
    updateHeaderUI();
    await loadRestaurants();
    await updateDistancesFromGeolocation();
    populateFilters();
    renderRestaurantList(getFilteredRestaurants());
    loadMenu(AppState.currentRestaurantId);
    if (typeof initMap === 'function') {
        initMap();
    }
}

function setupEventListeners() {
    DOM.loginBtn?.addEventListener('click', openAuthModal);
    DOM.authModalClose?.addEventListener('click', closeAllModals);
    DOM.profileModalClose?.addEventListener('click', closeAllModals);
    DOM.favoritesModalClose?.addEventListener('click', closeAllModals);
    DOM.modalClose?.addEventListener('click', closeAllModals);

    DOM.loginForm?.addEventListener('submit', handleLogin);
    DOM.registerForm?.addEventListener('submit', handleRegister);
    DOM.profileForm?.addEventListener('submit', handleProfileUpdate);
    DOM.avatarUpload?.addEventListener('change', handleAvatarUpload);

    document.getElementById('switchToRegister')?.addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('switchToLogin')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    DOM.searchInput?.addEventListener('input', (event) => {
        AppState.filters.search = event.target.value.trim().toLowerCase();
        renderRestaurantList(getFilteredRestaurants());
    });

    DOM.cityFilter?.addEventListener('change', (event) => {
        AppState.filters.city = event.target.value;
        renderRestaurantList(getFilteredRestaurants());
    });

    DOM.providerFilter?.addEventListener('change', (event) => {
        AppState.filters.provider = event.target.value;
        renderRestaurantList(getFilteredRestaurants());
    });

    DOM.viewButtons.forEach((button) => {
        button.addEventListener('click', () => {
            AppState.currentView = button.dataset.view || 'daily';
            DOM.viewButtons.forEach((item) => {
                item.classList.toggle('view-btn--active', item === button);
                item.setAttribute('aria-pressed', String(item === button));
            });
            loadMenu(AppState.currentRestaurantId);
        });
    });

    DOM.restaurantList?.addEventListener('click', (event) => {
        const restaurantButton = event.target.closest('[data-restaurant-id]');
        if (restaurantButton) {
            event.preventDefault();
            toggleFavorite(restaurantButton.dataset.restaurantId);
            return;
        }

        const restaurantCard = event.target.closest('.restaurant-item');
        if (restaurantCard) {
            selectRestaurant(restaurantCard.dataset.id);
        }
    });
}

async function loadRestaurants() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/v1/restaurants?limit=100`);
        if (!response.ok) {
            throw new Error('Restaurant API error');
        }

        const restaurants = await response.json();
        AppState.restaurants = restaurants
            .map(mapRestaurant)
            .filter((restaurant) => restaurant.name);
    } catch (error) {
        console.warn('API failed, using fallback data', error);
        AppState.restaurants = createFallbackRestaurants();
    }
}

async function updateDistancesFromGeolocation() {
    if (!navigator.geolocation) {
        setFallbackDistances();
        return;
    }

    const position = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (result) => resolve(result),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 },
        );
    });

    if (!position) {
        setFallbackDistances();
        return;
    }

    AppState.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
    };

    AppState.restaurants = AppState.restaurants.map((restaurant) => ({
        ...restaurant,
        distance: getDistanceKm(AppState.userLocation, restaurant.coordinates),
    }));
}

function setFallbackDistances() {
    AppState.restaurants = AppState.restaurants.map((restaurant) => ({
        ...restaurant,
        distance: Number.isFinite(restaurant.distance) ? restaurant.distance : Math.random() * 15,
    }));
}

function getDistanceKm(userLocation, coordinates) {
    if (!userLocation || !coordinates || coordinates.length < 2) {
        return Number.POSITIVE_INFINITY;
    }

    const [lng, lat] = coordinates;
    const earthRadiusKm = 6371;
    const lat1 = toRadians(userLocation.lat);
    const lat2 = toRadians(lat);
    const deltaLat = toRadians(lat - userLocation.lat);
    const deltaLng = toRadians(lng - userLocation.lng);

    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((earthRadiusKm * c).toFixed(1));
}

function toRadians(value) {
    return value * (Math.PI / 180);
}

function mapRestaurant(item) {
    return {
        id: item._id || item.id || item.name,
        name: item.name || 'Tuntematon ravintola',
        city: item.city || 'N/A',
        provider: item.company || 'N/A',
        address: item.address || '',
        phone: item.phone || '',
        postalCode: item.postalCode || '',
        coordinates: item.location?.coordinates || [0, 0],
        rating: 4.5,
        distance: Number.isFinite(item.distance) ? item.distance : Math.random() * 15,
    };
}

function createFallbackRestaurants() {
    return [
        {
            id: 'mock-1',
            name: 'Ravintola Ilona',
            city: 'Ikaalinen',
            provider: 'Sodexo',
            address: 'Eino Salmelaisen katu 20',
            phone: '+358447554540',
            postalCode: '39500',
            coordinates: [23.0664, 61.764526],
            rating: 4.5,
            distance: 2.1,
        },
        {
            id: 'mock-2',
            name: 'A Bloc',
            city: 'Espoo',
            provider: 'Compass Group',
            address: 'Otaniementie 12',
            phone: '-',
            postalCode: '02150',
            coordinates: [24.8256169, 60.1846499],
            rating: 4.2,
            distance: 0.5,
        },
        {
            id: 'mock-3',
            name: 'Hanken',
            city: 'Helsinki',
            provider: 'Compass Group',
            address: 'Arkadiankatu 22',
            phone: '-',
            postalCode: '00100',
            coordinates: [24.9241528, 60.1711969],
            rating: 4.0,
            distance: 3.2,
        },
    ];
}

function populateFilters() {
    if (!DOM.cityFilter || !DOM.providerFilter) {
        return;
    }

    const currentCity = DOM.cityFilter.value;
    const currentProvider = DOM.providerFilter.value;

    DOM.cityFilter.innerHTML = '<option value="">Kaikki kaupungit</option>';
    DOM.providerFilter.innerHTML = '<option value="">Kaikki palveluntarjoajat</option>';

    [...new Set(AppState.restaurants.map((restaurant) => restaurant.city).filter(Boolean))]
        .sort()
        .forEach((city) => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            DOM.cityFilter.appendChild(option);
        });

    [...new Set(AppState.restaurants.map((restaurant) => restaurant.provider).filter(Boolean))]
        .sort()
        .forEach((provider) => {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = provider;
            DOM.providerFilter.appendChild(option);
        });

    DOM.cityFilter.value = currentCity || '';
    DOM.providerFilter.value = currentProvider || '';
}

function getFilteredRestaurants() {
    return AppState.restaurants.filter((restaurant) => {
        const matchesSearch = !AppState.filters.search
            || restaurant.name.toLowerCase().includes(AppState.filters.search)
            || restaurant.city.toLowerCase().includes(AppState.filters.search);
        const matchesCity = !AppState.filters.city || restaurant.city === AppState.filters.city;
        const matchesProvider = !AppState.filters.provider || restaurant.provider === AppState.filters.provider;
        return matchesSearch && matchesCity && matchesProvider;
    });
}

function getClosestRestaurantId(restaurants) {
    if (!restaurants.length) {
        return null;
    }

    return restaurants.reduce((closest, current) => {
        if (!closest) {
            return current;
        }
        return current.distance < closest.distance ? current : closest;
    }, null).id;
}

function renderRestaurantList(restaurants) {
    if (!DOM.restaurantList) {
        return;
    }

    if (!restaurants.length) {
        DOM.restaurantList.innerHTML = '<div class="empty-state">Ei ravintoloita</div>';
        return;
    }

    const closestId = getClosestRestaurantId(restaurants);
    const favoritesEnabled = AUTH.isLoggedIn();

    DOM.restaurantList.innerHTML = restaurants.map((restaurant) => {
        const isFavorite = favoritesEnabled && AUTH.isFavorite(restaurant.id);
        const isSelected = restaurant.id === AppState.currentRestaurantId;
        const isClosest = restaurant.id === closestId;

        return `
            <article class="restaurant-item ${isSelected ? 'restaurant-item--active' : ''} ${isClosest ? 'restaurant-item--closest' : ''}" data-id="${restaurant.id}">
                <div class="restaurant-header">
                    <h3 class="restaurant-name">${restaurant.name}</h3>
                    <button type="button" class="favorite-btn ${isFavorite ? 'favorite-btn--active' : ''}" data-restaurant-id="${restaurant.id}" aria-label="Suosikki">
                        ${isFavorite ? '❤️' : '🤍'}
                    </button>
                </div>
                ${isClosest ? '<span class="closest-badge">Lahin</span>' : ''}
                <p>📍 ${restaurant.city}</p>
                <p>${restaurant.provider}</p>
                <p>⭐ ${restaurant.rating.toFixed(1)} • 📏 ${restaurant.distance.toFixed(1)} km</p>
            </article>
        `;
    }).join('');
}

function selectRestaurant(id) {
    const restaurant = AppState.restaurants.find((item) => item.id === id);
    if (!restaurant) {
        return;
    }

    AppState.currentRestaurantId = id;
    if (DOM.restaurantTitle) {
        DOM.restaurantTitle.textContent = restaurant.name;
    }

    renderRestaurantList(getFilteredRestaurants());
    loadMenu(AppState.currentView, restaurant);

    if (typeof highlightOnMap === 'function') {
        highlightOnMap(id);
    }
}

function loadMenu(view, restaurant = null) {
    if (!DOM.menuContent) {
        return;
    }

    const menus = {
        daily: [
            { name: 'Broilerin pihvi', description: 'Paistettu broilerin pihvi ranskalaisten kera', diets: ['Gluteeniton'], price: '5.20 €' },
            { name: 'Kasvisruoka', description: 'Kasvisateria', diets: ['Vegaaninen'], price: '4.80 €' },
        ],
        weekly: [
            { day: 'Maanantai', meals: ['Lihapullat', 'Kasvis'] },
            { day: 'Tiistai', meals: ['Kana', 'Porkkana'] },
        ],
    };

    const menuItems = menus[view] || menus.daily;
    const title = restaurant ? restaurant.name : 'Valitse ravintola';

    DOM.menuContent.innerHTML = `
        <div class="empty-state">
            <p>${restaurant ? `Ruokalista ravintolalle ${title}` : 'Valitse ravintola nähdäksesi ruokalistan'}</p>
        </div>
        <div class="menu-grid">
            ${menuItems.map((item) => {
                if (item.day) {
                    return `
                        <article class="menu-card week-menu-card">
                            <h3>${item.day}</h3>
                            <ul>
                                ${item.meals.map((meal) => `<li>${meal}</li>`).join('')}
                            </ul>
                        </article>
                    `;
                }

                return `
                    <article class="menu-card">
                        <h3>${item.name}</h3>
                        <p class="description">${item.description}</p>
                        <div class="diets">
                            ${item.diets.map((diet) => `<span class="diet-tag">${diet}</span>`).join('')}
                        </div>
                        <p class="menu-price">${item.price}</p>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function openAuthModal() {
    closeAllModals();
    DOM.authModal?.removeAttribute('hidden');
    switchAuthTab('login');
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    loginTab?.classList.toggle('auth-tab--active', tab === 'login');
    registerTab?.classList.toggle('auth-tab--active', tab === 'register');
}

function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';

    const result = AUTH.login(email, password);
    if (!result.success) {
        showError(result.message || 'Kirjautuminen epäonnistui');
        return;
    }

    AppState.user = AUTH.getCurrentUser();
    updateHeaderUI();
    closeAllModals();
    showSuccess('Kirjautuminen onnistui');
}

function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('registerName')?.value.trim() || '';
    const email = document.getElementById('registerEmail')?.value.trim() || '';
    const password = document.getElementById('registerPassword')?.value || '';
    const password2 = document.getElementById('registerPassword2')?.value || '';

    if (password !== password2) {
        showError('Salasanat eivät täsmää');
        return;
    }

    const result = AUTH.register(name, email, password);
    if (!result.success) {
        showError(result.message || 'Rekisteröinti epäonnistui');
        return;
    }

    AppState.user = AUTH.getCurrentUser();
    updateHeaderUI();
    closeAllModals();
    showSuccess('Rekisteröinti onnistui');
}

function handleLogout() {
    AUTH.logout();
    AppState.user = null;
    updateHeaderUI();
    closeAllModals();
    renderRestaurantList(getFilteredRestaurants());
    showSuccess('Kirjauduttu ulos');
}

function handleProfileUpdate(event) {
    event.preventDefault();
    const updates = {
        name: DOM.profileName?.value.trim() || '',
        phone: DOM.profilePhone?.value.trim() || '',
    };

    const result = AUTH.updateProfile(updates);
    if (!result.success) {
        showError(result.message || 'Profiilin tallennus epäonnistui');
        return;
    }

    AppState.user = AUTH.getCurrentUser();
    updateHeaderUI();
    closeAllModals();
    showSuccess('Profiili päivitetty');
}

function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        if (DOM.profileAvatar) {
            DOM.profileAvatar.src = String(reader.result);
        }
        AUTH.updateProfile({ avatar: String(reader.result) });
        AppState.user = AUTH.getCurrentUser();
    };
    reader.readAsDataURL(file);
}

function openProfileModal() {
    if (!AUTH.isLoggedIn()) {
        showError('Kirjaudu ensin sisään');
        return;
    }

    closeAllModals();
    const user = AUTH.getCurrentUser();
    if (DOM.profileName) DOM.profileName.value = user?.name || '';
    if (DOM.profileEmail) DOM.profileEmail.value = user?.email || '';
    if (DOM.profilePhone) DOM.profilePhone.value = user?.phone || '';
    if (DOM.profileAvatar) DOM.profileAvatar.src = user?.avatar || DOM.profileAvatar.src;
    DOM.profileModal?.removeAttribute('hidden');
}

function openFavoritesModal() {
    if (!AUTH.isLoggedIn()) {
        showError('Kirjaudu ensin sisään');
        return;
    }

    closeAllModals();
    renderFavoritesList();
    DOM.favoritesModal?.removeAttribute('hidden');
}

function renderFavoritesList() {
    if (!DOM.favoritesList) {
        return;
    }

    const user = AUTH.getCurrentUser();
    const favoriteRestaurants = AppState.restaurants.filter((restaurant) => user?.favorites?.includes(restaurant.id));

    if (!favoriteRestaurants.length) {
        DOM.favoritesList.innerHTML = '<p class="empty-state">Ei vielä suosikkiravintoloita.</p>';
        return;
    }

    DOM.favoritesList.innerHTML = favoriteRestaurants.map((restaurant) => `
        <article class="favorite-item">
            <div>
                <h3>${restaurant.name}</h3>
                <p>${restaurant.city} • ${restaurant.provider}</p>
            </div>
            <button type="button" class="btn btn--secondary" data-restaurant-id="${restaurant.id}">Poista</button>
        </article>
    `).join('');

    DOM.favoritesList.querySelectorAll('[data-restaurant-id]').forEach((button) => {
        button.addEventListener('click', () => {
            toggleFavorite(button.dataset.restaurantId);
            renderFavoritesList();
        });
    });
}

function toggleFavorite(id) {
    if (!AUTH.isLoggedIn()) {
        showError('Kirjaudu ensin sisään');
        return;
    }

    if (AUTH.isFavorite(id)) {
        AUTH.removeFavorite(id);
    } else {
        AUTH.addFavorite(id);
    }

    AppState.user = AUTH.getCurrentUser();
    updateHeaderUI();
    renderRestaurantList(getFilteredRestaurants());
    if (typeof refreshMap === 'function') {
        refreshMap();
    }
}

function updateHeaderUI() {
    if (!DOM.headerNav) {
        return;
    }

    const user = AUTH.getCurrentUser();
    if (!user) {
        DOM.headerNav.innerHTML = '<button id="loginBtn" class="btn btn--header">Kirjaudu</button>';
        DOM.loginBtn = document.getElementById('loginBtn');
        DOM.loginBtn?.addEventListener('click', openAuthModal);
        return;
    }

    DOM.headerNav.innerHTML = `
        <button type="button" class="btn btn--header" id="favoritesBtn">Suosikit</button>
        <button type="button" class="btn btn--header" id="profileBtn">${user.name}</button>
    `;

    document.getElementById('favoritesBtn')?.addEventListener('click', openFavoritesModal);
    document.getElementById('profileBtn')?.addEventListener('click', openProfileModal);
}

function closeAllModals() {
    DOM.authModal?.setAttribute('hidden', 'true');
    DOM.profileModal?.setAttribute('hidden', 'true');
    DOM.favoritesModal?.setAttribute('hidden', 'true');
    DOM.modal?.setAttribute('hidden', 'true');
}

function showError(message) {
    if (!DOM.errorNotification) {
        return;
    }
    DOM.errorNotification.textContent = message;
    DOM.errorNotification.removeAttribute('hidden');
    window.setTimeout(() => DOM.errorNotification.setAttribute('hidden', 'true'), 4000);
}

function showSuccess(message) {
    if (!DOM.successNotification) {
        return;
    }
    DOM.successNotification.textContent = message;
    DOM.successNotification.removeAttribute('hidden');
    window.setTimeout(() => DOM.successNotification.setAttribute('hidden', 'true'), 4000);
}

window.toggleFavorite = toggleFavorite;
