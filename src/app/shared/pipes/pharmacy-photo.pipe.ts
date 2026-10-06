import { Pipe, PipeTransform } from '@angular/core';
import { DEFAULT_PHARMACY_PHOTO, getPharmacyPhotoUrl } from '../../core/models/pharmacy.model';

/**
 * Affiche une URL photo ou l'image par défaut (`assets/default-pharma.svg`).
 *
 * Usage : `[src]="pharmacy.photos?.[0] | pharmacyPhoto"`
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
