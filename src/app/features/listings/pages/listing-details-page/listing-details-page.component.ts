import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthDialogComponent } from '../../../auth/components/auth-dialog/auth-dialog.component';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as BookingsActions from '../../../bookings/store/bookings.actions';
import {
  selectCreateBookingError,
  selectCreateBookingLoading,
  selectCreateBookingSuccessId,
} from '../../../bookings/store/bookings.selectors';
import {
  BookingPanelComponent,
  type BookingSubmitPayload,
} from '../../components/booking-panel/booking-panel.component';
import { ListingGalleryComponent } from '../../components/listing-gallery/listing-gallery.component';
import type { ListingDetails } from '../../models/listing-details.model';
import * as ListingsActions from '../../store/listings.actions';
import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import { RatingSummaryComponent } from '../../../reviews/components/rating-summary/rating-summary.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectListingReviews,
  selectListingReviewsLoading,
  selectListingReviewsError,
  selectListingSummary,
  selectUserSummary,
} from '../../../reviews/store/reviews.selectors';
import * as PublicProfilesActions from '../../../public-profiles/store/public-profiles.actions';
import { selectPublicProfile } from '../../../public-profiles/store/public-profiles.selectors';
import {
  selectListingDetailsLoading,
  selectListingsError,
  selectSelectedListing,
} from '../../store/listings.selectors';

export interface ListingDetailsPageViewModel {
  readonly routeId: string | null;
  readonly invalidRoute: boolean;
  readonly displayListing: ListingDetails | null;
  readonly showSkeleton: boolean;
  readonly showError: boolean;
  readonly showContent: boolean;
  readonly error: string | null;
  readonly createBookingLoading: boolean;
  readonly createBookingError: string | null;
  readonly createBookingSuccess: boolean;
}

/**
 * Resolves a backend `condition` string to a translation key when it matches
 * a known canonical value. Returns `null` so the template can fall back to
 * showing the raw backend string when the value is unknown.
 */
export function resolveConditionLabelKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'new':
      return 'listings.details.conditionValues.new';
    case 'likenew':
      return 'listings.details.conditionValues.likeNew';
    case 'good':
      return 'listings.details.conditionValues.good';
    case 'fair':
      return 'listings.details.conditionValues.fair';
    default:
      return null;
  }
}

export interface AgeRangeDisplay {
  readonly key: 'listings.details.toyDetails.ageRangeFromTo'
    | 'listings.details.toyDetails.ageRangeFromOnly'
    | 'listings.details.toyDetails.ageRangeToOnly';
  readonly params: { from?: number; to?: number };
}

export function resolveAgeRangeDisplay(
  fromMonths: number | null | undefined,
  toMonths: number | null | undefined,
): AgeRangeDisplay | null {
  const hasFrom = typeof fromMonths === 'number' && Number.isFinite(fromMonths);
  const hasTo = typeof toMonths === 'number' && Number.isFinite(toMonths);

  if (hasFrom && hasTo) {
    return {
      key: 'listings.details.toyDetails.ageRangeFromTo',
      params: { from: fromMonths, to: toMonths },
    };
  }
  if (hasFrom) {
    return {
      key: 'listings.details.toyDetails.ageRangeFromOnly',
      params: { from: fromMonths },
    };
  }
  if (hasTo) {
    return {
      key: 'listings.details.toyDetails.ageRangeToOnly',
      params: { to: toMonths },
    };
  }
  return null;
}

export function hasAnyToyDetail(listing: ListingDetails): boolean {
  return (
    resolveAgeRangeDisplay(listing.ageFromMonths, listing.ageToMonths) !== null ||
    (typeof listing.condition === 'string' && listing.condition.trim().length > 0) ||
    (typeof listing.hygieneNotes === 'string' && listing.hygieneNotes.trim().length > 0) ||
    (typeof listing.safetyNotes === 'string' && listing.safetyNotes.trim().length > 0) ||
    (typeof listing.depositAmount === 'number' && Number.isFinite(listing.depositAmount))
  );
}

interface ProtectionBulletKey {
  readonly id: string;
  readonly key: string;
}

const PROTECTION_BULLET_KEYS: readonly ProtectionBulletKey[] = [
  { id: 'b1', key: 'listings.details.protection.bullet1' },
  { id: 'b2', key: 'listings.details.protection.bullet2' },
  { id: 'b3', key: 'listings.details.protection.bullet3' },
  { id: 'b4', key: 'listings.details.protection.bullet4' },
  { id: 'b5', key: 'listings.details.protection.bullet5' },
];

const selectListingDetailsBase = createSelector(
  selectSelectedListing,
  selectListingDetailsLoading,
  selectListingsError,
  (
    listing,
    detailsLoading,
    error,
  ): {
    readonly listing: ListingDetails | null;
    readonly detailsLoading: boolean;
    readonly error: string | null;
  } => ({
    listing,
    detailsLoading,
    error,
  }),
);

