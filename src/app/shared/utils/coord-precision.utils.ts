/**
 * Coordinate precision policy for coordinates that LEAVE the client.
 *
 * Lifted out of `features/home/store/home.effects.ts`, which owned the only
 * copy of this rounding while it was the only outbound-coordinate caller. It
 * now belongs next to the other shared geo helpers
 * (`haversine-distance.utils.ts`) because the policy is applied at exactly
 * ONE seam — `ListingsApiService.buildSharedFilterParams`, the single place
 * that serializes `originLat`/`originLng` for both `GET /api/listings` and
 * `GET /api/listings/map-pins` — and that seam is shared by the catalogue,
 * the catalogue map and the Home hero.
 */

/** Decimals kept on an outbound coordinate — 3 ≈ 100 m at Yerevan's latitude. */
export const OUTBOUND_COORD_DECIMALS = 3;

const OUTBOUND_COORD_FACTOR = 10 ** OUTBOUND_COORD_DECIMALS;

/**
 * Rounds a coordinate to 3 decimal places (~100 m at this latitude) — the
 * precision this app already treats as publishable (backend map pins are
 * geohash-7 centroids, a comparable order of magnitude), and plenty to answer
 * "which toys are within N km of here".
 *
 * Applied ONLY to what leaves the client as `originLat`/`originLng` query
 * params (`/security-review`, Medium: query params land in server access
 * logs, proxy logs and browser history, so full-precision coordinates have no
 * business riding along on a request that only needs ~city-block precision).
 * It matters more, not less, now that an origin can be the renter's **home
 * point** (ADR-008 — the most sensitive coordinate this app holds, and one
 * the renter never deliberately "shares" the way they do a geolocation fix).
 *
 * Must NEVER be applied to a coordinate used for LOCAL display: the Home
 * hero's blue "you are here" dot and the listing-detail distance line both
 * keep full precision, because misplacing a visible dot by up to ~100 m buys
 * nothing. Keep that split — see `HomeEffects.loadNearbyPinsForOrigin$` and
 * `ListingLocationComponent.distanceKm`, both of which read the precise value
 * and let this seam coarsen only the request.
 */
export function roundCoordForApi(value: number): number {
  return Math.round(value * OUTBOUND_COORD_FACTOR) / OUTBOUND_COORD_FACTOR;
}
