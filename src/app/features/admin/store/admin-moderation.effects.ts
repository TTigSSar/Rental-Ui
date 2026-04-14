import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';

import { AdminListingsApiService } from '../services/admin-listings-api.service';
import * as AdminModerationActions from './admin-moderation.actions';

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (
      typeof error.error === 'object' &&
      error.error !== null &&
      'errors' in error.error &&
      typeof error.error.errors === 'object' &&
      error.error.errors !== null
    ) {
      const validationErrors = Object.values(error.error.errors).flatMap((value) =>
        Array.isArray(value)
          ? value.filter((entry): entry is string => typeof entry === 'string')
          : [],
      );
      if (validationErrors.length > 0) {
        return validationErrors[0];
      }
    }
    if (
      typeof error.error === 'object' &&
      error.error !== null &&
      'detail' in error.error &&
      typeof error.error.detail === 'string' &&
      error.error.detail.length > 0
    ) {
      return error.error.detail;
    }
    if (
      typeof error.error === 'object' &&
      error.error !== null &&
      'title' in error.error &&
      typeof error.error.title === 'string' &&
      error.error.title.length > 0
    ) {
      return error.error.title;
    }
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
      concatMap(({ listingId }) =>
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
      concatMap(({ listingId }) =>
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
