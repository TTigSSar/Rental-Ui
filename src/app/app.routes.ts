import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'listings' },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/routes').then((m) => m.authRoutes),
  },
  {
    path: 'listings',
    loadChildren: () =>
      import('./features/listings').then((m) => m.listingsRoutes),
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile').then((m) => m.profileRoutes),
  },
  {
    path: 'my-listings',
    loadChildren: () =>
      import('./features/my-listings').then((m) => m.myListingsRoutes),
  },
];
