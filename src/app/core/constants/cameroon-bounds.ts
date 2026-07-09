export const CAMEROON_BOUNDS = {
  south: 1.65,
  north: 13.08,
  west: 8.49,
  east: 16.19,
};

export const DEFAULT_CENTER = {
  lat: 3.848,
  lng: 11.5021,
};

export interface CityBounds {
  south: number;
  west: number;
  north: number;
  east: number;
  center: { lat: number; lng: number };
}

export const CITY_BOUNDS: Record<'yaounde' | 'douala', CityBounds> = {
  yaounde: {
    south: 3.72,
    west: 11.42,
    north: 3.92,
    east: 11.58,
    center: { lat: 3.848, lng: 11.502 },
  },
  douala: {
    south: 4.0,
    west: 9.65,
    north: 4.12,
    east: 9.78,
    center: { lat: 4.051, lng: 9.708 },
  },
};

/** ~5 km — clé de cache par zone */
export const LOCATION_GRID_STEP = 0.05;

export function toLocationGridKey(lat: number, lng: number): string {
  const gridLat = Math.round(lat / LOCATION_GRID_STEP) * LOCATION_GRID_STEP;
  const gridLng = Math.round(lng / LOCATION_GRID_STEP) * LOCATION_GRID_STEP;
  return `${gridLat.toFixed(2)}_${gridLng.toFixed(2)}`;
}
