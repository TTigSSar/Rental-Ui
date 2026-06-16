import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, mergeMap, of } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { ReviewsApiService } from '../services/reviews-api.service';
import * as ReviewsActions from './reviews.actions';

@Injectable()
export class ReviewsEffects {
  private readonly actions$ = inject(Actions);
  private readonly reviewsApi = inject(ReviewsApiService);

  readonly loadListingToyReviews$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadListingToyReviews),
      mergeMap(({ listingId }) =>
        this.reviewsApi.getListingToyReviews(listingId).pipe(
          map((summary) => ReviewsActions.loadListingToyReviewsSuccess({ listingId, summary })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadListingToyReviewsFailure({ listingId, error: toApiErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly loadOwnerReviews$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadOwnerReviews),
      mergeMap(({ userId }) =>
        this.reviewsApi.getOwnerReviews(userId).pipe(
          map((summary) => ReviewsActions.loadOwnerReviewsSuccess({ userId, summary })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadOwnerReviewsFailure({ userId, error: toApiErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly loadBookingStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadBookingStatus),
      mergeMap(({ bookingId }) =>
        this.reviewsApi.getBookingStatus(bookingId).pipe(
          map((status) => ReviewsActions.loadBookingStatusSuccess({ bookingId, status })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadBookingStatusFailure({ bookingId, error: toApiErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly submitToyReview$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.submitToyReview),
      concatMap(({ request }) =>
        this.reviewsApi.submitToy(request).pipe(
          map((status) => ReviewsActions.submitReviewSuccess({ status })),
          catchError((error: unknown) =>
            of(ReviewsActions.submitReviewFailure({ error: toApiErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly submitOwnerReview$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.submitOwnerReview),
      concatMap(({ request }) =>
        this.reviewsApi.submitOwner(request).pipe(
          map((status) => ReviewsActions.submitReviewSuccess({ status })),
          catchError((error: unknown) =>
            of(ReviewsActions.submitReviewFailure({ error: toApiErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly submitRenterReview$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.submitRenterReview),
      concatMap(({ request }) =>
        this.reviewsApi.submitRenter(request).pipe(
          map((status) => ReviewsActions.submitReviewSuccess({ status })),
          catchError((error: unknown) =>
            of(ReviewsActions.submitReviewFailure({ error: toApiErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );
}
