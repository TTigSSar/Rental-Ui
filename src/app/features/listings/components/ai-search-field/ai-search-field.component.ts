import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectAiBudgetSpent,
  selectAiDailyLimited,
  selectAiDescription,
  selectAiHasSearched,
  selectAiMode,
  selectAiOtherError,
  selectAiRateLimited,
  selectAiSnapshot,
} from '../../store/listings.selectors';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { AiNoticeComponent } from '../ai-notice/ai-notice.component';
import { AiSwitchComponent } from '../ai-switch/ai-switch.component';

let nextNoteId = 0;

export const AI_DESCRIPTION_MAX_LENGTH = 500;
/** How long the mobile "AI search is unavailable today" Note stays after a tap. */
export const AI_BUDGET_NOTE_MS = 5000;
/** ~5 lines; the textarea scrolls inside beyond this. */
const TEXTAREA_MAX_HEIGHT_PX = 120;
/** Textarea line height; anything taller than 1.5 lines at the single-line width counts as wrapped. */
const TEXTAREA_LINE_PX = 24;

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
  imports: [AiNoticeComponent, AiSwitchComponent, IconComponent, TranslatePipe],
  templateUrl: './ai-search-field.component.html',
  styleUrl: './ai-search-field.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSearchFieldComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * `bar` mobile sticky bar; `block` the old desktop block; `browse` the Browse Redesign Stage 1
   * `.bsearch` pill (switch labelled "Smart search", clear, Search button).
   */
  readonly layout = input<'bar' | 'block' | 'browse'>('bar');
  /** The ordinary text query (switch off). */
  readonly query = input('');
  readonly queryChange = output<string>();
  /** A guest submitted: the host opens the existing sign-in dialog. */
  readonly authRequired = output<void>();

  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');
  private readonly browseInput = viewChild<ElementRef<HTMLInputElement>>('browseInput');

  /** Id of the privacy note, wired to the textarea through aria-describedby while it shows. */
  protected readonly noteId = `aisf-privacy-${nextNoteId++}`;
  protected readonly maxLength = AI_DESCRIPTION_MAX_LENGTH;
  protected readonly aiMode = this.store.selectSignal(selectAiMode);
  protected readonly description = this.store.selectSignal(selectAiDescription);
  protected readonly hasSearched = this.store.selectSignal(selectAiHasSearched);
  protected readonly error = this.store.selectSignal(selectAiOtherError);
  /** 429: a warn notice directly under the field (description and cards stay). */
  protected readonly rateLimited = this.store.selectSignal(selectAiRateLimited);
  /** 429 `ai_search.daily_limit`: same warn notice, its own text (no countdown). */
  protected readonly dailyLimited = this.store.selectSignal(selectAiDailyLimited);
  /** Daily budget used up: the switch is aria-disabled and the field is a plain text search. */
  protected readonly budgetSpent = this.store.selectSignal(selectAiBudgetSpent);
  /** Mobile only: the reason Note shown for ~5 s after tapping the disabled switch. */
  protected readonly budgetNote = signal(false);
  private budgetNoteTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  private readonly snapshot = this.store.selectSignal(selectAiSnapshot);

  protected readonly focused = signal(false);
  /** `browse` layout: the live plain-search text (the `query` input only follows after the URL debounce). */
  private readonly plainDraft = signal('');
  protected readonly browseText = computed(() => (this.aiMode() ? this.description() : this.plainDraft()));
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
  /**
   * Mobile: the description wraps to 2+ lines. Measured in `autosize()` against the SINGLE-LINE
   * width (the textarea width while switch + submit sit inline), so moving them to the bottom row
   * (which widens the textarea) can never flip it back and forth.
   */
  readonly multiline = signal(false);
  /** Textarea content width in the inline (single-line) layout; the reference for the wrap test. */
  private singleLineWidth = 0;
  /**
   * Mobile typing state: only once the text wraps, switch + round submit move to a bottom row
   * inside the field. A one-line description keeps the 44px inline look.
   */
  protected readonly typing = computed(
    () =>
      this.layout() === 'bar' &&
      this.aiMode() &&
      this.focused() &&
      this.canSubmit() &&
      this.multiline(),
  );

  constructor() {
    effect(() => this.plainDraft.set(this.query()));
    // Keep the textarea height in step with its content (typing, example fill, switch-on restore).
    effect(() => {
      const el = this.textarea()?.nativeElement;
      this.description();
      if (el) {
        queueMicrotask(() => this.autosize(el));
      }
    });
    // The layout switched (inline <-> bottom row): re-measure the height once it has rendered.
    effect(() => {
      this.typing();
      afterNextRender(
        () => {
          const el = this.textarea()?.nativeElement;
          if (el) this.autosize(el);
        },
        { injector: this.injector },
      );
    });
    // After the user turns the switch on (or taps the collapsed line), put the caret in the field.
    effect(() => {
      const el = this.textarea()?.nativeElement ?? this.browseInput()?.nativeElement;
      if (el && this.focusAfterRender) {
        this.focusAfterRender = false;
        queueMicrotask(() => el.focus());
      }
    });
    this.destroyRef.onDestroy(() => {
      if (this.budgetNoteTimer !== null) clearTimeout(this.budgetNoteTimer);
    });
    afterNextRender(() => {
      const el = this.textarea()?.nativeElement;
      if (el) this.autosize(el);
      // The empty field must always show its whole placeholder: re-measure when the width
      // (wrapping) or the language (placeholder text) changes.
      if (typeof ResizeObserver !== 'undefined') {
        let lastWidth = -1;
        let frame: number | null = null;
        // Only a real WIDTH change re-measures, and the measure runs in the next frame: changing
        // the height inside the observer callback raises "ResizeObserver loop completed with
        // undelivered notifications".
        const observer = new ResizeObserver(() => {
          const target = this.textarea()?.nativeElement;
          if (!target || target.clientWidth === lastWidth) return;
          lastWidth = target.clientWidth;
          if (frame !== null) cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            frame = null;
            const current = this.textarea()?.nativeElement;
            if (current) this.autosize(current);
          });
        });
        observer.observe(this.host.nativeElement);
        this.destroyRef.onDestroy(() => {
          observer.disconnect();
          if (frame !== null) cancelAnimationFrame(frame);
        });
      }
    });
    const langSub = this.translate.onLangChange.subscribe(() => {
      afterNextRender(
        () => {
          const el = this.textarea()?.nativeElement;
          if (el) this.autosize(el);
        },
        { injector: this.injector },
      );
    });
    this.destroyRef.onDestroy(() => langSub.unsubscribe());
  }

  protected onToggle(on: boolean): void {
    const params = this.route.snapshot.queryParams;
    if (on) {
      // Text typed in the simple search becomes the description (shown, not searched until
      // submit). Empty simple field: the stored description, if any, comes back. Never into `q`.
      // Read the live input, not the `query` input (the host debounces it), so no keystroke is lost.
      const carried = (this.queryInput()?.nativeElement.value ?? this.query()).trim();
      const snapshot: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') snapshot[key] = value;
      }
      // The restore snapshot carries the LIVE simple-search text as `q` (the URL may not have
      // caught up with the debounce yet), so switching off brings it back.
      if (carried) snapshot['q'] = carried;
      else if (this.queryInput()) delete snapshot['q'];
      this.focusAfterRender = true;
      this.store.dispatch(ListingsActions.setAiMode({ on: true, snapshot }));
      if (carried) {
        this.store.dispatch(
          ListingsActions.setAiDescription({
            description: carried.slice(0, AI_DESCRIPTION_MAX_LENGTH),
          }),
        );
      }
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

  protected onBrowseQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.plainDraft.set(value);
    this.queryChange.emit(value);
  }

  protected onBrowseDescriptionInput(event: Event): void {
    this.store.dispatch(
      ListingsActions.setAiDescription({ description: (event.target as HTMLInputElement).value }),
    );
  }

  /** The clear x: empties whichever text the bar is showing and keeps the caret in the field. */
  protected onBrowseClear(): void {
    if (this.aiMode()) {
      this.store.dispatch(ListingsActions.setAiDescription({ description: '' }));
    } else {
      this.plainDraft.set('');
      this.queryChange.emit('');
    }
    this.browseInput()?.nativeElement.focus();
    const plain = this.queryInput()?.nativeElement;
    if (plain) {
      plain.value = '';
      plain.focus();
    }
  }

  /** Smart search switch; with the daily AI budget spent it stays aria-disabled (title explains). */
  protected onBrowseSwitch(): void {
    if (this.budgetSpent()) return;
    this.onToggle(!this.aiMode());
  }

  /** Enter / Search button: AI mode runs the search, plain mode applies the text immediately. */
  protected onBrowseSubmit(event: Event): void {
    event.preventDefault();
    if (this.aiMode()) {
      this.submit();
    } else {
      this.queryChange.emit(this.plainDraft());
    }
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

  /** Tap on the aria-disabled switch. Desktop explains on hover/focus; mobile shows a Note. */
  protected onBlockedTap(): void {
    if (this.layout() !== 'bar') return;
    this.budgetNote.set(true);
    if (this.budgetNoteTimer !== null) clearTimeout(this.budgetNoteTimer);
    this.budgetNoteTimer = setTimeout(() => {
      this.budgetNote.set(false);
      this.budgetNoteTimer = null;
    }, AI_BUDGET_NOTE_MS);
  }

  /** `false` while this instance sits in a `display: none` container (the other breakpoint's copy). */
  isVisible(): boolean {
    return this.host.nativeElement.offsetParent !== null;
  }

  /** "Edit description": expand the field, focus it and put the caret at the end. */
  focusEnd(): void {
    const el = this.textarea()?.nativeElement ?? this.browseInput()?.nativeElement;
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
      return;
    }
    // Collapsed one-line state (mobile): expanding focuses the textarea once it renders.
    this.expand();
    afterNextRender(
      () => {
        const target = this.textarea()?.nativeElement;
        if (target) {
          target.focus();
          target.setSelectionRange(target.value.length, target.value.length);
        }
      },
      { injector: this.injector },
    );
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
    // An empty textarea's scrollHeight ignores the placeholder: measure it by filling it briefly,
    // so a placeholder that wraps (hy at 1280) is never clipped.
    const measurePlaceholder = el.value === '' && el.placeholder !== '';
    if (measurePlaceholder) el.value = el.placeholder;
    if (this.layout() === 'bar') this.measureMultiline(el, measurePlaceholder);
    el.style.height = 'auto';
    const height = el.scrollHeight;
    if (measurePlaceholder) el.value = '';
    el.style.height = `${Math.min(height, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }

  /**
   * Sets `multiline` by measuring the text at the single-line width. While the wide (bottom-row)
   * layout is on, the textarea is temporarily set to the remembered single-line width for the
   * measurement (synchronous, never painted), so the verdict does not depend on the layout it drives.
   */
  private measureMultiline(el: HTMLTextAreaElement, isPlaceholder: boolean): void {
    if (isPlaceholder) {
      this.multiline.set(false);
      return;
    }
    const wide = this.typing();
    if (!wide) this.singleLineWidth = el.clientWidth;
    if (wide && this.singleLineWidth > 0) el.style.width = `${this.singleLineWidth}px`;
    el.style.height = 'auto';
    const wrapped = el.scrollHeight > TEXTAREA_LINE_PX * 1.5;
    el.style.width = '';
    this.multiline.set(wrapped);
  }
}
