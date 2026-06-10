import { createReducer, on } from '@ngrx/store';

import * as ListingsActions from '../../listings/store/listings.actions';
import { HomeSectionsActions } from './home.actions';
import { initialHomeState, type HomeState } from './home.state';

export const homeFeatureKey = 'home';

function toggleIsFavoriteInSections(
  sections: HomeState['sections'],
  listingId: string,
  isFavorite: boolean | 'flip',
) {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === listingId
        ? { ...item, isFavorite: isFavorite === 'flip' ? !item.isFavorite : isFavorite }
        : item,
    ),
  }));
}

export const homeReducer = createReducer<HomeState>(
  initialHomeState,
  on(HomeSectionsActions.load, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(HomeSectionsActions.loadSuccess, (state, { sections }) => ({
    ...state,
    sections,
    loading: false,
    error: null,
  })),
  on(HomeSectionsActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ListingsActions.toggleFavoriteOptimistic, (state, { listingId }) => ({
    ...state,
    sections: toggleIsFavoriteInSections(state.sections, listingId, 'flip'),
  })),
  on(ListingsActions.toggleFavoriteRollback, (state, { listingId, isFavorite }) => ({
    ...state,
    sections: toggleIsFavoriteInSections(state.sections, listingId, isFavorite),
  })),
);
