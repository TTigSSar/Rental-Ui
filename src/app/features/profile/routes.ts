import type { Routes } from '@angular/router';

import { authGuard } from '../auth/guards/auth.guard';

export const profileRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/profile-page/profile-page.component').then(
        (m) => m.ProfilePageComponent,
      ),
    children: [
      {
        path: 'toys',
        loadComponent: () =>
          import('../my-listings/pages/my-listings-page/my-listings-page.component').then(
            (m) => m.MyListingsPageComponent,
          ),
      },
      {
        path: 'rentals',
        loadComponent: () =>
          import('../bookings/pages/my-bookings-page/my-bookings-page.component').then(
            (m) => m.MyBookingsPageComponent,
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('../bookings/pages/booking-requests-page/booking-requests-page.component').then(
            (m) => m.BookingRequestsPageComponent,
          ),
      },
      {
        path: 'saved',
        loadComponent: () =>
          import('../favorites/pages/favorites-page/favorites-page.component').then(
            (m) => m.FavoritesPageComponent,
          ),
      },
    ],
  },
];
