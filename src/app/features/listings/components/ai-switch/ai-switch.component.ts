import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * The "AI" switch of the catalogue search (ADR-054, design-notes 1 + stage 1 v2): a pill with a
 * track and knob. 32px visual / 44px hit area (the `::before` outset). Off: white pill, grey
 * track, knob left. On: filled #C24600, white track, knob right. The label "AI" is the same in
 * en/ru/hy; the accessible name is localised by the host (`ariaLabel`).
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
  readonly toggled = output<boolean>();

  protected onClick(): void {
    this.toggled.emit(!this.checked());
  }
}
