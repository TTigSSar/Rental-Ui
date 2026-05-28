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
    external: '/api/auth/external',
  },
  listings: {
    root: '/api/listings',
    byId: (id: string): ApiPath => `/api/listings/${encodeURIComponent(id)}`,
    mine: '/api/listings/mine',
    uploadImages: (id: string): ApiPath =>
      `/api/listings/${encodeURIComponent(id)}/images`,
    archive: (id: string): ApiPath =>
      `/api/listings/${encodeURIComponent(id)}/archive`,
    restore: (id: string): ApiPath =>
      `/api/listings/${encodeURIComponent(id)}/restore`,
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
    create: '/api/bookings',
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
  home: {
    sections: '/api/home/sections',
  },
  reviews: {
    submit: '/api/reviews',
    byListing: (listingId: string): ApiPath =>
      `/api/reviews/listing/${encodeURIComponent(listingId)}`,
    byUser: (userId: string): ApiPath =>
      `/api/reviews/user/${encodeURIComponent(userId)}`,
    listingSummary: (listingId: string): ApiPath =>
      `/api/reviews/listing/${encodeURIComponent(listingId)}/summary`,
    userSummary: (userId: string): ApiPath =>
      `/api/reviews/user/${encodeURIComponent(userId)}/summary`,
  },
  chat: {
    conversations: '/api/chat/conversations',
    conversationById: (conversationId: string): ApiPath =>
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
    messages: '/api/chat/messages',
  },
} as const;
