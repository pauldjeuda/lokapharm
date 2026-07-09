import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Pharmacy } from '../core/models/pharmacy.model';
import { PharmacyFacade } from '../domain/facades/pharmacy.facade';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit, OnDestroy {
  favorites: Pharmacy[] = [];
  private subscription = new Subscription();

  constructor(
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.pharmacyFacade.favorites$.subscribe((favorites) => {
        this.favorites = favorites;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  removeFavorite(pharmacy: Pharmacy): void {
    this.pharmacyFacade.toggleFavorite(pharmacy);
  }

  selectFavorite(pharmacy: Pharmacy): void {
    this.pharmacyFacade.selectPharmacy(pharmacy);
    void this.router.navigate(['/tab1']);
  }
}
