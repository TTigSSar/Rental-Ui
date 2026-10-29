import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { type KnownApiErrorCode, getApiErrorCode } from './api-error.model';

/**
 * The one place an API failure becomes text a user may read (ADR-045). The server's
 * `title`, `detail`, `errors[]` and raw body are English-only, unlocalised and — on a 500 —
 * can carry a stack trace, so they are NEVER shown, not even as a last-resort fallback.
 *
 * Resolution order: (1) the machine-readable `errorCode` → its i18n key; (2) the HTTP
 * status → a generic key; (3) anything else (a non-HTTP `Error`, a thrown string) →
 * `errors.generic`.
 */

/**
 * Every known `ServiceError` code → its i18n key. A `Record` over the full union, so a code
 * added to `KnownApiErrorCode` without a key here fails to compile. Codes that mean the
 * same thing share a key (every `*.unauthenticated`, every `*.user_blocked`, ...).
 */
export const API_ERROR_MESSAGE_KEYS: Readonly<Record<KnownApiErrorCode, string>> = {
  // admin.*
  'admin.unauthenticated': 'errors.sessionExpired',
  'admin.forbidden': 'errors.forbidden',
  'admin.listing_not_found': 'errors.listingNotFound',
  'admin.invalid_listing_status': 'errors.invalidListingStatus',
  'admin.invalid_reject_reason': 'errors.invalidRejectReason',
  'admin.category_not_found': 'admin.categories.errors.notFound',
  'admin.category_reassign_target_not_found': 'admin.categories.errors.reassignTargetNotFound',
  'admin.category_name_taken': 'admin.categories.errors.nameTaken',
  'admin.category_invalid_name': 'admin.categories.errors.invalidName',
  'admin.category_invalid_color': 'admin.categories.errors.invalidColor',
  'admin.category_order_mismatch': 'admin.categories.errors.orderMismatch',
  'admin.category_reassign_required': 'admin.categories.errors.reassignRequired',
  'admin.category_reassign_invalid': 'admin.categories.errors.reassignInvalid',
  'admin.user_not_found': 'admin.users.errors.userNotFound',
  'admin.cannot_suspend_self': 'admin.users.errors.cannotSuspendSelf',
  'admin.cannot_suspend_admin': 'admin.users.errors.cannotSuspendAdmin',
  'admin.report_not_found': 'admin.reports.errors.reportNotFound',
  'admin.report_target_filter_incomplete': 'errors.validation',
  'admin.report_invalid_target_filter': 'errors.validation',
  'admin.cannot_message_self': 'errors.cannotMessageSelf',
  'admin.cannot_message_admin': 'errors.cannotMessageAdmin',
  // auth.*
  'auth.duplicate_email': 'auth.validation.emailTaken',
  'auth.invalid_credentials': 'errors.invalidCredentials',
  'auth.user_blocked': 'errors.userBlocked',
  'auth.unauthenticated': 'errors.sessionExpired',
  'auth.external_provider_unsupported': 'auth.google.eOff',
  'auth.external_invalid_token': 'auth.google.eFail',
  'auth.external_email_missing': 'auth.google.eFail',
  'auth.external_link_conflict': 'auth.google.eExists',
  'auth.external_pending_registration': 'auth.google.ePending',
  'auth.external_provider_unavailable': 'auth.google.eOff',
  'auth.invalid_name': 'errors.invalidName',
  'auth.invalid_phone': 'auth.phoneStep.error',
  'auth.invalid_language': 'errors.invalidLanguage',
  'auth.email_not_verified': 'errors.emailNotVerified',
  'auth.verification_token_invalid': 'errors.verificationLinkInvalid',
  'auth.verification_token_expired': 'errors.verificationLinkExpired',
  'auth.email_already_verified': 'errors.emailAlreadyVerified',
  'auth.verification_cooldown': 'auth.verification.registerCooldown',
  'auth.registration_unavailable': 'auth.verification.registrationUnavailable',
  'auth.password_reset_unavailable': 'auth.forgot.unS',
  'auth.reset_token_expired': 'errors.resetLinkExpired',
  'auth.reset_token_invalid': 'errors.resetLinkInvalid',
  'auth.invalid_current_password': 'profile.security.errors.invalidCurrentPassword',
  'auth.password_not_set': 'profile.security.errors.passwordNotSet',
  'auth.password_unchanged': 'profile.security.errors.passwordUnchanged',
  'auth.password_too_long': 'profile.security.errors.passwordTooLong',
  'auth.home_point_outside_yerevan': 'homePoint.status.outsideTitle',
  'auth.home_point_in_use': 'profile.homePoint.errorInUse',
  // booking.*
  'booking.unauthenticated': 'errors.sessionExpired',
  'booking.user_blocked': 'errors.userBlocked',
  'booking.listing_not_found': 'errors.listingNotFound',
  'booking.listing_not_approved': 'errors.listingNotAvailable',
  'booking.own_listing_forbidden': 'errors.bookingOwnListing',
  'booking.invalid_dates': 'errors.bookingInvalidDates',
  'booking.note_too_long': 'listings.booking.noteTooLongError',
  'booking.overlap': 'errors.bookingOverlap',
  'booking.not_found': 'errors.bookingNotFound',
  'booking.forbidden': 'errors.forbidden',
  'booking.not_pending': 'errors.bookingNotPending',
  'booking.not_cancellable': 'errors.bookingNotCancellable',
  'booking.not_activatable': 'errors.bookingNotActivatable',
  'booking.not_completable': 'errors.bookingNotCompletable',
  'booking.owner_only': 'errors.ownerOnly',
  'booking.phone_required': 'errors.phoneRequired',
  // ADR-043. Generic (no N): the server sends N only in its English prose, which is never shown.
  'booking.below_min_rental': 'listings.booking.belowMinRentalError',
  // chat.*
  'chat.unauthenticated': 'errors.sessionExpired',
  'chat.user_blocked': 'errors.userBlocked',
  'chat.not_participant': 'errors.forbidden',
  'chat.conversation_not_found': 'errors.conversationNotFound',
  'chat.booking_not_found': 'errors.bookingNotFound',
  'chat.conversation_closed': 'chat.details.readOnly',
  'chat.message_too_long': 'errors.messageTooLong',
  'chat.attachment_too_large': 'chat.details.imageTooLarge',
  'chat.attachment_invalid_type': 'chat.details.imageInvalidType',
  // ADR-053 (share meeting point)
  'chat.meeting_point_owner_only': 'errors.ownerOnly',
  'chat.meeting_point_unavailable': 'errors.meetingPointUnavailable',
  'chat.home_point_required': 'chat.meetingPoint.noHomePoint',
  'chat.meeting_point_invalid': 'errors.validation',
  'chat.meeting_point_outside_yerevan': 'chat.meetingPoint.picker.outside',
  // favorite.*
  'favorite.unauthenticated': 'errors.sessionExpired',
  'favorite.user_blocked': 'errors.userBlocked',
  'favorite.listing_not_found': 'errors.listingNotFound',
  // listing.*
  'listing.unauthenticated': 'errors.sessionExpired',
  'listing.user_blocked': 'errors.userBlocked',
  'listing.not_found': 'errors.listingNotFound',
  'listing.forbidden': 'errors.forbidden',
  'listing.invalid_status': 'errors.invalidListingStatus',
  'listing.category_not_found': 'admin.categories.errors.notFound',
  'listing.home_point_required': 'errors.homePointRequired',
  'listing.phone_required': 'errors.phoneRequired',
  'listing.invalid_age_range': 'myListings.editPage.errors.ageRange',
  'listing.image_empty': 'errors.imageEmpty',
  // The listing upload accepts the same JPEG/PNG/WebP/GIF set and 5 MB cap as chat photos.
  'listing.image_invalid_type': 'chat.details.imageInvalidType',
  'listing.image_too_many': 'errors.imageTooMany',
  'listing.image_listing_limit': 'errors.imageListingLimit',
  'listing.image_too_large': 'chat.details.imageTooLarge',
  'listing.image_not_found': 'errors.imageNotFound',
  'listing.image_invalid_reorder': 'errors.imageInvalidReorder',
  // notification.*
  'notification.unauthenticated': 'errors.sessionExpired',
  'notification.invalid_filter': 'errors.validation',
  'notification.not_found': 'errors.notFound',
  // report.*
  'report.unauthenticated': 'errors.sessionExpired',
  'report.user_blocked': 'reports.dialog.errors.userBlocked',
  'report.invalid_reason': 'reports.dialog.errors.invalidReason',
  'report.invalid_target_type': 'errors.validation',
  'report.target_not_found': 'reports.dialog.errors.targetNotFound',
  'report.cannot_report_own': 'reports.dialog.errors.cannotReportOwn',
  // Callers treat this as an expected outcome (the dialog's "already reported" phase); the
  // key only matters if one doesn't.
  'report.already_reported': 'reports.dialog.alreadyReported.text',
  // review.*
  'review.unauthenticated': 'errors.sessionExpired',
  'review.booking_not_found': 'errors.bookingNotFound',
  'review.booking_not_completed': 'errors.bookingNotCompleted',
  'review.forbidden': 'errors.forbidden',
  'review.user_blocked': 'errors.userBlocked',
  'review.already_submitted': 'errors.reviewAlreadySubmitted',
  // ai_search.*
  'ai_search.unauthenticated': 'errors.sessionExpired',
  'ai_search.invalid_description': 'errors.aiSearchInvalidDescription',
  'ai_search.rate_limited': 'errors.aiSearchRateLimited',
};

