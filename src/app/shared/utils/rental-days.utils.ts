/**
 * Rental-day arithmetic (ADR-043): rental days = max(1, return - pickup), counted in
 * calendar days. The return day is free for the next pickup, so occupied nights are
 * [start, effectiveEnd) where effectiveEnd = end > start ? end : start + 1.
 */
function calendarDayNumber(value: Date): number {
  return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86_400_000);
}

/** max(1, calendar-day diff); 0 when `end` is before `start` (invalid range). */
export function countRentalDays(start: Date, end: Date): number {
  const diff = calendarDayNumber(end) - calendarDayNumber(start);
  return diff < 0 ? 0 : Math.max(1, diff);
}

/** The exclusive end of the occupied nights: `end` if after `start`, else the next day. */
export function rentalEffectiveEnd(start: Date, end: Date): Date {
  const effective = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  effective.setDate(effective.getDate() + Math.max(1, countRentalDays(start, end)));
  return effective;
}
