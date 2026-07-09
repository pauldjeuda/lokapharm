import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

type LegalSection = 'about' | 'privacy' | 'terms';

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
  readonly privacyPolicyUrl = environment.app.privacyPolicyUrl;
  readonly termsUrl = environment.app.termsUrl;

  activeSection: LegalSection = 'about';

  setSection(section: LegalSection): void {
    this.activeSection = section;
  }

  openExternalUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openSupportEmail(): void {
    window.open(`mailto:${this.supportEmail}?subject=Support%20Lokaphar`, '_system');
  }
}
