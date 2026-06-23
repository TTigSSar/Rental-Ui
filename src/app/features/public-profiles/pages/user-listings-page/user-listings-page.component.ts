import { DecimalPipe, Location } from '@angular/common';
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

import { ListingCardComponent } from '../../../listings/components/listing-card/listing-card.component';
import * as ListingsActions from '../../../listings/store/listings.actions';
import type { ListingPreview } from '../../../listings/models/listing.model';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as PublicProfilesActions from '../../store/public-profiles.actions';
import {
  selectPublicProfile,
  selectPublicProfileLoading,
  selectUserListings,
  selectUserListingsError,
  selectUserListingsLoading,
} from '../../store/public-profiles.selectors';

export type ListingFilter = 'all' | 'available' | 'rented';
type SortBy = 'newest' | 'price_asc' | 'price_desc';

interface SortOption {
  readonly value: SortBy;
  readonly labelKey: string;
  readonly icon: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'newest',     labelKey: 'listings.page.sortNewest',       icon: 'pi pi-clock' },
  { value: 'price_asc',  labelKey: 'listings.page.sortLowestPrice',  icon: 'pi pi-tag' },
  { value: 'price_desc', labelKey: 'listings.page.sortHighestPrice', icon: 'pi pi-tag' },
];

function applySort(items: readonly ListingPreview[], sortBy: SortBy): readonly ListingPreview[] {
  if (sortBy === 'price_asc')  return [...items].sort((a, b) => a.pricePerDay - b.pricePerDay);
  if (sortBy === 'price_desc') return [...items].sort((a, b) => b.pricePerDay - a.pricePerDay);
  return items;
}

@Component({
  selector: 'app-user-listings-page',
  standalone: true,
  imports: [
    ButtonModule,
    DecimalPipe,
    ListingCardComponent,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './user-listings-page.component.html',
  styleUrl: './user-listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListingsPageComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly activeFilter = signal<ListingFilter>('all');
  protected readonly sortBy = signal<SortBy>('newest');
  protected readonly sortMenuOpen = signal(false);
  protected readonly sortOptions = SORT_OPTIONS;

  protected readonly activeSortOption = computed(
    () => SORT_OPTIONS.find(o => o.value === this.sortBy()) ?? null,
  );

  private readonly userId$ = this.route.paramMap.pipe(
    map((params) => params.get('userId')),
    distinctUntilChanged(),
  );

  protected readonly userIdSignal = toSignal(this.userId$, { initialValue: null });

  protected readonly profile = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectPublicProfile(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly profileLoading = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectPublicProfileLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly allListings = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserListings(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly listingsLoading = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserListingsLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly listingsError = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserListingsError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly displayName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.firstName} ${p.lastName}`.trim();
  });

  protected readonly firstName = computed(() => this.profile()?.firstName ?? '');

  protected readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly ownerRating = computed(() =>
    this.profile()?.ownerRating ?? this.profile()?.averageRating ?? null,
  );

  protected readonly location$ = computed(() => this.profile()?.location ?? null);

  protected readonly allCount = computed(() => this.allListings()?.length ?? 0);

  protected readonly availableCount = computed(
    () => this.allListings()?.filter((l) => l.listingStatus === 'available').length ?? 0,
  );

  protected readonly rentedCount = computed(
    () => this.allListings()?.filter((l) => l.listingStatus === 'rented').length ?? 0,
  );

  protected readonly filteredListings = computed((): readonly ListingPreview[] => {
    const all = this.allListings() ?? [];
    const f = this.activeFilter();
    const filtered = f === 'all' ? all : all.filter((l) => l.listingStatus === f);
    return applySort(filtered, this.sortBy());
  });

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);

  protected readonly showSkeleton = computed(
    () => (this.profileLoading() || this.listingsLoading()) && this.allListings() === null,
  );

  constructor() {
    effect(() => {
      const id = this.userIdSignal();
      if (id !== null && id !== '') {
        this.store.dispatch(PublicProfilesActions.loadPublicProfile({ userId: id }));
        this.store.dispatch(PublicProfilesActions.loadUserListings({ userId: id }));
      }
    });
  }

  protected setFilter(f: ListingFilter): void {
    this.activeFilter.set(f);
  }

  protected toggleSortMenu(): void {
    this.sortMenuOpen.update(v => !v);
  }

  protected selectSort(value: SortBy): void {
    this.sortBy.set(value);
    this.sortMenuOpen.set(false);
  }

  protected goBack(): void {
    const userId = this.userIdSignal();
    if (userId) {
      void this.router.navigate(['/users', userId]);
    } else {
      this.location.back();
    }
  }

  protected retry(): void {
    const id = this.userIdSignal();
    if (id !== null && id !== '') {
      this.store.dispatch(PublicProfilesActions.loadPublicProfile({ userId: id }));
      this.store.dispatch(PublicProfilesActions.loadUserListings({ userId: id }));
    }
  }

  protected onFavoriteToggled(listingId: string): void {
    this.store.dispatch(ListingsActions.toggleFavoriteOptimistic({ listingId }));
  }
}
