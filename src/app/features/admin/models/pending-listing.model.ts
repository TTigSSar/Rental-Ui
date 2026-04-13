export interface PendingListingOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PendingListing {
  id: string;
  title: string;
  city: string;
  pricePerDay: number;
  imageUrl: string | null;
  createdAt: string | null;
  owner: PendingListingOwner | null;
}
