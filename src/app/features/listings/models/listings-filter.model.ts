export interface ListingsFilter {
  query: string | null;
  city: string | null;
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  ageGroup: string | null;
  /**
   * Search radius in fractional kilometres (0.2–20), clamped by
   * `clampRadiusKm` below to match the backend's own clamp range (see
   * `RadiusOriginFilterComponent`/Maps P2 "location + radius" design). Only
   * takes effect once `ListingsState.originCoords` is set — the desktop
   * sidebar and mobile sheet both grey out their radius slider until then
   * (design decision #4: a sequencing hint, not a validation error), and
   * `ListingsApiService.buildListingsQueryParams` only emits `radiusKm`/
   * `originLat`/`originLng` when BOTH `radiusKm` and `originCoords` are
   * present. Renamed from the old discrete-km `maxDistance` (which paired
   * with a 4-pill `< 1 km`/`< 3 km`/`< 5 km`/`Any` picker) — the continuous
   * slider replacing that UI is a different enough value shape (fractional,
   * not one of 4 fixed integers) that keeping the old field name would have
   * been misleading; the backend's own query param was already `radiusKm`
   * (see `ListingsApiService`), so this also removes a frontend-only naming
   * mismatch. Serialized to the `radiusKm` URL param (see
   * `serializeRadiusKmParam`/`parseRadiusKmParam` below) — note this is a
   * URL-shape rename: a bookmarked `?maxDistance=5` link from before this
   * change no longer applies a filter (silently ignored, same as any other
   * unrecognized query key), which is acceptable pre-launch.
   */
  radiusKm: number | null;
  /**
   * Selected Yerevan district ids (Maps P1-7). Always an array — an empty
   * array means "no district filter applied" — so chip/URL logic has one
   * shape to handle instead of `string[] | null`'s two. Serialized to the
   * `districtIds` URL param as a comma-joined list (see
   * `serializeDistrictIdsParam`/`parseDistrictIdsParam` below) and to the API
   * as one repeated `districtIds` query key per id (see
   * `ListingsApiService.buildListingsQueryParams`).
   */
  districtIds: string[];
}

/**
 * Renter's device position, used only to compute distance-based sorting/
 * filtering for the current session. Never persisted (not part of
 * `ListingsFilter`, never written to the URL or storage) — session-only,
 * per Maps P2-3.
 */
export interface ListingsOriginCoords {
  lat: number;
  lng: number;
}

/**
 * How `ListingsState.originCoords` was obtained — drives which of the radius
 * filter's origin-summary copy variants (`RadiusOriginFilterComponent`)
 * renders ("From your home" / "From your location" / "From the chosen
 * point") and which distance-badge treatment the catalogue cards use (orange
 * home icon vs. blue location arrow — see `ListingCardComponent`).
 * Session-only, same treatment as `originCoords` itself (never persisted/
 * URL-serialized).
 *
 * `'home'` is the signed-in user's own home point (`CurrentUser.homePoint`,
 * ADR-008 — self-only, full precision in the store). It is set by
 * `ListingsEffects.defaultOriginToHomePoint$` the moment the user's profile
 * lands, but ONLY while no origin exists yet or the existing one is already
 * `'home'` — a deliberate `'geo'`/`'manual'` choice is never overwritten.
 *
 * It is NOT persisted and it does NOT by itself cause anything to be sent to
 * the API: `buildSharedFilterParams` still emits `originLat`/`originLng` only
 * alongside a `radiusKm` the renter actually chose (product decision, Tigran
 * 2026-10-05 — the renter's home coordinates must not ride along on every
 * catalogue request just because they happen to have a home point), and the
 * coordinates are rounded to 3 decimals on the way out.
 */
export type ListingsOriginSource = 'geo' | 'manual' | 'home';

/** Backend clamp range for `radiusKm` (`rental-api`, commit `d0955e0`) — mirrored
 *  here so the slider/URL never show a value the API would silently reclamp. */
export const RADIUS_MIN_KM = 0.2;
export const RADIUS_MAX_KM = 20;

export function clampRadiusKm(km: number): number {
  return Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, km));
}

/**
 * Parses the `radiusKm` URL param into a clamped, finite number, or `null`
 * for anything absent/garbage — same tolerant treatment as
 * `parseDistrictIdsParam`: a bad URL degrades to "no radius filter", never a
 * crash or a NaN reaching `ListingsApiService`.
 */
export function parseRadiusKmParam(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? clampRadiusKm(parsed) : null;
}

/** Inverse of `parseRadiusKmParam`: rounds to 2 decimals (matches the slider's
 *  own precision — see `radius-scale.util.ts`) so the URL never grows a long
 *  float tail, or `null` when there's no radius filter to serialize. */
export function serializeRadiusKmParam(km: number | null): string | null {
  if (km === null) return null;
  return String(Math.round(clampRadiusKm(km) * 100) / 100);
}

/**
 * Month bounds sent to the API for an `ageGroup` token. Single source of
 * truth for the `<from>-<to>` / `<from>+` token shape shared by the
 * `AGE_GROUPS` UI list (listings-page.component.ts) and
 * `ListingsApiService.buildListingsQueryParams()` — keeps the two in
 * agreement without duplicating the mapping.
 */
export interface AgeGroupMonthRange {
  ageFromMonths: number;
  ageToMonths: number | null;
}

const AGE_GROUP_TOKEN_PATTERN = /^(\d+)-(\d+)$/;
const AGE_GROUP_OPEN_ENDED_SUFFIX = '+';

/**
 * Parses an `ageGroup` token (`"0-12"`, `"12-36"`, ..., `"120+"`) into the
 * `ageFromMonths`/`ageToMonths` bounds the API expects. Returns `null` for an
 * unrecognized token so callers can skip emitting the param rather than
 * sending garbage.
 */
export function parseAgeGroupToMonths(token: string): AgeGroupMonthRange | null {
  if (token.endsWith(AGE_GROUP_OPEN_ENDED_SUFFIX)) {
    const from = Number(token.slice(0, -AGE_GROUP_OPEN_ENDED_SUFFIX.length));
    return Number.isFinite(from) ? { ageFromMonths: from, ageToMonths: null } : null;
  }

  const match = AGE_GROUP_TOKEN_PATTERN.exec(token);
  if (!match) {
    return null;
  }

  const ageFromMonths = Number(match[1]);
  const ageToMonths = Number(match[2]);
  if (!Number.isFinite(ageFromMonths) || !Number.isFinite(ageToMonths)) {
    return null;
  }

  return { ageFromMonths, ageToMonths };
}

const GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Parses the comma-joined `districtIds` URL param into a clean id list.
 * Anything that isn't a well-formed GUID — empty segments, stray whitespace,
 * garbage a user typed by hand — is silently dropped rather than thrown, the
 * same tolerant treatment `parseAgeGroupToMonths` gives its own token: a bad
 * URL should degrade to "no district filter", never a crash.
 */
export function parseDistrictIdsParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => GUID_PATTERN.test(segment));
}

/** Inverse of `parseDistrictIdsParam`: comma-joins ids for the URL, or `null` when empty (so the param is omitted rather than written as `""`). */
export function serializeDistrictIdsParam(ids: readonly string[]): string | null {
  return ids.length > 0 ? ids.join(',') : null;
}
