import type { RatingSummary, Review } from '../models/review.model';

export interface ReviewCollection {
  readonly items: Review[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface SummaryEntry {
  readonly data: RatingSummary | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface ReviewsState {
  readonly byListing: Readonly<Record<string, ReviewCollection>>;
  readonly byUser: Readonly<Record<string, ReviewCollection>>;
  readonly listingSummaries: Readonly<Record<string, SummaryEntry>>;
  readonly userSummaries: Readonly<Record<string, SummaryEntry>>;
  readonly submission: {
    readonly isSubmitting: boolean;
    readonly submittedReview: Review | null;
    readonly error: string | null;
  };
}

export const initialReviewsState: ReviewsState = {
  byListing: {},
  byUser: {},
  listingSummaries: {},
  userSummaries: {},
  submission: {
    isSubmitting: false,
    submittedReview: null,
    error: null,
  },
};
