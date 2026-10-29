/**
 * Catalogue age groups. Shared by the desktop sidebar (`ListingsPageComponent`)
 * and the mobile filter sheet (`ListingsFiltersComponent`). The `value` tokens
 * are the same ones the AI search returns in `AiSearchFilters.ageGroup`.
 */
export const AGE_GROUPS = [
  { value: '0-12', label: '0–1 yr' },
  { value: '12-36', label: '1–3 yr' },
  { value: '36-72', label: '3–6 yr' },
  { value: '72-120', label: '6–10 yr' },
  { value: '120+', label: '10+ yr' },
] as const;
