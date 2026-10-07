import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, forkJoin, from, map, of, switchMap, withLatestFrom } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import * as AuthActions from '../../auth/store/auth.actions';
import { selectHomePoint } from '../../auth/store/auth.selectors';
import { GeolocationService } from '../../../shared/services/geolocation.service';
import type { MapMarkerGroup } from '../../../shared/ui/map/map.component';
import { YEREVAN_CENTER } from '../../../shared/ui/map/map.constants';
import type { ListingMapPin } from '../../listings/models/listing-map-pin.model';
import { groupPinsByCoordinate } from '../../listings/models/listing-pin-group.util';
import type { MapPinsBounds } from '../../listings/models/map-pins-bounds.model';
import type {
  ListingsFilter,
  ListingsOriginCoords,
} from '../../listings/models/listings-filter.model';
import { ListingsApiService } from '../../listings/services/listings-api.service';
import { initialListingsState } from '../../listings/store/listings.state';
import { HomeApiService } from '../services/home-api.service';
import { HomeNearbyActions, HomeSectionsActions } from './home.actions';
import { HOME_NEARBY_DEFAULT_RADIUS_KM } from './home.state';

/**
 * A roughly citywide box around `YEREVAN_CENTER` (~10km lat, ~13km lng at
 * this latitude) — used ONLY as the hero map's pin fetch when showing the
 * Yerevan fallback (`HomeNearbyActions.useFallbackOrigin`). Not derived from
 * `radius-scale.util.ts`'s metre math (that converts a RADIUS to a slider
 * position; this is a fixed fallback viewport, not a radius), and not a
 * precision claim — just "enough of the city to show some pins" for a
 * decorative preview map, matching the app's Yerevan-only MVP scope.
 */
const YEREVAN_FALLBACK_BOUNDS: MapPinsBounds = {
  minLat: YEREVAN_CENTER.lat - 0.045,
  maxLat: YEREVAN_CENTER.lat + 0.045,
  minLng: YEREVAN_CENTER.lng - 0.06,
  maxLng: YEREVAN_CENTER.lng + 0.06,
};

/**
 * `ListingMapPin[]` -> `MapMarkerGroup[]`, reusing `ListingsMapComponent`'s
 * OWN coordinate-grouping convention (`groupPinsByCoordinate` — pins sharing
 * the exact fuzzed/geohash-cell-centroid coordinate become one group, `key`
 * is that coordinate pair formatted to 6 decimals) rather than inventing a
 * second one for the hero map.
 */
function mapPinsToMarkerGroups(pins: ListingMapPin[]): MapMarkerGroup[] {
  return groupPinsByCoordinate(pins).map((group) => ({
    key: group.key,
    position: { lat: group.latitude, lng: group.longitude },
    count: group.pins.length,
  }));
}

