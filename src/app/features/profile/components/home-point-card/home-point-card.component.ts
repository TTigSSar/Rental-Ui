import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import * as AuthActions from '../../../auth/store/auth.actions';
import {
  selectHomePoint,
  selectHomePointError,
  selectHomePointErrorCode,
  selectHomePointOutsideYerevan,
  selectHomePointSaving,
} from '../../../auth/store/auth.selectors';
import { APPROXIMATE_AREA_RADIUS_METERS } from '../../../listings/models/approximate-area.const';
import { districtDisplayName } from '../../../listings/models/district-ui.util';
import type { ListingDistrict } from '../../../listings/models/district.model';
import {
  selectMyListingsError,
  selectMyListingsItems,
  selectMyListingsLoading,
} from '../../../my-listings/store/my-listings.selectors';
import { LanguageService } from '../../../../shared/services/language.service';
import type { HomePointSelection } from '../../../../shared/ui/home-point-map/home-point-map.model';
import { LocationPickerComponent } from '../../../../shared/ui/location-picker/location-picker.component';
import { MapComponent } from '../../../../shared/ui/map/map.component';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';
import { YEREVAN_CENTER } from '../../../../shared/ui/map/map.constants';

/**
 * What a toast must say once the write it belongs to actually LANDS, and which
 * write that is. `count: null` means N was still unknown when the move was
 * confirmed, so the toast makes no claim about toys at all rather than naming a
 * number the card never had.
 */
type PendingHomePointToast =
  | { readonly kind: 'moved'; readonly count: number | null; readonly district: string }
  | { readonly kind: 'removed' };

/**
 * The profile page's Home point card — empty state, set state, the change
 * confirmation, the remove confirmation and the success toast.
 *
 * Reads the point from the AUTH store (`selectHomePoint`), not from the profile
 * slice. Both are built from the same `/api/auth/me` payload, and keeping a
 * second copy would mean keeping it in step after every PUT — with the copy the
 * user is actually looking at being the one that goes stale.
 *
 * The map shows the PUBLIC pair and the ~100 m circle, labelled "What renters
 * see" — never the exact pin. That is not only what the boards drew, it is the
 * honest thing to show: the exact point is the owner's, the circle is what the
 * product publishes (ADR-008), and this card's whole job is to tell them the
 * difference.
 */
