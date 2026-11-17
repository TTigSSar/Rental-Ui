import type { PriceUnit } from './create-listing.model';
import type { ListingDistrict } from './district.model';

export interface ListingPreview {
  id: string;
  title: string;
  city: string;
  pricePerDay: number;
  mainImageUrl: string | null;
  isFavorite: boolean;
  /** Trust fields when returned by list/favorites APIs. */
  ageFromMonths?: number | null;
  ageToMonths?: number | null;
  condition?: string | null;
  hygieneNotes?: string | null;
  /** Average toy rating, or null when below the aggregate threshold. */
  rating?: number | null;
  reviewCount?: number;
  /** Availability status returned by user-listings and my-listings APIs. */
  listingStatus?: 'available' | 'rented' | null;
  /** Owner user ID — present when returned by the listings browse API. */
  ownerId?: string | null;
  /**
   * Straight-line distance from the renter's reference point, in
   * kilometres — populated by `GET /api/listings` ONLY when the request
   * included `originLat`/`originLng` (Maps P2 "location + radius" design;
   * backend commit `d0955e0`). `null`/absent otherwise, including when no
   * origin was supplied. Drives the `.distbadge` pill on the catalog card
   * (`ListingCardComponent`) — never recomputed client-side.
   */
  distanceKm?: number | null;
  /** Price unit (ADR-047); absent/unknown on the wire reads as undefined. */
  priceUnit?: PriceUnit;
  /**
   * Listing district (ADR-064, ADR-066) — filled by `GET /api/home/sections`,
   * `GET /api/listings`, `GET /api/favorites` and `GET /api/users/{id}/listings`;
   * still null on AI search items.
   */
  district?: ListingDistrict | null;
}

export interface ListingImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ListingOwner {
  id: string;
  firstName: string;
  lastName: string;
  /** ADR-056: owner deleted their account (names ""); only reachable by an admin. */
  isDeleted: boolean;
}

export interface BookedDateRange {
  startDate: string;
  endDate: string;
}
