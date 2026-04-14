import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { selectIsAuthenticated } from '../store/auth.selectors';

export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  const isAuthenticated = store.selectSignal(selectIsAuthenticated)();

  if (isAuthenticated) {
    return router.createUrlTree(['/listings']);
  }

  return true;
};
