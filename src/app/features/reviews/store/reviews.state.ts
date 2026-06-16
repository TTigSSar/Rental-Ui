import type {
  BookingReviewStatus,
  OwnerReviewSummary,
  ToyReviewSummary,
} from '../models/review.model';

export interface AsyncEntry<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface ReviewsState {
  readonly listingToyReviews: Readonly<Record<string, AsyncEntry<ToyReviewSummary>>>;
  readonly ownerReviews: Readonly<Record<string, AsyncEntry<OwnerReviewSummary>>>;
  readonly bookingStatus: Readonly<Record<string, AsyncEntry<BookingReviewStatus>>>;
  readonly submission: {
    readonly isSubmitting: boolean;
    readonly error: string | null;
    readonly lastStatus: BookingReviewStatus | null;
  };
}

export const initialReviewsState: ReviewsState = {
  listingToyReviews: {},
  ownerReviews: {},
  bookingStatus: {},
  submission: {
    isSubmitting: false,
    error: null,
    lastStatus: null,
  },
};
