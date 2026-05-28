import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { RatingSummary, Review } from '../models/review.model';
import { reviewsFeatureKey } from './reviews.reducer';
import type { ReviewCollection, ReviewsState, SummaryEntry } from './reviews.state';

export const selectReviewsState = createFeatureSelector<ReviewsState>(reviewsFeatureKey);

// ── Listing reviews ───────────────────────────────────────────────────────────

export const selectListingReviewCollection = (listingId: string) =>
  createSelector(
    selectReviewsState,
    (state): ReviewCollection => state.byListing[listingId] ?? { items: [], isLoading: false, error: null },
  );

export const selectListingReviews = (listingId: string) =>
  createSelector(selectListingReviewCollection(listingId), (c): Review[] => c.items);

export const selectListingReviewsLoading = (listingId: string) =>
  createSelector(selectListingReviewCollection(listingId), (c): boolean => c.isLoading);

export const selectListingReviewsError = (listingId: string) =>
  createSelector(selectListingReviewCollection(listingId), (c): string | null => c.error);

// ── User reviews ──────────────────────────────────────────────────────────────

export const selectUserReviewCollection = (userId: string) =>
  createSelector(
    selectReviewsState,
    (state): ReviewCollection => state.byUser[userId] ?? { items: [], isLoading: false, error: null },
  );

export const selectUserReviews = (userId: string) =>
  createSelector(selectUserReviewCollection(userId), (c): Review[] => c.items);

export const selectUserReviewsLoading = (userId: string) =>
  createSelector(selectUserReviewCollection(userId), (c): boolean => c.isLoading);

export const selectUserReviewsError = (userId: string) =>
  createSelector(selectUserReviewCollection(userId), (c): string | null => c.error);

// ── Listing rating summary ────────────────────────────────────────────────────

export const selectListingSummaryEntry = (listingId: string) =>
  createSelector(
    selectReviewsState,
    (state): SummaryEntry => state.listingSummaries[listingId] ?? { data: null, isLoading: false, error: null },
  );

export const selectListingSummary = (listingId: string) =>
  createSelector(selectListingSummaryEntry(listingId), (e): RatingSummary | null => e.data);

export const selectListingSummaryLoading = (listingId: string) =>
  createSelector(selectListingSummaryEntry(listingId), (e): boolean => e.isLoading);

// ── User rating summary ───────────────────────────────────────────────────────

export const selectUserSummaryEntry = (userId: string) =>
  createSelector(
    selectReviewsState,
    (state): SummaryEntry => state.userSummaries[userId] ?? { data: null, isLoading: false, error: null },
  );

export const selectUserSummary = (userId: string) =>
  createSelector(selectUserSummaryEntry(userId), (e): RatingSummary | null => e.data);

export const selectUserSummaryLoading = (userId: string) =>
  createSelector(selectUserSummaryEntry(userId), (e): boolean => e.isLoading);

// ── Submission ────────────────────────────────────────────────────────────────

export const selectSubmission = createSelector(
  selectReviewsState,
  (state) => state.submission,
);

export const selectIsSubmitting = createSelector(
  selectSubmission,
  (s): boolean => s.isSubmitting,
);

export const selectSubmittedReview = createSelector(
  selectSubmission,
  (s): Review | null => s.submittedReview,
);

export const selectSubmissionError = createSelector(
  selectSubmission,
  (s): string | null => s.error,
);
