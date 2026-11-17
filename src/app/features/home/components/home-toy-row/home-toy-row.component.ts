import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import type { ListingPreview } from '../../../listings/models/listing.model';
import { ListingCardSkeletonComponent } from '../../../listings/components/listing-card/listing-card-skeleton.component';
import { ListingCardComponent } from '../../../listings/components/listing-card/listing-card.component';

/** Skeleton cards per loading row: four cards plus the peeking fifth (desktop). */
const SKELETON_COUNT = 5;

/**
 * One Home toy row (Stage 1): a horizontal scroller of `app-listing-card`s.
 *
 * Below 1024px it is a touch scroller — 232px cards, snap, no arrows. From
 * 1024px it shows four cards plus the peek of the fifth that sits in the
 * right gutter; the prev/next arrows overlay the row edges and scroll by a
 * page of whole cards. The track bleeds to the Home gutter edges with
 * `--page-gutter` (ADR-063), which `HomePageComponent` defines on `.home`.
 */
@Component({
  selector: 'app-home-toy-row',
  standalone: true,
  imports: [ListingCardComponent, ListingCardSkeletonComponent, IconComponent, TranslatePipe],
  templateUrl: './home-toy-row.component.html',
  styleUrl: './home-toy-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeToyRowComponent {
  readonly items = input<readonly ListingPreview[]>([]);
  /** Show card-shaped skeletons instead of `items`. */
  readonly loading = input<boolean>(false);
  /** Ids of the viewer's own listings: no favourite button, owner link. */
  readonly ownIds = input<ReadonlySet<string>>(new Set<string>());

  readonly favoriteToggled = output<string>();

  protected readonly skeletonItems = Array.from({ length: SKELETON_COUNT }, (_, i) => i);

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  protected readonly canScrollPrev = signal(false);
  protected readonly canScrollNext = signal(true);

  constructor() {
    // Arrow state follows the track's size, its content (items / loading) and
    // its scroll position.
    effect((onCleanup) => {
      const track = this.track()?.nativeElement ?? null;
      this.items();
      this.loading();
      if (track === null) {
        return;
      }
      queueMicrotask(() => this.updateArrows());
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.updateArrows());
      observer.observe(track);
      onCleanup(() => observer.disconnect());
    });
  }

  protected updateArrows(): void {
    const track = this.track()?.nativeElement;
    if (!track) {
      return;
    }
    this.canScrollPrev.set(track.scrollLeft > 1);
    this.canScrollNext.set(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }

  /**
   * Scrolls by one page of whole cards (the number that fit between the
   * gutters). Smooth unless the user prefers reduced motion. Inert while the
   * arrow is disabled (`aria-disabled`, not `disabled`, so it stays focusable).
   */
  protected scrollPage(direction: -1 | 1): void {
    const track = this.track()?.nativeElement;
    if (!track || (direction === -1 ? !this.canScrollPrev() : !this.canScrollNext())) {
      return;
    }
    const first = track.firstElementChild as HTMLElement | null;
    if (!first) {
      return;
    }
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap) || 0;
    const gutter = parseFloat(style.paddingLeft) || 0;
    const pitch = first.getBoundingClientRect().width + gap;
    if (pitch <= gap) {
      return;
    }
    const whole = Math.max(1, Math.floor((track.clientWidth - 2 * gutter + gap) / pitch));
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: direction * whole * pitch, behavior: reduced ? 'auto' : 'smooth' });
  }
}
