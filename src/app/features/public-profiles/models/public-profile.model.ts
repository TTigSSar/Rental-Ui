export interface HygieneStandard {
  readonly id: string;
  readonly label: string;
  /** icon identifier: spray | checklist | smokefree | shield */
  readonly iconKey: string;
  readonly met: boolean;
}

export interface ReliabilityMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

export interface PublicUserProfile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarUrl: string | null;
  readonly memberSince: string;
  readonly averageRating: number;
  readonly reviewCount: number;
  readonly activeListingsCount: number;
  /** "Yerevan, Armenia" */
  readonly location: string | null;
  readonly isVerified: boolean;
  readonly isIdConfirmed: boolean;
  readonly isEmailPhoneConfirmed: boolean;
  /** As Owner aggregates */
  readonly ownerRating: number | null;
  readonly ownerReviewCount: number;
  readonly completedRentalsAsOwner: number;
  readonly responseRate: number | null;
  readonly hygieneScore: number | null;
  readonly hygieneStandards: readonly HygieneStandard[];
  /** As Renter aggregates */
  readonly renterRating: number | null;
  readonly renterReviewCount: number;
  readonly completedRentalsAsRenter: number;
  readonly onTimeReturnRate: number | null;
  readonly damageClaims: number;
  readonly reliabilityMetrics: readonly ReliabilityMetric[];
}
