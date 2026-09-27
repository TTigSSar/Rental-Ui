import { FormControl } from '@angular/forms';

import { MAX_PASSWORD_BYTES, maxByteLengthValidator } from './max-byte-length.validator';

describe('maxByteLengthValidator', () => {
  it('is valid for an empty value (required validator owns that case)', () => {
    const control = new FormControl('', maxByteLengthValidator(72));
    expect(control.errors).toBeNull();
  });

  it('is valid at exactly the byte limit', () => {
    const control = new FormControl('a'.repeat(72), maxByteLengthValidator(72));
    expect(control.errors).toBeNull();
  });

  it('is invalid one byte over the limit', () => {
    const control = new FormControl('a'.repeat(73), maxByteLengthValidator(72));
    expect(control.errors).toEqual({
      maxByteLength: { requiredBytes: 72, actualBytes: 73 },
    });
  });

  // The case that proves the point: UTF-16 code-unit length (`String.prototype.length`) is
  // not UTF-8 byte length. Armenian and Russian letters are 2 bytes each in UTF-8, so a
  // 72-character Latin passphrase and a 37-character Armenian/Russian one land on opposite
  // sides of the same byte cap even though the Armenian string is barely half as long.
  it('rejects a 37-character Armenian string (74 bytes) while accepting a 72-character Latin string (72 bytes)', () => {
    const armenian = 'ա'.repeat(37); // 2 bytes/char × 37 = 74 bytes
    const latin = 'a'.repeat(72); // 1 byte/char × 72 = 72 bytes

    const armenianControl = new FormControl(armenian, maxByteLengthValidator(MAX_PASSWORD_BYTES));
    const latinControl = new FormControl(latin, maxByteLengthValidator(MAX_PASSWORD_BYTES));

    expect(armenianControl.errors).toEqual({
      maxByteLength: { requiredBytes: 72, actualBytes: 74 },
    });
    expect(latinControl.errors).toBeNull();
  });

  it('rejects a 37-character Russian string the same way', () => {
    const russian = 'ж'.repeat(37); // 2 bytes/char × 37 = 74 bytes
    const control = new FormControl(russian, maxByteLengthValidator(MAX_PASSWORD_BYTES));

    expect(control.errors).toEqual({
      maxByteLength: { requiredBytes: 72, actualBytes: 74 },
    });
  });

  it('accepts a 36-character Armenian/Russian string (72 bytes, the exact limit)', () => {
    const armenian = 'ա'.repeat(36); // 2 bytes/char × 36 = 72 bytes
    const control = new FormControl(armenian, maxByteLengthValidator(MAX_PASSWORD_BYTES));

    expect(control.errors).toBeNull();
  });

  it('counts multi-byte characters (e.g. emoji, 4 UTF-8 bytes) correctly, not by code-unit length', () => {
    // U+1F600 is a surrogate pair in UTF-16 (length 2) but 4 bytes in UTF-8.
    const value = '\u{1F600}'.repeat(18); // 4 bytes/char × 18 = 72 bytes
    const control = new FormControl(value, maxByteLengthValidator(72));
    expect(control.errors).toBeNull();

    const overControl = new FormControl(value + 'a', maxByteLengthValidator(72));
    expect(overControl.errors).toEqual({
      maxByteLength: { requiredBytes: 72, actualBytes: 73 },
    });
  });
});
