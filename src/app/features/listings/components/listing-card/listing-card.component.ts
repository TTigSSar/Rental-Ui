import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { ImageContainerComponent } from '../../../../shared/ui/image-container/image-container.component';
import type { ListingPreview } from '../../models/listing.model';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [
    ButtonModule,
    CurrencyPipe,
    ImageContainerComponent,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingCardComponent {
  readonly listing = input.required<ListingPreview>();

  @Output() readonly favoriteToggled = new EventEmitter<string>();

  protected onFavoriteClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggled.emit(this.listing().id);
  }
}
