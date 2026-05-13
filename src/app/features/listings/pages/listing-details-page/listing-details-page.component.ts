import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';

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
    BookingPanelComponent,
    ButtonModule,
    CommonModule,
    ListingGalleryComponent,
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

  protected readonly protectionBullets = PROTECTION_BULLET_KEYS;

  private readonly routeId$ = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    distinctUntilChanged(),
  );

  private readonly routeListingId = toSignal(this.routeId$, {
    initialValue: null as string | null,
  });

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
