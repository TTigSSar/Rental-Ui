import { createReducer, on } from '@ngrx/store';

import { HomeSectionsActions } from './home.actions';
import { initialHomeState, type HomeState } from './home.state';

export const homeFeatureKey = 'home';

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
);
