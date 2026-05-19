import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-ui-empty-state',
  standalone: true,
  imports: [ButtonModule, RouterLink],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input<string>('pi pi-inbox');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly tone = input<'primary' | 'neutral' | 'success'>('primary');
  readonly ctaLabel = input<string | null>(null);
  readonly ctaIcon = input<string>('');
  readonly ctaRouterLink = input<string[] | null>(null);

  @Output() readonly ctaClicked = new EventEmitter<void>();
}
