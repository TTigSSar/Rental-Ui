import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';

import { ListingsApiService } from '../../../features/listings/services/listings-api.service';
import type { ListingDistrict } from '../../../features/listings/models/district.model';
import { districtDisplayName } from '../../../features/listings/models/district-ui.util';
import { GeolocationService } from '../../services/geolocation.service';
import { LanguageService } from '../../services/language.service';
import { MapComponent } from '../map/map.component';
import type { MapLatLng } from '../map/map.component';
import { DEFAULT_PICKER_ZOOM, YEREVAN_CENTER } from '../map/map.constants';
import {
  LOW_ACCURACY_THRESHOLD_METERS,
  type HomePointGeoState,
  type HomePointSelection,
} from './home-point-map.model';

/** Pan-stop → district lookup delay. The endpoint is anonymous and rate-limited
 *  per IP, and it is called while a finger is still on the map, so every caller
 *  must debounce — this component is the only caller, and this is that debounce. */
const DISTRICT_LOOKUP_DEBOUNCE_MS = 400;

/**
 * The map half of the home-point picker: a crosshair map, a live district chip,
 * and a "Use my location" button — everything that is identical across the
 * three surfaces that ask for a home point (the sign-up dialog's step 2, the
 * add-a-toy wizard's gate, and the full-screen/profile picker dialog).
 *
 * It owns no chrome of its own: no header, no footer, no Confirm button. Each
 * host frames it differently (a 250 px block inside a 560 px dialog, a 440 px
 * panel beside the gate copy, a full-bleed dialog pane) and each has its own
 * primary action, so the component reports its state through
 * `selectionChange` and lets the host decide what to render around it. That is
 * also why the status message lives in a sibling (`app-home-point-status`)
 * rather than here — the boards place it below the map on mobile and inside a
 * side panel on desktop.
 *
 * **Never asks the browser for a location on mount** (M-031). `navigator.
 * geolocation` is only ever consulted from `requestMyLocation()`, i.e. after a
 * deliberate tap on a control that says what it is for. A denial is a soft
 * `denied` state that changes nothing about the map's usability.
 */
