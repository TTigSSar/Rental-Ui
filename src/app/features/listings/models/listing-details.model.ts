import type { BookedDateRange, ListingImage, ListingOwner } from './listing.model';

/**
 * Subset of conditions the create form lets owners choose from. The backend
 * accepts any string, so we keep this as a free-form `string` on the model
 * and only treat the values below as well-known labels in the UI.
 */
export type ToyCondition = 'New' | 'LikeNew' | 'Good' | 'Fair' | string;

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
}
