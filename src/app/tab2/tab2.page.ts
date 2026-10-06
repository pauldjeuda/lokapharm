import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Pharmacy } from '../core/models/pharmacy.model';
import { PharmacyFacade, ListChipFilter } from '../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../domain/facades/routing.facade';
import { isOpenNow } from '../domain/utils/pharmacy-details.util';
import { MapFiltersState } from '../shared/components/filters-sheet/filters-sheet.component';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  pharmacies: Pharmacy[] = [];
  loading = false;
  searchQuery = '';
  activeChip: ListChipFilter = 'all';
  filtersOpen = false;
  mapFilters: MapFiltersState = {
    onCall: false,
    open24h: false,
    maxDistanceKm: null,
    sortBy: 'distance',
  };

  readonly chips: { id: ListChipFilter; label: string }[] = [
    { id: 'all', label: 'Toutes' },
    { id: 'onCall', label: 'De garde' },
    { id: 'openNow', label: 'Ouvert maintenant' },
    { id: 'nearest', label: 'Plus proches' },
  ];

  private subscription = new Subscription();

  constructor(
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.pharmacyFacade.listPharmacies$.subscribe((pharmacies) => {
        this.pharmacies = pharmacies;
      })
    );

    this.subscription.add(
      this.pharmacyFacade.loading$.subscribe((loading) => {
        this.loading = loading;
      })
    );

    this.subscription.add(
      this.pharmacyFacade.listChip$.subscribe((chip) => {
        this.activeChip = chip;
      })
    );

    this.pharmacyFacade.refreshPharmacies().subscribe();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.pharmacyFacade.setSearchQuery(value);
  }

  setChip(chip: ListChipFilter): void {
    this.pharmacyFacade.setListChip(chip);
  }

  openFilters(): void {
    this.filtersOpen = true;
  }

  closeFilters(): void {
    this.filtersOpen = false;
  }

  applyFilters(filters: MapFiltersState): void {
    this.mapFilters = filters;
    this.pharmacyFacade.setMapFilters(filters);
    this.filtersOpen = false;
  }

  openPharmacy(pharmacy: Pharmacy): void {
    this.pharmacyFacade.selectPharmacy(pharmacy);
    this.pharmacyFacade.loadPharmacyDetails(pharmacy).subscribe();
    void this.router.navigate(['/pharmacy', pharmacy.id]);
  }

  goDirections(pharmacy: Pharmacy, event: Event): void {
    event.stopPropagation();
    this.pharmacyFacade.selectPharmacy(pharmacy);
    this.routingFacade.calculateRoute(pharmacy).subscribe({
      next: () => void this.router.navigate(['/route', pharmacy.id]),
      error: () => void this.router.navigate(['/route', pharmacy.id]),
    });
  }

  callPharmacy(pharmacy: Pharmacy, event: Event): void {
    event.stopPropagation();
    if (!pharmacy.phone) {
      return;
    }
    const phone = pharmacy.phone.replace(/\s+/g, '');
    window.open(`tel:${phone}`, '_system');
  }

  isOpen(pharmacy: Pharmacy): boolean | undefined {
    if (pharmacy.isOpenNow != null) {
      return pharmacy.isOpenNow;
    }
    return isOpenNow(pharmacy.openingHours);
  }

  isOnCall(pharmacy: Pharmacy): boolean {
    return Boolean(pharmacy.isOnCall);
  }

  addressLine(pharmacy: Pharmacy): string {
    return (
      [pharmacy.district, pharmacy.address || pharmacy.city].filter(Boolean).join(', ') ||
      pharmacy.city ||
      'Cameroun'
    );
  }

  trackById(_: number, pharmacy: Pharmacy): string {
    return pharmacy.id;
  }

  doRefresh(event: CustomEvent): void {
    this.pharmacyFacade.refreshPharmacies().subscribe({
      complete: () => (event.target as HTMLIonRefresherElement).complete(),
      error: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }
}
