import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { VisitHistoryFacade, VisitRecord } from '../../domain/facades/visit-history.facade';
import { PharmacyFacade } from '../../domain/facades/pharmacy.facade';
import { getPharmacyPhotoUrl } from '../../core/models/pharmacy.model';

@Component({
  selector: 'app-visit-history',
  templateUrl: './visit-history.page.html',
  styleUrls: ['./visit-history.page.scss'],
  standalone: false,
})
export class VisitHistoryPage implements OnInit, OnDestroy {
  visits: VisitRecord[] = [];
  private subscription = new Subscription();

  constructor(
    private readonly visitsFacade: VisitHistoryFacade,
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.visitsFacade.visits$.subscribe((visits) => {
        this.visits = visits;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  photo(visit: VisitRecord): string {
    return getPharmacyPhotoUrl(visit.photoUrl);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  openDetails(visit: VisitRecord): void {
    this.pharmacyFacade.pharmacies$.subscribe((list) => {
      const found = list.find((item) => item.id === visit.pharmacyId);
      if (found) {
        this.pharmacyFacade.selectPharmacy(found);
        void this.router.navigate(['/pharmacy', found.id]);
      }
    }).unsubscribe();
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/tab4');
  }

  markReview(visit: VisitRecord): void {
    this.visitsFacade.markReviewed(visit.id);
  }
}
