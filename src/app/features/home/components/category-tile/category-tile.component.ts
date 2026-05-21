import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

export interface HomeCategoryTileVm {
  readonly id: string | null;
  readonly slug: string;
  readonly label: string;
  /** Actual category image from the backend, when provided. */
  readonly imageUrl: string | null;
  /** Backend-provided icon name, used when no image exists. */
  readonly iconName: string | null;
  /** Slug-mapped PrimeIcon class used as the final placeholder fallback. */
  readonly icon: string;
  readonly tintA: string;
  readonly tintB: string;
}

/** Accepts "wrench", "pi-wrench" or "pi pi-wrench" and returns a PrimeIcon class. */
function toPrimeIconClass(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith('pi pi-')) {
    return trimmed;
  }
  if (trimmed.startsWith('pi-')) {
    return `pi ${trimmed}`;
  }
  return `pi pi-${trimmed}`;
}

@Component({
  selector: 'app-home-category-tile',
  standalone: true,
  imports: [],
  templateUrl: './category-tile.component.html',
  styleUrl: './category-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryTileComponent {
  readonly category = input.required<HomeCategoryTileVm>();

  @Output() readonly select = new EventEmitter<HomeCategoryTileVm>();

  /** Icon class shown when no image exists: backend icon if present, else slug fallback. */
  protected iconClass(): string {
    const data = this.category();
    return data.iconName ? toPrimeIconClass(data.iconName) : data.icon;
  }

  protected onClick(): void {
    this.select.emit(this.category());
  }
}
