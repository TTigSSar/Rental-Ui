import { createReducer, on } from '@ngrx/store';

import type { BookingDetail, BookingRequest, BookingStatus } from '../models/booking.model';
import * as BookingsActions from './bookings.actions';
import { initialBookingsState, type BookingsState } from './bookings.state';

export const bookingsFeatureKey = 'bookings' as const;

function addActionId(ids: string[], bookingId: string): string[] {
  if (ids.includes(bookingId)) {
    return ids;
  }
  return [...ids, bookingId];
}

function removeActionId(ids: string[], bookingId: string): string[] {
  return ids.filter((id) => id !== bookingId);
}

function patchRequestStatus(
  requests: BookingRequest[],
  bookingId: string,
  status: BookingStatus,
): BookingRequest[] {
  return requests.map((request) =>
    request.id === bookingId ? { ...request, status } : request,
  );
}

// Optimistically apply a handshake transition to the in-view detail so the UI
// reacts instantly; the server response (or a failure-triggered refetch) reconciles.
function optimisticDetail(
  detail: BookingDetail | null,
  patch: Partial<BookingDetail>,
): BookingDetail | null {
  return detail ? { ...detail, ...patch } : detail;
}

export const bookingsReducer = createReducer(
  initialBookingsState,
  on(
    BookingsActions.createBooking,
    (state): BookingsState => ({
      ...state,
      createBookingLoading: true,
      createBookingError: null,
      createBookingSuccessId: null,
    }),
  ),
  on(
    BookingsActions.createBookingSuccess,
    (state, { booking }): BookingsState => ({
      ...state,
      createBookingLoading: false,
      createBookingError: null,
      createBookingSuccessId: booking.id,
    }),
  ),
  on(
    BookingsActions.createBookingFailure,
    (state, { error }): BookingsState => ({
      ...state,
      createBookingLoading: false,
      createBookingError: error,
      createBookingSuccessId: null,
    }),
  ),
  on(
    BookingsActions.clearCreateBookingState,
    (state): BookingsState => ({
      ...state,
      createBookingLoading: false,
      createBookingError: null,
      createBookingSuccessId: null,
    }),
  ),
  on(
    BookingsActions.loadMyBookings,
    (state): BookingsState => ({
      ...state,
      myBookingsLoading: true,
      myBookingsError: null,
    }),
  ),
  on(
    BookingsActions.loadMyBookingsSuccess,
    (state, { bookings }): BookingsState => ({
      ...state,
      myBookings: [...bookings],
      myBookingsLoading: false,
      myBookingsError: null,
    }),
  ),
  on(
    BookingsActions.loadMyBookingsFailure,
    (state, { error }): BookingsState => ({
      ...state,
      myBookingsLoading: false,
      myBookingsError: error,
    }),
  ),
  on(
    BookingsActions.loadBookingRequests,
    (state): BookingsState => ({
      ...state,
      bookingRequestsLoading: true,
      bookingRequestsError: null,
    }),
  ),
  on(
    BookingsActions.loadBookingRequestsSuccess,
    (state, { requests }): BookingsState => ({
      ...state,
      bookingRequests: [...requests],
      bookingRequestsLoading: false,
      bookingRequestsError: null,
    }),
  ),
  on(
    BookingsActions.loadBookingRequestsFailure,
    (state, { error }): BookingsState => ({
      ...state,
      bookingRequestsLoading: false,
      bookingRequestsError: error,
    }),
  ),
  on(
    BookingsActions.approveBookingRequest,
    BookingsActions.rejectBookingRequest,
    (state, { bookingId }): BookingsState => ({
      ...state,
      bookingRequestActionIds: addActionId(state.bookingRequestActionIds, bookingId),
      bookingRequestsError: null,
    }),
  ),
  on(
    BookingsActions.approveBookingRequestSuccess,
    BookingsActions.rejectBookingRequestSuccess,
    (state, { bookingId, status }): BookingsState => ({
      ...state,
      bookingRequests: patchRequestStatus(state.bookingRequests, bookingId, status),
      bookingRequestActionIds: removeActionId(state.bookingRequestActionIds, bookingId),
    }),
  ),
  on(
    BookingsActions.approveBookingRequestFailure,
    BookingsActions.rejectBookingRequestFailure,
    (state, { bookingId, error }): BookingsState => ({
      ...state,
      bookingRequestActionIds: removeActionId(state.bookingRequestActionIds, bookingId),
      bookingRequestsError: error,
    }),
  ),

  // --- Booking Details ---
  on(
    BookingsActions.loadBookingDetail,
    (state, { bookingId }): BookingsState => ({
      ...state,
      bookingDetailLoading: true,
      bookingDetailError: null,
      // Drop a stale detail when navigating to a different booking so the skeleton shows.
      bookingDetail:
        state.bookingDetail && state.bookingDetail.id === bookingId
          ? state.bookingDetail
          : null,
      bookingActionError: null,
    }),
  ),
  on(
    BookingsActions.loadBookingDetailSuccess,
    (state, { detail }): BookingsState => ({
      ...state,
      bookingDetail: detail,
      bookingDetailLoading: false,
      bookingDetailError: null,
    }),
  ),
  on(
    BookingsActions.loadBookingDetailFailure,
    (state, { error }): BookingsState => ({
      ...state,
      bookingDetailLoading: false,
      bookingDetailError: error,
    }),
  ),
  on(
    BookingsActions.clearBookingDetail,
    (state): BookingsState => ({
      ...state,
      bookingDetail: null,
      bookingDetailLoading: false,
      bookingDetailError: null,
      bookingActionPending: false,
      bookingActionError: null,
    }),
  ),

  // --- Booking status transitions (optimistic) ---
  on(
    BookingsActions.markActive,
    (state): BookingsState => ({
      ...state,
      bookingActionPending: true,
      bookingActionError: null,
      bookingDetail: optimisticDetail(state.bookingDetail, {
        status: 'Active',
        activeAt: new Date().toISOString(),
      }),
    }),
  ),
  on(
    BookingsActions.completeBooking,
    (state): BookingsState => ({
      ...state,
      bookingActionPending: true,
      bookingActionError: null,
      bookingDetail: optimisticDetail(state.bookingDetail, {
        status: 'Completed',
        completedAt: new Date().toISOString(),
      }),
    }),
  ),
  on(
    BookingsActions.bookingActionSuccess,
    (state, { detail }): BookingsState => ({
      ...state,
      bookingDetail: detail,
      bookingActionPending: false,
      bookingActionError: null,
    }),
  ),
  on(
    BookingsActions.bookingActionFailure,
    (state, { error }): BookingsState => ({
      ...state,
      bookingActionPending: false,
      bookingActionError: error,
    }),
  ),

  // --- Cancel booking (renter) ---
  on(
    BookingsActions.cancelBooking,
    (state): BookingsState => ({
      ...state,
      cancelBookingPending: true,
      cancelBookingError: null,
      cancelBookingSuccessId: null,
    }),
  ),
  on(
    BookingsActions.cancelBookingSuccess,
    (state, { bookingId }): BookingsState => ({
      ...state,
      cancelBookingPending: false,
      cancelBookingError: null,
      cancelBookingSuccessId: bookingId,
      myBookings: state.myBookings.map((b) =>
        b.id === bookingId ? { ...b, status: 'Cancelled' } : b,
      ),
    }),
  ),
  on(
    BookingsActions.cancelBookingFailure,
    (state, { error }): BookingsState => ({
      ...state,
      cancelBookingPending: false,
      cancelBookingError: error,
    }),
  ),
  on(
    BookingsActions.clearCancelBookingState,
    (state): BookingsState => ({
      ...state,
      cancelBookingPending: false,
      cancelBookingError: null,
      cancelBookingSuccessId: null,
    }),
  ),
);
