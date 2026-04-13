import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { PendingListingCardComponent } from '../../components/pending-listing-card/pending-listing-card.component';
import type { PendingListing } from '../../models/pending-listing.model';
import * as AdminModerationActions from '../../store/admin-moderation.actions';
import {
  selectPendingListingActionIds,
  selectPendingListings,
  selectPendingListingsError,
  selectPendingListingsLoading,
} from '../../store/admin-moderation.selectors';

interface PendingListingsPageViewModel {
  readonly items: PendingListing[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly actionIds: string[];
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectPendingListingsPageViewModel = createSelector(
  selectPendingListings,
  selectPendingListingsLoading,
  selectPendingListingsError,
  selectPendingListingActionIds,
  (items, loading, error, actionIds): PendingListingsPageViewModel => {
    const hasError = error !== null;
    return {
      items,
      loading,
      error,
      actionIds,
      showInitialSkeleton: loading && items.length === 0,
      showEmpty: !loading && items.length === 0 && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-pending-listings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    MessageModule,
    PendingListingCardComponent,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './pending-listings-page.component.html',
  styleUrl: './pending-listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingListingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly viewModel$ = this.store.select(
    selectPendingListingsPageViewModel,
  );

  ngOnInit(): void {
    this.store.dispatch(AdminModerationActions.loadPendingListings());
  }

  protected retry(): void {
    this.store.dispatch(AdminModerationActions.loadPendingListings());
  }

  protected isActionLoading(listingId: string, actionIds: string[]): boolean {
    return actionIds.includes(listingId);
  }

  protected approve(listingId: string): void {
    this.store.dispatch(
      AdminModerationActions.approvePendingListing({ listingId }),
    );
  }

  protected reject(listingId: string): void {
    this.store.dispatch(
      AdminModerationActions.rejectPendingListing({ listingId }),
    );
  }
}
