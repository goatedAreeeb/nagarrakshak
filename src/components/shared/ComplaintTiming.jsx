import SLATimer from './SLATimer';
import {
  getResolutionDuration,
  isResolvedStatus,
  isSlaCountdownActive,
  getSlaPendingLabel,
} from '../../lib/slaEngine';
import { cn } from '../../lib/utils';

export default function ComplaintTiming({
  status,
  created_at,
  resolved_at,
  sla_deadline,
  sla_hours,
  assigned_to,
  size = 'md',
  className,
}) {
  const resolved = isResolvedStatus(status);

  if (resolved) {
    const duration = getResolutionDuration(created_at, resolved_at);
    if (!duration) return null;
    return (
      <span className={cn('font-medium text-emerald-300/90', size === 'sm' ? 'text-xs' : 'text-sm', className)}>
        Resolved in {duration}
      </span>
    );
  }

  const slaActive = isSlaCountdownActive({ status, sla_deadline, assigned_to });

  if (!slaActive) {
    return (
      <span
        className={cn(
          'font-medium text-text-muted',
          size === 'sm' ? 'text-xs' : 'text-sm',
          className
        )}
      >
        {getSlaPendingLabel(status)}
      </span>
    );
  }

  return (
    <SLATimer sla_deadline={sla_deadline} sla_hours={sla_hours} size={size} className={className} />
  );
}
