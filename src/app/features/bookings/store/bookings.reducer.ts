import { createReducer, on } from '@ngrx/store';

import type { BookingRequest, BookingStatus } from '../models/booking.model';
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

export const bookingsReducer = createReducer(
  initialBookingsState,
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
);
