import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../../../shared/services/language.service';
import { AgeRangePipe } from '../../../../shared/utils/age-range.pipe';
import { resolveAgeRange } from '../../../../shared/utils/age-range.utils';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { resolveConditionLabelKey } from '../../../../shared/utils/listing-condition.utils';
import type { BookingStatus } from '../../../bookings/models/booking.model';
import type { PriceUnit } from '../../models/create-listing.model';
import { districtDisplayName } from '../../models/district-ui.util';
import type { ListingPreview } from '../../models/listing.model';
import type { ListingsOriginSource } from '../../models/listings-filter.model';
import {
  formatDistanceMeters,
  kmToMeters,
  localeTagForLanguage,
} from '../../models/radius-scale.util';

/** Label key for the booking pill (same keys the card has always used). */
function resolveBookingLabelKey(status: BookingStatus | null | undefined): string | null {
  switch (status) {
    case 'PendingApproval':
    case 'Pending':
      return 'listings.card.bookingBadge.rentalRequested';
    case 'Approved':
      return 'listings.card.bookingBadge.approved';
    case 'Active':
      return 'listings.card.bookingBadge.currentlyRenting';
    case 'ReturnMarked':
      return 'listings.card.bookingBadge.awaitingCompletion';
    case 'Completed':
      return 'listings.card.bookingBadge.previouslyRented';
    case 'Rejected':
      return 'listings.card.bookingBadge.requestDeclined';
    case 'Cancelled':
      return 'listings.card.bookingBadge.cancelled';
    default:
      return null;
  }
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
 * The single shared toy card (ADR-064, amended 2026-11-17): Home rows, the
 * catalogue, favourites and public profiles all render it. The parent sets the
 * width; the image ratio (0.86 mobile / 0.83 desktop) and the "View" pill are
 * viewport-only CSS, and the no-photo label follows the card's own width
 * through a container query.
 *
 * The whole card is the link: the title anchor stretches over the card with a
 * `::after` overlay. The favourite button is a SIBLING of that anchor (never
 * nested in it) stacked above the overlay, so it stays independently focusable
 * and clickable.
 */
@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [AgeRangePipe, DecimalPipe, DramCurrencyPipe, RouterLink, TranslatePipe],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingCardComponent {
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  readonly listing = input.required<ListingPreview>();
  /** Gates the booking pill: a signed-out viewer never sees booking state. */
  readonly isAuthenticated = input<boolean>(false);
  readonly bookingStatus = input<BookingStatus | null | undefined>(undefined);
  /** The viewer's own listing: owner pill, owner link, no favourite button, no distance. */
  readonly isOwner = input<boolean>(false);

  /**
   * Which origin the backend measured `listing.distanceKm` FROM. It no longer
   * changes the look (the distance is a suffix on the location line); it picks
   * the wording of the suffix's tooltip: "from your home" vs "from you".
   */
  readonly distanceOrigin = input<ListingsOriginSource | null>(null);

  readonly favoriteToggled = output<string>();

  protected readonly cardLink = computed(() =>
    this.isOwner() ? ['/my-listings', this.listing().id] : ['/listings', this.listing().id],
  );

  /** "City, District" (district in the UI language); the city alone without a district. */
  protected readonly locationLabel = computed(() => {
    const listing = this.listing();
    const district = listing.district
      ? districtDisplayName(listing.district, this.languageService.current().code)
      : '';
    return [listing.city, district].filter((part) => part.trim().length > 0).join(', ');
  });

  /**
   * Backend haversine distance, formatted — populated when the request carried an origin
   * (a radius filter or sort=nearest; ADR-064 amendment). Shown whenever `distanceKm` is non-null. Never shown on the viewer's own
   * listing (it would narrate their own address back at them).
   */
  protected readonly distanceLabel = computed(() => {
    if (this.isOwner()) return null;
    const km = this.listing().distanceKm;
    if (km == null) return null;
    return formatDistanceMeters(
      kmToMeters(km),
      localeTagForLanguage(this.languageService.current().code),
      {
        meters: this.translate.instant('listings.filters.distance.unitMeters'),
        kilometers: this.translate.instant('listings.filters.distance.unitKilometers'),
      },
    );
  });

  protected readonly distanceTitleKey = computed(() =>
    this.distanceOrigin() === 'home'
      ? 'listings.card.distanceFromHome'
      : 'listings.card.distanceFromYou',
  );

  /** The single top-left pill: rented beats the owner marker, which beats the booking status. */
  protected readonly badge = computed<{
    readonly labelKey: string;
    readonly kind: 'rented' | 'owner' | 'booking';
  } | null>(
    () => {
      if (this.listing().listingStatus === 'rented') {
        return { labelKey: 'listings.card.statusRented', kind: 'rented' };
      }
      if (this.isOwner()) {
        return { labelKey: 'listings.card.yourListing', kind: 'owner' };
      }
      const labelKey = this.isAuthenticated() ? resolveBookingLabelKey(this.bookingStatus()) : null;
      return labelKey ? { labelKey, kind: 'booking' } : null;
    },
  );

  protected readonly hasAgeRange = computed(() => {
    const listing = this.listing();
    return resolveAgeRange(listing.ageFromMonths, listing.ageToMonths) !== null;
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