@Component({
  selector: 'app-home-point-map',
  standalone: true,
  imports: [MapComponent, TranslatePipe],
  templateUrl: './home-point-map.component.html',
  styleUrl: './home-point-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The district chip and the locate pill are ordinary children of this
  // component's own template, but the crosshair-tint modifier below has to
  // reach `.app-map__crosshair-*`, which `app-map` renders in ITS template
  // under `ViewEncapsulation.None`. Matching that here keeps one unshimmed
  // stylesheet rather than an `::ng-deep` that silently drops (see
  // map.component.scss's own note on why `::ng-deep` is not used in this repo).
  encapsulation: ViewEncapsulation.None,
})
export class HomePointMapComponent {
  private readonly listingsApi = inject(ListingsApiService);
  private readonly geolocation = inject(GeolocationService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Where the map opens. Pass the saved home point when one exists. */
  readonly initialCenter = input<MapLatLng>(YEREVAN_CENTER);
  readonly initialZoom = input<number>(DEFAULT_PICKER_ZOOM);
  /**
   * `true` when `initialCenter` IS an already-saved home point rather than the
   * default city centre. That makes the starting point a deliberate choice, so
   * the host's Confirm is enabled immediately — re-confirming your own point
   * without panning is a legitimate no-op, whereas confirming Republic Square
   * because it happened to be under the crosshair is the accident this gate
   * exists to prevent.
   */
  readonly openedOnExistingPoint = input<boolean>(false);
  readonly height = input<string>('100%');
  /** Bumping this re-arms the map (re-centres, clears "moved"/"denied") — hosts
   *  that keep the component alive across open/close cycles increment it on
   *  open, since there is no `ngOnInit` to hook for that. */
  readonly resetToken = input<number>(0);

  readonly selectionChange = output<HomePointSelection>();

  protected readonly currentCenter = signal<MapLatLng>(YEREVAN_CENTER);
  protected readonly district = signal<ListingDistrict | null>(null);
  protected readonly resolving = signal(false);
  protected readonly settledOnce = signal(false);
  protected readonly geoState = signal<HomePointGeoState>('idle');
  protected readonly lowAccuracyMeters = signal<number | null>(null);
  protected readonly hasMoved = signal(false);
  private readonly fixArrived = signal(false);

  /** The visitor's own resolved position — drawn as the blue dot plus its real
   *  accuracy circle so a vague fix LOOKS vague (M-027). Independent of the
   *  crosshair, which the user may then pan away from it. */
  protected readonly userPin = signal<MapLatLng | null>(null);
  protected readonly userAccuracyMeters = signal<number | null>(null);

  /**
   * One-shot recentre target written ONLY by `requestMyLocation()`. Kept
   * separate from `currentCenter` for the reason `location-picker.component.ts`
   * documents at length: feeding a live pan position back into `[center]`
   * closes a pan → emit → input-change → `setView()` → `moveend` loop that
   * trips Angular's NG0103. Nothing in `onCenterChange` ever writes this, so
   * binding `[center]` to `mapCenter` below cannot re-trigger itself.
   */
  private readonly centerOverride = signal<MapLatLng | null>(null);
  protected readonly mapCenter = computed<MapLatLng>(
    () => this.centerOverride() ?? this.initialCenter(),
  );

  /** `app-map`'s crosshair mode emits `centerChange` once on creation even with
   *  zero panning ("a confirm without a pan still needs a coordinate"), so the
   *  FIRST emission is that initial report, not a move. */
  private receivedFirstCenter = false;

  /** `resetToken|lat|lng` of the last arm — see the constructor's effect. */
  private lastArmedKey: string | null = null;

  private readonly centerSettled$ = new Subject<MapLatLng>();

  protected readonly deliberate = computed(
    () => this.hasMoved() || this.fixArrived() || this.openedOnExistingPoint(),
  );
  protected readonly outsideYerevan = computed(
    () => this.settledOnce() && !this.resolving() && this.district() === null,
  );
  protected readonly canConfirm = computed(
    () => this.deliberate() && !this.resolving() && !this.outsideYerevan(),
  );

  /** Chip text: the resolved district name, in the active UI language. District
   *  names are DATA (served in all three languages), never i18n keys. */
  protected readonly districtLabel = computed<string>(() => {
    const d = this.district();
    return d ? districtDisplayName(d, this.languageService.current().code) : '';
  });

  constructor() {
    this.centerSettled$
      .pipe(
        tap(() => {
          this.resolving.set(true);
          this.emit();
        }),
        debounceTime(DISTRICT_LOOKUP_DEBOUNCE_MS),
        switchMap(({ lat, lng }) =>
          this.listingsApi.getDistrictAt(lat, lng).pipe(
            // A failed lookup must not read as "outside Yerevan" — that would
            // disable Confirm on a network blip and tell the user their home is
            // in the wrong city. It stays `resolving: false, settledOnce:
            // false`, i.e. the neutral "move the map" chip, and Confirm is
            // governed by `deliberate` alone.
            catchError(() => of<ListingDistrict | null | undefined>(undefined)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((district) => {
        this.resolving.set(false);
        if (district !== undefined) {
          this.district.set(district);
          this.settledOnce.set(true);
        }
        this.emit();
      });

    // (Re-)arm on open. `resetToken` and `initialCenter` are both read so a host
    // can re-open the picker on a different point without recreating this
    // component.
    //
    // Guarded by `lastArmedKey` so it is IDEMPOTENT: an effect can be re-run
    // for reasons that have nothing to do with these two inputs, and a
    // spurious re-arm would silently wipe `hasMoved`/`fixArrived`/`geoState` —
    // i.e. undo the user's deliberate choice and disable Confirm again under
    // them. Re-arming is a response to an actual (re)open, not to change
    // detection happening.
    effect(() => {
      const token = this.resetToken();
      const center = this.initialCenter();
      const key = `${token}|${center.lat}|${center.lng}`;
      if (key === this.lastArmedKey) return;
      this.lastArmedKey = key;
      this.currentCenter.set(center);
      this.hasMoved.set(false);
      this.fixArrived.set(false);
      this.receivedFirstCenter = false;
      this.centerOverride.set(null);
      this.geoState.set('idle');
      this.lowAccuracyMeters.set(null);
      this.userPin.set(null);
      this.userAccuracyMeters.set(null);
      this.district.set(null);
      this.settledOnce.set(false);
      this.centerSettled$.next(center);
    });
  }

  /**
   * `app-map` reports the crosshair's coordinate on every Leaflet `moveend` —
   * and `moveend` fires for things that are not pans, including the
   * `invalidateSize()` its own ResizeObserver issues when the map's box
   * changes. That matters here because the map's box DOES change in response to
   * this component's own output: the host renders a status message beside it,
   * so a lookup result can resize the map, which re-fires `moveend`, which
   * starts another lookup — an endless ~450 ms request loop, with the chip
   * stuck on "Checking the district…" and `Confirm` reading a stale centre.
   * Observed on the live walk; no test saw it, because every map in jsdom has
   * no layout to resize.
   *
   * The fix is to treat a `moveend` that did not change the coordinate as what
   * it is: not a pan. Nothing downstream needs to know about it.
   */
  protected onCenterChange(center: MapLatLng): void {
    const previous = this.currentCenter();
    const moved = previous.lat !== center.lat || previous.lng !== center.lng;
    this.currentCenter.set(center);
    if (!this.receivedFirstCenter) {
      // `app-map`'s crosshair mode reports the starting centre once on
      // creation, even with zero panning — that is this emission, not a move.
      this.receivedFirstCenter = true;
    } else if (moved) {
      this.hasMoved.set(true);
    }
    if (!moved) return;
    this.centerSettled$.next(center);
  }

  /**
   * The ONLY place this component touches the browser's geolocation — behind a
   * deliberate tap on a labelled control (M-031). A rejection of any shape
   * lands in `denied`, which is informational: the map still pans, Confirm is
   * still reachable by moving it.
   */
  protected requestMyLocation(): void {
    this.geoState.set('locating');
    this.emit();
    this.geolocation.getCurrentPosition().then(
      (point) => {
        const center: MapLatLng = { lat: point.lat, lng: point.lng };
        this.geoState.set('idle');
        this.fixArrived.set(true);
        this.userPin.set(center);
        this.userAccuracyMeters.set(point.accuracyMeters);
        this.lowAccuracyMeters.set(
          point.accuracyMeters !== null && point.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS
            ? Math.round(point.accuracyMeters)
            : null,
        );
        this.centerOverride.set(center);
        this.currentCenter.set(center);
        this.centerSettled$.next(center);
        this.emit();
      },
      () => {
        this.geoState.set('denied');
        this.emit();
      },
    );
  }

  /** The current selection — hosts that hold a reference can read it directly
   *  (e.g. on Confirm) instead of caching every `selectionChange`. */
  snapshot(): HomePointSelection {
    return {
      center: this.currentCenter(),
      district: this.district(),
      resolving: this.resolving(),
      outsideYerevan: this.outsideYerevan(),
      deliberate: this.deliberate(),
      geoState: this.geoState(),
      lowAccuracyMeters: this.lowAccuracyMeters(),
      canConfirm: this.canConfirm(),
    };
  }

  private emit(): void {
    this.selectionChange.emit(this.snapshot());
  }
}
