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
}

export type MyListingStatus =
  | 'PendingApproval'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Archived';

export interface MyListing {
  id: string;
  title: string;
  city: string;
  pricePerDay: number;
  imageUrl: string | null;
  status: MyListingStatus;
  createdAt: string | null;
  // Extended fields populated when backend returns them (edit form + richer card)
  description: string | null;
  categoryId: string;
  ageFromMonths: number | null;
  ageToMonths: number | null;
  condition: string | null;
  hygieneNotes: string | null;
  safetyNotes: string | null;
  depositAmount: number | null;
}
