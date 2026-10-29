import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { makeListingPreview } from '../../../../../testing/fixtures';
import { GeolocationService } from '../../../../shared/services/geolocation.service';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { MyListingsApiService } from '../../../my-listings/services/my-listings-api.service';
import { selectMyBookings } from '../../../bookings/store/bookings.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingCategories,
  selectListingsAi,
  selectListingItems,
  selectListingsError,
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsLoading,
  selectListingsOriginCoords,
  selectListingsOriginDenied,
  selectListingsOriginSource,
  selectListingsPageSize,
  selectMapPins,
  selectMapPinsError,
  selectMapPinsLoading,
  selectMapPinsTruncated,
} from '../../store/listings.selectors';
import type { ListingPreview } from '../../models/listing.model';
import type { ListingsFilter } from '../../models/listings-filter.model';
import { ListingsApiService } from '../../services/listings-api.service';
import { initialListingsAiState, type ListingsAiState } from '../../store/listings.state';
import { ListingsPageComponent } from './listings-page.component';

/**
 * This page has no OTHER spec today (a known, pre-existing gap — see the
 * Maps P2-2 plan). This file is deliberately narrow: it covers ONLY the new
 * `?view=map` behaviour (map renders + grid hides, the toggle merge-navigates,
 * and `view` never leaks into the API filter payload) — not a retrofit of
 * coverage for the rest of the page.
 *
 * The page's full template tree is mounted for real (not stubbed) — its
 * sidebar `app-radius-origin-filter` and the new `app-listings-map` both
 * eventually mount the real `app-map`, which dynamic-imports `leaflet` (the
 * only file allowed to import it) — mocked here the same way every other
 * spec touching `app-map` does. `ListingsApiService`/`MyListingsApiService`
 * are replaced with trivial fakes (no `HttpClient` needed) purely so the
 * page's own direct injections resolve; `provideMockStore` means dispatched
 * actions never reach real reducers/effects, so no HTTP call is ever
 * actually attempted regardless.
 */
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn(),
      on: vi.fn(),
      getCenter: vi.fn(() => ({ lat: 40.1776, lng: 44.5126 })),
      getZoom: vi.fn(() => 13),
      latLngToContainerPoint: vi.fn(() => ({ x: 0, y: 0 })),
      getBounds: vi.fn(() => ({
        getNorth: () => 40.2,
        getSouth: () => 40.1,
        getEast: () => 44.6,
        getWest: () => 44.5,
      })),
      invalidateSize: vi.fn(),
      removeLayer: vi.fn(),
      remove: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      fitBounds: vi.fn(),
      dragging: { enable: vi.fn(), disable: vi.fn(), enabled: vi.fn(() => false) },
      touchZoom: { enable: vi.fn(), disable: vi.fn(), enabled: vi.fn(() => false) },
    })),
    tileLayer: vi.fn(() => {
      const layer = { addTo: vi.fn(() => layer), on: vi.fn(() => layer) };
      return layer;
    }),
    marker: vi.fn(() => ({ addTo: vi.fn(function (this: unknown) { return this; }), getElement: vi.fn(() => null), setLatLng: vi.fn() })),
    circle: vi.fn(() => {
      const c = { addTo: vi.fn(() => c) };
      return c;
    }),
    divIcon: vi.fn((options: Record<string, unknown>) => ({ ...options })),
    latLngBounds: vi.fn((points: unknown) => ({ __bounds: true, points })),
  },
}));

vi.stubGlobal(
  'matchMedia',
  vi.fn(() => ({
    matches: false,
    media: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onchange: null,
  })),
);

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver);

/**
 * Captures the callback the component registers so a test can fire a
 * synthetic intersection event, and records every instance created so a test
 * can grab the observer attached to the infinite-scroll sentinel. Installed
 * on `globalThis` at module load — i.e. before any `TestBed.createComponent`
 * — because `ListingsPageComponent.intersectionObserverSupported` reads
 * `typeof IntersectionObserver !== 'undefined'` at field-initialiser time.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  constructor(private readonly callback: (entries: [{ isIntersecting: boolean }]) => void) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}

  trigger(isIntersecting: boolean): void {
    this.callback([{ isIntersecting }]);
  }
}
vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

const BASE_FILTERS: ListingsFilter = {
  query: null,
  city: null,
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  ageGroup: null,
  radiusKm: null,
  districtIds: [],
};

interface ListingsPageSelectorOverrides {
  readonly hasMore?: boolean;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly filters?: ListingsFilter;
  readonly originCoords?: { lat: number; lng: number } | null;
  readonly originSource?: 'geo' | 'manual' | 'home' | null;
  readonly categories?: { id: string; name: string }[];
  readonly ai?: Partial<ListingsAiState>;
  readonly items?: ListingPreview[];
  /** English strings loaded before the first render (default: keys render raw). */
  readonly translations?: Record<string, string>;
}

