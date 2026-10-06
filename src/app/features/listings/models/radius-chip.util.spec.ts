import { radiusChipLabel } from './radius-chip.util';

/** Stand-in for `TranslateService.instant` — returns the key plus its params
 *  so a test can assert WHICH key was chosen and that the distance reached
 *  the interpolation, without loading a translation bundle. */
const translate = {
  instant: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${JSON.stringify(params)})` : key,
};

describe('radiusChipLabel', () => {
  it('uses the whole-sentence "within … of home" form for a home origin', () => {
    expect(radiusChipLabel('3 km', 'home', translate)).toBe(
      'listings.filters.distance.withinHome({"distance":"3 km"})',
    );
  });

  it('uses the "{distance} · from you" suffix form for a geolocation origin', () => {
    expect(radiusChipLabel('3 km', 'geo', translate)).toBe(
      '3 km · listings.filters.distance.chipSuffix',
    );
  });

  it('uses the suffix form for a manually picked origin', () => {
    expect(radiusChipLabel('500 m', 'manual', translate)).toBe(
      '500 m · listings.filters.distance.chipSuffix',
    );
  });

  // Both surfaces gate the chip on an origin existing, so `null` should not
  // reach here in practice — but it must degrade to the generic wording
  // rather than claim the radius is measured from a home point.
  it('falls back to the suffix form when the origin source is unknown', () => {
    expect(radiusChipLabel('1 km', null, translate)).toBe(
      '1 km · listings.filters.distance.chipSuffix',
    );
  });
});
