import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { ListingsFiltersComponent } from '../../components/listings-filters/listings-filters.component';
import type { ListingsFilter } from '../../models/listings-filter.model';
import type { ListingPreview } from '../../models/listing.model';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingItems,
  selectListingsError,
  selectListingsHasMore,
  selectListingsLoading,
  selectListingsPageSize,
} from '../../store/listings.selectors';

export interface ListingsPageViewModel {
  readonly items: ListingPreview[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly hasMore: boolean;
  readonly pageSize: number;
  readonly showInitialSkeleton: boolean;
  readonly showAppendSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly showLoadMore: boolean;
  readonly hasError: boolean;
}

const selectListingsPageViewModel = createSelector(
  selectListingItems,
  selectListingsLoading,
  selectListingsError,
  selectListingsHasMore,
  selectListingsPageSize,
  (items, loading, error, hasMore, pageSize): ListingsPageViewModel => {
    const hasError = error !== null;
    return {
      items,
      loading,
      error,
      hasMore,
      pageSize,
      showInitialSkeleton: loading && items.length === 0,
      showAppendSkeleton: loading && items.length > 0,
      showEmpty: !loading && items.length === 0 && !hasError,
      showLoadMore: hasMore && !hasError && !loading,
      hasError,
    };
  },
);

@Component({
  selector: 'app-listings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    EmptyStateComponent,
    ListingCardComponent,
    ListingsFiltersComponent,
    LoadingSkeletonComponent,
    MessageModule,
    TranslatePipe,
  ],
  templateUrl: './listings-page.component.html',
  styleUrl: './listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly viewModel$ = this.store.select(selectListingsPageViewModel);

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected onFiltersChanged(filters: ListingsFilter): void {
    this.store.dispatch(ListingsActions.updateFilters({ filters }));
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected onFavoriteToggled(listingId: string): void {
    this.store.dispatch(ListingsActions.toggleFavoriteOptimistic({ listingId }));
  }

  protected loadMore(): void {
    this.store.dispatch(ListingsActions.loadNextPage());
  }

  protected retryAfterError(): void {
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected skeletonCount(vm: ListingsPageViewModel): number {
    return Math.min(Math.max(vm.pageSize, 1), 12);
  }
}
