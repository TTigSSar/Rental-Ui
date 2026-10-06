import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';

import { GeolocationService } from '../../services/geolocation.service';
import { HomePointMapComponent } from '../home-point-map/home-point-map.component';
import type { HomePointSelection } from '../home-point-map/home-point-map.model';
import { HomePointStatusComponent } from '../home-point-map/home-point-status.component';
import { MapComponent } from '../map/map.component';
import type { MapLatLng } from '../map/map.component';
import { DEFAULT_PICKER_ZOOM, YEREVAN_CENTER } from '../map/map.constants';

/**
 * Full-screen "drop a pin" picker.
 *
 * TWO modes live here. The default one is the original generic pin picker (the
 * listing-detail page's "measure from here" fallback and the catalogue's radius
 * origin). `homePointMode` switches it to the HOME-POINT picker from the
 * approved boards: a titled header with a subtitle, the live district chip and
 * accuracy circle of `app-home-point-map`, the privacy note, and a Confirm that
 * is enabled only when the point is BOTH valid (inside Yerevan) and deliberately
 * chosen. Both modes share this file because they share everything that is
 * actually hard — the full-screen dialog shell, the focus trap, the
 * Escape/close plumbing and the mobile/desktop framing — and differ only in
 * what fills the body.
 *
 * It was moved out of `features/listings/` into `shared/ui/` when the home-point
 * feature gave it a third and fourth consumer outside that feature (the sign-up
 * dialog and the profile page); nothing about the generic mode changed in the
 * move.
 *
 * Rather than a draggable marker (fiddly on touch), the map itself pans under a
 * fixed centre crosshair (`app-map`'s `crosshair` mode) — confirming just reads
 * off whatever coordinate is currently under the crosshair.
 *
 * A11y: built on PrimeNG's `p-dialog` (`modal` + default `focusTrap`/
 * `closeOnEscape`/`focusOnShow`), which already gives this a proper
 * `role="dialog"`/`aria-modal`/`aria-labelledby`, a keyboard focus trap, and
 * Escape-to-close — the same primitive `auth-dialog` already uses elsewhere in
 * this codebase. Two things it does NOT give for free, both handled here:
 *
 * - **The accessible name.** `p-dialog` binds `aria-labelledby` to an id it only
 *   renders when you do not supply a header template. Home-point mode does
 *   supply one, so the template re-homes that id onto its own `<h2>` — see the
 *   long comment in the template.
 * - **Returning focus to the trigger on close.** PrimeNG never restores it
 *   (grep `primeng-dialog.mjs`: `onContainerDestroy` touches z-index, modality
 *   and body scroll, and nothing else), so Escape used to drop a keyboard user
 *   on `<body>` at the top of the document. This USED to be documented as the
 *   caller's job via the `confirmed`/`cancelled` outputs — which exactly one of
 *   the four call sites actually did. It is now this component's job: the
 *   picker remembers whatever had focus when `open` flipped true and refocuses
 *   it from every close path (Confirm, Cancel, Escape, close icon, mask). A
 *   caller that wants focus somewhere else after a confirm simply moves it —
 *   anything it focuses later wins, because the restore here is synchronous
 *   with the output emission while `focusOnShow` on a follow-up dialog is not.
 */
@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [
    DialogModule,
    HomePointMapComponent,
    HomePointStatusComponent,
    MapComponent,
    TranslatePipe,
  ],
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `appendTo="body"` portals the dialog outside this component's own DOM
  // subtree, so Angular's emulated `_ngcontent` scoping attribute never reaches
  // it — same reasoning as `auth-dialog.component.ts`.
  encapsulation: ViewEncapsulation.None,
})
export class LocationPickerComponent {
  private readonly geolocation = inject(GeolocationService);
  private readonly document = inject(DOCUMENT);

  readonly open = input.required<boolean>();
  /** Re-centres on the already-picked pin when re-opening; else Yerevan. */
  readonly initialCenter = input<MapLatLng>(YEREVAN_CENTER);
  readonly initialZoom = input<number>(DEFAULT_PICKER_ZOOM);

