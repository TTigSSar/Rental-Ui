import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '../../../../shared/services/language.service';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { resolveConditionLabelKey } from '../../../../shared/utils/listing-condition.utils';
import type { PriceUnit } from '../../../listings/models/create-listing.model';
import { districtDisplayName } from '../../../listings/models/district-ui.util';
import type { ListingPreview } from '../../../listings/models/listing.model';

/** Same three keys as the shared listing card's age badge — the wording is not forked. */
interface AgeRangeDisplay {
  readonly key:
    | 'listings.details.toyDetails.ageRangeFromTo'
    | 'listings.details.toyDetails.ageRangeFromOnly'
    | 'listings.details.toyDetails.ageRangeToOnly';
  readonly params: { from?: number; to?: number };
}

function resolveAgeRange(
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
    return { key: 'listings.details.toyDetails.ageRangeFromOnly', params: { from: fromMonths } };
  }
  if (hasTo) {
    return { key: 'listings.details.toyDetails.ageRangeToOnly', params: { to: toMonths } };
  }
  return null;
}

/** Price suffix per unit (ADR-047). Daily — and an unknown unit — keep the "per day" wording. */
const PRICE_UNIT_SUFFIX_KEYS: Readonly<Partial<Record<PriceUnit, string>>> = {
  Hourly: 'listings.createForm.perUnit.hourly',
  Weekly: 'listings.createForm.perUnit.weekly',
  Monthly: 'listings.createForm.perUnit.monthly',
  Yearly: 'listings.createForm.perUnit.yearly',
};
const PER_DAY_SUFFIX_KEY = 'listings.booking.priceSuffix';

/**
 * Home-only toy card (ADR-064, `Home Redesign Stage 1`). The shared
 * `app-listing-card` is deliberately left alone; unifying the two is a later
 * card.
 *
 * The whole card is the link: the title anchor stretches over the card with a
 * `::after` overlay. The favourite button is a SIBLING of that anchor (never
 * nested in it) stacked above the overlay, so it stays independently
 * focusable and clickable. Layout that depends on the viewport (image ratio,
 * the "View" pill) is CSS-only; the no-photo label follows the card's own
 * width through a container query.
 */
@Component({
  selector: 'app-home-toy-card',
  standalone: true,
  imports: [DecimalPipe, DramCurrencyPipe, RouterLink, TranslatePipe],
  templateUrl: './home-toy-card.component.html',
  styleUrl: './home-toy-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeToyCardComponent {
  private readonly languageService = inject(LanguageService);

  readonly listing = input.required<ListingPreview>();
  /** The viewer's own listing: links to the owner page and has no favourite button. */
  readonly isOwner = input<boolean>(false);

  readonly favoriteToggled = output<string>();

  protected readonly cardLink = computed(() =>
    this.isOwner() ? ['/my-listings', this.listing().id] : ['/listings', this.listing().id],
  );

  protected readonly ageRange = computed(() => {
    const listing = this.listing();
    return resolveAgeRange(listing.ageFromMonths, listing.ageToMonths);
  });

  /** "City, District" (district in the UI language); the city alone without a district. */
  protected readonly locationLabel = computed(() => {
    const listing = this.listing();
    const district = listing.district
      ? districtDisplayName(listing.district, this.languageService.current().code)
      : '';
    return [listing.city, district].filter((part) => part.trim().length > 0).join(', ');
  });

  protected readonly hasRating = computed(() => this.listing().rating != null);

  protected readonly priceSuffixKey = computed(() => {
    const unit = this.listing().priceUnit;
    return (unit && PRICE_UNIT_SUFFIX_KEYS[unit]) || PER_DAY_SUFFIX_KEY;
  });

  protected readonly conditionLabelKey = computed(() =>
    resolveConditionLabelKey(this.listing().condition),
  );

  protected readonly conditionRaw = computed(() => {
    const condition = this.listing().condition;
    return typeof condition === 'string' && condition.trim().length > 0 ? condition : null;
  });

  protected onFavoriteClick(): void {
    this.favoriteToggled.emit(this.listing().id);
  }
}
