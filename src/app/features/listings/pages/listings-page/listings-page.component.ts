import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { AuthDialogComponent } from '../../../auth/components/auth-dialog/auth-dialog.component';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { ListingsFiltersComponent } from '../../components/listings-filters/listings-filters.component';
import type { ListingsFilter } from '../../models/listings-filter.model';
import type { ListingPreview } from '../../models/listing.model';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingItems,
  selectListingsError,
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsLoading,
  selectListingsPageSize,
} from '../../store/listings.selectors';
import type { ParamMap } from '@angular/router';

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
  readonly hasActiveFilters: boolean;
  readonly isAuthenticated: boolean;
}

const selectListingsPageViewModel = createSelector(
  selectListingItems,
  selectListingsLoading,
  selectListingsError,
  selectListingsHasMore,
  selectListingsPageSize,
  selectListingsFilters,
  selectIsAuthenticated,
  (items, loading, error, hasMore, pageSize, filters, isAuthenticated): ListingsPageViewModel => {
    const hasError = error !== null;
    const hasActiveFilters =
      filters !== null &&
      Object.values(filters).some((v) => v !== null && v !== '');
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
      hasActiveFilters,
      isAuthenticated,
    };
  },
);

@Component({
  selector: 'app-listings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    AuthDialogComponent,
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
export class ListingsPageComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  protected readonly showAuthDialog = signal(false);

  protected readonly viewModel$ = this.store.select(selectListingsPageViewModel);

  constructor() {
    // Reacts to direct URL loads, programmatic navigation, and browser back/forward.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const filters = this.parseFiltersFromParams(params);
        this.store.dispatch(ListingsActions.updateFilters({ filters }));
        this.store.dispatch(ListingsActions.loadListings());
      });
  }

  // URL is the source of truth; the queryParamMap subscription above handles all reloads.
  protected onFiltersChanged(_filters: ListingsFilter): void {}

  protected onFavoriteToggled(listingId: string): void {
    if (!this.isAuthenticated()) {
      this.showAuthDialog.set(true);
      return;
    }
    this.store.dispatch(ListingsActions.toggleFavoriteOptimistic({ listingId }));
  }

  protected loadMore(): void {
    this.store.dispatch(ListingsActions.loadNextPage());
  }

  protected retryAfterError(): void {
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected skeletonCount(vm: ListingsPageViewModel): number {
    return Math.min(Math.max(vm.pageSize, 1), 12);
  }

  private parseFiltersFromParams(params: ParamMap): ListingsFilter {
    const q = params.get('q');
    const city = params.get('city');
    const categoryId = params.get('categoryId');
    const minPriceStr = params.get('minPrice');
    const maxPriceStr = params.get('maxPrice');
    return {
      query: q?.trim() || null,
      city: city?.trim() || null,
      categoryId: categoryId?.trim() || null,
      minPrice:
        minPriceStr != null && !Number.isNaN(Number(minPriceStr))
          ? Number(minPriceStr)
          : null,
      maxPrice:
        maxPriceStr != null && !Number.isNaN(Number(maxPriceStr))
          ? Number(maxPriceStr)
          : null,
    };
  }
}
