import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthRedirectService } from '../services/auth-redirect.service';
import { AuthTokenService } from '../services/auth-token.service';
import { selectIsAuthenticated } from '../store/auth.selectors';

export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(Store);
  const router = inject(Router);
  const tokenService = inject(AuthTokenService);
  const authRedirect = inject(AuthRedirectService);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const hasToken = (tokenService.getToken() ?? '').trim().length > 0;

  if (isAuthenticated || hasToken) {
    return true;
  }

  authRedirect.set(state.url);
  return router.createUrlTree(['/auth/login']);
};
