import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

/** Result emitted on confirm: the reason code, or free text for 'other', or null. */
export interface BookingRejectResult {
  readonly reason: string | null;
}

/**
 * Shared "decline this request" dialog used by every owner surface that can reject a
 * booking (`booking-request-card` on /profile/requests and My Listings, and the
 * `/bookings/:id` details page). Extracted so the four reason codes, the "other requires
 * non-empty text" rule and the i18n keys live in exactly one place — see M-042 for what
 * happens when two owner surfaces are left free to drift apart.
 *
 * Visibility is fully controlled by the parent (`visible` input only, no two-way
 * binding): the parent decides when to show/hide the dialog and reacts to `confirmed` /
 * `cancelled` to do so. The form resets itself every time `visible` flips to true so a
 * previous selection never leaks into the next reject flow.
 *
 * Focus restore: every consumer routes EVERY close path (Escape, header X, mask click,
 * in-dialog Cancel, AND Confirm) through the parent flipping `visible` back to false — see
 * `booking-details-page.component.ts` / `booking-request-card.component.ts`, both of which
 * set their `rejectDialogVisible` signal false synchronously in every one of those handlers.
 * That means watching the `visible` transition itself (same `effect()` this already had for
 * the form reset) is sufficient to cover every exit path without hooking `cancel()`/
 * `confirm()`/`onVisibleChange()` individually. Same `afterRenderEffect` + "pending" signal
 * idiom as `ListingGalleryComponent`'s lightbox and `ListingLocationComponent`'s full-screen
 * map (that pattern traces back to a wizard CTA-vs-"Change" swap fixed in commit `897bbd4`)
 * — the restore runs on the render AFTER close, not synchronously inside the close handler,
 * so a same-tick DOM swap under the trigger can't steal the `.focus()` call.
 */
@Component({
  selector: 'app-booking-reject-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, TranslatePipe],
  templateUrl: './booking-reject-dialog.component.html',
  styleUrl: './booking-reject-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRejectDialogComponent {
  readonly visible = input<boolean>(false);

  readonly confirmed = output<BookingRejectResult>();
  readonly cancelled = output<void>();

  protected readonly reasonCodes = [
    'dates_unavailable',
    'item_unavailable',
    'not_a_fit',
    'other',
  ] as const;

  protected readonly selectedReason = signal<string>('dates_unavailable');
  protected readonly otherText = signal('');

  /** Whatever had focus right before `visible` flipped to true — the trigger button the
   *  caller clicked (or activated via keyboard) to open this dialog. A plain field, not a
   *  signal: nothing in the template reads it. */
  private lastFocusedElement: HTMLElement | null = null;
  /** Sibling of `ListingGalleryComponent.focusReturnPending` — see the class doc comment
   *  for why the restore is deferred to the render after `visible` goes false rather than
   *  run synchronously inside it. */
  private readonly focusReturnPending = signal(false);

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.selectedReason.set('dates_unavailable');
        this.otherText.set('');
        this.lastFocusedElement = document.activeElement as HTMLElement | null;
      } else if (this.lastFocusedElement) {
        // Only queue a restore for a dialog that was actually open — guards the initial
        // construction, where `visible` starts false and this branch would otherwise fire
        // once with nothing captured yet.
        this.focusReturnPending.set(true);
      }
    });

    afterRenderEffect(() => {
      if (!this.focusReturnPending()) return;
      this.restoreFocus();
      this.focusReturnPending.set(false);
    });
  }

  /**
   * Restores focus to the captured trigger, or falls back when it can't: the trigger may
   * have been removed from the DOM or gone non-focusable by the time this runs (a re-render,
   * or the trigger disappearing entirely — e.g. a successful reject changes the booking's
   * status, which swaps the footer that held the "Decline" button, or on
   * `booking-request-card`'s pending-requests list, removes the whole card). Falls back to
   * the app shell's persistent `<main>` landmark (`app.html`'s `<main class="app-shell__
   * content">`, wrapping every routed page) rather than doing nothing: this dialog is shared
   * across features with unrelated page layouts, so it deliberately does NOT reach into a
   * specific consumer's DOM (a heading, a back link) for a fallback target — `<main>` is the
   * one landmark guaranteed to exist regardless of which feature opened it. `<main>` has no
   * native tabindex, so a plain `.focus()` on it is a silent no-op (leaving
   * `document.activeElement` on `<body>` — the exact bug this fix removes); `tabindex="-1"`
   * makes it a valid programmatic focus target without adding it to the Tab order.
   */
  private restoreFocus(): void {
    const target = this.lastFocusedElement;
    this.lastFocusedElement = null;
    if (target && this.isFocusable(target)) {
      target.focus();
      return;
    }
    this.focusFallback();
  }

  private isFocusable(el: HTMLElement): boolean {
    if (!el.isConnected) return false;
    if ((el as Partial<HTMLButtonElement>).disabled) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private focusFallback(): void {
    const main = document.querySelector<HTMLElement>('main') ?? document.body;
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
      // Strip the attribute again once focus actually moves on, rather than immediately
      // after `.focus()` below — removing it in the same tick can blur the element right
      // back out in some browsers.
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
    main.focus();
  }

  /** PrimeNG fires this on any close path (mask click, Escape, header X). */
  protected onVisibleChange(next: boolean): void {
    if (!next) {
      this.cancelled.emit();
    }
  }

  protected onReasonChange(code: string): void {
    this.selectedReason.set(code);
  }

  protected onOtherInput(event: Event): void {
    this.otherText.set((event.target as HTMLTextAreaElement).value);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected confirm(): void {
    const code = this.selectedReason();
    const reason = code === 'other' ? this.otherText().trim() || null : code;
    this.confirmed.emit({ reason });
  }
}
