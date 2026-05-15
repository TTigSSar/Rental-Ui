import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
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
    Dialog,
    MessageModule,
    PendingListingCardComponent,
    ReactiveFormsModule,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './pending-listings-page.component.html',
  styleUrl: './pending-listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingListingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly viewModel$ = this.store.select(selectPendingListingsPageViewModel);

  // --- Reject modal state ---
  protected readonly rejectingListingId = signal<string | null>(null);
  protected readonly isDialogOpen = signal(false);

  protected readonly rejectReasonControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(500),
    ],
  });

  private readonly actionIds = this.store.selectSignal(selectPendingListingActionIds);
  private readonly pendingListings = this.store.selectSignal(selectPendingListings);

  protected readonly isRejectSubmitting = computed(() => {
    const id = this.rejectingListingId();
    if (id === null) return false;
    return this.actionIds().includes(id);
  });

  constructor() {
    // Close the modal once the rejected listing disappears from the pending list
    effect(() => {
      const id = this.rejectingListingId();
      if (id === null) return;
      const stillPending = this.pendingListings().some((item) => item.id === id);
      if (!stillPending) {
        this.closeRejectModal();
      }
    });
  }

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
    this.store.dispatch(AdminModerationActions.approvePendingListing({ listingId }));
  }

  protected openRejectModal(listingId: string): void {
    this.rejectingListingId.set(listingId);
    this.rejectReasonControl.reset('');
    this.isDialogOpen.set(true);
  }

  protected closeRejectModal(): void {
    this.rejectingListingId.set(null);
    this.isDialogOpen.set(false);
    this.rejectReasonControl.reset('');
  }

  protected submitReject(): void {
    this.rejectReasonControl.markAsTouched();

    if (this.rejectReasonControl.invalid) {
      return;
    }

    const listingId = this.rejectingListingId();
    if (listingId === null) return;

    const reason = this.rejectReasonControl.value.trim();
    this.store.dispatch(
      AdminModerationActions.rejectPendingListing({ listingId, reason }),
    );
  }
}
