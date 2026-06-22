import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface FilterTab {
  key: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'app-filter-tabs',
  standalone: true,
  templateUrl: './filter-tabs.component.html',
  styleUrl: './filter-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterTabsComponent {
  readonly tabs = input.required<FilterTab[]>();
  readonly active = input.required<string>();
  readonly tabChange = output<string>();
}
