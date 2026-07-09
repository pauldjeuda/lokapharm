import { GeoPoint } from '../../core/models/geo-point.model';
import { RouteProfile, RouteResult } from '../../core/models/route.model';
import { haversineDistance } from './distance.util';

const PROFILE_SPEED_MPS: Record<RouteProfile, number> = {
  driving: 11.1, // ~40 km/h en ville
  foot: 1.4,
};

export function buildPreviewRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  profile: RouteProfile
): RouteResult {
  const distanceMeters = haversineDistance(origin, destination);

  return {
    distanceMeters,
    durationSeconds: distanceMeters / PROFILE_SPEED_MPS[profile],
    geometry: [origin, destination],
    profile,
    isPreview: true,
  };
}

export function buildRouteCacheKey(
  origin: GeoPoint,
  destination: GeoPoint,
  profile: RouteProfile
): string {
  return [
    origin.lat.toFixed(4),
    origin.lng.toFixed(4),
    destination.lat.toFixed(4),
    destination.lng.toFixed(4),
    profile,
  ].join('|');
}
