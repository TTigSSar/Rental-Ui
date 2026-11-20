import { DecimalPipe, Location, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthDialogComponent } from '../../../auth/components/auth-dialog/auth-dialog.component';
import { ReportDialogComponent } from '../../../reports/components/report-dialog/report-dialog.component';
import { DeletedUserAvatarComponent, DeletedUserNameComponent } from '../../../../shared/ui/deleted-user';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LanguageService } from '../../../../shared/services/language.service';
import { AgeRangePipe } from '../../../../shared/utils/age-range.pipe';
import { resolveAgeRange } from '../../../../shared/utils/age-range.utils';
import { categoryDisplayName } from '../../../../shared/utils/category-name.utils';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { isCompensationAmountSet } from '../../../../shared/utils/compensation-amount.utils';
import { selectAuthUser, selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as FavoritesActions from '../../../favorites/store/favorites.actions';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import * as BookingsActions from '../../../bookings/store/bookings.actions';
import type { MyBooking } from '../../../bookings/models/booking.model';
import { selectMyBookings } from '../../../bookings/store/bookings.selectors';
import {
  ListingGalleryComponent,
  type GalleryBadge,
} from '../../components/listing-gallery/listing-gallery.component';
import { ListingLocationComponent } from '../../components/listing-location/listing-location.component';
import { resolveConditionLabelKey } from '../../../../shared/utils/listing-condition.utils';
import { districtDisplayName } from '../../models/district-ui.util';
import type { ListingDetails } from '../../models/listing-details.model';
import type { DeliveryType } from '../../models/create-listing.model';
import * as ListingsActions from '../../store/listings.actions';
import { RatingSummaryComponent } from '../../../reviews/components/rating-summary/rating-summary.component';
import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectListingToyReviews,
  selectListingToyReviewsLoading,
  selectListingToyReviewsError,
  selectOwnerReviews,
} from '../../../reviews/store/reviews.selectors';
import * as PublicProfilesActions from '../../../public-profiles/store/public-profiles.actions';
import { selectPublicProfile } from '../../../public-profiles/store/public-profiles.selectors';
import {
  selectListingDetailsLoading,
  selectListingsError,
  selectSelectedListing,
} from '../../store/listings.selectors';

const BOOKING_DISPLAY_PRIORITY: Partial<Record<MyBooking['status'], number>> = {
  Active: 6,
  Approved: 5,
  PendingApproval: 4,
  Pending: 3,
  ReturnMarked: 2,
  Completed: 1,
  Rejected: 0,
  Cancelled: 0,
};

/** Desktop shows 3 review cards before "See all"; mobile shows 2 — done in
 *  CSS (nth-child) off a single 3-item signal slice, rather than a second
 *  breakpoint-aware signal, to keep this page on the one documented 1100px
 *  ladder used everywhere else on it (DESIGN_RULES §3). */
const REVIEWS_PREVIEW_COUNT = 3;

const PROTECTION_EYEBROW_KEY = 'listings.details.protection.eyebrow';
const PROTECTION_TITLE_KEY = 'listings.details.protection.title';
const PROTECTION_PILL_KEY = 'listings.details.protection.pillNoUpfront';
const PROTECTION_INTRO_KEY = 'listings.details.protection.intro';
const PROTECTION_INTRO_NO_AMOUNT_KEY = 'listings.details.protection.introNoAmount';

/**
 * Loss & damage compensation (ADR-014, redesigned): a maximum the renter owes
 * the owner if the toy is lost, seriously damaged or not returned — nothing
 * is ever paid upfront, and DoRent never collects/holds/refunds it. The 3
 * compact bullets (lost / damage / settled directly) describe this real,
 * platform-neutral mechanism (no claims/refund process DoRent doesn't
 * actually run), unlike the old refundable-guarantee copy this replaces.
 */
const PROTECTION_BULLET_KEYS: readonly string[] = [
  'listings.details.protection.bullet1',
  'listings.details.protection.bullet2',
  'listings.details.protection.bullet3',
];

