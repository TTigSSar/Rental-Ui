import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorMessageOptions {
  unauthorizedMessage?: string;
  serverErrorMessage?: string;
}

export function toApiErrorMessage(
  error: unknown,
  options?: ApiErrorMessageOptions,
): string {
  if (error instanceof HttpErrorResponse) {
    if (
      typeof error.error === 'object' &&
      error.error !== null &&
      'errors' in error.error &&
      typeof error.error.errors === 'object' &&
      error.error.errors !== null
    ) {
      const validationErrors = Object.values(error.error.errors).flatMap((value) =>
        Array.isArray(value)
          ? value.filter((entry): entry is string => typeof entry === 'string')
          : [],
      );
      if (validationErrors.length > 0) {
        return validationErrors[0];
      }
    }

    if (
      typeof error.error === 'object' &&
      error.error !== null &&
      'detail' in error.error &&
      typeof error.error.detail === 'string' &&
      error.error.detail.length > 0
    ) {
      return error.error.detail;
    }

    if (
      typeof error.error === 'object' &&
      error.error !== null &&
      'title' in error.error &&
      typeof error.error.title === 'string' &&
      error.error.title.length > 0
    ) {
      return error.error.title;
    }

    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }

    if (error.status === 401 && options?.unauthorizedMessage) {
      return options.unauthorizedMessage;
    }
    if (error.status >= 500 && options?.serverErrorMessage) {
      return options.serverErrorMessage;
    }

    return error.message.length > 0 ? error.message : 'Request failed';
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'An unexpected error occurred';
}
