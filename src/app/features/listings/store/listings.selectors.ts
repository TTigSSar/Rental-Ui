import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { ListingCategoryOption } from '../models/create-listing.model';
import type { ListingDetails } from '../models/listing-details.model';
import type { ListingMapPin } from '../models/listing-map-pin.model';
import type { ListingPreview } from '../models/listing.model';
import type {
  ListingsFilter,
  ListingsOriginCoords,
  ListingsOriginSource,
} from '../models/listings-filter.model';
import { listingsFeatureKey } from './listings.reducer';
import type { ListingsAiState, ListingsState } from './listings.state';

export const selectListingsState =
  createFeatureSelector<ListingsState>(listingsFeatureKey);

export const selectListingItems = createSelector(
  selectListingsState,
  (state: ListingsState): ListingPreview[] => state.items,
);

export const selectSelectedListing = createSelector(
  selectListingsState,
  (state: ListingsState): ListingDetails | null => state.selectedListing,
);

export const selectListingsFilters = createSelector(
  selectListingsState,
  (state: ListingsState): ListingsFilter => state.filters,
);

export const selectListingsOriginCoords = createSelector(
  selectListingsState,
  (state: ListingsState): ListingsOriginCoords | null => state.originCoords,
);

export const selectListingsOriginSource = createSelector(
  selectListingsState,
  (state: ListingsState): ListingsOriginSource | null => state.originSource,
);

export const selectListingsOriginDenied = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.originDenied,
);

export const selectListingsPage = createSelector(
  selectListingsState,
  (state: ListingsState): number => state.page,
);

export const selectListingsPageSize = createSelector(
  selectListingsState,
  (state: ListingsState): number => state.pageSize,
);

export const selectListingsHasMore = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.hasMore,
);

export const selectListingsLoading = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.isLoading,
);

export const selectListingDetailsLoading = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.isDetailsLoading,
);

export const selectListingsError = createSelector(
  selectListingsState,
  (state: ListingsState): string | null => state.error,
);

export const selectListingCategories = createSelector(
  selectListingsState,
  (state: ListingsState): ListingCategoryOption[] => state.categories,
);

export const selectListingCategoriesLoading = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.categoriesLoading,
);

export const selectCreateListingLoading = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.createListingLoading,
);

export const selectCreateListingError = createSelector(
  selectListingsState,
  (state: ListingsState): string | null => state.createListingError,
);

/**
 * `true` when the last create attempt was refused with 409
 * `listing.home_point_required` — the owner has no home point, so the
 * backend has nothing to derive the listing's location from. The wizard
 * re-raises its gate on this instead of printing the message.
 */
export const selectCreateListingHomePointRequired = createSelector(
  selectListingsState,
  (state: ListingsState): boolean =>
    state.createListingErrorCode === 'listing.home_point_required',
);

/** 409 `listing.phone_required` — refused BEFORE any write (ADR-030 §8), so the wizard
 *  opens the phone step and re-sends once the number is saved. */
export const selectCreateListingPhoneRequired = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.createListingErrorCode === 'listing.phone_required',
);

export const selectCreateListingSuccessId = createSelector(
  selectListingsState,
  (state: ListingsState): string | null => state.createListingSuccessId,
);

export const selectCreateListingImageUploadError = createSelector(
  selectListingsState,
  (state: ListingsState): string | null => state.createListingImageUploadError,
);

export const selectCreateListingImageUploadProgress = createSelector(
  selectListingsState,
  (state: ListingsState): number | null =>
    state.createListingImageUploadProgress,
);

export const selectMapPins = createSelector(
  selectListingsState,
  (state: ListingsState): ListingMapPin[] => state.mapPins,
);

export const selectMapPinsLoading = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.mapPinsLoading,
);

export const selectMapPinsError = createSelector(
  selectListingsState,
  (state: ListingsState): string | null => state.mapPinsError,
);

export const selectMapPinsTruncated = createSelector(
  selectListingsState,
  (state: ListingsState): boolean => state.mapPinsTruncated,
);

// ── AI search (ADR-054) ──────────────────────────────────────────────────

export const selectListingsAi = createSelector(
  selectListingsState,
  (state: ListingsState): ListingsAiState => state.ai,
);

export const selectAiMode = createSelector(selectListingsAi, (ai): boolean => ai.mode);

export const selectAiDescription = createSelector(selectListingsAi, (ai): string => ai.description);

