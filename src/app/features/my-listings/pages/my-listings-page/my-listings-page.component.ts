import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { MyListingCardComponent } from '../../components/my-listing-card/my-listing-card.component';
import type { MyListing } from '../../models/my-listing.model';
import * as MyListingsActions from '../../store/my-listings.actions';
import {
  selectMyListingsError,
  selectMyListingsItems,
  selectMyListingsLoading,
} from '../../store/my-listings.selectors';

interface MyListingsPageViewModel {
  readonly items: MyListing[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly showLoadingSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectMyListingsPageViewModel = createSelector(
  selectMyListingsItems,
  selectMyListingsLoading,
  selectMyListingsError,
  (items, isLoading, error): MyListingsPageViewModel => {
    const hasError = error !== null;
    return {
      items,
      isLoading,
      error,
      showLoadingSkeleton: isLoading && items.length === 0,
      showEmpty: !isLoading && items.length === 0 && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-my-listings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    MessageModule,
    MyListingCardComponent,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './my-listings-page.component.html',
  styleUrl: './my-listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyListingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly viewModel$ = this.store.select(selectMyListingsPageViewModel);

  ngOnInit(): void {
    this.store.dispatch(MyListingsActions.loadMyListings());
  }

  protected retry(): void {
    this.store.dispatch(MyListingsActions.loadMyListings());
  }

  protected onEditRequested(_: string): void {
    // Placeholder action for upcoming edit flow.
  }

  protected onArchiveRequested(_: string): void {
    // Placeholder action for upcoming archive flow.
  }
}