async function navigateToListings(url: string, overrides: ListingsPageSelectorOverrides = {}) {
  FakeIntersectionObserver.instances = [];

  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideRouter([{ path: 'listings', component: ListingsPageComponent }]),
      provideMockStore({
        selectors: [
          { selector: selectIsAuthenticated, value: false },
          { selector: selectFavoriteIds, value: new Set<string>() },
          { selector: selectListingCategories, value: overrides.categories ?? [] },
          { selector: selectListingsAi, value: { ...initialListingsAiState, ...overrides.ai } },
          { selector: selectListingItems, value: overrides.items ?? [makeListingPreview()] },
          { selector: selectListingsError, value: overrides.error ?? null },
          { selector: selectListingsFilters, value: overrides.filters ?? BASE_FILTERS },
          { selector: selectListingsHasMore, value: overrides.hasMore ?? false },
          { selector: selectListingsLoading, value: overrides.loading ?? false },
          { selector: selectListingsOriginCoords, value: overrides.originCoords ?? null },
          { selector: selectListingsOriginSource, value: overrides.originSource ?? null },
          { selector: selectListingsOriginDenied, value: false },
          { selector: selectListingsPageSize, value: 20 },
          { selector: selectMyBookings, value: [] },
          { selector: selectMapPins, value: [] },
          { selector: selectMapPinsLoading, value: false },
          { selector: selectMapPinsError, value: null },
          { selector: selectMapPinsTruncated, value: false },
        ],
      }),
      { provide: ListingsApiService, useValue: { getDistricts: () => of([]) } },
      { provide: MyListingsApiService, useValue: { getMyListings: () => of([]) } },
      { provide: GeolocationService, useValue: { getCurrentPosition: () => Promise.reject(new Error('denied')) } },
    ],
    teardown: { destroyAfterEach: true },
  });

  // Spy BEFORE navigating — the constructor's `queryParamMap` subscription
  // dispatches `updateFilters`/`loadListings` synchronously on the FIRST
  // navigation, so a spy set up afterward would miss it entirely.
  const store = TestBed.inject(MockStore);
  vi.spyOn(store, 'dispatch');

  if (overrides.translations) {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', overrides.translations);
    translate.use('en');
  }

  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, ListingsPageComponent);
  harness.detectChanges();

  return {
    harness,
    component,
    el: harness.routeNativeElement as HTMLElement,
    router: TestBed.inject(Router),
    store,
  };
}

describe('ListingsPageComponent — Maps P2-2 view toggle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the map and hides the results grid when `?view=map` is in the URL', async () => {
    const { el } = await navigateToListings('/listings?view=map');

    expect(el.querySelector('app-listings-map')).not.toBeNull();
    expect(el.querySelector('.listings-page__grid')).toBeNull();
  });

  it('renders the grid (not the map) with no `view` param, even though the toggle is present', async () => {
    const { el } = await navigateToListings('/listings');

    expect(el.querySelector('.listings-page__grid')).not.toBeNull();
    expect(el.querySelector('app-listings-map')).toBeNull();
    expect(el.querySelector('.lp-view-toggle')).not.toBeNull();
  });

  it('the Map/List toggle navigates with query params MERGED, not replaced', async () => {
    const { el, router } = await navigateToListings('/listings?categoryId=abc-123');

    const buttons = el.querySelectorAll<HTMLButtonElement>('.lp-view-toggle__btn');
    expect(buttons).toHaveLength(2);
    const [listBtn, mapBtn] = Array.from(buttons);

    mapBtn.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).toContain('view=map');
    expect(router.url).toContain('categoryId=abc-123');

    listBtn.click();
    await vi.advanceTimersByTimeAsync(50);

    // Switching back to 'list' clears the param entirely rather than
    // writing `view=list` — keeps the URL clean for the default mode.
    expect(router.url).not.toContain('view=');
    expect(router.url).toContain('categoryId=abc-123');
  });

  it('never sends `view` to the API filter payload — `updateFilters` is dispatched with the SAME shape whether or not `view` is in the URL', async () => {
    const { store } = await navigateToListings('/listings?view=map&categoryId=abc-123');

    const updateFiltersCalls = (store.dispatch as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => call[0])
      .filter((action) => action.type === ListingsActions.updateFilters.type);

    expect(updateFiltersCalls.length).toBeGreaterThan(0);
    const lastCall = updateFiltersCalls.at(-1);
    expect(lastCall.filters).toEqual({ ...BASE_FILTERS, categoryId: 'abc-123' });
    expect(Object.prototype.hasOwnProperty.call(lastCall.filters, 'view')).toBe(false);
  });
});

/**
 * Infinite scroll: replaces the manual "Load more" button with an
 * `IntersectionObserver` on a sentinel rendered after the grid (only in
 * list view, only while `hasMore && !hasError` — see the template). The
 * component's dispatch guard lives in a `Signal` effect that re-evaluates
 * on every `vm()`/`viewMode()` change, not just on intersection-boundary
 * crossings — see `listings-page.component.ts` for why. `FakeIntersectionObserver`
 * (module scope, above) records the callback the component registers so
 * these tests can fire a synthetic intersection event by hand.
 */
