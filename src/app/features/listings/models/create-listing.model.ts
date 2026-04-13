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
}

export interface CreateListingResponse {
  id: string;
  status: string;
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