/**
 * Interpolation defaults for keys whose copy carries a `{{max}}`. The server sends the
 * limit only inside its English prose, so the UI's own constants are the source:
 * booking note `MAX_NOTE_LENGTH` (280), `ChatService.MaxAttachmentBytes` and
 * `ListingImagesOwnerService.MaxBytesPerFile` (5 MB each), `CHAT_MESSAGE_MAX_LENGTH` (4000),
 * `MaxImagesPerUpload` (10), `MaxImagesPerListing` (20). A caller-supplied param wins.
 */
const API_ERROR_MESSAGE_PARAMS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  'listings.booking.noteTooLongError': { max: 280 },
  'chat.details.imageTooLarge': { max: 5 },
  'errors.messageTooLong': { max: 4000 },
  'errors.imageTooMany': { max: 10 },
  'errors.imageListingLimit': { max: 20 },
};

/** Status → generic key, for failures whose `errorCode` is absent or not (yet) known. */
function statusErrorKey(status: number): string | null {
  switch (status) {
    case 0:
      return 'errors.network';
    case 400:
      return 'errors.validation';
    case 401:
      return 'errors.sessionExpired';
    case 403:
      return 'errors.forbidden';
    case 404:
      return 'errors.notFound';
    case 409:
      return 'errors.conflict';
    case 429:
      return 'errors.tooManyRequests';
    default:
      return status >= 500 ? 'errors.server' : null;
  }
}

function isKnownCode(code: string): code is KnownApiErrorCode {
  return Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGE_KEYS, code);
}

/** The i18n key an API failure resolves to. Pure — reads only the error's `errorCode` and status. */
export function resolveApiErrorKey(error: unknown): string {
  const code = getApiErrorCode(error);
  if (code !== null && isKnownCode(code)) {
    return API_ERROR_MESSAGE_KEYS[code];
  }
  if (error instanceof HttpErrorResponse) {
    return statusErrorKey(error.status) ?? 'errors.generic';
  }
  return 'errors.generic';
}

@Injectable({ providedIn: 'root' })
export class ApiErrorMapper {
  private readonly translate = inject(TranslateService);

  /**
   * The translated, user-safe message for an API failure. Translated at failure time (the
   * string goes straight into store/component state), so it is in the language active when
   * the request failed.
   */
  message(error: unknown, params?: Record<string, unknown>): string {
    const key = resolveApiErrorKey(error);
    const defaults = API_ERROR_MESSAGE_PARAMS[key];
    return this.translate.instant(key, { ...defaults, ...params }) as string;
  }
}
