import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import type { ListingCategoryOption } from '../../../listings/models/create-listing.model';
import type { ListingPreview } from '../../../listings/models/listing.model';
import * as ListingsActions from '../../../listings/store/listings.actions';
import {
  selectListingCategories,
  selectListingCategoriesLoading,
  selectListingItems,
  selectListingsError,
  selectListingsLoading,
} from '../../../listings/store/listings.selectors';
import { FeaturedListingTileComponent } from '../../components/featured-listing-tile/featured-listing-tile.component';

interface StaticCategoryFallback {
  readonly slug: string;
  readonly labelKey: string;
  readonly icon: string;
}

const FEATURED_LIMIT = 8;

const STATIC_CATEGORIES: readonly StaticCategoryFallback[] = [
  {
    slug: 'apartment',
    labelKey: 'listings.filters.categories.apartment',
    icon: 'pi pi-building',
  },
  {
    slug: 'house',
    labelKey: 'listings.filters.categories.house',
    icon: 'pi pi-home',
  },
  {
    slug: 'villa',
    labelKey: 'listings.filters.categories.villa',
    icon: 'pi pi-star',
  },
  {
    slug: 'studio',
    labelKey: 'listings.filters.categories.studio',
    icon: 'pi pi-box',
  },
  {
    slug: 'cabin',
    labelKey: 'listings.filters.categories.cabin',
    icon: 'pi pi-compass',
  },
];

interface HomeCategoryVm {
  readonly id: string | null;
  readonly displayLabel: string;
  readonly labelTranslateKey: string | null;
  readonly icon: string;
  readonly isStatic: boolean;
}

interface HomePageViewModel {
  readonly featured: ListingPreview[];
  readonly featuredError: string | null;
  readonly showFeaturedSkeleton: boolean;
  readonly showFeaturedEmpty: boolean;
  readonly categories: HomeCategoryVm[];
  readonly categoriesLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly primaryCtaPath: string;
}

const selectHomeSource = createSelector(
  selectListingItems,
  selectListingsLoading,
  selectListingsError,
  selectListingCategories,
  selectListingCategoriesLoading,
  selectIsAuthenticated,
  (
    items,
    listingsLoading,
    listingsError,
    categories,
    categoriesLoading,
    isAuthenticated,
  ): {
    items: ListingPreview[];
    listingsLoading: boolean;
    listingsError: string | null;
    categories: ListingCategoryOption[];
    categoriesLoading: boolean;
    isAuthenticated: boolean;
  } => ({
    items,
    listingsLoading,
    listingsError,
    categories,
    categoriesLoading,
    isAuthenticated,
  }),
);

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    FeaturedListingTileComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly searchForm = this.fb.nonNullable.group({
    city: this.fb.nonNullable.control(''),
  });

  protected readonly viewModel$: Observable<HomePageViewModel> = this.store
    .select(selectHomeSource)
    .pipe(
      map(
        ({
          items,
          listingsLoading,
          listingsError,
          categories,
          categoriesLoading,
          isAuthenticated,
        }): HomePageViewModel => {
          const featured = items.slice(0, FEATURED_LIMIT);
          const mappedCategories: HomeCategoryVm[] =
            categories.length === 0
              ? STATIC_CATEGORIES.map(
                  (c): HomeCategoryVm => ({
                    id: null,
                    displayLabel: '',
                    labelTranslateKey: c.labelKey,
                    icon: c.icon,
                    isStatic: true,
                  }),
                )
              : categories.slice(0, 8).map(
                  (c): HomeCategoryVm => ({
                    id: c.id,
                    displayLabel: c.name,
                    labelTranslateKey: null,
                    icon: this.iconForSlug(c.slug),
                    isStatic: false,
                  }),
                );

          return {
            featured,
            featuredError: listingsError,
            showFeaturedSkeleton: listingsLoading && featured.length === 0,
            showFeaturedEmpty:
              !listingsLoading && featured.length === 0 && listingsError === null,
            categories: mappedCategories,
            categoriesLoading,
            isAuthenticated,
            primaryCtaPath: isAuthenticated ? '/listings/create' : '/auth/register',
          };
        },
      ),
    );

  ngOnInit(): void {
    this.store.dispatch(
      ListingsActions.updateFilters({
        filters: {
          city: null,
          categoryId: null,
          minPrice: null,
          maxPrice: null,
        },
      }),
    );
    this.store.dispatch(ListingsActions.loadListings());
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  protected onSearchSubmit(): void {
    const city = this.searchForm.controls.city.value.trim();
    this.store.dispatch(
      ListingsActions.updateFilters({
        filters: {
          city: city === '' ? null : city,
          categoryId: null,
          minPrice: null,
          maxPrice: null,
        },
      }),
    );
    void this.router.navigate(['/listings']);
  }

  protected onCategoryClick(category: HomeCategoryVm): void {
    if (category.isStatic || category.id === null) {
      void this.router.navigate(['/listings']);
      return;
    }
    this.store.dispatch(
      ListingsActions.updateFilters({
        filters: {
          city: null,
          categoryId: category.id,
          minPrice: null,
          maxPrice: null,
        },
      }),
    );
    void this.router.navigate(['/listings']);
  }

  protected retryFeatured(): void {
    this.store.dispatch(ListingsActions.loadListings());
  }

  private iconForSlug(slug: string): string {
    const normalized = slug.toLowerCase();
    const match = STATIC_CATEGORIES.find((c) => c.slug === normalized);
    return match?.icon ?? 'pi pi-tag';
  }
}
