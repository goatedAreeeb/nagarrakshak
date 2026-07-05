import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Database, AlertTriangle, History, Send } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const CONFIDENCE_STYLES = { high: 'text-accent-emerald', medium: 'text-accent-amber', low: 'text-accent-red' };

// Makes the MP-recommends / District-Authority-sanctions boundary (research
// bible Part II §3) explicit on screen, not just implied by a raw enum value —
// this is one of the fatal gaps a naive relabel would visibly miss.
const ROUTING_DISPLAY = {
  mplads_eligible: { label: 'MP recommends (MPLADS-eligible)', badgeClass: 'badge-cyan' },
  refer_elsewhere: { label: 'Referred to District Authority', badgeClass: 'badge-amber' },
  advocacy_only: { label: 'Advocacy only — no scheme match', badgeClass: 'badge-violet' },
};

export default function ProposalDetailPage() {
  const { id } = useParams();
  const { roleV2 } = useAuth();
  const canOverride = ['mp_staff', 'mp'].includes(roleV2);

  const [proposal, setProposal] = useState(null);
  const [score, setScore] = useState(null);
  const [components, setComponents] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [overrideReason, setOverrideReason] = useState('');
  const [justification, setJustification] = useState('');
  const [newRank, setNewRank] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  async function loadAll() {
    setLoading(true);
    const { data: proposalRow, error: proposalError } = await supabase
      .from('development_proposals')
      .select('id, title, description, category, status, geographic_unit_id, geographic_units(name)')
      .eq('id', id)
      .single();
    if (proposalError || !proposalRow) {
      setError(proposalError?.message || 'Proposal not found');
      setLoading(false);
      return;
    }
    setProposal(proposalRow);

    const { data: scoreRow } = await supabase
      .from('priority_scores')
      .select('id, total_score, confidence, model_version, explanation_text, explanation_validated, computed_at')
      .eq('proposal_id', id)
      .maybeSingle();
    setScore(scoreRow ?? null);

    if (scoreRow) {
      const { data: componentRows } = await supabase
        .from('score_components')
        .select('name, value, weight, source, confidence, missing_data')
        .eq('priority_score_id', scoreRow.id);
      setComponents(componentRows ?? []);
    }

    const { data: evidenceRows } = await supabase
      .from('evidence_records')
      .select('id, category, metric_name, metric_value, unit, freshness_label, confidence, dataset_sources(name, is_live)')
      .eq('geographic_unit_id', proposalRow.geographic_unit_id);
    setEvidence(evidenceRows ?? []);

    const { data: recRows } = await supabase
      .from('recommendations')
      .select('id, routing, rank, rationale, created_at')
      .eq('proposal_id', id)
      .order('created_at', { ascending: false })
      .limit(1);
    const rec = recRows?.[0] ?? null;
    setRecommendation(rec);

    if (rec) {
      const { data: overrideRows } = await supabase
        .from('human_overrides')
        .select('id, previous_rank, new_rank, override_reason, justification, created_at, users(name)')
        .eq('recommendation_id', rec.id)
        .order('created_at', { ascending: false });
      setOverrides(overrideRows ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!recommendation) return;
    setSubmitting(true);
    setSubmitMessage('');
    const { data, error: fnError } = await supabase.functions.invoke('log-override', {
      body: {
        recommendation_id: recommendation.id,
        new_rank: newRank ? Number(newRank) : null,
        override_reason: overrideReason.trim(),
        justification: justification.trim() || null,
      },
    });
    if (fnError) {
      setSubmitMessage(`Failed: ${fnError.message}`);
    } else {
      setSubmitMessage('Override logged.');
      setOverrideReason('');
      setJustification('');
      setNewRank('');
      await loadAll();
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AppShell title="Proposal" breadcrumb={[{ label: 'Staff' }, { label: 'Proposals' }]}>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !proposal) {
    return (
      <AppShell title="Proposal" breadcrumb={[{ label: 'Staff' }, { label: 'Proposals' }]}>
        <p className="text-sm text-accent-red">{error || 'Not found'}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={proposal.title} breadcrumb={[{ label: 'Staff' }, { label: 'Proposals' }, { label: proposal.title }]}>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link to="/staff/proposals" className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to proposals
        </Link>

        <div className="card-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-hint">{proposal.geographic_units?.name}</p>
          <h2 className="text-lg font-semibold text-text-primary mt-1">{proposal.title}</h2>
          <p className="text-sm text-text-secondary mt-1">{proposal.category?.replace(/_/g, ' ')}</p>
          {proposal.description && <p className="text-sm text-text-secondary mt-2">{proposal.description}</p>}
        </div>

        {score ? (
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-text-primary">Priority score</p>
              <span className={`text-2xl font-bold tabular-nums ${CONFIDENCE_STYLES[score.confidence]}`}>
                {Math.round(score.total_score * 100)}
              </span>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Model: {score.model_version} · Computed {new Date(score.computed_at).toLocaleString()}
            </p>

            <div className="space-y-2">
              {components.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{c.name.replace(/_/g, ' ')} <span className="text-text-hint">(w={Math.round(c.weight * 100)}%)</span></span>
                  <span className={c.missing_data ? 'text-text-hint italic' : 'text-text-primary font-medium'}>
                    {c.missing_data ? 'needs verification' : c.value != null ? Math.round(c.value * 100) / 100 : '—'}
                  </span>
                </div>
              ))}
            </div>

            {score.explanation_text && (
              <div className="mt-4 pt-4 border-t border-border-default">
                <p className="text-xs uppercase tracking-wide text-text-hint mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={12} /> Explanation {score.explanation_validated === false && '(fallback — LLM output failed citation validation)'}
                </p>
                <p className="text-sm text-text-secondary">{score.explanation_text}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Not yet scored.</p>
        )}

        {recommendation && (
          <div className="card-elevated p-4">
            <p className="font-semibold text-text-primary mb-1">Routing</p>
            <p className="text-sm text-text-secondary">
              {(() => {
                const display = ROUTING_DISPLAY[recommendation.routing] ?? { label: recommendation.routing.replace(/_/g, ' '), badgeClass: 'badge-cyan' };
                return <span className={display.badgeClass}>{display.label}</span>;
              })()}
            </p>
            <p className="text-xs text-text-muted mt-2">{recommendation.rationale}</p>
          </div>
        )}

        {evidence.length > 0 && (
          <div className="card-elevated p-4">
            <p className="font-semibold text-text-primary mb-2 flex items-center gap-1.5">
              <Database size={14} /> Evidence
            </p>
            <div className="space-y-2">
              {evidence.map((ev) => (
                <div key={ev.id} className="text-sm border-l-2 border-l-border-strong pl-3">
                  <p className="text-text-primary">{ev.metric_value?.toLocaleString()} {ev.unit} — {ev.metric_name.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    <AlertTriangle size={10} /> {ev.dataset_sources?.name} · {ev.freshness_label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {canOverride && recommendation && (
          <div className="card-elevated p-4">
            <p className="font-semibold text-text-primary mb-3">Override this recommendation</p>
            <form onSubmit={handleOverride} className="space-y-3">
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Reason (required)</label>
                <textarea
                  className="input-field min-h-[70px]"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  required
                  placeholder="e.g. Ward councillor confirmed urgent structural risk not reflected in the score"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">
                  Justification (reference an evidence field, or state political/contextual judgment)
                </label>
                <input
                  className="input-field"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">New rank (optional)</label>
                <input
                  type="number"
                  className="input-field"
                  value={newRank}
                  onChange={(e) => setNewRank(e.target.value)}
                />
              </div>
              <button type="submit" disabled={submitting || !overrideReason.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                <Send size={16} /> {submitting ? 'Logging…' : 'Log override'}
              </button>
              {submitMessage && <p className="text-sm text-text-secondary">{submitMessage}</p>}
            </form>
          </div>
        )}

        {overrides.length > 0 && (
          <div className="card-elevated p-4">
            <p className="font-semibold text-text-primary mb-2 flex items-center gap-1.5">
              <History size={14} /> Override history
            </p>
            <div className="space-y-2">
              {overrides.map((o) => (
                <div key={o.id} className="text-sm border-l-2 border-l-border-strong pl-3">
                  <p className="text-text-primary">{o.override_reason}</p>
                  <p className="text-xs text-text-muted">
                    {o.users?.name} · rank {o.previous_rank ?? '—'} → {o.new_rank ?? '—'} ·{' '}
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
