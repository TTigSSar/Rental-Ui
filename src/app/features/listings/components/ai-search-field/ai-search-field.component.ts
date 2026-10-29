import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectAiDescription,
  selectAiError,
  selectAiHasSearched,
  selectAiMode,
  selectAiSnapshot,
} from '../../store/listings.selectors';
import { AiSwitchComponent } from '../ai-switch/ai-switch.component';

export const AI_DESCRIPTION_MAX_LENGTH = 500;
/** ~5 lines; the textarea scrolls inside beyond this. */
const TEXTAREA_MAX_HEIGHT_PX = 120;

/**
 * The catalogue search field with the "AI" switch inside (ADR-054, design-notes 1-3, 8).
 *
 * - Switch off: an ordinary search box for the text query `q` (emits `queryChange`).
 * - Switch on: a growing textarea for the description. The description lives in the store and is
 *   NEVER written to `q`/the URL. Enter submits, Shift+Enter is a new line, Esc leaves the field.
 * - `layout="bar"` (mobile sticky bar): the field grows while typing and collapses to one line
 *   with an ellipsis after a search. `layout="block"` (desktop, above the results) stays expanded.
 * - The privacy note shows only while the field has focus (typing), never on the results.
 *
 * The switch is URL-driven: `?ai=1` is the single source of truth (`ListingsPageComponent`
 * mirrors it into the store), so this component only navigates.
 */
@Component({
  selector: 'app-ai-search-field',
  standalone: true,
  imports: [AiSwitchComponent, TranslatePipe],
  templateUrl: './ai-search-field.component.html',
  styleUrl: './ai-search-field.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSearchFieldComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly layout = input<'bar' | 'block'>('bar');
  /** The ordinary text query (switch off). */
  readonly query = input('');
  readonly queryChange = output<string>();
  /** A guest submitted: the host opens the existing sign-in dialog. */
  readonly authRequired = output<void>();

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');

  protected readonly maxLength = AI_DESCRIPTION_MAX_LENGTH;
  protected readonly aiMode = this.store.selectSignal(selectAiMode);
  protected readonly description = this.store.selectSignal(selectAiDescription);
  protected readonly hasSearched = this.store.selectSignal(selectAiHasSearched);
  protected readonly error = this.store.selectSignal(selectAiError);
  private readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  private readonly snapshot = this.store.selectSignal(selectAiSnapshot);

  protected readonly focused = signal(false);
  /** The user tapped the collapsed line to edit it. */
  private readonly editing = signal(false);
  private focusAfterRender = false;

  protected readonly canSubmit = computed(() => this.description().trim().length > 0);
  /** Mobile only: one line with an ellipsis after a search, until the user taps it. */
  protected readonly collapsed = computed(
    () =>
      this.layout() === 'bar' &&
      this.aiMode() &&
      this.hasSearched() &&
      !this.focused() &&
      !this.editing() &&
      this.canSubmit(),
  );
  /** Mobile typing state (text present): switch + round submit move to a bottom row inside the field. */
  protected readonly typing = computed(
    () => this.layout() === 'bar' && this.aiMode() && this.focused() && this.canSubmit(),
  );

  constructor() {
    // Keep the textarea height in step with its content (typing, example fill, switch-on restore).
    effect(() => {
      const el = this.textarea()?.nativeElement;
      this.description();
      if (el) {
        queueMicrotask(() => this.autosize(el));
      }
    });
    // After the user turns the switch on (or taps the collapsed line), put the caret in the field.
    effect(() => {
      const el = this.textarea()?.nativeElement;
      if (el && this.focusAfterRender) {
        this.focusAfterRender = false;
        queueMicrotask(() => el.focus());
      }
    });
    afterNextRender(() => {
      const el = this.textarea()?.nativeElement;
      if (el) this.autosize(el);
    });
  }

  protected onToggle(on: boolean): void {
    const params = this.route.snapshot.queryParams;
    if (on) {
      const snapshot: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') snapshot[key] = value;
      }
      this.focusAfterRender = true;
      this.store.dispatch(ListingsActions.setAiMode({ on: true, snapshot }));
      // The description is not a text query: the plain `q` search is parked (restored on switch-off).
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { ai: '1', q: null },
        queryParamsHandling: 'merge',
      });
      return;
    }
    // Switch-off restores q, filters and view exactly as they were before the switch went on.
    const snapshot = this.snapshot();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: snapshot ? { ...snapshot, ai: null } : { ai: null },
      queryParamsHandling: snapshot ? '' : 'merge',
    });
  }

  protected onQueryInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  protected onDescriptionInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.store.dispatch(ListingsActions.setAiDescription({ description: el.value }));
    this.autosize(el);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.textarea()?.nativeElement.blur();
    }
  }

  protected submit(): void {
    const description = this.description().trim();
    if (!description) return;
    this.textarea()?.nativeElement.blur();
    this.editing.set(false);
    if (!this.isAuthenticated()) {
      // Guest: the description stays in the store; the host opens the sign-in dialog.
      this.authRequired.emit();
      return;
    }
    this.store.dispatch(ListingsActions.submitAiSearch({ description }));
  }

  protected expand(): void {
    this.editing.set(true);
    this.focusAfterRender = true;
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.editing.set(false);
  }

  private autosize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }
}
