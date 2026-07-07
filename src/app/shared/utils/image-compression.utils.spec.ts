import { compressImageFile, compressImageFiles } from './image-compression.utils';

describe('image-compression.utils', () => {
  it('returns non-image files unchanged', async () => {
    const pdf = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });

    const result = await compressImageFile(pdf);

    expect(result).toBe(pdf);
  });

  it('leaves GIFs untouched to preserve animation', async () => {
    const gif = new File(['gif-bytes'], 'anim.gif', { type: 'image/gif' });

    const result = await compressImageFile(gif);

    expect(result).toBe(gif);
  });

  it('falls back to the original when the image cannot be decoded', async () => {
    const broken = new File(['not-a-real-image'], 'broken.png', { type: 'image/png' });

    const result = await compressImageFile(broken);

    // createImageBitmap rejects on undecodable data; we must not drop the file.
    expect(result).toBe(broken);
  });

  it('preserves order and count across a batch', async () => {
    const files = [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.gif', { type: 'image/gif' }),
    ];

    const result = await compressImageFiles(files);

    expect(result.length).toBe(2);
    expect(result[0]).toBe(files[0]);
    expect(result[1]).toBe(files[1]);
  });
});
