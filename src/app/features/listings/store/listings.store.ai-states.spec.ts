import { makeListingPreview } from '../../../../testing/fixtures';
import type { AiSearchResponse } from '../models/ai-search.model';
import * as ListingsActions from './listings.actions';
import { listingsReducer } from './listings.reducer';
import {
  selectAiBudgetSpent,
  selectAiFallbackNotice,
  selectAiNotes,
  selectAiOtherError,
  selectAiRateLimited,
} from './listings.selectors';
import { initialListingsAiState, initialListingsState, type ListingsState } from './listings.state';

/** Reducer + selector coverage for the AI-search failure / fallback / note states (stage 2 + 3). */

function makeResponse(overrides: Partial<AiSearchResponse> = {}): AiSearchResponse {
  return {
    items: [makeListingPreview({ id: 'a' }), makeListingPreview({ id: 'b' })],
    page: 1,
    pageSize: 20,
    totalCount: 2,
    hasMore: false,
    appliedFilters: {
      categoryId: null,
      ageGroup: null,
      maxPrice: null,
      districtIds: null,
      nearHome: false,
      radiusKm: null,
    },
    ranked: true,
    intent: 'Picked for outdoor play',
    widenedDistrictIds: [],
    purposeWidened: false,
    datesMentioned: false,
    locationNotConsidered: false,
    aiUnavailable: false,
    ...overrides,
  };
}

function aiOn(patch: Partial<ListingsState['ai']> = {}): ListingsState {
  return { ...initialListingsState, ai: { ...initialListingsAiState, mode: true, epoch: 3, ...patch } };
}

function root(ai: Partial<ListingsState['ai']>) {
  return { listings: { ...initialListingsState, ai: { ...initialListingsAiState, ...ai } } };
}

describe('listingsReducer — AI unavailable (fallback)', () => {
  const unavailable = makeResponse({
    aiUnavailable: true,
    ranked: false,
    intent: null,
    hasMore: true,
    items: [makeListingPreview({ id: 'x' })],
  });

  it('turns the switch OFF, keeps the description and the budget status, and keeps the notice', () => {
    const state = aiOn({
      description: 'a balance bike',
      busy: 'searching',
      aiStatus: { available: true },
      hasSearched: true,
      ranked: true,
      intent: 'old',
    });
    const next = listingsReducer(
      state,
      ListingsActions.aiSearchSuccess({ kind: 'search', response: unavailable, epoch: 3 }),
    );

    expect(next.ai.mode).toBe(false);
    expect(next.ai.fallbackNotice).toBe(true);
    expect(next.ai.description).toBe('a balance bike');
    expect(next.ai.aiStatus).toEqual({ available: true });
    expect(next.ai).toMatchObject({ busy: 'idle', hasSearched: false, ranked: false, intent: null });
  });

  it('shows the ordinary text-search results with the description as the plain text query', () => {
    const next = listingsReducer(
      aiOn({ description: '  a balance bike ', busy: 'searching' }),
      ListingsActions.aiSearchSuccess({ kind: 'search', response: unavailable, epoch: 3 }),
    );

    expect(next.items.map((i) => i.id)).toEqual(['x']);
    expect(next.hasMore).toBe(true);
    expect(next.filters.query).toBe('a balance bike');
    expect(next.isLoading).toBe(false);
  });

  it('a later search with the switch on retries AI: submitting clears the notice', () => {
    const off: ListingsState = {
      ...initialListingsState,
      ai: { ...initialListingsAiState, fallbackNotice: true, description: 'bike' },
    };
    const on = listingsReducer(off, ListingsActions.setAiMode({ on: true }));
    expect(on.ai.mode).toBe(true);
    expect(on.ai.fallbackNotice).toBe(true); // switching on alone does not hide it

    const submitted = listingsReducer(on, ListingsActions.submitAiSearch({ description: 'bike' }));
    expect(submitted.ai.fallbackNotice).toBe(false);
    expect(submitted.ai.busy).toBe('searching');
  });

  it('a successful AI search ends the fallback notice', () => {
    const state = aiOn({ busy: 'searching', fallbackNotice: true });
    const next = listingsReducer(
      state,
      ListingsActions.aiSearchSuccess({ kind: 'search', response: makeResponse(), epoch: 3 }),
    );
    expect(next.ai.fallbackNotice).toBe(false);
    expect(next.ai.mode).toBe(true);
  });

  it('a page-2+ response never triggers the fallback', () => {
    const next = listingsReducer(
      aiOn({ hasSearched: true, orderActive: true }),
      ListingsActions.aiSearchSuccess({ kind: 'page', response: unavailable, epoch: 3 }),
    );
    expect(next.ai.mode).toBe(true);
    expect(next.ai.fallbackNotice).toBe(false);
  });

  it('a stale (superseded) response is ignored', () => {
    const state = aiOn({ busy: 'searching' });
    const next = listingsReducer(
      state,
      ListingsActions.aiSearchSuccess({ kind: 'search', response: unavailable, epoch: 1 }),
    );
    expect(next).toBe(state);
  });

  it('switching the AI switch off by hand clears the notice', () => {
    const next = listingsReducer(aiOn({ fallbackNotice: true }), ListingsActions.setAiMode({ on: false }));
    expect(next.ai.fallbackNotice).toBe(false);
  });
});

