import type { ListingImage } from '../../listings/models/listing.model';
import type { DeliveryType } from '../../listings/models/create-listing.model';

export type { ListingImage };

export interface UpdateListingRequest {
  title?: string;
  description?: string;
  pricePerDay?: number;
  city?: string;
  country?: string;
  /**
   * Optional direct override for the listing's district (`ListingDistrict.id`).
   * Unlike create, update has no re-derivation path from coordinates — omitting
   * this leaves the existing district unchanged. Not yet wired up by
   * edit-listing-page (no location editing UI exists there); left for whichever
   * card adds district editing to the edit flow.
   */
  districtId?: string | null;
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
