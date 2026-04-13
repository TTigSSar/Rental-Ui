export type BookingStatus =
  | 'PendingApproval'
  | 'Approved'
  | 'Rejected'
  | 'Archived'
  | 'Cancelled';

export interface MyBooking {
  id: string;
  listingId: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string | null;
}

export interface BookingRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  renterFirstName: string;
  renterLastName: string;
  renterEmail: string;
  renterPhoneNumber: string | null;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string | null;
}
