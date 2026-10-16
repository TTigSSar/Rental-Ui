import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { MyListingsApiService } from './my-listings-api.service';

/**
 * Payload shaped from the real `GET /api/listings/mine` wire format
 * (MyListingResponse): `priceUnit` is a string enum name, always present.
 */
function wireListing(priceUnit: unknown): Record<string, unknown> {
  return {
    id: 'l-1',
    categoryId: 'c-1',
    categoryName: 'Baby Toys',
    title: 'Repro Weekly Toy',
    description: 'A weekly priced listing.',
    pricePerDay: 5000,
    priceUnit,
    currency: 'AMD',
    city: 'Yerevan',
    status: 'Approved',
    primaryImageUrl: null,
  };
}

describe('MyListingsApiService.getMyListings — priceUnit', () => {
  let service: MyListingsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MyListingsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  function load(priceUnit: unknown) {
    let result: { priceUnit: string }[] = [];
    service.getMyListings().subscribe((items) => (result = items));
    http.expectOne(toApiUrl(ApiContract.listings.mine)).flush([wireListing(priceUnit)]);
    return result;
  }

  it('keeps the stored unit instead of dropping it', () => {
    expect(load('Weekly')[0].priceUnit).toBe('Weekly');
    expect(load('Yearly')[0].priceUnit).toBe('Yearly');
  });

  it('reads a missing or unknown unit as the Daily default', () => {
    expect(load(undefined)[0].priceUnit).toBe('Daily');
    expect(load('Fortnightly')[0].priceUnit).toBe('Daily');
  });
});
