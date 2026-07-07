import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import {
  NOTIFICATION_FILTERS,
  type NotificationCounts,
  type NotificationFilter,
} from '../../models/notification.model';

interface FilterTab {
  readonly id: NotificationFilter;
  readonly labelKey: string;
}

const FILTER_LABEL_KEYS: Record<NotificationFilter, string> = {
  all: 'notifications.filter.all',
  unread: 'notifications.filter.unread',
  action: 'notifications.filter.action',
};

@Component({
  selector: 'app-notification-filter-tabs',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './notification-filter-tabs.component.html',
  styleUrl: './notification-filter-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationFilterTabsComponent {
  readonly value = input.required<NotificationFilter>();
  readonly counts = input.required<NotificationCounts>();

  readonly filterChange = output<NotificationFilter>();

  protected readonly tabs: readonly FilterTab[] = NOTIFICATION_FILTERS.map(
    (id) => ({ id, labelKey: FILTER_LABEL_KEYS[id] }),
  );

  protected countFor(id: NotificationFilter): number {
    return this.counts()[id];
  }

  protected select(id: NotificationFilter): void {
    if (id !== this.value()) {
      this.filterChange.emit(id);
    }
  }
}
