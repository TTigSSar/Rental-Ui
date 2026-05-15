import type { ListingDetails } from '../models/listing-details.model';
import type { ListingCategoryOption } from '../models/create-listing.model';
import type { ListingPreview } from '../models/listing.model';
import type { ListingsFilter } from '../models/listings-filter.model';

export interface ListingsState {
  items: ListingPreview[];
  selectedListing: ListingDetails | null;
  filters: ListingsFilter;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  isDetailsLoading: boolean;
  categories: ListingCategoryOption[];
  categoriesLoading: boolean;
  createListingLoading: boolean;
  createListingError: string | null;
  createListingSuccessId: string | null;
  createListingImageUploadFailed: boolean;
  error: string | null;
}

export const initialListingsState: ListingsState = {
  items: [],
  selectedListing: null,
  filters: {
    query: null,
    city: null,
    categoryId: null,
    minPrice: null,
    maxPrice: null,
  },
  page: 1,
  pageSize: 20,
  hasMore: false,
  isLoading: false,
  isDetailsLoading: false,
  categories: [],
  categoriesLoading: false,
  createListingLoading: false,
  createListingError: null,
  createListingSuccessId: null,
  createListingImageUploadFailed: false,
  error: null,
};
