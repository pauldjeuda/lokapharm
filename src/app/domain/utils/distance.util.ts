import { GeoPoint } from '../../core/models/geo-point.model';

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistance(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function sortByDistance<T extends { distanceMeters?: number }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
  );
}

export function findClosestRouteIndex(user: GeoPoint, route: GeoPoint[]): number {
  if (!route.length) {
    return 0;
  }

  let closestIndex = 0;
  let minDistance = Infinity;

  for (let index = 0; index < route.length; index++) {
    const distance = haversineDistance(user, route[index]);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export function remainingRouteDistance(user: GeoPoint, route: GeoPoint[]): number {
  if (!route.length) {
    return 0;
  }

  const closestIndex = findClosestRouteIndex(user, route);

  let remaining = haversineDistance(user, route[closestIndex]);
  for (let index = closestIndex; index < route.length - 1; index++) {
    remaining += haversineDistance(route[index], route[index + 1]);
  }

  return remaining;
}

export function formatDistance(meters?: number | null): string {
  if (meters == null) {
    return '—';
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null) {
    return '—';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} h ${remaining} min`;
}
