import { convertToParamMap } from '@angular/router';

import {
  ageGroupToRangeParam,
  clampRadiusKm,
  parseAgeGroupsParam,
  parseCategoryIdsParam,
  parseConditionsParam,
  parseListingsFilterFromParams,
  parseRadiusKmParam,
  parseSortParam,
  serializeListParam,
  serializeSortParam,
  RADIUS_MAX_KM,
  RADIUS_MIN_KM,
  serializeRadiusKmParam,
} from './listings-filter.model';

describe('clampRadiusKm', () => {
  it('clamps below the backend minimum (0.2 km) up to it', () => {
    expect(clampRadiusKm(0.05)).toBe(RADIUS_MIN_KM);
    expect(clampRadiusKm(0)).toBe(RADIUS_MIN_KM);
  });

  it('clamps above the backend maximum (20 km) down to it', () => {
    expect(clampRadiusKm(35)).toBe(RADIUS_MAX_KM);
  });

  it('leaves an in-range value untouched', () => {
    expect(clampRadiusKm(3)).toBe(3);
  });
});

describe('parseRadiusKmParam', () => {
  it('returns null for a missing param', () => {
    expect(parseRadiusKmParam(null)).toBeNull();
  });

  it('returns null for blank/whitespace-only values', () => {
    expect(parseRadiusKmParam('')).toBeNull();
    expect(parseRadiusKmParam('   ')).toBeNull();
  });

  it('returns null for garbage a user could hand-edit into the URL, never NaN or a crash', () => {
    expect(parseRadiusKmParam('abc')).toBeNull();
    expect(parseRadiusKmParam('3km')).toBeNull();
  });

  it('parses a well-formed fractional value', () => {
    expect(parseRadiusKmParam('2.5')).toBe(2.5);
  });

  it('clamps an out-of-range URL value to the backend range instead of sending it verbatim', () => {
    expect(parseRadiusKmParam('0.05')).toBe(RADIUS_MIN_KM);
    expect(parseRadiusKmParam('999')).toBe(RADIUS_MAX_KM);
  });
});

describe('serializeRadiusKmParam', () => {
  it('omits the param entirely for null (rather than writing "null"/"")', () => {
    expect(serializeRadiusKmParam(null)).toBeNull();
  });

  it('rounds to 2 decimals so the URL never grows a long float tail', () => {
    expect(serializeRadiusKmParam(2.333333)).toBe('2.33');
  });

  it('clamps before serializing', () => {
    expect(serializeRadiusKmParam(50)).toBe(String(RADIUS_MAX_KM));
  });

  it('round-trips cleanly through parseRadiusKmParam', () => {
    const serialized = serializeRadiusKmParam(3);
    expect(parseRadiusKmParam(serialized)).toBe(3);
  });
});

describe('ageGroupToRangeParam', () => {
  it('keeps closed ranges and maps the open-ended "120+" token to "120-"', () => {
    expect(ageGroupToRangeParam('0-12')).toBe('0-12');
    expect(ageGroupToRangeParam('72-120')).toBe('72-120');
    expect(ageGroupToRangeParam('120+')).toBe('120-');
  });

  it('returns null for garbage', () => {
    expect(ageGroupToRangeParam('teen')).toBeNull();
    expect(ageGroupToRangeParam('')).toBeNull();
  });
});

describe('ADR-066 URL list params', () => {
  it('merges the legacy single categoryId into the list, de-duplicated', () => {
    expect(parseCategoryIdsParam('a,b', null)).toEqual(['a', 'b']);
    expect(parseCategoryIdsParam(null, 'legacy')).toEqual(['legacy']);
    expect(parseCategoryIdsParam('a', 'a')).toEqual(['a']);
    expect(parseCategoryIdsParam(' , ', null)).toEqual([]);
  });

  it('caps category ids at the server limit of 50', () => {
    const many = Array.from({ length: 70 }, (_, i) => `c${i}`).join(',');
    expect(parseCategoryIdsParam(many, null)).toHaveLength(50);
  });

  it('parses age groups, merges the legacy ageGroup, drops unknown tokens and caps at 5', () => {
    expect(parseAgeGroupsParam('0-12,120+', null)).toEqual(['0-12', '120+']);
    expect(parseAgeGroupsParam(null, '12-36')).toEqual(['12-36']);
    expect(parseAgeGroupsParam('teen,0-12', null)).toEqual(['0-12']);
    expect(
      parseAgeGroupsParam('0-12,12-36,36-72,72-120,120+,0-6', null),
    ).toHaveLength(5);
  });

  it('keeps only the ADR-042 filter conditions (never "Excellent" or "Poor")', () => {
    expect(parseConditionsParam('New,LikeNew,Good,Fair')).toEqual(['New', 'LikeNew', 'Good', 'Fair']);
    expect(parseConditionsParam('Excellent,Poor,Good')).toEqual(['Good']);
    expect(parseConditionsParam(null)).toEqual([]);
  });

  it('defaults an unknown or missing sort to newest, and never writes the default to the URL', () => {
    expect(parseSortParam('price_asc')).toBe('price_asc');
    expect(parseSortParam('nearest')).toBe('nearest');
    expect(parseSortParam('bogus')).toBe('newest');
    expect(parseSortParam(null)).toBe('newest');
    expect(serializeSortParam('newest')).toBeNull();
    expect(serializeSortParam('rating_desc')).toBe('rating_desc');
  });

  it('serialises an empty list to null so the key is omitted/cleared', () => {
    expect(serializeListParam([])).toBeNull();
    expect(serializeListParam(null)).toBeNull();
    expect(serializeListParam(['a', 'b'])).toBe('a,b');
  });
});

describe('parseListingsFilterFromParams', () => {
  const parse = (query: Record<string, string>) =>
    parseListingsFilterFromParams(convertToParamMap(query));

  it('returns the empty filter (sort newest) for a bare /listings', () => {
    expect(parse({})).toEqual({
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
    });
  });

  it('reads every new key', () => {
    expect(
      parse({
        categoryIds: 'c1,c2',
        ageGroups: '0-12,120+',
        conditions: 'New,Fair',
        sort: 'price_desc',
        minPrice: '500',
        maxPrice: '3000',
        q: ' lego ',
      }),
    ).toMatchObject({
      categoryIds: ['c1', 'c2'],
      ageGroups: ['0-12', '120+'],
      conditions: ['New', 'Fair'],
      sort: 'price_desc',
      minPrice: 500,
      maxPrice: 3000,
      query: 'lego',
    });
  });

  it('keeps legacy ?categoryId= and ?ageGroup= links working by parsing them into the lists', () => {
    expect(parse({ categoryId: 'abc-123', ageGroup: '36-72' })).toMatchObject({
      categoryIds: ['abc-123'],
      ageGroups: ['36-72'],
    });
  });

  it('degrades garbage to "no filter" instead of throwing', () => {
    expect(
      parse({ minPrice: 'x', maxPrice: '', sort: '??', conditions: 'Mint', ageGroups: 'zz', radiusKm: 'nope' }),
    ).toMatchObject({
      minPrice: null,
      maxPrice: null,
      sort: 'newest',
      conditions: [],
      ageGroups: [],
      radiusKm: null,
    });
  });
});
