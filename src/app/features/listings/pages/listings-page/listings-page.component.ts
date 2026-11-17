import { Location, NgTemplateOutlet, formatNumber } from '@angular/common';
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
  debounceTime,
  filter,
  map,
  of,
  pairwise,
  startWith,
  switchMap,
} from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import { categoryDisplayName } from '../../../../shared/utils/category-name.utils';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { DRAM_SYMBOL, DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
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
import {
  BrowseFiltersPanelComponent,
  type BrowseFilterPatch,
} from '../../components/browse-filters-panel/browse-filters-panel.component';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { ListingsFiltersComponent } from '../../components/listings-filters/listings-filters.component';
import { ListingsMapComponent } from '../../components/listings-map/listings-map.component';
import { RadiusOriginFilterComponent } from '../../components/radius-origin-filter/radius-origin-filter.component';
import { AGE_GROUPS } from '../../models/age-groups.const';
import { sameFilters } from '../../models/ai-search.util';
import { districtDisplayName } from '../../models/district-ui.util';
import type { ListingDistrict } from '../../models/district.model';
import {
  parseListingsFilterFromParams,
  serializeDistrictIdsParam,
  serializeListParam,
  serializeRadiusKmParam,
  serializeSortParam,
} from '../../models/listings-filter.model';
import type { ListingConditionFilter, ListingsFilter, ListingsSort } from '../../models/listings-filter.model';
import type { ListingCategoryOption } from '../../models/create-listing.model';
import { formatDistanceMeters, kmToMeters, localeTagForLanguage, metersToKm } from '../../models/radius-scale.util';
import { radiusChipLabel } from '../../models/radius-chip.util';
import type { ListingPreview } from '../../models/listing.model';
import { ListingsApiService } from '../../services/listings-api.service';
import * as ListingsActions from '../../store/listings.actions';

import {
  selectAiBudgetSpent,
  selectAiBusy,
  selectAiDescription,
  selectAiFallbackNotice,
  selectAiHasSearched,
  selectAiMode,
  selectAiNotes,
  selectAiOtherError,
  selectAiRanked,
  selectAiRankedCount,
  selectAiDailyLimited,
  selectAiRateLimited,
  selectAiResultsActive,
  selectListingCategories,
  selectListingFacets,
  selectListingItems,
  selectListingsError,
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsLoading,
  selectListingsOriginCoords,
  selectListingsOriginSource,
  selectListingsPageSize,
} from '../../store/listings.selectors';

/**
 * Starts the next-page fetch before the sentinel actually reaches the
 * viewport edge, so new cards are in place by the time the user scrolls
 * that far — same idea as `HERO_SEARCH_ROOT_MARGIN` in the home page.
 */
const SCROLL_SENTINEL_ROOT_MARGIN = '400px 0px';

const CONDITION_CHIP_LABEL_KEYS: Record<ListingConditionFilter, string> = {
  New: 'listings.details.conditionValues.new',
  LikeNew: 'listings.details.conditionValues.likeNew',
  Good: 'listings.details.conditionValues.good',
  Fair: 'listings.details.conditionValues.fair',
};

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

/** Any narrowing filter set. `sort` is an ordering, not a filter: the default `newest` must not count. */
export function hasActiveListingFilters(f: ListingsFilter): boolean {
  return !!(
    f.query ||
    f.city ||
    f.categoryIds.length > 0 ||
    f.ageGroups.length > 0 ||
    f.conditions.length > 0 ||
    f.districtIds.length > 0 ||
    f.minPrice != null ||
    f.maxPrice != null ||
    f.radiusKm != null
  );
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
    const hasActiveFilters = filters !== null && hasActiveListingFilters(filters);
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

/** Desktop toolbar's removable-filter-chip row (`.achip`, one per selected VALUE). `value` is the
 *  id/token of the value a multi-value chip removes; the combined price chip and the radius chip
 *  carry none. */
interface ActiveFilterChip {
  readonly key: 'categoryId' | 'ageGroup' | 'condition' | 'districtId' | 'price' | 'minPrice' | 'maxPrice' | 'radiusKm';
  readonly label: string;
  readonly value?: string;
}

/**
 * Maps P2-2: which surface the results area shows — `?view=map` in the URL,
 * parsed SEPARATELY from `ListingsFilter` (see `viewMode` below for why:
 * folding it into the filter model would leak `view` into
 * `buildListingsQueryParams()` and send it to the backend, which has no
 * such query parameter). Any value other than the literal `map` (including
 * absent) means `list` — the page's default, unchanged surface.
 */
type ListingsViewMode = 'list' | 'map';

/** `relevance` exists only while AI results are showing (ADR-054); it is never sent to the API. */
type SortValue = ListingsSort | 'relevance';

interface SortOption {
  readonly value: SortValue;
  readonly labelKey: string;
  /** `nearest` needs a radius origin; until one exists the option is disabled with a hint. */
  readonly disabled: boolean;
}

/** ADR-066 sort set, in menu order. */
const SORT_OPTION_DEFS: readonly { value: ListingsSort; labelKey: string }[] = [
  { value: 'newest', labelKey: 'listings.page.sortNewest' },
  { value: 'price_asc', labelKey: 'listings.page.sortPriceAsc' },
  { value: 'price_desc', labelKey: 'listings.page.sortPriceDesc' },
  { value: 'rating_desc', labelKey: 'listings.page.sortHighestRated' },
  { value: 'nearest', labelKey: 'listings.page.sortNearest' },
];

/** Offered only while AI results are showing; the default sort in AI mode (ADR-054). */
const AI_SORT_LABEL_KEY = 'listings.ai.sortRelevant';

/** No-break space before the dram symbol in the combined price chip ("1,500–5,000 ֏"). */
const NBSP = '\u00A0';

@Component({
  selector: 'app-listings-page',
  standalone: true,
  imports: [
    AiExampleComponent,
    AiNoResultsComponent,
    AiNoticeComponent,
    AiSearchFieldComponent,
    AuthDialogComponent,
    BrowseFiltersPanelComponent,
    ButtonModule,
    EmptyStateComponent,
    ListingCardComponent,
    ListingsFiltersComponent,
    ListingsMapComponent,
    LoadingSkeletonComponent,
    MessageModule,
    NgTemplateOutlet,
    RadiusOriginFilterComponent,
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
  protected readonly sortMenuOpen = signal(false);
  /** >= 961px: the toolbar is rendered in the desktop order (sort, then List/Map). */
  protected readonly isDesktop = signal(
    typeof matchMedia === 'function' && matchMedia('(min-width: 961px)').matches,
  );

  // ── AI search (ADR-054) ────────────────────────────────────────────────
  protected readonly aiMode = this.store.selectSignal(selectAiMode);
  protected readonly aiBusy = this.store.selectSignal(selectAiBusy);
  /** AI mode on and a search produced the current results ("Most relevant first" is offered). */
  protected readonly aiHasSearched = this.store.selectSignal(selectAiHasSearched);
  /** The visible results are in AI order. */
  protected readonly aiResultsActive = this.store.selectSignal(selectAiResultsActive);
  protected readonly aiRanked = this.store.selectSignal(selectAiRanked);
  protected readonly aiRankedCount = this.store.selectSignal(selectAiRankedCount);
  protected readonly aiNotes = this.store.selectSignal(selectAiNotes);
  /** The last search fell back to the ordinary catalogue: info notice, switch already off. */
  protected readonly aiFallbackNotice = this.store.selectSignal(selectAiFallbackNotice);
  private readonly aiBudgetSpent = this.store.selectSignal(selectAiBudgetSpent);
  private readonly aiRateLimited = this.store.selectSignal(selectAiRateLimited);
  private readonly aiDailyLimited = this.store.selectSignal(selectAiDailyLimited);
  private readonly aiOtherError = this.store.selectSignal(selectAiOtherError);
  private readonly aiDescription = this.store.selectSignal(selectAiDescription);

  private readonly injector = inject(Injector);
  private readonly panelRef = viewChild(BrowseFiltersPanelComponent);
  private readonly resultsRef = viewChild<ElementRef<HTMLElement>>('resultsRegion');
  private readonly desktopField = viewChild(AiSearchFieldComponent);
  private readonly filtersCmp = viewChild(ListingsFiltersComponent);
  /** A guest submitted a description: the search runs by itself once they have signed in. */
  private pendingAiSubmit = false;
  private prevAiBusy = this.aiBusy();
  private readonly desktopQuery$ = new Subject<string>();

  /** `?view=map` — see `ListingsViewMode`'s own doc comment for why this is
   *  parsed independently of `ListingsFilter`/`parseFiltersFromParams()`.
   *  Absent/unrecognised ⇒ `'list'`. */
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map((params): ListingsViewMode => (params.get('view') === 'map' ? 'map' : 'list')),
    ),
    { initialValue: 'list' as ListingsViewMode },
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

  protected readonly filters = this.filtersSignal;
  protected readonly facets = this.store.selectSignal(selectListingFacets);
  protected readonly districts = this.districtsSignal;
  protected readonly activeRadiusKm = computed(() => this.filtersSignal().radiusKm);
  /** `RadiusOriginFilterComponent` works in METRES (its slider math is
   *  metre-based) — converts at this component's own boundary since
   *  `ListingsFilter.radiusKm` stores fractional km. */
  protected readonly activeRadiusMeters = computed(() => {
    const km = this.activeRadiusKm();
    return km != null ? kmToMeters(km) : null;
  });
  protected readonly activeDistrictIds = computed(() => this.filtersSignal().districtIds);

  /** A radius origin exists (home point, device location or a picked point): `nearest` can be used. */
  protected readonly hasOrigin = computed(() => this.originCoordsSignal() !== null);
  /** Counts as a selection in the panel header only while it really narrows results (origin set). */
  protected readonly distanceActive = computed(() => this.activeRadiusKm() != null && this.hasOrigin());

  /** Display name in the current UI language (reactive: reads the language signal). */
  protected categoryLabel(category: ListingCategoryOption): string {
    return categoryDisplayName(category, this.languageService.current().code);
  }

  protected readonly activeQuery = computed(() => this.filtersSignal().query ?? '');

  /**
   * What the sort control shows. AI results in AI order are "Relevance" (never sent, ADR-054). A
   * `sort=nearest` URL with no origin yet (cold load before the home point arrives) shows and
   * requests Newest until an origin exists.
   */
  protected readonly sortBy = computed<SortValue>(() => {
    if (this.aiResultsActive()) return 'relevance';
    const sort = this.filtersSignal().sort;
    return sort === 'nearest' && !this.hasOrigin() ? 'newest' : sort;
  });

  protected readonly sortOptions = computed<readonly SortOption[]>(() => {
    const options: SortOption[] = SORT_OPTION_DEFS.map((o) => ({
      ...o,
      disabled: o.value === 'nearest' && !this.hasOrigin(),
    }));
    return this.aiHasSearched()
      ? [{ value: 'relevance', labelKey: AI_SORT_LABEL_KEY, disabled: false }, ...options]
      : options;
  });

  protected readonly activeSortOption = computed(
    () => this.sortOptions().find((o) => o.value === this.sortBy()) ?? this.sortOptions()[0],
  );

  private readonly localeTag = computed(() => localeTagForLanguage(this.languageService.current().code));

  protected readonly activeFilterChips = computed(() => {
    const f = this.filtersSignal();
    const lang = this.languageService.current().code;
    const chips: ActiveFilterChip[] = [];
    // Design order: categories, ages, price, districts, conditions (then the Distance extra).
    for (const id of f.categoryIds) {
      const cat = this.categoriesSignal().find((c) => c.id === id);
      chips.push({ key: 'categoryId', value: id, label: cat ? categoryDisplayName(cat, lang) : id });
    }
    for (const token of f.ageGroups) {
      const ag = AGE_GROUPS.find((a) => a.value === token);
      chips.push({ key: 'ageGroup', value: token, label: ag ? this.translate.instant(ag.labelKey) : token });
    }
    if (f.minPrice != null && f.maxPrice != null) {
      chips.push({
        key: 'price',
        label: `${formatNumber(f.minPrice, 'en-US', '1.0-0')}–${formatNumber(f.maxPrice, 'en-US', '1.0-0')}${NBSP}${DRAM_SYMBOL}`,
      });
    } else if (f.maxPrice != null) {
      chips.push({
        key: 'maxPrice',
        label: this.translate.instant('listings.filters.chips.maxPricePerDay', {
          amount: new DramCurrencyPipe().transform(f.maxPrice),
        }),
      });
    } else if (f.minPrice != null) {
      chips.push({
        key: 'minPrice',
        label: this.translate.instant('listings.filters.chips.minPricePerDay', {
          amount: new DramCurrencyPipe().transform(f.minPrice),
        }),
      });
    }
    for (const districtId of f.districtIds) {
      const district = this.districtOptions().find((d) => d.id === districtId);
      chips.push({ key: 'districtId', value: districtId, label: district?.label ?? districtId });
    }
    for (const condition of f.conditions) {
      chips.push({
        key: 'condition',
        value: condition,
        label: this.translate.instant(CONDITION_CHIP_LABEL_KEYS[condition]),
      });
    }
    // Gated on `originCoordsSignal()`, not just `f.radiusKm` — see that
    // field's own doc comment. Showing this chip with no origin in memory
    // (e.g. right after a page reload) would claim a filter is narrowing
    // results when the API request actually omitted it entirely
    // (`ListingsApiService.buildSharedFilterParams` only sends `radiusKm`/
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
    return chips;
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
  /** "Or browse other categories": every category except the ones already applied. */
  protected readonly otherCategories = computed(() => {
    const applied = this.filtersSignal().categoryIds;
    return this.categoriesSignal().filter((c) => !applied.includes(c.id));
  });

  protected readonly vm = this.store.selectSignal(selectListingsPageViewModel);

  constructor() {
    if (typeof matchMedia === 'function') {
      const mql = matchMedia('(min-width: 961px)');
      const onChange = (e: MediaQueryListEvent) => this.isDesktop.set(e.matches);
      mql.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', onChange));
    }
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const filters = parseListingsFilterFromParams(params);
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

    // On results, focus moves to the results region (the field keeps focus while loading).
    effect(() => {
      const busy = this.aiBusy();
      const finishedSearch = this.prevAiBusy === 'searching' && busy === 'idle';
      this.prevAiBusy = busy;
      if (!finishedSearch) return;
      untracked(() => {
        if (this.aiRateLimited() || this.aiDailyLimited() || this.aiOtherError()) return;
        afterNextRender(() => this.resultsRef()?.nativeElement.focus({ preventScroll: true }), {
          injector: this.injector,
        });
      });
    });

    // Desktop plain-text search (the header search is hidden on this page).
    this.desktopQuery$
      // A debounced update that lands after AI was switched on is dropped: the text became the
      // description (and the restore snapshot holds it as `q`), it must not reach the URL.
      .pipe(
        debounceTime(300),
        filter(() => !this.aiMode()),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: q.trim() || null },
          queryParamsHandling: 'merge',
        });
      });

    // `sort=nearest` needs a radius origin. If the origin disappears while it is selected, fall back
    // to Newest (ADR-066); if it arrives later (cold load: the home point lands after the list
    // did) the list is re-fetched so the Nearest order applies.
    let hadOrigin = this.hasOrigin();
    effect(() => {
      const hasOrigin = this.hasOrigin();
      const sort = this.filtersSignal().sort;
      untracked(() => {
        if (sort === 'nearest') {
          if (hadOrigin && !hasOrigin) {
            // A clear that already carries `sort: null` owns this reset: a second merge-navigation
            // in the same tick would supersede it and bring the cleared filters back.
            if (!this.nearestResetInFlight) this.setSort('newest');
          } else if (!hadOrigin && hasOrigin && !this.aiResultsActive()) {
            this.store.dispatch(ListingsActions.loadListings());
          }
        }
        hadOrigin = hasOrigin;
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

  /** The URL keys of every narrowing filter (not `q`, `sort`, `view`, `ai`), cleared with `null` under `merge` (M-021). */
  private static readonly FILTER_PARAM_KEYS = [
    'categoryIds',
    'categoryId',
    'ageGroups',
    'ageGroup',
    'conditions',
    'minPrice',
    'maxPrice',
    'districtIds',
    'radiusKm',
    'city',
  ] as const;

  /** True while a clear-navigation that also drops `sort=nearest` is pending (see the Nearest effect). */
  private nearestResetInFlight = false;

  /**
   * One merge-navigation for a clear that removes the origin. If the order is Nearest it goes out
   * in the same URL change (`sort: null`): Nearest has no meaning without an origin, and a
   * second navigation from the Nearest effect would supersede this one.
   */
  private navigateClearingOrigin(queryParams: Record<string, null>): void {
    const dropNearest = this.filtersSignal().sort === 'nearest';
    if (dropNearest) {
      queryParams['sort'] = null;
      this.nearestResetInFlight = true;
    }
    void this.router
      .navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' })
      .finally(() => {
        if (dropNearest) this.nearestResetInFlight = false;
      });
  }

  private clearFilterParams(includeQuery: boolean): void {
    // Also clears the session-only origin point (Trello #80, M-039): previously nothing ever unset
    // it, so the radius widget kept looking "active" after every other filter was gone.
    this.store.dispatch(ListingsActions.clearOrigin());
    const queryParams: Record<string, null> = {};
    for (const key of ListingsPageComponent.FILTER_PARAM_KEYS) queryParams[key] = null;
    if (includeQuery) queryParams['q'] = null;
    // `merge` + explicit nulls: `view`, `ai` and `sort` survive ("Clear all" in map view must not
    // bounce back to list view; clearing filters is not leaving AI mode or changing the order) -
    // except Nearest, which cannot outlive the origin it was measured from.
    this.navigateClearingOrigin(queryParams);
  }

  /** The panel's / chip row's "Clear all": every filter, but the text in the search bar stays. */
  protected clearAllFilters(): void {
    this.clearFilterParams(false);
  }

  /** The empty state's "Clear filters": everything that narrowed the list, search text included. */
  protected clearFilters(): void {
    this.clearFilterParams(true);
  }

  /** `RadiusOriginFilterComponent`'s `(originCleared)` — the widget already
   *  dispatched `ListingsActions.clearOrigin()` itself; this only owns the
   *  radius half of the filter (merge-navigate, same commit pattern as
   *  `onRadiusMetersChange`). */
  protected onOriginCleared(): void {
    this.navigateClearingOrigin({ radiusKm: null });
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
    return this.panelRef()?.isVisible() ?? false;
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
      this.panelRef()?.focusMaxPrice();
    } else {
      this.filtersCmp()?.openSheetAt('price');
    }
  }

  /** The location Note's "Choose a district" link. */
  protected chooseDistrict(): void {
    if (this.isSidebarVisible()) {
      this.panelRef()?.focusDistrictSearch();
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

  /** Writes `sort` to the URL (merge): `newest` is the default and is never written. */
  private setSort(sort: ListingsSort): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: serializeSortParam(sort) },
      queryParamsHandling: 'merge',
    });
  }

  protected selectSort(value: SortValue): void {
    const option = this.sortOptions().find((o) => o.value === value);
    if (!option || option.disabled) return;
    this.sortMenuOpen.set(false);
    if (value === this.sortBy()) return;
    if (value === 'relevance') {
      // Back to the AI order: re-rank with the current filters (the URL sort stays inert).
      this.store.dispatch(ListingsActions.aiRerank());
      return;
    }
    // Choosing any other sort drops the AI order (ordinary catalogue, ADR-054) before the URL
    // change, so the URL handler sees AI results as no longer active and reloads the catalogue.
    if (this.aiResultsActive()) {
      this.store.dispatch(ListingsActions.dropAiOrder());
    }
    this.setSort(value);
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

  /** Replaces the category selection with one category (empty-state / no-results shortcuts). */
  protected selectCategory(id: string | null): void {
    this.patchFilters({ categoryIds: id ? [id] : [] });
  }

  /**
   * One merge-navigation for a panel edit (M-021). The legacy single-value keys are always cleared
   * next to the list that replaces them, so an old `?categoryId=` link cannot contradict it.
   */
  protected patchFilters(patch: BrowseFilterPatch): void {
    const queryParams: Record<string, string | null> = {};
    if (patch.categoryIds) {
      queryParams['categoryIds'] = serializeListParam(patch.categoryIds);
      queryParams['categoryId'] = null;
    }
    if (patch.ageGroups) {
      queryParams['ageGroups'] = serializeListParam(patch.ageGroups);
      queryParams['ageGroup'] = null;
    }
    if (patch.conditions) queryParams['conditions'] = serializeListParam(patch.conditions);
    if (patch.districtIds) queryParams['districtIds'] = serializeDistrictIdsParam(patch.districtIds);
    if ('minPrice' in patch) queryParams['minPrice'] = patch.minPrice != null ? String(patch.minPrice) : null;
    if ('maxPrice' in patch) queryParams['maxPrice'] = patch.maxPrice != null ? String(patch.maxPrice) : null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
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

  protected removeFilterChip(chip: ActiveFilterChip): void {
    const f = this.filtersSignal();
    switch (chip.key) {
      case 'categoryId':
        this.patchFilters({ categoryIds: f.categoryIds.filter((id) => id !== chip.value) });
        return;
      case 'ageGroup':
        this.patchFilters({ ageGroups: f.ageGroups.filter((t) => t !== chip.value) });
        return;
      case 'condition':
        this.patchFilters({ conditions: f.conditions.filter((c) => c !== chip.value) });
        return;
      case 'districtId':
        this.patchFilters({ districtIds: f.districtIds.filter((id) => id !== chip.value) });
        return;
      case 'price':
        this.patchFilters({ minPrice: null, maxPrice: null });
        return;
      case 'minPrice':
        this.patchFilters({ minPrice: null });
        return;
      case 'maxPrice':
        this.patchFilters({ maxPrice: null });
        return;
      case 'radiusKm':
        // The chip reads "1 km · from you" — its × removes the whole location
        // filter, not just the radius number (Trello #80).
        this.store.dispatch(ListingsActions.clearOrigin());
        this.navigateClearingOrigin({ radiusKm: null });
        return;
    }
  }
}
