import { Pipe, PipeTransform } from '@angular/core';
import { DEFAULT_PHARMACY_PHOTO, getPharmacyPhotoUrl } from '../../models/pharmacy.model';

/**
 * Affiche `photo_url` ou l'image par défaut (`assets/default-pharma.svg`).
 *
 * Usage : `{{ pharmacy.photo_url | pharmacyPhoto }}`
 *         `[src]="pharmacy.photos[0] | pharmacyPhoto"`
 */
@Pipe({
  name: 'pharmacyPhoto',
  standalone: false,
})
export class PharmacyPhotoPipe implements PipeTransform {
  transform(photoUrl: string | null | undefined): string {
    return getPharmacyPhotoUrl(photoUrl);
  }
}

export { DEFAULT_PHARMACY_PHOTO };
