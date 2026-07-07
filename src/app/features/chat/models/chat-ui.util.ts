import type { BadgeTone } from '../../../shared/ui/badge/badge.component';
import type { ChatStatus, ChatSystemKind } from './chat.model';

/** Maps a conversation status to a `shared/ui` badge tone. */
export function mapChatStatusTone(status: ChatStatus): BadgeTone {
  switch (status) {
    case 'requested':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'active':
      return 'booked';
    case 'return_due':
      return 'pending';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Maps a conversation status to its ngx-translate label key. */
export function mapChatStatusLabelKey(status: ChatStatus): string {
  switch (status) {
    case 'requested':
      return 'chat.status.requested';
    case 'approved':
      return 'chat.status.approved';
    case 'active':
      return 'chat.status.active';
    case 'return_due':
      return 'chat.status.returnDue';
    case 'closed':
      return 'chat.status.closed';
    default:
      return 'chat.status.closed';
  }
}

export interface ChatSystemMeta {
  readonly icon: string;
  readonly labelKey: string;
}

/** Maps a system message kind to a primeicon + translated label. */
export function mapChatSystemMeta(kind: ChatSystemKind | null): ChatSystemMeta {
  switch (kind) {
    case 'request':
      return { icon: 'pi pi-inbox', labelKey: 'chat.system.request' };
    case 'approved':
      return { icon: 'pi pi-check-circle', labelKey: 'chat.system.approved' };
    case 'handover':
      return {
        icon: 'pi pi-arrow-right-arrow-left',
        labelKey: 'chat.system.handover',
      };
    case 'return':
      return { icon: 'pi pi-replay', labelKey: 'chat.system.return' };
    case 'closed':
      return { icon: 'pi pi-lock', labelKey: 'chat.system.closed' };
    default:
      return { icon: 'pi pi-info-circle', labelKey: 'chat.system.default' };
  }
}
