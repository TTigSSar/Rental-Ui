/**
 * The listing WRITE contracts, as a key set — shared by every tier that guards
 * them (component unit specs under `src/`, Playwright specs under `e2e/`).
 *
 * Why this lives in one place instead of being spelled out per spec: the
 * home-point model removed five fields from both the create and the update
 * payload, and a client that still sends one of them is **silently ignored** by
 * the server (unknown JSON members bind to nothing). That is the worst failure
 * shape available — the save returns 200, the owner sees success, and nothing
 * was applied. `country` survived THREE separate removal waves on the update
 * side precisely because each guard was hand-written per spec and the update
 * path had none at all; it was caught by a code review, not by a test.
 *
 * So the guards assert a KEY SET against these constants rather than listing
 * five `not.toHaveProperty` lines each: a sixth derived field removed later is
 * covered by construction the moment it is added here.
 */

/**
 * Removed from BOTH `CreateListingRequest` and `UpdateListingRequest`: the
 * backend derives all five from the owner's home point (country is hardcoded
 * "Armenia", city/district come from the resolved home district, the pin from
 * `User.Home*`). None of them may appear in an outgoing create or update body.
 */
export const HOME_POINT_DERIVED_FIELDS = [
  'latitude',
  'longitude',
  'districtId',
  'city',
  'country',
] as const;

/**
 * The exact key set `PATCH /api/listings/{id}` carries today.
 *
 * Asserted as an EXACT set, not a subset, for two reasons: a guard that only
 * checked "no derived fields" would pass just as happily on an empty body or a
 * skipped save, and any newly writable field has to be added here consciously
 * — which is the moment to ask whether it is derived from the home point.
 *
 * KNOWN GAP (not by design): `priceUnit` is missing. The backend's
 * `UpdateListingRequest.PriceUnit` accepts it and the wizard emits it in its
 * `CreateListingRequest`, but `EditListingPageComponent.onSave` never forwards
 * it and `UpdateListingRequest` (UI model) has no such member — so a price-unit
 * change in the edit wizard is dropped on the client side. Fixing that is an
 * application-code change; when it lands, add `'priceUnit'` here and these
 * guards go green again.
 */
export const LISTING_UPDATE_WRITABLE_FIELDS = [
  'title',
  'description',
  'pricePerDay',
  'ageFromMonths',
  'ageToMonths',
  'condition',
  'hygieneNotes',
  'safetyNotes',
  'compensationAmount',
  'minRentalDays',
  'deliveryType',
  'deliveryTypes',
] as const;

/**
 * Which home-point-derived fields a payload carries. Returns `[]` for a clean
 * body; the returned names make the assertion failure say WHICH field came
 * back instead of just "expected false to be true".
 */
export function homePointDerivedFieldsIn(payload: object): string[] {
  const keys = new Set(Object.keys(payload));
  return HOME_POINT_DERIVED_FIELDS.filter((field) => keys.has(field));
}
