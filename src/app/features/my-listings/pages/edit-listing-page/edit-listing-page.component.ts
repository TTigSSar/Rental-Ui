import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, forkJoin, of, switchMap, take } from 'rxjs';

import {
  CreateListingFormComponent,
  type ListingFormPrefill,
  type ListingImageOrderItem,
} from '../../../listings/components/create-listing-form/create-listing-form.component';
import type {
  CreateListingRequest,
  ListingCategoryOption,
} from '../../../listings/models/create-listing.model';
import type { ListingImage } from '../../../listings/models/listing.model';
import { ListingsApiService } from '../../../listings/services/listings-api.service';
import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import type {
  MyListing,
  MyListingStatus,
  RejectionInfo,
  UpdateListingRequest,
} from '../../models/my-listing.model';
import { MyListingsApiService } from '../../services/my-listings-api.service';
import * as MyListingsActions from '../../store/my-listings.actions';
import { selectMyListingsItems, selectMyListingsLoading } from '../../store/my-listings.selectors';

/**
 * Editing (and "Edit & Resubmit") reuses the exact same wizard as creating a
 * listing — {@link CreateListingFormComponent} in edit mode — so owners get one
 * consistent flow. This page only loads the listing, feeds it to that form, and
 * saves the result (resubmitting for review when the listing was rejected).
 */
