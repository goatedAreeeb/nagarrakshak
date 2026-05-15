import { useEffect, useState } from 'react';
import { getSLAStatus, formatTimeLeft, getSLAColor } from '../../lib/slaEngine';
import { cn } from '../../lib/utils';

const sizeClasses = {
  sm: 'text-xs gap-1.5',
  md: 'text-sm gap-2',
  lg: 'text-base gap-2.5',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export default function SLATimer({ sla_deadline, sla_hours = 48, size = 'md', className }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!sla_deadline) {
    return (
      <span className={cn('inline-flex items-center font-medium text-text-muted', sizeClasses[size], className)}>
        No deadline set
      </span>
    );
  }

  const sla = getSLAStatus(sla_deadline, sla_hours);
  const timeLabel = formatTimeLeft(sla.hoursLeft);
  const colorClass = getSLAColor(sla.status);
  const isBreached = sla.status === 'breached';

  return (
    <div
      className={cn(
        'inline-flex items-center font-medium',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {isBreached && (
        <span
          className={cn('rounded-full bg-accent-red animate-pulse shrink-0', dotSizes[size])}
          aria-hidden
        />
      )}
      <span>{timeLabel}</span>
    </div>
  );
}
