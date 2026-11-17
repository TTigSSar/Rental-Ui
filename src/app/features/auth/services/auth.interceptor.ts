import {
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';

import { ApiContract } from '../../../api/api-contract';
import { AuthTokenService } from './auth-token.service';

const unauthenticatedAuthEndpoints = new Set<string>([
  ApiContract.auth.login,
  ApiContract.auth.register,
  ApiContract.auth.external,
  ApiContract.auth.verifyEmail,
  ApiContract.auth.resendVerification,
  ApiContract.auth.forgotPassword,
  ApiContract.auth.resetPasswordCheck,
  ApiContract.auth.resetPassword,
]);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(AuthTokenService);
  const token = (tokenService.getToken() ?? '').trim();

  const requestPath = new URL(req.url, window.location.origin).pathname;
  if (unauthenticatedAuthEndpoints.has(requestPath)) {
    return next(req);
  }

  // An explicit Authorization header wins (PushSubscriptionService sends the logout DELETE
  // with the token captured at subscribe time, after the store token is gone or replaced).
  if (token === '' || req.headers.has('Authorization')) {
    return next(req);
  }

  const authorizedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authorizedRequest);
};
