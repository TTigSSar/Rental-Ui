import { Pipe, inject, type PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Compact relative time ("2m", "5h", "3d") for chat timestamps, with a
 * locale-aware "just now" for very recent items. Anything older than a week
 * falls back to an absolute short date so the label stays meaningful.
 */
@Pipe({ name: 'chatTimeAgo', standalone: true })
export class ChatTimeAgoPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) {
      return '';
    }

    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));

    if (diffSec < 60) {
      return this.translate.instant('chat.time.justNow');
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return this.translate.instant('chat.time.minutes', { value: diffMin });
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return this.translate.instant('chat.time.hours', { value: diffHour });
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) {
      return this.translate.instant('chat.time.days', { value: diffDay });
    }

    return new Date(then).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  }
}
