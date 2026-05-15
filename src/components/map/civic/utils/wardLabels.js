import { getFeatureCentroid } from './wardCentroids';

export function extractAreaLabel(wardName = '') {
  const trimmed = String(wardName).trim();
  const match = trimmed.match(/^Ward\s+\d+\s+(.+)$/i);
  if (match?.[1]) return match[1];
  return trimmed.replace(/^Ward\s+\d+\s*/i, '').trim() || trimmed;
}

export function buildWardLabelPoints(geojson) {
  if (!geojson?.features?.length) return [];

  return geojson.features.map((feature) => {
    const p = feature.properties ?? {};
    const [lng, lat] = getFeatureCentroid(feature);
    const label = extractAreaLabel(p.ward_name ?? p.name ?? '');

    return {
      position: [lng, lat],
      label,
      wardId: p.ward_id,
      zoomMin: label.length > 14 ? 12 : 11,
    };
  });
}
