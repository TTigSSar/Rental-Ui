import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  signal,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Bottom-sheet breakpoint (matches the SCSS `min-width: 961px` dialog switch). */
const DIALOG_MIN_WIDTH = 961;
const CLOSE_DISTANCE_PX = 100;
const CLOSE_FRACTION = 0.25;
const FLICK_VELOCITY_PX_MS = 0.6;
const FLICK_MIN_DISTANCE_PX = 30;
const CLOSE_BUTTON_SELECTOR = '.ns__close';

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

  protected readonly dragOffset = signal(0);
  protected readonly dragging = signal(false);
  protected readonly snapping = signal(false);

  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragStartTime = 0;

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

  /**
   * Swipe-down-to-close (ADR-061), bottom-sheet layout only. Starts from the handle/header; the
   * release goes through the same `closed` output as X/Esc/backdrop, so a parent that blocks
   * closing (e.g. password save in flight) keeps the sheet — which then snaps back.
   */
  protected onDragStart(event: PointerEvent): void {
    if (window.innerWidth >= DIALOG_MIN_WIDTH || this.dragPointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest(CLOSE_BUTTON_SELECTOR)) return;
    this.dragPointerId = event.pointerId;
    this.dragStartY = event.clientY;
    this.dragStartTime = event.timeStamp;
    this.snapping.set(false);
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected onDragMove(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.dragOffset.set(Math.max(0, event.clientY - this.dragStartY));
  }

  protected onDragEnd(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    const offset = Math.max(0, event.clientY - this.dragStartY);
    const elapsed = Math.max(1, event.timeStamp - this.dragStartTime);
    const height = this.host.nativeElement.querySelector<HTMLElement>('.ns')?.offsetHeight ?? 0;
    const pastThreshold =
      offset > Math.min(CLOSE_DISTANCE_PX, height * CLOSE_FRACTION || CLOSE_DISTANCE_PX);
    const flick = offset > FLICK_MIN_DISTANCE_PX && offset / elapsed > FLICK_VELOCITY_PX_MS;
    this.finishDrag();
    if (pastThreshold || flick) this.closed.emit();
  }

  protected onDragCancel(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.finishDrag();
  }

  /** Ends the gesture; if the sheet stays open (below threshold or close blocked) it snaps back. */
  private finishDrag(): void {
    this.dragPointerId = null;
    this.dragging.set(false);
    if (this.dragOffset() > 0) {
      this.snapping.set(true);
      this.dragOffset.set(0);
    }
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
