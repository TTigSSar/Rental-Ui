import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { GeolocationService } from '../../../../shared/services/geolocation.service';
import { LanguageService } from '../../../../shared/services/language.service';
import {
  selectHasHomePoint,
  selectHomePoint,
} from '../../../auth/store/auth.selectors';
import { districtDisplayName } from '../../models/district-ui.util';
import { MapComponent } from '../../../../shared/ui/map/map.component';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';
import {
  formatDistanceMeters,
  localeTagForLanguage,
  metersToSliderValue,
  RADIUS_PRESET_METERS,
  RADIUS_SLIDER_MAX,
  RADIUS_SLIDER_MIN,
  sliderValueToMeters,
} from '../../models/radius-scale.util';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingsOriginCoords,
  selectListingsOriginDenied,
  selectListingsOriginSource,
} from '../../store/listings.selectors';
import { LocationPickerComponent } from '../../../../shared/ui/location-picker/location-picker.component';
import { YEREVAN_CENTER } from '../../../../shared/ui/map/map.constants';

/** Default radius (metres) auto-selected the moment an origin becomes set
 *  with no radius chosen yet — matches the approved design mockup's own
 *  default preset ("1 km") so unlocking the slider always shows a working
 *  value instead of a dead 200 m floor. */
const DEFAULT_RADIUS_METERS = 1000;

/** Slider-scale tolerance for "is this preset the active one" — mirrors the
 *  approved design mockup's own `<25` highlight threshold (on the same
 *  0–1000 slider scale), converted here via `metersToSliderValue` rather
 *  than compared in raw metres (which would need a different tolerance per
 *  step size). */
const PRESET_ACTIVE_TOLERANCE = 25;

export type RadiusOriginState = 'unset' | 'geo' | 'manual' | 'denied' | 'home';

/**
 * Shared "reference point + search radius" filter control (Maps P2
 * "location + radius" design, screens 3–5) — the single source of markup and
 * behaviour used by BOTH the desktop sidebar (`ListingsPageComponent`) and
 * the mobile bottom sheet (`ListingsFiltersComponent`), so the two surfaces
 * can never drift apart the way `districtIds` deliberately doesn't either.
 *
 * Owns the origin (geolocation / manual-pick / denied) UI and dispatch
 * directly — via the shared `ListingsState.originCoords`/`originSource`/
 * `originDenied` slice, session-only and never part of the URL (Maps P2-3) —
 * since that behaviour is byte-for-byte identical on both surfaces. The
 * RADIUS value itself is fully controlled by the parent (`radiusMeters`
 * in / `radiusMetersChange` out) because the two surfaces commit it
 * differently: the desktop sidebar applies immediately (merge-navigates on
 * every change, like every other sidebar control); the mobile sheet stages
 * it in a draft until "Show N" is tapped (like every other sheet field) —
 * see `listings-filters.component.ts`'s M-021 doc comment for why that
 * component is careful about which fields it owns and how it commits them.
 *
 * Clear path (Trello #80): a "Remove" action next to "Change" on the `geo`/
 * `manual` cards dispatches `ListingsActions.clearOrigin()` then emits
 * `originCleared` — the parent reacts by nulling `radiusKm` in the URL
 * (again with its own commit timing). The dispatch-before-emit order lets
 * the auto-default effect below observe `hasOrigin === false` and reset
 * `defaultRequested`, so picking a point again re-selects the 1 km default.
 */
