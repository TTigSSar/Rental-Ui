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

describe('toAiSearchFilters', () => {
  it('sends the user-edited filters back; empty districts become null', () => {
    expect(toAiSearchFilters(EMPTY, null)).toEqual({
      categoryId: null,
      ageGroup: null,
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

  it('sends only the first category and the first known age group (the AI endpoint takes one of each)', () => {
    const f = { ...EMPTY, categoryIds: ['c1', 'c2'], ageGroups: ['teen', '12-36', '36-72'] };
    expect(toAiSearchFilters(f, null)).toMatchObject({ categoryId: 'c1', ageGroup: '12-36' });
  });

  it('drops an age group the AI endpoint does not know', () => {
    expect(toAiSearchFilters({ ...EMPTY, ageGroups: ['teen'] }, null).ageGroup).toBeNull();
    expect(toAiSearchFilters({ ...EMPTY, ageGroups: ['120+'] }, null).ageGroup).toBe('120+');
  });

  it('round-trips with fromAiSearchFilters', () => {
    const filters = fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: 1 });
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
