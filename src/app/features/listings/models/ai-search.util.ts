import type { AiSearchAgeGroup, AiSearchFilters } from './ai-search.model';
import { AGE_GROUPS } from './age-groups.const';
import {
  clampRadiusKm,
  serializeDistrictIdsParam,
  serializeListParam,
  serializeRadiusKmParam,
  serializeSortParam,
  type ListingsFilter,
  type ListingsOriginSource,
} from './listings-filter.model';

/** "From your home" default radius when the AI says "near me" without a number. */
export const AI_DEFAULT_NEAR_HOME_RADIUS_KM = 1;

/** The AI endpoint takes ONE age group: the first selected token it knows. */
function toAiAgeGroup(values: readonly string[]): AiSearchAgeGroup | null {
  const match = values.find((v) => AGE_GROUPS.some((g) => g.value === v));
  return match ? (match as AiSearchAgeGroup) : null;
}

/**
 * The catalogue filters as the AI endpoint takes them (re-rank / page 2+).
 * `AiSearchFilters` has no `minPrice` and no arbitrary origin, so only a radius
 * measured from the user's HOME is expressible (`nearHome`) — see ADR-054. The endpoint also
 * takes a single category and age group, and has no conditions: with several selected only the
 * first category / first known age group goes out, and conditions are not sent.
 */
export function toAiSearchFilters(
  filters: ListingsFilter,
  originSource: ListingsOriginSource | null,
): AiSearchFilters {
  const nearHome = filters.radiusKm != null && originSource === 'home';
  return {
    categoryId: filters.categoryIds[0] ?? null,
    ageGroup: toAiAgeGroup(filters.ageGroups),
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
    categoryIds: applied.categoryId ? [applied.categoryId] : [],
    minPrice: null,
    maxPrice: applied.maxPrice,
    ageGroups: applied.ageGroup ? [applied.ageGroup] : [],
    conditions: [],
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
