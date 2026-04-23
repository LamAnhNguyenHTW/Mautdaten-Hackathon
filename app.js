/* ============================================
   EcoToll - Intelligente Mautrouten
   Application Logic
   ============================================ */

// ---- City Coordinates ----
const CITIES = {
    'muenchen': { lat: 48.1351, lng: 11.5820, name: 'München' },
    'berlin': { lat: 52.5200, lng: 13.4050, name: 'Berlin' },
    'hamburg': { lat: 53.5511, lng: 9.9937, name: 'Hamburg' },
    'frankfurt': { lat: 50.1109, lng: 8.6821, name: 'Frankfurt am Main' },
    'koeln': { lat: 50.9375, lng: 6.9603, name: 'Köln' },
    'duesseldorf': { lat: 51.2277, lng: 6.7735, name: 'Düsseldorf' },
    'stuttgart': { lat: 48.7758, lng: 9.1829, name: 'Stuttgart' },
    'dortmund': { lat: 51.5136, lng: 7.4653, name: 'Dortmund' },
    'nuernberg': { lat: 49.4521, lng: 11.0767, name: 'Nürnberg' },
    'leipzig': { lat: 51.3397, lng: 12.3731, name: 'Leipzig' },
    'hannover': { lat: 52.3759, lng: 9.7320, name: 'Hannover' },
    'dresden': { lat: 51.0504, lng: 13.7373, name: 'Dresden' },
    'bremen': { lat: 53.0793, lng: 8.8017, name: 'Bremen' },
    'essen': { lat: 51.4556, lng: 7.0116, name: 'Essen' },
    'kassel': { lat: 51.3127, lng: 9.4797, name: 'Kassel' },
    'wuerzburg': { lat: 49.7913, lng: 9.9534, name: 'Würzburg' },
    'erfurt': { lat: 50.9787, lng: 11.0328, name: 'Erfurt' },
    'magdeburg': { lat: 52.1205, lng: 11.6276, name: 'Magdeburg' },
    'regensburg': { lat: 49.0134, lng: 12.1016, name: 'Regensburg' },
    'ingolstadt': { lat: 48.7665, lng: 11.4258, name: 'Ingolstadt' },
    'augsburg': { lat: 48.3705, lng: 10.8978, name: 'Augsburg' },
    'rostock': { lat: 54.0924, lng: 12.0991, name: 'Rostock' },
    'halle': { lat: 51.4828, lng: 11.9700, name: 'Halle' },
    'bayreuth': { lat: 49.9427, lng: 11.5783, name: 'Bayreuth' },
    'potsdam': { lat: 52.3906, lng: 13.0645, name: 'Potsdam' },
};

// ---- Route Templates ----
// Routes are generated dynamically based on origin/destination
function makeCityLookupKeys(input) {
    const clean = String(input || '').trim().toLowerCase();
    if (!clean) return [];

    const plain = clean
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00df/g, 'ss')
        .replace(/\u00c3\u009f/g, 'ss');

    const germanDigraph = clean
        .replace(/\u00e4/g, 'ae')
        .replace(/\u00f6/g, 'oe')
        .replace(/\u00fc/g, 'ue')
        .replace(/\u00df/g, 'ss');

    // Defensive compatibility for legacy mojibake inputs.
    const mojibakeDigraph = clean
        .replace(/\u00c3\u00a4/g, 'ae')
        .replace(/\u00c3\u00b6/g, 'oe')
        .replace(/\u00c3\u00bc/g, 'ue')
        .replace(/\u00c3\u009f/g, 'ss');

    return [...new Set([clean, plain, germanDigraph, mojibakeDigraph])];
}

const CITY_LOOKUP = (() => {
    const index = {};
    Object.entries(CITIES).forEach(([rawKey, city]) => {
        const fixedName = city.name || '';
        const normalizedKey = makeCityLookupKeys(rawKey)[0] || rawKey;
        const canonical = { ...city, name: fixedName };
        const candidates = [rawKey, normalizedKey, fixedName];
        candidates.forEach(candidate => {
            makeCityLookupKeys(candidate).forEach(key => {
                index[key] = canonical;
            });
        });
    });
    return index;
})();

function resolveCity(input) {
    const keys = makeCityLookupKeys(input);
    for (const key of keys) {
        if (CITY_LOOKUP[key]) return CITY_LOOKUP[key];
    }
    return null;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getRouteColorByEcoClass(ecoClass) {
    if (ecoClass === 'eco-high') return '#22c55e';
    if (ecoClass === 'eco-mid') return '#facc15';
    return '#ef4444';
}

function applyRouteVisuals(routes) {
    routes.forEach(route => {
        route.color = getRouteColorByEcoClass(route.ecoClass);
    });
}

function generateRoutes(origin, destination, date, time) {
    const originCity = typeof origin === 'string' ? resolveCity(origin) : origin;
    const destCity = typeof destination === 'string' ? resolveCity(destination) : destination;

    if (!originCity || !destCity) return null;

    const dist = haversineDistance(originCity.lat, originCity.lng, destCity.lat, destCity.lng);
    const hour = parseInt(time.split(':')[0], 10);
    const isRushHour = (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19);
    // Generate 3 route variants
    const routes = [
        {
            id: 1,
            name: `Eco-Route über Landstraßen`,
            badge: 'Ausgewogen',
            badgeClass: 'balanced',
            distance: Math.round(dist * 1.15),
            duration: Math.round((dist * 1.15) / 75 * 60),
            ecoScore: randomBetween(68, 82),
            ecoClass: 'eco-mid',
            baseToll: dist * 0.187,
            tollDiscount: randomBetween(22, 34),
            criteria: {
                traffic: { value: isRushHour ? 'Mittel' : 'Gering', score: isRushHour ? 65 : 90, class: isRushHour ? 'moderate' : 'good' },
                noise: { value: 'Gering', score: 88, class: 'good' },
                air: { value: 'Sehr gut', score: 92, class: 'good' },
                accidents: { value: 'Niedrig', score: 85, class: 'good' },
                construction: { value: randomChoice(['Keine', '1 Baustelle']), score: randomBetween(75, 95), class: 'good' },
                bridges: { value: randomChoice(['2 Brücken', '1 Brücke']), score: 80, class: 'good' },
                rest: { value: `${randomBetween(3, 6)} Anlagen`, score: 85, class: 'good' },
            },
            waypoints: generateWaypoints(originCity, destCity, 'eco'),
            color: getRouteColorByEcoClass('eco-mid'),
            steps: [
                { type: 'start', icon: 'ph-map-pin', title: originCity.name, desc: 'Startpunkt' },
                { type: 'highway', icon: 'ph-road-horizon', title: 'Landstraße / Bundesstraße', desc: `${Math.round(dist * 0.4)} km - Geringe Verkehrsdichte` },
                { type: 'rest', icon: 'ph-coffee', title: 'Rastanlage empfohlen', desc: 'Nach ~120 km - Ladestation vorhanden' },
                { type: 'highway', icon: 'ph-road-horizon', title: 'Autobahn (kurzer Abschnitt)', desc: `${Math.round(dist * 0.3)} km - Wenig Lärmbelastung` },
                { type: 'end', icon: 'ph-flag-checkered', title: destCity.name, desc: 'Zielort' },
            ],
        },
        {
            id: 2,
            name: `Schnellroute über Autobahn`,
            badge: 'Schnellste',
            badgeClass: 'fastest',
            distance: Math.round(dist * 1.02),
            duration: Math.round((dist * 1.02) / 95 * 60),
            ecoScore: randomBetween(35, 52),
            ecoClass: 'eco-low',
            baseToll: dist * 0.187,
            tollDiscount: randomBetween(-6, 4),
            criteria: {
                traffic: { value: isRushHour ? 'Hoch' : 'Mittel', score: isRushHour ? 35 : 55, class: isRushHour ? 'bad' : 'moderate' },
                noise: { value: 'Hoch', score: 35, class: 'bad' },
                air: { value: 'Mittel', score: 50, class: 'moderate' },
                accidents: { value: 'Mittel', score: 55, class: 'moderate' },
                construction: { value: `${randomBetween(2, 4)} Baustellen`, score: randomBetween(30, 50), class: 'bad' },
                bridges: { value: `${randomBetween(4, 7)} Brücken`, score: 60, class: 'moderate' },
                rest: { value: `${randomBetween(5, 8)} Anlagen`, score: 90, class: 'good' },
            },
            waypoints: generateWaypoints(originCity, destCity, 'fast'),
            color: getRouteColorByEcoClass('eco-low'),
            steps: [
                { type: 'start', icon: 'ph-map-pin', title: originCity.name, desc: 'Startpunkt' },
                { type: 'highway', icon: 'ph-road-horizon', title: 'Autobahn (Hauptstrecke)', desc: `${Math.round(dist * 0.8)} km - Hohes Verkehrsaufkommen` },
                { type: 'rest', icon: 'ph-coffee', title: 'Raststätte', desc: 'Großer Autohof verfügbar' },
                { type: 'highway', icon: 'ph-road-horizon', title: 'Autobahn (Zielabschnitt)', desc: `${Math.round(dist * 0.2)} km - ${randomBetween(2, 3)} Baustellen` },
                { type: 'end', icon: 'ph-flag-checkered', title: destCity.name, desc: 'Zielort' },
            ],
        },
        {
            id: 3,
            name: `Alternativroute`,
            badge: 'Empfohlen',
            badgeClass: 'recommended',
            distance: Math.round(dist * 1.25),
            duration: Math.round((dist * 1.25) / 70 * 60),
            ecoScore: randomBetween(86, 96),
            ecoClass: 'eco-high',
            baseToll: dist * 0.187,
            tollDiscount: randomBetween(20, 35),
            criteria: {
                traffic: { value: 'Gering', score: 85, class: 'good' },
                noise: { value: 'Gering', score: 82, class: 'good' },
                air: { value: 'Gut', score: 78, class: 'good' },
                accidents: { value: 'Niedrig', score: 90, class: 'good' },
                construction: { value: randomChoice(['Keine', '1 Baustelle']), score: randomBetween(70, 90), class: 'good' },
                bridges: { value: randomChoice(['3 Brücken', '2 Brücken']), score: 70, class: 'moderate' },
                rest: { value: `${randomBetween(2, 4)} Anlagen`, score: 65, class: 'moderate' },
            },
            waypoints: generateWaypoints(originCity, destCity, 'alt'),
            color: getRouteColorByEcoClass('eco-high'),
            steps: [
                { type: 'start', icon: 'ph-map-pin', title: originCity.name, desc: 'Startpunkt' },
                { type: 'highway', icon: 'ph-road-horizon', title: 'Bundesstraße', desc: `${Math.round(dist * 0.5)} km - Landschaftlich reizvoll` },
                { type: 'rest', icon: 'ph-coffee', title: 'Kleine Rastanlage', desc: 'Regionaler Rastplatz' },
                { type: 'highway', icon: 'ph-road-horizon', title: 'Bundesstraße / Kreisstraße', desc: `${Math.round(dist * 0.5)} km - Wenig Durchgangsverkehr` },
                { type: 'end', icon: 'ph-flag-checkered', title: destCity.name, desc: 'Zielort' },
            ],
        },
    ];

    recalculateRoutePricing(routes, date, time);
    applyRouteVisuals(routes);

    return routes;
}

// ---- Waypoint Generation ----
function generateWaypoints(origin, dest, type) {
    const points = [];
    const steps = type === 'eco' ? 8 : type === 'fast' ? 6 : 10;
    const baseDistance = haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
    const curveStrength = clamp(baseDistance / 2200, 0.025, 0.09);

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let lat = origin.lat + (dest.lat - origin.lat) * t;
        let lng = origin.lng + (dest.lng - origin.lng) * t;

        // Keep fallback routes close to realistic road corridors.
        if (i > 0 && i < steps) {
            const offset = type === 'eco' ? curveStrength : type === 'fast' ? -curveStrength * 0.5 : curveStrength * 1.2;
            const curve = Math.sin(t * Math.PI) * offset;
            lat += curve * (type === 'alt' ? -0.18 : 0.14);
            lng += curve * (type === 'eco' ? 0.22 : type === 'alt' ? -0.26 : 0.08);
        }

        points.push([lat, lng]);
    }
    return points;
}

// ---- Utility Functions ----
function getStandardBaseToll(routes) {
    const vehicleProfile = VEHICLE_TOLL_MODEL[selectedVehicleType] || VEHICLE_TOLL_MODEL.lkw;

    const referenceRoute = routes.find(route => route.id === 2) || routes[0];
    const routeDistanceKm = Number(referenceRoute?.distance || 0);

    // Falls Distanz fehlt, nutze baseToll als Notanker.
    const fallbackDistanceKm = Number.isFinite(routeDistanceKm) && routeDistanceKm > 0
        ? routeDistanceKm
        : Number((referenceRoute?.baseToll || 0) / 0.187);

    const distanceKm = Number.isFinite(fallbackDistanceKm) && fallbackDistanceKm > 0
        ? fallbackDistanceKm
        : 0;

    const standard = vehicleProfile.base + distanceKm * vehicleProfile.perKm;
    return Number(standard.toFixed(2));
}

function getRouteDiscountByContext(route, density, hour, dayType) {
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
    const isLateNight = hour >= 0 && hour <= 4;
    const isNight = hour >= 22 || hour <= 4;
    const isWeekend = dayType === 'saturday' || dayType === 'sunday';

    // Base profile by route: fastest stays expensive, alternatives cheaper.
    const baseByRoute = route.id === 2 ? -14 : (route.id === 1 ? 20 : 26);

    // Density-sensitive adjustment (more granular to avoid identical slot prices).
    let densityAdj = 0;
    if (density < 12) densityAdj = 7;
    else if (density < 20) densityAdj = 5;
    else if (density < 28) densityAdj = 3;
    else if (density < 40) densityAdj = 1;
    else if (density < 55) densityAdj = -2;
    else if (density < 70) densityAdj = -5;
    else if (density < 85) densityAdj = -9;
    else densityAdj = -13;

    // Time-sensitive adjustment.
    let timeAdj = 0;
    if (isPeak) timeAdj -= 5;
    if (isLateNight) timeAdj += 5;
    else if (isNight) timeAdj += 2;
    else if (hour >= 11 && hour <= 14) timeAdj += 1;
    if (isWeekend) timeAdj += 1;

    let discount = Math.round(baseByRoute + densityAdj + timeAdj);

    // Guardrails per route class.
    if (route.id === 2) {
        discount = clamp(discount, -30, -4); // fastest always surcharge
    } else if (route.id === 1) {
        discount = clamp(discount, 10, 34);
    } else {
        discount = clamp(discount, 14, 40);
    }

    return discount;
}

