const ROLE_HIERARCHY = ['citizen', 'worker', 'officer', 'supervisor', 'zonal', 'city'];

export function getSLADeadline(slaHours) {
  const d = new Date();
  d.setHours(d.getHours() + slaHours);
  return d;
}

export function getSLAStatus(slaDeadline, slaHours = 48) {
  if (!slaDeadline) {
    return { status: 'pending', hoursLeft: null, label: 'No deadline set', percentLeft: 100 };
  }

  const deadline = new Date(slaDeadline);
  const now = new Date();
  const msLeft = deadline - now;
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const totalMs = slaHours * 60 * 60 * 1000;
  const percentLeft = totalMs > 0 ? (msLeft / totalMs) * 100 : 0;

  if (hoursLeft <= 0) {
    return {
      status: 'breached',
      hoursLeft,
      label: formatTimeLeft(hoursLeft),
      percentLeft: 0,
    };
  }

  if (percentLeft < 20) {
    return {
      status: 'warning',
      hoursLeft,
      label: formatTimeLeft(hoursLeft),
      percentLeft,
    };
  }

  return {
    status: 'safe',
    hoursLeft,
    label: formatTimeLeft(hoursLeft),
    percentLeft,
  };
}

export function getSLAColor(status) {
  switch (status) {
    case 'breached':
      return 'text-accent-red';
    case 'warning':
      return 'text-accent-amber';
    default:
      return 'text-accent-emerald';
  }
}

export function formatTimeLeft(hoursLeft) {
  if (hoursLeft <= 0) {
    const overdue = Math.abs(hoursLeft);
    const h = Math.floor(overdue);
    const m = Math.floor((overdue - h) * 60);
    return `Overdue by ${h}h ${m}m`;
  }
  const h = Math.floor(hoursLeft);
  const m = Math.floor((hoursLeft - h) * 60);
  return `${h}h ${m}m left`;
}

/** Human-readable duration between two ISO timestamps */
export function formatDurationMs(ms) {
  if (ms == null || ms < 0 || Number.isNaN(ms)) return '—';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'Under 1m';
}

export function getResolutionDuration(createdAt, resolvedAt) {
  if (!createdAt || !resolvedAt) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(resolvedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return formatDurationMs(end - start);
}

export function isResolvedStatus(status) {
  return status === 'resolved' || status === 'closed';
}

/** SLA countdown is officer-set and only runs after assignment. */
export function isSlaCountdownActive({ status, sla_deadline, assigned_to } = {}) {
  if (!sla_deadline || isResolvedStatus(status)) return false;
  if (status === 'open') return false;
  return Boolean(assigned_to) || ['assigned', 'in_progress', 'reopened'].includes(status);
}

export function getSlaPendingLabel(status) {
  if (status === 'open') return 'Awaiting assignment';
  return 'Deadline not set';
}

/** Officer-set resolution timelines when assigning a worker. */
export const OFFICER_SLA_OPTIONS = [
  { hours: 2, label: '2 hours — immediate' },
  { hours: 4, label: '4 hours — immediate' },
  { hours: 6, label: '6 hours — urgent' },
  { hours: 8, label: '8 hours — urgent' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours (1 day)' },
  { hours: 48, label: '48 hours (2 days)' },
  { hours: 72, label: '72 hours (3 days)' },
  { hours: 168, label: '1 week' },
];

export function formatSlaHoursLabel(hours) {
  const match = OFFICER_SLA_OPTIONS.find((o) => o.hours === hours);
  if (match) return match.label;
  if (hours < 24) return `${hours} hours`;
  if (hours === 24) return '24 hours (1 day)';
  if (hours % 24 === 0 && hours < 168) return `${hours / 24} days`;
  if (hours === 168) return '1 week';
  return `${hours} hours`;
}

export function escalationRole(currentRole) {
  const idx = ROLE_HIERARCHY.indexOf(currentRole);
  if (idx < 0 || idx >= ROLE_HIERARCHY.length - 1) return 'city';
  return ROLE_HIERARCHY[idx + 1];
}
