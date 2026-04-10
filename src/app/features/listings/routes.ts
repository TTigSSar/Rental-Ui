import type { Routes } from '@angular/router';

export const listingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/listings-page/listings-page.component').then((m) => m.ListingsPageComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/listing-details-page/listing-details-page.component').then(
        (m) => m.ListingDetailsPageComponent,
      ),
  },
];
