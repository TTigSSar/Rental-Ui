import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store, createSelector } from '@ngrx/store';
import {
  catchError,
  concatMap,
  EMPTY,
  filter,
  map,
  of,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs';

import { ListingsApiService } from '../services/listings-api.service';
import * as ListingsActions from './listings.actions';
import {
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsPage,
  selectListingsPageSize,
  selectListingsState,
} from './listings.selectors';
import type { ListingsState } from './listings.state';

function selectFavoritePersistenceView(listingId: string) {
  return createSelector(
    selectListingsState,
    (state: ListingsState): { tracked: boolean; isFavorite: boolean } => {
      const selected = state.selectedListing;
      if (selected !== null && selected.id === listingId) {
        return { tracked: true, isFavorite: selected.isFavorite };
      }
      const item = state.items.find((i) => i.id === listingId);
      if (item !== undefined) {
        return { tracked: true, isFavorite: item.isFavorite };
      }
      return { tracked: false, isFavorite: false };
    },
  );
}

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

  readonly persistFavoriteToggle$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.toggleFavoriteOptimistic),
      concatMap(({ listingId }) =>
        this.store.select(selectFavoritePersistenceView(listingId)).pipe(
          take(1),
          filter(({ tracked }) => tracked),
          switchMap(({ isFavorite }) => {
            const request$ = isFavorite
              ? this.listingsApi.addToFavorites(listingId)
              : this.listingsApi.removeFromFavorites(listingId);
            return request$.pipe(
              switchMap(() => EMPTY),
              catchError(() =>
                of(
                  ListingsActions.toggleFavoriteRollback({
                    listingId,
                    isFavorite: !isFavorite,
                  }),
                ),
              ),
            );
          }),
        ),
      ),
    ),
  );

  readonly loadListingCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadListingCategories),
      switchMap(() =>
        this.listingsApi.getListingCategories().pipe(
          map((categories) =>
            ListingsActions.loadListingCategoriesSuccess({ categories }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingCategoriesFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly createListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.createListing),
      concatMap(({ payload, files }) =>
        this.listingsApi.createListing(payload).pipe(
          switchMap((response) => {
            if (files.length === 0) {
              return of(ListingsActions.createListingSuccess({ response }));
            }

            return this.listingsApi.uploadListingImages(response.id, files).pipe(
              map(() => ListingsActions.createListingSuccess({ response })),
            );
          }),
          catchError((error: unknown) =>
            of(
              ListingsActions.createListingFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
