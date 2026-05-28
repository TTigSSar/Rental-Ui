import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, mergeMap, of } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { ReviewsApiService } from '../services/reviews-api.service';
import * as ReviewsActions from './reviews.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

@Injectable()
export class ReviewsEffects {
  private readonly actions$ = inject(Actions);
  private readonly reviewsApi = inject(ReviewsApiService);

  readonly loadListingReviews$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadListingReviews),
      mergeMap(({ listingId }) =>
        this.reviewsApi.getByListing(listingId).pipe(
          map((items) => ReviewsActions.loadListingReviewsSuccess({ listingId, items })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadListingReviewsFailure({ listingId, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly loadUserReviews$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadUserReviews),
      mergeMap(({ userId }) =>
        this.reviewsApi.getByUser(userId).pipe(
          map((items) => ReviewsActions.loadUserReviewsSuccess({ userId, items })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadUserReviewsFailure({ userId, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly loadListingSummary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadListingSummary),
      mergeMap(({ listingId }) =>
        this.reviewsApi.getListingSummary(listingId).pipe(
          map((summary) => ReviewsActions.loadListingSummarySuccess({ listingId, summary })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadListingSummaryFailure({ listingId, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly loadUserSummary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadUserSummary),
      mergeMap(({ userId }) =>
        this.reviewsApi.getUserSummary(userId).pipe(
          map((summary) => ReviewsActions.loadUserSummarySuccess({ userId, summary })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadUserSummaryFailure({ userId, error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly submitReview$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.submitReview),
      concatMap(({ request }) =>
        this.reviewsApi.submit(request).pipe(
          map((review) => ReviewsActions.submitReviewSuccess({ review })),
          catchError((error: unknown) =>
            of(ReviewsActions.submitReviewFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );
}
