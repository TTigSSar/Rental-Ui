import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthTokenService } from '../services/auth-token.service';
import { selectIsAuthenticated } from '../store/auth.selectors';

export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const tokenService = inject(AuthTokenService);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const hasToken = tokenService.getToken() !== null;

  if (isAuthenticated || hasToken) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
