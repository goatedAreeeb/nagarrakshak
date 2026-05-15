import { cn } from '../../lib/utils';
import { formatMapPopulation } from '../../lib/mapWardStats';

function healthAccent(score, open) {
  if (open >= 12) {
    return {
      border: 'border-red-400/60',
      glow: 'shadow-[0_0_40px_rgba(239,68,68,0.35)]',
      score: 'text-red-400',
    };
  }
  if (open >= 1 || score < 50) {
    return {
      border: 'border-amber-400/50',
      glow: 'shadow-[0_0_36px_rgba(245,158,11,0.25)]',
      score: 'text-amber-400',
    };
  }
  if (score >= 75) {
    return {
      border: 'border-emerald-400/50',
      glow: 'shadow-[0_0_36px_rgba(16,185,129,0.2)]',
      score: 'text-emerald-400',
    };
  }
  return {
    border: 'border-cyan-400/40',
    glow: 'shadow-[0_0_32px_rgba(34,211,238,0.2)]',
    score: 'text-cyan-400',
  };
}

function healthLabel(score, open) {
  if (open >= 20) return 'Critical';
  if (open >= 10) return 'High issues';
  if (open >= 1) return 'Needs attention';
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'Moderate';
  return 'Watch zone';
}

export default function WardTooltip({ ward, x, y, visible }) {
  if (!visible || !ward) return null;

  const score = Math.round(ward.health_score ?? 0);
  const open = ward.open_issues ?? 0;
  const resolved = ward.resolved_issues ?? 0;
  const total = ward.total_issues ?? open + resolved;
  const pop = ward.population ?? 0;
  const fixRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const accent = healthAccent(score, open);

  const left = Math.min(x + 18, typeof window !== 'undefined' ? window.innerWidth - 290 : x + 18);
  const top = Math.min(y + 18, typeof window !== 'undefined' ? window.innerHeight - 340 : y + 18);

  return (
    <div
      className={cn(
        'map-tooltip-3d pointer-events-none fixed z-[60] w-[280px] overflow-hidden rounded-2xl border-2',
        accent.border,
        accent.glow,
        'animate-map-tooltip-in'
      )}
      style={{ left, top }}
      role="tooltip"
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-transparent to-black/20"
        aria-hidden
      />

      <div className="relative px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-white">{ward.ward_name}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-300">
              {ward.zone} Zone · GHMC Circle
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-center backdrop-blur-sm">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Health</p>
            <p className={cn('text-2xl font-bold tabular-nums leading-none', accent.score)}>{score}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-white/90">{healthLabel(score, open)}</p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(8, score)}%` }}
          />
        </div>

        <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2.5 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Population</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">
            {formatMapPopulation(pop)}
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              ({pop.toLocaleString('en-IN')})
            </span>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="Open" value={open} valueClass="text-red-400" />
          <StatBox label="Resolved" value={resolved} valueClass="text-emerald-400" />
          <StatBox label="Fixed %" value={`${fixRate}%`} valueClass="text-cyan-300" />
        </div>

        {ward.dominant_category && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs">
            <span className="font-medium text-slate-300">Top issue</span>
            <span className="font-semibold text-white">{ward.dominant_category}</span>
          </div>
        )}

        <p className="mt-2.5 text-center text-[10px] text-slate-400">Click to zoom · scroll to tilt</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, valueClass }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.08] px-2 py-2 text-center backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">{label}</p>
      <p className={cn('mt-0.5 text-base font-bold tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}
