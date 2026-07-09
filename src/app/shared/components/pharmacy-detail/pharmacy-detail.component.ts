import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Pharmacy, PharmacyDetails } from '../../../core/models/pharmacy.model';
import {
  buildFullAddress,
  formatCoordinatesAddress,
  formatOpeningHours,
  isOpenNow,
  sourceLabel,
} from '../../../domain/utils/pharmacy-details.util';

@Component({
  selector: 'app-pharmacy-detail',
  templateUrl: './pharmacy-detail.component.html',
  styleUrls: ['./pharmacy-detail.component.scss'],
  standalone: false,
})
export class PharmacyDetailComponent {
  @Input() pharmacy: PharmacyDetails | null = null;
  @Input() loading = false;
  @Input() routeLoading = false;

  @Output() startNavigation = new EventEmitter<void>();
  @Output() call = new EventEmitter<string>();

  activePhotoIndex = 0;

  get fullAddress(): string {
    if (!this.pharmacy) {
      return '';
    }

    return this.pharmacy.fullAddress || buildFullAddress(this.pharmacy) || this.coordinatesLabel;
  }

  get quarterLabel(): string {
    if (this.loading && !this.pharmacy?.district) {
      return 'Identification en cours...';
    }

    return this.pharmacy?.district || 'Non renseigné';
  }

  get cityLabel(): string {
    if (this.loading && !this.pharmacy?.city) {
      return 'Identification en cours...';
    }

    return this.pharmacy?.city || 'Non renseignée';
  }

  get locationLine(): string {
    if (!this.pharmacy) {
      return '';
    }

    if (this.pharmacy.district && this.pharmacy.city) {
      return `${this.pharmacy.district} · ${this.pharmacy.city}`;
    }

    return this.pharmacy.district || this.pharmacy.city || 'Localisation en cours...';
  }

  get coordinatesLabel(): string {
    if (!this.pharmacy) {
      return '';
    }

    return formatCoordinatesAddress(this.pharmacy.lat, this.pharmacy.lng);
  }

  get dataSourceLabel(): string {
    return sourceLabel(this.pharmacy?.source);
  }

  get showCoordinatesHint(): boolean {
    if (!this.pharmacy) {
      return false;
    }

    return (this.pharmacy.source === 'osm' || this.pharmacy.source === 'merged') && !this.pharmacy.address;
  }

  get openingHoursLabel(): string {
    return this.pharmacy?.openingHoursSummary || formatOpeningHours(this.pharmacy?.openingHours);
  }

  get openStatusLabel(): string {
    const open = isOpenNow(this.pharmacy?.openingHours);
    if (open === true) {
      return 'Ouvert maintenant';
    }
    if (open === false) {
      return 'Fermé';
    }
    return 'Horaires à vérifier';
  }

  get openStatusClass(): string {
    const open = isOpenNow(this.pharmacy?.openingHours);
    if (open === true) {
      return 'open';
    }
    if (open === false) {
      return 'closed';
    }
    return 'unknown';
  }

  get photos(): string[] {
    return this.pharmacy?.photos ?? [];
  }

  onStartNavigation(): void {
    this.startNavigation.emit();
  }

  onCall(): void {
    if (this.pharmacy?.phone) {
      this.call.emit(this.pharmacy.phone);
    }
  }

  onOpenWebsite(): void {
    if (!this.pharmacy?.website) {
      return;
    }

    const url = this.pharmacy.website.startsWith('http')
      ? this.pharmacy.website
      : `https://${this.pharmacy.website}`;
    window.open(url, '_blank');
  }

  selectPhoto(index: number): void {
    this.activePhotoIndex = index;
  }
}
