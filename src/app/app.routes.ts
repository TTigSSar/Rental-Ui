import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () =>
      import('./features/home').then((m) => m.homeRoutes),
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
    path: 'chat',
    loadChildren: () =>
      import('./features/chat').then((m) => m.chatRoutes),
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
  {
    path: 'users',
    loadChildren: () =>
      import('./features/public-profiles').then((m) => m.usersRoutes),
  },
  {
    path: '',
    loadChildren: () =>
      import('./features/info').then((m) => m.infoRoutes),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard').then((m) => m.dashboardRoutes),
  },
  { path: '**', redirectTo: 'listings' },
];
