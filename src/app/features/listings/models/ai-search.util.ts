import type { AiSearchAgeGroup, AiSearchFilters } from './ai-search.model';
import { AGE_GROUPS } from './age-groups.const';
import {
  clampRadiusKm,
  serializeDistrictIdsParam,
  serializeRadiusKmParam,
  type ListingsFilter,
  type ListingsOriginSource,
} from './listings-filter.model';

/** "From your home" default radius when the AI says "near me" without a number. */
export const AI_DEFAULT_NEAR_HOME_RADIUS_KM = 1;

function toAiAgeGroup(value: string | null): AiSearchAgeGroup | null {
  return AGE_GROUPS.some((g) => g.value === value) ? (value as AiSearchAgeGroup) : null;
}

/**
 * The catalogue filters as the AI endpoint takes them (re-rank / page 2+).
 * `AiSearchFilters` has no `minPrice` and no arbitrary origin, so only a radius
 * measured from the user's HOME is expressible (`nearHome`) — see ADR-054.
 */
export function toAiSearchFilters(
  filters: ListingsFilter,
  originSource: ListingsOriginSource | null,
): AiSearchFilters {
  const nearHome = filters.radiusKm != null && originSource === 'home';
  return {
    categoryId: filters.categoryId,
    ageGroup: toAiAgeGroup(filters.ageGroup),
    maxPrice: filters.maxPrice,
    districtIds: filters.districtIds.length > 0 ? [...filters.districtIds] : null,
    nearHome,
    radiusKm: nearHome ? clampRadiusKm(filters.radiusKm as number) : null,
  };
}

/**
 * Inverse: what the server actually applied becomes the page's filters, so the
 * existing controls, chips and badge show it. `appliedFilters` is the truth —
 * `minPrice`/`query`/`city` are not part of it and are cleared.
 */
export function fromAiSearchFilters(applied: AiSearchFilters): ListingsFilter {
  return {
    query: null,
    city: null,
    categoryId: applied.categoryId,
    minPrice: null,
    maxPrice: applied.maxPrice,
    ageGroup: applied.ageGroup,
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
    categoryId: filters.categoryId,
    ageGroup: filters.ageGroup,
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
