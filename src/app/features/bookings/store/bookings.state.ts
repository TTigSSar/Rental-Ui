import type { BookingRequest, MyBooking } from '../models/booking.model';

export interface BookingsState {
  myBookings: MyBooking[];
  myBookingsLoading: boolean;
  myBookingsError: string | null;
  bookingRequests: BookingRequest[];
  bookingRequestsLoading: boolean;
  bookingRequestsError: string | null;
  bookingRequestActionIds: string[];
}

export const initialBookingsState: BookingsState = {
  myBookings: [],
  myBookingsLoading: false,
  myBookingsError: null,
  bookingRequests: [],
  bookingRequestsLoading: false,
  bookingRequestsError: null,
  bookingRequestActionIds: [],
};
