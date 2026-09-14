import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { mapModerationNoteMeta } from '../../models/chat-ui.util';
import type { ChatMessage } from '../../models/chat.model';

/**
 * Renders a single `type === 'moderationNote'` chat message as the distinct
 * card design (NOT a chat bubble) — design: `NoteMessage` in admin-desktop.jsx
 * (line 1075). Deliberately standalone and reusable: the member's own chat
 * thread (this feature, `conversation-details-page`) and the admin Messages
 * screen both render the exact same card for the exact same message shape, so
 * this component is the single source of truth for it — do not fork it.
 */
@Component({
  selector: 'app-moderation-note-card',
  standalone: true,
  imports: [DatePipe, TranslatePipe, IconComponent],
  templateUrl: './moderation-note-card.component.html',
  styleUrl: './moderation-note-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationNoteCardComponent {
  /** The `moderationNote` message to render (`noteKind`/`noteSubject`/`noteReason` set). */
  readonly message = input.required<ChatMessage>();

  /**
   * Whose screen this renders on. Only affects the footer's trailing phrase —
   * the design's admin-side footer reads "sent to member", which is wrong on
   * the member's own thread (this feature's default, `'member'`); the admin
   * Messages screen passes `'moderator'` explicitly to get that copy back.
   */
  readonly audience = input<'member' | 'moderator'>('member');

  protected readonly meta = computed(() => mapModerationNoteMeta(this.message().noteKind));
}
