import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type PageHeaderAlign = 'start' | 'center';
export type PageHeaderSpacing = 'compact' | 'comfortable';

@Component({
  selector: 'app-ui-page-header',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
  readonly backLink = input<string>('');
  readonly align = input<PageHeaderAlign>('start');
  readonly spacing = input<PageHeaderSpacing>('comfortable');

  protected readonly hostClasses = computed(() => ({
    'ph': true,
    [`ph--${this.align()}`]: true,
    [`ph--${this.spacing()}`]: true,
  }));
}
