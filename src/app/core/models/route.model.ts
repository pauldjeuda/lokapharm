import { GeoPoint } from './geo-point.model';

export type RouteProfile = 'driving' | 'foot';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoPoint[];
  profile: RouteProfile;
  isPreview?: boolean;
}
