import type { AiSearchFilters } from './ai-search.model';
import {
  ageGroupToRangeParam,
  LISTINGS_FILTER_LIMITS,
  parseAgeGroupToMonths,
  clampRadiusKm,
  serializeDistrictIdsParam,
  serializeListParam,
  serializeRadiusKmParam,
  serializeSortParam,
  type ListingAgeRangeParam,
  type ListingsFilter,
  type ListingsOriginSource,
} from './listings-filter.model';

/** "From your home" default radius when the AI says "near me" without a number. */
export const AI_DEFAULT_NEAR_HOME_RADIUS_KM = 1;

/**
 * The catalogue filters as the AI endpoint takes them (re-rank / page 2+). ADR-054 amendment
 * (ADR-066 lists): the multi-select lists go out whole (`categoryIds`, `ageRanges`, `conditions`);
 * the legacy single `categoryId` / `ageGroup` stay null (the server merges them, so sending both
 * would double-count). `AiSearchFilters` has no `minPrice` and no arbitrary origin, so only a
 * radius measured from the user's HOME is expressible (`nearHome`).
 */
export function toAiSearchFilters(
  filters: ListingsFilter,
  originSource: ListingsOriginSource | null,
): AiSearchFilters {
  const nearHome = filters.radiusKm != null && originSource === 'home';
  const ageRanges = filters.ageGroups
    .map((token) => ageGroupToRangeParam(token))
    .filter((r): r is ListingAgeRangeParam => r !== null);
  return {
    categoryId: null,
    ageGroup: null,
    categoryIds: filters.categoryIds.length > 0 ? [...filters.categoryIds] : null,
    ageRanges: ageRanges.length > 0 ? ageRanges : null,
    conditions: filters.conditions.length > 0 ? [...filters.conditions] : null,
    maxPrice: filters.maxPrice,
    districtIds: filters.districtIds.length > 0 ? [...filters.districtIds] : null,
    nearHome,
    radiusKm: nearHome ? clampRadiusKm(filters.radiusKm as number) : null,
  };
}

/** `"120-"` (wire) -> `"120+"` (the UI token); a bounded range keeps its text. Null when not a range. */
function rangeToAgeGroupToken(range: string): string | null {
  const token = range.endsWith('-') ? `${range.slice(0, -1)}+` : range;
  return parseAgeGroupToMonths(token) ? token : null;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * Inverse: what the server actually applied becomes the page's filters, so the
 * existing controls, chips and badge show it. `appliedFilters` is the truth —
 * `minPrice`/`query`/`city` are not part of it and are cleared. The lists win; the legacy single
 * values are merged in (deduped). An age range outside the five `AGE_GROUPS` stays as its own
 * token, so the chip shows exactly what was applied; an unparseable one is dropped.
 */
export function fromAiSearchFilters(applied: AiSearchFilters): ListingsFilter {
  const categoryIds = unique([
    ...(applied.categoryIds ?? []),
    ...(applied.categoryId ? [applied.categoryId] : []),
  ]).slice(0, LISTINGS_FILTER_LIMITS.categoryIds);
  const ageGroups = unique([
    ...(applied.ageRanges ?? [])
      .map((r) => rangeToAgeGroupToken(r))
      .filter((t): t is string => t !== null),
    ...(applied.ageGroup ? [applied.ageGroup] : []),
  ]).slice(0, LISTINGS_FILTER_LIMITS.ageRanges);
  return {
    query: null,
    city: null,
    categoryIds,
    minPrice: null,
    maxPrice: applied.maxPrice,
    ageGroups,
    conditions: unique(applied.conditions ?? []),
    sort: 'newest',
    radiusKm: applied.nearHome
      ? clampRadiusKm(applied.radiusKm ?? AI_DEFAULT_NEAR_HOME_RADIUS_KM)
      : null,
    districtIds: applied.districtIds ? [...applied.districtIds] : [],
  };
}

/** Query params for a filter set; `null` clears the key under `queryParamsHandling: 'merge'`. */
export function filtersToQueryParams(filters: ListingsFilter): Record<string, string | null> {
  return {
    q: filters.query,
    city: filters.city,
    // The legacy single-value keys are always cleared so an old link's `categoryId`/`ageGroup`
    // cannot linger next to (and contradict) the new lists.
    categoryId: null,
    categoryIds: serializeListParam(filters.categoryIds),
    ageGroup: null,
    ageGroups: serializeListParam(filters.ageGroups),
    conditions: serializeListParam(filters.conditions),
    sort: serializeSortParam(filters.sort),
    minPrice: filters.minPrice != null ? String(filters.minPrice) : null,
    maxPrice: filters.maxPrice != null ? String(filters.maxPrice) : null,
    radiusKm: serializeRadiusKmParam(filters.radiusKm),
    districtIds: serializeDistrictIdsParam(filters.districtIds),
  };
}

/** Value equality of two filter sets, tolerant of `''` vs `null` and of key order in nothing but ids. */
export function sameFilters(a: ListingsFilter, b: ListingsFilter): boolean {
  const q = filtersToQueryParams(a);
  const r = filtersToQueryParams(b);
  return Object.keys(q).every((k) => (q[k] || null) === (r[k] || null));
}
