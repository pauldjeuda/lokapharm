import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FiltersSheetComponent } from './components/filters-sheet/filters-sheet.component';
import { CallConfirmModalComponent } from './components/call-confirm/call-confirm.modal';
import { DistancePipe } from './pipes/distance.pipe';
import { DurationPipe } from './pipes/duration.pipe';
import { PharmacyPhotoPipe } from './pipes/pharmacy-photo.pipe';

@NgModule({
  declarations: [
    DistancePipe,
    DurationPipe,
    PharmacyPhotoPipe,
    FiltersSheetComponent,
    CallConfirmModalComponent,
  ],
  imports: [CommonModule, IonicModule],
  exports: [
    DistancePipe,
    DurationPipe,
    PharmacyPhotoPipe,
    FiltersSheetComponent,
    CallConfirmModalComponent,
  ],
})
export class SharedModule {}
