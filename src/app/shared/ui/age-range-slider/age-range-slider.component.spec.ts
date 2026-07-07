import { ageBandLabelKey } from './age-range-slider.component';

describe('ageBandLabelKey', () => {
  const base = 'listings.createForm.ageBand.';

  it.each([
    [[0, 2], 'babies'],
    [[9, 12], 'preTeens'],
    [[6, 8], 'bigKids'],
    [[3, 5], 'preschool'],
    [[2, 7], 'toddlersUp'],
    [[1, 4], 'toddlers'],
  ] as const)('maps %j -> %s', ([lo, hi], band) => {
    expect(ageBandLabelKey(lo, hi)).toBe(base + band);
  });
});
