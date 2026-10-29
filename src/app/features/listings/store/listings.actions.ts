import { createAction, props } from '@ngrx/store';

import type { AiSearchResponse, AiSearchStatusResponse } from '../models/ai-search.model';
import type {
  CreateListingRequest,
  CreateListingResponse,
  ListingCategoryOption,
} from '../models/create-listing.model';
import type { ListingDetails } from '../models/listing-details.model';
import type { ListingMapPinsResult } from '../models/listing-map-pin.model';
import type { ListingPreview } from '../models/listing.model';
import type {
  ListingsFilter,
  ListingsOriginCoords,
  ListingsOriginSource,
} from '../models/listings-filter.model';
import type { MapPinsBounds } from '../models/map-pins-bounds.model';
import type { ApiErrorCode } from '../../../api/api-error.model';

export const loadListings = createAction('[Listings] Load Listings');

export const loadListingsSuccess = createAction(
  '[Listings] Load Listings Success',
  props<{
    items: ListingPreview[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  }>(),
);

export const loadListingsFailure = createAction(
  '[Listings] Load Listings Failure',
  props<{ error: string }>(),
);

export const loadNextPage = createAction('[Listings] Load Next Page');

export const updateFilters = createAction(
  '[Listings] Update Filters',
  props<{ filters: ListingsFilter }>(),
);

export const resetListings = createAction('[Listings] Reset Listings');

/**
 * Caches the renter's reference point for the session so the radius filter
 * can be honored without re-prompting. Dispatched after the browser grants
 * geolocation permission, after the visitor confirms a point in the location
 * picker (both: `RadiusOriginFilterComponent`), or — for `source: 'home'` —
 * by `ListingsEffects.defaultOriginToHomePoint$` once a signed-in user's own
 * home point is known. Never persisted. Also clears `originDenied`,
 * regardless of `source` — a successful manual pick after a geolocation
 * denial is exactly the recovery path design decision #5 describes, and a
 * home point arriving after a denial is the same recovery for free.
 *
 * Setting this does NOT cause a request to carry the coordinates: the seam
 * (`ListingsApiService.buildSharedFilterParams`) sends `originLat`/
 * `originLng` only alongside a renter-chosen `radiusKm`, and rounds them to
 * 3 dp when it does.
 */
export const setOriginCoords = createAction(
  '[Listings] Set Origin Coords',
  props<{ coords: ListingsOriginCoords; source: ListingsOriginSource }>(),
);

/**
 * Marks that a geolocation request failed/was denied while no origin is set
 * yet — drives the radius filter's soft "denied" state (design decision #5).
 * Cleared implicitly the next time `setOriginCoords` succeeds by any means.
 */
export const setOriginDenied = createAction('[Listings] Set Origin Denied');

/**
 * Unsets the renter's reference point entirely (Trello #80 — the radius
 * filter had no way to be fully cleared: `radiusKm` lives in the URL, but
 * the point lived only in this session-only slice with no reset path).
 * Dispatched by `RadiusOriginFilterComponent.clearOrigin()` BEFORE it emits
 * `originCleared`, so the parent's radius-nulling navigation and this
 * dispatch race harmlessly — either order leaves `originCoords: null`. Does
 * NOT touch `filters.radiusKm`; the parent (desktop sidebar / mobile sheet)
 * owns that commit.
 */
export const clearOrigin = createAction('[Listings] Clear Origin');

export const loadListingDetails = createAction(
  '[Listings] Load Listing Details',
  props<{ id: string }>(),
);

export const loadListingDetailsSuccess = createAction(
  '[Listings] Load Listing Details Success',
  props<{ listing: ListingDetails }>(),
);

export const loadListingDetailsFailure = createAction(
  '[Listings] Load Listing Details Failure',
  props<{ error: string }>(),
);

export const toggleFavoriteOptimistic = createAction(
  '[Listings] Toggle Favorite Optimistic',
  props<{ listingId: string }>(),
);

export const toggleFavoriteRollback = createAction(
  '[Listings] Toggle Favorite Rollback',
  props<{ listingId: string; isFavorite: boolean }>(),
);

export const loadListingCategories = createAction(
  '[Listings] Load Listing Categories',
);

export const loadListingCategoriesSuccess = createAction(
  '[Listings] Load Listing Categories Success',
  props<{ categories: ListingCategoryOption[] }>(),
);

export const loadListingCategoriesFailure = createAction(
  '[Listings] Load Listing Categories Failure',
  props<{ error: string }>(),
);

export const createListing = createAction(
  '[Listings] Create Listing',
  props<{ payload: CreateListingRequest; files: File[] }>(),
);

export const createListingSuccess = createAction(
  '[Listings] Create Listing Success',
  props<{ response: CreateListingResponse; imageUploadError: string | null }>(),
);

/**
 * `errorCode` carries the backend `ServiceError` code (via
 * `getApiErrorCode`) alongside the human-readable message, because one
 * of them is not an error to print but a state to enter: 409
 * `listing.home_point_required` means the owner has no home point, and
 * the wizard answers it by raising its home-point gate rather than by
 * showing a red banner the owner cannot act on.
 */
export const createListingFailure = createAction(
  '[Listings] Create Listing Failure',
  props<{ error: string; errorCode?: ApiErrorCode | null }>(),
);

export const setImageUploadProgress = createAction(
  '[Listings] Set Image Upload Progress',
  props<{ progress: number }>(),
);

export const retryImageUpload = createAction(
  '[Listings] Retry Image Upload',
  props<{ listingId: string; files: File[] }>(),
);

export const retryImageUploadSuccess = createAction(
  '[Listings] Retry Image Upload Success',
);

export const retryImageUploadFailure = createAction(
  '[Listings] Retry Image Upload Failure',
  props<{ error: string }>(),
);

export const clearCreateListingState = createAction(
  '[Listings] Clear Create Listing State',
);

/**
 * Maps P2-2: fetches catalog map pins for `bounds` (the current map viewport)
 * combined with the existing `ListingsState.filters`/`originCoords` — UNLESS
 * `scope: 'all'` (listing-detail maps, later increment), which fetches with
 * NO filter and NO origin regardless of what's currently in the store (see
 * `ListingsEffects.loadMapPins$`): a listing-detail page must show every
 * toy, not whatever the visitor last searched for on `/listings`. `'filtered'`
 * is today's (and the catalogue map's) only behaviour. `bounds: null` is
 * valid — the effect omits the viewport box entirely rather than sending a
 * degenerate one (mirrors `ListingsApiService.getMapPins`'s all-or-nothing
 * contract). Dispatched on every pan/zoom, so the effect must `switchMap`
 * (not `mergeMap`/`concatMap`) to cancel a stale in-flight request.
 */
export const loadMapPins = createAction(
  '[Listings] Load Map Pins',
  props<{ bounds: MapPinsBounds | null; scope: 'filtered' | 'all' }>(),
);

export const loadMapPinsSuccess = createAction(
  '[Listings] Load Map Pins Success',
  props<{ result: ListingMapPinsResult }>(),
);

export const loadMapPinsFailure = createAction(
  '[Listings] Load Map Pins Failure',
  props<{ error: string }>(),
);

// ── AI search (ADR-054) ──────────────────────────────────────────────────

/**
 * The "AI" switch, mirrored from `?ai=1`. `snapshot` (only when turning on) is the URL's
 * query params at that moment, restored when the switch goes off. Turning off clears every
 * AI result flag but keeps the description.
 */
export const setAiMode = createAction(
  '[Listings] Set AI Mode',
  props<{ on: boolean; snapshot?: Record<string, string> }>(),
);

export const setAiDescription = createAction(
  '[Listings] Set AI Description',
  props<{ description: string }>(),
);

export const markAiExampleSeen = createAction('[Listings] Mark AI Example Seen');

/** Run the description through the AI endpoint (filters: null → the server parses it). */
export const submitAiSearch = createAction(
  '[Listings] Submit AI Search',
  props<{ description: string }>(),
);

/**
 * A filter/chip changed while AI results are showing. Items stay (dimmed); the effect
 * re-ranks after 400 ms with the same description and the edited filters (no re-parse).
 */
export const aiFiltersChanged = createAction(
  '[Listings] AI Filters Changed',
  props<{ filters: ListingsFilter }>(),
);

/** Sort switched back to "Most relevant first": re-rank at once, no debounce. */
export const aiRerank = createAction('[Listings] AI Rerank');

/** Another sort was chosen: the AI order is dropped and the ordinary catalogue loads. */
export const dropAiOrder = createAction('[Listings] Drop AI Order');

export const aiSearchSuccess = createAction(
  '[Listings] AI Search Success',
  props<{ kind: 'search' | 'rerank' | 'page'; response: AiSearchResponse; epoch: number }>(),
);

export const aiSearchFailure = createAction(
  '[Listings] AI Search Failure',
  props<{ error: string; errorCode: ApiErrorCode | null; epoch: number }>(),
);

export const loadAiStatus = createAction('[Listings] Load AI Status');

export const loadAiStatusSuccess = createAction(
  '[Listings] Load AI Status Success',
  props<{ status: AiSearchStatusResponse }>(),
);

export const loadAiStatusFailure = createAction('[Listings] Load AI Status Failure');
