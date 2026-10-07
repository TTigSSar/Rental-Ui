import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type { MapLatLng, MapMarkerGroup } from '../../../shared/ui/map/map.component';
import type { ListingDistrict } from '../../listings/models/district.model';
import type { HomeSectionResponse } from '../models/home-section.model';

export const HomeSectionsActions = createActionGroup({
  source: 'Home Sections',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ sections: HomeSectionResponse[] }>(),
    'Load Failure': props<{ error: string }>(),
  },
});

/**
 * Hero map "nearby toys" preview (Home-page hero, Part 1 of the home-page
 * design alignment) — a Yerevan-fallback view by default, with an OPT-IN
 * geolocation upgrade. Kept as its own action group, not folded into
 * `HomeSectionsActions`: it is a fully independent async data source (an
 * optional browser-geolocation step, then an HTTP fetch) with its own
 * success/failure shape, following the same `createActionGroup` convention
 * `HomeSectionsActions` already does.
 *
 * **Geolocation is never requested automatically.** An earlier version of
 * this flow called `GeolocationService.getCurrentPosition()` from `init`
 * itself — i.e. the instant the landing page loaded, for every visitor. Two
 * problems with that (`/code-review` + `/security-review`, both flagged it):
 * a "Block" choice is stored per-ORIGIN by the browser, so the very first
 * Home visit could permanently disable the `/listings` radius filter's own
 * "use my location" button too (previously the only thing that ever
 * prompted); and precise visitor coordinates started reaching backend access
 * logs on nearly every page view, not just an intentional radius search.
 * Geolocation now only ever runs in response to `requestMyArea` — a real
 * click on the hero map's own opt-in control.
 *
 * Effect flow (`home.effects.ts`):
 * 1. `init` (dispatched by `HomePageComponent.ngOnInit`, alongside
 *    `HomeSectionsActions.load`) resolves — still with NO geolocation call —
 *    to one of two branches, decided by whether the signed-in user has a
 *    home point:
 *    - **No home point** (every anonymous visitor, and signed-in users who
 *      skipped the step): `useFallbackOrigin`. Yerevan-centred, pins from
 *      `YEREVAN_FALLBACK_BOUNDS`, a citywide count, no user dot, no radius
 *      circle — unchanged, and still the default for the large majority.
 *    - **Home point present**: `homeOriginResolved`, which centres the hero
 *      on their own area with the "Toys near your home" chip. Reading a
 *      coordinate the app was already given is not asking the browser for
 *      one, so this does not touch the geolocation permission (M-031) — the
 *      thing ADR-015 forbade was PROMPTING on load, not centring on load.
 *      The same action also fires on `loadCurrentUserSuccess`/
 *      `updateHomePointSuccess`/`clearHomePointSuccess`, because the profile
 *      can land after Home has already mounted and the point can move while
 *      the visitor is looking at it.
 * 2. `requestMyArea` (the hero map's own opt-in button, the ONLY trigger for
 *    `GeolocationService.getCurrentPosition()`) → granted: `originResolved`
 *    (origin = the visitor's own position, plus the browser's confidence
 *    radius) → a pins+count fetch scoped to `HOME_NEARBY_DEFAULT_RADIUS_KM`
 *    around it. Denied/failed: `useFallbackOrigin` — the SAME action `init`
 *    uses, since the resulting view is identical either way (Yerevan
 *    fallback); "denied" would be a lie for the `init` path, where nothing
 *    was ever asked, so this name covers both honestly.
 * 3. Either branch ends in `pinsLoadSuccess`/`pinsLoadFailure`.
 */
export const HomeNearbyActions = createActionGroup({
  source: 'Home Nearby',
  events: {
    Init: emptyProps(),
    'Request My Area': emptyProps(),
    'Origin Resolved': props<{ origin: MapLatLng; accuracyMeters: number | null }>(),
    /**
     * Home-point model: the hero centres on the signed-in user's own home
     * point. Its OWN action, not a reuse of `originResolved`, for two
     * reasons — it carries the district (for the chip's parameterised
     * "within {radius} of {district}" line) and it must NOT be mistaken for
     * a geolocation grant, which is what `originResolved` means everywhere
     * it is handled (blue dot, accuracy circle, opt-in button hidden).
     *
     * Emitted by `HomeEffects.resolveHomeOrigin$` from `init` and from the
     * auth actions that can change a home point, and never involves
     * `GeolocationService` — see `init`'s note below and M-031.
     */
    'Home Origin Resolved': props<{
      origin: MapLatLng;
      district: ListingDistrict | null;
    }>(),
    'Use Fallback Origin': emptyProps(),
    'Pins Load Success': props<{ pins: MapMarkerGroup[]; nearbyCount: number | null }>(),
    'Pins Load Failure': props<{ error: string }>(),
  },
});