describe('ListingsPageComponent — infinite scroll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function flush(harness: RouterTestingHarness) {
    harness.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    harness.detectChanges();
  }

  function loadNextPageDispatches(store: MockStore) {
    return (store.dispatch as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => call[0])
      .filter((action) => action.type === ListingsActions.loadNextPage.type);
  }

  it('dispatches loadNextPage when the sentinel intersects', async () => {
    const { harness, el, store } = await navigateToListings('/listings', {
      hasMore: true,
      loading: false,
      error: null,
    });

    const sentinel = el.querySelector('.listings-page__scroll-sentinel');
    expect(sentinel).not.toBeNull();
    expect(sentinel!.getAttribute('aria-hidden')).toBe('true');

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    FakeIntersectionObserver.instances[0].trigger(true);
    await flush(harness);

    expect(loadNextPageDispatches(store)).toHaveLength(1);
  });

  it('does not dispatch while a page is already loading', async () => {
    const { harness, el, store } = await navigateToListings('/listings', {
      hasMore: true,
      loading: true,
      error: null,
    });

    // The sentinel stays mounted while loading (it only depends on
    // hasMore/hasError) — the append skeleton is the visible "loading"
    // indicator; the guard against a duplicate/in-flight dispatch lives in
    // the effect, not in whether the sentinel exists.
    expect(el.querySelector('.listings-page__scroll-sentinel')).not.toBeNull();

    FakeIntersectionObserver.instances[0].trigger(true);
    await flush(harness);

    expect(loadNextPageDispatches(store)).toHaveLength(0);
  });

  it('does not dispatch when hasMore is false', async () => {
    const { el, store } = await navigateToListings('/listings', {
      hasMore: false,
      loading: false,
      error: null,
    });

    // Nothing left to load ⇒ the template never renders the sentinel, so
    // there is nothing for an IntersectionObserver to fire on.
    expect(el.querySelector('.listings-page__scroll-sentinel')).toBeNull();
    expect(loadNextPageDispatches(store)).toHaveLength(0);
  });

  it('does not dispatch in map view', async () => {
    const { harness, el, store } = await navigateToListings('/listings', {
      hasMore: true,
      loading: false,
      error: null,
    });

    expect(el.querySelector('.listings-page__scroll-sentinel')).not.toBeNull();
    const observer = FakeIntersectionObserver.instances[0];

    // Switch to map view — the sentinel's `@if` (list view only) removes it
    // from the DOM and the attach effect disconnects the real observer, but
    // `observer` here still holds the callback closure, letting the test
    // simulate a stale/late browser callback racing the view switch.
    await harness.navigateByUrl('/listings?view=map', ListingsPageComponent);
    await flush(harness);

    expect(el.querySelector('.listings-page__scroll-sentinel')).toBeNull();
    expect(el.querySelector('app-listings-map')).not.toBeNull();

    observer.trigger(true);
    await flush(harness);

    expect(loadNextPageDispatches(store)).toHaveLength(0);
  });
});

/**
 * Trello #80: "Clear all", the radius chip's ×, and the widget's own
 * "Remove" button must all unset the session-only origin, not just
 * `radiusKm` — otherwise the widget keeps looking active after every other
 * filter is gone. Reuses `navigateToListings` (now accepting `filters`/
 * `originCoords`/`originSource` overrides) rather than a new harness.
 */
describe('ListingsPageComponent — clearing the origin (Trello #80)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function clearOriginDispatches(store: MockStore) {
    return (store.dispatch as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => call[0])
      .filter((action) => action.type === ListingsActions.clearOrigin.type);
  }

  it('clearFilters() dispatches clearOrigin and preserves `view=map` while dropping other filters', async () => {
    const { el, router, store } = await navigateToListings('/listings?view=map&categoryId=abc-123', {
      filters: { ...BASE_FILTERS, categoryId: 'abc-123' },
    });

    const clearBtn = el.querySelector<HTMLButtonElement>('.lp-sidebar__clear');
    expect(clearBtn).not.toBeNull();
    clearBtn!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(clearOriginDispatches(store)).toHaveLength(1);
    expect(router.url).toContain('view=map');
    expect(router.url).not.toContain('categoryId');
  });

  it('removing the radius chip dispatches clearOrigin and navigates radiusKm: null with merge', async () => {
    const { el, router, store } = await navigateToListings('/listings?radiusKm=1&categoryId=abc-123', {
      filters: { ...BASE_FILTERS, radiusKm: 1, categoryId: 'abc-123' },
      originCoords: { lat: 40.18, lng: 44.51 },
      originSource: 'manual',
    });

    // Two chips render here (categoryId, radiusKm — in that order, per
    // `activeFilterChips()`); the radius chip is the second one.
    const chips = el.querySelectorAll<HTMLButtonElement>('.lp-active-chip');
    expect(chips).toHaveLength(2);
    const radiusChip = chips[1];
    radiusChip.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(clearOriginDispatches(store)).toHaveLength(1);
    expect(router.url).not.toContain('radiusKm');
    // 'merge' — the sibling filter this control has no concept of survives.
    expect(router.url).toContain('categoryId=abc-123');
  });

  it('onOriginCleared() (via the widget\'s own Remove button) navigates radiusKm: null with merge', async () => {
    const { el, router } = await navigateToListings('/listings?radiusKm=1&categoryId=abc-123', {
      filters: { ...BASE_FILTERS, radiusKm: 1, categoryId: 'abc-123' },
      originCoords: { lat: 40.18, lng: 44.51 },
      originSource: 'manual',
    });

    const removeBtn = el.querySelector<HTMLButtonElement>('.rof__edit--remove');
    expect(removeBtn).not.toBeNull();
    removeBtn!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).not.toContain('radiusKm');
    expect(router.url).toContain('categoryId=abc-123');
  });
});

describe('ListingsPageComponent — sort menu', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes the open sort menu when the window scrolls', async () => {
    const { harness, el } = await navigateToListings('/listings');

    el.querySelector<HTMLButtonElement>('.lp-toolbar__sort')!.click();
    harness.detectChanges();
    expect(el.querySelector('.lp-sort-menu')).not.toBeNull();

    window.dispatchEvent(new Event('scroll'));
    harness.detectChanges();
    expect(el.querySelector('.lp-sort-menu')).toBeNull();
  });
});

// ── AI search (ADR-054) ──────────────────────────────────────────────────

const AI_RESULTS = {
  mode: true,
  hasSearched: true,
  orderActive: true,
  ranked: true,
  intent: 'Picked for outdoor play: balance bikes first.',
  description: 'a balance bike',
};