  // ── Home-point mode ───────────────────────────────────────────
  /**
   * Switches the body from the generic crosshair map to `app-home-point-map`
   * (district chip, accuracy circle, "Use my location") and the footer from
   * "confirm whatever is under the crosshair" to the boards' gated Confirm.
   */
  readonly homePointMode = input<boolean>(false);
  /** Home-point mode only: the line under the dialog title. */
  readonly subtitleKey = input<string>('homePoint.picker.subtitle');
  /** Home-point mode only — `true` when `initialCenter` is an ALREADY-SAVED home
   *  point rather than the default city centre; see the same input on
   *  `app-home-point-map` for why that decides whether Confirm starts enabled. */
  readonly openedOnExistingPoint = input<boolean>(false);
  /** Home-point mode only: a save is in flight, so Confirm spins and is inert. */
  readonly saving = input<boolean>(false);
  /**
   * Home-point mode only: the server refused this point with
   * `auth.home_point_outside_yerevan`. Read by the host from `getApiErrorCode()`
   * — the backend sends it as a `ServiceError` code, NOT as a field-level
   * validation message — and passed down so the same red inline error shows
   * even if the client-side district lookup happened to disagree.
   */
  readonly serverOutsideYerevan = input<boolean>(false);

  /**
   * Translate keys for the dialog chrome — all default to the wizard's
   * original hardcoded keys, so the create-listing wizard (the original
   * consumer of this component) renders byte-for-byte the same text it
   * always has. `RadiusOriginFilterComponent` (Maps P2 screen 5, a SEPARATE
   * scenario from the wizard's own location step) overrides these to its own
   * "measure distance from here" copy.
   */
  readonly headerKey = input<string>('listings.createForm.locationPicker.title');
  readonly confirmLabelKey = input<string>('listings.createForm.locationPicker.confirm');
  readonly cancelLabelKey = input<string>('listings.createForm.locationPicker.cancel');
  /** Footer privacy caption — same default-to-the-wizard's-own-copy pattern
   *  as the three keys above. `ListingLocationComponent` (the listing-detail
   *  page's "pick a point" fallback, formerly its own near-duplicate
   *  `ListingLocationPointPickerComponent`) overrides this to its own
   *  "never sent anywhere" copy, since that dialog's point is never
   *  persisted anywhere (Maps P2-3) — a materially different privacy
   *  guarantee from the wizard's "we only show the district" one, so the
   *  two must never silently share one string. */
  readonly privacyNoteKey = input<string>('listings.createForm.locationPicker.privacyNote');

  /**
   * Opt-in floating hint card (`.location-picker__hint` — the approved
   * design's `.pickhint`), shown above the crosshair. `null` (default, the
   * wizard's own behaviour) renders nothing extra; the wizard relies on the
   * dialog header alone. `hintSubtitleMovedKey`/`hintSubtitleIdleKey` let the
   * subtitle read differently before vs. after the first pan (screen 5's
   * "map hasn't moved yet" vs. "move the map…") — both fall back to
   * `hintTitleKey`'s own subtitle-less rendering when omitted.
   */
  readonly hintTitleKey = input<string | null>(null);
  readonly hintSubtitleMovedKey = input<string | null>(null);
  readonly hintSubtitleIdleKey = input<string | null>(null);

  /** Opt-in "My location" button docked to the map (`[app-map-actions]`) —
   *  `false` (default) preserves the wizard's map exactly as before. */
  readonly showMyLocationButton = input<boolean>(false);

  /**
   * Opt-in dashed radius-preview circle (screen 5) — a REAL geographic
   * `app-map` layer (`circleRadiusMeters` + `circleDashed`, both dashed-solid
   * variants of the same `L.Circle` the listing-detail map already draws
   * around its fixed `pin`), centred on the map's own current centre since
   * `crosshair` mode has no `pin`. Because it is defined in real metres, not
   * an on-screen pixel size computed once for the zoom the picker opened at,
   * it pans and re-scales with the map like any other Leaflet layer would —
   * see `map.component.ts`'s `syncCircle()`. `null` (default) renders no
   * preview; see `effectiveRadiusPreviewMeters` below for the "hidden until
   * the crosshair has actually moved" gating this had before too.
   */
  readonly radiusPreviewMeters = input<number | null>(null);

  /**
   * When `true`, the footer's confirm button stays disabled until the map
   * has actually panned at least once (screen 5's "Готово" starts
   * grey/disabled until the crosshair has been aimed) — see `hasMoved`
   * below. `false` (default) preserves the wizard's confirm button, which has
   * never required a pan (confirming the default Yerevan-centre pin is valid
   * there).
   */
  readonly confirmDisabledUntilMoved = input<boolean>(false);

