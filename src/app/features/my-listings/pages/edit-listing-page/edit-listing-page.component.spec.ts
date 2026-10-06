import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EditListingPageComponent } from './edit-listing-page.component';
import type { ListingImage, MyListing } from '../../models/my-listing.model';
import { MyListingsApiService } from '../../services/my-listings-api.service';
import { myListingsFeatureKey } from '../../store/my-listings.reducer';
import { initialMyListingsState } from '../../store/my-listings.state';
import {
  CreateListingFormComponent,
  type ListingImageOrderItem,
} from '../../../listings/components/create-listing-form/create-listing-form.component';
import type { CreateListingRequest } from '../../../listings/models/create-listing.model';
import { ListingsApiService } from '../../../listings/services/listings-api.service';
import {
  LISTING_UPDATE_WRITABLE_FIELDS,
  homePointDerivedFieldsIn,
} from '../../../../../testing/listing-write-contract';

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

/**
 * HOME-POINT MODEL, UPDATE SIDE — the mirror of the create-path guard in
 * `create-listing-form.component.spec.ts` ("CreateListingFormComponent — home
 * point -> payload").
 *
 * `latitude`, `longitude`, `districtId`, `city` and `country` were removed from
 * `UpdateListingRequest` too: a listing's location is derived from its owner's
 * home point and update can no longer change any of it. A client that still
 * sends one of them is SILENTLY IGNORED by the server (unknown JSON members
 * bind to nothing), so the save returns 200 and nothing is applied — the
 * failure shape where the client looks like it is working.
 *
 * Until now only the create path was guarded. That asymmetry is not
 * hypothetical: `country` survived three separate removal waves on the update
 * side and was caught by a code review, not by a test.
 *
 * `EditListingPageComponent.onSave` is the cheapest reliable layer for this —
 * it is the single place where the wizard's emitted `CreateListingRequest` is
 * mapped down to an `UpdateListingRequest`, i.e. exactly where a re-added field
 * would be written. Two complementary tests:
 *
 *  1. the realistic path — the real child wizard emits, `onSave` maps, and the
 *     object handed to `MyListingsApiService.updateListing` is checked;
 *  2. a hostile payload that deliberately carries all five derived fields,
 *     which proves `onSave` WHITELISTS rather than merely passing through
 *     whatever the form happens not to produce today.
 *
 * Both assert the EXACT key set, not just "no derived fields": a guard that
 * only checked for absence would pass on an empty body or a skipped save.
 */
