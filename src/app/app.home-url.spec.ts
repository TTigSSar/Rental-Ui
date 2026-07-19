import { isHomeUrl } from './app';

// The scroll-revealed header search is gated on this predicate: anywhere it
// returns false the header search stays permanently visible. Browse (/listings)
// in particular must never lose it — it is the primary control on that page.
describe('isHomeUrl', () => {
  it('is true for the Home route, including query and fragment', () => {
    expect(isHomeUrl('/')).toBe(true);
    expect(isHomeUrl('/?ref=email')).toBe(true);
    expect(isHomeUrl('/#categories')).toBe(true);
  });

  it('is false for every other route', () => {
    expect(isHomeUrl('/listings')).toBe(false);
    expect(isHomeUrl('/listings?q=lego')).toBe(false);
    expect(isHomeUrl('/listings/abc-123')).toBe(false);
    expect(isHomeUrl('/profile')).toBe(false);
    expect(isHomeUrl('/chat/abc')).toBe(false);
    expect(isHomeUrl('/favorites')).toBe(false);
  });
});
