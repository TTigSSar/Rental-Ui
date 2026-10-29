import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
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
  readonly originSource?: 'geo' | 'manual' | null;
  readonly ai?: Partial<ListingsAiState>;
  readonly items?: ListingPreview[];
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
          { selector: selectListingCategories, value: [] },
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

  it('shows the explanation and "· most relevant first" while the order is ranked', async () => {
    const { el } = await navigateToListings('/listings?ai=1', { ai: AI_RESULTS });
    expect(el.querySelector('.lp-ai-explain')?.textContent).toContain('Picked for outdoor play');
    expect(el.querySelector('.lp-toolbar__relevant')).not.toBeNull();
  });

  it('shows neither when ranking failed', async () => {
    const { el } = await navigateToListings('/listings?ai=1', { ai: { ...AI_RESULTS, ranked: false } });
    expect(el.querySelector('.lp-ai-explain')).toBeNull();
    expect(el.querySelector('.lp-toolbar__relevant')).toBeNull();
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
