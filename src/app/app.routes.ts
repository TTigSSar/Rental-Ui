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
  {
    path: 'bookings',
    loadChildren: () =>
      import('./features/bookings').then((m) => m.bookingsRoutes),
  },
  {
    path: 'favorites',
    loadChildren: () =>
      import('./features/favorites').then((m) => m.favoritesRoutes),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin').then((m) => m.adminRoutes),
  },
];
