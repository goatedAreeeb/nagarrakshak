import { HYDERABAD_NAMED_ANCHORS } from '../data/hyderabadAnchors';

/** Greater Hyderabad bounding box (GHMC + outer ORR belt). */
export const HYDERABAD_BOUNDS = {
  minLat: 17.24,
  maxLat: 17.58,
  minLng: 78.28,
  maxLng: 78.64,
};

/** Hex radius in degrees (~0.85 km) — spacing is tessellated (no gaps). */
export const HEX_RADIUS = 0.0085;

const SQRT3 = Math.sqrt(3);
const DX = SQRT3 * HEX_RADIUS;
const DY = 1.5 * HEX_RADIUS;

const CATEGORIES = [
  'Roads',
  'Sanitation',
  'Drainage',
  'HMWSSB',
  'Traffic',
  'Street Lighting',
  'Public Health',
  'Parks',
];

function haversineDeg(lat1, lng1, lat2, lng2) {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function zoneForPoint(lat, lng) {
  if (lat >= 17.48 && lng <= 78.42) return 'West';
  if (lat >= 17.46 && lng >= 78.5) return 'North';
  if (lat <= 17.34 && lng >= 78.52) return 'East';
  if (lat <= 17.37 && lng <= 78.44) return 'South';
  if (lat <= 17.36) return 'South';
  if (lng >= 78.53) return 'East';
  if (lng <= 78.38) return 'West';
  if (lat >= 17.45) return 'North';
  return 'Central';
}

function stableSeed(id) {
  return ((id * 1103515245 + 12345) >>> 0) % 100000;
}

function defaultStatsForCell(id) {
  const s = stableSeed(id);
  const open = 5 + (s % 35);
  const resolved = 40 + (s % 180);
  const health = Math.max(12, Math.min(92, 55 + ((resolved - open) % 40)));
  return {
    open_issues: open,
    resolved_issues: resolved,
    health_score: health,
    dominant_category: CATEGORIES[s % CATEGORIES.length],
  };
}

function pseudoPopulation(id, zone) {
  const base = { South: 240000, North: 320000, East: 280000, West: 360000, Central: 300000 };
  const s = stableSeed(id + 17);
  return (base[zone] ?? 260000) + (s % 120000) - 60000;
}

/**
 * Build a full honeycomb grid covering Hyderabad.
 * Named anchors claim the nearest cell; remaining cells use zone sector labels.
 */
export function generateHyderabadHexGrid() {
  const cells = [];

  let row = 0;
  for (let lat = HYDERABAD_BOUNDS.minLat + HEX_RADIUS; lat <= HYDERABAD_BOUNDS.maxLat; lat += DY, row++) {
    const rowOffset = (row % 2) * (DX / 2);
    let col = 0;
    for (
      let lng = HYDERABAD_BOUNDS.minLng + HEX_RADIUS + rowOffset;
      lng <= HYDERABAD_BOUNDS.maxLng;
      lng += DX, col++
    ) {
      cells.push({
        lat,
        lng,
        row,
        col,
        zone: zoneForPoint(lat, lng),
        key: `${row}-${col}`,
      });
    }
  }

  const claimed = new Map();
  const sortedAnchors = [...HYDERABAD_NAMED_ANCHORS].sort((a, b) => a.name.localeCompare(b.name));

  for (const anchor of sortedAnchors) {
    let bestIdx = -1;
    let bestDist = Infinity;
    cells.forEach((cell, idx) => {
      if (claimed.has(idx)) return;
      const d = haversineDeg(cell.lat, cell.lng, anchor.lat, anchor.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestDist < HEX_RADIUS * 2.2) {
      claimed.set(bestIdx, {
        ward_name: anchor.name,
        zone: anchor.zone ?? cells[bestIdx].zone,
        is_named: true,
      });
    }
  }

  return cells.map((cell, idx) => {
    const claim = claimed.get(idx);
    const zone = claim?.zone ?? cell.zone;
    const ward_name =
      claim?.ward_name ?? `${zone} · ${String.fromCharCode(65 + (cell.row % 26))}${cell.col + 1}`;
    const id = idx + 1;
    const stats = defaultStatsForCell(id);

    return {
      ward_id: id,
      ward_name,
      lat: cell.lat,
      lng: cell.lng,
      population: pseudoPopulation(id, zone),
      zone,
      is_named: Boolean(claim?.is_named),
      grid_row: cell.row,
      grid_col: cell.col,
      ...stats,
    };
  });
}

export const HYDERABAD_WARDS = generateHyderabadHexGrid();

export const HYDERABAD_MAP_VIEW = {
  longitude: (HYDERABAD_BOUNDS.minLng + HYDERABAD_BOUNDS.maxLng) / 2,
  latitude: (HYDERABAD_BOUNDS.minLat + HYDERABAD_BOUNDS.maxLat) / 2 - 0.02,
  zoom: 9.95,
  pitch: 40,
  bearing: -18,
};