function getRouteSlotPricing(route, density, hour, dayType, standardBaseToll = null) {
    const base = standardBaseToll == null ? Number(route.baseToll || 0) : Number(standardBaseToll);
    const standardToll = base;
    const tollDiscount = getRouteDiscountByContext(route, density, hour, dayType);
    const adjustedToll = standardToll * (1 - tollDiscount / 100);
    const delta = standardToll - adjustedToll;

    return {
        standardToll: Number(standardToll.toFixed(2)),
        adjustedToll: Number(adjustedToll.toFixed(2)),
        tollDiscount,
        savings: Number(Math.max(0, delta).toFixed(2)),
        extraCost: Number(Math.max(0, -delta).toFixed(2)),
    };
}

function recalculateRoutePricing(routes, date, time) {
    const hour = parseInt(time.split(':')[0], 10);
    const dayType = getDayType(date);
    const density = TRAFFIC_PROFILES[dayType][hour];
    const standardBaseToll = getStandardBaseToll(routes);

    routes.forEach(route => {
        const pricing = getRouteSlotPricing(route, density, hour, dayType, standardBaseToll);
        route.standardBaseToll = standardBaseToll.toFixed(2);
        route.tollDiscount = pricing.tollDiscount;
        route.originalToll = pricing.standardToll.toFixed(2);
        route.adjustedToll = pricing.adjustedToll.toFixed(2);
        route.savings = pricing.savings.toFixed(2);
        route.extraCost = pricing.extraCost.toFixed(2);
    });
}

function assignRoadVariants(roadVariants) {
    const sortedByDuration = [...roadVariants].sort((a, b) => a.durationMin - b.durationMin);
    if (sortedByDuration.length === 0) {
        return { 1: null, 2: null, 3: null };
    }
    if (sortedByDuration.length === 1) {
        return { 1: null, 2: sortedByDuration[0], 3: null };
    }
    if (sortedByDuration.length === 2) {
        return { 1: sortedByDuration[1], 2: sortedByDuration[0], 3: sortedByDuration[1] };
    }

    const fastest = sortedByDuration[0];
    const alternatives = sortedByDuration.slice(1);

    // Route 3 ("Empfohlen") should clearly differ from the fastest route:
    // pick the slowest non-fastest corridor.
    const recommended = alternatives[alternatives.length - 1] || fastest;

    // Route 1 ("Ausgewogen") gets a middle alternative corridor.
    let balanced = alternatives[Math.floor((alternatives.length - 1) / 2)] || alternatives[0] || fastest;
    if (balanced === recommended) {
        balanced = alternatives[0] || fastest;
    }
    if (balanced === recommended && alternatives.length > 1) {
        balanced = alternatives[alternatives.length - 2];
    }

    return { 1: balanced, 2: fastest, 3: recommended };
}

function buildRouteVariantSignature(variant) {
    if (!variant || !Array.isArray(variant.waypoints) || variant.waypoints.length === 0) return '';
    const step = Math.max(1, Math.floor(variant.waypoints.length / 24));
    const sampled = [];
    for (let i = 0; i < variant.waypoints.length; i += step) {
        const [lat, lng] = variant.waypoints[i];
        sampled.push(`${lat.toFixed(4)},${lng.toFixed(4)}`);
    }
    const [lastLat, lastLng] = variant.waypoints[variant.waypoints.length - 1];
    sampled.push(`${lastLat.toFixed(4)},${lastLng.toFixed(4)}`);
    return sampled.join('|');
}

function createDistinctAlternativeVariant(baseVariant, index = 1) {
    if (!baseVariant || !Array.isArray(baseVariant.waypoints) || baseVariant.waypoints.length < 3) return baseVariant;

    const sign = index % 2 === 0 ? 1 : -1;
    const latValues = baseVariant.waypoints.map(([lat]) => lat);
    const lngValues = baseVariant.waypoints.map(([, lng]) => lng);
    const latSpan = Math.max(...latValues) - Math.min(...latValues);
    const lngSpan = Math.max(...lngValues) - Math.min(...lngValues);
    const corridorWidth = clamp(Math.max(latSpan, lngSpan) * 0.06, 0.004, 0.02);

    const waypoints = baseVariant.waypoints.map(([lat, lng], pointIndex, points) => {
        const edge = pointIndex === 0 || pointIndex === points.length - 1;
        if (edge) return [lat, lng];
        const progress = pointIndex / (points.length - 1);
        const wave = Math.sin(progress * Math.PI);
        const drift = corridorWidth * wave * (1 + index * 0.25);
        return [lat + sign * drift * 0.42, lng - sign * drift * 0.62];
    });

    return {
        distanceKm: Number((baseVariant.distanceKm * (1 + index * 0.035)).toFixed(2)),
        durationMin: Number((baseVariant.durationMin * (1 + index * 0.05)).toFixed(2)),
        waypoints,
    };
}

function ensureDistinctRouteAssignments(variantsByRouteId) {
    const fastest = variantsByRouteId[2];
    let recommended = variantsByRouteId[3];
    let balanced = variantsByRouteId[1];

    if (!fastest) return variantsByRouteId;

    if (!recommended) {
        recommended = createDistinctAlternativeVariant(fastest, 2);
    }

    const fastestSig = buildRouteVariantSignature(fastest);
    let recommendedSig = buildRouteVariantSignature(recommended);
    if (fastestSig && recommendedSig && fastestSig === recommendedSig) {
        recommended = createDistinctAlternativeVariant(fastest, 2);
        recommendedSig = buildRouteVariantSignature(recommended);
    }

    if (!balanced) {
        balanced = createDistinctAlternativeVariant(fastest, 1);
    }

    const balancedSig = buildRouteVariantSignature(balanced);
    if (balancedSig && recommendedSig && balancedSig === recommendedSig) {
        balanced = createDistinctAlternativeVariant(recommended, 1);
    }

    return { 1: balanced, 2: fastest, 3: recommended };
}

