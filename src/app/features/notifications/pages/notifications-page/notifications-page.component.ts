import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/ui/loading-skeleton/loading-skeleton.component';
import { NotificationCardComponent } from '../../components/notification-card/notification-card.component';
import { NotificationFilterTabsComponent } from '../../components/notification-filter-tabs/notification-filter-tabs.component';
import {
  groupNotifications,
  type NotificationGroup,
} from '../../models/notification-grouping';
import type {
  NotificationAction,
  NotificationCounts,
  NotificationFilter,
  NotificationItem,
} from '../../models/notification.model';
import * as NotificationsActions from '../../store/notifications.actions';
import {
  selectHasMoreNotifications,
  selectNotificationCounts,
  selectNotificationFilter,
  selectNotificationItems,
  selectNotificationsError,
  selectNotificationsLoading,
  selectNotificationsLoadingMore,
  selectNotificationsMarkingAll,
} from '../../store/notifications.selectors';

interface NotificationsPageViewModel {
  readonly groups: NotificationGroup[];
  readonly counts: NotificationCounts;
  readonly filter: NotificationFilter;
  readonly loading: boolean;
  readonly loadingMore: boolean;
  readonly markingAll: boolean;
  readonly hasMore: boolean;
  readonly error: string | null;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
  readonly hasUnread: boolean;
}

const selectNotificationsPageViewModel = createSelector(
  selectNotificationItems,
  selectNotificationCounts,
  selectNotificationFilter,
  selectNotificationsLoading,
  selectNotificationsLoadingMore,
  selectNotificationsMarkingAll,
  selectHasMoreNotifications,
  selectNotificationsError,
  (
    items,
    counts,
    filter,
    loading,
    loadingMore,
    markingAll,
    hasMore,
    error,
  ): NotificationsPageViewModel => {
    const hasError = error !== null;
    return {
      groups: groupNotifications(items),
      counts,
      filter,
      loading,
      loadingMore,
      markingAll,
      hasMore,
      error,
      showInitialSkeleton: loading && items.length === 0,
      showEmpty: !loading && items.length === 0 && !hasError,
      hasError,
      hasUnread: counts.unread > 0,
    };
  },
);

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    MessageModule,
    TranslatePipe,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    NotificationCardComponent,
    NotificationFilterTabsComponent,
  ],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly viewModel$ = this.store.select(
    selectNotificationsPageViewModel,
  );

  ngOnInit(): void {
    this.store.dispatch(NotificationsActions.loadFeed({ filter: 'all' }));
  }

  protected onFilterChange(filter: NotificationFilter): void {
    this.store.dispatch(NotificationsActions.setFilter({ filter }));
  }

  protected onOpen(item: NotificationItem): void {
    this.store.dispatch(
      NotificationsActions.openNotification({
        id: item.id,
        deepLink: item.primaryAction?.deepLink ?? null,
      }),
    );
  }

  protected onAction(item: NotificationItem, action: NotificationAction): void {
    // An action button both marks the notification read and deep-links to that
    // action's target — the same semantics as opening the card.
    this.store.dispatch(
      NotificationsActions.openNotification({
        id: item.id,
        deepLink: action.deepLink,
      }),
    );
  }

  protected onMarkAll(): void {
    this.store.dispatch(NotificationsActions.markAllRead());
  }

  protected onLoadMore(): void {
    this.store.dispatch(NotificationsActions.loadMore());
  }

  protected retry(filter: NotificationFilter): void {
    this.store.dispatch(NotificationsActions.loadFeed({ filter }));
  }
}
