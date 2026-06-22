import { createReducer, on } from '@ngrx/store';

import * as PublicProfilesActions from './public-profiles.actions';
import {
  initialPublicProfilesState,
  type PublicProfileEntry,
  type PublicProfilesState,
  type UserListingsEntry,
} from './public-profiles.state';

export const publicProfilesFeatureKey = 'publicProfiles' as const;

function entryLoading(current: PublicProfileEntry | undefined): PublicProfileEntry {
  return { ...(current ?? { data: null, isLoading: false, error: null }), isLoading: true, error: null };
}

function listingsLoading(current: UserListingsEntry | undefined): UserListingsEntry {
  return { data: current?.data ?? null, isLoading: true, error: null };
}

export const publicProfilesReducer = createReducer(
  initialPublicProfilesState,

  on(PublicProfilesActions.loadPublicProfile, (state, { userId }): PublicProfilesState => ({
    ...state,
    byId: {
      ...state.byId,
      [userId]: entryLoading(state.byId[userId]),
    },
  })),

  on(PublicProfilesActions.loadPublicProfileSuccess, (state, { userId, profile }): PublicProfilesState => ({
    ...state,
    byId: {
      ...state.byId,
      [userId]: { data: profile, isLoading: false, error: null },
    },
  })),

  on(PublicProfilesActions.loadPublicProfileFailure, (state, { userId, error }): PublicProfilesState => ({
    ...state,
    byId: {
      ...state.byId,
      [userId]: {
        ...(state.byId[userId] ?? { data: null, isLoading: false, error: null }),
        isLoading: false,
        error,
      },
    },
  })),

  on(PublicProfilesActions.loadUserListings, (state, { userId }): PublicProfilesState => ({
    ...state,
    userListings: {
      ...state.userListings,
      [userId]: listingsLoading(state.userListings[userId]),
    },
  })),

  on(PublicProfilesActions.loadUserListingsSuccess, (state, { userId, listings }): PublicProfilesState => ({
    ...state,
    userListings: {
      ...state.userListings,
      [userId]: { data: listings, isLoading: false, error: null },
    },
  })),

  on(PublicProfilesActions.loadUserListingsFailure, (state, { userId, error }): PublicProfilesState => ({
    ...state,
    userListings: {
      ...state.userListings,
      [userId]: {
        ...(state.userListings[userId] ?? { data: null, isLoading: false, error: null }),
        isLoading: false,
        error,
      },
    },
  })),
);
