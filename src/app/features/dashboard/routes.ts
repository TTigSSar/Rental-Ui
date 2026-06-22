import type { Routes } from '@angular/router';

export const dashboardRoutes: Routes = [
  {
    path: 'rentals',
    loadComponent: () =>
      import('./pages/my-rentals/my-rentals.component').then((m) => m.MyRentalsComponent),
  },
  {
    path: 'requests',
    loadComponent: () =>
      import('./pages/incoming-requests/incoming-requests.component').then((m) => m.IncomingRequestsComponent),
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./pages/favorites/favorites-page.component').then((m) => m.FavoritesPageComponent),
  },
  {
    path: 'my-toys',
    loadComponent: () =>
      import('./pages/my-toys/my-toys.component').then((m) => m.MyToysComponent),
  },
  { path: '', redirectTo: 'rentals', pathMatch: 'full' },
];
