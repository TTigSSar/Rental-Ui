/**
 * Maps a listing `condition` string to its i18n label key (ADR-042).
 *
 * Canonical values: New, LikeNew, Good, Fair. The legacy values "Excellent"
 * and "Used" found in stored data are accepted as display-only aliases
 * (Excellent -> Like new, Used -> Fair). Unknown or missing values yield null.
 */
export function resolveConditionLabelKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'new':
      return 'listings.details.conditionValues.new';
    case 'likenew':
    case 'excellent':
      return 'listings.details.conditionValues.likeNew';
    case 'good':
      return 'listings.details.conditionValues.good';
    case 'fair':
    case 'used':
      return 'listings.details.conditionValues.fair';
    default:
      return null;
  }
}
