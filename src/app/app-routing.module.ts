import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'onboarding',
    loadChildren: () =>
      import('./pages/onboarding/onboarding.module').then((m) => m.OnboardingPageModule),
  },
  {
    path: 'location-permission',
    loadChildren: () =>
      import('./pages/location-permission/location-permission.module').then(
        (m) => m.LocationPermissionPageModule
      ),
  },
  {
    path: 'pharmacy/:id',
    loadChildren: () =>
      import('./pages/pharmacy-detail/pharmacy-detail.module').then((m) => m.PharmacyDetailPageModule),
  },
  {
    path: 'route/:id',
    loadChildren: () =>
      import('./pages/route-preview/route-preview.module').then((m) => m.RoutePreviewPageModule),
  },
  {
    path: 'navigation/:id',
    loadChildren: () =>
      import('./pages/live-navigation/live-navigation.module').then((m) => m.LiveNavigationPageModule),
  },
  {
    path: 'arrival/:id',
    loadChildren: () =>
      import('./pages/arrival/arrival.module').then((m) => m.ArrivalPageModule),
  },
  {
    path: 'visit-history',
    loadChildren: () =>
      import('./pages/visit-history/visit-history.module').then((m) => m.VisitHistoryPageModule),
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
