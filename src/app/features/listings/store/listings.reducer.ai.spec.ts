import { makeListingPreview } from '../../../../testing/fixtures';
import type { AiSearchResponse } from '../models/ai-search.model';
import * as AuthActions from '../../auth/store/auth.actions';
import * as ListingsActions from './listings.actions';
import { listingsReducer } from './listings.reducer';
import { initialListingsAiState, initialListingsState, type ListingsState } from './listings.state';

function makeResponse(overrides: Partial<AiSearchResponse> = {}): AiSearchResponse {
  return {
    items: [makeListingPreview({ id: 'a' }), makeListingPreview({ id: 'b' })],
    page: 1,
    pageSize: 20,
    totalCount: 30,
    hasMore: true,
    appliedFilters: {
      categoryId: 'cat-1',
      ageGroup: '36-72',
      maxPrice: 3000,
      districtIds: ['d-1', 'd-2'],
      nearHome: false,
      radiusKm: null,
    },
    ranked: true,
    intent: 'Picked for outdoor play',
    widenedDistrictIds: ['d-2'],
    purposeWidened: false,
    datesMentioned: false,
    locationNotConsidered: false,
    aiUnavailable: false,
    ...overrides,
  };
}

function aiOn(patch: Partial<ListingsState['ai']> = {}): ListingsState {
  return { ...initialListingsState, ai: { ...initialListingsAiState, mode: true, ...patch } };
}

