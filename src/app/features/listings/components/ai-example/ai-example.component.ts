import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectAiDescription,
  selectAiExampleSeen,
  selectAiMode,
} from '../../store/listings.selectors';

/** Browse Redesign Stage 1 example panel (design `BW_EX`): a prompt plus the tags it implies. */
export interface AiExamplePrompt {
  readonly textKey: string;
  readonly tagKeys: readonly string[];
}

export const AI_EXAMPLE_PROMPTS: readonly AiExamplePrompt[] = [
  {
    textKey: 'listings.browse.examples.e1.text',
    tagKeys: [
      'listings.browse.examples.e1.tag1',
      'listings.browse.examples.e1.tag2',
      'listings.browse.examples.e1.tag3',
    ],
  },
  {
    textKey: 'listings.browse.examples.e2.text',
    tagKeys: ['listings.browse.examples.e2.tag1', 'listings.browse.examples.e2.tag2'],
  },
];

/**
 * First-use example for the AI search field (design-notes 3, stage 1 v2): shown only the first
 * time the switch is turned on, while the field is empty. Tapping it fills the field with the full
 * example. `withHint` renders the mobile variant instead: one muted line whose example part is a
 * link-styled button doing the same thing. `panel` renders the desktop Browse panel instead: with
 * Smart search on and an empty field it ALWAYS lists two example prompts with tags (not first-use
 * only); clicking one fills the field (no search runs). Session-only (the "seen" flag lives in the store, not in browser storage).
 */
@Component({
  selector: 'app-ai-example',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  templateUrl: './ai-example.component.html',
  styleUrl: './ai-example.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiExampleComponent {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);

  readonly withHint = input(false);
  /** Browse Redesign Stage 1 desktop panel (2 prompts + tags). */
  readonly panel = input(false);
  protected readonly prompts = AI_EXAMPLE_PROMPTS;
  /** Mobile link tapped by a guest: the host opens the existing sign-in dialog. */
  readonly authRequired = output<void>();

  private readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);

  private readonly aiMode = this.store.selectSignal(selectAiMode);
  private readonly description = this.store.selectSignal(selectAiDescription);
  private readonly seen = this.store.selectSignal(selectAiExampleSeen);

  protected readonly visible = computed(
    () => this.aiMode() && !this.seen() && this.description().trim().length === 0,
  );

  protected readonly panelVisible = computed(
    () => this.aiMode() && this.description().trim().length === 0,
  );

  /** A panel card: the prompt text goes into the field; the user decides when to search. */
  protected fill(textKey: string): void {
    const description: string = this.translate.instant(textKey);
    this.store.dispatch(ListingsActions.setAiDescription({ description }));
    this.store.dispatch(ListingsActions.markAiExampleSeen());
  }

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
