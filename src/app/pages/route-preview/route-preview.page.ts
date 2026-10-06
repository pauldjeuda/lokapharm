import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { RouteProfile, RouteResult } from '../../core/models/route.model';
import { NavigationFacade } from '../../domain/facades/navigation.facade';
import { PharmacyFacade } from '../../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../../domain/facades/routing.facade';

@Component({
  selector: 'app-route-preview',
  templateUrl: './route-preview.page.html',
  styleUrls: ['./route-preview.page.scss'],
  standalone: false,
})
export class RoutePreviewPage implements OnInit, OnDestroy {
  pharmacy: Pharmacy | null = null;
  route: RouteResult | null = null;
  loading = false;
  profile: RouteProfile = 'driving';

  private subscription = new Subscription();

  constructor(
    private readonly routeParams: ActivatedRoute,
    private readonly router: Router,
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade,
    private readonly navigationFacade: NavigationFacade
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.pharmacyFacade.selectedPharmacy$.subscribe((pharmacy) => {
        this.pharmacy = pharmacy;
      })
    );
    this.subscription.add(
      this.routingFacade.route$.subscribe((route) => {
        this.route = route;
      })
    );
    this.subscription.add(
      this.routingFacade.loading$.subscribe((loading) => {
        this.loading = loading;
      })
    );
    this.subscription.add(
      this.routingFacade.profile$.subscribe((profile) => {
        this.profile = profile;
      })
    );

    const id = this.routeParams.snapshot.paramMap.get('id');
    const selected = this.pharmacyFacade.getSelectedPharmacy();
    if (!selected || selected.id !== id) {
      this.pharmacyFacade.pharmacies$.subscribe((list) => {
        const found = list.find((item) => item.id === id);
        if (found) {
          this.pharmacyFacade.selectPharmacy(found);
          this.routingFacade.calculateRoute(found, this.profile).subscribe();
        }
      }).unsubscribe();
    } else if (!this.routingFacade.getCurrentRoute()) {
      this.routingFacade.calculateRoute(selected, this.profile).subscribe();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  setProfile(profile: RouteProfile): void {
    this.profile = profile;
    this.routingFacade.setProfile(profile);
    if (this.pharmacy) {
      this.routingFacade.calculateRoute(this.pharmacy, profile).subscribe();
    }
  }

  goBack(): void {
    if (this.pharmacy) {
      void this.router.navigate(['/pharmacy', this.pharmacy.id]);
    } else {
      void this.router.navigateByUrl('/tabs/tab1');
    }
  }

  async startNavigation(): Promise<void> {
    if (!this.pharmacy || !this.route || this.route.isPreview) {
      return;
    }
    await this.navigationFacade.startNavigation(this.pharmacy, this.route);
    await this.router.navigate(['/navigation', this.pharmacy.id]);
  }

  get steps() {
    return this.route?.steps?.length
      ? this.route.steps
      : [
          { instruction: 'Suivez l’itinéraire affiché', distanceMeters: this.route?.distanceMeters ?? 0, durationSeconds: this.route?.durationSeconds ?? 0 },
        ];
  }
}
