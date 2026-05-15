const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function hasGoogleMapsKey() {
  const key = GOOGLE_MAPS_KEY;
  return Boolean(key && key !== 'your-google-maps-api-key');
}

export function googleMapsViewUrl(lat, lng, label) {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function googleMapsEmbedUrl(lat, lng, { zoom = 16 } = {}) {
  if (!hasGoogleMapsKey()) return null;
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_KEY,
    q: `${lat},${lng}`,
    zoom: String(zoom),
  });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

export function googleMapsStaticUrl(lat, lng, { width = 640, height = 320, zoom = 16 } = {}) {
  if (!hasGoogleMapsKey()) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    markers: `color:0xffffff|${lat},${lng}`,
    key: GOOGLE_MAPS_KEY,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}
