import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { PermissionRationaleComponent } from '../../shared/components/permission-rationale/permission-rationale.component';
import { GeolocationService } from './geolocation.service';

const LOCATION_RATIONALE_KEY = 'lokaphar_location_rationale_accepted';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private storageReady = false;

  constructor(
    private readonly modalController: ModalController,
    private readonly storage: Storage,
    private readonly geolocation: GeolocationService
  ) {
    void this.initStorage();
  }

  async requestLocationAccess(): Promise<boolean> {
    await this.ensureStorageReady();

    const alreadyAccepted = await this.storage.get(LOCATION_RATIONALE_KEY);
    if (!alreadyAccepted) {
      const accepted = await this.showLocationRationale();
      if (!accepted) {
        return false;
      }
      await this.storage.set(LOCATION_RATIONALE_KEY, true);
    }

    return this.geolocation.requestPermission();
  }

  private async showLocationRationale(): Promise<boolean> {
    const modal = await this.modalController.create({
      component: PermissionRationaleComponent,
      cssClass: 'location-permission-modal',
      backdropDismiss: false,
      showBackdrop: true,
    });

    await modal.present();
    const { data } = await modal.onDidDismiss<boolean>();
    return data === true;
  }

  private async initStorage(): Promise<void> {
    if (!this.storageReady) {
      await this.storage.create();
      this.storageReady = true;
    }
  }

  private async ensureStorageReady(): Promise<void> {
    if (!this.storageReady) {
      await this.initStorage();
    }
  }
}
