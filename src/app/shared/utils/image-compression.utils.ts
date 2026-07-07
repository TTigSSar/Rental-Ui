/**
 * Client-side image compression for listing photo uploads.
 *
 * Phone photos are routinely 5–12 MB each, so a handful of them quickly exceeds
 * the reverse proxy's `client_max_body_size` and is rejected with HTTP 413
 * before reaching the API. Downscaling and re-encoding each photo in the browser
 * keeps uploads to a few hundred KB apiece, which also speeds transfers and cuts
 * storage. We resize the longest edge to `maxEdge` and re-encode as JPEG.
 */
export interface ImageCompressionOptions {
  /** Maximum length (px) of the longest image edge. Smaller images are left as-is. */
  maxEdge: number;
  /** JPEG quality between 0 and 1. */
  quality: number;
}

export const DEFAULT_IMAGE_COMPRESSION: ImageCompressionOptions = {
  maxEdge: 1600,
  quality: 0.8,
};

/**
 * Compresses a single image file. Non-image files (or anything the browser
 * cannot decode) are returned unchanged so callers never lose an attachment.
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = DEFAULT_IMAGE_COMPRESSION,
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Corrupt or unsupported image — upload the original rather than dropping it.
    return file;
  }

  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, options.maxEdge / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', options.quality),
    );

    // Keep the original if encoding failed or somehow produced a larger file.
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

/** Compresses every file, preserving order. */
export function compressImageFiles(
  files: File[],
  options: ImageCompressionOptions = DEFAULT_IMAGE_COMPRESSION,
): Promise<File[]> {
  return Promise.all(files.map((file) => compressImageFile(file, options)));
}
