import { HttpErrorResponse } from '@angular/common/http';

import { resolveApiErrorKey } from '../../../api/api-error-mapper';
import { getApiErrorCode } from '../../../api/api-error.model';
import { isAvatarImageError } from '../../../shared/utils/avatar-image.utils';

export const AVATAR_ERROR_UNSUPPORTED = 'profile.avatar.errorUnsupported';
export const AVATAR_ERROR_TOO_LARGE = 'profile.avatar.errorTooLarge';
export const AVATAR_ERROR_BUSY = 'profile.avatar.errorBusy';
export const AVATAR_ERROR_GENERIC = 'profile.avatar.errorGeneric';

/**
 * The `profile.avatar.error*` key for ANY failure of the avatar upload/remove pipeline (ADR-070,
 * design-notes decision 6: exactly four messages, no codes or sizes).
 *
 * - client-side preparation errors: unsupported / tooLarge;
 * - a response WITH an `errorCode`: the mapper's key when it is an avatar key (the six
 *   `auth.avatar_*` codes), otherwise generic;
 * - a response WITHOUT a code: 413 (Kestrel/nginx) and 400 (multipart limits) mean "too large" on
 *   this endpoint; 415, 429 (rate limit - no dedicated copy), 0 (network) and everything else are
 *   generic.
 */
export function avatarErrorKey(error: unknown): string {
  if (isAvatarImageError(error)) {
    return error.kind === 'tooLarge' ? AVATAR_ERROR_TOO_LARGE : AVATAR_ERROR_UNSUPPORTED;
  }
  if (getApiErrorCode(error) !== null) {
    const key = resolveApiErrorKey(error);
    return key.startsWith('profile.avatar.') ? key : AVATAR_ERROR_GENERIC;
  }
  if (error instanceof HttpErrorResponse && (error.status === 413 || error.status === 400)) {
    return AVATAR_ERROR_TOO_LARGE;
  }
  return AVATAR_ERROR_GENERIC;
}
