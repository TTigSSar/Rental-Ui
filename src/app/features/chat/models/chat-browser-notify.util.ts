import type { BrowserNotificationPermission } from '../../notifications/services/browser-notification.service';
import type { ChatRealtimeMessage } from './chat.model';

const BODY_MAX_CHARS = 100;

/**
 * Whether a realtime message should raise an OS notification: the tab is hidden, the
 * permission is granted and the message is a real one or a moderator note from someone else
 * (not own, not a system line). A note may carry no sender (system-authored); it still notifies.
 */
export function shouldNotifyChatMessage(input: {
  message: ChatRealtimeMessage;
  currentUserId: string | null;
  pageHidden: boolean;
  permission: BrowserNotificationPermission;
}): boolean {
  const { message, currentUserId, pageHidden, permission } = input;
  if (!pageHidden || permission !== 'granted' || currentUserId === null) {
    return false;
  }
  if (message.type === 'system') {
    return false;
  }
  if (message.type === 'moderationNote') {
    return message.senderId !== currentUserId;
  }
  return message.senderId !== null && message.senderId !== currentUserId;
}

/** First ~100 characters of the text; null when the message has no text of its own. */
export function chatNotificationSnippet(body: string | null): string | null {
  const text = (body ?? '').replace(/\s+/g, ' ').trim();
  if (text.length === 0) {
    return null;
  }
  return text.length > BODY_MAX_CHARS ? `${text.slice(0, BODY_MAX_CHARS).trimEnd()}…` : text;
}
