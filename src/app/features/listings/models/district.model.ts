/**
 * One of the 12 fixed Yerevan administrative districts, served by
 * `GET /api/districts` (see `ListingsApiService.getDistricts`) and echoed back on
 * `ListingDetails.district` (backend: `ListingDetailsResponse.District`).
 *
 * Unlike `ListingDetails.latitude`/`longitude`, a district is NOT gated by
 * `CanSeeExactCoordinates` — every caller (including anonymous) sees it. A district
 * name on its own does not pinpoint a home address.
 */
export interface ListingDistrict {
  id: string;
  code: string;
  /** English display name. */
  nameEn: string;
  /** Armenian (Հայերեն) display name. */
  nameHy: string;
  /** Russian (Русский) display name. */
  nameRu: string;
}
