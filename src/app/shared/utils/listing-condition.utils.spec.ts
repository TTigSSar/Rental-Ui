import { normalizeToyCondition, resolveConditionLabelKey } from './listing-condition.utils';

describe('resolveConditionLabelKey', () => {
  it.each([
    ['New', 'listings.details.conditionValues.new'],
    ['LikeNew', 'listings.details.conditionValues.likeNew'],
    ['Like new', 'listings.details.conditionValues.likeNew'],
    ['like-new', 'listings.details.conditionValues.likeNew'],
    ['Good', 'listings.details.conditionValues.good'],
    ['Fair', 'listings.details.conditionValues.fair'],
    ['Excellent', 'listings.details.conditionValues.likeNew'],
    ['EXCELLENT', 'listings.details.conditionValues.likeNew'],
    ['Used', 'listings.details.conditionValues.fair'],
    [' used ', 'listings.details.conditionValues.fair'],
  ])('maps %j -> %s', (input, expected) => {
    expect(resolveConditionLabelKey(input)).toBe(expected);
  });

  it('returns null for an unknown or missing condition', () => {
    expect(resolveConditionLabelKey('Poor')).toBeNull();
    expect(resolveConditionLabelKey(undefined)).toBeNull();
    expect(resolveConditionLabelKey(null)).toBeNull();
    expect(resolveConditionLabelKey('')).toBeNull();
  });
});

describe('normalizeToyCondition', () => {
  it.each([
    ['New', 'New'],
    ['LikeNew', 'LikeNew'],
    ['Like new', 'LikeNew'],
    ['like-new', 'LikeNew'],
    ['Good', 'Good'],
    ['Fair', 'Fair'],
    ['Poor', 'Poor'],
    ['Excellent', 'LikeNew'],
    ['EXCELLENT', 'LikeNew'],
    ['Used', 'Fair'],
    [' used ', 'Fair'],
  ])('maps %j -> %s', (input, expected) => {
    expect(normalizeToyCondition(input)).toBe(expected);
  });

  it('returns null for unknown, empty or non-string values', () => {
    expect(normalizeToyCondition('Broken')).toBeNull();
    expect(normalizeToyCondition('')).toBeNull();
    expect(normalizeToyCondition(null)).toBeNull();
    expect(normalizeToyCondition(undefined)).toBeNull();
    expect(normalizeToyCondition(3)).toBeNull();
  });

  it('resolveConditionLabelKey returns null for Poor (no label key)', () => {
    expect(resolveConditionLabelKey('Poor')).toBeNull();
  });
});
