import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { OnboardingPage } from './onboarding.page';

const routes: Routes = [{ path: '', component: OnboardingPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [OnboardingPage],
})
export class OnboardingPageModule {}
