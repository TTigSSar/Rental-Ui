import { FormBuilder } from '@angular/forms';

import { passwordsMatchValidator } from './passwords-match.validator';

describe('passwordsMatchValidator', () => {
  const fb = new FormBuilder();

  function buildGroup(newPassword: string, confirmPassword: string) {
    return fb.nonNullable.group(
      { newPassword: [newPassword], confirmPassword: [confirmPassword] },
      { validators: [passwordsMatchValidator('newPassword', 'confirmPassword')] },
    );
  }

  it('is valid when both fields are empty', () => {
    const group = buildGroup('', '');
    expect(group.hasError('passwordsMismatch')).toBe(false);
  });

  it('is valid while only the password field has a value', () => {
    const group = buildGroup('Secret123', '');
    expect(group.hasError('passwordsMismatch')).toBe(false);
  });

  it('is valid while only the confirm field has a value', () => {
    const group = buildGroup('', 'Secret123');
    expect(group.hasError('passwordsMismatch')).toBe(false);
  });

  it('flags a mismatch on the group when both fields differ', () => {
    const group = buildGroup('Secret123', 'Different123');
    expect(group.hasError('passwordsMismatch')).toBe(true);
  });

  it('clears once both fields match', () => {
    const group = buildGroup('Secret123', 'Secret123');
    expect(group.hasError('passwordsMismatch')).toBe(false);
  });

  it('does not mutate the individual controls errors', () => {
    const group = buildGroup('Secret123', 'Different123');
    expect(group.get('confirmPassword')?.errors).toBeNull();
    expect(group.get('newPassword')?.errors).toBeNull();
  });

  it('re-evaluates when a value changes after construction', () => {
    const group = buildGroup('Secret123', 'Secret123');
    expect(group.hasError('passwordsMismatch')).toBe(false);

    group.get('confirmPassword')?.setValue('Changed456');
    expect(group.hasError('passwordsMismatch')).toBe(true);
  });
});
