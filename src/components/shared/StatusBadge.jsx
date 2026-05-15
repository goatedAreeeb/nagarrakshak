import { cn } from '../../lib/utils';

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    classes: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  },
  assigned: {
    label: 'Assigned',
    classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  in_progress: {
    label: 'In Progress',
    classes: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
  },
  resolved: {
    label: 'Resolved',
    classes: 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30',
  },
  closed: {
    label: 'Closed',
    classes: 'bg-text-secondary/15 text-text-secondary border-text-secondary/30',
  },
  reopened: {
    label: 'Reopened',
    classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export default function StatusBadge({ status = 'open', size = 'md', className }) {
  const config = STATUS_CONFIG[status] || {
    label: status?.replace(/_/g, ' ') || 'Unknown',
    classes: 'bg-bg-elevated text-text-secondary border-border-default',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium capitalize',
        sizeClasses[size],
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
