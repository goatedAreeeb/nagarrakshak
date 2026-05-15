import { cn } from '../../lib/utils';
import { formatMapPopulation } from '../../lib/mapWardStats';

function healthTone(score) {
  if (score >= 75) return 'text-accent-emerald';
  if (score >= 50) return 'text-accent-amber';
  return 'text-accent-red';
}

function healthLabel(score) {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'Moderate';
  return 'Needs attention';
}

export default function WardTooltip({ ward, x, y, visible }) {
  if (!visible || !ward) return null;

  const score = Math.round(ward.health_score ?? 0);
  const open = ward.open_issues ?? 0;
  const resolved = ward.resolved_issues ?? 0;
  const total = ward.total_issues ?? open + resolved;
  const pop = ward.population ?? 0;
  const fixRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const left = Math.min(x + 16, typeof window !== 'undefined' ? window.innerWidth - 280 : x + 16);
  const top = Math.min(y + 16, typeof window !== 'undefined' ? window.innerHeight - 320 : y + 16);

  return (
    <div
      className="pointer-events-none fixed z-[60] w-[268px] rounded-xl border border-border-glow bg-bg-surface/98 px-4 py-3 shadow-glow-cyan backdrop-blur-md"
      style={{ left, top }}
      role="tooltip"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-text-primary">{ward.ward_name}</div>
          <div className="mt-0.5 text-xs text-text-secondary">
            {ward.zone} Zone · GHMC Circle
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-hint">
            Health score
          </div>
          <div className={cn('text-xl font-bold tabular-nums leading-none', healthTone(score))}>
            {score}
          </div>
          <div className={cn('text-[10px] font-medium', healthTone(score))}>{healthLabel(score)}</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-red via-accent-amber to-accent-emerald transition-all"
          style={{ width: `${Math.max(6, score)}%` }}
        />
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-bg-elevated/80 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-hint">
          Population
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">
          {formatMapPopulation(pop)}
          <span className="ml-1 text-xs font-normal text-text-muted">
            ({pop.toLocaleString('en-IN')})
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-bg-elevated px-2 py-2">
          <div className="text-text-hint">Open</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-accent-red">{open}</div>
        </div>
        <div className="rounded-lg bg-bg-elevated px-2 py-2">
          <div className="text-text-hint">Resolved</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-accent-emerald">{resolved}</div>
        </div>
        <div className="rounded-lg bg-bg-elevated px-2 py-2">
          <div className="text-text-hint">Fixed %</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-accent-cyan">{fixRate}%</div>
        </div>
      </div>

      {ward.dominant_category && (
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="text-text-hint">Top issue type</span>
          <span className="font-medium text-accent-cyan">{ward.dominant_category}</span>
        </div>
      )}

      <div className="mt-2 text-[10px] text-text-hint">Click area to zoom in · scroll to tilt map</div>
    </div>
  );
}
