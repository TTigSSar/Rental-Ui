import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';

import { selectAuthLoading, selectIsAuthenticated } from '../store/auth.selectors';

export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const isAuthLoading = store.selectSignal(selectAuthLoading)();

  // Auth has settled — decide immediately.
  if (!isAuthLoading) {
    return isAuthenticated ? router.createUrlTree(['/listings']) : true;
  }

  // Auth is still hydrating (e.g. /auth/me in flight). Wait for it to finish,
  // then re-evaluate. This prevents a stale localStorage token from triggering
  // a spurious redirect before the store knows the real auth state.
  return store.select(selectAuthLoading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      const authed = store.selectSignal(selectIsAuthenticated)();
      return authed ? router.createUrlTree(['/listings']) : true;
    }),
  );
};
