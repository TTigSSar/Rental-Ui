import { localizeStyle, localizedTextFields, nameTextField } from './localize-style';

const style = {
  glyphs: 'https://x/fonts/{fontstack}/{range}.pbf?key={key}',
  sources: { s: { url: 'https://x/tiles.json?key={key}', type: 'vector' } },
  layers: [
    { id: 'bg', type: 'background' },
    {
      id: 'road',
      type: 'symbol',
      layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] },
    },
    { id: 'city', type: 'symbol', layout: { 'text-field': '{name:en}' } },
    { id: 'poi', type: 'symbol', layout: { 'text-field': '{name}' } },
    { id: 'house', type: 'symbol', layout: { 'text-field': '{housenumber}' } },
    { id: 'shield', type: 'symbol', layout: { 'text-field': '{ref}' } },
    { id: 'oneway', type: 'symbol', layout: { 'icon-image': 'arrow' } },
    {
      id: 'airport',
      type: 'symbol',
      layout: {
        'text-field': {
          stops: [
            [8, ' '],
            [9, '{iata}'],
            [12, '{name:en}'],
          ],
        },
      },
    },
    { id: 'fillname', type: 'fill', layout: { 'text-field': '{name}' } },
  ],
};

describe('localizeStyle', () => {
  it('substitutes {key} everywhere and leaves no placeholder', () => {
    const out = localizeStyle(style, 'hy', 'K1');
    expect(JSON.stringify(out)).not.toContain('{key}');
    expect(out.glyphs).toBe('https://x/fonts/{fontstack}/{range}.pbf?key=K1');
    expect((out.sources as typeof style.sources).s.url).toBe('https://x/tiles.json?key=K1');
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(style);
    localizeStyle(style, 'ru', 'K1');
    expect(JSON.stringify(style)).toBe(before);
  });

  it.each(['hy', 'ru', 'en'])('rewrites name labels to the %s fallback chain', (lang) => {
    const out = localizeStyle(style, lang, 'K');
    const field = (id: string) => out.layers?.find((l) => l.id === id)?.layout?.['text-field'];
    const expected = ['coalesce', ['get', `name:${lang}`], ['get', 'name:latin'], ['get', 'name']];
    expect(field('road')).toEqual(expected);
    expect(field('city')).toEqual(expected);
    expect(field('poi')).toEqual(expected);
  });

  it('keeps non-name labels, icon-only layers and non-symbol layers untouched', () => {
    const out = localizeStyle(style, 'hy', 'K');
    const layer = (id: string) => out.layers?.find((l) => l.id === id);
    expect(layer('house')?.layout?.['text-field']).toBe('{housenumber}');
    expect(layer('shield')?.layout?.['text-field']).toBe('{ref}');
    expect(layer('oneway')?.layout).toEqual({ 'icon-image': 'arrow' });
    expect(layer('fillname')?.layout?.['text-field']).toBe('{name}');
  });

  it('turns a zoom-function text-field into a step expression, localising only the name stop', () => {
    const out = localizeStyle(style, 'ru', 'K');
    const field = out.layers?.find((l) => l.id === 'airport')?.layout?.['text-field'];
    expect(field).toEqual([
      'step',
      ['zoom'],
      ' ',
      9,
      ['to-string', ['get', 'iata']],
      12,
      nameTextField('ru'),
    ]);
  });

  it('falls back to English for an unsupported language', () => {
    expect(nameTextField('de')[1]).toEqual(['get', 'name:en']);
    expect(nameTextField('hy-AM')[1]).toEqual(['get', 'name:hy']);
  });
});

describe('localizedTextFields', () => {
  it('lists only the layers whose text-field changes', () => {
    const ids = localizedTextFields(style, 'hy').map(([id]) => id);
    expect(ids).toEqual(['road', 'city', 'poi', 'airport']);
  });
});

// The checked-in MapTiler style, localised for every UI language, must still be a VALID MapLibre
// style: one bad text-field (an expression inside a legacy zoom function) makes MapLibre reject the
// whole style and the map stays blank. `@maplibre/maplibre-gl-style-spec` ships with maplibre-gl.
describe('public/map/style.json', () => {
  it.each(['hy', 'ru', 'en'])('localises to a valid MapLibre style for %s', async (lang) => {
    const raw = (await import('../../../../../public/map/style.json')).default;
    const { validateStyleMin } = await import('@maplibre/maplibre-gl-style-spec');
    expect(JSON.stringify(raw)).not.toMatch(/key=[A-Za-z0-9]{10,}/);
    const localized = localizeStyle(raw, lang, 'test-key');
    const errors = validateStyleMin(localized as never);
    expect(errors.map((e: { message: string }) => e.message)).toEqual([]);
  }, 30000);
});
