import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import {
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  filter,
  map,
  of,
  pairwise,
  startWith,
  switchMap,
} from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { DRAM_SYMBOL } from '../../../../shared/utils/dram-currency.pipe';
import { AuthDialogComponent } from '../../../auth/components/auth-dialog/auth-dialog.component';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { MyListingsApiService } from '../../../my-listings/services/my-listings-api.service';
import * as BookingsActions from '../../../bookings/store/bookings.actions';
import type { BookingStatus } from '../../../bookings/models/booking.model';
import { selectMyBookings } from '../../../bookings/store/bookings.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import { AiExampleComponent } from '../../components/ai-example/ai-example.component';
import { AiNoResultsComponent } from '../../components/ai-no-results/ai-no-results.component';
import { AiNoticeComponent } from '../../components/ai-notice/ai-notice.component';
import { AiSearchFieldComponent } from '../../components/ai-search-field/ai-search-field.component';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { ListingsFiltersComponent } from '../../components/listings-filters/listings-filters.component';
import { ListingsMapComponent } from '../../components/listings-map/listings-map.component';
import { RadiusOriginFilterComponent } from '../../components/radius-origin-filter/radius-origin-filter.component';
import { AGE_GROUPS } from '../../models/age-groups.const';
import { sameFilters } from '../../models/ai-search.util';
import { districtDisplayName } from '../../models/district-ui.util';
import type { ListingDistrict } from '../../models/district.model';
import {
  parseDistrictIdsParam,
  parseRadiusKmParam,
  serializeDistrictIdsParam,
  serializeRadiusKmParam,
} from '../../models/listings-filter.model';
import type { ListingsFilter } from '../../models/listings-filter.model';
import { formatDistanceMeters, kmToMeters, localeTagForLanguage, metersToKm } from '../../models/radius-scale.util';
import { radiusChipLabel } from '../../models/radius-chip.util';
import type { ListingPreview } from '../../models/listing.model';
import { ListingsApiService } from '../../services/listings-api.service';
import * as ListingsActions from '../../store/listings.actions';

import {
  selectAiBudgetSpent,
  selectAiBusy,
  selectAiDescription,
  selectAiExplanation,
  selectAiFallbackNotice,
  selectAiHasSearched,
  selectAiMode,
  selectAiNotes,
  selectAiOtherError,
  selectAiRanked,
  selectAiRankedCount,
  selectAiRateLimited,
  selectAiResultsActive,
  selectListingCategories,
  selectListingItems,
  selectListingsError,
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsLoading,
  selectListingsOriginCoords,
  selectListingsOriginSource,
  selectListingsPageSize,
} from '../../store/listings.selectors';
import type { ParamMap } from '@angular/router';

/**
 * Starts the next-page fetch before the sentinel actually reaches the
 * viewport edge, so new cards are in place by the time the user scrolls
 * that far — same idea as `HERO_SEARCH_ROOT_MARGIN` in the home page.
 */
const SCROLL_SENTINEL_ROOT_MARGIN = '400px 0px';

const BOOKING_STATUS_PRIORITY: Partial<Record<BookingStatus, number>> = {
  Active: 6,
  Approved: 5,
  PendingApproval: 4,
  Pending: 3,
  ReturnMarked: 2,
  Completed: 1,
  Rejected: 0,
  Cancelled: 0,
};

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
      Object.values(filters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v !== null && v !== '',
      );
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

/** Desktop toolbar's removable-filter-chip row. `districtId` is only set for
 *  `key: 'districtId'` — several district chips share that key, so removal
 *  needs to know which one to drop (same reasoning as the mobile sheet's
 *  own `ActiveChip` in `listings-filters.component.ts`). */
interface ActiveFilterChip {
  readonly key: string;
  readonly label: string;
  readonly districtId?: string;
}

type SortBy = '' | 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';

/**
 * Maps P2-2: which surface the results area shows — `?view=map` in the URL,
 * parsed SEPARATELY from `ListingsFilter` (see `viewMode` below for why:
 * folding it into the filter model would leak `view` into
 * `buildListingsQueryParams()` and send it to the backend, which has no
 * such query parameter). Any value other than the literal `map` (including
 * absent) means `list` — the page's default, unchanged surface.
 */
type ListingsViewMode = 'list' | 'map';

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

