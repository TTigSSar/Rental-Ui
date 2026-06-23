import { createReducer, on } from '@ngrx/store';

import * as ReviewsActions from './reviews.actions';
import { initialReviewsState, type AsyncEntry, type ReviewsState } from './reviews.state';

export const reviewsFeatureKey = 'reviews' as const;

function loading<T>(current: AsyncEntry<T> | undefined): AsyncEntry<T> {
  return { data: current?.data ?? null, isLoading: true, error: null };
}
function loaded<T>(data: T): AsyncEntry<T> {
  return { data, isLoading: false, error: null };
}
function failed<T>(current: AsyncEntry<T> | undefined, error: string): AsyncEntry<T> {
  return { data: current?.data ?? null, isLoading: false, error };
}

export const reviewsReducer = createReducer(
  initialReviewsState,

  // ── Listing toy reviews ─────────────────────────────────────────────────────
  on(ReviewsActions.loadListingToyReviews, (state, { listingId }): ReviewsState => ({
    ...state,
    listingToyReviews: { ...state.listingToyReviews, [listingId]: loading(state.listingToyReviews[listingId]) },
  })),
  on(ReviewsActions.loadListingToyReviewsSuccess, (state, { listingId, summary }): ReviewsState => ({
    ...state,
    listingToyReviews: { ...state.listingToyReviews, [listingId]: loaded(summary) },
  })),
  on(ReviewsActions.loadListingToyReviewsFailure, (state, { listingId, error }): ReviewsState => ({
    ...state,
    listingToyReviews: { ...state.listingToyReviews, [listingId]: failed(state.listingToyReviews[listingId], error) },
  })),

  // ── Owner reviews ───────────────────────────────────────────────────────────
  on(ReviewsActions.loadOwnerReviews, (state, { userId }): ReviewsState => ({
    ...state,
    ownerReviews: { ...state.ownerReviews, [userId]: loading(state.ownerReviews[userId]) },
  })),
  on(ReviewsActions.loadOwnerReviewsSuccess, (state, { userId, summary }): ReviewsState => ({
    ...state,
    ownerReviews: { ...state.ownerReviews, [userId]: loaded(summary) },
  })),
  on(ReviewsActions.loadOwnerReviewsFailure, (state, { userId, error }): ReviewsState => ({
    ...state,
    ownerReviews: { ...state.ownerReviews, [userId]: failed(state.ownerReviews[userId], error) },
  })),

  // ── Renter reviews ───────────────────────────────────────────────────────────
  on(ReviewsActions.loadRenterReviews, (state, { userId }): ReviewsState => ({
    ...state,
    renterReviews: { ...state.renterReviews, [userId]: loading(state.renterReviews[userId]) },
  })),
  on(ReviewsActions.loadRenterReviewsSuccess, (state, { userId, summary }): ReviewsState => ({
    ...state,
    renterReviews: { ...state.renterReviews, [userId]: loaded(summary) },
  })),
  on(ReviewsActions.loadRenterReviewsFailure, (state, { userId, error }): ReviewsState => ({
    ...state,
    renterReviews: { ...state.renterReviews, [userId]: failed(state.renterReviews[userId], error) },
  })),

  // ── Booking status ──────────────────────────────────────────────────────────
  on(ReviewsActions.loadBookingStatus, (state, { bookingId }): ReviewsState => ({
    ...state,
    bookingStatus: { ...state.bookingStatus, [bookingId]: loading(state.bookingStatus[bookingId]) },
  })),
  on(ReviewsActions.loadBookingStatusSuccess, (state, { bookingId, status }): ReviewsState => ({
    ...state,
    bookingStatus: { ...state.bookingStatus, [bookingId]: loaded(status) },
  })),
  on(ReviewsActions.loadBookingStatusFailure, (state, { bookingId, error }): ReviewsState => ({
    ...state,
    bookingStatus: { ...state.bookingStatus, [bookingId]: failed(state.bookingStatus[bookingId], error) },
  })),
);
