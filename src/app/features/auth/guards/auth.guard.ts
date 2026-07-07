import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthRedirectService } from '../services/auth-redirect.service';
import { AuthTokenService } from '../services/auth-token.service';
import { selectAuthInitializing, selectIsAuthenticated } from '../store/auth.selectors';

export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(Store);
  const router = inject(Router);
  const tokenService = inject(AuthTokenService);
  const authRedirect = inject(AuthRedirectService);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();
  const isInitializing = store.selectSignal(selectAuthInitializing)();
  const hasToken = (tokenService.getToken() ?? '').trim().length > 0;

  // Allow when authenticated, or during the page-refresh window where a token
  // is in storage but /auth/me hasn't resolved yet. Once auth init has
  // completed unauthenticated, a lingering token (e.g. one preserved after a
  // non-401 failure) must NOT grant access — otherwise a guest can reach
  // protected pages such as listing creation.
  if (isAuthenticated || (isInitializing && hasToken)) {
    return true;
  }

  authRedirect.set(state.url);
  return router.createUrlTree(['/']);
};