@Component({
  selector: 'app-home-point-card',
  standalone: true,
  imports: [DialogModule, LocationPickerComponent, MapComponent, TranslatePipe],
  templateUrl: './home-point-card.component.html',
  styleUrl: './home-point-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The two confirmation dialogs are portalled out of this component's DOM
  // subtree by PrimeNG's appendTo, so the `.p-dialog` shells they land in
  // never receive Angular's emulated `_ngcontent` attribute — same reasoning
  // as `auth-dialog.component.ts` and `location-picker.component.ts`. Every
  // selector in the stylesheet is namespaced `hp-card*` / `hp-sheet*` /
  // `hp-remove*`, so shipping it unshimmed collides with nothing.
  encapsulation: ViewEncapsulation.None,
})
export class HomePointCardComponent {
  private readonly store = inject(Store);
  private readonly languageService = inject(LanguageService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  protected readonly homePoint = this.store.selectSignal(selectHomePoint);
  protected readonly saving = this.store.selectSignal(selectHomePointSaving);
  protected readonly saveError = this.store.selectSignal(selectHomePointError);
  protected readonly saveErrorCode = this.store.selectSignal(selectHomePointErrorCode);
  protected readonly outsideYerevan = this.store.selectSignal(selectHomePointOutsideYerevan);

  /**
   * Which COPY the card shows for a refused save or remove — chosen by the
   * machine-readable `errorCode`, never by the message string the store holds.
   *
   * That string is `toApiErrorMessage()`'s output, and on this path it is one
   * of three things, none of them user-facing: a ProblemDetails `title`, which
   * is server-side English in all three languages; nothing at all; or — when
   * the response carries no body, which is exactly what the home-point rate
   * limiter's 429 and a dropped connection produce — Angular's internal
   * `HttpErrorResponse.message`, i.e. "Http failure response for
   * https://localhost:7241/api/auth/me/home-point: 409 Conflict", API host and
   * all. The card used to print whichever of those arrived.
   *
   * So the mapping is TOTAL: every code and the no-code case resolve to a real
   * key, and the raw string is not rendered anywhere. `default` is not a
   * fallback that happens to be rare — 429/401/403/status-0 all land there, and
   * it is the only branch a code this file has never heard of can reach.
   */
  protected readonly errorMessageKey = computed<string>(() => {
    switch (this.saveErrorCode()) {
      // The one refusal with its own established copy — the pin is outside the
      // 12 Yerevan districts. Same string the picker shows inline.
      case 'auth.home_point_outside_yerevan':
        return 'homePoint.status.outsideTitle';
      // 409 on DELETE while the owner still lists any toy. The disabled Remove
      // button already says this as a precondition; here it says it as the
      // reason the attempt failed (a second tab can list a toy between the two).
      case 'auth.home_point_in_use':
        return 'profile.homePoint.errorInUse';
      default:
        return 'profile.homePoint.errorGeneric';
    }
  });

  /** N — how many toys move with the point. From `GET /api/listings/mine`,
   *  which the profile page already loads. Every status counts: an archived or
   *  pending listing is relocated by the backend just like an approved one. */
  private readonly listingsCount = this.store.selectSignal(selectMyListingsItems);
  private readonly listingsLoading = this.store.selectSignal(selectMyListingsLoading);
  private readonly listingsError = this.store.selectSignal(selectMyListingsError);

  /**
   * Whether N is KNOWN. An empty `items` array means "the request has not
   * answered yet" exactly as often as it means "this owner has no toys", and
   * the profile page dispatches `loadMyListings()` as this card mounts — so the
   * card's first frames are always the ambiguous ones. Reading `[]` as a real
   * zero made it enable Remove (which the backend then refuses with 409
   * `auth.home_point_in_use`) and tell the owner "0 toys move" while the server
   * relocated every one of them.
   *
   * A FAILED load counts as unknown too: `isLoading` goes false with `items`
   * still `[]`, which is the same lie arriving by a different route.
   */
  protected readonly toyCountKnown = computed(
    () => !this.listingsLoading() && this.listingsError() === null,
  );
  protected readonly toyCount = computed(() => this.listingsCount().length);

  protected readonly approximateRadiusMeters = APPROXIMATE_AREA_RADIUS_METERS;

  /**
   * The write this card is waiting on, and what to say when it lands. BOTH
   * toasts report a COMPLETED write and so wait for the response: "Home point
   * removed" on the click is simply false whenever the backend answers 409
   * `auth.home_point_in_use`, and the user had already been told otherwise.
   *
   * A plain field, set BEFORE the dispatch — the same shape
   * `create-listing-form.component.ts` uses for its gate save, so there is one
   * implementation of "did my write land?" in the app rather than two. It
   * matters twice over:
   * - the effect acts on the first run that sees `saving() === false` with a
   *   write in flight, instead of latching "I have seen `saving() === true`"
   *   and then demanding a later `false`. Angular coalesces signal-effect runs,
   *   so that latch loses any true→false transition completing inside one
   *   flush;
   * - a plain field is not a signal, so the effect no longer reads what it
   *   writes.
   */
  private inFlight: PendingHomePointToast | null = null;

  constructor() {
    // All three outcome signals are read UNCONDITIONALLY, before any early
    // return: they are how the write announces itself, and an effect that
    // depends only on `saving` cannot be woken by a response that never left
    // `saving` observably true.
    effect(() => {
      const saving = this.saving();
      const error = this.saveError();
      const point = this.homePoint();
      if (saving) return;
      const pending = this.inFlight;
      if (pending === null) return;
      this.inFlight = null;
      if (error !== null) return;
      if (pending.kind === 'removed') {
        // `clearHomePointSuccess` replaces the whole user, and that is the only
        // thing that nulls the point — so this is the success it reports.
        if (point !== null) return;
        this.showRemovedToast();
        return;
      }
      this.showSavedToast(pending.count, pending.district);
    });
  }

  protected readonly pickerOpen = signal(false);
  protected readonly changeConfirmOpen = signal(false);
  protected readonly removeConfirmOpen = signal(false);

  /** The point confirmed in the picker, held here until the change
   *  confirmation is accepted. Cancelling drops it and keeps the old one. */
  private readonly pendingSelection = signal<HomePointSelection | null>(null);

  protected readonly publicPin = computed<MapLatLng | null>(() => {
    const point = this.homePoint();
    if (point === null) return null;
    return {
      lat: point.publicLatitude ?? point.latitude,
      lng: point.publicLongitude ?? point.longitude,
    };
  });

  protected readonly pickerCenter = computed<MapLatLng>(() => {
    const point = this.homePoint();
    return point ? { lat: point.latitude, lng: point.longitude } : YEREVAN_CENTER;
  });

  protected readonly currentDistrictLabel = computed(() =>
    this.districtLabel(this.homePoint()?.district ?? null),
  );

  protected readonly pendingDistrictLabel = computed(() =>
    this.districtLabel(this.pendingSelection()?.district ?? null),
  );

  /** Removing is only offered with no toys: a listing whose owner has no home
   *  point has no location at all, so the backend refuses with 409
   *  `auth.home_point_in_use`. The card says so instead of letting the user
   *  discover it from an error — and it only says it once it KNOWS, because
   *  "removable" is the claim that costs the user something when it is wrong. */
  protected readonly canRemove = computed(() => this.toyCountKnown() && this.toyCount() === 0);

  protected openPicker(): void {
    this.store.dispatch(AuthActions.clearHomePointError());
    this.pickerOpen.set(true);
  }

  protected onPickerConfirmed(selection: HomePointSelection): void {
    this.pendingSelection.set(selection);
    this.pickerOpen.set(false);
    this.changeConfirmOpen.set(true);
  }

  protected onPickerCancelled(): void {
    this.pickerOpen.set(false);
  }

  /**
   * Escape for the two confirmations, independent of PrimeNG's own
   * `closeOnEscape` — this is M-029's trap, confirmed live on this card before
   * the fix: Escape and a backdrop click BOTH left the sheet on screen. This
   * handler covers Escape ONLY; the backdrop is `onWindowMousedown()` below,
   * and it was missing for a release because this comment's earlier wording
   * described the trap as though naming it had fixed both halves.
   *
   * Both dialogs set `[closable]="false"`, and they need to: these are custom
   * bottom-sheet/dialog chrome with their own buttons, and `closable` is the
   * only way to suppress PrimeNG's default header close icon. But `closable`
   * is not "show a close icon" — `primeng-dialog.mjs` gates
   * `if (this.closeOnEscape && this.closable)` in `bindGlobalListeners()` and
   * `if (this.closable && this.dismissableMask)` in `enableModality()`, so
   * turning the icon off silently revoked both dismiss paths. The template
   * comment above the sheet even claimed "one focus trap and one Escape
   * handler for both", which was the usual M-029 lie.
   *
   * Escape means "decline", so each dialog routes to the same method its own
   * Cancel button does — no second close path to keep in step. Bound at
   * `window` rather than on `<p-dialog>` because `appendTo="body"` portals the
   * content out of this component's subtree; same as
   * `ListingLocationMapComponent.onWindowKeydown()` and
   * `ListingGalleryComponent`'s handler. Guarded on the open signals, so it is
   * inert while only the picker is up (that dialog is `closable` and PrimeNG
   * handles its own Escape).
   */
  @HostListener('window:keydown', ['$event'])
  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (this.changeConfirmOpen()) {
      event.preventDefault();
      this.cancelChange();
      return;
    }
    if (this.removeConfirmOpen()) {
      event.preventDefault();
      this.cancelRemove();
    }
  }

