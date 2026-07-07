import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import {
  notificationKindMeta,
  type NotificationKindMeta,
} from '../../models/notification-kind';
import type {
  NotificationAction,
  NotificationItem,
} from '../../models/notification.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

/**
 * The shipped "Avatar" notification card: circular actor avatar (photo, or an
 * icon chip for system senders) with a kind badge overlaid bottom-right, a
 * coloured status-label pill, bold title, muted body, a "meta · time" line, the
 * toy thumbnail, an unread dot, and primary/secondary deep-link actions.
 */
@Component({
  selector: 'app-notification-card',
  standalone: true,
  imports: [AvatarComponent, TranslatePipe, TimeAgoPipe],
  templateUrl: './notification-card.component.html',
  styleUrl: './notification-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCardComponent {
  readonly notification = input.required<NotificationItem>();

  /** Card body clicked → open (mark read + deep-link to primary target). */
  readonly open = output<void>();
  /** A specific action button clicked. */
  readonly actionClick = output<NotificationAction>();

  protected readonly meta = computed<NotificationKindMeta>(() =>
    notificationKindMeta(this.notification().kind),
  );

  protected onOpen(): void {
    this.open.emit();
  }

  protected onAction(event: Event, action: NotificationAction): void {
    // The action buttons live inside the clickable card; don't double-fire.
    event.stopPropagation();
    this.actionClick.emit(action);
  }
}
