import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';

import { ApiErrorMapper } from '../../../api/api-error-mapper';
import { ReviewsApiService } from '../services/reviews-api.service';
import * as ReviewsActions from './reviews.actions';

@Injectable()
export class ReviewsEffects {
  private readonly actions$ = inject(Actions);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly reviewsApi = inject(ReviewsApiService);

  readonly loadListingToyReviews$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadListingToyReviews),
      mergeMap(({ listingId }) =>
        this.reviewsApi.getListingToyReviews(listingId).pipe(
          map((summary) => ReviewsActions.loadListingToyReviewsSuccess({ listingId, summary })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadListingToyReviewsFailure({ listingId, error: this.apiErrors.message(error) })),
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
            of(ReviewsActions.loadOwnerReviewsFailure({ userId, error: this.apiErrors.message(error) })),
          ),
        ),
      ),
    ),
  );

  readonly loadRenterReviews$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReviewsActions.loadRenterReviews),
      mergeMap(({ userId }) =>
        this.reviewsApi.getRenterReviews(userId).pipe(
          map((summary) => ReviewsActions.loadRenterReviewsSuccess({ userId, summary })),
          catchError((error: unknown) =>
            of(ReviewsActions.loadRenterReviewsFailure({ userId, error: this.apiErrors.message(error) })),
          ),
        ),
      ),
    ),
  );

}
