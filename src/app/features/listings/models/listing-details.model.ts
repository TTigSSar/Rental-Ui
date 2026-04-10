import type { BookedDateRange, ListingImage, ListingOwner } from './listing.model';

export interface ListingDetails {
  id: string;
  title: string;
  description: string;
  city: string;
  pricePerDay: number;
  images: ListingImage[];
  owner: ListingOwner;
  bookedDates: BookedDateRange[];
  isFavorite: boolean;
}
