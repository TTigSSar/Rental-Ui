import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  AuthResponse,
  CurrentUser,
  LoginRequest,
  RegisterRequest,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(toApiUrl(ApiContract.auth.login), payload);
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(toApiUrl(ApiContract.auth.register), payload);
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(toApiUrl(ApiContract.auth.currentUser));
  }
}
