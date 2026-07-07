import type { ToyCondition } from './listing-details.model';

/**
 * Rental period the owner's price applies to. The numeric amount lives in
 * `pricePerDay` (kept for backend/search compatibility); `priceUnit` says which
 * period that amount is charged for. Backend persists this via a `PriceUnit`
 * enum column (see the backend hand-off in the create-listing wizard plan).
 */
export type PriceUnit = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export const PRICE_UNITS: readonly PriceUnit[] = [
  'Hourly',
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly',
];

export interface CreateListingRequest {
  title: string;
  description: string;
  categoryId: string;
  pricePerDay: number;
  priceUnit: PriceUnit;
  country: string;
  city: string;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;

  // Optional toy-specific fields. Only sent when the owner fills them in.
  ageFromMonths?: number | null;
  ageToMonths?: number | null;
  condition?: ToyCondition | null;
  hygieneNotes?: string | null;
  safetyNotes?: string | null;
  depositAmount?: number | null;
}

export interface CreateListingResponse {
  id: string;
  status: 'PendingApproval' | 'Approved' | 'Rejected' | 'Archived';
}

export interface ListingImageUploadResponse {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

/** Progress/result events streamed while uploading listing images. */
export type ListingImageUploadEvent =
  | { kind: 'progress'; percent: number }
  | { kind: 'complete'; images: ListingImageUploadResponse[] };

export interface ListingCategoryOption {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  iconName?: string | null;
  displayOrder?: number | null;
}
