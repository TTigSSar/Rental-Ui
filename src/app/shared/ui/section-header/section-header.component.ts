import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SectionHeaderSize = 'sm' | 'md' | 'lg';
export type SectionHeaderAlign = 'start' | 'center';
export type SectionHeaderSpacing = 'compact' | 'comfortable';

@Component({
  selector: 'app-ui-section-header',
  standalone: true,
  imports: [NgClass],
  templateUrl: './section-header.component.html',
  styleUrl: './section-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
  readonly headingId = input<string>('');
  readonly size = input<SectionHeaderSize>('md');
  readonly align = input<SectionHeaderAlign>('start');
  readonly spacing = input<SectionHeaderSpacing>('comfortable');

  protected readonly hostClasses = computed(() => ({
    'sh': true,
    [`sh--${this.size()}`]: true,
    [`sh--${this.align()}`]: true,
    [`sh--${this.spacing()}`]: true,
  }));
}
