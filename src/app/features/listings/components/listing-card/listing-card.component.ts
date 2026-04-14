import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  input,
  Output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import { ImageContainerComponent } from '../../../../shared/ui/image-container/image-container.component';
import type { ListingPreview } from '../../models/listing.model';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [ButtonModule, CardModule, CurrencyPipe, TranslatePipe, ImageContainerComponent],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingCardComponent {
  readonly listing = input.required<ListingPreview>();

  @Output() readonly favoriteToggled = new EventEmitter<string>();

  protected onFavoriteClick(): void {
    this.favoriteToggled.emit(this.listing().id);
  }
}
