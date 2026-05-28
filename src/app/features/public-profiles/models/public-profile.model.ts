export interface PublicUserProfile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarUrl: string | null;
  readonly memberSince: string;
  readonly averageRating: number;
  readonly reviewCount: number;
  readonly activeListingsCount: number;
}
