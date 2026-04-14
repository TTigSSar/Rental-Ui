import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { BookingRequest, MyBooking } from '../models/booking.model';
import { bookingsFeatureKey } from './bookings.reducer';
import type { BookingsState } from './bookings.state';

export const selectBookingsState =
  createFeatureSelector<BookingsState>(bookingsFeatureKey);

export const selectMyBookings = createSelector(
  selectBookingsState,
  (state: BookingsState): MyBooking[] => state.myBookings,
);

export const selectCreateBookingLoading = createSelector(
  selectBookingsState,
  (state: BookingsState): boolean => state.createBookingLoading,
);

export const selectCreateBookingError = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.createBookingError,
);

export const selectCreateBookingSuccessId = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.createBookingSuccessId,
);

export const selectMyBookingsLoading = createSelector(
  selectBookingsState,
  (state: BookingsState): boolean => state.myBookingsLoading,
);

export const selectMyBookingsError = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.myBookingsError,
);

export const selectBookingRequests = createSelector(
  selectBookingsState,
  (state: BookingsState): BookingRequest[] => state.bookingRequests,
);

export const selectBookingRequestsLoading = createSelector(
  selectBookingsState,
  (state: BookingsState): boolean => state.bookingRequestsLoading,
);

export const selectBookingRequestsError = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.bookingRequestsError,
);

export const selectBookingRequestActionIds = createSelector(
  selectBookingsState,
  (state: BookingsState): string[] => state.bookingRequestActionIds,
);
