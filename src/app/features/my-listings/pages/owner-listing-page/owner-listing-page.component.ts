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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { selectAuthUser } from '../../../auth/store/auth.selectors';
import { ListingGalleryComponent } from '../../../listings/components/listing-gallery/listing-gallery.component';
import type { ListingDetails } from '../../../listings/models/listing-details.model';
import * as ListingsActions from '../../../listings/store/listings.actions';
import {
  selectListingDetailsLoading,
  selectListingsError,
  selectSelectedListing,
} from '../../../listings/store/listings.selectors';
import {
  resolveAgeRangeDisplay,
  resolveConditionLabelKey,
  hasAnyToyDetail,
} from '../../../listings/pages/listing-details-page/listing-details-page.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectListingToyReviews,
  selectListingToyReviewsError,
  selectListingToyReviewsLoading,
} from '../../../reviews/store/reviews.selectors';
import { ListingStatusBannerComponent } from '../../components/listing-status-banner/listing-status-banner.component';
import { OwnerRequestCardComponent } from '../../components/owner-request-card/owner-request-card.component';
import { OwnerStatCardComponent } from '../../components/owner-stat-card/owner-stat-card.component';
import type {
  OwnerBookingRequest,
  OwnerListingStatus,
} from '../../models/owner-listing.model';
import { OwnerListingService } from '../../services/owner-listing.service';

