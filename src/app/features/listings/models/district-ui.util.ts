import type { LanguageCode } from '../../../shared/services/language.service';
import type { ListingDistrict } from './district.model';

/**
 * Picks the district's display name for the active UI language.
 *
 * District names are served by the backend in all three languages
 * (`nameEn`/`nameHy`/`nameRu`) — they are data, not UI copy, so they must never be
 * routed through ngx-translate/i18n JSON keys. Consumers (the pin-picker district
 * select in P1-6, the detail-page location block in P1-8) should call this instead
 * of reading a single field directly.
 */
export function districtDisplayName(
  district: ListingDistrict,
  language: LanguageCode,
): string {
  switch (language) {
    case 'hy':
      return district.nameHy;
    case 'ru':
      return district.nameRu;
    case 'en':
    default:
      return district.nameEn;
  }
}
