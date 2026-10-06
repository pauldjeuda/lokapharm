import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LiveNavigationPage } from './live-navigation.page';

const routes: Routes = [{ path: '', component: LiveNavigationPage }];

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, RouterModule.forChild(routes)],
  declarations: [LiveNavigationPage],
})
export class LiveNavigationPageModule {}
