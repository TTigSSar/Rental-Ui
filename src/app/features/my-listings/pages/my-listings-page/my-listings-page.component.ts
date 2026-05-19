import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { MyListingCardComponent } from '../../components/my-listing-card/my-listing-card.component';
import type { MyListing, MyListingStatus } from '../../models/my-listing.model';
import * as MyListingsActions from '../../store/my-listings.actions';
import {
  selectMyListingsError,
  selectMyListingsItems,
  selectMyListingsLoading,
} from '../../store/my-listings.selectors';

type FilterStatus = 'All' | MyListingStatus;

interface FilterTab {
  readonly key: FilterStatus;
  readonly labelKey: string;
}

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
    ButtonModule,
    EmptyStateComponent,
    MessageModule,
    MyListingCardComponent,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './my-listings-page.component.html',
  styleUrl: './my-listings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyListingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  // NgRx selectors emit synchronously — requireSync gives Signal<T> (no undefined).
  protected readonly viewModel = toSignal(
    this.store.select(selectMyListingsPageViewModel),
    { requireSync: true },
  );

  protected readonly activeFilter = signal<FilterStatus>('All');

  protected readonly FILTER_TABS: readonly FilterTab[] = [
    { key: 'All', labelKey: 'myListings.filter.all' },
    { key: 'PendingApproval', labelKey: 'myListings.filter.pending' },
    { key: 'Approved', labelKey: 'myListings.filter.approved' },
    { key: 'Rejected', labelKey: 'myListings.filter.rejected' },
    { key: 'Archived', labelKey: 'myListings.filter.archived' },
  ];

  // Recalculates only when items or activeFilter changes.
  protected readonly filteredItems = computed(() => {
    const items = this.viewModel().items;
    const f = this.activeFilter();
    if (f === 'All') return items;
    if (f === 'PendingApproval') {
      return items.filter(i => i.status === 'PendingApproval' || i.status === 'Pending');
    }
    return items.filter(i => i.status === f);
  });

  // Recalculates only when items change; a single pass covers all tabs.
  protected readonly tabCounts = computed((): ReadonlyMap<FilterStatus, number> => {
    const items = this.viewModel().items;
    return new Map<FilterStatus, number>([
      ['All', items.length],
      ['PendingApproval', items.filter(
        i => i.status === 'PendingApproval' || i.status === 'Pending',
      ).length],
      ['Approved', items.filter(i => i.status === 'Approved').length],
      ['Rejected', items.filter(i => i.status === 'Rejected').length],
      ['Archived', items.filter(i => i.status === 'Archived').length],
    ]);
  });

  ngOnInit(): void {
    this.store.dispatch(MyListingsActions.loadMyListings());
  }

  protected retry(): void {
    this.store.dispatch(MyListingsActions.loadMyListings());
  }

  protected setFilter(filter: FilterStatus): void {
    this.activeFilter.set(filter);
  }

  protected onEditRequested(_: string): void {
    // Placeholder action for upcoming edit flow.
  }

  protected onArchiveRequested(_: string): void {
    // Placeholder action for upcoming archive flow.
  }
}
