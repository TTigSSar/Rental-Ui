import type { LanguageCode } from '../services/language.service';

/** Anything carrying an English `name` plus optional Armenian/Russian names (ADR-062). */
export interface LocalizedCategoryName {
  readonly name: string | null | undefined;
  readonly nameHy?: string | null;
  readonly nameRu?: string | null;
}

function nonBlank(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Picks a category's display name for the active UI language.
 *
 * Category names are data (ADR-062), never i18n keys. A blank or missing hy/ru value falls
 * back to the English `name`, so a label is never empty while the English name exists.
 */
export function categoryDisplayName(category: LocalizedCategoryName, language: LanguageCode): string {
  const localized =
    language === 'hy'
      ? nonBlank(category.nameHy)
      : language === 'ru'
        ? nonBlank(category.nameRu)
        : null;
  return localized ?? category.name ?? '';
}

/**
 * Same as {@link categoryDisplayName} for the flat `categoryName` / `categoryNameHy` /
 * `categoryNameRu` shape used by booking-detail and admin-listing DTOs.
 */
export function flatCategoryDisplayName(
  name: string | null | undefined,
  nameHy: string | null | undefined,
  nameRu: string | null | undefined,
  language: LanguageCode,
): string {
  return categoryDisplayName({ name, nameHy, nameRu }, language);
}
