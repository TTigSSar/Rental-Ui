import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectAiDescription,
  selectAiExampleSeen,
  selectAiMode,
} from '../../store/listings.selectors';

/**
 * First-use example for the AI search field (design-notes 3, stage 1 v2): shown only the first
 * time the switch is turned on, while the field is empty. Tapping it fills the field with the full
 * example. `withHint` renders the mobile variant instead: one muted line whose example part is a
 * link-styled button doing the same thing. Session-only (the "seen" flag lives in the store, not in browser storage).
 */
@Component({
  selector: 'app-ai-example',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './ai-example.component.html',
  styleUrl: './ai-example.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiExampleComponent {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);

  readonly withHint = input(false);
  /** Mobile link tapped by a guest: the host opens the existing sign-in dialog. */
  readonly authRequired = output<void>();

  private readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);

  private readonly aiMode = this.store.selectSignal(selectAiMode);
  private readonly description = this.store.selectSignal(selectAiDescription);
  private readonly seen = this.store.selectSignal(selectAiExampleSeen);

  protected readonly visible = computed(
    () => this.aiMode() && !this.seen() && this.description().trim().length === 0,
  );

  protected use(): void {
    // Mobile link: the shown text goes in and is searched; desktop box: the full example, fill only.
    const mobile = this.withHint();
    const description: string = this.translate.instant(
      mobile ? 'listings.ai.hintExample' : 'listings.ai.example',
    );
    this.store.dispatch(ListingsActions.setAiDescription({ description }));
    this.store.dispatch(ListingsActions.markAiExampleSeen());
    if (!mobile) return;
    // Same path as the AI field's submit: a guest gets the sign-in dialog (host), else search.
    if (!this.isAuthenticated()) {
      this.authRequired.emit();
      return;
    }
    this.store.dispatch(ListingsActions.submitAiSearch({ description: description.trim() }));
  }
}
