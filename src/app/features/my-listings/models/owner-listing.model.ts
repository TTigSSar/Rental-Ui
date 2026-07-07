/**
 * Owner-view models for the "This is your listing" item-details screen
 * (/my-listings/:id). All fields are sourced from real backend endpoints — see
 * OwnerListingService for the exact calls.
 */

/** Whether the listing is visible to renters (`Active`) or hidden (`Paused`). */
export type OwnerListingStatus = 'Active' | 'Paused';

/** Lifecycle of a single incoming booking request from the owner's side. */
export type OwnerRequestDecision = 'pending' | 'accepted' | 'declined';

/**
 * The renter behind a booking request. Identity comes from the booking request;
 * avatar, rating and rentals count are enriched from the renter's public
 * profile. `rating` is null when the renter has too few reviews to aggregate.
 */
export interface OwnerRequestRenter {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarUrl: string | null;
  readonly rating: number | null;
  readonly rentalsCount: number;
}

/** A single incoming booking request shown in the owner's requests panel. */
export interface OwnerBookingRequest {
  /** Booking id — the handle passed to accept/decline. */
  readonly id: string;
  readonly renter: OwnerRequestRenter;
  /** ISO timestamp the request was submitted. */
  readonly requestedAt: string;
  readonly startDate: string;
  readonly endDate: string;
  /** Booking total the owner earns for this rental. */
  readonly ownerEarnings: number;
  readonly decision: OwnerRequestDecision;
}