@Component({
  selector: 'app-radius-origin-filter',
  standalone: true,
  imports: [LocationPickerComponent, MapComponent, TranslatePipe],
  templateUrl: './radius-origin-filter.component.html',
  styleUrl: './radius-origin-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadiusOriginFilterComponent {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly geolocation = inject(GeolocationService);

  /** Controlled radius value in METRES, or `null` when no radius is chosen
   *  yet (always the case while `locked()`). Meters, not km, purely because
   *  the slider math (`radius-scale.util.ts`) is metre-based — parents that
   *  store the filter in km (`ListingsFilter.radiusKm`) convert at their own
   *  boundary via `metersToKm`/`kmToMeters`. */
  readonly radiusMeters = input<number | null>(null);
  readonly radiusMetersChange = output<number>();

  /** Emitted AFTER `clearOrigin()` dispatches `ListingsActions.clearOrigin()`
   *  — tells the parent to also null `radiusKm` in its own owned URL/draft
   *  state (Trello #80). The widget itself never touches the radius value. */
  readonly originCleared = output<void>();

  protected readonly originCoords = this.store.selectSignal(selectListingsOriginCoords);
  protected readonly originSource = this.store.selectSignal(selectListingsOriginSource);
  protected readonly originDenied = this.store.selectSignal(selectListingsOriginDenied);
  private readonly homePoint = this.store.selectSignal(selectHomePoint);

  protected readonly originState = computed((): RadiusOriginState => {
    if (this.originCoords() !== null) {
      const source = this.originSource();
      if (source === 'home') return 'home';
      return source === 'manual' ? 'manual' : 'geo';
    }
    return this.originDenied() ? 'denied' : 'unset';
  });

  protected readonly locked = computed(() => this.originCoords() === null);

  /**
   * Home-point model. `true` for a signed-in user who has a home point —
   * the ONLY gate on the "From your home" option existing at all.
   *
   * Hidden, never rendered-disabled, when false (approved design, section
   * (a) tab "Logged in · no home point"): a disabled row would advertise a
   * feature with no affordance to reach it from here, and this control is not
   * where a home point gets set (that is the profile card / sign-up step).
   * With it false, this filter is byte-for-byte what it has always been —
   * which is also why anonymous visitors, the overwhelming majority of
   * catalogue traffic, see zero change from this feature.
   */
  protected readonly hasHomePoint = this.store.selectSignal(selectHasHomePoint);

  /** The renter's own home district, for the home row's subtitle
   *  ("{District} · your home point" — approved design). `null` when there is
   *  no home point, or when the saved point resolved to no Yerevan district
   *  (a legal `HomePoint` state the model allows), in which case the subtitle
   *  falls back to the district-less wording. */
  protected readonly homeDistrictName = computed<string | null>(() => {
    const district = this.homePoint()?.district ?? null;
    return district
      ? districtDisplayName(district, this.languageService.current().code)
      : null;
  });

  /**
   * `true` while an origin exists but the renter has not chosen a radius —
   * the approved design's default state for a home origin: the value reads
   * "Any distance" with the hint "Pick a radius to filter", the slider thumb
   * sits at the floor in the neutral (grey) treatment, and the presets are
   * all shown unselected.
   *
   * This state is REACHABLE ONLY because `autoDefaultRadius$` below refuses
   * to fire for a `'home'` origin. It is the user-visible half of the
   * product decision that nothing is filtered — and no coordinates sent —
   * until the renter asks: an origin that silently brought a 1 km radius with
   * it would both narrow results the renter never narrowed and put the home
   * coordinates on the wire on the very first catalogue request.
   */
  protected readonly noRadiusChosen = computed(() => this.radiusMeters() === null);

  protected readonly pickerOpen = signal(false);
  protected readonly pickerInitialCenter = computed<MapLatLng>(
    () => this.originCoords() ?? YEREVAN_CENTER,
  );

  // Instant visual feedback while dragging — committed only on `change`
  // (pointer/key release) or a preset click, so navigating doesn't fire on
  // every pixel of drag (see `onSliderInput` vs `onSliderCommit` below).
  private readonly liveSliderValue = signal<number | null>(null);

  private readonly committedSliderValue = computed(() =>
    metersToSliderValue(this.radiusMeters() ?? DEFAULT_RADIUS_METERS),
  );

  protected readonly effectiveSliderValue = computed(
    () => this.liveSliderValue() ?? this.committedSliderValue(),
  );

  protected readonly effectiveMeters = computed(() =>
    sliderValueToMeters(this.effectiveSliderValue()),
  );

  /**
   * What the slider thumb/track RENDER at — identical to
   * `effectiveSliderValue` except in the `noRadiusChosen` state, where it
   * pins to the scale floor so an unchosen radius doesn't draw a filled
   * track at the 1 km default and read as a selection.
   *
   * Kept separate from `effectiveSliderValue` (which still feeds
   * `effectiveMeters` → the picker's radius preview) so that dragging the
   * thumb off the floor commits a real value through the normal path: the
   * live drag writes `liveSliderValue`, which makes `effectiveSliderValue`
   * non-null, and `noRadiusChosen` only flips once the parent echoes the
   * committed radius back.
   */
  protected readonly displaySliderValue = computed(() =>
    this.noRadiusChosen() && this.liveSliderValue() === null
      ? RADIUS_SLIDER_MIN
      : this.effectiveSliderValue(),
  );

  protected readonly localeTag = computed(() =>
    localeTagForLanguage(this.languageService.current().code),
  );

  protected readonly formattedRadius = computed(() =>
    formatDistanceMeters(this.effectiveMeters(), this.localeTag(), {
      meters: this.translate.instant('listings.filters.distance.unitMeters'),
      kilometers: this.translate.instant('listings.filters.distance.unitKilometers'),
    }),
  );

  protected readonly sliderMin = RADIUS_SLIDER_MIN;
  protected readonly sliderMax = RADIUS_SLIDER_MAX;
  protected readonly presets = RADIUS_PRESET_METERS;

  // Guards the auto-default-on-origin-set below so it fires at most once per
  // "origin just became set" transition, even if a parent were slow to echo
  // the emitted value back into `radiusMeters` — see the field's own comment.
  private defaultRequested = false;

  constructor() {
    // Design decision #4: once an origin becomes available, the radius
    // slider unlocks already showing a usable value (matches the approved
    // mockup's geo/manual/applied panels, all of which show a preset
    // already selected) instead of an unlocked-but-still-empty control.
    //
    // EXCEPT for a `'home'` origin, which is the one origin the renter did
    // not ask for — it is set for them the moment their profile loads (see
    // `ListingsEffects.defaultOriginToHomePoint$`). Auto-selecting a radius
    // there would (a) narrow the catalogue the instant a signed-in user with
    // a home point opens it, with no action of theirs, and (b) put their home
    // coordinates on the wire on that first request, since the API seam sends
    // the origin exactly when a `radiusKm` exists. Both are the thing the
    // product decision of 2026-10-05 exists to prevent, so the home origin
    // stays at "Any distance" until the renter picks a radius themselves
    // (`noRadiusChosen` above renders that state).
    //
    // `'geo'` and `'manual'` are unchanged: those arrive only from a
    // deliberate click, so unlocking the slider on a dead floor value is the
    // dead-control problem #4 was written about.
    effect(() => {
      const hasOrigin = this.originCoords() !== null;
      if (!hasOrigin) {
        this.defaultRequested = false;
        return;
      }
      if (this.originSource() === 'home') {
        return;
      }
      if (this.radiusMeters() === null && !this.defaultRequested) {
        this.defaultRequested = true;
        this.radiusMetersChange.emit(DEFAULT_RADIUS_METERS);
      }
    });
  }

  protected formatPreset(meters: number): string {
    return formatDistanceMeters(meters, this.localeTag(), {
      meters: this.translate.instant('listings.filters.distance.unitMeters'),
      kilometers: this.translate.instant('listings.filters.distance.unitKilometers'),
    });
  }

  protected isPresetActive(meters: number): boolean {
    return (
      Math.abs(metersToSliderValue(meters) - this.effectiveSliderValue()) <
      PRESET_ACTIVE_TOLERANCE
    );
  }

  protected selectPreset(meters: number): void {
    this.liveSliderValue.set(null);
    this.radiusMetersChange.emit(meters);
  }

  protected onSliderInput(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    this.liveSliderValue.set(raw);
  }

  protected onSliderCommit(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const meters = sliderValueToMeters(raw);
    this.liveSliderValue.set(null);
    this.radiusMetersChange.emit(meters);
  }

  /**
   * "From your home" row — selects the renter's own home point as the origin.
   *
   * No permission prompt, no network call, no picker: the coordinate is
   * already in the auth store (`CurrentUser.homePoint`, self-only per
   * ADR-008). A no-op when there is no home point, which the template also
   * guarantees by not rendering the row at all.
   *
   * Dispatches the SAME action the auto-default effect does, so switching
   * back from `'geo'`/`'manual'` lands in exactly the state a fresh page
   * load would have produced — with one deliberate difference: whatever
   * radius the renter had already chosen is kept rather than reset to "Any
   * distance". They picked that radius; changing the point they measure from
   * is not a reason to un-pick it.
   */
  protected selectHomeOrigin(): void {
    const homePoint = this.homePoint();
    if (homePoint === null) return;
    this.store.dispatch(
      ListingsActions.setOriginCoords({
        coords: { lat: homePoint.latitude, lng: homePoint.longitude },
        source: 'home',
      }),
    );
  }

  protected requestGeolocation(): void {
    this.geolocation.getCurrentPosition().then(
      (coords) => {
        // Explicitly narrowed to `{ lat, lng }` — `coords` is a
        // `GeolocatedPoint` (`GeolocationService`) and also carries
        // `accuracyMeters`, which has no business in NgRx state: it isn't
        // part of `ListingsOriginCoords`, and letting it ride along on the
        // object itself (rather than being dropped here) would be dead
        // weight riding a state tree that's otherwise a plain serializable
        // shape. The radius filter has no accuracy-aware UI of its own —
        // only the listing-detail page (`ListingLocationComponent`) does.
        this.store.dispatch(
          ListingsActions.setOriginCoords({
            coords: { lat: coords.lat, lng: coords.lng },
            source: 'geo',
          }),
        );
      },
      () => {
        // No toast here (product decision, 2026-07-26): a denial already
        // reaches the UI via `originDenied` → `originState() === 'denied'`,
        // which renders this same component's own soft "denied" card
        // (design decision #5's calm, non-alarming treatment). A PrimeNG
        // warn toast on top of that card duplicated the same message in a
        // visually louder register, contradicting #5's intent.
        this.store.dispatch(ListingsActions.setOriginDenied());
      },
    );
  }

  protected openPicker(): void {
    this.pickerOpen.set(true);
  }

  protected onPickerCancelled(): void {
    this.pickerOpen.set(false);
  }

  protected onPickerConfirmed(center: MapLatLng): void {
    this.pickerOpen.set(false);
    this.store.dispatch(
      ListingsActions.setOriginCoords({ coords: center, source: 'manual' }),
    );
  }

  /** "Remove" button on the `geo`/`manual` cards — dispatches first so the
   *  auto-default effect's `hasOrigin` read sees the cleared state before
   *  the parent's own `originCleared` handler runs (see class doc comment). */
  protected clearOrigin(): void {
    this.store.dispatch(ListingsActions.clearOrigin());
    this.originCleared.emit();
  }

}
