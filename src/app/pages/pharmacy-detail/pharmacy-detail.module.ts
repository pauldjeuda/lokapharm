import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PharmacyDetailPage } from './pharmacy-detail.page';

const routes: Routes = [{ path: '', component: PharmacyDetailPage }];

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, RouterModule.forChild(routes)],
  declarations: [PharmacyDetailPage],
})
export class PharmacyDetailPageModule {}
