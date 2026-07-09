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
}

export interface PharmacyDetails extends Pharmacy {
  fullAddress?: string;
  isOpenNow?: boolean;
  openingHoursSummary?: string;
}
