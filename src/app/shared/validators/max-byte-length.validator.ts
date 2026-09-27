import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * The server's BCrypt hasher (`BcryptPasswordHasher`) silently ignores everything past the
 * 72nd UTF-8 byte of a password it is given to HASH — see `PasswordPolicy.MaxPasswordBytes` in
 * `rental-api/src/RentalPlatform.Application` and ADR-021's 2026-09-27 amendment
 * (`knowledge/decisions.md`). Kept as one exported constant, referenced from both password-
 * creating forms (register, change-password), so the client limit cannot silently drift from
 * the server's.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * Validates that a control's value is at most `maxBytes` long when UTF-8 encoded —
 * deliberately NOT `value.length` (UTF-16 code units), which undercounts for any character
 * outside the Latin range. A character-based cap is exactly the bug this validator exists to
 * fix: Armenian and Russian letters are 2 bytes each in UTF-8, so 72 of them is 144 bytes.
 *
 * An empty value returns `null` — `Validators.required` owns that case, matching
 * `passwordsMatchValidator`'s convention of staying out of the way of empty fields.
 */
export function maxByteLengthValidator(maxBytes: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null | undefined;
    if (!value) return null;

    const actualBytes = new TextEncoder().encode(value).length;
    if (actualBytes <= maxBytes) return null;

    return { maxByteLength: { requiredBytes: maxBytes, actualBytes } };
  };
}
