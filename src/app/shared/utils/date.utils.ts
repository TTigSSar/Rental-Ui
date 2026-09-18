/**
 * Today's calendar date in UTC, formatted `YYYY-MM-DD` — the same shape the backend
 * serializes date-only fields in (e.g. `BookingDetail.startDate`) and the calendar day
 * `BookingsService.CancelBooking` (rental-api) compares an Approved booking's start date
 * against (`booking.StartDate > DateOnly.FromDateTime(DateTime.UtcNow)`).
 *
 * `Date#toISOString()` always renders in UTC regardless of the caller's local timezone, so
 * slicing the first 10 characters gives the UTC calendar date directly — no manual
 * getUTC*() arithmetic needed. Takes an optional `now` so callers (and their tests) don't
 * have to depend on the wall clock; component tests instead use `vi.setSystemTime()`,
 * matching the existing convention in this codebase (see e.g. `listings-page.component.spec.ts`).
 */
export function todayUtcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
