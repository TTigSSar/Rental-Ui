/** Minimal wire-shape fixtures for E2E seeds (kept separate from unit fixtures). */
export function e2eListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-e2e-1',
    title: 'E2E Wooden Train Set',
    city: 'Yerevan',
    pricePerDay: 5,
    mainImageUrl: null,
    isFavorite: false,
    ...overrides,
  };
}

export function e2eUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-e2e-1',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    roles: ['User'],
    ...overrides,
  };
}

export function e2eAdmin(overrides: Record<string, unknown> = {}) {
  return e2eUser({ id: 'admin-e2e-1', roles: ['User', 'Admin'], ...overrides });
}

export function e2ePendingListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pending-e2e-1',
    title: 'E2E Toy Kitchen',
    description: 'A play kitchen',
    city: 'Yerevan',
    country: 'Armenia',
    categoryName: 'Toys',
    pricePerDay: 4,
    depositAmount: null,
    imageUrl: null,
    createdAt: '2026-06-20T10:00:00.000Z',
    owner: null,
    ageFromMonths: null,
    ageToMonths: null,
    condition: null,
    hygieneNotes: null,
    safetyNotes: null,
    ...overrides,
  };
}
