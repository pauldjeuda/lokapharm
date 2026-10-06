import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Storage } from '@ionic/storage-angular';
import { GeolocationService } from '../../core/services/geolocation.service';

const LOCATION_RATIONALE_KEY = 'Lokapharm_location_rationale_accepted';

@Component({
  selector: 'app-location-permission',
  templateUrl: './location-permission.page.html',
  styleUrls: ['./location-permission.page.scss'],
  standalone: false,
})
export class LocationPermissionPage {
  loading = false;

  constructor(
    private readonly router: Router,
    private readonly geolocation: GeolocationService,
    private readonly storage: Storage
  ) {}

  async enable(): Promise<void> {
    this.loading = true;
    try {
      await this.storage.create();
      await this.storage.set(LOCATION_RATIONALE_KEY, true);
      await this.geolocation.requestPermission();
    } finally {
      this.loading = false;
      await this.goApp();
    }
  }

  async skip(): Promise<void> {
    await this.goApp();
  }

  private async goApp(): Promise<void> {
    await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
  }
}
