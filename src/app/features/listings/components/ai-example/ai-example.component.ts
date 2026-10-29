import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import * as ListingsActions from '../../store/listings.actions';
import {
  selectAiDescription,
  selectAiExampleSeen,
  selectAiMode,
} from '../../store/listings.selectors';

/**
 * First-use example for the AI search field (design-notes 3, stage 1 v2): shown only the first
 * time the switch is turned on, while the field is empty. Tapping it fills the field with the full
 * example. `withHint` adds the longer "Describe what you're looking for…" line used under the
 * mobile bar. Session-only (the "seen" flag lives in the store, not in browser storage).
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

  private readonly aiMode = this.store.selectSignal(selectAiMode);
  private readonly description = this.store.selectSignal(selectAiDescription);
  private readonly seen = this.store.selectSignal(selectAiExampleSeen);

  protected readonly visible = computed(
    () => this.aiMode() && !this.seen() && this.description().trim().length === 0,
  );

  protected use(): void {
    this.store.dispatch(
      ListingsActions.setAiDescription({
        description: this.translate.instant('listings.ai.example'),
      }),
    );
    this.store.dispatch(ListingsActions.markAiExampleSeen());
  }
}
