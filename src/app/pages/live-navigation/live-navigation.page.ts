import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Pharmacy } from '../../core/models/pharmacy.model';
import { NavigationFacade } from '../../domain/facades/navigation.facade';
import { PharmacyFacade } from '../../domain/facades/pharmacy.facade';
import { VisitHistoryFacade } from '../../domain/facades/visit-history.facade';

@Component({
  selector: 'app-live-navigation',
  templateUrl: './live-navigation.page.html',
  styleUrls: ['./live-navigation.page.scss'],
  standalone: false,
})
export class LiveNavigationPage implements OnInit, OnDestroy {
  pharmacy: Pharmacy | null = null;
  remainingDistance: number | null = null;
  remainingDuration: number | null = null;
  instruction = 'Continuez tout droit';

  private subscription = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly navigationFacade: NavigationFacade,
    private readonly visits: VisitHistoryFacade
  ) {}

  ngOnInit(): void {
    document.body.classList.add('navigation-active');

    this.subscription.add(
      this.pharmacyFacade.selectedPharmacy$.subscribe((pharmacy) => {
        this.pharmacy = pharmacy;
      })
    );
    this.subscription.add(
      this.navigationFacade.remainingDistance$.subscribe((d) => {
        this.remainingDistance = d;
        if (d != null && d < 40 && this.pharmacy) {
          this.arrive();
        }
      })
    );
    this.subscription.add(
      this.navigationFacade.remainingDuration$.subscribe((d) => {
        this.remainingDuration = d;
      })
    );

    this.instruction = this.pharmacy
      ? `Direction ${this.pharmacy.name}`
      : 'Navigation en cours';
  }

  ngOnDestroy(): void {
    document.body.classList.remove('navigation-active');
    this.subscription.unsubscribe();
  }

  quit(): void {
    this.navigationFacade.stopNavigation();
    void this.router.navigateByUrl('/tabs/tab1');
  }

  private arrive(): void {
    if (!this.pharmacy) return;
    this.visits.recordVisit(this.pharmacy, {
      distanceMeters: this.remainingDistance ?? undefined,
      durationSeconds: this.remainingDuration ?? undefined,
    });
    this.navigationFacade.stopNavigation();
    void this.router.navigate(['/arrival', this.pharmacy.id], { replaceUrl: true });
  }

  get etaLabel(): string {
    if (this.remainingDuration == null) return '--:--';
    const date = new Date(Date.now() + this.remainingDuration * 1000);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