/**
 * Values the create/edit wizard's minimum-rental chips offer (see
 * `MIN_RENTAL_DAYS` in `create-listing-form.component.ts`). When a listing's
 * `minRentalDays` is one of these, the readable chip label
 * (`listings.createForm.minRental.d{n}`, e.g. "1 month") reads better in the
 * pickup/delivery row than the raw "N nights" count.
 */
const MIN_RENTAL_CHIP_DAYS: readonly number[] = [1, 3, 7, 14, 30, 90, 180, 365];

function minRentalChipLabelKey(days: number): string | null {
  return MIN_RENTAL_CHIP_DAYS.includes(days) ? `listings.createForm.minRental.d${days}` : null;
}

/** Re-exported for `owner-listing-page` (my-listings feature, out of scope
 *  for this rebuild) which still imports this helper directly. */
export function hasAnyToyDetail(listing: ListingDetails): boolean {
  return (
    resolveAgeRange(listing.ageFromMonths, listing.ageToMonths) !== null ||
    (typeof listing.condition === 'string' && listing.condition.trim().length > 0) ||
    (typeof listing.hygieneNotes === 'string' && listing.hygieneNotes.trim().length > 0) ||
    (typeof listing.safetyNotes === 'string' && listing.safetyNotes.trim().length > 0)
  );
}

/** One tile in the details quad / pickup & delivery rows —
 *  every field driving these must trace back to a real listing/owner field. */
export interface DetailTile {
  readonly id: string;
  readonly icon: string;
  readonly titleKey: string;
  readonly titleParams?: Record<string, unknown>;
  readonly subKey?: string;
  readonly subParams?: Record<string, unknown>;
  /** Age range in months, rendered through the ADR-068 `ageRange` pipe. */
  readonly subAge?: { readonly from: number | null | undefined; readonly to: number | null | undefined };
}

export interface DetailRow {
  readonly id: string;
  readonly icon: string;
  readonly labelKey: string;
  readonly valueKey?: string;
  readonly valueParams?: Record<string, unknown>;
  /** Pre-formatted value (e.g. currency via `dram`) instead of an i18n key. */
  readonly valueText?: string;
}

function deliveryHintKey(type: DeliveryType): string {
  return type === 'Courier'
    ? 'listings.createForm.delivery.deliverHint'
    : 'listings.createForm.delivery.pickupHint';
}

/**
 * `deliveryTypes` is additive — falls back to the legacy scalar `deliveryType`
 * (wrapped in a single-item array) for listings/backends that predate it, and
 * to `[]` when the listing has neither (never happened historically, but keeps
 * this total).
 */
function resolveDeliveryTypes(listing: ListingDetails): DeliveryType[] {
  if (listing.deliveryTypes && listing.deliveryTypes.length > 0) return listing.deliveryTypes;
  if (listing.deliveryType) return [listing.deliveryType];
  return [];
}

