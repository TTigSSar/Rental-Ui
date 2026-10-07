import type { MapLatLng } from './map.component';

/**
 * Republic Square, Yerevan — the default map centre for every surface that has
 * to start somewhere before the user has chosen a point.
 *
 * Lives beside `app-map` (rather than inside the location-picker, where it was
 * born) because the picker is only ONE of its consumers: the catalogue map, the
 * Home hero map's fallback origin and `home.effects`' citywide bounding box all
 * read the same constant, and none of them has any business importing a picker
 * component just to learn where Yerevan is.
 */
export const YEREVAN_CENTER: MapLatLng = { lat: 40.1776, lng: 44.5126 };

/** City-level framing — the zoom every "pick a point" surface opens at. */
export const DEFAULT_PICKER_ZOOM = 13;
