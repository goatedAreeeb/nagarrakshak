const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const HYDERABAD_BOUNDS = {
  latMin: 17.2,
  latMax: 17.65,
  lngMin: 78.2,
  lngMax: 78.7,
};

export function isWithinHyderabad(lat, lng) {
  return (
    lat >= HYDERABAD_BOUNDS.latMin &&
    lat <= HYDERABAD_BOUNDS.latMax &&
    lng >= HYDERABAD_BOUNDS.lngMin &&
    lng <= HYDERABAD_BOUNDS.lngMax
  );
}

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      ...options,
    });
  });
}

export async function reverseGeocode(lat, lng) {
  if (MAPBOX_TOKEN && MAPBOX_TOKEN !== 'your-mapbox-public-token') {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=en&limit=1`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const name = json.features?.[0]?.place_name;
        if (name) return name;
      }
    } catch {
      /* fall through to OSM */
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      return json.display_name || formatCoordLabel(lat, lng);
    }
  } catch {
    /* ignore */
  }

  return formatCoordLabel(lat, lng);
}

export function formatCoordLabel(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function mapboxStaticUrl(lat, lng) {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your-mapbox-public-token') return null;
  const pin = `pin-l+ffffff(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${lng},${lat},16,0/800x400@2x?access_token=${MAPBOX_TOKEN}`;
}

export function openStreetMapEmbedUrl(lat, lng) {
  const pad = 0.012;
  const bbox = [lng - pad, lat - pad, lng + pad, lat + pad].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}
