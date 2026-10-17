import type { ToyCondition } from '../../features/listings/models/listing-details.model';

/**
 * Canonicalizes a raw listing `condition` string (ADR-042).
 *
 * Normalization: trim, lowercase, strip spaces/_/-. Canonical values are
 * New, LikeNew, Good, Fair, Poor. The legacy values "Excellent" and "Used"
 * found in stored data are accepted as aliases (Excellent -> LikeNew,
 * Used -> Fair). Unknown or non-string values yield null.
 */
export function normalizeToyCondition(value: unknown): ToyCondition | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'new':
      return 'New';
    case 'likenew':
    case 'excellent':
      return 'LikeNew';
    case 'good':
      return 'Good';
    case 'fair':
    case 'used':
      return 'Fair';
    case 'poor':
      return 'Poor';
    default:
      return null;
  }
}

/** Maps a listing `condition` string to its i18n label key, or null (no label for Poor/unknown). */
export function resolveConditionLabelKey(value: string | null | undefined): string | null {
  switch (normalizeToyCondition(value)) {
    case 'New':
      return 'listings.details.conditionValues.new';
    case 'LikeNew':
      return 'listings.details.conditionValues.likeNew';
    case 'Good':
      return 'listings.details.conditionValues.good';
    case 'Fair':
      return 'listings.details.conditionValues.fair';
    default:
      return null;
  }
}
