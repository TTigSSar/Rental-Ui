import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EditListingPageComponent } from './edit-listing-page.component';
import type { MyListing } from '../../models/my-listing.model';
import { MyListingsApiService } from '../../services/my-listings-api.service';
import { myListingsFeatureKey } from '../../store/my-listings.reducer';
import { initialMyListingsState } from '../../store/my-listings.state';
import { ListingsApiService } from '../../../listings/services/listings-api.service';

const LISTING_ID = 'listing-1';

function makeMyListing(overrides: Partial<MyListing> = {}): MyListing {
  return {
    id: LISTING_ID,
    title: 'Wooden Train Set',
    city: 'Yerevan',
    pricePerDay: 1500,
    imageUrl: null,
    status: 'Approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    rejection: null,
    description: 'A lovely train set.',
    categoryId: 'cat-1',
    ageFromMonths: 24,
    ageToMonths: 60,
    condition: 'Good',
    hygieneNotes: null,
    safetyNotes: null,
    compensationAmount: null,
    minRentalDays: null,
    deliveryType: null,
    deliveryTypes: null,
    ...overrides,
  };
}

/**
 * The edit-listing wizard's amber "amount missing" notice
 * (`showCompensationNotice`) — must fire for BOTH a never-set listing
 * (`null`) and a legacy `0` (the old optional-deposit validator allowed it,
 * and the depositAmount -> compensationAmount rename preserved values). A 0
 * must also prefill the field EMPTY, not as the literal value `0` — a 0 that
 * survived to submit would fail the 1,000 minimum with a confusing range
 * error instead of the honest "Required".
 */
function createFixture(compensationAmount: number | null) {
  TestBed.configureTestingModule({
    imports: [EditListingPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [myListingsFeatureKey]: {
            ...initialMyListingsState,
            items: [makeMyListing({ compensationAmount })],
            isLoading: false,
          },
        },
      }),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: LISTING_ID }) } },
      },
      {
        provide: ListingsApiService,
        useValue: {
          getListingById: () => of({ images: [] }),
          getListingCategories: () => of([]),
        },
      },
      // Not called by any test here (Save isn't clicked) — stubbed so DI
      // doesn't try to construct the real service (which injects HttpClient,
      // not provided in this test module).
      { provide: MyListingsApiService, useValue: {} },
    ],
  });

  const fixture = TestBed.createComponent(EditListingPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('EditListingPageComponent — loss & damage compensation "amount missing" notice', () => {
  it('shows the amber notice when the amount was never set (null)', () => {
    const fixture = createFixture(null);

    const notice = fixture.nativeElement.querySelector('.edit-compensation-notice');
    expect(notice).not.toBeNull();
  });

  it('shows the amber notice for a legacy 0 amount', () => {
    const fixture = createFixture(0);

    const notice = fixture.nativeElement.querySelector('.edit-compensation-notice');
    expect(notice).not.toBeNull();
  });

  it('does not show the notice once a real amount is set', () => {
    const fixture = createFixture(45000);

    const notice = fixture.nativeElement.querySelector('.edit-compensation-notice');
    expect(notice).toBeNull();
  });

  it('prefills a legacy 0 amount as empty (not the literal "0")', () => {
    const fixture = createFixture(0);
    const component = fixture.componentInstance as unknown as {
      prefill: () => { compensationAmount?: number | null } | null;
    };

    expect(component.prefill()?.compensationAmount).toBeNull();
  });

  it('prefills a real amount as-is', () => {
    const fixture = createFixture(45000);
    const component = fixture.componentInstance as unknown as {
      prefill: () => { compensationAmount?: number | null } | null;
    };

    expect(component.prefill()?.compensationAmount).toBe(45000);
  });
});
