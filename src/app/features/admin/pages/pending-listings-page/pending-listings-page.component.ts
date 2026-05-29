import { AsyncPipe, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
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

interface RejectReason {
  readonly key: string;
  readonly icon: string;
}

const REJECT_REASONS: readonly RejectReason[] = [
  { key: 'poorImages', icon: 'pi pi-image' },
  { key: 'missingInfo', icon: 'pi pi-file' },
  { key: 'duplicate', icon: 'pi pi-copy' },
  { key: 'inappropriate', icon: 'pi pi-ban' },
  { key: 'wrongCategory', icon: 'pi pi-tag' },
  { key: 'unsafeItem', icon: 'pi pi-exclamation-triangle' },
];

@Component({
  selector: 'app-pending-listings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    EmptyStateComponent,
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
  private readonly location = inject(Location);
  private readonly translate = inject(TranslateService);

  protected readonly viewModel$ = this.store.select(selectPendingListingsPageViewModel);

  protected readonly rejectingListingId = signal<string | null>(null);
  protected readonly isSheetOpen = signal(false);
  protected readonly selectedReasonKey = signal<string | null>(null);
  protected readonly rejectNote = signal('');
  protected readonly rejectReasons = REJECT_REASONS;

  private readonly actionIds = this.store.selectSignal(selectPendingListingActionIds);
  private readonly pendingListings = this.store.selectSignal(selectPendingListings);

  protected readonly isRejectSubmitting = computed(() => {
    const id = this.rejectingListingId();
    if (id === null) return false;
    return this.actionIds().includes(id);
  });

  protected readonly isConfirmDisabled = computed(
    () => this.selectedReasonKey() === null || this.isRejectSubmitting(),
  );

  constructor() {
    effect(() => {
      const id = this.rejectingListingId();
      if (id === null) return;
      const stillPending = this.pendingListings().some((item) => item.id === id);
      if (!stillPending) {
        this.closeRejectSheet();
      }
    });
  }

  ngOnInit(): void {
    this.store.dispatch(AdminModerationActions.loadPendingListings());
  }

  protected retry(): void {
    this.store.dispatch(AdminModerationActions.loadPendingListings());
  }

  protected goBack(): void {
    this.location.back();
  }

  protected isActionLoading(listingId: string, actionIds: string[]): boolean {
    return actionIds.includes(listingId);
  }

  protected approve(listingId: string): void {
    this.store.dispatch(AdminModerationActions.approvePendingListing({ listingId }));
  }

  protected openRejectSheet(listingId: string): void {
    this.rejectingListingId.set(listingId);
    this.selectedReasonKey.set(null);
    this.rejectNote.set('');
    this.isSheetOpen.set(true);
  }

  protected closeRejectSheet(): void {
    this.rejectingListingId.set(null);
    this.isSheetOpen.set(false);
    this.selectedReasonKey.set(null);
    this.rejectNote.set('');
  }

  protected selectReason(key: string): void {
    this.selectedReasonKey.set(key);
  }

  protected updateNote(value: string): void {
    this.rejectNote.set(value);
  }

  protected submitReject(): void {
    const listingId = this.rejectingListingId();
    const reasonKey = this.selectedReasonKey();
    if (listingId === null || reasonKey === null) return;

    const reasonLabel = this.translate.instant(
      `admin.pendingListings.rejectSheet.reasons.${reasonKey}.title`,
    );
    const note = this.rejectNote().trim();
    const reason = note ? `${reasonLabel}: ${note}` : reasonLabel;

    this.store.dispatch(
      AdminModerationActions.rejectPendingListing({ listingId, reason }),
    );
  }
}