@Component({
  selector: 'app-owner-listing-page',
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    DramCurrencyPipe,
    ListingGalleryComponent,
    ListingStatusBannerComponent,
    OwnerRequestCardComponent,
    OwnerStatCardComponent,
    PageHeaderComponent,
    ReviewCardComponent,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './owner-listing-page.component.html',
  styleUrl: './owner-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerListingPageComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ownerService = inject(OwnerListingService);

  protected readonly resolveConditionLabelKey = resolveConditionLabelKey;
  protected readonly resolveAgeRangeDisplay = resolveAgeRangeDisplay;
  protected readonly hasAnyToyDetail = hasAnyToyDetail;

  private readonly routeId$ = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    distinctUntilChanged(),
  );

  private readonly routeId = toSignal(this.routeId$, { initialValue: null as string | null });

  private readonly currentUser = this.store.selectSignal(selectAuthUser);
  private readonly selectedListing = this.store.selectSignal(selectSelectedListing);
  private readonly detailsLoading = this.store.selectSignal(selectListingDetailsLoading);
  protected readonly detailsError = this.store.selectSignal(selectListingsError);

  /** Listing only when the loaded entity matches the current route id. */
  protected readonly listing = computed<ListingDetails | null>(() => {
    const listing = this.selectedListing();
    const id = this.routeId();
    return listing !== null && id !== null && listing.id === id ? listing : null;
  });

  protected readonly listingTitle = computed(() => this.listing()?.title ?? '');

  protected readonly isOwner = computed(() => {
    const listing = this.listing();
    const user = this.currentUser();
    return listing !== null && user !== null && listing.owner.id === user.id;
  });

  protected readonly showSkeleton = computed(
    () => this.listing() === null && this.detailsLoading(),
  );
  protected readonly showError = computed(
    () => this.detailsError() !== null && this.listing() === null,
  );
  protected readonly showContent = computed(() => this.listing() !== null && this.isOwner());

  // —— Owner-view data (real endpoints; optimistic local mutations) ——
  protected readonly status = signal<OwnerListingStatus>('Active');
  protected readonly requests = signal<readonly OwnerBookingRequest[]>([]);
  protected readonly requestsLoading = signal(false);
  protected readonly statusPending = signal(false);
  protected readonly actionIds = signal<ReadonlySet<string>>(new Set());

  protected readonly pendingCount = computed(
    () => this.requests().filter((r) => r.decision === 'pending').length,
  );

  // —— Reviews (read-only, reused from the renter view's data source) ——
  private readonly toySummary = toSignal(
    this.routeId$.pipe(
      switchMap((id) => (id ? this.store.select(selectListingToyReviews(id)) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly reviews = computed(() => this.toySummary()?.comments ?? []);

  protected readonly reviewsLoading = toSignal(
    this.routeId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectListingToyReviewsLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly reviewsError = toSignal(
    this.routeId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectListingToyReviewsError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ratingSummary = computed(() => {
    const s = this.toySummary();
    return s && s.hasAggregate
      ? { averageRating: s.overallAverage, reviewCount: s.reviewCount }
      : null;
  });

  // —— Real stat-card display values ——
  protected readonly hasReviews = computed(() => (this.ratingSummary()?.reviewCount ?? 0) > 0);
  protected readonly reviewCount = computed(() => this.ratingSummary()?.reviewCount ?? 0);
  protected readonly ratingValue = computed(() => {
    const summary = this.ratingSummary();
    return summary ? summary.averageRating.toFixed(1) : '—';
  });
  protected readonly pendingCountLabel = computed(() => this.pendingCount().toString());
  protected readonly totalRequests = computed(() => this.requests().length);

  constructor() {
    // Load the shared listing detail + reviews for the routed id.
    effect(() => {
      const id = this.routeId();
      if (id) {
        this.store.dispatch(ListingsActions.loadListingDetails({ id }));
        this.store.dispatch(ReviewsActions.loadListingToyReviews({ listingId: id }));
      }
    });

    // Redirect non-owners to the public renter view.
    effect(() => {
      const listing = this.listing();
      const user = this.currentUser();
      if (listing !== null && user !== null && listing.owner.id !== user.id) {
        void this.router.navigate(['/listings', listing.id], { replaceUrl: true });
      }
    });

    // Fetch real owner-view data (status + enriched booking requests) once the
    // listing is confirmed to belong to the current user.
    effect(() => {
      const listing = this.listing();
      if (listing === null || !this.isOwner()) return;
      const listingId = listing.id;

      this.ownerService.getStatus(listingId).subscribe((status) => this.status.set(status));

      this.requestsLoading.set(true);
      this.ownerService.getRequestsForListing(listingId).subscribe({
        next: (requests) => {
          this.requests.set(requests);
          this.requestsLoading.set(false);
        },
        error: () => this.requestsLoading.set(false),
      });
    });
  }

  protected onStatusChange(next: OwnerListingStatus): void {
    const listing = this.listing();
    if (listing === null) return;
    const previous = this.status();
    // Optimistic update; roll back on failure.
    this.status.set(next);
    this.statusPending.set(true);
    this.ownerService.setStatus(listing.id, next).subscribe({
      next: () => this.statusPending.set(false),
      error: () => {
        this.status.set(previous);
        this.statusPending.set(false);
      },
    });
  }

  protected onAccept(bookingId: string): void {
    this.setActionLoading(bookingId, true);
    this.ownerService.acceptRequest(bookingId).subscribe({
      next: () => {
        this.patchDecision(bookingId, 'accepted');
        this.setActionLoading(bookingId, false);
      },
      error: () => this.setActionLoading(bookingId, false),
    });
  }

  protected onDecline(bookingId: string): void {
    this.setActionLoading(bookingId, true);
    this.ownerService.declineRequest(bookingId).subscribe({
      next: () => {
        this.patchDecision(bookingId, 'declined');
        this.setActionLoading(bookingId, false);
      },
      error: () => this.setActionLoading(bookingId, false),
    });
  }

  protected onMessage(request: OwnerBookingRequest): void {
    // TODO(real API): open the conversation with this renter once chat threads
    // can be created from a booking. For now route to the chat inbox.
    void this.router.navigate(['/chat'], { queryParams: { renter: request.renter.id } });
  }

  protected isActionLoading(bookingId: string): boolean {
    return this.actionIds().has(bookingId);
  }

  protected retryLoad(): void {
    const id = this.routeId();
    if (id) {
      this.store.dispatch(ListingsActions.loadListingDetails({ id }));
    }
  }

  private patchDecision(bookingId: string, decision: OwnerBookingRequest['decision']): void {
    this.requests.update((list) =>
      list.map((r) => (r.id === bookingId ? { ...r, decision } : r)),
    );
  }

  private setActionLoading(bookingId: string, loading: boolean): void {
    this.actionIds.update((ids) => {
      const next = new Set(ids);
      if (loading) {
        next.add(bookingId);
      } else {
        next.delete(bookingId);
      }
      return next;
    });
  }
}
