import { findNearestWard } from './utils';

const OPEN_STATUSES = new Set(['open', 'assigned', 'in_progress', 'reopened']);
const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'verified']);

export function isOpenComplaintStatus(status) {
  return OPEN_STATUSES.has(status);
}

export function isResolvedComplaintStatus(status) {
  return RESOLVED_STATUSES.has(status);
}

export function computeHealthScore(open, resolved) {
  const total = open + resolved;
  if (total === 0) return 75;
  const resolutionRate = resolved / total;
  const openPenalty = Math.min(45, open * 1.8);
  return Math.round(Math.max(8, Math.min(98, resolutionRate * 72 + 28 - openPenalty)));
}

export function formatMapPopulation(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/**
 * Assign complaints to nearest ward centroid and recompute open / resolved / health.
 */
export function applyComplaintStats(featureCollection, complaints) {
  if (!featureCollection?.features?.length) return featureCollection;

  const wardList = featureCollection.features.map((f) => ({
    ward_id: f.properties.ward_id,
    ward_name: f.properties.ward_name,
    lat: f.properties.lat,
    lng: f.properties.lng,
  }));

  const stats = Object.fromEntries(wardList.map((w) => [w.ward_id, { open: 0, resolved: 0 }]));
  const hasComplaints = Array.isArray(complaints) && complaints.length > 0;

  if (hasComplaints) {
    for (const c of complaints) {
      if (c.lat == null || c.lng == null) continue;
      let wardId = c.ward_id;
      if (!wardId || !stats[wardId]) {
        const nearest = findNearestWard(wardList, c.lat, c.lng);
        wardId = nearest?.ward_id;
      }
      if (!wardId || !stats[wardId]) continue;
      if (isResolvedComplaintStatus(c.status)) stats[wardId].resolved += 1;
      else if (isOpenComplaintStatus(c.status)) stats[wardId].open += 1;
    }
  }

  return {
    ...featureCollection,
    features: featureCollection.features.map((f) => {
      const id = f.properties.ward_id;
      const s = stats[id];
      const open = hasComplaints ? s.open : (f.properties.open_issues ?? 0);
      const resolved = hasComplaints ? s.resolved : (f.properties.resolved_issues ?? 0);
      return {
        ...f,
        properties: {
          ...f.properties,
          open_issues: open,
          resolved_issues: resolved,
          total_issues: open + resolved,
          health_score: computeHealthScore(open, resolved),
        },
      };
    }),
  };
}
