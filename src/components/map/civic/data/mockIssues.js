import { randomPoint } from '@turf/random';
import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { ISSUE_CATEGORIES, DEPARTMENTS } from './wardAnalytics';

const issueCache = new Map();

function hashUnit(str, salt = 0) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h << 5) - h + str.charCodeAt(i);
  const x = Math.sin(h + salt) * 10000;
  return x - Math.floor(x);
}

function pick(list, unit) {
  return list[Math.floor(unit * list.length) % list.length];
}

function computeSeverity(ctx, unit) {
  let score = 0;
  if (ctx.duplicateCount >= 4) score += 2;
  if (ctx.daysOpen >= 14) score += 2;
  if (ctx.confirmations >= 6) score += 1;
  if (ctx.escalationLevel >= 3) score += 2;
  if (unit > 0.92) score += 1;
  if (score >= 5) return 'Critical';
  if (score >= 3) return 'High';
  if (score >= 1) return 'Medium';
  return 'Low';
}

export function getCachedIssuesForWard(feature, count = 16) {
  if (!feature?.geometry) return [];

  const wardId = feature.properties?.ward_id ?? 'ward';
  if (issueCache.has(wardId)) return issueCache.get(wardId);

  const box = bbox(feature);
  const inside = randomPoint(count * 4, { bbox: box }).features.filter((pt) =>
    booleanPointInPolygon(pt, feature),
  );

  const issues = inside.slice(0, count).map((pt, i) => {
    const [lng, lat] = pt.geometry.coordinates;
    const duplicateCount = 1 + Math.floor(hashUnit(wardId, i + 2) * 6);
    const daysOpen = Math.floor(hashUnit(wardId, i + 3) * 28);
    const confirmations = Math.floor(hashUnit(wardId, i + 4) * 10);
    const escalationLevel = Math.floor(hashUnit(wardId, i + 5) * 5);
    return {
      id: `${wardId}-issue-${i}`,
      position: [lng, lat],
      category: pick(ISSUE_CATEGORIES, hashUnit(wardId, i + 1)),
      severity: computeSeverity(
        { duplicateCount, daysOpen, confirmations, escalationLevel },
        hashUnit(wardId, i + 6),
      ),
      department: pick(DEPARTMENTS, hashUnit(wardId, i + 7)),
      slaStatus: daysOpen > 10 ? 'Overdue' : 'On track',
      escalationLevel,
      confirmations,
      duplicateCount,
      daysOpen,
    };
  });

  issueCache.set(wardId, issues);
  return issues;
}
