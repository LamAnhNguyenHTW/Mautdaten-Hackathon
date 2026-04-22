const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving/';

function sendJson(res, status, payload) {
    res.status(status).json(payload);
}

function parseLngLat(value) {
    if (!value || typeof value !== 'string') return null;
    const [lngRaw, latRaw] = value.split(',');
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
}

function haversineDistanceKm(a, b) {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function makeViaPoint(origin, destination, t, sign, scale, offset) {
    const baseLat = origin.lat + (destination.lat - origin.lat) * t;
    const baseLng = origin.lng + (destination.lng - origin.lng) * t;
    const vx = destination.lng - origin.lng;
    const vy = destination.lat - origin.lat;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    const px = (-vy / len) * sign;
    const py = (vx / len) * sign;
    return { lng: baseLng + px * offset * scale, lat: baseLat + py * offset * scale };
}

function toVariant(route) {
    return {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        waypoints: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
}

function dedupeVariants(variants) {
    const buildSignature = variant => {
        if (!Array.isArray(variant.waypoints) || variant.waypoints.length === 0) return '';
        const points = variant.waypoints;
        const step = Math.max(1, Math.floor(points.length / 20));
        const sampled = [];
        for (let i = 0; i < points.length; i += step) {
            const [lat, lng] = points[i];
            sampled.push(`${lat.toFixed(3)},${lng.toFixed(3)}`);
        }
        const [lastLat, lastLng] = points[points.length - 1];
        sampled.push(`${lastLat.toFixed(3)},${lastLng.toFixed(3)}`);
        return sampled.join('|');
    };

    const unique = [];
    const signatures = new Set();

    for (const variant of variants) {
        if (!variant || !Array.isArray(variant.waypoints) || variant.waypoints.length < 2) continue;
        const signature = buildSignature(variant);
        if (signatures.has(signature)) continue;
        const isNearDuplicate = unique.some(existing =>
            Math.abs(existing.distanceKm - variant.distanceKm) < 2 &&
            Math.abs(existing.durationMin - variant.durationMin) < 3
        );
        if (isNearDuplicate) continue;
        signatures.add(signature);
        unique.push(variant);
    }

    return unique;
}

function cloneWaypoints(waypoints) {
    return waypoints.map(([lat, lng]) => [lat, lng]);
}

function createSyntheticVariant(baseVariant, index) {
    const sign = index % 2 === 0 ? 1 : -1;
    const latValues = baseVariant.waypoints.map(([lat]) => lat);
    const lngValues = baseVariant.waypoints.map(([, lng]) => lng);
    const latSpan = Math.max(...latValues) - Math.min(...latValues);
    const lngSpan = Math.max(...lngValues) - Math.min(...lngValues);
    const corridorWidth = Math.min(0.015, Math.max(0.0035, Math.max(latSpan, lngSpan) * 0.05));

    const adjustedWaypoints = baseVariant.waypoints.map(([lat, lng], pointIndex, points) => {
        const isEdge = pointIndex === 0 || pointIndex === points.length - 1;
        if (isEdge) return [lat, lng];

        const progress = pointIndex / (points.length - 1);
        const wave = Math.sin(progress * Math.PI);
        const drift = corridorWidth * wave * (1 + index * 0.22);

        return [lat + sign * drift * 0.45, lng - sign * drift * 0.65];
    });

    return {
        distanceKm: Number((baseVariant.distanceKm * (1 + index * 0.03)).toFixed(2)),
        durationMin: Number((baseVariant.durationMin * (1 + index * 0.045)).toFixed(2)),
        waypoints: adjustedWaypoints,
    };
}

function ensureThreeVariants(variants) {
    const unique = dedupeVariants(variants).map(variant => ({
        ...variant,
        waypoints: cloneWaypoints(variant.waypoints),
    }));

    if (unique.length >= 3) return unique.slice(0, 3);
    if (unique.length === 0) return [];

    const seed = unique[unique.length - 1];
    let index = 1;
    while (unique.length < 3) {
        unique.push(createSyntheticVariant(seed, index));
        index += 1;
    }

    return unique;
}

async function requestOsrmVariants(coordinates, alternatives) {
    const query = `alternatives=${alternatives ? 'true' : 'false'}&overview=full&geometries=geojson&steps=false`;
    const response = await fetch(`${OSRM_BASE}${coordinates}?${query}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return [];
    return data.routes.map(toVariant).filter(route => route.waypoints.length >= 2);
}

async function buildRouteVariants(origin, destination) {
    const straightDistanceKm = haversineDistanceKm(origin, destination);
    const baseOffset = Math.min(0.35, Math.max(0.05, straightDistanceKm / 900));
    const originCoord = `${origin.lng},${origin.lat}`;
    const destinationCoord = `${destination.lng},${destination.lat}`;

    const northPrimary = makeViaPoint(origin, destination, 0.35, 1, 0.9, baseOffset);
    const southPrimary = makeViaPoint(origin, destination, 0.35, -1, 0.9, baseOffset);

    const corridorRequests = [
        requestOsrmVariants(`${originCoord};${destinationCoord}`, true),
        requestOsrmVariants(`${originCoord};${northPrimary.lng},${northPrimary.lat};${destinationCoord}`, false),
        requestOsrmVariants(`${originCoord};${southPrimary.lng},${southPrimary.lat};${destinationCoord}`, false),
    ];

    const fallbackViaPoints = [
        makeViaPoint(origin, destination, 0.5, 1, 1.1, baseOffset),
        makeViaPoint(origin, destination, 0.5, -1, 1.1, baseOffset),
        makeViaPoint(origin, destination, 0.65, 1, 0.7, baseOffset),
        makeViaPoint(origin, destination, 0.65, -1, 0.7, baseOffset),
    ];

    const requests = [
        ...corridorRequests,
        ...fallbackViaPoints.map(via => requestOsrmVariants(`${originCoord};${via.lng},${via.lat};${destinationCoord}`, false)),
    ];

    const settled = await Promise.allSettled(requests);
    const variants = settled
        .filter(item => item.status === 'fulfilled')
        .flatMap(item => item.value);

    return ensureThreeVariants(variants);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const from = parseLngLat(req.query.from);
    const to = parseLngLat(req.query.to);
    if (!from || !to) {
        sendJson(res, 400, { error: 'Invalid "from" or "to" coordinates. Expected "lng,lat".' });
        return;
    }

    try {
        const variants = await buildRouteVariants(from, to);
        sendJson(res, 200, { variants });
    } catch (error) {
        sendJson(res, 502, { error: 'Routing backend failed', detail: String(error.message || error) });
    }
};
