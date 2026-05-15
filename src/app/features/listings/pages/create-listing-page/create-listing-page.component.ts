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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { combineLatest, map } from 'rxjs';

import { CreateListingFormComponent } from '../../components/create-listing-form/create-listing-form.component';
import type { CreateListingRequest } from '../../models/create-listing.model';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectCreateListingError,
  selectCreateListingImageUploadFailed,
  selectCreateListingLoading,
  selectCreateListingSuccessId,
  selectListingCategories,
  selectListingCategoriesLoading,
} from '../../store/listings.selectors';

@Component({
  selector: 'app-create-listing-page',
  standalone: true,
  imports: [AsyncPipe, CreateListingFormComponent, MessageModule, TranslatePipe],
  templateUrl: './create-listing-page.component.html',
  styleUrl: './create-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateListingPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  private readonly createListingSuccessId = this.store.selectSignal(
    selectCreateListingSuccessId,
  );
  private readonly createListingImageUploadFailed = this.store.selectSignal(
    selectCreateListingImageUploadFailed,
  );

  protected readonly vm$ = combineLatest({
    categories: this.store.select(selectListingCategories),
    categoriesLoading: this.store.select(selectListingCategoriesLoading),
    createListingLoading: this.store.select(selectCreateListingLoading),
    createListingError: this.store.select(selectCreateListingError),
  }).pipe(
    map((vm) => ({
      ...vm,
      showCategoriesLoadingState:
        vm.categoriesLoading && vm.categories.length === 0,
    })),
  );

  constructor() {
    effect(() => {
      const createdListingId = this.createListingSuccessId();
      if (createdListingId === null) {
        return;
      }

      const imageUploadFailed = this.createListingImageUploadFailed();

      if (imageUploadFailed) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('listings.createPage.imageUploadWarningTitle'),
          detail: this.translate.instant('listings.createPage.imageUploadWarning'),
          life: 5000,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('listings.createPage.successTitle'),
          detail: this.translate.instant('listings.createPage.successMessage'),
          life: 5000,
        });
      }

      this.store.dispatch(ListingsActions.clearCreateListingState());
      void this.router.navigate(['/my-listings']);
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.clearCreateListingState());
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  protected onSubmitted(event: {
    payload: CreateListingRequest;
    files: File[];
  }): void {
    this.store.dispatch(
      ListingsActions.createListing({
        payload: event.payload,
        files: event.files,
      }),
    );
  }

  protected onCancelled(): void {
    void this.router.navigate(['/listings']);
  }
}
