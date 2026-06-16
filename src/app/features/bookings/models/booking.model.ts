export type BookingStatus =
  | 'PendingApproval'
  | 'Pending'
  | 'Approved'
  | 'ReturnMarked'
  | 'Rejected'
  | 'Archived'
  | 'Cancelled'
  | 'Completed';

export type BookingParty = 'Renter' | 'Owner';

export type CompletionMethod = 'Mutual' | 'Auto';

export interface CreateBookingRequest {
  listingId: string;
  startDate: string;
  endDate: string;
}

export interface CreateBookingResponse {
  id: string;
  listingId: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  totalPrice: number;
  createdAt: string | null;
}

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

// Full booking detail for the dedicated Booking Details page (GET /api/bookings/:id).
// `role` tells the page which side the current user is; counterparty fields are the
// other party (phone/address only present once the booking is at least Approved).
export interface BookingDetail {
  id: string;
  status: BookingStatus;
  role: 'renter' | 'owner';
  listingId: string;
  listingTitle: string;
  listingPrimaryImageUrl: string | null;
  categoryName: string | null;
  condition: string | null;
  city: string;
  country: string;
  addressLine: string | null;
  currency: string;
  pricePerDay: number;
  depositAmount: number | null;
  totalPrice: number;
  startDate: string;
  endDate: string;
  createdAt: string | null;
  approvedAt: string | null;
  returnMarkedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  returnInitiatedBy: BookingParty | null;
  completedVia: CompletionMethod | null;
  counterpartyId: string;
  counterpartyFirstName: string;
  counterpartyLastName: string;
  counterpartyAvatarUrl: string | null;
  counterpartyPhoneNumber: string | null;
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
