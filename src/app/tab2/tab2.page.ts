import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Pharmacy } from '../core/models/pharmacy.model';
import { RouteResult } from '../core/models/route.model';
import { NavigationFacade } from '../domain/facades/navigation.facade';
import { PharmacyFacade } from '../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../domain/facades/routing.facade';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  selectedPharmacy: Pharmacy | null = null;
  currentRoute: RouteResult | null = null;
  loading = false;
  isNavigating = false;
  remainingDistance: number | null = null;
  remainingDuration: number | null = null;

  private subscription = new Subscription();

  constructor(
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade,
    private readonly navigationFacade: NavigationFacade
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.pharmacyFacade.selectedPharmacy$.subscribe((pharmacy) => {
        this.selectedPharmacy = pharmacy;
      })
    );

    this.subscription.add(
      this.routingFacade.route$.subscribe((route) => {
        this.currentRoute = route;
      })
    );

    this.subscription.add(
      this.routingFacade.loading$.subscribe((loading) => {
        this.loading = loading;
      })
    );

    this.subscription.add(
      this.navigationFacade.navigating$.subscribe((navigating) => {
        this.isNavigating = navigating;
      })
    );

    this.subscription.add(
      this.navigationFacade.remainingDistance$.subscribe((distance) => {
        this.remainingDistance = distance;
      })
    );

    this.subscription.add(
      this.navigationFacade.remainingDuration$.subscribe((duration) => {
        this.remainingDuration = duration;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  async startNavigation(): Promise<void> {
    if (!this.selectedPharmacy || !this.currentRoute) {
      return;
    }

    await this.navigationFacade.startNavigation(this.selectedPharmacy, this.currentRoute);
  }

  stopNavigation(): void {
    this.navigationFacade.stopNavigation();
  }
}
