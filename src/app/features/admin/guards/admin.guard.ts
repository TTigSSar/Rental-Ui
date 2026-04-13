import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthTokenService } from '../../auth/services/auth-token.service';
import {
  selectAuthUser,
  selectIsAuthenticated,
} from '../../auth/store/auth.selectors';

export const adminGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const tokenService = inject(AuthTokenService);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const hasToken = tokenService.getToken() !== null;
  const user = store.selectSignal(selectAuthUser)();

  if (!isAuthenticated && !hasToken) {
    return router.createUrlTree(['/auth/login']);
  }

  const hasAdminRole = user?.roles.includes('Admin') ?? false;
  if (!hasAdminRole) {
    return router.createUrlTree(['/listings']);
  }

  return true;
};
