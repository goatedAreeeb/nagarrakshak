import Fuse from 'fuse.js';
import { extractAreaLabel } from '../utils/wardLabels';
import { getFeatureCentroid } from '../utils/wardCentroids';

export function buildSearchIndex(geojson) {
  if (!geojson?.features?.length) return [];
  return geojson.features.map((feature) => {
    const p = feature.properties ?? {};
    const wardName = p.ward_name ?? p.name ?? '';
    const locality = p.locality ?? extractAreaLabel(wardName);
    const zone = p.zone_name ?? 'GHMC Zone';
    const mandal = p.mandal ?? locality;
    const constituency = p.constituency ?? zone;
    const [lng, lat] = getFeatureCentroid(feature);
    const wardNum = wardName.match(/^Ward\s+(\d+)/i)?.[1];
    let subtitle;
    if (wardNum) {
      subtitle = `Ward ${wardNum} · ${zone}`;
    } else if (mandal && mandal.toLowerCase() !== locality.toLowerCase()) {
      subtitle = `${mandal} Mandal`;
    } else {
      subtitle = zone;
    }
    return {
      id: p.ward_id,
      wardName,
      locality,
      zone,
      mandal,
      constituency,
      centroid: [lng, lat],
      label: locality,
      subtitle,
      properties: p,
      feature,
    };
  });
}

const FUSE_OPTIONS = {
  keys: [
    { name: 'locality', weight: 0.38 },
    { name: 'wardName', weight: 0.22 },
    { name: 'mandal', weight: 0.18 },
    { name: 'zone', weight: 0.12 },
    { name: 'constituency', weight: 0.1 },
  ],
  threshold: 0.36,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

export function createFuseIndex(entries) {
  if (!entries?.length) return null;
  return new Fuse(entries, FUSE_OPTIONS);
}

export function searchAreas(fuseInstance, query, limit = 8) {
  const q = query.trim();
  if (!q || !fuseInstance) return [];
  return fuseInstance.search(q, { limit }).map((r) => r.item);
}
