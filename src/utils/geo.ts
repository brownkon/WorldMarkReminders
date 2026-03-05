/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * Returns distance in miles.
 */
export function distanceMiles(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate a bounding box around a point.
 * Returns { minLat, maxLat, minLng, maxLng }.
 */
export function boundingBox(
    lat: number,
    lng: number,
    radiusMiles: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    const latDelta = radiusMiles / 69.0;
    const lngDelta = radiusMiles / (69.0 * Math.cos(lat * Math.PI / 180));

    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
}