@Component({
  selector: 'app-edit-listing-page',
  standalone: true,
  imports: [CreateListingFormComponent, TranslatePipe],
  templateUrl: './edit-listing-page.component.html',
  styleUrl: './edit-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditListingPageComponent implements OnInit {
  private readonly store       = inject(Store);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly api         = inject(MyListingsApiService);
  private readonly listingsApi = inject(ListingsApiService);
  private readonly cdr         = inject(ChangeDetectorRef);
  private readonly destroyRef  = inject(DestroyRef);

  protected readonly isLoadingData    = signal(true);
  protected readonly notFound         = signal(false);
  protected readonly isSubmitting     = signal(false);
  protected readonly submitError      = signal<string | null>(null);
  protected readonly categories       = signal<ListingCategoryOption[]>([]);
  protected readonly prefill          = signal<ListingFormPrefill | null>(null);
  protected readonly existingImageUrls = signal<ListingImage[]>([]);
  private _originalImageIds: string[] = [];
  protected readonly listingStatus    = signal<MyListingStatus | null>(null);
  protected readonly listingRejection = signal<RejectionInfo | null>(null);

  protected readonly isRejected = computed(() => this.listingStatus() === 'Rejected');
  protected readonly submitLabelKey = computed(() =>
    this.isRejected()
      ? 'myListings.editPage.wizard.saveAndResubmit'
      : 'myListings.editPage.wizard.saveChanges',
  );

  private listingId = '';
  private wasRejected = false;

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.listingId) {
      this.notFound.set(true);
      this.isLoadingData.set(false);
      return;
    }

    this.loadCategories();
    this.loadExistingImages();

    this.store.dispatch(MyListingsActions.loadMyListings());

    this.store
      .select(selectMyListingsItems)
      .pipe(filter(items => items.length > 0), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        const listing = items.find(i => i.id === this.listingId);
        if (!listing) {
          this.notFound.set(true);
        } else {
          this.applyListing(listing);
        }
        this.isLoadingData.set(false);
        this.cdr.markForCheck();
      });

    this.store
      .select(selectMyListingsLoading)
      .pipe(filter(loading => !loading), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isLoadingData()) {
          this.notFound.set(true);
          this.isLoadingData.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  private applyListing(listing: MyListing): void {
    this.listingStatus.set(listing.status);
    this.listingRejection.set(listing.rejection);
    this.wasRejected = listing.status === 'Rejected';

    this.prefill.set({
      title:         listing.title,
      description:   listing.description ?? '',
      categoryId:    listing.categoryId,
      pricePerDay:   listing.pricePerDay,
      city:          listing.city,
      ageFromMonths: listing.ageFromMonths,
      ageToMonths:   listing.ageToMonths,
      condition:     listing.condition,
      hygieneNotes:  listing.hygieneNotes,
      safetyNotes:   listing.safetyNotes,
      minRentalDays: listing.minRentalDays ?? null,
      deliveryType:  listing.deliveryType ?? null,
    });

    // Cover from the store list serves until the full image set arrives.
    if (listing.imageUrl && this.existingImageUrls().length === 0) {
      this.existingImageUrls.set([{ id: '', url: listing.imageUrl, isPrimary: true, sortOrder: 0 }]);
    }
  }

  /**
   * The store list only carries the cover photo. Fetch the full listing so every
   * existing image is shown. Failure is non-fatal — the cover already serves.
   */
  private loadExistingImages(): void {
    this.listingsApi
      .getListingById(this.listingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: details => {
          const sorted = [...details.images].sort((a, b) => {
            if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
            return a.sortOrder - b.sortOrder;
          });
          if (sorted.length > 0) {
            this.existingImageUrls.set(sorted);
            this._originalImageIds = sorted.map(i => i.id);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          // Keep the store-provided cover as the only preview.
        },
      });
  }

  private loadCategories(): void {
    this.listingsApi
      .getListingCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cats => {
          this.categories.set(cats);
          this.cdr.markForCheck();
        },
        error: () => {
          // Category is display-only in edit mode; an empty list is harmless.
        },
      });
  }

  protected onSave(event: { payload: CreateListingRequest; files: File[]; imageOrder: ListingImageOrderItem[] | null }): void {
    const { payload: p, files, imageOrder } = event;
    const request: UpdateListingRequest = {
      title:         p.title,
      description:   p.description,
      pricePerDay:   p.pricePerDay,
      city:          p.city,
      country:       p.country,
      ageFromMonths: p.ageFromMonths ?? null,
      ageToMonths:   p.ageToMonths ?? null,
      condition:     p.condition ?? null,
      hygieneNotes:  p.hygieneNotes ?? null,
      safetyNotes:   p.safetyNotes ?? null,
      minRentalDays: p.minRentalDays ?? null,
      deliveryType:  p.deliveryType ?? null,
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const order = imageOrder ?? [];
    // We can only safely delete/reorder when we know the listing's current image
    // set (the full fetch succeeded). Otherwise we just append the new photos.
    const imagesKnown   = this._originalImageIds.length > 0;
    const keptIds       = order.filter(i => i.existingId !== null).map(i => i.existingId!);
    const deletedIds    = imagesKnown ? this._originalImageIds.filter(id => !keptIds.includes(id)) : [];
    const keptInOrigOrder = this._originalImageIds.filter(id => keptIds.includes(id));
    const orderChanged  = keptIds.join(',') !== keptInOrigOrder.join(',');
    const needsReorder  = imagesKnown && (files.length > 0 || deletedIds.length > 0 || orderChanged);

    this.api.updateListing(this.listingId, request).pipe(
      takeUntilDestroyed(this.destroyRef),
      // 1. Delete the photos the owner removed.
      switchMap(() =>
        deletedIds.length === 0
          ? of(null)
          : forkJoin(deletedIds.map(id => this.api.deleteListingImage(this.listingId, id))),
      ),
      // 2. Upload new photos — the response carries their server ids in upload order.
      switchMap(() =>
        files.length === 0 ? of<ListingImage[]>([]) : this.api.addListingImages(this.listingId, files),
      ),
      // 3. Reorder the full set so the chosen cover is primary and order is saved.
      switchMap((created: ListingImage[]) => {
        if (!needsReorder) return of(null);
        const finalIds: string[] = [];
        for (const item of order) {
          if (item.existingId !== null) {
            finalIds.push(item.existingId);
          } else if (item.newFileIndex !== null && created[item.newFileIndex]) {
            finalIds.push(created[item.newFileIndex].id);
          }
        }
        return finalIds.length === 0 ? of(null) : this.api.reorderListingImages(this.listingId, finalIds);
      }),
    ).subscribe({
      next: () => this.afterSave(),
      error: err => this.fail(err),
    });
  }

  private afterSave(): void {
    if (this.wasRejected) {
      this.api
        .resubmitListing(this.listingId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => void this.router.navigate(['/my-listings']),
          error: err => this.fail(err),
        });
    } else {
      void this.router.navigate(['/my-listings']);
    }
  }

  private fail(error: unknown): void {
    this.submitError.set(toApiErrorMessage(error));
    this.isSubmitting.set(false);
    this.cdr.markForCheck();
  }
}