function dispatchedTypes(store: MockStore): string[] {
  return (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].type);
}

describe('ListingsPageComponent — AI search', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mirrors ?ai=1 into the store and loads the catalogue until a search has run', async () => {
    const { store } = await navigateToListings('/listings?ai=1');

    const calls = (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual(ListingsActions.setAiMode({ on: true }));
    expect(dispatchedTypes(store)).toContain(ListingsActions.loadListings.type);
  });

  it('loads the budget status on init', async () => {
    const { store } = await navigateToListings('/listings');
    expect(dispatchedTypes(store)).toContain(ListingsActions.loadAiStatus.type);
  });

  it('with AI results showing, a URL filter edit re-ranks instead of reloading the catalogue', async () => {
    const { store } = await navigateToListings('/listings?ai=1&categoryId=abc-123', { ai: AI_RESULTS });

    const types = dispatchedTypes(store);
    expect(types).toContain(ListingsActions.aiFiltersChanged.type);
    expect(types).not.toContain(ListingsActions.updateFilters.type);
    expect(types).not.toContain(ListingsActions.loadListings.type);
  });

  it('the echo of the filters the AI itself applied (URL equals the store filters) does nothing', async () => {
    const { store } = await navigateToListings('/listings?ai=1&categoryId=abc-123', {
      ai: AI_RESULTS,
      filters: { ...BASE_FILTERS, categoryId: 'abc-123' },
    });

    const types = dispatchedTypes(store);
    expect(types).not.toContain(ListingsActions.aiFiltersChanged.type);
    expect(types).not.toContain(ListingsActions.loadListings.type);
  });

  it('shows no explanation line and no count line while the order is ranked', async () => {
    const { el } = await navigateToListings('/listings?ai=1', { ai: AI_RESULTS });
    expect(el.querySelector('.lp-ai-explain')).toBeNull();
    expect(el.textContent).not.toContain('Picked for outdoor play');
    expect(el.querySelector('.lp-toolbar__count')).toBeNull();
    expect(el.querySelector('.lp-toolbar__sort')).not.toBeNull();
  });

  it('shows no explanation and no count line when ranking failed', async () => {
    const { el } = await navigateToListings('/listings?ai=1', { ai: { ...AI_RESULTS, ranked: false } });
    expect(el.querySelector('.lp-ai-explain')).toBeNull();
    expect(el.querySelector('.lp-toolbar__count')).toBeNull();
  });

  it('keeps the catalogue count line outside AI results', async () => {
    const { el } = await navigateToListings('/listings');
    expect(el.querySelector('.lp-toolbar__count')).not.toBeNull();
  });

  async function settle(harness: RouterTestingHarness) {
    harness.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    harness.detectChanges();
  }

  it('"Most relevant first" is the default sort and is offered only with AI results', async () => {
    const { harness, el } = await navigateToListings('/listings?ai=1', { ai: AI_RESULTS });
    await settle(harness);

    expect(el.querySelector('.lp-toolbar__sort')?.textContent).toContain('listings.ai.sortRelevant');
    el.querySelector<HTMLButtonElement>('.lp-toolbar__sort')!.click();
    harness.detectChanges();
    const labels = Array.from(el.querySelectorAll('.lp-sort-menu__item')).map((b) => b.textContent);
    expect(labels[0]).toContain('listings.ai.sortRelevant');
  });

  it('the sort menu has no relevance option in the ordinary catalogue', async () => {
    const { harness, el } = await navigateToListings('/listings');
    el.querySelector<HTMLButtonElement>('.lp-toolbar__sort')!.click();
    harness.detectChanges();
    expect(el.querySelector('.lp-sort-menu')?.textContent).not.toContain('listings.ai.sortRelevant');
  });

  it('choosing another sort drops the AI order; choosing "Most relevant first" again re-ranks', async () => {
    const { harness, el, store } = await navigateToListings('/listings?ai=1', { ai: AI_RESULTS });
    await settle(harness);

    el.querySelector<HTMLButtonElement>('.lp-toolbar__sort')!.click();
    harness.detectChanges();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.lp-sort-menu__item'))
      .find((b) => b.textContent?.includes('listings.page.sortLowestPrice'))!
      .click();
    expect(dispatchedTypes(store)).toContain(ListingsActions.dropAiOrder.type);

    harness.detectChanges();
    el.querySelector<HTMLButtonElement>('.lp-toolbar__sort')!.click();
    harness.detectChanges();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.lp-sort-menu__item'))
      .find((b) => b.textContent?.includes('listings.ai.sortRelevant'))!
      .click();
    expect(dispatchedTypes(store)).toContain(ListingsActions.aiRerank.type);
  });

  it('puts the divider before card 21 when page 1 was ranked', async () => {
    const items = Array.from({ length: 22 }, (_, i) => makeListingPreview({ id: 'l' + i }));
    const { el } = await navigateToListings('/listings?ai=1', {
      items,
      ai: { ...AI_RESULTS, rankedIds: items.slice(0, 20).map((i) => i.id) },
    });

    const children = Array.from(el.querySelector('.listings-page__grid')!.children);
    const dividerIndex = children.findIndex((c) => c.classList.contains('lp-ai-divider'));
    expect(dividerIndex).toBe(20);
    expect(children[dividerIndex].getAttribute('role')).toBe('separator');
  });

  it('no divider when ranking failed', async () => {
    const items = Array.from({ length: 22 }, (_, i) => makeListingPreview({ id: 'l' + i }));
    const { el } = await navigateToListings('/listings?ai=1', {
      items,
      ai: { ...AI_RESULTS, ranked: false, rankedIds: [] },
    });
    expect(el.querySelector('.lp-ai-divider')).toBeNull();
  });

  it('a re-rank replaces the count line with "Updating the order" and dims + inerts the cards', async () => {
    const { el } = await navigateToListings('/listings?ai=1', { ai: { ...AI_RESULTS, busy: 'reranking' } });

    const status = el.querySelector('.lp-toolbar__updating')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('listings.ai.updating');
    expect(el.querySelector('.lp-toolbar__count')).toBeNull();

    const grid = el.querySelector('.listings-page__grid')!;
    expect(grid.classList.contains('listings-page__grid--busy')).toBe(true);
    expect(grid.hasAttribute('inert')).toBe(true);
  });

  it('the desktop AI field sits above the results', async () => {
    const { el } = await navigateToListings('/listings');
    expect(el.querySelector('.lp-main .lp-ai-top app-ai-search-field')).not.toBeNull();
  });
});