@Injectable()
export class HomeEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly homeApi = inject(HomeApiService);
  private readonly listingsApi = inject(ListingsApiService);
  private readonly geolocation = inject(GeolocationService);

  readonly loadSections$ = createEffect(() =>
    this.actions$.pipe(
      ofType(HomeSectionsActions.load),
      switchMap(() =>
        this.homeApi.getHomeSections(4).pipe(
          map((sections) => HomeSectionsActions.loadSuccess({ sections })),
          catchError((error: unknown) =>
            of(
              HomeSectionsActions.loadFailure({
                error: error instanceof Error ? error.message : 'Failed to load toy sections',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * `init` (Home page mount) never calls geolocation — see
   * `HomeNearbyActions`'s own doc comment for why. It is still a pure,
   * synchronous re-map; it now picks between TWO destinations by reading the
   * signed-in user's home point out of the store:
   *
   * - a home point exists → `homeOriginResolved`, the hero centres on their
   *   own area ("Toys near your home");
   * - otherwise → `useFallbackOrigin`, the unchanged Yerevan citywide view.
   *
   * Reading `selectHomePoint` is a store read, not a permission request: the
   * coordinate arrived on `/api/auth/me` because the user put it there. What
   * ADR-015 and M-031 forbid is PROMPTING the browser on page load, and
   * neither branch here can do that — `GeolocationService` is still reachable
   * only from `requestMyArea`.
   *
   * It also re-fires on the three auth actions that can change the answer,
   * because Home's own effects are route-scoped and mount independently of
   * the auth bootstrap: `/api/auth/me` routinely resolves AFTER the hero has
   * already painted its fallback, the user can move their point from the
   * profile and come back, and they can delete it. Each of those has to
   * re-decide the branch rather than leave the hero showing a view that was
   * correct a moment ago. `logout` is in the same list and needs no special
   * branch: with the user gone, `selectHomePoint` is `null` and the generic
   * "no home point" arm already produces exactly the right result — the
   * citywide fallback an anonymous visitor would have seen.
   */
  readonly resolveHomeOrigin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        HomeNearbyActions.init,
        AuthActions.loadCurrentUserSuccess,
        AuthActions.updateHomePointSuccess,
        AuthActions.clearHomePointSuccess,
        AuthActions.logout,
      ),
      withLatestFrom(this.store.select(selectHomePoint)),
      map(([, homePoint]) =>
        homePoint === null
          ? HomeNearbyActions.useFallbackOrigin()
          : HomeNearbyActions.homeOriginResolved({
              origin: { lat: homePoint.latitude, lng: homePoint.longitude },
              district: homePoint.district,
            }),
      ),
    ),
  );

  /**
   * Home branch: pins AND the count within `HOME_NEARBY_DEFAULT_RADIUS_KM`
   * of the user's own home point — the same pair of requests the granted
   * geolocation branch makes, so the two counts mean the same thing
   * ("within {radius} of this point") and can share the chip's copy.
   *
   * The origin is handed over at FULL precision and coarsened to 3 dp by the
   * one seam that owns that policy (`ListingsApiService
   * .buildSharedFilterParams`). That is the same treatment a live fix gets,
   * and it matters more here, not less: this is the renter's home.
   */
  readonly loadNearbyPinsForHome$ = createEffect(() =>
    this.actions$.pipe(
      ofType(HomeNearbyActions.homeOriginResolved),
      switchMap(({ origin }) => {
        const filter: ListingsFilter = {
          ...initialListingsState.filters,
          radiusKm: HOME_NEARBY_DEFAULT_RADIUS_KM,
        };
        const originCoords: ListingsOriginCoords = { lat: origin.lat, lng: origin.lng };
        return forkJoin({
          pins: this.listingsApi.getMapPins(filter, null, originCoords),
          count: this.listingsApi.getListings(filter, 1, 1, originCoords),
        }).pipe(
          map(({ pins, count }) =>
            HomeNearbyActions.pinsLoadSuccess({
              pins: mapPinsToMarkerGroups(pins.items),
              nearbyCount: count.totalCount,
            }),
          ),
          catchError((error: unknown) =>
            of(HomeNearbyActions.pinsLoadFailure({ error: toApiErrorMessage(error) })),
          ),
        );
      }),
    ),
  );

  /**
   * `requestMyArea` — the hero map's own opt-in control, and the ONLY thing
   * in this codebase that triggers `GeolocationService.getCurrentPosition()`
   * for the Home page. `getCurrentPosition()` already resolves/rejects with
   * every case (denied, unsupported, position-unavailable, timeout) folded
   * into one promise settlement, so a rejection here always degrades to
   * `useFallbackOrigin` — never a hard error surfaced to the visitor (a
   * denial must never read as "something broke").
   */
  readonly resolveNearbyOrigin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(HomeNearbyActions.requestMyArea),
      switchMap(() =>
        from(this.geolocation.getCurrentPosition()).pipe(
          map((point) =>
            HomeNearbyActions.originResolved({
              origin: { lat: point.lat, lng: point.lng },
              accuracyMeters: point.accuracyMeters,
            }),
          ),
          catchError(() => of(HomeNearbyActions.useFallbackOrigin())),
        ),
      ),
    ),
  );

  /** Granted branch: pins AND the total count within
   *  `HOME_NEARBY_DEFAULT_RADIUS_KM` of the visitor's own position —
   *  `pageSize: 1` on the count request since only `totalCount` is read
   *  (there is no dedicated count-near-a-point endpoint; see the class doc
   *  comment in the feature spec this implements). Deliberately builds its
   *  OWN filter from `initialListingsState.filters` rather than reading
   *  `ListingsState.filters`/`originCoords` — the hero preview must never be
   *  affected by whatever the visitor last searched/set on `/listings`, and
   *  must never write into that state either (`ListingsActions.loadMapPins`
   *  is never dispatched here).
   *
   *  `origin` is passed through at FULL precision and coarsened to 3 dp
   *  (~100 m) by the one seam that owns that policy —
   *  `ListingsApiService.buildSharedFilterParams`, via
   *  `shared/utils/coord-precision.utils.ts`'s `roundCoordForApi`. This
   *  effect used to own a private copy of that rounding; it no longer does,
   *  because the home-point work added a second kind of outbound origin (the
   *  renter's own home point, ADR-008) and a policy applied in two places is
   *  a policy one of them will eventually forget. The precise-vs-rounded
   *  split is unchanged and still load-bearing: `origin` (full precision,
   *  from the `originResolved` payload) is what reached the store and drives
   *  the blue `userPin` dot, so it still sits exactly where the visitor is;
   *  only the OUTGOING query params are coarsened. */
  readonly loadNearbyPinsForOrigin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(HomeNearbyActions.originResolved),
      switchMap(({ origin }) => {
        const filter: ListingsFilter = {
          ...initialListingsState.filters,
          radiusKm: HOME_NEARBY_DEFAULT_RADIUS_KM,
        };
        const originCoords: ListingsOriginCoords = { lat: origin.lat, lng: origin.lng };
        return forkJoin({
          pins: this.listingsApi.getMapPins(filter, null, originCoords),
          count: this.listingsApi.getListings(filter, 1, 1, originCoords),
        }).pipe(
          map(({ pins, count }) =>
            HomeNearbyActions.pinsLoadSuccess({
              pins: mapPinsToMarkerGroups(pins.items),
              nearbyCount: count.totalCount,
            }),
          ),
          catchError((error: unknown) =>
            of(HomeNearbyActions.pinsLoadFailure({ error: toApiErrorMessage(error) })),
          ),
        );
      }),
    ),
  );

  /** Fallback branch (default on `init`, and the outcome of a denied/failed
   *  `requestMyArea`): pins around Yerevan only (`YEREVAN_FALLBACK_BOUNDS`),
   *  no origin — but the pill still shows whenever the pins response alone
   *  can honestly answer "how many": `getMapPins` reports `isTruncated`, so
   *  `!isTruncated` means the backend returned EVERY pin inside the fallback
   *  box, and `items.length` IS the true count, not an estimate — no second
   *  request needed. `isTruncated === true` means the backend capped the
   *  response, so `items.length` would only be a FLOOR, not a count;
   *  rendering a truncated floor as a definitive figure is exactly the
   *  "guess rendered as a fact" failure recorded as M-027 in
   *  knowledge/mistakes.md — so this leaves `nearbyCount: null` (pill stays
   *  hidden) rather than showing a misleading number or a vague "50+".
   *
   *  Note the count means something different per branch: "within
   *  `HOME_NEARBY_DEFAULT_RADIUS_KM` of you" when granted
   *  (`loadNearbyPinsForOrigin$` above) vs. "in the visible Yerevan fallback
   *  area" here — both are honest, just answering slightly different
   *  questions, which is why `HomeHeroMapComponent` renders them through TWO
   *  separate i18n keys (`nearbyCount` / `cityCount`) rather than one shared
   *  string that would read as a proximity claim the fallback number cannot
   *  support. */
  readonly loadNearbyPinsForYerevan$ = createEffect(() =>
    this.actions$.pipe(
      ofType(HomeNearbyActions.useFallbackOrigin),
      switchMap(() =>
        this.listingsApi
          .getMapPins(initialListingsState.filters, YEREVAN_FALLBACK_BOUNDS, null)
          .pipe(
            map((result) =>
              HomeNearbyActions.pinsLoadSuccess({
                pins: mapPinsToMarkerGroups(result.items),
                nearbyCount: result.isTruncated ? null : result.items.length,
              }),
            ),
            catchError((error: unknown) =>
              of(HomeNearbyActions.pinsLoadFailure({ error: toApiErrorMessage(error) })),
            ),
          ),
      ),
    ),
  );
}
