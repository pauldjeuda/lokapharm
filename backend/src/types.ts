export type PharmacySource = 'minsante' | 'osm' | 'merged';

export interface Pharmacy {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  district?: string;
  phone?: string;
  openingHours?: string;
  website?: string;
  email?: string;
  operator?: string;
  description?: string;
  wheelchair?: string;
  wikidata?: string;
  postcode?: string;
  photos?: string[];
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  source?: PharmacySource;
  isOnCall?: boolean;
  isOpen24h?: boolean;
  isOpenNow?: boolean;
}

export interface PharmacyQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  city?: 'yaounde' | 'douala' | 'nearby';
  onCall?: boolean;
  openNow?: boolean;
  open24h?: boolean;
  maxDistanceKm?: number;
  q?: string;
  limit?: number;
}

export interface PharmacyListResponse {
  pharmacies: Pharmacy[];
  meta: {
    total: number;
    source: PharmacySource | 'none';
    fromCache: boolean;
    partial: boolean;
    minsanteCount: number;
    osmCount: number;
    fetchedAt: string;
    radiusKm: number;
  };
}
