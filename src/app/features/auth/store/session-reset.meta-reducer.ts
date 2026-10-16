import type { ActionReducer, MetaReducer } from '@ngrx/store';

import { sessionReplaced } from './auth.actions';
import { authFeatureKey } from './auth.reducer';

/**
 * On `sessionReplaced` (one signed-in user was swapped for another without a logout) every
 * feature slice except `auth` is dropped, so each reducer re-initialises from its own initial
 * state — the store-side half of "behave like logout + login". `auth` already holds the new
 * user. Slices that are registered lazily simply come back empty and reload on next use.
 */
export function sessionResetMetaReducer(
  reducer: ActionReducer<Record<string, unknown>>,
): ActionReducer<Record<string, unknown>> {
  return (state, action) => {
    if (action.type === sessionReplaced.type && state !== undefined) {
      const kept = { [authFeatureKey]: state[authFeatureKey] };
      return reducer(kept, action);
    }
    return reducer(state, action);
  };
}

export const sessionResetMetaReducers: MetaReducer[] = [sessionResetMetaReducer];
