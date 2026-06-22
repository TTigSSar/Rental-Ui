import { createAction, props } from '@ngrx/store';

import type {
  BookingDetail,
  BookingRequest,
  BookingStatus,
  CreateBookingRequest,
  CreateBookingResponse,
  MyBooking,
} from '../models/booking.model';

export const createBooking = createAction(
  '[Bookings] Create Booking',
  props<{ payload: CreateBookingRequest }>(),
);

export const createBookingSuccess = createAction(
  '[Bookings] Create Booking Success',
  props<{ booking: CreateBookingResponse }>(),
);

export const createBookingFailure = createAction(
  '[Bookings] Create Booking Failure',
  props<{ error: string }>(),
);

export const clearCreateBookingState = createAction(
  '[Bookings] Clear Create Booking State',
);

export const loadMyBookings = createAction('[Bookings] Load My Bookings');

export const loadMyBookingsSuccess = createAction(
  '[Bookings] Load My Bookings Success',
  props<{ bookings: MyBooking[] }>(),
);

export const loadMyBookingsFailure = createAction(
  '[Bookings] Load My Bookings Failure',
  props<{ error: string }>(),
);

export const loadBookingRequests = createAction('[Bookings] Load Booking Requests');

export const loadBookingRequestsSuccess = createAction(
  '[Bookings] Load Booking Requests Success',
  props<{ requests: BookingRequest[] }>(),
);

export const loadBookingRequestsFailure = createAction(
  '[Bookings] Load Booking Requests Failure',
  props<{ error: string }>(),
);

export const approveBookingRequest = createAction(
  '[Bookings] Approve Booking Request',
  props<{ bookingId: string }>(),
);

export const approveBookingRequestSuccess = createAction(
  '[Bookings] Approve Booking Request Success',
  props<{ bookingId: string; status: BookingStatus }>(),
);

export const approveBookingRequestFailure = createAction(
  '[Bookings] Approve Booking Request Failure',
  props<{ bookingId: string; error: string }>(),
);

export const rejectBookingRequest = createAction(
  '[Bookings] Reject Booking Request',
  props<{ bookingId: string; reason: string | null }>(),
);

export const rejectBookingRequestSuccess = createAction(
  '[Bookings] Reject Booking Request Success',
  props<{ bookingId: string; status: BookingStatus }>(),
);

export const rejectBookingRequestFailure = createAction(
  '[Bookings] Reject Booking Request Failure',
  props<{ bookingId: string; error: string }>(),
);

// --- Booking Details page ---

export const loadBookingDetail = createAction(
  '[Bookings] Load Booking Detail',
  props<{ bookingId: string }>(),
);

export const loadBookingDetailSuccess = createAction(
  '[Bookings] Load Booking Detail Success',
  props<{ detail: BookingDetail }>(),
);

export const loadBookingDetailFailure = createAction(
  '[Bookings] Load Booking Detail Failure',
  props<{ error: string }>(),
);

export const clearBookingDetail = createAction('[Bookings] Clear Booking Detail');

// --- Booking status transitions ---

export const cancelBooking = createAction(
  '[Bookings] Cancel Booking',
  props<{ bookingId: string }>(),
);

export const cancelBookingSuccess = createAction(
  '[Bookings] Cancel Booking Success',
  props<{ bookingId: string }>(),
);

export const cancelBookingFailure = createAction(
  '[Bookings] Cancel Booking Failure',
  props<{ error: string }>(),
);

export const clearCancelBookingState = createAction('[Bookings] Clear Cancel Booking State');

export const markActive = createAction(
  '[Bookings] Mark Active',
  props<{ bookingId: string }>(),
);

export const completeBooking = createAction(
  '[Bookings] Complete Booking',
  props<{ bookingId: string }>(),
);

export const bookingActionSuccess = createAction(
  '[Bookings] Booking Action Success',
  props<{ detail: BookingDetail }>(),
);

export const bookingActionFailure = createAction(
  '[Bookings] Booking Action Failure',
  props<{ bookingId: string; error: string }>(),
);