export const selectAiBusy = createSelector(selectListingsAi, (ai) => ai.busy);

export const selectAiStatus = createSelector(selectListingsAi, (ai) => ai.aiStatus);

export const selectAiError = createSelector(selectListingsAi, (ai): string | null => ai.error);

/** Daily budget used up: loaded on page init; `null` until known (then the switch stays usable). */
export const selectAiBudgetSpent = createSelector(
  selectAiStatus,
  (status): boolean => status !== null && !status.available,
);

/** The last search fell back to the ordinary catalogue: the info notice shows (switch is off). */
export const selectAiFallbackNotice = createSelector(selectListingsAi, (ai): boolean => ai.fallbackNotice);

/** 429 `ai_search.rate_limited` (by errorCode, never by server prose - ADR-045). */
export const selectAiRateLimited = createSelector(
  selectListingsAi,
  (ai): boolean => ai.errorCode === 'ai_search.rate_limited',
);

/** 429 `ai_search.daily_limit`: the per-user daily AI quota is used up (by errorCode, ADR-045). */
export const selectAiDailyLimited = createSelector(
  selectListingsAi,
  (ai): boolean => ai.errorCode === 'ai_search.daily_limit',
);

/** Any other AI failure message (the rate and daily limits have their own notice). */
export const selectAiOtherError = createSelector(selectListingsAi, (ai): string | null =>
  ai.errorCode === 'ai_search.rate_limited' || ai.errorCode === 'ai_search.daily_limit' ? null : ai.error,
);

export type AiNoteKind = 'dates' | 'location' | 'purpose';

/** Notes under the count/explanation lines: dates first, at most two. */
export const selectAiNotes = createSelector(selectListingsAi, (ai): AiNoteKind[] => {
  if (!ai.mode || !ai.hasSearched) return [];
  const notes: AiNoteKind[] = [];
  if (ai.datesMentioned) notes.push('dates');
  if (ai.locationNotConsidered) notes.push('location');
  if (ai.purposeWidened) notes.push('purpose');
  return notes.slice(0, 2);
});

export const selectAiExampleSeen = createSelector(selectListingsAi, (ai): boolean => ai.exampleSeen);

export const selectAiSnapshot = createSelector(selectListingsAi, (ai) => ai.snapshot);

/** AI mode is on and a search has produced the current results ("Most relevant first" is offered). */
export const selectAiHasSearched = createSelector(
  selectListingsAi,
  (ai): boolean => ai.mode && ai.hasSearched,
);

/** The visible results are in AI order (not yet replaced by another sort). */
export const selectAiResultsActive = createSelector(
  selectListingsAi,
  (ai): boolean => ai.mode && ai.hasSearched && ai.orderActive,
);

/** Explanation line: the intent, only while the order is ranked. */
export const selectAiExplanation = createSelector(selectListingsAi, (ai): string | null =>
  ai.mode && ai.hasSearched && ai.orderActive && ai.ranked ? ai.intent : null,
);

/** "· most relevant first" on the count line, and the page-1/page-2+ divider. */
export const selectAiRanked = createSelector(
  selectListingsAi,
  (ai): boolean => ai.mode && ai.hasSearched && ai.orderActive && ai.ranked,
);

/** How many leading cards are the ranked page 1; the divider goes before the next one. */
export const selectAiRankedCount = createSelector(selectListingsAi, (ai): number => ai.rankedIds.length);

/** Everything a page-1 request (search / re-rank) needs, read when the request actually starts. */
export const selectAiRequestContext = createSelector(
  selectListingsAi,
  selectListingsFilters,
  selectListingsPageSize,
  selectListingsOriginSource,
  (ai, filters, pageSize, originSource) => ({
    description: ai.description,
    epoch: ai.epoch,
    filters,
    pageSize,
    originSource,
  }),
);

/** Everything a page 2+ request needs (no model call server-side; filters = page-1 `appliedFilters`). */
export const selectAiNextPageContext = createSelector(
  selectListingsAi,
  selectListingItems,
  selectListingsPage,
  selectListingsPageSize,
  selectListingsHasMore,
  (ai, items, page, pageSize, hasMore) => ({
    active: ai.mode && ai.hasSearched && ai.orderActive,
    description: ai.description,
    epoch: ai.epoch,
    appliedFilters: ai.appliedFilters,
    excludeIds: items.map((i) => i.id),
    page,
    pageSize,
    hasMore,
  }),
);