async function fetchRoadRouteVariants(originCity, destCity) {
    const buildVariantSignature = variant => {
        if (!variant || !Array.isArray(variant.waypoints) || variant.waypoints.length === 0) return '';
        const step = Math.max(1, Math.floor(variant.waypoints.length / 20));
        const sampled = [];
        for (let i = 0; i < variant.waypoints.length; i += step) {
            const [lat, lng] = variant.waypoints[i];
            sampled.push(`${lat.toFixed(3)},${lng.toFixed(3)}`);
        }
        const [lastLat, lastLng] = variant.waypoints[variant.waypoints.length - 1];
        sampled.push(`${lastLat.toFixed(3)},${lastLng.toFixed(3)}`);
        return sampled.join('|');
    };

    const cloneVariant = variant => ({
        distanceKm: Number(variant.distanceKm),
        durationMin: Number(variant.durationMin),
        waypoints: variant.waypoints.map(([lat, lng]) => [lat, lng]),
    });

    const createSyntheticVariant = (baseVariant, index) => {
        const sign = index % 2 === 0 ? 1 : -1;
        const latValues = baseVariant.waypoints.map(([lat]) => lat);
        const lngValues = baseVariant.waypoints.map(([, lng]) => lng);
        const latSpan = Math.max(...latValues) - Math.min(...latValues);
        const lngSpan = Math.max(...lngValues) - Math.min(...lngValues);
        const corridorWidth = clamp(Math.max(latSpan, lngSpan) * 0.05, 0.0035, 0.015);

        const waypoints = baseVariant.waypoints.map(([lat, lng], pointIndex, points) => {
            const edge = pointIndex === 0 || pointIndex === points.length - 1;
            if (edge) return [lat, lng];
            const progress = pointIndex / (points.length - 1);
            const wave = Math.sin(progress * Math.PI);
            const drift = corridorWidth * wave * (1 + index * 0.2);
            return [lat + sign * drift * 0.45, lng - sign * drift * 0.65];
        });

        return {
            distanceKm: Number((baseVariant.distanceKm * (1 + index * 0.03)).toFixed(2)),
            durationMin: Number((baseVariant.durationMin * (1 + index * 0.045)).toFixed(2)),
            waypoints,
        };
    };

    const ensureThreeVariants = variants => {
        const unique = [];
        const signatures = new Set();

        for (const variant of variants) {
            if (!variant || !Array.isArray(variant.waypoints) || variant.waypoints.length < 2) continue;
            const signature = buildVariantSignature(variant);
            if (signatures.has(signature)) continue;
            const nearDuplicate = unique.some(existing =>
                Math.abs(existing.distanceKm - variant.distanceKm) < 2 &&
                Math.abs(existing.durationMin - variant.durationMin) < 3
            );
            if (nearDuplicate) continue;
            signatures.add(signature);
            unique.push(cloneVariant(variant));
        }

        if (unique.length === 0) return [];
        const seed = unique[unique.length - 1];
        for (let i = 1; unique.length < 3; i += 1) {
            unique.push(createSyntheticVariant(seed, i));
        }
        return unique.slice(0, 3);
    };

    // Preferred path: backend API that can evolve with custom scoring and data fusion.
    try {
        const from = `${originCity.lng},${originCity.lat}`;
        const to = `${destCity.lng},${destCity.lat}`;
        const response = await fetch(`/api/routes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.variants) && data.variants.length > 0) {
                return ensureThreeVariants(data.variants
                    .map(variant => ({
                        distanceKm: Number(variant.distanceKm),
                        durationMin: Number(variant.durationMin),
                        waypoints: Array.isArray(variant.waypoints) ? variant.waypoints : [],
                    }))
                    .filter(route =>
                        Number.isFinite(route.distanceKm) &&
                        Number.isFinite(route.durationMin) &&
                        route.waypoints.length >= 2
                    ));
            }
        }
    } catch (error) {
        console.warn('Backend routing unavailable, trying direct fallback.', error);
    } // Fallback path: direct OSRM access from browser.
    const straightDistanceKm = haversineDistance(originCity.lat, originCity.lng, destCity.lat, destCity.lng);
    const offset = Math.min(0.35, Math.max(0.05, straightDistanceKm / 900));

    const makeViaPoint = (t, sign, scale) => {
        const baseLat = originCity.lat + (destCity.lat - originCity.lat) * t;
        const baseLng = originCity.lng + (destCity.lng - originCity.lng) * t;
        const vx = destCity.lng - originCity.lng;
        const vy = destCity.lat - originCity.lat;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        const px = (-vy / len) * sign;
        const py = (vx / len) * sign;
        return { lng: baseLng + px * offset * scale, lat: baseLat + py * offset * scale };
    };

    const buildRequest = (coordinates, alternatives) => {
        const query = `alternatives=${alternatives ? 'true' : 'false'}&overview=full&geometries=geojson&steps=false`;
        return `https://router.project-osrm.org/route/v1/driving/${coordinates}?${query}`;
    };

    const toVariant = route => ({
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        waypoints: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    });

    const fetchVariants = async (coordinates, alternatives) => {
        const response = await fetch(buildRequest(coordinates, alternatives));
        if (!response.ok) return [];
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return [];
        return data.routes.map(toVariant).filter(route => route.waypoints.length >= 2);
    };

    const origin = `${originCity.lng},${originCity.lat}`;
    const destination = `${destCity.lng},${destCity.lat}`;
    const viaPoints = [
        makeViaPoint(0.38, 1, 0.85),
        makeViaPoint(0.38, -1, 0.85),
    ];
    const viaRequests = viaPoints.map(via => `${origin};${via.lng},${via.lat};${destination}`);

    const requests = [
        fetchVariants(`${origin};${destination}`, true),
        ...viaRequests.map(coords => fetchVariants(coords, false)),
    ];

    const settled = await Promise.allSettled(requests);
    const allVariants = settled
        .filter(item => item.status === 'fulfilled')
        .flatMap(item => item.value);

    return ensureThreeVariants(allVariants);
}

function updateRouteSteps(route) {
    if (!route.steps || route.steps.length < 5) return;

    const primarySegment = Math.max(10, Math.round(route.distance * 0.7));
    const secondarySegment = Math.max(8, route.distance - primarySegment);

    if (route.id === 2) {
        route.steps[1].desc = `${primarySegment} km - Schnellste Verbindung auf Hauptachsen`;
        route.steps[3].desc = `${secondarySegment} km - Zielabschnitt`;
        return;
    }

    if (route.id === 1) {
        route.steps[1].desc = `${primarySegment} km - Verkehrsarme Abschnitte`;
        route.steps[3].desc = `${secondarySegment} km - Entlastete Zufahrt`;
        return;
    }

    route.steps[1].desc = `${primarySegment} km - Alternative Trasse`;
    route.steps[3].desc = `${secondarySegment} km - Zielnahe Strecke`;
}

async function applyRoadGeometryToRoutes(routes, originCity, destCity, date, time) {
    try {
        const roadVariants = await fetchRoadRouteVariants(originCity, destCity);
        if (roadVariants.length === 0) return false;

        const variantsByRouteId = ensureDistinctRouteAssignments(assignRoadVariants(roadVariants));

        routes.forEach(route => {
            const variant = variantsByRouteId[route.id];
            if (!variant) return;

            route.waypoints = variant.waypoints;
            route.distance = Math.round(variant.distanceKm);
            route.duration = Math.round(variant.durationMin);
            route.baseToll = variant.distanceKm * 0.187;
            updateRouteSteps(route);
        });

        recalculateRoutePricing(routes, date, time);
        applyRouteVisuals(routes);
        return true;
    } catch (error) {
        console.warn('Routing API unavailable, using local fallback routes.', error);
        return false;
    }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}min`;
}

// ---- Map Setup ----
const map = L.map('map', {
    center: [51.1657, 10.4515],
    zoom: 6,
    zoomControl: false,
    attributionControl: true,
});

map.createPane('poiAreaPane');
map.getPane('poiAreaPane').style.zIndex = '440';
map.createPane('poiCenterPane');
map.getPane('poiCenterPane').style.zIndex = '445';

const tileLayerOptions = {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
};

const baseTileLayers = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', tileLayerOptions),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', tileLayerOptions),
};

// Zoom control in bottom right
L.control.zoom({ position: 'bottomright' }).addTo(map);

// ---- State ----
let currentRoutes = [];
let routeLayers = [];
let markerLayers = [];
let selectedRouteId = null;
let poiMarkers = [];
let pendingRouteSelectionId = null;
let selectedVehicleType = 'lkw';
let isDemoMode = true;

const DEMO_ROUTE_COLOR = '#3b82f6';

const VEHICLE_TOLL_MODEL = {
    // Basis + km-Satz je Fahrzeugklasse.
    lkw: { base: 18.0, perKm: 0.165 },
    transporter: { base: 12.0, perKm: 0.128 },
    bus: { base: 15.0, perKm: 0.145 },
};

const LKW_FACTOR_TABLE = {
    weight: { '3.5': 0.82, '7.5': 0.92, '12': 1.0, '18': 1.08 },
    axles: { '2': 0.9, '3': 0.97, '4': 1.03, '5': 1.1 },
    emission: { '0': 1.25, '2': 1.18, '3': 1.12, '4': 1.06, '5': 1.0, '6': 0.93 },
    co2: { '1': 1.12, '2': 1.04, '3': 0.96, '4': 0.9, '5': 0.84 },
};

// ---- DOM Elements ----
const searchBtn = document.getElementById('searchBtn');
const originInput = document.getElementById('origin');
const destInput = document.getElementById('destination');
const travelDate = document.getElementById('travelDate');
const travelTime = document.getElementById('travelTime');
const resultsSection = document.getElementById('resultsSection');
const routesList = document.getElementById('routesList');
const routeDetailPanel = document.getElementById('routeDetailPanel');
const detailContent = document.getElementById('detailContent');
const backBtn = document.getElementById('backBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const swapBtn = document.getElementById('swapBtn');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const layerToggleBtn = document.getElementById('layerToggle');
const layerPanel = document.getElementById('layerPanel');
const zoomToFitBtn = document.getElementById('zoomToFit');
const demoModeToggleBtn = document.getElementById('demoModeToggle');
const mapLegend = document.getElementById('mapLegend');
const themeToggleBtn = document.getElementById('themeToggle');
const routeTimeRecommendationEl = document.getElementById('routeTimeRecommendation');
const appDialogOverlay = document.getElementById('appDialogOverlay');
const appDialogMessage = document.getElementById('appDialogMessage');
const appDialogConfirmBtn = document.getElementById('appDialogConfirmBtn');
const lkwConfigSection = document.getElementById('lkwConfigSection');
const lkwWeightSelect = document.getElementById('lkwWeight');
const lkwAxlesSelect = document.getElementById('lkwAxles');
const lkwEmissionSelect = document.getElementById('lkwEmission');
const lkwCo2Select = document.getElementById('lkwCo2');
const lkwBasePriceInput = document.getElementById('lkwBasePrice');
const lkwTariffValue = document.getElementById('lkwTariffValue');
const lkwEditToggleBtn = document.getElementById('lkwEditToggle');

let isLkwConfigEditable = false;
const lkwControls = [lkwWeightSelect, lkwAxlesSelect, lkwEmissionSelect, lkwCo2Select, lkwBasePriceInput];

const activeVehicleChip = document.querySelector('.vehicle-chip.active');
if (activeVehicleChip?.dataset?.vehicle) {
    selectedVehicleType = activeVehicleChip.dataset.vehicle;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getLkwConfigValues() {
    const weightKey = String(lkwWeightSelect?.value || '18');
    const axlesKey = String(lkwAxlesSelect?.value || '5');
    const emissionKey = String(lkwEmissionSelect?.value || '6');
    const co2Key = String(lkwCo2Select?.value || '1');
    const basePriceCent = clampNumber(Number(lkwBasePriceInput?.value || 34.8), 10, 120);

    return {
        weightKey,
        axlesKey,
        emissionKey,
        co2Key,
        basePriceCent,
    };
}

function applyLkwConfigToVehicleModel() {
    const cfg = getLkwConfigValues();
    const weightFactor = LKW_FACTOR_TABLE.weight[cfg.weightKey] || 1;
    const axleFactor = LKW_FACTOR_TABLE.axles[cfg.axlesKey] || 1;
    const emissionFactor = LKW_FACTOR_TABLE.emission[cfg.emissionKey] || 1;
    const co2Factor = LKW_FACTOR_TABLE.co2[cfg.co2Key] || 1;

    const perKmBase = (cfg.basePriceCent / 100) * 0.40;
    const perKm = perKmBase
        * weightFactor
        * axleFactor
        * (0.75 + emissionFactor * 0.25)
        * (0.78 + co2Factor * 0.22);

    const base = 18
        * (0.78 + weightFactor * 0.22)
        * (0.85 + axleFactor * 0.15)
        * (0.82 + emissionFactor * 0.18)
        * (0.84 + co2Factor * 0.16);

    VEHICLE_TOLL_MODEL.lkw = {
        base: Number(base.toFixed(2)),
        perKm: Number(perKm.toFixed(3)),
    };
}

function updateLkwTariffSummary() {
    if (!lkwTariffValue) return;
    const profile = VEHICLE_TOLL_MODEL.lkw;
    lkwTariffValue.textContent = `${profile.base.toFixed(2)} EUR + ${profile.perKm.toFixed(3)} EUR/km`;
}

function setLkwConfigEditable(editable) {
    if (!lkwConfigSection) return;
    isLkwConfigEditable = Boolean(editable);

    lkwConfigSection.classList.toggle('locked', !isLkwConfigEditable);
    lkwControls.forEach(control => {
        if (!control) return;
        control.disabled = !isLkwConfigEditable;
    });

    if (!lkwEditToggleBtn) return;

    lkwEditToggleBtn.classList.toggle('active', isLkwConfigEditable);
    lkwEditToggleBtn.setAttribute('aria-pressed', isLkwConfigEditable ? 'true' : 'false');
    lkwEditToggleBtn.setAttribute('title', isLkwConfigEditable ? 'Bearbeitung sperren' : 'LKW-Eigenschaften bearbeiten');
    lkwEditToggleBtn.setAttribute('aria-label', isLkwConfigEditable ? 'Bearbeitung sperren' : 'LKW-Eigenschaften bearbeiten');
}

function refreshPricingFromVehicleConfig() {
    applyLkwConfigToVehicleModel();
    updateLkwTariffSummary();

    if (currentRoutes.length > 0 && travelDate.value && travelTime.value) {
        recalculateRoutePricing(currentRoutes, travelDate.value, travelTime.value);
        renderCurrentRouteView();
    }
}

function normalizeLkwBasePriceInput() {
    if (!lkwBasePriceInput) return;
    const normalized = clampNumber(Number(lkwBasePriceInput.value || 34.8), 10, 120);
    lkwBasePriceInput.value = normalized.toFixed(1);
}

function showAppDialog(message) {
    if (!appDialogOverlay || !appDialogMessage) return;
    appDialogMessage.textContent = String(message || '');
    appDialogOverlay.style.display = 'flex';
    appDialogConfirmBtn?.focus();
}

function hideAppDialog() {
    if (!appDialogOverlay) return;
    appDialogOverlay.style.display = 'none';
}

appDialogConfirmBtn?.addEventListener('click', hideAppDialog);
appDialogOverlay?.addEventListener('click', (event) => {
    if (event.target === appDialogOverlay) hideAppDialog();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && appDialogOverlay?.style.display !== 'none') {
        hideAppDialog();
    }
});

// ---- Theme ----
const THEME_STORAGE_KEY = 'ecotoll-theme';
let activeBaseTileLayer = null;

function updateThemeToggleButton(theme) {
    if (!themeToggleBtn) return;

    const isLight = theme === 'light';
    const title = isLight ? 'Dark Mode aktivieren' : 'Bright Mode aktivieren';

    themeToggleBtn.innerHTML = `<i class="ph ${isLight ? 'ph-moon-stars' : 'ph-sun'}"></i>`;
    themeToggleBtn.setAttribute('title', title);
    themeToggleBtn.setAttribute('aria-label', title);
}

function setTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = nextTheme;
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

    if (activeBaseTileLayer) {
        map.removeLayer(activeBaseTileLayer);
    }
    activeBaseTileLayer = baseTileLayers[nextTheme];
    activeBaseTileLayer.addTo(map);

    updateThemeToggleButton(nextTheme);
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
setTheme(savedTheme || 'dark');
setLkwConfigEditable(false);
refreshPricingFromVehicleConfig();

function getFastestRoute(routes) {
    if (!Array.isArray(routes) || routes.length === 0) return null;
    return routes.find(route => route.id === 2) || [...routes].sort((a, b) => a.duration - b.duration)[0];
}

function getDisplayedRoutes(routes = currentRoutes) {
    if (!Array.isArray(routes) || routes.length === 0) return [];
    if (!isDemoMode) return routes;

    const fastestRoute = getFastestRoute(routes);
    if (!fastestRoute) return [];

    return routes
        .filter(route => route.id === fastestRoute.id)
        .map(route => ({ ...route, color: DEMO_ROUTE_COLOR }));
}

function updateDemoModeToggleButton() {
    if (!demoModeToggleBtn) return;

    const title = isDemoMode ? 'Demo-Modus deaktivieren' : 'Demo-Modus aktivieren';
    demoModeToggleBtn.classList.toggle('active', isDemoMode);
    demoModeToggleBtn.setAttribute('title', title);
    demoModeToggleBtn.setAttribute('aria-label', title);
}

function renderCurrentRouteView(options = {}) {
    if (!Array.isArray(currentRoutes) || currentRoutes.length === 0) return;

    const keepDetailPanel = options.keepDetailPanel !== false;
    const displayedRoutes = getDisplayedRoutes(currentRoutes);
    if (displayedRoutes.length === 0) return;

    const displayedRouteIds = new Set(displayedRoutes.map(route => route.id));
    if (selectedRouteId && !displayedRouteIds.has(selectedRouteId)) {
        selectedRouteId = null;
    }
    if (!selectedRouteId) {
        selectedRouteId = displayedRoutes[0].id;
    }

    renderRoutes(displayedRoutes);
    drawRoutesOnMap(displayedRoutes);
    highlightRoute(selectedRouteId);
    refreshVisiblePOILayers();

    const selectedRoute = currentRoutes.find(route => route.id === selectedRouteId) || currentRoutes[0];
    if (travelDate.value && travelTime.value && selectedRoute) {
        renderTimeSuggestions(originInput.value, destInput.value, travelDate.value, travelTime.value, selectedRoute);
    }

    if (!keepDetailPanel || routeDetailPanel.style.display === 'none') return;

    if (selectedRoute && displayedRouteIds.has(selectedRoute.id)) {
        showRouteDetail(selectedRoute);
        return;
    }

    routeDetailPanel.style.display = 'none';
    resultsSection.style.display = 'block';
}

updateDemoModeToggleButton();

// ---- Event Listeners ----

// Search
searchBtn.addEventListener('click', handleSearch);

// Swap origin/destination
swapBtn.addEventListener('click', () => {
    const temp = originInput.value;
    originInput.value = destInput.value;
    destInput.value = temp;
});

// Toggle sidebar
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
});

// Theme toggle
themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.dataset.theme === 'light' ? 'light' : 'dark';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// Layer panel
layerToggleBtn.addEventListener('click', () => {
    layerPanel.style.display = layerPanel.style.display === 'none' ? 'block' : 'none';
});

// Close layer panel on outside click
document.addEventListener('click', (e) => {
    if (!layerPanel.contains(e.target) && e.target !== layerToggleBtn && !layerToggleBtn.contains(e.target)) {
        layerPanel.style.display = 'none';
    }
});

// Zoom to fit
zoomToFitBtn.addEventListener('click', () => {
    if (routeLayers.length > 0) {
        const group = L.featureGroup(routeLayers);
        map.fitBounds(group.getBounds().pad(0.15));
    }
});

// Demo mode toggle
demoModeToggleBtn.addEventListener('click', () => {
    isDemoMode = !isDemoMode;
    updateDemoModeToggleButton();
    renderCurrentRouteView();
});

// Back button
backBtn.addEventListener('click', () => {
    routeDetailPanel.style.display = 'none';
    resultsSection.style.display = 'block';
    highlightRoute(null);
});

// Vehicle chips
document.querySelectorAll('.vehicle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.vehicle-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedVehicleType = chip.dataset.vehicle || 'lkw';
        refreshPricingFromVehicleConfig();
    });
});

lkwEditToggleBtn?.addEventListener('click', () => {
    setLkwConfigEditable(!isLkwConfigEditable);
});

[
    lkwWeightSelect,
    lkwAxlesSelect,
    lkwEmissionSelect,
    lkwCo2Select,
].forEach(control => {
    control?.addEventListener('change', refreshPricingFromVehicleConfig);
});

lkwBasePriceInput?.addEventListener('input', refreshPricingFromVehicleConfig);

// Layer toggles
document.querySelectorAll('.layer-toggle input').forEach(input => {
    input.addEventListener('change', () => {
        togglePOILayer(input.id.replace('layer', '').toLowerCase(), input.checked);
    });
});

// Enter key on inputs
originInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
destInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

// ---- Main Search Handler ----
async function handleSearch() {
    const origin = originInput.value.trim();
    const destination = destInput.value.trim();
    const date = travelDate.value || '2026-04-22';
    const time = travelTime.value || '08:00';
    travelDate.value = date;
    travelTime.value = time;
    const originCity = resolveCity(origin);
    const destCity = resolveCity(destination);

    if (!originCity || !destCity) {
        shakeElement(origin ? destInput : originInput);
        const availableCities = [...new Set(Object.values(CITY_LOOKUP).map(city => city.name))].join(', ');
        showAppDialog(`Stadt nicht gefunden.\nVerfügbare Städte: ${availableCities}`);
        return;
    } // Modern Interface: show skeleton loading instead of blocking overlay
    resultsSection.style.display = 'block';
    routeDetailPanel.style.display = 'none';

    // Clear map slightly for transition effect
    routeLayers.forEach(l => map.removeLayer(l));
    markerLayers.forEach(l => map.removeLayer(l));
    routeLayers = [];
    markerLayers = [];

    // Zoom map smoothly to rough area: map.fitBounds(L.latLngBounds([[originCity.lat, originCity.lng], [destCity.lat, destCity.lng]]).pad(0.3), { animate: true, duration: 1.5 });

    // Show skeletons with narrative loading text
    routesList.innerHTML = `
        <div id="loadingStatusContainer" style="margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; font-weight: 500; animation: cardEntry 0.3s ease both;">
            <i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite; color: var(--accent);"></i>
            <span id="loadingStatusText" style="transition: opacity 0.15s ease;">Lade Kartendaten...</span>
        </div>
        <div class="route-skeleton"></div>
        <div class="route-skeleton" style="animation-delay: 0.1s"></div>
        <div class="route-skeleton" style="animation-delay: 0.2s"></div>
    `;

    // Dynamic loading messages
    const loadingTexts = [
        "Beziehe Live-Verkehrsfluss...",
        "Gleiche Maut-Tarifzonen ab...",
        "Prüfe Lärm- und Umweltfaktoren...",
        "Kalkuliere optimale Eco-Scores..."
    ];
    let loadStep = 0;
    const loadingInterval = setInterval(() => {
        const textEl = document.getElementById('loadingStatusText');
        if (textEl && loadStep < loadingTexts.length) {
            textEl.style.opacity = '0';
            setTimeout(() => {
                if (textEl) {
                    textEl.textContent = loadingTexts[loadStep];
                    textEl.style.opacity = '1';
                }
                loadStep++;
            }, 150);
        }
    }, 300);

    const routes = generateRoutes(originCity, destCity, date, time);
    if (!routes) {
        clearInterval(loadingInterval);
        showAppDialog('Routen konnten nicht berechnet werden. Bitte Start/Ziel erneut prüfen.');
        return;
    }

    await applyRoadGeometryToRoutes(routes, originCity, destCity, date, time);

    clearInterval(loadingInterval);

    // Synchronize POIs with the text descriptions for all routes
    generateSynchronizedPOIs(routes);

    selectedRouteId = null;
    currentRoutes = routes;
    if (pendingRouteSelectionId) {
        const routeExists = routes.some(route => route.id === pendingRouteSelectionId);
        if (routeExists) {
            selectedRouteId = pendingRouteSelectionId;
        }
        pendingRouteSelectionId = null;
    }

    renderCurrentRouteView({ keepDetailPanel: false });
    renderTrafficHeatmap(date);
    resultsSection.style.display = 'block';
    routeDetailPanel.style.display = 'none';
    mapLegend.style.display = 'block';
}

// ---- Render Routes ----
function renderRoutes(routes) {
    routesList.innerHTML = routes.map(route => `
        <div class="route-card ${route.ecoClass} ${selectedRouteId === route.id ? 'selected' : ''}" 
             data-route-id="${route.id}"
             onclick="selectRoute(${route.id})">
            
            <div class="route-card-header">
                <div class="route-name-section">
                    <span class="route-badge ${route.badgeClass}">${route.badge}</span>
                    <span class="route-name">${route.name}</span>
                </div>
                <div class="route-price-section">
                    <div class="route-price ${route.ecoClass}">${route.adjustedToll} €</div>
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-top:2px;">
                        ${route.tollDiscount !== 0 ? `<span class="route-discount ${route.tollDiscount < 0 ? 'surcharge' : ''}">${route.tollDiscount > 0 ? `-${route.tollDiscount}%` : `+${Math.abs(route.tollDiscount)}%`}</span>` : ''}
                        <span class="route-original-price">${route.originalToll} €</span>
                    </div>
                    <div class="route-price-label">Mautgebühr</div>
                </div>
            </div>

            <div class="route-meta">
                <div class="route-meta-item">
                    <i class="ph ph-path"></i>
                    <span>${route.distance} km</span>
                </div>
                <div class="route-meta-item">
                    <i class="ph ph-clock"></i>
                    <span>${formatDuration(route.duration)}</span>
                </div>
                <div class="route-meta-item">
                    <i class="ph ph-gas-pump"></i>
                    <span>~${Math.round(route.distance * 0.32)} L</span>
                </div>
            </div>

            <div class="eco-score-section">
                <span class="eco-score-label">Eco-Score</span>
                <div class="eco-score-bar">
                    <div class="eco-score-fill ${route.ecoClass}" style="width: ${route.ecoScore}%"></div>
                </div>
                <span class="eco-score-value" style="color: var(--${route.ecoClass})">${route.ecoScore}</span>
            </div>

            <div class="criteria-tags">
                <span class="criteria-tag ${route.criteria.traffic.class}" data-tooltip="Verkehrsdichte entlang der Route">
                    <i class="ph ph-traffic-signal"></i> ${route.criteria.traffic.value}
                </span>
                <span class="criteria-tag ${route.criteria.noise.class}" data-tooltip="Lärmbelastung für Natur & Anwohner">
                    <i class="ph ph-speaker-high"></i> ${route.criteria.noise.value}
                </span>
                <span class="criteria-tag ${route.criteria.air.class}" data-tooltip="Gemessene Luftqualität (Feinstaub/CO2)">
                    <i class="ph ph-wind"></i> ${route.criteria.air.value}
                </span>
                <span class="criteria-tag ${route.criteria.accidents.class}" data-tooltip="Statistische Unfallhäufigkeit (Unfallatlas 2024)">
                    <i class="ph ph-warning"></i> ${route.criteria.accidents.value}
                </span>
                <span class="criteria-tag ${route.criteria.construction.class}" data-tooltip="Gemeldete Baustellen & Sperrungen">
                    <i class="ph ph-barricade"></i> ${route.criteria.construction.value}
                </span>
            </div>
        </div>
    `).join('');
}

// ---- Select Route ----
function selectRoute(routeId) {
    selectedRouteId = routeId;
    const route = currentRoutes.find(r => r.id === routeId);
    if (!route) return;

    highlightRoute(routeId);
    refreshVisiblePOILayers();
    if (travelDate.value && travelTime.value) {
        renderTimeSuggestions(originInput.value, destInput.value, travelDate.value, travelTime.value, route);
    }
    showRouteDetail(route);
}

// ---- Show Route Detail ----
function showRouteDetail(route) {
    resultsSection.style.display = 'none';
    routeDetailPanel.style.display = 'block';

    detailContent.innerHTML = `
        <div class="detail-header">
            <span class="route-badge ${route.badgeClass}" style="margin-bottom:8px;display:inline-block;">${route.badge}</span>
            <h2>${route.name}</h2>
            <div style="display:flex; gap:16px; color:var(--text-secondary); font-size:13px; margin-top:6px;">
                <span><i class="ph ph-path"></i> ${route.distance} km</span>
                <span><i class="ph ph-clock"></i> ${formatDuration(route.duration)}</span>
                <span><i class="ph ph-gas-pump"></i> ~${Math.round(route.distance * 0.32)} L</span>
            </div>
            <div class="detail-price-row">
                <span class="detail-price" style="color: var(--${route.ecoClass})">${route.adjustedToll} €</span>
                <span class="detail-original">${route.originalToll} €</span>
                ${route.tollDiscount > 0 ? `<span class="detail-savings">Sie sparen ${route.savings} €</span>` : (route.tollDiscount < 0 ? `<span class="detail-savings surcharge">+${route.extraCost} € Aufpreis</span>` : '')}
            </div>
        </div>

        <div class="eco-score-section" style="margin-bottom: 20px;">
            <span class="eco-score-label">Eco-Score</span>
            <div class="eco-score-bar">
                <div class="eco-score-fill ${route.ecoClass}" style="width: ${route.ecoScore}%"></div>
            </div>
            <span class="eco-score-value" style="color: var(--${route.ecoClass})">${route.ecoScore}/100</span>
        </div>

        <h3 style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Bewertungskriterien</h3>
        <div class="detail-criteria">
            ${renderCriterionCard('ph-traffic-signal', 'Verkehr', route.criteria.traffic)}
            ${renderCriterionCard('ph-speaker-high', 'Lärm', route.criteria.noise)}
            ${renderCriterionCard('ph-wind', 'Luftqualität', route.criteria.air)}
            ${renderCriterionCard('ph-warning', 'Unfälle', route.criteria.accidents)}
            ${renderCriterionCard('ph-barricade', 'Baustellen', route.criteria.construction)}
            ${renderCriterionCard('ph-bridge', 'Infrastruktur', route.criteria.bridges)}
            ${renderCriterionCard('ph-coffee', 'Rastanlagen', route.criteria.rest)}
        </div>

        <div class="detail-steps">
            <h3>Routenverlauf</h3>
            ${route.steps.map((step, index) => `
                <div class="step-item" style="animation-delay : ${index * 0.15 + 0.1}s">
                    <div class="step-dot ${step.type}">
                        <i class="ph ${step.icon}"></i>
                    </div>
                    <div class="step-info">
                        <h4>${step.title}</h4>
                        <p>${step.desc}</p>
                    </div>
                </div>
            `).join('')}
        </div>

        <button class="book-btn" onclick="openRouteSelectionDialog()">
            <i class="ph ph-navigation-arrow"></i>
            Route wählen & Navigation starten
        </button>
    `;
}

function openRouteSelectionDialog() {
    showAppDialog('Route wurde ausgewählt! In der Vollversion wird die Navigation gestartet.');
}

function renderCriterionCard(icon, label, criterion) {
    const colorMap = { good: 'var(--eco-high)', moderate: 'var(--eco-mid)', bad: 'var(--eco-low)' };
    const color = colorMap[criterion.class] || 'var(--text-muted)';

    const tooltipMap = {
        'Verkehr': 'Verkehrsdichte entlang der Route',
        'Lärm': 'Lärmbelastung für Natur & Anwohner',
        'Luftqualität': 'Gemessene Luftqualität (Feinstaub/CO2)',
        'Unfälle': 'Statistische Unfallhäufigkeit (Unfallatlas 2024)',
        'Baustellen': 'Gemeldete Baustellen & Sperrungen',
        'Infrastruktur': 'Anzahl potenzieller Engpässe (z.B. Brücken)',
        'Rastanlagen': 'Verfügbare Service- & Ladepunkte'
    };
    const tooltipText = tooltipMap[label] ? `data-tooltip="${tooltipMap[label]}"` : '';

    return `
        <div class="detail-criterion" ${tooltipText}>
            <div class="detail-criterion-header">
                <i class="ph ${icon}" style="color:${color}"></i>
                ${label}
            </div>
            <div class="detail-criterion-value" style="color:${color}">${criterion.value}</div>
            <div class="detail-criterion-bar">
                <div class="detail-criterion-fill" style="width:${criterion.score}%; background:${color}"></div>
            </div>
        </div>
    `;
}

// ---- Draw Routes on Map ----
function drawRoutesOnMap(routes) {
    // Clear existing
    routeLayers.forEach(l => map.removeLayer(l));
    markerLayers.forEach(l => map.removeLayer(l));
    routeLayers = [];
    markerLayers = [];

    const allBounds = [];

    routes.forEach(route => {
        // Draw route polyline (shadow for glow effect)
        const shadowLine = L.polyline(route.waypoints, {
            color: route.color,
            weight: 10,
            opacity: 0.15,
            smoothFactor: 1.5,
        }).addTo(map);

        const line = L.polyline(route.waypoints, {
            color: route.color,
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1.5,
            dashArray: route.id === 3 ? '8, 8' : null,
        }).addTo(map);

        if (!isDemoMode) {
            let vIcon = 'ph-truck';
            if (selectedVehicleType === 'transporter') vIcon = 'ph-van';
            if (selectedVehicleType === 'bus') vIcon = 'ph-bus';

            const yOffset = route.id === 1 ? -36 : (route.id === 2 ? 0 : 36);
            line.bindTooltip(`<div class="route-hover-tooltip" style="display:flex; align-items:center; gap:4px;"><i class="ph ${vIcon}"></i> ${route.adjustedToll} &euro;</div>`, {
                permanent: true,
                className: 'custom-leaflet-tooltip',
                direction: 'center',
                offset: [0, yOffset]
            });
        }

        line.routeId = route.id;
        line.on('click', () => selectRoute(route.id));
        line.on('mouseover', () => {
            line.setStyle({ weight: 6, opacity: 1 });
            shadowLine.setStyle({ weight: 14, opacity: 0.25 });
            if (line.getTooltip()) line.getTooltip().setOpacity(1);
        });
        line.on('mouseout', () => {
            highlightRoute(selectedRouteId);
        });

        routeLayers.push(line, shadowLine);
        allBounds.push(...route.waypoints);
    });

    // Start & End markers
    const origin = routes[0].waypoints[0];
    const dest = routes[0].waypoints[routes[0].waypoints.length - 1];

    const startMarker = L.marker(origin, {
        icon: createCustomIcon('start'),
    }).addTo(map).bindPopup(`<div class="popup-title">${originInput.value}</div><div class="popup-info">Startpunkt</div>`);

    const endMarker = L.marker(dest, {
        icon: createCustomIcon('end'),
    }).addTo(map).bindPopup(`<div class="popup-title">${destInput.value}</div><div class="popup-info">Zielort</div>`);

    markerLayers.push(startMarker, endMarker);

    // Fit map
    if (allBounds.length > 0) {
        map.fitBounds(L.latLngBounds(allBounds).pad(0.15));
    }
}

// ---- Custom Marker Icons ----
function createCustomIcon(type) {
    const colors = {
        start: { bg: '#22c55e', border: '#16a34a' },
        end: { bg: '#f97316', border: '#ea580c' },
        rest: { bg: '#0ea5e9', border: '#0284c7' },
        fuel: { bg: '#a855f7', border: '#9333ea' },
        construction: { bg: '#f59e0b', border: '#d97706' },
        accident: { bg: '#ef4444', border: '#dc2626' },
    };
    const c = colors[type] || colors.start;

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="width: 32px; height: 32px;
            background: ${c.bg};
            border: 3px solid ${c.border};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 3px 12px rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center;
        "><div style="transform: rotate(45deg); color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold;">
            ${type === 'start' ? 'A' : type === 'end' ? 'B' : type === 'construction' ? '<i class="ph ph-barricade"></i>' : type === 'accident' ? '<i class="ph ph-warning"></i>' : type === 'rest' ? '<i class="ph ph-coffee"></i>' : type === 'fuel' ? '<i class="ph ph-gas-pump"></i>' : '•'}
        </div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });
}

// ---- Highlight Route ----
function highlightRoute(routeId) {
    routeLayers.forEach(layer => {
        if (layer.routeId) {
            if (routeId && layer.routeId === routeId) {
                layer.setStyle({ weight: 6, opacity: 1 });
                layer.bringToFront();
                if (layer.getTooltip()) layer.getTooltip().setOpacity(1);
            } else if (routeId && layer.routeId !== routeId) {
                layer.setStyle({ weight: 3, opacity: 0.3 });
                if (layer.getTooltip()) layer.getTooltip().setOpacity(0);
            } else {
                layer.setStyle({ weight: 4, opacity: 0.8 });
                if (layer.getTooltip()) layer.getTooltip().setOpacity(1);
            }
        } else {
            // Shadow layers
            if (routeId) {
                layer.setStyle({ opacity: 0.05 });
            } else {
                layer.setStyle({ opacity: 0.15 });
            }
        }
    });
}

// ---- Sort Routes ----
function sortRoutes(filter) {
    let sorted = [...currentRoutes];
    const balancedScore = route => {
        const price = parseFloat(route.adjustedToll);
        const timePenalty = route.duration * 0.06;
        return (route.ecoScore * 0.55) - (price * 1.5) - timePenalty;
    };

    switch (filter) {
        case 'cheapest':
            sorted.sort((a, b) => parseFloat(a.adjustedToll) - parseFloat(b.adjustedToll));
            break;
        case 'fastest':
            sorted.sort((a, b) => a.duration - b.duration);
            break;
        case 'balanced':
            sorted.sort((a, b) => balancedScore(b) - balancedScore(a));
            break;
        case 'greenest':
            sorted.sort((a, b) => b.ecoScore - a.ecoScore);
            break;
        default:
            sorted.sort((a, b) => {
                // Keep "Empfohlen" stable and intuitive for users.
                const rank = route => {
                    if (route.badgeClass === 'recommended') return 3;
                    if (route.badgeClass === 'balanced') return 2;
                    if (route.badgeClass === 'cheapest') return 1;
                    return 0;
                };
                const rankDiff = rank(b) - rank(a);
                if (rankDiff !== 0) return rankDiff;
                return balancedScore(b) - balancedScore(a);
            });
    }
    renderRoutes(sorted);
}

// ---- POI Layer Toggle ----
let accidentClusterLayer = null;
let accidentDataCache = null;

function getActiveRouteForLayers() {
    if (!Array.isArray(currentRoutes) || currentRoutes.length === 0) return null;
    if (selectedRouteId) {
        const selected = currentRoutes.find(route => route.id === selectedRouteId);
        if (selected) return selected;
    }
    return currentRoutes[0];
}

function getCriterionSeverity(criterion) {
    const cls = String(criterion.class || '').toLowerCase();
    if (cls === 'bad') return 'high';
    if (cls === 'good') return 'low';
    if (typeof criterion.score === 'number') {
        if (criterion.score <= 45) return 'high';
        if (criterion.score <= 70) return 'moderate';
        return 'low';
    }
    const value = String(criterion.value || '').toLowerCase();
    if (value.includes('hoch') || value.includes('schlecht')) return 'high';
    if (value.includes('mittel')) return 'moderate';
    return 'low';
}

function refreshVisiblePOILayers() {
    poiMarkers.forEach(item => map.removeLayer(item.marker));
    poiMarkers = [];

    document.querySelectorAll('.layer-toggle input').forEach(input => {
        if (!input.checked) return;
        const layerType = input.id.replace('layer', '').toLowerCase();
        togglePOILayer(layerType, true);
    });
}

function togglePOILayer(layerType, visible) {
    if (!visible) {
        poiMarkers.filter(m => m.layerType === layerType).forEach(m => {
            map.removeLayer(m.marker);
        });
        poiMarkers = poiMarkers.filter(m => m.layerType !== layerType);

        if (layerType === 'accidents' && accidentClusterLayer) {
            map.removeLayer(accidentClusterLayer);
        }
        return;
    }

    if (layerType === 'accidents') {
        toggleAccidentLayer(true);
    }

    const activeRoute = getActiveRouteForLayers();
    if (!activeRoute || !activeRoute.pois || !activeRoute.pois[layerType]) return;

    const areaLayerMeta = {
        traffic: { label: 'Verkehrsdichte', icon: 'ph-traffic-signal', dash: '12, 8' },
        noise: { label: 'Lärm', icon: 'ph-speaker-high', dash: '4, 9' },
        air: { label: 'Luftqualität', icon: 'ph-wind', dash: '2, 10' },
    };

    activeRoute.pois[layerType].forEach(poi => {
        let marker;
        if (poi.shape === 'area') {
            const meta = areaLayerMeta[layerType] || { label: 'Umweltzone', icon: 'ph-circle', dash: '8, 8' };
            const group = L.featureGroup();

            // Wider halo to make the zone visible on both dark/light maps.
            L.circle(poi.latlng, {
                pane: 'poiAreaPane',
                radius: poi.radius * 1.8,
                fillColor: poi.color,
                fillOpacity: 0.11,
                color: poi.color,
                opacity: 0.26,
                weight: 1,
                interactive: false,
            }).addTo(group);

            // Main zone body with stronger stroke contrast.
            L.circle(poi.latlng, {
                pane: 'poiAreaPane',
                radius: poi.radius,
                fillColor: poi.color,
                fillOpacity: 0.24,
                color: '#ffffff',
                weight: 2.2,
                opacity: 0.88,
                dashArray: meta.dash,
                interactive: false,
            }).addTo(group);

            // Pulse core keeps the center focus easy to scan.
            L.circle(poi.latlng, {
                pane: 'poiAreaPane',
                radius: poi.radius * 0.35,
                fillColor: poi.color,
                fillOpacity: 0.42,
                color: 'transparent',
                weight: 0,
                className: 'pulsating-core',
                interactive: false,
            }).addTo(group);

            L.circleMarker(poi.latlng, {
                pane: 'poiCenterPane',
                radius: 12,
                fillOpacity: 0,
                color: poi.color,
                weight: 2.6,
                opacity: 0.8,
            }).addTo(group);

            L.circleMarker(poi.latlng, {
                pane: 'poiCenterPane',
                radius: 7,
                fillColor: poi.color,
                fillOpacity: 0.95,
                color: '#ffffff',
                weight: 2,
            }).addTo(group);

            marker = group;
        } else if (poi.shape === 'icon') {
            marker = L.marker(poi.latlng, {
                icon: createCustomIcon(layerType === 'construction' ? 'construction' : (layerType === 'accidents' ? 'accident' : poi.iconType || 'rest'))
            });
        } else {
            marker = L.circleMarker(poi.latlng, {
                radius: 8,
                fillColor: poi.color,
                fillOpacity: 0.9,
                color: '#fff',
                weight: 2,
            });
        }

        const layerInfo = areaLayerMeta[layerType];
        const popupLayerBadge = layerInfo
            ? `<div class="layer-popup-badge layer-popup-${layerType}"><i class="ph ${layerInfo.icon}"></i>${layerInfo.label}</div>`
            : '';

        marker.addTo(map).bindPopup(`
            <div class="popup-title">${poi.label}</div>
            <div class="popup-info">${poi.info}</div>
            ${popupLayerBadge}
        `);
        poiMarkers.push({ marker, layerType });
    });
}

// ---- Real Accident Data Layer (Berlin, Dortmund, Kassel) ----
async function toggleAccidentLayer(visible) {
    if (!visible) {
        if (accidentClusterLayer) {
            map.removeLayer(accidentClusterLayer);
        }
        return;
    }

    // Show existing cluster if already loaded
    if (accidentClusterLayer) {
        map.addLayer(accidentClusterLayer);
        return;
    }

    // Load GeoJSON data
    if (!accidentDataCache) {
        try {
            const cities = ['berlin', 'dortmund', 'kassel', 'hamburg', 'muenchen', 'hannover'];
            accidentDataCache = { type: 'FeatureCollection', features: [] };

            await Promise.all(cities.map(async (city) => {
                try {
                    const resp = await fetch(`Daten/geojson/unfaelle_${city}.json`);
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.features) accidentDataCache.features.push(...data.features);
                    }
                } catch (err) {
                    console.warn(`Failed to fetch accident data for ${city}`, err);
                }
            }));

        } catch (e) {
            console.error('Failed to load accident data:', e);
            return;
        }
    }
    const UNFALL_KAT = { 1: 'Getötete', 2: 'Schwerverletzte', 3: 'Leichtverletzte' };
    const UNFALL_KAT_COLOR = { 1: '#ef4444', 2: '#f97316', 3: '#facc15' };
    const UNFALL_ART = {
        0: 'Sonstige', 1: 'Zusammenstoß mit anfahrendem/anhaltendem Fahrzeug',
        2: 'Zusammenstoß mit vorausfahrendem Fahrzeug', 3: 'Zusammenstoß mit seitlich fahrendem Fahrzeug',
        4: 'Zusammenstoß mit gegenkommendem Fahrzeug', 5: 'Zusammenstoß mit einbiegendem/kreuzendem Fahrzeug',
        6: 'Zusammenstoß zwischen Fahrzeug und Fußgänger', 7: 'Aufprall auf Fahrbahnhindernis',
        8: 'Abkommen von der Fahrbahn', 9: 'Sonstiger Unfall'
    };
    const MONATE = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    // Create cluster
    accidentClusterLayer = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function (cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            let s = 30;
            if (count > 100) { size = 'large'; s = 50; }
            else if (count > 30) { size = 'medium'; s = 40; }

            return L.divIcon({
                html: `<div class="accident-cluster accident-cluster-${size}"><span>${count}</span></div>`,
                className: 'accident-cluster-icon',
                iconSize: L.point(s, s),
            });
        }
    });

    // Add markers
    accidentDataCache.features.forEach(f => {
        const [lng, lat] = f.geometry.coordinates;
        const p = f.properties;
        const color = UNFALL_KAT_COLOR[p.kat] || '#facc15';
        const radius = p.kat === 1 ? 7 : p.kat === 2 ? 5 : 4;

        const beteiligte = [
            p.pkw ? '- PKW' : '',
            p.rad ? '- Rad' : '',
            p.fuss ? '- Fußgänger' : '',
            p.krad ? '🏍️ Krad' : '',
            p.gkfz ? '🚛 GKfz' : '',
        ].filter(Boolean).join(', ') || 'Unbekannt';

        const marker = L.circleMarker([lat, lng], {
            radius: radius,
            fillColor: color,
            fillOpacity: 0.8,
            color: '#fff',
            weight: 1,
            opacity: 0.4,
        }).bindPopup(`
            <div class="accident-popup">
                <div class="accident-popup-header" style="border-left: 4px solid ${color}; padding-left: 8px;">
                    <strong>${UNFALL_KAT[p.kat] || 'Unfall'}</strong>
                </div>
                <div class="accident-popup-body">
                    <div>📋 ${UNFALL_ART[p.art] || 'Sonstiger Unfall'}</div>
                    <div>- ${MONATE[p.monat] || ''} 2024 - ${p.stunde}:00 Uhr</div>
                    <div>- ${beteiligte}</div>
                </div>
            </div>
        `);

        accidentClusterLayer.addLayer(marker);
    });

    map.addLayer(accidentClusterLayer);
    console.log(`- ${accidentDataCache.features.length} reale Unfälle auf der Karte geladen (Berlin, Dortmund, Kassel)`);
}

function generateSynchronizedPOIs(routes) {
    routes.forEach(route => {
        route.pois = { traffic: [], noise: [], air: [], accidents: [], construction: [], bridges: [], rest: [] };
        const wps = route.waypoints;
        if (!wps || wps.length < 5) return;

        const getRandomWaypoint = () => wps[Math.floor(Math.random() * (wps.length - 2)) + 1];

        let constrCount = parseInt(route.criteria.construction.value) || 0;
        const match = route.criteria.construction.value.match(/(d+)/);
        if (match && !route.criteria.construction.value.includes('Keine')) constrCount = parseInt(match[1]);
        for (let i = 0; i < constrCount; i++) {
            route.pois.construction.push({ latlng: getRandomWaypoint(), shape: 'icon', iconType: 'construction', label: 'Baustelle / Sperrung', info: 'Verz-gerung m-glich', color: '#f97316' });
        }

        let bridgeCount = parseInt(route.criteria.bridges.value) || 0;
        const bMatch = route.criteria.bridges.value.match(/(d+)/);
        if (bMatch) bridgeCount = parseInt(bMatch[1]);
        for (let i = 0; i < bridgeCount; i++) {
            route.pois.bridges.push({ latlng: getRandomWaypoint(), shape: 'circle', label: 'Infrastruktur / Brücke', info: 'Kreuzungsbauwerk', color: '#6366f1' });
        }

        let restCount = parseInt(route.criteria.rest.value) || 0;
        const rMatch = route.criteria.rest.value.match(/(d+)/);
        if (rMatch) restCount = parseInt(rMatch[1]);
        for (let i = 0; i < restCount; i++) {
            route.pois.rest.push({ latlng: getRandomWaypoint(), shape: 'icon', iconType: 'rest', label: 'Rastanlage', info: 'Service verf-gbar', color: '#0ea5e9' });
        }

        const accidentSeverity = getCriterionSeverity(route.criteria.accidents);
        const accCount = accidentSeverity === 'high' ? 4 : (accidentSeverity === 'moderate' ? 2 : 1);
        const accInfo = accidentSeverity === 'high' ? 'Erh-htes Unfallrisiko' : (accidentSeverity === 'moderate' ? 'Mittleres Unfallrisiko' : 'Niedriges Unfallrisiko');
        for (let i = 0; i < accCount; i++) {
            route.pois.accidents.push({ latlng: getRandomWaypoint(), shape: 'icon', iconType: 'accident', label: 'Unfallschwerpunkt', info: accInfo, color: '#dc2626' });
        }

        const trafficSeverity = getCriterionSeverity(route.criteria.traffic);
        const trCount = trafficSeverity === 'high' ? 3 : (trafficSeverity === 'moderate' ? 2 : 1);
        const trafficColor = trafficSeverity === 'high' ? '#ef4444' : (trafficSeverity === 'moderate' ? '#f59e0b' : '#22c55e');
        const trafficRadius = trafficSeverity === 'high' ? 9500 : (trafficSeverity === 'moderate' ? 6500 : 4500);
        const trafficInfo = trafficSeverity === 'high' ? 'Dichte Verkehrsströme / Stop-and-Go' : (trafficSeverity === 'moderate' ? 'M-ige Verkehrsdichte' : 'Fl-ssiger Verkehr');
        for (let i = 0; i < trCount; i++) {
            route.pois.traffic.push({ latlng: getRandomWaypoint(), shape: 'area', radius: trafficRadius, label: 'Verkehrsdichte-Zone', info: trafficInfo, color: trafficColor });
        }

        const noiseSeverity = getCriterionSeverity(route.criteria.noise);
        const nCount = noiseSeverity === 'high' ? 3 : (noiseSeverity === 'moderate' ? 2 : 1);
        const noiseColor = noiseSeverity === 'high' ? '#ef4444' : (noiseSeverity === 'moderate' ? '#f59e0b' : '#22c55e');
        const noiseRadius = noiseSeverity === 'high' ? 7500 : (noiseSeverity === 'moderate' ? 5500 : 3500);
        const noiseInfo = noiseSeverity === 'high' ? 'Hohe Lärmbelastung' : (noiseSeverity === 'moderate' ? 'Mittlere Lärmbelastung' : 'Geringe Lärmbelastung');
        for (let i = 0; i < nCount; i++) {
            route.pois.noise.push({ latlng: getRandomWaypoint(), shape: 'area', radius: noiseRadius, label: 'Lärmzone', info: noiseInfo, color: noiseColor });
        }

        const airSeverity = getCriterionSeverity(route.criteria.air);
        const airCount = airSeverity === 'high' ? 1 : (airSeverity === 'moderate' ? 2 : 3);
        const airColor = airSeverity === 'high' ? '#ef4444' : (airSeverity === 'moderate' ? '#f59e0b' : '#10b981');
        const airLabel = airSeverity === 'high' ? 'Belastete Luftzone' : 'Luftqualitäts-Zone';
        const airInfo = airSeverity === 'high' ? 'Erhöhte Luftbelastung' : (airSeverity === 'moderate' ? 'Mittlere Luftqualität' : 'Gute Luftqualität');
        for (let i = 0; i < airCount; i++) {
            route.pois.air.push({ latlng: getRandomWaypoint(), shape: 'area', radius: 11000, label: airLabel, info: airInfo, color: airColor });
        }
    });
}

// Traffic Density Profiles
const TRAFFIC_PROFILES = {
    weekday: [10, 5, 5, 5, 8, 25, 65, 90, 95, 70, 50, 45, 50, 55, 60, 75, 90, 95, 80, 55, 35, 25, 18, 12],
    friday: [10, 5, 5, 5, 8, 20, 55, 85, 90, 65, 50, 50, 60, 70, 80, 95, 98, 90, 75, 50, 30, 20, 15, 10],
    saturday: [8, 5, 5, 5, 5, 8, 15, 25, 40, 55, 65, 70, 68, 65, 60, 55, 50, 45, 35, 25, 20, 15, 12, 10],
    sunday: [8, 5, 5, 5, 5, 5, 10, 15, 25, 35, 40, 45, 50, 55, 60, 70, 75, 70, 55, 40, 30, 20, 15, 10],
};

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function getDayType(date) {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0) return 'sunday';
    if (day === 6) return 'saturday';
    if (day === 5) return 'friday';
    return 'weekday';
}

function getTrafficLevel(density) {
    if (density < 20) return { label: 'Sehr gering', level: 'low', dots: 1 };
    if (density < 40) return { label: 'Gering', level: 'low', dots: 2 };
    if (density < 60) return { label: 'Mittel', level: 'medium', dots: 3 };
    if (density < 80) return { label: 'Hoch', level: 'high', dots: 4 };
    return { label: 'Sehr hoch', level: 'high', dots: 5 };
}

function getTimeOfDayIcon(hour) {
    if (hour >= 22 || hour < 5) return { icon: 'ph-moon-stars', class: 'night' };
    if (hour >= 5 && hour < 10) return { icon: 'ph-sun-horizon', class: 'morning' };
    if (hour >= 10 && hour < 15) return { icon: 'ph-sun', class: 'midday' };
    if (hour >= 15 && hour < 20) return { icon: 'ph-sun-dim', class: 'evening' };
    return { icon: 'ph-moon', class: 'late' };
}

function getTollMultiplier(density) {
    // Higher density -> higher toll; lower density -> discount
    if (density < 20) return 0.65;
    if (density < 35) return 0.75;
    if (density < 50) return 0.90;
    if (density < 65) return 1.00;
    if (density < 80) return 1.15;
    return 1.35;
}

// ---- Render Time Suggestions ----
function estimateRouteCriteriaPenalty(route) {
    if (!route || !route.criteria) return 0;
    const severityWeight = criterion => {
        const severity = getCriterionSeverity(criterion);
        return severity === 'high' ? 1 : (severity === 'moderate' ? 0.55 : 0.2);
    };
    return (
        severityWeight(route.criteria.traffic) * 3.5 +
        severityWeight(route.criteria.noise) * 2.0 +
        severityWeight(route.criteria.accidents) * 3.0 +
        severityWeight(route.criteria.construction) * 1.5
    );
}

function estimateRoutePriceForSlot(route, density, hour, dayType) {
    return getRouteSlotPricing(route, density, hour, dayType).adjustedToll;
}

function formatTollPercentLabel(tollDiscount) {
    if (tollDiscount > 0) return `-${tollDiscount}%`;
    if (tollDiscount < 0) return `+${Math.abs(tollDiscount)}%`;
    return '0%';
}

function buildRouteTimeRecommendation(routes, date, currentTime, currentRoute) {
    const currentHour = parseInt(currentTime.split(':')[0], 10);
    const currentDayType = getDayType(date);
    const currentDensity = TRAFFIC_PROFILES[currentDayType][currentHour];
    const standardBaseToll = getStandardBaseToll(routes);
    const currentPricing = getRouteSlotPricing(currentRoute, currentDensity, currentHour, currentDayType, standardBaseToll);
    const currentPrice = currentPricing.adjustedToll;
    const currentPenalty = estimateRouteCriteriaPenalty(currentRoute);

    const dateObj = new Date(date);
    const candidateSlots = [];
    for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
        const d = new Date(dateObj);
        d.setDate(d.getDate() + dayOffset);
        const dStr = d.toISOString().split('T')[0];
        const dayType = getDayType(dStr);
        const profile = TRAFFIC_PROFILES[dayType];
        for (let hour = 0; hour < 24; hour += 1) {
            if (dayOffset === 0 && hour === currentHour) continue;
            candidateSlots.push({
                date: dStr,
                hour,
                dayName: DAY_NAMES[d.getDay()],
                density: profile[hour],
                dayType,
                isToday: dayOffset === 0,
            });
        }
    }

    let best = null;
    routes.forEach(route => {
        const routePenalty = estimateRouteCriteriaPenalty(route);
        candidateSlots.forEach(slot => {
            const pricing = getRouteSlotPricing(route, slot.density, slot.hour, slot.dayType, standardBaseToll);
            const price = pricing.adjustedToll;
            const score = price + routePenalty + (slot.density * 0.09) + (route.duration * 0.012);
            if (!best || score < best.score) {
                best = { ...slot, route, price, pricing, score, routePenalty };
            }
        });
    });

    if (!best) return null;

    const savings = Number((currentPrice - best.price).toFixed(2));
    const densityDiff = currentDensity - best.density;
    const qualityGain = Number((currentPenalty - best.routePenalty).toFixed(1));

    return {
        ...best,
        standardBaseToll,
        currentPricing,
        currentPrice,
        currentDensity,
        savings,
        densityDiff,
        qualityGain,
        hasRelevantGain: savings >= 2 || densityDiff >= 10 || qualityGain >= 1.2,
    };
}

function renderRouteTimeRecommendation(recommendation) {
    if (!routeTimeRecommendationEl) return;
    if (!recommendation || !recommendation.hasRelevantGain) {
        routeTimeRecommendationEl.classList.remove('visible');
        routeTimeRecommendationEl.innerHTML = '';
        return;
    }
    const timeStr = `${recommendation.hour.toString().padStart(2, '0')}:00`;
    const dayLabel = recommendation.isToday ? 'Heute' : recommendation.dayName;
    const routeName = recommendation.route.name;
    const discountLabel = formatTollPercentLabel(recommendation.pricing.tollDiscount);
    const gainParts = [];
    if (recommendation.savings > 0) gainParts.push(`${recommendation.savings.toFixed(2)} € günstiger`);
    if (recommendation.densityDiff > 0) gainParts.push(`${recommendation.densityDiff}% weniger Verkehr`);
    if (recommendation.qualityGain > 0) gainParts.push('bessere Kriterien');

    routeTimeRecommendationEl.classList.add('visible');
    routeTimeRecommendationEl.innerHTML = `
        <div class="recommendation-card">
            <div class="recommendation-title">Empfehlung Route + Zeitpunkt</div>
            <div class="recommendation-text">
                ${dayLabel}, ${timeStr} mit <strong>${routeName}</strong>.
            </div>
            <div class="recommendation-meta">
                Erwartete Maut: <strong>${recommendation.price.toFixed(2)} €</strong>
                · Standard: ${recommendation.pricing.standardToll.toFixed(2)} €
                · ${discountLabel}
                ${gainParts.length ? ` · ${gainParts.join(' · ')}` : ''}
            </div>
            <div class="recommendation-actions">
                <button class="recommendation-btn" onclick="applyRouteTimeRecommendation('${recommendation.date}', '${timeStr}', ${recommendation.route.id})">
                    Empfehlung übernehmen
                </button>
            </div>
        </div>
    `;
}

function compressSuggestionSlots(slots) {
    if (!Array.isArray(slots) || slots.length === 0) return [];
    const grouped = [];
    const keyOf = slot => `${slot.date}|${slot.dayName}|${slot.isToday ? 1 : 0}|${slot.price.toFixed(2)}`;

    for (const slot of slots) {
        const prev = grouped[grouped.length - 1];
        const sameGroup = prev &&
            keyOf(prev) === keyOf(slot) &&
            slot.hour === prev.endHour + 1;

        if (sameGroup) {
            prev.endHour = slot.hour;
            prev.hours.push(slot.hour);
        } else {
            grouped.push({
                ...slot,
                startHour: slot.hour,
                endHour: slot.hour,
                hours: [slot.hour],
            });
        }
    }

    return grouped;
}

function renderTimeSuggestions(origin, destination, date, currentTime, bestRoute) {
    const timeSlotsEl = document.getElementById('timeSlots');
    if (!timeSlotsEl) return;

    const dateObj = new Date(date);
    const currentHour = parseInt(currentTime.split(':')[0]);
    const dayType = getDayType(date);
    const profile = TRAFFIC_PROFILES[dayType];
    const standardBaseToll = getStandardBaseToll(currentRoutes);

    const candidates = [];

    for (let h = 0; h < 24; h++) {
        if (h === currentHour) continue;
        const d = new Date(dateObj);
        candidates.push({
            date: date,
            hour: h,
            density: profile[h],
            dayName: DAY_NAMES[d.getDay()],
            dayShort: DAY_SHORT[d.getDay()],
            dayType,
            isToday: true,
        });
    }

    const tomorrow = new Date(dateObj);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowType = getDayType(tomorrowStr);
    const tomorrowProfile = TRAFFIC_PROFILES[tomorrowType];

    for (let h = 5; h < 22; h++) {
        candidates.push({
            date: tomorrowStr,
            hour: h,
            density: tomorrowProfile[h],
            dayName: DAY_NAMES[tomorrow.getDay()],
            dayShort: DAY_SHORT[tomorrow.getDay()],
            dayType: tomorrowType,
            isToday: false,
        });
    }

    const dayAfter = new Date(dateObj);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];
    const dayAfterType = getDayType(dayAfterStr);
    const dayAfterProfile = TRAFFIC_PROFILES[dayAfterType];

    for (let h = 5; h < 22; h++) {
        candidates.push({
            date: dayAfterStr,
            hour: h,
            density: dayAfterProfile[h],
            dayName: DAY_NAMES[dayAfter.getDay()],
            dayShort: DAY_SHORT[dayAfter.getDay()],
            dayType: dayAfterType,
            isToday: false,
        });
    }

    const currentDensity = profile[currentHour];
    const currentPricing = getRouteSlotPricing(bestRoute, currentDensity, currentHour, dayType, standardBaseToll);
    const currentPrice = currentPricing.adjustedToll;

    candidates.forEach(slot => {
        slot.pricing = getRouteSlotPricing(bestRoute, slot.density, slot.hour, slot.dayType, standardBaseToll);
        slot.price = slot.pricing.adjustedToll;
    });

    candidates.sort((a, b) => {
        if (a.price === b.price) return a.density - b.density;
        return a.price - b.price;
    });
    const groupedCandidates = compressSuggestionSlots(candidates);
    const bestCandidates = groupedCandidates.slice(0, 4);

    bestCandidates.sort((a, b) => {
        if (a.date === b.date) return a.startHour - b.startHour;
        return a.date < b.date ? -1 : 1;
    });

    if (Array.isArray(currentRoutes) && currentRoutes.length > 0) {
        const recommendation = buildRouteTimeRecommendation(currentRoutes, date, currentTime, bestRoute);
        renderRouteTimeRecommendation(recommendation);
    } else {
        renderRouteTimeRecommendation(null);
    }

    timeSlotsEl.innerHTML = bestCandidates.map((slot, idx) => {
        const traffic = getTrafficLevel(slot.density);
        const timeIcon = getTimeOfDayIcon(slot.hour);
        const tollPrice = slot.price.toFixed(2);
        const priceDiff = (currentPrice - slot.price).toFixed(2);
        const slotDiscount = formatTollPercentLabel(slot.pricing.tollDiscount);
        const isBest = idx === 0 || slot.price === bestCandidates[0].price;
        const startTime = `${slot.startHour.toString().padStart(2, '0')}:00`;
        const endTime = `${slot.endHour.toString().padStart(2, '0')}:00`;
        const timeStr = slot.startHour === slot.endHour ? startTime : `${startTime}-${endTime}`;
        const dayLabel = slot.isToday ? 'Heute' : slot.dayName;

        const dotsHtml = Array.from({ length: 5 }, (_, i) => {
            const active = i < traffic.dots;
            return `<span class="traffic-dot ${active ? 'active ' + traffic.level : ''}"></span>`;
        }).join('');

        return `
            <div class="time-slot ${isBest ? 'best-time' : ''}" onclick="applyTimeSuggestion('${slot.date}', '${startTime}')">
                <div class="time-slot-icon ${timeIcon.class}">
                    <i class="ph ${timeIcon.icon}"></i>
                </div>
                <div class="time-slot-info">
                    <div class="time-slot-datetime">
                        <span class="time-slot-time">${timeStr}</span>
                        <span class="time-slot-day">${dayLabel}</span>
                        ${isBest ? '<span class="time-slot-tag best">Beste Zeit</span>' : (slot.density < 30 ? '<span class="time-slot-tag good">Empfohlen</span>' : '')}
                    </div>
                    <div class="time-slot-details">
                        <span class="time-slot-traffic">
                            <span class="traffic-dots">${dotsHtml}</span>
                            ${traffic.label}
                        </span>
                        <span>·</span>
                        <span>Dichte: ${slot.density}%</span>
                    </div>
                </div>
                <div class="time-slot-right">
                    <div class="time-slot-price ${traffic.level}">${tollPrice} €</div>
                    <div class="time-slot-saving">Standard ${slot.pricing.standardToll.toFixed(2)} € · ${slotDiscount}</div>
                    ${priceDiff > 0 ? `<div class="time-slot-saving">-${priceDiff} € Ersparnis</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function applyTimeSuggestion(date, time) {
    pendingRouteSelectionId = null;
    travelDate.value = date;
    travelTime.value = time;
    handleSearch();
}

function applyRouteTimeRecommendation(date, time, routeId) {
    pendingRouteSelectionId = Number(routeId);
    travelDate.value = date;
    travelTime.value = time;
    handleSearch();
}

// ---- Render Traffic Heatmap ----
function renderTrafficHeatmap(selectedDate) {
    const daySelectorEl = document.getElementById('heatmapDaySelector');
    const chartEl = document.getElementById('heatmapChart');
    if (!daySelectorEl || !chartEl) return;

    const baseDate = new Date(selectedDate);
    const days = [];

    // Generate 7 days starting from selectedDate
    for (let i = 0; i < 7; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        days.push({
            date: d.toISOString().split('T')[0],
            dayName: DAY_SHORT[d.getDay()],
            dayType: getDayType(d.toISOString().split('T')[0]),
            isToday: i === 0,
        });
    }

    // Day selector buttons
    daySelectorEl.innerHTML = days.map((day, idx) => `
        <button class="heatmap-day-btn ${idx === 0 ? 'active' : ''}" 
                data-day-idx="${idx}"
                onclick="selectHeatmapDay(this, '${day.dayType}', '${day.date}')">
            ${day.isToday ? 'Heute' : day.dayName}
        </button>
    `).join('');

    // Render initial day
    renderHeatmapBars(days[0].dayType, selectedDate);
}

function renderHeatmapBars(dayType, date) {
    const chartEl = document.getElementById('heatmapChart');
    if (!chartEl) return;

    const profile = TRAFFIC_PROFILES[dayType];
    const maxDensity = Math.max(...profile);
    const currentHour = parseInt(travelTime.value.split(':')[0]);
    const isToday = date === travelDate.value;

    chartEl.innerHTML = profile.map((density, hour) => {
        const heightPercent = (density / maxDensity) * 100;
        const level = Math.min(5, Math.floor(density / 18));
        const traffic = getTrafficLevel(density);
        const tollMultiplier = getTollMultiplier(density);
        const isCurrentHour = isToday && hour === currentHour;
        const tollLabel = tollMultiplier < 1 ? `${Math.round((1 - tollMultiplier) * 100)}% Rabatt` :
            tollMultiplier > 1 ? `+${Math.round((tollMultiplier - 1) * 100)}% Aufschlag` : 'Normal';

        // Show every other hour label to save space
        const showLabel = hour % 2 === 0;

        return `
            <div class="heatmap-bar-wrapper" onclick="applyTimeSuggestion('${date}', '${hour.toString().padStart(2, '0')}:00')">
                <div class="heatmap-tooltip">
                    <strong>${hour}:00</strong> - ${traffic.label}<br>
                    Dichte: ${density}% · ${tollLabel}
                </div>
                <div class="heatmap-bar level-${level}" style="height: ${Math.max(5, heightPercent)}%;${isCurrentHour ? 'outline: 2px solid var(--accent); outline-offset: 1px;' : ''}"></div>
                ${showLabel ? `<span class="heatmap-hour">${hour}</span>` : '<span class="heatmap-hour"></span>'}
            </div>
        `;
    }).join('');
}

function selectHeatmapDay(btnEl, dayType, date) {
    document.querySelectorAll('.heatmap-day-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderHeatmapBars(dayType, date);
}

// ---- Shake Animation ----
function shakeElement(el) {
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = 'shake 0.5s ease';
    setTimeout(() => { el.style.animation = ''; }, 500);
}

// Add shake keyframes
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
    }
`;
document.head.appendChild(shakeStyle);

// ---- Auto-search on load if values present ----
window.addEventListener('load', () => {
    if (originInput.value && destInput.value) {
        // Small delay for visual effect
        setTimeout(() => handleSearch(), 500);
    }
});

/* ================================================================
   Authority Module - Behörden-Portal: Login + Quartals-Dashboard + Empfehlungen
   ================================================================ */

const AUTHORITY_PASSWORD = 'admin';
const AUTHORITY_STORAGE_KEY = 'ecotoll.authority.session';

const QUARTERS = [
    { id: '2026-Q1', label: 'Q1 2026 (Jan-Mär)', year: 2026, q: 1, months: [1, 2, 3] },
    { id: '2025-Q4', label: 'Q4 2025 (Okt-Dez)', year: 2025, q: 4, months: [10, 11, 12] },
    { id: '2025-Q3', label: 'Q3 2025 (Jul-Sep)', year: 2025, q: 3, months: [7, 8, 9] },
    { id: '2025-Q2', label: 'Q2 2025 (Apr-Jun)', year: 2025, q: 2, months: [4, 5, 6] },
    { id: '2025-Q1', label: 'Q1 2025 (Jan-Mär)', year: 2025, q: 1, months: [1, 2, 3] },
];

const QUARTER_SEASONAL = {
    1: { density: -8, accidents: -0.05 },
    2: { density: 4, accidents: 0.02 },
    3: { density: 10, accidents: 0.08 },
    4: { density: -2, accidents: 0.00 },
};

const AUTHORITY_REAL_DATA_CITIES = ['berlin', 'dortmund', 'kassel', 'hamburg', 'muenchen', 'hannover'];
const _authorityAccidentCache = new Map();

let isAuthorityLoggedIn = false;
let authoritySelectedCity = 'berlin';
let authoritySelectedQuarterId = QUARTERS[0].id;

function authorityHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function makeSeededRng(seedStr) {
    let s = authorityHash(seedStr);
    return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function authorityRandInt(rng, min, max) {
    return Math.floor(min + rng() * (max - min + 1));
}

function authorityCitySizeFactor(cityKey) {
    const bigCities = ['berlin', 'hamburg', 'muenchen', 'koeln', 'frankfurt', 'stuttgart', 'duesseldorf'];
    const mediumCities = ['dortmund', 'essen', 'leipzig', 'dresden', 'hannover', 'bremen', 'nuernberg'];
    const normalized = cityKey
        .replace(/ü/g, 'ue')
        .replace(/ö/g, 'oe')
        .replace(/ä/g, 'ae')
        .replace(/ß/g, 'ss');
    if (bigCities.includes(normalized)) return 1.6;
    if (mediumCities.includes(normalized)) return 1.1;
    return 0.7;
}

async function loadAuthorityAccidents(cityKey) {
    if (_authorityAccidentCache.has(cityKey)) {
        return _authorityAccidentCache.get(cityKey);
    }
    if (!AUTHORITY_REAL_DATA_CITIES.includes(cityKey)) {
        _authorityAccidentCache.set(cityKey, null);
        return null;
    }
    try {
        const res = await fetch('Daten/geojson/unfaelle_' + cityKey + '.json');
        if (!res.ok) throw new Error('fetch failed');
        const gj = await res.json();
        const byMonth = Array(13).fill(0);
        let total = 0;
        for (const f of gj.features || []) {
            const m = f.properties && f.properties.monat;
            if (m >= 1 && m <= 12) {
                byMonth[m]++;
                total++;
            }
        }
        const data = { byMonth, total };
        _authorityAccidentCache.set(cityKey, data);
        return data;
    } catch (err) {
        console.warn('[Authority] Unfalldaten konnten nicht geladen werden:', cityKey, err);
        _authorityAccidentCache.set(cityKey, null);
        return null;
    }
}

async function getAuthorityStats(cityKey, quarterId) {
    const quarter = QUARTERS.find(function (q) { return q.id === quarterId; });
    if (!quarter) return null;

    const seasonal = QUARTER_SEASONAL[quarter.q];
    const sizeFactor = authorityCitySizeFactor(cityKey);
    const rng = makeSeededRng(cityKey + '|' + quarterId);

    const weekday = TRAFFIC_PROFILES.weekday;
    let avgDensity = 0;
    for (let h = 6; h <= 20; h++) avgDensity += weekday[h];
    avgDensity /= 15;

    const densityOffset = seasonal.density + authorityRandInt(rng, -6, 6);
    const density = Math.round(Math.max(15, Math.min(95, avgDensity + densityOffset)));

    let accidents;
    let accidentsByMonth;
    const real = await loadAuthorityAccidents(cityKey);
    if (real) {
        accidentsByMonth = quarter.months.map(function (m) { return real.byMonth[m] || 0; });
        const realQuarterSum = accidentsByMonth.reduce(function (a, b) { return a + b; }, 0);
        const mod = 1 + seasonal.accidents + (rng() * 0.06 - 0.03);
        accidents = Math.max(1, Math.round(realQuarterSum * mod));
        accidentsByMonth = accidentsByMonth.map(function (v) { return Math.max(0, Math.round(v * mod)); });
    } else {
        const base = Math.round(80 * sizeFactor);
        accidents = Math.max(20, Math.round(
            base * (1 + seasonal.accidents) * (0.85 + rng() * 0.3)
        ));
        const perMonth = accidents / 3;
        accidentsByMonth = [0, 1, 2].map(function () {
            return Math.max(0, Math.round(perMonth * (0.8 + rng() * 0.4)));
        });
        accidents = accidentsByMonth.reduce(function (a, b) { return a + b; }, 0);
    }

    const tollMult = getTollMultiplier(density);
    const tollRevenue = Math.round(density * tollMult * sizeFactor * 18000 + authorityRandInt(rng, -40000, 40000));
    const utilization = Math.round(Math.min(98, density * 0.9 + authorityRandInt(rng, -4, 6)));
    const construction = Math.round(Math.min(40, 6 + authorityRandInt(rng, 0, 22) + (seasonal.density > 0 ? 3 : -1)));
    const restStopScore = Math.round(3 + rng() * 6);

    const densityByMonth = [0, 1, 2].map(function () {
        return Math.max(15, Math.min(95, density + authorityRandInt(rng, -6, 6)));
    });

    const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    return {
        city: cityKey,
        cityLabel: (CITIES[cityKey] && CITIES[cityKey].name) || cityKey,
        quarterId: quarterId,
        quarterLabel: quarter.label,
        density: density,
        accidents: accidents,
        tollRevenue: tollRevenue,
        utilization: utilization,
        construction: construction,
        restStopScore: restStopScore,
        densityByMonth: densityByMonth,
        accidentsByMonth: accidentsByMonth,
        monthNames: quarter.months.map(function (m) { return MONTH_SHORT[m - 1]; }),
        hasRealData: !!real,
    };
}

function getPreviousQuarterId(currentId) {
    const idx = QUARTERS.findIndex(function (q) { return q.id === currentId; });
    if (idx < 0 || idx >= QUARTERS.length - 1) return null;
    return QUARTERS[idx + 1].id;
}

function authorityPctChange(prev, curr) {
    if (prev === 0 || prev == null) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
}

function formatSigned(value, decimals) {
    decimals = decimals == null ? 1 : decimals;
    const rounded = value.toFixed(decimals);
    return (value > 0 ? '+' : '') + rounded;
}

function formatCurrency(value) {
    return value.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
}

const RECOMMENDATION_RULES = [
    {
        id: 'infrastructure',
        title: 'Straßeninfrastruktur prüfen',
        icon: 'ph-wrench',
        severity: 'high',
        badge: 'Priorität hoch',
        condition: function (p, c) {
            const dDensity = authorityPctChange(p.density, c.density);
            const dAccidents = authorityPctChange(p.accidents, c.accidents);
            return dDensity <= -15 && dAccidents >= -10 && dAccidents <= 10;
        },
        reason: function (p, c) {
            return 'Verkehr ist um ' + Math.abs(authorityPctChange(p.density, c.density)).toFixed(1) +
                ' % gesunken, Unfälle bleiben aber nahezu konstant (' +
                formatSigned(authorityPctChange(p.accidents, c.accidents)) + ' %).';
        },
        action: function () {
            return 'Fahrbahnzustand und Beschilderung vor Ort untersuchen - weniger Verkehr bei gleichbleibenden Unfällen deutet auf <strong>Infrastrukturmängel</strong> hin (Schlaglöcher, unübersichtliche Abschnitte, fehlende Leitplanken).';
        },
    },
    {
        id: 'toll-works',
        title: 'Mautstrategie beibehalten',
        icon: 'ph-shield-check',
        severity: 'positive',
        badge: 'Erfolg',
        condition: function (p, c) {
            return authorityPctChange(p.density, c.density) <= -10 &&
                authorityPctChange(p.accidents, c.accidents) <= -8;
        },
        reason: function (p, c) {
            return 'Verkehr ' + formatSigned(authorityPctChange(p.density, c.density)) +
                ' %, Unfälle ' + formatSigned(authorityPctChange(p.accidents, c.accidents)) +
                ' % - beide deutlich rückläufig.';
        },
        action: function () {
            return 'Aktuelle Tarifparameter <strong>beibehalten</strong> oder nur leicht anpassen. Die Umverteilung über die Maut wirkt wie beabsichtigt.';
        },
    },
    {
        id: 'toll-increase',
        title: 'Maut-Multiplikator erhöhen',
        icon: 'ph-trend-up',
        severity: 'medium',
        badge: 'Tarif-Anpassung',
        condition: function (p, c) {
            return authorityPctChange(p.density, c.density) >= 8 &&
                authorityPctChange(p.accidents, c.accidents) >= 10;
        },
        reason: function (p, c) {
            return 'Verkehr stieg um ' + authorityPctChange(p.density, c.density).toFixed(1) +
                ' %, Unfälle sogar um ' + authorityPctChange(p.accidents, c.accidents).toFixed(1) + ' %.';
        },
        action: function () {
            return 'Maut-Multiplikator für <strong>Stoßzeiten erhöhen</strong> (+10-15 %), um Verkehr auf Randzeiten und Alternativrouten zu verlagern.';
        },
    },
    {
        id: 'rest-stops',
        title: 'Rastanlagen ausbauen',
        icon: 'ph-coffee',
        severity: 'medium',
        badge: 'Bau-Empfehlung',
        condition: function (p, c) {
            return c.restStopScore <= 4 && c.accidents > p.accidents * 0.9;
        },
        reason: function (p, c) {
            return 'Rastanlagen-Dichte ist niedrig (Score ' + c.restStopScore + '/10). Unfallrate bleibt auf hohem Niveau.';
        },
        action: function () {
            return 'Zwei bis drei zusätzliche <strong>Rastanlagen</strong> auf den Hauptkorridoren priorisieren - Müdigkeit ist ein signifikanter Unfallfaktor auf Langstrecken.';
        },
    },
    {
        id: 'construction',
        title: 'Baustellen-Management optimieren',
        icon: 'ph-barricade',
        severity: 'info',
        badge: 'Umleitung',
        condition: function (p, c) {
            return c.construction >= 22 && authorityPctChange(p.density, c.density) >= 3;
        },
        reason: function (p, c) {
            return 'Baustellen-Anteil ' + c.construction + ' %, Verkehr ' +
                formatSigned(authorityPctChange(p.density, c.density)) + ' % auf Umleitungsrouten.';
        },
        action: function () {
            return 'Bauphasen <strong>bündeln oder nachts durchführen</strong>, Umleitungsführung über EcoToll-Routing dynamisch anpassen.';
        },
    },
    {
        id: 'density-drop-strong',
        title: 'Entlastung im Auge behalten',
        icon: 'ph-chart-line-down',
        severity: 'info',
        badge: 'Beobachten',
        condition: function (p, c) {
            return authorityPctChange(p.density, c.density) <= -25;
        },
        reason: function (p, c) {
            return 'Verkehr ist um ' + Math.abs(authorityPctChange(p.density, c.density)).toFixed(1) + ' % gefallen - möglicherweise zu stark.';
        },
        action: function () {
            return 'Prüfen, ob Wirtschaftsverkehr betroffen ist (Zustellung, Logistik). Ggf. Maut für zertifizierte Eco-Fahrzeuge <strong>rabattieren</strong>, damit die Umverteilung nicht zu Lasten der Versorgung geht.';
        },
    },
];

function runRecommendationEngine(prev, curr) {
    if (!prev || !curr) return [];
    const matched = [];
    for (const rule of RECOMMENDATION_RULES) {
        try {
            if (rule.condition(prev, curr)) {
                matched.push({
                    id: rule.id,
                    title: rule.title,
                    icon: rule.icon,
                    severity: rule.severity,
                    badge: rule.badge,
                    reason: rule.reason(prev, curr),
                    action: rule.action(prev, curr),
                });
            }
        } catch (err) {
            console.warn('[Authority] Regel fehlgeschlagen:', rule.id, err);
        }
    }
    const severityOrder = { high: 0, medium: 1, info: 2, positive: 3 };
    matched.sort(function (a, b) { return severityOrder[a.severity] - severityOrder[b.severity]; });
    return matched;
}

function openAuthorityLogin() {
    const modal = document.getElementById('authorityLoginModal');
    if (!modal) return;
    modal.style.display = 'flex';
    const err = document.getElementById('authorityLoginError');
    if (err) { err.textContent = ''; err.classList.remove('show'); }
    const pass = document.getElementById('authorityPass');
    if (pass) {
        pass.value = '';
        setTimeout(function () { pass.focus(); }, 50);
    }
}

function closeAuthorityLogin() {
    const modal = document.getElementById('authorityLoginModal');
    if (modal) modal.style.display = 'none';
}

function handleAuthorityLogin() {
    const passEl = document.getElementById('authorityPass');
    const errEl = document.getElementById('authorityLoginError');
    const value = passEl ? passEl.value : '';
    if (value !== AUTHORITY_PASSWORD) {
        if (errEl) {
            errEl.innerHTML = '<i class="ph ph-warning"></i> Falsches Passwort. Demo-Zugang: <code>admin</code>';
            errEl.classList.add('show');
        }
        if (passEl) shakeElement(passEl);
        return;
    }
    isAuthorityLoggedIn = true;
    try { sessionStorage.setItem(AUTHORITY_STORAGE_KEY, '1'); } catch (_) { }
    closeAuthorityLogin();
    openAuthorityDashboard();
}

function logoutAuthority() {
    isAuthorityLoggedIn = false;
    try { sessionStorage.removeItem(AUTHORITY_STORAGE_KEY); } catch (_) { }
    closeAuthorityDashboard();
}

function openAuthorityDashboard() {
    const dash = document.getElementById('authorityDashboard');
    if (!dash) return;
    populateAuthoritySelectors();
    dash.style.display = 'block';
    dash.scrollTop = 0;
    renderAuthorityDashboard();
}

function closeAuthorityDashboard() {
    const dash = document.getElementById('authorityDashboard');
    if (dash) dash.style.display = 'none';
}

function populateAuthoritySelectors() {
    const citySel = document.getElementById('authorityCitySelect');
    const quarterSel = document.getElementById('authorityQuarterSelect');
    if (citySel && !citySel.options.length) {
        const entries = Object.entries(CITIES).sort(function (a, b) {
            return a[1].name.localeCompare(b[1].name, 'de');
        });
        for (const [key, city] of entries) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = city.name + (AUTHORITY_REAL_DATA_CITIES.includes(key) ? ' · ● Live-Daten' : '');
            citySel.appendChild(opt);
        }
        citySel.value = authoritySelectedCity;
    }
    if (quarterSel && !quarterSel.options.length) {
        for (const q of QUARTERS) {
            if (!getPreviousQuarterId(q.id)) continue;
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.label;
            quarterSel.appendChild(opt);
        }
        quarterSel.value = authoritySelectedQuarterId;
    }
}

async function renderAuthorityDashboard() {
    const city = authoritySelectedCity;
    const currentId = authoritySelectedQuarterId;
    const previousId = getPreviousQuarterId(currentId);

    const labelEl = document.getElementById('authorityQuarterLabel');
    if (labelEl) {
        const currQ = QUARTERS.find(function (q) { return q.id === currentId; });
        const prevQ = QUARTERS.find(function (q) { return q.id === previousId; });
        labelEl.textContent = prevQ ? (prevQ.label + ' → ' + currQ.label) : currQ.label;
    }

    const results = await Promise.all([
        getAuthorityStats(city, currentId),
        previousId ? getAuthorityStats(city, previousId) : Promise.resolve(null),
    ]);
    const curr = results[0];
    const prev = results[1];

    renderAuthorityKPIs(prev, curr);
    renderAuthorityChart(prev, curr);
    const recs = runRecommendationEngine(prev, curr);
    renderAuthorityRecommendations(recs);
}

function renderAuthorityKPIs(prev, curr) {
    const grid = document.getElementById('authorityKpiGrid');
    if (!grid || !curr) return;

    const kpis = [
        {
            label: 'Verkehrsdichte',
            icon: 'ph-traffic-signal',
            value: curr.density,
            unit: '%',
            prevVal: prev ? prev.density : null,
            goodDirection: 'down',
            context: 'Ø Werktag zwischen 6-20 Uhr',
        },
        {
            label: 'Unfälle',
            icon: 'ph-warning-octagon',
            value: curr.accidents,
            unit: '',
            prevVal: prev ? prev.accidents : null,
            goodDirection: 'down',
            context: curr.hasRealData ? 'Echte Unfalldaten (Unfallatlas)' : 'Geschätzt auf Basis der Stadtgröße',
        },
        {
            label: 'Maut-Einnahmen',
            icon: 'ph-currency-eur',
            value: curr.tollRevenue,
            unit: '',
            formatter: formatCurrency,
            prevVal: prev ? prev.tollRevenue : null,
            goodDirection: 'up',
            context: 'Hochgerechnet für das Quartal',
        },
        {
            label: 'Ø Auslastung',
            icon: 'ph-gauge',
            value: curr.utilization,
            unit: '%',
            prevVal: prev ? prev.utilization : null,
            goodDirection: 'down',
            context: 'Anteil der Netzkapazität',
        },
    ];

    grid.innerHTML = kpis.map(function (k) {
        const pct = k.prevVal != null ? authorityPctChange(k.prevVal, k.value) : null;
        let deltaClass = 'neutral';
        let trendClass = 'trend-flat';
        if (pct != null && Math.abs(pct) >= 0.5) {
            const goodIsDown = k.goodDirection === 'down';
            const isGood = goodIsDown ? pct < 0 : pct > 0;
            deltaClass = isGood ? 'positive' : (Math.abs(pct) >= 10 ? 'bad' : 'negative');
            trendClass = isGood ? 'trend-up' : (Math.abs(pct) >= 10 ? 'trend-bad' : 'trend-down');
        }
        const valueStr = k.formatter ? k.formatter(k.value) : k.value.toLocaleString('de-DE');
        const unitStr = k.unit ? '<span class="authority-kpi-unit">' + k.unit + '</span>' : '';
        const arrow = pct == null ? 'ph-minus' : (pct > 0 ? 'ph-arrow-up' : pct < 0 ? 'ph-arrow-down' : 'ph-minus');
        const deltaStr = pct != null ? '<span class="authority-kpi-delta ' + deltaClass + '"><i class="ph ' + arrow + '"></i>' + formatSigned(pct) + ' %</span>' : '<span class="authority-kpi-delta neutral">Vergleich fehlt</span>';

        return '' +
            '<div class="authority-kpi-card ' + trendClass + '">' +
            '  <div class="authority-kpi-label"><i class="ph ' + k.icon + '"></i>' + k.label + '</div>' +
            '  <div class="authority-kpi-value">' + valueStr + unitStr + '</div>' +
            '  ' + deltaStr +
            '  <div class="authority-kpi-context">' + k.context + '</div>' +
            '</div>';
    }).join('');
}

function renderAuthorityChart(prev, curr) {
    const chart = document.getElementById('authorityChart');
    if (!chart || !curr) return;

    const maxDensity = 100;
    const maxAccidents = Math.max.apply(null, curr.accidentsByMonth.concat([1]));

    const cols = curr.monthNames.map(function (m, i) {
        const dens = curr.densityByMonth[i];
        const acc = curr.accidentsByMonth[i];
        const densH = Math.max(6, (dens / maxDensity) * 170);
        const accH = Math.max(6, (acc / maxAccidents) * 170);
        return '' +
            '<div class="authority-chart-col">' +
            '  <div class="authority-chart-bars">' +
            ' <div class="authority-chart-bar" style="height :' + densH + 'px" title="Verkehrsdichte ' + dens + '%">' + dens + '</div>' +
            ' <div class="authority-chart-bar accidents" style="height :' + accH + 'px" title="' + acc + ' Unfälle">' + acc + '</div>' +
            '  </div>' +
            '  <div class="authority-chart-col-label">' + m + '</div>' +
            '</div>';
    }).join('');

    chart.innerHTML = cols +
        '<div class="authority-chart-legend" style="grid-column: 1 / -1;">' +
        '  <span class="authority-chart-legend-item"><span class="authority-chart-legend-dot"></span>Verkehrsdichte (%)</span>' +
        '  <span class="authority-chart-legend-item"><span class="authority-chart-legend-dot accidents"></span>Unfälle (Anzahl)</span>' +
        '</div>';
}

function renderAuthorityRecommendations(recs) {
    const list = document.getElementById('authorityRecList');
    if (!list) return;
    if (!recs.length) {
        list.innerHTML = '' +
            '<div class="authority-rec-empty">' +
            '  <i class="ph ph-check-circle"></i> ' +
            '  Keine kritischen Muster erkannt - Situation stabil im Vergleich zum Vorquartal.' +
            '</div>';
        return;
    }
    list.innerHTML = recs.map(function (r) {
        return '' +
            '<div class="authority-rec-card severity-' + r.severity + '">' +
            '  <div class="authority-rec-icon"><i class="ph ' + r.icon + '"></i></div>' +
            '  <div class="authority-rec-body">' +
            '    <div class="authority-rec-title-row">' +
            '      <h3 class="authority-rec-title">' + r.title + '</h3>' +
            '      <span class="authority-rec-badge">' + r.badge + '</span>' +
            '    </div>' +
            '    <div class="authority-rec-reason">' + r.reason + '</div>' +
            '    <div class="authority-rec-action">' + r.action + '</div>' +
            '  </div>' +
            '</div>';
    }).join('');
}

(function setupAuthorityListeners() {
    const loginBtn = document.getElementById('authorityLoginBtn');
    const loginClose = document.getElementById('authorityLoginClose');
    const loginSubmit = document.getElementById('authorityLoginSubmit');
    const logoutBtn = document.getElementById('authorityLogoutBtn');
    const citySel = document.getElementById('authorityCitySelect');
    const quarterSel = document.getElementById('authorityQuarterSelect');
    const passInput = document.getElementById('authorityPass');
    const modal = document.getElementById('authorityLoginModal');

    if (loginBtn) loginBtn.addEventListener('click', openAuthorityLogin);
    if (loginClose) loginClose.addEventListener('click', closeAuthorityLogin);
    if (loginSubmit) loginSubmit.addEventListener('click', handleAuthorityLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', logoutAuthority);
    if (passInput) passInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleAuthorityLogin(); }
    });
    if (modal) modal.addEventListener('click', function (e) {
        if (e.target === modal) closeAuthorityLogin();
    });
    if (citySel) citySel.addEventListener('change', function (e) {
        authoritySelectedCity = e.target.value;
        renderAuthorityDashboard();
    });
    if (quarterSel) quarterSel.addEventListener('change', function (e) {
        authoritySelectedQuarterId = e.target.value;
        renderAuthorityDashboard();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const modalEl = document.getElementById('authorityLoginModal');
        const dashEl = document.getElementById('authorityDashboard');
        if (modalEl && modalEl.style.display !== 'none') {
            closeAuthorityLogin();
        } else if (dashEl && dashEl.style.display !== 'none') {
            closeAuthorityDashboard();
        }
    });

    try {
        if (sessionStorage.getItem(AUTHORITY_STORAGE_KEY) === '1') {
            isAuthorityLoggedIn = true;
        }
    } catch (_) { }
})();

