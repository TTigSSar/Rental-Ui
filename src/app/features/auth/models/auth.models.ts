import type { ListingDistrict } from '../../listings/models/district.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export type ExternalAuthProvider = 'google' | 'apple';

export interface ExternalAuthRequest {
  provider: ExternalAuthProvider;
  idToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  /**
   * Optional home-point step at sign-up (skippable — home-point model).
   * BOTH-OR-NEITHER: send both or send neither, or the backend answers 400 with
   * a field-level validation message ("Both latitude and longitude are required
   * together."). Mirrors `RegisterRequest.HomeLatitude/HomeLongitude`.
   *
   * A point outside the 12 Yerevan districts is refused with the `ServiceError`
   * `auth.home_point_outside_yerevan` (400) — read it via `getApiErrorCode()`,
   * NOT from `errors.homeLatitude` (see `ApiProblemDetails`).
   */
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  /** UI language at sign-up (`en` | `hy` | `ru`); picks the verification-email language. */
  preferredLanguage?: string | null;
}

/**
 * BREAKING (ADR-028): `POST /api/auth/register` now answers 201 with this body and NO
 * token (was 200 `AuthResponse`). The account is unverified until `verify-email`.
 * Mirrors `RegisterResponse`.
 */
export interface RegisterResponse {
  email: string;
  verificationRequired: boolean;
}

/** Body of `POST /api/auth/verify-email` — both required. Answers 200 `AuthResponse`. */
export interface VerifyEmailRequest {
  token: string;
  password: string;
}

/** Body of `POST /api/auth/resend-verification` — answers 202 with an empty body, always. */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * The signed-in user's single home point — the one place every listing they own
 * is shown from (home-point model). Mirrors `HomePointResponse`.
 *
 * SELF-ONLY. This shape is served exclusively on `CurrentUserResponse`
 * (`GET/PUT/DELETE /api/auth/me[/home-point]`), never on a public profile, a
 * listing, a listing map pin, or any other user's data. Do not copy it onto a
 * model that is rendered for anyone other than its owner.
 */
export interface HomePoint {
  /**
   * The EXACT point the user dropped — full precision, not the rounded/
   * geohash-cell value other people see. Only ever leaves the server on the
   * owner's own `/api/auth/me` payload (ADR-008). Never render, log, or forward
   * these two to another user.
   */
  latitude: number;
  longitude: number;
  /**
   * The approximated pair every listing of this owner publishes (geohash-cell
   * centroid) — this is what non-owners are allowed to see. Null only while the
   * backend has not derived it yet.
   */
  publicLatitude: number | null;
  publicLongitude: number | null;
  /**
   * The Yerevan district the point resolves to, or null when it resolves to
   * none. Same `ListingDistrictResponse` shape the catalogue uses.
   */
  district: ListingDistrict | null;
  /** When the point was last saved/moved. Null when never set. */
  updatedAt: string | null;
}

/** Body of `PUT /api/auth/me/home-point` — mirrors `UpdateHomePointRequest`. */
export interface UpdateHomePointRequest {
  latitude: number;
  longitude: number;
}

/**
 * `GET /api/districts/at?lat=&lng=` — mirrors `DistrictAtResponse`.
 *
 * `district: null` means the coordinate is in no Yerevan district, which is
 * exactly the set of points the write side refuses
 * (`auth.home_point_outside_yerevan`). It is the ONLY "cannot save this point"
 * signal: there is no `inArmenia` field and deliberately no second tier of
 * "outside the country" — both cases are refused identically.
 */
export interface DistrictAtResponse {
  district: ListingDistrict | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredLanguage?: string | null;
  roles: string[];
  /**
   * Self-only (see `HomePoint`). Null when the user has not set a point yet —
   * which is also the state in which creating a listing fails with 409
   * `listing.home_point_required`.
   */
  homePoint: HomePoint | null;
}

export interface AuthResponse {
  token: string;
  expiresAt: string | null;
  user?: CurrentUser;
}

export interface BackendAuthResponse {
  token?: string;
  accessToken?: string;
  expiresAt?: string | null;
  user?: CurrentUser;
}
