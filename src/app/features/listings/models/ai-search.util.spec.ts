import type { AiSearchFilters } from './ai-search.model';
import {
  filtersToQueryParams,
  fromAiSearchFilters,
  sameFilters,
  toAiSearchFilters,
} from './ai-search.util';
import type { ListingsFilter } from './listings-filter.model';

const EMPTY: ListingsFilter = {
  query: null,
  city: null,
  categoryIds: [],
  minPrice: null,
  maxPrice: null,
  ageGroups: [],
  conditions: [],
  sort: 'newest',
  radiusKm: null,
  districtIds: [],
};

const APPLIED: AiSearchFilters = {
  categoryId: 'cat-1',
  ageGroup: '36-72',
  categoryIds: null,
  ageRanges: null,
  conditions: null,
  maxPrice: 3000,
  districtIds: ['d-1', 'd-2'],
  nearHome: false,
  radiusKm: null,
};

describe('fromAiSearchFilters', () => {
  it('turns what the server applied into the page filters', () => {
    expect(fromAiSearchFilters(APPLIED)).toEqual({
      ...EMPTY,
      categoryIds: ['cat-1'],
      ageGroups: ['36-72'],
      maxPrice: 3000,
      districtIds: ['d-1', 'd-2'],
    });
  });

  it('maps nearHome onto the "From your home" radius (default 1 km)', () => {
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: null }).radiusKm).toBe(1);
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: 2.5 }).radiusKm).toBe(2.5);
  });

  it('clamps the radius to the backend range and ignores radiusKm without nearHome', () => {
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: 0.05 }).radiusKm).toBe(0.2);
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: false, radiusKm: 3 }).radiusKm).toBeNull();
  });

  it('maps null districtIds to an empty list', () => {
    expect(fromAiSearchFilters({ ...APPLIED, districtIds: null }).districtIds).toEqual([]);
  });
});

describe('fromAiSearchFilters - ADR-066 lists', () => {
  it('reads the lists first and merges the legacy singles without duplicates', () => {
    const f = fromAiSearchFilters({
      ...APPLIED,
      categoryId: 'cat-1',
      categoryIds: ['cat-1', 'cat-2'],
      ageGroup: '36-72',
      ageRanges: ['36-72', '120-'],
      conditions: ['New', 'Good'],
    });
    expect(f.categoryIds).toEqual(['cat-1', 'cat-2']);
    expect(f.ageGroups).toEqual(['36-72', '120+']);
    expect(f.conditions).toEqual(['New', 'Good']);
  });

  it('keeps an age range outside the five groups as its own token, so the chip is honest', () => {
    expect(fromAiSearchFilters({ ...APPLIED, ageGroup: null, ageRanges: ['6-18'] }).ageGroups).toEqual(['6-18']);
  });

  it('drops an unparseable age range (no chip, nothing to apply)', () => {
    expect(fromAiSearchFilters({ ...APPLIED, ageGroup: null, ageRanges: ['x-y' as never] }).ageGroups).toEqual([]);
  });
});

describe('toAiSearchFilters', () => {
  it('sends the user-edited filters back; empty districts become null', () => {
    expect(toAiSearchFilters(EMPTY, null)).toEqual({
      categoryId: null,
      ageGroup: null,
      categoryIds: null,
      ageRanges: null,
      conditions: null,
      maxPrice: null,
      districtIds: null,
      nearHome: false,
      radiusKm: null,
    });
  });

  it('expresses a radius as nearHome only when it is measured from the home point', () => {
    const f = { ...EMPTY, radiusKm: 2 };
    expect(toAiSearchFilters(f, 'home')).toMatchObject({ nearHome: true, radiusKm: 2 });
    expect(toAiSearchFilters(f, 'geo')).toMatchObject({ nearHome: false, radiusKm: null });
    expect(toAiSearchFilters(f, null)).toMatchObject({ nearHome: false, radiusKm: null });
  });

  it('sends every category, age range and condition as lists, never the legacy singles', () => {
    const f: ListingsFilter = {
      ...EMPTY,
      categoryIds: ['c1', 'c2'],
      ageGroups: ['12-36', '120+'],
      conditions: ['New', 'Fair'],
    };
    expect(toAiSearchFilters(f, null)).toMatchObject({
      categoryId: null,
      ageGroup: null,
      categoryIds: ['c1', 'c2'],
      ageRanges: ['12-36', '120-'],
      conditions: ['New', 'Fair'],
    });
  });

  it('does not send an age token that is not a range', () => {
    expect(toAiSearchFilters({ ...EMPTY, ageGroups: ['teen'] }, null).ageRanges).toBeNull();
  });

  it('round-trips with fromAiSearchFilters', () => {
    const filters = fromAiSearchFilters({
      ...APPLIED,
      nearHome: true,
      radiusKm: 1,
      conditions: ['Good'],
      categoryIds: ['cat-1', 'cat-9'],
    });
    expect(fromAiSearchFilters(toAiSearchFilters(filters, 'home'))).toEqual(filters);
  });
});

describe('filtersToQueryParams / sameFilters', () => {
  it('serialises every filter key, with null for the empty ones', () => {
    expect(filtersToQueryParams({ ...EMPTY, maxPrice: 3000, districtIds: ['a', 'b'] })).toEqual({
      q: null,
      city: null,
      categoryId: null,
      categoryIds: null,
      ageGroup: null,
      ageGroups: null,
      conditions: null,
      sort: null,
      minPrice: null,
      maxPrice: '3000',
      radiusKm: null,
      districtIds: 'a,b',
    });
  });

  it('writes the ADR-066 lists comma-joined, never the default sort, and always clears the legacy keys', () => {
    const params = filtersToQueryParams({
      ...EMPTY,
      categoryIds: ['c1', 'c2'],
      ageGroups: ['0-12', '120+'],
      conditions: ['New', 'Fair'],
      sort: 'price_asc',
    });
    expect(params).toMatchObject({
      categoryIds: 'c1,c2',
      ageGroups: '0-12,120+',
      conditions: 'New,Fair',
      sort: 'price_asc',
      // null = removed under `queryParamsHandling: 'merge'`, so an old ?categoryId= link cannot linger.
      categoryId: null,
      ageGroup: null,
    });
    expect(filtersToQueryParams({ ...EMPTY, sort: 'newest' })['sort']).toBeNull();
  });

  it('sameFilters notices a changed condition or sort', () => {
    expect(sameFilters(EMPTY, { ...EMPTY, conditions: ['Good'] })).toBe(false);
    expect(sameFilters(EMPTY, { ...EMPTY, sort: 'rating_desc' })).toBe(false);
  });

  it('treats null and empty string as the same value', () => {
    expect(sameFilters(EMPTY, { ...EMPTY, ageGroups: [] })).toBe(true);
  });

  it('detects a real difference', () => {
    expect(sameFilters(EMPTY, { ...EMPTY, maxPrice: 10 })).toBe(false);
    expect(
      sameFilters({ ...EMPTY, districtIds: ['a'] }, { ...EMPTY, districtIds: ['a', 'b'] }),
    ).toBe(false);
  });
});
