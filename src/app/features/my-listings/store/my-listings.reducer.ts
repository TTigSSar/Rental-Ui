import { createReducer, on } from '@ngrx/store';

import * as MyListingsActions from './my-listings.actions';
import {
  initialMyListingsState,
  type MyListingsState,
} from './my-listings.state';

export const myListingsFeatureKey = 'myListings' as const;

export const myListingsReducer = createReducer(
  initialMyListingsState,
  on(
    MyListingsActions.loadMyListings,
    (state): MyListingsState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    MyListingsActions.loadMyListingsSuccess,
    (state, { items }): MyListingsState => ({
      ...state,
      items: [...items],
      isLoading: false,
      error: null,
    }),
  ),
  on(
    MyListingsActions.loadMyListingsFailure,
    (state, { error }): MyListingsState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
);
