export interface ListingPreview {
  id: string;
  title: string;
  city: string;
  pricePerDay: number;
  mainImageUrl: string | null;
  isFavorite: boolean;
}

export interface ListingImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ListingOwner {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
}

export interface BookedDateRange {
  startDate: string;
  endDate: string;
}
