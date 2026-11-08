import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared container of the Settings sheets (ADR-021 amendment 2026-11-08, ADR-059): a bottom sheet
 * under 961px, a 560px centred dialog above. Owns the backdrop, handle, header (title + 44px
 * close), focus trap, focus restore, body portal and Esc-to-close. Content is projected; an
 * optional footer (`[sheetFooter]`, enabled with `pinnedFooter`) stays pinned under the
 * scrolling body. Scoped to the profile Settings sheets only — other sheets in the app keep
 * their own shells. Same idiom as `CategoryEditSheetComponent` / `RejectSheetComponent`.
 */
@Component({
  selector: 'app-settings-sheet',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './settings-sheet.component.html',
  styleUrl: './settings-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSheetComponent implements OnInit, OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private previouslyFocused: HTMLElement | null = null;

  /** Already-translated dialog title. */
  readonly title = input.required<string>();
  /** True when the `[sheetFooter]` slot is used; switches the body to scroll under a pinned footer. */
  readonly pinnedFooter = input(false);
  /** CSS selector (inside the sheet) of the element to focus on open; defaults to the first focusable. */
  readonly initialFocus = input<string | null>(null);

  readonly closed = output<void>();

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const selector = this.initialFocus();
      const target =
        (selector ? root.querySelector<HTMLElement>(selector) : null) ??
        root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      target?.focus();
    });
  }

  ngOnInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    // Portal: no ancestor stacking context / transform can trap the sheet below the bottom nav.
    document.body.appendChild(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
    this.previouslyFocused?.focus?.();
  }

  /** Parks focus on the stable close button (e.g. when the focused control disappears). */
  focusClose(): void {
    this.host.nativeElement.querySelector<HTMLElement>('.ns__close')?.focus();
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
