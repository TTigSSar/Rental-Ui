import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { BookingDetail, BookingRequest, BookingStatus, MyBooking } from '../models/booking.model';

import { bookingsFeatureKey } from './bookings.reducer';
import type { BookingsState } from './bookings.state';

const STATUS_DISPLAY_PRIORITY: Partial<Record<BookingStatus, number>> = {
  Active: 6,
  Approved: 5,
  PendingApproval: 4,
  Pending: 3,
  ReturnMarked: 2,
  Completed: 1,
  Rejected: 0,
  Cancelled: 0,
};

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

export const selectMyBookingById = (bookingId: string) =>
  createSelector(
    selectMyBookings,
    (bookings): MyBooking | null =>
      bookings.find((b) => b.id === bookingId) ?? null,
  );

export const selectBookingDetail = createSelector(
  selectBookingsState,
  (state: BookingsState): BookingDetail | null => state.bookingDetail,
);

export const selectBookingDetailLoading = createSelector(
  selectBookingsState,
  (state: BookingsState): boolean => state.bookingDetailLoading,
);

export const selectBookingDetailError = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.bookingDetailError,
);

export const selectBookingActionPending = createSelector(
  selectBookingsState,
  (state: BookingsState): boolean => state.bookingActionPending,
);

export const selectBookingActionError = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.bookingActionError,
);

export const selectCancelBookingPending = createSelector(
  selectBookingsState,
  (state: BookingsState): boolean => state.cancelBookingPending,
);

export const selectCancelBookingError = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.cancelBookingError,
);

export const selectCancelBookingSuccessId = createSelector(
  selectBookingsState,
  (state: BookingsState): string | null => state.cancelBookingSuccessId,
);

export const selectMyBookingForListing = (listingId: string) =>
  createSelector(
    selectMyBookings,
    (bookings): MyBooking | null => {
      let best: MyBooking | null = null;
      for (const b of bookings) {
        if (b.listingId !== listingId) continue;
        const priority = STATUS_DISPLAY_PRIORITY[b.status] ?? -1;
        if (priority < 0) continue;
        if (best === null || priority > (STATUS_DISPLAY_PRIORITY[best.status] ?? -1)) {
          best = b;
        }
      }
      return best;
    },
  );

export const selectBookingStatusForListing = (listingId: string) =>
  createSelector(
    selectMyBookings,
    (bookings): BookingStatus | null => {
      let best: MyBooking | null = null;
      for (const b of bookings) {
        if (b.listingId !== listingId) continue;
        const priority = STATUS_DISPLAY_PRIORITY[b.status] ?? -1;
        if (priority < 0) continue;
        if (best === null || priority > (STATUS_DISPLAY_PRIORITY[best.status] ?? -1)) {
          best = b;
        }
      }
      return best?.status ?? null;
    },
  );
