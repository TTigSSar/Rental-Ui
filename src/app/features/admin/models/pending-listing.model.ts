export type ToyCondition = 'New' | 'LikeNew' | 'Good' | 'Fair' | 'Poor';

export interface PendingListingOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PendingListing {
  id: string;
  title: string;
  description: string;
  city: string;
  country: string;
  categoryName: string | null;
  pricePerDay: number;
  depositAmount: number | null;
  imageUrl: string | null;
  createdAt: string | null;
  owner: PendingListingOwner | null;
  ageFromMonths: number | null;
  ageToMonths: number | null;
  condition: ToyCondition | null;
  hygieneNotes: string | null;
  safetyNotes: string | null;
}
