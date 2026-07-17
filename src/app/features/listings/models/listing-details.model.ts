import type { BookedDateRange, ListingImage, ListingOwner } from './listing.model';
import type { DeliveryType } from './create-listing.model';

/**
 * Canonical set of toy conditions. This is the single source of truth shared
 * across listings, create/edit, and admin moderation. The admin API service
 * narrows untrusted backend strings to this union via a runtime guard.
 */
export type ToyCondition = 'New' | 'LikeNew' | 'Good' | 'Fair' | 'Poor';

export interface ListingDetails {
  id: string;
  title: string;
  description: string;
  city: string;
  pricePerDay: number;
  images: ListingImage[];
  owner: ListingOwner;
  bookedDates: BookedDateRange[];
  isFavorite: boolean;

  // Optional toy-specific fields. May be omitted by the backend.
  ageFromMonths?: number | null;
  ageToMonths?: number | null;
  condition?: ToyCondition | null;
  hygieneNotes?: string | null;
  safetyNotes?: string | null;
  depositAmount?: number | null;
  minRentalDays?: number | null;
  deliveryType?: DeliveryType | null;
}
