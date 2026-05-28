import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

export type StarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-ui-star-rating',
  standalone: true,
  templateUrl: './star-rating.component.html',
  styleUrl: './star-rating.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRatingComponent {
  readonly rating = input<number>(0);
  readonly max = input<number>(5);
  readonly size = input<StarSize>('md');
  readonly readonly = input<boolean>(true);

  readonly ratingChange = output<number>();

  protected readonly hovered = signal<number>(0);

  protected readonly stars = computed(() =>
    Array.from({ length: this.max() }, (_, i) => i + 1),
  );

  protected readonly displayValue = computed(() => {
    if (this.readonly()) return this.rating();
    return this.hovered() > 0 ? this.hovered() : this.rating();
  });

  protected readonly ariaLabel = computed(() => {
    const r = this.rating();
    return r > 0 ? `Rating: ${r} out of ${this.max()}` : 'No rating yet';
  });

  protected isFilled(star: number): boolean {
    return star <= this.displayValue();
  }

  protected onStarClick(star: number): void {
    this.ratingChange.emit(star);
  }

  protected onStarEnter(star: number): void {
    this.hovered.set(star);
  }

  protected onMouseLeave(): void {
    this.hovered.set(0);
  }

  protected onKeydown(event: KeyboardEvent, currentStar: number): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.ratingChange.emit(Math.min(currentStar + 1, this.max()));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.ratingChange.emit(Math.max(currentStar - 1, 1));
    }
  }

  protected starAriaLabel(star: number): string {
    const labels: Record<number, string> = {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Great',
      5: 'Excellent',
    };
    return `${labels[star] ?? star} — ${star} out of ${this.max()}`;
  }
}
