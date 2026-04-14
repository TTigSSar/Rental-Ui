import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  AuthResponse,
  BackendAuthResponse,
  CurrentUser,
  LoginRequest,
  RegisterRequest,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>(toApiUrl(ApiContract.auth.login), payload)
      .pipe(map((response) => this.normalizeAuthResponse(response)));
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>(toApiUrl(ApiContract.auth.register), payload)
      .pipe(map((response) => this.normalizeAuthResponse(response)));
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(toApiUrl(ApiContract.auth.currentUser));
  }

  private normalizeAuthResponse(response: BackendAuthResponse): AuthResponse {
    const resolvedToken = response.token ?? response.accessToken ?? '';
    const token = resolvedToken.trim();

    if (token === '') {
      throw new Error('Authentication token was not returned by the API');
    }

    return {
      token,
      expiresAt: response.expiresAt ?? null,
      user: response.user,
    };
  }
}
