import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import type { Routes } from '@angular/router';

import { guestGuard } from './guards/guest.guard';
import { AuthEffects } from './store/auth.effects';
import { authFeatureKey, authReducer } from './store/auth.reducer';

export const authRoutes: Routes = [
  {
    path: '',
    providers: [provideState(authFeatureKey, authReducer), provideEffects(AuthEffects)],
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/register-page/register-page.component').then(
            (m) => m.RegisterPageComponent,
          ),
      },
    ],
  },
];