describe('EditListingPageComponent — home point -> PATCH payload', () => {
  const EXISTING_IMAGE: ListingImage = {
    id: 'image-1',
    url: '/uploads/image-1.jpg',
    isPrimary: true,
    sortOrder: 0,
  };

  /** A listing valid enough that the edit wizard's own validators let Save through. */
  function savableListing(): MyListing {
    return makeMyListing({
      title: 'Wooden Train Set',
      description: 'A sturdy wooden train set with every piece present and freshly cleaned.',
      pricePerDay: 1500,
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      hygieneNotes: 'Wiped down after every rental.',
      safetyNotes: 'Small parts, not for under-3s.',
      compensationAmount: 45000,
      minRentalDays: 2,
      deliveryType: 'Courier',
      deliveryTypes: ['Courier'],
    });
  }

  function createSaveFixture() {
    const updateCalls: { listingId: string; request: Record<string, unknown> }[] = [];

    TestBed.configureTestingModule({
      imports: [EditListingPageComponent, TranslateModule.forRoot()],
      providers: [
        // A successful save ends in `router.navigate(['/my-listings'])`. With
        // `provideRouter([])` that rejects with NG04002, which Vitest reports
        // as an unhandled error and warns may cause false positives — so the
        // one route the component navigates to is declared here.
        provideRouter([{ path: 'my-listings', children: [] }]),
        provideMockStore({
          initialState: {
            [myListingsFeatureKey]: {
              ...initialMyListingsState,
              items: [savableListing()],
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
            getListingById: () => of({ images: [EXISTING_IMAGE] }),
            getListingCategories: () => of([]),
          },
        },
        {
          provide: MyListingsApiService,
          useValue: {
            updateListing: (listingId: string, request: Record<string, unknown>) => {
              updateCalls.push({ listingId, request });
              return of(undefined);
            },
            // Reached only if the gallery changed. These tests keep it as-is,
            // so a call to any of them would itself be a failure signal.
            addListingImages: () => of([]),
            deleteListingImage: () => of(null),
            reorderListingImages: () => of(null),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(EditListingPageComponent);
    fixture.detectChanges();
    return { fixture, updateCalls };
  }

  it('sends none of the home-point-derived fields and exactly the writable set (real wizard emission)', () => {
    const { fixture, updateCalls } = createSaveFixture();

    const form = fixture.debugElement.query(By.directive(CreateListingFormComponent))
      .componentInstance as CreateListingFormComponent;

    // Edit mode gates Save on the listing keeping at least one photo; the
    // gallery normally fills from `existingImageUrls`, seeded here to match the
    // image `getListingById` returned so nothing looks deleted or reordered.
    form.editGallery.set([{ url: EXISTING_IMAGE.url, existingId: EXISTING_IMAGE.id, file: null }]);
    (form as unknown as { onSubmit(): void }).onSubmit();

    expect(updateCalls).toHaveLength(1);
    const { listingId, request } = updateCalls[0];
    expect(listingId).toBe(LISTING_ID);

    // The guard. Key set over the shared constant, so a sixth derived field
    // added to src/testing/listing-write-contract.ts is covered here by
    // construction rather than by someone remembering this file.
    expect(homePointDerivedFieldsIn(request)).toEqual([]);
    expect(Object.keys(request).sort()).toEqual([...LISTING_UPDATE_WRITABLE_FIELDS].sort());

    // ...and the save is real, so the guard above cannot pass by the body
    // being empty or the request never being made.
    expect(request).toMatchObject({
      title: 'Wooden Train Set',
      description: 'A sturdy wooden train set with every piece present and freshly cleaned.',
      pricePerDay: 1500,
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      compensationAmount: 45000,
      minRentalDays: 2,
      deliveryType: 'Courier',
      deliveryTypes: ['Courier'],
    });
    expect(request['hygieneNotes']).toBe('Wiped down after every rental.');
    expect(request['safetyNotes']).toBe('Small parts, not for under-3s.');
  });

  it('drops the derived fields even when the emitted payload carries all five', () => {
    const { fixture, updateCalls } = createSaveFixture();
    const page = fixture.componentInstance as unknown as {
      onSave(event: {
        payload: CreateListingRequest;
        files: File[];
        imageOrder: ListingImageOrderItem[] | null;
      }): void;
    };

    // A payload that a stale/regressed wizard — or a re-added `p.country`
    // pass-through in `onSave` — would produce. The cast is deliberate: these
    // five are no longer members of `CreateListingRequest`, which is the point.
    const payload = {
      title: 'Wooden Train Set',
      description: 'A sturdy wooden train set with every piece present and freshly cleaned.',
      categoryId: 'cat-1',
      pricePerDay: 1500,
      priceUnit: 'Daily',
      addressLine: null,
      compensationAmount: 45000,
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      hygieneNotes: null,
      safetyNotes: null,
      minRentalDays: 2,
      deliveryType: 'Courier',
      deliveryTypes: ['Courier'],
      latitude: 40.1834,
      longitude: 44.515,
      districtId: 'd1111111-1111-1111-1111-111111111111',
      city: 'Yerevan',
      country: 'Neverland',
    } as unknown as CreateListingRequest;

    page.onSave({
      payload,
      files: [],
      imageOrder: [{ existingId: EXISTING_IMAGE.id, newFileIndex: null }],
    });

    expect(updateCalls).toHaveLength(1);
    const { request } = updateCalls[0];
    expect(homePointDerivedFieldsIn(request)).toEqual([]);
    expect(Object.keys(request).sort()).toEqual([...LISTING_UPDATE_WRITABLE_FIELDS].sort());
  });
});
