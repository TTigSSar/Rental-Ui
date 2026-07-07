import { Pipe, inject, type PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Compact relative time ("2m", "5h", "3d") for notification timestamps, with a
 * locale-aware "just now" for very recent items. Anything older than a week
 * falls back to an absolute short date so the label stays meaningful.
 *
 * Pure by default; callers re-render on data change, which is enough for a feed
 * where exact second-level freshness is not required.
 */
@Pipe({ name: 'notifTimeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) {
      return '';
    }

    const diffMs = Date.now() - then;
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSec < 60) {
      return this.translate.instant('notifications.time.justNow');
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return this.translate.instant('notifications.time.minutes', { value: diffMin });
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return this.translate.instant('notifications.time.hours', { value: diffHour });
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) {
      return this.translate.instant('notifications.time.days', { value: diffDay });
    }

    return new Date(then).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  }
}
