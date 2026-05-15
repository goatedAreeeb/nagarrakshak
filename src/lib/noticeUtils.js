export const NOTICE_TYPES = [
  { id: 'outbreak', label: 'Outbreak', description: 'Dengue, COVID-like, disease spread' },
  { id: 'emergency', label: 'Emergency', description: 'Immediate city-wide alert' },
  { id: 'health_campaign', label: 'Health campaign', description: 'Vaccination, LPT drives' },
  { id: 'event', label: 'Public event', description: 'Civic programmes, melas' },
  { id: 'advisory', label: 'Advisory', description: 'Weather, safety guidance' },
];

export const NOTICE_STYLES = {
  outbreak: {
    label: 'Outbreak alert',
    border: 'border-red-500/50',
    bg: 'bg-gradient-to-br from-red-950/80 via-red-900/40 to-amber-950/30',
    glow: 'billboard-glow-outbreak',
    badge: 'bg-red-500/25 text-red-100 border-red-400/40',
    icon: 'text-red-300',
    accent: 'text-red-200',
  },
  emergency: {
    label: 'Emergency',
    border: 'border-orange-500/50',
    bg: 'bg-gradient-to-br from-orange-950/70 via-red-950/50 to-black/40',
    glow: 'billboard-glow-emergency',
    badge: 'bg-orange-500/25 text-orange-100 border-orange-400/40',
    icon: 'text-orange-300',
    accent: 'text-orange-200',
  },
  health_campaign: {
    label: 'Health campaign',
    border: 'border-emerald-500/40',
    bg: 'bg-gradient-to-br from-emerald-950/60 via-cyan-950/40 to-black/30',
    glow: 'billboard-glow-health',
    badge: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/35',
    icon: 'text-emerald-300',
    accent: 'text-emerald-200',
  },
  event: {
    label: 'City event',
    border: 'border-violet-500/40',
    bg: 'bg-gradient-to-br from-violet-950/50 via-indigo-950/40 to-black/30',
    glow: 'billboard-glow-event',
    badge: 'bg-violet-500/20 text-violet-100 border-violet-400/35',
    icon: 'text-violet-300',
    accent: 'text-violet-200',
  },
  advisory: {
    label: 'Advisory',
    border: 'border-amber-500/35',
    bg: 'bg-gradient-to-br from-amber-950/40 via-slate-900/50 to-black/30',
    glow: 'billboard-glow-advisory',
    badge: 'bg-amber-500/20 text-amber-100 border-amber-400/35',
    icon: 'text-amber-300',
    accent: 'text-amber-200',
  },
};

export function getNoticeStyle(type) {
  return NOTICE_STYLES[type] || NOTICE_STYLES.advisory;
}

export function getPriorityLabel(priority) {
  if (priority === 1) return 'Critical';
  if (priority === 2) return 'High';
  return 'Info';
}

export function parseGuidance(guidance) {
  if (!guidance?.trim()) return [];
  return guidance
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isNoticeLive(notice, now = new Date()) {
  if (!notice?.is_active) return false;
  const start = notice.starts_at ? new Date(notice.starts_at) : null;
  const end = notice.ends_at ? new Date(notice.ends_at) : null;
  if (start && start > now) return false;
  if (end && end < now) return false;
  return true;
}

export function filterLiveNotices(notices, userZone) {
  const now = new Date();
  return (notices || [])
    .filter((n) => isNoticeLive(n, now))
    .filter((n) => !n.zone || !userZone || n.zone === userZone)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.created_at) - new Date(a.created_at);
    });
}