describe('listingsReducer — AI search (ADR-054)', () => {
  describe('setAiMode', () => {
    it('turning on keeps the URL snapshot to restore later', () => {
      const next = listingsReducer(
        initialListingsState,
        ListingsActions.setAiMode({ on: true, snapshot: { q: 'lego', view: 'map' } }),
      );
      expect(next.ai.mode).toBe(true);
      expect(next.ai.snapshot).toEqual({ q: 'lego', view: 'map' });
    });

    it('is idempotent while on (the page re-dispatches it on every URL emission)', () => {
      const on = aiOn({ snapshot: { q: 'lego' } });
      expect(listingsReducer(on, ListingsActions.setAiMode({ on: true }))).toBe(on);
    });

    it('turning off clears the results but keeps the description, the budget status and the example flag', () => {
      const state = aiOn({
        description: 'a balance bike',
        hasSearched: true,
        orderActive: true,
        ranked: true,
        intent: 'x',
        rankedIds: ['a'],
        aiStatus: { available: true },
        epoch: 4,
      });
      const next = listingsReducer(state, ListingsActions.setAiMode({ on: false }));

      expect(next.ai).toEqual({
        ...initialListingsAiState,
        description: 'a balance bike',
        aiStatus: { available: true },
        exampleSeen: true,
        epoch: 5,
      });
    });

    it('turning off while already off changes nothing', () => {
      expect(listingsReducer(initialListingsState, ListingsActions.setAiMode({ on: false }))).toBe(
        initialListingsState,
      );
    });
  });

  it('never writes the description to the text query', () => {
    let state = listingsReducer(
      aiOn(),
      ListingsActions.setAiDescription({ description: 'a balance bike' }),
    );
    state = listingsReducer(
      state,
      ListingsActions.submitAiSearch({ description: 'a balance bike' }),
    );
    expect(state.ai.description).toBe('a balance bike');
    expect(state.filters.query).toBeNull();
    expect(state.ai.busy).toBe('searching');
  });

  describe('aiSearchSuccess', () => {
    it('a first search replaces the results and applies the AI filters to the page filters', () => {
      const searching = listingsReducer(
        aiOn({ description: 'bike' }),
        ListingsActions.submitAiSearch({ description: 'bike' }),
      );
      const next = listingsReducer(
        searching,
        ListingsActions.aiSearchSuccess({
          kind: 'search',
          response: makeResponse(),
          epoch: searching.ai.epoch,
        }),
      );

      expect(next.items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(next.hasMore).toBe(true);
      expect(next.filters).toMatchObject({
        categoryId: 'cat-1',
        ageGroup: '36-72',
        maxPrice: 3000,
        districtIds: ['d-1', 'd-2'],
        query: null,
      });
      expect(next.ai).toMatchObject({
        hasSearched: true,
        orderActive: true,
        busy: 'idle',
        ranked: true,
        intent: 'Picked for outdoor play',
        widenedDistrictIds: ['d-2'],
        rankedIds: ['a', 'b'],
      });
      expect(next.ai.appliedFilters).toEqual(makeResponse().appliedFilters);
    });

    it('a re-rank keeps the original intent (the server returns intent: null)', () => {
      const state = aiOn({
        hasSearched: true,
        orderActive: true,
        ranked: true,
        intent: 'Original',
        busy: 'reranking',
      });
      const next = listingsReducer(
        state,
        ListingsActions.aiSearchSuccess({
          kind: 'rerank',
          response: makeResponse({ intent: null }),
          epoch: state.ai.epoch,
        }),
      );
      expect(next.ai.intent).toBe('Original');
      expect(next.ai.busy).toBe('idle');
    });

    it('an unranked page 1 has no ranked ids (no divider) and a first search with no intent clears the old one', () => {
      const state = aiOn({ intent: 'stale' });
      const next = listingsReducer(
        state,
        ListingsActions.aiSearchSuccess({
          kind: 'search',
          response: makeResponse({ ranked: false, intent: null }),
          epoch: state.ai.epoch,
        }),
      );
      expect(next.ai.ranked).toBe(false);
      expect(next.ai.rankedIds).toEqual([]);
      expect(next.ai.intent).toBeNull();
    });

    it('page 2+ appends without repeating a card and leaves the ranked flags alone', () => {
      const state = aiOn({
        hasSearched: true,
        orderActive: true,
        ranked: true,
        intent: 'x',
        rankedIds: ['a', 'b'],
      });
      const withItems: ListingsState = {
        ...state,
        items: [makeListingPreview({ id: 'a' }), makeListingPreview({ id: 'b' })],
        page: 1,
      };
      const next = listingsReducer(
        withItems,
        ListingsActions.aiSearchSuccess({
          kind: 'page',
          response: makeResponse({
            items: [makeListingPreview({ id: 'b' }), makeListingPreview({ id: 'c' })],
            page: 2,
            ranked: false,
            intent: null,
            hasMore: false,
          }),
          epoch: state.ai.epoch,
        }),
      );

      expect(next.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
      expect(next.page).toBe(2);
      expect(next.hasMore).toBe(false);
      expect(next.ai.ranked).toBe(true);
      expect(next.ai.rankedIds).toEqual(['a', 'b']);
      expect(next.ai.intent).toBe('x');
    });

    it('ignores a response that was superseded (switch off, drop order, newer request)', () => {
      const state = aiOn({ epoch: 3 });
      const next = listingsReducer(
        state,
        ListingsActions.aiSearchSuccess({ kind: 'search', response: makeResponse(), epoch: 2 }),
      );
      expect(next).toBe(state);
    });
  });

  it('aiFiltersChanged keeps the cards (dimmed) and starts the re-rank', () => {
    const state: ListingsState = {
      ...aiOn({ hasSearched: true, orderActive: true }),
      items: [makeListingPreview({ id: 'a' })],
    };
    const filters = { ...initialListingsState.filters, maxPrice: 2000 };
    const next = listingsReducer(state, ListingsActions.aiFiltersChanged({ filters }));

    expect(next.items).toHaveLength(1);
    expect(next.filters.maxPrice).toBe(2000);
    expect(next.ai.busy).toBe('reranking');
    expect(next.ai.epoch).toBe(state.ai.epoch + 1);
  });

  it('dropAiOrder leaves AI order behind: ordinary catalogue, no ranked flags, intent kept for a later return', () => {
    const state: ListingsState = {
      ...aiOn({
        hasSearched: true,
        orderActive: true,
        ranked: true,
        intent: 'x',
        rankedIds: ['a'],
      }),
      items: [makeListingPreview({ id: 'a' })],
      hasMore: true,
    };
    const next = listingsReducer(state, ListingsActions.dropAiOrder());

    expect(next.ai).toMatchObject({
      orderActive: false,
      ranked: false,
      rankedIds: [],
      intent: 'x',
      mode: true,
      hasSearched: true,
    });
    expect(next.items).toEqual([]);
    expect(next.page).toBe(1);
  });

  it('aiRerank (sort back to "Most relevant first") restores AI order and starts a re-rank', () => {
    const state = aiOn({ hasSearched: true, orderActive: false });
    const next = listingsReducer(state, ListingsActions.aiRerank());
    expect(next.ai).toMatchObject({ orderActive: true, busy: 'reranking' });
  });

  it('aiSearchFailure keeps the cards, stops the busy state and records the error code', () => {
    const state = aiOn({ busy: 'searching', epoch: 1 });
    const next = listingsReducer(
      { ...state, items: [makeListingPreview({ id: 'a' })] },
      ListingsActions.aiSearchFailure({
        error: 'Slow down',
        errorCode: 'ai_search.rate_limited',
        epoch: 1,
      }),
    );
    expect(next.items).toHaveLength(1);
    expect(next.ai).toMatchObject({
      busy: 'idle',
      error: 'Slow down',
      errorCode: 'ai_search.rate_limited',
    });
  });

  it('stores the budget status', () => {
    const next = listingsReducer(
      initialListingsState,
      ListingsActions.loadAiStatusSuccess({ status: { available: false } }),
    );
    expect(next.ai.aiStatus).toEqual({ available: false });
  });

  it('submitAiSearch records the submitted description; typing afterwards does not change it', () => {
    let state = listingsReducer(aiOn(), ListingsActions.submitAiSearch({ description: 'bike' }));
    state = listingsReducer(state, ListingsActions.setAiDescription({ description: 'bike, red' }));
    expect(state.ai.submittedDescription).toBe('bike');
    expect(state.ai.description).toBe('bike, red');
  });

  it('logout resets the whole AI slice (description, results flags, snapshot)', () => {
    const state = listingsReducer(
      aiOn({
        description: 'secret',
        submittedDescription: 'secret',
        hasSearched: true,
        orderActive: true,
        snapshot: { q: 'lego' },
      }),
      AuthActions.logout(),
    );
    expect(state.ai).toEqual(initialListingsAiState);
  });
});
