import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Group-level cross-field validator for a "new password" + "confirm password" pair. Returns
 * `{ passwordsMismatch: true }` on the GROUP when both named controls have a non-empty value
 * and they differ; `null` otherwise (including while either field is still empty).
 *
 * Deliberately set on the GROUP rather than on the confirm control. A `ValidatorFn` that
 * mutates a *sibling* control's `errors` from inside another control's validation pass is a
 * well-known Angular footgun — `setErrors` re-triggers that control's own `statusChanges`,
 * which can in turn re-run the very group validator that just called it. Reading
 * `form.hasError('passwordsMismatch')` from the template/component is simpler and has no such
 * risk; see `SecurityPageComponent.confirmPasswordErrorKey()` for the read side.
 *
 * An empty confirm field intentionally does NOT raise this error — it renders its own
 * `required` message instead of "passwords don't match" about a field that is simply blank.
 *
 * Generic over the two control names so it isn't tied to one form's field names, but the only
 * caller today is `SecurityPageComponent`'s change-password form.
 */
export function passwordsMatchValidator(
  passwordControlName: string,
  confirmControlName: string,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordControlName)?.value as string | undefined;
    const confirm = group.get(confirmControlName)?.value as string | undefined;

    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordsMismatch: true };
  };
}
