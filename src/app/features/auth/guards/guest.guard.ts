import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthTokenService } from '../services/auth-token.service';
import { selectIsAuthenticated } from '../store/auth.selectors';

export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const tokenService = inject(AuthTokenService);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const hasToken = (tokenService.getToken() ?? '').trim().length > 0;

  if (isAuthenticated || hasToken) {
    return router.createUrlTree(['/listings']);
  }

  return true;
};
