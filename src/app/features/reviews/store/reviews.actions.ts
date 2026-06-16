import { createAction, props } from '@ngrx/store';

import type {
  BookingReviewStatus,
  CreateOwnerReviewRequest,
  CreateRenterReviewRequest,
  CreateToyReviewRequest,
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

// ── Submissions ──────────────────────────────────────────────────────────────

export const submitToyReview = createAction(
  '[Reviews] Submit Toy Review',
  props<{ request: CreateToyReviewRequest }>(),
);
export const submitOwnerReview = createAction(
  '[Reviews] Submit Owner Review',
  props<{ request: CreateOwnerReviewRequest }>(),
);
export const submitRenterReview = createAction(
  '[Reviews] Submit Renter Review',
  props<{ request: CreateRenterReviewRequest }>(),
);

export const submitReviewSuccess = createAction(
  '[Reviews] Submit Review Success',
  props<{ status: BookingReviewStatus }>(),
);
export const submitReviewFailure = createAction(
  '[Reviews] Submit Review Failure',
  props<{ error: string }>(),
);

export const resetSubmission = createAction('[Reviews] Reset Submission');
