import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-ui-loading-skeleton',
  standalone: true,
  imports: [SkeletonModule],
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSkeletonComponent {
  readonly items = input<number>(6);

  protected readonly skeletonItems = computed(() => {
    const count = Math.max(1, this.items());
    return Array.from({ length: count }, (_, index) => index);
  });
}
