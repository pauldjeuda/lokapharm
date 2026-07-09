import { Pharmacy as CorePharmacy } from '../core/models/pharmacy.model';
import { Pharmacy, PharmacyWithDistance } from './pharmacy.model';

/** Convertit le modèle MINSANTE vers le modèle UI existant (Leaflet, facades). */
export function toCorePharmacy(pharmacy: Pharmacy | PharmacyWithDistance): CorePharmacy {
  const distanceMeters = 'distance_meters' in pharmacy ? pharmacy.distance_meters : undefined;

  return {
    id: pharmacy.id,
    name: pharmacy.name,
    lat: pharmacy.latitude,
    lng: pharmacy.longitude,
    phone: pharmacy.phone ?? undefined,
    openingHours: pharmacy.opening_hours ?? undefined,
    city: pharmacy.city,
    district: pharmacy.quarter,
    photos: pharmacy.photo_url ? [pharmacy.photo_url] : [],
    distanceMeters,
    source: 'minsante',
  };
}

export function toCorePharmacies(pharmacies: PharmacyWithDistance[]): CorePharmacy[] {
  return pharmacies.map(toCorePharmacy);
}
