import { createReducer, on } from '@ngrx/store';

import * as FavoritesActions from '../../favorites/store/favorites.actions';
import type { ListingDetails } from '../models/listing-details.model';
import type { ListingPreview } from '../models/listing.model';
import * as ListingsActions from './listings.actions';
import { fromAiSearchFilters } from '../models/ai-search.util';
import {
  initialListingsAiState,
  initialListingsState,
  type ListingsAiState,
  type ListingsState,
} from './listings.state';

export const listingsFeatureKey = 'listings' as const;

function toggleFavoriteOnDetails(
  listing: ListingDetails | null,
  listingId: string,
): ListingDetails | null {
  if (listing === null || listing.id !== listingId) {
    return listing;
  }
  return { ...listing, isFavorite: !listing.isFavorite };
}

function setFavoriteOnDetails(
  listing: ListingDetails | null,
  listingId: string,
  isFavorite: boolean,
): ListingDetails | null {
  if (listing === null || listing.id !== listingId) {
    return listing;
  }
  return { ...listing, isFavorite };
}

function mapItemsToggleFavorite(
  items: ListingPreview[],
  listingId: string,
): ListingPreview[] {
  return items.map((item) =>
    item.id === listingId ? { ...item, isFavorite: !item.isFavorite } : item,
  );
}

function mapItemsSetFavorite(
  items: ListingPreview[],
  listingId: string,
  isFavorite: boolean,
): ListingPreview[] {
  return items.map((item) =>
    item.id === listingId ? { ...item, isFavorite } : item,
  );
}

function withAi(state: ListingsState, patch: Partial<ListingsAiState>): ListingsState {
  return { ...state, ai: { ...state.ai, ...patch } };
}

