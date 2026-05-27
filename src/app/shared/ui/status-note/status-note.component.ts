import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusNoteTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'app-ui-status-note',
  standalone: true,
  imports: [NgClass],
  templateUrl: './status-note.component.html',
  styleUrl: './status-note.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusNoteComponent {
  readonly tone = input.required<StatusNoteTone>();
  readonly icon = input<string>('');
  readonly title = input<string>('');

  protected readonly containerClasses = computed(() => ({
    'sn': true,
    [`sn--${this.tone()}`]: true,
  }));
}
