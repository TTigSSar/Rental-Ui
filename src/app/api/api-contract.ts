import { environment } from '../../environments/environment';

type ApiPath = `/${string}`;

const normalizedBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

export function toApiUrl(path: ApiPath): string {
  return `${normalizedBaseUrl}${path}`;
}

export const ApiContract = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    currentUser: '/api/auth/me',
  },
  listings: {
    root: '/api/listings',
    byId: (id: string): ApiPath => `/api/listings/${encodeURIComponent(id)}`,
    mine: '/api/listings/mine',
    uploadImages: (id: string): ApiPath =>
      `/api/listings/${encodeURIComponent(id)}/images`,
  },
  categories: {
    root: '/api/categories',
  },
  favorites: {
    root: '/api/favorites',
    byListingId: (listingId: string): ApiPath =>
      `/api/favorites/${encodeURIComponent(listingId)}`,
  },
  bookings: {
    mine: '/api/bookings/mine',
    requests: '/api/bookings/requests',
    approve: (bookingId: string): ApiPath =>
      `/api/bookings/${encodeURIComponent(bookingId)}/approve`,
    reject: (bookingId: string): ApiPath =>
      `/api/bookings/${encodeURIComponent(bookingId)}/reject`,
  },
  adminListings: {
    pending: '/api/admin/listings/pending',
    approve: (listingId: string): ApiPath =>
      `/api/admin/listings/${encodeURIComponent(listingId)}/approve`,
    reject: (listingId: string): ApiPath =>
      `/api/admin/listings/${encodeURIComponent(listingId)}/reject`,
  },
  profile: {
    me: '/api/profile/me',
  },
  chat: {
    conversations: '/api/chat/conversations',
    conversationById: (conversationId: string): ApiPath =>
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
    messages: '/api/chat/messages',
  },
} as const;
