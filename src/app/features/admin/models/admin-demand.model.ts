/**
 * Admin demand analytics (P3-3). Mirrors `DemandAnalyticsResponse` / `DemandRowResponse`
 * (rental-api `Application/DTOs/DemandAnalyticsResponse.cs`), `GET /api/admin/demand`, Admin only.
 * Dates are plain `yyyy-MM-dd` strings (Yerevan calendar days), not ISO date-times.
 */

/** One aggregate row: booking requests per Yerevan day x district x category. */
export interface AdminDemandRow {
  /** Yerevan day, `yyyy-MM-dd`. */
  day: string;
  /** `null` when the listing had no district at request time; always present in JSON, never omitted. */
  districtId: string | null;
  /** May no longer resolve to a category (categories can be deleted; history keeps the id). */
  categoryId: string;
  bookingRequests: number;
}

/** Response of `GET /api/admin/demand`. */
export interface AdminDemand {
  /** Resolved inclusive range start, `yyyy-MM-dd`. */
  from: string;
  /** Resolved inclusive range end, `yyyy-MM-dd`. */
  to: string;
  /** Ordered by day, districtId (null first), categoryId. `[]` when there is no demand. */
  rows: AdminDemandRow[];
}

/**
 * Query params. Send both or neither (neither = Yerevan today and the 29 prior days); inclusive,
 * max 366 days, `yyyy-MM-dd`. Violations return 400 with errorCode `admin.demand_range_invalid`.
 */
export interface AdminDemandParams {
  from?: string;
  to?: string;
}