@Component({
  selector: 'app-listing-details-page',
  standalone: true,
  imports: [
    AuthDialogComponent,
    BookingPanelComponent,
    ButtonModule,
    CommonModule,
    ListingGalleryComponent,
    RatingSummaryComponent,
    ReviewCardComponent,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './listing-details-page.component.html',
  styleUrl: './listing-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingDetailsPageComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  protected readonly showAuthDialog = signal(false);

  protected readonly protectionBullets = PROTECTION_BULLET_KEYS;

  protected readonly resolveConditionLabelKey = resolveConditionLabelKey;
  protected readonly resolveAgeRangeDisplay = resolveAgeRangeDisplay;
  protected readonly hasAnyToyDetail = hasAnyToyDetail;

  private readonly routeId$ = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    distinctUntilChanged(),
  );

  private readonly routeListingId = toSignal(this.routeId$, {
    initialValue: null as string | null,
  });

  protected readonly reviews = toSignal(
    this.routeId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectListingReviews(id)) : of([]),
      ),
    ),
    { initialValue: [] },
  );

  protected readonly reviewsLoading = toSignal(
    this.routeId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectListingReviewsLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly reviewsError = toSignal(
    this.routeId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectListingReviewsError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ratingSummary = toSignal(
    this.routeId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectListingSummary(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  // ── Owner trust signals ────────────────────────────────────────────────────

  private readonly ownerId$ = this.store.select(selectSelectedListing).pipe(
    map((listing) => listing?.owner?.id ?? null),
    distinctUntilChanged(),
  );

  protected readonly ownerSummary = toSignal(
    this.ownerId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserSummary(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ownerPublicProfile = toSignal(
    this.ownerId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectPublicProfile(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ownerMemberYear = computed(() => {
    const p = this.ownerPublicProfile();
    if (!p) return null;
    return new Date(p.memberSince).getFullYear().toString();
  });

  private readonly currentListingSignal = this.store.selectSignal(selectSelectedListing);

  private readonly createBookingSuccessId = this.store.selectSignal(selectCreateBookingSuccessId);

  protected readonly viewModel$ = combineLatest({
    listingState: this.store.select(selectListingDetailsBase),
    createBookingLoading: this.store.select(selectCreateBookingLoading),
    createBookingError: this.store.select(selectCreateBookingError),
    createBookingSuccessId: this.store.select(selectCreateBookingSuccessId),
    routeId: this.routeId$,
  }).pipe(
    map(
      ({
        listingState: state,
        createBookingLoading,
        createBookingError,
        createBookingSuccessId,
        routeId,
      }): ListingDetailsPageViewModel => {
        const invalidRoute = routeId === null || routeId === '';
        if (invalidRoute) {
          return {
            routeId: null,
            invalidRoute: true,
            displayListing: null,
            showSkeleton: false,
            showError: true,
            showContent: false,
            error: null,
            createBookingLoading,
            createBookingError,
            createBookingSuccess: false,
          };
        }

        const listing = state.listing;
        const loading = state.detailsLoading;
        const err = state.error;
        const hasError = err !== null;
        const idMatches = listing !== null && listing.id === routeId;

        return {
          routeId,
          invalidRoute: false,
          displayListing: idMatches ? listing : null,
          showSkeleton: loading && !idMatches,
          showError: hasError,
          showContent: idMatches && !loading && !hasError,
          error: err,
          createBookingLoading,
          createBookingError,
          createBookingSuccess: createBookingSuccessId !== null,
        };
      },
    ),
  );

  constructor() {
    effect(() => {
      const id = this.routeListingId();
      if (id !== null && id !== '') {
        this.store.dispatch(ListingsActions.loadListingDetails({ id }));
        this.store.dispatch(BookingsActions.clearCreateBookingState());
        this.store.dispatch(ReviewsActions.loadListingReviews({ listingId: id }));
        this.store.dispatch(ReviewsActions.loadListingSummary({ listingId: id }));
      }
    });

    effect(() => {
      const successId = this.createBookingSuccessId();
      if (successId === null) return;
      const listingId = this.routeListingId();
      if (listingId !== null && listingId !== '') {
        this.store.dispatch(ListingsActions.loadListingDetails({ id: listingId }));
      }
    });

    // Load owner rating + public profile when the listing owner is known
    effect(() => {
      const ownerId = this.currentListingSignal()?.owner?.id;
      if (ownerId) {
        this.store.dispatch(ReviewsActions.loadUserSummary({ userId: ownerId }));
        this.store.dispatch(PublicProfilesActions.loadPublicProfile({ userId: ownerId }));
      }
    });
  }

  protected onFavoriteToggle(listing: ListingDetails): void {
    this.store.dispatch(
      ListingsActions.toggleFavoriteOptimistic({ listingId: listing.id }),
    );
  }

  protected retryLoad(): void {
    const id = this.routeListingId();
    if (id !== null && id !== '') {
      this.store.dispatch(ListingsActions.loadListingDetails({ id }));
    }
  }

  protected onBookingSubmit(payload: BookingSubmitPayload): void {
    const listingId = this.routeListingId();
    if (listingId === null || listingId === '') {
      return;
    }

    if (!this.isAuthenticated()) {
      this.showAuthDialog.set(true);
      return;
    }

    this.store.dispatch(BookingsActions.clearCreateBookingState());
    this.store.dispatch(
      BookingsActions.createBooking({
        payload: {
          listingId,
          startDate: toLocalIsoDate(payload.startDate),
          endDate: toLocalIsoDate(payload.endDate),
        },
      }),
    );
  }
}

function toLocalIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
