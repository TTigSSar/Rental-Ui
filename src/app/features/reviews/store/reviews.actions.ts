import { createAction, props } from '@ngrx/store';

import type { CreateReviewRequest, RatingSummary, Review } from '../models/review.model';

// ── Listing reviews ──────────────────────────────────────────────────────────

export const loadListingReviews = createAction(
  '[Reviews] Load Listing Reviews',
  props<{ listingId: string }>(),
);

export const loadListingReviewsSuccess = createAction(
  '[Reviews] Load Listing Reviews Success',
  props<{ listingId: string; items: Review[] }>(),
);

export const loadListingReviewsFailure = createAction(
  '[Reviews] Load Listing Reviews Failure',
  props<{ listingId: string; error: string }>(),
);

// ── User reviews ─────────────────────────────────────────────────────────────

export const loadUserReviews = createAction(
  '[Reviews] Load User Reviews',
  props<{ userId: string }>(),
);

export const loadUserReviewsSuccess = createAction(
  '[Reviews] Load User Reviews Success',
  props<{ userId: string; items: Review[] }>(),
);

export const loadUserReviewsFailure = createAction(
  '[Reviews] Load User Reviews Failure',
  props<{ userId: string; error: string }>(),
);

// ── Listing rating summary ───────────────────────────────────────────────────

export const loadListingSummary = createAction(
  '[Reviews] Load Listing Summary',
  props<{ listingId: string }>(),
);

export const loadListingSummarySuccess = createAction(
  '[Reviews] Load Listing Summary Success',
  props<{ listingId: string; summary: RatingSummary }>(),
);

export const loadListingSummaryFailure = createAction(
  '[Reviews] Load Listing Summary Failure',
  props<{ listingId: string; error: string }>(),
);

// ── User rating summary ──────────────────────────────────────────────────────

export const loadUserSummary = createAction(
  '[Reviews] Load User Summary',
  props<{ userId: string }>(),
);

export const loadUserSummarySuccess = createAction(
  '[Reviews] Load User Summary Success',
  props<{ userId: string; summary: RatingSummary }>(),
);

export const loadUserSummaryFailure = createAction(
  '[Reviews] Load User Summary Failure',
  props<{ userId: string; error: string }>(),
);

// ── Submit review ────────────────────────────────────────────────────────────

export const submitReview = createAction(
  '[Reviews] Submit Review',
  props<{ request: CreateReviewRequest }>(),
);

export const submitReviewSuccess = createAction(
  '[Reviews] Submit Review Success',
  props<{ review: Review }>(),
);

export const submitReviewFailure = createAction(
  '[Reviews] Submit Review Failure',
  props<{ error: string }>(),
);

export const resetSubmission = createAction('[Reviews] Reset Submission');
