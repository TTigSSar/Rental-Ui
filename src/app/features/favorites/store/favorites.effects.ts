import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';

import { FavoritesApiService } from '../services/favorites-api.service';
import * as FavoritesActions from './favorites.actions';

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
export class FavoritesEffects {
  private readonly actions$ = inject(Actions);
  private readonly favoritesApi = inject(FavoritesApiService);

  readonly loadFavorites$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FavoritesActions.loadFavorites),
      switchMap(() =>
        this.favoritesApi.getFavorites().pipe(
          map((items) => FavoritesActions.loadFavoritesSuccess({ items })),
          catchError((error: unknown) =>
            of(
              FavoritesActions.loadFavoritesFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly removeFavorite$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FavoritesActions.removeFavoriteOptimistic),
      concatMap(({ listingId }) =>
        this.favoritesApi.removeFromFavorites(listingId).pipe(
          map(() => FavoritesActions.removeFavoriteSuccess({ listingId })),
          catchError((error: unknown) =>
            of(
              FavoritesActions.removeFavoriteFailure({
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
