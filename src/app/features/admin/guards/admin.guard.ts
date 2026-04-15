import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';

import { AuthTokenService } from '../../auth/services/auth-token.service';
import {
  selectAuthError,
  selectAuthLoading,
  selectAuthUser,
  selectIsAuthenticated,
} from '../../auth/store/auth.selectors';
import * as AuthActions from '../../auth/store/auth.actions';

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

  if (hasToken) {
    if (!isAuthLoading) {
      store.dispatch(AuthActions.loadCurrentUser());
    }

    return store.select(selectAuthLoading).pipe(
      filter((loading) => !loading),
      take(1),
      map(() => {
        const hydratedUser = store.selectSignal(selectAuthUser)();
        const authError = store.selectSignal(selectAuthError)();
        if (hydratedUser?.roles.includes('Admin') === true) {
          return true;
        }

        if (authError !== null) {
          return router.createUrlTree(['/auth/login']);
        }

        return router.createUrlTree(['/listings']);
      }),
    );
  }

  return router.createUrlTree(['/auth/login']);
};
