import * as Icons from 'lucide-react';
import { deptColor, deptIcon, cn } from '../../lib/utils';

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

export default function DeptTag({
  dept,
  size = 'md',
  showIcon = true,
  className,
  onClick,
  interactive,
  active,
  stopPropagation = true,
}) {
  if (!dept) return null;

  const color = deptColor(dept);
  const iconName = deptIcon(dept);
  const Icon = Icons[iconName] || Icons.HelpCircle;
  const isInteractive = interactive || typeof onClick === 'function';

  const handleClick = (e) => {
    if (stopPropagation) e.stopPropagation();
    onClick?.(dept, e);
  };

  const handleKeyDown = (e) => {
    if (!isInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  };

  return (
    <span
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        sizeClasses[size],
        isInteractive &&
          'cursor-pointer transition-all hover:brightness-125 hover:shadow-[0_0_12px_currentColor] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        active && 'ring-2 ring-white/40 ring-offset-1 ring-offset-transparent',
        className
      )}
      style={{
        backgroundColor: `${color}18`,
        color,
        borderColor: `${color}40`,
      }}
      title={isInteractive ? `View all ${dept} issues` : undefined}
    >
      {showIcon && <Icon size={iconSizes[size]} strokeWidth={2} aria-hidden />}
      {dept}
    </span>
  );
}
