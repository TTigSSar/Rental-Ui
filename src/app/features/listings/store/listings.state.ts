import type { ApiErrorCode } from '../../../api/api-error.model';
import type { AiSearchFilters, AiSearchStatusResponse } from '../models/ai-search.model';
import type { ListingDetails } from '../models/listing-details.model';
import type { ListingCategoryOption } from '../models/create-listing.model';
import type { ListingMapPin } from '../models/listing-map-pin.model';
import type { ListingPreview } from '../models/listing.model';
import type {
  ListingsFilter,
  ListingsOriginCoords,
  ListingsOriginSource,
} from '../models/listings-filter.model';

/** `searching`: first search / sort back to relevance; `reranking`: a filter change re-orders the same description. */
export type ListingsAiBusy = 'idle' | 'searching' | 'reranking';

/**
 * AI search slice (ADR-054). The results themselves reuse `ListingsState.items/page/hasMore`;
 * the AI-set filter values are written into `ListingsState.filters` (so the existing controls,
 * chips and badge show them). The URL carries only `ai=1` for this feature.
 */
export interface ListingsAiState {
  /** The "AI" switch. Mirrors `?ai=1`. */
  mode: boolean;
  /** Kept separately and NEVER written to `filters.query`; survives switching off. */
  description: string;
  /** The description of the last SUBMITTED search: re-rank and paging use it, not the textarea text. */
  submittedDescription: string;
  /** A search has produced the current results. */
  hasSearched: boolean;
  /** The results are in AI order ("Most relevant first"); false once another sort is chosen. */
  orderActive: boolean;
  busy: ListingsAiBusy;
  ranked: boolean;
  /** Kept through re-ranks (a re-rank returns `intent: null`). */
  intent: string | null;
  widenedDistrictIds: string[];
  purposeWidened: boolean;
  datesMentioned: boolean;
  locationNotConsidered: boolean;
  /**
   * The last search fell back to the ordinary catalogue (`aiUnavailable`). The switch has been
   * turned off, but the info notice stays until the next search is submitted.
   */
  fallbackNotice: boolean;
  /** Page-1 ids in ranked order (empty when not ranked). Drives the "More listings" divider. */
  rankedIds: string[];
  /** The last page-1 `appliedFilters`; sent back as `filters` for page 2+. */
  appliedFilters: AiSearchFilters | null;
  /** Bumped by every state change that invalidates an in-flight request. */
  epoch: number;
  /** Daily-budget state, loaded on page init. `null` until known. */
  aiStatus: AiSearchStatusResponse | null;
  error: string | null;
  errorCode: ApiErrorCode | null;
  /** The first-use example has been shown/used (session-only). */
  exampleSeen: boolean;
  /** URL query params at the moment the switch was turned on — restored on switch-off. */
  snapshot: Record<string, string> | null;
}

export const initialListingsAiState: ListingsAiState = {
  mode: false,
  description: '',
  submittedDescription: '',
  hasSearched: false,
  orderActive: false,
  busy: 'idle',
  ranked: false,
  intent: null,
  widenedDistrictIds: [],
  purposeWidened: false,
  datesMentioned: false,
  locationNotConsidered: false,
  fallbackNotice: false,
  rankedIds: [],
  appliedFilters: null,
  epoch: 0,
  aiStatus: null,
  error: null,
  errorCode: null,
  exampleSeen: false,
  snapshot: null,
};

export interface ListingsState {
  items: ListingPreview[];
  selectedListing: ListingDetails | null;
  filters: ListingsFilter;
  /**
   * Renter's device position, cached for the session once granted (see
   * `RadiusOriginFilterComponent`). Not part of `filters` on purpose — it
   * must never round-trip through the URL/query params (Maps P2-3).
   */
  originCoords: ListingsOriginCoords | null;
  /** How `originCoords` was obtained — drives the radius filter's origin-summary
   *  copy ("From your location" vs "From the chosen point"). Session-only,
   *  same treatment as `originCoords` itself. `null` iff `originCoords` is. */
  originSource: ListingsOriginSource | null;
  /**
   * `true` after a geolocation request has failed/been denied AND no origin
   * is currently set — drives the radius filter's "denied" state (a soft
   * message + "pick a point on the map" fallback, never a red error; design
   * decision #5). Cleared the moment `originCoords` is set by any means.
   * Session-only, never persisted.
   */
  originDenied: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  isDetailsLoading: boolean;
  categories: ListingCategoryOption[];
  categoriesLoading: boolean;
  createListingLoading: boolean;
  createListingError: string | null;
  /** The `ServiceError` code behind `createListingError`, when there was
   *  one. `listing.home_point_required` is the one the create page
   *  branches on — see `createListingFailure`. */
  createListingErrorCode: ApiErrorCode | null;
  createListingSuccessId: string | null;
  createListingImageUploadError: string | null;
  createListingImageUploadProgress: number | null;
  error: string | null;
  /** Maps P2-2: catalog map view pins for the current viewport + filters. */
  mapPins: ListingMapPin[];
  mapPinsLoading: boolean;
  mapPinsError: string | null;
  /** `true` when the backend cut the pin result off at its cap — drives a
   *  "zoom in to see all pins" prompt rather than silently under-representing
   *  the viewport's listings. */
  mapPinsTruncated: boolean;
  ai: ListingsAiState;
}

export const initialListingsState: ListingsState = {
  items: [],
  selectedListing: null,
  filters: {
    query: null,
    city: null,
    categoryId: null,
    minPrice: null,
    maxPrice: null,
    ageGroup: null,
    radiusKm: null,
    districtIds: [],
  },
  originCoords: null,
  originSource: null,
  originDenied: false,
  page: 1,
  pageSize: 20,
  hasMore: false,
  isLoading: false,
  isDetailsLoading: false,
  categories: [],
  categoriesLoading: false,
  createListingLoading: false,
  createListingError: null,
  createListingErrorCode: null,
  createListingSuccessId: null,
  createListingImageUploadError: null,
  createListingImageUploadProgress: null,
  error: null,
  mapPins: [],
  mapPinsLoading: false,
  mapPinsError: null,
  mapPinsTruncated: false,
  ai: initialListingsAiState,
};
