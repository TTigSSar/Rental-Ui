import { AsyncPipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ListingCardComponent } from '../../../listings/components/listing-card/listing-card.component';
import type { ListingPreview } from '../../../listings/models/listing.model';
import * as ListingsActions from '../../../listings/store/listings.actions';
import * as FavoritesActions from '../../store/favorites.actions';
import {
  selectFavoriteItems,
  selectFavoritesError,
  selectFavoritesLoading,
} from '../../store/favorites.selectors';

interface FavoritesPageViewModel {
  readonly items: ListingPreview[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
  readonly savedCount: number;
  readonly uniqueCitiesCount: number;
}

const selectFavoritesPageViewModel = createSelector(
  selectFavoriteItems,
  selectFavoritesLoading,
  selectFavoritesError,
  (items, loading, error): FavoritesPageViewModel => {
    const hasError = error !== null;
    const cities = new Set(
      items
        .map((i) => i.city)
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0),
    );
    return {
      items,
      loading,
      error,
      showInitialSkeleton: loading && items.length === 0,
      showEmpty: !loading && items.length === 0 && !hasError,
      hasError,
      savedCount: items.length,
      uniqueCitiesCount: cities.size,
    };
  },
);

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [
    AsyncPipe,
    EmptyStateComponent,
    ListingCardComponent,
    MessageModule,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly location = inject(Location);

  protected readonly viewModel$ = this.store.select(selectFavoritesPageViewModel);

  ngOnInit(): void {
    this.store.dispatch(FavoritesActions.loadFavorites());
  }

  protected goBack(): void {
    this.location.back();
  }

  protected retry(): void {
    this.store.dispatch(FavoritesActions.loadFavorites());
  }

  protected onFavoriteToggled(listingId: string): void {
    this.store.dispatch(ListingsActions.toggleFavoriteOptimistic({ listingId }));
  }
}