describe('listingsReducer — notes', () => {
  it('a re-rank keeps the dates note (the server does not re-read the description) but not the others', () => {
    const state = aiOn({
      busy: 'reranking',
      hasSearched: true,
      datesMentioned: true,
      locationNotConsidered: true,
      purposeWidened: true,
    });
    const next = listingsReducer(
      state,
      ListingsActions.aiSearchSuccess({ kind: 'rerank', response: makeResponse(), epoch: 3 }),
    );
    expect(next.ai).toMatchObject({
      datesMentioned: true,
      locationNotConsidered: false,
      purposeWidened: false,
    });
  });

  it('a fresh search takes the flags from the response', () => {
    const state = aiOn({ busy: 'searching', datesMentioned: true });
    const next = listingsReducer(
      state,
      ListingsActions.aiSearchSuccess({
        kind: 'search',
        response: makeResponse({ locationNotConsidered: true }),
        epoch: 3,
      }),
    );
    expect(next.ai).toMatchObject({ datesMentioned: false, locationNotConsidered: true });
  });
});

describe('listingsReducer — rate limit', () => {
  it('keeps the description and the cards, stops the busy state and records the code only', () => {
    const state: ListingsState = {
      ...aiOn({ busy: 'searching', description: 'a balance bike', hasSearched: true, orderActive: true }),
      items: [makeListingPreview({ id: 'a' })],
    };
    const next = listingsReducer(
      state,
      ListingsActions.aiSearchFailure({ error: 'x', errorCode: 'ai_search.rate_limited', epoch: 3 }),
    );
    expect(next.items).toHaveLength(1);
    expect(next.ai.description).toBe('a balance bike');
    expect(next.ai.busy).toBe('idle');
    expect(next.ai.errorCode).toBe('ai_search.rate_limited');
  });

  it('clears on the next search that goes through', () => {
    const limited = aiOn({ error: 'x', errorCode: 'ai_search.rate_limited' });
    const searching = listingsReducer(limited, ListingsActions.submitAiSearch({ description: 'bike' }));
    expect(searching.ai.errorCode).toBeNull();

    const done = listingsReducer(
      { ...limited, ai: { ...limited.ai, busy: 'searching' } },
      ListingsActions.aiSearchSuccess({ kind: 'search', response: makeResponse(), epoch: 3 }),
    );
    expect(done.ai.error).toBeNull();
    expect(done.ai.errorCode).toBeNull();
  });
});

describe('AI state selectors', () => {
  it('selectAiBudgetSpent: only a known `available: false` disables the switch', () => {
    expect(selectAiBudgetSpent(root({ aiStatus: null }))).toBe(false);
    expect(selectAiBudgetSpent(root({ aiStatus: { available: true } }))).toBe(false);
    expect(selectAiBudgetSpent(root({ aiStatus: { available: false } }))).toBe(true);
  });

  it('selectAiFallbackNotice follows the flag', () => {
    expect(selectAiFallbackNotice(root({ fallbackNotice: true }))).toBe(true);
    expect(selectAiFallbackNotice(root({}))).toBe(false);
  });

  it('selectAiRateLimited is decided by the errorCode, never by the message', () => {
    expect(selectAiRateLimited(root({ errorCode: 'ai_search.rate_limited', error: 'anything' }))).toBe(true);
    expect(selectAiRateLimited(root({ errorCode: null, error: 'Too many searches' }))).toBe(false);
  });

  it('selectAiOtherError hides the rate-limit message (it has its own notice)', () => {
    expect(selectAiOtherError(root({ errorCode: 'ai_search.rate_limited', error: 'x' }))).toBeNull();
    expect(selectAiOtherError(root({ errorCode: 'ai_search.invalid_description', error: 'y' }))).toBe('y');
  });

  describe('selectAiNotes', () => {
    const base = { mode: true, hasSearched: true };

    it('is empty without flags or without a search', () => {
      expect(selectAiNotes(root(base))).toEqual([]);
      expect(selectAiNotes(root({ datesMentioned: true }))).toEqual([]);
    });

    it('orders dates, location, purpose', () => {
      expect(selectAiNotes(root({ ...base, purposeWidened: true, datesMentioned: true }))).toEqual([
        'dates',
        'purpose',
      ]);
      expect(selectAiNotes(root({ ...base, locationNotConsidered: true, purposeWidened: true }))).toEqual([
        'location',
        'purpose',
      ]);
    });

    it('shows at most two: with all three set the purpose note drops', () => {
      expect(
        selectAiNotes(
          root({ ...base, datesMentioned: true, locationNotConsidered: true, purposeWidened: true }),
        ),
      ).toEqual(['dates', 'location']);
    });
  });
});