// ── AI search: the non-happy-path states (stage 2 + 3) ───────────────────

describe('ListingsPageComponent — AI search states', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no layout: scrollIntoView does not exist.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => vi.useRealTimers());

  async function flush(harness: RouterTestingHarness) {
    harness.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    harness.detectChanges();
  }

  const NO_RESULTS_AI = { ...AI_RESULTS, ranked: false, intent: null, rankedIds: [] };

  describe('loading', () => {
    it('keeps the previous cards dimmed, inert and aria-hidden under a status line + bar', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: { ...AI_RESULTS, busy: 'searching' } });

      const status = el.querySelector('.lp-ai-status')!;
      expect(status.getAttribute('role')).toBe('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toContain('listings.ai.status');
      expect(status.querySelector('.lp-ai-bar')).not.toBeNull();

      const grid = el.querySelector('.listings-page__grid')!;
      expect(grid.classList.contains('listings-page__grid--busy')).toBe(true);
      expect(grid.classList.contains('listings-page__grid--searching')).toBe(true);
      expect(grid.hasAttribute('inert')).toBe(true);
      expect(grid.getAttribute('aria-hidden')).toBe('true');
      expect(el.querySelector('app-ui-loading-skeleton')).toBeNull();
      expect(el.querySelector('.lp-results')!.getAttribute('aria-busy')).toBe('true');
    });

    it('a first search puts the status line above the existing skeleton (no old cards)', async () => {
      const { el } = await navigateToListings('/listings?ai=1', {
        ai: { ...initialListingsAiState, mode: true, description: 'bike', busy: 'searching' },
      });

      expect(el.querySelector('.lp-ai-status')).not.toBeNull();
      expect(el.querySelector('app-ui-loading-skeleton')).not.toBeNull();
      expect(el.querySelector('.listings-page__grid')).toBeNull();
      expect(el.querySelector('app-ai-no-results')).toBeNull();
    });

    it('a re-rank dims the cards at the re-rank level and shows no status line', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: { ...AI_RESULTS, busy: 'reranking' } });

      const grid = el.querySelector('.listings-page__grid')!;
      expect(grid.classList.contains('listings-page__grid--busy')).toBe(true);
      expect(grid.classList.contains('listings-page__grid--searching')).toBe(false);
      expect(el.querySelector('.lp-ai-status')).toBeNull();
    });

    it('idle: cards are live (not dimmed, no inert, no aria-hidden)', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: AI_RESULTS });

      const grid = el.querySelector('.listings-page__grid')!;
      expect(grid.hasAttribute('inert')).toBe(false);
      expect(grid.hasAttribute('aria-hidden')).toBe(false);
      expect(el.querySelector('.lp-ai-status')).toBeNull();
      expect(el.querySelector('.lp-results')!.getAttribute('aria-busy')).toBe('false');
    });

    it('moves focus to the results region when the results arrive', async () => {
      const { harness, store } = await navigateToListings('/listings?ai=1', {
        ai: { ...AI_RESULTS, busy: 'searching' },
      });

      store.overrideSelector(selectListingsAi, { ...initialListingsAiState, ...AI_RESULTS, busy: 'idle' });
      store.refreshState();
      await flush(harness);
      await flush(harness);

      expect(document.activeElement?.classList.contains('lp-results')).toBe(true);
    });
  });

  describe('no results (option A)', () => {
    const NO_RESULTS_OPTS = { items: [] as ListingPreview[], ai: NO_RESULTS_AI };

    it('with a district filter: "Widen the area" is primary, then budget + edit; no clear-filters, no bell', async () => {
      const { el } = await navigateToListings('/listings?ai=1&districtIds=d-1', {
        ...NO_RESULTS_OPTS,
        filters: { ...BASE_FILTERS, districtIds: ['d-1'] },
      });

      const empty = el.querySelector('app-ai-no-results')!;
      expect(empty.querySelector('h3')!.textContent).toContain('listings.ai.emptyTitle');
      const primary = empty.querySelector('.ai-empty__primary')!;
      expect(primary.textContent).toContain('listings.ai.widen');
      const outline = Array.from(empty.querySelectorAll('.ai-empty__outline')).map((b) => b.textContent!.trim());
      expect(outline).toEqual(['listings.ai.budget', 'listings.ai.edit']);
      expect(el.querySelector('.lp-empty-search')).toBeNull();
      expect(el.querySelector('.pi-bell')).toBeNull();
      expect(empty.textContent).not.toContain('emptyFilterCta');
    });

    it('without a district filter the primary is "Edit description" and the Edit button is not repeated', async () => {
      const { el } = await navigateToListings('/listings?ai=1', NO_RESULTS_OPTS);

      const empty = el.querySelector('app-ai-no-results')!;
      expect(empty.querySelector('.ai-empty__primary')!.textContent).toContain('listings.ai.edit');
      expect(empty.textContent).not.toContain('listings.ai.widen');
      expect(Array.from(empty.querySelectorAll('.ai-empty__outline')).map((b) => b.textContent!.trim())).toEqual([
        'listings.ai.budget',
      ]);
    });

    it('"Widen the area" drops only the districts (the URL change re-ranks without them)', async () => {
      const { el, router } = await navigateToListings('/listings?ai=1&districtIds=d-1&categoryId=c1', {
        ...NO_RESULTS_OPTS,
        filters: { ...BASE_FILTERS, districtIds: ['d-1'], categoryId: 'c1' },
      });

      el.querySelector<HTMLButtonElement>('.ai-empty__primary')!.click();
      await vi.advanceTimersByTimeAsync(50);

      expect(router.url).not.toContain('districtIds');
      expect(router.url).toContain('categoryId=c1');
      expect(router.url).toContain('ai=1');
    });

    it('category pills list the OTHER categories; a pill replaces only the category', async () => {
      const { el, router } = await navigateToListings('/listings?ai=1&categoryId=c1&maxPrice=2000', {
        ...NO_RESULTS_OPTS,
        categories: [
          { id: 'c1', name: 'Bikes' },
          { id: 'c2', name: 'Puzzles' },
        ],
        filters: { ...BASE_FILTERS, categoryId: 'c1', maxPrice: 2000 },
      });

      const pills = Array.from(el.querySelectorAll<HTMLButtonElement>('.ai-empty__pill'));
      expect(pills.map((p) => p.textContent!.trim())).toEqual(['Puzzles']);

      pills[0].click();
      await vi.advanceTimersByTimeAsync(50);

      expect(router.url).toContain('categoryId=c2');
      expect(router.url).toContain('maxPrice=2000');
    });

    it('"Increase the budget" opens the filter sheet at the price on mobile (sidebar hidden)', async () => {
      const { harness, el } = await navigateToListings('/listings?ai=1', NO_RESULTS_OPTS);

      el.querySelector<HTMLButtonElement>('.ai-empty__outline')!.click();
      await flush(harness);

      expect(el.querySelector('.lf-sheet')).not.toBeNull();
      expect(el.querySelector('#lf-field-price')).not.toBeNull();
    });

    it('"Increase the budget" focuses the sidebar price "To" on desktop', async () => {
      const spy = vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
      try {
        const { el } = await navigateToListings('/listings?ai=1', NO_RESULTS_OPTS);

        el.querySelector<HTMLButtonElement>('.ai-empty__outline')!.click();

        const input = el.querySelectorAll<HTMLInputElement>('.lp-sidebar__price-input')[1];
        expect(document.activeElement).toBe(input);
        expect(el.querySelector('.lf-sheet')).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('no results in ordinary mode keep the generic empty state', async () => {
      const { el } = await navigateToListings('/listings', {
        items: [],
        filters: { ...BASE_FILTERS, categoryId: 'c1' },
      });

      expect(el.querySelector('app-ai-no-results')).toBeNull();
      expect(el.querySelector('.lp-empty-search')).not.toBeNull();
    });
  });

  describe('AI unavailable (fallback)', () => {
    const FALLBACK = {
      ...initialListingsAiState,
      mode: false,
      description: 'bike',
      fallbackNotice: true,
      fallbackResults: true,
    };

    it('shows the info notice (role=status) with ordinary results: no explanation, no "most relevant first"', async () => {
      const { el } = await navigateToListings('/listings', { ai: FALLBACK });

      const notice = el.querySelector('.lp-ai-slot app-ai-notice .msg')!;
      expect(notice.classList.contains('msg--info')).toBe(true);
      expect(notice.getAttribute('role')).toBe('status');
      expect(notice.textContent).toContain('listings.ai.unavailable');
      expect(el.querySelector('.lp-ai-explain')).toBeNull();
      expect(el.querySelector('.lp-ai-divider')).toBeNull();
    });

    it('the URL echo of the fallback does not wipe its results with a catalogue reload', async () => {
      const { store, router } = await navigateToListings('/listings', { ai: FALLBACK });

      expect(dispatchedTypes(store)).not.toContain(ListingsActions.loadListings.type);
      expect(dispatchedTypes(store)).not.toContain(ListingsActions.updateFilters.type);
      expect(router.url).not.toContain('q=');
    });

    it('infinite scroll dispatches nothing while the fallback page is showing', async () => {
      const { harness, store } = await navigateToListings('/listings', { ai: FALLBACK, hasMore: true });

      FakeIntersectionObserver.instances.forEach((o) => o.trigger(true));
      await flush(harness);

      expect(dispatchedTypes(store)).not.toContain(ListingsActions.loadNextPage.type);
    });

    it('is not shown without a fallback', async () => {
      const { el } = await navigateToListings('/listings', { ai: AI_RESULTS });
      expect(el.querySelector('.lp-ai-slot')).toBeNull();
    });

    it('the switch is OFF but still enabled (focusable, not aria-disabled)', async () => {
      const { el } = await navigateToListings('/listings', { ai: FALLBACK });

      const sw = el.querySelector<HTMLButtonElement>('.lp-ai-top .ai-switch')!;
      expect(sw.getAttribute('aria-checked')).toBe('false');
      expect(sw.hasAttribute('aria-disabled')).toBe(false);
      expect(sw.disabled).toBe(false);
    });
  });

  describe('notes', () => {
    const NOTES_AI = {
      ...AI_RESULTS,
      datesMentioned: true,
      locationNotConsidered: true,
      purposeWidened: true,
    };

    it('shows at most two notes, dates first then location; the purpose note drops', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: NOTES_AI });

      const notes = Array.from(el.querySelectorAll('.lp-ai-note'));
      expect(notes).toHaveLength(2);
      expect(notes[0].textContent).toContain('listings.ai.datesNote');
      expect(notes[1].textContent).toContain('listings.ai.locationNote');
      expect(notes[1].querySelector('.lp-ai-note__link')!.textContent).toContain('listings.ai.chooseDistrict');
      expect(el.textContent).not.toContain('listings.ai.purposeNote');
    });

    it('the purpose note shows on its own', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: { ...AI_RESULTS, purposeWidened: true } });

      const note = el.querySelector('.lp-ai-note')!;
      expect(note.textContent).toContain('listings.ai.purposeNote');
    });

    it('no notes without flags', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: AI_RESULTS });
      expect(el.querySelector('.lp-ai-notes')).toBeNull();
    });

    it('"Choose a district" opens the sheet at District on mobile', async () => {
      const { harness, el } = await navigateToListings('/listings?ai=1', { ai: NOTES_AI });

      el.querySelector<HTMLButtonElement>('.lp-ai-note__link')!.click();
      await flush(harness);

      expect(el.querySelector('.lf-sheet')).not.toBeNull();
      expect(el.querySelector('#lf-field-districts')).not.toBeNull();
    });

    it('"Choose a district" focuses the sidebar District section on desktop', async () => {
      const spy = vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
      try {
        const { el } = await navigateToListings('/listings?ai=1', { ai: NOTES_AI });
        // Districts load from the API; give the section a checkbox to receive focus.
        const section = el.querySelectorAll<HTMLElement>('.lp-sidebar__section')[1];
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        section.appendChild(checkbox);

        el.querySelector<HTMLButtonElement>('.lp-ai-note__link')!.click();

        expect(document.activeElement).toBe(checkbox);
        expect(el.querySelector('.lf-sheet')).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('rate limit (429)', () => {
    const LIMITED = {
      ...AI_RESULTS,
      error: 'Raw server prose that must never be rendered',
      errorCode: 'ai_search.rate_limited' as const,
    };

    it('shows a warn notice directly under the search bar; the description and the cards stay', async () => {
      const { el } = await navigateToListings('/listings?ai=1', { ai: LIMITED });

      const notice = el.querySelector('.lp-ai-top app-ai-notice .msg')!;
      expect(notice.classList.contains('msg--warn')).toBe(true);
      expect(notice.textContent).toContain('listings.ai.rateLimited');
      expect(el.textContent).not.toContain('Raw server prose');
      expect((el.querySelector('.lp-ai-top textarea') as HTMLTextAreaElement).value).toBe('a balance bike');

      const grid = el.querySelector('.listings-page__grid')!;
      expect(grid.hasAttribute('inert')).toBe(false);
      expect(grid.classList.contains('listings-page__grid--busy')).toBe(false);
    });

    it('does not move focus to the results region (nothing new arrived)', async () => {
      const { harness, store } = await navigateToListings('/listings?ai=1', {
        ai: { ...AI_RESULTS, busy: 'searching' },
      });
      store.overrideSelector(selectListingsAi, { ...initialListingsAiState, ...LIMITED, busy: 'idle' });
      store.refreshState();
      await flush(harness);
      await flush(harness);

      expect(document.activeElement?.classList.contains('lp-results')).toBe(false);
    });

    it('is cleared once the error is gone (next successful search)', async () => {
      const { harness, el, store } = await navigateToListings('/listings?ai=1', { ai: LIMITED });
      store.overrideSelector(selectListingsAi, { ...initialListingsAiState, ...AI_RESULTS });
      store.refreshState();
      await flush(harness);

      expect(el.querySelector('.lp-ai-top app-ai-notice')).toBeNull();
    });
  });

  describe('daily budget used up', () => {
    const SPENT = { ...initialListingsAiState, aiStatus: { available: false } };

    it('the switch is aria-disabled (still focusable) with a described-by tooltip on desktop', async () => {
      const { harness, el } = await navigateToListings('/listings', { ai: SPENT });

      const sw = el.querySelector<HTMLButtonElement>('.lp-ai-top .ai-switch')!;
      expect(sw.getAttribute('aria-checked')).toBe('false');
      expect(sw.getAttribute('aria-disabled')).toBe('true');
      expect(sw.disabled).toBe(false);
      const tip = el.querySelector<HTMLElement>('.lp-ai-top [role="tooltip"]')!;
      expect(sw.getAttribute('aria-describedby')).toBe(tip.id);
      expect(tip.hidden).toBe(true);

      sw.dispatchEvent(new Event('focus'));
      await flush(harness);
      expect(tip.hidden).toBe(false);
      expect(tip.textContent).toContain('listings.ai.budgetSpent');

      sw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush(harness);
      expect(tip.hidden).toBe(true);
    });

    it('clicking it does not turn AI on', async () => {
      const { harness, el, router } = await navigateToListings('/listings', { ai: SPENT });

      el.querySelector<HTMLButtonElement>('.lp-ai-top .ai-switch')!.click();
      await flush(harness);

      expect(router.url).not.toContain('ai=1');
    });

    it('a guest gets the status too: it is loaded on init regardless of sign-in', async () => {
      const { store } = await navigateToListings('/listings');
      expect(dispatchedTypes(store)).toContain(ListingsActions.loadAiStatus.type);
    });

    it('leaves AI mode when the page opens as ?ai=1 and the budget is already spent', async () => {
      const { harness, router } = await navigateToListings('/listings?ai=1', {
        ai: { ...SPENT, mode: true },
      });
      await flush(harness);
      await vi.advanceTimersByTimeAsync(50);

      expect(router.url).not.toContain('ai=1');
    });

    it('the field is a plain text search (no description textarea)', async () => {
      const { el } = await navigateToListings('/listings', { ai: SPENT });
      expect(el.querySelector('.lp-ai-top input[type="search"]')).not.toBeNull();
      expect(el.querySelector('.lp-ai-top textarea')).toBeNull();
    });
  });

  describe('near me with a home point', () => {
    it('shows the removable chip "Within 1 km of home" for the distance filter', async () => {
      const { el } = await navigateToListings('/listings?ai=1&radiusKm=1', {
        ai: AI_RESULTS,
        filters: { ...BASE_FILTERS, radiusKm: 1 },
        originCoords: { lat: 40.18, lng: 44.51 },
        originSource: 'home',
      });

      const chips = Array.from(el.querySelectorAll('.lp-active-chip')).map((c) => c.textContent!.trim());
      expect(chips).toEqual(['listings.filters.distance.withinHome']);
    });
  });

  describe('guest', () => {
    function submitButton(el: HTMLElement): HTMLButtonElement {
      return el.querySelector<HTMLButtonElement>('.lp-ai-top .aisf__submit')!;
    }

    const GUEST_AI = { ...initialListingsAiState, mode: true, description: 'a balance bike' };

    it('submitting opens the EXISTING sign-in dialog, keeps the description and runs nothing', async () => {
      const { harness, el, store } = await navigateToListings('/listings?ai=1', { ai: GUEST_AI });

      submitButton(el).click();
      await flush(harness);

      expect(dispatchedTypes(store)).not.toContain(ListingsActions.submitAiSearch.type);
      expect(el.querySelector('app-auth-dialog')).not.toBeNull();
      expect((el.querySelector('.lp-ai-top textarea') as HTMLTextAreaElement).value).toBe('a balance bike');
    });

    it('after sign-in the search runs automatically with the kept description', async () => {
      const { harness, el, store } = await navigateToListings('/listings?ai=1', { ai: GUEST_AI });

      submitButton(el).click();
      await flush(harness);
      store.overrideSelector(selectIsAuthenticated, true);
      store.refreshState();
      await flush(harness);
      await flush(harness);

      const calls = (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
      expect(calls).toContainEqual(ListingsActions.submitAiSearch({ description: 'a balance bike' }));
    });

    it('closing the dialog runs nothing - not even if the user signs in later by another route', async () => {
      const { harness, el, component, store } = await navigateToListings('/listings?ai=1', { ai: GUEST_AI });

      submitButton(el).click();
      await flush(harness);
      (component as unknown as { onAuthDialogClosed(): void }).onAuthDialogClosed();
      store.overrideSelector(selectIsAuthenticated, true);
      store.refreshState();
      await flush(harness);
      await flush(harness);

      expect(dispatchedTypes(store)).not.toContain(ListingsActions.submitAiSearch.type);
      store.overrideSelector(selectIsAuthenticated, false);
    });
  });
});

describe('ListingsPageComponent — price chips (design-notes 12)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const translations = {
    'listings.filters.chips.maxPricePerDay': 'Up to {{amount}} per day',
    'listings.filters.chips.minPricePerDay': 'From {{amount}} per day',
  };
  const labels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.lp-active-chip')).map((c) => c.textContent!.trim());

  it('renders max and min price chips in en, formatted like the listing cards, after category', async () => {
    const { el } = await navigateToListings('/listings?categoryId=abc-123&minPrice=1000&maxPrice=3000', {
      filters: { ...BASE_FILTERS, categoryId: 'abc-123', minPrice: 1000, maxPrice: 3000 },
      categories: [{ id: 'abc-123', name: 'Construction' }],
      translations,
    });

    expect(labels(el)).toEqual([
      'Construction',
      'Up to 3,000 ֏ per day',
      'From 1,000 ֏ per day',
    ]);
  });

  it('removing a price chip clears its query param and keeps the sibling filter', async () => {
    const { el, router } = await navigateToListings('/listings?minPrice=1000&maxPrice=3000', {
      filters: { ...BASE_FILTERS, minPrice: 1000, maxPrice: 3000 },
      translations,
    });

    el.querySelectorAll<HTMLButtonElement>('.lp-active-chip')[0].click(); // max
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).not.toContain('maxPrice');
    expect(router.url).toContain('minPrice=1000');
  });

  it('in AI mode, removing a price chip re-ranks instead of reloading the catalogue', async () => {
    const { el, store, router } = await navigateToListings('/listings?ai=1&maxPrice=3000', {
      ai: AI_RESULTS,
      filters: { ...BASE_FILTERS, maxPrice: 3000 },
      translations,
    });

    expect(labels(el)).toEqual(['Up to 3,000 ֏ per day']);
    el.querySelector<HTMLButtonElement>('.lp-active-chip')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).not.toContain('maxPrice');
    const types = dispatchedTypes(store);
    expect(types).toContain(ListingsActions.aiFiltersChanged.type);
    expect(types).not.toContain(ListingsActions.loadListings.type);
  });
});
