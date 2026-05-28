export type ReviewerRole = 'Renter' | 'Owner';

export interface Review {
  readonly id: string;
  readonly bookingId: string;
  readonly listingId: string;
  readonly reviewerId: string;
  readonly revieweeId: string;
  readonly reviewerRole: ReviewerRole;
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: string;
  readonly reviewerFirstName: string;
  readonly reviewerLastName: string;
  readonly reviewerAvatarUrl: string | null;
}

export interface RatingSummary {
  readonly averageRating: number;
  readonly reviewCount: number;
}

export interface CreateReviewRequest {
  readonly bookingId: string;
  readonly rating: number;
  readonly comment?: string | null;
}
