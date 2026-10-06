import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Pharmacy, PharmacyDetails, getPharmacyPhotoUrl } from '../../core/models/pharmacy.model';
import { PharmacyFacade } from '../../domain/facades/pharmacy.facade';
import { RoutingFacade } from '../../domain/facades/routing.facade';
import { isOpenNow } from '../../domain/utils/pharmacy-details.util';
import { CallConfirmModalComponent } from '../../shared/components/call-confirm/call-confirm.modal';

@Component({
  selector: 'app-pharmacy-detail-page',
  templateUrl: './pharmacy-detail.page.html',
  styleUrls: ['./pharmacy-detail.page.scss'],
  standalone: false,
})
export class PharmacyDetailPage implements OnInit, OnDestroy {
  pharmacy: PharmacyDetails | Pharmacy | null = null;
  loading = false;
  hoursOpen = false;
  routeLoading = false;

  private subscription = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly pharmacyFacade: PharmacyFacade,
    private readonly routingFacade: RoutingFacade,
    private readonly modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    this.subscription.add(
      this.pharmacyFacade.pharmacyDetails$.subscribe((details) => {
        if (details && (!id || details.id === id)) {
          this.pharmacy = details;
        }
      })
    );

    this.subscription.add(
      this.pharmacyFacade.detailsLoading$.subscribe((loading) => {
        this.loading = loading;
      })
    );

    this.subscription.add(
      this.routingFacade.loading$.subscribe((loading) => {
        this.routeLoading = loading;
      })
    );

    const selected = this.pharmacyFacade.getSelectedPharmacy();
    if (selected && selected.id === id) {
      this.pharmacy = selected;
      this.pharmacyFacade.loadPharmacyDetails(selected).subscribe();
      return;
    }

    // Chercher dans le catalogue chargé
    this.subscription.add(
      this.pharmacyFacade.pharmacies$.subscribe((list) => {
        const found = list.find((item) => item.id === id);
        if (found && !this.pharmacy) {
          this.pharmacy = found;
          this.pharmacyFacade.selectPharmacy(found);
          this.pharmacyFacade.loadPharmacyDetails(found).subscribe();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get photo(): string {
    return getPharmacyPhotoUrl(this.pharmacy?.photos?.[0]);
  }

  get isFavorite(): boolean {
    return this.pharmacy ? this.pharmacyFacade.isFavorite(this.pharmacy) : false;
  }

  get openLabel(): string {
    if (!this.pharmacy) return '';
    const open = this.pharmacy.isOpenNow ?? isOpenNow(this.pharmacy.openingHours);
    if (open === true) return "Ouvert aujourd'hui";
    if (open === false) return 'Fermé';
    return 'Horaires';
  }

  get openSub(): string {
    const details = this.pharmacy as PharmacyDetails | null;
    return details?.openingHoursSummary || this.pharmacy?.openingHours || 'Non renseignés';
  }

  addressLine(): string {
    if (!this.pharmacy) return '';
    return [this.pharmacy.district, this.pharmacy.city].filter(Boolean).join(', ') || 'Cameroun';
  }

  toggleFavorite(): void {
    if (this.pharmacy) {
      this.pharmacyFacade.toggleFavorite(this.pharmacy);
    }
  }

  toggleHours(): void {
    this.hoursOpen = !this.hoursOpen;
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/tab1');
  }

  async call(): Promise<void> {
    if (!this.pharmacy?.phone) return;
    const modal = await this.modalCtrl.create({
      component: CallConfirmModalComponent,
      cssClass: 'call-confirm-modal',
      componentProps: {
        pharmacyName: this.pharmacy.name,
        phone: this.pharmacy.phone,
      },
    });
    await modal.present();
  }

  goRoute(): void {
    if (!this.pharmacy) return;
    this.pharmacyFacade.selectPharmacy(this.pharmacy);
    this.routingFacade.calculateRoute(this.pharmacy).subscribe({
      next: () => void this.router.navigate(['/route', this.pharmacy!.id]),
    });
  }
}
