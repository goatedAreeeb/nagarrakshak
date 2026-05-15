/** Shared map token + style helpers for Mapbox / MapLibre fallbacks. */

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MAPBOX_PLACEHOLDER = 'your-mapbox-public-token';

export function hasValidMapboxToken() {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN !== MAPBOX_PLACEHOLDER);
}

/** Free dark basemap when no Mapbox token (Carto GL, no API key). */
export const MAPLIBRE_DARK_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function getHologramMapStyle() {
  return hasValidMapboxToken()
    ? 'mapbox://styles/mapbox/dark-v11'
    : MAPLIBRE_DARK_STYLE;
}
