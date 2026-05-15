import { extractAreaLabel } from '../utils/wardLabels';

const ISSUE_CATEGORIES = [
  'potholes', 'sewage', 'garbage', 'mosquito breeding', 'water leakage',
  'street lights', 'traffic', 'women safety', 'stray animals', 'unsafe construction',
];

const DEPARTMENTS = [
  'GHMC Sanitation', 'Water Board', 'Electrical', 'Roads & Buildings',
  'Health', 'Traffic Police', 'Women & Child Welfare',
];

const ZONES = ['Central Zone', 'North Zone', 'South Zone', 'East Zone', 'West Zone'];
const MANDALS = ['Ameerpet', 'Amberpet', 'Khairatabad', 'Secunderabad', 'Kukatpally', 'Golnaka', 'Charminar', 'Falaknuma', 'Uppal', 'LB Nagar', 'Jubilee Hills', 'Banjara Hills'];
const CONSTITUENCIES = ['Secunderabad Cantonment', 'Hyderabad', 'Malkajgiri', 'Quthbullapur', 'Serilingampally', 'Khairatabad', 'Amberpet'];

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function seededUnit(seed, salt = 0) {
  const x = Math.sin(seed + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pickFrom(list, seed, salt) {
  return list[Math.floor(seededUnit(seed, salt) * list.length)];
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

export function computeRiskScore(metrics) {
  const { unresolved_complaints, active_complaints, sla_breach_pct, sanitation_risk, women_safety_risk, health_risk, traffic_congestion_score, escalation_count, hotspot_level } = metrics;
  const unresolvedRatio = active_complaints > 0 ? unresolved_complaints / active_complaints : 0;
  return clamp(Math.round(unresolvedRatio * 28 + sla_breach_pct * 0.35 + sanitation_risk * 0.12 + women_safety_risk * 0.1 + health_risk * 0.08 + traffic_congestion_score * 0.07 + escalation_count * 2.2 + hotspot_level * 4.5), 0, 100);
}

export function generateWardAnalytics(wardKey, displayName) {
  const seed = hashSeed(wardKey);
  const active = 12 + Math.floor(seededUnit(seed, 1) * 140);
  const unresolved = Math.floor(active * (0.15 + seededUnit(seed, 2) * 0.65));
  const metrics = {
    ward_id: wardKey, ward_name: displayName, active_complaints: active,
    unresolved_complaints: unresolved, sla_breach_pct: Math.round(5 + seededUnit(seed, 3) * 72),
    sanitation_risk: Math.round(10 + seededUnit(seed, 4) * 90), women_safety_risk: Math.round(8 + seededUnit(seed, 5) * 88),
    health_risk: Math.round(6 + seededUnit(seed, 6) * 85), traffic_congestion_score: Math.round(12 + seededUnit(seed, 7) * 92),
    escalation_count: Math.floor(seededUnit(seed, 8) * 14), hotspot_level: Math.round(seededUnit(seed, 9) * 5),
    dominant_issue_category: pickFrom(ISSUE_CATEGORIES, seed, 11), department: pickFrom(DEPARTMENTS, seed, 12),
  };
  const risk_score = computeRiskScore(metrics);
  return { ...metrics, risk_score, civic_score: clamp(100 - risk_score + Math.floor(seededUnit(seed, 13) * 8), 5, 99), locality: extractAreaLabel(displayName), zone_name: pickFrom(ZONES, seed, 14), mandal: pickFrom(MANDALS, seed, 15), constituency: pickFrom(CONSTITUENCIES, seed, 16) };
}

function wardKeyFromFeature(feature) {
  const p = feature.properties ?? {};
  return String(p['@id'] ?? p.name ?? feature.id ?? 'unknown');
}

function wardNameFromFeature(feature) {
  const p = feature.properties ?? {};
  return p.name ?? p.ward_name ?? `Ward ${wardKeyFromFeature(feature)}`;
}

export function enrichWardCollection(geojson) {
  if (!geojson?.features) return geojson;
  return { ...geojson, features: geojson.features.map((feature) => ({ ...feature, properties: { ...feature.properties, ...generateWardAnalytics(wardKeyFromFeature(feature), wardNameFromFeature(feature)) } })) };
}

export { ISSUE_CATEGORIES, DEPARTMENTS };
