import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-legal-modal',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Fermer</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="legal-body" [innerHTML]="html"></div>
    </ion-content>
  `,
  styles: [
    `
      .legal-body {
        font-size: 14px;
        line-height: 1.55;
        color: var(--loka-on-surface, #191c1d);
      }
    `,
  ],
  standalone: false,
})
export class LegalModalComponent implements OnInit {
  @Input() doc: 'privacy' | 'terms' = 'privacy';

  title = 'Informations légales';
  html: SafeHtml = '';

  constructor(
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer,
    private readonly modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    this.title = this.doc === 'terms' ? "Conditions d'utilisation" : 'Politique de confidentialité';
    const path = this.doc === 'terms' ? 'assets/legal/terms.html' : 'assets/legal/privacy.html';

    this.http.get(path, { responseType: 'text' }).subscribe({
      next: (raw) => {
        const body = raw.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
        this.html = this.sanitizer.bypassSecurityTrustHtml(body);
      },
      error: () => {
        this.html = this.sanitizer.bypassSecurityTrustHtml(
          '<p>Document indisponible. Contactez contact@Lokapharm.cm</p>'
        );
      },
    });
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }
}
