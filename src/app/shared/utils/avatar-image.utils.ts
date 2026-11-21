/**
 * Profile-picture preparation (ADR-070 §1): the browser centre-crops the picked photo to a
 * 512x512 JPEG on a white ground. This is UX (a small upload, no crop screen), NOT security - the
 * server decodes and re-encodes again.
 *
 * Deliberately NOT `compressImageFile`: that helper falls back to returning the ORIGINAL file on
 * any failure, which for an avatar would upload an unprocessed multi-megabyte (possibly HEIC)
 * photo. Here every failure is a typed error and the original is never sent.
 */

/** Raw files above this are refused before any decoding is attempted. */
export const AVATAR_MAX_RAW_BYTES = 15 * 1024 * 1024;
/** Decoded-pixel ceiling (w * h) - a decompression-bomb guard for the canvas. */
export const AVATAR_MAX_PIXELS = 50_000_000;
export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_JPEG_QUALITY = 0.85;

export type AvatarImageErrorKind = 'unsupported' | 'tooLarge';

/** `unsupported` -> `profile.avatar.errorUnsupported`, `tooLarge` -> `profile.avatar.errorTooLarge`. */
export class AvatarImageError extends Error {
  constructor(readonly kind: AvatarImageErrorKind) {
    super(`avatar-image:${kind}`);
    this.name = 'AvatarImageError';
  }
}

export function isAvatarImageError(error: unknown): error is AvatarImageError {
  return error instanceof AvatarImageError;
}

/** Returns a 512x512 `image/jpeg` Blob, or throws an {@link AvatarImageError}. */
export async function prepareAvatarImage(file: Blob): Promise<Blob> {
  if (file.size > AVATAR_MAX_RAW_BYTES) {
    throw new AvatarImageError('tooLarge');
  }

  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the EXIF orientation, so a portrait phone photo is not cropped sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // HEIC/HEIF on browsers that cannot decode it, corrupt data, not an image at all.
    throw new AvatarImageError('unsupported');
  }

  try {
    const { width, height } = bitmap;
    if (width <= 0 || height <= 0) {
      throw new AvatarImageError('unsupported');
    }
    if (width * height > AVATAR_MAX_PIXELS) {
      throw new AvatarImageError('tooLarge');
    }

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new AvatarImageError('unsupported');
    }

    // White ground: transparent PNG/WebP pixels would otherwise turn black in JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const side = Math.min(width, height);
    const sx = Math.floor((width - side) / 2);
    const sy = Math.floor((height - side) / 2);
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', AVATAR_JPEG_QUALITY),
    );
    if (blob === null) {
      throw new AvatarImageError('unsupported');
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
