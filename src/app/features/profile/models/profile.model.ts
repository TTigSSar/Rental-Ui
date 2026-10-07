import type { HomePoint } from '../../auth/models/auth.models';

// Mirrors CurrentUserResponse (rental-api DTOs/CurrentUserResponse.cs), served by
// GET /api/auth/me. Backend `Role` is a single UserRole enum (serialized as a string
// by the global JsonStringEnumConverter) — this model normalises it to `roles: string[]`
// via resolveRoles(), matching the auth feature's CurrentUser shape. avatarUrl/createdAt/
// isBlocked are captured here even though the UI doesn't currently render them, so this
// model stays an honest mirror of the wire shape rather than silently dropping fields.
export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  preferredLanguage: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  isBlocked: boolean;
  roles: string[];
  /**
   * The signed-in user's home point, or null when they have not set one.
   * SELF-ONLY — `UserProfile` is the /api/auth/me view of the person looking at
   * the screen, never another user's public profile (that is
   * `PublicUserProfile`, which has no home point and must never grow one).
   * `homePoint.latitude`/`longitude` are the EXACT coordinates; only
   * `publicLatitude`/`publicLongitude` may ever be shown to anyone else.
   */
  homePoint: HomePoint | null;
}
