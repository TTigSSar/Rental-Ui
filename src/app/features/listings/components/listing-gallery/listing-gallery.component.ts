import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ListingImage } from '../../models/listing.model';

@Component({
  selector: 'app-listing-gallery',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './listing-gallery.component.html',
  styleUrl: './listing-gallery.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingGalleryComponent {
  readonly images = input.required<ListingImage[]>();

  protected readonly activeIndex = signal(0);

  readonly sortedImages = computed(() =>
    [...this.images()].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  readonly mainImage = computed(() => {
    const sorted = this.sortedImages();
    if (sorted.length === 0) {
      return null;
    }
    const idx = this.activeIndex();
    return sorted[idx] ?? sorted[0] ?? null;
  });

  readonly hasMultipleImages = computed(
    () => this.sortedImages().length > 1,
  );

  constructor() {
    effect(() => {
      this.images();
      untracked(() => this.activeIndex.set(0));
    });
  }

  protected selectIndex(index: number): void {
    const length = this.sortedImages().length;
    if (length === 0) {
      return;
    }
    const safe = ((index % length) + length) % length;
    this.activeIndex.set(safe);
  }

  protected goPrev(): void {
    this.selectIndex(this.activeIndex() - 1);
  }

  protected goNext(): void {
    this.selectIndex(this.activeIndex() + 1);
  }

  protected trackByImageId(_index: number, image: ListingImage): string {
    return image.id;
  }
}
