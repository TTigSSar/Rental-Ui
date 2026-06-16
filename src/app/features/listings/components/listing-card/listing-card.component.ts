import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ImageContainerComponent } from '../../../../shared/ui/image-container/image-container.component';
import type { ListingPreview } from '../../models/listing.model';

interface AgeRangeDisplay {
  readonly key:
    | 'listings.details.toyDetails.ageRangeFromTo'
    | 'listings.details.toyDetails.ageRangeFromOnly'
    | 'listings.details.toyDetails.ageRangeToOnly';
  readonly params: { from?: number; to?: number };
}

function resolveConditionLabelKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'new':
      return 'listings.details.conditionValues.new';
    case 'likenew':
      return 'listings.details.conditionValues.likeNew';
    case 'good':
      return 'listings.details.conditionValues.good';
    case 'fair':
      return 'listings.details.conditionValues.fair';
    default:
      return null;
  }
}

function resolveAgeRangeDisplay(
  fromMonths: number | null | undefined,
  toMonths: number | null | undefined,
): AgeRangeDisplay | null {
  const hasFrom = typeof fromMonths === 'number' && Number.isFinite(fromMonths);
  const hasTo = typeof toMonths === 'number' && Number.isFinite(toMonths);

  if (hasFrom && hasTo) {
    return {
      key: 'listings.details.toyDetails.ageRangeFromTo',
      params: { from: fromMonths, to: toMonths },
    };
  }
  if (hasFrom) {
    return {
      key: 'listings.details.toyDetails.ageRangeFromOnly',
      params: { from: fromMonths },
    };
  }
  if (hasTo) {
    return {
      key: 'listings.details.toyDetails.ageRangeToOnly',
      params: { to: toMonths },
    };
  }
  return null;
}

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [
    CurrencyPipe,
    DecimalPipe,
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
  readonly isAuthenticated = input<boolean>(false);

  @Output() readonly favoriteToggled = new EventEmitter<string>();

  protected readonly ageRange = computed(() => {
    const listing = this.listing();
    return resolveAgeRangeDisplay(listing.ageFromMonths, listing.ageToMonths);
  });

  protected readonly conditionLabelKey = computed(() =>
    resolveConditionLabelKey(this.listing().condition),
  );

  protected readonly hasHygieneNotes = computed(() => {
    const notes = this.listing().hygieneNotes;
    return typeof notes === 'string' && notes.trim().length > 0;
  });

  protected readonly hasCondition = computed(() => {
    const condition = this.listing().condition;
    return typeof condition === 'string' && condition.trim().length > 0;
  });

  // Age is shown in the image overlay; condition + hygiene in the trust footer row.
  protected readonly showTrustFooter = computed(
    () => this.hasCondition() || this.hasHygieneNotes(),
  );

  protected onFavoriteClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggled.emit(this.listing().id);
  }
}
