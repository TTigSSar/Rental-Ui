import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  filter,
  map,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';

import { ListingsApiService } from '../services/listings-api.service';
import * as ListingsActions from './listings.actions';
import {
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsPage,
  selectListingsPageSize,
} from './listings.selectors';

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
export class ListingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly listingsApi = inject(ListingsApiService);

  readonly loadListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadListings),
      withLatestFrom(
        this.store.select(selectListingsFilters),
        this.store.select(selectListingsPageSize),
      ),
      switchMap(([, filters, pageSize]) =>
        this.listingsApi.getListings(filters, 1, pageSize).pipe(
          map((result) =>
            ListingsActions.loadListingsSuccess({
              items: result.items,
              page: result.page,
              pageSize: result.pageSize,
              hasMore: result.hasMore,
            }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadNextPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadNextPage),
      withLatestFrom(
        this.store.select(selectListingsHasMore),
        this.store.select(selectListingsPage),
        this.store.select(selectListingsFilters),
        this.store.select(selectListingsPageSize),
      ),
      filter(([, hasMore]) => hasMore),
      switchMap(([, , page, filters, pageSize]) =>
        this.listingsApi.getListings(filters, page + 1, pageSize).pipe(
          map((result) =>
            ListingsActions.loadListingsSuccess({
              items: result.items,
              page: result.page,
              pageSize: result.pageSize,
              hasMore: result.hasMore,
            }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadListingDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadListingDetails),
      switchMap(({ id }) =>
        this.listingsApi.getListingById(id).pipe(
          map((listing) =>
            ListingsActions.loadListingDetailsSuccess({ listing }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingDetailsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
