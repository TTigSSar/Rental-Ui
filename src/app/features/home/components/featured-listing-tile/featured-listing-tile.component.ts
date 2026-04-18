import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ImageContainerComponent } from '../../../../shared/ui/image-container/image-container.component';
import type { ListingPreview } from '../../../listings/models/listing.model';

@Component({
  selector: 'app-featured-listing-tile',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, TranslatePipe, ImageContainerComponent],
  templateUrl: './featured-listing-tile.component.html',
  styleUrl: './featured-listing-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedListingTileComponent {
  readonly listing = input.required<ListingPreview>();

  @Output() readonly favoriteToggle = new EventEmitter<string>();

  protected onFavoriteClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit(this.listing().id);
  }
}
