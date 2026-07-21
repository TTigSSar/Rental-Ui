/**
 * A minimal valid 1x1 transparent PNG, reused wherever a journey needs *some*
 * image bytes but the actual pixels are irrelevant — map tile stubs
 * (`tile-mock.ts`) and synthetic listing-photo uploads (the create-listing
 * wizard's photo step only checks MIME type and byte size, never content).
 */
export const STUB_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export const STUB_PNG_BUFFER = Buffer.from(STUB_PNG_BASE64, 'base64');
