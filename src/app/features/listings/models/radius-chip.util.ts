import type { ListingsOriginSource } from './listings-filter.model';

/** The sliver of `TranslateService` this helper needs — declared structurally
 *  so the function stays a pure unit, testable without an Angular injector. */
interface TranslateLike {
  instant(key: string, params?: Record<string, unknown>): string;
}

/**
 * Label for the "applied radius" filter chip.
 *
 * Lives here rather than being written twice because BOTH surfaces build this
 * chip independently — the desktop rail (`ListingsPageComponent`) and the
 * mobile sheet (`ListingsFiltersComponent`) — and the two have already drifted
 * once (M-020's family: one filter serialized differently on two paths).
 *
 * A `'home'` origin gets its own whole sentence ("Within 3 km of home",
 * approved design section (a), tab "Radius picked · 3 km") rather than the
 * generic "{distance} · from you" suffix form. Two reasons it cannot be a
 * swapped suffix: the chip has to say WHICH point the radius is around, and in
 * Russian/Armenian the phrase declines around the distance rather than
 * appending to it ("В пределах 3 км от дома"), so a suffix would produce
 * grammatical nonsense in two of the three languages.
 */
export function radiusChipLabel(
  distanceLabel: string,
  source: ListingsOriginSource | null,
  translate: TranslateLike,
): string {
  if (source === 'home') {
    return translate.instant('listings.filters.distance.withinHome', {
      distance: distanceLabel,
    });
  }
  return `${distanceLabel} · ${translate.instant('listings.filters.distance.chipSuffix')}`;
}
