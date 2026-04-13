import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { AdminListingsApiService } from '../services/admin-listings-api.service';
import * as AdminModerationActions from './admin-moderation.actions';

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }
    return error.message.length > 0 ? error.message : 'Request failed';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

@Injectable()
export class AdminModerationEffects {
  private readonly actions$ = inject(Actions);
  private readonly adminListingsApi = inject(AdminListingsApiService);

  readonly loadPendingListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminModerationActions.loadPendingListings),
      switchMap(() =>
        this.adminListingsApi.getPendingListings().pipe(
          map((items) =>
            AdminModerationActions.loadPendingListingsSuccess({ items }),
          ),
          catchError((error: unknown) =>
            of(
              AdminModerationActions.loadPendingListingsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly approvePendingListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminModerationActions.approvePendingListing),
      switchMap(({ listingId }) =>
        this.adminListingsApi.approveListing(listingId).pipe(
          map(() =>
            AdminModerationActions.approvePendingListingSuccess({ listingId }),
          ),
          catchError((error: unknown) =>
            of(
              AdminModerationActions.approvePendingListingFailure({
                listingId,
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly rejectPendingListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminModerationActions.rejectPendingListing),
      switchMap(({ listingId }) =>
        this.adminListingsApi.rejectListing(listingId).pipe(
          map(() =>
            AdminModerationActions.rejectPendingListingSuccess({ listingId }),
          ),
          catchError((error: unknown) =>
            of(
              AdminModerationActions.rejectPendingListingFailure({
                listingId,
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
