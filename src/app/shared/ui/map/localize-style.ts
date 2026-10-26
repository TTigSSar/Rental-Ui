/**
 * Pure helpers that turn the checked-in MapTiler style (`public/map/style.json`,
 * with a `{key}` placeholder instead of the API key) into the style object
 * `app-map` hands to MapLibre. No MapLibre/Leaflet import here — the style is
 * plain JSON — so this stays trivially unit-testable.
 */

/** Loosely typed on purpose: only the fields this file touches are named. */
export interface MapStyleLike {
  layers?: { id?: string; type?: string; layout?: Record<string, unknown> }[];
  [key: string]: unknown;
}

/** UI languages the OpenMapTiles `name:<lang>` properties exist for (Yerevan
 *  tiles carry hy / ru / en / latin). Anything else falls back to English. */
const SUPPORTED_LANGS = ['hy', 'ru', 'en'];

function normalizeLang(lang: string): string {
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGS.includes(base) ? base : 'en';
}

/** `["coalesce", name:<lang>, name:latin, name]` — the label fallback chain. */
export function nameTextField(lang: string): unknown[] {
  return [
    'coalesce',
    ['get', `name:${normalizeLang(lang)}`],
    ['get', 'name:latin'],
    ['get', 'name'],
  ];
}

const LEGACY_NAME_TOKEN = /\{name(?::[A-Za-z_-]+)?\}/;

/** `true` when an expression contains `["get", "name"]` / `["get", "name:xx"]` anywhere. */
function expressionReadsName(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value[0] === 'get' && typeof value[1] === 'string' && /^name(:|$)/.test(value[1])) {
    return true;
  }
  return value.some(expressionReadsName);
}

/**
 * A legacy zoom function (`{stops: [[z, v], ...]}`) cannot hold expressions as
 * stop values (MapLibre rejects the whole style), so a function that has to
 * carry the localised name is converted to the equivalent `step` expression.
 * Each stop value becomes: the name chain (for a name token), `to-string(get)`
 * for any other whole-value `{prop}` token, or the literal string. Returns
 * `null` (leave the field alone) for a shape it does not understand.
 */
function stopsToStep(stops: unknown[], lang: string): unknown[] | null {
  const values: unknown[] = [];
  for (const stop of stops) {
    if (!Array.isArray(stop) || stop.length !== 2 || typeof stop[0] !== 'number') return null;
    const v = stop[1];
    if (typeof v !== 'string') return null;
    const token = /^\{([^{}]+)\}$/.exec(v);
    if (!token) {
      if (v.includes('{')) return null;
      values.push(v);
    } else if (LEGACY_NAME_TOKEN.test(v)) {
      values.push(nameTextField(lang));
    } else {
      values.push(['to-string', ['get', token[1]]]);
    }
  }
  const out: unknown[] = ['step', ['zoom'], values[0]];
  for (let i = 1; i < stops.length; i++) out.push((stops[i] as unknown[])[0], values[i]);
  return out;
}

/**
 * Rewrites one `text-field` value. Only fields that label a feature's NAME are
 * replaced — in this style that is the legacy `"{name}"` / `"{name:en}"` tokens
 * and `coalesce(name:en, name)`. Layers that label something else keep their
 * own field: `"{housenumber}"` (house numbers), `"{ref}"` (road/highway
 * shields, airport gates) — localising those would blank them. The airport
 * layer's zoom-function (`{stops: [[8," "],[9,"{iata}"],[12,"{name:en}"]]}`)
 * becomes a `step` expression (see `stopsToStep`), so its IATA code at z9
 * survives and only the z12 name changes.
 */
function localizeTextField(value: unknown, lang: string): unknown {
  if (typeof value === 'string') {
    return LEGACY_NAME_TOKEN.test(value) ? nameTextField(lang) : value;
  }
  if (Array.isArray(value)) {
    return expressionReadsName(value) ? nameTextField(lang) : value;
  }
  if (value && typeof value === 'object') {
    const fn = value as { stops?: unknown };
    if (Array.isArray(fn.stops) && JSON.stringify(fn.stops).match(LEGACY_NAME_TOKEN)) {
      return stopsToStep(fn.stops, lang) ?? value;
    }
  }
  return value;
}

/**
 * Deep-copies `style`, substitutes `{key}` (in source URLs, `glyphs`, …) and
 * points every name-labelling symbol layer at `lang`. The input is never
 * mutated — the fetched style is reused when the UI language changes.
 */
export function localizeStyle<T extends MapStyleLike>(style: T, lang: string, key: string): T {
  const copy = JSON.parse(JSON.stringify(style).split('{key}').join(key)) as T;
  for (const layer of copy.layers ?? []) {
    if (layer.type !== 'symbol' || !layer.layout || !('text-field' in layer.layout)) continue;
    layer.layout['text-field'] = localizeTextField(layer.layout['text-field'], lang);
  }
  return copy;
}

/**
 * The `[layerId, text-field]` pairs a language switch must re-apply on the
 * live MapLibre map (`setLayoutProperty`). Derived from the ORIGINAL style so a
 * layer whose field is not a name (`{ref}`, `{housenumber}`) is never touched.
 */
export function localizedTextFields(style: MapStyleLike, lang: string): [string, unknown][] {
  const original = new Map(
    (style.layers ?? []).map((l) => [l.id, JSON.stringify(l.layout?.['text-field'])] as const),
  );
  const out: [string, unknown][] = [];
  for (const layer of localizeStyle(style, lang, '').layers ?? []) {
    if (layer.type !== 'symbol' || !layer.id || !layer.layout || !('text-field' in layer.layout)) {
      continue;
    }
    const field = layer.layout['text-field'];
    if (JSON.stringify(field) !== original.get(layer.id)) out.push([layer.id, field]);
  }
  return out;
}
