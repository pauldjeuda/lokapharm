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

/** Image displayed when a pharmacy does not provide a usable photo. */
export const DEFAULT_PHARMACY_PHOTO = 'assets/default-pharma.svg';

/** Returns a pharmacy photo URL or the bundled fallback image. */
export function getPharmacyPhotoUrl(photoUrl: string | null | undefined): string {
  const trimmed = photoUrl?.trim();
  return trimmed ? trimmed : DEFAULT_PHARMACY_PHOTO;
}
