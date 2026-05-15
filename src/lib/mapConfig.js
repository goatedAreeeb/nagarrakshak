/** Shared map token + style helpers for Mapbox / MapLibre fallbacks. */

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MAPBOX_PLACEHOLDER = 'your-mapbox-public-token';

export function hasValidMapboxToken() {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN !== MAPBOX_PLACEHOLDER);
}

/** Readable basemap — city labels visible under colored hex layers. */
export const MAPLIBRE_BASE_STYLE =
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

export function getHologramMapStyle() {
  return hasValidMapboxToken()
    ? 'mapbox://styles/mapbox/light-v11'
    : MAPLIBRE_BASE_STYLE;
}