/** Offered only while AI results are showing; the default sort in AI mode (ADR-054). */
const AI_SORT_OPTION: SortOption = {
  value: 'relevance',
  labelKey: 'listings.ai.sortRelevant',
  icon: 'pi pi-sort-amount-down',
};

function applySort(items: ListingPreview[], sortBy: string): ListingPreview[] {
  if (sortBy === 'price_asc')  return [...items].sort((a, b) => a.pricePerDay - b.pricePerDay);
  if (sortBy === 'price_desc') return [...items].sort((a, b) => b.pricePerDay - a.pricePerDay);
  return items;
}

@Component({
  selector: 'app-listings-page',
  standalone: true,
  imports: [
    AiExampleComponent,
    AiNoResultsComponent,
    AiNoticeComponent,
    AiSearchFieldComponent,
    AuthDialogComponent,
    ButtonModule,
    EmptyStateComponent,
    ListingCardComponent,
    ListingsFiltersComponent,
    ListingsMapComponent,
    LoadingSkeletonComponent,
    MessageModule,
    RadiusOriginFilterComponent,
    TranslatePipe,
  ],
  templateUrl: './listings-page.component.html',
  styleUrl: './listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsPageComponent {
  /** Price-input prefix in the sidebar — same source `DramCurrencyPipe` formats with. */
  protected readonly dramSymbol = DRAM_SYMBOL;

  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly translate = inject(TranslateService);
  private readonly listingsApi = inject(ListingsApiService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Infinite-scroll trigger for list view — see the constructor's
   *  `scrollSentinelIntersecting`/dispatch effects below. Not rendered (and
   *  therefore never observed) in map view or once there is nothing left to
   *  load — see the template's own `@if`. */
  private readonly scrollSentinelRef = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollSentinelObserver: IntersectionObserver | null = null;
  private readonly scrollSentinelIntersecting = signal(false);
  /** Drives the manual "Load more" fallback in the template: browsers
   *  without `IntersectionObserver` (or a test/SSR environment) never get an
   *  auto-load trigger, so the button must stay reachable instead of leaving
   *  the page a dead end. */
  protected readonly intersectionObserverSupported = typeof IntersectionObserver !== 'undefined';

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  protected readonly showAuthDialog = signal(false);

  private readonly myListingsApi = inject(MyListingsApiService);

  protected readonly myListingIds = toSignal(
    toObservable(this.isAuthenticated).pipe(
      switchMap((isAuth) =>
        isAuth
          ? this.myListingsApi
              .getMyListings()
              .pipe(map((listings) => new Set(listings.map((l) => l.id))))
          : of(new Set<string>()),
      ),
    ),
    { initialValue: new Set<string>() },
  );

  private readonly myBookingsSignal = this.store.selectSignal(selectMyBookings);

  protected readonly bookingStatusMap = computed(() => {
    const map = new Map<string, BookingStatus>();
    for (const b of this.myBookingsSignal()) {
      const incoming = BOOKING_STATUS_PRIORITY[b.status] ?? -1;
      if (incoming < 0) continue;
      const existing = map.get(b.listingId);
      if (existing === undefined || incoming > (BOOKING_STATUS_PRIORITY[existing] ?? -1)) {
        map.set(b.listingId, b.status);
      }
    }
    return map;
  });
  protected readonly sortBy = signal<SortBy>('');
  protected readonly sortMenuOpen = signal(false);

  // ── AI search (ADR-054) ────────────────────────────────────────────────
  protected readonly aiMode = this.store.selectSignal(selectAiMode);
  protected readonly aiBusy = this.store.selectSignal(selectAiBusy);
  /** AI mode on and a search produced the current results ("Most relevant first" is offered). */
  protected readonly aiHasSearched = this.store.selectSignal(selectAiHasSearched);
  /** The visible results are in AI order. */
  protected readonly aiResultsActive = this.store.selectSignal(selectAiResultsActive);
  protected readonly aiExplanation = this.store.selectSignal(selectAiExplanation);
  protected readonly aiRanked = this.store.selectSignal(selectAiRanked);
  protected readonly aiRankedCount = this.store.selectSignal(selectAiRankedCount);
  protected readonly aiNotes = this.store.selectSignal(selectAiNotes);
  /** The last search fell back to the ordinary catalogue: info notice, switch already off. */
  protected readonly aiFallbackNotice = this.store.selectSignal(selectAiFallbackNotice);
  private readonly aiBudgetSpent = this.store.selectSignal(selectAiBudgetSpent);
  private readonly aiRateLimited = this.store.selectSignal(selectAiRateLimited);
  private readonly aiOtherError = this.store.selectSignal(selectAiOtherError);
  private readonly aiDescription = this.store.selectSignal(selectAiDescription);
  private sortBeforeAi: SortBy | null = null;

  private readonly injector = inject(Injector);
  private readonly sidebarRef = viewChild<ElementRef<HTMLElement>>('sidebar');
  private readonly maxPriceRef = viewChild<ElementRef<HTMLInputElement>>('maxPriceInput');
  private readonly districtSectionRef = viewChild<ElementRef<HTMLElement>>('districtSection');
  private readonly aiExplainRef = viewChild<ElementRef<HTMLElement>>('aiExplain');
  private readonly desktopField = viewChild(AiSearchFieldComponent);
  private readonly filtersCmp = viewChild(ListingsFiltersComponent);
  /** A guest submitted a description: the search runs by itself once they have signed in. */
  private pendingAiSubmit = false;
  private prevAiBusy = this.aiBusy();
  private readonly desktopQuery$ = new Subject<string>();

  protected readonly sortOptions = computed<readonly SortOption[]>(() =>
    this.aiHasSearched() ? [AI_SORT_OPTION, ...SORT_OPTIONS] : SORT_OPTIONS,
  );

  /** `?view=map` — see `ListingsViewMode`'s own doc comment for why this is
   *  parsed independently of `ListingsFilter`/`parseFiltersFromParams()`.
   *  Absent/unrecognised ⇒ `'list'`. */
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map((params): ListingsViewMode => (params.get('view') === 'map' ? 'map' : 'list')),
    ),
    { initialValue: 'list' as ListingsViewMode },
  );

  protected readonly activeSortOption = computed(() =>
    this.sortOptions().find(o => o.value === this.sortBy()) ?? null
  );

  private readonly itemsSignal = this.store.selectSignal(selectListingItems);
  private readonly hasMoreSignal = this.store.selectSignal(selectListingsHasMore);
  private readonly filtersSignal = this.store.selectSignal(selectListingsFilters);
  /**
   * Read ONLY to decide whether the radius chip (below) is honest to show —
   * `originCoords` is session-only and never round-trips through the URL
   * (Maps P2-3), so a page reload with `?radiusKm=…` in the URL but no
   * origin in memory yet is an expected, recoverable state (see
   * `activeFilterChips` below), not an error.
   */
  private readonly originCoordsSignal = this.store.selectSignal(selectListingsOriginCoords);

  /** Which origin the current `distanceKm` values were measured from —
   *  handed to every card so the badge picks the right treatment (orange
   *  "from your home" vs blue "from you"). See
   *  `ListingCardComponent.distanceOrigin`. */
  protected readonly originSourceSignal = this.store.selectSignal(
    selectListingsOriginSource,
  );
  protected readonly categoriesSignal = this.store.selectSignal(selectListingCategories);

  // Anonymous, unchanging reference data — same treatment as `categoriesSignal`
  // would get if categories weren't already in NgRx, and identical to how
  // `ListingsFiltersComponent` (the mobile filter sheet) loads the SAME
  // `getDistricts()` stream: no second copy of state, just two components
  // reading the same anonymous endpoint independently, same as the codebase
  // already does for categories vs. this page vs. the create-listing wizard.
  private readonly districtsSignal = toSignal(
    this.listingsApi.getDistricts().pipe(
      startWith<ListingDistrict[]>([]),
      catchError(() => of<ListingDistrict[]>([])),
    ),
    { initialValue: [] as ListingDistrict[] },
  );

  protected readonly districtOptions = computed(() => {
    const lang = this.languageService.current().code;
    return this.districtsSignal().map((d) => ({ id: d.id, label: districtDisplayName(d, lang) }));
  });

  protected readonly activeCategoryId = computed(() => this.filtersSignal().categoryId);
  protected readonly activeAgeGroup   = computed(() => this.filtersSignal().ageGroup);
  protected readonly activeRadiusKm = computed(() => this.filtersSignal().radiusKm);
  /** `RadiusOriginFilterComponent` works in METRES (its slider math is
   *  metre-based) — converts at this component's own boundary since
   *  `ListingsFilter.radiusKm` stores fractional km. */
  protected readonly activeRadiusMeters = computed(() => {
    const km = this.activeRadiusKm();
    return km != null ? kmToMeters(km) : null;
  });
  protected readonly activeMinPrice   = computed(() => this.filtersSignal().minPrice);
  protected readonly activeMaxPrice   = computed(() => this.filtersSignal().maxPrice);
  protected readonly activeDistrictIds = computed(() => this.filtersSignal().districtIds);

  protected readonly ageGroups  = AGE_GROUPS;

  protected readonly activeCategoryName = computed(() => {
    const id = this.filtersSignal().categoryId;
    if (!id) return null;
    return this.categoriesSignal().find((c) => c.id === id)?.name ?? null;
  });

  protected readonly activeQuery = computed(() => this.filtersSignal().query ?? '');

  protected readonly hasSidebarFilters = computed(() => {
    const f = this.filtersSignal();
    return !!(
      f.categoryId ||
      f.ageGroup ||
      f.minPrice != null ||
      f.maxPrice != null ||
      f.radiusKm != null ||
      f.districtIds.length > 0
    );
  });

  private readonly localeTag = computed(() => localeTagForLanguage(this.languageService.current().code));

  protected readonly activeFilterChips = computed(() => {
    const f = this.filtersSignal();
    const chips: ActiveFilterChip[] = [];
    if (f.categoryId) {
      const cat = this.categoriesSignal().find((c) => c.id === f.categoryId);
      chips.push({ key: 'categoryId', label: cat?.name ?? f.categoryId });
    }
    if (f.ageGroup) {
      const ag = AGE_GROUPS.find((a) => a.value === f.ageGroup);
      chips.push({
        key: 'ageGroup',
        label: ag ? this.translate.instant(ag.labelKey) : f.ageGroup,
      });
    }
    // Gated on `originCoordsSignal()`, not just `f.radiusKm` — see that
    // field's own doc comment. Showing this chip with no origin in memory
    // (e.g. right after a page reload) would claim a filter is narrowing
    // results when the API request actually omitted it entirely
    // (`ListingsApiService.buildListingsQueryParams` only sends `radiusKm`/
    // `originLat`/`originLng` together). The radius VALUE itself is not
    // lost — `RadiusOriginFilterComponent`'s slider still shows it, greyed
    // out with "set a point first" — it just isn't presented as active
    // until an origin exists again.
    if (f.radiusKm != null && this.originCoordsSignal() !== null) {
      const distanceLabel = formatDistanceMeters(kmToMeters(f.radiusKm), this.localeTag(), {
        meters: this.translate.instant('listings.filters.distance.unitMeters'),
        kilometers: this.translate.instant('listings.filters.distance.unitKilometers'),
      });
      chips.push({
        key: 'radiusKm',
        label: radiusChipLabel(distanceLabel, this.originSourceSignal(), this.translate),
      });
    }
    for (const districtId of f.districtIds) {
      const district = this.districtOptions().find((d) => d.id === districtId);
      chips.push({ key: 'districtId', label: district?.label ?? districtId, districtId });
    }
    return chips;
  });

  protected readonly resultCountLabel = computed(() => {
    const n = this.itemsSignal().length;
    const suffix = this.hasMoreSignal() ? '+' : '';
    return `${n}${suffix}`;
  });

  /** First search (no AI results yet), or a search/re-rank with nothing to dim: the skeleton shows. */
  protected readonly aiSkeleton = computed(() => {
    const busy = this.aiBusy();
    if (busy === 'idle') return false;
    return this.itemsSignal().length === 0 || (busy === 'searching' && !this.aiHasSearched());
  });
  /** The "Finding toys that match your description" status line + indeterminate bar. */
  protected readonly aiStatusLine = computed(() => this.aiBusy() === 'searching' || this.aiSkeleton());

  /** AI search found nothing (option A): the AI-specific empty state replaces the generic one. */
  protected readonly aiNoResults = computed(
    () => this.aiHasSearched() && this.aiBusy() === 'idle' && this.itemsSignal().length === 0,
  );
  protected readonly hasDistrictFilter = computed(() => this.activeDistrictIds().length > 0);
  /** "Or browse other categories": every category except the one already applied. */
  protected readonly otherCategories = computed(() =>
    this.categoriesSignal().filter((c) => c.id !== this.activeCategoryId()),
  );

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
        // Read BEFORE mirroring `?ai` into the store: true only if the URL still says AI AND AI
        // results are showing. In that case the URL change is a user filter/chip edit (or the echo
        // of the filters the AI itself just applied): re-rank, don't reload the catalogue.
        const aiActive = params.get('ai') === '1' && this.aiResultsActive();
        this.store.dispatch(ListingsActions.setAiMode({ on: params.get('ai') === '1' }));
        if (aiActive) {
          if (!sameFilters(filters, this.filtersSignal())) {
            this.store.dispatch(ListingsActions.aiFiltersChanged({ filters }));
          }
          return;
        }
        this.store.dispatch(ListingsActions.updateFilters({ filters }));
        this.store.dispatch(ListingsActions.loadListings());
      });

    // Budget state for the switch (loaded for guests too - the endpoint is anonymous).
    this.store.dispatch(ListingsActions.loadAiStatus());

    // Daily budget used up while AI mode is on (deep link `?ai=1`): leave AI mode, the field is
    // then a plain text search and the switch shows its disabled state.
    effect(() => {
      if (this.aiBudgetSpent() && this.aiMode()) {
        untracked(() => {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { ai: null },
            queryParamsHandling: 'merge',
          });
        });
      }
    });

    // Guest flow: after signing in, the kept description is searched automatically.
    toObservable(this.isAuthenticated)
      .pipe(
        pairwise(),
        filter(([was, now]) => !was && now),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const description = this.aiDescription().trim();
        if (this.pendingAiSubmit && this.aiMode() && description) {
          this.store.dispatch(ListingsActions.submitAiSearch({ description }));
        }
        this.pendingAiSubmit = false;
      });

    // On results, focus moves to the explanation line (the field keeps focus while loading).
    effect(() => {
      const busy = this.aiBusy();
      const finishedSearch = this.prevAiBusy === 'searching' && busy === 'idle';
      this.prevAiBusy = busy;
      if (!finishedSearch) return;
      untracked(() => {
        if (this.aiRateLimited() || this.aiOtherError()) return;
        afterNextRender(() => this.aiExplainRef()?.nativeElement.focus(), {
          injector: this.injector,
        });
      });
    });

    // Desktop plain-text search (the header search is hidden on this page).
    this.desktopQuery$
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((q) => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: q.trim() || null },
          queryParamsHandling: 'merge',
        });
      });

    // "Most relevant first" is the default sort while AI results show; switching the AI switch
    // off puts back the sort that was active before.
    effect(() => {
      const active = this.aiResultsActive();
      const mode = this.aiMode();
      untracked(() => {
        if (active) {
          if (this.sortBy() !== 'relevance') {
            if (this.sortBeforeAi === null) this.sortBeforeAi = this.sortBy();
            this.sortBy.set('relevance');
          }
        } else if (!mode && this.sortBeforeAi !== null) {
          this.sortBy.set(this.sortBeforeAi);
          this.sortBeforeAi = null;
        }
      });
    });

    effect(() => {
      if (this.isAuthenticated()) {
        this.store.dispatch(BookingsActions.loadMyBookings());
      }
    });

    // (Re)attaches the observer whenever the sentinel element mounts/unmounts
    // — it only exists in the DOM while list view has more pages and no
    // error (see the template), so this also tears the observer down for
    // free when the user switches to map view or the last page fails.
    // Pattern mirrors the hero-search observer in home-page.component.ts.
    effect(() => {
      const element = this.scrollSentinelRef()?.nativeElement ?? null;

      this.disconnectScrollSentinelObserver();
      this.scrollSentinelIntersecting.set(false);

      if (element === null || typeof IntersectionObserver === 'undefined') {
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => this.scrollSentinelIntersecting.set(entry.isIntersecting),
        { threshold: 0, rootMargin: SCROLL_SENTINEL_ROOT_MARGIN },
      );
      observer.observe(element);
      this.scrollSentinelObserver = observer;
    });

    // Fires the actual page fetch. Kept separate from the observer-attach
    // effect above so it re-evaluates on every `vm()` change too, not only on
    // intersection-boundary crossings — an `IntersectionObserver` callback
    // only fires when the element crosses in/out of the root, so on a short
    // viewport where the sentinel never leaves it (a handful of new cards
    // don't push it off screen), a page landing wouldn't otherwise trigger
    // the next one and the list would get stuck. Re-running this effect on
    // every `vm()` emission (loading flips back to false, `hasMore` updates)
    // keeps requesting the next page for as long as the sentinel stays
    // visible and there is more to load.
    effect(() => {
      if (!this.scrollSentinelIntersecting()) return;
      if (this.viewMode() !== 'list') return;

      const v = this.vm();
      if (!v || v.loading || !v.hasMore || v.hasError) return;

      this.loadMore();
    });

    this.destroyRef.onDestroy(() => this.disconnectScrollSentinelObserver());
  }

  private disconnectScrollSentinelObserver(): void {
    this.scrollSentinelObserver?.disconnect();
    this.scrollSentinelObserver = null;
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

  /**
   * Also clears the session-only origin point (Trello #80 — previously
   * nothing ever unset it, so the radius widget kept looking "active" after
   * every other filter was gone). Navigates WITHOUT `queryParamsHandling:
   * 'merge'` on purpose — "Clear all" must drop every filter param this page
   * doesn't explicitly keep, unlike the merge-navigate pattern the rest of
   * this component uses for single-field edits — but still preserves `view`
   * so "Clear all" in map view doesn't silently bounce back to list view. A
   * `null` `view` (not in the URL) is simply dropped, same as any other
   * explicit-null param.
   */
  protected clearFilters(): void {
    this.store.dispatch(ListingsActions.clearOrigin());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: this.route.snapshot.queryParamMap.get('view'),
        // Clearing filters is not leaving AI mode.
        ai: this.route.snapshot.queryParamMap.get('ai'),
      },
    });
  }

  /** `RadiusOriginFilterComponent`'s `(originCleared)` — the widget already
   *  dispatched `ListingsActions.clearOrigin()` itself; this only owns the
   *  radius half of the filter (merge-navigate, same commit pattern as
   *  `onRadiusMetersChange`). */
  protected onOriginCleared(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { radiusKm: null },
      queryParamsHandling: 'merge',
    });
  }

  /** A guest submitted in AI mode: remember it, open the EXISTING sign-in dialog. */
  protected onAiAuthRequired(): void {
    this.pendingAiSubmit = true;
    this.showAuthDialog.set(true);
  }

  protected onAuthDialogClosed(): void {
    this.showAuthDialog.set(false);
    // Closed without signing in: nothing runs.
    if (!this.isAuthenticated()) {
      this.pendingAiSubmit = false;
    }
  }

  /** The desktop sidebar is `display: none` below the breakpoint - then the sheet is the way in. */
  private isSidebarVisible(): boolean {
    return this.sidebarRef()?.nativeElement.offsetParent != null;
  }

  /** No results, primary: drop the districts (whole Yerevan); the URL change re-runs the search. */
  protected widenArea(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { districtIds: null },
      queryParamsHandling: 'merge',
    });
  }

  /** No results: "Edit description" - expand the field, caret at the end, focused. */
  protected editDescription(): void {
    const desktop = this.desktopField();
    if (desktop?.isVisible()) {
      desktop.focusEnd();
    } else {
      this.filtersCmp()?.focusAiField();
    }
  }

  /** No results: desktop focuses the sidebar price "To"; mobile opens the sheet scrolled to price. */
  protected increaseBudget(): void {
    if (this.isSidebarVisible()) {
      const input = this.maxPriceRef()?.nativeElement;
      input?.scrollIntoView({ block: 'center' });
      input?.focus({ preventScroll: true });
    } else {
      this.filtersCmp()?.openSheetAt('price');
    }
  }

  /** The location Note's "Choose a district" link. */
  protected chooseDistrict(): void {
    if (this.isSidebarVisible()) {
      const section = this.districtSectionRef()?.nativeElement;
      section?.scrollIntoView({ block: 'center' });
      section?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    } else {
      this.filtersCmp()?.openSheetAt('districts');
    }
  }

  protected onNotifyMe(): void {
    if (!this.isAuthenticated()) {
      this.showAuthDialog.set(true);
    }
  }

  protected toggleSortMenu(): void {
    this.sortMenuOpen.update(v => !v);
  }

  /** The open menu (z-index 50) would otherwise slide over the sticky
   *  search header (z-index 10) while the page scrolls underneath it. */
  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    if (this.sortMenuOpen()) {
      this.sortMenuOpen.set(false);
    }
  }

  protected selectSort(value: SortBy): void {
    this.sortMenuOpen.set(false);
    if (this.aiHasSearched()) {
      // With AI results showing, "Most relevant first" is a real option: choosing it re-ranks;
      // choosing anything else drops the AI order (ordinary catalogue). No "deselect" here.
      if (value === this.sortBy()) return;
      this.sortBy.set(value);
      if (value === 'relevance') {
        this.store.dispatch(ListingsActions.aiRerank());
      } else if (this.aiResultsActive()) {
        this.store.dispatch(ListingsActions.dropAiOrder());
      }
      return;
    }
    this.sortBy.set(this.sortBy() === value ? '' : value);
  }

  /** Plain-text search from the desktop field above the results (switch off). */
  protected onDesktopQueryChange(query: string): void {
    this.desktopQuery$.next(query);
  }

  /** The List/Map toggle — merges `view` into the URL like every other
   *  control on this page, rather than owning local state, so the mode
   *  survives a reload/share the same way filters already do. `'list'`
   *  clears the param entirely instead of writing `view=list`, keeping the
   *  URL clean for the page's default mode. */
  protected setViewMode(mode: ListingsViewMode): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === 'map' ? 'map' : null },
      queryParamsHandling: 'merge',
    });
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

  protected selectAgeGroup(value: string): void {
    const current = this.filtersSignal().ageGroup;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ageGroup: current === value ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Handles `RadiusOriginFilterComponent`'s `radiusMetersChange` — the
   * component owns the origin (geolocation/manual-pick/denied) UI and
   * dispatch itself (identical on both surfaces), but leaves the RADIUS
   * value's commit timing to the parent: the desktop sidebar applies
   * immediately (merge-navigates, like every other sidebar control here),
   * while the mobile sheet stages it in a draft instead (see
   * `listings-filters.component.ts`).
   */
  protected onRadiusMetersChange(meters: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { radiusKm: serializeRadiusKmParam(metersToKm(meters)) },
      queryParamsHandling: 'merge',
    });
  }

  protected setMinPrice(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const num = val.trim() ? Number(val) : null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { minPrice: num ?? null },
      queryParamsHandling: 'merge',
    });
  }

  protected setMaxPrice(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const num = val.trim() ? Number(val) : null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { maxPrice: num ?? null },
      queryParamsHandling: 'merge',
    });
  }

  protected removeFilterChip(chip: ActiveFilterChip): void {
    if (chip.key === 'districtId') {
      const current = this.filtersSignal().districtIds;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          districtIds: serializeDistrictIdsParam(current.filter((id) => id !== chip.districtId)),
        },
        queryParamsHandling: 'merge',
      });
      return;
    }

    // The chip reads "1 km · from you" — its × removes the whole location
    // filter, not just the radius number (Trello #80).
    if (chip.key === 'radiusKm') {
      this.store.dispatch(ListingsActions.clearOrigin());
    }

    const paramKey =
      chip.key === 'categoryId' ? 'categoryId' :
      chip.key === 'city'       ? 'city'       :
      chip.key === 'minPrice'   ? 'minPrice'   :
      chip.key === 'maxPrice'   ? 'maxPrice'   :
      chip.key === 'ageGroup'   ? 'ageGroup'   :
      chip.key === 'radiusKm'   ? 'radiusKm'   :
      null;
    if (!paramKey) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [paramKey]: null },
      queryParamsHandling: 'merge',
    });
  }

  protected selectCategoryFromSidebar(id: string): void {
    const current = this.filtersSignal().categoryId;
    this.selectCategory(current === id ? null : id);
  }

  /**
   * Toggles one district checkbox in the desktop sidebar. Shares the exact
   * same `districtIds: string[]` filter field, `districtIds` URL param, and
   * store slice as the mobile filter sheet's multiselect
   * (`ListingsFiltersComponent`) — there is no second copy of this state, so
   * a selection made here survives a resize down to mobile and back.
   */
  protected selectDistrictFromSidebar(id: string): void {
    const current = this.filtersSignal().districtIds;
    const next = current.includes(id)
      ? current.filter((existing) => existing !== id)
      : [...current, id];
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { districtIds: serializeDistrictIdsParam(next) },
      queryParamsHandling: 'merge',
    });
  }

  private parseFiltersFromParams(params: ParamMap): ListingsFilter {
    const q = params.get('q');
    const city = params.get('city');
    const categoryId = params.get('categoryId');
    const minPriceStr = params.get('minPrice');
    const maxPriceStr = params.get('maxPrice');
    const ageGroup = params.get('ageGroup');
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
      ageGroup: ageGroup?.trim() || null,
      radiusKm: parseRadiusKmParam(params.get('radiusKm')),
      districtIds: parseDistrictIdsParam(params.get('districtIds')),
    };
  }
}
