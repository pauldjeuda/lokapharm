import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Pharmacy, getPharmacyPhotoUrl } from '../core/models/pharmacy.model';
import { PharmacyFacade } from '../domain/facades/pharmacy.facade';
import { isOpenNow } from '../domain/utils/pharmacy-details.util';

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
    private readonly router: Router,
    private readonly alertCtrl: AlertController
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

  get countLabel(): string {
    const n = this.favorites.length;
    return n === 1 ? '1 enregistrée' : `${n} enregistrées`;
  }

  photoUrl(pharmacy: Pharmacy): string {
    return getPharmacyPhotoUrl(pharmacy.photos?.[0]);
  }

  isOpen(pharmacy: Pharmacy): boolean | undefined {
    if (pharmacy.isOpenNow != null) {
      return pharmacy.isOpenNow;
    }
    return isOpenNow(pharmacy.openingHours);
  }

  addressLine(pharmacy: Pharmacy): string {
    return [pharmacy.district, pharmacy.city || pharmacy.address].filter(Boolean).join(', ')
      || 'Cameroun';
  }

  selectFavorite(pharmacy: Pharmacy): void {
    this.pharmacyFacade.selectPharmacy(pharmacy);
    this.pharmacyFacade.loadPharmacyDetails(pharmacy).subscribe();
    void this.router.navigate(['/pharmacy', pharmacy.id]);
  }

  async confirmRemove(pharmacy: Pharmacy, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Retirer de vos favoris ?',
      message: `Êtes-vous sûr de vouloir retirer ${pharmacy.name} de vos favoris ?`,
      cssClass: 'loka-alert',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Confirmer',
          role: 'destructive',
          handler: () => this.pharmacyFacade.toggleFavorite(pharmacy),
        },
      ],
    });
    await alert.present();
  }

  exploreList(): void {
    void this.router.navigate(['/tab2']);
  }
}
