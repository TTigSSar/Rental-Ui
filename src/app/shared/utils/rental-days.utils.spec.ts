import { countRentalDays, rentalEffectiveEnd } from './rental-days.utils';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('countRentalDays', () => {
  it('counts a same-day range as 1', () => {
    expect(countRentalDays(d(2026, 10, 17), d(2026, 10, 17))).toBe(1);
  });
  it('counts +1 day as 1', () => {
    expect(countRentalDays(d(2026, 10, 17), d(2026, 10, 18))).toBe(1);
  });
  it('counts +7 days as 7', () => {
    expect(countRentalDays(d(2026, 10, 17), d(2026, 10, 24))).toBe(7);
  });
  it('crosses month and year boundaries', () => {
    expect(countRentalDays(d(2026, 10, 30), d(2026, 11, 2))).toBe(3);
    expect(countRentalDays(d(2026, 12, 30), d(2027, 1, 2))).toBe(3);
  });
  it('returns 0 when end is before start', () => {
    expect(countRentalDays(d(2026, 10, 18), d(2026, 10, 17))).toBe(0);
  });
  it('ignores time of day', () => {
    expect(countRentalDays(new Date(2026, 9, 17, 23, 59), new Date(2026, 9, 18, 0, 1))).toBe(1);
  });
});

describe('rentalEffectiveEnd', () => {
  it('is the end when after start', () => {
    expect(rentalEffectiveEnd(d(2026, 10, 17), d(2026, 10, 20))).toEqual(d(2026, 10, 20));
  });
  it('is start + 1 for a same-day range', () => {
    expect(rentalEffectiveEnd(d(2026, 10, 31), d(2026, 10, 31))).toEqual(d(2026, 11, 1));
  });
});
