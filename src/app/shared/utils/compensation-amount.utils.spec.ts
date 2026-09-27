import { isCompensationAmountSet } from './compensation-amount.utils';

describe('isCompensationAmountSet', () => {
  it('is true for a positive finite amount', () => {
    expect(isCompensationAmountSet(45000)).toBe(true);
    expect(isCompensationAmountSet(1)).toBe(true);
    expect(isCompensationAmountSet(10_000_000)).toBe(true);
  });

  it('is false for null', () => {
    expect(isCompensationAmountSet(null)).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isCompensationAmountSet(undefined)).toBe(false);
  });

  it('is false for 0 — legacy data from the old optional-deposit validator, not a real amount', () => {
    expect(isCompensationAmountSet(0)).toBe(false);
  });

  it('is false for a negative number', () => {
    expect(isCompensationAmountSet(-500)).toBe(false);
  });

  it('is false for NaN', () => {
    expect(isCompensationAmountSet(Number.NaN)).toBe(false);
  });

  it('is false for Infinity', () => {
    expect(isCompensationAmountSet(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