export const listingsReducer = createReducer(
  initialListingsState,
  on(
    ListingsActions.loadListings,
    (state): ListingsState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadNextPage,
    (state): ListingsState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingsSuccess,
    (state, { items, page, pageSize, hasMore }): ListingsState => ({
      ...state,
      items: page <= 1 ? [...items] : [...state.items, ...items],
      page,
      pageSize,
      hasMore,
      isLoading: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingsFailure,
    (state, { error }): ListingsState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
  on(
    ListingsActions.updateFilters,
    (state, { filters }): ListingsState => ({
      ...state,
      filters: { ...filters },
      page: 1,
      items: [],
      hasMore: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.resetListings,
    (): ListingsState => ({
      ...initialListingsState,
      filters: { ...initialListingsState.filters },
    }),
  ),
  on(
    ListingsActions.setOriginCoords,
    (state, { coords, source }): ListingsState => ({
      ...state,
      originCoords: coords,
      originSource: source,
      originDenied: false,
    }),
  ),
  on(
    ListingsActions.setOriginDenied,
    (state): ListingsState => ({
      ...state,
      originDenied: true,
    }),
  ),
  on(
    ListingsActions.clearOrigin,
    (state): ListingsState => ({
      ...state,
      originCoords: null,
      originSource: null,
      originDenied: false,
    }),
  ),
  on(
    ListingsActions.loadListingDetails,
    (state): ListingsState => ({
      ...state,
      isDetailsLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingDetailsSuccess,
    (state, { listing }): ListingsState => ({
      ...state,
      selectedListing: listing,
      isDetailsLoading: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingDetailsFailure,
    (state, { error }): ListingsState => ({
      ...state,
      isDetailsLoading: false,
      error,
    }),
  ),
  on(
    ListingsActions.toggleFavoriteOptimistic,
    (state, { listingId }): ListingsState => ({
      ...state,
      items: mapItemsToggleFavorite(state.items, listingId),
      selectedListing: toggleFavoriteOnDetails(state.selectedListing, listingId),
    }),
  ),
  on(
    ListingsActions.toggleFavoriteRollback,
    (state, { listingId, isFavorite }): ListingsState => ({
      ...state,
      items: mapItemsSetFavorite(state.items, listingId, isFavorite),
      selectedListing: setFavoriteOnDetails(
        state.selectedListing,
        listingId,
        isFavorite,
      ),
    }),
  ),
  on(
    ListingsActions.loadListingCategories,
    (state): ListingsState => ({
      ...state,
      categoriesLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingCategoriesSuccess,
    (state, { categories }): ListingsState => ({
      ...state,
      categories: [...categories],
      categoriesLoading: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingCategoriesFailure,
    (state, { error }): ListingsState => ({
      ...state,
      categoriesLoading: false,
      error,
    }),
  ),
  on(
    ListingsActions.createListing,
    (state): ListingsState => ({
      ...state,
      createListingLoading: true,
      createListingError: null,
      // Reset with the error: the 409 phone-required step is edge-triggered on this
      // code, so a stale one would swallow the next refusal (ADR-030 §8).
      createListingErrorCode: null,
      createListingSuccessId: null,
      createListingImageUploadError: null,
      createListingImageUploadProgress: null,
    }),
  ),
  on(
    ListingsActions.createListingSuccess,
    (state, { response, imageUploadError }): ListingsState => ({
      ...state,
      createListingLoading: false,
      createListingError: null,
      createListingErrorCode: null,
      createListingSuccessId: response.id,
      createListingImageUploadError: imageUploadError,
      createListingImageUploadProgress: null,
    }),
  ),
  on(
    ListingsActions.createListingFailure,
    (state, { error, errorCode }): ListingsState => ({
      ...state,
      createListingLoading: false,
      createListingError: error,
      createListingErrorCode: errorCode ?? null,
      createListingSuccessId: null,
      createListingImageUploadError: null,
      createListingImageUploadProgress: null,
    }),
  ),
  on(
    ListingsActions.setImageUploadProgress,
    (state, { progress }): ListingsState => ({
      ...state,
      createListingImageUploadProgress: progress,
    }),
  ),
  on(
    ListingsActions.retryImageUpload,
    (state): ListingsState => ({
      ...state,
      createListingImageUploadError: null,
      createListingImageUploadProgress: 0,
    }),
  ),
  on(
    ListingsActions.retryImageUploadSuccess,
    (state): ListingsState => ({
      ...state,
      createListingImageUploadError: null,
      createListingImageUploadProgress: null,
    }),
  ),
  on(
    ListingsActions.retryImageUploadFailure,
    (state, { error }): ListingsState => ({
      ...state,
      createListingImageUploadError: error,
      createListingImageUploadProgress: null,
    }),
  ),
  on(
    ListingsActions.clearCreateListingState,
    (state): ListingsState => ({
      ...state,
      createListingLoading: false,
      createListingError: null,
      createListingErrorCode: null,
      createListingSuccessId: null,
      createListingImageUploadError: null,
      createListingImageUploadProgress: null,
    }),
  ),
  on(
    FavoritesActions.removeFavoriteOptimistic,
    (state, { listingId }): ListingsState => ({
      ...state,
      items: mapItemsSetFavorite(state.items, listingId, false),
      selectedListing: setFavoriteOnDetails(state.selectedListing, listingId, false),
    }),
  ),
  on(
    FavoritesActions.removeFavoriteFailure,
    (state, { listingId }): ListingsState => ({
      ...state,
      items: mapItemsSetFavorite(state.items, listingId, true),
      selectedListing: setFavoriteOnDetails(state.selectedListing, listingId, true),
    }),
  ),
  on(
    ListingsActions.loadMapPins,
    (state): ListingsState => ({
      ...state,
      mapPinsLoading: true,
      mapPinsError: null,
    }),
  ),
  on(
    ListingsActions.loadMapPinsSuccess,
    (state, { result }): ListingsState => ({
      ...state,
      mapPins: [...result.items],
      mapPinsTruncated: result.isTruncated,
      mapPinsLoading: false,
      mapPinsError: null,
    }),
  ),
  on(
    ListingsActions.loadMapPinsFailure,
    (state, { error }): ListingsState => ({
      ...state,
      mapPinsLoading: false,
      mapPinsError: error,
    }),
  ),
  on(ListingsActions.setAiMode, (state, { on, snapshot }): ListingsState => {
    if (on) {
      // Idempotent: the page re-dispatches this on every query-param emission.
      return state.ai.mode ? state : withAi(state, { mode: true, snapshot: snapshot ?? null });
    }
    if (!state.ai.mode) {
      return state;
    }
    return withAi(state, {
      ...initialListingsAiState,
      // Kept across a switch-off: the description (returns when switched on again),
      // the budget status and the first-use example flag.
      description: state.ai.description,
      aiStatus: state.ai.aiStatus,
      exampleSeen: true,
      epoch: state.ai.epoch + 1,
    });
  }),
  on(ListingsActions.setAiDescription, (state, { description }): ListingsState =>
    withAi(state, { description }),
  ),
  on(ListingsActions.markAiExampleSeen, (state): ListingsState =>
    state.ai.exampleSeen ? state : withAi(state, { exampleSeen: true }),
  ),
  on(ListingsActions.submitAiSearch, (state, { description }): ListingsState =>
    withAi(state, {
      description,
      busy: 'searching',
      error: null,
      errorCode: null,
      fallbackNotice: false,
      exampleSeen: true,
      epoch: state.ai.epoch + 1,
    }),
  ),
  on(ListingsActions.aiFiltersChanged, (state, { filters }): ListingsState => ({
    ...withAi(state, { busy: 'reranking', error: null, errorCode: null, epoch: state.ai.epoch + 1 }),
    filters: { ...filters },
  })),
  on(ListingsActions.aiRerank, (state): ListingsState =>
    withAi(state, {
      orderActive: true,
      busy: 'reranking',
      error: null,
      errorCode: null,
      epoch: state.ai.epoch + 1,
    }),
  ),
  on(ListingsActions.dropAiOrder, (state): ListingsState => ({
    ...withAi(state, {
      orderActive: false,
      busy: 'idle',
      ranked: false,
      rankedIds: [],
      error: null,
      errorCode: null,
      epoch: state.ai.epoch + 1,
    }),
    items: [],
    page: 1,
    hasMore: false,
  })),
  on(ListingsActions.aiSearchSuccess, (state, { kind, response, epoch }): ListingsState => {
    if (epoch !== state.ai.epoch) {
      return state; // superseded: switch off, drop-order, or a newer request
    }
    if (kind === 'page') {
      const known = new Set(state.items.map((i) => i.id));
      return {
        ...state,
        items: [...state.items, ...response.items.filter((i) => !known.has(i.id))],
        page: response.page,
        pageSize: response.pageSize,
        hasMore: response.hasMore,
        isLoading: false,
        error: null,
      };
    }
    if (response.aiUnavailable) {
      // AI could not run: the response is a plain catalogue text search on the description.
      // The switch goes OFF (it stays enabled), the description is kept for the next attempt and
      // the info notice stays; the effect mirrors the text into `q` so the ordinary catalogue
      // continues from there.
      return {
        ...state,
        items: [...response.items],
        page: response.page,
        pageSize: response.pageSize,
        hasMore: response.hasMore,
        isLoading: false,
        error: null,
        filters: { ...fromAiSearchFilters(response.appliedFilters), query: state.ai.description.trim() || null },
        ai: {
          ...initialListingsAiState,
          description: state.ai.description,
          aiStatus: state.ai.aiStatus,
          exampleSeen: true,
          epoch: state.ai.epoch + 1,
          fallbackNotice: true,
        },
      };
    }
    return {
      ...state,
      items: [...response.items],
      page: response.page,
      pageSize: response.pageSize,
      hasMore: response.hasMore,
      isLoading: false,
      error: null,
      filters: fromAiSearchFilters(response.appliedFilters),
      ai: {
        ...state.ai,
        hasSearched: true,
        orderActive: true,
        busy: 'idle',
        ranked: response.ranked,
        intent: response.intent ?? (kind === 'rerank' ? state.ai.intent : null),
        widenedDistrictIds: [...response.widenedDistrictIds],
        purposeWidened: response.purposeWidened,
        // A re-rank does not re-read the description, so the server reports no dates then:
        // the note stays as long as the description does.
        datesMentioned: response.datesMentioned || (kind === 'rerank' && state.ai.datesMentioned),
        locationNotConsidered: response.locationNotConsidered,
        fallbackNotice: false,
        rankedIds: response.ranked ? response.items.map((i) => i.id) : [],
        appliedFilters: response.appliedFilters,
        error: null,
        errorCode: null,
      },
    };
  }),
  on(ListingsActions.aiSearchFailure, (state, { error, errorCode, epoch }): ListingsState => {
    if (epoch !== state.ai.epoch) {
      return state;
    }
    return { ...withAi(state, { busy: 'idle', error, errorCode }), isLoading: false };
  }),
  on(ListingsActions.loadAiStatusSuccess, (state, { status }): ListingsState =>
    withAi(state, { aiStatus: status }),
  ),
  on(ListingsActions.loadAiStatusFailure, (state): ListingsState =>
    withAi(state, { aiStatus: null }),
  ),
);
