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
}
