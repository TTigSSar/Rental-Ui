import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
import { BookingsEffects } from './store/bookings.effects';
import { bookingsFeatureKey, bookingsReducer } from './store/bookings.reducer';

export const bookingsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    providers: [provideState(bookingsFeatureKey, bookingsReducer), provideEffects(BookingsEffects)],
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
      {
        path: ':bookingId',
        loadComponent: () =>
          import('./pages/booking-details-page/booking-details-page.component').then(
            (m) => m.BookingDetailsPageComponent,
          ),
      },
      {
        path: ':bookingId/review',
        loadComponent: () =>
          import(
            './pages/submit-review-page/submit-review-page.component'
          ).then((m) => m.SubmitReviewPageComponent),
      },
      {
        path: ':bookingId/review/renter',
        loadComponent: () =>
          import(
            './pages/rate-renter-page/rate-renter-page.component'
          ).then((m) => m.RateRenterPageComponent),
      },
    ],
  },
];
