import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { meetingPointMapsUrl, meetingPointSubtitleKey } from '../../models/chat-ui.util';
import type { ChatMeetingPointKind } from '../../models/chat.model';

/**
 * A `location` message (ADR-053): pin tile, bold "Meeting point", an "Owner's home"
 * subtitle for a home share only, and an "Open in maps" link. Coordinates and addresses
 * are never rendered as text; the link target is the only place they appear.
 *
 * Shared by the chat thread and the admin Messages screen. `state` drives the optimistic
 * home-share bubble (dimmed, link inert) — a stored message is always `sent`.
 */
@Component({
  selector: 'app-meeting-point-bubble',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  templateUrl: './meeting-point-bubble.component.html',
  styleUrl: './meeting-point-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingPointBubbleComponent {
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly kind = input<ChatMeetingPointKind | null>(null);
  /** Own message → navy bubble; counterpart → white bubble. */
  readonly mine = input<boolean>(false);
  readonly state = input<'sent' | 'sending' | 'failed'>('sent');

  protected readonly idle = computed(() => this.state() !== 'sent');
  protected readonly subtitleKey = computed(() => meetingPointSubtitleKey(this.kind()));
  protected readonly mapsUrl = computed<string | null>(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    return !this.idle() && lat !== null && lng !== null ? meetingPointMapsUrl(lat, lng) : null;
  });
}
