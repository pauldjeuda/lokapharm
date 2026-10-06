import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-health-disclaimer',
  templateUrl: './health-disclaimer.component.html',
  styleUrls: ['./health-disclaimer.component.scss'],
  standalone: false,
})
export class HealthDisclaimerComponent {
  constructor(private readonly modalCtrl: ModalController) {}

  accept(): void {
    void this.modalCtrl.dismiss({ accepted: true });
  }
}
