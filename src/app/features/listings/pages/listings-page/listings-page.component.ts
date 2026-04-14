import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { firstValueFrom, take } from 'rxjs';

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
  readonly showAppendLoading: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectListingsPageViewModel = createSelector(
  selectListingItems,
  selectListingsLoading,
  selectListingsError,
  selectListingsHasMore,
  selectListingsPageSize,
  (
    items,
    loading,
    error,
    hasMore,
    pageSize,
  ): ListingsPageViewModel => {
    const hasError = error !== null;
    return {
      items,
      loading,
      error,
      hasMore,
      pageSize,
      showInitialSkeleton: loading && items.length === 0,
      showAppendLoading: loading && items.length > 0,
      showEmpty: !loading && items.length === 0 && !hasError,
      hasError,
    };
  },
);

const selectLoadMoreGate = createSelector(
  selectListingsHasMore,
  selectListingsLoading,
  (hasMore, loading): { hasMore: boolean; loading: boolean } => ({
    hasMore,
    loading,
  }),
);

@Component({
  selector: 'app-listings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    ListingCardComponent,
    ListingsFiltersComponent,
    MessageModule,
    SkeletonModule,
    TranslatePipe,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './listings-page.component.html',
  styleUrl: './listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  private readonly loadMoreSentinel =
    viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  protected readonly viewModel$ = this.store.select(
    selectListingsPageViewModel,
  );

  constructor() {
    effect((onCleanup) => {
      const sentinel = this.loadMoreSentinel()?.nativeElement;
      if (!sentinel) {
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              void this.tryDispatchLoadNextPage();
            }
          }
        },
        { root: null, rootMargin: '320px 0px', threshold: 0 },
      );
      observer.observe(sentinel);
      onCleanup(() => {
        observer.disconnect();
      });
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected onFiltersChanged(filters: ListingsFilter): void {
    this.store.dispatch(ListingsActions.updateFilters({ filters }));
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected onFavoriteToggled(listingId: string): void {
    this.store.dispatch(
      ListingsActions.toggleFavoriteOptimistic({ listingId }),
    );
  }

  protected retryAfterError(): void {
    this.store.dispatch(ListingsActions.loadListings());
  }

  protected skeletonItems(vm: ListingsPageViewModel): number[] {
    const count = Math.min(Math.max(vm.pageSize, 1), 12);
    return Array.from({ length: count }, (_, i) => i);
  }

  private async tryDispatchLoadNextPage(): Promise<void> {
    const { hasMore, loading } = await firstValueFrom(
      this.store.select(selectLoadMoreGate).pipe(take(1)),
    );
    if (hasMore && !loading) {
      this.store.dispatch(ListingsActions.loadNextPage());
    }
  }
}
