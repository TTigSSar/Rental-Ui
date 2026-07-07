import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { combineLatest, map } from 'rxjs';

import { CreateListingFormComponent } from '../../components/create-listing-form/create-listing-form.component';
import type { CreateListingRequest } from '../../models/create-listing.model';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectCreateListingError,
  selectCreateListingImageUploadError,
  selectCreateListingImageUploadProgress,
  selectCreateListingLoading,
  selectCreateListingSuccessId,
  selectListingCategories,
  selectListingCategoriesLoading,
} from '../../store/listings.selectors';

@Component({
  selector: 'app-create-listing-page',
  standalone: true,
  imports: [AsyncPipe, CreateListingFormComponent],
  templateUrl: './create-listing-page.component.html',
  styleUrl: './create-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateListingPageComponent implements OnInit {
  private readonly store          = inject(Store);
  private readonly router         = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly translate      = inject(TranslateService);

  private readonly createListingSuccessId = this.store.selectSignal(
    selectCreateListingSuccessId,
  );
  private readonly createListingImageUploadError = this.store.selectSignal(
    selectCreateListingImageUploadError,
  );

  private hasNavigated = false;

  protected readonly vm$ = combineLatest({
    categories:           this.store.select(selectListingCategories),
    categoriesLoading:    this.store.select(selectListingCategoriesLoading),
    createListingLoading: this.store.select(selectCreateListingLoading),
    createListingError:   this.store.select(selectCreateListingError),
    imageUploadError:     this.store.select(selectCreateListingImageUploadError),
    uploadProgress:       this.store.select(selectCreateListingImageUploadProgress),
  }).pipe(map(vm => vm));

  constructor() {
    effect(() => {
      const createdListingId = this.createListingSuccessId();
      if (createdListingId === null || this.hasNavigated) return;

      // Listing exists. If photos failed, KEEP the user on the wizard so they
      // can retry the upload; only redirect once the listing is fully done.
      if (this.createListingImageUploadError() !== null) return;

      this.hasNavigated = true;
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('listings.createPage.successTitle'),
        detail:  this.translate.instant('listings.createPage.successMessage'),
        life:    5000,
      });
      this.store.dispatch(ListingsActions.clearCreateListingState());
      void this.router.navigate(['/my-listings']);
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.clearCreateListingState());
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  protected onSubmitted(event: { payload: CreateListingRequest; files: File[]; imageOrder: unknown }): void {
    this.store.dispatch(ListingsActions.createListing({
      payload: event.payload,
      files:   event.files,
    }));
  }

  protected onRetryUpload(files: File[]): void {
    const listingId = this.createListingSuccessId();
    if (listingId === null) return;
    this.store.dispatch(ListingsActions.retryImageUpload({ listingId, files }));
  }

  protected onCancelled(): void {
    void this.router.navigate(['/listings']);
  }
}
