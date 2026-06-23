import { createAction, props } from '@ngrx/store';

import type {
  BookingReviewStatus,
  OwnerReviewSummary,
  ToyReviewSummary,
} from '../models/review.model';

// ── Listing toy reviews (aggregate + comments) ───────────────────────────────

export const loadListingToyReviews = createAction(
  '[Reviews] Load Listing Toy Reviews',
  props<{ listingId: string }>(),
);
export const loadListingToyReviewsSuccess = createAction(
  '[Reviews] Load Listing Toy Reviews Success',
  props<{ listingId: string; summary: ToyReviewSummary }>(),
);
export const loadListingToyReviewsFailure = createAction(
  '[Reviews] Load Listing Toy Reviews Failure',
  props<{ listingId: string; error: string }>(),
);

// ── Owner reviews (aggregate + comments) ─────────────────────────────────────

export const loadOwnerReviews = createAction(
  '[Reviews] Load Owner Reviews',
  props<{ userId: string }>(),
);
export const loadOwnerReviewsSuccess = createAction(
  '[Reviews] Load Owner Reviews Success',
  props<{ userId: string; summary: OwnerReviewSummary }>(),
);
export const loadOwnerReviewsFailure = createAction(
  '[Reviews] Load Owner Reviews Failure',
  props<{ userId: string; error: string }>(),
);

// ── Renter reviews (aggregate + comments) ─────────────────────────────────────

export const loadRenterReviews = createAction(
  '[Reviews] Load Renter Reviews',
  props<{ userId: string }>(),
);
export const loadRenterReviewsSuccess = createAction(
  '[Reviews] Load Renter Reviews Success',
  props<{ userId: string; summary: OwnerReviewSummary }>(),
);
export const loadRenterReviewsFailure = createAction(
  '[Reviews] Load Renter Reviews Failure',
  props<{ userId: string; error: string }>(),
);

// ── Booking review status ────────────────────────────────────────────────────

export const loadBookingStatus = createAction(
  '[Reviews] Load Booking Status',
  props<{ bookingId: string }>(),
);
export const loadBookingStatusSuccess = createAction(
  '[Reviews] Load Booking Status Success',
  props<{ bookingId: string; status: BookingReviewStatus }>(),
);
export const loadBookingStatusFailure = createAction(
  '[Reviews] Load Booking Status Failure',
  props<{ bookingId: string; error: string }>(),
);
