import type { ListingImage } from '../../listings/models/listing.model';
import type { DeliveryType } from '../../listings/models/create-listing.model';

export type { ListingImage };

export interface UpdateListingRequest {
  title?: string;
  description?: string;
  pricePerDay?: number;
  // BREAKING (home-point model): `country`, `city` and `districtId` were all
  // REMOVED from this payload — the backend deleted them from
  // UpdateListingRequest. A listing's country, city and district are always
  // derived from its owner's home point, and only HomePointService (or create)
  // ever writes them. `country` went last: it had stayed writable behind nothing
  // but a length check while HomePointService re-asserts it on every move, so
  // `{"country":"Neverland"}` stuck forever beside a Yerevan district and pin.
  // A stale client that still sends any of the three binds harmlessly (unknown
  // JSON members are ignored), so nothing is applied — which is exactly why
  // none of them may live here.
  ageFromMonths?: number | null;
  ageToMonths?: number | null;
  condition?: string | null;
  hygieneNotes?: string | null;
  safetyNotes?: string | null;
  /** See `CreateListingRequest.compensationAmount` — same field, update payload. */
  compensationAmount?: number | null;
  minRentalDays?: number | null;
  deliveryType?: DeliveryType | null;
  deliveryTypes?: DeliveryType[] | null;
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
  compensationAmount: number | null;
  // Null on listings created before these fields existed.
  minRentalDays?: number | null;
  deliveryType?: DeliveryType | null;
  deliveryTypes?: DeliveryType[] | null;
}
