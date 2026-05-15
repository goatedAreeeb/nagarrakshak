import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';

export function cn(...classes) {
  return clsx(classes);
}

export function formatRelativeTime(date) {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date) {
  if (!date) return '';
  return format(new Date(date), 'd MMM yyyy, h:mm a');
}

/** Short ticket label for cards; full UUID available via title / copy. */
export function formatComplaintId(id) {
  if (!id) return '—';
  return `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function severityColor(n) {
  const colors = ['#10b981', '#84cc16', '#f59e0b', '#ef4444', '#dc2626'];
  return colors[Math.min(5, Math.max(1, n)) - 1];
}

export function severityLabel(n) {
  const labels = ['Low', 'Moderate', 'High', 'Critical', 'Emergency'];
  return labels[Math.min(5, Math.max(1, n)) - 1];
}

export function deptIcon(dept) {
  const map = {
    Roads: 'Construction',
    Sanitation: 'Trash2',
    Drainage: 'Droplets',
    HMWSSB: 'Droplet',
    TSSPDCL: 'Zap',
    'Street Lighting': 'Lightbulb',
    'Stray Animals': 'Dog',
    Parks: 'Trees',
    Traffic: 'Car',
    'Traffic Police': 'Car',
    'Women Safety': 'Shield',
    'Public Health': 'HeartPulse',
    'Town Planning': 'Building2',
    Other: 'HelpCircle',
  };
  return map[dept] || 'HelpCircle';
}

export function deptColor(dept) {
  const map = {
    Roads: '#00d4ff',
    Sanitation: '#10b981',
    Drainage: '#3b82f6',
    HMWSSB: '#06b6d4',
    TSSPDCL: '#f59e0b',
    'Street Lighting': '#eab308',
    'Stray Animals': '#a78bfa',
    Parks: '#22c55e',
    Traffic: '#f97316',
    'Traffic Police': '#f97316',
    'Women Safety': '#ec4899',
    'Public Health': '#ef4444',
    'Town Planning': '#8b5cf6',
    Other: '#94a3b8',
  };
  return map[dept] || '#94a3b8';
}

export function roleLabel(role) {
  const map = {
    citizen: 'Citizen',
    worker: 'Field Worker',
    officer: 'Department Officer',
    supervisor: 'Zone Supervisor',
    zonal: 'Zonal Commissioner',
    city: 'City Head',
  };
  return map[role] || role;
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function citizenLevel(credits) {
  if (credits >= 300) return 'Guardian of Hyderabad';
  if (credits >= 200) return 'Civic Champion';
  if (credits >= 100) return 'Active Citizen';
  return 'Citizen';
}

const DEPT_ALIASES = {
  'Traffic Police': 'Traffic',
  'Roads & Infrastructure': 'Roads',
  'Solid Waste Management': 'Sanitation',
  'Drainage & Sewerage': 'Drainage',
  'HMWSSB Water Supply': 'HMWSSB',
  'TSSPDCL Electricity': 'TSSPDCL',
  'Parks & Horticulture': 'Parks',
};

export function normalizeDeptKey(dept) {
  if (!dept) return 'Other';
  const trimmed = String(dept).trim();
  if (ALL_DEPTS.includes(trimmed)) return trimmed;
  if (DEPT_ALIASES[trimmed]) return DEPT_ALIASES[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower.includes('stray') || lower.includes('animal')) return 'Stray Animals';
  if (lower.includes('traffic')) return 'Traffic';
  if (lower.includes('sanitation') || lower.includes('waste')) return 'Sanitation';
  if (lower.includes('road')) return 'Roads';
  if (lower.includes('drain') || lower.includes('sewer')) return 'Drainage';
  if (lower.includes('water')) return 'HMWSSB';
  if (lower.includes('electric')) return 'TSSPDCL';
  if (lower.includes('light')) return 'Street Lighting';
  if (lower.includes('park')) return 'Parks';
  if (lower.includes('fire')) return 'Fire & Safety';
  if (lower.includes('health')) return 'Public Health';
  return trimmed;
}

export const ALL_DEPTS = [
  'Roads',
  'Sanitation',
  'Drainage',
  'HMWSSB',
  'TSSPDCL',
  'Street Lighting',
  'Stray Animals',
  'Parks',
  'Town Planning',
  'Traffic',
  'Women Safety',
  'Public Health',
  'Fire & Safety',
  'Other',
];

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestWard(wards, lat, lng) {
  if (!wards?.length || lat == null || lng == null) return null;
  let best = null;
  let minDist = Infinity;
  wards.forEach((w) => {
    if (w.lat == null || w.lng == null) return;
    const d = haversineMeters(lat, lng, w.lat, w.lng);
    if (d < minDist) {
      minDist = d;
      best = w;
    }
  });
  return best;
}

export function trendingScore(c) {
  return (c.upvote_count || 0) * 2 + (c.same_issue_count || 0) * 4 + (c.severity || 0) * 10;
}