  /**
   * One unique class per dialog's mask, so `onWindowMousedown()` can tell which
   * confirmation a backdrop click belongs to — and tell both of them from the
   * picker's mask, which is a `closable` dialog PrimeNG dismisses itself. Same
   * device as `ListingGalleryComponent.lightboxMaskClass`.
   */
  protected readonly changeMaskClass = 'hp-sheet__mask';
  protected readonly removeMaskClass = 'hp-remove__mask';

  /**
   * Backdrop-click-to-dismiss for the two confirmations — the OTHER half of
   * M-029, and the half the Escape fix above silently claimed without
   * supplying. `closable` gates two unrelated PrimeNG code paths:
   * `bindGlobalListeners()` binds Escape only `if (this.closeOnEscape &&
   * this.closable)`, and `enableModality()` binds the mask-click listener only
   * `if (this.closable && this.dismissableMask)` (`primeng-dialog.mjs`). With
   * `[closable]="false"` — which both dialogs need, it is the only way to
   * suppress PrimeNG's default header close icon on this custom sheet chrome —
   * `[dismissableMask]` would be inert whatever it said, which is why neither
   * dialog sets it: an input that reads as a request and does nothing is the
   * exact lie M-029 is about. Confirmed live at 1440x900 before this fix: a
   * mask click at (8,8) left "Move your home point?" fully on screen.
   *
   * A backdrop click means "decline", so each dialog routes to the same method
   * its own Cancel button and Escape already use — one close path, nothing to
   * keep in step.
   *
   * Bound at `window` because `appendTo="body"` portals the mask out of this
   * component's subtree, and fires only when `event.target` IS the mask element
   * itself: PrimeNG's mask is the direct parent of the dialog container, so a
   * mousedown anywhere in the sheet's own content has a target inside that
   * content and never reaches the branch. A subtree check (`closest`) would
   * dismiss on every click in the body — PrimeNG's own implementation tests
   * `isSameNode(event.target)` for the same reason. `mousedown` (not `click`)
   * mirrors that reference implementation, and means a drag that starts inside
   * the sheet and ends on the mask does not count as a dismissal.
   */
  @HostListener('window:mousedown', ['$event'])
  protected onWindowMousedown(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (this.changeConfirmOpen() && target.classList.contains(this.changeMaskClass)) {
      this.cancelChange();
      return;
    }
    if (this.removeConfirmOpen() && target.classList.contains(this.removeMaskClass)) {
      this.cancelRemove();
    }
  }

