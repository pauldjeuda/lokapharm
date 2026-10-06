import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { VisitHistoryPage } from './visit-history.page';

const routes: Routes = [{ path: '', component: VisitHistoryPage }];

@NgModule({
  imports: [CommonModule, IonicModule, SharedModule, RouterModule.forChild(routes)],
  declarations: [VisitHistoryPage],
})
export class VisitHistoryPageModule {}
