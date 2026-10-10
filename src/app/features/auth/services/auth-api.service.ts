import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  AuthResponse,
  BackendAuthResponse,
  ChangePasswordRequest,
  CurrentUser,
  ExternalAuthRequest,
  HomePoint,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  UpdateHomePointRequest,
  VerifyEmailRequest,
} from '../models/auth.models';
import type { ListingDistrict } from '../../listings/models/district.model';

/**
 * Normalises the role field from the backend into a string array.
 *
 * The backend can return one of three shapes:
 *   { roles: ['Admin'] }  – ideal string array
 *   { role: 'Admin' }     – single string (claim)
 *   { role: 1 }           – integer enum  (0 = User, 1 = Admin)
 */
export function resolveRoles(raw: Record<string, unknown>): string[] {
  // Preferred: array of strings
  if (Array.isArray(raw['roles'])) {
    return (raw['roles'] as unknown[]).filter((r): r is string => typeof r === 'string');
  }

  const role = raw['role'];

  // Single string role name
  if (typeof role === 'string' && role.trim().length > 0) {
    return [role.trim()];
  }

  // Integer enum: 1 = Admin (0 = regular user)
  if (typeof role === 'number') {
    return role === 1 ? ['Admin'] : [];
  }

  return [];
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeDistrict(value: unknown): ListingDistrict | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = typeof raw['id'] === 'string' ? raw['id'] : '';
  if (id === '') {
    return null;
  }
  return {
    id,
    code: typeof raw['code'] === 'string' ? raw['code'] : '',
    nameEn: typeof raw['nameEn'] === 'string' ? raw['nameEn'] : '',
    nameHy: typeof raw['nameHy'] === 'string' ? raw['nameHy'] : '',
    nameRu: typeof raw['nameRu'] === 'string' ? raw['nameRu'] : '',
  };
}

/**
 * Maps the `homePoint` member of a raw `CurrentUserResponse` payload.
 *
 * Shared by BOTH hand-written /api/auth/me normalisers — `normalizeCurrentUser`
 * here and `normalizeUserProfile` in `profile-api.service.ts` — because a field
 * mapped in only one of them is silently dropped in the other (M-030). Same
 * precedent as `resolveRoles` above: one implementation, imported, never copied.
 *
 * Returns null for anything that is not an object carrying two finite
 * coordinates, which covers both "the user has no home point" (`homePoint:
 * null`) and a malformed payload.
 */
export function normalizeHomePoint(value: unknown): HomePoint | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const latitude = toFiniteNumber(raw['latitude']);
  const longitude = toFiniteNumber(raw['longitude']);
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    latitude,
    longitude,
    publicLatitude: toFiniteNumber(raw['publicLatitude']),
    publicLongitude: toFiniteNumber(raw['publicLongitude']),
    district: normalizeDistrict(raw['district']),
    updatedAt:
      typeof raw['updatedAt'] === 'string' && raw['updatedAt'].length > 0
        ? raw['updatedAt']
        : null,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>(toApiUrl(ApiContract.auth.login), payload)
      .pipe(map((response) => this.normalizeAuthResponse(response)));
  }

  /**
   * ADR-028: answers 201 `{ email, verificationRequired }` with NO token — the
   * account stays unverified until `verifyEmail`. Deliberately NOT routed through
   * `normalizeAuthResponse`, which must keep throwing on a token-less body.
   */
  register(payload: RegisterRequest): Observable<RegisterResponse> {
    return this.http
      .post<Record<string, unknown>>(toApiUrl(ApiContract.auth.register), payload)
      .pipe(map((response) => this.normalizeRegisterResponse(response, payload.email)));
  }

  /**
   * `POST /api/auth/verify-email` — the emailed link token AND the account
   * password. 200 `AuthResponse` (auto-login). A wrong password is 401
   * `auth.invalid_credentials` and does not consume the token.
   */
  verifyEmail(payload: VerifyEmailRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>(toApiUrl(ApiContract.auth.verifyEmail), payload)
      .pipe(map((response) => this.normalizeAuthResponse(response)));
  }

  /**
   * `POST /api/auth/resend-verification` — 202 with an EMPTY body, always (also
   * for unknown/verified emails). Read as text so an empty body is never JSON-parsed.
   */
  resendVerification(payload: ResendVerificationRequest): Observable<void> {
    return this.http
      .post(toApiUrl(ApiContract.auth.resendVerification), payload, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  externalAuth(payload: ExternalAuthRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>(toApiUrl(ApiContract.auth.external), payload)
      .pipe(map((response) => this.normalizeAuthResponse(response)));
  }

  getCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<Record<string, unknown>>(toApiUrl(ApiContract.auth.currentUser))
      .pipe(map((raw) => this.normalizeCurrentUser(raw)));
  }

  updatePreferredLanguage(code: string | null): Observable<CurrentUser> {
    return this.http
      .put<Record<string, unknown>>(toApiUrl(ApiContract.auth.updatePreferredLanguage), {
        preferredLanguage: code,
      })
      .pipe(map((raw) => this.normalizeCurrentUser(raw)));
  }

  /**
   * `PUT /api/auth/me/home-point` — saves/moves the home point and, server-side,
   * relocates every listing this user owns. Returns the refreshed
   * `CurrentUserResponse`. 400 `auth.home_point_outside_yerevan` when the pin is
   * outside the 12 districts (read via `getApiErrorCode`, not `errors.latitude`).
   */
  updateHomePoint(request: UpdateHomePointRequest): Observable<CurrentUser> {
    return this.http
      .put<Record<string, unknown>>(toApiUrl(ApiContract.auth.homePoint), request)
      .pipe(map((raw) => this.normalizeCurrentUser(raw)));
  }

  /**
   * `DELETE /api/auth/me/home-point` — clears the point. 409
   * `auth.home_point_in_use` while the user still owns any listing.
   */
  clearHomePoint(): Observable<CurrentUser> {
    return this.http
      .delete<Record<string, unknown>>(toApiUrl(ApiContract.auth.homePoint))
      .pipe(map((raw) => this.normalizeCurrentUser(raw)));
  }

  /** `PUT /api/auth/me/password` — 204 No Content on success, nothing to normalise. */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(toApiUrl(ApiContract.auth.changePassword), request);
  }

  private normalizeCurrentUser(raw: Record<string, unknown>): CurrentUser {
    return {
      id: typeof raw['id'] === 'string' ? raw['id'] : '',
      email: typeof raw['email'] === 'string' ? raw['email'] : '',
      firstName: typeof raw['firstName'] === 'string' ? raw['firstName'] : '',
      lastName: typeof raw['lastName'] === 'string' ? raw['lastName'] : '',
      preferredLanguage:
        typeof raw['preferredLanguage'] === 'string' && raw['preferredLanguage'].length > 0
          ? raw['preferredLanguage']
          : null,
      roles: resolveRoles(raw),
      homePoint: normalizeHomePoint(raw['homePoint']),
    };
  }

  private normalizeRegisterResponse(
    response: Record<string, unknown> | null,
    requestedEmail: string,
  ): RegisterResponse {
    const email = typeof response?.['email'] === 'string' ? response['email'].trim() : '';
    return {
      email: email !== '' ? email : requestedEmail,
      verificationRequired: response?.['verificationRequired'] !== false,
    };
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
