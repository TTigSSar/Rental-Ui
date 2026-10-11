/**
 * Phone number rule shared with the server (`RegisterRequest` / `UpdatePhoneRequest`
 * regex): an optional leading `+`, then digits, spaces, `-`, `(`, `)` and `.`, with 7 to 20
 * digits in total. The server is authoritative; this only spares a round trip.
 *
 * The server regex rejects a LEADING space, so callers must send `value.trim()`.
 */
export const PHONE_PATTERN = /^\+?(?=(?:[^\d]*\d){7,20}[^\d]*$)[\d\s\-().]+$/;

/** True when the TRIMMED value is an acceptable phone number. */
export function isValidPhoneNumber(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}
