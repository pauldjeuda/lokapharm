import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PharmacyDetailComponent } from './components/pharmacy-detail/pharmacy-detail.component';
import { MapModesSheetComponent } from './components/map-modes-sheet/map-modes-sheet.component';
import { DistancePipe } from './pipes/distance.pipe';
import { DurationPipe } from './pipes/duration.pipe';
import { PharmacyPhotoPipe } from './pipes/pharmacy-photo.pipe';

@NgModule({
  declarations: [DistancePipe, DurationPipe, PharmacyPhotoPipe, PharmacyDetailComponent, MapModesSheetComponent],
  imports: [CommonModule, IonicModule],
  exports: [DistancePipe, DurationPipe, PharmacyPhotoPipe, PharmacyDetailComponent, MapModesSheetComponent],
})
export class SharedModule {}
