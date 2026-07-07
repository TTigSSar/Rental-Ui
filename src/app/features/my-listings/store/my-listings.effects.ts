import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of, switchMap } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { MyListingsApiService } from '../services/my-listings-api.service';
import * as MyListingsActions from './my-listings.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

@Injectable()
export class MyListingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly myListingsApi = inject(MyListingsApiService);

  readonly loadMyListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MyListingsActions.loadMyListings),
      switchMap(() =>
        this.myListingsApi.getMyListings().pipe(
          map((items) => MyListingsActions.loadMyListingsSuccess({ items })),
          catchError((error: unknown) =>
            of(MyListingsActions.loadMyListingsFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly archiveListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MyListingsActions.archiveListing),
      mergeMap(({ listingId }) =>
        this.myListingsApi.archiveListing(listingId).pipe(
          map(() => MyListingsActions.archiveListingSuccess({ listingId })),
          catchError((error: unknown) =>
            of(MyListingsActions.archiveListingFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly restoreListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MyListingsActions.restoreListing),
      mergeMap(({ listingId }) =>
        this.myListingsApi.restoreListing(listingId).pipe(
          map(() => MyListingsActions.restoreListingSuccess({ listingId })),
          catchError((error: unknown) =>
            of(MyListingsActions.restoreListingFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly resubmitListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MyListingsActions.resubmitListing),
      mergeMap(({ listingId }) =>
        this.myListingsApi.resubmitListing(listingId).pipe(
          map(() => MyListingsActions.resubmitListingSuccess({ listingId })),
          catchError((error: unknown) =>
            of(MyListingsActions.resubmitListingFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );
}
