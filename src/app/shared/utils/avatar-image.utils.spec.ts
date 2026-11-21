import {
  AVATAR_MAX_PIXELS,
  AVATAR_MAX_RAW_BYTES,
  AvatarImageError,
  prepareAvatarImage,
} from './avatar-image.utils';

interface FakeContext {
  fillStyle: string;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: string;
  fillRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
}

describe('prepareAvatarImage (F-U1..F-U5)', () => {
  let context: FakeContext;
  let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toBlob: ReturnType<typeof vi.fn> };
  let close: ReturnType<typeof vi.fn>;
  let createBitmap: ReturnType<typeof vi.fn>;

  function bitmap(width: number, height: number): ImageBitmap {
    return { width, height, close } as unknown as ImageBitmap;
  }

  beforeEach(() => {
    close = vi.fn();
    context = {
      fillStyle: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((cb: BlobCallback) => cb(new Blob(['jpeg'], { type: 'image/jpeg' }))),
    };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : realCreate(tag)) as typeof document.createElement);
    createBitmap = vi.fn(() => Promise.resolve(bitmap(1000, 600)));
    vi.stubGlobal('createImageBitmap', createBitmap);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const pick = (size = 10): File => new File([new Uint8Array(size)], 'photo.png', { type: 'image/png' });

  it('rejects a raw file above 15 MB before decoding (tooLarge)', async () => {
    const big = { size: AVATAR_MAX_RAW_BYTES + 1 } as Blob;
    await expect(prepareAvatarImage(big)).rejects.toMatchObject({ kind: 'tooLarge' });
    expect(createBitmap).not.toHaveBeenCalled();
  });

  it('decodes honouring the EXIF orientation', async () => {
    await prepareAvatarImage(pick());
    expect(createBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
  });

  it('rejects a bitmap above 50 MP (tooLarge) and still closes it', async () => {
    createBitmap.mockResolvedValue(bitmap(10_000, Math.floor(AVATAR_MAX_PIXELS / 10_000) + 1));
    await expect(prepareAvatarImage(pick())).rejects.toMatchObject({ kind: 'tooLarge' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('maps a decode failure (HEIC etc.) to unsupported and never returns the original', async () => {
    createBitmap.mockRejectedValue(new DOMException('nope', 'InvalidStateError'));
    const error = await prepareAvatarImage(pick()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AvatarImageError);
    expect((error as AvatarImageError).kind).toBe('unsupported');
  });

  it('fills white, centre-crops a landscape source to a square and outputs 512x512 q0.85 JPEG', async () => {
    const out = await prepareAvatarImage(pick());

    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(512);
    expect(context.fillStyle).toBe('#ffffff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe('high');
    // 1000x600 -> side 600, x offset 200, y offset 0
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 200, 0, 600, 600, 0, 0, 512, 512);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    expect(out.type).toBe('image/jpeg');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('centre-crops a portrait source on the y axis', async () => {
    createBitmap.mockResolvedValue(bitmap(600, 1000));
    await prepareAvatarImage(pick());
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 200, 600, 600, 0, 0, 512, 512);
  });

  it('treats a null toBlob result as an error and closes the bitmap', async () => {
    canvas.toBlob.mockImplementation((cb: BlobCallback) => cb(null));
    await expect(prepareAvatarImage(pick())).rejects.toMatchObject({ kind: 'unsupported' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('treats a missing 2d context as an error and closes the bitmap', async () => {
    canvas.getContext.mockReturnValue(null);
    await expect(prepareAvatarImage(pick())).rejects.toMatchObject({ kind: 'unsupported' });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
