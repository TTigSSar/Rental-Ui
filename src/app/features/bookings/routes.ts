import type { Routes } from '@angular/router';

import { authGuard } from '../auth/guards/auth.guard';

export const bookingsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/my-bookings-page/my-bookings-page.component').then(
            (m) => m.MyBookingsPageComponent,
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import(
            './pages/booking-requests-page/booking-requests-page.component'
          ).then((m) => m.BookingRequestsPageComponent),
      },
    ],
  },
];
