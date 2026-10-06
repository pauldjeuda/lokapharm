import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { LocationPermissionPage } from './location-permission.page';

const routes: Routes = [{ path: '', component: LocationPermissionPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [LocationPermissionPage],
})
export class LocationPermissionPageModule {}
