import type { ListingPreview } from '../../listings/models/listing.model';

export interface HomeSectionResponse {
  readonly key: string;
  readonly title: string;
  readonly items: ListingPreview[];
}

export interface HomeSectionsResponse {
  readonly sections: HomeSectionResponse[];
}
