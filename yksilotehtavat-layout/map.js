let selectedRestaurantId = null;

function initMap() {
    renderVanillaMap();
}

function refreshMap() {
    renderVanillaMap();
}

function highlightOnMap(restaurantId) {
    selectedRestaurantId = restaurantId;
    renderVanillaMap();

    const marker = document.querySelector(`.map-point[data-id="${restaurantId}"]`);
    marker?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function renderVanillaMap() {
    const container = document.getElementById('restaurantMap');
    if (!container) {
        return;
    }

    const restaurants = (AppState?.restaurants || []).filter((restaurant) => {
        const coords = restaurant.coordinates;
        return Array.isArray(coords)
            && coords.length === 2
            && Number.isFinite(coords[0])
            && Number.isFinite(coords[1])
            && !(coords[0] === 0 && coords[1] === 0);
    });

    if (!restaurants.length) {
        container.innerHTML = '<p class="map-empty">Karttadataa ei ole saatavilla.</p>';
        return;
    }

    const bounds = getBounds(restaurants);
    const closestId = getClosestRestaurantId(restaurants);

    const pointsMarkup = restaurants.map((restaurant) => {
        const pos = normalizeCoordinates(restaurant.coordinates, bounds);
        const isClosest = restaurant.id === closestId;
        const isSelected = restaurant.id === selectedRestaurantId;

        return `
            <button
                type="button"
                class="map-point ${isClosest ? 'map-point--closest' : ''} ${isSelected ? 'map-point--selected' : ''}"
                data-id="${restaurant.id}"
                style="left:${pos.x}%; top:${pos.y}%;"
                title="${restaurant.name} (${restaurant.city})"
                aria-label="${restaurant.name}, ${restaurant.city}"
            ></button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="map-canvas">
            <div class="map-grid"></div>
            ${pointsMarkup}
            <div class="map-legend">Lähin ravintola = vihreä piste</div>
        </div>
    `;

    container.querySelectorAll('.map-point').forEach((point) => {
        point.addEventListener('click', () => {
            const id = point.dataset.id;
            selectedRestaurantId = id;
            if (typeof selectRestaurant === 'function') {
                selectRestaurant(id);
            }
        });
    });
}

function getBounds(restaurants) {
    const latitudes = restaurants.map((r) => r.coordinates[1]);
    const longitudes = restaurants.map((r) => r.coordinates[0]);

    return {
        minLat: Math.min(...latitudes),
        maxLat: Math.max(...latitudes),
        minLng: Math.min(...longitudes),
        maxLng: Math.max(...longitudes),
    };
}

function normalizeCoordinates(coordinates, bounds) {
    const [lng, lat] = coordinates;
    const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);

    const x = ((lng - bounds.minLng) / lngSpan) * 100;
    const y = 100 - ((lat - bounds.minLat) / latSpan) * 100;

    return {
        x: clamp(x, 4, 96),
        y: clamp(y, 6, 94),
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getClosestRestaurantId(restaurants) {
    return restaurants.reduce((closest, current) => {
        if (!closest || current.distance < closest.distance) {
            return current;
        }
        return closest;
    }, null)?.id || null;
}
