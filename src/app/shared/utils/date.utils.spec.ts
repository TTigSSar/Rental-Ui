import { todayUtcDateString } from './date.utils';

describe('todayUtcDateString', () => {
  it('formats a UTC instant as YYYY-MM-DD', () => {
    expect(todayUtcDateString(new Date('2026-09-18T12:00:00.000Z'))).toBe('2026-09-18');
  });

  it('uses the UTC calendar day, not the local one — a moment that is already tomorrow in a', () => {
    // UTC+ timezone (e.g. Armenia, UTC+4) is still "today" in UTC. 23:30 UTC on the 18th is
    // 03:30 on the 19th in Yerevan, but todayUtcDateString must report the 18th.
    expect(todayUtcDateString(new Date('2026-09-18T23:30:00.000Z'))).toBe('2026-09-18');
  });

  it('rolls over at UTC midnight', () => {
    expect(todayUtcDateString(new Date('2026-09-19T00:00:00.000Z'))).toBe('2026-09-19');
  });

  it('defaults to the current time when no argument is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T08:00:00.000Z'));
    expect(todayUtcDateString()).toBe('2026-01-05');
    vi.useRealTimers();
  });
});
