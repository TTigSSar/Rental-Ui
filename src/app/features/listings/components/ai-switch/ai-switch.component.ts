import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

let nextTooltipId = 0;

/**
 * The "AI" switch of the catalogue search (ADR-054, design-notes 1 + stage 1 v2): a pill with a
 * track and knob. 32px visual / 44px hit area (the `::before` outset). Off: white pill, grey
 * track, knob left. On: filled #C24600, white track, knob right. The label "AI" is the same in
 * en/ru/hy; the accessible name is localised by the host (`ariaLabel`).
 *
 * `unavailable` (the daily AI budget is used up, design-notes 13): the switch stays focusable -
 * `aria-disabled`, NOT `disabled` - looks disabled and never toggles. A tap emits `blocked`
 * (the host shows its Note on mobile); with `tooltip` set (desktop) the reason is shown on
 * hover and keyboard focus, wired through `aria-describedby`, and Esc closes it.
 */
@Component({
  selector: 'app-ai-switch',
  standalone: true,
  templateUrl: './ai-switch.component.html',
  styleUrl: './ai-switch.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSwitchComponent {
  readonly checked = input(false);
  readonly ariaLabel = input('');
  /** Budget used up: aria-disabled look, no toggling. */
  readonly unavailable = input(false);
  /** Desktop reason text shown on hover/focus while `unavailable`; empty = no tooltip. */
  readonly tooltip = input('');
  readonly toggled = output<boolean>();
  /** The user tapped while `unavailable`. */
  readonly blocked = output<void>();

  protected readonly tooltipId = `ai-switch-tip-${nextTooltipId++}`;
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  private readonly dismissed = signal(false);

  protected readonly showTooltip = computed(
    () => this.unavailable() && !!this.tooltip() && !this.dismissed() && (this.hovered() || this.focused()),
  );
  protected readonly describedBy = computed(() =>
    this.unavailable() && this.tooltip() ? this.tooltipId : null,
  );

  protected onClick(): void {
    if (this.unavailable()) {
      this.blocked.emit();
      return;
    }
    this.toggled.emit(!this.checked());
  }

  protected onEnter(): void {
    this.dismissed.set(false);
    this.hovered.set(true);
  }

  protected onLeave(): void {
    this.hovered.set(false);
  }

  protected onFocus(): void {
    this.dismissed.set(false);
    this.focused.set(true);
  }

  protected onBlur(): void {
    this.focused.set(false);
  }

  /**
   * WCAG 1.4.13: Esc dismisses the tooltip whether it opened on hover or on focus, so this
   * listens on the document (hover alone does not move focus to the switch). It stays dismissed
   * until the pointer re-enters or focus changes.
   */
  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.showTooltip()) {
      this.dismissed.set(true);
    }
  }
}
