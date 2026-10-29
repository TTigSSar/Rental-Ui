/**
 * Catalogue age groups. Shared by the desktop sidebar (`ListingsPageComponent`)
 * and the mobile filter sheet (`ListingsFiltersComponent`). The `value` tokens
 * are the same ones the AI search returns in `AiSearchFilters.ageGroup`.
 */
export const AGE_GROUPS = [
  { value: '0-12', labelKey: 'listings.filters.ageGroups.g0_12' },
  { value: '12-36', labelKey: 'listings.filters.ageGroups.g12_36' },
  { value: '36-72', labelKey: 'listings.filters.ageGroups.g36_72' },
  { value: '72-120', labelKey: 'listings.filters.ageGroups.g72_120' },
  { value: '120+', labelKey: 'listings.filters.ageGroups.g120_plus' },
] as const;
