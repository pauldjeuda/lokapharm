/**
 * Modèle canonique Lokaphar — données officielles MINSANTE / DPML.
 * Source unique : base locale (JSON embarqué ou API back-end).
 */

/** Image affichée lorsque `photo_url` est vide ou invalide. */
export const DEFAULT_PHARMACY_PHOTO = 'assets/default-pharma.svg';

export interface Pharmacy {
  id: string;
  name: string;
  phone: string | null;
  opening_hours: string | null;
  city: string;
  quarter: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
}

/** Pharmacie enrichie après calcul de proximité (Haversine). */
export interface PharmacyWithDistance extends Pharmacy {
  distance_meters: number;
}

/**
 * Retourne l'URL photo de la pharmacie ou l'image par défaut.
 */
export function getPharmacyPhotoUrl(photoUrl: string | null | undefined): string {
  const trimmed = photoUrl?.trim();
  return trimmed ? trimmed : DEFAULT_PHARMACY_PHOTO;
}
