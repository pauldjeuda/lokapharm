import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-call-confirm-modal',
  template: `
    <div class="call-modal">
      <img src="assets/icon/Lokapharm-logo.png" alt="" class="app-logo app-logo--sm" />
      <h2>Appeler la pharmacie ?</h2>
      <p class="name">{{ pharmacyName }}</p>
      <p class="phone">{{ phone }}</p>
      <button type="button" class="loka-btn-primary full" (click)="confirm()">Appeler</button>
      <button type="button" class="cancel" (click)="dismiss()">Annuler</button>
    </div>
  `,
  styles: [
    `
      .call-modal {
        padding: 28px 24px;
        text-align: center;
        background: var(--loka-surface-container-lowest);
      }
      h2 {
        margin: 12px 0 8px;
        font-size: 20px;
        font-weight: 600;
      }
      .name {
        margin: 0;
        font-weight: 600;
      }
      .phone {
        margin: 4px 0 20px;
        color: var(--loka-on-surface-variant);
      }
      .full {
        width: 100%;
      }
      .cancel {
        margin-top: 12px;
        border: none;
        background: none;
        color: var(--loka-outline);
        font-weight: 600;
        cursor: pointer;
      }
    `,
  ],
  standalone: false,
})
export class CallConfirmModalComponent {
  @Input() pharmacyName = '';
  @Input() phone = '';

  constructor(private readonly modalCtrl: ModalController) {}

  confirm(): void {
    const cleaned = this.phone.replace(/\s+/g, '');
    window.open(`tel:${cleaned}`, '_system');
    void this.modalCtrl.dismiss(true);
  }

  dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }
}
