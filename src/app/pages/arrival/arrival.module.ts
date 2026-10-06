import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ArrivalPage } from './arrival.page';

const routes: Routes = [{ path: '', component: ArrivalPage }];

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, RouterModule.forChild(routes)],
  declarations: [ArrivalPage],
})
export class ArrivalPageModule {}
