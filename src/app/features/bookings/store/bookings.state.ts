import type { BookingRequest, MyBooking } from '../models/booking.model';

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
};
