import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'listings' },
  {
    path: 'listings',
    loadChildren: () =>
      import('./features/listings').then((m) => m.listingsRoutes),
  },
];
