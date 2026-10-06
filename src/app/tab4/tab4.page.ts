import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CacheService } from '../core/services/cache.service';
import { LegalModalComponent } from '../shared/components/legal-modal/legal-modal.component';

const ONBOARDING_KEY = 'Lokapharm_onboarding_done_v1';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page {
  readonly appVersion = environment.app.version;
  readonly supportEmail = environment.app.supportEmail;
  readonly websiteUrl = environment.app.websiteUrl;

  distanceUnit: 'km' | 'mi' = 'km';
  language = 'Français';
  onCallAlerts = true;
  darkTheme = false;

  displayName = 'Utilisateur local';
  displayEmail = 'Données stockées sur cet appareil';

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly router: Router,
    private readonly cache: CacheService
  ) {}

  toggleDarkTheme(enabled: boolean): void {
    this.darkTheme = enabled;
    document.documentElement.classList.toggle('dark', enabled);
    document.body.classList.toggle('dark', enabled);
  }

  async openLegal(doc: 'privacy' | 'terms'): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: LegalModalComponent,
      componentProps: { doc },
    });
    await modal.present();
  }

  openExternalUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openSupportEmail(): void {
    window.open(`mailto:${this.supportEmail}?subject=Support%20LokaPharm`, '_system');
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.cache.set(ONBOARDING_KEY, false));
    await this.router.navigateByUrl('/onboarding', { replaceUrl: true });
  }
}
