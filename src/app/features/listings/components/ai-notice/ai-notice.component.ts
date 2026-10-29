import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * AI-search notice (stage 3 `.msg`): `info` for "AI is unavailable, showing regular results",
 * `warn` for the rate limit. Announced politely (`role="status"`). The text is projected, so the
 * caller always passes a translated string - never server prose (ADR-045).
 */
@Component({
  selector: 'app-ai-notice',
  standalone: true,
  template: `
    <div class="msg" [class.msg--info]="kind() === 'info'" [class.msg--warn]="kind() === 'warn'" role="status" aria-live="polite">
      <i class="pi" [class.pi-info-circle]="kind() === 'info'" [class.pi-exclamation-triangle]="kind() === 'warn'" aria-hidden="true"></i>
      <span class="msg__text"><ng-content /></span>
    </div>
  `,
  styleUrl: './ai-notice.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiNoticeComponent {
  readonly kind = input<'info' | 'warn'>('info');
}
