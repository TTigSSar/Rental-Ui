import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** ADR-056 — "Deleted user" label: plain text, never a link. Font size follows the surface. */
@Component({
  selector: 'app-deleted-user-name',
  standalone: true,
  imports: [TranslatePipe],
  template: '{{ "common.deletedUser" | translate }}',
  styles: [
    `
      :host {
        color: var(--ui-color-text-secondary);
        font-weight: 600;
        line-height: 20px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletedUserNameComponent {}
