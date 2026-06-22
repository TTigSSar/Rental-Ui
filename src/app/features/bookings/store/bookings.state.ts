import type { BookingDetail, BookingRequest, MyBooking } from '../models/booking.model';

export interface BookingsState {
  createBookingLoading: boolean;
  createBookingError: string | null;
  createBookingSuccessId: string | null;
  myBookings: MyBooking[];
  myBookingsLoading: boolean;
  myBookingsError: string | null;
  bookingRequests: BookingRequest[];
  bookingRequestsLoading: boolean;
  bookingRequestsError: string | null;
  bookingRequestActionIds: string[];
  // Booking Details page (one booking in view at a time).
  bookingDetail: BookingDetail | null;
  bookingDetailLoading: boolean;
  bookingDetailError: string | null;
  // Completion handshake action (mark / confirm / undo) in flight.
  bookingActionPending: boolean;
  bookingActionError: string | null;
  // Cancel booking (renter cancels before owner confirms).
  cancelBookingPending: boolean;
  cancelBookingError: string | null;
  cancelBookingSuccessId: string | null;
}

export const initialBookingsState: BookingsState = {
  createBookingLoading: false,
  createBookingError: null,
  createBookingSuccessId: null,
  myBookings: [],
  myBookingsLoading: false,
  myBookingsError: null,
  bookingRequests: [],
  bookingRequestsLoading: false,
  bookingRequestsError: null,
  bookingRequestActionIds: [],
  bookingDetail: null,
  bookingDetailLoading: false,
  bookingDetailError: null,
  bookingActionPending: false,
  bookingActionError: null,
  cancelBookingPending: false,
  cancelBookingError: null,
  cancelBookingSuccessId: null,
};
