import type { ListingDistrict } from '../../../features/listings/models/district.model';
import type { MapLatLng } from '../map/map.component';

/**
 * How the browser's geolocation request is currently doing. Deliberately NOT a
 * boolean pair: `idle` is the state before anything was ever asked, and it is
 * the ONLY state the component may be in on load — the browser is never
 * consulted until the visitor taps "Use my location" (M-031: a geolocation
 * permission is a shared, single-use, origin-wide resource, so spending it is
 * never a local decision made at mount time).
 *
 * `denied` covers every rejection shape the browser can produce — permission
 * denied, position unavailable, timeout, no `navigator.geolocation` at all —
 * because the user-facing answer is the same in all four: "no problem, move the
 * map instead". See `GeolocationService.getCurrentPosition`'s own doc comment.
 */
export type HomePointGeoState = 'idle' | 'locating' | 'denied';

/**
 * Anything above this many metres of reported accuracy makes the fix a guess we
 * must visibly hedge rather than draw as a fact (M-027). 300 m is the threshold
 * from the approved boards' low-accuracy caption — an earlier draft said 500 m;
 * that draft is superseded.
 */
export const LOW_ACCURACY_THRESHOLD_METERS = 300;

/**
 * Everything a host of `app-home-point-map` needs to render its own chrome
 * (chip, status message, confirm button) without reaching into the map's
 * internals. Emitted on every meaningful change.
 */
export interface HomePointSelection {
  /** The coordinate currently under the crosshair. */
  center: MapLatLng;
  /**
   * The Yerevan district the crosshair resolves to, or `null` when it resolves
   * to none. `null` is the ONLY "this point cannot be saved" signal the client
   * gets — the backend refuses the same set of points with
   * `auth.home_point_outside_yerevan`, and there is deliberately no second tier
   * for "outside the country" (see `DistrictAtResponse`).
   */
  district: ListingDistrict | null;
  /** A district lookup is debouncing or in flight — the chip shows a spinner. */
  resolving: boolean;
  /**
   * `true` once a district lookup has settled on "no district". Kept separate
   * from `district === null` because the latter is also true before the very
   * first lookup has answered, when nothing has been refused yet.
   */
  outsideYerevan: boolean;
  /**
   * The point was chosen ON PURPOSE: the map was panned, a location fix
   * arrived, or the picker opened on an already-saved home point. A first open
   * on the default city centre is NOT deliberate, so Confirm stays disabled and
   * nobody saves Republic Square by accident.
   */
  deliberate: boolean;
  geoState: HomePointGeoState;
  /**
   * Reported accuracy (metres) of the last location fix when it exceeded
   * `LOW_ACCURACY_THRESHOLD_METERS`, else `null`. Carrying the error bar this
   * far is the whole point — a ±3 km fix and a ±20 m fix are the same
   * `{lat,lng}` without it (M-027).
   */
  lowAccuracyMeters: number | null;
  /** `deliberate && !resolving && !outsideYerevan` — the host's Confirm gate. */
  canConfirm: boolean;
}
