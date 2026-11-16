/**
 * `GET /api/listings/facets` response (backend: `ListingFacetsResponse`, ADR-066).
 * [AllowAnonymous]. Takes the same filter params as `GET /api/listings` EXCEPT
 * `sort`, paging and bbox — never send those. Arrays are never null; zero-count
 * entries are omitted by the server.
 */
export interface ListingFacetCategoryCount {
  categoryId: string;
  count: number;
}

export interface ListingFacetDistrictCount {
  districtId: string;
  count: number;
}

export interface ListingFacets {
  categories: ListingFacetCategoryCount[];
  districts: ListingFacetDistrictCount[];
  /** null when no listing matches the filter. */
  minPricePerDay: number | null;
  maxPricePerDay: number | null;
}
