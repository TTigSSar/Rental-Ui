export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  preferredLanguage: string | null;
  roles: string[];
}