  readonly confirmed = output<MapLatLng>();
  /**
   * Home-point mode only, emitted alongside `confirmed`: the FULL selection,
   * including the district the map already resolved for that point. The profile
   * card needs it to show "Kentron → Arabkir" in its change confirmation, and
   * re-querying `/api/districts/at` for a coordinate this component just looked
   * up would be a second request for an answer already in hand.
   */
  readonly confirmedHomePoint = output<HomePointSelection>();
  readonly cancelled = output<void>();

  /** Home-point mode: the live state of the embedded map, mirrored here so the
   *  footer can gate Confirm on it. */
  protected readonly homePointSelection = signal<HomePointSelection | null>(null);
  /**
   * Bumped on every (re-)open so `app-home-point-map` re-arms.
   *
   * The counter is a PLAIN FIELD, and the signal is written with `set`, never
   * `update`: this is written from inside the "picker (re)opened" effect below,
   * and `update()` reads the current value through the reactive graph, so an
   * effect that updates a signal it owns registers a dependency on its own
   * write and re-runs forever. That looked like nothing in the component and
   * everything downstream — the embedded map re-armed on every change-detection
   * pass, so its district lookup never settled (the chip stayed on "Checking
   * the district…") and `hasMoved` was wiped, making Confirm submit the
   * pre-pan coordinate. Found on the live walk, not by any test.
   */
  private resetTokenCounter = 0;
  protected readonly homePointResetToken = signal(0);

  protected onHomePointSelectionChange(selection: HomePointSelection): void {
    this.homePointSelection.set(selection);
  }

  protected readonly homePointConfirmDisabled = computed(() => {
    if (this.saving()) return true;
    const selection = this.homePointSelection();
    return selection === null || !selection.canConfirm;
  });

  /**
   * The coordinate currently under the crosshair — updated as the map pans,
   * read only by `confirm()`. Deliberately NEVER fed back into `app-map`'s
   * `[center]` input (the template binds that to `initialCenter()` instead):
   * doing so closed a feedback loop that hit Angular's NG0103 ("infinite
   * change detection") — pan → `centerChange` → `currentCenter.set()` →
   * `[center]` changes → `app-map`'s own effect calls `setView()` → Leaflet
   * fires `moveend` again → repeat. `initialCenter` only changes when the
   * picker (re)opens, so binding to it is a single, one-shot `setView()` with
   * no way to re-trigger itself.
   */
  protected readonly currentCenter = signal<MapLatLng>(YEREVAN_CENTER);

  /**
   * `true` once the map has genuinely panned at least once since the picker
   * opened — gates `confirmDisabledUntilMoved`. NOT simply "did `centerChange`
   * fire": `map.component.ts`'s crosshair mode emits `centerChange` once
   * immediately on creation (even with zero pan, "a confirm without any pan
   * still needs a coordinate to submit") — so the FIRST emission after
   * opening is that initial report, not a real move, and `receivedFirstCenter`
   * (a plain flag, not a signal — it's write-only bookkeeping the template
   * never reads) distinguishes the two.
   */
  protected readonly hasMoved = signal(false);
  private receivedFirstCenter = false;

  /**
   * One-shot override set by `requestMyLocation()` below. Deliberately a
   * SEPARATE signal from `currentCenter`/`initialCenter` — mirroring this
   * class's own NG0103 warning (see the class doc comment): feeding a live
   * pan position back into `[center]` closes a pan→emit→input-change→
   * `setView()` loop, but `centerOverride` is only ever written by a user
   * button click, never by `onCenterChange`, so binding `[center]` to
   * `mapCenter` (below) below cannot re-trigger itself.
   */
  private readonly centerOverride = signal<MapLatLng | null>(null);

  /** What `app-map`'s `[center]` actually binds to — `initialCenter()` until
   *  (if ever) `requestMyLocation()` overrides it once. */
  protected readonly mapCenter = computed<MapLatLng>(
    () => this.centerOverride() ?? this.initialCenter(),
  );

  /**
   * Whatever had focus at the instant the picker opened — the button the user
   * pressed to get here — so every close path can hand focus back to it.
   *
   * Captured on the false→true EDGE only (`wasOpen` below), never on every run
   * of the effect: that effect also reads `initialCenter()`, so a re-run while
   * the picker is open would capture something *inside* the dialog and then
   * "restore" focus to a node that is about to be destroyed.
   */
  private triggerElement: HTMLElement | null = null;
  private wasOpen = false;

