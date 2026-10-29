import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError, type Observable } from 'rxjs';

import { actionsHarness } from '../../../../testing/ngrx.helpers';
import { makeHomePoint, makeListingPreview } from '../../../../testing/fixtures';
import { selectHomePoint } from '../../auth/store/auth.selectors';
import type { AiSearchFilters, AiSearchResponse } from '../models/ai-search.model';
import type { ListingsFilter } from '../models/listings-filter.model';
import { ListingsApiService } from '../services/listings-api.service';
import * as ListingsActions from './listings.actions';
import { AI_RERANK_DEBOUNCE_MS, ListingsEffects } from './listings.effects';
import {
  selectAiNextPageContext,
  selectAiRequestContext,
  selectAiResultsActive,
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsOriginCoords,
  selectListingsOriginSource,
  selectListingsPage,
  selectListingsPageSize,
} from './listings.selectors';

const FILTERS: ListingsFilter = {
  query: null,
  city: null,
  categoryId: 'cat-1',
  minPrice: null,
  maxPrice: 3000,
  ageGroup: '36-72',
  radiusKm: null,
  districtIds: ['d-1'],
};

const APPLIED: AiSearchFilters = {
  categoryId: 'cat-1',
  ageGroup: '36-72',
  maxPrice: 3000,
  districtIds: ['d-1'],
  nearHome: false,
  radiusKm: null,
};

function makeResponse(overrides: Partial<AiSearchResponse> = {}): AiSearchResponse {
  return {
    items: [makeListingPreview({ id: 'a' })],
    page: 1,
    pageSize: 20,
    totalCount: 1,
    hasMore: false,
    appliedFilters: APPLIED,
    ranked: true,
    intent: 'Outdoor play',
    widenedDistrictIds: [],
    purposeWidened: false,
    datesMentioned: false,
    locationNotConsidered: false,
    aiUnavailable: false,
    ...overrides,
  };
}

function setup(api: Partial<ListingsApiService> = {}) {
  const harness = actionsHarness();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      ListingsEffects,
      harness.provider,
      provideMockStore(),
      { provide: ListingsApiService, useValue: api },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectAiRequestContext, {
    description: 'a balance bike',
    epoch: 7,
    filters: FILTERS,
    pageSize: 20,
    originSource: null,
  });
  store.overrideSelector(selectAiNextPageContext, {
    active: true,
    description: 'a balance bike',
    epoch: 7,
    appliedFilters: APPLIED,
    excludeIds: ['a', 'b'],
    page: 1,
    pageSize: 20,
    hasMore: true,
  });
  store.overrideSelector(selectAiResultsActive, true);
  store.overrideSelector(selectListingsFilters, FILTERS);
  store.overrideSelector(selectListingsOriginSource, null);
  store.overrideSelector(selectListingsOriginCoords, null);
  store.overrideSelector(selectListingsHasMore, true);
  store.overrideSelector(selectListingsPage, 1);
  store.overrideSelector(selectListingsPageSize, 20);
  store.overrideSelector(selectHomePoint, null);
  return { harness, store, effects: TestBed.inject(ListingsEffects) };
}

/** Live collection (the AI effects use timers, so `collect()` that waits for completion is no good). */
function listen<T extends Action>(effect$: Observable<T>): T[] {
  const out: T[] = [];
  effect$.subscribe((a) => out.push(a));
  return out;
}

