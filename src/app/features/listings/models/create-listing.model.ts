import type { ToyCondition } from './listing-details.model';

export interface CreateListingRequest {
  title: string;
  description: string;
  categoryId: string;
  pricePerDay: number;
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

export interface ListingCategoryOption {
  id: string;
  name: string;
  slug: string;
}
