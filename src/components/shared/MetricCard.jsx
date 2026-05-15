import { cn } from '../../lib/utils';

const ACCENT_STYLES = {
  brand: {
    glow: 'metric-glow-brand',
    iconWrap: 'bg-cyan-500/15 border-cyan-400/25',
    icon: 'text-cyan-300',
    label: 'text-cyan-200/70',
  },
  success: {
    glow: 'metric-glow-emerald',
    iconWrap: 'bg-emerald-500/15 border-emerald-400/30',
    icon: 'text-emerald-300',
    label: 'text-emerald-200/70',
  },
  warning: {
    glow: 'metric-glow-amber',
    iconWrap: 'bg-amber-500/15 border-amber-400/25',
    icon: 'text-amber-300',
    label: 'text-amber-200/70',
  },
  danger: {
    glow: 'metric-glow-red',
    iconWrap: 'bg-red-500/15 border-red-400/30',
    icon: 'text-red-300',
    label: 'text-red-200/70',
  },
  violet: {
    glow: 'metric-glow-violet',
    iconWrap: 'bg-violet-500/15 border-violet-400/25',
    icon: 'text-violet-300',
    label: 'text-violet-200/70',
  },
};

export default function MetricCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent = 'brand',
  className,
  onClick,
}) {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.brand;
  const isButton = onClick != null;

  const classes = cn(
    'metric-card-accent relative overflow-hidden rounded-2xl p-4 text-left w-full transition-all duration-200',
    'bg-white/[0.04] backdrop-blur-glass border',
    styles.glow,
    isButton && 'cursor-pointer hover:scale-[1.02] hover:brightness-110',
    className
  );

  const content = (
    <>
      {Icon && (
        <div
          className={cn(
            'mb-3 flex h-9 w-9 items-center justify-center rounded-full border',
            styles.iconWrap
          )}
        >
          <Icon className={cn('h-4 w-4', styles.icon)} strokeWidth={2} />
        </div>
      )}
      <p className={cn('text-[11px] font-semibold uppercase tracking-wider', styles.label)}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{value}</p>
      {sublabel && <p className="mt-1 text-[13px] text-text-muted leading-snug">{sublabel}</p>}
    </>
  );

  if (isButton) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
