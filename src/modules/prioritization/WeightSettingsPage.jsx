import { Scale, AlertTriangle } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';

/**
 * Read-only for MVP (Report 2 Phase 8: "read-only is acceptable; editable is a
 * stretch goal"). These values MUST be kept in sync with the WEIGHTS constant in
 * supabase/functions/compute-priority/index.ts — there is no shared weights table
 * yet, so this page mirrors the Edge Function's source of truth rather than being
 * fed by it. That duplication is a known, accepted piece of technical debt for
 * the MVP; a real weights-config table + editable UI is the natural next step.
 */
const WEIGHTS = [
  { name: 'Population Impact', key: 'population_impact', weight: 0.35, note: 'Corrected by an equity multiplier (see below) rather than weighted separately, to avoid double-counting.' },
  { name: 'Severity / Need', key: 'severity_need', weight: 0.30, note: 'Currently a proxy from citizen-submission sentiment — not yet a validated infrastructure-gap index.' },
  { name: 'Feasibility', key: 'feasibility', weight: 0.15, note: 'No land-availability/scheme-eligibility dataset connected yet — always flagged for human verification.' },
  { name: 'Cost', key: 'cost', weight: 0.10, note: 'Rule-based cost-band lookup by category (internal reference table, not fabricated).' },
  { name: 'Urgency', key: 'urgency', weight: 0.10, note: 'Category-specific rule table.' },
];

export default function WeightSettingsPage() {
  const total = WEIGHTS.reduce((s, w) => s + w.weight, 0);

  return (
    <AppShell title="Ranking weights" breadcrumb={[{ label: 'Staff' }, { label: 'Weights' }]}>
      <div className="max-w-2xl mx-auto space-y-5">
        <p className="text-[15px] text-text-secondary">
          These weights drive every priority score. They are shown here — not hidden inside a
          model — so any ranking can be audited and challenged. No weight here is applied by an
          LLM; scoring is deterministic arithmetic (see <code>compute-priority</code>).
        </p>

        <div className="card-elevated p-4 flex items-start gap-3 border-l-2 border-l-accent-amber">
          <AlertTriangle className="w-4 h-4 text-accent-amber mt-0.5 shrink-0" />
          <p className="text-sm text-text-secondary">
            Read-only for this MVP. Editing weights (and versioning historical scores against the
            weight version used) is the natural next step, not yet built.
          </p>
        </div>

        <div className="space-y-3">
          {WEIGHTS.map((w) => (
            <div key={w.key} className="card-elevated p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-text-primary flex items-center gap-2">
                  <Scale size={16} className="text-accent-cyan" />
                  {w.name}
                </p>
                <span className="text-lg font-bold tabular-nums text-text-primary">
                  {Math.round(w.weight * 100)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden mb-2">
                <div className="h-full rounded-full bg-accent-cyan" style={{ width: `${w.weight * 100}%` }} />
              </div>
              <p className="text-xs text-text-muted">{w.note}</p>
            </div>
          ))}
        </div>

        <div className="card-elevated p-4 border-l-2 border-l-accent-emerald">
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary font-semibold">Equity correction</span> — applied as
            a multiplier on Population Impact (currently neutral, 1.0×) rather than a separate
            weighted term, since it corrects that same input rather than being an independent
            factor (per this project's own documented critique of naive additive weighting).
            Defaults to neutral until enough cross-geography submission history exists to detect
            access bias.
          </p>
        </div>

        <p className="text-xs text-text-hint">
          Weights sum to {Math.round(total * 100)}%. A missing component's weight is excluded from
          the normalizing total for that specific score, rather than counted as a zero — a proposal
          is never penalized just because one input isn't available yet.
        </p>
      </div>
    </AppShell>
  );
}