@Component({
  selector: 'app-listing-details-page',
  standalone: true,
  imports: [
    AgeRangePipe,
    AuthDialogComponent,
    AvatarComponent,
    DeletedUserAvatarComponent,
    DeletedUserNameComponent,
    ButtonModule,
    DecimalPipe,
    DramCurrencyPipe,
    ListingGalleryComponent,
    ListingLocationComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    RatingSummaryComponent,
    ReportDialogComponent,
    ReviewCardComponent,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  // `DramCurrencyPipe` is also `inject()`-ed directly below (for values that
  // need formatting outside the template — see `formatDram()`). Listing it
  // in `imports` only makes `| dram` resolvable in the template; it does NOT
  // register it as an injectable, so it must be listed here too or the
  // component throws NG0201 on construction (it did — see
  // `listing-details-page.component.spec.ts`, "DI construction").
  providers: [DramCurrencyPipe],
  templateUrl: './listing-details-page.component.html',
  styleUrls: [
    './listing-details-page.component.scss',
    './listing-details-page.protection.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingDetailsPageComponent {
  private readonly store = inject(Store);
  private readonly languageService = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly dramPipe = inject(DramCurrencyPipe);

  /**
   * Floating back button on the mobile hero. Angular stamps `navigationId` into
   * `history.state`; it is 1 for the first navigation of the session, so > 1
   * means the visitor arrived from inside the app and history-back is safe.
   * A deep link / fresh tab has nothing to go back to — land on the browse page.
   */
  protected goBack(): void {
    const state = this.location.getState() as { navigationId?: number } | null;
    if ((state?.navigationId ?? 0) > 1) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/listings');
    }
  }

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  private readonly currentUser = this.store.selectSignal(selectAuthUser);
  protected readonly showAuthDialog = signal(false);
  protected readonly reviewsExpanded = signal(false);

  /** The "Report this listing" affordance is a safety control, not a primary action — hidden
   *  for guests (it requires authentication) and on your own listing (the server enforces this
   *  too via `report.cannot_report_own`, but there is no reason to ever offer it here). Owners
   *  viewing their own listing are normally redirected to `/my-listings/:id` (see the
   *  constructor `effect` below) before this would even render, but the guard stays cheap
   *  insurance against that redirect's own render frame. */
  protected readonly showReportDialog = signal(false);
  protected readonly canReportListing = computed(() => {
    const listing = this.displayListing();
    const user = this.currentUser();
    return (
      this.isAuthenticated() && listing !== null && user !== null && user.id !== listing.owner.id
    );
  });

  /**
   * `true` when the signed-in viewer owns the listing on screen. Fed to
   * `app-listing-location` so the home-point distance row and home marker
   * are suppressed for them (see that component's `isOwnListing`).
   *
   * An owner is redirected to `/my-listings/:id` by the constructor effect
   * below, so in steady state this is never true here — but the redirect
   * takes a navigation, and the one render frame before it lands is exactly
   * when a "≈ 0 m from your home" row would flash. Same cheap-insurance
   * reasoning as `canReportListing` right above.
   */
  protected readonly isOwnListing = computed(() => {
    const listing = this.displayListing();
    const user = this.currentUser();
    return listing !== null && user !== null && listing.owner.id === user.id;
  });

  private readonly myBookingsSignal = this.store.selectSignal(selectMyBookings);

  protected readonly resolveConditionLabelKey = resolveConditionLabelKey;
  protected readonly protectionEyebrowKey = PROTECTION_EYEBROW_KEY;
  protected readonly protectionTitleKey = PROTECTION_TITLE_KEY;
  protected readonly protectionPillKey = PROTECTION_PILL_KEY;
  protected readonly protectionBullets = PROTECTION_BULLET_KEYS;
  // Intro copy differs depending on whether the owner set an amount.
  protected readonly protectionIntroKey = computed(() =>
    this.protectionAmount() !== null ? PROTECTION_INTRO_KEY : PROTECTION_INTRO_NO_AMOUNT_KEY,
  );
  // `null` here means "not set" per the shared rule (finite number > 0) —
  // a stored `0` (legacy data, see `isCompensationAmountSet`'s doc comment)
  // collapses to `null` too, so `protectionIntroKey`/`protectionAmountDisplay`
  // below don't need their own >0 check.
  protected readonly protectionAmount = computed(() => {
    const amount = this.displayListing()?.compensationAmount ?? null;
    return isCompensationAmountSet(amount) ? amount : null;
  });
  protected readonly protectionAmountDisplay = computed(() => {
    const amount = this.protectionAmount();
    return amount !== null ? this.formatDram(amount) : null;
  });

  // ── Route ────────────────────────────────────────────────────────────────
  private readonly routeId$ = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    distinctUntilChanged(),
  );

  private readonly routeListingId = toSignal(this.routeId$, {
    initialValue: null as string | null,
  });

  // ── Core listing state — plain signals/computed, no combineLatest ─────────
  private readonly rawListing = this.store.selectSignal(selectSelectedListing);
  private readonly detailsLoading = this.store.selectSignal(selectListingDetailsLoading);
  protected readonly listingsError = this.store.selectSignal(selectListingsError);
  private readonly favoriteIds = this.store.selectSignal(selectFavoriteIds);

  protected readonly invalidRoute = computed(
    () => this.routeListingId() === null || this.routeListingId() === '',
  );

  private readonly idMatches = computed(() => {
    const listing = this.rawListing();
    return listing !== null && listing.id === this.routeListingId();
  });

  protected readonly displayListing = computed<ListingDetails | null>(() => {
    const listing = this.rawListing();
    if (!this.idMatches() || listing === null) {
      return null;
    }
    return { ...listing, isFavorite: this.favoriteIds().has(listing.id) };
  });

  protected readonly showSkeleton = computed(
    () => !this.invalidRoute() && this.detailsLoading() && !this.idMatches(),
  );

  protected readonly showError = computed(
    () => this.invalidRoute() || this.listingsError() !== null,
  );

  protected readonly showContent = computed(
    () =>
      !this.invalidRoute() &&
      this.idMatches() &&
      !this.detailsLoading() &&
      this.listingsError() === null,
  );

  protected readonly listingTitle = computed(() => this.rawListing()?.title ?? '');

  /** Cover photo for the Screen 2 full-screen map's plaque thumbnail
   *  (`ListingLocationComponent`'s `imageUrl` input) — same "primary, then
   *  lowest sortOrder" precedence `ListingsQueryService.PrimaryImageUrl`
   *  (rental-api) uses server-side for the catalogue card, so the plaque's
   *  photo always matches whichever image the rest of the app treats as this
   *  listing's cover. `null` when the listing has no images at all; the
   *  plaque renders a placeholder icon in that case rather than a broken
   *  `<img>`. */
  protected readonly listingHeroImageUrl = computed<string | null>(() => {
    const images = this.rawListing()?.images ?? [];
    if (images.length === 0) return null;
    const [first] = [...images].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
    return first.url;
  });

  protected readonly existingBookingId = computed<string | null>(() => {
    const listingId = this.routeListingId();
    if (!listingId) return null;
    const booking = this.myBookingsSignal().find(
      (b) =>
        b.listingId === listingId &&
        (b.status === 'Pending' || b.status === 'Approved' || b.status === 'Active'),
    );
    return booking?.id ?? null;
  });

  protected readonly userBooking = computed<MyBooking | null>(() => {
    const listingId = this.routeListingId();
    if (!listingId) return null;
    let best: MyBooking | null = null;
    for (const b of this.myBookingsSignal()) {
      if (b.listingId !== listingId) continue;
      const priority = BOOKING_DISPLAY_PRIORITY[b.status] ?? -1;
      if (priority < 0) continue;
      if (best === null || priority > (BOOKING_DISPLAY_PRIORITY[best.status] ?? -1)) {
        best = b;
      }
    }
    return best;
  });

  // ── Breadcrumb ──────────────────────────────────────────────────────────
  protected readonly categoryName = computed(() => {
    const category = this.displayListing()?.category;
    return category ? categoryDisplayName(category, this.languageService.current().code) || null : null;
  });

  // ── Toy reviews (per-route) ─────────────────────────────────────────────
  private readonly toySummary = toSignal(
    this.routeId$.pipe(
      switchMap((id) => (id ? this.store.select(selectListingToyReviews(id)) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly reviews = computed(() => this.toySummary()?.comments ?? []);

  protected readonly reviewsLoading = toSignal(
    this.routeId$.pipe(
      switchMap((id) => (id ? this.store.select(selectListingToyReviewsLoading(id)) : of(false))),
    ),
    { initialValue: false },
  );

  protected readonly reviewsError = toSignal(
    this.routeId$.pipe(
      switchMap((id) => (id ? this.store.select(selectListingToyReviewsError(id)) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly ratingSummary = computed(() => {
    const s = this.toySummary();
    return s && s.hasAggregate
      ? { averageRating: s.overallAverage, reviewCount: s.reviewCount }
      : null;
  });

  /** For `app-rating-summary`'s `[summary]` input (average/reviewCount/hasAggregate shape). */
  protected readonly toyRatingSummaryView = computed(() => {
    const s = this.toySummary();
    return {
      average: s?.overallAverage ?? 0,
      reviewCount: s?.reviewCount ?? 0,
      hasAggregate: s?.hasAggregate ?? false,
    };
  });

  protected readonly reviewsDistribution = computed<readonly number[] | null>(
    () => this.toySummary()?.distribution ?? null,
  );

  protected readonly visibleReviews = computed(() =>
    this.reviewsExpanded() ? this.reviews() : this.reviews().slice(0, REVIEWS_PREVIEW_COUNT),
  );

  /**
   * Threshold is 2, not `REVIEWS_PREVIEW_COUNT` (3) — mobile hides the 3rd
   * preview card via CSS (see `.detail-page__review-item--desktop-only`), so
   * a listing with exactly 3 reviews still has one hidden on mobile and needs
   * this control to reach it, even though desktop already shows all 3.
   */
  protected readonly showSeeAllReviews = computed(
    () => !this.reviewsExpanded() && this.reviews().length > 2,
  );

  protected toggleReviewsExpanded(): void {
    this.reviewsExpanded.set(true);
  }

  // ── Owner (per-route) ────────────────────────────────────────────────────
  private readonly ownerId$ = this.store.select(selectSelectedListing).pipe(
    map((listing) => listing?.owner?.id ?? null),
    distinctUntilChanged(),
  );

  private readonly ownerReviewsSummary = toSignal(
    this.ownerId$.pipe(
      switchMap((id) => (id ? this.store.select(selectOwnerReviews(id)) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly ownerSummary = computed(() => {
    const s = this.ownerReviewsSummary();
    return s && s.hasAggregate
      ? { averageRating: s.overallAverage, reviewCount: s.reviewCount }
      : null;
  });

  protected readonly ownerPublicProfile = toSignal(
    this.ownerId$.pipe(
      switchMap((id) => (id ? this.store.select(selectPublicProfile(id)) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly ownerMemberYear = computed(() => {
    const p = this.ownerPublicProfile();
    if (!p) return null;
    return new Date(p.memberSince).getFullYear().toString();
  });

  protected readonly ownerIsVerified = computed(
    () => this.ownerPublicProfile()?.isVerified === true,
  );

  /** Owner stat row on the owner card — only stats the public profile actually
   *  returns. `responseRate` is deliberately excluded: it's hardcoded `null`
   *  server-side today (see the profile DTO), so it would always be fake. */
  protected readonly ownerStats = computed(() => {
    const profile = this.ownerPublicProfile();
    if (!profile) return [];
    const stats: { id: string; value: string; labelKey: string }[] = [];
    if (profile.ownerReviewCount > 0 && profile.ownerRating !== null) {
      stats.push({
        id: 'rating',
        value: profile.ownerRating.toFixed(1),
        labelKey: 'listings.details.ownerStats.rating',
      });
    }
    stats.push({
      id: 'listings',
      value: String(profile.activeListingsCount),
      labelKey: 'listings.details.ownerStats.listings',
    });
    stats.push({
      id: 'completed',
      value: String(profile.completedRentalsAsOwner),
      labelKey: 'listings.details.ownerStats.completed',
    });
    return stats;
  });

  // ── Gallery trust badges (desktop overlay) + mobile badge row ───────────
  protected readonly trustBadges = computed<GalleryBadge[]>(() => {
    const listing = this.displayListing();
    if (!listing) return [];
    const badges: GalleryBadge[] = [];
    if (this.ownerIsVerified()) {
      badges.push({
        icon: 'pi pi-verified',
        label: this.translate.instant('listings.details.badges.verifiedOwner'),
        tone: 'success',
      });
    }
    if (listing.hygieneNotes) {
      badges.push({
        icon: 'pi pi-shield',
        label: this.translate.instant('listings.details.badges.hygieneChecked'),
        tone: 'info',
      });
    }
    return badges;
  });

  // ── Details tiles (age / condition / hygiene) ─────────────────────────────
  protected readonly specTiles = computed<DetailTile[]>(() => {
    const listing = this.displayListing();
    if (!listing) return [];
    const tiles: DetailTile[] = [];

    if (resolveAgeRange(listing.ageFromMonths, listing.ageToMonths)) {
      tiles.push({
        id: 'age',
        icon: 'pi pi-user',
        titleKey: 'listings.details.toyDetails.ageRange',
        subAge: { from: listing.ageFromMonths, to: listing.ageToMonths },
      });
    }
    if (listing.condition) {
      const conditionKey = resolveConditionLabelKey(listing.condition);
      tiles.push({
        id: 'condition',
        icon: 'pi pi-verified',
        titleKey: 'listings.details.toyDetails.condition',
        subKey: conditionKey ?? undefined,
      });
    }
    if (typeof listing.hygieneNotes === 'string' && listing.hygieneNotes.trim().length > 0) {
      tiles.push({
        id: 'hygiene',
        icon: 'pi pi-shield',
        titleKey: 'listings.card.hygieneProvided',
        subKey: 'listings.details.toyDetails.hygieneValue',
      });
    }
    return tiles;
  });

  // ── Location line under the title: "{district}, {city}" ──────────────────
  // Reads `languageService.current()` (a signal) so it follows language switches.
  protected readonly locationLabel = computed(() => {
    const listing = this.displayListing();
    if (!listing) return '';
    const district = listing.district
      ? districtDisplayName(listing.district, this.languageService.current().code)
      : null;
    return district ? `${district}, ${listing.city}` : listing.city;
  });

  /** Mirrors `ListingLocationComponent.hasCoordinates`: no coordinates → no map to scroll to. */
  protected readonly hasMap = computed(() => {
    const listing = this.displayListing();
    return (
      !!listing && typeof listing.latitude === 'number' && typeof listing.longitude === 'number'
    );
  });

  /** Smooth-scrolls to the "Pickup & delivery" section (instant under reduced motion)
   *  and moves focus to its heading. */
  protected scrollToMap(): void {
    const heading = document.getElementById('detail-pickup-heading');
    if (!heading) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  }

  protected readonly safetyNotes = computed(() => this.displayListing()?.safetyNotes ?? null);

  // ── Pickup & delivery trust rows (beside the map) ────────────────────────
  protected readonly pickupDeliveryRows = computed<DetailRow[]>(() => {
    const listing = this.displayListing();
    if (!listing) return [];
    const rows: DetailRow[] = [];

    // Both rows always render (so the side panel beside the map is always
    // present). A missing value shows the create-wizard default — delivery
    // → Pickup, minimum rental → 1 day (wizard defaults, Tigran 2026-11-16).
    const resolvedTypes = resolveDeliveryTypes(listing);
    const deliveryTypes: DeliveryType[] = resolvedTypes.length > 0 ? resolvedTypes : ['Pickup'];
    const both = deliveryTypes.length >= 2;
    rows.push({
      id: 'handover',
      icon: deliveryTypes.includes('Courier') ? 'pi pi-truck' : 'pi pi-map-marker',
      labelKey: 'listings.details.handoverLabel',
      valueKey: both ? 'listings.createForm.delivery.bothHint' : deliveryHintKey(deliveryTypes[0]),
    });

    const minDays =
      typeof listing.minRentalDays === 'number' && listing.minRentalDays > 0
        ? listing.minRentalDays
        : 1;
    const chipKey = minRentalChipLabelKey(minDays);
    rows.push({
      id: 'minRental',
      icon: 'pi pi-calendar',
      labelKey: 'listings.createForm.minRental.label',
      valueKey: chipKey ?? (minDays === 1 ? 'listings.booking.night' : 'listings.booking.nights'),
      valueParams: chipKey ? undefined : { count: minDays },
    });
    return rows;
  });

  /**
   * `DramCurrencyPipe` invoked directly (not via the `| dram` template
   * pipe) for the two cases where formatted currency needs to end up either
   * as a plain-text row value or interpolated into an i18n param — a
   * template pipe binding can't reach into either of those.
   */
  private formatDram(amount: number): string {
    return this.dramPipe.transform(amount) ?? '';
  }

  constructor() {
    // Owners always see the owner ("This is your listing") view, regardless of
    // how they reached the public route — redirect once the listing's owner is
    // confirmed to be the current user. The owner page mirrors the inverse
    // guard (non-owners → public view), so the two never loop.
    effect(() => {
      const id = this.routeListingId();
      const listing = this.rawListing();
      const user = this.currentUser();
      if (
        id !== null &&
        id !== '' &&
        listing !== null &&
        listing.id === id &&
        user !== null &&
        listing.owner.id === user.id
      ) {
        void this.router.navigate(['/my-listings', id], { replaceUrl: true });
      }
    });

    effect(() => {
      const id = this.routeListingId();
      if (id !== null && id !== '') {
        this.store.dispatch(ListingsActions.loadListingDetails({ id }));
        this.store.dispatch(BookingsActions.clearCreateBookingState());
        this.store.dispatch(BookingsActions.clearCancelBookingState());
        this.store.dispatch(ReviewsActions.loadListingToyReviews({ listingId: id }));
        this.reviewsExpanded.set(false);
      }
    });

    effect(() => {
      const id = this.routeListingId();
      if (id !== null && id !== '' && this.isAuthenticated()) {
        this.store.dispatch(FavoritesActions.loadFavorites());
        this.store.dispatch(BookingsActions.loadMyBookings());
      }
    });

    effect(() => {
      const owner = this.rawListing()?.owner;
      const ownerId = owner?.id;
      // ADR-056: a deleted owner's reviews / public profile answer 404 — don't ask.
      if (ownerId && !owner.isDeleted) {
        this.store.dispatch(ReviewsActions.loadOwnerReviews({ userId: ownerId }));
        this.store.dispatch(PublicProfilesActions.loadPublicProfile({ userId: ownerId }));
      }
    });
  }

  protected onFavoriteToggle(listing: ListingDetails): void {
    if (!this.isAuthenticated()) {
      this.showAuthDialog.set(true);
      return;
    }
    this.store.dispatch(ListingsActions.toggleFavoriteOptimistic({ listingId: listing.id }));
  }

  protected openReportDialog(): void {
    if (!this.canReportListing()) return;
    this.showReportDialog.set(true);
  }

  protected closeReportDialog(): void {
    this.showReportDialog.set(false);
  }

  protected retryLoad(): void {
    const id = this.routeListingId();
    if (id !== null && id !== '') {
      this.store.dispatch(ListingsActions.loadListingDetails({ id }));
    }
  }

  /** `navigator.share` on devices that support it (mobile mostly); clipboard
   *  copy + toast everywhere else. Never silently fails — a rejected/cancelled
   *  native share sheet is not an error and is swallowed intentionally. */
  protected async onShare(listing: ListingDetails): Promise<void> {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: listing.title, url });
      } catch {
        // User cancelled the share sheet, or the platform rejected it — no toast either way.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('listings.details.linkCopied'),
        life: 2500,
      });
    } catch {
      // Clipboard permission denied — nothing meaningful we can do; avoid a
      // toast that claims success when it didn't happen.
    }
  }
}
