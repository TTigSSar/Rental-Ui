import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { combineLatest, map } from 'rxjs';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { AuthDialogComponent } from '../../../auth/components/auth-dialog/auth-dialog.component';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { ListingsFiltersComponent } from '../../components/listings-filters/listings-filters.component';
import type { ListingsFilter } from '../../models/listings-filter.model';
import type { ListingPreview } from '../../models/listing.model';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingCategories,
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
  selectFavoriteIds,
  (items, loading, error, hasMore, pageSize, filters, isAuthenticated, favoriteIds): ListingsPageViewModel => {
    const hasError = error !== null;
    const hasActiveFilters =
      filters !== null &&
      Object.values(filters).some((v) => v !== null && v !== '');
    return {
      items: items.map((i) => ({ ...i, isFavorite: favoriteIds.has(i.id) })),
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

type SortBy = '' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';

interface SortOption {
  readonly value: SortBy;
  readonly labelKey: string;
  readonly icon: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'price_asc',   labelKey: 'listings.page.sortLowestPrice',   icon: 'pi pi-tag' },
  { value: 'price_desc',  labelKey: 'listings.page.sortHighestPrice',  icon: 'pi pi-tag' },
  { value: 'rating_desc', labelKey: 'listings.page.sortHighestRated',  icon: 'pi pi-star' },
  { value: 'newest',      labelKey: 'listings.page.sortNewest',        icon: 'pi pi-clock' },
];

function applySort(items: ListingPreview[], sortBy: string): ListingPreview[] {
  if (sortBy === 'price_asc')  return [...items].sort((a, b) => a.pricePerDay - b.pricePerDay);
  if (sortBy === 'price_desc') return [...items].sort((a, b) => b.pricePerDay - a.pricePerDay);
  return items;
}

@Component({
  selector: 'app-listings-page',
  standalone: true,
  imports: [
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
  private readonly location = inject(Location);

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  protected readonly showAuthDialog = signal(false);
  protected readonly sortBy = signal<SortBy>('');
  protected readonly sortMenuOpen = signal(false);
  protected readonly sortOptions = SORT_OPTIONS;

  protected readonly activeSortOption = computed(() =>
    SORT_OPTIONS.find(o => o.value === this.sortBy()) ?? null
  );

  private readonly itemsSignal = this.store.selectSignal(selectListingItems);
  private readonly hasMoreSignal = this.store.selectSignal(selectListingsHasMore);
  private readonly filtersSignal = this.store.selectSignal(selectListingsFilters);
  protected readonly categoriesSignal = this.store.selectSignal(selectListingCategories);

  protected readonly activeCategoryId = computed(() => this.filtersSignal().categoryId);

  protected readonly activeCategoryName = computed(() => {
    const id = this.filtersSignal().categoryId;
    if (!id) return null;
    return this.categoriesSignal().find((c) => c.id === id)?.name ?? null;
  });

  protected readonly activeFilterChips = computed(() => {
    const f = this.filtersSignal();
    const chips: { key: string; label: string }[] = [];
    // categoryId is shown via the category chips row — not duplicated here
    if (f.city?.trim()) {
      chips.push({ key: 'city', label: f.city.trim() });
    }
    if (f.minPrice != null) {
      chips.push({ key: 'minPrice', label: `$${f.minPrice}+` });
    }
    if (f.maxPrice != null) {
      chips.push({ key: 'maxPrice', label: `≤ $${f.maxPrice}` });
    }
    return chips;
  });

  protected readonly resultCountLabel = computed(() => {
    const n = this.itemsSignal().length;
    const suffix = this.hasMoreSignal() ? '+' : '';
    return `${n}${suffix}`;
  });

  protected readonly viewModel$ = combineLatest([
    this.store.select(selectListingsPageViewModel),
    toObservable(this.sortBy),
  ]).pipe(
    map(([vm, sort]) => ({ ...vm, items: applySort(vm.items, sort) })),
  );

  protected readonly vm = toSignal(this.viewModel$);

  constructor() {
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

  protected toggleSortMenu(): void {
    this.sortMenuOpen.update(v => !v);
  }

  protected selectSort(value: SortBy): void {
    this.sortBy.set(this.sortBy() === value ? '' : value);
    this.sortMenuOpen.set(false);
  }

  protected skeletonCount(vm: ListingsPageViewModel): number {
    return Math.min(Math.max(vm.pageSize, 1), 12);
  }

  protected goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/']);
    }
  }

  protected selectCategory(id: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { categoryId: id },
      queryParamsHandling: 'merge',
    });
  }

  protected removeFilterChip(key: string): void {
    const paramKey = key === 'categoryId' ? 'categoryId'
      : key === 'city' ? 'city'
      : key === 'minPrice' ? 'minPrice'
      : key === 'maxPrice' ? 'maxPrice'
      : null;
    if (!paramKey) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [paramKey]: null },
      queryParamsHandling: 'merge',
    });
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
