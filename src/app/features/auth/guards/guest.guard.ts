import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';

import { selectAuthInitializing, selectIsAuthenticated } from '../store/auth.selectors';

export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const isInitializing = store.selectSignal(selectAuthInitializing)();

  // Initialization done — decide immediately.
  if (!isInitializing) {
    return isAuthenticated ? router.createUrlTree(['/listings']) : true;
  }

  // Startup hydration in progress (ROOT_EFFECTS_INIT not yet settled).
  // Wait until isInitializing goes false, then re-evaluate.
  return store.select(selectAuthInitializing).pipe(
    filter((initializing) => !initializing),
    take(1),
    map(() => {
      const authed = store.selectSignal(selectIsAuthenticated)();
      return authed ? router.createUrlTree(['/listings']) : true;
    }),
  );
};