describe('ListingsEffects — AI search (ADR-054)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('aiFirstPage$', () => {
    it('a first search sends filters: null (the server parses the description) and page 1', () => {
      const aiSearch = vi.fn().mockReturnValue(of(makeResponse()));
      const { harness, effects } = setup({ aiSearch });
      const out = listen(effects.aiFirstPage$);

      harness.send(ListingsActions.submitAiSearch({ description: 'a balance bike' }));

      expect(aiSearch).toHaveBeenCalledWith({
        description: 'a balance bike',
        filters: null,
        page: 1,
        pageSize: 20,
        excludeIds: null,
      });
      expect(out).toEqual([
        ListingsActions.aiSearchSuccess({ kind: 'search', response: makeResponse(), epoch: 7 }),
      ]);
    });

    it('a filter change re-ranks after 400 ms with the user filters (no re-parse); several quick changes cost one request', () => {
      const aiSearch = vi.fn().mockReturnValue(of(makeResponse()));
      const { harness, effects } = setup({ aiSearch });
      const out = listen(effects.aiFirstPage$);

      harness.send(ListingsActions.aiFiltersChanged({ filters: FILTERS }));
      vi.advanceTimersByTime(AI_RERANK_DEBOUNCE_MS - 50);
      expect(aiSearch).not.toHaveBeenCalled();

      harness.send(ListingsActions.aiFiltersChanged({ filters: { ...FILTERS, maxPrice: 2000 } }));
      vi.advanceTimersByTime(AI_RERANK_DEBOUNCE_MS - 50);
      expect(aiSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(aiSearch).toHaveBeenCalledTimes(1);
      expect(aiSearch.mock.calls[0][0]).toMatchObject({
        description: 'a balance bike',
        page: 1,
        excludeIds: null,
        filters: {
          categoryId: 'cat-1',
          ageGroup: '36-72',
          maxPrice: 3000,
          districtIds: ['d-1'],
          nearHome: false,
          radiusKm: null,
        },
      });
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ type: ListingsActions.aiSearchSuccess.type, kind: 'rerank' });
    });

    it('"Most relevant first" (aiRerank) re-ranks at once, with no debounce', () => {
      const aiSearch = vi.fn().mockReturnValue(of(makeResponse()));
      const { harness, effects } = setup({ aiSearch });
      listen(effects.aiFirstPage$);

      harness.send(ListingsActions.aiRerank());

      expect(aiSearch).toHaveBeenCalledTimes(1);
    });

    it('a newer request cancels the one in flight (the latest wins)', () => {
      const first = new Subject<AiSearchResponse>();
      const aiSearch = vi
        .fn()
        .mockReturnValueOnce(first.asObservable())
        .mockReturnValueOnce(of(makeResponse({ intent: 'second' })));
      const { harness, effects } = setup({ aiSearch });
      const out = listen(effects.aiFirstPage$);

      harness.send(ListingsActions.submitAiSearch({ description: 'one' }));
      harness.send(ListingsActions.submitAiSearch({ description: 'two' }));
      first.next(makeResponse({ intent: 'first' }));

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ response: { intent: 'second' } });
    });

    it('turns a failure into aiSearchFailure with the errorCode, never throwing', () => {
      const aiSearch = vi
        .fn()
        .mockReturnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 429,
                error: { errorCode: 'ai_search.rate_limited' },
              }),
          ),
        );
      const { harness, effects } = setup({ aiSearch });
      const out = listen(effects.aiFirstPage$);

      harness.send(ListingsActions.submitAiSearch({ description: 'x' }));

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        type: ListingsActions.aiSearchFailure.type,
        errorCode: 'ai_search.rate_limited',
        epoch: 7,
      });
    });
  });

  describe('loadAiNextPage$', () => {
    it('asks for page + 1 with the page-1 applied filters and every id shown so far', () => {
      const aiSearch = vi.fn().mockReturnValue(of(makeResponse({ page: 2, ranked: false })));
      const { harness, effects } = setup({ aiSearch });
      const out = listen(effects.loadAiNextPage$);

      harness.send(ListingsActions.loadNextPage());

      expect(aiSearch).toHaveBeenCalledWith({
        description: 'a balance bike',
        filters: APPLIED,
        page: 2,
        pageSize: 20,
        excludeIds: ['a', 'b'],
      });
      expect(out[0]).toMatchObject({
        type: ListingsActions.aiSearchSuccess.type,
        kind: 'page',
        epoch: 7,
      });
    });

    it('does nothing when the results are not AI-ordered or there is no more', () => {
      const aiSearch = vi.fn();
      const { harness, store, effects } = setup({ aiSearch });
      listen(effects.loadAiNextPage$);

      store.overrideSelector(selectAiNextPageContext, {
        active: false,
        description: 'x',
        epoch: 1,
        appliedFilters: APPLIED,
        excludeIds: [],
        page: 1,
        pageSize: 20,
        hasMore: true,
      });
      store.refreshState();
      harness.send(ListingsActions.loadNextPage());

      expect(aiSearch).not.toHaveBeenCalled();
    });
  });

  describe('loadNextPage$ hand-off', () => {
    it('stays out of the way while AI-ordered results are showing', () => {
      const getListings = vi.fn();
      const { harness, store, effects } = setup({ getListings });
      store.overrideSelector(selectListingsFilters, FILTERS);
      const out = listen(effects.loadNextPage$);

      harness.send(ListingsActions.loadNextPage());

      expect(getListings).not.toHaveBeenCalled();
      expect(out).toEqual([]);
    });
  });

  it('dropAiOrder$ loads the ordinary catalogue', () => {
    const { harness, effects } = setup();
    const out = listen(effects.dropAiOrder$);

    harness.send(ListingsActions.dropAiOrder());

    expect(out).toEqual([ListingsActions.loadListings()]);
  });

  describe('syncAiFiltersToUrl$', () => {
    it('mirrors the applied filters into the URL next to ai=1 (never the description)', () => {
      const { harness, effects } = setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      effects.syncAiFiltersToUrl$.subscribe();

      harness.send(
        ListingsActions.aiSearchSuccess({ kind: 'search', response: makeResponse(), epoch: 7 }),
      );

      expect(navigate).toHaveBeenCalledTimes(1);
      const [, extras] = navigate.mock.calls[0];
      expect(extras).toMatchObject({
        queryParamsHandling: 'merge',
        queryParams: {
          ai: '1',
          q: null,
          categoryId: 'cat-1',
          ageGroup: '36-72',
          maxPrice: '3000',
          districtIds: 'd-1',
        },
      });
      expect(JSON.stringify(extras)).not.toContain('balance');
    });

    it('does nothing for a page-2+ response', () => {
      const { harness, effects } = setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      effects.syncAiFiltersToUrl$.subscribe();

      harness.send(
        ListingsActions.aiSearchSuccess({
          kind: 'page',
          response: makeResponse({ page: 2 }),
          epoch: 7,
        }),
      );

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('aiNearHomeOrigin$', () => {
    const nearHome = makeResponse({ appliedFilters: { ...APPLIED, nearHome: true, radiusKm: 1 } });

    it('points the distance filter at the home point when "near me" was applied', () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectHomePoint, makeHomePoint());
      store.refreshState();
      const out = listen(effects.aiNearHomeOrigin$);

      harness.send(
        ListingsActions.aiSearchSuccess({ kind: 'search', response: nearHome, epoch: 7 }),
      );

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ type: ListingsActions.setOriginCoords.type, source: 'home' });
    });

    it('does nothing when the origin already is home, or there is no home point, or nearHome is off', () => {
      const { harness, store, effects } = setup();
      const out = listen(effects.aiNearHomeOrigin$);

      // no home point
      harness.send(
        ListingsActions.aiSearchSuccess({ kind: 'search', response: nearHome, epoch: 7 }),
      );
      // home point, origin already home
      store.overrideSelector(selectHomePoint, makeHomePoint());
      store.overrideSelector(selectListingsOriginSource, 'home');
      store.refreshState();
      harness.send(
        ListingsActions.aiSearchSuccess({ kind: 'search', response: nearHome, epoch: 7 }),
      );
      // nearHome off
      store.overrideSelector(selectListingsOriginSource, null);
      store.refreshState();
      harness.send(
        ListingsActions.aiSearchSuccess({ kind: 'search', response: makeResponse(), epoch: 7 }),
      );

      expect(out).toEqual([]);
    });
  });

  describe('loadAiStatus$', () => {
    it('loads the budget state', () => {
      const aiSearchStatus = vi.fn().mockReturnValue(of({ available: false }));
      const { harness, effects } = setup({ aiSearchStatus });
      const out = listen(effects.loadAiStatus$);

      harness.send(ListingsActions.loadAiStatus());

      expect(out).toEqual([ListingsActions.loadAiStatusSuccess({ status: { available: false } })]);
    });

    it('a failed status call is not an error state', () => {
      const aiSearchStatus = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
      const { harness, effects } = setup({ aiSearchStatus });
      const out = listen(effects.loadAiStatus$);

      harness.send(ListingsActions.loadAiStatus());

      expect(out).toEqual([ListingsActions.loadAiStatusFailure()]);
    });
  });
});
