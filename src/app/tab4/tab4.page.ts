import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { LegalModalComponent } from '../shared/components/legal-modal/legal-modal.component';

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
    private readonly router: Router
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

  openVisitHistory(): void {
    void this.router.navigateByUrl('/visit-history');
  }

  openExternalUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openSupportEmail(): void {
    window.open(`mailto:${this.supportEmail}?subject=Support%20LokaPharm`, '_system');
  }
}
