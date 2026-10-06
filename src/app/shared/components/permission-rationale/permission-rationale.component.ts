import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-permission-rationale',
  templateUrl: './permission-rationale.component.html',
  styleUrls: ['./permission-rationale.component.scss'],
  standalone: false,
})
export class PermissionRationaleComponent {
  constructor(private readonly modalController: ModalController) {}

  accept(): void {
    void this.modalController.dismiss(true);
  }

  decline(): void {
    void this.modalController.dismiss(false);
  }
}
