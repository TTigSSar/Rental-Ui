import type { Routes } from '@angular/router';

import { guestGuard } from './guards/guest.guard';

/**
 * The ONLY auth routes mounted in `app.routes.ts`: the landing pages of the confirmation
 * email (ADR-028) and of the password-reset email (ADR-035). Deliberately WITHOUT `guestGuard` — someone else may be
 * signed in on this browser, and the link must still work. The legacy
 * `login`/`register` pages below stay unmounted (sign-in is the auth dialog).
 */
export const authVerificationRoutes: Routes = [
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./pages/verify-email-page/verify-email-page.component').then(
        (m) => m.VerifyEmailPageComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password-page/reset-password-page.component').then(
        (m) => m.ResetPasswordPageComponent,
      ),
  },
];

export const authRoutes: Routes = [
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
      import('./pages/register-page/register-page.component').then((m) => m.RegisterPageComponent),
  },
];
