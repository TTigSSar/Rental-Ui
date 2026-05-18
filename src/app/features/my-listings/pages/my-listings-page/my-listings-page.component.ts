import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

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
    AsyncPipe,
    ButtonModule,
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

  protected readonly viewModel$ = this.store.select(selectMyListingsPageViewModel);
  protected readonly activeFilter = signal<FilterStatus>('All');

  protected readonly FILTER_TABS: readonly FilterTab[] = [
    { key: 'All', labelKey: 'myListings.filter.all' },
    { key: 'PendingApproval', labelKey: 'myListings.filter.pending' },
    { key: 'Approved', labelKey: 'myListings.filter.approved' },
    { key: 'Rejected', labelKey: 'myListings.filter.rejected' },
    { key: 'Archived', labelKey: 'myListings.filter.archived' },
  ];

  ngOnInit(): void {
    this.store.dispatch(MyListingsActions.loadMyListings());
  }

  protected retry(): void {
    this.store.dispatch(MyListingsActions.loadMyListings());
  }

  protected setFilter(filter: FilterStatus): void {
    this.activeFilter.set(filter);
  }

  protected filterItems(items: MyListing[]): MyListing[] {
    const f = this.activeFilter();
    if (f === 'All') return items;
    if (f === 'PendingApproval') {
      return items.filter(i => i.status === 'PendingApproval' || i.status === 'Pending');
    }
    return items.filter(i => i.status === f);
  }

  protected countForFilter(items: MyListing[], filter: FilterStatus): number {
    if (filter === 'All') return items.length;
    if (filter === 'PendingApproval') {
      return items.filter(i => i.status === 'PendingApproval' || i.status === 'Pending').length;
    }
    return items.filter(i => i.status === filter).length;
  }

  protected onEditRequested(_: string): void {
    // Placeholder action for upcoming edit flow.
  }

  protected onArchiveRequested(_: string): void {
    // Placeholder action for upcoming archive flow.
  }
}
