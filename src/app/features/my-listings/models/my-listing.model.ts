import type { ListingImage } from '../../listings/models/listing.model';
import type { DeliveryType } from '../../listings/models/create-listing.model';

export type { ListingImage };

export interface UpdateListingRequest {
  title?: string;
  description?: string;
  pricePerDay?: number;
  city?: string;
  country?: string;
  ageFromMonths?: number | null;
  ageToMonths?: number | null;
  condition?: string | null;
  hygieneNotes?: string | null;
  safetyNotes?: string | null;
  depositAmount?: number | null;
  minRentalDays?: number | null;
  deliveryType?: DeliveryType | null;
}

export type MyListingStatus =
  | 'PendingApproval'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Archived';

export interface RejectionInfo {
  reasonCode: string;
  reasonLabel: string;
  note: string | null;
  moderatorName: string | null;
  moderatedAt: string | null;
}

export interface MyListing {
  id: string;
  title: string;
  city: string;
  pricePerDay: number;
  imageUrl: string | null;
  status: MyListingStatus;
  createdAt: string | null;
  rejection: RejectionInfo | null;
  // Extended fields populated when backend returns them (edit form + richer card)
  description: string | null;
  categoryId: string;
  ageFromMonths: number | null;
  ageToMonths: number | null;
  condition: string | null;
  hygieneNotes: string | null;
  safetyNotes: string | null;
  depositAmount: number | null;
  // Null on listings created before these fields existed.
  minRentalDays?: number | null;
  deliveryType?: DeliveryType | null;
}
