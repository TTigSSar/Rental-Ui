import type { Routes } from '@angular/router';
import { authGuard } from '../auth/guards/auth.guard';

export const listingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/listings-page/listings-page.component').then((m) => m.ListingsPageComponent),
  },
  {
    path: 'create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/create-listing-page/create-listing-page.component').then(
        (m) => m.CreateListingPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/listing-details-page/listing-details-page.component').then(
        (m) => m.ListingDetailsPageComponent,
      ),
  },
];
