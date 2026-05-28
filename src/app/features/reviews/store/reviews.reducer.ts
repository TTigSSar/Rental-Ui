import { createReducer, on } from '@ngrx/store';

import type { RatingSummary, Review } from '../models/review.model';
import * as ReviewsActions from './reviews.actions';
import {
  initialReviewsState,
  type ReviewCollection,
  type ReviewsState,
  type SummaryEntry,
} from './reviews.state';

export const reviewsFeatureKey = 'reviews' as const;

function emptyCollection(): ReviewCollection {
  return { items: [], isLoading: false, error: null };
}

function emptySummary(): SummaryEntry {
  return { data: null, isLoading: false, error: null };
}

function collectionLoading(current: ReviewCollection | undefined): ReviewCollection {
  return { ...(current ?? emptyCollection()), isLoading: true, error: null };
}

function collectionLoaded(items: Review[]): ReviewCollection {
  return { items, isLoading: false, error: null };
}

function collectionFailed(current: ReviewCollection | undefined, error: string): ReviewCollection {
  return { ...(current ?? emptyCollection()), isLoading: false, error };
}

function summaryLoading(current: SummaryEntry | undefined): SummaryEntry {
  return { ...(current ?? emptySummary()), isLoading: true, error: null };
}

function summaryLoaded(data: RatingSummary): SummaryEntry {
  return { data, isLoading: false, error: null };
}

function summaryFailed(current: SummaryEntry | undefined, error: string): SummaryEntry {
  return { ...(current ?? emptySummary()), isLoading: false, error };
}

export const reviewsReducer = createReducer(
  initialReviewsState,

  // ── Listing reviews ───────────────────────────────────────────────────────

  on(ReviewsActions.loadListingReviews, (state, { listingId }): ReviewsState => ({
    ...state,
    byListing: {
      ...state.byListing,
      [listingId]: collectionLoading(state.byListing[listingId]),
    },
  })),

  on(ReviewsActions.loadListingReviewsSuccess, (state, { listingId, items }): ReviewsState => ({
    ...state,
    byListing: {
      ...state.byListing,
      [listingId]: collectionLoaded(items),
    },
  })),

  on(ReviewsActions.loadListingReviewsFailure, (state, { listingId, error }): ReviewsState => ({
    ...state,
    byListing: {
      ...state.byListing,
      [listingId]: collectionFailed(state.byListing[listingId], error),
    },
  })),

  // ── User reviews ──────────────────────────────────────────────────────────

  on(ReviewsActions.loadUserReviews, (state, { userId }): ReviewsState => ({
    ...state,
    byUser: {
      ...state.byUser,
      [userId]: collectionLoading(state.byUser[userId]),
    },
  })),

  on(ReviewsActions.loadUserReviewsSuccess, (state, { userId, items }): ReviewsState => ({
    ...state,
    byUser: {
      ...state.byUser,
      [userId]: collectionLoaded(items),
    },
  })),

  on(ReviewsActions.loadUserReviewsFailure, (state, { userId, error }): ReviewsState => ({
    ...state,
    byUser: {
      ...state.byUser,
      [userId]: collectionFailed(state.byUser[userId], error),
    },
  })),

  // ── Listing rating summary ────────────────────────────────────────────────

  on(ReviewsActions.loadListingSummary, (state, { listingId }): ReviewsState => ({
    ...state,
    listingSummaries: {
      ...state.listingSummaries,
      [listingId]: summaryLoading(state.listingSummaries[listingId]),
    },
  })),

  on(ReviewsActions.loadListingSummarySuccess, (state, { listingId, summary }): ReviewsState => ({
    ...state,
    listingSummaries: {
      ...state.listingSummaries,
      [listingId]: summaryLoaded(summary),
    },
  })),

  on(ReviewsActions.loadListingSummaryFailure, (state, { listingId, error }): ReviewsState => ({
    ...state,
    listingSummaries: {
      ...state.listingSummaries,
      [listingId]: summaryFailed(state.listingSummaries[listingId], error),
    },
  })),

  // ── User rating summary ───────────────────────────────────────────────────

  on(ReviewsActions.loadUserSummary, (state, { userId }): ReviewsState => ({
    ...state,
    userSummaries: {
      ...state.userSummaries,
      [userId]: summaryLoading(state.userSummaries[userId]),
    },
  })),

  on(ReviewsActions.loadUserSummarySuccess, (state, { userId, summary }): ReviewsState => ({
    ...state,
    userSummaries: {
      ...state.userSummaries,
      [userId]: summaryLoaded(summary),
    },
  })),

  on(ReviewsActions.loadUserSummaryFailure, (state, { userId, error }): ReviewsState => ({
    ...state,
    userSummaries: {
      ...state.userSummaries,
      [userId]: summaryFailed(state.userSummaries[userId], error),
    },
  })),

  // ── Submit review ─────────────────────────────────────────────────────────

  on(ReviewsActions.submitReview, (state): ReviewsState => ({
    ...state,
    submission: { isSubmitting: true, submittedReview: null, error: null },
  })),

  on(ReviewsActions.submitReviewSuccess, (state, { review }): ReviewsState => ({
    ...state,
    submission: { isSubmitting: false, submittedReview: review, error: null },
  })),

  on(ReviewsActions.submitReviewFailure, (state, { error }): ReviewsState => ({
    ...state,
    submission: { isSubmitting: false, submittedReview: null, error },
  })),

  on(ReviewsActions.resetSubmission, (state): ReviewsState => ({
    ...state,
    submission: { isSubmitting: false, submittedReview: null, error: null },
  })),
);
