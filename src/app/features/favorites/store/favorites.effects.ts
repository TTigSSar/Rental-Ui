import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { FavoritesApiService } from '../services/favorites-api.service';
import * as FavoritesActions from './favorites.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
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
