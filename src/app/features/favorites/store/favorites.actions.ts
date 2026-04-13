import { createAction, props } from '@ngrx/store';

import type { ListingPreview } from '../../listings/models/listing.model';

export const loadFavorites = createAction('[Favorites] Load Favorites');

export const loadFavoritesSuccess = createAction(
  '[Favorites] Load Favorites Success',
  props<{ items: ListingPreview[] }>(),
);

export const loadFavoritesFailure = createAction(
  '[Favorites] Load Favorites Failure',
  props<{ error: string }>(),
);

export const removeFavoriteOptimistic = createAction(
  '[Favorites] Remove Favorite Optimistic',
  props<{ listingId: string }>(),
);

export const removeFavoriteSuccess = createAction(
  '[Favorites] Remove Favorite Success',
  props<{ listingId: string }>(),
);

export const removeFavoriteFailure = createAction(
  '[Favorites] Remove Favorite Failure',
  props<{ listingId: string; error: string }>(),
);