  /**
   * Hands focus back to the element that opened the picker. Called from every
   * close path (Confirm, Cancel, Escape / close icon / mask via
   * `onVisibleChange`) AFTER the matching output has been emitted, so a caller
   * that wants focus elsewhere — the profile card opens its change-confirmation
   * sheet on confirm — still wins: that sheet's own `focusOnShow` runs later,
   * asynchronously, once its enter transition completes.
   *
   * Skips a trigger that is no longer in the document: confirming can re-render
   * the very card the trigger lived on, and focusing a detached node silently
   * moves focus to `<body>` — exactly the bug this method exists to prevent.
   * The create-listing wizard keeps its own `afterRenderEffect` re-focus for
   * precisely that case (it re-queries the button by view child, so it survives
   * the node being replaced); the two are complementary, not duplicates.
   */
  private restoreFocusToTrigger(): void {
    const trigger = this.triggerElement;
    this.triggerElement = null;
    if (trigger === null || !trigger.isConnected) return;
    trigger.focus();
  }

  constructor() {
    // Reset the crosshair's starting point every time the picker (re-)opens.
    effect(() => {
      if (this.open()) {
        if (!this.wasOpen) {
          this.wasOpen = true;
          const active = this.document.activeElement;
          this.triggerElement = active instanceof HTMLElement ? active : null;
        }
        this.resetTokenCounter += 1;
        this.homePointResetToken.set(this.resetTokenCounter);
        this.homePointSelection.set(null);
        this.currentCenter.set(this.initialCenter());
        this.hasMoved.set(false);
        this.receivedFirstCenter = false;
        this.centerOverride.set(null);
      } else {
        this.wasOpen = false;
      }
    });
  }

  protected onCenterChange(center: MapLatLng): void {
    this.currentCenter.set(center);
    if (!this.receivedFirstCenter) {
      this.receivedFirstCenter = true;
    } else {
      this.hasMoved.set(true);
    }
  }

  /** Opt-in "My location" button (`showMyLocationButton`) — a ONE-TIME
   *  imperative recentre, not continuous tracking; see `centerOverride`'s
   *  own doc comment for why this can never loop back into itself. */
  protected requestMyLocation(): void {
    this.geolocation.getCurrentPosition().then(
      (coords) => this.centerOverride.set(coords),
      () => {
        /* No dedicated error UI here — the picker's own "My location" button
         * is a convenience shortcut; a denial just leaves the crosshair where
         * it was, same as if the button had never been pressed. The primary
         * denial UX (`RadiusOriginFilterComponent`'s "denied" state, design
         * decision #5) lives one level up, on the button that opened this
         * picker in the first place. */
      },
    );
  }

  /**
   * `[circleRadiusMeters]` for `app-map`'s real geographic preview circle —
   * `null` (no circle) unless BOTH a radius was supplied AND the crosshair
   * has actually moved at least once (`hasMoved()`), matching this control's
   * approved design exactly as the old CSS version did: the preview stays
   * hidden in the "not aimed yet" state, only appearing once the visitor has
   * started choosing a point.
   */
  protected readonly effectiveRadiusPreviewMeters = computed<number | null>(() => {
    const meters = this.radiusPreviewMeters();
    if (meters === null || meters <= 0 || !this.hasMoved()) return null;
    return meters;
  });

  /** Wired to `p-dialog`'s `(visibleChange)` — fires on Escape, the header's
   *  close button, or a future mask click; all three mean "cancel". */
  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancelled.emit();
      this.restoreFocusToTrigger();
    }
  }

  protected confirm(): void {
    if (this.homePointMode()) {
      const selection = this.homePointSelection();
      // `homePointConfirmDisabled` already blocks this path, so a null
      // selection here can only mean the map never reported one — do nothing
      // rather than emit the stale generic-mode centre.
      if (selection === null || !selection.canConfirm) return;
      this.confirmedHomePoint.emit(selection);
      this.confirmed.emit(selection.center);
      this.restoreFocusToTrigger();
      return;
    }
    this.confirmed.emit(this.currentCenter());
    this.restoreFocusToTrigger();
  }

  protected cancel(): void {
    this.cancelled.emit();
    this.restoreFocusToTrigger();
  }
}
