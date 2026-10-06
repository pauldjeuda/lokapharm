import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { PharmacyFacade } from '../../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../../domain/facades/routing.facade';

@Component({
  selector: 'app-arrival',
  templateUrl: './arrival.page.html',
  styleUrls: ['./arrival.page.scss'],
  standalone: false,
})
export class ArrivalPage implements OnInit {
  pharmacy: Pharmacy | null = null;
  distance: number | null = null;
  duration: number | null = null;
  readonly now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  constructor(
    private readonly router: Router,
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade
  ) {}

  ngOnInit(): void {
    this.pharmacy = this.pharmacyFacade.getSelectedPharmacy();
    const route = this.routingFacade.getCurrentRoute();
    this.distance = route?.distanceMeters ?? this.pharmacy?.distanceMeters ?? null;
    this.duration = route?.durationSeconds ?? null;
  }

  get isFavorite(): boolean {
    return this.pharmacy ? this.pharmacyFacade.isFavorite(this.pharmacy) : false;
  }

  toggleFavorite(): void {
    if (this.pharmacy) {
      this.pharmacyFacade.toggleFavorite(this.pharmacy);
    }
  }

  backToMap(): void {
    void this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  }

  leaveReview(): void {
    void this.router.navigateByUrl('/visit-history');
  }
}