  protected cancelChange(): void {
    this.changeConfirmOpen.set(false);
    this.pendingSelection.set(null);
  }

  /** The only place the card actually writes. The N-toys warning has been shown
   *  and accepted by the time this runs. */
  protected confirmChange(): void {
    const selection = this.pendingSelection();
    if (selection === null || this.saving()) return;
    // What the toast will claim is fixed HERE, so it agrees with the sheet the
    // owner just accepted: `null` if that sheet could not name N either.
    const district = this.districtLabel(selection.district);
    this.inFlight = {
      kind: 'moved',
      count: this.toyCountKnown() ? this.toyCount() : null,
      district,
    };
    this.store.dispatch(
      AuthActions.updateHomePoint({
        payload: { latitude: selection.center.lat, longitude: selection.center.lng },
      }),
    );
    this.changeConfirmOpen.set(false);
    this.pendingSelection.set(null);
  }

  protected openRemoveConfirm(): void {
    if (!this.canRemove()) return;
    this.store.dispatch(AuthActions.clearHomePointError());
    this.removeConfirmOpen.set(true);
  }

  protected cancelRemove(): void {
    this.removeConfirmOpen.set(false);
  }

  /**
   * No toast here. The DELETE can still be refused — 409
   * `auth.home_point_in_use` if a second tab listed a toy, or any network
   * failure — and announcing "Home point removed" on the click told the owner
   * their point was gone while the server had kept it. The toast now waits for
   * `clearHomePointSuccess` (observed as a settled, non-erroring save that left
   * `homePoint()` null) in the one in-flight effect above; a refusal surfaces as
   * `.hp-card__error` on the card instead, exactly as a refused move does.
   */
  protected confirmRemove(): void {
    if (this.saving()) return;
    this.inFlight = { kind: 'removed' };
    this.store.dispatch(AuthActions.clearHomePoint());
    this.removeConfirmOpen.set(false);
  }

  /**
   * The toast's body names the district, which the boards hardcoded as
   * "Arabkir" — right exactly once, by coincidence. It is a parameter here, and
   * the N=0 case gets a different string rather than "0 toys now show …".
   *
   * `movedCount === null` is "N was unknown when this move was confirmed" and
   * takes the same count-free string as N=0: "Home point saved" asserts nothing
   * about toys, which is the only honest thing to say about a number the card
   * never had.
   */
  private showSavedToast(movedCount: number | null, district: string): void {
    const detail =
      movedCount !== null && movedCount > 0 && district !== ''
        ? (this.translate.instant('profile.homePoint.toastBody', {
            count: movedCount,
            district,
          }) as string)
        : (this.translate.instant('profile.homePoint.toastBodyNone') as string);
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('profile.homePoint.toastTitle') as string,
      detail,
      life: 4000,
    });
  }

  private showRemovedToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('profile.homePoint.removedToast') as string,
      life: 4000,
    });
  }

  private districtLabel(district: ListingDistrict | null): string {
    return district ? districtDisplayName(district, this.languageService.current().code) : '';
  }
}
