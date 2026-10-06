import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { RoutePreviewPage } from './route-preview.page';

const routes: Routes = [{ path: '', component: RoutePreviewPage }];

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, RouterModule.forChild(routes)],
  declarations: [RoutePreviewPage],
})
export class RoutePreviewPageModule {}
