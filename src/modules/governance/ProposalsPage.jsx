import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, TrendingUp, ShieldCheck, ArrowRightLeft, Megaphone } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const ROUTING_META = {
  mplads_eligible: { label: 'MPLADS-eligible', icon: ShieldCheck, className: 'badge-cyan' },
  refer_elsewhere: { label: 'Refer elsewhere', icon: ArrowRightLeft, className: 'badge-amber' },
  advocacy_only: { label: 'Advocacy only', icon: Megaphone, className: 'badge-violet' },
};

/**
 * Ranked proposal list for MP-office staff. This is the one screen where the
 * whole point of the project is visible at a glance: not "ranked by complaint
 * count" (research bible's named weak-solution pattern) but a computed,
 * source-attributed score with a visible confidence level per proposal.
 */
export default function ProposalsPage() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: proposalRows, error: proposalError } = await supabase
        .from('development_proposals')
        .select('id, title, category, status, geographic_unit_id, geographic_units(name), priority_scores(total_score, confidence)')
        .order('created_at', { ascending: false });

      if (proposalError) {
        setError(proposalError.message);
        setLoading(false);
        return;
      }

      const { data: recommendationRows } = await supabase
        .from('recommendations')
        .select('id, proposal_id, routing, rank, created_at')
        .order('created_at', { ascending: false });

      const latestRecommendationByProposal = new Map();
      for (const rec of recommendationRows ?? []) {
        if (!latestRecommendationByProposal.has(rec.proposal_id)) {
          latestRecommendationByProposal.set(rec.proposal_id, rec);
        }
      }

      const merged = (proposalRows ?? [])
        .map((p) => ({
          ...p,
          score: Array.isArray(p.priority_scores) ? p.priority_scores[0] : p.priority_scores,
          recommendation: latestRecommendationByProposal.get(p.id) ?? null,
        }))
        .sort((a, b) => (b.score?.total_score ?? -1) - (a.score?.total_score ?? -1));

      setProposals(merged);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell title="Development proposals" breadcrumb={[{ label: 'Staff' }, { label: 'Proposals' }]}>
      <div className="max-w-3xl mx-auto space-y-5">
        <p className="text-[15px] text-text-secondary">
          Ranked by a transparent, non-LLM weighted score (see{' '}
          <Link to="/staff/settings/weights" className="text-accent-cyan underline underline-offset-2">
            visible weights
          </Link>
          ). Routing reflects what an MP can actually act on — recommend, refer elsewhere, or
          advocate only.
        </p>

        {error && (
          <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="card-elevated p-8 text-center text-text-secondary">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 text-text-hint" strokeWidth={1.5} />
            No development proposals yet. Proposals are bootstrapped from theme clusters via
            compute-priority.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p, i) => {
              const routingMeta = ROUTING_META[p.recommendation?.routing] ?? null;
              const RoutingIcon = routingMeta?.icon;
              return (
                <Link
                  key={p.id}
                  to={`/staff/proposals/${p.id}`}
                  className="card-elevated p-4 flex items-center gap-4 hover:border-accent-cyan/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-sm font-bold text-text-secondary shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-primary truncate">{p.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {p.geographic_units?.name} · {p.category?.replace(/_/g, ' ') || 'uncategorized'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {routingMeta && (
                      <span className={`${routingMeta.className} flex items-center gap-1 text-[11px]`}>
                        {RoutingIcon && <RoutingIcon size={11} />}
                        {routingMeta.label}
                      </span>
                    )}
                    <div className="text-right">
                      <p className="flex items-center gap-1 text-sm font-bold tabular-nums text-text-primary">
                        <TrendingUp size={13} className="text-accent-cyan" />
                        {p.score ? Math.round(p.score.total_score * 100) : '—'}
                      </p>
                      <p className="text-[10px] text-text-muted uppercase">{p.score?.confidence ?? 'unscored'}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
