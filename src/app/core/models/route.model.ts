import { GeoPoint } from './geo-point.model';

export type RouteProfile = 'driving' | 'foot';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoPoint[];
  profile: RouteProfile;
  isPreview?: boolean;
  steps?: RouteStep[];
}
