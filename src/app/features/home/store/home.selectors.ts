import { createFeatureSelector, createSelector } from '@ngrx/store';

import { homeFeatureKey } from './home.reducer';
import type { HomeState } from './home.state';

const selectHomeState = createFeatureSelector<HomeState>(homeFeatureKey);

export const selectHomeSections = createSelector(
  selectHomeState,
  (state) => state.sections,
);

export const selectHomeSectionsLoading = createSelector(
  selectHomeState,
  (state) => state.loading,
);

export const selectHomeSectionsError = createSelector(
  selectHomeState,
  (state) => state.error,
);
