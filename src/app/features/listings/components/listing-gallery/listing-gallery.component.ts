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
import { ButtonModule } from 'primeng/button';

import type { ListingImage } from '../../models/listing.model';

@Component({
  selector: 'app-listing-gallery',
  standalone: true,
  imports: [ButtonModule, TranslatePipe],
  templateUrl: './listing-gallery.component.html',
  styleUrl: './listing-gallery.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingGalleryComponent {
  readonly images = input.required<ListingImage[]>();

  private readonly activeIndex = signal(0);

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

  constructor() {
    effect(() => {
      this.images();
      untracked(() => this.activeIndex.set(0));
    });
  }

  protected selectThumbnail(index: number): void {
    this.activeIndex.set(index);
  }

  protected trackByImageId(_index: number, image: ListingImage): string {
    return image.id;
  }
}
