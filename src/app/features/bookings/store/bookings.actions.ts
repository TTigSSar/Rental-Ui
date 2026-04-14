import { createAction, props } from '@ngrx/store';

import type {
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
  props<{ bookingId: string }>(),
);

export const rejectBookingRequestSuccess = createAction(
  '[Bookings] Reject Booking Request Success',
  props<{ bookingId: string; status: BookingStatus }>(),
);

export const rejectBookingRequestFailure = createAction(
  '[Bookings] Reject Booking Request Failure',
  props<{ bookingId: string; error: string }>(),
);
