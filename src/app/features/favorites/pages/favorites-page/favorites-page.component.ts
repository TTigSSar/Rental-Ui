import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { ListingCardComponent } from '../../../listings/components/listing-card/listing-card.component';
import type { ListingPreview } from '../../../listings/models/listing.model';
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
}

const selectFavoritesPageViewModel = createSelector(
  selectFavoriteItems,
  selectFavoritesLoading,
  selectFavoritesError,
  (items, loading, error): FavoritesPageViewModel => {
    const hasError = error !== null;
    return {
      items,
      loading,
      error,
      showInitialSkeleton: loading && items.length === 0,
      showEmpty: !loading && items.length === 0 && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
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

  protected readonly viewModel$ = this.store.select(selectFavoritesPageViewModel);

  ngOnInit(): void {
    this.store.dispatch(FavoritesActions.loadFavorites());
  }

  protected retry(): void {
    this.store.dispatch(FavoritesActions.loadFavorites());
  }

  protected onFavoriteToggled(listingId: string): void {
    this.store.dispatch(FavoritesActions.removeFavoriteOptimistic({ listingId }));
  }
}
