import type { ListingPreview } from './listing.model';

/**
 * AI search contract (ADR-054) — mirrors rental-api `AiSearchRequest`, `AiSearchFilters`,
 * `AiSearchResponse`, `AiSearchStatusResponse` (camelCase on the wire). Endpoints:
 * `ApiContract.listings.aiSearch` (POST, [Authorize], 5/min/user) and
 * `ApiContract.listings.aiSearchStatus` (GET, anonymous).
 */

/** The catalogue age-group tokens; same values as the listings page `AGE_GROUPS`. */
export type AiSearchAgeGroup = '0-12' | '12-36' | '36-72' | '72-120' | '120+';

export interface AiSearchFilters {
  categoryId: string | null;
  ageGroup: AiSearchAgeGroup | null;
  maxPrice: number | null;
  districtIds: string[] | null;
  /** "Near me": the server resolves the signed-in user's home point; no coordinates here. */
  nearHome: boolean;
  radiusKm: number | null;
}

export interface AiSearchRequest {
  /** 1-500 characters, any of hy/ru/en/translit. */
  description: string;
  /** null on the first search (server parses the description); non-null for re-rank / page 2+. */
  filters: AiSearchFilters | null;
  page: number;
  pageSize: number;
  /** Page 2+: ids already shown. */
  excludeIds: string[] | null;
}

export interface AiSearchResponse {
  items: ListingPreview[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  /** Never null. */
  appliedFilters: AiSearchFilters;
  /** True only for page 1 when ranking succeeded. */
  ranked: boolean;
  /** One line in the UI language; null when AI is unavailable or the order is not ranked. */
  intent: string | null;
  /** Neighbouring districts added by auto-widening. Never null. */
  widenedDistrictIds: string[];
  purposeWidened: boolean;
  datesMentioned: boolean;
  locationNotConsidered: boolean;
  /** True: the result is a plain text search on the description. */
  aiUnavailable: boolean;
}

export interface AiSearchStatusResponse {
  available: boolean;
}
