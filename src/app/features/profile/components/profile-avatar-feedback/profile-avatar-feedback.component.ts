import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import { selectAvatarError, selectAvatarStatus } from '../../../auth/store/auth.selectors';

/**
 * What sits UNDER the avatar row (design AvatarStates D/E, PhotoError): the `role="status"`
 * "Uploading photo..." caption while an upload runs, and the inline error panel (`role="alert"`)
 * after a failed upload/remove. Pure store view, no inputs: the page places it under the row of
 * each surface. The old face stays and the avatar stays enabled while the panel is up - using it
 * again is the retry, and the next request clears the panel.
 *
 * `profile.avatar.error*` keys only (four messages, never codes or sizes).
 */
@Component({
  selector: 'app-profile-avatar-feedback',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <!-- The live region is always in the DOM so the caption is announced when it appears. -->
    <div role="status" data-testid="avatar-status">
      @if (uploading()) {
        <p class="paf__status">{{ 'profile.avatar.uploading' | translate }}</p>
      }
    </div>
    @if (errorKey(); as key) {
      <div class="paf__error" role="alert" data-testid="avatar-error">
        <i class="pi pi-exclamation-circle paf__error-icon" aria-hidden="true"></i>
        <span>{{ key | translate }}</span>
      </div>
    }
  `,
  styleUrl: './profile-avatar-feedback.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileAvatarFeedbackComponent {
  private readonly store = inject(Store);

  protected readonly status = this.store.selectSignal(selectAvatarStatus);
  protected readonly errorKey = this.store.selectSignal(selectAvatarError);
  protected readonly uploading = computed(() => this.status() === 'uploading');
}
