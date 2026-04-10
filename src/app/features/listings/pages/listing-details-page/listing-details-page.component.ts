import { AsyncPipe, CurrencyPipe } from '@angular/common';
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
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';

import { BookingCalendarComponent } from '../../components/booking-calendar/booking-calendar.component';
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
}

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
    AsyncPipe,
    BookingCalendarComponent,
    ButtonModule,
    CurrencyPipe,
    ListingGalleryComponent,
    MessageModule,
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

  private readonly routeId$ = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    distinctUntilChanged(),
  );

  private readonly routeListingId = toSignal(this.routeId$, {
    initialValue: null as string | null,
  });

  protected readonly viewModel$ = combineLatest([
    this.store.select(selectListingDetailsBase),
    this.routeId$,
  ]).pipe(
    map(([state, routeId]): ListingDetailsPageViewModel => {
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
      };
    }),
  );

  constructor() {
    effect(() => {
      const id = this.routeListingId();
      if (id !== null && id !== '') {
        this.store.dispatch(ListingsActions.loadListingDetails({ id }));
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
}
