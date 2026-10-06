import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { CacheService } from './core/services/cache.service';
import { HealthDisclaimerComponent } from './shared/components/health-disclaimer/health-disclaimer.component';

const DISCLAIMER_KEY = 'Lokapharm_health_disclaimer_v1';
const ONBOARDING_KEY = 'Lokapharm_onboarding_done_v1';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private readonly modalCtrl: ModalController,
    private readonly cache: CacheService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const onboardingDone = await firstValueFrom(this.cache.get<boolean>(ONBOARDING_KEY));
    if (!onboardingDone) {
      await this.router.navigateByUrl('/onboarding', { replaceUrl: true });
      return;
    }

    const accepted = await firstValueFrom(this.cache.get<boolean>(DISCLAIMER_KEY));
    if (accepted) {
      return;
    }

    const modal = await this.modalCtrl.create({
      component: HealthDisclaimerComponent,
      cssClass: 'location-permission-modal',
      backdropDismiss: false,
    });

    await modal.present();
    const { data } = await modal.onDidDismiss<{ accepted?: boolean }>();
    if (data?.accepted) {
      await firstValueFrom(this.cache.set(DISCLAIMER_KEY, true));
    }
  }
}
