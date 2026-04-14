import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthTokenService } from '../../auth/services/auth-token.service';
import {
  selectAuthLoading,
  selectAuthUser,
  selectIsAuthenticated,
} from '../../auth/store/auth.selectors';

export const adminGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const tokenService = inject(AuthTokenService);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const isAuthLoading = store.selectSignal(selectAuthLoading)();
  const hasToken = (tokenService.getToken() ?? '').trim().length > 0;
  const user = store.selectSignal(selectAuthUser)();

  if (!isAuthenticated && !hasToken) {
    return router.createUrlTree(['/auth/login']);
  }

  if (user !== null) {
    return user.roles.includes('Admin')
      ? true
      : router.createUrlTree(['/listings']);
  }

  // Token exists but user roles are not hydrated yet (or token is stale):
  // keep access conservative and deterministic.
  if (hasToken && isAuthLoading) {
    return router.createUrlTree(['/listings']);
  }

  return router.createUrlTree(['/auth/login']);
};
