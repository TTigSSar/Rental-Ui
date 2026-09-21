import { isBookingDetailsUrl } from './app';

// Gates the global header (mobile) + bottom nav (see app.ts isBookingPageUrl /
// isBookingPage and app.css's `.app-shell--booking .app-bottom-nav { display: none }`).
// A regression here means the bottom nav sits on top of the booking-details page's own
// sticky footer and swallows every tap — this is exactly what shipped broken: the footer
// added for owner approve/decline (and the pre-existing renter cancel / owner
// markActive/complete CTAs on the same footer) was unreachable on mobile and tablet
// because this predicate never matched `/bookings/:id`.
describe('isBookingDetailsUrl', () => {
  it('is true for a booking details page', () => {
    expect(isBookingDetailsUrl('/bookings/11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isBookingDetailsUrl('/bookings/booking-1')).toBe(true);
  });

  it('is true for the booking review sub-routes', () => {
    expect(isBookingDetailsUrl('/bookings/booking-1/review')).toBe(true);
    expect(isBookingDetailsUrl('/bookings/booking-1/review/renter')).toBe(true);
  });

  it('is true with a query string on any of the above', () => {
    expect(isBookingDetailsUrl('/bookings/booking-1?from=notification')).toBe(true);
    expect(isBookingDetailsUrl('/bookings/booking-1/review?step=2')).toBe(true);
  });

  it('is false for the bookings list page itself', () => {
    expect(isBookingDetailsUrl('/bookings')).toBe(false);
    expect(isBookingDetailsUrl('/bookings/')).toBe(false);
  });

  it('is false for the owner requests list — "requests" is a reserved route segment, not a booking id', () => {
    expect(isBookingDetailsUrl('/bookings/requests')).toBe(false);
    expect(isBookingDetailsUrl('/bookings/requests?tab=pending')).toBe(false);
  });

  it('does not false-match a booking id that merely starts with "requests"', () => {
    expect(isBookingDetailsUrl('/bookings/requestsomething')).toBe(true);
  });

  it('is false for every unrelated route', () => {
    expect(isBookingDetailsUrl('/')).toBe(false);
    expect(isBookingDetailsUrl('/listings')).toBe(false);
    expect(isBookingDetailsUrl('/listings/listing-1/book')).toBe(false);
    expect(isBookingDetailsUrl('/profile/requests')).toBe(false);
    expect(isBookingDetailsUrl('/admin/listings/pending')).toBe(false);
  });

  it('is false for an unrecognized nested sub-route (only /review and /review/renter exist)', () => {
    expect(isBookingDetailsUrl('/bookings/booking-1/edit')).toBe(false);
    expect(isBookingDetailsUrl('/bookings/booking-1/review/owner')).toBe(false);
  });
});
